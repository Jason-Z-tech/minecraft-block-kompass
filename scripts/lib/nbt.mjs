// Leser für Java-NBT (big-endian). Erkennt gzip und zlib, liest aber auch ungepackte Daten.
// Abbildung: Compound → Objekt, List → Array, Long → BigInt,
// Byte-/Int-/Long-Array → Int8Array / Int32Array / BigInt64Array, Zahlen sonst → number.

import zlib from 'node:zlib';

export const TAG = Object.freeze({
  END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6,
  BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11, LONG_ARRAY: 12,
});

// Wie im Spiel (NbtAccounter): tiefer verschachtelt gilt als beschädigt.
const MAX_DEPTH = 512;
const MAX_UNPACKED_BYTES = 256 * 1024 * 1024;

function nbtError(message) {
  return new Error(`NBT: ${message}`);
}

function unpack(buffer) {
  try {
    if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      return zlib.gunzipSync(buffer, { maxOutputLength: MAX_UNPACKED_BYTES });
    }
    // zlib-Kopf (CMF 0x78); 0x78 ist kein gültiger Tag-Typ, also eindeutig.
    if (buffer.length >= 2 && buffer[0] === 0x78 && (buffer[0] * 256 + buffer[1]) % 31 === 0) {
      return zlib.inflateSync(buffer, { maxOutputLength: MAX_UNPACKED_BYTES });
    }
  } catch (error) {
    throw nbtError(`Daten lassen sich nicht entpacken (${error.code ?? error.message}).`);
  }
  return buffer;
}

// Javas „modifiziertes UTF-8“: U+0000 als C0 80, Zeichen über U+FFFF als zwei 3-Byte-Surrogate.
export function decodeModifiedUtf8(bytes, start = 0, end = bytes.length) {
  let isAscii = true;
  for (let i = start; i < end; i++) {
    if (bytes[i] >= 0x80) {
      isAscii = false;
      break;
    }
  }
  if (isAscii) return Buffer.from(bytes.buffer, bytes.byteOffset + start, end - start).toString('latin1');

  const units = new Uint16Array(end - start);
  let count = 0;
  let i = start;
  const continuation = (index) => {
    if (index >= end || (bytes[index] & 0xc0) !== 0x80) throw nbtError('ungültiges modifiziertes UTF-8 in einem Text.');
    return bytes[index] & 0x3f;
  };
  while (i < end) {
    const first = bytes[i];
    if (first < 0x80) {
      units[count++] = first;
      i += 1;
    } else if ((first & 0xe0) === 0xc0) {
      units[count++] = ((first & 0x1f) << 6) | continuation(i + 1);
      i += 2;
    } else if ((first & 0xf0) === 0xe0) {
      units[count++] = ((first & 0x0f) << 12) | (continuation(i + 1) << 6) | continuation(i + 2);
      i += 3;
    } else {
      throw nbtError('ungültiges modifiziertes UTF-8 in einem Text.');
    }
  }
  let text = '';
  const CHUNK = 8192;
  for (let k = 0; k < count; k += CHUNK) {
    text += String.fromCharCode.apply(null, units.subarray(k, Math.min(count, k + CHUNK)));
  }
  return text;
}

class NbtReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  need(bytes) {
    if (this.offset + bytes > this.buffer.length) {
      throw nbtError(`Daten enden unerwartet bei Byte ${this.offset} (brauche ${bytes} weitere).`);
    }
  }

  u8() { this.need(1); return this.buffer.readUInt8(this.offset++); }
  i8() { this.need(1); return this.buffer.readInt8(this.offset++); }
  i16() { this.need(2); const v = this.buffer.readInt16BE(this.offset); this.offset += 2; return v; }
  u16() { this.need(2); const v = this.buffer.readUInt16BE(this.offset); this.offset += 2; return v; }
  i32() { this.need(4); const v = this.buffer.readInt32BE(this.offset); this.offset += 4; return v; }
  i64() { this.need(8); const v = this.buffer.readBigInt64BE(this.offset); this.offset += 8; return v; }
  f32() { this.need(4); const v = this.buffer.readFloatBE(this.offset); this.offset += 4; return v; }
  f64() { this.need(8); const v = this.buffer.readDoubleBE(this.offset); this.offset += 8; return v; }

  string() {
    const length = this.u16();
    this.need(length);
    const text = decodeModifiedUtf8(this.buffer, this.offset, this.offset + length);
    this.offset += length;
    return text;
  }

  arrayLength(elementSize) {
    const length = this.i32();
    if (length < 0) throw nbtError(`negative Array-Länge ${length}.`);
    this.need(length * elementSize);
    return length;
  }

  byteArray() {
    const length = this.arrayLength(1);
    const view = new Int8Array(this.buffer.buffer, this.buffer.byteOffset + this.offset, length);
    this.offset += length;
    return view.slice();
  }

  intArray() {
    const length = this.arrayLength(4);
    const values = new Int32Array(length);
    for (let i = 0; i < length; i++) values[i] = this.buffer.readInt32BE(this.offset + i * 4);
    this.offset += length * 4;
    return values;
  }

  longArray() {
    const length = this.arrayLength(8);
    const values = new BigInt64Array(length);
    for (let i = 0; i < length; i++) values[i] = this.buffer.readBigInt64BE(this.offset + i * 8);
    this.offset += length * 8;
    return values;
  }

  list(depth) {
    const elementType = this.u8();
    const length = this.i32();
    if (length < 0) throw nbtError(`negative Listenlänge ${length}.`);
    if (elementType === TAG.END && length > 0) throw nbtError('Liste ohne Elementtyp, aber mit Inhalt.');
    const values = new Array(length);
    for (let i = 0; i < length; i++) values[i] = this.payload(elementType, depth + 1);
    return values;
  }

  compound(depth) {
    const result = {};
    for (;;) {
      const type = this.u8();
      if (type === TAG.END) return result;
      const key = this.string();
      const value = this.payload(type, depth + 1);
      // „__proto__“ als normalen Schlüssel anlegen, nicht den Prototyp ändern.
      if (key === '__proto__') Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
      else result[key] = value;
    }
  }

  payload(type, depth) {
    if (depth > MAX_DEPTH) throw nbtError(`zu tief verschachtelt (mehr als ${MAX_DEPTH} Ebenen).`);
    switch (type) {
      case TAG.BYTE: return this.i8();
      case TAG.SHORT: return this.i16();
      case TAG.INT: return this.i32();
      case TAG.LONG: return this.i64();
      case TAG.FLOAT: return this.f32();
      case TAG.DOUBLE: return this.f64();
      case TAG.BYTE_ARRAY: return this.byteArray();
      case TAG.STRING: return this.string();
      case TAG.LIST: return this.list(depth);
      case TAG.COMPOUND: return this.compound(depth);
      case TAG.INT_ARRAY: return this.intArray();
      case TAG.LONG_ARRAY: return this.longArray();
      default: throw nbtError(`unbekannter Tag-Typ ${type} bei Byte ${this.offset - 1}.`);
    }
  }
}

// Liest eine NBT-Datei (benannter Wurzel-Tag). Rückgabe: { name, value }.
export function readNbt(input) {
  if (!(input instanceof Uint8Array)) throw new TypeError('readNbt erwartet einen Buffer oder Uint8Array.');
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const buffer = unpack(raw);
  const reader = new NbtReader(buffer);
  const type = reader.u8();
  if (type === TAG.END) {
    if (buffer.length !== 1) throw nbtError('Daten nach dem leeren Wurzel-Tag.');
    return { name: '', value: null };
  }
  const name = reader.string();
  const value = reader.payload(type, 0);
  if (reader.offset !== buffer.length) {
    throw nbtError(`${buffer.length - reader.offset} überzählige Byte nach dem Wurzel-Tag.`);
  }
  return { name, value };
}
