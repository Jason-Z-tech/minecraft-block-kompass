// Remote-Quelle der Spieldaten (--remote) ohne Netz: Archive, Mojang-Kette und Rückfälle mit Fake-fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseZip } from '../../scripts/lib/zip.mjs';
import {
  REMOTE_DOMAINS, RemoteSourceError, archiveAssets, mergeAssets, readMcmetaVersion, createDownloader, loadRemoteSources,
  blockedDomainMessage, mcmetaArchiveUrl, mcmetaRawUrl, mojangObjectUrl, proxyRelaunchPlan,
} from '../../scripts/lib/remote-source.mjs';
import { MC_VERSION, MCMETA_TAG, UserError, parseCliArgs, extractGameData } from '../../scripts/extract-game-data.mjs';
import { chromeCandidates, platformChromeFlags } from '../browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha1 = (data) => crypto.createHash('sha1').update(data).digest('hex');
const toBuffer = (content) => (Buffer.isBuffer(content) ? content : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content), 'utf8'));

function tempDir(label) {
  const dir = path.join(ROOT, 'tmp', `remote-test-${label}-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createWarnings() {
  return { list: [], add(message) { this.list.push(message); } };
}

// Kleines ZIP (Methode 0) wie ein GitHub-Archiv; Namen mit „/“ am Ende sind Ordner.
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = name.endsWith('/') ? Buffer.alloc(0) : toBuffer(content);
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}

// Ungepacktes NBT für eine 1×1×1-Struktur mit einem Steinblock.
function structureNbt() {
  const parts = [];
  const u8 = (v) => parts.push(Buffer.from([v]));
  const i32 = (v) => { const b = Buffer.alloc(4); b.writeInt32BE(v); parts.push(b); };
  const str = (s) => { const b = Buffer.from(s, 'utf8'); const len = Buffer.alloc(2); len.writeUInt16BE(b.length); parts.push(len, b); };
  const intList = (name, values) => { u8(9); str(name); u8(3); i32(values.length); values.forEach(i32); };
  u8(10); str('');
  intList('size', [1, 1, 1]);
  u8(9); str('palette'); u8(10); i32(1); u8(8); str('Name'); str('minecraft:stone'); u8(0);
  u8(9); str('blocks'); u8(10); i32(1); intList('pos', [0, 0, 0]); u8(3); str('state'); i32(0); u8(0);
  u8(9); str('entities'); u8(0); i32(0);
  u8(0);
  return Buffer.concat(parts);
}

function pngHeader(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

const VERSION_JSON = { id: MC_VERSION, data_version: 4903, resource_pack_version: 88, data_pack_version: 107, data_pack_version_minor: 1 };
const DE_LANG = { 'block.minecraft.stone': 'Stein', 'item.minecraft.stick': 'Stock' };

// Alle Antworten der Remote-Quellen als Fixture: URL → Buffer.
function remoteFixture({ deLang = DE_LANG } = {}) {
  const assetsZip = makeZip({
    'mcmeta-26.2-assets-tiny/': '',
    'mcmeta-26.2-assets-tiny/version.json': VERSION_JSON,
    'mcmeta-26.2-assets-tiny/assets/minecraft/lang/en_us.json': { 'block.minecraft.stone': 'Stone', 'item.minecraft.stick': 'Stick' },
    'mcmeta-26.2-assets-tiny/assets/minecraft/blockstates/stone.json': { variants: { '': { model: 'minecraft:block/stone' } } },
    'mcmeta-26.2-assets-tiny/assets/minecraft/models/block/stone.json': {
      textures: { all: 'minecraft:block/stone', particle: 'minecraft:block/stone' },
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { texture: '#all', cullface: 'up' } } }],
    },
    'mcmeta-26.2-assets-tiny/assets/minecraft/textures/block/stone.png': pngHeader(16, 16),
  });
  const dataZip = makeZip({
    'mcmeta-26.2-data/version.json': VERSION_JSON,
    'mcmeta-26.2-data/data/minecraft/structure/test/one_stone.nbt': structureNbt(),
  });
  const deBytes = toBuffer(deLang);
  const index = toBuffer({ objects: { 'minecraft/lang/de_de.json': { hash: sha1(deBytes), size: deBytes.length } } });
  const indexUrl = `https://piston-meta.mojang.com/v1/packages/${sha1(index)}/32.json`;
  const versionFile = toBuffer({ id: MC_VERSION, assetIndex: { id: '32', sha1: sha1(index), size: index.length, url: indexUrl } });
  const versionUrl = `https://piston-meta.mojang.com/v1/packages/${sha1(versionFile)}/${MC_VERSION}.json`;
  const manifest = toBuffer({ versions: [{ id: '26.1', url: 'https://piston-meta.mojang.com/x/26.1.json', sha1: '0'.repeat(40) }, { id: MC_VERSION, url: versionUrl, sha1: sha1(versionFile) }] });
  return new Map([
    [mcmetaArchiveUrl('26.2-assets-tiny'), assetsZip],
    [mcmetaArchiveUrl('26.2-data'), dataZip],
    ['https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', manifest],
    [versionUrl, versionFile],
    [indexUrl, index],
    [mojangObjectUrl(sha1(deBytes)), deBytes],
    [mcmetaRawUrl('26.2-assets', 'assets/minecraft/lang/de_de.json'), deBytes],
  ]);
}

// Fake-fetch: liefert die Fixture, „gesperrte“ Domains scheitern wie ein DNS-Fehler; zählt Aufrufe.
function fakeFetch(responses, { blocked = [], status = {} } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const host = new URL(url).hostname;
    if (blocked.includes(host)) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND', message: `getaddrinfo ENOTFOUND ${host}` } });
    if (status[url]) return new Response('nein', { status: status[url] });
    if (!responses.has(url)) return new Response('nicht da', { status: 404 });
    return new Response(responses.get(url), { status: 200 });
  };
  return { impl, calls };
}

