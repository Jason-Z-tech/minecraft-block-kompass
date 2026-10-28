// „Meine Bauten“: eigene Bau-Dateien dauerhaft im Browser (IndexedDB „bk-mine“, getrennt vom Spieldaten-Speicher).
// Eintrag: { id, title, category, format, fileName, size, addedAt, source: { author, url, license } | null,
//            params | null, data: ArrayBuffer }.
// Gleiche Prüfung wie beim Upload (Endung, höchstens 64 MB, Inhalt mit denselben Lesern geprüft: Baupläne ganz
// gelesen, Modelle geparst); ZIP-Archive dürfen viele Bauten und eine manifest.json enthalten. Das Speicher-Backend
// ist austauschbar (Tests: im Arbeitsspeicher). Keine Netzanfragen. Ohne DOM-Zugriff beim Laden, daher in Node testbar.
import {
  IMPORT_LIMITS, UPLOAD_FORMATS, UPLOAD_ACCEPT, MODEL_FORMATS, NBT_FORMATS, ImportError, formatFromName, sniffContent, checkImportFile,
} from '../create/import/index.js';
import { CATEGORY_SLUGS } from '../ui/shared.js';
import { isSafeUrl } from '../ui/dom.js';
import { listZipEntries, readZipEntry, isZipData, ZipError } from './zip.js';

export const MINE_DB_NAME = 'bk-mine';
const DB_VERSION = 1;
const META_STORE = 'meta';
const DATA_STORE = 'data';
const OPEN_TIMEOUT_MS = 5000;

export const MINE_LIMITS = Object.freeze({
  maxFileBytes: IMPORT_LIMITS.maxFileBytes,
  maxUnpackedBytes: IMPORT_LIMITS.maxUnpackedBytes,
  maxZipEntries: 500,
  maxManifestBytes: 1024 * 1024,
  maxManifestItems: 1000,
  maxTitle: 120,
  maxFileName: 120,
  maxAuthor: 120,
  maxLicense: 120,
  maxUrl: 500,
});

/** accept= für die Dateiauswahl auf meine.html: alle Upload-Formate und ZIP-Archive */
export const MINE_ACCEPT = `${UPLOAD_ACCEPT},.zip`;

export const MINE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MINE_TEXTS = Object.freeze({
  quota: 'Der Speicher im Browser ist voll. Lösche Bauten, die du nicht mehr brauchst, und versuch es noch einmal.',
  unavailable: 'Dein Browser erlaubt hier keinen dauerhaften Speicher (z. B. im privaten Fenster).',
  unknownFormat: 'Unbekanntes Dateiformat. Möglich sind .schem, .litematic, .nbt, .stl, .obj, .glb, .gltf, .vox und .zip.',
  notMinecraft: 'Die Datei ist keine Minecraft-Datei: .schem, .litematic und .nbt sind (meist gepackte) NBT-Daten, diese Datei aber nicht.',
  notGltf: 'Die Datei ist kein glTF-Modell (kein JSON-Inhalt).',
  empty: 'Die Datei ist leer.',
  mtl: 'Enthält nur Farben einer .obj und wird nicht gebraucht.',
  nestedZip: 'Ein ZIP im ZIP wird nicht entpackt.',
  zipParent: 'Der Pfad im ZIP-Archiv enthält „..“ und wird nicht übernommen.',
  zipHidden: 'Liegt im ZIP-Archiv versteckt (Name mit Punkt am Anfang) und wird nicht übernommen.',
  zipNoBuilds: 'Das ZIP-Archiv enthält keine Bau-Dateien.',
  noTitle: 'Bitte einen Namen eingeben.',
  badCategory: 'Unbekannte Kategorie.',
  notFound: 'Diesen Bau gibt es in „Meine Bauten“ nicht (mehr).',
});

