// Blockmodelle zur Laufzeit (ARCHITEKTUR §7.1): Zustand → Quads aus game-data/models.json.
// Rechnet wie das Spiel (26.2): Varianten/Multipart, Modell-Drehung x/y in 90°-Schritten mit uvlock
// (BlockModelRotation, BlockMath.getFaceTransformation), Element-Drehung über die fertige Matrix,
// UV-Drehung der Flächen, Richtung gedrehter Flächen per calculateFacing, Render-Schicht pro Fläche aus
// der Alpha-Klasse ihres UV-Rechtecks (force_translucent → durchscheinend).
// Rein: kein DOM, kein WebGL – läuft in Browser, Worker und Node.

import { parseStateCached } from '../core/blockstate.js';
import { isBlockDataLoaded, defaultPropsFrozen } from '../core/block-data.js';
import { hashPosition } from '../core/random.js';
import { rectAlphaClass, ALPHA_CLASSES, MISSING_TEXTURE } from './texture-store.js';
import { tintColor, TINT_NONE } from './tints.js';
import { specialKind, specialQuads, keepsJsonModel, fluidOf, FLUID_TEXTURES } from './special-models.js';

export const DIRECTIONS = Object.freeze(['down', 'up', 'north', 'south', 'west', 'east']);
export const LAYERS = Object.freeze(['solid', 'cutout', 'translucent']);
// Schattierung wie im Spiel: min(nx²·0,6 + ny²·(3+ny)/4 + nz²·0,8, 1) für die Richtung der Fläche.
export const SHADE = Object.freeze({ down: 0.5, up: 1, north: 0.8, south: 0.8, west: 0.6, east: 0.6 });
// Ab dieser Lichtstärke gilt ein Block oder Element als leuchtend (Bit 0 im Vertex).
export const EMISSIVE_MIN_LIGHT = 3;

const DIR_INDEX = Object.freeze({ down: 0, up: 1, north: 2, south: 3, west: 4, east: 5 });
const DIR_NORMALS = Object.freeze([[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]]);
const SHADE_BY_INDEX = Object.freeze(DIRECTIONS.map((dir) => SHADE[dir]));
const LAYER_OF_ALPHA = Object.freeze({ opaque: 0, cutout: 1, translucent: 2 });
// Achse der Normalen und die beiden Tangenten-Achsen je Richtung (x = 0, y = 1, z = 2).
export const FACE_AXES = Object.freeze(DIRECTIONS.map((dir) => {
  if (dir === 'down' || dir === 'up') return Object.freeze({ normal: 1, t1: 0, t2: 2, positive: dir === 'up' });
  if (dir === 'north' || dir === 'south') return Object.freeze({ normal: 2, t1: 0, t2: 1, positive: dir === 'south' });
  return Object.freeze({ normal: 0, t1: 2, t2: 1, positive: dir === 'east' });
}));
const EPS = 1e-5;

// Gleiche Nachbarn verdecken sich (HalfTransparentBlock/IronBarsBlock/MangroveRootsBlock.skipRendering).
export const CULL_NONE = 0;
export const CULL_SAME = 1;
export const CULL_SAME_VERTICAL = 2;
export const CULL_PANE = 3;

function sameTypeRule(id) {
  if (id === 'glass' || id === 'tinted_glass' || id.endsWith('_stained_glass') || id === 'ice' || id === 'frosted_ice'
    || id === 'slime_block' || id === 'honey_block' || id === 'powder_snow' || id.endsWith('copper_grate') || id.endsWith('_leaves')) return CULL_SAME;
  if (id === 'glass_pane' || id.endsWith('_glass_pane') || id === 'iron_bars' || id.endsWith('copper_bars')) return CULL_PANE;
  if (id === 'mangrove_roots') return CULL_SAME_VERTICAL;
  return CULL_NONE;
}

// Nachbarn, an denen Wasser seine Overlay-Textur zeigt (HalfTransparentBlock, LeavesBlock).
function isGlassLike(id) {
  return id === 'glass' || id === 'tinted_glass' || id.endsWith('_stained_glass') || id === 'ice' || id === 'frosted_ice'
    || id === 'slime_block' || id === 'honey_block' || id.endsWith('copper_grate') || id.endsWith('_leaves');
}

// ------------------------------------------------------------------ Lichtstärke der Blöcke (wie Blocks in 26.2)

