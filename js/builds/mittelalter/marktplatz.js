// Marktplatz – gepflasterter Platz mit Brunnen, sechs Marktständen mit Woll-Markisen, Bänken und Laternen.
// Rahmen: Brunnenmitte bei (0, 0), Platz x/z −14 … 14 auf y = 0; im Süden ist der Platz offen (Zugang mit Weg).

import { hashPosition } from '../../core/random.js';
import {
  COLOR, lampPost, findDarkSpots, tree, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'marktplatz',
  title: 'Marktplatz',
  category: 'mittelalter',
  subtitle: 'Gepflasterter Dorfplatz mit Brunnen und sechs Marktständen',
  tags: ['Mittelalter', 'Dorf', 'Markt', 'Platz', 'Brunnen', 'Marktstand', 'Händler', 'Deko', 'Stadt'],
  aliases: [
    'marktplatz', 'markt platz', 'markplatz', 'marktplaz', 'markt', 'wochenmarkt', 'dorfplatz', 'stadtplatz', 'marktstand',
    'marktstände', 'marktstaende', 'brunnen', 'dorfbrunnen', 'market', 'marketplace', 'market place', 'market square',
    'medieval market', 'market stall', 'fountain', 'town square',
  ],
  accuracy: 'eigenes',
  description: 'Ein gepflasterter Dorfplatz mit 29 × 29 Blöcken: in der Mitte ein runder Brunnen mit Säule und Wasserschale, ringsum sechs Marktstände mit gestreiften Markisen aus Wolle – Gemüse, Bäcker, Tuchhändler, Blumen, Töpfer und Fischhändler, jeder mit eigener Ware. Bänke am Brunnen, Laternenpfähle aus Steinziegelmauer und kleine Birken in Pflanzinseln an den Ecken runden den Platz ab. Nach Süden ist der Platz offen und führt über eine gepflasterte Gasse ins Dorf.',
  sources: [],
  credits: null,
  tested: null,
};

const R = 14;
const ROTATE = { south: 0, west: 90, north: 180, east: 270 };

const key = (x, z) => `${x},${z}`;

function discCells(r) {
  const cells = [];
  const n = Math.ceil(r + 0.5);
  for (let z = -n; z <= n; z++) for (let x = -n; x <= n; x++) if (Math.hypot(x, z) <= r + 0.5) cells.push([x, z]);
  return cells;
}

function ringCells(r) {
  const inside = new Set(discCells(r).map(([x, z]) => key(x, z)));
  return discCells(r).filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inside.has(key(x + dx, z + dz))));
}

function paving(x, z) {
  const h = hashPosition(x, 0, z, 2024) % 20;
  if (h < 7) return 'stone_bricks';
  if (h < 12) return 'cobblestone';
  if (h < 15) return 'andesite';
  if (h < 17) return 'polished_andesite';
  if (h < 19) return 'cracked_stone_bricks';
  return 'mossy_cobblestone';
}

function plaza(b) {
  b.phase('Gelände und Pflaster');
  b.step();
  b.fill(-R - 4, 0, -R - 4, R + 4, 0, R + 4, 'grass_block');
  b.step();
  const ring5 = new Set(ringCells(5).map(([x, z]) => key(x, z)));
  const inner = new Set(discCells(4).map(([x, z]) => key(x, z)));
  for (let z = -R; z <= R; z++) {
    for (let x = -R; x <= R; x++) {
      if (Math.abs(x) >= R - 4 && Math.abs(z) >= R - 4) continue;
      let state = paving(x, z);
      if (Math.abs(x) === R || Math.abs(z) === R) state = 'stone_bricks';
      else if (ring5.has(key(x, z))) state = 'polished_andesite';
      else if (inner.has(key(x, z))) state = 'stone_bricks';
      b.set(x, 0, z, state);
    }
  }
  b.step();
  for (let z = R + 1; z <= R + 4; z++) for (let x = -2; x <= 2; x++) b.set(x, 0, z, Math.abs(x) === 2 ? 'stone_bricks' : paving(x, z));
  b.step();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = R - 4; i <= R; i++) {
        b.set(sx * i, 0, sz * (R - 4), 'stone_bricks');
        b.set(sx * (R - 4), 0, sz * i, 'stone_bricks');
        b.set(sx * i, 0, sz * R, 'stone_bricks');
        b.set(sx * R, 0, sz * i, 'stone_bricks');
      }
    }
  }
}

