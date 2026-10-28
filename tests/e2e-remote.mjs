// Klick-Test der Seite im Online-Modus wie auf GitHub Pages (Spieldaten aus misode/mcmeta statt aus game-data/):
//   node tests/e2e-remote.mjs [--only start,bau,erstellen,handy,fehler] [--gpu swiftshader|hardware]
//                             [--out tmp/integration/e2e-remote] [--live]
// Ein eigener kleiner statischer Server spielt GitHub Pages nach: ohne Sicherheits-Header, die Seite liegt unter
// /minecraft-block-kompass/ (Unterpfad), ausgeliefert wird nur, was auch auf Pages läge (git ls-files plus neue, nicht
// ignorierte Dateien; nie game-data/, thumbs/, tmp/). Er lauscht auf 127.0.0.2: Diese Adresse gilt für die Seite nicht
// als lokal, sie arbeitet also im Online-Modus und fragt nie nach game-data/.
// Ohne --live kommen die mcmeta-Dateien aus dem Spiegel tmp/mcmeta-mirror/ (node scripts/mirror-mcmeta.mjs) unter
// /__mcmeta/ (gleicher Ursprung, js/data/sources.js mit Basis '/__mcmeta/'); mit --live lädt Chrome sie wirklich von
// https://raw.githubusercontent.com/misode/mcmeta/.
// Jeder Ablauf startet Chrome mit frischem Profil (leere IndexedDB). Eine zweite DevTools-Verbindung zählt die Anfragen
// von Seite und 3D-Worker, sammelt Fehler aus dem Worker und lässt im Fehlerfall (--live) Downloads scheitern.
// Ausgabe OK/FEHLER je Prüfung, Screenshots und Bericht (e2e-remote-report.json) nach --out.
// Exit-Code 1, wenn eine Prüfung fehlschlägt; 2 bei falschen Optionen, fehlendem Spiegel (ohne --live), ohne git oder
// wenn 127.0.0.2 nicht nutzbar ist.
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { MIRROR_PREFIX, mirrorOverrides, mirrorStatus } from './lib/mcmeta-mirror.mjs';
import { MCMETA_COMMITS, LANG_FILES } from '../js/data/sources.js';
import { CATEGORY_SLUGS } from '../js/ui/shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'data', 'catalog.json');
const IMPORT_DIR = path.join(ROOT, 'tests/fixtures/create/import');
const MODEL_DIR = path.join(ROOT, 'tests/fixtures/create/voxelize');
const CHROME_DIR = path.join(ROOT, 'tmp', 'e2e-remote-chrome');
const FLOW_NAMES = ['start', 'bau', 'erstellen', 'handy', 'fehler'];
const PAGES_HOST = '127.0.0.2';
const SITE_PREFIX = '/minecraft-block-kompass/';
const LIVE_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/';
// Liegen nie auf Pages (Mojang-Dateien bzw. daraus erzeugte Bilder, Testreste)
const NOT_ON_PAGES = ['game-data/', 'thumbs/', 'tmp/'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readOptions(argv) {
  const options = { gpu: 'swiftshader', out: 'tmp/integration/e2e-remote', only: FLOW_NAMES, live: false };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const value = argv[i + 1];
    if (name === '--live') {
      options.live = true;
      continue;
    }
    if (name === '--gpu' && (value === 'hardware' || value === 'swiftshader')) options.gpu = value;
    else if (name === '--out' && value) options.out = value;
    else if (name === '--only' && value) options.only = value.split(',').map((part) => part.trim());
    else throw new Error(`Unbekannte oder unvollständige Option „${name}“. Erlaubt: --gpu hardware|swiftshader, --out <ordner>, --only ${FLOW_NAMES.join(',')}, --live`);
    i++;
  }
  const unknown = options.only.filter((flow) => !FLOW_NAMES.includes(flow));
  if (unknown.length) throw new Error(`Unbekannter Ablauf „${unknown.join(', ')}“. Erlaubt: ${FLOW_NAMES.join(', ')}`);
  return options;
}

let OPTIONS;
try {
  OPTIONS = readOptions(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
if (!existsSync(CATALOG_FILE)) {
  console.error('data/catalog.json fehlt – ohne Katalog gibt es nichts zu prüfen.');
  process.exit(2);
}
const MIRROR = mirrorStatus();
if (!OPTIONS.live && !MIRROR.available) {
  console.error(`Der mcmeta-Spiegel ist unvollständig (${MIRROR.missing.length} Dateien fehlen, z. B. ${MIRROR.missing[0]}).\n`
    + 'Erzeugen: node scripts/mirror-mcmeta.mjs   (oder gegen das echte GitHub prüfen: --live)');
  process.exit(2);
}
const OUT = path.resolve(ROOT, OPTIONS.out);
const MODE = OPTIONS.live ? 'live' : 'spiegel';
const catalog = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'));
const byId = new Map(catalog.builds.map((build) => [build.id, build]));

// Bevorzugte Bauten (klein genug für swiftshader), sonst der erste passende im Katalog
function pickBuild(preferred, fits) {
  return preferred.find((id) => byId.has(id) && fits(byId.get(id))) ?? catalog.builds.find(fits)?.id ?? null;
}
const MODULE_ID = pickBuild(['fachwerkhaus'], (b) => b.category === 'haeuser' && b.module && !b.structure);
const STRUCTURE_ID = pickBuild(['spiel-aussenposten-wachturm'], (b) => Boolean(b.structure) && b.category !== 'haeuser');
// Dorfhäuser mit Bett und Schild bzw. Truhe und Banner: Blöcke mit Texturen aus dem Entity-Atlas
const ENTITY_ID = pickBuild(['spiel-taigadorf-kleines-haus-1'], (b) => Boolean(b.structure) && b.category === 'haeuser');
const MOBILE_ID = pickBuild(['spiel-savannendorf-kleines-haus-4'], (b) => Boolean(b.structure) && b.category === 'haeuser' && b.id !== ENTITY_ID);
const ENTITY_ITEM = /(?:^|_)bed$|^(?:trapped_)?chest$|_sign$|_banner$/;

// ---------------------------------------------------------------- Ergebnisse

const results = [];
const perf = [];
const notes = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${detail ? ` – ${detail}` : ''}`);
}
function note(text) {
  console.log(`\n== ${text}`);
}
function info(text) {
  notes.push(text);
  console.log(`       ${text}`);
}

// Befehle haben auf der Seite nichts verloren (sie läuft auch auf dem Handy)
const COMMAND_PATTERN = /\bnode\s|\bnpm\b|\bnpx\b|scripts\/|\.mjs\b|\s--[a-z]|\bgit\s|\bcurl\b|game-data\//i;

// Sichtbarer Text der Seite (Inhalt und Fußzeile) ohne Befehle
async function checkNoCommands(page, label) {
  const text = await page.eval("document.body.innerText.replace(/\\s+/g, ' ')");
  const match = COMMAND_PATTERN.exec(text);
  check(`${label}: sichtbarer Text nennt keine Befehle`, !match, match ? `„…${text.slice(Math.max(0, match.index - 60), match.index + 40)}…“` : `${text.length} Zeichen`);
}

// ---------------------------------------------------------------- Pages-Nachbau

// Dateien, die mit `git push` auf Pages lägen: versioniert plus neu und nicht ignoriert (ohne game-data/, thumbs/, tmp/)
function pagesFiles() {
  const list = (extra) => execFileSync('git', ['-C', ROOT, 'ls-files', '-z', ...extra], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\0').filter(Boolean);
  const files = new Set();
  for (const rel of [...list([]), ...list(['--others', '--exclude-standard'])]) {
    if (NOT_ON_PAGES.some((dir) => rel.startsWith(dir))) continue;
    try {
      if (statSync(path.join(ROOT, ...rel.split('/'))).isFile()) files.add(rel);
    } catch { /* gelöscht, aber noch versioniert */ }
  }
  return files;
}

// Inhaltstypen ungefähr wie GitHub Pages
const PAGES_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};
const NOT_FOUND_PAGE = Buffer.from('<!doctype html><title>404</title><h1>404</h1><p>File not found</p>\n');

// Statischer Server ohne Sicherheits-Header. failure: null | '503' | 'offline' (nur Spiegel: /__mcmeta/ scheitert).
function startPagesServer({ files, live }) {
  const mirror = live ? null : mirrorOverrides({ hideGameData: true });
  const state = { failure: null, log: [] };
  async function handle(req, res) {
    let pathname = null;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://pages.invalid').pathname);
    } catch { /* bleibt null */ }
    const entry = { method: req.method, path: pathname ?? String(req.url), status: 0 };
    state.log.push(entry);
    const send = (status, body, headers = {}) => {
      entry.status = status;
      res.writeHead(status, { 'Content-Length': body.length, ...headers });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const notFound = () => send(404, NOT_FOUND_PAGE, { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(405, Buffer.from('Method Not Allowed'), { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      return;
    }
    if (pathname === null || pathname.includes('\0')) {
      notFound();
      return;
    }
    if (mirror && pathname.startsWith(MIRROR_PREFIX)) {
      // Wie raw.githubusercontent.com: CORS für alle, 5 Minuten Cache
      if (state.failure === 'offline') {
        entry.status = 'getrennt';
        req.socket.destroy();
        return;
      }
      if (state.failure === '503') {
        send(503, Buffer.from('Service Unavailable'), { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return;
      }
      const answer = await mirror(pathname);
      const body = typeof answer.body === 'string' ? Buffer.from(answer.body) : answer.body;
      send(answer.status, body, { 'Content-Type': answer.type, 'Cache-Control': 'max-age=300', 'Access-Control-Allow-Origin': '*' });
      return;
    }
    if (pathname === SITE_PREFIX.slice(0, -1)) {
      send(301, Buffer.alloc(0), { Location: SITE_PREFIX });
      return;
    }
    if (!pathname.startsWith(SITE_PREFIX)) {
      notFound();
      return;
    }
    let rel = pathname.slice(SITE_PREFIX.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const headers = { 'Cache-Control': 'max-age=600', 'Access-Control-Allow-Origin': '*' };
    if (mirror && rel === 'js/data/sources.js') {
      const answer = await mirror('/js/data/sources.js');
      send(answer.status, Buffer.from(answer.body), { ...headers, 'Content-Type': PAGES_TYPES['.js'] });
      return;
    }
    if (!files.has(rel)) {
      notFound();
      return;
    }
    const file = path.join(ROOT, ...rel.split('/'));
    const lastModified = (await stat(file)).mtime.toUTCString();
    if (req.headers['if-modified-since'] === lastModified) {
      entry.status = 304;
      res.writeHead(304, { ...headers, 'Last-Modified': lastModified });
      res.end();
      return;
    }
    const type = PAGES_TYPES[path.extname(rel).toLowerCase()] ?? 'application/octet-stream';
    send(200, await readFile(file), { ...headers, 'Content-Type': type, 'Last-Modified': lastModified });
  }
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handle(req, res).catch((error) => {
        console.error('Pages-Nachbau: Serverfehler', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Interner Fehler');
        } else res.destroy();
      });
    });
    server.on('error', reject);
    server.listen(0, PAGES_HOST, () => {
      const { port } = server.address();
      const origin = `http://${PAGES_HOST}:${port}`;
      resolve({
        origin,
        base: `${origin}${SITE_PREFIX}`,
        state,
        close: () => new Promise((done) => {
          server.closeAllConnections?.();
          server.close(() => done());
        }),
      });
    });
  });
}

