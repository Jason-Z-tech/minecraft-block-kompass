// Leser für Java-NBT (big-endian) in Node. Erkennt gzip und zlib, liest aber auch ungepackte Daten.
// Der eigentliche Leser ist der reine Kern aus js/create/import/nbt.js (auch im Browser genutzt);
// hier kommt nur das synchrone Entpacken mit node:zlib dazu.
// Abbildung: Compound → Objekt, List → Array, Long → BigInt,
// Byte-/Int-/Long-Array → Int8Array / Int32Array / BigInt64Array, Zahlen sonst → number.

import zlib from 'node:zlib';
import { TAG, decodeModifiedUtf8, parseNbt, detectCompression, NbtError, MAX_UNPACKED_BYTES } from '../../js/create/import/nbt.js';

export { TAG, decodeModifiedUtf8 };

function unpack(bytes) {
  const compression = detectCompression(bytes);
  if (compression === 'none') return bytes;
  try {
    const options = { maxOutputLength: MAX_UNPACKED_BYTES };
    return compression === 'gzip' ? zlib.gunzipSync(bytes, options) : zlib.inflateSync(bytes, options);
  } catch (error) {
    throw new NbtError(`Daten lassen sich nicht entpacken (${error.code ?? error.message}).`);
  }
}

// Liest eine NBT-Datei (benannter Wurzel-Tag). Rückgabe: { name, value }.
export function readNbt(input) {
  if (!(input instanceof Uint8Array)) throw new TypeError('readNbt erwartet einen Buffer oder Uint8Array.');
  const raw = unpack(input);
  return parseNbt(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
}
