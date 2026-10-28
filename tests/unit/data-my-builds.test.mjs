// „Meine Bauten“ (js/data/my-builds.js) mit Speicher im Arbeitsspeicher: hinzufügen, auflisten, umbenennen, Kategorie,
// löschen, Grenzen, Inhaltsprüfung mit den Lesern des Uploads, Speicher voll, Manifest-Bereinigung, ZIP mit und ohne
// Manifest; dazu der ZIP-Leser (js/data/zip.js) und das IndexedDB-Backend mit einer kleinen Nachbildung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  createMyBuilds, createMemoryBackend, createIndexedDbBackend, isMyBuildId, newMyBuildId, myBuildHref, myBuildProgressKey,
  cleanManifest, cleanSource, cleanUrl, cleanLine, cleanParams, checkBuildFile, checkContent, normalizeMeta, titleFromFileName,
  zipEntryInfo, normalizeZipPath, requestPersistence, MINE_LIMITS, MINE_TEXTS, MINE_ACCEPT, MINE_DB_NAME, MyBuildsError,
} from '../../js/data/my-builds.js';
import { listZipEntries, readZipEntry, crc32, isZipData, ZipError } from '../../js/data/zip.js';
import { UPLOAD_ACCEPT } from '../../js/create/import/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = (name) => readFileSync(path.join(ROOT, 'tests/fixtures/create/import', name));
const HOUSE = fixture('house-v2.schem');
const NBT = fixture('house.nbt');
const LITEMATIC = fixture('regions.litematic');
const STL = readFileSync(path.join(ROOT, 'tests/fixtures/create/voxelize/cube-ascii.stl'));
const MB = 1024 * 1024;

// ZIP im Speicher: entries = [{ name, data, method: 0|8, flags, crc, size }] (size/crc überschreiben die echten Werte)
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '', 'utf8');
    const method = entry.method ?? 8;
    const stored = method === 8 ? zlib.deflateRawSync(data) : data;
    const crc = entry.crc ?? zlib.crc32(data);
    const size = entry.size ?? data.length;
    const flags = (entry.flags ?? 0) | 0x0800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(stored.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, stored);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(stored.length, 20); central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

// File-ähnliches Objekt (wie im Browser); readCount zählt, ob die Datei gelesen wurde
function fakeFile(name, data, { size = data?.length ?? 0 } = {}) {
  const file = {
    name,
    size,
    readCount: 0,
    async arrayBuffer() {
      file.readCount++;
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
    },
  };
  return file;
}

function memoryStore(options = {}) {
  let tick = 0;
  return createMyBuilds({
    backend: createMemoryBackend(options),
    now: () => new Date(Date.UTC(2026, 9, 28, 12, 0, tick++)),
  });
}

/* ------------------------------------------------------------------ IDs und Adressen */

test('IDs: zufällige UUID, Prüfung, Adresse und Fortschritts-Schlüssel', () => {
  const ids = new Set(Array.from({ length: 50 }, () => newMyBuildId()));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.ok(isMyBuildId(id), id);
  // Ohne randomUUID: aus getRandomValues gebaut, Version 4
  const fallback = newMyBuildId({ getRandomValues: (bytes) => bytes.fill(0xab) });
  assert.match(fallback, /^abababab-abab-4bab-abab-abababababab$/);
  for (const bad of ['', 'abc', '../x', 'ABCDEFAB-ABCD-4BCD-ABCD-ABCDEFABCDEF', '00000000-0000-4000-8000-00000000000g', null, 42]) {
    assert.equal(isMyBuildId(bad), false, String(bad));
  }
  const id = '0a3f0ffd-c9f9-4543-a227-0ac78ff11b8d';
  assert.equal(myBuildHref(id), `bau.html?meine=${id}`);
  assert.equal(myBuildProgressKey(id), `bk:progress:mine:${id}`);
  assert.throws(() => myBuildHref('x'), TypeError);
  assert.throws(() => myBuildProgressKey('x'), TypeError);
  assert.equal(MINE_DB_NAME, 'bk-mine');
  assert.equal(MINE_ACCEPT, `${UPLOAD_ACCEPT},.zip`);
});

/* ------------------------------------------------------------------ Hinzufügen, Liste, Bearbeiten */

test('Hinzufügen und Auflisten: neueste zuerst, Liste ohne Daten, get mit Daten', async () => {
  const store = memoryStore();
  const first = await store.add({ fileName: 'C:\\Bauten\\house-v2.schem', data: HOUSE, category: 'haeuser' });
  assert.ok(isMyBuildId(first.id));
  assert.deepEqual({ ...first, id: null }, {
    id: null, title: 'house-v2', category: 'haeuser', format: 'schem', fileName: 'house-v2.schem', size: HOUSE.length,
    addedAt: '2026-10-28T12:00:00.000Z', source: null, params: null,
  });
  const second = await store.add({ title: '  Mein   Turm ', format: 'nbt', fileName: 'turm.nbt', data: new Uint8Array(NBT), source: { author: 'Erika', url: 'https://example.org/turm', license: 'CC0' } });
  assert.equal(second.title, 'Mein Turm');
  assert.deepEqual(second.source, { author: 'Erika', url: 'https://example.org/turm', license: 'CC0' });
  const list = await store.list();
  assert.deepEqual(list.map((entry) => entry.title), ['Mein Turm', 'house-v2']);
  assert.ok(list.every((entry) => !('data' in entry)));
  const full = await store.get(first.id);
  assert.ok(full.data instanceof ArrayBuffer);
  assert.deepEqual(Buffer.from(full.data), HOUSE);
  // Eine Änderung an der gelieferten Kopie ändert den Speicher nicht
  new Uint8Array(full.data)[0] = 0;
  assert.deepEqual(Buffer.from((await store.get(first.id)).data), HOUSE);
  assert.equal(await store.get('00000000-0000-4000-8000-000000000000'), null);
  assert.equal(await store.get('kein-uuid'), null);
});

