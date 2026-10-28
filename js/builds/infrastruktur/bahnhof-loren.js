// Loren-Bahnhof: Kopfbahnhof mit zwei Gleisen, Startknopf, Bahnsteig mit Dach, Uhr und Bänken.
// Bau-Rahmen: Empfangsgebäude x 4 … 14, z 0 … 8 (Straße im Norden), Gleise laufen nach Süden (+z).
// Gelände: Erde y = 0, Gras y = 1. Schienen liegen auf y = 2, Bahnsteig und Hallenboden haben ihre Oberkante auf y = 2 (man geht auf y = 3).

import { hashPosition } from '../../core/random.js';
import { window, doorway, arch, supportPost, hangingLantern, wallLantern, lampPost, floorPattern, lightRoom, tree, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'bahnhof-loren',
  title: 'Loren-Bahnhof',
  category: 'infrastruktur',
  subtitle: 'Kopfbahnhof mit zwei Gleisen, Startknopf, überdachtem Bahnsteig, Bahnhofsuhr und Bänken',
  tags: ['Bahnhof', 'Lore', 'Minecart', 'Schienen', 'Antriebsschiene', 'Redstone', 'Station', 'Bahnsteig', 'Uhr', 'Ziegel', 'Verkehr', 'Kopfbahnhof'],
  aliases: [
    'bahnhof', 'lorenbahnhof', 'loren bahnhof', 'loren-bahnhof', 'lorenstation', 'loren station', 'minecart station', 'minecart bahnhof',
    'bahnstation', 'zugbahnhof', 'bahnhoff', 'banhof', 'train station', 'railway station', 'rail station', 'minecart terminal',
    'kopfbahnhof', 'haltestelle', 'schienenbahnhof',
  ],
  accuracy: 'eigenes',
  description: 'Ein kleiner Kopfbahnhof für Loren: zwei Gleise enden an Prellböcken, davor liegen je vier Antriebsschienen und ein Startknopf auf der Bahnsteigkante. Stell die Lore direkt an den Prellbock, setz dich hinein, drück den Knopf – und du rollst los; ankommende Loren bremsen auf denselben Schienen bis zum Stillstand. Darüber spannt sich ein Bahnsteigdach aus Tiefenschiefer auf Holzstützen mit Laternen und Bänken, dahinter steht ein Empfangsgebäude aus Ziegeln mit Fahrkartenschalter, Wartebänken und einer großen Uhr im Giebel.',
  sources: [
    { title: 'Minecraft Wiki: Antriebsschiene (Powered Rail)', url: 'https://minecraft.wiki/w/Powered_Rail' },
    { title: 'Minecraft Wiki: Tutorial Loren (Minecarts)', url: 'https://minecraft.wiki/w/Tutorial:Minecarts' },
  ],
  credits: null,
  tested: false,
};

const AREA = { x1: 0, z1: -6, x2: 20, z2: 46 };
const HALL = { x1: 4, z1: 0, x2: 14, z2: 8, wallTop: 9 };
const FLOOR = 2;
const CONCOURSE = { x1: 2, z1: 9, x2: 16, z2: 11 };
const PLATFORM = { x1: 7, z1: 12, x2: 11, z2: 34 };
const TRACKS = [{ x: 6, edge: 7, outer: 5, name: 'Gleis 1' }, { x: 12, edge: 11, outer: 13, name: 'Gleis 2' }];
const BUFFER_Z = 12;
const LAUNCH = { z1: 13, z2: 16 };
const BOOSTER_Z = 40;
const CANOPY = { x1: 5, z1: 12, x2: 13, z2: 32, posts: [14, 20, 26, 32] };
const BRICK = 'bricks';
const TRIM = 'stone_bricks';

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;
const pick = (entries, x, y, z, salt) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand01(x, y, z, salt) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
};

// --- Bauplatz ---

function site(b) {
  b.phase('Bauplatz');
  b.step();
  b.fill(AREA.x1, 0, AREA.z1, AREA.x2, 0, AREA.z2, 'dirt');
  b.fill(AREA.x1, 1, AREA.z1, AREA.x2, 1, AREA.z2, 'grass_block');
  b.step();
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    for (let z = AREA.z1; z <= -3; z++) b.set(x, 1, z, pick([['andesite', 4], ['stone', 2], ['cobblestone', 1]], x, 1, z, 11));
    for (let z = -2; z <= -1; z++) b.set(x, 1, z, z === -2 && x % 4 === 0 ? 'stone_bricks' : 'smooth_stone');
  }
}

