// Builder-API für Bau-Module (§6.2). Läuft in Browser und Node.
// Koordinaten wie Minecraft (x Osten, y oben, z Süden); finalize() verschiebt die kleinste Ecke nach (0,0,0).

import { normalizeState, formatState, stateId, isAirId } from './blockstate.js';
import { isBlockDataLoaded, validateState, completeState, blockProps } from './block-data.js';
import { BlockVolume } from './volume.js';
import { IDENTITY, makeTransform, composeTransforms, invertTransform, transformState } from './transform.js';
import * as shapes from './shapes.js';
import { applyConnections } from './connections.js';
import { planSteps } from './steps.js';
import { itemForState, addItems, sortMaterials } from './materials.js';
import { createRandom } from './random.js';

export const DEFAULT_PHASE_TITLE = 'Aufbau';
const MAX_CONTEXTS = 65535;
const ID_PATTERN = /^[a-z0-9_]+$/;
const HORIZONTAL = ['north', 'east', 'south', 'west'];
const DIR_OFFSET = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
export const TALL_PLANTS = Object.freeze(['sunflower', 'lilac', 'rose_bush', 'peony', 'tall_grass', 'large_fern', 'tall_seagrass', 'pitcher_plant']);

function checkOptions(options, allowed, method) {
  if (options === undefined || options === null) return {};
  if (typeof options !== 'object' || Array.isArray(options)) throw new Error(`${method}: Optionen müssen ein Objekt sein.`);
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) throw new Error(`${method}: unbekannte Option „${key}“ (erlaubt: ${allowed.join(', ')}).`);
  }
  return options;
}

function checkInts(method, values) {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isInteger(value)) throw new Error(`${method}: ${name} muss eine ganze Zahl sein, bekommen: ${value}.`);
  }
}