test('Modell-Optionen werden bei Modellen gespeichert (nur bekannte Schlüssel), bei Bauplänen nicht', async () => {
  const store = memoryStore();
  const model = await store.add({ fileName: 'cube.stl', data: STL, params: { height: 12, solid: true, palette: 'wolle', upAxis: 'z', evil: 'x', block: 'BAD BLOCK' } });
  assert.deepEqual(model.params, { height: 12, solid: true, palette: 'wolle', upAxis: 'z' });
  const plan = await store.add({ fileName: 'house.schem', data: HOUSE, params: { height: 12 } });
  assert.equal(plan.params, null);
  assert.equal(cleanParams('stl', { height: 0 }), null);
  assert.equal(cleanParams('stl', [1, 2]), null);
  assert.deepEqual(cleanParams('vox', { palette: 'einfarbig', block: 'white_concrete' }), { palette: 'einfarbig', block: 'white_concrete' });
});

test('Umbenennen, Kategorie ändern, Löschen', async () => {
  const store = memoryStore();
  const entry = await store.add({ fileName: 'house.schem', data: HOUSE });
  const renamed = await store.rename(entry.id, '  Burg <b>Eins</b>\u0007 ');
  assert.equal(renamed.title, 'Burg <b>Eins</b>');
  await assert.rejects(store.rename(entry.id, '   '), { name: 'MyBuildsError', code: 'invalid', message: MINE_TEXTS.noTitle });
  const long = await store.rename(entry.id, 'x'.repeat(500));
  assert.equal(long.title.length, MINE_LIMITS.maxTitle);
  assert.equal((await store.setCategory(entry.id, 'fantasy')).category, 'fantasy');
  assert.equal((await store.setCategory(entry.id, '')).category, null);
  assert.equal((await store.setCategory(entry.id, null)).category, null);
  await assert.rejects(store.setCategory(entry.id, 'redstone'), { code: 'invalid', message: MINE_TEXTS.badCategory });
  await assert.rejects(store.rename('00000000-0000-4000-8000-000000000000', 'x'), { code: 'not-found' });
  await assert.rejects(store.setCategory('kaputt', 'klein'), { code: 'not-found' });
  // Daten bleiben beim Bearbeiten erhalten
  assert.deepEqual(Buffer.from((await store.get(entry.id)).data), HOUSE);
  assert.equal(await store.remove(entry.id), true);
  assert.equal(await store.remove(entry.id), false);
  assert.equal(await store.remove('kaputt'), false);
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.get(entry.id), null);
});

test('Gespeicherte Metadaten werden beim Lesen geprüft', async () => {
  const backend = createMemoryBackend();
  const store = createMyBuilds({ backend });
  const good = await store.add({ fileName: 'house.schem', data: HOUSE });
  await backend.put({ id: 'kein-uuid', format: 'schem' }, new ArrayBuffer(4));
  await backend.put({ id: '11111111-1111-4111-8111-111111111111', format: 'exe', fileName: 'x.exe' }, new ArrayBuffer(4));
  await backend.put({ id: '22222222-2222-4222-8222-222222222222', format: 'nbt', fileName: '../../böse\u0000.nbt', title: '', category: 'gibtsnicht', size: -5, addedAt: 'gestern', source: { url: 'javascript:alert(1)' }, params: { height: 3 } }, new ArrayBuffer(4));
  const list = await store.list();
  assert.deepEqual(list.map((entry) => entry.id).sort(), [good.id, '22222222-2222-4222-8222-222222222222'].sort());
  const odd = list.find((entry) => entry.id.startsWith('2222'));
  assert.deepEqual(odd, { id: odd.id, title: 'böse', category: null, format: 'nbt', fileName: 'böse .nbt', size: 0, addedAt: null, source: null, params: null });
  assert.equal(normalizeMeta(null), null);
  assert.equal(normalizeMeta({ id: good.id, format: 'zip' }), null);
});

/* ------------------------------------------------------------------ Grenzen und Prüfung wie beim Upload */