const FIXED_EMISSION = new Map(Object.entries({
  glowstone: 15, jack_o_lantern: 15, sea_lantern: 15, shroomlight: 15, beacon: 15, conduit: 15, end_gateway: 15,
  end_portal: 15, lava: 15, lava_cauldron: 15, fire: 15, lantern: 15, ochre_froglight: 15, verdant_froglight: 15,
  pearlescent_froglight: 15, torch: 14, wall_torch: 14, end_rod: 14, copper_torch: 14, copper_wall_torch: 14,
  nether_portal: 11, soul_fire: 10, soul_torch: 10, soul_wall_torch: 10, soul_lantern: 10, crying_obsidian: 10,
  enchanting_table: 7, ender_chest: 7, glow_lichen: 7, sculk_catalyst: 6, amethyst_cluster: 5, large_amethyst_bud: 4,
  magma_block: 3, medium_amethyst_bud: 2, firefly_bush: 2, small_amethyst_bud: 1, brewing_stand: 1,
  brown_mushroom: 1, dragon_egg: 1, end_portal_frame: 1, sculk_sensor: 1, calibrated_sculk_sensor: 1,
}));
const LIT_EMISSION = new Map(Object.entries({
  redstone_lamp: 15, campfire: 15, soul_campfire: 10, furnace: 13, blast_furnace: 13, smoker: 13,
  redstone_ore: 9, deepslate_redstone_ore: 9, redstone_torch: 7, redstone_wall_torch: 7,
}));
const COPPER_BULB_EMISSION = Object.freeze({ '': 15, exposed_: 12, weathered_: 8, oxidized_: 4 });
const TRIAL_SPAWNER_EMISSION = Object.freeze({ inactive: 0, waiting_for_players: 4, active: 8, waiting_for_reward_ejection: 8, ejecting_reward: 8, cooldown: 0 });

function intProp(props, key, fallback = 0) {
  const value = Number(props[key] ?? fallback);
  return Number.isInteger(value) ? value : fallback;
}

// Lichtstärke 0 … 15 eines Zustands (id + vollständige Eigenschaften).
export function blockLightEmission(id, props = {}) {
  const fixed = FIXED_EMISSION.get(id);
  if (fixed !== undefined) return fixed;
  if (id.endsWith('copper_lantern')) return 15;
  const lit = props.lit === 'true';
  if (LIT_EMISSION.has(id)) return lit ? LIT_EMISSION.get(id) : 0;
  if (id.endsWith('copper_bulb')) {
    const stage = id.replace(/^waxed_/, '').slice(0, -'copper_bulb'.length);
    return lit ? COPPER_BULB_EMISSION[stage] ?? 0 : 0;
  }
  if (id === 'candle' || id.endsWith('_candle')) return lit ? 3 * intProp(props, 'candles', 1) : 0;
  if (id.endsWith('candle_cake')) return lit ? 3 : 0;
  if (id === 'sea_pickle') return props.waterlogged === 'true' ? 3 + 3 * intProp(props, 'pickles', 1) : 0;
  if (id === 'respawn_anchor') return Math.floor((intProp(props, 'charges') / 4) * 15);
  if (id === 'light') return intProp(props, 'level', 15);
  if (id === 'cave_vines' || id === 'cave_vines_plant') return props.berries === 'true' ? 14 : 0;
  if (id === 'vault') return props.vault_state === 'inactive' ? 6 : 12;
  if (id === 'trial_spawner') return TRIAL_SPAWNER_EMISSION[props.trial_spawner_state] ?? 0;
  return 0;
}

// ------------------------------------------------------------------ 3×3-Matrizen (Zeilen zuerst)

const I3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

function mul3(a, b) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return out;
}

