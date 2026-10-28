// Drachenhort – eigenes Design: Felsenhöhle mit offenem Eingang im Süden, darin das Skelett eines Drachen auf seinem
// Goldschatz. Lokal: Höhlenmitte bei x 0, z 0, Höhlenboden y 0; der Eingang zeigt nach Süden (+z).

import { hashPosition } from '../../core/random.js';
import { isFullSolid } from '../../core/connections.js';
import { stateId } from '../../core/blockstate.js';
import { terrain, tree, rock, vegetation, findDarkSpots } from '../lib/index.js';

export const meta = {
  id: 'drachenhort',
  title: 'Drachenhort',
  category: 'fantasy',
  subtitle: 'Felsenhöhle mit Drachenskelett auf einem Berg aus Gold',
  tags: ['Drache', 'Skelett', 'Höhle', 'Schatz', 'Gold', 'Knochen', 'Fantasy', 'Tropfsteine', 'Lava', 'Hort'],
  aliases: [
    'drachenhort', 'drachen hort', 'drachenhöhle', 'drachenhoehle', 'drachen hoehle', 'drachenskelett', 'drachen skelett',
    'dragon hoard', 'dragon lair', 'dragon cave', 'dragon skeleton', 'drachenschatz', 'schatzhöhle', 'schatzhoehle',
    'goldschatz', 'knochendrache', 'drachenknochen', 'drachenhord', 'dragon bones', 'hort des drachen',
  ],
  accuracy: 'eigenes',
  description: 'Eine Felsenhöhle mit weitem Eingang, in der das Skelett eines riesigen Drachen auf seinem Goldschatz '
    + 'liegt: Schädel mit Hörnern und offenem Maul, geschwungene Wirbelsäule mit Dornen, ein Brustkorb aus Rippen, '
    + 'Beine mit Krallen und zwei halb gefaltete Flügel aus Fingerknochen. Ringsum glänzen Gold- und Rohgoldblöcke, '
    + 'Truhen und Münzen; Fackeln, ein Lavabecken und Leuchtflechte erhellen die Tropfsteinhöhle.',
  sources: [],
  credits: null,
  tested: null,
};

// ---------- Maße ----------
const R_OUT = { x: 27, y: 21, z: 23 };
const R_IN = { x: 24, y: 18, z: 20 };
const MOUTH = { halfWidth: 8.5, height: 12 };
const HOARD = { x: 1, z: -4, r: 13, h: 5.6 };

const ROCK_LOW = [['deepslate', 4], ['cobbled_deepslate', 2], ['tuff', 3], ['stone', 2]];
const ROCK_MID = [['stone', 8], ['andesite', 3], ['cobblestone', 2], ['tuff', 1]];
const ROCK_TOP = [['stone', 6], ['andesite', 2], ['mossy_cobblestone', 2], ['cobblestone', 1]];
const FLOOR_MIX = [['stone', 5], ['andesite', 3], ['tuff', 2], ['coarse_dirt', 1], ['cobblestone', 1]];
const HOARD_MIX = [['gold_block', 6], ['raw_gold_block', 4], ['gilded_blackstone', 1]];
const BONE = 'bone_block';

// ---------- Zufall und Rauschen (fest an Positionen gebunden) ----------

function rand01(x, y, z, salt) {
  return hashPosition(x, y, z, salt) / 4294967296;
}

function mixAt(entries, x, y, z, salt) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand01(x, y, z, salt) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

const smooth = (t) => t * t * (3 - 2 * t);

// Weiches 3D-Rauschen 0 … 1 (Gitter mit Abstand scale, dazwischen geglättet).
function noise3(x, y, z, scale, salt) {
  const fx = x / scale;
  const fy = y / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const z0 = Math.floor(fz);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const tz = smooth(fz - z0);
  const v = (i, j, k) => rand01(x0 + i, y0 + j, z0 + k, salt);
  const lerp = (a, b, t) => a + (b - a) * t;
  const plane = (k) => lerp(lerp(v(0, 0, k), v(1, 0, k), tx), lerp(v(0, 1, k), v(1, 1, k), tx), ty);
  return lerp(plane(0), plane(1), tz);
}

