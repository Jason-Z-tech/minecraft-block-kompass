// Golden Gate Bridge nach echten Maßen. Grundlage: docs/recherche/golden-gate-bridge.md.
// Kennzeichen wie in der Recherche: B belegt, S Sekundärquelle, R Rechnung, G geschätzt, I Annahme für den Bau.
// Alle Maße in Metern; der Maßstab s rechnet sie in Blöcke um (1 Block = 1 m bei s = 1).
// Koordinaten: x quer (Osten +), z entlang der Brücke von Marin (Norden, z = 0) nach San Francisco (Süden),
// y = 0 ist die Wasserlinie.

export const meta = {
  id: 'golden-gate-bridge',
  title: 'Golden Gate Bridge',
  category: 'infrastruktur',
  subtitle: 'Hängebrücke in San Francisco, 2737 m lang',
  tags: ['USA', 'San Francisco', 'Kalifornien', 'Hängebrücke', 'Brücke', 'Art déco', 'Riesig', 'Wahrzeichen'],
  aliases: [
    'golden gate', 'golden gate bridge', 'golden-gate-brücke', 'golden gate brücke', 'goldengate', 'golden gate bridge san francisco',
    'san francisco brücke', 'san francisco bridge', 'ggb', 'hängebrücke', 'suspension bridge', 'rote brücke', 'orange brücke',
    'golden gait', 'goldan gate', 'golden gat bridge',
  ],
  accuracy: 'massstab',
  difficulty: 5,
  description: 'Die Hängebrücke über das Golden Gate, 1 Block = 1 m (oder 1:2, 1:4): 2737 m Gesamtlänge, 1280 m Hauptspannweite, '
    + 'Seitenöffnungen je 343 m, Türme 227 m über dem Wasser, Fahrbahn 27 m breit (19 m zwischen den Bordsteinen), 67 m Durchfahrtshöhe '
    + 'und 7,6 m hoher Versteifungsträger – alles belegt. Die Hauptkabel sind als Parabel berechnet, die 250 Hängerpaare stehen alle '
    + '15,24 m. Geschätzt sind der Durchhang der Kabel, die Lage der Turm-Querriegel, die Abstufung der Turmbeine, Pfeiler, Fender, Pylone, Ankerhäuser und die Form der Zufahrten.',
  facts: [
    'Gesamtlänge 2737 m (8981 ft) von Widerlager zu Widerlager, davon 1966 m Hängebrücke.',
    'Hauptspannweite 1280 m (4200 ft) – bei der Eröffnung 1937 die längste der Welt.',
    'Türme 227 m über dem Wasser und 152 m über der Fahrbahn; jedes Turmbein misst am Fuß 10 × 16 m.',
    'Durchfahrtshöhe 67 m über mittlerem Hochwasser; die Fahrbahn liegt rund 75 m über dem Wasser (227 m Turm minus 152 m Turm über der Fahrbahn).',
    'Die Turmbeine sind aus Stahlzellen gebaut und dreimal in der Dicke abgestuft; die Portale werden nach oben kleiner, damit der Turm höher wirkt.',
    'Zwei Hauptkabel mit je 0,92 m Durchmesser aus 27.572 Drähten, 2332 m lang.',
    '250 Paare Hängerseile im Abstand von 15,24 m (50 ft).',
    'Farbe „International Orange“ (CMYK 0/69/100/6); im Bau Oranger Beton, der in der Farbe am nächsten liegt.',
    'Die Fahrbahn ist 27 m breit: 19 m zwischen den Bordsteinen für sechs Spuren und zwei 3 m breite Gehwege.',
    'Der Fort-Point-Bogen (rund 97 m) überspannt die alte Festung am Südufer.',
  ],
  sources: [
    { title: 'Golden Gate Bridge District: Design & Construction Stats', url: 'https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/' },
    { title: 'Golden Gate Bridge District: Color & Art Deco Styling', url: 'https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/' },
    { title: 'Golden Gate Bridge District: Painting the Bridge', url: 'https://www.goldengate.org/bridge/bridge-maintenance/painting-the-bridge/' },
    { title: 'Golden Gate Bridge District: Bridge Towers (Ausstellung)', url: 'https://www.goldengate.org/exhibits/bridge-towers/' },
    { title: 'Wikipedia (en): Golden Gate Bridge', url: 'https://en.wikipedia.org/wiki/Golden_Gate_Bridge' },
    { title: 'Wikipedia (de): Golden Gate Bridge', url: 'https://de.wikipedia.org/wiki/Golden_Gate_Bridge' },
    { title: 'Wikipedia (en): International orange', url: 'https://en.wikipedia.org/wiki/International_orange' },
    { title: 'ENR: Famed Golden Gate Span Undergoes Complex Seismic Revamp', url: 'https://enr.com/articles/13013-famed-golden-gate-span-undergoes-complex-seismic-revamp' },
    { title: 'Langan: Golden Gate Bridge, North Approach Viaduct Seismic Retrofit', url: 'https://www.langan.com/portfolio/golden-gate-bridge' },
  ],
  credits: null,
  scales: [1, 0.5, 0.25],
  tested: null,
};

// --- Maße (m) ---
const H_TOWER = 227; // B Turm über dem Wasser
const H_ROAD = 75; // R Fahrbahn: 227 − 152 (Turm über der Fahrbahn, B)
const H_CLEAR = 67; // B Durchfahrtshöhe = Unterkante Versteifungsträger
const H_PIER = 13; // G Oberkante der Turmpfeiler
const H_SADDLE = 223; // I Kabel-Mitte über dem Turm (4 m unter der Spitze)
const H_CABLE_MID = 78; // G Kabel-Tiefpunkt knapp über dem Geländer → Durchhang 145 m (R; Literaturwert nicht gefunden)
const H_PYLON_SADDLE = 92; // G Kabel über den Pylonen N1/S2 (Ende der Seitenöffnungen)
const H_ANCHOR_ENTRY = 79; // G Kabel tritt in die Pylone N2/S1 ein
const H_PYLON_TOP = 88; // G Oberkante der Pylone N2/S1
const H_FENDER = 9; // G Oberkante des Fenders um den Südpfeiler
const H_DECK_STRUT = 59; // G Unterkante des Riegels unter der Fahrbahn
const H_ARCH_SPRING = 12; // G Kämpfer des Fort-Point-Bogens
const H_GIRDER = 70; // G Unterkante der Blechträger (Bogen, Zufahrt Süd)
const H_VIADUCT_N_BOTTOM = 64; // G Unterkante Fachwerk Zufahrt Nord
const STRUTS = [[125, 131], [167, 173], [199, 205], [221, 227]]; // G vier Querriegel über der Fahrbahn
const LEG_WIDTH = [10, 9, 8, 7]; // B (Fuß 10 m), darüber G – quer zur Brücke
const LEG_DEPTH = [16, 14, 12, 10]; // B (Fuß 16 m), darüber G – entlang der Brücke

