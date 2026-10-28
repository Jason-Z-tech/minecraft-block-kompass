// Laden der Daten der Seite (Katalog data/catalog.json; Spieldaten über js/data/game-data.js, lokal game-data/*.json,
// online aus misode/mcmeta) mit verständlichen Fehlern und Prüfung des Katalogs (§9). Fehlermeldungen sind für Menschen
// geschrieben und nennen keine Befehle (die Seite läuft auch als Webseite, z. B. auf dem Handy); technische Details
// hängen am Fehlerobjekt (cause, status).
import { SITE_ROOT, isSafeSitePath, isSafeUrl } from './dom.js';
import { CATEGORY_SLUGS, ACCURACY_KEYS, BUILD_ID_PATTERN, SIZE_CLASS_KEYS } from './shared.js';
import { loadGameBlocks, loadGameNames, toGameDataError } from '../data/game-data.js';
import { parseCommunityFile } from '../data/community.js';

// Der Katalog liegt im Repo (nur Projekttexte, Größen und Zahlen, keine Spieldaten) und wird mit der Seite veröffentlicht.
export const CATALOG_PATH = 'data/catalog.json';
// Logische Namen der Spieldaten (lokal liegen sie genau dort; online kommen sie über js/data/game-data.js)
export const NAMES_PATH = 'game-data/names.json';
export const BLOCKS_PATH = 'game-data/blocks.json';
// Lokale Vorschaubilder (scripts/make-thumbs.mjs): nur auf dem eigenen Rechner vorhanden, nie online.
export const THUMBS_INDEX_PATH = 'thumbs/index.json';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_SIZE = 4064;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

const STEP_RELOAD = { text: 'Lade die Seite neu. Hilft das nicht, versuche es später noch einmal.' };
const STEP_WAIT = { text: 'Warte ein paar Minuten und lade die Seite dann neu.' };

export class DataError extends Error {
  constructor(message, { kind, path, title, status = null, steps = [], cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'DataError';
    this.kind = kind;
    this.path = path;
    this.title = title;
    this.status = status;
    this.steps = steps;
  }
}

/** Was man bei einer fehlenden oder kaputten Datei tun kann (ohne Befehle: die Seite läuft auch online). */
export function recoverySteps() {
  return [STEP_RELOAD];
}

function isGameData(path) {
  return path.startsWith('game-data/');
}

function damagedTitle(path) {
  if (path === CATALOG_PATH) return 'Katalog beschädigt';
  return isGameData(path) ? 'Spieldaten beschädigt' : 'Datei beschädigt';
}

function missingTitle(path) {
  if (path === CATALOG_PATH) return 'Katalog fehlt';
  return isGameData(path) ? 'Spieldaten fehlen' : 'Datei nicht gefunden';
}

/** Läuft die Seite auf dem eigenen Rechner (127.0.0.1/localhost)? Nur dort gibt es lokale Vorschaubilder. */
export function isLocalSite(location = globalThis.location) {
  return typeof location?.hostname === 'string' && LOCAL_HOSTS.has(location.hostname);
}

export function isSafeDataPath(path) {
  return isSafeSitePath(path) && /^[a-z0-9][a-z0-9_./-]*\.json$/i.test(path) && !path.includes('//');
}

/**
 * Lädt eine JSON-Datei der Webseite (Pfad relativ zur Website-Wurzel, z. B. „game-data/names.json“).
 * Wirft DataError mit kind: invalid-path | missing | http | network | timeout | parse.
 */
export async function loadJson(path, { fetch: fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, root = SITE_ROOT } = {}) {
  if (!isSafeDataPath(path)) {
    throw new DataError('Diese Datenadresse ist nicht erlaubt.', { kind: 'invalid-path', path: String(path), title: 'Ungültige Datenadresse' });
  }
  const url = new URL(path, root);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
      throw new DataError(`Das Laden von „${path}“ hat zu lange gedauert.`, { kind: 'timeout', path, title: 'Zeitüberschreitung', steps: [STEP_RELOAD], cause });
    }
    throw new DataError(`„${path}“ konnte nicht geladen werden. Prüfe die Internetverbindung.`, { kind: 'network', path, title: 'Keine Verbindung', steps: [STEP_RELOAD], cause });
  }
  if (response.status === 404) {
    throw new DataError(`Die Datei „${path}“ wurde nicht gefunden.`, {
      kind: 'missing', path, status: 404, title: missingTitle(path), steps: recoverySteps(),
    });
  }
  if (!response.ok) {
    throw new DataError(`„${path}“ konnte nicht geladen werden (Fehler ${response.status}).`, { kind: 'http', path, status: response.status, title: 'Datei konnte nicht geladen werden', steps: [STEP_RELOAD] });
  }
  let text;
  try {
    text = await response.text();
  } catch (cause) {
    throw new DataError(`Die Übertragung von „${path}“ wurde abgebrochen.`, { kind: 'network', path, title: 'Übertragung abgebrochen', steps: [STEP_RELOAD], cause });
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new DataError(`„${path}“ ist beschädigt (kein gültiges JSON).`, { kind: 'parse', path, title: damagedTitle(path), steps: recoverySteps(), cause });
  }
}

