// Reine Umwandlung der Spieldaten (ARCHITEKTUR §5): Rohdateien aus dem Spiel bzw. aus misode/mcmeta → Format von
// game-data/ (names.json, blocks.json, models.json, textures.json-Einträge). Ohne Node-Importe und
// Node-Globale: läuft in Browser, Worker und Node. scripts/extract-game-data.mjs nutzt genau diese Funktionen
// (Ergebnis Byte für Byte gleich); Dateien, Zip, Netz und Schreiben bleiben dort.

export const MC_VERSION = '26.2';
// Erhöhen, sobald sich die Ausgabe der Umwandlung ändert (z. B. ein Fehler in buildModels behoben): Die Webseite legt die
// umgewandelten Daten im Browser ab (js/data/remote.js) und erzeugt sie mit neuer Version einmal neu.
// tests/unit/data-remote.test.mjs merkt, wenn sich die Ausgabe ohne neue Version ändert.
export const CONVERT_VERSION = 1;
export const MCMETA_TAG = `${MC_VERSION}-summary`;

// Pfade wie in der Jar bzw. in den mcmeta-Archiven.
export const ASSET_ROOT = 'assets/minecraft/';
export const BLOCKSTATE_PREFIX = `${ASSET_ROOT}blockstates/`;
export const MODEL_PREFIX = `${ASSET_ROOT}models/`;
export const TEXTURE_PREFIX = `${ASSET_ROOT}textures/`;

export const ID_PATTERN = /^[a-z0-9_]+$/;
export const RESOURCE_PATH_PATTERN = /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/;
export const DIRECTIONS = ['down', 'up', 'north', 'south', 'west', 'east'];
const QUADRANTS = [0, 90, 180, 270];
const AXES = ['x', 'y', 'z'];
// Eingebaute Spieltextur ohne Datei (lila-schwarzes Schachbrett).
const BUILTIN_MISSING_TEXTURE = 'missingno';

// Welche Texturen in textures.bin landen (Pfade wie in 26.2; Betten und Schilder nutzen dort Block-Texturen).
const TEXTURE_INCLUDE_PATTERNS = [
  /^block\//,
  /^item\//,
  /^colormap\/[^/]+$/,
  /^entity\/chest\/[^/]+$/,
  /^entity\/shulker\/[^/]+$/,
  /^entity\/banner\//,
  /^entity\/bell\/[^/]+$/,
  /^entity\/decorated_pot\/[^/]+$/,
  /^entity\/conduit\/[^/]+$/,
  /^entity\/skeleton\/[^/]+$/,
  /^entity\/(?:zombie\/zombie|creeper\/creeper|piglin\/piglin|enderdragon\/dragon|player\/wide\/steve)$/,
];

// Bevorzugte Standardwerte, falls die Eigenschaften nur aus den Blockstate-Dateien abgeleitet werden.
const DERIVED_DEFAULT_PREFERENCES = new Map([
  ['facing', ['north', 'down']],
  ['half', ['bottom', 'lower']],
  ['type', ['bottom', 'single', 'normal']],
  ['shape', ['straight', 'north_south']],
  ['axis', ['y']],
  ['hinge', ['left']],
  ['face', ['wall']],
  ['attachment', ['floor']],
  ['part', ['foot', 'lower']],
  ['orientation', ['north_up']],
  ['north', ['none', 'false']],
  ['east', ['none', 'false']],
  ['south', ['none', 'false']],
  ['west', ['none', 'false']],
  ['distance', ['7']],
  ['delay', ['1']],
  ['layers', ['1']],
  ['pickles', ['1']],
  ['eggs', ['1']],
  ['candles', ['1']],
  ['flower_amount', ['1']],
  ['segment_amount', ['1']],
]);

// ---------------------------------------------------------------------------------------------
// Hilfen

export function createWarnings() {
  const list = [];
  const keys = new Set();
  return {
    list,
    add(message) {
      list.push(message);
    },
    // Meldung nur einmal pro Schlüssel (z. B. dieselbe fehlende Textur in vielen Modellen).
    once(key, message) {
      if (keys.has(key)) return;
      keys.add(key);
      list.push(message);
    },
  };
}

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value);

// Wörterbuch ohne Prototyp: Schlüssel aus fremden Daten („__proto__“, „constructor“) sind dann harmlos.
export const dict = () => Object.create(null);

// JSON-Text (mit oder ohne BOM) lesen; Fehler mit Dateiname.
export function parseJsonText(text, label) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return JSON.parse(clean);
  } catch (error) {
    throw new Error(`${label}: ungültiges JSON (${error.message})`);
  }
}

const round6 = (value) => Math.round(value * 1e6) / 1e6 + 0;

// „minecraft:block/stone“ → „block/stone“; anderer Namensraum oder ungültig → null.
export function normalizeResourceName(raw) {
  if (typeof raw !== 'string') return null;
  const colon = raw.indexOf(':');
  const namespace = colon >= 0 ? raw.slice(0, colon) : 'minecraft';
  const name = colon >= 0 ? raw.slice(colon + 1) : raw;
  if (namespace !== 'minecraft' || !RESOURCE_PATH_PATTERN.test(name)) return null;
  return name;
}