const Z_TOTAL = 2737; // B
const Z_NORTH_VIADUCT_END = 305; // S Zufahrt Nord ca. 1000 ft
const Z_NORTH_SUSPENDED = 365; // R 708 − 343
const Z_NORTH_TOWER = 708; // R/I Gesamtlänge minus Süden; Seitenöffnung 343 (B)
const Z_SOUTH_TOWER = 1988; // R 708 + 1280 (B)
const Z_SOUTH_SUSPENDED = 2331; // R 1988 + 343 (B)
const Z_ARCH_START = 2346; // G Pylon S2 15 m
const Z_ARCH_END = 2444; // S Bogen ca. 320 ft ≈ 97,5 m
const Z_HOUSING_SOUTH = 2459; // G Pylon S1 15 m
const Z_SOUTH_VIADUCT = 2519; // S Zufahrt Süd 714 ft ≈ 218 m bis zum Ende
const SIDE_SPAN = 343; // B
const MAIN_SPAN = 1280; // B
const HANGER_SPACING = 15.24; // B 50 ft
const PANEL = 7.62; // G halber Hängerabstand
const SAG = H_SADDLE - H_CABLE_MID; // R 145 m
const SIDE_SAG = SAG * (SIDE_SPAN / MAIN_SPAN) ** 2; // R gleiche Kabelkraft und Last → Durchhang ∝ Spannweite²

const M = {
  steel: 'orange_concrete',
  steelAccent: 'resin_bricks',
  steelSlab: 'resin_brick_slab[type=bottom]',
  steelWall: 'resin_brick_wall',
  rail: 'acacia_fence',
  concrete: 'smooth_stone',
  concreteCap: 'polished_andesite',
  road: 'gray_concrete',
  marking: 'white_concrete',
  walk: 'light_gray_concrete',
  walkSlab: 'smooth_stone_slab[type=bottom]',
  median: 'smooth_stone_slab[type=bottom]',
  lanternHanging: 'lantern[hanging=true]',
  lantern: 'lantern[hanging=false]',
};
const ROCKS = ['stone', 'andesite', 'cobblestone', 'mossy_cobblestone', 'stone'];

// ---------------------------------------------------------------- Maßstab

function nearestOdd(value) {
  const low = Math.max(1, Math.floor(value));
  const odd = low % 2 === 1 ? low : low + 1;
  const below = odd - 2;
  return below >= 1 && Math.abs(value - below) < Math.abs(value - odd) ? below : odd;
}

const evenAtLeast2 = (v) => Math.max(2, 2 * Math.round(v / 2));

function createConfig(s) {
  const yOf = (h) => Math.round(h * s);
  const zOf = (m) => Math.round(m * s);
  const halfDeck = (nearestOdd(27 * s) - 1) / 2;
  const roadHalf = (nearestOdd(19 * s) - 1) / 2;
  const inner = roadHalf + 1;
  const legW = LEG_WIDTH.map((w) => Math.max(1, Math.round(w * s)));
  const legD = [];
  LEG_DEPTH.forEach((d, i) => legD.push(Math.min(i > 0 ? legD[i - 1] : Infinity, evenAtLeast2(d * s))));
  return {
    s,
    fine: s >= 1,
    mid: s >= 0.5,
    yOf,
    zOf,
    halfDeck,
    roadHalf,
    inner,
    walkWidth: Math.max(0, halfDeck - 1 - roadHalf),
    legW,
    legD,
    legOuter: legW.map((w) => inner + w - 1),
    sectionY: [yOf(H_PIER), ...STRUTS.map(([, top]) => yOf(top))], // Untergrenzen der Abschnitte, letzte = Spitze + 1
    roadY: yOf(H_ROAD) - 1,
    trussBottom: yOf(H_CLEAR),
    topY: yOf(H_TOWER) - 1,
    zTotal: zOf(Z_TOTAL),
    zNorthTower: zOf(Z_NORTH_TOWER),
    zSouthTower: zOf(Z_SOUTH_TOWER),
    abutment: Math.max(2, zOf(6)),
    pylonWidth: Math.max(2, Math.round(10 * s)),
    pylonDepth: Math.max(3, zOf(15)),
    colSize: s >= 1 ? 2 : 1,
  };
}

// ---------------------------------------------------------------- kleine Helfer

function setKeep(b, x, y, z, state) {
  if (b.get(x, y, z) === 'air') b.set(x, y, z, state);
}

// Kurve über z: je ganzer Spalte ein Punkt, senkrechte Lücken werden in derselben Spalte geschlossen (flächenverbunden).
// Liefert Map z → unterster Block der Spalte.
function curveAlongZ(b, x, zFrom, zTo, yAt, state) {
  const bottoms = new Map();
  const step = zTo >= zFrom ? 1 : -1;
  let prev = null;
  for (let z = zFrom; z !== zTo + step; z += step) {
    const y = Math.round(yAt(z));
    const lo = prev === null ? y : Math.min(prev, y);
    const hi = prev === null ? y : Math.max(prev, y);
    for (let yy = lo; yy <= hi; yy++) setKeep(b, x, yy, z, state);
    bottoms.set(z, lo);
    prev = y;
  }
  return bottoms;
}

// Fachwerk in einer senkrechten Ebene x = konst.: Gurte, Pfosten an den Knoten, Diagonalen im Wechsel (Warren).
function verticalTruss(b, x, nodes, yBottom, yTop, state) {
  const zMin = nodes[0];
  const zMax = nodes[nodes.length - 1];
  b.fill(x, yBottom, zMin, x, yBottom, zMax, state);
  b.fill(x, yTop, zMin, x, yTop, zMax, state);
  if (yTop - yBottom < 2) return;
  nodes.forEach((z, i) => {
    b.fill(x, yBottom + 1, z, x, yTop - 1, z, state);
    if (i === nodes.length - 1) return;
    const next = nodes[i + 1];
    if (i % 2 === 0) b.line(x, yBottom + 1, z, x, yTop - 1, next, state);
    else b.line(x, yTop - 1, z, x, yBottom + 1, next, state);
  });
}

// Knotenpunkte im Abstand spacing (m) zwischen zFrom und zTo (Blöcke), ausgerichtet an origin (Blöcke).
function nodesBetween(zFrom, zTo, origin, spacing) {
  const list = [];
  const kMin = Math.ceil((zFrom - origin) / spacing);
  const kMax = Math.floor((zTo - origin) / spacing);
  for (let k = kMin; k <= kMax; k++) {
    const z = Math.round(origin + k * spacing);
    if (z >= zFrom && z <= zTo && list[list.length - 1] !== z) list.push(z);
  }
  if (list[0] !== zFrom) list.unshift(zFrom);
  if (list[list.length - 1] !== zTo) list.push(zTo);
  return list;
}

const symmetricX = (fn) => {
  fn(1);
  fn(-1);
};

function fmt(value) {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
}

function blocks(m, s) {
  const n = Math.max(1, Math.round(m * s));
  return `${n} ${n === 1 ? 'Block' : 'Blöcke'}`;
}

// ---------------------------------------------------------------- Türme

function towerLegRanges(cfg, zc, i) {
  const d = cfg.legD[i];
  return { za: zc - d / 2 + 1, zb: zc + d / 2, xa: cfg.inner, xb: cfg.legOuter[i] };
}

// Schale eines Beinabschnitts mit Art-déco-Rillen: Ecken stehen, dazwischen jede zweite Spalte 1 Block eingerückt
// (nur bei 1:1; die Innenseite zur Fahrbahn bleibt glatt, dort docken die Riegel an).
function legSection(b, cfg, sign, r, y0, y1) {
  const { xa, xb, za, zb } = r;
  const w = xb - xa + 1;
  const d = zb - za + 1;
  const grooved = (offset, size) => cfg.fine && size >= 5 && Math.min(offset, size - 1 - offset) % 2 === 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = xa; x <= xb; x++) {
      for (let z = za; z <= zb; z++) {
        const onX = x === xa || x === xb;
        const onZ = z === za || z === zb;
        if (!onX && !onZ) continue;
        let px = x;
        let pz = z;
        if (onZ && !onX && grooved(x - xa, w)) pz += z === za ? 1 : -1;
        else if (onX && !onZ && x === xb && grooved(z - za, d)) px -= 1;
        b.set(sign * px, y, pz, M.steel);
      }
    }
  }
  b.fill(sign * xa, y1, za, sign * xb, y1, zb, M.steel);
}

