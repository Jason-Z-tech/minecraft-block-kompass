// Chunk-Meshing (ARCHITEKTUR §7.2): reine Funktionen, in Browser, Worker und Node lauffähig.
// Vertex-Format 24 Byte (little-endian), 4 Vertices pro Quad, gemeinsamer Index-Puffer 0,1,2, 0,2,3:
//   0–5   3×int16  Position chunk-lokal × 256 (überstehende Modelle reichen unter 0 bzw. über 4096)
//   6–7   uint16   Textur-Ebene
//   8–11  2×uint16 UV in 1/64 Texel (16 Texel = 1024, Kacheln wiederholen sich)
//   12–14 3×uint8  Tönung RGB (255,255,255 = keine)
//   15    uint8    Licht = Schattierung × AO (0 … 255)
//   16–17 uint16   show   18–19 uint16 hide (65535 = nie)
//   20    uint8    Bit 0 leuchtend, Bits 4–7 Block-y im Chunk   21–23 reserviert (0)

import { chunkKey } from '../core/volume.js';
import { FACE_AXES, DIRECTIONS, SHADE, CULL_SAME, CULL_SAME_VERTICAL } from './block-models.js';
import { fluidFaces, fluidHeight, averageCornerHeight, FLUID_TEXTURES } from './special-models.js';

export const VERTEX_BYTES = 24;
export const QUAD_BYTES = VERTEX_BYTES * 4;
export const POSITION_SCALE = 256;
export const UV_SCALE = 64;
export const HIDE_NEVER = 65535;
export const AO_LEVELS = Object.freeze([0.45, 0.65, 0.82, 1.0]);
export const LAYER_NAMES = Object.freeze(['solid', 'cutout', 'translucent']);

if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
  throw new Error('mesher.js braucht ein little-endian-System (Vertex-Format laut ARCHITEKTUR §7.2).');
}

// ------------------------------------------------------------------ Gepolstertes Nachbarfeld (18³)

const PAD = 18;
const PAD_AREA = PAD * PAD;
const AXIS_OFFSET = [1, PAD_AREA, PAD]; // x, y, z
const DIR_OFFSET = [-PAD_AREA, PAD_AREA, -PAD, PAD, -1, 1];
const OPPOSITE = [1, 0, 3, 2, 5, 4];
const UP = 1;
const T1_OFFSET = FACE_AXES.map((axes) => AXIS_OFFSET[axes.t1]);
const T2_OFFSET = FACE_AXES.map((axes) => AXIS_OFFSET[axes.t2]);
const SHADE_LIGHT = DIRECTIONS.map((dir) => Math.round(SHADE[dir] * 255));
const CHUNK_MIN = -1024;
const CHUNK_MAX = 1023;

const padIndex = (lx, ly, lz) => ((ly + 1) * PAD + (lz + 1)) * PAD + (lx + 1);

function createGrid() {
  return { blocks: new Uint16Array(PAD * PAD_AREA), steps: new Uint16Array(PAD * PAD_AREA) };
}

// Kopiert den Chunk und eine Lage seiner 26 Nachbarn in das Feld (Luft, wo nichts ist).
function fillGrid(grid, volume, cx, cy, cz) {
  const { blocks, steps } = grid;
  blocks.fill(0);
  for (let dcy = -1; dcy <= 1; dcy++) {
    for (let dcz = -1; dcz <= 1; dcz++) {
      for (let dcx = -1; dcx <= 1; dcx++) {
        const ncx = cx + dcx, ncy = cy + dcy, ncz = cz + dcz;
        if (ncx < CHUNK_MIN || ncx > CHUNK_MAX || ncy < CHUNK_MIN || ncy > CHUNK_MAX || ncz < CHUNK_MIN || ncz > CHUNK_MAX) continue;
        const chunk = volume.chunks.get(chunkKey(ncx, ncy, ncz));
        if (!chunk) continue;
        const x0 = dcx < 0 ? 15 : 0, x1 = dcx > 0 ? 1 : 16;
        const y0 = dcy < 0 ? 15 : 0, y1 = dcy > 0 ? 1 : 16;
        const z0 = dcz < 0 ? 15 : 0, z1 = dcz > 0 ? 1 : 16;
        for (let ly = y0; ly < y1; ly++) {
          for (let lz = z0; lz < z1; lz++) {
            const src = (ly * 16 + lz) * 16;
            const dst = ((ly + 1 + dcy * 16) * PAD + (lz + 1 + dcz * 16)) * PAD + 1 + dcx * 16;
            for (let lx = x0; lx < x1; lx++) {
              blocks[dst + lx] = chunk.blocks[src + lx];
              steps[dst + lx] = chunk.steps[src + lx];
            }
          }
        }
      }
    }
  }
}

