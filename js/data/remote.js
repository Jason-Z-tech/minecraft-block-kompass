// Spieldaten im Browser („Weg A“): lädt die festen Einzeldateien aus misode/mcmeta (js/data/sources.js) und wandelt
// sie mit denselben Funktionen wie scripts/extract-game-data.mjs (js/data/convert.js) in genau das Format von
// game-data/ um. Jede Stufe einmal: im Arbeitsspeicher gemerkt, dauerhaft im Spieldaten-Speicher (IndexedDB,
// js/data/store.js), über Tabs und Worker hinweg nur ein Download (Web Locks). Läuft in Browser, Worker und Node.
//
// Stufen (Name = Schlüssel im Speicher, Stufe in onProgress):
//   names        names.json        (Sprachdateien de_de/en_us)
//   blocks       blocks.json       (version.json geprüft + Blockbericht)
//   atlas-data   Lage der Texturen in den drei Atlanten (intern, für models und textures)
//   models       models.json       (alle Blockstates und Modelle)
//   textures     textures.json     (Atlas-Einträge { atlas, x, y, w, h, anim, mip? }, .png.mcmeta der Animationen)
//   atlas:<name> PNG-Bytes eines Atlas (blocks, items, entities)
//   block-colors block-colors.json (nur auf Wunsch, Modell-Import)
// Fehler: NetError aus net.js (Netz, 404, 429, beschädigte Dateien – kind 'format') mit deutscher Meldung ohne Befehle.

import { NetError, createLimiter, fetchBytes as defaultFetchBytes, fetchJson as defaultFetchJson } from './net.js';
import { STORE_VERSION, createStore, withLock as defaultWithLock } from './store.js';
import {
  ATLASES, GAME_VERSION, LANG_FILES, LIMITS, MCMETA_COMMITS, MCMETA_TEXTURES, SUMMARY_FILES, atlasFiles, mcmetaUrl, textureMcmetaPath,
} from './sources.js';
import { BLOCK_COLORS_FORMAT } from '../create/voxelize/colors.js';
import {
  CONVERT_VERSION, MC_VERSION, buildModels, buildNames, convertMcmetaBlocks, createAssetsFromSummary, createWarnings, dict,
  isPlainObject, loadBlockstates, mcmetaBlocksData, readPngSize, selectTextureNames, textureEntry,
} from './convert.js';

// Schlüssel im Speicher: v<Speicherformat>.<Umwandlung>.<Blockfarben-Format>|<je 7 Zeichen der Commits>|<Stufe>. Ändert sich
// ein Commit, die Umwandlung (CONVERT_VERSION) oder ein Format, gelten die alten Einträge nicht mehr (keepOnly räumt sie
// beim ersten Zugriff weg) und Besucher bekommen frisch umgewandelte Daten.
export const STORE_PREFIX = `v${STORE_VERSION}.${CONVERT_VERSION}.${BLOCK_COLORS_FORMAT}|${Object.values(MCMETA_COMMITS).map((sha) => sha.slice(0, 7)).join('.')}|`;

// Deutsche Namen der Stufen für die Fortschrittsanzeige.
export const STAGE_LABELS = Object.freeze({
  names: 'Blocknamen',
  blocks: 'Blockliste',
  'atlas-data': 'Texturverzeichnis',
  models: 'Blockmodelle',
  textures: 'Texturen',
  'atlas:blocks': 'Block-Texturen',
  'atlas:items': 'Gegenstands-Texturen',
  'atlas:entities': 'Objekt-Texturen',
  'block-colors': 'Blockfarben',
});

