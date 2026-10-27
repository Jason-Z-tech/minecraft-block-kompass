import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadJson, loadCatalog, loadNames, normalizeCatalog, normalizeBuild, recoverySteps, isSafeDataPath, findBuild,
  countByCategory, DataError, CATALOG_PATH, NAMES_PATH, THUMBS_INDEX_PATH, isLocalSite, loadLocalThumbIds, applyThumbs,
} from '../../js/ui/data.js';

const ROOT = new URL('http://127.0.0.1:8080/');

function fakeFetch(respond) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return respond(url, options);
  };
  return { fetch, calls };
}

const json = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function quietly(fn) {
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  return Promise.resolve()
    .then(() => fn(warnings))
    .finally(() => { console.warn = warn; });
}

const VALID_BUILD = {
  id: 'tokyo-skytree', title: 'Tokyo Skytree', category: 'wahrzeichen', subtitle: 'Fernseh- und Aussichtsturm in Tokio',
  tags: ['Japan', 'Turm'], aliases: ['skytree'], accuracy: 'massstab', difficulty: 5, size: [68, 634, 68], blocks: 123456,
  steps: 420, topMaterials: [['white_concrete', 5000]], module: 'js/builds/wahrzeichen/tokyo-skytree.js', structure: null,
  scales: [1, 0.5, 0.25], tested: null, thumb: 'thumbs/tokyo-skytree.webp',
};

test('loadJson liefert geparstes JSON und fragt ab der Website-Wurzel', async () => {
  const { fetch, calls } = fakeFetch(() => json({ ok: true }));
  assert.deepEqual(await loadJson('game-data/meta.json', { fetch, root: new URL('http://127.0.0.1:8080/unter/') }), { ok: true });
  assert.equal(calls[0].url, 'http://127.0.0.1:8080/unter/game-data/meta.json');
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.ok(calls[0].options.signal instanceof AbortSignal, 'mit Zeitlimit');
});

test('404 → verständliche Meldung ohne Befehle (die Seite läuft auch online, z. B. auf dem Handy)', async () => {
  const { fetch } = fakeFetch(() => new Response('Nicht gefunden.', { status: 404 }));
  assert.equal(CATALOG_PATH, 'data/catalog.json', 'der Katalog liegt im Repo, nicht unter game-data/');
  await assert.rejects(loadJson(CATALOG_PATH, { fetch, root: ROOT }), (error) => {
    assert.ok(error instanceof DataError);
    assert.equal(error.name, 'DataError');
    assert.equal(error.kind, 'missing');
    assert.equal(error.status, 404);
    assert.equal(error.title, 'Katalog fehlt');
    assert.match(error.message, /data\/catalog\.json/);
    assert.ok(error.steps.length > 0, 'es gibt einen Hinweis, was man tun kann');
    assert.deepEqual(error.steps.map((step) => step.command).filter(Boolean), [], 'keine Befehle');
    assert.doesNotMatch(error.steps.map((step) => step.text).join(' '), /node|scripts\/|Projektordner|Server/);
    return true;
  });
  await assert.rejects(loadJson(NAMES_PATH, { fetch, root: ROOT }), (error) => error.kind === 'missing' && error.title === 'Spieldaten fehlen'
    && error.steps.every((step) => !step.command));
  await assert.rejects(loadJson('daten/liste.json', { fetch, root: ROOT }), { kind: 'missing', title: 'Datei nicht gefunden' });
});

test('Serverfehler, Netzwerk, Zeitlimit und kaputtes JSON haben eigene Meldungen', async () => {
  await assert.rejects(loadJson(NAMES_PATH, { fetch: fakeFetch(() => new Response('x', { status: 500 })).fetch, root: ROOT }), { kind: 'http', status: 500 });
  await assert.rejects(loadJson(NAMES_PATH, { fetch: async () => { throw new TypeError('Failed to fetch'); }, root: ROOT }), (error) => {
    assert.equal(error.kind, 'network');
    assert.equal(error.title, 'Keine Verbindung');
    assert.match(error.message, /Internetverbindung/);
    assert.doesNotMatch(`${error.message} ${error.steps.map((step) => step.text).join(' ')}`, /lokal|Server|node/, 'kein „lokaler Server“ mehr');
    assert.deepEqual(error.steps.map((step) => step.command).filter(Boolean), []);
    assert.ok(error.cause instanceof TypeError, 'Ursache bleibt erhalten');
    return true;
  });
  await assert.rejects(loadJson(NAMES_PATH, { fetch: async () => { throw new DOMException('Zeit', 'TimeoutError'); }, root: ROOT }), { kind: 'timeout' });
  await assert.rejects(loadJson(NAMES_PATH, { fetch: fakeFetch(() => json('{"kaputt": ')).fetch, root: ROOT }), { kind: 'parse', title: 'Spieldaten beschädigt' });
});

