// Kristallhöhle – Höhlenkuppel in einem Hügel mit Amethyst-Geoden, Tropfstein, unterirdischem See und Laternenweg.
// Eigenes Design. Höhlenmitte bei x = 0, z = 0; Gelände und Höhlenboden: Oberkante y = −1, die Höhlenluft beginnt bei y = 0.

import { lampPost, hangingLantern, wallLantern, pathAlong, tree, bush, rock, vegetation, terrain } from '../lib/index.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'kristallhoehle',
  title: 'Kristallhöhle',
  category: 'fantasy',
  subtitle: 'Höhlenkuppel mit Amethyst-Geoden, Tropfstein und unterirdischem See',
  tags: ['Fantasy', 'Höhle', 'Amethyst', 'Geode', 'Tropfstein', 'Stalaktit', 'Stalagmit', 'See', 'Leuchtflechte', 'Laternen', 'Hügel'],
  aliases: [
    'kristallhöhle', 'kristallhoehle', 'kristall höhle', 'amethysthöhle', 'amethyst höhle', 'tropfsteinhöhle', 'tropfstein höhle',
    'geodenhöhle', 'crystal cave', 'amethyst cave', 'dripstone cave', 'geode cave', 'kristalhöhle', 'kristallhöle', 'kristallhohle',
    'höhle mit see', 'unterirdischer see',
  ],
  accuracy: 'eigenes',
  difficulty: 4,
  description: 'Ein grüner Hügel mit einem Felsportal, dahinter öffnet sich eine Höhlenkuppel von 23 × 21 Blöcken und bis zu 10 Blöcken Höhe. '
    + 'Zwei aufgebrochene Amethyst-Geoden glitzern am Fuß der Wände, von der Decke hängen Tropfsteine, und im Norden liegt ein '
    + 'unterirdischer See mit kleinem Steg. Ein Kiesweg mit Laternen führt durch den Tunnel hinein, Leuchtflechte schimmert an Decke und Wänden.',
  facts: [
    'Der Hügel ist rund 41 Blöcke breit und reicht bis Ebene 21; die Höhlenwände sind überall mindestens 3 Blöcke dick.',
    'Jede Geode hat die Schichten wie im Spiel: Glatter Basalt außen, dann Kalzit, dann Amethyst mit knospendem Amethyst.',
    'Tropfsteine haben je nach Länge die richtigen Formen: Ansatz, Mittelstück, Stumpf und Spitze; wo sich zwei treffen, verschmelzen die Spitzen.',
    'Der See (12 × 9 Blöcke) ist bis zu 3 Blöcke tief und besteht nur aus Wasserquellen – nichts fließt aus.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const GROUND_Y = -1;
const BASE_Y = -5;
const HILL = { r: 20, h: 15 };
const CAVE = { rx: 11, ry: 9, rz: 10 };
const MOUTH_Z = 16;
const TUNNEL_Z = 7;
const LAKE = { x: -3, z: -4, rx: 6.5, rz: 4.5 };
// Geoden sitzen am Wandfuß: halb in der Wand, halb im Boden, zur Höhle hin aufgebrochen.
const GEODES = [
  { name: 'West-Geode', x: -11, y: 0, z: 3, salt: 41 },
  { name: 'Nordost-Geode', x: 8, y: 0, z: -8, salt: 42 },
];
const GEODE_R = { air: 2.2, amethyst: 3.2, calcite: 4.0, basalt: 4.7 };
// Weg in der Höhle: vom Tunnel am See vorbei zur Nordost-Geode, Abzweig zur West-Geode.
const MAIN_PATH = [[0, 16], [0, 9], [2, 6], [4, 3], [5, -1], [5, -4]];
const SIDE_PATH = [[0, 8], [-3, 6], [-6, 5]];
const PIER = { x1: -1, x2: 3, z1: -4, z2: -3 };
const RANGE = 24;

// ---------------------------------------------------------------- Rauschen und Formen

function hash01(x, y, z, salt) {
  return (hashPosition(x, y, z, salt) % 100000) / 100000;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Weiches Wertrauschen 0 … 1 (Gitterweite scale), unabhängig von der Aufrufreihenfolge.
function smooth(x, y, z, scale, salt) {
  const fx = x / scale;
  const fy = y / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const z0 = Math.floor(fz);
  const tx = fade(fx - x0);
  const ty = fade(fy - y0);
  const tz = fade(fz - z0);
  const v = (dx, dy, dz) => hash01(x0 + dx, y0 + dy, z0 + dz, salt);
  const plane = (dz) => lerp(lerp(v(0, 0, dz), v(1, 0, dz), tx), lerp(v(0, 1, dz), v(1, 1, dz), tx), ty);
  return lerp(plane(0), plane(1), tz);
}

// Höhlenplan: alle Formen einmal berechnet, damit jedes Kapitel dieselben Zellen nutzt.
function createPlan() {
  const key = (x, z) => `${x},${z}`;
  const pathCells = new Map();
  markPath(pathCells, MAIN_PATH, 1);
  markPath(pathCells, SIDE_PATH, 0.5);
  const tops = new Map();
  for (let z = -RANGE; z <= RANGE; z++) for (let x = -RANGE; x <= RANGE; x++) tops.set(key(x, z), outerTop(x, z));
  const top = (x, z) => tops.get(key(x, z)) ?? -Infinity;
  const isPath = (x, z) => pathCells.has(key(x, z));
  const nearPath = (x, z, d = 1) => {
    for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) if (isPath(x + dx, z + dz)) return true;
    return false;
  };
  const caveAir = (x, y, z) => {
    if (y < 0) return false;
    if (inTunnel(x, y, z)) return true;
    const q = (x / CAVE.rx) ** 2 + (y / CAVE.ry) ** 2 + (z / CAVE.rz) ** 2;
    if (q > 1 + (smooth(x, y, z, 4, 1) - 0.5) * 0.44) return false;
    // Felsbuckel am Boden nahe der Wand (nie auf dem Weg).
    if (y === 0 && q > 0.62 && smooth(x, 0, z, 3, 2) > 0.6 && !nearPath(x, z)) return false;
    return true;
  };
  const lakeDepth = (x, z) => {
    if (nearPath(x, z) || !caveAir(x, 0, z)) return 0;
    const e = ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2 + (smooth(x, 0, z, 3, 20) - 0.5) * 0.5;
    if (e > 1) return 0;
    return e < 0.3 ? 3 : e < 0.65 ? 2 : 1;
  };
  const geodeAt = (x, y, z) => {
    for (const g of GEODES) {
      const d = Math.hypot(x - g.x, y - g.y, z - g.z);
      if (d > GEODE_R.basalt) continue;
      if (d <= GEODE_R.air) return { layer: 'air', g };
      if (d <= GEODE_R.amethyst) return { layer: hash01(x, y, z, g.salt) < 0.3 ? 'budding_amethyst' : 'amethyst_block', g };
      if (d <= GEODE_R.calcite) return { layer: 'calcite', g };
      return { layer: 'smooth_basalt', g };
    }
    return null;
  };
  // Luft in der Höhle oder im Inneren einer Geode (die Geoden reichen als Mulde in den Boden).
  const open = (x, y, z) => caveAir(x, y, z) || geodeAt(x, y, z)?.layer === 'air';
  const ceilingAbove = (x, z) => {
    if (!caveAir(x, 0, z)) return null;
    let y = 0;
    while (open(x, y + 1, z)) y++;
    return y + 1;
  };
  return { top, isPath, nearPath, caveAir, lakeDepth, geodeAt, open, ceilingAbove, pathCells };
}

function inTunnel(x, y, z) {
  if (z < TUNNEL_Z || z > MOUTH_Z || y < 0) return false;
  const nearMouth = MOUTH_Z - z <= 2;
  const half = nearMouth ? 2 : 1;
  const height = nearMouth ? 5 : 4;
  const ax = Math.abs(x);
  return (ax <= half && y <= height - 2) || (ax <= half - 1 && y === height - 1);
}

function inPier(x, z) {
  return x >= PIER.x1 && x <= PIER.x2 && z >= PIER.z1 && z <= PIER.z2;
}

// Oberkante des Hügels (oberster Block) je Säule; −Infinity außerhalb.
function outerTop(x, z) {
  // Höhenlinien verzerrt, damit der Hügel nicht aus runden Ringen besteht.
  const d = Math.hypot(x, z) * (1 + (smooth(x, 0, z, 9, 5) - 0.5) * 0.3);
  let top = d < HILL.r ? GROUND_Y + HILL.h * (1 - (d / HILL.r) ** 2) + (smooth(x, 0, z, 5, 3) - 0.5) * 3 : -Infinity;
  // Felsnase über dem Eingang.
  const ax = Math.abs(x);
  // Vorplatz vor dem Portal: dort kein Hügel.
  if (z > MOUTH_Z && ax <= 4 + (z - MOUTH_Z)) return -Infinity;
  if (ax <= 6 && z >= 8 && z <= MOUTH_Z) {
    const brow = 7.5 + (smooth(x, 1, z, 3, 4) - 0.5) * 2 - Math.max(0, ax - 3) * 0.9;
    top = Math.max(top, ax <= 3 ? Math.max(7, brow) : brow);
  }
  return Number.isFinite(top) ? Math.round(top) : top;
}

function markPath(cells, points, halfWidth) {
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az)) * 2;
    for (let s = 0; s <= steps; s++) {
      const px = ax + ((bx - ax) * s) / steps;
      const pz = az + ((bz - az) * s) / steps;
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const cx = Math.round(px) + dx;
          const cz = Math.round(pz) + dz;
          if (Math.hypot(cx - px, cz - pz) <= halfWidth + 0.35) cells.set(`${cx},${cz}`, true);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- Materialien

function rockAt(x, y, z) {
  if (y <= -4 && smooth(x, y, z, 4, 12) < 0.55) return hash01(x, y, z, 13) < 0.2 ? 'cobbled_deepslate' : 'deepslate';
  const n = smooth(x, y, z, 5, 10);
  if (n > 0.66) return 'andesite';
  if (n < 0.3) return 'tuff';
  if (smooth(x, y, z, 4, 11) > 0.74) return 'diorite';
  return 'stone';
}

function surfaceRock(x, y, z) {
  const n = hash01(x, y, z, 14);
  if (n < 0.25) return 'mossy_cobblestone';
  if (n < 0.4) return 'cobblestone';
  return rockAt(x, y, z);
}

function slopeAt(plan, x, z) {
  const t = plan.top(x, z);
  let s = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) s = Math.max(s, t - plan.top(x + dx, z + dz));
  return s;
}

