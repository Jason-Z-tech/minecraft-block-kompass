// Tests für scripts/build-catalog.mjs: Katalog-Schema (ARCHITEKTUR §9), Fehlerfälle, atomisches Schreiben.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as buildCatalogModule from '../../scripts/build-catalog.mjs';
import {
  buildCatalog, parseArgs, sizeClass, defaultScaleOf, serializeCatalog, writeCatalog, writeCatalogIfChanged, countBuilds, findModules,
  main, UsageError, TOP_MATERIALS, codeFingerprint, dataFingerprint, DEFAULT_OUT,
} from '../../scripts/build-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const HAS_GAME_DATA = existsSync(path.join(DATA_DIR, 'meta.json')) && existsSync(path.join(DATA_DIR, 'blocks.json'));
const NO_DATA = HAS_GAME_DATA ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)';
const EXAMPLE_HOUSE = path.join(ROOT, 'tests', 'fixtures', 'core', 'example-house.js');
const CATEGORIES = ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'infrastruktur'];
const ACCURACIES = ['original', 'massstab', 'vorlage', 'nachempfunden', 'eigenes'];
const ENTRY_KEYS = ['id', 'title', 'category', 'subtitle', 'tags', 'aliases', 'accuracy', 'description', 'sources',
  'credits', 'tested', 'module', 'community', 'scales', 'defaultScale', 'size', 'blocks', 'steps', 'phases', 'variants', 'topMaterials',
  'sizeClass', 'thumb'];

