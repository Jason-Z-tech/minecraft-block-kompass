// Burgstadt: Höhenburg auf einem Felsen über einer ummauerten Stadt.
// Burg (Norden, Felsplateau y 15): Kernburg mit Bergfried, Palas, Torhaus mit Zugbrücke über den Halsgraben,
// Ecktürmen, Wirtschaftshaus, Ziehbrunnen und Linde; ringsum der Burg-Zwinger mit zweiter Mauer an der Felskante.
// Stadt (Süden): Oberstadt (y 6) mit Marktplatz (Marktbrunnen, Stände, Linden), Backsteinkirche mit Westturm und
// Kupferhelm, Rathaus mit Laube und Eckerkern, Burgstiege hinauf zum Felsen;
// Stützmauer mit Treppe zur Unterstadt (y 2) mit Haupt- und Quergasse, Fachwerkhäusern und Gärten.
// Doppelte Stadtmauer: hohe innere Mauer mit Rundtürmen, davor der Zwinger und die niedrige Zwingermauer,
// Haupttor mit Vortor, Steinbrücke und Zugbrücke über den Wassergraben.
// Koordinaten: x → Osten, z → Süden; Höhe = Oberkante des Bodens (Wiese 0, Zwinger 1, Unterstadt 2, Oberstadt 6, Fels 15).

import { hashPosition } from '../../core/random.js';
import {
  COLOR, arch, window, doorway, chimney, lightRoom, findDarkSpots, tree, bush, vegetation, flowerBed, rock, lampPost, wallLantern, hangingLantern,
  bedroom, kitchen, diningTable, storage, workshop, bookWall, fireplace, isPlantId,
} from '../lib/index.js';

export const meta = {
  id: 'burgstadt',
  title: 'Burgstadt',
  category: 'mittelalter',
  subtitle: 'Höhenburg über einer Stadt mit doppelter Mauer, Markt, Kirche und Fachwerkhäusern',
  tags: [
    'Burg', 'Stadt', 'Mittelalter', 'Höhenburg', 'Bergfried', 'Palas', 'Torhaus', 'Zugbrücke', 'Stadtmauer', 'Zwinger',
    'Wassergraben', 'Fachwerk', 'Marktplatz', 'Brunnen', 'Kirche', 'Backsteingotik', 'Rathaus', 'Innenräume', 'Riesenprojekt',
  ],
  aliases: [
    'burgstadt', 'burg stadt', 'burgstat', 'burgstaat', 'mittelalterliche stadt', 'mittelalter stadt', 'medieval town',
    'medieval city', 'castle town', 'castle city', 'walled town', 'walled city', 'stadt mit burg', 'burg mit stadt',
    'höhenburg', 'hoehenburg', 'festungsstadt', 'altstadt', 'fachwerkstadt', 'ritterstadt', 'königsstadt', 'castle village',
  ],
  accuracy: 'eigenes',
  description: 'Eine Höhenburg auf ihrem Felsen und darunter eine ganze Stadt: Die Kernburg mit rundem Bergfried, '
    + 'Palas mit Rittersaal, Ecktürmen und einem Torhaus mit Zugbrücke über den Halsgraben, ringsum der Burg-Zwinger. '
    + 'Unter dem Felsen liegt die Stadt hinter einer doppelten Mauer mit Rundtürmen, Zwinger, Vortor und Zugbrücke über '
    + 'den Wassergraben. In der Oberstadt liegt der Marktplatz mit Brunnen, Marktständen und Linden, daneben eine '
    + 'Backsteinkirche mit Westturm, Kupferhelm und bunten Glasfenstern und ein Rathaus mit steinerner Laube, Fachwerk '
    + 'und Eckerkern. In der Unterstadt stehen Gassen voller Fachwerkhäuser mit Innenräumen und Gärten an der Mauer. '
    + 'Die Burgstiege führt vom Markt hinauf zur Burg.',
  sources: [],
  credits: null,
  tested: null,
};

// ------------------------------------------------------------------ Maße

const X0 = -72;
const X1 = 72;
const Z0 = -84;
const Z1 = 68;
const BASE = -4; // Unterkante am Rand des Geländes
const MEADOW = 0;
const ZWINGER = 1;
const UNTER = 2;
const OBER = 6;
const ROCK = 15;
const STEP_Z = 8; // ab z = 8 Unterstadt
const CLIFF_Z = -21; // Felskante über der Oberstadt (Fels bis z = −21)
const MOAT_BED = -3;

const DIAG = [false, true, false, true, false, true, false, true]; // Kanten: W, SW, S, SE, E, NE, N, NW
const EDGE = { W: 0, SW: 1, S: 2, SE: 3, E: 4, NE: 5, N: 6, NW: 7 };

// Achteck aus Halbebenen d = nx·x + nz·z − c (Normale nach außen, Länge 1): x1 … x2 × z1 … z2, Ecken abgeschrägt.
function octagon(x1, x2, z1, z2, { sw, se, ne, nw }) {
  const s = Math.SQRT1_2;
  return {
    x1, x2, z1, z2,
    edges: [
      [-1, 0, -x1],
      [-s, s, (-x1 + z2 - sw) * s],
      [0, 1, z2],
      [s, s, (x2 + z2 - se) * s],
      [1, 0, x2],
      [s, -s, (x2 - z1 - ne) * s],
      [0, -1, -z1],
      [-s, -s, (-x1 - z1 - nw) * s],
    ],
  };
}

// Vorzeichenbehafteter Abstand zum Achteck (negativ = innen) und die Kante, die ihn bestimmt.
function sdf(poly, x, z) {
  let d = -Infinity;
  let edge = -1;
  poly.edges.forEach(([nx, nz, c], i) => {
    const v = nx * x + nz * z - c;
    if (v > d) {
      d = v;
      edge = i;
    }
  });
  return { d, edge };
}

const TOWN = octagon(-48, 48, -30, 40, { sw: 12, se: 12, ne: 8, nw: 8 });
const KERN = octagon(-32, 32, -62, -32, { sw: 6, se: 6, ne: 6, nw: 6 });
const ZWB = octagon(-40, 40, -70, -23, { sw: 9, se: 9, ne: 9, nw: 9 }); // Burg-Zwinger (Mauer an der Felskante)

const TOWN_WALK = 14; // Wehrgang der inneren Stadtmauer
const OUTER_WALK = 7; // Wehrgang der Zwingermauer
const KERN_WALK = 24; // Wehrgang der Kernburg
const ZWB_WALK = 21; // Wehrgang der Burg-Zwingermauer

// ------------------------------------------------------------------ Zufall und Material (ortsfest)

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;

function noise2(x, z, scale, salt) {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const v = (i, k) => rand01(x0 + i, 0, z0 + k, salt);
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * sx;
  const c = v(0, 1) + (v(1, 1) - v(0, 1)) * sx;
  return a + (c - a) * sz;
}

function weighted(entries, r) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let t = r * total;
  for (const [id, w] of entries) {
    if (t < w) return id;
    t -= w;
  }
  return entries[entries.length - 1][0];
}

const mix = (entries, x, y, z, salt) => weighted(entries, rand01(x, y, z, salt));
// Flecken statt Salz-und-Pfeffer: Rauschen wählt, etwas Zufall franst die Ränder aus.
const patch = (entries, x, y, z, salt, scale = 3) => weighted(entries, Math.min(0.999, Math.max(0, noise2(x + y * 7, z - y * 5, scale, salt) * 0.8 + rand01(x, y, z, salt + 1) * 0.2)));

const WALL_LOW = [['cobblestone', 4], ['mossy_cobblestone', 4], ['mossy_stone_bricks', 4], ['stone_bricks', 4], ['andesite', 1], ['tuff', 1]];
const WALL_MID = [['stone_bricks', 12], ['cracked_stone_bricks', 3], ['mossy_stone_bricks', 2], ['andesite', 2], ['cobblestone', 1], ['tuff_bricks', 1]];
const WALL_TOP = [['stone_bricks', 12], ['cracked_stone_bricks', 2], ['polished_andesite', 1], ['stone_bricks', 2]];
const ROCK_STONE = [['stone', 8], ['andesite', 4], ['cobblestone', 2], ['tuff', 2], ['mossy_cobblestone', 2], ['gravel', 1], ['stone', 2]];

// Mauerstein mit Verlauf: unten bemoost und grob, oben sauberer.
function wallStone(x, y, z, foot) {
  const h = y - foot;
  if (h <= 2) return patch(WALL_LOW, x, y, z, 31, 2.5);
  if (h >= 9) return patch(WALL_TOP, x, y, z, 33, 3);
  return patch(WALL_MID, x, y, z, 32, 3);
}

// ------------------------------------------------------------------ Gelände

const GW = X1 - X0 + 1;
const GD = Z1 - Z0 + 1;
const KIND = { MEADOW: 0, ZWINGER: 1, TOWN: 2, WALL: 3, MOAT: 4, ROCK: 5 };

function rockHeight(x, z, town) {
  if (z > CLIFF_Z && town < -1.5) return -99; // Stadt südlich der Felskante
  const d = sdf(ZWB, x, z).d;
  if (d <= 2.5) return ROCK;
  const e = d - 2.5;
  const n = noise2(x, z, 5, 11) - 0.5;
  const crag = noise2(x, z, 2.2, 12) - 0.5;
  return Math.round(ROCK - 2.6 * Math.min(e, 4) - 1.0 * Math.max(e - 4, 0) + n * 3.5 + crag * 1.5);
}

function computeGround() {
  const top = new Int16Array(GW * GD);
  const kind = new Uint8Array(GW * GD);
  for (let z = Z0; z <= Z1; z++) {
    for (let x = X0; x <= X1; x++) {
      const t = sdf(TOWN, x, z).d;
      let h;
      let k;
      if (t < -1.5) [h, k] = [z >= STEP_Z ? UNTER : OBER, KIND.TOWN];
      else if (t <= 1.5) [h, k] = [ZWINGER, KIND.WALL];
      else if (t < 6.5) [h, k] = [ZWINGER, KIND.ZWINGER];
      else if (t < 10) [h, k] = [MEADOW, KIND.MEADOW];
      else if (t < 15.5) [h, k] = [MOAT_BED, KIND.MOAT];
      else [h, k] = [t > 20 ? Math.max(0, Math.round((noise2(x, z, 13, 7) - 0.55) * 5)) : MEADOW, KIND.MEADOW];
      const r = rockHeight(x, z, t);
      if (k === KIND.MOAT && r > MOAT_BED) [h, k] = [Math.max(r, MEADOW), KIND.ROCK];
      else if (r > h) [h, k] = [r, KIND.ROCK];
      const i = (z - Z0) * GW + (x - X0);
      top[i] = h;
      kind[i] = k;
    }
  }
  return { top, kind };
}

const GROUND = computeGround();
const inArea = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
const groundAt = (x, z) => (inArea(x, z) ? GROUND.top[(z - Z0) * GW + (x - X0)] : -99);
const kindAt = (x, z) => (inArea(x, z) ? GROUND.kind[(z - Z0) * GW + (x - X0)] : -1);

function terrainState(kind, x, y, z, depth, steep) {
  if (kind === KIND.ROCK) {
    if (steep >= 2 || depth > 2) return patch(ROCK_STONE, x, y, z, 41, 2.5);
    if (depth === 0) {
      if (y < ROCK && y > MEADOW + 1 && steep >= 1 && noise2(x + y, z, 3.5, 47) > 0.4) return patch([...ROCK_STONE, ['moss_block', 3]], x, y, z, 48, 2);
      return patch([['grass_block', 10], ['coarse_dirt', 2], ['moss_block', 1], ['podzol', 1]], x, y, z, 42, 3);
    }
    return steep >= 1 ? patch(ROCK_STONE, x, y, z, 41, 2.5) : 'dirt';
  }
  if (kind === KIND.MOAT) return depth === 0 ? patch([['gravel', 4], ['clay', 2], ['sand', 2], ['mud', 1]], x, y, z, 43, 2) : 'dirt';
  if (depth === 0) {
    if (steep >= 2) return patch(ROCK_STONE, x, y, z, 41, 2.5);
    if (kind === KIND.ZWINGER) return patch([['grass_block', 8], ['coarse_dirt', 2], ['gravel', 1]], x, y, z, 44, 2.5);
    return patch([['grass_block', 14], ['coarse_dirt', 1], ['podzol', 1]], x, y, z, 45, 4);
  }
  if (depth <= 2) return steep >= 3 ? patch(ROCK_STONE, x, y, z, 41, 2.5) : 'dirt';
  return patch([['stone', 6], ['andesite', 2], ['tuff', 1], ['gravel', 1]], x, y, z, 46, 3);
}

function terrain(b) {
  b.phase('Gelände, Burgfelsen und Wassergraben');
  for (let z = Z0; z <= Z1; z++) {
    for (let x = X0; x <= X1; x++) {
      const t = groundAt(x, z);
      const k = kindAt(x, z);
      let low = Infinity;
      let steep = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = groundAt(x + dx, z + dz);
        low = Math.min(low, n);
        steep = Math.max(steep, t - n);
      }
      const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
      const bottom = edge ? BASE : Math.min(t - 1, low + 1);
      for (let y = bottom; y <= t; y++) b.set(x, y, z, terrainState(k, x, y, z, t - y, steep));
      if (k === KIND.MOAT) for (let y = t + 1; y <= -1; y++) b.set(x, y, z, 'water[level=0]');
    }
  }
}

// ------------------------------------------------------------------ Ringmauern

// Mauer entlang eines Achtecks: Band lo … hi um die Mittellinie, Fuß auf dem Gelände, Wehrgang bei walk(x, z, fuß).
// Außen Brüstung und Zinnen mit Abdeckplatte; plinth: geböschter Sockel außen.
function ringWall(b, { poly, edges, lo, hi, walk, keep = () => true, plinth = 0, slits = 0, pilasters = 0, cornice = true }) {
  const pad = Math.ceil(hi) + 2;
  for (let z = poly.z1 - pad; z <= poly.z2 + pad; z++) {
    for (let x = poly.x1 - pad; x <= poly.x2 + pad; x++) {
      const { d, edge } = sdf(poly, x, z);
      if (!edges.includes(edge) || !keep(x, z)) continue;
      const diag = DIAG[edge];
      const g = groundAt(x, z);
      const along = diag || edge === EDGE.S || edge === EDGE.N ? x : z;
      if (d >= lo && d <= hi) {
        const w = walk(x, z, g);
        if (w <= g) continue;
        for (let y = g + 1; y <= w; y++) b.set(x, y, z, wallStone(x, y, z, g));
        const outer = d > hi - (diag ? 1.5 : 1);
        if (outer) {
          b.set(x, w + 1, z, wallStone(x, w + 1, z, g));
          const merlonRow = d > hi - (diag ? 0.75 : 1);
          if (merlonRow && along % 2 === 0) {
            b.set(x, w + 2, z, wallStone(x, w + 2, z, g));
            b.set(x, w + 3, z, 'stone_brick_slab[type=bottom]');
          }
          if (slits && merlonRow && !diag && ((along % slits) + slits) % slits === 3 && w - g >= 6) {
            for (let y = w - 3; y <= w - 2; y++) b.set(x, y, z, 'air');
          }
        }
      } else if (d > hi && d <= hi + (diag ? 0.75 : 1)) {
        // Vor der Außenseite: Sockel, Strebepfeiler, Gesims unter der Brüstung.
        const w = walk(x, z, g);
        const toWall = towardWall(edge, diag, x, z);
        if (cornice && w - g >= 4 && b.get(x, w, z) === 'air') b.set(x, w, z, `stone_brick_stairs[facing=${toWall},half=top]`);
        const pier = pilasters && !diag && ((along % pilasters) + pilasters) % pilasters === 0 && w - g >= plinth + 5;
        if (pier) {
          for (let y = g + 1; y <= w - 2; y++) b.set(x, y, z, wallStone(x, y, z, g));
          b.set(x, w - 1, z, `stone_brick_stairs[facing=${toWall},half=bottom]`);
          continue;
        }
        if (plinth <= 0 || w - g < plinth + 2) continue;
        for (let y = g + 1; y <= g + plinth; y++) b.set(x, y, z, patch(WALL_LOW, x, y, z, 34, 2));
        b.set(x, g + plinth + 1, z, `cobblestone_stairs[facing=${toWall},half=bottom]`);
      }
    }
  }
}

// Treppenrichtung zur Mauer hin (hohe Seite zur Mauer) für eine Kante.
function towardWall(edge, diag, x, z) {
  if (!diag) return ['east', null, 'north', null, 'west', null, 'south', null][edge];
  const pickX = (x + z) % 2 === 0;
  return {
    [EDGE.SW]: pickX ? 'east' : 'north', [EDGE.SE]: pickX ? 'west' : 'north',
    [EDGE.NE]: pickX ? 'west' : 'south', [EDGE.NW]: pickX ? 'east' : 'south',
  }[edge];
}

const outsideBurg = (x, z) => sdf(ZWB, x, z).d > 0.6;

function townWalls(b) {
  b.phase('Innere Stadtmauer');
  ringWall(b, {
    poly: TOWN, edges: [EDGE.W, EDGE.SW, EDGE.S, EDGE.SE, EDGE.E, EDGE.NE, EDGE.NW], lo: -1.5, hi: 1.25,
    walk: (x, z, g) => Math.max(TOWN_WALK, g + 4), keep: outsideBurg, plinth: 2, slits: 7, pilasters: 8,
  });
  b.phase('Zwingermauer');
  ringWall(b, {
    poly: TOWN, edges: [EDGE.W, EDGE.SW, EDGE.S, EDGE.SE, EDGE.E, EDGE.NE, EDGE.NW], lo: 6.6, hi: 8.25,
    walk: (x, z, g) => Math.max(OUTER_WALK, g + 3), keep: outsideBurg, plinth: 1, pilasters: 6,
  });
}

function castleWalls(b) {
  b.phase('Burg-Zwingermauer');
  ringWall(b, {
    poly: ZWB, edges: [0, 1, 2, 3, 4, 5, 6, 7], lo: -1.5, hi: 0.5,
    walk: (x, z, g) => Math.max(ZWB_WALK, g + 3), plinth: 0, pilasters: 7,
  });
  b.phase('Ringmauer der Kernburg');
  ringWall(b, {
    poly: KERN, edges: [0, 1, 2, 3, 4, 5, 6, 7], lo: -1.5, hi: 1.25,
    walk: () => KERN_WALK, plinth: 2, slits: 6, pilasters: 6,
  });
}

// ------------------------------------------------------------------ Rundtürme

function discCells(r) {
  const inDisc = (dx, dz) => dx * dx + dz * dz <= (r + 0.5) ** 2;
  const shell = [];
  const inner = [];
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!inDisc(dx, dz)) continue;
      const edge = !inDisc(dx + 1, dz) || !inDisc(dx - 1, dz) || !inDisc(dx, dz + 1) || !inDisc(dx, dz - 1);
      (edge ? shell : inner).push([dx, dz]);
    }
  }
  return { shell, inner, inDisc };
}

// Hohe Seite einer Treppe zur Mitte (cx, cz) hin.
function towardCenter(dx, dz) {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'west' : 'east';
  return dz > 0 ? 'north' : 'south';
}

// Kegeldach: Ringe aus Treppen über Vollblöcken, Neigung slope Ebenen je Block, Traufe bei y0 mit Radius R.
function coneRoof(b, { x, z, y, r, slope = 2, stairs = 'deepslate_tile_stairs', full = 'deepslate_tiles', tip = 'rod', set = null, salt = 0 }) {
  const mat = (dx, dz) => (set ? pickRoof(set, x + dx, z + dz + y * 3, salt) : [stairs, full]);
  const level = new Map();
  const key = (dx, dz) => `${dx},${dz}`;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.hypot(dx, dz);
      if (dist > r + 0.5) continue;
      level.set(key(dx, dz), Math.floor((r + 0.5 - dist) * slope + 1e-6));
    }
  }
  let peak = 0;
  for (const [k, lv] of level) {
    const [dx, dz] = k.split(',').map(Number);
    let low = Infinity;
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) low = Math.min(low, level.get(key(dx + ax, dz + az)) ?? -1);
    const [st, fu] = mat(dx, dz);
    for (let l = Math.max(0, low + 1); l < lv; l++) b.set(x + dx, y + l, z + dz, fu);
    if (dx === 0 && dz === 0) {
      b.set(x, y + lv, z, fu);
      peak = lv;
    } else b.set(x + dx, y + lv, z + dz, `${st}[facing=${towardCenter(dx, dz)},half=bottom]`);
  }
  if (tip === 'rod') {
    b.set(x, y + peak + 1, z, 'deepslate_tile_wall');
    b.set(x, y + peak + 2, z, 'lightning_rod[facing=up]');
  } else if (tip) {
    b.fill(x, y + peak + 1, z, x, y + peak + 3, z, 'spruce_fence');
    b.set(x, y + peak + 4, z, `${COLOR[tip].banner}[rotation=0]`);
  }
  return y + peak;
}

// Achteckiger Turmhelm: je Ebene ein Achteck mit Radius (r + 0.5)·(1 − l/h); Kante oben mit Treppen, sonst Vollblöcke.
function octSpire(b, { x, z, y, r, h, set, salt = 0 }) {
  const oct = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * 0.72);
  const radius = (l) => (r + 0.5) * (1 - l / h);
  const inside = (dx, dz, l) => l < h && oct(dx, dz) <= radius(l) + 1e-6;
  for (let l = 0; l < h; l++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!inside(dx, dz, l)) continue;
        const edge = !inside(dx + 1, dz, l) || !inside(dx - 1, dz, l) || !inside(dx, dz + 1, l) || !inside(dx, dz - 1, l);
        const topEdge = !inside(dx, dz, l + 1);
        if (!edge && !topEdge) continue;
        const [st, full] = pickRoof(set, x + dx, z + dz + l * 7, salt);
        b.set(x + dx, y + l, z + dz, topEdge && (dx !== 0 || dz !== 0) ? `${st}[facing=${towardCenter(dx, dz)},half=bottom]` : full);
      }
    }
  }
  return y + h - 1;
}

