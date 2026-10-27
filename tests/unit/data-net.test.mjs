import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NetError, fetchBytes, fetchJson, createLimiter, parseRetryAfter } from '../../js/data/net.js';
import { MCMETA_COMMITS } from '../../js/data/sources.js';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';
import { mirrorAvailable, mirrorOverrides } from '../lib/mcmeta-mirror.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const URL_JSON = 'https://raw.githubusercontent.com/misode/mcmeta/711a353b47d84e6cb592a1b72f682e5f44759284/version.json';
const encoder = new TextEncoder();

// Fake-fetch: arbeitet die Antworten der Reihe nach ab (Funktion, Response oder Fehler) und merkt sich jeden Aufruf.
function fakeFetch(...steps) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (typeof step === 'function') return step(url, options);
    if (step instanceof Error) throw step;
    return step;
  };
  return { fetch, calls };
}

const ok = (body, headers = {}) => new Response(typeof body === 'string' ? body : body, { status: 200, headers });
const status = (code, headers = {}) => () => new Response(`Fehler ${code}`, { status: code, headers });
const recordSleep = () => {
  const waits = [];
  return { waits, sleep: async (ms) => { waits.push(ms); } };
};

// Körper in Stücken ohne Content-Length; cancelled zeigt, ob der Leser abgebrochen hat.
function chunkedResponse(chunks, { endless = false } = {}) {
  const state = { cancelled: false, pulled: 0 };
  const stream = new ReadableStream({
    pull(controller) {
      if (state.pulled < chunks.length) controller.enqueue(chunks[state.pulled++]);
      else if (!endless) controller.close();
      // endless: nie mehr Daten und nie fertig (hängende Verbindung)
      else return new Promise(() => {});
      return undefined;
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { response: new Response(stream, { status: 200 }), state };
}

test('fetchBytes: einfache GET-Anfrage ohne eigene Header, ohne Cookies und Referrer', async () => {
  const { fetch, calls } = fakeFetch(() => ok(encoder.encode('hallo')));
  const bytes = await fetchBytes(URL_JSON, { maxBytes: 100, fetch });
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(new TextDecoder().decode(bytes), 'hallo');
  assert.equal(calls.length, 1);
  const [{ url, options }] = calls;
  assert.equal(url, URL_JSON);
  assert.equal(options.method, 'GET');
  assert.equal(options.headers, undefined, 'eigene Header lösen einen Preflight aus');
  assert.equal(options.body, undefined);
  assert.equal(options.mode, undefined);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.cache, 'default');
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(Object.keys(options).sort(), ['cache', 'credentials', 'method', 'redirect', 'referrerPolicy', 'signal']);
});

test('fetchBytes: Pflichtangaben werden geprüft', async () => {
  const { fetch } = fakeFetch(() => ok('x'));
  await assert.rejects(fetchBytes(URL_JSON, { fetch }), TypeError);
  await assert.rejects(fetchBytes(URL_JSON, { fetch, maxBytes: 0 }), TypeError);
  await assert.rejects(fetchBytes('', { fetch, maxBytes: 10 }), TypeError);
  await assert.rejects(fetchBytes(URL_JSON, { fetch: null, maxBytes: 10 }), (error) => error instanceof NetError && error.kind === 'network');
});

test('fetchBytes: wiederholt bei 429 (Retry-After beachtet) und 503, dann Erfolg', async () => {
  const { fetch, calls } = fakeFetch(status(429, { 'Retry-After': '2' }), status(503), () => ok('fertig'));
  const { waits, sleep } = recordSleep();
  const bytes = await fetchBytes(URL_JSON, { maxBytes: 100, fetch, sleep });
  assert.equal(new TextDecoder().decode(bytes), 'fertig');
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [2000, 1500], 'Retry-After 2 s statt 0,5 s, danach die normale Wartezeit');
});

test('fetchBytes: nach allen Versuchen ehrlicher Fehler; Wartezeiten 0,5 / 1,5 / 4 s', async () => {
  const { fetch, calls } = fakeFetch(status(503));
  const { waits, sleep } = recordSleep();
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 100, fetch, sleep }), (error) => {
    assert.ok(error instanceof NetError);
    assert.equal(error.kind, 'http');
    assert.equal(error.status, 503);
    assert.equal(error.url, URL_JSON);
    assert.match(error.message, /GitHub hat gerade Probleme \(Fehler 503\)/);
    return true;
  });
  assert.equal(calls.length, 4);
  assert.deepEqual(waits, [500, 1500, 4000]);

  const rate = fakeFetch(status(429));
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 100, fetch: rate.fetch, sleep: recordSleep().sleep, retries: 1 }), (error) => {
    assert.equal(error.kind, 'rate-limit');
    assert.equal(error.status, 429);
    assert.match(error.message, /GitHub begrenzt gerade die Downloads \(429\)\. Versuche es in ein paar Minuten noch einmal\./);
    return true;
  });
  assert.equal(rate.calls.length, 2);
});