let workDir;
before(async () => {
  await mkdir(path.join(ROOT, 'tmp', 'catalog-tests'), { recursive: true });
  workDir = await mkdtemp(path.join(ROOT, 'tmp', 'catalog-tests', 'run-'));
});
after(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

async function moduleDir(name, files) {
  const dir = path.join(workDir, name);
  for (const [relative, source] of Object.entries(files)) {
    const file = path.join(dir, relative);
    await mkdir(path.dirname(file), { recursive: true });
    if (source === EXAMPLE_HOUSE) await copyFile(EXAMPLE_HOUSE, file);
    else await writeFile(file, source);
  }
  return dir;
}

// Beispielhaus mit anderer ID und anderem Titel (gleicher Bau)
const houseVariant = (source, id) => source.replace("id: 'example-house'", `id: '${id}'`).replace("title: 'Beispielhaus'", `title: '${id}'`);

/** Prüft einen Eintrag gegen das Katalog-Format aus ARCHITEKTUR §9. */
function assertEntrySchema(entry) {
  assert.deepEqual(Object.keys(entry).sort(), [...ENTRY_KEYS].sort(), `Felder von ${entry.id}`);
  assert.match(entry.id, /^[a-z0-9-]{2,80}$/);
  for (const key of ['title', 'subtitle']) assert.ok(typeof entry[key] === 'string' && entry[key].trim(), `${entry.id}.${key}`);
  // Bau-Module haben eine Beschreibung; Community-Bauten (Datei eines anderen Erstellers) keine erfundene
  if (entry.community) assert.equal(entry.description, '', `${entry.id}.description`);
  else assert.ok(typeof entry.description === 'string' && entry.description.trim(), `${entry.id}.description`);
  assert.ok(CATEGORIES.includes(entry.category));
  assert.ok(ACCURACIES.includes(entry.accuracy));
  assert.equal('difficulty' in entry, false, `${entry.id}: keine Schwierigkeit`);
  assert.equal('facts' in entry, false, `${entry.id}: kein Wissenswertes`);
  for (const key of ['tags', 'aliases']) assert.ok(Array.isArray(entry[key]) && entry[key].every((v) => typeof v === 'string'));
  assert.ok(Array.isArray(entry.sources) && entry.sources.every((s) => Object.keys(s).sort().join() === 'title,url'));
  assert.ok(entry.credits === null || Object.keys(entry.credits).sort().join() === 'author,license,licenseUrl,url');
  assert.ok(entry.tested === null || typeof entry.tested === 'boolean');
  assert.equal('structure' in entry, false, `${entry.id}: Original-Strukturen gibt es nicht mehr`);
  // Jeder Eintrag ist entweder ein Bau-Modul oder ein Community-Bau (Datei unter data/community/, Herkunft „original“)
  if (entry.community) {
    assert.equal(entry.module, null, `${entry.id}: Community-Bau ohne Modul`);
    assert.deepEqual(Object.keys(entry.community), ['file', 'format']);
    assert.match(entry.community.file, /^[a-z0-9-]{2,80}\.(nbt|schem|litematic)$/);
    assert.equal(entry.community.file, `${entry.id}.${entry.community.format}`);
    assert.equal(entry.accuracy, 'original');
    assert.ok(entry.credits && entry.credits.licenseUrl.startsWith('https://'), `${entry.id}: Ersteller, Link und Lizenz`);
    assert.deepEqual(entry.sources.map((s) => s.url), [entry.credits.url]);
  } else {
    assert.match(entry.module, /\.js$/, `${entry.id}: Bau-Modul`);
    assert.equal(entry.community, null, `${entry.id}: Bau-Modul ohne Community-Datei`);
  }
  assert.ok(entry.size.length === 3 && entry.size.every((v) => Number.isInteger(v) && v > 0));
  for (const key of ['blocks', 'steps', 'phases']) assert.ok(Number.isInteger(entry[key]) && entry[key] > 0, `${entry.id}.${key}`);
  if (entry.scales) {
    assert.ok(entry.scales.includes(entry.defaultScale));
    assert.deepEqual(Object.keys(entry.variants).sort(), entry.scales.map(String).sort());
    const main = entry.variants[String(entry.defaultScale)];
    assert.deepEqual([main.size, main.blocks, main.steps], [entry.size, entry.blocks, entry.steps]);
  } else {
    assert.equal(entry.defaultScale, null);
    assert.equal(entry.variants, null);
  }
  assert.ok(entry.topMaterials.length >= 1 && entry.topMaterials.length <= TOP_MATERIALS);
  for (let i = 1; i < entry.topMaterials.length; i++) assert.ok(entry.topMaterials[i - 1][1] >= entry.topMaterials[i][1], 'absteigend');
  assert.ok(entry.topMaterials.every(([item, n]) => /^[a-z0-9_]+$/.test(item) && Number.isInteger(n) && n > 0));
  assert.equal(entry.sizeClass, sizeClass(entry.blocks));
  assert.equal(entry.thumb, null, 'der Katalog kennt keine Bildpfade (die Seite liest data/thumbs/index.json)');
}

function assertCatalogSchema(catalog) {
  assert.deepEqual(Object.keys(catalog), ['generatedAt', 'version', 'inputs', 'counts', 'warnings', 'builds']);
  assert.ok(!Number.isNaN(Date.parse(catalog.generatedAt)));
  assert.equal(catalog.version, '26.2');
  assert.deepEqual(Object.keys(catalog.inputs), ['code', 'data']);
  assert.ok(/^[0-9a-f]{64}$/.test(catalog.inputs.code) && /^[0-9a-f]{64}$/.test(catalog.inputs.data), 'sha256 als Hex');
  assert.deepEqual(catalog.counts, countBuilds(catalog.builds));
  assert.deepEqual(Object.keys(catalog.counts.byCategory), CATEGORIES);
  assert.ok(Array.isArray(catalog.warnings) && catalog.warnings.every((w) => typeof w === 'string'));
  assert.equal(new Set(catalog.builds.map((b) => b.id)).size, catalog.builds.length, 'IDs eindeutig');
  for (const entry of catalog.builds) assertEntrySchema(entry);
}

describe('Hilfsfunktionen', () => {
  test('sizeClass: Grenzen 1 000 / 10 000 / 100 000', () => {
    assert.equal(sizeClass(0), 'klein');
    assert.equal(sizeClass(999), 'klein');
    assert.equal(sizeClass(1000), 'mittel');
    assert.equal(sizeClass(9999), 'mittel');
    assert.equal(sizeClass(10000), 'gross');
    assert.equal(sizeClass(99999), 'gross');
    assert.equal(sizeClass(100000), 'riesig');
    assert.throws(() => sizeClass(-1));
    assert.throws(() => sizeClass(1.5));
  });

  test('defaultScaleOf', () => {
    assert.equal(defaultScaleOf([0.5, 1, 0.25]), 1);
    assert.equal(defaultScaleOf([0.5, 0.25]), 0.5);
  });

  test('parseArgs: Standardwerte, Optionen und Fehler', () => {
    const o = parseArgs(['--modules-dir', 'x', '--thumbs', '--force']);
    assert.equal('structuresFile' in o, false, 'keine Strukturliste mehr');
    assert.equal(o.modulesDir, path.resolve('x'));
    assert.ok(o.thumbs && o.force);
    assert.equal(parseArgs([]).out, DEFAULT_OUT);
    assert.equal(DEFAULT_OUT, path.join(ROOT, 'data', 'catalog.json'), 'Standard-Ziel liegt im Repo, nicht unter game-data/');
    assert.throws(() => parseArgs(['--bla']), UsageError);
    assert.throws(() => parseArgs(['--force']), UsageError);
    assert.throws(() => parseArgs(['--out']), UsageError);
    // Original-Strukturen gibt es nicht mehr: die Optionen dafür auch nicht
    assert.throws(() => parseArgs(['--no-structures']), /Unbekannte Option --no-structures/);
    assert.throws(() => parseArgs(['--structures', 'liste.js']), /Unbekannte Option --structures/);
  });

  test('Keine Original-Strukturen mehr: nur Bau-Module, keine Struktur-Funktionen', () => {
    for (const name of ['catalogStructures', 'analyzeStructure', 'validateStructureDefinition', 'structureFileName', 'loadStructureDefinitions',
      'DEFAULT_STRUCTURES_FILE', 'STRUCTURE_ID_PREFIX']) {
      assert.equal(name in buildCatalogModule, false, name);
    }
    assert.equal(existsSync(path.join(ROOT, 'js', 'builds', 'game-structures.js')), false, 'Strukturliste gelöscht');
  });

  test('findModules nimmt nur Kategorie-Ordner und überspringt lib/', async () => {
    const dir = await moduleDir('find', {
      'haeuser/a.js': 'export const meta = {};', 'lib/helper.js': '', 'entwurf/b.js': '', 'klein/readme.txt': '', 'redstone/c.js': 'export const meta = {};',
      'farmen/kaktusfarm.js': 'export const meta = {};',
    });
    const { modules, notes } = await findModules(dir);
    assert.deepEqual(modules.map((m) => `${m.folder}/${m.fileId}`), ['haeuser/a']);
    assert.equal(notes.length, 3);
    assert.match(notes[0], /entwurf.*keine Kategorie/);
    assert.match(notes[1], /farmen.*keine Kategorie/, 'Farmen ist keine Kategorie mehr');
    assert.match(notes[2], /redstone.*keine Kategorie/, 'Redstone ist keine Kategorie mehr');
    assert.equal(existsSync(path.join(ROOT, 'js', 'builds', 'farmen')), false, 'Farm-Module gelöscht');
    const missing = await findModules(path.join(dir, 'gibt-es-nicht'));
    assert.deepEqual(missing.modules, []);
  });
});

describe('Katalog mit Spieldaten', { skip: NO_DATA }, () => {
  test('Beispielhaus über --modules-dir: Schema stimmt, nur Bau-Module (eine alte Strukturliste zählt nicht)', async () => {
    const dir = await moduleDir('ok', {
      'haeuser/example-house.js': EXAMPLE_HOUSE,
      // Eine liegen gebliebene Strukturliste wie früher js/builds/game-structures.js wird nicht mehr gelesen
      'game-structures.js': `export const GAME_STRUCTURE_DEFAULTS = { accuracy: 'original', sources: [], credits: null, tested: null };
        export const GAME_STRUCTURES = [{ id: 'spiel-test-iglu', structure: 'igloo/top', title: 'Iglu', subtitle: 'U', category: 'haeuser',
          tags: ['Schnee'], aliases: ['iglu'], description: 'Ein Iglu.' }];`,
    });
    const { catalog, errors, stats } = await buildCatalog({ modulesDir: dir, thumbsDir: path.join(workDir, 'keine-bilder') });
    assert.deepEqual(errors, []);
    assertCatalogSchema(catalog);
    assert.equal(catalog.counts.total, 1);
    assert.deepEqual(catalog.builds.map((b) => b.id), ['example-house']);
    assert.equal('structures' in stats, false);
    const house = catalog.builds[0];
    assert.equal(house.module, path.relative(ROOT, path.join(dir, 'haeuser', 'example-house.js')).split(path.sep).join('/'));
    assert.equal(house.accuracy, 'eigenes');
    assert.ok(house.phases >= 2 && house.steps >= house.phases);
    assert.equal('difficulty' in house || 'facts' in house, false, 'keine Schwierigkeit, kein Wissenswertes');
    assert.ok(house.description.startsWith('Ein kleines Haus'), 'Beschreibung bleibt');
  });

  test('Kaputtes Modul: Fehler gesammelt, gute Einträge bleiben, Hinweis unter warnings', async () => {
    const dir = await moduleDir('broken', {
      'haeuser/example-house.js': EXAMPLE_HOUSE,
      'klein/kaputt-syntax.js': 'export const meta = { id: ;',
      'klein/kaputt-bau.js': `export const meta = { id: 'kaputt-bau', title: 'Kaputt', category: 'klein', subtitle: 'x', tags: ['a'], aliases: ['a'],
        accuracy: 'eigenes', description: 'Kaputt.', sources: [], credits: null, tested: null };
        export default function build(b) { b.set(0, 0, 0, 'gibt_es_nicht_block'); }`,
    });
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['example-house']);
    assert.ok(errors.some((e) => /kaputt-syntax\.js: Modul lässt sich nicht laden/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /kaputt-bau\.js: .*(gibt_es_nicht_block|Bau fehlgeschlagen)/.test(e)), errors.join('\n'));
    assert.ok(catalog.warnings.some((w) => /kaputt-bau\.js: wegen Fehlern nicht im Katalog/.test(w)));
    assertCatalogSchema(catalog);
  });

  test('Modul mit meta.difficulty oder meta.facts kommt nicht in den Katalog', async () => {
    const source = await readFile(EXAMPLE_HOUSE, 'utf8');
    const variant = (id, extra) => source.replace("id: 'example-house',", `id: '${id}', ${extra},`).replace("title: 'Beispielhaus'", `title: '${id}'`);
    const dir = await moduleDir('alte-felder', {
      'haeuser/example-house.js': source,
      'haeuser/mit-schwierigkeit.js': variant('mit-schwierigkeit', 'difficulty: 2'),
      'haeuser/mit-wissen.js': variant('mit-wissen', "facts: ['Ein Satz']"),
    });
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['example-house']);
    assert.ok(errors.some((e) => /mit-schwierigkeit\.js: meta\.difficulty gibt es nicht mehr\./.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /mit-wissen\.js: meta\.facts gibt es nicht mehr\./.test(e)), errors.join('\n'));
    assertCatalogSchema(catalog);
  });

  test('Modul im falschen Kategorie-Ordner ist ein Fehler; die Vorsilbe spiel- ist nicht mehr reserviert', async () => {
    const source = (await readFile(EXAMPLE_HOUSE, 'utf8'));
    const dir = await moduleDir('wrong', {
      'klein/example-house.js': source,
      'haeuser/spiel-haus.js': houseVariant(source, 'spiel-haus'),
    });
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['spiel-haus']);
    assert.equal(errors.length, 1, errors.join('\n'));
    assert.match(errors[0], /passt nicht zum Ordner „klein“/);
  });

  test('Doppelte ID: alle Einträge mit der ID fallen weg', async () => {
    const source = await readFile(EXAMPLE_HOUSE, 'utf8');
    const dir = await moduleDir('dupe', {
      'haeuser/example-house.js': source,
      'klein/example-house.js': source.replace("category: 'haeuser'", "category: 'klein'"),
      'haeuser/einzeln.js': houseVariant(source, 'einzeln'),
    });
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['einzeln']);
    assert.ok(errors.some((e) => /Doppelte ID „example-house“/.test(e)), errors.join('\n'));
    assert.ok(catalog.warnings.some((w) => /example-house: doppelte ID – alle 2 Einträge wurden übersprungen/.test(w)), catalog.warnings.join('\n'));
  });

  test('thumb bleibt im Katalog immer null, auch wenn es ein Bild gibt (die Liste steht in data/thumbs/index.json)', async () => {
    const thumbs = path.join(workDir, 'thumbs-attach');
    await mkdir(thumbs, { recursive: true });
    await writeFile(path.join(thumbs, 'example-house.webp'), 'x');
    const source = await readFile(EXAMPLE_HOUSE, 'utf8');
    const dir = await moduleDir('thumb', { 'haeuser/example-house.js': source, 'haeuser/ohne-bild.js': houseVariant(source, 'ohne-bild') });
    const { catalog } = await buildCatalog({ modulesDir: dir, thumbsDir: thumbs });
    assert.deepEqual(Object.fromEntries(catalog.builds.map((b) => [b.id, b.thumb])), { 'example-house': null, 'ohne-bild': null });
  });

  test('main: schreibt atomar (keine Zwischendatei bleibt), Exit-Code 1 bei Fehlern, 2 bei falschen Optionen', async () => {
    const dir = await moduleDir('main', { 'haeuser/example-house.js': EXAMPLE_HOUSE, 'klein/kaputt.js': 'export const meta = { id: ;' });
    const outDir = path.join(workDir, 'main-out');
    const out = path.join(outDir, 'catalog.json');
    const logs = [];
    const original = { log: console.log, error: console.error };
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => logs.push(a.join(' '));
    let code, usage;
    try {
      code = await main(['--modules-dir', dir, '--out', out, '--thumbs-dir', workDir]);
      usage = await main(['--unbekannt']);
    } finally {
      Object.assign(console, original);
    }
    assert.equal(code, 1);
    assert.equal(usage, 2);
    const written = JSON.parse(await readFile(out, 'utf8'));
    assertCatalogSchema(written);
    assert.deepEqual(written.builds.map((b) => b.id), ['example-house']);
    assert.deepEqual((await readdir(outDir)).filter((n) => n.endsWith('.tmp')), []);
    assert.ok(logs.some((l) => /Häuser & Wohnen\s+1/.test(l)), logs.join('\n'));
    assert.ok(logs.some((l) => /^Kategorie\s+Bauten\s+Blöcke$/m.test(l)), 'Übersicht ohne Spalte für Original-Strukturen');
    assert.ok(logs.some((l) => /Laufzeit/.test(l)));
  });
});

