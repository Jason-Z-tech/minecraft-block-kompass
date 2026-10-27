// Tests für scripts/build-catalog.mjs: Katalog-Schema (ARCHITEKTUR §9), Fehlerfälle, atomisches Schreiben.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCatalog, parseArgs, sizeClass, defaultScaleOf, structureFileName, analyzeStructure, validateStructureDefinition,
  serializeCatalog, writeCatalog, writeCatalogIfChanged, countBuilds, findModules, main, UsageError, TOP_MATERIALS,
  codeFingerprint, dataFingerprint, DEFAULT_OUT,
} from '../../scripts/build-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const HAS_GAME_DATA = existsSync(path.join(DATA_DIR, 'structures', 'index.json')) && existsSync(path.join(DATA_DIR, 'blocks.json'));
const NO_DATA = HAS_GAME_DATA ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)';
const EXAMPLE_HOUSE = path.join(ROOT, 'tests', 'fixtures', 'core', 'example-house.js');
const CATEGORIES = ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'redstone', 'farmen', 'infrastruktur'];
const ACCURACIES = ['original', 'massstab', 'vorlage', 'nachempfunden', 'eigenes'];
const ENTRY_KEYS = ['id', 'title', 'category', 'subtitle', 'tags', 'aliases', 'accuracy', 'difficulty', 'description', 'facts', 'sources',
  'credits', 'tested', 'module', 'structure', 'scales', 'defaultScale', 'size', 'blocks', 'steps', 'phases', 'variants', 'topMaterials',
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

async function structuresFile(name, source) {
  const file = path.join(workDir, `${name}.js`);
  await writeFile(file, source);
  return file;
}

const DEFAULTS = `export const GAME_STRUCTURE_DEFAULTS = { accuracy: 'original', sources: [],
  credits: { author: 'Mojang Studios', url: 'https://www.minecraft.net/', license: 'Teil von Minecraft Java 26.2' }, tested: null };`;
const iglu = (id = 'spiel-test-iglu', structure = 'igloo/top') => `{ id: '${id}', structure: '${structure}', title: 'Test ${id}', subtitle: 'Untertitel',
  category: 'haeuser', difficulty: 1, tags: ['Schnee'], aliases: ['iglu'], description: 'Ein Iglu. Zum Testen.' }`;

/** Prüft einen Eintrag gegen das Katalog-Format aus ARCHITEKTUR §9. */
function assertEntrySchema(entry) {
  assert.deepEqual(Object.keys(entry).sort(), [...ENTRY_KEYS].sort(), `Felder von ${entry.id}`);
  assert.match(entry.id, /^[a-z0-9-]{2,80}$/);
  for (const key of ['title', 'subtitle', 'description']) assert.ok(typeof entry[key] === 'string' && entry[key].trim(), `${entry.id}.${key}`);
  assert.ok(CATEGORIES.includes(entry.category));
  assert.ok(ACCURACIES.includes(entry.accuracy));
  assert.ok(Number.isInteger(entry.difficulty) && entry.difficulty >= 1 && entry.difficulty <= 5);
  for (const key of ['tags', 'aliases', 'facts']) assert.ok(Array.isArray(entry[key]) && entry[key].every((v) => typeof v === 'string'));
  assert.ok(Array.isArray(entry.sources) && entry.sources.every((s) => Object.keys(s).sort().join() === 'title,url'));
  assert.ok(entry.credits === null || Object.keys(entry.credits).sort().join() === 'author,license,url');
  assert.ok(entry.tested === null || typeof entry.tested === 'boolean');
  assert.ok((entry.module === null) !== (entry.structure === null), 'genau eins von module/structure');
  if (entry.module) assert.match(entry.module, /\.js$/);
  if (entry.structure) {
    assert.match(entry.structure, /^[a-z0-9_]+\.json$/);
    assert.ok(entry.id.startsWith('spiel-'));
    assert.equal(entry.accuracy, 'original');
    assert.equal(entry.scales, null);
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
  assert.equal(entry.thumb, null, 'der Katalog kennt keine Vorschaubilder (die gibt es nur lokal)');
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

  test('defaultScaleOf und structureFileName', () => {
    assert.equal(defaultScaleOf([0.5, 1, 0.25]), 1);
    assert.equal(defaultScaleOf([0.5, 0.25]), 0.5);
    assert.equal(structureFileName('village/plains/houses/plains_small_house_1'), 'village__plains__houses__plains_small_house_1.json');
  });

  test('parseArgs: Standardwerte, Optionen und Fehler', () => {
    const o = parseArgs(['--modules-dir', 'x', '--no-structures', '--thumbs', '--force']);
    assert.equal(o.structuresFile, null);
    assert.equal(o.modulesDir, path.resolve('x'));
    assert.ok(o.thumbs && o.force);
    assert.equal(parseArgs([]).out, DEFAULT_OUT);
    assert.equal(DEFAULT_OUT, path.join(ROOT, 'data', 'catalog.json'), 'Standard-Ziel liegt im Repo, nicht unter game-data/');
    assert.throws(() => parseArgs(['--bla']), UsageError);
    assert.throws(() => parseArgs(['--force']), UsageError);
    assert.throws(() => parseArgs(['--out']), UsageError);
  });

  test('analyzeStructure: Begrenzung, Blöcke, belegte Ebenen, Material', () => {
    // 3×3×2: unten ein Stein in der Ecke, oben zwei Bretter; Luft dazwischen
    const data = { size: [3, 3, 2], palette: ['air', 'stone', 'oak_planks'], rle: [1, 1, 0, 5, 0, 6, 2, 2, 0, 4] };
    const a = analyzeStructure(data);
    assert.equal(a.blocks, 3);
    assert.equal(a.steps, 2, 'Ebene 0 und 2 belegt, Ebene 1 leer');
    assert.deepEqual(a.bounds, [2, 3, 1], 'x 0…1, y 0…2, z 0');
    assert.deepEqual(a.materials, [['oak_planks', 2], ['stone', 1]]);
    assert.throws(() => analyzeStructure({ ...data, rle: [1, 1] }), /Zellen/);
    assert.throws(() => analyzeStructure({ ...data, rle: [7, 18] }), /rle/);
    assert.throws(() => analyzeStructure({ ...data, palette: ['stone'] }), /palette/);
    assert.throws(() => analyzeStructure({ size: [1, 1, 1], palette: ['air'], rle: [0, 1] }), /keine Blöcke/);
  });

  test('validateStructureDefinition meldet fehlende und falsche Felder', () => {
    assert.deepEqual(validateStructureDefinition({ id: 'spiel-x', structure: 'igloo/top', title: 'T', subtitle: 'U', category: 'klein', difficulty: 2, tags: ['a'], aliases: ['b'], description: 'D.' }), []);
    const errors = validateStructureDefinition({ id: 'iglu', structure: '../x', title: '', category: 'burgen', difficulty: 9, tags: [], aliases: ['Groß'] });
    assert.ok(errors.length >= 7, errors.join('\n'));
  });

  test('findModules nimmt nur Kategorie-Ordner und überspringt lib/', async () => {
    const dir = await moduleDir('find', {
      'haeuser/a.js': 'export const meta = {};', 'lib/helper.js': '', 'entwurf/b.js': '', 'klein/readme.txt': '',
    });
    const { modules, notes } = await findModules(dir);
    assert.deepEqual(modules.map((m) => `${m.folder}/${m.fileId}`), ['haeuser/a']);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /entwurf.*keine Kategorie/);
    const missing = await findModules(path.join(dir, 'gibt-es-nicht'));
    assert.deepEqual(missing.modules, []);
  });
});

