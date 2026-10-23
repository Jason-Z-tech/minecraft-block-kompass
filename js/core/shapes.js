// Geometrie-Helfer für den Builder (§6.2). Alle Formen sind exakt, symmetrisch und lückenlos.
//
// Konventionen:
// - Ein Block (x, y, z) wird durch seinen Mittelpunkt mit den ganzzahligen Koordinaten vertreten.
// - Mittelpunkte dürfen ganz (Mitte eines Blocks → ungerader Durchmesser) oder halb sein
//   (Kante zwischen zwei Blöcken → gerader Durchmesser), z. B. cx = 2.5 für die Blöcke 0 … 5.
// - Radius r: ein Block gehört dazu, wenn sein Abstand zum Mittelpunkt ≤ r + 0.5 ist.
//   Dadurch gilt entlang der Achsen genau: Durchmesser = 2·r + 1 Blöcke.
//   Ungerader Durchmesser D: ganzzahliger Mittelpunkt, r = (D − 1) / 2.
//   Gerader Durchmesser D: halber Mittelpunkt, r = (D − 1) / 2 (also auch halb). spanCenter/spanRadius rechnen das aus.
// - Hohl (thickness t): alle Blöcke der Form, die höchstens t Schritte über Flächen vom Außenraum
//   entfernt sind. Kein innerer Block berührt den Außenraum mit einer Fläche (6-Nachbarschaft dicht).
//   Zylinder, Kegel, Prisma und Kuppeln sind oben und unten offen (nur Mantel).

const FULL_ROW = [-Infinity, Infinity];
const MAX_EXTENT = 32768;

export function spanCenter(start, size) {
  return start + (size - 1) / 2;
}

export function spanRadius(size) {
  return (size - 1) / 2;
}

function checkHalf(value, name) {
  if (!Number.isFinite(value) || !Number.isInteger(value * 2)) {
    throw new Error(`${name} muss eine ganze oder halbe Zahl sein (z. B. 4 oder 4.5), bekommen: ${value}.`);
  }
}

function checkInteger(value, name) {
  if (!Number.isInteger(value)) throw new Error(`${name} muss eine ganze Zahl sein, bekommen: ${value}.`);
}

function checkRadius(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > MAX_EXTENT / 2) {
    throw new Error(`${name} muss eine Zahl von 0 bis ${MAX_EXTENT / 2} sein, bekommen: ${value}.`);
  }
}

function checkThickness(value) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`thickness muss eine ganze Zahl ≥ 1 sein, bekommen: ${value}.`);
}

function checkHeight(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_EXTENT) {
    throw new Error(`height muss eine ganze Zahl ≥ 1 sein, bekommen: ${value}.`);
  }
}

// Ganzzahlige x mit inside(x − c), symmetrisch um c. approx = Näherung der halben Breite.
function predicateSpan(c, approx, inside) {
  let x1 = Math.floor(c + (approx > 0 ? approx : 0));
  while (inside(x1 + 1 - c)) x1++;
  while (x1 >= c && !inside(x1 - c)) x1--;
  if (x1 < c) return null;
  return [2 * c - x1, x1];
}

export function symmetricSpan(c, limitSq) {
  if (!(limitSq >= 0)) return null;
  return predicateSpan(c, Math.sqrt(limitSq), (d) => d * d <= limitSq);
}

function neighborRow(shape, y, z, open) {
  if (y < shape.y0) return open.bottom ? FULL_ROW : null;
  if (y > shape.y1) return open.top ? FULL_ROW : null;
  return shape.row(y, z);
}

// Bereich der Zeile, dessen Blöcke mehr als t Schritte vom Außenraum entfernt sind (oder null).
function coreOfRow(shape, y, z, t, planar, open) {
  let lo = -Infinity;
  let hi = Infinity;
  const yReach = planar ? 0 : t;
  for (let a = -yReach; a <= yReach; a++) {
    const rest = t - Math.abs(a);
    for (let b = -rest; b <= rest; b++) {
      const k = rest - Math.abs(b);
      const row = planar ? shape.row(y, z + b) : neighborRow(shape, y + a, z + b, open);
      if (!row) return null;
      if (row[0] + k > lo) lo = row[0] + k;
      if (row[1] - k < hi) hi = row[1] - k;
      if (lo > hi) return null;
    }
  }
  return [lo, hi];
}