// ---------- Höhle ----------

function shellValue(x, y, z, r) {
  return Math.sqrt((x / r.x) ** 2 + (y / r.y) ** 2 + (z / r.z) ** 2);
}

function inMouth(x, y, z) {
  if (z < 6 || y < 1) return false;
  const jag = (noise3(x, y, z, 2.5, 41) - 0.5) * 2.2;
  const w = MOUTH.halfWidth * Math.sqrt(Math.max(0, 1 - (y / MOUTH.height) ** 2)) + jag;
  return Math.abs(x) <= w;
}

// Felsmantel: zwischen innerer und äußerer (verbeulter) Ellipsoid-Fläche, Eingang ausgespart.
function isRock(x, y, z) {
  if (y < 1) return false;
  const bump = (noise3(x, y, z, 5, 7) - 0.5) * 0.16;
  if (shellValue(x, y, z, R_OUT) > 1 + bump) return false;
  const inner = (noise3(x, y, z, 4, 9) - 0.5) * 0.14;
  if (shellValue(x, y, z, R_IN) <= 1 + inner) return false;
  return !inMouth(x, y, z);
}

function rockAt(x, y, z) {
  if (y <= 2) return mixAt(ROCK_LOW, x, y, z, 13);
  if (y >= 13) return mixAt(ROCK_TOP, x, y, z, 15);
  return mixAt(ROCK_MID, x, y, z, 14);
}

function buildShell(b, yFrom, yTo) {
  for (let y = yFrom; y <= yTo; y++) {
    for (let x = -R_OUT.x - 2; x <= R_OUT.x + 2; x++) {
      for (let z = -R_OUT.z - 2; z <= R_OUT.z + 2; z++) {
        if (!isRock(x, y, z)) continue;
        const outside = !isRock(x, y + 1, z) && shellValue(x, y + 1, z, R_IN) > 1;
        // Oben auf dem Fels wächst Moos und Gras.
        if (outside && y >= 8) {
          const n = noise3(x, y, z, 3.5, 21);
          b.set(x, y, z, n > 0.55 ? 'grass_block' : n > 0.4 ? 'moss_block' : rockAt(x, y, z));
        } else {
          b.set(x, y, z, rockAt(x, y, z));
        }
      }
    }
  }
}

function caveFloor(b) {
  for (let x = -R_IN.x - 1; x <= R_IN.x + 1; x++) {
    for (let z = -R_IN.z - 1; z <= R_OUT.z; z++) {
      if (shellValue(x, 0, z, R_OUT) > 1.02 && !(z > 0 && Math.abs(x) <= MOUTH.halfWidth + 1)) continue;
      b.set(x, 0, z, mixAt(FLOOR_MIX, x, 0, z, 17));
    }
  }
}

// Lavabecken hinten links: Quellen eine Ebene über dem Boden in einem Rand aus Magma und glattem Basalt.
const LAVA = { x1: -19, z1: -12, x2: -15, z2: -9 };
function lavaPool(b) {
  for (let x = LAVA.x1 - 1; x <= LAVA.x2 + 1; x++) {
    for (let z = LAVA.z1 - 1; z <= LAVA.z2 + 1; z++) {
      const inside = x >= LAVA.x1 && x <= LAVA.x2 && z >= LAVA.z1 && z <= LAVA.z2;
      b.set(x, 0, z, 'smooth_basalt');
      b.set(x, 1, z, inside ? 'lava[level=0]' : rand01(x, 1, z, 3) < 0.5 ? 'magma_block' : 'smooth_basalt');
    }
  }
}

