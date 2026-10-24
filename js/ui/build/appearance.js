// Aussehen von Blöcken für Material-Icons und den Ebenen-Plan: aus den echten Blockmodellen (models.json)
// und Texturen (textures.bin) des Spiels. Die Flächen einer Blickrichtung werden orthografisch auf ein
// kleines Bild gerastert (Draufsicht für den Plan; oben/Norden/Osten für isometrische Inventar-Icons).
// Ohne DOM-Zugriff beim Laden; die reinen Raster-Funktionen sind in Node testbar.
import { TextureStore, parseTextureName, renderBlockIcon, encodePng, createImage, cropImage } from '../../render/texture-store.js';
import { BlockModels } from '../../render/block-models.js';
import { FLUID_TEXTURES } from '../../render/special-models.js';
import { itemForState } from '../../core/materials.js';
import { loadJson } from '../data.js';
import { SITE_ROOT } from '../dom.js';

export const MODELS_PATH = 'game-data/models.json';
const ALPHA_SKIP = 26; // ≈ 0,1 wie der Alpha-Test für durchscheinende Flächen
const FACE_SIZE = 16;

/**
 * Blickrichtungen: Ebene (a, b) in 0 … 1 wie die Standard-UV der Fläche im Spiel, Tiefe (größer = näher am Auge).
 * up: von oben, Norden oben im Bild · north: von Norden, Osten links · east: von Osten, Süden links.
 */
export const FACE_VIEWS = Object.freeze({
  up: Object.freeze({ axis: 1, sign: 1, plane: (x, y, z) => [x, z], depth: (x, y) => y }),
  north: Object.freeze({ axis: 2, sign: -1, plane: (x, y) => [1 - x, 1 - y], depth: (x, y, z) => -z }),
  east: Object.freeze({ axis: 0, sign: 1, plane: (x, y, z) => [1 - z, 1 - y], depth: (x) => x }),
});

/** Quads, die in Blickrichtung zeigen, von hinten nach vorne sortiert. */
export function facingQuads(quads, view) {
  const list = [];
  for (const quad of quads) {
    const n = quad.normal;
    if (!n || n[view.axis] * view.sign < 0.5) continue;
    const p = quad.pos;
    let depth = 0;
    for (let v = 0; v < 4; v++) depth += view.depth(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
    list.push({ quad, depth: depth / 4 });
  }
  list.sort((a, b) => a.depth - b.depth);
  return list.map((entry) => entry.quad);
}

function multiplyTint(value, tint, shift) {
  return (value * ((tint >> shift) & 255)) / 255;
}

// Ein Dreieck mit baryzentrischer UV-Interpolation in das Bild zeichnen (Pixelmitten).
function rasterTriangle(out, size, pts, uvs, quad, sample) {
  const [ax, ay] = pts[0], [bx, by] = pts[1], [cx, cy] = pts[2];
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) return;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
  const tint = Number.isInteger(quad.tint) && quad.tint >= 0 ? quad.tint : -1;
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const x = px + 0.5, y = py + 0.5;
      const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area;
      const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const u = w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0];
      const v = w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1];
      const texel = sample(quad.texture, u, v);
      if (!texel || texel[3] < ALPHA_SKIP) continue;
      let [r, g, b] = texel;
      if (tint >= 0) {
        r = multiplyTint(r, tint, 16);
        g = multiplyTint(g, tint, 8);
        b = multiplyTint(b, tint, 0);
      }
      const a = texel[3] / 255;
      const o = (py * size + px) * 4;
      const da = out.data[o + 3] / 255;
      const outA = a + da * (1 - a);
      out.data[o] = Math.round((r * a + out.data[o] * da * (1 - a)) / outA);
      out.data[o + 1] = Math.round((g * a + out.data[o + 1] * da * (1 - a)) / outA);
      out.data[o + 2] = Math.round((b * a + out.data[o + 2] * da * (1 - a)) / outA);
      out.data[o + 3] = Math.round(outA * 255);
    }
  }
}

/**
 * Rastert die Flächen einer Blickrichtung (view aus FACE_VIEWS) auf ein Bild size×size (RGBA).
 * sample(texture, u, v) → [r, g, b, a] | null mit UV in Texeln 0 … 16 (wie im Modell).
 */
export function rasterizeFace(quads, view, size, sample, out = createImage(size, size)) {
  for (const quad of facingQuads(quads, view)) {
    const pts = [];
    const uvs = [];
    for (let v = 0; v < 4; v++) {
      const [a, b] = view.plane(quad.pos[v * 3], quad.pos[v * 3 + 1], quad.pos[v * 3 + 2]);
      pts.push([a * size, b * size]);
      uvs.push([quad.uv[v * 2], quad.uv[v * 2 + 1]]);
    }
    rasterTriangle(out, size, [pts[0], pts[1], pts[2]], [uvs[0], uvs[1], uvs[2]], quad, sample);
    rasterTriangle(out, size, [pts[0], pts[2], pts[3]], [uvs[0], uvs[2], uvs[3]], quad, sample);
  }
  return out;
}

