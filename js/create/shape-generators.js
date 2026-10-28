// Formen-Generator (ARCHITEKTUR §12.1, Worker-Vertrag §7.4: buildShape(b, shape, params)).
// Rein: kein DOM, läuft in Browser, Worker und Node. Alle Formen beginnen auf y = 0 (Ebene 1).

import * as geometry from '../core/shapes.js';
import { blockExists, isPlaceableAlone, isShapeFriendly } from './block-lookup.js';

export const MAX_SHAPE_BLOCKS = 2_000_000;
const ID_PATTERN = /^[a-z0-9_]{1,64}$/;
const SHAPE_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const HORIZONTAL_OFFSETS = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };

// ------------------------------------------------------------------ Parameter-Bausteine

const intParam = (key, label, min, max, def, extra = {}) => ({ key, label, type: 'int', min, max, default: def, step: 1, ...extra });
const blockParam = (key, label, def, extra = {}) => ({ key, label, type: 'block', default: def, ...extra });
const boolParam = (key, label, def, extra = {}) => ({ key, label, type: 'bool', default: def, ...extra });
const hollowParam = (def) => boolParam('hollow', 'Hohl', def);
const thicknessParam = () => intParam('thickness', 'Wandstärke', 1, 10, 1, { dependsOn: 'hollow', unit: 'Blöcke' });

// ------------------------------------------------------------------ Kapitel

function layerRange(from, to) {
  return from === to ? `Ebene ${from + 1}` : `Ebene ${from + 1}–${to + 1}`;
}

// Teilt die Ebenen y0 … y1 in n gleich große Abschnitte → [[von, bis], …]
function splitLayers(y0, y1, n) {
  const height = y1 - y0 + 1;
  const parts = Math.max(1, Math.min(n, height));
  const out = [];
  for (let i = 0; i < parts; i++) {
    const from = y0 + Math.floor((i * height) / parts);
    const to = y0 + Math.floor(((i + 1) * height) / parts) - 1;
    out.push([from, to]);
  }
  return out;
}

// Wie viele Kapitel eine Form mit dieser Höhe bekommt
function chapterCount(height, estimate) {
  if (height <= 10 || estimate < 800) return 1;
  if (height <= 24) return 2;
  if (height <= 120) return 3;
  return 4;
}

const THIRD_NAMES = { 2: ['Untere Hälfte', 'Obere Hälfte'], 3: ['Unteres Drittel', 'Mittleres Drittel', 'Oberes Drittel'], 4: ['Unteres Viertel', 'Zweites Viertel', 'Drittes Viertel', 'Oberes Viertel'] };

/** Kapitel für Ebenen-Abschnitte, nur mit Titel → [{ from, title }] für layerWriter. */
function layerChapters(y0, y1, count, baseTitle) {
  const ranges = splitLayers(y0, y1, count);
  return ranges.map(([from, to], index) => {
    const name = ranges.length === 1 ? baseTitle : `${baseTitle}: ${THIRD_NAMES[ranges.length][index]}`;
    return { from: index === 0 ? -Infinity : from, title: `${name} (${layerRange(from, to)})` };
  });
}

// Setzt Blöcke und eröffnet das passende Kapitel, sobald y die nächste Grenze erreicht (y muss wachsen).
function layerWriter(b, chapters) {
  let current = -1;
  return (x, y, z, state) => {
    let target = current;
    while (target + 1 < chapters.length && y >= chapters[target + 1].from) target++;
    if (target !== current) {
      current = target;
      b.phase(chapters[current].title);
    }
    b.set(x, y, z, state);
  };
}

// ------------------------------------------------------------------ Schätzungen

// Obergrenzen: volle Formen mit Außenmaß + 1, Hüllen zwischen Außenmaß + ½ und Innenmaß − ½ (gerasterte Ränder haben mehr Blöcke als die glatte Form)
const sphereVolume = (d) => (Math.PI / 6) * Math.max(0, d) ** 3;
const discArea = (d) => (Math.PI / 4) * Math.max(0, d) ** 2;
const shell = (outer, inner) => Math.max(0, outer - Math.max(0, inner));

function estimateSphere(d, hollow, t, fraction = 1) {
  const full = sphereVolume(d + 1);
  return fraction * (hollow ? Math.min(full, shell(sphereVolume(d + 0.5), sphereVolume(d - 2 * t - 0.5))) : full);
}

function estimateDisc(d, hollow, t) {
  const full = discArea(d + 1);
  return hollow ? Math.min(full, shell(discArea(d + 0.5), discArea(d - 2 * t - 0.5))) : full;
}

function estimateCone(d, h, hollow, t) {
  const full = (Math.PI / 12) * (d + 1) ** 2 * (h + 1) + discArea(d + 1);
  if (!hollow) return full;
  const slant = Math.hypot(d / 2 + 1, h + 1);
  return Math.min(full, Math.PI * (d / 2 + 1) * slant * (t + 1) + discArea(d + 1));
}

