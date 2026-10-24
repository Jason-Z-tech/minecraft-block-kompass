// Kapellbrücke mit Wasserturm, Luzern – 1:1 nach echten Maßen (Recherche: docs/recherche/kapellbruecke-luzern.md).
// Bau-Rahmen: das lange Hauptstück läuft genau nach Süden (+z), das Nordende liegt bei (0, 0).
// In Luzern läuft es von Nordost nach Südwest – der ganze Bau ist um 34,5° gedreht. 1 Block = 1 m bei scale 1.

import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'kapellbruecke-luzern',
  title: 'Kapellbrücke mit Wasserturm',
  category: 'infrastruktur',
  subtitle: 'Gedeckte Holzbrücke über die Reuss in Luzern, 203 m lang',
  tags: ['Schweiz', 'Luzern', 'Brücke', 'Holzbrücke', 'Gedeckte Brücke', 'Turm', 'Mittelalter', 'Wahrzeichen', 'Maßstab 1:1', 'Fluss'],
  aliases: [
    'kapellbrücke', 'kapellbruecke', 'kapelbrücke', 'kapellbrucke', 'kapell brücke', 'kappelbrücke', 'kapellbrücke luzern',
    'chapel bridge', 'chapel bridge lucerne', 'kapellbrücke lucerne', 'wasserturm', 'wasserturm luzern', 'water tower lucerne',
    'luzern brücke', 'lucerne bridge', 'holzbrücke luzern', 'gedeckte holzbrücke', 'pont de la chapelle',
  ],
  accuracy: 'massstab',
  difficulty: 4,
  description: 'Die Kapellbrücke in Luzern im Maßstab 1:1: 203 m gedeckte Holzbrücke auf Holzjochen, mit Ziegel-Satteldach, Blumenkästen an beiden Brüstungen und dem Knick am achteckigen Wasserturm. Der Turm ist 34,5 m hoch, rund 12 m breit und innen mit Verlies, zwei Stockwerken und Dachstock eingerichtet; daneben steht der kleine Anbau mit dem Souvenirladen. Die Reuss ist nur als schmaler Wasserstreifen unter der Brücke angedeutet, die Ufer laufen schräg wie in Luzern. Länge, Verlauf und Turmmaße sind belegt, Höhen der Brücke und Dachneigung sind geschätzt.',
  facts: [
    'Heutige Länge 202,9 m (204,7 m mit den Vordächern) – nach der Holzbrücke Säckingen–Stein die zweitlängste gedeckte Holzbrücke Europas.',
    'Ursprünglich war sie rund 279 m lang; im 19. Jahrhundert wurde das Ufer aufgeschüttet und die Brücke gekürzt, das Südende 1833–1838 schräg abgewinkelt.',
    'Gebaut um 1365 als Wehrgang der Stadtbefestigung; 28 Joche im Wasser (20 aus Holz, 8 aus Stein), 27 Felder.',
    'Beim Brand am 18. August 1993 wurde der größte Teil der Brücke und viele der dreieckigen Giebelbilder zerstört; am 14. April 1994 wurde sie wieder eröffnet.',
    'Der achteckige Wasserturm (um 1300, älter als die Brücke) ist 34,5 m hoch, hat 4,4–5 m Seitenlänge und 39 m Umfang; im Verlies sind die Mauern rund 3 m dick.',
    'Im Modell läuft das Hauptstück genau Nord–Süd; in Luzern läuft es von Nordost nach Südwest (um 34,5° gedreht).',
    'Geschätzt (nicht belegt): Höhe der Fahrbahn über dem Wasser, Höhe der Brüstung und des Firsts, Lage der 8 Steinjoche (hier alle Joche aus Holz), Form des Anbaus.',
  ],
  sources: [
    { title: 'Wikipedia (de): Kapellbrücke', url: 'https://de.wikipedia.org/wiki/Kapellbr%C3%BCcke' },
    { title: 'Wikipedia (en): Kapellbrücke', url: 'https://en.wikipedia.org/wiki/Kapellbr%C3%BCcke' },
    { title: 'Wikipedia (de): Wasserturm Luzern', url: 'https://de.wikipedia.org/wiki/Wasserturm_Luzern' },
    { title: 'Luzern Tourismus: Kapellbrücke und Wasserturm', url: 'https://www.luzern.com/de/poi/kapellbruecke' },
    { title: 'Hochschule Luzern: Raumbeschreibung Kappelbrücke (P. Halter, 2021)', url: 'https://blog.hslu.ch/mur-hs21/files/2021/10/Raumbeschreibung-Kappelbruecke_patricia-halter.pdf' },
    { title: 'OpenStreetMap (ODbL): Kapellbrücke, Wasserturm, Reussufer', url: 'https://www.openstreetmap.org/way/396669328' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

// Maße je Maßstab. Bänder = Abstand von der Brückenmitte (in Blöcken).
const SPECS = {
  1: {
    path: [[0, 0], [0, 133], [-18.5, 185.5], [-9, 196]],
    northBank: [[3, -10], [-1, -1], [-3, 4], [-8, 15], [-11, 22], [-34, 66]],
    southBank: [[40, 153], [-8, 194], [-11, 197], [-36, 218]],
    walk: 1.6, wall: 2.6, eave: 3.6, water: 6.6, rim: 7.6, landBeyond: 9, roofOver: 1,
    roofBands: [0.6, 1.6, 2.6, 3.6],
    y: { bed: 0, water: 1, beam: 2, deck: 3, walk: 4, window: 5, eaveBeam: 6, tie: 7, ridge: 9, quay: 2 },
    postEvery: 3, lanternEvery: 9, piles: [-2, 0, 2], spans: 27,
    tower: {
      cx: 8.5, cz: 137.5, a: 6, roofA: 7.5, roofBase: 23, apex: 34, wallTop: 22,
      thickness: (y) => (y <= 2 ? 3 : y <= 18 ? 2 : 1),
      solidBelow: 0, floors: [3, 11, 19], verlies: true,
      door: { x: 3, z: 135 }, ladder: { x: 9, z: 134 }, hatch: { x: 9, z: 135 },
      windows: [
        { x: 8, z: 132, ys: [6, 7], kind: 'bars' }, { x: 14, z: 137, ys: [6, 7], kind: 'bars' }, { x: 8, z: 143, ys: [6, 7], kind: 'bars' },
        { x: 8, z: 132, ys: [14, 15], kind: 'glass' }, { x: 14, z: 138, ys: [14, 15], kind: 'glass' }, { x: 9, z: 143, ys: [14, 15], kind: 'glass' },
        { x: 3, z: 137, ys: [14, 15], kind: 'glass' }, { x: 8, z: 132, ys: [21], kind: 'open' }, { x: 9, z: 143, ys: [21], kind: 'open' },
        { x: 14, z: 136, ys: [21], kind: 'open' },
      ],
    },
    annex: [[0, 136], [3, 138.5], [4.5, 142], [3, 147.5], [-3.5, 146.5], [-1.5, 137]],
  },
  0.5: {
    path: [[0, 0], [0, 66.5], [-9.5, 93], [-4.5, 98]],
    northBank: [[1.5, -5], [-0.5, -0.5], [-1.5, 2], [-4, 7.5], [-5.5, 11], [-17, 33]],
    southBank: [[20, 76.5], [-4, 97], [-5.5, 98.5], [-18, 109]],
    walk: 0.8, wall: 1.8, eave: 2.8, water: 3.3, rim: 4.3, landBeyond: 5, roofOver: 1,
    roofBands: [0.8, 1.8, 2.8],
    y: { bed: 0, water: 1, beam: null, deck: 2, walk: 3, window: 4, eaveBeam: 5, tie: 6, ridge: 7, quay: 1 },
    postEvery: 2, lanternEvery: 6, piles: [-1, 1], spans: 27,
    tower: {
      cx: 4.5, cz: 68.5, a: 3, roofA: 4, roofBase: 12, apex: 17, wallTop: 11,
      thickness: () => 1,
      solidBelow: 1, floors: [2, 7], verlies: false,
      door: { x: 2, z: 67 }, ladder: { x: 4, z: 67 }, hatch: null,
      windows: [
        { x: 5, z: 66, ys: [4], kind: 'bars' }, { x: 7, z: 69, ys: [4], kind: 'bars' }, { x: 5, z: 71, ys: [4], kind: 'bars' },
        { x: 5, z: 66, ys: [9], kind: 'glass' }, { x: 7, z: 68, ys: [9], kind: 'glass' }, { x: 2, z: 69, ys: [9], kind: 'glass' },
      ],
    },
    annex: [[0, 68], [1.5, 69.5], [2.5, 71], [1.5, 74], [-2, 73.5], [-1, 68.5]],
  },
};

const WOOD = {
  planks: 'spruce_planks', slab: 'spruce_slab', stairs: 'spruce_stairs', log: 'spruce_log', beam: 'stripped_spruce_log',
  trapdoor: 'spruce_trapdoor', fence: 'spruce_fence', door: 'spruce_door',
};
const ROOF = { stairs: 'brick_stairs', slab: 'brick_slab', full: 'bricks' };
const TOWER_ROOF = ROOF;
const DIRS = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]];
const key = (x, z) => `${x},${z}`;

