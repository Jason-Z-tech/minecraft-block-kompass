// Himmelsinseln – fünf schwebende Inseln um einen hohen Magierturm mit Sternwarte, dazu Wasserfälle, Brücken und Ketten.
// Eigenes Design. Oberfläche der Hauptinsel y = 0, Turmmitte bei x = −3, z = −4; die Dachspitze erreicht etwa y = 81,
// die Unterseiten hängen bis etwa y = −44 hinab.

import {
  WOOD, tree, bush, rock, vegetation, pond, pathAlong, flowerBed, lampPost, hangingLantern, enchantingSetup, doorway, arch,
} from '../lib/index.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'himmelsinseln',
  title: 'Himmelsinseln mit Magierturm',
  category: 'fantasy',
  subtitle: 'Schwebende Inseln mit Sternwarten-Turm, Wasserfällen, Hängebrücke und Ketten',
  tags: [
    'Fantasy', 'Himmelsinseln', 'Schwebende Inseln', 'Insel', 'Magierturm', 'Turm', 'Sternwarte', 'Wasserfall', 'Hängebrücke',
    'Steinbrücke', 'Ketten', 'Kirschbaum', 'Amethyst', 'Zaubertisch', 'Bibliothek', 'Pavillon', 'Wolken', 'Kupferdach',
  ],
  aliases: [
    'himmelsinseln', 'himmelsinsel', 'schwebende inseln', 'fliegende inseln', 'sky islands', 'floating islands',
    'himmelsinseln mit magierturm', 'magierturm auf schwebender insel', 'sky island wizard tower', 'floating island tower',
    'zauberturm', 'sternwarte', 'himmelsinsel turm', 'himmels inseln', 'himelsinseln', 'schwebende insel mit turm',
    'insel mit wasserfall', 'wolkeninseln',
  ],
  accuracy: 'eigenes',
  description: 'Fünf Inseln schweben übereinander in der Luft, ihre zerklüfteten Unterseiten zeigen Gesteinsschichten, Erze, '
    + 'Moos, Wurzeln, Tropfstein und Amethyst-Drusen. Auf der Hauptinsel steht ein hoher, nach oben hell werdender Magierturm '
    + 'mit Quarzrippen, dunklen Gesimsen, zwei Erkertürmchen, Balkon, Galerie, Sternwarte und geschwungenem Kupferdach; innen '
    + 'führt eine Wendeltreppe durch Halle, Bibliothek, Alchemieküche, Schlafzimmer und Zauberraum. Von der Quellinsel mit '
    + 'Kirschbaum stürzt ein Wasserfall in den Teich der Hauptinsel und weiter auf die Beckeninsel; Hängebrücke, Steinbrücke '
    + 'und Ketten verbinden die Inseln.',
  sources: [],
  credits: null,
  tested: null,
};

// ---------------------------------------------------------------- Hilfen

