// Start-Skript: Spieldaten mit und ohne Minecraft-Installation (ohne echte Downloads, mit Fake-Läufen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGameData, findMinecraftJar, checkGameData, checkCatalog, ensureThumbs, parseStartArgs } from '../../scripts/start.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const JAR = 'C:/x/.minecraft/versions/26.2/26.2.jar';

/** Fake für run/check: Spieldaten sind da, sobald ein Lauf mit Exit-Code 0 durch ist, dessen Argumente passen. */
function fakeSetup({ works = () => true, present = false } = {}) {
  const runs = [];
  let ready = present;
  return {
    runs,
    log: [],
    run(script, args) {
      runs.push([script, args]);
      if (!works(args)) return 1;
      ready = true;
      return 0;
    },
    check: () => (ready ? [] : ['meta.json fehlt']),
  };
}

function ensure(setup, options) {
  return ensureGameData({ run: setup.run, check: setup.check, log: (line) => setup.log.push(line), ...options });
}

test('Spieldaten vorhanden: nichts erzeugen', () => {
  const setup = fakeSetup({ present: true });
  assert.equal(ensure(setup, { minecraftJar: () => JAR }), 'present');
  assert.deepEqual(setup.runs, []);
});

test('Ohne Minecraft-Installation: automatisch aus öffentlichen Quellen', () => {
  const setup = fakeSetup();
  assert.equal(ensure(setup, { minecraftJar: () => null }), 'remote');
  assert.deepEqual(setup.runs, [['scripts/extract-game-data.mjs', ['--remote']]]);
  assert.ok(setup.log.some((line) => /Keine Minecraft-Installation gefunden/.test(line)));
});

test('Mit Minecraft-Installation: daraus lesen; scheitert das, aus öffentlichen Quellen', () => {
  const local = fakeSetup();
  assert.equal(ensure(local, { minecraftJar: () => JAR }), 'local');
  assert.deepEqual(local.runs, [['scripts/extract-game-data.mjs', []]]);

  const broken = fakeSetup({ works: (args) => args.includes('--remote') });
  assert.equal(ensure(broken, { minecraftJar: () => JAR }), 'remote');
  assert.deepEqual(broken.runs, [['scripts/extract-game-data.mjs', []], ['scripts/extract-game-data.mjs', ['--remote']]]);
});

test('--remote: nie die Installation lesen', () => {
  const setup = fakeSetup();
  let asked = false;
  assert.equal(ensure(setup, { remote: true, minecraftJar: () => { asked = true; return JAR; } }), 'remote');
  assert.equal(asked, false);
  assert.deepEqual(setup.runs, [['scripts/extract-game-data.mjs', ['--remote']]]);
});

test('Geht beides nicht: klare Meldung mit Hinweis aufs Internet', () => {
  const setup = fakeSetup({ works: () => false });
  assert.throws(() => ensure(setup, { minecraftJar: () => null }), (error) => /konnten nicht erzeugt werden/.test(error.message)
    && /meta\.json fehlt/.test(error.message) && /Internet/.test(error.message));
  const exitOk = fakeSetup();
  assert.throws(() => ensureGameData({ run: () => 0, check: exitOk.check, log: () => {}, minecraftJar: () => null }), /Noch offen: meta\.json fehlt/,
    'Exit-Code 0 reicht nicht, die Dateien müssen da sein');
});

test('findMinecraftJar: nur eine echte Datei zählt', () => {
  const dir = path.join(ROOT, 'tmp', `start-test-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'ordner.jar'), { recursive: true });
  try {
    const jar = path.join(dir, '26.2.jar');
    assert.equal(findMinecraftJar(jar), null);
    fs.writeFileSync(jar, 'PK');
    assert.equal(findMinecraftJar(jar), jar);
    assert.equal(findMinecraftJar(path.join(dir, 'ordner.jar')), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkGameData und parseStartArgs', () => {
  const dir = path.join(ROOT, 'tmp', `start-test-data-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'structures'), { recursive: true });
  try {
    assert.ok(checkGameData(dir).includes('meta.json fehlt'));
    for (const file of ['blocks.json', 'names.json', 'models.json', 'textures.json', 'textures.bin', 'structures/index.json']) fs.writeFileSync(path.join(dir, file), '{}');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ version: '26.1' }));
    assert.deepEqual(checkGameData(dir), ['meta.json nennt Version 26.1 statt 26.2']);
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ version: '26.2' }));
    assert.deepEqual(checkGameData(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(parseStartArgs([]), { port: 8080, portGiven: false, remote: false, thumbs: true });
  assert.equal(parseStartArgs(['--remote']).remote, true);
  assert.throws(() => parseStartArgs(['--port', '80']), /Ungültiger Port/);
  assert.throws(() => parseStartArgs(['--minecraft']), /Unbekannte Option/);
});