// shape: { y0, y1, zRange(y) → [z0, z1] | null, row(y, z) → [x0, x1] | null }
function emitRowShape(shape, { hollow = false, thickness = 1, planar = false, open = {} }, emit) {
  let count = 0;
  for (let y = shape.y0; y <= shape.y1; y++) {
    const zr = shape.zRange(y);
    if (!zr) continue;
    for (let z = zr[0]; z <= zr[1]; z++) {
      const row = shape.row(y, z);
      if (!row) continue;
      const core = hollow ? coreOfRow(shape, y, z, thickness, planar, open) : null;
      if (!core) {
        for (let x = row[0]; x <= row[1]; x++) emit(x, y, z);
        count += row[1] - row[0] + 1;
        continue;
      }
      for (let x = row[0]; x < core[0]; x++) emit(x, y, z);
      for (let x = core[1] + 1; x <= row[1]; x++) emit(x, y, z);
      count += core[0] - row[0] + row[1] - core[1];
    }
  }
  return count;
}

function discShape(cx, cz, radius, y0, y1) {
  const r2 = (radius + 0.5) ** 2;
  const zSpan = symmetricSpan(cz, r2);
  return {
    y0, y1,
    zRange: () => zSpan,
    row: (y, z) => symmetricSpan(cx, r2 - (z - cz) ** 2),
  };
}

export function disc(cx, y, cz, radius, { hollow = false, thickness = 1 } = {}, emit) {
  checkHalf(cx, 'cx'); checkHalf(cz, 'cz'); checkInteger(y, 'y'); checkRadius(radius, 'radius'); checkThickness(thickness);
  return emitRowShape(discShape(cx, cz, radius, y, y), { hollow, thickness, planar: true }, emit);
}

export function cylinder(cx, y, cz, radius, height, { hollow = false, thickness = 1 } = {}, emit) {
  checkHalf(cx, 'cx'); checkHalf(cz, 'cz'); checkInteger(y, 'y'); checkRadius(radius, 'radius'); checkHeight(height); checkThickness(thickness);
  return emitRowShape(discShape(cx, cz, radius, y, y + height - 1), { hollow, thickness, planar: true }, emit);
}

export function ellipse(cx, y, cz, rx, rz, { hollow = false, thickness = 1 } = {}, emit) {
  checkHalf(cx, 'cx'); checkHalf(cz, 'cz'); checkInteger(y, 'y'); checkRadius(rx, 'rx'); checkRadius(rz, 'rz'); checkThickness(thickness);
  const ax2 = (rx + 0.5) ** 2;
  const az2 = (rz + 0.5) ** 2;
  const limit = ax2 * az2;
  const zSpan = symmetricSpan(cz, az2);
  const shape = {
    y0: y, y1: y,
    zRange: () => zSpan,
    row: (_y, z) => {
      const dz2 = (z - cz) ** 2;
      if (dz2 > az2) return null;
      const approx = Math.sqrt(ax2 * Math.max(0, 1 - dz2 / az2));
      return predicateSpan(cx, approx, (d) => d * d * az2 + dz2 * ax2 <= limit);
    },
  };
  return emitRowShape(shape, { hollow, thickness, planar: true }, emit);
}

export function sphere(cx, cy, cz, radius, { hollow = false, thickness = 1, part = 'full' } = {}, emit) {
  checkHalf(cx, 'cx'); checkHalf(cy, 'cy'); checkHalf(cz, 'cz'); checkRadius(radius, 'radius'); checkThickness(thickness);
  if (!['full', 'top', 'bottom'].includes(part)) throw new Error(`part muss 'full', 'top' oder 'bottom' sein, bekommen: ${part}.`);
  const r2 = (radius + 0.5) ** 2;
  const ySpan = symmetricSpan(cy, r2);
  if (!ySpan) return 0;
  // Halbkugel: Ebenen y ≥ cy (top) bzw. y ≤ cy (bottom); bei ganzzahligem cy gehört der Äquator zu beiden.
  const y0 = part === 'top' ? Math.max(ySpan[0], Math.ceil(cy)) : ySpan[0];
  const y1 = part === 'bottom' ? Math.min(ySpan[1], Math.floor(cy)) : ySpan[1];
  const shape = {
    y0, y1,
    zRange: (y) => symmetricSpan(cz, r2 - (y - cy) ** 2),
    row: (y, z) => symmetricSpan(cx, r2 - (y - cy) ** 2 - (z - cz) ** 2),
  };
  const open = { bottom: part === 'top', top: part === 'bottom' };
  return emitRowShape(shape, { hollow, thickness, planar: false, open }, emit);
}

