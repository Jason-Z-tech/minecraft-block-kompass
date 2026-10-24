// 3D-Modelle (STL, OBJ+MTL, GLB/glTF) und MagicaVoxel (.vox) → Minecraft-Blöcke (ARCHITEKTUR §12.3).
// Rein (keine DOM-Zugriffe), läuft im Worker und in Node. Vertrag:
//   modelToVolume(format, arrayBuffer, params, { blockColors, mtl?, decodeImage? })
//   → { size: [w, h, l], palette: ['air', zustand …], data: Uint16Array ((y·l + z)·w + x), warnings, stats }

import { parseStl } from './stl.js';
import { parseObj } from './obj.js';
import { parseGltf } from './gltf.js';
import { parseVox } from './vox.js';
import { voxelizeMesh, resolveUpAxis, fillInterior } from './voxelize.js';
import { createColorMatcher, PALETTE_SETS, normalizeBlockId } from './colors.js';
import { LIMITS, ModelError, toBytes, formatCount } from './mesh.js';

export { LIMITS, ModelError } from './mesh.js';
export { PALETTE_SETS } from './colors.js';

export const MODEL_FORMATS = Object.freeze(['stl', 'obj', 'glb', 'gltf', 'vox']);
export const UP_AXES = Object.freeze(['auto', 'y', 'z']);
export const DEFAULT_MESH_HEIGHT = 64;
const PARAM_KEYS = new Set(['height', 'solid', 'palette', 'block', 'upAxis']);
const EXTENSIONS = Object.freeze({ stl: 'stl', obj: 'obj', glb: 'glb', gltf: 'gltf', vox: 'vox' });

/** Format aus dem Dateinamen ('modell.STL' → 'stl'); unbekannt → null. */
export function formatFromFileName(name) {
  const match = /\.([a-z0-9]{2,5})$/i.exec(String(name ?? ''));
  return match ? EXTENSIONS[match[1].toLowerCase()] ?? null : null;
}

/** Prüft params und setzt Standardwerte. Wirft ModelError (code 'params') mit deutscher Meldung. */
export function normalizeParams(format, params = {}) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) throw new ModelError('Die Einstellungen müssen ein Objekt sein.', { code: 'params' });
  for (const key of Object.keys(params)) {
    if (!PARAM_KEYS.has(key)) throw new ModelError(`Unbekannte Einstellung „${key.slice(0, 30)}“ – erlaubt: ${[...PARAM_KEYS].join(', ')}.`, { code: 'params' });
  }
  const isVox = format === 'vox';
  let height = params.height;
  if (height === undefined || height === null) height = isVox ? null : DEFAULT_MESH_HEIGHT;
  else if (!Number.isInteger(height) || height < 1 || height > LIMITS.height) {
    throw new ModelError(`Die Höhe muss eine ganze Zahl von 1 bis ${LIMITS.height} Blöcken sein.`, { code: 'params' });
  }
  const solid = params.solid ?? false;
  if (typeof solid !== 'boolean') throw new ModelError('„solid“ muss true oder false sein.', { code: 'params' });
  const palette = params.palette ?? 'alle';
  if (!PALETTE_SETS.includes(palette)) throw new ModelError(`Unbekannte Palette „${String(palette).slice(0, 30)}“ – erlaubt: ${PALETTE_SETS.join(', ')}.`, { code: 'params' });
  let block = null;
  if (palette === 'einfarbig') {
    block = normalizeBlockId(params.block);
    if (!block) throw new ModelError('Für „einfarbig“ fehlt der Block (z. B. white_concrete).', { code: 'params' });
  } else if (params.block !== undefined && params.block !== null) {
    throw new ModelError('„block“ gilt nur zusammen mit der Palette „einfarbig“.', { code: 'params' });
  }
  const upAxis = params.upAxis ?? 'auto';
  if (!UP_AXES.includes(upAxis)) throw new ModelError(`Unbekannte Hochachse „${String(upAxis).slice(0, 20)}“ – erlaubt: ${UP_AXES.join(', ')}.`, { code: 'params' });
  return { height, solid, palette, block, upAxis };
}

