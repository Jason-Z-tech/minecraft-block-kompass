// Hexenhütte im Sumpf – Hütte auf Mangroven-Stelzen über einem Sumpfteich, mit schiefem Dach, Kessel und Braustand.
// Eigenes Design. Wasserspiegel und Gelände-Oberkante y = −1, Boden der Hütte y = 3, Mitte bei x = 0, z = 0.

import {
  WOOD, window, doorway, straightStairs, lightRoom, lampPost, terrain, pond, tree, bush, vegetation,
} from '../lib/index.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'hexenhuette',
  title: 'Hexenhütte im Sumpf',
  category: 'fantasy',
  subtitle: 'Hütte auf Mangroven-Stelzen mit schiefem Dach, Kessel und Kräutern',
  tags: ['Fantasy', 'Hexe', 'Hütte', 'Sumpf', 'Stelzen', 'Mangrove', 'Fichte', 'Kessel', 'Braustand', 'Seerosen', 'Halloween'],
  aliases: [
    'hexenhütte', 'hexenhuette', 'hexen hütte', 'hexenhaus', 'sumpfhütte', 'sumpfhuette', 'witch hut', 'witch house', 'swamp hut',
    'swamp house', 'hexenhüte', 'hexenhuete', 'stelzenhaus', 'hütte im sumpf', 'hexe sumpf',
  ],
  accuracy: 'nachempfunden',
  description: 'Eine größere Sumpfhütte nach dem Vorbild der Hexenhütten aus dem Spiel: Sie steht auf Mangrovenstämmen mitten in einem Sumpfteich, '
    + 'unten ranken Mangrovenwurzeln, ringsum schwimmen Seerosen. Das schiefe Dach läuft vorne lang und flach über die Veranda, hinten kurz '
    + 'und steil, dazu ein krummer Schornstein. Innen brodelt der Kessel neben zwei Braustationen, auf dem Bord stehen Kräutertöpfe.',
  sources: [{ title: 'Minecraft Wiki: Swamp Hut', url: 'https://minecraft.wiki/w/Swamp_Hut' }],
  credits: null,
  tested: null,
};

const SPRUCE = WOOD.fichte;
const MANGROVE = WOOD.mangrove;
const DARK = WOOD.schwarzeiche;
const WATER_Y = -1;
const FLOOR_Y = 3;
const HUT = { x0: -4, x1: 4, z0: -3, z1: 3 };
const PORCH_Z = 6;
const WALL_TOP = 7;
const RIDGE_Z = -1;
const ROOF_X = [HUT.x0 - 1, HUT.x1 + 1];
const ROOF_Z = [HUT.z0 - 1, PORCH_Z + 1];
const STILTS = [[-4, -3], [4, -3], [0, -3], [-4, 3], [4, 3], [-4, 6], [4, 6], [0, 6]];

function noise(x, y, z, salt) {
  return (hashPosition(x, y, z, salt) % 100000) / 100000;
}

export default function build(b) {
  b.phase('Sumpf');
  buildSwamp(b);

  b.phase('Stelzen und Plattform');
  buildStilts(b);
  buildPlatform(b);

  b.phase('Wände');
  buildWalls(b);

  b.phase('Schiefes Dach');
  buildRoof(b);
  buildChimney(b);

  b.phase('Fenster, Tür und Treppe');
  buildOpenings(b);

  b.phase('Einrichtung');
  b.step();
  furnishBrewing(b);
  b.step();
  furnishLiving(b);
  b.step();
  lightHut(b);

  b.phase('Umgebung');
  buildSurroundings(b);
}

// ---------------------------------------------------------------- Sumpf

function buildSwamp(b) {
  terrain(b, { x: -14, y: -4, z: -13, width: 29, depth: 27, height: 3, shape: 'rund', edge: 2, surface: 'gras', seed: 'sumpf' });
  // Die unterste Lage liegt frei: dort kein Kies, der herunterfallen würde.
  b.fill(-14, -4, -13, 14, -4, 13, 'stone', { replace: 'gravel' });
  pond(b, { x: -11, y: WATER_Y, z: -7, width: 22, depth: 18, facing: 'south', waterDepth: 2, shore: 'ton', seed: 4 });
  for (let z = -13; z <= 13; z++) {
    for (let x = -14; x <= 14; x++) {
      if (b.get(x, WATER_Y, z).split('[')[0] !== 'grass_block' || b.get(x, WATER_Y + 1, z) !== 'air') continue;
      const n = noise(x >> 1, 0, z >> 1, 2) * 0.6 + noise(x, 0, z, 3) * 0.4;
      if (n < 0.2) b.set(x, WATER_Y, z, 'mud');
      else if (n < 0.28) b.set(x, WATER_Y, z, 'rooted_dirt');
    }
  }
}

