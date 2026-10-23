// ZIP-/JAR-Leser ohne Pakete. Liest die Datei komplett ein und entpackt Einträge bei Bedarf.
// Unterstützt: Methode 0 (gespeichert) und 8 (Deflate). Nicht: ZIP64, mehrteilige Archive, Verschlüsselung.

import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

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

function zipError(source, message) {
  return new Error(`ZIP ${source}: ${message}`);
}

function findEndOfCentralDirectory(buffer, source) {
  const lowest = Math.max(0, buffer.length - EOCD_SIZE - MAX_COMMENT);
  for (let offset = buffer.length - EOCD_SIZE; offset >= lowest; offset--) {
    if (buffer.readUInt32LE(offset) !== SIG_EOCD) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + EOCD_SIZE + commentLength <= buffer.length) return offset;
  }
  throw zipError(source, 'kein gültiges ZIP-Archiv (Ende des Inhaltsverzeichnisses nicht gefunden).');
}

function readEndOfCentralDirectory(buffer, source) {
  const offset = findEndOfCentralDirectory(buffer, source);
  const eocd = {
    disk: buffer.readUInt16LE(offset + 4),
    centralDisk: buffer.readUInt16LE(offset + 6),
    entriesOnDisk: buffer.readUInt16LE(offset + 8),
    totalEntries: buffer.readUInt16LE(offset + 10),
    centralSize: buffer.readUInt32LE(offset + 12),
    centralOffset: buffer.readUInt32LE(offset + 16),
  };
  const hasZip64Locator = offset >= 20 && buffer.readUInt32LE(offset - 20) === SIG_EOCD64_LOCATOR;
  const usesZip64Markers = eocd.totalEntries === 0xffff || eocd.entriesOnDisk === 0xffff
    || eocd.centralSize === 0xffffffff || eocd.centralOffset === 0xffffffff;
  if (hasZip64Locator || usesZip64Markers) {
    throw zipError(source, 'ZIP64-Archiv erkannt – das wird nicht unterstützt (zu viele Einträge oder Dateien über 4 GB).');
  }
  if (eocd.disk !== 0 || eocd.centralDisk !== 0 || eocd.entriesOnDisk !== eocd.totalEntries) {
    throw zipError(source, 'mehrteilige ZIP-Archive werden nicht unterstützt.');
  }
  if (eocd.centralOffset + eocd.centralSize > offset) {
    throw zipError(source, 'Inhaltsverzeichnis liegt außerhalb der Datei (beschädigt?).');
  }
  return eocd;
}

function readCentralEntry(buffer, offset, source) {
  if (offset + CENTRAL_HEADER_SIZE > buffer.length || buffer.readUInt32LE(offset) !== SIG_CENTRAL) {
    throw zipError(source, `Eintrag im Inhaltsverzeichnis bei Byte ${offset} ist beschädigt.`);
  }
  const nameLength = buffer.readUInt16LE(offset + 28);
  const extraLength = buffer.readUInt16LE(offset + 30);
  const commentLength = buffer.readUInt16LE(offset + 32);
  const end = offset + CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  if (end > buffer.length) throw zipError(source, `Eintrag im Inhaltsverzeichnis bei Byte ${offset} ist abgeschnitten.`);
  // Namen als UTF-8 wie bei Java-Jars (Bit 11 oder reines ASCII).
  const name = buffer.toString('utf8', offset + CENTRAL_HEADER_SIZE, offset + CENTRAL_HEADER_SIZE + nameLength);
  const entry = {
    name,
    flags: buffer.readUInt16LE(offset + 8),
    method: buffer.readUInt16LE(offset + 10),
    crc32: buffer.readUInt32LE(offset + 16),
    compressedSize: buffer.readUInt32LE(offset + 20),
    size: buffer.readUInt32LE(offset + 24),
    localHeaderOffset: buffer.readUInt32LE(offset + 42),
    isDirectory: name.endsWith('/'),
  };
  if (entry.compressedSize === 0xffffffff || entry.size === 0xffffffff || entry.localHeaderOffset === 0xffffffff) {
    throw zipError(source, `ZIP64-Eintrag „${name}“ erkannt – das wird nicht unterstützt.`);
  }
  return { entry, next: end };
}

