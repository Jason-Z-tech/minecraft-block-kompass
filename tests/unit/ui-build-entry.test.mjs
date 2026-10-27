// Bau-Seite: Katalog-Eintrag (entry.js), Fortschritt im localStorage (progress.js) und der Test-Katalog
// tests/fixtures/ui/catalog.json (Format aus dem Auftrag für Runde 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeBuildDetails, loadBuildEntry, resolveScale, progressKeyFor, sourceForEntry, variantFor, viewEntry, formatScale,
  scaleToken, isHttpsUrl, MODULE_PATH_PATTERN,
} from '../../js/ui/build/entry.js';
import { ProgressStore, parseStoredProgress, serializeProgress, formProgressKey, hashText } from '../../js/ui/build/progress.js';
import { normalizeCatalog } from '../../js/ui/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOG = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/ui/catalog.json'), 'utf8'));
const SITE = new URL('http://127.0.0.1:8080/');

function catalogFetch(body = CATALOG) {
  return async (url) => {
    if (String(url).endsWith('/data/catalog.json')) return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response('nicht da', { status: 404 });
  };
}

function memoryStorage() {
  const data = new Map();
  return {
    data,
    get: (key, fallback = null) => (data.has(key) ? structuredClone(data.get(key)) : fallback),
    set: (key, value) => { data.set(key, structuredClone(value)); return true; },
    remove: (key) => data.delete(key),
  };
}

test('Test-Katalog hat das Format von Runde 2 und zeigt auf vorhandene Dateien', () => {
  assert.equal(CATALOG.version, '26.2');
  assert.equal(CATALOG.counts.total, CATALOG.builds.length);
  const required = ['id', 'title', 'category', 'subtitle', 'tags', 'aliases', 'accuracy', 'difficulty', 'description', 'facts', 'sources', 'credits',
    'tested', 'module', 'structure', 'scales', 'defaultScale', 'size', 'blocks', 'steps', 'phases', 'variants', 'topMaterials', 'sizeClass', 'thumb'];
  for (const build of CATALOG.builds) {
    for (const key of required) assert.ok(Object.hasOwn(build, key), `${build.id}: ${key} fehlt`);
    assert.ok(build.topMaterials.length <= 8);
    if (build.module) assert.ok(existsSync(path.join(ROOT, build.module)), `${build.module} fehlt`);
    if (build.structure) assert.ok(build.id.startsWith('spiel-') && build.accuracy === 'original' && build.module === null);
  }
  const normalized = normalizeCatalog(CATALOG);
  assert.equal(normalized.builds.length, CATALOG.builds.length, 'kein Eintrag wird verworfen');
  assert.ok(CATALOG.builds.some((b) => b.scales?.length === 2 && b.variants), 'ein Eintrag mit Maßstäben');
  assert.ok(CATALOG.builds.some((b) => b.tested === false && b.credits), 'ein Eintrag mit tested: false und Credits');
});

test('loadBuildEntry: Eintrag mit allen Feldern, Testmodule erlaubt, unbekannt → null', async () => {
  const fetch = catalogFetch();
  const house = await loadBuildEntry('example-house', { fetch, root: SITE });
  assert.equal(house.module, 'tests/fixtures/core/example-house.js');
  assert.equal(house.description.startsWith('Ein kleines Haus'), true);
  assert.deepEqual(sourceForEntry(house), { kind: 'module', path: 'tests/fixtures/core/example-house.js' });
  const plaza = await loadBuildEntry('big-plaza', { fetch, root: SITE });
  assert.deepEqual(plaza.scales, [1, 0.5]);
  assert.equal(plaza.defaultScale, 1);
  assert.deepEqual(variantFor(plaza, 0.5).size, [75, 23, 75]);
  const structure = await loadBuildEntry('spiel-plains-small-house-1', { fetch, root: SITE });
  assert.deepEqual(sourceForEntry(structure), { kind: 'structure', file: 'village__plains__houses__plains_small_house_1.json' });
  assert.equal(await loadBuildEntry('gibt-es-nicht', { fetch, root: SITE }), null);
});

test('Katalog fehlt: DataError „Katalog fehlt“ ohne Befehle', async () => {
  const calls = [];
  const fetch = async (url) => { calls.push(String(url)); return new Response('', { status: 404 }); };
  await assert.rejects(loadBuildEntry('example-house', { fetch, root: SITE }), (error) => error.name === 'DataError' && error.kind === 'missing'
    && error.title === 'Katalog fehlt' && error.steps.length > 0 && error.steps.every((step) => !step.command));
  assert.deepEqual(calls, ['http://127.0.0.1:8080/data/catalog.json'], 'nur der Katalog, online keine Nachfrage nach Vorschaubildern');
});

