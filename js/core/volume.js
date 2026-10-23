// BlockVolume: Blöcke in Chunks zu 16×16×16, Paletten-Indizes in Uint16Array (§6.1).
// Index im Chunk: (ly*16 + lz)*16 + lx. Erlaubte Koordinaten: −16384 … 16383 je Achse.

import { normalizeState, stateId, isAirId } from './blockstate.js';

export const CHUNK_SIZE = 16;
export const CHUNK_VOLUME = 4096;
export const COORD_MIN = -16384;
export const COORD_MAX = 16383;
export const MAX_PALETTE = 65535;
export const MAX_STEP = 65534; // 65535 ist reserviert („nie“)

export function chunkKey(cx, cy, cz) {
  return ((cx + 1024) * 2048 + (cy + 1024)) * 2048 + (cz + 1024);
}

function checkCoords(x, y, z) {
  if ((x | 0) !== x || (y | 0) !== y || (z | 0) !== z) {
    throw new Error(`Koordinaten müssen ganze Zahlen sein (bekommen: ${x}, ${y}, ${z}).`);
  }
  if (x < COORD_MIN || x > COORD_MAX || y < COORD_MIN || y > COORD_MAX || z < COORD_MIN || z > COORD_MAX) {
    throw new Error(`Koordinate außerhalb des Bereichs ${COORD_MIN} … ${COORD_MAX}: (${x}, ${y}, ${z}).`);
  }
}

function checkStep(step) {
  if (!Number.isInteger(step) || step < 0 || step > MAX_STEP) {
    throw new Error(`Schrittnummer muss eine ganze Zahl von 0 bis ${MAX_STEP} sein (bekommen: ${step}).`);
  }
}

function localIndex(x, y, z) {
  return (((y & 15) << 4) | (z & 15)) << 4 | (x & 15);
}

export class BlockVolume {
  palette = ['air'];
  chunks = new Map();
  #indexByState = new Map([['air', 0]]);
  #count = 0;
  #min = null;
  #max = null;
  #boundsDirty = false;
  #lastKey = -1;
  #lastChunk = null;

  paletteIndex(state) {
    const known = this.#indexByState.get(state);
    if (known !== undefined) return known;
    if (typeof state !== 'string') throw new Error('Blockzustand muss ein Text sein.');
    const normalized = normalizeState(state);
    let index = isAirId(stateId(normalized)) ? 0 : this.#indexByState.get(normalized);
    if (index === undefined) {
      if (this.palette.length >= MAX_PALETTE) throw new Error(`Zu viele verschiedene Blockzustände (höchstens ${MAX_PALETTE}).`);
      index = this.palette.length;
      this.palette.push(normalized);
      this.#indexByState.set(normalized, index);
    }
    this.#indexByState.set(state, index);
    return index;
  }

