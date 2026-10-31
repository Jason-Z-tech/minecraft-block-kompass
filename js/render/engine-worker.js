// Modul-Worker der 3D-Ansicht (ARCHITEKTUR §7.4): baut Bauten (Bau-Module, Formen, hochgeladene Dateien,
// Community-Bauten aus data/community/ und Testquellen) mit dem Builder und meshet sie chunkweise, damit der
// Hauptthread flüssig bleibt.
// Die Rechenlogik (Quellen prüfen, bauen, Kollisionsboxen, Galerie, Meshing) ist exportiert und in Node
// testbar; die Nachrichten-Anbindung startet nur, wenn die Datei als Worker läuft.

import { setBlockData, allBlockIds, defaultProps } from '../core/block-data.js';
import { formatState } from '../core/blockstate.js';
import { Builder } from '../core/builder.js';
import { BlockVolume, COORD_MIN, COORD_MAX } from '../core/volume.js';
import { hashPosition } from '../core/random.js';
import { isFence, isWall, isFenceGate } from '../core/connections.js';
import { BlockModels } from './block-models.js';
import { meshChunk, meshStep, meshCap } from './mesher.js';
import {
  loadGameBlockColors, loadGameBlocks, loadGameModels, onGameDataProgress, toGameDataError,
} from '../data/game-data.js';
import { COMMUNITY_DIR, COMMUNITY_MAX_FILE_BYTES, parseCommunityFile } from '../data/community.js';

export class EngineError extends Error {
  // title: eigener Titel für die Anzeige (Spieldaten-Fehler, z. B. „Keine Verbindung zu GitHub“), sonst null
  constructor(message, { code = 'engine', detail = null, title = null } = {}) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
    this.detail = detail;
    this.title = title;
  }
}

/** Fehler beim Laden der Spieldaten (js/data/game-data.js) → EngineError code 'data' mit der menschlichen Meldung. */
export function dataEngineError(error) {
  if (error instanceof EngineError) return error;
  const failure = toGameDataError(error);
  const cause = failure.cause;
  const detail = cause ? `${cause.name ?? 'Error'}: ${cause.message ?? String(cause)}` : `${failure.kind}${failure.file ? ` (${failure.file})` : ''}`;
  return new EngineError(failure.message, { code: 'data', detail, title: failure.title });
}

// ------------------------------------------------------------------ Quellen prüfen

export const SOURCE_KINDS = Object.freeze(['module', 'shape', 'gallery', 'synthetic', 'upload', 'community']);
const MODULE_PATTERN = /^[a-z0-9\-/]+\.js$/;
const MODULE_ROOTS = ['js/builds/', 'tests/fixtures/'];
const SHAPE_PATTERN = /^[a-z0-9-]{1,40}$/;
const PARAM_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
export const SYNTHETIC_MAX = 2_000_000;
// Datei-Import (§12.2): erlaubte Formate und Größe; die genaue Prüfung macht js/create/import/index.js.
export const UPLOAD_FORMATS = Object.freeze(['schem', 'litematic', 'nbt', 'vox', 'stl', 'obj', 'glb', 'gltf']);
export const UPLOAD_MAX_BYTES = 64 * 1024 * 1024;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

// Bau-Modul-Pfad relativ zur Website-Wurzel: nur js/builds/… oder tests/fixtures/…, keine leeren Teile, kein „..“.
export function checkModulePath(path) {
  if (typeof path !== 'string' || path.length > 160 || !MODULE_PATTERN.test(path) || !MODULE_ROOTS.some((root) => path.startsWith(root))
    || path.split('/').some((part) => part === '' || part.startsWith('.'))) {
    throw new EngineError(`Ungültiger Modulpfad „${String(path).slice(0, 80)}“ – erlaubt sind nur Dateien unter js/builds/ oder tests/fixtures/ (a–z, 0–9, -, /, Endung .js).`, { code: 'source' });
  }
  return path;
}

function checkValue(value, depth) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= 200;
  if (Array.isArray(value)) return depth < 3 && value.length <= 4096 && value.every((item) => checkValue(item, depth + 1));
  return false;
}

// Parameter für Bau-Module und Formen: flaches Objekt aus Zahlen, Texten, Wahrheitswerten (Listen bis Tiefe 3).
export function checkParams(params, label = 'Bau-Parameter') {
  if (params === undefined || params === null) return {};
  if (!isPlainObject(params)) throw new EngineError(`${label} müssen ein einfaches Objekt sein.`, { code: 'source' });
  const entries = Object.entries(params);
  if (entries.length > 32) throw new EngineError(`${label}: höchstens 32 Werte.`, { code: 'source' });
  const clean = {};
  for (const [key, value] of entries) {
    if (!PARAM_KEY.test(key)) throw new EngineError(`${label}: ungültiger Name „${key.slice(0, 40)}“.`, { code: 'source' });
    if (!checkValue(value, 0)) throw new EngineError(`${label}: ungültiger Wert für „${key}“.`, { code: 'source' });
    clean[key] = structuredClone(value);
  }
  if (clean.scale !== undefined && !(typeof clean.scale === 'number' && clean.scale > 0 && clean.scale <= 8)) {
    throw new EngineError(`${label}: scale muss eine Zahl größer 0 und höchstens 8 sein.`, { code: 'source' });
  }
  return clean;
}

// Upload-Quelle { kind:'upload', format, name, data: ArrayBuffer, params } → bereinigte Kopie (data bleibt dasselbe ArrayBuffer).
export function checkUploadSource(source) {
  if (!UPLOAD_FORMATS.includes(source.format)) {
    throw new EngineError(`Unbekanntes Dateiformat – erlaubt: ${UPLOAD_FORMATS.map((f) => `.${f}`).join(', ')}.`, { code: 'source' });
  }
  const data = source.data;
  if (!(data instanceof ArrayBuffer)) throw new EngineError('Die Datei fehlt (data muss ein ArrayBuffer sein).', { code: 'source' });
  if (data.byteLength === 0) throw new EngineError('Die Datei ist leer.', { code: 'upload' });
  if (data.byteLength > UPLOAD_MAX_BYTES) {
    throw new EngineError(`Die Datei ist zu groß (${(data.byteLength / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB) – erlaubt sind höchstens 64 MB.`, { code: 'upload' });
  }
  const rawName = typeof source.name === 'string' ? source.name.split(/[\\/]/).pop() : '';
  const name = rawName.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 120) || 'Datei';
  return { kind: 'upload', format: source.format, name, data, params: checkParams(source.params, 'Upload-Parameter') };
}

/**
 * Community-Bau { kind:'community', file: '<id>.nbt' | '<id>.schem' | '<id>.litematic' } → { kind, file, format }.
 * Nur ein Dateiname ohne Pfad (a–z, 0–9, -), damit nur Dateien aus data/community/ geladen werden.
 */
export function checkCommunitySource(source) {
  const parsed = parseCommunityFile(source.file);
  if (!parsed) {
    throw new EngineError(`Ungültiger Community-Bau „${String(source.file).slice(0, 80)}“ – erlaubt ist nur ein Dateiname wie „name.nbt“, „name.schem“ oder „name.litematic“ (a–z, 0–9, -).`, { code: 'source' });
  }
  return { kind: 'community', file: source.file, format: parsed.format };
}

/** Prüft eine Quelle aus §7.4 (plus Testquellen) und gibt eine bereinigte Kopie zurück; wirft EngineError. */
export function checkSource(source) {
  if (!isPlainObject(source) || !SOURCE_KINDS.includes(source.kind)) {
    throw new EngineError(`Unbekannte Quelle – erwartet wird { kind: ${SOURCE_KINDS.map((k) => `'${k}'`).join(' | ')} }.`, { code: 'source' });
  }
  switch (source.kind) {
    case 'module': return { kind: 'module', path: checkModulePath(source.path) };
    case 'upload': return checkUploadSource(source);
    case 'community': return checkCommunitySource(source);
    case 'shape': {
      if (typeof source.shape !== 'string' || !SHAPE_PATTERN.test(source.shape)) {
        throw new EngineError(`Ungültiger Formname „${String(source.shape).slice(0, 40)}“ (a–z, 0–9, -).`, { code: 'source' });
      }
      return { kind: 'shape', shape: source.shape, params: checkParams(source.params, 'Form-Parameter') };
    }
    case 'gallery': {
      const group = source.group ?? 'all';
      if (!Object.hasOwn(GALLERY_GROUPS, group)) {
        throw new EngineError(`Unbekannte Galerie „${String(group).slice(0, 40)}“ – erlaubt: ${Object.keys(GALLERY_GROUPS).join(', ')}.`, { code: 'source' });
      }
      const page = source.page ?? 0;
      if (!Number.isInteger(page) || page < 0 || page > 999) throw new EngineError('Galerie-Seite muss eine ganze Zahl von 0 bis 999 sein.', { code: 'source' });
      return { kind: 'gallery', group, page };
    }
    default: {
      const count = source.count;
      if (!Number.isInteger(count) || count < 1 || count > SYNTHETIC_MAX) {
        throw new EngineError(`Testvolumen: count muss eine ganze Zahl von 1 bis ${SYNTHETIC_MAX} sein.`, { code: 'source' });
      }
      return { kind: 'synthetic', count };
    }
  }
}

// ------------------------------------------------------------------ Schnitt

export const CROP_KEYS = Object.freeze(['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ']);

/**
 * Schnitt { minX, maxX, minY, maxY, minZ, maxZ } (Block-Koordinaten, inklusiv, jedes Feld optional, mindestens eins)
 * prüfen → bereinigte Kopie in fester Feldreihenfolge; wirft EngineError.
 */
