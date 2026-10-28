// Tests für scripts/make-thumbs.mjs und die Kamera der Render-Seite tests/visual/thumb.js.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, jobFor, webpSize, moduleSources, thumbHash, dataStamp, makeThumbs, UsageError, THUMB_SIZE } from '../../scripts/make-thumbs.mjs';
import { thumbAngles, thumbOrbit, validateJob, sideScores, pickYaw, yawCandidates } from '../visual/thumb.js';
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
    assert.deepEqual(validateJob({ source: { kind: 'community', file: 'a-b.litematic', extra: 1 } }), { source: { kind: 'community', file: 'a-b.litematic' }, scale: null });
    assert.throws(() => validateJob({ source: { kind: 'community', file: 'a/b.nbt' } }), /Ungültiger Community-Bau/);
    assert.throws(() => validateJob({ source: { kind: 'community', file: 'ab.nbt' }, scale: 0.5 }), /keinen Maßstab/);
    assert.throws(() => validateJob({ source: { kind: 'module', path: '/etc/passwd.js' } }), /Ungültiger Modulpfad/);
    assert.throws(() => validateJob({ source: { kind: 'shape' } }), /Quelle/);
    assert.throws(() => validateJob({ source: { kind: 'structure', file: 'igloo__top.json' } }), /Quelle/);
    assert.throws(() => validateJob({ source: { kind: 'module', path: 'js/builds/haeuser/a.js' }, scale: -1 }), /Maßstab/);
    assert.deepEqual(validateJob({ source: { kind: 'module', path: 'js/builds/haeuser/a.js', extra: 1 } }), { source: { kind: 'module', path: 'js/builds/haeuser/a.js' }, scale: null });
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
    assert.notEqual(await thumbHash(mod, { stamp: 's1', root: workDir }), base, 'importierte Datei');
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
    assert.equal(index.version, 1);
    assert.deepEqual(Object.keys(index.entries).sort(), ['example-house', 'zweites-haus']);
    const stamp = await dataStamp(DATA_DIR);
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
  });

  test('Fehler eines Eintrags halten die anderen nicht auf', { timeout: 240_000 }, async () => {
    const outDir = path.join(workDir, 'out-error');
    const catalog = { builds: [entry({ id: 'kaputt', module: 'tests/fixtures/core/gibt-es-nicht.js' }), entry()] };
    const result = await makeThumbs({ catalog, outDir, dataDir: DATA_DIR });
    assert.deepEqual(result.rendered, ['example-house']);
    assert.ok(result.errors.some((e) => /^kaputt: /.test(e)), result.errors.join('\n'));
  });
});
