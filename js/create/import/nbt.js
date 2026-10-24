// Reiner NBT-Leser (Java, big-endian) auf Uint8Array – läuft in Browser, Worker und Node (ohne node:zlib).
// Abbildung: Compound → Objekt, List → Array, Long → BigInt, Byte-/Int-/Long-Array → Int8Array / Int32Array /
// BigInt64Array, Zahlen sonst → number. Entpacken über DecompressionStream (gzip, zlib) mit Größengrenze.
// scripts/lib/nbt.mjs nutzt denselben Kern und entpackt in Node synchron mit zlib.

export const TAG = Object.freeze({
  END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6,
  BYTE_ARRAY: 7, STRING: 8, LIST: 9, COMPOUND: 10, INT_ARRAY: 11, LONG_ARRAY: 12,
});

// Wie im Spiel (NbtAccounter): tiefer verschachtelt gilt als beschädigt.
export const MAX_DEPTH = 512;
export const MAX_UNPACKED_BYTES = 256 * 1024 * 1024;
// Obergrenze für Werte (Listeneinträge, Compound-Felder), damit verschachtelte leere Listen den Speicher nicht sprengen.
export const MAX_NODES = 40_000_000;

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export class NbtError extends Error {
  constructor(message, { code = 'corrupt' } = {}) {
    super(`NBT: ${message}`);
    this.name = 'NbtError';
    this.code = code;
  }
}

function asBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('NBT-Daten müssen ein Uint8Array oder ArrayBuffer sein.');
}

/** 'gzip' (1F 8B), 'zlib' (gültiger zlib-Kopf mit CMF 0x78) oder 'none'. 0x78 ist kein Tag-Typ, also eindeutig. */
export function detectCompression(input) {
  const bytes = asBytes(input);
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (bytes.length >= 2 && bytes[0] === 0x78 && (bytes[0] * 256 + bytes[1]) % 31 === 0) return 'zlib';
  return 'none';
}

// Javas „modifiziertes UTF-8“: U+0000 als C0 80, Zeichen über U+FFFF als zwei 3-Byte-Surrogate.
export function decodeModifiedUtf8(input, start = 0, end = undefined) {
  const bytes = asBytes(input);
  const stop = end ?? bytes.length;
  if (stop - start <= 4096) {
    let ascii = true;
    for (let k = start; k < stop; k++) {
      if (bytes[k] >= 0x80) {
        ascii = false;
        break;
      }
    }
    if (ascii) return String.fromCharCode.apply(null, bytes.subarray(start, stop));
  }
  const units = new Uint16Array(stop - start);
  let count = 0;
  let i = start;
  const continuation = (index) => {
    if (index >= stop || (bytes[index] & 0xc0) !== 0x80) throw new NbtError('ungültiges modifiziertes UTF-8 in einem Text.');
    return bytes[index] & 0x3f;
  };
  while (i < stop) {
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
      throw new NbtError('ungültiges modifiziertes UTF-8 in einem Text.');
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
  constructor(bytes, { maxDepth, maxNodes }) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
    this.maxDepth = maxDepth;
    this.nodesLeft = maxNodes;
  }

  need(count) {
    if (this.offset + count > this.bytes.length) {
      throw new NbtError(`Daten enden unerwartet bei Byte ${this.offset} (brauche ${count} weitere).`);
    }
  }

  spend(count) {
    this.nodesLeft -= count;
    if (this.nodesLeft < 0) throw new NbtError('zu viele Einträge (mehr als die erlaubte Anzahl Werte).', { code: 'limit' });
  }

  u8() { this.need(1); return this.bytes[this.offset++]; }
  i8() { this.need(1); return this.view.getInt8(this.offset++); }
  i16() { this.need(2); const v = this.view.getInt16(this.offset); this.offset += 2; return v; }
  u16() { this.need(2); const v = this.view.getUint16(this.offset); this.offset += 2; return v; }
  i32() { this.need(4); const v = this.view.getInt32(this.offset); this.offset += 4; return v; }
  i64() { this.need(8); const v = this.view.getBigInt64(this.offset); this.offset += 8; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.offset); this.offset += 4; return v; }
  f64() { this.need(8); const v = this.view.getFloat64(this.offset); this.offset += 8; return v; }

  string() {
    const length = this.u16();
    this.need(length);
    const text = decodeModifiedUtf8(this.bytes, this.offset, this.offset + length);
    this.offset += length;
    return text;
  }

  arrayLength(elementSize) {
    const length = this.i32();
    if (length < 0) throw new NbtError(`negative Array-Länge ${length}.`);
    this.need(length * elementSize);
    return length;
  }

  byteArray() {
    const length = this.arrayLength(1);
    const values = new Int8Array(length);
    values.set(new Int8Array(this.bytes.buffer, this.bytes.byteOffset + this.offset, length));
    this.offset += length;
    return values;
  }

  // Big-endian → native Reihenfolge byteweise kopieren (schnell, ohne BigInt-Objekte je Wert).
  swapped(length, size) {
    const out = new Uint8Array(length * size);
    const src = this.bytes;
    const base = this.offset;
    if (!LITTLE_ENDIAN) {
      out.set(src.subarray(base, base + length * size));
    } else {
      for (let i = 0; i < length; i++) {
        const o = i * size, s = base + o;
        for (let k = 0; k < size; k++) out[o + k] = src[s + size - 1 - k];
      }
    }
    this.offset += length * size;
    return out.buffer;
  }

  intArray() {
    const length = this.arrayLength(4);
    return new Int32Array(this.swapped(length, 4));
  }

  longArray() {
    const length = this.arrayLength(8);
    return new BigInt64Array(this.swapped(length, 8));
  }

  list(depth) {
    const elementType = this.u8();
    const length = this.i32();
    if (length < 0) throw new NbtError(`negative Listenlänge ${length}.`);
    if (elementType === TAG.END && length > 0) throw new NbtError('Liste ohne Elementtyp, aber mit Inhalt.');
    // Jeder Eintrag braucht mindestens ein Byte (Compound-Ende) – größere Längen sind sicher beschädigt.
    if (length > this.bytes.length - this.offset) this.need(length);
    this.spend(length);
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
      this.spend(1);
      const value = this.payload(type, depth + 1);
      // „__proto__“ als normalen Schlüssel anlegen, nicht den Prototyp ändern.
      if (key === '__proto__') Object.defineProperty(result, key, { value, enumerable: true, writable: true, configurable: true });
      else result[key] = value;
    }
  }

  payload(type, depth) {
    if (depth > this.maxDepth) throw new NbtError(`zu tief verschachtelt (mehr als ${this.maxDepth} Ebenen).`, { code: 'limit' });
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
      default: throw new NbtError(`unbekannter Tag-Typ ${type} bei Byte ${this.offset - 1}.`);
    }
  }
}