// ---------------------------------------------------------------- Erwartete deutsche Namen (aus de_de.json)

async function readLang(page) {
  const files = {};
  for (const [key, repoPath] of Object.entries(LANG_FILES)) {
    const local = path.join(ROOT, 'tmp', 'mcmeta-mirror', MCMETA_COMMITS.assetsJson, ...repoPath.split('/'));
    if (existsSync(local)) files[key] = JSON.parse(await readFile(local, 'utf8'));
    else if (page) {
      // Nur mit --live ohne Spiegel: über Chrome holen (Node hat hier keinen Proxy)
      files[key] = await page.eval(`fetch(${JSON.stringify(`${LIVE_BASE}${MCMETA_COMMITS.assetsJson}/${repoPath}`)}, { credentials: 'omit' }).then((r) => r.json())`);
    } else return null;
  }
  return files;
}
let LANG = null;
const langName = (kind, id) => LANG?.de[`${kind}.minecraft.${id}`] ?? LANG?.en[`${kind}.minecraft.${id}`] ?? null;
// Wie itemName (js/core/describe.js): erst Gegenstand, dann Block · wie blockDisplayName: erst Block, dann Gegenstand
const expectedItemName = (id) => langName('item', id) ?? langName('block', id);
const expectedBlockName = (id) => langName('block', id) ?? langName('item', id);
const englishName = (id) => LANG?.en[`item.minecraft.${id}`] ?? LANG?.en[`block.minecraft.${id}`] ?? null;

// ---------------------------------------------------------------- Chrome mit zweiter DevTools-Verbindung

// Läuft in jeder Seite vor deren Skripten: merkt sich jeden Text der Lade-/Fehleranzeigen (für „Ladeanzeige erscheint“)
const STATUS_OBSERVER = `(() => {
  if (window.__e2eStatus) return;
  const log = [];
  Object.defineProperty(window, '__e2eStatus', { value: log });
  const SELECTORS = ['.bv-stage__status', '#create-status', '#shape-generator-body > .state', '#build-status'];
  let last = '';
  const read = () => {
    const parts = [];
    for (const selector of SELECTORS) for (const node of document.querySelectorAll(selector)) {
      const text = node.textContent.replace(/\\s+/g, ' ').trim();
      if (text) parts.push(text);
    }
    const phase = document.querySelector('.bv-load__steps .is-active')?.textContent ?? '';
    const text = parts.join(' | ').slice(0, 400);
    if (text === last) return;
    last = text;
    if (log.length < 3000) log.push({ t: Math.round(performance.now()), phase, text });
  };
  new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true });
})();`;