// --- Geometrie: Mittellinie, Abstände, Ufer ---

function makePath(points) {
  const segs = [];
  let s0 = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    segs.push({ ax, az, tx, tz, nx: tz, nz: -tx, len, s0 });
    s0 += len;
  }
  return { segs, length: s0 };
}

// Nächster Punkt auf der Mittellinie: d > 0 = Ostseite des Hauptstücks (Seeseite), s = Weg ab Nordende.
function locate(path, x, z) {
  let best = null;
  path.segs.forEach((g, i) => {
    let t = (x - g.ax) * g.tx + (z - g.az) * g.tz;
    if (i > 0) t = Math.max(0, t);
    if (i < path.segs.length - 1) t = Math.min(g.len, t);
    const px = g.ax + g.tx * t;
    const pz = g.az + g.tz * t;
    const dist = Math.hypot(x - px, z - pz);
    if (!best || dist < best.dist - 1e-9) {
      const d = (x - g.ax) * g.nx + (z - g.az) * g.nz;
      best = { dist, d: Math.sign(d) * dist, s: g.s0 + t, seg: g };
    }
  });
  return best;
}

function pointAt(path, s) {
  for (const g of path.segs) {
    if (s <= g.s0 + g.len + 1e-9 || g === path.segs[path.segs.length - 1]) {
      const t = s - g.s0;
      return { x: g.ax + g.tx * t, z: g.az + g.tz * t, seg: g };
    }
  }
  throw new Error('pointAt: Weg nicht gefunden.');
}

// x-Lage einer Uferlinie (Punkte mit steigendem z) bei z, an den Enden verlängert.
function bankX(points, z) {
  let i = 1;
  while (i < points.length - 1 && z > points[i][1]) i++;
  const [ax, az] = points[i - 1];
  const [bx, bz] = points[i];
  return ax + (bx - ax) * (z - az) / (bz - az);
}

function inPolygon(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function inOctagon(u, w, a) {
  const au = Math.abs(u);
  const aw = Math.abs(w);
  return Math.max(au, aw) <= a - 0.5 + 1e-9 && au + aw <= a * Math.SQRT2 + 1e-6;
}

const axisOf = (dx, dz) => (Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z');
const pickBy = (x, y, z, salt, entries) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = hashPosition(x, y, z, salt) % total;
  for (const [value, weight] of entries) {
    if (r < weight) return value;
    r -= weight;
  }
  return entries[entries.length - 1][0];
};

// --- Gestuftes Dach über beliebiger Fläche: Treppen zur höheren Seite, Lücken an Diagonalen geschlossen ---

function placeStepRoof(b, heights, mat, { preferAxis = () => 'x', skip = () => false } = {}) {
  const facings = new Map();
  for (const [k, cell] of heights) {
    const higher = DIRS.filter(([, dx, dz]) => (heights.get(key(cell.x + dx, cell.z + dz))?.h ?? -Infinity) > cell.h);
    if (higher.length === 0) {
      facings.set(k, null);
      continue;
    }
    const axis = preferAxis(cell.x, cell.z);
    const sorted = higher.slice().sort((p, q) => {
      const hp = heights.get(key(cell.x + p[1], cell.z + p[2])).h;
      const hq = heights.get(key(cell.x + q[1], cell.z + q[2])).h;
      if (hp !== hq) return hq - hp;
      return (axisOf(q[1], q[2]) === axis) - (axisOf(p[1], p[2]) === axis);
    });
    facings.set(k, sorted[0][0]);
  }
  for (const [k, cell] of heights) {
    if (skip(cell.x, cell.h, cell.z)) continue;
    const facing = facings.get(k);
    if (facing === null) b.slab(cell.x, cell.h, cell.z, mat.slab);
    else b.stairs(cell.x, cell.h, cell.z, mat.stairs, { facing });
  }
  // Unter höheren Feldern auffüllen, wo die Treppe daneben nicht zu ihnen zeigt (sonst Spalt im Dach).
  const opposite = { east: 'west', west: 'east', south: 'north', north: 'south' };
  for (const cell of heights.values()) {
    let low = cell.h;
    for (const [dir, dx, dz] of DIRS) {
      const n = heights.get(key(cell.x + dx, cell.z + dz));
      if (!n || n.h >= cell.h) continue;
      const covers = facings.get(key(n.x, n.z)) === opposite[dir];
      low = Math.min(low, covers ? n.h + 1 : n.h);
    }
    for (let y = low; y < cell.h; y++) {
      if (!skip(cell.x, y, cell.z) && b.get(cell.x, y, cell.z) === 'air') b.set(cell.x, y, cell.z, mat.full);
    }
  }
}

// --- Bau ---

export default function build(b, { scale = 1 } = {}) {
  const spec = SPECS[scale];
  if (!spec) throw new Error(`Maßstab ${scale} gibt es für die Kapellbrücke nicht (erlaubt: 1, 0.5).`);
  const ctx = analyse(spec);

  buildRiverbed(b, spec, ctx);
  buildTowerMasonry(b, spec, ctx);
  buildPiles(b, spec, ctx);
  buildDeck(b, spec, ctx);
  buildWalls(b, spec, ctx);
  buildAnnexBody(b, spec, ctx);
  buildRoof(b, spec, ctx);
  buildTowerRoof(b, spec, ctx);
  buildTowerInterior(b, spec, ctx);
  buildFlowerBoxes(b, spec, ctx);
  buildQuays(b, spec, ctx);
  buildWater(b, spec, ctx);
}

function analyse(spec) {
  const path = makePath(spec.path);
  const L = path.length;
  const t = spec.tower;
  const cells = new Map();
  const xs = spec.path.map((p) => p[0]);
  const zs = spec.path.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) - spec.rim - 2);
  const x1 = Math.ceil(Math.max(...xs, t.cx + t.roofA) + spec.rim + 2);
  const z0 = Math.floor(Math.min(...zs) - spec.landBeyond - 2);
  const z1 = Math.ceil(Math.max(...zs) + spec.landBeyond + 2);
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const loc = locate(path, x, z);
      const ad = Math.abs(loc.d);
      const tower = inOctagon(x - t.cx, z - t.cz, t.a);
      const towerRoof = inOctagon(x - t.cx, z - t.cz, t.roofA);
      const inSite = ad <= spec.rim && loc.s >= -spec.landBeyond && loc.s <= L + spec.landBeyond;
      const land = loc.s < 0 || loc.s > L || x < bankX(spec.northBank, z) || x > bankX(spec.southBank, z);
      const onBridge = loc.s >= 0 && loc.s <= L;
      const band = ad < spec.walk ? 'walk' : ad < spec.wall ? 'wall' : ad < spec.eave ? 'eave' : 'out';
      const annex = !tower && ad >= spec.wall && loc.d > 0 && inPolygon(spec.annex, x, z);
      cells.set(key(x, z), { x, z, ...loc, ad, tower, towerRoof, inSite, land, onBridge, band, annex });
    }
  }
  return { path, L, cells, bounds: { x0, x1, z0, z1 } };
}

