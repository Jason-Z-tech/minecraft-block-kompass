import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { readNbt, decodeModifiedUtf8, TAG } from '../../scripts/lib/nbt.mjs';

// Kleiner Byte-Schreiber, um NBT-Daten von Hand (big-endian) zusammenzusetzen.
class Bytes {
  constructor() {
    this.parts = [];
  }
  u8(...values) {
    this.parts.push(Buffer.from(values));
    return this;
  }
  i16(value) {
    const b = Buffer.alloc(2);
    b.writeInt16BE(value);
    this.parts.push(b);
    return this;
  }
  i32(value) {
    const b = Buffer.alloc(4);
    b.writeInt32BE(value);
    this.parts.push(b);
    return this;
  }
  i64(value) {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(value);
    this.parts.push(b);
    return this;
  }
  f32(value) {
    const b = Buffer.alloc(4);
    b.writeFloatBE(value);
    this.parts.push(b);
    return this;
  }
  f64(value) {
    const b = Buffer.alloc(8);
    b.writeDoubleBE(value);
    this.parts.push(b);
    return this;
  }
  // Text als ASCII (Länge u16 + Bytes); für Sonderzeichen raw() mit Hand-Bytes nutzen.
  str(text) {
    const b = Buffer.from(text, 'latin1');
    const len = Buffer.alloc(2);
    len.writeUInt16BE(b.length);
    this.parts.push(len, b);
    return this;
  }
  raw(bytes) {
    this.parts.push(Buffer.from(bytes));
    return this;
  }
  tag(type, name) {
    return this.u8(type).str(name);
  }
  done() {
    return Buffer.concat(this.parts);
  }
}

// Wurzel „Level“ mit allen Tag-Typen 1–12, verschachtelter Liste und Compound.
function allTypesNbt() {
  const b = new Bytes().tag(TAG.COMPOUND, 'Level');
  b.tag(TAG.BYTE, 'byte').u8(0xfe); // -2
  b.tag(TAG.SHORT, 'short').i16(-1234);
  b.tag(TAG.INT, 'int').i32(-2147483648);
  b.tag(TAG.LONG, 'long').i64(-9007199254740993n);
  b.tag(TAG.FLOAT, 'float').f32(0.5);
  b.tag(TAG.DOUBLE, 'double').f64(-1.25);
  b.tag(TAG.BYTE_ARRAY, 'bytes').i32(3).u8(1, 0x80, 0x7f);
  // „Grüße“ in modifiziertem UTF-8: ü = C3 BC, ß = C3 9F
  b.u8(TAG.STRING).str('text').raw([0x00, 0x07, 0x47, 0x72, 0xc3, 0xbc, 0xc3, 0x9f, 0x65]);
  b.tag(TAG.LIST, 'list').u8(TAG.COMPOUND).i32(2);
  b.tag(TAG.INT, 'x').i32(1).u8(TAG.END);
  b.tag(TAG.INT, 'x').i32(2).u8(TAG.END);
  b.tag(TAG.LIST, 'empty').u8(TAG.END).i32(0);
  b.tag(TAG.COMPOUND, 'nested').tag(TAG.STRING, 'Name').str('minecraft:stone').u8(TAG.END);
  b.tag(TAG.INT_ARRAY, 'ints').i32(2).i32(-1).i32(65536);
  b.tag(TAG.LONG_ARRAY, 'longs').i32(2).i64(1n).i64(-2n);
  b.u8(TAG.END);
  return b.done();
}

test('liest alle Tag-Typen 0–12 mit richtigen JavaScript-Typen', () => {
  const { name, value } = readNbt(allTypesNbt());
  assert.equal(name, 'Level');
  assert.equal(value.byte, -2);
  assert.equal(value.short, -1234);
  assert.equal(value.int, -2147483648);
  assert.equal(value.long, -9007199254740993n);
  assert.equal(value.float, 0.5);
  assert.equal(value.double, -1.25);
  assert.ok(value.bytes instanceof Int8Array);
  assert.deepEqual([...value.bytes], [1, -128, 127]);
  assert.equal(value.text, 'Grüße');
  assert.deepEqual(value.list, [{ x: 1 }, { x: 2 }]);
  assert.deepEqual(value.empty, []);
  assert.deepEqual(value.nested, { Name: 'minecraft:stone' });
  assert.ok(value.ints instanceof Int32Array);
  assert.deepEqual([...value.ints], [-1, 65536]);
  assert.ok(value.longs instanceof BigInt64Array);
  assert.deepEqual([...value.longs], [1n, -2n]);
});

test('erkennt gzip und zlib und liefert dasselbe wie ungepackt', () => {
  const raw = allTypesNbt();
  const expected = readNbt(raw);
  assert.deepEqual(readNbt(zlib.gzipSync(raw)), expected);
  assert.deepEqual(readNbt(zlib.deflateSync(raw)), expected);
  assert.deepEqual(readNbt(new Uint8Array(raw)), expected);
});

test('modifiziertes UTF-8: Nullzeichen als C0 80 und Emoji als Surrogatpaar', () => {
  const bytes = Buffer.from([0x41, 0xc0, 0x80, 0xed, 0xa0, 0xbd, 0xed, 0xb8, 0x80, 0xe2, 0x82, 0xac]);
  assert.equal(decodeModifiedUtf8(bytes), 'A\u0000😀€');
  assert.throws(() => decodeModifiedUtf8(Buffer.from([0xc3])), /modifiziertes UTF-8/);
  assert.throws(() => decodeModifiedUtf8(Buffer.from([0xf0, 0x9f, 0x98, 0x80])), /modifiziertes UTF-8/);
});

test('leerer Wurzel-Tag und „__proto__“ als harmloser Schlüssel', () => {
  assert.deepEqual(readNbt(Buffer.from([0])), { name: '', value: null });
  const tricky = new Bytes().tag(TAG.COMPOUND, '').tag(TAG.INT, '__proto__').i32(7).u8(TAG.END).done();
  const { value } = readNbt(tricky);
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(value, '__proto__').value, 7);
});

test('beschädigte Daten führen zu klaren Fehlern', () => {
  const good = allTypesNbt();
  assert.throws(() => readNbt(good.subarray(0, good.length - 5)), /enden unerwartet/);
  assert.throws(() => readNbt(Buffer.concat([good, Buffer.from([0])])), /überzählige Byte/);
  assert.throws(() => readNbt(new Bytes().tag(TAG.COMPOUND, '').u8(13).str('x').done()), /unbekannter Tag-Typ 13/);
  assert.throws(() => readNbt(new Bytes().tag(TAG.LIST, '').u8(TAG.END).i32(2).done()), /ohne Elementtyp/);
  assert.throws(() => readNbt(new Bytes().tag(TAG.LIST, '').u8(TAG.INT).i32(-1).done()), /negative Listenlänge/);
  assert.throws(() => readNbt(new Bytes().tag(TAG.INT_ARRAY, '').i32(-3).done()), /negative Array-Länge/);
  assert.throws(() => readNbt(Buffer.from([0x1f, 0x8b, 1, 2, 3])), /entpacken/);
  assert.throws(() => readNbt('kein buffer'), TypeError);

  // 600 verschachtelte Listen überschreiten die Tiefengrenze des Spiels (512).
  const deep = new Bytes().tag(TAG.LIST, '');
  for (let i = 0; i < 600; i++) deep.u8(TAG.LIST).i32(1);
  deep.u8(TAG.END).i32(0);
  assert.throws(() => readNbt(deep.done()), /zu tief verschachtelt/);
});