export function checkCrop(crop) {
  if (!isPlainObject(crop)) throw new EngineError('Schnitt muss ein Objekt { minX, maxX, minY, maxY, minZ, maxZ } sein.', { code: 'source' });
  const unknown = Object.keys(crop).filter((key) => !CROP_KEYS.includes(key));
  if (unknown.length) throw new EngineError(`Unbekanntes Feld im Schnitt: ${unknown.slice(0, 3).join(', ').slice(0, 80)} (erlaubt: ${CROP_KEYS.join(', ')}).`, { code: 'source' });
  const clean = {};
  for (const key of CROP_KEYS) {
    if (crop[key] === undefined) continue;
    const value = crop[key];
    if (!Number.isInteger(value) || value < COORD_MIN || value > COORD_MAX) {
      throw new EngineError(`Schnitt: ${key} muss eine ganze Zahl von ${COORD_MIN} bis ${COORD_MAX} sein.`, { code: 'source' });
    }
    clean[key] = value;
  }
  if (!Object.keys(clean).length) throw new EngineError('Schnitt ohne Grenze – mindestens ein Feld setzen.', { code: 'source' });
  for (const axis of ['X', 'Y', 'Z']) {
    if (clean[`min${axis}`] !== undefined && clean[`max${axis}`] !== undefined && clean[`min${axis}`] > clean[`max${axis}`]) {
      throw new EngineError(`Schnitt: min${axis} darf nicht größer als max${axis} sein.`, { code: 'source' });
    }
  }
  return clean;
}

/** Entfernt alle Blöcke außerhalb des (geprüften) Schnitts aus dem Volumen. → Anzahl entfernter Blöcke */
export function cropVolume(volume, crop) {
  const lo = [crop.minX ?? COORD_MIN, crop.minY ?? COORD_MIN, crop.minZ ?? COORD_MIN];
  const hi = [crop.maxX ?? COORD_MAX, crop.maxY ?? COORD_MAX, crop.maxZ ?? COORD_MAX];
  const outside = [];
  volume.forEach((x, y, z) => {
    if (x < lo[0] || x > hi[0] || y < lo[1] || y > hi[1] || z < lo[2] || z > hi[2]) outside.push(x, y, z);
  });
  for (let i = 0; i < outside.length; i += 3) volume.delete(outside[i], outside[i + 1], outside[i + 2]);
  return outside.length / 3;
}

// ------------------------------------------------------------------ Bauen

function wrapBuildError(label, error) {
  if (error instanceof EngineError) return error;
  return new EngineError(`${label} konnte nicht gebaut werden: ${error?.message ?? String(error)}`, { code: 'build', detail: error?.stack ?? null });
}

/** Bau-Modul (Namensraum des Imports) → BuildResult; meta wird mitgegeben. */
export function buildModule(mod, params, path) {
  if (!mod || typeof mod.default !== 'function') {
    throw new EngineError(`„${path}“ ist kein Bau-Modul (es fehlt „export default function build(b) { … }“).`, { code: 'build' });
  }
  const label = `Das Bau-Modul „${path}“`;
  let result;
  try {
    const b = new Builder();
    const value = mod.default(b, params);
    if (value && typeof value.then === 'function') throw new EngineError(`${label} baut asynchron – build() muss synchron sein.`, { code: 'build' });
    result = b.finalize();
  } catch (error) {
    throw wrapBuildError(label, error);
  }
  try {
    result.meta = isPlainObject(mod.meta) ? structuredClone(mod.meta) : null;
  } catch (error) {
    result.meta = null;
    result.warnings.push(`meta des Moduls lässt sich nicht übertragen: ${error.message}`);
  }
  return result;
}

/** Form aus js/create/shape-generators.js (Vertrag: buildShape(b, shape, params) baut in den Builder). */
export function buildShapeResult(generators, shape, params) {
  if (!generators || typeof generators.buildShape !== 'function') {
    throw new EngineError('Der Formen-Generator ist noch nicht verfügbar (js/create/shape-generators.js mit buildShape fehlt).', { code: 'source' });
  }
  try {
    const b = new Builder();
    generators.buildShape(b, shape, params);
    const result = b.finalize();
    result.shape = { shape, params };
    return result;
  } catch (error) {
    throw wrapBuildError(`Die Form „${shape}“`, error);
  }
}

/**
 * Hochgeladene Datei → BuildResult über js/create/import/index.js (Vertrag: importFile(options) → ImportResult,
 * importToBuildResult(imported) → BuildResult). hooks: { progress(message), loadBlockColors(), importVoxelizer() }.
 * ImportError (deutsche Meldung) wird zu EngineError code 'upload'.
 */
export async function buildUploadResult(uploader, source, hooks = {}) {
  if (!uploader || typeof uploader.importFile !== 'function' || typeof uploader.importToBuildResult !== 'function') {
    throw new EngineError('Der Datei-Import ist noch nicht verfügbar (js/create/import/index.js fehlt).', { code: 'source' });
  }
  const onProgress = typeof hooks.progress === 'function' ? (message) => hooks.progress(message) : null;
  try {
    const imported = await uploader.importFile({
      format: source.format, name: source.name, data: source.data, params: source.params, onProgress,
      loadBlockColors: hooks.loadBlockColors ?? null, importVoxelizer: hooks.importVoxelizer ?? null,
    });
    return uploader.importToBuildResult(imported, { onProgress });
  } catch (error) {
    if (error instanceof EngineError) throw error;
    if (error?.name === 'ImportError') throw new EngineError(error.message, { code: 'upload', detail: error.detail ?? `${error.code}` });
    throw wrapBuildError(`Die Datei „${source.name}“`, error);
  }
}

const COMMUNITY_FAILED = 'Die Datei dieses Baus konnte nicht geladen werden.';

/**
 * Lädt die Datei eines Community-Baus vom eigenen Server: <rootUrl>/data/community/<file> (gleicher Ursprung, die CSP
 * bleibt unverändert; auf GitHub Pages auch unter /minecraft-block-kompass/). Höchstens 20 MB.
 * → ArrayBuffer; Fehler als EngineError code 'community' (Netz, fehlt, zu groß).
 */
export async function fetchCommunityFile(file, { rootUrl, fetch: fetchImpl = globalThis.fetch } = {}) {
  const { file: name } = checkCommunitySource({ file });
  const url = new URL(`${COMMUNITY_DIR}${name}`, rootUrl);
  let response;
  try {
    response = await fetchImpl(url, { credentials: 'same-origin', cache: 'default' });
  } catch (error) {
    throw new EngineError(`${COMMUNITY_FAILED} Prüfe die Internetverbindung und versuche es noch einmal.`, { code: 'community', detail: error?.message ?? String(error) });
  }
  if (response.status === 404) throw new EngineError('Die Datei dieses Baus fehlt auf der Seite.', { code: 'community', detail: `404 ${url.pathname}` });
  if (!response.ok) throw new EngineError(`${COMMUNITY_FAILED} (Fehler ${response.status})`, { code: 'community', detail: `${response.status} ${url.pathname}` });
  const tooLarge = () => new EngineError(`${COMMUNITY_FAILED} Sie ist größer als ${COMMUNITY_MAX_FILE_BYTES / 1024 / 1024} MB.`, { code: 'community' });
  if (Number(response.headers?.get?.('content-length')) > COMMUNITY_MAX_FILE_BYTES) throw tooLarge();
  let data;
  try {
    data = await response.arrayBuffer();
  } catch (error) {
    throw new EngineError(`${COMMUNITY_FAILED} Die Übertragung wurde abgebrochen.`, { code: 'community', detail: error?.message ?? String(error) });
  }
  if (data.byteLength > COMMUNITY_MAX_FILE_BYTES) throw tooLarge();
  return data;
}

/**
 * Community-Bau → BuildResult: Datei über loaders.loadCommunityFile(file) laden und mit derselben Import-Pipeline bauen
 * wie einen Upload (Ebene für Ebene). result.upload enthält die Kennzahlen der Datei.
 */
export async function buildCommunityResult(source, loaders) {
  if (typeof loaders?.loadCommunityFile !== 'function') throw new EngineError('Community-Bauten können hier nicht geladen werden.', { code: 'source' });
  const data = await loaders.loadCommunityFile(source.file);
  if (!(data instanceof ArrayBuffer)) throw new EngineError(COMMUNITY_FAILED, { code: 'community', detail: 'keine Binärdaten' });
  const upload = checkUploadSource({ kind: 'upload', format: source.format, name: source.file, data, params: {} });
  return buildUploadResult(await loaders.importUploader(), upload, loaders);
}

// ------------------------------------------------------------------ Testvolumen (Leistung)

function valueNoise(x, z, scale, salt) {
  const gx = Math.floor(x / scale), gz = Math.floor(z / scale);
  const fx = x / scale - gx, fz = z / scale - gz;
  const corner = (i, j) => (hashPosition(gx + i, 0, gz + j, salt) & 0xffff) / 0xffff;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * sx;
  const bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * sx;
  return top + (bottom - top) * sz;
}

const SYNTHETIC_ORES = ['coal_ore', 'iron_ore', 'copper_ore', 'stone', 'andesite', 'gravel'];

/**
 * Großes, deterministisches Testvolumen mit etwa count Blöcken: Gelände (Stein, Erz, Erde, Gras), Wasser,
 * Bäume mit Laub, Blumen. Schritte = Ebenen. Für Leistungsmessungen (Meshing, FPS).
 */
