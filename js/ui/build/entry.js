// Katalog-Eintrag für die Bau-Seite: die zusätzlichen Felder des Katalogs aus Runde 2 prüfen (Beschreibung,
// Quellen, Credits, Maßstäbe, Varianten …), Maßstab aus der Adresse auflösen, Quelle für den Viewer.
// Alte Felder (z. B. difficulty, facts) werden nicht übernommen.
// Ohne DOM-Zugriff beim Laden, daher in Node testbar.
import { loadJson, loadLocalThumbIds, applyThumbs, normalizeCatalog, findBuild, CATALOG_PATH } from '../data.js';
import { isSafeUrl, isSafeSitePath } from '../dom.js';
import { formatNumber, CATEGORY_SLUGS, ACCURACY_KEYS, BUILD_ID_PATTERN } from '../shared.js';

// Bau-Module wie im Worker erlaubt: js/builds/<ordner>/<id>.js oder Testmodule unter tests/fixtures/<ordner>/
export const MODULE_PATH_PATTERN = /^(?:js\/builds|tests\/fixtures)\/[a-z0-9-]{1,40}\/[a-z0-9-]{2,80}\.js$/;
export const SIZE_CLASSES = Object.freeze(['klein', 'mittel', 'gross', 'riesig']);
const MAX_SIZE = 4064;
const SCALE_EPSILON = 1e-9;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanTextList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxLength));
}

function cleanInteger(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function cleanSize(value) {
  return Array.isArray(value) && value.length === 3 && value.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_SIZE) ? [...value] : null;
}

/** Nur https-Adressen mit Rechnername (für Quellen und Credits). */
export function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim()) && isSafeUrl(value.trim());
}

function cleanSources(value) {
  if (!Array.isArray(value)) return [];
  const sources = [];
  for (const source of value.slice(0, 30)) {
    if (!isPlainObject(source) || !isHttpsUrl(source.url)) continue;
    const url = source.url.trim();
    sources.push({ title: cleanText(source.title, 200) || new URL(url).hostname, url });
  }
  return sources;
}

function cleanCredits(value) {
  if (!isPlainObject(value)) return null;
  const author = cleanText(value.author, 120);
  if (!author) return null;
  return {
    author,
    url: isHttpsUrl(value.url) ? value.url.trim() : null,
    license: cleanText(value.license, 120) || null,
  };
}

function cleanScaleList(value) {
  if (!Array.isArray(value)) return [];
  const list = value.filter((s) => typeof s === 'number' && Number.isFinite(s) && s > 0 && s <= 4);
  return [...new Set(list)].sort((a, b) => b - a);
}

function findScale(scales, value) {
  return scales.find((scale) => Math.abs(scale - value) < SCALE_EPSILON) ?? null;
}

function cleanVariants(value, scales) {
  if (!isPlainObject(value) || scales.length === 0) return null;
  const variants = {};
  for (const [key, variant] of Object.entries(value)) {
    const scale = findScale(scales, Number(key));
    if (scale === null || !isPlainObject(variant)) continue;
    variants[scaleToken(scale)] = {
      size: cleanSize(variant.size),
      blocks: cleanInteger(variant.blocks, 0, 3_000_000),
      steps: cleanInteger(variant.steps, 0, 65534),
    };
  }
  return Object.keys(variants).length ? variants : null;
}

/** Felder des Katalogs (Runde 2), die normalizeBuild aus data.js nicht übernimmt – jedes einzeln geprüft. */
export function normalizeBuildDetails(raw) {
  if (!isPlainObject(raw)) return {};
  const scales = cleanScaleList(raw.scales);
  const defaultScale = typeof raw.defaultScale === 'number' ? findScale(scales, raw.defaultScale) : null;
  return {
    description: cleanText(raw.description, 3000),
    sources: cleanSources(raw.sources),
    credits: cleanCredits(raw.credits),
    module: typeof raw.module === 'string' && MODULE_PATH_PATTERN.test(raw.module) ? raw.module : null,
    scales,
    defaultScale,
    variants: cleanVariants(raw.variants, scales),
    phases: cleanInteger(raw.phases, 0, 65534),
    sizeClass: SIZE_CLASSES.includes(raw.sizeClass) ? raw.sizeClass : null,
  };
}

/** Katalog-JSON (data/catalog.json) roh laden; Fehler kommen als DataError mit verständlicher Meldung. */
export async function loadCatalogJson(options = {}) {
  return loadJson(CATALOG_PATH, options);
}

/**
 * Eintrag mit allen geprüften Feldern oder null, wenn es die ID nicht gibt. Wirft DataError bei Ladefehlern.
 * Auf dem eigenen Rechner kommt ein vorhandenes lokales Vorschaubild dazu (wie in loadCatalog).
 */
