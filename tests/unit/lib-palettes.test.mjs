// Paletten der Hilfsbibliothek (§9.1): jede Rolle ist eine echte Block-ID aus 26.2 und passt zu ihrer Art.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WOOD, STONE, COPPER, COLOR, COLOR_IDS, GLASS, FLOWERS, WARM_FLOWERS, COOL_FLOWERS, POTTED,
  WOOD_ROLES, STONE_ROLES, COPPER_ROLES, COLOR_ROLES, allPalettes,
} from '../../js/builds/lib/palettes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOCKS_FILE = path.join(ROOT, 'game-data', 'blocks.json');
const hasGameData = fs.existsSync(BLOCKS_FILE);
const dataTest = hasGameData ? test : test.skip;
const blockIds = () => new Set(Object.keys(JSON.parse(fs.readFileSync(BLOCKS_FILE, 'utf8')).blocks));

// Rolle → erwartetes Muster der ID (fängt vertauschte Rollen ab).
const ROLE_PATTERNS = {
  stairs: /_stairs$/, slab: /_slab$/, wall: /_wall$/, fence: /_fence$/, fenceGate: /_fence_gate$/, door: /_door$/,
  trapdoor: /_trapdoor$/, button: /_button$/, pressurePlate: /_pressure_plate$/, sign: /_sign$/, wallSign: /_wall_sign$/,
  hangingSign: /_hanging_sign$/, wallHangingSign: /_wall_hanging_sign$/, shelf: /_shelf$/, planks: /_planks$/,
  pottedSapling: /^potted_/, brickStairs: /_stairs$/, brickSlab: /_slab$/, brickWall: /_wall$/, polishedStairs: /_stairs$/,
  polishedSlab: /_slab$/, polishedWall: /_wall$/, tileStairs: /_stairs$/, tileSlab: /_slab$/, tileWall: /_wall$/,
  smoothStairs: /_stairs$/, smoothSlab: /_slab$/, cutStairs: /_stairs$/, cutSlab: /_slab$/, roughStairs: /_stairs$/,
  roughSlab: /_slab$/, roughWall: /_wall$/, mossyStairs: /_stairs$/, mossySlab: /_slab$/, mossyWall: /_wall$/,
  darkStairs: /_stairs$/, darkSlab: /_slab$/, redStairs: /_stairs$/, redSlab: /_slab$/, redWall: /_wall$/,
  mosaicStairs: /_stairs$/, mosaicSlab: /_slab$/, mossy: /^mossy_/, cracked: /^cracked_/, crackedTiles: /^cracked_/,
  chiseled: /(^|_)chiseled_/, chiseledBricks: /^chiseled_/, polished: /^polished_/, smooth: /^smooth_/, cut: /cut_/,
  grate: /_grate$/, bulb: /_bulb$/, bars: /_bars$/, chain: /_chain$/, lantern: /_lantern$/, chest: /_chest$/,
  lightningRod: /lightning_rod$/, wool: /_wool$/, carpet: /_carpet$/, concrete: /_concrete$/, concretePowder: /_concrete_powder$/,
  terracotta: /_terracotta$/, glazedTerracotta: /_glazed_terracotta$/, stainedGlass: /_stained_glass$/,
  stainedGlassPane: /_stained_glass_pane$/, bed: /_bed$/, candle: /_candle$/, banner: /_banner$/, wallBanner: /_wall_banner$/,
  shulkerBox: /_shulker_box$/,
};

function checkPalette(kind, name, palette, roles, ids) {
  assert.ok(Object.isFrozen(palette), `${kind}.${name} ist nicht eingefroren`);
  for (const role of roles) assert.ok(role in palette, `${kind}.${name}: Rolle ${role} fehlt`);
  for (const [role, id] of Object.entries(palette)) {
    if (id === null) continue;
    assert.equal(typeof id, 'string', `${kind}.${name}.${role}`);
    assert.ok(ids.has(id), `${kind}.${name}.${role} = ${id} gibt es in 26.2 nicht`);
    const pattern = ROLE_PATTERNS[role];
    if (pattern) assert.match(id, pattern, `${kind}.${name}.${role} = ${id} passt nicht zur Rolle`);
  }
}