function foundations(b) {
  b.phase('Fundamente und Bahnsteig');
  b.step();
  b.fill(HALL.x1, 1, HALL.z1, HALL.x2, FLOOR, HALL.z2, TRIM);
  b.step();
  b.fill(CONCOURSE.x1, 1, CONCOURSE.z1, CONCOURSE.x2, 1, CONCOURSE.z2, TRIM);
  for (let x = CONCOURSE.x1; x <= CONCOURSE.x2; x++) {
    for (let z = CONCOURSE.z1; z <= CONCOURSE.z2; z++) b.set(x, FLOOR, z, (x + z) % 2 === 0 ? 'polished_andesite' : 'andesite');
  }
  for (let z = CONCOURSE.z1; z <= CONCOURSE.z2; z++) {
    b.stairs(CONCOURSE.x1 - 1, FLOOR, z, 'stone_brick_stairs', { facing: 'east' });
    b.stairs(CONCOURSE.x2 + 1, FLOOR, z, 'stone_brick_stairs', { facing: 'west' });
  }
  b.step();
  for (let z = PLATFORM.z1; z <= PLATFORM.z2; z++) {
    for (let x = PLATFORM.x1; x <= PLATFORM.x2; x++) {
      b.set(x, 1, z, TRIM);
      const d = Math.min(x - PLATFORM.x1, PLATFORM.x2 - x);
      b.set(x, FLOOR, z, d === 0 ? 'smooth_stone' : d === 1 ? 'polished_andesite' : TRIM);
    }
  }
  for (let x = PLATFORM.x1 + 1; x <= PLATFORM.x2 - 1; x++) b.stairs(x, FLOOR, PLATFORM.z2 + 1, 'stone_brick_stairs', { facing: 'north' });
}

// --- Gleise ---

function tracks(b) {
  b.phase('Gleise und Startknopf');
  b.step();
  for (const t of TRACKS) {
    for (let z = BUFFER_Z; z <= AREA.z2; z++) {
      const xs = [t.outer, t.x];
      if (z > PLATFORM.z2 + 1) xs.push(t.edge);
      for (const x of xs) b.set(x, 1, z, z % 2 === 0 ? 'stripped_spruce_log[axis=x]' : 'gravel');
    }
  }
  b.step();
  for (const t of TRACKS) {
    for (const x of [t.outer, t.x]) b.set(x, FLOOR, BUFFER_Z, 'stripped_dark_oak_log[axis=x]');
    b.set(t.x, FLOOR + 1, BUFFER_Z, 'red_terracotta');
    b.set(t.outer, FLOOR + 1, BUFFER_Z, 'dark_oak_slab');
  }
  b.step();
  for (const t of TRACKS) {
    for (let z = LAUNCH.z1; z <= LAUNCH.z2; z++) b.set(t.x, FLOOR, z, 'powered_rail[powered=false,shape=north_south]');
  }
  b.step();
  for (const t of TRACKS) {
    for (let z = LAUNCH.z2 + 1; z <= AREA.z2; z++) {
      if (z === BOOSTER_Z) {
        b.set(t.x, 1, z, 'redstone_block');
        b.set(t.x, FLOOR, z, 'powered_rail[powered=true,shape=north_south]');
      } else b.set(t.x, FLOOR, z, 'rail[shape=north_south]');
    }
  }
  b.step();
  for (const t of TRACKS) b.set(t.edge, FLOOR + 1, LAUNCH.z1, 'polished_blackstone_button[face=floor,facing=south,powered=false]');
}

// --- Empfangsgebäude ---

function hallWalls(b) {
  b.phase('Empfangsgebäude: Wände');
  b.step();
  for (const x of [HALL.x1, HALL.x2]) for (const z of [HALL.z1, HALL.z2]) b.fill(x, FLOOR + 1, z, x, HALL.wallTop, z, TRIM);
  b.step();
  for (let y = FLOOR + 1; y < HALL.wallTop; y++) {
    b.fill(HALL.x1 + 1, y, HALL.z1, HALL.x2 - 1, y, HALL.z1, BRICK);
    b.fill(HALL.x1 + 1, y, HALL.z2, HALL.x2 - 1, y, HALL.z2, BRICK);
    b.fill(HALL.x1, y, HALL.z1 + 1, HALL.x1, y, HALL.z2 - 1, BRICK);
    b.fill(HALL.x2, y, HALL.z1 + 1, HALL.x2, y, HALL.z2 - 1, BRICK);
  }
  b.step();
  b.walls(HALL.x1, HALL.wallTop, HALL.z1, HALL.x2, HALL.wallTop, HALL.z2, TRIM);
  for (const z of [2, 6]) b.fill(HALL.x1 + 1, HALL.wallTop, z, HALL.x2 - 1, HALL.wallTop, z, 'stripped_dark_oak_log[axis=x]');
}

