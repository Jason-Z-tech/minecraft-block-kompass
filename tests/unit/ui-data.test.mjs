import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadJson, loadCatalog, loadNames, loadBlockList, normalizeCatalog, normalizeBuild, recoverySteps, isSafeDataPath, findBuild,
  countByCategory, DataError, CATALOG_PATH, NAMES_PATH, BLOCKS_PATH, THUMBS_INDEX_PATH, isLocalSite, loadLocalThumbIds, applyThumbs,
  gameDataToDataError,
} from '../../js/ui/data.js';
import { createGameData, GameDataError } from '../../js/data/game-data.js';
import { NetError } from '../../js/data/net.js';

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
  tags: ['Japan', 'Turm'], aliases: ['skytree'], accuracy: 'massstab', size: [68, 634, 68], blocks: 123456,
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

test('normalizeBuild: Schwierigkeit und Wissenswertes aus alten Katalogen fallen weg', () => {
  const { build } = normalizeBuild({ ...VALID_BUILD, difficulty: 3, facts: ['Höchster Turm Japans'], description: 'Text' });
  assert.equal(Object.hasOwn(build, 'difficulty'), false);
  assert.equal(Object.hasOwn(build, 'facts'), false);
  assert.equal(build.description, 'Text', 'die Beschreibung bleibt');
});

test('normalizeBuild: ohne ID, Titel oder Kategorie wird verworfen, andere Felder werden geleert', () => {
  assert.equal(normalizeBuild(null).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, id: 'Tokyo Skytree' }).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, title: '   ' }).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, category: 'weltall' }).ok, false);
  const { build } = normalizeBuild({
    ...VALID_BUILD, accuracy: 'geraten', size: [10, 0, 10], blocks: -5, steps: 1.5, tested: 'ja',
    thumb: '../geheim.webp', module: 'https://evil.example/x.js', structure: '../../x.json', scales: [1, 'x', 0, 9],
    tags: ['ok', 42, '', 'x'.repeat(100)], topMaterials: [['stone', 3], ['Böse<>', 1], ['dirt', -1]],
  });
  assert.equal(build.accuracy, null);
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
      builds: [VALID_BUILD, { id: 'x' }, { ...VALID_BUILD }, { ...VALID_BUILD, id: 'zweiter-bau', category: 'farmen' },
        { ...VALID_BUILD, id: 'kolben-tuer', category: 'redstone' }],
    });
    assert.deepEqual(catalog.builds.map((build) => build.id), ['tokyo-skytree', 'zweiter-bau']);
    assert.equal(catalog.skipped, 3, 'die Kategorie Redstone gibt es nicht mehr');
    assert.equal(catalog.version, '26.2');
    assert.equal(catalog.generatedAt, '2026-10-22T12:00:00Z');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /3 Einträge/);
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
  const body = { version: '26.2', builds: [{ ...VALID_BUILD, thumb: null }, { ...VALID_BUILD, id: 'kaktusfarm', category: 'farmen', thumb: null }] };
  const respond = (url) => (String(url).endsWith(THUMBS_INDEX_PATH) ? json({ version: 1, entries: { kaktusfarm: {} } }) : json(body));
  const local = await loadCatalog({ fetch: fakeFetch(respond).fetch, root: ROOT, location: { hostname: '127.0.0.1' } });
  assert.deepEqual(local.builds.map((build) => build.thumb), [null, 'thumbs/kaktusfarm.webp']);
  const online = await loadCatalog({ fetch: fakeFetch(respond).fetch, root: ROOT, location: { hostname: 'jason-z-tech.github.io' } });
  assert.deepEqual(online.builds.map((build) => build.thumb), [null, null]);
});

test('loadCatalog, findBuild und countByCategory', async () => {
  const { fetch } = fakeFetch(() => json({ version: '26.2', builds: [VALID_BUILD, { ...VALID_BUILD, id: 'kaktusfarm', category: 'farmen' }] }));
  const catalog = await loadCatalog({ fetch, root: ROOT });
  assert.equal(findBuild(catalog, 'kaktusfarm').category, 'farmen');
  assert.equal(findBuild(catalog, 'gibt-es-nicht'), null);
  assert.deepEqual(countByCategory(catalog), { haeuser: 0, wahrzeichen: 1, fantasy: 0, mittelalter: 0, klein: 0, farmen: 1, infrastruktur: 0 });
});

