// Bauteile für Bau-Module (ARCHITEKTUR §9.1): Fenster, Türen, Schornsteine, Säulen, Bögen, Zinnen, Balkone,
// Treppen, Fachwerk, Kopfbänder, Gauben, Laternen, Bodenmuster und Gartenzäune.
// Alle Funktionen: fn(b, { x, y, z, facing = 'south', …optionen }) → Box { min, max } in den Koordinaten des
// Aufrufers (die dokumentierte Ausdehnung). Sie setzen nur über b, also wirken b.transform, Kapitel und Schritte.
//
// Gemeinsamer Rahmen („lokal“): Jedes Bauteil wird so gezeichnet, als zeige seine Vorderseite nach Süden (+z),
// und dann für facing gedreht. Lokal +x ist „rechts“ für jemanden, der vor dem Bauteil steht und es ansieht.
// Wandbauteile liegen in der Wandebene lz = 0; lz > 0 ist außen (vorne), lz < 0 innen.

import { makeTransform, applyToPoint } from '../../core/transform.js';
import { isBlockDataLoaded, blockProps } from '../../core/block-data.js';
import { formatState } from '../../core/blockstate.js';
import { hashPosition } from '../../core/random.js';
import { FLOWERS } from './palettes.js';

export const LIB_FACINGS = Object.freeze(['north', 'east', 'south', 'west']);
const ROTATE_FOR_FACING = Object.freeze({ south: 0, west: 90, north: 180, east: 270 });
const ID_PATTERN = /^[a-z0-9_]+$/;

// ------------------------------------------------------------------ gemeinsame Helfer (auch für innen.js/natur.js)

// Prüft b und die Optionen (unbekannte → Error), setzt Standardwerte; x, y, z ganzzahlig, facing gültig.
export function partOptions(fn, b, options, defaults) {
  if (!b || typeof b.set !== 'function' || typeof b.transform !== 'function') {
    throw new Error(`${fn}: der erste Parameter muss der Builder b sein.`);
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error(`${fn}: Optionen müssen ein Objekt sein, z. B. { x: 0, y: 0, z: 0 }.`);
  }
  const allowed = ['x', 'y', 'z', 'facing', ...Object.keys(defaults)];
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) throw new Error(`${fn}: unbekannte Option „${key}“ (erlaubt: ${allowed.join(', ')}).`);
  }
  const o = { facing: 'south', ...defaults };
  for (const [key, value] of Object.entries(options)) if (value !== undefined) o[key] = value;
  for (const key of ['x', 'y', 'z']) {
    if (!Number.isInteger(o[key])) throw new Error(`${fn}: ${key} muss eine ganze Zahl sein, bekommen: ${o[key]}.`);
  }
  checkChoice(fn, 'facing', o.facing, LIB_FACINGS);
  return o;
}

export function checkInt(fn, name, value, min, max = Infinity) {
  if (!Number.isInteger(value) || value < min || value > max) {
    const range = max === Infinity ? `≥ ${min}` : `von ${min} bis ${max}`;
    throw new Error(`${fn}: ${name} muss eine ganze Zahl ${range} sein, bekommen: ${value}.`);
  }
  return value;
}

export function checkChoice(fn, name, value, choices) {
  if (!choices.includes(value)) throw new Error(`${fn}: ${name} muss ${choices.map((c) => `'${c}'`).join(', ')} sein, bekommen: ${value}.`);
  return value;
}

// Block-ID ohne [Eigenschaften]; mit nullable darf null/false „weglassen“ bedeuten (→ null).
export function checkId(fn, name, value, { nullable = false, suffix = null } = {}) {
  if (nullable && (value === null || value === false)) return null;
  if (typeof value !== 'string') throw new Error(`${fn}: ${name} muss eine Block-ID sein (Text), bekommen: ${value}.`);
  const id = value.trim().replace(/^minecraft:/, '');
  if (!ID_PATTERN.test(id)) throw new Error(`${fn}: ${name} „${value}“ ist keine Block-ID (nur die ID ohne [Eigenschaften]).`);
  if (suffix && !id.endsWith(suffix)) throw new Error(`${fn}: ${name} „${id}“ passt nicht (erwartet *${suffix}).`);
  return id;
}

// Zeichnet im lokalen Rahmen (Vorderseite = Süden) und dreht für o.facing um den Ursprung (o.x, o.y, o.z).
export function placeOriented(b, o, draw) {
  return b.transform({ offset: [o.x, o.y, o.z], rotate: ROTATE_FOR_FACING[o.facing] }, draw);
}

// Lokale Box (inklusive Ecken) → Box in den Koordinaten des Aufrufers.
export function orientedBox(o, [x1, y1, z1], [x2, y2, z2]) {
  const t = makeTransform({ offset: [o.x, o.y, o.z], rotate: ROTATE_FOR_FACING[o.facing] });
  const a = applyToPoint(t, x1, y1, z1);
  const c = applyToPoint(t, x2, y2, z2);
  return {
    min: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])],
    max: [Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])],
  };
}

// Zentrierte Spanne für eine Breite: ungerade → symmetrisch, gerade → ein Feld mehr nach rechts (+x).
export function centeredSpan(width) {
  const lo = -Math.floor((width - 1) / 2);
  return { lo, hi: lo + width - 1 };
}

const AXIS_PATTERN = /(_log|_wood|_stem|_hyphae|_pillar|^bamboo_block|^stripped_bamboo_block|basalt|^hay_block|_chain|^bone_block|^muddy_mangrove_roots|froglight|^deepslate|^purpur_pillar)$/;

// Hängt [axis=…] an, wenn der Block eine Achse hat (Stämme, Säulen, Heuballen …), sonst die ID unverändert.
export function withAxis(id, axis) {
  const hasAxis = isBlockDataLoaded() ? Boolean(blockProps(id)?.axis?.includes(axis)) : AXIS_PATTERN.test(id);
  return hasAxis ? formatState(id, { axis }) : id;
}

// Passende Stufe zu einer Treppe: oak_stairs → oak_slab, stone_brick_stairs → stone_brick_slab.
export function slabFor(stairsId) {
  if (typeof stairsId !== 'string' || !stairsId.endsWith('_stairs')) throw new Error(`slabFor: „${stairsId}“ ist keine Treppen-ID.`);
  return `${stairsId.slice(0, -'_stairs'.length)}_slab`;
}

const stairs = (id, facing, half = 'bottom') => formatState(id, { facing, half });
const slab = (id, type) => formatState(id, { type });
const trapdoor = (id, facing, { open = true, half = 'bottom' } = {}) => formatState(id, { facing, half, open: String(open) });
const outward = (lx, center) => (lx < center ? 'west' : 'east');

// ------------------------------------------------------------------ Bogenprofil (für arch und Bogenfenster)

