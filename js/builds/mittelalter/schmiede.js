// Schmiede – offene Dorfschmiede mit Esse, Amboss, Schleifstein, Werkzeugwand, Wassertrog und Kohlelager.
// Rahmen: Vorderseite (offen) nach Süden (+z), Grundfläche x 0 … 12, z 0 … 9; Boden auf y = 0 bündig mit der Wiese.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, chimney, supportPost, hangingLantern, wallLantern, floorPattern, lightRoom,
  tree, bush, path, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'schmiede',
  title: 'Schmiede',
  category: 'mittelalter',
  subtitle: 'Offene Dorfschmiede mit Esse, Amboss und Wassertrog',
  tags: ['Mittelalter', 'Dorf', 'Werkstatt', 'Schmied', 'Esse', 'Amboss', 'Fachwerk', 'Klein'],
  aliases: [
    'schmiede', 'schmide', 'schmiedte', 'dorfschmiede', 'mittelalter schmiede', 'mittelalterliche schmiede', 'waffenschmiede',
    'hufschmied', 'esse', 'werkstatt schmied', 'blacksmith', 'smithy', 'forge', 'blacksmith house', 'medieval blacksmith',
    'medieval forge', 'minecraft schmiede',
  ],
  accuracy: 'eigenes',
  description: 'Eine offene Dorfschmiede: Rückwand und Westseite aus Bruchstein, vorne und an der Ostseite stehen Schwarzeichenpfosten mit Kopfbändern unter einem Fichtendach. In der gemauerten Esse glüht Lava sicher hinter Glas, flankiert von zwei Hochöfen, darüber zieht ein Ziegelschlot durchs Dach. Davor stehen Amboss, Schleifstein und ein Abschreckkessel, an den Wänden Werkzeugregale, ein Wassertrog und das Kohlelager.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

// Grundriss
const X1 = 0;
const X2 = 12;
const Z1 = 0;
const Z2 = 9;
const WALL_TOP = 4;
const POST_TOP = 3;

// Bruchsteinmauer: unten mehr Moos, oben vereinzelt Stein und Andesit (fest je Position).
function rubble(x, y, z) {
  const h = hashPosition(x, y, z, 4242) % 20;
  if (y === 1) return h < 7 ? 'mossy_cobblestone' : 'cobblestone';
  if (h < 2) return 'andesite';
  if (h < 5) return 'stone';
  return 'cobblestone';
}

function rubbleWall(b, x1, y1, z1, x2, y2, z2) {
  for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) b.set(x, y, z, rubble(x, y, z));
}

function groundAndFloor(b) {
  b.phase('Gelände und Boden');
  b.step();
  b.fill(-8, 0, -8, 21, 0, 20, 'grass_block');
  floorPattern(b, {
    x: X1, y: 0, z: Z1, width: X2 - X1 + 1, depth: Z2 - Z1 + 1, pattern: 'random', border: 'stone_bricks',
    blocks: [['cobblestone', 5], ['stone', 2], ['andesite', 2], ['mossy_cobblestone', 1]],
  });
}

function wallsAndPosts(b) {
  b.phase('Mauern, Pfosten und Balken');
  b.step();
  rubbleWall(b, X1, 1, Z1, X2, WALL_TOP, Z1);
  rubbleWall(b, X1, 1, Z1, X1, WALL_TOP, Z2);
  for (const [x, z] of [[X1, Z1], [X2, Z1], [X1, Z2]]) b.fill(x, 1, z, x, WALL_TOP, z, `${dark.log}[axis=y]`);
  b.step();
  for (const x of [4, 8]) supportPost(b, { x, y: 1, z: Z2, height: POST_TOP, log: dark.log, braces: dark.stairs });
  supportPost(b, { x: X2, y: 1, z: 5, facing: 'east', height: POST_TOP, log: dark.log, braces: dark.stairs });
  b.fill(X2, 1, Z2, X2, POST_TOP, Z2, `${dark.log}[axis=y]`);
  b.set(X2 - 1, POST_TOP, Z2, `${dark.stairs}[facing=west,half=top]`);
  b.set(X2, POST_TOP, Z2 - 1, `${dark.stairs}[facing=north,half=top]`);
  b.set(X1 + 1, POST_TOP, Z2, `${dark.stairs}[facing=east,half=top]`);
  b.step();
  b.fill(X1 + 1, WALL_TOP, Z2, X2, WALL_TOP, Z2, `${dark.strippedLog}[axis=x]`);
  b.fill(X2, WALL_TOP, Z1 + 1, X2, WALL_TOP, Z2 - 1, `${dark.strippedLog}[axis=z]`);
}

// Esse an der Rückwand: Ziegelherd 3 × 2, Lava hinten in der Mitte (ringsum zu), vorne Glas, daneben zwei Hochöfen.
function forge(b) {
  b.phase('Esse');
  b.step();
  b.fill(5, 1, 1, 7, 1, 2, 'bricks');
  b.set(5, 2, 1, 'bricks');
  b.set(7, 2, 1, 'bricks');
  b.set(5, 2, 2, 'blast_furnace[facing=south,lit=true]');
  b.set(7, 2, 2, 'blast_furnace[facing=south,lit=true]');
  b.set(6, 2, 2, 'glass');
  b.step();
  b.set(6, 2, 1, 'lava');
  b.fill(5, 3, 1, 7, 3, 2, 'bricks');
  b.step();
  b.set(5, 4, 1, 'brick_stairs[facing=east,half=bottom]');
  b.set(7, 4, 1, 'brick_stairs[facing=west,half=bottom]');
  for (let x = 5; x <= 7; x++) b.set(x, 4, 2, 'brick_stairs[facing=north,half=bottom]');
}

