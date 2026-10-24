// Kolosseum (Rom) im heutigen Ruinenzustand. Grundlage: docs/recherche/kolosseum.md.
// Kennzeichen wie in der Recherche: B belegt, S Sekundärquelle, R Rechnung, G geschätzt.
// Maße in Metern; der Maßstab s rechnet sie in Blöcke um (1 Block = 1 m bei s = 1).
// Der Bau entsteht Spalte für Spalte: Für jede Spalte (x, z) wird der Abstand zum Außenrand (Ring-Abstand d)
// und die Lage im Bogenraster (Joch k, Anteil f) berechnet; daraus ergibt sich, welcher Bauteil dort steht.

export const meta = {
  id: 'kolosseum',
  title: 'Kolosseum',
  category: 'wahrzeichen',
  subtitle: 'Amphitheatrum Flavium in Rom, als Ruine wie heute',
  tags: ['Italien', 'Rom', 'Antike', 'Amphitheater', 'Arena', 'Ruine', 'Weltwunder', 'Riesig', 'Maßstab 1:1'],
  aliases: [
    'kolosseum', 'colosseum', 'coliseum', 'colosseo', 'kolloseum', 'koloseum', 'kolloseum rom', 'colloseum',
    'amphitheatrum flavium', 'flavisches amphitheater', 'flavian amphitheatre', 'amphitheater rom', 'arena rom',
    'römisches amphitheater', 'roemisches amphitheater', 'gladiatoren arena', 'gladiatorenarena', 'rom', 'rome', 'roma',
  ],
  accuracy: 'massstab',
  difficulty: 5,
  description: 'Das Kolosseum als Ruine, so wie es heute dasteht: 188 × 156 m Ellipse, die Außenfassade mit vier '
    + 'Geschossen (dorisch, ionisch, korinthisch, Attika mit Fenstern und Konsolen) nur an der Nordseite von Bogen '
    + 'XXIII bis LIV, gestützt von den Ziegelpfeilern von Stern und Valadier. Im Süden bildet der zweite Ring die '
    + 'Außenwand, die Ränge sind eingestürzt und das Hypogäum liegt offen, mit einem nachgebauten Stück Arenaboden. '
    + 'Geschätzt sind die Ruinenhöhen im Süden, der Innenaufbau unter den Rängen und die Form der Stützpfeiler; '
    + 'vereinfacht: echte Ellipse statt Vier-Zentren-Oval, Längsachse genau Ost–West (echt etwa WNW–OSO), '
    + 'im Maßstab 1:2 ein voll gemauerter Unterbau unter den Rängen.',
  facts: [
    'Ellipse 188 × 156 m (Achsen, Wikipedia de/en: 188–189 × 156 m), Fassade 48,5 m hoch.',
    'Arena 86 × 54 m, umgeben vom Podium etwa 4 m über dem Arenaboden.',
    'Je Geschoss 80 Bögen; unten 4,20 m breit und 7,05 m hoch, darüber 6,45 m und 6,40 m hoch.',
    'Säulenordnungen von unten: dorisch (toskanisch), ionisch, korinthisch; darüber die geschlossene Attika mit korinthischen Pilastern.',
    'In der Attika saßen 240 Konsolen für die Masten des Sonnensegels (Velarium) – drei pro Joch.',
    'Außenwand aus Travertin ohne Mörtel, zusammengehalten von rund 300 t Eisenklammern; innen Tuff, Ziegel und römischer Beton.',
    'Nach dem Erdbeben von 1349 stürzte die Südseite des Außenrings ein; erhalten sind die Bögen XXIII bis LIV im Norden.',
    'Die Enden der erhaltenen Fassade stützen Ziegelpfeiler von Raffaele Stern (1806/07, Osten) und Giuseppe Valadier (1823, Westen).',
    'Das Hypogäum unter der Arena ist rund 6 m tief, mit einem Mittelgang entlang der Längsachse und zwölf gebogenen Gängen.',
    '76 nummerierte Eingänge für das Volk, dazu 4 Haupteingänge an den Achsen; Platz für etwa 50.000 Zuschauer.',
  ],
  sources: [
    { title: 'Wikipedia (de): Kolosseum', url: 'https://de.wikipedia.org/wiki/Kolosseum' },
    { title: 'Wikipedia (en): Colosseum', url: 'https://en.wikipedia.org/wiki/Colosseum' },
    { title: 'Wikipedia (it): Colosseo', url: 'https://it.wikipedia.org/wiki/Colosseo' },
    { title: 'Platner & Ashby (1929): Amphitheatrum Flavium (LacusCurtius)', url: 'https://penelope.uchicago.edu/Thayer/E/Gazetteer/Places/Europe/Italy/Lazio/Roma/Rome/_Texts/PLATOP*/Amphitheatrum_Flavium.html' },
    { title: 'the-colosseum.net: Numbers', url: 'https://the-colosseum.net/wp/en/numbers/' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

// --- Maße (Meter) ---
const HALF_LONG_M = 94;          // B: 188 m
const HALF_SHORT_M = 78;         // B: 156 m
const BAYS = 80;                 // B
const ARCH_WIDTH_M = 4.2;        // B
const ARENA_EDGE_M = 51;         // R: (188 − 86) / 2 = (156 − 54) / 2 = 51
const PODIUM_M = 4;              // B: Podium ca. 4 m über der Arena
const CAVEA_SLOPE = Math.tan((37 * Math.PI) / 180); // S: Neigung der Ränge 37°
const HYPOGEUM_DEPTH_M = 6.08;   // B: Unterbauten 5,50–6,08 m
const PAVEMENT_M = 17.5;         // B: Travertinpflaster rund um den Bau
const G0 = 2;                    // Oberkante Erdgeschoss-Boden (y = 1 ist der Boden)

// Ringe vom Außenrand nach innen (Meter, B: 2. Ring 5,80 m innen, 3. Ring weitere 4,50 m; Dicken R/G)
const ZONES_M = [
  ['outer', 2.7], ['amb1', 3.1], ['ring2', 2.4], ['amb2', 2.1], ['ring3', 1.8],
];
const MIN_THICK = { outer: 1.5, amb1: 1.5, ring2: 1.5, amb2: 1.2, ring3: 1.5 };

// Geschosse der Außenfassade (Meter über dem Erdgeschossboden; Höhen aus Platner & Ashby abgeleitet, R)
const STOREYS = [
  { id: 1, base: 0, pedTop: 0, archTop: 7.05, corniceFrom: 9.5, top: 10.5, vault: 8.5 },
  { id: 2, base: 10.5, pedTop: 12.85, archTop: 19.3, corniceFrom: 21.35, top: 22.35, vault: 20.35 },
  { id: 3, base: 22.35, pedTop: 24.3, archTop: 30.7, corniceFrom: 32.95, top: 33.95, vault: 31.95 },
];
// Attika-Oberkante so gewählt, dass die Fassade mit Stylobat (1 m) die belegten 48,5 m erreicht (R); Lage von Fenstern und Konsolen G.
const ATTIC = { base: 33.95, pedTop: 36.05, lowWin: [34.5, 35.5], highWin: [38.5, 41], consoles: [42.6, 43.6], corniceFrom: 46.5, top: 47.5 };
const FACADE_TOP_M = ATTIC.top;

// Erhaltene Außenwand: Bögen XXIII–LIV = Joche 44–76 (Nordeingang = Joch 60), dazu die Stützpfeiler.
const KEEP_FROM = 43.5;
const KEEP_TO = 76.5;
const VALADIER_FROM = 40.5;
const STERN_TO = 79;

// --- Blöcke ---
// Travertin: ruhige Mischung je Block; helle Verwitterung (Kalzit) entsteht in zusammenhängenden Flecken (weathered()).
const TRAV = [['smooth_sandstone', 10], ['cut_sandstone', 3], ['sandstone', 1]];
const TRAV_PAVE = [['smooth_sandstone', 8], ['cut_sandstone', 2]];
const BRICK = [['bricks', 8], ['mud_bricks', 2], ['packed_mud', 1]];
const TUFF = [['tuff', 6], ['tuff_bricks', 3]];
const WEATHER_FROM = new Set(['smooth_sandstone', 'cut_sandstone', 'sandstone']);
const WEATHERED = 'calcite';
const TRAV_STAIRS = 'smooth_sandstone_stairs';
const TRAV_SLAB = 'smooth_sandstone_slab';
const COLUMN = 'sandstone_wall';
const BRICK_STAIRS = 'brick_stairs';
const WOOD = 'spruce_planks';
const BEAM = 'stripped_spruce_log';
const RAIL = 'spruce_fence';

const PHASES = [
  { key: 'hypo', title: 'Hypogäum' },
  { key: 'base', title: 'Fundament, Pflaster und Stufen' },
  { key: 's1', title: 'Erdgeschoss: dorische Bögen und Unterbau' },
  { key: 's2', title: 'Zweites Geschoss: ionische Bögen' },
  { key: 's3', title: 'Drittes Geschoss: korinthische Bögen' },
  { key: 'attic', title: 'Attika mit Fenstern und Konsolen' },
  { key: 'cavea', title: 'Zuschauerränge (Cavea)' },
  { key: 'buttress', title: 'Stützpfeiler von Stern und Valadier' },
  { key: 'arena', title: 'Arenaboden (Teilrekonstruktion)' },
  { key: 'light', title: 'Beleuchtung' },
];

function checkScale(scale) {
  if (!meta.scales.includes(scale)) throw new Error(`Kolosseum: Maßstab ${scale} gibt es nicht (erlaubt: ${meta.scales.join(', ')}).`);
  return scale;
}

// Umfang einer Ellipse (Ramanujan II).
function perimeter(a, b) {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

// Bogenlänge auf der Außenellipse als Tabelle über den Parameterwinkel.
function arcTable(a, b, n = 4096) {
  const arc = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const t0 = ((i - 1) / n) * 2 * Math.PI;
    const t1 = (i / n) * 2 * Math.PI;
    arc[i] = arc[i - 1] + Math.hypot(a * (Math.cos(t1) - Math.cos(t0)), b * (Math.sin(t1) - Math.sin(t0)));
  }
  const total = arc[n];
  const at = (theta) => {
    const p = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * n;
    const i = Math.min(n - 1, Math.floor(p));
    return arc[i] + (arc[i + 1] - arc[i]) * (p - i);
  };
  const thetaAt = (length) => {
    const target = ((length % total) + total) % total;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arc[mid] <= target) lo = mid;
      else hi = mid;
    }
    const frac = (target - arc[lo]) / Math.max(1e-9, arc[lo + 1] - arc[lo]);
    return ((lo + frac) / n) * 2 * Math.PI;
  };
  return { total, at, thetaAt };
}

function facingOf(vx, vz) {
  if (Math.abs(vx) >= Math.abs(vz)) return vx >= 0 ? 'east' : 'west';
  return vz >= 0 ? 'south' : 'north';
}

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

// Glatte, deterministische Zufallskurve über die 80 Joche (für Ruinenhöhen).
function makeNoise(b, count) {
  const values = Array.from({ length: count }, () => b.rng());
  return (u) => {
    const p = (((u / BAYS) * count) % count + count) % count;
    const i = Math.floor(p);
    const t = p - i;
    const smooth = t * t * (3 - 2 * t);
    return values[i] + (values[(i + 1) % count] - values[i]) * smooth;
  };
}

// Ganzzahliger Hash einer Gitterzelle → 0 … 1 (deterministisch, unabhängig von der Aufrufreihenfolge).
function hash3(x, y, z, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Wertrauschen mit weichem Übergang zwischen den Gitterpunkten (Gitterweite size Blöcke).
function valueNoise(x, y, z, size, salt) {
  const fx = x / size;
  const fy = y / size;
  const fz = z / size;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const z0 = Math.floor(fz);
  const smooth = (t) => t * t * (3 - 2 * t);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const tz = smooth(fz - z0);
  let sum = 0;
  for (let dx = 0; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dz = 0; dz <= 1; dz++) {
        const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
        sum += w * hash3(x0 + dx, y0 + dy, z0 + dz, salt);
      }
    }
  }
  return sum;
}