test('fetchBytes: kein neuer Versuch bei 404, 403 und bei Retry-After über 20 s', async () => {
  for (const code of [404, 403, 400]) {
    const { fetch, calls } = fakeFetch(status(code));
    const { waits, sleep } = recordSleep();
    await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 100, fetch, sleep }), (error) => error.kind === 'http' && error.status === code);
    assert.equal(calls.length, 1, `HTTP ${code} wurde wiederholt`);
    assert.deepEqual(waits, []);
  }
  const notFound = fakeFetch(status(404));
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 100, fetch: notFound.fetch }), /„version\.json“ wurde nicht gefunden \(404\)/);

  const { fetch, calls } = fakeFetch(status(429, { 'Retry-After': '120' }));
  const { waits, sleep } = recordSleep();
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 100, fetch, sleep }), (error) => error.kind === 'rate-limit');
  assert.equal(calls.length, 1);
  assert.deepEqual(waits, []);
});

test('fetchBytes: Netzfehler werden wiederholt und deutsch gemeldet', async () => {
  const { fetch, calls } = fakeFetch(new TypeError('fetch failed'), () => ok('ok'));
  const { waits, sleep } = recordSleep();
  assert.equal(new TextDecoder().decode(await fetchBytes(URL_JSON, { maxBytes: 10, fetch, sleep })), 'ok');
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [500]);

  const down = fakeFetch(new TypeError('fetch failed'));
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch: down.fetch, sleep, retries: 2 }), (error) => {
    assert.equal(error.kind, 'network');
    assert.match(error.message, /^Keine Verbindung zu GitHub\. Prüfe die Internetverbindung/);
    assert.ok(error.cause instanceof TypeError);
    return true;
  });
  assert.equal(down.calls.length, 3);

  const local = fakeFetch(new TypeError('fetch failed'));
  await assert.rejects(fetchBytes('/__mcmeta/x/version.json', { maxBytes: 10, fetch: local.fetch, retries: 0 }), /: Keine Verbindung zum Server\. Prüfe die Internetverbindung/);
});

test('fetchBytes: Gerät meldet „offline“ → sofort Fehler ohne Warten, andere Fehler weiter mit Wiederholung', async () => {
  const offline = fakeFetch(new TypeError('fetch failed'));
  const { waits, sleep } = recordSleep();
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch: offline.fetch, sleep, isOffline: () => true }), (error) => error.kind === 'network');
  assert.equal(offline.calls.length, 1);
  assert.deepEqual(waits, []);
  // 503 ist kein Netzproblem des Geräts: wird trotz „offline“-Meldung wiederholt
  const busy = fakeFetch(status(503), () => ok('ok'));
  assert.equal(new TextDecoder().decode(await fetchBytes(URL_JSON, { maxBytes: 10, fetch: busy.fetch, sleep, isOffline: () => true })), 'ok');
  assert.equal(busy.calls.length, 2);
});

