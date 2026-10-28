// Taverne – zweigeschossiges Wirtshaus: Erdgeschoss aus Stein mit Schankraum, Obergeschoss als Fachwerk mit Vorsprung.
// Rahmen: Vorderseite nach Süden (+z). Erdgeschoss x 0 … 14, z 0 … 10; Obergeschoss ragt vorne bis z 11. Wiese auf y = 0.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, doorway, chimney, timberWall, brace, dormer, wallLantern, hangingLantern, floorPattern, straightStairs,
  bedroom, diningTable, fireplace, lightRoom, tree, bush, path, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'taverne',
  title: 'Taverne',
  category: 'mittelalter',
  subtitle: 'Wirtshaus mit Schankraum, Fachwerk-Obergeschoss und Gästezimmern',
  tags: ['Mittelalter', 'Dorf', 'Wirtshaus', 'Gasthaus', 'Fachwerk', 'Zwei Etagen', 'Innenausbau', 'Kamin'],
  aliases: [
    'taverne', 'tavern', 'taverna', 'tarverne', 'wirtshaus', 'gasthaus', 'gaststätte', 'kneipe', 'schenke', 'schänke',
    'gasthof', 'inn', 'pub', 'medieval tavern', 'medieval inn', 'fachwerk taverne', 'mittelalter taverne', 'minecraft taverne',
  ],
  accuracy: 'eigenes',
  description: 'Ein zweigeschossiges Wirtshaus: unten Steinmauern, oben Fachwerk aus Schwarzeiche mit hellem Kalzit, das vorne einen Block über die Gasse ragt. Im Schankraum stehen eine Theke aus umgedrehten Treppen, eine Wand voller Fässer, zwei Tische und ein gemauerter Kamin; eine Treppe an der Rückwand führt zu zwei Gästezimmern, darüber liegt der Dachboden als Vorratslager. Draußen hängt das Wirtshausschild, daneben ein kleiner Biergarten unter einer Eiche.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

const X2 = 14;
const Z2 = 10;
const UP_Z2 = 11;
const GROUND_TOP = 4;
const FLOOR_Y = 5;
const PLATE_Y = 9;

function groundStone(x, y, z) {
  const h = hashPosition(x, y, z, 515) % 20;
  if (y === 1) return h < 6 ? 'mossy_cobblestone' : 'cobblestone';
  if (h < 2) return 'cracked_stone_bricks';
  if (h < 4) return 'mossy_stone_bricks';
  return 'stone_bricks';
}

function foundation(b) {
  b.phase('Gelände und Fundament');
  b.step();
  b.fill(-6, 0, -6, 26, 0, 22, 'grass_block');
  b.fill(0, 0, 0, X2, 0, Z2, 'cobblestone');
  floorPattern(b, { x: 1, y: 0, z: 1, width: X2 - 1, depth: Z2 - 1, pattern: 'border', blocks: [spruce.planks, dark.planks] });
}

function groundFloor(b) {
  b.phase('Erdgeschoss');
  for (let y = 1; y <= GROUND_TOP; y++) {
    for (let x = 0; x <= X2; x++) {
      for (let z = 0; z <= Z2; z++) {
        if (x === 0 || x === X2 || z === 0 || z === Z2) b.set(x, y, z, groundStone(x, y, z));
      }
    }
  }
}