export function imageHasPixels(image) {
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] >= ALPHA_SKIP) return true;
  return false;
}

/** Anteil sichtbarer Pixel (0 … 1). */
export function coverage(image) {
  let visible = 0;
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] >= ALPHA_SKIP) visible++;
  return visible / (image.width * image.height);
}

// Unter diesem Anteil wirkt ein isometrisches Icon leer (Fackeln, Knöpfe): dann das Texturbild flach zeigen
export const THIN_ICON_COVERAGE = 0.2;

/** Höhe (0 … 1] der Oberkante aller Flächen – für Stufen, Teppiche usw. im isometrischen Icon. */
export function topHeight(quads) {
  let top = 0;
  for (const quad of quads) for (let v = 0; v < 4; v++) top = Math.max(top, quad.pos[v * 3 + 1]);
  return Math.min(1, Math.max(1 / 16, top || 1));
}

/** Ganzes Texturbild mittig auf eine Fläche zeichnen (Ersatz für Pflanzen ohne waagrechte Flächen). */
export function spriteImage(texture, size, sample, scale = 0.8) {
  const out = createImage(size, size);
  const span = size * scale;
  const start = (size - span) / 2;
  const quad = {
    texture, tint: -1, normal: [0, 1, 0],
    pos: [start / size, 1, start / size, start / size, 1, (start + span) / size, (start + span) / size, 1, (start + span) / size, (start + span) / size, 1, start / size],
    uv: [0, 0, 0, 16, 16, 16, 16, 0],
  };
  return rasterizeFace([quad], FACE_VIEWS.up, size, sample, out);
}

