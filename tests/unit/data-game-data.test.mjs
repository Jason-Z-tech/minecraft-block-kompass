// Fassade der Spieldaten js/data/game-data.js (Bauplan Etappe 2): Modus lokal/remote, lokale Lader (Fake-fetch),
// Weiterleitung an die Remote-Quelle (Fake-Quelle und echte remote.js mit den Fake-Daten tests/fixtures/mcmeta-mini/),
// Fehler mit menschlichen Meldungen ohne Befehle, Fortschritt. Ohne Netz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGameData, GameDataError, toGameDataError, isLocalHost, dataMode, loadGameNames, onGameDataProgress,
} from '../../js/data/game-data.js';
import * as gameDataModule from '../../js/data/game-data.js';
import { NetError } from '../../js/data/net.js';
import { MCMETA_BASE, MCMETA_COMMITS } from '../../js/data/sources.js';
import { TextureStore, TextureSourceError, createImage, encodePng } from '../../js/render/texture-store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MINI = path.join(ROOT, 'tests', 'fixtures', 'mcmeta-mini');
const DATA_ROOT = new URL('http://127.0.0.1:8080/unter/game-data/');
const GITHUB = 'https://raw.githubusercontent.com/misode/mcmeta/0000000000000000000000000000000000000000/';
// Befehle, Pfade von Skripten oder Hinweise auf die Installation gehören nicht in Meldungen der Seite
const COMMAND_PATTERN = /node |npm |scripts\/|\.mjs|Projektordner|extract|Terminal|Konsole/;

const json = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeFetch(respond) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return respond(String(url), options);
  };
  return { fetch, calls };
}

// Lokale Dateien (Pfad relativ zu game-data/ → Antwort); meta.json ist da, solange nicht anders angegeben
function localFiles(files, { meta = true } = {}) {
  return fakeFetch((url) => {
    const file = url.slice(DATA_ROOT.href.length);
    if (file === 'meta.json') return meta ? json({ version: '26.2' }) : new Response('Nicht gefunden.', { status: 404 });
    const body = files[file];
    if (typeof body === 'function') return body();
    if (body === undefined) return new Response('Nicht gefunden.', { status: 404 });
    return body instanceof Uint8Array ? new Response(body) : json(body);
  });
}

// Fake-Remote-Quelle: zählt Aufrufe, Antworten austauschbar
function fakeSource(overrides = {}) {
  const calls = [];
  const answer = (name, value) => async (...args) => {
    calls.push([name, ...args]);
    const custom = overrides[name];
    if (typeof custom === 'function') return custom(...args);
    return value;
  };
  const source = {
    names: answer('names', { block: { stone: { de: 'Stein', en: 'Stone' } }, item: {} }),
    blocks: answer('blocks', { version: '26.2', source: 'mcmeta', ref: 'misode/mcmeta@26.2-summary', blocks: { stone: { props: {}, default: {} } } }),
    models: answer('models', { version: '26.2', textures: [], models: [], blocks: {} }),
    textures: answer('textures', { version: '26.2', entries: { 'block/stone': { atlas: 'blocks', x: 0, y: 0, w: 16, h: 16, anim: null } } }),
    atlas: answer('atlas', new Uint8Array([1, 2, 3])),
    blockColors: answer('blockColors', { format: 1, blocks: { stone: {} } }),
    isCached: answer('isCached', true),
  };
  return { source, calls };
}

function remoteData(source, { persist = () => {}, labels = { names: 'Blocknamen', models: 'Blockmodelle', 'block-colors': 'Blockfarben' }, fetch } = {}) {
  const state = { created: 0, onProgress: null, persisted: 0 };
  const data = createGameData({
    location: { hostname: 'jason-z-tech.github.io' },
    fetch: fetch ?? (async (url) => { throw new Error(`keine Anfrage erwartet: ${url}`); }),
    root: DATA_ROOT,
    createSource: async ({ onProgress }) => {
      state.created++;
      state.onProgress = onProgress;
      return { source, labels };
    },
    persist: () => {
      state.persisted++;
      persist();
    },
  });
  return { data, state };
}

