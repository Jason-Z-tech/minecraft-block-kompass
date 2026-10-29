// Schloss Neuschwanstein bei Schwangau – nachempfunden, etwa 1 Block pro Meter.
// Anlage auf dem Felsgrat von West nach Ost: Palas aus zwei Baukörpern mit Knick (Nordturm und Treppenturm im Winkel,
// Söller an der Westfassade, Wintergarten im Norden), oberer Hof mit Ritterhaus, Galeriebau, Viereckturm und Kemenate,
// unterer Hof mit Verbindungsbau, Torbau aus roten Ziegeln mit Flankentürmen, Zufahrt und Bergwald.
// Koordinaten: x → Osten, z → Süden; Stand-Ebene oberer Hof y = 0, unterer Hof y = −5.

import { hashPosition } from '../../core/random.js';
import { arch, tree, bush, vegetation, floorPattern, lightRoom, bedroom, kitchen, diningTable, bookWall, storage } from '../lib/index.js';

export const meta = {
  id: 'neuschwanstein',
  title: 'Schloss Neuschwanstein',
  category: 'wahrzeichen',
  subtitle: 'Märchenschloss König Ludwigs II. auf dem Felsgrat über der Pöllatschlucht',
  tags: ['Deutschland', 'Bayern', 'Allgäu', 'Schloss', 'Burg', 'Ludwig II.', 'Historismus', 'Türme', 'Felsen', 'Innenräume', 'Riesenprojekt'],
  aliases: [
    'neuschwanstein', 'schloss neuschwanstein', 'neuschwanstein castle', 'märchenschloss', 'maerchenschloss', 'ludwig schloss',
    'könig ludwig', 'koenig ludwig', 'ludwig ii', 'schwangau', 'füssen', 'fuessen', 'bayern schloss', 'disney schloss',
    'neuschwannstein', 'neuschwanstain', 'neu schwanstein', 'fairytale castle', 'thronsaal', 'sängersaal',
  ],
  accuracy: 'nachempfunden',
  description: 'Das Schloss König Ludwigs II. auf seinem Felsgrat, etwa 1 Block pro Meter: der Torbau aus roten Ziegeln mit '
    + 'Flankentürmen und Staffelgiebel, unterer und oberer Hof mit Viereckturm, Ritterhaus und Kemenate und dahinter der '
    + 'fünfgeschossige Palas aus zwei Baukörpern mit Knick, mit dem rund 65 Blöcke hohen Nordturm, Ecktürmchen, Söller und '
    + 'Wintergarten. Die Wendeltreppe im Nordturm führt zu Thronsaal, Sängersaal, Königswohnung und Grotte; im oberen Hof ist '
    + 'der Grundriss des nie gebauten Bergfrieds im Pflaster markiert. Höhen, Geschosszahl und Lage der Bauten folgen den '
    + 'Quellen, die übrigen Maße sind geschätzt.',
  sources: [
    { title: 'Wikipedia (de): Schloss Neuschwanstein', url: 'https://de.wikipedia.org/wiki/Schloss_Neuschwanstein' },
    { title: 'Wikipedia (en): Neuschwanstein Castle', url: 'https://en.wikipedia.org/wiki/Neuschwanstein_Castle' },
    { title: 'Bayerische Schlösserverwaltung: Baugeschichte Neuschwanstein', url: 'https://www.neuschwanstein.de/deutsch/schloss/bauges.htm' },
    { title: 'Burgenarchiv: Schloss Neuschwanstein', url: 'https://burgenarchiv.de/burg_neuschwanstein_in_bayern' },
    { title: 'burgen-web.de: Neuschwanstein (PDF)', url: 'https://www.burgen-web.de/index_htm_files/neuschwanstein.pdf' },
    { title: 'Historisches Lexikon Bayerns: Schloss Neuschwanstein', url: 'https://www.historisches-lexikon-bayerns.de/Lexikon/Schloss_Neuschwanstein' },
  ],
  credits: null,
  tested: null,
};

// ------------------------------------------------------------------ Maße

const PW = { x1: 0, x2: 24, z1: -12, z2: 12 }; // Palas West (Thronsaal-Flügel)
const PE = { x1: 25, x2: 55, z1: -10, z2: 14 }; // Palas Ost (Sängersaal-Flügel), um 2 nach Süden versetzt = Knick
const ST = [0, 5, 10, 15, 21]; // Stand-Ebenen EG … 4. OG
const TOP = 27; // oberste Mauerreihe des Palas (darüber Traufe und Dach)
const PW_IN = { x1: 2, x2: 23, z1: -10, z2: 10 };
const PE_IN = { x1: 26, x2: 53, z1: -8, z2: 12 };
const HALL = { x1: 2, x2: 17, z1: -10, z2: 10 }; // Thronsaal, 3. und 4. OG
const NT = { cx: 25, cz: -14, r: 3, top: 50 }; // Nordturm
const SOUTH_TOWER = { cx: 24, cz: 15, r: 2, top: 38 };
const NORTH_STAIR = { cx: 52, cz: -12, r: 2, top: 31 };
const KEM = { x1: 56, x2: 80, z1: 8, z2: 17 };
const RIT = { x1: 56, x2: 79, z1: -21, z2: -13 };
const GAL = { x1: 80, x2: 85, z1: -20, z2: -14 };
const VT = { x1: 86, x2: 93, z1: -21, z2: -14, top: 33 };
const VB = { x1: 94, x2: 118, z1: -21, z2: -13 };
const TOR = { x1: 119, x2: 131, z1: -19, z2: 17 };
const TOR_MID = { x1: 119, x2: 131, z1: -7, z2: 7 };
const LOWER = -5;
const BOTTOM = -36;

// Felsplatte unter der Anlage: [x1, x2, z1, z2]; oben (Felsoberkante −2) und unten (−7).
const PLATEAU_UPPER = [[0, 24, -12, 12], [22, 28, -17, -11], [25, 55, -10, 14], [22, 26, 13, 17], [50, 54, -14, -10], [56, 80, -21, 17], [81, 93, -21, 10]];
const PLATEAU_LOWER = [[94, 118, -21, 14], [119, 131, -19, 17], [130, 134, -11, -5], [130, 134, 5, 11], [132, 146, -7, 7]];
const AREA = { cx: 66, cz: -2, rx: 99, rz: 49 };

// ------------------------------------------------------------------ Zufall und Paletten

function rnd(x, y, z, salt) {
  return hashPosition(x, y, z, salt) / 4294967296;
}

const WHITE = {
  wall: (x, y, z) => {
    const r = rnd(x, y, z, 1);
    if (r < 0.07) return 'polished_diorite';
    if (r < 0.1) return 'smooth_quartz';
    return 'calcite';
  },
  inner: 'smooth_quartz',
  // Sockel: oben heller Kalkstein, zum Fels hin dunkler und bemoost.
  socle: (x, y, z) => {
    const r = rnd(x, y, z, 2);
    const depth = -1 - y;
    if (depth <= 2) return r < 0.6 ? 'polished_diorite' : r < 0.85 ? 'calcite' : 'diorite';
    if (depth <= 5) return r < 0.25 ? 'polished_andesite' : r < 0.4 ? 'cracked_stone_bricks' : 'stone_bricks';
    if (r < 0.15) return 'cracked_stone_bricks';
    if (r < 0.32) return 'mossy_stone_bricks';
    if (r < 0.45) return 'polished_andesite';
    return 'stone_bricks';
  },
  socleInner: 'stone_bricks',
  socleStairs: 'stone_brick_stairs',
  pilaster: 'quartz_bricks',
  frame: 'smooth_quartz',
  trim: 'smooth_quartz',
  trimStairs: 'smooth_quartz_stairs',
  trimSlab: 'smooth_quartz_slab',
  mullion: 'quartz_pillar',
  ornament: 'chiseled_quartz_block',
  glass: 'glass_pane',
};

const BRICK = {
  ...WHITE,
  wall: (x, y, z) => (rnd(x, y, z, 3) < 0.06 ? 'polished_granite' : 'bricks'),
  inner: 'smooth_sandstone',
  pilaster: 'bricks',
  frame: 'bricks',
  trim: 'smooth_sandstone',
  trimStairs: 'smooth_sandstone_stairs',
  trimSlab: 'smooth_sandstone_slab',
  mullion: 'cut_sandstone',
  ornament: 'chiseled_sandstone',
};

const SAND = {
  ...BRICK,
  wall: (x, y, z) => (rnd(x, y, z, 4) < 0.1 ? 'sandstone' : 'smooth_sandstone'),
  pilaster: 'cut_sandstone',
  frame: 'cut_sandstone',
  trim: 'cut_sandstone',
};

const ROOF = { stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', block: 'deepslate_tiles' };
const DIRS = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
const OPPOSITE = { north: 'south', south: 'north', west: 'east', east: 'west' };

// ------------------------------------------------------------------ Gelände (Höhenkarte)

function insideArea(x, z) {
  const dx = (x - AREA.cx) / AREA.rx;
  const dz = (z - AREA.cz) / AREA.rz;
  return dx * dx * dx * dx + dz * dz * dz * dz <= 1;
}

function valueNoise(x, z, cell, salt) {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const fx = x / cell - gx;
  const fz = z / cell - gz;
  const s = (t) => t * t * (3 - 2 * t);
  const v = (i, j) => rnd(gx + i, 0, gz + j, salt);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
  return top + (bottom - top) * s(fz);
}

// Zufahrt: Polylinie vom Vorplatz nach Nordosten hinunter, je Punkt [x, z, Höhe der Wegoberkante].
const ROAD = [[146, 0, -7], [152, -3, -9], [157, -10, -12], [160, -19, -16], [161, -30, -21], [160, -44, -26]];

function roadInfo(x, z) {
  let best = { dist: Infinity, y: 0 };
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [x1, z1, y1] = ROAD[i];
    const [x2, z2, y2] = ROAD[i + 1];
    const vx = x2 - x1;
    const vz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * vx + (z - z1) * vz) / (vx * vx + vz * vz)));
    const dist = Math.sqrt((x - x1 - vx * t) ** 2 + (z - z1 - vz * t) ** 2);
    if (dist < best.dist) best = { dist, y: y1 + (y2 - y1) * t };
  }
  return best;
}

// Chamfer-Abstand (5/7) zu einer Liste von Rechtecken, ganzzahlig und damit in Node und Browser gleich.
function chamfer(rects, x0, z0, W, D) {
  const dist = new Int32Array(W * D).fill(1 << 28);
  for (const [x1, x2, z1, z2] of rects) {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) dist[(z - z0) * W + (x - x0)] = 0;
  }
  const relax = (i, j, w) => {
    if (dist[j] + w < dist[i]) dist[i] = dist[j] + w;
  };
  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      const i = z * W + x;
      relax(i, i - 1, 5); relax(i, i - W, 5); relax(i, i - W - 1, 7); relax(i, i - W + 1, 7);
    }
  }
  for (let z = D - 2; z >= 1; z--) {
    for (let x = W - 2; x >= 1; x--) {
      const i = z * W + x;
      relax(i, i + 1, 5); relax(i, i + W, 5); relax(i, i + W + 1, 7); relax(i, i + W - 1, 7);
    }
  }
  return dist;
}

function cliffDrop(x, z, d, salt) {
  // Felsschultern: die ersten 1–2 Blöcke neben den Mauern bleiben oft fast auf Höhe der Platte.
  const dd = Math.max(0, d - 1.4 + (valueNoise(x, z, 8, salt) - 0.4) * 5 + (valueNoise(x, z, 3, salt + 1) - 0.5) * 1.6);
  return (24 * dd) / (dd + 3.5) + 0.22 * dd + valueNoise(x, z, 4, salt + 2) * 2.5;
}

// Weiche Felsstufen: in jedem 3er-Band erst flach, dann steil; Gewicht aus Rauschen.
function ledges(x, z, h) {
  const band = Math.floor(h / 3);
  const f = h / 3 - band;
  const g = f < 0.7 ? f * 0.35 : 0.245 + ((f - 0.7) * 0.755) / 0.3;
  const w = Math.max(0, Math.min(1, valueNoise(x, z, 9, 27) * 1.6 - 0.3));
  return h + (3 * (band + g) - h) * w;
}