// ------------------------------------------------------------------ Formen

const sphere = {
  id: 'sphere',
  title: 'Kugel',
  description: 'Eine runde Kugel, Ebene für Ebene aus Kreisen. Hohl ist sie dicht – gut für Glaskuppeln, Unterwasserbasen und Planeten.',
  params: [intParam('diameter', 'Durchmesser', 3, 301, 21, { unit: 'Blöcke' }), blockParam('block', 'Block', 'glass'), hollowParam(true), thicknessParam()],
  estimate: (p) => estimateSphere(p.diameter, p.hollow, p.thickness),
  size: (p) => [p.diameter, p.diameter, p.diameter],
  build(b, p) {
    const c = geometry.spanCenter(0, p.diameter);
    const r = geometry.spanRadius(p.diameter);
    const chapters = layerChapters(0, p.diameter - 1, chapterCount(p.diameter, this.estimate(p)), 'Kugel');
    const put = layerWriter(b, chapters);
    geometry.sphere(c, c, c, r, { hollow: p.hollow, thickness: p.thickness }, (x, y, z) => put(x, y, z, p.block));
  },
};

const dome = {
  id: 'dome',
  title: 'Kuppel',
  description: 'Eine halbe Kugel, unten offen. Passt als Dach auf runde Türme, Hallen und Gewächshäuser.',
  params: [intParam('diameter', 'Durchmesser', 3, 301, 21, { unit: 'Blöcke' }), blockParam('block', 'Block', 'glass'), hollowParam(true), thicknessParam()],
  // halbe Kugel plus Äquator-Ebene
  estimate: (p) => estimateSphere(p.diameter, p.hollow, p.thickness, 0.5) + estimateDisc(p.diameter, false, 1),
  size: (p) => [p.diameter, Math.ceil(p.diameter / 2), p.diameter],
  build(b, p) {
    const c = geometry.spanCenter(0, p.diameter);
    const r = geometry.spanRadius(p.diameter);
    const cy = p.diameter % 2 === 1 ? 0 : -0.5;
    const height = Math.ceil(p.diameter / 2);
    const chapters = layerChapters(0, height - 1, chapterCount(height, this.estimate(p)), 'Kuppel');
    const put = layerWriter(b, chapters);
    geometry.sphere(c, cy, c, r, { hollow: p.hollow, thickness: p.thickness, part: 'top' }, (x, y, z) => put(x, y, z, p.block));
  },
};

const ROOF_OPTIONS = [
  { value: 'none', label: 'Kein Dach' },
  { value: 'flat', label: 'Flachdach' },
  { value: 'cone', label: 'Kegeldach (spitz)' },
  { value: 'dome', label: 'Kuppeldach' },
];

// Dach eines Turms. Mit Zinnen steht ein Kegel- oder Kuppeldach einen Block nach innen gerückt zwischen ihnen.
function roofPlan(p) {
  const inset = p.battlements && (p.roof === 'cone' || p.roof === 'dome');
  const diameter = p.diameter - (inset ? 2 : 0);
  const overhang = p.roof === 'cone' && !inset && p.diameter >= 5 ? 1 : 0;
  const base = p.height;
  const coneHeight = Math.max(3, Math.round((diameter + 2 * overhang) * 0.8));
  const domeHeight = Math.ceil(diameter / 2);
  let top = p.height + (p.roof === 'flat' ? 1 : 0) + (p.battlements ? 1 : 0);
  if (p.roof === 'cone') top = Math.max(top, base + coneHeight);
  if (p.roof === 'dome') top = Math.max(top, base + domeHeight);
  return { inset, diameter, overhang, base, coneHeight, domeHeight, height: top };
}

