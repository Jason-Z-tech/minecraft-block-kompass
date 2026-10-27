import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, resolveRequestPath } from '../../scripts/serve.mjs';
import { mirrorOverrides, MIRROR_PREFIX } from '../lib/mcmeta-mirror.mjs';
import { MCMETA_COMMITS } from '../../js/data/sources.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('Pfade außerhalb des Projekts und versteckte Dateien werden abgelehnt', () => {
  assert.equal(resolveRequestPath(ROOT, '/../secret.txt'), path.join(ROOT, 'secret.txt'));
  assert.equal(resolveRequestPath(ROOT, '/%2e%2e/%2e%2e/windows/win.ini'), path.join(ROOT, 'windows', 'win.ini'));
  assert.equal(resolveRequestPath(ROOT, '/.git/config'), null);
  assert.equal(resolveRequestPath(ROOT, '/game-data/.cache/x.json'), null);
  assert.equal(resolveRequestPath(ROOT, '/a%5Cb'), null);
  assert.equal(resolveRequestPath(ROOT, '/a%00b'), null);
  assert.equal(resolveRequestPath(ROOT, '/%E0%A4%A'), null);
  assert.equal(resolveRequestPath(ROOT, '/'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/docs/'), path.join(ROOT, 'docs', 'index.html'));
});

