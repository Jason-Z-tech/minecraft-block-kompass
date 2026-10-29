// Community-Bauten (ARCHITEKTUR §9.2): data/community/builds.json streng prüfen, Katalog-Einträge bauen (wie ein Upload),
// Quelle { kind: 'community', file } im 3D-Worker mit Namensprüfung, Seite (Eintrag, Quelle, Credits) und echte Daten.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, open } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMUNITY_DIR, COMMUNITY_FORMATS, COMMUNITY_MAX_BLOCKS, COMMUNITY_MAX_FILE_BYTES, COMMUNITY_MAX_TOTAL_BYTES, OPEN_LICENSE_IDS,
  OPEN_LICENSES, parseCommunityFile, isCommunityFile, licenseLabel,
} from '../../js/data/community.js';
import {
  validateCommunityEntry, validateCommunityList, readCommunity, communityFingerprintParts, sourceTitle, communityCredits,
  buildCommunityEntry,
} from '../../scripts/lib/community.mjs';
import { buildCatalog, codeFingerprint, catalogCommunity, parseArgs, defaultCommunityDir, DEFAULT_COMMUNITY_DIR, DEFAULT_MODULES_DIR, UsageError } from '../../scripts/build-catalog.mjs';
import { loadGameData as loadCheckData } from '../../scripts/check-build.mjs';
import { Engine, EngineError, checkSource, fetchCommunityFile, buildCommunityResult } from '../../js/render/engine-worker.js';
import * as uploader from '../../js/create/import/index.js';
import { normalizeBuild, cleanCommunity } from '../../js/ui/data.js';
import { normalizeBuildDetails, sourceForEntry, viewEntry } from '../../js/ui/build/entry.js';
import { thumbHash } from '../../scripts/make-thumbs.mjs';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';
import { dataTest, loadGameData } from './render-models-fixture.test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const HAS_GAME_DATA = existsSync(path.join(DATA_DIR, 'meta.json')) && existsSync(path.join(DATA_DIR, 'blocks.json'));
const NO_DATA = HAS_GAME_DATA ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)';
const IMPORT_FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'create', 'import');
const EXAMPLE_HOUSE = path.join(ROOT, 'tests', 'fixtures', 'core', 'example-house.js');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const engineError = (pattern, code = null) => (error) => error instanceof EngineError && pattern.test(error.message) && (code === null || error.code === code);

/** Gültiger Eintrag für builds.json (Datei: tests/fixtures/create/import/house.nbt) */
const ENTRY = Object.freeze({
  id: 'test-haus', title: 'Testhaus', subtitle: 'Kleines Haus aus der Testdatei', category: 'haeuser', file: 'test-haus.nbt', format: 'nbt',
  author: 'Erika Beispiel', url: 'https://github.com/beispiel/bauten/blob/0123456789abcdef0123456789abcdef01234567/haus.nbt',
  license: 'CC-BY-4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', commit: '0123456789abcdef0123456789abcdef01234567',
  tags: ['Community', 'Holz'],
});
const entry = (over = {}) => ({ ...ENTRY, ...over });

let workDir;
before(async () => {
  await mkdir(path.join(ROOT, 'tmp', 'catalog-tests'), { recursive: true });
  workDir = await mkdtemp(path.join(ROOT, 'tmp', 'catalog-tests', 'community-'));
});
after(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

/** Ordner wie data/community/ anlegen: builds.json (Liste oder Text) und Dateien { name: Quelle | Buffer | Text } */
async function communityDir(name, list, files = {}) {
  const dir = path.join(workDir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'builds.json'), typeof list === 'string' ? list : JSON.stringify(list));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    if (typeof content === 'string' && content.startsWith(IMPORT_FIXTURES)) await copyFile(content, path.join(dir, file));
    else await writeFile(path.join(dir, file), content);
  }
  return dir;
}

const fixture = (name) => path.join(IMPORT_FIXTURES, name);

// Saubere Testdateien: nur Blöcke aus 26.2 und die alte „chain“ (wird zu „iron_chain“ umbenannt), keine Mod-Blöcke.
// Die Testszene der Import-Fixtures (house.nbt, house-v2.schem, regions.litematic) enthält dagegen „create:shaft“ (Mod)
// und „totally_new_block“ (unbekannt).
const CLEAN_STATES = ['minecraft:air', 'minecraft:stone', 'minecraft:chain[axis=y,waterlogged=false]', 'minecraft:oak_planks'];
// 3 × 2 × 2 (Index = (y · 2 + z) · 3 + x), 10 Blöcke
const CLEAN_CELLS = [1, 1, 1, 1, 1, 1, 2, 3, 0, 3, 2, 0];

function stateCompound(nbt, state) {
  const open = state.indexOf('[');
  const entries = { Name: nbt.string(open < 0 ? state : state.slice(0, open)) };
  if (open >= 0) {
    entries.Properties = nbt.compound(Object.fromEntries(state.slice(open + 1, -1).split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, nbt.string(value)];
    })));
  }
  return nbt.compound(entries);
}

/** Strukturdatei (.nbt, gzip) mit den sauberen Blöcken */
async function cleanNbt() {
  const { encodeNbt, nbt } = await import('../fixtures/create/import/make-fixtures.mjs');
  const blocks = [];
  CLEAN_CELLS.forEach((cell, i) => {
    if (cell) blocks.push(nbt.compound({ pos: nbt.list(3, [nbt.int(i % 3), nbt.int(Math.floor(i / 6)), nbt.int(Math.floor(i / 3) % 2)]), state: nbt.int(cell) }));
  });
  return gzipSync(encodeNbt('', nbt.compound({
    DataVersion: nbt.int(4903),
    size: nbt.list(3, [nbt.int(3), nbt.int(2), nbt.int(2)]),
    palette: nbt.list(10, CLEAN_STATES.map((state) => stateCompound(nbt, state))),
    blocks: nbt.list(10, blocks),
    entities: nbt.list(10, []),
  })), { level: 9, mtime: 0 });
}

