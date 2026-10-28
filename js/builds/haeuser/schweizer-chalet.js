// Schweizer Chalet: Steinsockel-Geschoss, darüber Blockbau aus liegenden Fichtenstämmen, flaches Satteldach mit großem
// Überstand und ein Balkon, der vorne und an beiden Seiten ums Obergeschoss läuft.
// Bau-Rahmen: Haus x 0 … 10, z 0 … 8, Giebel und Eingang im Süden (+z). Fußboden EG y = 0, Gelände y = −1.
// Höhen: EG-Steinwände y 1 … 4, OG-Boden und Balkon y 5, Blockwände y 6 … 9, Dach aus Stufen von y 8 (Traufe) bis y 12.

import {
  WOOD, window, doorway, brace, hangingLantern, wallLantern, lightRoom, straightStairs, kitchen, bedroom, diningTable, floorPattern,
  storage, tree, bush, rock, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'schweizer-chalet',
  title: 'Schweizer Chalet',
  category: 'haeuser',
  subtitle: 'Alpines Holzhaus mit Steinsockel, Balkon voller Geranien und flachem Dach',
  tags: ['Chalet', 'Schweiz', 'Alpen', 'Berghaus', 'Holzhaus', 'Blockbau', 'Balkon', 'Blumenkästen', 'Satteldach', 'Fichte', 'Kachelofen', 'Eingerichtet', 'Brunnen'],
  aliases: [
    'chalet', 'schweizerhaus', 'schweizer haus', 'schweizer holzhaus', 'alpenhaus', 'alpen haus', 'berghütte', 'berghuette', 'skihütte',
    'almhütte', 'chalett', 'schalee', 'swiss chalet', 'alpine house', 'mountain chalet', 'ski chalet', 'alpine chalet', 'chalet suisse',
  ],
  accuracy: 'nachempfunden',
  description: 'Ein Chalet wie in den Schweizer Alpen: unten ein Geschoss aus Bruchstein, darüber ein Blockbau aus liegenden geschälten Fichtenstämmen unter einem flachen Satteldach mit weitem Überstand. Vorne und an beiden Seiten läuft ein Holzbalkon mit roten Blumen in Kästen ums Obergeschoss. Innen gibt es eine Stube mit grünem Kachelofen und Ofenbank, eine Küche und oben ein Schlafzimmer; vor dem Haus stehen eine Bank, ein Holzstapel und ein Brunnentrog.',
  sources: [
    { title: 'Wikipedia: Chalet', url: 'https://de.wikipedia.org/wiki/Chalet' },
  ],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;
const WALL_LOG = spruce.strippedLog;
const ROOF_SLAB = dark.slab;
const X0 = 0;
const X1 = 10;
const Z0 = 0;
const Z1 = 8;
const RIDGE_X = 5;
const ROOF = { x1: -4, x2: 14, z1: -2, z2: 12, eave: 8 };

// Dachstufe für die Spalte x: Reihe k ab der Traufe, gerade = untere Stufe, ungerade = obere Stufe eine Hälfte höher.
const roofRow = (x) => Math.min(x - ROOF.x1, ROOF.x2 - x);
const roofCell = (x) => {
  const k = roofRow(x);
  return { y: ROOF.eave + Math.floor(k / 2), type: k % 2 === 0 ? 'bottom' : 'top' };
};

function stoneMix(b, x, y, z) {
  const corner = (x === X0 || x === X1) && (z === Z0 || z === Z1);
  if (corner) b.set(x, y, z, y % 2 === 0 ? 'stone_bricks' : 'polished_andesite');
  else b.set(x, y, z, b.pickWeighted([['cobblestone', 4], ['stone', 3], ['andesite', 2], [y <= 1 ? 'mossy_cobblestone' : 'cobblestone', 2]]));
}

function site(b) {
  b.phase('Bauplatz');
  b.step();
  b.fill(-10, -1, -7, 20, -1, 20, 'grass_block');
  b.fill(X0, -1, Z0, X1, -1, Z1, 'dirt');
  // Steinboden des Brunnentrogs gleich mit der Wiese, sonst klafft dort bis zum Trog ein Loch.
  b.fill(13, -1, 12, 17, -1, 14, 'stone');
  b.step();
  floorPattern(b, { x: RIDGE_X - 1, y: -1, z: 10, width: 3, depth: 11, pattern: 'random', blocks: [['dirt_path', 6], ['coarse_dirt', 1]] });
}

function groundFloor(b) {
  b.phase('Steinsockel');
  b.step();
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) if (x === X0 || x === X1 || z === Z0 || z === Z1) b.set(x, 0, z, 'cobblestone');
  b.fill(1, 0, 1, 5, 0, 7, spruce.planks);
  b.fill(6, 0, 1, 9, 0, 7, 'polished_andesite');
  b.step();
  for (let y = 1; y <= 4; y++) {
    for (let x = X0; x <= X1; x++) { stoneMix(b, x, y, Z0); stoneMix(b, x, y, Z1); }
    for (let z = Z0 + 1; z < Z1; z++) { stoneMix(b, X0, y, z); stoneMix(b, X1, y, z); }
  }
  b.step();
  b.fill(6, 1, 1, 6, 4, 7, spruce.planks);
  b.door(6, 1, 4, spruce.door, { facing: 'east', hinge: 'left' });
}