test('Prüfung wie beim Upload: Endung, leer, höchstens 64 MB, Inhalt passt zum Format', async () => {
  assert.equal(MINE_LIMITS.maxFileBytes, 64 * MB);
  assert.deepEqual(checkBuildFile({ name: 'a.schematic', size: 10 }), { ok: true, format: 'schem' });
  assert.deepEqual(checkBuildFile({ name: 'a.GLB', size: 10 }), { ok: true, format: 'glb' });
  assert.equal(checkBuildFile({ name: 'a.exe', size: 10 }).reason, MINE_TEXTS.unknownFormat);
  assert.equal(checkBuildFile({ name: 'farben.mtl', size: 10 }).reason, MINE_TEXTS.mtl);
  assert.equal(checkBuildFile({ name: 'a.nbt', size: 0 }).reason, MINE_TEXTS.empty);
  assert.match(checkBuildFile({ name: 'a.nbt', size: 64 * MB + 1 }).reason, /zu groß \(64 MB\) – erlaubt sind höchstens 64 MB/);
  assert.equal(checkBuildFile({ name: 'a.nbt', size: 64 * MB }).ok, true);
  assert.equal(checkContent('schem', Buffer.from('nur Text')), MINE_TEXTS.notMinecraft);
  assert.equal(checkContent('gltf', Buffer.from('solid x')), MINE_TEXTS.notGltf);
  assert.equal(checkContent('schem', HOUSE), null);
  assert.equal(checkContent('stl', STL), null);

  const store = memoryStore();
  // Die Größengrenze gilt auch in add() selbst (z. B. „Zu Meine Bauten“ auf erstellen.html); geprüft vor dem Inhalt
  await assert.rejects(store.add({ fileName: 'x.schem', data: new Uint8Array(64 * MB + 1) }), { name: 'MyBuildsError', code: 'invalid', message: /zu groß \(64 MB\)/ });
  await assert.rejects(store.add({ fileName: 'x.schem', data: Buffer.from('kein NBT') }), { code: 'invalid', message: MINE_TEXTS.notMinecraft });
  await assert.rejects(store.add({ fileName: 'x.txt', data: HOUSE }), { code: 'invalid', message: MINE_TEXTS.unknownFormat });
  await assert.rejects(store.add({ fileName: 'x.schem', data: new ArrayBuffer(0) }), { code: 'invalid', message: MINE_TEXTS.empty });
  await assert.rejects(store.add({ fileName: 'x.schem', data: 'Text' }), { code: 'invalid' });
  await assert.rejects(store.add({ fileName: 'x.schem', data: HOUSE, category: 'redstone' }), { code: 'invalid', message: MINE_TEXTS.badCategory });

  // Zu große oder leere Dateien werden gar nicht erst gelesen
  const big = fakeFile('riesig.schem', HOUSE, { size: 64 * MB + 1 });
  const empty = fakeFile('leer.nbt', Buffer.alloc(0));
  const report = await store.addFiles([big, empty, fakeFile('notiz.txt', Buffer.from('hi')), fakeFile('kaputt.litematic', fixture('garbage.litematic')), fakeFile('house.schem', HOUSE)]);
  assert.equal(big.readCount, 0);
  assert.equal(empty.readCount, 0);
  assert.deepEqual(report.added.map((entry) => entry.title), ['house']);
  assert.deepEqual(report.skipped.map((item) => item.name), ['riesig.schem', 'leer.nbt', 'notiz.txt', 'kaputt.litematic']);
  assert.match(report.skipped[0].reason, /zu groß/);
  assert.equal(report.skipped[3].reason, MINE_TEXTS.notMinecraft);
  assert.equal(report.error, null);
  // Ein riesiges ZIP-Archiv gilt genauso als zu groß
  const bigZip = fakeFile('paket.zip', Buffer.alloc(8), { size: 64 * MB + 1 });
  const zipReport = await store.addFiles([bigZip]);
  assert.equal(bigZip.readCount, 0);
  assert.match(zipReport.skipped[0].reason, /zu groß/);
});

test('Inhalt mit den Lesern des Uploads geprüft: alte, beschädigte, leere und zu große Baupläne kommen nicht hinein', async () => {
  const store = memoryStore();
  const files = ['legacy.schematic', 'truncated.schem', 'all-air.schem', 'too-wide.schem', 'too-many-blocks.schem', 'deep.nbt'];
  const brokenStl = Buffer.from('solid kaputt\nfacet normal 0 0 1\nouter loop\nvertex 0 0\n');
  const report = await store.addFiles([...files.map((name) => fakeFile(name, fixture(name))), fakeFile('kaputt.stl', brokenStl), fakeFile('house.schem', HOUSE)]);
  assert.equal(report.error, null);
  assert.deepEqual(report.added.map((entry) => entry.title), ['house']);
  assert.deepEqual(report.skipped.map((item) => item.name), [...files, 'kaputt.stl']);
  const reasons = Object.fromEntries(report.skipped.map((item) => [item.name, item.reason]));
  assert.match(reasons['legacy.schematic'], /alte MCEdit-Schematic.*WorldEdit neu als \.schem/);
  assert.match(reasons['truncated.schem'], /beschädigt oder unvollständig/);
  assert.match(reasons['all-air.schem'], /keine Blöcke/);
  assert.match(reasons['too-wide.schem'], /4\.100 × 1 × 1 Blöcke.*höchstens 4\.064/);
  assert.match(reasons['too-many-blocks.schem'], /mehr als 3\.000\.000 Blöcke/);
  assert.match(reasons['deep.nbt'], /beschädigt/);
  assert.match(reasons['kaputt.stl'], /Das Modell konnte nicht gelesen werden/);
  assert.deepEqual((await store.list()).map((entry) => entry.title), ['house']);
  // Auch add() direkt (z. B. „Zu Meine Bauten“) prüft den Inhalt
  await assert.rejects(store.add({ fileName: 'alt.schematic', data: fixture('legacy.schematic') }), { name: 'MyBuildsError', code: 'invalid', message: /alte MCEdit-Schematic/ });
  // Gespeichert wird das am Inhalt erkannte Format (eine Litematica-Datei mit falscher Endung)
  const renamed = await store.add({ fileName: 'eigentlich-litematica.schem', data: LITEMATIC });
  assert.equal(renamed.format, 'litematic');
  assert.equal(renamed.fileName, 'eigentlich-litematica.schem');
});