test('loadJson lehnt unsichere Pfade ab, ohne überhaupt anzufragen', async () => {
  const { fetch, calls } = fakeFetch(() => json({}));
  for (const bad of ['../geheim.json', 'game-data/../../x.json', 'https://evil.example/x.json', '//evil.example/x.json', '/game-data/x.json',
    'game-data/x.txt', 'game-data//x.json', 'game-data/x.json?y=1', 'javascript:alert(1)', '', null]) {
    await assert.rejects(loadJson(bad, { fetch, root: ROOT }), { kind: 'invalid-path' }, String(bad));
  }
  assert.equal(calls.length, 0);
  assert.equal(isSafeDataPath('game-data/structures/village__plains__houses__plains_small_house_1.json'), true);
});

test('recoverySteps: ein Hinweis zum Neuladen, nie ein Befehl', () => {
  const steps = recoverySteps();
  assert.equal(steps.length, 1);
  assert.match(steps[0].text, /neu/);
  assert.equal(steps[0].command, undefined);
});

test('normalizeBuild übernimmt gültige Einträge vollständig', () => {
  const result = normalizeBuild(VALID_BUILD);
  assert.equal(result.ok, true);
  assert.deepEqual(result.build, VALID_BUILD);
});

test('normalizeBuild: ohne ID, Titel oder Kategorie wird verworfen, andere Felder werden geleert', () => {
  assert.equal(normalizeBuild(null).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, id: 'Tokyo Skytree' }).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, title: '   ' }).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, category: 'weltall' }).ok, false);
  const { build } = normalizeBuild({
    ...VALID_BUILD, accuracy: 'geraten', difficulty: 9, size: [10, 0, 10], blocks: -5, steps: 1.5, tested: 'ja',
    thumb: '../geheim.webp', module: 'https://evil.example/x.js', structure: '../../x.json', scales: [1, 'x', 0, 9],
    tags: ['ok', 42, '', 'x'.repeat(100)], topMaterials: [['stone', 3], ['Böse<>', 1], ['dirt', -1]],
  });
  assert.equal(build.accuracy, null);
  assert.equal(build.difficulty, null);
  assert.equal(build.size, null);
  assert.equal(build.blocks, null);
  assert.equal(build.steps, null);
  assert.equal(build.tested, null);
  assert.equal(build.thumb, null);
  assert.equal(build.module, null);
  assert.equal(build.structure, null);
  assert.deepEqual(build.scales, [1]);
  assert.deepEqual(build.tags, ['ok', 'x'.repeat(40)]);
  assert.deepEqual(build.topMaterials, [['stone', 3]]);
  for (const thumb of ['thumbs/x.svg', 'https://evil.example/x.webp', 'thumbs/../x.webp', 'thumbs/X Y.webp']) {
    assert.equal(normalizeBuild({ ...VALID_BUILD, thumb }).build.thumb, null, thumb);
  }
});

test('normalizeCatalog: überspringt ungültige und doppelte Einträge und meldet sie', async () => {
  await quietly((warnings) => {
    const catalog = normalizeCatalog({
      generatedAt: '2026-10-22T12:00:00Z', version: '26.2',
      builds: [VALID_BUILD, { id: 'x' }, { ...VALID_BUILD }, { ...VALID_BUILD, id: 'zweiter-bau', category: 'redstone' }],
    });
    assert.equal(catalog.builds.length, 2);
    assert.equal(catalog.skipped, 2);
    assert.equal(catalog.version, '26.2');
    assert.equal(catalog.generatedAt, '2026-10-22T12:00:00Z');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /2 Einträge/);
  });
  assert.throws(() => normalizeCatalog([]), { kind: 'format' });
  assert.throws(() => normalizeCatalog({ builds: {} }), { kind: 'format', title: 'Katalog unvollständig' });
});

test('loadCatalog: fehlt der Katalog, kommt „Katalog fehlt“ – ohne Nachfragen nach Spieldaten oder Bildern (online)', async () => {
  const nothing = fakeFetch(() => new Response('', { status: 404 }));
  await assert.rejects(loadCatalog({ fetch: nothing.fetch, root: ROOT, location: { hostname: 'jason-z-tech.github.io' } }), (error) => {
    assert.equal(error.kind, 'missing');
    assert.equal(error.title, 'Katalog fehlt');
    assert.deepEqual(error.steps.map((step) => step.command).filter(Boolean), []);
    return true;
  });
  assert.deepEqual(nothing.calls.map((call) => call.url), ['http://127.0.0.1:8080/data/catalog.json'], 'genau eine Anfrage');
  const offline = fakeFetch(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(loadCatalog({ fetch: offline.fetch, root: ROOT }), { kind: 'network', title: 'Keine Verbindung' });
});

test('isLocalSite: nur 127.0.0.1, localhost und [::1] gelten als eigener Rechner', () => {
  for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) assert.equal(isLocalSite({ hostname }), true, hostname);
  for (const hostname of ['jason-z-tech.github.io', 'example.org', '127.0.0.1.evil.example', '']) assert.equal(isLocalSite({ hostname }), false, hostname);
  assert.equal(isLocalSite(undefined), false);
  assert.equal(isLocalSite(null), false);
});

