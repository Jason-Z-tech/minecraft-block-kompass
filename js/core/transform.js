// Drehen und Spiegeln von Positionen und Blockzuständen (§3, §4).
// Ein Transform ist { a, b, c, d, dx, dy, dz }: x' = a·x + b·z + dx, y' = y + dy, z' = c·x + d·z + dz.
// Reihenfolge innerhalb eines Transforms: erst spiegeln, dann drehen, dann verschieben.

import { parseStateCached, formatState } from './blockstate.js';

export const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, dx: 0, dy: 0, dz: 0 });

// Drehung im Uhrzeigersinn von oben: (x, z) → (−z, x) je Vierteldrehung.
const ROTATIONS = [
  { a: 1, b: 0, c: 0, d: 1 },
  { a: 0, b: -1, c: 1, d: 0 },
  { a: -1, b: 0, c: 0, d: -1 },
  { a: 0, b: 1, c: -1, d: 0 },
];

const HORIZONTAL = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const DIRECTION_BY_VECTOR = new Map([['0,-1', 'north'], ['0,1', 'south'], ['1,0', 'east'], ['-1,0', 'west']]);
const RAIL_STRAIGHT = new Set(['north_south', 'east_west']);
const LEFT_RIGHT = { left: 'right', right: 'left' };
const STAIR_MIRROR = { inner_left: 'inner_right', inner_right: 'inner_left', outer_left: 'outer_right', outer_right: 'outer_left' };
const SIDE_KEYS = ['north', 'east', 'south', 'west'];
const CACHE_LIMIT = 20_000;

function multiply(m, n) {
  return {
    a: m.a * n.a + m.b * n.c,
    b: m.a * n.b + m.b * n.d,
    c: m.c * n.a + m.d * n.c,
    d: m.c * n.b + m.d * n.d,
  };
}

export function normalizeRotation(rotate) {
  if (!Number.isInteger(rotate) || rotate % 90 !== 0) {
    throw new Error(`rotate muss ein Vielfaches von 90 sein (0, 90, 180, 270), bekommen: ${rotate}.`);
  }
  return ((rotate % 360) + 360) % 360;
}

export function makeTransform({ offset = [0, 0, 0], rotate = 0, mirror = null } = {}) {
  if (!Array.isArray(offset) || offset.length !== 3 || !offset.every(Number.isInteger)) {
    throw new Error('offset muss [x, y, z] aus ganzen Zahlen sein.');
  }
  if (mirror !== null && mirror !== 'x' && mirror !== 'z') {
    throw new Error(`mirror muss null, 'x' oder 'z' sein, bekommen: ${mirror}.`);
  }
  const turns = normalizeRotation(rotate) / 90;
  const mirrorMatrix = mirror === 'x' ? { a: -1, b: 0, c: 0, d: 1 } : mirror === 'z' ? { a: 1, b: 0, c: 0, d: -1 } : ROTATIONS[0];
  const m = multiply(ROTATIONS[turns], mirrorMatrix);
  return { ...m, dx: offset[0], dy: offset[1], dz: offset[2] };
}

// outer(inner(p)): erst inner, dann outer.
export function composeTransforms(outer, inner) {
  const m = multiply(outer, inner);
  return {
    ...m,
    dx: outer.a * inner.dx + outer.b * inner.dz + outer.dx,
    dy: inner.dy + outer.dy,
    dz: outer.c * inner.dx + outer.d * inner.dz + outer.dz,
  };
}

export function invertTransform(t) {
  // Die Matrix ist orthogonal: Inverse = Transponierte.
  const inv = { a: t.a, b: t.c, c: t.b, d: t.d };
  return { ...inv, dx: -(inv.a * t.dx + inv.b * t.dz), dy: -t.dy, dz: -(inv.c * t.dx + inv.d * t.dz) };
}

export function applyToPoint(t, x, y, z) {
  return [t.a * x + t.b * z + t.dx, y + t.dy, t.c * x + t.d * z + t.dz];
}

export function isIdentityMatrix(t) {
  return t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1;
}

