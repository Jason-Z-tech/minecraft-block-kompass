// Remote-Pipeline js/data/remote.js („Weg A“, Bauplan Etappe 2): Spieldaten aus misode/mcmeta im Format von game-data/.
// (a) kleine Fake-Daten (tests/fixtures/mcmeta-mini/, node tests/fixtures/mcmeta-mini/make-fixtures.mjs) und Fake-fetch:
//     Formate, Zwischenspeicher, Sperren, Fehler, Fortschritt.
// (b) Gleichheit mit game-data/ über den Spiegel tmp/mcmeta-mirror/ (node scripts/mirror-mcmeta.mjs), sonst übersprungen.
// (c) dasselbe im echten Chrome über den Testserver (sources.js zeigt auf /__mcmeta/), zweiter Durchlauf aus IndexedDB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteSource, STORE_PREFIX, STAGE_LABELS } from '../../js/data/remote.js';
import * as net from '../../js/data/net.js';
import { createStore, withLock, STORE_VERSION } from '../../js/data/store.js';
import { MCMETA_BASE, MCMETA_COMMITS, LIMITS, ATLASES } from '../../js/data/sources.js';
import * as convert from '../../js/data/convert.js';
import { BLOCK_COLORS_FORMAT } from '../../js/create/voxelize/colors.js';
import { TextureStore, decodePng, cropImage } from '../../js/render/texture-store.js';
import { decodePng as decodePngSync } from '../../scripts/lib/png.mjs';
import { mirrorFilePath } from '../../scripts/mirror-mcmeta.mjs';
import { mirrorAvailable, mirrorOverrides, MIRROR_PREFIX } from '../lib/mcmeta-mirror.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MINI = path.join(ROOT, 'tests', 'fixtures', 'mcmeta-mini');
const MIRROR = path.join(ROOT, 'tmp', 'mcmeta-mirror');
const GAME_DATA = path.join(ROOT, 'game-data');
const SHA_TO_KEY = new Map(Object.entries(MCMETA_COMMITS).map(([key, sha]) => [sha, key]));
const COLORMAPS = ['colormap/dry_foliage', 'colormap/foliage', 'colormap/grass'];
// Vergleichbarer Teil eines textures.json-Eintrags (ohne Lage o/l bzw. atlas/x/y)
const textureShape = ({ w, h, anim, mip }) => JSON.stringify([w, h, anim, mip]);

// ---------------------------------------------------------------------------------------------
// Hilfen

// Adresse → { key, sha, path } (nur MCMETA_BASE/<bekannter SHA>/<pfad>)
function locate(url) {
  if (typeof url !== 'string' || !url.startsWith(MCMETA_BASE)) return null;
  const rest = url.slice(MCMETA_BASE.length);
  const slash = rest.indexOf('/');
  const key = SHA_TO_KEY.get(rest.slice(0, slash));
  return key ? { key, sha: rest.slice(0, slash), path: rest.slice(slash + 1) } : null;
}

/**
 * Fake-Netz über die echten net.js-Funktionen mit ausgetauschtem fetch (ohne Wiederholungen).
 * layout 'key': <root>/<Commit-Schlüssel>/<pfad> (Fake-Daten) · 'sha': Spiegel <root>/<SHA>/<pfad>.
 * respond(where, url) → Response | null (eigene Antwort, z. B. Fehler); offline: true → Netzfehler.
 * requests: ['<schlüssel>/<pfad>', …] in Aufrufreihenfolge; limits: pfad → maxBytes.
 */
function fakeNet({ root = MINI, layout = 'key', respond = null } = {}) {
  const state = { requests: [], limits: new Map(), offline: false };
  const fetch = async (url, init) => {
    const where = locate(url);
    state.requests.push(where ? `${where.key}/${where.path}` : url);
    assert.equal(init.method, 'GET');
    if (state.offline) throw new TypeError('fetch failed');
    const custom = respond?.(where, url);
    if (custom) return custom;
    if (!where) return new Response('Nicht gefunden', { status: 404 });
    const file = layout === 'key' ? path.join(root, where.key, ...where.path.split('/')) : mirrorFilePath(root, where.sha, where.path);
    let body;
    try {
      body = await readFile(file);
    } catch {
      return new Response('Nicht gefunden', { status: 404 });
    }
    return new Response(body, { status: 200 });
  };
  const options = (url, opts) => {
    const where = locate(url);
    if (where) state.limits.set(`${where.key}/${where.path}`, opts.maxBytes);
    return { ...opts, fetch, retries: 0 };
  };
  state.fetchJson = (url, opts) => net.fetchJson(url, options(url, opts));
  state.fetchBytes = (url, opts) => net.fetchBytes(url, options(url, opts));
  return state;
}

// Gemeinsame Web-Locks-Nachbildung für mehrere Quellen (wie Tabs und Worker desselben Ursprungs)
function fakeLocks() {
  const queues = new Map();
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    request(name, fn) {
      requests++;
      const run = (queues.get(name) ?? Promise.resolve()).then(() => fn());
      queues.set(name, run.catch(() => {}));
      return run;
    },
  };
}

const memoryStore = () => createStore({ indexedDB: null });

function miniSource({ network = fakeNet(), store = memoryStore(), ...rest } = {}) {
  return createRemoteSource({ fetchJson: network.fetchJson, fetchBytes: network.fetchBytes, store, ...rest });
}

const readMini = (key, file) => readFileSync(path.join(MINI, key, ...file.split('/')));
const count = (list, item) => list.filter((entry) => entry === item).length;