test('Fingerabdruck: reagiert auf Modul, Hilfsdatei und Spieldaten, nicht auf Zeilenenden', async () => {
  const dir = path.join(workDir, 'fingerprint');
  await mkdir(path.join(dir, 'haeuser'), { recursive: true });
  await mkdir(path.join(dir, 'lib'), { recursive: true });
  await writeFile(path.join(dir, 'lib', 'hilfe.js'), 'export const wert = 1;\n');
  await writeFile(path.join(dir, 'haeuser', 'haus.js'), "import { wert } from '../lib/hilfe.js';\nexport const meta = { wert };\n");
  const base = await codeFingerprint({ modulesDir: dir });
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(await codeFingerprint({ modulesDir: dir }), base, 'stabil');
  await writeFile(path.join(dir, 'haeuser', 'haus.js'), "import { wert } from '../lib/hilfe.js';\r\nexport const meta = { wert };\r\n");
  assert.equal(await codeFingerprint({ modulesDir: dir }), base, 'CRLF zählt nicht');
  await writeFile(path.join(dir, 'lib', 'hilfe.js'), 'export const wert = 2;\n');
  const helperChanged = await codeFingerprint({ modulesDir: dir });
  assert.notEqual(helperChanged, base, 'importierte Hilfsdatei zählt');
  await writeFile(path.join(dir, 'haeuser', 'zweites.js'), 'export const meta = {};\n');
  assert.notEqual(await codeFingerprint({ modulesDir: dir }), helperChanged, 'neues Modul zählt');

  const data = path.join(workDir, 'fingerprint-data');
  await mkdir(data, { recursive: true });
  await writeFile(path.join(data, 'meta.json'), JSON.stringify({ version: '26.2', worldVersion: 4903 }));
  await writeFile(path.join(data, 'blocks.json'), '{"a":1}');
  const dataBase = await dataFingerprint(data);
  await writeFile(path.join(data, 'blocks.json'), '{"a":2}');
  assert.notEqual(await dataFingerprint(data), dataBase, 'blocks.json zählt');
  await writeFile(path.join(data, 'blocks.json'), '{"a":1}');
  assert.equal(await dataFingerprint(data), dataBase);
  await writeFile(path.join(data, 'names.json'), '{"egal":true}');
  assert.equal(await dataFingerprint(data), dataBase, 'names.json zählt nicht (je nach Quelle leicht verschieden, für den Katalog egal)');
  // Original-Strukturen gibt es nicht mehr: ein alter Ordner structures/ ändert den Katalog nicht
  await mkdir(path.join(data, 'structures'), { recursive: true });
  await writeFile(path.join(data, 'structures', 'index.json'), '{"structures":[{"file":"a.json"}]}');
  assert.equal(await dataFingerprint(data), dataBase, 'structures/index.json zählt nicht mehr');
  await writeFile(path.join(data, 'meta.json'), JSON.stringify({ version: '26.2', worldVersion: 4904, extractedAt: 'x' }));
  assert.notEqual(await dataFingerprint(data), dataBase, 'Datenversion zählt');
  await writeFile(path.join(data, 'meta.json'), JSON.stringify({ version: '26.2', worldVersion: 4903, extractedAt: 'andere Zeit', sources: { x: 1 } }));
  assert.equal(await dataFingerprint(data), dataBase, 'Zeit und Quellen in meta.json zählen nicht');
});