function* eachCell(ctx, filter) {
  for (const c of ctx.cells.values()) if (filter(c)) yield c;
}

// Kapitel 1: Flussbett, Ufer-Fundament und Turmfundament
function buildRiverbed(b, spec, ctx) {
  b.phase('Flussbett und Ufer abstecken',
    `Markiere zuerst den Verlauf: Das lange Hauptstück läuft ${Math.round(ctx.path.segs[0].len)} Blöcke geradeaus nach Süden, dann knickt die Brücke beim Wasserturm leicht nach Westen ab und am Südende schräg nach Südosten. Lege darunter einen schmalen Streifen Flussbett aus Ton, Schlamm und grober Erde an – das Wasser kommt erst ganz am Schluss hinein. Der Rand aus grober Erde hält das Wasser später im Streifen. An den Enden liegen die Ufer: Sie laufen schräg unter der Brücke durch, genau wie in Luzern. Mauere dort gleich den Quai bis auf Ebene ${spec.y.quay + 1} hoch und pflastere ihn (Bruchstein, Andesit, polierter Andesit, an der Kante und unter der Brücke Steinziegel) – auf ihm liegen später die Brückenenden.`,
    { tips: [
      'Setz dir alle 10 Blöcke einen Zaunpfosten auf die Mittellinie – so bleibt die lange Brücke schnurgerade.',
      'Der Knick am Turm ist nur leicht: auf 3 Blöcke nach Süden kommt 1 Block nach Westen.',
    ] });
  const y = spec.y;
  for (const c of eachCell(ctx, (c) => c.inSite && !c.land && !c.tower)) {
    const water = c.ad <= spec.water && c.s > -spec.landBeyond + 1 && c.s < ctx.L + spec.landBeyond - 1;
    b.set(c.x, y.bed, c.z, pickBy(c.x, 0, c.z, 1, [['clay', 5], ['mud', 3], ['coarse_dirt', 2]]));
    if (!water) b.set(c.x, y.water, c.z, 'coarse_dirt');
  }
  // Quai gleich mit anlegen: Auf ihm liegen später die Brückenenden und die Eingangsstufen.
  for (const c of eachCell(ctx, (c) => c.inSite && c.land && !c.tower)) {
    for (let yy = y.bed; yy < y.quay; yy++) b.set(c.x, yy, c.z, c.ad < spec.wall && c.onBridge ? 'stone_bricks' : 'stone');
    b.set(c.x, y.quay, c.z, quaySurface(spec, ctx, c));
  }
  const t = spec.tower;
  for (const c of eachCell(ctx, (c) => c.tower)) {
    for (let yy = y.bed; yy <= y.bed + t.solidBelow; yy++) b.set(c.x, yy, c.z, towerStone(c.x, yy, c.z));
  }
  b.note(0, y.bed, 0, 'Nordende der Brücke (Rathausquai, bei der Peterskapelle).');
  const end = spec.path[spec.path.length - 1];
  b.note(Math.round(end[0]), y.bed, Math.round(end[1]), 'Südende (Seite Luzerner Theater) – hier wurde die Brücke im 19. Jahrhundert gekürzt und abgewinkelt.');
}

// Kapitel 2: Joche (Pfahlreihen) und Längsbalken
function buildPiles(b, spec, ctx) {
  const y = spec.y;
  b.phase('Joche und Unterbau',
    `Die Brücke steht auf ${spec.spans + 1} Jochen – Reihen aus Holzpfählen quer zur Brücke, etwa alle ${(ctx.L / spec.spans).toFixed(1).replace('.', ',')} Blöcke. Ramme die Pfähle aus Fichtenstamm ins Flussbett${y.beam !== null ? ' und leg oben einen Querbalken darauf. Unter den beiden Brüstungen laufen die Längsbalken aus entrindetem Fichtenstamm von Joch zu Joch' : ''}.`,
    { tips: [
      'Zähl beim Abstecken die Joche mit: Wenn eins fehlt, merkst du es sonst erst beim Dach.',
      'In Luzern sind 8 der 28 Joche aus Stein. Wo genau, ist nicht dokumentiert – deshalb sind hier alle aus Holz.',
    ] });
  const topPile = y.beam ?? y.deck - 1;
  for (let k = 0; k <= spec.spans; k++) {
    const s = (ctx.L * k) / spec.spans;
    const p = pointAt(ctx.path, s);
    const g = p.seg;
    for (const v of spec.piles) {
      const x = Math.round(p.x + g.nx * v);
      const z = Math.round(p.z + g.nz * v);
      const c = ctx.cells.get(key(x, z));
      if (!c || c.land || c.tower) continue;
      for (let yy = y.bed; yy <= topPile; yy++) b.set(x, yy, z, 'spruce_log[axis=y]');
    }
    if (y.beam === null) continue;
    const axis = axisOf(g.nx, g.nz);
    const half = spec.wall - 0.6;
    for (let v = -half; v <= half + 1e-9; v += 0.5) {
      const x = Math.round(p.x + g.nx * v);
      const z = Math.round(p.z + g.nz * v);
      const c = ctx.cells.get(key(x, z));
      if (!c || c.land || c.tower) continue;
      if (!spec.piles.some((pv) => Math.round(p.x + g.nx * pv) === x && Math.round(p.z + g.nz * pv) === z)) b.set(x, y.beam, z, `${WOOD.beam}[axis=${axis}]`);
    }
  }
  if (y.beam !== null) {
    for (const c of eachCell(ctx, (c) => c.onBridge && c.band === 'wall' && !c.land && !c.tower)) {
      if (b.get(c.x, y.beam, c.z) !== 'air') continue;
      b.set(c.x, y.beam, c.z, `${WOOD.beam}[axis=${axisOf(c.seg.tx, c.seg.tz)}]`);
    }
  }
}

