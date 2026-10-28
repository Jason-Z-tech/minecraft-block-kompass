// Rittersaal: lange Steinhalle (15 × 29) mit offenem Holzdachstuhl unter einem Schieferdach, zwei langen Tafeln,
// großem Kamin, Wandbannern, Doppelpodest mit Thron und drei Kronleuchtern aus Ketten und Laternen.
// Koordinaten: Hallenmitte x = 0, z = 0; Längsachse z, Portal im Süden (+z), Thron im Norden. Gelände-Oberkante y = 0.

import {
  STONE, WOOD, COLOR, window, doorway, arch, lampPost, wallLantern, diningTable, lightRoom, floorPattern, terrain,
  pathAlong, tree, bush, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'rittersaal',
  title: 'Rittersaal',
  category: 'mittelalter',
  subtitle: 'Große Halle mit offenem Dachstuhl, Tafel, Kamin und Thron',
  tags: ['Halle', 'Rittersaal', 'Mittelalter', 'Burg', 'Thron', 'Dachstuhl', 'Kamin', 'Bankett', 'Kronleuchter', 'Banner', 'Innenraum'],
  aliases: [
    'rittersaal', 'ritter saal', 'great hall', 'castle hall', 'medieval hall', 'thronsaal', 'throne room', 'festsaal',
    'bankettsaal', 'banquet hall', 'halle', 'palas', 'saal', 'king hall', 'königssaal', 'koenigssaal', 'ritersaal', 'rittersal',
  ],
  accuracy: 'eigenes',
  description: 'Eine lange Halle aus Steinziegeln mit Strebepfeilern und hohen Spitzbogenfenstern. Innen trägt ein offener '
    + 'Dachstuhl aus Schwarzeiche das Schieferdach: Wandstützen, Zugbalken mit Kopfbändern, Hängesäulen und eine '
    + 'Holzschalung. An den Zugbalken hängen drei Kronleuchter, an den Wänden Banner. Zwei lange Tafeln flankieren den roten '
    + 'Läufer zum Podest mit zwei Thronen, an der Ostwand brennt ein großer Kamin.',
  sources: [],
  credits: null,
  tested: null,
};

const stone = STONE.steinziegel;
const slate = STONE.tiefenschiefer;
const darkOak = WOOD.schwarzeiche;
const spruce = WOOD.fichte;

const W = 7; // Außenwände bei x = ±7
const L = 14; // Giebelwände bei z = ±14
const FLOOR = 1; // Fußboden (begehbar ab y = 2)
const WALL_TOP = 10;
const TRUSSES = [-12, -8, -4, 0, 4, 8, 12];
const BAYS = [-10, -6, -2, 2, 6, 10];
const CHANDELIERS = [-8, 0, 8];
const HEARTH_Z = 10; // Kamin an der Ostwand
const roofY = (x) => WALL_TOP + (W + 1 - Math.abs(x)); // Höhe der Dachtreppe über Spalte x (mit Überstand 1)
const HALL_BOX = [-W - 2, FLOOR, -L - 1, W + 2, roofY(0), L + 1]; // Mauern, Pfeiler und Giebel (für die Alterung)

function wallStone(b, y) {
  if (y <= 2) return b.pickWeighted([[stone.block, 4], [stone.mossy, 2], [stone.rough, 1]]);
  return b.pickWeighted([[stone.block, 12], [stone.mossy, 2], [stone.cracked, 2]]);
}

function groundAndFloor(b) {
  b.phase('Gelände und Fundament');
  terrain(b, { x: -14, y: -2, z: -20, width: 29, depth: 47, height: 2, surface: 'gras', seed: 'rittersaal' });
  b.fill(-W - 1, 0, -L - 1, W + 1, 0, L + 1, stone.rough);
  floorPattern(b, {
    x: -W + 1, y: FLOOR, z: -L + 1, width: 2 * W - 1, depth: 2 * L - 1, pattern: 'checker',
    blocks: ['polished_andesite', 'polished_diorite'], border: stone.block,
  });
  pathAlong(b, { y: 0, points: [[0, L + 2], [0, 26]], width: 3, mix: 'kies', wiggle: 1, seed: 'rittersaal' });
  flowerBed(b, { x: -6, y: 0, z: L + 2, width: 4, depth: 2, palette: 'warm', facing: 'south', seed: 1 });
  flowerBed(b, { x: 3, y: 0, z: L + 2, width: 4, depth: 2, palette: 'warm', facing: 'south', seed: 2 });
}

function walls(b) {
  b.phase('Mauern und Strebepfeiler');
  weatherNew(b, HALL_BOX, 0.12, () => drawWalls(b));
}

