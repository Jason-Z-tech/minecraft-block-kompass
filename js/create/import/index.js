// Datei-Import für „Selber erstellen“ (ARCHITEKTUR §12.2): fertige Bauten aus dem Netz laden.
// Minecraft-Dateien (.schem v1–v3, .litematic, Strukturdatei .nbt) liest dieses Modul selbst; 3D-Modelle
// (.vox, .stl, .obj, .glb, .gltf) gibt es an modelToVolume aus js/create/voxelize/index.js weiter.
// Das Format wird am Inhalt erkannt (gzip-Kennung, NBT-Aufbau, Datei-Kennungen), nicht nur an der Endung.
// Ergebnis: ImportResult (Kapitel mit Blocklisten) → importToBuildResult() → BuildResult wie bei Strukturen.

import { readNbtAsync, detectCompression, NbtError } from './nbt.js';
import { IMPORT_LIMITS, ImportError, BlockCollector, formatInt, formatMb, cleanText, isCompound } from './common.js';
import { StateConverter } from './rename.js';
import { findSpongeSchematic, readSchem } from './schem.js';
import { isLitematic, readLitematic } from './litematic.js';
import { isStructureNbt, readStructureNbt } from './structure-nbt.js';
import { Builder } from '../../core/builder.js';
import { isBlockDataLoaded } from '../../core/block-data.js';

export { IMPORT_LIMITS, ImportError };

export const NBT_FORMATS = Object.freeze(['schem', 'litematic', 'nbt']);
export const MODEL_FORMATS = Object.freeze(['vox', 'stl', 'obj', 'glb', 'gltf']);
export const UPLOAD_FORMATS = Object.freeze([...NBT_FORMATS, ...MODEL_FORMATS]);
/** Für <input type="file" accept="…">. */
export const UPLOAD_ACCEPT = '.schem,.schematic,.litematic,.nbt,.vox,.stl,.obj,.glb,.gltf';
/** Datenversion von Minecraft Java 26.2 (§5). */
export const WORLD_VERSION = 4903;

export const FORMAT_LABELS = Object.freeze({
  schem: 'Sponge-Schematic (.schem)', litematic: 'Litematica (.litematic)', nbt: 'Strukturdatei (.nbt)',
  vox: 'MagicaVoxel (.vox)', stl: 'STL-Modell (.stl)', obj: 'OBJ-Modell (.obj)', glb: 'glTF-Binärmodell (.glb)', gltf: 'glTF-Modell (.gltf)',
});

const EXTENSION_FORMATS = Object.freeze({
  schem: 'schem', schematic: 'schem', litematic: 'litematic', nbt: 'nbt',
  vox: 'vox', stl: 'stl', obj: 'obj', glb: 'glb', gltf: 'gltf',
});

const SUPPORTED_TEXT = 'Unterstützt werden .schem, .litematic, .nbt (Strukturblock), .vox, .stl, .obj, .glb und .gltf.';

/** Format aus dem Dateinamen (Endung) oder null. .schematic gilt als .schem (der Inhalt entscheidet). */
export function formatFromName(name) {
  if (typeof name !== 'string') return null;
  const match = /\.([a-z0-9]{2,10})$/i.exec(name.trim());
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return Object.hasOwn(EXTENSION_FORMATS, ext) ? EXTENSION_FORMATS[ext] : null;
}

/** Dateiname für Anzeige und Titel: ohne Pfad und Steuerzeichen, höchstens 120 Zeichen. */
export function cleanFileName(name) {
  const base = typeof name === 'string' ? name.split(/[\\/]/).pop() : '';
  return cleanText(base, 120) ?? 'Datei';
}

const startsWith = (bytes, text) => bytes.length >= text.length && [...text].every((ch, i) => bytes[i] === ch.charCodeAt(0));

/**
 * Inhalt grob bestimmen: 'nbt' (gzip/zlib), 'nbt-raw' (sieht aus wie ungepacktes NBT mit Compound-Wurzel), 'vox', 'glb', 'json',
 * 'text' (lesbarer Text, z. B. OBJ oder ASCII-STL) oder 'binary'.
 */
