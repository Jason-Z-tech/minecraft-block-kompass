// Steuert ein unsichtbares Chrome über das DevTools-Protokoll und klickt wie ein Mensch
// (echte Mausereignisse an der sichtbaren Position). Nur Node-Bordmittel.
// Übernommen aus dem Dyna-Kompass; neu: WebGL-fähig, freier Debug-Port (keine Kollisionen
// bei parallelen Läufen), Warten auf Bedingungen, Screenshots auch als WebP.

import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WINDOWS_CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const LINUX_CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/opt/google/chrome/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

// Playwright legt Browser unter <cache>/chromium-<rev>/chrome-linux*/chrome ab; neueste Revision zuerst.
function playwrightChromes(cacheDir, list = readdirSync) {
  let entries;
  try {
    entries = list(cacheDir);
  } catch {
    return [];
  }
  const revision = (name) => Number(/-(\d+)$/.exec(name)?.[1] ?? -1);
  const browsers = entries.filter((name) => /^chromium(?:-tip-of-tree)?-\d+$/.test(name)).sort((a, b) => revision(b) - revision(a));
  const found = [];
  for (const browser of browsers) {
    let inner;
    try {
      inner = list(path.join(cacheDir, browser));
    } catch {
      continue;
    }
    for (const dir of inner.filter((name) => name.startsWith('chrome-linux')).sort().reverse()) found.push(path.posix.join(cacheDir, browser, dir, 'chrome'));
  }
  return found;
}

// Kandidaten in fester Reihenfolge: CHROME_PATH, dann die üblichen Orte des Betriebssystems.
export function chromeCandidates({ platform = process.platform, env = process.env, home = os.homedir(), list = readdirSync } = {}) {
  if (platform !== 'linux') return [env.CHROME_PATH, ...WINDOWS_CHROME_PATHS].filter(Boolean);
  const caches = [env.PLAYWRIGHT_BROWSERS_PATH, path.posix.join(home, '.cache', 'ms-playwright')].filter(Boolean);
  return [env.CHROME_PATH, ...LINUX_CHROME_PATHS, ...caches.flatMap((dir) => playwrightChromes(dir, list))].filter(Boolean);
}

// Zusatz-Schalter unter Linux: als root startet Chrome nur ohne Sandbox; in Containern ist /dev/shm oft zu klein.
export function platformChromeFlags({ platform = process.platform, uid = process.getuid?.() } = {}) {
  if (platform !== 'linux') return [];
  return [...(uid === 0 ? ['--no-sandbox'] : []), '--disable-dev-shm-usage'];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROUTE_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bin': 'application/octet-stream',
};

// Chrome schreibt den gewählten Port in die Datei DevToolsActivePort im Profilordner.
async function waitForDebugger(profile) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    try {
      const [portLine] = (await readFile(portFile, 'utf8')).split('\n');
      const port = Number(portLine);
      if (port > 0) {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const page = (await res.json()).find((t) => t.type === 'page');
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch { /* Chrome startet noch */ }
    await sleep(100);
  }
  throw new Error('Chrome hat den Debug-Port nicht geöffnet.');
}