test('Speicher voll: verständliche Meldung, Abbruch, schon Gespeichertes bleibt', async () => {
  const store = memoryStore({ maxBytes: HOUSE.length + 100 });
  const report = await store.addFiles([fakeFile('a.schem', HOUSE), fakeFile('b.schem', HOUSE), fakeFile('c.nbt', NBT)]);
  assert.deepEqual(report.added.map((entry) => entry.title), ['a']);
  assert.ok(report.error instanceof MyBuildsError);
  assert.equal(report.error.code, 'quota');
  assert.equal(report.error.message, MINE_TEXTS.quota);
  assert.match(MINE_TEXTS.quota, /Speicher im Browser ist voll/);
  // Die Datei beim Abbruch und alle übrigen: ohne den Grund zu wiederholen
  assert.deepEqual(report.skipped, []);
  assert.deepEqual(report.notSaved, ['b.schem', 'c.nbt']);
  assert.equal((await store.list()).length, 1);
  await assert.rejects(store.add({ fileName: 'd.schem', data: HOUSE }), { code: 'quota' });
  // Ein ZIP als erste Datei taucht auch auf; ist schon ein Teil gespeichert, steht das dabei
  const zip = makeZip([{ name: 'eins.schem', data: HOUSE }, { name: 'zwei.schem', data: HOUSE }]);
  const empty = memoryStore({ maxBytes: 100 });
  const first = await empty.addFiles([fakeFile('paket.zip', zip), fakeFile('Mein Turm.schem', HOUSE)]);
  assert.equal(first.error.code, 'quota');
  assert.deepEqual(first.notSaved, ['paket.zip', 'Mein Turm.schem']);
  assert.deepEqual(first.skipped, []);
  const half = memoryStore({ maxBytes: HOUSE.length + 100 });
  const partly = await half.addFiles([fakeFile('paket.zip', zip), fakeFile('Mein Turm.schem', HOUSE)]);
  assert.deepEqual(partly.added.map((entry) => entry.title), ['eins']);
  assert.deepEqual(partly.notSaved, ['paket.zip (teilweise)', 'Mein Turm.schem']);
  // Ohne Abbruch bleibt notSaved leer
  assert.deepEqual((await memoryStore().addFiles([fakeFile('a.schem', HOUSE)])).notSaved, []);
});

/* ------------------------------------------------------------------ Manifest und ZIP */