// Zweite Verbindung zum selben Chrome (Port aus DevToolsActivePort im Profil): Anfragen von Seite und Workern,
// Konsole der Worker und – nur mit --live – gezielt scheiternde Downloads (Fetch-Abfangen gilt auch für den Worker).
async function attachMonitor(profileParent) {
  const profiles = (await readdir(profileParent)).filter((name) => name.startsWith('block-kompass-test-'));
  if (profiles.length !== 1) throw new Error(`Chrome-Profil nicht gefunden (in ${profileParent}: ${profiles.length} Profile).`);
  const [port, browserPath] = (await readFile(path.join(profileParent, profiles[0], 'DevToolsActivePort'), 'utf8')).split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${Number(port)}${browserPath.trim()}`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('Zweite DevTools-Verbindung scheiterte.')); });
  let nextId = 1;
  const pending = new Map();
  const sessions = new Map();
  const byRequest = new Map();
  const monitor = { requests: [], errors: [], warnings: [], block: null, closed: false };
  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    if (monitor.closed) {
      reject(new Error('Verbindung geschlossen'));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  async function prepareChild(sessionId, type) {
    sessions.set(sessionId, type);
    const quiet = (promise) => promise.catch(() => {});
    await quiet(send('Network.enable', {}, sessionId));
    await quiet(send('Runtime.enable', {}, sessionId));
    await quiet(send('Log.enable', {}, sessionId));
    await quiet(send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId));
    await quiet(send('Runtime.runIfWaitingForDebugger', {}, sessionId));
  }
  function onPaused({ requestId, request }, sessionId) {
    const block = monitor.block;
    if (!block || !block.match(request.url)) {
      send('Fetch.continueRequest', { requestId }, sessionId).catch(() => {});
    } else if (block.kind === '503') {
      send('Fetch.fulfillRequest', {
        requestId, responseCode: 503,
        responseHeaders: [{ name: 'Content-Type', value: 'text/plain; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from('Service Unavailable').toString('base64'),
      }, sessionId).catch(() => {});
    } else {
      send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }, sessionId).catch(() => {});
    }
  }
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    const where = sessions.get(msg.sessionId) ?? 'browser';
    const p = msg.params ?? {};
    switch (msg.method) {
      case 'Target.attachedToTarget':
        if (p.targetInfo.type !== 'page') prepareChild(p.sessionId, p.targetInfo.type).catch(() => {});
        break;
      case 'Network.requestWillBeSent': {
        if (/^(?:data|blob|about):/.test(p.request.url)) break;
        const known = byRequest.get(p.requestId);
        if (known && known.url === p.request.url) break; // dieselbe Anfrage aus Seite und Worker gemeldet
        const entry = { url: p.request.url, type: p.type ?? null, where, status: null, fromCache: false, failed: null, blocked: null, bytes: 0 };
        byRequest.set(p.requestId, entry);
        monitor.requests.push(entry);
        break;
      }
      case 'Network.responseReceived': {
        const entry = byRequest.get(p.requestId);
        if (entry) {
          entry.status = p.response.status;
          if (p.response.fromDiskCache || p.response.fromPrefetchCache) entry.fromCache = true;
        }
        break;
      }
      case 'Network.requestServedFromCache': {
        const entry = byRequest.get(p.requestId);
        if (entry) entry.fromCache = true;
        break;
      }
      case 'Network.loadingFinished': {
        const entry = byRequest.get(p.requestId);
        if (entry) entry.bytes = p.encodedDataLength ?? 0;
        break;
      }
      case 'Network.loadingFailed': {
        const entry = byRequest.get(p.requestId);
        if (entry) {
          entry.failed = p.canceled ? 'abgebrochen' : p.errorText;
          entry.blocked = p.blockedReason ?? p.corsErrorStatus?.corsError ?? null;
        }
        break;
      }
      case 'Fetch.requestPaused':
        onPaused(p, msg.sessionId);
        break;
      case 'Runtime.consoleAPICalled':
        if (where !== 'page') {
          const text = `[${where}] ${p.args.map((a) => a.value ?? a.description).join(' ')}`;
          if (p.type === 'error') monitor.errors.push(text); else if (p.type === 'warning') monitor.warnings.push(text);
        }
        break;
      case 'Runtime.exceptionThrown':
        if (where !== 'page') monitor.errors.push(`[${where}] ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`);
        break;
      case 'Log.entryAdded':
        if (where !== 'page' && p.entry.level === 'error') monitor.errors.push(`[${where}] ${p.entry.text} ${p.entry.url ?? ''}`.trim());
        break;
      default:
        break;
    }
  };
  const { targetInfos } = await send('Target.getTargets');
  const target = targetInfos.find((t) => t.type === 'page');
  if (!target) throw new Error('Seite für die zweite DevTools-Verbindung nicht gefunden.');
  const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  sessions.set(sessionId, 'page');
  await send('Network.enable', {}, sessionId);
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, sessionId);
  monitor.setBlock = async (block) => {
    monitor.block = block;
    if (block) await send('Fetch.enable', { patterns: [{ urlPattern: block.pattern, requestStage: 'Request' }] }, sessionId);
    else await send('Fetch.disable', {}, sessionId);
  };
  monitor.close = () => {
    monitor.closed = true;
    ws.close();
  };
  return monitor;
}

let usedGpu = null;
const openPages = new Set();

async function openBrowser({ mobile = false } = {}) {
  const size = mobile ? { width: 390, height: 844, mobile: true, deviceScaleFactor: 2 } : { width: 1280, height: 900 };
  await mkdir(CHROME_DIR, { recursive: true });
  const launch = async (gpu) => {
    // launchBrowser legt das Profil unter os.tmpdir() an (gleich beim Aufruf); so liegt es in einem eigenen Ordner und
    // die zweite Verbindung findet dort den DevTools-Port. Chrome selbst bekommt die alten Variablen zurück.
    const parent = await mkdtemp(path.join(CHROME_DIR, 'p-'));
    const saved = Object.fromEntries(['TMPDIR', 'TMP', 'TEMP'].map((key) => [key, process.env[key]]));
    for (const key of Object.keys(saved)) process.env[key] = parent;
    let launching;
    try {
      launching = launchBrowser({ ...size, gpu, reducedMotion: true });
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
    let page;
    try {
      page = await launching;
    } catch (error) {
      await rm(parent, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
    const close = page.close;
    page.close = async () => {
      openPages.delete(page);
      page.monitor?.close();
      await close();
      await rm(parent, { recursive: true, force: true }).catch(() => {});
    };
    openPages.add(page);
    page.monitor = await attachMonitor(parent);
    return page;
  };
  let page = null;
  try {
    page = await launch(OPTIONS.gpu);
    if (!(await page.eval("Boolean(document.createElement('canvas').getContext('webgl2'))"))) throw new Error('kein WebGL2');
    usedGpu = OPTIONS.gpu;
  } catch (error) {
    if (OPTIONS.gpu === 'swiftshader') throw error;
    console.warn(`Grafikkarte nicht nutzbar (${error.message}) – nehme swiftshader.`);
    await page?.close();
    page = await launch('swiftshader');
    usedGpu = 'swiftshader';
  }
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: STATUS_OBSERVER });
  return page;
}

const FLOW_TIMEOUT_MS = 12 * 60 * 1000;
async function runWithTimeout(name, run) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Zeitgrenze von ${FLOW_TIMEOUT_MS / 60000} Minuten überschritten (Ablauf hängt)`)), FLOW_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
    for (const page of [...openPages]) await page.close().catch((error) => console.error(`Browser „${name}“ ließ sich nicht schließen: ${error.message}`));
  }
}

// ---------------------------------------------------------------- Anfragen und Konsole

let SERVER = null;
const isMcmeta = (url) => (OPTIONS.live ? url.startsWith(LIVE_BASE) : url.startsWith(`${SERVER.origin}${MIRROR_PREFIX}`));
const mark = (page) => ({ cdp: page.monitor.requests.length, server: SERVER.state.log.length, at: Date.now() });

function since(page, from) {
  return { cdp: page.monitor.requests.slice(from.cdp), server: SERVER.state.log.slice(from.server) };
}

function countMcmeta(page, from) {
  const { cdp, server } = since(page, from);
  const mcmeta = cdp.filter((entry) => isMcmeta(entry.url));
  return {
    cdp: mcmeta.length,
    server: server.filter((entry) => entry.path.startsWith(MIRROR_PREFIX)).length,
    bytes: mcmeta.reduce((sum, entry) => sum + entry.bytes, 0),
    fromWorker: mcmeta.filter((entry) => entry.where !== 'page').length,
    fromCache: mcmeta.filter((entry) => entry.fromCache).length,
  };
}

// Alle Anfragen seit from: nur Pages-Unterpfad und mcmeta; nie game-data/ oder thumbs/; keine 4xx/5xx, keine Abbrüche
function requestProblems(page, from, { allowFailedMcmeta = false } = {}) {
  const { cdp, server } = since(page, from);
  const problems = [];
  for (const entry of cdp) {
    const { url } = entry;
    const sameSite = url.startsWith(`${SERVER.origin}${SITE_PREFIX}`);
    const allowed = sameSite || isMcmeta(url);
    if (/\/(?:game-data|thumbs)\//.test(url)) problems.push(`verbotene Anfrage ${url}`);
    else if (!allowed) problems.push(`Anfrage außerhalb von Pages/mcmeta: ${url}`);
    const expectedFailure = allowFailedMcmeta && isMcmeta(url);
    if (entry.blocked) problems.push(`blockiert (${entry.blocked}): ${url}`);
    else if (entry.failed && entry.failed !== 'abgebrochen' && !expectedFailure) problems.push(`gescheitert (${entry.failed}): ${url}`);
    else if (entry.status >= 400 && !expectedFailure) problems.push(`HTTP ${entry.status}: ${url}`);
  }
  for (const entry of server) {
    const expectedFailure = allowFailedMcmeta && entry.path.startsWith(MIRROR_PREFIX);
    if (/^\/(?:minecraft-block-kompass\/)?(?:game-data|thumbs)(?:\/|$)/.test(entry.path)) problems.push(`Server: Anfrage nach ${entry.path}`);
    else if ((entry.status === 'getrennt' || entry.status >= 400) && !expectedFailure) problems.push(`Server: ${entry.status} für ${entry.path}`);
  }
  return [...new Set(problems)];
}

function checkRequests(page, label, from, options) {
  const problems = requestProblems(page, from, options);
  const { cdp } = since(page, from);
  check(`${label}: Anfragen nur an Pages und mcmeta, nie game-data/ oder thumbs/`, problems.length === 0,
    problems.length ? problems.slice(0, 4).join(' | ') : `${cdp.length} Anfragen geprüft`);
}

// Ressourcen-Meldungen des Browsers zu absichtlich gescheiterten mcmeta-Downloads (Fehlerfall)
const EXPECTED_FAILURE_LOGS = [/^Failed to load resource: (?:the server responded with a status of 503|net::ERR_[A-Z_]+) .*(?:__mcmeta|raw\.githubusercontent\.com\/misode\/mcmeta)\//];

function takeErrors(page, ignore = []) {
  const all = [...page.errors.splice(0), ...page.monitor.errors.splice(0)];
  return {
    kept: all.filter((text) => !ignore.some((pattern) => pattern.test(text))),
    ignored: all.filter((text) => ignore.some((pattern) => pattern.test(text))),
  };
}

function checkConsole(page, label, ignore = []) {
  const { kept, ignored } = takeErrors(page, ignore);
  check(`${label}: Konsole ohne Fehler`, kept.length === 0,
    kept.length ? kept.slice(0, 3).map((text) => text.split('\n')[0].slice(0, 240)).join(' | ') : (ignored.length ? `${ignored.length} erwartete Netz-Meldungen des Browsers` : ''));
}

// Warnungen, die auf fehlende Texturen, Icons oder Draufsichten hinweisen (Seite und Worker)
const TEXTURE_WARNINGS = /Fehlende oder fehlerhafte Texturen|für die Vorschau nicht lesbar|Texturen für den Plan nicht verfügbar|Draufsicht für .* fehlt|Icon für .* fehlt|Kein Icon für|Kein Modell für|Block-Icons nicht verfügbar|Deutsche Blocknamen fehlen/;
function textureWarnings(page) {
  const found = [...page.logs, ...page.monitor.warnings].filter((text) => TEXTURE_WARNINGS.test(text));
  page.logs.splice(0);
  page.monitor.warnings.splice(0);
  return found;
}

// ---------------------------------------------------------------- Browser-Helfer

const BUILD_READY = "window.__buildView && window.__buildView.context && window.__buildView.viewer.ready && document.querySelector('.bv-player:not(.is-loading)') && (document.querySelector('.bv-stage__status')?.textContent.trim() ?? '') === ''";
const BUILD_ERROR = "document.querySelector('.bv-stage.is-error')";
const RETRY_READY = "document.querySelector('.bv-player:not(.is-loading):not(.is-error)') && document.querySelectorAll('.bv-step').length > 0 && !document.querySelector('.bv-stage.is-error') && (document.querySelector('.bv-stage__status')?.textContent.trim() ?? '') === ''";
const CREATE_READY = 'window.__createPage && window.__createPage.ready';
const createViewReady = (slot, host) => `window.__createPage.views.${slot} && window.__createPage.views.${slot}.context && document.querySelector('#${host} .bv-player:not(.is-loading)')`;
const noHorizontalScroll = (page) => page.eval('document.documentElement.scrollWidth <= window.innerWidth + 1');

async function shot(page, name) {
  await page.screenshot(path.join(OUT, `${name}.png`));
}

async function fullShot(page, name) {
  await page.eval('window.scrollTo(0, 0)');
  await sleep(150);
  const metrics = await page.send('Page.getLayoutMetrics');
  const { width, height } = metrics.cssContentSize ?? metrics.contentSize;
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(width), height: Math.min(Math.ceil(height), 6000), scale: 1 },
  });
  await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
}

