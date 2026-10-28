// Tokyo Skytree nach echten Maßen. Grundlage: docs/recherche/tokyo-skytree.md.
// Kennzeichen wie in der Recherche: B belegt, S Sekundärquelle, R Rechnung, G geschätzt, I Annahme für den Bau.
// Alle Maße in Metern; der Maßstab s rechnet sie in Blöcke um (1 Block = 1 m bei s = 1).

export const meta = {
  id: 'tokyo-skytree',
  title: 'Tokyo Skytree',
  category: 'wahrzeichen',
  subtitle: 'Fernseh- und Aussichtsturm in Tokio, 634 m',
  tags: ['Japan', 'Tokio', 'Asien', 'Turm', 'Fernsehturm', 'Aussichtsturm', 'Fachwerk', 'Riesig', 'Maßstab 1:1'],
  aliases: [
    'skytree', 'sky tree', 'sky-tree', 'tokyo sky tree', 'tokyo skytree', 'tokio skytree', 'tokio sky tree',
    'skytree tokio', 'skytree tokyo', 'skytre', 'fernsehturm tokio', 'tokio fernsehturm', 'tembo deck', 'tembo galleria',
    '東京スカイツリー', 'スカイツリー',
  ],
  accuracy: 'massstab',
  description: 'Der 634 m hohe Turm in Tokio, 1 Block = 1 m (oder 1:2, 1:4). Exakt nach Quellen gebaut: alle Höhen '
    + '(Beine bis 50 m, Tembo Deck 340/345/350 m, Galleria 445–450 m, Turmkörper bis 497 m, Spitze 634 m), das '
    + 'Fuß-Dreieck mit 68 m Seite, die Mittelsäule (⌀ 8 m, 375 m), der Mast-⌀ 6 m und die Ringe alle 12,5 m. '
    + 'Geschätzt sind die Breiten zwischen diesen Höhen und die Plattform-Durchmesser (an einer Zeichnung vermessen), '
    + 'der Übergang vom Dreieck zum Kreis, Zahl der Diagonalen, Aufbau der Beine, Schacht, Antennenstufen und Kopf. '
    + 'Vereinfacht: Eine Ecke zeigt genau nach Norden (echt 6,5° gedreht).',
  sources: [
    { title: 'Tokyo Skytree: Outline (Betreiber)', url: 'https://en.tokyo-skytree.jp/about/outline/' },
    { title: 'Tokyo Skytree: Specifications', url: 'https://en.tokyo-skytree.jp/about/spec/' },
    { title: 'Tokyo Skytree: Structural Design (Nikken Sekkei)', url: 'https://en.tokyo-skytree.jp/about/spec/structure/' },
    { title: 'Tokyo Skytree: Color Palette (Skytree White)', url: 'https://en.tokyo-skytree.jp/about/design/color/' },
    { title: 'Tokyo Skytree: Tembo Deck Floor 350', url: 'https://en.tokyo-skytree.jp/floor/tembodeck_350/' },
    { title: 'Tokyo Skytree: Tembo Deck Floor 340', url: 'https://www.tokyo-skytree.jp/floor/tembodeck_340/' },
    { title: 'Tokyo Skytree: Tembo Galleria', url: 'https://en.tokyo-skytree.jp/floor/tembogalleria/' },
    { title: 'Kobori, Konishi (Nikken Sekkei): Structural Design of Tokyo Skytree, EASEC-13 (2013)', url: 'https://eprints.lib.hokudai.ac.jp/repo/huscap/all/54505/KeynoteLecture_6.pdf' },
    { title: 'Nikken Sekkei: Technology and Sensibility – TOKYO SKYTREE', url: 'https://www.nikken.jp/en/about/projects_history/corporate_history/12_03.html' },
    { title: 'Obayashi: 東京スカイツリーのつくり方 (Bauablauf)', url: 'https://www.obayashi.co.jp/solution_technology/skytree_index.html' },
    { title: 'Obayashi: Beine vereinigen sich auf 50 m', url: 'https://www.obayashi.co.jp/solution_technology/detail/skytree07.html' },
    { title: 'Obayashi: Gain Tower und Turmkopf', url: 'https://www.obayashi.co.jp/solution_technology/detail/skytree23.html' },
    { title: 'Obayashi: Mittelsäule (心柱)', url: 'https://www.obayashi.co.jp/solution_technology/detail/skytree25.html' },
    { title: 'Wikipedia (ja): 東京スカイツリー', url: 'https://ja.wikipedia.org/wiki/東京スカイツリー' },
    { title: 'Wikipedia (en): Tokyo Skytree', url: 'https://en.wikipedia.org/wiki/Tokyo_Skytree' },
    { title: 'Breitenprofil (geschätzt): Commons-Zeichnung „Tokyo Sky Tree – Silhouette & Cross section“, Namazu-tron, CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Tokyo_Sky_Tree_-_Silhouette_%26_Cross_section.svg' },
    { title: 'Ausrichtung (geschätzt): OpenStreetMap über Overpass API, © OpenStreetMap-Mitwirkende, ODbL', url: 'https://overpass-api.de/' },
  ],
  credits: null,
  scales: [1, 0.5, 0.25],
  tested: null,
};

const TAU = Math.PI * 2;
const SQRT3 = Math.sqrt(3);
// Turmachse zwischen zwei Blöcken: die geraden Durchmesser 8, 10, 18 (1:1) liegen so symmetrisch.
const AXIS = 0.5;

// --- Maße (m) ---
const H_TOP = 634; // B Spitze Blitzableiter
const H_BODY = 497; // B Oberkante Turmkörper
const H_LEGS = 50; // B Beine vereinigt
const H_COLUMN = 375; // B Mittelsäule
const H_CIRCLE = 320; // S Querschnitt ist ein Kreis
const DECK_FLOORS = [340, 345, 350]; // B
const DECK_GLASS_TOP = 356; // I Oberkante der Verglasung über Etage 350
const DECK_ROOF = 364; // G Dach des Tembo Deck (Zeichnung)
const GALLERIA_LOW = 445; // B
const GALLERIA_HIGH = 450; // B
const GALLERIA_RAMP_LENGTH = 110; // S
const GAIN_HEAD = 620; // R/G Unterkante Kopf (634 − 14)
const HEAD_ROOF = 628; // I Dach des zweigeschossigen Kopfes
const FOOT_SIDE = 68; // B Seite des Fuß-Dreiecks
const LEG_SPACING = 14; // I Stützenabstand im Bein (Bein-Band der Zeichnung 17–20 m inkl. Rohr)
const ANTENNA_STAGES = [[507, 517], [532, 542], [557, 567], [582, 592]]; // I Anzahl und Höhen unbekannt (U)