export function buildSynthetic(count) {
  // Fläche großzügig wählen (Ø gut 10 Blöcke je Säule); gebaut wird nur, bis count erreicht ist
  const side = Math.max(16, Math.ceil(Math.sqrt(count / 8)));
  const b = new Builder({ seed: 'synthetic', maxBlocks: SYNTHETIC_MAX + 4096 });
  b.phase('Gelände');
  const water = 6;
  for (let z = 0; z < side && b.blockCount < count; z++) {
    for (let x = 0; x < side && b.blockCount < count; x++) {
      const h = 3 + Math.floor(8 * valueNoise(x, z, 28, 1) + 4 * valueNoise(x, z, 9, 2));
      const hash = hashPosition(x, 0, z, 7);
      if (h > 4) b.fill(x, 0, z, x, h - 4, z, 'stone');
      for (let y = 1; y < h - 3; y += 3) if (hashPosition(x, y, z, 3) % 23 === 0) b.set(x, y, z, SYNTHETIC_ORES[hashPosition(x, y, z, 4) % SYNTHETIC_ORES.length]);
      b.fill(x, Math.max(0, h - 3), z, x, h - 1, z, 'dirt');
      if (h < water) {
        b.set(x, h, z, 'sand');
        b.fill(x, h + 1, z, x, water, z, 'water');
        continue;
      }
      b.set(x, h, z, 'grass_block');
      if (hash % 53 === 0 && x > 2 && z > 2 && x < side - 3 && z < side - 3) {
        b.fill(x - 2, h + 3, z - 2, x + 2, h + 4, z + 2, 'oak_leaves[persistent=true]', { keep: true });
        b.fill(x - 1, h + 5, z - 1, x + 1, h + 5, z + 1, 'oak_leaves[persistent=true]', { keep: true });
        b.fill(x, h + 1, z, x, h + 4, z, 'oak_log[axis=y]');
      } else if (hash % 7 === 0) {
        b.set(x, h + 1, z, hash % 3 === 0 ? 'poppy' : 'short_grass');
      }
    }
  }
  return b.finalize();
}

// ------------------------------------------------------------------ Galerie (Sichtprüfung)

const FACINGS = ['north', 'east', 'south', 'west'];
const DIRECTIONS6 = ['north', 'east', 'south', 'west', 'up', 'down'];
const STEP = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped'];
const WALL_MOUNTED = /(^|_)wall_|^ladder$|^tripwire_hook$/;
export const GALLERY_PAGE_SIZE = 100;
const GALLERY_COLUMNS = 10;
const GALLERY_ROW_ITEMS = 8;

// Ein Galerie-Eintrag: Teile [dx, dy, dz, zustand]; connect = Auto-Verbindungen wie beim Setzen im Spiel.
const item = (label, parts, connect = false) => ({ label, parts, connect });
const one = (state) => item(state, [[0, 0, 0, state]]);
const row = (title, items) => ({ title, items });

function door(id, facing, hinge = 'left', open = false) {
  const props = `facing=${facing},hinge=${hinge},open=${open}`;
  return item(`${id}[${props}]`, [[0, 0, 0, `${id}[${props},half=lower]`], [0, 1, 0, `${id}[${props},half=upper]`]]);
}

function tallPlant(id, extra = '') {
  const prefix = extra ? `${extra},` : '';
  return item(id, [[0, 0, 0, `${id}[${prefix}half=lower]`], [0, 1, 0, `${id}[${prefix}half=upper]`]]);
}

function bed(id, facing) {
  const [dx, dz] = STEP[facing];
  return item(`${id}[facing=${facing}]`, [[0, 0, 0, `${id}[facing=${facing},part=foot]`], [dx, 0, dz, `${id}[facing=${facing},part=head]`]]);
}

// An einer Wand: facing zeigt von der Wand weg, die Wand liegt also auf der Gegenseite.
function onWall(state, facing, wall = 'stone_bricks') {
  const [dx, dz] = STEP[facing];
  return item(state, [[0, 0, 0, state], [-dx, 0, -dz, wall]]);
}

function underBlock(state, block = 'oak_planks') {
  return item(state, [[0, 0, 0, state], [0, 1, 0, block]]);
}

function line(state, length) {
  return item(`${state} ×${length}`, Array.from({ length }, (_, i) => [i, 0, 0, state]), true);
}

function cross(state) {
  return item(`${state} Kreuz`, [[1, 0, 0, state], [0, 0, 1, state], [1, 0, 1, state], [2, 0, 1, state], [1, 0, 2, state]], true);
}

function corner(state) {
  return item(`${state} Ecke`, [[0, 0, 0, state], [1, 0, 0, state], [2, 0, 0, state], [0, 0, 1, state], [0, 0, 2, state]], true);
}

// Ring aus 8 Treppen um einen Mittelblock: hohe Seite außen (out) oder innen (in) → Außen-/Innenecken.
function stairRing(id, outward) {
  const parts = [[1, 0, 1, 'stone_bricks']];
  for (let z = 0; z < 3; z++) {
    for (let x = 0; x < 3; x++) {
      if (x === 1 && z === 1) continue;
      let facing = z === 0 ? 'north' : z === 2 ? 'south' : x === 0 ? 'west' : 'east';
      if (!outward) facing = { north: 'south', south: 'north', west: 'east', east: 'west' }[facing];
      parts.push([x, 0, z, `${id}[facing=${facing}]`]);
    }
  }
  return item(`${id} Ring ${outward ? 'außen' : 'innen'}`, parts, true);
}

function staircase(id, height) {
  const parts = [];
  for (let i = 0; i < height; i++) {
    for (let y = 0; y < i; y++) parts.push([i, y, 0, 'stone_bricks']);
    parts.push([i, i, 0, `${id}[facing=east]`]);
  }
  return item(`${id} Aufgang`, parts, true);
}

// Becken: Boden und Rand aus Stein, innen size × size Flüssigkeit.
function pool(fluid, size = 3, rim = 'stone') {
  const parts = [];
  for (let z = 0; z < size + 2; z++) {
    for (let x = 0; x < size + 2; x++) {
      parts.push([x, 0, z, rim]);
      const inside = x > 0 && z > 0 && x <= size && z <= size;
      parts.push([x, 1, z, inside ? fluid : rim]);
    }
  }
  return item(`${fluid} Becken`, parts);
}

function aquarium() {
  const parts = [];
  for (let y = 0; y < 4; y++) {
    for (let z = 0; z < 4; z++) {
      for (let x = 0; x < 5; x++) {
        const shell = y === 0 || x === 0 || z === 0 || x === 4 || z === 3;
        if (shell) parts.push([x, y, z, 'glass']);
        else if (y < 3) parts.push([x, y, z, x === 2 && z === 1 && y === 1 ? 'seagrass' : 'water']);
      }
    }
  }
  return item('Aquarium', parts, true);
}

function extendedPiston(id, facing) {
  const offset = { north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0] }[facing];
  const type = id === 'sticky_piston' ? 'sticky' : 'normal';
  return item(`${id} ausgefahren ${facing}`, [[0, 0, 0, `${id}[extended=true,facing=${facing}]`], [...offset, `piston_head[facing=${facing},type=${type}]`]]);
}

function wire(parts) {
  return item('redstone_wire', parts.map(([x, z, power]) => [x, 0, z, `redstone_wire[power=${power}]`]), true);
}