function formatError(path, detail) {
  return new DataError(`„${path}“ hat nicht das erwartete Format (${detail}).`, { kind: 'format', path, title: path === CATALOG_PATH ? 'Katalog unvollständig' : 'Spieldaten unvollständig', steps: recoverySteps() });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanTextList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim() !== '').slice(0, maxItems).map((item) => item.trim().slice(0, maxLength));
}

function cleanInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function cleanSize(value) {
  return Array.isArray(value) && value.length === 3 && value.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_SIZE) ? [...value] : null;
}

function cleanMaterials(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && /^[a-z0-9_]{1,80}$/.test(entry[0]) && Number.isInteger(entry[1]) && entry[1] >= 0)
    .slice(0, 20)
    .map(([item, count]) => [item, count]);
}

function cleanPath(value, pattern) {
  return typeof value === 'string' && pattern.test(value) && isSafeSitePath(value) ? value : null;
}

function cleanHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim()) && isSafeUrl(value.trim()) ? value.trim() : null;
}

function cleanScale(value) {
  return typeof value === 'number' && value > 0 && value <= 4 ? value : null;
}

function cleanSources(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((source) => isPlainObject(source) && cleanText(source.title, 200) && cleanHttpsUrl(source.url))
    .slice(0, 20)
    .map((source) => ({ title: cleanText(source.title, 200), url: cleanHttpsUrl(source.url) }));
}

function cleanCredits(value) {
  if (!isPlainObject(value)) return null;
  const author = cleanText(value.author, 120);
  return author ? { author, url: cleanHttpsUrl(value.url), license: cleanText(value.license, 120) || null, licenseUrl: cleanHttpsUrl(value.licenseUrl) } : null;
}

/** Community-Bau (§9.2): { file: '<id>.nbt|schem|litematic', format } – nur ein Dateiname ohne Pfad, sonst null */
export function cleanCommunity(value) {
  if (!isPlainObject(value)) return null;
  const parsed = parseCommunityFile(value.file);
  return parsed && (value.format === undefined || value.format === parsed.format) ? { file: value.file, format: parsed.format } : null;
}

/** variants: { "<maßstab>": { size, blocks, steps } } – nur gültige Maßstäbe als Schlüssel */
function cleanVariants(value) {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value)
    .filter(([key, variant]) => /^\d{1,2}(?:\.\d{1,4})?$/.test(key) && cleanScale(Number(key)) !== null && isPlainObject(variant))
    .slice(0, 12)
    .map(([key, variant]) => [key, { size: cleanSize(variant.size), blocks: cleanInteger(variant.blocks, 0, 3_000_000), steps: cleanInteger(variant.steps, 0, 65534) }]);
  return entries.length ? Object.fromEntries(entries) : null;
}

