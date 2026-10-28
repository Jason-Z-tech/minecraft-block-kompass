// Wachturm: quadratischer Steinturm (9 × 9) mit drei Geschossen, Leiter innen, Zinnenkranz auf Konsolen,
// hölzernem Ausguck mit Pyramidendach und einem Feuerkorb auf der Plattform.
// Koordinaten: Turmmitte bei x = 0, z = 0; Geländeoberkante y = 0; Tür im Süden (+z).

import {
  STONE, WOOD, COLOR, doorway, arrowSlit, window, battlements, wallLantern, hangingLantern, bedroom, storage, lightRoom,
  terrain, path, tree, bush, rock, vegetation, flowerBed,
} from '../lib/index.js';

export const meta = {
  id: 'wachturm',
  title: 'Wachturm',
  category: 'mittelalter',
  subtitle: 'Bemooster Steinturm mit Holzausguck und Feuerkorb',
  tags: ['Turm', 'Mittelalter', 'Burg', 'Wachposten', 'Zinnen', 'Steinziegel', 'Bruchstein', 'Leiter', 'Lagerfeuer', 'Anfänger'],
  aliases: [
    'wachturm', 'wach turm', 'watchtower', 'watch tower', 'guard tower', 'wachtturm', 'wachtrum', 'aussichtsturm',
    'steinturm', 'stone tower', 'turm', 'mittelalterlicher turm', 'medieval tower', 'signalturm', 'feuerturm', 'burgturm',
  ],
  accuracy: 'eigenes',
  description: 'Ein quadratischer Wachturm aus Steinziegeln und Bruchstein, unten kräftig bemoost, mit drei eingerichteten '
    + 'Geschossen: Lager mit Bognertisch, Schlafkammer der Wache und Ausguckstube mit Alarmglocke. Eine Leiter führt innen '
    + 'bis zur Falltür auf der Plattform. Oben sitzt ein Zinnenkranz auf Konsolen, darüber ein offener Holzausguck mit '
    + 'Pyramidendach und Banner, in der Ecke brennt der Feuerkorb.',
  sources: [],
  credits: null,
  tested: null,
};

const stone = STONE.steinziegel;
const spruce = WOOD.fichte;
const darkOak = WOOD.schwarzeiche;

const R = 4; // Mauer bei ±4 → Turm 9 × 9, Innenraum ±3
const FLOORS = [1, 7, 12]; // Fußböden der drei Geschosse
const PLATFORM = 17; // Plattform (Dach des Turms)
const LADDER = [-3, -3]; // Leiter in der Nordwestecke, an der Nordwand

// Mauerstein: unten viel Bruchstein und Moos, nach oben vor allem Steinziegel mit Rissen.
function wallStone(b, y) {
  if (y <= 4) {
    return b.pickWeighted([[stone.rough, 3], [stone.mossy, 3], ['mossy_cobblestone', 2], [stone.block, 3]]);
  }
  if (y <= 9) return b.pickWeighted([[stone.block, 6], [stone.mossy, 3], [stone.cracked, 1], [stone.rough, 1]]);
  return b.pickWeighted([[stone.block, 8], [stone.mossy, 1], [stone.cracked, 2]]);
}

function ring(b, y, r, state) {
  for (let i = -r; i <= r; i++) {
    for (const [x, z] of [[i, -r], [i, r], [-r, i], [r, i]]) b.set(x, y, z, typeof state === 'function' ? state(x, z) : state);
  }
}

// Treppenring (Sockel, Gesims): hohe Seite zur Turmmitte. half 'top' = umgedreht.
function stairRing(b, y, r, id, half) {
  for (let i = -r; i <= r; i++) {
    b.stairs(i, y, -r, id, { facing: 'south', half });
    b.stairs(i, y, r, id, { facing: 'north', half });
    if (Math.abs(i) < r) {
      b.stairs(-r, y, i, id, { facing: 'east', half });
      b.stairs(r, y, i, id, { facing: 'west', half });
    }
  }
}