// Silhouettenbreite des Turmkörpers (m) über der Höhe, frontal auf eine Dreiecksseite gesehen.
// 0 m: B (68 m); sonst G aus der Commons-Zeichnung; 452–497 m auf die belegte Höhe gestreckt.
const BODY_WIDTH = [
  [0, 68], [25, 64], [50, 60], [75, 56], [100, 52.5], [125, 48], [150, 45.5], [170, 44], [200, 41.5], [225, 39],
  [245, 37.5], [275, 35], [300, 33], [320, 32], [364, 30.5], [370, 30.5], [375, 25.5], [400, 23.5], [420, 22],
  [452, 18.5], [497, 16.3],
];
// Seitenverhältnis Breite/Tiefe der Querschnitts-Symbole der Zeichnung (G); 0 m = exaktes Dreieck.
const SECTION_RATIO = [[0, 2 / SQRT3], [170, 1.05], [245, 1.03], [H_CIRCLE, 1]];
// Außenradius (m) der Tembo-Deck-Schüssel (G, Zeichnung).
const DECK_RADIUS = [[322, 16], [325, 20], [340, 25.5], [345, 27], [350, 28.75], [356, 28.75], [DECK_ROOF, 28]];
// Außenradius (m) der Galleria-Schüssel (G, Zeichnung) und der Halle auf 450 m.
const GALLERIA_RADIUS = [[425, 12], [430, 15.75], [440, 18.5], [GALLERIA_LOW, 20]];
const GALLERIA_HALL_RADIUS = 15.75;

const M = {
  steel: 'white_concrete',
  panel: 'smooth_quartz',
  shaft: 'calcite',
  column: 'light_gray_concrete',
  floor: 'smooth_stone',
  // Volle Glasblöcke statt Scheiben: an gekrümmten Fassaden verbinden sich Scheiben nur teilweise.
  deckGlass: 'light_gray_stained_glass',
  glass: 'glass',
  light: 'sea_lantern',
  antenna: 'iron_bars',
  iron: 'iron_block',
  cable: 'iron_chain[axis=y]',
  stairs: 'polished_andesite_stairs',
  stairSupport: 'polished_andesite',
  ramp: 'smooth_quartz',
  rampSlab: 'smooth_quartz_slab[type=bottom]',
  rod: 'lightning_rod[facing=up]',
};

// ---------------------------------------------------------------- Mathematik

// Monotone kubische Interpolation (Fritsch–Carlson): glatt, ohne Überschwinger.
function monotoneCubic(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const len = a * a + b * b;
    if (len > 9) {
      const tau = 3 / Math.sqrt(len);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Polarradius eines gleichseitigen Dreiecks mit Seite 1, Ecke bei Peilung 0 (Norden), Peilung im Uhrzeigersinn.
function triangleRadius(phi) {
  const sector = TAU / 3;
  const a = (((phi % sector) + sector) % sector) - sector / 2;
  return 1 / (2 * SQRT3) / Math.cos(a);
}

// Querschnitt: Dreieck (t = 0) → Kreis (t = 1), Polarradien gemischt (Recherche 7.3).
function blendRadius(phi, t) {
  return (1 - t) * triangleRadius(phi) + t * 0.5;
}

function bearing(dx, dz) {
  const phi = Math.atan2(dx, -dz);
  return phi < 0 ? phi + TAU : phi;
}

// Auf 1e-6 gerundet: sin/cos weichen zwischen Node und Chrome im letzten Bit ab, ohne Rundung kippen
// einzelne Blöcke an .5-Grenzen (Katalog und Bau-Seite hätten sonst verschiedene Blockzahlen).
const snapCoord = (v) => Math.round(v * 1e6) / 1e6;

function polarPoint(phi, r, y) {
  return [snapCoord(AXIS + r * Math.sin(phi)), y, snapCoord(AXIS - r * Math.cos(phi))];
}

// Tabelle Rundungsgrad t → Breite und Seitenverhältnis der Mischform.
function createSectionTable() {
  const steps = 400;
  const samples = 720;
  const rows = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (let j = 0; j < samples; j++) {
      const phi = (j / samples) * TAU;
      const r = blendRadius(phi, t);
      const x = r * Math.sin(phi);
      const z = -r * Math.cos(phi);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    rows.push({ t, width: maxX - minX, ratio: (maxX - minX) / (maxZ - minZ) });
  }
  return {
    width(t) {
      const f = Math.min(1, Math.max(0, t)) * steps;
      const i = Math.min(steps - 1, Math.floor(f));
      return rows[i].width + (rows[i + 1].width - rows[i].width) * (f - i);
    },
    tForRatio(ratio) {
      if (ratio >= rows[0].ratio) return 0;
      for (let i = 0; i < steps; i++) {
        const a = rows[i].ratio;
        const b = rows[i + 1].ratio;
        if (ratio <= a && ratio >= b) return rows[i].t + (rows[i + 1].t - rows[i].t) * (a === b ? 0 : (a - ratio) / (a - b));
      }
      return 1;
    },
  };
}

// ---------------------------------------------------------------- Maßstab und Geometrie

function nearestOdd(value) {
  const low = Math.max(1, Math.floor(value));
  const odd = low % 2 === 1 ? low : low + 1;
  const below = odd - 2;
  return below >= 1 && Math.abs(value - below) < Math.abs(value - odd) ? below : odd;
}

function scaleConfig(s) {
  const fine = s >= 0.75;
  const mid = s >= 0.375;
  return {
    s,
    fine,
    mid,
    ridgeT: fine ? 3 : 1,
    legT: fine ? 3 : 1,
    memberT: fine ? 2 : 1,
    ringStep: mid ? 12.5 : 25,
    spokeStep: mid ? 25 : 50,
    // Felder des Rautennetzes je Richtung (I): bei 1:1 Winkel der Diagonalen ≈ 19–30° wie die Abzweige [Q16];
    // kleinere Maßstäbe weniger Felder, damit zwischen 1-Block-Rohren Luft bleibt.
    kLower: fine ? 12 : mid ? 9 : 6,
    kUpper: mid ? 6 : 3,
    // Kern: Radien in Blöcken um AXIS (gerade Durchmesser).
    columnR: fine ? 4 : mid ? 2 : 1,
    cavityR: fine ? 6 : mid ? 3 : 2,
    shaftR: fine ? 9 : mid ? 5 : 2,
    mullionSpacing: fine ? 4 : mid ? 4 : 5,
    tubeFrames: fine ? 22 : mid ? 11 : 0,
  };
}

function createGeometry(s) {
  const section = createSectionTable();
  const bodyWidth = monotoneCubic(BODY_WIDTH);
  const ratioAt = monotoneCubic(SECTION_RATIO);
  const deckRadius = monotoneCubic(DECK_RADIUS);
  const galleriaRadius = monotoneCubic(GALLERIA_RADIUS);
  const tAt = (h) => (h >= H_CIRCLE ? 1 : section.tForRatio(ratioAt(h)));
  return {
    s,
    bodyWidth,
    tAt,
    deckRadius,
    galleriaRadius,
    yOf: (h) => Math.round(h * s), // erste Ebene über der Höhe h (Oberfläche bei h)
    // Umriss des Turmkörpers auf Höhe h: Polarradius in Blöcken, Silhouettenbreite = Breitenprofil.
    outline(h) {
      const t = tAt(h);
      const k = (bodyWidth(h) * s) / section.width(t);
      return { t, radius: (phi) => k * blendRadius(phi, t) };
    },
  };
}

// Block-y der Rohrmitte auf Höhe h: gerade Dicke → zwischen zwei Ebenen, ungerade → auf einer Ebene.
function memberY(h, s, thickness) {
  return thickness % 2 === 0 ? Math.round(h * s) - 0.5 : Math.round(h * s - 0.5);
}

// ---------------------------------------------------------------- Blockspeicher

// Sammelt alle Blöcke, bevor sie kapitelweise (nach Höhe) gesetzt werden. Späteres Setzen gewinnt; null = Luft.
function createStore() {
  const layers = new Map();
  const key = (x, z) => (x + 512) * 1024 + (z + 512);
  return {
    layers,
    put(x, y, z, state) {
      if (y < 0) return;
      if (Math.abs(x) > 500 || Math.abs(z) > 500) throw new Error(`Skytree: Block außerhalb des Bereichs (${x}, ${z}).`);
      let layer = layers.get(y);
      if (!layer) {
        layer = new Map();
        layers.set(y, layer);
      }
      layer.set(key(x, z), state);
    },
    get(x, y, z) {
      return layers.get(y)?.get(key(x, z)) ?? null;
    },
  };
}

// ---------------------------------------------------------------- Licht gegen Monster

// In 26.2 spawnen Monster nur bei Blocklicht 0. Rechnung wie findDarkSpots in js/builds/lib/innen.js: Licht −1 je
// Block, nur durch Luft und dünne Blöcke (Ketten, Gitter, Leiter, Blitzableiter); im Zweifel blockiert ein Block.
const LIGHT_LEVEL = 15; // Seelaterne
const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function passesLight(state) {
  return state === null || state === M.cable || state === M.antenna || state === M.rod || state.startsWith('ladder[');
}

// Jedes begehbare, überdachte Feld (Luft mit Block darunter) im Raum bekommt Blocklicht > 0. Wo es fehlt, kommt eine
// Seelaterne in den Steinboden darunter oder – auf Simsen und Rohren – stehend auf das Feld. Rückgabe: Zahl der Lampen.
function lightInterior(store, box, isInside) {
  const { x1, y1, z1, x2, y2, z2 } = box;
  const sx = x2 - x1 + 1;
  const sz = z2 - z1 + 1;
  const light = new Uint8Array(sx * sz * (y2 - y1 + 1));
  const index = (x, y, z) => ((y - y1) * sz + (z - z1)) * sx + (x - x1);
  const inBox = (x, y, z) => x >= x1 && x <= x2 && y >= y1 && y <= y2 && z >= z1 && z <= z2;
  const spread = (queue) => {
    for (let head = 0; head < queue.length; head += 3) {
      const [x, y, z] = [queue[head], queue[head + 1], queue[head + 2]];
      const next = light[index(x, y, z)] - 1;
      if (next <= 0) continue;
      for (const [dx, dy, dz] of NEIGHBORS) {
        const [nx, ny, nz] = [x + dx, y + dy, z + dz];
        if (!inBox(nx, ny, nz)) continue;
        const i = index(nx, ny, nz);
        if (light[i] >= next || !passesLight(store.get(nx, ny, nz))) continue;
        light[i] = next;
        queue.push(nx, ny, nz);
      }
    }
  };
  const sources = [];
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (store.get(x, y, z) !== M.light) continue;
        light[index(x, y, z)] = LIGHT_LEVEL;
        sources.push(x, y, z);
      }
    }
  }
  spread(sources);
  const topY = Math.max(...store.layers.keys());
  const sheltered = (x, y, z) => {
    for (let yy = y + 1; yy <= topY; yy++) if (store.get(x, yy, z) !== null) return true;
    return false;
  };
  let placed = 0;
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (light[index(x, y, z)] > 0 || store.get(x, y, z) !== null) continue;
        const below = store.get(x, y - 1, z);
        if (below === null || !isInside(x, y, z) || !sheltered(x, y, z)) continue;
        const [lx, ly, lz] = below === M.floor && y - 1 >= y1 ? [x, y - 1, z] : [x, y, z];
        store.put(lx, ly, lz, M.light);
        light[index(lx, ly, lz)] = LIGHT_LEVEL;
        spread([lx, ly, lz]);
        placed++;
      }
    }
  }
  return placed;
}

