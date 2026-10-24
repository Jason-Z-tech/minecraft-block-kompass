// Dreiecke → Voxel (ARCHITEKTUR §12.3). Oberfläche: jede Zelle, deren Würfel ein Dreieck berührt
// (Trennachsen-Test nach Akenine-Möller, je Dreieck nur die Spalten unter seiner Ebene) – dadurch ohne Löcher.
// Inneres (solid): Strahlen durch die Zellmitten entlang x, y und z zählen Schnittpunkte (Parität); jede Achse
// stimmt ab, Strahlen mit ungerader Zahl (undichtes Netz) enthalten sich, innen = Mehrheit der gültigen Stimmen.
// Farbe je Oberflächen-Voxel: nächstgelegener Punkt der berührenden Dreiecke (Material, Eckfarbe, Textur).

import { LIMITS, ModelError, formatCount } from './mesh.js';
import { SRGB_TO_LINEAR, linearToSrgb8 } from './colors.js';

// Abstand der Modellränder zu den Zellgrenzen (in Blöcken), damit Flächen nicht genau auf Zellgrenzen liegen
const MARGIN = 1 / 256;
// Versatz der Strahlen gegen Treffer genau auf Kanten und Ecken
const RAY_JITTER = Object.freeze([0.000123, 0.000071]);

/** Hochachse: 'y' | 'z'. 'auto' nimmt die übliche Achse des Formats (STL und .vox: z, OBJ und glTF: y). */
export function resolveUpAxis(upAxis, formatUp) {
  if (upAxis === 'y' || upAxis === 'z') return upAxis;
  if (upAxis === 'auto' || upAxis === undefined || upAxis === null) return formatUp === 'z' ? 'z' : 'y';
  throw new ModelError(`Unbekannte Hochachse „${String(upAxis).slice(0, 20)}“ – erlaubt: auto, y, z.`, { code: 'params' });
}

function suggestHeight(height, cells, limit) {
  return Math.max(1, Math.floor(height * Math.cbrt(limit / cells)));
}

/**
 * Richtet die Positionen aus (z oben → Minecraft (x, z, −y), rechtshändig) und skaliert sie in Zellkoordinaten:
 * Höhe = height Blöcke, Seitenverhältnis bleibt. Verändert positions (Float32Array) direkt.
 * Rückgabe { size: [w, h, l], scale, flat }.
 */
export function fitToGrid(positions, { height, up }) {
  const n = positions.length / 3;
  if (up === 'z') {
    for (let i = 0; i < n; i++) {
      const y = positions[i * 3 + 1];
      positions[i * 3 + 1] = positions[i * 3 + 2];
      positions[i * 3 + 2] = -y;
    }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      const v = positions[i * 3 + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const largest = Math.max(...extent);
  if (!(largest > 0) || !Number.isFinite(largest)) throw new ModelError('Das Modell hat keine Ausdehnung (alle Punkte liegen aufeinander).');
  // Flaches Modell (keine Höhe): dann bestimmt die größte Seite den Maßstab
  const flat = extent[1] <= largest * 1e-9;
  const scale = flat ? height / largest : height / extent[1];
  const size = extent.map((e) => Math.max(1, Math.ceil(e * scale - 1e-6)));
  if (!flat) size[1] = height;
  if (size.some((s) => s > LIMITS.edge)) {
    throw new ModelError(`Das Ergebnis wäre ${size.join(' × ')} Blöcke groß – höchstens ${LIMITS.edge} je Seite. Wähle eine kleinere Höhe.`, { code: 'limit' });
  }
  const cells = size[0] * size[1] * size[2];
  if (cells > LIMITS.cells) {
    throw new ModelError(`Das Raster wäre ${size.join(' × ')} Blöcke groß – zu viel Speicher. Wähle höchstens Höhe ${suggestHeight(height, cells, LIMITS.cells)}.`, { code: 'limit' });
  }
  // Mittig einpassen mit kleinem Rand: Modellrand bei MARGIN bzw. size − MARGIN, nie genau auf einer Zellgrenze
  const offset = [0, 0, 0], factor = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    const span = extent[a] * scale;
    const usable = Math.min(span, size[a] - 2 * MARGIN);
    factor[a] = extent[a] > 0 ? (usable / extent[a]) : 0;
    offset[a] = size[a] / 2 - usable / 2;
  }
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) positions[i * 3 + a] = offset[a] + (positions[i * 3 + a] - min[a]) * factor[a];
  }
  return { size, scale, flat };
}

