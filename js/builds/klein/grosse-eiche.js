// Große Eiche – eigener Solitärbaum: dicker Stamm mit Wurzelanlauf, sechs weit ausladende Äste mit Gabelungen,
// Krone aus Laubwolken je Ast, Schaukel und Laterne an den unteren Ästen. Der Stamm steht bei (0, y0, 0),
// die Schaukel hängt im Süden.

import { terrain, vegetation } from '../lib/natur.js';
import { hangingLantern } from '../lib/bauteile.js';
import { createRandom, hashPosition } from '../../core/random.js';

export const meta = {
  id: 'grosse-eiche',
  title: 'Große Eiche',
  category: 'klein',
  subtitle: 'Mächtiger Solitärbaum mit Wurzeln, weiten Ästen und Schaukel',
  tags: ['Baum', 'Eiche', 'Natur', 'Garten', 'Deko', 'Schaukel', 'Landschaft', 'Dorfmittelpunkt', 'Eigener Baum'],
  aliases: [
    'große eiche', 'grosse eiche', 'grose eiche', 'eiche', 'eichenbaum', 'alte eiche', 'großer baum', 'grosser baum',
    'riesenbaum', 'dorfeiche', 'dorfbaum', 'schaukelbaum', 'baum mit schaukel', 'eigener baum', 'custom baum',
    'big oak', 'big oak tree', 'large oak', 'large oak tree', 'giant oak', 'custom oak', 'custom tree', 'oak tree', 'tree swing',
  ],
  accuracy: 'eigenes',
  description: 'Eine alte, frei stehende Eiche als Blickfang für Dorfplatz, Garten oder Wiese. Der Stamm ist unten fünf Blöcke breit und läuft nach oben schlank aus, sieben Wurzeln greifen über den kleinen Hügel und tauchen in den Boden. Sechs lange Äste mit Gabelungen tragen eine breite, lockere Krone aus Eichen- und Schwarzeichenlaub. Am tiefen Südast hängt eine Schaukel, am Nordast eine Laterne.',
  sources: [],
  credits: null,
  tested: null,
};

const SEED = 'grosse-eiche';
const GROUND_R = 14;
const LOG = 'oak_log[axis=y]';
const LEAF = 'oak_leaves[persistent=true]';
const LEAF_DARK = 'dark_oak_leaves[persistent=true]';
const AXES = ['x', 'y', 'z'];
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Stammradius je Ebene ab dem Fuß (mit leichtem Rauschen ausgefranst): 5 breit unten, oben ein einzelner Stamm.
const TRUNK_RADIUS = [2.75, 2.3, 1.9, 1.75, 1.7, 1.62, 1.55, 1.5, 1.42, 1.35, 1.25, 1.15, 1.0, 0.75];

const key = (x, y, z) => `${x},${y},${z}`;
const unkey = (k) => k.split(',').map(Number);
const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Wertrauschen 0 … 1 (dreilinear), für ausgefranste Ränder und Laubflecken.
function noise3(x, y, z, scale, salt) {
  const fx = x / scale;
  const fy = y / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const z0 = Math.floor(fz);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const tz = smooth(fz - z0);
  let v = 0;
  for (const [dx, wx] of [[0, 1 - tx], [1, tx]]) {
    for (const [dy, wy] of [[0, 1 - ty], [1, ty]]) {
      for (const [dz, wz] of [[0, 1 - tz], [1, tz]]) v += wx * wy * wz * rand01(x0 + dx, y0 + dy, z0 + dz, salt);
    }
  }
  return v;
}

function bezier(p0, p1, p2, t) {
  return [0, 1, 2].map((k) => (1 - t) * (1 - t) * p0[k] + 2 * (1 - t) * t * p1[k] + t * t * p2[k]);
}

function samplePolyline(parts, step = 0.25) {
  const pts = [];
  for (const part of parts) {
    if (part.length === 2) {
      const [a, c] = part;
      const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / step));
      for (let i = 0; i <= n; i++) pts.push(a.map((v, k) => v + ((c[k] - v) * i) / n));
    } else {
      const [a, m, c] = part;
      const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / step) * 2);
      for (let i = 0; i <= n; i++) pts.push(bezier(a, m, c, i / n));
    }
  }
  return pts;
}