// Öffnung mit rundem/spitzem Abschluss: width Spalten, height = Höhe der Öffnung in der Mitte.
// Liefert je Zelle (Spalte lx, Ebene ly) 'open' | 'stairs' (obere Treppe, hohe Seite nach außen) | 'slab' (obere Stufe) | 'solid'.
export function archProfile(width, height, style = 'round') {
  checkInt('archProfile', 'width', width, 1, 64);
  checkInt('archProfile', 'height', height, 1, 128);
  checkChoice('archProfile', 'style', style, ['round', 'pointed']);
  const { lo, hi } = centeredSpan(width);
  const R = width / 2;
  const rise = style === 'round' ? R : R * Math.SQRT2;
  const spring = height - rise;
  if (spring < 0) {
    throw new Error(`archProfile: ein ${style === 'round' ? 'Rundbogen' : 'Spitzbogen'} mit Breite ${width} braucht mindestens Höhe ${Math.ceil(rise)}.`);
  }
  const center = (lo + hi) / 2;
  const top = (lx) => {
    const d = Math.abs(lx - center);
    if (style === 'round') return spring + Math.sqrt(Math.max(0, R * R - d * d));
    return spring + Math.sqrt(Math.max(0, 2.25 * R * R - (d + 0.5 * R) ** 2));
  };
  const lowerOpen = (lx, ly) => lx >= lo && lx <= hi && ly + 0.25 < top(lx);
  const upperOpen = (lx, ly) => lx >= lo && lx <= hi && ly + 0.75 < top(lx);
  const cells = new Map();
  for (let lx = lo; lx <= hi; lx++) {
    // Nachbarspalte zur Mitte hin (bei gerader Breite ist das für die beiden Mittelspalten die jeweils andere).
    const inner = lx < center ? lx + 1 : lx - 1;
    const centerPair = Math.abs(lx - center) === 0.5;
    for (let ly = 0; ly < height; ly++) {
      let kind;
      if (width === 2 && ly === height - 1) kind = 'stairs';
      else if (upperOpen(lx, ly)) kind = 'open';
      else if (lowerOpen(lx, ly)) kind = centerPair || style === 'pointed' || upperOpen(inner, ly) ? 'stairs' : 'slab';
      else if (ly > 0 && upperOpen(lx, ly - 1) && upperOpen(inner, ly)) kind = 'stairs';
      else kind = 'solid';
      cells.set(`${lx},${ly}`, kind);
    }
  }
  return { lo, hi, center, get: (lx, ly) => cells.get(`${lx},${ly}`) ?? 'solid' };
}

// ------------------------------------------------------------------ Fenster

const WINDOW_DEFAULTS = {
  width: 1, height: 2, style: 'pane', glass: 'glass_pane', frame: undefined, stairs: 'spruce_stairs', slab: null,
  sill: undefined, shutters: null, flowerBox: null,
};

function flowerBoxOptions(value) {
  if (value === null || value === false) return null;
  const defaults = { trapdoor: 'spruce_trapdoor', soil: 'rooted_dirt', flowers: FLOWERS };
  if (value === true) return defaults;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('window: flowerBox muss true, null oder { trapdoor, soil, flowers } sein.');
  for (const key of Object.keys(value)) if (!(key in defaults)) throw new Error(`window: flowerBox kennt die Option „${key}“ nicht (erlaubt: trapdoor, soil, flowers).`);
  const box = { ...defaults, ...value };
  if (!Array.isArray(box.flowers) || box.flowers.length === 0) throw new Error('window: flowerBox.flowers muss eine nicht leere Liste sein.');
  return {
    trapdoor: checkId('window', 'flowerBox.trapdoor', box.trapdoor, { suffix: '_trapdoor' }),
    soil: checkId('window', 'flowerBox.soil', box.soil),
    flowers: box.flowers.map((f) => checkId('window', 'flowerBox.flowers', f)),
  };
}

// Fenster in einer Wand. Ursprung = unterste Zelle der Öffnung (Mitte) in der Wandebene; vorne = außen.
// style: 'pane' (nur Glas) | 'framed' (Rahmen, Standard Fichte geschält, + Fensterbank) | 'arched' (Rundbogen oben)
// | 'round' (Rundfenster, width = height = 3 oder 5). Zusätze für jeden Stil: frame, sill, shutters, flowerBox.
export function window(b, options) {
  const o = partOptions('window', b, options, WINDOW_DEFAULTS);
  checkChoice('window', 'style', o.style, ['pane', 'framed', 'arched', 'round']);
  if (o.style === 'round') {
    if (options.height !== undefined && options.height !== o.width) throw new Error('window: ein Rundfenster ist quadratisch – gib nur width (3 oder 5) an.');
    if (options.width === undefined) o.width = 3;
    checkChoice('window', 'width', o.width, [3, 5]);
    o.height = o.width;
  }
  checkInt('window', 'width', o.width, 1, 16);
  checkInt('window', 'height', o.height, 1, 16);
  if (o.style === 'arched' && o.width < 2) throw new Error('window: ein Bogenfenster braucht width ≥ 2.');
  const glass = checkId('window', 'glass', o.glass);
  const frame = o.frame === undefined ? (o.style === 'framed' ? 'stripped_spruce_log' : null) : checkId('window', 'frame', o.frame, { nullable: true });
  const stairsId = checkId('window', 'stairs', o.stairs, { suffix: '_stairs' });
  const slabId = o.slab === null ? slabFor(stairsId) : checkId('window', 'slab', o.slab, { suffix: '_slab' });
  const flowerBox = flowerBoxOptions(o.flowerBox);
  let sill = o.sill === undefined ? (o.style === 'framed' ? stairsId : null) : checkId('window', 'sill', o.sill, { nullable: true, suffix: '_stairs' });
  if (flowerBox) sill = null;
  const shutters = checkId('window', 'shutters', o.shutters, { nullable: true, suffix: '_trapdoor' });
  const { lo, hi } = centeredSpan(o.width);
  const H = o.height;

  placeOriented(b, o, () => {
    const cellState = windowCells(o.style, o.width, H, lo, hi, stairsId, slabId);
    for (let lx = lo; lx <= hi; lx++) {
      for (let ly = 0; ly < H; ly++) {
        const state = cellState(lx, ly);
        if (state === 'glass') b.set(lx, ly, 0, glass);
        else if (state === 'solid') { if (frame) b.set(lx, ly, 0, frame); }
        else b.set(lx, ly, 0, state);
      }
    }
    if (frame) {
      for (let lx = lo - 1; lx <= hi + 1; lx++) {
        for (let ly = -1; ly <= H; ly++) {
          const ring = lx === lo - 1 || lx === hi + 1 || ly === -1 || ly === H;
          if (!ring) continue;
          const vertical = ly !== -1 && ly !== H;
          b.set(lx, ly, 0, withAxis(frame, vertical ? 'y' : 'x'));
        }
      }
    }
    if (sill) for (let lx = lo; lx <= hi; lx++) b.set(lx, -1, 1, stairs(sill, 'north', 'top'));
    if (shutters) {
      for (let ly = 0; ly < H; ly++) {
        b.set(lo - 1, ly, 1, trapdoor(shutters, 'south'));
        b.set(hi + 1, ly, 1, trapdoor(shutters, 'south'));
      }
    }
    if (flowerBox) drawFlowerBox(b, o, flowerBox, lo, hi);
  });

  const wide = Boolean(frame || shutters || flowerBox);
  const yMin = frame || sill || flowerBox ? -1 : 0;
  const zMax = flowerBox ? 2 : sill || shutters ? 1 : 0;
  return orientedBox(o, [wide ? lo - 1 : lo, yMin, 0], [wide ? hi + 1 : hi, frame ? H : H - 1, zMax]);
}