// Spieldaten kommen über js/data/game-data.js; hier ein lokaler Zugang mit Fake-fetch (game-data/ auf 127.0.0.1)
function localGameData(respond) {
  const { fetch, calls } = fakeFetch((url, options) => (String(url).endsWith('/meta.json') ? json({ version: '26.2' }) : respond(url, options)));
  return { data: createGameData({ location: { hostname: '127.0.0.1' }, fetch, root: new URL('game-data/', ROOT) }), calls };
}

test('loadNames prüft das Format von names.json', async () => {
  const good = { block: { stone_bricks: { de: 'Steinziegel', en: 'Stone Bricks' } }, item: {} };
  const { data, calls } = localGameData(() => json(good));
  assert.deepEqual(await loadNames({ load: data.loadNames }), good);
  assert.deepEqual(calls.map((call) => call.url), ['http://127.0.0.1:8080/game-data/meta.json', 'http://127.0.0.1:8080/game-data/names.json']);
  await assert.rejects(loadNames({ load: localGameData(() => json({ block: {} })).data.loadNames }), { kind: 'format', title: 'Spieldaten unvollständig' });
  await assert.rejects(loadNames({ load: async () => 'kein Objekt' }), { kind: 'format' });
});

test('loadBlockList prüft das Format von blocks.json', async () => {
  const good = { version: '26.2', blocks: { stone: { props: {}, default: {} } } };
  assert.deepEqual(await loadBlockList({ load: localGameData(() => json(good)).data.loadBlocks }), good);
  await assert.rejects(loadBlockList({ load: async () => ({ version: '26.2' }) }), (error) => error instanceof DataError && error.kind === 'format' && error.path === BLOCKS_PATH);
});

test('Fehler der Spieldaten werden zu DataError mit Titel, Text und Schritt ohne Befehle', async () => {
  const noCommands = (error) => {
    assert.ok(error instanceof DataError);
    assert.ok(error.steps.length > 0, 'ein Hinweis, was man tun kann');
    assert.deepEqual(error.steps.map((step) => step.command).filter(Boolean), [], 'keine Befehle');
    assert.doesNotMatch(`${error.message} ${error.steps.map((step) => step.text).join(' ')}`, /node |scripts\/|Projektordner|extract/);
  };
  // lokal: Datei fehlt
  await assert.rejects(loadNames({ load: localGameData(() => new Response('Nicht gefunden.', { status: 404 })).data.loadNames }), (error) => {
    noCommands(error);
    assert.equal(error.kind, 'missing');
    assert.equal(error.title, 'Spieldaten fehlen');
    assert.equal(error.status, 404);
    assert.equal(error.path, NAMES_PATH);
    assert.match(error.message, /^Spieldaten fehlen: .*game-data\/names\.json/);
    assert.ok(error.cause instanceof GameDataError, 'Ursache bleibt erhalten');
    return true;
  });
  // online: Netz weg, GitHub bremst
  const offline = new NetError('Keine Verbindung zu GitHub.', { kind: 'network', url: 'https://raw.githubusercontent.com/misode/mcmeta/x/de_de.json' });
  await assert.rejects(loadNames({ load: async () => { throw offline; } }), (error) => {
    noCommands(error);
    assert.equal(error.kind, 'network');
    assert.equal(error.title, 'Keine Verbindung zu GitHub');
    assert.equal(error.message, 'Die Spieldaten konnten nicht von GitHub geladen werden. Prüfe die Internetverbindung.');
    assert.equal(error.cause.cause, offline);
    return true;
  });
  const limited = gameDataToDataError(new NetError('429', { kind: 'rate-limit', status: 429, url: 'https://raw.githubusercontent.com/a.json' }), BLOCKS_PATH);
  noCommands(limited);
  assert.equal(limited.kind, 'rate-limit');
  assert.equal(limited.status, 429);
  assert.equal(limited.message, 'GitHub begrenzt gerade die Downloads. Versuche es in ein paar Minuten noch einmal.');
  assert.match(limited.steps[0].text, /ein paar Minuten/);
  // Unerwartetes wird nicht durchgereicht, sondern allgemein verständlich
  const odd = gameDataToDataError(new TypeError('x is undefined'), NAMES_PATH);
  noCommands(odd);
  assert.equal(odd.kind, 'unknown');
  assert.doesNotMatch(odd.message, /undefined/);
});
