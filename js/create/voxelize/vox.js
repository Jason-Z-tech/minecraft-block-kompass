// MagicaVoxel (.vox) lesen: SIZE/XYZI je Modell, Palette RGBA (fehlt sie: Standardpalette), Szene aus
// nTRN/nGRP/nSHP mit Drehung und Verschiebung (ausgeblendete Knoten und Ebenen fallen weg). Ohne Szene stehen
// mehrere Modelle nebeneinander. Koordinaten bleiben im vox-System (z = oben); die Umrechnung macht index.js.

import { ModelError, createWarnings, toBytes, LIMITS, formatCount } from './mesh.js';

const MAX_MODEL_SIDE = 2048;
const MAX_SCENE_DEPTH = 64;
const SIDE_BY_SIDE_GAP = 2;
// Zahlenschlüssel für Positionen (|Koordinate| < 65 536, Schlüssel < 2^51)
const KEY_RANGE = 65536;
const KEY_SPAN = 2 * KEY_RANGE;

/** Standardpalette von MagicaVoxel als 0xRRGGBB, Index = Farbnummer (0 unbenutzt). */
export const DEFAULT_VOX_PALETTE = (() => {
  const palette = new Uint32Array(256);
  const steps = [0xff, 0xcc, 0x99, 0x66, 0x33, 0x00];
  let index = 1;
  for (const r of steps) {
    for (const g of steps) {
      for (const b of steps) {
        if (r === 0 && g === 0 && b === 0) continue;
        palette[index++] = (r << 16) | (g << 8) | b;
      }
    }
  }
  const ramp = [0xee, 0xdd, 0xbb, 0xaa, 0x88, 0x77, 0x55, 0x44, 0x22, 0x11];
  for (const v of ramp) palette[index++] = v << 16;
  for (const v of ramp) palette[index++] = v << 8;
  for (const v of ramp) palette[index++] = v;
  for (const v of ramp) palette[index++] = (v << 16) | (v << 8) | v;
  return palette;
})();

class Reader {
  constructor(bytes, start, end) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = start;
    this.end = end;
  }

  need(n) {
    if (this.pos + n > this.end) throw new ModelError('Die .vox-Datei ist unvollständig oder beschädigt.');
  }

  int() {
    this.need(4);
    const value = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return value;
  }

  string() {
    const length = this.int();
    if (length < 0 || length > 65536) throw new ModelError('Die .vox-Datei ist beschädigt (ungültige Textlänge).');
    this.need(length);
    const text = new TextDecoder().decode(this.bytes.subarray(this.pos, this.pos + length));
    this.pos += length;
    return text;
  }

  dict() {
    const count = this.int();
    if (count < 0 || count > 4096) throw new ModelError('Die .vox-Datei ist beschädigt (ungültige Attributliste).');
    const out = {};
    for (let i = 0; i < count; i++) {
      const key = this.string();
      out[key] = this.string();
    }
    return out;
  }
}

/** Drehungs-Byte (_r) → 3×3-Matrix (Zeilen zuerst). */
export function voxRotation(byte) {
  const i0 = byte & 3;
  const i1 = (byte >> 2) & 3;
  if (i0 === 3 || i1 === 3 || i0 === i1) throw new ModelError(`Die .vox-Datei enthält eine ungültige Drehung (${byte}).`);
  const i2 = 3 - i0 - i1;
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  m[i0] = byte & 16 ? -1 : 1;
  m[3 + i1] = byte & 32 ? -1 : 1;
  m[6 + i2] = byte & 64 ? -1 : 1;
  return m;
}

function parseTranslation(text) {
  if (text === undefined) return [0, 0, 0];
  const parts = text.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || !parts.every(Number.isInteger)) throw new ModelError(`Die .vox-Datei enthält eine ungültige Verschiebung („${text.slice(0, 40)}“).`);
  return parts;
}

function readChunks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'VOX ') throw new ModelError('Das ist keine MagicaVoxel-Datei (Kennung „VOX “ fehlt).');
  const id = String.fromCharCode(...bytes.subarray(8, 12));
  if (id !== 'MAIN') throw new ModelError('Die .vox-Datei hat keinen MAIN-Abschnitt.');
  const mainContent = view.getInt32(12, true);
  const mainChildren = view.getInt32(16, true);
  const start = 20 + mainContent;
  const end = start + mainChildren;
  if (mainContent < 0 || mainChildren < 0 || end > bytes.length) throw new ModelError('Die .vox-Datei ist unvollständig.');
  const chunks = [];
  let pos = start;
  while (pos + 12 <= end) {
    const type = String.fromCharCode(...bytes.subarray(pos, pos + 4));
    const content = view.getInt32(pos + 4, true);
    const children = view.getInt32(pos + 8, true);
    if (content < 0 || children < 0 || pos + 12 + content + children > end) throw new ModelError(`Die .vox-Datei ist beschädigt (Abschnitt ${type}).`);
    chunks.push({ type, start: pos + 12, end: pos + 12 + content });
    pos += 12 + content + children;
  }
  return chunks;
}