function axisBox(radius, ya, yb) {
  const r = Math.ceil(radius) + 1;
  return { x1: Math.floor(AXIS - r), x2: Math.ceil(AXIS + r), z1: Math.floor(AXIS - r), z2: Math.ceil(AXIS + r), y1: ya, y2: yb };
}

const distanceToAxis = (x, z) => Math.hypot(x - AXIS, z - AXIS);

// Innenräume: Tembo Deck, Tembo Galleria (Etage 445, Röhre, Halle 450), Nottreppe in der Mittelsäule, Kopf.
function lightInteriors(store, geo, cfg) {
  const { s } = cfg;
  const deckFloors = deckFloorYs(geo);
  const deckRoof = geo.yOf(DECK_ROOF) - 1;
  const deckR = (y) => geo.deckRadius((y + 0.5) / s) * s;
  lightInterior(store, axisBox(deckR(deckRoof) + 1, deckFloors[0], deckRoof - 1), (x, y, z) => {
    const d = distanceToAxis(x, z);
    return d > cfg.shaftR && d <= deckR(y);
  });
  const g = galleriaLayout(geo, cfg);
  lightInterior(store, axisBox(g.rOut, g.lowFloor, g.hallRoof - 1), (x, y, z) => {
    const d = distanceToAxis(x, z);
    return d > cfg.cavityR && d <= g.rOut;
  });
  if (cfg.fine) {
    lightInterior(store, axisBox(cfg.columnR, 0, geo.yOf(H_COLUMN) - 1), (x, y, z) => distanceToAxis(x, z) < cfg.columnR);
  }
  const head = headLayout(geo, cfg);
  lightInterior(store, axisBox(head.d / 2 + 1, head.bottom - 1, head.top - 2), (x, y, z) => Math.hypot(x - head.c, z - head.c) < head.d / 2);
}

// Rohr als Vierkant-Balken: entlang der Hauptachse je Schritt ein Quadrat aus thickness × thickness Blöcken.
// thickness 1 → flächenverbundene Linie (keine Lücken an schrägen Stellen).
function tube(store, a, b, thickness, state) {
  if (thickness <= 1) {
    thinLine(store, a, b, state);
    return;
  }
  const delta = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const main = [0, 1, 2].reduce((best, k) => (Math.abs(delta[k]) > Math.abs(delta[best]) ? k : best), 1);
  const [u, v] = [0, 1, 2].filter((k) => k !== main);
  const n = Math.max(1, Math.ceil(Math.abs(delta[main])));
  const half = (thickness - 1) / 2;
  for (let i = 0; i <= n; i++) {
    const p = delta.map((d, k) => a[k] + (d * i) / n);
    const cell = [0, 0, 0];
    cell[main] = Math.round(p[main]);
    const u0 = Math.round(p[u] - half);
    const v0 = Math.round(p[v] - half);
    for (let du = 0; du < thickness; du++) {
      for (let dv = 0; dv < thickness; dv++) {
        cell[u] = u0 + du;
        cell[v] = v0 + dv;
        store.put(cell[0], cell[1], cell[2], state);
      }
    }
  }
}

