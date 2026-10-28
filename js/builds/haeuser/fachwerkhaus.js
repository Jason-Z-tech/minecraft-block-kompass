// Fachwerkhaus: zwei Geschosse plus Dachboden, giebelständig (Giebel nach Süden), Obergeschoss vorne 1 Block auskragend.
// Bau-Rahmen: Erdgeschoss x 0 … 8, z 0 … 11; Obergeschoss x 0 … 8, z 0 … 12. Fußboden EG auf y = 0, Gelände y = −1.
// Höhen: EG-Wände y 1 … 5 (Rähm = OG-Boden y 5), OG-Wände y 6 … 10 (Rähm = Dachboden y 10), Kniestock y 11,
// steiles Satteldach (2 Blöcke Steigung je Block) bis y 21.

import {
  WOOD, STONE, window, doorway, chimney, timberWall, brace, straightStairs, gardenFence, lampPost, floorPattern, hangingLantern,
  bedroom, kitchen, diningTable, bookWall, storage, fireplace, lightRoom, tree, bush, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'fachwerkhaus',
  title: 'Fachwerkhaus',
  category: 'haeuser',
  subtitle: 'Zweistöckiges Fachwerkhaus mit steilem Ziegeldach, Erker und Kamin',
  tags: ['Fachwerk', 'Fachwerkhaus', 'Deutschland', 'Altstadt', 'Mittelalter', 'Bürgerhaus', 'Zwei Stockwerke', 'Satteldach', 'Erker', 'Kamin', 'Eingerichtet', 'Schwarzeiche'],
  aliases: [
    'fachwerk', 'fachwerk haus', 'fachwerkhäuschen', 'fachwerckhaus', 'fachwekhaus', 'fachwerkhäuser', 'fachwerkhaus mit erker',
    'deutsches haus', 'altes haus', 'altstadthaus', 'bürgerhaus', 'timber frame house', 'half timbered house', 'half-timbered house',
    'tudor house', 'german house', 'medieval house',
  ],
  accuracy: 'nachempfunden',
  description: 'Ein zweistöckiges Fachwerkhaus wie in einer deutschen Altstadt: dunkles Fachwerk aus geschälter Schwarzeiche mit hellen Kalzit-Feldern auf einem Sockel aus Steinziegeln und Bruchstein. Das Obergeschoss kragt nach vorne aus, im Giebel sitzt ein kleiner Erker, darüber steigt ein steiles Ziegeldach mit Schornstein auf. Innen gibt es Küche und Stube mit Kamin, oben Schlafzimmer und Kammer und unter dem Dach einen Dachboden als Lager.',
  sources: [
    { title: 'Wikipedia: Fachwerkhaus', url: 'https://de.wikipedia.org/wiki/Fachwerkhaus' },
  ],
  credits: null,
  tested: null,
};

const dark = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const FRAME = dark.strippedLog;
const FILL = 'calcite';
const ROOF = { stairs: 'brick_stairs', slab: 'brick_slab', full: 'bricks' };
const X0 = 0;
const X1 = 8;
const Z_BACK = 0;
const Z_FRONT_EG = 11;
const Z_FRONT_OG = 12;
const EAVE_Y = 10;
const CENTER_X = 4;
const beam = (axis) => `${FRAME}[axis=${axis}]`;

// Fachwerkwand aus Abschnitten mit gemeinsamen Ständern. side = Außenseite; cuts = Ständer-Positionen entlang der
// Wand (x bei Süd/Nord, z bei West/Ost), aufsteigend; patterns = Muster je Abschnitt.
function frameWall(b, { side, plane, y, height, cuts, patterns }) {
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const c = cuts[i + 1];
    const common = { y, facing: side, length: c - a + 1, height, frame: FRAME, fill: FILL, pattern: patterns[i], spacing: 64 };
    if (side === 'south') timberWall(b, { ...common, x: a, z: plane });
    else if (side === 'north') timberWall(b, { ...common, x: c, z: plane });
    else if (side === 'west') timberWall(b, { ...common, x: plane, z: a });
    else timberWall(b, { ...common, x: plane, z: c });
  }
}

// Reihe k des steilen Dachs (0 = Traufe mit Überstand) für die Spalte x und ihre untere Zelle.
const roofRow = (x) => Math.min(x - (X0 - 1), X1 + 1 - x);
const roofLow = (x) => EAVE_Y + 2 * roofRow(x);