// ------------------------------------------------------------------ Zellen-Tabelle (offene Adressierung)

class SurfaceTable {
  constructor(capacity = 1 << 16) {
    this.alloc(capacity);
    this.size = 0;
  }

  alloc(capacity) {
    this.mask = capacity - 1;
    this.keys = new Uint32Array(capacity);
    this.tri = new Uint32Array(capacity);
    this.dist = new Float32Array(capacity);
    this.u = new Float32Array(capacity);
    this.v = new Float32Array(capacity);
  }

  grow() {
    const { keys, tri, dist, u, v } = this;
    this.alloc(keys.length * 2);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === 0) continue;
      let slot = this.slotOf(keys[i]);
      while (this.keys[slot] !== 0) slot = (slot + 1) & this.mask;
      this.keys[slot] = keys[i];
      this.tri[slot] = tri[i];
      this.dist[slot] = dist[i];
      this.u[slot] = u[i];
      this.v[slot] = v[i];
    }
  }

  slotOf(key) {
    return (Math.imul(key, 0x9e3779b1) >>> 0) & this.mask;
  }

  // Zelle mit Dreieck t vormerken; bei mehreren gewinnt das nächstgelegene.
  offer(cell, t, d, u, v) {
    const key = cell + 1;
    let slot = this.slotOf(key);
    while (true) {
      const k = this.keys[slot];
      if (k === key) {
        if (d < this.dist[slot]) {
          this.tri[slot] = t;
          this.dist[slot] = d;
          this.u[slot] = u;
          this.v[slot] = v;
        }
        return;
      }
      if (k === 0) break;
      slot = (slot + 1) & this.mask;
    }
    this.keys[slot] = key;
    this.tri[slot] = t;
    this.dist[slot] = d;
    this.u[slot] = u;
    this.v[slot] = v;
    this.size++;
    if (this.size > LIMITS.blocks) {
      throw new ModelError(`Schon die Oberfläche hätte mehr als ${formatCount(LIMITS.blocks)} Blöcke – wähle eine kleinere Höhe.`, { code: 'limit' });
    }
    if (this.size * 2 > this.keys.length) this.grow();
  }
}

// ------------------------------------------------------------------ Geometrie

// Trennachsen-Test Dreieck (Ecken relativ zur Würfelmitte) gegen Würfel mit halber Kantenlänge h.
function triangleBoxOverlap(v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, nx, ny, nz, h) {
  // Ausdehnung entlang x, y, z
  if (Math.min(v0x, v1x, v2x) > h || Math.max(v0x, v1x, v2x) < -h) return false;
  if (Math.min(v0y, v1y, v2y) > h || Math.max(v0y, v1y, v2y) < -h) return false;
  if (Math.min(v0z, v1z, v2z) > h || Math.max(v0z, v1z, v2z) < -h) return false;
  // Ebene des Dreiecks
  if (Math.abs(nx * v0x + ny * v0y + nz * v0z) > h * (Math.abs(nx) + Math.abs(ny) + Math.abs(nz))) return false;
  // 9 Kreuzprodukt-Achsen (Kante × Koordinatenachse)
  return !edgeSeparates(v1x - v0x, v1y - v0y, v1z - v0z, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, h)
    && !edgeSeparates(v2x - v1x, v2y - v1y, v2z - v1z, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, h)
    && !edgeSeparates(v0x - v2x, v0y - v2y, v0z - v2z, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, h);
}