// Tropfsteine an der Decke (hängend) und am Boden (stehend); der Ansatz wird zu Tropfsteinblock.
function dripstoneColumn(b, x, yStart, z, length, dir) {
  const names = length === 1 ? ['tip'] : length === 2 ? ['frustum', 'tip'] : ['base', ...Array(length - 3).fill('middle'), 'frustum', 'tip'];
  names.forEach((thickness, k) => {
    const y = dir === 'down' ? yStart - k : yStart + k;
    b.set(x, y, z, `pointed_dripstone[thickness=${thickness},vertical_direction=${dir}]`);
  });
}

function dripstones(b) {
  let placed = 0;
  for (let x = -18; x <= 18; x += 3) {
    for (let z = -15; z <= 12; z += 3) {
      const jx = x + (hashPosition(x, 0, z, 51) % 3) - 1;
      const jz = z + (hashPosition(x, 1, z, 52) % 3) - 1;
      if (rand01(jx, 0, jz, 53) > 0.55) continue;
      // Decke suchen
      let y = 2;
      while (y < R_OUT.y && !isRock(jx, y, jz)) y++;
      if (y >= R_OUT.y || y < 9) continue;
      if (b.get(jx, y - 1, jz) !== 'air' || b.get(jx, y - 2, jz) !== 'air') continue;
      const length = 1 + (hashPosition(jx, y, jz, 54) % 3);
      let free = true;
      for (let k = 1; k <= length + 2; k++) if (b.get(jx, y - k, jz) !== 'air') free = false;
      if (!free) continue;
      b.set(jx, y, jz, 'dripstone_block');
      dripstoneColumn(b, jx, y - 1, jz, length, 'down');
      placed++;
    }
  }
  // Stehende Tropfsteine am Rand des Bodens
  for (const [x, z, len] of [[-17, -4, 3], [-16, 2, 2], [-18, 6, 1], [16, -9, 2], [18, -3, 3], [17, 4, 1], [-6, -15, 2], [10, -14, 3], [-12, -12, 1]]) {
    if (b.get(x, 1, z) !== 'air') continue;
    b.set(x, 0, z, 'dripstone_block');
    dripstoneColumn(b, x, 1, z, len, 'up');
  }
  return placed;
}

// Leuchtflechte in Flecken an Wänden und Decke (haftet an der Seite, an der Fels ist).
function glowLichen(b) {
  const sides = [['north', 0, 0, -1], ['south', 0, 0, 1], ['west', -1, 0, 0], ['east', 1, 0, 0], ['up', 0, 1, 0]];
  for (let x = -R_IN.x; x <= R_IN.x; x++) {
    for (let z = -R_IN.z; z <= R_IN.z; z++) {
      for (let y = 3; y <= R_IN.y; y++) {
        if (b.get(x, y, z) !== 'air' || noise3(x, y, z, 3, 61) < 0.72 || rand01(x, y, z, 62) > 0.5) continue;
        const props = [];
        for (const [name, dx, dy, dz] of sides) if (isRock(x + dx, y + dy, z + dz)) props.push(`${name}=true`);
        if (props.length > 0) b.set(x, y, z, `glow_lichen[${props.join(',')}]`);
      }
    }
  }
}

// ---------- Schatz ----------

function hoardHeight(x, z, pile) {
  const d = Math.hypot(x - pile.x, (z - pile.z) * 1.15);
  const wob = (noise3(x, 0, z, 3, 71) - 0.5) * 1.6;
  return Math.round(pile.h * (1 - (d / pile.r) ** 2) + wob);
}

function heapGold(b, pile, salt) {
  for (let x = Math.floor(pile.x - pile.r); x <= Math.ceil(pile.x + pile.r); x++) {
    for (let z = Math.floor(pile.z - pile.r); z <= Math.ceil(pile.z + pile.r); z++) {
      const h = hoardHeight(x, z, pile);
      if (h <= 0 || b.get(x, 1, z) !== 'air') continue;
      for (let y = 1; y <= h; y++) b.set(x, y, z, mixAt(HOARD_MIX, x, y, z, salt));
      if (rand01(x, h, z, salt + 1) < 0.4 && b.get(x, h + 1, z) === 'air') b.set(x, h + 1, z, 'light_weighted_pressure_plate');
    }
  }
}

