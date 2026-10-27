import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, withLock, STORE_VERSION } from '../../js/data/store.js';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Kleine IndexedDB-Nachbildung mit denselben Ereignissen (onsuccess, oncomplete, onabort …), Werte als strukturierte Kopie.
// open: 'ok' | 'blocked' | 'error' | 'throw' | 'hang'; quota: put scheitert beim Abschluss mit QuotaExceededError.
function fakeIndexedDB({ open = 'ok', quota = false } = {}) {
  const databases = new Map();
  const counts = { opens: 0, puts: 0 };
  function makeTransaction(data, mode) {
    const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
    let pending = 0;
    let writes = 0;
    const settle = () => setTimeout(() => {
      if (pending > 0) return;
      if (quota && writes > 0) {
        transaction.error = new DOMException('Kontingent erschöpft', 'QuotaExceededError');
        transaction.onabort?.();
      } else transaction.oncomplete?.();
    }, 0);
    const request = (work) => {
      const req = { result: undefined, error: null, onsuccess: null, onerror: null };
      pending++;
      setTimeout(() => {
        req.result = work();
        req.onsuccess?.();
        pending--;
        settle();
      }, 0);
      return req;
    };
    const writable = () => {
      if (mode !== 'readwrite') throw new DOMException('nur lesen', 'ReadOnlyError');
      writes++;
    };
    transaction.objectStore = () => ({
      get: (key) => request(() => (data.has(key) ? structuredClone(data.get(key)) : undefined)),
      put: (value, key) => {
        writable();
        counts.puts++;
        const copy = structuredClone(value);
        return request(() => {
          if (!quota) data.set(key, copy);
          return key;
        });
      },
      delete: (key) => {
        writable();
        return request(() => {
          data.delete(key);
          return undefined;
        });
      },
      getAllKeys: () => request(() => [...data.keys()].sort()),
    });
    return transaction;
  }
  const factory = {
    counts,
    databases,
    open(name, version) {
      counts.opens++;
      if (open === 'throw') throw new DOMException('Speicher gesperrt', 'SecurityError');
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      setTimeout(() => {
        if (open === 'hang') return;
        if (open === 'blocked') {
          req.onblocked?.();
          return;
        }
        if (open === 'error') {
          req.error = new DOMException('Zugriff verweigert', 'UnknownError');
          req.onerror?.();
          return;
        }
        let entry = databases.get(name);
        const fresh = !entry;
        if (fresh) {
          entry = { version, stores: new Map() };
          databases.set(name, entry);
        }
        const db = {
          closed: false,
          objectStoreNames: { contains: (store) => entry.stores.has(store) },
          createObjectStore: (store) => entry.stores.set(store, new Map()),
          transaction(store, mode) {
            if (db.closed) throw new DOMException('Datenbank geschlossen', 'InvalidStateError');
            return makeTransaction(entry.stores.get(store), mode);
          },
          close() {
            db.closed = true;
          },
        };
        req.result = db;
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
  return factory;
}

function recordWarnings() {
  const messages = [];
  return { messages, warn: (message) => messages.push(message) };
}

test('Speicher ohne IndexedDB (Node): Arbeitsspeicher, Schlüssel, keepOnly, keine Warnung', async () => {
  assert.equal(STORE_VERSION, 1);
  const { messages, warn } = recordWarnings();
  const store = createStore({ indexedDB: undefined, warn });
  const object = { version: '26.2', list: [1, 2] };
  const bytes = new Uint8Array([1, 2, 255]);
  assert.equal(await store.get('v1|abc|names'), undefined);
  await store.put('v1|abc|names', object);
  await store.put('v1|abc|atlas-blocks', bytes);
  await store.put('v0|alt|names', { alt: true });
  assert.deepEqual(await store.get('v1|abc|names'), object);
  assert.deepEqual(await store.get('v1|abc|atlas-blocks'), bytes);
  await store.keepOnly('v1|abc|');
  assert.equal(await store.get('v0|alt|names'), undefined);
  assert.deepEqual(await store.get('v1|abc|names'), object);
  assert.equal(await store.backend(), 'memory');
  assert.deepEqual(messages, []);

  // Standard: globalThis.indexedDB gibt es in Node nicht.
  const plain = createStore();
  await plain.put('x', 1);
  assert.equal(await plain.get('x'), 1);
  assert.equal(await plain.backend(), 'memory');

  for (const bad of ['', null, 7, undefined, {}]) {
    await assert.rejects(store.get(bad), TypeError);
    await assert.rejects(store.put(bad, 1), TypeError);
  }
  await assert.rejects(store.keepOnly(null), TypeError);
});

test('Speicher mit IndexedDB: Kopien, dauerhaft über neue Instanzen, keepOnly löscht alte Schlüssel', async () => {
  const indexedDB = fakeIndexedDB();
  const { messages, warn } = recordWarnings();
  const store = createStore({ name: 'test-db', indexedDB, warn });
  const object = { version: '26.2', nested: { list: [1, 2, 3] } };
  await store.put('v1|abc|names', object);
  await store.put('v1|abc|atlas', new Uint8Array([9, 8, 7]));
  await store.put('v0|old|names', { old: true });
  await store.put('fremd', 'x');
  object.nested.list.push(4);
  const read = await store.get('v1|abc|names');
  assert.deepEqual(read, { version: '26.2', nested: { list: [1, 2, 3] } }, 'IndexedDB speichert eine Kopie');
  assert.equal(await store.backend(), 'indexeddb');

  const again = createStore({ name: 'test-db', indexedDB, warn });
  assert.deepEqual(await again.get('v1|abc|atlas'), new Uint8Array([9, 8, 7]));
  await again.keepOnly('v1|abc|');
  assert.deepEqual([...indexedDB.databases.get('test-db').stores.get('files').keys()].sort(), ['v1|abc|atlas', 'v1|abc|names']);
  assert.equal(await again.get('v0|old|names'), undefined);
  assert.equal(await again.get('gibt-es-nicht'), undefined);
  assert.equal(indexedDB.counts.opens, 2, 'jede Instanz öffnet einmal');
  assert.deepEqual(messages, []);
  await again.close();
});

test('Speicher: open blockiert, abgelehnt, wirft oder hängt → Arbeitsspeicher, genau eine Warnung', async () => {
  for (const open of ['blocked', 'error', 'throw', 'hang']) {
    const { messages, warn } = recordWarnings();
    const store = createStore({ indexedDB: fakeIndexedDB({ open }), warn, openTimeoutMs: 30 });
    await store.put('v1|a|names', { a: 1 });
    await store.put('v1|a|blocks', [1, 2]);
    assert.deepEqual(await store.get('v1|a|names'), { a: 1 }, open);
    assert.deepEqual(await store.get('v1|a|blocks'), [1, 2], open);
    await store.keepOnly('v1|a|');
    assert.equal(await store.backend(), 'memory', open);
    assert.equal(messages.length, 1, `${open}: ${messages.length} Warnungen`);
    assert.match(messages[0], /Spieldaten-Speicher \(IndexedDB\) nicht nutzbar beim Öffnen/);
    assert.match(messages[0], /bis zum Neuladen/);
  }
});

test('Speicher: Kontingent voll beim Speichern → Wert bleibt im Arbeitsspeicher, eine Warnung, Lesen aus IndexedDB geht weiter', async () => {
  const indexedDB = fakeIndexedDB();
  const first = createStore({ name: 'voll', indexedDB, warn: () => {} });
  await first.put('v1|a|names', { schon: 'da' });
  await first.close();

  const full = fakeIndexedDB({ quota: true });
  full.databases.set('voll', indexedDB.databases.get('voll'));
  const { messages, warn } = recordWarnings();
  const store = createStore({ name: 'voll', indexedDB: full, warn });
  await store.put('v1|a|models', { gross: true });
  await store.put('v1|a|textures', { auch: 'gross' });
  assert.deepEqual(await store.get('v1|a|models'), { gross: true });
  assert.deepEqual(await store.get('v1|a|textures'), { auch: 'gross' });
  assert.deepEqual(await store.get('v1|a|names'), { schon: 'da' }, 'ältere Einträge bleiben lesbar');
  assert.equal(full.counts.puts, 1, 'nach dem ersten Fehlschlag kein weiterer Schreibversuch');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /beim Speichern \(QuotaExceededError/);
  assert.equal(await store.backend(), 'memory');
});

test('withLock: ohne Web Locks direkt, mit Locks über request, Fehler von fn kommen durch', async () => {
  assert.equal(await withLock('x', () => 5, { locks: null }), 5);
  assert.equal(await withLock('x', async () => 6, { locks: undefined }), 6);
  assert.equal(await withLock('x', async () => 7), 7, 'Node hat kein navigator.locks');

  const requests = [];
  const locks = {
    request: async (name, callback) => {
      requests.push(name);
      await tick();
      return callback({ name, mode: 'exclusive' });
    },
  };
  assert.equal(await withLock('spieldaten-models', async () => 'ok', { locks }), 'ok');
  assert.deepEqual(requests, ['spieldaten-models']);

  let runs = 0;
  await assert.rejects(withLock('y', async () => {
    runs++;
    throw new Error('fn kaputt');
  }, { locks }), /fn kaputt/);
  assert.equal(runs, 1, 'fn wird bei eigenem Fehler nicht wiederholt');

  // Die Sperre selbst scheitert (z. B. SecurityError): fn läuft trotzdem genau einmal.
  const broken = { request: async () => { throw new DOMException('nicht erlaubt', 'SecurityError'); } };
  let calls = 0;
  assert.equal(await withLock('z', () => ++calls, { locks: broken }), 1);
  assert.equal(calls, 1);
  await assert.rejects(withLock('z', 'keine Funktion'), TypeError);
});

test('Speicher und Web Locks im echten Chrome (IndexedDB, Neuladen, keepOnly, Serialisierung)', async (t) => {
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
  const server = await startServer({ port: 0 });
  const dbName = `block-kompass-test-${process.pid}-${Date.now()}`;
  try {
    await browser.goto(`${server.url}/index.html`);
    const first = await browser.eval(`(async () => {
      const { createStore } = await import('/js/data/store.js');
      const name = ${JSON.stringify(dbName)};
      const store = createStore({ name });
      const object = { version: '26.2', list: [1, 2, 3], text: 'Grasblock ä' };
      await store.put('v1|abc|names', object);
      await store.put('v1|abc|atlas-blocks', new Uint8Array([0, 1, 2, 250, 255]));
      await store.put('v0|alt|names', { alt: true });
      object.list.push(4);
      const other = createStore({ name });
      const gotObject = await other.get('v1|abc|names');
      const gotBytes = await other.get('v1|abc|atlas-blocks');
      await other.keepOnly('v1|abc|');
      const third = createStore({ name });
      return {
        backend: await store.backend(),
        gotObject,
        bytesType: Object.prototype.toString.call(gotBytes),
        bytes: [...gotBytes],
        old: (await third.get('v0|alt|names')) ?? null,
        missing: (await third.get('gibt-es-nicht')) ?? null,
      };
    })()`);
    assert.deepEqual(first, {
      backend: 'indexeddb',
      gotObject: { version: '26.2', list: [1, 2, 3], text: 'Grasblock ä' },
      bytesType: '[object Uint8Array]',
      bytes: [0, 1, 2, 250, 255],
      old: null,
      missing: null,
    });

    // Nach dem Neuladen liegen die Daten noch in IndexedDB.
    await browser.reload();
    const afterReload = await browser.eval(`(async () => {
      const { createStore } = await import('/js/data/store.js');
      const store = createStore({ name: ${JSON.stringify(dbName)} });
      const bytes = await store.get('v1|abc|atlas-blocks');
      const keys = await new Promise((resolve, reject) => {
        const request = indexedDB.open(${JSON.stringify(dbName)});
        request.onsuccess = () => {
          const db = request.result;
          const keysRequest = db.transaction('files', 'readonly').objectStore('files').getAllKeys();
          keysRequest.onsuccess = () => { db.close(); resolve(keysRequest.result); };
          keysRequest.onerror = () => reject(keysRequest.error);
        };
        request.onerror = () => reject(request.error);
      });
      await store.close();
      return { names: await createStore({ name: ${JSON.stringify(dbName)} }).get('v1|abc|names'), bytes: [...bytes], keys };
    })()`);
    assert.deepEqual(afterReload, {
      names: { version: '26.2', list: [1, 2, 3], text: 'Grasblock ä' },
      bytes: [0, 1, 2, 250, 255],
      keys: ['v1|abc|atlas-blocks', 'v1|abc|names'],
    });

    // Web Locks: zwei Aufgaben mit derselben Sperre laufen nacheinander, eine andere Sperre läuft daneben.
    const locks = await browser.eval(`(async () => {
      const { withLock } = await import('/js/data/store.js');
      const order = [];
      const job = (lock, label, ms) => withLock(lock, async () => {
        order.push(label + ':start');
        const held = (await navigator.locks.query()).held.map((entry) => entry.name);
        await new Promise((resolve) => setTimeout(resolve, ms));
        order.push(label + ':end');
        return held;
      });
      const [heldA] = await Promise.all([job('spieldaten', 'a', 120), job('spieldaten', 'b', 10), job('anderes', 'c', 10)]);
      return { hasLocks: typeof navigator.locks?.request === 'function', order, heldA };
    })()`);
    assert.equal(locks.hasLocks, true);
    assert.ok(locks.heldA.includes('spieldaten'), `gehaltene Sperren: ${locks.heldA.join(', ')}`);
    const position = (label) => locks.order.indexOf(label);
    assert.ok(position('a:end') < position('b:start'), `Reihenfolge: ${locks.order.join(' ')}`);
    assert.ok(position('c:end') < position('a:end'), `andere Sperre wartet nicht: ${locks.order.join(' ')}`);

    const storeWarnings = browser.logs.filter((line) => line.includes('Spieldaten-Speicher'));
    assert.deepEqual(storeWarnings, [], 'IndexedDB lief ohne Rückfall');
    const storeErrors = browser.errors.filter((line) => /store\.js|IndexedDB|Spieldaten-Speicher/.test(line));
    assert.deepEqual(storeErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
