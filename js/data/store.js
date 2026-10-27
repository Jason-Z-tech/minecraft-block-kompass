// Dauerhafter Speicher für die umgewandelten Spieldaten im Browser (IndexedDB „block-kompass-data“, Objektspeicher
// „files“). Ohne IndexedDB (Node, privates Fenster, gesperrt, voll) bleiben die Daten nur im Arbeitsspeicher –
// nach außen gibt es nie einen Fehler, nur einmal eine Warnung in der Konsole. Läuft in Browser, Worker und Node.

// Erhöhen, wenn sich das umgewandelte Format ändert (die Schlüssel beginnen mit v<STORE_VERSION>|…).
export const STORE_VERSION = 1;

const DB_VERSION = 1;
const OBJECT_STORE = 'files';
const DEFAULT_OPEN_TIMEOUT_MS = 5000;

function describeError(error) {
  if (!error) return 'unbekannter Fehler';
  return error.name && error.message ? `${error.name}: ${error.message}` : String(error.message ?? error.name ?? error);
}

function checkKey(key) {
  if (typeof key !== 'string' || key === '') throw new TypeError('Spieldaten-Speicher: Schlüssel muss ein nicht leerer Text sein.');
}

// Öffnet die Datenbank; → IDBDatabase oder Fehler (auch bei Blockade und Zeitüberschreitung).
function openDatabase(indexedDB, name, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, db) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(db);
    };
    const timer = setTimeout(() => finish(new Error(`Öffnen dauert länger als ${timeoutMs / 1000} s`)), timeoutMs);
    let request;
    try {
      request = indexedDB.open(name, DB_VERSION);
    } catch (error) {
      finish(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OBJECT_STORE)) db.createObjectStore(OBJECT_STORE);
    };
    request.onsuccess = () => finish(null, request.result);
    request.onerror = () => finish(request.error ?? new Error('Öffnen abgelehnt'));
    request.onblocked = () => finish(new Error('Öffnen blockiert (ältere Version in einem anderen Tab offen)'));
  });
}

// Führt work(objectStore, setResult) in einer Transaktion aus; erfüllt erst, wenn die Transaktion abgeschlossen ist.
function runTransaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = db.transaction(OBJECT_STORE, mode);
    } catch (error) {
      reject(error);
      return;
    }
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB-Fehler'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
    try {
      work(transaction.objectStore(OBJECT_STORE), (value) => {
        result = value;
      });
    } catch (error) {
      try {
        transaction.abort();
      } catch { /* schon beendet */ }
      reject(error);
    }
  });
}

// → { get(key), put(key, value), keepOnly(prefix), backend(), close() }
export function createStore({
  name = 'block-kompass-data',
  indexedDB = globalThis.indexedDB,
  openTimeoutMs = DEFAULT_OPEN_TIMEOUT_MS,
  warn = (message) => console.warn(message),
} = {}) {
  const memory = new Map();
  let dbPromise = null;
  let usable = typeof indexedDB?.open === 'function';
  let writable = usable;
  let warned = false;

  const fallBack = (action, error, { onlyWrites = false } = {}) => {
    if (onlyWrites) writable = false;
    else {
      usable = false;
      writable = false;
    }
    if (warned) return;
    warned = true;
    warn(`Spieldaten-Speicher (IndexedDB) nicht nutzbar beim ${action} (${describeError(error)}) – `
      + 'die Spieldaten bleiben nur bis zum Neuladen der Seite erhalten.');
  };

  // → IDBDatabase oder null (dann nur Arbeitsspeicher)
  async function database() {
    if (!usable) return null;
    if (!dbPromise) {
      dbPromise = openDatabase(indexedDB, name, openTimeoutMs).then((db) => {
        // Ein anderer Tab will die Datenbank ändern: freigeben, beim nächsten Zugriff neu öffnen.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        return db;
      });
    }
    try {
      return await dbPromise;
    } catch (error) {
      fallBack('Öffnen', error);
      return null;
    }
  }

  return {
    async get(key) {
      checkKey(key);
      if (memory.has(key)) return memory.get(key);
      const db = await database();
      if (!db) return undefined;
      try {
        return await runTransaction(db, 'readonly', (store, setResult) => {
          const request = store.get(key);
          request.onsuccess = () => setResult(request.result);
        });
      } catch (error) {
        fallBack('Lesen', error);
        return undefined;
      }
    },

    async put(key, value) {
      checkKey(key);
      const db = writable ? await database() : null;
      if (db && writable) {
        try {
          await runTransaction(db, 'readwrite', (store) => {
            store.put(value, key);
          });
          memory.delete(key);
          return;
        } catch (error) {
          // z. B. QuotaExceededError: ab jetzt nur noch im Arbeitsspeicher ablegen (Lesen bleibt möglich).
          fallBack('Speichern', error, { onlyWrites: true });
        }
      }
      memory.set(key, value);
    },

    // Löscht alle Einträge, deren Schlüssel nicht mit prefix beginnt (alte Versionen, alte Commits).
    async keepOnly(prefix) {
      if (typeof prefix !== 'string') throw new TypeError('Spieldaten-Speicher: prefix muss ein Text sein.');
      for (const key of [...memory.keys()]) if (!key.startsWith(prefix)) memory.delete(key);
      const db = await database();
      if (!db) return;
      try {
        await runTransaction(db, 'readwrite', (store) => {
          const request = store.getAllKeys();
          request.onsuccess = () => {
            for (const key of request.result) {
              if (typeof key !== 'string' || !key.startsWith(prefix)) store.delete(key);
            }
          };
        });
      } catch (error) {
        fallBack('Aufräumen', error, { onlyWrites: true });
      }
    },

    // 'indexeddb' | 'memory' (nach dem ersten Öffnen; für Anzeige und Tests)
    async backend() {
      const db = await database();
      return db && writable ? 'indexeddb' : 'memory';
    },

    async close() {
      const pending = dbPromise;
      dbPromise = null;
      usable = false;
      writable = false;
      const db = await pending?.catch(() => null);
      db?.close();
    },
  };
}

// Führt fn exklusiv über alle Tabs und Worker desselben Ursprungs aus (Web Locks), ohne Web Locks direkt.
export async function withLock(name, fn, { locks = globalThis.navigator?.locks } = {}) {
  if (typeof fn !== 'function') throw new TypeError('withLock: fn muss eine Funktion sein.');
  if (typeof locks?.request !== 'function') return fn();
  let started = false;
  try {
    return await locks.request(name, () => {
      started = true;
      return fn();
    });
  } catch (error) {
    // Fehler von fn weiterreichen; scheitert nur die Sperre selbst (z. B. SecurityError), ohne Sperre ausführen.
    if (started) throw error;
    return fn();
  }
}