// Steiles Satteldach, First entlang z: unten eine umgedrehte Treppe mit der hohen Seite nach außen, darüber eine normale
// Treppe mit der hohen Seite zum First – so schließen die Reihen dicht aneinander. First: Ziegelblock + Stufe.
function steepRoof(b) {
  for (let z = Z_BACK - 1; z <= Z_FRONT_OG + 1; z++) {
    for (let x = X0 - 1; x <= X1 + 1; x++) {
      const y = roofLow(x);
      if (x === CENTER_X) {
        b.set(x, y, z, ROOF.full);
        b.slab(x, y + 1, z, ROOF.slab, { type: 'bottom' });
        continue;
      }
      const inward = x < CENTER_X ? 'east' : 'west';
      const outward = x < CENTER_X ? 'west' : 'east';
      b.stairs(x, y, z, ROOF.stairs, { facing: outward, half: 'top' });
      b.stairs(x, y + 1, z, ROOF.stairs, { facing: inward, half: 'bottom' });
    }
  }
}

// Giebeldreieck in der Ebene z (ab y 11): unten Ständer bei x 3 und 5 über denen der Wand, kurze Streben außen,
// Riegel auf y 14, darüber die Firstsäule in der Mitte. Felder aus Kalzit.
function gable(b, z) {
  for (let x = X0 + 1; x <= X1 - 1; x++) {
    for (let y = 11; y < roofLow(x); y++) {
      let state = FILL;
      if (y === 14) state = beam('x');
      else if (y < 14 && (x === 3 || x === 5)) state = beam('y');
      else if (y > 14 && x === CENTER_X) state = beam('y');
      else if ((x === 1 && y === 11) || (x === 7 && y === 11) || (x === 2 && y === 12) || (x === 6 && y === 12)) state = beam('y');
      b.set(x, y, z, state);
    }
  }
}

function stoneMix(b, x, y, z) {
  b.set(x, y, z, b.pickWeighted([[STONE.steinziegel.block, 5], ['cobblestone', 3], ['mossy_cobblestone', 1], ['cracked_stone_bricks', 1]]));
}

function site(b) {
  b.phase('Bauplatz');
  b.step();
  b.fill(-8, -1, -6, 18, -1, 23, 'grass_block');
  b.fill(X0, -1, Z_BACK, X1, -1, Z_FRONT_EG, 'dirt');
  b.step();
  floorPattern(b, { x: CENTER_X - 1, y: -1, z: 13, width: 3, depth: 10, pattern: 'random', blocks: [['cobblestone', 4], ['mossy_cobblestone', 2], ['stone', 2], ['andesite', 1]] });
}

function base(b) {
  b.phase('Sockel und Böden');
  for (let x = X0; x <= X1; x++) for (let z = Z_BACK; z <= Z_FRONT_EG; z++) {
    if (x === X0 || x === X1 || z === Z_BACK || z === Z_FRONT_EG) stoneMix(b, x, 0, z);
  }
  floorPattern(b, { x: 1, y: 0, z: 1, width: 7, depth: 4, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'] });
  b.fill(1, 0, 5, 7, 0, 5, spruce.planks);
  floorPattern(b, { x: 1, y: 0, z: 6, width: 7, depth: 5, pattern: 'border', blocks: [spruce.planks, dark.planks] });
}

function groundFloor(b) {
  b.phase('Erdgeschoss');
  b.step();
  frameWall(b, { side: 'south', plane: Z_FRONT_EG, y: 1, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'plain'] });
  frameWall(b, { side: 'north', plane: Z_BACK, y: 1, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'plain'] });
  b.step();
  frameWall(b, { side: 'west', plane: X0, y: 1, height: 5, cuts: [0, 4, 8, 11], patterns: ['plain', 'diagonal', 'plain'] });
  frameWall(b, { side: 'east', plane: X1, y: 1, height: 5, cuts: [0, 4, 8, 11], patterns: ['plain', 'diagonal', 'plain'] });
  b.step();
  timberWall(b, { x: 1, y: 1, z: 5, facing: 'south', length: 7, height: 4, frame: FRAME, fill: 'white_terracotta', pattern: 'plain', spacing: 64 });
}

function upperFloor(b) {
  b.phase('Obergeschoss');
  b.step();
  for (const x of [0, 3, 5, 8]) brace(b, { x, y: 4, z: Z_FRONT_EG, facing: 'south', length: 1, stairs: dark.stairs });
  b.step();
  b.fill(1, 5, 1, 7, 5, 10, spruce.planks);
  b.fill(X0, 5, Z_FRONT_OG, X1, 5, Z_FRONT_OG, beam('z'));
  for (let z = 7; z <= 9; z++) b.set(1, 5, z, 'air');
  b.step();
  frameWall(b, { side: 'south', plane: Z_FRONT_OG, y: 6, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'plain'] });
  frameWall(b, { side: 'north', plane: Z_BACK, y: 6, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'diagonal'] });
  b.step();
  frameWall(b, { side: 'west', plane: X0, y: 6, height: 5, cuts: [0, 4, 8, 12], patterns: ['plain', 'cross', 'plain'] });
  frameWall(b, { side: 'east', plane: X1, y: 6, height: 5, cuts: [0, 4, 8, 12], patterns: ['plain', 'cross', 'plain'] });
  b.step();
  timberWall(b, { x: 1, y: 6, z: 6, facing: 'south', length: 7, height: 4, frame: FRAME, fill: 'white_terracotta', pattern: 'plain', spacing: 64 });
  b.step();
  b.fill(1, 10, 1, 7, 10, 11, spruce.planks);
  for (const x of [X0, X1]) b.fill(x, 11, Z_BACK, x, 11, Z_FRONT_OG, beam('z'));
  b.set(1, 10, 3, 'air');
}