test('Manifest-Bereinigung: Längen, nur https, unbekannte Kategorien → null', () => {
  const items = cleanManifest([
    { file: './paket/haus.schem', title: `  Haus\u0000\u200b mit\nGarten ${'x'.repeat(300)}`, category: 'haeuser', author: 'A'.repeat(300), url: 'https://example.org/haus', license: 'CC BY 4.0' },
    { file: 'b.nbt', category: 'redstone', url: 'http://example.org/b' },
    { file: 'c.nbt', url: 'javascript:alert(1)', author: '' },
    { file: 'd.nbt', url: 'https://user:pass@example.org/' },
    { file: 'e.nbt', url: `https://example.org/${'a'.repeat(600)}` },
    { file: 'f.nbt', url: ' https://example.org/f ' },
    { file: 'b.nbt', title: 'doppelt' },
    { title: 'ohne Datei' },
    'Text',
    null,
    [],
    { file: 42 },
  ]);
  assert.deepEqual([...items.keys()], ['paket/haus.schem', 'b.nbt', 'c.nbt', 'd.nbt', 'e.nbt', 'f.nbt']);
  const house = items.get('paket/haus.schem');
  assert.equal(house.title.length, MINE_LIMITS.maxTitle);
  assert.ok(house.title.startsWith('Haus mit Garten xxx'));
  assert.equal(house.category, 'haeuser');
  assert.equal(house.source.author.length, MINE_LIMITS.maxAuthor);
  assert.equal(house.source.url, 'https://example.org/haus');
  assert.equal(house.source.license, 'CC BY 4.0');
  assert.deepEqual(items.get('b.nbt'), { title: null, category: null, source: null });
  assert.equal(items.get('c.nbt').source, null);
  assert.equal(items.get('d.nbt').source, null);
  assert.equal(items.get('e.nbt').source, null);
  assert.equal(items.get('f.nbt').source.url, 'https://example.org/f');
  // Auch { builds: [...] } und Unsinn
  assert.equal(cleanManifest({ builds: [{ file: 'x.nbt' }] }).size, 1);
  for (const bad of [null, 'Text', 42, {}, { builds: 'x' }]) assert.equal(cleanManifest(bad).size, 0);
  assert.equal(cleanManifest(Array.from({ length: 5000 }, (_, i) => ({ file: `${i}.nbt` }))).size, MINE_LIMITS.maxManifestItems);
  assert.equal(cleanUrl('https://example.org/a\\b'), null);
  assert.equal(cleanSource({ license: '  ' }), null);
  assert.equal(cleanLine(' a\u2028b ', 10), 'a b');
  // Schreibrichtungs-Steuerung (Überschreibung, Einbettung, Isolierung) fällt weg, Adressen damit gelten nicht
  const bidi = cleanManifest([{ file: 'x.schem', title: 'Haus\u202egnp.exe', author: 'X\u2066Y\u2069', license: '\u202aCC0\u202c', url: 'https://example.org/\u202ex' }]).get('x.schem');
  assert.equal(bidi.title, 'Hausgnp.exe');
  assert.deepEqual(bidi.source, { author: 'XY', url: null, license: 'CC0' });
  for (const code of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]) {
    assert.equal(cleanLine(`a${String.fromCodePoint(code)}b`, 10), 'ab', code.toString(16));
  }
  assert.equal(titleFromFileName('Haus\u202egnp.exe.schem'), 'Hausgnp.exe');
  assert.equal(titleFromFileName('ordner/Mein Haus.v2.litematic'), 'Mein Haus.v2');
});

test('ZIP mit Manifest: Titel, Kategorie und Herkunft je Datei, Pfade ab dem Ordner der manifest.json', async () => {
  const zip = makeZip([
    { name: 'paket/', data: '' },
    { name: 'paket/manifest.json', data: JSON.stringify([
      { file: 'haus.schem', title: 'Haus aus dem ZIP', category: 'haeuser', author: 'Erika', url: 'https://example.org/haus', license: 'CC BY 4.0' },
      { file: 'unter/turm.nbt', title: 'Turm', category: 'unbekannt', url: 'ftp://x' },
      { file: 'fehlt.schem', title: 'Gibt es nicht' },
    ]) },
    { name: 'paket/haus.schem', data: HOUSE },
    { name: 'paket/unter/turm.nbt', data: NBT, method: 0 },
    { name: 'paket/regionen.litematic', data: LITEMATIC },
    { name: 'paket/farben.mtl', data: 'newmtl a' },
    { name: 'paket/inneres.zip', data: makeZip([{ name: 'x.nbt', data: NBT }]) },
    { name: 'paket/liesmich.txt', data: 'Hallo' },
    { name: '__MACOSX/paket/._haus.schem', data: 'Mac' },
    { name: 'paket/.DS_Store', data: 'Mac' },
  ]);
  const store = memoryStore();
  const report = await store.addFiles([fakeFile('paket.zip', zip)]);
  assert.equal(report.error, null);
  assert.deepEqual(report.added.map((entry) => [entry.title, entry.category, entry.format, entry.fileName, entry.source]), [
    ['Haus aus dem ZIP', 'haeuser', 'schem', 'haus.schem', { author: 'Erika', url: 'https://example.org/haus', license: 'CC BY 4.0' }],
    ['Turm', null, 'nbt', 'turm.nbt', null],
    ['regionen', null, 'litematic', 'regionen.litematic', null],
  ]);
  assert.deepEqual(report.skipped.map((item) => [item.name, item.reason]), [
    ['paket.zip: paket/farben.mtl', MINE_TEXTS.mtl],
    ['paket.zip: paket/inneres.zip', MINE_TEXTS.nestedZip],
    ['paket.zip: paket/liesmich.txt', MINE_TEXTS.unknownFormat],
  ]);
  const house = await store.get(report.added[0].id);
  assert.deepEqual(Buffer.from(house.data), HOUSE);
  assert.deepEqual(Buffer.from((await store.get(report.added[1].id)).data), NBT);
});