export function formatState(id, props) {
  const keys = Object.keys(props).sort();
  return keys.length === 0 ? id : `${id}[${keys.map((key) => `${key}=${props[key]}`).join(',')}]`;
}

// ---------------------------------------------------------------------------------------------
// Namen (names.json)

// Nur Schlüssel der Form block.minecraft.<id> und item.minecraft.<id> (genau drei Teile).
export function buildNames(en, de) {
  const names = { block: dict(), item: dict() };
  const keys = [...new Set([...Object.keys(en), ...Object.keys(de)])].sort();
  for (const key of keys) {
    const parts = key.split('.');
    if (parts.length !== 3 || parts[1] !== 'minecraft' || !Object.hasOwn(names, parts[0]) || !ID_PATTERN.test(parts[2])) continue;
    names[parts[0]][parts[2]] = {
      de: Object.hasOwn(de, key) && typeof de[key] === 'string' ? de[key] : null,
      en: Object.hasOwn(en, key) && typeof en[key] === 'string' ? en[key] : null,
    };
  }
  return names;
}

// ---------------------------------------------------------------------------------------------
// Blockstates und Blockeigenschaften (blocks.json)

// Alle Blockstate-Dateien der Assets (assets: { list, readJson }) → Map id → Definition; Ungültiges als Warnung.
export function loadBlockstates(assets, warnings) {
  const blockstates = new Map();
  for (const entry of assets.list(BLOCKSTATE_PREFIX)) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(BLOCKSTATE_PREFIX.length, -'.json'.length);
    if (!ID_PATTERN.test(id)) {
      warnings.add(`Blockstate-Datei mit ungewöhnlichem Namen übersprungen: ${entry}`);
      continue;
    }
    try {
      const definition = assets.readJson(entry);
      if (!isPlainObject(definition)) throw new Error('kein JSON-Objekt');
      blockstates.set(id, definition);
    } catch (error) {
      warnings.add(`Blockstate ${id} übersprungen: ${error.message}`);
    }
  }
  return blockstates;
}

// mcmeta-Format: { id: [ {eigenschaft: [werte…]}, {eigenschaft: standard} ] }
export function convertMcmetaBlocks(raw) {
  if (!isPlainObject(raw)) throw new Error('Blockbericht ist kein Objekt');
  const blocks = dict();
  for (const id of Object.keys(raw).sort()) {
    const entry = raw[id];
    if (!ID_PATTERN.test(id) || !Array.isArray(entry) || entry.length !== 2 || !isPlainObject(entry[0]) || !isPlainObject(entry[1])) {
      throw new Error(`Eintrag „${id}“ hat ein unerwartetes Format`);
    }
    const [rawProps, rawDefaults] = entry;
    if (Object.keys(rawProps).length !== Object.keys(rawDefaults).length) throw new Error(`„${id}“: Eigenschaften und Standardwerte passen nicht zusammen`);
    const props = dict();
    const defaults = dict();
    for (const [name, values] of Object.entries(rawProps)) {
      const valid = ID_PATTERN.test(name) && Array.isArray(values) && values.length > 0
        && values.every((value) => typeof value === 'string' && ID_PATTERN.test(value));
      if (!valid || !Object.hasOwn(rawDefaults, name) || !values.includes(rawDefaults[name])) throw new Error(`„${id}“: Eigenschaft „${name}“ ist ungültig`);
      props[name] = [...values];
      defaults[name] = rawDefaults[name];
    }
    blocks[id] = { props, default: defaults };
  }
  if (Object.keys(blocks).length < 500) throw new Error('Blockbericht ist unvollständig');
  return blocks;
}

// Variantenschlüssel „facing=east,half=bottom“ → { facing: 'east', half: 'bottom' }; „“ → {}; ungültig → null.
function splitVariantKey(key) {
  const when = dict();
  if (key === '') return when;
  for (const part of key.split(',')) {
    const eq = part.indexOf('=');
    const name = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (eq <= 0 || !ID_PATTERN.test(name) || !ID_PATTERN.test(value)) return null;
    when[name] = value;
  }
  return when;
}

export function parseVariantKey(key) {
  const when = splitVariantKey(key);
  if (!when) throw new Error(`ungültiger Variantenschlüssel „${key}“`);
  return when;
}

function collectConditionValues(condition, addValue) {
  if (!isPlainObject(condition)) return;
  for (const [key, value] of Object.entries(condition)) {
    if ((key === 'OR' || key === 'AND') && Array.isArray(value)) {
      for (const inner of value) collectConditionValues(inner, addValue);
      continue;
    }
    for (const term of String(value).split('|')) addValue(key, term.startsWith('!') ? term.slice(1) : term);
  }
}

function orderValues(values) {
  if (values.every((value) => value === 'true' || value === 'false')) return ['true', 'false'].filter((v) => values.includes(v));
  if (values.every((value) => /^\d+$/.test(value))) return [...values].sort((a, b) => Number(a) - Number(b));
  return values;
}