// Kapitel 3: Gehweg
function buildDeck(b, spec, ctx) {
  const y = spec.y;
  b.phase('Gehweg verlegen',
    `Leg den Boden aus Fichtenbrettern über die ganze Länge: ${Math.round((spec.wall - 0.6) * 2 + 1)} Blöcke breit, die äußersten Reihen tragen später die Brüstung. An beiden Enden führt eine Treppenstufe vom Ufer hinauf.`,
    { tips: ['Arbeite dich von Joch zu Joch vor und setz zuerst die Randreihen – dann siehst du sofort, ob der Knick sauber verläuft.'] });
  for (const c of eachCell(ctx, (c) => c.onBridge && c.ad < spec.wall && !c.tower)) b.set(c.x, y.deck, c.z, WOOD.planks);
  // Eingangsstufen an beiden Enden
  for (const end of [{ s: -0.5, dir: 1 }, { s: ctx.L + 0.5, dir: -1 }]) {
    for (const c of eachCell(ctx, (c) => Math.abs(c.s - end.s) < 0.5 && c.ad < spec.walk)) {
      const g = c.seg;
      const tx = g.tx * end.dir;
      const tz = g.tz * end.dir;
      const facing = axisOf(tx, tz) === 'x' ? (tx > 0 ? 'east' : 'west') : (tz > 0 ? 'south' : 'north');
      b.stairs(c.x, y.deck, c.z, WOOD.stairs, { facing });
    }
  }
}

function isPostCell(spec, c) {
  return Math.floor(c.s + 0.5) % spec.postEvery === 0;
}

// Kapitel 4: Brüstung, Pfosten, Rähm und Zugbalken
function buildWalls(b, spec, ctx) {
  const y = spec.y;
  b.phase('Brüstung und Pfosten',
    `Auf die Randreihen kommt die Brüstung aus Fichtenbrettern, ${y.window - y.walk} Block hoch. Alle ${spec.postEvery} Blöcke steht ein Pfosten aus entrindetem Fichtenstamm bis unters Dach, oben verbindet sie der Rähmbalken. Auf der Seeseite (Osten) ist die Brüstung wie in Luzern höher: Leg dort eine Fichtenstufe obendrauf. Über dem Gehweg spannen die Zugbalken von Pfosten zu Pfosten – an ihnen hängen später die Laternen.`,
    { tips: [
      'Setz erst alle Pfosten, dann die Brüstung dazwischen – so stimmt der Rhythmus über die ganze Länge.',
      'Unter den Zugbalken hängen in Luzern die dreieckigen Giebelbilder. Du kannst dort Gemälde aufhängen.',
    ] });
  for (const c of eachCell(ctx, (c) => c.onBridge && c.band === 'wall' && !c.tower)) {
    const post = isPostCell(spec, c);
    const lake = c.d > 0;
    for (let yy = y.walk; yy < y.eaveBeam; yy++) {
      if (post) b.set(c.x, yy, c.z, `${WOOD.beam}[axis=y]`);
      else if (yy === y.walk) b.set(c.x, yy, c.z, WOOD.planks);
      else if (yy === y.window && lake) b.slab(c.x, yy, c.z, WOOD.slab);
    }
    b.set(c.x, y.eaveBeam, c.z, `${WOOD.beam}[axis=${axisOf(c.seg.tx, c.seg.tz)}]`);
  }
  for (const c of eachCell(ctx, (c) => c.onBridge && c.band === 'walk' && !c.tower && isPostCell(spec, c))) {
    b.set(c.x, y.tie, c.z, `${WOOD.beam}[axis=${axisOf(c.seg.nx, c.seg.nz)}]`);
  }
  // Durchgang zum Wasserturm: Brüstung und Pfosten der Seeseite in der Türreihe herausnehmen
  const door = spec.tower.door;
  for (const c of eachCell(ctx, (c) => c.z === door.z && c.x < door.x && c.d > 0 && c.onBridge && c.band === 'wall' && !c.tower)) {
    for (let yy = y.walk; yy < y.eaveBeam; yy++) b.remove(c.x, yy, c.z);
  }
}

// Kapitel 5: Dach
function buildRoof(b, spec, ctx) {
  const y = spec.y;
  b.phase('Satteldach mit Ziegeln',
    `Das Dach ist ein Satteldach aus Ziegeltreppen, das wie in Luzern weit herunterreicht und an jeder Seite einen Block über die Brüstung hinausragt. Setz die Treppen Reihe für Reihe von außen nach innen, mit der hohen Seite zum First. Der First ist eine Reihe Ziegelstufen. An beiden Enden steht ein Vordach einen Block über den Gehweg hinaus, die Giebeldreiecke darüber schließt du mit Fichtenbrettern. Über dem Anbau am Turm läuft ein Pultdach, das vom Brückendach zum Turm hin ansteigt.`,
    { tips: [
      'Schau beim Setzen der Treppen zum First – dann zeigt die hohe Seite automatisch richtig.',
      'Am Knick entstehen kleine Stufen im Dach. Die Ziegelblöcke darunter schließen die Lücken.',
    ] });
  const heights = new Map();
  const bands = spec.roofBands;
  for (const c of eachCell(ctx, (c) => c.ad < spec.eave && c.s >= -spec.roofOver && c.s <= ctx.L + spec.roofOver && !c.tower)) {
    const e = bands.findIndex((limit) => c.ad < limit);
    heights.set(key(c.x, c.z), { x: c.x, z: c.z, h: y.ridge - e });
  }
  addAnnexRoof(spec, ctx, heights);
  placeStepRoof(b, heights, ROOF, {
    preferAxis: (x, z) => {
      const c = ctx.cells.get(key(x, z));
      return axisOf(c.seg.nx, c.seg.nz);
    },
    skip: (x, yy, z) => ctx.cells.get(key(x, z))?.tower === true,
  });
  // Giebel an beiden Enden schließen
  for (const c of eachCell(ctx, (c) => c.ad < spec.wall && !c.tower && ((c.s >= 0 && c.s < 1) || (c.s > ctx.L - 1 && c.s <= ctx.L)))) {
    const top = heights.get(key(c.x, c.z));
    if (!top) continue;
    for (let yy = y.tie; yy < top.h; yy++) if (b.get(c.x, yy, c.z) === 'air') b.set(c.x, yy, c.z, WOOD.planks);
  }
}

