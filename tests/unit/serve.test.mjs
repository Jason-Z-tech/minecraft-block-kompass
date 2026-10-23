import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, resolveRequestPath } from '../../scripts/serve.mjs';

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