async function loadLazyImages(page) {
  const height = await page.eval('document.documentElement.scrollHeight');
  const step = await page.eval('window.innerHeight');
  for (let y = 0; y < height; y += step) {
    await page.eval(`window.scrollTo(0, ${y})`);
    await sleep(50);
  }
  await page.waitFor('[...document.images].every((img) => img.complete)', 10000).catch(() => {});
  return page.eval('({ total: document.images.length, broken: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute("src")).slice(0, 5) })');
}

// Wie page.waitFor, übersteht aber einen Seitenwechsel (das Auswerten scheitert kurz, während die neue Seite lädt)
async function waitAcrossNavigation(page, expression, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < end) {
    try {
      if (await page.eval(`Boolean(${expression})`)) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`Zeitüberschreitung beim Warten auf: ${expression}${lastError ? ` (${lastError.message.split('\n')[0]})` : ''}`);
}

async function statusLog(page) {
  return page.eval('(window.__e2eStatus ?? []).map((entry) => ({ ...entry }))');
}

// Prozentwerte der Spieldaten-Anzeige je Phase (Daten/Texturen) – dürfen innerhalb einer Phase nie fallen
function progressSeries(log) {
  const series = [];
  for (const { phase, text } of log) {
    const match = /(Spieldaten von GitHub laden \(einmalig\)|Struktur von GitHub laden) … (\d+) %/.exec(text);
    if (match) series.push({ phase, kind: match[1].startsWith('Struktur') ? 'struktur' : 'einmalig', share: Number(match[2]) });
  }
  const backwards = series.filter((item, i) => i > 0 && series[i - 1].phase === item.phase && item.share < series[i - 1].share);
  return { series, backwards };
}

// Bau öffnen (bzw. neu laden) und warten, bis er fertig gezeichnet ist oder einen Fehler zeigt
async function openBuild(page, url, { reload = false } = {}) {
  const from = mark(page);
  const started = Date.now();
  if (reload) await page.reload(); else await page.goto(url);
  await page.waitFor(`(${BUILD_READY}) || ${BUILD_ERROR}`, 240000, 100);
  const failed = await page.eval(`Boolean(${BUILD_ERROR})`);
  if (!failed) await page.eval('window.__buildView.viewer.idle()');
  const seconds = (Date.now() - started) / 1000;
  const log = await statusLog(page);
  return { from, seconds, failed, log };
}

async function stageStatusText(page) {
  return page.eval("(document.querySelector('.bv-stage__status')?.textContent ?? '').replace(/\\s+/g, ' ').trim()");
}

// Schritt-Player: Pos1, Weiter, Weiter, Zurück
async function checkSteps(page, label) {
  try {
    await page.eval('document.activeElement?.blur(); document.body.focus()');
    await page.key('Home');
    await page.waitFor('window.__buildView.context.p === 0', 8000);
    await page.click('.bv-player__controls .btn--icon:nth-of-type(3)');
    await page.waitFor('window.__buildView.context.p === 1', 8000);
    const first = await page.eval("document.querySelector('.bv-player__label strong')?.textContent ?? ''");
    // Kapitel, Blockzahl und Ebene statt Schritt-Name und Anleitungssatz; Anleitung ohne Texte, Tipps und Notizen
    const now = await page.eval("[...document.querySelectorAll('.bv-player__now p')].map((p) => p.textContent)");
    const removed = await page.eval("document.querySelectorAll('.bv-step__title, .bv-step__text, .bv-chapter__text, .bv-tips, .bv-note, .bv-notes, .bv-marker, .difficulty').length");
    check(`${label}: ohne Schritt-Namen, Texte, Tipps und Notizen`, /^Kapitel \d+ von \d+$/.test(now[0] ?? '') && /^[\d.]+ (?:Block|Blöcke)( · y = -?\d+)?$/.test(now[2] ?? '') && removed === 0,
      `${now.join(' | ')} · ${removed} alte Elemente`);
    await page.click('.bv-player__controls .btn--icon:nth-of-type(3)');
    await page.waitFor('window.__buildView.context.p === 2', 8000);
    await page.click('.bv-player__controls .btn--icon:nth-of-type(1)');
    await page.waitFor('window.__buildView.context.p === 1', 8000);
    check(`${label}: Schritt weiter und zurück`, first === 'Schritt 1', `Anzeige „${first}“, weiter → 2, zurück → 1`);
  } catch (error) {
    check(`${label}: Schritt weiter und zurück`, false, error.message.split('\n')[0]);
  }
}

// Materialliste: jede Sorte mit dem deutschen Namen aus de_de.json, alle Icons geladen
async function checkMaterials(page, label, { expectEntity = false } = {}) {
  await page.click('[data-tab="materials"]');
  await page.waitFor("document.querySelectorAll('.bv-materials__list .bv-material').length > 0", 20000);
  await page.waitFor("[...document.querySelectorAll('.bv-material .slot__icon')].every((img) => img.getAttribute('src'))", 20000).catch(() => {});
  const items = await page.eval("[...document.querySelectorAll('.bv-materials__list .bv-material')].map((b) => ({ item: b.dataset.item, name: b.querySelector('.bv-material__name')?.textContent ?? '', icon: Boolean(b.querySelector('.slot__icon')?.getAttribute('src')) }))");
  const wrong = items.filter(({ item, name }) => expectedItemName(item) === null || name !== expectedItemName(item));
  const german = items.filter(({ item, name }) => name !== englishName(item)).length;
  check(`${label}: Materialliste mit deutschen Namen`, items.length > 0 && wrong.length === 0 && german > 0,
    wrong.length ? `falsch: ${wrong.slice(0, 4).map(({ item, name }) => `${item} → „${name}“ statt „${expectedItemName(item)}“`).join(', ')}`
      : `${items.length} Sorten, ${german} vom Englischen verschieden, z. B. ${items.slice(0, 3).map(({ name }) => name).join(', ')}`);
  const missingIcons = items.filter((item) => !item.icon).map((item) => item.item);
  check(`${label}: alle Material-Icons geladen`, missingIcons.length === 0, missingIcons.length ? `ohne Icon: ${missingIcons.slice(0, 5).join(', ')}` : `${items.length} Icons`);
  if (expectEntity) {
    const entityItems = items.filter(({ item }) => ENTITY_ITEM.test(item)).map(({ item, name }) => `${name} (${item})`);
    check(`${label}: Bau enthält Bett/Truhe/Schild/Banner (Entity-Texturen)`, entityItems.length > 0, entityItems.join(', ') || 'keins in der Materialliste');
  }
  return items;
}

async function checkPlan(page, label) {
  try {
    await page.click('[data-tab="layers"]');
    await page.waitFor("/Ebene \\d+ von/.test(document.querySelector('.bv-plan__layer')?.textContent ?? '')", 20000);
    await sleep(500);
    check(`${label}: Ebenen-Plan da`, true, await page.eval("document.querySelector('.bv-plan__layer').textContent.trim()"));
  } catch (error) {
    check(`${label}: Ebenen-Plan da`, false, error.message.split('\n')[0]);
  }
}