// ------------------------------------------------------------------ Paletten-Infos (gecacht je Volumen)

const TABLES = new WeakMap();
const STEP_INDEX = new WeakMap();

function checkContext(ctx) {
  if (!ctx || typeof ctx !== 'object' || !ctx.volume || !ctx.volume.chunks || !Array.isArray(ctx.volume.palette)) {
    throw new Error('Mesher: ctx braucht { volume: BlockVolume, models: BlockModels }.');
  }
  if (!ctx.models || typeof ctx.models.renderInfo !== 'function') throw new Error('Mesher: ctx.models fehlt (BlockModels).');
  if (!ctx.models.isBound) throw new Error('Mesher: Texturen sind nicht gebunden – zuerst models.bindTextures(map).');
}

function fluidMaterial(models, type) {
  const textures = FLUID_TEXTURES[type];
  const layerOf = (name) => (name ? models.textureLayer(name) : null);
  return {
    still: layerOf(textures.still), flow: layerOf(textures.flow), overlay: layerOf(textures.overlay),
    tint: textures.tint, emissive: textures.light > 0,
  };
}

function paletteTable(ctx) {
  const { volume, models } = ctx;
  let table = TABLES.get(volume);
  if (!table || table.models !== models || table.bindVersion !== models.bindVersion) {
    table = { models, bindVersion: models.bindVersion, infos: [null], aoOccluder: new Uint8Array(64), fluids: new Map() };
    TABLES.set(volume, table);
  }
  const palette = volume.palette;
  if (table.infos.length < palette.length) {
    if (table.aoOccluder.length < palette.length) {
      const grown = new Uint8Array(Math.max(palette.length, table.aoOccluder.length * 2));
      grown.set(table.aoOccluder);
      table.aoOccluder = grown;
    }
    for (let i = table.infos.length; i < palette.length; i++) {
      const info = models.renderInfo(palette[i]);
      table.infos.push(info);
      table.aoOccluder[i] = info.aoOccluder ? 1 : 0;
      if (info.fluid && !table.fluids.has(info.fluid.type)) table.fluids.set(info.fluid.type, fluidMaterial(models, info.fluid.type));
    }
  }
  return table;
}

// Nach Änderungen am Volumen (nach dem ersten Meshen) aufrufen, damit Schritt-Listen neu entstehen.
export function resetMeshCache(volume) {
  TABLES.delete(volume);
  STEP_INDEX.delete(volume);
}

// ------------------------------------------------------------------ Schreiber (wachsender Puffer)

class MeshWriter {
  constructor(withCenters) {
    this.withCenters = withCenters;
    this.quadCount = 0;
    this.capacity = 0;
    this.#grow(256);
  }

  #grow(minQuads) {
    const capacity = Math.max(minQuads, this.capacity * 2);
    const buffer = new ArrayBuffer(capacity * QUAD_BYTES);
    if (this.buffer) new Uint8Array(buffer).set(new Uint8Array(this.buffer, 0, this.quadCount * QUAD_BYTES));
    this.buffer = buffer;
    this.i16 = new Int16Array(buffer);
    this.u16 = new Uint16Array(buffer);
    this.u8 = new Uint8Array(buffer);
    if (this.withCenters) {
      const centers = new Float32Array(capacity * 16);
      if (this.centers) centers.set(this.centers.subarray(0, this.quadCount * 16));
      this.centers = centers;
    }
    this.capacity = capacity;
  }

  // Beginnt ein Quad, gibt den Vertex-Index des ersten Vertex zurück.
  begin() {
    if (this.quadCount >= this.capacity) this.#grow(this.quadCount + 1);
    return this.quadCount++ * 4;
  }

  vertex(vertexIndex, x, y, z, tex, u, v, tint, light, show, hide, flags) {
    const w = vertexIndex * 12;
    const px = Math.round(x * POSITION_SCALE), py = Math.round(y * POSITION_SCALE), pz = Math.round(z * POSITION_SCALE);
    const pu = Math.round(u * UV_SCALE), pv = Math.round(v * UV_SCALE);
    if (px < -32768 || px > 32767 || py < -32768 || py > 32767 || pz < -32768 || pz > 32767) throw new Error(`Mesher: Position (${x}, ${y}, ${z}) passt nicht ins Vertex-Format.`);
    if (pu < 0 || pu > 65535 || pv < 0 || pv > 65535) throw new Error(`Mesher: UV (${u}, ${v}) passt nicht ins Vertex-Format.`);
    this.i16[w] = px;
    this.i16[w + 1] = py;
    this.i16[w + 2] = pz;
    this.u16[w + 3] = tex;
    this.u16[w + 4] = pu;
    this.u16[w + 5] = pv;
    const b = w * 2;
    if (tint < 0) {
      this.u8[b + 12] = 255;
      this.u8[b + 13] = 255;
      this.u8[b + 14] = 255;
    } else {
      this.u8[b + 12] = (tint >> 16) & 255;
      this.u8[b + 13] = (tint >> 8) & 255;
      this.u8[b + 14] = tint & 255;
    }
    this.u8[b + 15] = light;
    this.u16[w + 8] = show;
    this.u16[w + 9] = hide;
    this.u8[b + 20] = flags;
  }

  center(vertexIndex, cx, cy, cz, order) {
    const c = vertexIndex * 4;
    this.centers[c] = cx;
    this.centers[c + 1] = cy;
    this.centers[c + 2] = cz;
    this.centers[c + 3] = order;
  }

  finish() {
    const data = { vertices: this.buffer.slice(0, this.quadCount * QUAD_BYTES), quadCount: this.quadCount };
    if (this.withCenters) data.centers = this.centers.slice(0, this.quadCount * 16);
    return data;
  }
}