export class MyBuildsError extends Error {
  /** code: 'quota' | 'unavailable' | 'invalid' | 'not-found' */
  constructor(code, message, { cause = null } = {}) {
    super(message);
    this.name = 'MyBuildsError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

const formatMb = (bytes) => (bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 });

/* ------------------------------------------------------------------ IDs und Adressen */

export function isMyBuildId(id) {
  return typeof id === 'string' && MINE_ID_PATTERN.test(id);
}

/** Zufällige ID (UUID v4, klein geschrieben) */
export function newMyBuildId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID().toLowerCase();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Bau-Seite eines eigenen Baus: „bau.html?meine=<id>“ */
export function myBuildHref(id) {
  if (!isMyBuildId(id)) throw new TypeError('Ungültige ID eines eigenen Baus.');
  return `bau.html?meine=${id}`;
}

/** Fortschritt im localStorage: „bk:progress:mine:<id>“ */
export function myBuildProgressKey(id) {
  if (!isMyBuildId(id)) throw new TypeError('Ungültige ID eines eigenen Baus.');
  return `bk:progress:mine:${id}`;
}

/* ------------------------------------------------------------------ Bereinigen */

// Zeichenklassen aus Codepunkten gebaut (wie in shared.js), damit keine unsichtbaren Zeichen im Quelltext stehen.
// Unsichtbar: Nullbreite-Zeichen, Schreibrichtungs-Steuerung (Einbettung, Überschreibung, Isolierung) und BOM.
const charClass = (ranges) => new RegExp(`[${ranges.map(([from, to]) => `\\u{${from.toString(16)}}-\\u{${to.toString(16)}}`).join('')}]`, 'gu');
const CONTROL = charClass([[0x0000, 0x001f], [0x007f, 0x009f], [0x2028, 0x2029]]);
const INVISIBLE = charClass([[0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2060], [0x2066, 0x2069], [0xfeff, 0xfeff]]);

/** Eine Zeile Text: Steuerzeichen raus, Leerraum zusammenfassen, nach Codepunkten kürzen. */
export function cleanLine(value, max) {
  if (typeof value !== 'string') return '';
  const text = value.normalize('NFC').replace(INVISIBLE, '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, max).join('').trim();
}

/** Dateiname ohne Pfad (höchstens 120 Zeichen) */
export function cleanFileName(name) {
  const base = typeof name === 'string' ? name.split(/[\\/]/).pop() : '';
  return cleanLine(base, MINE_LIMITS.maxFileName) || 'Datei';
}

/** Titel aus dem Dateinamen: ohne Pfad und Endung */
export function titleFromFileName(name) {
  const base = cleanFileName(name);
  return cleanLine(base.replace(/\.[a-z0-9]{2,10}$/i, ''), MINE_LIMITS.maxTitle) || base;
}

/** Kategorie oder null (leer oder unbekannt) */
export function cleanCategory(value) {
  return typeof value === 'string' && CATEGORY_SLUGS.includes(value) ? value : null;
}

/** Nur https-Adressen mit Rechnername, ohne Zugangsdaten und unsichtbare Zeichen, höchstens 500 Zeichen – sonst null */
export function cleanUrl(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > MINE_LIMITS.maxUrl || !/^https:\/\//i.test(text) || !isSafeUrl(text)) return null;
  if (text.replace(INVISIBLE, '') !== text || text.replace(CONTROL, '') !== text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
  } catch {
    return null;
  }
  return text;
}

/** Herkunft { author, url, license } (je bereinigt, fehlende Felder null) oder null, wenn nichts übrig bleibt */
export function cleanSource(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = {
    author: cleanLine(raw.author, MINE_LIMITS.maxAuthor) || null,
    url: cleanUrl(raw.url),
    license: cleanLine(raw.license, MINE_LIMITS.maxLicense) || null,
  };
  return source.author || source.url || source.license ? source : null;
}

// Modell-Optionen wie modelParams auf „Selber erstellen“ (Prüfung im Detail macht der Voxelizer beim Laden)
const PARAM_CHECKS = Object.freeze({
  height: (value) => Number.isInteger(value) && value >= 1 && value <= 4096,
  solid: (value) => typeof value === 'boolean',
  palette: (value) => typeof value === 'string' && /^[a-z]{1,24}$/.test(value),
  block: (value) => typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value),
  upAxis: (value) => typeof value === 'string' && /^[a-z]{1,8}$/.test(value),
});

/** Modell-Optionen (nur bei 3D-Modellen): bekannte Schlüssel mit passendem Typ, sonst null */
export function cleanParams(format, raw) {
  if (!MODEL_FORMATS.includes(format) || !raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const params = {};
  for (const [key, check] of Object.entries(PARAM_CHECKS)) {
    if (Object.hasOwn(raw, key) && check(raw[key])) params[key] = raw[key];
  }
  return Object.keys(params).length ? params : null;
}

function cleanDate(value) {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** Gespeicherte Metadaten prüfen → Eintrag ohne data oder null (unbrauchbar) */
export function normalizeMeta(raw) {
  if (!raw || typeof raw !== 'object' || !isMyBuildId(raw.id) || !UPLOAD_FORMATS.includes(raw.format)) return null;
  const fileName = cleanFileName(raw.fileName);
  return {
    id: raw.id,
    title: cleanLine(raw.title, MINE_LIMITS.maxTitle) || titleFromFileName(fileName),
    category: cleanCategory(raw.category),
    format: raw.format,
    fileName,
    size: Number.isInteger(raw.size) && raw.size >= 0 ? raw.size : 0,
    addedAt: cleanDate(raw.addedAt),
    source: cleanSource(raw.source),
    params: cleanParams(raw.format, raw.params),
  };
}

/** Pfad im ZIP-Archiv vereinheitlichen: „\“ → „/“, leere Teile und „.“ weg („./a//b“ → „a/b“) */
export function normalizeZipPath(path) {
  return String(path).replaceAll('\\', '/').split('/').filter((part) => part !== '' && part !== '.').join('/');
}

/** manifest.json eines ZIP-Archivs → Map(Dateipfad → { title, category, source }); Unbrauchbares fällt weg. */
export function cleanManifest(json) {
  const items = new Map();
  const list = Array.isArray(json) ? json : Array.isArray(json?.builds) ? json.builds : [];
  for (const raw of list.slice(0, MINE_LIMITS.maxManifestItems)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.file !== 'string') continue;
    const file = normalizeZipPath(raw.file.trim());
    if (!file || file.length > 400 || items.has(file)) continue;
    items.set(file, {
      title: cleanLine(raw.title, MINE_LIMITS.maxTitle) || null,
      category: cleanCategory(raw.category),
      source: cleanSource(raw),
    });
  }
  return items;
}

/* ------------------------------------------------------------------ Dateien prüfen (wie beim Upload) */

/** Größe einer Datei prüfen → null oder Grund (leer, zu groß) */
export function sizeProblem(size, maxBytes = MINE_LIMITS.maxFileBytes) {
  if (!Number.isFinite(size) || size <= 0) return MINE_TEXTS.empty;
  if (size > maxBytes) return `Die Datei ist zu groß (${formatMb(size)} MB) – erlaubt sind höchstens ${formatMb(maxBytes)} MB.`;
  return null;
}

/** Vorprüfung ohne Lesen: { name, size } → { ok, format } | { ok: false, reason } */
export function checkBuildFile(file, { maxBytes = MINE_LIMITS.maxFileBytes } = {}) {
  const name = typeof file?.name === 'string' ? file.name : '';
  const format = formatFromName(name);
  if (!format) return { ok: false, reason: /\.mtl$/i.test(name) ? MINE_TEXTS.mtl : MINE_TEXTS.unknownFormat };
  const problem = sizeProblem(file.size, maxBytes);
  return problem ? { ok: false, reason: problem } : { ok: true, format };
}

/** Passt der Inhalt grob zum Format? (wie der Import: NBT-Formate brauchen NBT-Daten, .gltf braucht JSON) → null oder Grund */
export function checkContent(format, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 0) return MINE_TEXTS.empty;
  const sniff = sniffContent(bytes);
  if (NBT_FORMATS.includes(format) && sniff !== 'nbt' && sniff !== 'nbt-raw') return MINE_TEXTS.notMinecraft;
  if (format === 'gltf' && sniff !== 'json') return MINE_TEXTS.notGltf;
  return null;
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.byteOffset === 0 && data.byteLength === data.buffer.byteLength && data.buffer instanceof ArrayBuffer
      ? data.buffer
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return null;
}

/* ------------------------------------------------------------------ Backends */

const UNAVAILABLE = () => new MyBuildsError('unavailable', MINE_TEXTS.unavailable);

/** Speicher im Arbeitsspeicher (Tests). maxBytes simuliert einen vollen Speicher. */
export function createMemoryBackend({ maxBytes = Infinity } = {}) {
  const meta = new Map();
  const data = new Map();
  const used = () => [...data.values()].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  return {
    kind: 'memory',
    async list() { return [...meta.values()].map((item) => structuredClone(item)); },
    async getMeta(id) { return meta.has(id) ? structuredClone(meta.get(id)) : null; },
    async getData(id) { return data.has(id) ? data.get(id).slice(0) : null; },
    async put(item, buffer) {
      if (used() - (data.get(item.id)?.byteLength ?? 0) + buffer.byteLength > maxBytes) throw new MyBuildsError('quota', MINE_TEXTS.quota);
      meta.set(item.id, structuredClone(item));
      data.set(item.id, buffer.slice(0));
    },
    async putMeta(item) {
      if (!meta.has(item.id)) throw new MyBuildsError('not-found', MINE_TEXTS.notFound);
      meta.set(item.id, structuredClone(item));
    },
    async remove(id) {
      meta.delete(id);
      data.delete(id);
    },
    async close() {},
  };
}

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || error?.code === 22;
}

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
    const timer = setTimeout(() => finish(new Error('Öffnen dauert zu lange')), timeoutMs);
    let request;
    try {
      request = indexedDB.open(name, DB_VERSION);
    } catch (error) {
      finish(error);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
    };
    request.onsuccess = () => finish(null, request.result);
    request.onerror = () => finish(request.error ?? new Error('Öffnen abgelehnt'));
    request.onblocked = () => finish(new Error('Öffnen blockiert (ältere Version in einem anderen Tab offen)'));
  });
}

