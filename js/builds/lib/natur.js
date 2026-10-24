// Natur und Gelände für Bau-Module (ARCHITEKTUR §9.1): Bäume, Büsche, Blumenbeete, Bewuchs, Gelände, Hügel,
// Teiche, Felsen und Wege. Alles setzt über den Builder b (Transform, Kapitel und Schritte wirken mit).
// Deterministisch: der Zufall hängt nur von Position, Optionen und `seed` ab, nicht von der Aufruf-Reihenfolge.
// Jede Funktion gibt die belegte Box { min: [x, y, z], max: [x, y, z] } in den Koordinaten des Aufrufers zurück
// (oder null, wenn nichts gesetzt wurde).

import { WOOD, FLOWERS, WARM_FLOWERS, COOL_FLOWERS } from './palettes.js';
import { createRandom, hashPosition, hashSeed } from '../../core/random.js';
import { stateId } from '../../core/blockstate.js';

export const TREE_SPECIES = Object.freeze(['eiche', 'birke', 'fichte', 'schwarzeiche', 'kirsche', 'akazie', 'dschungel', 'mangrove']);
export const TREE_SIZES = Object.freeze(['klein', 'mittel', 'gross', 'riesig']);
export const BUSH_SIZES = Object.freeze(['klein', 'mittel', 'gross']);
export const ROCK_SIZES = Object.freeze(['klein', 'mittel', 'gross', 'riesig']);
export const BUSH_LEAVES = Object.freeze(['eiche', 'birke', 'fichte', 'schwarzeiche', 'kirsche', 'akazie', 'dschungel', 'mangrove', 'blasseiche', 'azalee']);
export const FLOWER_BED_PALETTES = Object.freeze(['bunt', 'warm', 'kuehl', 'rosa', 'weiss', 'wiese']);
export const VEGETATION_MIXES = Object.freeze(['wiese', 'blumen', 'farn', 'wald', 'trocken']);
export const ROCK_MATERIALS = Object.freeze(['stein', 'andesit', 'tuff', 'granit', 'diorit', 'schiefer', 'sandstein']);
export const PATH_MIXES = Object.freeze(['erde', 'kies', 'gemischt']);
export const POND_SHORES = Object.freeze(['sand', 'ton', 'kies', 'gemischt']);
export const TERRAIN_SURFACES = Object.freeze(['gras', 'podsol', 'moos', 'erde', 'sand']);

const FACINGS = ['north', 'east', 'south', 'west'];
const DIR = Object.freeze({ north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] });
const OPPOSITE = Object.freeze({ north: 'south', south: 'north', east: 'west', west: 'east' });
// Vorne = Süden im lokalen Raum; facing dreht im Uhrzeigersinn (§3: Norden → Osten → Süden → Westen).
const FACING_ROTATION = Object.freeze({ south: 0, west: 90, north: 180, east: 270 });

// Ausdehnung der Bäume: [radius, height] je Größe (klein, mittel, gross, riesig), gemessen über viele seeds.
// Waagrecht x − radius … x + radius (+1 bei 2×2-Stamm), senkrecht y … y + height − 1; y − 1 nur bei Bodenwechsel.
const TREE_EXTENTS = Object.freeze({
  eiche: [[3, 8], [5, 10], [7, 13], [11, 16]],
  birke: [[2, 11], [3, 13], [3, 16], [4, 20]],
  fichte: [[3, 11], [4, 14], [5, 19], [8, 27]],
  schwarzeiche: [[4, 7], [6, 9], [7, 11], [10, 14]],
  kirsche: [[4, 7], [5, 9], [7, 10], [9, 12]],
  akazie: [[4, 6], [6, 10], [8, 11], [10, 14]],
  dschungel: [[3, 10], [5, 15], [7, 22], [10, 30]],
  mangrove: [[3, 9], [4, 12], [6, 14], [8, 18]],
});
const TWO_BY_TWO = Object.freeze({
  eiche: [false, false, false, true], birke: [false, false, false, false], fichte: [false, false, false, true],
  schwarzeiche: [true, true, true, true], kirsche: [false, false, false, false], akazie: [false, false, false, false],
  dschungel: [false, false, true, true], mangrove: [false, false, false, true],
});
// Bäume, die y − 1 verändern können (Fichte: Podsol unter großen Bäumen).
const TREE_CHANGES_GROUND = Object.freeze({ fichte: [false, false, true, true] });

const BUSH_EXTENTS = Object.freeze({ klein: [2, 2], mittel: [3, 3], gross: [4, 4] });
const ROCK_EXTENTS = Object.freeze({ klein: [2, 3], mittel: [3, 4], gross: [4, 5], riesig: [6, 7] });

// Böden, auf denen Gras, Blumen, Farne und Büsche wachsen (Tag dirt im Spiel).
const SOIL = new Set(['grass_block', 'dirt', 'podzol', 'coarse_dirt', 'rooted_dirt', 'moss_block', 'mud', 'muddy_mangrove_roots', 'pale_moss_block', 'mycelium']);
const DRY_SOIL = new Set([...SOIL, 'sand', 'red_sand', 'terracotta']);
const CANE_SOIL = new Set([...SOIL, 'sand', 'red_sand']);
const DRY_PLANTS = new Set(['short_dry_grass', 'tall_dry_grass', 'dead_bush']);
const TALL_PLANT_IDS = new Set(['tall_grass', 'large_fern', 'sunflower', 'lilac', 'rose_bush', 'peony', 'pitcher_plant']);
const PLANT_IDS = new Set([
  ...FLOWERS, ...TALL_PLANT_IDS, 'short_grass', 'fern', 'bush', 'firefly_bush', 'dead_bush', 'short_dry_grass', 'tall_dry_grass',
  'sugar_cane', 'lily_pad', 'pink_petals', 'wildflowers', 'leaf_litter', 'moss_carpet', 'pale_moss_carpet', 'sweet_berry_bush',
  'brown_mushroom', 'red_mushroom', 'torchflower', 'open_eyeblossom', 'closed_eyeblossom', 'cactus_flower', 'snow',
  'vine', 'mangrove_propagule', 'seagrass', 'tall_seagrass', 'wither_rose',
]);

export function isPlantId(id) {
  return PLANT_IDS.has(id) || id.endsWith('_sapling');
}

// --- Optionen prüfen ---

function readOptions(fn, options, defaults, required = []) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new Error(`${fn}: Optionen müssen ein Objekt sein.`);
  const allowed = [...required, ...Object.keys(defaults)];
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) throw new Error(`${fn}: unbekannte Option „${key}“ (erlaubt: ${allowed.join(', ')}).`);
  }
  const out = { ...defaults };
  for (const [key, value] of Object.entries(options)) if (value !== undefined) out[key] = value;
  for (const key of required) if (out[key] === undefined) throw new Error(`${fn}: Option „${key}“ fehlt.`);
  return out;
}

function checkInt(fn, name, value, min = -16384, max = 16383) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${fn}: ${name} muss eine ganze Zahl von ${min} bis ${max} sein, bekommen: ${value}.`);
}

function checkNumber(fn, name, value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${fn}: ${name} muss eine Zahl von ${min} bis ${max} sein, bekommen: ${value}.`);
}

function checkChoice(fn, name, value, choices) {
  if (!choices.includes(value)) throw new Error(`${fn}: ${name} muss ${choices.map((c) => `'${c}'`).join(', ')} sein, bekommen: ${value}.`);
}

function checkBool(fn, name, value) {
  if (typeof value !== 'boolean') throw new Error(`${fn}: ${name} muss true oder false sein, bekommen: ${value}.`);
}

function checkSeed(fn, seed) {
  const ok = (typeof seed === 'number' && Number.isFinite(seed)) || (typeof seed === 'string' && seed.length <= 200);
  if (!ok) throw new Error(`${fn}: seed muss eine Zahl oder ein kurzer Text sein.`);
}

function checkOrigin(fn, o) {
  checkInt(fn, 'x', o.x);
  checkInt(fn, 'y', o.y);
  checkInt(fn, 'z', o.z);
  checkChoice(fn, 'facing', o.facing, FACINGS);
  checkSeed(fn, o.seed);
}

// --- Zufall und Rauschen (alles über hashPosition, also unabhängig von der Reihenfolge) ---

function saltOf(...parts) {
  return hashSeed(parts.join(':'))[0] | 0;
}

function rand01(x, y, z, salt) {
  return hashPosition(x, y, z, salt) / 4294967296;
}

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Weiches Wertrauschen 0 … 1 (Gitterabstand scale).
function noise2(x, z, scale, salt) {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = smoothstep(fx - x0);
  const tz = smoothstep(fz - z0);
  const a = rand01(x0, 0, z0, salt);
  const b = rand01(x0 + 1, 0, z0, salt);
  const c = rand01(x0, 0, z0 + 1, salt);
  const d = rand01(x0 + 1, 0, z0 + 1, salt);
  const top = a + (b - a) * tx;
  return top + (c + (d - c) * tx - top) * tz;
}

function noise3(x, y, z, scale, salt) {
  const fy = y / scale;
  const y0 = Math.floor(fy);
  const ty = smoothstep(fy - y0);
  const lower = noise2(x, z, scale, salt + y0 * 7919);
  const upper = noise2(x, z, scale, salt + (y0 + 1) * 7919);
  return lower + (upper - lower) * ty;
}

function weighted(entries, r) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let acc = r * total;
  for (const [value, w] of entries) {
    if (acc < w) return value;
    acc -= w;
  }
  return entries[entries.length - 1][0];
}