// .png.mcmeta: höchstens so viele Downloads gleichzeitig (GitHub begrenzt ohne feste Zahl). Über HTTP/2 laufen sie auf einer
// Verbindung; 16 statt 6 spart beim ersten Besuch etwa eine halbe Sekunde (gemessen gegen raw.githubusercontent.com).
const MCMETA_CONCURRENCY = 16;
const FIXED_STAGES = new Set(['names', 'blocks', 'atlas-data', 'models', 'textures', 'block-colors']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function fileLabel(url) {
  const clean = String(url).split(/[?#]/)[0];
  return clean.slice(clean.lastIndexOf('/') + 1) || clean;
}

// Unerwarteter Inhalt einer (vollständig geladenen) Datei → NetError 'format' mit menschlicher Meldung.
function formatError(url, cause, what = `Die Spieldaten-Datei „${fileLabel(url)}“`, { plural = false } = {}) {
  const reason = cause?.message ? ` (${cause.message})` : '';
  const verbs = plural ? 'sind beschädigt oder haben' : 'ist beschädigt oder hat';
  return new NetError(`${what} ${verbs} ein unerwartetes Format${reason}.`, { kind: 'format', url, cause });
}

function isStageName(name) {
  if (typeof name !== 'string') return false;
  if (FIXED_STAGES.has(name)) return true;
  if (name.startsWith('atlas:')) return ATLASES.includes(name.slice('atlas:'.length));
  return false;
}

function isPngBytes(value) {
  return value instanceof Uint8Array && value.length > 8 && PNG_SIGNATURE.every((byte, i) => value[i] === byte);
}

// Atlas-Daten { "block/stone": [x, y, w, h], … } prüfen → Wörterbuch name → [x, y, w, h].
function checkAtlasData(raw, url) {
  if (!isPlainObject(raw)) throw formatError(url, new Error('kein Objekt'));
  const rects = dict();
  for (const [name, rect] of Object.entries(raw)) {
    const valid = Array.isArray(rect) && rect.length === 4 && rect.every((v) => Number.isInteger(v) && v >= 0) && rect[2] > 0 && rect[3] > 0;
    if (!valid) throw formatError(url, new Error(`Eintrag „${String(name).slice(0, 80)}“ ist kein Rechteck [x, y, w, h]`));
    rects[name] = rect;
  }
  return rects;
}

/**
 * Quelle für die Spieldaten aus misode/mcmeta. Alle Methoden liefern Promises; Objekte sind geteilt (nicht verändern).
 * Optionen (für Tests austauschbar): fetchJson/fetchBytes (net.js), store (createStore()), withLock (store.js),
 * onProgress({ stage, done, total }) – nur wenn wirklich geladen oder umgewandelt wird.
 */
export function createRemoteSource({
  fetchJson = defaultFetchJson,
  fetchBytes = defaultFetchBytes,
  store = null,
  withLock = defaultWithLock,
  onProgress = null,
} = {}) {
  const storage = store ?? createStore();
  const memo = new Map();
  const ready = new WeakSet();
  const limit = createLimiter(MCMETA_CONCURRENCY);
  let prepared = null;

  const progress = (stage, done, total) => {
    if (typeof onProgress !== 'function') return;
    try {
      onProgress({ stage, done, total });
    } catch { /* Anzeige darf das Laden nie stören */ }
  };

  // Einmal je Quelle: Einträge alter Versionen und Commits löschen.
  const prepare = () => {
    prepared ??= Promise.resolve().then(() => storage.keepOnly(STORE_PREFIX)).catch(() => {});
    return prepared;
  };

  // Speicherfehler verhindern nie ein Ergebnis: Lesen → „nicht da“, Schreiben → nur ohne Zwischenspeicher.
  const readStored = async (key) => {
    try {
      return await storage.get(key);
    } catch {
      return undefined;
    }
  };
  const writeStored = async (key, value) => {
    try {
      await storage.put(key, value);
    } catch { /* bleibt nur im Arbeitsspeicher dieser Quelle */ }
  };

  // Gespeicherte Form → Ergebnis (JSON-Text → Objekt wie JSON.parse von game-data/, PNG-Bytes unverändert; atlas() gibt
  // davon nur Kopien heraus).
  // Unbrauchbares (falscher Typ, kaputter Text) gilt als „nicht gespeichert“ und wird neu erzeugt.
  const decode = (name, stored) => {
    if (name.startsWith('atlas:')) {
      if (!isPngBytes(stored)) throw new TypeError('kein PNG');
      return stored;
    }
    if (typeof stored !== 'string') throw new TypeError('kein JSON-Text');
    const value = JSON.parse(stored);
    if (name === 'block-colors' && value?.format !== BLOCK_COLORS_FORMAT) throw new TypeError('altes Blockfarben-Format');
    return value;
  };
  const tryDecode = (name, stored) => {
    if (stored === undefined) return { ok: false };
    try {
      return { ok: true, value: decode(name, stored) };
    } catch {
      return { ok: false };
    }
  };

  // Ablauf je Stufe: gemerkte Promise → Speicher → Sperre (über Tabs/Worker) → Speicher erneut → erzeugen → speichern.
  // Fehler werden nicht gemerkt; der nächste Aufruf versucht es neu.
  function stage(name, produce) {
    const known = memo.get(name);
    if (known) return known;
    const key = STORE_PREFIX + name;
    const promise = (async () => {
      await prepare();
      const stored = tryDecode(name, await readStored(key));
      if (stored.ok) return stored.value;
      return withLock(`bk-data:${name}`, async () => {
        const again = tryDecode(name, await readStored(key));
        if (again.ok) return again.value;
        const made = await produce();
        await writeStored(key, made);
        return decode(name, made);
      });
    })();
    memo.set(name, promise);
    promise.then(() => ready.add(promise), () => {
      if (memo.get(name) === promise) memo.delete(name);
    });
    return promise;
  }

  const json = (url, maxBytes) => fetchJson(url, { maxBytes });

  // ------------------------------------------------------------------ Stufen

  function names() {
    return stage('names', async () => {
      const total = 3;
      let done = 0;
      progress('names', done, total);
      const load = async (path) => {
        const url = mcmetaUrl('assetsJson', path);
        const value = await json(url, LIMITS.lang);
        if (!isPlainObject(value)) throw formatError(url, new Error('kein Objekt'));
        progress('names', ++done, total);
        return value;
      };
      const [en, de] = await Promise.all([load(LANG_FILES.en), load(LANG_FILES.de)]);
      const text = JSON.stringify(buildNames(en, de));
      progress('names', total, total);
      return text;
    });
  }

  function blocks() {
    return stage('blocks', async () => {
      const total = 3;
      let done = 0;
      progress('blocks', done, total);
      const versionUrl = mcmetaUrl('summary', SUMMARY_FILES.version);
      const blocksUrl = mcmetaUrl('summary', SUMMARY_FILES.blocks);
      const step = (value) => {
        progress('blocks', ++done, total);
        return value;
      };
      const [version, raw] = await Promise.all([
        json(versionUrl, LIMITS.json).then(step),
        json(blocksUrl, LIMITS.json).then(step),
      ]);
      if (version?.id !== GAME_VERSION.id || version?.data_version !== GAME_VERSION.dataVersion) {
        const found = `Version „${String(version?.id ?? '?').slice(0, 40)}“, Datenversion ${String(version?.data_version ?? '?').slice(0, 20)}`;
        throw new NetError(`Die Spieldaten auf GitHub passen nicht zu Minecraft Java ${GAME_VERSION.id} (gefunden: ${found}, `
          + `erwartet: Datenversion ${GAME_VERSION.dataVersion}).`, { kind: 'format', url: versionUrl });
      }
      let data;
      try {
        data = mcmetaBlocksData(convertMcmetaBlocks(raw));
      } catch (error) {
        throw formatError(blocksUrl, error, 'Die Blockliste');
      }
      progress('blocks', total, total);
      return JSON.stringify(data);
    });
  }

  // Lage aller Texturen: { blocks: { name: [x, y, w, h] }, items: …, entities: … } (Reihenfolge wie ATLASES)
  function atlasData() {
    return stage('atlas-data', async () => {
      const total = ATLASES.length + 1;
      let done = 0;
      progress('atlas-data', done, total);
      const lists = await Promise.all(ATLASES.map(async (atlas) => {
        const url = mcmetaUrl('atlas', atlasFiles(atlas).data);
        const rects = checkAtlasData(await json(url, LIMITS.json), url);
        progress('atlas-data', ++done, total);
        return rects;
      }));
      const data = dict();
      ATLASES.forEach((atlas, index) => {
        data[atlas] = lists[index];
      });
      progress('atlas-data', total, total);
      return JSON.stringify(data);
    });
  }

  function models() {
    return stage('models', async () => {
      const total = 3;
      let done = 0;
      progress('models', done, total);
      const definitionsUrl = mcmetaUrl('summary', SUMMARY_FILES.blockDefinitions);
      const modelsUrl = mcmetaUrl('summary', SUMMARY_FILES.models);
      const load = async (url) => {
        const value = await json(url, LIMITS.json);
        if (!isPlainObject(value)) throw formatError(url, new Error('kein Objekt'));
        progress('models', ++done, total);
        return value;
      };
      const [blocksData, rects, definitions, modelFiles] = await Promise.all([blocks(), atlasData(), load(definitionsUrl), load(modelsUrl)]);
      let data;
      try {
        // Wie scripts/extract-game-data.mjs: Blockstates über loadBlockstates (sortiert), dann buildModels.
        const warnings = createWarnings();
        const textureNames = ATLASES.flatMap((atlas) => Object.keys(rects[atlas] ?? {}));
        const assets = createAssetsFromSummary({ blockstates: definitions, models: modelFiles, textureNames });
        const blockstates = loadBlockstates(assets, warnings);
        data = buildModels({ assets, blockstates, blocks: blocksData.blocks, warnings }).data;
      } catch (error) {
        throw formatError(modelsUrl, error, 'Die Blockmodelle', { plural: true });
      }
      const text = JSON.stringify(data);
      progress('models', total, total);
      return text;
    });
  }

  function textures() {
    return stage('textures', async () => {
      const [modelsData, rects] = await Promise.all([models(), atlasData()]);
      const where = new Map();
      for (const atlas of ATLASES) {
        for (const [name, rect] of Object.entries(rects[atlas] ?? {})) if (!where.has(name)) where.set(name, { atlas, rect });
      }
      // Wie buildTextures: genutzte Texturen ∪ vorhandene nach den Mustern, sortiert. Die drei Colormaps liegen in
      // keinem Atlas und fehlen darum (zur Laufzeit nicht gebraucht, js/render/tints.js).
      const names = selectTextureNames(modelsData.textures, where.keys());
      const withMeta = new Set(MCMETA_TEXTURES);
      const metaNames = names.filter((name) => withMeta.has(name));
      const total = metaNames.length + 1;
      let done = 0;
      progress('textures', done, total);
      const metas = new Map();
      // Scheitert eine Datei (z. B. 429), die übrigen sofort abbrechen statt im Hintergrund weiter bei GitHub anzufragen –
      // das verlängert sonst eine Sperre, und „Erneut versuchen“ stünde hinter dem Rückstand an.
      const abort = new AbortController();
      try {
        await Promise.all(metaNames.map((name) => limit(async () => {
          if (abort.signal.aborted) return;
          const url = mcmetaUrl('assets', textureMcmetaPath(name));
          metas.set(name, await fetchBytes(url, { maxBytes: LIMITS.mcmeta, signal: abort.signal }));
          progress('textures', ++done, total);
        })));
      } catch (error) {
        abort.abort();
        throw error;
      }
      const warnings = createWarnings();
      const entries = dict();
      for (const name of names) {
        const found = where.get(name);
        if (!found) continue;
        const [x, y, w, h] = found.rect;
        entries[name] = { atlas: found.atlas, x, y, ...textureEntry({ name, width: w, height: h, meta: metas.get(name), warnings }) };
      }
      const text = JSON.stringify({ version: MC_VERSION, entries });
      progress('textures', total, total);
      return text;
    });
  }

  // PNG-Bytes eines Atlas (Uint8Array; eine Kopie je Aufruf, darf also übertragen oder verändert werden).
  async function atlas(name) {
    const files = atlasFiles(name);
    const stageName = `atlas:${name}`;
    const bytes = await stage(stageName, async () => {
      progress(stageName, 0, 1);
      const url = mcmetaUrl('atlas', files.png);
      const png = await fetchBytes(url, { maxBytes: LIMITS.png });
      try {
        readPngSize(png);
      } catch (error) {
        throw formatError(url, error, `Der Textur-Atlas „${name}“`);
      }
      progress(stageName, 1, 1);
      return png;
    });
    return bytes.slice();
  }

  // Blockfarben für den Modell-Import (wie game-data/block-colors.json): Texturen aus den Atlanten ausschneiden.
  function blockColors() {
    return stage('block-colors', async () => {
      const [{ blockColorTextureNames, buildBlockColorsFrom }, { decodePng, cropImage }] = await Promise.all([
        import('./block-colors.js'),
        import('../render/texture-store.js'),
      ]);
      const [modelsJson, blocksJson, texturesJson] = await Promise.all([models(), blocks(), textures()]);
      const byAtlas = new Map();
      for (const name of blockColorTextureNames({ modelsJson, blocksJson })) {
        const entry = texturesJson.entries[name];
        if (!entry) continue; // buildBlockColorsFrom meldet die fehlende Textur selbst
        if (!byAtlas.has(entry.atlas)) byAtlas.set(entry.atlas, []);
        byAtlas.get(entry.atlas).push(name);
      }
      const total = byAtlas.size + 1;
      let done = 0;
      progress('block-colors', done, total);
      const images = new Map();
      // Nacheinander: ein dekodierter Atlas braucht viel Speicher (blocks 4 MB, entities 14 MB).
      for (const [atlasName, list] of [...byAtlas].sort(([a], [b]) => ATLASES.indexOf(a) - ATLASES.indexOf(b))) {
        const image = await decodePng(await atlas(atlasName));
        for (const name of list) {
          const { x, y, w, h } = texturesJson.entries[name];
          images.set(name, cropImage(image, x, y, w, h));
        }
        progress('block-colors', ++done, total);
      }
      const result = buildBlockColorsFrom({ modelsJson, blocksJson, texturesJson, textureImage: (name) => images.get(name) });
      const text = JSON.stringify(result);
      progress('block-colors', total, total);
      return text;
    });
  }

  // Liegt die Stufe schon vor (Arbeitsspeicher oder Speicher)? false heißt: sie muss erst geladen werden („einmalig von
  // GitHub laden“). Ein gespeicherter Eintrag wird dabei gleich übernommen, der folgende Aufruf liest ihn nicht noch einmal.
  async function isCached(name) {
    if (!isStageName(name)) throw new TypeError(`Unbekannte Spieldaten-Stufe „${String(name).slice(0, 80)}“.`);
    const known = memo.get(name);
    if (known && ready.has(known)) return true;
    await prepare();
    const stored = tryDecode(name, await readStored(STORE_PREFIX + name));
    if (!stored.ok) return false;
    if (!memo.has(name)) {
      const promise = Promise.resolve(stored.value);
      memo.set(name, promise);
      ready.add(promise);
    }
    return true;
  }

  return { names, blocks, models, textures, atlas, blockColors, isCached };
}