// Gespeicherte Spieldaten im Browser (IndexedDB „block-kompass-data“, Objektspeicher „files“) → Schlüssel oder null
function storedKeys(page) {
  return page.eval(`(async () => {
    if (!globalThis.indexedDB) return null;
    const list = await indexedDB.databases?.() ?? [];
    if (!list.some((db) => db.name === 'block-kompass-data')) return null;
    return new Promise((resolve) => {
      const open = indexedDB.open('block-kompass-data');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const request = db.transaction('files', 'readonly').objectStore('files').getAllKeys();
          request.onsuccess = () => { db.close(); resolve(request.result.map(String)); };
          request.onerror = () => { db.close(); resolve(null); };
        } catch { db.close(); resolve(null); }
      };
    });
  })()`);
}

// Bau-Seite prüfen. visit: 'erst' (frisches Profil, alles wird geladen) | 'struktur' (Spieldaten schon da) | 'neu' (Neuladen)
async function buildVisit(page, { id, label, visit, shotName, materials = true, plan = true, steps = true, expectEntity = false, mobile = false }) {
  const build = byId.get(id);
  if (!build) {
    check(`${label}: im Katalog`, false, `${id} fehlt`);
    return null;
  }
  const url = `${SERVER.base}bau.html?id=${encodeURIComponent(id)}`;
  const loaded = await openBuild(page, url, { reload: visit === 'neu' });
  const requests = countMcmeta(page, loaded.from);
  if (loaded.failed) {
    check(`${label}: 3D fertig`, false, `Fehler statt Bau: ${(await stageStatusText(page)).slice(0, 200)}`);
    await shot(page, `${shotName}-fehler`);
    return null;
  }
  const stats = await page.eval('(({ blocks, quads, drawnQuads, missingTextures, textureLayers, loadMs, buildMs, textureMs, meshMs }) => ({ blocks, quads, drawnQuads, missingTextures, textureLayers, loadMs, buildMs, textureMs, meshMs }))(window.__buildView.viewer.stats)');
  const result = await page.eval('(() => { const r = window.__buildView.result; return { blocks: r.blockCount, steps: r.steps.length }; })()');
  check(`${label}: 3D fertig, Blöcke sichtbar`, result.blocks === build.blocks && result.steps === build.steps && stats.quads > 0 && stats.drawnQuads > 0,
    `${result.blocks} Blöcke (Katalog ${build.blocks}), ${result.steps} Schritte, ${stats.drawnQuads} Flächen gezeichnet, ${loaded.seconds.toFixed(1)} s`);
  const warnings = textureWarnings(page);
  check(`${label}: keine fehlenden Texturen`, stats.missingTextures.length === 0 && warnings.length === 0,
    stats.missingTextures.length || warnings.length
      ? `${stats.missingTextures.slice(0, 6).join(', ')} ${warnings.slice(0, 2).join(' | ').slice(0, 300)}`.trim()
      : `${stats.textureLayers} Textur-Ebenen`);
  const { series, backwards } = progressSeries(loaded.log);
  const loadingShown = loaded.log.some((entry) => /Bau wird geladen/.test(entry.text));
  if (visit === 'erst') {
    const oneTime = series.filter((item) => item.kind === 'einmalig');
    check(`${label}: Ladeanzeige „Spieldaten von GitHub laden (einmalig) … %“`, loadingShown && oneTime.length > 0,
      oneTime.length ? `${oneTime.length} Meldungen: ${[...new Set(oneTime.map((item) => `${item.phase} ${item.share} %`))].slice(0, 8).join(', ')}` : `nur: ${loaded.log.slice(0, 3).map((entry) => entry.text.slice(0, 80)).join(' | ')}`);
    check(`${label}: Fortschritt geht innerhalb einer Phase nie zurück`, backwards.length === 0,
      backwards.length ? backwards.map((item) => `${item.phase} ${item.share} %`).join(', ') : `${series.length} Prozentwerte`);
  } else if (visit === 'struktur') {
    const structureText = series.filter((item) => item.kind === 'struktur');
    check(`${label}: Ladeanzeige erscheint`, loadingShown, structureText.length ? `„Struktur von GitHub laden … ${structureText.map((item) => item.share).join('/')} %“` : 'Bau wird geladen …');
  } else {
    check(`${label}: Neuladen ohne „(einmalig)“-Anzeige`, series.every((item) => item.kind !== 'einmalig'), series.length ? series.map((item) => `${item.share} %`).join(', ') : 'keine Download-Anzeige');
  }
  if (mobile) check(`${label}: kein waagrechtes Scrollen`, await noHorizontalScroll(page));
  await shot(page, `${shotName}-01-fertig`);
  if (steps) await checkSteps(page, label);
  if (materials) {
    await checkMaterials(page, label, { expectEntity });
    if (mobile) await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await shot(page, `${shotName}-02-material`);
  }
  if (plan) {
    await checkPlan(page, label);
    if (mobile) await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await shot(page, `${shotName}-03-ebenen`);
  }
  if (visit !== 'neu') {
    await page.click('[data-tab="info"]');
    await sleep(200);
    await checkNoCommands(page, label);
  }
  const late = textureWarnings(page);
  if (late.length) check(`${label}: keine Textur-Warnungen in Material und Plan`, false, late.slice(0, 2).join(' | ').slice(0, 300));
  const entry = { label, id, visit, seconds: loaded.seconds, mcmeta: requests, viewer: stats };
  perf.push(entry);
  return entry;
}

// ---------------------------------------------------------------- Start und Kategorie

async function startFlow() {
  note('Start und Kategorie (Desktop 1280 × 900, frisches Profil)');
  const page = await openBrowser();
  const from = mark(page);
  await page.goto(SERVER.base);
  check('Testumgebung: 127.0.0.2 gilt als sicherer Kontext (wie https auf Pages)', await page.eval('window.isSecureContext && Boolean(navigator.locks)'),
    `isSecureContext ${await page.eval('window.isSecureContext')}, Web Locks ${await page.eval('Boolean(navigator.locks)')}`);
  await page.waitFor("document.querySelectorAll('#home-sections .build-card').length > 0", 20000);
  const home = await page.eval("({ cards: document.querySelectorAll('#home-sections .build-card').length, tiles: document.querySelectorAll('#home-categories .category-tile').length, total: document.getElementById('home-total')?.textContent.trim() ?? '', error: Boolean(document.querySelector('.state--error')) })");
  check('Start: Karten da, keine Fehlerbox', home.cards > 0 && home.tiles === CATEGORY_SLUGS.length && !home.error && home.total.replace(/\D/g, '').includes(String(catalog.counts.total)),
    `${home.cards} Karten, ${home.tiles} Kacheln, „${home.total.slice(0, 60)}“`);
  const images = await loadLazyImages(page);
  check('Start: keine kaputten Bilder', images.broken.length === 0, `${images.total} Bilder${images.broken.length ? `, kaputt: ${images.broken.join(', ')}` : ''}`);
  await fullShot(page, 'desktop-01-start');
  await checkNoCommands(page, 'Start');

  await page.click('#home-categories .category-tile[data-category="haeuser"]');
  await waitAcrossNavigation(page, "location.pathname.endsWith('/kategorie.html') && document.querySelectorAll('#category-list .build-card').length > 0", 20000);
  const houses = catalog.builds.filter((build) => build.category === 'haeuser').length;
  const category = await page.eval("({ cards: document.querySelectorAll('#category-list .build-card').length, count: document.getElementById('category-result-count')?.textContent.trim() ?? '', error: Boolean(document.querySelector('.state--error')), path: location.pathname })");
  check('Kategorie Häuser: Karten da, keine Fehlerbox', category.cards > 0 && !category.error && category.count.replace(/\D/g, '').startsWith(String(houses)) && category.path.startsWith(SITE_PREFIX),
    `${category.cards} Karten, „${category.count}“, ${category.path}`);
  const catImages = await loadLazyImages(page);
  check('Kategorie: keine kaputten Bilder', catImages.broken.length === 0, `${catImages.total} Bilder`);
  await page.eval('window.scrollTo(0, 0)');
  await shot(page, 'desktop-02-kategorie');
  await checkNoCommands(page, 'Kategorie');
  await page.goto(`${SERVER.base}kategorie.html`);
  await page.waitFor(`document.querySelectorAll('#category-overview-list .category-tile').length === ${CATEGORY_SLUGS.length}`, 10000)
    .then(() => check('Übersicht aller Kategorien', true), (error) => check('Übersicht aller Kategorien', false, error.message));
  const mc = countMcmeta(page, from);
  info(`Start und Kategorie: ${mc.cdp} Anfragen an mcmeta (erwartet 0: Start und Kategorie brauchen keine Spieldaten)`);
  check('Start und Kategorie: keine Spieldaten-Downloads', mc.cdp === 0, `${mc.cdp} mcmeta-Anfragen`);
  checkRequests(page, 'Start und Kategorie', from);
  checkConsole(page, 'Start und Kategorie');
}

// ---------------------------------------------------------------- Bau-Seiten