// Material in Flecken statt Salz-und-Pfeffer: Rauschen entscheidet, ein wenig Zufall franst die Grenzen aus.
function pickPatch(entries, x, y, z, salt, scale = 2.5) {
  const n = noise3(x, y, z, scale, salt);
  const v = Math.min(0.9999, Math.max(0, ((n - 0.5) * 1.8 + 0.5) * 0.8 + rand01(x, y, z, salt + 17) * 0.2));
  return weighted(entries, v);
}

// --- Setzen mit Box-Verfolgung ---

function createPlacer(b) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const track = (x, y, z) => {
    if (x < lo[0]) lo[0] = x;
    if (y < lo[1]) lo[1] = y;
    if (z < lo[2]) lo[2] = z;
    if (x > hi[0]) hi[0] = x;
    if (y > hi[1]) hi[1] = y;
    if (z > hi[2]) hi[2] = z;
  };
  const isAir = (x, y, z) => b.get(x, y, z) === 'air';
  const set = (x, y, z, state) => {
    b.set(x, y, z, state);
    track(x, y, z);
  };
  return {
    get: (x, y, z) => b.get(x, y, z),
    id: (x, y, z) => stateId(b.get(x, y, z)),
    isAir,
    set,
    setIfAir(x, y, z, state) {
      if (!isAir(x, y, z)) return false;
      set(x, y, z, state);
      return true;
    },
    tall(x, y, z, id) {
      if (!isAir(x, y, z) || !isAir(x, y + 1, z)) return false;
      b.tall(x, y, z, id);
      track(x, y, z);
      track(x, y + 1, z);
      return true;
    },
    // Pflanze über (x, y, z) entfernen (z. B. Gras auf einem neuen Weg); doppelte Pflanzen ganz.
    clearPlantsAbove(x, y, z) {
      for (let dy = 1; dy <= 2; dy++) {
        const id = stateId(b.get(x, y + dy, z));
        if (id === 'air' || !isPlantId(id)) return;
        b.remove(x, y + dy, z);
      }
    },
    box() {
      return lo[0] === Infinity ? null : { min: [...lo], max: [...hi] };
    },
  };
}

function rotateXZ(x, z, deg) {
  if (deg === 0) return [x, z];
  if (deg === 90) return [-z, x];
  if (deg === 180) return [-x, -z];
  return [z, -x];
}

// Zeichnet im lokalen Raum (vorne = Süden) und dreht um den Drehpunkt (pivot, pivot) – bei 2×2-Stämmen 0.5,
// damit der Stamm in jeder Ausrichtung auf x … x+1, z … z+1 bleibt.
function drawRotated(b, { x, y, z, facing, pivot = 0 }, draw) {
  const rotate = FACING_ROTATION[facing];
  const [rpx, rpz] = rotateXZ(pivot, pivot, rotate);
  const offset = [x + pivot - rpx, y, z + pivot - rpz];
  const local = b.transform({ offset, rotate }, () => {
    const placer = createPlacer(b);
    draw(placer);
    return placer.box();
  });
  if (!local) return null;
  const xs = [];
  const zs = [];
  for (const lx of [local.min[0], local.max[0]]) {
    for (const lz of [local.min[2], local.max[2]]) {
      const [rx, rz] = rotateXZ(lx, lz, rotate);
      xs.push(rx + offset[0]);
      zs.push(rz + offset[2]);
    }
  }
  return {
    min: [Math.min(...xs), local.min[1] + y, Math.min(...zs)],
    max: [Math.max(...xs), local.max[1] + y, Math.max(...zs)],
  };
}

function directionName(dx, dz) {
  if (dx === 1) return 'east';
  if (dx === -1) return 'west';
  if (dz === 1) return 'south';
  return 'north';
}

// --- Bäume ---

export function treeExtent(species, size = 'mittel') {
  checkChoice('treeExtent', 'species', species, TREE_SPECIES);
  checkChoice('treeExtent', 'size', size, TREE_SIZES);
  const s = TREE_SIZES.indexOf(size);
  const [radius, height] = TREE_EXTENTS[species][s];
  return Object.freeze({
    radius,
    height,
    trunk: TWO_BY_TWO[species][s] ? 2 : 1,
    below: TREE_CHANGES_GROUND[species]?.[s] ? 1 : 0,
  });
}

function createTree(p, { species, s, rng, salt, wood }) {
  const [radius, height] = TREE_EXTENTS[species][s];
  const two = TWO_BY_TWO[species][s];
  const hi = two ? 1 : 0;
  const logId = wood.log;
  const woodId = wood.wood;
  const leafState = `${wood.leaves}[persistent=true]`;
  const inside = (x, y, z) => y >= 0 && y < height && x >= -radius && x <= radius + hi && z >= -radius && z <= radius + hi;
  const isOwnLog = (x, y, z) => {
    const id = p.id(x, y, z);
    return id === logId || id === woodId;
  };
  const t = {
    p, rng, salt, two, hi, radius, height, wood,
    center: two ? 0.5 : 0,
    leafCells: [],
    inside,
    insideGround: (x, z) => x >= -radius && x <= radius + hi && z >= -radius && z <= radius + hi,
    log(x, y, z, axis = 'y') {
      if (!inside(x, y, z) || isOwnLog(x, y, z)) return;
      p.set(x, y, z, `${logId}[axis=${axis}]`);
    },
    // Ast: Holz (Rinde auf allen Seiten) mit axis in Wuchsrichtung, damit keine Jahresringe herausschauen.
    limb(x, y, z, axis) {
      if (!inside(x, y, z) || isOwnLog(x, y, z)) return;
      p.set(x, y, z, `${woodId}[axis=${axis}]`);
    },
    bark(x, y, z) {
      if (!inside(x, y, z) || isOwnLog(x, y, z)) return;
      p.set(x, y, z, `${woodId}[axis=y]`);
    },
    leaf(x, y, z) {
      if (!inside(x, y, z)) return;
      if (p.setIfAir(x, y, z, leafState)) t.leafCells.push([x, y, z]);
    },
    other(x, y, z, state) {
      if (!inside(x, y, z)) return false;
      return p.setIfAir(x, y, z, state);
    },
    rand: (lo, hi2) => lo + rng.next() * (hi2 - lo),
  };
  return t;
}

const AXES = ['x', 'y', 'z'];

// Ast von a nach b (Kommazahlen): flächig verbundene Holzblöcke, axis = Richtung, in die der Ast dort wächst.
function branch(t, a, b) {
  const cur = a.map((v) => Math.round(v));
  const delta = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const abs = delta.map(Math.abs);
  const dominant = abs[1] >= abs[0] && abs[1] >= abs[2] ? 1 : abs[0] >= abs[2] ? 0 : 2;
  t.limb(cur[0], cur[1], cur[2], AXES[dominant]);
  const steps = Math.max(1, Math.ceil(Math.max(...abs) * 2));
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const target = [0, 1, 2].map((k) => Math.round(a[k] + delta[k] * f));
    for (let guard = 0; guard < 12; guard++) {
      const diff = target.map((v, k) => v - cur[k]);
      if (diff[0] === 0 && diff[1] === 0 && diff[2] === 0) break;
      let k = 0;
      for (const cand of [2, 1]) if (Math.abs(diff[cand]) > Math.abs(diff[k])) k = cand;
      cur[k] += Math.sign(diff[k]);
      t.limb(cur[0], cur[1], cur[2], AXES[k]);
    }
  }
  return cur;
}

function trunk(t, from, to) {
  const cols = t.two ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
  for (const [cx, cz] of cols) for (let y = from; y <= to; y++) t.log(cx, y, cz, 'y');
}

// Blätterwolke aus überlappenden Ellipsoiden: dichter Kern, ausgefranster Rand, leichte Beulen.
function cloud(t, blobs, { fray = 0.22, lump = 0.3 } = {}) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const blob of blobs) {
    const r = [blob.rx ?? blob.r, blob.ry ?? blob.r, blob.rz ?? blob.r];
    blob.radii = r;
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], Math.floor(blob.c[k] - r[k] * 1.25));
      hi[k] = Math.max(hi[k], Math.ceil(blob.c[k] + r[k] * 1.25));
    }
  }
  const core = 1 - fray;
  const outer = 1 + fray * 0.5;
  for (let y = lo[1]; y <= hi[1]; y++) {
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let x = lo[0]; x <= hi[0]; x++) {
        let d = Infinity;
        for (const blob of blobs) {
          const [rx, ry, rz] = blob.radii;
          const dx = (x - blob.c[0]) / rx;
          const dy = (y - blob.c[1]) / ry;
          const dz = (z - blob.c[2]) / rz;
          d = Math.min(d, Math.sqrt(dx * dx + dy * dy + dz * dz));
        }
        if (d > outer * 1.3) continue;
        d *= 1 + (noise3(x, y, z, 2.2, t.salt) - 0.5) * lump;
        if (d <= core || (d <= outer && rand01(x, y, z, t.salt + 3) < (outer - d) / (outer - core))) t.leaf(x, y, z);
      }
    }
  }
}

// Wurzelansatz: Rindenblöcke rund um den Stammfuß, bei großen Bäumen liegende Wurzeln auf dem Boden.
function rootFlare(t, s) {
  if (s === 0) return;
  const { rng } = t;
  const sides = t.two
    ? [[-1, 0, -1, 0], [-1, 1, -1, 0], [2, 0, 1, 0], [2, 1, 1, 0], [0, -1, 0, -1], [1, -1, 0, -1], [0, 2, 0, 1], [1, 2, 0, 1]]
    : [[-1, 0, -1, 0], [1, 0, 1, 0], [0, -1, 0, -1], [0, 1, 0, 1]];
  const order = sides.map((side) => [rng.next(), side]).sort((a, b) => a[0] - b[0]).map(([, side]) => side);
  const count = t.two ? (s >= 3 ? 6 : 4) : [0, 1, 2, 3][s];
  order.slice(0, count).forEach(([x, z, dx, dz], i) => {
    t.bark(x, 0, z);
    if ((s >= 2 && i < (t.two ? 3 : 1)) || (s === 3 && i === 0)) t.bark(x, 1, z);
    if (s === 3 && t.two && i === 0) t.bark(x, 2, z);
    if (s >= 2 && rng.next() < 0.65) {
      const len = s === 3 ? rng.int(1, 3) : 1;
      for (let k = 1; k <= len; k++) t.limb(x + dx * k, 0, z + dz * k, dx !== 0 ? 'x' : 'z');
    }
  });
  if (t.two && s >= 2) {
    for (const [x, z] of [[-1, -1], [2, -1], [-1, 2], [2, 2]]) if (rng.next() < 0.3) t.bark(x, 0, z);
  }
}

