// Parkbank mit Blumenbeet: Bank aus Treppen mit Falltür-Lehne und Schild-Armlehnen, dahinter ein Hochbeet,
// daneben eine Laterne, davor ein Kiesweg. Bank bei x = −1 … 1, z = 0 (Blick nach Süden); Wiese auf y = 0.

import { WOOD, lampPost, terrain, flowerBed, path, fixDirtPaths, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'parkbank-blumenbeet',
  title: 'Parkbank mit Blumenbeet',
  category: 'klein',
  subtitle: 'Sitzbank mit Lehne und Armlehnen vor einem Hochbeet, mit Laterne und Kiesweg',
  tags: ['Bank', 'Parkbank', 'Blumenbeet', 'Hochbeet', 'Park', 'Garten', 'Deko', 'Sitzplatz', 'Klein', 'Anfänger'],
  aliases: [
    'parkbank', 'bank', 'sitzbank', 'gartenbank', 'holzbank', 'park bank', 'blumenbeet', 'hochbeet', 'beet',
    'bench', 'park bench', 'garden bench', 'flower bed', 'flowerbed', 'sitzecke', 'parkbankk', 'parkbnak',
  ],
  accuracy: 'eigenes',
  description: 'Eine gemütliche Parkbank aus Schwarzeichentreppen mit hoher Lehne aus offenen Falltüren und Armlehnen aus Wandschildern. Dahinter wächst ein Hochbeet mit Fichtenrahmen und bunten Blumen, daneben stehen eine Laterne und ein Mülleimer, davor führt ein Kiesweg vorbei. In wenigen Minuten gebaut und überall im Dorf oder Park einsetzbar.',
  sources: [],
  credits: null,
  tested: null,
};

const dark = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const BED = { x0: -4, x1: 4, z0: -5, z1: -1 };

function ground(b) {
  const { x0, x1, z0, z1 } = BED;
  b.phase('Wiese');
  terrain(b, { x: -8, y: -1, z: -9, width: 17, depth: 16, height: 1, shape: 'rund', seed: 'parkbank' });
  b.fill(x0, 0, z0, x1, 0, z1, 'dirt');
}

function flowerBox(b) {
  const { x0, x1, z0, z1 } = BED;
  b.phase('Hochbeet');
  b.step();
  for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) b.set(x, 1, z, `${spruce.log}[axis=x]`);
  for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) b.set(x, 1, z, `${spruce.log}[axis=z]`);
  for (const x of [x0, x1]) for (const z of [z0, z1]) b.set(x, 1, z, `${spruce.wood}[axis=y]`);

  b.step();
  flowerBed(b, { x: x0 + 1, y: 1, z: z0 + 1, width: x1 - x0 - 1, depth: z1 - z0 - 1, facing: 'south', palette: 'bunt', density: 0.9, seed: 3 });
}

function bench(b) {
  b.phase('Parkbank');
  b.step();
  for (let x = -1; x <= 1; x++) b.stairs(x, 1, 0, dark.stairs, { facing: 'north' });

  b.step();
  for (let x = -1; x <= 1; x++) b.set(x, 2, 0, `${dark.trapdoor}[facing=south,half=bottom,open=true]`);

  b.step();
  b.set(-2, 1, 0, `${dark.wallSign}[facing=west]`);
  b.set(2, 1, 0, `${dark.wallSign}[facing=east]`);
}

function extras(b) {
  b.phase('Laterne und Mülleimer');
  b.step();
  lampPost(b, { x: 4, y: 1, z: 0, facing: 'west', height: 4, post: dark.fence, base: 'stone_bricks', style: 'arm' });

  b.step();
  b.set(-3, 1, 0, 'cauldron');
}

function surroundings(b) {
  b.phase('Weg und Grün');
  b.step();
  path(b, { x: -6, y: 0, z: 2, facing: 'east', length: 13, width: 3, mix: 'kies', wiggle: 0.6, seed: 4 });

  b.step();
  tree(b, { x: -6, y: 1, z: -6, species: 'eiche', size: 'klein', seed: 2 });
  bush(b, { x: 6, y: 1, z: -3, size: 'klein', leaves: 'azalee', seed: 5 });
  bush(b, { x: 6, y: 1, z: -6, size: 'klein', leaves: 'birke', seed: 6 });
  vegetation(b, { x: -8, y: 0, z: -9, width: 17, depth: 16, mix: 'wiese', density: 0.3, seed: 7 });
  fixDirtPaths(b, { x1: -8, y1: 0, z1: -9, x2: 8, y2: 0, z2: 6 });
}

export default function build(b) {
  ground(b);
  flowerBox(b);
  bench(b);
  extras(b);
  surroundings(b);
}
