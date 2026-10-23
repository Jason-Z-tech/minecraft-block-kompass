// Blockliste mit Eigenschaften und Standardwerten (Format von game-data/blocks.json, §5).
// Die Daten kommen von außen: Node liest die Datei per fs, der Browser per fetch, dann setBlockData().

import { parseStateCached, formatState } from './blockstate.js';

const ID_PATTERN = /^[a-z0-9_]+$/;
const CACHE_LIMIT = 50_000;

let blockTable = null;
let dataInfo = null;
const validationCache = new Map();
const completionCache = new Map();

function cloneValues(id, key, values) {
  if (!Array.isArray(values) || values.length === 0 || values.some((v) => typeof v !== 'string' || !ID_PATTERN.test(v))) {
    throw new Error(`Blockdaten ungültig: Werte von „${id}.${key}“ müssen eine Liste aus Texten sein.`);
  }
  return Object.freeze([...values]);
}

function buildEntry(id, raw) {
  const props = {};
  const valueSets = new Map();
  for (const [key, values] of Object.entries(raw?.props ?? {})) {
    if (!ID_PATTERN.test(key)) throw new Error(`Blockdaten ungültig: Eigenschaft „${key}“ bei „${id}“.`);
    props[key] = cloneValues(id, key, values);
    valueSets.set(key, new Set(props[key]));
  }
  const defaults = {};
  for (const key of Object.keys(props)) {
    const given = raw?.default?.[key];
    defaults[key] = typeof given === 'string' && valueSets.get(key).has(given) ? given : props[key][0];
  }
  return { props: Object.freeze(props), defaults: Object.freeze(defaults), valueSets };
}

export function setBlockData(json) {
  if (!json || typeof json !== 'object' || !json.blocks || typeof json.blocks !== 'object') {
    throw new Error('Blockdaten ungültig: Feld „blocks“ fehlt (erwartet wird game-data/blocks.json).');
  }
  const table = new Map();
  for (const [id, raw] of Object.entries(json.blocks)) {
    if (!ID_PATTERN.test(id)) throw new Error(`Blockdaten ungültig: Block-ID „${id}“.`);
    table.set(id, buildEntry(id, raw));
  }
  if (!table.has('air')) table.set('air', buildEntry('air', {}));
  blockTable = table;
  dataInfo = Object.freeze({ version: json.version ?? null, source: json.source ?? null, count: table.size });
  validationCache.clear();
  completionCache.clear();
}

// Nur für Tests: Zustand ohne geladene Daten herstellen.
export function clearBlockData() {
  blockTable = null;
  dataInfo = null;
  validationCache.clear();
  completionCache.clear();
}

export function isBlockDataLoaded() {
  return blockTable !== null;
}

export function blockDataInfo() {
  return dataInfo;
}

function table() {
  if (!blockTable) {
    throw new Error('Blockdaten sind nicht geladen – zuerst setBlockData(json) mit game-data/blocks.json aufrufen.');
  }
  return blockTable;
}

export function hasBlock(id) {
  return table().has(id);
}

export function allBlockIds() {
  return [...table().keys()];
}

export function blockProps(id) {
  const entry = table().get(id);
  if (!entry) return null;
  const copy = {};
  for (const [key, values] of Object.entries(entry.props)) copy[key] = [...values];
  return copy;
}

// Unbekannter Block → null.
export function defaultProps(id) {
  const entry = table().get(id);
  return entry ? { ...entry.defaults } : null;
}

// Eingefrorene Standardwerte für den schnellen Zugriff im Kern (nicht verändern).
export function defaultPropsFrozen(id) {
  return table().get(id)?.defaults ?? null;
}

function listValues(values) {
  return values.join(', ');
}

function validateUncached(str) {
  let parsed;
  try {
    parsed = parseStateCached(str);
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
  const entry = table().get(parsed.id);
  if (!entry) return { ok: false, errors: [`Unbekannter Block „${parsed.id}“ (gibt es in Minecraft Java 26.2 nicht).`] };
  const errors = [];
  const allowedKeys = Object.keys(entry.props);
  for (const [key, value] of Object.entries(parsed.props)) {
    const values = entry.valueSets.get(key);
    if (!values) {
      const hint = allowedKeys.length ? `erlaubt: ${allowedKeys.join(', ')}` : 'der Block hat keine Eigenschaften';
      errors.push(`„${parsed.id}“ hat keine Eigenschaft „${key}“ (${hint}).`);
    } else if (!values.has(value)) {
      errors.push(`Ungültiger Wert „${value}“ für „${key}“ bei „${parsed.id}“ (erlaubt: ${listValues(entry.props[key])}).`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateState(str) {
  const hit = validationCache.get(str);
  if (hit) return { ok: hit.ok, errors: [...hit.errors] };
  const result = validateUncached(str);
  if (validationCache.size >= CACHE_LIMIT) validationCache.clear();
  validationCache.set(str, result);
  return { ok: result.ok, errors: [...result.errors] };
}

// Fehlende Eigenschaften bekommen den Standardwert. Ungültige Zustände werfen einen Error.
export function completeState(str) {
  const hit = completionCache.get(str);
  if (hit !== undefined) return hit;
  const check = validateState(str);
  if (!check.ok) throw new Error(check.errors.join(' '));
  const { id, props } = parseStateCached(str);
  const complete = formatState(id, { ...table().get(id).defaults, ...props });
  if (completionCache.size >= CACHE_LIMIT) completionCache.clear();
  completionCache.set(str, complete);
  return complete;
}
