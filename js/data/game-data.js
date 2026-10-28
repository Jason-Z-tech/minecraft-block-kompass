// Einzige Quelle der Spieldaten für die Seite (Fenster und Worker, ohne DOM): Namen, Blockliste, Blockmodelle,
// Texturen und Blockfarben.
//   lokal  (127.0.0.1, localhost, [::1] und game-data/meta.json vorhanden): genau die Dateien aus game-data/
//   remote (sonst, z. B. GitHub Pages oder das Handy): js/data/remote.js lädt sie aus misode/mcmeta und wandelt sie im
//          Browser in dasselbe Format um (Zwischenspeicher im Browser, beim zweiten Besuch ohne Download).
// Online fragt die Seite nie nach game-data/ (kein 404 in der Konsole). Fehler kommen als GameDataError mit
// menschlichem Titel und Text (ohne Befehle); die technische Ursache steht in cause.
// Ergebnis-Objekte sind je Kontext geteilt: nicht verändern.

const LOCAL_HOSTS = Object.freeze(['127.0.0.1', 'localhost', '[::1]']);
const DATA_ROOT = new URL('../../game-data/', import.meta.url);
const LOCAL_TIMEOUT_MS = 60_000;
// Stufen, die beim ersten Besuch einmal geladen werden (für needsDownload)
const FIRST_VISIT_STAGES = Object.freeze(['names', 'blocks', 'models', 'textures']);
// Grobe Gewichte der Stufen (etwa Downloadgröße bzw. Rechenzeit) für den Gesamtanteil der Anzeige
const STAGE_WEIGHTS = Object.freeze({
  names: 8,
  blocks: 2,
  'atlas-data': 3,
  models: 18,
  textures: 6,
  'atlas:blocks': 7,
  'atlas:items': 2,
  'atlas:entities': 10,
  'block-colors': 8,
});
const ONE_TIME_TITLE = 'Spieldaten von GitHub laden (einmalig)';

export function isLocalHost(hostname) {
  return typeof hostname === 'string' && LOCAL_HOSTS.includes(hostname);
}

/**
 * Spieldaten nicht verfügbar. kind: network | timeout | rate-limit | http | missing | too-large | damaged | version |
 * invalid | unknown; title und message sind für Menschen (ohne Befehle); file: betroffene Datei (falls bekannt).
 */
