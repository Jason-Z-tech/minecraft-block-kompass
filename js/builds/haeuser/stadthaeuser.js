// Stadthäuser in Reihe: vier schmale, verschieden gestaltete Reihenhäuser an einer Straße.
// Bau-Rahmen: Fassaden nach Süden (+z) zur Straße, Gärten im Norden. Gehweg-Oberkante y = 0,
// Erdgeschossboden y = 2, Decken y = 7, 12 und 17 (Wandkrone), Dächer ab y = 18.

import { formatState } from '../../core/blockstate.js';
import {
  WOOD, window, doorway, dormer, chimney, balcony, brace, straightStairs, lampPost,
  kitchen, diningTable, bedroom, bookWall, storage, workshop, lightRoom, tree, bush, flowerBed,
} from '../lib/index.js';

export const meta = {
  id: 'stadthaeuser',
  title: 'Stadthäuser in Reihe',
  category: 'haeuser',
  subtitle: 'Vier schmale Reihenhäuser aus Ziegel, Granit und Keramik an einer Straße',
  tags: ['Haus', 'Reihenhaus', 'Stadthaus', 'Stadt', 'Straße', 'Ziegel', 'Granit', 'Keramik', 'Erker', 'Dachgauben', 'Einrichtung', 'Altbau'],
  aliases: [
    'stadthäuser', 'stadthaeuser', 'stadthaus', 'reihenhaus', 'reihenhäuser', 'reihenhaeuser', 'townhouse', 'townhouses', 'row houses',
    'rowhouse', 'terraced houses', 'häuserzeile', 'haeuserzeile', 'altbau', 'stadhäuser', 'stadthauser', 'brownstone', 'grachtenhaus', 'terrakotta',
  ],
  accuracy: 'eigenes',
  description: 'Eine Häuserzeile aus vier schmalen Stadthäusern: ein rotes Ziegelhaus mit zweigeschossigem Erker und Gaube, ein Granithaus mit Flachdach und Gesims, ein ockerfarbenes Keramikhaus mit Giebel zur Straße und Balkonen und ein graublaues Eckhaus mit Gaube und Giebelfenster. Jedes Haus hat eine Eingangstreppe vom Gehweg, drei eingerichtete Etagen und hinten einen kleinen Garten. Davor liegen Gehweg, Bordstein, Straße und Laternen.',
  sources: [],
  credits: null,
  tested: null,
};

const DEPTH = 10; // Hinterwand z = 0, Fassade z = 10
const LEVELS = [2, 7, 12]; // Fußböden der drei Etagen
const WALL_TOP = 17; // Decke über dem 2. Stock = Wandkrone
const ROOF_Y = 18;

const st = (id, facing, half = 'bottom') => formatState(id, { facing, half });
const slab = (id, type = 'bottom') => formatState(id, { type });
const trapdoorOpen = (id, facing) => formatState(id, { facing, half: 'bottom', open: 'true' });
const leaves = (id) => formatState(id, { persistent: 'true' });

const HOUSES = [
  {
    name: 'Ziegelhaus', x0: 0, x1: 6, wall: 'bricks', plinth: 'stone_bricks', trim: 'smooth_quartz', sill: 'smooth_quartz_stairs',
    wood: WOOD.schwarzeiche, floor: WOOD.fichte.planks, door: 'dark_oak_door', doorX: 4, gfWindow: { x: 2, width: 1 },
    windows: [2, 4], roof: { type: 'gable', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'bricks' },
    color: 'rot', top: 'atelier',
  },
  {
    name: 'Granithaus', x0: 7, x1: 12, wall: 'polished_granite', plinth: 'granite', trim: 'polished_diorite', sill: 'polished_diorite_stairs',
    wood: WOOD.fichte, floor: WOOD.eiche.planks, door: 'spruce_door', doorX: 11, gfWindow: { x: 9, width: 1 },
    windows: [9, 10], roof: { type: 'flat' }, color: 'gruen', top: 'bibliothek',
  },
  {
    name: 'Terrakottahaus', x0: 13, x1: 19, wall: 'yellow_terracotta', plinth: 'terracotta', trim: 'white_terracotta', sill: 'smooth_sandstone_stairs',
    wood: WOOD.dschungel, floor: WOOD.birke.planks, door: 'jungle_door', doorX: 16, gfWindow: { x: 14, width: 1 }, gfWindow2: { x: 18, width: 1 },
    windows: [14, 18], roof: { type: 'gable-front', stairs: 'brick_stairs', slab: 'brick_slab', full: 'yellow_terracotta' },
    color: 'orange', top: 'kinder',
  },
  {
    name: 'Eckhaus', x0: 20, x1: 25, wall: 'light_blue_terracotta', plinth: 'stone_bricks', trim: 'white_terracotta', sill: 'smooth_quartz_stairs',
    wood: WOOD.fichte, floor: WOOD.fichte.planks, door: 'birch_door', doorX: 24, gfWindow: { x: 21, width: 2 },
    windows: [21, 24], roof: { type: 'gable', stairs: 'deepslate_brick_stairs', slab: 'deepslate_brick_slab', full: 'light_blue_terracotta' },
    color: 'hellblau', top: 'werkstatt',
  },
];