export function sniffContent(bytes) {
  if (detectCompression(bytes) !== 'none') return 'nbt';
  if (startsWith(bytes, 'VOX ')) return 'vox';
  if (startsWith(bytes, 'glTF')) return 'glb';
  if (bytes.length >= 4 && bytes[0] === 10 && ((bytes[1] << 8) | bytes[2]) <= Math.min(256, bytes.length - 4)) return 'nbt-raw';
  const head = bytes.subarray(0, Math.min(bytes.length, 1024));
  let i = 0;
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) i = 3;
  while (i < head.length && (head[i] === 0x20 || head[i] === 0x09 || head[i] === 0x0a || head[i] === 0x0d)) i++;
  if (head[i] === 0x7b) return 'json';
  let printable = 0;
  for (const byte of head) if ((byte >= 0x20 && byte < 0x7f) || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte >= 0x80) printable++;
  return head.length > 0 && printable / head.length > 0.97 ? 'text' : 'binary';
}

function toBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  throw new ImportError('argument', 'Die Datei konnte nicht gelesen werden (keine Binärdaten).');
}

function checkSize(bytes, limits) {
  if (bytes.length === 0) throw new ImportError('empty-file', 'Die Datei ist leer.');
  if (bytes.length > limits.maxFileBytes) {
    throw new ImportError('file-too-large', `Die Datei ist zu groß (${formatMb(bytes.length)} MB) – erlaubt sind höchstens ${formatMb(limits.maxFileBytes)} MB.`);
  }
}

// Welche Verarbeitung? Gepacktes NBT und Modell-Kennungen (VOX, glTF, JSON) gewinnen gegen die Endung;
// ungepacktes NBT ist nur eine Vermutung und zählt nur bei Minecraft-Endungen.
function routeFormat(declared, sniff, warnings, name) {
  if (sniff === 'nbt-raw') sniff = NBT_FORMATS.includes(declared) ? 'nbt' : 'binary';
  const contentFormat = sniff === 'nbt' ? 'nbt-family' : sniff === 'vox' ? 'vox' : sniff === 'glb' ? 'glb' : sniff === 'json' ? 'gltf' : null;
  if (contentFormat === 'nbt-family') {
    if (MODEL_FORMATS.includes(declared)) warnings.push(`„${name}“ ist eigentlich eine Minecraft-Datei (NBT) und wird als solche geladen.`);
    return 'nbt-family';
  }
  if (contentFormat) {
    if (contentFormat !== declared) warnings.push(`„${name}“ ist eigentlich im Format ${FORMAT_LABELS[contentFormat]} und wird so geladen.`);
    return contentFormat;
  }
  if (NBT_FORMATS.includes(declared)) {
    throw new ImportError('unknown-format', `Die Datei ist keine Minecraft-Datei: .schem, .litematic und .nbt sind (meist gepackte) NBT-Daten, diese Datei aber nicht. ${SUPPORTED_TEXT}`);
  }
  if (declared === 'gltf') throw new ImportError('unknown-format', 'Die Datei ist kein glTF-Modell (kein JSON-Inhalt).');
  return declared;
}

function nbtFailure(error, limits) {
  if (error instanceof NbtError) {
    if (error.code === 'unpacked-too-large') {
      return new ImportError('unpacked-too-large', `Die Datei ist entpackt größer als ${formatMb(limits.maxUnpackedBytes)} MB und wird nicht geladen.`, { detail: error.message });
    }
    if (error.code === 'unsupported') return new ImportError('unsupported', 'Dein Browser kann gepackte Dateien nicht entpacken. Nimm einen aktuellen Browser (Chrome, Edge, Firefox).', { detail: error.message });
    return new ImportError('corrupt', 'Die Datei ist beschädigt oder unvollständig (NBT-Daten nicht lesbar).', { detail: error.message });
  }
  return error;
}