// Trennt eine der Achsen (x, y, z) × Kante das Dreieck vom Würfel?
function edgeSeparates(ex, ey, ez, v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z, h) {
  const fx = Math.abs(ex), fy = Math.abs(ey), fz = Math.abs(ez);
  // Achse x × e = (0, −ez, ey)
  let p0 = -ez * v0y + ey * v0z, p1 = -ez * v1y + ey * v1z, p2 = -ez * v2y + ey * v2z;
  let r = h * (fz + fy);
  if (Math.min(p0, p1, p2) > r || Math.max(p0, p1, p2) < -r) return true;
  // Achse y × e = (ez, 0, −ex)
  p0 = ez * v0x - ex * v0z; p1 = ez * v1x - ex * v1z; p2 = ez * v2x - ex * v2z;
  r = h * (fz + fx);
  if (Math.min(p0, p1, p2) > r || Math.max(p0, p1, p2) < -r) return true;
  // Achse z × e = (−ey, ex, 0)
  p0 = -ey * v0x + ex * v0y; p1 = -ey * v1x + ex * v1y; p2 = -ey * v2x + ex * v2y;
  r = h * (fy + fx);
  return Math.min(p0, p1, p2) > r || Math.max(p0, p1, p2) < -r;
}

const closest = { v: 0, w: 0, d: 0 };

// Nächster Punkt des Dreiecks a, b, c zu p (Ericson, Real-Time Collision Detection 5.1.5):
// closest.v/w = Anteile von b und c, closest.d = Abstand².
function closestPointOnTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  let v, w;
  if (d1 <= 0 && d2 <= 0) {
    v = 0; w = 0;
  } else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) {
      v = 1; w = 0;
    } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        v = d1 / (d1 - d3); w = 0;
      } else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
        const d5 = abx * cpx + aby * cpy + abz * cpz;
        const d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) {
          v = 0; w = 1;
        } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            v = 0; w = d2 / (d2 - d6);
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); v = 1 - w;
            } else {
              const denom = 1 / (va + vb + vc);
              v = vb * denom; w = vc * denom;
            }
          }
        }
      }
    }
  }
  const qx = ax + abx * v + acx * w - px, qy = ay + aby * v + acy * w - py, qz = az + abz * v + acz * w - pz;
  closest.v = v;
  closest.w = w;
  closest.d = qx * qx + qy * qy + qz * qz;
}

// ------------------------------------------------------------------ Oberfläche

/** Markiert alle Zellen, deren Würfel ein Dreieck berührt. positions in Zellkoordinaten. */
export function rasterizeSurface(positions, size) {
  const [w, h, l] = size;
  const table = new SurfaceTable();
  const n = positions.length / 9;
  const dims = size;
  const lo = [0, 0, 0], hi = [0, 0, 0];
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len2 = nx * nx + ny * ny + nz * nz;
    if (!(len2 > 1e-24)) continue;
    const p = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]];
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.max(0, Math.floor(Math.min(p[0][a], p[1][a], p[2][a]) - 1e-7));
      hi[a] = Math.min(dims[a] - 1, Math.floor(Math.max(p[0][a], p[1][a], p[2][a]) + 1e-7));
    }
    if (lo[0] > hi[0] || lo[1] > hi[1] || lo[2] > hi[2]) continue;
    // Spalten entlang der Achse, auf der die Normale am größten ist
    const an = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
    const k = an[0] >= an[1] && an[0] >= an[2] ? 0 : an[1] >= an[2] ? 1 : 2;
    const i = (k + 1) % 3, j = (k + 2) % 3;
    const nArr = [nx, ny, nz];
    const nk = nArr[k], ni = nArr[i], nj = nArr[j];
    const dot = nx * ax + ny * ay + nz * az;
    const zMinT = Math.min(p[0][k], p[1][k], p[2][k]), zMaxT = Math.max(p[0][k], p[1][k], p[2][k]);
    const coord = [0, 0, 0];
    for (let ci = lo[i]; ci <= hi[i]; ci++) {
      for (let cj = lo[j]; cj <= hi[j]; cj++) {
        // Bereich der Ebene über dem Quadrat [ci, ci+1] × [cj, cj+1]
        const base = (dot - ni * ci - nj * cj) / nk;
        const di = -ni / nk, dj = -nj / nk;
        const z00 = base, z10 = base + di, z01 = base + dj, z11 = base + di + dj;
        const zLo = Math.max(zMinT, Math.min(z00, z10, z01, z11));
        const zHi = Math.min(zMaxT, Math.max(z00, z10, z01, z11));
        if (zLo > zHi + 1e-7) continue;
        const kStart = Math.max(lo[k], Math.floor(zLo - 1e-7));
        const kEnd = Math.min(hi[k], Math.floor(zHi + 1e-7));
        for (let ck = kStart; ck <= kEnd; ck++) {
          coord[i] = ci;
          coord[j] = cj;
          coord[k] = ck;
          const mx = coord[0] + 0.5, my = coord[1] + 0.5, mz = coord[2] + 0.5;
          if (!triangleBoxOverlap(ax - mx, ay - my, az - mz, bx - mx, by - my, bz - mz, cx - mx, cy - my, cz - mz, nx, ny, nz, 0.5)) continue;
          closestPointOnTriangle(mx, my, mz, ax, ay, az, bx, by, bz, cx, cy, cz);
          table.offer((coord[1] * l + coord[2]) * w + coord[0], t, closest.d, closest.v, closest.w);
        }
      }
    }
  }
  return table;
}