function fountain(b) {
  b.phase('Brunnen');
  b.step();
  for (const [x, z] of discCells(3)) b.set(x, 0, z, 'stone_bricks');
  for (const [x, z] of ringCells(3)) {
    b.set(x, 1, z, 'stone_bricks');
    b.set(x, 2, z, 'stone_brick_slab[type=bottom]');
  }
  b.step();
  b.set(0, 1, 0, 'chiseled_stone_bricks');
  b.set(0, 2, 0, 'stone_bricks');
  b.set(0, 3, 0, 'stone_bricks');
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const facing = Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'east' : 'west') : (z > 0 ? 'south' : 'north');
    b.set(x, 4, z, `stone_brick_stairs[facing=${facing},half=bottom]`);
  }
  b.step();
  const ring3 = new Set(ringCells(3).map(([x, z]) => key(x, z)));
  for (const [x, z] of discCells(3)) if (!ring3.has(key(x, z)) && (x || z)) b.set(x, 1, z, 'water');
  b.set(0, 4, 0, 'water');
}

// Marktstand im lokalen Rahmen: Theke vorne (lz 0), Lager hinten (lz −2), Markise aus zwei Wollfarben in Streifen.
const STALLS = [
  // Gemüsestand
  { x: -5, z: -9, facing: 'south', colors: ['rot', 'weiss'],
    goods: ['pumpkin', 'melon', 'hay_block[axis=x]'], back: ['composter[level=8]', 'barrel[facing=up]', 'barrel[facing=up]'] },
  // Bäckerei
  { x: 5, z: -9, facing: 'south', colors: ['orange', 'weiss'],
    goods: ['cake', 'hay_block[axis=x]', 'cake'], back: ['barrel[facing=up]', 'smoker[facing=south,lit=true]', 'barrel[facing=up]'] },
  // Tuchhändler
  { x: -9, z: -4, facing: 'east', colors: ['violett', 'gelb'],
    goods: ['red_wool', 'light_blue_wool', 'yellow_wool'], back: ['loom[facing=south]', 'white_wool', 'barrel[facing=up]'] },
  // Blumenstand
  { x: -9, z: 5, facing: 'east', colors: ['rosa', 'weiss'],
    goods: ['potted_red_tulip', 'potted_cornflower', 'potted_allium'], back: ['potted_flowering_azalea_bush', 'barrel[facing=up]', 'potted_azalea_bush'] },
  // Töpferei
  { x: 9, z: -4, facing: 'west', colors: ['braun', 'weiss'],
    goods: ['decorated_pot[facing=south]', 'flower_pot', 'decorated_pot[facing=south]'], back: ['chest[facing=south,type=single]', 'barrel[facing=up]', 'terracotta'] },
  // Fischhändler
  { x: 9, z: 5, facing: 'west', colors: ['blau', 'weiss'],
    goods: ['water_cauldron[level=3]', 'dried_kelp_block', 'barrel[facing=up]'], back: ['packed_ice', 'packed_ice', 'barrel[facing=up]'] },
];