// gpu: 'swiftshader' (Software-WebGL, läuft überall) | 'hardware' (Grafikkarte, schneller)
export async function launchBrowser({
  width = 1280, height = 900, mobile = false, timezone = null,
  reducedMotion = true, gpu = 'swiftshader', deviceScaleFactor = 1,
} = {}) {
  const candidates = chromeCandidates();
  const chrome = candidates.find((p) => existsSync(p));
  if (!chrome) {
    throw new Error(process.platform === 'linux'
      ? `Kein Chrome oder Chromium gefunden (gesucht: ${candidates.join(', ') || 'nichts'}). Pfad per CHROME_PATH angeben.`
      : 'Kein Chrome oder Edge gefunden. Pfad per CHROME_PATH angeben.');
  }
  const profile = await mkdtemp(path.join(os.tmpdir(), 'block-kompass-test-'));
  const gpuFlags = gpu === 'hardware'
    ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const proc = spawn(chrome, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--mute-audio', ...gpuFlags, ...platformChromeFlags(),
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });

  const ws = new WebSocket(await waitForDebugger(profile));
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const errors = [];
  const logs = [];
  const routes = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) {
      if (msg.method === 'Fetch.requestPaused') {
        answerRoutedRequest(msg.params).catch((error) => errors.push(`Testdaten-Umleitung fehlgeschlagen: ${error.message}`));
      }
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value ?? a.description).join(' ');
        if (msg.params.type === 'error') errors.push(text); else logs.push(`[${msg.params.type}] ${text}`);
      }
      // Browser-Meldungen wie fehlende Dateien (404) oder durch die CSP blockierte Inhalte.
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`${msg.params.entry.text} ${msg.params.entry.url ?? ''}`.trim());
      for (const l of [...listeners]) l(msg);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  // Testdaten unterschieben: Anfragen, deren URL `match` enthält, bekommen eine feste Antwort.
  async function answerRoutedRequest({ requestId, request }) {
    const route = routes.find((r) => request.url.includes(r.match));
    if (!route) {
      await send('Fetch.continueRequest', { requestId });
      return;
    }
    const { file, body = '', status = 200, contentType } = route.response;
    const payload = file ? await readFile(file) : Buffer.from(body);
    const type = contentType ?? ROUTE_TYPES[path.extname(file ?? request.url.split('?')[0]).toLowerCase()] ?? 'application/octet-stream';
    await send('Fetch.fulfillRequest', {
      requestId,
      responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: type }, { name: 'Cache-Control', value: 'no-store' }],
      body: payload.toString('base64'),
    });
  }
  const updateRoutePatterns = () => (routes.length
    ? send('Fetch.enable', { patterns: routes.map((r) => ({ urlPattern: `*${r.match}*`, requestStage: 'Request' })) })
    : send('Fetch.disable'));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }] });
  if (timezone) await send('Emulation.setTimezoneOverride', { timezoneId: timezone });

  // Wartet auf das Laden der Seite, höchstens timeoutMs – sonst Fehler statt ewigem Hängen.
  const waitForLoad = (timeoutMs = 20000) => new Promise((resolve, reject) => {
    const l = (msg) => {
      if (msg.method !== 'Page.loadEventFired') return;
      clearTimeout(timer);
      listeners.splice(listeners.indexOf(l), 1);
      resolve();
    };
    const timer = setTimeout(() => {
      listeners.splice(listeners.indexOf(l), 1);
      reject(new Error(`Seite wurde nicht innerhalb von ${timeoutMs / 1000} s geladen.`));
    }, timeoutMs);
    listeners.push(l);
  });

  const page = {
    errors,
    logs,
    send,
    // Lädt immer frisch – auch wenn sich nur der #-Teil der Adresse ändert.
    async goto(url) {
      const blank = waitForLoad();
      await send('Page.navigate', { url: 'about:blank' });
      await blank;
      const loaded = waitForLoad();
      await send('Page.navigate', { url });
      await loaded;
      await sleep(150);
    },
    async reload() {
      const loaded = waitForLoad();
      await send('Page.reload', {});
      await loaded;
      await sleep(150);
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    // Wartet, bis der Ausdruck (im Browser ausgewertet) wahr ist.
    async waitFor(expression, timeoutMs = 20000, intervalMs = 100) {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) {
        if (await page.eval(`Boolean(${expression})`)) return;
        await sleep(intervalMs);
      }
      throw new Error(`Zeitüberschreitung beim Warten auf: ${expression}`);
    },
    // Klickt mit der Maus mittig auf das sichtbare Element (scrollt es vorher ins Bild).
    async click(selector) {
      const box = await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      })()`);
      if (!box) throw new Error(`Element nicht gefunden: ${selector}`);
      if (box.w === 0 || box.h === 0) throw new Error(`Element unsichtbar: ${selector}`);
      // Prüfen, dass an dieser Stelle wirklich das Element (oder ein Kind davon) getroffen wird.
      const hit = await page.eval(`(() => {
        const target = document.querySelector(${JSON.stringify(selector)});
        const top = document.elementFromPoint(${box.x}, ${box.y});
        return !!top && (target === top || target.contains(top) || top.contains(target) || (top.control === target) || (target.labels && [...target.labels].some((l) => l.contains(top))));
      })()`);
      if (!hit) throw new Error(`Element ist verdeckt: ${selector}`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      }
      await sleep(80);
    },
    async type(selector, text) {
      await page.click(selector);
      await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.select?.(); })()`);
      await send('Input.insertText', { text });
      await sleep(80);
    },
    async key(key, code = key) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
      await sleep(60);
    },
    // Antwortet auf Anfragen, deren URL `match` enthält, mit { file } oder { body, status, contentType }.
    // Gilt ab der nächsten Anfrage (vor goto aufrufen). Nur Hauptseite, keine Worker.
    async route(match, response) {
      if (typeof match !== 'string' || !match) throw new Error('route: match muss ein nicht leerer Text sein.');
      if (!response || (response.file === undefined && response.body === undefined)) {
        throw new Error('route: Antwort braucht file oder body.');
      }
      routes.push({ match, response });
      await updateRoutePatterns();
    },
    async unroute(match = null) {
      for (let i = routes.length - 1; i >= 0; i--) if (match === null || routes[i].match === match) routes.splice(i, 1);
      await updateRoutePatterns();
    },
    // Wählt Dateien in einem <input type="file"> aus (löst input/change wie eine echte Auswahl aus).
    async setInputFiles(selector, files) {
      const { root } = await send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
      if (!nodeId) throw new Error(`Element nicht gefunden: ${selector}`);
      await send('DOM.setFileInputFiles', { nodeId, files: files.map((f) => path.resolve(f)) });
      await sleep(80);
    },
    async screenshot(file, { format = 'png', quality = 90 } = {}) {
      const params = { format, captureBeyondViewport: false };
      if (format !== 'png') params.quality = quality;
      const { data } = await send('Page.captureScreenshot', params);
      await writeFile(file, Buffer.from(data, 'base64'));
    },
    async close() {
      ws.close();
      proc.kill();
      await sleep(300);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
  return page;
}