function createWriters(withCenters) {
  return [new MeshWriter(withCenters), new MeshWriter(withCenters), new MeshWriter(withCenters)];
}

function finishWriters(writers) {
  return { solid: writers[0].finish(), cutout: writers[1].finish(), translucent: writers[2].finish() };
}

// ------------------------------------------------------------------ Greedy-Zellen (6 Richtungen × 16 Lagen × 16×16)

const CELL_COUNT = 6 * 16 * 256;
const cellGroup = new Array(CELL_COUNT).fill(null);
const cellAppearance = new Int32Array(CELL_COUNT);
const cellLight = new Uint8Array(CELL_COUNT);
const cellShow = new Uint16Array(CELL_COUNT);
const cellHide = new Uint16Array(CELL_COUNT);
const sliceUsed = new Uint8Array(96);

function cellIndex(dir, slice, t1, t2) {
  return ((dir * 16 + slice) * 16 + t2) * 16 + t1;
}

// Reste eines abgebrochenen Aufrufs (Fehler mitten im Meshen) entfernen.
function resetCells() {
  for (let ds = 0; ds < 96; ds++) {
    if (!sliceUsed[ds]) continue;
    sliceUsed[ds] = 0;
    cellAppearance.fill(0, ds * 256, ds * 256 + 256);
    cellGroup.fill(null, ds * 256, ds * 256 + 256);
  }
}

const LOCAL = [0, 0, 0];

function addCell(group, light, show, hide, lx, ly, lz) {
  const dir = group.dir;
  const axes = FACE_AXES[dir];
  LOCAL[0] = lx;
  LOCAL[1] = ly;
  LOCAL[2] = lz;
  const slice = LOCAL[axes.normal];
  const c = cellIndex(dir, slice, LOCAL[axes.t1], LOCAL[axes.t2]);
  cellGroup[c] = group;
  cellAppearance[c] = group.appearance;
  cellLight[c] = light;
  cellShow[c] = show;
  cellHide[c] = hide;
  sliceUsed[dir * 16 + slice] = 1;
}

function sameCell(a, b) {
  return cellAppearance[b] !== 0 && cellAppearance[a] === cellAppearance[b] && cellLight[a] === cellLight[b]
    && cellShow[a] === cellShow[b] && cellHide[a] === cellHide[b];
}

// Legt gleiche Zellen zu Rechtecken zusammen. Seitenflächen nur entlang einer Zeile (Block-y bleibt gleich).
function flushCells(writers, centerOf) {
  for (let ds = 0; ds < 96; ds++) {
    if (!sliceUsed[ds]) continue;
    sliceUsed[ds] = 0;
    const dir = ds >> 4;
    const slice = ds & 15;
    const vertical = dir === 0 || dir === 1;
    const base = ds * 256;
    for (let t2 = 0; t2 < 16; t2++) {
      for (let t1 = 0; t1 < 16; t1++) {
        const c = base + t2 * 16 + t1;
        if (cellAppearance[c] === 0) continue;
        let w = 1;
        while (t1 + w < 16 && sameCell(c, c + w)) w++;
        let h = 1;
        if (vertical) {
          grow: while (t2 + h < 16) {
            for (let k = 0; k < w; k++) if (!sameCell(c, c + h * 16 + k)) break grow;
            h++;
          }
        }
        emitRect(writers, cellGroup[c], dir, slice, t1, t2, w, h, cellLight[c], cellShow[c], cellHide[c], centerOf);
        for (let row = 0; row < h; row++) {
          for (let k = 0; k < w; k++) {
            const cell = c + row * 16 + k;
            cellAppearance[cell] = 0;
            cellGroup[cell] = null;
          }
        }
      }
    }
  }
}

const RECT_POS = [0, 0, 0];