async function buildPagesFlow() {
  note(`Bau-Seiten (Desktop 1280 × 900, frisches Profil, Spieldaten: ${MODE})`);
  const page = await openBrowser();
  const from = mark(page);
  const first = await buildVisit(page, { id: MODULE_ID, label: `Modul ${MODULE_ID} (erster Besuch)`, visit: 'erst', shotName: `bau-${MODULE_ID}` });
  if (first) {
    check(`Modul ${MODULE_ID}: Spieldaten wirklich aus mcmeta geladen`, first.mcmeta.cdp > 0 && (OPTIONS.live || first.mcmeta.server === first.mcmeta.cdp),
      `${first.mcmeta.cdp} Anfragen (Server ${OPTIONS.live ? '–' : first.mcmeta.server}, davon Worker ${first.mcmeta.fromWorker}), ${(first.mcmeta.bytes / 1048576).toFixed(1)} MB`);
    const keys = await storedKeys(page);
    const needed = ['names', 'blocks', 'models', 'textures', 'atlas:blocks'];
    const missing = keys ? needed.filter((name) => !keys.some((key) => key.endsWith(`|${name}`))) : needed;
    check('Spieldaten in IndexedDB gespeichert', keys !== null && missing.length === 0, keys ? `${keys.length} Einträge${missing.length ? `, fehlt: ${missing.join(', ')}` : ''}` : 'Datenbank fehlt');
  }
  checkConsole(page, `Modul ${MODULE_ID} (erster Besuch)`);

  // Neuladen: alles aus IndexedDB, keine einzige Anfrage an mcmeta (auch nicht aus dem HTTP-Cache)
  const again = await buildVisit(page, { id: MODULE_ID, label: `Modul ${MODULE_ID} (neu geladen)`, visit: 'neu', shotName: `bau-${MODULE_ID}-neu`, materials: true, plan: false, steps: false });
  if (again) {
    check(`Modul ${MODULE_ID}: Neuladen ohne Anfragen an ${OPTIONS.live ? 'GitHub' : '/__mcmeta/'}`, again.mcmeta.cdp === 0 && again.mcmeta.server === 0,
      `Browser ${again.mcmeta.cdp}, Server ${again.mcmeta.server} · ${first ? `${first.seconds.toFixed(1)} s → ${again.seconds.toFixed(1)} s` : ''}`);
  }
  checkConsole(page, `Modul ${MODULE_ID} (neu geladen)`);

  const structure = await buildVisit(page, { id: STRUCTURE_ID, label: `Struktur ${STRUCTURE_ID}`, visit: 'struktur', shotName: `bau-${STRUCTURE_ID}` });
  if (structure) info(`Struktur ${STRUCTURE_ID}: ${structure.mcmeta.cdp} Anfragen an mcmeta (nur die .nbt und ggf. ein weiterer Atlas)`);
  checkConsole(page, `Struktur ${STRUCTURE_ID}`);

  const entity = await buildVisit(page, { id: ENTITY_ID, label: `Dorfhaus ${ENTITY_ID}`, visit: 'struktur', shotName: `bau-${ENTITY_ID}`, expectEntity: true, plan: true, steps: false });
  if (entity) {
    const keys = await storedKeys(page);
    check(`Dorfhaus ${ENTITY_ID}: Entity-Atlas geladen und gespeichert`, Boolean(keys?.some((key) => key.endsWith('|atlas:entities'))),
      keys ? keys.filter((key) => /atlas:/.test(key)).map((key) => key.split('|').pop()).join(', ') : 'Datenbank fehlt');
  }
  checkConsole(page, `Dorfhaus ${ENTITY_ID}`);
  checkRequests(page, 'Bau-Seiten', from);
  await page.close();
}

// ---------------------------------------------------------------- Selber erstellen

async function ask(page, text) {
  await page.eval(`(() => { document.getElementById('create-query').value = ${JSON.stringify(text)}; })()`);
  await page.click('#create-form button[type="submit"]');
  await page.waitFor(`window.__createPage.request && window.__createPage.request.query === ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`, 8000);
  await sleep(150);
  return page.eval('window.__createPage.request');
}

async function upload(page, files, { submit = false, timeout = 120000 } = {}) {
  const before = await page.eval('window.__createPage.imports');
  await page.setInputFiles('#import-file', files);
  if (submit) {
    await page.waitFor("document.querySelector('.import-options__submit')", 8000);
    await page.click('.import-options__submit');
  }
  await page.waitFor(`window.__createPage.imports > ${before}`, timeout);
  const outcome = await page.eval('window.__createPage.lastImport');
  if (outcome.ok) {
    await page.waitFor(createViewReady('import', 'import-result'), 90000);
    await page.eval('window.__createPage.views.import.viewer.idle()');
    outcome.missing = await page.eval('window.__createPage.views.import.viewer.stats.missingTextures');
  }
  return outcome;
}

// Blockauswahl im Formen-Generator: Vorschläge und Suche zeigen deutsche Namen
async function checkBlockPicker(page, label, shotName = 'desktop-13-erstellen-blockauswahl') {
  const input = '#shape-generator-body .block-picker__input';
  try {
    await page.click(input);
    await page.waitFor("document.querySelector('#shape-generator-body .block-picker__list:not([hidden]) [role=\"option\"]')", 8000);
    const popular = await page.eval("[...document.querySelectorAll('#shape-generator-body .block-picker__list:not([hidden]) [role=\"option\"]')].map((o) => ({ id: o.dataset.block, name: o.querySelector('.block-picker__name')?.textContent ?? '' })).filter((o) => o.id)");
    const wrong = popular.filter(({ id, name }) => name !== expectedBlockName(id));
    check(`${label}: Blockauswahl mit deutschen Namen`, popular.length > 0 && wrong.length === 0,
      wrong.length ? wrong.slice(0, 4).map(({ id, name }) => `${id} → „${name}“ statt „${expectedBlockName(id)}“`).join(', ') : `${popular.length} Vorschläge, z. B. ${popular.slice(0, 4).map(({ name }) => name).join(', ')}`);
    await page.type(input, 'Glas');
    await page.waitFor("[...document.querySelectorAll('#shape-generator-body .block-picker__list:not([hidden]) [role=\"option\"]')].some((o) => o.dataset.block === 'glass')", 8000);
    const glass = await page.eval("[...document.querySelectorAll('#shape-generator-body .block-picker__list [role=\"option\"]')].find((o) => o.dataset.block === 'glass')?.querySelector('.block-picker__name')?.textContent ?? ''");
    check(`${label}: Suche „Glas“ findet ${expectedBlockName('glass')}`, glass === expectedBlockName('glass'), `„${glass}“`);
    await shot(page, shotName);
    await page.key('Escape');
  } catch (error) {
    check(`${label}: Blockauswahl mit deutschen Namen`, false, error.message.split('\n')[0]);
  }
}