function hash01(x, y, z, salt) {
  return (hashPosition(x, y, z, salt) % 100000) / 100000;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

// Weiches Rauschen 0 … 1 (Gitterwerte über hashPosition, dazwischen geglättet).
function vnoise(x, z, scale, salt) {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = smoothstep(fx - x0);
  const tz = smoothstep(fz - z0);
  const a = hash01(x0, 0, z0, salt);
  const b = hash01(x0 + 1, 0, z0, salt);
  const c = hash01(x0, 0, z0 + 1, salt);
  const d = hash01(x0 + 1, 0, z0 + 1, salt);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

const stairs = (id, facing, half = 'bottom') => `${id}[facing=${facing},half=${half}]`;
const slab = (id, type) => `${id}[type=${type}]`;
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const STEP = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

// Himmelsrichtung von (x, z) zur Mitte (cx, cz), nach der stärkeren Achse.
function towardCenter(x, z, cx = 0, cz = 0) {
  const dx = cx - x;
  const dz = cz - z;
  if (Math.abs(dx) > Math.abs(dz) || (Math.abs(dx) === Math.abs(dz) && (x + z) % 2 === 0)) return dx > 0 ? 'east' : 'west';
  return dz > 0 ? 'south' : 'north';
}

function dirOf(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
  return dz >= 0 ? 'south' : 'north';
}

// Winkel um die Mitte: 0° = Osten, 90° = Süden, 180° = Westen, 270° = Norden.
function angleOf(x, z) {
  const a = (Math.atan2(z, x) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
}

function angleIn(a, from, to) {
  const span = (((to - from) % 360) + 360) % 360;
  const rel = (((a - from) % 360) + 360) % 360;
  return rel <= span;
}

function put(b, x, y, z, state) {
  if (b.get(x, y, z) === 'air') b.set(x, y, z, state);
}

// ---------------------------------------------------------------- Inseln

// Turmmitte und Lage der Wasserfälle (Welt-Koordinaten).
const T = { x: -3, z: -4 };
const FALL_B = { x: 21, zs: [1, 2, 3], top: 17 };          // Quellinsel → Teich der Hauptinsel
const FALL_A = { z: 15, xs: [17, 18, 19], top: 0 };         // Hauptinsel → Beckeninsel
const POND_A = { x: 14, z: -3, width: 9, depth: 9 };        // Teich der Hauptinsel (Wasserspiegel y = 0)
const POND_B = { x: 24, z: -1, width: 7, depth: 7 };        // Quellteich (y = 17)
const POND_C = { x: 14, z: 12, width: 7, depth: 7 };        // Becken (y = −22)
const BRIDGE_B = { z: -4, y: 18 };                          // Hängebrücke: Mitte und Lauffläche
const BRIDGE_D = { z: 4 };                                  // Steinbrücke: Mitte
const PAVILION = { x: -53, z: 1, size: 7, y: -5 };          // Pavillon der Waldinsel (Boden)

function inBox(x, z, x1, z1, x2, z2) {
  return x >= x1 && x <= x2 && z >= z1 && z <= z2;
}

function towerDist(x, z) {
  return Math.hypot(x - T.x, z - T.z);
}

const ISLANDS = [
  {
    key: 'haupt', name: 'Hauptinsel', cx: 0, cz: 0, rx: 25, rz: 21, top: 0, depth: 26, salt: 11, wob: [0.06, 0.4, 0.05, 2.1],
    spikes: [[-3, -4, 12, 16], [9, 5, 7, 11], [-13, 5, 6, 9], [6, -11, 5, 8], [-15, -9, 5, 7], [15, -5, 4, 7], [-6, 13, 4, 6], [0, 4, 5, 7], [12, 12, 3, 5], [-19, 0, 3, 5]],
    force: (x, z) => inBox(x, z, 16, 5, 20, 14) || inBox(x, z, POND_A.x - 1, POND_A.z - 1, POND_A.x + POND_A.width, POND_A.z + POND_A.depth),
    cut: (x, z) => x >= 16 && x <= 20 && z >= FALL_A.z,
    flat: (x, z) => inBox(x, z, 15, 5, 21, 14) || inBox(x, z, -30, 1, -14, 7),
    topAt: topHaupt,
  },
  {
    key: 'quelle', name: 'Quellinsel', cx: 34, cz: -2, rx: 12, rz: 10, top: 17, depth: 12, salt: 23, wob: [0.07, 1.3, 0.04, 0.2],
    spikes: [[35, -2, 6, 8], [29, 4, 3, 4], [40, -7, 3, 5]],
    force: (x, z) => inBox(x, z, 22, 0, 26, 4),
    cut: (x, z) => x <= FALL_B.x && z >= 0 && z <= 4,
    flat: (x, z) => inBox(x, z, 21, -7, 31, 6),
    topAt: (x, z) => {
      if (inBox(x, z, 21, -7, 31, 6)) return 17;
      const m = Math.hypot((x - 38) / 5, (z + 6) / 4);
      return 17 + (m < 1 ? Math.round(2 * (1 - m * m)) : 0);
    },
  },
  {
    key: 'becken', name: 'Beckeninsel', cx: 17, cz: 16, rx: 8, rz: 7, top: -22, depth: 9, salt: 37, wob: [0.08, 0.9, 0.05, 1.7],
    spikes: [[17, 16, 4, 6], [12, 19, 2, 3], [21, 13, 2, 3]],
    force: (x, z) => inBox(x, z, POND_C.x - 1, POND_C.z - 1, POND_C.x + POND_C.width, POND_C.z + POND_C.depth),
    cut: () => false,
    flat: (x, z) => inBox(x, z, POND_C.x - 1, POND_C.z - 1, POND_C.x + POND_C.width, POND_C.z + POND_C.depth),
    topAt: () => -22,
  },
  {
    key: 'wald', name: 'Waldinsel', cx: -47, cz: 5, rx: 12, rz: 10, top: -6, depth: 15, salt: 41, wob: [0.07, 2.4, 0.05, 0.9],
    spikes: [[-47, 4, 6, 9], [-53, 9, 3, 5], [-42, 0, 3, 4], [-45, 11, 2, 3]],
    force: () => false,
    cut: () => false,
    flat: (x, z) => inBox(x, z, -46, 1, -30, 7),
    topAt: (x, z) => {
      if (inBox(x, z, PAVILION.x - 1, PAVILION.z - 1, PAVILION.x + PAVILION.size, PAVILION.z + PAVILION.size) || inBox(x, z, -46, 1, -30, 7)) return -6;
      const h = Math.round((vnoise(x, z, 5, 77) - 0.4) * 2.4);
      return -6 + Math.max(0, h);
    },
  },
  {
    key: 'kristall', name: 'Kristallinsel', cx: -2, cz: -39, rx: 8, rz: 6.5, top: 36, depth: 11, salt: 53, wob: [0.08, 0.5, 0.05, 2.6],
    spikes: [[-2, -39, 4, 7], [-5, -37, 2, 3], [1, -41, 2, 4]],
    force: () => false,
    cut: () => false,
    flat: () => false,
    topAt: () => 36,
  },
];

const ROCKS = [
  { x: -28, y: 10, z: 23, r: 4, deco: 'busch' },
  { x: 38, y: 5, z: 20, r: 3, deco: 'moos' },
  { x: -32, y: 22, z: -25, r: 4.5, deco: 'birke' },
  { x: 26, y: 34, z: -25, r: 3, deco: 'kristall' },
  { x: -16, y: 28, z: 28, r: 2.5, deco: 'moos' },
  { x: 48, y: 25, z: -15, r: 3.5, deco: 'busch' },
  { x: -62, y: -1, z: -11, r: 3, deco: 'moos' },
  { x: -22, y: -15, z: -27, r: 3, deco: 'kristall' },
];

function topHaupt(x, z) {
  const flat = towerDist(x, z) <= 11.5
    || inBox(x, z, POND_A.x - 2, POND_A.z - 2, POND_A.x + POND_A.width + 1, POND_A.z + POND_A.depth + 1)
    || inBox(x, z, 15, 5, 21, 14)
    || inBox(x, z, -27, 1, -14, 7);
  if (flat) return 0;
  let h = 0;
  const hill = Math.hypot((x + 16) / 9, (z + 11) / 7);
  if (hill < 1) h += 6.5 * (1 - hill * hill) * (0.75 + 0.5 * vnoise(x, z, 3, 7));
  h += (vnoise(x, z, 6, 8) - 0.5) * 1.8;
  return Math.max(0, Math.round(h));
}

function makeColumns(spec) {
  const cols = [];
  const map = new Map();
  const [a1, p1, a2, p2] = spec.wob;
  for (let z = Math.floor(spec.cz - spec.rz - 3); z <= spec.cz + spec.rz + 3; z++) {
    for (let x = Math.floor(spec.cx - spec.rx - 3); x <= spec.cx + spec.rx + 3; x++) {
      const dx = (x - spec.cx) / spec.rx;
      const dz = (z - spec.cz) / spec.rz;
      const theta = Math.atan2(dz, dx);
      const wobble = 1 + a1 * Math.sin(3 * theta + p1) + a2 * Math.sin(5 * theta + p2) + 0.08 * (vnoise(x, z, 3, spec.salt) - 0.5);
      let rho = Math.hypot(dx, dz) / wobble;
      if (spec.cut(x, z)) continue;
      const forced = spec.force(x, z);
      if (forced) rho = Math.min(rho, 0.99);
      if (rho > (spec.lip ?? LIP)) continue;
      const flat = forced || spec.flat(x, z);
      // Rand abrunden: außen ein bis zwei Ebenen tiefer (Lippe), damit die Insel nicht wie eine Torte aussieht.
      const drop = flat ? 0 : rho > 0.88 ? Math.min(2, Math.round((rho - 0.88) * 11 + 0.2 * hash01(x, 5, z, spec.salt))) : 0;
      const top = spec.topAt(x, z, rho) - drop;
      let depth = (rho > 1 ? 2 : spec.rim ?? 3) + spec.depth * Math.max(0, 1 - rho) ** 1.4 * (0.75 + 0.5 * vnoise(x, z, 5, spec.salt + 1));
      for (const [sx, sz, r, len] of spec.spikes) {
        const d = Math.hypot(x - sx, z - sz) / r;
        if (d < 1) depth += len * (1 - d) ** 1.7;
      }
      depth += hash01(x, 0, z, spec.salt + 2) * (spec.jag ?? 2) * Math.min(1, rho * 2);
      const col = { x, z, rho, top, bottom: top - Math.round(depth) + (rho > 1 ? 1 : 0) };
      cols.push(col);
      map.set(`${x},${z}`, col);
    }
  }
  return { spec, cols, map, minBottom: Math.min(...cols.map((c) => c.bottom)) };
}

const LIP = 1.07;
const BANDS = ['stone', 'stone', 'andesite', 'stone', 'tuff', 'stone', 'stone', 'calcite', 'andesite', 'stone', 'tuff', 'stone'];

function underBlock(x, y, z, depthBelowTop, col, island) {
  const spec = island.spec;
  const dirt = spec.dirt ?? (col.rho > 0.9 ? 1 : col.rho > 0.75 ? 2 : 3);
  if (depthBelowTop <= dirt) {
    const n = hash01(x, y, z, spec.salt + 3);
    return n < 0.1 ? 'coarse_dirt' : n < 0.16 ? 'rooted_dirt' : 'dirt';
  }
  const n = hash01(x, y, z, spec.salt + 4);
  if (y - island.minBottom <= (spec.deep ?? 4 + Math.round(vnoise(x, z, 3, spec.salt + 5) * 3))) {
    if (n < 0.03) return 'deepslate_iron_ore';
    if (n < 0.05) return 'deepslate_lapis_ore';
    if (n < 0.06) return 'deepslate_diamond_ore';
    return n < 0.55 ? 'deepslate' : n < 0.85 ? 'cobbled_deepslate' : 'tuff';
  }
  const warp = (vnoise(x, z, 7, spec.salt + 6) - 0.5) * 5;
  const band = BANDS[(((Math.floor((y + warp + spec.salt) / 2.5)) % BANDS.length) + BANDS.length) % BANDS.length];
  if (n < 0.025) return 'coal_ore';
  if (n < 0.04) return 'iron_ore';
  if (n < 0.052) return 'copper_ore';
  if (n < 0.057) return 'gold_ore';
  if (n < 0.15) return band === 'stone' ? 'andesite' : 'stone';
  if (n < 0.2) return 'cobblestone';
  return band;
}

function buildIslandTop(b, island) {
  for (const c of island.cols) {
    const n = hash01(c.x, c.top, c.z, island.spec.salt + 9);
    b.set(c.x, c.top, c.z, n < 0.04 ? 'coarse_dirt' : n < 0.07 ? 'moss_block' : 'grass_block');
  }
}

function buildIslandUnder(b, island, layersPerStep = 2) {
  const maxTop = Math.max(...island.cols.map((c) => c.top));
  let inStep = 0;
  for (let y = maxTop - 1; y >= island.minBottom; y--) {
    const layer = island.cols.filter((c) => c.bottom <= y && c.top > y);
    if (layer.length === 0) continue;
    if (inStep % layersPerStep === 0) b.step();
    inStep++;
    for (const c of layer) {
      const exposedBelow = y === c.bottom;
      let id = underBlock(c.x, y, c.z, c.top - y, c, island);
      if (exposedBelow && c.top - y > 3 && hash01(c.x, y, c.z, island.spec.salt + 7) < 0.22) id = 'moss_block';
      id = geodeBlock(island, c, y) ?? id;
      b.set(c.x, y, c.z, id);
    }
  }
}

function buildIsland(b, island) {
  b.phase(`${island.spec.name}: Oberfläche`);
  buildIslandTop(b, island);
  b.phase(`${island.spec.name}: Unterseite`);
  buildIslandUnder(b, island, island.cols.length > 800 ? 2 : 1);
}

// ---------------------------------------------------------------- Hängendes unter und an den Inseln

const SIDES = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];

function dripstone(b, x, y, z, length) {
  const shape = length === 1 ? ['tip'] : length === 2 ? ['frustum', 'tip'] : ['base', ...Array(length - 3).fill('middle'), 'frustum', 'tip'];
  shape.forEach((thickness, k) => put(b, x, y - k, z, `pointed_dripstone[thickness=${thickness},vertical_direction=down]`));
}

function caveVines(b, x, y, z, length) {
  for (let k = 0; k < length; k++) {
    if (b.get(x, y - k, z) !== 'air') return;
    const berries = hashPosition(x, y - k, z, 36) % 3 === 0;
    b.set(x, y - k, z, k === length - 1 ? `cave_vines[age=25,berries=${berries}]` : `cave_vines_plant[berries=${berries}]`);
  }
}

function buildHanging(b, island) {
  const { spec, cols, map } = island;
  b.step();
  // Ranken an den Rändern.
  for (const c of cols) {
    if (c.rho < 0.8) continue;
    for (const [face, dx, dz] of SIDES) {
      const ax = c.x + dx;
      const az = c.z + dz;
      if (map.has(`${ax},${az}`) || hash01(ax, 0, az, spec.salt + 31) > 0.3) continue;
      const attach = OPPOSITE[face];
      const length = 2 + (hashPosition(ax, 1, az, spec.salt + 32) % 6);
      for (let k = 0; k < length; k++) {
        const y = c.top - 1 - k;
        if (y < c.bottom || b.get(ax, y, az) !== 'air') break;
        b.set(ax, y, az, `vine[${attach}=true]`);
      }
    }
  }
  b.step();
  // Unterseite: Tropfstein an den Spitzen, Leuchtbeeren, Wurzeln, Sporenblüten, Leuchtflechte.
  for (const c of cols) {
    const below = c.bottom - 1;
    if (b.get(c.x, below, c.z) !== 'air' || b.get(c.x, c.bottom, c.z) === 'air') continue;
    const lowest = SIDES.every(([, dx, dz]) => {
      const n = map.get(`${c.x + dx},${c.z + dz}`);
      return !n || n.bottom > c.bottom;
    });
    const n = hash01(c.x, 2, c.z, spec.salt + 33);
    const thick = c.top - c.bottom;
    const crystal = geodeCrystal(island, c);
    if (crystal) b.set(c.x, below, c.z, crystal);
    else if (lowest && thick >= 10) dripstone(b, c.x, below, c.z, 2 + (hashPosition(c.x, 3, c.z, spec.salt + 34) % 3));
    else if (n < 0.06 && c.rho < 0.75) caveVines(b, c.x, below, c.z, 2 + (hashPosition(c.x, 4, c.z, spec.salt + 35) % 5));
    else if (n < 0.15) b.set(c.x, below, c.z, 'hanging_roots');
    else if (n < 0.18 && c.rho < 0.6) b.set(c.x, below, c.z, 'spore_blossom');
    else if (n < 0.3) b.set(c.x, below, c.z, 'glow_lichen[up=true]');
  }
}

// ---------------------------------------------------------------- Turm (lokal: Mitte 0, 0)

const FLOORS = [1, 9, 17, 25, 33];   // Böden der fünf Geschosse
const GALLERY = 41;                   // Galerie und Boden der Sternwarte
const OBS_TOP = 50;                   // letzte Mauerebene der Sternwarte
const ROOF_BASE = 52;
const ROOF_H = 27;
const ROOF_R = 7;
const DS = {
  block: 'polished_deepslate', stairs: 'polished_deepslate_stairs', slab: 'polished_deepslate_slab', wall: 'polished_deepslate_wall',
  tiles: 'deepslate_tiles', bricks: 'deepslate_bricks', chiseled: 'chiseled_deepslate',
};
const ROOF = { block: 'waxed_oxidized_cut_copper', stairs: 'waxed_oxidized_cut_copper_stairs', slab: 'waxed_oxidized_cut_copper_slab' };
const RIB = { shaft: 'quartz_pillar[axis=y]', capital: 'chiseled_quartz_block', base: 'smooth_quartz' };
const DARK = WOOD.schwarzeiche;
const SPRUCE = WOOD.fichte;
const GLASS = 'light_blue_stained_glass_pane';
const MAGIC_GLASS = 'purple_stained_glass_pane';
const RIB_ANGLES = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
const TURRET_SE = { x: 5, z: 5, floor: 17, wallTop: 27, roofBase: 28, roofH: 9, corbel: 5 };
const TURRET_SW = { x: -5, z: 5, floor: 1, wallTop: 14, roofBase: 15, roofH: 10, corbel: 0 };
const LADDER = { x: 4, z: 0 };
const BALCONY = { from: 258, to: 22, y: 17 };

const dist = (x, z) => Math.hypot(x, z);
const isShaftWall = (x, z) => dist(x, z) > 5.5 && dist(x, z) <= 6.5;
const isInterior = (x, z) => dist(x, z) <= 5.5;

// Gestein der Turmmauer: unten graue, bemooste Steinziegel, nach oben immer mehr Calcit, Diorit und Quarz.
function towerStone(x, y, z) {
  const t = Math.min(1, Math.max(0, (y - 4) / 12));
  const white = hash01(x, y, z, 21) < t * 1.05;
  const n = hash01(x, y, z, 22);
  if (!white) {
    if (n < 0.3 - t * 0.2) return 'mossy_stone_bricks';
    if (n < 0.42) return 'cracked_stone_bricks';
    if (n < 0.52) return 'polished_andesite';
    return 'stone_bricks';
  }
  if (n < 0.4) return 'calcite';
  if (n < 0.7) return 'polished_diorite';
  if (n < 0.78) return 'diorite';
  return 'quartz_bricks';
}

function ribCells() {
  return RIB_ANGLES.map((a) => {
    const r = (a * Math.PI) / 180;
    return [Math.round(7 * Math.cos(r)), Math.round(7 * Math.sin(r))];
  });
}

// Wendeltreppe an der Innenwand: geschlossener Ring aus Feldern, die sich mit einer Fläche berühren.
function stairLoop() {
  const loop = [];
  const push = (c) => {
    const last = loop[loop.length - 1];
    if (last && last[0] === c[0] && last[1] === c[1]) return;
    if (last && last[0] !== c[0] && last[1] !== c[1]) {
      const c1 = [c[0], last[1]];
      const c2 = [last[0], c[1]];
      const ok1 = dist(...c1) <= 5.5;
      const ok2 = dist(...c2) <= 5.5;
      const pick = ok1 && ok2 ? (dist(...c1) >= dist(...c2) ? c1 : c2) : ok1 ? c1 : c2;
      loop.push(pick);
    }
    loop.push(c);
  };
  for (let i = 0; i < 1440; i++) {
    const a = (i / 1440) * 2 * Math.PI;
    push([Math.round(4.7 * Math.cos(a)), Math.round(4.7 * Math.sin(a))]);
  }
  push(loop[0]);
  loop.pop();
  if (loop.some(([x, z]) => dist(x, z) > 5.5)) throw new Error('Treppenring liegt in der Mauer.');
  return loop;
}

const LOOP = stairLoop();
const FLIGHT_START = (() => {
  let best = 0;
  let bestDiff = Infinity;
  LOOP.forEach(([x, z], i) => {
    const diff = Math.abs(((angleOf(x, z) - 324 + 540) % 360) - 180);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
})();

// Treppenläufe: Lauf i führt von FLOORS[i] zu FLOORS[i + 1], 8 Stufen.
function flights() {
  const out = [];
  for (let i = 0; i < FLOORS.length - 1; i++) {
    const steps = [];
    for (let k = 1; k <= 8; k++) {
      const idx = (FLIGHT_START + i * 8 + k - 1) % LOOP.length;
      const next = LOOP[(idx + 1) % LOOP.length];
      const [x, z] = LOOP[idx];
      steps.push({ x, z, y: FLOORS[i] + k, k, facing: dirOf(next[0] - x, next[1] - z) });
    }
    out.push(steps);
  }
  return out;
}

const FLIGHTS = flights();

// Felder, die frei bleiben müssen (Laufweg über den Stufen), als "x,y,z".
function reservedCells() {
  const set = new Set();
  for (const flight of FLIGHTS) {
    for (const s of flight) for (let dy = 0; dy <= 3; dy++) set.add(`${s.x},${s.y + dy},${s.z}`);
  }
  for (let y = FLOORS[4] + 1; y <= GALLERY + 1; y++) set.add(`${LADDER.x},${y},${LADDER.z}`);
  return set;
}

const RESERVED = reservedCells();

function furnish(b, x, y, z, state) {
  if (RESERVED.has(`${x},${y},${z}`)) return false;
  if (b.get(x, y, z) !== 'air') return false;
  b.set(x, y, z, state);
  return true;
}

function buildTower(b) {
  b.transform({ offset: [T.x, 0, T.z] }, () => {
    b.phase('Turm: Terrasse und Sockel');
    buildTerrace(b);
    buildPlinth(b);
    buildButtresses(b);
    buildPlanters(b);

    const names = ['Turm: Halle', 'Turm: Bibliothek', 'Turm: Alchemieküche', 'Turm: Schlafzimmer', 'Turm: Zauberraum'];
    for (let i = 0; i < FLOORS.length; i++) {
      b.phase(names[i]);
      const y1 = FLOORS[i];
      const y2 = i + 1 < FLOORS.length ? FLOORS[i + 1] - 1 : GALLERY - 1;
      buildShaft(b, y1, y2);
      buildFloor(b, i);
      // Oberste Stufe des Laufs darunter liegt in dieser Bodenebene.
      if (i > 0) {
        const last = FLIGHTS[i - 1][7];
        b.set(last.x, last.y, last.z, stairs(DARK.stairs, last.facing));
      }
      buildWindows(b, i);
      if (i < FLIGHTS.length) buildFlight(b, FLIGHTS[i]);
    }

    b.phase('Turm: Balkon');
    buildBalcony(b);

    b.phase('Turm: Erkertürmchen');
    buildTurret(b, TURRET_SW);
    buildTurret(b, TURRET_SE);

    b.phase('Turm: Galerie');
    buildGallery(b);

    b.phase('Turm: Sternwarte');
    buildObservatory(b);

    b.phase('Turm: Dach');
    buildRoof(b);

    b.phase('Turm: Türen');
    buildDoors(b);

    b.phase('Einrichtung: Halle');
    b.step();
    furnishHall(b);
    b.phase('Einrichtung: Bibliothek');
    b.step();
    furnishLibrary(b);
    b.phase('Einrichtung: Alchemieküche');
    b.step();
    furnishAlchemy(b);
    b.phase('Einrichtung: Schlafzimmer');
    b.step();
    furnishBedroom(b);
    b.phase('Einrichtung: Zauberraum und Sternwarte');
    b.step();
    furnishMagic(b);
    furnishObservatory(b);
  });
}

function buildTerrace(b) {
  for (let z = -11; z <= 11; z++) {
    for (let x = -11; x <= 11; x++) {
      const d = dist(x, z);
      if (d > 10.5 || d <= 5.5) continue;
      b.set(x, 0, z, 'dirt');
      if (d > 9.5) {
        b.set(x, 1, z, stairs('stone_brick_stairs', towardCenter(x, z)));
        continue;
      }
      const a = angleOf(x, z);
      const spoke = RIB_ANGLES.some((r) => Math.abs(((a - r + 540) % 360) - 180) < 4.5);
      const n = hash01(x, 1, z, 61);
      let id = d > 8.5 ? 'stone_bricks' : spoke ? 'polished_andesite' : n < 0.2 ? 'mossy_stone_bricks' : n < 0.3 ? 'cracked_stone_bricks' : 'stone_bricks';
      if (d > 8.5 && n < 0.25) id = 'mossy_stone_bricks';
      if (d > 7.5 && d <= 8.5) id = 'polished_andesite';
      b.set(x, 1, z, id);
    }
  }
}

function buildPlanters(b) {
  for (const a of [45, 135, 225, 315]) {
    const r = (a * Math.PI) / 180;
    const x = Math.round(9 * Math.cos(r));
    const z = Math.round(9 * Math.sin(r));
    if (b.get(x, 2, z) !== 'air') continue;
    b.set(x, 2, z, 'potted_flowering_azalea_bush');
  }
}

function buildPlinth(b) {
  for (let z = -8; z <= 8; z++) {
    for (let x = -8; x <= 8; x++) {
      const d = dist(x, z);
      if (d <= 6.5 || d > 7.5) continue;
      for (let y = 2; y <= 3; y++) b.set(x, y, z, hash01(x, y, z, 62) < 0.3 ? 'mossy_stone_bricks' : 'stone_bricks');
      b.set(x, 4, z, stairs('stone_brick_stairs', towardCenter(x, z)));
    }
  }
}

// Strebepfeiler am Turmfuß (nicht auf der Portal- und Erkerseite im Süden).
const BUTTRESS_ANGLES = [22.5, 202.5, 247.5, 292.5, 337.5];

function buildButtresses(b) {
  for (const a of BUTTRESS_ANGLES) {
    const r = (a * Math.PI) / 180;
    const inner = [Math.round(7.5 * Math.cos(r)), Math.round(7.5 * Math.sin(r))];
    const outer = [Math.round(8.5 * Math.cos(r)), Math.round(8.5 * Math.sin(r))];
    for (const [[x, z], top] of [[inner, 9], [outer, 5]]) {
      for (let y = 2; y <= top; y++) b.set(x, y, z, hash01(x, y, z, 65) < 0.3 ? 'mossy_stone_bricks' : y === top ? 'chiseled_stone_bricks' : 'stone_bricks');
      b.set(x, top + 1, z, stairs('stone_brick_stairs', towardCenter(x, z)));
    }
  }
}

function buildShaft(b, y1, y2) {
  const ribs = ribCells();
  for (let y = y1; y <= y2; y++) {
    for (let z = -7; z <= 7; z++) for (let x = -7; x <= 7; x++) if (isShaftWall(x, z)) b.set(x, y, z, towerStone(x, y, z));
    // Gesims außen auf Höhe der Böden.
    if (FLOORS.includes(y) && y > 1) {
      for (let z = -8; z <= 8; z++) {
        for (let x = -8; x <= 8; x++) {
          const d = dist(x, z);
          if (d > 6.5 && d <= 7.5) b.set(x, y, z, stairs(DS.stairs, towardCenter(x, z), 'top'));
        }
      }
    }
    // Rippen ab dem Sockel: weiße Quarzsäulen mit Kapitellen unter jedem Gesims.
    if (y >= 5) {
      for (const [x, z] of ribs) {
        const capital = FLOORS.includes(y + 1) || y === GALLERY - 4;
        b.set(x, y, z, capital ? RIB.capital : y === 5 ? RIB.base : RIB.shaft);
      }
    }
  }
}

function buildFloor(b, i) {
  const y = FLOORS[i];
  for (let z = -5; z <= 5; z++) {
    for (let x = -5; x <= 5; x++) {
      if (!isInterior(x, z)) continue;
      b.set(x, y, z, floorBlock(i, x, z));
    }
  }
  // Öffnungen über den Stufen des Laufs darunter.
  if (i > 0) {
    for (const s of FLIGHTS[i - 1]) if (s.k >= 5 && s.k <= 7) b.remove(s.x, y, s.z);
  }
}

function floorBlock(i, x, z) {
  const d = dist(x, z);
  const n = hash01(x, FLOORS[i], z, 63 + i);
  if (i === 0) {
    // Kompassrose aus Quarz und Calcit auf dunklem Grund.
    if (d <= 0.5) return 'chiseled_quartz_block';
    if ((x === 0 || z === 0) && d <= 4.5) return 'quartz_bricks';
    if (Math.abs(x) === Math.abs(z) && d <= 3) return 'calcite';
    if (d > 4.5) return DS.block;
    return (x + z) % 2 === 0 ? DS.tiles : DS.block;
  }
  if (i === 4) {
    if (d > 4.5) return DS.block;
    if (d > 3.5) return 'amethyst_block';
    return (x + z) % 2 === 0 ? 'polished_blackstone' : DS.tiles;
  }
  const wood = i === 2 ? SPRUCE : DARK;
  if (d > 4.5) return wood.strippedWood ?? wood.planks;
  return n < 0.15 ? `${wood.log}[axis=${(x + z) % 2 === 0 ? 'x' : 'z'}]` : wood.planks;
}

// Fenster: vier Seiten, auf jedem Geschoss mit Bogen, Sims und Schlussstein.
function buildWindows(b, i) {
  const F = FLOORS[i];
  const glass = i === 4 ? MAGIC_GLASS : GLASS;
  for (const rotate of [0, 90, 180, 270]) {
    const side = { 0: 'south', 90: 'west', 180: 'north', 270: 'east' }[rotate];
    if (i === 0 && side === 'south') continue;
    if (i === 2 && side === 'east') continue;
    if (i === 4 && side === 'east') continue;
    b.transform({ rotate }, () => archWindow(b, F, glass, i === 1 ? 5 : 4));
  }
}

// Fenster in der Südseite (lokal): Öffnung x −1 … 1, Glas ab F + 2, Bogen oben.
function archWindow(b, F, glass, height) {
  const top = F + 1 + height;
  for (let y = F + 2; y <= top; y++) {
    for (let x = -1; x <= 1; x++) {
      if (y === top && x !== 0) b.set(x, y, 6, stairs(DS.stairs, x < 0 ? 'west' : 'east', 'top'));
      else b.set(x, y, 6, glass);
    }
  }
  b.set(0, top + 1, 6, RIB.capital);
  for (let x = -1; x <= 1; x++) b.set(x, F + 1, 7, stairs(DS.stairs, 'north', 'top'));
}

function buildFlight(b, flight) {
  for (const s of flight) {
    b.set(s.x, s.y, s.z, stairs(DARK.stairs, s.facing));
    if (s.k >= 2) b.set(s.x, s.y - 1, s.z, stairs(DARK.stairs, s.facing, 'top'));
  }
}

function buildBalcony(b) {
  const y = BALCONY.y;
  for (let z = -10; z <= 10; z++) {
    for (let x = -10; x <= 10; x++) {
      const d = dist(x, z);
      if (d <= 6.5 || d > 9.5 || !angleIn(angleOf(x, z), BALCONY.from, BALCONY.to)) continue;
      b.set(x, y, z, d > 8.5 ? DS.block : hash01(x, y, z, 64) < 0.5 ? DS.tiles : 'polished_deepslate');
      if (d <= 8.5) b.set(x, y - 1, z, d > 7.5 ? stairs(DS.stairs, towardCenter(x, z), 'top') : DS.block);
      if (d <= 7.5) b.set(x, y - 2, z, stairs(DS.stairs, towardCenter(x, z), 'top'));
      const bridge = x >= 8 && Math.abs(z) <= 1;
      if (d > 8.5 && !bridge) b.set(x, y + 1, z, DS.wall);
    }
  }
  // Abschluss an den Enden des Balkons.
  for (const a of [BALCONY.from, BALCONY.to]) {
    const r = (a * Math.PI) / 180;
    for (let d = 7; d <= 9; d++) {
      const x = Math.round(d * Math.cos(r));
      const z = Math.round(d * Math.sin(r));
      if (b.get(x, y, z) !== 'air') b.set(x, y + 1, z, DS.wall);
    }
  }
  for (const [x, z] of [[9, -2], [9, 2]]) {
    b.set(x, y + 1, z, DS.block);
    b.set(x, y + 2, z, 'lantern');
  }
}

function buildTurret(b, t) {
  const { x: cx, z: cz, floor, wallTop, roofBase, roofH, corbel } = t;
  const outside = (x, z) => dist(x, z) > 6.5;
  // Kragstein-Kegel unter dem Türmchen.
  for (let k = 1; k <= corbel; k++) {
    const r = 2.5 - 0.5 * k;
    for (let z = cz - 3; z <= cz + 3; z++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > r + 0.01 || !outside(x, z)) continue;
        const edge = d > r - 1;
        b.set(x, floor - k, z, edge ? stairs(DS.stairs, towardCenter(x, z, cx, cz), 'top') : DS.block);
      }
    }
  }
  for (let y = floor; y <= wallTop; y++) {
    for (let z = cz - 3; z <= cz + 3; z++) {
      for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > 2.5) continue;
        const wall = d > 1.5;
        if (y === floor) {
          if (outside(x, z) || isShaftWall(x, z)) b.set(x, y, z, wall ? DS.block : floor === 1 ? DS.tiles : DARK.planks);
          continue;
        }
        if (wall) {
          if (!outside(x, z)) continue;
          const band = y === wallTop || (y - floor) % 8 === 0;
          b.set(x, y, z, band ? DS.block : towerStone(x, y, z));
        } else {
          // Inneres frei (auch die Turmmauer dort → Erker als Nische des Raums), außer auf Bodenebenen des Turms.
          if (FLOORS.includes(y)) b.set(x, y, z, isInterior(x, z) ? b.get(x, y, z) : DARK.planks);
          else b.set(x, y, z, 'air');
        }
      }
    }
  }
  // Kleine Fenster nach außen.
  const ax = Math.sign(cx);
  const az = Math.sign(cz);
  for (const [wx, wz] of [[cx + 2 * ax, cz], [cx, cz + 2 * az]]) {
    for (let y = floor + 2; y < wallTop - 1; y += 4) {
      b.set(wx, y, wz, GLASS);
      b.set(wx, y + 1, wz, GLASS);
    }
  }
  // Kegeldach.
  coneRoof(b, cx, cz, roofBase, 3.2, roofH, 1.1);
  b.set(cx, roofBase + roofH, cz, 'end_rod');
}