// --- Wasserturm ---

function towerStone(x, y, z) {
  if (y <= 2 && hashPosition(x, y, z, 8) % 3 === 0) return 'mossy_cobblestone';
  return pickBy(x, y, z, 7, [['tuff', 45], ['andesite', 30], ['stone', 25]]);
}

function towerWallCell(t, x, y, z) {
  const u = x - t.cx;
  const w = z - t.cz;
  return inOctagon(u, w, t.a) && !inOctagon(u, w, t.a - t.thickness(y));
}

function buildTowerMasonry(b, spec, ctx) {
  const t = spec.tower;
  b.phase('Wasserturm: Mauern und Böden',
    `Der Wasserturm ist ein Achteck mit ${Math.round(t.a * 2)} Blöcken Breite und ${t.wallTop + 1} Blöcken Mauerhöhe. Setz zuerst die acht Ecken, dann die Seiten dazwischen. ${t.verlies ? 'Ganz unten liegt das Verlies ohne Fenster und Tür: Dort ist die Mauer 3 Blöcke dick, darüber 2 und im Dachstock 1. ' : ''}Die Holzböden der Stockwerke legst du gleich mit, sobald die Mauer ihre Höhe erreicht. Der Eingang liegt auf Höhe des Brückenbodens, direkt neben der Brücke. Die Mischung aus Tuffstein, Andesit und Stein gibt den rauen, grauen Bruchstein-Ton; ganz unten am Wasser kommt etwas bemooster Bruchstein dazu.`,
    { tips: [
      'Mische die Steinsorten zufällig – nur so wirkt die Mauer alt. Bloß keine Muster.',
      'Spar die Fensternischen gleich beim Hochmauern aus: Das Glas sitzt innen, außen bleibt eine Nische.',
    ] });
  const cellsT = [...eachCell(ctx, (c) => c.tower)];
  const floorY = new Set(t.floors);
  const winCells = new Map();
  for (const win of t.windows) for (const yy of win.ys) winCells.set(`${win.x},${yy},${win.z}`, win.kind);
  for (let yy = spec.y.bed + t.solidBelow + 1; yy <= t.wallTop; yy++) {
    for (const c of cellsT) {
      const wall = towerWallCell(t, c.x, yy, c.z);
      if (wall) {
        const win = windowAt(t, winCells, c.x, yy, c.z);
        if (win === 'outer' || win === 'open') continue;
        if (win === 'bars') b.set(c.x, yy, c.z, 'iron_bars');
        else if (win === 'glass') b.set(c.x, yy, c.z, 'glass_pane');
        else if (isDoorCell(spec, c.x, yy, c.z)) continue;
        else b.set(c.x, yy, c.z, towerStone(c.x, yy, c.z));
      } else if (floorY.has(yy)) {
        b.set(c.x, yy, c.z, WOOD.planks);
      }
    }
  }
  b.door(t.door.x, spec.y.walk, t.door.z, WOOD.door, { facing: 'east', hinge: 'left' });
  b.note(t.door.x, spec.y.walk, t.door.z, 'Eingang zum Wasserturm direkt von der Brücke aus.');
}

// Fenster: Liste nennt die äußere Zelle; die innere Zelle der Mauer bekommt Glas/Gitter, außen bleibt die Nische.
function windowAt(t, winCells, x, y, z) {
  const outer = winCells.get(`${x},${y},${z}`);
  if (outer) return outer === 'open' ? 'open' : t.thickness(y) > 1 ? 'outer' : outer;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const kind = winCells.get(`${x - dx},${y},${z - dz}`);
    if (!kind || kind === 'open' || t.thickness(y) < 2) continue;
    const u = x - dx - t.cx;
    const w = z - dz - t.cz;
    // nur der Nachbar nach innen zählt
    if (Math.abs(x - t.cx) + Math.abs(z - t.cz) < Math.abs(u) + Math.abs(w)) return kind;
  }
  return null;
}

// Durchgang: alle Mauerzellen der Türreihe von der Tür bis zum Innenraum (an der Schräge ist die Mauer dicker).
function isDoorCell(spec, x, y, z) {
  const d = spec.tower.door;
  if (z !== d.z || (y !== spec.y.walk && y !== spec.y.walk + 1)) return false;
  return x >= d.x && x < spec.tower.cx;
}

function buildTowerRoof(b, spec, ctx) {
  const t = spec.tower;
  b.phase('Wasserturm: Zeltdach',
    `Das achteckige Zeltdach ist ${t.apex - t.roofBase + 1} Blöcke hoch und steht rundum ${Math.round(t.roofA - t.a)} Block über die Mauer hinaus. Es ist sehr steil: Setz Ring für Ring die Ziegeltreppen mit der hohen Seite zur Turmmitte und füll darunter mit Ziegelblöcken, damit keine Löcher bleiben.`,
    { tips: ['Bau das Dach von innen aus: Stell dich auf den Dachboden und arbeite dich mit Gerüstblöcken hoch.'] });
  const heights = new Map();
  const rMax = t.roofA - 0.5;
  for (const c of eachCell(ctx, (c) => c.towerRoof)) {
    const u = Math.abs(c.x - t.cx);
    const w = Math.abs(c.z - t.cz);
    const r = Math.max(u, w, (u + w) / Math.SQRT2);
    const h = t.roofBase + Math.round(((rMax - r) / (rMax - 0.7)) * (t.apex - t.roofBase));
    heights.set(key(c.x, c.z), { x: c.x, z: c.z, h: Math.min(t.apex, h) });
  }
  placeStepRoof(b, heights, TOWER_ROOF, {
    preferAxis: (x, z) => axisOf(x - t.cx, z - t.cz),
    skip: (x, yy) => yy <= t.wallTop,
  });
}