export async function loadBuildEntry(id, options = {}) {
  const [json, thumbIds] = await Promise.all([loadCatalogJson(options), loadLocalThumbIds(options)]);
  const catalog = normalizeCatalog(json);
  const base = findBuild(catalog, id);
  if (!base) return null;
  applyThumbs([base], thumbIds);
  const raw = json.builds.find((entry) => isPlainObject(entry) && entry.id === id);
  return { ...base, ...normalizeBuildDetails(raw) };
}

/** Maßstab als Text für Schlüssel und Adressen: 0.5 → „0.5“, 1 → „1“. */
export function scaleToken(scale) {
  return String(Math.round(scale * 1e6) / 1e6);
}

/** 1 → „1:1“, 0.5 → „1:2“, 0.4 → „1:2,5“, 2 → „2:1“ */
export function formatScale(scale) {
  if (!(typeof scale === 'number' && scale > 0)) return '–';
  return scale >= 1 ? `${formatNumber(scale)}:1` : `1:${formatNumber(1 / scale)}`;
}

/**
 * Maßstab für die Ansicht: requested = Zahl aus der Adresse oder null.
 * → { ok: true, scale } (scale null bei Bauten ohne Maßstäbe) | { ok: false, reason: 'no-scales' | 'unknown-scale' }
 */
export function resolveScale(entry, requested) {
  const scales = Array.isArray(entry?.scales) ? entry.scales : [];
  if (scales.length === 0) return requested === null || requested === undefined ? { ok: true, scale: null } : { ok: false, reason: 'no-scales' };
  if (requested === null || requested === undefined) {
    const fallback = entry.defaultScale ?? findScale(scales, 1) ?? scales[0];
    return { ok: true, scale: fallback };
  }
  const match = findScale(scales, requested);
  return match === null ? { ok: false, reason: 'unknown-scale' } : { ok: true, scale: match };
}

/** Fortschritt im localStorage: „bk:progress:<id>“ bzw. „bk:progress:<id>@<maßstab>“ */
export function progressKeyFor(id, scale = null) {
  return scale === null || scale === undefined ? `bk:progress:${id}` : `bk:progress:${id}@${scaleToken(scale)}`;
}

/** Quelle für viewer.load oder null, wenn der Eintrag kein Bau-Modul hat. */
export function sourceForEntry(entry) {
  if (entry?.module) return { kind: 'module', path: entry.module };
  return null;
}

const THUMB_PATTERN = /^thumbs\/[a-z0-9-]{2,80}\.(?:webp|png|avif|jpg)$/;

/**
 * Eintrag für die Bau-Ansicht: Katalog-Eintrag oder ein gleich aufgebautes Objekt (Formen, Uploads).
 * Jedes Feld wird geprüft; fehlende oder ungültige Felder werden leer (null, '' oder []).
 */
export function viewEntry(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const scales = cleanScaleList(source.scales);
  return {
    id: typeof source.id === 'string' && BUILD_ID_PATTERN.test(source.id) ? source.id : null,
    title: cleanText(source.title, 120) || 'Bau',
    subtitle: cleanText(source.subtitle, 200),
    category: CATEGORY_SLUGS.includes(source.category) ? source.category : null,
    accuracy: ACCURACY_KEYS.includes(source.accuracy) ? source.accuracy : null,
    tested: source.tested === true || source.tested === false ? source.tested : null,
    description: cleanText(source.description, 3000),
    sources: cleanSources(source.sources),
    credits: cleanCredits(source.credits),
    tags: cleanTextList(source.tags, 12, 40),
    scales,
    defaultScale: typeof source.defaultScale === 'number' ? findScale(scales, source.defaultScale) : null,
    variants: cleanVariants(source.variants, scales),
    size: cleanSize(source.size),
    blocks: cleanInteger(source.blocks, 0, 3_000_000),
    steps: cleanInteger(source.steps, 0, 65534),
    phases: cleanInteger(source.phases, 0, 65534),
    thumb: typeof source.thumb === 'string' && THUMB_PATTERN.test(source.thumb) && isSafeSitePath(source.thumb) ? source.thumb : null,
  };
}

/** Kennzahlen für einen Maßstab: aus variants, sonst die des Eintrags. */
export function variantFor(entry, scale) {
  const variant = scale !== null && entry?.variants ? entry.variants[scaleToken(scale)] : null;
  return {
    size: variant?.size ?? entry?.size ?? null,
    blocks: variant?.blocks ?? entry?.blocks ?? null,
    steps: variant?.steps ?? entry?.steps ?? null,
  };
}