function emitRect(writers, group, dir, slice, t1, t2, w, h, light, show, hide, centerOf) {
  const axes = FACE_AXES[dir];
  const blockY = vertical(dir) ? slice : t2;
  const plane = slice + (axes.positive ? 1 : 0);
  for (const q of group.quads) {
    const writer = writers[q.layerIndex];
    const first = writer.begin();
    const [u00, v00, duU, duV, dvU, dvV] = q.uvBase;
    let uShift = 0, vShift = 0;
    for (let k = 0; k < 4; k++) {
      const a = q.faceAB[k * 2] * w, b = q.faceAB[k * 2 + 1] * h;
      const u = u00 + a * duU + b * dvU, v = v00 + a * duV + b * dvV;
      if (u + uShift < 0) uShift = Math.ceil(-u / 16) * 16;
      if (v + vShift < 0) vShift = Math.ceil(-v / 16) * 16;
    }
    const flags = (q.emissive ? 1 : 0) | ((blockY & 15) << 4);
    for (let k = 0; k < 4; k++) {
      const a = q.faceAB[k * 2], b = q.faceAB[k * 2 + 1];
      RECT_POS[axes.normal] = plane;
      RECT_POS[axes.t1] = t1 + a * w;
      RECT_POS[axes.t2] = t2 + b * h;
      const u = u00 + a * w * duU + b * h * dvU + uShift;
      const v = v00 + a * w * duV + b * h * dvV + vShift;
      writer.vertex(first + k, RECT_POS[0], RECT_POS[1], RECT_POS[2], q.tex, u, v, q.tint, light, show, hide, flags);
    }
    if (centerOf) {
      LOCAL[axes.normal] = slice;
      LOCAL[axes.t1] = t1;
      LOCAL[axes.t2] = t2;
      const [cx, cy, cz] = centerOf(LOCAL[0], LOCAL[1], LOCAL[2]);
      for (let k = 0; k < 4; k++) writer.center(first + k, cx, cy, cz, 0);
    }
  }
}

function vertical(dir) {
  return dir === 0 || dir === 1;
}

// ------------------------------------------------------------------ Sichtbarkeit und Licht

function covers(cover, mask) {
  for (let i = 0; i < 8; i++) if ((mask[i] & ~cover[i]) !== 0) return false;
  return true;
}

// Verdeckt der Nachbar diese Fläche? (voller deckender Würfel, gleiche Art, oder deckende Gegenseite)
function occludes(info, quad, neighbor, dir) {
  if (neighbor.opaqueFull) return true;
  const rule = info.cullSame;
  if (rule !== 0 && neighbor.id === info.id) {
    if (rule === CULL_SAME) return true;
    if (dir < 2) return true;
    if (rule === CULL_SAME_VERTICAL) return false;
    return info.props[DIRECTIONS[dir]] === 'true' && neighbor.props[DIRECTIONS[OPPOSITE[dir]]] === 'true';
  }
  return quad.coverMask !== null && covers(neighbor.sideCover[OPPOSITE[dir]], quad.coverMask);
}

function aoLevel(side1, side2, corner) {
  return AO_LEVELS[side1 && side2 ? 0 : 3 - (side1 + side2 + corner)];
}

const CORNERS = new Float64Array(4); // (a,b) = (0,0), (1,0), (0,1), (1,1)