// Geschwungenes Kegeldach (Radius r(k) = R · (1 − k/H)^p), Hülle zwei Blöcke dick; außen in halben Schritten:
// Block (von der nächsten Ebene bedeckt), Treppe, untere Stufe.
function coneRoof(b, cx, cz, y0, R, H, p) {
  const radiusAt = (k) => R * Math.max(0, 1 - k / H) ** p;
  const main = cx === 0 && cz === 0;
  for (let k = 0; k < H; k++) {
    const r = radiusAt(k);
    const mid = radiusAt(k + 0.5);
    const next = radiusAt(k + 1);
    const span = Math.ceil(r + 1);
    for (let z = cz - span; z <= cz + span; z++) {
      for (let x = cx - span; x <= cx + span; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > r + 0.5) continue;
        if (next >= 2 && d <= next - 1.5) continue;
        if (!main && dist(x, z) <= 6.5) continue;
        let state = ROOF.block;
        if (!(d <= next + 0.5 || (x === cx && z === cz))) state = d <= mid + 0.5 ? stairs(ROOF.stairs, towardCenter(x, z, cx, cz)) : slab(ROOF.slab, 'bottom');
        b.set(x, y0 + k, z, state);
      }
    }
  }
  // Untersicht: umgedrehte Treppen unter dem Überstand.
  for (let z = Math.floor(cz - R - 1); z <= cz + R + 1; z++) {
    for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > R + 0.5 || d <= R - 0.5) continue;
      if (!main && dist(x, z) <= 6.5) continue;
      put(b, x, y0 - 1, z, stairs(ROOF.stairs, towardCenter(x, z, cx, cz), 'top'));
    }
  }
}

