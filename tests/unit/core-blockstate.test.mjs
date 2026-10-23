import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseState, formatState, normalizeState, withProps, getProp, stateId, isAirState } from '../../js/core/blockstate.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';
import { setBlockData, clearBlockData, hasBlock, blockProps, defaultProps, validateState, completeState, isBlockDataLoaded } from '../../js/core/block-data.js';

test('parseState liest ID und Eigenschaften, kürzt minecraft:', () => {
  assert.deepEqual(parseState('minecraft:oak_stairs[half=bottom,facing=north]'), { id: 'oak_stairs', props: { half: 'bottom', facing: 'north' } });
  assert.deepEqual(parseState('stone'), { id: 'stone', props: {} });
  assert.deepEqual(parseState(' stone[] '), { id: 'stone', props: {} });
  assert.deepEqual(parseState('oak_log[ axis = x ]'), { id: 'oak_log', props: { axis: 'x' } });
});

test('parseState liefert eine Kopie, die man verändern darf', () => {
  const a = parseState('oak_log[axis=x]');
  a.props.axis = 'y';
  assert.equal(parseState('oak_log[axis=x]').props.axis, 'x');
});

test('parseState wirft bei Syntaxfehlern mit deutscher Meldung', () => {
  for (const bad of ['', 'Stone', 'oak_stairs[facing=north', 'oak_stairs[facing]', 'oak_stairs[facing=north,facing=south]',
    'a[b=c]]', 'stone[__proto__=x]', 'foo:bar', 'oak stairs', 'x[a=B]']) {
    assert.throws(() => parseState(bad), /Ungültiger Blockzustand/, bad);
  }
  assert.throws(() => parseState(42), /kein Text/);
});

test('formatState und normalizeState sortieren alphabetisch', () => {
  assert.equal(formatState('oak_stairs', { half: 'top', facing: 'east', shape: null }), 'oak_stairs[facing=east,half=top]');
  assert.equal(formatState('minecraft:stone', {}), 'stone');
  assert.equal(formatState('repeater', { delay: 2 }), 'repeater[delay=2]');
  assert.equal(normalizeState('minecraft:oak_stairs[waterlogged=false,half=bottom,facing=north]'), 'oak_stairs[facing=north,half=bottom,waterlogged=false]');
  assert.throws(() => formatState('oak_log', { axis: 'X' }), /Ungültiger Blockzustand/);
});

test('withProps setzt und löscht, getProp und stateId lesen schnell', () => {
  assert.equal(withProps('oak_stairs[facing=north,half=bottom]', { facing: 'south', half: null, shape: 'outer_left' }), 'oak_stairs[facing=south,shape=outer_left]');
  assert.equal(getProp('oak_stairs[facing=north,half=bottom]', 'half'), 'bottom');
  assert.equal(getProp('oak_stairs[facing=north]', 'shape'), undefined);
  assert.equal(getProp('stone', 'constructor'), undefined);
  assert.equal(stateId('minecraft:oak_stairs[facing=north]'), 'oak_stairs');
  assert.equal(stateId('stone'), 'stone');
  assert.equal(isAirState('cave_air'), true);
  assert.equal(isAirState('stone'), false);
});

test('Blockdaten: ohne setBlockData klare Fehlermeldung', () => {
  clearBlockData();
  assert.equal(isBlockDataLoaded(), false);
  assert.throws(() => hasBlock('stone'), /Blockdaten sind nicht geladen/);
  assert.throws(() => setBlockData({}), /Feld „blocks“ fehlt/);
});

test('Blockdaten: Eigenschaften, Standardwerte, Prüfung, Vervollständigung', () => {
  loadFixtureData();
  assert.equal(hasBlock('oak_stairs'), true);
  assert.equal(hasBlock('banana_block'), false);
  assert.deepEqual(blockProps('oak_log'), { axis: ['x', 'y', 'z'] });
  assert.equal(blockProps('banana_block'), null);
  assert.deepEqual(defaultProps('oak_log'), { axis: 'y' });
  assert.equal(defaultProps('banana_block'), null);

  assert.deepEqual(validateState('oak_stairs[facing=east]'), { ok: true, errors: [] });
  const unknown = validateState('banana_block');
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors[0], /Unbekannter Block „banana_block“/);
  assert.match(validateState('oak_stairs[facing=up]').errors[0], /Ungültiger Wert „up“ für „facing“ bei „oak_stairs“ \(erlaubt: north, south, west, east\)/);
  assert.match(validateState('stone[axis=x]').errors[0], /„stone“ hat keine Eigenschaft „axis“ \(der Block hat keine Eigenschaften\)/);
  assert.match(validateState('oak_stairs[[').errors[0], /Ungültiger Blockzustand/);

  assert.equal(completeState('oak_stairs[facing=east]'), 'oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]');
  assert.equal(completeState('minecraft:stone'), 'stone');
  assert.throws(() => completeState('oak_stairs[facing=up]'), /Ungültiger Wert/);
});