describe('Katalog mit Spieldaten', { skip: NO_DATA }, () => {
  test('Beispielhaus über --modules-dir plus Original-Strukturen: Schema stimmt', async () => {
    const dir = await moduleDir('ok', { 'haeuser/example-house.js': EXAMPLE_HOUSE });
    const file = await structuresFile('ok-structures', `${DEFAULTS}\nexport const GAME_STRUCTURES = [${iglu()}];`);
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, structuresFile: file, thumbsDir: path.join(workDir, 'keine-bilder') });
    assert.deepEqual(errors, []);
    assertCatalogSchema(catalog);
    assert.equal(catalog.counts.total, 2);
    const house = catalog.builds.find((b) => b.id === 'example-house');
    assert.equal(house.module, path.relative(ROOT, path.join(dir, 'haeuser', 'example-house.js')).split(path.sep).join('/'));
    assert.equal(house.structure, null);
    assert.equal(house.accuracy, 'eigenes');
    assert.ok(house.phases >= 2 && house.steps >= house.phases);
    const igloo = catalog.builds.find((b) => b.id === 'spiel-test-iglu');
    assert.equal(igloo.structure, 'igloo__top.json');
    assert.equal(igloo.phases, 1);
    assert.deepEqual(igloo.credits, { author: 'Mojang Studios', url: 'https://www.minecraft.net/', license: 'Teil von Minecraft Java 26.2' });
    assert.ok(igloo.facts.includes('Vorlage im Spiel: minecraft:igloo/top'));
    assert.equal(igloo.topMaterials[0][0], 'snow_block');
  });

  test('Kaputtes Modul: Fehler gesammelt, gute Einträge bleiben, Hinweis unter warnings', async () => {
    const dir = await moduleDir('broken', {
      'haeuser/example-house.js': EXAMPLE_HOUSE,
      'klein/kaputt-syntax.js': 'export const meta = { id: ;',
      'klein/kaputt-bau.js': `export const meta = { id: 'kaputt-bau', title: 'Kaputt', category: 'klein', subtitle: 'x', tags: ['a'], aliases: ['a'],
        accuracy: 'eigenes', difficulty: 1, description: 'Kaputt.', facts: [], sources: [], credits: null, tested: null };
        export default function build(b) { b.set(0, 0, 0, 'gibt_es_nicht_block'); }`,
    });
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, structuresFile: null, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['example-house']);
    assert.ok(errors.some((e) => /kaputt-syntax\.js: Modul lässt sich nicht laden/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /kaputt-bau\.js: .*(gibt_es_nicht_block|Bau fehlgeschlagen)/.test(e)), errors.join('\n'));
    assert.ok(catalog.warnings.some((w) => /kaputt-bau\.js: wegen Fehlern nicht im Katalog/.test(w)));
    assertCatalogSchema(catalog);
  });

  test('Modul im falschen Kategorie-Ordner und reservierte Vorsilbe spiel- sind Fehler', async () => {
    const source = (await readFile(EXAMPLE_HOUSE, 'utf8'));
    const dir = await moduleDir('wrong', {
      'klein/example-house.js': source,
      'haeuser/spiel-haus.js': source.replace("id: 'example-house'", "id: 'spiel-haus'"),
    });
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, structuresFile: null, thumbsDir: workDir });
    assert.equal(catalog.builds.length, 0);
    assert.ok(errors.some((e) => /passt nicht zum Ordner „klein“/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /Vorsilbe „spiel-“/.test(e)), errors.join('\n'));
  });

  test('Doppelte ID: alle Einträge mit der ID fallen weg', async () => {
    const source = await readFile(EXAMPLE_HOUSE, 'utf8');
    const dir = await moduleDir('dupe', {
      'haeuser/example-house.js': source,
      'klein/example-house.js': source.replace("category: 'haeuser'", "category: 'klein'"),
    });
    const file = await structuresFile('dupe-structures', `${DEFAULTS}\nexport const GAME_STRUCTURES = [${iglu('spiel-doppelt')}, ${iglu('spiel-doppelt', 'igloo/bottom')}, ${iglu('spiel-einzeln', 'end_city/ship')}];`);
    const { catalog, errors } = await buildCatalog({ modulesDir: dir, structuresFile: file, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['spiel-einzeln']);
    assert.ok(errors.some((e) => /Doppelte ID „example-house“/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /Doppelte ID „spiel-doppelt“/.test(e)), errors.join('\n'));
  });

  test('Fehlende Struktur: unbekannter Pfad, fehlende Datei, doppelte Vorlage', async () => {
    // Eigene Spieldaten-Kopie mit index.json, deren Datei fehlt
    const data = path.join(workDir, 'data-missing');
    await mkdir(path.join(data, 'structures'), { recursive: true });
    for (const name of ['meta.json', 'blocks.json', 'names.json']) await copyFile(path.join(DATA_DIR, name), path.join(data, name));
    const index = JSON.parse(await readFile(path.join(DATA_DIR, 'structures', 'index.json'), 'utf8'));
    index.structures = index.structures.filter((s) => s.path === 'igloo/top' || s.path === 'igloo/bottom');
    await writeFile(path.join(data, 'structures', 'index.json'), JSON.stringify(index));
    await copyFile(path.join(DATA_DIR, 'structures', 'igloo__top.json'), path.join(data, 'structures', 'igloo__top.json'));
    const file = await structuresFile('missing-structures', `${DEFAULTS}\nexport const GAME_STRUCTURES = [
      ${iglu('spiel-gut')}, ${iglu('spiel-ohne-datei', 'igloo/bottom')}, ${iglu('spiel-unbekannt', 'village/gibt_es_nicht')}, ${iglu('spiel-nochmal')}];`);
    const { catalog, errors } = await buildCatalog({ modulesDir: path.join(workDir, 'leer'), structuresFile: file, dataDir: data, thumbsDir: workDir });
    assert.deepEqual(catalog.builds.map((b) => b.id), ['spiel-gut']);
    assert.ok(errors.some((e) => /spiel-ohne-datei: die Datei game-data\/structures\/igloo__bottom\.json fehlt/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /spiel-unbekannt: die Struktur village\/gibt_es_nicht gibt es nicht/.test(e)), errors.join('\n'));
    assert.ok(errors.some((e) => /spiel-nochmal: die Struktur igloo\/top ist schon als spiel-gut eingetragen/.test(e)), errors.join('\n'));
    assert.ok(catalog.warnings.some((w) => /3 von 4 wegen Fehlern nicht im Katalog/.test(w)));
  });

  test('Strukturliste ohne Standardwerte oder ohne GAME_STRUCTURES ist ein Fehler', async () => {
    const noDefaults = await structuresFile('no-defaults', `export const GAME_STRUCTURES = [${iglu()}];`);
    const a = await buildCatalog({ modulesDir: path.join(workDir, 'leer'), structuresFile: noDefaults, thumbsDir: workDir });
    assert.ok(a.errors.some((e) => /GAME_STRUCTURE_DEFAULTS fehlt/.test(e)));
    const noList = await structuresFile('no-list', DEFAULTS);
    const b = await buildCatalog({ modulesDir: path.join(workDir, 'leer'), structuresFile: noList, thumbsDir: workDir });
    assert.ok(b.errors.some((e) => /exportiert keine Liste GAME_STRUCTURES/.test(e)));
  });

  test('thumb bleibt im Katalog immer null, auch wenn lokal ein Bild existiert (der Katalog wird veröffentlicht)', async () => {
    const thumbs = path.join(workDir, 'thumbs-attach');
    await mkdir(thumbs, { recursive: true });
    await writeFile(path.join(thumbs, 'spiel-test-iglu.webp'), 'x');
    const file = await structuresFile('thumb-structures', `${DEFAULTS}\nexport const GAME_STRUCTURES = [${iglu()}, ${iglu('spiel-ohne-bild', 'igloo/bottom')}];`);
    const { catalog } = await buildCatalog({ modulesDir: path.join(workDir, 'leer'), structuresFile: file, thumbsDir: thumbs });
    assert.deepEqual(Object.fromEntries(catalog.builds.map((b) => [b.id, b.thumb])), { 'spiel-test-iglu': null, 'spiel-ohne-bild': null });
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
      code = await main(['--modules-dir', dir, '--no-structures', '--out', out, '--thumbs-dir', workDir]);
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
    assert.ok(logs.some((l) => /Laufzeit/.test(l)));
  });
});