function detectNbtKind(root) {
  if (isLitematic(root)) return { kind: 'litematic' };
  const sponge = findSpongeSchematic(root);
  if (sponge) return { kind: 'schem', sponge };
  if (isStructureNbt(root)) return { kind: 'nbt' };
  const value = root?.value;
  if (isCompound(value) && value.Blocks instanceof Int8Array && (value.Data instanceof Int8Array || typeof value.Materials === 'string')) {
    throw new ImportError('legacy-schematic', 'Das ist eine alte MCEdit-Schematic (vor Minecraft 1.13, mit Zahlen-IDs). Dieses Format wird nicht unterstützt – speichere den Bau mit WorldEdit neu als .schem.');
  }
  throw new ImportError('unknown-format', `Die Datei enthält NBT-Daten, aber weder eine Schematic, eine Litematica-Datei noch eine Strukturdatei. ${SUPPORTED_TEXT}`);
}

function versionWarnings(info, warnings) {
  const dv = info.dataVersion;
  if (dv !== null && dv > WORLD_VERSION) {
    warnings.push(`Die Datei stammt aus einer neueren Minecraft-Version (Datenversion ${dv}, 26.2 hat ${WORLD_VERSION}) – unbekannte Blöcke fallen weg.`);
  } else if (dv !== null && dv > 0 && dv < 1519) {
    warnings.push(`Die Datei stammt aus einer Version vor 1.13 (Datenversion ${dv}) – viele Blöcke hießen damals anders und fallen weg.`);
  }
  if (info.entities > 0) {
    warnings.push(info.entities === 1
      ? 'Die Datei enthält 1 Objekt (z. B. Rüstungsständer, Rahmen oder Tier) – es wird nicht angezeigt.'
      : `Die Datei enthält ${formatInt(info.entities)} Objekte (z. B. Rüstungsständer, Rahmen, Tiere) – sie werden nicht angezeigt.`);
  }
}

async function importNbtFamily(bytes, declared, name, ctx) {
  const { limits, onProgress, warnings } = ctx;
  onProgress?.(detectCompression(bytes) === 'none' ? 'Lese Datei …' : 'Entpacke Datei …', null);
  let root;
  try {
    root = await readNbtAsync(bytes, { maxBytes: limits.maxUnpackedBytes, maxDepth: limits.maxDepth });
  } catch (error) {
    throw nbtFailure(error, limits);
  }
  const { kind, sponge } = detectNbtKind(root);
  if (NBT_FORMATS.includes(declared) && kind !== declared) warnings.push(`„${name}“ ist eigentlich im Format ${FORMAT_LABELS[kind]} und wird so geladen.`);
  if (!isBlockDataLoaded()) throw new ImportError('data-missing', 'Die Blockdaten fehlen (game-data/blocks.json). Erzeuge sie mit: node scripts/extract-game-data.mjs');
  const converter = new StateConverter();
  const collector = new BlockCollector(limits);
  const text = `Importiert aus „${name}“ – baue Ebene für Ebene von unten nach oben.`;
  const readCtx = { converter, collector, onProgress, warnings, text };
  let info;
  try {
    if (kind === 'litematic') info = readLitematic(root, readCtx);
    else if (kind === 'schem') info = readSchem(sponge, readCtx);
    else info = readStructureNbt(root, readCtx);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('corrupt', 'Die Datei ist beschädigt oder unvollständig.', { detail: error?.stack ?? String(error) });
  }
  const finished = collector.finish();
  versionWarnings(info, warnings);
  warnings.unshift(...converter.warnings());
  const { regionList, size: sourceSize, ...rest } = info;
  return {
    format: kind,
    finished,
    palette: converter.palette,
    stats: {
      ...rest,
      sourceSize: sourceSize ?? null,
      regionList: regionList ?? null,
      compression: root.compression,
      unpackedBytes: root.unpackedBytes,
      ...converter.summary(),
    },
  };
}

async function defaultImportVoxelizer() {
  return import('../voxelize/index.js');
}