function drawWalls(b) {
  for (let y = FLOOR; y <= WALL_TOP; y++) {
    for (let x = -W; x <= W; x++) for (const z of [-L, L]) b.set(x, y, z, wallStone(b, y));
    for (let z = -L + 1; z < L; z++) for (const x of [-W, W]) b.set(x, y, z, wallStone(b, y));
  }
  for (const z of TRUSSES) {
    for (const side of [-1, 1]) {
      if (side === 1 && Math.abs(z - HEARTH_Z) <= 2) continue;
      const x1 = side * (W + 1);
      const x2 = side * (W + 2);
      for (let y = FLOOR; y <= 7; y++) b.set(x1, y, z, wallStone(b, y));
      for (let y = FLOOR; y <= 3; y++) b.set(x2, y, z, wallStone(b, y));
      b.stairs(x2, 4, z, stone.stairs, { facing: side < 0 ? 'east' : 'west' });
      b.stairs(x1, 8, z, stone.stairs, { facing: side < 0 ? 'east' : 'west' });
    }
  }
  // Eckpfeiler an den Giebelseiten.
  for (const x of [-W, W]) {
    for (const z of [-L - 1, L + 1]) {
      for (let y = FLOOR; y <= 5; y++) b.set(x, y, z, wallStone(b, y));
      b.stairs(x, 6, z, stone.stairs, { facing: z < 0 ? 'south' : 'north' });
    }
  }
}

function truss(b) {
  b.phase('Dachstuhl');
  b.step();
  for (const z of TRUSSES) for (const x of [-W + 1, W - 1]) b.fill(x, 2, z, x, WALL_TOP - 1, z, `${darkOak.strippedLog}[axis=y]`);
  b.step();
  for (const z of TRUSSES) {
    b.fill(-W + 1, WALL_TOP, z, W - 1, WALL_TOP, z, `${darkOak.log}[axis=x]`);
    b.stairs(-W + 2, WALL_TOP - 1, z, darkOak.stairs, { facing: 'west', half: 'top' });
    b.stairs(W - 2, WALL_TOP - 1, z, darkOak.stairs, { facing: 'east', half: 'top' });
  }
  b.step();
  for (const z of TRUSSES) {
    b.fill(0, WALL_TOP + 1, z, 0, roofY(0) - 2, z, `${darkOak.strippedLog}[axis=y]`);
    for (const x of [-3, 3]) b.fill(x, WALL_TOP + 1, z, x, roofY(x) - 2, z, darkOak.fence);
  }
  for (let z = -L; z <= L; z++) b.set(0, roofY(0) - 1, z, `${darkOak.log}[axis=z]`);
}

function roof(b) {
  b.phase('Dach');
  weatherNew(b, HALL_BOX, 0.12, () => {
    b.roof({ x1: -W, z1: -L, x2: W, z2: L, y: WALL_TOP, type: 'gable', axis: 'z', stairs: slate.tileStairs, slab: slate.tileSlab, full: stone.block, overhang: 1 });
  });
  for (let z = -L + 1; z < L; z++) {
    const wood = TRUSSES.includes(z) ? darkOak : spruce;
    for (let a = 1; a <= W - 1; a++) {
      const y = roofY(a + 1);
      b.stairs(-a, y, z, wood.stairs, { facing: 'west', half: 'top' });
      b.stairs(a, y, z, wood.stairs, { facing: 'east', half: 'top' });
    }
  }
}

// Ein Teil der Steinziegel, die draw() neu setzt, wird bemoost oder rissig. Ältere Blöcke bleiben unberührt und
// behalten so ihr Kapitel – sonst fehlten sie in der Anleitung bis zu diesem Schritt.
function weatherNew(b, [x1, y1, z1, x2, y2, z2], share, draw) {
  const before = new Map();
  const each = (fn) => {
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) fn(x, y, z);
  };
  each((x, y, z) => before.set(`${x},${y},${z}`, b.get(x, y, z)));
  draw();
  each((x, y, z) => {
    const state = b.get(x, y, z);
    if (state === stone.block && state !== before.get(`${x},${y},${z}`) && b.chance(share)) {
      b.set(x, y, z, b.chance(0.6) ? stone.mossy : stone.cracked);
    }
  });
}