const isOutcrop = (x, z) => Math.abs(x) <= 6 && z >= 8 && z <= MOUTH_Z;

// Block des Hügels an (x, y, z), oder null für Luft.
function hillBlock(plan, x, y, z) {
  const top = plan.top(x, z);
  if (y > top) return null;
  if (y >= 0 && plan.caveAir(x, y, z)) return null;
  if (y < 0 && y >= GROUND_Y - 2 && plan.lakeDepth(x, z) >= GROUND_Y - y + 1) return null;
  const geode = plan.geodeAt(x, y, z);
  if (geode) return geode.layer === 'air' ? null : geode.layer;
  const depth = top - y;
  // Steile Stellen und einzelne Felsflecken zeigen Stein statt Gras.
  const steep = slopeAt(plan, x, z) >= 2 || smooth(x, 0, z, 4, 6) > 0.72;
  if (isOutcrop(x, z) && top >= 4) return depth === 0 ? 'grass_block' : surfaceRock(x, y, z);
  if (depth === 0) return steep ? surfaceRock(x, y, z) : 'grass_block';
  if (depth <= 2 && !steep) return hash01(x, y, z, 15) < 0.15 ? 'coarse_dirt' : 'dirt';
  if (depth === 1) return surfaceRock(x, y, z);
  return rockAt(x, y, z);
}