const GALLERY_GROUPS = Object.freeze({
  all: null,
  stairs: () => [
    row('Eichentreppen unten: Norden, Osten, Süden, Westen', FACINGS.map((f) => one(`oak_stairs[facing=${f},half=bottom]`))),
    row('Eichentreppen oben', FACINGS.map((f) => one(`oak_stairs[facing=${f},half=top]`))),
    row('Formen (facing=north)', ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'].map((s) => one(`oak_stairs[facing=north,shape=${s}]`))),
    row('Steinziegel oben (facing=east)', ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'].map((s) => one(`stone_brick_stairs[facing=east,half=top,shape=${s}]`))),
    row('Automatische Ecken und Aufgang', [stairRing('oak_stairs', true), stairRing('cobblestone_stairs', false), staircase('stone_brick_stairs', 4)]),
    row('Treppen aus vielen Materialien (facing=south)', ['stone', 'cobblestone', 'mossy_cobblestone', 'sandstone', 'red_sandstone', 'quartz', 'smooth_quartz', 'prismarine',
      'dark_prismarine', 'nether_brick', 'mud_brick', 'blackstone', 'deepslate_tile', 'tuff_brick', 'resin_brick', 'cut_copper', 'oxidized_cut_copper',
      'bamboo_mosaic', 'cherry', 'crimson', 'end_stone_brick', 'purpur', 'cinnabar', 'sulfur_brick'].map((m) => one(`${m}_stairs[facing=south]`))),
    row('Stufen', ['oak_slab[type=bottom]', 'oak_slab[type=top]', 'oak_slab[type=double]', 'smooth_stone_slab[type=bottom]', 'smooth_stone_slab[type=double]',
      'stone_brick_slab[type=top]', 'cut_copper_slab[type=bottom]', 'sandstone_slab[type=double]', 'oak_slab[type=bottom,waterlogged=true]'].map(one)),
  ],
  orientation: () => [
    row('Stämme: Achse x, y, z', ['oak_log', 'stripped_oak_log', 'quartz_pillar', 'bamboo_block'].flatMap((id) => ['x', 'y', 'z'].map((a) => one(`${id}[axis=${a}]`)))),
    row('Alle Stämme stehend', [...WOODS.filter((w) => !['bamboo', 'crimson', 'warped'].includes(w)).map((w) => one(`${w}_log`)), one('crimson_stem'), one('warped_stem'),
      one('oak_wood'), one('basalt[axis=x]'), one('bone_block[axis=z]'), one('hay_block[axis=x]'), one('purpur_pillar[axis=z]'), one('deepslate[axis=x]'), one('creaking_heart[axis=x]')]),
    row('Öfen: Blick nach Norden, Osten, Süden, Westen; an', [...FACINGS.map((f) => one(`furnace[facing=${f}]`)), one('furnace[facing=south,lit=true]'),
      one('blast_furnace[facing=south]'), one('blast_furnace[facing=south,lit=true]'), one('smoker[facing=south,lit=true]')]),
    row('Beobachter: N, O, S, W, oben, unten', DIRECTIONS6.map((f) => one(`observer[facing=${f}]`))),
    row('Spender und Werfer: N, O, S, W, oben, unten', [...DIRECTIONS6.map((f) => one(`dispenser[facing=${f}]`)), one('dropper[facing=up]'), one('dropper[facing=south]')]),
    row('Kolben: N, O, S, W, oben, unten', [...DIRECTIONS6.map((f) => one(`piston[facing=${f}]`)), one('sticky_piston[facing=up]'), one('sticky_piston[facing=south]')]),
    row('Kürbisse und Glasierte Keramik: N, O, S, W', [...FACINGS.map((f) => one(`carved_pumpkin[facing=${f}]`)), one('jack_o_lantern[facing=south]'),
      ...FACINGS.map((f) => one(`magenta_glazed_terracotta[facing=${f}]`))]),
    row('Werkbänke (facing=south)', [one('barrel[facing=up]'), one('barrel[facing=south,open=true]'), one('beehive[facing=south]'), one('bee_nest[facing=south,honey_level=5]'),
      one('loom[facing=south]'), one('chiseled_bookshelf[facing=south,slot_0_occupied=true,slot_4_occupied=true]'), one('lectern[facing=south,has_book=true]'),
      one('stonecutter[facing=south]'), one('crafter[orientation=south_up]'), one('vault[facing=south]'), one('oak_shelf[facing=south]'), one('dried_ghast[facing=south]')]),
    row('Amboss und Schleifstein', [one('anvil[facing=north]'), one('anvil[facing=east]'), one('chipped_anvil[facing=south]'), one('damaged_anvil[facing=west]'),
      one('grindstone[face=floor,facing=north]'), onWall('grindstone[face=wall,facing=south]', 'south'), underBlock('grindstone[face=ceiling,facing=east]', 'stone_bricks')]),
  ],
  fences: () => [
    row('Zäune verbinden sich', [line('oak_fence', 4), cross('spruce_fence'), corner('nether_brick_fence')]),
    row('Alle Holzzäune', WOODS.map((w) => line(`${w}_fence`, 2))),
    row('Mauern', [line('cobblestone_wall', 4), cross('stone_brick_wall'), corner('mossy_cobblestone_wall'),
      item('brick_wall hoch', [[0, 0, 0, 'brick_wall'], [1, 0, 0, 'brick_wall'], [2, 0, 0, 'brick_wall'], [0, 1, 0, 'bricks'], [1, 1, 0, 'bricks'], [2, 1, 0, 'bricks']], true),
      line('blackstone_wall', 3), line('end_stone_brick_wall', 3)]),
    row('Scheiben und Gitter', [line('glass_pane', 4), cross('white_stained_glass_pane'), corner('iron_bars'), line('copper_bars', 3), line('red_stained_glass_pane', 3),
      item('Scheibe an Wand', [[0, 0, 0, 'stone_bricks'], [1, 0, 0, 'glass_pane'], [2, 0, 0, 'glass_pane'], [3, 0, 0, 'stone_bricks']], true)]),
    row('Zauntore', [one('oak_fence_gate[facing=north]'), one('oak_fence_gate[facing=east]'), one('oak_fence_gate[facing=north,open=true]'),
      one('spruce_fence_gate[facing=east,open=true]'),
      item('Tor zwischen Zäunen', [[0, 0, 0, 'birch_fence'], [1, 0, 0, 'birch_fence_gate[facing=south]'], [2, 0, 0, 'birch_fence']], true),
      item('Tor in Mauer', [[0, 0, 0, 'cobblestone_wall'], [1, 0, 0, 'oak_fence_gate[facing=south]'], [2, 0, 0, 'cobblestone_wall']], true)]),
  ],
  glass: () => [
    row('Glas (Würfel aus 8 Blöcken: innen keine Flächen)', [
      item('glass Würfel', [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]].map((p) => [...p, 'glass'])),
      item('Buntglas Würfel', [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]].map((p) => [...p, 'light_blue_stained_glass'])),
      one('tinted_glass'), one('glass')]),
    row('Buntglas', COLORS.map((c) => one(`${c}_stained_glass`))),
    row('Eis, Schleim, Honig', ['ice', 'packed_ice', 'blue_ice', 'frosted_ice', 'slime_block', 'honey_block', 'copper_grate', 'oxidized_copper_grate'].map(one)),
    row('Aquarium und Glas hintereinander', [aquarium(),
      item('Buntglas hintereinander', [[0, 0, 0, 'red_stained_glass'], [0, 0, 1, 'lime_stained_glass'], [0, 0, 2, 'blue_stained_glass'], [0, 0, 3, 'yellow_stained_glass']])]),
  ],
  plants: () => [
    row('Laub (persistent)', allBlockIds().filter((id) => id.endsWith('_leaves')).sort().map((id) => one(`${id}[persistent=true]`))),
    row('Gras, Farne, Büsche', [one('grass_block'), one('grass_block[snowy=true]'), one('podzol'), one('mycelium'), one('moss_block'), one('short_grass'), tallPlant('tall_grass'),
      one('fern'), tallPlant('large_fern'), one('bush'), one('firefly_bush'), one('short_dry_grass'), one('tall_dry_grass'), one('dead_bush')]),
    row('Blumen', [...['dandelion', 'golden_dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy',
      'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower', 'open_eyeblossom', 'closed_eyeblossom'].map(one),
    tallPlant('sunflower'), tallPlant('lilac'), tallPlant('rose_bush'), tallPlant('peony'), tallPlant('pitcher_plant')]),
    row('Bodendecker', [one('pink_petals[flower_amount=4]'), one('wildflowers[flower_amount=4,facing=east]'), one('leaf_litter[segment_amount=4]'), one('moss_carpet'),
      one('pale_moss_carpet'), one('snow[layers=3]'), one('lily_pad'), item('cactus mit Blüte', [[0, 0, 0, 'cactus'], [0, 1, 0, 'cactus_flower']])]),
    row('Ranken und Hängendes', [onWall('vine[south=true]', 'north'), onWall('glow_lichen[south=true]', 'north'), item('sugar_cane', [[0, 0, 0, 'sugar_cane'], [0, 1, 0, 'sugar_cane']]),
      underBlock('hanging_roots', 'rooted_dirt'), underBlock('spore_blossom', 'moss_block'), underBlock('pale_hanging_moss', 'pale_moss_block'),
      underBlock('cave_vines[berries=true]', 'stone'), item('bamboo', [[0, 0, 0, 'bamboo[leaves=small]'], [0, 1, 0, 'bamboo[leaves=large]']]), tallPlant('small_dripleaf'),
      item('big_dripleaf', [[0, 0, 0, 'big_dripleaf_stem'], [0, 1, 0, 'big_dripleaf']])]),
    row('Setzlinge und Pilze', [...WOODS.filter((w) => !['bamboo', 'crimson', 'warped', 'mangrove'].includes(w)).map((w) => one(`${w}_sapling`)), one('mangrove_propagule'),
      one('azalea'), one('flowering_azalea'), one('brown_mushroom'), one('red_mushroom'), one('crimson_fungus'), one('warped_fungus'), one('crimson_roots'), one('nether_sprouts')]),
    row('Feldfrüchte', [one('wheat[age=7]'), one('carrots[age=7]'), one('potatoes[age=7]'), one('beetroots[age=3]'), one('melon_stem[age=7]'),
      item('attached_melon_stem', [[0, 0, 0, 'attached_melon_stem[facing=east]'], [1, 0, 0, 'melon']]), one('sweet_berry_bush[age=3]'),
      item('cocoa', [[0, 0, 0, 'cocoa[age=2,facing=south]'], [0, 0, 1, 'jungle_log']]), one('nether_wart[age=3]'), one('torchflower_crop[age=1]'),
      tallPlant('pitcher_crop', 'age=4'), one('farmland[moisture=7]'), one('dirt_path')]),
  ],
  fluids: () => [
    row('Wasser: Becken, fließend (level 1 … 7), fallend', [pool('water'), ...[1, 2, 3, 4, 5, 6, 7].map((level) => one(`water[level=${level}]`)), one('water[level=8]')]),
    row('Lava', [pool('lava', 3, 'blackstone'), one('lava[level=2]'), one('lava[level=4]'), one('lava[level=6]')]),
    row('Wassergeflutet', [one('oak_stairs[facing=south,waterlogged=true]'), one('oak_slab[type=bottom,waterlogged=true]'), one('oak_slab[type=top,waterlogged=true]'),
      one('oak_fence[waterlogged=true]'), one('glass_pane[waterlogged=true]'), one('lantern[waterlogged=true]'), one('chest[facing=south,waterlogged=true]'),
      one('oak_leaves[persistent=true,waterlogged=true]'), one('seagrass'), tallPlant('tall_seagrass'), item('kelp', [[0, 0, 0, 'kelp_plant'], [0, 1, 0, 'kelp']]),
      one('sea_pickle[pickles=4]'), one('bubble_column'), one('tube_coral_fan'), one('brain_coral')]),
    row('Kessel', [one('cauldron'), one('water_cauldron[level=1]'), one('water_cauldron[level=2]'), one('water_cauldron[level=3]'), one('lava_cauldron'),
      one('powder_snow_cauldron[level=3]')]),
    row('Wasserfall', [item('Wasserfall', [[0, 0, 0, 'stone'], [0, 1, 0, 'stone'], [0, 2, 0, 'stone'], [0, 3, 0, 'water'], [1, 3, 0, 'stone'],
      [1, 2, 0, 'water[level=8]'], [1, 1, 0, 'water[level=8]'], [1, 0, 0, 'water[level=8]'], [2, 0, 0, 'water[level=1]'], [3, 0, 0, 'water[level=2]']])]),
  ],
  chests: () => [
    row('Truhen: Blick nach Norden, Osten, Süden, Westen', FACINGS.map((f) => one(`chest[facing=${f}]`))),
    row('Doppeltruhen (verbinden sich)', [
      item('chest north', [[0, 0, 0, 'chest[facing=north]'], [1, 0, 0, 'chest[facing=north]']], true),
      item('chest south', [[0, 0, 0, 'chest[facing=south]'], [1, 0, 0, 'chest[facing=south]']], true),
      item('chest east', [[0, 0, 0, 'chest[facing=east]'], [0, 0, 1, 'chest[facing=east]']], true),
      item('trapped_chest south', [[0, 0, 0, 'trapped_chest[facing=south]'], [1, 0, 0, 'trapped_chest[facing=south]']], true),
      item('copper_chest west', [[0, 0, 0, 'copper_chest[facing=west]'], [0, 0, 1, 'copper_chest[facing=west]']], true)]),
    row('Besondere Truhen', [one('trapped_chest[facing=south]'), one('ender_chest[facing=south]'), one('copper_chest[facing=south]'), one('exposed_copper_chest[facing=south]'),
      one('weathered_copper_chest[facing=south]'), one('oxidized_copper_chest[facing=south]'), one('waxed_copper_chest[facing=south]'), one('barrel[facing=up]')]),
    row('Shulkerkisten', [one('shulker_box'), ...COLORS.map((c) => one(`${c}_shulker_box`))]),
    row('Shulkerkiste in alle Richtungen', DIRECTIONS6.map((f) => one(`purple_shulker_box[facing=${f}]`))),
    row('Krüge', [one('decorated_pot[facing=south]'), one('decorated_pot[facing=east,cracked=true]'), one('flower_pot'), one('potted_poppy')]),
  ],
  beds: () => [
    row('Rotes Bett: Kopfteil nach Norden, Osten, Süden, Westen', FACINGS.map((f) => bed('red_bed', f))),
    row('Alle Farben (Kopfteil nach Süden)', COLORS.map((c) => bed(`${c}_bed`, 'south'))),
  ],
  signs: () => [
    row('Schild stehend: rotation 0, 4, 8, 12', [0, 4, 8, 12].map((r) => one(`oak_sign[rotation=${r}]`))),
    row('Alle Holzarten', WOODS.map((w) => one(`${w}_sign[rotation=8]`))),
    row('Wandschilder: Blick nach Norden, Osten, Süden, Westen', FACINGS.map((f) => onWall(`oak_wall_sign[facing=${f}]`, f))),
    row('Hängeschilder', [underBlock('oak_hanging_sign[attached=false,rotation=8]'), underBlock('spruce_hanging_sign[attached=true,rotation=8]'),
      underBlock('cherry_hanging_sign[attached=false,rotation=4]'), one('oak_wall_hanging_sign[facing=north]'), one('bamboo_wall_hanging_sign[facing=east]')]),
    row('Banner: rotation 0, 4, 8, 12; Wandbanner', [...[0, 4, 8, 12].map((r) => one(`red_banner[rotation=${r}]`)), one('white_banner[rotation=8]'), one('blue_banner[rotation=8]'),
      onWall('lime_wall_banner[facing=south]', 'south'), onWall('yellow_wall_banner[facing=east]', 'east')]),
    row('Köpfe (rotation=8)', ['skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'player_head', 'creeper_head', 'piglin_head', 'dragon_head'].map((id) => one(`${id}[rotation=8]`))),
    row('Kopf-Drehung: rotation 0, 2, 4, 8, 12', [0, 2, 4, 8, 12].map((r) => one(`creeper_head[rotation=${r}]`))),
    row('Wandköpfe (facing=south)', ['skeleton_wall_skull', 'zombie_wall_head', 'player_wall_head', 'creeper_wall_head', 'piglin_wall_head', 'dragon_wall_head'].map((id) => onWall(`${id}[facing=south]`, 'south'))),
  ],
  doors: () => [
    row('Eichentür zu: Blick nach Norden, Osten, Süden, Westen', FACINGS.map((f) => door('oak_door', f, 'left', false))),
    row('Eichentür offen, Scharnier links', FACINGS.map((f) => door('oak_door', f, 'left', true))),
    row('Eichentür offen, Scharnier rechts', FACINGS.map((f) => door('oak_door', f, 'right', true))),
    row('Alle Türen (Blick nach Süden)', [...WOODS.map((w) => `${w}_door`), 'iron_door', 'copper_door', 'exposed_copper_door', 'weathered_copper_door', 'oxidized_copper_door']
      .map((id) => door(id, 'south'))),
    row('Falltüren: unten, oben, offen N/O/S/W', [one('oak_trapdoor[half=bottom]'), one('oak_trapdoor[half=top]'), ...FACINGS.map((f) => one(`oak_trapdoor[facing=${f},open=true]`)),
      one('iron_trapdoor'), one('copper_trapdoor[half=top]'), one('spruce_trapdoor'), one('cherry_trapdoor[facing=south,open=true]')]),
    row('Leitern und Gerüst', [onWall('ladder[facing=south]', 'south'), onWall('ladder[facing=east]', 'east'), one('scaffolding'), one('iron_chain[axis=y]'), one('iron_chain[axis=x]')]),
  ],
  redstone: () => [
    row('Redstone-Staub: Linie (Stärke 15 … 11), Kreuz, Ecke, Punkt', [wire([[0, 0, 15], [1, 0, 14], [2, 0, 13], [3, 0, 12], [4, 0, 11]]),
      wire([[1, 0, 7], [0, 1, 7], [1, 1, 7], [2, 1, 7], [1, 2, 7]]), wire([[0, 0, 0], [1, 0, 0], [0, 1, 0]]), one('redstone_wire[power=9]'),
      item('Staub die Stufe hoch', [[0, 0, 0, 'redstone_wire[power=15]'], [1, 0, 0, 'stone'], [1, 1, 0, 'redstone_wire[power=14]']], true)]),
    row('Verstärker: Eingang N, O, S, W; Verzögerung 1 … 4; an; gesperrt', [...FACINGS.map((f) => one(`repeater[facing=${f}]`)),
      ...[1, 2, 3, 4].map((d) => one(`repeater[facing=south,delay=${d}]`)), one('repeater[facing=south,powered=true]'), one('repeater[facing=south,locked=true]')]),
    row('Komparatoren', [one('comparator[facing=south]'), one('comparator[facing=south,mode=subtract]'), one('comparator[facing=east,powered=true]'),
      one('comparator[facing=west,mode=subtract,powered=true]')]),
    row('Fackeln, Hebel, Knöpfe, Druckplatten', [one('redstone_torch'), one('redstone_torch[lit=false]'), onWall('redstone_wall_torch[facing=south]', 'south'),
      one('torch'), onWall('wall_torch[facing=east]', 'east'), one('soul_torch'), one('copper_torch'),
      one('lever[face=floor,facing=north]'), one('lever[face=floor,facing=east,powered=true]'), onWall('lever[face=wall,facing=south]', 'south'),
      underBlock('lever[face=ceiling,facing=north]', 'stone_bricks'), one('stone_button[face=floor,facing=north]'), onWall('oak_button[face=wall,facing=south]', 'south'),
      one('stone_pressure_plate'), one('heavy_weighted_pressure_plate'), one('oak_pressure_plate[powered=true]')]),
    row('Lampen und Bauteile', [one('redstone_lamp'), one('redstone_lamp[lit=true]'), one('redstone_block'), one('target'), one('note_block'), one('daylight_detector'),
      one('daylight_detector[inverted=true]'), one('copper_bulb[lit=true]'), one('oxidized_copper_bulb'), one('sculk_sensor'), one('calibrated_sculk_sensor[facing=south]'),
      one('tnt'), one('observer[facing=south,powered=true]'), one('redstone_ore[lit=true]')]),
    row('Kolben ausgefahren, Trichter', [extendedPiston('piston', 'east'), extendedPiston('sticky_piston', 'up'), extendedPiston('piston', 'south'),
      one('hopper[facing=down]'), one('hopper[facing=east]'), one('hopper[facing=north]')]),
    row('Schienen', [...['north_south', 'east_west', 'ascending_east', 'ascending_north', 'south_east', 'south_west', 'north_west', 'north_east'].map((s) => one(`rail[shape=${s}]`)),
      one('powered_rail[shape=north_south]'), one('powered_rail[shape=east_west,powered=true]'), one('detector_rail'), one('activator_rail[powered=true]')]),
    row('Stolperdraht', [item('Stolperdraht', [[0, 0, 0, 'tripwire_hook[facing=east,attached=true]'], [1, 0, 0, 'tripwire[attached=true,east=true,west=true]'],
      [2, 0, 0, 'tripwire[attached=true,east=true,west=true]'], [3, 0, 0, 'tripwire_hook[facing=west,attached=true]'], [-1, 0, 0, 'oak_planks'], [4, 0, 0, 'oak_planks']])]),
  ],
  special: () => [
    row('Glocken', [one('bell[attachment=floor,facing=north]'), one('bell[attachment=floor,facing=east]'), underBlock('bell[attachment=ceiling,facing=north]', 'oak_planks'),
      onWall('bell[attachment=single_wall,facing=south]', 'south'),
      item('bell double_wall', [[0, 0, 0, 'stone_bricks'], [1, 0, 0, 'bell[attachment=double_wall,facing=east]'], [2, 0, 0, 'stone_bricks']])]),
    row('Portale', [item('Endportal', [[1, 0, 0, 'end_portal_frame[facing=south,eye=true]'], [2, 0, 0, 'end_portal_frame[facing=south]'],
      [0, 0, 1, 'end_portal_frame[facing=east,eye=true]'], [3, 0, 1, 'end_portal_frame[facing=west]'], [1, 0, 1, 'end_portal'], [2, 0, 1, 'end_portal'],
      [1, 0, 2, 'end_portal_frame[facing=north,eye=true]'], [2, 0, 2, 'end_portal_frame[facing=north,eye=true]']]), one('end_gateway'),
    item('Netherportal', [[0, 0, 0, 'obsidian'], [1, 0, 0, 'obsidian'], [2, 0, 0, 'obsidian'], [0, 1, 0, 'obsidian'], [1, 1, 0, 'nether_portal[axis=x]'], [2, 1, 0, 'obsidian'],
      [0, 2, 0, 'obsidian'], [1, 2, 0, 'obsidian'], [2, 2, 0, 'obsidian']])]),
    row('Laternen, Ketten, Stäbe', [one('lantern'), underBlock('lantern[hanging=true]', 'stone_bricks'), one('soul_lantern'), one('copper_lantern'), one('oxidized_copper_lantern'),
      one('iron_chain[axis=y]'), one('iron_chain[axis=z]'), one('copper_chain[axis=x]'), one('end_rod'), one('end_rod[facing=east]'), one('lightning_rod'), one('weathered_lightning_rod[facing=north]')]),
    row('Kerzen, Kuchen, Lagerfeuer', [one('candle[candles=4,lit=true]'), one('white_candle[lit=true]'), one('red_candle[candles=3]'), one('cake'), one('cake[bites=3]'),
      one('candle_cake[lit=true]'), one('red_candle_cake'), one('campfire'), one('soul_campfire'), one('campfire[lit=false]')]),
    row('Blumentöpfe', ['flower_pot', 'potted_poppy', 'potted_cactus', 'potted_bamboo', 'potted_fern', 'potted_oak_sapling', 'potted_azalea_bush', 'potted_red_mushroom',
      'potted_wither_rose', 'potted_golden_dandelion'].map(one)),
    row('Besondere Blöcke', ['spawner', 'trial_spawner', 'vault', 'beacon', 'conduit', 'heavy_core', 'dragon_egg', 'turtle_egg[eggs=4]', 'sniffer_egg', 'enchanting_table',
      'brewing_stand[has_bottle_0=true]', 'composter[level=5]', 'respawn_anchor[charges=4]', 'lodestone', 'jukebox', 'crafting_table', 'smithing_table', 'fletching_table',
      'cartography_table', 'sculk_shrieker', 'sculk_catalyst', 'frogspawn'].map(one)),
    row('Kupfergolem-Statuen', [one('copper_golem_statue[facing=south]'), one('exposed_copper_golem_statue[facing=east,copper_golem_pose=sitting]'),
      one('weathered_copper_golem_statue[facing=south,copper_golem_pose=running]'), one('oxidized_copper_golem_statue[facing=south,copper_golem_pose=star]')]),
    row('Kristalle und Spitzen', [one('amethyst_cluster'), one('large_amethyst_bud'), one('medium_amethyst_bud'), one('small_amethyst_bud'), one('amethyst_cluster[facing=north]'),
      item('pointed_dripstone', [[0, 0, 0, 'pointed_dripstone[thickness=base]'], [0, 1, 0, 'pointed_dripstone[thickness=frustum]'], [0, 2, 0, 'pointed_dripstone[thickness=tip]']]),
      one('sulfur_spike'), one('chorus_flower'), one('chorus_plant[down=true,up=true]'), item('twisting_vines', [[0, 0, 0, 'twisting_vines_plant'], [0, 1, 0, 'twisting_vines']])]),
  ],
});

export const GALLERY_GROUP_NAMES = Object.freeze(Object.keys(GALLERY_GROUPS));

// Standardzustand eines Blocks; mehrteilige Blöcke bekommen ihren zweiten Teil, Wandblöcke eine Wand dahinter.
function defaultItem(id) {
  const props = defaultProps(id);
  const parts = [[0, 0, 0, formatState(id, props)]];
  if (props.half === 'lower') parts.push([0, 1, 0, formatState(id, { ...props, half: 'upper' })]);
  if (props.part === 'foot' && STEP[props.facing]) {
    const [dx, dz] = STEP[props.facing];
    parts.push([dx, 0, dz, formatState(id, { ...props, part: 'head' })]);
  }
  if ((WALL_MOUNTED.test(id) || props.face === 'wall') && STEP[props.facing]) {
    const [dx, dz] = STEP[props.facing];
    parts.push([-dx, 0, -dz, 'stone_bricks']);
  }
  return item(id, parts);
}

const NOT_PLACEABLE = new Set(['air', 'cave_air', 'void_air']);

export function galleryBlockIds() {
  return allBlockIds().filter((id) => !NOT_PLACEABLE.has(id)).sort();
}

export function galleryPageCount(group) {
  if (group !== 'all') return 1;
  return Math.ceil(galleryBlockIds().length / GALLERY_PAGE_SIZE);
}

// Lange Reihen umbrechen, damit die Galerie kompakt bleibt (im Bild größer)
function wrapRows(rows, width) {
  return rows.flatMap(({ title, items }) => {
    if (items.length <= width) return [{ title, items }];
    const parts = [];
    for (let i = 0; i < items.length; i += width) parts.push({ title: `${title} (${i / width + 1})`, items: items.slice(i, i + width) });
    return parts;
  });
}

function galleryRows(group, page) {
  if (group !== 'all') return wrapRows(GALLERY_GROUPS[group](), GALLERY_ROW_ITEMS);
  const ids = galleryBlockIds().slice(page * GALLERY_PAGE_SIZE, (page + 1) * GALLERY_PAGE_SIZE);
  const rows = [];
  for (let i = 0; i < ids.length; i += GALLERY_COLUMNS) {
    const slice = ids.slice(i, i + GALLERY_COLUMNS);
    rows.push(row(`${slice[0]} … ${slice[slice.length - 1]}`, slice.map(defaultItem)));
  }
  return rows;
}

/**
 * Galerie zur Sichtprüfung: group 'all' (alle Blöcke im Standardzustand, Seiten zu je 100) oder eine
 * Zustandsreihe (stairs, orientation, fences, glass, plants, fluids, chests, beds, signs, doors, redstone,
 * special). Jede Zeile ist ein Schritt. result.gallery = { group, page, pages, items: [{ label, row, x, y, z }]
 * (Position des ersten Teils), rows: [{ title, min, max }] (Blockgrenzen je Reihe, inklusiv) }.
 */
export function buildGallery(group = 'all', page = 0) {
  if (!Object.hasOwn(GALLERY_GROUPS, group)) throw new EngineError(`Unbekannte Galerie „${group}“.`, { code: 'source' });
  const pages = galleryPageCount(group);
  if (page >= pages) throw new EngineError(`Die Galerie „${group}“ hat nur ${pages} Seite(n).`, { code: 'source' });
  const b = new Builder({ seed: `gallery-${group}` });
  b.phase(`Galerie: ${group}`);
  const warnings = [];
  const items = [];
  const rows = [];
  let z = 0;
  for (const { title, items: rowItems } of galleryRows(group, page)) {
    // Ein Schritt je Reihe; den Namen der Reihe trägt result.gallery.rows
    b.step();
    let x = 0;
    let depth = 1;
    const rowBox = { title, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const entry of rowItems) {
      const xs = entry.parts.map((p) => p[0]), zs = entry.parts.map((p) => p[2]), ys = entry.parts.map((p) => p[1]);
      const minX = Math.min(...xs), minZ = Math.min(...zs), minY = Math.min(...ys);
      const ox = x - minX, oz = z - minZ, oy = -minY;
      try {
        for (const [dx, dy, dz, state] of entry.parts) b.set(ox + dx, oy + dy, oz + dz, state, { raw: !entry.connect });
        items.push({ label: entry.label, row: rows.length, x: ox + entry.parts[0][0], y: oy + entry.parts[0][1], z: oz + entry.parts[0][2] });
        for (const [dx, dy, dz] of entry.parts) {
          const p = [ox + dx, oy + dy, oz + dz];
          for (let a = 0; a < 3; a++) {
            rowBox.min[a] = Math.min(rowBox.min[a], p[a]);
            rowBox.max[a] = Math.max(rowBox.max[a], p[a]);
          }
        }
      } catch (error) {
        warnings.push(`Galerie „${entry.label}“: ${error.message}`);
      }
      x += Math.max(...xs) - minX + 2;
      depth = Math.max(depth, Math.max(...zs) - minZ + 1);
    }
    if (rowBox.min[0] !== Infinity) rows.push(rowBox);
    z += depth + 2;
  }
  const result = b.finalize();
  result.warnings.push(...warnings);
  // finalize verschiebt den Bau so, dass die kleinste Ecke bei (0, 0, 0) liegt
  const [dx, dy, dz] = result.offset;
  for (const entry of items) {
    entry.x -= dx;
    entry.y -= dy;
    entry.z -= dz;
  }
  for (const rowBox of rows) {
    rowBox.min = [rowBox.min[0] - dx, rowBox.min[1] - dy, rowBox.min[2] - dz];
    rowBox.max = [rowBox.max[0] - dx, rowBox.max[1] - dy, rowBox.max[2] - dz];
  }
  result.gallery = { group, page, pages, items, rows };
  return result;
}

// ------------------------------------------------------------------ Kollision, Umriss, Picking je Palette

const FULL_BOX = Object.freeze([0, 0, 0, 1, 1, 1]);
const NO_COLLISION_IDS = new Set(['torch', 'lever', 'tripwire', 'tripwire_hook', 'redstone_wire', 'rail', 'nether_portal', 'end_portal', 'end_gateway',
  'fire', 'soul_fire', 'light', 'structure_void', 'cobweb', 'powder_snow', 'moving_piston', 'sweet_berry_bush', 'frogspawn']);
const NO_COLLISION_SUFFIX = /(_sign|_banner|_button|_pressure_plate|_torch|_rail|_sapling|_coral|_coral_fan)$/;
const MIN_THICKNESS = 1 / 32;

function hasNoCollision(id, props) {
  return NO_COLLISION_IDS.has(id) || NO_COLLISION_SUFFIX.test(id) || (isFenceGate(id) && props.open === 'true');
}

function quadBounds(quads) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const q of quads) {
    for (let v = 0; v < 4; v++) {
      for (let a = 0; a < 3; a++) {
        const value = q.pos[v * 3 + a];
        if (value < box[a]) box[a] = value;
        if (value > box[3 + a]) box[3 + a] = value;
      }
    }
  }
  return box[0] <= box[3] ? box : null;
}