function hallRoof(b) {
  b.phase('Empfangsgebäude: Dach und Uhr');
  b.step();
  b.roof({ x1: HALL.x1, z1: HALL.z1, x2: HALL.x2, z2: HALL.z2, y: HALL.wallTop, type: 'gable', axis: 'z', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: BRICK, overhang: 1 });
  b.step();
  const cx = 9;
  const cy = 11;
  const z = HALL.z2 + 1;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
      const ring = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      const hand = (dx === 0 && dy >= 0) || (dy === 0 && dx === 1);
      const mark = ring && (dx === 0 || dy === 0);
      b.set(cx + dx, cy + dy, z, mark ? 'gold_block' : ring ? 'polished_blackstone' : hand ? 'black_concrete' : 'white_concrete');
    }
  }
}

// Hohes Fenster: Glas 4 hoch, außen Fensterbank (oder Blumenkasten), darüber ein gemeißelter Sturz in der Wand.
function hallWindow(b, x, z, facing, extra = { sill: 'stone_brick_stairs' }) {
  window(b, { x, y: FLOOR + 1, z, facing, height: 4, ...extra });
  b.set(x, FLOOR + 5, z, 'chiseled_stone_bricks');
}

function hallOpenings(b) {
  b.phase('Empfangsgebäude: Tür, Tor und Fenster');
  b.step();
  doorway(b, { x: 9, y: FLOOR + 1, z: HALL.z1, facing: 'north', door: 'dark_oak_door', frame: 'stripped_dark_oak_log', canopy: 'deepslate_tile_stairs', step: 'stone_brick_stairs' });
  b.step();
  arch(b, { x: 9, y: FLOOR + 1, z: HALL.z2, facing: 'south', width: 3, height: 4, block: TRIM, stairs: 'stone_brick_stairs' });
  b.step();
  for (const x of [6, 12]) {
    hallWindow(b, x, HALL.z1, 'north', { flowerBox: { trapdoor: 'dark_oak_trapdoor' } });
    hallWindow(b, x, HALL.z2, 'south');
  }
  for (const z of [2, 6]) {
    hallWindow(b, HALL.x1, z, 'west');
    hallWindow(b, HALL.x2, z, 'east');
  }
  b.step();
  window(b, { x: 9, y: HALL.wallTop + 2, z: HALL.z1, facing: 'north', style: 'round', width: 3, stairs: 'stone_brick_stairs' });
  for (let x = 8; x <= 10; x++) b.stairs(x, HALL.wallTop + 1, HALL.z1 - 1, 'stone_brick_stairs', { facing: 'south', half: 'top' });
}