function transpose3(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

function apply3(m, x, y, z) {
  return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
}

// Exakte Drehung um eine Achse in 90°-Schritten (gegen den Uhrzeigersinn um die positive Achse).
function quarterRotation(axis, degrees) {
  const steps = ((Math.round(degrees / 90) % 4) + 4) % 4;
  const c = [1, 0, -1, 0][steps];
  const s = [0, 1, 0, -1][steps];
  if (axis === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

// BlockModelRotation: Quaternion rotateYXZ(−y, −x, −z) → erst um Z, dann X, dann Y.
function modelRotation(x, y, z) {
  return mul3(quarterRotation('y', -y), mul3(quarterRotation('x', -x), quarterRotation('z', -z)));
}

function isIdentity3(m) {
  return m.every((value, i) => value === I3[i]);
}

function nearestDirection(x, y, z) {
  const dots = [-y, y, -z, z, -x, x];
  let best = -1;
  let max = 0;
  for (let i = 0; i < 6; i++) {
    if (dots[i] >= 0 && dots[i] > max) {
      max = dots[i];
      best = i;
    }
  }
  return best < 0 ? DIR_INDEX.up : best;
}

function rotateDirection(m, dirIndex) {
  const [nx, ny, nz] = DIR_NORMALS[dirIndex];
  const [x, y, z] = apply3(m, nx, ny, nz);
  return nearestDirection(x, y, z);
}

// BlockMath.VANILLA_UV_TRANSFORM_LOCAL_TO_GLOBAL: Süd-Rahmen → Rahmen der Fläche.
const LOCAL_TO_GLOBAL = Object.freeze([
  quarterRotation('x', 90), // down
  quarterRotation('x', -90), // up
  quarterRotation('y', 180), // north
  I3, // south
  quarterRotation('y', -90), // west
  quarterRotation('y', 90), // east
]);

// UV-Lock wie BlockMath.getFaceTransformation, angewandt als inverse Flächen-Transformation pro Vertex
// (FaceBakery.bakeVertex): uv' = F⁻¹ · (uv − Mitte) + Mitte. Rückgabe 2×2 (Zeilen zuerst).
function uvLockMatrix(rotation, dirIndex) {
  const target = rotateDirection(rotation, dirIndex);
  const face = mul3(transpose3(LOCAL_TO_GLOBAL[target]), mul3(rotation, LOCAL_TO_GLOBAL[dirIndex]));
  const inverse = transpose3(face);
  return [inverse[0], inverse[1], inverse[3], inverse[4]];
}

// ------------------------------------------------------------------ Flächen-Eckpunkte wie FaceInfo

// Eckpunkt-Reihenfolge je Fläche (gegen den Uhrzeigersinn von außen): Werte 0 = from, 1 = to je Achse.
const FACE_CORNERS = Object.freeze([
  [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], // down
  [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], // up
  [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], // north
  [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], // south
  [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], // west
  [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], // east
]);

// BlockElementFace.getU/getV mit Quadrant.rotateVertexIndex.
function faceVertexUv(uv, rotation, vertex) {
  const j = (vertex + rotation / 90) % 4;
  return [j === 0 || j === 1 ? uv[0] : uv[2], j === 0 || j === 3 ? uv[1] : uv[3]];
}

function crossNormal(pos) {
  const ax = pos[0] - pos[3], ay = pos[1] - pos[4], az = pos[2] - pos[5];
  const bx = pos[6] - pos[3], by = pos[7] - pos[4], bz = pos[8] - pos[5];
  const nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
  const length = Math.hypot(nx, ny, nz);
  // „+ 0“ macht aus −0 eine 0
  return length > 0 ? [nx / length + 0, ny / length + 0, nz / length + 0] : [0, 1, 0];
}

function snap(value) {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Object.is(rounded, -0) ? 0 : rounded;
}

// ------------------------------------------------------------------ Bedingungen

function matchesVariant(when, props) {
  for (const key in when) if (props[key] !== when[key]) return false;
  return true;
}

function matchesCondition(condition, props) {
  if (condition === null || condition === undefined) return true;
  if (Array.isArray(condition.OR)) return condition.OR.some((inner) => matchesCondition(inner, props));
  if (Array.isArray(condition.AND)) return condition.AND.every((inner) => matchesCondition(inner, props));
  for (const key in condition) {
    const values = condition[key];
    if (!Array.isArray(values) || !values.includes(props[key])) return false;
  }
  return true;
}

// ------------------------------------------------------------------ Verdeckungs-Raster (16×16 je Seite)

const COVER_WORDS = 8;

function emptyCover() {
  return new Uint32Array(COVER_WORDS);
}

function setCells(mask, x0, x1, y0, y1) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const bit = y * 16 + x;
      mask[bit >> 5] |= 1 << (bit & 31);
    }
  }
}

function isFullCover(mask) {
  for (let i = 0; i < COVER_WORDS; i++) if (mask[i] !== 0xffffffff) return false;
  return true;
}

// Rechteck der Fläche auf der Ebene einer Seite, in 1/16-Zellen.
function projectedRect(pos, sideIndex) {
  const { t1, t2 } = FACE_AXES[sideIndex];
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (let i = 0; i < 4; i++) {
    const a = pos[i * 3 + t1] * 16, b = pos[i * 3 + t2] * 16;
    if (a < a0) a0 = a;
    if (a > a1) a1 = a;
    if (b < b0) b0 = b;
    if (b > b1) b1 = b;
  }
  return [a0, a1, b0, b1];
}

const clampCell = (value) => (value < 0 ? 0 : value > 16 ? 16 : value);

// ------------------------------------------------------------------ BlockModels

export class BlockModels {
  #textures;
  #models;
  #blocks;
  #blockDefaults;
  #binding = null;
  #bindVersion = 0;
  #warnings = [];
  #warningKeys = new Set();
  #infoCache = new Map();
  #geometryCache = new Map();
  #geometryPresence = new Map();
  #appearanceIds = new Map();

  /**
   * modelsJson: Inhalt von game-data/models.json. blockData: Inhalt von game-data/blocks.json (für
   * fehlende Eigenschaften) oder null – dann die geladenen Daten aus js/core/block-data.js, falls vorhanden.
   */
  constructor(modelsJson, blockData = null) {
    if (!modelsJson || typeof modelsJson !== 'object' || !Array.isArray(modelsJson.textures) || !Array.isArray(modelsJson.models)
      || !modelsJson.blocks || typeof modelsJson.blocks !== 'object') {
      throw new Error('models.json hat nicht das erwartete Format ({ textures, models, blocks }).');
    }
    if (modelsJson.textures.some((name) => typeof name !== 'string')) throw new Error('models.json: „textures“ muss eine Liste von Namen sein.');
    if (modelsJson.models.some((model) => !model || !Array.isArray(model.elements))) throw new Error('models.json: jedes Modell braucht „elements“.');
    if (blockData !== null && (typeof blockData !== 'object' || !blockData.blocks || typeof blockData.blocks !== 'object')) {
      throw new Error('blockData muss der Inhalt von blocks.json sein (Feld „blocks“) oder null.');
    }
    this.#textures = modelsJson.textures;
    this.#models = modelsJson.models;
    this.#blocks = modelsJson.blocks;
    this.#blockDefaults = blockData ? blockData.blocks : null;
    this.version = typeof modelsJson.version === 'string' ? modelsJson.version : null;
  }