const OUTWARD = (dx, dz) => (Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north'));

// Truhen am Rand des großen Haufens: vom Mittelpunkt nach außen bis zum ersten freien Bodenfeld, Deckel nach außen.
// Paare liegen quer zur Blickrichtung nebeneinander und werden so zu Doppeltruhen.
function hoardChests(b) {
  for (const [angle, pair] of [[0.3, true], [1.4, false], [2.2, true], [3.3, false], [4.1, true], [5.2, false]]) {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    let t = 0;
    let x;
    let z;
    do {
      t++;
      x = Math.round(HOARD.x + dx * t);
      z = Math.round(HOARD.z + dz * t * 0.87);
    } while (b.get(x, 1, z) !== 'air' && t < 30);
    const facing = OUTWARD(dx, dz);
    b.set(x, 1, z, `chest[facing=${facing}]`);
    if (!pair) continue;
    const [sx, sz] = facing === 'north' || facing === 'south' ? [1, 0] : [0, 1];
    if (b.get(x + sx, 1, z + sz) === 'air') b.set(x + sx, 1, z + sz, `chest[facing=${facing}]`);
  }
}

// Erste freie Zelle über einem Stapel (eine Münze dort wird ersetzt).
function topOf(b, x, z) {
  let y = 1;
  while (b.get(x, y, z) !== 'air' && !b.get(x, y, z).startsWith('light_weighted_pressure_plate')) y++;
  return y;
}

function treasureDetails(b) {
  hoardChests(b);
  for (const [x, z] of [[15, -7], [15, -8], [-13, 2]]) if (b.get(x, 1, z) === 'air') b.set(x, 1, z, 'barrel[facing=up]');
  for (const [x, z, n] of [[0, -1, 3], [6, -7, 2], [-4, -7, 4], [8, -1, 1], [2, -12, 3]]) {
    b.set(x, topOf(b, x, z), z, `yellow_candle[candles=${n},lit=true]`);
  }
  b.set(4, topOf(b, 4, -10), -10, 'bell[attachment=floor,facing=south]');
  // Schädel früherer Abenteurer
  for (const [x, z, rot] of [[-12, 10, 3], [8, 11, 10], [17, -3, 6], [-14, -6, 12]]) {
    if (b.get(x, 1, z) === 'air') b.set(x, 1, z, `skeleton_skull[rotation=${rot}]`);
  }
  // kleine Haufen an den Wänden
  heapGold(b, { x: -16, z: -2, r: 3.2, h: 2 }, 81);
  heapGold(b, { x: 16, z: -13, r: 3, h: 2 }, 83);
  heapGold(b, { x: 16, z: 8, r: 2.6, h: 1.6 }, 85);
}

// ---------- Skelett ----------

function axisOf(dx, dy, dz) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const az = Math.abs(dz);
  if (ay >= ax && ay >= az) return 'y';
  return ax >= az ? 'x' : 'z';
}

// Knochen entlang einer Linie aus Punkten; Achse je Abschnitt nach der Hauptrichtung. Schräge Stellen werden mit einem
// Zwischenblock aufgefüllt, damit sich die Blöcke immer mit einer Fläche berühren (sonst wirkt der Knochen zerbröselt).
function bonePath(b, points, block = BONE) {
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1, z1] = points[i];
    const [x2, y2, z2] = points[i + 1];
    const state = `${block}[axis=${axisOf(x2 - x1, y2 - y1, z2 - z1)}]`;
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1));
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0 : k / n;
      const cell = [Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), Math.round(z1 + (z2 - z1) * t)];
      if (prev) {
        // erst waagrecht, dann senkrecht nachziehen
        const mid = [cell[0], prev[1], prev[2]];
        if (mid[0] !== prev[0] && (mid[1] !== cell[1] || mid[2] !== cell[2])) b.set(...mid, state);
        const mid2 = [cell[0], prev[1], cell[2]];
        if ((mid2[0] !== prev[0] || mid2[2] !== prev[2]) && mid2[1] !== cell[1]) b.set(...mid2, state);
      }
      b.set(...cell, state);
      prev = cell;
    }
  }
}