/** Litematica-Datei (gzip) mit zwei Regionen: die sauberen Blöcke (10) und der Treppenturm der Fixtures (31) */
async function cleanLitematic() {
  const { litematicFile, litematicRegion, TOWER, towerCell } = await import('../fixtures/create/import/make-fixtures.mjs');
  const [tx, ty, tz] = TOWER.size.map(Math.abs);
  const towerCells = Array.from({ length: tx * ty * tz }, (_, i) => towerCell(i));
  return gzipSync(litematicFile({
    Haus: litematicRegion([0, 0, 0], [3, 2, 2], CLEAN_STATES, CLEAN_CELLS, 2),
    Turm: litematicRegion(TOWER.position, TOWER.size, ['minecraft:air', ...TOWER.states], towerCells, 5),
  }, { name: 'Sauber', enclosing: [13, 6, 7] }), { level: 9, mtime: 0 });
}

describe('Gemeinsame Regeln (js/data/community.js)', () => {
  test('Dateinamen: nur <id>.nbt|schem|litematic, kein Pfad, keine alte .schematic', () => {
    assert.deepEqual(COMMUNITY_FORMATS, ['nbt', 'schem', 'litematic']);
    assert.equal(COMMUNITY_DIR, 'data/community/');
    assert.equal(COMMUNITY_MAX_FILE_BYTES, 20 * 1024 * 1024);
    assert.equal(COMMUNITY_MAX_TOTAL_BYTES, 200 * 1024 * 1024);
    assert.deepEqual(parseCommunityFile('qrafty-sphinx.nbt'), { id: 'qrafty-sphinx', format: 'nbt' });
    assert.deepEqual(parseCommunityFile('gidden-kapitol.litematic'), { id: 'gidden-kapitol', format: 'litematic' });
    assert.deepEqual(parseCommunityFile('a1.schem'), { id: 'a1', format: 'schem' });
    for (const bad of ['../x.nbt', 'a/b.nbt', 'a\\b.nbt', '/x.nbt', 'X.nbt', 'x.NBT', 'x.schematic', 'x.nbt?y=1', 'x.nbt#a', '.nbt', 'x', '',
      '-x.nbt', 'x-.nbt', 'a--b.nbt', 'x.json', 'x.js', 'x.nbt.js', `${'a'.repeat(81)}.nbt`, ' x.nbt', 'x.nbt ', 'x%2e.nbt', null, 42, {}]) {
      assert.equal(parseCommunityFile(bad), null, String(bad));
      assert.equal(isCommunityFile(bad), false, String(bad));
    }
  });

  test('Offene Lizenzen mit Anzeige und Lizenz-Adresse; andere gelten nicht', () => {
    for (const id of ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'MIT', 'Apache-2.0', 'Unlicense']) {
      assert.ok(OPEN_LICENSE_IDS.includes(id), id);
      assert.match(OPEN_LICENSES[id].url, /^https:\/\//);
    }
    assert.equal(licenseLabel('CC-BY-NC-4.0'), 'CC BY-NC 4.0');
    assert.equal(licenseLabel('Apache-2.0'), 'Apache 2.0');
    for (const bad of ['All rights reserved', 'ARR', 'GPL-3.0', 'CC-BY-ND-4.0', 'mit', 'toString', '', null]) assert.equal(licenseLabel(bad), null, String(bad));
  });
});