export class GameDataError extends Error {
  constructor(message, { kind = 'unknown', title = 'Spieldaten nicht verfügbar', file = null, status = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'GameDataError';
    this.kind = kind;
    this.title = title;
    this.file = file;
    this.status = status;
  }

  // Kann ein neuer Versuch helfen? (Netz, Zeitüberschreitung, Download-Grenze, Serverfehler)
  get retryable() {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'rate-limit' || (this.kind === 'http' && this.status >= 500);
  }
}

function fileName(url) {
  if (typeof url !== 'string' && !(url instanceof URL)) return null;
  const clean = String(url).split(/[?#]/)[0];
  return clean.slice(clean.lastIndexOf('/') + 1) || null;
}

// NetError aus js/data/net.js (Remote-Quelle) → GameDataError. Erkannt am Namen, damit es auch über Modulgrenzen gilt.
function fromNetError(error) {
  const file = fileName(error.url);
  const status = Number.isInteger(error.status) ? error.status : null;
  const options = { file, status, cause: error };
  switch (error.kind) {
    case 'network':
      return new GameDataError('Die Spieldaten konnten nicht von GitHub geladen werden. Prüfe die Internetverbindung.',
        { ...options, kind: 'network', title: 'Keine Verbindung zu GitHub' });
    case 'timeout':
      return new GameDataError('Die Spieldaten konnten nicht von GitHub geladen werden, die Verbindung ist zu langsam. Prüfe die Internetverbindung.',
        { ...options, kind: 'timeout', title: 'GitHub antwortet nicht' });
    case 'rate-limit':
      return new GameDataError('GitHub begrenzt gerade die Downloads. Versuche es in ein paar Minuten noch einmal.',
        { ...options, kind: 'rate-limit', title: 'GitHub bremst gerade' });
    case 'http':
      if (status !== null && status >= 500) {
        return new GameDataError(`GitHub hat gerade Probleme (Fehler ${status}). Versuche es etwas später noch einmal.`,
          { ...options, kind: 'http', title: 'GitHub hat gerade Probleme' });
      }
      if (status === 404) {
        return new GameDataError(`Ein Teil der Spieldaten${file ? ` („${file}“)` : ''} wurde auf GitHub nicht gefunden.`,
          { ...options, kind: 'missing', title: 'Spieldaten nicht gefunden' });
      }
      return new GameDataError(`GitHub hat den Download der Spieldaten abgelehnt${status !== null ? ` (Fehler ${status})` : ''}. Versuche es später noch einmal.`,
        { ...options, kind: 'http', title: 'Download abgelehnt' });
    case 'too-large':
      return new GameDataError(error.message, { ...options, kind: 'too-large', title: 'Spieldaten unerwartet groß' });
    case 'format':
      // Falsche Version: remote.js meldet sie an version.json ohne weitere Ursache (kaputtes JSON hat eine)
      if (file === 'version.json' && error.cause === undefined) {
        return new GameDataError(error.message, { ...options, kind: 'version', title: 'Spieldaten passen nicht' });
      }
      return new GameDataError(error.message, { ...options, kind: 'damaged', title: 'Spieldaten beschädigt' });
    default:
      return new GameDataError('Die Spieldaten konnten nicht geladen werden. Versuche es später noch einmal.',
        { ...options, kind: 'unknown', title: 'Spieldaten nicht verfügbar' });
  }
}

/**
 * Beliebiger Fehler beim Laden der Spieldaten → GameDataError mit menschlicher Meldung (Ursache in cause).
 * Versteht NetError (net.js), TextureSourceError (texture-store.js), ungültige Atlasnamen.
 */
export function toGameDataError(error) {
  if (error instanceof GameDataError || error?.name === 'GameDataError') return error;
  if (error?.name === 'NetError') return fromNetError(error);
  if (error?.name === 'TextureSourceError') {
    const inner = error.cause !== undefined && (error.cause?.name === 'GameDataError' || error.cause?.name === 'NetError')
      ? toGameDataError(error.cause) : null;
    if (inner) return new GameDataError(inner.message, { kind: inner.kind, title: inner.title, file: inner.file, status: inner.status, cause: error });
    const atlas = typeof error.atlas === 'string' ? ` („${error.atlas.slice(0, 40)}“)` : '';
    return new GameDataError(`Die Texturen${atlas} sind beschädigt und lassen sich nicht lesen. Versuche es später noch einmal.`,
      { kind: 'damaged', title: 'Texturen beschädigt', cause: error });
  }
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/^Unbekannter Atlas/.test(message)) {
    return new GameDataError(message, { kind: 'invalid', title: 'Ungültige Spieldaten-Anfrage', cause: error });
  }
  if (error?.name === 'AbortError') {
    return new GameDataError('Das Laden der Spieldaten wurde abgebrochen.', { kind: 'network', title: 'Laden abgebrochen', cause: error });
  }
  return new GameDataError('Die Spieldaten konnten nicht verarbeitet werden. Lade die Seite neu; hilft das nicht, versuche es später noch einmal.',
    { kind: 'unknown', title: 'Spieldaten nicht nutzbar', cause: error });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Fortschritt mehrerer Stufen (Gewichte STAGE_WEIGHTS) → ein grober Gesamtanteil 0 … 1 für die Anzeige. Er steigt
// innerhalb eines Ladevorgangs nie zurück: Kommt eine Stufe hinzu, verteilt sich der Rest bis 100 % neu. Sind alle
// Stufen fertig, beginnt die nächste neue Stufe einen neuen Ladevorgang bei 0 (z. B. später die Blockfarben).
function createProgressTracker() {
  let stages = new Map();
  let shown = 0;
  let base = 0;
  let rawBase = 0;
  const raw = () => {
    let weight = 0;
    let sum = 0;
    for (const entry of stages.values()) {
      const w = STAGE_WEIGHTS[entry.stage] ?? 1;
      weight += w;
      sum += w * (entry.done / entry.total);
    }
    return weight > 0 ? sum / weight : 0;
  };
  return (event) => {
    const key = event.stage;
    const total = Number.isFinite(event.total) && event.total > 0 ? event.total : 1;
    const done = Number.isFinite(event.done) ? Math.max(0, Math.min(total, event.done)) : 0;
    const finished = stages.size > 0 && [...stages.values()].every((entry) => entry.done >= entry.total);
    if (finished && !(stages.has(key) && done >= total)) {
      stages = new Map();
      shown = 0;
    }
    const added = !stages.has(key);
    stages.set(key, { stage: event.stage, done, total });
    const current = raw();
    if (added) {
      base = shown;
      rawBase = current;
    }
    const next = current >= 1 || rawBase >= 1 ? 1 : base + ((1 - base) * Math.max(0, current - rawBase)) / (1 - rawBase);
    shown = Math.min(1, Math.max(shown, next));
    return { share: shown, title: ONE_TIME_TITLE };
  };
}

function defaultPersist() {
  try {
    const result = globalThis.navigator?.storage?.persist?.();
    result?.catch?.(() => {});
  } catch { /* still: Speicher bleibt dann eben „best effort“ */ }
}

async function defaultCreateSource(options) {
  const remote = await import('./remote.js');
  return { source: remote.createRemoteSource(options), labels: remote.STAGE_LABELS };
}

/**
 * Spieldaten-Zugang für einen Kontext (für Tests mit eigenen Teilen):
 *   location  – { hostname } (Standard: globalThis.location)
 *   fetch     – für den lokalen Modus (Standard: globalThis.fetch)
 *   root      – URL von game-data/ (Standard: <Website-Wurzel>/game-data/)
 *   createSource({ onProgress }) → Promise<{ source, labels }> (Standard: createRemoteSource aus remote.js)
 *   persist() – einmal nach dem ersten erfolgreichen Remote-Laden (Standard: navigator.storage.persist, still)
 *   timeoutMs – Zeitlimit je lokaler Datei
 */
export function createGameData({
  location,
  fetch: fetchImpl,
  root = DATA_ROOT,
  createSource = defaultCreateSource,
  persist = defaultPersist,
  timeoutMs = LOCAL_TIMEOUT_MS,
} = {}) {
  const getLocation = () => (location === undefined ? globalThis.location : location);
  const doFetch = (...args) => (fetchImpl ?? globalThis.fetch)(...args);
  const base = new URL(root);
  const listeners = new Set();
  const track = createProgressTracker();
  const localMemo = new Map();
  let modePromise = null;
  let sourcePromise = null;
  let labels = {};
  let persisted = false;

  function emit(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.stage !== 'string') return;
    const { share, title } = track(raw);
    const event = {
      stage: raw.stage,
      label: labels[raw.stage] ?? raw.stage,
      done: raw.done,
      total: raw.total,
      share,
      text: `${title} … ${Math.floor(share * 100)} %`,
    };
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch { /* eine Anzeige darf das Laden nie stören */ }
    }
  }

  // 'local' | 'remote', einmal je Kontext. Online (nicht lokaler Rechner) ohne jede Anfrage nach game-data/.
  function dataMode() {
    modePromise ??= (async () => {
      if (!isLocalHost(getLocation()?.hostname)) return 'remote';
      try {
        const response = await doFetch(new URL('meta.json', base), { credentials: 'same-origin', cache: 'no-cache', signal: AbortSignal.timeout(10_000) });
        response.body?.cancel?.().catch?.(() => {});
        return response.ok ? 'local' : 'remote';
      } catch {
        return 'remote';
      }
    })();
    return modePromise;
  }

  // ---------------------------------------------------------------- lokal (game-data/)

  async function fetchLocal(file, as) {
    const label = `game-data/${file}`;
    let response;
    try {
      response = await doFetch(new URL(file, base), { credentials: 'same-origin', signal: AbortSignal.timeout(timeoutMs) });
    } catch (cause) {
      if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
        throw new GameDataError(`Das Laden von „${label}“ hat zu lange gedauert. Lade die Seite neu.`, { kind: 'timeout', title: 'Zeitüberschreitung', file, cause });
      }
      throw new GameDataError(`„${label}“ konnte nicht geladen werden. Lade die Seite neu.`, { kind: 'network', title: 'Keine Verbindung', file, cause });
    }
    if (response.status === 404) {
      throw new GameDataError(`Spieldaten fehlen: „${label}“ wurde nicht gefunden.`, { kind: 'missing', title: 'Spieldaten fehlen', file, status: 404 });
    }
    if (!response.ok) {
      throw new GameDataError(`„${label}“ konnte nicht geladen werden (Fehler ${response.status}).`,
        { kind: 'http', title: 'Spieldaten nicht ladbar', file, status: response.status });
    }
    let body;
    try {
      body = as === 'bytes' ? new Uint8Array(await response.arrayBuffer()) : await response.text();
    } catch (cause) {
      throw new GameDataError(`Die Übertragung von „${label}“ wurde abgebrochen. Lade die Seite neu.`, { kind: 'network', title: 'Übertragung abgebrochen', file, cause });
    }
    if (as === 'bytes') return body;
    let json;
    try {
      json = JSON.parse(body);
    } catch (cause) {
      throw new GameDataError(`„${label}“ ist beschädigt (kein gültiges JSON).`, { kind: 'damaged', title: 'Spieldaten beschädigt', file, cause });
    }
    if (!isPlainObject(json)) {
      throw new GameDataError(`„${label}“ hat nicht das erwartete Format.`, { kind: 'damaged', title: 'Spieldaten beschädigt', file });
    }
    return json;
  }