async function createFlow() {
  note('Selber erstellen (Desktop 1280 × 900, frisches Profil)');
  const page = await openBrowser();
  const from = mark(page);
  const started = Date.now();
  await page.goto(`${SERVER.base}erstellen.html`);
  await page.waitFor(CREATE_READY, 120000);
  const seconds = (Date.now() - started) / 1000;
  const error = await page.eval('window.__createPage.error');
  check('Erstellen: Seite lädt mit Spieldaten', error === null, error ?? `${seconds.toFixed(1)} s, ${countMcmeta(page, from).cdp} mcmeta-Anfragen`);
  const shownProgress = (await statusLog(page)).some((entry) => /Spieldaten von GitHub laden \(einmalig\) … \d+ %/.test(entry.text));
  check('Erstellen: Ladeanzeige mit Download-Fortschritt', shownProgress, shownProgress ? '' : 'keine „(einmalig)“-Meldung gesehen');
  perf.push({ label: 'erstellen.html (erster Besuch)', seconds, mcmeta: countMcmeta(page, from) });
  await fullShot(page, 'desktop-10-erstellen');
  await checkNoCommands(page, 'Erstellen');

  const house = await ask(page, byId.get(MODULE_ID)?.title ?? 'Fachwerkhaus');
  check(`Freitext „${byId.get(MODULE_ID)?.title}“ → Treffer`, house.kind === 'build' && house.matches?.length > 0 && (await page.eval("document.querySelectorAll('#create-results-body a[href*=\"bau.html?id=\"]').length")) > 0,
    `${house.kind}, ${house.matches?.[0]?.entry.id}`);
  const sphere = await ask(page, 'hohle Kugel Radius 12 aus Glas');
  check('Freitext „hohle Kugel Radius 12 aus Glas“ → Form', sphere.kind === 'shape' && sphere.shape === 'sphere' && sphere.params.block === 'glass', JSON.stringify(sphere.params));
  await fullShot(page, 'desktop-11-erstellen-kugel');

  await page.click('#create-tab-formen');
  await checkBlockPicker(page, 'Formen');
  try {
    await page.click('#shape-preview-button');
    await page.waitFor(createViewReady('shape', 'shape-preview'), 120000);
    await page.eval('window.__createPage.views.shape.viewer.idle()');
    const view = await page.eval('(() => { const v = window.__createPage.views.shape; return { blocks: v.result.blockCount, missing: v.viewer.stats.missingTextures, quads: v.viewer.stats.drawnQuads, shape: window.__createPage.shape?.shape }; })()');
    check('Formen: Vorschau der Kugel baut in 3D', view.blocks > 0 && view.quads > 0 && view.missing.length === 0 && view.shape === 'sphere',
      `${view.shape}, ${view.blocks} Blöcke, ${view.quads} Flächen, fehlende Texturen: ${view.missing.length}`);
  } catch (failure) {
    check('Formen: Vorschau der Kugel baut in 3D', false, failure.message.split('\n')[0]);
  }
  await fullShot(page, 'desktop-12-erstellen-formen');

  await page.click('#create-tab-import');
  const nbt = await upload(page, [path.join(IMPORT_DIR, 'house.nbt')]);
  check('Upload Strukturdatei (.nbt)', nbt.ok && nbt.blockCount > 0 && nbt.missing?.length === 0, nbt.ok ? `${nbt.blockCount} Blöcke, fehlende Texturen: ${nbt.missing?.length}` : nbt.error);
  // Modell-Import braucht die Blockfarben, online im Browser aus den Atlanten berechnet
  const blockColorsFrom = mark(page);
  const vox = await upload(page, [path.join(MODEL_DIR, 'scene.vox')], { submit: true });
  check('Upload Modell (.vox, Blockfarben im Browser berechnet)', vox.ok && vox.blockCount > 0 && vox.missing?.length === 0,
    vox.ok ? `${vox.blockCount} Blöcke, ${countMcmeta(page, blockColorsFrom).cdp} mcmeta-Anfragen dafür` : vox.error);
  await fullShot(page, 'desktop-14-erstellen-import');
  await checkNoCommands(page, 'Erstellen mit Import');
  const warnings = textureWarnings(page);
  check('Erstellen: keine Textur- oder Icon-Warnungen', warnings.length === 0, warnings.slice(0, 2).join(' | ').slice(0, 300));
  checkRequests(page, 'Erstellen', from);
  checkConsole(page, 'Erstellen');
  await page.close();
}

// ---------------------------------------------------------------- Handy

async function mobileFlow() {
  note('Handy 390 × 844 (frisches Profil)');
  const page = await openBrowser({ mobile: true });
  const from = mark(page);
  await page.goto(SERVER.base);
  await page.waitFor("document.querySelectorAll('#home-sections .build-card').length > 0", 20000);
  check('Handy Start: Karten da, keine Fehlerbox, kein waagrechtes Scrollen',
    (await page.eval("!document.querySelector('.state--error')")) && await noHorizontalScroll(page));
  await shot(page, 'handy-01-start');
  await page.goto(`${SERVER.base}kategorie.html?k=haeuser`);
  await page.waitFor("document.querySelectorAll('#category-list .build-card').length > 0", 20000);
  check('Handy Kategorie: Karten da, kein waagrechtes Scrollen', (await page.eval("!document.querySelector('.state--error')")) && await noHorizontalScroll(page));
  await shot(page, 'handy-02-kategorie');

  await buildVisit(page, { id: MOBILE_ID, label: `Handy ${MOBILE_ID} (erster Besuch)`, visit: 'erst', shotName: `handy-bau-${MOBILE_ID}`, expectEntity: true, mobile: true });
  checkConsole(page, `Handy ${MOBILE_ID}`);
  await buildVisit(page, { id: MODULE_ID, label: `Handy Modul ${MODULE_ID}`, visit: 'struktur', shotName: `handy-bau-${MODULE_ID}`, materials: true, plan: false, steps: true, mobile: true });
  checkConsole(page, `Handy Modul ${MODULE_ID}`);

  await page.goto(`${SERVER.base}erstellen.html`);
  await page.waitFor(CREATE_READY, 60000);
  check('Handy Erstellen: Seite lädt, kein waagrechtes Scrollen', (await page.eval('window.__createPage.error === null')) && await noHorizontalScroll(page),
    String(await page.eval('window.__createPage.error ?? ""')));
  await page.click('#create-tab-import');
  const outcome = await upload(page, [path.join(IMPORT_DIR, 'house.nbt')]);
  check('Handy Upload .nbt', outcome.ok && outcome.missing?.length === 0, outcome.ok ? `${outcome.blockCount} Blöcke` : outcome.error);
  check('Handy mit Import: kein waagrechtes Scrollen', await noHorizontalScroll(page));
  await fullShot(page, 'handy-03-erstellen-import');
  checkRequests(page, 'Handy', from);
  checkConsole(page, 'Handy Erstellen');
  await page.close();
}

// ---------------------------------------------------------------- Fehlerfall

// Downloads scheitern lassen: Spiegel → der Server antwortet 503 bzw. trennt die Verbindung; --live → Chrome fängt die
// Anfragen an GitHub ab (503 bzw. „keine Internetverbindung“), auch die des 3D-Workers.
async function setFailure(page, kind) {
  if (OPTIONS.live) {
    await page.monitor.setBlock(kind ? { kind, pattern: `${LIVE_BASE}*`, match: (url) => url.startsWith(LIVE_BASE) } : null);
  } else {
    SERVER.state.failure = kind;
  }
}

const EXPECTED_TEXT = {
  '503': /Probleme|503/,
  offline: /Internetverbindung|Verbindung/,
};

async function buildFailure({ mobile, kind, id, label, shotName }) {
  const page = await openBrowser({ mobile });
  const from = mark(page);
  try {
    await setFailure(page, kind);
    const started = Date.now();
    await page.goto(`${SERVER.base}bau.html?id=${encodeURIComponent(id)}`);
    await page.waitFor(`${BUILD_ERROR} || (${BUILD_READY})`, 180000, 100);
    const seconds = (Date.now() - started) / 1000;
    const state = await page.eval(`(() => {
      const status = document.querySelector('.bv-stage__status');
      return {
        error: Boolean(${BUILD_ERROR}),
        title: status?.querySelector('.state__title')?.textContent.trim() ?? '',
        text: (status?.textContent ?? '').replace(/\\s+/g, ' ').trim(),
        buttons: [...(status?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()),
      };
    })()`);
    check(`${label}: Fehlermeldung erscheint`, state.error && state.title !== '', `nach ${seconds.toFixed(1)} s: „${state.text.slice(0, 220)}“`);
    check(`${label}: verständlich, ohne Befehle`, EXPECTED_TEXT[kind].test(state.text) && !COMMAND_PATTERN.test(state.text), state.title);
    check(`${label}: „Erneut versuchen“ vorhanden`, state.buttons.includes('Erneut versuchen'), state.buttons.join(', '));
    if (mobile) check(`${label}: kein waagrechtes Scrollen`, await noHorizontalScroll(page));
    await shot(page, `${shotName}-fehler`);
    const failedConsole = takeErrors(page, EXPECTED_FAILURE_LOGS);
    const failPhase = countMcmeta(page, from);
    const failedFiles = new Set(since(page, from).cdp.filter((entry) => isMcmeta(entry.url)).map((entry) => entry.url)).size;
    info(`${label}: bis zur Meldung ${failPhase.cdp} Download-Versuche für ${failedFiles} Dateien`);
    const failedWarnings = textureWarnings(page);
    if (failedWarnings.length) info(`${label}: Warnungen während des Fehlers: ${failedWarnings.map((text) => text.slice(0, 120)).join(' | ')}`);
    await setFailure(page, null);
    const retryFrom = mark(page);
    const retryStarted = Date.now();
    await page.click('.bv-stage__status button');
    // window.__buildView setzt build-page.js nur, wenn schon der erste Versuch klappt – darum hier über die Anzeige
    await page.waitFor(`(${RETRY_READY}) || ${BUILD_ERROR}`, 240000, 100);
    const ok = !(await page.eval(`Boolean(${BUILD_ERROR})`));
    await sleep(1500);
    const after = ok ? await page.eval("({ steps: document.querySelectorAll('.bv-step').length, label: document.querySelector('.bv-player__label')?.textContent.replace(/\\s+/g, ' ').trim() ?? '' })") : null;
    const warnings = textureWarnings(page);
    check(`${label}: nach Wiederherstellung lädt „Erneut versuchen“ den Bau`, ok && after.steps === byId.get(id).steps && warnings.length === 0,
      ok ? `${after.steps} Schritte („${after.label}“), ${((Date.now() - retryStarted) / 1000).toFixed(1)} s, ${countMcmeta(page, retryFrom).cdp} mcmeta-Anfragen${warnings.length ? `, Warnungen: ${warnings.map((text) => text.slice(0, 160)).join(' | ')}` : ''}` : (await stageStatusText(page)).slice(0, 200));
    await shot(page, `${shotName}-erneut`);
    // Auch Namen und Icons müssen nach dem erneuten Versuch da sein (nicht der gemerkte Fehler des ersten Versuchs)
    if (ok) {
      await checkMaterials(page, `${label} nach „Erneut versuchen“`);
      await shot(page, `${shotName}-erneut-material`);
      const late = textureWarnings(page);
      if (late.length) check(`${label}: keine Warnungen nach „Erneut versuchen“`, false, late.slice(0, 2).join(' | ').slice(0, 300));
    }
    check(`${label}: Konsole ohne unerwartete Fehler`, failedConsole.kept.length === 0,
      failedConsole.kept.length ? failedConsole.kept.slice(0, 3).map((text) => text.split('\n')[0].slice(0, 240)).join(' | ') : `${failedConsole.ignored.length} erwartete Netz-Meldungen des Browsers`);
    checkConsole(page, `${label} (nach Erneut versuchen)`);
    checkRequests(page, label, from, { allowFailedMcmeta: true });
    perf.push({ label: `${label} (bis zur Fehleranzeige)`, seconds, mcmeta: failPhase });
  } finally {
    await setFailure(page, null).catch(() => {});
    await page.close();
  }
}