// AO der vier Blockecken der Fläche aus dem Endzustand (Seite1, Seite2, Ecke).
function cornerAo(grid, aoOccluder, dir, center) {
  const blocks = grid.blocks;
  const t1 = T1_OFFSET[dir], t2 = T2_OFFSET[dir];
  const s1n = aoOccluder[blocks[center - t1]], s1p = aoOccluder[blocks[center + t1]];
  const s2n = aoOccluder[blocks[center - t2]], s2p = aoOccluder[blocks[center + t2]];
  CORNERS[0] = aoLevel(s1n, s2n, aoOccluder[blocks[center - t1 - t2]]);
  CORNERS[1] = aoLevel(s1p, s2n, aoOccluder[blocks[center + t1 - t2]]);
  CORNERS[2] = aoLevel(s1n, s2p, aoOccluder[blocks[center - t1 + t2]]);
  CORNERS[3] = aoLevel(s1p, s2p, aoOccluder[blocks[center + t1 + t2]]);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Licht der vier Vertices (Schattierung × AO, bilinear zwischen den Blockecken).
function quadLights(state, quad, info, p, out) {
  const shade = quad.shadeValue;
  if (!state.ao || !info.ao || !quad.useAo) {
    const light = Math.round(shade * 255);
    out[0] = out[1] = out[2] = out[3] = light;
    return;
  }
  const dir = quad.dirIndex;
  cornerAo(state.grid, state.table.aoOccluder, dir, quad.boundary ? p + DIR_OFFSET[dir] : p);
  const axes = FACE_AXES[dir];
  const pos = quad.pos;
  for (let v = 0; v < 4; v++) {
    const a = clamp01(pos[v * 3 + axes.t1]), b = clamp01(pos[v * 3 + axes.t2]);
    const ao = (1 - a) * (1 - b) * CORNERS[0] + a * (1 - b) * CORNERS[1] + (1 - a) * b * CORNERS[2] + a * b * CORNERS[3];
    out[v] = Math.round(shade * ao * 255);
  }
}

const LIGHTS = new Uint8Array(4);

function emitQuad(writer, quad, lx, ly, lz, lights, show, hide, center) {
  const first = writer.begin();
  // Diagonale tauschen, wenn a00 + a11 < a01 + a10 (sonst Streifen im AO-Verlauf)
  const shift = lights[0] + lights[2] < lights[1] + lights[3] ? 1 : 0;
  const flags = (quad.emissive ? 1 : 0) | ((ly & 15) << 4);
  const pos = quad.pos, uv = quad.uv;
  for (let k = 0; k < 4; k++) {
    const v = (k + shift) & 3;
    writer.vertex(first + k, lx + pos[v * 3], ly + pos[v * 3 + 1], lz + pos[v * 3 + 2], quad.tex, uv[v * 2], uv[v * 2 + 1], quad.tint, lights[v], show, hide, flags);
    if (center) writer.center(first + k, center[0], center[1], center[2], center[3]);
  }
}

// ------------------------------------------------------------------ Blöcke

const MODE_CHUNK = 0;
const MODE_STEP = 1;
const MODE_CAP = 2;

// Gibt false zurück, wenn die Fläche nicht ausgegeben wird; sonst steht hide in state.hide.
function faceVisible(state, info, quad, p, step) {
  state.hide = HIDE_NEVER;
  const dir = quad.cullIndex;
  if (dir < 0) return state.mode !== MODE_CAP;
  const n = p + DIR_OFFSET[dir];
  const neighborIndex = state.grid.blocks[n];
  const hidden = neighborIndex !== 0 && occludes(info, quad, state.table.infos[neighborIndex], dir);
  if (state.mode === MODE_CAP) return hidden && dir === UP;
  if (!hidden) return true;
  const neighborStep = state.grid.steps[n];
  if (state.mode === MODE_STEP) return neighborStep >= step;
  if (neighborStep <= step) return false;
  state.hide = neighborStep;
  return true;
}

function emitBlock(state, info, p, lx, ly, lz, step, center) {
  const quads = info.quadsAt(state.ox + lx, state.oy + ly, state.oz + lz);
  const groups = quads.groups, leads = quads.leads;
  const merge = state.mode !== MODE_STEP;
  for (let i = 0; i < quads.length; i++) {
    const group = groups[i];
    if (group !== null && !leads[i]) continue;
    const quad = quads[i];
    if (state.mode === MODE_CAP && quad.cullIndex !== UP) continue;
    if (!faceVisible(state, info, quad, p, step)) continue;
    const hide = state.hide;
    if (state.mode === MODE_CAP) {
      LIGHTS[0] = LIGHTS[1] = LIGHTS[2] = LIGHTS[3] = Math.round(quad.shadeValue * 255);
    } else {
      quadLights(state, quad, info, p, LIGHTS);
    }
    if (group !== null) {
      const uniform = LIGHTS[0] === LIGHTS[1] && LIGHTS[0] === LIGHTS[2] && LIGHTS[0] === LIGHTS[3];
      if (merge && uniform) {
        addCell(group, LIGHTS[0], step, hide, lx, ly, lz);
        continue;
      }
      // Einzeln ausgeben; Licht je Mitglied, weil gedrehte Teile eine andere Vertex-Reihenfolge haben können
      for (const member of group.quads) {
        if (member !== quad && state.mode !== MODE_CAP) quadLights(state, member, info, p, LIGHTS);
        else if (member !== quad) LIGHTS[0] = LIGHTS[1] = LIGHTS[2] = LIGHTS[3] = Math.round(member.shadeValue * 255);
        emitQuad(state.writers[member.layerIndex], member, lx, ly, lz, LIGHTS, step, hide, center);
      }
      continue;
    }
    emitQuad(state.writers[quad.layerIndex], quad, lx, ly, lz, LIGHTS, step, hide, center);
  }
}

// ------------------------------------------------------------------ Flüssigkeiten

function sameFluid(table, index, type) {
  return index !== 0 && table.infos[index].fluid !== null && table.infos[index].fluid.type === type;
}

// Höhe eines Nachbarn wie LiquidBlockRenderer.getHeight (1 bei Flüssigkeit darüber, −1 = fester Block).
function neighborFluidHeight(state, n, type) {
  const { blocks } = state.grid;
  const index = blocks[n];
  if (sameFluid(state.table, index, type)) {
    return sameFluid(state.table, blocks[n + PAD_AREA], type) ? 1 : fluidHeight(state.table.infos[index].fluid.amount);
  }
  return index !== 0 && state.table.infos[index].solidForFluid ? -1 : 0;
}

const FLUID_FACES = { up: false, down: false, north: false, south: false, west: false, east: false };
const FLUID_OVERLAY = { north: false, south: false, west: false, east: false };
const FLUID_HIDE = new Uint16Array(6);

function emitFluid(state, info, p, lx, ly, lz, step, center) {
  const { table } = state;
  const { blocks, steps } = state.grid;
  const type = info.fluid.type;
  const material = table.fluids.get(type);
  const aboveSame = sameFluid(table, blocks[p + PAD_AREA], type);
  let heights;
  if (state.mode === MODE_CAP) {
    if (!aboveSame) return;
    heights = { nw: 1, ne: 1, se: 1, sw: 1 };
    for (const key in FLUID_FACES) FLUID_FACES[key] = key === 'up';
    FLUID_HIDE[UP] = HIDE_NEVER;
  } else {
    const own = aboveSame ? 1 : fluidHeight(info.fluid.amount);
    if (own >= 1) {
      heights = { nw: 1, ne: 1, se: 1, sw: 1 };
    } else {
      const north = neighborFluidHeight(state, p - PAD, type), south = neighborFluidHeight(state, p + PAD, type);
      const east = neighborFluidHeight(state, p + 1, type), west = neighborFluidHeight(state, p - 1, type);
      heights = {
        ne: averageCornerHeight(own, north, east, neighborFluidHeight(state, p - PAD + 1, type)),
        nw: averageCornerHeight(own, north, west, neighborFluidHeight(state, p - PAD - 1, type)),
        se: averageCornerHeight(own, south, east, neighborFluidHeight(state, p + PAD + 1, type)),
        sw: averageCornerHeight(own, south, west, neighborFluidHeight(state, p + PAD - 1, type)),
      };
    }
    for (let dir = 0; dir < 6; dir++) {
      const name = DIRECTIONS[dir];
      FLUID_HIDE[dir] = HIDE_NEVER;
      // Eigene volle Seite (z. B. wassergeflutete obere Stufe) verdeckt die Flüssigkeit
      if (info.fullSides & (1 << dir)) {
        FLUID_FACES[name] = false;
        continue;
      }
      const n = p + DIR_OFFSET[dir];
      const neighborIndex = blocks[n];
      let hidden = false;
      if (neighborIndex !== 0) {
        const neighbor = table.infos[neighborIndex];
        if (neighbor.fluid !== null && neighbor.fluid.type === type) hidden = true;
        else if (dir !== UP) hidden = neighbor.opaqueFull || (neighbor.fullSides & (1 << OPPOSITE[dir])) !== 0;
        if (dir >= 2) FLUID_OVERLAY[name] = type === 'water' && neighbor.glassLike;
      } else if (dir >= 2) {
        FLUID_OVERLAY[name] = false;
      }
      let visible = true;
      if (hidden) {
        const neighborStep = steps[n];
        if (state.mode === MODE_STEP) visible = neighborStep >= step;
        else if (neighborStep <= step) visible = false;
        else FLUID_HIDE[dir] = neighborStep;
      }
      FLUID_FACES[name] = visible;
    }
  }
  const faces = fluidFaces({ heights, faces: FLUID_FACES, overlay: FLUID_OVERLAY });
  for (const face of faces) {
    const dir = DIRECTIONS.indexOf(face.dir);
    const sprite = material[face.sprite];
    const writer = state.writers[sprite.layerIndex];
    const first = writer.begin();
    const light = SHADE_LIGHT[dir];
    const flags = (material.emissive ? 1 : 0) | ((ly & 15) << 4);
    for (let k = 0; k < 4; k++) {
      writer.vertex(first + k, lx + face.pos[k * 3], ly + face.pos[k * 3 + 1], lz + face.pos[k * 3 + 2], sprite.layer,
        face.uv[k * 2], face.uv[k * 2 + 1], material.tint, light, step, FLUID_HIDE[dir], flags);
      if (center) writer.center(first + k, center[0], center[1], center[2], center[3]);
    }
  }
}

// ------------------------------------------------------------------ Öffentliche Funktionen

function createState(ctx, mode, withCenters) {
  resetCells();
  return {
    mode, ao: ctx.ao !== false, table: paletteTable(ctx), grid: createGrid(), writers: createWriters(withCenters),
    ox: 0, oy: 0, oz: 0, hide: HIDE_NEVER,
  };
}

function setChunk(state, volume, cx, cy, cz) {
  state.ox = cx * 16;
  state.oy = cy * 16;
  state.oz = cz * 16;
  fillGrid(state.grid, volume, cx, cy, cz);
}

function checkChunkCoords(cx, cy, cz) {
  for (const c of [cx, cy, cz]) {
    if (!Number.isInteger(c) || c < CHUNK_MIN || c > CHUNK_MAX) throw new Error(`Ungültige Chunk-Koordinaten (${cx}, ${cy}, ${cz}).`);
  }
}

/**
 * Statisches Mesh eines Chunks: Flächen mit show (Schritt des Blocks) und hide (Schritt des verdeckenden
 * Nachbarn, 65535 = nie). Sichtbar im Viewer ⇔ show < cur && hide >= cur.
 * ctx = { volume, models, ao = true } → { solid, cutout, translucent } mit { vertices: ArrayBuffer, quadCount }.
 */
export function meshChunk(ctx, cx, cy, cz) {
  checkContext(ctx);
  checkChunkCoords(cx, cy, cz);
  const state = createState(ctx, MODE_CHUNK, false);
  const chunk = ctx.volume.chunks.get(chunkKey(cx, cy, cz));
  if (!chunk) return finishWriters(state.writers);
  setChunk(state, ctx.volume, cx, cy, cz);
  const { infos } = state.table;
  for (let ly = 0; ly < 16; ly++) {
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const li = (ly * 16 + lz) * 16 + lx;
        const index = chunk.blocks[li];
        if (index === 0) continue;
        const info = infos[index];
        const step = chunk.steps[li];
        const p = padIndex(lx, ly, lz);
        if (!info.invisible) emitBlock(state, info, p, lx, ly, lz, step, null);
        if (info.fluid !== null) emitFluid(state, info, p, lx, ly, lz, step, null);
      }
    }
  }
  flushCells(state.writers, null);
  return finishWriters(state.writers);
}