export function cone(cx, y, cz, rBottom, rTop, height, { hollow = false, thickness = 1 } = {}, emit) {
  checkHalf(cx, 'cx'); checkHalf(cz, 'cz'); checkInteger(y, 'y'); checkRadius(rBottom, 'rBottom'); checkRadius(rTop, 'rTop');
  checkHeight(height); checkThickness(thickness);
  const radiusAt = (layer) => (height === 1 ? rBottom : rBottom + ((rTop - rBottom) * (layer - y)) / (height - 1));
  const shape = {
    y0: y, y1: y + height - 1,
    zRange: (layer) => symmetricSpan(cz, (radiusAt(layer) + 0.5) ** 2),
    row: (layer, z) => symmetricSpan(cx, (radiusAt(layer) + 0.5) ** 2 - (z - cz) ** 2),
  };
  return emitRowShape(shape, { hollow, thickness, planar: false, open: { bottom: true, top: true } }, emit);
}

// --- Polygone (gerade-ungerade-Regel, Rand gehört dazu) ---

function checkPoints(points) {
  if (!Array.isArray(points) || points.length < 3) throw new Error('polygon braucht mindestens 3 Punkte [[x, z], …].');
  for (const p of points) {
    if (!Array.isArray(p) || p.length !== 2) throw new Error('Jeder Polygonpunkt muss [x, z] sein.');
    checkHalf(p[0], 'Polygon-x');
    checkHalf(p[1], 'Polygon-z');
  }
}

// Rastert das Polygon in ein Gitter: { minX, minZ, width, depth, cells: Uint8Array } (1 = innen).
export function rasterizePolygon(points) {
  checkPoints(points);
  const scaled = points.map(([x, z]) => [Math.round(x * 2), Math.round(z * 2)]);
  const xs = scaled.map((p) => p[0]);
  const zs = scaled.map((p) => p[1]);
  const minX = Math.ceil(Math.min(...xs) / 2);
  const maxX = Math.floor(Math.max(...xs) / 2);
  const minZ = Math.ceil(Math.min(...zs) / 2);
  const maxZ = Math.floor(Math.max(...zs) / 2);
  const width = Math.max(0, maxX - minX + 1);
  const depth = Math.max(0, maxZ - minZ + 1);
  if (width > MAX_EXTENT || depth > MAX_EXTENT) throw new Error('Polygon ist zu groß.');
  const cells = new Uint8Array(width * depth);
  const edges = scaled.map((p, i) => [p, scaled[(i + 1) % scaled.length]]);
  for (let z = minZ; z <= maxZ; z++) {
    const Z = 2 * z;
    const rowBase = (z - minZ) * width;
    const crossings = [];
    for (const [[x1, z1], [x2, z2]] of edges) {
      if ((z1 > Z) !== (z2 > Z)) crossings.push(x1 + ((Z - z1) * (x2 - x1)) / (z2 - z1));
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(minX, Math.floor(crossings[i] / 2) + 1);
      const to = Math.min(maxX, Math.ceil(crossings[i + 1] / 2) - 1);
      for (let x = from; x <= to; x++) cells[rowBase + x - minX] = 1;
    }
    markBoundary(edges, Z, z, minX, maxX, rowBase, cells);
  }
  return { minX, minZ, width, depth, cells };
}

// Blöcke, deren Mittelpunkt genau auf einer Kante liegt (exakt in ganzen Zahlen gerechnet).
function markBoundary(edges, Z, z, minX, maxX, rowBase, cells) {
  for (const [[x1, z1], [x2, z2]] of edges) {
    if (Z < Math.min(z1, z2) || Z > Math.max(z1, z2)) continue;
    if (z1 === z2) {
      const from = Math.max(minX, Math.ceil(Math.min(x1, x2) / 2));
      const to = Math.min(maxX, Math.floor(Math.max(x1, x2) / 2));
      for (let x = from; x <= to; x++) cells[rowBase + x - minX] = 1;
      continue;
    }
    const numerator = x1 * (z2 - z1) + (Z - z1) * (x2 - x1);
    const denominator = 2 * (z2 - z1);
    if (numerator % denominator === 0) {
      const x = numerator / denominator;
      if (x >= minX && x <= maxX) cells[rowBase + x - minX] = 1;
    }
  }
}