function placeHangingVines(t, chance, maxLen) {
  for (const [x, y, z] of t.leafCells) {
    if (rand01(x, y, z, t.salt + 41) >= chance) continue;
    const dirName = FACINGS[hashPosition(x, y, z, t.salt + 42) % 4];
    const [dx, dz] = DIR[dirName];
    const vx = x + dx;
    const vz = z + dz;
    const len = 1 + (hashPosition(x, y, z, t.salt + 43) % maxLen);
    const state = `vine[${OPPOSITE[dirName]}=true]`;
    for (let k = 0; k < len; k++) {
      const vy = y - k;
      if (vy < 1 || !t.p.isAir(vx, vy, vz) || !t.inside(vx, vy, vz)) break;
      t.p.set(vx, vy, vz, state);
    }
  }
}

function trunkSides(t) {
  return t.two
    ? [[-1, 0, 'east'], [-1, 1, 'east'], [2, 0, 'west'], [2, 1, 'west'], [0, -1, 'south'], [1, -1, 'south'], [0, 2, 'north'], [1, 2, 'north']]
    : [[-1, 0, 'east'], [1, 0, 'west'], [0, -1, 'south'], [0, 1, 'north']];
}

function placeTrunkVines(t, top) {
  for (const [x, z, toTrunk] of trunkSides(t)) {
    if (t.rng.next() >= 0.5) continue;
    const from = t.rng.int(1, Math.max(1, Math.floor(top * 0.5)));
    const to = t.rng.int(from, top);
    for (let y = from; y <= to; y++) t.other(x, y, z, `vine[${toTrunk}=true]`);
  }
}

function placeCocoa(t, count, top) {
  const sides = trunkSides(t);
  for (let i = 0; i < count; i++) {
    const [x, z, toTrunk] = sides[t.rng.int(0, sides.length - 1)];
    const y = t.rng.int(2, Math.max(2, top - 3));
    t.other(x, y, z, `cocoa[age=2,facing=${toTrunk}]`);
  }
}

// Bodendeko unter der Krone: nur auf Erde/Gras und nur in Luft (Boden zuerst bauen, dann den Baum).
function groundCover(t, radius, density, stateFor) {
  const r = Math.ceil(radius);
  for (let z = -r; z <= r + t.hi; z++) {
    for (let x = -r; x <= r + t.hi; x++) {
      const dist = Math.hypot(x - t.center, z - t.center);
      if (dist > radius || !t.insideGround(x, z)) continue;
      if (rand01(x, 0, z, t.salt + 61) >= density * (1 - (dist / radius) * 0.6)) continue;
      if (!SOIL.has(t.p.id(x, -1, z))) continue;
      t.other(x, 0, z, stateFor(x, z));
    }
  }
}

const angleDir = (theta) => [Math.sin(theta), Math.cos(theta)];

function oakTree(t, s, o) {
  const { rng } = t;
  const c = t.center;
  const h = [4, 5, 7, 9][s] + rng.int(0, 1);
  trunk(t, 0, h);
  if (o.roots) rootFlare(t, s);
  const r = [2.5, 3.1, 3.7, 4.6][s];
  const blobs = [{ c: [c, h + 0.6, c], r, ry: r * 0.76 }];
  if (s >= 2) blobs.push({ c: [c + t.rand(-0.6, 0.6), h + 2.2, c + t.rand(-0.6, 0.6)], r: r * 0.72, ry: r * 0.55 });
  const n = [1, 2, 3, 5][s];
  const reach = [0.9, 2.6, 3.6, 5.2][s];
  for (let i = 0; i < n; i++) {
    const theta = (i * 2 * Math.PI) / n + t.rand(-0.35, 0.35);
    const [sx, sz] = angleDir(theta);
    const len = reach * t.rand(0.8, 1.15);
    const startY = s === 0 ? h - 1 : Math.round(h * t.rand(0.55, 0.8));
    const from = [c + (t.two ? sx * 0.5 : 0), startY, c + (t.two ? sz * 0.5 : 0)];
    const to = [c + sx * len, startY + len * t.rand(0.45, 0.7), c + sz * len];
    if (s > 0) branch(t, from, to);
    blobs.push({ c: [to[0], to[1] + 0.8, to[2]], r: r * t.rand(0.72, 0.88), ry: r * 0.62 });
  }
  cloud(t, blobs);
  if (o.ground) {
    groundCover(t, r + reach * 0.6, 0.1, (x, z) => `leaf_litter[facing=${FACINGS[hashPosition(x, 1, z, t.salt) % 4]},segment_amount=${1 + (hashPosition(x, 2, z, t.salt) % 3)}]`);
  }
}

function birchTree(t, s) {
  const { rng } = t;
  const h = [5, 7, 9, 12][s] + rng.int(0, 1);
  trunk(t, 0, h);
  const r = [2.0, 2.3, 2.7, 3.1][s];
  const k = s >= 2 ? 3 : 2;
  const bottom = h * 0.55;
  const blobs = [];
  for (let i = 0; i < k; i++) {
    const f = k === 1 ? 0 : i / (k - 1);
    blobs.push({
      c: [t.rand(-0.5, 0.5), bottom + (h + 1 - bottom) * f, t.rand(-0.5, 0.5)],
      r: r * (1 - f * 0.25), ry: r * 1.3,
    });
  }
  const twigs = [0, 1, 2, 3][s];
  for (let i = 0; i < twigs; i++) {
    const [sx, sz] = angleDir(rng.next() * 2 * Math.PI);
    const y = Math.round(h * t.rand(0.62, 0.85));
    const len = t.rand(1, r - 0.6);
    branch(t, [0, y, 0], [sx * len, y + len * 0.6, sz * len]);
  }
  cloud(t, blobs, { fray: 0.26 });
}

function spruceTree(t, s, o) {
  const { rng } = t;
  const c = t.center;
  const top = [7, 10, 15, 23][s] + rng.int(0, 2);
  const lowest = [1, 2, 3, 4][s];
  const maxR = [2.2, 3.0, 3.9, 5.4][s];
  const tier = s < 2 ? 2 : 3;
  trunk(t, 0, top - 2);
  if (o.roots) rootFlare(t, Math.min(s, 2));
  for (let y = lowest; y <= top - 1; y++) {
    const f = (y - lowest) / Math.max(1, top - lowest);
    const k = (y - lowest) % tier;
    const r = Math.max((y >= top - 2 ? 0.9 : 1.3) + (t.two ? 0.75 : 0), maxR * Math.pow(1 - f, 0.9) * (1 - (0.24 * k) / Math.max(1, tier - 1)) + 0.45);
    const span = Math.ceil(r + 1);
    for (let z = -span; z <= span + t.hi; z++) {
      for (let x = -span; x <= span + t.hi; x++) {
        let d = Math.hypot(x - c, z - c) / r;
        d *= 1 + (noise3(x, y, z, 2, t.salt) - 0.5) * 0.3;
        if (d <= 0.78 || (d <= 1.12 && rand01(x, y, z, t.salt + 5) < (1.12 - d) / 0.34)) t.leaf(x, y, z);
      }
    }
  }
  const tipCols = t.two ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
  for (const [x, z] of tipCols) t.leaf(x, top, z);
  t.leaf(t.two ? rng.int(0, 1) : 0, top + 1, t.two ? rng.int(0, 1) : 0);
  if (o.ground && s >= 2) {
    const r = maxR * 0.85;
    const span = Math.ceil(r);
    for (let z = -span; z <= span + t.hi; z++) {
      for (let x = -span; x <= span + t.hi; x++) {
        if (Math.hypot(x - c, z - c) > r || !t.insideGround(x, z) || t.p.id(x, -1, z) !== 'grass_block') continue;
        const v = rand01(x, -1, z, t.salt + 71);
        if (v < 0.5) t.p.set(x, -1, z, 'podzol');
        else if (v < 0.65) t.p.set(x, -1, z, 'coarse_dirt');
      }
    }
  }
}

function darkOakTree(t, s, o) {
  const h = [3, 4, 5, 7][s] + t.rng.int(0, 1);
  trunk(t, 0, h);
  if (o.roots) rootFlare(t, Math.max(1, s));
  const r = [2.4, 3.0, 3.6, 4.4][s];
  const blobs = [{ c: [0.5, h + 0.9, 0.5], r: r * 1.05, ry: r * 0.66 }];
  const n = [3, 4, 4, 6][s];
  const reach = [1.6, 2.4, 3.2, 4.6][s];
  for (let i = 0; i < n; i++) {
    const theta = (i * 2 * Math.PI) / n + t.rand(-0.3, 0.3);
    const [sx, sz] = angleDir(theta);
    const len = reach * t.rand(0.8, 1.15);
    const startY = h - t.rng.int(0, 1);
    const to = [0.5 + sx * len, startY + len * 0.4, 0.5 + sz * len];
    branch(t, [0.5 + sx * 0.5, startY, 0.5 + sz * 0.5], to);
    blobs.push({ c: [to[0], to[1] + 0.6, to[2]], r: r * t.rand(0.8, 0.95), ry: r * 0.56 });
  }
  cloud(t, blobs, { fray: 0.2 });
  if (o.ground) {
    groundCover(t, r + reach * 0.7, 0.2, (x, z) => `leaf_litter[facing=${FACINGS[hashPosition(x, 1, z, t.salt) % 4]},segment_amount=${1 + (hashPosition(x, 2, z, t.salt) % 4)}]`);
  }
}