const cylinder = {
  id: 'cylinder',
  title: 'Turm / Säule',
  description: 'Ein runder Turm (hohl) oder eine Säule (voll), auf Wunsch mit Boden, Zinnen und Dach.',
  params: [
    intParam('diameter', 'Durchmesser', 1, 301, 9, { unit: 'Blöcke' }),
    intParam('height', 'Höhe', 1, 512, 20, { unit: 'Blöcke' }),
    blockParam('block', 'Block', 'stone_bricks'),
    hollowParam(true),
    thicknessParam(),
    boolParam('floor', 'Boden', false, { dependsOn: 'hollow' }),
    boolParam('battlements', 'Zinnen', false),
    { key: 'roof', label: 'Dach', type: 'enum', default: 'none', options: ROOF_OPTIONS },
    blockParam('roofBlock', 'Dach-Block', '', { optional: true, emptyLabel: 'wie die Mauer', dependsOn: 'roof' }),
  ],
  check(p) {
    return p.battlements && p.diameter < 5 ? ['Zinnen brauchen mindestens 5 Blöcke Durchmesser.'] : [];
  },
  estimate(p) {
    const plan = roofPlan(p);
    const area = discArea(p.diameter + 1);
    let n = estimateDisc(p.diameter, p.hollow, p.thickness) * p.height;
    if (p.hollow && p.floor) n += area;
    if (p.battlements) n += Math.PI * (p.diameter + 1);
    if (p.roof === 'flat') n += area;
    if (p.roof === 'cone') n += estimateCone(plan.diameter + 2 * plan.overhang, plan.coneHeight, p.hollow, 1);
    if (p.roof === 'dome') n += estimateSphere(plan.diameter, p.hollow, 1, 0.5) + estimateDisc(plan.diameter, false, 1);
    return n;
  },
  size(p) {
    const plan = roofPlan(p);
    const w = p.diameter + 2 * plan.overhang;
    return [w, plan.height, w];
  },
  build(b, p) {
    const plan = roofPlan(p);
    const c = geometry.spanCenter(plan.overhang, p.diameter);
    const r = geometry.spanRadius(p.diameter);
    const roofBlock = p.roofBlock || p.block;
    const isTower = p.hollow && p.diameter >= 3;
    const name = isTower ? 'Mauer' : 'Säule';
    if (isTower && p.floor) {
      b.phase('Boden (Ebene 1)');
      geometry.disc(c, 0, c, r, {}, (x, y, z) => b.set(x, y, z, p.block));
    }
    const chapters = layerChapters(0, p.height - 1, chapterCount(p.height, this.estimate(p)), name);
    const put = layerWriter(b, chapters);
    geometry.cylinder(c, 0, c, r, p.height, { hollow: p.hollow, thickness: p.thickness }, (x, y, z) => put(x, y, z, p.block));

    if (p.roof === 'flat') {
      b.phase(`Flachdach (${layerRange(p.height, p.height)})`);
      geometry.disc(c, p.height, c, r, {}, (x, y, z) => b.set(x, y, z, roofBlock));
    }
    if (p.battlements) {
      const y = p.height + (p.roof === 'flat' ? 1 : 0);
      b.phase(`Zinnen (${layerRange(y, y)})`);
      geometry.disc(c, y, c, r, { hollow: true, thickness: 1 }, (x, yy, z) => {
        if (((x + z) & 1) === 0) b.set(x, yy, z, p.block);
      });
    }
    const roofR = geometry.spanRadius(plan.diameter);
    if (p.roof === 'cone') {
      b.phase(`Kegeldach (${layerRange(plan.base, plan.base + plan.coneHeight - 1)})`);
      geometry.cone(c, plan.base, c, roofR + plan.overhang, 0, plan.coneHeight, { hollow: p.hollow }, (x, y, z) => b.set(x, y, z, roofBlock));
    } else if (p.roof === 'dome') {
      const cy = plan.diameter % 2 === 1 ? plan.base : plan.base - 0.5;
      b.phase(`Kuppeldach (${layerRange(plan.base, plan.base + plan.domeHeight - 1)})`);
      geometry.sphere(c, cy, c, roofR, { hollow: p.hollow, part: 'top' }, (x, y, z) => b.set(x, y, z, roofBlock));
    }
  },
};

const cone = {
  id: 'cone',
  title: 'Kegel',
  description: 'Ein spitzer Kegel aus immer kleineren Kreisen – für Turmspitzen, Vulkane oder Zelte.',
  params: [
    intParam('diameter', 'Durchmesser unten', 3, 301, 11, { unit: 'Blöcke' }),
    intParam('height', 'Höhe', 2, 512, 15, { unit: 'Blöcke' }),
    blockParam('block', 'Block', 'stone_bricks'),
    hollowParam(false),
    thicknessParam(),
  ],
  estimate: (p) => estimateCone(p.diameter, p.height, p.hollow, p.thickness),
  size: (p) => [p.diameter, p.height, p.diameter],
  build(b, p) {
    const c = geometry.spanCenter(0, p.diameter);
    const r = geometry.spanRadius(p.diameter);
    const chapters = layerChapters(0, p.height - 1, chapterCount(p.height, this.estimate(p)), 'Kegel');
    const put = layerWriter(b, chapters);
    geometry.cone(c, 0, c, r, 0, p.height, { hollow: p.hollow, thickness: p.thickness }, (x, y, z) => put(x, y, z, p.block));
  },
};

function pyramidLayerCells(width, k, hollow, thickness, emit) {
  const lo = k;
  const hi = width - 1 - k;
  for (let z = lo; z <= hi; z++) {
    for (let x = lo; x <= hi; x++) {
      if (hollow && Math.min(x - lo, hi - x, z - lo, hi - z) >= thickness) continue;
      emit(x, k, z);
    }
  }
}