function buildHeightMap() {
  const x0 = AREA.cx - AREA.rx - 1;
  const z0 = AREA.cz - AREA.rz - 1;
  const W = 2 * AREA.rx + 3;
  const D = 2 * AREA.rz + 3;
  const idx = (x, z) => (z - z0) * W + (x - x0);
  const dU = chamfer(PLATEAU_UPPER, x0, z0, W, D);
  const dL = chamfer(PLATEAU_LOWER, x0, z0, W, D);
  const heights = new Int32Array(W * D).fill(BOTTOM);
  const inside = new Uint8Array(W * D);
  for (let z = z0; z < z0 + D; z++) {
    for (let x = x0; x < x0 + W; x++) {
      const i = idx(x, z);
      if (!insideArea(x, z)) continue;
      inside[i] = 1;
      let h;
      if (dU[i] === 0) {
        h = -2;
        if (x < 14 && z >= PW.z1 && z <= PW.z2) h -= Math.round((14 - x) * 0.6); // Palas-Westteil steht tiefer im Fels
      } else if (dL[i] === 0) h = -7;
      else {
        const upper = -2 - cliffDrop(x, z, dU[i] / 5, 21);
        let lowerDrop = cliffDrop(x, z, dL[i] / 5, 31);
        // Ostseite (Zufahrt): sanfter Waldhang statt Felswand
        const east = Math.max(0, Math.min(1, (x - 134) / 10));
        if (east > 0) lowerDrop = lowerDrop * (1 - east) + (0.5 * (dL[i] / 5) + valueNoise(x, z, 6, 33) * 2) * east;
        h = ledges(x, z, Math.max(upper, -7 - lowerDrop));
        const road = roadInfo(x, z);
        if (road.dist <= 3) h = road.y;
        else if (road.dist <= 8) h = road.y + (h - road.y) * ((road.dist - 3) / 5);
        // zum Rand der Insel hin tiefer, damit die Schnittkante überall niedrig bleibt
        const ex = (x - AREA.cx) / AREA.rx;
        const ez = (z - AREA.cz) / AREA.rz;
        const edge = ex * ex * ex * ex + ez * ez * ez * ez;
        if (edge > 0.55) h -= ((edge - 0.55) / 0.45) * 10;
      }
      heights[i] = Math.max(BOTTOM + 1, Math.round(h));
    }
  }
  const valid = (x, z) => x >= x0 && x < x0 + W && z >= z0 && z < z0 + D;
  return {
    x0, z0, W, D,
    top: (x, z) => (valid(x, z) && inside[idx(x, z)] ? heights[idx(x, z)] : null),
    distance: (x, z) => (valid(x, z) ? Math.min(dU[idx(x, z)], dL[idx(x, z)]) / 5 : Infinity),
  };
}

const G = buildHeightMap();

function groundTop(x, z) {
  return G.top(x, z) ?? BOTTOM;
}

function rockAt(x, y, z) {
  const band = Math.floor((y + valueNoise(x, z, 9, 31) * 4) / 3);
  const r = rnd(x, y, z, 32);
  if (r < 0.05) return 'cobblestone';
  if (r < 0.08) return 'andesite';
  const layer = ((band % 4) + 4) % 4;
  if (layer === 0) return r < 0.5 ? 'stone' : 'andesite';
  if (layer === 1) return r < 0.7 ? 'stone' : 'tuff';
  if (layer === 2) return r < 0.6 ? 'andesite' : 'stone';
  return r < 0.6 ? 'stone' : 'diorite';
}

function buildTerrain(b) {
  const { x0, z0, W, D } = G;
  for (let z = z0; z < z0 + D; z++) {
    for (let x = x0; x < x0 + W; x++) {
      const h = G.top(x, z);
      if (h === null) continue;
      let low = h;
      let rim = false;
      for (const [dx, dz] of Object.values(DIRS)) {
        const n = G.top(x + dx, z + dz);
        if (n === null) rim = true;
        else low = Math.min(low, n);
      }
      const steep = h - low >= 2;
      const plateau = G.distance(x, z) === 0;
      const road = roadInfo(x, z).dist <= 3;
      const from = rim ? BOTTOM : Math.max(BOTTOM, Math.min(h - 3, low));
      for (let y = from; y <= h; y++) {
        let state = rockAt(x, y, z);
        if (!steep && !plateau && y >= h - 2) {
          if (y === h) {
            if (road) state = rnd(x, y, z, 41) < 0.55 ? 'gravel' : 'coarse_dirt';
            else {
              const r = rnd(x, y, z, 40);
              state = r < 0.08 ? 'podzol' : r < 0.12 ? 'coarse_dirt' : r < 0.16 ? 'moss_block' : 'grass_block';
            }
          } else state = 'dirt';
        }
        if (steep && y >= h - 1 && rnd(x, y, z, 42) < 0.2) state = 'mossy_cobblestone';
        b.set(x, y, z, state);
      }
    }
  }
}

// ------------------------------------------------------------------ Fassaden-Rahmen

// Rahmen einer Fassade eines Rechtecks: Ursprung = linke Ecke (von außen gesehen) in der Wandebene,
// lokal +x nach rechts, +z nach außen, −z nach innen.
function frameOf(rect, side) {
  const { x1, x2, z1, z2 } = rect;
  if (side === 'south') return { offset: [x1, 0, z2], rotate: 0, len: x2 - x1 + 1, toWorld: (lx, lz) => [x1 + lx, z2 + lz] };
  if (side === 'north') return { offset: [x2, 0, z1], rotate: 180, len: x2 - x1 + 1, toWorld: (lx, lz) => [x2 - lx, z1 - lz] };
  if (side === 'west') return { offset: [x1, 0, z1], rotate: 90, len: z2 - z1 + 1, toWorld: (lx, lz) => [x1 - lz, z1 + lx] };
  return { offset: [x2, 0, z2], rotate: 270, len: z2 - z1 + 1, toWorld: (lx, lz) => [x2 + lz, z2 - lx] };
}

function onSide(b, rect, side, draw) {
  const f = frameOf(rect, side);
  b.transform({ offset: f.offset, rotate: f.rotate }, () => draw(f));
}

const WINDOW_TYPES = {
  single: { cells: [0], mullions: [] },
  pair: { cells: [-1, 0, 1], mullions: [0] },
  triple: { cells: [-2, -1, 0, 1, 2], mullions: [-1, 1] },
  wide: { cells: [-1, 0, 1], mullions: [] },
};

// Fenstergruppe in lokalen Fassaden-Koordinaten: Gewände aus glattem Stein, Glas eine Ebene zurück (lz −1),
// Mittelpfosten, Bank davor, Rundbogen-Ecken oben. blind = Blendfenster (Nische ohne Glas).
function windowGroup(b, P, c, y1, h, type, { blind = false, frame = true, door = false } = {}) {
  const spec = WINDOW_TYPES[type];
  const y2 = y1 + h - 1;
  const lo = c + spec.cells[0];
  const hi = c + spec.cells.at(-1);
  if (frame) {
    for (let y = y1 - 1; y <= y2 + 1; y++) {
      b.set(lo - 1, y, 0, P.frame);
      b.set(hi + 1, y, 0, P.frame);
    }
    for (let lx = lo; lx <= hi; lx++) {
      b.set(lx, y2 + 1, 0, P.frame);
      if (!door) b.set(lx, y1 - 1, 0, P.frame);
    }
  }
  for (const d of spec.cells) {
    const mullion = spec.mullions.includes(d);
    for (let y = y1; y <= y2; y++) {
      b.set(c + d, y, 0, mullion ? P.mullion : 'air');
      b.set(c + d, y, -1, mullion || blind ? P.inner : door && y < y1 + 2 ? 'air' : P.glass);
    }
    if (!door) b.stairs(c + d, y1 - 1, 1, P.trimStairs, { facing: 'north', half: 'top' });
  }
  if (spec.cells.length > 1) {
    b.stairs(lo, y2, 0, P.trimStairs, { facing: 'west', half: 'top' });
    b.stairs(hi, y2, 0, P.trimStairs, { facing: 'east', half: 'top' });
  } else if (frame) b.set(c, y2 + 1, 0, P.ornament);
}

// Fassade: Mauer (lz 0 außen, lz −1 innen) vom Fels bis top, Sockel mit Vorsprung, Ecklisenen, Gurtgesimse
// (courses), Zahnfries unter der Traufe, Fenster. o.windows(s, F) → [{ c, type, h, dy, blind, door }].
function facade(b, f, o) {
  const P = o.P;
  const len = f.len;
  const pil = new Set(o.pilasters ?? [0, len - 1]);
  const corners = o.corners ?? [true, true];
  const courses = o.courses ?? [];
  const ground = (lx, lz) => {
    const [x, z] = f.toWorld(lx, lz);
    return groundTop(x, z);
  };
  const socleTop = o.socleTop ?? o.storeys[0] - 1;
  for (let lx = -1; lx <= len; lx++) {
    const edge = lx < 0 || lx >= len;
    if (edge && !corners[lx < 0 ? 0 : 1]) continue;
    const ref = Math.max(0, Math.min(len - 1, lx));
    const gOut = Math.min(ground(lx, 1), socleTop - 1);
    if (!edge) {
      const foot = Math.min(ground(lx, 0), gOut);
      for (let y = foot; y <= o.top; y++) {
        const soc = y <= socleTop;
        b.set(lx, y, 0, soc ? P.socle(lx, y, 0) : P.wall(lx, y, 0));
        b.set(lx, y, -1, soc ? P.socleInner : P.inner);
      }
    }
    for (let y = gOut; y < socleTop; y++) b.set(lx, y, 1, P.socle(lx, y, 1));
    b.stairs(lx, socleTop, 1, P.socleStairs, { facing: 'north' });
    if (pil.has(ref)) {
      for (let y = socleTop + 1; y < o.top; y++) b.set(lx, y, 1, P.pilaster);
    } else {
      for (const y of courses) b.stairs(lx, y, 1, P.trimStairs, { facing: 'north', half: 'top' });
      if (o.frieze && Math.abs(lx) % 2 === 0) b.stairs(lx, o.top - 1, 1, P.trimStairs, { facing: 'north', half: 'top' });
    }
    b.stairs(lx, o.top, 1, P.trimStairs, { facing: 'north', half: 'top' });
    if (o.crown === 'battlement') {
      b.set(lx, o.top + 1, 1, P.wall(lx, o.top + 1, 1));
      if (Math.abs(lx) % 2 === 0) {
        b.set(lx, o.top + 2, 1, P.wall(lx, o.top + 2, 1));
        b.slab(lx, o.top + 3, 1, P.trimSlab);
      } else b.slab(lx, o.top + 2, 1, P.trimSlab);
    }
  }
  if (o.windows) {
    o.storeys.forEach((F, s) => {
      for (const w of o.windows(s, F)) windowGroup(b, P, w.c, F + (w.dy ?? 1), w.h, w.type, w);
    });
  }
}

function bayCenters(len, step = 6, skip = []) {
  const out = [];
  for (let c = 3; c < len - 1; c += step) if (!skip.includes(c)) out.push(c);
  return out;
}

// ------------------------------------------------------------------ Dächer

function roofStair(u, y, v, facing) {
  const id = rnd(u, y, v, 51) < 0.14 ? 'deepslate_brick_stairs' : ROOF.stairs;
  return `${id}[facing=${facing},half=bottom]`;
}

// Satteldach mit 45°-Treppen. axis = Firstrichtung. ends = Überstand an den Giebelseiten [Anfang, Ende].
// gables: Giebeldreiecke in Wandmaterial; stepped: Staffelgiebel, die über das Dach hinausragen (cap = Stufe obenauf).
function gableRoof(b, r) {
  const oh = r.overhang ?? 1;
  const [e1, e2] = r.ends ?? [oh, oh];
  const alongX = r.axis === 'x';
  const [u1, u2] = alongX ? [r.x1, r.x2] : [r.z1, r.z2];
  const [v1, v2] = alongX ? [r.z1, r.z2] : [r.x1, r.x2];
  const a1 = v1 - oh;
  const a2 = v2 + oh;
  const width = a2 - a1 + 1;
  const half = Math.floor(width / 2);
  const put = (u, y, v, state) => (alongX ? b.set(u, y, v, state) : b.set(v, y, u, state));
  const up = alongX ? 'south' : 'east';
  const down = alongX ? 'north' : 'west';
  const gable = r.gables ?? [true, true];
  for (let u = u1 - e1; u <= u2 + e2; u++) {
    for (let k = 0; k < half; k++) {
      put(u, r.y + k, a1 + k, roofStair(u, r.y + k, a1 + k, up));
      put(u, r.y + k, a2 - k, roofStair(u, r.y + k, a2 - k, down));
    }
    if (width % 2 === 1) {
      put(u, r.y + half - 1, a1 + half, ROOF.block);
      put(u, r.y + half, a1 + half, `${ROOF.slab}[type=bottom]`);
    }
  }
  for (const [i, u] of [[0, u1], [1, u2]]) {
    if (!gable[i]) continue;
    for (let k = 0; k < half; k++) {
      for (let v = Math.max(v1, a1 + k + 1); v <= Math.min(v2, a2 - k - 1); v++) put(u, r.y + k, v, r.wall(u, r.y + k, v));
    }
    if (r.stepped) {
      for (let v = v1; v <= v2; v++) {
        const e = Math.min(v - a1, a2 - v);
        const peak = r.y + 2 * Math.floor(e / 2) + 2;
        for (let y = r.y; y < peak; y++) put(u, y, v, r.wall(u, y, v));
        put(u, peak, v, `${r.cap}[type=bottom]`);
      }
    }
  }
  return { ridge: r.y + half, mid: a1 + half };
}

// ------------------------------------------------------------------ Rundtürme

function discCells(r) {
  const R = Math.ceil(r) + 1;
  const inDisc = (dx, dz) => dx * dx + dz * dz <= (r + 0.5) * (r + 0.5);
  const cells = [];
  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      if (!inDisc(dx, dz)) continue;
      const shell = !inDisc(dx + 1, dz) || !inDisc(dx - 1, dz) || !inDisc(dx, dz + 1) || !inDisc(dx, dz - 1);
      cells.push({ dx, dz, shell });
    }
  }
  return { cells, inDisc };
}

