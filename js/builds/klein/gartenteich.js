// Gartenteich mit Brücke – erdnussförmiger Teich aus zwei Becken mit schmaler Mitte, Ufersteinen, Seerosen,
// Schilf (Zuckerrohr) und Seegras; darüber eine kleine Bogenbrücke aus Fichtenholz mit Laternen auf den Endpfosten.
// Wasserspiegel auf y = 3 (Oberkante des Rasens), die Brücke läuft bei x = −1 … 1 von Norden nach Süden.

import { terrain, vegetation, tree, bush, rock, path } from '../lib/natur.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'gartenteich',
  title: 'Gartenteich mit Brücke',
  category: 'klein',
  subtitle: 'Teich mit Ufersteinen, Seerosen, Schilf und kleiner Holzbrücke',
  tags: ['Teich', 'Garten', 'Brücke', 'Wasser', 'Seerosen', 'Zuckerrohr', 'Deko', 'Natur', 'Laterne', 'Landschaft'],
  aliases: [
    'gartenteich', 'garten teich', 'teich', 'teich mit brücke', 'teich mit bruecke', 'teich brücke', 'fischteich', 'seerosenteich',
    'holzbrücke', 'holzbruecke', 'kleine brücke', 'gartenbrücke', 'bogenbrücke', 'japanischer garten', 'koi teich', 'koiteich',
    'garden pond', 'pond', 'pond with bridge', 'garden bridge', 'wooden bridge', 'small bridge', 'lily pond', 'koi pond',
  ],
  accuracy: 'eigenes',
  description: 'Ein Gartenteich aus zwei Becken, die sich in der Mitte zu einer schmalen Stelle verengen. Dort führt eine kleine Bogenbrücke aus Fichtenholz mit Schwarzeichen-Geländer hinüber, auf ihren Endpfosten stehen Laternen. Am Ufer liegen bemooste Steine, im Wasser schwimmen Seerosenblätter, an den Enden wächst Schilf aus Zuckerrohr, und am Grund wiegt sich Seegras. Kieswege, eine Birke und Wiesenblumen machen den Garten fertig.',
  sources: [],
  credits: null,
  tested: null,
};

const W = { x1: -15, x2: 14, z1: -10, z2: 10 };
const WATER_Y = 3;
const WATER = 'water[level=0]';
const SEDIMENT = [['sand', 5], ['gravel', 3], ['clay', 2]];
const SHORE_STONES = [['mossy_cobblestone', 4], ['cobblestone', 3], ['stone', 3], ['andesite', 3], ['tuff', 1]];
const BOULDERS = ['mossy_cobblestone', 'stone', 'andesite', 'mossy_cobblestone_slab[type=bottom]', 'stone_slab[type=bottom]', 'cobblestone_slab[type=bottom]'];
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;
const key = (x, z) => `${x},${z}`;

function pickWeighted(entries, r) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let v = r * total;
  for (const [id, w] of entries) {
    if (v < w) return id;
    v -= w;
  }
  return entries[entries.length - 1][0];
}

// Halbe Breite des Teichs (in z) je Spalte x: zwei Becken, in der Mitte (|x| ≤ 1) genau 5 Blöcke breit.
function halfWidth(x) {
  const lobe = (cx, rx, rz) => (Math.abs(x - cx) < rx ? rz * (1 - ((x - cx) / rx) ** 2) ** 0.75 : 0);
  let w = Math.max(lobe(-6.6, 6.4, 4.8), lobe(6.2, 5.8, 4.2));
  if (Math.abs(x) <= 1) w = 2.5;
  else if (Math.abs(x) <= 7) w = Math.min(Math.max(w, 2.5), 2.5 + (Math.abs(x) - 1) * 0.28);
  return w;
}

// Weiches Rauschen entlang x (−1 … 1), getrennt für Nord- und Südufer.
function edgeNoise(x, salt) {
  const f = x / 3;
  const i = Math.floor(f);
  const t = (f - i) * (f - i) * (3 - 2 * (f - i));
  const a = rand01(i, 0, 0, salt) * 2 - 1;
  const c = rand01(i + 1, 0, 0, salt) * 2 - 1;
  return a + (c - a) * t;
}