async function createFailure() {
  const label = 'Fehlerfall erstellen.html (Netz weg)';
  const page = await openBrowser();
  const from = mark(page);
  try {
    await setFailure(page, 'offline');
    await page.goto(`${SERVER.base}erstellen.html`);
    await page.waitFor(CREATE_READY, 120000);
    const state = await page.eval(`(() => {
      const box = document.querySelector('#shape-generator-body .state--error');
      return {
        error: window.__createPage.error,
        text: (box?.textContent ?? '').replace(/\\s+/g, ' ').trim(),
        buttons: [...(box?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()),
        catalog: Boolean(document.querySelector('#create-examples-list button')),
      };
    })()`);
    check(`${label}: Fehlermeldung im Formen-Generator`, state.text !== '', `„${state.text.slice(0, 220)}“`);
    check(`${label}: verständlich, ohne Befehle`, EXPECTED_TEXT.offline.test(state.text) && !COMMAND_PATTERN.test(state.text));
    check(`${label}: „Erneut versuchen“ vorhanden`, state.buttons.includes('Erneut versuchen'), state.buttons.join(', '));
    check(`${label}: Freitext-Beispiele trotzdem da (Katalog liegt auf Pages)`, state.catalog);
    await page.click('#create-tab-formen');
    await fullShot(page, 'fehler-erstellen-offline');
    const failedConsole = takeErrors(page, EXPECTED_FAILURE_LOGS);
    await setFailure(page, null);
    await page.eval('window.__e2eOld = true');
    await page.click('#shape-generator-body .state--error button');
    await waitAcrossNavigation(page, `!window.__e2eOld && ${CREATE_READY}`, 120000);
    const after = await page.eval("({ error: window.__createPage.error, generator: Boolean(document.getElementById('shape-preview-button')) })");
    check(`${label}: nach Wiederherstellung klappt „Erneut versuchen“`, after.error === null && after.generator, after.error ?? 'Formen-Generator da');
    if (after.generator) {
      await page.click('#create-tab-formen');
      await checkBlockPicker(page, `${label} nach „Erneut versuchen“`, 'fehler-erstellen-erneut-blockauswahl');
    }
    check(`${label}: Konsole ohne unerwartete Fehler`, failedConsole.kept.length === 0,
      failedConsole.kept.length ? failedConsole.kept.slice(0, 3).map((text) => text.split('\n')[0].slice(0, 240)).join(' | ') : `${failedConsole.ignored.length} erwartete Netz-Meldungen des Browsers`);
    checkConsole(page, `${label} (nach Erneut versuchen)`);
    checkRequests(page, label, from, { allowFailedMcmeta: true });
  } finally {
    await setFailure(page, null).catch(() => {});
    await page.close();
  }
}

async function failureFlow() {
  note(`Fehlerfall (${OPTIONS.live ? 'Chrome lässt GitHub-Anfragen scheitern' : 'Spiegel antwortet 503 bzw. trennt die Verbindung'}, je frisches Profil)`);
  await buildFailure({ mobile: false, kind: '503', id: MODULE_ID, label: `Fehlerfall ${MODULE_ID} (503)`, shotName: 'fehler-bau-503' });
  await buildFailure({ mobile: true, kind: 'offline', id: STRUCTURE_ID, label: `Fehlerfall Handy ${STRUCTURE_ID} (Netz weg)`, shotName: 'fehler-handy-offline' });
  await createFailure();
}

// ---------------------------------------------------------------- Ablauf

let FILES;
try {
  FILES = pagesFiles();
} catch (error) {
  console.error(`git ls-files ging nicht (${error.message.split('\n')[0]}) – der Pages-Nachbau braucht die Dateiliste aus git.`);
  process.exit(2);
}
try {
  SERVER = await startPagesServer({ files: FILES, live: OPTIONS.live });
} catch (error) {
  console.error(`Der Pages-Nachbau kann nicht auf ${PAGES_HOST} lauschen (${error.code ?? error.message}). Unter Linux und Windows gehört 127.0.0.2 zum Loopback; unter macOS vorher: sudo ifconfig lo0 alias 127.0.0.2 up`);
  process.exit(2);
}
await mkdir(OUT, { recursive: true });
console.log(`Pages-Nachbau: ${SERVER.base} · ${FILES.size} Dateien · Spieldaten: ${OPTIONS.live ? LIVE_BASE : `Spiegel unter ${MIRROR_PREFIX}`}`);
console.log(`Bauten: Modul ${MODULE_ID}, Struktur ${STRUCTURE_ID}, Entity-Texturen ${ENTITY_ID}, Handy ${MOBILE_ID}`);
for (const [name, id] of Object.entries({ MODULE_ID, STRUCTURE_ID, ENTITY_ID, MOBILE_ID })) {
  if (!id) check(`Katalog: Bau für ${name}`, false, 'kein passender Bau gefunden');
}
const flows = { start: startFlow, bau: buildPagesFlow, erstellen: createFlow, handy: mobileFlow, fehler: failureFlow };
const startedAt = Date.now();
try {
  if (!OPTIONS.live || MIRROR.available) LANG = await readLang(null);
  if (!LANG) {
    const helper = await launchBrowser({ gpu: 'swiftshader' });
    try {
      LANG = await readLang(helper);
    } finally {
      await helper.close();
    }
  }
  for (const [name, flow] of Object.entries(flows)) {
    if (!OPTIONS.only.includes(name)) continue;
    try {
      await runWithTimeout(name, flow);
    } catch (error) {
      check(`Ablauf „${name}“ ohne Abbruch`, false, error.message.split('\n')[0]);
    }
  }
} finally {
  await SERVER.close();
  await rm(CHROME_DIR, { recursive: true, force: true }).catch(() => {});
}

note(`Ladezeiten und Anfragen (Spieldaten: ${MODE}, Grafik: ${usedGpu ?? 'unbekannt'})`);
for (const entry of perf) {
  const mc = entry.mcmeta;
  const viewer = entry.viewer ? ` · Viewer: Laden ${Math.round(entry.viewer.loadMs ?? 0)} ms, Texturen ${Math.round(entry.viewer.textureMs ?? 0)} ms, Meshing ${Math.round(entry.viewer.meshMs ?? 0)} ms` : '';
  console.log(`${entry.label}: ${entry.seconds.toFixed(1)} s bis fertig · ${mc.cdp} mcmeta-Anfragen (Worker ${mc.fromWorker}, Cache ${mc.fromCache}${OPTIONS.live ? '' : `, Server ${mc.server}`}), ${(mc.bytes / 1048576).toFixed(2)} MB${viewer}`);
}
const failed = results.filter((result) => !result.ok);
const seconds = (Date.now() - startedAt) / 1000;
await writeFile(path.join(OUT, 'e2e-remote-report.json'), `${JSON.stringify({
  when: new Date().toISOString(), mode: MODE, base: SERVER.base, gpu: usedGpu, seconds, files: FILES.size,
  builds: { module: MODULE_ID, structure: STRUCTURE_ID, entity: ENTITY_ID, mobile: MOBILE_ID },
  results, perf, notes,
}, null, 2)}\n`);
console.log(`\n${results.length - failed.length} von ${results.length} Prüfungen OK, ${failed.length} FEHLER · ${seconds.toFixed(0)} s · Screenshots und Bericht: ${path.relative(ROOT, OUT)}`);
if (failed.length) {
  console.log('Fehlgeschlagen:');
  for (const result of failed) console.log(`  FEHLER ${result.name}${result.detail ? ` – ${result.detail}` : ''}`);
}
process.exit(failed.length ? 1 : 0);