// Rundturm: Mantel vom Gelände bis top, Böden, Leiter, Zinnenkranz auf Konsolen und Kegeldach darüber.
// walkLevels: Höhen, auf denen Wehrgänge anschließen (dort Durchgänge im Mantel, wo walkCells es sagen).
function roundTower(b, t) {
  const { x, z, r, top, floors = [], roof = 'cone', roofColor = null, slope = 2, passages = [], stairs = 'deepslate_tile_stairs', full = 'deepslate_tiles', roofSet = 'schiefer', door = null, ladder = 'north' } = t;
  const { shell, inner } = discCells(r);
  let foot = Infinity;
  for (const [dx, dz] of [...shell, ...inner]) foot = Math.min(foot, groundAt(x + dx, z + dz));
  for (const [dx, dz] of shell) {
    const g = groundAt(x + dx, z + dz);
    for (let y = Math.min(g, foot) + 1; y <= top; y++) b.set(x + dx, y, z + dz, wallStone(x + dx, y, z + dz, foot));
  }
  for (const [dx, dz] of inner) {
    for (let y = foot + 1; y < top; y++) b.set(x + dx, y, z + dz, 'air');
    b.set(x + dx, foot, z + dz, patch([['cobblestone', 2], ['stone_bricks', 2], ['gravel', 1]], x + dx, foot, z + dz, 51));
    for (const f of floors) b.set(x + dx, f, z + dz, 'spruce_planks');
    b.set(x + dx, top, z + dz, roof === 'cone' ? 'spruce_planks' : wallStone(x + dx, top, z + dz, foot));
  }
  // Leiter an der Nord- (oder Süd-)wand, Löcher in den Böden.
  const lx = x;
  const lz = ladder === 'north' ? z - r + 1 : z + r - 1;
  const lf = ladder === 'north' ? 'south' : 'north';
  for (let y = foot + 1; y < top; y++) b.set(lx, y, lz, `ladder[facing=${lf}]`);
  b.set(lx, top, lz, `spruce_trapdoor[facing=${lf},half=top,open=false]`);
  for (const p of passages) for (let y = p.y + 1; y <= p.y + 2; y++) b.set(p.x, y, p.z, 'air');
  // Sockel (Böschung) außen.
  for (const [dx, dz] of discCells(r + 1).shell) {
    const g = groundAt(x + dx, z + dz);
    if (b.get(x + dx, g + 1, z + dz) !== 'air') continue;
    b.set(x + dx, g + 1, z + dz, patch(WALL_LOW, x + dx, g + 1, z + dz, 52, 2));
    b.set(x + dx, g + 2, z + dz, `cobblestone_stairs[facing=${towardCenter(dx, dz)},half=bottom]`);
  }
  // Gesims auf halber Höhe, Schießscharten über jedem Boden (nicht auf der Leiterseite).
  if (top - foot >= 12) {
    const mid = foot + Math.round((top - foot) * 0.55);
    for (const [dx, dz] of discCells(r + 1).shell) if (b.get(x + dx, mid, z + dz) === 'air') b.set(x + dx, mid, z + dz, `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=top]`);
  }
  for (const f of [foot, ...floors]) {
    const y = f + 2;
    if (y + 1 >= top) continue;
    for (const dir of ['north', 'south', 'east', 'west']) {
      if (dir === ladder || dir === door) continue;
      const [dx, dz] = STEP[dir];
      const [sx, sz] = [x + dx * r, z + dz * r];
      const [ox, oz] = [x + dx * (r + 1), z + dz * (r + 1)];
      if (b.get(ox, y, oz) !== 'air' || b.get(ox, y + 1, oz) !== 'air' || groundAt(ox, oz) >= y) continue;
      b.set(sx, y, sz, 'air');
      b.set(sx, y + 1, sz, 'air');
    }
  }
  // Tür am Boden: Boden innen auf Höhe des Geländes davor, Sockel vor der Tür frei.
  if (door) {
    const [dx, dz] = STEP[door];
    const [sx, sz] = [x + dx * r, z + dz * r];
    const [ox, oz] = [x + dx * (r + 1), z + dz * (r + 1)];
    const g = groundAt(ox, oz);
    if (g > foot) for (const [ix, iz] of inner) if (x + ix !== lx || z + iz !== lz) b.set(x + ix, g, z + iz, 'spruce_planks');
    b.set(sx, g, sz, 'stone_bricks');
    b.door(sx, g + 1, sz, 'spruce_door', { facing: OPP[door], hinge: 'left' });
    b.set(sx, g + 3, sz, 'stone_brick_stairs[facing=' + OPP[door] + ',half=top]');
    for (let y = g + 1; y <= g + 2; y++) b.set(ox, y, oz, 'air');
    wallLantern(b, { x: ox + (dz !== 0 ? 1 : 0), y: g + 3, z: oz + (dx !== 0 ? 1 : 0), facing: door, style: 'bracket', arm: 'spruce_fence' });
  }
  // Kranz: Konsolen unter einem vorspringenden Ring, darauf Brüstung und Zinnen.
  const ring = discCells(r + 1).shell;
  for (const [dx, dz] of ring) {
    b.set(x + dx, top, z + dz, `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=top]`);
    b.set(x + dx, top + 1, z + dz, wallStone(x + dx, top + 1, z + dz, foot));
    if (roof !== 'cone' && (Math.round(Math.atan2(dz, dx) * 6) % 2 === 0)) {
      b.set(x + dx, top + 2, z + dz, wallStone(x + dx, top + 2, z + dz, foot));
      b.set(x + dx, top + 3, z + dz, 'stone_brick_slab[type=bottom]');
    }
  }
  if (roof === 'cone') return coneRoof(b, { x, z, y: top + 2, r: r + 2, slope, stairs, full, tip: roofColor ?? 'rod', set: roofSet ? ROOF_SETS[roofSet] : null, salt: 111 });
  return top + 3;
}


// Durchgänge im Turmmantel, wo ein Wehrgang (Band lo … walkHi) den Mantel kreuzt.
function walkPassages(poly, edges, lo, walkHi, walk, cx, cz, r, keep = () => true) {
  const out = [];
  for (const [dx, dz] of discCells(r).shell) {
    const x = cx + dx;
    const z = cz + dz;
    const { d, edge } = sdf(poly, x, z);
    if (!edges.includes(edge) || !keep(x, z) || d < lo || d >= walkHi) continue;
    out.push({ x, z, y: walk(x, z, groundAt(x, z)) });
  }
  return out;
}

// ------------------------------------------------------------------ Dächer

const ROOFS = {
  schiefer: ['deepslate_tile_stairs', 'deepslate_tiles', 'deepslate_tile_slab'],
  ziegel: ['brick_stairs', 'bricks', 'brick_slab'],
  eiche: ['dark_oak_stairs', 'dark_oak_planks', 'dark_oak_slab'],
  fichte: ['spruce_stairs', 'spruce_planks', 'spruce_slab'],
  harz: ['resin_brick_stairs', 'resin_bricks', 'resin_brick_slab'],
  granit: ['polished_granite_stairs', 'polished_granite', 'polished_granite_slab'],
  lehm: ['mud_brick_stairs', 'mud_bricks', 'mud_brick_slab'],
  kupfer: ['oxidized_cut_copper_stairs', 'oxidized_cut_copper', 'oxidized_cut_copper_slab'],
};

// Steiles Satteldach über der Wandfläche x1 … x2 × z1 … z2; y = Oberkante der Wand (Rähm). axis = Firstrichtung.
// slope Ebenen je Block, ov Überstand an der Traufe, ovEnd am Giebel. gable(x, y, z, info) füllt die Giebeldreiecke.
function gableRoof(b, { x1, x2, z1, z2, y, axis, slope = 2, roof, ov = 1, ovEnd = 1, gable = null }) {
  const [st, full, slab] = roof;
  const across = axis === 'z' ? [x1 - ov, x2 + ov] : [z1 - ov, z2 + ov];
  const wallAcross = axis === 'z' ? [x1, x2] : [z1, z2];
  const along = axis === 'z' ? [z1 - ovEnd, z2 + ovEnd] : [x1 - ovEnd, x2 + ovEnd];
  const ends = axis === 'z' ? [z1, z2] : [x1, x2];
  const n = across[1] - across[0] + 1;
  const mid = (n - 1) / 2;
  let peak = y;
  for (let a = across[0]; a <= across[1]; a++) {
    const i = a - across[0];
    const k = Math.min(i, n - 1 - i);
    const ridge = i === mid;
    const base = y - (slope - 1) + k * slope;
    const facing = axis === 'z' ? (i < mid ? 'east' : 'west') : (i < mid ? 'south' : 'north');
    for (let l = along[0]; l <= along[1]; l++) {
      const [x, z] = axis === 'z' ? [a, l] : [l, a];
      for (let t = 0; t < slope; t++) {
        let state = full;
        if (!ridge && t === slope - 1) state = `${st}[facing=${facing},half=bottom]`;
        else if (!ridge && k === 0) state = `${st}[facing=${facing},half=top]`;
        b.set(x, base + t, z, state);
      }
      if (ridge) b.set(x, base + slope, z, `${slab}[type=bottom]`);
      peak = Math.max(peak, base + slope - 1 + (ridge ? 1 : 0));
      if (gable && ends.includes(l) && a >= wallAcross[0] && a <= wallAcross[1]) {
        for (let yy = y + 1; yy < base; yy++) gable(x, yy, z, { h: yy - y, k, i, n, end: l === ends[0] ? 0 : 1 });
      }
    }
  }
  return peak;
}

// Walmdach (oder Zeltdach bei quadratischer Fläche) mit Neigung slope; Ecken im Windrad-Muster.
function hipRoof(b, { x1, x2, z1, z2, y, slope = 2, roof, ov = 1 }) {
  const [st, full, slab] = roof;
  const a = { minX: x1 - ov, maxX: x2 + ov, minZ: z1 - ov, maxZ: z2 + ov };
  let peak = y;
  for (let z = a.minZ; z <= a.maxZ; z++) {
    for (let x = a.minX; x <= a.maxX; x++) {
      const dN = z - a.minZ;
      const dS = a.maxZ - z;
      const dW = x - a.minX;
      const dE = a.maxX - x;
      const k = Math.min(dN, dS, dW, dE);
      const ridge = (dN === k && dS === k) || (dW === k && dE === k);
      let facing = 'west';
      if (dN === k && dW === k) facing = 'east';
      else if (dN === k && dE === k) facing = 'south';
      else if (dS === k && dE === k) facing = 'west';
      else if (dS === k && dW === k) facing = 'north';
      else if (dN === k) facing = 'south';
      else if (dS === k) facing = 'north';
      else if (dW === k) facing = 'east';
      const base = y - (slope - 1) + k * slope;
      for (let t = 0; t < slope; t++) {
        let state = full;
        if (!ridge && t === slope - 1) state = `${st}[facing=${facing},half=bottom]`;
        else if (!ridge && k === 0) state = `${st}[facing=${facing},half=top]`;
        b.set(x, base + t, z, state);
      }
      if (ridge) b.set(x, base + slope, z, `${slab}[type=bottom]`);
      peak = Math.max(peak, base + slope);
    }
  }
  return peak;
}

// ------------------------------------------------------------------ Kleine Hilfen

function forBox(x1, y1, z1, x2, y2, z2, fn) {
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) fn(x, y, z);
    }
  }
}

const stoneAt = (b, foot) => (x, y, z) => b.set(x, y, z, wallStone(x, y, z, foot));

// Zinnenkranz entlang eines Rechtecks (Außenkante x1 … x2 × z1 … z2) auf Höhe y, auf Konsolen vorgesetzt.
function rectCrown(b, { x1, x2, z1, z2, y, foot, corbels = true }) {
  const o = corbels ? 1 : 0;
  for (let x = x1 - o; x <= x2 + o; x++) {
    for (let z = z1 - o; z <= z2 + o; z++) {
      const edge = x === x1 - o || x === x2 + o || z === z1 - o || z === z2 + o;
      if (!edge) continue;
      if (corbels) {
        const facing = x === x1 - o ? 'east' : x === x2 + o ? 'west' : z === z1 - o ? 'south' : 'north';
        b.set(x, y - 1, z, `stone_brick_stairs[facing=${facing},half=top]`);
      }
      b.set(x, y, z, wallStone(x, y, z, foot));
      if ((x + z) % 2 === 0) {
        b.set(x, y + 1, z, wallStone(x, y + 1, z, foot));
        b.set(x, y + 2, z, 'stone_brick_slab[type=bottom]');
      }
    }
  }
}

