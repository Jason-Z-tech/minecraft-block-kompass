// Elfen-Baumstadt – eigenes Design: vier Riesenbäume mit Plattformen, Wendeltreppen um die Stämme, Hängebrücken,
// kleinen Häusern mit Kupferdächern, Laternen und Ranken. Lokal: Hauptbaum bei x 0, z 0, Boden y 0.
// Westbaum, Ostbaum und Nordbaum liegen auf den Achsen, damit die Brücken gerade verlaufen.

import { hashPosition } from '../../core/random.js';
import { stateId } from '../../core/blockstate.js';
import { terrain, pond, bush, tree, vegetation, flowerBed, pathAlong, lightRoom } from '../lib/index.js';

export const meta = {
  id: 'elfen-baumstadt',
  title: 'Elfen-Baumstadt',
  category: 'fantasy',
  subtitle: 'Riesenbäume mit Plattformen, Hängebrücken und Wendeltreppen',
  tags: ['Elfen', 'Baumhaus', 'Baumstadt', 'Riesenbaum', 'Hängebrücke', 'Wendeltreppe', 'Wald', 'Fantasy', 'Plattformen', 'Laternen'],
  aliases: [
    'elfen baumstadt', 'elfenbaumstadt', 'elfenstadt', 'elfen stadt', 'baumstadt', 'baum stadt', 'baumhausstadt', 'baumhaus dorf',
    'baumhausdorf', 'elfendorf', 'elven city', 'elf city', 'elven tree city', 'tree city', 'treehouse village', 'tree village',
    'lothlorien', 'lórien', 'caras galadhon', 'elfen baumhaus', 'riesenbaum', 'hängebrücke', 'haengebruecke', 'elfen baumstat',
  ],
  accuracy: 'eigenes',
  difficulty: 4,
  description: 'Eine Elfenstadt hoch in den Bäumen: vier Riesenbäume mit hellgrauer Blasseichen-Rinde tragen ringförmige '
    + 'Plattformen auf mehreren Ebenen. Um jeden Stamm windet sich eine Wendeltreppe vom Waldboden bis nach oben, '
    + 'durchhängende Hängebrücken verbinden die Bäume. Auf den Plattformen stehen kleine Häuser mit grünen Kupferdächern, '
    + 'Laternen leuchten, und unter den Plattformen hängen leuchtende Höhlenranken.',
  facts: [
    'Der Hauptbaum ist 43 Blöcke hoch und hat einen Stamm mit 9 Blöcken Durchmesser; die drei anderen Bäume haben 7.',
    'Drei Hängebrücken (12 bis 14 Blöcke lang, 5 breit) hängen in der Mitte zwei Blöcke durch.',
    'Die Wendeltreppen steigen pro Feld um eine Stufe: Bis zur obersten Plattform des Hauptbaums (30 Blöcke hoch) sind es 30 Stufen.',
    'Die Rinde ist aus Blasseichenholz, die Kronen aus Birken- und Azaleenlaub; die Dächer aus gewachstem oxidiertem Kupfer bleiben grün.',
    'Angeregt von Elfenstädten in Bäumen wie Caras Galadhon in Tolkiens Lothlórien – aber ein eigenes Design, kein Nachbau.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

// ---------- Maße ----------
const TREES = [
  { name: 'Hauptbaum', x: 0, z: 0, R: 4, H: 43, start: Math.PI / 2, platforms: [{ y: 10, r: 11 }, { y: 20, r: 11 }, { y: 30, r: 9 }] },
  { name: 'Westbaum', x: -36, z: 0, R: 3, H: 33, start: Math.PI / 2, platforms: [{ y: 10, r: 10 }, { y: 20, r: 7 }] },
  { name: 'Ostbaum', x: 36, z: 0, R: 3, H: 35, start: Math.PI / 2, platforms: [{ y: 10, r: 10 }, { y: 22, r: 7 }] },
  { name: 'Nordbaum', x: 0, z: -34, R: 3, H: 33, start: 0, platforms: [{ y: 20, r: 10 }] },
];
const BRIDGES = [
  { name: 'West', from: [0, 'west'], to: [1, 'east'], level: 10 },
  { name: 'Ost', from: [0, 'east'], to: [2, 'west'], level: 10 },
  { name: 'Nord', from: [0, 'north'], to: [3, 'south'], level: 20 },
];
// Häuser: Baum, Plattform-Höhe, Richtung vom Stamm aus (Haus steht dort, Tür zeigt zum Stamm)
const HOUSES = [
  { tree: 0, y: 10, dir: 'south', kind: 'halle' },
  { tree: 0, y: 20, dir: 'west', kind: 'schlaf' },
  { tree: 1, y: 10, dir: 'west', kind: 'schlaf' },
  { tree: 2, y: 10, dir: 'east', kind: 'bibliothek' },
  { tree: 3, y: 20, dir: 'north', kind: 'schlaf' },
];

const BARK = 'pale_oak_log[axis=y]';
const BRANCH = 'pale_oak_wood';
const FLOOR = 'birch_planks';
const FLOOR_RING = 'pale_oak_planks';
const RIM = 'stripped_pale_oak_wood';
const STAIRS = 'birch_stairs';
const SLAB = 'birch_slab';
const FENCE = 'birch_fence';
const ROOF = { stairs: 'waxed_oxidized_cut_copper_stairs', slab: 'waxed_oxidized_cut_copper_slab', full: 'waxed_oxidized_cut_copper' };
const LEAVES = [['birch_leaves', 6], ['azalea_leaves', 2], ['flowering_azalea_leaves', 2]];

const DIR = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const ROTATE_FOR = { south: 0, west: 90, north: 180, east: 270 };

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

function cardinal(dx, dz) {
  return Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north');
}

// ---------- Wendeltreppe ----------

// Geschlossener Ring aus Feldern um (0, 0) mit Abstand ρ, jedes Feld berührt das nächste mit einer Kante.
function ringCells(rho, start) {
  const cells = [];
  const key = (c) => `${c[0]},${c[1]}`;
  const seen = new Set();
  const push = (c) => {
    if (cells.length && key(cells[cells.length - 1]) === key(c)) return;
    if (seen.has(key(c))) return;
    seen.add(key(c));
    cells.push(c);
  };
  const steps = 720;
  for (let i = 0; i <= steps; i++) {
    const a = start + (i / steps) * Math.PI * 2;
    const c = [Math.round(Math.cos(a) * rho), Math.round(Math.sin(a) * rho)];
    const prev = cells[cells.length - 1];
    if (prev && prev[0] !== c[0] && prev[1] !== c[1]) {
      // Ecke einfügen: das Zwischenfeld, das näher am Ring liegt
      const m1 = [c[0], prev[1]];
      const m2 = [prev[0], c[1]];
      const err = (m) => Math.abs(Math.hypot(m[0], m[1]) - rho);
      push(err(m1) <= err(m2) ? m1 : m2);
    }
    push(c);
  }
  return cells;
}

// Stufen der Wendeltreppe eines Baums: [{ x, y, z, facing }], eine Stufe je Feld und Ebene, vom Boden bis zur obersten Plattform.
function spiralSteps(t) {
  const ring = ringCells(t.R + 1.5, t.start);
  const top = t.platforms[t.platforms.length - 1].y;
  const steps = [];
  for (let k = 0; 1 + k <= top; k++) {
    const [dx, dz] = ring[k % ring.length];
    const [nx, nz] = ring[(k + 1) % ring.length];
    steps.push({ x: t.x + dx, y: 1 + k, z: t.z + dz, facing: cardinal(nx - dx, nz - dz), out: [dx, dz] });
  }
  return steps;
}

function stepIndex(t) {
  const map = new Map();
  for (const s of spiralSteps(t)) {
    const k = `${s.x},${s.z}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s.y);
  }
  return map;
}

// ---------- Bauteile ----------

function trunk(b, t) {
  for (let y = 1; y <= t.H; y++) {
    const r = y > t.H - 3 ? t.R - (y - (t.H - 3)) : t.R;
    for (let dx = -t.R; dx <= t.R; dx++) {
      for (let dz = -t.R; dz <= t.R; dz++) {
        if (Math.hypot(dx, dz) <= r + 0.5) b.set(t.x + dx, y, t.z + dz, BARK);
      }
    }
  }
}

// Wurzeln: Holz-Blöcke strahlen am Boden aus, die Seite der Treppe bleibt frei.
function roots(b, t) {
  for (let i = 0; i < 7; i++) {
    const a = t.start + 0.9 + i * ((Math.PI * 2 - 1.8) / 6);
    const len = t.R + 4 + (hashPosition(i, t.x, t.z, 3) % 3);
    for (let d = t.R; d <= len; d++) {
      const x = t.x + Math.round(Math.cos(a) * d);
      const z = t.z + Math.round(Math.sin(a) * d);
      const axis = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 'x' : 'z';
      b.set(x, 1, z, `${BRANCH}[axis=${axis}]`);
      if (d <= t.R + 2) b.set(x, 2, z, `${BRANCH}[axis=y]`);
    }
  }
}

function spiralStairs(b, t, stairsAt) {
  for (const s of spiralSteps(t)) {
    b.set(s.x, s.y, s.z, `${STAIRS}[facing=${s.facing},half=bottom]`);
    // Geländerpfosten außen, nicht an den Plattformen
    const near = t.platforms.some((p) => s.y + 1 >= p.y - 1 && s.y + 1 <= p.y + 2);
    const [ox, oz] = DIR[cardinal(s.out[0], s.out[1])];
    const onRing = stairsAt.has(`${s.x + ox},${s.z + oz}`);
    if (!near && !onRing && s.y > 1 && s.y % 2 === 0 && b.get(s.x + ox, s.y + 1, s.z + oz) === 'air') b.set(s.x + ox, s.y + 1, s.z + oz, FENCE);
  }
}

function bridgeExits(t) {
  const exits = [];
  BRIDGES.forEach((br) => {
    for (const [ti, dir] of [br.from, br.to]) if (TREES[ti] === t) exits.push({ dir, level: br.level });
  });
  return exits;
}

function inExit(t, level, dx, dz) {
  return bridgeExits(t).some((e) => {
    if (e.level !== level) return false;
    const [ux, uz] = DIR[e.dir];
    const along = dx * ux + dz * uz;
    const across = Math.abs(dx * uz - dz * ux);
    return along > 0 && across <= 2;
  });
}

// Ringplattform: Bretter innen, Rand aus geschälter Blasseiche, darunter Streben zum Stamm. Wo die Treppe durchläuft,
// bleibt der Boden offen (Kopfhöhe 2).
function platform(b, t, p, stairsAt) {
  for (let dx = -p.r; dx <= p.r; dx++) {
    for (let dz = -p.r; dz <= p.r; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > p.r + 0.5 || d <= t.R + 0.5) continue;
      const ys = stairsAt.get(`${t.x + dx},${t.z + dz}`) ?? [];
      if (ys.some((h) => h >= p.y - 2 && h <= p.y)) continue;
      const ring = Math.round(d) % 4 === 0;
      b.set(t.x + dx, p.y, t.z + dz, d > p.r - 0.5 ? `${RIM}[axis=y]` : ring ? FLOOR_RING : FLOOR);
    }
  }
  // Streben unter dem Rand, schräg zum Stamm
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const from = [t.x + Math.round(Math.cos(a) * (t.R + 1)), p.y - 5, t.z + Math.round(Math.sin(a) * (t.R + 1))];
    const to = [t.x + Math.round(Math.cos(a) * (p.r - 1)), p.y - 1, t.z + Math.round(Math.sin(a) * (p.r - 1))];
    woodLine(b, from, to, BRANCH, stairsAt);
  }
}

function railing(b, t, p) {
  const posts = [];
  for (let dx = -p.r; dx <= p.r; dx++) {
    for (let dz = -p.r; dz <= p.r; dz++) {
      const d = Math.hypot(dx, dz);
      if (d > p.r + 0.5 || d <= p.r - 0.5) continue;
      if (inExit(t, p.y, dx, dz)) continue;
      const x = t.x + dx;
      const z = t.z + dz;
      if (b.get(x, p.y, z) === 'air' || b.get(x, p.y + 1, z) !== 'air') continue;
      b.set(x, p.y + 1, z, FENCE);
      posts.push([x, z, Math.atan2(dz, dx)]);
    }
  }
  // Laternen auf jedem fünften Pfosten (nach Winkel sortiert, damit sie gleichmäßig verteilt sind)
  posts.sort((a, c) => a[2] - c[2]);
  posts.forEach(([x, z], i) => {
    if (i % 5 === 0 && b.get(x, p.y + 2, z) === 'air') b.set(x, p.y + 2, z, 'lantern[hanging=false]');
  });
}

// Holzlinie mit lückenlosen Ecken (Achse nach Hauptrichtung); Felder der Treppe bleiben frei.
function woodLine(b, [x1, y1, z1], [x2, y2, z2], id, stairsAt = null) {
  const ax = Math.abs(x2 - x1);
  const ay = Math.abs(y2 - y1);
  const az = Math.abs(z2 - z1);
  const axis = ay >= ax && ay >= az ? 'y' : ax >= az ? 'x' : 'z';
  const n = Math.max(ax, ay, az);
  let prev = null;
  const put = (x, y, z) => {
    const ys = stairsAt ? stairsAt.get(`${x},${z}`) ?? [] : [];
    if (ys.some((h) => y >= h - 1 && y <= h + 2)) return;
    if (b.get(x, y, z) === 'air') b.set(x, y, z, `${id}[axis=${axis}]`);
  };
  for (let k = 0; k <= n; k++) {
    const t = n === 0 ? 0 : k / n;
    const c = [Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), Math.round(z1 + (z2 - z1) * t)];
    if (prev && (prev[0] !== c[0] || prev[2] !== c[2]) && prev[1] !== c[1]) put(c[0], prev[1], c[2]);
    put(...c);
    prev = c;
  }
}

// Hängebrücke zwischen zwei Plattformrändern entlang einer Achse: 5 breit, hängt in der Mitte 2 durch, Treppen an den
// Stufen, Geländer aus Zäunen, Pfosten mit Laternen an den Enden.
function hangingBridge(b, br) {
  const a = TREES[br.from[0]];
  const c = TREES[br.to[0]];
  const pa = a.platforms.find((p) => p.y === br.level);
  const pc = c.platforms.find((p) => p.y === br.level);
  const [ux, uz] = DIR[br.from[1]];
  const startD = pa.r + 1;
  const total = Math.abs((c.x - a.x) * ux + (c.z - a.z) * uz);
  const endD = total - pc.r - 1;
  const len = endD - startD;
  const sag = 2;
  const yAt = (i) => br.level - Math.round(sag * 4 * (i / len) * (1 - i / len));
  for (let i = 0; i <= len; i++) {
    const d = startD + i;
    const y = yAt(i);
    const prevY = i > 0 ? yAt(i - 1) : br.level;
    const nextY = i < len ? yAt(i + 1) : br.level;
    let deck;
    if (prevY > y) deck = `${STAIRS}[facing=${cardinal(-ux, -uz)},half=bottom]`;
    else if (nextY > y) deck = `${STAIRS}[facing=${cardinal(ux, uz)},half=bottom]`;
    else deck = `${SLAB}[type=top]`;
    for (let w = -2; w <= 2; w++) {
      const x = a.x + ux * d + uz * w;
      const z = a.z + uz * d + ux * w;
      b.set(x, y, z, deck);
      if (Math.abs(w) === 2) {
        b.set(x, y + 1, z, FENCE);
        if (i === 0 || i === len) {
          b.set(x, y + 2, z, FENCE);
          b.set(x, y + 3, z, 'lantern[hanging=false]');
        }
      }
    }
  }
  return len + 1;
}

// Kleines Elfenhaus 5 × 5 auf einer Plattform. Lokal: Tür im Süden (lz 2), wird zum Stamm gedreht.
function house(b, h) {
  const t = TREES[h.tree];
  const p = t.platforms.find((q) => q.y === h.y);
  const [ux, uz] = DIR[h.dir];
  const dist = t.R + 5;
  if (dist + 2 > p.r) throw new Error(`elfen-baumstadt: Plattform auf Höhe ${h.y} am ${t.name} ist zu klein für ein Haus.`);
  const cx = t.x + ux * dist;
  const cz = t.z + uz * dist;
  // Tür zeigt zum Stamm: lokal Süden → Richtung zum Stamm
  const towardTrunk = cardinal(-ux, -uz);
  b.transform({ offset: [cx, h.y, cz], rotate: ROTATE_FOR[towardTrunk] }, () => {
    for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) b.set(lx, 0, lz, 'stripped_birch_wood[axis=y]');
    for (let ly = 1; ly <= 3; ly++) {
      for (let lx = -2; lx <= 2; lx++) {
        for (let lz = -2; lz <= 2; lz++) {
          const edge = Math.abs(lx) === 2 || Math.abs(lz) === 2;
          if (!edge) {
            b.set(lx, ly, lz, 'air');
            continue;
          }
          const corner = Math.abs(lx) === 2 && Math.abs(lz) === 2;
          b.set(lx, ly, lz, corner ? 'stripped_birch_log[axis=y]' : ly === 1 ? 'pale_oak_planks' : 'birch_planks');
        }
      }
    }
    // Fenster auf drei Seiten, Tür vorne
    for (const [lx, lz] of [[-2, 0], [2, 0], [0, -2]]) {
      b.set(lx, 2, lz, 'glass_pane');
      b.set(lx, 3, lz, 'glass_pane');
    }
    b.door(0, 1, 2, 'birch_door', { facing: 'north', hinge: 'left' });
    // Pyramidendach mit Kupfer; die Spitze ist ein voller Block, damit der Blitzableiter aufsitzt (auf einer unteren
    // Stufe schwebte er einen halben Block darüber).
    b.roof({ x1: -2, z1: -2, x2: 2, z2: 2, y: 4, type: 'pyramid', stairs: ROOF.stairs, slab: ROOF.slab, full: ROOF.full, overhang: 1 });
    b.set(0, 7, 0, ROOF.full);
    b.set(0, 8, 0, 'waxed_oxidized_lightning_rod[facing=up]');
    // Laterne vorne unter dem Dachüberstand, innen eine an zwei Ketten unter der Dachspitze
    b.set(-1, 3, 3, 'lantern[hanging=true]');
    b.set(0, 6, 0, 'iron_chain[axis=y]');
    b.set(0, 5, 0, 'iron_chain[axis=y]');
    b.set(0, 4, 0, 'lantern[hanging=true]');
    // Einrichtung
    if (h.kind === 'schlaf') {
      b.bed(-1, 1, 0, 'white_bed', { facing: 'north' });
      b.set(1, 1, -1, 'barrel[facing=up]');
      b.set(1, 2, -1, 'potted_azure_bluet');
      b.set(1, 1, 0, 'birch_shelf[facing=west]');
    } else if (h.kind === 'bibliothek') {
      for (let lx = -1; lx <= 1; lx++) b.set(lx, 1, -1, 'bookshelf');
      b.set(0, 2, -1, 'chiseled_bookshelf[facing=south,slot_0_occupied=true,slot_1_occupied=true,slot_4_occupied=true]');
      b.set(-1, 1, 0, 'lectern[facing=east]');
      b.set(1, 1, 0, 'birch_stairs[facing=east,half=bottom]');
    } else {
      b.set(0, 1, -1, 'crafting_table');
      b.set(-1, 1, -1, 'birch_stairs[facing=north,half=bottom]');
      b.set(1, 1, -1, 'birch_stairs[facing=north,half=bottom]');
      b.set(-1, 1, 1, 'green_carpet');
      b.set(1, 1, 1, 'green_carpet');
      b.set(-1, 1, 0, 'potted_flowering_azalea_bush');
    }
  });
  return { cx, cz, y: h.y };
}

// Krone: Äste aus dem Stamm zu mehreren Laubwolken, Laub nur in Luft.
function crown(b, t) {
  const big = t.R >= 4;
  const blobs = [];
  const count = big ? 6 : 5;
  for (let i = 0; i < count; i++) {
    const a = i * (Math.PI * 2 / count) + (big ? 0.3 : 0.8);
    const reach = big ? 8 : 6;
    blobs.push({ x: t.x + Math.round(Math.cos(a) * reach), y: t.H - 1 + (i % 2), z: t.z + Math.round(Math.sin(a) * reach), r: big ? 6 : 5 });
  }
  blobs.push({ x: t.x, y: t.H + 3, z: t.z, r: big ? 7 : 5.5 });
  for (const blob of blobs) woodLine(b, [t.x, t.H - 5, t.z], [blob.x, blob.y, blob.z], BRANCH);
  for (const blob of blobs) {
    const r = blob.r;
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
        for (let dy = -Math.ceil(r * 0.7); dy <= Math.ceil(r * 0.7); dy++) {
          const e = Math.hypot(dx / r, dy / (r * 0.7), dz / r);
          if (e > 1) continue;
          const x = blob.x + dx;
          const y = blob.y + dy;
          const z = blob.z + dz;
          if (e > 0.8 && rand01(x, y, z, 5) < 0.45) continue;
          if (b.get(x, y, z) !== 'air') continue;
          b.set(x, y, z, mixAt(LEAVES, x, y, z, 7));
        }
      }
    }
  }
}

// Leuchtende Höhlenranken unter den Plattformrändern und Sporenblüten, Ranken am Stamm.
function hangingPlants(b, t, stairsAt) {
  for (const p of t.platforms) {
    for (let i = 0; i < 18; i++) {
      const a = i * (Math.PI * 2 / 18) + p.y;
      const d = p.r - 1 - (i % 2);
      const x = t.x + Math.round(Math.cos(a) * d);
      const z = t.z + Math.round(Math.sin(a) * d);
      if (b.get(x, p.y, z) === 'air') continue;
      const len = 1 + (hashPosition(x, p.y, z, 9) % 4);
      let ok = true;
      for (let k = 1; k <= len; k++) if (b.get(x, p.y - k, z) !== 'air') ok = false;
      if (!ok) continue;
      if (i % 6 === 3) {
        b.set(x, p.y - 1, z, 'spore_blossom');
        continue;
      }
      for (let k = 1; k < len; k++) b.set(x, p.y - k, z, `cave_vines_plant[berries=${k % 2 === 0}]`);
      b.set(x, p.y - len, z, 'cave_vines[age=25,berries=true]');
    }
  }
  // Ranken am Stamm (nicht im Weg der Treppe)
  for (let y = 3; y < t.H - 6; y++) {
    for (let dx = -t.R - 1; dx <= t.R + 1; dx++) {
      for (let dz = -t.R - 1; dz <= t.R + 1; dz++) {
        const x = t.x + dx;
        const z = t.z + dz;
        if (b.get(x, y, z) !== 'air' || rand01(Math.floor(x / 2), Math.floor(y / 3), Math.floor(z / 2), 11) > 0.33) continue;
        const ys = stairsAt.get(`${x},${z}`) ?? [];
        if (ys.some((h) => y >= h - 1 && y <= h + 3)) continue;
        if (t.platforms.some((p) => y >= p.y - 1 && y <= p.y + 3)) continue;
        const faces = [];
        for (const [name, [ox, oz]] of Object.entries(DIR)) if (stateId(b.get(x + ox, y, z + oz)) === 'pale_oak_log') faces.push(`${name}=true`);
        if (faces.length > 0) b.set(x, y, z, `vine[${faces.join(',')}]`);
      }
    }
  }
}

// Blumen eines Beets, das schon mit dem Boden angelegt wurde, erst jetzt setzen (sie landen im laufenden Schritt).
function replant(b, { x1, z1, x2, z2 }) {
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      for (let y = 1; y <= 2; y++) {
        const state = b.get(x, y, z);
        if (state !== 'air') b.set(x, y, z, state, { raw: true });
      }
    }
  }
}

// Sand und Kies am Teich fallen über Luft herunter: Darunter kommt eine Lage Erde (das Gelände ist nur eine Grasschicht dick).
function underpinSediment(b, { x1, z1, x2, z2, y1, y2 }) {
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      for (let y = y2; y >= y1; y--) {
        const id = stateId(b.get(x, y, z));
        if ((id === 'sand' || id === 'gravel') && b.get(x, y - 1, z) === 'air') b.set(x, y - 1, z, 'dirt');
      }
    }
  }
}

// ---------- Bau ----------

export default function build(b) {
  b.phase('Waldboden', 'Leg eine große Grasfläche an (97 × 85 Blöcke). Markier die vier Baumstandorte: den Hauptbaum in der '
    + 'Mitte, je 36 Blöcke westlich und östlich davon zwei weitere Bäume und 34 Blöcke nördlich den vierten. Vor dem '
    + 'Hauptbaum liegt ein kleiner Teich mit einem Beet dahinter, Waldwege verbinden die Stämme.', {
    tips: ['Steck die Mittelpunkte der Stämme mit einem Zaunpfosten ab – alle Maße der Plattformen zählen von dort.'],
  });
  terrain(b, { x: -50, y: 0, z: -48, width: 101, depth: 86, height: 0, surface: 'gras', seed: 'elfen' });
  pond(b, { x: -6, y: 0, z: 18, width: 13, depth: 9, facing: 'south', shore: 'gemischt', seed: 'elfen' });
  underpinSediment(b, { x1: -7, z1: 17, x2: 7, z2: 27, y1: -2, y2: 0 });
  pathAlong(b, { y: 0, points: [[-36, 7], [-20, 10], [-7, 9]], width: 3, mix: 'gemischt', wiggle: 1, seed: 'west' });
  pathAlong(b, { y: 0, points: [[36, 7], [20, 10], [7, 9]], width: 3, mix: 'gemischt', wiggle: 1, seed: 'ost' });
  pathAlong(b, { y: 0, points: [[7, -34], [10, -20], [7, -7]], width: 3, mix: 'gemischt', wiggle: 1, seed: 'nord' });

  flowerBed(b, { x: -5, y: 0, z: 28, width: 11, depth: 3, facing: 'south', palette: 'kuehl', seed: 'elfen' });

  const stairsIndex = TREES.map((t) => stepIndex(t));

  b.phase('Stämme und Wurzeln', 'Die Stämme sind runde Säulen aus stehenden Blasseichenstämmen: der Hauptbaum 9 Blöcke '
    + 'dick und 43 hoch, die anderen 7 dick und 33 bis 35 hoch. Ganz oben werden sie in drei Ebenen schmaler. Am Fuß '
    + 'strahlen Wurzeln aus Blasseichenholz aus – nur die Seite, an der die Treppe beginnt, bleibt frei.', {
    tips: [
      'Leg für jeden Stamm zuerst einen Kreis auf dem Boden und zieh ihn dann Ebene für Ebene hoch; Gerüstblöcke helfen ab Höhe 5.',
      'Blasseichen wachsen im Blassen Garten – ein Setzling von dort und Knochenmehl liefern viel Holz.',
    ],
  });
  TREES.forEach((t) => {
    b.step(t.name, `${t.name}: Stamm mit ${2 * t.R + 1} Blöcken Durchmesser, ${t.H} hoch, dazu die Wurzeln.`);
    trunk(b, t);
    roots(b, t);
  });

  b.phase('Wendeltreppen', 'Um jeden Stamm windet sich eine Treppe aus Birkenholztreppen, eine Stufe pro Feld, direkt '
    + 'am Stamm entlang. Die Treppe steigt im Uhrzeigersinn (von oben gesehen) und führt durch alle Plattformen '
    + 'bis nach oben. Jede zweite Stufe bekommt außen einen Zaunpfosten als Geländer.', {
    tips: ['Schau beim Setzen jeder Stufe in Laufrichtung – dann liegt die hohe Seite richtig.'],
  });
  TREES.forEach((t, i) => {
    b.step(`Treppe am ${t.name}`, `Vom Waldboden bis zur obersten Plattform in ${t.platforms[t.platforms.length - 1].y} Blöcken Höhe (${t.platforms[t.platforms.length - 1].y} Stufen).`);
    spiralStairs(b, t, stairsIndex[i]);
    b.note(TREES[i].x + Math.round(Math.cos(t.start) * (t.R + 1.5)), 1, TREES[i].z + Math.round(Math.sin(t.start) * (t.R + 1.5)), `Hier beginnt die Treppe am ${t.name}.`);
  });

  b.phase('Plattformen', 'Die Plattformen sind Ringe aus Birkenholzbrettern um die Stämme, jeder vierte Ring aus '
    + 'Blasseichenbrettern, außen eingefasst mit geschälter Blasseiche. Fang direkt am Stamm an und arbeite dich nach außen – so hält jeder Block am vorigen. '
    + 'Darunter laufen acht schräge Streben aus Blasseichenholz vom Stamm zum Rand. Wo die Treppe hindurchführt, bleibt der Boden offen.', {
    tips: ['Ringe zeichnest du am einfachsten, indem du erst die vier Achsenpunkte und die Diagonalen setzt und dann verbindest.'],
  });
  TREES.forEach((t, i) => {
    for (const p of t.platforms) {
      b.step(`${t.name}, Plattform in ${p.y} Blöcken Höhe`, `Ring bis ${p.r} Blöcke um die Stammmitte, jeder vierte Ring aus Blasseichenbrettern, mit Streben darunter.`);
      platform(b, t, p, stairsIndex[i]);
    }
  });

  b.phase('Hängebrücken', 'Drei Hängebrücken verbinden den Hauptbaum mit den anderen Bäumen. Jede ist 5 breit und hängt in '
    + 'der Mitte zwei Blöcke durch: Oben setzt du Birkenholzstufen (obere Hälfte), wo es eine Stufe hinab- oder hinaufgeht, '
    + 'Birkenholztreppen. Am Rand läuft ein Zaun als Geländer, an beiden Enden stehen Pfosten mit Laternen.', {
    tips: ['Bau jede Brücke von beiden Plattformen aus zur Mitte hin – dann triffst du dich an der tiefsten Stelle.'],
  });
  for (const br of BRIDGES) {
    b.step(`Brücke ${br.name}`, `Hängebrücke in ${br.level} Blöcken Höhe vom Hauptbaum zum ${TREES[br.to[0]].name}.`);
    hangingBridge(b, br);
  }

  b.phase('Geländer und Laternen', 'Ringsum an den Plattformrändern kommt ein Birkenholzzaun, außer an den Brücken. Auf jeden '
    + 'fünften Pfosten stellst du eine Laterne.');
  TREES.forEach((t) => {
    b.step(`Geländer am ${t.name}`, 'Zaun am Rand aller Plattformen, Laternen auf den Pfosten.');
    for (const p of t.platforms) railing(b, t, p);
  });

  b.phase('Elfenhäuser', 'Auf fünf Plattformen steht ein kleines Haus (5 × 5): Boden aus geschältem Birkenholz, Ecken '
    + 'aus geschälten Birkenstämmen, unten eine Reihe Blasseichenbretter, darüber Birkenbretter. Die Tür zeigt zum Stamm, '
    + 'auf den anderen drei Seiten sitzen hohe Fenster. Das Pyramidendach aus gewachstem oxidiertem Kupfer hat einen Block '
    + 'Überstand und einen vollen Kupferblock mit Blitzableiter als Spitze. Vor der Tür hängt eine Laterne unter dem '
    + 'Dachüberstand, drinnen eine an zwei Ketten unter der Dachspitze – damit ist der ganze Boden hell genug.', {
    tips: ['Gewachstes Kupfer oxidiert nicht weiter – das Grün bleibt so, wie du es baust. Gewachst wird mit Honigwaben.'],
  });
  HOUSES.forEach((h) => {
    const label = { halle: 'Werkstatt', schlaf: 'Schlafhaus', bibliothek: 'Bibliothek' }[h.kind];
    b.step(`${label} am ${TREES[h.tree].name}`, `${label} auf der Plattform in ${h.y} Blöcken Höhe, Seite ${{ north: 'Norden', south: 'Süden', west: 'Westen', east: 'Osten' }[h.dir]}.`);
    const { cx, cz, y } = house(b, h);
    // Nachprüfung bis unter die Dachspitze (mit der Kettenlaterne); bliebe etwas dunkel, käme eine Laterne dazu.
    lightRoom(b, { x1: cx - 1, y1: y + 1, z1: cz - 1, x2: cx + 1, y2: y + 6, z2: cz + 1 });
  });

  b.phase('Äste und Kronen', 'Aus jedem Stamm wachsen oben Äste aus Blasseichenholz schräg nach außen; um ihre Enden und '
    + 'über der Spitze kommen große Laubwolken aus Birken-, Azaleen- und blühendem Azaleenlaub. Am Rand der Wolken lässt '
    + 'du einzelne Blätter weg, damit die Krone nicht wie eine Kugel aussieht.', {
    tips: ['Laub, das du selbst setzt, verrottet nicht – auch wenn es weit vom Stamm entfernt ist.'],
  });
  TREES.forEach((t) => {
    b.step(`Krone des ${t.name}`, 'Äste und Laubwolken.');
    crown(b, t);
  });

  b.phase('Ranken', 'Unter den Plattformrändern hängen Höhlenranken mit leuchtenden Leuchtbeeren und ein paar '
    + 'Sporenblüten, an den Stämmen klettern Ranken hoch.', {
    tips: ['Höhlenranken wachsen nach unten: Setz eine Leuchtbeere an die Unterseite der Plattform und lass sie mit Knochenmehl wachsen.'],
  });
  TREES.forEach((t, i) => {
    b.step(`Ranken am ${t.name}`, 'Höhlenranken und Sporenblüten unter den Plattformen, Ranken am Stamm.');
    hangingPlants(b, t, stairsIndex[i]);
  });

  b.phase('Lichtung', 'Zum Schluss wird der Waldboden lebendig: Birken und Azaleenbüsche zwischen den Riesenbäumen, ein '
    + 'Blumenbeet am Teich, dazu Farne, Gras und Blumen.');
  b.step('Bäume und Büsche', 'Kleine Birken und Azaleenbüsche zwischen den Stämmen.');
  for (const [x, z, s] of [[-20, -18, 1], [20, -20, 2], [-44, -20, 3], [44, -22, 4], [-22, 26, 5], [24, 28, 6], [-44, 24, 7], [44, 22, 8]]) {
    tree(b, { x, y: 1, z, species: 'birke', size: s % 2 ? 'mittel' : 'klein', seed: s });
  }
  for (const [x, z, s] of [[-12, 12, 1], [13, 13, 2], [-28, -8, 3], [28, -9, 4], [-9, -22, 5], [10, -26, 6]]) {
    bush(b, { x, y: 1, z, size: 'klein', leaves: 'azalee', seed: s });
  }
  b.step('Blumen und Farne', 'Ein Blumenbeet am Teich, Farne und Blumen auf dem ganzen Waldboden.');
  replant(b, { x1: -5, z1: 28, x2: 5, z2: 30 });
  vegetation(b, { x: -50, y: 2, z: -48, width: 101, depth: 86, mix: 'wald', density: 0.28, shape: 'eckig', seed: 'elfen' });
  vegetation(b, { x: -50, y: 2, z: -48, width: 101, depth: 86, mix: 'blumen', density: 0.08, shape: 'eckig', seed: 'elfen-b' });
}
