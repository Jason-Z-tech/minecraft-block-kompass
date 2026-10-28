// Modernes Haus: zwei versetzte weiße Kuben, große Glasflächen, Dachterrasse mit Whirlpool, Pool mit Holzdeck,
// Carport unter dem auskragenden Obergeschoss. Bau-Rahmen: Garten mit Pool im Süden (+z), Einfahrt im Osten.
// Geländeoberkante y = 0; Erdgeschoss-Boden y = 0, Decke/Terrasse y = 5, Dach y = 10.

import { formatState } from '../../core/blockstate.js';
import { WOOD, doorway, straightStairs, kitchen, diningTable, bookWall, bedroom, fireplace, lightRoom, tree, bush, terrain, vegetation } from '../lib/index.js';

export const meta = {
  id: 'modernes-haus',
  title: 'Modernes Haus',
  category: 'haeuser',
  subtitle: 'Weiße Kuben mit Glasfronten, Dachterrasse, Pool und Carport',
  tags: ['Haus', 'Modern', 'Villa', 'Pool', 'Dachterrasse', 'Flachdach', 'Beton', 'Glas', 'Carport', 'Einrichtung', 'Garten'],
  aliases: [
    'modernes haus', 'modern house', 'modernhouse', 'moderne villa', 'modern villa', 'haus modern', 'bauhaus', 'flachdachhaus',
    'haus mit pool', 'house with pool', 'pool haus', 'poolhaus', 'designerhaus', 'betonhaus', 'quartz house', 'modernes haus mit pool',
    'moderns haus', 'modernes hause',
  ],
  accuracy: 'eigenes',
  description: 'Zwei weiße Kuben aus Beton und Quarz liegen versetzt übereinander: Das Obergeschoss kragt nach Osten über die Einfahrt aus und bildet so den Carport. Auf dem freien Dach des Erdgeschosses liegt eine Dachterrasse mit Glasgeländer und Whirlpool, im Garten ein Pool mit Holzdeck und Liegen. Innen gibt es einen offenen Wohnbereich mit Kamin, Küche und Esstisch, oben Schlafzimmer, Bad und Arbeitsplatz.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const WALL = 'white_concrete';
const PLATE = 'smooth_quartz';
const FRAME = 'gray_concrete';
const GLASS = 'glass_pane';
const CLAD = formatState(spruce.strippedLog, { axis: 'y' });
const FLOOR_GF = 'birch_planks';

const PLOT = { x1: 0, z1: 0, x2: 33, z2: 34 };
const A = { x1: 4, z1: 8, x2: 20, z2: 18 };   // Erdgeschoss (Außenkante)
const B = { x1: 10, z1: 6, x2: 26, z2: 16 };  // Obergeschoss (Außenkante)
const POOL = { x1: 5, z1: 22, x2: 16, z2: 26 };
const DECK = { x1: 2, z1: 19, x2: 20, z2: 29 };
const DRIVE = { x1: 21, x2: 26, z1: 8, z2: 34 };

const st = (id, facing, half = 'bottom') => formatState(id, { facing, half });
const slab = (id, type = 'bottom') => formatState(id, { type });
const endRod = formatState('end_rod', { facing: 'down' });

function ground(b) {
  b.phase('Grundstück');
  terrain(b, { x: PLOT.x1, y: -2, z: PLOT.z1, width: PLOT.x2 - PLOT.x1 + 1, depth: PLOT.z2 - PLOT.z1 + 1, height: 2, seed: 4 });
}

function foundation(b) {
  b.phase('Bodenplatte, Pool und Einfahrt');
  b.fill(A.x1, 0, A.z1, A.x2, 0, A.z2, PLATE);
  b.fill(A.x1 + 1, 0, A.z1 + 1, A.x2 - 1, 0, A.z2 - 1, FLOOR_GF);
  // Pool: Boden y −2, Wände y −1 und Rand y 0
  b.fill(POOL.x1 - 1, -2, POOL.z1 - 1, POOL.x2 + 1, -2, POOL.z2 + 1, WALL);
  b.walls(POOL.x1 - 1, -1, POOL.z1 - 1, POOL.x2 + 1, -1, POOL.z2 + 1, WALL);
  for (let x = POOL.x1 + 1; x < POOL.x2; x += 3) { b.set(x, -1, POOL.z1 - 1, 'sea_lantern'); b.set(x, -1, POOL.z2 + 1, 'sea_lantern'); }
  b.set(POOL.x1 - 1, -1, 24, 'sea_lantern');
  b.set(POOL.x2 + 1, -1, 24, 'sea_lantern');
  b.fill(POOL.x1, -1, POOL.z1, POOL.x2, 0, POOL.z2, 'air');
  b.walls(POOL.x1 - 1, 0, POOL.z1 - 1, POOL.x2 + 1, 0, POOL.z2 + 1, PLATE);
  // Einfahrt
  b.fill(DRIVE.x1, 0, DRIVE.z1, DRIVE.x2, 0, DRIVE.z2, 'polished_andesite');
  for (let z = DRIVE.z1; z <= DRIVE.z2; z++) { b.set(DRIVE.x1, 0, z, 'smooth_stone'); b.set(DRIVE.x2, 0, z, 'smooth_stone'); }
  for (let z = 19; z <= DRIVE.z2; z += 4) { b.set(DRIVE.x1, 0, z, 'sea_lantern'); b.set(DRIVE.x2, 0, z, 'sea_lantern'); }
  // Pooldeck aus Fichtenbrettern rund um den Pool, vom Haus bis zur Einfahrt
  for (let z = DECK.z1; z <= DECK.z2; z++) for (let x = DECK.x1; x <= DECK.x2; x++) {
    const inPool = x >= POOL.x1 - 1 && x <= POOL.x2 + 1 && z >= POOL.z1 - 1 && z <= POOL.z2 + 1;
    if (!inPool) b.set(x, 0, z, spruce.planks);
  }
}

function groundFloorWalls(b) {
  b.phase('Erdgeschoss: Wände und Glas');
  const top = 4;
  b.walls(A.x1, 1, A.z1, A.x2, top, A.z2, WALL);
  // Süden: Glasfront x 5 … 19 mit Pfosten
  for (let x = A.x1 + 1; x < A.x2; x++) b.fill(x, 1, A.z2, x, top, A.z2, [9, 13, 17].includes(x) ? FRAME : GLASS);
  // Westen: Glas links und rechts vom Kamin
  for (const [z1, z2] of [[9, 11], [15, 17]]) b.fill(A.x1, 1, z1, A.x1, top, z2, GLASS);
  // Norden: Fensterband
  b.fill(A.x1 + 1, 3, A.z1, 11, 4, A.z1, GLASS);
  // Osten: Holzverkleidung, Seitenfenster neben der Tür
  b.fill(A.x2, 1, A.z1 + 1, A.x2, top, A.z2 - 1, CLAD);
  b.fill(A.x2, 1, 14, A.x2, top, 15, GLASS);
}

function upperPlate(b) {
  b.phase('Decke und Terrasse');
  b.fill(A.x1 - 1, 5, A.z1, A.x2, 5, A.z2 + 1, PLATE);
  b.fill(B.x1, 5, B.z1, B.x2, 5, B.z2, PLATE);
  b.fill(A.x1, 5, A.z1 + 1, A.x2 - 1, 5, A.z2, spruce.planks);
  b.fill(B.x1 + 1, 5, B.z1 + 1, B.x2 - 1, 5, B.z2 - 1, spruce.planks);
  b.fill(19, 5, 12, 19, 5, 14, 'air');
}

function upperWalls(b) {
  b.phase('Obergeschoss: Wände und Glas');
  const y1 = 6;
  const y2 = 9;
  b.walls(B.x1, y1, B.z1, B.x2, y2, B.z2, WALL);
  for (let x = B.x1 + 1; x < B.x2; x++) b.fill(x, y1, B.z2, x, y2 - 1, B.z2, [16, 20].includes(x) ? FRAME : GLASS);
  // Badfenster nur bis x 14: Der Wasserhahn (Stolperdrahthaken) bei x 15 braucht eine feste Wand, an Glas hält er nicht.
  for (const [x1, x2] of [[11, 14], [17, 19], [21, 25]]) b.fill(x1, 7, B.z1, x2, 8, B.z1, x1 === 11 ? 'white_stained_glass_pane' : GLASS);
  b.fill(B.x1, y1, 12, B.x1, y2 - 1, 14, GLASS);
  b.fill(B.x2, y1, B.z1 + 1, B.x2, y2, B.z2 - 1, CLAD);
  for (const z of [8, 13]) b.fill(B.x2, y1, z, B.x2, y2 - 1, z, GLASS);
  // Innenwände: Schlafzimmer (x 20), Bad (z 11, x 16)
  b.fill(20, y1, B.z1 + 1, 20, y2, B.z2 - 1, WALL);
  b.fill(11, y1, 11, 15, y2, 11, WALL);
  b.fill(16, y1, B.z1 + 1, 16, y2, 11, WALL);
}

function roofs(b) {
  b.phase('Dach und Geländer');
  b.fill(B.x1, 10, B.z1, B.x2, 10, B.z2, PLATE);
  b.fill(18, 10, 12, 19, 10, 15, 'glass');
  for (const z of [8, 9, 13, 14]) for (let x = 12; x <= 16; x++) b.set(x, 11, z, formatState('daylight_detector', { inverted: 'false', power: '0' }));
  for (const z of [8, 9]) for (let x = 21; x <= 24; x++) b.set(x, 11, z, formatState('daylight_detector', { inverted: 'false', power: '0' }));
  for (let x = B.x1; x <= B.x2; x++) { b.set(x, 11, B.z1, slab(`${PLATE}_slab`)); b.set(x, 11, B.z2, slab(`${PLATE}_slab`)); }
  for (let z = B.z1; z <= B.z2; z++) { b.set(B.x1, 11, z, slab(`${PLATE}_slab`)); b.set(B.x2, 11, z, slab(`${PLATE}_slab`)); }
  // Glasgeländer der Dachterrasse
  const xw = A.x1 - 1;
  const zs = A.z2 + 1;
  for (let z = A.z1; z <= zs; z++) b.set(xw, 6, z, GLASS);
  for (let x = xw; x <= A.x2; x++) b.set(x, 6, zs, GLASS);
  for (let x = xw; x < B.x1; x++) b.set(x, 6, A.z1, GLASS);
  for (let z = B.z2 + 1; z <= zs; z++) b.set(A.x2, 6, z, GLASS);
  for (const [x, z] of [[xw, A.z1], [xw, zs], [A.x2, zs]]) b.set(x, 6, z, PLATE);
}

function doorsAndStairs(b) {
  b.phase('Türen und Treppe');
  doorway(b, { x: A.x2, y: 1, z: 16, facing: 'east', door: spruce.door, frame: null });
  straightStairs(b, { x: 19, y: 1, z: 11, facing: 'south', width: 1, height: 5, stairs: spruce.stairs, support: null });
  doorway(b, { x: B.x1, y: 6, z: 13, facing: 'west', door: spruce.door, frame: null });
  doorway(b, { x: 20, y: 6, z: 9, facing: 'west', door: spruce.door, frame: null });
  doorway(b, { x: 16, y: 6, z: 9, facing: 'east', door: 'birch_door', frame: null });
  for (const z of [12, 13, 14]) b.set(18, 6, z, GLASS);
  b.set(19, 6, 11, GLASS);
}

function groundFloorInterior(b) {
  b.phase('Einrichtung Erdgeschoss');
  b.step();
  fireplace(b, { x: A.x1 + 1, y: 1, z: 13, facing: 'east', height: 4, block: 'polished_deepslate', mantel: 'polished_deepslate_stairs' });
  for (let z = 11; z <= 15; z++) b.set(10, 1, z, st('deepslate_tile_stairs', 'east'));
  b.set(10, 1, 10, formatState(spruce.trapdoor, { facing: 'north', half: 'bottom', open: 'true' }));
  b.set(10, 1, 16, formatState(spruce.trapdoor, { facing: 'south', half: 'bottom', open: 'true' }));
  for (let z = 11; z <= 15; z++) for (const x of [8, 9]) b.set(x, 1, z, 'light_gray_carpet');
  for (let z = 12; z <= 14; z++) b.set(8, 1, z, slab(spruce.slab));
  b.set(8, 2, 13, 'potted_blue_orchid');
  for (const [x, z] of [[5, 9], [5, 17], [11, 17]]) b.set(x, 1, z, 'potted_bamboo');

  b.step();
  kitchen(b, { x: 12, y: 1, z: A.z1 + 1, facing: 'south', width: 7, wood: 'fichte' });
  b.fill(13, 1, 12, 16, 1, 12, PLATE);
  b.set(13, 2, 12, 'potted_red_tulip');
  b.set(16, 2, 12, formatState('white_candle', { candles: '3', lit: 'false' }));
  diningTable(b, { x: 13, y: 1, z: 15, length: 3, width: 1, wood: 'fichte', top: 'slab', headChairs: true });
}

function upperInterior(b) {
  b.phase('Einrichtung Obergeschoss');
  b.step();
  bedroom(b, { x: B.x2 - 1, y: 6, z: B.z1 + 1, facing: 'west', width: 9, depth: 5, wood: 'fichte', color: 'grau', rug: 'weiss', double: true });

  b.step();
  for (const x of [11, 12]) b.set(x, 6, 7, formatState('water_cauldron', { level: '3' }));
  b.set(13, 6, 7, PLATE);
  b.set(13, 7, 7, 'potted_fern');
  b.set(15, 6, 7, formatState('water_cauldron', { level: '3' }));
  b.set(15, 7, 7, formatState('tripwire_hook', { facing: 'south', attached: 'false', powered: 'false' }));
  b.set(15, 6, 10, st('smooth_quartz_stairs', 'south'));
  b.set(15, 7, 10, formatState('birch_trapdoor', { facing: 'north', half: 'bottom', open: 'true' }));
  b.set(11, 6, 10, 'barrel');
  b.set(11, 7, 10, formatState('white_candle', { candles: '2', lit: 'false' }));
  b.fill(12, 6, 9, 13, 6, 9, 'light_blue_carpet');

  b.step();
  bookWall(b, { x: 11, y: 6, z: 12, facing: 'south', width: 5, height: 3, wood: 'fichte', chiseled: true, crown: false });
  b.fill(12, 6, 15, 14, 6, 15, slab(spruce.slab, 'top'));
  b.set(13, 6, 14, st(spruce.stairs, 'north'));
  b.set(12, 7, 15, formatState('lantern', { hanging: 'false' }));
  b.set(14, 7, 15, 'potted_cactus');
  b.set(17, 6, 7, st('deepslate_tile_stairs', 'north'));
  b.set(18, 6, 7, st('deepslate_tile_stairs', 'north'));
  b.set(19, 6, 7, 'potted_bamboo');
  b.fill(17, 6, 8, 18, 6, 9, 'gray_carpet');
  for (let z = 13; z <= 14; z++) b.set(17, 6, z, st('deepslate_tile_stairs', 'east'));
  for (let z = 13; z <= 14; z++) b.set(16, 6, z, 'light_gray_carpet');
  b.set(15, 6, 13, 'potted_fern');
}

function terraces(b) {
  b.phase('Dachterrasse und Pooldeck');
  b.step();
  b.walls(4, 6, 9, 7, 6, 12, PLATE);
  b.fill(5, 6, 10, 6, 6, 11, 'water');
  for (let z = 14; z <= 17; z++) b.set(3 + 1, 6, z, st('deepslate_tile_stairs', 'west'));
  b.set(6, 6, 15, slab(spruce.slab));
  b.set(6, 6, 16, slab(spruce.slab));
  for (const [x, z] of [[4, 18], [9, 19], [13, 18], [17, 18]]) b.set(x, 6, z, 'potted_flowering_azalea_bush');
  b.set(8, 6, 9, 'potted_bamboo');

  b.step();
  b.fill(POOL.x1, -1, POOL.z1, POOL.x2, 0, POOL.z2, 'water');

  b.step();
  for (const x of [6, 8, 12, 14]) { b.set(x, 1, 29, st('smooth_quartz_stairs', 'south')); b.set(x, 1, 28, 'white_carpet'); }
  b.fill(10, 1, 28, 10, 3, 28, spruce.fence);
  b.set(10, 4, 28, 'white_wool');
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) b.set(10 + dx, 4, 28 + dz, slab('smooth_quartz_slab', 'top'));
  b.set(18, 1, 21, st('deepslate_tile_stairs', 'east'));
  b.set(18, 1, 22, st('deepslate_tile_stairs', 'east'));
  b.set(17, 1, 21, slab(spruce.slab));
  b.set(17, 2, 21, 'potted_red_tulip');
  b.set(19, 1, 27, 'potted_bamboo');
  b.set(3, 1, 20, 'potted_bamboo');
}