function pickDerivedDefault(prop, values) {
  const preferred = (DERIVED_DEFAULT_PREFERENCES.get(prop) ?? []).find((value) => values.includes(value));
  if (preferred) return preferred;
  if (values.includes('false')) return 'false';
  if (values.includes('none')) return 'none';
  return values[0];
}

// Rückfall ohne mcmeta: Eigenschaften aus den Blockstate-Dateien (unvollständig, z. B. fehlt waterlogged).
// Ungültige Variantenschlüssel zählen hier nicht mit; buildModels meldet sie.
export function deriveBlocksFromBlockstates(blockstates) {
  const blocks = dict();
  for (const id of [...blockstates.keys()].sort()) {
    const seen = new Map();
    const addValue = (prop, value) => {
      if (!ID_PATTERN.test(prop) || !ID_PATTERN.test(value)) return;
      if (!seen.has(prop)) seen.set(prop, []);
      if (!seen.get(prop).includes(value)) seen.get(prop).push(value);
    };
    const definition = blockstates.get(id);
    if (isPlainObject(definition.variants)) {
      for (const key of Object.keys(definition.variants)) {
        for (const [prop, value] of Object.entries(splitVariantKey(key) ?? {})) addValue(prop, value);
      }
    }
    if (Array.isArray(definition.multipart)) {
      for (const part of definition.multipart) collectConditionValues(part?.when, addValue);
    }
    const props = dict();
    const defaults = dict();
    for (const prop of [...seen.keys()].sort()) {
      props[prop] = orderValues(seen.get(prop));
      defaults[prop] = pickDerivedDefault(prop, props[prop]);
    }
    blocks[id] = { props, default: defaults };
  }
  return blocks;
}

export function compareBlocksWithBlockstates(blocks, blockstateIds) {
  const ids = new Set(blockstateIds);
  const withoutBlockstate = Object.keys(blocks).filter((id) => !ids.has(id));
  const withoutBlock = [...ids].filter((id) => !Object.hasOwn(blocks, id)).sort();
  const warnings = [];
  if (withoutBlockstate.length) warnings.push(`${withoutBlockstate.length} Blöcke ohne Blockstate-Datei: ${withoutBlockstate.join(', ')}`);
  if (withoutBlock.length) warnings.push(`${withoutBlock.length} Blockstate-Dateien ohne Eintrag im Blockbericht: ${withoutBlock.join(', ')}`);
  return warnings;
}

// Blockbericht von misode/mcmeta: texts = { version, blocks } (Text von version.json und blocks/data.min.json).
// Prüft Version und Datenversion, liefert die umgewandelten Blöcke (convertMcmetaBlocks).
export function parseMcmetaReport(texts, worldVersion) {
  const version = parseJsonText(texts.version, 'mcmeta version.json');
  if (version?.id !== MC_VERSION || version?.data_version !== worldVersion) {
    throw new Error(`mcmeta meldet Version ${version?.id} / Datenversion ${version?.data_version}, erwartet ${MC_VERSION} / ${worldVersion}`);
  }
  return convertMcmetaBlocks(parseJsonText(texts.blocks, 'mcmeta blocks/data.min.json'));
}

// Inhalt von blocks.json mit Blockbericht (Feldreihenfolge wie in game-data/blocks.json).
export function mcmetaBlocksData(blocks) {
  return { version: MC_VERSION, source: 'mcmeta', ref: `misode/mcmeta@${MCMETA_TAG}`, blocks };
}

// ---------------------------------------------------------------------------------------------
// Modelle (models.json)