test('Fingerabdruck: reagiert auf Modul, Hilfsdatei und Spieldaten, nicht auf Zeilenenden', async () => {
  const dir = path.join(workDir, 'fingerprint');
  await mkdir(path.join(dir, 'haeuser'), { recursive: true });
  await mkdir(path.join(dir, 'lib'), { recursive: true });
  await writeFile(path.join(dir, 'lib', 'hilfe.js'), 'export const wert = 1;\n');
  await writeFile(path.join(dir, 'haeuser', 'haus.js'), "import { wert } from '../lib/hilfe.js';\nexport const meta = { wert };\n");
  const base = await codeFingerprint({ modulesDir: dir, structuresFile: null });
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.equal(await codeFingerprint({ modulesDir: dir, structuresFile: null }), base, 'stabil');
  await writeFile(path.join(dir, 'haeuser', 'haus.js'), "import { wert } from '../lib/hilfe.js';\r\nexport const meta = { wert };\r\n");
  assert.equal(await codeFingerprint({ modulesDir: dir, structuresFile: null }), base, 'CRLF zählt nicht');
  await writeFile(path.join(dir, 'lib', 'hilfe.js'), 'export const wert = 2;\n');
  const helperChanged = await codeFingerprint({ modulesDir: dir, structuresFile: null });
  assert.notEqual(helperChanged, base, 'importierte Hilfsdatei zählt');
  await writeFile(path.join(dir, 'haeuser', 'zweites.js'), 'export const meta = {};\n');
  assert.notEqual(await codeFingerprint({ modulesDir: dir, structuresFile: null }), helperChanged, 'neues Modul zählt');

  const data = path.join(workDir, 'fingerprint-data');
  await mkdir(path.join(data, 'structures'), { recursive: true });
  await writeFile(path.join(data, 'meta.json'), JSON.stringify({ version: '26.2', worldVersion: 4903 }));
  await writeFile(path.join(data, 'blocks.json'), '{"a":1}');
  await writeFile(path.join(data, 'structures', 'index.json'), '{"structures":[]}');
  const dataBase = await dataFingerprint(data);
  await writeFile(path.join(data, 'blocks.json'), '{"a":2}');
  assert.notEqual(await dataFingerprint(data), dataBase, 'blocks.json zählt');
  await writeFile(path.join(data, 'blocks.json'), '{"a":1}');
  assert.equal(await dataFingerprint(data), dataBase);
  await writeFile(path.join(data, 'names.json'), '{"egal":true}');
  assert.equal(await dataFingerprint(data), dataBase, 'names.json zählt nicht (je nach Quelle leicht verschieden, für den Katalog egal)');
  await writeFile(path.join(data, 'structures', 'index.json'), '{"structures":[{"file":"a.json"}]}');
  assert.notEqual(await dataFingerprint(data), dataBase, 'structures/index.json zählt');
  await writeFile(path.join(data, 'structures', 'index.json'), '{"structures":[]}');
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
  const broken = await codeFingerprint({ modulesDir: dir, structuresFile: null });
  assert.match(broken, /^[0-9a-f]{64}$/);
  await writeFile(path.join(dir, 'haeuser', 'gibt-es-nicht.js'), 'export const x = 1;\n');
  assert.notEqual(await codeFingerprint({ modulesDir: dir, structuresFile: null }), broken);
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