const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const cellOf = (value) => clamp(Math.round(value * 16), 0, 16);

// Säulen-Verfahren: je 1/16-Säule die oberste Oberseite und die unterste Unterseite der nicht gedrehten
// waagrechten Flächen → Boxen (gleiche Säulen zu Rechtecken zusammengelegt). Treppen, Stufen, Türen, Betten …
function columnBoxes(quads, maxHeight) {
  const top = new Float64Array(256).fill(-Infinity);
  const bottom = new Float64Array(256).fill(Infinity);
  for (const q of quads) {
    if (q.rotated || (q.dirIndex !== 0 && q.dirIndex !== 1) || Math.abs(q.normal[1]) < 0.999) continue;
    const p = q.pos;
    const y = p[1];
    const i0 = cellOf(Math.min(p[0], p[3], p[6], p[9])), i1 = cellOf(Math.max(p[0], p[3], p[6], p[9]));
    const j0 = cellOf(Math.min(p[2], p[5], p[8], p[11])), j1 = cellOf(Math.max(p[2], p[5], p[8], p[11]));
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const c = j * 16 + i;
        if (q.dirIndex === 1) top[c] = Math.max(top[c], y);
        else bottom[c] = Math.min(bottom[c], y);
      }
    }
  }
  const lo = new Float64Array(256);
  const hi = new Float64Array(256);
  const filled = new Uint8Array(256);
  for (let c = 0; c < 256; c++) {
    if (top[c] === -Infinity && bottom[c] === Infinity) continue;
    // Nur Unterseite (z. B. untere Türhälfte): reicht bis oben; nur Oberseite: ab dem Boden
    const t = top[c] === -Infinity ? 1 : top[c];
    const l = clamp(bottom[c] < t ? bottom[c] : 0, 0, 1);
    const h = clamp(t, 0, 1);
    if (h - l < MIN_THICKNESS) continue;
    lo[c] = l;
    hi[c] = maxHeight > 1 ? maxHeight : h;
    filled[c] = 1;
  }
  const same = (a, b) => filled[b] && lo[a] === lo[b] && hi[a] === hi[b];
  const boxes = [];
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      const c = j * 16 + i;
      if (!filled[c]) continue;
      let w = 1;
      while (i + w < 16 && same(c, c + w)) w++;
      let h = 1;
      grow: while (j + h < 16) {
        for (let k = 0; k < w; k++) if (!same(c, c + h * 16 + k)) break grow;
        h++;
      }
      for (let r = 0; r < h; r++) for (let k = 0; k < w; k++) filled[c + r * 16 + k] = 0;
      boxes.push([i / 16, lo[c], j / 16, (i + w) / 16, hi[c], (j + h) / 16]);
    }
  }
  return boxes.length ? boxes : null;
}