// Querriegel zwischen den Beinen; bei 1:1 mit senkrechten Rippen auf Nord- und Südseite (B: „wide vertical ribbing“).
function strut(b, cfg, zc, y0, y1, depth) {
  const xi = cfg.inner - 1;
  const za = zc - depth / 2 + 1;
  const zb = zc + depth / 2;
  b.fill(-xi, y0, za, xi, y1, zb, M.steel, { hollow: true });
  if (!cfg.fine || y1 - y0 < 2) return;
  for (let x = -xi; x <= xi; x++) {
    if (Math.abs(x) % 2 !== 0) continue;
    b.fill(x, y0 + 1, za - 1, x, y1 - 1, za - 1, M.steel);
    b.fill(x, y0 + 1, zb + 1, x, y1 - 1, zb + 1, M.steel);
  }
}

function buildPier(b, cfg, zc, { fender }) {
  const { s } = cfg;
  const pad = Math.max(1, Math.round(3 * s));
  const r0 = towerLegRanges(cfg, zc, 0);
  const halfX = cfg.legOuter[0] + pad;
  const za = r0.za - pad;
  const zb = r0.zb + pad;
  const top = cfg.yOf(H_PIER) - 1;
  b.fill(-halfX, 0, za, halfX, top, zb, M.concrete, { hollow: true });
  b.fill(-halfX, top, za, halfX, top, zb, M.concreteCap, { outline: true });
  if (fender) {
    const rx = Math.round(36 * s);
    const rz = Math.round(28 * s);
    const t = Math.max(1, Math.round(3 * s));
    const fenderTop = cfg.yOf(H_FENDER) - 1;
    for (let y = 0; y <= fenderTop; y++) b.ellipse(0, y, zc + 0.5, rx, rz, y === fenderTop ? M.concreteCap : M.concrete, { hollow: true, thickness: t });
    if (cfg.mid) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.round(Math.sin(a) * (rx - (t - 1) / 2));
        const z = Math.round(zc + 0.5 - Math.cos(a) * (rz - (t - 1) / 2));
        if (b.get(x, fenderTop, z) !== 'air') b.set(x, fenderTop + 1, z, M.lantern);
      }
    }
  } else {
    // Felsen am Lime Point rund um den Nordpfeiler.
    const ring = Math.max(2, Math.round(9 * s));
    for (let x = -halfX - ring; x <= halfX + ring; x++) {
      for (let z = za - ring; z <= zb + ring; z++) {
        if (x >= -halfX && x <= halfX && z >= za && z <= zb) continue;
        const dx = Math.max(0, Math.abs(x) - halfX) / ring;
        const dz = Math.max(0, za - z, z - zb) / ring;
        const dist = Math.hypot(dx, dz);
        if (dist > 1) continue;
        const h = Math.round((1 - dist) * Math.max(1, cfg.yOf(5)) + (b.rng() - 0.5) * 1.5);
        for (let y = 0; y < h; y++) b.set(x, y, z, b.pick(ROCKS));
      }
    }
  }
}

function buildTowerBelowDeck(b, cfg, zc) {
  const { s } = cfg;
  const base = cfg.sectionY[0];
  const strutBottom = cfg.yOf(H_DECK_STRUT);
  const legTop = cfg.trussBottom - 1;
  symmetricX((sign) => legSection(b, cfg, sign, towerLegRanges(cfg, zc, 0), base, legTop));
  // Der Riegel reicht bis unter die Fahrbahn und trägt sie zwischen den Beinen.
  strut(b, cfg, zc, strutBottom, cfg.roadY - 1, Math.max(2, cfg.legD[0] - 2));
  // Andreaskreuz zwischen den Beinen (Form G).
  const xi = cfg.inner - 1;
  const thick = cfg.fine ? 2 : 1;
  const rows = cfg.fine ? [zc - 1, zc, zc + 1, zc + 2] : [zc, zc + 1];
  for (const z of rows) {
    for (let t = 0; t < thick; t++) {
      b.line(-xi, base + t, z, xi, strutBottom - 1 - (thick - 1) + t, z, M.steel);
      b.line(xi, base + t, z, -xi, strutBottom - 1 - (thick - 1) + t, z, M.steel);
    }
  }
  void s;
}

function buildTowerSection(b, cfg, zc, i) {
  const y0 = i === 0 ? cfg.trussBottom : cfg.sectionY[i];
  const y1 = cfg.sectionY[i + 1] - 1;
  symmetricX((sign) => legSection(b, cfg, sign, towerLegRanges(cfg, zc, i), y0, y1));
  const [a, top] = STRUTS[i];
  const upperDepth = cfg.legD[Math.min(i + 1, cfg.legD.length - 1)];
  strut(b, cfg, zc, cfg.yOf(a), cfg.yOf(top) - 1, Math.max(2, upperDepth - 2));
}

// ---------------------------------------------------------------- Pylone, Ankerhäuser, Bogen

function pylonRange(cfg, zFromM) {
  const za = cfg.zOf(zFromM);
  return { za, zb: za + cfg.pylonDepth - 1, xa: cfg.halfDeck, xb: cfg.halfDeck + cfg.pylonWidth - 1 };
}

// Art-déco-Pylon aus Beton: Schaft, ab der Fahrbahn auf drei Seiten eingerückt, Krone nochmals gestuft; Rillen bei 1:1.
function buildPylon(b, cfg, zFromM, top, { beam = true } = {}) {
  const r = pylonRange(cfg, zFromM);
  const inset = cfg.mid ? 1 : 0;
  const crownY = top - (cfg.fine ? 3 : 1);
  symmetricX((sign) => {
    const box = (xa, xb, za, zb, y0, y1) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = xa; x <= xb; x++) {
          for (let z = za; z <= zb; z++) {
            const onX = x === xa || x === xb;
            const onZ = z === za || z === zb;
            if (!onX && !onZ && y !== y1) continue;
            let px = x;
            let pz = z;
            const groove = cfg.fine && y < y1;
            if (groove && onX && !onZ && x === xb && (z - za) % 3 === 1) px -= 1;
            if (groove && onZ && !onX && (x - xa) % 3 === 1) pz += z === za ? 1 : -1;
            b.set(sign * px, y, pz, M.concrete);
          }
        }
      }
    };
    box(r.xa, r.xb, r.za, r.zb, 0, cfg.roadY + 1);
    if (crownY >= cfg.roadY + 2) box(r.xa, r.xb - inset, r.za + inset, r.zb - inset, cfg.roadY + 2, crownY);
    const ci = inset * 2;
    if (top > crownY && r.zb - ci > r.za + ci) box(r.xa, r.xb - ci, r.za + ci, r.zb - ci, crownY + 1, top);
    b.fill(sign * r.xa, cfg.roadY + 1, r.za, sign * r.xb, cfg.roadY + 1, r.zb, M.concreteCap, { outline: true });
  });
  // Querbalken unter der Fahrbahn zwischen den beiden Pylonen (auf dem Ankerhaus nicht nötig).
  if (beam) b.fill(-(cfg.halfDeck - 1), cfg.trussBottom, r.za, cfg.halfDeck - 1, cfg.roadY - 1, r.zb, M.concrete, { hollow: true });
}