function towardCenter(dx, dz) {
  if (Math.abs(dz) >= Math.abs(dx)) return dz > 0 ? 'north' : 'south';
  return dx > 0 ? 'west' : 'east';
}

// Runder Turmschaft: Mantel aus mat, innen Luft (carve).
function roundShaft(b, { cx, cz, r, y1, y2, mat, carve = true }) {
  const { cells } = discCells(r);
  for (let y = y1; y <= y2; y++) {
    for (const { dx, dz, shell } of cells) {
      if (shell) b.set(cx + dx, y, cz + dz, mat(cx + dx, y, cz + dz));
      else if (carve) b.set(cx + dx, y, cz + dz, 'air');
    }
  }
}

// Ring um einen Rundturm (Zellen außerhalb, die den Mantel berühren).
function ringAround(r) {
  const { inDisc } = discCells(r);
  const out = [];
  const R = Math.ceil(r) + 2;
  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      if (inDisc(dx, dz)) continue;
      if (Object.values(DIRS).some(([ax, az]) => inDisc(dx + ax, dz + az))) out.push([dx, dz]);
    }
  }
  return out;
}

// Gesimsring außen um einen Rundturm (obere Treppen, Rückseite am Turm).
function roundBand(b, { cx, cz, r, y, stairs, half = 'top' }) {
  for (const [dx, dz] of ringAround(r)) b.stairs(cx + dx, y, cz + dz, stairs, { facing: towardCenter(dx, dz), half });
}

// Sockelring eines Turms auf dem Fels: vom Gelände bis yTop, darauf eine Schräge.
function socleRing(b, { cx, cz, r, yTop }) {
  for (const [dx, dz] of ringAround(r)) {
    const x = cx + dx;
    const z = cz + dz;
    for (let y = Math.min(groundTop(x, z), yTop); y <= yTop; y++) b.set(x, y, z, WHITE.socle(x, y, z));
    b.stairs(x, yTop + 1, z, WHITE.socleStairs, { facing: towardCenter(dx, dz) });
  }
}

// Kegelhelm: Ringe aus Treppen, die zur Mitte steigen; Spitze mit Mauer und Blitzableiter als Knauf.
function spire(b, { cx, cz, y, r, h, finial = 'lightning_rod' }) {
  const radius = (k) => (r * (h - k)) / h;
  for (let k = 0; k < h; k++) {
    const { cells } = discCells(radius(k));
    const next = k + 1 < h ? discCells(radius(k + 1)).inDisc : () => false;
    for (const { dx, dz, shell } of cells) {
      const px = cx + dx;
      const pz = cz + dz;
      if (dx === 0 && dz === 0 && !next(0, 0)) b.set(px, y + k, pz, 'deepslate_tile_wall');
      else if (!next(dx, dz)) b.set(px, y + k, pz, roofStair(px, y + k, pz, towardCenter(dx, dz)));
      else if (shell) b.set(px, y + k, pz, ROOF.block);
    }
  }
  if (finial) b.set(cx, y + h, cz, finial);
}

// Kragkegel unter einem Erkertürmchen: obere Treppen, nach unten enger. skip(x, z) = im Bau liegende Zellen.
function corbelCone(b, { cx, cz, r, y, rows, P, skip = () => false }) {
  for (let j = 1; j <= rows; j++) {
    const { cells } = discCells(r - (j * r) / (rows + 1));
    const lower = j < rows ? discCells(r - ((j + 1) * r) / (rows + 1)).inDisc : () => false;
    for (const { dx, dz } of cells) {
      if (skip(cx + dx, cz + dz)) continue;
      if (!lower(dx, dz)) b.stairs(cx + dx, y - j, cz + dz, P.trimStairs, { facing: towardCenter(dx, dz), half: 'top' });
      else b.set(cx + dx, y - j, cz + dz, P.trim);
    }
  }
}

// Fenster im Mantel eines Rundturms in Richtung dir (Glas in der Mantelzelle, Bank davor, Sturz darüber).
function towerWindow(b, { cx, cz, r, y, h = 2, dir, P = WHITE }) {
  const [ax, az] = DIRS[dir];
  const R = Math.round(r);
  for (let k = 0; k < h; k++) b.set(cx + ax * R, y + k, cz + az * R, P.glass);
  b.set(cx + ax * R, y + h, cz + az * R, P.trim);
  b.stairs(cx + ax * (R + 1), y - 1, cz + az * (R + 1), P.trimStairs, { facing: OPPOSITE[dir], half: 'top' });
}

function turret(b, t) {
  const { cx, cz, r, y1, y2, P = WHITE, spireH, spireR = r + 1, corbel = 0, skip, windows = [] } = t;
  if (corbel > 0) corbelCone(b, { cx, cz, r, y: y1, rows: corbel, P, skip });
  roundShaft(b, { cx, cz, r, y1, y2, mat: P.wall, carve: true });
  for (const w of windows) towerWindow(b, { cx, cz, r, P, ...w });
  roundBand(b, { cx, cz, r, y: y2, stairs: P.trimStairs });
  spire(b, { cx, cz, y: y2 + 1, r: spireR, h: spireH });
}

// ------------------------------------------------------------------ Palas: Mauern

// Fenster je Geschoss: EG klein, 1./2. OG Doppelfenster, 3. OG hohe Doppelfenster, 4. OG Arkaden (Dreierfenster).
function palasWindows(s, c) {
  if (s === 0) return { c, type: 'single', h: 2, dy: 1 };
  if (s <= 2) return { c, type: 'pair', h: 3 };
  if (s === 3) return { c, type: 'pair', h: 4 };
  return { c, type: 'triple', h: 4 };
}

function palasFacade(b, rect, side, { skipBays = [], corners = [true, true], skipUpper = [], blindUpper = false, doors = [], extra = null }) {
  onSide(b, rect, side, (f) => {
    const bays = bayCenters(f.len, 6, skipBays);
    facade(b, f, {
      P: WHITE, storeys: ST, top: TOP, socleTop: -1, courses: [ST[3] - 1], frieze: true, corners,
      windows: (s) => bays.flatMap((c) => {
        if (s >= 3 && skipUpper.includes(c)) return [];
        const w = palasWindows(s, c);
        if (s === 3 && doors.includes(c)) return [{ ...w, dy: 0, door: true }];
        return [s >= 3 && blindUpper ? { ...w, blind: true } : w];
      }),
    });
    if (extra) extra(f);
  });
}