// Blöcke je Schritt: { positions: Int32Array [x,y,z,…] } (einmal pro Volumen aufgebaut).
function stepIndex(volume) {
  let index = STEP_INDEX.get(volume);
  if (index) return index;
  const counts = new Map();
  for (const chunk of volume.chunks.values()) {
    const { blocks, steps } = chunk;
    for (let i = 0; i < 4096; i++) if (blocks[i] !== 0) counts.set(steps[i], (counts.get(steps[i]) ?? 0) + 1);
  }
  index = new Map();
  const fill = new Map();
  for (const [step, count] of counts) {
    index.set(step, new Int32Array(count * 3));
    fill.set(step, 0);
  }
  for (const chunk of volume.chunkList()) {
    const { blocks, steps } = chunk;
    const bx = chunk.cx * 16, by = chunk.cy * 16, bz = chunk.cz * 16;
    for (let i = 0; i < 4096; i++) {
      if (blocks[i] === 0) continue;
      const step = steps[i];
      const at = fill.get(step);
      const list = index.get(step);
      list[at] = bx + (i & 15);
      list[at + 1] = by + (i >> 8);
      list[at + 2] = bz + ((i >> 4) & 15);
      fill.set(step, at + 3);
    }
  }
  STEP_INDEX.set(volume, index);
  return index;
}