/**
 * .vox-Bytes → { positions: Int32Array (x, y, z je Voxel, vox-Koordinaten, z oben), colors: Uint8Array (r, g, b),
 * count, models, warnings }. Doppelte Positionen (überlappende Modelle): das zuletzt gezeichnete gewinnt.
 */
export function parseVox(input) {
  const bytes = toBytes(input);
  const warnings = createWarnings();
  const chunks = readChunks(bytes);
  const models = [];
  let pendingSize = null;
  let palette = null;
  const nodes = new Map();
  const layers = new Map();
  for (const chunk of chunks) {
    const r = new Reader(bytes, chunk.start, chunk.end);
    if (chunk.type === 'SIZE') {
      pendingSize = [r.int(), r.int(), r.int()];
      if (!pendingSize.every((v) => v >= 1 && v <= MAX_MODEL_SIDE)) throw new ModelError(`Ein .vox-Modell hat eine ungültige Größe (${pendingSize.join(' × ')}).`);
    } else if (chunk.type === 'XYZI') {
      if (!pendingSize) throw new ModelError('Die .vox-Datei ist beschädigt (XYZI ohne SIZE).');
      if (models.length >= LIMITS.voxModels) throw new ModelError(`Die .vox-Datei hat mehr als ${LIMITS.voxModels} Modelle.`, { code: 'limit' });
      const count = r.int();
      if (count < 0 || count > LIMITS.blocks) throw new ModelError(`Ein .vox-Modell hat mehr als ${formatCount(LIMITS.blocks)} Voxel.`, { code: 'limit' });
      r.need(count * 4);
      const voxels = bytes.slice(r.pos, r.pos + count * 4);
      for (let i = 0; i < count; i++) {
        if (voxels[i * 4] >= pendingSize[0] || voxels[i * 4 + 1] >= pendingSize[1] || voxels[i * 4 + 2] >= pendingSize[2]) {
          throw new ModelError('Die .vox-Datei ist beschädigt (Voxel außerhalb der Modellgröße).');
        }
      }
      models.push({ size: pendingSize, voxels, count });
      pendingSize = null;
    } else if (chunk.type === 'RGBA') {
      r.need(1024);
      palette = new Uint32Array(256);
      // Farbnummer c (1 … 255) steht an Stelle c − 1
      for (let c = 1; c < 256; c++) {
        const o = r.pos + (c - 1) * 4;
        palette[c] = (bytes[o] << 16) | (bytes[o + 1] << 8) | bytes[o + 2];
      }
    } else if (chunk.type === 'nTRN') {
      const id = r.int();
      const attributes = r.dict();
      const child = r.int();
      r.int();
      const layer = r.int();
      const frameCount = r.int();
      const frame = frameCount > 0 ? r.dict() : {};
      nodes.set(id, { kind: 'transform', attributes, child, layer, frame });
    } else if (chunk.type === 'nGRP') {
      const id = r.int();
      const attributes = r.dict();
      const count = r.int();
      if (count < 0 || count > 65536) throw new ModelError('Die .vox-Datei ist beschädigt (Gruppe).');
      const children = [];
      for (let i = 0; i < count; i++) children.push(r.int());
      nodes.set(id, { kind: 'group', attributes, children });
    } else if (chunk.type === 'nSHP') {
      const id = r.int();
      const attributes = r.dict();
      const count = r.int();
      if (count < 0 || count > 65536) throw new ModelError('Die .vox-Datei ist beschädigt (Form).');
      const shapes = [];
      for (let i = 0; i < count; i++) {
        shapes.push(r.int());
        r.dict();
      }
      nodes.set(id, { kind: 'shape', attributes, models: shapes });
    } else if (chunk.type === 'LAYR') {
      const id = r.int();
      layers.set(id, r.dict());
    }
  }
  if (models.length === 0) throw new ModelError('Die .vox-Datei enthält kein Modell.');
  if (!palette) palette = DEFAULT_VOX_PALETTE;

  // Platzierungen: Szene oder nebeneinander
  const placements = [];
  if (nodes.has(0)) {
    const visit = (id, rotation, translation, depth) => {
      if (depth > MAX_SCENE_DEPTH) throw new ModelError('Die Szene der .vox-Datei ist zu tief verschachtelt oder bildet einen Kreis.');
      const node = nodes.get(id);
      if (!node) throw new ModelError(`Die .vox-Datei verweist auf den fehlenden Szenenknoten ${id}.`);
      if (node.attributes._hidden === '1') return;
      if (node.kind === 'transform') {
        if (layers.get(node.layer)?._hidden === '1') return;
        const local = node.frame._r !== undefined ? voxRotation(Number(node.frame._r)) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
        const t = parseTranslation(node.frame._t);
        const nextRotation = new Array(9);
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            nextRotation[row * 3 + col] = rotation[row * 3] * local[col] + rotation[row * 3 + 1] * local[3 + col] + rotation[row * 3 + 2] * local[6 + col];
          }
        }
        const nextTranslation = [0, 1, 2].map((row) => rotation[row * 3] * t[0] + rotation[row * 3 + 1] * t[1] + rotation[row * 3 + 2] * t[2] + translation[row]);
        visit(node.child, nextRotation, nextTranslation, depth + 1);
      } else if (node.kind === 'group') {
        for (const child of node.children) visit(child, rotation, translation, depth + 1);
      } else {
        for (const model of node.models) {
          if (!models[model]) throw new ModelError(`Die .vox-Datei verweist auf das fehlende Modell ${model}.`);
          placements.push({ model, rotation, translation });
        }
      }
    };
    visit(0, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0], 0);
  } else {
    let x = 0;
    models.forEach((model, index) => {
      // Mitte des Modells so setzen, dass die Modelle mit Abstand nebeneinander auf z = 0 stehen
      placements.push({ model: index, rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [x + Math.floor(model.size[0] / 2), Math.floor(model.size[1] / 2), Math.floor(model.size[2] / 2)] });
      x += model.size[0] + SIDE_BY_SIDE_GAP;
    });
    if (models.length > 1) warnings.add(`Die .vox-Datei hat ${models.length} Modelle ohne Szene – sie stehen nebeneinander.`);
  }
  if (placements.length === 0) throw new ModelError('In der .vox-Datei ist kein Modell sichtbar (alle ausgeblendet).');

  // Voxel einsammeln; doppelte Positionen: der spätere gewinnt
  const cells = new Map();
  for (const { model, rotation: m, translation: t } of placements) {
    const { size, voxels, count } = models[model];
    const hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    for (let i = 0; i < count; i++) {
      const cx = voxels[i * 4] + 0.5 - hx, cy = voxels[i * 4 + 1] + 0.5 - hy, cz = voxels[i * 4 + 2] + 0.5 - hz;
      const x = Math.floor(m[0] * cx + m[1] * cy + m[2] * cz + t[0]);
      const y = Math.floor(m[3] * cx + m[4] * cy + m[5] * cz + t[1]);
      const z = Math.floor(m[6] * cx + m[7] * cy + m[8] * cz + t[2]);
      if (Math.abs(x) >= KEY_RANGE || Math.abs(y) >= KEY_RANGE || Math.abs(z) >= KEY_RANGE) throw new ModelError('Die .vox-Szene ist zu weit verteilt.');
      cells.set(((x + KEY_RANGE) * KEY_SPAN + (y + KEY_RANGE)) * KEY_SPAN + (z + KEY_RANGE), palette[voxels[i * 4 + 3]]);
      if (cells.size > LIMITS.blocks) throw new ModelError(`Die .vox-Datei hat mehr als ${formatCount(LIMITS.blocks)} Voxel.`, { code: 'limit' });
    }
  }
  const positions = new Int32Array(cells.size * 3);
  const colors = new Uint8Array(cells.size * 3);
  let i = 0;
  for (const [key, color] of cells) {
    positions[i * 3] = Math.floor(key / (KEY_SPAN * KEY_SPAN)) - KEY_RANGE;
    positions[i * 3 + 1] = (Math.floor(key / KEY_SPAN) % KEY_SPAN) - KEY_RANGE;
    positions[i * 3 + 2] = (key % KEY_SPAN) - KEY_RANGE;
    colors[i * 3] = (color >> 16) & 255;
    colors[i * 3 + 1] = (color >> 8) & 255;
    colors[i * 3 + 2] = color & 255;
    i++;
  }
  return { positions, colors, count: cells.size, models: models.length, warnings: warnings.list };
}