test('ZIP ohne Manifest: Titel = Dateiname; kaputte manifest.json wird gemeldet, die Bauten kommen trotzdem', async () => {
  const store = memoryStore();
  const plain = await store.addFiles([fakeFile('bauten.zip', makeZip([{ name: 'Burg Eins.schem', data: HOUSE }, { name: 'modelle/Würfel.stl', data: STL }]))]);
  assert.deepEqual(plain.added.map((entry) => [entry.title, entry.fileName, entry.params]), [['Burg Eins', 'Burg Eins.schem', null], ['Würfel', 'Würfel.stl', null]]);
  assert.deepEqual(plain.skipped, []);
  const broken = await store.addFiles([fakeFile('kaputt.zip', makeZip([{ name: 'manifest.json', data: '{ kein JSON' }, { name: 'a.nbt', data: NBT }]))]);
  assert.deepEqual(broken.added.map((entry) => entry.title), ['a']);
  assert.equal(broken.skipped.length, 1);
  assert.match(broken.skipped[0].name, /manifest\.json$/);
  // Gleicher Dateiname in zwei Ordnern: das Manifest gilt über den Pfad, nicht über den Namen
  const twice = await store.addFiles([fakeFile('zwei.zip', makeZip([
    { name: 'manifest.json', data: JSON.stringify([{ file: 'a/haus.schem', title: 'A' }, { file: 'b/haus.schem', title: 'B' }]) },
    { name: 'a/haus.schem', data: HOUSE },
    { name: 'b/haus.schem', data: HOUSE },
  ]))]);
  assert.deepEqual(twice.added.map((entry) => entry.title), ['A', 'B']);
  // Dasselbe mit der manifest.json in einem Unterordner: Pfade gelten ab ihrem Ordner
  const nested = await store.addFiles([fakeFile('paket.zip', makeZip([
    { name: 'paket/manifest.json', data: JSON.stringify([{ file: 'a/haus.schem', title: 'A' }, { file: 'b/haus.schem', title: 'B' }]) },
    { name: 'paket/a/haus.schem', data: HOUSE },
    { name: 'paket/b/haus.schem', data: HOUSE },
  ]))]);
  assert.deepEqual(nested.added.map((entry) => entry.title), ['A', 'B']);
  // Das Manifest nennt nur a/haus.schem: b/haus.schem bekommt weder Titel noch Herkunft und Lizenz von a
  const foreign = await store.addFiles([fakeFile('fremd.zip', makeZip([
    { name: 'manifest.json', data: JSON.stringify([{ file: 'a/haus.schem', title: 'Haus A', author: 'Autor A', license: 'CC BY-NC 4.0' }]) },
    { name: 'a/haus.schem', data: HOUSE },
    { name: 'b/haus.schem', data: HOUSE },
  ]))]);
  assert.deepEqual(foreign.added.map((entry) => [entry.title, entry.source]), [['Haus A', { author: 'Autor A', url: null, license: 'CC BY-NC 4.0' }], ['haus', null]]);
  // Nur über den Dateinamen, wenn er eindeutig ist; jeder Manifest-Eintrag gilt höchstens für eine Datei
  const byName = await store.addFiles([fakeFile('name.zip', makeZip([
    { name: 'manifest.json', data: JSON.stringify([{ file: 'turm.nbt', title: 'Turm' }, { file: 'alt/haus.schem', title: 'Haus' }]) },
    { name: 'bauten/turm.nbt', data: NBT },
    { name: 'x/haus.schem', data: HOUSE },
    { name: 'y/haus.schem', data: HOUSE },
  ]))]);
  assert.deepEqual(byName.added.map((entry) => entry.title), ['Turm', 'haus', 'haus']);
});

test('ZIP-Pfade: „./“ zählt nicht, „..“ und Verstecktes werden gemeldet, Mac-Reste still übergangen', async () => {
  assert.equal(normalizeZipPath('./a//./b\\c.schem'), 'a/b/c.schem');
  assert.deepEqual(zipEntryInfo('./burg.schem'), { path: 'burg.schem', ignore: false, reason: null });
  assert.deepEqual(zipEntryInfo('../haus.schem'), { path: '../haus.schem', ignore: false, reason: MINE_TEXTS.zipParent });
  assert.deepEqual(zipEntryInfo('.ordner/turm.schem'), { path: '.ordner/turm.schem', ignore: false, reason: MINE_TEXTS.zipHidden });
  for (const junk of ['__MACOSX/a/._b.schem', 'a/.DS_Store', '._haus.schem', './']) assert.equal(zipEntryInfo(junk).ignore, true, junk);
  const store = memoryStore();
  const report = await store.addFiles([fakeFile('punkte.zip', makeZip([
    { name: './manifest.json', data: JSON.stringify([{ file: 'burg.schem', title: 'Burg' }]) },
    { name: './burg.schem', data: HOUSE },
    { name: '../haus.schem', data: HOUSE },
    { name: '.ordner/turm.schem', data: HOUSE },
    { name: '.git/config', data: '[core]' },
    { name: '.gitignore', data: '*.tmp' },
    { name: '__MACOSX/._burg.schem', data: 'Mac' },
  ]))]);
  assert.deepEqual(report.added.map((entry) => [entry.title, entry.fileName]), [['Burg', 'burg.schem']]);
  assert.deepEqual(report.skipped, [
    { name: 'punkte.zip: ../haus.schem', reason: MINE_TEXTS.zipParent },
    { name: 'punkte.zip: .ordner/turm.schem', reason: MINE_TEXTS.zipHidden },
  ]);
  // Ein ZIP ohne Bau-Dateien meldet das, statt still „nichts“ zu liefern
  const none = await store.addFiles([fakeFile('leer.zip', makeZip([{ name: '__MACOSX/._x', data: 'Mac' }, { name: '.hidden', data: 'x' }]))]);
  assert.deepEqual(none, { added: [], skipped: [{ name: 'leer.zip', reason: MINE_TEXTS.zipNoBuilds }], notSaved: [], error: null });
});

