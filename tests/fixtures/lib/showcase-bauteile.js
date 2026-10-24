// Schaukasten der Bauteile (js/builds/lib/bauteile.js): Fachwerkhaus, Burgmauer, Säulen, Marktstand, Bodenmuster.
// Gültiges Bau-Modul – prüfen mit: node scripts/check-build.mjs tests/fixtures/lib/showcase-bauteile.js

import {
  window, doorway, chimney, column, arch, battlements, arrowSlit, balcony, straightStairs, timberWall, brace,
  supportPost, dormer, hangingLantern, wallLantern, lampPost, floorPattern, gardenFence,
} from '../../../js/builds/lib/bauteile.js';
import { WOOD, STONE } from '../../../js/builds/lib/palettes.js';

export const meta = {
  id: 'showcase-bauteile',
  title: 'Schaukasten Bauteile',
  category: 'haeuser',
  subtitle: 'Alle Bauteile der Hilfsbibliothek an einem Fleck',
  tags: ['Test', 'Bibliothek'],
  aliases: ['schaukasten bauteile'],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Fachwerkhaus mit Fenstern, Tür, Gaube und Schornstein, ein Stück Burgmauer mit Tor, Zinnen und Schießscharten, Säulen, ein Marktstand und Bodenmuster.',
  facts: ['Testmodul für die Hilfsbibliothek'],
  sources: [],
  credits: null,
  tested: null,
};

const oak = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const stone = STONE.steinziegel;

function ground(b) {
  b.phase('Gelände', 'Lege die Wiese aus.');
  b.fill(-4, -1, -4, 56, -1, 22, 'grass_block');
}