function thinLine(store, a, b, state) {
  const len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
  const n = Math.max(1, Math.ceil(len * 2));
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t));
    if (prev) {
      // Schrittweise je Achse, damit die Linie über Flächen verbunden bleibt.
      for (const k of [1, 0, 2]) {
        if (prev[k] !== p[k]) {
          prev = prev.slice();
          prev[k] = p[k];
          store.put(prev[0], prev[1], prev[2], state);
        }
      }
    } else {
      store.put(p[0], p[1], p[2], state);
    }
    prev = p;
  }
}

// Randtiefe in einer Ebene: Blöcke im Umriss (Abstand zur Achse ≤ radius(φ)), Tiefe 1 = berührt außen eine Fläche.
// Liefert [{ x, z, depth, phi, d }] bis maxDepth (Infinity = alle). Tiefe über Flächen gezählt → dicht.
// dense: Tiefe 1 auch bei Außenluft über Eck – so ist ein 1 Block breiter Ring flächenverbunden (keine Lücken über Eck).
function rimCells(radiusOf, maxRadius, maxDepth, cx = AXIS, cz = AXIS, { dense = false } = {}) {
  const x0 = Math.floor(cx - maxRadius - 2);
  const z0 = Math.floor(cz - maxRadius - 2);
  const size = Math.ceil(2 * maxRadius + 5);
  const inside = new Uint8Array(size * size);
  const depth = new Uint16Array(size * size);
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const dx = x0 + ix - cx;
      const dz = z0 + iz - cz;
      const d = Math.hypot(dx, dz);
      if (d <= radiusOf(bearing(dx, dz)) + 1e-9) inside[iz * size + ix] = 1;
    }
  }
  let frontier = [];
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const i = iz * size + ix;
      if (!inside[i]) continue;
      const out = !inside[i - 1] || !inside[i + 1] || !inside[i - size] || !inside[i + size]
        || (dense && (!inside[i - size - 1] || !inside[i - size + 1] || !inside[i + size - 1] || !inside[i + size + 1]));
      if (out) {
        depth[i] = 1;
        frontier.push(i);
      }
    }
  }
  for (let level = 2; level <= maxDepth && frontier.length > 0; level++) {
    const next = [];
    for (const i of frontier) {
      for (const j of [i - 1, i + 1, i - size, i + size]) {
        if (inside[j] && depth[j] === 0) {
          depth[j] = level;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  const cells = [];
  for (let iz = 0; iz < size; iz++) {
    for (let ix = 0; ix < size; ix++) {
      const i = iz * size + ix;
      if (!inside[i]) continue;
      const level = depth[i] === 0 ? Infinity : depth[i];
      if (level > maxDepth) continue;
      const x = x0 + ix;
      const z = z0 + iz;
      cells.push({ x, z, depth: level, phi: bearing(x - cx, z - cz), d: Math.hypot(x - cx, z - cz) });
    }
  }
  return cells;
}

const circleCells = (radius, maxDepth, cx = AXIS, cz = AXIS) => rimCells(() => radius, radius, maxDepth, cx, cz);

// Rotationsschale (dicht): Blöcke im Körper d ≤ R(y), die außen eine Fläche berühren. innerSkip lässt die Mitte frei.
// Wächst die Schale nach oben, liegt auch über dem Rand der Ebene darunter ein Block; zieht sie sich ein, auch unter dem
// Rand der Ebene darüber. So hat jede Ebene eine Stütze direkt darunter und lässt sich ohne Hilfsblöcke ansetzen.
function revolveShell(store, { y1, y2, radiusAtY, stateOf, bottom = true, top = true, innerSkip = 0 }) {
  const inside = (x, y, z) => y >= y1 && y <= y2 && Math.hypot(x - AXIS, z - AXIS) <= radiusAtY(y);
  const sideAt = (x, y, z) => !inside(x - 1, y, z) || !inside(x + 1, y, z) || !inside(x, y, z - 1) || !inside(x, y, z + 1);
  for (let y = y1; y <= y2; y++) {
    const rMax = Math.ceil(radiusAtY(y)) + 1;
    const grows = y > y1 && radiusAtY(y) > radiusAtY(y - 1);
    const shrinks = y < y2 && radiusAtY(y + 1) < radiusAtY(y);
    for (let z = Math.floor(AXIS - rMax); z <= Math.ceil(AXIS + rMax); z++) {
      for (let x = Math.floor(AXIS - rMax); x <= Math.ceil(AXIS + rMax); x++) {
        if (!inside(x, y, z)) continue;
        const d = Math.hypot(x - AXIS, z - AXIS);
        if (d <= innerSkip) continue;
        const side = sideAt(x, y, z);
        const below = y === y1 ? bottom : !inside(x, y - 1, z);
        const above = y === y2 ? top : !inside(x, y + 1, z);
        const support = (grows && inside(x, y - 1, z) && sideAt(x, y - 1, z)) || (shrinks && inside(x, y + 1, z) && sideAt(x, y + 1, z));
        if (side || below || above || support) store.put(x, y, z, stateOf(x, y, z, bearing(x - AXIS, z - AXIS), side));
      }
    }
  }
}

// ---------------------------------------------------------------- Kern: Mittelsäule, Schacht, Treppe

function buildCore(store, geo, cfg) {
  const columnTop = geo.yOf(H_COLUMN) - 1;
  const bodyTop = geo.yOf(H_BODY) - 1;
  const shaftTop = geo.yOf(GALLERIA_HIGH) - 2;
  const column = cfg.fine || cfg.mid ? circleCells(cfg.columnR, 1) : circleCells(cfg.columnR, Infinity);
  const cavity = circleCells(cfg.cavityR, 1);
  const shaft = circleCells(cfg.shaftR, 1);
  for (let y = 0; y <= bodyTop; y++) {
    if (y <= columnTop) for (const c of column) store.put(c.x, y, c.z, M.column);
    for (const c of cavity) store.put(c.x, y, c.z, M.shaft);
    if (y <= shaftTop && cfg.shaftR > cfg.cavityR) for (const c of shaft) store.put(c.x, y, c.z, M.shaft);
  }
  if (cfg.fine) {
    buildElevatorFields(store, geo, cfg, shaftTop);
    buildColumnStairs(store, columnTop);
  } else if (cfg.mid) {
    // Leiter an der Westwand der hohlen Säule (Nottreppe angedeutet).
    for (let y = 0; y <= columnTop; y++) store.put(0, y, 0, 'ladder[facing=east]');
  }
  if (cfg.mid) buildCables(store, geo, cfg);
}

// 12 Felder zwischen Hohlraum-Wand und Schacht-Außenwand (B: 12 Felder; Lage der Wände I).
function buildElevatorFields(store, geo, cfg, shaftTop) {
  const walls = [];
  for (let k = 0; k < 12; k++) walls.push(((k + 0.5) / 12) * TAU);
  const cells = circleCells(cfg.shaftR, Infinity).filter((c) => c.d > cfg.cavityR && c.d < cfg.shaftR - 0.5);
  const wallCells = cells.filter((c) => walls.some((w) => {
    const diff = Math.abs(((c.phi - w + TAU * 1.5) % TAU) - Math.PI);
    return diff * c.d < 0.6;
  }));
  for (let y = 0; y <= shaftTop; y++) for (const c of wallCells) store.put(c.x, y, c.z, M.shaft);
}

// Aufzugsseile: 4 Tembo-Shuttles bis 350 m, 2 Galleria-Shuttles 350–445 m (B: Anzahl und Ziele; Lage I).
function buildCables(store, geo, cfg) {
  // Feldmitte: freier Block zwischen den Wänden, der der Feldmitte am nächsten liegt.
  const free = circleCells(cfg.shaftR, Infinity).filter((c) => c.d > cfg.cavityR && store.get(c.x, 0, c.z) === null);
  const at = (k) => {
    const target = polarPoint((k / 12) * TAU, (cfg.cavityR + cfg.shaftR) / 2, 0);
    const best = free.reduce((a, c) => (Math.hypot(c.x - target[0], c.z - target[2]) < Math.hypot(a.x - target[0], a.z - target[2]) ? c : a));
    return [best.x, best.z];
  };
  const deckTop = geo.yOf(DECK_FLOORS[2]) - 2;
  for (const k of [0, 3, 6, 9]) {
    const [x, z] = at(k);
    for (let y = 0; y <= deckTop; y++) store.put(x, y, z, M.cable);
  }
  for (const k of [1, 7]) {
    const [x, z] = at(k);
    for (let y = geo.yOf(DECK_FLOORS[2]); y <= geo.yOf(GALLERIA_LOW) - 2; y++) store.put(x, y, z, M.cable);
  }
}

// Wendeltreppe in der Mittelsäule (B: Nottreppe in der Säule; Form I), eine Stufe pro Ebene um einen Kern.
// Jede Stufe steht auf einem Block (sonst hinge sie beim Bauen in der Luft); alle 8 Ebenen sitzt eine Seelaterne im Kern.
function buildColumnStairs(store, columnTop) {
  const ring = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const facingOf = (dx, dz) => (dx > 0 ? 'east' : dx < 0 ? 'west' : dz > 0 ? 'south' : 'north');
  for (let y = 0; y <= columnTop; y++) {
    const [x, z] = ring[y % ring.length];
    const [nx, nz] = ring[(y + 1) % ring.length];
    if (y > 0) store.put(x, y - 1, z, M.stairSupport);
    store.put(x, y, z, `${M.stairs}[facing=${facingOf(nx - x, nz - z)},half=bottom]`);
    store.put(0, y, 0, y % 8 === 4 ? M.light : M.column);
  }
}

// ---------------------------------------------------------------- Fachwerk

function ringHeights(cfg) {
  const list = [];
  for (let h = H_LEGS; h <= 362.5 + 1e-9; h += cfg.ringStep) list.push(h);
  if (cfg.ringStep <= 12.5) list.push(370);
  for (let h = 375; h < H_BODY - 1e-9; h += cfg.ringStep) list.push(h);
  list.push(H_BODY);
  return list;
}

// Umfang nach Bogenlänge: u ∈ [0, 1) → Peilung.
function arcTable(radius) {
  const n = 720;
  const cum = [0];
  let prev = polarPoint(0, radius(0), 0);
  for (let i = 1; i <= n; i++) {
    const phi = (i / n) * TAU;
    const p = polarPoint(phi, radius(phi), 0);
    cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[2] - prev[2]));
    prev = p;
  }
  const total = cum[n];
  return {
    total,
    phiAt(u) {
      const target = (((u % 1) + 1) % 1) * total;
      let lo = 0; let hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= target) lo = mid; else hi = mid;
      }
      const f = cum[hi] === cum[lo] ? 0 : (target - cum[lo]) / (cum[hi] - cum[lo]);
      return ((lo + f) / n) * TAU;
    },
  };
}