/** Gegenstand → ein Zustand der Palette, der ihn liefert (für Icons von Blöcken ohne eigenes Item-Bild). */
export function statesByItem(palette) {
  const map = new Map();
  for (const state of palette) {
    if (state === 'air') continue;
    let entry = null;
    try {
      entry = itemForState(state);
    } catch (error) {
      console.warn(`[Block-Kompass] Gegenstand zu „${state}“ unbekannt:`, error);
    }
    if (entry && !map.has(entry.item)) map.set(entry.item, state);
  }
  return map;
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function imageToDataUrl(image) {
  return `data:image/png;base64,${toBase64(await encodePng(image))}`;
}

/**
 * Lädt Texturen und Blockmodelle (einmal je Seite) und liefert Icons und Draufsicht-Kacheln.
 * Alle Methoden sind asynchron, weil Texturen erst beim ersten Gebrauch dekodiert werden.
 */
export class Appearance {
  #store;
  #models;
  #bound = new Set();
  #frames = new Map();
  #tiles = new Map();
  #icons = new Map();

  constructor(store, models) {
    this.#store = store;
    this.#models = models;
  }

  static async load({ root = SITE_ROOT } = {}) {
    const [store, modelsJson] = await Promise.all([
      TextureStore.load(new URL('game-data/', root).href),
      loadJson(MODELS_PATH, { root, timeoutMs: 60000 }),
    ]);
    return new Appearance(store, new BlockModels(modelsJson, null));
  }

  get store() { return this.#store; }

  // Texturnamen der Zustände binden (Ebenen-Nummern sind hier egal, es wird nur die Geometrie gebraucht)
  #bind(states) {
    const fresh = states.filter((state) => state !== 'air' && !this.#bound.has(state));
    if (fresh.length === 0) return;
    for (const state of fresh) this.#bound.add(state);
    const names = this.#models.textureNames([...this.#bound]);
    const map = new Map();
    let layer = 0;
    for (const name of names) map.set(name, { layer: layer++ % 65535, alpha: 'opaque' });
    this.#models.bindTextures(map);
  }

  /** Quads eines Zustands (blocklokal 0 … 1). Unbekannte Zustände → leere Liste (mit Warnung). */
  quadsFor(state) {
    this.#bind([state]);
    try {
      return this.#models.quads(state, 0, 0, 0);
    } catch (error) {
      console.warn(`[Block-Kompass] Kein Modell für „${state}“:`, error);
      return [];
    }
  }

  prepareStates(states) {
    this.#bind(states);
  }

  async #frame(name) {
    let promise = this.#frames.get(name);
    if (!promise) {
      promise = this.#loadFrame(name);
      this.#frames.set(name, promise);
    }
    return promise;
  }

  async #loadFrame(name) {
    const parsed = parseTextureName(name);
    const info = this.#store.info(name);
    if (parsed.kind === 'invalid' || parsed.kind === 'missing' || !info) return null;
    const image = await this.#store.image(parsed.texture);
    const frame = cropImage(image, 0, 0, info.frameWidth, info.frameHeight);
    return parsed.kind === 'region' ? cropImage(frame, parsed.x, parsed.y, parsed.w, parsed.h) : frame;
  }

  async #sampler(names) {
    const frames = new Map();
    await Promise.all([...new Set(names)].map(async (name) => {
      try {
        frames.set(name, await this.#frame(name));
      } catch (error) {
        console.warn(`[Block-Kompass] Textur „${name}“ für die Vorschau nicht lesbar:`, error);
        frames.set(name, null);
      }
    }));
    return (name, u, v) => {
      const image = frames.get(name);
      if (!image) return null;
      const x = ((Math.floor((u / 16) * image.width) % image.width) + image.width) % image.width;
      const y = ((Math.floor((v / 16) * image.height) % image.height) + image.height) % image.height;
      const o = (y * image.width + x) * 4;
      return [image.data[o], image.data[o + 1], image.data[o + 2], image.data[o + 3]];
    };
  }

  #fluidQuad(state) {
    let fluid = null;
    try {
      fluid = this.#models.fluidOf(state);
    } catch (error) {
      console.warn(`[Block-Kompass] Flüssigkeit von „${state}“ unklar:`, error);
    }
    if (!fluid) return null;
    const textures = FLUID_TEXTURES[fluid.type];
    const h = fluid.falling || fluid.amount >= 8 ? 14 / 16 : (fluid.amount / 8) * (14 / 16);
    return { texture: textures.still, tint: textures.tint, normal: [0, 1, 0], pos: [0, h, 0, 0, h, 1, 1, h, 1, 1, h, 0], uv: [0, 0, 0, 16, 16, 16, 16, 0] };
  }

  /** Draufsicht eines Zustands als RGBA-Bild size×size (für den Ebenen-Plan). */
  async topTile(state, size = FACE_SIZE) {
    const key = `${state}|${size}`;
    let promise = this.#tiles.get(key);
    if (!promise) {
      promise = this.#buildTile(state, size);
      this.#tiles.set(key, promise);
    }
    return promise;
  }

  async #buildTile(state, size) {
    const quads = this.quadsFor(state);
    const fluid = this.#fluidQuad(state);
    const all = fluid ? [fluid, ...quads] : quads;
    if (all.length === 0) return createImage(size, size);
    const sample = await this.#sampler(all.map((quad) => quad.texture));
    const image = rasterizeFace(all, FACE_VIEWS.up, size, sample);
    // Pflanzen, Leitern usw. haben keine Fläche nach oben: ihr Bild verkleinert in die Mitte
    return imageHasPixels(image) ? image : spriteImage(all[0].texture, size, sample);
  }

  /**
   * Icon eines Gegenstands als data:-URL (PNG): Item-Bild des Spiels, sonst isometrisch aus den Flächen des
   * Blocks (state = Zustand aus dem Bau), sonst das Texturbild flach. null, wenn nichts zu zeigen ist.
   */
  async iconUrl(item, state = null, size = 64) {
    const key = `${item}|${state ?? ''}|${size}`;
    let promise = this.#icons.get(key);
    if (!promise) {
      promise = this.#buildIcon(item, state, size).catch((error) => {
        console.warn(`[Block-Kompass] Kein Icon für „${item}“:`, error);
        return null;
      });
      this.#icons.set(key, promise);
    }
    return promise;
  }

  async #buildIcon(item, state, size) {
    if (this.#store.has(`item/${item}`)) return this.#store.iconDataUrl(item, null, { size });
    const quads = state ? this.quadsFor(state) : [];
    const fluid = state ? this.#fluidQuad(state) : null;
    const all = fluid && quads.length === 0 ? [fluid] : quads;
    if (all.length === 0) return this.#store.has(`block/${item}`) ? this.#store.iconDataUrl(item, null, { size }) : null;
    const sample = await this.#sampler(all.map((quad) => quad.texture));
    const faces = {};
    let best = 0;
    for (const key of ['up', 'north', 'east']) {
      faces[key] = rasterizeFace(all, FACE_VIEWS[key], FACE_SIZE, sample);
      best = Math.max(best, coverage(faces[key]));
    }
    if (best < THIN_ICON_COVERAGE) return imageToDataUrl(renderFlat(spriteImage(all[0].texture, FACE_SIZE, sample, 1), size));
    const layers = Object.fromEntries(Object.entries(faces).map(([key, image]) => [key, [{ image, tint: -1 }]]));
    return imageToDataUrl(renderBlockIcon(layers, size, { height: topHeight(all) }));
  }
}

// Kleines Bild pixelgenau vergrößern
function renderFlat(image, size) {
  const out = createImage(size, size);
  for (let y = 0; y < size; y++) {
    const sy = Math.floor((y * image.height) / size);
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x * image.width) / size);
      const s = (sy * image.width + sx) * 4, o = (y * size + x) * 4;
      out.data.set(image.data.subarray(s, s + 4), o);
    }
  }
  return out;
}