// Zustand je Zelle der Öffnung: 'glass', 'solid' (Wand/Rahmen) oder ein fertiger Zustand (Treppe/Stufe).
function windowCells(style, width, height, lo, hi, stairsId, slabId) {
  if (style === 'arched') {
    const profile = archProfile(width, height, 'round');
    return (lx, ly) => {
      const kind = profile.get(lx, ly);
      if (kind === 'open') return 'glass';
      if (kind === 'stairs') return stairs(stairsId, outward(lx, profile.center), 'top');
      if (kind === 'slab') return slab(slabId, 'top');
      return 'solid';
    };
  }
  if (style === 'round') {
    const r = (width - 1) / 2;
    const corner = (lx, ly) => {
      const side = lx < 0 ? 'west' : 'east';
      return stairs(stairsId, side, ly > r ? 'top' : 'bottom');
    };
    return (lx, ly) => {
      const dx = Math.abs(lx);
      const dy = Math.abs(ly - r);
      if (r === 1) return dx === 1 && dy === 1 ? corner(lx, ly) : 'glass';
      if (dx === 2 && dy === 2) return 'solid';
      if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) return corner(lx, ly);
      return 'glass';
    };
  }
  return () => 'glass';
}

function drawFlowerBox(b, o, box, lo, hi) {
  for (let lx = lo; lx <= hi; lx++) {
    b.set(lx, -1, 1, box.soil);
    b.set(lx, -1, 2, trapdoor(box.trapdoor, 'south'));
    const pick = hashPosition(o.x * 7 + lx, o.y, o.z * 13 + ROTATE_FOR_FACING[o.facing], 4711) % box.flowers.length;
    b.set(lx, 0, 1, box.flowers[pick]);
  }
  b.set(lo - 1, -1, 1, trapdoor(box.trapdoor, 'west'));
  b.set(hi + 1, -1, 1, trapdoor(box.trapdoor, 'east'));
}

// ------------------------------------------------------------------ Tür mit Rahmen und Vordach

function canopyOptions(value) {
  if (value === null || value === false) return null;
  if (typeof value === 'string') return { stairs: checkId('doorway', 'canopy', value, { suffix: '_stairs' }), depth: 1, posts: null };
  if (value === true) return { stairs: 'spruce_stairs', depth: 1, posts: null };
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('doorway: canopy muss null, eine Treppen-ID oder { stairs, depth, posts } sein.');
  for (const key of Object.keys(value)) if (!['stairs', 'depth', 'posts'].includes(key)) throw new Error(`doorway: canopy kennt die Option „${key}“ nicht (erlaubt: stairs, depth, posts).`);
  const depth = value.depth ?? 1;
  checkChoice('doorway', 'canopy.depth', depth, [1, 2]);
  return {
    stairs: checkId('doorway', 'canopy.stairs', value.stairs ?? 'spruce_stairs', { suffix: '_stairs' }),
    depth,
    posts: depth === 2 ? checkId('doorway', 'canopy.posts', value.posts ?? 'spruce_fence') : null,
  };
}

// Tür (1 oder 2 breit) in einer Wand. Ursprung = untere Türhälfte (bei width 2 die linke Tür) in der Wandebene;
// facing = außen (dort hängt das Vordach). Die Tür öffnet nach innen.
export function doorway(b, options) {
  const o = partOptions('doorway', b, options, { door: 'spruce_door', width: 1, frame: 'stripped_spruce_log', canopy: null, step: null, open: false });
  checkChoice('doorway', 'width', o.width, [1, 2]);
  const door = checkId('doorway', 'door', o.door, { suffix: '_door' });
  const frame = checkId('doorway', 'frame', o.frame, { nullable: true });
  const canopy = canopyOptions(o.canopy);
  const step = checkId('doorway', 'step', o.step, { nullable: true, suffix: '_stairs' });
  if (typeof o.open !== 'boolean') throw new Error('doorway: open muss true oder false sein.');
  const lo = 0;
  const hi = o.width - 1;

  placeOriented(b, o, () => {
    if (o.width === 1) b.door(0, 0, 0, door, { facing: 'north', hinge: 'left', open: o.open });
    else {
      b.door(lo, 0, 0, door, { facing: 'north', hinge: 'left', open: o.open });
      b.door(hi, 0, 0, door, { facing: 'north', hinge: 'right', open: o.open });
    }
    if (frame) {
      for (let ly = 0; ly <= 1; ly++) {
        b.set(lo - 1, ly, 0, withAxis(frame, 'y'));
        b.set(hi + 1, ly, 0, withAxis(frame, 'y'));
      }
      for (let lx = lo - 1; lx <= hi + 1; lx++) b.set(lx, 2, 0, withAxis(frame, 'x'));
    }
    if (canopy) {
      for (let lx = lo - 1; lx <= hi + 1; lx++) b.set(lx, 3, 1, stairs(canopy.stairs, 'north'));
      if (canopy.depth === 1) {
        b.set(lo - 1, 2, 1, stairs(canopy.stairs, 'north', 'top'));
        b.set(hi + 1, 2, 1, stairs(canopy.stairs, 'north', 'top'));
      } else {
        for (let lx = lo - 1; lx <= hi + 1; lx++) b.set(lx, 2, 2, stairs(canopy.stairs, 'north'));
        for (let ly = 0; ly <= 1; ly++) {
          b.set(lo - 1, ly, 2, canopy.posts);
          b.set(hi + 1, ly, 2, canopy.posts);
        }
      }
    }
    if (step) for (let lx = lo; lx <= hi; lx++) b.set(lx, -1, 1, stairs(step, 'north'));
  });

  const wide = Boolean(frame || canopy);
  const yMax = canopy ? 3 : frame ? 2 : 1;
  const zMax = canopy ? canopy.depth : step ? 1 : 0;
  return orientedBox(o, [wide ? lo - 1 : lo, step ? -1 : 0, 0], [wide ? hi + 1 : hi, yMax, zMax]);
}