test('Archive: Hauptordner wird abgeschnitten, Ordner zählen nicht, Quellen lassen sich zusammenlegen', () => {
  const zip = parseZip(makeZip({ 'repo-tag/': '', 'repo-tag/a/x.json': { v: 1 }, 'repo-tag/a/b/': '', 'repo-tag/a/b/y.txt': 'y', 'repo-tag/version.json': VERSION_JSON }));
  const assets = archiveAssets(zip, 'Test');
  assert.deepEqual(assets.list('a/'), ['a/b/y.txt', 'a/x.json']);
  assert.equal(assets.has('a/x.json'), true);
  assert.equal(assets.has('a/b/'), false);
  assert.deepEqual(assets.readJson('a/x.json'), { v: 1 });
  assert.equal(assets.read('a/b/y.txt').toString(), 'y');
  assert.throws(() => archiveAssets(parseZip(makeZip({ 'eins/a.txt': 'a', 'zwei/b.txt': 'b' })), 'Test'), /kein gemeinsamer Hauptordner/);

  const other = archiveAssets(parseZip(makeZip({ 'r/a/x.json': { v: 2 }, 'r/a/c.json': {} })), 'Zwei');
  const merged = mergeAssets(assets, other);
  assert.deepEqual(merged.list('a/'), ['a/b/y.txt', 'a/c.json', 'a/x.json']);
  assert.deepEqual(merged.readJson('a/x.json'), { v: 1 }, 'die erste Quelle gewinnt');
  assert.deepEqual(merged.readJson('a/c.json'), {});
  assert.throws(() => merged.read('fehlt.json'), /fehlt/);

  assert.deepEqual(readMcmetaVersion(assets, MC_VERSION, 'Test'), { id: MC_VERSION, worldVersion: 4903, resourcePack: 88, dataPack: 107 });
  assert.throws(() => readMcmetaVersion(assets, '26.1', 'Test'), /gebraucht wird genau 26\.1/);
});