describe('builds.json prüfen (scripts/lib/community.mjs)', () => {
  test('Gültiger Eintrag ohne Fehler, auch mit allen optionalen Feldern', () => {
    assert.deepEqual(validateCommunityEntry(ENTRY), []);
    assert.deepEqual(validateCommunityEntry(entry({
      aliases: ['oak cottage'], sourcePath: 'data/x/structure/haus.nbt', sha256: 'a'.repeat(64), licenseFile: 'licenses/github-beispiel.txt',
      commit: 'modrinth:BuqZmdbc/1.5.1/sha1:c22d961c4f89322f066847ed4338e7b9b14e3fb7',
    })), []);
  });

  test('Jedes Feld wird streng geprüft', () => {
    const errorsOf = (over) => validateCommunityEntry(entry(over)).join('\n');
    assert.match(errorsOf({ extra: 1 }), /Feld „extra“ ist unbekannt/);
    const { license: _drop, ...noLicense } = ENTRY;
    assert.match(validateCommunityEntry(noLicense).join('\n'), /Feld „license“ fehlt/);
    assert.match(errorsOf({ id: 'Test Haus', file: 'Test Haus.nbt' }), /id muss/);
    assert.match(errorsOf({ title: '' }), /title/);
    assert.match(errorsOf({ title: ' Testhaus' }), /title/);
    assert.match(errorsOf({ subtitle: 'x'.repeat(201) }), /subtitle/);
    assert.match(errorsOf({ category: 'farmen' }), /category muss/);
    assert.match(errorsOf({ category: 'redstone' }), /category muss/);
    assert.match(errorsOf({ file: 'anderer-name.nbt' }), /passt nicht zur id/);
    assert.match(errorsOf({ file: 'test-haus.schem' }), /Endung .* passt nicht zum format/);
    assert.match(errorsOf({ file: '../test-haus.nbt' }), /file muss/);
    assert.match(errorsOf({ format: 'schematic', file: 'test-haus.schematic' }), /format muss/);
    assert.match(errorsOf({ format: 'stl', file: 'test-haus.stl' }), /format muss/);
    assert.match(errorsOf({ author: '' }), /author/);
    assert.match(errorsOf({ url: 'http://github.com/x' }), /url muss eine https-Adresse sein/);
    assert.match(errorsOf({ url: 'javascript:alert(1)' }), /url muss/);
    assert.match(errorsOf({ url: 'https://user:pw@example.org/x' }), /url muss/);
    assert.match(errorsOf({ licenseUrl: 'ftp://example.org/lizenz' }), /licenseUrl muss/);
    assert.match(errorsOf({ license: 'All rights reserved' }), /keine offene Lizenz/);
    assert.match(errorsOf({ license: 'CC-BY-ND-4.0' }), /keine offene Lizenz/);
    assert.match(errorsOf({ commit: 'main' }), /commit muss/);
    assert.match(errorsOf({ commit: 'modrinth:abc' }), /commit muss/);
    assert.match(errorsOf({ tags: 'Holz' }), /tags muss/);
    assert.match(errorsOf({ tags: ['Holz', 'Holz'] }), /tags enthält Einträge doppelt/);
    assert.match(errorsOf({ tags: ['Anfänger'] }), /Schwierigkeit/);
    assert.match(errorsOf({ aliases: ['Oak Cottage'] }), /aliases muss klein geschrieben sein/);
    assert.match(errorsOf({ sha256: 'xyz' }), /sha256/);
    assert.match(errorsOf({ licenseFile: '../LICENSE' }), /licenseFile/);
    assert.deepEqual(validateCommunityEntry('kein Objekt'), ['Eintrag ist kein Objekt.']);
  });

  test('Liste: doppelte IDs und Kollision mit Bau-Modulen fallen weg, gute Einträge bleiben', () => {
    assert.match(validateCommunityList({ builds: [] }).errors[0], /muss eine Liste/);
    const list = [ENTRY, entry({ id: 'doppelt', file: 'doppelt.nbt' }), entry({ id: 'doppelt', file: 'doppelt.nbt', title: 'Zwei' }),
      entry({ id: 'windmuehle', file: 'windmuehle.nbt' }), entry({ id: 'kaputt', file: 'kaputt.nbt', license: 'GPL-3.0' })];
    const { entries, errors } = validateCommunityList(list, { moduleIds: new Set(['windmuehle']) });
    assert.deepEqual(entries.map((e) => e.id), ['test-haus']);
    assert.equal(errors.filter((e) => /doppelt: id „doppelt“ steht mehrfach/.test(e)).length, 2);
    assert.ok(errors.some((e) => /windmuehle: id „windmuehle“ gibt es schon als Bau-Modul/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /kaputt: license „GPL-3.0“ ist keine offene Lizenz/.test(e)), errors.join('\n'));
  });

  test('Dateien: vorhanden, nicht leer, höchstens 20 MB, Prüfsumme, Lizenztext, nichts Fremdes im Ordner', async () => {
    const house = readFileSync(fixture('house.nbt'));
    const dir = await communityDir('dateien', [
      entry({ sha256: sha256(house), licenseFile: 'licenses/beispiel.txt' }),
      entry({ id: 'fehlt', file: 'fehlt.nbt' }),
      entry({ id: 'leer', file: 'leer.nbt' }),
      entry({ id: 'falsche-summe', file: 'falsche-summe.nbt', sha256: '0'.repeat(64) }),
      entry({ id: 'ohne-lizenztext', file: 'ohne-lizenztext.nbt', licenseFile: 'licenses/gibt-es-nicht.txt' }),
      entry({ id: 'zu-gross', file: 'zu-gross.nbt' }),
    ], {
      'test-haus.nbt': fixture('house.nbt'), 'leer.nbt': '', 'falsche-summe.nbt': fixture('house.nbt'), 'ohne-lizenztext.nbt': fixture('house.nbt'),
      'zu-gross.nbt': Buffer.alloc(COMMUNITY_MAX_FILE_BYTES + 1), 'licenses/beispiel.txt': 'MIT', 'licenses/uebrig.txt': 'x', 'fremd.schem': 'x',
    });
    const { entries, errors, warnings } = await readCommunity({ dir });
    assert.deepEqual(entries.map((e) => e.id), ['test-haus']);
    assert.ok(Buffer.from(entries[0].bytes).equals(house), 'Bytes unverändert');
    const text = errors.join('\n');
    assert.match(text, /fehlt: data\/community\/fehlt\.nbt fehlt\./);
    assert.match(text, /leer: data\/community\/leer\.nbt ist leer\./);
    assert.match(text, /falsche-summe: .*andere Prüfsumme/);
    assert.match(text, /ohne-lizenztext: data\/community\/licenses\/gibt-es-nicht\.txt .* fehlt/);
    assert.match(text, /zu-gross: .* höchstens 20 MB/);
    assert.match(text, /data\/community\/fremd\.schem gehört zu keinem Eintrag/);
    assert.deepEqual(warnings, ['data/community/licenses/uebrig.txt: Lizenztext ohne Eintrag.']);
  });

  test('Ordner höchstens 200 MB (große Datei ohne Inhalt, nur die Größe zählt)', async () => {
    const dir = await communityDir('zu-voll', [ENTRY], { 'test-haus.nbt': fixture('house.nbt') });
    const handle = await open(path.join(dir, 'gross.bin'), 'w');
    try {
      await handle.truncate(COMMUNITY_MAX_TOTAL_BYTES + 1);
    } finally {
      await handle.close();
    }
    const { errors } = await readCommunity({ dir });
    assert.ok(errors.some((e) => /^data\/community ist 200\.0 MB groß – erlaubt sind höchstens 200 MB\.$/.test(e)), errors.join('\n'));
    await rm(path.join(dir, 'gross.bin'));
    assert.deepEqual((await readCommunity({ dir })).errors, [], 'unter der Grenze kein Fehler');
  });

  test('Kaputtes oder fehlendes builds.json; ohne Ordner keine Community-Bauten', async () => {
    const broken = await communityDir('kaputt', '{ nicht json');
    assert.match((await readCommunity({ dir: broken })).errors[0], /builds\.json ist nicht lesbar/);
    const noList = path.join(workDir, 'ohne-liste');
    await mkdir(noList, { recursive: true });
    assert.match((await readCommunity({ dir: noList })).errors[0], /builds\.json fehlt/);
    assert.deepEqual(await readCommunity({ dir: path.join(workDir, 'gibt-es-nicht') }), { entries: [], errors: [], warnings: [] });
  });

  test('Quelle und Credits für den Katalog', () => {
    assert.equal(sourceTitle('https://github.com/kogtyv/kogtyv-WOM/blob/913c/data/x.nbt'), 'GitHub: kogtyv/kogtyv-WOM');
    assert.equal(sourceTitle('https://modrinth.com/project/qraftyfied'), 'Modrinth: qraftyfied');
    assert.equal(sourceTitle('https://example.org/bauten/haus'), 'example.org');
    assert.deepEqual(communityCredits(ENTRY), {
      sources: [{ title: 'GitHub: beispiel/bauten', url: ENTRY.url }],
      credits: { author: 'Erika Beispiel', url: ENTRY.url, license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
    });
  });

  test('Fingerabdruck erkennt jede Änderung an data/community (Bytes, nicht Zeilenenden umgedeutet)', async () => {
    const dir = await communityDir('fingerabdruck', [ENTRY], { 'test-haus.nbt': fixture('house.nbt') });
    const base = await codeFingerprint({ modulesDir: path.join(workDir, 'keine-module'), communityDir: dir });
    assert.equal(await codeFingerprint({ modulesDir: path.join(workDir, 'keine-module'), communityDir: dir }), base, 'stabil');
    const parts = await communityFingerprintParts(dir, workDir);
    assert.deepEqual(parts.map(([file]) => file), ['fingerabdruck/builds.json', 'fingerabdruck/test-haus.nbt']);
    const bytes = await readFile(path.join(dir, 'test-haus.nbt'));
    bytes[bytes.length - 1] ^= 1;
    await writeFile(path.join(dir, 'test-haus.nbt'), bytes);
    const changedFile = await codeFingerprint({ modulesDir: path.join(workDir, 'keine-module'), communityDir: dir });
    assert.notEqual(changedFile, base, 'geänderte Datei zählt');
    await writeFile(path.join(dir, 'builds.json'), JSON.stringify([entry({ title: 'Anders' })]));
    const changedList = await codeFingerprint({ modulesDir: path.join(workDir, 'keine-module'), communityDir: dir });
    assert.notEqual(changedList, changedFile, 'builds.json zählt');
    await writeFile(path.join(dir, 'neu.nbt'), 'x');
    assert.notEqual(await codeFingerprint({ modulesDir: path.join(workDir, 'keine-module'), communityDir: dir }), changedList, 'neue Datei zählt');
    assert.notEqual(await codeFingerprint({ modulesDir: path.join(workDir, 'keine-module'), communityDir: null }), base, 'ohne Community anders');
  });

  test('Optionen: Standard ist data/community zu js/builds, mit eigenem --modules-dir keiner; beides abschaltbar', () => {
    assert.equal(parseArgs([]).communityDir, DEFAULT_COMMUNITY_DIR);
    assert.equal(DEFAULT_COMMUNITY_DIR, path.join(ROOT, 'data', 'community'));
    assert.equal(parseArgs(['--modules-dir', 'tmp/x']).communityDir, null);
    assert.equal(parseArgs(['--modules-dir', 'tmp/x', '--community-dir', 'tmp/c']).communityDir, path.resolve('tmp/c'));
    assert.equal(parseArgs(['--no-community']).communityDir, null);
    assert.throws(() => parseArgs(['--no-community', '--community-dir', 'x']), UsageError);
    assert.throws(() => parseArgs(['--community-dir']), UsageError);
    assert.equal(defaultCommunityDir(DEFAULT_MODULES_DIR), DEFAULT_COMMUNITY_DIR);
    assert.equal(defaultCommunityDir(path.join(workDir, 'module')), null);
  });
});

describe('Katalog mit Community-Bauten', { skip: NO_DATA }, () => {
  test('catalogCommunity: Einträge mit Blöcken, Schritten Ebene für Ebene, Material, Herkunft „original“ und Credits', async () => {
    await loadCheckData(DATA_DIR);
    const data = await cleanLitematic();
    const item = { ...entry({ id: 'zwei-regionen', file: 'zwei-regionen.litematic', format: 'litematic', aliases: ['two regions'] }), bytes: data };
    const { entry: built, errors, notes } = await catalogCommunity(item);
    assert.deepEqual(errors, []);
    // Hinweise des Imports (z. B. umbenannte Blöcke) sind keine Fehler: nur für die Konsole, mit der ID davor
    assert.ok(notes.length > 0 && notes.every((note) => note.startsWith('zwei-regionen: ')), notes.join('\n'));
    assert.ok(notes.some((note) => /iron_chain/.test(note)), 'Umbenennung „chain“ → „iron_chain“ gemeldet');
    assert.equal(built.accuracy, 'original');
    assert.equal(built.module, null);
    assert.deepEqual(built.community, { file: 'zwei-regionen.litematic', format: 'litematic' });
    assert.equal(built.blocks, 41);
    assert.equal(built.phases, 2, 'Regionen der Datei werden Kapitel');
    assert.ok(built.steps >= built.phases, 'Schritte Ebene für Ebene');
    assert.equal(built.description, '');
    assert.deepEqual(built.aliases, ['two regions']);
    assert.deepEqual(built.credits, { author: 'Erika Beispiel', url: ENTRY.url, license: 'CC BY 4.0', licenseUrl: ENTRY.licenseUrl });
    assert.ok(built.topMaterials.length >= 1 && built.topMaterials.length <= 8);
    assert.equal(built.sizeClass, 'klein');
    // Kaputte Datei: Fehler, kein Eintrag
    const broken = await catalogCommunity({ ...entry({ id: 'kaputt', file: 'kaputt.schem', format: 'schem' }), bytes: readFileSync(fixture('truncated.schem')) });
    assert.equal(broken.entry, null);
    assert.match(broken.errors[0], /kaputt: data\/community\/kaputt\.schem lässt sich nicht bauen: Die Datei ist beschädigt/);
    const legacy = await catalogCommunity({ ...entry({ id: 'alt', file: 'alt.schem', format: 'schem' }), bytes: readFileSync(fixture('legacy.schematic')) });
    assert.match(legacy.errors[0], /alte MCEdit-Schematic/);
  });

  test('Blöcke, die es in 26.2 nicht gibt (Mods, unbekannt), und zu viele Blöcke sind Fehler: sonst nicht das Original', async () => {
    await loadCheckData(DATA_DIR);
    for (const [file, format] of [['house.nbt', 'nbt'], ['house-v2.schem', 'schem'], ['regions.litematic', 'litematic']]) {
      const id = `mit-mod-${format}`;
      const result = await catalogCommunity({ ...entry({ id, file: `${id}.${format}`, format }), bytes: readFileSync(fixture(file)) });
      assert.equal(result.entry, null, file);
      assert.deepEqual(result.errors, [
        `${id}: data/community/${id}.${format}: 2 Blöcke gibt es in Minecraft 26.2 nicht („create:shaft“ 1×, „totally_new_block“ 1×) – ohne sie wäre der Bau nicht das Original.`,
      ], file);
    }
    // Eigene Blockgrenze für Community-Bauten (nicht still die Upload-Grenze)
    assert.equal(COMMUNITY_MAX_BLOCKS, 3_000_000);
    const clean = { ...entry({ id: 'sauber', file: 'sauber.nbt' }), bytes: await cleanNbt() };
    const ok = await buildCommunityEntry(clean);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.result.blockCount, 10);
    assert.deepEqual(await buildCommunityEntry(clean, { maxBlocks: 10 }).then((r) => r.errors), []);
    const limited = await buildCommunityEntry(clean, { maxBlocks: 9 });
    assert.equal(limited.result, null);
    assert.deepEqual(limited.errors, ['sauber: data/community/sauber.nbt hat 10 Blöcke – erlaubt sind höchstens 9.']);
  });

  test('buildCatalog: Module und Community-Bauten gemeinsam, fehlerhafte Einträge fehlen mit Fehler', async () => {
    const modules = path.join(workDir, 'module');
    await mkdir(path.join(modules, 'haeuser'), { recursive: true });
    await copyFile(EXAMPLE_HOUSE, path.join(modules, 'haeuser', 'example-house.js'));
    const house = await cleanNbt();
    const dir = await communityDir('katalog', [
      entry({ sha256: sha256(house) }),
      entry({ id: 'example-house', file: 'example-house.nbt', title: 'Gleiche ID' }),
      entry({ id: 'zweites', file: 'zweites.litematic', format: 'litematic', category: 'klein', title: 'Zweites', license: 'MIT', licenseUrl: 'https://opensource.org/license/mit' }),
      entry({ id: 'kaputt', file: 'kaputt.schem', format: 'schem', title: 'Kaputt' }),
      entry({ id: 'mit-mod', file: 'mit-mod.nbt', title: 'Mit Mod-Block' }),
    ], {
      'test-haus.nbt': house, 'example-house.nbt': house, 'zweites.litematic': await cleanLitematic(),
      'kaputt.schem': fixture('truncated.schem'), 'mit-mod.nbt': fixture('house.nbt'),
    });
    const { catalog, errors, stats, communityNotes } = await buildCatalog({ modulesDir: modules, communityDir: dir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['example-house', 'test-haus', 'zweites']);
    assert.equal(stats.community, 2);
    assert.deepEqual(catalog.counts.byCategory, { haeuser: 2, wahrzeichen: 0, fantasy: 0, mittelalter: 0, klein: 1, infrastruktur: 0 });
    assert.equal(errors.length, 3, errors.join('\n'));
    assert.match(errors.join('\n'), /example-house: id „example-house“ gibt es schon als Bau-Modul/);
    assert.match(errors.join('\n'), /kaputt: data\/community\/kaputt\.schem lässt sich nicht bauen/);
    assert.match(errors.join('\n'), /mit-mod: data\/community\/mit-mod\.nbt: 2 Blöcke gibt es in Minecraft 26\.2 nicht/);
    assert.ok(catalog.warnings.includes('data/community/kaputt.schem: wegen Fehlern nicht im Katalog.'));
    assert.ok(catalog.warnings.includes('data/community/mit-mod.nbt: wegen Fehlern nicht im Katalog.'));
    // Hinweise des Imports zu unveränderten Dateien stehen nur in communityNotes (Konsole), nicht unter warnings
    assert.ok(communityNotes.some((note) => note.startsWith('test-haus: ')) && communityNotes.some((note) => note.startsWith('zweites: ')), communityNotes.join('\n'));
    assert.ok(!catalog.warnings.some((warning) => /^(?:test-haus|zweites): /.test(warning)), catalog.warnings.join('\n'));
    const built = catalog.builds.find((b) => b.id === 'test-haus');
    assert.equal(built.credits.license, 'CC BY 4.0');
    assert.equal(catalog.builds.find((b) => b.id === 'zweites').credits.license, 'MIT');
    assert.equal(catalog.builds.find((b) => b.id === 'example-house').community, null);
    assert.equal(catalog.inputs.code, await codeFingerprint({ modulesDir: modules, communityDir: dir }));
    // Mit eigenem Modul-Ordner und ohne Angabe gibt es keine Community-Bauten
    const only = await buildCatalog({ modulesDir: modules });
    assert.deepEqual(only.catalog.builds.map((b) => b.id), ['example-house']);
  });
});

describe('3D-Worker: Quelle { kind: "community", file }', () => {
  test('checkSource: nur ein Dateiname aus data/community/', () => {
    assert.deepEqual(checkSource({ kind: 'community', file: 'qrafty-sphinx.nbt' }), { kind: 'community', file: 'qrafty-sphinx.nbt', format: 'nbt' });
    assert.deepEqual(checkSource({ kind: 'community', file: 'gidden-kapitol.litematic', path: '../x' }), { kind: 'community', file: 'gidden-kapitol.litematic', format: 'litematic' });
    for (const bad of ['../game-data/blocks.json', 'data/community/qrafty-sphinx.nbt', '/qrafty-sphinx.nbt', 'https://example.org/x.nbt', 'x.schematic', 'X.nbt', '', null, 7]) {
      assert.throws(() => checkSource({ kind: 'community', file: bad }), engineError(/Ungültiger Community-Bau/, 'source'), String(bad));
    }
  });

  test('fetchCommunityFile: gleiche Herkunft (auch unter einem Unterordner wie auf GitHub Pages), Fehler verständlich', async () => {
    const seen = [];
    const bytes = new Uint8Array([1, 2, 3]);
    const ok = async (url, init) => {
      seen.push([String(url), init.credentials]);
      return new Response(bytes, { status: 200 });
    };
    const data = await fetchCommunityFile('qrafty-sphinx.nbt', { rootUrl: new URL('https://jason-z-tech.github.io/minecraft-block-kompass/'), fetch: ok });
    assert.deepEqual([...new Uint8Array(data)], [1, 2, 3]);
    assert.deepEqual(seen, [['https://jason-z-tech.github.io/minecraft-block-kompass/data/community/qrafty-sphinx.nbt', 'same-origin']]);
    const root = new URL('http://127.0.0.1:8080/');
    await assert.rejects(fetchCommunityFile('../x.nbt', { rootUrl: root, fetch: ok }), engineError(/Ungültiger Community-Bau/, 'source'));
    assert.equal(seen.length, 1, 'ungültiger Name: keine Anfrage');
    await assert.rejects(fetchCommunityFile('ab.nbt', { rootUrl: root, fetch: async () => new Response('', { status: 404 }) }), engineError(/fehlt auf der Seite/, 'community'));
    await assert.rejects(fetchCommunityFile('ab.nbt', { rootUrl: root, fetch: async () => new Response('', { status: 503 }) }), engineError(/Fehler 503/, 'community'));
    await assert.rejects(fetchCommunityFile('ab.nbt', { rootUrl: root, fetch: async () => { throw new TypeError('Failed to fetch'); } }), engineError(/Internetverbindung/, 'community'));
    const huge = async () => new Response('x', { status: 200, headers: { 'content-length': String(COMMUNITY_MAX_FILE_BYTES + 1) } });
    await assert.rejects(fetchCommunityFile('ab.nbt', { rootUrl: root, fetch: huge }), engineError(/größer als 20 MB/, 'community'));
    const big = async () => new Response(new Uint8Array(COMMUNITY_MAX_FILE_BYTES + 1), { status: 200 });
    await assert.rejects(fetchCommunityFile('ab.nbt', { rootUrl: root, fetch: big }), engineError(/größer als 20 MB/, 'community'));
  });

  test('buildCommunityResult: ohne Lader verständlicher Fehler, kaputte Datei wie ein Upload (code upload)', async () => {
    await assert.rejects(buildCommunityResult({ kind: 'community', file: 'ab.nbt', format: 'nbt' }, {}), engineError(/können hier nicht geladen werden/, 'source'));
    const bytes = readFileSync(fixture('truncated.schem'));
    const loaders = { importUploader: async () => uploader, loadCommunityFile: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    await assert.rejects(buildCommunityResult({ kind: 'community', file: 'kaputt.schem', format: 'schem' }, loaders), engineError(/beschädigt/, 'upload'));
  });

  dataTest('Engine.build: Community-Bau wie ein Upload gebaut, Quelle im Ergebnis ohne Datei', async () => {
    const { models, blocks } = loadGameData();
    const engine = new Engine({ modelsJson: models, blocksJson: blocks });
    const bytes = readFileSync(fixture('regions.litematic'));
    const requested = [];
    const loaders = {
      importUploader: async () => uploader,
      loadCommunityFile: async (file) => {
        requested.push(file);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      },
    };
    const result = await engine.build({ kind: 'community', file: 'zwei-regionen.litematic' }, {}, loaders);
    assert.deepEqual(requested, ['zwei-regionen.litematic']);
    assert.deepEqual(result.source, { kind: 'community', file: 'zwei-regionen.litematic', format: 'litematic' });
    assert.equal(result.blockCount, 55);
    assert.equal(result.phases.length, 2);
    assert.equal(result.upload.name, 'zwei-regionen.litematic');
  });
});

describe('Seite: Katalog-Eintrag, Quelle und Credits', () => {
  const RAW = {
    id: 'qrafty-sphinx', title: 'Sphinx', category: 'wahrzeichen', subtitle: 'Kleine Sphinx aus Sandstein', tags: ['Community'], aliases: [], accuracy: 'original',
    description: '', sources: [{ title: 'Modrinth: qraftyfied', url: 'https://modrinth.com/project/qraftyfied' }],
    credits: { author: 'qrafty', url: 'https://modrinth.com/project/qraftyfied', license: 'CC BY-NC 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/' },
    tested: null, module: null, community: { file: 'qrafty-sphinx.nbt', format: 'nbt' }, scales: null, defaultScale: null,
    size: [12, 9, 8], blocks: 223, steps: 9, phases: 1, variants: null, topMaterials: [['stone', 100]], sizeClass: 'klein', thumb: null,
  };

  test('data.js übernimmt community (nur gültige Dateinamen) und die Lizenz-Adresse', () => {
    const { ok, build } = normalizeBuild(RAW);
    assert.ok(ok);
    assert.deepEqual(build.community, { file: 'qrafty-sphinx.nbt', format: 'nbt' });
    assert.equal(build.module, null);
    assert.deepEqual(build.credits, RAW.credits);
    assert.equal(normalizeBuild({ ...RAW, community: { file: '../../game-data/blocks.json' } }).build.community, null);
    assert.equal(normalizeBuild({ ...RAW, credits: { ...RAW.credits, licenseUrl: 'javascript:alert(1)' } }).build.credits.licenseUrl, null);
    assert.equal(cleanCommunity({ file: 'qrafty-sphinx.nbt', format: 'schem' }), null, 'Format muss zur Endung passen');
    assert.deepEqual(cleanCommunity({ file: 'a-b.schem' }), { file: 'a-b.schem', format: 'schem' });
    assert.equal(cleanCommunity('qrafty-sphinx.nbt'), null);
  });

  test('Bau-Seite: Quelle aus dem Eintrag, Modul hat Vorrang, ungültige Datei → keine Quelle', () => {
    const details = normalizeBuildDetails(RAW);
    assert.deepEqual(details.community, { file: 'qrafty-sphinx.nbt', format: 'nbt' });
    assert.deepEqual(sourceForEntry({ ...RAW, ...details }), { kind: 'community', file: 'qrafty-sphinx.nbt' });
    assert.deepEqual(sourceForEntry({ module: 'js/builds/klein/x.js', community: RAW.community }), { kind: 'module', path: 'js/builds/klein/x.js' });
    assert.equal(sourceForEntry({ community: { file: '../x.nbt' } }), null);
    assert.equal(sourceForEntry(null), null);
    for (const bad of ['javascript:alert(1)', 'http://example.org/lizenz', 'lizenz.html', ' ', 42]) {
      assert.equal(normalizeBuildDetails({ ...RAW, credits: { ...RAW.credits, licenseUrl: bad } }).credits.licenseUrl, null, String(bad));
      assert.equal(normalizeBuildDetails({ ...RAW, credits: { ...RAW.credits, url: bad } }).credits.url, null, String(bad));
    }
    const shown = viewEntry({ ...RAW, ...details });
    assert.equal(shown.accuracy, 'original');
    assert.deepEqual(shown.credits, RAW.credits, 'Infos-Tab: Ersteller, Link, Lizenz und Lizenz-Adresse');
  });

  test('Infos-Tab im Browser: Ersteller und Lizenz nur als https-Link, sonst reiner Text', { timeout: 60000 }, async (t) => {
    let page;
    try {
      page = await launchBrowser({ width: 800, height: 600 });
    } catch (error) {
      if (/Kein Chrome/.test(error.message)) return t.skip(error.message);
      throw error;
    }
    const server = await startServer({ port: 0 });
    try {
      await page.goto(`${server.url}/docs/ARCHITEKTUR.md`);
      // InfoPanel direkt mit dem Roh-Eintrag (ohne normalizeBuildDetails): Der Tab selbst darf keinen unsicheren Link bauen
      const links = (credits) => page.eval(`(async () => {
        const { InfoPanel } = await import('/js/ui/build/info.js');
        const entry = ${JSON.stringify({ ...RAW, sources: [] })};
        entry.credits = ${JSON.stringify(credits)};
        const panel = new InfoPanel({ entry, result: null, scale: null, ids: 'test', p: -1,
          progress: { enabled: false, subscribe: () => () => {} }, events: { on: () => () => {} } });
        document.body.replaceChildren(panel.element);
        const box = document.querySelector('.bv-info__credits');
        return { text: box.textContent, links: [...box.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]) };
      })()`);
      const good = await links(RAW.credits);
      assert.deepEqual(good.links, [
        ['qrafty (öffnet in neuem Tab)', 'https://modrinth.com/project/qraftyfied'],
        ['CC BY-NC 4.0 (öffnet in neuem Tab)', 'https://creativecommons.org/licenses/by-nc/4.0/'],
      ]);
      for (const bad of ['javascript:alert(1)', 'http://example.org/lizenz', 'data:text/html,x', '//example.org/x']) {
        const shown = await links({ ...RAW.credits, url: bad, licenseUrl: bad });
        assert.deepEqual(shown.links, [], bad);
        assert.match(shown.text, /^Von qrafty · Lizenz: CC BY-NC 4\.0$/, bad);
      }
      assert.deepEqual(page.errors.filter((e) => !/favicon\.ico/.test(e)), []);
    } finally {
      await page.close();
      await server.close();
    }
  });

  test('Lokaler Server liefert Community-Dateien als Binärdaten', async () => {
    const server = await startServer({ port: 0 });
    try {
      const response = await fetch(`${server.url}/tests/fixtures/create/import/house.nbt`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/octet-stream');
      assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
      assert.ok(Buffer.from(await response.arrayBuffer()).equals(readFileSync(fixture('house.nbt'))));
      for (const name of ['regions.litematic', 'house-v2.schem']) {
        assert.equal((await fetch(`${server.url}/tests/fixtures/create/import/${name}`)).headers.get('content-type'), 'application/octet-stream', name);
      }
    } finally {
      await server.close();
    }
  });

  test('Vorschaubild-Hash ändert sich mit der Datei des Community-Baus', async () => {
    const root = path.join(workDir, 'thumb-root');
    await mkdir(path.join(root, 'data', 'community'), { recursive: true });
    await copyFile(fixture('house.nbt'), path.join(root, 'data', 'community', 'qrafty-sphinx.nbt'));
    const base = await thumbHash(RAW, { stamp: '26.2|4903|x', root });
    assert.equal(await thumbHash(RAW, { stamp: '26.2|4903|x', root }), base);
    await copyFile(fixture('house-v2.schem'), path.join(root, 'data', 'community', 'qrafty-sphinx.nbt'));
    assert.notEqual(await thumbHash(RAW, { stamp: '26.2|4903|x', root }), base);
  });
});

describe('Echte Daten: data/community/', () => {
  const dir = path.join(ROOT, 'data', 'community');
  const list = JSON.parse(readFileSync(path.join(dir, 'builds.json'), 'utf8'));

  test('builds.json ist vollständig gültig: offene Lizenzen, Dateien vorhanden und unverändert, Grenzen eingehalten', async () => {
    const moduleIds = new Set(readdirSync(path.join(ROOT, 'js', 'builds'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'lib')
      .flatMap((d) => readdirSync(path.join(ROOT, 'js', 'builds', d.name)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3))));
    const { entries, errors, warnings } = await readCommunity({ dir, moduleIds });
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    assert.equal(entries.length, list.length);
    // 106 Bauten aus 11 Quellen (2026-10-28), dazu 55 aus 31 Quellen (2026-10-29)
    assert.ok(list.length >= 161, `${list.length} Community-Bauten`);
    let total = 0;
    for (const file of readdirSync(dir, { recursive: true })) {
      const info = statSync(path.join(dir, file));
      if (info.isFile()) total += info.size;
    }
    assert.ok(total <= COMMUNITY_MAX_TOTAL_BYTES, `${total} Bytes`);
    for (const item of list) {
      assert.ok(item.sha256 && item.licenseFile && item.sourcePath, `${item.id}: Prüfsumme, Lizenztext und Pfad in der Quelle`);
      assert.ok(OPEN_LICENSE_IDS.includes(item.license), item.id);
      const licenseText = readFileSync(path.join(dir, item.licenseFile), 'utf8');
      assert.ok(licenseText.includes(item.id), `${item.id}: im Lizenztext genannt`);
      assert.doesNotMatch(licenseText, /All Rights Reserved/i, `${item.id}: keine Einschränkung im Lizenztext`);
    }
    // Abgelehnt: Die .nbt-Dateien von Cinchs Villager Statues sind „All Rights Reserved“ (nicht von der MIT-Lizenz gedeckt)
    assert.equal(list.some((item) => item.url.includes('cinchtail/')), false);
    // Abgelehnt nach der Prüfung (2026-10-28): umgefärbte Spielstrukturen bzw. Herkunft nicht belegt (Thun-bit, big-mod,
    // Muffin's Structures), Entwurf ohne Erlaubnis (Panda Temple), Ersteller will nur Modrinth (Snowy Ruins),
    // Mod-Blöcke fehlen (Valkyrien Pirates, Sohatuy), End-Haus aus End-City-Teilen
    const rejected = ['github.com/Thun-bit/', 'github.com/TextualMite9145/', 'github.com/codingpineappleMC/', 'github.com/JSJBDEV/',
      'modrinth.com/project/muffins-structures', 'modrinth.com/project/panda-temple', 'modrinth.com/project/sohatuys-medieval-structures'];
    for (const source of rejected) assert.equal(list.some((item) => item.url.includes(source)), false, source);
    assert.equal(list.some((item) => item.id === 'complementary-end-haus'), false);
    // Keine Standard-Bauten: Neugestaltungen von Spielstrukturen (Wüsten- und Dschungelpyramide, Iglu) sind ebenfalls raus
    for (const id of ['complementary-grosse-wuestenpyramide', 'complementary-dschungelpyramide', 'qrafty-iglu-dorf']) {
      assert.equal(list.some((item) => item.id === id), false, id);
    }
    assert.equal(list.some((item) => /pyramide|iglu|igloo|shipwreck|schiffswrack|pillager|pl(ü|ue)nderer|hexenh(ü|ue)tte|witch_hut|monument|bastion|ancient_city|trial_chamber|ruined_portal/i.test(`${item.id} ${item.title} ${item.sourcePath}`)), false,
      'Name oder Quelle verweist auf eine Spielstruktur');
  });

  test('Nur Blöcke aus Minecraft 26.2 (keine aus Mods) und höchstens 3 Mio. Blöcke je Datei', { skip: NO_DATA }, async () => {
    await loadCheckData(DATA_DIR);
    const { entries } = await readCommunity({ dir });
    assert.equal(entries.length, list.length);
    for (const item of entries) {
      const imported = await uploader.importFile({ format: item.format, name: item.file, data: item.bytes });
      assert.deepEqual(imported.stats.dropped, [], `${item.id}: ${imported.warnings.join(' ')}`);
      assert.ok(imported.blockCount <= COMMUNITY_MAX_BLOCKS, `${item.id}: ${imported.blockCount} Blöcke`);
    }
  });

  test('Jeder Community-Bau steht im Katalog, mit seiner Datei, Herkunft „original“ und Credits', () => {
    const catalog = JSON.parse(readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
    for (const item of list) {
      const built = catalog.builds.find((b) => b.id === item.id);
      assert.ok(built, `${item.id} fehlt im Katalog`);
      assert.deepEqual(built.community, { file: item.file, format: item.format });
      assert.equal(built.accuracy, 'original');
      assert.equal(built.category, item.category);
      assert.equal(built.credits.author, item.author);
      assert.equal(built.credits.url, item.url);
      assert.equal(built.credits.licenseUrl, item.licenseUrl);
      assert.equal(built.credits.license, licenseLabel(item.license));
    }
    const communityInCatalog = catalog.builds.filter((b) => b.community);
    assert.equal(communityInCatalog.length, list.length);
    for (const category of ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'infrastruktur']) {
      assert.ok(communityInCatalog.some((b) => b.category === category), `${category}: mindestens ein Community-Bau`);
    }
  });
});