test('ZIP-Grenzen: zu große Einträge, entpackt über 256 MB, beschädigte und unechte Archive', async () => {
  const store = memoryStore();
  // Angegebene Größe über 64 MB → übersprungen, ohne zu entpacken
  const big = await store.addFiles([fakeFile('gross.zip', makeZip([{ name: 'riesig.schem', data: HOUSE, size: 64 * MB + 1 }, { name: 'ok.nbt', data: NBT }]))]);
  assert.deepEqual(big.added.map((entry) => entry.title), ['ok']);
  assert.match(big.skipped[0].reason, /zu groß/);
  // Fünf Einträge mit je 60 MB laut Verzeichnis: ab dem fünften wäre es entpackt über 256 MB
  const many = Array.from({ length: 5 }, (_, i) => ({ name: `teil${i}.nbt`, data: NBT, method: 0, size: 60 * MB }));
  const total = await store.addFiles([fakeFile('viel.zip', makeZip(many))]);
  assert.equal(total.added.length, 0);
  assert.equal(total.skipped.length, 5);
  assert.ok(total.skipped.slice(0, 4).every((item) => /beschädigt/.test(item.reason)));
  assert.match(total.skipped[4].reason, /entpackt größer als 256 MB/);
  // Prüfsumme falsch
  const crc = await store.addFiles([fakeFile('crc.zip', makeZip([{ name: 'a.nbt', data: NBT, crc: 12345 }]))]);
  assert.match(crc.skipped[0].reason, /Prüfsumme/);
  // Verschlüsselt
  const locked = await store.addFiles([fakeFile('zu.zip', makeZip([{ name: 'a.nbt', data: NBT, flags: 1 }]))]);
  assert.match(locked.skipped[0].reason, /verschlüsselt/);
  // Kein ZIP, abgeschnitten
  const fake = await store.addFiles([fakeFile('falsch.zip', HOUSE), fakeFile('halb.zip', makeZip([{ name: 'a.nbt', data: NBT }]).subarray(0, 40))]);
  assert.deepEqual(fake.skipped.map((item) => item.reason), ['Die Datei ist kein gültiges ZIP-Archiv.', 'Die Datei ist kein gültiges ZIP-Archiv.']);
  // Zu viele Einträge
  const crowded = makeZip(Array.from({ length: MINE_LIMITS.maxZipEntries + 1 }, (_, i) => ({ name: `${i}.txt`, data: 'x', method: 0 })));
  const crowd = await store.addFiles([fakeFile('voll.zip', crowded)]);
  assert.match(crowd.skipped[0].reason, /zu viele Einträge/);
  assert.deepEqual((await store.list()).map((entry) => entry.title), ['ok']);
});

test('ZIP-Leser: Prüfsumme, Erkennung, gespeichert und Deflate, Fehler', async () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
  const zip = makeZip([{ name: 'a.txt', data: 'Hallo Welt', method: 0 }, { name: 'ordner/b.txt', data: 'x'.repeat(5000) }, { name: 'ordner/', data: '' }]);
  assert.equal(isZipData(zip), true);
  assert.equal(isZipData(HOUSE), false);
  const entries = listZipEntries(zip);
  assert.deepEqual(entries.map((entry) => [entry.name, entry.method, entry.size, entry.isDirectory]), [
    ['a.txt', 0, 10, false], ['ordner/b.txt', 8, 5000, false], ['ordner/', 8, 0, true],
  ]);
  assert.equal(Buffer.from(await readZipEntry(zip, entries[0])).toString(), 'Hallo Welt');
  assert.equal(Buffer.from(await readZipEntry(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.length), entries[1])).toString(), 'x'.repeat(5000));
  await assert.rejects(readZipEntry(zip, entries[1], { maxBytes: 100 }), { name: 'ZipError', code: 'too-large' });
  await assert.rejects(readZipEntry(zip, entries[2]), { code: 'directory' });
  await assert.rejects(readZipEntry(zip, { ...entries[0], method: 12 }), { code: 'unsupported' });
  await assert.rejects(readZipEntry(zip, { ...entries[1], size: 4000 }), { code: 'corrupt' });
  await assert.rejects(readZipEntry(zip, { ...entries[1], localHeaderOffset: 3 }), { code: 'corrupt' });
  assert.throws(() => listZipEntries(Buffer.from('kein zip')), { name: 'ZipError', code: 'not-zip' });
  assert.throws(() => listZipEntries(zip, { maxEntries: 2 }), { code: 'too-many' });
  assert.throws(() => listZipEntries('Text'), TypeError);
  assert.ok(new ZipError('x', 'y') instanceof Error);
});

/* ------------------------------------------------------------------ IndexedDB und dauerhafter Speicher */