function openings(b) {
  b.phase('Fenster und Portal');
  for (const z of BAYS) {
    for (const [x, facing] of [[-W, 'west'], [W, 'east']]) {
      if (facing === 'east' && Math.abs(z - HEARTH_Z) <= 2) continue;
      window(b, { x, y: 4, z, facing, width: 3, height: 5, style: 'arched', stairs: stone.stairs, glass: 'glass_pane', sill: stone.stairs });
    }
  }
  for (const [z, facing] of [[-L, 'north'], [L, 'south']]) {
    window(b, { x: 0, y: WALL_TOP + 1, z, facing, width: 5, style: 'round', stairs: stone.stairs, glass: 'glass_pane' });
  }
  arch(b, { x: 0, y: 2, z: L, facing: 'south', width: 3, height: 4, style: 'pointed', block: stone.block, stairs: stone.stairs });
  for (const x of [-1, 0, 1]) doorway(b, { x, y: 2, z: L, facing: 'south', door: spruce.door, frame: null, step: stone.stairs });
  // Bogenfeld über den Türen aus Schwarzeichenbrettern.
  for (let y = 4; y <= 5; y++) for (let x = -1; x <= 1; x++) if (b.get(x, y, L) === 'air') b.set(x, y, L, darkOak.planks);
  b.set(0, 6, L, stone.chiseled);
  for (const x of [-3, 3]) wallLantern(b, { x, y: 3, z: L, facing: 'south', style: 'bracket', arm: darkOak.fence });
  for (const x of [-5, 5]) window(b, { x, y: 4, z: L, facing: 'south', width: 1, height: 3, glass: 'glass_pane', sill: stone.stairs });
}

function hearth(b) {
  b.phase('Kamin und Schornstein');
  const z0 = HEARTH_Z;
  for (let y = 2; y <= WALL_TOP; y++) for (let z = z0 - 2; z <= z0 + 2; z++) b.set(W - 1, y, z, stone.block);
  for (let y = 5; y <= WALL_TOP; y++) for (let z = z0 - 2; z <= z0 + 2; z++) b.set(W - 2, y, z, stone.block);
  for (let y = 2; y <= 4; y++) for (const z of [z0 - 2, z0 + 2]) b.set(W - 2, y, z, stone.block);
  for (let z = z0 - 1; z <= z0 + 1; z++) {
    b.set(W - 1, 2, z, 'campfire[facing=west,lit=true,signal_fire=false]');
    for (let y = 3; y <= 4; y++) b.set(W - 1, y, z, 'air');
    for (let y = 2; y <= 4; y++) b.set(W - 2, y, z, 'air');
    b.set(W - 3, FLOOR, z, 'polished_andesite');
  }
  b.set(W - 2, 5, z0, stone.chiseled);
  for (let z = z0 - 3; z <= z0 + 3; z++) b.stairs(W - 3, 6, z, darkOak.stairs, { facing: 'east', half: 'top' });
  b.set(W - 3, 7, z0 - 2, 'candle[candles=3,lit=true]');
  b.set(W - 3, 7, z0 + 2, 'candle[candles=3,lit=true]');
  b.set(W - 3, 7, z0, 'potted_red_tulip');
  b.set(W - 3, 9, z0, `${COLOR.rot.wallBanner}[facing=west]`);
  chimneyStack(b, z0);
}

// Schornstein außen an der Ostwand: unten 3 tief, oben schmaler, die Absätze mit Treppen abgeschrägt.
function chimneyStack(b, z0) {
  const tiers = [[FLOOR, 8, 3], [9, 12, 2], [13, 16, 1]]; // [von y, bis y, Tiefe nach außen]
  for (const [y1, y2, depth] of tiers) {
    for (let y = y1; y <= y2; y++) for (let z = z0 - 1; z <= z0 + 1; z++) for (let d = 1; d <= depth; d++) b.set(W + d, y, z, wallStone(b, y));
    if (depth > 1) for (let z = z0 - 1; z <= z0 + 1; z++) b.stairs(W + depth, y2 + 1, z, stone.stairs, { facing: 'west' });
  }
  for (const z of [z0 - 1, z0 + 1]) b.slab(W + 1, 17, z, stone.slab, { type: 'bottom' });
  b.set(W + 1, 17, z0, 'campfire[facing=east,lit=true,signal_fire=false]');
}

