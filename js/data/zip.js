// ZIP-Leser für den Browser (läuft auch in Node ≥ 22): liest das Inhaltsverzeichnis und entpackt einzelne Einträge.
// Unterstützt Methode 0 (gespeichert) und 8 (Deflate, über DecompressionStream('deflate-raw')).
// Nicht: ZIP64, mehrteilige Archive, Verschlüsselung. Jeder Eintrag wird höchstens bis zu seiner angegebenen Größe
// entpackt und per Prüfsumme kontrolliert – ein manipuliertes Archiv kann so nicht beliebig wachsen.

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const EOCD_SIZE = 22;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;
const MAX_COMMENT = 0xffff;
const FLAG_ENCRYPTED = 0x0001;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

export class ZipError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ZipError';
    this.code = code;
  }
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('ZIP: Binärdaten erwartet (ArrayBuffer oder Uint8Array).');
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Beginnt wie ein ZIP-Archiv (lokaler Kopf oder leeres Archiv)? */
export function isZipData(input) {
  const bytes = toBytes(input);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));
}

let crcTable = null;

/** CRC-32 wie in ZIP (Polynom 0xEDB88320). */
export function crc32(input) {
  const bytes = toBytes(input);
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const broken = (what) => new ZipError('corrupt', `Das ZIP-Archiv ist beschädigt (${what}).`);

function findEndOfCentralDirectory(bytes) {
  const lowest = Math.max(0, bytes.length - EOCD_SIZE - MAX_COMMENT);
  for (let offset = bytes.length - EOCD_SIZE; offset >= lowest; offset--) {
    if (u32(bytes, offset) !== SIG_EOCD) continue;
    if (offset + EOCD_SIZE + u16(bytes, offset + 20) <= bytes.length) return offset;
  }
  throw new ZipError('not-zip', 'Die Datei ist kein gültiges ZIP-Archiv.');
}

const nameDecoder = new TextDecoder('utf-8');

/**
 * Inhaltsverzeichnis lesen → [{ name, method, flags, crc32, compressedSize, size, localHeaderOffset, isDirectory }].
 * maxEntries begrenzt die Zahl der Einträge (auch Ordner).
 */
export function listZipEntries(input, { maxEntries = 1000 } = {}) {
  const bytes = toBytes(input);
  if (bytes.length < EOCD_SIZE) throw new ZipError('not-zip', 'Die Datei ist kein gültiges ZIP-Archiv.');
  const eocd = findEndOfCentralDirectory(bytes);
  const total = u16(bytes, eocd + 10);
  const centralSize = u32(bytes, eocd + 12);
  const centralOffset = u32(bytes, eocd + 16);
  const zip64 = (eocd >= 20 && u32(bytes, eocd - 20) === SIG_EOCD64_LOCATOR) || total === 0xffff
    || centralSize === 0xffffffff || centralOffset === 0xffffffff;
  if (zip64) throw new ZipError('unsupported', 'ZIP64-Archive werden nicht unterstützt.');
  if (u16(bytes, eocd + 4) !== 0 || u16(bytes, eocd + 6) !== 0 || u16(bytes, eocd + 8) !== total) {
    throw new ZipError('unsupported', 'Mehrteilige ZIP-Archive werden nicht unterstützt.');
  }
  if (total > maxEntries) throw new ZipError('too-many', `Das ZIP-Archiv enthält zu viele Einträge (höchstens ${maxEntries}).`);
  if (centralOffset + centralSize > eocd) throw broken('Inhaltsverzeichnis außerhalb der Datei');
  const entries = [];
  let offset = centralOffset;
  for (let i = 0; i < total; i++) {
    if (offset + CENTRAL_HEADER_SIZE > bytes.length || u32(bytes, offset) !== SIG_CENTRAL) throw broken('Inhaltsverzeichnis');
    const nameLength = u16(bytes, offset + 28);
    const end = offset + CENTRAL_HEADER_SIZE + nameLength + u16(bytes, offset + 30) + u16(bytes, offset + 32);
    if (end > bytes.length) throw broken('Inhaltsverzeichnis abgeschnitten');
    const name = nameDecoder.decode(bytes.subarray(offset + CENTRAL_HEADER_SIZE, offset + CENTRAL_HEADER_SIZE + nameLength)).replaceAll('\\', '/');
    const entry = {
      name,
      flags: u16(bytes, offset + 8),
      method: u16(bytes, offset + 10),
      crc32: u32(bytes, offset + 16),
      compressedSize: u32(bytes, offset + 20),
      size: u32(bytes, offset + 24),
      localHeaderOffset: u32(bytes, offset + 42),
      isDirectory: name.endsWith('/'),
    };
    if (entry.compressedSize === 0xffffffff || entry.size === 0xffffffff || entry.localHeaderOffset === 0xffffffff) {
      throw new ZipError('unsupported', 'ZIP64-Archive werden nicht unterstützt.');
    }
    entries.push(entry);
    offset = end;
  }
  if (offset !== centralOffset + centralSize) throw broken('Größe des Inhaltsverzeichnisses');
  return entries;
}

async function inflateRaw(data, expected) {
  if (typeof DecompressionStream !== 'function') {
    throw new ZipError('unsupported', 'Dieser Browser kann ZIP-Archive nicht entpacken. Nimm einen aktuellen Browser.');
  }
  let stream;
  try {
    stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  } catch {
    throw new ZipError('unsupported', 'Dieser Browser kann ZIP-Archive nicht entpacken. Nimm einen aktuellen Browser.');
  }
  const reader = stream.getReader();
  const out = new Uint8Array(expected);
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (total + value.byteLength > expected) {
        await reader.cancel().catch(() => {});
        throw broken('Eintrag größer als angegeben');
      }
      out.set(value, total);
      total += value.byteLength;
    }
  } catch (error) {
    if (error instanceof ZipError) throw error;
    throw broken('Daten nicht entpackbar');
  }
  if (total !== expected) throw broken('Eintrag kleiner als angegeben');
  return out;
}