// Flächig verbundene Zellen entlang der Punkte; axis = Richtung, in die der Ast an dieser Stelle wächst.
function pathCells(points) {
  let cur = points[0].map(Math.round);
  const cells = [[...cur, 'y']];
  for (const p of points.slice(1)) {
    const target = p.map(Math.round);
    for (let guard = 0; guard < 24; guard++) {
      const diff = target.map((v, k) => v - cur[k]);
      if (diff.every((v) => v === 0)) break;
      let k = 0;
      for (const c of [2, 1]) if (Math.abs(diff[c]) > Math.abs(diff[k])) k = c;
      cur = [...cur];
      cur[k] += Math.sign(diff[k]);
      cells.push([...cur, AXES[k]]);
    }
  }
  return cells;
}

function moundHeight(x, z) {
  const d = Math.hypot(x, z);
  if (d < 3.7) return 3;
  const n = (noise3(x, 0, z, 3, 11) - 0.5) * 1.6;
  if (d + n < 6.8) return 2;
  return 1;
}

// Der ausgefranste Rand des runden Geländes kann einzelne Säulen ohne seitlichen Anschluss erzeugen – die wirken wie
// abgebrochene Pfeiler neben der Wiese und kommen weg.
function trimLooseColumns(b, ground, r) {
  let removed = 0;
  for (let z = -r; z <= r; z++) {
    for (let x = -r; x <= r; x++) {
      const top = ground.top(x, z);
      if (top === null || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => ground.top(x + dx, z + dz) !== null)) continue;
      for (let y = 0; y <= top; y++) b.remove(x, y, z);
      removed++;
    }
  }
  return removed;
}

function planTrunk(y0) {
  const cells = new Map();
  TRUNK_RADIUS.forEach((r, k) => {
    const y = y0 + k;
    for (let z = -3; z <= 3; z++) {
      for (let x = -3; x <= 3; x++) {
        const d = Math.hypot(x, z) + (noise3(x, y, z, 1.7, 21) - 0.5) * 0.55;
        if (d <= r || (x === 0 && z === 0)) cells.set(key(x, y, z), 'y');
      }
    }
  });
  return cells;
}