// Felder des Katalogs ab Runde 2; sie erscheinen im Ergebnis nur, wenn der Eintrag sie hat (ältere Kataloge bleiben gleich)
const EXTENDED_FIELDS = {
  description: (value) => cleanText(value, 2000),
  sources: cleanSources,
  credits: cleanCredits,
  community: cleanCommunity,
  defaultScale: cleanScale,
  variants: cleanVariants,
  phases: (value) => cleanInteger(value, 0, 65534),
  sizeClass: (value) => (SIZE_CLASS_KEYS.includes(value) ? value : null),
};

function extendedFields(entry) {
  return Object.fromEntries(Object.entries(EXTENDED_FIELDS).filter(([key]) => Object.hasOwn(entry, key)).map(([key, clean]) => [key, clean(entry[key])]));
}

/**
 * Prüft einen Katalog-Eintrag. Ohne gültige ID, Titel und Kategorie wird er verworfen;
 * andere ungültige Felder werden auf einen leeren Wert gesetzt. Unbekannte Felder (z. B. das alte
 * difficulty oder facts) werden nicht übernommen.
 */
export function normalizeBuild(entry) {
  if (!isPlainObject(entry)) return { ok: false, reason: 'kein Objekt' };
  if (typeof entry.id !== 'string' || !BUILD_ID_PATTERN.test(entry.id)) return { ok: false, reason: 'ungültige ID' };
  const title = cleanText(entry.title, 120);
  if (!title) return { ok: false, reason: `${entry.id}: Titel fehlt` };
  if (!CATEGORY_SLUGS.includes(entry.category)) return { ok: false, reason: `${entry.id}: unbekannte Kategorie` };
  return {
    ok: true,
    build: {
      id: entry.id,
      title,
      category: entry.category,
      subtitle: cleanText(entry.subtitle, 200),
      tags: cleanTextList(entry.tags, 12, 40),
      aliases: cleanTextList(entry.aliases, 30, 80),
      accuracy: ACCURACY_KEYS.includes(entry.accuracy) ? entry.accuracy : null,
      size: cleanSize(entry.size),
      blocks: cleanInteger(entry.blocks, 0, 3_000_000),
      steps: cleanInteger(entry.steps, 0, 65534),
      topMaterials: cleanMaterials(entry.topMaterials),
      module: cleanPath(entry.module, /^js\/builds\/[a-z]+\/[a-z0-9-]{2,80}\.js$/),
      scales: Array.isArray(entry.scales) ? entry.scales.filter((s) => typeof s === 'number' && s > 0 && s <= 4) : [],
      tested: entry.tested === true || entry.tested === false ? entry.tested : null,
      thumb: cleanPath(entry.thumb, /^thumbs\/[a-z0-9-]{2,80}\.(?:webp|png|avif|jpg)$/),
      ...extendedFields(entry),
    },
  };
}

export function normalizeCatalog(json, path = CATALOG_PATH) {
  if (!isPlainObject(json)) throw formatError(path, 'kein Objekt');
  if (!Array.isArray(json.builds)) throw formatError(path, '„builds“ fehlt');
  const builds = [];
  const skipped = [];
  const seen = new Set();
  json.builds.forEach((entry, index) => {
    const result = normalizeBuild(entry);
    if (!result.ok) skipped.push(`Eintrag ${index + 1}: ${result.reason}`);
    else if (seen.has(result.build.id)) skipped.push(`Eintrag ${index + 1}: ID „${result.build.id}“ doppelt`);
    else {
      seen.add(result.build.id);
      builds.push(result.build);
    }
  });
  if (skipped.length) console.warn(`[Block-Kompass] ${skipped.length} Einträge in ${path} übersprungen:`, skipped);
  return {
    generatedAt: typeof json.generatedAt === 'string' ? json.generatedAt : null,
    version: typeof json.version === 'string' ? json.version : null,
    builds,
    skipped: skipped.length,
  };
}