// Erwartete Ergebnisse der Fake-Daten (von Hand geprüft, siehe make-fixtures.mjs)
const MINI_NAMES = {
  block: {
    glass: { de: 'Glas', en: 'Glass' },
    oak_planks: { de: 'Eichenholzbretter', en: 'Oak Planks' },
    oak_stairs: { de: 'Eichenholztreppe', en: 'Oak Stairs' },
    sea_lantern: { de: 'Seelaterne', en: null },
    stone: { de: 'Stein', en: 'Stone' },
  },
  item: { stick: { de: 'Stock', en: 'Stick' } },
};
const MINI_TEXTURES = {
  version: '26.2',
  entries: {
    'block/dirt': { atlas: 'blocks', x: 0, y: 16, w: 16, h: 16, anim: null },
    'block/glass': { atlas: 'blocks', x: 16, y: 0, w: 16, h: 16, anim: null, mip: 'mean' },
    'block/oak_planks': { atlas: 'blocks', x: 32, y: 0, w: 16, h: 16, anim: null },
    'block/sea_lantern': {
      atlas: 'blocks', x: 48, y: 0, w: 16, h: 64, anim: { fw: 16, fh: 16, frames: [[0, 5], [1, 5], [2, 5], [3, 5]], interpolate: false },
    },
    'block/stone': { atlas: 'blocks', x: 0, y: 0, w: 16, h: 16, anim: null },
    'entity/chest/normal': { atlas: 'entities', x: 0, y: 0, w: 32, h: 32, anim: null },
    'item/apple': { atlas: 'items', x: 16, y: 0, w: 16, h: 16, anim: null },
    'item/stick': { atlas: 'items', x: 0, y: 0, w: 16, h: 16, anim: null },
  },
};
// 3 × 2 × 2: Treppe mit Standardwerten ergänzt, Jigsaw → sea_lantern, fremder/unbekannter Block → Luft
const MINI_STRUCTURE = {
  path: 'mini/house',
  size: [3, 2, 2],
  palette: ['air', 'stone', 'oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]', 'glass', 'sea_lantern'],
  rle: [1, 4, 3, 1, 1, 1, 2, 1, 0, 4, 4, 1],
};

// ---------------------------------------------------------------------------------------------
// (a) Fake-Daten

test('Speicher-Schlüssel: v<STORE_VERSION>.<CONVERT_VERSION>.<Blockfarben-Format>|<je 7 Zeichen aller Commits>|<Stufe>, Stufen-Namen auf Deutsch', () => {
  assert.equal(STORE_PREFIX, `v${STORE_VERSION}.${convert.CONVERT_VERSION}.${BLOCK_COLORS_FORMAT}|${Object.values(MCMETA_COMMITS).map((sha) => sha.slice(0, 7)).join('.')}|`);
  assert.match(STORE_PREFIX, /^v\d+\.\d+\.\d+\|[0-9a-f]{7}(?:\.[0-9a-f]{7}){4}\|$/);
  for (const stage of ['names', 'blocks', 'models', 'textures', 'atlas:blocks', 'structure', 'block-colors']) {
    assert.equal(typeof STAGE_LABELS[stage], 'string', stage);
  }
  assert.ok(Object.isFrozen(STAGE_LABELS));
});