function balconyAndFloor(b) {
  b.phase('Decke und Balkon');
  b.step();
  b.fill(X0 - 2, 5, Z0, X1 + 2, 5, Z1 + 2, spruce.planks);
  for (let z = 4; z <= 6; z++) b.set(1, 5, z, 'air');
  b.step();
  for (const z of [1, 4, 7]) {
    brace(b, { x: X0, y: 4, z, facing: 'west', length: 2, stairs: spruce.stairs });
    brace(b, { x: X1, y: 4, z, facing: 'east', length: 2, stairs: spruce.stairs });
  }
  for (const x of [X0, RIDGE_X, X1]) brace(b, { x, y: 4, z: Z1, facing: 'south', length: 2, stairs: spruce.stairs });
}

// Balkongeländer: Zaunpfosten an Ecken und Enden, dazwischen Blumenkästen (Wurzelerde, außen Falltüren, rote Blumen).
const RED_FLOWERS = ['poppy', 'red_tulip', 'poppy', 'rose_bush'];
function railingCell(b, x, z, outward, i, box) {
  if (!box) { b.set(x, 6, z, spruce.fence); return; }
  b.set(x, 6, z, 'rooted_dirt');
  const [dx, dz] = { south: [0, 1], west: [-1, 0], east: [1, 0] }[outward];
  b.set(x + dx, 6, z + dz, `${spruce.trapdoor}[facing=${outward},half=bottom,open=true]`);
  const flower = RED_FLOWERS[((i % RED_FLOWERS.length) + RED_FLOWERS.length) % RED_FLOWERS.length];
  if (flower === 'rose_bush') b.tall(x, 7, z, flower);
  else b.set(x, 7, z, flower);
}

function railing(b) {
  b.phase('Balkongeländer');
  b.step();
  for (let x = X0 - 2; x <= X1 + 2; x++) {
    const post = x === X0 - 2 || x === X1 + 2 || x === RIDGE_X;
    railingCell(b, x, Z1 + 2, 'south', x, !post);
  }
  b.step();
  for (let z = Z0; z <= Z1 + 1; z++) {
    const post = z === Z0 || z === 4;
    railingCell(b, X0 - 2, z, 'west', z + 1, !post);
    railingCell(b, X1 + 2, z, 'east', z + 2, !post);
  }
  for (const x of [X0 - 1, X1 + 1]) b.set(x, 6, Z0, spruce.fence);
}

function logWalls(b) {
  b.phase('Blockbau');
  for (let y = 6; y <= 9; y++) {
    for (let x = X0 + 1; x < X1; x++) { b.set(x, y, Z0, `${WALL_LOG}[axis=x]`); b.set(x, y, Z1, `${WALL_LOG}[axis=x]`); }
    for (let z = Z0 + 1; z < Z1; z++) { b.set(X0, y, z, `${WALL_LOG}[axis=z]`); b.set(X1, y, z, `${WALL_LOG}[axis=z]`); }
    for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) b.set(x, y, z, `${WALL_LOG}[axis=${y % 2 === 0 ? 'x' : 'z'}]`);
  }
}