const pyramid = {
  id: 'pyramid',
  title: 'Pyramide',
  description: 'Eine Stufenpyramide: Jede Ebene ist ein Quadrat, das auf jeder Seite einen Block nach innen rückt.',
  params: [intParam('width', 'Breite unten', 3, 301, 21, { unit: 'Blöcke' }), blockParam('block', 'Block', 'sandstone'), hollowParam(false), thicknessParam()],
  estimate(p) {
    let n = 0;
    for (let s = p.width; s > 0; s -= 2) n += p.hollow ? s * s - Math.max(0, s - 2 * p.thickness) ** 2 : s * s;
    return n;
  },
  size: (p) => [p.width, Math.ceil(p.width / 2), p.width],
  build(b, p) {
    const height = Math.ceil(p.width / 2);
    const chapters = layerChapters(0, height - 1, chapterCount(height, this.estimate(p)), 'Pyramide');
    const put = layerWriter(b, chapters);
    for (let k = 0; k < height; k++) pyramidLayerCells(p.width, k, p.hollow, p.thickness, (x, y, z) => put(x, y, z, p.block));
  },
};

function buildBox(b, p, w, h, l, baseTitle) {
  const estimate = p.hollow ? w * h * l - Math.max(0, w - 2) * Math.max(0, h - 2) * Math.max(0, l - 2) : w * h * l;
  const chapters = layerChapters(0, h - 1, chapterCount(h, estimate), baseTitle);
  const put = layerWriter(b, chapters);
  for (let y = 0; y < h; y++) {
    const capLayer = y === 0 || y === h - 1;
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++) {
        if (p.hollow && !capLayer && x > 0 && x < w - 1 && z > 0 && z < l - 1) continue;
        put(x, y, z, p.block);
      }
    }
  }
}

const cube = {
  id: 'cube',
  title: 'Würfel',
  description: 'Ein Würfel mit gleich langen Kanten, voll oder hohl.',
  params: [intParam('size', 'Kantenlänge', 1, 256, 10, { unit: 'Blöcke' }), blockParam('block', 'Block', 'stone'), hollowParam(false)],
  estimate: (p) => (p.hollow ? p.size ** 3 - Math.max(0, p.size - 2) ** 3 : p.size ** 3),
  size: (p) => [p.size, p.size, p.size],
  build(b, p) {
    buildBox(b, p, p.size, p.size, p.size, 'Würfel');
  },
};

const cuboid = {
  id: 'cuboid',
  title: 'Quader',
  description: 'Ein Quader mit eigener Breite, Höhe und Länge – als Grundkörper für Häuser, Hallen oder Mauern.',
  params: [
    intParam('width', 'Breite (x)', 1, 512, 10, { unit: 'Blöcke' }),
    intParam('height', 'Höhe (y)', 1, 512, 5, { unit: 'Blöcke' }),
    intParam('length', 'Länge (z)', 1, 512, 10, { unit: 'Blöcke' }),
    blockParam('block', 'Block', 'stone_bricks'),
    hollowParam(false),
  ],
  estimate: (p) => (p.hollow ? p.width * p.height * p.length - Math.max(0, p.width - 2) * Math.max(0, p.height - 2) * Math.max(0, p.length - 2) : p.width * p.height * p.length),
  size: (p) => [p.width, p.height, p.length],
  build(b, p) {
    buildBox(b, p, p.width, p.height, p.length, 'Quader');
  },
};

// Ellipsoid mit Durchmessern w, h, l (Mittelpunkt-Regel wie bei der Kugel: Halbachse = Durchmesser / 2)
function emitEllipsoid(w, h, l, hollow, thickness, emit) {
  const cx = (w - 1) / 2, cy = (h - 1) / 2, cz = (l - 1) / 2;
  const ax2 = (w / 2) ** 2, ay2 = (h / 2) ** 2, az2 = (l / 2) ** 2;
  const inside = (x, y, z) => (x - cx) ** 2 / ax2 + (y - cy) ** 2 / ay2 + (z - cz) ** 2 / az2 <= 1;
  const t = thickness;
  for (let y = 0; y < h; y++) {
    const ry = 1 - (y - cy) ** 2 / ay2;
    for (let z = 0; z < l; z++) {
      const rest = ry - (z - cz) ** 2 / az2;
      if (rest < 0) continue;
      const half = Math.sqrt(rest * ax2);
      let x0 = Math.ceil(cx - half), x1 = Math.floor(cx + half);
      while (x0 <= x1 && !inside(x0, y, z)) x0++;
      while (x1 >= x0 && !inside(x1, y, z)) x1--;
      for (let x = x0; x <= x1; x++) {
        // konvexe Form: liegen die 6 Achsenpunkte im Abstand t innen, dann auch alles dazwischen → Kernblock
        if (hollow && inside(x - t, y, z) && inside(x + t, y, z) && inside(x, y - t, z) && inside(x, y + t, z) && inside(x, y, z - t) && inside(x, y, z + t)) continue;
        emit(x, y, z);
      }
    }
  }
}

