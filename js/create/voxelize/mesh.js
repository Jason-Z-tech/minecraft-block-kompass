// Gemeinsame Bausteine der Modell-Parser (ARCHITEKTUR §12.3): Grenzen, Fehlerklasse und ein wachsender
// Dreiecks-Speicher. Ein Mesh ist immer „nicht indiziert“ (drei eigene Ecken je Dreieck):
// {
//   positions: Float32Array (9 je Dreieck), uvs: Float32Array (6 je Dreieck) | null,
//   colors: Float32Array (9 je Dreieck, lineares RGB 0 … 1) | null, triMaterial: Uint16Array (je Dreieck),
//   materials: [{ name, color: [r, g, b] linear 0 … 1, texture: { width, height, data (RGBA, sRGB), wrapS, wrapT } | null }],
//   upAxis: 'y' | 'z' (übliche Hochachse des Formats), triangleCount, warnings: []
// }

export const LIMITS = Object.freeze({
  fileBytes: 64 * 1024 * 1024,
  triangles: 2_000_000,
  blocks: 3_000_000,
  // dichtes Ergebnis-Raster (Uint16Array): höchstens 64 Mio. Zellen = 128 MB
  cells: 64 * 1024 * 1024,
  edge: 4064,
  height: 1024,
  materials: 4096,
  textureSide: 8192,
  voxModels: 1024,
});

/** Ganze Zahl mit Punkten als Tausendertrennzeichen wie in der Oberfläche („3.000.000“), unabhängig von der Umgebung. */
export function formatCount(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Fehler mit verständlicher deutscher Meldung (für die Oberfläche). */
export class ModelError extends Error {
  constructor(message, { code = 'model', cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ModelError';
    this.code = code;
  }
}

/** Bytes aus ArrayBuffer oder einer Ansicht (ohne Kopie). */
export function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new ModelError('Die Modelldatei fehlt (erwartet wird ein ArrayBuffer).', { code: 'argument' });
}

const DEFAULT_SRGB = 200 / 255;
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** Grundfarbe ohne Materialangabe: helles Grau (sRGB 200). */
export const DEFAULT_COLOR = Object.freeze([srgbToLinear(DEFAULT_SRGB), srgbToLinear(DEFAULT_SRGB), srgbToLinear(DEFAULT_SRGB)]);
export { srgbToLinear };

/** Wachsender Speicher für Dreiecke; build() liefert das Mesh mit passgenauen Arrays. */
export class MeshBuilder {
  #positions = new Float32Array(9 * 1024);
  #uvs = null;
  #colors = null;
  #materials = new Uint16Array(1024);
  #count = 0;
  #limit;

  constructor({ limit = LIMITS.triangles } = {}) {
    this.#limit = limit;
  }

  get count() {
    return this.#count;
  }

  #grow(needed) {
    const capacity = this.#materials.length;
    if (needed <= capacity) return;
    const next = Math.max(needed, capacity * 2);
    const resize = (array, per) => {
      if (!array) return null;
      const bigger = new array.constructor(next * per);
      bigger.set(array);
      return bigger;
    };
    this.#positions = resize(this.#positions, 9);
    this.#uvs = resize(this.#uvs, 6);
    this.#colors = resize(this.#colors, 9);
    this.#materials = resize(this.#materials, 1);
  }

  #checkLimit() {
    if (this.#count >= this.#limit) {
      throw new ModelError(`Das Modell hat mehr als ${formatCount(this.#limit)} Dreiecke – vereinfache es (z. B. „Decimate“ in Blender).`, { code: 'limit' });
    }
  }

  /** Dreieck aus drei Ecken p (je [x, y, z]); uv je [u, v] oder null; color je [r, g, b] linear oder null. */
  add(p0, p1, p2, material = 0, uv = null, color = null) {
    this.#checkLimit();
    this.#grow(this.#count + 1);
    const t = this.#count;
    const pos = this.#positions;
    pos[t * 9] = p0[0]; pos[t * 9 + 1] = p0[1]; pos[t * 9 + 2] = p0[2];
    pos[t * 9 + 3] = p1[0]; pos[t * 9 + 4] = p1[1]; pos[t * 9 + 5] = p1[2];
    pos[t * 9 + 6] = p2[0]; pos[t * 9 + 7] = p2[1]; pos[t * 9 + 8] = p2[2];
    if (uv) {
      if (!this.#uvs) this.#uvs = new Float32Array(this.#materials.length * 6);
      this.#uvs.set(uv[0], t * 6);
      this.#uvs.set(uv[1], t * 6 + 2);
      this.#uvs.set(uv[2], t * 6 + 4);
    }
    if (color) {
      if (!this.#colors) {
        this.#colors = new Float32Array(this.#materials.length * 9);
        // frühere Dreiecke ohne Eckfarbe: weiß (Faktor 1)
        this.#colors.fill(1, 0, t * 9);
      }
      this.#colors.set(color[0], t * 9);
      this.#colors.set(color[1], t * 9 + 3);
      this.#colors.set(color[2], t * 9 + 6);
    } else if (this.#colors) {
      this.#colors.fill(1, t * 9, t * 9 + 9);
    }
    this.#materials[t] = material;
    this.#count++;
  }

  /** Schneller Weg für Dreiecke aus flachen Zahlen (x0, y0, z0, …, z2), ohne UV und Eckfarbe. */
  addFlat(x0, y0, z0, x1, y1, z1, x2, y2, z2, material = 0) {
    this.#checkLimit();
    this.#grow(this.#count + 1);
    const t = this.#count;
    const pos = this.#positions;
    pos[t * 9] = x0; pos[t * 9 + 1] = y0; pos[t * 9 + 2] = z0;
    pos[t * 9 + 3] = x1; pos[t * 9 + 4] = y1; pos[t * 9 + 5] = z1;
    pos[t * 9 + 6] = x2; pos[t * 9 + 7] = y2; pos[t * 9 + 8] = z2;
    if (this.#colors) this.#colors.fill(1, t * 9, t * 9 + 9);
    this.#materials[t] = material;
    this.#count++;
  }

  build({ materials, upAxis, warnings = [] }) {
    const n = this.#count;
    // UV nur behalten, wenn ein Material eine Textur hat
    const textured = materials.some((m) => m.texture);
    return {
      positions: this.#positions.slice(0, n * 9),
      uvs: this.#uvs && textured ? this.#uvs.slice(0, n * 6) : null,
      colors: this.#colors ? this.#colors.slice(0, n * 9) : null,
      triMaterial: this.#materials.slice(0, n),
      materials,
      upAxis,
      triangleCount: n,
      warnings,
    };
  }
}

/** Sammelt Warnungen ohne Wiederholungen (höchstens 50). */
export function createWarnings() {
  const list = [];
  const seen = new Set();
  return {
    list,
    add(message) {
      if (seen.has(message) || list.length >= 50) return;
      seen.add(message);
      list.push(message);
    },
  };
}

/** Text aus Bytes (UTF-8, BOM wird entfernt; ungültige Folgen werden ersetzt). */
export function decodeText(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^﻿/, '');
}