function buildHousing(b, cfg, zFromM, zToM) {
  const za = cfg.zOf(zFromM);
  const zb = cfg.zOf(zToM) - 1;
  const hw = cfg.halfDeck + cfg.pylonWidth - 1;
  b.fill(-hw, 0, za, hw, cfg.roadY - 1, zb, M.concrete, { hollow: true });
  if (cfg.mid) {
    const spacing = cfg.fine ? 6 : 4;
    for (let z = za + 2; z <= zb - 2; z += spacing) {
      symmetricX((sign) => b.fill(sign * (hw + 1), 0, z, sign * (hw + 1), cfg.roadY - 2, z, M.concrete));
    }
  }
  symmetricX((sign) => b.fill(sign * hw, cfg.roadY - 1, za, sign * hw, cfg.roadY - 1, zb, M.concreteCap));
}

function buildArch(b, cfg) {
  const { s } = cfg;
  const za = cfg.zOf(Z_ARCH_START);
  const zb = cfg.zOf(Z_ARCH_END) - 1;
  const spring = cfg.yOf(H_ARCH_SPRING);
  const girderBottom = cfg.yOf(H_GIRDER);
  const crown = girderBottom - 2;
  const ribThick = cfg.fine ? 3 : cfg.mid ? 2 : 1;
  const ribX = Math.max(1, cfg.halfDeck - 2);
  const ribXs = cfg.fine ? [ribX, ribX - 1] : [ribX];
  const zm = (za + zb) / 2;
  const half = (zb - za) / 2;
  const archTop = (z) => crown - (crown - spring) * ((z - zm) / half) ** 2;
  // Kämpferfundamente aus Beton: tragen die Bogenfüße und schließen an die Pylone an (Form G).
  const footLength = Math.max(2, cfg.zOf(8));
  const footTop = spring - ribThick;
  const footInner = ribXs[ribXs.length - 1] - 1;
  const footOuter = cfg.halfDeck + cfg.pylonWidth - 1;
  symmetricX((sign) => {
    for (const [z0, z1] of [[za, za + footLength - 1], [zb - footLength + 1, zb]]) {
      b.fill(sign * footInner, 0, z0, sign * footOuter, footTop, z1, M.concrete);
      b.fill(sign * footInner, footTop, z0, sign * footOuter, footTop, z1, M.concreteCap, { outline: true });
    }
  });
  symmetricX((sign) => {
    for (const x of ribXs) {
      for (let t = 0; t < ribThick; t++) curveAlongZ(b, sign * x, za, zb, (z) => archTop(z) - t, M.steel);
    }
  });
  // Ständer und Querverbände (alle 8 m, G).
  const posts = nodesBetween(za, zb, zm, 8 * s).slice(1, -1);
  for (const z of posts) {
    const yArch = Math.round(archTop(z));
    if (girderBottom - 2 > yArch) symmetricX((sign) => b.fill(sign * ribX, yArch + 1, z, sign * ribX, girderBottom - 2, z, M.steel));
    b.fill(-cfg.halfDeck, girderBottom - 1, z, cfg.halfDeck, girderBottom - 1, z, M.steel);
    if (cfg.mid) b.fill(-(ribXs[ribXs.length - 1] - 1), yArch, z, ribXs[ribXs.length - 1] - 1, yArch, z, M.steel);
  }
  symmetricX((sign) => b.fill(sign * cfg.halfDeck, girderBottom, za, sign * cfg.halfDeck, cfg.roadY - 1, zb, M.steel));
  return { za, zb, crown };
}

// ---------------------------------------------------------------- Zufahrten

// Stahlstütze: Säulen an den Ecken (halfZ = 0 → einfache Stützenreihe), Kreuzverbände in allen Seiten.
function steelSupport(b, cfg, zc, halfZ, yTop) {
  const X = cfg.halfDeck - 1;
  const c = cfg.colSize;
  const zs = halfZ > 0 ? [zc - halfZ, zc + halfZ] : [zc];
  for (const z of zs) {
    symmetricX((sign) => b.fill(sign * X, 0, z, sign * (X - c + 1), yTop, z + c - 1, M.steel));
  }
  const level = Math.max(3, Math.round(16 * cfg.s));
  const levels = [];
  for (let y = 0; y <= yTop; y += level) levels.push(y);
  if (levels[levels.length - 1] !== yTop) levels.push(yTop);
  const xi = X - c;
  for (const z of zs) {
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i];
      const y1 = levels[i + 1];
      b.line(-xi, y0, z, xi, y1, z, M.steel);
      b.line(xi, y0, z, -xi, y1, z, M.steel);
      b.fill(-xi, y1, z, xi, y1, z, M.steel);
    }
  }
  if (halfZ > 0) {
    symmetricX((sign) => {
      for (let i = 0; i < levels.length - 1; i++) {
        const za = zc - halfZ + c;
        const zb = zc + halfZ - 1;
        if (zb < za) continue;
        b.line(sign * X, levels[i], za, sign * X, levels[i + 1], zb, M.steel);
        b.line(sign * X, levels[i], zb, sign * X, levels[i + 1], za, M.steel);
        b.fill(sign * X, levels[i + 1], za, sign * X, levels[i + 1], zb, M.steel);
      }
    });
  }
}

function floorBeams(b, cfg, nodes, y) {
  for (const z of nodes) b.fill(-(cfg.halfDeck - 1), y, z, cfg.halfDeck - 1, y, z, M.steel);
}

function buildNorthViaduct(b, cfg) {
  const { s } = cfg;
  const za = cfg.abutment;
  const zb = cfg.zOf(Z_NORTH_VIADUCT_END) - 1;
  const bottom = cfg.yOf(H_VIADUCT_N_BOTTOM);
  const nodes = nodesBetween(za, zb, 0, 305 / 40 * s);
  symmetricX((sign) => verticalTruss(b, sign * cfg.halfDeck, nodes, bottom, cfg.roadY, M.steel));
  floorBeams(b, cfg, nodes, cfg.roadY - 1);
  for (let k = 1; k <= 4; k++) steelSupport(b, cfg, cfg.zOf(61 * k), Math.max(1, Math.round(3 * s)), bottom - 1);
}

function buildSouthViaduct(b, cfg) {
  const { s } = cfg;
  const za = cfg.zOf(Z_SOUTH_VIADUCT);
  const zb = cfg.zTotal - cfg.abutment - 1;
  const span = (zb + 1 - za) / 6;
  const trussBottom = cfg.yOf(H_CLEAR);
  const girderBottom = cfg.yOf(H_GIRDER);
  const supports = [1, 2, 3, 4, 5].map((k) => Math.round(za + k * span));
  const trussEnd = supports[2];
  const nodes = nodesBetween(za, trussEnd, za, PANEL * s);
  symmetricX((sign) => verticalTruss(b, sign * cfg.halfDeck, nodes, trussBottom, cfg.roadY, M.steel));
  floorBeams(b, cfg, nodes, cfg.roadY - 1);
  symmetricX((sign) => b.fill(sign * cfg.halfDeck, girderBottom, trussEnd + 1, sign * cfg.halfDeck, cfg.roadY - 1, zb, M.steel));
  floorBeams(b, cfg, nodesBetween(trussEnd + 1, zb, za, PANEL * s), cfg.roadY - 1);
  supports.forEach((z, i) => steelSupport(b, cfg, z, 0, (i <= 2 ? trussBottom : girderBottom) - 1));
  void s;
}

