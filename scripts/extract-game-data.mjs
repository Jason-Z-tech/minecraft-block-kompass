// Spieldaten aus der installierten Minecraft Java 26.2 nach game-data/ (gitignored) extrahieren.
// Liest nur: die Client-Jar, den Asset-Index mit de_de.json und einmalig den Blockbericht von
// misode/mcmeta (Cache in game-data/.cache/). Schreibt nie in .minecraft/curseforge, startet nichts.
// Aufruf: node scripts/extract-game-data.mjs [--jar <pfad>] [--assets <ordner>] [--offline] [--out <ordner>]
// Ohne Installation: node scripts/extract-game-data.mjs --remote – gleiche Daten aus öffentlichen Quellen
// (scripts/lib/remote-source.mjs). Ohne Optionen und ohne Jar am Standardort passiert das automatisch.

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
import {
  MC_VERSION, MCMETA_TAG, ASSET_ROOT, TEXTURE_PREFIX, STRUCTURE_PREFIX, RESOURCE_PATH_PATTERN, DIRECTIONS, createWarnings, dict,
  parseJsonText, normalizeResourceName, formatState, buildNames, loadBlockstates, convertMcmetaBlocks, parseVariantKey,
  deriveBlocksFromBlockstates, compareBlocksWithBlockstates, parseMcmetaReport, mcmetaBlocksData, axisRotationMatrix,
  eulerRotationMatrix, applyRescale, defaultFaceUv, convertElementRotation, convertConditionTerms, convertCondition, buildModels,
  findBlocksWithoutGeometry, readPngSize, parseAnimation, isIncludedTexture, selectTextureNames, textureEntry, parseStateString,
  createStateNormalizer, encodeRle, convertStructure, structureFileName,
} from '../js/data/convert.js';

// Die reine Umwandlung liegt in js/data/convert.js (läuft auch im Browser); hier unter den bisherigen Namen weiter exportiert.
export {
  MC_VERSION, MCMETA_TAG, DIRECTIONS, createWarnings, normalizeResourceName, formatState, buildNames, convertMcmetaBlocks,
  parseVariantKey, deriveBlocksFromBlockstates, compareBlocksWithBlockstates, axisRotationMatrix, eulerRotationMatrix, applyRescale,
  defaultFaceUv, convertElementRotation, convertConditionTerms, convertCondition, buildModels, findBlocksWithoutGeometry,
  readPngSize, parseAnimation, isIncludedTexture, parseStateString, createStateNormalizer, encodeRle, convertStructure,
  structureFileName,
};

const DEFAULT_ASSET_INDEX = '32';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT_DIR = path.join(ROOT, 'game-data');
const CACHE_DIR = path.join(OUTPUT_DIR, '.cache');

const MCMETA_BASE_URL = `https://raw.githubusercontent.com/misode/mcmeta/${MCMETA_TAG}/`;
const MCMETA_FILES = { version: 'version.json', blocks: 'blocks/data.min.json' };
const DOWNLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_MAX_BYTES = 16 * 1024 * 1024;

const LANG_EN_ENTRY = `${ASSET_ROOT}lang/en_us.json`;
const LANG_DE_OBJECT = 'minecraft/lang/de_de.json';

const USAGE = [
  'Aufruf: node scripts/extract-game-data.mjs [--jar <pfad>] [--assets <ordner>] [--offline] [--out <ordner>]',
  '        node scripts/extract-game-data.mjs --remote [--offline] [--out <ordner>]',
  `  --jar <pfad>       Minecraft-Jar (Standard: %APPDATA%\\.minecraft\\versions\\${MC_VERSION}\\${MC_VERSION}.jar)`,
  '  --assets <ordner>  Assets-Ordner mit indexes\\ und objects\\ (Standard: CurseForge, sonst .minecraft)',
  '  --offline          nichts herunterladen (Blockbericht nur aus game-data\\.cache, sonst abgeleitet;',
  '                     mit --remote alles nur aus dem Cache)',
  '  --remote           ohne Minecraft-Installation: Dateien von misode/mcmeta (GitHub) und Mojang laden',
  '                     (ohne --jar/--assets automatisch, wenn am Standardort keine Jar liegt)',
  `                     (Domains: ${REMOTE_DOMAINS.map((domain) => domain.host).join(', ')})`,
  '  --out <ordner>     Zielordner statt game-data (Cache dann in <ordner>/.cache)',
].join('\n');

