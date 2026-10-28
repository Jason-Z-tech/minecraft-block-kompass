// Bauernhof mit Scheune: kleines Bauernhaus, große rote Scheune mit Heuboden, Silo, Feld mit Wasserrinne und Weide.
// Bau-Rahmen: Bauernhaus x 0 … 8, z 0 … 6 (Tür im Süden); Scheune x 14 … 24, z −4 … 8 (Tor im Süden);
// Silo um (30, −1); Feld x 0 … 8, z 10 … 21; Weide x 11 … 27, z 12 … 26. Gelände auf y = −1, Fußböden auf y = 0.

import {
  WOOD, window, doorway, chimney, hangingLantern, gardenFence, floorPattern, fireplace, kitchen, diningTable, lightRoom,
  tree, bush, vegetation, fixDirtPaths,
} from '../lib/index.js';

export const meta = {
  id: 'bauernhof-scheune',
  title: 'Bauernhof mit Scheune',
  category: 'haeuser',
  subtitle: 'Bauernhaus, rote Scheune mit Heuboden, Silo, Felder und Weide',
  tags: ['Bauernhof', 'Scheune', 'Hof', 'Farm', 'Landwirtschaft', 'Felder', 'Weizen', 'Karotten', 'Kartoffeln', 'Weide', 'Silo', 'Heuboden', 'Rot', 'Mangrove'],
  aliases: [
    'bauernhof', 'bauern hof', 'bauernhaus', 'scheune', 'rote scheune', 'stall', 'hof mit scheune', 'landhaus', 'gutshof', 'baurnhof',
    'farmhaus', 'farm', 'barn', 'red barn', 'farmhouse', 'farm house', 'farm with barn', 'silo', 'scheuen',
  ],
  accuracy: 'eigenes',
  description: 'Ein kleiner Bauernhof: ein weißes Bauernhaus mit Kamin, daneben eine große rote Scheune aus Mangrovenbrettern mit hellen Kanten aus geschälter Birke, offenem Tor, Ställen und Heuboden voller Heuballen. Ein weißes Silo mit Kupferkuppel steht neben der Scheune. Südlich wachsen Weizen, Karotten und Kartoffeln auf Ackerboden an einer Wasserrinne, daneben liegt eine eingezäunte Weide mit Tor und Tränke.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;
const oak = WOOD.eiche;
const RED = WOOD.mangrove.planks;
const TRIM = WOOD.birke.strippedLog;
const BARN = { x1: 14, x2: 24, z1: -4, z2: 8, top: 6, door: [18, 20] };
const HOUSE = { x1: 0, x2: 8, z1: 0, z2: 6, top: 4 };
const FIELD = { x1: 0, x2: 8, z1: 10, z2: 21, water: 4 };
const SILO = { x: 30, z: -1, top: 13 };

// Giebelhöhe von b.roof (Satteldach entlang z, Überstand 1): Reihe k, unterste Treppe auf y.
const barnRoofY = (x) => BARN.top + Math.min(x - (BARN.x1 - 1), BARN.x2 + 1 - x);

function site(b) {
  b.phase('Bauplatz');
  b.step();
  b.fill(-12, -1, -9, 35, -1, 28, 'grass_block');
  b.fill(HOUSE.x1, -1, HOUSE.z1, HOUSE.x2, -1, HOUSE.z2, 'dirt');
  b.fill(BARN.x1, -1, BARN.z1, BARN.x2, -1, BARN.z2, 'dirt');
  b.step();
  const mix = [['dirt_path', 5], ['coarse_dirt', 2]];
  floorPattern(b, { x: 9, y: -1, z: 0, width: 5, depth: 12, pattern: 'random', blocks: mix });
  floorPattern(b, { x: 3, y: -1, z: 7, width: 6, depth: 2, pattern: 'random', blocks: mix });
  floorPattern(b, { x: 14, y: -1, z: 9, width: 11, depth: 3, pattern: 'random', blocks: mix });
}

function farmhouse(b) {
  b.phase('Bauernhaus');
  b.step();
  b.fill(HOUSE.x1, 0, HOUSE.z1, HOUSE.x2, 0, HOUSE.z2, 'cobblestone');
  b.fill(HOUSE.x1 + 1, 0, HOUSE.z1 + 1, HOUSE.x2 - 1, 0, HOUSE.z2 - 1, spruce.planks);
  b.step();
  b.walls(HOUSE.x1, 1, HOUSE.z1, HOUSE.x2, HOUSE.top - 1, HOUSE.z2, 'calcite');
  for (const [x, z] of [[0, 0], [8, 0], [0, 6], [8, 6], [4, 0], [4, 6]]) b.fill(x, 1, z, x, HOUSE.top, z, `${spruce.log}[axis=y]`);
  b.fill(1, HOUSE.top, HOUSE.z1, 3, HOUSE.top, HOUSE.z1, `${spruce.log}[axis=x]`);
  b.fill(5, HOUSE.top, HOUSE.z1, 7, HOUSE.top, HOUSE.z1, `${spruce.log}[axis=x]`);
  b.fill(1, HOUSE.top, HOUSE.z2, 3, HOUSE.top, HOUSE.z2, `${spruce.log}[axis=x]`);
  b.fill(5, HOUSE.top, HOUSE.z2, 7, HOUSE.top, HOUSE.z2, `${spruce.log}[axis=x]`);
  for (const x of [HOUSE.x1, HOUSE.x2]) b.fill(x, HOUSE.top, 1, x, HOUSE.top, 5, `${spruce.log}[axis=z]`);
  b.fill(1, HOUSE.top, 3, 7, HOUSE.top, 3, `${spruce.log}[axis=x]`);
  b.step();
  b.roof({ x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z2, y: HOUSE.top, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
  b.step();
  fireplace(b, { x: 7, y: 1, z: 3, facing: 'west', height: 4, block: 'bricks', mantel: spruce.stairs });
  chimney(b, { x: 7, y: HOUSE.top + 1, z: 3, height: 6, block: 'bricks', smoke: 'normal', rim: 'brick_stairs' });
  b.step();
  doorway(b, { x: 4, y: 1, z: HOUSE.z2, facing: 'south', door: spruce.door, frame: null, canopy: spruce.stairs, step: 'cobblestone_stairs' });
  fixDirtPaths(b, { x1: HOUSE.x1, y1: -1, z1: HOUSE.z2 + 1, x2: HOUSE.x2, y2: -1, z2: HOUSE.z2 + 1 });
  for (const x of [2, 6]) window(b, { x, y: 2, z: HOUSE.z2, facing: 'south', height: 2, shutters: spruce.trapdoor, flowerBox: true });
  for (const x of [2, 6]) window(b, { x, y: 2, z: HOUSE.z1, facing: 'north', height: 2, sill: spruce.stairs });
  window(b, { x: HOUSE.x1, y: 2, z: 3, facing: 'west', height: 2, shutters: spruce.trapdoor });
  b.step();
  kitchen(b, { x: 1, y: 1, z: 1, facing: 'south', width: 5, wood: 'fichte', cabinets: false });
  diningTable(b, { x: 3, y: 1, z: 3, facing: 'south', length: 2, width: 1, wood: 'fichte', headChairs: false });
  b.bed(2, 1, 5, 'yellow_bed', { facing: 'west' });
  b.set(7, 1, 5, 'chest[facing=west,type=single]');
  b.set(7, 1, 1, 'barrel[facing=up]');
  b.step();
  hangingLantern(b, { x: 4, y: HOUSE.top - 1, z: 3, chain: 0 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 7, y2: HOUSE.top - 1, z2: 5 });
}

function barnShell(b) {
  b.phase('Scheune: Wände');
  b.step();
  b.fill(BARN.x1, 0, BARN.z1, BARN.x2, 0, BARN.z2, 'cobblestone');
  b.fill(BARN.x1 + 1, 0, BARN.z1 + 1, BARN.x2 - 1, 0, BARN.z2 - 1, 'packed_mud');
  b.step();
  for (const [x, z] of [[BARN.x1, BARN.z1], [BARN.x2, BARN.z1], [BARN.x1, BARN.z2], [BARN.x2, BARN.z2]]) b.fill(x, 1, z, x, BARN.top, z, `${TRIM}[axis=y]`);
  b.fill(BARN.x1 + 1, BARN.top, BARN.z1, BARN.x2 - 1, BARN.top, BARN.z1, `${TRIM}[axis=x]`);
  b.fill(BARN.x1 + 1, BARN.top, BARN.z2, BARN.x2 - 1, BARN.top, BARN.z2, `${TRIM}[axis=x]`);
  for (const x of [BARN.x1, BARN.x2]) b.fill(x, BARN.top, BARN.z1 + 1, x, BARN.top, BARN.z2 - 1, `${TRIM}[axis=z]`);
  b.step();
  for (let y = 1; y < BARN.top; y++) {
    b.fill(BARN.x1 + 1, y, BARN.z1, BARN.x2 - 1, y, BARN.z1, RED);
    for (let x = BARN.x1 + 1; x < BARN.x2; x++) if (!(y <= 4 && x >= BARN.door[0] && x <= BARN.door[1])) b.set(x, y, BARN.z2, RED);
    for (const x of [BARN.x1, BARN.x2]) b.fill(x, y, BARN.z1 + 1, x, y, BARN.z2 - 1, RED);
  }
  b.step();
  for (const x of [BARN.door[0] - 1, BARN.door[1] + 1]) b.fill(x, 1, BARN.z2, x, 4, BARN.z2, `${TRIM}[axis=y]`);
  b.fill(BARN.door[0] - 1, 5, BARN.z2, BARN.door[1] + 1, 5, BARN.z2, `${TRIM}[axis=x]`);
  b.step();
  for (const z of [1, 5]) b.fill(BARN.x1 + 1, BARN.top, z, BARN.x2 - 1, BARN.top, z, `${TRIM}[axis=x]`);
}

function barnRoof(b) {
  b.phase('Scheune: Dach und Giebel');
  b.step();
  const hayDoor = (x, y, z) => z === BARN.z2 && y >= 8 && y <= 9 && x >= 18 && x <= 20;
  for (const z of [BARN.z1, BARN.z2]) {
    for (let x = BARN.x1 + 1; x < BARN.x2; x++) {
      const top = barnRoofY(x) - 1;
      for (let y = BARN.top + 1; y <= top; y++) {
        if (hayDoor(x, y, z)) {
          if (x !== 19) b.set(x, y, z, `${TRIM}[axis=y]`);
          else if (y === 8) b.door(x, y, z, spruce.door, { facing: 'north', hinge: 'left' });
        }
        else if (z === BARN.z2 && x === 19 && y === 7) b.set(x, y, z, `${TRIM}[axis=x]`);
        else b.set(x, y, z, RED);
      }
    }
  }
  b.step();
  b.roof({ x1: BARN.x1, z1: BARN.z1, x2: BARN.x2, z2: BARN.z2, y: BARN.top, type: 'gable', axis: 'z', stairs: dark.stairs, slab: dark.slab, full: RED, overhang: 1 });
  b.step();
  const ridge = (BARN.x1 + BARN.x2) / 2;
  for (const z of [BARN.z1 - 1, BARN.z2 + 1]) {
    for (let x = BARN.x1 - 1; x <= BARN.x2 + 1; x++) {
      if (x === ridge) b.slab(x, barnRoofY(x) - 1, z, WOOD.birke.slab, { type: 'top' });
      else b.stairs(x, barnRoofY(x) - 1, z, WOOD.birke.stairs, { facing: x < ridge ? 'east' : 'west', half: 'top' });
    }
  }
  b.step();
  b.set(19, 11, BARN.z2 + 1, `${TRIM}[axis=z]`);
  hangingLantern(b, { x: 19, y: 10, z: BARN.z2 + 1, chain: 1 });
  b.step();
  for (const x of [BARN.x1, BARN.x2]) for (const z of [0, 4]) b.fill(x, 1, z, x, BARN.top - 1, z, `${TRIM}[axis=y]`);
  for (const z of [-2, 2, 6]) {
    window(b, { x: BARN.x1, y: 2, z, facing: 'west', height: 2 });
    window(b, { x: BARN.x2, y: 2, z, facing: 'east', height: 2 });
  }
}

function barnInside(b) {
  b.phase('Scheune: innen');
  b.step();
  for (let y = 1; y <= 4; y++) for (const x of [15, 16, 22, 23]) b.set(x, y, BARN.z2 + 1, `${WOOD.mangrove.trapdoor}[facing=south,half=bottom,open=true]`);
  for (let x = BARN.door[0]; x <= BARN.door[1]; x++) b.stairs(x, 0, BARN.z2 + 1, 'cobblestone_stairs', { facing: 'north' });
  fixDirtPaths(b, { x1: BARN.door[0], y1: -1, z1: BARN.z2 + 1, x2: BARN.door[1], y2: -1, z2: BARN.z2 + 1 });
  b.step();
  for (const z of [0, 4]) b.fill(15, 1, z, 17, 1, z, spruce.fence);
  for (let z = -3; z <= 7; z++) if (z !== 0 && z !== 4) b.set(18, 1, z, spruce.fence);
  b.set(18, 1, 0, spruce.fence);
  b.set(18, 1, 4, spruce.fence);
  for (const z of [-2, 2, 6]) {
    b.set(18, 1, z, `${spruce.fenceGate}[facing=east]`);
    b.set(15, 1, z - 1, 'hay_block[axis=y]');
    b.set(15, 1, z + 1, 'water_cauldron[level=3]');
  }
  b.step();
  b.fill(BARN.x1 + 1, 5, BARN.z1 + 1, BARN.x2 - 1, 5, 0, spruce.planks);
  b.fill(23, 1, -3, 23, 5, -3, 'air');
  b.fill(23, 1, -3, 23, 5, -3, 'ladder[facing=south]');
  for (let x = 15; x <= 21; x++) for (let z = -3; z <= -1; z++) {
    if (z === -1 && x >= 19) continue;
    b.set(x, 6, z, `hay_block[axis=${(x + z) % 2 === 0 ? 'x' : 'z'}]`);
    if (z === -3 && x <= 19) b.set(x, 7, z, 'hay_block[axis=x]');
  }
  b.step();
  for (const z of [2, 3]) b.set(23, 1, z, 'barrel[facing=up]');
  b.set(23, 2, 2, 'barrel[facing=up]');
  b.set(23, 1, 4, 'chest[facing=west,type=single]');
  b.set(23, 1, 6, 'composter[level=4]');
  for (const [x, y, z] of [[22, 1, 1], [23, 1, 1], [23, 2, 1], [22, 1, 7]]) b.set(x, y, z, 'hay_block[axis=y]');
  b.step();
  for (const x of [17, 21]) for (const z of [1, 5]) hangingLantern(b, { x, y: BARN.top - 1, z, chain: 1 });
  lightRoom(b, { x1: BARN.x1 + 1, y1: 1, z1: BARN.z1 + 1, x2: BARN.x2 - 1, y2: 4, z2: BARN.z2 - 1 });
  lightRoom(b, { x1: BARN.x1 + 1, y1: 6, z1: BARN.z1 + 1, x2: BARN.x2 - 1, y2: 7, z2: 0 });
}

function silo(b) {
  b.phase('Silo');
  b.step();
  b.disc(SILO.x, 0, SILO.z, 3, 'stone_bricks');
  b.step();
  for (let y = 1; y <= SILO.top; y++) b.cylinder(SILO.x, y, SILO.z, 3, 1, y % 4 === 0 ? 'polished_andesite' : 'calcite', { hollow: true });
  b.step();
  b.sphere(SILO.x, SILO.top + 1, SILO.z, 3, 'waxed_weathered_cut_copper', { part: 'top', hollow: true });
  // Unter dem obersten 3 × 3-Deckel eine zweite Lage, sonst hinge der Deckel nur über die Kanten am Ring.
  b.fill(SILO.x - 1, SILO.top + 3, SILO.z - 1, SILO.x + 1, SILO.top + 3, SILO.z + 1, 'waxed_weathered_cut_copper');
  b.set(SILO.x, SILO.top + 5, SILO.z, 'waxed_weathered_lightning_rod[facing=up]');
  b.step();
  b.door(SILO.x - 3, 1, SILO.z, spruce.door, { facing: 'east', hinge: 'left' });
  b.set(SILO.x - 4, 0, SILO.z, 'cobblestone_stairs[facing=east]');
  hangingLantern(b, { x: SILO.x, y: SILO.top + 2, z: SILO.z, chain: 2 });
  lightRoom(b, { x1: SILO.x - 2, y1: 1, z1: SILO.z - 2, x2: SILO.x + 2, y2: SILO.top + 2, z2: SILO.z + 2 });
}

function field(b) {
  b.phase('Feld');
  b.step();
  b.fill(FIELD.water, -2, FIELD.z1, FIELD.water, -2, FIELD.z2, 'dirt');
  b.fill(FIELD.water, -1, FIELD.z1, FIELD.water, -1, FIELD.z2, 'water[level=0]');
  b.step();
  for (let x = FIELD.x1; x <= FIELD.x2; x++) if (x !== FIELD.water) b.fill(x, -1, FIELD.z1, x, -1, FIELD.z2, 'farmland[moisture=7]');
  b.step();
  for (let x = FIELD.x1; x <= FIELD.x2; x++) {
    if (x === FIELD.water) continue;
    for (let z = FIELD.z1; z <= FIELD.z2; z++) {
      const band = Math.floor((z - FIELD.z1) / 4);
      b.set(x, 0, z, ['wheat[age=7]', 'carrots[age=7]', 'potatoes[age=7]'][band]);
    }
  }
  b.step();
  b.set(10, 0, 15, oak.fence);
  b.set(10, 1, 15, 'hay_block[axis=y]');
  b.set(10, 2, 15, 'carved_pumpkin[facing=west]');
  b.set(10, 1, 14, oak.fence);
  b.set(10, 1, 16, oak.fence);
  b.set(FIELD.x1 - 1, 0, FIELD.z1 - 1, 'composter[level=6]');
}

function pasture(b) {
  b.phase('Weide');
  b.step();
  gardenFence(b, { x: 27, y: 0, z: 26, facing: 'north', width: 17, depth: 15, fence: oak.fence, gate: oak.fenceGate, gateWidth: 2, posts: oak.strippedLog, lanterns: true });
  b.step();
  b.fill(16, -1, 17, 20, -1, 19, 'stone');
  for (let x = 16; x <= 20; x++) for (let z = 17; z <= 19; z++) b.set(x, 0, z, x > 16 && x < 20 && z === 18 ? 'water[level=0]' : 'stone_bricks');
  b.step();
  for (const [x, y, z] of [[23, 0, 21], [24, 0, 21], [23, 1, 21], [24, 0, 22]]) b.set(x, y, z, 'hay_block[axis=y]');
}

function green(b) {
  b.phase('Bäume und Wiese');
  b.step();
  tree(b, { x: -7, y: 0, z: 2, species: 'eiche', size: 'mittel', seed: 41 });
  tree(b, { x: -7, y: 0, z: 18, species: 'eiche', size: 'klein', seed: 42 });
  tree(b, { x: 4, y: 0, z: -6, species: 'birke', size: 'mittel', seed: 43 });
  bush(b, { x: 31, y: 0, z: 8, size: 'mittel', leaves: 'eiche', seed: 44 });
  bush(b, { x: -2, y: 0, z: -3, size: 'klein', leaves: 'eiche', seed: 45 });
  b.step();
  vegetation(b, { x: -12, y: 0, z: -9, width: 48, depth: 38, mix: 'wiese', density: 0.25, shape: 'eckig', seed: 46 });
}

export default function build(b) {
  site(b);
  farmhouse(b);
  barnShell(b);
  barnRoof(b);
  barnInside(b);
  silo(b);
  field(b);
  pasture(b);
  green(b);
}