// ---------------------------------------------------------------- Stelzen, Plattform, Wände

function groundBelow(b, x, z) {
  let y = WATER_Y;
  while (y > -8 && (b.get(x, y, z) === 'air' || b.get(x, y, z).startsWith('water') || b.get(x, y, z).startsWith('seagrass') || b.get(x, y, z).startsWith('tall_seagrass') || b.get(x, y, z).startsWith('lily_pad'))) y--;
  return y;
}

function buildStilts(b) {
  for (const [x, z] of STILTS) {
    const ground = groundBelow(b, x, z);
    for (let y = ground + 1; y < FLOOR_Y; y++) b.set(x, y, z, `${MANGROVE.log}[axis=y]`);
    // Mangrovenwurzeln rund um den Fuß, im Wasser geflutet.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rx = x + dx;
      const rz = z + dz;
      const g = groundBelow(b, rx, rz);
      const height = 1 + (hashPosition(rx, 0, rz, 5) % 2);
      for (let k = 1; k <= height + (WATER_Y - g); k++) {
        const y = g + k;
        if (y > WATER_Y + 1) break;
        const here = b.get(rx, y, rz);
        if (!(here === 'air' || here.startsWith('water') || here.startsWith('seagrass') || here.startsWith('lily_pad'))) break;
        b.set(rx, y, rz, `mangrove_roots[waterlogged=${y <= WATER_Y}]`);
      }
    }
  }
}

function buildPlatform(b) {
  const { x0, x1, z0 } = HUT;
  // Rahmen unter dem Boden, außen herum.
  for (let x = x0; x <= x1; x++) {
    for (const z of [z0, PORCH_Z]) if (!isStilt(x, z)) b.set(x, FLOOR_Y - 1, z, `${MANGROVE.strippedLog}[axis=x]`);
  }
  for (let z = z0 + 1; z < PORCH_Z; z++) for (const x of [x0, x1]) if (!isStilt(x, z)) b.set(x, FLOOR_Y - 1, z, `${MANGROVE.strippedLog}[axis=z]`);
  b.fill(x0, FLOOR_Y, z0, x1, FLOOR_Y, PORCH_Z, SPRUCE.planks);
}

function isStilt(x, z) {
  return STILTS.some(([sx, sz]) => sx === x && sz === z);
}

function buildWalls(b) {
  const { x0, x1, z0, z1 } = HUT;
  b.walls(x0, FLOOR_Y + 1, z0, x1, WALL_TOP, z1, SPRUCE.planks);
  for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) b.set(x, WALL_TOP, z, `${SPRUCE.strippedLog}[axis=x]`);
  for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) b.set(x, WALL_TOP, z, `${SPRUCE.strippedLog}[axis=z]`);
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) b.fill(x, FLOOR_Y, z, x, WALL_TOP, z, `${MANGROVE.log}[axis=y]`);
  for (const [x, y, z] of OPENINGS) b.set(x, y, z, 'air');
}

// Öffnungen in den Wänden (Fenster 1 × 2, Tür), werden beim Mauern frei gelassen.
const OPENINGS = [
  [0, 4, 3], [0, 5, 3],
  [-2, 5, 3], [-2, 6, 3], [2, 5, 3], [2, 6, 3],
  [-4, 5, 0], [-4, 6, 0], [4, 5, 0], [4, 6, 0],
  [-1, 5, -3], [-1, 6, -3],
];

// ---------------------------------------------------------------- Dach

// Dach: First (volle Bretter) auf y = 10 in der Reihe RIDGE_Z. Südlich davon fällt die Fläche um einen halben Block je Reihe
// (in halben Blöcken: 17 über der Südwand), nördlich um einen ganzen Block je Reihe (Treppen).
const RIDGE_Y = 10;

function southHalfHeight(z) {
  return 2 * (WALL_TOP + 1) + 1 + (HUT.z1 - z);
}

function roofWood(x, z) {
  return noise(x, 7, z, 9) < 0.3 ? DARK : SPRUCE;
}