  // Feste Dateien einmal je Kontext; Fehler werden nicht behalten (neuer Versuch beim nächsten Aufruf).
  function localOnce(key, load) {
    let promise = localMemo.get(key);
    if (!promise) {
      promise = load();
      localMemo.set(key, promise);
      promise.catch(() => {
        if (localMemo.get(key) === promise) localMemo.delete(key);
      });
    }
    return promise;
  }

  const local = {
    names: () => localOnce('names', () => fetchLocal('names.json', 'json')),
    blocks: () => localOnce('blocks', () => fetchLocal('blocks.json', 'json')),
    models: () => localOnce('models', () => fetchLocal('models.json', 'json')),
    textures: () => localOnce('textures', async () => {
      const [json, bin] = await Promise.all([fetchLocal('textures.json', 'json'), fetchLocal('textures.bin', 'bytes')]);
      return { json, bin };
    }),
    blockColors: () => localOnce('block-colors', () => fetchLocal('block-colors.json', 'json')),
  };

  // ---------------------------------------------------------------- remote (misode/mcmeta)

  function getSource() {
    if (!sourcePromise) {
      sourcePromise = Promise.resolve()
        .then(() => createSource({ onProgress: emit }))
        .then((created) => {
          labels = created?.labels ?? {};
          return created.source;
        });
      sourcePromise.catch(() => { sourcePromise = null; });
    }
    return sourcePromise;
  }

