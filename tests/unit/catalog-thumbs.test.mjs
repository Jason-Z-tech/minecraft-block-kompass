// Tests für scripts/make-thumbs.mjs und die Kamera der Render-Seite tests/visual/thumb.js.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArgs, jobFor, webpSize, moduleSources, thumbHash, dataStamp, makeThumbs, indexText, totalThumbBytes, loadViews, removeTempFiles, UsageError,
  THUMB_SIZE, THUMB_STYLE, INDEX_VERSION, DEFAULT_OUT_DIR, DEFAULT_VIEWS_FILE, TEMP_FILE_PATTERN,
} from '../../scripts/make-thumbs.mjs';
import { THUMBS_INDEX_VERSION } from '../../js/ui/data.js';
import { thumbAngles, thumbOrbit, validateJob, validateView, sideScores, pickYaw, yawCandidates } from '../visual/thumb.js';
import { BlockVolume } from '../../js/core/volume.js';
import { fitOrbitDistance, sceneBounds } from '../../js/render/renderer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const NO_DATA = existsSync(path.join(DATA_DIR, 'meta.json')) && existsSync(path.join(DATA_DIR, 'models.json'))
  ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)';

let workDir;
before(async () => {
  await mkdir(path.join(ROOT, 'tmp', 'catalog-tests'), { recursive: true });
  workDir = await mkdtemp(path.join(ROOT, 'tmp', 'catalog-tests', 'thumbs-'));
});
after(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

const entry = (over = {}) => ({
  id: 'example-house', title: 'Beispielhaus', category: 'haeuser', module: 'tests/fixtures/core/example-house.js', defaultScale: null, thumb: null, ...over,
});
// Zweiter Eintrag für die Browser-Tests: dasselbe kleine Beispielhaus unter anderer ID (schnell zu rendern)
const twin = (over = {}) => entry({ id: 'zweites-haus', title: 'Zweites Haus', ...over });

describe('Helfer', () => {
  test('parseArgs', () => {
    const o = parseArgs(['--force', '--only', 'zweites-haus', '--only', 'example-house', '--gpu', 'swiftshader', '--prune']);
    assert.deepEqual(o.only, ['zweites-haus', 'example-house']);
    assert.ok(o.force && o.prune);
    assert.equal(o.gpu, 'swiftshader');
    assert.throws(() => parseArgs(['--only', '../x']), UsageError);
    assert.throws(() => parseArgs(['--gpu', 'cpu']), UsageError);
    assert.throws(() => parseArgs(['--was']), UsageError);
    assert.equal(o.viewsFile, DEFAULT_VIEWS_FILE, 'Kamera-Einstellungen: Standard data/thumbs/views.json');
    assert.equal(DEFAULT_VIEWS_FILE, path.join(ROOT, 'data', 'thumbs', 'views.json'));
    assert.equal(parseArgs(['--views', 'x/v.json']).viewsFile, path.resolve('x/v.json'));
    assert.throws(() => parseArgs(['--views']), UsageError);
  });

  test('Standardordner data/thumbs (im Repo), index.json nach ID sortiert mit Stil, Größe und Spieldaten-Stand', async () => {
    assert.equal(DEFAULT_OUT_DIR, path.join(ROOT, 'data', 'thumbs'));
    assert.equal(parseArgs([]).outDir, DEFAULT_OUT_DIR);
    const parsed = JSON.parse(indexText({ version: INDEX_VERSION, entries: { zebra: { hash: '2' }, ahorn: { hash: '1' } } }, '26.2|1|2'));
    assert.deepEqual(parsed, { version: INDEX_VERSION, style: THUMB_STYLE, size: [...THUMB_SIZE], data: '26.2|1|2', entries: { ahorn: { hash: '1' }, zebra: { hash: '2' } } });
    assert.deepEqual(Object.keys(parsed.entries), ['ahorn', 'zebra']);
    const dir = path.join(workDir, 'groesse');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'a.webp'), Buffer.alloc(300));
    await writeFile(path.join(dir, 'b.webp'), Buffer.alloc(200));
    await writeFile(path.join(dir, 'index.json'), '{}');
    assert.equal(await totalThumbBytes(dir), 500, 'nur die Bilder zählen');
  });

  test('jobFor prüft Pfade, validateJob ebenso auf der Seite', () => {
    assert.deepEqual(jobFor(entry()), { source: { kind: 'module', path: 'tests/fixtures/core/example-house.js' }, scale: null });
    assert.deepEqual(jobFor(entry({ module: 'js/builds/haeuser/a-b.js', defaultScale: 0.5 })), { source: { kind: 'module', path: 'js/builds/haeuser/a-b.js' }, scale: 0.5 });
    assert.throws(() => jobFor(entry({ module: 'https://x.y/a.js' })), /ungültiger Modulpfad/);
    // Original-Strukturen gibt es nicht mehr: ein Eintrag ohne Bau-Modul und ohne Community-Datei (auch mit altem Feld
    // structure) ist ein Fehler
    assert.throws(() => jobFor(entry({ module: null })), /weder Bau-Modul noch Community-Bau/);
    assert.throws(() => jobFor(entry({ module: null, structure: 'igloo__top.json' })), /weder Bau-Modul noch Community-Bau/);
    // Community-Bau: nur ein Dateiname aus data/community/, ohne Maßstab
    assert.deepEqual(jobFor(entry({ module: null, community: { file: 'qrafty-teehaus.nbt', format: 'nbt' } })), { source: { kind: 'community', file: 'qrafty-teehaus.nbt' }, scale: null });
    assert.throws(() => jobFor(entry({ module: null, community: { file: '../game-data/blocks.json' } })), /ungültiger Community-Bau/);
    assert.deepEqual(validateJob({ source: { kind: 'community', file: 'a-b.litematic', extra: 1 } }), { source: { kind: 'community', file: 'a-b.litematic' }, scale: null, view: null });
    assert.throws(() => validateJob({ source: { kind: 'community', file: 'a/b.nbt' } }), /Ungültiger Community-Bau/);
    assert.throws(() => validateJob({ source: { kind: 'community', file: 'ab.nbt' }, scale: 0.5 }), /keinen Maßstab/);
    assert.throws(() => validateJob({ source: { kind: 'module', path: '/etc/passwd.js' } }), /Ungültiger Modulpfad/);
    assert.throws(() => validateJob({ source: { kind: 'shape' } }), /Quelle/);
    assert.throws(() => validateJob({ source: { kind: 'structure', file: 'igloo__top.json' } }), /Quelle/);
    assert.throws(() => validateJob({ source: { kind: 'module', path: 'js/builds/haeuser/a.js' }, scale: -1 }), /Maßstab/);
    assert.deepEqual(validateJob({ source: { kind: 'module', path: 'js/builds/haeuser/a.js', extra: 1 } }), { source: { kind: 'module', path: 'js/builds/haeuser/a.js' }, scale: null, view: null });
    // Kamera-Einstellung je Bau: jobFor gibt sie mit, die Seite prüft sie noch einmal
    const view = validateView({ pitch: 60, cut: { maxY: 12 } });
    assert.deepEqual(jobFor(entry(), view), { source: { kind: 'module', path: 'tests/fixtures/core/example-house.js' }, scale: null, view });
    assert.deepEqual(jobFor(entry({ module: null, community: { file: 'qrafty-teehaus.nbt' } }), view).view, view);
    assert.deepEqual(validateJob(jobFor(entry(), view)).view, view);
    assert.throws(() => validateJob({ source: { kind: 'module', path: 'js/builds/haeuser/a.js' }, view: { pitch: 120 } }), /pitch/);
  });

  test('validateView: bekannte Felder, gültige Werte, feste Reihenfolge (für den Hash)', () => {
    assert.deepEqual(validateView({ cut: { maxY: 12 }, target: [null, 5, 2.5], zoom: 1.2, pitch: 60, yaw: -30 }),
      { yaw: 330, pitch: 60, zoom: 1.2, target: [null, 5, 2.5], cut: { maxY: 12 } });
    assert.equal(JSON.stringify(validateView({ cut: { maxY: 3, minY: 1 }, yaw: 370 })), '{"yaw":10,"cut":{"minY":1,"maxY":3}}');
    assert.deepEqual(validateView({ pitch: -10 }), { pitch: -10 }, 'leicht von unten');
    for (const [bad, pattern] of [
      [null, /Objekt/], [[], /Objekt/], ['yaw', /Objekt/], [{}, /ohne Feld/], [{ fov: 30 }, /Unbekanntes Feld fov/],
      [{ yaw: '10' }, /yaw/], [{ yaw: Infinity }, /yaw/], [{ pitch: 95 }, /pitch/], [{ pitch: NaN }, /pitch/],
      [{ zoom: 0 }, /zoom/], [{ zoom: 20 }, /zoom/], [{ target: [1, 2] }, /target/], [{ target: [null, null, null] }, /target/],
      [{ target: [1, '2', 3] }, /target/], [{ cut: {} }, /cut: .*mindestens ein Feld/], [{ cut: { maxY: 1.5 } }, /cut: maxY/],
      [{ cut: { minY: 5, maxY: 2 } }, /cut: .*minY darf nicht größer/], [{ cut: { top: 3 } }, /cut: Unbekanntes Feld/],
    ]) assert.throws(() => validateView(bad), pattern, JSON.stringify(bad));
  });

  test('loadViews: ohne Datei {}, sonst geprüft; Fehler nennen Datei und ID', async () => {
    const dir = path.join(workDir, 'views');
    await mkdir(dir, { recursive: true });
    assert.deepEqual(await loadViews(path.join(dir, 'gibt-es-nicht.json')), {});
    const file = path.join(dir, 'views.json');
    await writeFile(file, JSON.stringify({ 'example-house': { zoom: 1.5, yaw: 400 }, 'zweites-haus': { cut: { maxY: 2 } } }));
    assert.deepEqual(await loadViews(file), { 'example-house': { yaw: 40, zoom: 1.5 }, 'zweites-haus': { cut: { maxY: 2 } } });
    for (const [text, pattern] of [
      ['{ kaputt', /kein gültiges JSON/], ['[]', /muss ein Objekt/], ['null', /muss ein Objekt/],
      ['{"../x": { "zoom": 2 }}', /ungültige ID/], ['{"example-house": { "zoom": 99 }}', /example-house: zoom/],
    ]) {
      await writeFile(file, text);
      await assert.rejects(loadViews(file), (error) => pattern.test(error.message) && error.message.includes(file), text);
    }
  });

  test('webpSize liest VP8, VP8L und VP8X und lehnt anderes ab', () => {
    const head = (chunk, body) => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from(chunk), Buffer.alloc(4), body]);
    const vp8x = Buffer.alloc(14);
    vp8x.writeUIntLE(639, 4, 3);
    vp8x.writeUIntLE(399, 7, 3);
    assert.deepEqual(webpSize(head('VP8X', vp8x)), [640, 400]);
    const vp8l = Buffer.alloc(14);
    vp8l[0] = 0x2f;
    vp8l.writeUInt32LE((639 & 0x3fff) | ((399 & 0x3fff) << 14), 1);
    assert.deepEqual(webpSize(head('VP8L', vp8l)), [640, 400]);
    const vp8 = Buffer.alloc(14);
    vp8.writeUInt16LE(640, 6);
    vp8.writeUInt16LE(400, 8);
    assert.deepEqual(webpSize(head('VP8 ', vp8)), [640, 400]);
    assert.throws(() => webpSize(Buffer.from('\x89PNG\r\n\x1a\n'.padEnd(40, '\0'))), /kein WebP/);
  });

  test('moduleSources folgt relativen Importen rekursiv, thumbHash reagiert auf Quelltext und Eintrag', async () => {
    const dir = path.join(workDir, 'js', 'builds');
    await mkdir(path.join(dir, 'haeuser'), { recursive: true });
    await mkdir(path.join(dir, 'lib'), { recursive: true });
    await writeFile(path.join(dir, 'haeuser', 'haus.js'), "import { a } from '../lib/a.js';\nexport { b } from \"../lib/b.js\";\nimport { setBlockData } from 'node:fs';\nexport default () => a;");
    await writeFile(path.join(dir, 'lib', 'a.js'), "import '../lib/b.js';\nexport const a = 1;");
    await writeFile(path.join(dir, 'lib', 'b.js'), 'export const b = 2;');
    const sources = await moduleSources(path.join(dir, 'haeuser', 'haus.js'), { root: workDir });
    assert.deepEqual(sources.map((s) => s.file), ['js/builds/haeuser/haus.js', 'js/builds/lib/a.js', 'js/builds/lib/b.js']);

    const mod = entry({ id: 'haus', module: 'js/builds/haeuser/haus.js' });
    const base = await thumbHash(mod, { stamp: 's1', root: workDir });
    assert.equal(await thumbHash({ ...mod, thumb: 'thumbs/haus.webp' }, { stamp: 's1', root: workDir }), base, 'thumb zählt nicht');
    assert.notEqual(await thumbHash({ ...mod, title: 'Anders' }, { stamp: 's1', root: workDir }), base, 'Eintrag');
    assert.notEqual(await thumbHash(mod, { stamp: 's2', root: workDir }), base, 'Spieldaten-Version');
    await writeFile(path.join(dir, 'lib', 'b.js'), 'export const b = 3;');
    const changed = await thumbHash(mod, { stamp: 's1', root: workDir });
    assert.notEqual(changed, base, 'importierte Datei');

    // Kamera-Einstellung: nur die des Eintrags zählt; gleiche Einstellung in anderer Schreibweise, gleicher Hash
    const views = { haus: validateView({ pitch: 60, cut: { maxY: 3 } }), anderes: validateView({ zoom: 2 }) };
    assert.equal(await thumbHash(mod, { stamp: 's1', root: workDir, views: { anderes: views.anderes } }), changed, 'Einstellung eines anderen Baus');
    const withView = await thumbHash(mod, { stamp: 's1', root: workDir, views });
    assert.notEqual(withView, changed, 'eigene Einstellung');
    assert.equal(await thumbHash(mod, { stamp: 's1', root: workDir, views: { haus: validateView({ cut: { maxY: 3 }, pitch: 60 }) } }), withView);
    assert.notEqual(await thumbHash(mod, { stamp: 's1', root: workDir, views: { haus: validateView({ pitch: 60, cut: { maxY: 4 } }) } }), withView, 'anderer Schnitt');
  });

  test('thumbHash: CRLF und LF geben denselben Hash (wie der Katalog-Fingerabdruck), Community-Dateien zählen mit ihren Bytes', async () => {
    const lf = path.join(workDir, 'lf');
    const crlf = path.join(workDir, 'crlf');
    const files = {
      'js/builds/haeuser/haus.js': "import { teil } from '../lib/teil.js';\n// Kommentar\nexport default function build(b) {\n  teil(b);\n}\n",
      'js/builds/lib/teil.js': 'export function teil(b) {\n  b.step();\n}\n',
    };
    for (const [dir, eol] of [[lf, '\n'], [crlf, '\r\n']]) {
      for (const [file, text] of Object.entries(files)) {
        await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
        await writeFile(path.join(dir, file), text.replace(/\n/g, eol));
      }
    }
    assert.match(await readFile(path.join(crlf, 'js/builds/lib/teil.js'), 'utf8'), /\r\n/, 'Probe hat wirklich CRLF');
    const mod = entry({ id: 'haus', module: 'js/builds/haeuser/haus.js' });
    const hashLf = await thumbHash(mod, { stamp: 's1', root: lf });
    assert.equal(await thumbHash(mod, { stamp: 's1', root: crlf }), hashLf, 'nur die Zeilenenden unterscheiden sich');
    // Andere Änderungen am Quelltext zählen weiter, auch ein einzelnes \r mitten in einer Zeile
    await writeFile(path.join(crlf, 'js/builds/lib/teil.js'), 'export function teil(b) {\r\n  b.step(); \r\n}\r\n');
    assert.notEqual(await thumbHash(mod, { stamp: 's1', root: crlf }), hashLf, 'geänderter Text');
    await writeFile(path.join(crlf, 'js/builds/lib/teil.js'), 'export function teil(b) {\r  b.step();\r}\r');
    assert.notEqual(await thumbHash(mod, { stamp: 's1', root: crlf }), hashLf, 'altes Mac-Zeilenende ist kein CRLF');

    // Community-Datei (binär): Bytes ohne Umwandlung – \r\n darin ist Inhalt
    const community = (bytes) => writeFile(path.join(lf, 'data', 'community', 'probe.nbt'), Buffer.from(bytes));
    await mkdir(path.join(lf, 'data', 'community'), { recursive: true });
    const nbt = entry({ id: 'probe', module: null, community: { file: 'probe.nbt', format: 'nbt' } });
    await community([0x0a, 0x0d, 0x0a, 0x00]);
    const binary = await thumbHash(nbt, { stamp: 's1', root: lf });
    await community([0x0a, 0x0a, 0x00]);
    assert.notEqual(await thumbHash(nbt, { stamp: 's1', root: lf }), binary, 'Community-Datei: jedes Byte zählt');
  });

  test('Zwischendateien eines abgebrochenen Laufs: jeder Lauf räumt sie weg, andere Dateien bleiben', async () => {
    const outDir = path.join(workDir, 'out-temp');
    const dataDir = path.join(workDir, 'data-temp');
    await mkdir(outDir, { recursive: true });
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'meta.json'), JSON.stringify({ version: '26.2' }));
    // Namen wie von writeBinaryAtomic (<id>.webp.<pid>-<zeit>.tmp) und writeFileAtomic (index.json.<pid>-<zeit>-<zufall>.tmp)
    const temp = ['atomium.webp.1234-mh2k9x1a.tmp', 'index.json.1234-mh2k9x1b-x1y2z3.tmp'];
    const keep = ['notiz.tmp', 'atomium.webp', 'views.json', 'index.json.bak'];
    for (const name of [...temp, ...keep]) await writeFile(path.join(outDir, name), 'x');
    assert.ok(temp.every((name) => TEMP_FILE_PATTERN.test(name)) && !keep.some((name) => TEMP_FILE_PATTERN.test(name)));
    const viewsFile = path.join(workDir, 'views-temp.json');
    // Ohne Katalog-Einträge rendert nichts (kein Browser nötig); --prune löscht danach das Bild ohne Eintrag
    const result = await makeThumbs({ catalog: { builds: [] }, outDir, dataDir, viewsFile, prune: true });
    assert.deepEqual(result.removedTemp, [...temp].sort());
    assert.deepEqual(result.errors, []);
    assert.deepEqual((await readdir(outDir)).sort(), ['index.json', 'index.json.bak', 'notiz.tmp', 'views.json'], 'nur eigene Zwischendateien und das verwaiste Bild sind weg');
    // Auch ohne --prune (der übliche Neustart nach einem Abbruch)
    await writeFile(path.join(outDir, temp[0]), 'x');
    const again = await makeThumbs({ catalog: { builds: [] }, outDir, dataDir, viewsFile });
    assert.deepEqual(again.removedTemp, [temp[0]]);
    assert.deepEqual(await removeTempFiles(outDir), [], 'nichts mehr übrig');
  });

  test('index.json: make-thumbs schreibt die Version, die die Seite liest', () => {
    assert.equal(INDEX_VERSION, THUMBS_INDEX_VERSION);
  });

  test('Kamera: lange Bauten von der Längsseite, hohe flacher, die Box füllt das Bild', () => {
    const box = (w, h, l) => sceneBounds({ min: [0, 0, 0], max: [w - 1, h - 1, l - 1] });
    assert.deepEqual(thumbAngles(box(10, 8, 10)), { yaw: 35, pitch: 28 });
    assert.equal(thumbAngles(box(30, 8, 9)).yaw, 22);
    assert.equal(thumbAngles(box(9, 8, 30)).yaw, 68);
    assert.equal(thumbAngles(box(10, 40, 10)).pitch, 12);
    assert.equal(thumbAngles(box(40, 3, 40)).pitch, 42);
    assert.deepEqual(thumbAngles(box(42, 35, 217)), { yaw: 80, pitch: 22 }, 'sehr lang und flach: von der Seite');
    assert.deepEqual(thumbAngles(box(200, 5, 30)), { yaw: 10, pitch: 22 });
    const aspect = THUMB_SIZE[0] / THUMB_SIZE[1];
    // Eigene Einstellung (views.json): yaw/pitch ersetzen die Automatik, auch die Seitenwahl
    const north = { north: 100, east: 0, south: 0, west: 0 };
    assert.ok(Math.cos(thumbAngles(box(10, 8, 10), north).yaw * Math.PI / 180) < 0, 'ohne Einstellung: Seitenwahl dreht nach Norden');
    assert.deepEqual(thumbAngles(box(10, 8, 10), north, validateView({ yaw: 20 })), { yaw: 20, pitch: 28 });
    assert.deepEqual(thumbAngles(box(10, 40, 10), null, validateView({ pitch: 30 })), { yaw: 35, pitch: 30 });
    const tall = box(60, 640, 60);
    const auto = thumbOrbit(tall, aspect);
    const zoomed = thumbOrbit(tall, aspect, { view: validateView({ zoom: 2, target: [null, 400, null] }) });
    assert.ok(Math.abs(zoomed.distance - auto.distance / 2) < 1e-9, 'zoom 2: halber Abstand');
    assert.deepEqual(zoomed.target, [auto.target[0], 400, auto.target[2]], 'target: nur die gesetzte Achse');
    assert.deepEqual([zoomed.yaw, zoomed.pitch], [auto.yaw, auto.pitch]);
    const turned = thumbOrbit(tall, aspect, { view: validateView({ yaw: 180, pitch: 8, target: [30, 380, 30] }) });
    assert.deepEqual(turned.target, [30, 380, 30]);
    assert.ok(Math.abs(turned.yaw - Math.PI) < 1e-12 && Math.abs(turned.pitch - 8 * Math.PI / 180) < 1e-12);
    assert.ok(Math.abs(turned.distance - fitOrbitDistance(tall, turned.yaw, turned.pitch, 45 * Math.PI / 180, aspect, 0.07, thumbOrbit(tall, aspect, { view: validateView({ yaw: 180, pitch: 8 }) }).target)) < 1e-6 * turned.distance, 'Abstand wie ohne target eingepasst');
    for (const b of [box(7, 7, 7), box(9, 21, 28), box(21, 37, 22), box(60, 640, 60), box(200, 5, 30)]) {
      const orbit = thumbOrbit(b, aspect);
      // Passt mit 7 % Rand, aber nicht mit deutlich weniger Abstand
      const fit = fitOrbitDistance(b, orbit.yaw, orbit.pitch, 45 * Math.PI / 180, aspect, 0.07, orbit.target);
      assert.ok(Math.abs(fit - orbit.distance) < 1e-6 * fit + 1e-9, 'Abstand eingepasst');
      assert.ok(orbit.target.every(Number.isFinite) && orbit.distance > 0);
    }
  });
});