function buildPalasWalls(b) {
  palasFacade(b, PW, 'west', { skipBays: [] });
  palasFacade(b, PW, 'south', { corners: [true, false] });
  palasFacade(b, PW, 'north', { corners: [false, true], skipBays: [3], blindUpper: true });
  palasFacade(b, PE, 'south', { corners: [false, true], skipBays: [3], doors: [15, 21] });
  palasFacade(b, PE, 'north', { corners: [true, false], skipBays: [3, 27] });
  palasFacade(b, PE, 'east', { skipBays: [3] });
  // Fuge zwischen den beiden Baukörpern
  for (let z = PW.z1 + 1; z < PW.z2; z++) for (let y = -1; y <= TOP; y++) b.set(24, y, z, WHITE.inner);
  for (let z = PE.z1 + 1; z < PE.z2; z++) for (let y = -1; y <= TOP; y++) b.set(25, y, z, WHITE.inner);
  // Hauptportal zum oberen Hof
  onSide(b, PE, 'east', () => {
    for (let lx = 11; lx <= 15; lx++) for (let y = 0; y <= 4; y++) b.set(lx, y, 0, WHITE.trim);
    for (let lx = 12; lx <= 14; lx++) {
      for (let y = 0; y <= 2; y++) {
        b.set(lx, y, 0, 'air');
        b.set(lx, y, -1, 'air');
      }
      b.set(lx, -1, 1, 'stone_bricks');
      b.stairs(lx, -1, 2, 'stone_brick_stairs', { facing: 'north' });
    }
    b.stairs(12, 2, 0, WHITE.trimStairs, { facing: 'west', half: 'top' });
    b.stairs(14, 2, 0, WHITE.trimStairs, { facing: 'east', half: 'top' });
    b.set(13, 3, 0, WHITE.ornament);
    for (const lx of [11, 15]) for (let y = 0; y <= 3; y++) b.set(lx, y, 1, 'quartz_pillar');
    for (let lx = 10; lx <= 16; lx++) b.stairs(lx, 4, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
    b.door(12, 0, -1, 'dark_oak_door', { facing: 'north', hinge: 'left', open: true });
    b.door(14, 0, -1, 'dark_oak_door', { facing: 'north', hinge: 'right', open: true });
    b.set(10, 2, 1, 'lantern');
    b.set(16, 2, 1, 'lantern');
  });
  // Balkone im 3. OG an der Südseite (Königswohnung)
  onSide(b, PE, 'south', () => {
    for (const c of [15, 21]) {
      for (let lx = c - 2; lx <= c + 2; lx++) {
        b.set(lx, 14, 1, WHITE.trim);
        b.set(lx, 14, 2, WHITE.trim);
        b.stairs(lx, 13, 2, WHITE.trimStairs, { facing: 'north', half: 'top' });
        b.set(lx, 15, 2, 'iron_bars');
      }
      b.set(c - 2, 15, 1, 'iron_bars');
      b.set(c + 2, 15, 1, 'iron_bars');
      for (const lx of [c - 1, c + 1]) b.set(lx, 14, 0, WHITE.trim);
      b.stairs(c - 2, 13, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
      b.stairs(c + 2, 13, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
    }
  });
}

function buildPalasFloors(b) {
  const floorState = ['polished_andesite', 'spruce_planks', 'spruce_planks', 'dark_oak_planks', 'oak_planks'];
  ST.forEach((F, s) => {
    for (let x = PW_IN.x1; x <= PW_IN.x2; x++) {
      for (let z = PW_IN.z1; z <= PW_IN.z2; z++) {
        const void4 = s === 4 && x >= 5 && x <= 14 && z <= 7;
        const apse4 = s === 4 && x <= 17 && z <= -7;
        if (!void4 && !apse4) b.set(x, F - 1, z, floorState[s]);
      }
    }
    for (let x = PE_IN.x1; x <= PE_IN.x2; x++) for (let z = PE_IN.z1; z <= PE_IN.z2; z++) b.set(x, F - 1, z, floorState[s]);
  });
  for (let x = PW_IN.x1; x <= PW_IN.x2; x++) for (let z = PW_IN.z1; z <= PW_IN.z2; z++) b.set(x, TOP, z, 'spruce_planks');
  for (let x = PE_IN.x1; x <= PE_IN.x2; x++) for (let z = PE_IN.z1; z <= PE_IN.z2; z++) b.set(x, TOP, z, 'spruce_planks');
}

// ------------------------------------------------------------------ Palas: Dächer, Söller, Türmchen

const FACING_ROTATE = { south: 0, west: 90, north: 180, east: 270 };

// Kleine Dachgaube: helle Front mit Fenster, Wangen aus Schiefer, eigenes Satteldach mit Knauf.
// Ursprung = Mitte der Vorderwand unten auf der Dachfläche; facing = Talseite. Für 45°-Dächer (Tiefe 4).
function roofDormer(b, { x, y, z, facing }) {
  b.transform({ offset: [x, y, z], rotate: FACING_ROTATE[facing] }, () => {
    for (let lz = -3; lz <= 1; lz++) {
      const front = lz === 0;
      if (lz <= 0) {
        for (let ly = 0; ly <= 1; ly++) {
          b.set(-1, ly, lz, front ? 'quartz_pillar' : ROOF.block);
          b.set(1, ly, lz, front ? 'quartz_pillar' : ROOF.block);
          b.set(0, ly, lz, front ? 'glass_pane' : 'air');
        }
        b.set(0, 2, lz, front ? 'chiseled_quartz_block' : 'air');
      }
      b.set(-2, 1, lz, roofStair(-2, 1, lz, 'east'));
      b.set(2, 1, lz, roofStair(2, 1, lz, 'west'));
      b.set(-1, 2, lz, roofStair(-1, 2, lz, 'east'));
      b.set(1, 2, lz, roofStair(1, 2, lz, 'west'));
      b.set(0, 3, lz, `${ROOF.slab}[type=bottom]`);
    }
    b.stairs(0, -1, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
    b.set(0, 4, 1, 'lightning_rod');
  });
}

function buildPalasRoofs(b) {
  const west = gableRoof(b, { x1: PW.x1, x2: PW.x2, z1: PW.z1, z2: PW.z2, y: TOP + 1, axis: 'x', overhang: 1, ends: [1, 0], wall: WHITE.wall });
  const east = gableRoof(b, { x1: PE.x1, x2: PE.x2, z1: PE.z1, z2: PE.z2, y: TOP + 1, axis: 'x', overhang: 1, ends: [0, 1], wall: WHITE.wall });
  // Giebelfenster
  for (const side of [['west', PW], ['east', PE]]) {
    onSide(b, side[1], side[0], () => {
      windowGroup(b, WHITE, 12, 30, 3, 'pair');
      windowGroup(b, WHITE, 12, 35, 2, 'single');
      for (let lx = 6; lx <= 18; lx++) b.stairs(lx, 28, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
    });
  }
  // Gauben: Vorderwand drei Reihen über der Traufe
  for (const x of [6, 18]) {
    roofDormer(b, { x, y: TOP + 4, z: PW.z2 - 2, facing: 'south' });
    roofDormer(b, { x, y: TOP + 4, z: PW.z1 + 2, facing: 'north' });
  }
  for (const x of [34, 46]) roofDormer(b, { x, y: TOP + 4, z: PE.z2 - 2, facing: 'south' });
  for (const x of [37, 46]) roofDormer(b, { x, y: TOP + 4, z: PE.z1 + 2, facing: 'north' });
  // Schornsteine
  for (const [x, z] of [[11, -4], [14, 5], [31, -2], [41, 7], [50, -3]]) {
    const ridgeMid = x <= 24 ? west.mid : east.mid;
    const roofY = TOP + 1 + 12 - Math.abs(z - ridgeMid);
    for (let y = roofY; y <= roofY + 4; y++) b.set(x, y, z, y >= roofY + 3 ? 'smooth_quartz' : 'calcite');
    b.stairs(x, roofY + 4, z - 1, WHITE.trimStairs, { facing: 'south', half: 'top' });
    b.stairs(x, roofY + 4, z + 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
    b.set(x, roofY + 5, z, 'stone_brick_wall');
  }
  // Firstkamm und Knäufe
  for (let x = PW.x1; x < PW.x2; x++) if (x % 2 === 0) b.set(x, west.ridge + 1, west.mid, 'iron_bars');
  for (let x = PE.x1 + 1; x <= PE.x2; x++) if (x % 2 === 0) b.set(x, east.ridge + 1, east.mid, 'iron_bars');
  b.set(PW.x1 - 1, west.ridge + 1, west.mid, 'lightning_rod');
  b.set(PE.x2 + 1, east.ridge + 1, east.mid, 'lightning_rod');
}

// Söller vor der Westfassade (Thronsaal): zweigeschossiger Erker auf Konsolen mit Balkon obenauf.
function buildSoller(b) {
  onSide(b, PW, 'west', () => {
    const lo = 7;
    const hi = 17;
    const depth = 4;
    for (let lx = lo; lx <= hi; lx++) {
      for (let j = 0; j < depth; j++) {
        const y = 14 - j;
        for (let lz = 1; lz <= depth - j; lz++) {
          if (lz === depth - j) b.stairs(lx, y, lz, WHITE.trimStairs, { facing: 'north', half: 'top' });
          else b.set(lx, y, lz, WHITE.trim);
        }
      }
    }
    for (let j = 0; j < depth; j++) {
      for (let lz = 1; lz <= depth - j; lz++) {
        b.stairs(lo - 1, 14 - j, lz, WHITE.trimStairs, { facing: 'east', half: 'top' });
        b.stairs(hi + 1, 14 - j, lz, WHITE.trimStairs, { facing: 'west', half: 'top' });
      }
    }
    for (let y = 15; y <= 26; y++) {
      for (let lx = lo; lx <= hi; lx++) b.set(lx, y, depth, WHITE.wall(lx, y, depth));
      for (let lz = 1; lz < depth; lz++) {
        b.set(lo, y, lz, WHITE.wall(lo, y, lz));
        b.set(hi, y, lz, WHITE.wall(hi, y, lz));
        for (let lx = lo + 1; lx < hi; lx++) b.set(lx, y, lz, y === 20 ? 'oak_planks' : 'air');
      }
    }
    for (let lx = lo + 1; lx < hi; lx++) {
      for (const y of [15, 16, 17, 18, 19, 21, 22, 23, 24, 25]) {
        b.set(lx, y, 0, 'air');
        b.set(lx, y, -1, 'air');
      }
    }
    b.transform({ offset: [0, 0, depth], rotate: 0 }, () => {
      for (const y1 of [16, 22]) {
        windowGroup(b, WHITE, 12, y1, 3, 'triple');
        windowGroup(b, WHITE, 9, y1, 3, 'single');
        windowGroup(b, WHITE, 15, y1, 3, 'single');
      }
      for (let lx = lo - 1; lx <= hi + 1; lx++) {
        b.stairs(lx, 20, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
        b.stairs(lx, 26, 1, WHITE.trimStairs, { facing: 'north', half: 'top' });
      }
    });
    for (let lz = 1; lz <= depth; lz++) {
      for (const y of [20, 26]) {
        b.stairs(lo - 1, y, lz, WHITE.trimStairs, { facing: 'east', half: 'top' });
        b.stairs(hi + 1, y, lz, WHITE.trimStairs, { facing: 'west', half: 'top' });
      }
    }
    for (const y1 of [16, 22]) {
      for (let k = 0; k < 3; k++) {
        b.set(lo, y1 + k, 2, WHITE.glass);
        b.set(hi, y1 + k, 2, WHITE.glass);
      }
    }
    // Balkon
    for (let lx = lo; lx <= hi; lx++) for (let lz = 1; lz <= depth; lz++) b.set(lx, 27, lz, 'smooth_quartz');
    for (let lx = lo; lx <= hi; lx++) b.set(lx, 28, depth, lx === lo || lx === hi || lx === 12 ? 'quartz_bricks' : 'iron_bars');
    for (let lz = 1; lz < depth; lz++) {
      b.set(lo, 28, lz, 'iron_bars');
      b.set(hi, 28, lz, 'iron_bars');
    }
    for (const lx of [lo, hi]) b.set(lx, 29, depth, 'lantern');
  });
}

function buildPalasTurrets(b) {
  const inPW = (x, z) => x >= PW.x1 && x <= PW.x2 && z >= PW.z1 && z <= PW.z2;
  for (const cz of [PW.z1 - 1, PW.z2 + 1]) {
    turret(b, {
      cx: PW.x1 - 1, cz, r: 2, y1: 14, y2: 33, corbel: 3, spireH: 14, skip: inPW,
      windows: [{ y: 17, h: 3, dir: 'west' }, { y: 23, h: 3, dir: 'west' }, { y: 29, h: 2, dir: cz < 0 ? 'north' : 'south' }],
    });
  }
  turret(b, {
    cx: PE.x2 + 1, cz: PE.z1 - 1, r: 2, y1: 18, y2: 32, corbel: 3, spireH: 12,
    skip: (x, z) => x <= PE.x2 && z >= PE.z1,
    windows: [{ y: 22, h: 3, dir: 'east' }, { y: 28, h: 2, dir: 'north' }],
  });
}

// Wintergarten im 3. OG an der Nordseite des Ostflügels.
function buildWinterGarden(b) {
  onSide(b, PE, 'north', () => {
    const lo = 9;
    const hi = 17;
    for (let lx = lo; lx <= hi; lx++) {
      for (let lz = 1; lz <= 3; lz++) {
        b.set(lx, 14, lz, 'smooth_quartz');
        const rim = lx === lo || lx === hi || lz === 3;
        b.set(lx, 20, lz, rim ? 'smooth_quartz_slab[type=bottom]' : 'glass');
        for (let y = 15; y <= 19; y++) {
          const post = rim && (lx === lo || lx === hi || (lz === 3 && lx % 2 === 1));
          b.set(lx, y, lz, post ? 'quartz_pillar' : rim ? 'glass_pane' : 'air');
        }
      }
      b.stairs(lx, 13, 3, WHITE.trimStairs, { facing: 'north', half: 'top' });
      b.stairs(lx, 12, 2, WHITE.trimStairs, { facing: 'north', half: 'top' });
      b.set(lx, 13, 2, WHITE.trim);
      b.set(lx, 13, 1, WHITE.trim);
      b.set(lx, 12, 1, WHITE.trim);
    }
    for (let lx = lo + 1; lx < hi; lx++) {
      for (let y = 15; y <= 18; y++) {
        b.set(lx, y, 0, lx % 3 === 0 ? 'quartz_pillar' : 'air');
        b.set(lx, y, -1, 'air');
      }
    }
    for (let lx = lo + 1; lx < hi; lx += 2) b.set(lx, 15, 2, lx % 4 === 0 ? 'potted_fern' : 'potted_azure_bluet');
    b.set(lo + 1, 15, 1, 'azalea');
    b.set(hi - 1, 15, 1, 'flowering_azalea');
    b.set(13, 19, 2, 'lantern[hanging=true]');
  });
}

// ------------------------------------------------------------------ Nordturm und Treppentürme

const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

function dirBetween([x1, z1], [x2, z2]) {
  if (x2 > x1) return 'east';
  if (x2 < x1) return 'west';
  return z2 > z1 ? 'south' : 'north';
}

// Wendeltreppe um eine Mittelsäule (Ring mit Radius 1, eine Stufe pro Ebene, 8 Stufen je Umlauf).
function spiralStair(b, { cx, cz, y1, y2, stairs = 'stone_brick_stairs', core = 'quartz_pillar' }) {
  for (let y = y1; y <= y2; y++) {
    const i = (y - y1) % 8;
    const [dx, dz] = RING[i];
    b.stairs(cx + dx, y, cz + dz, stairs, { facing: dirBetween(RING[i], RING[(i + 1) % 8]) });
    b.set(cx, y, cz, core);
  }
}

function buildNorthTower(b) {
  const { cx, cz, r, top } = NT;
  socleRing(b, { cx, cz, r, yTop: -2 });
  roundShaft(b, { cx, cz, r, y1: -2, y2: top, mat: (x, y, z) => (y < 0 ? WHITE.socle(x, y, z) : WHITE.wall(x, y, z)) });
  const { cells } = discCells(r);
  const inner = cells.filter((c) => !c.shell);
  const annulus = inner.filter((c) => Math.max(Math.abs(c.dx), Math.abs(c.dz)) > 1);
  for (const c of inner) b.set(cx + c.dx, -1, cz + c.dz, 'polished_andesite');
  for (const F of ST.slice(1)) for (const c of annulus) b.set(cx + c.dx, F - 1, cz + c.dz, 'polished_andesite');
  spiralStair(b, { cx, cz, y1: 0, y2: ST[4] - 1 });
  // Türen zum Palas (Ostflügel) in jedem Geschoss
  for (const F of ST) {
    for (const z of [cz + 3, cz + 4, cz + 5]) {
      b.set(cx + 1, F, z, 'air');
      b.set(cx + 1, F + 1, z, 'air');
      b.set(cx + 1, F - 1, z, 'polished_andesite');
    }
  }
  // Palmsäule und Sternenhimmel über dem obersten Treppenlauf
  for (let y = ST[4]; y <= 26; y++) b.set(cx, y, cz, 'quartz_pillar');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(cx + dx, 27, cz + dz, 'jungle_leaves');
    b.set(cx + 2 * dx, 26, cz + 2 * dz, 'jungle_leaves');
  }
  b.set(cx, 27, cz, 'jungle_leaves');
  for (const c of inner) b.set(cx + c.dx, 28, cz + c.dz, (Math.abs(c.dx * 3 + c.dz * 5) % 4 === 1) ? 'glowstone' : 'blue_concrete');
  // Fenster entlang der Treppe
  const dirs = ['north', 'west', 'east'];
  for (let y = 2, i = 0; y < 38; y += 4, i++) towerWindow(b, { cx, cz, r, y, h: 2, dir: dirs[i % 3] });
  for (const y of [-1, 14, 28]) roundBand(b, { cx, cz, r, y, stairs: WHITE.trimStairs });
  // Galeriegeschoss mit hohen Bogenfenstern
  for (const c of inner) b.set(cx + c.dx, 42, cz + c.dz, 'spruce_planks');
  roundBand(b, { cx, cz, r, y: 42, stairs: WHITE.trimStairs });
  for (const dir of ['north', 'south', 'east', 'west']) towerWindow(b, { cx, cz, r, y: 44, h: 4, dir });
  for (const [dx, dz] of [[2, -2], [-2, -2], [2, 2], [-2, 2]]) for (let y = 44; y <= 47; y++) b.set(cx + dx, y, cz + dz, 'glass_pane');
  for (const [dx, dz] of [[3, -1], [3, 1], [-3, -1], [-3, 1], [-1, 3], [1, 3], [-1, -3], [1, -3]]) b.set(cx + dx, 48, cz + dz, WHITE.trim);
  b.set(cx, 47, cz, 'lantern[hanging=true]');
  b.set(cx, 48, cz, 'iron_chain');
  roundBand(b, { cx, cz, r, y: top, stairs: WHITE.trimStairs });
  for (const c of inner) b.set(cx + c.dx, top, cz + c.dz, 'spruce_planks');
  spire(b, { cx, cz, y: top + 1, r: r + 1, h: 14 });
}

function buildStairTowers(b) {
  const s = SOUTH_TOWER;
  socleRing(b, { cx: s.cx, cz: s.cz, r: s.r, yTop: -2 });
  roundShaft(b, { cx: s.cx, cz: s.cz, r: s.r, y1: -2, y2: s.top, mat: (x, y, z) => (y < 0 ? WHITE.socle(x, y, z) : WHITE.wall(x, y, z)) });
  for (let y = 2; y < s.top - 3; y += 5) towerWindow(b, { cx: s.cx, cz: s.cz, r: s.r, y, h: 2, dir: y % 10 === 2 ? 'south' : 'west' });
  for (const y of [-1, 14, 28]) roundBand(b, { cx: s.cx, cz: s.cz, r: s.r, y, stairs: WHITE.trimStairs });
  roundBand(b, { cx: s.cx, cz: s.cz, r: s.r, y: s.top, stairs: WHITE.trimStairs });
  spire(b, { cx: s.cx, cz: s.cz, y: s.top + 1, r: s.r + 1, h: 13 });
  const n = NORTH_STAIR;
  socleRing(b, { cx: n.cx, cz: n.cz, r: n.r, yTop: -2 });
  roundShaft(b, { cx: n.cx, cz: n.cz, r: n.r, y1: -2, y2: n.top, mat: (x, y, z) => (y < 0 ? WHITE.socle(x, y, z) : WHITE.wall(x, y, z)) });
  for (let y = 3; y < n.top - 2; y += 6) towerWindow(b, { cx: n.cx, cz: n.cz, r: n.r, y, h: 2, dir: 'north' });
  roundBand(b, { cx: n.cx, cz: n.cz, r: n.r, y: n.top, stairs: WHITE.trimStairs });
  spire(b, { cx: n.cx, cz: n.cz, y: n.top + 1, r: n.r + 1, h: 11 });
}

// ------------------------------------------------------------------ Palas: Innenräume

function wallX(b, x, z1, z2, y1, y2, state) {
  for (let z = z1; z <= z2; z++) for (let y = y1; y <= y2; y++) b.set(x, y, z, state);
}

function wallZ(b, z, x1, x2, y1, y2, state) {
  for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) b.set(x, y, z, state);
}

function opening(b, x, y, z, h = 2, w = 1, alongX = true) {
  for (let i = 0; i < w; i++) for (let k = 0; k < h; k++) b.set(alongX ? x + i : x, y + k, alongX ? z : z + i, 'air');
}

// Raster je Geschoss: Flur z 0 … 2, Zimmer nördlich (bis z −2) und südlich (ab z 4), Querwände.
function palasRooms(b, s) {
  const F = ST[s];
  const h = (s === 3 ? 5 : s === 4 ? 6 : 4);
  const y2 = F + h - 1;
  const wall = s >= 3 ? 'smooth_quartz' : 'white_terracotta';
  // Ostflügel
  if (s !== 4) {
    wallZ(b, -1, PE_IN.x1, PE_IN.x2, F, y2, wall);
    wallZ(b, 3, PE_IN.x1, PE_IN.x2, F, y2, wall);
    for (const x of [33, 40, 47]) {
      wallX(b, x, PE_IN.z1, -2, F, y2, wall);
      wallX(b, x, 4, PE_IN.z2, F, y2, wall);
    }
    for (const x of [29, 36, 43, 50]) {
      opening(b, x, F, -1);
      opening(b, x, F, 3);
    }
  } else {
    wallZ(b, -1, PE_IN.x1, PE_IN.x2, F, y2, wall);
    for (const x of [33, 40, 47]) wallX(b, x, PE_IN.z1, -2, F, y2, wall);
    for (const x of [29, 36, 43, 50]) opening(b, x, F, -1);
  }
  // Westflügel (EG bis 2. OG)
  if (s <= 2) {
    wallZ(b, -1, PW_IN.x1, PW_IN.x2, F, y2, wall);
    wallZ(b, 3, PW_IN.x1, PW_IN.x2, F, y2, wall);
    for (const x of [9, 16]) {
      wallX(b, x, PW_IN.z1, -2, F, y2, wall);
      wallX(b, x, 4, PW_IN.z2, F, y2, wall);
    }
    for (const x of [5, 12, 20]) {
      opening(b, x, F, -1);
      opening(b, x, F, 3);
    }
  }
  // Durchgang durch die Fuge
  opening(b, 24, F, 1, 2, 2, true);
  for (const x of [24, 25]) b.set(x, F - 1, 1, s === 0 ? 'polished_andesite' : 'spruce_planks');
}

function furnishLowerFloors(b) {
  // EG: Küche, Vorrat, Gesindestube
  const F = ST[0];
  kitchen(b, { x: 34, y: F, z: -8, facing: 'south', width: 6, wood: 'fichte' });
  kitchen(b, { x: 41, y: F, z: -8, facing: 'south', width: 6, wood: 'fichte' });
  storage(b, { x: 48, y: F, z: -8, facing: 'south', width: 5, height: 2 });
  diningTable(b, { x: 28, y: F, z: 7, facing: 'south', length: 4, width: 2, wood: 'fichte' });
  diningTable(b, { x: 35, y: F, z: 7, facing: 'south', length: 4, width: 2, wood: 'fichte' });
  storage(b, { x: 3, y: F, z: -10, facing: 'south', width: 5, height: 3 });
  storage(b, { x: 10, y: F, z: -10, facing: 'south', width: 5, height: 2, chest: 'trapped_chest' });
  // 1. und 2. OG: Zimmer für Hofstaat und Diener
  for (const s of [1, 2]) {
    const y = ST[s];
    for (const x of [34, 41, 48]) bedroom(b, { x, y, z: 4, facing: 'south', width: 5, depth: 8, wood: s === 1 ? 'fichte' : 'eiche', color: s === 1 ? 'blau' : 'rot' });
    for (const x of [3, 10, 17]) bedroom(b, { x, y, z: 4, facing: 'south', width: 5, depth: 6, wood: 'fichte', color: 'gruen' });
    for (const x of [34, 41]) bookWall(b, { x, y, z: -8, facing: 'south', width: 6, height: 3, wood: 'schwarzeiche', ladder: false });
  }
}

function buildThroneHall(b) {
  const { x1, x2, z1, z2 } = HALL;
  const yF = ST[3];
  // Mosaikboden in Ringen
  const ringStates = ['polished_diorite', 'cyan_terracotta', 'white_terracotta', 'brown_terracotta', 'light_gray_terracotta'];
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const d = Math.sqrt((x - 9.5) ** 2 + (z - 1) ** 2);
      b.set(x, yF - 1, z, d > 8.5 ? 'polished_andesite' : ringStates[Math.floor(d / 1.7) % ringStates.length]);
    }
  }
  // Trennwand zum Vorraum mit Bogentor
  wallX(b, x2 + 1, z1, z2, yF, TOP - 1, 'smooth_quartz');
  opening(b, x2 + 1, yF, 0, 4, 3, false);
  b.stairs(x2 + 1, yF + 3, 0, 'smooth_quartz_stairs', { facing: 'north', half: 'top' });
  b.stairs(x2 + 1, yF + 3, 2, 'smooth_quartz_stairs', { facing: 'south', half: 'top' });
  opening(b, x2 + 1, ST[4], 1, 2, 1, false);
  // Apsis im Norden: Stufen, Podest, Goldgrund
  for (let x = 6; x <= 13; x++) {
    b.stairs(x, yF, -7, 'smooth_quartz_stairs', { facing: 'north' });
    for (let z = z1; z <= -8; z++) b.set(x, yF, z, 'smooth_quartz');
    b.stairs(x, yF + 1, -8, 'smooth_quartz_stairs', { facing: 'north' });
    for (let z = z1; z <= -9; z++) b.set(x, yF + 1, z, x === 9 || x === 10 ? 'red_carpet' : 'smooth_quartz');
  }
  for (let x = 9; x <= 10; x++) {
    b.set(x, yF + 1, -9, 'smooth_quartz');
    b.set(x, yF + 2, -9, 'red_carpet');
    b.set(x, yF + 2, -10, 'red_carpet');
    b.set(x, yF + 1, -10, 'smooth_quartz');
  }
  for (const [x, z] of [[2, -10], [3, -10], [4, -10], [5, -10], [2, -9], [3, -9], [2, -8], [17, -10], [16, -10], [15, -10], [14, -10], [17, -9], [16, -9], [17, -8]]) {
    for (let y = yF; y < TOP; y++) b.set(x, y, z, y % 4 === 0 ? 'gold_block' : 'smooth_quartz');
  }
  const figures = ['blue_concrete', 'red_concrete', 'white_concrete', 'purple_concrete'];
  for (let x = 4; x <= 15; x++) {
    for (let y = yF + 2; y < TOP; y++) {
      let state = 'gold_block';
      if (y >= yF + 4 && y <= yF + 8 && x % 2 === 1) state = figures[((x - 5) / 2) % figures.length];
      if (y >= yF + 10) state = rnd(x, y, z1, 61) < 0.25 ? 'gold_block' : 'blue_concrete';
      b.set(x, y, z1 - 1, state);
    }
  }
  // Säulen: unten rot (Porphyr), oben blau (Lapislazuli), Kapitelle vergoldet
  const cols = [];
  for (const z of [-6, -2, 2, 6]) cols.push([4, z], [15, z]);
  for (const x of [7, 12]) cols.push([x, 8]);
  cols.push([4, 8], [15, 8]);
  for (const [x, z] of cols) {
    for (let y = yF; y <= ST[4] - 2; y++) b.set(x, y, z, 'polished_granite');
    b.set(x, ST[4] - 2, z, 'gold_block');
    for (let y = ST[4]; y <= TOP - 2; y++) b.set(x, y, z, 'lapis_block');
    b.set(x, TOP - 1, z, 'gold_block');
  }
  // Galerie (4. OG) an West-, Süd- und Ostseite mit Brüstung
  for (let x = x1; x <= x2; x++) {
    for (let z = -6; z <= z2; z++) {
      const gallery = x <= 4 || x >= 15 || z >= 8;
      if (gallery) b.set(x, ST[4] - 1, z, 'oak_planks');
      const edge = gallery && ((x === 4 && z < 8) || (x === 15 && z < 8) || (z === 8 && x >= 4 && x <= 15));
      if (edge && !cols.some(([cx2, cz2]) => cx2 === x && cz2 === z)) b.set(x, ST[4], z, 'quartz_slab');
    }
  }
  for (const x of [4, 15]) {
    b.stairs(x, ST[4] - 1, -7, 'oak_stairs', { facing: 'south', half: 'top' });
    for (let z = -6; z <= 7; z++) if (!cols.some(([a, c]) => a === x && c === z)) b.stairs(x === 4 ? 5 : 14, ST[4] - 1, z, 'smooth_quartz_stairs', { facing: x === 4 ? 'west' : 'east', half: 'top' });
  }
  for (let x = 5; x <= 14; x++) if (!cols.some(([a, c]) => a === x && c === 8)) b.stairs(x, ST[4] - 1, 7, 'smooth_quartz_stairs', { facing: 'south', half: 'top' });
  // Wände mit Goldgrund über blauem Sockel, Sternenhimmel
  decorateRoom(b, { x1, x2, z1, z2, F: yF, h: TOP - yF, color: 'yellow_terracotta', panel: 'blue_terracotta' });
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, TOP, z, rnd(x, TOP, z, 62) < 0.08 ? 'gold_block' : 'blue_concrete');
  // Kronleuchter
  const ringY = ST[4] + 2;
  for (let x = 5; x <= 14; x++) {
    for (let z = -4; z <= 6; z++) {
      const d = Math.sqrt((x - 9.5) ** 2 + (z - 1) ** 2);
      if (d < 2.6 || d > 3.6) continue;
      b.set(x, ringY, z, 'gold_block');
      b.set(x, ringY + 1, z, (x + z) % 2 === 0 ? 'candle[candles=3,lit=true]' : 'candle[candles=1,lit=true]');
      if ((x + z) % 2 === 1) b.set(x, ringY - 1, z, 'lantern[hanging=true]');
    }
  }
  for (const [x, z] of [[9, 1], [10, 1], [9, -2], [10, 4], [6, 1], [13, 1]]) {
    for (let y = ringY + 1; y < TOP; y++) if (b.get(x, y, z) === 'air') b.set(x, y, z, 'iron_chain');
  }
  // Vorraum
  wallZ(b, -1, x2 + 2, PW_IN.x2, yF, TOP - 1, 'smooth_quartz');
  wallZ(b, 3, x2 + 2, PW_IN.x2, yF, TOP - 1, 'smooth_quartz');
  opening(b, 20, yF, -1);
  opening(b, 20, yF, 3);
  opening(b, 20, ST[4], -1);
  opening(b, 20, ST[4], 3);
  for (let x = x2 + 2; x <= PW_IN.x2; x++) for (let z = PW_IN.z1; z <= PW_IN.z2; z++) b.set(x, ST[4] - 1, z, 'oak_planks');
  for (let x = x2 + 2; x <= PW_IN.x2; x++) for (let z = 0; z <= 2; z++) b.set(x, yF - 1, z, 'polished_diorite');
  for (let x = x2 + 2; x <= PW_IN.x2; x++) b.set(x, yF, 1, 'red_carpet');
  for (let x = x1 + 4; x <= x2; x++) b.set(x, yF, 1, x >= 6 && x <= 13 ? 'air' : 'red_carpet');
}

function buildSingersHall(b) {
  const yF = ST[4];
  const x1 = PE_IN.x1;
  const x2 = PE_IN.x2;
  // Parkett im Fischgrätmuster
  floorPattern(b, { x: x1, y: yF - 1, z: 4, facing: 'south', width: x2 - x1 + 1, depth: PE_IN.z2 - 3, pattern: 'herringbone', blocks: ['stripped_oak_log', 'stripped_spruce_log'] });
  // Arkade zum Flur (Nordseite des Saals)
  for (let x = x1; x <= x2; x++) {
    const col = (x - x1) % 3 === 0;
    for (let y = yF; y <= yF + 5; y++) b.set(x, y, 3, col || y >= yF + 4 ? 'smooth_quartz' : 'air');
    if (!col) {
      const left = (x - x1) % 3 === 1;
      b.stairs(x, yF + 3, 3, 'smooth_quartz_stairs', { facing: left ? 'west' : 'east', half: 'top' });
    }
  }
  // Holzkassettendecke
  for (let x = x1; x <= x2; x++) {
    for (let z = 0; z <= PE_IN.z2; z++) {
      const beam = (x - x1) % 4 === 0 || z % 4 === 0;
      b.set(x, TOP, z, beam ? 'dark_oak_planks' : 'spruce_planks');
    }
  }
  for (let x = x1; x <= x2; x += 4) for (let z = 4; z <= PE_IN.z2; z++) b.set(x, TOP - 1, z, 'stripped_dark_oak_log[axis=z]');
  // Täfelung und Wandbilder (Innenseite der Südmauer)
  for (let x = x1; x <= x2; x++) {
    if (b.get(x, yF, 13) === WHITE.inner) b.set(x, yF, 13, 'dark_oak_planks');
    for (let y = yF + 1; y <= TOP - 1; y++) {
      if (b.get(x, y, 13) !== WHITE.inner) continue;
      b.set(x, y, 13, y === TOP - 1 ? 'orange_terracotta' : ['yellow_terracotta', 'light_blue_terracotta', 'green_terracotta'][(Math.floor((x - x1) / 3) + y) % 3]);
    }
  }
  decorateRoom(b, { x1, x2, z1: 4, z2: PE_IN.z2, F: yF, h: TOP - yF, color: 'orange_terracotta' });
  // Sängerlaube (Bühne) an der Ostseite
  for (let x = x2 - 4; x <= x2; x++) for (let z = 4; z <= PE_IN.z2; z++) b.set(x, yF, z, 'oak_planks');
  for (let z = 4; z <= PE_IN.z2; z++) b.stairs(x2 - 5, yF, z, 'oak_stairs', { facing: 'east' });
  for (const z of [4, 7, 10, 12]) for (let y = yF + 1; y <= TOP - 1; y++) b.set(x2 - 5, y, z, 'smooth_quartz');
  for (const z of [5, 6, 8, 9, 11]) {
    b.set(x2 - 5, TOP - 1, z, 'smooth_quartz');
    b.stairs(x2 - 5, TOP - 2, z, 'smooth_quartz_stairs', { facing: [5, 8, 11].includes(z) ? 'north' : 'south', half: 'top' });
  }
  for (let x = x2 - 3; x <= x2; x++) for (let z = 5; z <= 11; z += 3) b.set(x, yF + 1, z, 'green_carpet');
  b.set(x2 - 1, yF + 1, 8, 'note_block');
  // Leuchter
  for (const x of [31, 37, 43]) {
    for (let y = yF + 3; y < TOP - 1; y++) b.set(x, y, 8, 'iron_chain');
    b.set(x, yF + 2, 8, 'dark_oak_fence');
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      b.set(x + dx, yF + 2, 8 + dz, 'dark_oak_fence');
      b.set(x + dx, yF + 3, 8 + dz, 'candle[candles=3,lit=true]');
    }
    b.set(x, yF + 1, 8, 'lantern[hanging=true]');
  }
  // Bänke
  for (const x of [30, 34, 38, 42]) for (let z = 6; z <= 10; z++) if (z !== 8) b.stairs(x, yF, z, 'dark_oak_stairs', { facing: 'west' });
}

// Wandfassung eines Raums: Holztäfelung unten und als Fries oben, dazwischen farbige Wandbespannung.
// Ersetzt nur glatte Wandflächen (Fenster, Türen und Möbel bleiben).
function decorateRoom(b, { x1, x2, z1, z2, F, h, color, panel = 'dark_oak_planks' }) {
  for (let y = F; y < F + h; y++) {
    const state = y <= F + 1 || y === F + h - 1 ? panel : color;
    for (let x = x1 - 1; x <= x2 + 1; x++) {
      for (let z = z1 - 1; z <= z2 + 1; z++) {
        if (x >= x1 && x <= x2 && z >= z1 && z <= z2) continue;
        if (b.get(x, y, z) === WHITE.inner) b.set(x, y, z, state);
      }
    }
  }
}

function buildKingsRooms(b) {
  const yF = ST[3];
  const rooms = [
    { x1: 26, x2: 32, z1: 4, z2: 12, color: 'pink_terracotta' }, // Ankleidezimmer
    { x1: 34, x2: 39, z1: 4, z2: 12, color: 'yellow_terracotta' }, // Speisezimmer
    { x1: 41, x2: 46, z1: 4, z2: 12, color: 'light_blue_terracotta' }, // Schlafzimmer
    { x1: 48, x2: 53, z1: 4, z2: 12, color: 'cyan_terracotta' }, // Wohnzimmer
    { x1: 34, x2: 39, z1: -8, z2: -2, color: 'green_terracotta' }, // Arbeitszimmer
    { x1: 48, x2: 53, z1: -8, z2: -2, color: 'yellow_terracotta', panel: 'stripped_dark_oak_wood' }, // Kapelle
  ];
  for (const room of rooms) decorateRoom(b, { ...room, F: yF, h: 5 });
  // Schlafzimmer (Süd, x 41 … 46): Himmelbett aus Eiche
  b.bed(42, yF, 6, 'blue_bed', { facing: 'north' });
  b.bed(43, yF, 6, 'blue_bed', { facing: 'north' });
  for (const [x, z] of [[41, 4], [44, 4], [41, 7], [44, 7]]) for (let y = yF; y <= yF + 2; y++) b.set(x, y, z, 'dark_oak_fence');
  for (let x = 41; x <= 44; x++) for (let z = 4; z <= 7; z++) b.set(x, yF + 3, z, 'dark_oak_slab[type=bottom]');
  for (let x = 41; x <= 44; x++) b.stairs(x, yF + 3, 8, 'dark_oak_stairs', { facing: 'north', half: 'top' });
  b.set(42, yF + 4, 5, 'dark_oak_fence');
  b.set(43, yF + 4, 5, 'dark_oak_fence');
  for (let x = 41; x <= 46; x++) for (let z = 9; z <= 11; z++) b.set(x, yF, z, 'blue_carpet');
  b.set(46, yF, 5, 'water_cauldron[level=3]');
  b.set(45, yF, 4, 'chest[facing=south]');
  b.set(46, yF, 12, 'lectern[facing=north]');
  // Wohnzimmer (Süd, x 48 … 53): Sitzgruppe, Schwanenecke
  for (let x = 49; x <= 52; x++) b.stairs(x, yF, 5, 'dark_oak_stairs', { facing: 'north' });
  b.stairs(48, yF, 6, 'dark_oak_stairs', { facing: 'west' });
  b.stairs(53, yF, 6, 'dark_oak_stairs', { facing: 'east' });
  for (let x = 49; x <= 52; x++) b.set(x, yF, 7, 'dark_oak_slab[type=top]');
  b.set(50, yF + 1, 7, 'candle[candles=2,lit=true]');
  b.set(51, yF + 1, 7, 'potted_white_tulip');
  for (let x = 48; x <= 53; x++) for (let z = 9; z <= 12; z++) b.set(x, yF, z, 'light_blue_carpet');
  b.set(53, yF, 12, 'white_banner[rotation=6]');
  bookWall(b, { x: 48, y: yF, z: 4, facing: 'south', width: 2, height: 3, wood: 'schwarzeiche' });
  // Speisezimmer (Süd, x 34 … 39)
  diningTable(b, { x: 35, y: yF, z: 7, facing: 'south', length: 4, width: 2, wood: 'schwarzeiche', top: 'carpet', cloth: 'weiss' });
  for (let x = 34; x <= 39; x++) b.set(x, yF + 3, 4, 'yellow_terracotta');
  // Ankleidezimmer (Süd, x 27 … 32)
  storage(b, { x: 27, y: yF, z: 4, facing: 'south', width: 5, height: 2 });
  b.set(31, yF, 10, 'decorated_pot[facing=north]');
  // Arbeitszimmer (Nord, x 34 … 39)
  bookWall(b, { x: 34, y: yF, z: -8, facing: 'south', width: 6, height: 4, wood: 'schwarzeiche', ladder: true });
  b.set(36, yF, -5, 'lectern[facing=south,has_book=true]');
  b.stairs(36, yF, -4, 'dark_oak_stairs', { facing: 'south' });
  b.set(38, yF, -5, 'dark_oak_slab[type=top]');
  b.set(38, yF + 1, -5, 'candle[candles=1,lit=true]');
  // Grotte (Nord, x 41 … 46) mit Durchgang zum Wintergarten
  for (let x = 41; x <= 46; x++) {
    for (let z = -8; z <= -2; z++) {
      for (let y = yF; y <= yF + 4; y++) {
        const edge = x === 41 || x === 46 || z === -2 || y === yF + 4;
        const path = z <= -3 && z >= -8 && x >= 42 && x <= 45;
        if (edge && rnd(x, y, z, 71) < 0.7 && !(z === -2 && x === 43 && y <= yF + 1)) b.set(x, y, z, rnd(x, y, z, 72) < 0.5 ? 'dripstone_block' : 'calcite');
        else if (!edge && path) b.set(x, y, z, 'air');
      }
    }
  }
  for (const [x, z] of [[42, -3], [45, -4], [44, -6], [42, -6]]) b.set(x, yF + 3, z, 'pointed_dripstone[vertical_direction=down,thickness=tip]');
  for (const [x, z] of [[45, -3], [42, -5]]) b.set(x, yF, z, 'pointed_dripstone[vertical_direction=up,thickness=tip]');
  b.set(44, yF - 1, -4, 'water');
  b.set(43, yF - 1, -4, 'water');
  b.set(44, yF - 1, -3, 'water');
  for (const [x, z] of [[42, -4], [45, -5], [43, -7]]) b.set(x, yF, z, 'moss_carpet');
  b.set(43, yF + 3, -5, 'shroomlight');
  b.set(45, yF + 3, -7, 'sea_lantern');
  b.set(42, yF + 2, -7, 'spore_blossom');
  // Hauskapelle (Nord, x 48 … 53)
  for (let x = 49; x <= 52; x++) b.set(x, yF, -7, 'chiseled_quartz_block');
  b.set(50, yF + 1, -7, 'candle[candles=4,lit=true]');
  b.set(51, yF + 1, -7, 'white_candle[candles=4,lit=true]');
  for (let x = 49; x <= 52; x++) b.set(x, yF + 3, -8, 'gold_block');
  for (const z of [-5, -3]) for (let x = 49; x <= 52; x++) b.stairs(x, yF, z, 'dark_oak_stairs', { facing: 'north' });
}

function lightPalas(b) {
  ST.forEach((F, s) => {
    const h = s === 3 ? 5 : s === 4 ? 6 : 4;
    lightRoom(b, { x1: PE_IN.x1, y1: F, z1: PE_IN.z1, x2: PE_IN.x2, y2: F + h - 1, z2: PE_IN.z2 });
    if (s <= 2) lightRoom(b, { x1: PW_IN.x1, y1: F, z1: PW_IN.z1, x2: PW_IN.x2, y2: F + h - 1, z2: PW_IN.z2 });
  });
  lightRoom(b, { x1: PW_IN.x1, y1: ST[3], z1: PW_IN.z1, x2: PW_IN.x2, y2: TOP - 1, z2: PW_IN.z2 });
  lightRoom(b, { x1: NT.cx - 2, y1: 0, z1: NT.cz - 2, x2: NT.cx + 2, y2: 27, z2: NT.cz + 2 }, { mode: 'floor' });
}

// ------------------------------------------------------------------ Hofbauten

function simpleHouse(b, rect, { P = WHITE, storeys, top, sides, roof, skip = {}, windowsFor, corners = {}, courses = [] }) {
  for (const side of sides) {
    onSide(b, rect, side, (f) => {
      const bays = bayCenters(f.len, 6, skip[side] ?? []);
      facade(b, f, {
        P, storeys, top, socleTop: storeys[0] - 1, courses,
        windows: (s, F) => bays.flatMap((c) => windowsFor(s, F, c, side)),
        corners: corners[side] ?? [true, true],
        crown: roof ? 'cornice' : 'battlement', frieze: Boolean(roof),
      });
    });
  }
  const inner = { x1: rect.x1 + 2, x2: rect.x2 - 2, z1: rect.z1 + 2, z2: rect.z2 - 2 };
  storeys.forEach((F, s) => {
    for (let x = inner.x1; x <= inner.x2; x++) for (let z = inner.z1; z <= inner.z2; z++) b.set(x, F - 1, z, s === 0 ? 'polished_andesite' : 'spruce_planks');
  });
  for (let x = inner.x1; x <= inner.x2; x++) for (let z = inner.z1; z <= inner.z2; z++) b.set(x, top, z, roof ? 'spruce_planks' : 'stone_bricks');
  if (roof) gableRoof(b, { ...rect, y: top + 1, axis: roof.axis ?? 'x', overhang: 1, ends: roof.ends ?? [1, 1], gables: roof.gables, wall: P.wall });
}

// Gerade Treppe zwischen zwei Geschossen (Weltkoordinaten): Stufe k bei (x, z) + k · dir auf Ebene F + k,
// darunter gemauert; über jeder Stufe bleiben drei Blöcke frei (Aussparung im Boden darüber).
function flight(b, { x, z, F, h, dir, stairs = 'spruce_stairs', support = 'spruce_planks' }) {
  const [dx, dz] = DIRS[dir];
  for (let k = 0; k < h; k++) {
    const px = x + dx * k;
    const pz = z + dz * k;
    for (let y = F; y < F + k; y++) b.set(px, y, pz, support);
    b.stairs(px, F + k, pz, stairs, { facing: dir });
    for (let y = F + k + 1; y <= F + k + 3; y++) b.set(px, y, pz, 'air'); // drei Blöcke Kopfhöhe über jeder Stufe
  }
}

// Treppenhaus mit Wendepodest: Läufe abwechselnd in zwei Reihen (z und z + Versatz nach side), hin und zurück.
function stairwell(b, { x, z, storeys, h = 5, dir = 'east', side }) {
  const [dx, dz] = DIRS[dir];
  const [rx, rz] = DIRS[side];
  storeys.forEach((F, i) => {
    const even = i % 2 === 0;
    flight(b, {
      x: even ? x : x + dx * h + rx, z: even ? z : z + dz * h + rz, F, h, dir: even ? dir : OPPOSITE[dir],
    });
  });
}

function stdWindows(s, F, c) {
  if (s === 0) return [{ c, type: 'single', h: 2 }];
  return [{ c, type: 'pair', h: 3 }];
}

function lightHouse(b, rect, storeys, top) {
  storeys.forEach((F, s) => {
    const y2 = (storeys[s + 1] ?? top + 1) - 2;
    if (y2 >= F + 1) lightRoom(b, { x1: rect.x1 + 2, y1: F, z1: rect.z1 + 2, x2: rect.x2 - 2, y2, z2: rect.z2 - 2 });
  });
}

function buildKemenate(b) {
  const storeys = [0, 5, 10];
  simpleHouse(b, KEM, {
    storeys, top: 14, sides: ['north', 'east', 'south'], courses: [9],
    roof: { axis: 'x', ends: [0, 1], gables: [false, true] }, windowsFor: stdWindows,
    corners: { north: [true, false], south: [false, true] },
  });
  for (let z = PE.z2 + 1; z <= KEM.z2; z++) for (let y = groundTop(KEM.x1, z); y <= 14; y++) b.set(KEM.x1, y, z, WHITE.wall(KEM.x1, y, z));
  // Durchgänge zum Palas und Tür zum Hof
  for (let z = 10; z <= 11; z++) opening(b, 54, 0, z, 2, 2, true);
  onSide(b, KEM, 'north', () => {
    for (let y = 0; y <= 2; y++) { b.set(8, y, 0, 'air'); b.set(8, y, -1, 'air'); }
    b.door(8, 0, -1, 'spruce_door', { facing: 'south' });
    b.set(8, 3, 0, WHITE.ornament);
  });
  turret(b, { cx: KEM.x2 - 2, cz: KEM.z1 - 2, r: 2, y1: -1, y2: 20, spireH: 12, windows: [{ y: 4, h: 2, dir: 'north' }, { y: 10, h: 2, dir: 'east' }, { y: 16, h: 2, dir: 'north' }] });
  stairwell(b, { x: 72, z: KEM.z2 - 2, storeys: [0, 5], dir: 'east', side: 'north' });
  for (const x of [62, 69]) roofDormer(b, { x, y: 17, z: KEM.z1 + 1, facing: 'north' });
  lightHouse(b, KEM, storeys, 14);
}

function buildRitterhaus(b) {
  const storeys = [0, 5, 10];
  simpleHouse(b, RIT, {
    storeys, top: 14, sides: ['south', 'north', 'west'], courses: [9],
    roof: { axis: 'x', ends: [1, 0], gables: [true, false] }, windowsFor: stdWindows,
    corners: { south: [true, false], north: [false, true] },
  });
  onSide(b, RIT, 'south', () => {
    for (let y = 0; y <= 2; y++) { b.set(9, y, 0, 'air'); b.set(9, y, -1, 'air'); }
    b.door(9, 0, -1, 'spruce_door', { facing: 'north' });
  });
  stairwell(b, { x: 70, z: RIT.z1 + 2, storeys: [0, 5], dir: 'east', side: 'south' });
  for (const x of [62, 74]) roofDormer(b, { x, y: 17, z: RIT.z2 - 1, facing: 'south' });
  lightHouse(b, RIT, storeys, 14);
}

function buildGallery(b) {
  // Galeriebau mit Blendarkaden zwischen Ritterhaus und Viereckturm
  simpleHouse(b, GAL, {
    storeys: [0, 5], top: 9, sides: ['south', 'north'], roof: null,
    windowsFor: () => [], corners: { south: [false, false], north: [false, false] },
  });
  onSide(b, GAL, 'south', () => {
    for (const c of [1, 4]) {
      for (let y = 1; y <= 6; y++) {
        b.set(c, y, 0, 'air');
        b.set(c + 1, y, 0, 'air');
      }
      b.stairs(c, 6, 0, WHITE.trimStairs, { facing: 'west', half: 'top' });
      b.stairs(c + 1, 6, 0, WHITE.trimStairs, { facing: 'east', half: 'top' });
      b.set(c, 7, 0, WHITE.trim);
      b.set(c + 1, 7, 0, WHITE.trim);
    }
  });
}

function buildViereckturm(b) {
  const t = VT;
  const P = WHITE;
  for (const side of ['north', 'east', 'south', 'west']) {
    onSide(b, t, side, (f) => {
      facade(b, f, {
        P, storeys: [LOWER, 0, 6, 12, 18, 24], top: t.top, socleTop: LOWER - 1, courses: [11, 23],
        windows: (s) => (s >= 2 ? [{ c: 3, type: 'pair', h: s === 5 ? 4 : 3, dy: 1 }] : s === 1 ? [{ c: 3, type: 'single', h: 2 }] : []),
      });
    });
  }
  for (const F of [0, 6, 12, 18, 24]) for (let x = t.x1 + 2; x <= t.x2 - 2; x++) for (let z = t.z1 + 2; z <= t.z2 - 2; z++) b.set(x, F - 1, z, 'spruce_planks');
  // Auskragende Aussichtsplattform mit Zinnen
  const y = t.top + 1;
  for (let x = t.x1 - 1; x <= t.x2 + 1; x++) {
    for (let z = t.z1 - 1; z <= t.z2 + 1; z++) {
      const edge = x === t.x1 - 1 || x === t.x2 + 1 || z === t.z1 - 1 || z === t.z2 + 1;
      b.set(x, y, z, edge ? 'quartz_bricks' : 'smooth_stone');
      if (edge) {
        b.set(x, y + 1, z, 'calcite');
        if ((x + z) % 2 === 0) {
          b.set(x, y + 2, z, 'calcite');
          b.slab(x, y + 3, z, 'smooth_quartz_slab');
        } else b.slab(x, y + 2, z, 'smooth_quartz_slab');
      }
    }
  }
  for (let x = t.x1 - 1; x <= t.x2 + 1; x++) {
    b.stairs(x, y - 1, t.z1 - 1, P.trimStairs, { facing: 'south', half: 'top' });
    b.stairs(x, y - 1, t.z2 + 1, P.trimStairs, { facing: 'north', half: 'top' });
  }
  for (let z = t.z1; z <= t.z2; z++) {
    b.stairs(t.x1 - 1, y - 1, z, P.trimStairs, { facing: 'east', half: 'top' });
    b.stairs(t.x2 + 1, y - 1, z, P.trimStairs, { facing: 'west', half: 'top' });
  }
  // Turmstube mit Pyramidendach und Treppentürmchen
  const core = { x1: t.x1 + 1, x2: t.x2 - 1, z1: t.z1 + 1, z2: t.z2 - 1 };
  for (let yy = y + 1; yy <= y + 4; yy++) {
    for (let x = core.x1; x <= core.x2; x++) {
      for (let z = core.z1; z <= core.z2; z++) {
        const edge = x === core.x1 || x === core.x2 || z === core.z1 || z === core.z2;
        const win = (yy === y + 2 || yy === y + 3) && (x === core.x1 + 2 || x === core.x1 + 3 || z === core.z1 + 2 || z === core.z1 + 3);
        if (edge) b.set(x, yy, z, win ? 'glass_pane' : WHITE.wall(x, yy, z));
      }
    }
  }
  b.roof({ x1: core.x1, z1: core.z1, x2: core.x2, z2: core.z2, y: y + 5, type: 'pyramid', stairs: ROOF.stairs, slab: ROOF.slab, full: ROOF.block, overhang: 1 });
  turret(b, { cx: t.x2, cz: t.z1, r: 1, y1: y + 1, y2: y + 11, spireH: 9, spireR: 2, windows: [{ y: y + 5, h: 2, dir: 'east' }] });
  onSide(b, t, 'south', () => {
    for (let k = 0; k <= 2; k++) {
      b.set(3, k, 0, 'air');
      b.set(3, k, -1, 'air');
    }
    b.door(3, 0, -1, 'spruce_door', { facing: 'north' });
    b.set(3, 3, 0, WHITE.ornament);
  });
  for (let yy = LOWER; yy <= y; yy++) b.set(t.x2 - 2, yy, t.z2 - 2, 'ladder[facing=west]');
  lightRoom(b, { x1: t.x1 + 2, y1: 0, z1: t.z1 + 2, x2: t.x2 - 2, y2: 4, z2: t.z2 - 2 });
}

function buildCourtyards(b) {
  // Oberer Hof: ruhiges Pflaster mit markiertem Grundriss des nie gebauten Bergfrieds
  for (let x = 56; x <= 92; x++) {
    for (let z = -12; z <= 9; z++) {
      if (b.get(x, 0, z) !== 'air') continue;
      const r = rnd(x, 0, z, 61);
      b.set(x, -1, z, r < 0.7 ? 'stone_bricks' : r < 0.9 ? 'polished_andesite' : 'cracked_stone_bricks');
    }
  }
  for (let x = 64; x <= 77; x++) {
    for (let z = -9; z <= 4; z++) {
      const edge = x === 64 || x === 77 || z === -9 || z === 4;
      if (edge) b.set(x, -1, z, 'polished_diorite');
    }
  }
  // Brüstung an der Hofkante (Ost) und Freitreppe hinab zum unteren Hof
  for (let z = -13; z <= 9; z++) {
    for (let y = -7; y <= -1; y++) b.set(93, y, z, WHITE.socle(93, y, z));
    if (z >= -6 && z <= -2) continue;
    b.set(93, 0, z, 'stone_brick_wall');
  }
  for (let z = -6; z <= -2; z++) {
    for (let k = 1; k <= 4; k++) {
      b.stairs(93 + k, -1 - k, z, 'stone_brick_stairs', { facing: 'west' });
      for (let y = -7; y < -1 - k; y++) b.set(93 + k, y, z, 'stone_bricks');
    }
    b.set(93, -1, z, 'stone_bricks');
  }
  for (const z of [-7, -1]) {
    for (let k = 1; k <= 4; k++) {
      for (let y = -7; y <= -1 - k; y++) b.set(93 + k, y, z, 'stone_bricks');
      b.set(93 + k, -k, z, 'stone_brick_wall');
    }
  }
  // Hofmauer Süd (oberer Hof östlich der Kemenate)
  for (let x = 81; x <= 93; x++) {
    for (let y = Math.min(groundTop(x, 11), -1); y <= 0; y++) b.set(x, y, 10, WHITE.socle(x, y, 10));
    b.set(x, 1, 10, x % 4 === 1 ? 'stone_bricks' : 'stone_brick_wall');
    if (x % 4 === 1) b.set(x, 2, 10, 'lantern');
  }
  // Unterer Hof
  for (let x = 94; x <= 118; x++) {
    for (let z = -12; z <= 13; z++) {
      if (b.get(x, -5, z) !== 'air') continue;
      const r = rnd(x, 0, z, 62);
      b.set(x, -6, z, r < 0.45 ? 'cobblestone' : r < 0.8 ? 'stone_bricks' : r < 0.93 ? 'andesite' : 'gravel');
    }
  }
  for (let x = 94; x <= 118; x++) {
    for (let y = Math.min(groundTop(x, 15), -6); y <= -5; y++) b.set(x, y, 14, WHITE.socle(x, y, 14));
    b.set(x, -4, 14, x % 4 === 2 ? 'stone_bricks' : 'stone_brick_wall');
    if (x % 4 === 2) b.set(x, -3, 14, 'lantern');
  }
}

function buildVerbindungsbau(b) {
  const storeys = [LOWER, 0];
  simpleHouse(b, VB, {
    storeys, top: 4, sides: ['south', 'north'],
    roof: { axis: 'x', ends: [0, 0], gables: [false, false] }, windowsFor: stdWindows,
    corners: { south: [false, false], north: [false, false] }, skip: { south: [9] },
  });
  // vorgelagerte Treppe zum Obergeschoss
  for (let k = 0; k < 5; k++) {
    for (const z of [-12, -11]) {
      b.stairs(100 + k, LOWER + k, z, 'stone_brick_stairs', { facing: 'east' });
      for (let y = LOWER - 1; y < LOWER + k; y++) b.set(100 + k, y, z, 'stone_bricks');
    }
    b.set(100 + k, LOWER + k + 1, -10, 'stone_brick_wall');
    for (let y = LOWER; y <= LOWER + k; y++) b.set(100 + k, y, -10, 'stone_bricks');
  }
  for (let x = 105; x <= 107; x++) {
    for (const z of [-12, -11, -10]) for (let y = LOWER - 1; y <= -1; y++) b.set(x, y, z, 'stone_bricks');
    b.set(x, 0, -10, 'stone_brick_wall');
  }
  b.set(107, 0, -11, 'stone_brick_wall');
  b.set(107, 0, -12, 'stone_brick_wall');
  b.set(105, 1, -10, 'lantern');
  for (let y = 0; y <= 2; y++) b.set(106, y, -13, 'air');
  b.door(106, 0, -14, 'spruce_door', { facing: 'north' });
  for (let y = LOWER; y <= LOWER + 2; y++) b.set(111, y, -13, 'air');
  b.door(111, LOWER, -14, 'spruce_door', { facing: 'north' });
  lightHouse(b, VB, storeys, 4);
}

// ------------------------------------------------------------------ Torbau

function buildTorbau(b) {
  const wing = (z1, z2) => ({ x1: TOR.x1, x2: TOR.x2, z1, z2 });
  const north = wing(TOR.z1, TOR_MID.z1 - 1);
  const south = wing(TOR_MID.z2 + 1, TOR.z2);
  const storeys = [LOWER, 0, 5];
  const wingWindows = (s, F, c) => (s === 0 ? [{ c, type: 'single', h: 2, dy: 2 }] : [{ c, type: 'single', h: 3 }]);
  for (const [rect, end] of [[north, 'north'], [south, 'south']]) {
    for (const side of ['east', end]) {
      onSide(b, rect, side, (f) => {
        const bays = bayCenters(f.len, 6);
        facade(b, f, {
          P: BRICK, storeys, top: 9, socleTop: LOWER - 1, courses: [-1],
          windows: (s, F) => bays.flatMap((c) => wingWindows(s, F, c)), crown: 'battlement',
        });
      });
    }
    onSide(b, rect, 'west', (f) => {
      const bays = bayCenters(f.len, 6);
      facade(b, f, {
        P: SAND, storeys, top: 9, socleTop: LOWER - 1, courses: [-1],
        windows: (s, F) => bays.flatMap((c) => stdWindows(s, F, c)), crown: 'battlement',
      });
    });
    const zIn = end === 'north' ? rect.z2 : rect.z1; // Wand zum Torturm
    for (let x = rect.x1 + 1; x <= rect.x2 - 1; x++) {
      for (let y = LOWER - 1; y <= 9; y++) b.set(x, y, zIn, SAND.wall(x, y, zIn));
      for (let z = rect.z1 + 2; z <= rect.z2 - 1; z++) {
        if (z === zIn) continue;
        b.set(x, LOWER - 1, z, 'polished_andesite');
        b.set(x, -1, z, 'spruce_planks');
        b.set(x, 4, z, 'spruce_planks');
        b.set(x, 9, z, 'stone_bricks');
      }
    }
    const zStair = end === 'north' ? rect.z1 + 2 : rect.z2 - 2;
    stairwell(b, { x: 122, z: zStair, storeys: [LOWER, 0, 5], dir: 'east', side: end === 'north' ? 'south' : 'north' });
    for (const F of [0, 5]) opening(b, 128, F, zIn);
    lightHouse(b, rect, storeys, 9);
  }
  // Türen vom unteren Hof in die Flügel
  for (const z of [-11, 12]) {
    for (let y = LOWER; y <= LOWER + 2; y++) for (const x of [119, 120]) b.set(x, y, z, 'air');
    b.door(120, LOWER, z, 'spruce_door', { facing: 'east' });
  }
  // Torturm (Mitte) mit Staffelgiebeln
  const mid = TOR_MID;
  for (const side of ['east', 'west']) {
    onSide(b, mid, side, (f) => {
      facade(b, f, {
        P: side === 'east' ? BRICK : SAND, storeys: [LOWER, 0, 5, 10], top: 14, socleTop: LOWER - 1, courses: [-1, 9],
        windows: (s) => (s === 0 ? [] : s === 3 ? [{ c: 7, type: 'pair', h: 3 }] : [{ c: 3, type: 'single', h: 3 }, { c: 7, type: 'single', h: 3 }, { c: 11, type: 'single', h: 3 }]),
      });
    });
  }
  for (const z of [mid.z1, mid.z2]) for (let x = mid.x1; x <= mid.x2; x++) for (let y = 10; y <= 14; y++) b.set(x, y, z, BRICK.wall(x, y, z));
  for (let x = mid.x1 + 2; x <= mid.x2 - 2; x++) {
    for (let z = mid.z1; z <= mid.z2; z++) {
      b.set(x, -1, z, 'spruce_planks');
      b.set(x, 4, z, 'spruce_planks');
      b.set(x, 9, z, 'spruce_planks');
      b.set(x, 14, z, 'spruce_planks');
    }
  }
  gableRoof(b, {
    x1: mid.x1, x2: mid.x2, z1: mid.z1, z2: mid.z2, y: 15, axis: 'x', overhang: 1, ends: [0, 0],
    wall: BRICK.wall, stepped: true, cap: 'smooth_sandstone_slab',
  });
  onSide(b, mid, 'east', () => {
    windowGroup(b, BRICK, 7, 17, 3, 'pair');
    b.set(7, 22, 0, 'chiseled_sandstone');
  });
  // Tordurchfahrt mit Wappen darüber
  arch(b, { x: mid.x2, y: LOWER, z: 0, facing: 'east', width: 5, height: 5, block: 'smooth_sandstone', stairs: 'smooth_sandstone_stairs', depth: mid.x2 - mid.x1 + 1, pillars: true });
  for (let x = mid.x1; x <= mid.x2; x++) for (let z = -2; z <= 2; z++) b.set(x, LOWER - 1, z, rnd(x, 0, z, 71) < 0.5 ? 'cobblestone' : 'stone_bricks');
  for (let z = -3; z <= 3; z++) b.set(mid.x2 + 1, 1, z, z === 0 ? 'chiseled_sandstone' : 'smooth_sandstone');
  b.set(mid.x2 + 2, 0, -1, 'light_blue_wall_banner[facing=east]');
  b.set(mid.x2 + 2, 0, 1, 'white_wall_banner[facing=east]');
  lightRoom(b, { x1: mid.x1 + 2, y1: 0, z1: mid.z1 + 1, x2: mid.x2 - 2, y2: 3, z2: mid.z2 - 1 });
  // Flankentürme an der Außenseite
  for (const cz of [mid.z1 - 1, mid.z2 + 1]) {
    const cx = TOR.x2 + 1;
    socleRing(b, { cx, cz, r: 2, yTop: LOWER - 2 });
    roundShaft(b, { cx, cz, r: 2, y1: LOWER - 2, y2: 18, mat: (x, y, z) => (y < LOWER ? WHITE.socle(x, y, z) : BRICK.wall(x, y, z)) });
    for (const y of [-2, 3, 8, 13]) towerWindow(b, { cx, cz, r: 2, y, h: 2, dir: 'east', P: BRICK });
    roundBand(b, { cx, cz, r: 2, y: 18, stairs: BRICK.trimStairs });
    roundBand(b, { cx, cz, r: 2, y: 9, stairs: BRICK.trimStairs });
    for (const [dx, dz] of ringAround(2)) {
      b.set(cx + dx, 19, cz + dz, BRICK.wall(cx + dx, 19, cz + dz));
      if ((dx + dz) % 2 === 0) b.slab(cx + dx, 20, cz + dz, BRICK.trimSlab);
    }
    spire(b, { cx, cz, y: 19, r: 2, h: 11 });
  }
}

// ------------------------------------------------------------------ Zufahrt und Wald

function buildApproach(b) {
  for (let x = 132; x <= 146; x++) {
    for (let z = -6; z <= 6; z++) {
      if (b.get(x, -6, z) !== 'air') continue;
      const r = rnd(x, 0, z, 81);
      b.set(x, -7, z, r < 0.5 ? 'gravel' : r < 0.8 ? 'cobblestone' : 'stone_bricks');
    }
  }
  for (let x = 136; x <= 146; x++) {
    for (const z of [-7, 7]) {
      b.set(x, -7, z, 'stone_bricks');
      b.set(x, -6, z, x % 5 === 1 ? 'stone_bricks' : 'stone_brick_wall');
      if (x % 5 === 1) b.set(x, -5, z, 'lantern');
    }
  }
}

function buildForest(b) {
  const { x0, z0, W, D } = G;
  const species = ['fichte', 'fichte', 'fichte', 'fichte', 'fichte', 'birke', 'eiche'];
  for (let gz = z0 + 3; gz < z0 + D - 3; gz += 8) {
    for (let gx = x0 + 3; gx < x0 + W - 3; gx += 8) {
      const x = gx + Math.floor(rnd(gx, 0, gz, 91) * 5);
      const z = gz + Math.floor(rnd(gx, 1, gz, 92) * 5);
      const h = G.top(x, z);
      if (h === null || G.distance(x, z) < 4 || roadInfo(x, z).dist < 6) continue;
      let low = h;
      let ok = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = G.top(x + dx, z + dz);
        if (n === null) ok = false;
        else low = Math.min(low, n);
      }
      if (!ok || h - low >= 2) continue;
      const kind = species[Math.floor(rnd(x, 2, z, 93) * species.length)];
      const size = kind === 'fichte' ? (rnd(x, 3, z, 94) < 0.45 ? 'gross' : 'mittel') : 'mittel';
      const ext = { fichte: { gross: 5, mittel: 4 }, birke: { mittel: 3 }, eiche: { mittel: 5 } }[kind][size];
      if (!insideArea(x - ext - 1, z) || !insideArea(x + ext + 1, z) || !insideArea(x, z - ext - 1) || !insideArea(x, z + ext + 1)) continue;
      tree(b, { x, y: h + 1, z, species: kind, size, seed: `${x},${z}` });
    }
  }
  // Büsche auf Felsabsätzen nahe der Mauern
  for (let gz = z0 + 2; gz < z0 + D - 2; gz += 5) {
    for (let gx = x0 + 2; gx < x0 + W - 2; gx += 5) {
      const x = gx + Math.floor(rnd(gx, 4, gz, 95) * 3);
      const z = gz + Math.floor(rnd(gx, 5, gz, 96) * 3);
      const h = G.top(x, z);
      const d = G.distance(x, z);
      if (h === null || d < 2 || d > 9 || rnd(x, 6, z, 97) < 0.45 || roadInfo(x, z).dist < 5) continue;
      if (b.get(x, h + 1, z) !== 'air') continue;
      bush(b, { x, y: h + 1, z, size: 'klein', leaves: rnd(x, 7, z, 98) < 0.5 ? 'fichte' : 'azalee', seed: `${x}/${z}` });
    }
  }
  vegetation(b, { x: x0, y: -3, z: z0, width: W, depth: D, mix: 'farn', density: 0.22, shape: 'eckig', scan: 40, seed: 'neuschwanstein' });
  vegetation(b, { x: x0, y: -3, z: z0, width: W, depth: D, mix: 'wiese', density: 0.12, shape: 'eckig', scan: 40, seed: 'neuschwanstein-2' });
}