function assertHuman(error, { kind, title, message }) {
  assert.ok(error instanceof GameDataError, `GameDataError erwartet, war ${error?.name}`);
  assert.equal(error.name, 'GameDataError');
  assert.equal(error.kind, kind);
  if (title) assert.equal(error.title, title);
  if (message instanceof RegExp) assert.match(error.message, message);
  else if (message) assert.equal(error.message, message);
  assert.doesNotMatch(`${error.title} ${error.message}`, COMMAND_PATTERN, 'keine Befehle in Titel oder Meldung');
  assert.ok(error.title.length > 3 && error.message.length > 10);
}

// ---------------------------------------------------------------------------------------------
// Modus

test('isLocalHost: nur 127.0.0.1, localhost und [::1]', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) assert.equal(isLocalHost(host), true, host);
  for (const host of ['127.0.0.2', 'jason-z-tech.github.io', '192.168.1.5', 'localhost.example', '', '::1', undefined, null]) {
    assert.equal(isLocalHost(host), false, String(host));
  }
});

test('dataMode online (nicht lokaler Rechner): remote, ohne jede Anfrage', async () => {
  for (const location of [{ hostname: 'jason-z-tech.github.io' }, { hostname: '127.0.0.2' }, null, {}]) {
    const { fetch, calls } = fakeFetch(() => json({}));
    const data = createGameData({ location, fetch, root: DATA_ROOT, createSource: async () => { throw new Error('nicht gebraucht'); } });
    assert.equal(await data.dataMode(), 'remote');
    assert.equal(await data.dataMode(), 'remote');
    assert.deepEqual(calls, [], `keine Anfrage bei ${JSON.stringify(location)}`);
  }
  // Node ohne location: remote (der Standard-Zugang fragt nie nach game-data/)
  assert.equal(globalThis.location, undefined);
  assert.equal(await dataMode(), 'remote');
});

test('dataMode lokal: game-data/meta.json da → local, sonst remote; einmal je Kontext', async () => {
  for (const hostname of ['127.0.0.1', 'localhost', '[::1]']) {
    const { fetch, calls } = localFiles({});
    const data = createGameData({ location: { hostname }, fetch, root: DATA_ROOT });
    const modes = await Promise.all([data.dataMode(), data.dataMode()]);
    assert.deepEqual(modes, ['local', 'local']);
    assert.equal(await data.dataMode(), 'local');
    assert.deepEqual(calls.map((call) => call.url), [`${DATA_ROOT.href}meta.json`], 'genau eine Anfrage');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.ok(calls[0].options.signal instanceof AbortSignal, 'mit Zeitlimit');
  }
  const missing = localFiles({}, { meta: false });
  assert.equal(await createGameData({ location: { hostname: '127.0.0.1' }, fetch: missing.fetch, root: DATA_ROOT }).dataMode(), 'remote');
  assert.equal(missing.calls.length, 1);
  const server = fakeFetch(() => new Response('kaputt', { status: 500 }));
  assert.equal(await createGameData({ location: { hostname: 'localhost' }, fetch: server.fetch, root: DATA_ROOT }).dataMode(), 'remote');
  const down = createGameData({ location: { hostname: 'localhost' }, fetch: async () => { throw new TypeError('fetch failed'); }, root: DATA_ROOT });
  assert.equal(await down.dataMode(), 'remote');
});

test('Standard-Wurzel: game-data/ in der Website-Wurzel (neben js/), relativ zum Modul – auch unter einem Unterpfad', async () => {
  const seen = [];
  const spy = createGameData({ location: { hostname: '127.0.0.1' }, fetch: async (url) => { seen.push(String(url)); return json({}); } });
  assert.equal(await spy.dataMode(), 'local');
  assert.deepEqual(seen, [new URL('../../game-data/meta.json', import.meta.url).href]);
});

// ---------------------------------------------------------------------------------------------
// Lokal: genau die Dateien aus game-data/