/**
 * Kollisionsboxen eines Zustands für das Laufen (blocklokal [x1, y1, z1, x2, y2, z2], y bis 1,5) oder null.
 * Abgeleitet aus den Modellflächen; Zäune, Mauern und geschlossene Zauntore 1,5 hoch wie im Spiel; Pflanzen,
 * Fackeln, Schilder, Banner, Knöpfe, Druckplatten, Schienen, Flüssigkeiten ohne Kollision.
 */
export function collisionBoxes(models, state) {
  const info = models.renderInfo(state);
  if (hasNoCollision(info.id, info.props)) return null;
  if (info.invisible) return info.id === 'barrier' ? [[...FULL_BOX]] : null;
  if (info.opaqueFull) return [[...FULL_BOX]];
  const quads = info.quadsAt(0, 0, 0);
  if (info.kind !== null && info.kind !== 'bell') {
    const box = quadBounds(quads);
    if (!box) return null;
    const clamped = [clamp(box[0], 0, 1), clamp(box[1], 0, 1), clamp(box[2], 0, 1), clamp(box[3], 0, 1), clamp(box[4], 0, 1), clamp(box[5], 0, 1)];
    return clamped[4] - clamped[1] >= MIN_THICKNESS ? [clamped] : null;
  }
  const tall = isFence(info.id) || isWall(info.id) || isFenceGate(info.id);
  return columnBoxes(quads, tall ? 1.5 : 1);
}