// ---------------------------------------------------------------- Aufbau

export default function build(b) {
  const plan = createPlan();

  b.phase('Untergrund und Seebecken', 'Leg zuerst eine runde Wiese von etwa 49 Blöcken Durchmesser an. Unter dem späteren Hügel (rund 41 Blöcke breit) '
    + 'kommt ein Sockel aus Stein, Andesit und Tuff bis Ebene 5, unten mit Tiefenschiefer. Im Norden der Höhle hebst du das Seebecken aus: '
    + 'etwa 12 × 9 Blöcke, am Rand 1, in der Mitte 3 Blöcke tief. Den Grund belegst du mit Ton und Kies. Im Westen und Nordosten liegen '
    + 'schon die unteren Hälften der beiden Geoden im Sockel: Kugelschalen aus Glattem Basalt, Kalzit und Amethyst um eine Mulde.', {
    tips: [
      'Die Höhlenmitte ist dein Bezugspunkt: Steck sie mit einem Block ab und miss alles von dort aus.',
      'Das Becken bleibt vorerst leer – das Wasser kommt erst, wenn alles rundherum dicht ist.',
    ],
  });
  terrain(b, { x: -RANGE, y: BASE_Y, z: -RANGE, width: RANGE * 2 + 1, depth: RANGE * 2 + 1, height: GROUND_Y - BASE_Y, shape: 'rund', edge: 3, surface: 'gras', seed: 'kristall' });
  b.fill(-RANGE, BASE_Y, -RANGE, RANGE, BASE_Y, RANGE, 'stone', { replace: 'gravel' });
  removeIslands(b, -RANGE, BASE_Y, -RANGE, RANGE, GROUND_Y, RANGE);
  buildHillLayers(b, plan, BASE_Y, GROUND_Y);
  buildLakeBed(b, plan);
  buildMossyShore(b, plan);
  b.note(LAKE.x, GROUND_Y - 2, LAKE.z, 'Tiefste Stelle des Sees: 3 Blöcke Wasser über dem Grund.');

  b.phase('Höhlenwand und Geoden', 'Jetzt mauerst du Ebene für Ebene die Höhlenwand hoch. Innen bleibt eine Kuppel frei (am Boden etwa 23 × 21 Blöcke), '
    + 'außen wird der Hügel nach oben schmaler. Im Westen und im Nordosten wachsen die beiden Geoden am Wandfuß weiter: außen Glatter Basalt, '
    + 'dann Kalzit, innen Amethyst mit knospendem Amethyst – zur Höhle hin sind sie aufgebrochen. Im Süden bleibt der Tunnel frei '
    + '(3 breit, 4 hoch, am Eingang 5 × 5).', {
    tips: [
      'Die äußerste Lage ist Gras, darunter zwei Lagen Erde, der Rest Stein. An steilen Stellen kommt der Stein bis an die Oberfläche.',
      'Baue die Geoden gleich mit: Jede Schicht ist eine Kugelschale, die ganze Geode misst etwa 9 Blöcke, innen bleibt eine Kugel von 5 Blöcken Durchmesser frei.',
    ],
  });
  buildHillLayers(b, plan, 0, 5);
  for (const g of GEODES) b.note(g.x, g.y, g.z, `${g.name}: Basalt außen, Kalzit, Amethyst innen.`);

  b.phase('Kuppel und Hügel', 'Die Kuppel schließt sich: Jede Ebene ragt etwas weiter nach innen, bis die Decke etwa auf Ebene 15 zu ist. '
    + 'Darüber wölbst du den Hügel bis Ebene 21 und deckst ihn mit Gras. Über dem Eingang steht eine Felsnase aus Stein und bemoostem Bruchstein.', {
    tips: [
      'Überhänge kannst du einfach an die Seite des Blocks darunter setzen – Stein fällt nicht herunter.',
      'Lass die Decke ruhig unregelmäßig: eine glatte Halbkugel wirkt nicht wie eine echte Höhle.',
    ],
  });
  buildHillLayers(b, plan, 6, HILL.h + 6);

  b.phase('Tropfstein', 'Tropfsteine wachsen in Gruppen. Setz zuerst Tropfsteinblöcke als Ansatz in Decke und Boden, dann die Spitzen.');
  buildDripstone(b, plan);

  b.phase('Amethyst-Kristalle', 'An den knospenden Amethystblöcken der Geoden wachsen Kristalle in die Höhle. Dazu kommen ein paar Kristallgruppen am Boden.', {
    tips: ['Amethyst-Knospen und -Haufen zeigen immer vom Block weg, an dem sie wachsen. Ziel einfach auf die passende Seite des Blocks.'],
  });
  buildAmethyst(b, plan);

  b.phase('See und Steg', 'Der kleine Steg führt vom Weg aus in den See. Erst die Pfosten, dann das Wasser, dann der Stegboden.');
  buildLake(b, plan);

  b.phase('Weg und Laternen', 'Ein Kiesweg führt vom Eingang durch den Tunnel am See entlang zur Nordost-Geode, ein schmaler Abzweig zur West-Geode. '
    + 'Laternen auf Mauerpfosten säumen den Weg, im Tunnel und in der Kuppel hängen Laternen an Ketten.', {
    tips: ['Ersetze dafür die obersten Bodenblöcke; der Kies liegt auf Stein und kann nicht herunterfallen.'],
  });
  b.step('Kiesweg', 'Ersetze entlang des Wegs die oberste Bodenschicht durch Kies, Bruchstein, Tuff und Andesit: vom Eingang 3 breit '
    + 'durch den Tunnel bis zur Nordost-Geode, dazu der schmale Abzweig nach Westen.');
  buildCavePath(b, plan);
  buildLights(b, plan);

  b.phase('Leuchtflechte und Moos', 'Leuchtflechte wächst in Flecken an Decke und Wänden und auf dem Seegrund. Sie leuchtet schwach (Stufe 7) und lässt die Höhle schimmern. Auf das Ufermoos legst du ein paar Moosteppiche.', {
    tips: ['Leuchtflechte haftet an jeder Seite eines festen Blocks. Mit Knochenmehl breitet sie sich aus – praktisch für große Flächen.'],
  });
  buildLichen(b, plan);

  b.phase('Umgebung', 'Draußen führt ein Kiesweg zum Felsportal, an dessen Seiten Laternen hängen. Ranken wachsen über den Eingang, '
    + 'auf dem Hügel stehen Fichten, Birken und Büsche, dazu bemooste Felsen und Gras.');
  buildOutside(b, plan);
}