test('loadBuildEntry: auf dem eigenen Rechner kommt das lokale Vorschaubild dazu', async () => {
  const fetch = async (url) => {
    if (String(url).endsWith('/thumbs/index.json')) return new Response(JSON.stringify({ version: 1, entries: { 'example-house': {} } }), { status: 200 });
    return catalogFetch()(url);
  };
  const local = await loadBuildEntry('example-house', { fetch, root: SITE, location: { hostname: '127.0.0.1' } });
  assert.equal(local.thumb, 'thumbs/example-house.webp');
  const online = await loadBuildEntry('example-house', { fetch, root: SITE, location: { hostname: 'jason-z-tech.github.io' } });
  assert.equal(online.thumb, CATALOG.builds.find((b) => b.id === 'example-house').thumb ?? null, 'online nur, was im Katalog steht');
});

test('normalizeBuildDetails prüft jedes Feld', () => {
  const details = normalizeBuildDetails({
    description: '  Text  ', facts: ['a', '', 3, 'b'], module: 'js/builds/x/../y.js',
    sources: [{ title: 'Gut', url: 'https://example.org/a' }, { title: 'Böse', url: 'javascript:alert(1)' }, { url: 'http://unsicher.de' }, { url: 'https://ohne-titel.de/x' }],
    credits: { author: 'Ann', url: 'http://nicht-https.de', license: 'CC BY 4.0' },
    scales: [0.5, 1, 1, -2, 9, 'x'], defaultScale: 0.5, variants: { 1: { size: [2, 2, 2], blocks: 8, steps: 2 }, 0.3: { size: [1, 1, 1] } },
    sizeClass: 'mega',
  });
  assert.equal(details.description, 'Text');
  assert.deepEqual(details.facts, ['a', 'b']);
  assert.equal(details.module, null, 'kein „..“ im Modulpfad');
  assert.deepEqual(details.sources, [{ title: 'Gut', url: 'https://example.org/a' }, { title: 'ohne-titel.de', url: 'https://ohne-titel.de/x' }]);
  assert.deepEqual(details.credits, { author: 'Ann', url: null, license: 'CC BY 4.0' });
  assert.deepEqual(details.scales, [1, 0.5]);
  assert.equal(details.defaultScale, 0.5);
  assert.deepEqual(Object.keys(details.variants), ['1']);
  assert.equal(details.sizeClass, null);
  assert.ok(MODULE_PATH_PATTERN.test('tests/fixtures/ui/big-plaza.js'));
  assert.ok(!MODULE_PATH_PATTERN.test('tests/unit/ui-build-entry.test.mjs'));
  assert.equal(isHttpsUrl('https://minecraft.wiki/w/Stone'), true);
  assert.equal(isHttpsUrl('http://minecraft.wiki/'), false);
  assert.equal(isHttpsUrl('https://'), false);
});

test('viewEntry: Teil-Objekte für Formen und Uploads', () => {
  const entry = viewEntry({ title: 'Kugel', subtitle: 'Radius 8', accuracy: 'eigenes', scales: 'kaputt', thumb: '../x.webp', category: 'gibts-nicht', id: 'Kugel!' });
  assert.equal(entry.title, 'Kugel');
  assert.equal(entry.id, null);
  assert.equal(entry.category, null);
  assert.deepEqual(entry.scales, []);
  assert.equal(entry.thumb, null);
  assert.deepEqual(entry.sources, []);
  assert.equal(viewEntry(null).title, 'Bau');
  assert.equal(viewEntry({ thumb: 'thumbs/kugel.webp' }).thumb, 'thumbs/kugel.webp');
});

