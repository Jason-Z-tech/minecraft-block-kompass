// Spieldaten aus der installierten Minecraft Java 26.2 nach game-data/ (gitignored) extrahieren.
// Liest nur: die Client-Jar, den Asset-Index mit de_de.json und einmalig den Blockbericht von
// misode/mcmeta (Cache in game-data/.cache/). Schreibt nie in .minecraft/curseforge, startet nichts.
// Aufruf: node scripts/extract-game-data.mjs [--jar <pfad>] [--assets <ordner>] [--offline] [--out <ordner>]
// Ohne Installation (Cloud): node scripts/extract-game-data.mjs --remote – gleiche Daten aus öffentlichen Quellen
// (scripts/lib/remote-source.mjs).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openZip } from './lib/zip.mjs';
import { readNbt } from './lib/nbt.mjs';
import { buildBlockColors, OUTPUT_FILE as BLOCK_COLORS_FILE } from './build-block-colors.mjs';
import { spawnSync } from 'node:child_process';
import { RemoteSourceError, blockedDomainMessage, createDownloader, loadRemoteSources, proxyRelaunchPlan, REMOTE_DOMAINS } from './lib/remote-source.mjs';

export const MC_VERSION = '26.2';
const DEFAULT_ASSET_INDEX = '32';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT_DIR = path.join(ROOT, 'game-data');
const CACHE_DIR = path.join(OUTPUT_DIR, '.cache');

export const MCMETA_TAG = `${MC_VERSION}-summary`;
const MCMETA_BASE_URL = `https://raw.githubusercontent.com/misode/mcmeta/${MCMETA_TAG}/`;
const MCMETA_FILES = { version: 'version.json', blocks: 'blocks/data.min.json' };
const DOWNLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_MAX_BYTES = 16 * 1024 * 1024;

const ASSET_ROOT = 'assets/minecraft/';
const BLOCKSTATE_PREFIX = `${ASSET_ROOT}blockstates/`;
const MODEL_PREFIX = `${ASSET_ROOT}models/`;
const TEXTURE_PREFIX = `${ASSET_ROOT}textures/`;
const STRUCTURE_PREFIX = 'data/minecraft/structure/';
const LANG_EN_ENTRY = `${ASSET_ROOT}lang/en_us.json`;
const LANG_DE_OBJECT = 'minecraft/lang/de_de.json';

const ID_PATTERN = /^[a-z0-9_]+$/;
const RESOURCE_PATH_PATTERN = /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/;
export const DIRECTIONS = ['down', 'up', 'north', 'south', 'west', 'east'];
const QUADRANTS = [0, 90, 180, 270];
const AXES = ['x', 'y', 'z'];
// Eingebaute Spieltextur ohne Datei (lila-schwarzes Schachbrett).
const BUILTIN_MISSING_TEXTURE = 'missingno';
// Fallen in Strukturen weg (Luftarten, Platzhalter, Datenblöcke).
const REMOVED_STRUCTURE_BLOCKS = new Set(['air', 'cave_air', 'void_air', 'structure_void', 'structure_block']);
const MAX_STRUCTURE_VOLUME = 8_000_000;

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

const USAGE = [
  'Aufruf: node scripts/extract-game-data.mjs [--jar <pfad>] [--assets <ordner>] [--offline] [--out <ordner>]',
  '        node scripts/extract-game-data.mjs --remote [--offline] [--out <ordner>]',
  `  --jar <pfad>       Minecraft-Jar (Standard: %APPDATA%\\.minecraft\\versions\\${MC_VERSION}\\${MC_VERSION}.jar)`,
  '  --assets <ordner>  Assets-Ordner mit indexes\\ und objects\\ (Standard: CurseForge, sonst .minecraft)',
  '  --offline          nichts herunterladen (Blockbericht nur aus game-data\\.cache, sonst abgeleitet;',
  '                     mit --remote alles nur aus dem Cache)',
  '  --remote           ohne Minecraft-Installation: Dateien von misode/mcmeta (GitHub) und Mojang laden',
  `                     (Domains: ${REMOTE_DOMAINS.map((domain) => domain.host).join(', ')})`,
  '  --out <ordner>     Zielordner statt game-data (Cache dann in <ordner>/.cache)',
].join('\n');

// Erwartete Probleme (fehlende Dateien, falsche Version …): Meldung ohne Stacktrace.
export class UserError extends Error {}

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

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value);

// Wörterbuch ohne Prototyp: Schlüssel aus fremden Daten („__proto__“, „constructor“) sind dann harmlos.
const dict = () => Object.create(null);

function isFile(filePath) {
  return fs.statSync(filePath, { throwIfNoEntry: false })?.isFile() === true;
}

function parseJsonText(text, label) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return JSON.parse(clean);
  } catch (error) {
    throw new Error(`${label}: ungültiges JSON (${error.message})`);
  }
}

const round6 = (value) => Math.round(value * 1e6) / 1e6 + 0;