// ------------------------------------------------------------------ Schornstein

// Schornstein. Ursprung = Mitte der untersten Ebene. width 1 oder 3 (quadratisch).
// smoke: 'normal' (Lagerfeuer oben), 'tall' (Heuballen darunter → Signalfeuer, Rauch steigt viel höher), 'none'.
// Bei width 1 sitzt das Lagerfeuer auf dem Schaft (eine Ebene über height − 1), bei width 3 vertieft in der Mitte.
export function chimney(b, options) {
  const o = partOptions('chimney', b, options, { height: 4, block: 'bricks', width: 1, smoke: 'normal', rim: null, fire: 'campfire' });
  checkInt('chimney', 'height', o.height, 2, 256);
  checkChoice('chimney', 'width', o.width, [1, 3]);
  checkChoice('chimney', 'smoke', o.smoke, ['normal', 'tall', 'none']);
  checkChoice('chimney', 'fire', o.fire, ['campfire', 'soul_campfire']);
  const block = checkId('chimney', 'block', o.block);
  const rim = checkId('chimney', 'rim', o.rim, { nullable: true, suffix: '_stairs' });
  const r = (o.width - 1) / 2;
  const top = o.height - 1;
  const fire = formatState(o.fire, { facing: 'south', lit: 'true', signal_fire: String(o.smoke === 'tall') });

  placeOriented(b, o, () => {
    b.fill(-r, 0, -r, r, top, r, block);
    if (o.width === 1) {
      if (o.smoke !== 'none') b.set(0, top + 1, 0, fire);
      if (o.smoke === 'tall') b.set(0, top, 0, withAxis('hay_block', 'y'));
    } else if (o.smoke !== 'none') {
      b.set(0, top, 0, fire);
      b.set(0, top - 1, 0, o.smoke === 'tall' ? withAxis('hay_block', 'y') : block);
    }
    if (rim) ringOfStairs(b, r + 1, top, rim, 'top');
  });
  const ext = rim ? r + 1 : r;
  return orientedBox(o, [-ext, 0, -ext], [ext, o.width === 1 && o.smoke !== 'none' ? top + 1 : top, ext]);
}

// Quadratischer Ring aus Treppen im Abstand d um (0, ly, 0), hohe Seite zur Mitte; Ecken werden automatisch zu Außenecken.
function ringOfStairs(b, d, ly, id, half) {
  for (let i = -d; i <= d; i++) {
    b.set(i, ly, -d, stairs(id, 'south', half));
    b.set(i, ly, d, stairs(id, 'north', half));
  }
  for (let i = -d + 1; i <= d - 1; i++) {
    b.set(-d, ly, i, stairs(id, 'east', half));
    b.set(d, ly, i, stairs(id, 'west', half));
  }
}

// ------------------------------------------------------------------ Säule

// Säule mit Basis, Schaft und Kapitell. Ursprung = Mitte der Basis. trim = Treppen-Kranz (3 × 3) an Basis und Kapitell.
export function column(b, options) {
  const o = partOptions('column', b, options, {
    height: 5, shaft: 'quartz_pillar', base: 'smooth_quartz', capital: 'chiseled_quartz_block', trim: 'smooth_quartz_stairs',
  });
  checkInt('column', 'height', o.height, 3, 256);
  const shaft = checkId('column', 'shaft', o.shaft);
  const base = checkId('column', 'base', o.base);
  const capital = checkId('column', 'capital', o.capital);
  const trim = checkId('column', 'trim', o.trim, { nullable: true, suffix: '_stairs' });
  const top = o.height - 1;
  placeOriented(b, o, () => {
    b.set(0, 0, 0, base);
    for (let ly = 1; ly < top; ly++) b.set(0, ly, 0, withAxis(shaft, 'y'));
    b.set(0, top, 0, capital);
    if (trim) {
      ringOfStairs(b, 1, 0, trim, 'bottom');
      ringOfStairs(b, 1, top, trim, 'top');
    }
  });
  const r = trim ? 1 : 0;
  return orientedBox(o, [-r, 0, -r], [r, top, r]);
}

// ------------------------------------------------------------------ Bogen

// Bogen (Durchgang) in einer Wand. Ursprung = unterste Zelle der Öffnung (Mitte) in der Wandebene, facing = vorne.
// Die Öffnung wird freigeräumt (Luft); Pfeiler links/rechts und eine Scheitelreihe darüber aus block.
// depth > 1 wiederholt den Bogen nach hinten (lz 0 … −(depth − 1)).
export function arch(b, options) {
  const o = partOptions('arch', b, options, {
    width: 3, height: 4, style: 'round', block: 'stone_bricks', stairs: 'stone_brick_stairs', slab: null, depth: 1, pillars: true,
  });
  checkInt('arch', 'width', o.width, 1, 64);
  checkInt('arch', 'height', o.height, 1, 128);
  checkInt('arch', 'depth', o.depth, 1, 64);
  const block = checkId('arch', 'block', o.block);
  const stairsId = checkId('arch', 'stairs', o.stairs, { suffix: '_stairs' });
  const slabId = o.slab === null ? slabFor(stairsId) : checkId('arch', 'slab', o.slab, { suffix: '_slab' });
  if (typeof o.pillars !== 'boolean') throw new Error('arch: pillars muss true oder false sein.');
  const profile = archProfile(o.width, o.height, o.style);
  const { lo, hi } = profile;
  placeOriented(b, o, () => {
    for (let lz = 0; lz > -o.depth; lz--) {
      for (let lx = lo; lx <= hi; lx++) {
        for (let ly = 0; ly < o.height; ly++) {
          const kind = profile.get(lx, ly);
          if (kind === 'open') b.set(lx, ly, lz, 'air');
          else if (kind === 'stairs') b.set(lx, ly, lz, stairs(stairsId, outward(lx, profile.center), 'top'));
          else if (kind === 'slab') b.set(lx, ly, lz, slab(slabId, 'top'));
          else b.set(lx, ly, lz, block);
        }
      }
      for (let lx = lo - 1; lx <= hi + 1; lx++) b.set(lx, o.height, lz, block);
      if (o.pillars) {
        for (let ly = 0; ly < o.height; ly++) {
          b.set(lo - 1, ly, lz, block);
          b.set(hi + 1, ly, lz, block);
        }
      }
    }
  });
  return orientedBox(o, [lo - 1, 0, -(o.depth - 1)], [hi + 1, o.height, 0]);
}

// ------------------------------------------------------------------ Zinnen und Schießscharten