function buildGallery(b) {
  const ribs = ribCells();
  // Banner an den Kapitellen unter der Galerie, abwechselnd blau und lila.
  ribs.forEach(([x, z], i) => {
    const facing = dirOf(x, z);
    const [dx, dz] = STEP[facing];
    b.set(x + dx, GALLERY - 4, z + dz, `${i % 2 === 0 ? 'blue' : 'purple'}_wall_banner[facing=${facing}]`);
  });
  for (let z = -10; z <= 10; z++) {
    for (let x = -10; x <= 10; x++) {
      const d = dist(x, z);
      if (d > 9.5 || d <= 5.5) continue;
      const to = towardCenter(x, z);
      if (d > 6.5 && d <= 7.5) b.set(x, GALLERY - 3, z, stairs(DS.stairs, to, 'top'));
      if (d > 6.5 && d <= 8.5) b.set(x, GALLERY - 2, z, d > 7.5 ? stairs(DS.stairs, to, 'top') : DS.block);
      if (d > 6.5) b.set(x, GALLERY - 1, z, d > 8.5 ? stairs(DS.stairs, to, 'top') : DS.block);
      b.set(x, GALLERY, z, d > 8.5 ? DS.block : d > 6.5 ? DS.tiles : DS.block);
      if (d > 8.5) b.set(x, GALLERY + 1, z, DS.wall);
    }
  }
  // Pfosten mit Laternen über den Rippen.
  for (const [rx, rz] of ribs) {
    const x = Math.round((rx * 9) / 7);
    const z = Math.round((rz * 9) / 7);
    if (dist(x, z) > 9.5 || dist(x, z) <= 8.5) continue;
    b.set(x, GALLERY + 1, z, DS.chiseled);
    b.set(x, GALLERY + 2, z, 'soul_lantern');
  }
}

function buildObservatory(b) {
  const ribs = RIB_ANGLES.map((a) => {
    const r = (a * Math.PI) / 180;
    return [Math.round(6 * Math.cos(r)), Math.round(6 * Math.sin(r))];
  });
  for (let y = GALLERY + 1; y <= OBS_TOP; y++) {
    for (let z = -6; z <= 6; z++) {
      for (let x = -6; x <= 6; x++) {
        const d = dist(x, z);
        if (d > 4.5 && d <= 5.5) b.set(x, y, z, y === OBS_TOP ? DS.block : towerStone(x, y + 10, z));
      }
    }
    for (const [x, z] of ribs) b.set(x, y, z, y === OBS_TOP ? DS.chiseled : DS.block);
  }
  // Große Bogenfenster in alle vier Richtungen.
  for (const rotate of [0, 90, 180, 270]) {
    b.transform({ rotate }, () => {
      for (let y = GALLERY + 2; y <= GALLERY + 7; y++) {
        for (let x = -1; x <= 1; x++) {
          if (y === GALLERY + 7 && x !== 0) b.set(x, y, 5, stairs(DS.stairs, x < 0 ? 'west' : 'east', 'top'));
          else b.set(x, y, 5, GLASS);
        }
      }
      b.set(0, GALLERY + 8, 5, DS.chiseled);
    });
  }
  // Traufgesims.
  for (let z = -8; z <= 8; z++) {
    for (let x = -8; x <= 8; x++) {
      const d = dist(x, z);
      if (d > 5.5 && d <= 6.5) b.set(x, OBS_TOP + 1, z, DS.block);
      else if (d > 6.5 && d <= 7.5) b.set(x, OBS_TOP + 1, z, stairs(DS.stairs, towardCenter(x, z), 'top'));
      else if (d <= 5.5) b.set(x, OBS_TOP + 1, z, 'air');
    }
  }
}

function buildRoof(b) {
  coneRoof(b, 0, 0, ROOF_BASE, ROOF_R, ROOF_H, 1.6);
  for (const rotate of [0, 90, 180, 270]) b.transform({ rotate }, () => roofDormer(b, ROOF_BASE + 1));
  let y = ROOF_BASE + ROOF_H - 2;
  while (b.get(0, y, 0) !== 'air') y++;
  b.set(0, y, 0, 'gold_block');
  b.set(0, y + 1, 0, 'lightning_rod');
  b.set(0, y + 2, 0, 'end_rod');
}