const inner = (h) => ({ a: h.x0 + 1, c: h.x1 - 1 });

// ------------------------------------------------------------------ Straße, Gehweg, Gärten

function street(b) {
  b.phase('Straße, Gehweg und Gärten');
  b.fill(-1, -2, -6, 26, -2, 21, 'stone');
  b.fill(-1, -1, -6, 26, -1, 15, 'dirt');
  b.fill(-1, 0, -6, 26, 0, -1, 'grass_block');
  for (let z = 0; z <= DEPTH; z++) b.fill(-1, 0, z, 26, 0, z, 'stone');
  for (let z = 11; z <= 14; z++) for (let x = -1; x <= 26; x++) b.set(x, 0, z, x % 4 === 0 ? 'polished_andesite' : 'smooth_stone');
  b.fill(-1, 0, 15, 26, 0, 15, 'polished_andesite');
  b.fill(-1, -1, 16, 26, -1, 21, 'gray_concrete');
  for (let x = 0; x <= 26; x += 4) b.fill(x, -1, 18, Math.min(x + 1, 26), -1, 18, 'white_concrete');
}

// ------------------------------------------------------------------ Rohbau

function foundations(b) {
  b.phase('Fundamente und Erdgeschossboden');
  for (const h of HOUSES) {
    const { a, c } = inner(h);
    b.fill(h.x0, 1, 0, h.x1, 2, DEPTH, h.plinth);
    b.fill(a, 2, 1, c, 2, DEPTH - 1, h.floor);
  }
}

function walls(b) {
  b.phase('Wände und Decken');
  for (const h of HOUSES) {
    const { a, c } = inner(h);
    b.walls(h.x0, 3, 0, h.x1, WALL_TOP, DEPTH, h.wall);
    for (const y of [LEVELS[1], LEVELS[2]]) {
      b.fill(a, y, 1, c, y, DEPTH - 1, h.floor);
      b.fill(a, y, 5, a, y, 7, 'air');
      b.fill(h.x0, y, DEPTH, h.x1, y, DEPTH, h.trim);
    }
    b.fill(a, WALL_TOP, 1, c, WALL_TOP, DEPTH - 1, h.roof.type === 'flat' ? 'polished_granite' : h.floor);
    // Eckquader an den Fassadenecken, an den Außenwänden der Eckhäuser auch hinten und Gesimse an der Seite
    const sides = [h.x0, h.x1];
    for (const x of sides) for (let y = 3; y <= WALL_TOP; y += 2) b.set(x, y, DEPTH, h.trim);
    const outer = h.x0 === 0 ? h.x0 : h.x1 === 25 ? h.x1 : null;
    if (outer !== null) {
      for (let y = 3; y <= WALL_TOP; y += 2) b.set(outer, y, 0, h.trim);
      for (const y of [LEVELS[1], LEVELS[2]]) b.fill(outer, y, 0, outer, y, DEPTH, h.trim);
    }
  }
}

// ------------------------------------------------------------------ Fenster, Türen, Erker, Balkone