function cherryTree(t, s, o) {
  const h = [2, 3, 3, 4][s];
  trunk(t, 0, h);
  if (o.roots) rootFlare(t, s);
  const n = [2, 2, 3, 3][s];
  const reach = [1.8, 2.6, 3.4, 4.8][s];
  const rise = [2, 2.5, 3, 3.8][s];
  const r = [2.0, 2.6, 3.2, 4.0][s];
  const blobs = [];
  const start = t.rand(-0.4, 0.4);
  for (let i = 0; i < n; i++) {
    const theta = start + (i * 2 * Math.PI) / n + t.rand(-0.3, 0.3);
    const [sx, sz] = angleDir(theta);
    const len = reach * t.rand(0.85, 1.1);
    const mid = [sx * len * 0.55, h + rise * 0.35, sz * len * 0.55];
    const end = [sx * len, h + rise, sz * len];
    branch(t, [0, h, 0], mid);
    branch(t, mid, end);
    blobs.push({ c: [end[0], end[1] + 0.9, end[2]], r: r * t.rand(0.85, 1), ry: r * 0.6 });
  }
  blobs.push({ c: [0, h + rise + 0.8, 0], r: r * 0.7, ry: r * 0.5 });
  cloud(t, blobs, { fray: 0.3 });
  // Hängende Blütenzweige am unteren Kronenrand.
  for (const [x, y, z] of [...t.leafCells]) {
    if (!t.p.isAir(x, y - 1, z) || rand01(x, y, z, t.salt + 81) >= 0.12) continue;
    t.leaf(x, y - 1, z);
    if (rand01(x, y, z, t.salt + 82) < 0.4) t.leaf(x, y - 2, z);
  }
  if (o.ground) {
    groundCover(t, r + reach, 0.4, (x, z) => `pink_petals[facing=${FACINGS[hashPosition(x, 1, z, t.salt) % 4]},flower_amount=${1 + (hashPosition(x, 2, z, t.salt) % 4)}]`);
  }
}

function acaciaTree(t, s, o) {
  const straight = [2, 2, 3, 4][s];
  const lean = [1, 2, 2, 3][s];
  trunk(t, 0, straight - 1);
  if (o.roots) rootFlare(t, Math.min(s, 2));
  const [lx, lz] = angleDir(t.rand(-0.5, 0.5));
  const top = branch(t, [0, straight - 1, 0], [lx * lean, straight + lean, lz * lean]);
  const n = [1, 2, 2, 3][s];
  const reach = [1.2, 2.2, 3.0, 3.8][s];
  const R = [2.6, 3.2, 3.7, 4.4][s];
  const blobs = [];
  for (let i = 0; i < n; i++) {
    let end = top;
    if (s > 0) {
      const theta = Math.PI + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2.6) + t.rand(-0.3, 0.3);
      const [sx, sz] = angleDir(theta);
      const len = reach * t.rand(0.8, 1.15);
      end = branch(t, top, [top[0] + sx * len, top[1] + len * 0.8 + 0.5, top[2] + sz * len]);
    }
    blobs.push({ c: [end[0], end[1] + 1, end[2]], r: R * t.rand(0.9, 1.05), ry: 0.85 });
    blobs.push({ c: [end[0] + t.rand(-0.5, 0.5), end[1] + 2, end[2] + t.rand(-0.5, 0.5)], r: R * 0.55, ry: 0.7 });
  }
  cloud(t, blobs, { fray: 0.26, lump: 0.25 });
}

function jungleTree(t, s, o) {
  const c = t.center;
  const h = [5, 9, 15, 22][s] + t.rng.int(0, 2);
  trunk(t, 0, h);
  if (o.roots) rootFlare(t, s);
  const r = [2.3, 3.1, 4.1, 5.0][s];
  const blobs = [{ c: [c, h + 1, c], r, ry: r * 0.6 }];
  const crown = [1, 2, 3, 4][s];
  const reachTop = [1, 1.8, 3, 4.2][s];
  for (let i = 0; i < crown; i++) {
    const [sx, sz] = angleDir((i * 2 * Math.PI) / crown + t.rand(-0.4, 0.4));
    const len = reachTop * t.rand(0.8, 1.1);
    const startY = h - 1 - t.rng.int(0, 1);
    const end = [c + sx * len, startY + len * 0.5, c + sz * len];
    branch(t, [c + (t.two ? sx * 0.5 : 0), startY, c + (t.two ? sz * 0.5 : 0)], end);
    blobs.push({ c: [end[0], end[1] + 0.8, end[2]], r: r * 0.72, ry: r * 0.5 });
  }
  const side = [0, 1, 2, 3][s];
  const sideR = [0, 1.5, 1.9, 2.3][s];
  const sideReach = [0, 1.5, 2.5, 3.4][s];
  for (let i = 0; i < side; i++) {
    const [sx, sz] = angleDir(t.rng.next() * 2 * Math.PI);
    const y = Math.round(h * t.rand(0.45, 0.75));
    const end = [c + sx * sideReach, y + 1, c + sz * sideReach];
    branch(t, [c + (t.two ? sx * 0.5 : 0), y, c + (t.two ? sz * 0.5 : 0)], end);
    blobs.push({ c: [end[0], end[1] + 0.5, end[2]], r: sideR, ry: sideR * 0.65 });
  }
  cloud(t, blobs);
  if (o.vines) {
    placeTrunkVines(t, h - 1);
    placeHangingVines(t, 0.1, 4);
    placeCocoa(t, [1, 2, 3, 4][s], h);
  }
}

function mangroveTree(t, s, o) {
  const c = t.center;
  const rootH = [2, 3, 3, 4][s];
  const top = rootH + [3, 4, 6, 8][s] + t.rng.int(0, 1);
  trunk(t, rootH, top);
  const cols = t.two ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
  const rootState = 'mangrove_roots';
  for (const [x, z] of cols) for (let y = 0; y < rootH; y++) t.other(x, y, z, rootState);
  // Stelzwurzeln: vom Stamm schräg nach außen und hinunter bis auf den Boden.
  const n = [4, 5, 6, 8][s];
  const reach = [2, 2.6, 3.4, 4.4][s];
  const start = t.rand(0, Math.PI);
  for (let i = 0; i < n; i++) {
    const [sx, sz] = angleDir(start + (i * 2 * Math.PI) / n + t.rand(-0.3, 0.3));
    const len = reach * t.rand(0.85, 1.1);
    const h0 = rootH + t.rng.int(0, 1);
    const pts = [
      [c + sx * (t.two ? 1.2 : 0.9), h0, c + sz * (t.two ? 1.2 : 0.9)],
      [c + sx * len * 0.6, h0 * 0.6, c + sz * len * 0.6],
      [c + sx * len, 0, c + sz * len],
    ];
    for (let k = 0; k < 2; k++) rootPath(t, pts[k], pts[k + 1], rootState);
  }
  const r = [2.2, 2.8, 3.5, 4.4][s];
  const blobs = [{ c: [c, top + 1, c], r, ry: r * 0.65 }];
  const crown = [1, 2, 3, 4][s];
  const reachTop = [1, 1.8, 2.6, 3.6][s];
  for (let i = 0; i < crown; i++) {
    const [sx, sz] = angleDir((i * 2 * Math.PI) / crown + t.rand(-0.4, 0.4));
    const len = reachTop * t.rand(0.8, 1.1);
    const startY = top - 1 - t.rng.int(0, 1);
    const end = [c + sx * len, startY + len * 0.55, c + sz * len];
    branch(t, [c, startY, c], end);
    blobs.push({ c: [end[0], end[1] + 0.8, end[2]], r: r * 0.75, ry: r * 0.5 });
  }
  cloud(t, blobs);
  for (const [x, y, z] of t.leafCells) {
    if (rand01(x, y, z, t.salt + 91) < 0.07) t.other(x, y - 1, z, 'mangrove_propagule[age=4,hanging=true]');
  }
  if (o.vines) placeHangingVines(t, 0.05, 3);
}

// Wurzelpfad wie ein Ast, aber aus Mangrovenwurzeln (ohne axis) und nur in Luft.
function rootPath(t, a, b, state) {
  const cur = a.map((v) => Math.round(v));
  const delta = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  t.other(cur[0], cur[1], cur[2], state);
  const steps = Math.max(1, Math.ceil(Math.max(...delta.map(Math.abs)) * 2));
  for (let i = 1; i <= steps; i++) {
    const target = [0, 1, 2].map((k) => Math.round(a[k] + delta[k] * (i / steps)));
    for (let guard = 0; guard < 12; guard++) {
      const diff = target.map((v, k) => v - cur[k]);
      if (diff[0] === 0 && diff[1] === 0 && diff[2] === 0) break;
      let k = 0;
      for (const cand of [2, 1]) if (Math.abs(diff[cand]) > Math.abs(diff[k])) k = cand;
      cur[k] += Math.sign(diff[k]);
      t.other(cur[0], cur[1], cur[2], state);
    }
  }
}

const TREE_BUILDERS = {
  eiche: oakTree, birke: birchTree, fichte: spruceTree, schwarzeiche: darkOakTree,
  kirsche: cherryTree, akazie: acaciaTree, dschungel: jungleTree, mangrove: mangroveTree,
};