  // Warnungen (fehlende Texturen, unbekannte Blöcke …), jede nur einmal.
  get warnings() {
    return [...this.#warnings];
  }

  // Zählt hoch, sobald bindTextures neue Ebenen setzt (für Caches außerhalb, z. B. im Mesher).
  get bindVersion() {
    return this.#bindVersion;
  }

  get isBound() {
    return this.#binding !== null;
  }

  #warn(key, message) {
    if (this.#warningKeys.has(key)) return;
    this.#warningKeys.add(key);
    this.#warnings.push(message);
    console.warn(`Blockmodelle: ${message}`);
  }

  #defaultsFor(id) {
    if (this.#blockDefaults) return this.#blockDefaults[id]?.default ?? null;
    return isBlockDataLoaded() ? defaultPropsFrozen(id) : null;
  }

  #resolve(state) {
    if (typeof state !== 'string') throw new Error('Blockzustand muss ein Text sein.');
    const parsed = parseStateCached(state);
    const defaults = this.#defaultsFor(parsed.id);
    return { id: parsed.id, props: defaults ? { ...defaults, ...parsed.props } : { ...parsed.props } };
  }

  // Slots der Auswahl: Varianten → ein Slot (letzte passende Variante wie im Spiel), Multipart → je Teil.
  #selection(id, props) {
    const definition = this.#blocks[id];
    if (!definition) return null;
    if (Array.isArray(definition.variants)) {
      let match = null;
      for (const variant of definition.variants) if (matchesVariant(variant.when ?? {}, props)) match = variant;
      return match ? [this.#slot(match.apply)] : [];
    }
    if (Array.isArray(definition.multipart)) {
      return definition.multipart.filter((part) => matchesCondition(part.when, props)).map((part) => this.#slot(part.apply));
    }
    return [];
  }

  #slot(apply) {
    const entries = (Array.isArray(apply) ? apply : [apply]).filter((entry) => {
      const ok = entry && Number.isInteger(entry.model) && entry.model >= 0 && entry.model < this.#models.length;
      if (!ok) this.#warn(`apply:${JSON.stringify(entry)}`, `Ungültiger Modell-Verweis ${JSON.stringify(entry)} – übersprungen.`);
      return ok;
    });
    const total = entries.reduce((sum, entry) => sum + (Number.isInteger(entry.weight) && entry.weight > 0 ? entry.weight : 1), 0);
    return { entries, total };
  }

  // Hat irgendein Modell des Blocks Elemente? (sonst Sondermodell oder Ersatzwürfel)
  #hasGeometry(id) {
    let present = this.#geometryPresence.get(id);
    if (present === undefined) {
      const definition = this.#blocks[id];
      const parts = definition ? definition.variants ?? definition.multipart ?? [] : [];
      present = parts.some((part) => (Array.isArray(part.apply) ? part.apply : [part.apply])
        .some((entry) => this.#models[entry?.model]?.elements.length > 0));
      this.#geometryPresence.set(id, present);
    }
    return present;
  }

  // Roh-Quads eines angewandten Modells (blocklokal, Texturnamen), gecacht pro Modell + Drehung + uvlock.
  #geometry(entry) {
    const x = entry.x ?? 0, y = entry.y ?? 0, z = entry.z ?? 0;
    const key = `${entry.model}|${x}|${y}|${z}|${entry.uvlock ? 1 : 0}`;
    let quads = this.#geometryCache.get(key);
    if (quads) return quads;
    const model = this.#models[entry.model];
    const rotation = modelRotation(x, y, z);
    const rotated = !isIdentity3(rotation);
    quads = [];
    for (const element of model.elements) {
      const from = element.from.map((v) => v / 16);
      const to = element.to.map((v) => v / 16);
      const matrix = element.rotation?.matrix ?? null;
      const elementRotation = matrix && !isIdentity3(matrix) ? matrix : null;
      const origin = elementRotation ? element.rotation.origin.map((v) => v / 16) : null;
      for (let dirIndex = 0; dirIndex < 6; dirIndex++) {
        const face = element.faces?.[DIRECTIONS[dirIndex]];
        if (!face) continue;
        if (!Number.isInteger(face.tex) || face.tex < 0 || face.tex >= this.#textures.length) {
          this.#warn(`tex:${model.name}:${dirIndex}`, `Modell ${model.name ?? entry.model}: Fläche ${DIRECTIONS[dirIndex]} ohne Textur – übersprungen.`);
          continue;
        }
        const lock = entry.uvlock && rotated ? uvLockMatrix(rotation, dirIndex) : null;
        const pos = new Array(12);
        const uv = new Array(8);
        const corners = FACE_CORNERS[dirIndex];
        for (let v = 0; v < 4; v++) {
          let px = corners[v][0] ? to[0] : from[0];
          let py = corners[v][1] ? to[1] : from[1];
          let pz = corners[v][2] ? to[2] : from[2];
          if (elementRotation) {
            const [rx, ry, rz] = apply3(elementRotation, px - origin[0], py - origin[1], pz - origin[2]);
            px = rx + origin[0];
            py = ry + origin[1];
            pz = rz + origin[2];
          }
          if (rotated) {
            const [rx, ry, rz] = apply3(rotation, px - 0.5, py - 0.5, pz - 0.5);
            px = rx + 0.5;
            py = ry + 0.5;
            pz = rz + 0.5;
          }
          pos[v * 3] = snap(px);
          pos[v * 3 + 1] = snap(py);
          pos[v * 3 + 2] = snap(pz);
          let [u, w] = faceVertexUv(face.uv, face.rotation ?? 0, v);
          if (lock) {
            const du = u - 8, dw = w - 8;
            u = lock[0] * du + lock[1] * dw + 8;
            w = lock[2] * du + lock[3] * dw + 8;
          }
          uv[v * 2] = snap(u);
          uv[v * 2 + 1] = snap(w);
        }
        const cullIndex = typeof face.cull === 'string' && face.cull in DIR_INDEX ? rotateDirection(rotation, DIR_INDEX[face.cull]) : -1;
        quads.push({
          pos, uv, texture: this.#textures[face.tex], tintIndex: Number.isInteger(face.tint) ? face.tint : -1, tint: TINT_NONE,
          shade: element.shade !== false, cull: cullIndex >= 0 ? DIRECTIONS[cullIndex] : null, translucent: face.translucent === true,
          light: Number.isInteger(element.light) ? element.light : 0, ao: true, rotated: elementRotation !== null,
        });
      }
    }
    this.#geometryCache.set(key, quads);
    return quads;
  }