function coreRadiusAt(h, cfg) {
  return h < GALLERIA_HIGH ? cfg.shaftR : cfg.cavityR;
}

function buildLattice(store, geo, cfg) {
  const { s } = cfg;
  buildLegs(store, geo, cfg);
  const heights = ringHeights(cfg);
  const rings = heights.map((h, index) => {
    // Oberster Ring liegt ganz unter 497 m.
    const hh = h === H_BODY ? H_BODY - cfg.memberT / (2 * s) : h;
    const shape = geo.outline(h);
    return { h, index, y: memberY(hh, s, cfg.memberT), ridgeY: memberY(hh, s, cfg.ridgeT), radius: shape.radius, arc: arcTable(shape.radius) };
  });
  const inset = cfg.memberT / 2;
  const node = (ring, u) => {
    const phi = ring.arc.phiAt(u);
    return polarPoint(phi, ring.radius(phi) - inset, ring.y);
  };
  for (const ring of rings) buildRing(store, ring, cfg);
  // Diagonalen als Rautennetz: Knoten auf jedem Ring, je Ring um ein halbes Feld versetzt (Anzahl I, Winkel nach [Q16]).
  for (let i = 0; i < rings.length - 1; i++) {
    const low = rings[i];
    const high = rings[i + 1];
    const k = (low.h + high.h) / 2 < 368 ? cfg.kLower : cfg.kUpper;
    const parity = i % 2;
    for (let j = 0; j < k; j++) {
      const u = (j + parity / 2) / k;
      tube(store, node(low, u), node(high, u + 0.5 / k), cfg.memberT, M.steel);
      tube(store, node(low, u), node(high, u - 0.5 / k), cfg.memberT, M.steel);
    }
  }
  // Kanten (Ecken des Dreiecks) als dicke Rohre von 50 m bis 497 m.
  for (let i = 0; i < rings.length - 1; i++) {
    for (let c = 0; c < 3; c++) {
      const phi = (c / 3) * TAU;
      const a = polarPoint(phi, rings[i].radius(phi) - cfg.ridgeT / 2, rings[i].ridgeY);
      const b = polarPoint(phi, rings[i + 1].radius(phi) - cfg.ridgeT / 2, rings[i + 1].ridgeY);
      tube(store, a, b, cfg.ridgeT, M.steel);
    }
  }
  // Verbindung Ring ↔ innerer Turm alle 25 m (B), radial an den Knoten.
  for (const ring of rings) {
    if (Math.abs(ring.h / cfg.spokeStep - Math.round(ring.h / cfg.spokeStep)) > 1e-6) continue;
    const k = ring.h < 368 ? cfg.kLower : cfg.kUpper;
    const parity = ring.index % 2;
    const core = coreRadiusAt(ring.h, cfg) + 0.5;
    for (let j = 0; j < k; j++) {
      const phi = ring.arc.phiAt((j + parity / 2) / k);
      tube(store, polarPoint(phi, ring.radius(phi) - inset, ring.y), polarPoint(phi, core, ring.y), cfg.memberT, M.steel);
    }
  }
}