/**
 * Blöcke des laufenden Schritts (alle Flächen, die mit den früheren Schritten sichtbar sind; Flächen zu
 * Nachbarn im selben Schritt bleiben für die Plopp-Animation). Positionen chunk-lokal zum Chunk des Blocks;
 * centers: 4 Float32 je Vertex (Blockmitte x, y, z in Weltkoordinaten, Reihenfolge 0 … 1 nach y, z, x).
 */
export function meshStep(ctx, step) {
  checkContext(ctx);
  if (!Number.isInteger(step) || step < 0 || step > 65534) throw new Error(`meshStep: Schritt muss 0 … 65534 sein (bekommen: ${step}).`);
  const state = createState(ctx, MODE_STEP, true);
  const list = stepIndex(ctx.volume).get(step);
  if (!list) return finishWriters(state.writers);
  const count = list.length / 3;
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => (
    list[a * 3 + 1] - list[b * 3 + 1] || list[a * 3 + 2] - list[b * 3 + 2] || list[a * 3] - list[b * 3]
  ));
  const rank = new Float32Array(count);
  order.forEach((item, position) => {
    rank[item] = count > 1 ? position / (count - 1) : 0;
  });
  // Nach Chunk gruppieren, damit jedes Nachbarfeld nur einmal gefüllt wird.
  const byChunk = new Map();
  for (let i = 0; i < count; i++) {
    const key = chunkKey(list[i * 3] >> 4, list[i * 3 + 1] >> 4, list[i * 3 + 2] >> 4);
    let items = byChunk.get(key);
    if (!items) byChunk.set(key, (items = []));
    items.push(i);
  }
  const { infos } = state.table;
  const center = new Float32Array(4);
  for (const items of [...byChunk.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1])) {
    const first = items[0];
    setChunk(state, ctx.volume, list[first * 3] >> 4, list[first * 3 + 1] >> 4, list[first * 3 + 2] >> 4);
    for (const i of items) {
      const x = list[i * 3], y = list[i * 3 + 1], z = list[i * 3 + 2];
      const lx = x & 15, ly = y & 15, lz = z & 15;
      const p = padIndex(lx, ly, lz);
      const info = infos[state.grid.blocks[p]];
      center[0] = x + 0.5;
      center[1] = y + 0.5;
      center[2] = z + 0.5;
      center[3] = rank[i];
      if (!info.invisible) emitBlock(state, info, p, lx, ly, lz, step, center);
      if (info.fluid !== null) emitFluid(state, info, p, lx, ly, lz, step, center);
    }
  }
  return finishWriters(state.writers);
}