function formatNumber(value) {
  return value.toLocaleString('de-CH');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('de-CH', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('de-CH', { maximumFractionDigits: 1 })} MB`;
}

// Jar als „Assets“-Quelle; Tests können ein gleich gebautes Objekt mit Daten im Speicher übergeben.
export function createJarAssets(zip) {
  return {
    has: (name) => zip.entries.has(name),
    list: (prefix) => zip.list(prefix),
    read: (name) => zip.read(name),
    readJson: (name) => parseJsonText(zip.read(name).toString('utf8'), name),
  };
}

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
// Kommandozeile und Quellen

const ARG_ERROR_TEXT = {
  ERR_PARSE_ARGS_UNKNOWN_OPTION: 'Unbekannte Option',
  ERR_PARSE_ARGS_INVALID_OPTION_VALUE: 'Option braucht einen Wert',
  ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL: 'Unerwartetes Argument',
};

export function parseCliArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        jar: { type: 'string' },
        assets: { type: 'string' },
        offline: { type: 'boolean', default: false },
        remote: { type: 'boolean', default: false },
        out: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    const reason = ARG_ERROR_TEXT[error.code] ?? 'Ungültige Argumente';
    const token = /'([^']+)'/.exec(error.message)?.[1];
    throw new UserError(`${reason}${token ? ` „${token}“` : ''}.\n${USAGE}`);
  }
  for (const key of ['jar', 'assets', 'out']) {
    if (values[key] !== undefined && values[key].trim() === '') throw new UserError(`--${key} braucht einen Pfad.\n${USAGE}`);
  }
  if (values.remote && (values.jar !== undefined || values.assets !== undefined)) {
    throw new UserError(`--remote lädt alles aus dem Netz und verträgt sich nicht mit --jar oder --assets.\n${USAGE}`);
  }
  const options = { jar: values.jar, assets: values.assets, offline: values.offline, help: values.help };
  // remote/out nur, wenn gesetzt: so bleibt das Ergebnis ohne diese Optionen genau wie bisher.
  if (values.remote) options.remote = true;
  if (values.out !== undefined) options.out = values.out;
  return options;
}

export function defaultSourcePaths(env = process.env, home = os.homedir()) {
  const appData = env.APPDATA ? env.APPDATA : path.join(home, 'AppData', 'Roaming');
  const minecraftDir = path.join(appData, '.minecraft');
  return {
    jar: path.join(minecraftDir, 'versions', MC_VERSION, `${MC_VERSION}.jar`),
    assetDirs: [path.join(home, 'curseforge', 'minecraft', 'Install', 'assets'), path.join(minecraftDir, 'assets')],
  };
}

// Asset-Index-ID aus der Versionsdatei neben der Jar (26.2.json), sonst der bekannte Wert für 26.2.
function readAssetIndexId(jarPath, warnings) {
  const versionFile = jarPath.replace(/\.jar$/i, '.json');
  if (versionFile === jarPath || !isFile(versionFile)) return DEFAULT_ASSET_INDEX;
  try {
    const id = parseJsonText(fs.readFileSync(versionFile, 'utf8'), versionFile)?.assetIndex?.id;
    if (typeof id === 'string' && /^[0-9A-Za-z._-]{1,40}$/.test(id)) return id;
    warnings.add(`${path.basename(versionFile)} nennt keinen gültigen Asset-Index – verwende ${DEFAULT_ASSET_INDEX}.`);
  } catch (error) {
    warnings.add(`${path.basename(versionFile)} nicht lesbar (${error.message}) – verwende Asset-Index ${DEFAULT_ASSET_INDEX}.`);
  }
  return DEFAULT_ASSET_INDEX;
}

function resolveSources(options, warnings) {
  const defaults = defaultSourcePaths();
  const jarPath = path.resolve(options.jar ?? defaults.jar);
  if (!isFile(jarPath)) {
    throw new UserError(`Minecraft-Jar nicht gefunden: ${jarPath}\n→ Installiere Minecraft Java ${MC_VERSION} im Launcher oder gib den Pfad an: --jar <pfad>\n→ Ohne Minecraft-Installation (z. B. in der Cloud): node scripts/extract-game-data.mjs --remote`);
  }
  const assetIndex = readAssetIndexId(jarPath, warnings);
  const assetDirs = options.assets ? [path.resolve(options.assets)] : defaults.assetDirs;
  const assetsDir = assetDirs.find((dir) => isFile(path.join(dir, 'indexes', `${assetIndex}.json`)));
  if (!assetsDir) {
    throw new UserError(`Asset-Index ${assetIndex}.json nicht gefunden. Gesucht in:\n  ${assetDirs.join('\n  ')}\n→ Gib den Assets-Ordner (mit den Unterordnern indexes und objects) an: --assets <ordner>`);
  }
  return { jarPath, assetsDir, assetIndex };
}

function openJar(jarPath) {
  try {
    return openZip(jarPath);
  } catch (error) {
    throw new UserError(`Die Jar lässt sich nicht lesen – ${error.message}\n→ Prüfe den Pfad (--jar) oder lass den Launcher die Version ${MC_VERSION} neu herunterladen.`);
  }
}

function readJarVersion(assets) {
  if (!assets.has('version.json')) throw new UserError('In der Jar fehlt version.json – ist das die Minecraft-Client-Jar?');
  const info = assets.readJson('version.json');
  if (info.id !== MC_VERSION) throw new UserError(`Die Jar ist Minecraft ${info.id}, gebraucht wird genau ${MC_VERSION}.`);
  if (!Number.isInteger(info.world_version)) throw new UserError('version.json der Jar enthält keine world_version.');
  return {
    id: info.id,
    worldVersion: info.world_version,
    resourcePack: info.pack_version?.resource_major ?? null,
    dataPack: info.pack_version?.data_major ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Namen (names.json)

function readGermanLang(assetsDir, assetIndex) {
  const indexPath = path.join(assetsDir, 'indexes', `${assetIndex}.json`);
  const index = parseJsonText(fs.readFileSync(indexPath, 'utf8'), indexPath);
  const object = index?.objects?.[LANG_DE_OBJECT];
  if (!object || typeof object.hash !== 'string' || !/^[0-9a-f]{40}$/.test(object.hash)) {
    throw new UserError(`Asset-Index ${assetIndex}.json enthält keine deutsche Sprachdatei (${LANG_DE_OBJECT}).`);
  }
  const objectPath = path.join(assetsDir, 'objects', object.hash.slice(0, 2), object.hash);
  if (!isFile(objectPath)) {
    throw new UserError(`Deutsche Sprachdatei fehlt: ${objectPath}\n→ Der Launcher lädt sie mit den Assets herunter; sonst den richtigen Ordner mit --assets angeben.`);
  }
  const data = fs.readFileSync(objectPath);
  const hash = crypto.createHash('sha1').update(data).digest('hex');
  if (hash !== object.hash) throw new UserError(`Deutsche Sprachdatei ist beschädigt (Prüfsumme stimmt nicht): ${objectPath}`);
  return parseJsonText(data.toString('utf8'), 'de_de.json');
}

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

// readGerman: liefert de_de.json (aus dem Asset-Ordner oder, mit --remote, aus dem Download).
function extractNames(assets, readGerman, warnings) {
  const en = assets.readJson(LANG_EN_ENTRY);
  const de = readGerman();
  const names = buildNames(en, de);
  const missingGerman = [...Object.values(names.block), ...Object.values(names.item)].filter((entry) => entry.de === null).length;
  if (missingGerman > 0) warnings.add(`${missingGerman} Namen ohne deutsche Übersetzung (dort steht nur „en“).`);
  return names;
}

// ---------------------------------------------------------------------------------------------
// Blockstates und Blockeigenschaften (blocks.json)

function loadBlockstates(assets, warnings) {
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

async function downloadText(url, maxBytes) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), headers: { accept: 'application/json' } });
  } catch (error) {
    throw new Error(`Download von ${url} fehlgeschlagen (${error.cause?.code ?? error.name})`);
  }
  if (!response.ok) throw new Error(`Download von ${url} fehlgeschlagen (HTTP ${response.status})`);
  if (!response.url.startsWith('https://raw.githubusercontent.com/')) throw new Error(`unerwartete Weiterleitung nach ${response.url}`);
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error(`Antwort größer als ${formatBytes(maxBytes)}`);
      chunks.push(chunk);
    }
  } catch (error) {
    throw new Error(`Download von ${url} abgebrochen (${error.message})`);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseMcmetaReport(texts, worldVersion) {
  const version = parseJsonText(texts.version, 'mcmeta version.json');
  if (version?.id !== MC_VERSION || version?.data_version !== worldVersion) {
    throw new Error(`mcmeta meldet Version ${version?.id} / Datenversion ${version?.data_version}, erwartet ${MC_VERSION} / ${worldVersion}`);
  }
  return convertMcmetaBlocks(parseJsonText(texts.blocks, 'mcmeta blocks/data.min.json'));
}

function writeFileAtomic(filePath, data) {
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, filePath);
}

async function loadMcmetaBlocks({ offline, worldVersion, warnings, log, cacheDir }) {
  const cacheFiles = {
    version: path.join(cacheDir, `mcmeta-${MCMETA_TAG}-version.json`),
    blocks: path.join(cacheDir, `mcmeta-${MCMETA_TAG}-blocks.json`),
  };
  if (isFile(cacheFiles.version) && isFile(cacheFiles.blocks)) {
    try {
      const texts = { version: fs.readFileSync(cacheFiles.version, 'utf8'), blocks: fs.readFileSync(cacheFiles.blocks, 'utf8') };
      return { blocks: parseMcmetaReport(texts, worldVersion), cached: true };
    } catch (error) {
      warnings.add(`Cache des Blockberichts unbrauchbar (${error.message}) – lade ihn neu.`);
    }
  }
  if (offline) throw new Error('kein gültiger Cache vorhanden und --offline gesetzt');
  log(`  lade Blockbericht von misode/mcmeta (${MCMETA_TAG}) …`);
  const texts = {
    version: await downloadText(MCMETA_BASE_URL + MCMETA_FILES.version, 64 * 1024),
    blocks: await downloadText(MCMETA_BASE_URL + MCMETA_FILES.blocks, DOWNLOAD_MAX_BYTES),
  };
  const blocks = parseMcmetaReport(texts, worldVersion);
  fs.mkdirSync(cacheDir, { recursive: true });
  writeFileAtomic(cacheFiles.version, texts.version);
  writeFileAtomic(cacheFiles.blocks, texts.blocks);
  return { blocks, cached: false };
}

// blockstates: Map id → Blockstate-JSON. cacheDir ist nur für Tests austauschbar.
export async function extractBlocks({ blockstates, worldVersion, offline, warnings, log = () => {}, cacheDir = CACHE_DIR }) {
  let report = null;
  try {
    report = await loadMcmetaBlocks({ offline, worldVersion, warnings, log, cacheDir });
  } catch (error) {
    warnings.add(`Blockbericht von misode/mcmeta nicht verfügbar (${error.message}) – Eigenschaften werden aus den Blockstate-Dateien abgeleitet (source "derived"); Eigenschaften wie waterlogged und manche Standardwerte fehlen dann.`);
  }
  const blocks = report ? report.blocks : deriveBlocksFromBlockstates(blockstates);
  for (const message of compareBlocksWithBlockstates(blocks, blockstates.keys())) warnings.add(message);
  const data = report
    ? { version: MC_VERSION, source: 'mcmeta', ref: `misode/mcmeta@${MCMETA_TAG}`, blocks }
    : { version: MC_VERSION, source: 'derived', blocks };
  return { data, cached: report?.cached ?? false };
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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readPngSize(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('keine PNG-Datei');
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') throw new Error('PNG ohne IHDR-Block');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
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

export function buildTextures({ assets, referenced, warnings }) {
  const names = new Set(referenced);
  for (const entry of assets.list(TEXTURE_PREFIX)) {
    if (!entry.endsWith('.png')) continue;
    const name = entry.slice(TEXTURE_PREFIX.length, -'.png'.length);
    if (RESOURCE_PATH_PATTERN.test(name) && isIncludedTexture(name)) names.add(name);
  }
  const entries = dict();
  const chunks = [];
  let offset = 0;
  let animated = 0;
  for (const name of [...names].sort()) {
    const png = assets.read(`${TEXTURE_PREFIX}${name}.png`);
    let size;
    try {
      size = readPngSize(png);
    } catch (error) {
      warnings.add(`Textur ${name} übersprungen: ${error.message}`);
      continue;
    }
    const entry = { o: offset, l: png.length, w: size.width, h: size.height, anim: null };
    const metaName = `${TEXTURE_PREFIX}${name}.png.mcmeta`;
    if (assets.has(metaName)) {
      try {
        const meta = assets.readJson(metaName);
        if (typeof meta?.texture?.mipmap_strategy === 'string') entry.mip = meta.texture.mipmap_strategy;
        entry.anim = parseAnimation(meta?.animation, size.width, size.height);
      } catch (error) {
        warnings.add(`Textur ${name}: .mcmeta unbrauchbar (${error.message}) – ohne Animation übernommen.`);
      }
    }
    if (entry.anim) animated++;
    entries[name] = entry;
    chunks.push(png);
    offset += png.length;
  }
  return { data: { version: MC_VERSION, entries }, bin: Buffer.concat(chunks), animated };
}

// ---------------------------------------------------------------------------------------------
// Strukturen (structures/)

// Zustands-String wie in Befehlen: „minecraft:oak_stairs[facing=east]{…}“ → { namespace, id, props, trailing }.
export function parseStateString(text) {
  if (typeof text !== 'string') return null;
  const match = /^\s*(?:([a-z0-9_.-]+):)?([a-z0-9_./-]+)/.exec(text);
  if (!match) return null;
  const props = dict();
  let rest = text.slice(match[0].length);
  if (rest.startsWith('[')) {
    const close = rest.indexOf(']');
    if (close < 0) return null;
    const body = rest.slice(1, close).trim();
    if (body !== '') {
      for (const pair of body.split(',')) {
        const parts = pair.split('=').map((part) => part.trim());
        if (parts.length !== 2 || !ID_PATTERN.test(parts[0]) || !ID_PATTERN.test(parts[1])) return null;
        props[parts[0]] = parts[1];
      }
    }
    rest = rest.slice(close + 1);
  }
  return { namespace: match[1] ?? 'minecraft', id: match[2], props, trailing: rest.trim() };
}

function readPaletteEntry(entry) {
  if (!isPlainObject(entry) || typeof entry.Name !== 'string') return null;
  const parsed = parseStateString(entry.Name);
  if (!parsed || parsed.trailing !== '' || Object.keys(parsed.props).length > 0) return null;
  if (entry.Properties !== undefined) {
    if (!isPlainObject(entry.Properties)) return null;
    for (const [key, value] of Object.entries(entry.Properties)) {
      if (typeof value !== 'string' || !ID_PATTERN.test(key) || !ID_PATTERN.test(value)) return null;
      parsed.props[key] = value;
    }
  }
  return parsed;
}

// Vervollständigt einen Zustand mit den Standardwerten aus blocks.json (wie das Spiel beim Laden).
// Mit vollständigen Daten (mcmeta) fallen unbekannte Blöcke/Eigenschaften wie im Spiel weg.
export function createStateNormalizer(blockData, warnings) {
  const strict = blockData.source === 'mcmeta';
  return function normalizeState({ namespace, id, props }, context) {
    if (namespace !== 'minecraft') {
      warnings.once(`ns:${namespace}:${id}`, `${context}: Block ${namespace}:${id} aus fremdem Namensraum – entfällt.`);
      return 'air';
    }
    if (REMOVED_STRUCTURE_BLOCKS.has(id)) return 'air';
    const info = Object.hasOwn(blockData.blocks, id) ? blockData.blocks[id] : null;
    if (!info) {
      if (!strict) return formatState(id, props);
      warnings.once(`block:${id}`, `${context}: unbekannter Block „${id}“ – entfällt.`);
      return 'air';
    }
    const full = dict();
    for (const [key, value] of Object.entries(props)) {
      if (strict && !Object.hasOwn(info.props, key)) {
        warnings.once(`prop:${id}:${key}`, `${context}: ${id} hat keine Eigenschaft „${key}“ – ignoriert.`);
        continue;
      }
      if (strict && !info.props[key].includes(value)) {
        warnings.once(`value:${id}:${key}:${value}`, `${context}: ${id}[${key}=${value}] gibt es nicht – Standardwert verwendet.`);
        continue;
      }
      full[key] = value;
    }
    for (const [key, value] of Object.entries(info.default)) {
      if (!(key in full)) full[key] = value;
    }
    return formatState(id, full);
  };
}

export function encodeRle(cells) {
  const rle = [];
  if (cells.length === 0) return rle;
  let current = cells[0];
  let run = 1;
  for (let i = 1; i < cells.length; i++) {
    if (cells[i] === current) {
      run++;
    } else {
      rle.push(current, run);
      current = cells[i];
      run = 1;
    }
  }
  rle.push(current, run);
  return rle;
}

function readStructureSize(value) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error('ungültige Größe (size)');
  }
  if (value[0] * value[1] * value[2] > MAX_STRUCTURE_VOLUME) throw new Error(`zu groß (${value.join('×')})`);
  return value;
}

function pickPalette(nbt) {
  if (Array.isArray(nbt.palette)) return nbt.palette;
  if (Array.isArray(nbt.palettes) && Array.isArray(nbt.palettes[0])) return nbt.palettes[0];
  throw new Error('Palette fehlt');
}

// Ungenutzte Paletteneinträge entfernen, „air“ bleibt Index 0.
function compactPalette(cells, palette) {
  const used = new Uint8Array(palette.length);
  for (const value of cells) used[value] = 1;
  const remap = new Uint16Array(palette.length);
  const compact = ['air'];
  for (let i = 1; i < palette.length; i++) {
    if (!used[i]) continue;
    remap[i] = compact.length;
    compact.push(palette[i]);
  }
  for (let i = 0; i < cells.length; i++) cells[i] = remap[cells[i]];
  return compact;
}

// Wandelt eine Strukturvorlage (NBT-Wurzel) ins Format aus ARCHITEKTUR §5.
export function convertStructure(structurePath, nbt, normalizeState, warnings) {
  if (!isPlainObject(nbt)) throw new Error('Wurzel ist kein Compound');
  const [sx, sy, sz] = readStructureSize(nbt.size);
  const rawPalette = pickPalette(nbt);
  const context = `Struktur ${structurePath}`;
  const palette = ['air'];
  const paletteIndices = new Map([['air', 0]]);
  const indexOfState = (state) => {
    if (!paletteIndices.has(state)) {
      if (palette.length >= 65535) throw new Error('mehr als 65535 verschiedene Zustände');
      paletteIndices.set(state, palette.length);
      palette.push(state);
    }
    return paletteIndices.get(state);
  };
  const JIGSAW = -1;
  const paletteMap = rawPalette.map((entry) => {
    const parsed = readPaletteEntry(entry);
    if (!parsed) {
      warnings.add(`${context}: ungültiger Paletteneintrag ${JSON.stringify(entry)} – entfällt.`);
      return 0;
    }
    if (parsed.namespace === 'minecraft' && parsed.id === 'jigsaw') return JIGSAW;
    return indexOfState(normalizeState(parsed, context));
  });

  const jigsawCache = new Map();
  const jigsawIndex = (blockNbt) => {
    if (!isPlainObject(blockNbt)) {
      warnings.once(`${context}:jigsaw-nbt`, `${context}: Jigsaw-Block ohne NBT – entfällt.`);
      return 0;
    }
    const finalState = typeof blockNbt.final_state === 'string' ? blockNbt.final_state : 'minecraft:air';
    if (!jigsawCache.has(finalState)) {
      const parsed = parseStateString(finalState);
      let index = 0;
      if (!parsed) {
        warnings.add(`${context}: final_state „${finalState}“ nicht lesbar – Block entfällt (wie im Spiel).`);
      } else {
        if (parsed.trailing !== '' && !parsed.trailing.startsWith('{')) {
          warnings.add(`${context}: final_state „${finalState}“ hat überzählige Zeichen „${parsed.trailing}“ (das Spiel ignoriert sie ebenfalls).`);
        }
        if (!(parsed.namespace === 'minecraft' && parsed.id === 'jigsaw')) index = indexOfState(normalizeState(parsed, context));
      }
      jigsawCache.set(finalState, index);
    }
    return jigsawCache.get(finalState);
  };

  const cells = new Uint16Array(sx * sy * sz);
  const blockList = Array.isArray(nbt.blocks) ? nbt.blocks : [];
  for (const block of blockList) {
    const pos = block?.pos;
    if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isInteger)) {
      warnings.once(`${context}:pos`, `${context}: Block mit ungültiger Position – übersprungen.`);
      continue;
    }
    const [x, y, z] = pos;
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) {
      warnings.once(`${context}:outside`, `${context}: Block außerhalb der Größe ${sx}×${sy}×${sz} – übersprungen.`);
      continue;
    }
    let value = Number.isInteger(block.state) ? paletteMap[block.state] : undefined;
    if (value === undefined) {
      warnings.once(`${context}:state`, `${context}: Block verweist auf fehlenden Paletteneintrag – übersprungen.`);
      continue;
    }
    if (value === JIGSAW) value = jigsawIndex(block.nbt);
    cells[(y * sz + z) * sx + x] = value;
  }

  const compact = compactPalette(cells, palette);
  let blockCount = 0;
  for (const value of cells) if (value !== 0) blockCount++;
  const size = [sx, sy, sz];
  return {
    data: { path: structurePath, size, palette: compact, rle: encodeRle(cells) },
    info: { size, blocks: blockCount, paletteSize: compact.length, entities: Array.isArray(nbt.entities) ? nbt.entities.length : 0 },
  };
}

export function structureFileName(structurePath) {
  return `${structurePath.split('/').join('__')}.json`;
}

function buildStructures({ assets, normalizeState, warnings }) {
  const structures = [];
  const files = [];
  const fileNames = new Set();
  for (const entry of assets.list(STRUCTURE_PREFIX)) {
    if (!entry.endsWith('.nbt')) continue;
    const structurePath = entry.slice(STRUCTURE_PREFIX.length, -'.nbt'.length);
    if (!RESOURCE_PATH_PATTERN.test(structurePath) || structurePath.split('/').some((part) => part === '.' || part === '..')) {
      warnings.add(`Struktur mit ungewöhnlichem Pfad übersprungen: ${entry}`);
      continue;
    }
    const file = structureFileName(structurePath);
    if (fileNames.has(file)) {
      warnings.add(`Struktur ${structurePath} übersprungen: Dateiname ${file} doppelt.`);
      continue;
    }
    try {
      const { value } = readNbt(assets.read(entry));
      const result = convertStructure(structurePath, value, normalizeState, warnings);
      fileNames.add(file);
      structures.push({ path: structurePath, file, ...result.info });
      files.push({ file, text: JSON.stringify(result.data) });
    } catch (error) {
      warnings.add(`Struktur ${structurePath} übersprungen: ${error.message}`);
    }
  }
  return { index: { version: MC_VERSION, structures }, files };
}

// ---------------------------------------------------------------------------------------------
// Schreiben und Ablauf

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// Reste abgebrochener Läufe entfernen (nur, wenn der Prozess dazu nicht mehr läuft).
function removeStaleStaging(outputDir) {
  if (!fs.existsSync(outputDir)) return;
  for (const name of fs.readdirSync(outputDir)) {
    const pid = Number(/^\.staging-(\d+)$/.exec(name)?.[1]);
    if (pid && pid !== process.pid && !isProcessRunning(pid)) fs.rmSync(path.join(outputDir, name), { recursive: true, force: true });
  }
}

// Schreibt erst in einen versteckten Zwischenordner und tauscht dann aus. Andere Dateien in game-data/
// (z. B. catalog.json, .cache/) bleiben unberührt; structures/ gehört ganz diesem Skript.
function writeOutputs(files, structureFiles, outputDir = OUTPUT_DIR) {
  removeStaleStaging(outputDir);
  const staging = path.join(outputDir, `.staging-${process.pid}`);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.join(staging, 'structures'), { recursive: true });
  for (const { name, data } of files) fs.writeFileSync(path.join(staging, name), data);
  for (const { file, text } of structureFiles) fs.writeFileSync(path.join(staging, 'structures', file), text);

  const targetStructures = path.join(outputDir, 'structures');
  fs.rmSync(targetStructures, { recursive: true, force: true, maxRetries: 3 });
  fs.renameSync(path.join(staging, 'structures'), targetStructures);
  for (const { name } of files) fs.renameSync(path.join(staging, name), path.join(outputDir, name));
  fs.rmSync(staging, { recursive: true, force: true });
}

function timed(label, task, log) {
  const started = performance.now();
  const result = task();
  const finish = (value) => {
    log(`✓ ${label(value)} (${Math.round(performance.now() - started)} ms)`);
    return value;
  };
  return result instanceof Promise ? result.then(finish) : finish(result);
}

function summarizeFeatures(stats, blocksWithoutGeometry) {
  return {
    singleAxisRotations: stats.singleAxisRotations,
    freeAngleRotations: stats.freeAngleRotations,
    eulerRotations: stats.eulerRotations,
    rescaledRotations: stats.rescaledRotations,
    rotationAngles: [...stats.angles].sort((a, b) => a - b),
    forceTranslucentFaces: stats.forceTranslucentFaces,
    lightEmissionElements: stats.lightEmissionElements,
    variantZRotations: stats.variantZRotations,
    weightedLists: stats.weightedLists,
    multipartBlocks: stats.multipartBlocks,
    builtinMissingTexture: stats.builtinMissingTexture,
    blocksWithoutGeometry,
  };
}

// --remote: Archive von misode/mcmeta und de_de.json statt Jar und Asset-Ordner (scripts/lib/remote-source.mjs).
async function openRemoteSources({ offline, cacheDir }, warnings, log) {
  log(`Block-Kompass · Spieldaten für Minecraft Java ${MC_VERSION} aus öffentlichen Quellen (--remote${offline ? ', nur Cache' : ''})`);
  log(`  Cache:  ${cacheDir}`);
  try {
    return await timed((r) => `Quellen bereit: ${r.refs.assets} + ${r.refs.data}, de_de.json von ${r.refs.lang}`,
      () => loadRemoteSources({ version: MC_VERSION, cacheDir, offline, download: createDownloader({ log }), warnings, log }), log);
  } catch (error) {
    if (error instanceof RemoteSourceError) throw new UserError(error.message);
    throw error;
  }
}

// Ohne Blockbericht wären die Daten deutlich schlechter als mit der Jar – im Remote-Modus darum ein Fehler.
function requireMcmetaReport(blocks, warnings, offline) {
  if (blocks.data.source === 'mcmeta') return;
  const problem = warnings.list.find((message) => message.startsWith('Blockbericht von misode/mcmeta nicht verfügbar')) ?? 'unbekannter Grund';
  if (offline) throw new UserError(`Der Blockbericht fehlt im Cache und --offline ist gesetzt.\n→ Einmal ohne --offline laufen lassen.\n(${problem})`);
  const reason = /nicht verfügbar \((.*)\) – Eigenschaften/.exec(problem)?.[1] ?? problem;
  throw new UserError(`Der Blockbericht (Eigenschaften und Standardwerte) ließ sich nicht laden.\n${blockedDomainMessage('raw.githubusercontent.com', reason)}`);
}

// Blockfarben für den Voxel-Import (scripts/build-block-colors.mjs, ARCHITEKTUR §5 block-colors.json). Scheitern sie
// (z. B. unlesbare Texturen), bleiben die übrigen Spieldaten gültig: Warnung in meta.json, nur der Modell-Import fehlt.
function extractBlockColors({ models, blocks, textures, warnings, log }) {
  try {
    return timed((c) => `Blockfarben: ${formatNumber(c.count)} volle Blöcke für den Modell-Import`,
      () => buildBlockColors({ modelsJson: models.data, blocksJson: blocks.data, texturesJson: textures.data, texturesBin: textures.bin }), log);
  } catch (error) {
    const message = `Blockfarben für den Modell-Import (.stl, .obj, .glb, .vox) nicht erzeugt: ${error.message} – später: node scripts/build-block-colors.mjs`;
    warnings.add(message);
    log(`⚠ ${message}`);
    return null;
  }
}

export async function extractGameData(options, log = console.log) {
  const started = performance.now();
  const warnings = createWarnings();
  const outputDir = path.resolve(options.out ?? OUTPUT_DIR);
  const cacheDir = path.join(outputDir, '.cache');
  const outputLabel = path.relative(ROOT, outputDir).split(path.sep).join('/') || '.';
  let assets;
  let version;
  let readGerman;
  let assetIndex;
  let remoteRefs = null;
  if (options.remote) {
    const remote = await openRemoteSources({ offline: options.offline, cacheDir }, warnings, log);
    ({ assets, version, assetIndex } = remote);
    readGerman = () => remote.germanLang;
    remoteRefs = remote.refs;
  } else {
    const sources = resolveSources(options, warnings);
    log(`Block-Kompass · Spieldaten aus Minecraft Java ${MC_VERSION}`);
    log(`  Jar:    ${sources.jarPath}`);
    log(`  Assets: ${sources.assetsDir} (Index ${sources.assetIndex})`);

    const zip = timed((z) => `Jar gelesen: ${formatNumber(z.entries.size)} Einträge`, () => openJar(sources.jarPath), log);
    assets = createJarAssets(zip);
    version = readJarVersion(assets);
    readGerman = () => readGermanLang(sources.assetsDir, sources.assetIndex);
    assetIndex = sources.assetIndex;
  }

  const names = timed((n) => `Namen: ${formatNumber(Object.keys(n.block).length)} Blöcke, ${formatNumber(Object.keys(n.item).length)} Items (de + en)`,
    () => extractNames(assets, readGerman, warnings), log);
  const blockstates = loadBlockstates(assets, warnings);
  const blocks = await timed(
    (b) => `Blockeigenschaften: ${formatNumber(Object.keys(b.data.blocks).length)} Blöcke, Quelle ${b.data.source}${b.data.ref ? ` (${b.data.ref}${b.cached ? ', Cache' : ', heruntergeladen'})` : ''}`,
    () => extractBlocks({ blockstates, worldVersion: version.worldVersion, offline: options.offline, warnings, log, cacheDir }), log);
  if (options.remote) requireMcmetaReport(blocks, warnings, options.offline);
  const models = timed((m) => `Modelle: ${formatNumber(m.data.models.length)} Modelle für ${formatNumber(Object.keys(m.data.blocks).length)} Blockstates, ${formatNumber(m.data.textures.length)} Texturen genutzt`,
    () => buildModels({ assets, blockstates, blocks: blocks.data.blocks, warnings }), log);
  const textures = timed((t) => `Texturen: ${formatNumber(Object.keys(t.data.entries).length)} Bilder (${t.animated} animiert), ${formatBytes(t.bin.length)}`,
    () => buildTextures({ assets, referenced: models.data.textures, warnings }), log);
  const structures = timed((s) => `Strukturen: ${formatNumber(s.index.structures.length)} umgewandelt`,
    () => buildStructures({ assets, normalizeState: createStateNormalizer(blocks.data, warnings), warnings }), log);

  const blocksWithoutGeometry = findBlocksWithoutGeometry(models.data);
  const blockColors = extractBlockColors({ models, blocks, textures, warnings, log });
  const meta = {
    version: MC_VERSION,
    worldVersion: version.worldVersion,
    resourcePack: version.resourcePack,
    dataPack: version.dataPack,
    extractedAt: new Date().toISOString(),
    sources: { blocks: blocks.data.source, blocksRef: blocks.data.ref ?? null, assetIndex, ...(remoteRefs ? { remote: remoteRefs } : {}) },
    counts: {
      blocks: Object.keys(blocks.data.blocks).length,
      blockstates: blockstates.size,
      models: models.data.models.length,
      textures: Object.keys(textures.data.entries).length,
      structures: structures.index.structures.length,
      blockNames: Object.keys(names.block).length,
      itemNames: Object.keys(names.item).length,
    },
    features: summarizeFeatures(models.stats, blocksWithoutGeometry),
    warnings: warnings.list,
  };

  const files = [
    { name: 'names.json', data: JSON.stringify(names) },
    { name: 'blocks.json', data: JSON.stringify(blocks.data) },
    { name: 'models.json', data: JSON.stringify(models.data) },
    { name: 'textures.json', data: JSON.stringify(textures.data) },
    { name: 'textures.bin', data: textures.bin },
    { name: 'meta.json', data: JSON.stringify(meta, null, 2) },
    ...(blockColors ? [{ name: BLOCK_COLORS_FILE, data: JSON.stringify(blockColors) }] : []),
  ];
  const structureFiles = [{ file: 'index.json', text: JSON.stringify(structures.index) }, ...structures.files];
  writeOutputs(files, structureFiles, outputDir);

  log(`Ausgabe in ${outputLabel}/:`);
  for (const { name, data } of files) log(`  ${name.padEnd(16)} ${formatBytes(Buffer.byteLength(data)).padStart(9)}`);
  const structureBytes = structureFiles.reduce((sum, { text }) => sum + Buffer.byteLength(text), 0);
  log(`  ${'structures/'.padEnd(16)} ${formatBytes(structureBytes).padStart(9)}  (${formatNumber(structureFiles.length)} Dateien inkl. index.json)`);
  if (warnings.list.length > 0) {
    log(`Warnungen: ${warnings.list.length} (vollständig in ${outputLabel}/meta.json)`);
    for (const message of warnings.list.slice(0, 15)) log(`  - ${message}`);
    if (warnings.list.length > 15) log(`  … und ${warnings.list.length - 15} weitere`);
  } else {
    log('Keine Warnungen.');
  }
  log(`Fertig in ${((performance.now() - started) / 1000).toLocaleString('de-CH', { maximumFractionDigits: 1 })} s.`);
  return meta;
}

// Node-fetch ignoriert HTTPS_PROXY ohne --use-env-proxy (z. B. in Cloud-Containern): dann einmal damit neu starten.
// → true, wenn der Kindprozess die Arbeit gemacht hat (Exit-Code übernommen).
function relaunchWithEnvProxy() {
  const plan = proxyRelaunchPlan();
  if (plan.warn) console.warn(`Hinweis: ${plan.reason}. Downloads können am Proxy scheitern.`);
  if (!plan.relaunch) return false;
  console.log(`${plan.reason} – starte mit --use-env-proxy neu, damit die Downloads über den Proxy laufen.`);
  const result = spawnSync(process.execPath, ['--use-env-proxy', ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  return true;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) console.log(USAGE);
    else if (!(options.remote && relaunchWithEnvProxy())) await extractGameData(options);
  } catch (error) {
    if (error instanceof UserError) console.error(`Fehler: ${error.message}`);
    else console.error('Unerwarteter Fehler bei der Extraktion:', error);
    process.exitCode = 1;
  }
}