describe('Seitenwahl', () => {
  test('sideScores findet die abwechslungsreiche Seite, pickYaw dreht die Kamera dorthin', () => {
    const volume = new BlockVolume();
    // Wand 8 breit, 6 hoch, 2 tief: Nordseite (z = 0) mit Muster, Südseite (z = 1) nur Stein
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        volume.set(x, y, 0, (x + y) % 3 === 0 ? 'chiseled_tuff_bricks' : 'tuff_bricks');
        volume.set(x, y, 1, 'stone');
      }
    }
    const scores = sideScores(volume);
    assert.equal(scores.south, 0);
    assert.equal(scores.north, 16, '16 von 48 Feldern weichen vom häufigsten Block ab');
    assert.ok(scores.east > 0 && scores.west > 0, 'Stirnseiten zeigen beide Lagen');
    const yaw = pickYaw(35, scores);
    assert.ok(Math.cos(yaw * Math.PI / 180) < 0, `Kamera im Norden (yaw ${yaw})`);
    assert.equal(pickYaw(35, { north: 10, east: 10, south: 10, west: 10 }), 35, 'Gleichstand: Grundwinkel bleibt');
    assert.deepEqual(sideScores(new BlockVolume()), { north: 0, east: 0, south: 0, west: 0 });
    assert.deepEqual(yawCandidates(80), [80, 100, 260, 280], 'lange Bauten: nur Längsseiten');
    assert.equal(yawCandidates(35).length, 8);
  });

  test('sideScores rechnet bei großen Flächen mit Stichproben hoch', () => {
    const volume = new BlockVolume();
    for (let x = 0; x < 300; x++) for (let y = 0; y < 200; y++) volume.set(x, y, 0, x % 2 ? 'stone' : 'dirt');
    const scores = sideScores(volume, { maxColumns: 2000 });
    assert.ok(scores.north > 0 && scores.north <= 300 * 200);
  });
});