/**
 * IDs mit lokalem Vorschaubild aus thumbs/index.json (Format von scripts/make-thumbs.mjs: { version: 1, entries: { id: … } }).
 * Nur auf dem eigenen Rechner: online gibt es keine Vorschaubilder (sie enthalten Spieltexturen) und keine Anfrage danach.
 * Fehlt oder stört die Datei, gibt es eben keine Bilder (leere Menge, Hinweis in der Konsole).
 */
export async function loadLocalThumbIds({ location = globalThis.location, ...options } = {}) {
  if (!isLocalSite(location)) return new Set();
  try {
    const index = await loadJson(THUMBS_INDEX_PATH, { timeoutMs: 5000, ...options });
    if (!isPlainObject(index) || index.version !== 1 || !isPlainObject(index.entries)) throw new Error('unbekanntes Format');
    return new Set(Object.keys(index.entries).filter((id) => BUILD_ID_PATTERN.test(id)));
  } catch (error) {
    if (error?.kind !== 'missing') console.warn(`[Block-Kompass] ${THUMBS_INDEX_PATH} nicht nutzbar, Karten zeigen Icons:`, error);
    return new Set();
  }
}

/** Trägt lokale Vorschaubilder (thumbs/<id>.webp) in Einträge ohne Bild ein. ids: Ergebnis von loadLocalThumbIds. */
export function applyThumbs(builds, ids) {
  for (const build of builds) {
    if (!build.thumb && ids.has(build.id)) build.thumb = `thumbs/${build.id}.webp`;
  }
  return builds;
}

/** Lädt und prüft data/catalog.json; auf dem eigenen Rechner kommen vorhandene Vorschaubilder dazu. */
export async function loadCatalog(options = {}) {
  const [json, thumbIds] = await Promise.all([loadJson(CATALOG_PATH, options), loadLocalThumbIds(options)]);
  const catalog = normalizeCatalog(json);
  applyThumbs(catalog.builds, thumbIds);
  return catalog;
}

/**
 * Fehler der Spieldaten (GameDataError aus js/data/game-data.js oder unbekannt) → DataError mit gleichem kind, Titel und
 * Text (network, timeout, rate-limit, http, missing, too-large, damaged, version, invalid, unknown) und einem Schritt
 * ohne Befehle.
 */
export function gameDataToDataError(error, path) {
  const failure = toGameDataError(error);
  return new DataError(failure.message, {
    kind: failure.kind, path, title: failure.title, status: failure.status ?? null,
    steps: [failure.kind === 'rate-limit' ? STEP_WAIT : STEP_RELOAD], cause: failure,
  });
}

async function loadGameJson(load, path) {
  try {
    return await load();
  } catch (error) {
    throw gameDataToDataError(error, path);
  }
}

/** Lädt die Blocknamen (names.json: { block: {id: {de, en}}, item: {…} }) über js/data/game-data.js. */
export async function loadNames({ load = loadGameNames } = {}) {
  const json = await loadGameJson(load, NAMES_PATH);
  if (!isPlainObject(json) || !isPlainObject(json.block) || !isPlainObject(json.item)) throw formatError(NAMES_PATH, '„block“ und „item“ erwartet');
  return json;
}

/** Lädt die Blockliste (blocks.json: { version, blocks: { id: { props, default } } }) über js/data/game-data.js. */
export async function loadBlockList({ load = loadGameBlocks } = {}) {
  const json = await loadGameJson(load, BLOCKS_PATH);
  if (!isPlainObject(json) || !isPlainObject(json.blocks)) throw formatError(BLOCKS_PATH, '„blocks“ erwartet');
  return json;
}

export function findBuild(catalog, id) {
  return catalog.builds.find((build) => build.id === id) ?? null;
}

/** Anzahl Bauten je Kategorie-Slug */
export function countByCategory(catalog) {
  const counts = Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0]));
  // Unbekannte Kategorien (z. B. alte Einträge) zählen nirgends mit
  for (const build of catalog.builds) if (Object.hasOwn(counts, build.category)) counts[build.category] += 1;
  return counts;
}