// Gaube im Dach (lokal nach Süden): Front bei z = 6, Fenster, kleines Satteldach.
function roofDormer(b, y) {
  for (let z = 3; z <= 6; z++) {
    for (let yy = y; yy <= y + 2; yy++) {
      b.set(-1, yy, z, z === 6 ? DS.block : 'calcite');
      b.set(1, yy, z, z === 6 ? DS.block : 'calcite');
      b.set(0, yy, z, 'air');
    }
    b.set(-2, y + 2, z, stairs(ROOF.stairs, 'east'));
    b.set(2, y + 2, z, stairs(ROOF.stairs, 'west'));
    b.set(-1, y + 3, z, stairs(ROOF.stairs, 'east'));
    b.set(1, y + 3, z, stairs(ROOF.stairs, 'west'));
    b.set(0, y + 3, z, ROOF.block);
    b.set(0, y + 4, z, slab(ROOF.slab, 'bottom'));
  }
  b.set(0, y, 6, DS.block);
  b.set(0, y + 1, 6, GLASS);
  b.set(0, y + 2, 6, GLASS);
  b.set(0, y - 1, 7, stairs(DS.stairs, 'north', 'top'));
}

function buildDoors(b) {
  // Eingang im Süden mit Spitzbogen-Portal.
  doorway(b, { x: 0, y: 2, z: 6, facing: 'south', door: DARK.door, frame: DS.block });
  arch(b, { x: 0, y: 2, z: 7, facing: 'south', width: 3, height: 4, style: 'pointed', block: DS.block, stairs: DS.stairs, depth: 1 });
  for (const x of [-2, 2]) {
    b.set(x, 1, 7, DS.block);
    b.set(x, 6, 7, DS.chiseled);
    b.set(x, 7, 7, 'lantern');
  }
  // Balkontür im Osten.
  doorway(b, { x: 6, y: FLOORS[2] + 1, z: 0, facing: 'east', door: DARK.door, frame: DS.block });
  // Tür der Sternwarte zur Galerie.
  doorway(b, { x: 0, y: GALLERY + 1, z: 5, facing: 'south', door: DARK.door, frame: null });
}

// ---------------------------------------------------------------- Einrichtung

// Freie Wandfelder (direkt an der Mauer) eines Geschosses, nach Winkel.
function wallCells(y) {
  const cells = [];
  for (let z = -5; z <= 5; z++) {
    for (let x = -5; x <= 5; x++) {
      const d = dist(x, z);
      if (d <= 4.5 || d > 5.5) continue;
      if (RESERVED.has(`${x},${y},${z}`)) continue;
      cells.push({ x, z, a: angleOf(x, z) });
    }
  }
  return cells.sort((p, q) => p.a - q.a);
}

function nearWindow(x, z) {
  return (Math.abs(x) <= 1 && Math.abs(z) >= 4) || (Math.abs(z) <= 1 && Math.abs(x) >= 4);
}

function chandelier(b, y, { lantern = 'lantern', arms = true } = {}) {
  b.set(0, y, 0, 'iron_chain');
  b.set(0, y - 1, 0, 'iron_chain');
  b.set(0, y - 2, 0, DARK.planks);
  b.set(0, y - 3, 0, `${lantern}[hanging=true]`);
  if (arms) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      b.set(dx, y - 2, dz, `${DARK.trapdoor}[facing=${dirOf(dx, dz)},half=top,open=false]`);
      b.set(dx, y - 3, dz, `${lantern}[hanging=true]`);
    }
  }
}

function furnishHall(b) {
  const y = FLOORS[0] + 1;
  // Am Eingang: Krüge, Fässer und Truhen an der Wand.
  furnish(b, -1, y, 5, 'decorated_pot[facing=south]');
  furnish(b, 1, y, 5, 'decorated_pot[facing=south]');
  for (const c of wallCells(y)) {
    if (nearWindow(c.x, c.z) || (Math.abs(c.x) <= 2 && c.z > 0)) continue;
    const n = hash01(c.x, y, c.z, 71);
    if (angleIn(c.a, 160, 230)) furnish(b, c.x, y, c.z, `barrel[facing=${towardCenter(c.x, c.z)}]`);
    else if (angleIn(c.a, 300, 20) && n < 0.5) furnish(b, c.x, y, c.z, 'bookshelf');
  }
  // Lesepult und Kartentisch vor der Westwand.
  furnish(b, -3, y, -2, 'lectern[facing=east]');
  furnish(b, -3, y, 2, 'cartography_table');
  furnish(b, 3, y, 2, 'potted_flowering_azalea_bush');
  // Erker im Südwesten: Kessel und Braustand.
  furnish(b, -5, y, 5, 'water_cauldron[level=3]');
  furnish(b, -4, y, 6, 'brewing_stand[has_bottle_0=true,has_bottle_2=true]');
  furnish(b, -6, y, 4, 'potted_fern');
  chandelier(b, FLOORS[1] - 1);
  // Teppich-Ring um die Kompassrose.
  for (let z = -4; z <= 4; z++) {
    for (let x = -4; x <= 4; x++) {
      const d = dist(x, z);
      if (d > 3.5 && d <= 4.5 && !(x === 0 || z === 0)) furnish(b, x, y, z, 'blue_carpet');
    }
  }
}

function furnishLibrary(b) {
  const y = FLOORS[1] + 1;
  for (const c of wallCells(y)) {
    if (nearWindow(c.x, c.z)) continue;
    const to = towardCenter(c.x, c.z);
    for (let dy = 0; dy < 3; dy++) {
      const n = hash01(c.x, y + dy, c.z, 72);
      const state = n < 0.3
        ? `chiseled_bookshelf[facing=${to},slot_0_occupied=true,slot_1_occupied=${n < 0.2},slot_2_occupied=true,slot_3_occupied=${n < 0.1},slot_4_occupied=true,slot_5_occupied=false]`
        : 'bookshelf';
      if (!furnish(b, c.x, y + dy, c.z, state)) break;
    }
    furnish(b, c.x, y + 3, c.z, `${DARK.slab}[type=bottom]`);
  }
  // Lesetisch in der Mitte mit Stühlen.
  for (const [x, z] of [[0, 0], [1, 0], [-1, 0]]) {
    furnish(b, x, y, z, DARK.fence);
    furnish(b, x, y + 1, z, `${DARK.pressurePlate}`);
  }
  furnish(b, 0, y + 1, 0, 'candle[candles=3,lit=true]');
  furnish(b, 0, y, 1, stairs(DARK.stairs, 'south'));
  furnish(b, 0, y, -1, stairs(DARK.stairs, 'north'));
  furnish(b, 2, y, 2, 'lectern[facing=north]');
  // Leseecke im Südwest-Erker.
  furnish(b, -5, y, 5, stairs(DARK.stairs, 'south'));
  furnish(b, -4, y, 5, `${DARK.slab}[type=bottom]`);
  furnish(b, -4, y + 1, 5, 'candle[candles=2,lit=true]');
  chandelier(b, FLOORS[2] - 1);
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (dist(x, z) <= 2.5) furnish(b, x, y, z, 'red_carpet');
}

function furnishAlchemy(b) {
  const y = FLOORS[2] + 1;
  for (const c of wallCells(y)) {
    if (nearWindow(c.x, c.z)) continue;
    const to = towardCenter(c.x, c.z);
    const n = hash01(c.x, y, c.z, 73);
    if (n < 0.35) {
      furnish(b, c.x, y, c.z, `${SPRUCE.planks}`);
      furnish(b, c.x, y + 1, c.z, n < 0.15 ? 'brewing_stand[has_bottle_0=true,has_bottle_1=true]' : n < 0.25 ? 'potted_crimson_fungus' : 'potted_brown_mushroom');
    } else if (n < 0.55) {
      furnish(b, c.x, y, c.z, 'water_cauldron[level=2]');
    } else if (n < 0.8) {
      furnish(b, c.x, y, c.z, `barrel[facing=${to}]`);
      furnish(b, c.x, y + 1, c.z, 'potted_red_mushroom');
    } else {
      furnish(b, c.x, y, c.z, `chest[facing=${to}]`);
    }
    furnish(b, c.x, y + 2, c.z, `${SPRUCE.shelf}[facing=${to}]`);
  }
  // Arbeitstisch in der Mitte.
  for (const [x, z] of [[0, 0], [1, 0], [0, 1], [1, 1]]) furnish(b, x, y, z, `${SPRUCE.slab}[type=top]`);
  furnish(b, 0, y + 1, 0, 'brewing_stand[has_bottle_1=true]');
  furnish(b, 1, y + 1, 1, 'candle[candles=4,lit=true]');
  furnish(b, 1, y + 1, 0, 'amethyst_cluster[facing=up]');
  // Erker im Südosten: Kräuter.
  furnish(b, 5, y, 5, 'composter[level=4]');
  furnish(b, 4, y, 5, 'potted_azure_bluet');
  furnish(b, 5, y, 4, 'potted_lily_of_the_valley');
  chandelier(b, FLOORS[3] - 1, { lantern: 'soul_lantern' });
}

function furnishBedroom(b) {
  const y = FLOORS[3] + 1;
  // Bett an der Nordwand, Kopfteil an der Wand.
  b.bed(-1, y, -3, 'light_blue_bed', { facing: 'north' });
  b.bed(1, y, -3, 'light_blue_bed', { facing: 'north' });
  furnish(b, -2, y, -4, 'barrel[facing=up]');
  furnish(b, -2, y + 1, -4, 'candle[candles=2,lit=true]');
  furnish(b, 2, y, -4, 'barrel[facing=up]');
  furnish(b, 2, y + 1, -4, 'potted_blue_orchid');
  for (const c of wallCells(y)) {
    if (nearWindow(c.x, c.z)) continue;
    const to = towardCenter(c.x, c.z);
    if (angleIn(c.a, 20, 70)) continue;
    if (angleIn(c.a, 290, 15)) {
      furnish(b, c.x, y, c.z, `chest[facing=${to}]`);
    } else if (angleIn(c.a, 95, 140)) {
      furnish(b, c.x, y, c.z, `${DARK.planks}`);
      furnish(b, c.x, y + 1, c.z, `${DARK.planks}`);
      furnish(b, c.x, y + 2, c.z, `${DARK.slab}[type=bottom]`);
    }
  }
  for (let z = -2; z <= 1; z++) for (let x = -2; x <= 2; x++) furnish(b, x, y, z, 'white_carpet');
  // Schreibtisch im Südost-Erker.
  furnish(b, 5, y, 5, `${DARK.slab}[type=top]`);
  furnish(b, 4, y, 5, stairs(DARK.stairs, 'west'));
  furnish(b, 5, y + 1, 5, 'candle[candles=1,lit=true]');
  chandelier(b, FLOORS[4] - 1, { arms: false });
}