export function tree(b, options) {
  const o = readOptions('tree', options, {
    facing: 'south', species: 'eiche', size: 'mittel', seed: 0, roots: true, ground: true, vines: true,
  }, ['x', 'y', 'z']);
  checkOrigin('tree', o);
  checkChoice('tree', 'species', o.species, TREE_SPECIES);
  checkChoice('tree', 'size', o.size, TREE_SIZES);
  for (const key of ['roots', 'ground', 'vines']) checkBool('tree', key, o[key]);
  const s = TREE_SIZES.indexOf(o.size);
  const rng = createRandom(`natur:tree:${o.species}:${o.size}:${o.x},${o.y},${o.z}:${o.seed}`);
  const salt = saltOf('tree', o.species, o.seed, o.x, o.y, o.z);
  const wood = WOOD[o.species];
  return drawRotated(b, { x: o.x, y: o.y, z: o.z, facing: o.facing, pivot: TWO_BY_TWO[o.species][s] ? 0.5 : 0 }, (p) => {
    const t = createTree(p, { species: o.species, s, rng, salt, wood });
    TREE_BUILDERS[o.species](t, s, o);
  });
}

// --- Büsche ---

export function bushExtent(size = 'mittel') {
  checkChoice('bushExtent', 'size', size, BUSH_SIZES);
  const [radius, height] = BUSH_EXTENTS[size];
  return Object.freeze({ radius, height });
}

export function bush(b, options) {
  const o = readOptions('bush', options, { facing: 'south', size: 'mittel', leaves: 'eiche', seed: 0, stem: true }, ['x', 'y', 'z']);
  checkOrigin('bush', o);
  checkChoice('bush', 'size', o.size, BUSH_SIZES);
  checkChoice('bush', 'leaves', o.leaves, BUSH_LEAVES);
  checkBool('bush', 'stem', o.stem);
  const [radius, height] = BUSH_EXTENTS[o.size];
  const rng = createRandom(`natur:bush:${o.size}:${o.x},${o.y},${o.z}:${o.seed}`);
  const salt = saltOf('bush', o.seed, o.x, o.y, o.z);
  const azalea = o.leaves === 'azalee';
  const leafState = azalea ? null : `${WOOD[o.leaves].leaves}[persistent=true]`;
  const logId = azalea ? 'oak_log' : WOOD[o.leaves].log;
  const side = rng.next() < 0.5 ? -1 : 1;
  const blobs = {
    klein: [{ c: [0, 0.4, 0], rx: 1.35, ry: 1.0, rz: 1.15 }, { c: [0.6 * side, 0.2, 0.7], r: 0.9, ry: 0.7 }],
    mittel: [{ c: [0, 0.8, 0], rx: 1.8, ry: 1.3, rz: 1.6 }, { c: [0.9 * side, 0.4, 0.8], r: 1.2, ry: 1 }],
    gross: [
      { c: [0, 1.2, 0], rx: 2.5, ry: 1.7, rz: 2.2 }, { c: [1.4 * side, 0.7, 0.9], r: 1.6, ry: 1.3 },
      { c: [-1.2 * side, 0.9, -0.7], r: 1.5, ry: 1.2 },
    ],
  }[o.size];
  return drawRotated(b, o, (p) => {
    const inside = (x, y, z) => y >= 0 && y < height && Math.abs(x) <= radius && Math.abs(z) <= radius;
    if (o.stem && o.size !== 'klein') p.set(0, 0, 0, `${logId}[axis=y]`);
    const t = {
      salt,
      leaf(x, y, z) {
        if (!inside(x, y, z)) return;
        const state = azalea
          ? `${pickPatch([['azalea_leaves', 6], ['flowering_azalea_leaves', 4]], x, y, z, salt + 9, 1.6)}[persistent=true]`
          : leafState;
        p.setIfAir(x, y, z, state);
      },
    };
    cloud(t, blobs, { fray: 0.25, lump: 0.25 });
  });
}

// --- Blumenbeete und Bewuchs ---

const BED_PALETTES = Object.freeze({
  bunt: { small: FLOWERS, tall: ['rose_bush', 'lilac', 'peony'] },
  warm: { small: [...WARM_FLOWERS, 'torchflower'], tall: ['rose_bush', 'sunflower'] },
  kuehl: { small: COOL_FLOWERS, tall: ['lilac', 'large_fern'] },
  rosa: { small: ['pink_tulip', 'allium', 'pink_petals', 'white_tulip'], tall: ['peony', 'lilac'] },
  weiss: { small: ['white_tulip', 'lily_of_the_valley', 'oxeye_daisy', 'azure_bluet'], tall: ['peony'] },
  wiese: { small: ['oxeye_daisy', 'azure_bluet', 'cornflower', 'dandelion', 'wildflowers', 'short_grass'], tall: ['tall_grass', 'large_fern'] },
});

const BED_SOIL = Object.freeze({ gras: 'grass_block', erde: 'dirt', moos: 'moss_block', podsol: 'podzol' });

// Setzt eine Pflanze passend: doppelte über b.tall, Blütenblätter/Laubstreu mit Anzahl und Richtung.
function placePlant(p, x, y, z, id, salt) {
  if (TALL_PLANT_IDS.has(id)) return p.tall(x, y, z, id);
  if (id === 'pink_petals' || id === 'wildflowers') {
    return p.setIfAir(x, y, z, `${id}[facing=${FACINGS[hashPosition(x, y, z, salt) % 4]},flower_amount=${2 + (hashPosition(x, y, z, salt + 1) % 3)}]`);
  }
  if (id === 'leaf_litter') {
    return p.setIfAir(x, y, z, `leaf_litter[facing=${FACINGS[hashPosition(x, y, z, salt) % 4]},segment_amount=${1 + (hashPosition(x, y, z, salt + 1) % 4)}]`);
  }
  return p.setIfAir(x, y, z, id);
}

export function flowerBed(b, options) {
  const o = readOptions('flowerBed', options, {
    facing: 'south', palette: 'bunt', soil: 'gras', border: null, wood: 'eiche', density: 0.8, tall: true, seed: 0,
  }, ['x', 'y', 'z', 'width', 'depth']);
  checkOrigin('flowerBed', o);
  checkInt('flowerBed', 'width', o.width, 1, 64);
  checkInt('flowerBed', 'depth', o.depth, 1, 64);
  checkChoice('flowerBed', 'palette', o.palette, FLOWER_BED_PALETTES);
  checkChoice('flowerBed', 'soil', o.soil, Object.keys(BED_SOIL));
  checkChoice('flowerBed', 'border', o.border, [null, 'stein', 'holz']);
  checkChoice('flowerBed', 'wood', o.wood, ['eiche', 'fichte', 'birke', 'dschungel', 'akazie', 'schwarzeiche', 'mangrove', 'kirsche', 'blasseiche']);
  checkNumber('flowerBed', 'density', o.density, 0, 1);
  checkBool('flowerBed', 'tall', o.tall);
  const p = createPlacer(b);
  const salt = saltOf('flowerBed', o.palette, o.seed);
  const { x, y, z, width: w, depth: d } = o;
  const palette = BED_PALETTES[o.palette];
  const soil = BED_SOIL[o.soil];
  const bordered = o.border !== null && w >= 3 && d >= 3;
  const wood = WOOD[o.wood];
  // v = Abstand von der Vorderkante (0 = vorderste Reihe), u = Lage entlang der Kante.
  const frontCoords = (cx, cz) => {
    if (o.facing === 'south') return [cx - x, z + d - 1 - cz, d];
    if (o.facing === 'north') return [x + w - 1 - cx, cz - z, d];
    if (o.facing === 'east') return [z + d - 1 - cz, x + w - 1 - cx, w];
    return [cz - z, cx - x, w];
  };
  for (let cz = z; cz < z + d; cz++) {
    for (let cx = x; cx < x + w; cx++) {
      const edgeX = cx === x || cx === x + w - 1;
      const edgeZ = cz === z || cz === z + d - 1;
      if (bordered && (edgeX || edgeZ)) {
        if (o.border === 'stein') {
          p.set(cx, y, cz, pickPatch([['cobblestone', 5], ['mossy_cobblestone', 4], ['stone', 1]], cx, y, cz, salt + 2, 1.5));
        } else if (edgeX && edgeZ) {
          p.set(cx, y, cz, `${wood.wood}[axis=y]`);
        } else {
          p.set(cx, y, cz, `${wood.log}[axis=${edgeZ ? 'x' : 'z'}]`);
        }
        continue;
      }
      p.set(cx, y, cz, soil);
      p.clearPlantsAbove(cx, y, cz);
      if (rand01(cx, y, cz, salt + 3) >= o.density) continue;
      const [u, v, rows] = frontCoords(cx, cz);
      const inner = rows - (bordered ? 2 : 0);
      const back = o.tall && inner >= 3 && v - (bordered ? 1 : 0) >= inner - Math.max(1, Math.floor(inner * 0.35));
      if (back && rand01(cx, y, cz, salt + 4) < 0.8) {
        const id = palette.tall[Math.floor(noise2(u * 1.3, v, 2.2, salt + 5) * palette.tall.length) % palette.tall.length];
        if (placePlant(p, cx, y + 1, cz, id, salt)) continue;
      }
      // Kleine Blumen in Gruppen derselben Sorte, wie gepflanzt.
      const group = hashPosition(Math.floor((u + noise2(cx, cz, 3, salt + 6) * 2) / 2.5), 0, Math.floor(v / 2), salt + 7);
      placePlant(p, cx, y + 1, cz, palette.small[group % palette.small.length], salt);
    }
  }
  return p.box();
}