// Zinnenkranz auf einer Mauerkrone. Ursprung = linkes Ende der Reihe (lx 0 … length − 1) auf Höhe der Brüstung,
// facing = Feldseite (außen). parapet Ebenen Brüstung, darüber Zinnen (merlon breit, height hoch) mit Lücken (gap).
// corbels: Treppen-ID → Reihe springt um 1 nach außen vor (lz 1) und sitzt auf Konsolen (Gusserker-Optik).
export function battlements(b, options) {
  const o = partOptions('battlements', b, options, {
    length: 5, block: 'stone_bricks', parapet: 1, height: 1, merlon: 1, gap: 1, cap: null, corbels: null,
  });
  checkInt('battlements', 'length', o.length, 1, 4096);
  checkInt('battlements', 'parapet', o.parapet, 0, 8);
  checkInt('battlements', 'height', o.height, 1, 8);
  checkInt('battlements', 'merlon', o.merlon, 1, 16);
  checkInt('battlements', 'gap', o.gap, 1, 16);
  const block = checkId('battlements', 'block', o.block);
  const cap = checkId('battlements', 'cap', o.cap, { nullable: true, suffix: '_slab' });
  const corbels = checkId('battlements', 'corbels', o.corbels, { nullable: true, suffix: '_stairs' });
  const lz = corbels ? 1 : 0;
  const period = o.merlon + o.gap;
  const isMerlon = (i) => i % period < o.merlon || i === o.length - 1;
  const top = o.parapet + o.height - 1;
  placeOriented(b, o, () => {
    for (let i = 0; i < o.length; i++) {
      for (let ly = 0; ly < o.parapet; ly++) b.set(i, ly, lz, block);
      if (isMerlon(i)) {
        for (let ly = o.parapet; ly <= top; ly++) b.set(i, ly, lz, block);
        if (cap) b.set(i, top + 1, lz, slab(cap, 'bottom'));
      }
      if (corbels) b.set(i, -1, 1, stairs(corbels, 'north', 'top'));
    }
  });
  return orientedBox(o, [0, corbels ? -1 : 0, 0], [o.length - 1, cap ? top + 1 : top, lz]);
}

// Schießscharte: schmaler Schlitz durch die Wand. Ursprung = unterste Zelle in der Wandebene (Mitte).
// style 'slit' (1 breit) oder 'cross' (Kreuz: Querarm in der oberen Mitte); fill = Block im Schlitz (Standard Luft).
export function arrowSlit(b, options) {
  const o = partOptions('arrowSlit', b, options, { height: 3, style: 'slit', depth: 1, fill: 'air' });
  checkInt('arrowSlit', 'height', o.height, 1, 16);
  checkInt('arrowSlit', 'depth', o.depth, 1, 16);
  checkChoice('arrowSlit', 'style', o.style, ['slit', 'cross']);
  if (o.style === 'cross' && o.height < 3) throw new Error('arrowSlit: ein Kreuz braucht height ≥ 3.');
  const fill = checkId('arrowSlit', 'fill', o.fill);
  const armY = Math.ceil((o.height - 1) / 2);
  placeOriented(b, o, () => {
    for (let lz = 0; lz > -o.depth; lz--) {
      for (let ly = 0; ly < o.height; ly++) b.set(0, ly, lz, fill);
      if (o.style === 'cross') {
        b.set(-1, armY, lz, fill);
        b.set(1, armY, lz, fill);
      }
    }
  });
  const r = o.style === 'cross' ? 1 : 0;
  return orientedBox(o, [-r, 0, -(o.depth - 1)], [r, o.height - 1, 0]);
}

// ------------------------------------------------------------------ Balkon

// Balkon vor einer Wand. Ursprung = Wandzelle (Mitte) auf Höhe des Balkonbodens; der Boden liegt davor
// (lz 1 … depth), das Geländer eine Ebene höher am Rand, Konsolen (obere Treppen) unter den Ecken an der Wand.
export function balcony(b, options) {
  const o = partOptions('balcony', b, options, { width: 3, depth: 2, floor: 'spruce_planks', railing: 'spruce_fence', supports: 'spruce_stairs' });
  checkInt('balcony', 'width', o.width, 1, 64);
  checkInt('balcony', 'depth', o.depth, 1, 16);
  const floor = checkId('balcony', 'floor', o.floor);
  const railing = checkId('balcony', 'railing', o.railing, { nullable: true });
  const supports = checkId('balcony', 'supports', o.supports, { nullable: true, suffix: '_stairs' });
  const { lo, hi } = centeredSpan(o.width);
  placeOriented(b, o, () => {
    b.fill(lo, 0, 1, hi, 0, o.depth, floor);
    if (railing) {
      for (let lx = lo; lx <= hi; lx++) b.set(lx, 1, o.depth, railing);
      for (let lz = 1; lz < o.depth; lz++) {
        b.set(lo, 1, lz, railing);
        b.set(hi, 1, lz, railing);
      }
    }
    if (supports) {
      for (const lx of new Set([lo, hi])) {
        b.set(lx, -1, 1, stairs(supports, 'north', 'top'));
        if (o.depth >= 3) b.set(lx, -2, 1, stairs(supports, 'north', 'top'));
      }
    }
  });
  const yMin = supports ? (o.depth >= 3 ? -2 : -1) : 0;
  return orientedBox(o, [lo, yMin, 1], [hi, railing ? 1 : 0, o.depth]);
}

// ------------------------------------------------------------------ Gerade Treppe

// Gerade Treppe, die in facing-Richtung ansteigt. Ursprung = unterste Stufe (Mitte); Stufe k liegt bei (·, k, k).
// support füllt unter den Stufen (Treppenwange), railing setzt seitlich Pfosten auf eine Wange.
export function straightStairs(b, options) {
  const o = partOptions('straightStairs', b, options, { width: 1, height: 4, stairs: 'spruce_stairs', support: 'spruce_planks', railing: null });
  checkInt('straightStairs', 'width', o.width, 1, 32);
  checkInt('straightStairs', 'height', o.height, 1, 256);
  const stairsId = checkId('straightStairs', 'stairs', o.stairs, { suffix: '_stairs' });
  const support = checkId('straightStairs', 'support', o.support, { nullable: true });
  const railing = checkId('straightStairs', 'railing', o.railing, { nullable: true });
  if (railing && !support) throw new Error('straightStairs: railing braucht support (die Pfosten stehen auf der Wange).');
  const { lo, hi } = centeredSpan(o.width);
  placeOriented(b, o, () => {
    for (let k = 0; k < o.height; k++) {
      for (let lx = lo; lx <= hi; lx++) {
        b.set(lx, k, k, stairs(stairsId, 'south'));
        if (support && k > 0) b.fill(lx, 0, k, lx, k - 1, k, support);
      }
      if (railing) {
        for (const side of [lo - 1, hi + 1]) {
          b.fill(side, 0, k, side, k, k, support);
          b.set(side, k + 1, k, railing);
        }
      }
    }
  });
  const r = railing ? 1 : 0;
  return orientedBox(o, [lo - r, 0, 0], [hi + r, o.height - 1 + r, o.height - 1]);
}