function groundAndFoundation(b) {
  b.phase('Gelände und Fundament');
  terrain(b, { x: -14, y: -3, z: -14, width: 29, depth: 29, height: 3, shape: 'rund', surface: 'gras', seed: 'wachturm' });
  b.fill(-5, 0, -5, 5, 0, 5, stone.rough);
  b.step();
  path(b, { x: 0, y: 0, z: 6, facing: 'south', length: 9, width: 3, mix: 'kies', wiggle: 1, seed: 'wachturm' });
  rock(b, { x: 8, y: 1, z: -3, size: 'klein', material: 'stein', seed: 4 });
  rock(b, { x: -8, y: 1, z: 9, size: 'mittel', material: 'andesit', seed: 5 });
  flowerBed(b, { x: -5, y: 0, z: 7, width: 3, depth: 2, palette: 'wiese', facing: 'south', seed: 6 });
  b.step();
  ring(b, 1, 5, () => b.pickWeighted([['mossy_cobblestone', 2], [stone.rough, 1]]));
  for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) b.set(x, 1, z, b.pickWeighted([[stone.rough, 2], [stone.block, 2], ['andesite', 1]]));
  stairRing(b, 2, 5, 'cobblestone_stairs', 'bottom');
  b.remove(0, 2, 5);
}

function storyWalls(b, title, y1, y2) {
  b.phase(title);
  for (let y = y1; y <= y2; y++) ring(b, y, R, () => wallStone(b, y));
}

function floorAt(b, y) {
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) b.set(x, y, z, spruce.planks);
  // Balken quer durch den Raum, auf denen die Dielen liegen (sieht man von unten).
  for (const x of [-2, 2]) for (let z = -3; z <= 3; z++) b.set(x, y, z, `${spruce.strippedLog}[axis=z]`);
  b.remove(LADDER[0], y, LADDER[1]);
}

function walls(b) {
  storyWalls(b, 'Erdgeschoss', 2, 6);
  b.phase('Erster Stock');
  floorAt(b, FLOORS[1]);
  for (let y = 7; y <= 11; y++) ring(b, y, R, () => wallStone(b, y));
  stairRing(b, 7, 5, stone.stairs, 'top');
  b.phase('Zweiter Stock');
  floorAt(b, FLOORS[2]);
  for (let y = 12; y <= 16; y++) ring(b, y, R, () => wallStone(b, y));
  stairRing(b, 12, 5, stone.stairs, 'top');
}

function platform(b) {
  b.phase('Plattform und Zinnen');
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) b.set(x, PLATFORM, z, x === -R || x === R || z === -R || z === R ? wallStone(b, PLATFORM) : stone.block);
  const sides = [
    { x: -5, z: R, facing: 'south', block: stone.block },
    { x: R, z: 5, facing: 'east', block: stone.mossy },
    { x: 5, z: -R, facing: 'north', block: stone.block },
    { x: -R, z: -5, facing: 'west', block: stone.mossy },
  ];
  for (const s of sides) {
    battlements(b, { x: s.x, y: PLATFORM + 1, z: s.z, facing: s.facing, length: 11, block: s.block, corbels: stone.stairs, cap: stone.slab });
  }
  b.set(-3, PLATFORM, -3, `${spruce.trapdoor}[facing=south,half=top,open=false]`);
}

function lookout(b) {
  b.phase('Holzausguck');
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.fill(x, 18, z, x, 20, z, `${spruce.log}[axis=y]`);
  for (let i = -2; i <= 2; i++) {
    b.set(i, 21, -2, `${spruce.strippedLog}[axis=x]`);
    b.set(i, 21, 2, `${spruce.strippedLog}[axis=x]`);
    b.set(-2, 21, i, `${spruce.strippedLog}[axis=z]`);
    b.set(2, 21, i, `${spruce.strippedLog}[axis=z]`);
  }
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) b.set(x, 21, z, `${spruce.log}[axis=y]`);
  b.roof({ x1: -2, z1: -2, x2: 2, z2: 2, y: 21, type: 'pyramid', stairs: darkOak.stairs, slab: darkOak.slab, full: darkOak.planks, overhang: 1 });
  b.set(0, 24, 0, `${spruce.log}[axis=y]`);
  b.set(0, 25, 0, spruce.fence);
  b.set(0, 26, 0, `${COLOR.rot.banner}[rotation=0]`);
  hangingLantern(b, { x: 0, y: 23, z: 0, chain: 2 });
  // Brüstung aus Zäunen zwischen den Pfosten an den Seiten ohne Leiter-Ausstieg.
  for (const i of [-1, 0, 1]) {
    b.set(i, 18, 2, spruce.fence);
    b.set(2, 18, i, spruce.fence);
  }
  b.step();
  b.set(4, 18, 4, stone.chiseled);
  b.set(4, 19, 4, 'campfire[facing=south,lit=true,signal_fire=false]');
}