// Wirbelsäule leicht gewölbt: Schulter → Mitte → Hüfte.
const SHOULDER = [-7, 11, -3];
const SPINE_MID = [2, 12, -4];
const HIP = [11, 9, -5];

function spineAt(x) {
  const [a, c] = x <= SPINE_MID[0] ? [SHOULDER, SPINE_MID] : [SPINE_MID, HIP];
  const t = (x - a[0]) / (c[0] - a[0]);
  return [x, Math.round(a[1] + (c[1] - a[1]) * t), Math.round(a[2] + (c[2] - a[2]) * t)];
}

function spine(b) {
  bonePath(b, [SHOULDER, SPINE_MID, HIP]);
  // Dornfortsätze oben und kurze Querfortsätze seitlich (Wirbel)
  for (let x = SHOULDER[0]; x <= HIP[0]; x += 2) {
    const [, y, z] = spineAt(x);
    b.set(x, y + 1, z, `${BONE}[axis=y]`);
    b.set(x, y + 2, z, 'end_rod[facing=up]');
  }
}

function neck(b) {
  const points = [SHOULDER, [-10, 12, 0], [-9, 10, 4], [-7, 8, 7], [-5, 7, 8]];
  bonePath(b, points);
  for (const [x, y, z] of [[-9, 12, -1], [-10, 12, 1], [-9, 11, 3]]) b.set(x, y + 1, z, 'end_rod[facing=up]');
}

// Schädel mit Maul nach Süden (zum Eingang). Hirnschale 7 breit, Schnauze 5 → 3 breit, Unterkiefer liegt auf dem Boden.
const SKULL_X = -5;
function skull(b) {
  const x0 = SKULL_X;
  const bone = (axis) => `${BONE}[axis=${axis}]`;
  // Hirnschale z 8 … 12, y 3 … 6, hohl
  for (let z = 8; z <= 12; z++) {
    for (let dx = -3; dx <= 3; dx++) {
      for (let y = 3; y <= 6; y++) {
        const ax = Math.abs(dx);
        if (ax === 3 && (y === 6 || z === 8 || z === 12)) continue;
        if (ax === 2 && y === 6 && (z === 8 || z === 12)) continue;
        if (ax <= 2 && y >= 4 && y <= 5 && z >= 9 && z <= 11) continue;
        b.set(x0 + dx, y, z, bone('z'));
      }
    }
  }
  // Augenhöhlen und Brauenwülste
  for (const dx of [-3, 3]) {
    b.set(x0 + dx, 4, 11, 'air');
    b.set(x0 + dx, 5, 11, 'air');
    b.set(x0 + dx, 6, 11, `${BONE}[axis=z]`);
  }
  // Schnauze z 13 … 17: erst 5 breit, vorne 3 breit, mit Nüstern
  for (let z = 13; z <= 17; z++) {
    const half = z <= 14 ? 2 : 1;
    for (let dx = -half; dx <= half; dx++) {
      for (let y = 3; y <= (z <= 15 ? 5 : 4); y++) b.set(x0 + dx, y, z, bone('z'));
    }
  }
  b.set(x0 - 1, 4, 17, 'air');
  b.set(x0 + 1, 4, 17, 'air');
  // dunkle Augen: hinter den Höhlen schwarzer Beton
  for (const dx of [-2, 2]) for (const y of [4, 5]) b.set(x0 + dx, y, 11, 'black_concrete');
  // Unterkiefer: zwei Äste auf dem Boden, vorne verbunden, dazwischen offenes Maul
  for (let z = 9; z <= 17; z++) {
    const dx = z <= 14 ? 2 : 1;
    b.set(x0 - dx, 1, z, bone('z'));
    b.set(x0 + dx, 1, z, bone('z'));
  }
  b.set(x0, 1, 17, bone('x'));
  // Zähne: oben nach unten, unten nach oben, im Wechsel
  for (let z = 12; z <= 17; z++) {
    const dx = z <= 14 ? 2 : 1;
    const state = z % 2 === 0 ? 'end_rod[facing=down]' : 'end_rod[facing=up]';
    b.set(x0 - dx, 2, z, state);
    b.set(x0 + dx, 2, z, state);
  }
  // Hörner nach hinten oben
  for (const side of [-1, 1]) {
    bonePath(b, [[x0 + side * 2, 7, 9], [x0 + side * 3, 8, 7], [x0 + side * 4, 10, 5], [x0 + side * 4, 11, 3]]);
    b.set(x0 + side * 4, 12, 3, 'end_rod[facing=up]');
  }
}