// Erwartete Probleme (fehlende Dateien, falsche Version …): Meldung ohne Stacktrace.
export class UserError extends Error {}

// ---------------------------------------------------------------------------------------------
// Hilfen

function isFile(filePath) {
  return fs.statSync(filePath, { throwIfNoEntry: false })?.isFile() === true;
}

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

/**
 * Ohne --jar, --assets und --remote, aber auch ohne Jar am Standardort: aus öffentlichen Quellen laden wie mit --remote,
 * damit es auch ohne Minecraft-Installation geht. → { options, auto, jarPath } (auto = automatisch auf remote gewechselt)
 */
export function chooseSource(options, { jarPath = defaultSourcePaths().jar, exists = isFile } = {}) {
  if (options.remote || options.jar !== undefined || options.assets !== undefined || exists(jarPath)) return { options, auto: false, jarPath };
  return { options: { ...options, remote: true }, auto: true, jarPath };
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
  const data = report ? mcmetaBlocksData(blocks) : { version: MC_VERSION, source: 'derived', blocks };
  return { data, cached: report?.cached ?? false };
}

// ---------------------------------------------------------------------------------------------
// Texturen (textures.json + textures.bin)

export function buildTextures({ assets, referenced, warnings }) {
  const available = [];
  for (const entry of assets.list(TEXTURE_PREFIX)) {
    if (entry.endsWith('.png')) available.push(entry.slice(TEXTURE_PREFIX.length, -'.png'.length));
  }
  const entries = dict();
  const chunks = [];
  let offset = 0;
  let animated = 0;
  for (const name of selectTextureNames(referenced, available)) {
    const png = assets.read(`${TEXTURE_PREFIX}${name}.png`);
    let size;
    try {
      size = readPngSize(png);
    } catch (error) {
      warnings.add(`Textur ${name} übersprungen: ${error.message}`);
      continue;
    }
    const metaName = `${TEXTURE_PREFIX}${name}.png.mcmeta`;
    const meta = assets.has(metaName) ? () => assets.readJson(metaName) : undefined;
    const entry = { o: offset, l: png.length, ...textureEntry({ name, width: size.width, height: size.height, meta, warnings }) };
    if (entry.anim) animated++;
    entries[name] = entry;
    chunks.push(png);
    offset += png.length;
  }
  return { data: { version: MC_VERSION, entries }, bin: Buffer.concat(chunks), animated };
}

// ---------------------------------------------------------------------------------------------
// Strukturen (structures/)

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
// → true, wenn der Kindprozess die Arbeit gemacht hat (Exit-Code übernommen). extraArgs: z. B. ['--remote'] nach automatischem Wechsel.
function relaunchWithEnvProxy(extraArgs = []) {
  const plan = proxyRelaunchPlan();
  if (plan.warn) console.warn(`Hinweis: ${plan.reason}. Downloads können am Proxy scheitern.`);
  if (!plan.relaunch) return false;
  console.log(`${plan.reason} – starte mit --use-env-proxy neu, damit die Downloads über den Proxy laufen.`);
  const result = spawnSync(process.execPath, ['--use-env-proxy', ...process.execArgv, ...process.argv.slice(1), ...extraArgs], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  return true;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    const parsed = parseCliArgs(process.argv.slice(2));
    if (parsed.help) console.log(USAGE);
    else {
      const { options, auto, jarPath } = chooseSource(parsed);
      if (auto) {
        console.log(`Keine Minecraft-Installation gefunden (${jarPath}).`);
        console.log('Lade die Spieldaten ohne Minecraft aus öffentlichen Quellen (misode/mcmeta auf GitHub, Mojang; einmalig ≈ 13 MB) …');
      }
      if (!(options.remote && relaunchWithEnvProxy(auto ? ['--remote'] : []))) await extractGameData(options);
    }
  } catch (error) {
    if (error instanceof UserError) console.error(`Fehler: ${error.message}`);
    else console.error('Unerwarteter Fehler bei der Extraktion:', error);
    process.exitCode = 1;
  }
}