function lights(b) {
  b.phase('Licht');
  b.step();
  for (const [x, z] of [[7, 10], [7, 16], [12, 14], [15, 10], [17, 16], [16, 14]]) b.set(x, 4, z, endRod);
  for (const [x, z] of [[17, 9], [17, 14], [13, 8], [13, 13], [23, 9], [23, 13]]) b.set(x, 9, z, endRod);
  for (const [x, z] of [[23, 10], [23, 14], [24, 7]]) b.set(x, 4, z, endRod);
  lightRoom(b, { x1: A.x1 + 1, y1: 1, z1: A.z1 + 1, x2: A.x2 - 1, y2: 4, z2: A.z2 - 1 });
  lightRoom(b, { x1: 21, y1: 6, z1: B.z1 + 1, x2: B.x2 - 1, y2: 9, z2: B.z2 - 1 });
  lightRoom(b, { x1: 11, y1: 6, z1: B.z1 + 1, x2: 15, y2: 9, z2: 10 });
  lightRoom(b, { x1: 11, y1: 6, z1: 12, x2: 19, y2: 9, z2: B.z2 - 1 });
  lightRoom(b, { x1: 16, y1: 6, z1: B.z1 + 1, x2: 19, y2: 9, z2: 11 });
}

// Blumen direkt auf den Rasen (y = 1) im Rechteck x1 … x2 × z1 … z2; pick(x, z) wählt die Blume.
function plantRows(b, x1, x2, z1, z2, pick) {
  for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) b.set(x, 1, z, pick(x, z));
}