function buildAbutments(b, cfg) {
  const hw = cfg.halfDeck + 1;
  const a = cfg.abutment;
  for (const [za, zb] of [[0, a - 1], [cfg.zTotal - a, cfg.zTotal - 1]]) {
    b.fill(-hw, 0, za, hw, cfg.roadY - 1, zb, M.concrete, { hollow: true });
    b.fill(-hw, cfg.roadY - 1, za, hw, cfg.roadY - 1, zb, M.concreteCap, { outline: true });
  }
}

// ---------------------------------------------------------------- Kabel, Hänger, Versteifungsträger

function cableGeometry(cfg) {
  const { s } = cfg;
  const zN = cfg.zNorthTower + 0.5;
  const zS = cfg.zSouthTower + 0.5;
  const zMid = (zN + zS) / 2;
  const half = (zS - zN) / 2;
  const ySad = cfg.yOf(H_SADDLE);
  const yMid = cfg.yOf(H_CABLE_MID);
  const yEnd = cfg.yOf(H_PYLON_SADDLE);
  const yEntry = cfg.yOf(H_ANCHOR_ENTRY);
  const n1 = pylonRange(cfg, Z_NORTH_SUSPENDED - 15);
  const n2 = pylonRange(cfg, Z_NORTH_VIADUCT_END);
  const s2 = pylonRange(cfg, Z_SOUTH_SUSPENDED);
  const s1 = pylonRange(cfg, Z_ARCH_END);
  const center = (r) => Math.round((r.za + r.zb) / 2);
  const side = (zT, zP) => (z) => {
    const t = (z - zT) / (zP - zT);
    return ySad + (yEnd - ySad) * t - 4 * SIDE_SAG * s * t * (1 - t);
  };
  return {
    zN, zS, zMid, ySad, yMid, yEnd, yEntry, n1, n2, s1, s2,
    main: (z) => yMid + (ySad - yMid) * ((z - zMid) / half) ** 2,
    sideNorth: side(zN, center(n1)),
    sideSouth: side(zS, center(s2)),
    n1c: center(n1),
    s2c: center(s2),
  };
}

function buildCables(b, cfg, g, part) {
  const x = cfg.halfDeck;
  const result = { main: null, north: null, south: null };
  symmetricX((sign) => {
    if (part === 'main') {
      result.main = curveAlongZ(b, sign * x, Math.ceil(g.zN), Math.floor(g.zS), g.main, M.steel);
      return;
    }
    result.north = curveAlongZ(b, sign * x, Math.floor(g.zN), g.n1c, g.sideNorth, M.steel);
    result.south = curveAlongZ(b, sign * x, Math.ceil(g.zS), g.s2c, g.sideSouth, M.steel);
    // Rückhaltekabel: gerade vom Pylon-Sattel hinunter in die Ankerpylone N2 und S1.
    const lineTo = (zFrom, zTo, yFrom, yTo) => (z) => yFrom + (yTo - yFrom) * ((z - zFrom) / (zTo - zFrom));
    const zN2 = g.n2.zb + 1;
    const zS1 = g.s1.za - 1;
    curveAlongZ(b, sign * x, g.n1c, zN2, lineTo(g.n1c, zN2, g.yEnd, g.yEntry), M.steel);
    curveAlongZ(b, sign * x, g.s2c, zS1, lineTo(g.s2c, zS1, g.yEnd, g.yEntry), M.steel);
    b.set(sign * x, g.yEntry, g.n2.zb, M.steel);
    b.set(sign * x, g.yEntry, g.s1.za, M.steel);
  });
  return result;
}

function hangerPositions(cfg, g) {
  const sp = HANGER_SPACING * cfg.s;
  const main = [];
  for (let k = -41; k <= 41; k++) main.push(Math.round(g.zMid + k * sp));
  const north = [];
  const south = [];
  for (let k = 1; k <= 21; k++) {
    north.push(Math.round(g.zN - k * sp));
    south.push(Math.round(g.zS + k * sp));
  }
  return { main, north, south };
}

function buildHangers(b, cfg, zs, bottoms) {
  const yLow = cfg.roadY + 1;
  symmetricX((sign) => {
    for (const z of zs) {
      const top = bottoms.get(z);
      if (top === undefined || top - 1 < yLow) continue;
      b.fill(sign * cfg.halfDeck, yLow, z, sign * cfg.halfDeck, top - 1, z, M.rail);
    }
  });
}

function legZone(cfg, zc) {
  const r = towerLegRanges(cfg, zc, 0);
  return { za: r.za, zb: r.zb };
}

function buildStiffeningTruss(b, cfg, zFrom, zTo, origin) {
  if (zTo < zFrom) return;
  const nodes = nodesBetween(zFrom, zTo, origin, PANEL * cfg.s);
  symmetricX((sign) => verticalTruss(b, sign * cfg.halfDeck, nodes, cfg.trussBottom, cfg.roadY, M.steel));
  floorBeams(b, cfg, nodes, cfg.roadY - 1);
  if (!cfg.fine) return;
  // Windverband unten im Zickzack.
  const xi = cfg.halfDeck - 1;
  for (let i = 0; i < nodes.length - 1; i++) {
    const sign = i % 2 === 0 ? 1 : -1;
    b.line(-sign * xi, cfg.trussBottom, nodes[i], sign * xi, cfg.trussBottom, nodes[i + 1], M.steel);
  }
}

// ---------------------------------------------------------------- Fahrbahn

function deckZones(cfg, g) {
  const legN = legZone(cfg, cfg.zNorthTower);
  const legS = legZone(cfg, cfg.zSouthTower);
  const pylons = [g.n2, g.n1, g.s2, g.s1];
  const ww = cfg.walkWidth;
  return {
    isLeg: (z) => (z >= legN.za && z <= legN.zb) || (z >= legS.za && z <= legS.zb),
    isBypass: (z) => ww > 0 && ((z >= legN.za - ww && z <= legN.zb + ww) || (z >= legS.za - ww && z <= legS.zb + ww)),
    isPylon: (z) => pylons.some((p) => z >= p.za && z <= p.zb),
    isHousing: (z) => (z >= g.n2.za && z <= g.n1.zb) || (z >= cfg.zOf(Z_HOUSING_SOUTH) && z < cfg.zOf(Z_SOUTH_VIADUCT)),
  };
}

function buildRoad(b, cfg, zones) {
  const { roadY, roadHalf, halfDeck } = cfg;
  for (let z = 0; z < cfg.zTotal; z++) {
    b.fill(-roadHalf, roadY, z, roadHalf, roadY, z, M.road);
    if (zones.isLeg(z)) continue;
    symmetricX((sign) => {
      if (cfg.walkWidth > 0) b.fill(sign * (roadHalf + 1), roadY, z, sign * (halfDeck - 1), roadY, z, M.walk);
      setKeep(b, sign * halfDeck, roadY, z, zones.isHousing(z) ? M.concrete : M.steel);
    });
  }
}