function buildTowerInterior(b, spec, ctx) {
  const t = spec.tower;
  const y = spec.y;
  b.phase('Einrichtung von Turm und Anbau', 'Richte die Stockwerke so ein, wie sie früher genutzt wurden, und zum Schluss den kleinen Laden im Anbau. Jeder Raum bekommt eine Laterne, damit dort keine Monster erscheinen.');
  const cx = Math.floor(t.cx);
  const cz = Math.floor(t.cz);
  const ladder = t.ladder;

  if (t.verlies) {
    b.step('Verlies', 'Das Verlies ganz unten hat keine Fenster und keine Tür – man kam nur durch eine Luke im Boden darüber hinein. Häng eine Seelenlaterne an die Decke, stell ein paar Ketten und Heuballen hinein und setz die Leiter an die Nordwand unter die Luke.');
    const vy = y.bed + 1;
    b.set(cx, vy + 1, cz, 'soul_lantern[hanging=true]');
    b.set(cx - 2, vy + 1, cz + 1, 'iron_chain[axis=y]');
    b.set(cx + 2, vy + 1, cz - 1, 'iron_chain[axis=y]');
    b.set(cx - 2, vy, cz + 2, 'hay_block');
    b.set(cx + 2, vy, cz + 2, 'cobweb');
    for (let yy = vy; yy <= vy + 1; yy++) b.set(t.hatch.x, yy, t.hatch.z, 'ladder[facing=south]');
    b.set(t.hatch.x, t.floors[0], t.hatch.z, `${WOOD.trapdoor}[facing=south,half=top,open=false]`);
    b.note(t.hatch.x, t.floors[0], t.hatch.z, 'Luke ins Verlies – der einzige Zugang.');
  }

  const f1 = t.floors[0];
  b.step('Erstes Stockwerk: Schatzkammer', 'Hier lag früher der Staatsschatz, heute trifft sich der Artillerieverein. Stell einen Tisch aus Fichtenzaun mit Druckplatte in die Mitte, Stühle aus Fichtentreppen und Truhen und Fässer an die Wände. Die Laterne hängt an der Decke. Setz die Leiter an die Nordwand.');
  furnishRoom(b, spec, f1 + 1, 'treasury');
  for (let yy = f1 + 1; yy <= t.floors[1]; yy++) b.set(ladder.x, yy, ladder.z, 'ladder[facing=south]');

  const f2 = t.floors[1];
  const hasAttic = t.floors.length > 2;
  b.step('Zweites Stockwerk: Archiv', hasAttic
    ? 'Bis 1919 lag hier das Stadtarchiv. Stell Bücherregale an die Wände, dazu ein Lesepult und einen Schreibtisch mit Kerze. Die Leiter führt weiter in den Dachstock.'
    : 'Bis 1919 lag hier das Stadtarchiv. Stell ein Bücherregal und ein Lesepult hinein. Im kleinen Maßstab reicht dieses Stockwerk bis unters Dach – es ist zugleich der Dachstock.');
  furnishRoom(b, spec, f2 + 1, 'archive');
  const atticFloor = t.floors[t.floors.length - 1];
  if (hasAttic) for (let yy = f2 + 1; yy <= atticFloor; yy++) b.set(ladder.x, yy, ladder.z, 'ladder[facing=south]');

  b.step('Dachstock', `${hasAttic ? 'Der Dachstock ist hoch und offen. ' : ''}Stell eine Mittelstütze aus Fichtenstamm bis unter die Dachspitze, leg einen kurzen Balken daran und häng eine Laterne darunter; eine zweite Laterne steht auf dem Boden. In diesem Dachstock wohnt seit 1892 die größte Mauerseglerkolonie der Zentralschweiz.`);
  const atticY = atticFloor + 1;
  const topY = t.apex - 1;
  for (let yy = atticY; yy <= topY; yy++) {
    if (b.get(cx, yy, cz) === 'air') b.set(cx, yy, cz, `${WOOD.beam}[axis=y]`);
  }
  const beamY = Math.min(topY - 2, atticY + Math.round((t.apex - atticY) / 2));
  b.set(cx, beamY - 1, cz + 1, 'lantern[hanging=true]');
  b.set(cx, beamY, cz + 1, `${WOOD.beam}[axis=z]`);
  b.set(cx - 1, atticY, cz - 1, 'barrel[facing=up]');
  b.set(cx + 1, atticY, cz + 2, 'spruce_slab');
  // Licht unten im Dachstock
  b.set(cx + 1, atticY, cz - 1, 'lantern');
  furnishAnnex(b, spec, ctx);
}

function furnishRoom(b, spec, fy, kind) {
  const t = spec.tower;
  const cx = Math.floor(t.cx);
  const cz = Math.floor(t.cz);
  // Ohne eigenen Dachstock (kleiner Maßstab) leuchten die Laternen des Dachstock-Schritts, die Mitte bleibt für die Stütze frei.
  if (kind === 'treasury' || t.floors[2] !== undefined) {
    const ceiling = kind === 'treasury' ? t.floors[1] : t.floors[2];
    b.set(cx, ceiling - 1, cz, 'lantern[hanging=true]');
  }
  const big = t.a >= 5;
  if (kind === 'treasury') {
    if (big) {
      b.set(cx, fy, cz + 1, WOOD.fence);
      b.set(cx, fy + 1, cz + 1, 'spruce_pressure_plate');
      b.stairs(cx - 1, fy, cz + 1, WOOD.stairs, { facing: 'west' });
      b.stairs(cx + 1, fy, cz + 1, WOOD.stairs, { facing: 'east' });
      b.set(cx - 3, fy, cz, 'chest[facing=east]');
      b.set(cx - 3, fy, cz + 1, 'chest[facing=east]');
      b.set(cx + 3, fy, cz + 2, 'barrel[facing=up]');
      b.set(cx + 3, fy, cz + 1, 'barrel[facing=west]');
      b.set(cx + 3, fy + 1, cz + 2, 'barrel[facing=up]');
      b.set(cx, fy, cz + 3, 'red_carpet');
      b.set(cx + 1, fy, cz + 3, 'red_carpet');
    } else {
      b.set(cx - 1, fy, cz + 1, 'chest[facing=east]');
      b.set(cx + 1, fy, cz + 1, 'barrel[facing=up]');
    }
  } else {
    if (big) {
      for (const [x, z, f] of [[cx - 3, cz - 1, 'east'], [cx - 3, cz, 'east'], [cx - 3, cz + 1, 'east'], [cx + 3, cz - 1, 'west'], [cx + 3, cz, 'west'], [cx + 3, cz + 2, 'west']]) {
        b.set(x, fy, z, 'bookshelf');
        b.set(x, fy + 1, z, f === 'east' ? 'chiseled_bookshelf[facing=east,slot_0_occupied=true,slot_1_occupied=true,slot_3_occupied=true,slot_4_occupied=true]' : 'bookshelf');
      }
      b.set(cx, fy, cz + 3, 'lectern[facing=north]');
      b.set(cx + 1, fy, cz + 1, WOOD.planks);
      b.set(cx + 1, fy + 1, cz + 1, 'candle[candles=2,lit=true]');
      b.stairs(cx + 1, fy, cz + 2, WOOD.stairs, { facing: 'south' });
    } else {
      b.set(cx - 1, fy, cz + 1, 'bookshelf');
      b.set(cx + 1, fy, cz + 1, 'lectern[facing=west]');
    }
  }
}