test('Lokal: Namen, Blöcke, Modelle, Texturen und Blockfarben aus game-data/, feste Dateien einmal', async () => {
  const names = { block: { stone: { de: 'Stein', en: 'Stone' } }, item: {} };
  const blocks = { version: '26.2', blocks: { stone: { props: {}, default: {} } } };
  const models = { version: '26.2', textures: ['block/stone'], models: [], blocks: {} };
  const textures = { version: '26.2', entries: { 'block/stone': { o: 0, l: 10, w: 16, h: 16, anim: null } } };
  const bin = new Uint8Array([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const colors = { format: 1, blocks: { stone: {} } };
  const { fetch, calls } = localFiles({
    'names.json': names, 'blocks.json': blocks, 'models.json': models, 'textures.json': textures, 'textures.bin': bin,
    'block-colors.json': colors,
  });
  let created = 0;
  const data = createGameData({ location: { hostname: '127.0.0.1' }, fetch, root: DATA_ROOT, createSource: async () => { created++; throw new Error('nicht gebraucht'); } });
  const progress = [];
  data.onProgress((event) => progress.push(event));
  assert.deepEqual(await data.loadNames(), names);
  assert.deepEqual(await data.loadBlocks(), blocks);
  assert.deepEqual(await data.loadModels(), models);
  const tex = await data.loadTextures();
  assert.deepEqual(Object.keys(tex).sort(), ['bin', 'json']);
  assert.deepEqual(tex.json, textures);
  assert.ok(tex.bin instanceof Uint8Array);
  assert.deepEqual([...tex.bin], [...bin], 'Bytes von textures.bin unverändert');
  assert.equal(TextureStore.fromSource(tex).mode, 'bin', 'passt zu TextureStore.fromSource');
  assert.deepEqual(await data.loadBlockColors(), colors);
  // Feste Dateien je Kontext nur einmal (gleiche Objekte)
  assert.equal(await data.loadModels(), await data.loadModels());
  assert.equal(await data.loadTextures(), tex);
  assert.equal(await data.loadBlockColors(), await data.loadBlockColors());
  const files = calls.map((call) => call.url.slice(DATA_ROOT.href.length));
  assert.deepEqual(files, ['meta.json', 'names.json', 'blocks.json', 'models.json', 'textures.json', 'textures.bin', 'block-colors.json']);
  assert.ok(calls.every((call) => call.options.credentials === 'same-origin' && call.options.signal instanceof AbortSignal));
  assert.equal(created, 0, 'lokal wird keine Remote-Quelle angelegt');
  assert.deepEqual(progress, [], 'lokal kein Fortschritt (kein Download)');
  assert.equal(await data.needsDownload(), false);
});

test('Lokal: Fehler mit menschlichen Meldungen („Spieldaten fehlen …“), nicht behalten', async () => {
  let namesAnswer = () => new Response('Nicht gefunden.', { status: 404 });
  const { fetch, calls } = localFiles({
    'names.json': () => namesAnswer(),
    'blocks.json': () => new Response('x', { status: 500 }),
    'models.json': () => json('{"kaputt": '),
    'block-colors.json': () => json('[1, 2]'),
  });
  const data = createGameData({ location: { hostname: '127.0.0.1' }, fetch, root: DATA_ROOT });
  await assert.rejects(data.loadNames(), (error) => {
    assertHuman(error, { kind: 'missing', title: 'Spieldaten fehlen', message: 'Spieldaten fehlen: „game-data/names.json“ wurde nicht gefunden.' });
    assert.equal(error.status, 404);
    assert.equal(error.file, 'names.json');
    return true;
  });
  await assert.rejects(data.loadBlocks(), (error) => {
    assertHuman(error, { kind: 'http', title: 'Spieldaten nicht ladbar', message: /„game-data\/blocks\.json“ .*Fehler 500/ });
    assert.equal(error.status, 500);
    return true;
  });
  await assert.rejects(data.loadModels(), (error) => assertHuman(error, { kind: 'damaged', title: 'Spieldaten beschädigt', message: /kein gültiges JSON/ }) ?? true);
  await assert.rejects(data.loadBlockColors(), (error) => assertHuman(error, { kind: 'damaged', message: /erwartete Format/ }) ?? true);
  await assert.rejects(data.loadTextures(), { kind: 'missing' });
  // Fehler werden nicht behalten: der nächste Versuch fragt neu
  const before = calls.length;
  namesAnswer = () => json({ block: {}, item: {} });
  assert.deepEqual(await data.loadNames(), { block: {}, item: {} });
  assert.equal(calls.length, before + 1);
  // Netz weg und Zeitüberschreitung (nach der Modusprüfung)
  let mode = 'ok';
  const flaky = createGameData({
    location: { hostname: 'localhost' }, root: DATA_ROOT,
    fetch: async (url) => {
      if (String(url).endsWith('meta.json')) return json({});
      if (mode === 'down') throw new TypeError('Failed to fetch');
      throw new DOMException('Zeit', 'TimeoutError');
    },
  });
  mode = 'down';
  await assert.rejects(flaky.loadNames(), (error) => {
    assertHuman(error, { kind: 'network', title: 'Keine Verbindung' });
    assert.ok(error.cause instanceof TypeError, 'Ursache bleibt erhalten');
    return true;
  });
  mode = 'slow';
  await assert.rejects(flaky.loadBlocks(), (error) => assertHuman(error, { kind: 'timeout', title: 'Zeitüberschreitung' }) ?? true);
});

test('Keine Original-Strukturen mehr: kein Lader, nie eine Anfrage nach game-data/structures/', async () => {
  const { fetch, calls } = localFiles({});
  const data = createGameData({ location: { hostname: '127.0.0.1' }, fetch, root: DATA_ROOT });
  await data.dataMode();
  assert.equal('loadStructure' in data, false);
  assert.deepEqual(Object.keys(data).sort(), ['dataMode', 'loadBlockColors', 'loadBlocks', 'loadModels', 'loadNames', 'loadTextures', 'needsDownload', 'onProgress']);
  assert.equal('loadGameStructure' in gameDataModule, false);
  assert.equal(calls.length, 1, 'nur meta.json');
});

// ---------------------------------------------------------------------------------------------
// Remote: Weiterleitung an die Quelle

test('Remote: alle Lader gehen an EINE Quelle, nie an game-data/', async () => {
  const { source, calls } = fakeSource();
  const { data, state } = remoteData(source);
  assert.equal((await data.loadNames()).block.stone.de, 'Stein');
  assert.equal((await data.loadBlocks()).source, 'mcmeta');
  assert.deepEqual(await data.loadModels(), { version: '26.2', textures: [], models: [], blocks: {} });
  const textures = await data.loadTextures();
  assert.deepEqual(Object.keys(textures).sort(), ['atlas', 'json']);
  assert.equal(textures.json.entries['block/stone'].atlas, 'blocks');
  assert.equal(typeof textures.atlas, 'function');
  assert.deepEqual([...await textures.atlas('blocks')], [1, 2, 3]);
  assert.equal(await data.loadTextures(), textures, 'gleiche Texturquelle je Kontext');
  assert.equal(TextureStore.fromSource(textures).mode, 'atlas', 'passt zu TextureStore.fromSource');
  assert.equal((await data.loadBlockColors()).format, 1);
  assert.equal(state.created, 1, 'eine Quelle je Kontext');
  assert.deepEqual(calls, [['names'], ['blocks'], ['models'], ['textures'], ['atlas', 'blocks'], ['blockColors']]);
});

test('Remote: Fehler menschlich und nicht behalten, persist einmal nach dem ersten Erfolg', async () => {
  let offline = true;
  const { source, calls } = fakeSource({
    names: () => {
      if (offline) throw new NetError('Keine Verbindung zu GitHub.', { kind: 'network', url: `${GITHUB}assets/minecraft/lang/de_de.json`, cause: new TypeError('fetch failed') });
      return { block: {}, item: {} };
    },
  });
  const { data, state } = remoteData(source);
  await assert.rejects(data.loadNames(), (error) => {
    assertHuman(error, { kind: 'network', title: 'Keine Verbindung zu GitHub', message: 'Die Spieldaten konnten nicht von GitHub geladen werden. Prüfe die Internetverbindung.' });
    assert.equal(error.cause.name, 'NetError');
    assert.equal(error.file, 'de_de.json');
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(state.persisted, 0, 'kein persist nach einem Fehler');
  offline = false;
  assert.deepEqual(await data.loadNames(), { block: {}, item: {} }, 'neuer Versuch klappt');
  await data.loadBlocks();
  await data.loadModels();
  assert.equal(state.persisted, 1, 'persist genau einmal');
  assert.equal(calls.filter(([name]) => name === 'names').length, 2);
  // Ein werfendes persist stört nicht
  const throwing = remoteData(fakeSource().source, { persist: () => { throw new Error('nicht erlaubt'); } });
  assert.ok(await throwing.data.loadBlocks());
  // Quelle selbst nicht ladbar (z. B. Modul offline): verständlich, beim nächsten Mal neu
  let attempts = 0;
  const broken = createGameData({
    location: { hostname: 'jason-z-tech.github.io' },
    createSource: async () => {
      attempts++;
      if (attempts === 1) throw new TypeError('Failed to fetch dynamically imported module');
      return { source: fakeSource().source, labels: {} };
    },
    persist: () => {},
  });
  await assert.rejects(broken.loadBlocks(), (error) => assertHuman(error, { kind: 'network' }) ?? true);
  assert.ok(await broken.loadBlocks());
  assert.equal(attempts, 2);
});

test('Remote: Atlas-Fehler über TextureStore → TextureSourceError → verständliche Meldung, neuer Versuch klappt', async () => {
  const image = createImage(16, 16);
  image.data.fill(200);
  const png = await encodePng(image);
  let atlasAnswer = () => { throw new NetError('429', { kind: 'rate-limit', status: 429, url: `${GITHUB}blocks/atlas.png` }); };
  const { source } = fakeSource({ atlas: () => atlasAnswer() });
  const { data } = remoteData(source);
  const store = TextureStore.fromSource(await data.loadTextures());
  const failure = await store.image('block/stone').then(() => null, (error) => error);
  assert.ok(failure instanceof TextureSourceError, 'Store meldet die Quelle');
  assert.equal(failure.cause?.name, 'GameDataError', 'Ursache ist schon menschlich');
  assertHuman(toGameDataError(failure), {
    kind: 'rate-limit', title: 'GitHub bremst gerade', message: 'GitHub begrenzt gerade die Downloads. Versuche es in ein paar Minuten noch einmal.',
  });
  assert.equal(toGameDataError(failure).cause, failure);
  atlasAnswer = () => png;
  const loaded = await store.image('block/stone');
  assert.equal(loaded.width, 16);
  assert.equal(loaded.data[0], 200);
});

test('needsDownload: lokal nie, remote bis alle Stufen gespeichert sind', async () => {
  const cached = new Set(['names', 'blocks']);
  const { source, calls } = fakeSource({ isCached: (name) => cached.has(name) });
  const { data } = remoteData(source);
  assert.equal(await data.needsDownload(), true);
  assert.deepEqual(calls.map(([, name]) => name).sort(), ['blocks', 'models', 'names', 'textures']);
  cached.add('models').add('textures');
  assert.equal(await data.needsDownload(), false);
  assert.equal(await data.needsDownload(['atlas:blocks']), true, 'andere Stufen auf Wunsch');
  const failing = remoteData(fakeSource({ isCached: () => { throw new TypeError('kaputt'); } }).source);
  assert.equal(await failing.data.needsDownload(), true, 'im Zweifel: ja');
});

// ---------------------------------------------------------------------------------------------
// Fehlerübersetzung

test('NetError aller Arten → GameDataError mit Titel und Meldung ohne Befehle', () => {
  const url = `${GITHUB}assets/model/data.min.json`;
  const cases = [
    [{ kind: 'network' }, { kind: 'network', title: 'Keine Verbindung zu GitHub', message: 'Die Spieldaten konnten nicht von GitHub geladen werden. Prüfe die Internetverbindung.' }],
    [{ kind: 'timeout' }, { kind: 'timeout', title: 'GitHub antwortet nicht', message: /Prüfe die Internetverbindung\.$/ }],
    [{ kind: 'rate-limit', status: 429 }, { kind: 'rate-limit', title: 'GitHub bremst gerade', message: 'GitHub begrenzt gerade die Downloads. Versuche es in ein paar Minuten noch einmal.' }],
    [{ kind: 'http', status: 503 }, { kind: 'http', title: 'GitHub hat gerade Probleme', message: 'GitHub hat gerade Probleme (Fehler 503). Versuche es etwas später noch einmal.' }],
    [{ kind: 'http', status: 404 }, { kind: 'missing', title: 'Spieldaten nicht gefunden', message: 'Ein Teil der Spieldaten („data.min.json“) wurde auf GitHub nicht gefunden.' }],
    [{ kind: 'http', status: 403 }, { kind: 'http', title: 'Download abgelehnt', message: /abgelehnt \(Fehler 403\)/ }],
    [{ kind: 'too-large', message: 'Die Datei „data.min.json“ ist größer als erwartet (über 4 MB) und wurde nicht geladen.' }, { kind: 'too-large', title: 'Spieldaten unerwartet groß', message: /größer als erwartet/ }],
    [{ kind: 'format', message: 'Die Datei „data.min.json“ ist beschädigt (kein gültiges JSON).', cause: new SyntaxError('x') }, { kind: 'damaged', title: 'Spieldaten beschädigt', message: /beschädigt/ }],
    [{ kind: 'gibt-es-nicht' }, { kind: 'unknown' }],
  ];
  for (const [given, expected] of cases) {
    const net = new NetError(given.message ?? `technisch: ${given.kind}`, { kind: given.kind, status: given.status ?? null, url, cause: given.cause });
    const error = toGameDataError(net);
    assertHuman(error, expected);
    assert.equal(error.cause, net, 'Ursache in cause');
    assert.equal(error.file, 'data.min.json');
    assert.equal(error.status, given.status ?? null);
  }
  // Falsche Version (remote.js: kind 'format' an version.json, ohne weitere Ursache)
  const version = new NetError('Die Spieldaten auf GitHub passen nicht zu Minecraft Java 26.2 (gefunden: Version „26.1“, Datenversion 4800, erwartet: Datenversion 4903).',
    { kind: 'format', url: `${GITHUB}version.json` });
  assertHuman(toGameDataError(version), { kind: 'version', title: 'Spieldaten passen nicht', message: /passen nicht zu Minecraft Java 26\.2/ });
  const brokenVersion = new NetError('Die Datei „version.json“ ist beschädigt (kein gültiges JSON).', { kind: 'format', url: `${GITHUB}version.json`, cause: new SyntaxError('x') });
  assert.equal(toGameDataError(brokenVersion).kind, 'damaged');
  // Wiederholbar nur, wenn ein neuer Versuch helfen kann
  assert.deepEqual(['network', 'timeout', 'rate-limit'].map((kind) => toGameDataError(new NetError('x', { kind })).retryable), [true, true, true]);
  assert.equal(toGameDataError(new NetError('x', { kind: 'http', status: 500 })).retryable, true);
  assert.equal(toGameDataError(new NetError('x', { kind: 'http', status: 404 })).retryable, false);
  assert.equal(toGameDataError(new NetError('x', { kind: 'format' })).retryable, false);
});

test('TextureSourceError, ungültige Namen und Unbekanntes → GameDataError', () => {
  const net = new NetError('x', { kind: 'network', url: `${GITHUB}blocks/atlas.png` });
  const viaNet = toGameDataError(new TextureSourceError('Der Textur-Atlas „blocks“ konnte nicht geladen werden: x', { atlas: 'blocks', cause: net }));
  assertHuman(viaNet, { kind: 'network', title: 'Keine Verbindung zu GitHub', message: /Prüfe die Internetverbindung/ });
  assert.equal(viaNet.cause.name, 'TextureSourceError');
  const inner = new GameDataError('GitHub begrenzt gerade die Downloads. Versuche es in ein paar Minuten noch einmal.', { kind: 'rate-limit', title: 'GitHub bremst gerade' });
  const viaGameData = toGameDataError(new TextureSourceError('…', { atlas: 'blocks', cause: inner }));
  assertHuman(viaGameData, { kind: 'rate-limit', title: 'GitHub bremst gerade', message: inner.message });
  const decode = toGameDataError(new TextureSourceError('Der Textur-Atlas „entities“ lässt sich nicht lesen: PNG: CRC falsch', { atlas: 'entities', cause: new Error('PNG: CRC falsch') }));
  assertHuman(decode, { kind: 'damaged', title: 'Texturen beschädigt', message: /„entities“.*beschädigt/ });
  assert.doesNotMatch(decode.message, /CRC|PNG:/, 'technische Details nur in cause');
  // Unbekannter Atlas (sources.js): Meldung bleibt, Art invalid
  const badAtlas = new Error('Unbekannter Atlas „x“ (erlaubt: blocks, items, entities).');
  assertHuman(toGameDataError(badAtlas), { kind: 'invalid', message: badAtlas.message });
  // Strukturnamen gibt es nicht mehr: so ein Fehler ist nichts Besonderes mehr (allgemeine Meldung)
  assertHuman(toGameDataError(new Error('Ungültiger Strukturname „x“.')), { kind: 'unknown', title: 'Spieldaten nicht nutzbar' });
  // GameDataError bleibt, wie er ist; Unbekanntes wird allgemein verständlich (Details in cause)
  assert.equal(toGameDataError(inner), inner);
  const odd = new TypeError('Cannot read properties of undefined (reading \'blocks\')');
  const unknown = toGameDataError(odd);
  assertHuman(unknown, { kind: 'unknown', title: 'Spieldaten nicht nutzbar' });
  assert.doesNotMatch(unknown.message, /undefined/);
  assert.equal(unknown.cause, odd);
  assertHuman(toGameDataError(undefined), { kind: 'unknown' });
  assertHuman(toGameDataError(new DOMException('weg', 'AbortError')), { kind: 'network', title: 'Laden abgebrochen' });
});

// ---------------------------------------------------------------------------------------------
// Fortschritt

test('Fortschritt: Stufe, deutscher Name, grober Gesamtanteil (nie rückwärts) und fertiger Text', async () => {
  const { source } = fakeSource();
  const { data, state } = remoteData(source);
  const events = [];
  const off = data.onProgress((event) => events.push(event));
  data.onProgress(() => { throw new Error('Anzeige kaputt'); });
  await data.loadNames();
  const emit = state.onProgress;
  assert.equal(typeof emit, 'function', 'die Quelle bekommt onProgress');
  emit({ stage: 'names', done: 0, total: 3 });
  emit({ stage: 'names', done: 1, total: 3 });
  emit({ stage: 'models', done: 0, total: 3 });
  emit({ stage: 'names', done: 3, total: 3 });
  emit({ stage: 'models', done: 2, total: 3 });
  emit({ stage: 'models', done: 3, total: 3 });
  assert.deepEqual(events.map((event) => event.stage), ['names', 'names', 'models', 'names', 'models', 'models']);
  assert.deepEqual(events.map((event) => event.label), ['Blocknamen', 'Blocknamen', 'Blockmodelle', 'Blocknamen', 'Blockmodelle', 'Blockmodelle']);
  assert.deepEqual(Object.keys(events[0]), ['stage', 'label', 'done', 'total', 'share', 'text']);
  const shares = events.map((event) => event.share);
  assert.equal(shares[0], 0);
  assert.ok(Math.abs(shares[1] - 1 / 3) < 1e-9, 'eine Stufe: Anteil wie done/total');
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i] >= shares[i - 1], `nie rückwärts: ${shares.join(', ')}`);
  assert.ok(shares[4] < 1, 'noch nicht fertig');
  assert.equal(shares.at(-1), 1, 'alles fertig → 100 %');
  assert.equal(events[0].text, 'Spieldaten von GitHub laden (einmalig) … 0 %');
  assert.equal(events[1].text, 'Spieldaten von GitHub laden (einmalig) … 33 %');
  assert.equal(events.at(-1).text, 'Spieldaten von GitHub laden (einmalig) … 100 %');
  for (const event of events) assert.doesNotMatch(event.text, COMMAND_PATTERN);
  // Danach (alles fertig) eine neue Stufe, z. B. die Blockfarben: neuer Ladevorgang ab 0, gleicher Text; ein altes Feld
  // file wird nicht weitergegeben
  emit({ stage: 'block-colors', done: 0, total: 2 });
  emit({ stage: 'block-colors', done: 1, total: 2, file: 'a__b.json' });
  assert.deepEqual(events.slice(-2).map((event) => [event.share, event.text, event.label, 'file' in event]), [
    [0, 'Spieldaten von GitHub laden (einmalig) … 0 %', 'Blockfarben', false],
    [0.5, 'Spieldaten von GitHub laden (einmalig) … 50 %', 'Blockfarben', false],
  ]);
  // Unbekannte oder kaputte Meldungen stören nicht; abgemeldet kommt nichts mehr
  emit(null);
  emit({ done: 1 });
  const count = events.length;
  off();
  emit({ stage: 'textures', done: 1, total: 2 });
  assert.equal(events.length, count);
  assert.throws(() => data.onProgress('kein Empfänger'), TypeError);
  assert.equal(typeof onGameDataProgress(() => {}), 'function', 'Standard-Zugang: Abmeldefunktion');
});

// ---------------------------------------------------------------------------------------------
// Echte remote.js über die Fassade (Standard-Quelle, dynamisch geladen) mit den Fake-Daten

const SHA_TO_KEY = new Map(Object.entries(MCMETA_COMMITS).map(([key, sha]) => [sha, key]));

test('Standard-Quelle: remote.js über die Fassade (Fake-Daten, Fake-fetch), Fortschritt mit deutschen Namen', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const text = String(url);
    requests.push(text);
    assert.equal(init.method, 'GET');
    assert.equal(init.credentials, 'omit');
    if (!text.startsWith(MCMETA_BASE)) return new Response('Nicht gefunden', { status: 404 });
    const rest = text.slice(MCMETA_BASE.length);
    const key = SHA_TO_KEY.get(rest.slice(0, rest.indexOf('/')));
    try {
      return new Response(await readFile(path.join(MINI, key, ...rest.slice(rest.indexOf('/') + 1).split('/'))));
    } catch {
      return new Response('Nicht gefunden', { status: 404 });
    }
  };
  try {
    const data = createGameData({ location: { hostname: 'jason-z-tech.github.io' }, persist: () => {} });
    const events = [];
    data.onProgress((event) => events.push(event));
    const names = await data.loadNames();
    assert.equal(names.block.stone.de, 'Stein');
    assert.equal(await data.loadNames(), names, 'einmal je Kontext (gleiches Objekt)');
    const textures = await data.loadTextures();
    assert.equal(textures.json.entries['block/stone'].atlas, 'blocks');
    const store = TextureStore.fromSource(textures);
    assert.equal((await store.image('block/stone')).width, 16);
    assert.ok(requests.length > 5);
    assert.ok(!requests.some((url) => url.includes('/structure/')), 'keine Strukturdateien');
    assert.ok(requests.every((url) => url.startsWith(MCMETA_BASE)), 'nur misode/mcmeta, nie game-data/');
    assert.ok(events.some((event) => event.stage === 'names' && event.label === 'Blocknamen'));
    assert.ok(events.some((event) => event.stage === 'atlas:blocks' && event.label === 'Block-Texturen'));
    assert.ok(events.every((event) => event.share >= 0 && event.share <= 1 && /… \d{1,3} %$/.test(event.text)));
  } finally {
    globalThis.fetch = original;
  }
});

test('Standard-Zugang: loadGameNames in Node (ohne location) geht online an GitHub und meldet Fehler menschlich', async () => {
  const original = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return new Response('Nicht gefunden', { status: 404 });
  };
  try {
    await assert.rejects(loadGameNames(), (error) => assertHuman(error, { kind: 'missing', title: 'Spieldaten nicht gefunden' }) ?? true);
    assert.ok(seen.length > 0 && seen.every((url) => url.startsWith(MCMETA_BASE)), seen.join(', '));
  } finally {
    globalThis.fetch = original;
  }
});