// Zerlegt die Matrix in „erst an x spiegeln (optional), dann turns Vierteldrehungen“.
export function decompose(t) {
  const mirrored = t.a * t.d - t.b * t.c < 0;
  const m = mirrored ? { a: -t.a, b: t.b, c: -t.c, d: t.d } : t;
  const turns = ROTATIONS.findIndex((r) => r.a === m.a && r.b === m.b && r.c === m.c && r.d === m.d);
  if (turns < 0) throw new Error('Ungültige Transform-Matrix.');
  return { mirrored, turns };
}

export function transformDirection(t, dir) {
  const v = HORIZONTAL[dir];
  if (!v) return dir;
  return DIRECTION_BY_VECTOR.get(`${t.a * v[0] + t.b * v[1]},${t.c * v[0] + t.d * v[1]}`);
}

function directionMap(t) {
  const map = {};
  for (const dir of SIDE_KEYS) map[dir] = transformDirection(t, dir);
  map.up = 'up';
  map.down = 'down';
  return map;
}

function railShape(value, dirs) {
  if (value.startsWith('ascending_')) {
    const target = dirs[value.slice('ascending_'.length)];
    return target ? `ascending_${target}` : value;
  }
  const parts = value.split('_');
  if (parts.length !== 2 || !dirs[parts[0]] || !dirs[parts[1]]) return value;
  const mapped = [dirs[parts[0]], dirs[parts[1]]];
  const ns = mapped.filter((d) => d === 'north' || d === 'south');
  const ew = mapped.filter((d) => d === 'east' || d === 'west');
  if (ns.length === 2) return 'north_south';
  if (ew.length === 2) return 'east_west';
  return `${ns[0]}_${ew[0]}`;
}

function isRailShape(value) {
  return RAIL_STRAIGHT.has(value) || value.startsWith('ascending_') || /^(north|south)_(east|west)$/.test(value);
}

function transformOrientation(value, dirs) {
  const [front, top] = value.split('_');
  if (!dirs[front] || !dirs[top]) return value;
  return `${dirs[front]}_${dirs[top]}`;
}

function transformProps(props, t) {
  const dirs = directionMap(t);
  const { mirrored, turns } = decompose(t);
  const swapsAxes = t.a === 0;
  const result = {};
  for (const [key, value] of Object.entries(props)) {
    if (SIDE_KEYS.includes(key)) {
      result[dirs[key]] = value;
      continue;
    }
    result[key] = transformValue(key, value, { dirs, mirrored, turns, swapsAxes });
  }
  return result;
}

function transformValue(key, value, { dirs, mirrored, turns, swapsAxes }) {
  switch (key) {
    case 'facing':
      return dirs[value] ?? value;
    case 'axis':
      if (!swapsAxes) return value;
      return value === 'x' ? 'z' : value === 'z' ? 'x' : value;
    case 'rotation': {
      const r = Number(value);
      if (!Number.isInteger(r) || r < 0 || r > 15) return value;
      const mirroredValue = mirrored ? (16 - r) % 16 : r;
      return String((mirroredValue + 4 * turns) % 16);
    }
    case 'shape':
      if (isRailShape(value)) return railShape(value, dirs);
      return mirrored && STAIR_MIRROR[value] ? STAIR_MIRROR[value] : value;
    case 'hinge':
    case 'type':
    case 'side_chain':
      return mirrored && LEFT_RIGHT[value] ? LEFT_RIGHT[value] : value;
    case 'orientation':
      return transformOrientation(value, dirs);
    default:
      return value;
  }
}

const stateCaches = new Map();

export function transformState(state, t) {
  if (isIdentityMatrix(t)) return state;
  const matrixKey = `${t.a},${t.b},${t.c},${t.d}`;
  let cache = stateCaches.get(matrixKey);
  if (!cache) {
    cache = new Map();
    stateCaches.set(matrixKey, cache);
  }
  const hit = cache.get(state);
  if (hit !== undefined) return hit;
  const { id, props } = parseStateCached(state);
  const result = formatState(id, transformProps(props, t));
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(state, result);
  return result;
}

export function rotateState(state, rotate) {
  return transformState(state, makeTransform({ rotate }));
}

export function mirrorState(state, axis) {
  return transformState(state, makeTransform({ mirror: axis }));
}