/**
 * Je Paletten-Eintrag: collision (Boxen oder null), outline (Float32Array, 6 Werte je Eintrag: Umriss für
 * den Zeiger) und pickable (1 = per Zeiger auswählbar; unsichtbare Blöcke wie Luft/Licht/Barriere nicht).
 */
export function paletteInfo(models, palette) {
  const collision = new Array(palette.length).fill(null);
  const outline = new Float32Array(palette.length * 6);
  const pickable = new Uint8Array(palette.length);
  for (let i = 1; i < palette.length; i++) {
    const info = models.renderInfo(palette[i]);
    collision[i] = collisionBoxes(models, palette[i]);
    const bounds = info.invisible ? null : quadBounds(info.quadsAt(0, 0, 0));
    const box = bounds ? bounds.map((v) => clamp(v, -1, 2)) : [...FULL_BOX];
    outline.set(box, i * 6);
    pickable[i] = !info.invisible || info.fluid !== null ? 1 : 0;
  }
  return { collision, outline, pickable };
}

// ------------------------------------------------------------------ Engine

export function meshTransferList(mesh) {
  const list = [];
  for (const layer of [mesh.solid, mesh.cutout, mesh.translucent]) {
    if (layer.vertices.byteLength > 0) list.push(layer.vertices);
    if (layer.centers && layer.centers.byteLength > 0) list.push(layer.centers.buffer);
  }
  return list;
}

function minStepOf(chunk) {
  let min = 65535;
  for (let i = 0; i < 4096; i++) if (chunk.blocks[i] !== 0 && chunk.steps[i] < min) min = chunk.steps[i];
  return min;
}

/** Rechenkern des Workers: hält Modelle, das aktuelle Volumen und meshet es. */
export class Engine {
  #modelsJson;
  #blocksJson;
  #models;
  #result = null;
  #bound = false;

  constructor({ modelsJson, blocksJson }) {
    setBlockData(blocksJson);
    this.#modelsJson = modelsJson;
    this.#blocksJson = blocksJson;
    this.#models = new BlockModels(modelsJson, blocksJson);
  }