// ------------------------------------------------------------------ Inneres (Parität mit Mehrheitsentscheid)

/**
 * Stimmen je Zelle: Bits 0–2 = „innen“ laut Strahl entlang x/y/z; dazu je Achse, ob der Strahl gültig war.
 * Rückgabe { votes: Uint8Array(Zellen), valid: [Uint8Array je Achse] }.
 */
export function insideVotes(positions, size) {
  const [w, h, l] = size;
  const cells = w * h * l;
  const votes = new Uint8Array(cells);
  const valid = [];
  const n = positions.length / 9;
  // Zellindex (y·l + z)·w + x → Schrittweiten je Achse
  const stride = [1, w * l, w];
  for (let A = 0; A < 3; A++) {
    const B = (A + 1) % 3, C = (A + 2) % 3;
    const nB = size[B], nC = size[C];
    const rays = nB * nC;
    const jB = RAY_JITTER[0], jC = RAY_JITTER[1];
    let hitRay = new Uint32Array(1024);
    let hitT = new Float64Array(1024);
    let hits = 0;
    for (let t = 0; t < n; t++) {
      const o = t * 9;
      const b0 = positions[o + B], c0 = positions[o + C], a0 = positions[o + A];
      const b1 = positions[o + 3 + B], c1 = positions[o + 3 + C], a1 = positions[o + 3 + A];
      const b2 = positions[o + 6 + B], c2 = positions[o + 6 + C], a2 = positions[o + 6 + A];
      const area = (b1 - b0) * (c2 - c0) - (b2 - b0) * (c1 - c0);
      if (Math.abs(area) < 1e-12) continue;
      const bStart = Math.max(0, Math.ceil(Math.min(b0, b1, b2) - 0.5 - jB));
      const bEnd = Math.min(nB - 1, Math.floor(Math.max(b0, b1, b2) - 0.5 - jB));
      const cStart = Math.max(0, Math.ceil(Math.min(c0, c1, c2) - 0.5 - jC));
      const cEnd = Math.min(nC - 1, Math.floor(Math.max(c0, c1, c2) - 0.5 - jC));
      for (let cc = cStart; cc <= cEnd; cc++) {
        const qc = cc + 0.5 + jC;
        for (let bb = bStart; bb <= bEnd; bb++) {
          const qb = bb + 0.5 + jB;
          const l0 = ((b1 - qb) * (c2 - qc) - (b2 - qb) * (c1 - qc)) / area;
          const l1 = ((b2 - qb) * (c0 - qc) - (b0 - qb) * (c2 - qc)) / area;
          const l2 = 1 - l0 - l1;
          if (l0 < 0 || l1 < 0 || l2 < 0) continue;
          if (hits === hitRay.length) {
            const r2 = new Uint32Array(hits * 2); r2.set(hitRay); hitRay = r2;
            const t2 = new Float64Array(hits * 2); t2.set(hitT); hitT = t2;
          }
          hitRay[hits] = cc * nB + bb;
          hitT[hits] = l0 * a0 + l1 * a1 + l2 * a2;
          hits++;
        }
      }
    }
    // Nach Strahl sortieren (Zählsortierung), dann je Strahl nach Lage
    const start = new Uint32Array(rays + 1);
    for (let i = 0; i < hits; i++) start[hitRay[i] + 1]++;
    for (let r = 0; r < rays; r++) start[r + 1] += start[r];
    const fill = start.slice(0, rays);
    const sorted = new Float64Array(hits);
    for (let i = 0; i < hits; i++) sorted[fill[hitRay[i]]++] = hitT[i];
    const axisValid = new Uint8Array(rays);
    const bit = 1 << A;
    const runLength = size[A];
    const sA = stride[A];
    for (let r = 0; r < rays; r++) {
      const s = start[r], e = start[r + 1];
      if ((e - s) % 2 !== 0) continue;
      axisValid[r] = 1;
      if (e === s) continue;
      const segment = sorted.subarray(s, e).sort();
      const base = (r % nB) * stride[B] + Math.floor(r / nB) * stride[C];
      for (let k = 0; k < segment.length; k += 2) {
        const from = Math.max(0, Math.ceil(segment[k] - 0.5));
        const to = Math.min(runLength - 1, Math.floor(segment[k + 1] - 0.5));
        for (let a = from; a <= to; a++) votes[base + a * sA] |= bit;
      }
    }
    valid.push(axisValid);
  }
  return { votes, valid };
}

