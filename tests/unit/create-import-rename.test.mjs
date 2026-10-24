// Zustände fremder Dateien auf 26.2 bringen (js/create/import/rename.js): Umbenennungstabelle gegen die echten
// Blockdaten, Namensraum, Luftarten, unbekannte Blöcke/Eigenschaften/Werte mit Anzahl je ID, __proto__-Schutz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureData } from '../fixtures/core/setup.mjs';
import { setBlockData, hasBlock, completeState } from '../../js/core/block-data.js';
import { BLOCK_RENAMES, DROPPED_IDS, StateConverter, parseForeignState, splitName, propsFromCompound } from '../../js/create/import/rename.js';

const GAME_BLOCKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'game-data', 'blocks.json');
const hasGameData = fs.existsSync(GAME_BLOCKS);
const dataTest = hasGameData ? test : test.skip;

dataTest('Umbenennungstabelle: alter Name fehlt in 26.2, neuer Name existiert (echte game-data/blocks.json)', () => {
  setBlockData(JSON.parse(fs.readFileSync(GAME_BLOCKS, 'utf8')));
  for (const [from, { to, since }] of Object.entries(BLOCK_RENAMES)) {
    assert.equal(hasBlock(from), false, `${from} darf es in 26.2 nicht mehr geben`);
    assert.equal(hasBlock(to), true, `${to} muss es in 26.2 geben`);
    assert.match(since, /^1\.\d+(\.\d+)?$/);
  }
  for (const id of DROPPED_IDS) assert.equal(hasBlock(id), true, id);
  const conv = new StateConverter();
  const grass = conv.fromString('minecraft:grass');
  assert.equal(conv.palette[grass.index], 'short_grass');
  const chain = conv.fromString('minecraft:chain[axis=z,waterlogged=true]');
  assert.equal(conv.palette[chain.index], 'iron_chain[axis=z,waterlogged=true]');
  conv.count(grass, 12);
  assert.deepEqual(conv.warnings(), ['„grass“ heißt in Minecraft 26.2 „short_grass“ – 12 Blöcke umbenannt.']);
});

test('parseForeignState: Namensraum, Eigenschaften, Rest, Unlesbares', () => {
  const s = parseForeignState(' minecraft:Oak_Stairs[facing=North, half=top] ');
  assert.equal(s.namespace, 'minecraft');
  assert.equal(s.id, 'oak_stairs');
  assert.deepEqual([...s.props], [['facing', 'north'], ['half', 'top']]);
  assert.equal(s.trailing, '');
  assert.equal(parseForeignState('stone').namespace, 'minecraft');
  assert.equal(parseForeignState('create:shaft[axis=y]').namespace, 'create');
  assert.equal(parseForeignState('minecraft:chest[facing=east]{Items:[]}').trailing, '{Items:[]}');
  assert.equal(parseForeignState('minecraft:stone{x:1}').id, 'stone');
  for (const bad of ['', 'minecraft:oak_stairs[facing=north', 'a b', 'stone[facing]', 'x'.repeat(2000), 42, null]) {
    assert.equal(parseForeignState(bad), null, String(bad).slice(0, 20));
  }
  assert.deepEqual(splitName('minecraft:Stone'), { namespace: 'minecraft', id: 'stone' });
  assert.equal(splitName('a:b:c'), null);
  assert.deepEqual([...propsFromCompound({ Facing: 'East', lit: 1 })], [['facing', 'east'], ['lit', '1']]);
});