// ------------------------------------------------------------------ Bau

export default function build(b) {
  b.phase('Felsgrat und Gelände');
  buildTerrain(b);

  b.phase('Palas: Mauern und Geschosse');
  buildPalasWalls(b);
  buildPalasFloors(b);

  b.phase('Palas: Söller und Wintergarten');
  buildSoller(b);
  buildWinterGarden(b);

  b.phase('Nordturm und Treppentürme');
  buildNorthTower(b);
  buildStairTowers(b);

  b.phase('Palas: Dächer und Ecktürmchen');
  buildPalasRoofs(b);
  buildPalasTurrets(b);

  b.phase('Palas: Zimmer und Diensträume');
  for (let s = 0; s < ST.length; s++) palasRooms(b, s);
  furnishLowerFloors(b);

  b.phase('Thronsaal');
  buildThroneHall(b);

  b.phase('Königswohnung und Grotte');
  buildKingsRooms(b);

  b.phase('Sängersaal');
  buildSingersHall(b);
  lightPalas(b);

  b.phase('Kemenate');
  buildKemenate(b);

  b.phase('Ritterhaus, Galeriebau und Viereckturm');
  buildRitterhaus(b);
  buildGallery(b);
  buildViereckturm(b);

  b.phase('Höfe und Verbindungsbau');
  buildCourtyards(b);
  buildVerbindungsbau(b);

  b.phase('Torbau');
  buildTorbau(b);

  b.phase('Zufahrt und Bergwald');
  buildApproach(b);
  buildForest(b);
}