function windowsAndDoors(b) {
  b.phase('Fenster, Türen, Erker und Balkone');
  for (const h of HOUSES) {
    b.step();
    if (h.name === 'Ziegelhaus') brickFront(b, h);
    else if (h.name === 'Granithaus') graniteFront(b, h);
    else if (h.name === 'Terrakottahaus') terracottaFront(b, h);
    else cornerFront(b, h);
    backWindows(b, h);
  }
}

function brickFront(b, h) {
  const z = DEPTH;
  window(b, { x: h.gfWindow.x, y: 4, z, facing: 'south', width: 1, height: 2, sill: h.sill });
  b.set(h.gfWindow.x, 6, z, h.trim);
  doorway(b, { x: h.doorX, y: 3, z, facing: 'south', door: h.door, frame: h.trim });
  // Zweigeschossiger Erker x 1 … 5 vor der Fassade (z 11), auf Konsolen
  for (let x = 1; x <= 5; x++) brace(b, { x, y: 6, z, facing: 'south', length: 1, stairs: 'stone_brick_stairs' });
  b.fill(1, 7, z + 1, 5, 7, z + 1, h.trim);
  b.fill(1, 12, z + 1, 5, 12, z + 1, h.trim);
  for (const y0 of [8, 13]) {
    for (let x = 1; x <= 5; x++) {
      const corner = x === 1 || x === 5;
      b.set(x, y0, z + 1, h.wall);
      b.set(x, y0 + 1, z + 1, corner ? h.wall : 'glass_pane');
      b.set(x, y0 + 2, z + 1, corner ? h.wall : 'glass_pane');
      b.set(x, y0 + 3, z + 1, h.wall);
    }
    b.fill(2, y0, z, 4, y0 + 3, z, 'air');
  }
  b.fill(1, WALL_TOP, z + 1, 5, WALL_TOP, z + 1, slab('smooth_quartz_slab'));
  b.fill(2, 7, z, 4, 7, z, h.floor);
  b.fill(2, 12, z, 4, 12, z, h.floor);
}

function graniteFront(b, h) {
  const z = DEPTH;
  window(b, { x: h.gfWindow.x, y: 4, z, facing: 'south', width: 1, height: 2, style: 'framed', frame: h.trim, sill: h.sill });
  doorway(b, { x: h.doorX, y: 3, z, facing: 'south', door: h.door, frame: null });
  // Erker im 1. Stock x 8 … 11
  for (let x = 8; x <= 11; x++) brace(b, { x, y: 6, z, facing: 'south', length: 1, stairs: 'polished_granite_stairs' });
  b.fill(8, 7, z + 1, 11, 7, z + 1, h.trim);
  for (let x = 8; x <= 11; x++) {
    const corner = x === 8 || x === 11;
    b.set(x, 8, z + 1, h.wall);
    b.set(x, 9, z + 1, corner ? h.wall : 'glass_pane');
    b.set(x, 10, z + 1, corner ? h.wall : 'glass_pane');
    b.set(x, 11, z + 1, h.wall);
    b.set(x, 12, z + 1, st('polished_granite_stairs', 'north'));
  }
  b.fill(9, 8, z, 10, 11, z, 'air');
  b.fill(9, 7, z, 10, 7, z, h.floor);
  window(b, { x: 9, y: 14, z, facing: 'south', width: 2, height: 2, style: 'framed', frame: h.trim, sill: h.sill });
  // Gesims und Brüstung über dem Flachdach
  for (let x = h.x0; x <= h.x1; x++) b.set(x, WALL_TOP, z + 1, st('polished_granite_stairs', 'north', 'top'));
}

function terracottaFront(b, h) {
  const z = DEPTH;
  const box = { trapdoor: 'jungle_trapdoor', soil: 'rooted_dirt', flowers: ['poppy', 'red_tulip', 'orange_tulip', 'dandelion'] };
  for (const x of [14, 18]) window(b, { x, y: 4, z, facing: 'south', width: 1, height: 2, flowerBox: box });
  doorway(b, { x: h.doorX, y: 3, z, facing: 'south', door: h.door, frame: h.trim });
  for (const y of [LEVELS[1], LEVELS[2]]) {
    balcony(b, { x: 16, y, z, facing: 'south', width: 3, depth: 2, floor: 'smooth_sandstone', railing: 'iron_bars', supports: 'smooth_sandstone_stairs' });
    doorway(b, { x: 16, y: y + 1, z, facing: 'south', door: h.door, frame: null });
    b.set(16, y + 3, z, 'glass_pane');
    for (const x of [14, 18]) window(b, { x, y: y + 2, z, facing: 'south', width: 1, height: 2, shutters: 'jungle_trapdoor' });
  }
}