function readCentralDirectory(buffer, eocd, source) {
  const entries = new Map();
  const duplicates = [];
  let offset = eocd.centralOffset;
  for (let i = 0; i < eocd.totalEntries; i++) {
    const { entry, next } = readCentralEntry(buffer, offset, source);
    if (entries.has(entry.name)) duplicates.push(entry.name);
    else entries.set(entry.name, entry);
    offset = next;
  }
  if (offset !== eocd.centralOffset + eocd.centralSize) {
    throw zipError(source, 'Größe des Inhaltsverzeichnisses stimmt nicht (beschädigt?).');
  }
  return { entries, duplicates };
}

function locateData(buffer, entry, source) {
  const offset = entry.localHeaderOffset;
  if (offset + LOCAL_HEADER_SIZE > buffer.length || buffer.readUInt32LE(offset) !== SIG_LOCAL) {
    throw zipError(source, `lokaler Kopf von „${entry.name}“ ist beschädigt.`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + LOCAL_HEADER_SIZE + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw zipError(source, `Daten von „${entry.name}“ sind abgeschnitten.`);
  return buffer.subarray(start, end);
}

function inflateEntry(raw, entry, source) {
  if (entry.method === METHOD_STORED) return Buffer.from(raw);
  if (entry.method === METHOD_DEFLATE) {
    try {
      // Obergrenze = angegebene Größe, damit ein manipulierter Eintrag nicht beliebig wächst.
      return zlib.inflateRawSync(raw, { maxOutputLength: Math.max(1, entry.size) });
    } catch (error) {
      throw zipError(source, `„${entry.name}“ lässt sich nicht entpacken (${error.code ?? error.message}).`);
    }
  }
  throw zipError(source, `„${entry.name}“ nutzt die Kompressionsmethode ${entry.method} – unterstützt sind nur 0 und 8.`);
}

function readEntry(buffer, entry, source) {
  if (entry.flags & FLAG_ENCRYPTED) throw zipError(source, `„${entry.name}“ ist verschlüsselt – das wird nicht unterstützt.`);
  const data = inflateEntry(locateData(buffer, entry, source), entry, source);
  if (data.length !== entry.size) {
    throw zipError(source, `„${entry.name}“ hat ${data.length} statt ${entry.size} Byte (beschädigt?).`);
  }
  if (zlib.crc32(data) !== entry.crc32) throw zipError(source, `Prüfsumme von „${entry.name}“ stimmt nicht (beschädigt?).`);
  return data;
}

// Liest ein ZIP aus einem Buffer. source dient nur für Fehlermeldungen.
export function parseZip(buffer, source = 'Puffer') {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('parseZip erwartet einen Buffer.');
  if (buffer.length < EOCD_SIZE) throw zipError(source, 'Datei ist zu klein für ein ZIP-Archiv.');
  const eocd = readEndOfCentralDirectory(buffer, source);
  const { entries, duplicates } = readCentralDirectory(buffer, eocd, source);
  const fileNames = [...entries.values()].filter((e) => !e.isDirectory).map((e) => e.name).sort();

  return {
    entries,
    duplicates,
    // Inhalt eines Eintrags als Buffer (Fehler, wenn er fehlt oder beschädigt ist).
    read(name) {
      const entry = entries.get(name);
      if (!entry) throw zipError(source, `Eintrag „${name}“ fehlt.`);
      if (entry.isDirectory) throw zipError(source, `„${name}“ ist ein Ordner.`);
      return readEntry(buffer, entry, source);
    },
    // Sortierte Dateinamen (ohne Ordner-Einträge), die mit prefix beginnen.
    list(prefix = '') {
      return fileNames.filter((name) => name.startsWith(prefix));
    },
  };
}

// Öffnet eine ZIP-/JAR-Datei. Rückgabe: { entries, duplicates, read(name), list(prefix) }.
export function openZip(filePath) {
  let buffer;
  try {
    buffer = readFileSync(filePath);
  } catch (error) {
    throw new Error(`ZIP ${filePath}: Datei lässt sich nicht lesen (${error.code ?? error.message}).`);
  }
  return parseZip(buffer, filePath);
}