function ribs(b) {
  const widths = { [-5]: 5, [-3]: 6, [-1]: 7, 1: 7, 3: 7, 5: 7, 7: 6, 9: 5 };
  for (const [xs, w] of Object.entries(widths)) {
    const x = Number(xs);
    const [, ys, zs] = spineAt(x);
    for (const side of [-1, 1]) {
      bonePath(b, [
        [x, ys, zs + side],
        [x, ys - 1, zs + side * 4],
        [x, ys - 3, zs + side * w],
        [x, ys - 6, zs + side * w],
        [x, ys - 8, zs + side * (w - 1)],
      ]);
    }
  }
}

function legs(b) {
  const limbs = [
    [[-7, 10, -1], [-8, 7, 2], [-10, 4, 3], [-10, 1, 4]],
    [[-7, 10, -5], [-8, 7, -8], [-10, 4, -9], [-10, 1, -10]],
    [[11, 8, -3], [13, 5, 0], [12, 3, 2], [13, 1, 3]],
    [[11, 8, -7], [13, 5, -10], [12, 3, -12], [13, 1, -13]],
  ];
  for (const limb of limbs) {
    bonePath(b, limb);
    const [fx, fy, fz] = limb[limb.length - 1];
    const dz = fz > limb[0][2] ? 1 : -1;
    for (const [cx, cz, facing] of [[fx - 1, fz, 'west'], [fx - 1, fz + dz, 'west'], [fx, fz + dz, dz > 0 ? 'south' : 'north']]) {
      if (b.get(cx, fy, cz) === 'air') b.set(cx, fy, cz, `end_rod[facing=${facing}]`);
    }
  }
}

function tail(b) {
  const points = [HIP, [15, 8, -8], [19, 6, -6], [21, 4, -1], [20, 2, 5], [16, 1, 10], [10, 1, 13], [5, 1, 14]];
  bonePath(b, points);
  for (const [x, y, z] of [[15, 8, -8], [19, 6, -6], [21, 4, -1]]) b.set(x, y + 1, z, 'end_rod[facing=up]');
  b.set(4, 1, 14, 'end_rod[facing=west]');
}