function upperFloor(b) {
  b.phase('Decke und Vorsprung');
  b.step();
  for (const x of [0, 4, 8, 12, X2]) brace(b, { x, y: GROUND_TOP, z: Z2, facing: 'south', length: 1, stairs: dark.stairs });
  b.step();
  b.fill(1, FLOOR_Y, 1, X2 - 1, FLOOR_Y, Z2, spruce.planks);
  for (const x of [3, 7, 11]) b.fill(x, FLOOR_Y, 1, x, FLOOR_Y, Z2, `${dark.strippedLog}[axis=z]`);
  b.fill(6, FLOOR_Y, 1, 7, FLOOR_Y, 1, 'air');

  b.phase('Fachwerk im Obergeschoss');
  b.step();
  timberWall(b, { x: 0, y: FLOOR_Y, z: UP_Z2, facing: 'south', length: X2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' });
  for (const [x, y] of [[5, 6], [7, 6], [6, 7], [5, 8], [7, 8]]) b.set(x, y, UP_Z2, dark.strippedLog);
  b.step();
  timberWall(b, { x: X2, y: FLOOR_Y, z: 0, facing: 'north', length: X2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'diagonal' });
  b.step();
  timberWall(b, { x: 0, y: FLOOR_Y, z: 0, facing: 'west', length: UP_Z2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' });
  timberWall(b, { x: X2, y: FLOOR_Y, z: UP_Z2, facing: 'east', length: UP_Z2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' });
  b.step();
  b.fill(1, 6, 4, X2 - 1, 8, 4, spruce.planks);
  b.fill(7, 6, 5, 7, 8, UP_Z2 - 1, spruce.planks);
  for (const x of [1, 7, X2 - 1]) b.fill(x, 6, 4, x, 8, 4, `${spruce.strippedLog}[axis=y]`);
  b.fill(1, PLATE_Y, 1, X2 - 1, PLATE_Y, UP_Z2 - 1, spruce.planks);
  b.set(X2 - 1, PLATE_Y, 1, 'air');
}

function roof(b) {
  b.phase('Dach');
  b.roof({ x1: 0, z1: 0, x2: X2, z2: UP_Z2, y: PLATE_Y, type: 'gable', axis: 'x', stairs: dark.stairs, slab: dark.slab, full: 'calcite', overhang: 1 });
  for (const x of [0, X2]) {
    b.fill(x, 12, 3, x, 12, 8, `${dark.strippedLog}[axis=z]`);
    b.fill(x, 13, 5, x, 14, 6, `${dark.strippedLog}[axis=y]`);
    b.fill(x, 10, 3, x, 11, 3, 'glass_pane');
    b.fill(x, 10, 8, x, 11, 8, 'glass_pane');
  }
  b.phase('Gauben');
  for (const x of [4, 10]) {
    dormer(b, { x, y: PLATE_Y + 1, z: UP_Z2, facing: 'south', width: 3, wallHeight: 2, wall: spruce.planks, corner: dark.log, stairs: dark.stairs });
    sealDormerBack(b, x);
  }
}

// Die Dachreihen der Gaube laufen hinten unter das Hauptdach. Die offenen Hälften ihrer Treppen und der Firststufe
// bilden dort halbblockhohe Kanäle, durch die man in den Dachboden sähe. Bretter neben und hinter den Reihen schließen
// sie; der Durchgang vom Dachboden in die Gaube bleibt frei.
const DORMER_DEPTH = 4;
function sealDormerBack(b, x) {
  const back = UP_Z2 - DORMER_DEPTH;
  const cells = [
    [-2, 11, back], [-1, 12, back], [0, 13, back], [1, 12, back], [2, 11, back],
    [-3, 11, back + 1], [-3, 11, back + 2], [3, 11, back + 1], [3, 11, back + 2],
    [-2, 12, back + 1], [2, 12, back + 1],
  ];
  for (const [dx, y, z] of cells) b.set(x + dx, y, z, dark.planks);
}

function openings(b) {
  b.phase('Fenster und Tür');
  b.step();
  doorway(b, { x: 9, y: 1, z: Z2, facing: 'south', door: spruce.door, frame: dark.strippedLog });
  b.step();
  for (const x of [2, 5, 13]) window(b, { x, y: 2, z: Z2, facing: 'south', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  window(b, { x: 2, y: 2, z: 0, facing: 'north', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: 12, y: 2, z: 0, facing: 'north', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: 0, y: 2, z: 3, facing: 'west', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  window(b, { x: X2, y: 2, z: 8, facing: 'east', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  b.step();
  for (const x of [2, 10]) window(b, { x, y: 7, z: UP_Z2, facing: 'south', height: 2, flowerBox: true });
  for (const x of [3, 10]) window(b, { x, y: 6, z: 0, facing: 'north', height: 2 });
  window(b, { x: 0, y: 6, z: 8, facing: 'west', height: 2, shutters: spruce.trapdoor });
  window(b, { x: X2, y: 6, z: 8, facing: 'east', height: 2, shutters: spruce.trapdoor });
}

function chimneyAndHearth(b) {
  b.phase('Kamin und Schornstein');
  b.step();
  fireplace(b, { x: 1, y: 1, z: 7, facing: 'east', height: 4, block: 'bricks', mantel: dark.stairs });
  b.step();
  chimney(b, { x: 1, y: FLOOR_Y, z: 7, height: 12, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
}

function taproom(b) {
  b.phase('Schankraum');
  b.step();
  straightStairs(b, { x: 9, y: 1, z: 1, facing: 'west', width: 1, height: 5, stairs: spruce.stairs, support: spruce.planks });
  b.step();
  for (let z = 3; z <= 7; z++) b.set(10, 1, z, `${spruce.stairs}[facing=east,half=top]`);
  for (let x = 11; x <= 13; x++) b.set(x, 1, 7, `${spruce.stairs}[facing=north,half=top]`);
  b.set(10, 2, 4, 'brewing_stand');
  b.set(10, 2, 6, 'candle[candles=3,lit=true]');
  b.set(12, 2, 7, 'flower_pot');
  b.set(11, 2, 7, 'potted_red_tulip');
  b.step();
  for (let z = 2; z <= 6; z++) for (let y = 1; y <= 2; y++) b.set(13, y, z, 'barrel[facing=west]');
  for (let z = 2; z <= 6; z++) b.set(13, 3, z, `${spruce.shelf}[facing=west]`);
  b.set(12, 1, 1, 'smoker[facing=south,lit=true]');
  b.set(13, 1, 1, 'water_cauldron[level=3]');
  b.step();
  diningTable(b, { x: 5, y: 1, z: 4, length: 3, width: 1, wood: 'fichte', top: 'slab' });
  diningTable(b, { x: 5, y: 1, z: 8, length: 3, width: 1, wood: 'fichte', top: 'slab', headChairs: false });
  for (const z of [2, 9]) {
    b.set(2, 1, z, 'barrel[facing=up]');
    b.set(2, 2, z, 'candle[candles=2,lit=true]');
  }
}

function guestRooms(b) {
  b.phase('Obergeschoss');
  b.step();
  b.fill(6, 6, 2, 7, 6, 2, spruce.fence);
  b.set(8, 6, 1, spruce.fence);
  b.fill(X2 - 1, 6, 1, X2 - 1, PLATE_Y, 1, 'ladder[facing=west]');
  b.step();
  doorway(b, { x: 4, y: 6, z: 4, facing: 'north', door: spruce.door, frame: null });
  doorway(b, { x: 10, y: 6, z: 4, facing: 'north', door: spruce.door, frame: null });
  b.step();
  bedroom(b, { x: 6, y: 6, z: UP_Z2 - 1, facing: 'north', width: 6, depth: 6, wood: 'fichte', color: 'rot', rug: 'braun' });
  bedroom(b, { x: X2 - 1, y: 6, z: UP_Z2 - 1, facing: 'north', width: 6, depth: 6, wood: 'fichte', color: 'gruen', rug: 'braun' });
  b.step();
  for (let x = 9; x <= 11; x++) b.set(x, 6, 1, `${spruce.stairs}[facing=north]`);
  for (const [x, y, z] of [[2, 10, 2], [3, 10, 2], [2, 11, 2], [12, 10, 6], [12, 10, 7], [12, 11, 6]]) b.set(x, y, z, 'hay_block[axis=y]');
  for (const [x, z] of [[6, 2], [7, 2], [8, 2], [12, 4]]) b.set(x, PLATE_Y + 1, z, 'barrel[facing=up]');
  b.set(4, PLATE_Y + 1, 2, 'chest[facing=south,type=single]');
}

// Höhe der Dachtreppe über der Zeile z (Satteldach mit Überstand 1, Traufe auf PLATE_Y).
const roofY = (z) => PLATE_Y + Math.min(z + 1, UP_Z2 + 1 - z);

// Dachboden beleuchten: lightRoom rechnet im Rechteck. Felder über der Dachfläche werden für die Rechnung kurz mit
// Barrieren gefüllt (sonst landen Laternen außen auf dem Dach) und danach wieder entfernt.
function lightUnderRoof(b, box) {
  const temp = [];
  for (let y = box.y1; y <= box.y2; y++) {
    for (let z = box.z1; z <= box.z2; z++) {
      for (let x = box.x1; x <= box.x2; x++) {
        if (y < roofY(z) || b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, 'barrier');
        temp.push([x, y, z]);
      }
    }
  }
  lightRoom(b, box, { mode: 'floor' });
  for (const [x, y, z] of temp) b.remove(x, y, z);
}

function lights(b) {
  b.phase('Licht');
  b.step();
  hangingLantern(b, { x: 6, y: GROUND_TOP, z: 4, chain: 0 });
  hangingLantern(b, { x: 6, y: GROUND_TOP, z: 8, chain: 0 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: X2 - 1, y2: GROUND_TOP, z2: Z2 - 1 });
  b.step();
  lightRoom(b, { x1: 1, y1: 6, z1: 1, x2: X2 - 1, y2: 8, z2: 3 });
  lightRoom(b, { x1: 1, y1: 6, z1: 5, x2: 6, y2: 8, z2: UP_Z2 - 1 });
  lightRoom(b, { x1: 8, y1: 6, z1: 5, x2: X2 - 1, y2: 8, z2: UP_Z2 - 1 });
  lightUnderRoof(b, { x1: 1, y1: PLATE_Y + 1, z1: 1, x2: X2 - 1, y2: 14, z2: UP_Z2 - 1 });
  b.step();
  wallLantern(b, { x: 7, y: 3, z: Z2, facing: 'south', style: 'bracket', arm: dark.fence });
  wallLantern(b, { x: 11, y: 3, z: Z2, facing: 'south', style: 'bracket', arm: dark.fence });
}

function signAndGarden(b) {
  b.phase('Wirtshausschild und Umgebung');
  b.step();
  b.set(X2 + 1, FLOOR_Y, UP_Z2, dark.fence);
  b.set(X2 + 2, FLOOR_Y, UP_Z2, dark.fence);
  b.set(X2 + 2, FLOOR_Y - 1, UP_Z2, `${dark.hangingSign}[attached=false,rotation=0]`);
  b.step();
  path(b, { x: 9, y: 0, z: Z2 + 1, facing: 'south', length: 9, width: 3, mix: 'erde', wiggle: 1, seed: 'taverne' });
  b.step();
  tree(b, { x: 21, y: 1, z: 3, species: 'eiche', size: 'mittel', seed: 9 });
  diningTable(b, { x: 17, y: 1, z: 5, length: 2, width: 1, wood: 'fichte', top: 'slab', headChairs: false, decor: true });
  b.set(17, 1, 8, 'barrel[facing=up]');
  b.set(18, 1, 8, 'barrel[facing=up]');
  b.step();
  flowerBed(b, { x: 1, y: 0, z: 12, width: 6, depth: 2, facing: 'south', palette: 'bunt', seed: 4 });
  bush(b, { x: -3, y: 1, z: 2, size: 'klein', seed: 2 });
  bush(b, { x: -2, y: 1, z: 17, size: 'mittel', leaves: 'azalee', seed: 3 });
  bush(b, { x: 21, y: 1, z: 16, size: 'klein', seed: 5 });
  vegetation(b, { x: -6, y: 2, z: -6, width: 33, depth: 29, mix: 'wiese', density: 0.2, shape: 'eckig', seed: 31 });
}

export default function build(b) {
  foundation(b);
  groundFloor(b);
  upperFloor(b);
  roof(b);
  openings(b);
  chimneyAndHearth(b);
  taproom(b);
  guestRooms(b);
  lights(b);
  signAndGarden(b);
}