/**
 * Einen Eintrag entpacken → Uint8Array (eigener Speicher). maxBytes begrenzt die entpackte Größe;
 * größere Einträge werfen ZipError 'too-large', ohne entpackt zu werden.
 */
export async function readZipEntry(input, entry, { maxBytes = Infinity } = {}) {
  const bytes = toBytes(input);
  if (entry.isDirectory) throw new ZipError('directory', `„${entry.name}“ ist ein Ordner.`);
  if (entry.flags & FLAG_ENCRYPTED) throw new ZipError('encrypted', `„${entry.name}“ ist verschlüsselt – das wird nicht unterstützt.`);
  if (entry.size > maxBytes) throw new ZipError('too-large', `„${entry.name}“ ist zu groß.`);
  const offset = entry.localHeaderOffset;
  if (offset + LOCAL_HEADER_SIZE > bytes.length || u32(bytes, offset) !== SIG_LOCAL) throw broken(`Kopf von „${entry.name}“`);
  const start = offset + LOCAL_HEADER_SIZE + u16(bytes, offset + 26) + u16(bytes, offset + 28);
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw broken(`„${entry.name}“ abgeschnitten`);
  const raw = bytes.subarray(start, end);
  let data;
  if (entry.method === METHOD_STORED) {
    if (raw.length !== entry.size) throw broken(`Größe von „${entry.name}“`);
    data = raw.slice();
  } else if (entry.method === METHOD_DEFLATE) {
    data = await inflateRaw(raw, entry.size);
  } else {
    throw new ZipError('unsupported', `„${entry.name}“ ist mit einem nicht unterstützten Verfahren gepackt.`);
  }
  if (crc32(data) !== entry.crc32) throw broken(`Prüfsumme von „${entry.name}“`);
  return data;
}