// Anbau zwischen Brücke und Turm (heute Souvenirladen)
function annexInfo(spec, ctx) {
  const cells = [...eachCell(ctx, (c) => c.annex)];
  const set = new Set(cells.map((c) => key(c.x, c.z)));
  const isEdge = (c) => DIRS.some(([, dx, dz]) => {
    const n = ctx.cells.get(key(c.x + dx, c.z + dz));
    return !n || (!set.has(key(n.x, n.z)) && !n.tower && n.ad >= spec.wall);
  });
  const edges = cells.filter(isEdge);
  const inner = cells.filter((c) => !isEdge(c));
  const x0 = Math.min(...cells.map((c) => c.x));
  return { cells, set, edges, inner, isEdge, x0 };
}

// Pultdach: steigt von der Traufe der Brücke nach Osten zum Turm hin an (Reihen entlang z).
function annexRoofHeight(spec, annex, c) {
  return Math.min(spec.y.ridge, spec.y.eaveBeam + Math.max(0, c.x - annex.x0));
}

function buildAnnexBody(b, spec, ctx) {
  const y = spec.y;
  const annex = annexInfo(spec, ctx);
  if (annex.cells.length === 0) return;
  b.phase('Anbau am Turm',
    'Zwischen Brücke und Turm steht ein kleiner Anbau aus Holz – heute ist dort der Souvenirladen. Mauere den Sockel bis zum Brückenboden, leg den Boden auf Brückenhöhe und zieh die Wände aus Fichtenbrettern hoch, an den Ecken Fichtenstamm. Die Wände werden zum Turm hin höher, weil das Pultdach dort ansteigt. Auf der Brückenseite bleibt der Anbau offen: Nimm dort die Brüstung zwischen den Pfosten heraus.',
    { tips: ['Die Form des Anbaus ist aus dem Stadtplan abgeschätzt – Fotos zeigen ihn als niedrigen Holzbau am Turmfuß.'] });
  for (const c of annex.cells) {
    for (let yy = y.bed; yy < y.deck; yy++) b.set(c.x, yy, c.z, towerStone(c.x, yy, c.z));
    b.set(c.x, y.deck, c.z, WOOD.planks);
  }
  for (const c of annex.edges) {
    const corner = DIRS.filter(([, dx, dz]) => !annex.set.has(key(c.x + dx, c.z + dz))).length >= 2;
    const top = annexRoofHeight(spec, annex, c);
    for (let yy = y.walk; yy < top; yy++) {
      const window = !corner && yy === y.window && hashPosition(c.x, 0, c.z, 3) % 2 === 0;
      b.set(c.x, yy, c.z, corner ? `${WOOD.beam}[axis=y]` : window ? 'glass_pane' : WOOD.planks);
    }
  }
  for (const c of annex.cells) {
    if (annex.isEdge(c)) continue;
    for (const [, dx, dz] of DIRS) {
      const n = ctx.cells.get(key(c.x + dx, c.z + dz));
      if (n && n.band === 'wall' && n.onBridge && !isPostCell(spec, n)) {
        for (let yy = y.walk; yy < y.eaveBeam; yy++) b.remove(n.x, yy, n.z);
      }
    }
  }
}

function addAnnexRoof(spec, ctx, heights) {
  const annex = annexInfo(spec, ctx);
  const add = (c) => {
    const k = key(c.x, c.z);
    const h = annexRoofHeight(spec, annex, c);
    const old = heights.get(k);
    if (!old || old.h < h) heights.set(k, { x: c.x, z: c.z, h });
  };
  for (const c of annex.cells) add(c);
  for (const c of annex.edges) {
    for (const [, dx, dz] of DIRS) {
      const n = ctx.cells.get(key(c.x + dx, c.z + dz));
      if (!n || annex.set.has(key(n.x, n.z)) || n.tower || n.ad < spec.wall) continue;
      add(n);
    }
  }
}

function furnishAnnex(b, spec, ctx) {
  const y = spec.y;
  const annex = annexInfo(spec, ctx);
  if (annex.inner.length === 0) return;
  b.step('Souvenirladen im Anbau', 'Stell eine Theke aus Fässern auf, häng Regale an die Wände und eine Laterne unter das Dach.');
  const sorted = annex.inner.slice().sort((p, q) => p.z - q.z || p.x - q.x);
  const lamp = sorted[Math.floor(sorted.length / 2)];
  const roofY = annexRoofHeight(spec, annex, lamp);
  if (roofY - 1 > y.window) b.set(lamp.x, roofY - 1, lamp.z, 'lantern[hanging=true]');
  else b.set(lamp.x, y.walk, lamp.z, 'lantern');
  for (const c of sorted.slice(-2)) if (c !== lamp) b.set(c.x, y.walk, c.z, 'barrel[facing=up]');
  let shelves = 0;
  for (const c of annex.edges) {
    if (shelves >= 4) break;
    const inward = DIRS.find(([, dx, dz]) => {
      const n = ctx.cells.get(key(c.x + dx, c.z + dz));
      return n && annex.set.has(key(n.x, n.z)) && !annex.isEdge(n);
    });
    if (!inward || annexRoofHeight(spec, annex, c) <= y.window) continue;
    const [facing] = inward;
    if (b.get(c.x, y.window, c.z) === 'air') continue;
    const [, dx, dz] = inward;
    if (b.get(c.x + dx, y.window, c.z + dz) !== 'air') continue;
    b.set(c.x + dx, y.window, c.z + dz, `spruce_shelf[facing=${facing}]`);
    shelves++;
  }
}