function checkText(method, name, value, { required = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${method}: ${name} muss ein Text sein.`);
  if (required && value.trim() === '') throw new Error(`${method}: ${name} darf nicht leer sein.`);
  return value.trim();
}

function checkChoice(method, name, value, choices) {
  if (!choices.includes(value)) throw new Error(`${method}: ${name} muss ${choices.map((c) => `'${c}'`).join(', ')} sein, bekommen: ${value}.`);
}

function cleanId(method, id, suffix = null) {
  if (typeof id !== 'string') throw new Error(`${method}: Block-ID muss ein Text sein.`);
  const plain = id.trim().replace(/^minecraft:/, '');
  if (!ID_PATTERN.test(plain)) throw new Error(`${method}: „${id}“ ist keine gültige Block-ID (nur die ID ohne [Eigenschaften]).`);
  if (suffix && !plain.endsWith(suffix)) throw new Error(`${method}: „${plain}“ ist kein passender Block (erwartet: *${suffix}).`);
  return plain;
}

function matrixKey(t) {
  return `${t.a},${t.b},${t.c},${t.d}`;
}

export class Builder {
  #volume = new BlockVolume();
  #contexts = [];
  #contextKeys = new Map();
  #phases = [];
  #phase = -1;
  #step = -1;
  #ctxNormal = -1;
  #ctxRaw = -1;
  #transform = IDENTITY;
  #prepared = new Map();
  #preparedByMatrix = new Map();
  #notes = [];
  #warnings = [];
  #random;
  #maxBlocks;
  #maxSize;
  #lo = [Infinity, Infinity, Infinity];
  #hi = [-Infinity, -Infinity, -Infinity];
  #finalized = false;

  constructor({ seed = 'block-kompass', maxBlocks = 3_000_000, maxSize = 4064 } = {}) {
    if (!Number.isInteger(maxBlocks) || maxBlocks < 1) throw new Error('maxBlocks muss eine ganze Zahl ≥ 1 sein.');
    if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 32768) throw new Error('maxSize muss eine ganze Zahl von 1 bis 32768 sein.');
    this.#random = createRandom(String(seed));
    this.#maxBlocks = maxBlocks;
    this.#maxSize = maxSize;
    this.#preparedByMatrix.set(matrixKey(IDENTITY), this.#prepared);
  }

  // --- Gliederung ---

  phase(title, text = '', options) {
    this.#checkOpen();
    const { tips = [] } = checkOptions(options, ['tips'], 'phase');
    const cleanTitle = checkText('phase', 'title', title, { required: true });
    const cleanTextValue = checkText('phase', 'text', text);
    if (!Array.isArray(tips) || tips.some((tip) => typeof tip !== 'string' || tip.trim() === '')) {
      throw new Error('phase: tips muss eine Liste aus nicht leeren Texten sein.');
    }
    this.#phases.push({ title: cleanTitle, text: cleanTextValue, tips: tips.map((tip) => tip.trim()), steps: [] });
    this.#phase = this.#phases.length - 1;
    this.#step = -1;
    this.#resetContext();
  }

  step(title, text = '') {
    this.#checkOpen();
    const cleanTitle = checkText('step', 'title', title, { required: true });
    const cleanTextValue = checkText('step', 'text', text);
    this.#ensurePhase();
    const steps = this.#phases[this.#phase].steps;
    steps.push({ title: cleanTitle, text: cleanTextValue });
    this.#step = steps.length - 1;
    this.#resetContext();
  }

  note(x, y, z, text) {
    this.#checkOpen();
    checkInts('note', { x, y, z });
    const cleanTextValue = checkText('note', 'text', text, { required: true });
    this.#ensurePhase();
    const [wx, wy, wz] = this.#toWorld(x, y, z);
    this.#notes.push({ x: wx, y: wy, z: wz, text: cleanTextValue, phase: this.#phase, step: this.#step });
  }

  #ensurePhase() {
    if (this.#phase >= 0) return;
    this.#phases.push({ title: DEFAULT_PHASE_TITLE, text: '', tips: [], steps: [] });
    this.#phase = this.#phases.length - 1;
    this.#step = -1;
    this.#resetContext();
  }

  #resetContext() {
    this.#ctxNormal = -1;
    this.#ctxRaw = -1;
  }

  #context(raw) {
    const cached = raw ? this.#ctxRaw : this.#ctxNormal;
    if (cached >= 0) return cached;
    this.#ensurePhase();
    const key = `${this.#phase}:${this.#step}:${raw ? 1 : 0}`;
    let id = this.#contextKeys.get(key);
    if (id === undefined) {
      if (this.#contexts.length >= MAX_CONTEXTS) throw new Error(`Zu viele Kapitel/Schritte (höchstens ${MAX_CONTEXTS}).`);
      id = this.#contexts.length;
      this.#contexts.push({ phase: this.#phase, step: this.#step, raw });
      this.#contextKeys.set(key, id);
    }
    if (raw) this.#ctxRaw = id;
    else this.#ctxNormal = id;
    return id;
  }

  // --- Setzen ---

  #checkOpen() {
    if (this.#finalized) throw new Error('Der Bau ist schon abgeschlossen (finalize() wurde aufgerufen).');
  }

  #toWorld(x, y, z) {
    const t = this.#transform;
    return [t.a * x + t.b * z + t.dx, y + t.dy, t.c * x + t.d * z + t.dz];
  }

  // Zustand normalisieren, prüfen und für den aktuellen Transform drehen → Paletten-Index.
  #prepare(state) {
    const hit = this.#prepared.get(state);
    if (hit !== undefined) return hit;
    if (typeof state !== 'string') throw new Error('Blockzustand muss ein Text sein, z. B. "oak_planks" oder "oak_stairs[facing=north]".');
    const normalized = normalizeState(state);
    let index = 0;
    if (!isAirId(stateId(normalized))) {
      if (isBlockDataLoaded()) {
        const check = validateState(normalized);
        if (!check.ok) throw new Error(check.errors.join(' '));
      }
      index = this.#volume.paletteIndex(transformState(normalized, this.#transform));
    }
    this.#prepared.set(state, index);
    return index;
  }

  #setTransform(t) {
    this.#transform = t;
    const key = matrixKey(t);
    let cache = this.#preparedByMatrix.get(key);
    if (!cache) {
      cache = new Map();
      this.#preparedByMatrix.set(key, cache);
    }
    this.#prepared = cache;
  }

  #trackBounds(x, y, z) {
    const lo = this.#lo;
    const hi = this.#hi;
    if (x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && z >= lo[2] && z <= hi[2]) return;
    lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); lo[2] = Math.min(lo[2], z);
    hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); hi[2] = Math.max(hi[2], z);
    if (hi[0] - lo[0] < this.#maxSize && hi[1] - lo[1] < this.#maxSize && hi[2] - lo[2] < this.#maxSize) return;
    // Die laufende Box wächst nur; vor dem Fehler mit den echten Grenzen nachprüfen.
    const bounds = this.#volume.bounds;
    const exactLo = bounds ? bounds.min.map((v, i) => Math.min(v, [x, y, z][i])) : [x, y, z];
    const exactHi = bounds ? bounds.max.map((v, i) => Math.max(v, [x, y, z][i])) : [x, y, z];
    this.#lo = exactLo;
    this.#hi = exactHi;
    const edges = exactHi.map((v, i) => v - exactLo[i] + 1);
    const tooLong = edges.findIndex((edge) => edge > this.#maxSize);
    if (tooLong >= 0) {
      throw new Error(`Der Bau wird zu groß: ${'xyz'[tooLong]}-Kante ${edges[tooLong]} Blöcke, erlaubt sind höchstens ${this.#maxSize}.`);
    }
  }

  #putWorld(wx, wy, wz, index, raw) {
    if (index === 0) {
      this.#volume.delete(wx, wy, wz);
      return;
    }
    this.#trackBounds(wx, wy, wz);
    this.#volume.setIndex(wx, wy, wz, index, this.#context(raw));
    if (this.#volume.count > this.#maxBlocks) {
      throw new Error(`Zu viele Blöcke: mehr als ${this.#maxBlocks.toLocaleString('de-CH')} sind nicht erlaubt.`);
    }
  }

  #put(x, y, z, index, raw = false) {
    const t = this.#transform;
    this.#putWorld(t.a * x + t.b * z + t.dx, y + t.dy, t.c * x + t.d * z + t.dz, index, raw);
  }

  #checkExtent(method, ...edges) {
    const tooLong = edges.find((edge) => edge > this.#maxSize);
    if (tooLong !== undefined) throw new Error(`${method}: die Form ist zu groß (${Math.ceil(tooLong)} Blöcke, erlaubt ${this.#maxSize}).`);
  }

  set(x, y, z, state, options) {
    this.#checkOpen();
    const { raw = false } = checkOptions(options, ['raw'], 'set');
    checkInts('set', { x, y, z });
    this.#put(x, y, z, this.#prepare(state), Boolean(raw));
  }

  get(x, y, z) {
    checkInts('get', { x, y, z });
    const [wx, wy, wz] = this.#toWorld(x, y, z);
    const state = this.#volume.get(wx, wy, wz);
    return state === 'air' ? state : transformState(state, invertTransform(this.#transform));
  }

  remove(x, y, z) {
    this.#checkOpen();
    checkInts('remove', { x, y, z });
    const [wx, wy, wz] = this.#toWorld(x, y, z);
    return this.#volume.delete(wx, wy, wz);
  }

  fill(x1, y1, z1, x2, y2, z2, state, options) {
    this.#checkOpen();
    const { hollow = false, outline = false, replace = null, keep = false } = checkOptions(options, ['hollow', 'outline', 'replace', 'keep'], 'fill');
    checkInts('fill', { x1, y1, z1, x2, y2, z2 });
    if (hollow && outline) throw new Error('fill: hollow und outline gehen nicht gleichzeitig.');
    if (keep && replace) throw new Error('fill: keep und replace gehen nicht gleichzeitig.');
    this.#checkExtent('fill', Math.abs(x2 - x1) + 1, Math.abs(y2 - y1) + 1, Math.abs(z2 - z1) + 1);
    const index = this.#prepare(state);
    const replaceIds = replace === null ? null : new Set((Array.isArray(replace) ? replace : [replace]).map((id) => cleanId('fill (replace)', id)));
    const mode = outline ? 'outline' : hollow ? 'hollow' : 'full';
    const emit = replaceIds || keep
      ? (x, y, z) => this.#putIf(x, y, z, index, keep ? null : replaceIds)
      : (x, y, z) => this.#put(x, y, z, index);
    return shapes.box(x1, y1, z1, x2, y2, z2, mode, emit);
  }

  // replaceIds null = nur in Luft setzen (keep).
  #putIf(x, y, z, index, replaceIds) {
    const [wx, wy, wz] = this.#toWorld(x, y, z);
    const current = this.#volume.getIndex(wx, wy, wz);
    const allowed = replaceIds === null ? current === 0 : replaceIds.has(current === 0 ? 'air' : stateId(this.#volume.palette[current]));
    if (allowed) this.#putWorld(wx, wy, wz, index, false);
  }

  walls(x1, y1, z1, x2, y2, z2, state) {
    this.#checkOpen();
    checkInts('walls', { x1, y1, z1, x2, y2, z2 });
    this.#checkExtent('walls', Math.abs(x2 - x1) + 1, Math.abs(y2 - y1) + 1, Math.abs(z2 - z1) + 1);
    const index = this.#prepare(state);
    return shapes.box(x1, y1, z1, x2, y2, z2, 'walls', (x, y, z) => this.#put(x, y, z, index));
  }

  line(x1, y1, z1, x2, y2, z2, state) {
    this.#checkOpen();
    checkInts('line', { x1, y1, z1, x2, y2, z2 });
    this.#checkExtent('line', Math.abs(x2 - x1) + 1, Math.abs(y2 - y1) + 1, Math.abs(z2 - z1) + 1);
    const index = this.#prepare(state);
    return shapes.line(x1, y1, z1, x2, y2, z2, (x, y, z) => this.#put(x, y, z, index));
  }

  // --- Formen (Konventionen für Mittelpunkte und Radien: shapes.js) ---

  #shape(state) {
    this.#checkOpen();
    const index = this.#prepare(state);
    return (x, y, z) => this.#put(x, y, z, index);
  }

  cylinder(cx, y, cz, radius, height, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness'], 'cylinder');
    this.#checkExtent('cylinder', 2 * radius + 1, height);
    return shapes.cylinder(cx, y, cz, radius, height, opts, this.#shape(state));
  }

  disc(cx, y, cz, radius, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness'], 'disc');
    this.#checkExtent('disc', 2 * radius + 1);
    return shapes.disc(cx, y, cz, radius, opts, this.#shape(state));
  }

  ellipse(cx, y, cz, rx, rz, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness'], 'ellipse');
    this.#checkExtent('ellipse', 2 * rx + 1, 2 * rz + 1);
    return shapes.ellipse(cx, y, cz, rx, rz, opts, this.#shape(state));
  }

  sphere(cx, cy, cz, radius, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness', 'part'], 'sphere');
    this.#checkExtent('sphere', 2 * radius + 1);
    return shapes.sphere(cx, cy, cz, radius, opts, this.#shape(state));
  }

  cone(cx, y, cz, rBottom, rTop, height, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness'], 'cone');
    this.#checkExtent('cone', 2 * Math.max(rBottom, rTop) + 1, height);
    return shapes.cone(cx, y, cz, rBottom, rTop, height, opts, this.#shape(state));
  }

  #checkPoints(method, points) {
    if (!Array.isArray(points)) throw new Error(`${method}: points muss eine Liste [[x, z], …] sein.`);
    const xs = points.map((p) => (Array.isArray(p) ? p[0] : NaN));
    const zs = points.map((p) => (Array.isArray(p) ? p[1] : NaN));
    if ([...xs, ...zs].every(Number.isFinite)) {
      this.#checkExtent(method, Math.max(...xs) - Math.min(...xs) + 1, Math.max(...zs) - Math.min(...zs) + 1);
    }
  }

  polygon(points, y, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness'], 'polygon');
    this.#checkPoints('polygon', points);
    return shapes.polygon(points, y, opts, this.#shape(state));
  }

  prism(points, y1, y2, state, options) {
    const opts = checkOptions(options, ['hollow', 'thickness'], 'prism');
    this.#checkPoints('prism', points);
    if (Number.isInteger(y1) && Number.isInteger(y2)) this.#checkExtent('prism', Math.abs(y2 - y1) + 1);
    return shapes.prism(points, y1, y2, opts, this.#shape(state));
  }

  // --- Bauteile ---

  door(x, y, z, id, options) {
    this.#checkOpen();
    const { facing = 'north', hinge = 'left', open = false } = checkOptions(options, ['facing', 'hinge', 'open'], 'door');
    checkInts('door', { x, y, z });
    const door = cleanId('door', id, '_door');
    checkChoice('door', 'facing', facing, HORIZONTAL);
    checkChoice('door', 'hinge', hinge, ['left', 'right']);
    if (typeof open !== 'boolean') throw new Error('door: open muss true oder false sein.');
    this.set(x, y, z, formatState(door, { facing, half: 'lower', hinge, open: String(open) }));
    this.set(x, y + 1, z, formatState(door, { facing, half: 'upper', hinge, open: String(open) }));
  }

  // Fußteil bei (x, y, z), Kopfteil einen Block weiter in facing-Richtung.
  bed(x, y, z, id, options) {
    this.#checkOpen();
    const { facing = 'north' } = checkOptions(options, ['facing'], 'bed');
    checkInts('bed', { x, y, z });
    const bed = cleanId('bed', id, '_bed');
    checkChoice('bed', 'facing', facing, HORIZONTAL);
    const [dx, dz] = DIR_OFFSET[facing];
    this.set(x, y, z, formatState(bed, { facing, part: 'foot' }));
    this.set(x + dx, y, z + dz, formatState(bed, { facing, part: 'head' }));
  }

  tall(x, y, z, id) {
    this.#checkOpen();
    checkInts('tall', { x, y, z });
    const plant = cleanId('tall', id);
    const half = isBlockDataLoaded() ? blockProps(plant)?.half : null;
    const twoHigh = TALL_PLANTS.includes(plant) || (half?.includes('upper') && half?.includes('lower') && !plant.endsWith('_door'));
    if (!twoHigh) throw new Error(`tall: „${plant}“ ist keine doppelt hohe Pflanze (z. B. ${TALL_PLANTS.join(', ')}).`);
    this.set(x, y, z, formatState(plant, { half: 'lower' }));
    this.set(x, y + 1, z, formatState(plant, { half: 'upper' }));
  }

  stairs(x, y, z, id, options) {
    this.#checkOpen();
    const { facing = 'north', half = 'bottom' } = checkOptions(options, ['facing', 'half'], 'stairs');
    checkInts('stairs', { x, y, z });
    checkChoice('stairs', 'facing', facing, HORIZONTAL);
    checkChoice('stairs', 'half', half, ['bottom', 'top']);
    this.set(x, y, z, formatState(cleanId('stairs', id, '_stairs'), { facing, half }));
  }

  slab(x, y, z, id, options) {
    this.#checkOpen();
    const { type = 'bottom' } = checkOptions(options, ['type'], 'slab');
    checkInts('slab', { x, y, z });
    checkChoice('slab', 'type', type, ['bottom', 'top', 'double']);
    this.set(x, y, z, formatState(cleanId('slab', id, '_slab'), { type }));
  }

  // Dach über der Fläche x1..x2 × z1..z2 (Außenkante der Wände). y = Höhe der untersten Treppenreihe
  // (Traufe, inkl. Überstand). Treppen zeigen mit der hohen Seite zur Firstmitte.
  // gable: First entlang axis; gerade Breite → zwei Treppenreihen treffen sich oben, ungerade Breite →
  // First aus unteren Stufen (slab) oder sonst Vollblöcken (full). Giebel werden mit full gefüllt.
  roof(options) {
    this.#checkOpen();
    const allowed = ['x1', 'z1', 'x2', 'z2', 'y', 'type', 'axis', 'stairs', 'slab', 'full', 'overhang', 'hollow'];
    const { x1, z1, x2, z2, y, type = 'gable', axis = 'x', stairs = null, slab = null, full = null, overhang = 0, hollow = true } = checkOptions(options, allowed, 'roof');
    checkInts('roof', { x1, z1, x2, z2, y, overhang });
    if (overhang < 0) throw new Error('roof: overhang muss ≥ 0 sein.');
    checkChoice('roof', 'type', type, ['gable', 'hip', 'pyramid', 'flat']);
    checkChoice('roof', 'axis', axis, ['x', 'z']);
    const area = {
      fx1: Math.min(x1, x2), fx2: Math.max(x1, x2), fz1: Math.min(z1, z2), fz2: Math.max(z1, z2),
    };
    Object.assign(area, { minX: area.fx1 - overhang, maxX: area.fx2 + overhang, minZ: area.fz1 - overhang, maxZ: area.fz2 + overhang });
    this.#checkExtent('roof', area.maxX - area.minX + 1, area.maxZ - area.minZ + 1);
    const slabId = slab === null ? null : cleanId('roof (slab)', slab, '_slab');
    const fullIndex = full === null ? null : this.#prepare(full);
    if (type === 'flat') {
      const flatIndex = fullIndex ?? (slabId ? this.#prepare(`${slabId}[type=bottom]`) : null);
      if (flatIndex === null) throw new Error('roof: ein Flachdach braucht full oder slab.');
      shapes.box(area.minX, y, area.minZ, area.maxX, y, area.maxZ, 'full', (x, yy, z) => this.#put(x, yy, z, flatIndex));
      return;
    }
    if (stairs === null) throw new Error('roof: stairs (Treppen-ID) fehlt.');
    const stairsId = cleanId('roof (stairs)', stairs, '_stairs');
    if (type === 'pyramid' && area.maxX - area.minX !== area.maxZ - area.minZ) {
      throw new Error('roof: ein Zeltdach (pyramid) braucht eine quadratische Fläche (mit Überstand) – nimm sonst type "hip".');
    }
    if (!hollow && fullIndex === null) throw new Error('roof: für hollow: false brauchst du full (Block zum Füllen).');
    const ridgeIndex = slabId ? this.#prepare(`${slabId}[type=bottom]`) : fullIndex;
    const cellOf = type === 'gable' ? (x, z) => gableCell(area, axis, x, z) : (x, z) => hipCell(area, x, z);
    let gableWarned = false;
    for (let z = area.minZ; z <= area.maxZ; z++) {
      for (let x = area.minX; x <= area.maxX; x++) {
        const cell = cellOf(x, z);
        const h = y + cell.k;
        if (cell.ridge) {
          if (ridgeIndex === null) throw new Error('roof: bei ungerader Breite brauchst du slab oder full für den First.');
          this.#put(x, h, z, ridgeIndex);
        } else {
          this.#put(x, h, z, this.#prepare(`${stairsId}[facing=${cell.facing},half=bottom]`));
        }
        const inside = x >= area.fx1 && x <= area.fx2 && z >= area.fz1 && z <= area.fz2;
        if (!inside || cell.k === 0) continue;
        const gableEnd = type === 'gable' && (axis === 'x' ? x === area.fx1 || x === area.fx2 : z === area.fz1 || z === area.fz2);
        if (!hollow || gableEnd) {
          if (fullIndex === null) {
            if (!gableWarned) this.#warnings.push('roof: Giebel offen gelassen (kein full-Block angegeben).');
            gableWarned = true;
            continue;
          }
          for (let yy = y; yy < h; yy++) this.#putIf(x, yy, z, fullIndex, null);
        }
      }
    }
  }

  // Wendeltreppe um (cx, cz): eine Treppe pro Ebene auf dem quadratischen Ring mit Abstand radius,
  // Start an der Nordseite (cx, cz − radius) auf y1. facing = Laufrichtung (man geht in facing hinauf).
  spiralStairs(cx, cz, y1, y2, radius, stairsId, options) {
    this.#checkOpen();
    const { clockwise = true, core = null } = checkOptions(options, ['clockwise', 'core'], 'spiralStairs');
    checkInts('spiralStairs', { cx, cz, y1, y2, radius });
    if (radius < 1) throw new Error('spiralStairs: radius muss ≥ 1 sein.');
    if (y2 < y1) throw new Error('spiralStairs: y2 muss ≥ y1 sein.');
    this.#checkExtent('spiralStairs', 2 * radius + 1, y2 - y1 + 1);
    const id = cleanId('spiralStairs', stairsId, '_stairs');
    const ring = squareRing(cx, cz, radius);
    const path = clockwise ? ring : [ring[0], ...ring.slice(1).reverse()];
    for (let i = 0; i <= y2 - y1; i++) {
      const [x, z] = path[i % path.length];
      const [nx, nz] = path[(i + 1) % path.length];
      const facing = HORIZONTAL.find((dir) => DIR_OFFSET[dir][0] === nx - x && DIR_OFFSET[dir][1] === nz - z);
      this.#put(x, y1 + i, z, this.#prepare(`${id}[facing=${facing},half=bottom]`));
    }
    if (core !== null) {
      const coreIndex = this.#prepare(core);
      for (let y = y1; y <= y2; y++) {
        for (let dz = 1 - radius; dz < radius; dz++) {
          for (let dx = 1 - radius; dx < radius; dx++) this.#put(cx + dx, y, cz + dz, coreIndex);
        }
      }
    }
  }

  // --- Drehen/Spiegeln: erst spiegeln, dann drehen (im Uhrzeigersinn von oben), dann verschieben ---

  transform(options, fn) {
    this.#checkOpen();
    const { offset = [0, 0, 0], rotate = 0, mirror = null } = checkOptions(options, ['offset', 'rotate', 'mirror'], 'transform');
    if (typeof fn !== 'function') throw new Error('transform braucht eine Funktion als zweiten Parameter.');
    const previous = this.#transform;
    this.#setTransform(composeTransforms(previous, makeTransform({ offset, rotate, mirror })));
    try {
      const result = fn();
      if (result && typeof result.then === 'function') throw new Error('transform: die Funktion muss synchron sein (kein async/await).');
      return result;
    } finally {
      this.#setTransform(previous);
    }
  }

  // --- Zufall (deterministisch, Startwert = seed) ---

  rng() {
    return this.#random.next();
  }

  rngInt(min, max) {
    return this.#random.int(min, max);
  }

  pick(array) {
    return this.#random.pick(array);
  }

  pickWeighted(entries) {
    return this.#random.pickWeighted(entries);
  }

  chance(p) {
    return this.#random.chance(p);
  }

  get blockCount() {
    return this.#volume.count;
  }

  // --- Abschluss ---

  finalize() {
    this.#checkOpen();
    this.#finalized = true;
    const source = this.#volume;
    const contexts = this.#contexts;
    const warnings = [...this.#warnings];
    if (!isBlockDataLoaded()) warnings.push('Blockdaten nicht geladen: Zustände wurden nicht vervollständigt und nicht gegen Minecraft 26.2 geprüft.');

    applyConnections(source, { isRawStep: (step) => contexts[step].raw });
    const { remap, palette } = completePalette(source);
    const bounds = source.bounds;
    const min = bounds ? bounds.min : [0, 0, 0];
    const size = bounds ? bounds.max.map((v, i) => v - min[i] + 1) : [0, 0, 0];
    if (!bounds) warnings.push('Der Bau enthält keine Blöcke.');

    const phaseDefs = this.#phases;
    const plan = planSteps(phaseDefs, scanOccupancy(source, contexts, phaseDefs), min[1], size[1]);
    const volume = new BlockVolume();
    for (let i = 1; i < palette.length; i++) volume.paletteIndex(palette[i]);
    const counts = relocate(source, volume, { remap, contexts, plan, min, paletteSize: palette.length });
    const { stepMaterials, stepBlocks, total } = summarize(counts, palette, plan.steps.length);

    return {
      volume,
      size,
      offset: [...min],
      phases: phaseDefs.map((p, i) => ({ title: p.title, text: p.text, tips: [...p.tips], steps: [...plan.phaseSteps[i]] })),
      steps: plan.steps.map((s) => ({ ...s, blockCount: stepBlocks[s.index], materials: stepMaterials[s.index] })),
      notes: this.#notes.map((n) => ({
        x: n.x - min[0], y: n.y - min[1], z: n.z - min[2], text: n.text, step: plan.noteStep(n.phase, n.step, n.y),
      })),
      materials: total,
      blockCount: volume.count,
      warnings,
    };
  }
}

// --- Hilfen für Dach und Treppe ---

function gableCell(area, axis, x, z) {
  const [v, vMin, vMax] = axis === 'x' ? [z, area.minZ, area.maxZ] : [x, area.minX, area.maxX];
  const low = v - vMin;
  const high = vMax - v;
  if (low === high) return { k: low, ridge: true };
  const facing = axis === 'x' ? (low < high ? 'south' : 'north') : (low < high ? 'east' : 'west');
  return { k: Math.min(low, high), ridge: false, facing };
}

// Walm-/Zeltdach: Ringe von außen nach innen; Ecken im Windrad-Muster, damit Außenecken entstehen.
function hipCell(area, x, z) {
  const dN = z - area.minZ;
  const dS = area.maxZ - z;
  const dW = x - area.minX;
  const dE = area.maxX - x;
  const k = Math.min(dN, dS, dW, dE);
  if ((dN === k && dS === k) || (dW === k && dE === k)) return { k, ridge: true };
  const n = dN === k;
  const s = dS === k;
  const w = dW === k;
  const e = dE === k;
  let facing;
  if (n && w) facing = 'east';
  else if (n && e) facing = 'south';
  else if (s && e) facing = 'west';
  else if (s && w) facing = 'north';
  else if (n) facing = 'south';
  else if (s) facing = 'north';
  else if (w) facing = 'east';
  else facing = 'west';
  return { k, ridge: false, facing };
}

// Quadratischer Ring im Uhrzeigersinn (von oben), Start an der Nordseite (cx, cz − r).
function squareRing(cx, cz, r) {
  const cells = [];
  for (let x = cx; x < cx + r; x++) cells.push([x, cz - r]);
  for (let z = cz - r; z < cz + r; z++) cells.push([cx + r, z]);
  for (let x = cx + r; x > cx - r; x--) cells.push([x, cz + r]);
  for (let z = cz + r; z > cz - r; z--) cells.push([cx - r, z]);
  for (let x = cx - r; x < cx; x++) cells.push([x, cz - r]);
  return cells;
}

// --- Hilfen für finalize ---

// Vervollständigt alle benutzten Zustände (Standardwerte) und baut eine kompakte Palette.
function completePalette(source) {
  const used = new Uint8Array(source.palette.length);
  for (const chunk of source.chunks.values()) {
    for (let i = 0; i < 4096; i++) used[chunk.blocks[i]] = 1;
  }
  const loaded = isBlockDataLoaded();
  const remap = new Uint16Array(source.palette.length);
  const palette = ['air'];
  const indexOf = new Map([['air', 0]]);
  for (let i = 1; i < source.palette.length; i++) {
    if (!used[i]) continue;
    const state = loaded ? completeState(source.palette[i]) : normalizeState(source.palette[i]);
    let index = indexOf.get(state);
    if (index === undefined) {
      index = palette.length;
      palette.push(state);
      indexOf.set(state, index);
    }
    remap[i] = index;
  }
  return { remap, palette };
}

function scanOccupancy(source, contexts, phases) {
  const occupancy = phases.map(() => ({ pre: false, layers: new Set() }));
  for (const chunk of source.chunks.values()) {
    const { blocks, steps } = chunk;
    const by = chunk.cy * 16;
    for (let i = 0; i < 4096; i++) {
      if (blocks[i] === 0) continue;
      const ctx = contexts[steps[i]];
      const occ = occupancy[ctx.phase];
      if (phases[ctx.phase].steps.length > 0) {
        if (ctx.step < 0) occ.pre = true;
      } else {
        occ.layers.add(by + (i >> 8));
      }
    }
  }
  return occupancy;
}

// Verschiebt alle Blöcke in das Ziel-Volumen (kleinste Ecke 0,0,0) mit endgültigen Schrittnummern.
// Gibt die Zählung je (Schritt, Paletten-Index) zurück.
function relocate(source, target, { remap, contexts, plan, min, paletteSize }) {
  const counts = new Map();
  const [mx, my, mz] = min;
  for (const chunk of source.chunkList()) {
    const { blocks, steps } = chunk;
    const bx = chunk.cx * 16;
    const by = chunk.cy * 16;
    const bz = chunk.cz * 16;
    for (let i = 0; i < 4096; i++) {
      const old = blocks[i];
      if (old === 0) continue;
      const y = by + (i >> 8);
      const ctx = contexts[steps[i]];
      const step = plan.stepFor(ctx.phase, ctx.step, y);
      const index = remap[old];
      target.setIndex(bx + (i & 15) - mx, y - my, bz + ((i >> 4) & 15) - mz, index, step);
      const key = step * paletteSize + index;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return { counts, paletteSize };
}

function summarize({ counts, paletteSize }, palette, stepCount) {
  const perStep = Array.from({ length: stepCount }, () => new Map());
  const stepBlocks = new Array(stepCount).fill(0);
  const totals = new Map();
  for (const [key, n] of counts) {
    const index = key % paletteSize;
    const step = (key - index) / paletteSize;
    const entry = itemForState(palette[index]);
    stepBlocks[step] += n;
    addItems(perStep[step], entry, n);
    addItems(totals, entry, n);
  }
  return { stepMaterials: perStep.map(sortMaterials), stepBlocks, total: sortMaterials(totals) };
}