test('writeCatalogIfChanged: schreibt nur bei inhaltlicher Änderung (generatedAt allein zählt nicht)', async () => {
  const file = path.join(workDir, 'unchanged', 'catalog.json');
  const catalog = { generatedAt: '2026-10-27T00:00:00.000Z', version: '26.2', inputs: { code: 'a', data: 'b' }, counts: countBuilds([]), warnings: [], builds: [] };
  assert.equal(await writeCatalogIfChanged(file, catalog), true, 'neu');
  const before = await readFile(file, 'utf8');
  assert.equal(await writeCatalogIfChanged(file, { ...catalog, generatedAt: '2026-10-28T00:00:00.000Z' }), false, 'nur die Zeit anders');
  assert.equal(await readFile(file, 'utf8'), before);
  assert.equal(await writeCatalogIfChanged(file, { ...catalog, inputs: { code: 'c', data: 'b' } }), true, 'Fingerabdruck anders');
  assert.match(await readFile(file, 'utf8'), /"code": "c"/);
  await writeFile(file, '{ kaputt');
  assert.equal(await writeCatalogIfChanged(file, catalog), true, 'kaputte Datei wird ersetzt');
});

test('Fingerabdruck bricht bei kaputtem Import nicht ab und ändert sich, sobald das Modul repariert ist', async () => {
  const dir = path.join(workDir, 'fingerprint-broken');
  await mkdir(path.join(dir, 'haeuser'), { recursive: true });
  await writeFile(path.join(dir, 'haeuser', 'haus.js'), "import { x } from './gibt-es-nicht.js';\nexport const meta = { x };\n");
  const broken = await codeFingerprint({ modulesDir: dir });
  assert.match(broken, /^[0-9a-f]{64}$/);
  await writeFile(path.join(dir, 'haeuser', 'gibt-es-nicht.js'), 'export const x = 1;\n');
  assert.notEqual(await codeFingerprint({ modulesDir: dir }), broken);
});