test('fetchBytes: Zeitlimit beim Warten auf die Antwort und beim Lesen des Körpers', async () => {
  // Antwortet nie, bricht nur über das Signal ab (wie echtes fetch).
  const hanging = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  const first = fakeFetch(hanging);
  const { waits, sleep } = recordSleep();
  const started = Date.now();
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch: first.fetch, sleep, timeoutMs: 40, retries: 1 }), (error) => {
    assert.equal(error.kind, 'timeout');
    assert.match(error.message, /antwortet zu langsam/);
    return true;
  });
  assert.equal(first.calls.length, 2);
  assert.deepEqual(waits, [500]);
  assert.ok(Date.now() - started < 2000);

  // Kopf kommt, Körper hängt (der Stream kennt das Signal nicht).
  const body = chunkedResponse([encoder.encode('ab')], { endless: true });
  const second = fakeFetch(() => body.response);
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch: second.fetch, timeoutMs: 40, retries: 0 }), (error) => error.kind === 'timeout');
  assert.equal(body.state.cancelled, true);
});

test('fetchBytes: Größengrenze über Content-Length und beim Lesen', async () => {
  const declared = fakeFetch(() => ok(encoder.encode('x'.repeat(20)), { 'Content-Length': '20' }));
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch: declared.fetch }), (error) => {
    assert.equal(error.kind, 'too-large');
    assert.match(error.message, /größer als erwartet/);
    return true;
  });
  assert.equal(declared.calls.length, 1, 'zu groß wird nicht wiederholt');

  const streamed = chunkedResponse([encoder.encode('12345'), encoder.encode('67890'), encoder.encode('X'), encoder.encode('nie gelesen')]);
  const stream = fakeFetch(() => streamed.response);
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch: stream.fetch }), (error) => error.kind === 'too-large');
  assert.equal(streamed.state.cancelled, true, 'Lesen abgebrochen');
  assert.ok(streamed.state.pulled <= 3 + 1);

  // Genau an der Grenze: erlaubt, mehrere Stücke werden zusammengesetzt.
  const exact = chunkedResponse([encoder.encode('12345'), encoder.encode('67890')]);
  const bytes = await fetchBytes(URL_JSON, { maxBytes: 10, fetch: fakeFetch(() => exact.response).fetch });
  assert.equal(new TextDecoder().decode(bytes), '1234567890');
});

test('fetchBytes: Abbruch von außen beendet sofort, auch während der Wartezeit', async () => {
  const controller = new AbortController();
  const { fetch, calls } = fakeFetch(status(503));
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    controller.abort(new DOMException('Benutzer hat abgebrochen', 'AbortError'));
    if (signal.aborted) reject(signal.reason);
  });
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch, sleep, signal: controller.signal }), (error) => error.name === 'AbortError');
  assert.equal(calls.length, 1);
  await assert.rejects(fetchBytes(URL_JSON, { maxBytes: 10, fetch, signal: controller.signal }), (error) => error.name === 'AbortError');
  assert.equal(calls.length, 1, 'schon abgebrochen: keine Anfrage');
});

test('fetchJson: JSON lesen (auch mit BOM), kaputte Dateien als format-Fehler', async () => {
  assert.deepEqual(await fetchJson(URL_JSON, { maxBytes: 100, fetch: fakeFetch(() => ok('{"id":"26.2"}')).fetch }), { id: '26.2' });
  assert.deepEqual(await fetchJson(URL_JSON, { maxBytes: 100, fetch: fakeFetch(() => ok('﻿[1,2]')).fetch }), [1, 2]);
  const broken = fakeFetch(() => ok('{"id":'));
  await assert.rejects(fetchJson(URL_JSON, { maxBytes: 100, fetch: broken.fetch }), (error) => {
    assert.ok(error instanceof NetError);
    assert.equal(error.kind, 'format');
    assert.match(error.message, /„version\.json“ ist beschädigt \(kein gültiges JSON\)/);
    return true;
  });
  assert.equal(broken.calls.length, 1, 'kaputtes JSON wird nicht neu geladen');
  await assert.rejects(fetchJson(URL_JSON, { maxBytes: 100, fetch: fakeFetch(() => ok(new Uint8Array([0x22, 0xff, 0x22]))).fetch }),
    (error) => error.kind === 'format');
  await assert.rejects(fetchJson(URL_JSON, { maxBytes: 100, fetch: fakeFetch(status(404)).fetch }), (error) => error.status === 404);
});