// Waagrechter Ring auf dem Umriss, außen bündig mit der Silhouette, memberT Blöcke breit und hoch.
function buildRing(store, ring, cfg) {
  const rows = cfg.memberT % 2 === 0 ? [ring.y - 0.5, ring.y + 0.5] : [ring.y];
  const maxR = Math.max(...[0, 1, 2, 3, 4, 5].map((i) => ring.radius((i / 6) * TAU + 0.01)), ring.radius(0));
  const cells = rimCells(ring.radius, maxR, cfg.memberT, AXIS, AXIS, { dense: cfg.memberT === 1 });
  for (const y of rows) for (const c of cells) store.put(c.x, y, c.z, M.steel);
}

// Drei Beine 0–50 m: je Ecke 4 Rohrstützen (B), als Raute entlang der beiden Dreiecksseiten (Abstand I).
function buildLegs(store, geo, cfg) {
  const bays = [];
  for (let h = 0; h <= H_LEGS + 1e-9; h += cfg.ringStep) bays.push(h);
  for (let c = 0; c < 3; c++) {
    const columns = bays.map((h) => legColumns(geo, cfg, c, h));
    for (let i = 0; i < bays.length - 1; i++) {
      for (let k = 0; k < 4; k++) tube(store, columns[i].legY[k], columns[i + 1].legY[k], cfg.legT, M.steel);
      // Streben in den vier Seitenflächen des Beins: bei 1:1 gekreuzt, kleiner im Zickzack (sonst zu dicht).
      for (const [p, q] of [[0, 1], [1, 3], [3, 2], [2, 0]]) {
        const [from, to] = i % 2 === 0 ? [p, q] : [q, p];
        tube(store, columns[i].member[from], columns[i + 1].member[to], cfg.memberT, M.steel);
        if (cfg.fine) tube(store, columns[i].member[to], columns[i + 1].member[from], cfg.memberT, M.steel);
      }
    }
    // Waagrechte Riegel auf jeder Lage (die oberste Lage ist der Ring auf 50 m).
    for (let i = 1; i < bays.length - 1; i++) {
      for (const [p, q] of [[0, 1], [1, 3], [3, 2], [2, 0]]) tube(store, columns[i].member[p], columns[i].member[q], cfg.memberT, M.steel);
    }
  }
}

function legColumns(geo, cfg, corner, h) {
  const { s } = cfg;
  const shape = geo.outline(h);
  const corners = [0, 1, 2].map((c) => {
    const phi = (c / 3) * TAU;
    return polarPoint(phi, shape.radius(phi) - cfg.legT / 2, 0);
  });
  const C = corners[corner];
  const unit = (p) => {
    const dx = p[0] - C[0];
    const dz = p[2] - C[2];
    const len = Math.hypot(dx, dz);
    return [dx / len, dz / len];
  };
  const u1 = unit(corners[(corner + 1) % 3]);
  const u2 = unit(corners[(corner + 2) % 3]);
  const a = LEG_SPACING * s * (geo.bodyWidth(h) / FOOT_SIDE);
  const flat = [
    [C[0], C[2]],
    [C[0] + a * u1[0], C[2] + a * u1[1]],
    [C[0] + a * u2[0], C[2] + a * u2[1]],
    [C[0] + a * (u1[0] + u2[0]), C[2] + a * (u1[1] + u2[1])],
  ];
  const yLeg = memberY(h, s, cfg.legT);
  const yMember = memberY(h, s, cfg.memberT);
  return {
    legY: flat.map(([x, z]) => [x, yLeg, z]),
    member: flat.map(([x, z]) => [x, yMember, z]),
  };
}

// ---------------------------------------------------------------- Tembo Deck

function deckFloorYs(geo) {
  // Etagen 340 und 350 immer; 345 nur, wenn darüber und darunter mindestens 2 Ebenen Luft bleiben.
  const y = (h) => geo.yOf(h) - 1;
  const ys = [y(340), y(350)];
  const mid = y(345);
  if (mid - ys[0] - 1 >= 2 && ys[1] - mid - 1 >= 2) ys.splice(1, 0, mid);
  return ys;
}

function buildDeck(store, geo, cfg) {
  const { s } = cfg;
  const y1 = geo.yOf(322);
  const y2 = geo.yOf(DECK_ROOF) - 1;
  const radiusAtY = (y) => geo.deckRadius((y + 0.5) / s) * s;
  const floors = deckFloorYs(geo);
  const glassTop = geo.yOf(DECK_GLASS_TOP) - 1;

  // Etagen (Böden) zwischen Schacht und Fassade, mit Lampenringen im Boden (deckLightRings).
  floors.forEach((fy) => {
    const r = radiusAtY(fy);
    const rings = deckLightRings(geo, cfg, fy);
    for (const c of circleCells(r, Infinity)) {
      if (c.d <= cfg.shaftR) continue;
      const lamp = rings.some((ring) => Math.abs(c.d - ring) < 0.5 && lampSpot(c.phi, ring, cfg));
      store.put(c.x, fy, c.z, lamp ? M.light : M.floor);
    }
  });

  // Schale: Untersicht, Glasbänder mit Pfosten, Oberteil und Dach.
  const perimeterAt = (y) => TAU * radiusAtY(y);
  revolveShell(store, {
    y1,
    y2,
    radiusAtY,
    innerSkip: cfg.shaftR,
    stateOf(x, y, z, phi, side) {
      if (floors.includes(y)) return M.steel;
      const h = (y + 0.5) / s;
      if (h < DECK_FLOORS[0] || y > glassTop || y === y2) return M.panel;
      // Pfosten nur an senkrechten Fassadenstücken, nicht auf den Stufen der auskragenden Schale.
      if (!side) return M.deckGlass;
      const count = Math.max(8, Math.round(perimeterAt(y) / cfg.mullionSpacing));
      const f = (phi / TAU) * count;
      const arcOff = Math.abs(f - Math.round(f)) * (perimeterAt(y) / count);
      return arcOff < 0.5 ? M.steel : M.deckGlass;
    },
  });
  // Glasboden 2 × 3 m auf Etage 340 an der Südseite (B: Maß; Lage I).
  const gw = Math.max(1, Math.round(2 * s));
  const gl = Math.max(1, Math.round(3 * s));
  const zEnd = Math.floor(AXIS + radiusAtY(floors[0])) - 2;
  const x0 = Math.round(AXIS - gw / 2);
  for (let x = x0; x < x0 + gw; x++) {
    for (let z = zEnd - gl + 1; z <= zEnd; z++) {
      store.put(x, floors[0], z, M.glass);
      // Durchblick: Wo die Schüssel unter dem Glasboden liegt, wird ihre Hülle auch zu Glas.
      for (let y = floors[0] - 1; y >= y1; y--) if (store.get(x, y, z) === M.panel) store.put(x, y, z, M.glass);
    }
  }
}

// Lampenringe im Boden einer Deck-Etage: Mitte zwischen Schacht und Fassade, bei genug Platz auch an der Fassade.
function deckLightRings(geo, cfg, fy) {
  const r = geo.deckRadius((fy + 0.5) / cfg.s) * cfg.s;
  const lightR = (cfg.shaftR + geo.deckRadius((deckFloorYs(geo)[0] + 0.5) / cfg.s) * cfg.s) / 2;
  return r - 2 - lightR >= 3 ? [lightR, r - 2] : [lightR];
}