/** Liest ein Modell (ohne Voxel): Mesh (siehe mesh.js) oder bei .vox { kind: 'voxels', … }. */
export async function parseModel(format, input, { mtl = null, decodeImage } = {}) {
  if (!MODEL_FORMATS.includes(format)) throw new ModelError(`Unbekanntes Format „${String(format).slice(0, 20)}“ – erlaubt: ${MODEL_FORMATS.join(', ')}.`, { code: 'format' });
  const bytes = toBytes(input);
  if (bytes.length === 0) throw new ModelError('Die Datei ist leer.');
  if (bytes.length > LIMITS.fileBytes) throw new ModelError(`Die Datei ist größer als ${LIMITS.fileBytes / 1024 / 1024} MB.`, { code: 'limit' });
  if (format === 'stl') return { kind: 'mesh', mesh: parseStl(bytes) };
  if (format === 'obj') return { kind: 'mesh', mesh: parseObj(bytes, { mtl }) };
  if (format === 'glb' || format === 'gltf') return { kind: 'mesh', mesh: await parseGltf(bytes, { format, ...(decodeImage ? { decodeImage } : {}) }) };
  return { kind: 'voxels', voxels: parseVox(bytes) };
}

// ------------------------------------------------------------------ .vox → Raster

function voxelGrid(voxels, { height, upAxis }) {
  const up = resolveUpAxis(upAxis, 'z');
  const n = voxels.count;
  const coords = new Int32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = voxels.positions[i * 3], y = voxels.positions[i * 3 + 1], z = voxels.positions[i * 3 + 2];
    // vox-z = Minecraft-y; rechtshändig: (x, y, z) → (x, z, −y)
    coords[i * 3] = x;
    coords[i * 3 + 1] = up === 'z' ? z : y;
    coords[i * 3 + 2] = up === 'z' ? -y : z;
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      if (coords[i * 3 + a] < min[a]) min[a] = coords[i * 3 + a];
      if (coords[i * 3 + a] > max[a]) max[a] = coords[i * 3 + a];
    }
  }
  const source = [0, 1, 2].map((a) => max[a] - min[a] + 1);
  const sourceCells = source[0] * source[1] * source[2];
  if (source.some((s) => s > LIMITS.edge) || sourceCells > LIMITS.cells) {
    throw new ModelError(`Die .vox-Szene ist mit ${source.join(' × ')} Voxeln zu weit verteilt.`, { code: 'limit' });
  }
  // Farben → Nummern (eine .vox hat höchstens 255 Farben)
  const colorIds = new Map();
  const colorList = [];
  const grid = new Uint16Array(sourceCells);
  for (let i = 0; i < n; i++) {
    const rgb = (voxels.colors[i * 3] << 16) | (voxels.colors[i * 3 + 1] << 8) | voxels.colors[i * 3 + 2];
    let id = colorIds.get(rgb);
    if (id === undefined) {
      id = colorList.length + 1;
      colorIds.set(rgb, id);
      colorList.push([voxels.colors[i * 3], voxels.colors[i * 3 + 1], voxels.colors[i * 3 + 2]]);
    }
    const x = coords[i * 3] - min[0], y = coords[i * 3 + 1] - min[1], z = coords[i * 3 + 2] - min[2];
    grid[(y * source[2] + z) * source[0] + x] = id;
  }
  if (height === null || height === source[1]) return { size: source, grid, colorList };
  // Nächster Nachbar auf die gewünschte Höhe
  const factor = height / source[1];
  const size = source.map((s, a) => (a === 1 ? height : Math.max(1, Math.round(s * factor))));
  const cells = size[0] * size[1] * size[2];
  if (size.some((s) => s > LIMITS.edge) || cells > LIMITS.cells) {
    throw new ModelError(`Das Ergebnis wäre ${size.join(' × ')} Blöcke groß – wähle eine kleinere Höhe.`, { code: 'limit' });
  }
  const scaled = new Uint16Array(cells);
  const pick = (v, a) => Math.min(source[a] - 1, Math.floor((v + 0.5) / factor));
  for (let y = 0; y < size[1]; y++) {
    const sy = pick(y, 1);
    for (let z = 0; z < size[2]; z++) {
      const sz = pick(z, 2);
      for (let x = 0; x < size[0]; x++) scaled[(y * size[2] + z) * size[0] + x] = grid[(sy * source[2] + sz) * source[0] + pick(x, 0)];
    }
  }
  return { size, grid: scaled, colorList };
}