// ------------------------------------------------------------------ Fachwerk, Stützen, Kopfbänder

// Fachwerkwand. Ursprung = linke untere Ecke (von vorne gesehen), Wand in der Ebene lz = 0 (lx 0 … length − 1).
// Rahmen: Schwelle unten, Rähm oben, Ständer alle spacing Blöcke; pattern 'grid' (+ Riegel in der Mitte),
// 'cross' (Andreaskreuze), 'diagonal' (Streben im Wechsel /\), 'plain' (nur Rahmen). Füllung = fill.
export function timberWall(b, options) {
  const o = partOptions('timberWall', b, options, {
    length: 9, height: 4, frame: 'stripped_dark_oak_log', fill: 'white_terracotta', brace: null, pattern: 'diagonal', spacing: 4,
  });
  checkInt('timberWall', 'length', o.length, 2, 1024);
  checkInt('timberWall', 'height', o.height, 2, 64);
  checkInt('timberWall', 'spacing', o.spacing, 2, 64);
  checkChoice('timberWall', 'pattern', o.pattern, ['grid', 'cross', 'diagonal', 'plain']);
  const frame = checkId('timberWall', 'frame', o.frame);
  const fill = checkId('timberWall', 'fill', o.fill);
  const brace = o.brace === null ? frame : checkId('timberWall', 'brace', o.brace);
  const L = o.length - 1;
  const T = o.height - 1;
  const posts = [];
  for (let lx = 0; lx < L; lx += o.spacing) posts.push(lx);
  posts.push(L);
  placeOriented(b, o, () => {
    b.fill(0, 0, 0, L, T, 0, fill);
    for (let lx = 0; lx <= L; lx++) {
      b.set(lx, 0, 0, withAxis(frame, 'x'));
      b.set(lx, T, 0, withAxis(frame, 'x'));
    }
    for (const lx of posts) for (let ly = 1; ly < T; ly++) b.set(lx, ly, 0, withAxis(frame, 'y'));
    if (o.pattern === 'grid' && T >= 4) {
      const mid = Math.floor(T / 2);
      for (let lx = 0; lx <= L; lx++) if (!posts.includes(lx)) b.set(lx, mid, 0, withAxis(frame, 'x'));
    }
    if (o.pattern === 'cross' || o.pattern === 'diagonal') {
      for (let i = 0; i < posts.length - 1; i++) {
        const x1 = posts[i] + 1;
        const x2 = posts[i + 1] - 1;
        if (x2 < x1 || T < 3) continue;
        const rising = o.pattern === 'cross' || i % 2 === 0;
        if (rising) b.line(x1, 1, 0, x2, T - 1, 0, brace);
        if (o.pattern === 'cross' || !rising) b.line(x1, T - 1, 0, x2, 1, 0, brace);
      }
    }
  });
  return orientedBox(o, [0, 0, 0], [L, T, 0]);
}

// Kopfband/Konsole unter einem vorspringenden Balken. Ursprung = Wandzelle (lz 0) auf der Höhe direkt unter dem
// Balken. Das Band steigt von der Wand nach außen: Zelle i (0 … length − 1) bei (0, −(length − 1 − i), 1 + i),
// je eine obere Treppe mit der hohen Seite zur Wand. beam: Stamm-ID → Balken eine Ebene darüber (lz 1 … length).
export function brace(b, options) {
  const o = partOptions('brace', b, options, { length: 1, stairs: 'dark_oak_stairs', beam: null });
  checkInt('brace', 'length', o.length, 1, 8);
  const stairsId = checkId('brace', 'stairs', o.stairs, { suffix: '_stairs' });
  const beam = checkId('brace', 'beam', o.beam, { nullable: true });
  const L = o.length;
  placeOriented(b, o, () => {
    for (let i = 0; i < L; i++) b.set(0, -(L - 1 - i), 1 + i, stairs(stairsId, 'north', 'top'));
    if (beam) for (let lz = 1; lz <= L; lz++) b.set(0, 1, lz, withAxis(beam, 'z'));
  });
  return orientedBox(o, [0, -(L - 1), 1], [0, beam ? 1 : 0, L]);
}

// Stützpfosten mit Kopfbändern. Ursprung = Fuß des Pfostens; oben je eine obere Treppe links/rechts (sides 2,
// entlang lokal x) oder an allen vier Seiten (sides 4), hohe Seite außen → trägt einen Balken darüber.
export function supportPost(b, options) {
  const o = partOptions('supportPost', b, options, { height: 3, log: 'dark_oak_log', braces: 'dark_oak_stairs', sides: 2 });
  checkInt('supportPost', 'height', o.height, 1, 256);
  checkChoice('supportPost', 'sides', o.sides, [2, 4]);
  const log = checkId('supportPost', 'log', o.log);
  const braces = checkId('supportPost', 'braces', o.braces, { nullable: true, suffix: '_stairs' });
  const top = o.height - 1;
  placeOriented(b, o, () => {
    for (let ly = 0; ly <= top; ly++) b.set(0, ly, 0, withAxis(log, 'y'));
    if (braces) {
      b.set(-1, top, 0, stairs(braces, 'west', 'top'));
      b.set(1, top, 0, stairs(braces, 'east', 'top'));
      if (o.sides === 4) {
        b.set(0, top, -1, stairs(braces, 'north', 'top'));
        b.set(0, top, 1, stairs(braces, 'south', 'top'));
      }
    }
  });
  const rx = braces ? 1 : 0;
  const rz = braces && o.sides === 4 ? 1 : 0;
  return orientedBox(o, [-rx, 0, -rz], [rx, top, rz]);
}

// ------------------------------------------------------------------ Dachgaube