function checkVolume(volume) {
  const bad = (what) => new ImportError('model', `Der Modell-Import hat ein ungültiges Ergebnis geliefert (${what}).`);
  if (!isCompound(volume)) throw bad('kein Objekt');
  const { size, palette, data } = volume;
  if (!Array.isArray(size) || size.length !== 3 || !size.every((n) => Number.isInteger(n) && n > 0)) throw bad('size');
  if (!Array.isArray(palette) || palette[0] !== 'air' || palette.some((s) => typeof s !== 'string')) throw bad('palette');
  if (!(data instanceof Uint16Array) || data.length !== size[0] * size[1] * size[2]) throw bad('data');
}

async function importModel(bytes, format, ctx) {
  const { limits, onProgress, warnings, params } = ctx;
  let voxelizer;
  try {
    voxelizer = await (ctx.importVoxelizer ?? defaultImportVoxelizer)();
  } catch (error) {
    throw new ImportError('module-missing', 'Der Import von 3D-Modellen (.vox, .stl, .obj, .glb, .gltf) ist noch nicht verfügbar.', { detail: error?.message ?? String(error) });
  }
  if (!voxelizer || typeof voxelizer.modelToVolume !== 'function') {
    throw new ImportError('module-missing', 'Der Import von 3D-Modellen (.vox, .stl, .obj, .glb, .gltf) ist noch nicht verfügbar.');
  }
  let blockColors = null;
  if (typeof ctx.loadBlockColors === 'function') {
    try {
      blockColors = await ctx.loadBlockColors();
    } catch (error) {
      if (error instanceof ImportError) throw error;
      throw new ImportError('data-missing', error?.message || 'Die Blockfarben (game-data/block-colors.json) fehlen.', { detail: error?.detail ?? null });
    }
  }
  onProgress?.('Wandle das Modell in Blöcke um …', null);
  const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
  let volume;
  try {
    volume = await voxelizer.modelToVolume(format, buffer, params, { blockColors, onProgress });
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError('model', `Das Modell konnte nicht umgewandelt werden: ${error?.message ?? String(error)}`, { detail: error?.stack ?? null });
  }
  checkVolume(volume);
  if (!isBlockDataLoaded()) throw new ImportError('data-missing', 'Die Blockdaten fehlen (game-data/blocks.json). Erzeuge sie mit: node scripts/extract-game-data.mjs');
  const converter = new StateConverter();
  const collector = new BlockCollector(limits);
  const entries = volume.palette.map((state, i) => (i === 0 ? null : converter.fromString(state)));
  const counts = new Float64Array(entries.length);
  const [w, h, l] = volume.size;
  collector.begin('Aufbau', `Aus dem Modell „${ctx.name}“ erzeugt – baue Ebene für Ebene von unten nach oben.`);
  const { data } = volume;
  let cell = 0;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++, cell++) {
        const raw = data[cell];
        if (raw === 0) continue;
        const entry = entries[raw];
        if (!entry) throw new ImportError('model', 'Der Modell-Import hat ein ungültiges Ergebnis geliefert (Index außerhalb der Palette).');
        counts[raw]++;
        if (entry.index !== 0) collector.push(x, y, z, entry.index);
      }
    }
  }
  for (let i = 1; i < entries.length; i++) if (counts[i] > 0) converter.count(entries[i], counts[i]);
  const finished = collector.finish();
  warnings.push(...(Array.isArray(volume.warnings) ? volume.warnings.filter((t) => typeof t === 'string') : []), ...converter.warnings());
  let modelStats = null;
  try {
    modelStats = isCompound(volume.stats) ? structuredClone(volume.stats) : null;
  } catch (error) {
    warnings.push(`Kennzahlen des Modell-Imports lassen sich nicht übertragen: ${error.message}`);
  }
  return {
    format,
    finished,
    palette: converter.palette,
    stats: {
      formatLabel: FORMAT_LABELS[format], version: null, dataVersion: null, sourceSize: [...volume.size], regions: 1, regionList: null,
      entities: 0, blockEntities: 0, title: null, author: null, compression: 'none', unpackedBytes: bytes.length, model: modelStats, ...converter.summary(),
    },
  };
}

