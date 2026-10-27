// Laden der Spieldaten (game-data/*.json) mit verständlichen Fehlern und Prüfung des Katalogs (§9).
// Fehlermeldungen sind für Menschen geschrieben; technische Details hängen am Fehlerobjekt (cause, status).
import { SITE_ROOT, isSafeSitePath, isSafeUrl } from './dom.js';
import { CATEGORY_SLUGS, ACCURACY_KEYS, BUILD_ID_PATTERN, SIZE_CLASS_KEYS } from './shared.js';

export const CATALOG_PATH = 'game-data/catalog.json';
export const NAMES_PATH = 'game-data/names.json';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_SIZE = 4064;

const STEP_START = { text: 'Im Projektordner ausführen. Das holt die Spieldaten (ohne Minecraft einmalig aus dem Internet, sonst aus deiner Installation) und baut den Katalog:', command: 'node scripts/start.mjs' };
const STEP_EXTRACT = { text: 'Spieldaten neu holen (ohne Minecraft aus dem Internet, sonst aus deiner Installation):', command: 'node scripts/extract-game-data.mjs' };
const STEP_CATALOG = { text: 'Katalog der Bauten erzeugen:', command: 'node scripts/build-catalog.mjs' };
const STEP_SERVER = { text: 'Den lokalen Server starten (im Projektordner):', command: 'node scripts/serve.mjs' };
const STEP_RELOAD = { text: 'Danach diese Seite neu laden.' };

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

/** Anleitung, wie eine fehlende oder kaputte Datei neu entsteht. */
export function recoverySteps(path) {
  if (path === CATALOG_PATH) return [STEP_START, STEP_RELOAD];
  if (typeof path === 'string' && path.startsWith('game-data/')) return [STEP_EXTRACT, STEP_RELOAD];
  return [STEP_RELOAD];
}

function isGameData(path) {
  return path.startsWith('game-data/');
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
      throw new DataError('Der lokale Server hat nicht rechtzeitig geantwortet.', { kind: 'timeout', path, title: 'Zeitüberschreitung', steps: [STEP_SERVER, STEP_RELOAD], cause });
    }
    throw new DataError('Die Seite erreicht den lokalen Server nicht. Läuft er noch?', { kind: 'network', path, title: 'Keine Verbindung zum lokalen Server', steps: [STEP_SERVER, STEP_RELOAD], cause });
  }
  if (response.status === 404) {
    throw new DataError(`Die Datei „${path}“ wurde nicht gefunden.`, {
      kind: 'missing', path, status: 404,
      title: isGameData(path) ? 'Spieldaten fehlen' : 'Datei nicht gefunden',
      steps: recoverySteps(path),
    });
  }
  if (!response.ok) {
    throw new DataError(`Der lokale Server konnte „${path}“ nicht liefern.`, { kind: 'http', path, status: response.status, title: 'Datei konnte nicht geladen werden', steps: [STEP_RELOAD] });
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
    throw new DataError(`„${path}“ ist beschädigt (kein gültiges JSON).`, { kind: 'parse', path, title: isGameData(path) ? 'Spieldaten beschädigt' : 'Datei beschädigt', steps: recoverySteps(path), cause });
  }
}

function formatError(path, detail) {
  return new DataError(`„${path}“ hat nicht das erwartete Format (${detail}).`, { kind: 'format', path, title: 'Spieldaten unvollständig', steps: recoverySteps(path) });
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
  return author ? { author, url: cleanHttpsUrl(value.url), license: cleanText(value.license, 120) || null } : null;
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
  facts: (value) => cleanTextList(value, 30, 300),
  sources: cleanSources,
  credits: cleanCredits,
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
 * andere ungültige Felder werden auf einen leeren Wert gesetzt.
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
      difficulty: cleanInteger(entry.difficulty, 1, 5),
      size: cleanSize(entry.size),
      blocks: cleanInteger(entry.blocks, 0, 3_000_000),
      steps: cleanInteger(entry.steps, 0, 65534),
      topMaterials: cleanMaterials(entry.topMaterials),
      module: cleanPath(entry.module, /^js\/builds\/[a-z]+\/[a-z0-9-]{2,80}\.js$/),
      structure: cleanPath(entry.structure, /^[a-z0-9_.-]{1,160}\.json$/),
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

/** Gibt es schon Spieldaten (game-data/meta.json)? Nur für eine genauere Anleitung im Fehlerfall. */
async function gameDataPresent({ fetch: fetchImpl = globalThis.fetch, root = SITE_ROOT } = {}) {
  try {
    const response = await fetchImpl(new URL('game-data/meta.json', root), { method: 'HEAD', cache: 'no-cache', credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch (cause) {
    console.warn('[Block-Kompass] Prüfung von game-data/meta.json fehlgeschlagen:', cause);
    return false;
  }
}

/** Lädt und prüft game-data/catalog.json. Fehlt nur der Katalog, nennt der Fehler nur den nötigen Befehl. */
export async function loadCatalog(options = {}) {
  let json;
  try {
    json = await loadJson(CATALOG_PATH, options);
  } catch (error) {
    if (error.kind === 'missing' && await gameDataPresent(options)) {
      throw new DataError('Die Spieldaten sind vorhanden, aber der Katalog der Bauten (game-data/catalog.json) wurde noch nicht erzeugt.', {
        kind: 'missing', path: CATALOG_PATH, status: 404, title: 'Katalog fehlt', steps: [STEP_CATALOG, STEP_RELOAD], cause: error,
      });
    }
    throw error;
  }
  return normalizeCatalog(json);
}

/** Lädt game-data/names.json ({ block: {id: {de, en}}, item: {…} }). */
export async function loadNames(options) {
  const json = await loadJson(NAMES_PATH, options);
  if (!isPlainObject(json) || !isPlainObject(json.block) || !isPlainObject(json.item)) throw formatError(NAMES_PATH, '„block“ und „item“ erwartet');
  return json;
}

export function findBuild(catalog, id) {
  return catalog.builds.find((build) => build.id === id) ?? null;
}

/** Anzahl Bauten je Kategorie-Slug */
export function countByCategory(catalog) {
  const counts = Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0]));
  for (const build of catalog.builds) counts[build.category] += 1;
  return counts;
}