/**
 * Deckflächen der Ebene y für die Schnittansicht: Oberseiten, die ein Block darüber (egal in welchem
 * Schritt) verdeckt, ohne AO; show = Schritt des Blocks, hide = nie. Flüssigkeiten unter gleicher Flüssigkeit
 * bekommen eine volle Oberfläche. Wie meshStep mit centers (Reihenfolge 0), damit derselbe Shader passt.
 */
export function meshCap(ctx, y) {
  checkContext(ctx);
  if (!Number.isInteger(y)) throw new Error(`meshCap: y muss eine ganze Zahl sein (bekommen: ${y}).`);
  const state = createState(ctx, MODE_CAP, true);
  const cy = y >> 4;
  const ly = y & 15;
  const { infos } = state.table;
  const center = new Float32Array(4);
  for (const chunk of ctx.volume.chunkList()) {
    if (chunk.cy !== cy) continue;
    setChunk(state, ctx.volume, chunk.cx, chunk.cy, chunk.cz);
    for (let lz = 0; lz < 16; lz++) {
      for (let lx = 0; lx < 16; lx++) {
        const li = (ly * 16 + lz) * 16 + lx;
        const index = chunk.blocks[li];
        if (index === 0) continue;
        const info = infos[index];
        const step = chunk.steps[li];
        const p = padIndex(lx, ly, lz);
        center[0] = state.ox + lx + 0.5;
        center[1] = y + 0.5;
        center[2] = state.oz + lz + 0.5;
        center[3] = 0;
        if (!info.invisible) emitBlock(state, info, p, lx, ly, lz, step, center);
        if (info.fluid !== null) emitFluid(state, info, p, lx, ly, lz, step, center);
      }
    }
    const ox = state.ox, oz = state.oz;
    flushCells(state.writers, (lx, ry, lz) => [ox + lx + 0.5, ry + state.oy + 0.5, oz + lz + 0.5]);
  }
  return finishWriters(state.writers);
}

// Gemeinsamer Index-Puffer für quadCount Quads (0,1,2, 0,2,3 je Quad, Uint32 – Chunks können > 16384 Quads haben).
export function createQuadIndices(quadCount) {
  if (!Number.isInteger(quadCount) || quadCount < 0) throw new Error(`createQuadIndices: ungültige Anzahl ${quadCount}.`);
  const indices = new Uint32Array(quadCount * 6);
  for (let q = 0; q < quadCount; q++) {
    const v = q * 4, i = q * 6;
    indices[i] = v;
    indices[i + 1] = v + 1;
    indices[i + 2] = v + 2;
    indices[i + 3] = v;
    indices[i + 4] = v + 2;
    indices[i + 5] = v + 3;
  }
  return indices;
}

// Liest einen Vertex zurück (für Tests und Fehlersuche).
export function decodeVertex(mesh, vertexIndex) {
  const view = new DataView(mesh.vertices, vertexIndex * VERTEX_BYTES, VERTEX_BYTES);
  const vertex = {
    x: view.getInt16(0, true) / POSITION_SCALE, y: view.getInt16(2, true) / POSITION_SCALE, z: view.getInt16(4, true) / POSITION_SCALE,
    tex: view.getUint16(6, true), u: view.getUint16(8, true) / UV_SCALE, v: view.getUint16(10, true) / UV_SCALE,
    tint: [view.getUint8(12), view.getUint8(13), view.getUint8(14)], light: view.getUint8(15),
    show: view.getUint16(16, true), hide: view.getUint16(18, true), emissive: (view.getUint8(20) & 1) === 1,
    blockY: view.getUint8(20) >> 4, reserved: [view.getUint8(21), view.getUint8(22), view.getUint8(23)],
  };
  if (mesh.centers) vertex.center = Array.from(mesh.centers.subarray(vertexIndex * 4, vertexIndex * 4 + 4));
  return vertex;
}