test('parseRetryAfter: Sekunden und HTTP-Datum', () => {
  assert.equal(parseRetryAfter('3'), 3000);
  assert.equal(parseRetryAfter(' 0 '), 0);
  assert.equal(parseRetryAfter('Tue, 27 Oct 2026 10:00:05 GMT', Date.parse('Tue, 27 Oct 2026 10:00:00 GMT')), 5000);
  assert.equal(parseRetryAfter('Tue, 27 Oct 2026 09:00:00 GMT', Date.parse('Tue, 27 Oct 2026 10:00:00 GMT')), 0);
  for (const bad of [null, undefined, '', 'bald', '-1', '1.5']) assert.equal(parseRetryAfter(bad), null, String(bad));
});

test('createLimiter: höchstens n gleichzeitig, Reihenfolge der Ergebnisse, Fehler blockieren nicht', async () => {
  assert.throws(() => createLimiter(0), TypeError);
  assert.throws(() => createLimiter(1.5), TypeError);
  const limit = createLimiter(2);
  let active = 0;
  let peak = 0;
  const releases = [];
  const task = (value) => () => new Promise((resolve, reject) => {
    active++;
    peak = Math.max(peak, active);
    releases.push(() => {
      active--;
      if (value === 'kaputt') reject(new Error('kaputt'));
      else resolve(value);
    });
  });
  const results = ['a', 'kaputt', 'c', 'd', 'e', 'f'].map((value) => limit(task(value)));
  let done = false;
  const settled = Promise.allSettled(results).then((outcome) => {
    done = true;
    return outcome;
  });
  for (let round = 0; round < 50 && !done; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(active <= 2, `${active} gleichzeitig`);
    while (releases.length > 0) releases.shift()();
  }
  const outcome = await settled;
  assert.equal(peak, 2);
  assert.deepEqual(outcome.map((entry) => entry.status), ['fulfilled', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
  assert.deepEqual(outcome.filter((entry) => entry.value).map((entry) => entry.value), ['a', 'c', 'd', 'e', 'f']);
  await assert.rejects(limit('keine Funktion'), TypeError);
  assert.equal(await limit(() => 42), 42, 'auch synchrone Funktionen');
  await assert.rejects(limit(() => {
    throw new Error('sofort');
  }), /sofort/);
});

test('net.js im echten Chrome: Spiegel über die umgeschriebene sources.js (gleicher Ursprung, CSP unverändert)', async (t) => {
  if (!mirrorAvailable()) {
    t.skip('Spiegel fehlt (node scripts/mirror-mcmeta.mjs)');
    return;
  }
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
  const server = await startServer({ port: 0, overrides: mirrorOverrides({ hideGameData: false }) });
  try {
    await browser.goto(`${server.url}/index.html`);
    const result = await browser.eval(`(async () => {
      const sources = await import('/js/data/sources.js');
      const net = await import('/js/data/net.js');
      const versionUrl = sources.mcmetaUrl('summary', sources.SUMMARY_FILES.version);
      const version = await net.fetchJson(versionUrl, { maxBytes: sources.LIMITS.json });
      const atlas = await net.fetchBytes(sources.mcmetaUrl('atlas', sources.atlasFiles('blocks').png), { maxBytes: sources.LIMITS.png });
      const limit = net.createLimiter(6);
      const mcmeta = await Promise.all(sources.MCMETA_TEXTURES.slice(0, 12).map((name) =>
        limit(() => net.fetchJson(sources.mcmetaUrl('assets', sources.textureMcmetaPath(name)), { maxBytes: sources.LIMITS.mcmeta }))));
      let missing = null;
      try {
        await net.fetchBytes(sources.mcmetaUrl('summary', 'gibt/es/nicht.json'), { maxBytes: 100 });
      } catch (error) {
        missing = { name: error.name, kind: error.kind, status: error.status, message: error.message };
      }
      return {
        versionUrl, id: version.id, dataVersion: version.data_version, atlasLength: atlas.length,
        atlasHead: [...atlas.slice(0, 8)], mcmetaCount: mcmeta.filter((entry) => entry && typeof entry === 'object').length, missing,
      };
    })()`);
    assert.equal(result.versionUrl, `/__mcmeta/${MCMETA_COMMITS.summary}/version.json`);
    assert.equal(result.id, '26.2');
    assert.equal(result.dataVersion, 4903);
    const atlasFile = path.join(ROOT, 'tmp', 'mcmeta-mirror', MCMETA_COMMITS.atlas, 'blocks', 'atlas.png');
    assert.equal(result.atlasLength, readFileSync(atlasFile).length);
    assert.deepEqual(result.atlasHead, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(result.mcmetaCount, 12);
    assert.deepEqual(result.missing, {
      name: 'NetError', kind: 'http', status: 404, message: 'Die Spieldaten-Datei „nicht.json“ wurde nicht gefunden (404).',
    });
    // Erwartet ist nur der absichtliche 404; keine CSP-Sperre und keine anderen Fehler beim Spiegel.
    const unexpected = browser.errors.filter((line) => line.includes('Content Security Policy')
      || (line.includes('__mcmeta/') && !line.includes('gibt/es/nicht')));
    assert.deepEqual(unexpected, []);
  } finally {
    await browser.close();
    await server.close();
  }
});

test('net.js im echten Chrome: Cross-Origin ohne Preflight, ohne Cookies und Referrer, Wiederholung bei 429', async (t) => {
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
  // Fremder Ursprung wie raw.githubusercontent.com: CORS „*“, beantwortet OPTIONS absichtlich mit 403.
  const seen = [];
  let rateLimited = 0;
  const origin = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, headers: req.headers });
    if (req.method === 'OPTIONS') {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.url === '/rate' && rateLimited++ === 0) {
      res.writeHead(429, { 'Access-Control-Allow-Origin': '*' });
      res.end('zu viele');
      return;
    }
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('{"id":"26.2"}');
  });
  await new Promise((resolve) => origin.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${origin.address().port}`;
  try {
    // about:blank (eigener, undurchsichtiger Ursprung, keine CSP); net.js hat keine Importe und läuft als Blob-Modul.
    const source = readFileSync(path.join(ROOT, 'js', 'data', 'net.js'), 'utf8');
    const result = await browser.eval(`(async () => {
      const net = await import(URL.createObjectURL(new Blob([${JSON.stringify(source)}], { type: 'text/javascript' })));
      const first = await net.fetchJson('${base}/version.json', { maxBytes: 1000 });
      const second = await net.fetchJson('${base}/rate', { maxBytes: 1000 });
      return { first, second };
    })()`);
    assert.deepEqual(result, { first: { id: '26.2' }, second: { id: '26.2' } });
    assert.deepEqual(seen.map((entry) => `${entry.method} ${entry.url}`), ['GET /version.json', 'GET /rate', 'GET /rate']);
    for (const { headers } of seen) {
      for (const name of ['referer', 'cookie', 'authorization', 'access-control-request-method', 'access-control-request-headers']) {
        assert.equal(headers[name], undefined, `Header ${name} gesendet`);
      }
      assert.equal(headers['sec-fetch-mode'], 'cors');
      assert.equal(headers.accept, '*/*');
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => origin.close(resolve));
  }
});
