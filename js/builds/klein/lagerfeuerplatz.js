// Lagerfeuerplatz – Lagerfeuer im Kreis aus Steinstufen, drei Sitzstämme, Zelt aus Wolle mit Vordach,
// Holzstapel mit Hackklotz und eine Laterne. Das Feuer steht bei (0, 2, 0), das Zelt im Norden, Eingang nach Süden.

import { terrain, vegetation, tree, bush, fixDirtPaths, isPlantId } from '../lib/natur.js';
import { stateId } from '../../core/blockstate.js';
import { lampPost } from '../lib/bauteile.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'lagerfeuerplatz',
  title: 'Lagerfeuerplatz',
  category: 'klein',
  subtitle: 'Lagerfeuer im Steinkreis mit Sitzstämmen, Wollzelt und Holzunterstand',
  tags: ['Lagerfeuer', 'Camping', 'Zelt', 'Wolle', 'Deko', 'Natur', 'Wald', 'Laterne', 'Schnell gebaut', 'Überleben'],
  aliases: [
    'lagerfeuerplatz', 'lagerfeuer', 'lagerfeuer platz', 'feuerstelle', 'feuerplatz', 'zeltplatz', 'zeltlager', 'camp', 'camping',
    'campingplatz', 'zelt', 'wollzelt', 'zelt aus wolle', 'pfadfinderlager', 'lagerplatz', 'rastplatz',
    'campfire', 'camp fire', 'campfire site', 'campsite', 'camp site', 'tent', 'wool tent', 'fire pit',
  ],
  accuracy: 'eigenes',
  description: 'Ein gemütlicher Rastplatz für die erste Nacht oder als Deko am Waldrand. Das Lagerfeuer brennt auf einer Herdstelle aus Bruchstein in einem Kreis aus Steinstufen, drei Fichtenstämme laden zum Sitzen ein. Dahinter steht ein Zelt aus grüner Wolle mit Vordach, Bett, Fass und Laterne; daneben stehen ein kleiner Holzunterstand mit Hackklotz, eine Laterne am Pfosten und eine kleine Fichte.',
  sources: [],
  credits: null,
  tested: null,
};

const R = 8;
const GROUND_Y = 1;
const SEAT = 'spruce_log';
const RING_SLABS = ['cobblestone_slab', 'stone_slab', 'mossy_cobblestone_slab', 'andesite_slab'];
const TENT = { wool: 'green_wool', ridge: 'brown_wool', front: -4, back: -7, awning: -3 };

const SEATS = [[-3, -1, 'z'], [-3, 0, 'z'], [-3, 1, 'z'], [3, 0, 'z'], [3, 1, 'z'], [-1, 3, 'x'], [0, 3, 'x']];
const PILE = [[5, -1], [5, 0], [5, 1], [6, -1], [6, 0], [6, 1]];

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;

// Querschnitt des Zelts: welche Zelle (dx, Höhe über dem Boden) ist Dach.
function isRoof(dx, h) {
  return (h === 1 && Math.abs(dx) === 2) || (h === 2 && Math.abs(dx) === 1) || (h === 3 && dx === 0);
}


// Bewuchs nur auf Gras: Pflanzen, die vegetation() auf grobe Erde gesetzt hat, wieder entfernen (auch obere Hälften).
function clearPlantsOffGrass(b, { x1, z1, x2, z2, y }) {
  let removed = 0;
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) {
      const id = stateId(b.get(x, y, z));
      if (id === 'air' || !isPlantId(id) || stateId(b.get(x, y - 1, z)) === 'grass_block') continue;
      for (let k = 0; k < 2 && isPlantId(stateId(b.get(x, y + k, z))); k++) b.remove(x, y + k, z);
      removed++;
    }
  }
  return removed;
}