/** Ist Zelle (x, y, z) laut Mehrheit innen? (Gleichstand oder keine gültige Stimme → außen) */
export function isInside(votes, valid, size, x, y, z) {
  const [w, h, l] = size;
  const v = votes[(y * l + z) * w + x];
  // Strahl entlang x: B = y, C = z → Index z·h + y; entlang y: B = z, C = x → x·l + z; entlang z: B = x, C = y → y·w + x
  const vx = valid[0][z * h + y], vy = valid[1][x * l + z], vz = valid[2][y * w + x];
  const count = vx + vy + vz;
  if (count === 0) return false;
  const inside = (vx & v) + (vy & (v >> 1)) + (vz & (v >> 2));
  return inside * 2 > count;
}

// ------------------------------------------------------------------ Farben

function wrapCoord(x, size, mode) {
  if (mode === 'clamp') return x < 0 ? 0 : x >= size ? size - 1 : x;
  if (mode === 'mirror') {
    const period = size * 2;
    const m = ((x % period) + period) % period;
    return m < size ? m : period - 1 - m;
  }
  return ((x % size) + size) % size;
}

const linear = [0, 0, 0];

// Lineare Farbe des Punkts (Anteile v, w von Ecke 1 und 2) auf Dreieck t → linear[0..2]
function surfaceColor(mesh, t, v, w) {
  const material = mesh.materials[mesh.triMaterial[t]] ?? mesh.materials[0];
  let r = material.color[0], g = material.color[1], b = material.color[2];
  const u0 = 1 - v - w;
  if (mesh.colors) {
    const c = mesh.colors, o = t * 9;
    r *= u0 * c[o] + v * c[o + 3] + w * c[o + 6];
    g *= u0 * c[o + 1] + v * c[o + 4] + w * c[o + 7];
    b *= u0 * c[o + 2] + v * c[o + 5] + w * c[o + 8];
  }
  const texture = material.texture;
  if (texture && mesh.uvs) {
    const uv = mesh.uvs, o = t * 6;
    const tu = u0 * uv[o] + v * uv[o + 2] + w * uv[o + 4];
    const tv = u0 * uv[o + 1] + v * uv[o + 3] + w * uv[o + 5];
    const x = wrapCoord(Math.floor(tu * texture.width), texture.width, texture.wrapS);
    const y = wrapCoord(Math.floor(tv * texture.height), texture.height, texture.wrapT);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const p = (y * texture.width + x) * 4;
      r *= SRGB_TO_LINEAR[texture.data[p]];
      g *= SRGB_TO_LINEAR[texture.data[p + 1]];
      b *= SRGB_TO_LINEAR[texture.data[p + 2]];
    }
  }
  linear[0] = r;
  linear[1] = g;
  linear[2] = b;
}