function furnishMagic(b) {
  const y = FLOORS[4] + 1;
  enchantingSetup(b, { x: 0, y, z: 0, facing: 'south' });
  // Leiter zur Sternwarte an einem Pfeiler vor der Ostwand.
  for (let ly = y; ly <= GALLERY + 1; ly++) {
    if (ly <= GALLERY) b.set(LADDER.x + 1, ly, LADDER.z, DS.block);
    b.set(LADDER.x, ly, LADDER.z, 'ladder[facing=west]');
  }
  for (const c of wallCells(y)) {
    if (nearWindow(c.x, c.z) || Math.abs(c.z) <= 1) continue;
    const n = hash01(c.x, y, c.z, 74);
    if (n < 0.4) {
      furnish(b, c.x, y, c.z, 'amethyst_block');
      furnish(b, c.x, y + 1, c.z, n < 0.2 ? 'amethyst_cluster[facing=up]' : 'large_amethyst_bud[facing=up]');
    } else if (n < 0.6) {
      furnish(b, c.x, y, c.z, `${DARK.planks}`);
      furnish(b, c.x, y + 1, c.z, 'candle[candles=3,lit=true]');
    }
  }
  hangingLantern(b, { x: 0, y: GALLERY - 1, z: 0, chain: 3, lantern: 'soul_lantern' });
}

function furnishObservatory(b) {
  const y = GALLERY + 1;
  // Fernrohr auf Dreibein.
  b.set(0, y, 0, DS.block);
  b.set(0, y + 1, 0, DS.wall);
  b.set(0, y + 2, 0, 'waxed_cut_copper');
  b.set(0, y + 2, -1, 'lightning_rod[facing=north]');
  b.set(0, y + 2, 1, 'waxed_copper_bulb[lit=true]');
  furnish(b, -3, y, -1, 'cartography_table');
  furnish(b, -3, y, 1, 'lectern[facing=east]');
  furnish(b, 3, y, -2, `chest[facing=west]`);
  furnish(b, 2, y, 3, `${DARK.stairs}[facing=north]`);
  hangingLantern(b, { x: 0, y: OBS_TOP + 3, z: 0, chain: 3, lantern: 'soul_lantern' });
}

// ---------------------------------------------------------------- Hauptinsel: Teich, Bach, Wege, Garten

function buildPondAndStream(b) {
  pond(b, { x: POND_A.x, y: 0, z: POND_A.z, width: POND_A.width, depth: POND_A.depth, facing: 'west', waterDepth: 3, shore: 'gemischt', seed: 5 });
  // Bach von der Teichmitte zur Südkante.
  for (let z = POND_A.z + 4; z <= FALL_A.z - 1; z++) {
    for (let x = FALL_A.xs[0] - 1; x <= FALL_A.xs[2] + 1; x++) {
      const bank = x < FALL_A.xs[0] || x > FALL_A.xs[2];
      if (bank) {
        if (!String(b.get(x, 0, z)).startsWith('water')) b.set(x, 0, z, hash01(x, 0, z, 81) < 0.5 ? 'mossy_cobblestone' : 'cobblestone');
        b.set(x, -1, z, 'stone');
      } else {
        b.set(x, 0, z, 'water[level=0]');
        b.set(x, -1, z, hash01(x, -1, z, 82) < 0.5 ? 'gravel' : 'clay');
        if (b.get(x, 1, z) !== 'air') b.remove(x, 1, z);
      }
    }
  }
  // Kleiner Holzsteg über den Bach.
  const sz = 9;
  for (let x = FALL_A.xs[0] - 2; x <= FALL_A.xs[2] + 2; x++) {
    b.set(x, 1, sz, `${SPRUCE.slab}[type=bottom]`);
    b.set(x, 1, sz + 1, `${SPRUCE.slab}[type=bottom]`);
  }
  for (const x of [FALL_A.xs[0] - 2, FALL_A.xs[2] + 2]) {
    b.set(x, 1, sz - 1, SPRUCE.fence);
    b.set(x, 1, sz + 2, SPRUCE.fence);
  }
}

function buildWaterfalls(b) {
  // Quellinsel → Teich der Hauptinsel.
  for (const z of FALL_B.zs) {
    b.set(FALL_B.x, FALL_B.top, z, 'water[level=1]');
    for (let y = FALL_B.top - 1; y >= 1; y--) b.set(FALL_B.x, y, z, 'water[level=8]');
  }
  // Hauptinsel → Becken der Beckeninsel.
  for (const x of FALL_A.xs) {
    b.set(x, FALL_A.top, FALL_A.z, 'water[level=1]');
    for (let y = FALL_A.top - 1; y >= -21; y--) b.set(x, y, FALL_A.z, 'water[level=8]');
  }
}

function buildMainGarden(b, haupt) {
  const surface = (x, z) => haupt.map.get(`${x},${z}`)?.top ?? 0;
  // Bäume.
  tree(b, { x: -13, y: 1, z: 14, species: 'eiche', size: 'gross', seed: 3, facing: 'south' });
  tree(b, { x: 11, y: 1, z: -13, species: 'kirsche', size: 'mittel', seed: 9, facing: 'north' });
  tree(b, { x: -18, y: surface(-18, -12) + 1, z: -12, species: 'birke', size: 'mittel', seed: 4 });
  tree(b, { x: -12, y: surface(-12, -17) + 1, z: -17, species: 'birke', size: 'klein', seed: 6 });
  bush(b, { x: 7, y: 1, z: 13, size: 'klein', leaves: 'azalee', seed: 8 });
  rock(b, { x: -21, y: surface(-21, -8) + 1, z: -8, size: 'gross', material: 'andesit', seed: 2 });
  rock(b, { x: -14, y: surface(-14, -15) + 1, z: -15, size: 'mittel', material: 'stein', seed: 5 });
  rock(b, { x: 22, y: 1, z: 9, size: 'klein', material: 'stein', seed: 7 });
  bush(b, { x: -8, y: 1, z: 9, size: 'klein', leaves: 'azalee', seed: 1 });
  bush(b, { x: 9, y: 1, z: 6, size: 'klein', leaves: 'azalee', seed: 2 });
  bush(b, { x: -20, y: 1, z: 13, size: 'mittel', leaves: 'eiche', seed: 3 });
  bush(b, { x: 14, y: 1, z: -11, size: 'klein', leaves: 'birke', seed: 4 });
  // Wege: Portal → Süden, Terrasse → Westbrücke, Terrasse → Teich.
  pathAlong(b, { y: 0, points: [[-3, 7], [-3, 11], [2, 15], [8, 17]], width: 3, mix: 'gemischt', seed: 11 });
  pathAlong(b, { y: 0, points: [[-13, 0], [-18, 3], [-26, 4]], width: 3, mix: 'gemischt', seed: 12 });
  pathAlong(b, { y: 0, points: [[8, -2], [12, 0]], width: 2, mix: 'kies', seed: 13 });
  pathAlong(b, { y: 0, points: [[2, 15], [12, 10], [20, 9]], width: 2, mix: 'erde', seed: 14 });
  // Laternen und Bank an der Südkante.
  lampPost(b, { x: -5, y: 1, z: 11, height: 3, post: DARK.fence, base: DS.block, style: 'arm', facing: 'east' });
  lampPost(b, { x: -15, y: 1, z: 1, height: 3, post: DARK.fence, base: DS.block, style: 'arm', facing: 'south' });
  lampPost(b, { x: 10, y: 1, z: 15, height: 3, post: DARK.fence, base: DS.block, style: 'arm', facing: 'north' });
  for (const [x, f] of [[6, 'north'], [7, 'north'], [8, 'north']]) b.set(x, 1, 18, stairs(SPRUCE.stairs, f));
  // Beete vor der Terrasse.
  flowerBed(b, { x: -10, y: 0, z: 5, width: 4, depth: 3, palette: 'kuehl', facing: 'south', seed: 21 });
  flowerBed(b, { x: 3, y: 0, z: 6, width: 4, depth: 3, palette: 'warm', facing: 'south', seed: 22 });
  vegetation(b, { x: -26, y: 8, z: -22, width: 52, depth: 44, mix: 'wiese', density: 0.3, seed: 23 });
  vegetation(b, { x: -24, y: 8, z: 6, width: 18, depth: 14, mix: 'blumen', density: 0.35, seed: 24 });
  vegetation(b, { x: 2, y: 8, z: -20, width: 18, depth: 12, mix: 'blumen', density: 0.35, seed: 25 });
}

// ---------------------------------------------------------------- Quellinsel

function buildSpringIsland(b, quelle) {
  pond(b, { x: POND_B.x, y: 17, z: POND_B.z, width: POND_B.width, depth: POND_B.depth, facing: 'east', waterDepth: 2, shore: 'kies', seed: 31 });
  // Rinne vom Quellteich zur Kante.
  for (let x = 22; x <= POND_B.x + 2; x++) {
    for (let z = 0; z <= 4; z++) {
      const bank = z === 0 || z === 4;
      const id = b.get(x, 17, z);
      if (bank) {
        if (!id.startsWith('water')) b.set(x, 17, z, hash01(x, 17, z, 83) < 0.5 ? 'mossy_cobblestone' : 'cobblestone');
      } else {
        b.set(x, 17, z, 'water[level=0]');
        b.set(x, 16, z, 'stone');
        if (b.get(x, 18, z) !== 'air') b.remove(x, 18, z);
      }
    }
  }
  const top = (x, z) => quelle.map.get(`${x},${z}`)?.top ?? 17;
  tree(b, { x: 38, y: top(38, -6) + 1, z: -6, species: 'kirsche', size: 'gross', seed: 14, facing: 'west' });
  bush(b, { x: 41, y: top(41, 2) + 1, z: 2, size: 'klein', leaves: 'azalee', seed: 5 });
  rock(b, { x: 30, y: 18, z: -9, size: 'klein', material: 'stein', seed: 4 });
  // Steinlaterne und Bank unter dem Kirschbaum.
  b.set(34, 18, -9, 'stone_bricks');
  b.set(34, 19, -9, 'stone_brick_wall');
  b.set(34, 20, -9, 'lantern');
  b.set(34, 21, -9, 'stone_brick_slab[type=bottom]');
  for (const x of [35, 36, 37]) b.set(x, top(x, -2) + 1, -2, stairs(SPRUCE.stairs, 'north'));
  for (const x of [34, 38]) b.set(x, top(x, -2) + 1, -2, `${SPRUCE.trapdoor}[facing=${x === 34 ? 'west' : 'east'},half=bottom,open=true]`);
  vegetation(b, { x: 21, y: 22, z: -13, width: 25, depth: 21, mix: 'blumen', density: 0.35, seed: 32 });
}

// ---------------------------------------------------------------- Hängebrücke Turm → Quellinsel