function roof(b) {
  b.phase('Dach');
  b.step();
  for (const z of [Z0, Z1]) {
    for (let x = X0 + 1; x < X1; x++) {
      const cell = roofCell(x);
      for (let y = 10; y < cell.y; y++) b.set(x, y, z, `${WALL_LOG}[axis=x]`);
    }
  }
  b.step();
  for (let z = ROOF.z1; z <= ROOF.z2; z++) {
    for (const x of [X0, X1]) if (z < Z0 || z > Z1) b.set(x, 9, z, `${spruce.log}[axis=z]`);
    b.set(RIDGE_X, 11, z, `${spruce.log}[axis=z]`);
  }
  b.step();
  for (let z = ROOF.z1; z <= ROOF.z2; z++) {
    for (let x = ROOF.x1; x <= ROOF.x2; x++) {
      const cell = roofCell(x);
      const overWall = (z === Z0 || z === Z1) && x > X0 && x < X1 && cell.type === 'top';
      b.slab(x, cell.y, z, ROOF_SLAB, { type: overWall ? 'double' : cell.type });
    }
  }
  b.step();
  for (const z of [ROOF.z1, ROOF.z2]) {
    const facing = z === ROOF.z2 ? 'south' : 'north';
    for (let x = ROOF.x1; x <= ROOF.x2; x++) {
      const cell = roofCell(x);
      if (cell.type === 'bottom' && x !== RIDGE_X) b.set(x, cell.y - 1, z, `${spruce.trapdoor}[facing=${facing},half=top,open=true]`);
    }
  }
}

