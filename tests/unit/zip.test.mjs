import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { openZip, parseZip } from '../../scripts/lib/zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP_DIR = path.join(ROOT, 'tmp');

// Baut ein ZIP im Speicher: entries = [{ name, data, method: 0|8, flags, crc, comment }].
function createZip(entries, { comment = '' } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '', 'utf8');
    const method = entry.method ?? 0;
    const stored = method === 8 ? zlib.deflateRawSync(data) : data;
    const crc = entry.crc ?? zlib.crc32(data);
    const flags = (entry.flags ?? 0) | 0x0800;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, stored);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + stored.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const commentBytes = Buffer.from(comment, 'utf8');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(commentBytes.length, 20);
  return Buffer.concat([...locals, centralDirectory, eocd, commentBytes]);
}

const LONG_TEXT = 'Steinziegel '.repeat(500);

test('liest gespeicherte und gepackte Einträge und listet sortiert nach Präfix', () => {
  const zip = parseZip(createZip([
    { name: 'assets/b.txt', data: 'gespeichert', method: 0 },
    { name: 'assets/a.json', data: LONG_TEXT, method: 8 },
    { name: 'assets/sub/', data: '', method: 0 },
    { name: 'other/c.txt', data: 'x', method: 8 },
    { name: 'assets/größe.txt', data: 'ümlaut', method: 8 },
  ]));
  assert.equal(zip.read('assets/b.txt').toString('utf8'), 'gespeichert');
  assert.equal(zip.read('assets/a.json').toString('utf8'), LONG_TEXT);
  assert.equal(zip.read('assets/größe.txt').toString('utf8'), 'ümlaut');
  assert.deepEqual(zip.list('assets/'), ['assets/a.json', 'assets/b.txt', 'assets/größe.txt']);
  assert.deepEqual(zip.list(), ['assets/a.json', 'assets/b.txt', 'assets/größe.txt', 'other/c.txt']);
  assert.equal(zip.entries.size, 5);
  const info = zip.entries.get('assets/a.json');
  assert.equal(info.method, 8);
  assert.equal(info.size, Buffer.byteLength(LONG_TEXT));
  assert.ok(info.compressedSize < info.size, 'Deflate sollte kleiner sein');
  assert.equal(zip.entries.get('assets/sub/').isDirectory, true);
  assert.deepEqual(zip.duplicates, []);
});

test('openZip liest eine Datei von der Platte', () => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const file = path.join(TMP_DIR, `zip-test-${process.pid}.zip`);
  try {
    fs.writeFileSync(file, createZip([{ name: 'version.json', data: '{"id":"26.2"}', method: 8 }], { comment: 'Kommentar am Ende' }));
    const zip = openZip(file);
    assert.deepEqual(JSON.parse(zip.read('version.json').toString('utf8')), { id: '26.2' });
  } finally {
    fs.rmSync(file, { force: true });
  }
  assert.throws(() => openZip(path.join(TMP_DIR, 'gibt-es-nicht.zip')), /lässt sich nicht lesen/);
});

test('meldet fehlende Einträge, Ordner und kaputte Prüfsummen', () => {
  const zip = parseZip(createZip([
    { name: 'gut.txt', data: 'abc', method: 8 },
    { name: 'kaputt.txt', data: 'abc', method: 0, crc: 12345 },
    { name: 'ordner/', data: '', method: 0 },
  ]));
  assert.throws(() => zip.read('fehlt.txt'), /Eintrag „fehlt\.txt“ fehlt/);
  assert.throws(() => zip.read('ordner/'), /ist ein Ordner/);
  assert.throws(() => zip.read('kaputt.txt'), /Prüfsumme/);
  assert.equal(zip.read('gut.txt').toString(), 'abc');
});

test('lehnt Nicht-ZIPs, ZIP64, fremde Methoden und Verschlüsselung klar ab', () => {
  assert.throws(() => parseZip(Buffer.from('das ist kein zip, sondern nur ein text mit etwas länge')), /kein gültiges ZIP-Archiv/);
  assert.throws(() => parseZip(Buffer.alloc(5)), /zu klein/);

  const zip64 = createZip([{ name: 'a.txt', data: 'a' }]);
  zip64.writeUInt16LE(0xffff, zip64.length - 22 + 10);
  assert.throws(() => parseZip(zip64), /ZIP64/);

  const withLocator = createZip([{ name: 'a.txt', data: 'a' }]);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  const eocdStart = withLocator.length - 22;
  assert.throws(() => parseZip(Buffer.concat([withLocator.subarray(0, eocdStart), locator, withLocator.subarray(eocdStart)])), /ZIP64/);

  const bzip = parseZip(createZip([{ name: 'b.txt', data: 'b', method: 12 }]));
  assert.throws(() => bzip.read('b.txt'), /Kompressionsmethode 12/);

  const encrypted = parseZip(createZip([{ name: 'e.txt', data: 'e', flags: 0x0001 }]));
  assert.throws(() => encrypted.read('e.txt'), /verschlüsselt/);
});

test('bemerkt doppelte Einträge und behält den ersten', () => {
  const zip = parseZip(createZip([
    { name: 'x.txt', data: 'erster' },
    { name: 'x.txt', data: 'zweiter' },
  ]));
  assert.deepEqual(zip.duplicates, ['x.txt']);
  assert.equal(zip.read('x.txt').toString(), 'erster');
});