test('parseArgs: mit eigenen Spieldaten (--data) landet der Katalog dort, nicht im Repo', () => {
  assert.equal(parseArgs(['--data', 'tmp/andere-daten']).out, path.join(path.resolve('tmp/andere-daten'), 'catalog.json'));
  assert.equal(parseArgs(['--data', 'tmp/andere-daten', '--out', 'tmp/k.json']).out, path.resolve('tmp/k.json'));
  assert.equal(parseArgs([]).out, DEFAULT_OUT);
});

test('serializeCatalog ergibt gültiges JSON mit einem Eintrag je Zeile', async () => {
  const catalog = { generatedAt: '2026-10-23T00:00:00.000Z', version: '26.2', counts: countBuilds([]), warnings: ['w'], builds: [] };
  assert.deepEqual(JSON.parse(serializeCatalog(catalog)), catalog);
  const withBuilds = { ...catalog, builds: [{ id: 'a', category: 'klein' }, { id: 'b', category: 'klein' }] };
  const text = serializeCatalog(withBuilds);
  assert.deepEqual(JSON.parse(text), withBuilds);
  assert.equal(text.split('\n').filter((l) => l.trim().startsWith('{"id"')).length, 2);
  const file = path.join(workDir, 'atomic', 'catalog.json');
  await writeCatalog(file, withBuilds);
  await writeCatalog(file, catalog);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), catalog);
  assert.deepEqual(await readdir(path.dirname(file)), ['catalog.json']);
});
