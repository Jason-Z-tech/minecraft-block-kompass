import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as shapes from '../../js/core/shapes.js';

function collect(fn) {
  const cells = new Set();
  const count = fn((x, y, z) => {
    const key = `${x},${y},${z}`;
    assert.ok(!cells.has(key), `doppelt ausgegeben: ${key}`);
    cells.add(key);
  });
  assert.equal(count, cells.size);
  return cells;
}

const parse = (key) => key.split(',').map(Number);
const NEIGHBORS_6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const NEIGHBORS_4 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

function extent(cells, axis) {
  const values = [...cells].map((k) => parse(k)[axis]);
  return [Math.min(...values), Math.max(...values)];
}

// Spiegel-Symmetrie um den Mittelpunkt c (je Achse)
function assertMirrorSymmetric(cells, center, axes) {
  for (const key of cells) {
    const p = parse(key);
    for (const axis of axes) {
      const q = [...p];
      q[axis] = 2 * center[axis] - p[axis];
      assert.ok(cells.has(q.join(',')), `nicht symmetrisch: ${key} ↔ ${q.join(',')}`);
    }
  }
}

// Kein innerer Block der vollen Form berührt mit einer Fläche den Außenraum; offene Enden zählen nicht als außen.
function assertTight(shell, solid, neighbors, { openBelow = Infinity, openAbove = -Infinity } = {}) {
  for (const key of solid) {
    if (shell.has(key)) continue;
    const [x, y, z] = parse(key);
    for (const [dx, dy, dz] of neighbors) {
      const ny = y + dy;
      if (ny < openBelow && dy < 0 && openBelow !== Infinity) continue;
      if (ny > openAbove && dy > 0 && openAbove !== -Infinity) continue;
      assert.ok(solid.has(`${x + dx},${ny},${z + dz}`), `Loch: innerer Block ${key} grenzt an außen`);
    }
  }
  for (const key of shell) assert.ok(solid.has(key), `Hülle außerhalb der Form: ${key}`);
}

test('Kreisscheibe: Durchmesser 2r+1, ganz und halb, symmetrisch', () => {
  const r3 = collect((emit) => shapes.disc(0, 0, 0, 3, {}, emit));
  assert.equal(r3.size, 37);
  assert.deepEqual(extent(r3, 0), [-3, 3]);
  assert.deepEqual(extent(r3, 2), [-3, 3]);
  assertMirrorSymmetric(r3, [0, 0, 0], [0, 2]);
  for (const key of r3) {
    const [x, , z] = parse(key);
    assert.ok(r3.has(`${z},0,${x}`), 'diagonal symmetrisch');
  }
  const even = collect((emit) => shapes.disc(2.5, 4, 2.5, 2.5, {}, emit));
  assert.equal(even.size, 32);
  assert.deepEqual(extent(even, 0), [0, 5]);
  assert.deepEqual(extent(even, 2), [0, 5]);
  assertMirrorSymmetric(even, [2.5, 4, 2.5], [0, 2]);
  assert.equal(shapes.spanCenter(0, 6), 2.5);
  assert.equal(shapes.spanRadius(6), 2.5);
  assert.equal(collect((emit) => shapes.disc(5, 0, 5, 0, {}, emit)).size, 1);
  assert.equal(collect((emit) => shapes.disc(5.5, 0, 5.5, 0.5, {}, emit)).size, 4);
});

test('Ringe (hohl) sind geschlossen, auch mit Dicke 2', () => {
  for (const [c, r] of [[0, 5], [0, 12], [3.5, 7.5], [0, 30]]) {
    const solid = collect((emit) => shapes.disc(c, 0, c, r, {}, emit));
    for (const thickness of [1, 2]) {
      const ring = collect((emit) => shapes.disc(c, 0, c, r, { hollow: true, thickness }, emit));
      assertTight(ring, solid, NEIGHBORS_4);
      assertMirrorSymmetric(ring, [c, 0, c], [0, 2]);
      assert.ok(ring.size < solid.size);
    }
  }
});