function openings(b) {
  b.phase('Fenster und Türen');
  b.step();
  doorway(b, { x: RIDGE_X, y: 1, z: Z1, facing: 'south', door: spruce.door, frame: null, step: 'cobblestone_stairs' });
  b.step();
  for (const x of [2, 8]) window(b, { x, y: 2, z: Z1, facing: 'south', height: 2, shutters: spruce.trapdoor });
  for (const x of [3, 8]) window(b, { x, y: 2, z: Z0, facing: 'north', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  for (const z of [2, 6]) {
    window(b, { x: X0, y: 2, z, facing: 'west', height: 2, sill: 'stone_brick_stairs' });
    window(b, { x: X1, y: 2, z, facing: 'east', height: 2, sill: 'stone_brick_stairs' });
  }
  b.step();
  b.door(RIDGE_X, 6, Z1, spruce.door, { facing: 'north', hinge: 'left' });
  for (const x of [2, 8]) window(b, { x, y: 7, z: Z1, facing: 'south', width: 2, height: 2, shutters: spruce.trapdoor });
  for (const z of [2, 6]) {
    window(b, { x: X0, y: 7, z, facing: 'west', height: 2, shutters: spruce.trapdoor });
    window(b, { x: X1, y: 7, z, facing: 'east', height: 2, shutters: spruce.trapdoor });
  }
  for (const x of [3, 7]) window(b, { x, y: 7, z: Z0, facing: 'north', height: 2, shutters: spruce.trapdoor });
  b.step();
  b.set(RIDGE_X, 10, Z1, 'glass_pane');
  b.set(RIDGE_X, 10, Z0, 'glass_pane');
}

function interior(b) {
  b.phase('Einrichtung');
  b.step();
  b.fill(1, 1, 1, 2, 3, 2, 'green_terracotta');
  b.set(2, 1, 2, 'furnace[facing=south,lit=false]');
  b.fill(1, 4, 1, 2, 4, 2, 'polished_andesite_slab[type=bottom]');
  b.step();
  b.stairs(3, 1, 1, spruce.stairs, { facing: 'west' });
  b.stairs(3, 1, 2, spruce.stairs, { facing: 'west' });
  b.stairs(1, 1, 3, spruce.stairs, { facing: 'north' });
  b.step();
  diningTable(b, { x: 3, y: 1, z: 5, facing: 'south', length: 2, width: 1, wood: 'fichte', top: 'carpet', cloth: 'weiss', headChairs: false });
  b.set(5, 1, 1, 'barrel[facing=up]');
  b.set(5, 2, 1, 'potted_red_tulip');
  b.step();
  kitchen(b, { x: X1 - 1, y: 1, z: 1, facing: 'west', width: 7, wood: 'fichte', cabinets: true });
  storage(b, { x: 8, y: 1, z: 7, facing: 'north', width: 2, height: 1, chest: 'chest', barrel: false });
  b.step();
  straightStairs(b, { x: 1, y: 1, z: 7, facing: 'north', width: 1, height: 4, stairs: spruce.stairs, support: null });
  b.stairs(1, 5, 3, spruce.stairs, { facing: 'north' });
  b.step();
  bedroom(b, { x: 3, y: 6, z: 1, facing: 'south', width: 7, depth: 5, wood: 'fichte', color: 'rot', rug: 'weiss', double: true });
  b.fill(2, 6, 4, 2, 6, 6, spruce.fence);
}

function lights(b) {
  b.phase('Licht');
  hangingLantern(b, { x: 4, y: 4, z: 5, chain: 0 });
  hangingLantern(b, { x: 8, y: 4, z: 4, chain: 0 });
  hangingLantern(b, { x: RIDGE_X, y: 10, z: 4, chain: 0 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 5, y2: 4, z2: 7 });
  lightRoom(b, { x1: 7, y1: 1, z1: 1, x2: 9, y2: 4, z2: 7 });
  lightRoom(b, { x1: 1, y1: 6, z1: 1, x2: 9, y2: 9, z2: 7 });
}

function surroundings(b) {
  b.phase('Rund ums Haus');
  b.step();
  for (const x of [RIDGE_X - 1, RIDGE_X + 1]) wallLantern(b, { x, y: 2, z: Z1, facing: 'south', style: 'bracket', arm: spruce.fence });
  b.step();
  for (const x of [2, 3]) b.stairs(x, 0, Z1 + 1, spruce.stairs, { facing: 'north' });
  b.set(1, 0, Z1 + 1, `${spruce.trapdoor}[facing=west,half=bottom,open=true]`);
  b.set(4, 0, Z1 + 1, `${spruce.trapdoor}[facing=east,half=bottom,open=true]`);
  b.step();
  for (let z = 2; z <= 6; z++) for (let y = 0; y <= 2; y++) for (const x of [-2, -1]) if (!(y === 2 && (z === 2 || z === 6))) b.set(x, y, z, `${spruce.log}[axis=x]`);
  b.step();
  for (let x = 13; x <= 17; x++) for (let z = 12; z <= 14; z++) {
    const inside = x > 13 && x < 17 && z === 13;
    b.set(x, 0, z, inside ? 'water[level=0]' : 'stone_bricks');
  }
  b.fill(12, 0, 13, 12, 2, 13, `${spruce.log}[axis=y]`);
  b.set(12, 3, 13, spruce.slab);
  b.set(13, 2, 13, 'lightning_rod[facing=east]');
  b.step();
  tree(b, { x: -7, y: 0, z: -3, species: 'fichte', size: 'gross', seed: 21 });
  tree(b, { x: 17, y: 0, z: -3, species: 'fichte', size: 'mittel', seed: 22 });
  tree(b, { x: -7, y: 0, z: 14, species: 'fichte', size: 'mittel', seed: 23 });
  rock(b, { x: 16, y: 0, z: 5, size: 'klein', material: 'stein', seed: 4 });
  rock(b, { x: -6, y: 0, z: 7, size: 'klein', material: 'andesit', seed: 5 });
  bush(b, { x: 12, y: 0, z: -4, size: 'klein', leaves: 'fichte', seed: 6 });
  b.step();
  vegetation(b, { x: -10, y: 0, z: -7, width: 31, depth: 28, mix: 'blumen', density: 0.3, shape: 'eckig', seed: 31 });
}

export default function build(b) {
  site(b);
  groundFloor(b);
  balconyAndFloor(b);
  logWalls(b);
  railing(b);
  roof(b);
  openings(b);
  interior(b);
  lights(b);
  surroundings(b);
}