// Kleine Nachbildung von IndexedDB (nur was das Backend nutzt). quota: Schreib-Transaktionen brechen ab wie bei vollem
// Speicher (Chrome); requestQuota: die Anfrage selbst scheitert, der Fehler steigt zur Transaktion auf (dort ist
// transaction.error beim onerror noch leer), danach bricht die Transaktion ab.
function fakeIndexedDB({ quota = false, requestQuota = false } = {}) {
  const data = { meta: new Map(), data: new Map() };
  const calls = { opened: 0 };
  const request = (fn) => {
    const req = { onsuccess: null, result: undefined };
    queueMicrotask(() => {
      req.result = fn();
      req.onsuccess?.();
    });
    return req;
  };
  const db = {
    objectStoreNames: { contains: (name) => Object.hasOwn(data, name) },
    close() {},
    transaction(names, mode) {
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      const writes = [];
      tx.objectStore = (name) => ({
        get: (key) => request(() => structuredClone(data[name].get(key))),
        getAll: () => request(() => [...data[name].values()].map((value) => structuredClone(value))),
        put: (value, key) => {
          writes.push(() => data[name].set(key ?? value.id, structuredClone(value)));
          return request(() => key ?? value.id);
        },
        delete: (key) => {
          writes.push(() => data[name].delete(key));
          return request(() => undefined);
        },
      });
      setTimeout(() => {
        if (requestQuota && mode === 'readwrite' && writes.length) {
          const failed = { error: Object.assign(new Error('voll'), { name: 'QuotaExceededError' }) };
          tx.onerror?.({ target: failed });
          tx.error = Object.assign(new Error('abgebrochen'), { name: 'AbortError' });
          tx.onabort?.();
          return;
        }
        if (quota && mode === 'readwrite' && writes.length) {
          tx.error = Object.assign(new Error('voll'), { name: 'QuotaExceededError' });
          tx.onabort?.();
          return;
        }
        for (const write of writes) write();
        tx.oncomplete?.();
      }, 0);
      return tx;
    },
  };
  return {
    data,
    calls,
    open() {
      calls.opened++;
      const req = { result: db };
      setTimeout(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

test('IndexedDB-Backend: Liste ohne Daten, Daten getrennt, Bearbeiten, Löschen', async () => {
  const indexedDB = fakeIndexedDB();
  const store = createMyBuilds({ backend: createIndexedDbBackend({ indexedDB }) });
  const entry = await store.add({ fileName: 'house.schem', data: HOUSE, category: 'klein' });
  assert.equal(indexedDB.data.meta.size, 1);
  assert.equal(indexedDB.data.data.size, 1);
  assert.ok(!('data' in indexedDB.data.meta.get(entry.id)), 'Metadaten ohne Daten');
  assert.deepEqual((await store.list()).map((item) => item.title), ['house']);
  assert.deepEqual(Buffer.from((await store.get(entry.id)).data), HOUSE);
  assert.equal((await store.rename(entry.id, 'Hütte')).title, 'Hütte');
  assert.equal(indexedDB.data.meta.get(entry.id).title, 'Hütte');
  await assert.rejects(store.rename('00000000-0000-4000-8000-000000000000', 'x'), { code: 'not-found' });
  assert.equal(await store.remove(entry.id), true);
  assert.equal(indexedDB.data.meta.size + indexedDB.data.data.size, 0);
  assert.equal(indexedDB.calls.opened, 1, 'die Datenbank wird nur einmal geöffnet');
});

test('IndexedDB-Backend: Speicher voll und nicht verfügbar → verständliche Meldungen', async () => {
  const full = createMyBuilds({ backend: createIndexedDbBackend({ indexedDB: fakeIndexedDB({ quota: true }) }) });
  await assert.rejects(full.add({ fileName: 'house.schem', data: HOUSE }), { name: 'MyBuildsError', code: 'quota', message: MINE_TEXTS.quota });
  // Fehler an der Anfrage selbst: die Ursache geht nicht verloren
  const request = createMyBuilds({ backend: createIndexedDbBackend({ indexedDB: fakeIndexedDB({ requestQuota: true }) }) });
  await assert.rejects(request.add({ fileName: 'house.schem', data: HOUSE }), { name: 'MyBuildsError', code: 'quota', message: MINE_TEXTS.quota });
  const none = createMyBuilds({ backend: createIndexedDbBackend({ indexedDB: undefined }) });
  await assert.rejects(none.list(), { code: 'unavailable', message: MINE_TEXTS.unavailable });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const throwing = createMyBuilds({ backend: createIndexedDbBackend({ indexedDB: { open() { throw new Error('gesperrt'); } } }) });
    await assert.rejects(throwing.list(), { code: 'unavailable' });
    const hanging = createMyBuilds({ backend: createIndexedDbBackend({ indexedDB: { open: () => ({}) }, openTimeoutMs: 20 }) });
    await assert.rejects(hanging.list(), { code: 'unavailable' });
  } finally {
    console.warn = warn;
  }
});

test('Dauerhafter Speicher: einmal still anfragen, Fehler stören nicht', async () => {
  let calls = 0;
  const storage = { persist: () => { calls++; return Promise.reject(new Error('nein')); } };
  requestPersistence(storage);
  requestPersistence(storage);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  assert.doesNotThrow(() => requestPersistence(undefined));
});