// Außenraum per Flutfüllung von den Rändern (6er-Nachbarschaft); Rückgabe: Uint8Array, 1 = außen.
function exteriorMask(grid, size) {
  const [w, h, l] = size;
  const outside = new Uint8Array(grid.length);
  let queue = new Uint32Array(1 << 16);
  let head = 0, tail = 0;
  const push = (cell) => {
    if (grid[cell] || outside[cell]) return;
    outside[cell] = 1;
    if (tail === queue.length) {
      // Platz schaffen: verarbeitete Einträge entfernen, sonst vergrößern
      const pending = tail - head;
      if (pending * 2 <= queue.length) {
        queue.copyWithin(0, head, tail);
      } else {
        const next = new Uint32Array(queue.length * 2);
        next.set(queue.subarray(head, tail));
        queue = next;
      }
      head = 0;
      tail = pending;
    }
    queue[tail++] = cell;
  };
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++) {
        if (x === 0 || y === 0 || z === 0 || x === w - 1 || y === h - 1 || z === l - 1) push((y * l + z) * w + x);
      }
    }
  }
  while (head < tail) {
    const cell = queue[head++];
    const x = cell % w, z = Math.floor(cell / w) % l, y = Math.floor(cell / (w * l));
    if (x > 0) push(cell - 1);
    if (x < w - 1) push(cell + 1);
    if (z > 0) push(cell - w);
    if (z < l - 1) push(cell + w);
    if (y > 0) push(cell - w * l);
    if (y < h - 1) push(cell + w * l);
  }
  return outside;
}

// Seite eines Voxels nach freien Nachbarn: oben frei → 0, seitlich frei → 1, unten frei → 2, sonst 3 (alle)
function exposedFace(grid, size, x, y, z) {
  const [w, h, l] = size;
  const at = (xx, yy, zz) => (xx < 0 || yy < 0 || zz < 0 || xx >= w || yy >= h || zz >= l ? 0 : grid[(yy * l + zz) * w + xx]);
  if (!at(x, y + 1, z)) return 0;
  if (!at(x - 1, y, z) || !at(x + 1, y, z) || !at(x, y, z - 1) || !at(x, y, z + 1)) return 1;
  if (!at(x, y - 1, z)) return 2;
  return 3;
}

function voxelsToData(voxels, params, matcher) {
  const { size, grid, colorList } = voxelGrid(voxels, params);
  let filled = 0;
  if (params.solid) {
    const outside = exteriorMask(grid, size);
    const [w, , l] = size;
    filled = fillInterior(grid, size, (x, y, z) => !outside[(y * l + z) * w + x]);
  }
  const data = new Uint16Array(grid.length);
  const [w, h, l] = size;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++) {
        const cell = (y * l + z) * w + x;
        const id = grid[cell];
        if (!id) continue;
        const [r, g, b] = colorList[id - 1];
        data[cell] = matcher.match(r, g, b, exposedFace(grid, size, x, y, z)) + 1;
        count++;
      }
    }
  }
  if (count > LIMITS.blocks) {
    throw new ModelError(`Das Ergebnis hätte ${formatCount(count)} Blöcke – höchstens ${formatCount(LIMITS.blocks)}. Wähle eine kleinere Höhe oder baue hohl.`, { code: 'limit' });
  }
  return { size, data, filled };
}

// ------------------------------------------------------------------ Palette verdichten

// data enthält Kandidat + 1 → Palette ['air', Zustände nach Häufigkeit], data umgeschrieben auf Palettenindex.
function compactPalette(data, candidates) {
  const counts = new Uint32Array(candidates.length + 1);
  for (let i = 0; i < data.length; i++) counts[data[i]]++;
  const used = [];
  for (let c = 1; c < counts.length; c++) if (counts[c] > 0) used.push(c);
  used.sort((a, b) => counts[b] - counts[a] || (candidates[a - 1].state < candidates[b - 1].state ? -1 : 1));
  const remap = new Uint16Array(counts.length);
  used.forEach((c, i) => {
    remap[c] = i + 1;
  });
  for (let i = 0; i < data.length; i++) if (data[i]) data[i] = remap[data[i]];
  let voxels = 0;
  for (const c of used) voxels += counts[c];
  return { palette: ['air', ...used.map((c) => candidates[c - 1].state)], voxels };
}