// ---------------------------------------------------------------- Hügel

function buildHillLayers(b, plan, y1, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let z = -RANGE; z <= RANGE; z++) {
      for (let x = -RANGE; x <= RANGE; x++) {
        if (plan.top(x, z) < GROUND_Y) continue;
        const block = hillBlock(plan, x, y, z);
        if (block) b.set(x, y, z, block);
        else if (y <= GROUND_Y || b.get(x, y, z) !== 'air') b.remove(x, y, z);
      }
    }
  }
}

// Entfernt kleine, abgetrennte Stücke am ausgefransten Rand der Wiese (Gruppen bis maxSize Blöcke).
// Jede Gruppe wird ganz durchsucht: bräche die Suche früh ab, wären Reste einer großen Gruppe später scheinbar klein.
function removeIslands(b, x1, y1, z1, x2, y2, z2, maxSize = 8) {
  const seen = new Set();
  const key = (x, y, z) => `${x},${y},${z}`;
  const inside = (x, y, z) => x >= x1 && x <= x2 && y >= y1 && y <= y2 && z >= z1 && z <= z2;
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (seen.has(key(x, y, z)) || b.get(x, y, z) === 'air') continue;
        const group = [[x, y, z]];
        seen.add(key(x, y, z));
        for (let i = 0; i < group.length; i++) {
          const [cx, cy, cz] = group[i];
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const n = [cx + dx, cy + dy, cz + dz];
            if (!inside(...n) || seen.has(key(...n)) || b.get(...n) === 'air') continue;
            seen.add(key(...n));
            group.push(n);
          }
        }
        if (group.length <= maxSize) for (const cell of group) b.remove(...cell);
      }
    }
  }
}