const VEGETATION = Object.freeze({
  wiese: [['short_grass', 60], ['tall_grass', 12], ['dandelion', 4], ['poppy', 3], ['oxeye_daisy', 3], ['azure_bluet', 3], ['cornflower', 2], ['wildflowers', 3]],
  blumen: [['wildflowers', 14], ['short_grass', 22], ['dandelion', 6], ['poppy', 6], ['oxeye_daisy', 6], ['azure_bluet', 5], ['cornflower', 5], ['allium', 4], ['red_tulip', 3], ['white_tulip', 3], ['pink_tulip', 3], ['orange_tulip', 3], ['rose_bush', 3], ['lilac', 3], ['peony', 3]],
  farn: [['fern', 40], ['large_fern', 15], ['short_grass', 35], ['bush', 6], ['tall_grass', 4]],
  wald: [['short_grass', 28], ['fern', 24], ['large_fern', 6], ['bush', 8], ['leaf_litter', 16], ['brown_mushroom', 3], ['red_mushroom', 2], ['lily_of_the_valley', 2], ['firefly_bush', 2]],
  trocken: [['short_dry_grass', 40], ['tall_dry_grass', 25], ['dead_bush', 10], ['short_grass', 10]],
});

// Oberster Block einer Säule (Pflanzen zählen nicht) zwischen from und from − depth, oder null.
export function groundLevel(b, x, z, options) {
  const o = readOptions('groundLevel', options, { depth: 24 }, ['from']);
  checkInt('groundLevel', 'x', x);
  checkInt('groundLevel', 'z', z);
  checkInt('groundLevel', 'from', o.from);
  checkInt('groundLevel', 'depth', o.depth, 0, 512);
  return findGround(b, x, z, o.from, o.depth)?.y ?? null;
}

function findGround(b, x, z, from, depth) {
  for (let y = from; y >= from - depth; y--) {
    const id = stateId(b.get(x, y, z));
    if (id === 'air' || isPlantId(id)) continue;
    return { y, id };
  }
  return null;
}

// Ellipse im Rechteck mit ausgefranstem Rand (shape 'rund') bzw. das ganze Rechteck ('eckig').
function inArea(shape, dx, dz, w, d, wx, wz, salt) {
  if (shape === 'eckig') return true;
  const ex = (dx - (w - 1) / 2) / (w / 2);
  const ez = (dz - (d - 1) / 2) / (d / 2);
  return Math.sqrt(ex * ex + ez * ez) + (noise2(wx, wz, 3, salt) - 0.5) * 0.3 <= 1;
}

export function vegetation(b, options) {
  const o = readOptions('vegetation', options, {
    facing: 'south', mix: 'wiese', density: 0.35, shape: 'rund', scan: 24, seed: 0,
  }, ['x', 'y', 'z', 'width', 'depth']);
  checkOrigin('vegetation', o);
  checkInt('vegetation', 'width', o.width, 1, 256);
  checkInt('vegetation', 'depth', o.depth, 1, 256);
  checkChoice('vegetation', 'mix', o.mix, VEGETATION_MIXES);
  checkNumber('vegetation', 'density', o.density, 0, 1);
  checkChoice('vegetation', 'shape', o.shape, ['rund', 'eckig']);
  checkInt('vegetation', 'scan', o.scan, 0, 256);
  const p = createPlacer(b);
  const salt = saltOf('vegetation', o.mix, o.seed);
  const entries = VEGETATION[o.mix];
  for (let dz = 0; dz < o.depth; dz++) {
    for (let dx = 0; dx < o.width; dx++) {
      const x = o.x + dx;
      const z = o.z + dz;
      if (!inArea(o.shape, dx, dz, o.width, o.depth, x, z, salt)) continue;
      const chance = o.density * (0.35 + 1.3 * noise2(x, z, 4, salt + 1));
      if (rand01(x, 0, z, salt + 2) >= chance) continue;
      const ground = findGround(b, x, z, o.y, o.scan);
      if (!ground) continue;
      const id = weighted(entries, rand01(x, 1, z, salt + 3));
      if (!(DRY_PLANTS.has(id) ? DRY_SOIL : SOIL).has(ground.id)) continue;
      placePlant(p, x, ground.y + 1, z, id, salt);
    }
  }
  return p.box();
}

// --- Gelände und Hügel ---

const SURFACE_MIX = Object.freeze({
  gras: [['grass_block', 1]],
  podsol: [['podzol', 7], ['coarse_dirt', 2], ['grass_block', 1]],
  moos: [['moss_block', 8], ['grass_block', 2]],
  erde: [['coarse_dirt', 5], ['dirt', 3], ['rooted_dirt', 2]],
  sand: [['sand', 1]],
});
const STEEP_MIX = [['stone', 5], ['andesite', 3], ['cobblestone', 1], ['mossy_cobblestone', 2]];

function stoneAt(x, y, z, salt) {
  if (noise3(x, y, z, 3, salt + 11) > 0.7) return 'andesite';
  if (noise3(x, y, z, 2.5, salt + 13) > 0.76) return 'gravel';
  if (noise3(x, y, z, 3.5, salt + 15) > 0.78) return 'tuff';
  return 'stone';
}

function buildTerrain(b, fn, o, heightAt) {
  const p = createPlacer(b);
  const salt = saltOf(fn, o.seed, o.surface);
  const { width: w, depth: d } = o;
  const heights = new Int16Array(w * d).fill(-1);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const wx = o.x + dx;
      const wz = o.z + dz;
      if (!inArea(o.shape, dx, dz, w, d, wx, wz, salt)) continue;
      let h = heightAt(dx, dz);
      if (typeof h !== 'number' || !Number.isFinite(h)) throw new Error(`${fn}: die Höhenfunktion muss eine Zahl liefern (bei ${dx}, ${dz}: ${h}).`);
      if (o.edge > 0) {
        let toEdge;
        if (o.shape === 'rund') {
          const ex = (dx - (w - 1) / 2) / (w / 2);
          const ez = (dz - (d - 1) / 2) / (d / 2);
          toEdge = (1 - Math.sqrt(ex * ex + ez * ez)) * Math.min(w, d) / 2;
        } else {
          toEdge = Math.min(dx, dz, w - 1 - dx, d - 1 - dz) + 0.5;
        }
        h *= smoothstep((toEdge + (noise2(wx, wz, 2.5, salt + 1) - 0.5)) / o.edge);
      }
      const rounded = Math.round(h);
      if (rounded < 0) continue;
      heights[dz * w + dx] = Math.min(rounded, 255);
    }
  }
  const at = (dx, dz) => (dx < 0 || dz < 0 || dx >= w || dz >= d ? -1 : heights[dz * w + dx]);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const h = at(dx, dz);
      if (h < 0) continue;
      const x = o.x + dx;
      const z = o.z + dz;
      let slope = 0;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nh = at(dx + nx, dz + nz);
        if (nh >= 0) slope = Math.max(slope, h - nh);
      }
      const steep = o.rocky && slope >= 2;
      const top = o.y + h;
      const subDepth = steep ? 0 : 2 + Math.floor(noise2(x, z, 3, salt + 2) * 2);
      for (let y = o.y; y <= top; y++) {
        const k = top - y;
        let state;
        if (k === 0) state = steep ? pickPatch(STEEP_MIX, x, y, z, salt + 3, 1.8) : pickPatch(SURFACE_MIX[o.surface], x, y, z, salt + 4, 2.2);
        else if (k <= subDepth) state = o.surface === 'sand' ? (k <= 2 ? 'sand' : 'sandstone') : 'dirt';
        else state = o.surface === 'sand' && k <= subDepth + 2 ? 'sandstone' : stoneAt(x, y, z, salt);
        p.set(x, y, z, state);
      }
    }
  }
  const box = p.box();
  if (!box) return null;
  return {
    ...box,
    // Oberster Geländeblock bei (x, z) in Aufrufer-Koordinaten, oder null außerhalb.
    top(x, z) {
      const h = at(x - o.x, z - o.z);
      return h < 0 ? null : o.y + h;
    },
  };
}

export function terrain(b, options) {
  const o = readOptions('terrain', options, {
    facing: 'south', height: 0, heightAt: null, shape: 'eckig', edge: 0, surface: 'gras', rocky: false, seed: 0,
  }, ['x', 'y', 'z', 'width', 'depth']);
  checkOrigin('terrain', o);
  checkInt('terrain', 'width', o.width, 1, 256);
  checkInt('terrain', 'depth', o.depth, 1, 256);
  checkNumber('terrain', 'height', o.height, 0, 255);
  if (o.heightAt !== null && typeof o.heightAt !== 'function') throw new Error('terrain: heightAt muss eine Funktion (dx, dz) => Höhe sein.');
  checkChoice('terrain', 'shape', o.shape, ['eckig', 'rund']);
  checkInt('terrain', 'edge', o.edge, 0, 32);
  checkChoice('terrain', 'surface', o.surface, TERRAIN_SURFACES);
  checkBool('terrain', 'rocky', o.rocky);
  const heightAt = o.heightAt ?? (() => o.height);
  return buildTerrain(b, 'terrain', o, heightAt);
}