function buildRoof(b) {
  const [rx0, rx1] = ROOF_X;
  const [rz0, rz1] = ROOF_Z;
  for (let z = rz0; z <= rz1; z++) {
    for (let x = rx0; x <= rx1; x++) {
      const wood = roofWood(x, z);
      const gable = (x === HUT.x0 || x === HUT.x1) && z <= HUT.z1;
      if (z === RIDGE_Z) b.set(x, RIDGE_Y, z, wood.planks);
      else if (z < RIDGE_Z) b.set(x, RIDGE_Y - (RIDGE_Z - z), z, `${wood.stairs}[facing=south,half=bottom]`);
      else {
        const s2 = southHalfHeight(z);
        const y = Math.ceil(s2 / 2) - 1;
        const top = s2 % 2 === 0;
        b.set(x, y, z, gable && top ? wood.planks : `${wood.slab}[type=${top ? 'top' : 'bottom'}]`);
        if (top && !gable && noise(x, 1, z, 10) < 0.16) b.set(x, y + 1, z, 'moss_carpet');
      }
    }
  }
  // Giebel im Osten und Westen bis unter die Dachfläche füllen.
  for (const x of [HUT.x0, HUT.x1]) {
    for (let z = HUT.z0; z <= HUT.z1; z++) {
      for (let y = WALL_TOP + 1; y < 20; y++) {
        if (b.get(x, y, z) !== 'air') break;
        b.set(x, y, z, SPRUCE.planks);
      }
    }
  }
  // Verandapfosten tragen den vorderen Dachrand.
  for (const x of [HUT.x0, HUT.x1]) {
    const roofY = Math.ceil(southHalfHeight(PORCH_Z) / 2) - 1;
    for (let y = FLOOR_Y; y < roofY; y++) b.set(x, y, PORCH_Z, `${MANGROVE.log}[axis=y]`);
    b.set(x, roofY, PORCH_Z, SPRUCE.planks);
  }
}

// Krummer Schornstein: steigt an der Nordwand auf und knickt über dem Dach einen Block nach Norden.
function buildChimney(b) {
  const x = 2;
  const z = HUT.z0;
  const stone = (xx, yy, zz) => (noise(xx, yy, zz, 12) < 0.4 ? 'mossy_cobblestone' : 'cobblestone');
  for (let y = FLOOR_Y + 1; y <= 10; y++) b.set(x, y, z, stone(x, y, z));
  b.set(x, 10, z - 1, stone(x, 10, z - 1));
  b.set(x, 11, z - 1, stone(x, 11, z - 1));
  b.set(x, 12, z - 1, stone(x, 12, z - 1));
  b.set(x, 13, z - 1, 'campfire[facing=north,lit=true,signal_fire=false]');
}

// ---------------------------------------------------------------- Öffnungen

function buildOpenings(b) {
  const shutters = DARK.trapdoor;
  window(b, { x: -2, y: 5, z: HUT.z1, facing: 'south', height: 2, shutters, sill: SPRUCE.stairs });
  window(b, { x: 2, y: 5, z: HUT.z1, facing: 'south', height: 2, shutters, sill: SPRUCE.stairs });
  window(b, { x: HUT.x0, y: 5, z: 0, facing: 'west', height: 2, shutters });
  window(b, { x: HUT.x1, y: 5, z: 0, facing: 'east', height: 2, shutters });
  window(b, { x: -1, y: 5, z: HUT.z0, facing: 'north', height: 2, shutters });
  doorway(b, { x: 0, y: FLOOR_Y + 1, z: HUT.z1, facing: 'south', door: SPRUCE.door, frame: null });
  // Zaun um die Veranda, Lücke für die Treppe.
  for (let x = HUT.x0 + 1; x < HUT.x1; x++) if (x !== 2 && x !== 3) b.set(x, FLOOR_Y + 1, PORCH_Z, SPRUCE.fence);
  for (let z = HUT.z1 + 1; z < PORCH_Z; z++) for (const x of [HUT.x0, HUT.x1]) b.set(x, FLOOR_Y + 1, z, SPRUCE.fence);
  b.set(3, FLOOR_Y + 1, PORCH_Z, SPRUCE.fence);
  straightStairs(b, { x: 2, y: 0, z: PORCH_Z + 4, facing: 'north', width: 1, height: 4, stairs: SPRUCE.stairs, support: SPRUCE.planks });
}

// ---------------------------------------------------------------- Einrichtung

function furnishBrewing(b) {
  const y = FLOOR_Y + 1;
  const z = HUT.z0 + 1;
  b.set(-3, y, z, 'barrel[facing=up]');
  b.set(-2, y, z, 'crafting_table');
  b.set(-1, y, z, SPRUCE.planks);
  b.set(-1, y + 1, z, 'brewing_stand[has_bottle_0=true,has_bottle_1=true,has_bottle_2=false]');
  b.set(0, y, z, 'water_cauldron[level=3]');
  b.set(1, y, z, SPRUCE.planks);
  b.set(1, y + 1, z, 'brewing_stand[has_bottle_0=false,has_bottle_1=true,has_bottle_2=true]');
  b.set(-3, y + 1, z, 'potted_red_mushroom');
  // Bord mit Kräutertöpfen über der Arbeitsplatte.
  const herbs = ['potted_brown_mushroom', 'potted_fern', 'potted_blue_orchid', 'potted_dead_bush', 'potted_crimson_roots'];
  [-3, -2, 0, 2, 3].forEach((x, i) => {
    b.set(x, y + 2, z, `${SPRUCE.stairs}[facing=north,half=top]`);
    b.set(x, y + 3, z, herbs[i]);
  });
}