// Moos am Seeufer: Moosblöcke im Boden rund um das Wasser (nicht auf dem Weg).
function buildMossyShore(b, plan) {
  for (let z = -CAVE.rz; z <= CAVE.rz; z++) {
    for (let x = -CAVE.rx; x <= CAVE.rx; x++) {
      if (plan.lakeDepth(x, z) > 0 || !plan.caveAir(x, 0, z) || plan.nearPath(x, z, 0) || inPier(x, z) || plan.geodeAt(x, GROUND_Y, z)) continue;
      let near = false;
      for (let dz = -2; dz <= 2 && !near; dz++) for (let dx = -2; dx <= 2 && !near; dx++) near = plan.lakeDepth(x + dx, z + dz) > 0 && Math.abs(dx) + Math.abs(dz) <= 2;
      if (near && hash01(x, 0, z, 17) < 0.75) b.set(x, GROUND_Y, z, 'moss_block');
    }
  }
}

function buildLakeBed(b, plan) {
  for (let z = -RANGE; z <= RANGE; z++) {
    for (let x = -RANGE; x <= RANGE; x++) {
      const depth = plan.lakeDepth(x, z);
      if (depth === 0) continue;
      const bed = GROUND_Y - depth;
      const n = hash01(x, 0, z, 16);
      b.set(x, bed, z, n < 0.45 ? 'clay' : n < 0.8 ? 'gravel' : 'tuff');
    }
  }
}

// ---------------------------------------------------------------- Tropfstein

const THICKNESS = (length, merged) => {
  const tip = merged ? 'tip_merge' : 'tip';
  if (length === 1) return [tip];
  if (length === 2) return ['frustum', tip];
  return ['base', ...Array(length - 3).fill('middle'), 'frustum', tip];
};

// Spitzer Tropfstein: Ansatz bei (x, root, z), wächst in Richtung dir ('down' = von der Decke, 'up' = vom Boden).
function pointed(b, x, root, z, length, dir, merged = false) {
  const step = dir === 'down' ? -1 : 1;
  THICKNESS(length, merged).forEach((thickness, k) => {
    b.set(x, root + k * step, z, `pointed_dripstone[thickness=${thickness},vertical_direction=${dir}]`);
  });
}

// Spots für Tropfsteine: Gruppen nach Rauschen, nie über dem Weg tiefer als Kopfhöhe.
function dripstoneSpots(plan) {
  const hanging = [];
  const standing = [];
  const columns = [];
  for (let z = -CAVE.rz - 1; z <= CAVE.rz + 1; z++) {
    for (let x = -CAVE.rx - 1; x <= CAVE.rx + 1; x++) {
      if (z >= TUNNEL_Z) continue;
      const ceil = plan.ceilingAbove(x, z);
      if (ceil === null || ceil < 3) continue;
      const patch = smooth(x, 0, z, 4, 30);
      if (patch < 0.52) continue;
      const lake = plan.lakeDepth(x, z) > 0;
      const path = plan.nearPath(x, z);
      const r = hash01(x, 1, z, 31);
      if (r > 0.55) continue;
      const minTip = path ? 3 : lake ? 1 : 2;
      const maxLen = Math.max(0, ceil - minTip);
      if (maxLen === 0) continue;
      const len = Math.min(maxLen, 1 + Math.floor(hash01(x, 2, z, 32) * (patch > 0.68 ? 5 : 3)));
      const floorFree = !lake && !path && !inPier(x, z) && plan.caveAir(x, 0, z) && !plan.caveAir(x, -1, z);
      if (floorFree && r < 0.08 && ceil >= 4 && ceil <= 8) {
        columns.push({ x, z, ceil });
        continue;
      }
      hanging.push({ x, z, ceil, len });
      if (floorFree && r < 0.3) {
        const up = Math.min(3, ceil - len - 1, 1 + Math.floor(hash01(x, 3, z, 33) * 3));
        if (up >= 1) standing.push({ x, z, len: up });
      }
    }
  }
  return { hanging, standing, columns };
}