export function hill(b, options) {
  const o = readOptions('hill', options, {
    facing: 'south', height: 6, surface: 'gras', rocky: true, seed: 0,
  }, ['x', 'y', 'z', 'width', 'depth']);
  checkOrigin('hill', o);
  checkInt('hill', 'width', o.width, 3, 256);
  checkInt('hill', 'depth', o.depth, 3, 256);
  checkNumber('hill', 'height', o.height, 1, 128);
  checkChoice('hill', 'surface', o.surface, TERRAIN_SURFACES);
  checkBool('hill', 'rocky', o.rocky);
  const salt = saltOf('hill', o.seed);
  const [fx, fz] = DIR[o.facing];
  // Gipfel nach hinten versetzt: die Vorderseite (facing) ist der lange, flache Hang.
  const pcx = (o.width - 1) / 2 - fx * o.width * 0.18;
  const pcz = (o.depth - 1) / 2 - fz * o.depth * 0.18;
  const heightAt = (dx, dz) => {
    // Verzerrte Koordinaten, damit die Höhenlinien keine regelmäßigen Ringe bilden.
    const wx = o.x + dx;
    const wz = o.z + dz;
    const ex = (dx - pcx) / (dx < pcx ? pcx + 0.5 : o.width - 0.5 - pcx) + (noise2(wx, wz, 7, salt + 2) - 0.5) * 0.45;
    const ez = (dz - pcz) / (dz < pcz ? pcz + 0.5 : o.depth - 0.5 - pcz) + (noise2(wx, wz, 7, salt + 3) - 0.5) * 0.45;
    const e2 = ex * ex + ez * ez;
    const base = Math.pow(Math.max(0, 1 - e2), 1.4);
    const bumps = 0.72 + 0.4 * noise2(o.x + dx, o.z + dz, 5, salt) + 0.16 * noise2(o.x + dx, o.z + dz, 2.2, salt + 1);
    return o.height * base * bumps;
  };
  return buildTerrain(b, 'hill', { ...o, shape: 'rund', edge: 0 }, heightAt);
}

// --- Teich ---

const SHORE_MIX = Object.freeze({
  sand: [['sand', 8], ['gravel', 1], ['clay', 1]],
  ton: [['clay', 9], ['dirt', 4], ['gravel', 3], ['sand', 4]],
  kies: [['gravel', 6], ['sand', 3], ['clay', 1]],
  gemischt: [['sand', 4], ['gravel', 2.5], ['clay', 2], ['grass_block', 1.5]],
});
const SEDIMENT_MIX = [['sand', 4], ['clay', 3], ['gravel', 2], ['mud', 1]];
const WATER = 'water[level=0]';

export function pond(b, options) {
  const o = readOptions('pond', options, {
    facing: 'south', waterDepth: 2, shore: 'sand', lilyPads: true, reeds: true, seagrass: true, seed: 0,
  }, ['x', 'y', 'z', 'width', 'depth']);
  checkOrigin('pond', o);
  checkInt('pond', 'width', o.width, 5, 64);
  checkInt('pond', 'depth', o.depth, 5, 64);
  checkInt('pond', 'waterDepth', o.waterDepth, 1, 6);
  checkChoice('pond', 'shore', o.shore, POND_SHORES);
  for (const key of ['lilyPads', 'reeds', 'seagrass']) checkBool('pond', key, o[key]);
  const p = createPlacer(b);
  const salt = saltOf('pond', o.shore, o.seed);
  const { width: w, depth: d } = o;
  const [fx, fz] = DIR[o.facing];
  const beach = Math.min(2, Math.floor(Math.min(w, d) / 6));
  const cx = (w - 1) / 2 - (fx * beach) / 2;
  const cz = (d - 1) / 2 - (fz * beach) / 2;
  const rx = Math.max(1, (w - 1) / 2 - 1 - (fx ? beach / 2 : 0));
  const rz = Math.max(1, (d - 1) / 2 - 1 - (fz ? beach / 2 : 0));
  const depthAt = new Int8Array(w * d);
  const waterCells = [];
  for (let dz = 1; dz < d - 1; dz++) {
    for (let dx = 1; dx < w - 1; dx++) {
      const ex = (dx - cx) / (rx + 0.5);
      const ez = (dz - cz) / (rz + 0.5);
      const e = Math.sqrt(ex * ex + ez * ez) + (noise2(o.x + dx, o.z + dz, 2.5, salt) - 0.5) * 0.3;
      if (e > 1) continue;
      const inner = smoothstep(Math.min(1, (1 - e) * 1.8));
      depthAt[dz * w + dx] = 1 + Math.round((o.waterDepth - 1) * inner);
      waterCells.push([dx, dz]);
    }
  }
  if (waterCells.length === 0) {
    const mx = Math.round(cx);
    const mz = Math.round(cz);
    depthAt[mz * w + mx] = o.waterDepth;
    waterCells.push([mx, mz]);
  }
  const depthOf = (dx, dz) => (dx < 0 || dz < 0 || dx >= w || dz >= d ? 0 : depthAt[dz * w + dx]);
  // Ufer: alles nahe am Wasser, auf der Strandseite (facing) breiter.
  const shore = new Uint8Array(w * d);
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      if (depthOf(dx, dz) > 0) continue;
      let dist = Infinity;
      for (const [wx, wz] of waterCells) dist = Math.min(dist, Math.hypot(dx - wx, dz - wz));
      const beachSide = (dx - (w - 1) / 2) * fx + (dz - (d - 1) / 2) * fz > 0;
      const limit = Math.max(1, 1.5 + (beachSide ? beach : 0) + (noise2(o.x + dx, o.z + dz, 2, salt + 1) - 0.5) * 0.9);
      if (dist <= limit) shore[dz * w + dx] = beachSide && beach > 0 ? 2 : 1;
    }
  }
  const shoreMix = SHORE_MIX[o.shore];
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const kind = shore[dz * w + dx];
      if (!kind) continue;
      const x = o.x + dx;
      const z = o.z + dz;
      const mix = kind === 2 && o.shore !== 'ton' && o.shore !== 'kies' ? [['sand', 9], ['gravel', 1]] : shoreMix;
      p.clearPlantsAbove(x, o.y, z);
      p.set(x, o.y, z, pickPatch(mix, x, o.y, z, salt + 2, 1.8));
      if (p.isAir(x, o.y - 1, z)) p.set(x, o.y - 1, z, 'dirt');
    }
  }
  for (const [dx, dz] of waterCells) {
    const x = o.x + dx;
    const z = o.z + dz;
    const depth = depthOf(dx, dz);
    p.clearPlantsAbove(x, o.y, z);
    for (let k = 0; k < depth; k++) p.set(x, o.y - k, z, WATER);
    p.set(x, o.y - depth, z, pickPatch(SEDIMENT_MIX, x, o.y - depth, z, salt + 3, 1.6));
    // Unter dem Wasserspiegel dichtet Sediment die Seiten ab, damit nichts ausläuft.
    for (let k = 1; k < depth; k++) {
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (depthOf(dx + nx, dz + nz) > k) continue;
        const sx = x + nx;
        const sz = z + nz;
        const sy = o.y - k;
        if (p.isAir(sx, sy, sz)) p.set(sx, sy, sz, pickPatch(SEDIMENT_MIX, sx, sy, sz, salt + 3, 1.6));
      }
    }
    if (o.seagrass && depth >= 2 && rand01(x, 0, z, salt + 4) < 0.3) p.set(x, o.y - depth + 1, z, 'seagrass');
    if (o.lilyPads && rand01(x, 1, z, salt + 5) < 0.28 * noise2(x, z, 3, salt + 6) + 0.02) p.setIfAir(x, o.y + 1, z, 'lily_pad');
  }
  if (o.reeds) {
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        if (!shore[dz * w + dx]) continue;
        const touchesWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([nx, nz]) => depthOf(dx + nx, dz + nz) > 0);
        const x = o.x + dx;
        const z = o.z + dz;
        if (!touchesWater || !CANE_SOIL.has(p.id(x, o.y, z))) continue;
        if (rand01(x, 2, z, salt + 7) >= 0.65 * noise2(x, z, 3, salt + 8)) continue;
        const tall = 1 + (hashPosition(x, 3, z, salt) % 3);
        for (let k = 1; k <= tall; k++) if (!p.setIfAir(x, o.y + k, z, 'sugar_cane')) break;
      }
    }
  }
  return p.box();
}

// --- Felsen ---

const ROCK_MIX = Object.freeze({
  stein: [['stone', 5], ['andesite', 3], ['cobblestone', 2]],
  andesit: [['andesite', 6], ['stone', 2], ['cobblestone', 1], ['tuff', 1]],
  tuff: [['tuff', 6], ['andesite', 2], ['cobbled_deepslate', 2]],
  granit: [['granite', 6], ['stone', 2], ['andesite', 2]],
  diorit: [['diorite', 6], ['calcite', 2], ['stone', 2]],
  schiefer: [['deepslate', 5], ['cobbled_deepslate', 3], ['tuff', 2]],
  sandstein: [['sandstone', 6], ['smooth_sandstone', 3], ['sand', 1]],
});
const ROCK_RUBBLE = Object.freeze({
  stein: ['cobblestone_slab', 'stone_slab', 'andesite_slab'], andesit: ['andesite_slab', 'cobblestone_slab'],
  tuff: ['tuff_slab', 'cobbled_deepslate_slab'], granit: ['granite_slab', 'stone_slab'], diorit: ['diorite_slab', 'stone_slab'],
  schiefer: ['cobbled_deepslate_slab', 'tuff_slab'], sandstein: ['sandstone_slab', 'smooth_sandstone_slab'],
});
const MOSSABLE = new Set(['stone', 'andesite', 'cobblestone', 'tuff', 'granite', 'diorite', 'calcite', 'deepslate', 'cobbled_deepslate']);

export function rockExtent(size = 'mittel', { sink = 1, rubble = true } = {}) {
  checkChoice('rockExtent', 'size', size, ROCK_SIZES);
  const [radius, height] = ROCK_EXTENTS[size];
  return Object.freeze({ radius: radius + (rubble ? 2 : 0), height, below: sink });
}