function cornerFront(b, h) {
  const z = DEPTH;
  window(b, { x: 21, y: 4, z, facing: 'south', width: 2, height: 2, sill: h.sill, shutters: h.wood.trapdoor });
  doorway(b, { x: h.doorX, y: 3, z, facing: 'south', door: h.door, frame: h.trim, canopy: h.wood.stairs });
  for (const y of [9, 14]) for (const x of h.windows) window(b, { x, y, z, facing: 'south', width: 1, height: 2, sill: h.sill, shutters: h.wood.trapdoor });
  // Seitenfenster in der freien Ostwand
  for (const y of [4, 9, 14]) window(b, { x: h.x1, y, z: 5, facing: 'east', width: 1, height: 2, sill: h.sill, shutters: h.wood.trapdoor });
}

function backWindows(b, h) {
  const { a, c } = inner(h);
  const x = Math.floor((a + c) / 2) + 1;
  for (const y of [9, 14]) window(b, { x, y, z: 0, facing: 'north', width: 1, height: 2, sill: h.sill });
  window(b, { x: c, y: 4, z: 0, facing: 'north', width: 1, height: 2, sill: h.sill });
}

// ------------------------------------------------------------------ Dächer

function roofs(b) {
  b.phase('Dächer');
  for (const h of HOUSES) {
    if (h.roof.type === 'flat') {
      b.walls(h.x0, ROOF_Y, 0, h.x1, ROOF_Y, DEPTH, 'granite_wall');
      continue;
    }
    const axis = h.roof.type === 'gable-front' ? 'z' : 'x';
    const type = h.roof.type === 'hip' ? 'hip' : 'gable';
    b.roof({ x1: h.x0, z1: 0, x2: h.x1, z2: DEPTH, y: ROOF_Y, type, axis, stairs: h.roof.stairs, slab: h.roof.slab, full: h.roof.full, overhang: 0 });
  }
  b.step();
  for (const h of HOUSES) {
    const stairsId = h.roof.type === 'flat' ? 'polished_granite_stairs' : h.roof.stairs;
    for (let x = h.x0; x <= h.x1; x++) {
      if (h.roof.type !== 'gable-front' && b.get(x, WALL_TOP, DEPTH + 1) === 'air') b.set(x, WALL_TOP, DEPTH + 1, st(stairsId, 'north', 'top'));
      b.set(x, WALL_TOP, -1, st(stairsId, 'south', 'top'));
    }
  }
  b.step();
  dormer(b, { x: 3, y: ROOF_Y + 1, z: DEPTH, facing: 'south', width: 3, wall: 'bricks', corner: 'smooth_quartz', stairs: 'deepslate_tile_stairs' });
  dormer(b, { x: 22, y: ROOF_Y + 1, z: DEPTH, facing: 'south', width: 3, wall: 'light_blue_terracotta', corner: 'white_terracotta', stairs: 'deepslate_brick_stairs' });
  window(b, { x: 16, y: ROOF_Y + 1, z: DEPTH, facing: 'south', width: 1, height: 2, sill: 'smooth_sandstone_stairs' });
  window(b, { x: 0, y: ROOF_Y + 1, z: 5, facing: 'west', style: 'round', width: 3, stairs: 'brick_stairs' });
  window(b, { x: 25, y: ROOF_Y + 1, z: 5, facing: 'east', style: 'round', width: 3, stairs: 'spruce_stairs' });
  chimney(b, { x: 6, y: ROOF_Y, z: 2, height: 7, block: 'bricks', smoke: 'normal', rim: 'brick_stairs' });
  chimney(b, { x: 23, y: ROOF_Y, z: 3, height: 7, block: 'bricks', smoke: 'normal', rim: 'brick_stairs' });
}

// ------------------------------------------------------------------ Treppen

