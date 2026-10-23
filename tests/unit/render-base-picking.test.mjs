import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raycastBlocks, rayFromScreen } from '../../js/render/picking.js';
import { mat4 } from '../../js/render/mat.js';
import { createRandom } from '../../js/core/random.js';

const blocks = (...cells) => {
  const set = new Set(cells.map((c) => c.join(',')));
  return (x, y, z) => set.has(`${x},${y},${z}`);
};
const close = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≠ ${expected}`);

test('achsenparallele Strahlen in alle sechs Richtungen', () => {
  const o = [0.5, 0.5, 0.5];
  const cases = [
    [[1, 0, 0], [5, 0, 0], 'west', [-1, 0, 0], 4.5],
    [[-1, 0, 0], [-3, 0, 0], 'east', [1, 0, 0], 2.5],
    [[0, 1, 0], [0, 7, 0], 'down', [0, -1, 0], 6.5],
    [[0, -1, 0], [0, -1, 0], 'up', [0, 1, 0], 0.5],
    [[0, 0, 1], [0, 0, 2], 'north', [0, 0, -1], 1.5],
    [[0, 0, -1], [0, 0, -9], 'south', [0, 0, 1], 8.5],
  ];
  for (const [dir, cell, face, normal, distance] of cases) {
    const hit = raycastBlocks(o, dir, 50, blocks(cell));
    assert.ok(hit, `kein Treffer für ${dir}`);
    assert.deepEqual([hit.x, hit.y, hit.z], cell);
    assert.equal(hit.face, face);
    assert.deepEqual(hit.normal.map((v) => v + 0), normal);
    close(hit.distance, distance);
    assert.equal(hit.inside, false);
    // Trefferpunkt liegt auf der getroffenen Seite
    for (let i = 0; i < 3; i++) close(hit.point[i], o[i] + dir[i] * distance);
  }
});

test('Start im Block, Start genau auf einer Seite, Richtung nicht normiert', () => {
  const inside = raycastBlocks([2.3, 0.7, -0.2], [0, 0, 1], 10, blocks([2, 0, -1]));
  assert.deepEqual([inside.x, inside.y, inside.z, inside.face, inside.normal, inside.distance, inside.inside], [2, 0, -1, null, null, 0, true]);

  // Ursprung genau auf der Ostseite von Block (1,0,0), Blick nach Westen
  const onFace = raycastBlocks([2, 0.5, 0.5], [-1, 0, 0], 10, blocks([1, 0, 0]));
  assert.deepEqual([onFace.x, onFace.face, onFace.distance, onFace.inside], [1, 'east', 0, false]);
  // Gleiche Stelle, Blick nach Osten: Block (1,0,0) liegt hinter dem Strahl
  assert.equal(raycastBlocks([2, 0.5, 0.5], [1, 0, 0], 10, blocks([1, 0, 0])), null);
  // Ursprung auf der Westseite von (2,0,0), Blick nach Osten
  const west = raycastBlocks([2, 0.5, 0.5], [1, 0, 0], 10, blocks([2, 0, 0]));
  assert.deepEqual([west.x, west.face, west.distance], [2, 'west', 0]);

  const scaled = raycastBlocks([0.5, 0.5, 0.5], [0, 0, 8], 10, blocks([0, 0, 4]));
  close(scaled.distance, 3.5);
});

test('Strahl entlang einer Gitterebene und durch eine Kante (feste Reihenfolge x, y, z)', () => {
  // y genau 1.0, waagrecht: der Strahl gehört zur oberen Zellreihe (floor)
  const along = raycastBlocks([0.5, 1, 0.5], [1, 0, 0], 10, blocks([3, 1, 0], [3, 0, 0]));
  assert.deepEqual([along.x, along.y, along.z], [3, 1, 0]);
  // diagonal genau durch die Kante bei (1, 1): erst x, dann y
  const visited = [];
  const edge = raycastBlocks([0.5, 0.5, 0.5], [1, 1, 0], 3, (x, y, z) => {
    visited.push([x, y, z]);
    return x === 1 && y === 1;
  });
  assert.deepEqual(visited, [[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
  assert.equal(edge.face, 'down');
  close(edge.distance, Math.SQRT1_2);
});

test('maxDistance: Treffer genau an der Grenze zählt, dahinter nicht', () => {
  assert.ok(raycastBlocks([0.5, 0.5, 0.5], [1, 0, 0], 4.5, blocks([5, 0, 0])));
  assert.equal(raycastBlocks([0.5, 0.5, 0.5], [1, 0, 0], 4.49, blocks([5, 0, 0])), null);
  assert.equal(raycastBlocks([0.5, 0.5, 0.5], [1, 0, 0], 0, blocks([5, 0, 0])), null);
  assert.equal(raycastBlocks([0.5, 0.5, 0.5], [1, 1, 1], 100, () => false), null);
});

test('ungültige Eingaben werfen verständliche Fehler', () => {
  assert.throws(() => raycastBlocks([0, 0, 0], [0, 0, 0], 10, () => false), /\(0, 0, 0\)/);
  assert.throws(() => raycastBlocks([0, NaN, 0], [1, 0, 0], 10, () => false), /Ursprung/);
  assert.throws(() => raycastBlocks([0, 0, 0], [1, 0, 0], Infinity, () => false), /maxDistance/);
  assert.throws(() => raycastBlocks([0, 0, 0], [1, 0, 0], 10, null), /isHit/);
});

// Referenz: sehr feines Abtasten entlang des Strahls.
function sampleFirstCell(origin, dir, maxDistance, isHit) {
  const len = Math.hypot(...dir);
  const d = dir.map((v) => v / len);
  for (let t = 0; t <= maxDistance; t += 0.0005) {
    const x = Math.floor(origin[0] + d[0] * t), y = Math.floor(origin[1] + d[1] * t), z = Math.floor(origin[2] + d[2] * t);
    if (isHit(x, y, z)) return { x, y, z, t };
  }
  return null;
}

test('zufällige Strahlen stimmen mit feinem Abtasten überein (auch negative Koordinaten)', () => {
  const rng = createRandom('picking');
  const filled = new Set();
  for (let i = 0; i < 900; i++) filled.add(`${rng.int(-8, 8)},${rng.int(-8, 8)},${rng.int(-8, 8)}`);
  const isHit = (x, y, z) => filled.has(`${x},${y},${z}`);
  let compared = 0;
  for (let i = 0; i < 300; i++) {
    const origin = [rng.next() * 6 - 3, rng.next() * 6 - 3, rng.next() * 6 - 3];
    const dir = [rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1];
    if (Math.hypot(...dir) < 0.1) continue;
    const hit = raycastBlocks(origin, dir, 20, isHit);
    const ref = sampleFirstCell(origin, dir, 20, isHit);
    if (!ref) {
      assert.equal(hit, null);
      continue;
    }
    assert.ok(hit, 'DDA verpasst einen Block');
    assert.ok(Math.abs(hit.distance - ref.t) < 0.002, `Abstand ${hit.distance} statt ≈ ${ref.t}`);
    assert.deepEqual([hit.x, hit.y, hit.z], [ref.x, ref.y, ref.z]);
    if (!hit.inside) {
      // Normale zeigt dem Strahl entgegen
      const len = Math.hypot(...dir);
      assert.ok(hit.normal[0] * dir[0] / len + hit.normal[1] * dir[1] / len + hit.normal[2] * dir[2] / len < 0);
    }
    compared++;
  }
  assert.ok(compared > 100);
});

test('rayFromScreen: Bildmitte = Blickrichtung, Ränder nach Sichtwinkel', () => {
  const view = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0]);
  for (const far of [100, Infinity]) {
    const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, far);
    const inv = mat4.invert(mat4.create(), mat4.multiply(mat4.create(), proj, view));
    const center = rayFromScreen(inv, 0, 0);
    for (let i = 0; i < 3; i++) close(center.origin[i], [0, 0, 4.9][i], 1e-4);
    for (let i = 0; i < 3; i++) close(center.direction[i], [0, 0, -1][i], 1e-5);
    // rechter Rand bei 90°: 45° nach rechts
    const right = rayFromScreen(inv, 1, 0);
    close(right.direction[0], Math.SQRT1_2, 1e-4);
    close(right.direction[2], -Math.SQRT1_2, 1e-4);
  }
  const ortho = mat4.ortho(mat4.create(), -10, 10, -10, 10, 0.1, 50);
  const invOrtho = mat4.invert(mat4.create(), mat4.multiply(mat4.create(), ortho, view));
  const ray = rayFromScreen(invOrtho, 0.5, -0.5);
  for (let i = 0; i < 3; i++) close(ray.direction[i], [0, 0, -1][i], 1e-5);
  close(ray.origin[0], 5, 1e-4);
  close(ray.origin[1], -5, 1e-4);
  assert.throws(() => rayFromScreen(invOrtho, NaN, 0), /endliche/);
});