function openings(b) {
  b.phase('Tür, Schießscharten und Fenster');
  doorway(b, { x: 0, y: 2, z: R, facing: 'south', door: spruce.door, frame: null, step: 'cobblestone_stairs' });
  b.set(0, 4, R, stone.chiseled);
  wallLantern(b, { x: 1, y: 3, z: R, facing: 'south', style: 'bracket', arm: spruce.fence });
  // Rote Wandbanner unter dem Gesims links und rechts der Tür.
  for (const x of [-2, 3]) b.set(x, 6, R + 1, `${COLOR.rot.wallBanner}[facing=south]`);
  for (const [x, z, facing] of [[R, 0, 'east'], [-R, 0, 'west'], [0, -R, 'north']]) arrowSlit(b, { x, y: 3, z, facing, height: 3 });
  for (const [x, z, facing] of [[R, 0, 'east'], [-R, 0, 'west'], [0, -R, 'north'], [0, R, 'south']]) {
    arrowSlit(b, { x, y: 8, z, facing, height: 3, style: 'cross' });
    window(b, { x, y: 13, z, facing, width: 3, height: 3, style: 'arched', stairs: stone.stairs, glass: 'glass_pane' });
  }
}

function interior(b) {
  b.phase('Leiter und Einrichtung');
  for (let y = 2; y < PLATFORM; y++) b.set(LADDER[0], y, LADDER[1], 'ladder[facing=south]');

  b.step();
  storage(b, { x: -3, y: 2, z: 3, facing: 'east', width: 5, height: 2 });
  b.set(3, 2, -3, 'crafting_table');
  b.set(3, 2, -2, 'fletching_table');
  b.set(3, 2, -1, 'barrel[facing=up]');
  b.set(3, 2, 3, 'hay_block[axis=y]');
  b.set(3, 2, 2, 'hay_block[axis=z]');
  b.set(3, 3, 3, 'hay_block[axis=x]');
  b.set(2, 2, 3, 'target');
  hangingLantern(b, { x: 0, y: 6, z: 0, chain: 1 });
  lightRoom(b, { x1: -3, y1: 2, z1: -3, x2: 3, y2: 6, z2: 3 });

  b.step();
  bedroom(b, { x: 3, y: 8, z: -3, facing: 'west', width: 7, depth: 4, wood: 'fichte', color: 'rot', rug: null, double: true });
  b.set(-2, 8, 1, spruce.fence);
  b.set(-2, 9, 1, spruce.pressurePlate);
  b.stairs(-2, 8, 2, spruce.stairs, { facing: 'south' });
  b.stairs(-1, 8, 1, spruce.stairs, { facing: 'east' });
  hangingLantern(b, { x: 0, y: 11, z: 0, chain: 0 });
  lightRoom(b, { x1: -3, y1: 8, z1: -3, x2: 3, y2: 11, z2: 3 });

  b.step();
  b.set(3, 13, -3, 'cartography_table');
  b.set(2, 13, -3, 'lectern[facing=south,has_book=true]');
  b.set(3, 13, -2, 'barrel[facing=up]');
  for (const z of [-1, 0, 1]) b.stairs(3, 13, z, spruce.stairs, { facing: 'east' });
  for (const z of [-1, 0, 1]) b.stairs(-3, 13, z, spruce.stairs, { facing: 'west' });
  b.set(0, 16, 0, 'bell[attachment=ceiling,facing=south]');
  for (const [x, z] of [[-2, 2], [2, -2]]) hangingLantern(b, { x, y: 16, z, chain: 0 });
  lightRoom(b, { x1: -3, y1: 13, z1: -3, x2: 3, y2: 16, z2: 3 });
}

function surroundings(b) {
  b.phase('Umgebung');
  tree(b, { x: -10, y: 1, z: -9, species: 'fichte', size: 'mittel', seed: 3 });
  tree(b, { x: 10, y: 1, z: -10, species: 'fichte', size: 'klein', seed: 7 });
  bush(b, { x: 7, y: 1, z: 6, size: 'klein', leaves: 'eiche', seed: 1 });
  bush(b, { x: -7, y: 1, z: 2, size: 'klein', leaves: 'fichte', seed: 2 });
  vegetation(b, { x: -14, y: 4, z: -14, width: 29, depth: 29, mix: 'wiese', density: 0.3, seed: 'wachturm' });
}

export default function build(b) {
  groundAndFoundation(b);
  walls(b);
  platform(b);
  lookout(b);
  openings(b);
  interior(b);
  surroundings(b);
}