function multiply3(a, b) {
  const out = new Array(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

// Drehung gegen den Uhrzeigersinn um die positive Achse (rechtshändig, wie JOML im Spiel), Zeilen zuerst.
export function axisRotationMatrix(axis, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

// Wie Matrix4f.rotationZYX(z, y, x) im Spiel: M = Rz · Ry · Rx (erst X, dann Y, dann Z um die festen Achsen).
export function eulerRotationMatrix([x, y, z]) {
  return multiply3(axisRotationMatrix('z', z), multiply3(axisRotationMatrix('y', y), axisRotationMatrix('x', x)));
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function isIdentity(matrix) {
  return matrix.every((value, i) => Math.abs(value - IDENTITY3[i]) < 1e-9);
}

// rescale wie im Spiel: Spalte je Achse mit 1 / max(|M·e|) strecken (M · S).
export function applyRescale(matrix) {
  const out = [...matrix];
  for (let col = 0; col < 3; col++) {
    const largest = Math.max(Math.abs(matrix[col]), Math.abs(matrix[3 + col]), Math.abs(matrix[6 + col]));
    const scale = 1 / largest;
    for (let row = 0; row < 3; row++) out[row * 3 + col] = matrix[row * 3 + col] * scale;
  }
  return out;
}

function readVector3(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const numbers = value.map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

// Standard-UVs aus der Elementgröße, genau wie FaceBakery.defaultFaceUV.
export function defaultFaceUv(direction, from, to) {
  const [x1, y1, z1] = from;
  const [x2, y2, z2] = to;
  const uv = {
    down: [x1, 16 - z2, x2, 16 - z1],
    up: [x1, z1, x2, z2],
    north: [16 - x2, 16 - y2, 16 - x1, 16 - y1],
    south: [x1, 16 - y2, x2, 16 - y1],
    west: [z1, 16 - y2, z2, 16 - y1],
    east: [16 - z2, 16 - y2, 16 - z1, 16 - y1],
  }[direction];
  return uv.map(round6);
}

export function convertElementRotation(raw, report) {
  if (raw === undefined || raw === null) return null;
  if (!isPlainObject(raw)) {
    report('Drehung ist kein Objekt – ignoriert');
    return null;
  }
  const origin = readVector3(raw.origin);
  if (!origin) {
    report('Drehung ohne gültiges origin – ignoriert');
    return null;
  }
  let rotation;
  if ('axis' in raw || 'angle' in raw) {
    const axis = typeof raw.axis === 'string' ? raw.axis.toLowerCase() : null;
    const angle = Number(raw.angle);
    if (!AXES.includes(axis) || !Number.isFinite(angle)) {
      report(`Drehung mit ungültiger Achse/Winkel (${JSON.stringify(raw)}) – ignoriert`);
      return null;
    }
    rotation = { origin, axis, angle, rescale: raw.rescale === true, matrix: angle === 0 ? IDENTITY3 : axisRotationMatrix(axis, angle) };
  } else if ('x' in raw || 'y' in raw || 'z' in raw) {
    const euler = ['x', 'y', 'z'].map((key) => Number(raw[key] ?? 0));
    if (!euler.every(Number.isFinite)) {
      report(`Drehung mit ungültigen x/y/z-Winkeln (${JSON.stringify(raw)}) – ignoriert`);
      return null;
    }
    rotation = { origin, axis: null, angle: null, euler, rescale: raw.rescale === true, matrix: eulerRotationMatrix(euler) };
  } else {
    report('Drehung ohne axis/angle oder x/y/z – ignoriert');
    return null;
  }
  if (rotation.rescale && !isIdentity(rotation.matrix)) rotation.matrix = applyRescale(rotation.matrix);
  rotation.matrix = rotation.matrix.map(round6);
  return rotation;
}

function parseTextureValue(value) {
  if (typeof value === 'string') {
    if (value.startsWith('#')) return { ref: value.slice(1) };
    const sprite = normalizeResourceName(value);
    return sprite ? { sprite, forceTranslucent: false } : null;
  }
  if (isPlainObject(value) && typeof value.sprite === 'string') {
    const sprite = normalizeResourceName(value.sprite);
    return sprite ? { sprite, forceTranslucent: value.force_translucent === true } : null;
  }
  return null;
}

// Texturplätze der Kette zusammenführen (Kind überschreibt Eltern), Verweise später rekursiv auflösen.
function mergeTextureSlots(chain, report) {
  const slots = new Map();
  for (let i = chain.length - 1; i >= 0; i--) {
    const textures = chain[i].raw.textures;
    if (textures === undefined) continue;
    if (!isPlainObject(textures)) {
      report(`„textures“ in ${chain[i].name} ist kein Objekt – ignoriert`);
      continue;
    }
    for (const [slot, value] of Object.entries(textures)) {
      const parsed = parseTextureValue(value);
      if (!parsed) report(`Texturplatz „${slot}“ in ${chain[i].name} ist ungültig (${JSON.stringify(value)})`);
      slots.set(slot, parsed);
    }
  }
  return {
    // Liefert { sprite, forceTranslucent } oder null (nicht auflösbar).
    material(name) {
      const seen = new Set();
      let slot = name.startsWith('#') ? name.slice(1) : name;
      while (!seen.has(slot)) {
        seen.add(slot);
        const value = slots.get(slot);
        if (!value) return null;
        if (!value.ref) return value;
        slot = value.ref;
      }
      return null;
    },
  };
}

function createModelResolver(assets) {
  const cache = new Map();
  const loadRaw = (name) => {
    if (cache.has(name)) return cache.get(name);
    const entry = `${MODEL_PREFIX}${name}.json`;
    let result = { raw: null, error: 'Datei fehlt' };
    if (assets.has(entry)) {
      try {
        const raw = assets.readJson(entry);
        result = isPlainObject(raw) ? { raw, error: null } : { raw: null, error: 'kein JSON-Objekt' };
      } catch (error) {
        result = { raw: null, error: error.message };
      }
    }
    cache.set(name, result);
    return result;
  };
  // Eltern-Kette [Modell, Eltern, …, Wurzel]; Probleme gehen an report.
  return function resolveChain(name, report) {
    const chain = [];
    const seen = new Set();
    let current = name;
    while (current !== null) {
      if (seen.has(current)) {
        report(`Eltern-Schleife über ${current}`);
        break;
      }
      seen.add(current);
      const { raw, error } = loadRaw(current);
      if (!raw) {
        report(current === name ? `Modell nicht ladbar (${error})` : `Elternmodell ${current} nicht ladbar (${error})`);
        break;
      }
      chain.push({ name: current, raw });
      if (raw.parent === undefined || raw.parent === '') {
        current = null;
      } else {
        current = normalizeResourceName(raw.parent);
        if (current === null) report(`ungültiger parent „${raw.parent}“`);
      }
    }
    return chain;
  };
}

function convertFace(raw, direction, element, ctx) {
  if (!isPlainObject(raw) || typeof raw.texture !== 'string') {
    ctx.report(`Fläche ${direction} ohne gültige texture – übersprungen`);
    return null;
  }
  const material = ctx.slots.material(raw.texture);
  let tex = -1;
  if (material) tex = ctx.textureIndex(material.sprite);
  else ctx.report(`Textur „${raw.texture}“ nicht auflösbar (Fläche wird übersprungen)`);

  const uvRaw = readVector4(raw.uv);
  if (raw.uv !== undefined && !uvRaw) ctx.report(`Fläche ${direction}: ungültige uv – Standard verwendet`);
  const rotation = raw.rotation === undefined ? 0 : Number(raw.rotation);
  const cull = raw.cullface === undefined ? null : raw.cullface;
  if (cull !== null && !DIRECTIONS.includes(cull)) ctx.report(`Fläche ${direction}: unbekannte cullface „${raw.cullface}“ – ignoriert`);
  if (!QUADRANTS.includes(rotation)) ctx.report(`Fläche ${direction}: UV-Drehung ${raw.rotation} ungültig – 0 verwendet`);
  if (raw.tintindex !== undefined && !Number.isInteger(raw.tintindex)) ctx.report(`Fläche ${direction}: tintindex ${JSON.stringify(raw.tintindex)} ungültig – keine Einfärbung`);

  const face = {
    tex,
    uv: uvRaw ?? defaultFaceUv(direction, element.from, element.to),
    rotation: QUADRANTS.includes(rotation) ? rotation : 0,
    cull: DIRECTIONS.includes(cull) ? cull : null,
    tint: Number.isInteger(raw.tintindex) ? raw.tintindex : -1,
  };
  if (material?.forceTranslucent) face.translucent = true;
  return face;
}

function readVector4(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const numbers = value.map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

function convertElement(raw, index, ctx) {
  const from = isPlainObject(raw) ? readVector3(raw.from) : null;
  const to = isPlainObject(raw) ? readVector3(raw.to) : null;
  if (!from || !to || !isPlainObject(raw.faces)) {
    ctx.report(`Element ${index} ohne gültiges from/to/faces – übersprungen`);
    return null;
  }
  const light = raw.light_emission === undefined ? 0 : raw.light_emission;
  if (!Number.isInteger(light) || light < 0 || light > 15) ctx.report(`Element ${index}: light_emission ${raw.light_emission} ungültig – 0 verwendet`);
  if (raw.shade !== undefined && typeof raw.shade !== 'boolean') ctx.report(`Element ${index}: shade ist kein Wahrheitswert – true verwendet`);
  const element = {
    from,
    to,
    rotation: convertElementRotation(raw.rotation, (message) => ctx.report(`Element ${index}: ${message}`)),
    shade: raw.shade !== false,
    light: Number.isInteger(light) && light >= 0 && light <= 15 ? light : 0,
    faces: {},
  };
  if (element.rotation) ctx.noteRotation(element.rotation);
  if (element.light > 0) ctx.stats.lightEmissionElements++;
  for (const key of Object.keys(raw.faces)) {
    if (!DIRECTIONS.includes(key)) ctx.report(`Element ${index}: unbekannte Fläche „${key}“ – ignoriert`);
  }
  for (const direction of DIRECTIONS) {
    if (raw.faces[direction] === undefined) continue;
    const face = convertFace(raw.faces[direction], direction, element, ctx);
    if (!face) continue;
    if (face.translucent) ctx.stats.forceTranslucentFaces++;
    element.faces[direction] = face;
  }
  return element;
}

function convertModel(name, chain, ctx) {
  const slots = mergeTextureSlots(chain, ctx.report);
  const faceCtx = { ...ctx, slots };
  const aoSource = chain.find((model) => typeof model.raw.ambientocclusion === 'boolean');
  // 26.2: schon ein vorhandenes (auch leeres) "elements" beendet die Vererbung.
  const geometrySource = chain.find((model) => Object.hasOwn(model.raw, 'elements'));
  const particle = slots.material('particle');
  const model = {
    name,
    ao: aoSource ? aoSource.raw.ambientocclusion : true,
    particle: particle ? ctx.textureIndex(particle.sprite) : -1,
    elements: [],
  };
  if (!particle && chain.length > 0) ctx.report('keine particle-Textur');
  if (geometrySource) {
    if (Array.isArray(geometrySource.raw.elements)) {
      geometrySource.raw.elements.forEach((raw, index) => {
        const element = convertElement(raw, index, faceCtx);
        if (element) model.elements.push(element);
      });
    } else {
      ctx.report(`„elements“ in ${geometrySource.name} ist keine Liste`);
    }
  }
  return model;
}

function readQuadrant(value, label, report) {
  if (value === undefined) return 0;
  if (QUADRANTS.includes(value)) return value;
  report(`${label}=${JSON.stringify(value)} ist keine 90°-Stufe – 0 verwendet`);
  return 0;
}

function convertApply(raw, ctx, report) {
  const list = Array.isArray(raw) ? raw : [raw];
  const result = [];
  for (const variant of list) {
    const modelName = isPlainObject(variant) ? normalizeResourceName(variant.model) : null;
    if (!modelName) {
      report(`Variante ohne gültiges model (${JSON.stringify(variant)}) – übersprungen`);
      continue;
    }
    const weight = variant.weight === undefined ? 1 : variant.weight;
    if (!Number.isInteger(weight) || weight < 1) report(`weight ${JSON.stringify(variant.weight)} ungültig – 1 verwendet`);
    const entry = {
      model: ctx.modelIndex(modelName),
      x: readQuadrant(variant.x, 'x', report),
      y: readQuadrant(variant.y, 'y', report),
      uvlock: variant.uvlock === true,
      weight: Number.isInteger(weight) && weight >= 1 ? weight : 1,
    };
    const z = readQuadrant(variant.z, 'z', report);
    if (z !== 0) {
      entry.z = z;
      ctx.stats.variantZRotations++;
    }
    result.push(entry);
  }
  if (result.length === 0) report('Variante ohne Modelle');
  if (result.length > 1) ctx.stats.weightedLists++;
  return result;
}

// Werte „low|tall“ → ['low','tall']; „!none“ (jeder andere Wert) wird mit den bekannten Werten aufgelöst.
export function convertConditionTerms(rawValue, possibleValues) {
  const terms = String(rawValue).split('|').map((term) => (term.startsWith('!') ? { value: term.slice(1), negated: true } : { value: term, negated: false }));
  if (terms.some((term) => term.value === '')) throw new Error(`leerer Wert in „${rawValue}“`);
  if (!terms.some((term) => term.negated)) return [...new Set(terms.map((term) => term.value))];
  if (!possibleValues) throw new Error(`„${rawValue}“ braucht die Werteliste der Eigenschaft`);
  return possibleValues.filter((value) => terms.some((term) => (term.negated ? value !== term.value : value === term.value)));
}

export function convertCondition(raw, props, report) {
  if (raw === undefined || raw === null) return null;
  if (!isPlainObject(raw)) {
    report(`Bedingung ist kein Objekt (${JSON.stringify(raw)}) – gilt immer`);
    return null;
  }
  const keys = Object.keys(raw);
  if (keys.length === 1 && (keys[0] === 'OR' || keys[0] === 'AND') && Array.isArray(raw[keys[0]])) {
    return { [keys[0]]: raw[keys[0]].map((inner) => convertCondition(inner, props, report) ?? dict()) };
  }
  const condition = dict();
  for (const [prop, value] of Object.entries(raw)) {
    const possible = props && Object.hasOwn(props, prop) ? props[prop] : null;
    if (props && !possible) report(`Bedingung nutzt unbekannte Eigenschaft „${prop}“`);
    try {
      condition[prop] = convertConditionTerms(value, possible);
    } catch (error) {
      report(`Bedingung ${prop}: ${error.message}`);
      condition[prop] = [];
      continue;
    }
    const unknown = possible ? condition[prop].filter((v) => !possible.includes(v)) : [];
    if (unknown.length) report(`Bedingung ${prop}: unbekannte Werte ${unknown.join(', ')}`);
  }
  return condition;
}

function checkVariantWhen(when, props, report) {
  if (!props) return;
  for (const [prop, value] of Object.entries(when)) {
    if (!Object.hasOwn(props, prop)) report(`Variante nutzt unbekannte Eigenschaft „${prop}“`);
    else if (!props[prop].includes(value)) report(`Variante nutzt unbekannten Wert ${prop}=${value}`);
  }
}

function convertBlockstate(definition, props, ctx, report) {
  if (isPlainObject(definition.variants)) {
    if (definition.multipart !== undefined) report('hat variants und multipart – nur variants übernommen');
    const variants = [];
    for (const [key, value] of Object.entries(definition.variants)) {
      let when;
      try {
        when = parseVariantKey(key);
      } catch (error) {
        report(`${error.message} – übersprungen`);
        continue;
      }
      checkVariantWhen(when, props, report);
      variants.push({ when, apply: convertApply(value, ctx, report) });
    }
    return { variants };
  }
  if (Array.isArray(definition.multipart)) {
    ctx.stats.multipartBlocks++;
    const multipart = definition.multipart.map((part) => ({
      when: convertCondition(part?.when, props, report),
      apply: convertApply(part?.apply, ctx, report),
    }));
    return { multipart };
  }
  report('weder variants noch multipart – kein Modell');
  return { variants: [] };
}

function createModelStats() {
  return {
    singleAxisRotations: 0,
    freeAngleRotations: 0,
    eulerRotations: 0,
    rescaledRotations: 0,
    angles: new Set(),
    forceTranslucentFaces: 0,
    lightEmissionElements: 0,
    variantZRotations: 0,
    weightedLists: 0,
    multipartBlocks: 0,
    builtinMissingTexture: 0,
  };
}

// Löst alle Blockstates und alle genutzten Modelle auf. assets: { has, list, read, readJson }.
export function buildModels({ assets, blockstates, blocks, warnings }) {
  const textures = [];
  const textureIndices = new Map();
  const models = [];
  const modelIndices = new Map();
  const stats = createModelStats();
  const resolveChain = createModelResolver(assets);

  const textureIndex = (sprite, modelName) => {
    if (sprite === BUILTIN_MISSING_TEXTURE) {
      stats.builtinMissingTexture++;
      return -1;
    }
    if (!textureIndices.has(sprite)) {
      if (!assets.has(`${TEXTURE_PREFIX}${sprite}.png`)) {
        warnings.once(`texture:${sprite}`, `Textur fehlt in der Jar: ${sprite} (zuerst in Modell ${modelName}) – Flächen damit werden übersprungen.`);
        return -1;
      }
      textureIndices.set(sprite, textures.length);
      textures.push(sprite);
    }
    return textureIndices.get(sprite);
  };

  const noteRotation = (rotation) => {
    if (rotation.euler) stats.eulerRotations++;
    else {
      stats.singleAxisRotations++;
      stats.angles.add(rotation.angle);
      if (Math.abs(rotation.angle) > 45 || rotation.angle % 22.5 !== 0) stats.freeAngleRotations++;
    }
    if (rotation.rescale) stats.rescaledRotations++;
  };

  const modelIndex = (name) => {
    if (!modelIndices.has(name)) {
      const report = (message) => warnings.once(`model:${name}:${message}`, `Modell ${name}: ${message}`);
      modelIndices.set(name, models.length);
      models.push(null);
      const chain = resolveChain(name, report);
      const ctx = { report, stats, noteRotation, textureIndex: (sprite) => textureIndex(sprite, name) };
      models[modelIndices.get(name)] = convertModel(name, chain, ctx);
    }
    return modelIndices.get(name);
  };

  const blockModels = dict();
  for (const id of [...blockstates.keys()].sort()) {
    const report = (message) => warnings.add(`Blockstate ${id}: ${message}`);
    const props = Object.hasOwn(blocks, id) ? blocks[id].props : null;
    blockModels[id] = convertBlockstate(blockstates.get(id), props, { modelIndex, stats }, report);
  }
  return { data: { version: MC_VERSION, textures, models, blocks: blockModels }, stats };
}

// Blöcke, deren Modelle alle keine Elemente haben (zeichnet special-models.js).
export function findBlocksWithoutGeometry(modelsData) {
  const result = [];
  for (const [id, definition] of Object.entries(modelsData.blocks)) {
    const parts = definition.variants ?? definition.multipart ?? [];
    const applies = parts.flatMap((part) => part.apply);
    if (applies.length > 0 && applies.every((apply) => modelsData.models[apply.model].elements.length === 0)) result.push(id);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Texturen (textures.json + textures.bin)

const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR = Object.freeze([0x49, 0x48, 0x44, 0x52]);

// Bildgröße aus dem PNG-Kopf. bytes: Uint8Array (Node-Puffer sind auch welche) oder ArrayBuffer.
export function readPngSize(bytes) {
  const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (!(data instanceof Uint8Array) || data.length < 24 || PNG_SIGNATURE.some((value, i) => data[i] !== value)) throw new Error('keine PNG-Datei');
  if (IHDR.some((value, i) => data[12 + i] !== value)) throw new Error('PNG ohne IHDR-Block');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0 || width > 16384 || height > 16384) throw new Error(`unplausible Bildgröße ${width}×${height}`);
  return { width, height };
}

const positiveInt = (value) => Number.isInteger(value) && value > 0;

// .mcmeta-Abschnitt "animation" → { fw, fh, frames: [[index, ticks]…], interpolate } (wie SpriteContents im Spiel).
export function parseAnimation(raw, width, height) {
  if (raw === undefined) return null;
  if (!isPlainObject(raw)) throw new Error('„animation“ ist kein Objekt');
  const frametime = raw.frametime === undefined ? 1 : raw.frametime;
  if (!positiveInt(frametime)) throw new Error(`frametime ${JSON.stringify(raw.frametime)} ungültig`);
  for (const key of ['width', 'height']) {
    if (raw[key] !== undefined && !positiveInt(raw[key])) throw new Error(`${key} ${JSON.stringify(raw[key])} ungültig`);
  }
  let fw;
  let fh;
  if (raw.width !== undefined) [fw, fh] = [raw.width, raw.height ?? height];
  else if (raw.height !== undefined) [fw, fh] = [width, raw.height];
  else fw = fh = Math.min(width, height);
  if (width % fw !== 0 || height % fh !== 0) throw new Error(`Bild ${width}×${height} ist kein Vielfaches der Framegröße ${fw}×${fh}`);
  const frameCount = (width / fw) * (height / fh);
  let frames;
  if (raw.frames === undefined) {
    frames = Array.from({ length: frameCount }, (_, index) => [index, frametime]);
  } else {
    if (!Array.isArray(raw.frames) || raw.frames.length === 0) throw new Error('„frames“ ist keine (nicht leere) Liste');
    frames = raw.frames.map((frame) => {
      const index = isPlainObject(frame) ? frame.index : frame;
      const time = isPlainObject(frame) && frame.time !== undefined ? frame.time : frametime;
      if (!Number.isInteger(index) || index < 0 || index >= frameCount) throw new Error(`Frame ${JSON.stringify(frame)} außerhalb von 0…${frameCount - 1}`);
      if (!positiveInt(time)) throw new Error(`Frame-Zeit ${JSON.stringify(frame)} ungültig`);
      return [index, time];
    });
  }
  return { fw, fh, frames, interpolate: raw.interpolate === true };
}

export function isIncludedTexture(name) {
  return TEXTURE_INCLUDE_PATTERNS.some((pattern) => pattern.test(name));
}

// Welche Texturen in textures.json kommen: alle von Modellen genutzten (referenced) und die vorhandenen (available,
// Namen wie „block/stone“) nach den Mustern oben; sortiert wie die Einträge in textures.json.
export function selectTextureNames(referenced, available) {
  const names = new Set(referenced);
  for (const name of available) {
    if (RESOURCE_PATH_PATTERN.test(name) && isIncludedTexture(name)) names.add(name);
  }
  return [...names].sort();
}

// Inhalt einer .png.mcmeta: Funktion (liest das JSON, Fehler darin zählen als unbrauchbar), rohe Bytes
// (Uint8Array/ArrayBuffer, UTF-8) oder Text → JSON; alles andere gilt als schon gelesenes JSON.
function readTextureMeta(meta, name) {
  if (typeof meta === 'function') return meta();
  if (meta instanceof Uint8Array || meta instanceof ArrayBuffer) return parseJsonText(new TextDecoder().decode(meta), `${name}.png.mcmeta`);
  if (typeof meta === 'string') return parseJsonText(meta, `${name}.png.mcmeta`);
  return meta;
}

/**
 * Eintrag für textures.json (ohne Lage o/l bzw. atlas/x/y): { w, h, anim, mip? } aus Bildgröße und .png.mcmeta.
 * meta: undefined (keine .mcmeta), JSON, Bytes, Text oder eine Funktion, die das JSON liefert. Ist sie unbrauchbar,
 * kommt eine Warnung und die Textur ohne Animation (mipmap_strategy bleibt, falls schon gelesen) – wie im Node-Skript.
 */
export function textureEntry({ name, width, height, meta, warnings }) {
  const entry = { w: width, h: height, anim: null };
  if (meta === undefined) return entry;
  try {
    const json = readTextureMeta(meta, name);
    if (typeof json?.texture?.mipmap_strategy === 'string') entry.mip = json.texture.mipmap_strategy;
    entry.anim = parseAnimation(json?.animation, width, height);
  } catch (error) {
    warnings.add(`Textur ${name}: .mcmeta unbrauchbar (${error.message}) – ohne Animation übernommen.`);
  }
  return entry;
}

// ---------------------------------------------------------------------------------------------
// Assets aus den mcmeta-Zusammenfassungen (für buildModels ohne Jar)

function entriesOf(value, label) {
  if (value instanceof Map) return [...value.entries()];
  if (isPlainObject(value)) return Object.entries(value);
  throw new Error(`${label}: kein Objekt`);
}

/**
 * Assets-Quelle wie createJarAssets (has/list/readJson/read), gebaut aus misode/mcmeta:
 * blockstates = assets/block_definition/data.min.json ({ id: Definition } oder Map),
 * models = assets/model/data.min.json ({ "block/stone": Modell, … } oder Map),
 * textureNames = vorhandene Texturen („block/stone“, z. B. die Schlüssel der Atlas-Daten).
 * Texturen gibt es nur als Namen (has/list), Bytes liefert read() nicht.
 */
export function createAssetsFromSummary({ blockstates, models, textureNames = [] }) {
  const files = new Map();
  for (const [id, definition] of entriesOf(blockstates, 'Blockstates')) files.set(`${BLOCKSTATE_PREFIX}${id}.json`, definition);
  for (const [name, model] of entriesOf(models, 'Modelle')) files.set(`${MODEL_PREFIX}${name}.json`, model);
  const textures = new Set(textureNames);
  const listing = [...files.keys(), ...[...textures].map((name) => `${TEXTURE_PREFIX}${name}.png`)].sort();
  const isTexture = (name) => name.startsWith(TEXTURE_PREFIX) && name.endsWith('.png') && textures.has(name.slice(TEXTURE_PREFIX.length, -'.png'.length));
  return {
    has: (name) => files.has(name) || isTexture(name),
    list: (prefix) => listing.filter((name) => name.startsWith(prefix)),
    readJson: (name) => {
      if (!files.has(name)) throw new Error(`fehlt: ${name}`);
      return files.get(name);
    },
    read: (name) => {
      throw new Error(`${name}: in den mcmeta-Zusammenfassungen gibt es nur JSON, keine Rohdaten`);
    },
  };
}