function stairsAndStoops(b) {
  b.phase('Treppen und Eingangsstufen');
  for (const h of HOUSES) {
    b.step();
    const { a } = inner(h);
    for (const y of [LEVELS[0], LEVELS[1]]) straightStairs(b, { x: a, y: y + 1, z: 8, facing: 'north', width: 1, height: 5, stairs: h.wood.stairs, support: null });
    for (const y of [LEVELS[1] + 1, LEVELS[2] + 1]) for (let z = 5; z <= 7; z++) b.set(a + 1, y, z, h.wood.fence);
    straightStairs(b, { x: h.doorX, y: 1, z: DEPTH + 2, facing: 'north', width: 1, height: 2, stairs: 'stone_brick_stairs', support: h.plinth, railing: h.name === 'Terrakottahaus' ? null : 'iron_bars' });
  }
}

// ------------------------------------------------------------------ Einrichtung

function furnish(b) {
  b.phase('Einrichtung');
  for (const h of HOUSES) {
    const { a, c } = inner(h);
    const wide = c - a + 1 === 5;
    const wood = h.wood;
    b.step();
    const y0 = LEVELS[0] + 1;
    kitchen(b, { x: a, y: y0, z: 1, facing: 'south', width: c - a + 1, wood });
    diningTable(b, { x: a + 2, y: y0, z: 3, length: wide ? 2 : 1, width: 1, wood, headChairs: wide });
    b.set(c, y0, 6, st(wood.stairs, 'east'));
    b.set(c, y0, 7, st(wood.stairs, 'east'));
    b.set(c, y0, 5, trapdoorOpen(wood.trapdoor, 'north'));
    b.set(c - 1, y0, 6, `${h.color === 'gruen' ? 'green' : h.color === 'hellblau' ? 'light_blue' : h.color === 'orange' ? 'orange' : 'red'}_carpet`);
    b.set(c - 1, y0, 7, b.get(c - 1, y0, 6));
    b.set(a + 1, y0, 9, 'potted_fern');

    b.step();
    const y1 = LEVELS[1] + 1;
    bedroom(b, { x: a + 1, y: y1, z: 1, facing: 'south', width: c - a, depth: 3, wood, color: h.color, rug: null, double: c - a >= 4 });
    b.set(c, y1, 8, slab(wood.slab, 'top'));
    b.set(c, y1 + 1, 8, formatState('lantern', { hanging: 'false' }));
    b.set(c - 1, y1, 8, st(wood.stairs, 'west'));
    b.set(c, y1, 6, 'bookshelf');
    b.set(c, y1 + 1, 6, 'bookshelf');
    b.set(c, y1 + 2, 6, 'potted_azalea_bush');

    b.step();
    const y2 = LEVELS[2] + 1;
    topFloor(b, h, a, c, y2);
  }
}

function topFloor(b, h, a, c, y) {
  const wood = h.wood;
  if (h.top === 'atelier') {
    b.set(c, y, 2, 'loom');
    b.set(c, y, 3, formatState('cartography_table'));
    b.set(c, y, 1, 'barrel');
    b.set(c, y + 1, 1, 'potted_cactus');
    b.fill(a + 2, y, 7, a + 3, y, 9, 'white_carpet');
    b.set(c - 1, y, 2, st(wood.stairs, 'west'));
    b.set(a + 2, y, 1, formatState('chest', { facing: 'south', type: 'single' }));
    b.set(a + 3, y, 1, 'decorated_pot');
    b.set(a + 2, y, 9, 'potted_flowering_azalea_bush');
  } else if (h.top === 'bibliothek') {
    bookWall(b, { x: a + 1, y, z: 1, facing: 'south', width: c - a, height: 3, wood: 'schwarzeiche', crown: false });
    b.set(a + 2, y, 8, formatState('lectern', { facing: 'north', has_book: 'false', powered: 'false' }));
    b.set(c, y, 8, st(wood.stairs, 'west'));
    b.set(c, y, 9, 'potted_fern');
    b.fill(a + 1, y, 3, c, y, 4, 'green_carpet');
  } else if (h.top === 'kinder') {
    bedroom(b, { x: a + 1, y, z: 1, facing: 'south', width: c - a, depth: 3, wood, color: 'gelb', rug: null });
    b.set(c, y, 8, 'jukebox');
    b.set(c, y, 7, 'note_block');
    b.fill(a + 2, y, 6, c - 1, y, 8, 'orange_carpet');
    b.set(a + 1, y, 9, formatState('chest', { facing: 'north', type: 'single' }));
  } else {
    workshop(b, { x: a + 1, y, z: 1, facing: 'south', width: c - a, wood });
    storage(b, { x: c, y, z: 6, facing: 'west', width: 3, height: 2, barrel: false });
  }
}