function buildRopeBridge(b, quelle) {
  const x0 = T.x + 10;
  let x1 = x0 + 1;
  while (!quelle.map.has(`${x1},${BRIDGE_B.z}`)) x1++;
  const len = x1 - x0;
  const surfaceAt = (x) => BRIDGE_B.y - Math.sin((Math.PI * (x - x0 + 0.5)) / (len + 1));
  b.step();
  for (let x = x0; x <= x1 + 1; x++) {
    const S = Math.round(2 * surfaceAt(x));
    const y = S % 2 === 0 ? S / 2 - 1 : (S - 1) / 2;
    const type = S % 2 === 0 ? 'top' : 'bottom';
    for (let dz = -2; dz <= 2; dz++) {
      const z = BRIDGE_B.z + dz;
      const edge = Math.abs(dz) === 2;
      b.set(x, y, z, slab(edge ? DARK.slab : (x + dz) % 3 === 0 ? DARK.slab : SPRUCE.slab, type));
      if (edge && x <= x1) b.set(x, y + 1, z, SPRUCE.fence);
    }
    if ((x - x0) % 4 === 0) {
      b.set(x, y - (type === 'top' ? 0 : 1), BRIDGE_B.z - 3, `${SPRUCE.strippedLog}[axis=z]`);
      b.set(x, y - (type === 'top' ? 0 : 1), BRIDGE_B.z + 3, `${SPRUCE.strippedLog}[axis=z]`);
      for (let dz = -2; dz <= 2; dz++) if (b.get(x, y - 1, BRIDGE_B.z + dz) === 'air') b.set(x, y - 1, BRIDGE_B.z + dz, `${SPRUCE.strippedLog}[axis=z]`);
    }
  }
  // Pfosten mit Laternen an beiden Enden.
  for (const x of [x0, x1]) {
    for (const dz of [-2, 2]) {
      const z = BRIDGE_B.z + dz;
      let y = 15;
      while (b.get(x, y, z) !== 'air' && y < 22) y++;
      b.set(x, y, z, `${DARK.log}[axis=y]`);
      b.set(x, y + 1, z, `${DARK.log}[axis=y]`);
      b.set(x, y + 2, z, 'lantern');
    }
  }
}

// ---------------------------------------------------------------- Beckeninsel

function buildBasinIsland(b, becken) {
  pond(b, { x: POND_C.x, y: -22, z: POND_C.z, width: POND_C.width, depth: POND_C.depth, facing: 'south', waterDepth: 3, shore: 'ton', lilyPads: false, seed: 41 });
  const top = (x, z) => becken.map.get(`${x},${z}`)?.top ?? -22;
  for (const c of becken.cols) {
    if (b.get(c.x, c.top, c.z) === 'grass_block' && hash01(c.x, 0, c.z, 84) < 0.35) b.set(c.x, c.top, c.z, 'moss_block');
  }
  bush(b, { x: 22, y: top(22, 20) + 1, z: 20, size: 'mittel', leaves: 'azalee', seed: 6 });
  bush(b, { x: 11, y: top(11, 15) + 1, z: 15, size: 'klein', leaves: 'azalee', seed: 7 });
  for (const [x, z] of [[15, 20], [19, 20], [21, 16]]) {
    if (b.get(x, top(x, z) + 1, z) === 'air' && b.get(x, top(x, z), z) !== 'air' && !b.get(x, top(x, z), z).startsWith('water')) {
      b.set(x, top(x, z) + 1, z, 'small_dripleaf[half=lower,facing=north]');
      b.set(x, top(x, z) + 2, z, 'small_dripleaf[half=upper,facing=north]');
    }
  }
  vegetation(b, { x: 8, y: -17, z: 8, width: 19, depth: 17, mix: 'farn', density: 0.4, seed: 42 });
}

// ---------------------------------------------------------------- Waldinsel mit Pavillon und Steinbrücke

function buildForestIsland(b, wald) {
  const top = (x, z) => wald.map.get(`${x},${z}`)?.top ?? -6;
  const P = PAVILION;
  b.step();
  for (let z = P.z; z < P.z + P.size; z++) {
    for (let x = P.x; x < P.x + P.size; x++) {
      const edge = x === P.x || x === P.x + P.size - 1 || z === P.z || z === P.z + P.size - 1;
      const mid = Math.abs(x - (P.x + 3)) + Math.abs(z - (P.z + 3));
      b.set(x, P.y, z, edge ? 'stone_bricks' : mid <= 1 ? 'chiseled_quartz_block' : mid <= 2 ? 'quartz_bricks' : 'polished_andesite');
    }
  }
  b.step();
  for (const [x, z] of [[P.x, P.z], [P.x + 6, P.z], [P.x, P.z + 6], [P.x + 6, P.z + 6]]) {
    for (let y = P.y + 1; y <= P.y + 4; y++) b.set(x, y, z, y === P.y + 4 ? 'chiseled_quartz_block' : 'quartz_pillar');
  }
  for (let x = P.x; x < P.x + P.size; x++) {
    for (const z of [P.z, P.z + 6]) if (x !== P.x && x !== P.x + 6) b.set(x, P.y + 4, z, 'smooth_quartz');
  }
  for (let z = P.z; z < P.z + P.size; z++) {
    for (const x of [P.x, P.x + 6]) if (z !== P.z && z !== P.z + 6) b.set(x, P.y + 4, z, 'smooth_quartz');
  }
  b.step();
  b.roof({ x1: P.x, z1: P.z, x2: P.x + 6, z2: P.z + 6, y: P.y + 5, type: 'pyramid', stairs: ROOF.stairs, slab: ROOF.slab, full: ROOF.block, overhang: 1 });
  b.set(P.x + 3, P.y + 9, P.z + 3, 'gold_block');
  b.set(P.x + 3, P.y + 10, P.z + 3, 'end_rod');
  b.step();
  b.set(P.x + 3, P.y + 1, P.z + 2, 'lectern[facing=south]');
  for (const x of [P.x + 2, P.x + 3, P.x + 4]) b.set(x, P.y + 1, P.z + 5, stairs(DARK.stairs, 'south'));
  hangingLantern(b, { x: P.x + 3, y: P.y + 5, z: P.z + 3, chain: 1 });
  // Stufen zum Pavillon (Osten).
  for (let z = P.z + 2; z <= P.z + 4; z++) b.set(P.x + 7, P.y, z, stairs('stone_brick_stairs', 'west'));
  // Bäume und Felsen.
  tree(b, { x: -53, y: top(-53, -3) + 1, z: -3, species: 'fichte', size: 'gross', seed: 21 });
  tree(b, { x: -44, y: top(-44, 11) + 1, z: 11, species: 'fichte', size: 'mittel', seed: 22 });
  tree(b, { x: -57, y: top(-57, 8) + 1, z: 8, species: 'fichte', size: 'mittel', seed: 23 });
  tree(b, { x: -42, y: top(-42, -2) + 1, z: -2, species: 'birke', size: 'mittel', seed: 24 });
  tree(b, { x: -50, y: top(-50, 12) + 1, z: 12, species: 'birke', size: 'klein', seed: 25 });
  rock(b, { x: -39, y: top(-39, 9) + 1, z: 9, size: 'mittel', material: 'stein', seed: 26 });
  bush(b, { x: -48, y: top(-48, -1) + 1, z: -1, size: 'klein', leaves: 'fichte', seed: 27 });
  pathAlong(b, { y: -6, points: [[-37, 4], [-45, 4]], width: 3, mix: 'kies', seed: 28 });
  vegetation(b, { x: -60, y: -2, z: -6, width: 26, depth: 22, mix: 'farn', density: 0.4, seed: 29 });
}

function buildStoneBridge(b, haupt, wald) {
  const z0 = BRIDGE_D.z;
  // Brückenköpfe: letzte Felder der Inseln auf der Brückenachse.
  let xa = -10;
  while (haupt.map.has(`${xa - 1},${z0}`)) xa--;
  let xd = -36;
  while (wald.map.has(`${xd + 1},${z0}`)) xd++;
  const xStart = xa + 2;
  const xEnd = xd - 2;
  const len = xStart - xEnd;
  b.step();
  for (let x = xStart; x >= xEnd; x--) {
    const t = (xStart - x) / len;
    const S = Math.round(2 * (1 + (-5 - 1) * t));
    const y = S % 2 === 0 ? S / 2 - 1 : (S - 1) / 2;
    const type = S % 2 === 0 ? 'top' : 'bottom';
    const thick = 1 + Math.round(3 * Math.abs(2 * t - 1) ** 2.5);
    for (let dz = -2; dz <= 2; dz++) {
      const z = z0 + dz;
      const edge = Math.abs(dz) === 2;
      if (edge) {
        for (let yy = y - thick; yy <= y; yy++) b.set(x, yy, z, hash01(x, yy, z, 91) < 0.3 ? 'mossy_stone_bricks' : hash01(x, yy, z, 92) < 0.2 ? 'cracked_stone_bricks' : 'stone_bricks');
        b.set(x, y + 1, z, (xStart - x) % 4 === 0 ? 'stone_bricks' : 'stone_brick_wall');
      } else {
        b.set(x, y, z, slab('stone_brick_slab', type));
        if (type === 'top' || thick > 1) for (let yy = y - thick; yy < y; yy++) b.set(x, yy, z, hash01(x, yy, z, 93) < 0.25 ? 'mossy_stone_bricks' : 'stone_bricks');
      }
    }
    if ((xStart - x) % 4 === 0) for (const dz of [-2, 2]) b.set(x, y + 2, z0 + dz, 'lantern');
  }
}

// ---------------------------------------------------------------- Kristallinsel

function buildCrystalIsland(b, kristall) {
  const { cx, cz } = kristall.spec;
  const top = (x, z) => kristall.map.get(`${x},${z}`)?.top ?? 36;
  b.step();
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + 0.3;
    const x = cx + Math.round(4 * Math.cos(a));
    const z = cz + Math.round(4 * Math.sin(a));
    const y0 = top(x, z) + 1;
    const h = 3 + (k % 2);
    for (let y = y0; y < y0 + h; y++) b.set(x, y, z, y === y0 ? 'polished_diorite' : 'calcite');
    b.set(x, y0 + h, z, 'chiseled_quartz_block');
    b.set(x, y0 + h + 1, z, 'end_rod');
  }
  b.step();
  const y = top(cx, cz);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) b.set(cx + dx, y, cz + dz, Math.abs(dx) + Math.abs(dz) === 2 ? 'amethyst_block' : 'budding_amethyst');
  b.set(cx, y + 1, cz, 'amethyst_block');
  b.set(cx, y + 2, cz, 'amethyst_block');
  b.set(cx, y + 3, cz, 'amethyst_cluster[facing=up]');
  for (const [dx, dz, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) {
    b.set(cx + dx, y + 1, cz + dz, `amethyst_cluster[facing=up]`);
    b.set(cx + dx, y + 2, cz + dz, `large_amethyst_bud[facing=${f}]`.replace(`[facing=${f}]`, '[facing=up]'));
    b.set(cx + 2 * dx, y + 1, cz + 2 * dz, `medium_amethyst_bud[facing=up]`);
  }
  vegetation(b, { x: cx - 7, y: 40, z: cz - 6, width: 15, depth: 13, mix: 'wiese', density: 0.3, seed: 51 });
}

// ---------------------------------------------------------------- Ketten