// Halb gefaltete Flügel: Oberarm, Unterarm bis zum Handgelenk, drei lange Fingerknochen.
function wings(b) {
  const sides = [
    { arm: [[-7, 12, -2], [-4, 15, 2], [1, 14, 8]], fingers: [[[1, 14, 8], [7, 11, 12], [12, 7, 14]], [[1, 14, 8], [4, 8, 14], [5, 4, 16]], [[1, 14, 8], [0, 10, 13], [-1, 6, 17]]] },
    { arm: [[-7, 12, -4], [-4, 14, -8], [1, 12, -12]], fingers: [[[1, 12, -12], [7, 9, -15], [11, 4, -15]], [[1, 12, -12], [3, 6, -16], [4, 3, -17]], [[1, 12, -12], [-3, 8, -15], [-6, 5, -16]]] },
  ];
  for (const side of sides) {
    bonePath(b, side.arm);
    for (const finger of side.fingers) bonePath(b, finger);
  }
  // Fetzen der Flughaut zwischen den Fingern
  for (const [x, y, z] of [[6, 9, 13], [4, 10, 12], [3, 7, 14], [1, 9, 13], [5, 8, -15], [2, 7, -15], [7, 6, -15], [0, 9, -14]]) {
    if (b.get(x, y, z) === 'air') b.set(x, y, z, 'cobweb');
  }
}

// ---------- Licht ----------

const OPPOSITE = { north: 'south', south: 'north', west: 'east', east: 'west' };
const DIRS = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

// Fackeln rund an der Höhlenwand: vom Mittelpunkt nach außen bis zum Fels, Fackel davor, zur Höhle hin.
function wallTorches(b, y, count, phase) {
  const placed = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    let px = 0;
    let pz = 0;
    for (let t = 0; t < 40; t++) {
      const nx = Math.round(dx * t);
      const nz = Math.round(dz * t);
      if (isRock(nx, y, nz)) break;
      px = nx;
      pz = nz;
    }
    if (b.get(px, y, pz) !== 'air' || pz > 10) continue;
    const toWall = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north');
    const [wx, wz] = DIRS[toWall];
    if (!isRock(px + wx, y, pz + wz)) continue;
    b.set(px, y, pz, `wall_torch[facing=${OPPOSITE[toWall]}]`);
    placed.push([px, y, pz]);
  }
  return placed;
}

// Restliche dunkle Stellen in der Höhle (nur unter dem Felsdach, nicht außen auf der Kuppel): Laterne auf den Boden.
// findDarkSpots rechnet wie das Spiel (Blocklicht −1 je Block); stehende Laternen brauchen einen vollen Block darunter.
function lightCave(b) {
  const box = { x1: -R_IN.x, y1: 1, z1: -R_IN.z, x2: R_IN.x, y2: R_IN.y, z2: R_OUT.z };
  const covered = (x, y, z) => {
    for (let yy = y + 1; yy <= R_OUT.y + 3; yy++) if (isRock(x, yy, z)) return true;
    return false;
  };
  // Nur der Höhlenraum samt Eingang zählt, nicht die kleinen Nischen unter den Felsbeulen außen am Fuß der Kuppel.
  const inCave = (x, y, z) => shellValue(x, y, z, R_IN) <= 1.08 || inMouth(x, y, z);
  const placed = [];
  for (let guard = 0; guard < 100; guard++) {
    const dark = findDarkSpots(b, box).filter(([x, y, z]) => inCave(x, y, z) && covered(x, y, z) && isFullSolid(stateId(b.get(x, y - 1, z))));
    if (dark.length === 0) return placed;
    const [x, y, z] = dark[Math.floor(dark.length / 2)];
    b.set(x, y, z, 'lantern[hanging=false]');
    placed.push([x, y, z]);
  }
  throw new Error('drachenhort: die Höhle lässt sich nicht vollständig ausleuchten.');
}

// ---------- Umgebung ----------

// Verbrannter Boden vor dem Eingang (gehört zum Gelände, damit beim Bauen keine Löcher im Gras klaffen).
function scorchedGround(b) {
  for (let x = -10; x <= 10; x++) {
    for (let z = R_OUT.z - 2; z <= R_OUT.z + 12; z++) {
      if (b.get(x, 1, z) !== 'air') continue;
      const n = noise3(x, 0, z, 3, 91);
      const fade = Math.abs(x) / 10 + (z - R_OUT.z) / 14;
      if (n - fade * 0.35 < 0.35) continue;
      b.set(x, 0, z, n > 0.7 ? 'blackstone' : n > 0.55 ? 'coarse_dirt' : 'tuff');
    }
  }
}