  #particleTexture(id) {
    const slots = this.#selection(id, this.#resolve(id).props) ?? [];
    const model = this.#models[slots[0]?.entries[0]?.model];
    const index = model?.particle;
    return Number.isInteger(index) && index >= 0 && index < this.#textures.length ? this.#textures[index] : MISSING_TEXTURE;
  }

  // Ersatzwürfel (Blöcke ohne Elemente und ohne Sondermodell, unbekannte Blöcke).
  #cubeProtos(texture) {
    return FACE_CORNERS.map((corners, dirIndex) => ({
      pos: corners.flat(), uv: [0, 0, 0, 16, 16, 16, 16, 0], texture, tintIndex: -1, tint: TINT_NONE, shade: true,
      cull: DIRECTIONS[dirIndex], translucent: false, light: 0, ao: true, rotated: false,
    }));
  }

  // Beschreibung, wie ein Zustand gezeichnet wird (ohne Texturbindung).
  #plan(state) {
    const { id, props } = this.#resolve(state);
    const kind = specialKind(id);
    const fluid = fluidOf(id, props);
    const plan = { id, props, kind, fluid, slots: [], extra: [], invisible: false };
    if (kind === 'invisible' || kind === 'fluid') {
      plan.invisible = true;
      return plan;
    }
    if (kind !== null) plan.extra = specialQuads(id, props);
    if (!keepsJsonModel(kind)) return plan;
    const slots = this.#selection(id, props);
    if (slots === null) {
      this.#warn(`unknown:${id}`, `Unbekannter Block „${id}“ – zeige Fehltextur.`);
      plan.extra = this.#cubeProtos(MISSING_TEXTURE);
      return plan;
    }
    if (!this.#hasGeometry(id)) {
      if (kind === null) {
        this.#warn(`nogeo:${id}`, `„${id}“ hat kein Modell mit Elementen und kein Sondermodell – zeige Würfel mit Partikel-Textur.`);
        plan.extra = this.#cubeProtos(this.#particleTexture(id));
      }
      return plan;
    }
    if (slots.length === 0 && this.#blocks[id].variants) {
      this.#warn(`novariant:${state}`, `Keine Variante passt zu „${state}“ – zeige Fehltextur.`);
      plan.extra = this.#cubeProtos(MISSING_TEXTURE);
      return plan;
    }
    plan.slots = slots;
    return plan;
  }

  // Alle Texturnamen, die für diese Zustände gebraucht werden (inkl. Regionen der Sondermodelle).
  textureNames(states) {
    if (states === null || states === undefined || typeof states[Symbol.iterator] !== 'function' || typeof states === 'string') {
      throw new Error('textureNames braucht eine Liste oder Menge von Blockzuständen.');
    }
    const names = new Set();
    for (const state of states) {
      const { id } = parseStateCached(state);
      if (id === 'air' || id === 'cave_air' || id === 'void_air') continue;
      const plan = this.#plan(state);
      for (const proto of plan.extra) names.add(proto.texture);
      for (const slot of plan.slots) {
        for (const entry of slot.entries) for (const proto of this.#geometry(entry)) names.add(proto.texture);
      }
      if (plan.fluid) {
        const textures = FLUID_TEXTURES[plan.fluid.type];
        names.add(textures.still);
        names.add(textures.flow);
        if (textures.overlay) names.add(textures.overlay);
      }
    }
    return names;
  }

  /**
   * Textur-Ebenen setzen: Map<name, { layer, alpha: 'opaque'|'cutout'|'translucent', mask?, maskWidth?, maskHeight? }>
   * (z. B. das Ergebnis von TextureStore.prepare). Mit mask wird die Alpha-Klasse pro UV-Rechteck bestimmt.
   */
  bindTextures(map) {
    const entries = map instanceof Map ? [...map.entries()] : map && typeof map === 'object' ? Object.entries(map) : null;
    if (!entries) throw new Error('bindTextures braucht eine Map<name, { layer, alpha }>.');
    const binding = new Map();
    for (const [name, entry] of entries) {
      if (!entry || !Number.isInteger(entry.layer) || entry.layer < 0 || entry.layer > 65535 || !ALPHA_CLASSES.includes(entry.alpha)) {
        throw new Error(`bindTextures: Eintrag „${name}“ braucht layer (0 … 65535) und alpha (${ALPHA_CLASSES.join('/')}).`);
      }
      binding.set(name, entry);
    }
    this.#binding = binding;
    this.#bindVersion++;
    this.#infoCache.clear();
    this.#appearanceIds.clear();
  }

  #entry(name) {
    if (!this.#binding) throw new Error('Texturen sind nicht gebunden – zuerst bindTextures(map) aufrufen (Namen aus textureNames).');
    const entry = this.#binding.get(name);
    if (!entry) throw new Error(`Textur „${name}“ ist nicht gebunden – fehlte sie in textureNames()?`);
    return entry;
  }

  // Ebenen-Infos einer Textur nach dem Binden (z. B. für Flüssigkeiten im Mesher).
  textureLayer(name) {
    const entry = this.#entry(name);
    return { layer: entry.layer, alpha: entry.alpha, layerIndex: LAYER_OF_ALPHA[entry.alpha] };
  }

  // Roh-Quad → fertiges Quad (Textur-Ebene, Schicht, Tönung, Richtung, Hilfswerte für den Mesher).
  #finish(proto, id, props, emission) {
    const pos = Float32Array.from(proto.pos);
    const uv = Float32Array.from(proto.uv);
    const normal = crossNormal(proto.pos);
    const dirIndex = nearestDirection(normal[0], normal[1], normal[2]);
    const entry = this.#entry(proto.texture);
    let layerIndex = 2;
    if (!proto.translucent) {
      const u0 = Math.min(uv[0], uv[2], uv[4], uv[6]), u1 = Math.max(uv[0], uv[2], uv[4], uv[6]);
      const v0 = Math.min(uv[1], uv[3], uv[5], uv[7]), v1 = Math.max(uv[1], uv[3], uv[5], uv[7]);
      layerIndex = LAYER_OF_ALPHA[rectAlphaClass(entry, u0, v0, u1, v1)];
    }
    const tint = proto.tint >= 0 ? proto.tint : proto.tintIndex >= 0 ? tintColor(id, props, proto.tintIndex) : TINT_NONE;
    const cullIndex = proto.cull ? DIR_INDEX[proto.cull] : -1;
    const quad = {
      dir: DIRECTIONS[dirIndex], cull: proto.cull, pos, uv, tex: entry.layer, tint, shade: proto.shade,
      emissive: emission >= EMISSIVE_MIN_LIGHT || proto.light >= EMISSIVE_MIN_LIGHT, layer: LAYERS[layerIndex], normal,
      texture: proto.texture, dirIndex, cullIndex, layerIndex, shadeValue: proto.shade ? SHADE_BY_INDEX[dirIndex] : 1,
      useAo: proto.ao, rotated: proto.rotated === true, boundary: false, mergeable: false, faceAB: null, uvBase: null, coverMask: null,
    };
    this.#analyse(quad, normal);
    return quad;
  }

  // Lage auf der Blockgrenze, volle Fläche, volle Kachel (für Greedy-Meshing und Verdeckung).
  #analyse(quad, normal) {
    const { pos, uv, dirIndex, cullIndex } = quad;
    const axes = FACE_AXES[dirIndex];
    const target = axes.positive ? 1 : 0;
    const aligned = Math.abs(normal[axes.normal]) > 1 - EPS;
    let onPlane = aligned;
    for (let v = 0; v < 4 && onPlane; v++) if (Math.abs(pos[v * 3 + axes.normal] - target) > EPS) onPlane = false;
    quad.boundary = onPlane;
    if (cullIndex >= 0) {
      const [a0, a1, b0, b1] = projectedRect(pos, cullIndex);
      const mask = emptyCover();
      setCells(mask, clampCell(Math.floor(a0 + EPS)), clampCell(Math.ceil(a1 - EPS)), clampCell(Math.floor(b0 + EPS)), clampCell(Math.ceil(b1 - EPS)));
      quad.coverMask = mask;
    }
    if (!onPlane || quad.rotated || cullIndex !== dirIndex) return;
    const ab = new Int8Array(8);
    const seen = new Set();
    for (let v = 0; v < 4; v++) {
      const a = pos[v * 3 + axes.t1], b = pos[v * 3 + axes.t2];
      const ai = Math.abs(a) < EPS ? 0 : Math.abs(a - 1) < EPS ? 1 : -1;
      const bi = Math.abs(b) < EPS ? 0 : Math.abs(b - 1) < EPS ? 1 : -1;
      const uu = uv[v * 2], vv = uv[v * 2 + 1];
      const tileU = Math.abs(uu) < EPS || Math.abs(uu - 16) < EPS;
      const tileV = Math.abs(vv) < EPS || Math.abs(vv - 16) < EPS;
      if (ai < 0 || bi < 0 || !tileU || !tileV) return;
      ab[v * 2] = ai;
      ab[v * 2 + 1] = bi;
      seen.add(ai * 2 + bi);
    }
    if (seen.size !== 4) return;
    const uvAt = (a, b) => {
      for (let v = 0; v < 4; v++) if (ab[v * 2] === a && ab[v * 2 + 1] === b) return [Math.round(uv[v * 2]), Math.round(uv[v * 2 + 1])];
      return null;
    };
    const [u00, v00] = uvAt(0, 0);
    const [u10, v10] = uvAt(1, 0);
    const [u01, v01] = uvAt(0, 1);
    const [u11, v11] = uvAt(1, 1);
    // Affin über die Fläche (eine der 8 Lagen einer Kachel)?
    if (u11 !== u10 + u01 - u00 || v11 !== v10 + v01 - v00) return;
    quad.faceAB = ab;
    quad.uvBase = [u00, v00, u10 - u00, v10 - v00, u01 - u00, v01 - v00];
    quad.mergeable = true;
  }

  #appearance(members) {
    const key = members.map((q) => `${q.tex},${q.tint},${q.layerIndex},${q.emissive ? 1 : 0},${q.shadeValue},${q.uvBase.join(',')}`).join(';');
    let id = this.#appearanceIds.get(key);
    if (id === undefined) {
      id = this.#appearanceIds.size + 1;
      this.#appearanceIds.set(key, id);
    }
    return id;
  }

  // Gruppen voller, zusammenlegbarer Flächen je Richtung (z. B. Grasblock: Erde + Overlay).
  #groupFaces(list) {
    const groups = new Array(list.length).fill(null);
    const leads = new Uint8Array(list.length);
    for (let dir = 0; dir < 6; dir++) {
      const members = [];
      const indices = [];
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        if (q.boundary && q.dirIndex === dir && q.cullIndex === dir) {
          members.push(q);
          indices.push(i);
        }
      }
      if (members.length === 0) continue;
      const first = members[0];
      const ok = members.every((q) => q.mergeable && q.shadeValue === first.shadeValue && q.useAo === first.useAo);
      if (!ok) continue;
      const group = { dir, quads: members, appearance: this.#appearance(members) };
      for (const i of indices) groups[i] = group;
      leads[indices[0]] = 1;
    }
    list.groups = groups;
    list.leads = leads;
    return list;
  }

  /**
   * Zeichen-Infos eines Zustands (nach bindTextures; gecacht). Für den Mesher:
   * { state, id, props, kind, invisible, fluid, emission, ao, opaqueFull, aoOccluder, sideCover[6], fullSides,
   *   cullSame, glassLike, solidForFluid, quadsAt(x, y, z) }
   */
  renderInfo(state) {
    let info = this.#infoCache.get(state);
    if (info) return info;
    if (!this.#binding) throw new Error('Texturen sind nicht gebunden – zuerst bindTextures(map) aufrufen (Namen aus textureNames).');
    const plan = this.#plan(state);
    const { id, props } = plan;
    const emission = blockLightEmission(id, props);
    const extra = plan.extra.map((proto) => this.#finish(proto, id, props, emission));
    const entryCache = new Map();
    const entryQuads = (slotIndex, entryIndex) => {
      const key = slotIndex * 65536 + entryIndex;
      let quads = entryCache.get(key);
      if (!quads) {
        quads = this.#geometry(plan.slots[slotIndex].entries[entryIndex]).map((proto) => this.#finish(proto, id, props, emission));
        entryCache.set(key, quads);
      }
      return quads;
    };
    const firstModel = this.#models[plan.slots[0]?.entries[0]?.model];
    info = {
      state, id, props, kind: plan.kind, invisible: plan.invisible, fluid: plan.fluid, emission,
      ao: firstModel ? firstModel.ao !== false && emission === 0 : false,
      cullSame: sameTypeRule(id), glassLike: isGlassLike(id),
      opaqueFull: false, aoOccluder: false, sideCover: null, fullSides: 0, solidForFluid: false, single: null, quadsAt: null,
    };
    this.#summarise(info, plan, extra, entryQuads);
    this.#makeSelector(info, plan, extra, entryQuads);
    this.#infoCache.set(state, info);
    return info;
  }

  // Eigenschaften, die für jede mögliche Variante gelten (pro Slot UND über Einträge, dann ODER).
  #summarise(info, plan, extra, entryQuads) {
    const sideCover = Array.from({ length: 6 }, () => emptyCover());
    let opaqueSides = 0;
    let geometrySides = 0;
    const describe = (quads) => {
      const cover = Array.from({ length: 6 }, () => emptyCover());
      let opaque = 0;
      let full = 0;
      for (const q of quads) {
        if (!q.boundary) continue;
        const [a0, a1, b0, b1] = projectedRect(q.pos, q.dirIndex);
        if (q.layerIndex === 0) {
          setCells(cover[q.dirIndex], clampCell(Math.ceil(a0 - EPS)), clampCell(Math.floor(a1 + EPS)), clampCell(Math.ceil(b0 - EPS)), clampCell(Math.floor(b1 + EPS)));
        }
        const fullFace = a0 < EPS && b0 < EPS && a1 > 16 - EPS && b1 > 16 - EPS && !q.rotated;
        if (fullFace) {
          full |= 1 << q.dirIndex;
          if (q.layerIndex === 0 && q.cullIndex === q.dirIndex) opaque |= 1 << q.dirIndex;
        }
      }
      return { cover, opaque, full };
    };
    const merge = (summary) => {
      opaqueSides |= summary.opaque;
      geometrySides |= summary.full;
      for (let s = 0; s < 6; s++) for (let w = 0; w < COVER_WORDS; w++) sideCover[s][w] |= summary.cover[s][w];
    };
    if (extra.length) merge(describe(extra));
    plan.slots.forEach((slot, slotIndex) => {
      let combined = null;
      slot.entries.forEach((_, entryIndex) => {
        const summary = describe(entryQuads(slotIndex, entryIndex));
        if (!combined) combined = summary;
        else {
          combined.opaque &= summary.opaque;
          combined.full &= summary.full;
          for (let s = 0; s < 6; s++) for (let w = 0; w < COVER_WORDS; w++) combined.cover[s][w] &= summary.cover[s][w];
        }
      });
      if (combined) merge(combined);
    });
    info.sideCover = sideCover;
    info.fullSides = sideCover.reduce((bits, mask, s) => (isFullCover(mask) ? bits | (1 << s) : bits), 0);
    info.opaqueFull = !info.invisible && opaqueSides === 0b111111;
    info.aoOccluder = !info.invisible && geometrySides === 0b111111;
    info.solidForFluid = info.aoOccluder || sideCover.some((mask) => mask.some((word) => word !== 0));
  }

  #makeSelector(info, plan, extra, entryQuads) {
    const slots = plan.slots;
    const build = (picks) => {
      const list = [...extra];
      for (let s = 0; s < slots.length; s++) list.push(...entryQuads(s, picks[s]));
      return this.#groupFaces(list);
    };
    const randomSlots = [];
    slots.forEach((slot, index) => {
      if (slot.entries.length > 1) randomSlots.push(index);
    });
    const basePicks = slots.map(() => 0);
    if (randomSlots.length === 0) {
      info.single = build(basePicks);
      info.quadsAt = () => info.single;
      return;
    }
    const pick = (slot, hash) => {
      let r = hash % slot.total;
      for (let i = 0; i < slot.entries.length; i++) {
        const weight = Number.isInteger(slot.entries[i].weight) && slot.entries[i].weight > 0 ? slot.entries[i].weight : 1;
        if (r < weight) return i;
        r -= weight;
      }
      return slot.entries.length - 1;
    };
    if (randomSlots.length === 1) {
      const slotIndex = randomSlots[0];
      const slot = slots[slotIndex];
      const lists = new Array(slot.entries.length);
      info.quadsAt = (x, y, z) => {
        const choice = pick(slot, hashPosition(x, y, z, slotIndex));
        let list = lists[choice];
        if (!list) {
          const picks = [...basePicks];
          picks[slotIndex] = choice;
          list = lists[choice] = build(picks);
        }
        return list;
      };
      return;
    }
    const lists = new Map();
    info.quadsAt = (x, y, z) => {
      const picks = [...basePicks];
      for (const slotIndex of randomSlots) picks[slotIndex] = pick(slots[slotIndex], hashPosition(x, y, z, slotIndex));
      const key = picks.join(',');
      let list = lists.get(key);
      if (!list) {
        list = build(picks);
        lists.set(key, list);
      }
      return list;
    };
  }

  // Quads des Zustands an dieser Position (Zufallsvariante per Positions-Hash, gewichtet). Nicht verändern.
  quads(stateFull, x = 0, y = 0, z = 0) {
    if (![x, y, z].every(Number.isInteger)) throw new Error(`quads braucht ganze Koordinaten (bekommen: ${x}, ${y}, ${z}).`);
    return this.renderInfo(stateFull).quadsAt(x, y, z);
  }

  // Volles Element 0 … 16 mit allen 6 Flächen mit cullface und deckend (in jeder Variante).
  isOpaqueFullCube(stateFull) {
    return this.renderInfo(stateFull).opaqueFull;
  }

  // Glas-Glas, gleiches Buntglas, Eis, Schleim, Honig, Laub gleicher Art, Scheiben/Gitter, Wasser, Lava.
  cullsSameType(stateFull) {
    const { id } = this.#resolve(stateFull);
    return sameTypeRule(id) !== CULL_NONE || specialKind(id) === 'fluid';
  }

  // Lichtstärke 0 … 15 des Zustands.
  lightEmission(stateFull) {
    const { id, props } = this.#resolve(stateFull);
    return blockLightEmission(id, props);
  }

  // Flüssigkeit im Zustand ({ type, amount, falling } oder null).
  fluidOf(stateFull) {
    const { id, props } = this.#resolve(stateFull);
    return fluidOf(id, props);
  }
}