// Nur genutzte Zustände behalten (Paletten aus dem Netz enthalten oft ungenutzte Einträge); Indizes umschreiben.
function compactPalette(parts, palette) {
  const remap = new Int32Array(palette.length).fill(-1);
  const used = ['air'];
  remap[0] = 0;
  for (const part of parts) {
    const { blocks } = part;
    for (let o = 3; o < blocks.length; o += 4) {
      const old = blocks[o];
      if (remap[old] < 0) {
        remap[old] = used.length;
        used.push(palette[old]);
      }
      blocks[o] = remap[old];
    }
  }
  return used;
}

/**
 * Liest eine hochgeladene Datei. options:
 *   format   'schem' | 'litematic' | 'nbt' | 'vox' | 'stl' | 'obj' | 'glb' | 'gltf' (aus der Endung; der Inhalt entscheidet)
 *   name     Dateiname (nur Anzeige)
 *   data     ArrayBuffer oder Uint8Array
 *   params   Parameter für den Modell-Import (an modelToVolume durchgereicht; NBT-Formate ignorieren sie)
 *   onProgress(message, fraction|null)  optional
 *   loadBlockColors() → Promise<json>   nur für Modelle (game-data/block-colors.json)
 *   importVoxelizer() → Promise<Modul>  Standard: import('../voxelize/index.js')
 *   limits   Grenzen (Standard IMPORT_LIMITS; Tests setzen kleinere)
 * Ergebnis: ImportResult { format, declaredFormat, name, formatLabel, size, palette, parts, blockCount, warnings, stats }.
 * Fehler: ImportError (code + deutsche Meldung).
 */
export async function importFile({ format, name, data, params = {}, onProgress = null, loadBlockColors = null, importVoxelizer = null, limits = IMPORT_LIMITS } = {}) {
  const cleanName = cleanFileName(name);
  if (!UPLOAD_FORMATS.includes(format)) throw new ImportError('unknown-format', `Unbekanntes Dateiformat. ${SUPPORTED_TEXT}`);
  const bytes = toBytes(data);
  checkSize(bytes, limits);
  const warnings = [];
  const route = routeFormat(format, sniffContent(bytes), warnings, cleanName);
  const ctx = { limits, onProgress: typeof onProgress === 'function' ? onProgress : null, warnings, params, name: cleanName, loadBlockColors, importVoxelizer };
  const imported = route === 'nbt-family' ? await importNbtFamily(bytes, format, cleanName, ctx) : await importModel(bytes, route, ctx);
  const { finished, stats } = imported;
  const palette = compactPalette(finished.parts, imported.palette);
  return {
    format: imported.format,
    declaredFormat: format,
    name: cleanName,
    formatLabel: stats.formatLabel,
    size: finished.size,
    palette,
    parts: finished.parts,
    blockCount: finished.blockCount,
    warnings,
    stats: { ...stats, fileBytes: bytes.length, paletteSize: palette.length },
  };
}

/** ImportResult → BuildResult (Builder, raw, je Kapitel Ebenen); result.upload = Kennzahlen der Datei. */
export function importToBuildResult(imported, { onProgress = null } = {}) {
  onProgress?.(`Baue ${formatInt(imported.blockCount)} Blöcke …`, null);
  const b = new Builder({ seed: `upload-${imported.name}`, maxBlocks: IMPORT_LIMITS.maxBlocks, maxSize: IMPORT_LIMITS.maxEdge });
  const { palette } = imported;
  for (const part of imported.parts) {
    b.phase(part.title, part.text);
    const { blocks } = part;
    for (let o = 0; o < blocks.length; o += 4) b.set(blocks[o], blocks[o + 1], blocks[o + 2], palette[blocks[o + 3]], { raw: true });
  }
  const result = b.finalize();
  result.warnings.push(...imported.warnings);
  result.upload = {
    format: imported.format,
    declaredFormat: imported.declaredFormat,
    name: imported.name,
    formatLabel: imported.formatLabel,
    size: [...imported.size],
    blockCount: imported.blockCount,
    chapters: imported.parts.map((part) => part.title),
    ...imported.stats,
  };
  return result;
}