test('Downloader: Prüfsumme, Größengrenze, erlaubte Domains und klare Meldung bei gesperrter Domain', async () => {
  const body = Buffer.from('hallo');
  const url = mcmetaRawUrl('26.2-summary', 'version.json');
  const { impl } = fakeFetch(new Map([[url, body]]), { status: { [mcmetaRawUrl('x', 'gesperrt')]: 403 } });
  const download = createDownloader({ fetchImpl: impl });
  assert.equal((await download(url, { sha1: sha1(body) })).toString(), 'hallo');
  await assert.rejects(download(url, { sha1: '0'.repeat(40) }), /Prüfsumme stimmt nicht/);
  await assert.rejects(download(url, { maxBytes: 3 }), /größer als/);
  await assert.rejects(download('https://example.com/datei'), /nicht vorgesehen/);
  await assert.rejects(download(mcmetaRawUrl('x', 'fehlt')), (error) => error instanceof RemoteSourceError && /HTTP 404/.test(error.message) && !error.blocked);
  await assert.rejects(download(mcmetaRawUrl('x', 'gesperrt')), (error) => error.blocked && /HTTP 403/.test(error.message) && /raw\.githubusercontent\.com/.test(error.message));

  const offline = createDownloader({ fetchImpl: fakeFetch(new Map(), { blocked: ['codeload.github.com'] }).impl });
  await assert.rejects(offline(mcmetaArchiveUrl('26.2-data')), (error) => {
    assert.ok(error instanceof RemoteSourceError);
    assert.equal(error.host, 'codeload.github.com');
    assert.match(error.message, /Die Domain „codeload\.github\.com“ ist nicht erreichbar \(ENOTFOUND/);
    assert.match(error.message, /README\.md, Abschnitt „In der Cloud“/);
    for (const { host } of REMOTE_DOMAINS) assert.ok(error.message.includes(host), `Meldung nennt ${host}`);
    assert.match(error.message, /node scripts\/extract-game-data\.mjs --remote/);
    return true;
  });

  const redirecting = createDownloader({ fetchImpl: async () => Object.defineProperty(new Response('x'), 'url', { value: 'https://evil.example/x' }) });
  await assert.rejects(redirecting(url), /unerwartete Weiterleitung nach evil\.example/);
  assert.match(blockedDomainMessage('piston-meta.mojang.com', 'Zeitüberschreitung', {}), /Asset-Index/);
  const viaProxy = blockedDomainMessage('codeload.github.com', 'ECONNREFUSED', { HTTPS_PROXY: 'http://nutzer:geheim@proxy:3128' });
  assert.match(viaProxy, /über den Proxy aus HTTPS_PROXY/);
  assert.ok(!viaProxy.includes('geheim'), 'Zugangsdaten des Proxys erscheinen nie in der Meldung');
});

test('Remote-Quellen: Archive + Mojang-Kette mit SHA-1, danach komplett aus dem Cache', async () => {
  const cacheDir = tempDir('cache');
  try {
    const responses = remoteFixture();
    const { impl, calls } = fakeFetch(responses);
    const warnings = createWarnings();
    const result = await loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: impl }), warnings });
    assert.deepEqual(result.version, { id: MC_VERSION, worldVersion: 4903, resourcePack: 88, dataPack: 107 });
    assert.deepEqual(result.germanLang, DE_LANG);
    assert.equal(result.assetIndex, '32');
    assert.deepEqual(result.refs, { assets: 'misode/mcmeta@26.2-assets-tiny', data: 'misode/mcmeta@26.2-data', lang: 'mojang' });
    assert.deepEqual(result.assets.list('data/minecraft/structure/'), ['data/minecraft/structure/test/one_stone.nbt']);
    assert.equal(result.assets.has('assets/minecraft/blockstates/stone.json'), true);
    assert.equal(calls.length, 6);
    assert.ok(!calls.some((url) => url.includes('raw.githubusercontent.com')), 'kein Rückfall nötig');
    assert.deepEqual(warnings.list, []);
    assert.deepEqual(fs.readdirSync(cacheDir).sort(), ['mcmeta-26.2-assets-tiny.zip', 'mcmeta-26.2-data.zip', 'mojang-26.2.json', 'mojang-assets-32.json', 'mojang-de_de.json']);

    const noNetwork = async () => { throw new Error('darf nicht laden'); };
    const again = await loadRemoteSources({ version: MC_VERSION, cacheDir, offline: true, download: createDownloader({ fetchImpl: noNetwork }), warnings });
    assert.deepEqual(again.germanLang, DE_LANG);

    // Kaputter Cache wird gemeldet und neu geladen; manipulierte Sprachdatei fällt über die Prüfsumme auf.
    fs.writeFileSync(path.join(cacheDir, 'mcmeta-26.2-data.zip'), 'kaputt');
    fs.writeFileSync(path.join(cacheDir, 'mojang-de_de.json'), JSON.stringify({ 'block.minecraft.stone': 'Falsch' }));
    const fresh = fakeFetch(responses);
    const repaired = createWarnings();
    const third = await loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: fresh.impl }), warnings: repaired });
    assert.deepEqual(third.germanLang, DE_LANG);
    assert.equal(fresh.calls.length, 2);
    assert.equal(repaired.list.length, 2);
    assert.match(repaired.list.join('\n'), /mcmeta-26\.2-data\.zip unbrauchbar/);
    assert.match(repaired.list.join('\n'), /mojang-de_de\.json unbrauchbar \(Prüfsumme stimmt nicht\)/);

    await assert.rejects(
      loadRemoteSources({ version: MC_VERSION, cacheDir: path.join(cacheDir, 'leer'), offline: true, download: createDownloader({ fetchImpl: noNetwork }), warnings }),
      (error) => error instanceof RemoteSourceError && /fehlt im Cache/.test(error.message) && /ohne --offline/.test(error.message),
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('Remote-Quellen: falsche Version im Archiv wird abgelehnt', async () => {
  const cacheDir = tempDir('version');
  try {
    const responses = remoteFixture();
    responses.set(mcmetaArchiveUrl('26.2-data'), makeZip({ 'mcmeta-26.2-data/version.json': { ...VERSION_JSON, data_version: 4800 } }));
    await assert.rejects(
      loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: fakeFetch(responses).impl }), warnings: createWarnings() }),
      /verschiedenen Datenversionen \(4903 \/ 4800\)/,
    );
    responses.set(mcmetaArchiveUrl('26.2-assets-tiny'), makeZip({ 'mcmeta-26.2-assets-tiny/version.json': { ...VERSION_JSON, id: '26.1' } }));
    fs.rmSync(cacheDir, { recursive: true, force: true });
    await assert.rejects(
      loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: fakeFetch(responses).impl }), warnings: createWarnings() }),
      /unbrauchbare Antwort.*Minecraft 26\.1/,
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('Remote-Quellen: Mojang gesperrt → de_de.json von GitHub mit Warnung; alles gesperrt → klare Meldung', async () => {
  const cacheDir = tempDir('fallback');
  try {
    const responses = remoteFixture();
    const mojangBlocked = fakeFetch(responses, { blocked: ['piston-meta.mojang.com', 'resources.download.minecraft.net'] });
    const warnings = createWarnings();
    const lines = [];
    const result = await loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: mojangBlocked.impl }), warnings, log: (line) => lines.push(line) });
    assert.deepEqual(result.germanLang, DE_LANG);
    assert.equal(result.refs.lang, 'misode/mcmeta@26.2-assets');
    assert.equal(result.assetIndex, null);
    assert.equal(warnings.list.length, 1);
    assert.match(warnings.list[0], /de_de\.json kommt aus misode\/mcmeta@26\.2-assets statt von Mojang.*piston-meta\.mojang\.com/);
    assert.ok(lines.some((line) => /Mojang nicht nutzbar/.test(line)));

    // Nur die Objekt-Domain gesperrt: Asset-Index kommt noch, die Datei vom Rückfall.
    fs.rmSync(cacheDir, { recursive: true, force: true });
    const objectsBlocked = fakeFetch(responses, { blocked: ['resources.download.minecraft.net'] });
    const partly = await loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: objectsBlocked.impl }), warnings: createWarnings() });
    assert.equal(partly.assetIndex, '32');
    assert.equal(partly.refs.lang, 'misode/mcmeta@26.2-assets');

    fs.rmSync(cacheDir, { recursive: true, force: true });
    const allBlocked = fakeFetch(responses, { blocked: ['piston-meta.mojang.com', 'resources.download.minecraft.net', 'raw.githubusercontent.com'] });
    await assert.rejects(loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: allBlocked.impl }), warnings: createWarnings() }), (error) => {
      assert.ok(error instanceof RemoteSourceError);
      assert.match(error.message, /deutsche Sprachdatei ist nicht erreichbar/);
      assert.match(error.message, /piston-meta\.mojang\.com/);
      assert.match(error.message, /„raw\.githubusercontent\.com“ ist nicht erreichbar/);
      return true;
    });

    fs.rmSync(cacheDir, { recursive: true, force: true });
    const codeloadBlocked = fakeFetch(responses, { blocked: ['codeload.github.com'] });
    await assert.rejects(loadRemoteSources({ version: MC_VERSION, cacheDir, download: createDownloader({ fetchImpl: codeloadBlocked.impl }), warnings: createWarnings() }),
      (error) => error.blocked && error.host === 'codeload.github.com');
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('Proxy: Neustart mit --use-env-proxy nur, wenn ein Proxy gesetzt und noch nicht aktiv ist', () => {
  const flags = new Set(['--use-env-proxy']);
  assert.equal(proxyRelaunchPlan({ env: {}, execArgv: [], allowedFlags: flags }).relaunch, false);
  assert.equal(proxyRelaunchPlan({ env: { HTTPS_PROXY: 'http://proxy:3128' }, execArgv: [], allowedFlags: flags }).relaunch, true);
  assert.equal(proxyRelaunchPlan({ env: { https_proxy: 'http://proxy:3128' }, execArgv: ['--use-env-proxy'], allowedFlags: flags }).relaunch, false);
  assert.equal(proxyRelaunchPlan({ env: { HTTP_PROXY: 'http://p', NODE_USE_ENV_PROXY: '1' }, execArgv: [], allowedFlags: flags }).relaunch, false);
  const old = proxyRelaunchPlan({ env: { HTTPS_PROXY: 'http://p' }, execArgv: [], allowedFlags: new Set() });
  assert.equal(old.relaunch, false);
  assert.equal(old.warn, true);
  assert.match(old.reason, /Node 24\.5/);
});