function buildDripstone(b, plan) {
  const spots = dripstoneSpots(plan);
  b.step('Tropfsteinblöcke als Ansatz', 'Ersetze an der Decke und am Boden die Steine über bzw. unter den späteren Tropfsteinen durch Tropfsteinblöcke. '
    + 'Ein paar Blöcke mehr rundherum lassen die Gruppen natürlicher aussehen.');
  for (const s of spots.hanging) setRoot(b, s.x, s.ceil, s.z, plan);
  for (const s of [...spots.standing, ...spots.columns]) setRoot(b, s.x, GROUND_Y, s.z, plan);
  for (const s of spots.columns) setRoot(b, s.x, s.ceil, s.z, plan);

  b.step('Hängende Tropfsteine', 'Setz die Spitzen von oben nach unten an die Decke. Die Form ergibt sich aus der Länge: ein einzelner Tropfstein ist '
    + 'eine Spitze, zwei sind Stumpf und Spitze, ab drei kommt oben der Ansatz dazu und dazwischen Mittelstücke. Im Spiel stellt sich die Form '
    + 'von selbst ein, wenn du Tropfstein an Tropfstein setzt.');
  for (const s of spots.hanging) pointed(b, s.x, s.ceil - 1, s.z, s.len, 'down');

  b.step('Stehende Tropfsteine', 'Unter einigen hängenden Tropfsteinen wachsen kurze Tropfsteine aus dem Boden, mit der Spitze nach oben.');
  for (const s of spots.standing) pointed(b, s.x, 0, s.z, s.len, 'up');

  b.step('Tropfsteinsäulen', 'Wo ein hängender und ein stehender Tropfstein sich treffen, verschmelzen ihre Spitzen zu einer Säule. '
    + 'Setz erst den stehenden Teil, dann den hängenden von der Decke aus, bis sich die Spitzen berühren.');
  for (const s of spots.columns) {
    const up = Math.floor(s.ceil / 2);
    pointed(b, s.x, 0, s.z, up, 'up', true);
    pointed(b, s.x, s.ceil - 1, s.z, s.ceil - up, 'down', true);
  }
  if (spots.columns.length) {
    const c = spots.columns[0];
    b.note(c.x, Math.floor(c.ceil / 2), c.z, 'Tropfsteinsäule: hier berühren sich die Spitzen (Form „verschmolzene Spitze“).');
  }
}

// Tropfsteinblock als Ansatz, dazu Nachbarn in Decke bzw. Boden, wo dort Fels liegt.
function setRoot(b, x, y, z, plan) {
  b.set(x, y, z, 'dripstone_block');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const nz = z + dz;
    if (hash01(nx, y, nz, 34) > 0.45 || plan.isPath(nx, nz)) continue;
    const here = b.get(nx, y, nz);
    if (/^(stone|andesite|tuff|diorite)$/.test(here)) b.set(nx, y, nz, 'dripstone_block');
  }
}

// ---------------------------------------------------------------- Amethyst

const BUD_DIRS = [['up', 0, 1, 0], ['down', 0, -1, 0], ['north', 0, 0, -1], ['south', 0, 0, 1], ['west', -1, 0, 0], ['east', 1, 0, 0]];

function budType(x, y, z) {
  const n = hash01(x, y, z, 50);
  if (n < 0.4) return 'amethyst_cluster';
  if (n < 0.65) return 'large_amethyst_bud';
  if (n < 0.85) return 'medium_amethyst_bud';
  return 'small_amethyst_bud';
}

function buildAmethyst(b, plan) {
  b.step('Kristalle in den Geoden', 'An jedem knospenden Amethyst, der zur Höhle oder in die Geode zeigt, wächst ein Kristall: Amethysthaufen, große, '
    + 'mittlere oder kleine Knospen gemischt.');
  for (const g of GEODES) {
    const r = Math.ceil(GEODE_R.amethyst);
    for (let y = g.y - r; y <= g.y + r; y++) {
      for (let z = g.z - r; z <= g.z + r; z++) {
        for (let x = g.x - r; x <= g.x + r; x++) {
          if (b.get(x, y, z) !== 'budding_amethyst') continue;
          for (const [dir, dx, dy, dz] of BUD_DIRS) {
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            if (b.get(nx, ny, nz) !== 'air' || !plan.open(nx, ny, nz) || plan.isPath(nx, nz)) continue;
            if (hash01(nx, ny, nz, 51) > 0.75) continue;
            b.set(nx, ny, nz, `${budType(nx, ny, nz)}[facing=${dir}]`);
          }
        }
      }
    }
  }
  b.step('Kristallgruppen am Boden', 'Setz an drei Stellen knospenden Amethyst in den Boden, darauf Amethystblöcke und obenauf Haufen; Knospen an den Seiten.');
  for (const [x, z] of [[-6, 8], [8, 2], [-9, -3]]) crystalGroup(b, plan, x, z);
}

function crystalGroup(b, plan, cx, cz) {
  const cells = [[0, 0, 2], [1, 0, 1], [0, -1, 1], [-1, 1, 0]];
  for (const [dx, dz, h] of cells) {
    const x = cx + dx;
    const z = cz + dz;
    if (!plan.caveAir(x, 0, z) || plan.nearPath(x, z, 0) || plan.lakeDepth(x, z) > 0 || plan.geodeAt(x, GROUND_Y, z)) continue;
    b.set(x, GROUND_Y, z, 'budding_amethyst');
    for (let k = 0; k < h; k++) b.set(x, k, z, 'amethyst_block');
    if (plan.caveAir(x, h, z) && b.get(x, h, z) === 'air') b.set(x, h, z, `${budType(x, h, z)}[facing=up]`);
  }
  for (const [dir, dx, dz] of [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]) {
    const x = cx + dx;
    const z = cz + dz;
    if (b.get(x, 1, z) === 'air' && plan.caveAir(x, 1, z) && b.get(cx, 1, cz) === 'amethyst_block') b.set(x, 1, z, `large_amethyst_bud[facing=${dir}]`);
  }
}

// ---------------------------------------------------------------- See und Steg