export function rock(b, options) {
  const o = readOptions('rock', options, {
    facing: 'south', size: 'mittel', material: 'stein', moss: true, sink: 1, rubble: true, seed: 0,
  }, ['x', 'y', 'z']);
  checkOrigin('rock', o);
  checkChoice('rock', 'size', o.size, ROCK_SIZES);
  checkChoice('rock', 'material', o.material, ROCK_MATERIALS);
  checkBool('rock', 'moss', o.moss);
  checkInt('rock', 'sink', o.sink, 0, 2);
  checkBool('rock', 'rubble', o.rubble);
  const s = ROCK_SIZES.indexOf(o.size);
  const [radius, height] = ROCK_EXTENTS[o.size];
  const rng = createRandom(`natur:rock:${o.size}:${o.x},${o.y},${o.z}:${o.seed}`);
  const salt = saltOf('rock', o.material, o.seed, o.x, o.z);
  const r = [1.0, 1.7, 2.6, 4.0][s];
  const base = -o.sink;
  const blobs = [{ c: [0, base + r * 0.5, 0], rx: r * 0.95, ry: r * 1.0, rz: r * 1.25 }];
  if (s >= 1) blobs.push({ c: [r * (rng.next() - 0.5) * 1.2, base + r * 0.3, r * 0.6 * (rng.next() < 0.5 ? -1 : 1)], r: r * 0.7, ry: r * 0.6 });
  if (s >= 2) blobs.push({ c: [r * 0.7 * (rng.next() < 0.5 ? -1 : 1), base + r * 0.25, r * (rng.next() - 0.5)], r: r * 0.6, ry: r * 0.5 });
  return drawRotated(b, o, (p) => {
    const cells = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const inside = (x, y, z) => y >= base && y < height && Math.abs(x) <= radius && Math.abs(z) <= radius;
    const t = { salt, leaf: (x, y, z) => { if (inside(x, y, z)) cells.set(key(x, y, z), [x, y, z]); } };
    cloud(t, blobs, { fray: 0.16, lump: 0.35 });
    if (cells.size === 0) cells.set(key(0, Math.max(base, 0), 0), [0, Math.max(base, 0), 0]);
    for (const [x, y, z] of cells.values()) {
      let state = pickPatch(ROCK_MIX[o.material], x, y, z, salt + 1, 1.7);
      const exposed = !cells.has(key(x, y + 1, z));
      if (o.moss && exposed && MOSSABLE.has(state) && noise3(x, y, z, 2, salt + 2) > 0.45) {
        state = rand01(x, y, z, salt + 3) < 0.65 ? 'moss_block' : 'mossy_cobblestone';
      }
      p.set(x, y, z, state);
      if (state === 'moss_block' && y + 1 < height && rand01(x, y, z, salt + 4) < 0.3) p.setIfAir(x, y + 1, z, 'moss_carpet');
    }
    if (o.rubble) {
      const count = [1, 2, 3, 5][s];
      const slabs = ROCK_RUBBLE[o.material];
      for (let i = 0; i < count; i++) {
        const [sx, sz] = angleDir(rng.next() * 2 * Math.PI);
        const dist = radius + rng.next() * 1.6;
        const x = Math.round(sx * dist);
        const z = Math.round(sz * dist);
        if (Math.abs(x) > radius + 2 || Math.abs(z) > radius + 2 || p.isAir(x, -1, z)) continue;
        p.setIfAir(x, 0, z, rng.next() < 0.7 ? slabs[rng.int(0, slabs.length - 1)] : ROCK_MIX[o.material][0][0]);
      }
    }
  });
}

// --- Wege ---

const PATH_MIX = Object.freeze({
  erde: { center: [['dirt_path', 72], ['coarse_dirt', 16], ['gravel', 7], ['rooted_dirt', 5]], edge: [['coarse_dirt', 5], ['dirt_path', 3], ['gravel', 2]] },
  kies: { center: [['gravel', 70], ['coarse_dirt', 16], ['dirt_path', 12], ['andesite', 2]], edge: [['gravel', 5], ['coarse_dirt', 4], ['dirt_path', 1]] },
  gemischt: { center: [['dirt_path', 45], ['gravel', 28], ['coarse_dirt', 27]], edge: [['coarse_dirt', 5], ['gravel', 3], ['dirt_path', 2]] },
});
const FLUIDS = new Set(['water', 'lava']);

function drawPath(b, fn, o) {
  const p = createPlacer(b);
  const salt = saltOf(fn, o.mix, o.seed);
  const hw = o.width / 2;
  const cells = new Map();
  const mark = (px, pz, edge) => {
    const x = Math.floor(px + 0.5);
    const z = Math.floor(pz + 0.5);
    const k = `${x},${z}`;
    const prev = cells.get(k);
    if (!prev) cells.set(k, { x, z, edge });
    else if (!edge) prev.edge = false;
  };
  const pts = o.points;
  const lengths = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lengths.push(len);
    total += len;
  }
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = lengths[i - 1];
    const tx = len > 0 ? (bx - ax) / len : 0;
    const tz = len > 0 ? (bz - az) / len : 1;
    const nx = -tz;
    const nz = tx;
    const samples = Math.max(1, Math.ceil(len * 4));
    for (let j = 0; j <= samples; j++) {
      const sLocal = (len * j) / samples;
      const s = walked + sLocal;
      // Schlängeln, an beiden Enden ausgeblendet: Anfang und Ende liegen genau auf den Punkten.
      const amp = o.wiggle * Math.min(1, s / 4, (total - s) / 4);
      const off = amp * (noise2(s, 0, 6, salt) - 0.5) * 2;
      const px = ax + tx * sLocal + nx * off;
      const pz = az + tz * sLocal + nz * off;
      for (let q = -(hw - 0.5); q <= hw - 0.5 + 1e-9; q += 0.5) {
        mark(px + nx * q, pz + nz * q, o.width >= 2 && Math.abs(q) > hw - 1);
      }
    }
    walked += len;
    // Ecken innen abrunden.
    if (i < pts.length - 1) {
      const r = hw - 0.5;
      for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          if (Math.hypot(dx, dz) <= r + 0.01) mark(bx + dx, bz + dz, o.width >= 2 && Math.hypot(dx, dz) > r - 0.5);
        }
      }
    }
  }
  const mix = PATH_MIX[o.mix];
  for (const { x, z, edge } of cells.values()) {
    if (edge && rand01(x, 0, z, salt + 1) < 0.3) continue;
    let y = o.y;
    if (o.follow) {
      const ground = findGround(b, x, z, o.y, 24);
      if (!ground || FLUIDS.has(ground.id) || ground.id.endsWith('_leaves') || ground.id.endsWith('_log')) continue;
      y = ground.y;
    }
    let state = pickPatch(edge ? mix.edge : mix.center, x, y, z, salt + 2, 1.6);
    p.clearPlantsAbove(x, y, z);
    // Erdpfad nie unter einem Block (im Spiel würde er zu Erde).
    if (state === 'dirt_path' && !p.isAir(x, y + 1, z)) state = 'coarse_dirt';
    p.set(x, y, z, state);
    if (!o.follow && p.isAir(x, y - 1, z)) p.set(x, y - 1, z, 'dirt');
  }
  return p.box();
}

function checkPathOptions(fn, o) {
  checkInt(fn, 'width', o.width, 1, 9);
  checkChoice(fn, 'mix', o.mix, PATH_MIXES);
  checkNumber(fn, 'wiggle', o.wiggle, 0, 4);
  checkBool(fn, 'follow', o.follow);
  checkSeed(fn, o.seed);
}

export function path(b, options) {
  const o = readOptions('path', options, { facing: 'south', width: 3, mix: 'erde', wiggle: 1, follow: false, seed: 0 }, ['x', 'y', 'z', 'length']);
  checkOrigin('path', o);
  checkInt('path', 'length', o.length, 1, 512);
  checkPathOptions('path', o);
  const [fx, fz] = DIR[o.facing];
  const points = [[o.x, o.z], [o.x + fx * (o.length - 1), o.z + fz * (o.length - 1)]];
  return drawPath(b, 'path', { ...o, points });
}

export function pathAlong(b, options) {
  const o = readOptions('pathAlong', options, { width: 3, mix: 'erde', wiggle: 0, follow: false, seed: 0 }, ['y', 'points']);
  checkInt('pathAlong', 'y', o.y);
  if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > 256) throw new Error('pathAlong: points muss eine Liste aus 2 bis 256 Punkten [x, z] sein.');
  for (const pt of o.points) {
    if (!Array.isArray(pt) || pt.length !== 2) throw new Error('pathAlong: jeder Punkt muss [x, z] sein.');
    checkInt('pathAlong', 'Punkt-x', pt[0]);
    checkInt('pathAlong', 'Punkt-z', pt[1]);
  }
  checkPathOptions('pathAlong', o);
  return drawPath(b, 'pathAlong', o);
}

// Wandelt Erdpfad, auf dem etwas steht, in Grobe Erde um (für Wege, die vor Bauten gesetzt wurden).
export function fixDirtPaths(b, options) {
  const o = readOptions('fixDirtPaths', options, {}, ['x1', 'y1', 'z1', 'x2', 'y2', 'z2']);
  for (const key of ['x1', 'y1', 'z1', 'x2', 'y2', 'z2']) checkInt('fixDirtPaths', key, o[key]);
  const [x1, x2] = [Math.min(o.x1, o.x2), Math.max(o.x1, o.x2)];
  const [y1, y2] = [Math.min(o.y1, o.y2), Math.max(o.y1, o.y2)];
  const [z1, z2] = [Math.min(o.z1, o.z2), Math.max(o.z1, o.z2)];
  if ((x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1) > 4_000_000) throw new Error('fixDirtPaths: der Bereich ist zu groß (höchstens 4 Mio. Blöcke).');
  let changed = 0;
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (stateId(b.get(x, y, z)) !== 'dirt_path' || b.get(x, y + 1, z) === 'air') continue;
        b.set(x, y, z, 'coarse_dirt');
        changed++;
      }
    }
  }
  return changed;
}