const ellipsoid = {
  id: 'ellipsoid',
  title: 'Ellipsoid',
  description: 'Eine gestreckte oder gestauchte Kugel mit eigener Breite, Höhe und Länge – für Eier, Luftschiffe oder Kokons.',
  params: [
    intParam('width', 'Breite (x)', 3, 301, 21, { unit: 'Blöcke' }),
    intParam('height', 'Höhe (y)', 3, 301, 15, { unit: 'Blöcke' }),
    intParam('length', 'Länge (z)', 3, 301, 31, { unit: 'Blöcke' }),
    blockParam('block', 'Block', 'white_concrete'),
    hollowParam(true),
    thicknessParam(),
  ],
  estimate(p) {
    const full = (Math.PI / 6) * (p.width + 1) * (p.height + 1) * (p.length + 1);
    if (!p.hollow) return full;
    const inner = [p.width, p.height, p.length].map((d) => Math.max(0, d - 2 * p.thickness - 1));
    return shell(full, (Math.PI / 6) * inner[0] * inner[1] * inner[2]);
  },
  size: (p) => [p.width, p.height, p.length],
  build(b, p) {
    const chapters = layerChapters(0, p.height - 1, chapterCount(p.height, this.estimate(p)), 'Ellipsoid');
    const put = layerWriter(b, chapters);
    emitEllipsoid(p.width, p.height, p.length, p.hollow, p.thickness, (x, y, z) => put(x, y, z, p.block));
  },
};

const torus = {
  id: 'torus',
  title: 'Ring (Torus)',
  description: 'Ein liegender Ring wie ein Donut: eine runde Röhre, die im Kreis läuft.',
  params: [
    intParam('radius', 'Ringradius', 2, 150, 12, { unit: 'Blöcke', hint: 'Abstand von der Mitte bis zur Mitte der Röhre' }),
    intParam('tube', 'Röhrenradius', 1, 40, 3, { unit: 'Blöcke' }),
    blockParam('block', 'Block', 'quartz_block'),
    hollowParam(false),
  ],
  check: (p) => (p.tube >= p.radius ? ['Der Röhrenradius muss kleiner als der Ringradius sein, sonst schließt sich das Loch in der Mitte.'] : []),
  estimate: (p) => {
    const full = 2 * Math.PI ** 2 * (p.radius + 1) * (p.tube + 1) ** 2;
    return p.hollow ? shell(full, 2 * Math.PI ** 2 * Math.max(0, p.radius - 1) * Math.max(0, p.tube - 1) ** 2) : full;
  },
  size: (p) => {
    const w = 2 * (p.radius + p.tube) + 1;
    return [w, 2 * p.tube + 1, w];
  },
  build(b, p) {
    const R = p.radius, r = p.tube;
    const extent = R + r;
    const limit = (r + 0.5) ** 2;
    const inside = (x, y, z) => (Math.hypot(x - extent, z - extent) - R) ** 2 + (y - r) ** 2 <= limit;
    const height = 2 * r + 1;
    const chapters = layerChapters(0, height - 1, chapterCount(height, this.estimate(p)), 'Ring');
    const put = layerWriter(b, chapters);
    const size = 2 * extent;
    for (let y = 0; y < height; y++) {
      for (let z = 0; z <= size; z++) {
        for (let x = 0; x <= size; x++) {
          if (!inside(x, y, z)) continue;
          if (p.hollow && inside(x - 1, y, z) && inside(x + 1, y, z) && inside(x, y - 1, z) && inside(x, y + 1, z) && inside(x, y, z - 1) && inside(x, y, z + 1)) continue;
          put(x, y, z, p.block);
        }
      }
    }
  },
};

const circle = {
  id: 'circle',
  title: 'Kreis',
  description: 'Ein flacher Kreis oder Kreisring auf einer Ebene – der Grundriss für Türme, Kuppeln und runde Plätze.',
  params: [intParam('diameter', 'Durchmesser', 3, 501, 21, { unit: 'Blöcke' }), blockParam('block', 'Block', 'stone_bricks'), hollowParam(true), thicknessParam()],
  estimate: (p) => estimateDisc(p.diameter, p.hollow, p.thickness),
  size: (p) => [p.diameter, 1, p.diameter],
  build(b, p) {
    const c = geometry.spanCenter(0, p.diameter);
    b.phase('Kreis (Ebene 1)');
    geometry.disc(c, 0, c, geometry.spanRadius(p.diameter), { hollow: p.hollow, thickness: p.thickness }, (x, y, z) => b.set(x, y, z, p.block));
  },
};