test('Kommandozeile: --remote und --out, Widersprüche werden abgelehnt', () => {
  assert.deepEqual(parseCliArgs(['--remote', '--out', 'tmp/x']), { jar: undefined, assets: undefined, offline: false, help: false, remote: true, out: 'tmp/x' });
  assert.equal(parseCliArgs(['--remote', '--offline']).offline, true);
  assert.equal(Object.hasOwn(parseCliArgs([]), 'remote'), false, 'ohne --remote bleibt das Ergebnis wie bisher');
  assert.throws(() => parseCliArgs(['--remote', '--jar', 'a.jar']), (error) => error instanceof UserError && /verträgt sich nicht/.test(error.message));
  assert.throws(() => parseCliArgs(['--remote', '--assets', 'x']), /verträgt sich nicht/);
  assert.throws(() => parseCliArgs(['--out', ' ']), /braucht einen Pfad/);
});

function mcmetaBlocksFixture() {
  const raw = { stone: [{}, {}] };
  for (let i = 0; i < 500; i++) raw[`block_${i}`] = [{}, {}];
  return raw;
}

test('extractGameData --remote: komplette Ausgabe aus Fake-Quellen, danach offline aus dem Cache', async () => {
  const out = tempDir('extract');
  const originalFetch = globalThis.fetch;
  try {
    const cacheDir = path.join(out, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `mcmeta-${MCMETA_TAG}-version.json`), JSON.stringify({ id: MC_VERSION, data_version: 4903 }));
    fs.writeFileSync(path.join(cacheDir, `mcmeta-${MCMETA_TAG}-blocks.json`), JSON.stringify(mcmetaBlocksFixture()));
    const { impl, calls } = fakeFetch(remoteFixture());
    globalThis.fetch = impl;
    const lines = [];
    const meta = await extractGameData({ remote: true, out, offline: false }, (line) => lines.push(line));
    assert.equal(calls.length, 6);
    assert.equal(meta.worldVersion, 4903);
    assert.equal(meta.resourcePack, 88);
    assert.equal(meta.dataPack, 107);
    assert.deepEqual(meta.sources, {
      blocks: 'mcmeta', blocksRef: `misode/mcmeta@${MCMETA_TAG}`, assetIndex: '32',
      remote: { assets: 'misode/mcmeta@26.2-assets-tiny', data: 'misode/mcmeta@26.2-data', lang: 'mojang' },
    });
    assert.deepEqual(meta.counts.structures, 1);
    const names = JSON.parse(fs.readFileSync(path.join(out, 'names.json'), 'utf8'));
    assert.deepEqual(names.block.stone, { de: 'Stein', en: 'Stone' });
    const index = JSON.parse(fs.readFileSync(path.join(out, 'structures', 'index.json'), 'utf8'));
    assert.deepEqual(index.structures.map((entry) => [entry.path, entry.blocks]), [['test/one_stone', 1]]);
    for (const file of ['blocks.json', 'models.json', 'textures.json', 'textures.bin', 'meta.json']) assert.ok(fs.existsSync(path.join(out, file)), file);
    assert.ok(lines.some((line) => line.startsWith(`Ausgabe in ${path.relative(ROOT, out).split(path.sep).join('/')}/`)));

    globalThis.fetch = async () => { throw new Error('darf nicht laden'); };
    const offlineMeta = await extractGameData({ remote: true, out, offline: true }, () => {});
    assert.equal(offlineMeta.counts.blocks, 501);
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('extractGameData --remote: ohne Blockbericht klare Meldung zu raw.githubusercontent.com statt „derived“', async () => {
  const out = tempDir('noreport');
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = fakeFetch(remoteFixture(), { blocked: ['raw.githubusercontent.com'] }).impl;
    await assert.rejects(extractGameData({ remote: true, out, offline: false }, () => {}), (error) => {
      assert.ok(error instanceof UserError);
      assert.match(error.message, /Blockbericht/);
      assert.match(error.message, /„raw\.githubusercontent\.com“ ist nicht erreichbar/);
      return true;
    });
    assert.equal(fs.existsSync(path.join(out, 'blocks.json')), false, 'nichts geschrieben');
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('Cloud: Chrome-Suche unter Linux (übliche Pfade, Playwright-Cache) und unveränderte Windows-Liste', () => {
  const tree = {
    '/root/.cache/ms-playwright': ['chromium-1100', 'chromium-1200', 'chromium_headless_shell-1200', 'ffmpeg-1010'],
    '/root/.cache/ms-playwright/chromium-1100': ['chrome-linux'],
    '/root/.cache/ms-playwright/chromium-1200': ['chrome-linux64', 'DEPENDENCIES_VALIDATED'],
    '/ms-playwright': ['chromium-900'],
    '/ms-playwright/chromium-900': ['chrome-linux'],
  };
  const list = (dir) => {
    const key = dir.split('\\').join('/');
    if (!tree[key]) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return tree[key];
  };
  const linux = chromeCandidates({ platform: 'linux', env: { PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' }, home: '/root', list });
  assert.deepEqual(linux, [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    '/ms-playwright/chromium-900/chrome-linux/chrome',
    '/root/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
    '/root/.cache/ms-playwright/chromium-1100/chrome-linux/chrome',
  ]);
  assert.equal(chromeCandidates({ platform: 'linux', env: { CHROME_PATH: '/x/chrome' }, home: '/nobody', list })[0], '/x/chrome');
  assert.deepEqual(chromeCandidates({ platform: 'win32', env: {}, home: 'C:\\Users\\x', list }), [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ]);
  assert.deepEqual(platformChromeFlags({ platform: 'linux', uid: 0 }), ['--no-sandbox', '--disable-dev-shm-usage']);
  assert.deepEqual(platformChromeFlags({ platform: 'linux', uid: 1000 }), ['--disable-dev-shm-usage']);
  assert.deepEqual(platformChromeFlags({ platform: 'win32', uid: undefined }), []);
});