function furnishLiving(b) {
  const y = FLOOR_Y + 1;
  b.bed(-3, y, 1, 'purple_bed', { facing: 'north' });
  b.set(-3, y, -1, 'chiseled_bookshelf[facing=east,slot_0_occupied=true,slot_1_occupied=false,slot_2_occupied=true,slot_3_occupied=true,slot_4_occupied=true,slot_5_occupied=false]');
  b.set(-3, y + 1, -1, 'candle[candles=3,lit=true]');
  b.set(-3, y, 2, 'chest[facing=east]');
  b.set(3, y, 0, 'lectern[facing=west,has_book=true]');
  b.set(3, y, 1, 'chest[facing=west]');
  b.set(3, y, 2, 'chest[facing=west]');
  b.set(2, y, HUT.z0 + 1, 'smoker[facing=south,lit=false]');
  b.set(3, y, HUT.z0 + 1, 'barrel[facing=up]');
  b.set(3, y + 1, HUT.z0 + 1, 'candle[candles=2,lit=true]');
  for (const [x, z] of [[-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, -1]]) b.set(x, y, z, 'brown_carpet');
  b.set(0, y, 0, 'green_carpet');
  // Veranda: Bank, Kürbislaterne, Fässer.
  b.set(-3, y, 5, `${SPRUCE.stairs}[facing=north]`);
  b.set(-2, y, 5, `${SPRUCE.stairs}[facing=north]`);
  b.set(-3, y, 4, 'jack_o_lantern[facing=south]');
  b.set(3, y, 4, 'barrel[facing=up]');
  b.set(3, y + 1, 4, 'potted_red_mushroom');
  b.set(2, y, 4, 'composter');
}

function lightHut(b) {
  const { x0, x1, z0, z1 } = HUT;
  lightRoom(b, { x1: x0 + 1, y1: FLOOR_Y + 1, z1: z0 + 1, x2: x1 - 1, y2: WALL_TOP, z2: z1 - 1 });
  // Veranda: Laternen auf den Zaunpfosten an den Ecken.
  b.set(HUT.x0 + 1, FLOOR_Y + 2, PORCH_Z, 'lantern[hanging=false]');
  b.set(3, FLOOR_Y + 2, PORCH_Z, 'lantern[hanging=false]');
  // Unter der Plattform: zwei Laternen an Ketten.
  for (const x of [-2, 2]) {
    b.set(x, FLOOR_Y - 1, 1, 'iron_chain[axis=y]');
    b.set(x, FLOOR_Y - 2, 1, 'lantern[hanging=true]');
  }
}

// ---------------------------------------------------------------- Umgebung

const VINE_SPOTS = [[-5, 2, 'east'], [5, -2, 'west'], [-5, -1, 'east'], [-2, -4, 'south'], [3, -4, 'south'], [5, 1, 'west']];

function buildSurroundings(b) {
  tree(b, { x: -9, y: 0, z: 9, species: 'mangrove', size: 'mittel', seed: 3 });
  tree(b, { x: 6, y: 0, z: -9, species: 'mangrove', size: 'klein', seed: 4 });
  tree(b, { x: -8, y: 0, z: -9, species: 'mangrove', size: 'klein', seed: 5 });
  // Ranken hängen vom Dachrand an den Wänden herunter.
  for (const [x, z, attach] of VINE_SPOTS) {
    for (let y = WALL_TOP; y >= FLOOR_Y; y--) {
      if (b.get(x, y, z) !== 'air') {
        if (y === WALL_TOP) continue;
        break;
      }
      b.set(x, y, z, `vine[${attach}=true]`);
    }
  }
  lampPost(b, { x: 0, y: 0, z: PORCH_Z + 5, height: 3, post: MANGROVE.fence, style: 'arm', facing: 'east' });
  lampPost(b, { x: 5, y: 0, z: PORCH_Z + 4, height: 2, post: MANGROVE.fence, style: 'top' });
  bush(b, { x: 6, y: 0, z: 9, size: 'klein', leaves: 'mangrove', seed: 6 });
  vegetation(b, { x: -14, y: 2, z: -13, width: 29, depth: 27, mix: 'farn', density: 0.35, seed: 7 });
  for (let z = -13; z <= 13; z++) {
    for (let x = -14; x <= 14; x++) {
      const ground = b.get(x, WATER_Y, z).split('[')[0];
      if (ground !== 'grass_block' || b.get(x, WATER_Y + 1, z) !== 'air') continue;
      if (noise(x, 2, z, 8) < 0.06) b.set(x, WATER_Y + 1, z, 'blue_orchid');
    }
  }
}