// Dachgaube mit eigenem Satteldach (First quer zum Hauptdach). Ursprung = unterste Zelle der Vorderwand (Mitte),
// facing = Blickrichtung des Fensters (talseitig). Körper lx −r … r (r = (width − 1) / 2), lz −(depth − 1) … 0;
// das Dach steht seitlich und vorne einen Block über. Innen wird freigeräumt. Ohne depth: wallHeight + r + 1
// (passt zu Hauptdächern mit 45°, wie sie b.roof baut: dann taucht der Gaubenfirst hinten ins Hauptdach).
export function dormer(b, options) {
  const o = partOptions('dormer', b, options, {
    width: 3, wallHeight: 2, depth: null, wall: 'spruce_planks', corner: 'spruce_log', stairs: 'dark_oak_stairs', slab: null, glass: 'glass_pane',
  });
  checkInt('dormer', 'width', o.width, 3, 15);
  if (o.width % 2 === 0) throw new Error('dormer: width muss ungerade sein (3, 5, …).');
  checkInt('dormer', 'wallHeight', o.wallHeight, 1, 8);
  // Standard: so tief, dass ein 45°-Hauptdach den First der Gaube hinten wieder erreicht.
  if (o.depth === null) o.depth = o.wallHeight + (o.width - 1) / 2 + 1;
  checkInt('dormer', 'depth', o.depth, 2, 32);
  const wall = checkId('dormer', 'wall', o.wall);
  const corner = checkId('dormer', 'corner', o.corner, { nullable: true });
  const stairsId = checkId('dormer', 'stairs', o.stairs, { suffix: '_stairs' });
  const slabId = o.slab === null ? slabFor(stairsId) : checkId('dormer', 'slab', o.slab, { suffix: '_slab' });
  const glass = checkId('dormer', 'glass', o.glass, { nullable: true });
  const r = (o.width - 1) / 2;
  const H = o.wallHeight;
  const back = -(o.depth - 1);
  const roofY = (off) => H - 1 + (r + 1 - Math.abs(off));
  placeOriented(b, o, () => {
    for (let lz = back; lz <= 0; lz++) {
      for (let lx = -r; lx <= r; lx++) {
        for (let ly = 0; ly < H; ly++) {
          const shell = lx === -r || lx === r || lz === 0;
          b.set(lx, ly, lz, shell ? wall : 'air');
        }
        // Giebeldreieck: vorne und hinten zu, dazwischen frei.
        if (Math.abs(lx) < r) {
          for (let ly = H; ly < roofY(lx); ly++) b.set(lx, ly, lz, lz === 0 || lz === back ? wall : 'air');
        }
      }
      if (corner && lz === 0) for (let ly = 0; ly < H; ly++) { b.set(-r, ly, 0, withAxis(corner, 'y')); b.set(r, ly, 0, withAxis(corner, 'y')); }
    }
    for (let lz = back; lz <= 1; lz++) {
      for (let off = -(r + 1); off <= r + 1; off++) {
        const state = off === 0 ? slab(slabId, 'bottom') : stairs(stairsId, off < 0 ? 'east' : 'west');
        b.set(off, roofY(off), lz, state);
      }
    }
    if (glass) for (let lx = -(r - 1); lx <= r - 1; lx++) for (let ly = 0; ly < H; ly++) b.set(lx, ly, 0, glass);
  });
  return orientedBox(o, [-(r + 1), 0, back], [r + 1, H + r, 1]);
}

// ------------------------------------------------------------------ Laternen

// Hängende Laterne. Ursprung = Zelle direkt unter der Decke; chain Kettenglieder, darunter die Laterne (hanging).
export function hangingLantern(b, options) {
  const o = partOptions('hangingLantern', b, options, { chain: 1, lantern: 'lantern', chainBlock: 'iron_chain' });
  checkInt('hangingLantern', 'chain', o.chain, 0, 32);
  const lantern = checkId('hangingLantern', 'lantern', o.lantern);
  const chain = checkId('hangingLantern', 'chainBlock', o.chainBlock);
  placeOriented(b, o, () => {
    for (let i = 0; i < o.chain; i++) b.set(0, -i, 0, withAxis(chain, 'y'));
    b.set(0, -o.chain, 0, formatState(lantern, { hanging: 'true' }));
  });
  return orientedBox(o, [0, -o.chain, 0], [0, 0, 0]);
}

// Laterne an der Wand. Ursprung = Wandblock (lz 0) auf Höhe der Laterne; die Laterne sitzt davor (lz 1).
// style 'bracket': Zaun-Arm eine Ebene höher, Laterne hängt daran · 'shelf': Laterne steht auf einer oberen Treppe.
export function wallLantern(b, options) {
  const o = partOptions('wallLantern', b, options, { style: 'bracket', lantern: 'lantern', arm: 'spruce_fence', shelf: 'spruce_stairs' });
  checkChoice('wallLantern', 'style', o.style, ['bracket', 'shelf']);
  const lantern = checkId('wallLantern', 'lantern', o.lantern);
  const arm = checkId('wallLantern', 'arm', o.arm);
  const shelf = checkId('wallLantern', 'shelf', o.shelf, { suffix: '_stairs' });
  placeOriented(b, o, () => {
    if (o.style === 'bracket') {
      b.set(0, 1, 1, arm);
      b.set(0, 0, 1, formatState(lantern, { hanging: 'true' }));
    } else {
      b.set(0, -1, 1, stairs(shelf, 'north', 'top'));
      b.set(0, 0, 1, formatState(lantern, { hanging: 'false' }));
    }
  });
  return o.style === 'bracket' ? orientedBox(o, [0, 0, 1], [0, 1, 1]) : orientedBox(o, [0, -1, 1], [0, 0, 1]);
}

// Laternenpfahl. Ursprung = Fuß. style 'top' (Laterne obenauf), 'arm' (Arm nach vorne, Laterne hängt),
// 'double' (Arme nach vorne und hinten). base: optionaler Sockelblock als unterste Ebene.
export function lampPost(b, options) {
  const o = partOptions('lampPost', b, options, { height: 3, post: 'spruce_fence', base: null, lantern: 'lantern', style: 'top' });
  checkInt('lampPost', 'height', o.height, 1, 32);
  checkChoice('lampPost', 'style', o.style, ['top', 'arm', 'double']);
  if (o.style !== 'top' && o.height < 2) throw new Error('lampPost: Arme brauchen height ≥ 2.');
  const post = checkId('lampPost', 'post', o.post);
  const base = checkId('lampPost', 'base', o.base, { nullable: true });
  const lantern = checkId('lampPost', 'lantern', o.lantern);
  const top = o.height - 1;
  placeOriented(b, o, () => {
    for (let ly = 0; ly <= top; ly++) b.set(0, ly, 0, ly === 0 && base ? base : withAxis(post, 'y'));
    if (o.style === 'top') b.set(0, top + 1, 0, formatState(lantern, { hanging: 'false' }));
    else {
      for (const lz of o.style === 'double' ? [1, -1] : [1]) {
        b.set(0, top, lz, post);
        b.set(0, top - 1, lz, formatState(lantern, { hanging: 'true' }));
      }
    }
  });
  if (o.style === 'top') return orientedBox(o, [0, 0, 0], [0, top + 1, 0]);
  return orientedBox(o, [0, 0, o.style === 'double' ? -1 : 0], [0, top, 1]);
}

// ------------------------------------------------------------------ Bodenmuster