function garden(b) {
  b.phase('Garten');
  b.step();
  for (let z = PLOT.z1; z <= PLOT.z2; z++) for (const y of [1, 2]) { b.set(PLOT.x1, y, z, formatState('dark_oak_leaves', { persistent: 'true' })); b.set(PLOT.x2, y, z, formatState('dark_oak_leaves', { persistent: 'true' })); }
  for (let x = PLOT.x1 + 1; x < PLOT.x2; x++) for (const y of [1, 2]) b.set(x, y, PLOT.z1, formatState('dark_oak_leaves', { persistent: 'true' }));
  b.step();
  tree(b, { x: 5, y: 1, z: 3, species: 'birke', size: 'mittel', seed: 3 });
  tree(b, { x: 17, y: 1, z: 3, species: 'birke', size: 'gross', seed: 8 });
  tree(b, { x: 30, y: 1, z: 25, species: 'birke', size: 'mittel', seed: 5 });
  for (const [x, z] of [[29, 9], [29, 15], [29, 31]]) bush(b, { x, y: 1, z, size: 'klein', leaves: 'azalee', seed: x + z });
  b.step();
  plantRows(b, 1, 2, 9, 17, (x, z) => (x === 1 ? 'blue_orchid' : (z % 2 ? 'cornflower' : 'allium')));
  plantRows(b, 2, 19, 31, 32, (x, z) => (z === 31 ? 'white_tulip' : (x % 3 === 0 ? 'lily_of_the_valley' : 'oxeye_daisy')));
  b.step();
  vegetation(b, { x: PLOT.x1 + 1, y: 0, z: PLOT.z1 + 1, width: PLOT.x2 - PLOT.x1 - 1, depth: PLOT.z2 - PLOT.z1, mix: 'wiese', density: 0.2, seed: 6 });
}

export default function build(b) {
  ground(b);
  foundation(b);
  groundFloorWalls(b);
  upperPlate(b);
  upperWalls(b);
  roofs(b);
  doorsAndStairs(b);
  groundFloorInterior(b);
  upperInterior(b);
  terraces(b);
  lights(b);
  garden(b);
}
