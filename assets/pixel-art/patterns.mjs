// Prozedurale Pixel-Muster: Gelände-Streifen (Gras → Erde → Stein mit Erzen) und Tiefenschiefer-Textur.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TERRAIN_PALETTE = {
  T: { fill: '#86c653' }, // Grasbüschel
  L: { fill: '#74b746' }, // Gras hell
  g: { fill: '#5da33b' }, // Gras
  G: { fill: '#46852b' }, // Gras dunkel
  e: { fill: '#6b4a33' }, // Erde
  E: { fill: '#543825' }, // Erde dunkel
  f: { fill: '#80593c' }, // Erde hell
  s: { fill: '#30343b' }, // Stein
  S: { fill: '#262a30' }, // Stein dunkel
  h: { fill: '#3b4048' }, // Stein hell
  b: { fill: '#1d2025' }, // Tiefenschiefer (Übergang zum Seitengrund)
  c: { fill: '#d0703c' }, C: { fill: '#f09563' }, // Kupfer
  o: { fill: '#f2c14e' }, O: { fill: '#fde58f' }, // Gold
  r: { fill: '#e0342f' }, R: { fill: '#ff6a5e' }, // Redstone
  d: { fill: '#5de3d8' }, D: { fill: '#c4fbf6' }, // Diamant
};

const ORE_SHAPES = [
  ['.x.', 'xXx', '.x.'],
  ['xx.', 'xXx', '.x.'],
  ['.xx', 'Xx.', '...'],
];

export function terrain(width = 96, height = 18, seed = 26) {
  const rnd = mulberry32(seed);
  const grid = Array.from({ length: height }, () => Array(width).fill('.'));
  // Grasdecke mit Büscheln und Tropfen
  const dripDepth = Array.from({ length: width }, () => (rnd() < 0.26 ? 1 + Math.floor(rnd() * 2) : 0));
  for (let x = 0; x < width; x++) {
    if (rnd() < 0.22) grid[0][x] = 'T';
    grid[1][x] = rnd() < 0.2 ? 'T' : 'L';
    grid[2][x] = 'g';
    grid[3][x] = rnd() < 0.5 ? 'g' : 'G';
    for (let y = 4; y < 4 + dripDepth[x]; y++) grid[y][x] = y === 3 + dripDepth[x] ? 'G' : 'g';
  }
  // Erde
  for (let y = 4; y < 11; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] !== '.') continue;
      const v = rnd();
      grid[y][x] = v < 0.12 ? 'E' : v < 0.17 ? 'f' : 'e';
    }
  }
  // Übergang Erde → Stein unregelmäßig
  for (let x = 0; x < width; x++) {
    const top = 11 + (rnd() < 0.35 ? -1 : 0);
    for (let y = top; y < height; y++) {
      const v = rnd();
      grid[y][x] = v < 0.18 ? 'S' : v < 0.3 ? 'h' : 's';
    }
  }
  // Unterkante: zum Seitengrund hin dunkler und gestuft
  for (let x = 0; x < width; x++) {
    const cut = rnd();
    grid[height - 2][x] = cut < 0.5 ? 'b' : grid[height - 2][x];
    grid[height - 1][x] = cut < 0.35 ? '.' : 'b';
  }
  // Erze (feste Stellen, damit jede Farbe sichtbar ist)
  const ores = [[9, 12, 'c'], [30, 13, 'o'], [51, 12, 'r'], [70, 13, 'd'], [86, 12, 'c']];
  ores.forEach(([ox, oy, kind], i) => {
    const shape = ORE_SHAPES[i % ORE_SHAPES.length];
    shape.forEach((row, dy) => [...row].forEach((ch, dx) => {
      if (ch === '.') return;
      grid[oy + dy][ox + dx] = ch === 'X' ? kind.toUpperCase() : kind;
    }));
  });
  return grid.map((r) => r.join(''));
}

// Sehr dezente Textur für den Seitengrund (32×32, nur halbtransparente Flecken)
export function deepslate(size = 32, seed = 7) {
  const rnd = mulberry32(seed);
  const grid = Array.from({ length: size }, () => Array(size).fill('.'));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x += 2) {
      const v = rnd();
      const ch = v < 0.1 ? 'l' : v < 0.22 ? 'k' : '.';
      grid[y][x] = ch;
      if (rnd() < 0.6) grid[y][x + 1] = ch;
    }
  }
  return grid.map((r) => r.join(''));
}

export const DEEPSLATE_PALETTE = {
  l: { fill: '#ffffff', opacity: '.018' },
  k: { fill: '#000000', opacity: '.10' },
};