/**
 * Liest ungepackte NBT-Daten (benannter Wurzel-Tag). Rückgabe: { name, value }.
 * Optionen: maxDepth (512 wie im Spiel), maxNodes (Obergrenze für Listeneinträge und Compound-Felder).
 */
export function parseNbt(input, { maxDepth = MAX_DEPTH, maxNodes = MAX_NODES } = {}) {
  if (!(input instanceof Uint8Array)) throw new TypeError('parseNbt erwartet ein Uint8Array.');
  const reader = new NbtReader(input, { maxDepth, maxNodes });
  const type = reader.u8();
  if (type === TAG.END) {
    if (input.length !== 1) throw new NbtError('Daten nach dem leeren Wurzel-Tag.');
    return { name: '', value: null };
  }
  const name = reader.string();
  const value = reader.payload(type, 0);
  if (reader.offset !== input.length) {
    throw new NbtError(`${input.length - reader.offset} überzählige Byte nach dem Wurzel-Tag.`);
  }
  return { name, value };
}

/**
 * Entpackt gzip- oder zlib-Daten mit DecompressionStream (Browser, Worker, Node ≥ 18).
 * Bricht ab, sobald mehr als maxBytes entstehen (NbtError code 'unpacked-too-large').
 */
export async function inflate(input, format, { maxBytes = MAX_UNPACKED_BYTES } = {}) {
  const bytes = asBytes(input);
  if (format !== 'gzip' && format !== 'zlib') throw new TypeError(`Unbekanntes Packformat „${format}“.`);
  if (typeof DecompressionStream !== 'function') {
    throw new NbtError('Dieser Browser kann gepackte Dateien nicht entpacken (DecompressionStream fehlt).', { code: 'unsupported' });
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format === 'gzip' ? 'gzip' : 'deflate'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new NbtError(`entpackt größer als ${Math.round(maxBytes / 1024 / 1024)} MB.`, { code: 'unpacked-too-large' });
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof NbtError) throw error;
    throw new NbtError(`Daten lassen sich nicht entpacken (${error?.message ?? error}).`);
  }
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Entpackt bei Bedarf (gzip/zlib, am Inhalt erkannt) und liest NBT. Rückgabe: { name, value, compression, unpackedBytes }. */
export async function readNbtAsync(input, { maxBytes = MAX_UNPACKED_BYTES, maxDepth = MAX_DEPTH, maxNodes = MAX_NODES } = {}) {
  const bytes = asBytes(input);
  const compression = detectCompression(bytes);
  if (compression === 'none' && bytes.length > maxBytes) {
    throw new NbtError(`größer als ${Math.round(maxBytes / 1024 / 1024)} MB.`, { code: 'unpacked-too-large' });
  }
  const raw = compression === 'none' ? bytes : await inflate(bytes, compression, { maxBytes });
  return { ...parseNbt(raw, { maxDepth, maxNodes }), compression, unpackedBytes: raw.length };
}

/**
 * 32-Bit-Wörter eines Long-Arrays in Bit-Reihenfolge (Wort 2i = untere Hälfte von Long i).
 * Für gepackte Bitfelder (Litematica) ohne BigInt-Rechnung je Eintrag.
 */
export function longArrayWords(longs) {
  if (!(longs instanceof BigInt64Array)) throw new TypeError('longArrayWords erwartet ein BigInt64Array.');
  if (LITTLE_ENDIAN) return new Uint32Array(longs.buffer, longs.byteOffset, longs.length * 2);
  const words = new Uint32Array(longs.length * 2);
  for (let i = 0; i < longs.length; i++) {
    const v = BigInt.asUintN(64, longs[i]);
    words[2 * i] = Number(v & 0xffffffffn);
    words[2 * i + 1] = Number(v >> 32n);
  }
  return words;
}