function lampSpot(phi, radius, cfg) {
  const spacing = cfg.fine ? 6 : 4;
  const count = Math.max(6, Math.round((TAU * radius) / spacing));
  const f = (phi / TAU) * count;
  return Math.abs(f - Math.round(f)) * ((TAU * radius) / count) < 0.5;
}

// ---------------------------------------------------------------- Tembo Galleria

function galleriaLayout(geo, cfg) {
  const { s } = cfg;
  const rOut = 20 * s; // G
  const wi = Math.max(1, Math.round(3 * s)); // I Innenbreite der Röhre
  const hi = Math.max(2, Math.round(3 * s)); // I Innenhöhe der Röhre
  const rMid = rOut - 1 - wi / 2;
  // Rampe: 110 m (S) auf der Mittellinie, höchstens eine Umrundung – das Ende liegt dann 5 m über dem Anfang.
  const sweep = Math.min((GALLERIA_RAMP_LENGTH * s) / rMid, TAU);
  const start = Math.PI; // Start im Süden, Lauf im Uhrzeigersinn (I)
  const surface = (f) => Math.round((GALLERIA_LOW + (GALLERIA_HIGH - GALLERIA_LOW) * f) * s * 2) / 2;
  const hallFloor = geo.yOf(GALLERIA_HIGH) - 1;
  return { rOut, wi, hi, rMid, sweep, start, surface, hallFloor, hallRoof: hallFloor + 1 + hi, lowFloor: geo.yOf(GALLERIA_LOW) - 1 };
}

function buildGalleria(store, geo, cfg) {
  const { s } = cfg;
  const g = galleriaLayout(geo, cfg);
  // Schüssel unter der Etage 445.
  revolveShell(store, {
    y1: geo.yOf(425),
    y2: g.lowFloor - 1,
    radiusAtY: (y) => geo.galleriaRadius((y + 0.5) / s) * s,
    innerSkip: cfg.shaftR,
    top: false,
    stateOf: () => M.panel,
  });
  // Etage 445 (Boden bis zum Rand) mit Lampenring.
  const lightR = (cfg.shaftR + g.rOut) / 2;
  for (const c of circleCells(g.rOut, Infinity)) {
    if (c.d <= cfg.shaftR) continue;
    const lamp = Math.abs(c.d - lightR) < 0.5 && lampSpot(c.phi, lightR, cfg);
    store.put(c.x, g.lowFloor, c.z, c.depth === 1 ? M.panel : lamp ? M.light : M.floor);
  }
  // Halle auf Etage 450 (Radius G), Glaswand, Dach.
  const hallR = GALLERIA_HALL_RADIUS * s;
  const hallCells = circleCells(hallR, Infinity);
  const openAt = (phi, r, spanBlocks) => {
    const alpha = (phi - g.start + TAU) % TAU;
    return alpha > g.sweep - spanBlocks / r && alpha <= g.sweep;
  };
  const hallLightR = (cfg.cavityR + hallR) / 2;
  for (const c of hallCells) {
    if (c.d > cfg.cavityR) {
      const lamp = Math.abs(c.d - hallLightR) < 0.5 && lampSpot(c.phi, hallLightR, cfg);
      store.put(c.x, g.hallFloor, c.z, lamp ? M.light : M.floor);
    }
    store.put(c.x, g.hallRoof, c.z, M.panel);
    if (c.depth === 1) {
      const open = openAt(c.phi, c.d, g.wi + 1);
      for (let y = g.hallFloor + 1; y < g.hallRoof; y++) store.put(c.x, y, c.z, open ? null : M.glass);
    }
  }
  buildGalleriaTube(store, g, cfg);
}

// Gläserne Röhre als Spiralrampe 445 → 450 m außen an der Schüssel (B: Form; Maße I).
function buildGalleriaTube(store, g, cfg) {
  const cells = circleCells(g.rOut, g.wi + 2);
  const openSpan = (r) => (g.wi + 1) / r;
  const yEnd = Math.floor(g.surface(1));
  // Leuchtband: alle paar Blöcke eine Seelaterne mittig in der Glasdecke der Röhre.
  const lampDepth = 2 + Math.floor((g.wi - 1) / 2);
  const lampCount = Math.max(4, Math.round((g.sweep * g.rMid) / (cfg.fine ? 6 : 4)));
  const lampAt = (f, r) => Math.abs(f * lampCount - Math.round(f * lampCount)) * ((g.sweep * r) / lampCount) < 0.5;
  for (const c of cells) {
    const alpha = (c.phi - g.start + TAU) % TAU;
    if (alpha > g.sweep) {
      // Rest der Umrundung (nur bei kurzer Rampe): Außenwand bis zum Rampenende geschlossen (I).
      if (c.depth === 1) for (let y = g.lowFloor + 1; y <= yEnd + g.hi; y++) store.put(c.x, y, c.z, M.panel);
      continue;
    }
    const f = alpha / g.sweep;
    const surface = g.surface(f);
    const y0 = Math.floor(surface);
    const half = surface - y0 > 0.25;
    const frame = cfg.tubeFrames > 0 && Math.abs(f * cfg.tubeFrames - Math.round(f * cfg.tubeFrames)) * (g.sweep * c.d / cfg.tubeFrames) < 0.5;
    for (let y = g.lowFloor + 1; y < y0 - 1; y++) if (c.depth === 1) store.put(c.x, y, c.z, M.panel);
    store.put(c.x, y0 - 1, c.z, M.ramp);
    if (half) store.put(c.x, y0, c.z, c.depth === 1 ? M.ramp : M.rampSlab);
    const inner = c.depth === g.wi + 2;
    const open = inner && (alpha < openSpan(c.d) || alpha > g.sweep - openSpan(c.d));
    for (let y = y0 + (half ? 1 : 0); y < y0 + g.hi; y++) {
      if (c.depth === 1) store.put(c.x, y, c.z, frame ? M.steel : M.glass);
      else if (inner) store.put(c.x, y, c.z, open ? null : (frame ? M.steel : M.glass));
      else store.put(c.x, y, c.z, null);
    }
    const lamp = c.depth === lampDepth && lampAt(f, c.d);
    store.put(c.x, y0 + g.hi, c.z, lamp ? M.light : frame ? M.steel : M.glass);
  }
}

// ---------------------------------------------------------------- Gain Tower, Kopf, Spitze

// Kopf: Durchmesser (gerade → Mitte auf der Achse, ungerade → Mitte im Block 0), Unterkante und Dach.
function headLayout(geo, cfg) {
  const d = cfg.fine ? 10 : nearestOdd(10 * cfg.s);
  return { d, c: d % 2 === 0 ? AXIS : 0, bottom: geo.yOf(GAIN_HEAD), top: geo.yOf(HEAD_ROOF) };
}