// Gerade Treppe aus Steinstufen: steigt von (x, y, z) in Richtung facing, width breit (nach +quer), Unterbau bis foot.
function stoneStairs(b, { x, y, z, facing, steps, width = 1, foot, stairs = 'stone_brick_stairs', support = 'stone_bricks' }) {
  const [dx, dz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
  const [qx, qz] = [Math.abs(dz), Math.abs(dx)];
  for (let i = 0; i < steps; i++) {
    for (let w = 0; w < width; w++) {
      const cx = x + dx * i + qx * w;
      const cz = z + dz * i + qz * w;
      for (let yy = foot; yy < y + i; yy++) b.set(cx, yy, cz, support);
      b.set(cx, y + i, cz, `${stairs}[facing=${facing},half=bottom]`);
    }
  }
}

// Graben ausheben: Luft bis zum Gelände, Sohle bei bottom, Seitenwände aus Fels.
function dig(b, { x1, x2, z1, z2, bottom }) {
  for (let z = z1 - 1; z <= z2 + 1; z++) {
    for (let x = x1 - 1; x <= x2 + 1; x++) {
      const g = groundAt(x, z);
      const inside = x >= x1 && x <= x2 && z >= z1 && z <= z2;
      for (let y = bottom; y <= g; y++) {
        if (inside) b.set(x, y, z, y === bottom ? patch([['gravel', 3], ['cobblestone', 2], ['mossy_cobblestone', 1]], x, y, z, 61) : 'air');
        else if (y < g) b.set(x, y, z, patch(ROCK_STONE, x, y, z, 41, 2.5));
      }
    }
  }
}

// ------------------------------------------------------------------ Türme der Stadtmauern

const TOWN_EDGES = [EDGE.W, EDGE.SW, EDGE.S, EDGE.SE, EDGE.E, EDGE.NE, EDGE.NW];
const townWalk = (x, z, g) => Math.max(TOWN_WALK, g + 4);
const outerWalk = (x, z, g) => Math.max(OUTER_WALK, g + 3);

// [x, z, Höhe, Fahne, Tür]; Türen nur dort, wo vor dem Turm Platz ist.
const INNER_TOWERS = [
  [-49, -22, 26, 'rot', null], [-49, -6, 22, null, 'east'], [-49, 14, 22, null, null], [-43, 35, 23, 'blau', 'east'], [-22, 41, 22, null, 'north'],
  [22, 41, 22, null, 'north'], [43, 35, 23, 'blau', 'west'], [49, 14, 22, null, null], [49, -6, 22, null, 'west'], [49, -22, 26, 'rot', null],
];
const OUTER_TOWERS = [[-56, 4, 'east'], [-47, 40, 'east'], [-30, 48, 'north'], [30, 48, 'north'], [47, 40, 'west'], [56, 4, 'west']];

function townTowers(b) {
  b.phase('Türme der inneren Stadtmauer');
  for (const [x, z, top, flag, door] of INNER_TOWERS) {
    const passages = walkPassages(TOWN, TOWN_EDGES, -1.5, 0.5, townWalk, x, z, 4, outsideBurg);
    const floors = z < STEP_Z ? [11, TOWN_WALK] : [8, TOWN_WALK];
    roundTower(b, { x, z, r: 4, top, floors, passages, slope: 1.6, roofColor: flag, roofSet: 'ziegel', door, ladder: door === 'north' ? 'south' : 'north' });
  }
  b.phase('Türme der Zwingermauer');
  for (const [x, z, door] of OUTER_TOWERS) {
    const passages = walkPassages(TOWN, TOWN_EDGES, 6.6, 7.25, outerWalk, x, z, 3, outsideBurg);
    roundTower(b, { x, z, r: 3, top: 11, floors: [OUTER_WALK], passages, roof: 'crenel', door, ladder: door === 'north' ? 'south' : 'north' });
  }
}

// ------------------------------------------------------------------ Haupttor, Vortor, Brücke und Zugbrücke

const GATE = { x: 5, z1: 35, z2: 44, top: 21 };

function mainGate(b) {
  const { x: gx, z1, z2, top } = GATE;
  b.phase('Haupttor');
  forBox(-gx, 2, z1, gx, top, z2, (x, y, z) => {
    const shell = Math.abs(x) === gx || z === z1 || z === z2;
    const floor = y === 10 || y === 15 || y === top;
    if (shell || floor) b.set(x, y, z, shell ? wallStone(x, y, z, 1) : 'spruce_planks');
    else b.set(x, y, z, y < 10 ? wallStone(x, y, z, 1) : 'air');
  });
  forBox(-gx, 1, z1, gx, 1, z2, (x, y, z) => b.set(x, y, z, wallStone(x, y, z, 1)));
  for (let z = z1; z <= z2; z++) for (let x = -2; x <= 2; x++) b.set(x, 2, z, patch([['cobblestone', 3], ['stone_bricks', 2], ['andesite', 1]], x, 2, z, 62));
  arch(b, { x: 0, y: 3, z: z2, facing: 'south', width: 5, height: 7, style: 'pointed', depth: z2 - z1 + 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  for (let x = -2; x <= 2; x++) b.set(x, 2, z2 + 1, 'cobblestone_slab[type=bottom]');
  // Fallgitter halb hochgezogen, Torflügel offen.
  for (let y = 6; y <= 9; y++) for (let x = -2; x <= 2; x++) if (b.get(x, y, z2 - 1) === 'air') b.set(x, y, z2 - 1, 'iron_bars');
  for (let y = 3; y <= 6; y++) {
    for (const z of [z1 + 1, z1 + 2]) {
      b.set(-2, y, z, 'dark_oak_trapdoor[facing=east,half=bottom,open=true]');
      b.set(2, y, z, 'dark_oak_trapdoor[facing=west,half=bottom,open=true]');
    }
  }
  for (const z of [z1 + 3, z1 + 6]) hangingLantern(b, { x: 0, y: 8, z, chain: 0 });
  // Torstuben: Leiter, Fenster, Wappen.
  for (let y = 11; y < top; y++) b.set(gx - 1, y, z1 + 1, 'ladder[facing=west]');
  for (const y of [10, 15]) b.set(gx - 1, y, z1 + 1, 'ladder[facing=west]');
  for (let y = 3; y < 10; y++) b.set(gx - 1, y, z1 + 1, 'air');
  b.set(gx - 1, top, z1 + 1, 'spruce_trapdoor[facing=west,half=top,open=false]');
  for (const y of [12, 17]) {
    for (const x of [-3, 0, 3]) {
      b.set(x, y, z2, 'air');
      b.set(x, y + 1, z2, 'air');
      b.set(x, y, z1, 'glass_pane');
      b.set(x, y + 1, z1, 'glass_pane');
    }
  }
  for (const x of [-3, 3]) b.set(x, 11, z2 + 1, `${COLOR.rot.wallBanner}[facing=south]`);
  b.set(0, 14, z2 + 1, `${COLOR.gelb.wallBanner}[facing=south]`);
  storage(b, { x: -gx + 1, y: 11, z: z2 - 1, facing: 'east', width: 3, height: 1 });
  bedroom(b, { x: -gx + 1, y: 16, z: z1 + 1, facing: 'east', width: 4, depth: 3, wood: 'fichte', color: 'rot', rug: null });
  lightRoom(b, { x1: -gx + 1, y1: 11, z1: z1 + 1, x2: gx - 1, y2: 14, z2: z2 - 1 });
  lightRoom(b, { x1: -gx + 1, y1: 16, z1: z1 + 1, x2: gx - 1, y2: top - 1, z2: z2 - 1 });
  rectCrown(b, { x1: -gx, x2: gx, z1, z2, y: top + 1, foot: 1 });
  hipRoof(b, { x1: -gx + 2, x2: gx - 2, z1: z1 + 2, z2: z2 - 2, y: top + 1, slope: 2, roof: ROOFS.schiefer, ov: 0 });
  b.fill(0, top + 9, 39, 0, top + 11, 39, 'spruce_fence');
  b.set(0, top + 12, 39, `${COLOR.rot.banner}[rotation=0]`);
  b.phase('Tortürme');
  for (const s of [-1, 1]) roundTower(b, { x: s * 8, z: 42, r: 4, top: 25, floors: [8, TOWN_WALK], slope: 1.6, roofColor: 'gelb', passages: walkPassages(TOWN, TOWN_EDGES, -1.5, 0.5, townWalk, s * 8, 42, 4) });
  for (const s of [-1, 1]) {
    for (let y = 15; y <= 16; y++) b.set(s * 5, y, 41, 'air');
    b.set(s * 4, 14, 41, 'spruce_planks');
  }
}

const VORTOR = { x: 4, z1: 45, z2: 49, top: 12 };

function outerGate(b) {
  const { x: vx, z1, z2, top } = VORTOR;
  b.phase('Vortor');
  forBox(-vx, 1, z1, vx, top, z2, (x, y, z) => {
    const shell = Math.abs(x) === vx || z === z1 || z === z2;
    if (shell || y <= 7 || y === top) b.set(x, y, z, wallStone(x, y, z, 0));
    else b.set(x, y, z, 'air');
  });
  for (let z = z1; z <= z2; z++) for (let x = -2; x <= 2; x++) b.set(x, 1, z, patch([['cobblestone', 3], ['stone_bricks', 2], ['gravel', 1]], x, 1, z, 63));
  arch(b, { x: 0, y: 2, z: z2, facing: 'south', width: 5, height: 5, style: 'round', depth: z2 - z1 + 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  for (let y = 8; y < top; y++) b.set(vx - 1, y, z1 + 1, 'ladder[facing=west]');
  b.set(vx - 1, top, z1 + 1, 'spruce_trapdoor[facing=west,half=top,open=false]');
  for (const x of [-2, 2]) for (let y = 9; y <= 10; y++) b.set(x, y, z2, 'air');
  lightRoom(b, { x1: -vx + 1, y1: 8, z1: z1 + 1, x2: vx - 1, y2: top - 1, z2: z2 - 1 });
  rectCrown(b, { x1: -vx, x2: vx, z1, z2, y: top + 1, foot: 0 });
  b.fill(0, top + 1, 47, 0, top + 4, 47, 'spruce_fence');
  b.set(0, top + 5, 47, `${COLOR.blau.banner}[rotation=0]`);

  b.phase('Zugbrücke und Steinbrücke');
  // Zugbrücke (abgelassen) über dem Graben, Ketten zur Torfront.
  for (let z = 50; z <= 52; z++) for (let x = -2; x <= 2; x++) b.set(x, 1, z, z === 52 || Math.abs(x) === 2 ? 'stripped_dark_oak_log[axis=z]' : 'dark_oak_planks');
  for (const x of [-2, 2]) {
    for (const [z, y] of [[50, 7], [50, 6], [51, 5], [51, 4], [52, 3], [52, 2]]) b.set(x, y, z, 'iron_chain[axis=y]');
    b.set(x, 8, 50, 'iron_chain[axis=z]');
  }
  // Steinbrücke mit Pfeiler und Bogen bis zum Ufer.
  for (let z = 53; z <= 57; z++) {
    for (let x = -3; x <= 3; x++) {
      const edge = Math.abs(x) === 3;
      if (z <= 54) for (let y = MOAT_BED; y <= 0; y++) b.set(x, y, z, wallStone(x, y, z, MOAT_BED));
      else if (z === 55) b.set(x, 0, z, `stone_brick_stairs[facing=north,half=top]`);
      b.set(x, 1, z, edge ? 'stone_bricks' : patch([['cobblestone', 3], ['stone_bricks', 2], ['andesite', 1]], x, 1, z, 64));
      if (edge) b.set(x, 2, z, 'stone_brick_wall');
    }
  }
  for (const x of [-3, 3]) lampPost(b, { x, y: 3, z: 57, height: 1, post: 'stone_brick_wall', style: 'top' });
  for (let x = -2; x <= 2; x++) b.set(x, 1, 58, 'cobblestone_slab[type=bottom]');
}

// ------------------------------------------------------------------ Burg: Türme, Halsgraben, Tore, Stiege

const ALL_EDGES = [0, 1, 2, 3, 4, 5, 6, 7];
const KERN_TOWERS = [[-29, -35, 'rot'], [29, -35, 'rot'], [-29, -59, 'gelb'], [29, -59, 'gelb']];
const ZWB_TOWERS = [[-36, -28], [36, -28], [-36, -65], [36, -65]];
const towardMiddle = (x) => (x < 0 ? 'east' : 'west');
const zwbWalk = (x, z, g) => Math.max(ZWB_WALK, g + 3);

function castleTowers(b) {
  b.phase('Ecktürme der Kernburg');
  for (const [x, z, flag] of KERN_TOWERS) {
    const passages = walkPassages(KERN, ALL_EDGES, -1.5, 0.25, () => KERN_WALK, x, z, 4);
    roundTower(b, { x, z, r: 4, top: 33, floors: [KERN_WALK], passages, slope: 2, roofColor: flag, door: towardMiddle(x) });
  }
  b.phase('Türme der Burg-Zwingermauer');
  for (const [x, z] of ZWB_TOWERS) {
    const passages = walkPassages(ZWB, ALL_EDGES, -1.5, -0.5, zwbWalk, x, z, 3);
    roundTower(b, { x, z, r: 3, top: 27, floors: [ZWB_WALK], passages, slope: 1.6, door: towardMiddle(x) });
  }
}

const KTOR = { x: 6, z1: -37, z2: -28, top: 31 };

function castleGate(b) {
  b.phase('Halsgraben');
  dig(b, { x1: -12, x2: 12, z1: -27, z2: -25, bottom: 8 });
  const { x: gx, z1, z2, top } = KTOR;
  b.phase('Torhaus der Burg');
  forBox(-gx, 16, z1, gx, top, z2, (x, y, z) => {
    const shell = Math.abs(x) === gx || z === z1 || z === z2;
    const floor = y === 23 || y === 27;
    if (shell) b.set(x, y, z, wallStone(x, y, z, 15));
    else if (floor) b.set(x, y, z, 'spruce_planks');
    else b.set(x, y, z, y < 23 ? wallStone(x, y, z, 15) : 'air');
  });
  forBox(-gx, top, z1, gx, top, z2, (x, y, z) => b.set(x, y, z, 'spruce_planks'));
  for (let z = z1; z <= z2; z++) for (let x = -2; x <= 2; x++) b.set(x, 15, z, patch([['cobblestone', 3], ['stone_bricks', 2], ['andesite', 1]], x, 15, z, 65));
  arch(b, { x: 0, y: 16, z: z2, facing: 'south', width: 5, height: 7, style: 'pointed', depth: z2 - z1 + 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  for (let y = 19; y <= 22; y++) for (let x = -2; x <= 2; x++) if (b.get(x, y, z2 - 1) === 'air') b.set(x, y, z2 - 1, 'iron_bars');
  for (let y = 16; y <= 19; y++) {
    for (const z of [z1 + 1, z1 + 2]) {
      b.set(-2, y, z, 'dark_oak_trapdoor[facing=east,half=bottom,open=true]');
      b.set(2, y, z, 'dark_oak_trapdoor[facing=west,half=bottom,open=true]');
    }
  }
  hangingLantern(b, { x: 0, y: 21, z: -32, chain: 0 });
  // Pechnase über dem Tor.
  for (let x = -2; x <= 2; x++) {
    b.set(x, 23, z2 + 1, 'stone_brick_stairs[facing=north,half=top]');
    b.set(x, 24, z2 + 1, wallStone(x, 24, z2 + 1, 15));
    b.set(x, 25, z2 + 1, x % 2 === 0 ? 'stone_brick_slab[type=bottom]' : wallStone(x, 25, z2 + 1, 15));
  }
  for (const x of [-4, 4]) for (let y = 24; y <= 25; y++) b.set(x, y, z2, 'glass_pane');
  for (const x of [-3, 0, 3]) for (let y = 28; y <= 29; y++) {
    b.set(x, y, z2, 'glass_pane');
    b.set(x, y, z1, 'glass_pane');
  }
  // Leiter von der Durchfahrt hinauf, Stuben.
  for (let y = 16; y < top; y++) b.set(gx - 1, y, z1 + 1, 'ladder[facing=west]');
  for (let y = 16; y <= 22; y++) b.set(gx - 1, y, z1 + 2, y <= 17 ? 'air' : b.get(gx - 1, y, z1 + 2));
  doorway(b, { x: gx - 1, y: 16, z: z1 + 2, facing: 'west', door: 'spruce_door', frame: null });
  b.set(gx - 1, top, z1 + 1, 'spruce_trapdoor[facing=west,half=top,open=false]');
  for (let y = 16; y <= 22; y++) for (let z = z1 + 1; z <= z1 + 2; z++) if (b.get(gx - 1, y, z) !== 'air' && !b.get(gx - 1, y, z).includes('door') && !b.get(gx - 1, y, z).includes('ladder')) b.set(gx - 1, y, z, 'air');
  storage(b, { x: -gx + 1, y: 24, z: z2 - 1, facing: 'east', width: 3, height: 1 });
  diningTable(b, { x: -1, y: 24, z: -33, facing: 'south', length: 3, width: 1, wood: 'fichte' });
  bedroom(b, { x: -gx + 1, y: 28, z: z1 + 1, facing: 'east', width: 4, depth: 3, wood: 'schwarzeiche', color: 'blau', rug: null });
  lightRoom(b, { x1: -gx + 1, y1: 24, z1: z1 + 1, x2: gx - 1, y2: 26, z2: z2 - 1 });
  lightRoom(b, { x1: -gx + 1, y1: 28, z1: z1 + 1, x2: gx - 1, y2: top - 1, z2: z2 - 1 });
  lightRoom(b, { x1: gx - 1, y1: 16, z1: z1 + 1, x2: gx - 1, y2: 22, z2: z1 + 2 });
  hipRoof(b, { x1: -gx, x2: gx, z1, z2, y: top, slope: 2, roof: ROOFS.schiefer, ov: 1 });
  // Erkertürmchen an den Vorderecken.
  for (const s of [-1, 1]) {
    const cx = s * (gx + 1);
    const cz = z2 + 1;
    for (const [dx, dz] of discCells(1).shell.concat(discCells(1).inner)) {
      b.set(cx + dx, 25, cz + dz, `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=top]`);
      for (let y = 26; y <= top + 1; y++) b.set(cx + dx, y, cz + dz, dx === 0 && dz === 0 ? 'air' : wallStone(cx + dx, y, cz + dz, 15));
    }
    b.set(cx, 26, cz, 'spruce_planks');
    for (const [dx, dz] of [[s, 0], [0, 1]]) b.set(cx + dx, 28, cz + dz, 'air');
    coneRoof(b, { x: cx, z: cz, y: top + 2, r: 2, slope: 2.5, tip: 'rod' });
  }
  // Zugbrücke (abgelassen) über den Halsgraben, Ketten zur Torfront.
  b.phase('Zugbrücke der Burg');
  for (let z = -27; z <= -25; z++) for (let x = -2; x <= 2; x++) b.set(x, 15, z, z === -25 || Math.abs(x) === 2 ? 'stripped_dark_oak_log[axis=z]' : 'dark_oak_planks');
  for (const x of [-2, 2]) {
    for (const [z, y] of [[-27, 21], [-27, 20], [-26, 19], [-26, 18], [-25, 17], [-25, 16]]) b.set(x, y, z, 'iron_chain[axis=y]');
  }
}

function castleOuterGate(b) {
  b.phase('Burgtor am Zwinger');
  forBox(-4, 16, -24, 4, 26, -21, (x, y, z) => {
    const shell = Math.abs(x) === 4 || z === -24 || z === -21;
    if (shell || y <= ZWB_WALK || y === 26) b.set(x, y, z, wallStone(x, y, z, 15));
    else b.set(x, y, z, 'air');
  });
  for (let z = -24; z <= -21; z++) for (let x = -2; x <= 2; x++) b.set(x, 15, z, patch([['cobblestone', 3], ['stone_bricks', 2]], x, 15, z, 66));
  arch(b, { x: 0, y: 16, z: -21, facing: 'south', width: 5, height: 5, style: 'round', depth: 4, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  rectCrown(b, { x1: -4, x2: 4, z1: -24, z2: -21, y: 27, foot: 15 });
  for (const x of [-2, 2]) for (let y = 23; y <= 24; y++) b.set(x, y, -21, 'air');
  for (let y = 22; y < 26; y++) b.set(3, y, -23, 'ladder[facing=west]');
  b.set(3, 26, -23, 'spruce_trapdoor[facing=west,half=top,open=false]');
  for (const [dx, dz] of [[-4, -22], [4, -22]]) for (let y = 22; y <= 23; y++) b.set(dx, y, dz, 'air');
  lightRoom(b, { x1: -3, y1: 22, z1: -23, x2: 3, y2: 25, z2: -22 });
  b.fill(0, 28, -22, 0, 31, -22, 'spruce_fence');
  b.set(0, 32, -22, `${COLOR.rot.banner}[rotation=0]`);
}

function burgStiege(b) {
  b.phase('Burgstiege');
  for (let z = -20; z <= -12; z++) {
    const y = 15 - (z + 20);
    for (let x = -2; x <= 2; x++) {
      for (let yy = OBER + 1; yy < y; yy++) b.set(x, yy, z, wallStone(x, yy, z, OBER));
      b.set(x, y, z, 'stone_brick_stairs[facing=north,half=bottom]');
    }
    for (const x of [-3, 3]) {
      for (let yy = OBER + 1; yy <= y; yy++) b.set(x, yy, z, wallStone(x, yy, z, OBER));
      b.set(x, y + 1, z, 'stone_brick_wall');
    }
  }
  for (const x of [-3, 3]) {
    b.set(x, 16, -21, 'stone_bricks');
    lampPost(b, { x, y: 9, z: -12, height: 1, post: 'stone_brick_wall', style: 'top' });
    lampPost(b, { x, y: 17, z: -20, height: 1, post: 'stone_brick_wall', style: 'top' });
  }
}

// ------------------------------------------------------------------ Bergfried

const KEEP = { x: -18, z: -49, r: 6, top: 50, floors: [KERN_WALK, 30, 36, 42] };

function bergfried(b) {
  const { x, z, r, top, floors } = KEEP;
  b.phase('Bergfried');
  roundTower(b, { x, z, r, top, floors, roof: 'crenel' });
  // Gesimse und Schießscharten.
  for (const y of [KERN_WALK, 37]) {
    for (const [dx, dz] of discCells(r + 1).shell) {
      if (b.get(x + dx, y, z + dz) === 'air') b.set(x + dx, y, z + dz, `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=top]`);
    }
  }
  for (const [y, dirs] of [[19, ['n', 'e']], [32, ['n', 'e', 's', 'w']], [44, ['n', 'e', 's', 'w']]]) {
    for (const dir of dirs) {
      const [dx, dz] = { n: [0, -r], e: [r, 0], s: [0, r], w: [-r, 0] }[dir];
      b.set(x + dx, y, z + dz, 'air');
      b.set(x + dx, y + 1, z + dz, 'air');
      if (dz === 0) b.set(x + dx, y + 1, z + 1, 'air');
    }
  }
  // Hocheingang im Westen mit Holzbrücke zum Wehrgang.
  doorway(b, { x: x - r, y: KERN_WALK + 1, z, facing: 'west', door: 'spruce_door', frame: null });
  for (let bx = -30; bx <= x - r - 1; bx++) {
    for (const bz of [z - 1, z]) b.set(bx, KERN_WALK, bz, 'spruce_planks');
    b.set(bx, KERN_WALK + 1, z + 1, 'spruce_fence');
    b.set(bx, KERN_WALK + 1, z - 2, 'spruce_fence');
    b.set(bx, KERN_WALK, z + 1, 'spruce_slab[type=top]');
    b.set(bx, KERN_WALK, z - 2, 'spruce_slab[type=top]');
  }
  for (const bx of [-28, -26]) {
    b.fill(bx, 16, z + 1, bx, KERN_WALK - 1, z + 1, 'spruce_log[axis=y]');
    b.set(bx, KERN_WALK - 1, z, 'spruce_stairs[facing=south,half=top]');
    b.set(bx, KERN_WALK - 1, z - 1, 'spruce_stairs[facing=south,half=top]');
  }
  wallLantern(b, { x: x - r, y: KERN_WALK + 3, z: z + 1, facing: 'west', style: 'bracket', arm: 'spruce_fence' });
  // Dachhaus mit Kegeldach im Zinnenkranz.
  for (const [dx, dz] of discCells(4).shell) for (let y = top + 1; y <= top + 2; y++) b.set(x + dx, y, z + dz, wallStone(x + dx, y, z + dz, 15));
  for (const [dx, dz] of [[0, 4], [4, 0], [0, -4], [-4, 0]]) b.set(x + dx, top + 1, z + dz, dz === 4 ? 'air' : 'glass_pane');
  b.set(x, top + 2, z + 4, 'air');
  coneRoof(b, { x, z, y: top + 3, r: 5, slope: 2.2, tip: 'rot', set: ROOF_SETS.schiefer, salt: 112 });
  // Einrichtung: Verlies, Wachstube, Kammer, Rüstkammer, Ausguck.
  const ix = x - 2;
  const iz = z - 1;
  for (const [cx, cz] of [[x - 3, z - 2], [x + 3, z + 2], [x + 3, z - 2]]) b.fill(cx, KERN_WALK - 3, cz, cx, KERN_WALK - 1, cz, 'iron_chain[axis=y]');
  b.set(x - 2, 16, z + 3, 'skeleton_skull[rotation=6]');
  b.set(x + 3, 16, z + 3, 'cobweb');
  b.set(x - 4, 16, z, 'cobweb');
  hangingLantern(b, { x: x + 1, y: KERN_WALK - 1, z, chain: 2, lantern: 'soul_lantern' });
  diningTable(b, { x: ix, y: KERN_WALK + 1, z: iz + 2, facing: 'south', length: 3, width: 1, wood: 'schwarzeiche', headChairs: false });
  storage(b, { x: x + 3, y: KERN_WALK + 1, z: z + 3, facing: 'north', width: 3, height: 1, barrel: true });
  bedroom(b, { x: x - 2, y: 31, z: z + 4, facing: 'north', width: 4, depth: 3, wood: 'schwarzeiche', color: 'rot', rug: 'gelb' });
  workshop(b, { x: x - 2, y: 37, z: z + 4, facing: 'north', width: 4, wood: 'schwarzeiche', shelves: true });
  storage(b, { x: x - 2, y: 43, z: z + 4, facing: 'north', width: 4, height: 2, barrel: true });
  for (const f of [16, ...floors]) {
    const y2 = f === 16 ? KERN_WALK - 1 : (floors[floors.indexOf(f) + 1] ?? top) - 1;
    lightRoom(b, { x1: x - r + 1, y1: f === 16 ? 16 : f + 1, z1: z - r + 1, x2: x + r - 1, y2, z2: z + r - 1 }, f === 16 ? { lantern: 'soul_lantern' } : {});
  }
  b.fill(x, top + 1, z + 5, x, top + 4, z + 5, 'spruce_fence');
  b.set(x, top + 5, z + 5, `${COLOR.gelb.banner}[rotation=0]`);
  void ix;
}

// ------------------------------------------------------------------ Palas

const PALAS = { x1: -6, x2: 23, z1: -60, z2: -49, hall: 21, upper: 28, top: 33 };

function palasStone(x, y, z) {
  if (y <= 17) return patch([['stone_bricks', 4], ['mossy_stone_bricks', 2], ['cobblestone', 1], ['andesite', 1]], x, y, z, 71, 2.5);
  if (y === PALAS.hall || y === PALAS.upper) return 'polished_andesite';
  return patch([['stone_bricks', 12], ['cracked_stone_bricks', 1], ['mossy_stone_bricks', 1], ['tuff_bricks', 2]], x, y, z, 72, 3);
}

function palas(b) {
  const { x1, x2, z1, z2, hall, upper, top } = PALAS;
  b.phase('Palas');
  forBox(x1, 16, z1, x2, top, z2, (x, y, z) => {
    const shell = x === x1 || x === x2 || z === z1 || z === z2;
    if (shell) b.set(x, y, z, palasStone(x, y, z));
    else if (y === hall || y === upper || y === top) b.set(x, y, z, y === hall ? 'dark_oak_planks' : 'spruce_planks');
    else b.set(x, y, z, 'air');
  });
  for (let x = x1 + 1; x < x2; x++) for (let z = z1 + 1; z < z2; z++) b.set(x, 15, z, (x + z) % 2 === 0 ? 'polished_andesite' : 'stone_bricks');
  // Lisenen mit Abdeckung, Ecken aus poliertem Andesit.
  for (const x of [x1, 4, 14, x2]) {
    for (let y = 16; y <= top - 1; y++) b.set(x, y, z2 + 1, y % 6 === 0 ? 'polished_andesite' : palasStone(x, y, z2 + 1));
    b.set(x, top, z2 + 1, 'stone_brick_stairs[facing=north,half=bottom]');
  }
  // Fenster: Erdgeschoss vergittert, Rittersaal hohe Bogenfenster, Obergeschoss Doppelfenster.
  const hallWindows = [-3, 1, 7, 11, 17, 20];
  for (const wx of [-3, 1, 11, 17, 20]) for (let y = 17; y <= 18; y++) b.set(wx, y, z2, 'iron_bars');
  for (const wx of hallWindows) {
    window(b, { x: wx, y: hall + 2, z: z2, facing: 'south', width: 2, height: 4, style: 'arched', glass: 'glass_pane', frame: null, stairs: 'stone_brick_stairs', sill: 'stone_brick_stairs' });
    window(b, { x: wx, y: hall + 3, z: z1, facing: 'north', width: 2, height: 3, style: 'arched', glass: 'glass_pane', frame: null, stairs: 'stone_brick_stairs' });
  }
  for (const wx of [-3, 1, 7, 11, 17, 20]) {
    for (const z of [z1, z2]) for (let y = upper + 2; y <= upper + 3; y++) for (const dx of [0, 1]) b.set(wx + dx, y, z, 'glass_pane');
  }
  for (const z of [-57, -52]) for (const x of [x1, x2]) for (let y = hall + 2; y <= hall + 4; y++) b.set(x, y, z, 'glass_pane');
  // Dach mit Giebeln aus Stein, Kaminen und Gauben.
  const peak = gableRoof(b, {
    x1, x2, z1, z2, y: top, axis: 'x', slope: 2, roof: ROOFS.schiefer, ov: 1, ovEnd: 1,
    gable: (x, y, z, info) => b.set(x, y, z, info.h % 5 === 0 ? 'polished_andesite' : palasStone(x, y, z)),
  });
  for (const x of [x1, x2]) for (let y = top + 2; y <= top + 3; y++) b.set(x, y, -55, 'glass_pane');
  for (const cx of [2, 15]) {
    for (let y = upper + 1; y <= peak + 2; y++) b.set(cx, y, z1 + 1, y <= top ? 'stone_bricks' : 'bricks');
    b.set(cx, peak + 3, z1 + 1, 'campfire[facing=south,lit=true,signal_fire=false]');
  }
  for (const dx of [-1, 9, 19]) palasDormer(b, dx, top, z2);
  // Freitreppe zum Rittersaal und Türen.
  stoneStairs(b, { x: -5, y: 16, z: z2 + 1, facing: 'east', steps: hall - 15, foot: 16 });
  for (let x = 1; x <= 2; x++) for (let y = 16; y <= hall; y++) b.set(x, y, z2 + 1, y === hall ? 'polished_andesite' : 'stone_bricks');
  for (let x = -5; x <= 2; x++) b.set(x, 16 + Math.min(Math.max(x + 5, 0), hall - 16) + 1, z2 + 2, 'stone_brick_wall');
  for (let x = -5; x <= 2; x++) for (let y = 16; y <= 16 + Math.min(Math.max(x + 5, 0), hall - 16); y++) b.set(x, y, z2 + 2, 'stone_bricks');
  doorway(b, { x: 1, y: hall + 1, z: z2, facing: 'south', door: 'dark_oak_door', width: 2, frame: null });
  doorway(b, { x: 9, y: 16, z: z2, facing: 'south', door: 'spruce_door', width: 1, frame: null });
  b.set(1, hall + 4, z2 + 1, `${COLOR.rot.wallBanner}[facing=south]`);
  b.set(2, hall + 4, z2 + 1, `${COLOR.gelb.wallBanner}[facing=south]`);
  wallLantern(b, { x: 0, y: hall + 3, z: z2, facing: 'south', style: 'bracket', arm: 'dark_oak_fence' });
  wallLantern(b, { x: 3, y: hall + 3, z: z2, facing: 'south', style: 'bracket', arm: 'dark_oak_fence' });
  palasInterior(b);
  stairTower(b);
}

// Gaube auf der Südseite des Palasdachs (Satteldach quer zum First).
function palasDormer(b, x, top, z2) {
  const z = z2 - 1;
  for (let dx = 0; dx <= 2; dx++) {
    for (let y = top + 1; y <= top + 3; y++) {
      const shell = dx !== 1 || y === top + 3;
      b.set(x + dx, y, z, shell ? 'stone_bricks' : 'glass_pane');
      b.set(x + dx, y, z - 1, dx === 1 && y < top + 3 ? 'air' : 'stone_bricks');
    }
  }
  b.set(x + 1, top + 1, z + 1, 'stone_brick_stairs[facing=north,half=top]');
  for (let dz = 1; dz >= -2; dz--) {
    b.set(x - 1, top + 3, z + dz - 1 + 1, 'deepslate_tile_stairs[facing=east,half=bottom]');
    b.set(x, top + 4, z + dz, 'deepslate_tile_stairs[facing=east,half=bottom]');
    b.set(x + 1, top + 4, z + dz, 'deepslate_tile_slab[type=top]');
    b.set(x + 1, top + 5, z + dz, 'deepslate_tile_slab[type=bottom]');
    b.set(x + 2, top + 4, z + dz, 'deepslate_tile_stairs[facing=west,half=bottom]');
    b.set(x + 3, top + 3, z + dz, 'deepslate_tile_stairs[facing=west,half=bottom]');
  }
}

function palasInterior(b) {
  const { x1, x2, z1, z2, hall, upper, top } = PALAS;
  // Erdgeschoss: Küche, Vorräte, Werkstatt.
  kitchen(b, { x: x1 + 1, y: 16, z: z1 + 1, facing: 'south', width: 7, wood: 'fichte' });
  diningTable(b, { x: x1 + 2, y: 16, z: z1 + 5, facing: 'south', length: 4, width: 1, wood: 'fichte', headChairs: false });
  storage(b, { x: 14, y: 16, z: z1 + 1, facing: 'south', width: 8, height: 2, barrel: true });
  workshop(b, { x: 15, y: 16, z: z2 - 1, facing: 'north', width: 6, wood: 'fichte', shelves: true });
  for (let y = 16; y <= hall; y++) b.set(x2 - 1, y, -55, y === hall ? 'ladder[facing=west]' : 'ladder[facing=west]');
  // Rittersaal: Tafel, Kamine, Thron, Kronleuchter, Banner.
  diningTable(b, { x: 1, y: hall + 1, z: -55, facing: 'south', length: 14, width: 2, wood: 'schwarzeiche', top: 'carpet', cloth: 'rot' });
  for (const cx of [2, 15]) fireplace(b, { x: cx, y: hall + 1, z: z1 + 1, facing: 'south', height: upper - hall });
  for (let z = z1 + 3; z <= z2 - 2; z++) b.set(x2 - 3, hall + 1, z, 'red_carpet');
  b.set(x2 - 2, hall + 1, -55, 'polished_andesite_slab[type=bottom]');
  b.set(x2 - 2, hall + 1, -54, 'polished_andesite_slab[type=bottom]');
  b.set(x2 - 1, hall + 1, -55, 'dark_oak_stairs[facing=east,half=bottom]');
  b.set(x2 - 1, hall + 1, -54, 'dark_oak_stairs[facing=east,half=bottom]');
  b.set(x2 - 1, hall + 2, -56, 'gold_block');
  b.set(x2 - 1, hall + 2, -53, 'gold_block');
  for (const z of [z1 + 1, z2 - 1]) for (const x of [-4, 5, 9, 13, 19]) b.set(x, hall + 4, z, `${(x % 2 === 0 ? COLOR.rot : COLOR.gelb).wallBanner}[facing=${z === z1 + 1 ? 'south' : 'north'}]`);
  for (const x of [0, 5, 10, 15, 20]) hangingLantern(b, { x, y: upper - 1, z: -55, chain: 1 });
  // Obergeschoss: Kemenaten und Bibliothek.
  bedroom(b, { x: x1 + 1, y: upper + 1, z: z1 + 1, facing: 'south', width: 5, depth: 5, wood: 'schwarzeiche', color: 'rot', rug: 'weiss', double: true });
  bookWall(b, { x: 7, y: upper + 1, z: z1 + 1, facing: 'south', width: 6, height: 3 });
  diningTable(b, { x: 8, y: upper + 1, z: -55, facing: 'south', length: 3, width: 1, wood: 'schwarzeiche', headChairs: false });
  bedroom(b, { x: 16, y: upper + 1, z: z1 + 1, facing: 'south', width: 5, depth: 4, wood: 'schwarzeiche', color: 'blau', rug: 'hellblau' });
  for (let y = hall + 1; y <= upper; y++) b.set(x2 - 1, y, -55, 'ladder[facing=west]');
  for (let y = upper + 1; y < top; y++) b.set(x2 - 1, y, -57, 'air');
  lightRoom(b, { x1: x1 + 1, y1: 16, z1: z1 + 1, x2: x2 - 1, y2: hall - 1, z2: z2 - 1 });
  lightRoom(b, { x1: x1 + 1, y1: hall + 1, z1: z1 + 1, x2: x2 - 1, y2: upper - 1, z2: z2 - 1 });
  lightRoom(b, { x1: x1 + 1, y1: upper + 1, z1: z1 + 1, x2: x2 - 1, y2: top - 1, z2: z2 - 1 });
}

// Treppenturm vor dem Palas: Leiter innen, Türen in jedes Geschoss, Kegeldach.
function stairTower(b) {
  const cx = 9;
  const cz = -47;
  const top = 37;
  const { shell, inner } = discCells(2);
  for (const [dx, dz] of shell) for (let y = 16; y <= top; y++) if (cz + dz > PALAS.z2) b.set(cx + dx, y, cz + dz, palasStone(cx + dx, y, cz + dz));
  for (const [dx, dz] of inner) {
    b.set(cx + dx, 15, cz + dz, 'stone_bricks');
    for (let y = 16; y < top; y++) b.set(cx + dx, y, cz + dz, 'air');
    b.set(cx + dx, top, cz + dz, 'spruce_planks');
  }
  for (let y = 16; y < top; y++) b.set(cx, y, cz + 1, 'ladder[facing=north]');
  for (const y of [PALAS.upper + 1]) {
    b.set(cx, y, PALAS.z2, 'air');
    b.set(cx, y + 1, PALAS.z2, 'air');
  }
  doorway(b, { x: cx + 2, y: 16, z: cz, facing: 'east', door: 'spruce_door', frame: null });
  for (const y of [22, 30]) b.set(cx, y + 1, cz + 2, 'glass_pane');
  for (const y of [26, 33]) b.set(cx - 2, y, cz, 'glass_pane');
  rectCrownRound(b, cx, cz, 2, top);
  coneRoof(b, { x: cx, z: cz, y: top + 2, r: 3, slope: 2.4, tip: 'gelb', set: ROOF_SETS.schiefer, salt: 113 });
  lightRoom(b, { x1: cx - 1, y1: 16, z1: cz - 1, x2: cx + 1, y2: top - 1, z2: cz + 1 });
}

function rectCrownRound(b, cx, cz, r, top) {
  for (const [dx, dz] of discCells(r + 1).shell) {
    b.set(cx + dx, top, cz + dz, `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=top]`);
    b.set(cx + dx, top + 1, cz + dz, wallStone(cx + dx, top + 1, cz + dz, 15));
  }
}

// ------------------------------------------------------------------ Bausteine: Dächer als Höhenfeld

const OPP = { north: 'south', south: 'north', east: 'west', west: 'east' };

// Dachsätze: [Treppe, Vollblock, Stufe] mit Gewicht; Flecken aus mehreren Sätzen wirken wie alte Ziegel.
const ROOF_SETS = {
  ziegel: [[['brick_stairs', 'bricks', 'brick_slab'], 12], [['granite_stairs', 'granite', 'granite_slab'], 2], [['mud_brick_stairs', 'mud_bricks', 'mud_brick_slab'], 1]],
  schiefer: [[['deepslate_tile_stairs', 'deepslate_tiles', 'deepslate_tile_slab'], 10], [['deepslate_brick_stairs', 'deepslate_bricks', 'deepslate_brick_slab'], 3], [['cobbled_deepslate_stairs', 'cobbled_deepslate', 'cobbled_deepslate_slab'], 2]],
  holz: [[['spruce_stairs', 'spruce_planks', 'spruce_slab'], 8], [['dark_oak_stairs', 'dark_oak_planks', 'dark_oak_slab'], 3]],
  granit: [[['polished_granite_stairs', 'polished_granite', 'polished_granite_slab'], 6], [['granite_stairs', 'granite', 'granite_slab'], 3], [['brick_stairs', 'bricks', 'brick_slab'], 1]],
  glasur: [[['red_nether_brick_stairs', 'red_nether_bricks', 'red_nether_brick_slab'], 6], [['brick_stairs', 'bricks', 'brick_slab'], 3], [['nether_brick_stairs', 'nether_bricks', 'nether_brick_slab'], 1]],
  kupfer: [[['waxed_oxidized_cut_copper_stairs', 'waxed_oxidized_cut_copper', 'waxed_oxidized_cut_copper_slab'], 7], [['waxed_weathered_cut_copper_stairs', 'waxed_weathered_cut_copper', 'waxed_weathered_cut_copper_slab'], 2]],
};

// Dachfläche { type: 'gable' | 'hip', axis (Firstrichtung), x1, x2, z1, z2 (mit Überstand), eave, slope }:
// Spalte im Abstand k vom Rand liegt auf eave + slope·k. Liefert null außerhalb.
function roofCell(r, x, z) {
  if (x < r.x1 || x > r.x2 || z < r.z1 || z > r.z2) return null;
  let k;
  let ridge;
  let down;
  if (r.type === 'hip') {
    const dW = x - r.x1;
    const dE = r.x2 - x;
    const dN = z - r.z1;
    const dS = r.z2 - z;
    k = Math.min(dW, dE, dN, dS);
    ridge = (dN === k && dS === k) || (dW === k && dE === k);
    if (dN === k && dW === k) down = 'west';
    else if (dN === k && dE === k) down = 'north';
    else if (dS === k && dE === k) down = 'east';
    else if (dS === k && dW === k) down = 'south';
    else if (dN === k) down = 'north';
    else if (dS === k) down = 'south';
    else if (dW === k) down = 'west';
    else down = 'east';
  } else {
    const alongX = r.axis === 'x';
    const lo = alongX ? r.z1 : r.x1;
    const hi = alongX ? r.z2 : r.x2;
    const a = alongX ? z : x;
    k = Math.min(a - lo, hi - a);
    ridge = a - lo === hi - a;
    if (alongX) down = a - lo < hi - a ? 'north' : 'south';
    else down = a - lo < hi - a ? 'west' : 'east';
  }
  const s = r.slope;
  const level = r.eave + s * k;
  return { r, k, ridge, down, level, bottom: ridge ? level - (s - 1) : level, top: ridge ? level + (s >= 2 ? 1 : 0) : level + s - 1 };
}

// Höchste Dachfläche über (x, z).
function topCell(roofs, x, z) {
  let best = null;
  for (const r of roofs) {
    const c = roofCell(r, x, z);
    if (c && (!best || c.top > best.top)) best = c;
  }
  return best;
}

function pickRoof(set, x, z, salt) {
  const v = Math.min(0.999, Math.max(0, noise2(x, z, 2.2, salt) * 0.75 + rand01(x, 0, z, salt + 1) * 0.25));
  return weighted(set, v);
}

// Eine Dachspalte: bei slope ≥ 2 obere Treppe talseitig, Vollblöcke, untere Treppe bergseitig; First mit Stufe.
function roofColumn(b, c, x, z, [st, full, slab]) {
  const s = c.r.slope;
  if (c.ridge) {
    for (let y = c.level - (s - 1); y < c.level; y++) b.set(x, y, z, full);
    if (s === 1) b.set(x, c.level, z, `${slab}[type=bottom]`);
    else {
      b.set(x, c.level, z, full);
      b.set(x, c.level + 1, z, `${slab}[type=bottom]`);
    }
    return;
  }
  const up = OPP[c.down];
  if (s === 1) {
    b.set(x, c.level, z, `${st}[facing=${up},half=bottom]`);
    return;
  }
  b.set(x, c.level, z, `${st}[facing=${c.down},half=top]`);
  for (let t = 1; t < s - 1; t++) b.set(x, c.level + t, z, full);
  b.set(x, c.level + s - 1, z, `${st}[facing=${up},half=bottom]`);
}

// Alle Flächen zeichnen (je Zelle die höchste). keep(x, z, c) kann Zellen auslassen.
function drawRoofs(b, roofs, set, salt, ox = 0, oz = 0, keep = () => true) {
  const x1 = Math.min(...roofs.map((r) => r.x1));
  const x2 = Math.max(...roofs.map((r) => r.x2));
  const z1 = Math.min(...roofs.map((r) => r.z1));
  const z2 = Math.max(...roofs.map((r) => r.z2));
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) {
      const c = topCell(roofs, x, z);
      if (!c || !keep(x, z, c)) continue;
      roofColumn(b, c, x, z, pickRoof(set, x + ox, z + oz, salt));
    }
  }
}

// Wandfläche unter dem Dach schließen: von y0 bis unter die unterste Dachreihe.
function fillUnderRoof(b, roofs, x, z, y0, state) {
  const c = topCell(roofs, x, z);
  if (!c) return;
  for (let y = y0; y < c.bottom; y++) b.set(x, y, z, state(y - y0 + 1, c));
}

// ------------------------------------------------------------------ Bausteine: Fachwerk und Mauerwerk

const FRAMES = {
  dunkel: { log: 'stripped_dark_oak_log', wood: 'stripped_dark_oak_wood', planks: 'dark_oak_planks', stairs: 'dark_oak_stairs', slab: 'dark_oak_slab', trapdoor: 'dark_oak_trapdoor', door: 'dark_oak_door', fence: 'dark_oak_fence', lib: 'schwarzeiche' },
  rinde: { log: 'dark_oak_log', wood: 'dark_oak_wood', planks: 'dark_oak_planks', stairs: 'dark_oak_stairs', slab: 'dark_oak_slab', trapdoor: 'spruce_trapdoor', door: 'spruce_door', fence: 'dark_oak_fence', lib: 'schwarzeiche' },
  fichte: { log: 'stripped_spruce_log', wood: 'stripped_spruce_wood', planks: 'spruce_planks', stairs: 'spruce_stairs', slab: 'spruce_slab', trapdoor: 'spruce_trapdoor', door: 'spruce_door', fence: 'spruce_fence', lib: 'fichte' },
  rot: { log: 'stripped_mangrove_log', wood: 'stripped_mangrove_wood', planks: 'mangrove_planks', stairs: 'mangrove_stairs', slab: 'mangrove_slab', trapdoor: 'mangrove_trapdoor', door: 'mangrove_door', fence: 'mangrove_fence', lib: 'mangrove' },
};

const MASONRY = {
  bruch: { entries: [['cobblestone', 4], ['stone_bricks', 4], ['andesite', 2], ['mossy_cobblestone', 1], ['mossy_stone_bricks', 1]], quoin: ['stone_bricks', 'polished_andesite'], stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', wall: 'stone_brick_wall', trim: 'polished_andesite' },
  ziegel: { entries: [['bricks', 14], ['granite', 1]], quoin: ['stone_bricks', 'polished_andesite'], stairs: 'brick_stairs', slab: 'brick_slab', wall: 'brick_wall', trim: 'stone_bricks' },
  tuff: { entries: [['tuff_bricks', 8], ['polished_tuff', 2], ['tuff', 1]], quoin: ['polished_tuff', 'chiseled_tuff_bricks'], stairs: 'tuff_brick_stairs', slab: 'tuff_brick_slab', wall: 'tuff_brick_wall', trim: 'polished_tuff' },
  sand: { entries: [['smooth_sandstone', 6], ['sandstone', 2], ['cut_sandstone', 2]], quoin: ['cut_sandstone', 'smooth_sandstone'], stairs: 'smooth_sandstone_stairs', slab: 'smooth_sandstone_slab', wall: 'sandstone_wall', trim: 'cut_sandstone' },
};

const HOUSE_FILLS = [
  ['calcite', 5], ['white_terracotta', 4], ['mushroom_stem', 2], ['smooth_sandstone', 2], ['yellow_terracotta', 1], ['packed_mud', 2],
  ['pink_terracotta', 1], ['light_blue_terracotta', 1], ['birch_planks', 1],
];
const FRAME_WEIGHTS = [['dunkel', 6], ['rinde', 3], ['fichte', 3], ['rot', 1]];
const ROOF_WEIGHTS = [['ziegel', 6], ['schiefer', 4], ['holz', 2], ['granit', 2], ['glasur', 1]];

// Gefache einer Wand von Ecke zu Ecke: 'P' Ständer/Pfeiler, 'W' Fenster, 'F' Feld, 'D' Tür, 'O' Ladenöffnung.
// Fassade: Einheiten 'WP' und 'WWP' (symmetrisch bevorzugt); fields: mittlere kurze Einheit als Feld.
function compositions(n, parts) {
  const out = [];
  const rec = (rest, acc) => {
    if (out.length > 400) return;
    if (rest === 0) out.push(acc.slice());
    for (const p of parts) {
      if (p > rest) continue;
      acc.push(p);
      rec(rest - p, acc);
      acc.pop();
    }
  };
  rec(n, []);
  return out;
}

function choose(list, salt, a = 0, c = 0) {
  return list[Math.floor(rand01(a, list.length, c, salt) * list.length) % list.length];
}

function bayPattern(len, salt, fields = false) {
  if (len < 3) return 'P'.repeat(len);
  const all = compositions(len - 1, [2, 3]);
  const sym = all.filter((o) => o.join() === [...o].reverse().join());
  const pick = choose(sym.length ? sym : all, salt, len);
  let s = 'P';
  pick.forEach((p, i) => {
    const middle = fields && pick.length >= 3 && i === Math.floor(pick.length / 2) && p === 2 && pick.length % 2 === 1;
    s += `${p === 2 ? (middle ? 'F' : 'W') : 'WW'}P`;
  });
  return s;
}

// Geschlossene Wand: Ständer alle 3–4 Felder, dazwischen ausgesteifte Felder.
function fieldPattern(len, salt) {
  if (len < 3) return 'P'.repeat(len);
  const all = compositions(len - 1, [3, 4, 2]).filter((o) => o.every((p) => p >= 3) || len - 1 < 6);
  const sym = all.filter((o) => o.join() === [...o].reverse().join());
  const pick = choose(sym.length ? sym : all, salt, len, 1);
  return `P${pick.map((p) => `${'F'.repeat(p - 1)}P`).join('')}`;
}

// Sichtbare Seitenwand: Fenster in der Mitte, Felder an den Ecken.
function sidePattern(len, salt) {
  const s = bayPattern(len, salt, true).split('');
  const posts = s.map((c, i) => (c === 'P' ? i : -1)).filter((i) => i >= 0);
  if (posts.length >= 4) {
    for (let i = posts[0] + 1; i < posts[1]; i++) s[i] = 'F';
    for (let i = posts[posts.length - 2] + 1; i < posts[posts.length - 1]; i++) s[i] = 'F';
  }
  return s.join('');
}

// Rückwand: Felder, ein Fenster in der mittleren Einheit (nie neben der Leiter-Ecke).
function backPattern(len, salt) {
  const s = bayPattern(len, salt + 3).split('');
  const posts = s.map((c, i) => (c === 'P' ? i : -1)).filter((i) => i >= 0);
  const mid = Math.floor((posts.length - 1) / 2);
  for (let k = 0; k < posts.length - 1; k++) {
    if (k === mid && posts.length >= 4) continue;
    for (let i = posts[k] + 1; i < posts[k + 1]; i++) s[i] = 'F';
  }
  return s.join('');
}

function runsOf(pattern, ch) {
  const out = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== ch) continue;
    let j = i;
    while (j + 1 < pattern.length && pattern[j + 1] === ch) j++;
    out.push([i, j]);
    i = j;
  }
  return out;
}

// Wände eines Hauses (lokal): je Seite Lage, Richtung nach außen und Laufrichtung der Gefache.
function houseSides(w, f) {
  return [
    { name: 'front', len: w, at: (u) => [u, f], out: 'south', run: 'east', axis: 'x' },
    { name: 'back', len: w, at: (u) => [w - 1 - u, 0], out: 'north', run: 'west', axis: 'x' },
    { name: 'left', len: f + 1, at: (u) => [0, f - u], out: 'west', run: 'north', axis: 'z' },
    { name: 'right', len: f + 1, at: (u) => [w - 1, u], out: 'east', run: 'south', axis: 'z' },
  ];
}

const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const outCell = (side, u, k) => {
  const [x, z] = side.at(u);
  const [dx, dz] = STEP[side.out];
  return [x + dx * k, z + dz * k];
};

function masonryAt(h, x, y, z) {
  return patch(h.mas.entries, x + h.ox, y, z + h.oz, h.salt + 5, 2.5);
}

// Zelle einer Geschosswand. st.mat 'timber' | 'stone'; Fenster liegen in den oberen Reihen.
function storyCell(h, st, side, u, r, c, x, z) {
  const y = st.base + r;
  const corner = u === 0 || u === side.len - 1;
  const stone = (st.mats?.[side.name] ?? st.mat) === 'stone';
  const wallBlock = () => (stone ? (corner ? h.mas.quoin[(y + (side.axis === 'x' ? 0 : 1)) % 2] : masonryAt(h, x, y, z)) : h.fill);
  const top = r === st.rows;
  switch (c) {
    case 'P':
      return stone ? wallBlock() : `${h.frame.log}[axis=y]`;
    case 'W': {
      const lo = st.win?.[0] ?? (st.rows >= 4 && !st.ground && stone ? 1 : 2);
      const hi = st.win?.[1] ?? (st.rows >= 4 ? 3 : st.rows);
      if (r >= lo && r <= hi) return st.ground && h.bars ? 'iron_bars' : 'glass_pane';
      if (top && st.rows >= 4) return stone ? 'lintel' : `${h.frame.log}[axis=${side.axis}]`;
      return wallBlock();
    }
    case 'D':
      if (r <= 2) return 'door';
      if (r === 3) return stone || st.ground ? (h.stone ? h.mas.trim : `${h.frame.log}[axis=${side.axis}]`) : wallBlock();
      return wallBlock();
    case 'O':
      if (r === 1) return `${h.frame.slab}[type=top]`;
      if (r < st.rows) return 'air';
      return `${h.frame.log}[axis=${side.axis}]`;
    default:
      return wallBlock();
  }
}

// Ein Geschoss: Schwelle/Gesims, Wände mit Fenstern, Streben in den Feldern, Boden und Luft innen.
function drawStory(b, h, st) {
  const { w } = h;
  const f = st.front;
  for (const side of houseSides(w, f)) {
    const pat = st.bays[side.name];
    const sideMat = st.mats?.[side.name] ?? st.mat;
    for (let u = 0; u < side.len; u++) {
      const [x, z] = side.at(u);
      if (st.ground || sideMat === 'stone') b.set(x, st.base, z, st.ground ? masonryAt(h, x, st.base, z) : h.mas.trim);
      else b.set(x, st.base, z, `${h.frame.log}[axis=${side.axis}]`);
      for (let r = 1; r <= st.rows; r++) {
        const state = storyCell(h, st, side, u, r, pat[u], x, z);
        if (state === 'door') continue;
        if (state === 'lintel') {
          const run = runsOf(pat, 'W').find(([a, c]) => u >= a && u <= c);
          if (run && run[1] - run[0] === 1) b.set(x, st.base + r, z, `${h.mas.stairs}[facing=${u === run[0] ? OPP[side.run] : side.run},half=top]`);
          else b.set(x, st.base + r, z, h.mas.trim);
          continue;
        }
        b.set(x, st.base + r, z, state);
      }
    }
    // Streben (Fachwerk): Diagonale aus geschältem Holz, hohe Seite zur nächsten Ecke.
    if (sideMat !== 'stone') {
      for (const [u0, u1] of runsOf(pat, 'F')) {
        const L = u1 - u0 + 1;
        if (L === 1) {
          if (st.rows >= 3) {
            const [x, z] = side.at(u0);
            b.set(x, st.base + 2, z, `${h.frame.log}[axis=${side.axis}]`);
          }
          continue;
        }
        const towardStart = (u0 + u1) / 2 < (side.len - 1) / 2;
        for (let r = 1; r <= st.rows; r++) {
          const t = st.rows === 1 ? 0 : (r - 1) / (st.rows - 1);
          const step = Math.round(t * (L - 1));
          const u = towardStart ? u1 - step : u0 + step;
          const [x, z] = side.at(u);
          b.set(x, st.base + r, z, h.frame.wood);
        }
      }
    }
  }
  // Boden und Luft.
  for (let x = 1; x < w - 1; x++) {
    for (let z = 1; z < f; z++) {
      b.set(x, st.base, z, st.ground ? (h.shop ? patch([['spruce_planks', 3], ['stone_bricks', 0.5]], x + h.ox, 0, z + h.oz, h.salt) : h.floor) : h.floor);
      for (let y = st.base + 1; y <= st.base + st.rows; y++) b.set(x, y, z, 'air');
    }
  }
}

// Fensterläden oder Blumenkästen vor den Fenstern einer Seite.
function windowDeco(b, h, st, side) {
  const pat = st.bays[side.name];
  for (const [u0, u1] of runsOf(pat, 'W')) {
    const yLo = st.base + 2;
    if (h.deco === 'flowers' && st.base === h.H0) {
      for (let u = u0; u <= u1; u++) {
        const [x, z] = outCell(side, u, 1);
        const [fx, fz] = outCell(side, u, 2);
        b.set(x, st.base + 1, z, 'rooted_dirt');
        b.set(x, st.base + 2, z, choose(['red_tulip', 'poppy', 'azure_bluet', 'cornflower', 'oxeye_daisy', 'allium', 'pink_tulip', 'lily_of_the_valley'], h.salt + 41, x * 3 + u, z + st.base));
        b.set(fx, st.base + 1, fz, `${h.frame.trapdoor}[facing=${side.out},half=bottom,open=true]`);
      }
      const [ax, az] = outCell(side, u0 - 1, 1);
      const [bx, bz] = outCell(side, u1 + 1, 1);
      b.set(ax, st.base + 1, az, `${h.frame.trapdoor}[facing=${OPP[side.run]},half=bottom,open=true]`);
      b.set(bx, st.base + 1, bz, `${h.frame.trapdoor}[facing=${side.run},half=bottom,open=true]`);
    } else if (h.deco === 'shutters' || (st.mat === 'stone' && h.deco !== 'flowers')) {
      for (let y = yLo; y <= yLo + 1; y++) {
        for (const u of [u0 - 1, u1 + 1]) {
          const [x, z] = outCell(side, u, 1);
          b.set(x, y, z, `${h.frame.trapdoor}[facing=${side.out},half=bottom,open=true]`);
        }
      }
    }
    if (st.mat === 'stone' && !st.ground) {
      for (let u = u0; u <= u1; u++) {
        const [x, z] = outCell(side, u, 1);
        b.set(x, st.base + (st.rows >= 4 ? 0 : 1), z, `${h.mas.stairs}[facing=${OPP[side.out]},half=top]`);
      }
    }
  }
}

// ------------------------------------------------------------------ Stadthaus

// Lage eines Grundstücks: x, z = Nordwest-Ecke (Welt), w = Frontbreite, d = Tiefe, facing = Blickrichtung der Front.
function plotTransform(p) {
  const { x, z, y, w, d, facing } = p;
  if (facing === 'south') return { rotate: 0, offset: [x, y, z] };
  if (facing === 'north') return { rotate: 180, offset: [x + w - 1, y, z + d - 1] };
  if (facing === 'west') return { rotate: 90, offset: [x + d - 1, y, z] };
  return { rotate: 270, offset: [x, y, z + w - 1] };
}

function houseSpec(p) {
  const rnd = (salt) => rand01(p.x * 3 + 1, p.y, p.z * 5 + 2, 700 + salt);
  const pick = (entries, salt) => weighted(entries, rnd(salt));
  const type = p.type ?? (rnd(1) < 0.16 && p.w >= 6 ? 'stein' : (p.w >= 9 && rnd(2) < 0.6 ? 'traufe' : 'giebel'));
  const stone = type === 'stein';
  const [minUp, maxUp] = p.uppers ?? [1, 2];
  const uppers = minUp + Math.min(maxUp - minUp, Math.floor(rnd(3) * (maxUp - minUp + 1)));
  const shop = p.shop ?? rnd(9) < 0.42;
  const doorU = p.doorU ?? (shop ? (rnd(12) < 0.5 ? 1 : p.w - 2) : (p.w % 2 === 1 && rnd(12) < 0.5 ? (p.w - 1) / 2 : (rnd(13) < 0.5 ? 1 : p.w - 2)));
  return {
    ...p,
    type,
    stone,
    gable: type === 'traufe' ? 'side' : 'front',
    uppers,
    H0: 5,
    H: stone ? 5 : 4,
    jet: stone ? 0 : (p.jet ?? 1),
    jet2: !stone && uppers >= 2 && (p.jet2 ?? rnd(14) < 0.35),
    gableJet: !stone && type !== 'traufe' && (p.gableJet ?? rnd(15) < 0.45) && !(uppers >= 2 && (p.jet2 ?? rnd(14) < 0.35)),
    frame: FRAMES[p.frame ?? pick(FRAME_WEIGHTS, 4)],
    fill: p.fill ?? pick(HOUSE_FILLS, 5),
    mas: MASONRY[p.mas ?? (stone ? pick([['ziegel', 3], ['tuff', 2], ['bruch', 2], ['sand', 1]], 6) : pick([['bruch', 8], ['ziegel', 2], ['tuff', 1]], 6))],
    groundMat: stone ? 'stone' : (rnd(7) < 0.18 ? 'timber' : 'stone'),
    roofSet: ROOF_SETS[p.roof ?? pick(ROOF_WEIGHTS, 8)],
    shop,
    goods: p.goods ?? choose(['baecker', 'gemuese', 'tuch', 'schmied', 'toepfer', 'wein', 'kraeuter'], 700 + 16, p.x, p.z),
    doorU,
    deco: p.deco ?? (rnd(10) < 0.22 ? 'flowers' : (rnd(11) < 0.55 ? 'shutters' : null)),
    bars: rnd(17) < 0.3,
    floor: p.floorBlock ?? (rnd(18) < 0.5 ? 'spruce_planks' : 'oak_planks'),
    cross: p.cross ?? (type === 'traufe' && p.w >= 9 ? (p.w >= 11 && rnd(19) < 0.5 ? 2 : 1) : 0),
    chimney: p.chimney ?? rnd(20) < 0.7,
    salt: 1000 + Math.floor(rnd(21) * 9000),
    ox: p.x,
    oz: p.z,
  };
}

function groundPattern(h) {
  const { w, doorU } = h;
  let s = '';
  for (let u = 0; u < w; u++) {
    if (u === 0 || u === w - 1) s += 'P';
    else if (u === doorU) s += 'D';
    else if (h.shop && Math.abs(u - doorU) >= 2 && !(doorU === 1 ? u === w - 1 : u === 0)) s += 'O';
    else if (!h.shop && (u - doorU) % 2 === 0) s += 'W';
    else s += 'P';
  }
  return s;
}

function townHouse(b, p) {
  const h = houseSpec(p);
  const t = plotTransform(p);
  b.step();
  b.transform(t, () => drawHouse(b, h));
}

function drawHouse(b, h) {
  const { w, d, uppers } = h;
  const stories = [];
  const nbL = h.nbL;
  const nbR = h.nbR;
  const sideBays = (len, i, isNb) => (isNb ? fieldPattern(len, h.salt + i) : sidePattern(len, h.salt + i * 7));
  stories.push({
    base: 0, rows: h.H0 - 1, front: d - 1, mat: h.groundMat, ground: true,
    bays: { front: groundPattern(h), back: backPattern(w, h.salt), left: sideBays(d, 0, nbL), right: sideBays(d, 1, nbR) },
  });
  for (let i = 1; i <= uppers; i++) {
    const front = d - 1 + (h.jet ? 1 : 0) + (h.jet2 && i >= 2 ? 1 : 0);
    const frontBays = h.stone ? bayPattern(w, h.salt + 77) : bayPattern(w, h.salt + 11 * i, i % 2 === 0);
    stories.push({
      base: h.H0 + (i - 1) * h.H, rows: h.H - 1, front, mat: h.stone ? 'stone' : 'timber',
      bays: { front: frontBays, back: backPattern(w, h.salt + i), left: sideBays(front + 1, 2 * i, nbL), right: sideBays(front + 1, 2 * i + 1, nbR) },
    });
  }
  const top = h.H0 + uppers * h.H;
  const fTop = stories[stories.length - 1].front;
  const fA = fTop + (h.gableJet ? 1 : 0);
  for (const st of stories) drawStory(b, h, st);

  // Tür, Laden, Knaggen unter den Auskragungen.
  const door = h.doorU;
  b.door(door, 1, d - 1, h.frame.door, { facing: 'north', hinge: door < w / 2 ? 'left' : 'right' });
  b.set(door, 0, d - 1, h.mas.trim);
  for (let i = 1; i < stories.length; i++) {
    const st = stories[i];
    if (st.front === stories[i - 1].front) continue;
    const pat = st.bays.front;
    for (let u = 0; u < w; u++) if (pat[u] === 'P') b.set(u, st.base - 1, st.front, `${h.frame.stairs}[facing=north,half=top]`);
  }
  if (h.gableJet) {
    const mid = Math.floor((w - 1) / 2);
    for (const u of new Set([0, w - 1, mid, w - 1 - mid])) b.set(u, top - 1, fA, `${h.frame.stairs}[facing=north,half=top]`);
  }
  for (const st of stories) {
    for (const side of houseSides(w, st.front)) {
      if (side.name === 'back' || (side.name === 'left' && nbL) || (side.name === 'right' && nbR)) continue;
      windowDeco(b, h, st, side);
    }
  }
  if (h.shop) shopFront(b, h, stories[0]);
  else wallLantern(b, { x: door + (door < w / 2 ? 1 : -1), y: 3, z: d - 1, facing: 'south', style: 'bracket', arm: h.frame.fence });

  // Dachboden: Rähm, Boden, Giebel und Dach.
  for (const side of houseSides(w, fA)) {
    for (let u = 0; u < side.len; u++) {
      const [x, z] = side.at(u);
      b.set(x, top, z, h.stone ? h.mas.trim : `${h.frame.log}[axis=${side.axis}]`);
    }
  }
  for (let x = 1; x < w - 1; x++) for (let z = 1; z < fA; z++) b.set(x, top, z, h.floor);
  const ovL = nbL ? 0 : 1;
  const ovR = nbR ? 0 : 1;
  const roofs = [];
  let main;
  if (h.gable === 'front') main = { type: 'gable', axis: 'z', x1: -ovL, x2: w - 1 + ovR, z1: -1, z2: fA + (h.stone ? 0 : 1), eave: top, slope: 2 };
  else main = { type: 'gable', axis: 'x', x1: -ovL, x2: w - 1 + ovR, z1: -1, z2: fA + 1, eave: top, slope: 2 };
  roofs.push(main);
  const timberGable = (u, len, axis) => (hh) => gableTimber(h, u, hh, len, axis);
  const stoneGable = (u, len) => (hh) => (Math.abs(u - (len - 1) / 2) < 1 && hh >= 2 && hh <= 3 ? 'glass_pane' : masonryAt(h, u, top + hh, len));
  for (const side of houseSides(w, fA)) {
    const gableSide = h.gable === 'front' ? side.name === 'front' || side.name === 'back' : side.name === 'left' || side.name === 'right';
    for (let u = 0; u < side.len; u++) {
      const [x, z] = side.at(u);
      let state;
      if (!gableSide) state = h.stone ? () => masonryAt(h, x, top + 1, z) : () => h.fill;
      else if (h.stone || side.name === 'back' || (side.name === 'left' && nbL) || (side.name === 'right' && nbR)) state = h.stone ? stoneGable(u, side.len) : () => h.fill;
      else state = timberGable(u, side.len, side.axis);
      fillUnderRoof(b, roofs, x, z, top + 1, state);
    }
  }
  drawRoofs(b, roofs, h.roofSet, h.salt + 9, h.ox, h.oz);
  if (h.stone) steppedGable(b, h, roofs, top, fA);
  if (h.cross) crossGable(b, h, main, top, fA);
  if (h.chimney) {
    const cx = h.gable === 'front' ? (nbR ? 1 : w - 2) : (h.salt % 2 === 0 ? 1 : w - 2);
    const cz = h.gable === 'front' ? 2 : Math.max(1, Math.floor((fA + 1) / 2) - 1);
    const c = topCell(roofs, cx, cz);
    if (c) chimney(b, { x: cx, y: top + 1, z: cz, height: c.top - top + 2, block: h.salt % 3 === 0 ? 'cobblestone' : 'bricks' });
  }
  houseInterior(b, h, stories, top, fA);
}

// Fachwerk im Giebel: Kehlbalken alle 4 Ebenen, Firstständer in der Mitte, Fenster unten seitlich und oben mittig.
function gableTimber(h, u, hh, len, axis = 'x') {
  const mid = (len - 1) / 2;
  const du = Math.abs(u - mid);
  if (hh % 4 === 0) return `${h.frame.log}[axis=${axis}]`;
  if (du < 1) {
    if (len >= 7 && hh >= 5 && hh <= 6) return 'glass_pane';
    return `${h.frame.log}[axis=y]`;
  }
  if (len >= 7 && Math.abs(du - 2) < 0.6 && hh <= 2) return 'glass_pane';
  if (len < 7 && len >= 5 && Math.abs(du - 1) < 0.6 && hh <= 2) return 'glass_pane';
  if (hh === 1 && (u === 1 || u === len - 2) && len >= 9) return h.frame.wood;
  return h.fill;
}

// Treppengiebel aus Mauerwerk vor dem Dach: jede Spalte eine Stufe, Abdeckplatten, Fiale in der Mitte.
function steppedGable(b, h, roofs, top, fA) {
  const { w } = h;
  let peak = top;
  for (let x = 0; x < w; x++) {
    const c = topCell(roofs, x, fA);
    const stepTop = Math.max(top + 1, (c ? c.top : top) + 1);
    for (let y = top + 1; y <= stepTop; y++) b.set(x, y, fA, x === 0 || x === w - 1 ? h.mas.quoin[y % 2] : masonryAt(h, x, y, fA));
    b.set(x, stepTop + 1, fA, `${h.mas.slab}[type=bottom]`);
    peak = Math.max(peak, stepTop);
    const mid = Math.abs(x - (w - 1) / 2) < 1;
    if (mid) {
      b.set(x, stepTop + 1, fA, h.mas.wall);
      b.set(x, stepTop + 2, fA, h.mas.wall);
    }
  }
  const mid = Math.floor((w - 1) / 2);
  for (let y = top + 2; y <= top + 3; y++) b.set(mid, y, fA, 'glass_pane');
  if (w >= 7) for (const x of [mid - 2, w - 1 - mid + 2]) b.set(x, top + 2, fA, 'glass_pane');
  void peak;
}

// Zwerchhaus mittig in der Traufseite: Fachwerkwand in der Fassadenebene, eigenes Satteldach bis in den Hauptfirst.
function crossGable(b, h, main, top, fA, cx = Math.floor((h.w - 1) / 2), r = h.cross) {
  const wallH = 3;
  const ridgeZ = Math.floor((main.z1 + main.z2) / 2);
  const cross = { type: 'gable', axis: 'z', x1: cx - r - 1, x2: cx + r + 1, z1: ridgeZ, z2: fA + 1, eave: top + wallH, slope: 2 };
  const both = [main, cross];
  for (let z = cross.z1; z <= cross.z2; z++) {
    for (let x = cross.x1; x <= cross.x2; x++) {
      const cc = roofCell(cross, x, z);
      const mc = roofCell(main, x, z);
      if (!cc || (mc && cc.top < mc.bottom)) continue;
      const inside = x > cx - r && x < cx + r;
      const cheek = x === cx - r || x === cx + r;
      if (z === fA + 1 && (inside || cheek)) for (let y = top; y <= top + 1; y++) b.set(x, y, z, 'air');
      if (inside && z <= fA) for (let y = top + 1; y < cc.bottom; y++) b.set(x, y, z, 'air');
      if (cheek && z < fA && mc) for (let y = mc.top + 1; y < cc.bottom; y++) b.set(x, y, z, h.fill);
      roofColumn(b, cc, x, z, pickRoof(h.roofSet, x + h.ox, z + h.oz, h.salt + 9));
    }
  }
  // Fassade des Zwerchhauses: Ständer, Fenster, darüber Giebel.
  const len = 2 * r + 1;
  for (let x = cx - r; x <= cx + r; x++) {
    const u = x - (cx - r);
    const cc = roofCell(cross, x, fA);
    for (let y = top + 1; y < cc.bottom; y++) {
      const hh = y - top;
      let state;
      if (hh <= wallH) {
        if (u === 0 || u === len - 1) state = `${h.frame.log}[axis=y]`;
        else if (hh === 1) state = h.fill;
        else state = 'glass_pane';
      } else if (hh === wallH + 1) state = `${h.frame.log}[axis=x]`;
      else state = Math.abs(u - r) < 1 ? `${h.frame.log}[axis=y]` : h.fill;
      b.set(x, y, fA, state);
    }
  }
  void both;
}

// Laden im Erdgeschoss: Theke in der Öffnung, Markise aus Falltüren, Waren, Wappen als Schild.
function shopFront(b, h, st) {
  const { w, d } = h;
  const pat = st.bays.front;
  const goods = {
    baecker: ['hay_block[axis=x]', 'barrel[facing=up]', 'cake', 'smoker[facing=south,lit=true]'],
    gemuese: ['pumpkin', 'melon', 'barrel[facing=up]', 'composter[level=7]', 'carved_pumpkin[facing=south]'],
    tuch: ['white_wool', 'red_wool', 'blue_wool', 'yellow_wool', 'loom[facing=south]'],
    schmied: ['anvil[facing=east]', 'grindstone[face=floor,facing=east]', 'blast_furnace[facing=south,lit=true]', 'smithing_table'],
    toepfer: ['decorated_pot[facing=south]', 'flower_pot', 'decorated_pot[facing=east]', 'terracotta'],
    wein: ['barrel[facing=south]', 'barrel[facing=up]', 'brewing_stand', 'barrel[facing=east]'],
    kraeuter: ['potted_fern', 'potted_red_tulip', 'brewing_stand', 'potted_azalea_bush', 'flower_pot'],
  }[h.goods];
  const banner = { baecker: 'gelb', gemuese: 'gruen', tuch: 'rot', schmied: 'schwarz', toepfer: 'orange', wein: 'violett', kraeuter: 'hellgruen' }[h.goods];
  const runs = runsOf(pat, 'O');
  for (const [u0, u1] of runs) {
    for (let u = u0; u <= u1; u++) {
      b.set(u, 3, d, `${h.frame.trapdoor}[facing=north,half=top,open=false]`);
      b.set(u, 1, d - 2, goods[(u + h.salt) % goods.length]);
      b.set(u, 2, d - 1, u % 2 === 0 ? 'air' : goods[(u * 3 + h.salt) % goods.length].includes('pot') ? 'flower_pot' : 'air');
    }
  }
  const bx = h.doorU < w / 2 ? h.doorU + 1 : h.doorU - 1;
  if (pat[bx] !== 'O') b.set(bx, 3, d, `${COLOR[banner].wallBanner}[facing=south]`);
  else wallLantern(b, { x: h.doorU, y: 3, z: d - 1, facing: 'south', style: 'shelf', shelf: h.frame.stairs });
}

// Einrichtung: Küche bzw. Laden unten, Kammern oben, Lager im Dach; Leiter in der hinteren Ecke, Licht in jedem Raum.
function houseInterior(b, h, stories, top, fA) {
  const { w } = h;
  const lx = w - 2;
  const wood = h.frame.lib === 'mangrove' ? 'mangrove' : h.frame.lib;
  for (let y = 1; y <= top; y++) b.set(lx, y, 1, 'ladder[facing=south]');
  const inner = w - 3;
  stories.forEach((st, i) => {
    const y = st.base + 1;
    const depth = st.front - 1;
    if (i === 0) {
      if (h.shop) {
        if (inner >= 2) storage(b, { x: 1, y, z: 1, facing: 'south', width: Math.min(inner, 6), height: 2, barrel: true });
        if (depth >= 5) b.set(1, y, depth - 1 > 3 ? 3 : 2, 'crafting_table');
      } else if (inner >= 4) {
        kitchen(b, { x: 1, y, z: 1, facing: 'south', width: Math.min(inner, 7), wood });
        if (depth >= 6 && inner >= 4) diningTable(b, { x: 2, y, z: 4, facing: 'south', length: Math.min(inner - 2, 4), width: 1, wood, headChairs: false });
      } else {
        b.set(1, y, 1, 'furnace[facing=south,lit=false]');
        if (inner >= 2) b.set(2, y, 1, 'barrel[facing=south]');
        b.set(1, y, 3, `${h.frame.slab}[type=top]`);
        b.set(1, y, 4, `${h.frame.stairs}[facing=south,half=bottom]`);
      }
    } else if (inner >= 3) {
      bedroom(b, { x: 1, y, z: 1, facing: 'south', width: inner, depth: Math.min(4, depth), wood, color: choose(['rot', 'blau', 'gruen', 'gelb', 'braun', 'hellblau'], h.salt + i), rug: depth >= 4 ? choose(['weiss', 'hellgrau', 'braun', 'rot'], h.salt + 2 * i) : null, double: i === 1 && inner >= 4 });
      if (depth >= 6) {
        b.set(1, y, depth - 1, `${h.frame.slab}[type=top]`);
        b.set(2, y, depth - 1, `${h.frame.stairs}[facing=east,half=bottom]`);
        b.set(1, y + 1, depth - 1, choose(['potted_red_tulip', 'potted_fern', 'candle[candles=2,lit=false]', 'potted_azalea_bush'], h.salt + i));
      }
    } else {
      b.bed(1, y, 2, `${COLOR.rot.bed}`, { facing: 'north' });
      b.set(1, y, 3, 'chest[facing=north,type=single]');
    }
    lightRoom(b, { x1: 1, y1: y, z1: 1, x2: w - 2, y2: st.base + st.rows, z2: depth });
  });
  if (w - 3 >= 2) storage(b, { x: 1, y: top + 1, z: 1, facing: 'south', width: Math.min(w - 3, 4), height: 1, barrel: true });
  b.set(1, top + 1, fA - 1, 'hay_block[axis=x]');
  lightRoom(b, { x1: 1, y1: top + 1, z1: 1, x2: w - 2, y2: top + 3, z2: fA - 1 });
}

// ------------------------------------------------------------------ Stadt: Gassen, Markt, Stützmauer

const MARKET = { x1: -20, x2: 17, z1: -11, z2: 6, cx: -1, cz: -3 };
const TERRACE_Z = 7; // letzte Reihe der Oberstadt (y 6); südlich davon die Unterstadt (y 2)
const SIDE_STAIRS = [[-24, -22], [18, 20]]; // Nebentreppen von der Oberstadt in die Gassen der Unterstadt

const inRect = (r, x, z) => x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2;

const GARDENS = [
  { x1: -46, x2: -25, z1: 8, z2: 10 }, { x1: -21, x2: -5, z1: 8, z2: 10 }, { x1: 5, x2: 17, z1: 8, z2: 10 }, { x1: 21, x2: 46, z1: 8, z2: 10 },
  { x1: -46, x2: -5, z1: 34, z2: 40 }, { x1: 5, x2: 46, z1: 34, z2: 40 },
  { x1: -46, x2: -37, z1: 27, z2: 33 }, { x1: 37, x2: 46, z1: 27, z2: 33 },
  { x1: 21, x2: 46, z1: 4, z2: 6 }, { x1: -46, x2: -44, z1: -20, z2: 6 }, { x1: 19, x2: 46, z1: -20, z2: -20 }, { x1: 44, x2: 46, z1: -6, z2: 3 },
];
const inGarden = (x, z) => GARDENS.some((r) => inRect(r, x, z));

function marketStone(x, y, z) {
  const dx = x - MARKET.cx;
  const dz = z - MARKET.cz;
  const oct = Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * 0.72);
  if (oct >= 5.5 && oct < 6.5) return 'polished_andesite';
  if (oct >= 6.5 && oct < 7.3) return 'stone_bricks';
  if (x === MARKET.x1 || x === MARKET.x2 || z === MARKET.z1 || z === MARKET.z2) return 'stone_bricks';
  if (oct > 8 && (((dx % 7) + 7) % 7 === 0 || ((dz % 7) + 7) % 7 === 0)) return patch([['stone_bricks', 5], ['cracked_stone_bricks', 1]], x, y, z, 84, 2);
  return patch([['cobblestone', 4], ['stone', 3], ['andesite', 3], ['polished_andesite', 1], ['tuff', 1], ['mossy_cobblestone', 0.5]], x, y, z, 83, 1.8);
}

function paving(x, y, z) {
  if (inRect(MARKET, x, z)) return marketStone(x, y, z);
  if (y >= OBER) return patch([['cobblestone', 5], ['stone', 2], ['andesite', 3], ['stone_bricks', 2], ['gravel', 1], ['mossy_cobblestone', 1]], x, y, z, 81, 2);
  return patch([['cobblestone', 4], ['gravel', 3], ['coarse_dirt', 2], ['andesite', 2], ['mossy_cobblestone', 1], ['packed_mud', 1]], x, y, z, 82, 2);
}

function townGround(b) {
  b.phase('Gassen und Marktplatz');
  for (let z = Z0; z <= Z1; z++) {
    for (let x = X0; x <= X1; x++) {
      if (kindAt(x, z) !== KIND.TOWN || inGarden(x, z)) continue;
      const y = groundAt(x, z);
      b.set(x, y, z, paving(x, y, z));
    }
  }
}

function terraceWall(b) {
  b.phase('Stützmauer und Treppen');
  const z = TERRACE_Z;
  const stairX = (x) => Math.abs(x) <= 3 || SIDE_STAIRS.some(([a, c]) => x >= a && x <= c);
  for (let x = X0; x <= X1; x++) {
    if (kindAt(x, z) !== KIND.TOWN || kindAt(x, z + 1) !== KIND.TOWN) continue;
    for (let y = UNTER; y < OBER; y++) b.set(x, y, z, wallStone(x, y, z, UNTER));
    b.set(x, OBER, z, 'polished_andesite');
    if (stairX(x)) continue;
    const pier = ((x % 6) + 6) % 6 === 0;
    b.set(x, OBER + 1, z, pier ? 'stone_bricks' : 'stone_brick_wall');
    if (pier) {
      b.set(x, OBER + 2, z, 'stone_brick_slab[type=bottom]');
      for (let y = UNTER + 1; y < OBER; y++) b.set(x, y, z + 1, wallStone(x, y, z + 1, UNTER));
      b.set(x, OBER, z + 1, 'stone_brick_stairs[facing=north,half=bottom]');
      if (((x % 12) + 12) % 12 === 0) b.set(x, OBER + 2, z, 'lantern[hanging=false]');
    }
  }
  // Freitreppen: Haupttreppe (7 breit) und zwei Nebentreppen (3 breit) mit Wangen.
  for (const [a, c] of [[-3, 3], ...SIDE_STAIRS]) {
    for (let i = 0; i < 3; i++) {
      const sz = z + 1 + i;
      const sy = OBER - 1 - i;
      for (let x = a; x <= c; x++) {
        for (let y = UNTER + 1; y < sy; y++) b.set(x, y, sz, 'stone_bricks');
        b.set(x, sy, sz, 'stone_brick_stairs[facing=north,half=bottom]');
      }
      for (const x of [a - 1, c + 1]) {
        for (let y = UNTER + 1; y <= sy; y++) b.set(x, y, sz, wallStone(x, y, sz, UNTER));
        b.set(x, sy + 1, sz, 'stone_brick_wall');
      }
    }
    for (const x of [a - 1, c + 1]) b.set(x, OBER + 1, z, 'stone_bricks');
  }
  for (const x of [-4, 4]) lampPost(b, { x, y: OBER + 2, z, height: 1, post: 'stone_brick_wall', style: 'top' });
}

// Häuserzeile: plots = [[Anfang entlang der Gasse, Breite, Extras], …]; front = Fluchtlinie der Front.
function houseRow(b, { y, facing, front, d, plots, opts = {} }) {
  plots.forEach(([a, w, extra = {}], i) => {
    const prev = plots[i - 1];
    const next = plots[i + 1];
    const adjPrev = Boolean(prev && prev[0] + prev[1] === a);
    const adjNext = Boolean(next && a + w === next[0]);
    let x;
    let z;
    if (facing === 'south') [x, z] = [a, front - d + 1];
    else if (facing === 'north') [x, z] = [a, front];
    else if (facing === 'east') [x, z] = [front - d + 1, a];
    else [x, z] = [front, a];
    const leftIsPrev = facing === 'south' || facing === 'west';
    townHouse(b, { x, y, z, w, d, facing, nbL: leftIsPrev ? adjPrev : adjNext, nbR: leftIsPrev ? adjNext : adjPrev, ...opts, ...extra });
  });
}

function lowerTown(b) {
  b.phase('Häuserzeile Unterstadt, Nordseite');
  houseRow(b, { y: UNTER, facing: 'south', front: 17, d: 7, plots: [[-44, 7], [-37, 6], [-31, 7]] });
  houseRow(b, { y: UNTER, facing: 'south', front: 17, d: 7, plots: [[-21, 5], [-16, 7], [-9, 6]] });
  houseRow(b, { y: UNTER, facing: 'south', front: 17, d: 7, plots: [[4, 6], [10, 8]] });
  houseRow(b, { y: UNTER, facing: 'south', front: 17, d: 7, plots: [[21, 7], [28, 5], [33, 6], [39, 6]] });
  b.phase('Häuserzeile Unterstadt, Südseite');
  houseRow(b, { y: UNTER, facing: 'north', front: 27, d: 7, plots: [[-36, 7], [-29, 6], [-23, 9], [-14, 5], [-9, 6]] });
  houseRow(b, { y: UNTER, facing: 'north', front: 27, d: 7, plots: [[4, 9], [13, 5], [18, 7], [25, 6], [31, 6]] });
}

function upperTown(b) {
  b.phase('Bürgerhäuser am Markt');
  const rich = { uppers: [2, 3] };
  houseRow(b, { y: OBER, facing: 'south', front: -14, d: 6, plots: [[-17, 7], [-10, 6]], opts: rich });
  houseRow(b, { y: OBER, facing: 'south', front: -14, d: 6, plots: [[5, 6], [11, 7]], opts: rich });
  houseRow(b, { y: OBER, facing: 'south', front: -14, d: 6, plots: [[-32, 8], [-24, 7]], opts: { ...rich, gableJet: false, jet2: false } });
  b.phase('Häuser an der Westgasse');
  houseRow(b, { y: OBER, facing: 'east', front: -37, d: 7, plots: [[-19, 7], [-12, 6], [-6, 8], [2, 5]], opts: { uppers: [1, 3] } });
  b.phase('Häuser hinter der Kirche');
  houseRow(b, { y: OBER, facing: 'north', front: -3, d: 7, plots: [[19, 7], [26, 5], [31, 7], [38, 6]], opts: { uppers: [1, 2], gableJet: false, jet2: false } });
}

// ------------------------------------------------------------------ Burghof und Umland

const WAY = [['cobblestone', 4], ['gravel', 3], ['coarse_dirt', 2], ['andesite', 1], ['mossy_cobblestone', 1]];

// Weg aus Rechtecken [x1, z1, x2, z2] auf dem Gelände (nur Gras, Erde und Moos werden ersetzt).
function paveWay(b, rects, salt) {
  for (const [x1, z1, x2, z2] of rects) {
    for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        const y = groundAt(x, z);
        if (!/^(grass_block|dirt|coarse_dirt|podzol|moss_block)/.test(b.get(x, y, z))) continue;
        b.set(x, y, z, patch(WAY, x, y, z, salt, 2));
        if (b.get(x, y + 1, z) !== 'air' && isPlantId(b.get(x, y + 1, z).split('[')[0])) b.set(x, y + 1, z, 'air');
      }
    }
  }
}

// Ziehbrunnen: runder Kranz, Schacht mit Wasser, Pfosten mit Haspel und Satteldach.
function drawWell(b, x, z, y) {
  const { shell, inner } = discCells(2);
  for (const [dx, dz] of inner) {
    for (let yy = y - 7; yy <= y; yy++) b.set(x + dx, yy, z + dz, yy <= y - 2 ? 'water[level=0]' : 'air');
    b.set(x + dx, y - 8, z + dz, 'gravel');
  }
  for (const [dx, dz] of shell) {
    for (let yy = y - 8; yy <= y + 1; yy++) b.set(x + dx, yy, z + dz, patch([['stone_bricks', 4], ['mossy_stone_bricks', 2], ['cobblestone', 1]], x + dx, yy, z + dz, 141, 2));
    b.set(x + dx, y + 2, z + dz, 'stone_brick_slab[type=bottom]');
  }
  for (const dx of [-2, 2]) for (let yy = y + 2; yy <= y + 4; yy++) b.set(x + dx, yy, z, 'stripped_spruce_log[axis=y]');
  for (let dx = -2; dx <= 2; dx++) b.set(x + dx, y + 5, z, 'stripped_spruce_log[axis=x]');
  for (let dx = -3; dx <= 3; dx++) {
    b.set(x + dx, y + 4, z - 2, 'spruce_stairs[facing=south,half=bottom]');
    b.set(x + dx, y + 5, z - 1, 'spruce_stairs[facing=south,half=bottom]');
    b.set(x + dx, y + 4, z + 2, 'spruce_stairs[facing=north,half=bottom]');
    b.set(x + dx, y + 5, z + 1, 'spruce_stairs[facing=north,half=bottom]');
    b.set(x + dx, y + 6, z, 'spruce_slab[type=bottom]');
  }
  for (let yy = y; yy <= y + 4; yy++) b.set(x, yy, z, 'iron_chain[axis=y]');
}

function castleYard(b) {
  b.phase('Burghof');
  const y = ROCK;
  paveWay(b, [[-2, -38, 2, -47], [-7, -46, -3, -47], [3, -42, 19, -44], [-11, -39, -3, -45], [-24, -38, -12, -40], [8, -44, 12, -46]], 142);
  drawWell(b, -7, -42, y);
  townHouse(b, { x: 20, y, z: -46, w: 7, d: 9, facing: 'west', type: 'giebel', uppers: [1, 1], shop: true, goods: 'baecker', frame: 'fichte', fill: 'packed_mud', roof: 'schiefer', jet: 1, jet2: false, gableJet: false, deco: 'shutters', chimney: true });
  b.step();
  tree(b, { x: 13, y: y + 1, z: -40, species: 'eiche', size: 'mittel', seed: 21 });
  for (const [x, z, s] of [[18, -38, 'hay_block[axis=x]'], [18, -39, 'hay_block[axis=z]'], [19, -38, 'barrel[facing=up]'], [17, -48, 'barrel[facing=up]'], [18, -48, 'barrel[facing=north]'], [-27, -46, 'hay_block[axis=x]'], [-27, -45, 'composter[level=4]']]) {
    if (b.get(x, y + 1, z) === 'air') b.set(x, y + 1, z, s);
  }
  b.set(18, y + 2, -38, 'hay_block[axis=x]');
  // Brennholzstapel an der Kernmauer.
  for (let x = -26; x <= -22; x++) for (let yy = y + 1; yy <= y + 2; yy++) b.set(x, yy, -37, 'oak_log[axis=x]');
  for (let x = -26; x <= -22; x++) b.set(x, y + 3, -37, 'spruce_slab[type=bottom]');
}

// Bäume, Büsche und Felsen außerhalb der Mauern, Landstraße vom Brückenkopf nach Süden.
function countryside(b) {
  b.phase('Umland: Landstraße, Bäume und Felsen');
  for (let z = 59; z <= Z1; z++) {
    const wig = Math.round((noise2(0, z, 6, 151) - 0.5) * 2);
    for (let x = -3 + wig; x <= 3 + wig; x++) {
      const g = groundAt(x, z);
      const edge = Math.abs(x - wig) === 3;
      b.set(x, g, z, edge ? patch([['coarse_dirt', 2], ['grass_block', 2], ['gravel', 1]], x, g, z, 152, 2) : patch([['dirt_path', 6], ['gravel', 2], ['coarse_dirt', 2], ['cobblestone', 1]], x, g, z, 153, 2));
    }
  }
  const trees = [
    [-66, -50, 'fichte', 'mittel'], [-67, -34, 'eiche', 'mittel'], [-65, -12, 'birke', 'mittel'], [-67, 8, 'eiche', 'mittel'], [-66, 27, 'fichte', 'mittel'],
    [-66, 46, 'eiche', 'mittel'], [-58, 63, 'birke', 'klein'], [-40, 63, 'eiche', 'mittel'], [-22, 63, 'eiche', 'klein'], [16, 63, 'eiche', 'mittel'],
    [33, 64, 'birke', 'klein'], [50, 63, 'eiche', 'mittel'], [66, 47, 'fichte', 'mittel'], [67, 26, 'eiche', 'mittel'], [65, 6, 'birke', 'mittel'],
    [67, -15, 'eiche', 'mittel'], [66, -40, 'fichte', 'mittel'], [64, -62, 'fichte', 'klein'], [-63, -64, 'eiche', 'klein'],
    [-52, -79, 'fichte', 'mittel'], [-34, -79, 'fichte', 'gross'], [-14, -79, 'eiche', 'mittel'], [8, -79, 'fichte', 'mittel'], [27, -79, 'eiche', 'mittel'],
    [46, -79, 'fichte', 'gross'], [60, -76, 'birke', 'klein'],
  ];
  trees.forEach(([x, z, species, size], i) => {
    b.step();
    tree(b, { x, y: groundAt(x, z) + 1, z, species, size, seed: 160 + i });
  });
  b.step();
  for (const [x, z, size] of [[-62, -20, 'mittel'], [-61, 36, 'klein'], [-48, 61, 'mittel'], [-8, 62, 'klein'], [26, 61, 'mittel'], [61, 56, 'klein'], [62, 16, 'mittel'], [61, -28, 'klein'], [-24, -76, 'mittel'], [37, -77, 'klein']]) {
    bush(b, { x, y: groundAt(x, z) + 1, z, size, leaves: (x + z) % 3 === 0 ? 'azalee' : 'eiche', seed: x * 7 + z });
  }
  for (const [x, z, size, material] of [[-47, -44, 'gross', 'andesit'], [46, -52, 'mittel', 'stein'], [-44, -66, 'mittel', 'tuff'], [44, -30, 'klein', 'stein'], [-68, -70, 'mittel', 'stein'], [69, -78, 'klein', 'andesit'], [-6, -77, 'klein', 'stein']]) {
    rock(b, { x, y: groundAt(x, z) + 1, z, size, material, seed: x + z * 3 });
  }
  b.phase('Wiesen und Gärten');
  for (const [x, z, species, i] of [[-40, 37, 'eiche', 0], [-30, 38, 'birke', 1], [-12, 37, 'eiche', 2], [11, 38, 'kirsche', 3], [33, 37, 'eiche', 4], [41, 30, 'birke', 5], [-42, 30, 'eiche', 6]]) {
    tree(b, { x, y: groundAt(x, z) + 1, z, species, size: 'klein', seed: 190 + i });
  }
  for (const [x, z] of [[-34, 39], [-6, 39], [18, 39], [27, 36]]) bush(b, { x, y: groundAt(x, z) + 1, z, size: 'klein', leaves: 'azalee', seed: x + z });
  vegetation(b, { x: X0, y: 40, z: Z0, width: GW, depth: GD, mix: 'wiese', density: 0.3, shape: 'eckig', scan: 50, seed: 'burgstadt' });
  vegetation(b, { x: -46, y: 10, z: 34, width: 92, depth: 7, mix: 'blumen', density: 0.25, shape: 'eckig', scan: 10, seed: 'gaerten' });
}

// ------------------------------------------------------------------ Rathaus

// Lokal wie ein Stadthaus (Front bei z 11, Breite 13): steinerne Laube mit Spitzbögen, Ratssaal und Archiv in
// zwei Fachwerkgeschossen über der Auskragung, Zwerchhaus, zwei Eckerker mit Spitzhelm, Dachreiter mit Glocke.
const RATHAUS = { x: -33, z: -9, w: 13, d: 12, facing: 'east' };

function rathaus(b) {
  b.phase('Rathaus');
  b.transform(plotTransform({ ...RATHAUS, y: OBER }), () => drawRathaus(b));
}

function drawRathaus(b) {
  const w = 13;
  const front = 12;
  const G = 6; // Oberkante der Laube (Schwelle des Ratssaals)
  const h = {
    w, frame: FRAMES.dunkel, fill: 'calcite', mas: MASONRY.bruch, salt: 4242, ox: RATHAUS.x, oz: RATHAUS.z, bars: false, shop: false,
    floor: 'dark_oak_planks', deco: 'flowers', H0: G, stone: false, cross: 2, roofSet: ROOF_SETS.schiefer,
  };
  const sides = 'PFFPWWPWWPFFP';
  const s1 = G;
  const s2 = G + 6;
  const top = s2 + 5;
  const stories = [
    { base: s1, rows: 5, front, mat: 'timber', win: [2, 4], bays: { front: 'PWWPWWPWWPWWP', back: 'PFFPFFPFFPFFP', left: sides, right: sides } },
    { base: s2, rows: 4, front, mat: 'timber', bays: { front: 'PWWPFFPFFPWWP', back: 'PFFPFFPFFPFFP', left: sides, right: sides } },
  ];
  for (const st of stories) drawStory(b, h, st);

  // Laube und Erdgeschoss aus Bruchstein.
  const stone = (x, y, z) => masonryAt(h, x, y, z);
  for (let x = 0; x < w; x++) for (let z = 0; z <= 11; z++) b.set(x, 0, z, z >= 8 ? ((x + z) % 2 === 0 ? 'polished_andesite' : 'stone_bricks') : 'spruce_planks');
  for (let y = 1; y < G; y++) {
    for (let x = 0; x < w; x++) {
      b.set(x, y, 0, stone(x, y, 0));
      b.set(x, y, 7, stone(x, y, 7));
      if (x > 0 && x < w - 1) for (let z = 1; z <= 11; z++) if (z !== 7) b.set(x, y, z, 'air');
    }
    for (const x of [0, w - 1]) for (let z = 0; z <= 11; z++) b.set(x, y, z, z === 0 || z === 7 || z === 11 ? h.mas.quoin[y % 2] : stone(x, y, z));
  }
  for (let x = 1; x < w - 1; x++) for (let z = 8; z <= 10; z++) b.set(x, G, z, x % 4 === 0 ? 'stripped_dark_oak_log[axis=z]' : 'dark_oak_planks');
  for (const cx of [3, 9]) arch(b, { x: cx, y: 1, z: 11, facing: 'south', width: 5, height: G - 1, style: 'pointed', depth: 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  arch(b, { x: 0, y: 1, z: 9, facing: 'west', width: 3, height: G - 1, style: 'pointed', depth: 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  arch(b, { x: w - 1, y: 1, z: 9, facing: 'east', width: 3, height: G - 1, style: 'pointed', depth: 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  for (const u of [0, 6, 12]) b.set(u, G - 1, front, `${h.frame.stairs}[facing=north,half=top]`);
  for (let u = 0; u < w; u++) if (u % 3 !== 0) b.set(u, G, front, `${h.frame.log}[axis=x]`);
  // Portal zum Saal, Fenster.
  b.door(6, 1, 7, 'dark_oak_door', { facing: 'north', hinge: 'left' });
  b.set(5, 3, 7, 'stone_brick_stairs[facing=west,half=top]');
  b.set(7, 3, 7, 'stone_brick_stairs[facing=east,half=top]');
  b.set(6, 3, 7, 'chiseled_stone_bricks');
  b.set(6, 4, 8, `${COLOR.rot.wallBanner}[facing=south]`);
  for (const x of [2, 3, 9, 10]) for (let y = 2; y <= 3; y++) b.set(x, y, 7, 'iron_bars');
  for (const x of [3, 9]) for (let y = 2; y <= 3; y++) b.set(x, y, 0, 'iron_bars');
  for (const x of [2, 10]) hangingLantern(b, { x, y: G - 1, z: 9, chain: 0 });
  // Bänke und Fässer unter der Laube.
  for (const x of [1, 11]) b.set(x, 1, 8, 'barrel[facing=up]');
  for (const x of [3, 4, 8, 9]) b.set(x, 1, 8, `${h.frame.stairs}[facing=north,half=bottom]`);

  // Rähm, Dachboden, Dach mit Zwerchhaus.
  for (const side of houseSides(w, front)) for (let u = 0; u < side.len; u++) {
    const [x, z] = side.at(u);
    b.set(x, top, z, `${h.frame.log}[axis=${side.axis}]`);
  }
  for (let x = 1; x < w - 1; x++) for (let z = 1; z < front; z++) b.set(x, top, z, h.floor);
  const main = { type: 'gable', axis: 'x', x1: -1, x2: w, z1: -1, z2: front + 1, eave: top, slope: 2 };
  for (const side of houseSides(w, front)) {
    const gableSide = side.name === 'left' || side.name === 'right';
    for (let u = 0; u < side.len; u++) {
      const [x, z] = side.at(u);
      fillUnderRoof(b, [main], x, z, top + 1, gableSide ? (hh) => gableTimber(h, u, hh, side.len, 'z') : () => h.fill);
    }
  }
  drawRoofs(b, [main], h.roofSet, h.salt + 9, h.ox, h.oz);
  crossGable(b, h, main, top, front);
  b.set(6, top + 5, front + 1, `${COLOR.gelb.wallBanner}[facing=south]`);
  for (const cx of [2, 10]) {
    const c = topCell([main], cx, 3);
    chimney(b, { x: cx, y: top + 1, z: 3, height: c.top - top + 2, block: 'bricks' });
  }

  // Eckerker an den vorderen Ecken: vom Laubendach bis über die Traufe, Spitzhelm.
  for (const [ex, side] of [[0, -1], [w - 1, 1]]) {
    const cells = [[ex + side, front - 1], [ex + side, front], [ex + side, front + 1], [ex, front + 1], [ex - side, front + 1]];
    const inner = [[ex, front], [ex, front - 1], [ex - side, front]];
    for (const [x, z] of cells) b.set(x, G, z, `${h.frame.stairs}[facing=${towardCenter(x - ex, z - front)},half=top]`);
    b.set(ex + side, G - 1, front + 1, `${h.frame.stairs}[facing=${towardCenter(side, 1)},half=top]`);
    for (let y = G + 1; y <= top + 3; y++) {
      cells.forEach(([x, z], i) => {
        const post = i === 0 || i === 2 || i === 4;
        const win = !post && ((y >= s1 + 2 && y <= s1 + 4) || (y >= s2 + 2 && y <= s2 + 3) || y === top + 2);
        b.set(x, y, z, post ? `${h.frame.log}[axis=y]` : win ? 'glass_pane' : y === s2 || y === top ? `${h.frame.log}[axis=${i === 1 ? 'z' : 'x'}]` : h.fill);
      });
      const open = (y > s1 && y < s2) || (y > s2 && y < top);
      for (const [x, z] of inner) b.set(x, y, z, open ? 'air' : y > top ? h.fill : b.get(x, y, z));
    }
    for (const yy of [s1, s2]) for (const [x, z] of [...inner, [ex + side, front]]) b.set(x, yy, z, h.floor);
    b.set(ex + side, s1, front, `${h.frame.stairs}[facing=${towardCenter(side, 0)},half=top]`);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
      b.set(ex + dx, top + 4, front + dz, `${ROOFS.schiefer[0]}[facing=${towardCenter(dx, dz)},half=top]`);
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) b.set(ex + dx, top + 4, front + dz, `${h.frame.log}[axis=y]`);
    coneRoof(b, { x: ex, z: front, y: top + 5, r: 2, slope: 3.6, tip: side < 0 ? 'rot' : 'gelb', set: ROOF_SETS.schiefer, salt: 131 });
  }

  // Dachreiter mit Glocke auf dem First.
  const ridge = roofCell(main, 6, 6);
  const ry = ridge.level + 2;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    b.set(6 + dx, ry, 6 + dz, 'dark_oak_planks');
    for (let y = ry + 1; y <= ry + 3; y++) b.set(6 + dx, y, 6 + dz, dx !== 0 && dz !== 0 ? 'dark_oak_fence' : 'air');
    b.set(6 + dx, ry + 4, 6 + dz, 'dark_oak_planks');
  }
  b.set(6, ry + 3, 6, 'bell[attachment=ceiling,facing=south]');
  coneRoof(b, { x: 6, z: 6, y: ry + 5, r: 1, slope: 3, stairs: 'waxed_oxidized_cut_copper_stairs', full: 'waxed_oxidized_cut_copper', tip: 'rod' });

  // Einrichtung: Ratskeller, Ratssaal, Archiv, Dachboden; Leiter hinten rechts.
  for (let y = 1; y <= top; y++) b.set(w - 2, y, 1, 'ladder[facing=south]');
  storage(b, { x: 1, y: 1, z: 1, facing: 'south', width: 8, height: 2, barrel: true });
  diningTable(b, { x: 3, y: 1, z: 4, facing: 'south', length: 5, width: 1, wood: 'fichte', headChairs: false });
  diningTable(b, { x: 3, y: s1 + 1, z: 5, facing: 'south', length: 7, width: 2, wood: 'schwarzeiche', top: 'carpet', cloth: 'rot' });
  b.set(1, s1 + 1, 5, 'dark_oak_stairs[facing=west,half=bottom]');
  b.set(1, s1 + 1, 6, 'dark_oak_stairs[facing=west,half=bottom]');
  bookWall(b, { x: 1, y: s1 + 1, z: 1, facing: 'south', width: 8, height: 3 });
  for (const x of [3, 6, 9]) hangingLantern(b, { x, y: s2 - 1, z: 6, chain: 0 });
  for (const x of [2, 5, 8]) b.set(x, s1 + 3, 11, `${(x % 2 === 0 ? COLOR.rot : COLOR.gelb).wallBanner}[facing=north]`);
  bookWall(b, { x: 1, y: s2 + 1, z: 1, facing: 'south', width: 9, height: 3 });
  for (const x of [3, 7]) b.set(x, s2 + 1, 6, 'lectern[facing=south]');
  storage(b, { x: 1, y: s2 + 1, z: 10, facing: 'north', width: 4, height: 1 });
  storage(b, { x: 1, y: top + 1, z: 1, facing: 'south', width: 4, height: 1, barrel: true });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: w - 2, y2: G - 1, z2: 6 });
  lightRoom(b, { x1: 1, y1: 1, z1: 8, x2: w - 2, y2: G - 1, z2: 11 });
  lightRoom(b, { x1: 1, y1: s1 + 1, z1: 1, x2: w - 2, y2: s2 - 1, z2: front - 1 });
  lightRoom(b, { x1: 1, y1: s2 + 1, z1: 1, x2: w - 2, y2: top - 1, z2: front - 1 });
  lightRoom(b, { x1: 1, y1: top + 1, z1: 1, x2: w - 2, y2: top + 3, z2: front - 1 });
}

// ------------------------------------------------------------------ Kirche (Backsteingotik)

// Westturm tx1 … tx2 × tz1 … tz2, Langhaus nx1 … nx2 × nz1 … nz2 (Wandlinien), Chor bis cx2 (Polygon), alles auf OBER.
const CH = { tx1: 21, tx2: 27, tz1: -16, tz2: -10, tTop: 38, nx1: 28, nx2: 41, nz1: -18, nz2: -8, eave: 18, cx2: 45, cz1: -16, cz2: -10, cTop: 16, cz: -13 };
const CH_BAYS = [28, 31, 34, 37, 40]; // Strebepfeiler und Arkadenpfeiler
const brickAt = (x, y, z) => patch([['bricks', 16], ['granite', 1], ['terracotta', 1], ['mud_bricks', 1]], x, y, z, 101, 2.5);

function stainedAt(x, y, z) {
  const row = ((y % 4) + 4) % 4;
  if (row === 0) return 'red_stained_glass_pane';
  if (row === 2 && (x + z) % 2 === 0) return 'yellow_stained_glass_pane';
  return (x + z + y) % 3 === 0 ? 'light_blue_stained_glass_pane' : 'blue_stained_glass_pane';
}

// Spitzbogenfenster in einer Wand: cells = Zellen [x, z] nebeneinander (Reihenfolge von „links“ nach „rechts“),
// Glas von y1 bis y2, darüber der Bogen aus Treppen; dirs = Richtung zur linken und zur rechten Laibung.
function lancet(b, cells, y1, y2, dirs, stairs = 'brick_stairs') {
  cells.forEach(([x, z], i) => {
    for (let y = y1; y <= y2; y++) b.set(x, y, z, stainedAt(x, y, z));
    if (cells.length === 1) b.set(x, y2 + 1, z, 'brick_slab[type=top]');
    else if (i === 0) b.set(x, y2 + 1, z, `${stairs}[facing=${dirs[0]},half=top]`);
    else if (i === cells.length - 1) b.set(x, y2 + 1, z, `${stairs}[facing=${dirs[1]},half=top]`);
  });
}

function church(b) {
  const C = CH;
  const y0 = OBER;
  const roofN = { type: 'gable', axis: 'x', x1: C.nx1 - 1, x2: C.nx2 + 1, z1: C.nz1 - 1, z2: C.nz2 + 1, eave: C.eave, slope: 2 };
  const roofC = { type: 'hip', x1: C.nx2 - 4, x2: C.cx2 + 1, z1: C.cz1 - 1, z2: C.cz2 + 1, eave: C.cTop, slope: 2 };

  b.phase('Kirche: Langhaus');
  forBox(C.nx1, y0, C.nz1 - 1, C.cx2, y0, C.nz2 + 1, (x, y, z) => b.set(x, y, z, 'stone_bricks'));
  forBox(C.nx1, y0 + 1, C.nz1, C.nx2, C.eave, C.nz2, (x, y, z) => {
    const wall = x === C.nx1 || x === C.nx2 || z === C.nz1 || z === C.nz2;
    if (!wall) b.set(x, y, z, 'air');
    else if (y === y0 + 1) b.set(x, y, z, 'stone_bricks');
    else if (y === C.eave - 1 && (z === C.nz1 || z === C.nz2) && !CH_BAYS.includes(x)) b.set(x, y, z, (x % 2 === 0) ? 'calcite' : brickAt(x, y, z));
    else b.set(x, y, z, brickAt(x, y, z));
  });
  // Sockel mit Schräge, Strebepfeiler, Fenster.
  for (let x = C.nx1; x <= C.nx2; x++) {
    for (const [z, out] of [[C.nz1 - 1, 'north'], [C.nz2 + 1, 'south']]) {
      const toWall = OPP[out];
      if (CH_BAYS.includes(x)) {
        for (let y = y0 + 1; y <= 14; y++) b.set(x, y, z, y === y0 + 1 ? 'stone_bricks' : brickAt(x, y, z));
        b.set(x, 15, z, `brick_stairs[facing=${toWall},half=bottom]`);
        b.set(x, 11, z, 'stone_bricks');
      } else {
        b.set(x, y0 + 1, z, `stone_brick_stairs[facing=${toWall},half=bottom]`);
      }
    }
  }
  for (let i = 0; i < CH_BAYS.length - 1; i++) {
    const xa = CH_BAYS[i] + 1;
    const xb = CH_BAYS[i] + 2;
    for (const z of [C.nz1, C.nz2]) {
      const portal = z === C.nz2 && i === 2;
      if (portal) {
        // Südportal: Doppeltür unter Spitzbogen, darüber kleines Fenster.
        for (const x of [xa, xb]) for (let y = y0 + 1; y <= y0 + 4; y++) b.set(x, y, z, 'air');
        for (const x of [xa, xb]) b.set(x, y0 + 1, z + 1, 'air');
        b.door(xa, y0 + 1, z, 'dark_oak_door', { facing: 'north', hinge: 'left' });
        b.door(xb, y0 + 1, z, 'dark_oak_door', { facing: 'north', hinge: 'right' });
        b.set(xa, y0 + 3, z, 'stone_brick_stairs[facing=west,half=top]');
        b.set(xb, y0 + 3, z, 'stone_brick_stairs[facing=east,half=top]');
        b.set(xa, y0 + 4, z, 'chiseled_stone_bricks');
        b.set(xb, y0 + 4, z, 'chiseled_stone_bricks');
        for (const x of [xa, xb]) b.set(x, y0 + 5, z + 1, 'stone_brick_stairs[facing=north,half=bottom]');
        lancet(b, [[xa, z], [xb, z]], 13, 15, ['west', 'east']);
        wallLantern(b, { x: xa - 1, y: y0 + 3, z, facing: 'south', style: 'bracket', arm: 'dark_oak_fence' });
        continue;
      }
      lancet(b, [[xa, z], [xb, z]], 9, 15, ['west', 'east']);
      b.set(xa, 8, z + (z === C.nz1 ? -1 : 1), `brick_stairs[facing=${z === C.nz1 ? 'south' : 'north'},half=bottom]`);
      b.set(xb, 8, z + (z === C.nz1 ? -1 : 1), `brick_stairs[facing=${z === C.nz1 ? 'south' : 'north'},half=bottom]`);
      // Maßwerk: Mittelpfosten oben.
      b.set(xa, 12, z, 'brick_wall');
    }
  }

  b.phase('Kirche: Chor');
  const inChoir = (x, z) => x > C.nx2 && x <= C.cx2 && z >= C.cz1 && z <= C.cz2 && !(x === C.cx2 && (z === C.cz1 || z === C.cz2));
  for (let x = C.nx2 + 1; x <= C.cx2; x++) {
    for (let z = C.cz1; z <= C.cz2; z++) {
      if (!inChoir(x, z)) continue;
      const wall = !inChoir(x + 1, z) || !inChoir(x, z - 1) || !inChoir(x, z + 1);
      for (let y = y0 + 1; y <= C.cTop; y++) b.set(x, y, z, !wall ? 'air' : y === y0 + 1 ? 'stone_bricks' : brickAt(x, y, z));
      b.set(x, y0 + 1, z, wall ? 'stone_bricks' : 'polished_andesite');
    }
  }
  for (const [cells, dirs] of [
    [[[43, C.cz1]], null], [[[43, C.cz2]], null], [[[C.cx2, C.cz - 1], [C.cx2, C.cz], [C.cx2, C.cz + 1]], ['north', 'south']],
    [[[C.cx2 - 1, C.cz1 + 1]], null], [[[C.cx2 - 1, C.cz2 - 1]], null],
  ]) lancet(b, cells, 9, 14, dirs ?? ['west', 'east']);
  b.set(C.cx2, 12, C.cz, 'brick_wall');
  for (const [x, z, f] of [[C.cx2 + 1, C.cz1 + 1, 'west'], [C.cx2 + 1, C.cz2 - 1, 'west'], [42, C.cz1 - 1, 'south'], [42, C.cz2 + 1, 'north']]) {
    for (let y = y0 + 1; y <= 12; y++) b.set(x, y, z, y === y0 + 1 ? 'stone_bricks' : brickAt(x, y, z));
    b.set(x, 13, z, `brick_stairs[facing=${f},half=bottom]`);
  }

  b.phase('Kirche: Dächer');
  const roofs = [roofN, roofC];
  for (let z = C.nz1; z <= C.nz2; z++) {
    for (const x of [C.nx1, C.nx2]) fillUnderRoof(b, [roofN], x, z, C.eave + 1, (h, c) => (x === C.nx2 && (z - C.cz) % 2 === 0 && h >= 7 && c.bottom - (C.eave + h) >= 2 ? 'calcite' : brickAt(x, C.eave + h, z)));
  }
  for (let x = C.nx1; x <= C.nx2; x++) for (const z of [C.nz1, C.nz2]) fillUnderRoof(b, [roofN], x, z, C.eave + 1, (h) => brickAt(x, C.eave + h, z));
  for (let x = C.nx2 + 1; x <= C.cx2; x++) {
    for (let z = C.cz1; z <= C.cz2; z++) if (inChoir(x, z) && (!inChoir(x + 1, z) || !inChoir(x, z - 1) || !inChoir(x, z + 1))) fillUnderRoof(b, [roofC], x, z, C.cTop + 1, (h) => brickAt(x, C.cTop + h, z));
  }
  drawRoofs(b, roofs, ROOF_SETS.kupfer, 121);
  // Dachreiter auf dem First über dem Chorbogen.
  const ridge = roofCell(roofN, 39, C.cz).level + 2;
  for (let y = ridge; y <= ridge + 2; y++) for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) b.set(39 + dx, y, C.cz + dz, y === ridge ? 'waxed_oxidized_cut_copper' : 'dark_oak_fence');
  b.set(39, ridge + 1, C.cz, 'bell[attachment=ceiling,facing=north]');
  b.set(39, ridge + 2, C.cz, 'dark_oak_planks');
  coneRoof(b, { x: 39, z: C.cz, y: ridge + 3, r: 1, slope: 3, stairs: 'waxed_oxidized_cut_copper_stairs', full: 'waxed_oxidized_cut_copper', tip: 'rod' });

  b.phase('Kirche: Innenraum');
  // Boden, Arkaden, Zuganker, Bänke, Chor mit Altar.
  for (let x = C.nx1 + 1; x < C.nx2; x++) for (let z = C.nz1 + 1; z < C.nz2; z++) b.set(x, y0, z, (x + z) % 2 === 0 ? 'polished_andesite' : 'stone_bricks');
  for (const z of [C.cz - 2, C.cz + 2]) {
    for (let x = C.nx1 + 1; x < C.nx2; x++) {
      if (CH_BAYS.includes(x)) {
        for (let y = y0 + 1; y <= C.eave; y++) b.set(x, y, z, y === y0 + 1 ? 'chiseled_stone_bricks' : y === 15 ? 'chiseled_stone_bricks' : 'stone_bricks');
        continue;
      }
      const left = CH_BAYS.includes(x - 1);
      b.set(x, 16, z, `stone_brick_stairs[facing=${left ? 'west' : 'east'},half=top]`);
      b.set(x, 17, z, 'stone_bricks');
      b.set(x, 18, z, 'stone_bricks');
    }
  }
  for (const x of CH_BAYS.slice(1, -1)) {
    for (let z = C.nz1 + 1; z < C.nz2; z++) b.set(x, C.eave + 1, z, 'stripped_spruce_log[axis=z]');
    hangingLantern(b, { x, y: C.eave - 2, z: C.cz, chain: 2 });
  }
  for (let x = C.nx1 + 2; x <= C.nx2 - 3; x++) {
    if (CH_BAYS.includes(x)) continue;
    for (const z of [C.nz1 + 1, C.cz - 2, C.cz - 1, C.cz + 1, C.cz + 2, C.nz2 - 1]) {
      if (z === C.cz - 2 || z === C.cz + 2) continue;
      b.set(x, y0 + 1, z, 'spruce_stairs[facing=west,half=bottom]');
    }
  }
  for (let x = C.nx1 + 1; x <= C.cx2 - 1; x++) b.set(x, y0 + (x > C.nx2 ? 2 : 1), C.cz, 'red_carpet');
  // Chorbogen in der Ostwand.
  for (let z = C.cz - 2; z <= C.cz + 2; z++) for (let y = y0 + 1; y <= 14; y++) b.set(C.nx2, y, z, 'air');
  b.set(C.nx2, 14, C.cz - 2, 'stone_brick_stairs[facing=north,half=top]');
  b.set(C.nx2, 14, C.cz + 2, 'stone_brick_stairs[facing=south,half=top]');
  for (let z = C.cz - 2; z <= C.cz + 2; z++) b.set(C.nx2, y0 + 1, z, z === C.cz ? 'red_carpet' : 'polished_andesite_slab[type=bottom]');
  b.set(C.nx2, y0 + 1, C.cz, 'polished_andesite');
  b.set(C.nx2, y0 + 2, C.cz, 'red_carpet');
  // Altar, Leuchter, Kanzel, Taufbecken.
  b.set(C.cx2 - 1, y0 + 2, C.cz - 1, 'quartz_stairs[facing=north,half=bottom]');
  b.set(C.cx2 - 1, y0 + 2, C.cz, 'chiseled_quartz_block');
  b.set(C.cx2 - 1, y0 + 2, C.cz + 1, 'quartz_stairs[facing=south,half=bottom]');
  b.set(C.cx2 - 1, y0 + 3, C.cz, 'candle[candles=3,lit=true]');
  b.set(C.cx2 - 1, y0 + 3, C.cz - 1, 'candle[candles=1,lit=true]');
  b.set(C.cx2 - 1, y0 + 3, C.cz + 1, 'candle[candles=1,lit=true]');
  b.set(C.cx2, y0 + 5, C.cz, `${COLOR.gelb.wallBanner}[facing=west]`);
  b.set(C.nx2 - 1, y0 + 1, C.cz - 3, 'lectern[facing=west]');
  b.set(C.nx1 + 1, y0 + 1, C.nz2 - 1, 'water_cauldron[level=3]');
  for (const [x, z] of [[C.nx2 + 1, C.cz - 2], [C.nx2 + 1, C.cz + 2]]) b.set(x, y0 + 2, z, 'candle[candles=4,lit=true]');
  lightRoom(b, { x1: C.nx1 + 1, y1: y0 + 1, z1: C.nz1 + 1, x2: C.nx2 - 1, y2: C.eave, z2: C.nz2 - 1 });
  lightRoom(b, { x1: C.nx2 + 1, y1: y0 + 2, z1: C.cz1 + 1, x2: C.cx2 - 1, y2: C.cTop, z2: C.cz2 - 1 });

  churchTower(b);
}

// Westturm: Ecklisenen, Portal mit Mittelpfosten, Rosette, Blendnischen, Glockenstube, Giebelkranz und Kupferhelm.
function churchTower(b) {
  const C = CH;
  const y0 = OBER;
  const cx = 24;
  const cz = C.cz;
  const { tx1, tx2, tz1, tz2, tTop } = C;
  b.phase('Kirche: Westturm');
  forBox(tx1 - 1, y0, tz1 - 1, tx2, y0, tz2 + 1, (x, y, z) => b.set(x, y, z, 'stone_bricks'));
  const floors = [21, 30, tTop];
  forBox(tx1, y0 + 1, tz1, tx2, tTop, tz2, (x, y, z) => {
    const shell = x === tx1 || x === tx2 || z === tz1 || z === tz2;
    if (shell) b.set(x, y, z, y <= y0 + 1 ? 'stone_bricks' : brickAt(x, y, z));
    else b.set(x, y, z, floors.includes(y) ? 'spruce_planks' : 'air');
  });
  for (let x = tx1 + 1; x < tx2; x++) for (let z = tz1 + 1; z < tz2; z++) b.set(x, y0, z, 'polished_andesite');
  // Lisenen: Ecken (L-förmig) und Mitte jeder Seite.
  const faces = [
    { name: 'W', plane: (u) => [tx1 - 1, tz1 + u], wall: (u) => [tx1, tz1 + u], toWall: 'east', lo: 'north', hi: 'south' },
    { name: 'O', plane: (u) => [tx2 + 1, tz1 + u], wall: (u) => [tx2, tz1 + u], toWall: 'west', lo: 'north', hi: 'south' },
    { name: 'N', plane: (u) => [tx1 + u, tz1 - 1], wall: (u) => [tx1 + u, tz1], toWall: 'south', lo: 'west', hi: 'east' },
    { name: 'S', plane: (u) => [tx1 + u, tz2 + 1], wall: (u) => [tx1 + u, tz2], toWall: 'north', lo: 'west', hi: 'east' },
  ];
  const n = tx2 - tx1 + 1;
  for (const f of faces) {
    const lowY = f.name === 'O' ? 33 : y0 + 1;
    for (const u of [0, n - 1]) {
      const [x, z] = f.plane(u);
      for (let y = lowY; y < tTop; y++) b.set(x, y, z, y <= y0 + 1 ? 'stone_bricks' : brickAt(x, y, z));
      b.set(x, tTop, z, `brick_stairs[facing=${f.toWall},half=bottom]`);
    }
    const [mx, mz] = f.plane(3);
    for (let y = f.name === 'W' ? 22 : Math.max(lowY, y0 + 1); y < tTop; y++) b.set(mx, y, mz, brickAt(mx, y, mz));
    b.set(mx, tTop, mz, `brick_stairs[facing=${f.toWall},half=bottom]`);
    // Gesimse zwischen den Lisenen.
    for (const y of [21, 30]) {
      if (f.name === 'O' && y < 33) continue;
      for (let u = 1; u < n - 1; u++) {
        if (u === 3) continue;
        const [x, z] = f.plane(u);
        b.set(x, y, z, `brick_stairs[facing=${f.toWall},half=top]`);
      }
    }
    // Blendnischen und Glockenstube.
    for (const [u0, u1] of [[1, 2], [4, 5]]) {
      for (let y = 23; y <= 28; y++) for (let u = u0; u <= u1; u++) {
        if (f.name === 'O') continue;
        const [x, z] = f.wall(u);
        b.set(x, y, z, y === 23 ? 'smooth_stone_slab[type=top]' : 'calcite');
      }
      if (f.name !== 'O') {
        const [ax, az] = f.wall(u0);
        const [bx, bz] = f.wall(u1);
        b.set(ax, 29, az, `brick_stairs[facing=${f.lo},half=top]`);
        b.set(bx, 29, bz, `brick_stairs[facing=${f.hi},half=top]`);
      }
      for (let y = 32; y <= 35; y++) for (let u = u0; u <= u1; u++) {
        const [x, z] = f.wall(u);
        b.set(x, y, z, y === 32 ? 'dark_oak_trapdoor[facing=' + OPP[f.toWall] + ',half=top,open=false]' : 'air');
      }
      const [ax, az] = f.wall(u0);
      const [bx, bz] = f.wall(u1);
      b.set(ax, 36, az, `brick_stairs[facing=${f.lo},half=top]`);
      b.set(bx, 36, bz, `brick_stairs[facing=${f.hi},half=top]`);
    }
  }
  // Portal: gestufter Spitzbogen mit Mittelpfosten.
  arch(b, { x: tx1 - 1, y: y0 + 1, z: cz, facing: 'west', width: 5, height: 7, style: 'pointed', depth: 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  arch(b, { x: tx1, y: y0 + 1, z: cz, facing: 'west', width: 3, height: 5, style: 'pointed', depth: 1, block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  b.door(tx1, y0 + 1, cz - 1, 'dark_oak_door', { facing: 'east', hinge: 'right' });
  b.door(tx1, y0 + 1, cz + 1, 'dark_oak_door', { facing: 'east', hinge: 'left' });
  for (let y = y0 + 1; y <= y0 + 3; y++) b.set(tx1, y, cz, y === y0 + 3 ? 'chiseled_stone_bricks' : 'stone_brick_wall');
  b.set(tx1, y0 + 4, cz, 'chiseled_stone_bricks');
  for (const z of [cz - 2, cz + 2]) wallLantern(b, { x: tx1 - 1, y: y0 + 4, z: z + (z < cz ? -1 : 1), facing: 'west', style: 'bracket', arm: 'dark_oak_fence' });
  // Rosette.
  window(b, { x: tx1, y: 15, z: cz, facing: 'west', style: 'round', width: 5, glass: 'blue_stained_glass_pane', stairs: 'stone_brick_stairs' });
  b.set(tx1, 17, cz, 'yellow_stained_glass_pane');
  for (const [dy, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(tx1, 17 + dy, cz + dz, 'red_stained_glass_pane');
  for (const z of [cz - 2, cz - 1, cz, cz + 1, cz + 2]) b.set(tx1 - 1, 14, z, 'stone_brick_slab[type=bottom]');
  // Durchgang ins Langhaus, Leiter, Glocke.
  for (let z = cz - 1; z <= cz + 1; z++) for (let y = y0 + 1; y <= y0 + 5; y++) b.set(tx2, y, z, 'air');
  b.set(tx2, y0 + 5, cz - 1, 'brick_stairs[facing=north,half=top]');
  b.set(tx2, y0 + 5, cz + 1, 'brick_stairs[facing=south,half=top]');
  for (let y = y0 + 1; y < tTop; y++) b.set(cx, y, tz1 + 1, 'ladder[facing=south]');
  b.set(cx, tTop, tz1 + 1, 'spruce_trapdoor[facing=south,half=top,open=false]');
  for (let x = tx1 + 1; x < tx2; x++) b.set(x, 36, cz, 'stripped_dark_oak_log[axis=x]');
  b.set(cx, 35, cz, 'bell[attachment=ceiling,facing=west]');
  lightRoom(b, { x1: tx1 + 1, y1: y0 + 1, z1: tz1 + 1, x2: tx2 - 1, y2: 20, z2: tz2 - 1 });
  lightRoom(b, { x1: tx1 + 1, y1: 22, z1: tz1 + 1, x2: tx2 - 1, y2: 29, z2: tz2 - 1 });
  // Fialen auf den Ecklisenen und achteckiger Kupferhelm.
  for (const [x, z] of [[tx1 - 1, tz1 - 1], [tx2 + 1, tz1 - 1], [tx1 - 1, tz2 + 1], [tx2 + 1, tz2 + 1]]) {
    b.set(x, tTop, z, brickAt(x, tTop, z));
    b.set(x, tTop + 1, z, brickAt(x, tTop + 1, z));
    b.set(x, tTop + 2, z, 'brick_wall');
    b.set(x, tTop + 3, z, 'waxed_oxidized_cut_copper');
    b.set(x, tTop + 4, z, 'waxed_oxidized_lightning_rod[facing=up]');
  }
  const peak = octSpire(b, { x: cx, z: cz, y: tTop + 1, r: 3, h: 20, set: ROOF_SETS.kupfer, salt: 122 });
  // Giebel über jeder Seite (Wimperg) mit Nische, vor dem Helm.
  for (const f of faces) {
    for (let u = 0; u < n; u++) {
      const h = 4 - Math.abs(u - 3);
      const [x, z] = f.wall(u);
      for (let y = tTop + 1; y <= tTop + h; y++) b.set(x, y, z, u === 3 && y >= tTop + 2 && y <= tTop + 3 ? 'calcite' : brickAt(x, y, z));
      b.set(x, tTop + h + 1, z, u === 3 ? 'brick_wall' : `brick_stairs[facing=${u < 3 ? f.hi : f.lo},half=bottom]`);
    }
  }
  b.set(cx, peak + 1, cz, 'gold_block');
  b.set(cx, peak + 2, cz, 'iron_bars');
  b.set(cx, peak + 3, cz, 'iron_bars');
  b.set(cx - 1, peak + 3, cz, 'iron_bars');
  b.set(cx + 1, peak + 3, cz, 'iron_bars');
  b.set(cx, peak + 4, cz, 'iron_bars');
}

// ------------------------------------------------------------------ Marktplatz: Brunnen, Stände, Linden

const octDist = (dx, dz) => Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) * 0.72);

// Marktbrunnen: achteckiges Becken mit Sitzstufe, Mittelstock mit Wasserspeiern, Kapitell, Fialen und Laterne.
function marketFountain(b) {
  const { cx, cz } = MARKET;
  const y0 = OBER;
  for (let dz = -6; dz <= 6; dz++) {
    for (let dx = -6; dx <= 6; dx++) {
      const o = octDist(dx, dz);
      const x = cx + dx;
      const z = cz + dz;
      if (o < 3.5) {
        b.set(x, y0 - 1, z, 'stone_bricks');
        b.set(x, y0, z, 'water[level=0]');
        b.set(x, y0 + 1, z, 'water[level=0]');
      } else if (o < 4.5) {
        const corner = Math.abs(Math.abs(dx) - Math.abs(dz)) <= 1 && Math.abs(dx) >= 2;
        b.set(x, y0 - 1, z, 'stone_bricks');
        b.set(x, y0, z, 'stone_bricks');
        b.set(x, y0 + 1, z, corner ? 'chiseled_stone_bricks' : patch([['stone_bricks', 5], ['mossy_stone_bricks', 1], ['cracked_stone_bricks', 1]], x, y0 + 1, z, 91, 2));
        b.set(x, y0 + 2, z, 'polished_andesite_slab[type=bottom]');
      } else if (o < 5.3) {
        b.set(x, y0 + 1, z, 'stone_brick_slab[type=bottom]');
      }
    }
  }
  // Mittelstock im Wasser.
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const corner = dx !== 0 && dz !== 0;
      for (let y = y0; y <= y0 + 2; y++) b.set(cx + dx, y, cz + dz, corner ? 'polished_andesite' : 'stone_bricks');
      b.set(cx + dx, y0 + 3, cz + dz, corner ? 'stone_brick_wall' : dx === 0 && dz === 0 ? 'chiseled_stone_bricks' : `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=bottom]`);
    }
  }
  for (const [dx, dz, f] of [[2, 0, 'east'], [-2, 0, 'west'], [0, 2, 'south'], [0, -2, 'north']]) b.set(cx + dx, y0 + 2, cz + dz, `weathered_lightning_rod[facing=${f}]`);
  b.set(cx, y0 + 4, cz, 'polished_andesite');
  b.set(cx, y0 + 5, cz, 'stone_brick_wall');
  b.set(cx, y0 + 6, cz, 'chiseled_stone_bricks');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(cx + dx, y0 + 6, cz + dz, `stone_brick_stairs[facing=${towardCenter(dx, dz)},half=top]`);
    b.set(cx + dx, y0 + 7, cz + dz, 'stone_brick_wall');
    b.set(cx + dx, y0 + 8, cz + dz, 'stone_button[face=floor,facing=north]');
  }
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(cx + dx, y0 + 6, cz + dz, 'stone_brick_slab[type=top]');
  b.set(cx, y0 + 7, cz, 'chiseled_stone_bricks');
  b.set(cx, y0 + 8, cz, 'stone_brick_wall');
  b.set(cx, y0 + 9, cz, 'stone_brick_wall');
  b.set(cx, y0 + 10, cz, 'lantern[hanging=false]');
  b.set(cx, y0 + 1, cz + 4, 'lily_pad');
  for (const [dx, dz] of [[2, -2], [-2, 1], [1, 2]]) b.set(cx + dx, y0, cz + dz, 'sea_pickle[pickles=1,waterlogged=true]');
}

const STALL_GOODS = {
  gemuese: ['pumpkin', 'melon', 'carved_pumpkin[facing=south]', 'hay_block[axis=x]'],
  baecker: ['hay_block[axis=z]', 'cake', 'barrel[facing=up]', 'hay_block[axis=x]'],
  tuch: ['white_wool', 'red_wool', 'blue_wool', 'yellow_wool'],
  kraeuter: ['potted_fern', 'flower_pot', 'potted_red_tulip', 'potted_azalea_bush'],
  toepfer: ['decorated_pot[facing=south]', 'flower_pot', 'decorated_pot[facing=east]', 'terracotta'],
  wein: ['barrel[facing=south]', 'barrel[facing=up]', 'brewing_stand', 'barrel[facing=east]'],
  fisch: ['barrel[facing=up]', 'dried_kelp_block', 'barrel[facing=south]', 'packed_ice'],
};

// Marktstand (lokal, Front bei z 2): vier Pfosten, gestreifte Markise, Theke mit Waren, Kisten dahinter.
function marketStall(b, { x, z, facing, color, goods, wood = 'spruce' }) {
  b.transform(plotTransform({ x, y: OBER, z, w: 4, d: 3, facing }), () => {
    const stripe = [COLOR[color].wool, 'white_wool'];
    for (const [px, pz, h] of [[0, 0, 3], [3, 0, 3], [0, 2, 2], [3, 2, 2]]) for (let y = 1; y <= h; y++) b.set(px, y, pz, `${wood}_fence`);
    for (let lx = 0; lx <= 3; lx++) {
      const wool = stripe[lx % 2];
      b.set(lx, 4, 0, wool);
      b.set(lx, 4, 1, wool);
      b.set(lx, 3, 2, wool);
      b.set(lx, 3, 3, `${COLOR[color].carpet}`);
      b.set(lx, 2, 3, `${wood}_trapdoor[facing=south,half=top,open=true]`);
    }
    const list = STALL_GOODS[goods];
    const at = (i) => list[((i % list.length) + list.length) % list.length];
    for (const lx of [1, 2]) {
      b.set(lx, 1, 2, lx === 1 ? 'barrel[facing=south]' : `${wood}_slab[type=top]`);
      b.set(lx, 2, 2, at(lx + x + z));
      b.set(lx, 1, 0, at(lx * 3 + z).startsWith('potted') || at(lx * 3 + z) === 'flower_pot' ? 'barrel[facing=up]' : at(lx * 3 + z));
    }
    b.set(0, 1, 1, 'chest[facing=east,type=single]');
    b.set(3, 1, 1, `${wood}_stairs[facing=west,half=bottom]`);
  });
}

// Baumscheibe mit Sitzbank und Linde.
function marketTree(b, x, z, seed) {
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz));
      if (ring <= 1) b.set(x + dx, OBER, z + dz, ring === 0 ? 'rooted_dirt' : patch([['moss_block', 2], ['grass_block', 3], ['coarse_dirt', 1]], x + dx, OBER, z + dz, 92));
      else if (Math.abs(dx) === 2 && Math.abs(dz) === 2) b.set(x + dx, OBER + 1, z + dz, 'stone_bricks');
      else b.set(x + dx, OBER + 1, z + dz, `spruce_stairs[facing=${towardCenter(-dx, -dz)},half=bottom]`);
    }
  }
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x + dx, OBER + 1, z + dz, choose(['fern', 'short_grass', 'lily_of_the_valley', 'oxeye_daisy'], 93, x + dx, z + dz));
  tree(b, { x, y: OBER + 1, z, species: 'eiche', size: 'klein', seed, roots: false, ground: false });
}