function centerLine(x) {
  return x > 3 ? 0.6 : x < -3 ? -0.3 : 0;
}

function planPond() {
  const cells = new Map();
  for (let x = -13; x <= 12; x++) {
    const w = halfWidth(x);
    if (w <= 0) continue;
    const fade = Math.min(1, Math.max(0, (Math.abs(x) - 2) / 3));
    const north = centerLine(x) - w - edgeNoise(x, 3) * 0.9 * fade;
    const south = centerLine(x) + w + edgeNoise(x, 4) * 0.9 * fade;
    for (let z = -7; z <= 7; z++) {
      if (z < north || z > south) continue;
      const edge = Math.min(z - north, south - z);
      cells.set(key(x, z), { x, z, deep: w >= 3 && edge >= 1.7 });
    }
  }
  return cells;
}

// Kies in der untersten Geländeschicht hätte Luft unter sich und würde fallen: dort Stein setzen.
function anchorGravel(b, { x1, x2, z1, z2, y }) {
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) if (b.get(x, y, z) === 'gravel' && b.get(x, y - 1, z) === 'air') b.set(x, y, z, 'stone');
  }
}

function isBridgeZone(x, z) {
  return Math.abs(x) <= 2 && Math.abs(z) <= 5;
}

export default function build(b) {
  const pond = planPond();
  const isWater = (x, z) => pond.has(key(x, z));

  // Ufer: Zellen an Land, die direkt an Wasser grenzen.
  const shore = [];
  for (let x = W.x1 + 1; x <= W.x2 - 1; x++) {
    for (let z = W.z1 + 1; z <= W.z2 - 1; z++) {
      if (isWater(x, z) || !DIRS4.some(([dx, dz]) => isWater(x + dx, z + dz))) continue;
      shore.push([x, z]);
    }
  }
  const reedSpots = [[-12, 0], [-10, -3], [12, 1], [8, 3], [-6, 4]];
  const isReedShore = (x, z) => reedSpots.some(([rx, rz]) => Math.hypot(x - rx, z - rz) <= 1.6);
  const stones = shore.filter(([x, z]) => !isBridgeZone(x, z) && !isReedShore(x, z) && rand01(x, 0, z, 11) <= 0.55);

  // --- Gelände, Mulde, Ufer und Wege ---
  b.phase('Gelände, Teichmulde und Wege');
  terrain(b, { x: W.x1, y: 0, z: W.z1, width: W.x2 - W.x1 + 1, depth: W.z2 - W.z1 + 1, height: WATER_Y, shape: 'rund', seed: 8 });
  anchorGravel(b, { x1: W.x1, x2: W.x2, z1: W.z1, z2: W.z2, y: 0 });
  for (const { x, z, deep } of pond.values()) {
    for (let y = deep ? WATER_Y - 2 : WATER_Y - 1; y <= WATER_Y; y++) b.remove(x, y, z);
  }
  for (const [x, z] of stones) b.set(x, WATER_Y, z, pickWeighted(SHORE_STONES, rand01(x, 1, z, 12)));
  path(b, { x: 0, y: WATER_Y, z: 5, facing: 'south', length: 6, width: 3, mix: 'kies', wiggle: 0.6, seed: 2 });
  path(b, { x: 0, y: WATER_Y, z: -5, facing: 'north', length: 6, width: 3, mix: 'kies', wiggle: 0.6, seed: 3 });

  // --- Grund und Findlinge ---
  b.phase('Teichgrund und Findlinge');
  b.step();
  for (const { x, z, deep } of pond.values()) {
    const y = deep ? WATER_Y - 2 : WATER_Y - 1;
    b.set(x, y, z, pickWeighted(SEDIMENT, rand01(Math.floor(x / 2), y, Math.floor(z / 2), 5)));
  }
  b.step();
  for (const [x, z] of stones) {
    if (rand01(x, 2, z, 13) > 0.3) continue;
    b.set(x, WATER_Y + 1, z, BOULDERS[hashPosition(x, 3, z, 14) % BOULDERS.length]);
  }

  // --- Wasser ---
  b.phase('Wasser');
  let seagrass = 0;
  for (const { x, z, deep } of pond.values()) {
    for (let y = deep ? WATER_Y - 1 : WATER_Y; y <= WATER_Y; y++) {
      const grass = deep && y === WATER_Y - 1 && rand01(x, y, z, 21) < 0.3;
      b.set(x, y, z, grass ? 'seagrass' : WATER);
      if (grass) seagrass++;
    }
  }
  if (seagrass === 0) throw new Error('Gartenteich: kein Seegras gesetzt.');

  // --- Brücke ---
  b.phase('Brücke');
  const P = 'spruce_planks';
  const ST = 'spruce_stairs';
  const POST = 'stripped_dark_oak_log[axis=y]';
  const FENCE = 'dark_oak_fence';
  b.step();
  for (const sz of [-1, 1]) {
    for (const x of [-1, 0, 1]) b.set(x, 4, 3 * sz, P);
    for (const x of [-1, 1]) {
      b.set(x, 4, 4 * sz, POST);
      b.set(x, 5, 4 * sz, POST);
    }
    b.stairs(0, 4, 4 * sz, ST, { facing: sz < 0 ? 'south' : 'north' });
  }
  b.step();
  for (const sz of [-1, 1]) for (const x of [-1, 0, 1]) b.stairs(x, 4, 2 * sz, ST, { facing: sz < 0 ? 'north' : 'south', half: 'top' });
  b.step();
  for (let z = -2; z <= 2; z++) {
    for (const x of [-1, 0, 1]) {
      if (x === 0 && Math.abs(z) === 2) b.stairs(0, 5, z, ST, { facing: z < 0 ? 'south' : 'north' });
      else b.set(x, 5, z, P);
    }
  }
  b.step();
  for (const x of [-1, 1]) {
    for (let z = -3; z <= 3; z++) {
      if (Math.abs(z) === 3) {
        b.set(x, 5, z, FENCE);
        b.set(x, 6, z, FENCE);
      } else b.set(x, 6, z, FENCE);
    }
  }
  b.set(1, 6, 4, 'lantern[hanging=false]');
  b.set(-1, 6, -4, 'lantern[hanging=false]');

  // --- Pflanzen und Wege ---
  b.phase('Seerosen, Schilf und Garten');
  b.step();
  let lilies = 0;
  for (const { x, z } of pond.values()) {
    if (Math.abs(x) <= 2 || !DIRS4.every(([dx, dz]) => isWater(x + dx, z + dz))) continue;
    const patch = rand01(Math.floor((x + 20) / 3), 0, Math.floor((z + 20) / 3), 31);
    if (patch < 0.55 || rand01(x, 4, z, 32) > 0.45) continue;
    b.set(x, WATER_Y + 1, z, 'lily_pad');
    lilies++;
  }
  if (lilies === 0) throw new Error('Gartenteich: keine Seerosen gesetzt.');
  b.step();
  let reeds = 0;
  for (const [x, z] of shore) {
    if (!isReedShore(x, z) || isBridgeZone(x, z) || b.get(x, WATER_Y + 1, z) !== 'air') continue;
    if (rand01(x, 5, z, 41) > 0.75) continue;
    const height = 1 + (hashPosition(x, 6, z, 42) % 3);
    for (let k = 1; k <= height; k++) b.set(x, WATER_Y + k, z, 'sugar_cane');
    reeds++;
  }
  if (reeds === 0) throw new Error('Gartenteich: kein Zuckerrohr gesetzt.');
  b.step();
  tree(b, { x: 9, y: WATER_Y + 1, z: -6, species: 'birke', size: 'mittel', seed: 4 });
  bush(b, { x: -10, y: WATER_Y + 1, z: 6, size: 'mittel', leaves: 'eiche', seed: 1 });
  rock(b, { x: -9, y: WATER_Y + 1, z: -7, size: 'mittel', material: 'stein', sink: 0, rubble: true, seed: 3 });
  b.step();
  vegetation(b, { x: W.x1, y: WATER_Y + 1, z: W.z1, width: W.x2 - W.x1 + 1, depth: W.z2 - W.z1 + 1, mix: 'blumen', density: 0.3, shape: 'eckig', seed: 5 });
}
