// Lokaler Server: nur Anfragen mit eigenem Host-Namen (Schutz vor DNS-Rebinding).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer, isAllowedHost } from '../../scripts/serve.mjs';

function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    // agent: false = keine Keep-Alive-Verbindung, sonst wartet server.close() auf deren Zeitablauf
    const req = http.request({ host: '127.0.0.1', port, path: '/docs/ARCHITEKTUR.md', method: 'GET', headers: { host }, agent: false }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

test('isAllowedHost: nur 127.0.0.1 und localhost mit dem eigenen Port', () => {
  assert.equal(isAllowedHost('127.0.0.1:8080', 8080), true);
  assert.equal(isAllowedHost('LOCALHOST:8080', 8080), true);
  assert.equal(isAllowedHost('localhost:8081', 8080), false);
  assert.equal(isAllowedHost('evil.example:8080', 8080), false);
  assert.equal(isAllowedHost('127.0.0.1', 8080), false);
  assert.equal(isAllowedHost(undefined, 8080), false);
});

test('Server lehnt fremde Host-Namen ab und liefert bei eigenem Host normal aus', async () => {
  const server = await startServer({ port: 0 });
  try {
    assert.equal(await requestWithHost(server.port, `127.0.0.1:${server.port}`), 200);
    assert.equal(await requestWithHost(server.port, `localhost:${server.port}`), 200);
    assert.equal(await requestWithHost(server.port, `rebind.example:${server.port}`), 403);
    assert.equal(await requestWithHost(server.port, `127.0.0.1:${server.port + 1}`), 403);
  } finally {
    await server.close();
  }
});