function roof(b) {
  b.phase('Giebel');
  b.step();
  gable(b, Z_FRONT_OG);
  b.step();
  gable(b, Z_BACK);

  b.phase('Dach');
  steepRoof(b);

  b.phase('Kamin');
  b.step();
  fireplace(b, { x: CENTER_X, y: 1, z: 6, facing: 'south', height: 4, block: 'bricks', mantel: dark.stairs });
  b.step();
  chimney(b, { x: CENTER_X, y: 5, z: 6, height: 19, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
}

function openings(b) {
  b.phase('Fenster, Tür und Erker');
  b.step();
  doorway(b, { x: CENTER_X, y: 1, z: Z_FRONT_EG, facing: 'south', door: spruce.door, frame: null, step: 'cobblestone_stairs' });
  b.step();
  for (const x of [2, 6]) window(b, { x, y: 2, z: Z_FRONT_EG, facing: 'south', width: 1, height: 2, flowerBox: true });
  for (const x of [2, 7]) window(b, { x, y: 2, z: Z_BACK, facing: 'north', width: 2, height: 2, shutters: spruce.trapdoor });
  window(b, { x: X0, y: 2, z: 2, facing: 'west', height: 2, shutters: spruce.trapdoor });
  window(b, { x: X1, y: 2, z: 2, facing: 'east', height: 2, shutters: spruce.trapdoor });
  window(b, { x: X0, y: 2, z: 9, facing: 'west', width: 2, height: 2, shutters: spruce.trapdoor });
  window(b, { x: X1, y: 2, z: 10, facing: 'east', width: 2, height: 2, shutters: spruce.trapdoor });
  b.step();
  for (const x of [1, 7]) window(b, { x, y: 7, z: Z_FRONT_OG, facing: 'south', width: 1, height: 2, sill: dark.stairs });
  window(b, { x: 2, y: 7, z: Z_BACK, facing: 'north', width: 2, height: 2, sill: dark.stairs });
  for (const z of [2, 10]) {
    window(b, { x: X0, y: 7, z, facing: 'west', height: 2, shutters: spruce.trapdoor });
    window(b, { x: X1, y: 7, z, facing: 'east', height: 2, shutters: spruce.trapdoor });
  }
  b.step();
  for (const [z, y] of [[Z_FRONT_OG, 12], [Z_BACK, 11]]) b.fill(CENTER_X, y, z, CENTER_X, y + 1, z, 'glass_pane');
  b.step();
  for (let x = 2; x <= 6; x++) {
    b.stairs(x, 5, 13, dark.stairs, { facing: 'north', half: 'top' });
    b.set(x, 6, 13, beam('x'));
    b.set(x, 10, 13, beam('x'));
    b.stairs(x, 11, 13, ROOF.stairs, { facing: 'north' });
  }
  for (const x of [2, 6]) b.fill(x, 7, 13, x, 9, 13, beam('y'));
  b.fill(3, 7, 13, 5, 8, 13, 'glass_pane');
  b.fill(3, 9, 13, 5, 9, 13, FILL);
  b.fill(3, 7, Z_FRONT_OG, 5, 8, Z_FRONT_OG, 'air');
}

function stairsAndLadder(b) {
  b.phase('Treppe und Leiter');
  b.step();
  straightStairs(b, { x: 1, y: 1, z: 6, facing: 'south', width: 1, height: 5, stairs: spruce.stairs, support: null });
  b.step();
  b.fill(2, 6, 7, 2, 6, 9, dark.fence);
  b.step();
  b.fill(1, 6, 3, 1, 10, 3, 'ladder[facing=east]');
}

function interior(b) {
  b.phase('Einrichtung');
  b.step();
  b.door(6, 1, 5, spruce.door, { facing: 'north', hinge: 'right' });
  kitchen(b, { x: 1, y: 1, z: 1, facing: 'south', width: 7, wood: 'fichte', cabinets: false });
  diningTable(b, { x: 3, y: 1, z: 3, facing: 'south', length: 3, width: 1, wood: 'fichte', cloth: 'weiss' });
  b.step();
  for (const x of [3, 5]) {
    b.stairs(x, 1, 9, spruce.stairs, { facing: 'south' });
    b.set(x - 1, 1, 9, `${spruce.trapdoor}[facing=west,half=bottom,open=true]`);
    b.set(x + 1, 1, 9, `${spruce.trapdoor}[facing=east,half=bottom,open=true]`);
  }
  b.set(CENTER_X, 1, 9, 'red_carpet');
  b.fill(3, 1, 8, 5, 1, 8, 'red_carpet');
  b.set(7, 1, 7, 'barrel[facing=up]');
  b.set(7, 2, 7, 'potted_azalea_bush');
  b.step();
  b.door(3, 6, 6, spruce.door, { facing: 'north', hinge: 'left' });
  bedroom(b, { x: 4, y: 6, z: 7, facing: 'south', width: 4, depth: 5, wood: 'schwarzeiche', color: 'rot', rug: 'weiss' });
  b.step();
  bookWall(b, { x: 3, y: 6, z: 1, facing: 'south', width: 5, height: 3, wood: 'schwarzeiche', crown: true });
  storage(b, { x: X1 - 1, y: 6, z: 3, facing: 'west', width: 3, height: 2, chest: 'chest', barrel: true });
  b.set(4, 6, 3, 'cartography_table');
  b.stairs(4, 6, 4, spruce.stairs, { facing: 'south' });
  b.set(5, 6, 3, 'brown_carpet');
  b.set(3, 6, 3, 'brown_carpet');
  b.step();
  for (const [x, z] of [[4, 2], [4, 3], [3, 2]]) b.set(x, 11, z, 'hay_block[axis=y]');
  b.set(4, 12, 2, 'hay_block[axis=x]');
  for (const [x, z] of [[3, 9], [4, 9], [5, 9], [4, 10]]) b.set(x, 11, z, 'barrel[facing=up]');
}

function lights(b) {
  b.phase('Licht');
  b.step();
  hangingLantern(b, { x: CENTER_X, y: 4, z: 3, chain: 0 });
  hangingLantern(b, { x: CENTER_X, y: 4, z: 9, chain: 0 });
  hangingLantern(b, { x: CENTER_X, y: 9, z: 3, chain: 0 });
  hangingLantern(b, { x: 5, y: 9, z: 9, chain: 0 });
  for (const z of [3, 9]) hangingLantern(b, { x: CENTER_X, y: roofLow(CENTER_X) - 1, z, chain: 6 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 7, y2: 4, z2: 4 });
  lightRoom(b, { x1: 1, y1: 1, z1: 6, x2: 7, y2: 4, z2: 10 });
  lightRoom(b, { x1: 1, y1: 6, z1: 1, x2: 7, y2: 9, z2: 5 });
  lightRoom(b, { x1: 1, y1: 6, z1: 7, x2: 7, y2: 9, z2: 11 });
  lightRoom(b, { x1: 1, y1: 11, z1: 1, x2: 7, y2: 13, z2: 11 });
}

// Blumen direkt ins Gras setzen, in kleinen Gruppen derselben Sorte.
function plantFlowers(b, { x1, z1, x2, z2, flowers }) {
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, flowers[(Math.floor((x - x1) / 2) + (z - z1)) % flowers.length]);
}

function garden(b) {
  b.phase('Garten');
  b.step();
  gardenFence(b, { x: -3, y: 0, z: 14, facing: 'south', width: 15, depth: 8, fence: spruce.fence, gate: null, sides: ['left', 'right'], posts: spruce.strippedLog });
  for (const x of [2, 6]) lampPost(b, { x, y: 0, z: 21, facing: 'south', height: 3, style: 'top', post: dark.fence, base: 'mossy_cobblestone' });
  b.step();
  plantFlowers(b, { x1: -1, z1: 16, x2: 1, z2: 19, flowers: ['poppy', 'oxeye_daisy', 'cornflower'] });
  plantFlowers(b, { x1: 7, z1: 16, x2: 9, z2: 19, flowers: ['allium', 'dandelion', 'azure_bluet'] });
  b.step();
  tree(b, { x: 15, y: 0, z: 1, species: 'birke', size: 'mittel', seed: 11 });
  tree(b, { x: 15, y: 0, z: 9, species: 'birke', size: 'klein', seed: 12 });
  bush(b, { x: -3, y: 0, z: 1, size: 'klein', leaves: 'eiche', seed: 3 });
  bush(b, { x: -4, y: 0, z: 9, size: 'mittel', leaves: 'azalee', seed: 4 });
  b.step();
  vegetation(b, { x: -8, y: 0, z: -6, width: 27, depth: 30, mix: 'wiese', density: 0.22, shape: 'eckig', seed: 8 });
}

export default function build(b) {
  site(b);
  base(b);
  groundFloor(b);
  upperFloor(b);
  roof(b);
  openings(b);
  stairsAndLadder(b);
  interior(b);
  lights(b);
  garden(b);
}