test('checkCatalog: Fingerabdruck statt Dateizeiten, fehlende Module werden gemeldet', async () => {
  const dir = path.join(ROOT, 'tmp', `start-test-catalog-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'js', 'builds', 'haeuser'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'js', 'builds', 'haeuser', 'haus.js'), 'export const meta = {};');
  fs.writeFileSync(path.join(dir, 'js', 'builds', 'haeuser', 'turm.js'), 'export const meta = {};');
  const file = path.join(dir, 'catalog.json');
  const inputs = { code: 'c1', data: 'd1' };
  try {
    assert.deepEqual(await checkCatalog({ root: dir, catalogFile: file, inputs }), { fresh: false, reason: 'Der Katalog fehlt.', missing: [] });
    fs.writeFileSync(file, '{ kaputt');
    assert.match((await checkCatalog({ root: dir, catalogFile: file, inputs })).reason, /nicht lesbar/);
    fs.writeFileSync(file, JSON.stringify({ inputs, builds: {} }));
    assert.match((await checkCatalog({ root: dir, catalogFile: file, inputs })).reason, /unbekanntes Format/);
    const write = (catalogInputs) => fs.writeFileSync(file, JSON.stringify({ inputs: catalogInputs, builds: [{ id: 'haus', module: 'js/builds/haeuser/haus.js' }] }));
    write({ code: 'alt', data: 'd1' });
    const code = await checkCatalog({ root: dir, catalogFile: file, inputs });
    assert.equal(code.fresh, false);
    assert.match(code.reason, /Bau-Module oder Kern/);
    write({ code: 'c1', data: 'alt' });
    assert.match((await checkCatalog({ root: dir, catalogFile: file, inputs })).reason, /Spieldaten/);
    write(undefined);
    assert.match((await checkCatalog({ root: dir, catalogFile: file, inputs })).reason, /Bau-Module oder Kern und Spieldaten/, 'alter Katalog ohne Fingerabdruck');
    write(inputs);
    // Neuere Dateizeiten machen den Katalog nicht mehr „veraltet“ (z. B. nach git pull), nur der Inhalt zählt
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(dir, 'js', 'builds', 'haeuser', 'haus.js'), later, later);
    assert.deepEqual(await checkCatalog({ root: dir, catalogFile: file, inputs }), { fresh: true, reason: null, missing: ['js/builds/haeuser/turm.js'] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('ensureThumbs: mit Bildern make-thumbs, ohne eine leere thumbs/index.json (kein 404 auf der lokalen Seite)', () => {
  const dir = path.join(ROOT, 'tmp', `start-test-thumbs-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  try {
    const runs = [];
    assert.equal(ensureThumbs({ thumbs: true, thumbsDir: dir, run: (script, args) => { runs.push([script, args]); return 0; }, log: () => {} }), 'rendered');
    assert.deepEqual(runs, [['scripts/make-thumbs.mjs', []]]);
    const logs = [];
    assert.equal(ensureThumbs({ thumbs: true, thumbsDir: dir, run: () => 1, log: (line) => logs.push(line) }), 'failed');
    assert.match(logs.join(' '), /Kategorie-Icon/);
    assert.equal(fs.existsSync(dir), false, 'mit Bildern legt ensureThumbs selbst nichts an');
    assert.equal(ensureThumbs({ thumbs: false, thumbsDir: dir }), 'placeholder');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')), { version: 1, entries: {} });
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ version: 1, entries: { haus: {} } }));
    assert.equal(ensureThumbs({ thumbs: false, thumbsDir: dir }), 'present');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')).entries, { haus: {} }, 'vorhandene Liste bleibt');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
