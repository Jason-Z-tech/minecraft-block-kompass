// NBT-Kern für den Browser (js/create/import/nbt.js): gleiche Ergebnisse wie der Node-Leser, Entpacken über
// DecompressionStream mit Größengrenze, Long-Arrays ohne BigInt-Umweg, Schutz vor Prototyp-Tricks und Tiefe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  parseNbt, readNbtAsync, inflate, detectCompression, decodeModifiedUtf8, longArrayWords, NbtError, TAG,
} from '../../js/create/import/nbt.js';
import { readNbt } from '../../scripts/lib/nbt.mjs';
import { encodeNbt, nbt } from '../fixtures/create/import/make-fixtures.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'create', 'import');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name));

test('liefert für alle Testdateien dasselbe wie scripts/lib/nbt.mjs (gzip, zlib, ungepackt)', async () => {
  for (const name of ['house-v1.schem', 'house-v2.schem', 'house-v3.schem', 'house-raw-v2.schem', 'house-zlib-v2.schem', 'regions.litematic', 'big-palette.litematic', 'house.nbt']) {
    const bytes = fixture(name);
    const expected = readNbt(bytes);
    const actual = await readNbtAsync(new Uint8Array(bytes));
    assert.deepEqual({ name: actual.name, value: actual.value }, expected, name);
    assert.equal(actual.compression, detectCompression(bytes), name);
  }
  assert.equal(detectCompression(fixture('house-v2.schem')), 'gzip');
  assert.equal(detectCompression(fixture('house-zlib-v2.schem')), 'zlib');
  assert.equal(detectCompression(fixture('house-raw-v2.schem')), 'none');
});

test('Long- und Int-Arrays: Werte und Bit-Reihenfolge der 32-Bit-Wörter', () => {
  const bytes = encodeNbt('', nbt.compound({
    longs: nbt.longArray([0x0000000100000002n, -1n, -9007199254740993n]),
    ints: nbt.intArray([-1, 65536, 7]),
  }));
  const { value } = parseNbt(new Uint8Array(bytes));
  assert.ok(value.longs instanceof BigInt64Array);
  assert.deepEqual([...value.longs], [0x0000000100000002n, -1n, -9007199254740993n]);
  assert.deepEqual([...value.ints], [-1, 65536, 7]);
  const words = longArrayWords(value.longs);
  assert.deepEqual([...words.subarray(0, 4)], [2, 1, 0xffffffff, 0xffffffff]);
  assert.throws(() => longArrayWords([1n]), TypeError);
});

test('Entpacken bricht bei der Größengrenze ab (Zip-Bombe)', async () => {
  const raw = Buffer.alloc(100_000);
  await assert.rejects(inflate(zlib.gzipSync(raw), 'gzip', { maxBytes: 50_000 }), (e) => e instanceof NbtError && e.code === 'unpacked-too-large');
  assert.equal((await inflate(zlib.gzipSync(raw), 'gzip', { maxBytes: 100_000 })).length, 100_000);
  assert.equal((await inflate(zlib.deflateSync(raw), 'zlib')).length, 100_000);
  await assert.rejects(readNbtAsync(fixture('house-raw-v2.schem'), { maxBytes: 1000 }), (e) => e.code === 'unpacked-too-large');
  await assert.rejects(readNbtAsync(fixture('truncated.schem')), (e) => e instanceof NbtError && /entpacken/.test(e.message));
});

test('Schutz: __proto__-Schlüssel, Verschachtelung, Anzahl der Werte, kaputte Daten', async () => {
  const { value } = parseNbt(new Uint8Array(encodeNbt('', nbt.compound({ ['__proto__']: nbt.compound({ polluted: nbt.byte(1) }) }))));
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(value), ['__proto__']);

  await assert.rejects(readNbtAsync(fixture('deep.nbt')), (e) => e instanceof NbtError && e.code === 'limit' && /zu tief/.test(e.message));
  const many = new Uint8Array(encodeNbt('', nbt.compound({ list: nbt.list(TAG.BYTE, Array.from({ length: 50 }, () => nbt.byte(1))) })));
  assert.throws(() => parseNbt(many, { maxNodes: 20 }), (e) => e.code === 'limit');
  assert.equal(parseNbt(many, { maxNodes: 100 }).value.list.length, 50);
  // Listenlänge größer als der Rest der Daten
  const bad = new Uint8Array([TAG.LIST, 0, 0, TAG.COMPOUND, 0x7f, 0xff, 0xff, 0xff]);
  assert.throws(() => parseNbt(bad), /enden unerwartet/);
  assert.throws(() => parseNbt('kein Uint8Array'), TypeError);
});

test('modifiziertes UTF-8: kurze ASCII-Texte, lange Texte, Sonderzeichen', () => {
  const ascii = new TextEncoder().encode('minecraft:stone');
  assert.equal(decodeModifiedUtf8(ascii), 'minecraft:stone');
  const long = new TextEncoder().encode('a'.repeat(5000));
  assert.equal(decodeModifiedUtf8(long), 'a'.repeat(5000));
  assert.equal(decodeModifiedUtf8(new Uint8Array([0x47, 0x72, 0xc3, 0xbc, 0xc3, 0x9f, 0x65])), 'Grüße');
  assert.equal(decodeModifiedUtf8(new Uint8Array([0x41, 0xc0, 0x80])), 'A\u0000');
});