test('Ellipse: Halbachsen, Symmetrie, geschlossener Ring', () => {
  const e = collect((emit) => shapes.ellipse(0, 0, 0, 10, 2, {}, emit));
  assert.deepEqual(extent(e, 0), [-10, 10]);
  assert.deepEqual(extent(e, 2), [-2, 2]);
  assertMirrorSymmetric(e, [0, 0, 0], [0, 2]);
  const ring = collect((emit) => shapes.ellipse(0, 0, 0, 10, 2, { hollow: true }, emit));
  assertTight(ring, e, NEIGHBORS_4);
  const evenOdd = collect((emit) => shapes.ellipse(4.5, 0, 0, 4.5, 3, {}, emit));
  assert.deepEqual(extent(evenOdd, 0), [0, 9]);
  assertMirrorSymmetric(evenOdd, [4.5, 0, 0], [0, 2]);
});

test('Kugel: Symmetrie in allen Achsen, hohle Kugel 6-dicht', () => {
  const solid = collect((emit) => shapes.sphere(0, 0, 0, 6, {}, emit));
  assertMirrorSymmetric(solid, [0, 0, 0], [0, 1, 2]);
  for (const key of solid) {
    const [x, y, z] = parse(key);
    assert.ok(solid.has(`${y},${z},${x}`), 'Achsen vertauschbar');
  }
  for (const thickness of [1, 2]) {
    const shell = collect((emit) => shapes.sphere(0, 0, 0, 6, { hollow: true, thickness }, emit));
    assertTight(shell, solid, NEIGHBORS_6);
    assertMirrorSymmetric(shell, [0, 0, 0], [0, 1, 2]);
  }
  const big = collect((emit) => shapes.sphere(0.5, 0.5, 0.5, 20.5, {}, emit));
  const bigShell = collect((emit) => shapes.sphere(0.5, 0.5, 0.5, 20.5, { hollow: true }, emit));
  assert.deepEqual(extent(big, 1), [-20, 21]);
  assertTight(bigShell, big, NEIGHBORS_6);
  // Mindest-Hülle: jeder Hüllenblock berührt außen
  for (const key of bigShell) {
    const [x, y, z] = parse(key);
    assert.ok(NEIGHBORS_6.some(([dx, dy, dz]) => !big.has(`${x + dx},${y + dy},${z + dz}`)), key);
  }
});

test('Halbkugel (Kuppel): Äquator gehört dazu, hohle Kuppel ohne Boden', () => {
  const top = collect((emit) => shapes.sphere(0, 10, 0, 5, { part: 'top' }, emit));
  assert.deepEqual(extent(top, 1), [10, 15]);
  const bottom = collect((emit) => shapes.sphere(0, 10, 0, 5, { part: 'bottom' }, emit));
  assert.deepEqual(extent(bottom, 1), [5, 10]);
  const half = collect((emit) => shapes.sphere(0, 10.5, 0, 4.5, { part: 'top' }, emit));
  assert.deepEqual(extent(half, 1), [11, 15]);
  const dome = collect((emit) => shapes.sphere(0, 10, 0, 5, { part: 'top', hollow: true }, emit));
  assertTight(dome, top, NEIGHBORS_6, { openBelow: 10 });
  const floor = [...dome].filter((k) => parse(k)[1] === 10);
  const fullFloor = [...top].filter((k) => parse(k)[1] === 10);
  assert.ok(floor.length < fullFloor.length, 'unten offen');
  assert.ok(!dome.has('0,10,0'));
  assert.ok(dome.has('0,15,0'), 'Spitze geschlossen');
});

test('Zylinder: Rohr ohne Deckel, jede Ebene gleich', () => {
  const tube = collect((emit) => shapes.cylinder(0, 0, 0, 4, 5, { hollow: true }, emit));
  const ring = collect((emit) => shapes.disc(0, 0, 0, 4, { hollow: true }, emit));
  assert.equal(tube.size, ring.size * 5);
  assert.ok(!tube.has('0,0,0') && !tube.has('0,4,0'));
  const full = collect((emit) => shapes.cylinder(0, 2, 0, 4, 3, {}, emit));
  assert.deepEqual(extent(full, 1), [2, 4]);
});