/**
 * Modell → Blockvolumen.
 * format: 'stl' | 'obj' | 'glb' | 'gltf' | 'vox'; arrayBuffer: Dateiinhalt (ArrayBuffer oder Uint8Array).
 * params: { height (1 … 1024; Mesh-Standard 64, .vox-Standard null = Originalgröße), solid (false),
 *           palette ('alle' | 'beton' | 'wolle' | 'terrakotta' | 'einfarbig'), block (nur einfarbig), upAxis ('auto' | 'y' | 'z') }.
 * Kontext: { blockColors (Inhalt von game-data/block-colors.json, Pflicht), mtl (zweite Datei zum OBJ),
 *            decodeImage (eigener Bild-Dekoder, sonst createImageBitmap bzw. in Node png.mjs),
 *            onProgress(meldung, anteil | null) (optional, Fehler darin werden gemeldet, nicht verschluckt) }.
 */
export async function modelToVolume(format, arrayBuffer, params, { blockColors, mtl = null, decodeImage, onProgress = null } = {}) {
  const started = Date.now();
  const clean = normalizeParams(format, params ?? {});
  createColorMatcher({ blockColors, set: clean.palette, block: clean.block });
  report(onProgress, 'Lese das Modell …');
  const model = await parseModel(format, arrayBuffer, { mtl, decodeImage });
  const result = volumeFromModel(model, clean, { blockColors, consume: true, onProgress });
  result.stats.ms = Date.now() - started;
  return result;
}

function report(onProgress, message) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress(message, null);
  } catch (error) {
    console.error('Voxel-Import: Fehler im Fortschritts-Rückruf', error);
  }
}

/**
 * Synchroner Teil von modelToVolume: gelesenes Modell (parseModel) → Blockvolumen (gleiche Rückgabe).
 * consume: true erlaubt, die Positionen des Meshes zu überschreiben (spart eine Kopie); sonst bleibt das Modell
 * unverändert und lässt sich mehrfach nutzen.
 */
export function volumeFromModel(model, params, { blockColors, consume = false, onProgress = null } = {}) {
  const started = Date.now();
  const clean = normalizeParams(model.kind === 'voxels' ? 'vox' : 'stl', params ?? {});
  const matcher = createColorMatcher({ blockColors, set: clean.palette, block: clean.block });
  const warnings = [];
  let result;
  let triangles = 0;
  if (model.kind === 'mesh') {
    const mesh = consume ? model.mesh : { ...model.mesh, positions: model.mesh.positions.slice() };
    warnings.push(...mesh.warnings);
    triangles = mesh.triangleCount;
    report(onProgress, clean.solid ? 'Lege die Oberfläche in Blöcke und fülle das Innere …' : 'Lege die Oberfläche in Blöcke …');
    result = voxelizeMesh(mesh, { height: clean.height, solid: clean.solid, upAxis: clean.upAxis, matcher });
    if (result.flat) warnings.push('Das Modell ist flach (keine Höhe) – die größte Seite bestimmt den Maßstab.');
    if (clean.solid && result.filled === 0) warnings.push('Beim Füllen wurde nichts ergänzt – das Modell ist offen oder schon voll.');
  } else if (model.kind === 'voxels') {
    warnings.push(...model.voxels.warnings);
    report(onProgress, 'Setze die Voxel in Blöcke um …');
    result = voxelsToData(model.voxels, clean, matcher);
  } else {
    throw new ModelError('volumeFromModel braucht das Ergebnis von parseModel.', { code: 'argument' });
  }
  const { palette, voxels } = compactPalette(result.data, matcher.candidates);
  return {
    size: result.size,
    palette,
    data: result.data,
    warnings,
    stats: { triangles, voxels, ms: Date.now() - started },
  };
}