function dais(b) {
  b.phase('Podest und Thron');
  const zBack = -L + 1;
  for (let x = -4; x <= 4; x++) {
    for (let z = zBack; z <= zBack + 3; z++) b.set(x, 2, z, darkOak.planks);
    b.stairs(x, 2, zBack + 4, darkOak.stairs, { facing: 'north' });
  }
  for (let z = zBack; z <= zBack + 3; z++) {
    b.stairs(-5, 2, z, darkOak.stairs, { facing: 'east' });
    b.stairs(5, 2, z, darkOak.stairs, { facing: 'west' });
  }
  // Vordere Ecken: die Treppen werden automatisch zu Außenecken und schließen die Stufe rundum.
  for (const x of [-5, 5]) b.stairs(x, 2, zBack + 4, darkOak.stairs, { facing: 'north' });
  for (let x = -3; x <= 3; x++) for (let z = zBack; z <= zBack + 3; z++) b.set(x, 3, z, COLOR.rot.carpet);
  for (const x of [-2, 2]) {
    b.stairs(x, 3, zBack + 1, darkOak.stairs, { facing: 'north' });
    b.set(x - 1, 3, zBack + 1, `${darkOak.trapdoor}[facing=west,half=bottom,open=true]`);
    b.set(x + 1, 3, zBack + 1, `${darkOak.trapdoor}[facing=east,half=bottom,open=true]`);
    b.set(x, 3, zBack, darkOak.planks);
    b.set(x, 4, zBack, 'gold_block');
    b.set(x, 5, zBack, darkOak.planks);
    b.slab(x, 6, zBack, darkOak.slab, { type: 'bottom' });
  }
  for (const [x, color] of [[-4, 'blau'], [0, 'rot'], [4, 'blau']]) b.set(x, 8, zBack, `${COLOR[color].wallBanner}[facing=south]`);
  for (const x of [-4, 4]) lampPost(b, { x, y: 3, z: zBack + 2, facing: 'south', height: 2, style: 'top', post: darkOak.fence });
}

function hallInterior(b) {
  b.phase('Tafeln, Banner und Kronleuchter');
  b.step();
  for (let z = -L + 6; z <= L - 1; z++) for (let x = -1; x <= 1; x++) b.set(x, 2, z, COLOR.rot.carpet);
  for (const x of [-3, 3]) diningTable(b, { x, y: 2, z: -6, facing: 'west', length: 15, width: 1, wood: 'fichte' });
  b.step();
  TRUSSES.forEach((z, i) => {
    const color = COLOR[i % 2 === 0 ? 'rot' : 'blau'];
    b.set(-W + 2, WALL_TOP - 2, z, `${color.wallBanner}[facing=east]`);
    if (Math.abs(z - HEARTH_Z) > 3) b.set(W - 2, WALL_TOP - 2, z, `${color.wallBanner}[facing=west]`);
  });
  b.step();
  for (const z of CHANDELIERS) chandelier(b, 0, WALL_TOP - 1, z);
  // Sicherheitsnetz: setzt nur dann Laternen, wenn ein begehbares Feld noch dunkel wäre.
  lightRoom(b, { x1: -W + 1, y1: 2, z1: -L + 1, x2: W - 1, y2: WALL_TOP - 1, z2: L - 1 }, { mode: 'floor' });
}

// Kronleuchter: Kette unter (x, top, z), Nabe zwei Ebenen tiefer, Arme in alle vier Richtungen.
function chandelier(b, x, top, z) {
  b.set(x, top, z, 'iron_chain[axis=y]');
  const hub = top - 1;
  b.set(x, hub, z, darkOak.fence);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (const k of [1, 2]) b.set(x + dx * k, hub, z + dz * k, darkOak.fence);
    b.set(x + dx, hub + 1, z + dz, 'candle[candles=3,lit=true]');
    b.set(x + dx * 2, hub - 1, z + dz * 2, 'lantern[hanging=true]');
  }
  b.set(x, hub - 1, z, 'lantern[hanging=true]');
}

function surroundings(b) {
  b.phase('Umgebung');
  for (const x of [-3, 3]) lampPost(b, { x, y: 1, z: L + 5, facing: 'south', height: 3, style: 'top', post: stone.wall, base: stone.chiseled });
  tree(b, { x: -11, y: 1, z: -13, species: 'eiche', size: 'mittel', seed: 4 });
  tree(b, { x: 11, y: 1, z: -15, species: 'birke', size: 'mittel', seed: 5 });
  tree(b, { x: -11, y: 1, z: 18, species: 'eiche', size: 'klein', seed: 6 });
  bush(b, { x: 10, y: 1, z: 19, size: 'klein', leaves: 'eiche', seed: 7 });
  bush(b, { x: -11, y: 1, z: 2, size: 'mittel', leaves: 'eiche', seed: 8 });
  vegetation(b, { x: -14, y: 3, z: -20, width: 29, depth: 47, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 'rittersaal' });
}

export default function build(b) {
  groundAndFloor(b);
  walls(b);
  truss(b);
  roof(b);
  openings(b);
  hearth(b);
  dais(b);
  hallInterior(b);
  surroundings(b);
}