function roof(b) {
  b.phase('Dach');
  b.roof({ x1: X1, z1: Z1, x2: X2, z2: Z2, y: WALL_TOP, type: 'gable', axis: 'z', stairs: spruce.stairs, slab: spruce.slab, full: 'cobblestone', overhang: 1 });
  // Vorderer Giebel als Fachwerk: helles Gefach aus weißer Terrakotta, Mittelständer, zwei Streben und zwei kleine Fenster.
  b.fill(X1, WALL_TOP + 1, Z2, X2, WALL_TOP + 7, Z2, 'white_terracotta', { replace: 'cobblestone' });
  b.fill(6, WALL_TOP + 2, Z2, 6, WALL_TOP + 6, Z2, `${dark.strippedLog}[axis=y]`);
  b.line(2, WALL_TOP + 2, Z2, 4, WALL_TOP + 4, Z2, dark.strippedLog);
  b.line(10, WALL_TOP + 2, Z2, 8, WALL_TOP + 4, Z2, dark.strippedLog);
  b.set(5, WALL_TOP + 3, Z2, 'glass_pane');
  b.set(7, WALL_TOP + 3, Z2, 'glass_pane');
  // Traufkante an der offenen Ostseite: umgedrehte Treppen unter dem Überstand.
  for (let z = Z1 - 1; z <= Z2 + 1; z++) b.set(X2 + 1, WALL_TOP - 1, z, `${spruce.stairs}[facing=west,half=top]`);
}

function chimneyAndWindow(b) {
  b.phase('Schlot und Fenster');
  b.step();
  chimney(b, { x: 6, y: WALL_TOP, z: 1, height: 9, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
  b.step();
  window(b, { x: X1, y: 2, z: 5, facing: 'west', width: 1, height: 2, glass: 'air', shutters: spruce.trapdoor, sill: spruce.stairs });
}

function furnishing(b) {
  b.phase('Einrichtung');
  b.step();
  b.set(6, 1, 4, 'anvil[facing=east]');
  b.set(4, 1, 3, 'water_cauldron[level=3]');
  b.set(9, 1, 4, 'grindstone[face=floor,facing=east]');
  b.step();
  b.set(1, 1, 1, 'barrel[facing=up]');
  b.set(2, 1, 1, 'smithing_table');
  b.set(3, 1, 1, 'crafting_table');
  for (let x = 1; x <= 3; x++) b.set(x, 3, Z1 + 1, `${spruce.shelf}[facing=south]`);
  b.step();
  for (const [x, y, z] of [[9, 1, 1], [10, 1, 1], [11, 1, 1], [10, 2, 1], [11, 2, 1], [11, 1, 2]]) b.set(x, y, z, 'coal_block');
  b.set(10, 1, 2, 'barrel[facing=up]');
  b.step();
  b.fill(1, 1, 4, 2, 1, 8, `${spruce.strippedLog}[axis=z]`);
  b.set(1, 1, 4, `${spruce.strippedLog}[axis=x]`);
  b.set(1, 1, 8, `${spruce.strippedLog}[axis=x]`);
  b.fill(1, 1, 5, 1, 1, 7, 'water');
  b.step();
  b.set(11, 1, 7, 'barrel[facing=up]');
  b.set(11, 1, 8, 'chest[facing=west,type=single]');
  b.set(11, 2, 7, 'lantern[hanging=false]');
}

function lights(b) {
  b.phase('Licht');
  hangingLantern(b, { x: 2, y: WALL_TOP - 1, z: Z2, chain: 0 });
  hangingLantern(b, { x: 10, y: WALL_TOP - 1, z: Z2, chain: 0 });
  wallLantern(b, { x: X1, y: 3, z: 2, facing: 'east', style: 'bracket', arm: dark.fence });
  lightRoom(b, { x1: X1 + 1, y1: 1, z1: Z1 + 1, x2: X2 - 1, y2: WALL_TOP, z2: Z2 });
}

function surroundings(b) {
  b.phase('Umgebung');
  b.step();
  path(b, { x: 6, y: 0, z: Z2 + 1, facing: 'south', length: 8, width: 3, mix: 'kies', wiggle: 1, seed: 'schmiede' });
  b.step();
  b.fill(14, 1, 2, 16, 1, 5, `${spruce.log}[axis=z]`);
  b.fill(14, 2, 2, 15, 2, 5, `${spruce.log}[axis=z]`);
  b.fill(14, 3, 2, 14, 3, 5, `${spruce.log}[axis=z]`);
  for (const [x, y, z] of [[15, 1, 9], [15, 1, 10], [15, 2, 9]]) b.set(x, y, z, 'hay_block[axis=y]');
  b.step();
  tree(b, { x: -3, y: 1, z: -3, species: 'eiche', size: 'mittel', seed: 7 });
  bush(b, { x: 18, y: 1, z: 13, size: 'klein', seed: 3 });
  bush(b, { x: -4, y: 1, z: 12, size: 'klein', leaves: 'azalee', seed: 5 });
  vegetation(b, { x: -8, y: 2, z: -8, width: 30, depth: 29, mix: 'wiese', density: 0.22, shape: 'eckig', seed: 11 });
}

export default function build(b) {
  groundAndFloor(b);
  wallsAndPosts(b);
  forge(b);
  roof(b);
  chimneyAndWindow(b);
  furnishing(b);
  lights(b);
  surroundings(b);
}