  #chunk(x, y, z, create) {
    const key = chunkKey(x >> 4, y >> 4, z >> 4);
    if (key === this.#lastKey) return this.#lastChunk;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      if (!create) return null;
      chunk = { cx: x >> 4, cy: y >> 4, cz: z >> 4, blocks: new Uint16Array(CHUNK_VOLUME), steps: new Uint16Array(CHUNK_VOLUME), count: 0 };
      this.chunks.set(key, chunk);
    }
    this.#lastKey = key;
    this.#lastChunk = chunk;
    return chunk;
  }

  #grow(x, y, z) {
    if (this.#boundsDirty) return;
    if (!this.#min) {
      this.#min = [x, y, z];
      this.#max = [x, y, z];
      return;
    }
    const min = this.#min;
    const max = this.#max;
    if (x < min[0]) min[0] = x; else if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; else if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; else if (z > max[2]) max[2] = z;
  }

  set(x, y, z, state, step = 0) {
    this.setIndex(x, y, z, this.paletteIndex(state), step);
  }

  // Schneller Weg mit fertigem Paletten-Index (0 = Luft entfernt).
  setIndex(x, y, z, index, step = 0) {
    checkCoords(x, y, z);
    if (!Number.isInteger(index) || index < 0 || index >= this.palette.length) {
      throw new Error(`Ungültiger Paletten-Index ${index}.`);
    }
    if (index === 0) {
      this.delete(x, y, z);
      return;
    }
    checkStep(step);
    const chunk = this.#chunk(x, y, z, true);
    const i = localIndex(x, y, z);
    if (chunk.blocks[i] === 0) {
      chunk.count++;
      this.#count++;
      this.#grow(x, y, z);
    }
    chunk.blocks[i] = index;
    chunk.steps[i] = step;
  }

  getIndex(x, y, z) {
    if ((x | 0) !== x || (y | 0) !== y || (z | 0) !== z) {
      throw new Error(`Koordinaten müssen ganze Zahlen sein (bekommen: ${x}, ${y}, ${z}).`);
    }
    if (x < COORD_MIN || x > COORD_MAX || y < COORD_MIN || y > COORD_MAX || z < COORD_MIN || z > COORD_MAX) return 0;
    const chunk = this.#chunk(x, y, z, false);
    return chunk ? chunk.blocks[localIndex(x, y, z)] : 0;
  }

  get(x, y, z) {
    return this.palette[this.getIndex(x, y, z)];
  }

  has(x, y, z) {
    return this.getIndex(x, y, z) !== 0;
  }

  // −1, wenn an der Stelle kein Block ist.
  getStep(x, y, z) {
    if (this.getIndex(x, y, z) === 0) return -1;
    return this.#chunk(x, y, z, false).steps[localIndex(x, y, z)];
  }

  // Gibt false zurück, wenn an der Stelle kein Block ist.
  setStep(x, y, z, step) {
    checkStep(step);
    if (this.getIndex(x, y, z) === 0) return false;
    this.#chunk(x, y, z, false).steps[localIndex(x, y, z)] = step;
    return true;
  }

  delete(x, y, z) {
    checkCoords(x, y, z);
    const chunk = this.#chunk(x, y, z, false);
    if (!chunk) return false;
    const i = localIndex(x, y, z);
    if (chunk.blocks[i] === 0) return false;
    chunk.blocks[i] = 0;
    chunk.steps[i] = 0;
    chunk.count--;
    this.#count--;
    if (chunk.count === 0) {
      this.chunks.delete(chunkKey(chunk.cx, chunk.cy, chunk.cz));
      this.#lastKey = -1;
      this.#lastChunk = null;
    }
    if (this.#min && !this.#boundsDirty) {
      const min = this.#min;
      const max = this.#max;
      if (x === min[0] || x === max[0] || y === min[1] || y === max[1] || z === min[2] || z === max[2]) this.#boundsDirty = true;
    }
    return true;
  }

  get count() {
    return this.#count;
  }

  #recomputeBounds() {
    let min = null;
    let max = null;
    for (const chunk of this.chunks.values()) {
      const { blocks } = chunk;
      const bx = chunk.cx * 16;
      const by = chunk.cy * 16;
      const bz = chunk.cz * 16;
      for (let i = 0; i < CHUNK_VOLUME; i++) {
        if (blocks[i] === 0) continue;
        const x = bx + (i & 15);
        const z = bz + ((i >> 4) & 15);
        const y = by + (i >> 8);
        if (!min) {
          min = [x, y, z];
          max = [x, y, z];
          continue;
        }
        if (x < min[0]) min[0] = x; else if (x > max[0]) max[0] = x;
        if (y < min[1]) min[1] = y; else if (y > max[1]) max[1] = y;
        if (z < min[2]) min[2] = z; else if (z > max[2]) max[2] = z;
      }
    }
    this.#min = min;
    this.#max = max;
    this.#boundsDirty = false;
  }

  get bounds() {
    if (this.#boundsDirty) this.#recomputeBounds();
    if (!this.#min || this.#count === 0) return null;
    return { min: [...this.#min], max: [...this.#max] };
  }

  // Chunks in fester Reihenfolge (nach Schlüssel), unabhängig von der Einfüge-Reihenfolge.
  chunkList() {
    return [...this.chunks.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
  }

  forEach(callback) {
    const palette = this.palette;
    for (const chunk of this.chunkList()) {
      const { blocks, steps } = chunk;
      const bx = chunk.cx * 16;
      const by = chunk.cy * 16;
      const bz = chunk.cz * 16;
      for (let i = 0; i < CHUNK_VOLUME; i++) {
        const index = blocks[i];
        if (index === 0) continue;
        callback(bx + (i & 15), by + (i >> 8), bz + ((i >> 4) & 15), palette[index], steps[i], index);
      }
    }
  }

  // Kopien der Arrays: das Volumen bleibt nutzbar, das Ergebnis kann per postMessage übertragen werden.
  toTransfer() {
    return {
      palette: [...this.palette],
      chunks: this.chunkList().map((chunk) => ({
        cx: chunk.cx, cy: chunk.cy, cz: chunk.cz, blocks: chunk.blocks.slice(), steps: chunk.steps.slice(),
      })),
      bounds: this.bounds,
    };
  }

  static transferList(obj) {
    return obj.chunks.flatMap((chunk) => [chunk.blocks.buffer, chunk.steps.buffer]);
  }

  // Übernimmt die Arrays aus obj (keine Kopie) und prüft sie.
  static fromTransfer(obj) {
    if (!obj || !Array.isArray(obj.palette) || obj.palette[0] !== 'air' || !Array.isArray(obj.chunks)) {
      throw new Error('Ungültige Volumen-Daten: palette (mit „air“ an Stelle 0) und chunks werden gebraucht.');
    }
    if (obj.palette.length > MAX_PALETTE || obj.palette.some((s) => typeof s !== 'string')) {
      throw new Error('Ungültige Volumen-Daten: Palette.');
    }
    const volume = new BlockVolume();
    volume.palette = [...obj.palette];
    volume.#indexByState = new Map();
    volume.palette.forEach((state, index) => {
      if (!volume.#indexByState.has(state)) volume.#indexByState.set(state, index);
    });
    for (const raw of obj.chunks) {
      const { cx, cy, cz, blocks, steps } = raw ?? {};
      const coordsOk = [cx, cy, cz].every((c) => Number.isInteger(c) && c >= -1024 && c <= 1023);
      if (!coordsOk || !(blocks instanceof Uint16Array) || !(steps instanceof Uint16Array) || blocks.length !== CHUNK_VOLUME || steps.length !== CHUNK_VOLUME) {
        throw new Error('Ungültige Volumen-Daten: Chunk-Format.');
      }
      const key = chunkKey(cx, cy, cz);
      if (volume.chunks.has(key)) throw new Error(`Ungültige Volumen-Daten: Chunk (${cx}, ${cy}, ${cz}) doppelt.`);
      let count = 0;
      for (let i = 0; i < CHUNK_VOLUME; i++) {
        const index = blocks[i];
        if (index >= volume.palette.length) throw new Error(`Ungültige Volumen-Daten: Paletten-Index ${index} fehlt.`);
        if (index !== 0) count++;
      }
      if (count === 0) continue;
      volume.chunks.set(key, { cx, cy, cz, blocks, steps, count });
      volume.#count += count;
    }
    volume.#boundsDirty = true;
    return volume;
  }
}