function lights(b) {
  b.phase('Licht');
  b.step();
  for (const h of HOUSES) {
    const { a, c } = inner(h);
    for (const y of LEVELS) lightRoom(b, { x1: a, y1: y + 1, z1: 1, x2: c, y2: y + 4, z2: DEPTH - 1 });
    if (h.roof.type !== 'flat') lightRoom(b, { x1: a, y1: ROOF_Y, z1: 1, x2: c, y2: ROOF_Y, z2: DEPTH - 1 }, { mode: 'floor' });
  }
  b.step();
  for (const x of [-1, 7, 13, 20, 26]) lampPost(b, { x, y: 1, z: 14, facing: 'south', height: 5, post: 'dark_oak_fence', base: 'polished_blackstone', style: 'arm' });
}

function gardens(b) {
  b.phase('Gärten und Gehweg');
  b.step();
  for (let x = -1; x <= 26; x++) b.set(x, 1, -6, WOOD.fichte.fence);
  for (const x of [-1, 6, 12, 19, 26]) for (let z = -5; z <= -1; z++) b.set(x, 1, z, WOOD.fichte.fence);
  b.step();
  tree(b, { x: 3, y: 1, z: -3, species: 'eiche', size: 'klein', seed: 2 });
  flowerBed(b, { x: 7, y: 0, z: -5, width: 5, depth: 2, facing: 'south', palette: 'kuehl', seed: 3 });
  bush(b, { x: 9, y: 1, z: -2, size: 'klein', leaves: 'birke', seed: 1 });
  b.fill(14, 0, -4, 18, 0, -4, formatState('farmland', { moisture: '7' }));
  b.fill(14, 0, -3, 18, 0, -3, formatState('farmland', { moisture: '7' }));
  b.set(16, 0, -3, 'water');
  for (let x = 14; x <= 18; x++) for (const z of [-4, -3]) if (b.get(x, 0, z).startsWith('farmland')) b.set(x, 1, z, formatState(x % 2 ? 'carrots' : 'potatoes', { age: '7' }));
  b.set(14, 1, -1, 'composter');
  flowerBed(b, { x: 20, y: 0, z: -5, width: 6, depth: 2, facing: 'south', palette: 'rosa', seed: 6 });
  b.set(24, 1, -2, formatState('dark_oak_stairs', { facing: 'north', half: 'bottom' }));
  b.set(23, 1, -2, formatState('dark_oak_stairs', { facing: 'north', half: 'bottom' }));
  b.step();
  b.set(9, 1, 14, st('dark_oak_stairs', 'south'));
  b.set(10, 1, 14, st('dark_oak_stairs', 'south'));
  b.set(8, 1, 14, trapdoorOpen('dark_oak_trapdoor', 'west'));
  b.set(11, 1, 14, trapdoorOpen('dark_oak_trapdoor', 'east'));
  b.set(17, 1, 14, 'cauldron');
  b.set(2, 1, 14, 'moss_block');
  b.set(2, 2, 14, 'flowering_azalea');
  b.set(1, 1, 14, trapdoorOpen('spruce_trapdoor', 'west'));
  b.set(3, 1, 14, trapdoorOpen('spruce_trapdoor', 'east'));
  b.set(2, 1, 13, trapdoorOpen('spruce_trapdoor', 'north'));
  b.set(2, 1, 15, trapdoorOpen('spruce_trapdoor', 'south'));
}

export default function build(b) {
  street(b);
  foundations(b);
  walls(b);
  windowsAndDoors(b);
  roofs(b);
  stairsAndStoops(b);
  furnish(b);
  lights(b);
  gardens(b);
}