test('Kegel: Radius von unten nach oben, hohler Mantel zwischen den Ebenen dicht', () => {
  const solid = collect((emit) => shapes.cone(0, 0, 0, 8, 0, 9, {}, emit));
  assert.deepEqual(extent(solid, 0), [-8, 8]);
  const topLayer = [...solid].filter((k) => parse(k)[1] === 8);
  assert.deepEqual(topLayer, ['0,8,0']);
  const shell = collect((emit) => shapes.cone(0, 0, 0, 8, 0, 9, { hollow: true }, emit));
  assertTight(shell, solid, NEIGHBORS_6, { openBelow: 0, openAbove: 8 });
  const steep = collect((emit) => shapes.cone(0, 0, 0, 12, 2, 4, {}, emit));
  const steepShell = collect((emit) => shapes.cone(0, 0, 0, 12, 2, 4, { hollow: true }, emit));
  assertTight(steepShell, steep, NEIGHBORS_6, { openBelow: 0, openAbove: 3 });
  assertMirrorSymmetric(steepShell, [0, 0, 0], [0, 2]);
});

test('Polygon: Rand gehört dazu, gerade-ungerade-Regel, hohle Umrisse dicht', () => {
  const rect = collect((emit) => shapes.polygon([[0, 0], [4, 0], [4, 3], [0, 3]], 2, {}, emit));
  assert.equal(rect.size, 20);
  const tri = collect((emit) => shapes.polygon([[0, 0], [6, 0], [0, 6]], 0, {}, emit));
  assert.equal(tri.size, 28); // 7 + 6 + … + 1, Diagonale inklusive
  assert.ok(tri.has('3,0,3') && !tri.has('4,0,3'));
  const star = collect((emit) => shapes.polygon([[0, -10], [6, 8], [-9, -3], [9, -3], [-6, 8]], 0, {}, emit));
  assert.ok(!star.has('0,0,0'), 'Mitte des Pentagramms ist nach gerade-ungerade außen');
  assert.ok(star.has('0,0,-8'));
  const outline = collect((emit) => shapes.polygon([[0, 0], [10, 0], [10, 6], [5, 10], [0, 6]], 0, { hollow: true }, emit));
  const filled = collect((emit) => shapes.polygon([[0, 0], [10, 0], [10, 6], [5, 10], [0, 6]], 0, {}, emit));
  assertTight(outline, filled, NEIGHBORS_4);
  const halfPoints = collect((emit) => shapes.polygon([[0.5, 0.5], [3.5, 0.5], [3.5, 2.5], [0.5, 2.5]], 0, {}, emit));
  assert.equal(halfPoints.size, 6);
  const walls = collect((emit) => shapes.prism([[0, 0], [4, 0], [4, 4], [0, 4]], 1, 3, { hollow: true }, emit));
  assert.equal(walls.size, 16 * 3);
});

test('Quader, Wände, Linien', () => {
  assert.equal(collect((emit) => shapes.box(0, 0, 0, 2, 2, 2, 'full', emit)).size, 27);
  assert.equal(collect((emit) => shapes.box(2, 2, 2, 0, 0, 0, 'hollow', emit)).size, 26);
  assert.equal(collect((emit) => shapes.box(0, 0, 0, 2, 2, 2, 'outline', emit)).size, 20);
  assert.equal(collect((emit) => shapes.box(0, 0, 0, 2, 2, 2, 'walls', emit)).size, 24);
  const line = collect((emit) => shapes.line(0, 0, 0, 7, 3, -2, emit));
  assert.equal(line.size, 8);
  assert.ok(line.has('0,0,0') && line.has('7,3,-2'));
  const back = collect((emit) => shapes.line(7, 3, -2, 0, 0, 0, emit));
  assert.deepEqual([...back].sort(), [...line].sort());
  assert.equal(collect((emit) => shapes.line(1, 1, 1, 1, 1, 1, emit)).size, 1);
});

test('Ungültige Formen-Parameter werfen verständliche Fehler', () => {
  const noop = () => {};
  assert.throws(() => shapes.disc(0.3, 0, 0, 2, {}, noop), /ganze oder halbe Zahl/);
  assert.throws(() => shapes.disc(0, 0, 0, -1, {}, noop), /radius/);
  assert.throws(() => shapes.disc(0, 0, 0, 2, { hollow: true, thickness: 0 }, noop), /thickness/);
  assert.throws(() => shapes.cylinder(0, 0, 0, 2, 0, {}, noop), /height/);
  assert.throws(() => shapes.sphere(0, 0, 0, 2, { part: 'left' }, noop), /part/);
  assert.throws(() => shapes.polygon([[0, 0], [1, 1]], 0, {}, noop), /mindestens 3 Punkte/);
});