function buildMarkings(b, cfg, zones) {
  const { roadY } = cfg;
  if (cfg.s < 0.5) return;
  const lines = cfg.fine ? [3, 6] : [2];
  const dash = cfg.fine ? 12 : 6;
  for (let z = 0; z < cfg.zTotal; z++) {
    if (z % dash < dash / 4) for (const x of lines) symmetricX((sign) => b.set(sign * x, roadY, z, M.marking));
    if (!zones.isLeg(z)) b.set(0, roadY + 1, z, M.median);
  }
}

function buildWalkways(b, cfg, zones) {
  const { roadY, roadHalf, halfDeck } = cfg;
  if (cfg.walkWidth <= 0) return;
  for (let z = 0; z < cfg.zTotal; z++) {
    if (zones.isLeg(z)) continue;
    symmetricX((sign) => b.fill(sign * (roadHalf + 1), roadY + 1, z, sign * (halfDeck - 1), roadY + 1, z, M.walkSlab));
  }
}

// Gehweg-Umgehung außen um die Turmbeine (die Gehwege führen im Original um die Beine herum).
function buildBypass(b, cfg, zc) {
  const ww = cfg.walkWidth;
  if (ww <= 0) return;
  const { roadY, roadHalf, halfDeck } = cfg;
  const leg = towerLegRanges(cfg, zc, 0);
  const outer = cfg.legOuter[0];
  const xMax = outer + ww;
  const za = leg.za - ww;
  const zb = leg.zb + ww;
  symmetricX((sign) => {
    for (let z = za; z <= zb; z++) {
      for (let x = roadHalf + 1; x <= xMax; x++) {
        const inLeg = x >= leg.xa && x <= outer && z >= leg.za && z <= leg.zb;
        if (inLeg) continue;
        const besideLeg = z >= leg.za && z <= leg.zb && x < leg.xa;
        if (besideLeg) continue;
        if (x > halfDeck || b.get(sign * x, roadY, z) === 'air') b.set(sign * x, roadY, z, M.walk);
        if (x > halfDeck) b.set(sign * x, roadY - 1, z, M.steel);
        b.set(sign * x, roadY + 1, z, M.walkSlab);
      }
    }
    // Geländer außen herum.
    for (let z = za - 1; z <= zb + 1; z++) {
      b.set(sign * (xMax + 1), roadY, z, M.steel);
      b.set(sign * (xMax + 1), roadY + 1, z, M.rail);
    }
    for (const z of [za - 1, zb + 1]) {
      for (let x = halfDeck + 1; x <= xMax; x++) {
        b.set(sign * x, roadY, z, M.steel);
        b.set(sign * x, roadY + 1, z, M.rail);
      }
    }
    b.set(sign * (xMax + 1), roadY + 2, za - 1, M.lantern);
    b.set(sign * (xMax + 1), roadY + 2, zb + 1, M.lantern);
  });
}

function buildRailing(b, cfg, zones) {
  const { roadY, halfDeck } = cfg;
  const hw = halfDeck + cfg.pylonWidth - 1;
  for (let z = 0; z < cfg.zTotal; z++) {
    if (zones.isBypass(z) || zones.isLeg(z)) continue;
    symmetricX((sign) => {
      if (zones.isHousing(z)) {
        if (!zones.isPylon(z)) setKeep(b, sign * hw, roadY, z, M.rail);
        return;
      }
      if (zones.isPylon(z)) return;
      setKeep(b, sign * halfDeck, roadY + 1, z, M.rail);
    });
  }
}

function buildLights(b, cfg, zones) {
  const { roadY, roadHalf, halfDeck } = cfg;
  if (cfg.fine) {
    // Mastleuchten alle 30 m auf der Gehweg-Innenkante, Leuchte hängt über der äußeren Spur (Form G).
    for (let z = 15; z < cfg.zTotal - 15; z += 30) {
      if (zones.isBypass(z) || zones.isPylon(z) || zones.isLeg(z)) continue;
      symmetricX((sign) => {
        const x = sign * (roadHalf + 1);
        b.fill(x, roadY + 1, z, x, roadY + 5, z, M.steelWall);
        b.set(sign * roadHalf, roadY + 5, z, M.steelSlab);
        b.set(sign * roadHalf, roadY + 4, z, M.lanternHanging);
      });
    }
    return;
  }
  const spacing = cfg.mid ? 16 : 12;
  for (let z = spacing / 2; z < cfg.zTotal; z += spacing) {
    if (zones.isBypass(z) || zones.isPylon(z) || zones.isLeg(z) || zones.isHousing(z)) continue;
    symmetricX((sign) => {
      if (b.get(sign * halfDeck, roadY + 1, z) === 'air') return;
      if (b.get(sign * halfDeck, roadY + 2, z) === 'air') b.set(sign * halfDeck, roadY + 2, z, M.lantern);
    });
  }
}

// ---------------------------------------------------------------- Kapitel