// Bodenmuster. Ursprung = Ecke; die Fläche reicht width nach rechts (lokal +x) und depth nach vorne (facing).
// pattern: 'checker' | 'stripes' | 'border' (blocks[0] innen, blocks[1] Rand) | 'rings' (konzentrische Ringe)
// | 'diamond' (Raute aus der Mitte) | 'herringbone' (Fischgrät; am schönsten mit Blöcken mit Achse, z. B. Stämmen)
// | 'random' (Mischung; Einträge auch als [id, gewicht]). border: optionaler Randblock für alle Muster.
export function floorPattern(b, options) {
  const o = partOptions('floorPattern', b, options, { width: 5, depth: 5, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'], border: null });
  checkInt('floorPattern', 'width', o.width, 1, 1024);
  checkInt('floorPattern', 'depth', o.depth, 1, 1024);
  checkChoice('floorPattern', 'pattern', o.pattern, ['checker', 'stripes', 'border', 'rings', 'diamond', 'herringbone', 'random']);
  if (!Array.isArray(o.blocks) || o.blocks.length === 0) throw new Error('floorPattern: blocks muss eine nicht leere Liste sein.');
  const entries = o.blocks.map((entry) => {
    if (Array.isArray(entry)) {
      if (!(Number.isFinite(entry[1]) && entry[1] > 0)) throw new Error('floorPattern: Gewichte müssen Zahlen > 0 sein.');
      return [checkId('floorPattern', 'blocks', entry[0]), entry[1]];
    }
    return [checkId('floorPattern', 'blocks', entry), 1];
  });
  const ids = entries.map(([id]) => id);
  if (['checker', 'stripes', 'border', 'rings', 'diamond'].includes(o.pattern) && ids.length < 2) throw new Error(`floorPattern: '${o.pattern}' braucht mindestens zwei Blöcke.`);
  const border = checkId('floorPattern', 'border', o.border, { nullable: true });
  const W = o.width - 1;
  const D = o.depth - 1;
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const pickRandom = (lx, lz) => {
    let r = (hashPosition(lx, 0, lz, 9001) / 4294967296) * total;
    for (const [id, w] of entries) {
      if (r < w) return id;
      r -= w;
    }
    return ids[ids.length - 1];
  };
  const cx = W / 2;
  const cz = D / 2;
  const pick = (lx, lz) => {
    switch (o.pattern) {
      case 'checker': return ids[(lx + lz) % ids.length];
      case 'stripes': return ids[lx % ids.length];
      case 'border': return lx === 0 || lz === 0 || lx === W || lz === D ? ids[1] : ids[0];
      case 'rings': return ids[Math.min(lx, lz, W - lx, D - lz) % ids.length];
      case 'diamond': return ids[Math.floor(Math.abs(lx - cx) + Math.abs(lz - cz)) % ids.length];
      case 'herringbone': {
        // Schräge Doppelstreifen im Wechsel quer/längs (blocks[1] optional für die Längsreihen).
        const across = (lx + lz) % 4 < 2;
        return withAxis(across ? ids[0] : ids[ids.length > 1 ? 1 : 0], across ? 'x' : 'z');
      }
      default: return pickRandom(lx, lz);
    }
  };
  placeOriented(b, o, () => {
    for (let lz = 0; lz <= D; lz++) {
      for (let lx = 0; lx <= W; lx++) {
        const edge = lx === 0 || lz === 0 || lx === W || lz === D;
        b.set(lx, 0, lz, border && edge ? border : pick(lx, lz));
      }
    }
  });
  return orientedBox(o, [0, 0, 0], [W, 0, D]);
}

// ------------------------------------------------------------------ Gartenzaun mit Tor

// Zaun um ein Rechteck. Ursprung = Ecke; reicht width nach rechts (lokal +x) und depth nach vorne (facing).
// Das Tor (gateWidth 1 oder 2) sitzt mittig in der Vorderseite (lz = depth − 1). posts: Block für Eckpfosten und
// Torpfosten (z. B. geschälter Stamm oder Mauer), lanterns: Laternen auf den Torpfosten (nur mit posts).
export function gardenFence(b, options) {
  const o = partOptions('gardenFence', b, options, {
    width: 7, depth: 5, fence: 'spruce_fence', gate: 'spruce_fence_gate', gateWidth: 1, posts: null, lanterns: false,
    sides: ['front', 'back', 'left', 'right'],
  });
  checkInt('gardenFence', 'width', o.width, 3, 1024);
  checkInt('gardenFence', 'depth', o.depth, 2, 1024);
  checkChoice('gardenFence', 'gateWidth', o.gateWidth, [1, 2]);
  const fence = checkId('gardenFence', 'fence', o.fence);
  const gate = checkId('gardenFence', 'gate', o.gate, { nullable: true, suffix: '_fence_gate' });
  const posts = checkId('gardenFence', 'posts', o.posts, { nullable: true });
  if (typeof o.lanterns !== 'boolean') throw new Error('gardenFence: lanterns muss true oder false sein.');
  if (o.lanterns && !posts) throw new Error('gardenFence: lanterns braucht posts (die Laternen stehen auf den Torpfosten).');
  if (!Array.isArray(o.sides) || o.sides.length === 0) throw new Error('gardenFence: sides muss eine nicht leere Liste sein.');
  for (const side of o.sides) checkChoice('gardenFence', 'sides', side, ['front', 'back', 'left', 'right']);
  if (gate && !o.sides.includes('front')) throw new Error('gardenFence: das Tor sitzt in der Vorderseite – nimm "front" in sides auf oder setze gate: null.');
  const W = o.width - 1;
  const D = o.depth - 1;
  const { lo } = centeredSpan(o.gateWidth);
  const gateLo = Math.floor(W / 2) + lo;
  const gateHi = gateLo + o.gateWidth - 1;
  const cells = new Map();
  const put = (lx, lz, state) => cells.set(`${lx},${lz}`, [lx, lz, state]);
  if (o.sides.includes('back')) for (let lx = 0; lx <= W; lx++) put(lx, 0, fence);
  if (o.sides.includes('front')) for (let lx = 0; lx <= W; lx++) put(lx, D, fence);
  if (o.sides.includes('left')) for (let lz = 0; lz <= D; lz++) put(0, lz, fence);
  if (o.sides.includes('right')) for (let lz = 0; lz <= D; lz++) put(W, lz, fence);
  if (posts) {
    for (const [lx, lz] of [[0, 0], [W, 0], [0, D], [W, D]]) if (cells.has(`${lx},${lz}`)) put(lx, lz, withAxis(posts, 'y'));
  }
  if (gate) {
    for (let lx = gateLo; lx <= gateHi; lx++) put(lx, D, formatState(gate, { facing: 'south' }));
    if (posts) {
      put(gateLo - 1, D, withAxis(posts, 'y'));
      put(gateHi + 1, D, withAxis(posts, 'y'));
    }
  }
  placeOriented(b, o, () => {
    for (const [lx, lz, state] of cells.values()) b.set(lx, 0, lz, state);
    if (o.lanterns && gate) {
      b.set(gateLo - 1, 1, D, formatState('lantern', { hanging: 'false' }));
      b.set(gateHi + 1, 1, D, formatState('lantern', { hanging: 'false' }));
    }
  });
  return orientedBox(o, [0, 0, 0], [W, o.lanterns && gate ? 1 : 0, D]);
}