// Blumenkästen und Laternen
function buildFlowerBoxes(b, spec, ctx) {
  const y = spec.y;
  b.phase('Blumenkästen und Laternen',
    'Außen an beiden Brüstungen hängen die Blumenkästen mit roten und rosa Geranien: ein Block Wurzelerde direkt an der Brüstung, außen eine aufgeklappte Fichtenfalltür als Kastenwand, obendrauf die Blumen. Innen hängen unter jedem dritten Zugbalken Laternen – so bleibt der ganze Gang hell und es erscheinen keine Monster.',
    { tips: [
      'Klapp die Falltür auf, nachdem du sie an die Erde gesetzt hast – dann steht sie senkrecht wie eine Kastenwand.',
      'Geranien gibt es im Spiel nicht: Rote und rosa Tulpen mit ein paar Mohnblumen kommen dem am nächsten.',
    ] });
  const boxCells = [...eachCell(ctx, (c) => c.onBridge && c.band === 'eave' && !c.tower && !c.annex && !c.land
    && c.s > 1 && c.s < ctx.L - 1)];
  const boxSet = new Set(boxCells.map((c) => key(c.x, c.z)));
  for (const c of boxCells) {
    const nearAnnex = DIRS.some(([, dx, dz]) => ctx.cells.get(key(c.x + dx, c.z + dz))?.annex);
    if (nearAnnex) { boxSet.delete(key(c.x, c.z)); continue; }
    b.set(c.x, y.walk, c.z, 'rooted_dirt');
    const flower = pickBy(c.x, 1, c.z, 11, [['red_tulip', 5], ['pink_tulip', 3], ['poppy', 2], ['short_grass', 1]]);
    b.set(c.x, y.window, c.z, flower);
  }
  for (const k of boxSet) {
    const c = ctx.cells.get(k);
    const ox = c.seg.nx * Math.sign(c.d);
    const oz = c.seg.nz * Math.sign(c.d);
    const dir = axisOf(ox, oz) === 'x' ? (ox > 0 ? ['east', 1, 0] : ['west', -1, 0]) : (oz > 0 ? ['south', 0, 1] : ['north', 0, -1]);
    const tx = c.x + dir[1];
    const tz = c.z + dir[2];
    if (boxSet.has(key(tx, tz)) || b.get(tx, y.walk, tz) !== 'air') continue;
    const n = ctx.cells.get(key(tx, tz));
    if (!n || n.tower || n.annex) continue;
    b.set(tx, y.walk, tz, `${WOOD.trapdoor}[facing=${dir[0]},half=bottom,open=true]`);
  }
  // Laternen unter den Zugbalken
  const step = spec.lanternEvery;
  for (let s = step / 2; s < ctx.L; s += step) {
    const p = pointAt(ctx.path, Math.round(s / spec.postEvery) * spec.postEvery);
    const x = Math.round(p.x);
    const z = Math.round(p.z);
    if (b.get(x, y.tie, z) === 'air' || b.get(x, y.tie - 1, z) !== 'air') continue;
    b.set(x, y.tie - 1, z, 'lantern[hanging=true]');
  }
}

// Ufer: Pflaster, Quaimauer, Geländer, Bäume, Bänke
function buildQuays(b, spec, ctx) {
  const y = spec.y;
  b.phase('Ufer und Plätze',
    'Jetzt bekommt der Quai an beiden Enden seine Ausstattung: ein Eisengeländer auf der Quaimauer am Wasser, eine Laterne, eine Bank und eine Linde, die den Platz gemütlich machen.',
    { tips: ['Lass am Brückeneingang das Geländer weg, damit man auf die Stufe kommt.'] });
  const landCells = [...eachCell(ctx, (c) => c.inSite && c.land && !c.tower)];
  const landSet = new Set(landCells.map((c) => key(c.x, c.z)));
  for (const c of landCells) {
    if (c.onBridge && c.ad < spec.wall) continue;
    const shore = isShoreCell(ctx, c);
    const nearEntrance = Math.abs(c.ad) < spec.eave + 0.5 && (c.s < 0.5 || c.s > ctx.L - 0.5) && c.s > -2.5 && c.s < ctx.L + 2.5;
    if (shore && !nearEntrance && !c.onBridge) b.set(c.x, y.quay + 1, c.z, 'iron_bars');
  }
  // Ausstattung je Ende: Laterne, Bank, Baum
  for (const end of [{ s: -spec.landBeyond + 3, side: -1 }, { s: ctx.L + spec.landBeyond - 3, side: 1 }]) {
    const p = pointAt(ctx.path, Math.max(0, Math.min(ctx.L, end.s)));
    const g = p.seg;
    const ext = end.s < 0 ? end.s : end.s - ctx.L;
    const bx = p.x + g.tx * ext;
    const bz = p.z + g.tz * ext;
    const place = (v, fn) => {
      const x = Math.round(bx + g.nx * v);
      const z = Math.round(bz + g.nz * v);
      if (landSet.has(key(x, z))) fn(x, z);
    };
    const off = spec.walk + 2;
    place(off, (x, z) => lampPost(b, x, y.quay + 1, z, scaleTall(spec)));
    place(-off, (x, z) => tree(b, x, y.quay + 1, z, spec));
    const benchV = off + 2;
    place(benchV, (x, z) => {
      if (b.get(x, y.quay + 1, z) !== 'air') return;
      const facing = axisOf(g.tx, g.tz) === 'z' ? (end.side < 0 ? 'north' : 'south') : 'east';
      b.stairs(x, y.quay + 1, z, WOOD.stairs, { facing });
    });
  }
}

function isShoreCell(ctx, c) {
  return DIRS.some(([, dx, dz]) => {
    const n = ctx.cells.get(key(c.x + dx, c.z + dz));
    return n && n.inSite && !n.land;
  });
}

// Oberfläche des Quais: unter der Brücke und an der Quaimauer Steinziegel, sonst Pflaster.
function quaySurface(spec, ctx, c) {
  if ((c.onBridge && c.ad < spec.wall) || isShoreCell(ctx, c)) return 'stone_bricks';
  return pickBy(c.x, 2, c.z, 5, [['cobblestone', 4], ['andesite', 3], ['polished_andesite', 3]]);
}

const scaleTall = (spec) => (spec.walk > 1 ? 3 : 2);

function lampPost(b, x, y, z, height) {
  for (let i = 0; i < height; i++) b.set(x, y + i, z, 'dark_oak_fence');
  b.set(x, y + height, z, 'lantern');
}

function tree(b, x, y, z, spec) {
  const big = spec.walk > 1;
  const h = big ? 5 : 3;
  b.set(x, y - 1, z, 'grass_block');
  for (let i = 0; i < h; i++) b.set(x, y + i, z, 'oak_log[axis=y]');
  const r = big ? 2 : 1;
  for (let dy = h - 2; dy <= h + 1; dy++) {
    const rr = dy >= h + 1 ? r - 1 : r;
    for (let dx = -rr; dx <= rr; dx++) {
      for (let dz = -rr; dz <= rr; dz++) {
        if (Math.abs(dx) === rr && Math.abs(dz) === rr && hashPosition(x + dx, y + dy, z + dz, 9) % 2 === 0) continue;
        if (b.get(x + dx, y + dy, z + dz) === 'air') b.set(x + dx, y + dy, z + dz, 'oak_leaves');
      }
    }
  }
}

// Zum Schluss: Wasser
function buildWater(b, spec, ctx) {
  const y = spec.y;
  b.phase('Wasser einfüllen',
    'Ganz am Schluss kommt die Reuss: Füll den Streifen mit Wasserquellen. Mit einer unendlichen Wasserquelle (zwei Eimer in eine Ecke) geht das schnell. Ein paar Seegrasbüschel machen das Flussbett lebendig.',
    { tips: ['Fang an einem Ende an und arbeite dich zum anderen vor – sonst fließt das Wasser in noch offene Ecken.'] });
  for (const c of eachCell(ctx, (c) => c.inSite && !c.land && !c.tower && c.ad <= spec.water && c.s > -spec.landBeyond + 1 && c.s < ctx.L + spec.landBeyond - 1)) {
    if (b.get(c.x, y.water, c.z) !== 'air') continue;
    const grass = c.ad > spec.wall && hashPosition(c.x, 3, c.z, 13) % 17 === 0;
    b.set(c.x, y.water, c.z, grass ? 'seagrass' : 'water');
  }
}