// Fichten und Waldboden: Podsol und grobe Erde unter den Kronen kommen schon mit dem Gelände.
const SPRUCES = [[-27, 20, 'gross', 1], [-31, 4, 'mittel', 2], [30, 12, 'gross', 3], [30, -10, 'mittel', 4], [-28, -17, 'gross', 5], [0, -28, 'mittel', 6]];

function forestFloor(b) {
  for (const [cx, cz, size] of SPRUCES) {
    if (size !== 'gross') continue;
    for (let x = cx - 4; x <= cx + 4; x++) {
      for (let z = cz - 4; z <= cz + 4; z++) {
        if (Math.hypot(x - cx, z - cz) > 4.2 || stateId(b.get(x, 0, z)) !== 'grass_block') continue;
        const v = rand01(x, 0, z, 95);
        if (v < 0.5) b.set(x, 0, z, 'podzol');
        else if (v < 0.65) b.set(x, 0, z, 'coarse_dirt');
      }
    }
  }
}

function scatteredBones(b) {
  for (const [x, z, axis] of [[-6, 24, 'x'], [5, 27, 'z'], [8, 23, 'x'], [-3, 30, 'z']]) b.set(x, 1, z, `${BONE}[axis=${axis}]`);
  b.set(-5, 1, 26, 'skeleton_skull[rotation=7]');
  b.set(4, 1, 31, 'skeleton_skull[rotation=2]');
}

// ---------- Bau ----------

export default function build(b) {
  b.phase('Gelände und Höhlenboden');
  terrain(b, { x: -36, y: 0, z: -32, width: 73, depth: 71, height: 0, surface: 'gras', seed: 'drachenhort' });
  caveFloor(b);
  lavaPool(b);
  scorchedGround(b);
  forestFloor(b);

  b.phase('Felswände und Gewölbe');
  const bands = [[1, 4], [5, 9], [10, 14], [15, R_OUT.y + 2]];
  for (const [y1, y2] of bands) {
    b.step();
    buildShell(b, y1, y2);
  }

  b.phase('Tropfsteine und Leuchtflechte');
  b.step();
  dripstones(b);
  b.step();
  glowLichen(b);

  b.phase('Goldschatz');
  heapGold(b, HOARD, 77);
  treasureDetails(b);

  b.phase('Drachenskelett');
  b.step();
  spine(b);
  b.step();
  ribs(b);
  b.step();
  neck(b);
  skull(b);
  b.step();
  legs(b);
  b.step();
  tail(b);
  b.step();
  wings(b);

  b.phase('Fackeln und Licht');
  b.step();
  wallTorches(b, 4, 14, 0.2);
  wallTorches(b, 9, 10, 0.5);
  b.step();
  lightCave(b);

  b.phase('Vor der Höhle');
  b.step();
  scatteredBones(b);
  b.step();
  rock(b, { x: -15, y: 1, z: 27, size: 'gross', material: 'andesit', facing: 'south', sink: 0, seed: 1 });
  rock(b, { x: 16, y: 1, z: 26, size: 'mittel', material: 'stein', facing: 'south', sink: 0, seed: 2 });
  rock(b, { x: 25, y: 1, z: 17, size: 'klein', material: 'tuff', sink: 0, seed: 3 });
  for (const [x, z, size, seed] of SPRUCES) tree(b, { x, y: 1, z, species: 'fichte', size, seed, ground: false });
  b.step();
  vegetation(b, { x: -36, y: R_OUT.y + 3, z: -32, width: 73, depth: 71, mix: 'farn', density: 0.3, shape: 'eckig', seed: 'hort' });
}
