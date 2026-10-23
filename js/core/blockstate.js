// Blockzustände als Text wie in Minecraft-Befehlen, ohne Namensraum:
// oak_stairs[facing=north,half=bottom]. Normalform: Eigenschaften alphabetisch sortiert.
// Läuft in Browser und Node (keine DOM-/Node-APIs).

const NAMESPACE = 'minecraft:';
const NAME_PATTERN = /^[a-z0-9_]+$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CACHE_LIMIT = 50_000;
const AIR_IDS = new Set(['air', 'cave_air', 'void_air']);

const parsedCache = new Map();
const normalizedCache = new Map();

function fail(input, reason) {
  const shown = typeof input === 'string' ? input.slice(0, 120) : String(input);
  throw new Error(`Ungültiger Blockzustand „${shown}“: ${reason}`);
}

function checkName(input, name, what) {
  if (!NAME_PATTERN.test(name)) {
    fail(input, name === '' ? `${what} fehlt` : `${what} „${name}“ enthält unerlaubte Zeichen (erlaubt: a–z, 0–9, _)`);
  }
}

function parseUncached(input) {
  if (typeof input !== 'string') fail(input, 'kein Text');
  let text = input.trim();
  if (text.startsWith(NAMESPACE)) text = text.slice(NAMESPACE.length);
  const open = text.indexOf('[');
  const id = open < 0 ? text : text.slice(0, open).trim();
  checkName(input, id, 'Block-ID');
  const props = {};
  if (open >= 0) {
    if (!text.endsWith(']')) fail(input, 'schließende Klammer „]“ fehlt');
    const body = text.slice(open + 1, -1);
    if (body.includes('[') || body.includes(']')) fail(input, 'Klammern sind falsch verschachtelt');
    if (body.trim() !== '') {
      for (const part of body.split(',')) {
        const eq = part.indexOf('=');
        if (eq < 0) fail(input, `„${part.trim()}“ hat nicht die Form name=wert`);
        const key = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        checkName(input, key, 'Eigenschaftsname');
        if (FORBIDDEN_KEYS.has(key)) fail(input, `Eigenschaftsname „${key}“ ist nicht erlaubt`);
        checkName(input, value, `Wert für „${key}“`);
        if (Object.hasOwn(props, key)) fail(input, `Eigenschaft „${key}“ kommt doppelt vor`);
        props[key] = value;
      }
    }
  }
  return { id, props };
}

function remember(cache, key, value) {
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

// Schneller Lesezugriff für den Kern: Ergebnis ist eingefroren und darf nicht verändert werden.
export function parseStateCached(str) {
  const hit = parsedCache.get(str);
  if (hit) return hit;
  const parsed = parseUncached(str);
  Object.freeze(parsed.props);
  return remember(parsedCache, str, Object.freeze(parsed));
}

export function parseState(str) {
  const parsed = parseStateCached(str);
  return { id: parsed.id, props: { ...parsed.props } };
}

export function formatState(id, props = {}) {
  let cleanId = typeof id === 'string' ? id.trim() : id;
  if (typeof cleanId === 'string' && cleanId.startsWith(NAMESPACE)) cleanId = cleanId.slice(NAMESPACE.length);
  if (typeof cleanId !== 'string') fail(id, 'Block-ID ist kein Text');
  checkName(cleanId, cleanId, 'Block-ID');
  const keys = Object.keys(props ?? {})
    .filter((key) => props[key] !== null && props[key] !== undefined)
    .sort();
  if (keys.length === 0) return cleanId;
  const parts = keys.map((key) => {
    const value = String(props[key]);
    checkName(cleanId, key, 'Eigenschaftsname');
    if (FORBIDDEN_KEYS.has(key)) fail(cleanId, `Eigenschaftsname „${key}“ ist nicht erlaubt`);
    checkName(cleanId, value, `Wert für „${key}“`);
    return `${key}=${value}`;
  });
  return `${cleanId}[${parts.join(',')}]`;
}

export function normalizeState(str) {
  const hit = normalizedCache.get(str);
  if (hit !== undefined) return hit;
  const { id, props } = parseStateCached(str);
  return remember(normalizedCache, str, formatState(id, props));
}

// patch-Wert null (oder undefined) löscht die Eigenschaft.
export function withProps(str, patch) {
  const { id, props } = parseStateCached(str);
  const next = { ...props };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null || value === undefined) delete next[key];
    else next[key] = String(value);
  }
  return formatState(id, next);
}

export function getProp(str, key) {
  const { props } = parseStateCached(str);
  return Object.hasOwn(props, key) ? props[key] : undefined;
}

export function stateId(str) {
  const open = str.indexOf('[');
  let id = open < 0 ? str : str.slice(0, open);
  id = id.trim();
  return id.startsWith(NAMESPACE) ? id.slice(NAMESPACE.length) : id;
}

export function isAirId(id) {
  return AIR_IDS.has(id);
}

export function isAirState(str) {
  return AIR_IDS.has(stateId(str));
}