// Bogen in der x-y-Ebene: Öffnung = Rechteck (Pfeiler) + Halbellipse, Bogen = Öffnung um t Blöcke erweitert (Quadrat-Nachbarschaft, dicht)
export function archGrid(width, height, thickness) {
  const rise = Math.min(height, Math.ceil(width / 2));
  const legs = height - rise;
  const cx = (width - 1) / 2;
  const ai = width / 2 - thickness;
  const bi = rise - thickness;
  const opening = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      let open;
      if (y < legs) open = Math.abs(dx) <= ai - 0.5;
      else open = bi > 0 && ai > 0 && (dx * dx) / (ai * ai) + ((y + 0.5 - legs) ** 2) / (bi * bi) <= 1;
      opening[y * width + x] = open ? 1 : 0;
    }
  }
  // waagrecht erweitern, dann senkrecht (Quadrat ist trennbar)
  const horizontal = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let hit = 0;
      for (let d = -thickness; d <= thickness && !hit; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < width && opening[y * width + xx]) hit = 1;
      }
      horizontal[y * width + x] = hit;
    }
  }
  const arch = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (opening[y * width + x]) continue;
      let hit = 0;
      // unter y = 0 liegt der Boden: die Öffnung reicht dort weiter nach unten
      for (let d = -thickness; d <= thickness && !hit; d++) {
        const yy = y + d;
        if (yy < 0) hit = horizontal[x] && legs > 0 ? 1 : 0;
        else if (yy < height && horizontal[yy * width + x]) hit = 1;
      }
      arch[y * width + x] = hit;
    }
  }
  return { arch, legs, rise };
}

const arch = {
  id: 'arch',
  title: 'Bogen',
  description: 'Ein runder Torbogen aus zwei Pfeilern und einem gewölbten Scheitel – für Tore, Brücken und Fenster.',
  params: [
    intParam('width', 'Breite außen', 3, 201, 9, { unit: 'Blöcke' }),
    intParam('height', 'Höhe', 2, 201, 8, { unit: 'Blöcke' }),
    intParam('depth', 'Tiefe', 1, 64, 2, { unit: 'Blöcke' }),
    intParam('thickness', 'Dicke', 1, 20, 1, { unit: 'Blöcke' }),
    blockParam('block', 'Block', 'stone_bricks'),
  ],
  check(p) {
    const errors = [];
    if (p.width - 2 * p.thickness < 1) errors.push('Der Bogen ist zu schmal für diese Dicke – mach ihn breiter oder dünner.');
    else if (Math.min(p.height, Math.ceil(p.width / 2)) - p.thickness < 1 && p.height - Math.ceil(p.width / 2) < 1) errors.push('Der Bogen ist zu niedrig für diese Dicke – mach ihn höher oder dünner.');
    return errors;
  },
  estimate: (p) => p.width * p.height * p.depth,
  size: (p) => [p.width, p.height, p.depth],
  build(b, p) {
    const { arch: grid, legs } = archGrid(p.width, p.height, p.thickness);
    const chapters = [];
    if (legs > 0) {
      chapters.push({ from: -Infinity, title: `Pfeiler (${layerRange(0, legs - 1)})` });
    }
    chapters.push({ from: legs > 0 ? legs : -Infinity, title: `Bogen (${layerRange(legs, p.height - 1)})` });
    const put = layerWriter(b, chapters);
    for (let y = 0; y < p.height; y++) {
      for (let z = 0; z < p.depth; z++) {
        for (let x = 0; x < p.width; x++) if (grid[y * p.width + x]) put(x, y, z, p.block);
      }
    }
  },
};

// Quadratischer Ring wie Builder.spiralStairs: Start an der Nordseite, im Uhrzeigersinn
function squareRing(cx, cz, r) {
  const cells = [];
  for (let x = cx; x < cx + r; x++) cells.push([x, cz - r]);
  for (let z = cz - r; z < cz + r; z++) cells.push([cx + r, z]);
  for (let x = cx + r; x > cx - r; x--) cells.push([x, cz + r]);
  for (let z = cz + r; z > cz - r; z--) cells.push([cx - r, z]);
  for (let x = cx - r; x < cx; x++) cells.push([x, cz - r]);
  return cells;
}

function facingBetween([x, z], [nx, nz]) {
  return Object.keys(HORIZONTAL_OFFSETS).find((dir) => HORIZONTAL_OFFSETS[dir][0] === nx - x && HORIZONTAL_OFFSETS[dir][1] === nz - z);
}