// work(stores, setResult) in einer Transaktion; erfüllt erst nach dem Abschluss. Speicher voll → MyBuildsError 'quota'.
function runTransaction(db, names, mode, work) {
  return new Promise((resolve, reject) => {
    const fail = (error) => reject(isQuotaError(error) ? new MyBuildsError('quota', MINE_TEXTS.quota, { cause: error }) : error);
    let transaction;
    try {
      transaction = db.transaction(names, mode);
    } catch (error) {
      fail(error);
      return;
    }
    let result;
    transaction.oncomplete = () => resolve(result);
    // Ein Fehler einer Anfrage steigt zur Transaktion auf; transaction.error ist dann noch leer
    transaction.onerror = (event) => fail(event?.target?.error ?? transaction.error ?? new Error('IndexedDB-Fehler'));
    transaction.onabort = () => fail(transaction.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
    try {
      const stores = Object.fromEntries(names.map((store) => [store, transaction.objectStore(store)]));
      work(stores, (value) => { result = value; });
    } catch (error) {
      try {
        transaction.abort();
      } catch { /* schon beendet */ }
      fail(error);
    }
  });
}

/** IndexedDB „bk-mine“ mit den Objektspeichern meta (Liste ohne Daten) und data (ArrayBuffer je ID). */
export function createIndexedDbBackend({ indexedDB = globalThis.indexedDB, name = MINE_DB_NAME, openTimeoutMs = OPEN_TIMEOUT_MS } = {}) {
  let dbPromise = null;
  async function database() {
    if (typeof indexedDB?.open !== 'function') throw UNAVAILABLE();
    if (!dbPromise) {
      dbPromise = openDatabase(indexedDB, name, openTimeoutMs).then((db) => {
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        return db;
      }, (error) => {
        dbPromise = null;
        console.warn('[Block-Kompass] Meine Bauten: Speicher nicht nutzbar:', error);
        throw UNAVAILABLE();
      });
    }
    return dbPromise;
  }
  const read = async (store, method, key) => {
    const db = await database();
    return runTransaction(db, [store], 'readonly', (stores, setResult) => {
      const request = key === undefined ? stores[store][method]() : stores[store][method](key);
      request.onsuccess = () => setResult(request.result ?? null);
    });
  };
  return {
    kind: 'indexeddb',
    list: () => read(META_STORE, 'getAll'),
    getMeta: (id) => read(META_STORE, 'get', id),
    getData: (id) => read(DATA_STORE, 'get', id),
    async put(item, buffer) {
      const db = await database();
      await runTransaction(db, [META_STORE, DATA_STORE], 'readwrite', (stores) => {
        stores[DATA_STORE].put(buffer, item.id);
        stores[META_STORE].put(item);
      });
    },
    async putMeta(item) {
      const db = await database();
      const found = await runTransaction(db, [META_STORE], 'readwrite', (stores, setResult) => {
        const request = stores[META_STORE].get(item.id);
        request.onsuccess = () => {
          setResult(Boolean(request.result));
          if (request.result) stores[META_STORE].put(item);
        };
      });
      if (!found) throw new MyBuildsError('not-found', MINE_TEXTS.notFound);
    },
    async remove(id) {
      const db = await database();
      await runTransaction(db, [META_STORE, DATA_STORE], 'readwrite', (stores) => {
        stores[META_STORE].delete(id);
        stores[DATA_STORE].delete(id);
      });
    },
    async close() {
      const pending = dbPromise;
      dbPromise = null;
      (await pending?.catch(() => null))?.close();
    },
  };
}

/* ------------------------------------------------------------------ Dauerhafter Speicher */

let persistRequested = false;

/** Bittet den Browser einmal still, die Daten nicht automatisch zu löschen (beim ersten Hinzufügen). */
export function requestPersistence(storage = globalThis.navigator?.storage) {
  if (persistRequested) return;
  persistRequested = true;
  try {
    const result = storage?.persist?.();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch { /* still: nicht schlimm */ }
}

/* ------------------------------------------------------------------ Meine Bauten */

const byNewest = (a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? '') || a.title.localeCompare(b.title, 'de');

function basename(path) {
  return path.split('/').pop();
}

/**
 * Eintrag eines ZIP-Archivs einordnen → { path, ignore, reason }: path ohne „./“; Mac-Reste (__MACOSX, .DS_Store,
 * „._*“) werden still übergangen (ignore); „..“ und versteckte Dateien oder Ordner bekommen einen Grund.
 */
export function zipEntryInfo(name) {
  const path = normalizeZipPath(name);
  const parts = path.split('/');
  const file = parts.at(-1);
  if (!path || parts.includes('__MACOSX') || file === '.DS_Store' || file.startsWith('._')) return { path, ignore: true, reason: null };
  if (parts.includes('..')) return { path, ignore: false, reason: MINE_TEXTS.zipParent };
  if (parts.some((part) => part.startsWith('.'))) return { path, ignore: false, reason: MINE_TEXTS.zipHidden };
  return { path, ignore: false, reason: null };
}

// Manifest-Einträge den Dateien zuordnen → Map(Pfad → Eintrag). Zuerst genau über den Pfad (ab dem Ordner der
// manifest.json, sonst ab der Wurzel); nur übrige Einträge über den Dateinamen, und nur wenn der eindeutig ist.
// Jeder Manifest-Eintrag gilt für höchstens eine Datei.
function matchManifest(manifest, folder, paths) {
  const matched = new Map();
  const available = new Set(paths);
  const unmatched = [];
  for (const [key, item] of manifest) {
    const exact = [normalizeZipPath(folder + key), key].find((candidate) => available.has(candidate));
    if (exact) {
      matched.set(exact, item);
      available.delete(exact);
    } else {
      unmatched.push([key, item]);
    }
  }
  const countBy = (list) => list.reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map());
  const keyCount = countBy(unmatched.map(([key]) => basename(key)));
  const fileCount = countBy([...available].map(basename));
  for (const [key, item] of unmatched) {
    const base = basename(key);
    if (keyCount.get(base) !== 1 || fileCount.get(base) !== 1) continue;
    const path = [...available].find((candidate) => basename(candidate) === base);
    matched.set(path, item);
    available.delete(path);
  }
  return matched;
}

/**
 * Meine Bauten über ein Backend (createIndexedDbBackend oder createMemoryBackend).
 * Alle Fehler für den User sind MyBuildsError mit verständlicher Meldung.
 */
export function createMyBuilds({ backend, now = () => new Date(), randomId = () => newMyBuildId() } = {}) {
  if (!backend || typeof backend.put !== 'function') throw new TypeError('createMyBuilds braucht ein Backend.');

  async function requireMeta(id) {
    const meta = isMyBuildId(id) ? normalizeMeta(await backend.getMeta(id)) : null;
    if (!meta) throw new MyBuildsError('not-found', MINE_TEXTS.notFound);
    return meta;
  }

  /**
   * Einen Bau speichern. input: { title?, category?, format?, fileName, data, source?, params? } → Eintrag ohne data.
   * Die Datei wird vorher mit denselben Lesern wie beim Upload geprüft (Baupläne ganz gelesen, Modelle geparst);
   * gespeichert wird das am Inhalt erkannte Format.
   */
  async function add(input) {
    const fileName = cleanFileName(input?.fileName);
    const declared = UPLOAD_FORMATS.includes(input?.format) ? input.format : formatFromName(fileName);
    if (!declared) throw new MyBuildsError('invalid', MINE_TEXTS.unknownFormat);
    const buffer = toArrayBuffer(input.data);
    if (!buffer || buffer.byteLength === 0) throw new MyBuildsError('invalid', MINE_TEXTS.empty);
    const problem = sizeProblem(buffer.byteLength);
    if (problem) throw new MyBuildsError('invalid', problem);
    const contentError = checkContent(declared, buffer);
    if (contentError) throw new MyBuildsError('invalid', contentError);
    if (input.category !== undefined && input.category !== null && input.category !== '' && !cleanCategory(input.category)) {
      throw new MyBuildsError('invalid', MINE_TEXTS.badCategory);
    }
    let checked;
    try {
      checked = await checkImportFile({ format: declared, name: fileName, data: buffer });
    } catch (error) {
      if (error instanceof ImportError) throw new MyBuildsError('invalid', error.message, { cause: error });
      throw error;
    }
    const format = UPLOAD_FORMATS.includes(checked?.format) ? checked.format : declared;
    const meta = {
      id: randomId(),
      title: cleanLine(input.title, MINE_LIMITS.maxTitle) || titleFromFileName(fileName),
      category: cleanCategory(input.category),
      format,
      fileName,
      size: buffer.byteLength,
      addedAt: now().toISOString(),
      source: cleanSource(input.source),
      params: cleanParams(format, input.params),
    };
    if (!isMyBuildId(meta.id)) throw new TypeError('randomId lieferte keine gültige ID.');
    await backend.put(meta, buffer);
    return meta;
  }

  // Ein ZIP-Archiv auspacken und jeden Bau darin speichern
  async function addZip(file, data, report) {
    let entries;
    try {
      entries = listZipEntries(data, { maxEntries: MINE_LIMITS.maxZipEntries });
    } catch (error) {
      if (error instanceof ZipError) {
        report.skipped.push({ name: file.name, reason: error.message });
        return;
      }
      throw error;
    }
    const before = { added: report.added.length, skipped: report.skipped.length };
    const files = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const info = zipEntryInfo(entry.name);
      if (info.ignore) continue;
      // Versteckte Dateien und „..“ nur melden, wenn es Bau-Dateien wären (sonst z. B. .git oder .gitignore)
      if (info.reason) {
        if (formatFromName(info.path) || /\.zip$/i.test(info.path)) report.skipped.push({ name: `${file.name}: ${entry.name}`, reason: info.reason });
        continue;
      }
      files.push({ entry, path: info.path });
    }
    // manifest.json: die mit dem kürzesten Pfad; Pfade darin gelten ab ihrem Ordner
    const manifestFile = files.filter(({ path }) => basename(path).toLowerCase() === 'manifest.json')
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0] ?? null;
    let manifest = new Map();
    if (manifestFile) {
      try {
        const bytes = await readZipEntry(data, manifestFile.entry, { maxBytes: MINE_LIMITS.maxManifestBytes });
        manifest = cleanManifest(JSON.parse(new TextDecoder('utf-8').decode(bytes)));
      } catch (error) {
        if (!(error instanceof ZipError) && !(error instanceof SyntaxError)) throw error;
        report.skipped.push({ name: `${file.name}: manifest.json`, reason: 'Nicht lesbar – die Bauten heißen wie ihre Dateien.' });
      }
    }
    const builds = files.filter((item) => item !== manifestFile);
    const folder = manifestFile ? manifestFile.path.slice(0, manifestFile.path.length - 'manifest.json'.length) : '';
    const infoByPath = matchManifest(manifest, folder, builds.map(({ path }) => path));
    let unpacked = 0;
    for (const { entry, path } of builds) {
      const label = `${file.name}: ${entry.name}`;
      if (/\.zip$/i.test(path)) {
        report.skipped.push({ name: label, reason: MINE_TEXTS.nestedZip });
        continue;
      }
      const check = checkBuildFile({ name: path, size: entry.size });
      if (!check.ok) {
        report.skipped.push({ name: label, reason: check.reason });
        continue;
      }
      if (unpacked + entry.size > MINE_LIMITS.maxUnpackedBytes) {
        report.skipped.push({ name: label, reason: `Das ZIP-Archiv ist entpackt größer als ${formatMb(MINE_LIMITS.maxUnpackedBytes)} MB.` });
        continue;
      }
      unpacked += entry.size;
      let bytes;
      try {
        bytes = await readZipEntry(data, entry, { maxBytes: MINE_LIMITS.maxFileBytes });
      } catch (error) {
        if (!(error instanceof ZipError)) throw error;
        report.skipped.push({ name: label, reason: error.message });
        continue;
      }
      const info = infoByPath.get(path) ?? null;
      await addOne(label, {
        title: info?.title ?? titleFromFileName(path),
        category: info?.category ?? null,
        format: check.format,
        fileName: basename(path),
        data: bytes,
        source: info?.source ?? null,
        params: null,
      }, report);
    }
    // Weder gespeichert noch gemeldet: im Archiv war kein Bau
    if (report.added.length === before.added && report.skipped.length === before.skipped) {
      report.skipped.push({ name: file.name, reason: MINE_TEXTS.zipNoBuilds });
    }
  }

  // Ungültige Dateien landen in skipped; Speicher voll oder nicht verfügbar bricht ab
  async function addOne(label, input, report) {
    try {
      report.added.push(await add(input));
    } catch (error) {
      if (error instanceof MyBuildsError && error.code === 'invalid') report.skipped.push({ name: label, reason: error.message });
      else throw error;
    }
  }

  /**
   * Dateien (File-Objekte oder { name, size, arrayBuffer() }) hinzufügen; ZIP-Archive werden ausgepackt.
   * → { added: [Eintrag], skipped: [{ name, reason }], notSaved: [Name], error: MyBuildsError | null }
   * Bei vollem oder fehlendem Speicher bricht es ab (error); die aktuelle und alle übrigen Dateien stehen dann in
   * notSaved (ein ZIP, aus dem schon Bauten gespeichert sind, mit „(teilweise)“). Schon Gespeichertes bleibt.
   */
  async function addFiles(files, { onProgress = null } = {}) {
    const list = Array.from(files ?? []).filter((file) => file && typeof file.name === 'string');
    const report = { added: [], skipped: [], notSaved: [], error: null };
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const addedBefore = report.added.length;
      if (typeof onProgress === 'function') onProgress({ index: i, total: list.length, name: file.name });
      try {
        const isZip = /\.zip$/i.test(file.name);
        // ZIP-Archive: gleiche Größengrenze wie jede andere Datei
        const zipProblem = isZip ? sizeProblem(file.size) : null;
        const check = isZip ? { ok: !zipProblem, reason: zipProblem } : checkBuildFile(file);
        if (!check.ok) {
          report.skipped.push({ name: file.name, reason: check.reason });
          continue;
        }
        let data;
        try {
          data = new Uint8Array(await file.arrayBuffer());
        } catch {
          report.skipped.push({ name: file.name, reason: 'Die Datei ließ sich nicht lesen.' });
          continue;
        }
        if (isZip) {
          if (!isZipData(data)) report.skipped.push({ name: file.name, reason: 'Die Datei ist kein gültiges ZIP-Archiv.' });
          else await addZip(file, data, report);
        } else {
          await addOne(file.name, { title: titleFromFileName(file.name), format: check.format, fileName: file.name, data }, report);
        }
      } catch (error) {
        if (!(error instanceof MyBuildsError)) throw error;
        report.error = error;
        report.notSaved = [report.added.length > addedBefore ? `${file.name} (teilweise)` : file.name, ...list.slice(i + 1).map((rest) => rest.name)];
        break;
      }
    }
    return report;
  }

  return {
    backend,
    add,
    addFiles,

    /** Alle Einträge ohne data, neueste zuerst */
    async list() {
      const raw = await backend.list();
      return (Array.isArray(raw) ? raw : []).map(normalizeMeta).filter(Boolean).sort(byNewest);
    },

    /** Eintrag mit data oder null (unbekannt, ungültige ID, Daten fehlen) */
    async get(id) {
      if (!isMyBuildId(id)) return null;
      const meta = normalizeMeta(await backend.getMeta(id));
      if (!meta) return null;
      const data = toArrayBuffer(await backend.getData(id));
      if (!data || data.byteLength === 0) return null;
      return { ...meta, data };
    },

    async rename(id, title) {
      const clean = cleanLine(title, MINE_LIMITS.maxTitle);
      if (!clean) throw new MyBuildsError('invalid', MINE_TEXTS.noTitle);
      const meta = await requireMeta(id);
      const next = { ...meta, title: clean };
      await backend.putMeta(next);
      return next;
    },

    /** category: Kategorie oder null/'' für „ohne Kategorie“ */
    async setCategory(id, category) {
      const clean = cleanCategory(category);
      if (category !== null && category !== undefined && category !== '' && !clean) throw new MyBuildsError('invalid', MINE_TEXTS.badCategory);
      const meta = await requireMeta(id);
      const next = { ...meta, category: clean };
      await backend.putMeta(next);
      return next;
    },

    /** → true, wenn es den Eintrag gab */
    async remove(id) {
      if (!isMyBuildId(id)) return false;
      const existed = Boolean(await backend.getMeta(id));
      await backend.remove(id);
      return existed;
    },
  };
}

let shared = null;

/** Meine Bauten im Browser (IndexedDB „bk-mine“), einmal je Seite */
export function openMyBuilds() {
  if (!shared) shared = createMyBuilds({ backend: createIndexedDbBackend() });
  return shared;
}