test('Server liefert Dateien mit Sicherheits-Headern und blockt Unerlaubtes', async () => {
  const server = await startServer({ port: 0 });
  try {
    const doc = await fetch(`${server.url}/docs/ARCHITEKTUR.md`);
    assert.equal(doc.status, 200);
    assert.match(doc.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(doc.headers.get('x-content-type-options'), 'nosniff');

    assert.equal((await fetch(`${server.url}/.gitignore`)).status, 404);
    assert.equal((await fetch(`${server.url}/gibt-es-nicht.html`)).status, 404);
    assert.equal((await fetch(`${server.url}/docs/ARCHITEKTUR.md`, { method: 'POST' })).status, 405);

    const lastModified = doc.headers.get('last-modified');
    const cached = await fetch(`${server.url}/docs/ARCHITEKTUR.md`, { headers: { 'If-Modified-Since': lastModified } });
    assert.equal(cached.status, 304);
  } finally {
    await server.close();
  }
});

// Anfrage mit frei wählbarem Host-Header (fetch erlaubt das nicht).
function rawRequest(port, { method = 'GET', pathname = '/', host = `127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: pathname, headers: { host } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

test('overrides: Antworten aus dem Test vor der Dateisuche, mit Sicherheits-Headern und no-store', async () => {
  const asked = [];
  const overrides = async (pathname) => {
    asked.push(pathname);
    if (pathname === '/__test/text') return { body: 'hallo ä', type: 'text/plain; charset=utf-8' };
    if (pathname === '/__test/bytes') return { status: 201, body: new Uint8Array([1, 2, 3]), type: 'application/octet-stream' };
    if (pathname === '/__test/ohne-typ') return { body: 'x' };
    if (pathname === '/__test/ä') return { status: 404, body: 'weg', type: 'text/plain; charset=utf-8' };
    if (pathname === '/index.html') return { body: '<p>ersetzt</p>', type: 'text/html; charset=utf-8' };
    if (pathname === '/__test/kaputt') return { body: 5 };
    if (pathname === '/__test/wirft') throw new Error('Absicht');
    return null;
  };
  await assert.rejects(startServer({ port: 0, overrides: 'nein' }), TypeError);
  const server = await startServer({ port: 0, overrides });
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const text = await fetch(`${server.url}/__test/text?x=1#frag`);
    assert.equal(text.status, 200);
    assert.equal(await text.text(), 'hallo ä');
    assert.equal(text.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(text.headers.get('content-length'), String(Buffer.byteLength('hallo ä')));
    assert.equal(text.headers.get('cache-control'), 'no-store');
    assert.match(text.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(text.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(text.headers.get('x-frame-options'), 'DENY');
    assert.equal(text.headers.get('referrer-policy'), 'no-referrer');

    const bytes = await fetch(`${server.url}/__test/bytes`);
    assert.equal(bytes.status, 201);
    assert.deepEqual(new Uint8Array(await bytes.arrayBuffer()), new Uint8Array([1, 2, 3]));
    assert.equal((await fetch(`${server.url}/__test/ohne-typ`)).headers.get('content-type'), 'application/octet-stream');
    assert.equal((await fetch(`${server.url}/__test/%C3%A4`)).status, 404, 'Pfad kommt dekodiert an');

    // overrides sieht den Pfad wie angefragt: „/“ bleibt „/“ (normale Startseite), /index.html wird ersetzt.
    assert.equal(await (await fetch(`${server.url}/index.html`)).text(), '<p>ersetzt</p>');
    assert.match(await (await fetch(`${server.url}/`)).text(), /<!doctype html>/i);
    const head = await fetch(`${server.url}/__test/text`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(Buffer.byteLength('hallo ä')));
    assert.equal(await head.text(), '');

    // null → normale Datei
    const doc = await fetch(`${server.url}/docs/ARCHITEKTUR.md`);
    assert.equal(doc.status, 200);
    assert.equal(doc.headers.get('cache-control'), 'no-cache');

    assert.equal((await fetch(`${server.url}/__test/kaputt`)).status, 500);
    assert.equal((await fetch(`${server.url}/__test/wirft`)).status, 500);
    assert.equal(logged.length, 2);

    // Host- und Methodenprüfung kommen zuerst: overrides wird gar nicht gefragt.
    const before = asked.length;
    assert.equal(await rawRequest(server.port, { pathname: '/__test/text', host: 'boese.example:80' }), 403);
    assert.equal(await rawRequest(server.port, { pathname: '/__test/text', method: 'POST' }), 405);
    assert.equal(await rawRequest(server.port, { pathname: '/__test/text' }), 200);
    assert.deepEqual(asked.slice(before), ['/__test/text']);
    assert.ok(asked.includes('/'));
  } finally {
    console.error = originalError;
    await server.close();
  }
});

test('Spiegel-Testserver: /__mcmeta/ aus dem Spiegel, sources.js mit lokaler Basis, game-data versteckt', async () => {
  const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const mirrorDir = path.join(ROOT_DIR, 'tmp', `serve-mirror-test-${process.pid}`);
  const versionFile = path.join(mirrorDir, MCMETA_COMMITS.summary, 'version.json');
  const atlasFile = path.join(mirrorDir, MCMETA_COMMITS.atlas, 'blocks', 'atlas.png');
  await mkdir(path.dirname(atlasFile), { recursive: true });
  await mkdir(path.dirname(versionFile), { recursive: true });
  await writeFile(versionFile, '{"id":"26.2"}');
  await writeFile(atlasFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const server = await startServer({ port: 0, overrides: mirrorOverrides({ mirrorDir }) });
  const visible = await startServer({ port: 0, overrides: mirrorOverrides({ mirrorDir, hideGameData: false }) });
  try {
    const version = await fetch(`${server.url}${MIRROR_PREFIX}${MCMETA_COMMITS.summary}/version.json`);
    assert.equal(version.status, 200);
    assert.equal(version.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(version.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await version.json(), { id: '26.2' });
    const png = await fetch(`${server.url}/__mcmeta/${MCMETA_COMMITS.atlas}/blocks/atlas.png`);
    assert.equal(png.headers.get('content-type'), 'image/png');
    assert.deepEqual(new Uint8Array(await png.arrayBuffer()), new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    for (const bad of [
      `/__mcmeta/${MCMETA_COMMITS.summary}/fehlt.json`,
      `/__mcmeta/${MCMETA_COMMITS.atlas}/version.json`,
      '/__mcmeta/main/version.json',
      '/__mcmeta/',
      `/__mcmeta/${MCMETA_COMMITS.summary}`,
      `/__mcmeta/${MCMETA_COMMITS.summary}/`,
      `/__mcmeta/${MCMETA_COMMITS.summary}/..%5C..%5Cpackage.json`,
      `/__mcmeta/${MCMETA_COMMITS.summary}/version.json%00`,
      `/__mcmeta/${MCMETA_COMMITS.summary}/..%2F..%2Fpackage.json`,
      `/__mcmeta/${MCMETA_COMMITS.summary}/VERSION.json`,
    ]) {
      assert.equal((await fetch(`${server.url}${bad}`)).status, 404, bad);
    }

    const sources = await fetch(`${server.url}/js/data/sources.js`);
    assert.equal(sources.status, 200);
    assert.equal(sources.headers.get('content-type'), 'text/javascript; charset=utf-8');
    const text = await sources.text();
    assert.match(text, /^export const MCMETA_BASE = '\/__mcmeta\/';$/m);
    assert.doesNotMatch(text, /^export const MCMETA_BASE = 'https:/m);
    const original = await readFile(path.join(ROOT_DIR, 'js', 'data', 'sources.js'), 'utf8');
    assert.equal(text.split('\n').length, original.split('\n').length, 'nur die eine Zeile ist anders');

    assert.equal((await fetch(`${server.url}/game-data/meta.json`)).status, 404);
    assert.equal((await fetch(`${server.url}/game-data`)).status, 404);
    assert.equal((await fetch(`${server.url}/index.html`)).status, 200, 'alles andere normal');
    if (existsSync(path.join(ROOT_DIR, 'game-data', 'meta.json'))) {
      assert.equal((await fetch(`${visible.url}/game-data/meta.json`)).status, 200);
    }
  } finally {
    await server.close();
    await visible.close();
    await rm(mirrorDir, { recursive: true, force: true });
  }
});