  async function remote(use) {
    let source;
    try {
      source = await getSource();
    } catch (cause) {
      throw new GameDataError('Ein Teil der Seite konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu.',
        { kind: 'network', title: 'Keine Verbindung', cause });
    }
    let value;
    try {
      value = await use(source);
    } catch (error) {
      throw toGameDataError(error);
    }
    if (!persisted) {
      persisted = true;
      try {
        persist();
      } catch { /* still */ }
    }
    return value;
  }

  let remoteTextures = null;
  function remoteTexturesOnce() {
    if (!remoteTextures) {
      remoteTextures = remote(async (source) => ({
        json: await source.textures(),
        // Atlasbilder erst bei Bedarf (TextureStore.prepare); Fehler gleich menschlich, ohne gemerkt zu werden
        atlas: (name) => remote((current) => current.atlas(name)),
      }));
      remoteTextures.catch(() => { remoteTextures = null; });
    }
    return remoteTextures;
  }

  async function pick(localLoad, remoteLoad) {
    return (await dataMode()) === 'local' ? localLoad() : remoteLoad();
  }

  return {
    dataMode,
    loadNames: () => pick(local.names, () => remote((source) => source.names())),
    loadBlocks: () => pick(local.blocks, () => remote((source) => source.blocks())),
    loadModels: () => pick(local.models, () => remote((source) => source.models())),
    loadTextures: () => pick(local.textures, remoteTexturesOnce),
    loadBlockColors: () => pick(local.blockColors, () => remote((source) => source.blockColors())),
    // Muss beim ersten Laden etwas heruntergeladen werden? (lokal nie; online, bis alles im Browser gespeichert ist)
    async needsDownload(stages = FIRST_VISIT_STAGES) {
      if ((await dataMode()) === 'local') return false;
      try {
        const source = await getSource();
        const cached = await Promise.all(stages.map((name) => source.isCached(name)));
        return cached.some((value) => !value);
      } catch {
        return true;
      }
    },
    onProgress(listener) {
      if (typeof listener !== 'function') throw new TypeError('onGameDataProgress braucht eine Funktion.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// ------------------------------------------------------------------ Standard-Zugang dieses Kontexts

const defaultData = createGameData();

export const dataMode = () => defaultData.dataMode();
export const loadGameNames = () => defaultData.loadNames();
export const loadGameBlocks = () => defaultData.loadBlocks();
export const loadGameModels = () => defaultData.loadModels();
/** lokal: { json, bin } (textures.bin) · remote: { json, atlas: (name) => Promise<PNG-Bytes> } – für TextureStore.fromSource */
export const loadGameTextures = () => defaultData.loadTextures();
export const loadGameBlockColors = () => defaultData.loadBlockColors();
export const needsDownload = (stages) => defaultData.needsDownload(stages);
/**
 * listener({ stage, label, done, total, share, text }) bei jedem Lade- oder Umwandlungsschritt der Remote-Quelle
 * (nicht beim Lesen aus dem Speicher, lokal nie). share: grober Gesamtanteil 0 … 1; text: fertige Anzeige, z. B.
 * „Spieldaten von GitHub laden (einmalig) … 42 %“. → Abmeldefunktion
 */
export const onGameDataProgress = (listener) => defaultData.onProgress(listener);
