// Block-Suche aus Freitext (js/create/block-lookup.js): Namen, Beugung, Farben, IDs, volle Blöcke, Treppen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  findBlocks, blockForText, blockStem, stairsFor, isPlaceableAlone, isShapeFriendly, blockExists, blockDisplayLabel, blockIdsOf,
} from '../../js/create/block-lookup.js';

// Kleiner Auszug mit echten deutschen/englischen Namen aus Minecraft 26.2
const NAMES = {
  block: {
    stone: { de: 'Stein', en: 'Stone' }, stone_bricks: { de: 'Steinziegel', en: 'Stone Bricks' },
    stone_brick_stairs: { de: 'Steinziegeltreppe', en: 'Stone Brick Stairs' }, glass: { de: 'Glas', en: 'Glass' },
    glass_pane: { de: 'Glasscheibe', en: 'Glass Pane' }, red_stained_glass: { de: 'Rotes Glas', en: 'Red Stained Glass' },
    white_stained_glass: { de: 'Weißes Glas', en: 'White Stained Glass' }, white_concrete: { de: 'Weißer Beton', en: 'White Concrete' },
    sandstone: { de: 'Sandstein', en: 'Sandstone' }, sandstone_stairs: { de: 'Sandsteintreppe', en: 'Sandstone Stairs' },
    oak_planks: { de: 'Eichenholzbretter', en: 'Oak Planks' }, oak_stairs: { de: 'Eichenholztreppe', en: 'Oak Stairs' },
    oak_wood: { de: 'Eichenholz', en: 'Oak Wood' }, oak_log: { de: 'Eichenstamm', en: 'Oak Log' },
    oak_door: { de: 'Eichenholztür', en: 'Oak Door' }, red_bed: { de: 'Rotes Bett', en: 'Red Bed' },
    quartz_block: { de: 'Quarzblock', en: 'Block of Quartz' }, quartz_stairs: { de: 'Quarztreppe', en: 'Quartz Stairs' },
    gold_block: { de: 'Goldblock', en: 'Block of Gold' }, iron_block: { de: 'Eisenblock', en: 'Block of Iron' },
    ice: { de: 'Eis', en: 'Ice' }, green_wool: { de: 'Grüne Wolle', en: 'Green Wool' }, white_wool: { de: 'Weiße Wolle', en: 'White Wool' },
    torch: { de: 'Fackel', en: 'Torch' }, oak_fence: { de: 'Eichenholzzaun', en: 'Oak Fence' }, bricks: { de: 'Ziegelsteine', en: 'Bricks' },
    brick_stairs: { de: 'Ziegeltreppe', en: 'Brick Stairs' }, cobblestone: { de: 'Bruchstein', en: 'Cobblestone' },
    fire: { de: 'Feuer', en: 'Fire' }, air: { de: 'Luft', en: 'Air' }, spruce_wood: { de: 'Fichtenholz', en: 'Spruce Wood' },
    spruce_planks: { de: 'Fichtenholzbretter', en: 'Spruce Planks' },
  },
  item: {},
};
const STAIR_PROPS = { facing: ['north', 'south', 'west', 'east'], half: ['top', 'bottom'], shape: ['straight'], waterlogged: ['true', 'false'] };
const BLOCKS = {
  version: '26.2',
  blocks: Object.fromEntries(Object.keys(NAMES.block).map((id) => {
    let props = {};
    if (id.endsWith('_stairs')) props = STAIR_PROPS;
    if (id === 'oak_door') props = { half: ['upper', 'lower'], facing: ['north'], hinge: ['left'], open: ['false'], powered: ['false'] };
    if (id === 'red_bed') props = { part: ['head', 'foot'], facing: ['north'], occupied: ['false'] };
    return [id, { props, default: {} }];
  })),
};
const opts = { names: NAMES, blocks: BLOCKS };

describe('blockForText mit Beugung und Farben', () => {
  const cases = [
    ['Steinziegeln', 'stone_bricks'],
    ['Steinziegel', 'stone_bricks'],
    ['weißem Beton', 'white_concrete'],
    ['weißer Beton', 'white_concrete'],
    ['weisser beton', 'white_concrete'],
    ['Glas', 'glass'],
    ['rotem Glas', 'red_stained_glass'],
    ['rotes Buntglas', 'red_stained_glass'],
    ['Sandstein', 'sandstone'],
    ['Eisen', 'iron_block'],
    ['Eis', 'ice'],
    ['Holz', 'oak_planks'],
    ['Eichenholzbrettern', 'oak_planks'],
    ['grüner Wolle', 'green_wool'],
    ['Quarz', 'quartz_block'],
    ['Gold', 'gold_block'],
    ['Bruchstein', 'cobblestone'],
    ['stone bricks', 'stone_bricks'],
    ['Stone Bricks', 'stone_bricks'],
    ['minecraft:quartz_block', 'quartz_block'],
    ['stone_bricks', 'stone_bricks'],
    ['Steinziegl', 'stone_bricks'],
  ];
  for (const [text, id] of cases) {
    test(`„${text}“ → ${id}`, () => assert.equal(blockForText(text, opts), id));
  }

  test('Unbekanntes → null', () => {
    assert.equal(blockForText('Unobtanium', opts), null);
    assert.equal(blockForText('', opts), null);
    assert.equal(blockForText(null, opts), null);
    assert.equal(blockForText('<img src=x>', opts), null);
  });

  test('nur Blöcke aus blocks.json', () => {
    const onlyStone = { names: NAMES, blocks: { blocks: { stone: { props: {}, default: {} } } } };
    assert.equal(blockForText('Glas', onlyStone), null);
    assert.equal(blockForText('Stein', onlyStone), 'stone');
  });
});

