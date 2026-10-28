// Wasser-Aufzug: zwei Glasschächte nebeneinander. Links Seelensand → Blasensäule nach oben,
// rechts Magmablock → Blasensäule nach unten. Oben eine überdachte Plattform als Ausstieg.
// Lokale Koordinaten: Wiese bis y = 0, Aufwärts-Schacht (0, 1…14, 0), Abwärts-Schacht (2, 1…14, 0),
// Türen im Süden (z = 1). Vorderseite = Süden.

import { WOOD, terrain, path, flowerBed, bush, vegetation, wallLantern, hangingLantern } from '../lib/index.js';

export const meta = {
  id: 'wasser-aufzug',
  title: 'Wasser-Aufzug',
  category: 'farmen',
  subtitle: 'Blasensäulen hoch und runter im Glasschacht',
  tags: ['Aufzug', 'Wasser', 'Blasensäule', 'Seelensand', 'Magmablock', 'Technik', 'Anfänger', 'Ohne Redstone'],
  aliases: [
    'wasser-aufzug', 'wasseraufzug', 'wasser aufzug', 'wasserlift', 'wasser lift', 'blasenaufzug', 'blasensäule',
    'blasensaeule', 'seelensand aufzug', 'magma aufzug', 'aufzug', 'fahrstuhl', 'wasserfahrstuhl', 'water elevator',
    'bubble elevator', 'bubble column elevator', 'soul sand elevator', 'elevator', 'wasseraufzg', 'wasser auf zug',
  ],
  accuracy: 'vorlage',
  description: 'Zwei Glasschächte voller Wasserquellen: Unter dem linken liegt Seelensand, er macht eine Blasensäule, die dich nach oben trägt. Unter dem rechten liegt ein Magmablock, seine Blasensäule zieht dich schnell nach unten. Unten gehst du durch eine Tür hinein, oben steigst du auf eine kleine, überdachte Plattform aus. Das Wichtigste ist, dass jeder Schacht von unten bis oben aus Wasserquellen besteht – die Anleitung zeigt, wie das mit Seetang ganz einfach geht.',
  sources: [
    { title: 'Minecraft Wiki: Blasensäule (englisch)', url: 'https://minecraft.wiki/w/Bubble_Column' },
    { title: 'Minecraft Wiki: Seetang (englisch)', url: 'https://minecraft.wiki/w/Kelp' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const TOP = 14; // oberste Wasserquelle = Höhe der Plattform
const HEIGHT = 16; // oberste Wandebene
const UP_X = 0;
const DOWN_X = 2;
const WATER = 'water[level=0]';
const BASE = 'polished_andesite';
const TRIM = 'stone_bricks';
const BANDS = [6, 11];

const POSTS = [[-1, -1], [3, -1], [-1, 1], [3, 1]];
// Glas: Seiten und Trennwand (x = −1, 1, 3 bei z = 0) und Rückseite (z = −1); die Vorderseite hat Türen und Ausstieg.
const SIDE_GLASS = [[-1, 0], [1, 0], [3, 0]];
const BACK_GLASS = [[UP_X, -1], [1, -1], [DOWN_X, -1]];

function wallBlock(y, axis) {
  return BANDS.includes(y) ? `${spruce.strippedLog}[axis=${axis}]` : 'glass';
}

function foundation(b) {
  b.phase('Fundament');
  terrain(b, { x: -7, y: -1, z: -6, width: 17, depth: 17, height: 1, seed: 'wasser-aufzug' });
  b.step();
  for (let x = -2; x <= 4; x++) {
    for (let z = -2; z <= 2; z++) {
      const edge = x === -2 || x === 4 || z === -2 || z === 2;
      b.set(x, 0, z, edge ? TRIM : BASE);
    }
  }
  b.step();
  b.set(UP_X, 0, 0, 'soul_sand');
  b.set(DOWN_X, 0, 0, TRIM);
}

function shafts(b) {
  b.phase('Glasschächte');
  b.step();
  for (const [x, z] of POSTS) for (let y = 1; y <= HEIGHT; y++) b.set(x, y, z, `${spruce.log}[axis=y]`);

  b.step();
  for (let y = 1; y <= HEIGHT; y++) {
    for (const [x, z] of SIDE_GLASS) b.set(x, y, z, wallBlock(y, 'z'));
    for (const [x, z] of BACK_GLASS) b.set(x, y, z, wallBlock(y, 'x'));
  }

  b.step();
  b.set(1, 1, 1, 'glass');
  b.set(1, 2, 1, 'glass');
  for (const x of [UP_X, 1, DOWN_X]) {
    b.set(x, 3, 1, `${spruce.strippedLog}[axis=x]`);
    for (let y = 4; y < TOP; y++) b.set(x, y, 1, wallBlock(y, 'x'));
  }
  for (let y = TOP + 1; y <= HEIGHT; y++) b.set(1, y, 1, 'glass');
}

function landing(b) {
  b.phase('Plattform und Dach');
  b.step();
  for (const x of [UP_X, 1, DOWN_X]) b.set(x, TOP, 1, spruce.planks);
  for (let x = -1; x <= 3; x++) for (const z of [2, 3]) b.set(x, TOP, z, spruce.planks);

  b.step();
  for (let x = -1; x <= 3; x++) b.stairs(x, TOP - 1, 2, spruce.stairs, { facing: 'north', half: 'top' });

  b.step();
  for (const x of [-1, 3]) for (let y = TOP + 1; y <= HEIGHT; y++) b.set(x, y, 3, `${spruce.log}[axis=y]`);
  for (let x = 0; x <= 2; x++) b.set(x, TOP + 1, 3, spruce.fence);
  for (const x of [-1, 3]) b.set(x, TOP + 1, 2, spruce.fence);

  b.step();
  b.roof({ x1: -1, z1: -1, x2: 3, z2: 3, y: HEIGHT, type: 'pyramid', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
}

function doors(b) {
  b.phase('Türen');
  b.step();
  b.door(UP_X, 1, 1, spruce.door, { facing: 'north', hinge: 'left' });
  b.door(DOWN_X, 1, 1, spruce.door, { facing: 'north', hinge: 'right' });
}

function water(b) {
  b.phase('Wasser einfüllen');
  b.step();
  for (let y = 1; y <= TOP; y++) b.set(UP_X, y, 0, WATER);
  b.step();
  for (let y = 1; y <= TOP; y++) b.set(DOWN_X, y, 0, WATER);
  b.set(DOWN_X, 0, 0, 'magma_block');
}

function surroundings(b) {
  b.phase('Licht und Umgebung');
  b.step();
  wallLantern(b, { x: -1, y: 2, z: 1, facing: 'south', arm: spruce.fence });
  wallLantern(b, { x: 3, y: 2, z: 1, facing: 'south', arm: spruce.fence });
  hangingLantern(b, { x: 1, y: HEIGHT + 1, z: 2, chain: 0 });

  b.step();
  path(b, { x: 1, y: 0, z: 3, facing: 'south', length: 7, width: 3, mix: 'erde', wiggle: 0.5, seed: 4 });
  flowerBed(b, { x: -5, y: 0, z: -2, width: 2, depth: 5, facing: 'west', palette: 'kuehl', seed: 2 });
  flowerBed(b, { x: 6, y: 0, z: -2, width: 2, depth: 5, facing: 'east', palette: 'kuehl', seed: 3 });
  bush(b, { x: -4, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 1 });
  bush(b, { x: 6, y: 1, z: -4, size: 'klein', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: -7, y: 0, z: -6, width: 17, depth: 17, mix: 'wiese', density: 0.3, seed: 9 });
}

export default function build(b) {
  foundation(b);
  shafts(b);
  landing(b);
  doors(b);
  water(b);
  surroundings(b);
}