// Hülle im Gitter: Zellen mit höchstens t Schritten (4-Nachbarschaft) bis nach außen.
export function shellOfGrid(grid, thickness) {
  const { width, depth, cells } = grid;
  const dist = new Uint16Array(cells.length);
  const queue = new Int32Array(cells.length);
  let head = 0;
  let tail = 0;
  const isOutside = (x, z) => x < 0 || z < 0 || x >= width || z >= depth || cells[z * width + x] === 0;
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const i = z * width + x;
      if (!cells[i]) continue;
      if (isOutside(x - 1, z) || isOutside(x + 1, z) || isOutside(x, z - 1) || isOutside(x, z + 1)) {
        dist[i] = 1;
        queue[tail++] = i;
      }
    }
  }
  while (head < tail) {
    const i = queue[head++];
    if (dist[i] >= thickness) continue;
    const x = i % width;
    const z = (i - x) / width;
    for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
      const j = nz * width + nx;
      if (cells[j] && dist[j] === 0) {
        dist[j] = dist[i] + 1;
        queue[tail++] = j;
      }
    }
  }
  const shell = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) if (dist[i] > 0) shell[i] = 1;
  return { ...grid, cells: shell };
}

function emitGrid(grid, y, emit) {
  let count = 0;
  for (let z = 0; z < grid.depth; z++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.cells[z * grid.width + x]) {
        emit(grid.minX + x, y, grid.minZ + z);
        count++;
      }
    }
  }
  return count;
}

export function polygon(points, y, { hollow = false, thickness = 1 } = {}, emit) {
  checkInteger(y, 'y');
  checkThickness(thickness);
  const grid = rasterizePolygon(points);
  return emitGrid(hollow ? shellOfGrid(grid, thickness) : grid, y, emit);
}

export function prism(points, y1, y2, { hollow = false, thickness = 1 } = {}, emit) {
  checkInteger(y1, 'y1');
  checkInteger(y2, 'y2');
  checkThickness(thickness);
  const raw = rasterizePolygon(points);
  const grid = hollow ? shellOfGrid(raw, thickness) : raw;
  let count = 0;
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) count += emitGrid(grid, y, emit);
  return count;
}

// --- Quader, Wände, Linien ---

export function box(x1, y1, z1, x2, y2, z2, mode, emit) {
  const [ax, bx] = x1 <= x2 ? [x1, x2] : [x2, x1];
  const [ay, by] = y1 <= y2 ? [y1, y2] : [y2, y1];
  const [az, bz] = z1 <= z2 ? [z1, z2] : [z2, z1];
  let count = 0;
  for (let y = ay; y <= by; y++) {
    const yEdge = y === ay || y === by;
    for (let z = az; z <= bz; z++) {
      const zEdge = z === az || z === bz;
      for (let x = ax; x <= bx; x++) {
        const xEdge = x === ax || x === bx;
        const edges = (xEdge ? 1 : 0) + (yEdge ? 1 : 0) + (zEdge ? 1 : 0);
        if (mode === 'hollow' && edges === 0) continue;
        if (mode === 'outline' && edges < 2) continue;
        if (mode === 'walls' && !xEdge && !zEdge) continue;
        emit(x, y, z);
        count++;
      }
    }
  }
  return count;
}

// 3D-Linie: entlang der längsten Achse ein Block pro Schritt, Rundung exakt (ganzzahlig, halb nach oben).
export function line(x1, y1, z1, x2, y2, z2, emit) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1));
  if (n === 0) {
    emit(x1, y1, z1);
    return 1;
  }
  const at = (a, b, i) => Math.floor((2 * (a * n + (b - a) * i) + n) / (2 * n));
  for (let i = 0; i <= n; i++) emit(at(x1, x2, i), at(y1, y2, i), at(z1, z2, i));
  return n + 1;
}
