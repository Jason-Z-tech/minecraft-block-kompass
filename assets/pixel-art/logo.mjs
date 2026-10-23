// Pixel-Kompass als „Block“: quadratisches Kupfergehäuse mit gestuften Ecken, Zifferblatt mit
// Blocktextur, diagonale Nadel (Nordost rot, Südwest weiß).
export const LOGO_PALETTE = {
  k: { fill: '#0d0e11' },
  C: { fill: '#f4a36a' },
  c: { fill: '#d0703c' },
  d: { fill: '#8e4724' },
  s: { fill: '#20242b' },
  S: { fill: '#2a2f37' },
  t: { fill: '#626772' },
  g: { fill: '#f2c14e' },
  G: { fill: '#b98a2a' },
  r: { fill: '#c42b27' },
  R: { fill: '#ff5f52' },
  w: { fill: '#ece8df' },
  W: { fill: '#a9a49a' },
};

function hash(x, y, seed) {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 7, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function blockCompass(n, o) {
  const last = n - 1;
  const half = n / 2;
  const grid = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      const dx = Math.min(x, last - x);
      const dy = Math.min(y, last - y);
      let ch = '.';
      if (dx + dy >= o.corner) {
        const ring = Math.min(dx, dy, dx + dy - o.corner);
        if (ring === 0 || ring === o.frame + 1) ch = 'k';
        else if (ring === 1) {
          const top = x < half && y < half;
          const bottom = x >= half && y >= half;
          if (top) ch = 'C';
          else if (bottom) ch = 'd';
          else if (y < half) ch = y < last - x ? 'C' : y > last - x ? 'd' : 'c'; // oben rechts
          else ch = x < last - y ? 'C' : x > last - y ? 'd' : 'c'; // unten links
        } else if (ring <= o.frame) ch = 'c';
        else ch = hash(Math.floor(x / o.tile), Math.floor(y / o.tile), o.seed) < o.texture ? 'S' : 's';
      }
      row.push(ch);
    }
    grid.push(row);
  }
  const needle = new Set();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = x + 0.5 - half;
      const py = y + 0.5 - half;
      const t = (px - py) / Math.SQRT2; // Richtung Nordost
      const s = (px + py) / Math.SQRT2; // quer dazu, positiv nach Südost
      if (Math.abs(s) / o.needleW + Math.abs(t) / o.needleL <= 1) {
        grid[y][x] = t > 0 ? (s < 0 ? 'R' : 'r') : (s < 0 ? 'w' : 'W');
        needle.add(`${x},${y}`);
      }
    }
  }
  if (o.needleOutline) {
    for (const key of needle) {
      const [x, y] = key.split(',').map(Number);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!needle.has(`${nx},${ny}`) && (grid[ny]?.[nx] === 's' || grid[ny]?.[nx] === 'S')) grid[ny][nx] = 'k';
      }
    }
  }
  for (const [x, y, ch] of o.extra) grid[y][x] = ch;
  return grid.map((r) => r.join(''));
}

export const LOGO_32 = blockCompass(32, {
  corner: 3, frame: 3, tile: 2, texture: 0.22, seed: 11, needleW: 3.0, needleL: 12.4, needleOutline: true,
  extra: [
    [15, 15, 'g'], [16, 15, 'g'], [15, 16, 'g'], [16, 16, 'G'],
    [15, 6, 'g'], [16, 6, 'g'], [15, 25, 't'], [16, 25, 't'], [6, 15, 't'], [6, 16, 't'], [25, 15, 't'], [25, 16, 't'],
  ],
});

export const FAVICON_16 = blockCompass(16, {
  corner: 2, frame: 2, tile: 2, texture: 0, seed: 3, needleW: 1.6, needleL: 5.6, needleOutline: false,
  extra: [[7, 7, 'g'], [8, 7, 'g'], [7, 8, 'g'], [8, 8, 'G']],
});