test('Fake-Daten: names, blocks, models, textures, atlas und structure im Format von game-data/', async () => {
  const network = fakeNet();
  const source = miniSource({ network });

  const names = await source.names();
  assert.deepEqual(names, MINI_NAMES, 'BOM in de_de.json übersprungen, nur block.minecraft.<id>/item.minecraft.<id>');
  assert.equal(Object.getPrototypeOf(names.block), Object.prototype, 'Objekte wie JSON.parse von game-data/');

  const blocks = await source.blocks();
  assert.deepEqual(Object.keys(blocks), ['version', 'source', 'ref', 'blocks'], 'Feldreihenfolge wie game-data/blocks.json');
  assert.equal(blocks.version, '26.2');
  assert.equal(blocks.source, 'mcmeta');
  assert.equal(blocks.ref, 'misode/mcmeta@26.2-summary');
  assert.equal(Object.keys(blocks.blocks).length, 506);
  assert.deepEqual(blocks.blocks.oak_stairs.default, { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' });
  assert.deepEqual(blocks.blocks.stone, { props: {}, default: {} });

  const models = await source.models();
  assert.deepEqual(Object.keys(models), ['version', 'textures', 'models', 'blocks']);
  assert.deepEqual(models.textures, ['block/glass', 'block/oak_planks', 'block/sea_lantern', 'block/stone']);
  assert.deepEqual(Object.keys(models.blocks), ['glass', 'oak_planks', 'oak_stairs', 'sea_lantern', 'stone']);
  assert.equal(models.models.find((model) => model.name === 'block/oak_stairs').elements.length, 2);
  // Gegenprobe: dieselbe Rechnung wie scripts/extract-game-data.mjs direkt auf den Fake-Dateien
  const warnings = convert.createWarnings();
  const assets = convert.createAssetsFromSummary({
    blockstates: JSON.parse(readMini('summary', 'assets/block_definition/data.min.json')),
    models: JSON.parse(readMini('summary', 'assets/model/data.min.json')),
    textureNames: ATLASES.flatMap((atlas) => Object.keys(JSON.parse(readMini('atlas', `${atlas}/data.min.json`)))),
  });
  const direct = convert.buildModels({ assets, blockstates: convert.loadBlockstates(assets, warnings), blocks: blocks.blocks, warnings }).data;
  assert.equal(JSON.stringify(models), JSON.stringify(direct));

  const textures = await source.textures();
  assert.deepEqual(textures, MINI_TEXTURES, 'Colormaps und entity/pig/pig fehlen, anim/mip aus den .png.mcmeta');
  assert.equal(JSON.stringify(textures), JSON.stringify(MINI_TEXTURES), 'Feld- und Schlüsselreihenfolge');
  const mcmeta = network.requests.filter((request) => request.endsWith('.png.mcmeta')).sort();
  assert.deepEqual(mcmeta, [
    'assets/assets/minecraft/textures/block/glass.png.mcmeta',
    'assets/assets/minecraft/textures/block/sea_lantern.png.mcmeta',
  ], 'nur die gebrauchten .png.mcmeta aus MCMETA_TEXTURES');

  const atlas = await source.atlas('blocks');
  assert.ok(atlas instanceof Uint8Array);
  assert.deepEqual(Buffer.from(atlas), readMini('atlas', 'blocks/atlas.png'));
  atlas.fill(0);
  assert.deepEqual(Buffer.from(await source.atlas('blocks')), readMini('atlas', 'blocks/atlas.png'), 'jeder Aufruf bekommt eine eigene Kopie');

  // Der TextureStore nimmt die Einträge im Atlas-Modus an und schneidet die richtigen Pixel aus.
  const store = TextureStore.fromSource({ json: textures, atlas: (name) => source.atlas(name) });
  assert.equal(store.mode, 'atlas');
  const stone = await store.image('block/stone');
  assert.deepEqual([stone.width, stone.height, ...stone.data.subarray(0, 4)], [16, 16, 120, 120, 120, 255]);
  const lantern = await store.image('block/sea_lantern');
  assert.deepEqual([lantern.width, lantern.height, ...lantern.data.subarray(16 * 16 * 4 * 3, 16 * 16 * 4 * 3 + 4)], [16, 64, 200, 230, 220, 255]);
  const chest = await store.image('entity/chest/normal');
  assert.deepEqual([...chest.data.subarray(0, 4)], [150, 110, 40, 255]);

  const structure = await source.structure('mini__house.json');
  assert.deepEqual(structure, MINI_STRUCTURE);
  assert.equal(JSON.stringify(structure), JSON.stringify(MINI_STRUCTURE));
});

test('Fake-Daten: blockColors aus den Atlanten (ganze Würfel, Animation gemittelt), Modelle bleiben unverändert', async () => {
  const network = fakeNet();
  const source = miniSource({ network });
  const modelsBefore = JSON.stringify(await source.models());
  const colors = await source.blockColors();
  assert.deepEqual(Object.keys(colors), ['format', 'version', 'generatedAt', 'count', 'blocks']);
  assert.equal(colors.version, '26.2');
  assert.match(colors.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(Object.keys(colors.blocks), ['oak_planks', 'sea_lantern', 'stone'], 'Glas (durchsichtig) und Treppe (kein Würfel) fehlen');
  assert.equal(colors.count, 3);
  assert.deepEqual(colors.blocks.stone.top.rgb, [120, 120, 120]);
  assert.deepEqual(colors.blocks.oak_planks.side.rgb, [160, 120, 70]);
  assert.equal(colors.blocks.sea_lantern.animated, true);
  assert.equal(colors.blocks.sea_lantern.emissive, true);
  assert.deepEqual(colors.blocks.sea_lantern.all.rgb, [185, 215, 205], 'Mittel über alle 4 Frames');
  assert.equal(JSON.stringify(await source.models()), modelsBefore);
  assert.equal(count(network.requests, 'atlas/blocks/atlas.png'), 1);
  assert.equal(count(network.requests, 'atlas/items/atlas.png'), 0, 'nur Atlanten mit gebrauchten Texturen');
});

test('Fake-Daten: Größengrenzen aus sources.js je Dateiart', async () => {
  const network = fakeNet();
  const source = miniSource({ network });
  await Promise.all([source.names(), source.textures(), source.atlas('entities'), source.structure('mini__house.json')]);
  const limits = Object.fromEntries(network.limits);
  assert.equal(limits['summary/version.json'], LIMITS.json);
  assert.equal(limits['summary/blocks/data.min.json'], LIMITS.json);
  assert.equal(limits['summary/assets/model/data.min.json'], LIMITS.json);
  assert.equal(limits['summary/assets/block_definition/data.min.json'], LIMITS.json);
  assert.equal(limits['atlas/items/data.min.json'], LIMITS.json);
  assert.equal(limits['atlas/entities/atlas.png'], LIMITS.png);
  assert.equal(limits['assetsJson/assets/minecraft/lang/de_de.json'], LIMITS.lang);
  assert.equal(limits['assets/assets/minecraft/textures/block/sea_lantern.png.mcmeta'], LIMITS.mcmeta);
  assert.equal(limits['data/data/minecraft/structure/mini/house.nbt'], LIMITS.nbt);
});

test('Zwischenspeicher: zweiter Aufruf ohne fetch, neue Quelle mit demselben Speicher ebenso; isCached', async () => {
  const network = fakeNet();
  const store = memoryStore();
  const first = miniSource({ network, store });
  assert.equal(await first.isCached('models'), false);
  assert.equal(await first.isCached('atlas:blocks'), false);
  assert.equal(await first.isCached('structure:mini__house.json'), false);
  const loadAll = (source) => Promise.all([
    source.names(), source.blocks(), source.models(), source.textures(), source.atlas('blocks'),
    source.structure('mini__house.json'), source.blockColors(),
  ]);
  const results = await loadAll(first);
  const downloads = network.requests.length;
  assert.equal(downloads, 13, `je Datei genau ein Download: ${network.requests.join(', ')}`);
  assert.equal(new Set(network.requests).size, downloads);

  // gleiche Quelle: alles aus dem Arbeitsspeicher (gleiche Objekte)
  const again = await loadAll(first);
  assert.equal(network.requests.length, downloads);
  for (const [index, value] of again.entries()) {
    if (index !== 4) assert.equal(value, results[index], 'gleiches Objekt');
  }
  for (const name of ['names', 'blocks', 'models', 'textures', 'atlas:blocks', 'structure:mini__house.json', 'block-colors']) {
    assert.equal(await first.isCached(name), true, name);
  }
  assert.equal(await first.isCached('atlas:items'), false);

  // neue Quelle (z. B. nach dem Neuladen): aus dem Speicher, kein Download, gleicher Inhalt
  const second = miniSource({ network, store });
  assert.equal(await second.isCached('models'), true);
  const fromStore = await loadAll(second);
  assert.equal(network.requests.length, downloads, 'kein einziger Download');
  for (const [index, value] of fromStore.entries()) {
    if (index === 4) assert.deepEqual(Buffer.from(value), Buffer.from(results[4]));
    else assert.equal(JSON.stringify(value), JSON.stringify(results[index]));
  }
  // gespeichert als JSON-Text bzw. PNG-Bytes unter dem Präfix
  assert.equal(typeof await store.get(`${STORE_PREFIX}models`), 'string');
  assert.ok((await store.get(`${STORE_PREFIX}atlas:blocks`)) instanceof Uint8Array);
  assert.equal(typeof await store.get(`${STORE_PREFIX}structure:mini__house.json`), 'string');
});

test('Gleichzeitige Aufrufe: im selben Kontext und über zwei Quellen mit gemeinsamer Sperre je Datei ein Download', async () => {
  const network = fakeNet();
  const source = miniSource({ network });
  const results = await Promise.all([source.models(), source.models(), source.textures(), source.textures(), source.blocks(), source.names(), source.names()]);
  assert.equal(results[0], results[1]);
  assert.equal(results[2], results[3]);
  assert.equal(new Set(network.requests).size, network.requests.length, network.requests.join(', '));
  assert.equal(count(network.requests, 'summary/blocks/data.min.json'), 1);

  // Zwei Kontexte (Seite und Worker): eigener Arbeitsspeicher, gemeinsamer Speicher, gemeinsame Web Locks
  const shared = fakeNet();
  const store = memoryStore();
  const locks = fakeLocks();
  const lock = (name, fn) => withLock(name, fn, { locks });
  const page = miniSource({ network: shared, store, withLock: lock });
  const worker = miniSource({ network: shared, store, withLock: lock });
  const both = await Promise.all([
    page.models(), worker.models(), worker.blocks(), page.textures(), worker.textures(),
    page.structure('mini__house.json'), worker.structure('mini__house.json'),
  ]);
  assert.equal(JSON.stringify(both[0]), JSON.stringify(both[1]));
  assert.equal(JSON.stringify(both[3]), JSON.stringify(both[4]));
  assert.deepEqual(both[5], MINI_STRUCTURE);
  assert.deepEqual(both[6], MINI_STRUCTURE);
  assert.equal(new Set(shared.requests).size, shared.requests.length, `doppelt geladen: ${shared.requests.join(', ')}`);
  assert.equal(shared.requests.length, 10);
  assert.ok(locks.requests > 0, 'die Sperre wurde benutzt');
});

test('Versionsfehler: version.json passt nicht → klare Meldung, nichts gespeichert, später neuer Versuch', async () => {
  let wrongVersion = true;
  const network = fakeNet({
    respond: (where) => (wrongVersion && where?.path === 'version.json'
      ? new Response(JSON.stringify({ id: '26.1', data_version: 4800 }), { status: 200 })
      : null),
  });
  const store = memoryStore();
  const source = miniSource({ network, store });
  const error = await source.blocks().then(() => null, (failure) => failure);
  assert.ok(error instanceof net.NetError);
  assert.equal(error.kind, 'format');
  assert.equal(error.message, 'Die Spieldaten auf GitHub passen nicht zu Minecraft Java 26.2 (gefunden: Version „26.1“, Datenversion 4800, erwartet: Datenversion 4903).');
  assert.doesNotMatch(error.message, /node |npm |scripts\//, 'keine Befehle in der Meldung');
  await assert.rejects(source.models(), (failure) => failure.kind === 'format' && /passen nicht/.test(failure.message));
  await assert.rejects(source.structure('mini__house.json'), /passen nicht/);
  assert.equal(await store.get(`${STORE_PREFIX}blocks`), undefined);
  assert.equal(await store.get(`${STORE_PREFIX}models`), undefined);
  wrongVersion = false;
  assert.equal(Object.keys((await source.models()).blocks).length, 5, 'Fehler nicht gemerkt');
});

test('Strukturen: 404, ungültige Namen und unbekannte Atlanten/Stufen', async () => {
  const network = fakeNet();
  const source = miniSource({ network });
  const missing = await source.structure('mini__gibt_es_nicht.json').then(() => null, (failure) => failure);
  assert.ok(missing instanceof net.NetError);
  assert.equal(missing.kind, 'http');
  assert.equal(missing.status, 404);
  assert.equal(missing.message, 'Die Spieldaten-Datei „gibt_es_nicht.nbt“ wurde nicht gefunden (404).');
  assert.ok(network.requests.includes('data/data/minecraft/structure/mini/gibt_es_nicht.nbt'));

  const before = network.requests.length;
  for (const bad of ['../geheim.json', 'mini/house.json', 'mini__house', 'Mini__House.json', 'mini__house.json?x=1', '', 42, null]) {
    await assert.rejects(source.structure(bad), /Ungültiger Strukturname/, String(bad));
  }
  await assert.rejects(source.atlas('gui'), /Unbekannter Atlas „gui“/);
  await assert.rejects(source.atlas('__proto__'), /Unbekannter Atlas/);
  await assert.rejects(source.isCached('quatsch'), TypeError);
  await assert.rejects(source.isCached('structure:../x.json'), TypeError);
  await assert.rejects(source.isCached('atlas:gui'), TypeError);
  assert.equal(network.requests.length, before, 'ungültige Namen lösen keinen Download aus');
});

test('Fehler werden nicht gemerkt: Netz weg → NetError, danach klappt derselbe Aufruf', async () => {
  const network = fakeNet();
  const store = memoryStore();
  const source = miniSource({ network, store });
  network.offline = true;
  const error = await source.names().then(() => null, (failure) => failure);
  assert.ok(error instanceof net.NetError);
  assert.equal(error.kind, 'network');
  assert.match(error.message, /Keine Verbindung zu GitHub\. Prüfe die Internetverbindung/);
  await assert.rejects(source.atlas('blocks'), (failure) => failure.kind === 'network');
  assert.equal(await source.isCached('names'), false);
  network.offline = false;
  assert.deepEqual(await source.names(), MINI_NAMES);
  assert.ok((await source.atlas('blocks')) instanceof Uint8Array);
  assert.equal(await source.isCached('names'), true);
});

test('Beschädigte Dateien → NetError „format“ mit menschlicher Meldung; Unbrauchbares im Speicher wird ersetzt', async () => {
  const broken = new Map([
    ['atlas/blocks/atlas.png', () => new Response('kein Bild', { status: 200 })],
    ['data/data/minecraft/structure/mini/house.nbt', () => new Response(new Uint8Array([0x1f, 0x8b, 8, 0, 1, 2, 3]), { status: 200 })],
    ['atlas/items/data.min.json', () => new Response('{"item/stick":[1,2]}', { status: 200 })],
  ]);
  const network = fakeNet({ respond: (where) => (where && broken.has(`${where.key}/${where.path}`) ? broken.get(`${where.key}/${where.path}`)() : null) });
  const store = memoryStore();
  const source = miniSource({ network, store });
  await assert.rejects(source.atlas('blocks'), (error) => error instanceof net.NetError && error.kind === 'format'
    && /^Der Textur-Atlas „blocks“ ist beschädigt oder hat ein unerwartetes Format \(keine PNG-Datei\)\.$/.test(error.message));
  await assert.rejects(source.structure('mini__house.json'), (error) => error.kind === 'format'
    && /^Die Struktur „mini\/house“ ist beschädigt/.test(error.message) && error.cause?.name === 'NbtError');
  await assert.rejects(source.models(), (error) => error.kind === 'format' && /„data\.min\.json“ ist beschädigt.*item\/stick/.test(error.message));
  await assert.rejects(source.textures(), (error) => error.kind === 'format');

  const small = fakeNet({ respond: (where) => (where?.path === 'blocks/data.min.json' && where.key === 'summary'
    ? new Response('{"stone":[{},{}]}', { status: 200 }) : null) });
  await assert.rejects(miniSource({ network: small }).blocks(), (error) => error.kind === 'format'
    && /^Die Blockliste ist beschädigt oder hat ein unerwartetes Format \(Blockbericht ist unvollständig\)\.$/.test(error.message));

  // Kaputte Einträge im Speicher (andere Form, abgeschnittener Text) gelten als „nicht da“ und werden neu erzeugt.
  const repairStore = memoryStore();
  await repairStore.put(`${STORE_PREFIX}names`, '{"block":');
  await repairStore.put(`${STORE_PREFIX}atlas:blocks`, new Uint8Array([1, 2, 3]));
  await repairStore.put(`${STORE_PREFIX}blocks`, { schon: 'Objekt' });
  const repair = miniSource({ store: repairStore });
  assert.equal(await repair.isCached('names'), false);
  assert.deepEqual(await repair.names(), MINI_NAMES);
  assert.deepEqual(Buffer.from(await repair.atlas('blocks')), readMini('atlas', 'blocks/atlas.png'));
  assert.equal((await repair.blocks()).source, 'mcmeta');
  assert.equal(await repairStore.get(`${STORE_PREFIX}names`), JSON.stringify(MINI_NAMES));
});

test('Speicherfehler (get/put/keepOnly) verhindern kein Ergebnis', async () => {
  const network = fakeNet();
  const failing = {
    get: async () => {
      throw new Error('IndexedDB kaputt');
    },
    put: async () => {
      throw new DOMException('voll', 'QuotaExceededError');
    },
    keepOnly: () => {
      throw new Error('auch kaputt');
    },
  };
  const source = miniSource({ network, store: failing });
  assert.deepEqual(await source.names(), MINI_NAMES);
  assert.deepEqual(await source.structure('mini__house.json'), MINI_STRUCTURE);
  assert.equal(await source.isCached('names'), true, 'im Arbeitsspeicher der Quelle');
  const downloads = network.requests.length;
  await source.names();
  assert.equal(network.requests.length, downloads);
  assert.equal(await source.isCached('models'), false);
});

test('Fortschritt: onProgress({ stage, done, total }) nur beim echten Laden, Fehler im Empfänger stören nicht', async () => {
  const network = fakeNet();
  const store = memoryStore();
  const events = [];
  const source = miniSource({ network, store, onProgress: (event) => events.push(event) });
  await source.names();
  assert.deepEqual(events, [
    { stage: 'names', done: 0, total: 3 }, { stage: 'names', done: 1, total: 3 },
    { stage: 'names', done: 2, total: 3 }, { stage: 'names', done: 3, total: 3 },
  ]);
  events.length = 0;
  await Promise.all([source.textures(), source.structure('mini__house.json'), source.atlas('items')]);
  const stages = [...new Set(events.map((event) => event.stage))].sort();
  assert.deepEqual(stages, ['atlas-data', 'atlas:items', 'blocks', 'models', 'structure', 'textures']);
  for (const stage of stages) {
    const list = events.filter((event) => event.stage === stage);
    assert.equal(list[0].done, 0, stage);
    assert.equal(list.at(-1).done, list.at(-1).total, stage);
    assert.ok(list.every((event, i) => event.done <= event.total && (i === 0 || event.done >= list[i - 1].done)), stage);
  }
  assert.deepEqual(events.filter((event) => event.stage === 'textures').map((event) => `${event.done}/${event.total}`), ['0/3', '1/3', '2/3', '3/3']);
  assert.ok(events.filter((event) => event.stage === 'structure').every((event) => event.file === 'mini__house.json'));

  // aus dem Speicher: keine Fortschrittsmeldungen
  const quiet = [];
  const cached = miniSource({ network, store, onProgress: (event) => quiet.push(event) });
  await Promise.all([cached.names(), cached.textures(), cached.structure('mini__house.json')]);
  assert.deepEqual(quiet, []);

  // Ein Empfänger, der wirft, bricht nichts ab.
  const loud = miniSource({ onProgress: () => {
    throw new Error('Anzeige kaputt');
  } });
  assert.deepEqual(await loud.names(), MINI_NAMES);
});

test('keepOnly beim ersten Zugriff: alte Versionen und Commits verschwinden, eigene Einträge bleiben', async () => {
  const store = memoryStore();
  await store.put('v0|1111111.2222222.3333333.4444444.5555555|models', 'alt');
  await store.put(`v${STORE_VERSION}|aaaaaaa.bbbbbbb.ccccccc.ddddddd.eeeeeee|names`, 'anderer Commit');
  await store.put('fremd', 'weg damit');
  await store.put(`${STORE_PREFIX}names`, JSON.stringify(MINI_NAMES));
  let keepOnlyCalls = 0;
  const counting = { ...store, keepOnly: (prefix) => {
    keepOnlyCalls++;
    return store.keepOnly(prefix);
  } };
  const network = fakeNet();
  const source = miniSource({ network, store: counting });
  assert.deepEqual(await source.names(), MINI_NAMES);
  assert.equal(network.requests.length, 0, 'names kam aus dem Speicher');
  assert.equal(await store.get('v0|1111111.2222222.3333333.4444444.5555555|models'), undefined);
  assert.equal(await store.get(`v${STORE_VERSION}|aaaaaaa.bbbbbbb.ccccccc.ddddddd.eeeeeee|names`), undefined);
  assert.equal(await store.get('fremd'), undefined);
  assert.equal(await store.get(`${STORE_PREFIX}names`), JSON.stringify(MINI_NAMES));
  await Promise.all([source.blocks(), source.isCached('models'), source.atlas('items')]);
  assert.equal(keepOnlyCalls, 1, 'nur einmal je Quelle');
});

// ---------------------------------------------------------------------------------------------
// (b) Gleichheit mit game-data/ (echter Spiegel)

const REAL_FILES = ['names.json', 'blocks.json', 'models.json', 'textures.json', 'textures.bin', 'block-colors.json', 'structures/index.json'];
const realSkip = !mirrorAvailable() ? 'Spiegel fehlt (node scripts/mirror-mcmeta.mjs)'
  : REAL_FILES.some((file) => !existsSync(path.join(GAME_DATA, file))) ? 'game-data/ fehlt (node scripts/extract-game-data.mjs --remote)' : false;
const readGameData = (file) => readFileSync(path.join(GAME_DATA, ...file.split('/')), 'utf8');
const catalogStructures = () => [...new Set(JSON.parse(readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8')).builds
  .map((build) => build.structure).filter(Boolean))].sort();

// Eine gemeinsame Quelle für alle Vergleiche (jede Stufe nur einmal rechnen); Zeiten je Stufe in ms.
let realContext = null;
function realSource() {
  if (!realContext) {
    const network = fakeNet({ root: MIRROR, layout: 'sha' });
    const store = memoryStore();
    realContext = { network, store, source: miniSource({ network, store }), timings: {} };
  }
  return realContext;
}
async function timed(label, task) {
  const { timings } = realSource();
  const started = performance.now();
  const result = await task();
  timings[label] ??= Math.round(performance.now() - started);
  return result;
}

test('Echte Daten: names, blocks und models JSON-identisch zu game-data/', { skip: realSkip, timeout: 120_000 }, async () => {
  const { source } = realSource();
  assert.equal(JSON.stringify(await timed('names', () => source.names())), readGameData('names.json'));
  assert.equal(JSON.stringify(await timed('blocks', () => source.blocks())), readGameData('blocks.json'));
  assert.equal(JSON.stringify(await timed('models', () => source.models())), readGameData('models.json'));
});

test('Echte Daten: textures wie game-data/textures.json (w, h, anim, mip) und pixelgleich zu textures.bin', { skip: realSkip, timeout: 180_000 }, async () => {
  const { source } = realSource();
  const textures = await timed('textures', () => source.textures());
  const local = JSON.parse(readGameData('textures.json'));
  assert.equal(textures.version, local.version);
  const expectedNames = Object.keys(local.entries).filter((name) => !COLORMAPS.includes(name));
  assert.equal(expectedNames.length, Object.keys(local.entries).length - 3, 'die drei Colormaps stehen in game-data/');
  assert.deepEqual(Object.keys(textures.entries), expectedNames, 'gleiche Namen in gleicher Reihenfolge, nur ohne Colormaps');
  const differences = [];
  for (const name of expectedNames) {
    const entry = textures.entries[name];
    const want = local.entries[name];
    const fields = ['atlas', 'x', 'y', 'w', 'h', 'anim', ...(entry.mip !== undefined ? ['mip'] : [])];
    if (JSON.stringify(Object.keys(entry)) !== JSON.stringify(fields)) differences.push(`${name}: Felder ${Object.keys(entry)}`);
    if (!ATLASES.includes(entry.atlas)) differences.push(`${name}: Atlas ${entry.atlas}`);
    if (textureShape(entry) !== textureShape(want)) differences.push(name);
  }
  assert.deepEqual(differences, []);
  assert.equal(TextureStore.fromSource({ json: textures, atlas: (name) => source.atlas(name) }).mode, 'atlas', 'TextureStore prüft alle Einträge');

  // Pixel: Ausschnitt aus dem Atlas = dekodiertes PNG aus textures.bin (auch die Farben durchsichtiger Pixel)
  const bin = readFileSync(path.join(GAME_DATA, 'textures.bin'));
  const atlases = new Map();
  for (const name of ATLASES) atlases.set(name, await timed(`atlas:${name}`, async () => decodePng(await source.atlas(name))));
  const pixelDifferences = [];
  for (const name of expectedNames) {
    const { atlas, x, y, w, h } = textures.entries[name];
    const { o, l } = local.entries[name];
    const want = decodePngSync(bin.subarray(o, o + l));
    const got = cropImage(atlases.get(atlas), x, y, w, h);
    if (got.width !== want.width || got.height !== want.height || Buffer.compare(Buffer.from(got.data), Buffer.from(want.data)) !== 0) {
      pixelDifferences.push(name);
    }
  }
  assert.deepEqual(pixelDifferences, [], `${expectedNames.length} Texturen geprüft`);
});

test('Echte Daten: alle Strukturen aus data/catalog.json JSON-identisch zu game-data/structures/', { skip: realSkip, timeout: 180_000 }, async () => {
  const { source } = realSource();
  const files = catalogStructures();
  assert.ok(files.length >= 200, `${files.length} Strukturen im Katalog`);
  const limit = net.createLimiter(8);
  const different = [];
  await timed('structures (alle Katalog-Strukturen)', () => Promise.all(files.map((file) => limit(async () => {
    const structure = await source.structure(file);
    if (JSON.stringify(structure) !== readGameData(`structures/${file}`)) different.push(file);
  }))));
  assert.deepEqual(different, [], `${files.length} Strukturen verglichen`);
});

test('Echte Daten: blockColors identisch zu game-data/block-colors.json (ohne generatedAt)', { skip: realSkip, timeout: 120_000 }, async () => {
  const { source } = realSource();
  const colors = await timed('block-colors', () => source.blockColors());
  const local = JSON.parse(readGameData('block-colors.json'));
  const strip = ({ generatedAt, ...rest }) => rest;
  assert.equal(typeof colors.generatedAt, 'string');
  assert.equal(JSON.stringify(strip(colors)), JSON.stringify(strip(local)));
});

test('Echte Daten: zweiter Durchlauf (neue Quelle, gleicher Speicher) ohne Download; Zeiten', { skip: realSkip, timeout: 120_000 }, async (t) => {
  const { network, store, source, timings } = realSource();
  // Falls die Tests oben übersprungen wurden: einmal alles laden.
  const sample = catalogStructures()[0];
  await Promise.all([source.names(), source.textures(), source.atlas('blocks'), source.structure(sample), source.blockColors()]);
  const downloads = network.requests.length;
  const second = miniSource({ network, store });
  const secondTimings = {};
  for (const [label, task] of [
    ['names', () => second.names()], ['blocks', () => second.blocks()], ['models', () => second.models()],
    ['textures', () => second.textures()], ['atlas:blocks', () => second.atlas('blocks')],
    [`structure:${sample}`, () => second.structure(sample)], ['block-colors', () => second.blockColors()],
  ]) {
    const started = performance.now();
    await task();
    secondTimings[label] = Math.round(performance.now() - started);
  }
  assert.equal(network.requests.length, downloads, 'kein Download beim zweiten Durchlauf');
  t.diagnostic(`Node, erste Ladung (Spiegel, Speicher im Arbeitsspeicher) ms: ${JSON.stringify(timings)}`);
  t.diagnostic(`Node, zweite Ladung aus dem Speicher ms: ${JSON.stringify(secondTimings)}`);
  t.diagnostic(`Downloads: ${downloads}`);
});

// ---------------------------------------------------------------------------------------------
// (c) im echten Chrome: Spiegel über den Testserver, IndexedDB und Web Locks

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const WORKER_SOURCE = `import { createRemoteSource } from '/js/data/remote.js';
import { createStore } from '/js/data/store.js';
self.onmessage = async ({ data }) => {
  try {
    const source = createRemoteSource({ store: createStore({ name: data.db }) });
    const [models, textures] = await Promise.all([source.models(), source.textures(), source.blocks()]);
    self.postMessage({ ok: true, result: { models: models.models.length, textures: Object.keys(textures.entries).length } });
  } catch (error) {
    self.postMessage({ ok: false, message: String(error && error.message || error) });
  }
};
`;

test('remote.js im echten Chrome: game-data-Format, zweiter Durchlauf nach Neuladen aus IndexedDB ohne Anfragen',
  { skip: realSkip, timeout: 240_000 }, async (t) => {
    const { launchBrowser } = await import('../browser.mjs');
    const { startServer } = await import('../../scripts/serve.mjs');
    let browser;
    try {
      browser = await launchBrowser({ gpu: 'swiftshader' });
    } catch (error) {
      if (/Kein Chrome/.test(error.message)) {
        t.skip(error.message);
        return;
      }
      throw error;
    }
    const mirror = mirrorOverrides();
    let mirrorRequests = 0;
    let gameDataRequests = 0;
    const mirrorPaths = [];
    const server = await startServer({
      port: 0,
      overrides: (pathname) => {
        if (pathname.startsWith(MIRROR_PREFIX)) {
          mirrorRequests++;
          mirrorPaths.push(pathname);
        }
        if (pathname.startsWith('/game-data')) gameDataRequests++;
        // Modul-Worker nur für diesen Test (wie engine-worker.js: eigener Kontext, gleiche Datenbank, gleiche Sperren)
        if (pathname === '/__remote-test-worker.js') return { status: 200, type: 'text/javascript; charset=utf-8', body: WORKER_SOURCE };
        return mirror(pathname);
      },
    });
    const file = catalogStructures()[0];
    const dbName = `block-kompass-remote-test-${process.pid}-${Date.now()}`;
    const run = () => browser.eval(`(async () => {
      const { createRemoteSource } = await import('/js/data/remote.js');
      const { createStore } = await import('/js/data/store.js');
      const { MCMETA_BASE } = await import('/js/data/sources.js');
      const store = createStore({ name: ${JSON.stringify(dbName)} });
      const stages = ['names', 'blocks', 'models', 'textures', 'atlas:blocks', ${JSON.stringify(`structure:${file}`)}];
      const probe = createRemoteSource({ store });
      const cachedBefore = {};
      for (const stage of stages) cachedBefore[stage] = await probe.isCached(stage);
      const progress = new Set();
      const source = createRemoteSource({ store, onProgress: (event) => progress.add(event.stage) });
      const timings = {};
      const time = async (label, task) => {
        const started = performance.now();
        const result = await task();
        timings[label] = Math.round(performance.now() - started);
        return result;
      };
      const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const hash = async (value) => hex(await crypto.subtle.digest('SHA-256',
        value instanceof Uint8Array ? value : new TextEncoder().encode(JSON.stringify(value))));
      const started = performance.now();
      const names = await time('names', () => source.names());
      const blocks = await time('blocks', () => source.blocks());
      const models = await time('models', () => source.models());
      const textures = await time('textures', () => source.textures());
      const atlas = await time('atlas:blocks', () => source.atlas('blocks'));
      const structure = await time('structure', () => source.structure(${JSON.stringify(file)}));
      timings.total = Math.round(performance.now() - started);
      return {
        base: MCMETA_BASE,
        backend: await store.backend(),
        cachedBefore,
        progress: [...progress].sort(),
        timings,
        hashes: {
          names: await hash(names), blocks: await hash(blocks), models: await hash(models),
          atlas: await hash(atlas), structure: await hash(structure),
        },
        textures: JSON.stringify(textures),
        samples: { stone: names.block.stone, stairs: blocks.blocks.oak_stairs.default, models: models.models.length },
      };
    })()`);
    try {
      await browser.goto(`${server.url}/index.html`);
      const before = mirrorRequests;
      gameDataRequests = 0;
      const first = await run();
      const firstRequests = mirrorRequests - before;
      assert.equal(first.base, MIRROR_PREFIX, 'sources.js zeigt auf den Spiegel');
      assert.equal(first.backend, 'indexeddb');
      assert.deepEqual(Object.values(first.cachedBefore), [false, false, false, false, false, false]);
      assert.deepEqual(first.progress, ['atlas-data', 'atlas:blocks', 'blocks', 'models', 'names', 'structure', 'textures']);
      const expectedHashes = {
        names: sha256(readGameData('names.json')),
        blocks: sha256(readGameData('blocks.json')),
        models: sha256(readGameData('models.json')),
        atlas: sha256(readFileSync(mirrorFilePath(MIRROR, MCMETA_COMMITS.atlas, 'blocks/atlas.png'))),
        structure: sha256(readGameData(`structures/${file}`)),
      };
      assert.deepEqual(first.hashes, expectedHashes);
      assert.deepEqual(first.samples.stone, { de: 'Stein', en: 'Stone' });
      assert.deepEqual(first.samples.stairs, { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' });
      const local = JSON.parse(readGameData('textures.json')).entries;
      const textures = JSON.parse(first.textures);
      const names = Object.keys(local).filter((name) => !COLORMAPS.includes(name));
      assert.deepEqual(Object.keys(textures.entries), names);
      const wrong = names.filter((name) => textureShape(textures.entries[name]) !== textureShape(local[name]));
      assert.deepEqual(wrong, []);
      assert.ok(firstRequests >= 100, `${firstRequests} Anfragen an den Spiegel beim ersten Mal`);

      // Neu laden (frischer JS-Kontext): alles aus IndexedDB, keine einzige Anfrage an den Spiegel
      await browser.reload();
      mirrorRequests = 0;
      const second = await run();
      assert.equal(mirrorRequests, 0, 'zweiter Durchlauf ohne Anfragen an /__mcmeta/');
      assert.deepEqual(Object.values(second.cachedBefore), [true, true, true, true, true, true]);
      assert.deepEqual(second.progress, [], 'kein Fortschritt, weil nichts geladen wird');
      assert.deepEqual(second.hashes, expectedHashes);
      assert.equal(second.textures, first.textures);
      assert.equal(gameDataRequests, 0, 'remote.js fragt nie nach game-data/');
      const ownErrors = browser.errors.filter((line) => /Content Security Policy|__mcmeta|js\/data\//.test(line));
      assert.deepEqual(ownErrors, []);
      t.diagnostic(`Chrome, erste Ladung (Spiegel, ${firstRequests} Anfragen) ms: ${JSON.stringify(first.timings)}`);
      t.diagnostic(`Chrome, zweite Ladung nach Neuladen (IndexedDB) ms: ${JSON.stringify(second.timings)}`);

      // Seite und Modul-Worker gleichzeitig auf einer frischen Datenbank: Web Locks + IndexedDB → jede Datei nur einmal
      mirrorPaths.length = 0;
      const sharedDb = `${dbName}-geteilt`;
      const together = await browser.eval(`(async () => {
        const { createRemoteSource } = await import('/js/data/remote.js');
        const { createStore } = await import('/js/data/store.js');
        const worker = new Worker('/__remote-test-worker.js', { type: 'module' });
        const fromWorker = new Promise((resolve) => {
          worker.onmessage = (event) => resolve(event.data);
          worker.onerror = (event) => resolve({ ok: false, message: event.message ?? 'Worker-Fehler' });
        });
        worker.postMessage({ db: ${JSON.stringify(sharedDb)} });
        const source = createRemoteSource({ store: createStore({ name: ${JSON.stringify(sharedDb)} }) });
        const [models, textures] = await Promise.all([source.models(), source.textures(), source.names()]);
        const workerResult = await fromWorker;
        worker.terminate();
        return { page: { models: models.models.length, textures: Object.keys(textures.entries).length }, worker: workerResult };
      })()`);
      assert.equal(together.worker.ok, true, together.worker.message);
      assert.deepEqual(together.worker.result, together.page);
      const twice = [...new Set(mirrorPaths)].filter((pathname) => mirrorPaths.indexOf(pathname) !== mirrorPaths.lastIndexOf(pathname));
      assert.deepEqual(twice, [], 'jede Datei nur einmal, obwohl Seite und Worker gleichzeitig laden');
      assert.ok(mirrorPaths.length >= 100, `${mirrorPaths.length} Anfragen`);
      assert.deepEqual(browser.errors.filter((line) => /Content Security Policy|__mcmeta|js\/data\/|__remote-test-worker/.test(line)), []);
    } finally {
      await browser.close();
      await server.close();
    }
  });

test('Scheitert eine .mcmeta (429), werden die übrigen abgebrochen; ein neuer Versuch startet sofort', async () => {
  let aborted = 0;
  let limited = true;
  const network = fakeNet({
    respond: (where, url) => {
      if (where?.key !== 'assets' || !limited) return null;
      if (/glass\.png\.mcmeta$/.test(where.path)) return new Response('zu viele', { status: 429 });
      return null;
    },
  });
  // Die zweite .mcmeta hängt, bis abgebrochen wird
  const slowFetch = network.fetchBytes;
  network.fetchBytes = (url, opts) => {
    if (limited && /sea_lantern\.png\.mcmeta$/.test(String(url))) {
      return new Promise((resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          aborted += 1;
          reject(opts.signal.reason);
        }, { once: true });
      });
    }
    return slowFetch(url, opts);
  };
  const source = miniSource({ network });
  const started = Date.now();
  await assert.rejects(source.textures(), (error) => error.kind === 'rate-limit' && /GitHub begrenzt/.test(error.message));
  assert.ok(Date.now() - started < 2000, 'die Meldung wartet nicht auf hängende Anfragen');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(aborted, 1, 'die hängende .mcmeta wurde abgebrochen');
  limited = false;
  assert.deepEqual(await source.textures(), MINI_TEXTURES, 'neuer Versuch klappt sofort');
});

test('Gespeicherte Blockfarben in altem Format gelten als „nicht da“', async () => {
  const store = memoryStore();
  const network = fakeNet();
  const first = await miniSource({ network, store }).blockColors();
  assert.equal(first.format, BLOCK_COLORS_FORMAT);
  await store.put(`${STORE_PREFIX}block-colors`, JSON.stringify({ ...first, format: BLOCK_COLORS_FORMAT - 1 }));
  const before = network.requests.length;
  const again = await miniSource({ network, store }).blockColors();
  assert.equal(again.format, BLOCK_COLORS_FORMAT, 'neu erzeugt statt das alte Format zu liefern');
  assert.ok(network.requests.length >= before, 'Atlanten kommen aus dem Speicher oder dem Netz');
});

// Wächter für CONVERT_VERSION (js/data/convert.js): Prüfsumme der umgewandelten Daten je Version. Ändert sich die Ausgabe
// der Umwandlung, behielten Besucher sonst veraltete Daten im Browser-Speicher. Dann CONVERT_VERSION erhöhen und hier die
// neue Prüfsumme für die neue Version eintragen (die alte Zeile darf bleiben).
const CONVERT_OUTPUT_SHA256 = Object.freeze({
  1: '59ff0a27bbb22753c902ce5a773c9d1a78b1ce062d58ecaf07bac6cccda38bf8',
});

test('Echte Daten: Ausgabe passt zur CONVERT_VERSION (sonst Version erhöhen)', { skip: realSkip, timeout: 120_000 }, async () => {
  const { source } = realSource();
  const { generatedAt, ...colors } = await source.blockColors();
  const parts = [await source.names(), await source.blocks(), await source.models(), await source.textures(), colors,
    await source.structure('village__plains__houses__plains_small_house_1.json')];
  const sha = createHash('sha256').update(parts.map((part) => JSON.stringify(part)).join('\n')).digest('hex');
  const expected = CONVERT_OUTPUT_SHA256[convert.CONVERT_VERSION];
  assert.ok(expected, `Für CONVERT_VERSION ${convert.CONVERT_VERSION} ist keine Prüfsumme eingetragen (neu: ${sha}).`);
  assert.equal(sha, expected, `Die Umwandlung liefert eine andere Ausgabe als bei CONVERT_VERSION ${convert.CONVERT_VERSION}: `
    + 'CONVERT_VERSION in js/data/convert.js erhöhen und die neue Prüfsumme hier eintragen.');
});