export default function build(b) {
  const y = GROUND_Y + 1;

  // --- Bauplatz ---
  b.phase('Bauplatz');
  const ground = terrain(b, { x: -R, y: 0, z: -R, width: 2 * R + 1, depth: 2 * R + 1, height: GROUND_Y, shape: 'rund', seed: 6 });
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      const d = Math.hypot(x, z);
      if (d > 3.1 || ground.top(x, z) !== GROUND_Y) continue;
      const v = rand01(x, 0, z, 3);
      b.set(x, GROUND_Y, z, v < 0.35 ? 'coarse_dirt' : v < 0.55 ? 'gravel' : v < 0.85 ? 'dirt_path' : 'grass_block');
    }
  }
  for (let z = TENT.front; z <= -2; z++) b.set(0, GROUND_Y, z, 'dirt_path');
  for (const x of [-1, 1]) b.set(x, GROUND_Y, TENT.awning, 'dirt_path');
  // Unter Sitzstämmen, Holzstapel und Hackklotz liegt grobe Erde.
  for (const [x, z] of [...SEATS.map(([sx, sz]) => [sx, sz]), ...PILE, [4, 3]]) b.set(x, GROUND_Y, z, 'coarse_dirt');
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      b.set(dx, GROUND_Y, dz, dx === 0 && dz === 0 ? 'cobblestone' : hashPosition(dx, 1, dz, 4) % 2 ? 'cobblestone' : 'stone');
    }
  }

  // --- Feuerstelle ---
  b.phase('Feuerstelle');
  b.step();
  b.set(0, y, 0, 'campfire[facing=south,lit=true,signal_fire=false]');
  b.step();
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      b.slab(dx, y, dz, RING_SLABS[hashPosition(dx, 2, dz, 5) % RING_SLABS.length], { type: 'bottom' });
    }
  }

  // --- Sitzstämme ---
  b.phase('Sitzstämme');
  for (const [x, z, axis] of SEATS) b.set(x, y, z, `${SEAT}[axis=${axis}]`);

  // --- Zelt ---
  b.phase('Zelt');
  for (let z = TENT.back; z <= TENT.awning; z++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let h = 1; h <= 3; h++) {
        if (isRoof(dx, h)) b.set(dx, GROUND_Y + h, z, h === 3 ? TENT.ridge : TENT.wool);
        else if (z === TENT.back && Math.abs(dx) <= 2 - h + 1 && h < 3) b.set(dx, GROUND_Y + h, z, TENT.wool);
        else if (z === TENT.front && h === 1 && Math.abs(dx) === 1) b.set(dx, GROUND_Y + h, z, TENT.wool);
      }
    }
  }
  // Firststange: je ein Zaun vor und hinter dem First, er verbindet sich mit der Wolle.
  b.set(0, GROUND_Y + 3, TENT.awning + 1, 'spruce_fence');
  b.set(0, GROUND_Y + 3, TENT.back - 1, 'spruce_fence');

  b.phase('Einrichtung im Zelt');
  b.bed(-1, y, TENT.front - 1, 'red_bed', { facing: 'north' });
  b.set(1, y, TENT.back + 1, 'barrel[facing=up,open=false]');
  b.set(1, y, TENT.front - 1, 'lantern[hanging=false]');
  for (let z = TENT.back + 1; z <= TENT.front - 1; z++) b.set(0, y, z, 'brown_carpet');

  // --- Holzstapel und Laterne ---
  b.phase('Holzstapel und Laterne');
  b.step();
  for (const [x, z] of PILE) {
    for (const h of [0, 1]) b.set(x, y + h, z, 'spruce_log[axis=x]');
  }
  for (const x of [5, 6]) {
    for (const z of [-2, 2]) for (const h of [0, 1]) b.set(x, y + h, z, 'spruce_fence');
  }
  b.step();
  for (const x of [5, 6]) for (let z = -2; z <= 2; z++) b.slab(x, y + 2, z, 'spruce_slab', { type: 'bottom' });
  b.step();
  b.set(4, y, 3, 'stripped_oak_log[axis=y]');
  b.step();
  lampPost(b, { x: -3, y, z: -3, height: 2, post: 'spruce_fence' });

  // --- Umgebung ---
  b.phase('Waldrand');
  b.step();
  tree(b, { x: -5, y, z: 4, species: 'fichte', size: 'klein', seed: 5 });
  bush(b, { x: 6, y, z: 4, size: 'klein', leaves: 'fichte', seed: 2 });
  for (const [x, z] of [[-6, -2], [3, 6]]) {
    if (ground.top(x, z) !== GROUND_Y || b.get(x, y, z) !== 'air') throw new Error(`Lagerfeuerplatz: kein Platz für Süßbeeren bei ${x}, ${z}.`);
    b.set(x, y, z, 'sweet_berry_bush[age=3]');
  }
  b.step();
  vegetation(b, { x: -R, y, z: -R, width: 2 * R + 1, depth: 2 * R + 1, mix: 'farn', density: 0.3, seed: 4 });
  clearPlantsOffGrass(b, { x1: -R, z1: -R, x2: R, z2: R, y });
  fixDirtPaths(b, { x1: -R, y1: 0, z1: -R, x2: R, y2: y + 4, z2: R });
}