test('StateConverter: vervollständigt, benennt um, lässt weg und zählt je ID', () => {
  loadFixtureData();
  const conv = new StateConverter();
  const stairs = conv.fromString('minecraft:oak_stairs[facing=west]');
  assert.equal(conv.palette[stairs.index], completeState('oak_stairs[facing=west]'));
  assert.equal(conv.fromString('minecraft:oak_stairs[facing=west]'), stairs, 'Ergebnis wird zwischengespeichert');
  const fromCompound = conv.fromCompound({ Name: 'minecraft:oak_stairs', Properties: { facing: 'west' } });
  assert.equal(fromCompound.index, stairs.index, 'gleiche Palette für Text und Compound');
  for (const air of ['minecraft:air', 'minecraft:cave_air', 'void_air', 'minecraft:structure_void']) {
    assert.equal(conv.fromString(air).index, 0, air);
  }
  const wall = conv.fromString('cobblestone_wall[north=true,south=false,up=true]');
  assert.equal(conv.palette[wall.index], completeState('cobblestone_wall[north=low,south=none,up=true]'));
  const mod = conv.fromString('create:shaft[axis=y]');
  const unknown = conv.fromString('minecraft:not_a_block');
  const badValue = conv.fromCompound({ Name: 'minecraft:oak_log', Properties: { axis: 'w' } });
  const extraProp = conv.fromString('minecraft:stone[shiny=true]');
  const broken = conv.fromString('minecraft:stone[');
  assert.equal(mod.index, 0);
  assert.equal(unknown.index, 0);
  assert.equal(broken.index, 0);
  assert.equal(conv.palette[badValue.index], completeState('oak_log'));
  assert.equal(conv.palette[extraProp.index], 'stone');
  conv.count(mod, 7);
  conv.count(unknown, 1);
  conv.count(badValue, 3);
  conv.count(extraProp, 2);
  conv.count(broken, 5);
  conv.count(conv.fromString('minecraft:chain'), 4);
  assert.deepEqual(conv.warnings(), [
    'Block „create:shaft“ stammt aus einer Mod und fehlt in Minecraft 26.2 – 7 Blöcke weggelassen.',
    'Unlesbarer Blockzustand „minecraft:stone[“ – 5 Blöcke weggelassen.',
    '„chain“ heißt in Minecraft 26.2 „iron_chain“ – 4 Blöcke umbenannt.',
    '„oak_log“ mit axis=w gibt es in 26.2 nicht – bei 3 Blöcken Standardwert gesetzt.',
    '„stone“ hat in 26.2 keine Eigenschaft „shiny“ – bei 2 Blöcken ignoriert.',
    'Unbekannter Block „not_a_block“ (gibt es in Minecraft 26.2 nicht) – 1 Block weggelassen.',
  ]);
  const summary = conv.summary();
  assert.deepEqual(summary.renamed, [['chain', 4]]);
  assert.deepEqual(summary.dropped, [['create:shaft', 7], ['minecraft:stone[', 5], ['not_a_block', 1]]);
  assert.equal(summary.fixedValues, 3);
  assert.equal(summary.ignoredProps, 2);
  // Ungenutzte Einträge erzeugen keine Warnung
  conv.fromString('minecraft:never_used');
  assert.equal(conv.warnings().length, 6);
});

test('StateConverter: __proto__ und constructor als Name oder Eigenschaft sind harmlos', () => {
  loadFixtureData();
  const conv = new StateConverter();
  for (const text of ['__proto__', 'minecraft:__proto__', 'constructor', 'stone[__proto__=x]', 'stone[constructor=1,toString=2]']) {
    const entry = conv.fromString(text);
    conv.count(entry, 1);
  }
  const entry = conv.fromCompound({ Name: 'minecraft:oak_log', Properties: JSON.parse('{"__proto__":{"axis":"x"}}') });
  assert.equal(conv.palette[entry.index], completeState('oak_log'));
  assert.equal({}.axis, undefined);
  assert.deepEqual(conv.palette, ['air', 'stone', completeState('oak_log')]);
  const summary = conv.summary();
  assert.ok(Array.isArray(summary.dropped));
  assert.deepEqual(summary.dropped.map(([id]) => id).sort(), ['__proto__', 'constructor']);
});

test('StateConverter braucht geladene Blockdaten und begrenzt die Warnungen', async () => {
  const { clearBlockData } = await import('../../js/core/block-data.js');
  clearBlockData();
  assert.throws(() => new StateConverter(), /Blockdaten sind nicht geladen/);
  loadFixtureData();
  const conv = new StateConverter();
  for (let i = 0; i < 60; i++) conv.count(conv.fromString(`mod:block_${i}`), i + 1);
  const lines = conv.warnings();
  assert.equal(lines.length, 41);
  assert.match(lines[0], /mod:block_59/);
  assert.equal(lines[40], '… und 20 weitere Hinweise zu Blockzuständen.');
});