function buildLake(b, plan) {
  const posts = [[PIER.x1, PIER.z1], [PIER.x1, PIER.z2], [1, PIER.z1], [1, PIER.z2]];
  b.step('Stegpfosten', 'Stell vier geschälte Fichtenstämme auf den Seegrund: zwei am Ende des Stegs, zwei in der Mitte. Sie reichen bis knapp unter die Wasseroberfläche.');
  for (const [x, z] of posts) {
    const depth = plan.lakeDepth(x, z);
    for (let y = GROUND_Y - depth + 1; y < GROUND_Y; y++) b.set(x, y, z, 'stripped_spruce_log[axis=y]');
  }

  b.step('Wasser einfüllen', 'Fülle das Becken mit Wassereimern – nur Quellen, Ebene für Ebene von unten. Weil ringsum Fels ist, fließt nichts aus.');
  for (let z = -RANGE; z <= RANGE; z++) {
    for (let x = -RANGE; x <= RANGE; x++) {
      const depth = plan.lakeDepth(x, z);
      for (let k = 0; k < depth; k++) {
        const y = GROUND_Y - k;
        if (b.get(x, y, z) === 'air') b.set(x, y, z, 'water[level=0]');
      }
    }
  }
  b.note(LAKE.x, GROUND_Y, LAKE.z, 'Unterirdischer See: nur Wasserquellen, bis zu 3 tief.');

  b.step('Stegboden und Geländer', 'Leg obere Fichtenholzstufen als Stegboden aufs Wasser (sie sind dann geflutet, das Wasser bleibt). '
    + 'Ein Fichtenzaun läuft an beiden Seiten mit, am Ende stehen zwei Laternen auf dem Zaun.');
  for (let z = PIER.z1; z <= PIER.z2; z++) {
    for (let x = PIER.x1; x <= PIER.x2; x++) {
      const water = plan.lakeDepth(x, z) > 0;
      b.set(x, GROUND_Y, z, `spruce_slab[type=top,waterlogged=${water}]`);
    }
  }
  for (let x = PIER.x1; x <= PIER.x2 - 1; x++) {
    for (const z of [PIER.z1 - 1, PIER.z2 + 1]) {
      if (plan.lakeDepth(x, z) > 0) b.set(x, GROUND_Y, z, 'spruce_slab[type=top,waterlogged=true]');
      else if (!plan.caveAir(x, 0, z)) continue;
      b.set(x, 0, z, 'spruce_fence');
    }
  }
  b.set(PIER.x1, 1, PIER.z1 - 1, 'lantern[hanging=false]');
  b.set(PIER.x1, 1, PIER.z2 + 1, 'lantern[hanging=false]');
}

// ---------------------------------------------------------------- Weg und Licht

function caveRoadBlock(x, z) {
  const n = hash01(x, 0, z, 60);
  if (n < 0.55) return 'gravel';
  if (n < 0.75) return 'cobblestone';
  if (n < 0.9) return 'tuff';
  return 'andesite';
}

function buildCavePath(b, plan) {
  for (const k of plan.pathCells.keys()) {
    const [x, z] = k.split(',').map(Number);
    if (z > MOUTH_Z || !plan.caveAir(x, 0, z) || plan.lakeDepth(x, z) > 0 || inPier(x, z) || plan.geodeAt(x, GROUND_Y, z)) continue;
    b.set(x, GROUND_Y, z, caveRoadBlock(x, z));
  }
}

const POSTS = [[2, 8], [-2, 5], [6, 4], [3, 0], [7, -3], [4, -6], [-6, 6]];
const CEILING_LANTERNS = [[0, 0, 4], [-4, -4, 3], [3, -5, 3], [-5, 2, 3]];

function buildLights(b, plan) {
  b.step('Laternenpfosten', 'Stell neben den Weg sieben Pfosten aus zwei Bruchtiefenschiefermauern und setz je eine Laterne obenauf.');
  for (const [x, z] of POSTS) {
    lampPost(b, { x, y: 0, z, height: 2, post: 'cobbled_deepslate_wall', style: 'top' });
  }
  b.step('Hängende Laternen', 'Im Tunnel hängen zwei Laternen direkt unter der Decke. In der Kuppel lässt du lange Ketten von der Decke '
    + 'herab – setz die Kette von oben nach unten und häng die Laterne zum Schluss an das unterste Glied.');
  // Im Tunnel hängen zwei Laternen an der Decke (Mitte, über Kopfhöhe).
  for (const z of [10, 13]) hangingLantern(b, { x: 0, y: 3, z, chain: 0 });
  // In der Kuppel: lange Ketten von der Decke.
  for (const [x, z, low] of CEILING_LANTERNS) {
    const ceil = plan.ceilingAbove(x, z);
    hangingLantern(b, { x, y: ceil - 1, z, chain: ceil - 1 - low });
  }
}