function hallInterior(b) {
  b.phase('Empfangsgebäude: Einrichtung');
  b.step();
  floorPattern(b, { x: HALL.x1 + 1, y: FLOOR, z: HALL.z1 + 1, width: 9, depth: 7, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'] });
  b.step();
  for (let z = 2; z <= 7; z++) {
    b.set(7, FLOOR + 1, z, 'spruce_planks');
    if (z !== 4) b.set(7, FLOOR + 2, z, 'glass_pane');
    b.slab(7, FLOOR + 3, z, 'spruce_slab', { type: 'top' });
  }
  b.set(5, FLOOR + 1, 2, 'cartography_table');
  b.set(5, FLOOR + 1, 4, 'lectern[facing=east]');
  b.set(5, FLOOR + 1, 6, 'chest[facing=east]');
  b.set(6, FLOOR + 1, 7, 'barrel[facing=up]');
  b.set(6, FLOOR + 2, 7, 'lantern[hanging=false]');
  b.set(7, FLOOR + 2, 4, 'potted_red_tulip');
  b.step();
  for (const z of [2, 3, 5, 6]) b.stairs(13, FLOOR + 1, z, 'spruce_stairs', { facing: 'east' });
  for (const z of [1, 7]) b.set(13, FLOOR + 1, z, `spruce_trapdoor[facing=${z === 1 ? 'north' : 'south'},half=bottom,open=true]`);
  b.set(13, FLOOR + 1, 4, 'barrel[facing=up]');
  b.set(13, FLOOR + 2, 4, 'potted_fern');
  for (let x = 9; x <= 11; x++) for (let z = 3; z <= 5; z++) b.set(x, FLOOR + 1, z, x === 10 && z === 4 ? 'yellow_carpet' : 'red_carpet');
  b.step();
  for (const z of [2, 6]) for (const x of [7, 11]) hangingLantern(b, { x, y: HALL.wallTop - 1, z, chain: 1 });
  lightRoom(b, { x1: HALL.x1 + 1, y1: FLOOR + 1, z1: HALL.z1 + 1, x2: HALL.x2 - 1, y2: HALL.wallTop - 1, z2: HALL.z2 - 1 });
}

// --- Bahnsteigdach ---

function canopy(b) {
  b.phase('Bahnsteigdach');
  b.step();
  for (const z of CANOPY.posts) {
    supportPost(b, { x: 9, y: FLOOR + 1, z, height: 5, log: 'stripped_dark_oak_log', braces: 'dark_oak_stairs' });
    b.fill(9, FLOOR + 6, z, 9, FLOOR + 9, z, 'stripped_dark_oak_log[axis=y]');
    b.fill(CANOPY.x1 + 1, FLOOR + 6, z, 8, FLOOR + 6, z, 'stripped_dark_oak_log[axis=x]');
    b.fill(10, FLOOR + 6, z, CANOPY.x2 - 1, FLOOR + 6, z, 'stripped_dark_oak_log[axis=x]');
  }
  b.step();
  b.roof({ x1: CANOPY.x1, z1: CANOPY.z1, x2: CANOPY.x2, z2: CANOPY.z2, y: FLOOR + 6, type: 'gable', axis: 'z', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'dark_oak_planks', overhang: 0 });
  b.step();
  for (const z of CANOPY.posts) for (const x of [PLATFORM.x1, PLATFORM.x2]) hangingLantern(b, { x, y: FLOOR + 5, z, chain: 0 });
}

function platformFurniture(b) {
  b.phase('Bänke und Fahrplan');
  for (let i = 0; i < CANOPY.posts.length - 1; i++) {
    const z1 = CANOPY.posts[i] + 2;
    const z2 = CANOPY.posts[i] + 3;
    for (let z = z1; z <= z2; z++) {
      b.stairs(9, FLOOR + 1, z, 'spruce_stairs', { facing: 'east' });
      b.stairs(10, FLOOR + 1, z, 'spruce_stairs', { facing: 'west' });
    }
    for (const x of [9, 10]) {
      b.set(x, FLOOR + 1, z1 - 1, 'spruce_trapdoor[facing=north,half=bottom,open=true]');
      b.set(x, FLOOR + 1, z2 + 1, 'spruce_trapdoor[facing=south,half=bottom,open=true]');
    }
  }
  b.set(9, FLOOR + 1, PLATFORM.z1, 'lectern[facing=south]');
  b.set(8, FLOOR + 1, PLATFORM.z1, 'cauldron');
  b.set(10, FLOOR + 1, PLATFORM.z1, 'cauldron');
}

// --- Licht und Umgebung ---

function lights(b) {
  b.phase('Laternen am Gebäude');
  for (const x of [5, 13]) wallLantern(b, { x, y: FLOOR + 4, z: HALL.z2, facing: 'south', style: 'bracket', arm: 'dark_oak_fence' });
  for (const x of [2, 16]) lampPost(b, { x, y: 2, z: -2, facing: 'north', height: 4, post: 'dark_oak_fence', base: 'stone_bricks', style: 'arm' });
  b.step();
  for (let x = CONCOURSE.x1; x <= CONCOURSE.x2; x++) {
    if (x >= PLATFORM.x1 && x <= PLATFORM.x2) continue;
    b.set(x, FLOOR + 1, CONCOURSE.z2, 'dark_oak_fence');
  }
  lightRoom(b, { x1: CANOPY.x1 + 1, y1: FLOOR + 1, z1: CONCOURSE.z1, x2: CANOPY.x2 - 1, y2: FLOOR + 5, z2: CANOPY.z2 });
}

function surroundings(b) {
  b.phase('Umgebung');
  b.step();
  for (let z = CONCOURSE.z2 + 1; z <= AREA.z2; z++) {
    b.set(3, 2, z, 'dark_oak_fence');
    b.set(15, 2, z, 'dark_oak_fence');
  }
  b.step();
  for (const [x, z, seed] of [[1, 18, 1], [18, 24, 2], [1, 36, 3], [18, 42, 4]]) tree(b, { x, y: 2, z, species: 'birke', size: 'klein', seed });
  for (const [x, z, seed] of [[18, 14, 1], [1, 28, 2], [18, 33, 3]]) bush(b, { x, y: 2, z, size: 'klein', leaves: 'eiche', seed });
  bush(b, { x: 1, y: 2, z: 3, size: 'klein', leaves: 'azalee', seed: 4 });
  bush(b, { x: 18, y: 2, z: 4, size: 'klein', leaves: 'azalee', seed: 5 });
  b.step();
  vegetation(b, { x: AREA.x1, y: 2, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 8 });
}

export default function build(b) {
  site(b);
  foundations(b);
  tracks(b);
  hallWalls(b);
  hallRoof(b);
  hallOpenings(b);
  hallInterior(b);
  canopy(b);
  platformFurniture(b);
  lights(b);
  surroundings(b);
}