function stall(b, s) {
  const [colorA, colorB] = s.colors.map((c) => COLOR[c].wool);
  b.transform({ offset: [s.x, 1, s.z], rotate: ROTATE[s.facing] }, () => {
    for (const lx of [-2, 2]) {
      b.fill(lx, 0, 0, lx, 3, 0, 'spruce_fence');
      b.fill(lx, 0, -2, lx, 4, -2, 'spruce_fence');
    }
    for (let lx = -1; lx <= 1; lx++) {
      b.set(lx, 0, 0, 'spruce_slab[type=top]');
      b.set(lx, 1, 0, s.goods[lx + 1]);
      b.set(lx, 0, -2, s.back[lx + 1]);
    }
    for (let lx = -2; lx <= 2; lx++) {
      const wool = Math.abs(lx) % 2 === 0 ? colorA : colorB;
      for (const [lz, ly] of [[1, 3], [0, 4], [-1, 5], [-2, 5]]) b.set(lx, ly, lz, wool);
    }
    b.set(0, 3, 0, 'lantern[hanging=true]');
  });
}

function stalls(b) {
  b.phase('Marktstände');
  for (const s of STALLS) {
    b.step();
    stall(b, s);
  }
}

function bench(b, x, z, facing) {
  b.transform({ offset: [x, 1, z], rotate: ROTATE[facing] }, () => {
    for (let lx = -1; lx <= 1; lx++) b.set(lx, 0, 0, 'spruce_stairs[facing=south,half=bottom]');
    b.set(-2, 0, 0, 'spruce_trapdoor[facing=west,half=bottom,open=true]');
    b.set(2, 0, 0, 'spruce_trapdoor[facing=east,half=bottom,open=true]');
  });
}

const LAMPS = [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, -12], [-12, 0], [12, 0], [-4, 13], [4, 13], [-9, -9], [9, -9], [-9, 9], [9, 9]];

function benchesAndLamps(b) {
  b.phase('Bänke und Laternen');
  b.step();
  bench(b, 0, 7, 'south');
  bench(b, 0, -7, 'north');
  bench(b, -7, 0, 'west');
  bench(b, 7, 0, 'east');
  b.step();
  b.fill(-6, 1, 10, -6, 3, 10, 'dark_oak_log[axis=y]');
  b.fill(-6, 1, 12, -6, 3, 12, 'dark_oak_log[axis=y]');
  b.fill(-6, 2, 11, -6, 3, 11, 'spruce_planks');
  b.fill(-6, 4, 10, -6, 4, 12, 'spruce_slab[type=bottom]');
  b.set(-5, 3, 11, 'spruce_wall_sign[facing=east]');
  for (const [x, y, z] of [[6, 1, 10], [7, 1, 10], [6, 2, 10]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(7, 1, 11, 'hay_block[axis=y]');
  b.set(7, 2, 11, 'pumpkin');
  b.step();
  for (const [x, z] of LAMPS) lampPost(b, { x, y: 1, z, height: 3, post: 'stone_brick_wall', base: 'chiseled_stone_bricks', style: 'top' });
  const dark = findDarkSpots(b, { x1: -R, y1: 1, z1: -R, x2: R, y2: 8, z2: R });
  if (dark.length > 0) throw new Error(`marktplatz: ${dark.length} dunkle Felder auf dem Platz, z. B. ${dark.slice(0, 3).map((p) => p.join(',')).join(' · ')}.`);
}

function surroundings(b) {
  b.phase('Pflanzinseln und Umgebung');
  b.step();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx > 0 ? R - 3 : -R + 1;
      const z = sz > 0 ? R - 3 : -R + 1;
      flowerBed(b, { x, y: 0, z, width: 3, depth: 3, facing: sz > 0 ? 'south' : 'north', palette: sx * sz > 0 ? 'rosa' : 'weiss', tall: false, seed: `${sx}${sz}` });
      tree(b, { x: x + 1, y: 1, z: z + 1, species: 'birke', size: 'klein', seed: sx * 3 + sz, roots: false });
    }
  }
  b.step();
  vegetation(b, { x: -R - 4, y: 2, z: -R - 4, width: 2 * R + 9, depth: 2 * R + 9, mix: 'wiese', density: 0.25, shape: 'eckig', seed: 5 });
}

export default function build(b) {
  plaza(b);
  fountain(b);
  stalls(b);
  benchesAndLamps(b);
  surroundings(b);
}