test('Lokale Vorschaubilder: nur auf dem eigenen Rechner aus thumbs/index.json, online keine Anfrage', async () => {
  const index = { version: 1, entries: { 'tokyo-skytree': { hash: 'a', bytes: 1 }, 'kein gueltiger name': { hash: 'b' } }, style: 3 };
  const local = fakeFetch((url) => (String(url).endsWith(THUMBS_INDEX_PATH) ? json(index) : new Response('', { status: 404 })));
  const ids = await loadLocalThumbIds({ fetch: local.fetch, root: ROOT, location: { hostname: '127.0.0.1' } });
  assert.deepEqual([...ids], ['tokyo-skytree'], 'nur gültige IDs');
  assert.deepEqual(local.calls.map((call) => call.url), ['http://127.0.0.1:8080/thumbs/index.json']);

  const online = fakeFetch(() => json(index));
  assert.equal((await loadLocalThumbIds({ fetch: online.fetch, root: ROOT, location: { hostname: 'jason-z-tech.github.io' } })).size, 0);
  assert.equal(online.calls.length, 0, 'online wird thumbs/index.json nie angefragt');

  const missing = fakeFetch(() => new Response('', { status: 404 }));
  assert.equal((await loadLocalThumbIds({ fetch: missing.fetch, root: ROOT, location: { hostname: 'localhost' } })).size, 0, 'fehlt die Datei: keine Bilder');
  await quietly(async (warnings) => {
    const broken = fakeFetch(() => json({ version: 2, entries: {} }));
    assert.equal((await loadLocalThumbIds({ fetch: broken.fetch, root: ROOT, location: { hostname: 'localhost' } })).size, 0);
    assert.equal(warnings.length, 1, 'unbekanntes Format wird gemeldet');
  });

  const builds = [{ id: 'tokyo-skytree', thumb: null }, { id: 'kolben-tuer', thumb: null }, { id: 'eigenes-bild', thumb: 'thumbs/x.webp' }];
  applyThumbs(builds, new Set(['tokyo-skytree', 'eigenes-bild']));
  assert.deepEqual(builds.map((build) => build.thumb), ['thumbs/tokyo-skytree.webp', null, 'thumbs/x.webp'], 'vorhandene Pfade bleiben');
});

test('loadCatalog ergänzt lokale Vorschaubilder nur auf dem eigenen Rechner', async () => {
  const body = { version: '26.2', builds: [{ ...VALID_BUILD, thumb: null }, { ...VALID_BUILD, id: 'kolben-tuer', category: 'redstone', thumb: null }] };
  const respond = (url) => (String(url).endsWith(THUMBS_INDEX_PATH) ? json({ version: 1, entries: { 'kolben-tuer': {} } }) : json(body));
  const local = await loadCatalog({ fetch: fakeFetch(respond).fetch, root: ROOT, location: { hostname: '127.0.0.1' } });
  assert.deepEqual(local.builds.map((build) => build.thumb), [null, 'thumbs/kolben-tuer.webp']);
  const online = await loadCatalog({ fetch: fakeFetch(respond).fetch, root: ROOT, location: { hostname: 'jason-z-tech.github.io' } });
  assert.deepEqual(online.builds.map((build) => build.thumb), [null, null]);
});

test('loadCatalog, findBuild und countByCategory', async () => {
  const { fetch } = fakeFetch(() => json({ version: '26.2', builds: [VALID_BUILD, { ...VALID_BUILD, id: 'kolben-tuer', category: 'redstone' }] }));
  const catalog = await loadCatalog({ fetch, root: ROOT });
  assert.equal(findBuild(catalog, 'kolben-tuer').category, 'redstone');
  assert.equal(findBuild(catalog, 'gibt-es-nicht'), null);
  assert.deepEqual(countByCategory(catalog), { haeuser: 0, wahrzeichen: 1, fantasy: 0, mittelalter: 0, klein: 0, redstone: 1, farmen: 0, infrastruktur: 0 });
});

test('loadNames prüft das Format von names.json', async () => {
  const good = { block: { stone_bricks: { de: 'Steinziegel', en: 'Stone Bricks' } }, item: {} };
  assert.deepEqual(await loadNames({ fetch: fakeFetch(() => json(good)).fetch, root: ROOT }), good);
  await assert.rejects(loadNames({ fetch: fakeFetch(() => json({ block: {} })).fetch, root: ROOT }), { kind: 'format' });
});