test('Maßstab aus der Adresse auflösen', () => {
  const plaza = { scales: [1, 0.5], defaultScale: null };
  assert.deepEqual(resolveScale(plaza, null), { ok: true, scale: 1 });
  assert.deepEqual(resolveScale(plaza, 0.5), { ok: true, scale: 0.5 });
  assert.deepEqual(resolveScale(plaza, 0.25), { ok: false, reason: 'unknown-scale' });
  assert.deepEqual(resolveScale({ scales: [] }, null), { ok: true, scale: null });
  assert.deepEqual(resolveScale({ scales: [] }, 1), { ok: false, reason: 'no-scales' });
  assert.deepEqual(resolveScale({ scales: [0.5, 0.25], defaultScale: 0.25 }, null), { ok: true, scale: 0.25 });
  assert.equal(formatScale(1), '1:1');
  assert.equal(formatScale(0.5), '1:2');
  assert.equal(formatScale(0.4), '1:2,5');
  assert.equal(formatScale(2), '2:1');
  assert.equal(scaleToken(0.1 + 0.2), '0.3');
  assert.equal(progressKeyFor('turm'), 'bk:progress:turm');
  assert.equal(progressKeyFor('turm', 0.5), 'bk:progress:turm@0.5');
  assert.equal(progressKeyFor('turm', 1), 'bk:progress:turm@1');
});

test('Fortschritt: speichern, laden, abhaken, zurücksetzen', async () => {
  const storage = memoryStorage();
  const store = new ProgressStore('bk:progress:haus', { stepCount: 10, storage, delayMs: 0 });
  assert.equal(store.enabled, true);
  assert.equal(store.hasData, false);
  const seen = [];
  store.subscribe((s) => seen.push(s.step));
  store.setStep(4.256);
  assert.equal(store.step, 4.26);
  store.setChecked('oak_planks', true);
  store.setChecked('stone', true);
  store.setChecked('stone', false);
  assert.throws(() => store.setChecked('<b>', true), /Ungültige Gegenstands-ID/);
  const saved = storage.get('bk:progress:haus');
  assert.deepEqual(saved.checked, ['oak_planks']);
  assert.equal(saved.step, 4.26);
  const again = new ProgressStore('bk:progress:haus', { stepCount: 10, storage });
  assert.equal(again.step, 4.26);
  assert.equal(again.isChecked('oak_planks'), true);
  again.reset();
  assert.equal(storage.data.has('bk:progress:haus'), false);
  assert.ok(seen.length >= 2);
  const off = new ProgressStore(null, { stepCount: 3, storage });
  off.setStep(2);
  off.setChecked('stone', true);
  assert.equal(storage.data.size, 0, 'ohne Schlüssel wird nichts gespeichert');
  assert.throws(() => new ProgressStore('fremd:x', { stepCount: 3, storage }), /bk:progress:/);
});

test('Fortschritt: Speichern des Schritts wird gebündelt', async () => {
  const storage = memoryStorage();
  let writes = 0;
  const counting = { ...storage, set: (key, value) => { writes++; return storage.set(key, value); } };
  const store = new ProgressStore('bk:progress:b', { stepCount: 50, storage: counting, delayMs: 30 });
  for (let i = 1; i <= 20; i++) store.setStep(i);
  assert.equal(writes, 0);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(writes, 1);
  assert.equal(storage.get('bk:progress:b').step, 20);
  store.setStep(21);
  store.flush();
  assert.equal(writes, 2);
  store.dispose();
});

test('Gespeicherte Werte werden geprüft', () => {
  assert.deepEqual(parseStoredProgress('kaputt', 5), { step: null, checked: new Set(), updatedAt: null });
  const parsed = parseStoredProgress({ step: 99, checked: ['stone', 7, '<x>', 'oak_log'], updatedAt: 'gestern' }, 5);
  assert.equal(parsed.step, 5, 'auf die Schrittzahl begrenzt');
  assert.deepEqual([...parsed.checked], ['stone', 'oak_log']);
  assert.equal(parsed.updatedAt, null);
  const value = serializeProgress({ step: 1.239, checked: new Set(['b', 'a']) }, new Date('2026-10-23T10:00:00Z'));
  assert.deepEqual(value, { v: 1, step: 1.24, checked: ['a', 'b'], updatedAt: '2026-10-23T10:00:00.000Z' });
});

test('Schlüssel für Formen: stabil, unabhängig von der Reihenfolge', () => {
  const a = formProgressKey('kugel', { radius: 8, block: 'stone' });
  const b = formProgressKey('kugel', { block: 'stone', radius: 8 });
  assert.equal(a, b);
  assert.match(a, /^bk:progress:form-kugel-[a-z0-9]+$/);
  assert.notEqual(a, formProgressKey('kugel', { radius: 9, block: 'stone' }));
  assert.match(formProgressKey('<Böse>', {}), /^bk:progress:form-bse-[a-z0-9]+$/, 'nur a–z, 0–9 und -');
  assert.equal(hashText('abc'), hashText('abc'));
});
