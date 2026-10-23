import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlockVolume, chunkKey } from '../../js/core/volume.js';
import { createRandom, hashSeed, hashPosition } from '../../js/core/random.js';

test('Setzen und Lesen mit negativen Koordinaten und an Chunk-Grenzen', () => {
  const v = new BlockVolume();
  const points = [[0, 0, 0], [-1, -1, -1], [15, 15, 15], [16, 16, 16], [-16, 0, 0], [-17, 5, 31], [16383, -16384, 7]];
  points.forEach(([x, y, z], i) => v.set(x, y, z, i % 2 ? 'stone' : 'minecraft:oak_log[axis=x]', i));
  for (const [i, [x, y, z]] of points.entries()) {
    assert.equal(v.get(x, y, z), i % 2 ? 'stone' : 'oak_log[axis=x]');
    assert.equal(v.getStep(x, y, z), i);
    assert.equal(v.has(x, y, z), true);
  }
  assert.equal(v.count, points.length);
  assert.equal(v.get(1, 0, 0), 'air');
  assert.equal(v.get(-2, -1, -1), 'air');
  assert.equal(v.getStep(1, 0, 0), -1);
  assert.equal(v.getIndex(99999, 0, 0), 0);
  // (-1,-1,-1) liegt im Chunk (-1,-1,-1) an der lokalen Stelle (15,15,15)
  const chunk = v.chunks.get(chunkKey(-1, -1, -1));
  assert.ok(chunk);
  assert.equal(chunk.blocks[(15 * 16 + 15) * 16 + 15], v.getIndex(-1, -1, -1));
});

test('Überschreiben, Luft entfernt, Zählung und leere Chunks', () => {
  const v = new BlockVolume();
  v.set(3, 3, 3, 'stone');
  v.set(3, 3, 3, 'dirt', 4);
  assert.equal(v.get(3, 3, 3), 'dirt');
  assert.equal(v.getStep(3, 3, 3), 4);
  assert.equal(v.count, 1);
  v.set(3, 3, 3, 'air');
  assert.equal(v.count, 0);
  assert.equal(v.chunks.size, 0);
  assert.equal(v.bounds, null);
  v.set(1, 1, 1, 'stone');
  assert.equal(v.delete(1, 1, 1), true);
  assert.equal(v.delete(1, 1, 1), false);
  v.set(2, 2, 2, 'cave_air');
  assert.equal(v.count, 0);
  assert.equal(v.paletteIndex('air'), 0);
  assert.equal(v.palette[0], 'air');
});

test('Grenzen werden nach dem Löschen richtig neu berechnet', () => {
  const v = new BlockVolume();
  v.set(-5, 2, 0, 'stone');
  v.set(10, 7, -3, 'stone');
  v.set(0, 0, 0, 'stone');
  assert.deepEqual(v.bounds, { min: [-5, 0, -3], max: [10, 7, 0] });
  v.delete(10, 7, -3);
  assert.deepEqual(v.bounds, { min: [-5, 0, 0], max: [0, 2, 0] });
  const b = v.bounds;
  b.min[0] = 100;
  assert.deepEqual(v.bounds.min, [-5, 0, 0]);
});

test('Ungültige Eingaben werfen', () => {
  const v = new BlockVolume();
  assert.throws(() => v.set(0.5, 0, 0, 'stone'), /ganze Zahlen/);
  assert.throws(() => v.set(16384, 0, 0, 'stone'), /außerhalb/);
  assert.throws(() => v.set(0, 0, 0, 'stone', 65535), /Schrittnummer/);
  assert.throws(() => v.set(0, 0, 0, 'Stone!'), /Ungültiger Blockzustand/);
  assert.throws(() => v.setIndex(0, 0, 0, 5), /Paletten-Index/);
  assert.equal(v.setStep(0, 0, 0, 3), false);
});

test('Palette dedupliziert gleiche Zustände in verschiedener Schreibweise', () => {
  const v = new BlockVolume();
  const a = v.paletteIndex('oak_stairs[half=bottom,facing=north]');
  const b = v.paletteIndex('minecraft:oak_stairs[facing=north,half=bottom]');
  assert.equal(a, b);
  assert.deepEqual(v.palette, ['air', 'oak_stairs[facing=north,half=bottom]']);
});

test('forEach in fester Reihenfolge, toTransfer/fromTransfer verlustfrei', () => {
  const v = new BlockVolume();
  v.set(20, 0, 0, 'stone', 2);
  v.set(-3, 4, 9, 'dirt', 1);
  v.set(0, 0, 0, 'glass', 0);
  const seen = [];
  v.forEach((x, y, z, state, step, index) => seen.push([x, y, z, state, step, index]));
  assert.equal(seen.length, 3);
  const transfer = v.toTransfer();
  assert.equal(BlockVolume.transferList(transfer).length, transfer.chunks.length * 2);
  const copy = BlockVolume.fromTransfer(structuredClone(transfer));
  const seenCopy = [];
  copy.forEach((x, y, z, state, step, index) => seenCopy.push([x, y, z, state, step, index]));
  assert.deepEqual(seenCopy, seen);
  assert.equal(copy.count, 3);
  assert.deepEqual(copy.bounds, v.bounds);
  // Original bleibt nach dem Übertragen nutzbar (Kopien)
  transfer.chunks[0].blocks.fill(0);
  assert.equal(v.count, 3);
  assert.equal(v.get(0, 0, 0), 'glass');
});

test('fromTransfer prüft die Daten', () => {
  assert.throws(() => BlockVolume.fromTransfer({ palette: ['stone'], chunks: [] }), /air/);
  const blocks = new Uint16Array(4096);
  blocks[0] = 3;
  assert.throws(() => BlockVolume.fromTransfer({ palette: ['air', 'stone'], chunks: [{ cx: 0, cy: 0, cz: 0, blocks, steps: new Uint16Array(4096) }] }), /Paletten-Index 3/);
  assert.throws(() => BlockVolume.fromTransfer({ palette: ['air'], chunks: [{ cx: 0, cy: 0, cz: 0, blocks: [1], steps: [] }] }), /Chunk-Format/);
});

test('Zufall ist deterministisch und hält Grenzen ein', () => {
  const a = createRandom('haus');
  const b = createRandom('haus');
  const c = createRandom('anderes');
  const seqA = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(Array.from({ length: 20 }, () => b.next()), seqA);
  assert.notDeepEqual(Array.from({ length: 20 }, () => c.next()), seqA);
  assert.ok(seqA.every((n) => n >= 0 && n < 1));
  const r = createRandom('grenzen');
  const ints = Array.from({ length: 2000 }, () => r.int(-2, 3));
  assert.ok(ints.every((n) => n >= -2 && n <= 3 && Number.isInteger(n)));
  assert.deepEqual([...new Set(ints)].sort((p, q) => p - q), [-2, -1, 0, 1, 2, 3]);
  assert.equal(r.int(5, 5), 5);
  assert.throws(() => r.int(3, 1), /min ≤ max/);
  assert.throws(() => r.pick([]), /nicht leere Liste/);
  assert.equal(r.pickWeighted([['a', 0], ['b', 1]]), 'b');
  assert.throws(() => r.pickWeighted([['a', 0]]), /größer als 0/);
  assert.throws(() => r.chance(2), /0 bis 1/);
  assert.deepEqual(hashSeed('x'), hashSeed('x'));
  assert.equal(hashPosition(1, 2, 3), hashPosition(1, 2, 3));
  assert.notEqual(hashPosition(1, 2, 3), hashPosition(3, 2, 1));
});