  get models() { return this.#models; }
  get result() { return this.#result; }
  get volume() { return this.#result?.volume ?? null; }
  get isBound() { return this.#bound; }

  /**
   * Baut eine Quelle (geprüft mit checkSource). loaders: { importModule(path) → Namensraum,
   * importShapes() → Namensraum von js/create/shape-generators.js,
   * importUploader() → Namensraum von js/create/import/index.js, loadCommunityFile(file) → ArrayBuffer,
   * progress(message), loadBlockColors(), importVoxelizer() }.
   * Verändert die Engine nicht – das Ergebnis erst mit use(result) übernehmen.
   */
  async build(source, params, loaders) {
    const clean = checkSource(source);
    let result;
    if (clean.kind === 'module') {
      result = buildModule(await loaders.importModule(clean.path), checkParams(params), clean.path);
    } else if (clean.kind === 'shape') {
      result = buildShapeResult(await loaders.importShapes(), clean.shape, clean.params);
    } else if (clean.kind === 'upload') {
      result = await buildUploadResult(await loaders.importUploader(), clean, loaders);
    } else if (clean.kind === 'community') {
      result = await buildCommunityResult(clean, loaders);
    } else if (clean.kind === 'gallery') {
      result = buildGallery(clean.group, clean.page);
    } else {
      result = buildSynthetic(clean.count);
    }
    // Upload: die Datei nicht mit dem Ergebnis zurückschicken
    result.source = clean.kind === 'upload' ? { kind: 'upload', format: clean.format, name: clean.name, bytes: clean.data.byteLength, params: clean.params } : clean;
    return result;
  }

  // Ergebnis übernehmen; frische Blockmodelle, damit models.warnings nur zu diesem Bau gehören
  use(result) {
    this.#result = result;
    this.#bound = false;
    this.#models = new BlockModels(this.#modelsJson, this.#blocksJson);
  }

  textureNames() {
    return [...this.#models.textureNames(this.volume.palette.slice(1))];
  }

  // Texturen binden (Map aus TextureStore.prepare) → Paletten-Infos für Kollision und Picking.
  bind(map) {
    this.#models.bindTextures(map);
    this.#bound = true;
    return paletteInfo(this.#models, this.volume.palette);
  }

  // Chunks von unten nach oben, je Ebene von der Mitte nach außen (der Bau wächst beim Laden sichtbar).
  chunkOrder() {
    const volume = this.volume;
    const bounds = volume.bounds;
    if (!bounds) return [];
    const mx = (bounds.min[0] + bounds.max[0]) / 32, mz = (bounds.min[2] + bounds.max[2]) / 32;
    return volume.chunkList().map((c) => ({ cx: c.cx, cy: c.cy, cz: c.cz, d: (c.cx + 0.5 - mx) ** 2 + (c.cz + 0.5 - mz) ** 2 }))
      .sort((a, b) => a.cy - b.cy || a.d - b.d || a.cx - b.cx || a.cz - b.cz)
      .map(({ cx, cy, cz }) => ({ cx, cy, cz }));
  }

  meshChunk(cx, cy, cz) {
    const volume = this.volume;
    const mesh = meshChunk({ volume, models: this.#models, ao: true }, cx, cy, cz);
    const chunk = volume.chunks.get(((cx + 1024) * 2048 + (cy + 1024)) * 2048 + (cz + 1024));
    return { cx, cy, cz, minStep: chunk ? minStepOf(chunk) : 65535, ...mesh };
  }

  meshStep(step) {
    return meshStep({ volume: this.volume, models: this.#models, ao: true }, step);
  }

  meshCap(y) {
    return meshCap({ volume: this.volume, models: this.#models, ao: true }, y);
  }
}

/** BuildResult → Nachricht für den Hauptthread (Volumen als übertragbare Kopie). */
export function serializeResult(result) {
  const transfer = result.volume.toTransfer();
  const { volume, ...rest } = result;
  return { result: rest, volume: transfer, transferList: BlockVolume.transferList(transfer) };
}

// ------------------------------------------------------------------ Worker-Anbindung

function userMessage(error) {
  if (error instanceof EngineError) return error.message;
  return 'Bei der 3D-Berechnung ist ein unerwarteter Fehler aufgetreten. Details stehen in der Konsole.';
}

function startWorker(scope) {
  const rootUrl = new URL('../../', import.meta.url);
  let enginePromise = null;
  let engine = null;
  let currentJob = 0;
  // Auftrag, dessen Spieldaten gerade laden (Fortschritt als Phase „data“), sonst 0
  let dataJob = 0;
  let meshRun = 0;
  let boundGate = null;
  let blockColorsPromise = null;

  const post = (message, transfer = []) => scope.postMessage(message, transfer);
  const status = (job, phase, message, progress = null) => post({ type: 'status', job, phase, message, progress });

  const channel = new MessageChannel();
  const waiting = [];
  channel.port1.onmessage = () => waiting.shift()?.();
  const yieldTask = () => new Promise((resolve) => {
    waiting.push(resolve);
    channel.port2.postMessage(0);
  });

  // Erster Besuch online: Fortschritt der Spieldaten (js/data/game-data.js) an die Seite melden. Beim Laden der Daten
  // als Phase „data“ mit Anteil, später (Blockfarben beim Modell-Import) nur als Text des Bauens.
  onGameDataProgress((event) => {
    if (dataJob !== 0 && dataJob === currentJob) status(dataJob, 'data', event.text, event.share);
    else if (currentJob !== 0) status(currentJob, 'build', event.text);
  });

  function getEngine() {
    if (!enginePromise) {
      enginePromise = Promise.all([loadGameModels(), loadGameBlocks()])
        .catch((error) => { throw dataEngineError(error); })
        .then(([modelsJson, blocksJson]) => new Engine({ modelsJson, blocksJson }));
      enginePromise.catch(() => { enginePromise = null; });
    }
    return enginePromise;
  }

  const loaders = {
    async importModule(path) {
      try {
        return await import(new URL(path, rootUrl).href);
      } catch (error) {
        throw new EngineError(`Das Bau-Modul „${path}“ konnte nicht geladen werden.`, { code: 'build', detail: error?.stack ?? String(error) });
      }
    },
    async importShapes() {
      try {
        return await import(new URL('js/create/shape-generators.js', rootUrl).href);
      } catch (error) {
        throw new EngineError('Der Formen-Generator ist noch nicht verfügbar.', { code: 'source', detail: error?.message ?? String(error) });
      }
    },
    async importUploader() {
      try {
        return await import(new URL('js/create/import/index.js', rootUrl).href);
      } catch (error) {
        throw new EngineError('Der Datei-Import ist noch nicht verfügbar.', { code: 'source', detail: error?.stack ?? String(error) });
      }
    },
    async importVoxelizer() {
      try {
        return await import(new URL('js/create/voxelize/index.js', rootUrl).href);
      } catch (error) {
        throw new EngineError('Der Import von 3D-Modellen (.vox, .stl, .obj, .glb, .gltf) ist noch nicht verfügbar.', { code: 'upload', detail: error?.stack ?? String(error) });
      }
    },
    // Community-Bau: Datei aus data/community/ (gleicher Ursprung)
    loadCommunityFile(file) {
      return fetchCommunityFile(file, { rootUrl });
    },
    // Blockfarben für den Modell-Import: einmal laden, danach aus dem Speicher
    loadBlockColors() {
      if (!blockColorsPromise) {
        blockColorsPromise = loadGameBlockColors().catch((error) => { throw dataEngineError(error); });
        blockColorsPromise.catch(() => { blockColorsPromise = null; });
      }
      return blockColorsPromise;
    },
  };

  function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  }

  async function onLoad({ job, source, params, crop = null }) {
    currentJob = job;
    meshRun++;
    boundGate = { job, ...deferred() };
    // Schnitt (z. B. Vorschaubild ohne Decke): nur Blöcke innerhalb zeigen
    const cleanCrop = crop === null ? null : checkCrop(crop);
    dataJob = job;
    status(job, 'data', 'Lade Spieldaten …');
    let loaded;
    try {
      loaded = await getEngine();
    } finally {
      if (dataJob === job) dataJob = 0;
    }
    if (job !== currentJob) return;
    status(job, 'build', 'Baue …');
    const started = performance.now();
    // Fortschrittsmeldungen (Datei-Import) nur für den laufenden Auftrag
    const progress = (message) => {
      if (job === currentJob) status(job, 'build', String(message).slice(0, 200));
    };
    const jobLoaders = { ...loaders, progress };
    const result = await loaded.build(source, params, jobLoaders);
    if (job !== currentJob) return;
    if (cleanCrop) cropVolume(result.volume, cleanCrop);
    engine = loaded;
    engine.use(result);
    const buildMs = performance.now() - started;
    const { result: plain, volume, transferList } = serializeResult(result);
    post({ type: 'built', job, result: plain, volume, textureNames: engine.textureNames(), buildMs }, transferList);
  }

  async function meshAll(job) {
    const run = ++meshRun;
    const order = engine.chunkOrder();
    const started = performance.now();
    let slice = started;
    let batch = [];
    let transfer = [];
    let quads = 0;
    for (let i = 0; i < order.length; i++) {
      if (run !== meshRun || job !== currentJob) return;
      const { cx, cy, cz } = order[i];
      const mesh = engine.meshChunk(cx, cy, cz);
      quads += mesh.solid.quadCount + mesh.cutout.quadCount + mesh.translucent.quadCount;
      batch.push(mesh);
      transfer.push(...meshTransferList(mesh));
      if (performance.now() - slice > 12 || i === order.length - 1) {
        post({ type: 'chunks', job, chunks: batch, done: i + 1, total: order.length }, transfer);
        batch = [];
        transfer = [];
        await yieldTask();
        slice = performance.now();
      }
    }
    if (run !== meshRun || job !== currentJob) return;
    post({ type: 'meshed', job, chunks: order.length, quads, meshMs: performance.now() - started, warnings: engine.models.warnings });
  }

  async function onTextures({ job, map }) {
    if (job !== currentJob || !engine) return;
    if (!(map instanceof Map)) throw new EngineError('Textur-Zuordnung fehlt.', { code: 'textures' });
    const info = engine.bind(map);
    post({ type: 'palette', job, ...info });
    if (boundGate && boundGate.job === job) boundGate.resolve();
    await meshAll(job);
  }

  async function whenBound(job) {
    if (!boundGate || boundGate.job !== job) return false;
    await boundGate.promise;
    return job === currentJob;
  }

  async function onStep({ job, step }) {
    if (job !== currentJob || !Number.isInteger(step)) return;
    if (!(await whenBound(job))) return;
    const mesh = engine.meshStep(step);
    post({ type: 'step', job, step, mesh }, meshTransferList(mesh));
  }

  async function onCap({ job, y }) {
    if (job !== currentJob || !Number.isInteger(y)) return;
    if (!(await whenBound(job))) return;
    const mesh = engine.meshCap(y);
    post({ type: 'cap', job, y, mesh }, meshTransferList(mesh));
  }

  async function onRemesh({ job }) {
    if (job !== currentJob || !(await whenBound(job))) return;
    await meshAll(job);
  }

  const handlers = { load: onLoad, textures: onTextures, step: onStep, cap: onCap, remesh: onRemesh };

  scope.addEventListener('message', (event) => {
    const message = event.data;
    const handler = message && typeof message === 'object' && Number.isInteger(message.job) && Object.hasOwn(handlers, message.type)
      ? handlers[message.type] : null;
    if (!handler) {
      console.warn('3D-Worker: unbekannte Nachricht ignoriert.', message?.type);
      return;
    }
    handler(message).catch((error) => {
      if (error instanceof EngineError) console.warn(`3D-Worker: ${error.message}`, error.detail ?? '');
      else console.error('3D-Worker:', error);
      post({
        type: 'error', job: message.job, request: message.type, step: message.step ?? null, y: message.y ?? null,
        code: error?.code ?? 'internal', message: userMessage(error), detail: error?.detail ?? error?.stack ?? String(error),
        title: error instanceof EngineError ? error.title : null,
      });
    });
  });
}

const isWorker = typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope;
if (isWorker) startWorker(globalThis);