// Seite für den Farbabgleich aus der Dreiecksnormale: 0 oben, 1 seitlich, 2 unten
function faceOfTriangle(positions, t) {
  const o = t * 9;
  const e1x = positions[o + 3] - positions[o], e1y = positions[o + 4] - positions[o + 1], e1z = positions[o + 5] - positions[o + 2];
  const e2x = positions[o + 6] - positions[o], e2y = positions[o + 7] - positions[o + 1], e2z = positions[o + 8] - positions[o + 2];
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz)) return ny >= 0 ? 0 : 2;
  return 1;
}

// ------------------------------------------------------------------ Gesamtablauf

/**
 * Mesh → dichtes Raster. matcher = createColorMatcher(…) aus colors.js.
 * Rückgabe { size, data: Uint16Array (0 = Luft, sonst Kandidat + 1), surface, filled, flat }.
 * Verändert mesh.positions (Zellkoordinaten).
 */
export function voxelizeMesh(mesh, { height, solid = false, upAxis = 'auto', matcher }) {
  const up = resolveUpAxis(upAxis, mesh.upAxis);
  const { size, flat } = fitToGrid(mesh.positions, { height, up });
  const [w, h, l] = size;
  const table = rasterizeSurface(mesh.positions, size);
  if (table.size === 0) throw new ModelError('Das Modell ergibt keine Blöcke (keine Flächen mit Fläche > 0).');
  const data = new Uint16Array(w * h * l);
  const single = matcher.candidates.length === 1;
  for (let slot = 0; slot < table.keys.length; slot++) {
    const key = table.keys[slot];
    if (key === 0) continue;
    const t = table.tri[slot];
    let index = 0;
    if (!single) {
      surfaceColor(mesh, t, table.u[slot], table.v[slot]);
      index = matcher.match(linearToSrgb8(linear[0]), linearToSrgb8(linear[1]), linearToSrgb8(linear[2]), faceOfTriangle(mesh.positions, t));
    }
    data[key - 1] = index + 1;
  }
  let filled = 0;
  if (solid) {
    const { votes, valid } = insideVotes(mesh.positions, size);
    filled = fillInterior(data, size, (x, y, z) => isInside(votes, valid, size, x, y, z));
    if (table.size + filled > LIMITS.blocks) {
      throw new ModelError(`Gefüllt wären es ${formatCount(table.size + filled)} Blöcke – höchstens ${formatCount(LIMITS.blocks)}. Wähle eine kleinere Höhe oder baue hohl.`, { code: 'limit' });
    }
  }
  return { size, data, surface: table.size, filled, flat };
}

/**
 * Füllt innere Zellen (inside(x, y, z) = true, noch leer) mit dem Block des nächsten Oberflächen-Voxels in derselben
 * x-Reihe (sonst dem häufigsten). Rückgabe: Zahl der gefüllten Zellen.
 */
export function fillInterior(data, size, inside) {
  const [w, h, l] = size;
  const counts = new Map();
  for (let i = 0; i < data.length; i++) if (data[i]) counts.set(data[i], (counts.get(data[i]) ?? 0) + 1);
  let common = 0, best = -1;
  for (const [value, count] of counts) if (count > best) { best = count; common = value; }
  let filled = 0;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      const row = (y * l + z) * w;
      let last = 0;
      for (let x = 0; x < w; x++) {
        const value = data[row + x];
        if (value) {
          last = value;
          continue;
        }
        if (!inside(x, y, z)) continue;
        let fillValue = last;
        if (!fillValue) {
          for (let k = x + 1; k < w; k++) if (data[row + k]) { fillValue = data[row + k]; break; }
          if (!fillValue) fillValue = common;
        }
        data[row + x] = fillValue;
        last = fillValue;
        filled++;
      }
    }
  }
  return filled;
}