describe('findBlocks', () => {
  test('Treffer sortiert, mit Name und voll/nicht voll', () => {
    const results = findBlocks('Glas', opts);
    assert.equal(results[0].id, 'glass');
    assert.equal(results[0].name, 'Glas');
    assert.equal(results[0].full, true);
    for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].score >= results[i].score);
  });

  test('fullOnly blendet Scheiben, Zäune und Fackeln aus', () => {
    assert.ok(findBlocks('Glasscheibe', opts).some((r) => r.id === 'glass_pane'));
    assert.ok(!findBlocks('Glasscheibe', { ...opts, fullOnly: true }).some((r) => r.id === 'glass_pane'));
    assert.equal(blockForText('Fackel', { ...opts, fullOnly: true }), null);
    assert.equal(blockForText('Fackel', opts), 'torch');
  });

  test('nicht setzbare Blöcke (Luft, Feuer) tauchen nicht auf', () => {
    assert.equal(blockForText('Luft', opts), null);
    assert.equal(blockForText('Feuer', opts), null);
  });

  test('limit', () => {
    assert.ok(findBlocks('Glas', { ...opts, limit: 2 }).length <= 2);
  });
});

describe('Hilfen', () => {
  test('blockStem: gleiche Stämme für gebeugte Formen', () => {
    assert.equal(blockStem('gruen'), blockStem('gruener'));
    assert.equal(blockStem('weissem'), blockStem('weisser'));
    assert.equal(blockStem('steinziegeln'), blockStem('steinziegel'));
  });

  test('stairsFor findet passende Treppen', () => {
    assert.equal(stairsFor('stone_bricks', opts), 'stone_brick_stairs');
    assert.equal(stairsFor('oak_planks', opts), 'oak_stairs');
    assert.equal(stairsFor('oak_wood', opts), 'oak_stairs');
    assert.equal(stairsFor('quartz_block', opts), 'quartz_stairs');
    assert.equal(stairsFor('bricks', opts), 'brick_stairs');
    assert.equal(stairsFor('sandstone', opts), 'sandstone_stairs');
    assert.equal(stairsFor('glass', opts), null);
    assert.equal(stairsFor('oak_stairs', opts), 'oak_stairs');
    assert.equal(stairsFor('../etc', opts), null);
  });

  test('isPlaceableAlone: Türen, Betten, Luft nein', () => {
    assert.equal(isPlaceableAlone('oak_door', BLOCKS), false);
    assert.equal(isPlaceableAlone('red_bed', BLOCKS), false);
    assert.equal(isPlaceableAlone('air', BLOCKS), false);
    assert.equal(isPlaceableAlone('stone', BLOCKS), true);
  });

  test('isShapeFriendly: Glas ja, Scheibe und Treppe nein', () => {
    assert.equal(isShapeFriendly('glass'), true);
    assert.equal(isShapeFriendly('stone_bricks'), true);
    assert.equal(isShapeFriendly('glass_pane'), false);
    assert.equal(isShapeFriendly('oak_stairs'), false);
  });

  test('blockExists und Blocklisten', () => {
    assert.equal(blockExists('stone', BLOCKS), true);
    assert.equal(blockExists('diamond_ore', BLOCKS), false);
    assert.equal(blockExists('Stone!', BLOCKS), false);
    assert.equal(blockExists('stone', ['stone']), true);
    assert.equal(blockExists('stone', new Set(['glass'])), false);
    assert.deepEqual(blockIdsOf(['a', 3, 'b']), ['a', 'b']);
  });

  test('Anzeige-Label', () => {
    assert.equal(blockDisplayLabel('stone_bricks', NAMES), 'Steinziegel · minecraft:stone_bricks');
    assert.equal(blockDisplayLabel('unknown_block', NAMES), 'unknown_block · minecraft:unknown_block');
  });
});

const GAME_DATA = new URL('../../game-data/', import.meta.url);
const hasGameData = existsSync(new URL('names.json', GAME_DATA)) && existsSync(new URL('blocks.json', GAME_DATA));

describe('mit den echten Spieldaten', { skip: hasGameData ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)' }, () => {
  const real = hasGameData ? {
    names: JSON.parse(readFileSync(new URL('names.json', GAME_DATA), 'utf8')),
    blocks: JSON.parse(readFileSync(new URL('blocks.json', GAME_DATA), 'utf8')),
  } : null;
  const cases = [
    ['Steinziegeln', 'stone_bricks'], ['weißem Beton', 'white_concrete'], ['Glas', 'glass'], ['rotem Glas', 'red_stained_glass'],
    ['Tiefenschieferziegeln', 'deepslate_bricks'], ['Obsidian', 'obsidian'], ['hellgrauem Beton', 'light_gray_concrete'],
    ['Eisen', 'iron_block'], ['Kupfer', 'copper_block'], ['Sandstein', 'sandstone'], ['blauer Wolle', 'blue_wool'],
  ];
  for (const [text, id] of cases) {
    test(`„${text}“ → ${id}`, () => assert.equal(blockForText(text, real), id));
  }
  test('Treppen zu echten Blöcken', () => {
    assert.equal(stairsFor('stone_bricks', real), 'stone_brick_stairs');
    assert.equal(stairsFor('deepslate_bricks', real), 'deepslate_brick_stairs');
    assert.equal(stairsFor('purpur_block', real), 'purpur_stairs');
  });
});