// Durchhängende Kette aus Kettengliedern; jedes Glied berührt das nächste mit einer Fläche.
function chainLine(b, [x1, y1, z1], [x2, y2, z2], sag) {
  const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
  const n = Math.ceil(len * 4);
  const cells = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = [Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t - sag * 4 * t * (1 - t)), Math.round(z1 + (z2 - z1) * t)];
    const last = cells[cells.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1] && last[2] === p[2]) continue;
    if (last) {
      // Diagonale Sprünge in Einzelschritte zerlegen (zuerst waagrecht, dann senkrecht).
      const cur = [...last];
      for (const axis of [0, 2, 1]) {
        if (cur[axis] !== p[axis] && (cur[0] !== p[0]) + (cur[1] !== p[1]) + (cur[2] !== p[2]) > 1) {
          cur[axis] = p[axis];
          cells.push([...cur]);
        }
      }
    }
    cells.push(p);
  }
  cells.forEach((c, i) => {
    const prev = cells[Math.max(0, i - 1)];
    const next = cells[Math.min(cells.length - 1, i + 1)];
    const d = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]].map(Math.abs);
    const axis = d[1] >= d[0] && d[1] >= d[2] ? 'y' : d[0] >= d[2] ? 'x' : 'z';
    put(b, c[0], c[1], c[2], `iron_chain[axis=${axis}]`);
  });
}

function buildChains(b, islands) {
  const { haupt, becken, kristall } = islands;
  b.step();
  // Galerie (Nordseite) → Kristallinsel.
  const ktop = (x, z) => kristall.map.get(`${x},${z}`)?.top ?? 36;
  for (const tx of [-2, 2]) {
    const kx = T.x + tx;
    let kz = kristall.spec.cz;
    while (kristall.map.has(`${kx},${kz + 1}`)) kz++;
    const ky = ktop(kx, kz) + 1;
    b.set(kx, ky, kz, DS.block);
    b.set(kx, ky + 1, kz, DS.chiseled);
    chainLine(b, [kx, GALLERY + 1, T.z - 10], [kx, ky + 1, kz + 1], 4);
  }
  b.step();
  // Hauptinsel → Beckeninsel: senkrechte Ketten.
  const anchors = [];
  for (const c of becken.cols) {
    const a = haupt.map.get(`${c.x},${c.z}`);
    if (!a || a.rho > 0.93 || c.rho > 0.85 || Math.abs(c.x - 18) < 4 || Math.abs(c.z - FALL_A.z) < 2) continue;
    anchors.push({ x: c.x, z: c.z, top: c.top, bottom: a.bottom });
  }
  anchors.sort((p, q) => p.x - q.x || p.z - q.z);
  const picks = anchors.length > 0 ? [anchors[0], anchors[anchors.length - 1]] : [];
  for (const p of picks) {
    b.set(p.x, p.top + 1, p.z, DS.block);
    for (let y = p.top + 2; y < p.bottom; y++) put(b, p.x, y, p.z, 'iron_chain[axis=y]');
  }
}

// ---------------------------------------------------------------- Schwebende Felsen

function buildRock(b, r, i) {
  const spec = {
    name: 'Fels', cx: r.x, cz: r.z, rx: r.r, rz: r.r * 0.85, top: r.y, depth: r.r * 1.9, salt: 200 + i * 7, wob: [0.1, i, 0.06, i * 2],
    spikes: [[r.x + 1, r.z, r.r * 0.6, r.r * 0.6]], dirt: 0, rim: 1, deep: 1, lip: 1, jag: 0.8,
    force: () => false, cut: () => false, flat: () => false,
    topAt: (x, z, rho) => r.y + (rho < 0.45 ? 1 : 0),
  };
  const island = makeColumns(spec);
  b.step();
  for (const c of island.cols) {
    for (let y = c.top; y >= c.bottom; y--) {
      const n = hash01(c.x, y, c.z, 9);
      const rimTop = c.rho > 0.8 ? (n < 0.4 ? 'moss_block' : n < 0.7 ? 'mossy_cobblestone' : 'stone') : 'grass_block';
      const crystalTop = n < 0.5 ? 'calcite' : 'moss_block';
      const id = y === c.top ? (r.deco === 'kristall' ? crystalTop : rimTop) : underBlock(c.x, y, c.z, c.top - y, c, island);
      b.set(c.x, y, c.z, id);
    }
  }
  const top = r.y + 2;
  if (r.deco === 'busch') bush(b, { x: r.x, y: top, z: r.z, size: 'klein', leaves: 'azalee', seed: i });
  else if (r.deco === 'birke') tree(b, { x: r.x, y: top, z: r.z, species: 'birke', size: 'klein', seed: i, roots: false });
  else if (r.deco === 'kristall') {
    b.set(r.x, top, r.z, 'amethyst_block');
    b.set(r.x, top + 1, r.z, 'amethyst_cluster[facing=up]');
    put(b, r.x + 1, top, r.z, 'large_amethyst_bud[facing=up]');
    put(b, r.x, top, r.z - 1, 'medium_amethyst_bud[facing=up]');
  } else {
    for (const c of island.cols) if (hash01(c.x, 0, c.z, 300 + i) < 0.5) put(b, c.x, c.top + 1, c.z, 'moss_carpet');
  }
  const low = island.cols.reduce((m, c) => (c.bottom < m.bottom ? c : m), island.cols[0]);
  dripstone(b, low.x, low.bottom - 1, low.z, 2);
  return island;
}

// Kleine Amethyst-Splitter, die um die Turmspitze schweben.
const SHARDS = [[10, 58, -9], [-16, 62, -1], [-7, 67, -17], [5, 64, 8]];

function buildShards(b) {
  b.step();
  for (const [x, y, z] of SHARDS) {
    b.set(x, y, z, 'amethyst_block');
    b.set(x, y + 1, z, 'amethyst_block');
    b.set(x + 1, y, z, 'budding_amethyst');
    b.set(x, y, z + 1, 'amethyst_block');
    b.set(x, y + 2, z, 'amethyst_cluster[facing=up]');
    b.set(x, y - 1, z, 'amethyst_cluster[facing=down]');
    b.set(x + 1, y - 1, z, 'large_amethyst_bud[facing=down]');
    b.set(x + 2, y, z, 'amethyst_cluster[facing=east]');
    b.set(x - 1, y, z, 'large_amethyst_bud[facing=west]');
    b.set(x, y, z + 2, 'amethyst_cluster[facing=south]');
    b.set(x, y + 1, z - 1, 'medium_amethyst_bud[facing=north]');
    b.set(x + 1, y + 1, z, 'large_amethyst_bud[facing=up]');
  }
}

// ---------------------------------------------------------------- Amethyst-Drusen und Wolken

// Drusen an den Unterseiten: außen glatter Basalt, dann Calcit, innen Amethyst mit Kristallen nach unten.
const GEODES = [
  { island: 'haupt', x: 6, z: -11, r: 2.5 },
  { island: 'haupt', x: -13, z: 5, r: 2 },
  { island: 'wald', x: -47, z: 4, r: 2 },
];

function geodeBlock(island, c, y) {
  for (const g of GEODES) {
    if (g.island !== island.spec.key) continue;
    const d = Math.hypot(c.x - g.x, c.z - g.z);
    const k = y - c.bottom;
    if (d <= g.r && k <= 2) return hash01(c.x, y, c.z, 95) < 0.35 ? 'budding_amethyst' : 'amethyst_block';
    if (d <= g.r + 1 && k <= 1) return k === 0 ? 'calcite' : 'smooth_basalt';
    if (d <= g.r + 2 && k === 0) return 'smooth_basalt';
  }
  return null;
}

function geodeCrystal(island, c) {
  for (const g of GEODES) {
    if (g.island !== island.spec.key || Math.hypot(c.x - g.x, c.z - g.z) > g.r) continue;
    const n = hash01(c.x, c.bottom, c.z, 96);
    return n < 0.45 ? 'amethyst_cluster[facing=down]' : n < 0.75 ? 'large_amethyst_bud[facing=down]' : 'medium_amethyst_bud[facing=down]';
  }
  return null;
}

// Wolken: mehrere flache Kuppeln mit ebener Unterseite.
const CLOUDS = [
  { x: -36, y: -31, z: 22, rx: 9, rz: 5 },
  { x: 44, y: -12, z: 10, rx: 7, rz: 4 },
  { x: 24, y: 50, z: -32, rx: 8, rz: 5 },
  { x: -56, y: 30, z: -22, rx: 6, rz: 4 },
];
const PUFFS = [[0, 0, 1], [0.55, 0.25, 0.75], [-0.55, -0.15, 0.8], [0.15, -0.45, 0.6], [-0.2, 0.5, 0.6], [0.8, -0.2, 0.45], [-0.85, 0.3, 0.4], [0.3, 0.1, 0.65]];

function buildClouds(b) {
  for (const c of CLOUDS) {
    b.step();
    for (const [ox, oz, f] of PUFFS) {
      const px = c.x + ox * c.rx;
      const pz = c.z + oz * c.rz;
      const rx = c.rx * f;
      const rz = c.rz * f;
      const ry = 1.5 + 3.2 * f * f;
      for (let z = Math.floor(pz - rz); z <= pz + rz; z++) {
        for (let x = Math.floor(px - rx); x <= px + rx; x++) {
          for (let dy = 0; dy <= ry; dy++) {
            if (((x - px) / rx) ** 2 + ((z - pz) / rz) ** 2 + (dy / ry) ** 2 > 1) continue;
            put(b, x, c.y + dy, z, 'white_wool');
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- Aufbau

export default function build(b) {
  const islands = Object.fromEntries(ISLANDS.map((spec) => [spec.key, makeColumns(spec)]));
  const { haupt, quelle, becken, wald, kristall } = islands;

  buildIsland(b, haupt);
  buildTower(b);

  b.phase('Hauptinsel: Teich und Bach');
  buildPondAndStream(b);

  buildIsland(b, quelle);
  b.phase('Quellinsel: Quellteich und Kirschbaum');
  buildSpringIsland(b, quelle);

  b.phase('Hängebrücke');
  buildRopeBridge(b, quelle);

  buildIsland(b, becken);
  b.phase('Beckeninsel: Becken und Moos');
  buildBasinIsland(b, becken);

  b.phase('Wasserfälle');
  buildWaterfalls(b);

  buildIsland(b, wald);
  b.phase('Waldinsel: Pavillon und Wald');
  buildForestIsland(b, wald);

  b.phase('Steinbrücke');
  buildStoneBridge(b, haupt, wald);

  buildIsland(b, kristall);
  b.phase('Kristallinsel: Steinkreis');
  buildCrystalIsland(b, kristall);

  b.phase('Ketten');
  buildChains(b, islands);

  b.phase('Schwebende Felsen und Splitter');
  ROCKS.forEach((r, i) => buildRock(b, r, i));
  buildShards(b);

  b.phase('Hauptinsel: Garten, Wege und Bäume');
  buildMainGarden(b, haupt);

  b.phase('Ranken und Hängendes');
  for (const island of Object.values(islands)) buildHanging(b, island);

  b.phase('Wolken');
  buildClouds(b);
}