const spiralStairs = {
  id: 'spiral-stairs',
  title: 'Wendeltreppe',
  description: 'Eine eckige Wendeltreppe: pro Ebene eine Treppe, im Kreis um eine Mittelsäule, auf Wunsch mit Außenwand.',
  params: [
    intParam('height', 'Höhe', 2, 512, 20, { unit: 'Blöcke' }),
    intParam('radius', 'Abstand zur Mitte', 1, 16, 2, { unit: 'Blöcke' }),
    blockParam('stairs', 'Treppe', 'oak_stairs', { kind: 'stairs' }),
    blockParam('core', 'Mittelsäule', 'stone_bricks', { optional: true, emptyLabel: 'keine' }),
    blockParam('wall', 'Außenwand', '', { optional: true, emptyLabel: 'keine' }),
    boolParam('clockwise', 'Im Uhrzeigersinn', true),
  ],
  estimate: (p) => p.height * (1 + (p.core ? (2 * p.radius - 1) ** 2 : 0) + (p.wall ? 8 * (p.radius + 1) : 0)),
  size: (p) => {
    const w = 2 * (p.radius + (p.wall ? 1 : 0)) + 1;
    return [w, p.height, w];
  },
  build(b, p) {
    const pad = p.wall ? 1 : 0;
    const cx = p.radius + pad, cz = p.radius + pad;
    const ring = squareRing(cx, cz, p.radius);
    const path = p.clockwise ? ring : [ring[0], ...ring.slice(1).reverse()];
    const chapters = layerChapters(0, p.height - 1, chapterCount(p.height, this.estimate(p)), 'Wendeltreppe');
    const put = layerWriter(b, chapters);
    for (let y = 0; y < p.height; y++) {
      const cell = path[y % path.length];
      const next = path[(y + 1) % path.length];
      put(cell[0], y, cell[1], `${p.stairs}[facing=${facingBetween(cell, next)},half=bottom]`);
      if (p.core) {
        for (let dz = 1 - p.radius; dz < p.radius; dz++) {
          for (let dx = 1 - p.radius; dx < p.radius; dx++) put(cx + dx, y, cz + dz, p.core);
        }
      }
      if (p.wall) {
        for (const [x, z] of squareRing(cx, cz, p.radius + 1)) put(x, y, z, p.wall);
      }
    }
  },
};

export const SHAPES = Object.freeze({
  sphere, dome, cylinder, cone, pyramid, cube, cuboid, ellipsoid, torus, circle, arch, 'spiral-stairs': spiralStairs,
});
export const SHAPE_IDS = Object.freeze(Object.keys(SHAPES));

for (const shape of Object.values(SHAPES)) {
  for (const param of shape.params) Object.freeze(param);
  Object.freeze(shape.params);
  Object.freeze(shape);
}

export function getShape(shapeId) {
  return typeof shapeId === 'string' && Object.hasOwn(SHAPES, shapeId) ? SHAPES[shapeId] : null;
}

/** Standardwerte einer Form → { key: wert } (oder null bei unbekannter Form). */
export function defaultShapeParams(shapeId) {
  const shape = getShape(shapeId);
  if (!shape) return null;
  return Object.fromEntries(shape.params.map((param) => [param.key, param.default]));
}

// ------------------------------------------------------------------ Prüfen

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function coerceInt(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value === 'string' && /^\s*[+-]?\d{1,7}\s*$/.test(value)) return Number(value.trim());
  return NaN;
}

function coerceBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'ja', 'on', 'yes'].includes(v)) return true;
    if (['0', 'false', 'nein', 'off', 'no'].includes(v)) return false;
  }
  return null;
}

function checkBlockParam(param, value, blocks, errors, warnings) {
  if (typeof value !== 'string') {
    errors.push(`${param.label}: bitte eine Block-ID angeben (z. B. stone_bricks).`);
    return param.default;
  }
  const id = value.trim().toLowerCase().replace(/^minecraft:/, '');
  if (id === '' && param.optional) return '';
  if (!ID_PATTERN.test(id)) {
    errors.push(`${param.label}: „${value.slice(0, 40)}“ ist keine gültige Block-ID.`);
    return param.default;
  }
  const exists = blockExists(id, blocks);
  if (exists === false) {
    errors.push(`${param.label}: Den Block „${id}“ gibt es in Minecraft 26.2 nicht.`);
    return param.default;
  }
  if (param.kind === 'stairs') {
    if (!id.endsWith('_stairs')) errors.push(`${param.label}: „${id}“ ist keine Treppe.`);
    return id;
  }
  if (!isPlaceableAlone(id, blocks)) {
    errors.push(`${param.label}: „${id}“ lässt sich nicht als einzelner Block für eine Form setzen.`);
    return param.default;
  }
  if (!isShapeFriendly(id)) warnings.push(`${param.label}: „${id}“ ist kein voller Block – die Form kann löchrig oder ungewohnt aussehen.`);
  return id;
}

/**
 * Prüft Parameter einer Form → { ok, params, errors, warnings, estimate }.
 * raw: Objekt mit Zahlen, Texten oder Wahrheitswerten (auch Texte aus Formularen/URL). Fehlendes = Standardwert.
 * Optionen: blocks (blocks.json, Liste oder Menge von IDs) zum Prüfen der Block-IDs; ohne → geladene Kerndaten, sonst nur das Muster.
 */