function buildLichen(b, plan) {
  for (let y = 0; y <= CAVE.ry + 2; y++) {
    for (let z = -CAVE.rz - 2; z <= MOUTH_Z; z++) {
      for (let x = -CAVE.rx - 3; x <= CAVE.rx + 3; x++) {
        if (b.get(x, y, z) !== 'air' || !plan.open(x, y, z)) continue;
        const faces = lichenFaces(b, x, y, z);
        if (!faces) continue;
        const onCeiling = faces.up;
        const patch = smooth(x, y, z, 3, 70);
        if (patch < (onCeiling ? 0.63 : 0.69) || y < 2) continue;
        b.set(x, y, z, `glow_lichen[${Object.entries(faces).map(([f, v]) => `${f}=${v}`).join(',')}]`);
      }
    }
  }
  // Auf dem Seegrund (geflutet).
  for (let z = -RANGE; z <= RANGE; z++) {
    for (let x = -RANGE; x <= RANGE; x++) {
      const depth = plan.lakeDepth(x, z);
      if (depth < 2 || smooth(x, 0, z, 2, 71) < 0.55) continue;
      const y = GROUND_Y - depth + 1;
      if (b.get(x, y, z) !== 'water[level=0]') continue;
      b.set(x, y, z, 'glow_lichen[down=true,east=false,north=false,south=false,up=false,waterlogged=true,west=false]');
    }
  }  // Moosteppiche auf einem Teil der Moosblöcke am Ufer.
  for (let z = -CAVE.rz; z <= CAVE.rz; z++) {
    for (let x = -CAVE.rx; x <= CAVE.rx; x++) {
      if (b.get(x, GROUND_Y, z) === 'moss_block' && b.get(x, 0, z) === 'air' && hash01(x, 1, z, 18) < 0.35) b.set(x, 0, z, 'moss_carpet');
    }
  }
}

const SOLID_FOR_LICHEN = /^(stone|andesite|tuff|diorite|deepslate|cobbled_deepslate|calcite|smooth_basalt|dripstone_block|cobblestone|mossy_cobblestone)$/;

function lichenFaces(b, x, y, z) {
  const faces = { down: false, east: false, north: false, south: false, up: false, west: false };
  let any = false;
  for (const [dir, dx, dy, dz] of BUD_DIRS) {
    if (dir === 'down') continue;
    if (SOLID_FOR_LICHEN.test(b.get(x + dx, y + dy, z + dz))) {
      faces[dir] = true;
      any = true;
    }
  }
  return any ? { ...faces, waterlogged: false } : null;
}

// ---------------------------------------------------------------- Außen

function buildOutside(b, plan) {
  pathAlong(b, { y: GROUND_Y, points: [[0, RANGE - 3], [1, 19], [0, MOUTH_Z + 1]], width: 3, mix: 'kies', wiggle: 1, seed: 5 });
  // Laternen an der Felswand links und rechts vom Portal.
  for (const x of [-3, 3]) wallLantern(b, { x, y: 2, z: MOUTH_Z, facing: 'south', style: 'bracket', arm: 'spruce_fence' });
  // Ranken hängen über den Eingang.
  for (let x = -4; x <= 4; x++) {
    if (hash01(x, 0, 0, 80) < 0.35) continue;
    const len = 1 + Math.floor(hash01(x, 1, 0, 81) * 3);
    for (let k = 0; k < len; k++) {
      const y = plan.top(x, MOUTH_Z) - 1 - k;
      if (y < 1 || b.get(x, y, MOUTH_Z + 1) !== 'air' || b.get(x, y, MOUTH_Z) === 'air') break;
      b.set(x, y, MOUTH_Z + 1, 'vine[north=true]');
    }
  }
  const onHill = (x, z) => plan.top(x, z) + 1;
  tree(b, { x: -9, y: onHill(-9, -8), z: -8, species: 'fichte', size: 'mittel', seed: 1 });
  tree(b, { x: 10, y: onHill(10, -6), z: -6, species: 'fichte', size: 'klein', seed: 2 });
  tree(b, { x: -12, y: onHill(-12, 9), z: 9, species: 'birke', size: 'mittel', seed: 3 });
  tree(b, { x: 14, y: onHill(14, 10), z: 10, species: 'birke', size: 'klein', seed: 4 });
  bush(b, { x: 6, y: onHill(6, 12), z: 12, size: 'klein', leaves: 'eiche', seed: 5 });
  bush(b, { x: -6, y: onHill(-6, 13), z: 13, size: 'klein', leaves: 'azalee', seed: 6 });
  bush(b, { x: 2, y: onHill(2, -2), z: -2, size: 'klein', leaves: 'fichte', seed: 7 });
  rock(b, { x: 5, y: GROUND_Y + 1, z: 19, size: 'klein', material: 'andesit', seed: 8 });
  for (const [x, z, seed] of [[-13, -3, 11], [12, 3, 12], [4, -13, 13]]) rock(b, { x, y: onHill(x, z), z, size: 'klein', material: 'andesit', seed });
  rock(b, { x: -6, y: GROUND_Y + 1, z: 20, size: 'klein', material: 'stein', seed: 9 });
  vegetation(b, { x: -RANGE, y: HILL.h + 2, z: -RANGE, width: RANGE * 2 + 1, depth: RANGE * 2 + 1, mix: 'wiese', density: 0.3, scan: 30, seed: 10 });
}