function market(b) {
  b.phase('Marktbrunnen');
  marketFountain(b);
  b.phase('Marktstände und Linden');
  for (const s of [
    { x: 7, z: -10, facing: 'south', color: 'rot', goods: 'gemuese' },
    { x: 12, z: -10, facing: 'south', color: 'gelb', goods: 'baecker' },
    { x: 7, z: 2, facing: 'north', color: 'blau', goods: 'tuch' },
    { x: 12, z: 2, facing: 'north', color: 'gruen', goods: 'kraeuter' },
    { x: 11, z: -5, facing: 'west', color: 'orange', goods: 'toepfer' },
    { x: 15, z: -5, facing: 'east', color: 'violett', goods: 'wein' },
  ]) {
    b.step();
    marketStall(b, s);
  }
  b.step();
  marketTree(b, -12, -8, 1);
  marketTree(b, -12, 3, 2);
  for (const [x, z] of [[-9, -10], [5, -10], [-9, 5], [5, 5]]) lampPost(b, { x, y: OBER + 1, z, height: 4, post: 'dark_oak_fence', base: 'stone_bricks', style: 'top' });
}

export default function build(b) {
  terrain(b);
  townWalls(b);
  castleWalls(b);
  townTowers(b);
  mainGate(b);
  outerGate(b);
  castleGate(b);
  castleOuterGate(b);
  burgStiege(b);
  castleTowers(b);
  bergfried(b);
  palas(b);
  townGround(b);
  terraceWall(b);
  lowerTown(b);
  upperTown(b);
  market(b);
  church(b);
  rathaus(b);
  castleYard(b);
  countryside(b);
}