describe('Vorschaubilder im Browser', { skip: NO_DATA }, () => {
  test('rendert Bau-Module als WebP 640×400, zweiter Lauf überspringt, --force rendert neu', { timeout: 240_000 }, async () => {
    const outDir = path.join(workDir, 'out');
    const catalog = { builds: [twin(), entry()] };
    const lines = [];
    const first = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR, log: (l) => lines.push(l) });
    assert.deepEqual(first.errors, [], lines.join('\n'));
    assert.deepEqual(first.rendered.sort(), ['example-house', 'zweites-haus']);
    for (const id of first.rendered) {
      const buffer = await readFile(path.join(outDir, `${id}.webp`));
      assert.deepEqual(webpSize(buffer), [640, 400]);
      assert.ok(buffer.length > 3000, `${id}: Bild verdächtig klein (${buffer.length} Byte)`);
    }
    const index = JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf8'));
    assert.equal(index.version, THUMBS_INDEX_VERSION, 'Format, das die Seite liest');
    assert.deepEqual(Object.keys(index.entries), ['example-house', 'zweites-haus'], 'nach ID sortiert');
    const stamp = await dataStamp(DATA_DIR);
    assert.equal(index.data, stamp, 'Spieldaten-Stand der Hashes');
    assert.equal(index.entries['zweites-haus'].hash, await thumbHash(catalog.builds[0], { stamp }));

    const before = (await stat(path.join(outDir, 'zweites-haus.webp'))).mtimeMs;
    const second = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR });
    assert.deepEqual(second.rendered, []);
    assert.deepEqual(second.skipped.sort(), ['example-house', 'zweites-haus']);
    assert.equal((await stat(path.join(outDir, 'zweites-haus.webp'))).mtimeMs, before);

    const changed = { builds: [{ ...catalog.builds[0], title: 'Zweites Haus (neu)' }, catalog.builds[1]] };
    const third = await makeThumbs({ catalog: changed, outDir, dataDir: DATA_DIR, only: ['zweites-haus'] });
    assert.deepEqual(third.rendered, ['zweites-haus']);
    const forced = await makeThumbs({ catalog: changed, outDir, dataDir: DATA_DIR, force: true, only: ['example-house', 'gibt-es-nicht'] });
    assert.deepEqual(forced.rendered, ['example-house']);
    assert.ok(forced.errors.some((e) => /gibt-es-nicht: nicht im Katalog/.test(e)));

    await writeFile(path.join(outDir, 'alt.webp'), 'x');
    const orphaned = await makeThumbs({ catalog: changed, outDir, dataDir: DATA_DIR });
    assert.deepEqual(orphaned.orphans, ['alt.webp']);
    await makeThumbs({ catalog: changed, outDir, dataDir: DATA_DIR, prune: true });
    assert.ok(!existsSync(path.join(outDir, 'alt.webp')));

    // --prune löscht auch Bild und Listeneintrag eines Baus, der aus dem Katalog verschwunden ist
    const left = await makeThumbs({ catalog: { builds: [changed.builds[1]] }, outDir, dataDir: DATA_DIR, prune: true });
    assert.deepEqual(left.rendered, []);
    assert.ok(!existsSync(path.join(outDir, 'zweites-haus.webp')));
    assert.deepEqual(Object.keys(JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf8')).entries), ['example-house']);
  });

  test('Kamera-Einstellung (views.json) geht in den Hash ein; Schnitt entfernt Blöcke aus dem Bild', { timeout: 240_000 }, async () => {
    const outDir = path.join(workDir, 'out-views');
    const viewsFile = path.join(workDir, 'views-browser.json');
    const catalog = { builds: [twin()] };
    const file = path.join(outDir, 'zweites-haus.webp');
    const blocksIn = (lines) => Number(lines.join('\n').match(/zweites-haus · \d+ KB · ([\d.]+) Blöcke/)?.[1].replace(/\./g, ''));
    const plainLines = [];
    const plain = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR, viewsFile, log: (l) => plainLines.push(l) });
    assert.deepEqual(plain.errors, [], plainLines.join('\n'));
    assert.deepEqual(plain.rendered, ['zweites-haus'], 'ohne views.json: Automatik');
    const plainImage = await readFile(file);
    const all = blocksIn(plainLines);
    assert.ok(all > 10, plainLines.join('\n'));

    // Nur ein Schnitt (gleiche Kamera-Automatik): neu gerendert, weniger Blöcke, anderes Bild
    await writeFile(viewsFile, JSON.stringify({ 'zweites-haus': { cut: { maxY: 1 } }, 'example-house': { zoom: 2 } }));
    const cutLines = [];
    const cut = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR, viewsFile, log: (l) => cutLines.push(l) });
    assert.deepEqual(cut.errors, [], cutLines.join('\n'));
    assert.deepEqual(cut.rendered, ['zweites-haus']);
    const kept = blocksIn(cutLines);
    assert.ok(kept > 0 && kept < all, `Schnitt: ${kept} von ${all} Blöcken`);
    assert.notDeepEqual(await readFile(file), plainImage);
    const index = JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf8'));
    assert.equal(index.entries['zweites-haus'].hash, await thumbHash(twin(), { stamp: await dataStamp(DATA_DIR), views: await loadViews(viewsFile) }));
    const again = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR, viewsFile });
    assert.deepEqual([again.rendered, again.skipped], [[], ['zweites-haus']], 'unveränderte Einstellung: übersprungen');

    // Ungültige Einstellung: verständlicher Abbruch vor dem Rendern
    await writeFile(viewsFile, JSON.stringify({ 'zweites-haus': { zoom: 0 } }));
    await assert.rejects(makeThumbs({ catalog, outDir, dataDir: DATA_DIR, viewsFile }), /zweites-haus: zoom/);
  });

  test('Fehler eines Eintrags halten die anderen nicht auf', { timeout: 240_000 }, async () => {
    const outDir = path.join(workDir, 'out-error');
    const catalog = { builds: [entry({ id: 'kaputt', module: 'tests/fixtures/core/gibt-es-nicht.js' }), entry()] };
    const result = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR });
    assert.deepEqual(result.rendered, ['example-house']);
    assert.ok(result.errors.some((e) => /^kaputt: /.test(e)), result.errors.join('\n'));
    // Die Liste nennt nur, was wirklich gerendert wurde (sie wird nach jedem Bild gesichert)
    assert.deepEqual(Object.keys(JSON.parse(await readFile(path.join(outDir, 'index.json'), 'utf8')).entries), ['example-house']);
  });
});