function buildGainTower(store, geo, cfg) {
  const { s } = cfg;
  const y0 = geo.yOf(H_BODY);
  const headBottom = geo.yOf(GAIN_HEAD);
  const headTop = geo.yOf(HEAD_ROOF);
  const top = geo.yOf(H_TOP) - 1;
  const inStage = (y) => ANTENNA_STAGES.some(([a, b]) => y >= geo.yOf(a) && y < geo.yOf(b));

  if (cfg.fine) {
    // Sechseck aus 6 Stützen, ⌀ 6 m (B), Riegel alle 10 m (Schüsse, B), Diagonalen je Feld (I).
    // Blockmitten 2,5 m von der Achse → Außenkante bei 3 m (⌀ 6 m).
    const corners = [0, 1, 2, 3, 4, 5].map((k) => {
      const p = polarPoint(((k + 0.5) / 6) * TAU, 2.5, 0);
      return [Math.round(p[0]), Math.round(p[2])];
    });
    // Mastfuß (I): sechs Träger von den Stützen zur Wand des Hohlraums auf der Oberkante des Turmkörpers.
    corners.forEach(([x, z], k) => thinLine(store, [x, y0 - 1, z], polarPoint(((k + 0.5) / 6) * TAU, cfg.cavityR - 0.5, y0 - 1), M.steel));
    for (let y = y0; y < headBottom; y++) for (const [x, z] of corners) store.put(x, y, z, M.steel);
    const levels = [];
    for (let h = H_BODY; h < GAIN_HEAD; h += 10) levels.push(geo.yOf(h));
    levels.push(headBottom - 1);
    levels.forEach((ly, i) => {
      for (let k = 0; k < 6; k++) {
        const [ax, az] = corners[k];
        const [bx, bz] = corners[(k + 1) % 6];
        thinLine(store, [ax, ly, az], [bx, ly, bz], M.steel);
        if (i < levels.length - 1) {
          const up = levels[i + 1];
          if ((i + k) % 2 === 0) thinLine(store, [ax, ly, az], [bx, up, bz], M.steel);
          else thinLine(store, [bx, ly, bz], [ax, up, az], M.steel);
        }
      }
    });
    // Antennenstufen: Ring ⌀ 8 m (S) aus Eisengittern; Anzahl und Höhe der Stufen sind eine Annahme.
    const antenna = circleCells(4, 1);
    for (let y = y0; y < headBottom; y++) if (inStage(y)) for (const c of antenna) store.put(c.x, y, c.z, M.antenna);
  } else {
    const d = nearestOdd(6 * s);
    const core = circleCells(d / 2, Infinity, 0, 0);
    // Mastfuß (I): Platte über dem Hohlraum auf der Oberkante des Turmkörpers.
    for (const c of circleCells(cfg.cavityR, Infinity)) store.put(c.x, y0 - 1, c.z, M.steel);
    for (let y = y0; y < headBottom; y++) for (const c of core) store.put(c.x, y, c.z, inStage(y) ? M.iron : M.steel);
  }

  // Kopf mit Schwingungstilger-Raum (B: 2 Geschosse; ⌀ G ≈ 10 m; Höhe R ≈ 14 m bis zur Spitze).
  const { d: headD, c: hc } = headLayout(geo, cfg);
  const headCells = circleCells(headD / 2, Infinity, hc, hc);
  for (const c of headCells) {
    store.put(c.x, headBottom - 1, c.z, M.steel);
    store.put(c.x, headTop - 1, c.z, M.panel);
  }
  for (let y = headBottom; y < headTop - 1; y++) for (const c of headCells) if (c.depth === 1) store.put(c.x, y, c.z, M.steel);
  if (cfg.fine) {
    const midFloor = geo.yOf(624) - 1;
    for (const c of headCells) store.put(c.x, midFloor, c.z, M.steel);
    // Schwingungstilger: unten 40 t, oben 25 t (B), als Eisenblöcke angedeutet.
    for (let y = headBottom; y < headBottom + 2; y++) for (let x = -1; x <= 2; x++) for (let z = -1; z <= 2; z++) store.put(x, y, z, M.iron);
    for (let y = midFloor + 1; y < midFloor + 3; y++) for (let x = 0; x <= 1; x++) for (let z = 0; z <= 1; z++) store.put(x, y, z, M.iron);
    // Je eine Seelaterne oben auf den Tilgern hält beide Geschosse hell.
    store.put(0, headBottom + 2, 0, M.light);
    store.put(0, midFloor + 3, 0, M.light);
  } else {
    store.put(0, headBottom, 0, M.light);
  }
  // Dachkegel, Mast, Blitzableiter (Spitze = 634 m, B).
  const coneLayers = top - headTop;
  for (let y = headTop; y < top; y++) {
    const r = (headD / 2 - 1) * (1 - (y - headTop + 1) / coneLayers);
    if (r < 0.75) store.put(0, y, 0, M.iron);
    else for (const c of circleCells(r, Infinity, hc, hc)) store.put(c.x, y, c.z, M.panel);
  }
  store.put(0, top, 0, M.rod);
}

// ---------------------------------------------------------------- Kapitel

// Kapitel nach Höhe in Metern: from bis unter to, das letzte reicht bis zur Spitze.
const CHAPTERS = [
  { from: 0, to: H_LEGS, title: 'Fuß und Beine (0–50 m)' },
  { from: H_LEGS, to: 150, title: 'Turmkörper 50–150 m' },
  { from: 150, to: 250, title: 'Turmkörper 150–250 m' },
  { from: 250, to: H_CIRCLE, title: 'Turmkörper 250–320 m' },
  { from: H_CIRCLE, to: H_COLUMN, title: 'Tembo Deck (320–375 m)' },
  { from: H_COLUMN, to: 425, title: 'Turmkörper 375–425 m' },
  { from: 425, to: 460, title: 'Tembo Galleria (425–460 m)' },
  { from: 460, to: H_BODY, title: 'Turmkörper 460–497 m' },
  { from: H_BODY, to: GAIN_HEAD, title: 'Gain Tower (497–620 m)' },
  { from: GAIN_HEAD, to: H_TOP, title: 'Spitze (620–634 m)' },
];

function emitPhases(b, store, geo) {
  const plan = CHAPTERS;
  const lastY = geo.yOf(H_TOP) - 1;
  const ys = [...store.layers.keys()];
  if (Math.max(...ys) > lastY) throw new Error('Skytree: Blöcke über der Spitze.');
  plan.forEach((chapter, index) => {
    const from = geo.yOf(chapter.from);
    const to = index === plan.length - 1 ? lastY : geo.yOf(chapter.to) - 1;
    b.phase(chapter.title);
    for (let y = from; y <= to; y++) {
      const layer = store.layers.get(y);
      if (!layer) continue;
      for (const [key, state] of layer) {
        if (state === null) continue;
        b.set(Math.floor(key / 1024) - 512, y, (key % 1024) - 512, state);
      }
    }
  });
}

export default function build(b, { scale = 1 } = {}) {
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) throw new Error('Skytree: Maßstab muss zwischen 0 und 1 liegen.');
  const cfg = scaleConfig(scale);
  const geo = createGeometry(scale);
  const store = createStore();
  buildCore(store, geo, cfg);
  buildLattice(store, geo, cfg);
  buildDeck(store, geo, cfg);
  buildGalleria(store, geo, cfg);
  buildGainTower(store, geo, cfg);
  lightInteriors(store, geo, cfg);
  emitPhases(b, store, geo);
}