function house(b) {
  b.phase('Fachwerkhaus', 'Fundament, vier Fachwerkwände und das Dach.');
  b.fill(0, 0, 0, 12, 0, 8, 'cobblestone');
  b.fill(1, 0, 1, 11, 0, 7, spruce.planks);
  timberWall(b, { x: 0, y: 1, z: 8, facing: 'south', length: 13, height: 5, pattern: 'diagonal' });
  timberWall(b, { x: 12, y: 1, z: 0, facing: 'north', length: 13, height: 5, pattern: 'cross' });
  timberWall(b, { x: 0, y: 1, z: 0, facing: 'west', length: 9, height: 5, pattern: 'grid', fill: 'calcite' });
  timberWall(b, { x: 12, y: 1, z: 8, facing: 'east', length: 9, height: 5, pattern: 'plain', fill: 'mud_bricks' });
  b.roof({ x1: 0, z1: 0, x2: 12, z2: 8, y: 5, type: 'gable', axis: 'x', stairs: oak.stairs, slab: oak.slab, full: oak.planks, overhang: 1 });

  b.phase('Fenster und Tür', 'Setze Fenster, Türen, Gaube und Schornstein in die fertigen Wände.');
  window(b, { x: 2, y: 2, z: 8, facing: 'south', width: 1, height: 2, shutters: spruce.trapdoor, flowerBox: true });
  window(b, { x: 10, y: 2, z: 8, facing: 'south', width: 1, height: 2, shutters: spruce.trapdoor, flowerBox: { flowers: ['cornflower', 'allium', 'azure_bluet'] } });
  doorway(b, { x: 6, y: 1, z: 8, facing: 'south', door: spruce.door, frame: null, canopy: oak.stairs, step: 'cobblestone_stairs' });
  doorway(b, { x: 7, y: 1, z: 0, facing: 'north', door: spruce.door, width: 2, frame: null, canopy: { stairs: oak.stairs, depth: 2, posts: oak.fence } });
  window(b, { x: 0, y: 6, z: 4, facing: 'west', style: 'round', width: 3, stairs: oak.stairs });
  window(b, { x: 0, y: 2, z: 2, facing: 'west', width: 1, height: 2, sill: oak.stairs });
  window(b, { x: 0, y: 2, z: 6, facing: 'west', width: 1, height: 2, sill: oak.stairs });
  window(b, { x: 12, y: 5, z: 4, facing: 'east', style: 'arched', width: 3, height: 3, stairs: oak.stairs });
  window(b, { x: 12, y: 2, z: 2, facing: 'east', style: 'framed', width: 1, height: 2, frame: oak.strippedLog, sill: oak.stairs });
  window(b, { x: 2, y: 2, z: 0, facing: 'north', width: 2, height: 2, style: 'framed', frame: oak.strippedLog });
  dormer(b, { x: 6, y: 6, z: 8, facing: 'south', wall: spruce.planks, corner: oak.log, stairs: oak.stairs });
  chimney(b, { x: 13, y: 0, z: 6, facing: 'east', height: 11, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
  wallLantern(b, { x: 12, y: 3, z: 4, facing: 'east', style: 'shelf', shelf: oak.stairs });
  wallLantern(b, { x: 0, y: 3, z: 4, facing: 'west', style: 'bracket', arm: oak.fence });
  hangingLantern(b, { x: 6, y: 4, z: 4, chain: 1 });

  b.phase('Vorgarten', 'Zaun mit Torpfosten, Laternen und Weg.');
  gardenFence(b, { x: -1, y: 0, z: 11, facing: 'south', width: 15, depth: 6, sides: ['front', 'left', 'right'], posts: spruce.strippedLog, lanterns: true });
  floorPattern(b, { x: 6, y: -1, z: 9, width: 1, depth: 10, pattern: 'random', blocks: [['dirt_path', 3], ['coarse_dirt', 1], ['gravel', 1]] });
  lampPost(b, { x: 4, y: 0, z: 19, facing: 'east', height: 3, style: 'arm', post: oak.fence, base: 'mossy_cobblestone' });
}

function castle(b) {
  b.phase('Burgmauer', 'Mauer mit Tor, Schießscharten und Zinnen.');
  b.fill(16, 0, 2, 32, 6, 3, stone.block);
  arch(b, { x: 24, y: 0, z: 3, facing: 'south', width: 3, height: 4, style: 'pointed', depth: 2, block: stone.block, stairs: stone.stairs });
  arrowSlit(b, { x: 19, y: 2, z: 3, facing: 'south', style: 'cross', depth: 2 });
  arrowSlit(b, { x: 29, y: 2, z: 3, facing: 'south', depth: 2 });
  battlements(b, { x: 16, y: 7, z: 3, facing: 'south', length: 17, corbels: stone.stairs, cap: stone.slab });
  battlements(b, { x: 32, y: 7, z: 2, facing: 'north', length: 17, block: 'mossy_stone_bricks' });
  balcony(b, { x: 24, y: 5, z: 4, facing: 'south', width: 3, depth: 2, floor: spruce.planks, railing: spruce.fence, supports: spruce.stairs });
  straightStairs(b, { x: 30, y: 0, z: 11, facing: 'north', width: 2, height: 7, stairs: stone.stairs, support: stone.block, railing: 'stone_brick_wall' });
  lampPost(b, { x: 22, y: 0, z: 6, facing: 'south', height: 4, style: 'double', post: 'stone_brick_wall', base: stone.chiseled });
  lampPost(b, { x: 26, y: 0, z: 6, height: 3, style: 'top', post: 'stone_brick_wall' });

  b.phase('Säulen und Bögen', 'Eine Säulenreihe und ein Rundbogen-Durchgang.');
  column(b, { x: 36, y: 0, z: 3, height: 5 });
  column(b, { x: 40, y: 0, z: 3, height: 5, shaft: 'polished_deepslate', base: 'polished_deepslate', capital: 'chiseled_deepslate', trim: 'deepslate_brick_stairs' });
  column(b, { x: 44, y: 0, z: 3, height: 5, shaft: 'stripped_birch_log', base: 'smooth_sandstone', capital: 'chiseled_sandstone', trim: null });
  b.fill(35, 0, 9, 45, 5, 9, 'sandstone');
  arch(b, { x: 38, y: 0, z: 9, width: 3, height: 4, block: 'cut_sandstone', stairs: 'sandstone_stairs' });
  arch(b, { x: 43, y: 0, z: 9, width: 4, height: 4, block: 'cut_sandstone', stairs: 'sandstone_stairs' });
}

function stall(b) {
  b.phase('Marktstand', 'Pfosten mit Kopfbändern, Balken und Dach.');
  for (const [x, z] of [[48, 2], [53, 2], [48, 6], [53, 6]]) supportPost(b, { x, y: 0, z, height: 3, log: oak.log, braces: oak.stairs });
  for (const z of [2, 6]) b.fill(47, 3, z, 54, 3, z, `${oak.log}[axis=x]`);
  b.fill(47, 4, 1, 54, 4, 7, spruce.slab);
  brace(b, { x: 47, y: 2, z: 4, facing: 'west', length: 1, stairs: oak.stairs });
  brace(b, { x: 54, y: 2, z: 4, facing: 'east', length: 2, stairs: oak.stairs, beam: oak.log });
  b.fill(47, 0, 4, 47, 3, 4, `${oak.log}[axis=y]`);
  b.fill(54, 0, 4, 54, 3, 4, `${oak.log}[axis=y]`);
  hangingLantern(b, { x: 50, y: 3, z: 4, chain: 1 });
}

function floors(b) {
  b.phase('Bodenmuster', 'Sieben Muster nebeneinander.');
  const patterns = [
    ['checker', ['polished_andesite', 'polished_diorite']],
    ['herringbone', [WOOD.eiche.strippedLog, oak.strippedLog]],
    ['diamond', ['smooth_stone', 'polished_andesite', 'stone_bricks']],
    ['rings', ['bricks', 'terracotta']],
    ['border', ['oak_planks', 'dark_oak_planks']],
    ['stripes', ['birch_planks', 'spruce_planks']],
    ['random', [['stone_bricks', 4], ['mossy_stone_bricks', 2], ['cracked_stone_bricks', 1]]],
  ];
  patterns.forEach(([pattern, blocks], i) => {
    floorPattern(b, { x: 16 + i * 6, y: -1, z: 14, width: 5, depth: 5, pattern, blocks });
  });
}

export default function build(b) {
  ground(b);
  house(b);
  castle(b);
  stall(b);
  floors(b);
}