function planRoots(rng, ground, y0) {
  const roots = [];
  const count = 7;
  const start = rng.next() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    let a = start + (i * 2 * Math.PI) / count + (rng.next() - 0.5) * 0.5;
    // Unter der Schaukel (Süden) bleibt das Gras frei.
    const offSouth = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
    if (Math.abs(offSouth) < 0.4) a += Math.sign(offSouth || 1) * (0.4 - Math.abs(offSouth));
    const length = 5.8 + rng.next() * 2.4;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z';
    const above = [];
    const flush = [];
    const seen = new Set();
    let prev = null;
    for (let s = 1.6; s <= length; s += 0.2) {
      let cx = Math.round(dx * s);
      let cz = Math.round(dz * s);
      const steps = [];
      if (prev && prev[0] !== cx && prev[1] !== cz) steps.push([cx, prev[1]]);
      steps.push([cx, cz]);
      for (const [x, z] of steps) {
        const id = `${x},${z}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const g = ground.top(x, z);
        if (g === null) continue;
        if (s > length * 0.84) flush.push([x, g, z]);
        else {
          above.push([x, g + 1, z]);
          if (s < 2.4 && g + 1 === y0) above.push([x, g + 2, z]);
        }
      }
      prev = [cx, cz];
    }
    roots.push({ axis, above, flush });
  }
  return roots;
}

function planBranches(rng, y0, trunkTop) {
  const branches = [];
  const south = Math.PI / 2;
  const startY = [6, 10, 7, 11, 8, 9];
  const reach = [9.5, 9.2, 10.4, 8.4, 9.8, 8.8];
  for (let i = 0; i < 6; i++) {
    const a = south + (i * 2 * Math.PI) / 6 + (i === 0 ? 0 : (rng.next() - 0.5) * 0.4);
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const ys = y0 + startY[i];
    const L = reach[i];
    let parts;
    let thickTo;
    let end;
    if (i === 0) {
      // Schaukelast: erst waagrecht, dann biegt er nach oben.
      end = [0.8, ys + 3.6, 11];
      parts = [[[0, ys, 0], [0, ys, 7.4]], [[0, ys, 7.4], [0.2, ys + 0.4, 9.4], end]];
      thickTo = 2.6;
    } else {
      const rise = L * (0.32 + rng.next() * 0.15);
      end = [dx * L, ys + rise, dz * L];
      parts = [[[0, ys, 0], [dx * L * 0.5, ys + rise * 0.22, dz * L * 0.5], end]];
      thickTo = L * 0.45;
    }
    const points = samplePolyline(parts);
    const forkAt = points[Math.round(points.length * (i === 0 ? 0.62 : 0.55))];
    const side = i % 2 === 0 ? 1 : -1;
    const fa = a + side * (0.65 + rng.next() * 0.2);
    const flen = 3.4 + rng.next() * 1.2;
    const forkEnd = [forkAt[0] + Math.cos(fa) * flen, forkAt[1] + 2 + rng.next() * 0.8, forkAt[2] + Math.sin(fa) * flen];
    const forkMid = [(forkAt[0] + forkEnd[0]) / 2, forkAt[1] + 0.6, (forkAt[2] + forkEnd[2]) / 2];
    const mid = points[Math.round(points.length * 0.7)];
    branches.push({
      index: i, ys,
      cells: pathCells(points), thickTo,
      fork: { cells: pathCells(samplePolyline([[forkAt, forkMid, forkEnd]])) },
      blobs: [
        { c: [end[0], end[1] + 1, end[2]], r: 3.3, ry: 2.1 },
        { c: [forkEnd[0], forkEnd[1] + 1, forkEnd[2]], r: 2.9, ry: 1.9 },
        { c: [mid[0], mid[1] + 1.6, mid[2]], r: 2.4, ry: 1.5 },
        // Füllt die Kuppel zwischen Astwolke und Krone über dem Stamm.
        { c: [dx * L * 0.45, trunkTop + 0.5, dz * L * 0.45], r: 3, ry: 2.2 },
      ],
    });
  }
  // Drei kurze Triebe aus der Stammspitze tragen die obere Krone.
  const top = { index: 6, cells: [], blobs: [{ c: [0, trunkTop + 3, 0], r: 4.8, ry: 3 }] };
  for (let j = 0; j < 3; j++) {
    const a = 0.5 + (j * 2 * Math.PI) / 3 + (rng.next() - 0.5) * 0.4;
    const end = [Math.cos(a) * 2.8, trunkTop + 4, Math.sin(a) * 2.8];
    top.cells.push(...pathCells(samplePolyline([[[0, trunkTop - 1, 0], [Math.cos(a), trunkTop + 1, Math.sin(a)], end]])));
    top.blobs.push({ c: [end[0], end[1] + 1.2, end[2]], r: 3.4, ry: 2.4 });
  }
  return { branches, top };
}

function leafState(x, y, z) {
  return noise3(x, y, z, 3.2, 31) > 0.6 ? LEAF_DARK : LEAF;
}

// Laub aus allen Wolken; jedes Blatt gehört zur nächstgelegenen Wolke (Gruppe = Ast). Nur Blätter, die über Laub
// mit Holz verbunden sind, bleiben – so lässt sich jedes Blatt an einen vorhandenen Block setzen.
function planLeaves(b, groups, { minY, clear, isWood }) {
  const blobs = groups.flatMap((g) => g.blobs.map((blob) => ({ ...blob, group: g.index })));
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const blob of blobs) {
    const r = [blob.r, blob.ry, blob.r];
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], Math.floor(blob.c[k] - r[k] * 1.2));
      hi[k] = Math.max(hi[k], Math.ceil(blob.c[k] + r[k] * 1.2));
    }
  }
  const leaves = new Map();
  for (let y = Math.max(lo[1], minY); y <= hi[1]; y++) {
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let x = lo[0]; x <= hi[0]; x++) {
        if (clear(x, y, z) || b.get(x, y, z) !== 'air') continue;
        let d = Infinity;
        let group = -1;
        for (const blob of blobs) {
          const dx = (x - blob.c[0]) / blob.r;
          const dy = (y - blob.c[1]) / blob.ry;
          const dz = (z - blob.c[2]) / blob.r;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < d) {
            d = dist;
            group = blob.group;
          }
        }
        d *= 1 + (noise3(x, y, z, 2.3, 41) - 0.5) * 0.38;
        if (d <= 0.8 || (d <= 1.12 && rand01(x, y, z, 42) < (1.12 - d) / 0.32)) leaves.set(key(x, y, z), group);
      }
    }
  }
  // Erreichbarkeit vom Holz aus.
  const reached = new Set();
  const queue = [];
  for (const k of leaves.keys()) {
    const [x, y, z] = unkey(k);
    if (SIDES.some(([dx, dy, dz]) => isWood(x + dx, y + dy, z + dz))) {
      reached.add(k);
      queue.push(k);
    }
  }
  while (queue.length > 0) {
    const [x, y, z] = unkey(queue.pop());
    for (const [dx, dy, dz] of SIDES) {
      const n = key(x + dx, y + dy, z + dz);
      if (leaves.has(n) && !reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
    }
  }
  for (const k of [...leaves.keys()]) if (!reached.has(k)) leaves.delete(k);
  return leaves;
}

// Reihenfolge der Laub-Schritte: tiefe Äste zuerst, Krone zuletzt. Ein Blatt, das in seinem Schritt noch keinen
// Nachbarn hat (Holz oder schon gesetztes Laub), rutscht in den nächsten Schritt.
function orderLeafSteps(leaves, order, isWood) {
  const placed = new Set();
  const steps = [];
  let carry = [];
  order.forEach((groupIndex, n) => {
    const pending = new Set([...carry, ...[...leaves].filter(([, g]) => g === groupIndex).map(([k]) => k)]);
    const step = [];
    let grew = true;
    while (grew) {
      grew = false;
      for (const k of pending) {
        const [x, y, z] = unkey(k);
        const touches = SIDES.some(([dx, dy, dz]) => {
          const nk = key(x + dx, y + dy, z + dz);
          return placed.has(nk) || isWood(x + dx, y + dy, z + dz);
        });
        if (!touches) continue;
        placed.add(k);
        step.push(k);
        pending.delete(k);
        grew = true;
      }
    }
    carry = [...pending];
    if (n === order.length - 1 && carry.length > 0) throw new Error(`Große Eiche: ${carry.length} Blätter ohne Halt.`);
    steps.push(step);
  });
  return steps;
}

export default function build(b) {
  const rng = createRandom(SEED);

  // --- Bauplatz ---
  b.phase('Bauplatz');
  const ground = terrain(b, {
    x: -GROUND_R, y: 0, z: -GROUND_R, width: GROUND_R * 2 + 1, depth: GROUND_R * 2 + 1, shape: 'rund', seed: 5,
    heightAt: (dx, dz) => moundHeight(dx - GROUND_R, dz - GROUND_R),
  });
  trimLooseColumns(b, ground, GROUND_R);
  const y0 = ground.top(0, 0) + 1;
  const trunkTop = y0 + TRUNK_RADIUS.length - 1;
  const roots = planRoots(rng, ground, y0);
  for (const root of roots) for (const [x, y, z] of root.flush) b.set(x, y, z, `oak_wood[axis=${root.axis}]`);
  // Unter der Krone ist der Boden zertreten: grobe Erde und Wurzelerde nahe am Stamm.
  for (let z = -5; z <= 5; z++) {
    for (let x = -5; x <= 5; x++) {
      const g = ground.top(x, z);
      if (g === null || b.get(x, g, z) !== 'grass_block' || Math.hypot(x, z) > 4.6) continue;
      const v = rand01(x, g, z, 51);
      if (v < 0.22) b.set(x, g, z, 'coarse_dirt');
      else if (v < 0.32) b.set(x, g, z, 'rooted_dirt');
    }
  }

  // --- Stamm ---
  const trunk = planTrunk(y0);
  b.phase('Stamm');
  for (const k of trunk.keys()) {
    const [x, y, z] = unkey(k);
    b.set(x, y, z, trunk.has(key(x, y + 1, z)) ? LOG : 'oak_wood[axis=y]');
  }

  // --- Wurzeln ---
  b.phase('Wurzeln');
  roots.forEach((root) => {
    const cells = root.above.filter(([x, y, z]) => !trunk.has(key(x, y, z)));
    b.step();
    for (const [x, y, z] of cells) {
      b.set(x, y, z, y > ground.top(x, z) + 1 ? 'oak_wood[axis=y]' : `oak_wood[axis=${root.axis}]`);
    }
  });

  // --- Äste ---
  const { branches, top } = planBranches(rng, y0, trunkTop);
  const wood = new Set(trunk.keys());
  for (const root of roots) for (const [x, y, z] of root.above) wood.add(key(x, y, z));
  const isWood = (x, y, z) => wood.has(key(x, y, z));
  const placeLimb = (x, y, z, axis) => {
    const k = key(x, y, z);
    if (wood.has(k)) return;
    wood.add(k);
    b.set(x, y, z, `oak_wood[axis=${axis}]`);
  };
  b.phase('Äste');
  for (const br of branches) {
    b.step();
    for (const [x, y, z, axis] of br.cells) {
      placeLimb(x, y, z, axis);
      if (Math.hypot(x, z) > 1.5 && Math.hypot(x, z) < br.thickTo && !trunk.has(key(x, y - 1, z))) placeLimb(x, y - 1, z, axis);
    }
    for (const [x, y, z, axis] of br.fork.cells) placeLimb(x, y, z, axis);
  }
  b.step();
  for (const [x, y, z, axis] of top.cells) placeLimb(x, y, z, axis);

  // Schaukel und Laterne vorplanen, damit das Laub dort Platz lässt.
  const swing = branches[0];
  const seatY = ground.top(0, 6) + 1;
  const chainTop = swing.ys - 1;
  const lanternBranch = branches[3];
  const lanternCell = lanternBranch.cells.find(([x, y, z]) => Math.hypot(x, z) >= 3.5 && !isWood(x, y - 1, z) && !isWood(x, y - 2, z));
  const lantern = [lanternCell[0], lanternCell[1] - 1, lanternCell[2]];
  const clear = (x, y, z) => (Math.abs(x) <= 1 && z >= 5 && z <= 8 && y >= seatY && y <= chainTop)
    || (Math.abs(x - lantern[0]) <= 1 && Math.abs(z - lantern[2]) <= 1 && y >= lantern[1] - 2 && y <= lantern[1] + 1);

  // --- Krone ---
  const leaves = planLeaves(b, [...branches, top], { minY: y0 + 5, clear, isWood });
  const order = [...branches].sort((p, q) => p.ys - q.ys).map((br) => br.index).concat(top.index);
  const leafSteps = orderLeafSteps(leaves, order, isWood);
  b.phase('Krone');
  for (const stepLeaves of leafSteps) {
    b.step();
    for (const k of stepLeaves) {
      const [x, y, z] = unkey(k);
      b.set(x, y, z, leafState(x, y, z));
    }
  }

  // --- Schaukel, Laterne, Boden ---
  b.phase('Schaukel, Laterne und Wiese');
  b.step();
  for (const z of [6, 7]) {
    for (let y = seatY + 1; y <= chainTop; y++) b.set(0, y, z, 'iron_chain[axis=y]');
    b.slab(0, seatY, z, 'oak_slab', { type: 'top' });
  }
  b.step();
  hangingLantern(b, { x: lantern[0], y: lantern[1], z: lantern[2], chain: 1 });
  b.step();
  for (let z = -12; z <= 12; z++) {
    for (let x = -12; x <= 12; x++) {
      const d = Math.hypot(x, z);
      if (d < 2.5 || d > 11 || rand01(x, 0, z, 61) > 0.24 * (1 - d / 14)) continue;
      const g = ground.top(x, z);
      if (g === null || !['grass_block', 'coarse_dirt', 'rooted_dirt'].includes(b.get(x, g, z)) || b.get(x, g + 1, z) !== 'air') continue;
      const facing = ['north', 'east', 'south', 'west'][hashPosition(x, 1, z, 62) % 4];
      b.set(x, g + 1, z, `leaf_litter[facing=${facing},segment_amount=${1 + (hashPosition(x, 2, z, 63) % 4)}]`);
    }
  }
  vegetation(b, { x: -GROUND_R, y: y0, z: -GROUND_R, width: GROUND_R * 2 + 1, depth: GROUND_R * 2 + 1, mix: 'wiese', density: 0.3, seed: 7 });
}