export default function build(b, { scale = 1 } = {}) {
  if (!meta.scales.includes(scale)) throw new Error(`Golden Gate Bridge: Maßstab ${scale} gibt es nicht (erlaubt: ${meta.scales.join(', ')}).`);
  const s = scale;
  const cfg = createConfig(s);
  const g = cableGeometry(cfg);
  const zones = deckZones(cfg, g);
  const lvl = (y) => y + 1; // Ebene N = y + 1
  const scaleText = s === 1 ? '1:1' : `1:${fmt(1 / s)}`;
  const commonTips = [
    'Baue im Kreativmodus und fliege (zweimal Leertaste); mit F3 siehst du deine Koordinaten. Die Brücke ist schnurgerade: Lege die Mittellinie auf eine feste x-Koordinate.',
    'Ebene 1 ist die Wasserlinie. Baust du über echtem Meer, führe Pfeiler und Stützen bis zum Grund weiter.',
  ];
  const zN = cfg.zNorthTower;
  const zS = cfg.zSouthTower;

  b.phase('Pfeiler im Wasser', `Maßstab ${scaleText}. Die Brücke läuft von Norden (Marin, z = 0) nach Süden (San Francisco) und ist ${blocks(Z_TOTAL, s)} lang. `
    + `Die beiden Türme stehen ${blocks(MAIN_SPAN, s)} auseinander (Mitte zu Mitte), der Nordturm ${blocks(Z_NORTH_TOWER, s)} vom Nordende. `
    + `Beide stehen auf Betonpfeilern bis Ebene ${lvl(cfg.yOf(H_PIER) - 1)} (Höhe geschätzt).`, {
    tips: [...commonTips, 'Markiere zuerst die Turmmitten und die Brückenachse mit Wolle – alles andere misst du von dort.'],
  });
  b.step('Südpfeiler mit Fender', `Der Südturm steht im offenen Wasser. Setze den Pfeiler (Glatter Stein, Rand aus Poliertem Andesit) und darum den ovalen Fender `
    + `(${blocks(72, s)} quer, ${blocks(56, s)} längs, ${blocks(3, s)} dick – Form geschätzt), der den Pfeiler gegen Schiffe und Wellen schützt.`);
  buildPier(b, cfg, zS, { fender: true });
  b.note(0, cfg.yOf(H_PIER) - 1, zS, 'Südpfeiler: Das Fundament reicht im Original 34 m unter Niedrigwasser. Der Fender darum wurde beim Bau leergepumpt.');
  b.step('Nordpfeiler am Lime Point', 'Der Nordturm steht direkt am Ufer von Marin. Setze denselben Pfeiler und lege Felsen aus Stein, Andesit und Bruchstein darum.');
  buildPier(b, cfg, zN, { fender: false });

  b.phase('Türme bis zur Fahrbahn', `Jeder Turm hat zwei hohle Beine (im Original Stahlzellen). Am Fuß misst ein Bein ${blocks(10, s)} quer × ${blocks(16, s)} längs. `
    + `Die Innenseiten der Beine stehen ${blocks(19, s)} auseinander – genau die Fahrbahnbreite. `
    + (cfg.fine ? 'Die Außenseiten haben senkrechte Rillen: zwischen den Eckpfosten ist jede zweite Spalte um einen Block eingerückt. ' : '')
    + `Unter der Fahrbahn verbindet ein Andreaskreuz die Beine, direkt unter der Fahrbahn ein Riegel (Ebene ${lvl(cfg.yOf(H_DECK_STRUT))}–${lvl(cfg.trussBottom - 1)}; Form geschätzt).`, {
    tips: [...commonTips, 'Baue beide Beine eines Turms Lage für Lage gleichzeitig hoch, dann bleiben sie sicher symmetrisch.'],
  });
  b.step('Nordturm bis zur Fahrbahn', `Beine von Ebene ${lvl(cfg.sectionY[0])} bis ${lvl(cfg.trussBottom - 1)}, dazu Kreuz und Fahrbahnriegel.`);
  buildTowerBelowDeck(b, cfg, zN);
  b.step('Südturm bis zur Fahrbahn', 'Genau wie beim Nordturm.');
  buildTowerBelowDeck(b, cfg, zS);

  b.phase('Türme über der Fahrbahn', `Über der Fahrbahn verbinden vier Querriegel die Beine. Die Öffnungen dazwischen werden nach oben kleiner `
    + `(${STRUTS.map(([a], i) => blocks(a - (i === 0 ? H_ROAD : STRUTS[i - 1][1]), s)).join(', ')}) – so wirkt der Turm höher (B). `
    + `An jedem Riegel springen die Beine zurück: quer ${cfg.legW.join(' → ')}, längs ${cfg.legD.join(' → ')} Blöcke. `
    + `Die Spitze liegt auf Ebene ${lvl(cfg.topY)} = ${H_TOWER} m über dem Wasser, 152 m über der Fahrbahn.`, {
    tips: [...commonTips, cfg.fine ? 'Die Riegel tragen auf Nord- und Südseite senkrechte Rippen (jede zweite Spalte steht einen Block vor) – das Art-déco-Merkmal der Türme.' : 'Die Riegel sind hier glatte Balken.'],
  });
  for (let i = 0; i < 4; i++) {
    const y0 = i === 0 ? cfg.trussBottom : cfg.sectionY[i];
    const y1 = cfg.sectionY[i + 1] - 1;
    const [a, top] = STRUTS[i];
    b.step(`Abschnitt ${i + 1}${i === 3 ? ' mit Krone' : ''} (beide Türme)`, `Beine von Ebene ${lvl(y0)} bis ${lvl(y1)} (${cfg.legW[i]} × ${cfg.legD[i]} Blöcke), `
      + `${i === 3 ? 'oben der Kronenriegel' : `Querriegel ${i + 1}`} auf Ebene ${lvl(cfg.yOf(a))}–${lvl(cfg.yOf(top) - 1)}.`
      + (i === 3 ? ' Über den Kronenriegel läuft später das Kabel – er ist das Dach des Turms.' : ''));
    buildTowerSection(b, cfg, zN, i);
    buildTowerSection(b, cfg, zS, i);
  }
  b.note(cfg.inner, cfg.topY, zS, `Turmspitze: ${H_TOWER} m über dem Wasser. Bei der Eröffnung 1937 waren das die höchsten Brückentürme der Welt.`);

  b.phase('Pylone, Ankerhäuser und Fort-Point-Bogen', 'An beiden Enden der Hängebrücke stehen Paare von Art-déco-Pylonen aus Beton (N1, N2, S1, S2). '
    + 'Unter den Ankerhäusern liegen im Original die riesigen Betonanker der Kabel (je 60.000 t). Im Süden überspannt der Stahlbogen die alte Festung Fort Point. '
    + 'Lage und Form der Pylone und Ankerhäuser sind geschätzt.', {
    tips: [...commonTips, 'Die Ankerhäuser sind hier hohl – im Spiel genügt die Hülle.'],
  });
  b.step('Ankerhaus Nord', `Betonblock unter der Fahrbahn, ${blocks(60, s)} lang, mit Wandpfeilern.`);
  buildHousing(b, cfg, Z_NORTH_VIADUCT_END, Z_NORTH_SUSPENDED);
  b.step('Pylone N1 und N2', `Je zwei Pylone links und rechts der Fahrbahn, ${blocks(10, s)} breit und ${blocks(15, s)} tief. N1 (Ende der Seitenöffnung) trägt oben das Kabel auf Ebene ${lvl(g.yEnd)}, N2 nimmt es auf Ebene ${lvl(g.yEntry)} auf.`);
  buildPylon(b, cfg, Z_NORTH_SUSPENDED - 15, g.yEnd - 1, { beam: false });
  buildPylon(b, cfg, Z_NORTH_VIADUCT_END, cfg.yOf(H_PYLON_TOP) - 1, { beam: false });
  b.step('Pylone S1 und S2', 'Dieselben Pylone im Süden: S2 am Ende der Seitenöffnung, S1 am Südende des Bogens.');
  buildPylon(b, cfg, Z_SOUTH_SUSPENDED, g.yEnd - 1);
  buildPylon(b, cfg, Z_ARCH_END, cfg.yOf(H_PYLON_TOP) - 1);
  b.step('Fort-Point-Bogen', `Zwei Bogenrippen spannen ${blocks(98, s)} von Pylon zu Pylon (Kämpfer auf Ebene ${lvl(cfg.yOf(H_ARCH_SPRING))}, Scheitel auf Ebene ${lvl(cfg.yOf(H_GIRDER) - 2)}). `
    + `Setze zuerst die vier Kämpferfundamente aus Glattem Stein (${blocks(8, s)} lang, direkt neben den Pylonen; Form geschätzt), `
    + 'dann jede Rippe von beiden Fundamenten her zur Mitte, zuletzt die Ständer und die Blechträger obendrauf.');
  const arch = buildArch(b, cfg);
  b.note(0, arch.crown, Math.round((arch.za + arch.zb) / 2), 'Fort-Point-Bogen: Der Ingenieur Joseph Strauss ließ den Bogen bauen, damit die Festung von 1861 erhalten blieb.');
  b.step('Ankerhaus Süd', `Wie im Norden, ${blocks(60, s)} lang, direkt hinter Pylon S1.`);
  buildHousing(b, cfg, Z_HOUSING_SOUTH, Z_SOUTH_VIADUCT);

  b.phase('Hauptkabel', `Die zwei Hauptkabel (echt 0,92 m dick → 1 Block) laufen in ${blocks(26, s)} Abstand über die Turmspitzen. Zwischen den Türmen hängen sie als Parabel `
    + `${blocks(SAG, s)} durch: von Ebene ${lvl(g.ySad)} an den Türmen bis Ebene ${lvl(g.yMid)} in der Mitte. `
    + `In den Seitenöffnungen fallen sie zu den Pylonen N1/S2 (Ebene ${lvl(g.yEnd)}) und von dort gerade in die Ankerpylone.`, {
    tips: [...commonTips, `Rechne die Höhe selbst nach: Abstand d von der Feldmitte in Blöcken → Höhe = ${g.yMid} + ${blocks(SAG, s).split(' ')[0]} · (d / ${Math.round((g.zS - g.zN) / 2)})². Setze alle 50 Blöcke einen Hilfsblock auf die richtige Höhe und verbinde dann.`,
      'Das Kabel ist flächenverbunden: Wo es steiler wird, setzt du die Blöcke treppenförmig übereinander.'],
  });
  b.step('Kabel der Hauptöffnung', 'Von Turm zu Turm, beide Seiten.');
  const mainBottoms = buildCables(b, cfg, g, 'main').main;
  b.note(0, g.yMid, Math.round(g.zMid), `Mitte der Hauptöffnung: Das Kabel hängt hier nur ${g.yMid - cfg.roadY - 1} Blöcke über der Fahrbahn; darunter ${H_CLEAR} m Durchfahrtshöhe.`);
  b.step('Kabel der Seitenöffnungen und Rückhaltekabel', `Von den Türmen hinunter zu N1 und S2 (Durchhang ${blocks(SIDE_SAG, s)} unter der Sehne), dann gerade in N2 und S1.`);
  const sideBottoms = buildCables(b, cfg, g, 'side');
  b.note(cfg.halfDeck, g.yEnd, g.s2c, 'Pylon S2: Hier liegt das Kabel auf und läuft über den Fort-Point-Bogen hinunter zum Anker.');

  b.phase('Hänger und Versteifungsträger', `Alle ${blocks(HANGER_SPACING, s)} hängt an jedem Kabel ein Hänger (echt 250 Paare im Abstand von 50 ft). `
    + `Daran hängt der ${blocks(7.6, s)} hohe Versteifungsträger: zwei Fachwerkwände unter den Kabeln, unten Ebene ${lvl(cfg.trussBottom)} (= ${H_CLEAR} m Durchfahrtshöhe), oben die Fahrbahnebene ${lvl(cfg.roadY)}.`, {
    tips: [...commonTips, 'Im Original wurde der Träger von beiden Türmen gleichzeitig nach außen und zur Mitte gebaut – so bleibt das Kabel im Gleichgewicht.'],
  });
  const hangers = hangerPositions(cfg, g);
  b.step('Hänger der Hauptöffnung', `${hangers.main.length} Hänger je Kabel aus Akazienholzzaun, vom Geländer (Ebene ${lvl(cfg.roadY + 1)}) bis unter das Kabel.`);
  buildHangers(b, cfg, hangers.main, mainBottoms);
  b.step('Hänger der Seitenöffnungen', `Je ${hangers.north.length} Hänger pro Kabel und Seitenöffnung.`);
  buildHangers(b, cfg, hangers.north, sideBottoms.north);
  buildHangers(b, cfg, hangers.south, sideBottoms.south);
  const legN = legZone(cfg, zN);
  const legS = legZone(cfg, zS);
  b.step('Versteifungsträger Hauptöffnung', `Fachwerk mit Pfosten alle ${blocks(PANEL, s)} und Diagonalen im Wechsel, dazu Querträger unter der Fahrbahn${cfg.fine ? ' und unten ein Windverband im Zickzack' : ''}.`);
  buildStiffeningTruss(b, cfg, legN.zb + 1, legS.za - 1, g.zMid);
  b.step('Versteifungsträger Seitenöffnungen', 'Gleiches Fachwerk von den Türmen bis zu den Pylonen N1 und S2.');
  buildStiffeningTruss(b, cfg, g.n1.zb + 1, legN.za - 1, g.zMid);
  buildStiffeningTruss(b, cfg, legS.zb + 1, g.s2.za - 1, g.zMid);

  b.phase('Zufahrten', 'Im Norden führt ein rund 305 m langes Fachwerk auf vier Stahltürmen zum Ufer, im Süden ein 218 m langer Viadukt (drei Fachwerk- und drei Blechträgerfelder) zum Toll Plaza. '
    + 'Im Original stehen die Stützen auf den Hügeln von Lime Point und Fort Point – hier reichen sie bis zur Wasserlinie. Passe ihre Länge an dein Gelände an.', {
    tips: [...commonTips],
  });
  b.step('Widerlager', `Betonblöcke an beiden Enden, ${blocks(6, s)} tief.`);
  buildAbutments(b, cfg);
  b.step('Zufahrt Nord', 'Fachwerk mit fünf Feldern und vier Stahltürmen.');
  buildNorthViaduct(b, cfg);
  b.step('Zufahrt Süd', 'Sechs Felder auf Stahlstützen, die drei nördlichen als Fachwerk, die drei südlichen als Blechträger (Reihenfolge geschätzt).');
  buildSouthViaduct(b, cfg);

  b.phase('Fahrbahn und Gehwege', `Die Fahrbahn liegt auf Ebene ${lvl(cfg.roadY)} – du stehst also ${H_ROAD} m über dem Wasser. Sie ist ${blocks(19, s)} breit`
    + (cfg.walkWidth > 0 ? `, daneben je ein ${cfg.walkWidth === 1 ? '1 Block' : `${cfg.walkWidth} Blöcke`} breiter Gehweg, um eine halbe Stufe erhöht` : '')
    + `. Gesamtbreite ${2 * cfg.halfDeck + 1} Blöcke (echt 27 m).`, {
    tips: [...commonTips, 'Setze die Fahrbahn in langen Bahnen mit /fill, wenn du Befehle nutzt – sie ist über 2,7 km schnurgerade.'],
  });
  b.step('Fahrbahnplatte', 'Grauer Beton über die ganze Länge; durch die Turmportale läuft nur die Fahrbahn.');
  buildRoad(b, cfg, zones);
  if (cfg.mid) {
    b.step('Markierungen und Mittelschutz', cfg.fine ? 'Sechs Spuren: gestrichelte Linien aus Weißem Beton, in der Mitte der verschiebbare Mittelschutz als Steinstufe.' : 'Gestrichelte Linien und eine Steinstufe als Mittelschutz.');
    buildMarkings(b, cfg, zones);
  }
  if (cfg.walkWidth > 0) {
    b.step('Gehwege', 'Glatte Steinstufen auf beiden Seiten.');
    buildWalkways(b, cfg, zones);
    b.step('Umgehung an den Türmen', 'Die Gehwege führen außen um die Turmbeine herum: eine Plattform auf Stahlkonsolen mit Geländer und zwei Laternen.');
    buildBypass(b, cfg, zN);
    buildBypass(b, cfg, zS);
  }

  b.phase('Geländer und Licht', 'Zum Schluss das Geländer an der Außenkante und die Beleuchtung. Der Architekt Irving Morrow hielt das Geländer bewusst schlicht, damit man im Vorbeifahren die Aussicht hat.', {
    tips: [...commonTips, 'Laternen hängen an einer Stufe (hängende Laterne) oder stehen auf einem Zaunpfosten – beides hält im Spiel.'],
  });
  b.step('Geländer', 'Akazienholzzaun auf der Außenkante; über den Ankerhäusern am Rand der Terrasse.');
  buildRailing(b, cfg, zones);
  b.step('Leuchten', cfg.fine ? 'Alle 30 Blöcke ein schlanker Mast aus Harzziegelmauer mit hängender Laterne über der äußeren Spur.' : 'Laternen auf dem Geländer.');
  buildLights(b, cfg, zones);
}