export function validateShapeParams(shapeId, raw = {}, { blocks = null } = {}) {
  const shape = getShape(shapeId);
  if (!shape) return { ok: false, params: null, errors: [`Unbekannte Form „${String(shapeId).slice(0, 40)}“. Möglich sind: ${SHAPE_IDS.join(', ')}.`], warnings: [], estimate: 0 };
  const input = raw === undefined || raw === null ? {} : raw;
  if (!isPlainObject(input)) return { ok: false, params: null, errors: ['Die Form-Parameter müssen ein einfaches Objekt sein.'], warnings: [], estimate: 0 };
  const errors = [];
  const warnings = [];
  const known = new Set(shape.params.map((param) => param.key));
  for (const key of Object.keys(input)) {
    if (!known.has(key)) errors.push(`Unbekannter Parameter „${key.slice(0, 32)}“ für ${shape.title}.`);
  }
  const params = {};
  for (const param of shape.params) {
    let value = input[param.key];
    if (value === undefined || value === null || (value === '' && !(param.type === 'block' && param.optional))) value = param.default;
    if (param.type === 'int') {
      const n = coerceInt(value);
      if (!Number.isInteger(n) || n < param.min || n > param.max) {
        errors.push(`${param.label}: bitte eine ganze Zahl von ${param.min} bis ${param.max} angeben.`);
        params[param.key] = param.default;
      } else {
        params[param.key] = n;
      }
    } else if (param.type === 'bool') {
      const v = coerceBool(value);
      if (v === null) errors.push(`${param.label}: bitte ja oder nein angeben.`);
      params[param.key] = v ?? param.default;
    } else if (param.type === 'enum') {
      const ok = typeof value === 'string' && param.options.some((option) => option.value === value);
      if (!ok) errors.push(`${param.label}: erlaubt sind ${param.options.map((option) => option.label).join(', ')}.`);
      params[param.key] = ok ? value : param.default;
    } else {
      params[param.key] = checkBlockParam(param, value, blocks, errors, warnings);
    }
  }
  if (!errors.length && shape.check) errors.push(...shape.check(params));
  const estimate = errors.length ? 0 : Math.ceil(shape.estimate(params) * 1.05);
  if (estimate > MAX_SHAPE_BLOCKS) {
    errors.push(`Die Form hätte etwa ${formatMillions(estimate)} Blöcke – möglich sind höchstens 2 Mio. Mach sie kleiner${params.hollow === false ? ' oder hohl' : ''}.`);
  }
  return { ok: errors.length === 0, params, errors, warnings, estimate };
}

function formatMillions(n) {
  return n >= 1_000_000 ? `${(Math.round(n / 100_000) / 10).toString().replace('.', ',')} Mio.` : String(n);
}

/** Baut eine Form in den Builder (Vertrag des Workers). Wirft einen Error mit deutschen Meldungen bei ungültigen Parametern. */
export function buildShape(b, shapeId, params) {
  if (!b || typeof b.set !== 'function' || typeof b.phase !== 'function') throw new Error('buildShape braucht einen Builder.');
  const check = validateShapeParams(shapeId, params ?? {});
  if (!check.ok) throw new Error(check.errors.join(' '));
  SHAPES[shapeId].build(b, check.params);
  return { params: check.params, warnings: check.warnings, estimate: check.estimate };
}

/** Voraussichtliche Größe [w, h, l] einer Form mit geprüften Parametern. */
export function shapeSize(shapeId, params) {
  const shape = getShape(shapeId);
  return shape ? shape.size(params) : null;
}

// ------------------------------------------------------------------ Adresse (bau.html?form=…)

/**
 * Liest Form und Parameter aus der Adresse (URLSearchParams oder Text „form=sphere&diameter=21…“).
 * Nur bekannte Parameter werden gelesen (Whitelist), alles wird geprüft → { ok, shape, params, errors, warnings }.
 */
export function parseShapeQuery(search, { blocks = null } = {}) {
  let query;
  try {
    query = search instanceof URLSearchParams ? search : new URLSearchParams(typeof search === 'string' ? search : '');
  } catch {
    return { ok: false, shape: null, params: null, errors: ['Die Adresse lässt sich nicht lesen.'], warnings: [] };
  }
  const shapeId = query.get('form');
  if (shapeId === null || !SHAPE_ID_PATTERN.test(shapeId) || !getShape(shapeId)) {
    return { ok: false, shape: null, params: null, errors: [shapeId === null ? 'In der Adresse fehlt die Form (form=…).' : `Unbekannte Form „${shapeId.slice(0, 40)}“.`], warnings: [] };
  }
  const raw = {};
  for (const param of SHAPES[shapeId].params) {
    const value = query.get(param.key);
    if (value !== null) raw[param.key] = value.slice(0, 80);
  }
  const result = validateShapeParams(shapeId, raw, { blocks });
  return { ok: result.ok, shape: shapeId, params: result.params, errors: result.errors, warnings: result.warnings };
}

/** Adressteil für eine Form: „form=sphere&diameter=21&block=glass&hollow=1&thickness=1“ (ohne „?“). */
export function shapeQueryString(shapeId, params = {}) {
  const shape = getShape(shapeId);
  if (!shape) throw new Error(`Unbekannte Form „${String(shapeId).slice(0, 40)}“.`);
  const query = new URLSearchParams({ form: shapeId });
  for (const param of shape.params) {
    const value = params[param.key] ?? param.default;
    query.set(param.key, param.type === 'bool' ? (value ? '1' : '0') : String(value));
  }
  return query.toString();
}