dataTest('Holz-Paletten: alle 12 Hölzer, jede Rolle eine echte ID', () => {
  const ids = blockIds();
  assert.deepEqual(Object.keys(WOOD), ['eiche', 'fichte', 'birke', 'dschungel', 'akazie', 'schwarzeiche', 'mangrove', 'kirsche', 'bambus', 'blasseiche', 'karmesin', 'wirr']);
  for (const [name, palette] of Object.entries(WOOD)) {
    checkPalette('WOOD', name, palette, WOOD_ROLES, ids);
    for (const role of ['planks', 'log', 'strippedLog', 'stairs', 'slab', 'fence', 'fenceGate', 'door', 'trapdoor', 'button', 'pressurePlate', 'sign', 'hangingSign', 'sapling']) {
      assert.ok(palette[role], `WOOD.${name}.${role} darf nicht fehlen`);
    }
  }
  assert.equal(WOOD.eiche.log, 'oak_log');
  assert.equal(WOOD.schwarzeiche.strippedWood, 'stripped_dark_oak_wood');
  assert.equal(WOOD.karmesin.log, 'crimson_stem');
  assert.equal(WOOD.wirr.leaves, 'warped_wart_block');
  assert.equal(WOOD.mangrove.sapling, 'mangrove_propagule');
  assert.equal(WOOD.bambus.leaves, null);
  assert.equal(WOOD.bambus.wood, null);
  assert.equal(WOOD.bambus.mosaic, 'bamboo_mosaic');
  // Laub gibt es bei allen Bäumen außer Bambus.
  for (const [name, palette] of Object.entries(WOOD)) if (name !== 'bambus') assert.ok(palette.leaves && palette.wood, name);
});

dataTest('Stein-Paletten: alle geforderten Familien, Hauptset block/stairs/slab vorhanden', () => {
  const ids = blockIds();
  const required = ['stein', 'bruchstein', 'steinziegel', 'tiefenschiefer', 'schwarzstein', 'sandstein', 'roter-sandstein', 'quarz',
    'ziegel', 'schlammziegel', 'tuffstein', 'prismarin', 'endstein', 'netherziegel', 'kupfer'];
  for (const name of required) assert.ok(STONE[name], `STONE.${name} fehlt`);
  for (const [name, palette] of Object.entries(STONE)) {
    checkPalette('STONE', name, palette, STONE_ROLES, ids);
    for (const role of ['block', 'stairs', 'slab']) assert.ok(palette[role], `STONE.${name}.${role} darf nicht fehlen`);
  }
  assert.equal(STONE.steinziegel.mossyWall, 'mossy_stone_brick_wall');
  assert.equal(STONE.stein.wall, null);
  assert.equal(STONE.quarz.wall, null);
  assert.equal(STONE.netherziegel.fence, 'nether_brick_fence');
  assert.equal(STONE.tiefenschiefer.crackedTiles, 'cracked_deepslate_tiles');
});

dataTest('Kupfer: vier Oxidationsstufen, je gewachst und ungewachst', () => {
  const ids = blockIds();
  assert.equal(Object.keys(COPPER).length, 8);
  for (const [name, palette] of Object.entries(COPPER)) {
    checkPalette('COPPER', name, palette, [...STONE_ROLES, ...COPPER_ROLES], ids);
    for (const role of COPPER_ROLES) assert.ok(palette[role], `COPPER.${name}.${role} darf nicht fehlen`);
    assert.equal(STONE[name], palette, 'Kupfer-Paletten stehen auch in STONE');
    assert.equal(name.endsWith('-gewachst'), palette.block.startsWith('waxed_'), name);
  }
  assert.equal(COPPER.kupfer.block, 'copper_block');
  assert.equal(COPPER['kupfer-oxidiert'].block, 'oxidized_copper');
  assert.equal(COPPER['kupfer-verwittert-gewachst'].lantern, 'waxed_weathered_copper_lantern');
  assert.equal(COPPER['kupfer-angelaufen'].lightningRod, 'exposed_lightning_rod');
});

dataTest('Farben, Glas, Blumen und Topfpflanzen sind echte IDs', () => {
  const ids = blockIds();
  assert.equal(Object.keys(COLOR).length, 16);
  assert.deepEqual(Object.keys(COLOR), Object.keys(COLOR_IDS));
  for (const [name, palette] of Object.entries(COLOR)) {
    checkPalette('COLOR', name, palette, COLOR_ROLES, ids);
    for (const role of COLOR_ROLES) assert.ok(palette[role], `COLOR.${name}.${role}`);
  }
  for (const id of [...Object.values(GLASS), ...FLOWERS, ...WARM_FLOWERS, ...COOL_FLOWERS, ...POTTED]) assert.ok(ids.has(id), id);
  for (const id of [...WARM_FLOWERS, ...COOL_FLOWERS]) assert.ok(FLOWERS.includes(id), id);
});

test('Paletten sind eingefroren und vollständig (auch ohne Spieldaten)', () => {
  const all = allPalettes();
  assert.equal(all.wood.length, 12);
  assert.ok(all.stone.length >= 15);
  assert.equal(all.color.length, 16);
  assert.throws(() => { WOOD.eiche.planks = 'stone'; }, TypeError);
  assert.equal(WOOD.eiche.planks, 'oak_planks');
  for (const palette of Object.values(WOOD)) assert.deepEqual(Object.keys(palette), [...WOOD_ROLES]);
  for (const [name, palette] of Object.entries(STONE)) {
    const roles = name.startsWith('kupfer') ? [...STONE_ROLES, ...COPPER_ROLES] : [...STONE_ROLES];
    assert.deepEqual(Object.keys(palette), roles, name);
  }
});