// Helle Verwitterungsflecken im Travertin: zusammenhängende Kalzit-Stellen statt einzelner Tupfen (rund 7 % der Blöcke).
function weathered(x, y, z, state, s) {
  if (!WEATHER_FROM.has(state)) return state;
  const n = 0.7 * valueNoise(x, y * 1.6, z, 6 * s, 11) + 0.3 * valueNoise(x, y, z, Math.max(1, 2 * s), 23);
  return n > (y <= 0 ? 0.75 : 0.69) ? WEATHERED : state; // Pflaster (y 0) nur vereinzelt hell
}

function circularDistance(u, from, to) {
  if (u >= from && u <= to) return 0;
  const d1 = (from - u + BAYS) % BAYS;
  const d2 = (u - to + BAYS) % BAYS;
  return Math.min(d1, d2);
}

function makeGeometry(s) {
  const a = HALF_LONG_M * s;
  const b = HALF_SHORT_M * s;
  const arcs = arcTable(a, b);
  const bayLen = arcs.total / BAYS;
  const zones = [];
  let d = 0;
  for (const [key, thick] of ZONES_M) {
    const w = Math.max(thick * s, MIN_THICK[key]);
    zones.push({ key, from: d, to: d + w });
    d += w;
  }
  const caveaFrom = d;
  const podiumFrom = (ARENA_EDGE_M - 2) * s;
  const arenaFrom = ARENA_EDGE_M * s;
  // Ring-Abstand d (Blöcke) eines Punktes: (X/(a−d))² + (Z/(b−d))² = 1, per Bisektion.
  const offsetOf = (X, Z) => {
    let lo = -PAVEMENT_M * s - 3;
    let hi = b - 1e-6;
    const f = (dd) => (X / (a - dd)) ** 2 + (Z / (b - dd)) ** 2 - 1;
    if (f(lo) > 0) return null;
    for (let i = 0; i < 44; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  const pointAt = (theta, dd) => [(a - dd) * Math.cos(theta), (b - dd) * Math.sin(theta)];
  return { s, a, b, arcs, bayLen, zones, caveaFrom, podiumFrom, arenaFrom, offsetOf, pointAt };
}

function zoneAt(geo, d) {
  if (d < -2 * geo.s) return 'pavement';
  if (d < 0) return 'stylobate';
  for (const zone of geo.zones) if (d < zone.to) return zone.key;
  if (d < geo.podiumFrom) return 'cavea';
  if (d < geo.arenaFrom) return 'podium';
  return 'arena';
}

// --- Bauen ---
export default function build(b, { scale = 1 } = {}) {
  const s = checkScale(scale);
  const geo = makeGeometry(s);
  const detailed = s >= 1;
  const noise = { ring2: makeNoise(b, 40), ring2b: makeNoise(b, 160), ring3: makeNoise(b, 40), cavea: makeNoise(b, 30), stub: makeNoise(b, 160) };
  const out = new Map(PHASES.map((p) => [p.key, []]));
  const emit = (phase, x, y, z, state) => out.get(phase).push([x, y, z, weathered(x, y, z, state, s)]);
  const ctx = { b, geo, s, detailed, noise, emit, hm: (y) => (y - G0 + 0.5) / s, special: specialCells(geo, detailed) };
  ctx.ladders = ladderCells(ctx);

  const reach = Math.ceil(geo.a + PAVEMENT_M * s) + 1;
  const reachZ = Math.ceil(geo.b + PAVEMENT_M * s) + 1;
  for (let x = -reach; x < reach; x++) {
    for (let z = -reachZ; z < reachZ; z++) {
      const column = columnInfo(geo, x, z);
      if (column) buildColumn(ctx, column);
    }
  }
  placeLights(ctx);

  for (const phase of PHASES) {
    const cells = out.get(phase.key);
    if (cells.length === 0) continue;
    const texts = phaseTexts(phase.key, geo, detailed);
    b.phase(phase.title, texts.text, { tips: texts.tips });
    for (const [x, y, z, state] of cells) {
      if (state === 'air') b.remove(x, y, z);
      else b.set(x, y, z, state);
    }
    for (const note of notesFor(phase.key, ctx)) b.note(note[0], note[1], note[2], note[3]);
  }
}

function columnInfo(geo, x, z) {
  const X = x + 0.5;
  const Z = z + 0.5;
  const d = geo.offsetOf(X, Z);
  if (d === null || d < -PAVEMENT_M * geo.s) return null;
  const ra = geo.a - d;
  const rb = geo.b - d;
  const theta = Math.atan2(Z / rb, X / ra);
  const u = geo.arcs.at(theta) / geo.bayLen;
  const k = ((Math.round(u) % BAYS) + BAYS) % BAYS;
  const f = u - Math.round(u);                         // −0,5 … 0,5; 0 = Bogenmitte, ±0,5 = Pfeilermitte
  const localBay = perimeter(Math.max(ra, 0.5), Math.max(rb, 0.5)) / BAYS; // Jochlänge in Blöcken an dieser Stelle
  const outward = facingOf(X / (ra * ra), Z / (rb * rb));
  const tangent = facingOf(-ra * Math.sin(theta), rb * Math.cos(theta));
  return {
    x, z, X, Z, d, dm: d / geo.s, u: ((u % BAYS) + BAYS) % BAYS, k, f, theta,
    alongM: (f * localBay) / geo.s,                     // Meter von der Bogenmitte entlang des Rings
    pierM: ((0.5 - Math.abs(f)) * localBay) / geo.s,    // Meter bis zur Pfeilermitte
    localBayM: localBay / geo.s,
    outward, inward: OPPOSITE[outward], tangent, zone: zoneAt(geo, d),
  };
}

// Säulen, Pilaster und Konsolen sitzen genau an den Pfeilern bzw. Jochdritteln: diese Zellen vorab bestimmen.
function specialCells(geo, detailed) {
  const columns = new Set();
  const pilasters = new Set();
  const consoles = new Set();
  const key = (x, z) => `${x},${z}`;
  if (!detailed) return { columns, pilasters, consoles, key };
  for (let k = 0; k < BAYS; k++) {
    const pierTheta = geo.arcs.thetaAt((k + 0.5) * geo.bayLen);
    const [cx, cz] = geo.pointAt(pierTheta, -0.5);
    columns.add(key(Math.floor(cx), Math.floor(cz)));
    const [px, pz] = geo.pointAt(pierTheta, 0.5);
    pilasters.add(key(Math.floor(px), Math.floor(pz)));
    for (const off of [-0.25, 0, 0.25]) {
      const [qx, qz] = geo.pointAt(geo.arcs.thetaAt((k + off) * geo.bayLen), -0.5);
      consoles.add(key(Math.floor(qx), Math.floor(qz)));
    }
  }
  return { columns, pilasters, consoles, key };
}

function storeyAt(hm) {
  for (const st of STOREYS) if (hm < st.top) return st;
  return null;
}

function phaseForHeight(hm) {
  if (hm < 0) return 'base';
  if (hm < STOREYS[0].top) return 's1';
  if (hm < STOREYS[1].top) return 's2';
  if (hm < STOREYS[2].top) return 's3';
  return 'attic';
}

function archOpen(hm, alongM, st, width = ARCH_WIDTH_M) {
  if (!st || hm < st.pedTop || hm >= st.archTop) return false;
  const r = width / 2;
  if (Math.abs(alongM) >= r) return false;
  const spring = st.archTop - r;
  return hm < spring || (hm - spring) ** 2 + alongM ** 2 < r * r;
}

// Erhaltungsgrad: 1 im Norden (Joche 44–76), fällt über 4 Joche auf 0 (Süden).
function preserved(u) {
  return Math.max(0, 1 - circularDistance(u, KEEP_FROM, KEEP_TO) / 4);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function buildColumn(ctx, c) {
  const { geo, emit, b } = ctx;
  const { x, z } = c;
  switch (c.zone) {
    case 'pavement': {
      emit('base', x, 0, z, b.pickWeighted(TRAV_PAVE));
      // Fünf Grenzsteine (Cippi) im Osten, 18 m vor der Fassade (B: fünf in situ; Abstand untereinander G).
      if (ctx.detailed && c.dm < -PAVEMENT_M + 1 && (c.k <= 2 || c.k >= 78) && Math.abs(c.alongM) < 0.5) {
        emit('base', x, 1, z, COLUMN);
        emit('base', x, 2, z, COLUMN);
      }
      return;
    }
    case 'stylobate':
      emit('base', x, 0, z, b.pickWeighted(TRAV_PAVE));
      emit('base', x, 1, z, c.dm < -1 ? `${TRAV_SLAB}[type=bottom]` : b.pickWeighted(TRAV));
      buildFacadeFront(ctx, c);
      return;
    case 'arena':
      buildArena(ctx, c);
      return;
    default:
      emit('base', x, 0, z, 'tuff');
      emit('base', x, 1, z, c.zone === 'cavea' || c.zone === 'podium' ? b.pickWeighted(TUFF) : b.pickWeighted(TRAV_PAVE));
  }
  if (c.zone === 'outer') buildOuterWall(ctx, c);
  else if (c.zone === 'amb1') buildAmbulatory(ctx, c, 'outer', 'ring2', 1);
  else if (c.zone === 'ring2') buildInnerRing(ctx, c, 2);
  else if (c.zone === 'amb2') buildAmbulatory(ctx, c, 'ring2', 'ring3', 2);
  else if (c.zone === 'ring3') buildInnerRing(ctx, c, 3);
  else if (c.zone === 'cavea') buildCavea(ctx, c);
  else if (c.zone === 'podium') buildPodium(ctx, c);
}

// Höhe (Meter), bis zu der die Außenwand an dieser Stelle steht; 0 = nur Pfeilerstumpf/weg.
function outerTop(ctx, c) {
  const { u } = c;
  if (u >= KEEP_FROM && u < KEEP_TO) return FACADE_TOP_M;
  if (u >= VALADIER_FROM && u < KEEP_FROM) return FACADE_TOP_M * ((u - VALADIER_FROM) / (KEEP_FROM - VALADIER_FROM)) ** 0.85;
  return 0;
}

function inValadier(c) {
  return c.u >= VALADIER_FROM && c.u < KEEP_FROM;
}

function inStern(c) {
  return c.u >= KEEP_TO && c.u < STERN_TO;
}

function sternTop(c) {
  return FACADE_TOP_M * Math.max(0, (STERN_TO - c.u) / (STERN_TO - KEEP_TO));
}

function buildOuterWall(ctx, c) {
  const { emit, b } = ctx;
  const top = outerTop(ctx, c);
  if (inStern(c)) {
    buildSternColumn(ctx, c);
    return;
  }
  if (top <= 0) {
    // Süden: nur Pfeilerstümpfe der eingestürzten Außenwand.
    if (c.pierM < 1.2) {
      const h = 0.5 + 1.6 * ctx.noise.stub(c.u);
      for (let y = G0; ctx.hm(y) < h; y++) emit('s1', c.x, y, c.z, b.pickWeighted(TRAV));
    }
    return;
  }
  const brick = inValadier(c);
  const outerSkin = c.d - 0 < 1;
  for (let y = G0; ; y++) {
    const hm = ctx.hm(y);
    if (hm >= top) break;
    const state = facadeCell(ctx, c, hm, y, { brick, outerSkin });
    if (state && state !== 'air') emit(brick ? 'buttress' : phaseForHeight(hm), c.x, y, c.z, state);
  }
  // Stern hat die letzten Bögen vor seinem Pfeiler vermauert.
  if (c.u >= KEEP_TO - 1 && c.u < KEEP_TO) {
    for (let y = G0; ctx.hm(y) < STOREYS[2].top; y++) {
      if (archOpen(ctx.hm(y), c.alongM, storeyAt(ctx.hm(y)))) emit('buttress', c.x, y, c.z, b.pickWeighted(BRICK));
    }
  }
}

function facadeCell(ctx, c, hm, y, { brick, outerSkin }) {
  const { b } = ctx;
  const wall = () => (brick ? b.pickWeighted(BRICK) : b.pickWeighted(TRAV));
  const st = storeyAt(hm);
  if (st) {
    if (archOpen(hm, c.alongM, st)) return 'air';
    // Bogenrand: obere Treppe, die zum Pfeiler hin voll ist.
    if (hm >= st.pedTop && hm < st.archTop + 0.5 && Math.abs(c.alongM) < ARCH_WIDTH_M / 2 && Math.abs(c.alongM) > 0.6
      && archOpen(hm - 1 / ctx.s, c.alongM, st)) {
      const towardPier = c.alongM > 0 ? c.tangent : OPPOSITE[c.tangent];
      return `${brick ? BRICK_STAIRS : TRAV_STAIRS}[facing=${towardPier},half=top]`;
    }
    return wall();
  }
  // Attika
  const bayEven = c.k % 2 === 0;
  if (hm >= ATTIC.lowWin[0] && hm < ATTIC.lowWin[1] && !bayEven && Math.abs(c.alongM) < 0.6) return 'air';
  if (hm >= ATTIC.highWin[0] && hm < ATTIC.highWin[1] && bayEven && Math.abs(c.alongM) < 1.0) return 'air';
  if (ctx.detailed && outerSkin && hm >= ATTIC.pedTop && hm < ATTIC.corniceFrom && ctx.special.pilasters.has(ctx.special.key(c.x, c.z))) {
    return 'cut_sandstone';
  }
  return wall();
}

// Vor der Wand (Stylobat-Ring): Halbsäulen, Gesimse und Konsolen, nur wo die Fassade steht.
function buildFacadeFront(ctx, c) {
  if (c.d < -1) return;
  if (!ctx.detailed) {
    if (inStern(c)) buildSternColumn(ctx, c);
    return;
  }
  const { emit, b, special } = ctx;
  const top = inStern(c) ? 0 : outerTop(ctx, c);
  if (top <= 0) {
    if (inStern(c)) buildSternColumn(ctx, c);
    return;
  }
  const brick = inValadier(c);
  const phaseOf = (hm) => (brick ? 'buttress' : phaseForHeight(hm));
  const isColumn = special.columns.has(special.key(c.x, c.z));
  const isConsole = special.consoles.has(special.key(c.x, c.z));
  for (let y = G0; ; y++) {
    const hm = ctx.hm(y);
    if (hm >= top) break;
    const st = storeyAt(hm);
    let state = null;
    if (st && hm >= st.corniceFrom) state = `${TRAV_STAIRS}[facing=${c.inward},half=top]`;
    else if (!st && hm >= ATTIC.corniceFrom) state = isConsole ? null : `${TRAV_STAIRS}[facing=${c.inward},half=top]`; // Lücken = Mastlöcher
    else if (!st && hm >= ATTIC.consoles[0] && hm < ATTIC.consoles[1] && isConsole) state = `${TRAV_STAIRS}[facing=${c.inward},half=top]`;
    else if (!st && isColumn) {
      // Korinthische Pilaster der Attika: Sockel, Schaft wie die Halbsäulen darunter, Kapitell unter dem Gesims.
      if (hm < ATTIC.pedTop) state = b.pickWeighted(TRAV);
      else if (hm + 1 / ctx.s >= ATTIC.corniceFrom) state = 'cut_sandstone';
      else state = COLUMN;
    }
    else if (st && isColumn && ctx.detailed) {
      const capital = hm + 1 / ctx.s >= st.corniceFrom;
      if (st.id > 1 && hm < st.pedTop) state = b.pickWeighted(TRAV);            // Sockel unter der Säule
      else if (capital) state = st.id === 1 ? `${TRAV_SLAB}[type=top]` : st.id === 2 ? `${TRAV_STAIRS}[facing=${c.inward},half=top]` : 'cut_sandstone';
      else state = COLUMN;
    }
    if (state) ctx.emit(phaseOf(hm), c.x, y, c.z, state);
  }
}

// Stern-Pfeiler: Ziegelkeil, der vom Fassadenende schräg zum Boden abfällt.
function buildSternColumn(ctx, c) {
  const top = sternTop(c);
  for (let y = G0; ctx.hm(y) < top; y++) ctx.emit('buttress', c.x, y, c.z, ctx.b.pickWeighted(BRICK));
}

function ring2Top(ctx, c) {
  const south = 17 + 9 * ctx.noise.ring2(c.u) + 3 * (ctx.noise.ring2b(c.u) - 0.5);
  return lerp(south, ATTIC.base + 2.5, preserved(c.u));
}

function ring3Top(ctx, c) {
  const south = 8 + 9 * ctx.noise.ring3(c.u);
  return lerp(south, caveaHeight(c.dm) + 0.5, preserved(c.u));
}

function caveaCap(ctx, c) {
  const south = 6 + 10 * ctx.noise.cavea(c.u);
  return lerp(south, 99, preserved(c.u));
}

function caveaHeight(dm) {
  return PODIUM_M + (ARENA_EDGE_M - 2 - dm) * CAVEA_SLOPE;
}

function buildInnerRing(ctx, c, ring) {
  const { emit, b } = ctx;
  const top = ring === 2 ? ring2Top(ctx, c) : ring3Top(ctx, c);
  const material = ring === 2 ? TRAV : TUFF;
  const buttress = ring === 2 && inStern(c);
  for (let y = G0; ; y++) {
    const hm = ctx.hm(y);
    if (hm >= top) break;
    const st = storeyAt(hm);
    const opensHere = ring === 2 ? Boolean(st) : Boolean(st) && st.id <= 2;
    if (opensHere && archOpen(hm, c.alongM, st) && !(buttress && hm < sternTop(c))) continue;
    emit(phaseForHeight(hm), c.x, y, c.z, buttress && hm < sternTop(c) ? b.pickWeighted(BRICK) : b.pickWeighted(material));
  }
}

// Umgänge zwischen den Ringen: Tonnengewölbe je Geschoss, nur wo beide Wände hoch genug stehen.
function buildAmbulatory(ctx, c, outerKey, innerKey, which) {
  const { emit, b, geo } = ctx;
  if (which === 1 && inStern(c)) {
    buildSternColumn(ctx, c);
    return;
  }
  const outerWallTop = which === 1 ? outerTop(ctx, c) : ring2Top(ctx, c);
  const innerWallTop = which === 1 ? ring2Top(ctx, c) : ring3Top(ctx, c);
  const support = Math.min(outerWallTop, innerWallTop);
  const zone = geo.zones.find((zn) => zn.key === (which === 1 ? 'amb1' : 'amb2'));
  const edgeOuter = c.d < zone.from + 1;
  const edgeInner = c.d >= zone.to - 1;
  const ladder = ladderCell(ctx, c, which);
  for (const st of STOREYS) {
    if (support < st.top) break;
    for (let y = G0; ; y++) {
      const hm = ctx.hm(y);
      if (hm >= st.top) break;
      if (hm < st.vault - 1 / ctx.s) continue;
      if (ladder) continue;
      if (hm >= st.vault) emit(phaseForHeight(hm), c.x, y, c.z, which === 1 ? b.pickWeighted(TRAV) : b.pickWeighted(BRICK));
      else if (which === 1 && (edgeOuter || edgeInner) && ctx.detailed) {
        emit(phaseForHeight(hm), c.x, y, c.z, `${TRAV_STAIRS}[facing=${edgeOuter ? c.outward : c.inward},half=top]`);
      }
    }
  }
  if (ladder) {
    let topLevel = 0;
    for (const st of STOREYS) if (support >= st.top) topLevel = st.top;
    const facing = ctx.ladders.get(`${c.x},${c.z}`);
    for (let y = G0; ctx.hm(y) < topLevel; y++) emit(phaseForHeight(ctx.hm(y)), c.x, y, c.z, `ladder[facing=${facing}]`);
  }
}

// Leitern im äußeren Umgang an vier Pfeilern im Norden (echt: Treppen in den Umgängen, Lage G).
function ladderCell(ctx, c, which) {
  if (which !== 1) return false;
  const zone = ctx.geo.zones.find((zn) => zn.key === 'amb1');
  if (c.d < zone.to - 1) return false;
  return ctx.ladders.has(`${c.x},${c.z}`);
}

// Leiterzellen: je Pfeiler rechts der Bögen 50, 56, 64, 70 die Zelle an der Innenkante des äußeren Umgangs,
// dort ist der zweite Ring auf ganzer Höhe geschlossen und trägt die Leiter.
function ladderCells(ctx) {
  const { geo } = ctx;
  const zone = geo.zones.find((zn) => zn.key === 'amb1');
  const cells = new Map();
  for (const k of [50, 56, 64, 70]) {
    const theta = geo.arcs.thetaAt((k + 0.5) * geo.bayLen);
    const [PX, PZ] = geo.pointAt(theta, zone.to - 0.5);
    // Unter den Umgangszellen um den Pfeilerpunkt die nächste mit einem geschlossenen Ringblock direkt dahinter.
    let best = null;
    for (let x = Math.floor(PX) - 2; x <= Math.floor(PX) + 2; x++) {
      for (let z = Math.floor(PZ) - 2; z <= Math.floor(PZ) + 2; z++) {
        const c = columnInfo(geo, x, z);
        if (!c || c.zone !== 'amb1') continue;
        const facing = ladderFacing(ctx, c);
        const dist = Math.hypot(x + 0.5 - PX, z + 0.5 - PZ);
        if (facing && (!best || dist < best.dist)) best = { key: `${x},${z}`, facing, dist };
      }
    }
    if (best) cells.set(best.key, best.facing);
  }
  if (cells.size !== 4) throw new Error(`Kolosseum: nur ${cells.size} von 4 Leitern fanden Halt am zweiten Ring.`);
  return cells;
}

// Leiter-Richtung: weg von der Nachbarzelle, die im zweiten Ring an einem Pfeiler liegt (bevorzugt nach außen).
function ladderFacing(ctx, c) {
  const step = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };
  const order = [c.outward, ...Object.keys(step).filter((f) => f !== c.outward)];
  for (const facing of order) {
    const [dx, dz] = step[facing];
    const back = columnInfo(ctx.geo, c.x - dx, c.z - dz);
    // Außerhalb der Bogenbreite ist der Ring in jedem Geschoss geschlossen.
    if (back && back.zone === 'ring2' && Math.abs(back.alongM) >= ARCH_WIDTH_M / 2) return facing;
  }
  return null;
}

function buildCavea(ctx, c) {
  const { emit, b } = ctx;
  const surface = caveaHeight(c.dm);
  const cap = caveaCap(ctx, c);
  const shellFrom = surface - 2 / ctx.s;
  const radial = c.pierM * ctx.s < 0.75;
  const ringWall = 1.5 / ctx.s;
  const annular = (c.dm >= 24 && c.dm < 24 + ringWall) || (c.dm >= 36 && c.dm < 36 + ringWall);
  const axial = (c.k === 0 || c.k === 40) && Math.abs(c.alongM) < 2.1;
  for (let y = G0; ; y++) {
    const hm = ctx.hm(y);
    if (hm >= surface || hm >= cap) break;
    if (axial && hm < 6) continue;                                // Durchgang an der Längsachse zur Arena
    let state = null;
    if (hm >= shellFrom) state = b.pickWeighted(BRICK);
    else if (!ctx.detailed || radial) state = b.pickWeighted(TUFF); // bei 1:2 wären die Kammern nur 1 Block breite Schlitze → voll
    else if (annular) {
      const door = Math.abs(c.alongM) < 1.1 && (hm < 2.4 || (hm < 3.2 && Math.abs(c.alongM) < 0.6));
      if (!door) state = b.pickWeighted(TUFF);
    } else {
      for (const st of STOREYS) {
        if (hm >= st.vault && hm < st.top && shellFrom > st.top + 2) state = b.pickWeighted(BRICK);
      }
    }
    if (state) emit(hm >= shellFrom ? 'cavea' : phaseForHeight(hm), c.x, y, c.z, state);
  }
}

function buildPodium(ctx, c) {
  const axial = (c.k === 0 || c.k === 40) && Math.abs(c.alongM) < 2.1;
  for (let y = G0; ctx.hm(y) < PODIUM_M; y++) {
    if (axial) continue;
    ctx.emit('s1', c.x, y, c.z, ctx.b.pickWeighted(BRICK));
  }
}

// Abstand der gebogenen Hypogäum-Mauern: 4 m (B: zwölf Gänge); im halben Maßstab jede zweite Mauer.
function hypoSpacing(s) {
  return s >= 1 ? 4 : 8;
}

// Hypogäum: Mittelgang entlang der Längsachse, gebogene Mauern alle 4 m, darüber stellenweise der Holzboden.
function buildArena(ctx, c) {
  const { emit, b, s } = ctx;
  const e = c.dm - ARENA_EDGE_M;              // Meter vom Arenarand nach innen
  const floorY = G0 - Math.round(HYPOGEUM_DEPTH_M * s) - 1;
  // Boden aus festgetretener Erde, Flecken von Grober Erde und alten Tuffplatten.
  const ground = valueNoise(c.x, 0, c.z, 5, 37);
  emit('hypo', c.x, floorY, c.z, ground < 0.38 ? 'coarse_dirt' : ground > 0.64 ? 'tuff' : 'packed_mud');
  const spacing = hypoSpacing(s);
  const ring = Math.floor(e / spacing);
  const onWall = e < 25 && e - ring * spacing < 1.5 / s;
  const wallOpen = onWall && ring > 0 && c.k % 3 === 1 && Math.abs(c.alongM) < 1.1 / Math.min(1, s * 2);
  for (let y = floorY + 1; y < G0; y++) {
    if (!onWall) continue;
    const depth = (G0 - y - 0.5) / s;
    if (wallOpen && depth > 2.6) continue;
    emit('hypo', c.x, y, c.z, depth > 3 ? b.pickWeighted(TUFF) : b.pickWeighted(BRICK));
  }
  // Teilrekonstruktion des Arenabodens im Osten (G: Lage und Größe nach Fotos geschätzt).
  if (c.X > 16 * s) {
    emit('arena', c.x, G0 - 1, c.z, WOOD);
    if (!onWall && ((c.x % 4) + 4) % 4 === 0) emit('arena', c.x, G0 - 2, c.z, `${BEAM}[axis=z]`);
    if (c.X - 1 <= 16 * s && ctx.detailed) emit('arena', c.x, G0, c.z, RAIL);
  }
}

// Licht: Laternen in Umgängen, Kammern unter den Rängen und unter dem Holzboden.
function placeLights(ctx) {
  const { geo, emit, s } = ctx;
  const lit = new Set();
  // Licht kommt ins Schlusskapitel (hängende Laternen erst, wenn ihre Gewölbe stehen); die Laternen im Hypogäum
  // setzt du vor dem Holzboden darüber.
  const once = (x, y, z, state, phase = 'light') => {
    const k = `${x},${y},${z}`;
    if (lit.has(k)) return;
    lit.add(k);
    emit(phase, x, y, z, state);
  };
  const reach = Math.ceil(geo.a) + 1;
  const reachZ = Math.ceil(geo.b) + 1;
  for (let x = -reach; x < reach; x++) {
    for (let z = -reachZ; z < reachZ; z++) {
      const c = columnInfo(geo, x, z);
      if (!c || Math.abs(c.alongM * s) >= 0.71) continue;
      if (c.zone === 'amb1' || c.zone === 'amb2') lightAmbulatory(ctx, c, once);
      else if (c.zone === 'cavea') lightCavea(ctx, c, once);
      else if (c.zone === 'arena') lightHypogeum(ctx, c, once);
    }
  }
}

function lightAmbulatory(ctx, c, once) {
  const which = c.zone === 'amb1' ? 1 : 2;
  const zone = ctx.geo.zones.find((zn) => zn.key === c.zone);
  const mid = (zone.from + zone.to) / 2;
  if (Math.abs(c.d - mid) > 0.5 || c.k % 2 !== 0 || ctx.ladders.has(`${c.x},${c.z}`)) return;
  const support = which === 1 ? Math.min(outerTop(ctx, c), ring2Top(ctx, c)) : Math.min(ring2Top(ctx, c), ring3Top(ctx, c));
  for (const st of STOREYS) {
    if (support < st.top) break;
    // Höchste Luftzelle unter dem Gewölbe: Dort beginnt die Kette, die Laterne hängt 3 Blöcke über dem Boden.
    let top = G0;
    while (ctx.hm(top + 1) < st.vault) top++;
    let floor = G0;
    while (ctx.hm(floor) < st.base) floor++;
    const lampY = Math.min(top, floor + 3);
    for (let y = top; y > lampY; y--) once(c.x, y, c.z, 'iron_chain[axis=y]');
    once(c.x, lampY, c.z, 'lantern[hanging=true]');
  }
}

function lightCavea(ctx, c, once) {
  if (c.k === 0 || c.k === 40) {
    // Durchgang an der Längsachse: alle 10 m eine Laterne auf dem Boden (die Kammern darüber sind nach oben offen).
    if (Math.abs(c.alongM * ctx.s) < 0.6 && Math.abs((c.dm % 10) - 5) < 0.75 / ctx.s) {
      once(c.x, G0, c.z, 'lantern[hanging=false]');
    }
    return;
  }
  if (!ctx.detailed) return;
  const segments = [[12, 24], [25.2, 36], [37.2, 49]];
  const seg = segments.find(([a, bb]) => c.dm >= a && c.dm < bb);
  if (!seg) return;
  const mid = (seg[0] + seg[1]) / 2;
  if (Math.abs(c.dm - mid) > 0.75 / ctx.s) return;
  const surface = caveaHeight(c.dm);
  const shellFrom = surface - 2 / ctx.s;
  const cap = caveaCap(ctx, c);
  const floors = [0];
  for (const st of STOREYS) if (shellFrom > st.top + 2) floors.push(st.top);
  for (const floorM of floors) {
    let y = G0;
    while (ctx.hm(y) < floorM) y++;
    const hm = ctx.hm(y);
    if (hm + 1 >= shellFrom || hm >= cap) continue;
    once(c.x, y, c.z, 'lantern[hanging=false]');
  }
}

function lightHypogeum(ctx, c, once) {
  if (c.X <= 16 * ctx.s || c.k % 2 !== 0) return;
  const e = c.dm - ARENA_EDGE_M;
  const spacing = hypoSpacing(ctx.s);
  const ring = Math.floor(e / spacing);
  const inCorridor = e >= 25 ? Math.abs(c.Z) < 0.75 : Math.abs(e - ring * spacing - (spacing + 1.5 / ctx.s) / 2) < 0.5 / ctx.s;
  if (!inCorridor) return;
  const floorY = G0 - Math.round(HYPOGEUM_DEPTH_M * ctx.s) - 1;
  once(c.x, floorY + 1, c.z, 'lantern[hanging=false]', 'hypo');
}

// --- Texte ---
function phaseTexts(key, geo, detailed) {
  const s = geo.s;
  const m = (meters) => Math.max(1, Math.round(meters * s));
  const texts = {
    hypo: {
      text: `Fang unten an: Grabe die Arena-Ellipse (${m(86)} × ${m(54)} Blöcke) ${m(HYPOGEUM_DEPTH_M)} Blöcke tief aus. Unten kommt ein Boden aus Festem Schlamm, Tuff und Grober Erde, darauf die gebogenen Mauern des Hypogäums: alle ${m(4)} Blöcke eine Mauer parallel zum Arenarand, in der Mitte bleibt ein Gang entlang der Längsachse (Ost–West). Unten Tuff, oben Ziegel; in jede dritte Mauer kommen Durchgänge.`,
      tips: ['Steck zuerst die beiden Achsen mit einer Blockreihe ab (Ost–West und Nord–Süd) und markiere die Enden der Ellipse – alle Ringe richten sich danach.'],
    },
    base: {
      text: `Rund um den Bau liegt ein ${m(PAVEMENT_M)} Blöcke breites Travertinpflaster, darauf zwei Stufen (eine Stufe als untere Platte, dann ein voller Block). Unter dem ganzen Bau bis zur Arena kommt eine Lage Tuff als Fundament, darüber der Boden der Umgänge. Im Osten stehen am Rand des Pflasters fünf Grenzsteine.`,
      tips: ['Die Außenellipse misst ' + `${m(188)} × ${m(156)} Blöcke. Baue sie aus vier gleichen Vierteln: Was du im Nordosten setzt, spiegelst du in die anderen Viertel.`],
    },
    s1: {
      text: `Das Erdgeschoss: Die Außenwand steht nur im Norden (Bögen XXIII bis LIV). Jeder der ${BAYS} Bögen ist ${m(ARCH_WIDTH_M)} Blöcke breit und ${m(7.05)} hoch, der Pfeiler dazwischen rund ${m(2.4)} breit${detailed ? '; vor jedem Pfeiler steht eine dorische Halbsäule aus Sandsteinmauer mit einer oberen Platte als Kapitell' : ''}. Dahinter folgen der äußere Umgang, der zweite Ring mit Bögen, der innere Umgang und der dritte Ring aus Tuff. ${detailed ? `Unter den Rängen tragen ${BAYS} Radialmauern; zwei Ringmauern mit Türen teilen die Kammern.` : 'Unter den Rängen ist der Unterbau in diesem Maßstab voll gemauert (die echten Kammern wären nur 1 Block breit); frei bleiben nur die Durchgänge an der Längsachse.'} Die Gewölbe der Umgänge schließen bei ${m(10.5)} Blöcken.`,
      tips: ['Setze die Bogenränder als obere Treppen, deren volle Seite zum Pfeiler zeigt – so wird der Bogen rund.', detailed
        ? 'Laternen an Ketten in jedem zweiten Joch der Umgänge, in jeder Kammer unter den Rängen und im Achsdurchgang halten den Bau monsterfrei.'
        : 'Laternen an Ketten in jedem zweiten Joch der Umgänge und im Achsdurchgang halten den Bau monsterfrei.'],
    },
    s2: {
      text: `Zweites Geschoss: Über dem Gesims (obere Treppen, volle Seite zur Wand) kommt ein glatter Sockelstreifen, darüber die ionischen Bögen, ${m(6.45)} Blöcke hoch. ${detailed ? 'Die Halbsäulen stehen auf kleinen Sockeln und tragen als Kapitell eine obere Treppe. ' : ''}Im Süden steht nur noch der zweite Ring – unregelmäßig abgebrochen, er bildet dort heute die Außenwand.`,
      tips: ['Die Leitern im äußeren Umgang (vier Pfeiler im Norden) führen dich nach oben.'],
    },
    s3: {
      text: `Drittes Geschoss mit den korinthischen Bögen (${m(6.4)} Blöcke hoch) – Aufbau wie darunter. Die Gewölbe dieses Geschosses tragen den Boden der Attika.`,
      tips: ['Arbeite Joch für Joch rund um die Ellipse, nicht Ebene für Ebene über den ganzen Bau – so bleiben die Bögen sauber übereinander.'],
    },
    attic: {
      text: `Die Attika ist eine geschlossene Wand bis ${m(FACADE_TOP_M)} Blöcke über dem Boden${detailed ? ', gegliedert durch korinthische Pilaster über jeder Halbsäule (Sandsteinmauer auf einem Sockelblock, oben ein Block Geschnittener Sandstein als Kapitell)' : ''}. Unten sitzt über jedem zweiten Bogen ein kleines Fenster, oben in den anderen Jochen ein größeres. ${detailed ? 'Kurz unter dem Abschlussgesims stehen drei Konsolen pro Joch (obere Treppen); darüber hat das Gesims Lücken – dort gingen die Masten für das Sonnensegel durch.' : ''}`.trim(),
      tips: ['Das Abschlussgesims ist eine Reihe oberer Treppen mit der vollen Seite zur Wand.'],
    },
    cavea: {
      text: `Die Ränge steigen vom Podium (${m(PODIUM_M)} Blöcke über der Arena) mit etwa 37° nach außen an: auf 4 Blöcke nach außen rund 3 Blöcke höher. Die Marmorsitze sind längst weg; was bleibt, ist eine abgetreppte Schale aus Ziegeln auf den Radialmauern. Im Norden ist sie fast ganz erhalten, im Süden nur der untere Teil.`,
      tips: ['Baue die Schale von unten (Podium) nach oben: Jede Stufe liegt auf den Radialmauern darunter.'],
    },
    buttress: {
      text: 'An den Enden der erhaltenen Fassade stehen die Stützpfeiler aus dem 19. Jahrhundert: im Osten der Ziegelkeil von Raffaele Stern (1806/07), der die letzten Bögen einmauert und schräg zum Boden abfällt, im Westen der Pfeiler von Giuseppe Valadier (1823), der die Bögen in Ziegel nachbaut und stufenweise niedriger wird.',
      tips: ['Setz die Ziegelpfeiler gleich nach dem Ende der Travertinfassade – sie halten sie zusammen.'],
    },
    arena: {
      text: 'Zum Schluss der nachgebaute Arenaboden im Osten: Fichtenbretter auf der Höhe des Erdgeschosses, darunter Balken aus Entrindetem Fichtenholz quer über den Gängen. Am offenen Rand ein Geländer aus Fichtenzaun. Der Rest des Hypogäums bleibt offen, wie heute.',
      tips: ['Unter dem Holzboden stehen Laternen in den Gängen (die hast du schon beim Hypogäum gesetzt) – sonst spawnen dort Monster.'],
    },
    light: {
      text: `Zum Schluss das Licht, damit in den überdachten Teilen keine Monster spawnen: In jedem zweiten Joch der Umgänge hängt in der Mitte eine Laterne an einer Eisenkette, 3 Blöcke über dem Boden des Geschosses – die Kette beginnt direkt unter dem Gewölbe.${detailed ? ' In jede Kammer unter den Rängen kommt eine Laterne auf den Boden, je Kammerreihe eine.' : ''} Im Durchgang an der Längsachse steht alle ${m(10)} Blöcke eine Laterne.`,
      tips: ['Häng erst die Kette ans Gewölbe und dann die Laterne unten an die Kette – mit Rechtsklick an die Unterseite der Kette.'],
    },
  };
  return texts[key];
}

function notesFor(key, ctx) {
  const { geo } = ctx;
  const at = (u, dm, hm) => {
    const theta = geo.arcs.thetaAt(u * geo.bayLen);
    const [X, Z] = geo.pointAt(theta, dm * geo.s);
    let y = G0;
    while (ctx.hm(y) < hm) y++;
    return [Math.floor(X), y, Math.floor(Z)];
  };
  switch (key) {
    case 'hypo': return [[...at(10, ARENA_EDGE_M + 10, -3), 'Das Hypogäum: Hier warteten Tiere, Kulissen und Gladiatoren; Aufzüge hoben sie durch Falltüren in die Arena.']];
    case 's1': return [
      [...at(60, 1, 1), 'Nordeingang (Haupteingang an der kurzen Achse, zwischen den Bögen XXXVIII und XXXIX).'],
      [...at(0, 30, 1), 'Durchgang an der Längsachse: Hier ging es direkt in die Arena.'],
    ];
    case 's2': return [[...at(20, 6.5, 12), 'Im Süden ist der Außenring eingestürzt (Erdbeben 1349). Der zweite Ring bildet hier heute die Außenwand.']];
    case 'attic': return ctx.detailed ? [[...at(60, -0.5, 42), 'Drei Konsolen pro Joch trugen die 240 Masten des Sonnensegels (Velarium).']] : [];
    case 'buttress': return [
      [...at(77.5, 1, 6), 'Stern-Pfeiler (1806/07): ein schlichter Ziegelkeil ohne Bögen.'],
      [...at(42, 1, 6), 'Valadier-Pfeiler (1823): die Bögen in Ziegel nachgebaut, stufenweise niedriger.'],
    ];
    case 'arena': return [[...at(0, ARENA_EDGE_M + 8, 0), 'Nachgebauter Teil des Arenabodens. Lage und Größe geschätzt.']];
    default: return [];
  }
}
