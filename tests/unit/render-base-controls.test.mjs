import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS, PLAYER, createPlayer, tickPlayer, modifyInput, lookVector, playerEye, firstPersonViewMatrix,
  sweepAxis, collideWithBoxes, collideMovement, collectBoxes, createDoubleTap, playerBox,
  createOrbit, orbitEye, orbitPan, orbitRotate, orbitZoom, orbitViewMatrix, orbitFitDistance, approachOrbit, ORBIT_PITCH_LIMIT, DEG,
} from '../../js/render/controls.js';
import { mat4 } from '../../js/render/mat.js';

const close = (actual, expected, eps, label = '') => assert.ok(Math.abs(actual - expected) <= eps, `${label} ${actual} ≠ ${expected} (±${eps})`);
const FULL = [[0, 0, 0, 1, 1, 1]];
const SLAB = [[0, 0, 0, 1, 0.5, 1]];

// Welt aus einer Tabelle "x,y,z" → Boxen; optional unendlicher Boden unter y = 0.
function world(cells = {}, { floor = true } = {}) {
  return {
    collisionBoxes(x, y, z) {
      const key = `${x},${y},${z}`;
      if (cells[key]) return cells[key];
      return floor && y < 0 ? FULL : null;
    },
  };
}

function run(player, w, input, ticks) {
  const positions = [];
  for (let i = 0; i < ticks; i++) {
    tickPlayer(player, typeof input === 'function' ? input(i) : input, w);
    positions.push([player.x, player.y, player.z]);
  }
  return positions;
}

const speedOf = (positions, axis = 2) => (positions.at(-1)[axis] - positions.at(-2)[axis]) * 20;

test('Endgeschwindigkeiten wie Java: Gehen, Sprinten, Schleichen, Fliegen, senkrecht fliegen', () => {
  const w = world();
  close(speedOf(run(createPlayer({ position: [0.5, 0, 0.5] }), w, { forward: 1 }, 200)), 4.3172, 0.001, 'Gehen');
  close(speedOf(run(createPlayer({ position: [0.5, 0, 0.5] }), w, { forward: 1, sprint: true }, 200)), 5.6123, 0.001, 'Sprinten');
  close(speedOf(run(createPlayer({ position: [0.5, 0, 0.5] }), w, { forward: 1, sneak: true }, 200)), 1.2952, 0.001, 'Schleichen');
  // 0,05 · 0,98 / (1 − 0,91) · 20 = 10,89 (oft zitiert: 10,92)
  close(speedOf(run(createPlayer({ position: [0.5, 50, 0.5], flying: true }), w, { forward: 1 }, 200)), 10.889, 0.01, 'Fliegen');
  // Dauerhaft gehalten = nur ein Tastendruck (kein Doppeltipp)
  const up = run(createPlayer({ position: [0.5, 50, 0.5], flying: true }), w, { jump: true }, 120);
  close(speedOf(up, 1), 7.5, 0.01, 'Hochfliegen');
  const down = run(createPlayer({ position: [0.5, 200, 0.5], flying: true }), w, { sneak: true }, 120);
  close(speedOf(down, 1), -7.5, 0.01, 'Runterfliegen');
});

test('Blickrichtung (yaw 0 = Süden) und Bewegung in Blickrichtung', () => {
  const v = (yaw, pitch) => lookVector(yaw, pitch).map((c) => Math.round(c * 1e6) / 1e6 + 0);
  assert.deepEqual(v(0, 0), [0, 0, 1]);
  assert.deepEqual(v(90, 0), [-1, 0, 0]);
  assert.deepEqual(v(-90, 0), [1, 0, 0]);
  assert.deepEqual(v(180, 0), [0, 0, -1]);
  assert.deepEqual(v(0, 90), [0, -1, 0]);
  const east = createPlayer({ position: [0.5, 0, 0.5], yaw: -90 });
  run(east, world(), { forward: 1 }, 40);
  assert.ok(east.x > 6 && Math.abs(east.z - 0.5) < 1e-9);
  const strafe = createPlayer({ position: [0.5, 0, 0.5], yaw: 0 });
  run(strafe, world(), { left: 1 }, 40);
  assert.ok(strafe.x > 6, 'links von Süden aus = Osten');
});

test('modifyInput: ×0,98, Diagonale auf Länge 1, Schleichen ×0,3', () => {
  assert.deepEqual(modifyInput(0, 0, false), [0, 0]);
  const [x0, y0] = modifyInput(0, 1, false);
  close(x0, 0, 1e-12); close(y0, 0.98, 1e-12);
  const [x1, y1] = modifyInput(Math.SQRT1_2, Math.SQRT1_2, false);
  close(Math.hypot(x1, y1), 1, 1e-9);
  const [, y2] = modifyInput(0, 1, true);
  close(y2, 0.294, 1e-12);
  const [x3, y3] = modifyInput(3, 4, false);
  close(Math.hypot(x3, y3), 0.98 * Math.sqrt(1 + (3 / 4) ** 2) > 1 ? 1 : 0.98 * Math.sqrt(1 + (3 / 4) ** 2), 1e-9);
});

test('Sprung: Scheitel ≈ 1,2522 Blöcke, 12 Ticks Flugzeit, Halten springt erst nach der Landung erneut', () => {
  const player = createPlayer({ position: [0.5, 0, 0.5] });
  const w = world();
  run(player, w, {}, 3);
  assert.equal(player.onGround, true);
  const heights = run(player, w, { jump: true }, 40).map((p) => p[1]);
  close(Math.max(...heights.slice(0, 12)), 1.2522, 0.0005, 'Scheitel');
  const landing = heights.findIndex((y, i) => i > 0 && y === 0);
  assert.equal(landing, 11, 'Landung im 12. Tick');
  assert.ok(heights[12] > 0, 'springt nach der Landung wieder ab');
});

test('Fallen folgt Schwerkraft 0,08 und Luftwiderstand 0,98', () => {
  const player = createPlayer({ position: [0.5, 100, 0.5] });
  const ys = run(player, world({}, { floor: false }), {}, 4).map((p) => p[1]);
  let v = 0, y = 100;
  const expected = [];
  for (let i = 0; i < 4; i++) {
    y += v;
    expected.push(y);
    v = (v - PHYSICS.gravity) * PHYSICS.verticalDrag;
  }
  ys.forEach((value, i) => close(value, expected[i], 1e-9, `Tick ${i}`));
});

test('Aufsteigen auf Stufen (0,5) ohne Sprung, volle Blöcke und Mauern blockieren', () => {
  const cells = {};
  for (let z = 2; z < 12; z++) cells[`0,0,${z}`] = SLAB;
  const onSlab = createPlayer({ position: [0.5, 0, 0.5] });
  run(onSlab, world(cells), { forward: 1 }, 40);
  assert.ok(onSlab.z > 4);
  assert.equal(onSlab.y, 0.5);

  const wall = createPlayer({ position: [0.5, 0, 0.5] });
  run(wall, world({ '0,0,4': FULL, '0,1,4': FULL }), { forward: 1 }, 60);
  close(wall.z, 4 - PLAYER.width / 2, 1e-6, 'steht vor der Wand');
  assert.equal(wall.y, 0);
  assert.equal(wall.horizontalCollision, true);

  const platform = {};
  for (let z = 4; z < 40; z++) platform[`0,0,${z}`] = FULL;
  const block = createPlayer({ position: [0.5, 0, 0.5] });
  run(block, world(platform), { forward: 1 }, 60);
  assert.equal(block.y, 0, 'ein ganzer Block ist zu hoch zum Aufsteigen');
  close(block.z, 3.7, 1e-6);
  run(block, world(platform), { forward: 1, jump: true }, 8);
  run(block, world(platform), { forward: 1 }, 20);
  assert.equal(block.y, 1, 'mit Sprung oben');
  assert.ok(block.z > 4.5);
});

test('Zaun (1,5 hoch) wird auch von der Zelle darunter gefunden', () => {
  const fence = { '0,0,0': [[0.375, 0, 0.375, 0.625, 1.5, 0.625]] };
  const boxes = collectBoxes(world(fence), playerBox(0.5, 1.2, 0.5));
  assert.ok(boxes.some((b) => b[4] === 1.5));
  const player = createPlayer({ position: [0.5, 3, 0.5] });
  run(player, world(fence), {}, 40);
  close(player.y, 1.5, 1e-9);
  assert.equal(player.onGround, true);
});

test('Gleiten an der Wand bei schrägem Lauf', () => {
  const cells = {};
  for (let x = -5; x < 20; x++) cells[`${x},0,3`] = FULL;
  const player = createPlayer({ position: [0.5, 0, 0.5], yaw: -45 });
  run(player, world(cells), { forward: 1 }, 40);
  close(player.z, 3 - 0.3, 1e-6);
  assert.ok(player.x > 4, 'läuft an der Wand entlang weiter');
});

test('Schleichen: nicht von der Kante fallen; ohne Schleichen fallen', () => {
  const cells = {};
  for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) cells[`${x},-1,${z}`] = FULL;
  const sneaker = createPlayer({ position: [1, 0, 1], yaw: -90 });
  run(sneaker, world(cells, { floor: false }), { forward: 1, sneak: true }, 80);
  assert.equal(sneaker.y, 0);
  assert.ok(sneaker.x > 2 && sneaker.x < 2 + PLAYER.width / 2, `x = ${sneaker.x}`);
  const walker = createPlayer({ position: [1, 0, 1], yaw: -90 });
  run(walker, world(cells, { floor: false }), { forward: 1 }, 80);
  assert.ok(walker.y < -5);
});

test('Schleichen unter niedriger Decke bleibt geduckt, Augenhöhe gleitet', () => {
  const ceiling = { '0,1,0': [[0, 0.5, 0, 1, 1, 1]] };
  const player = createPlayer({ position: [0.5, 0, 0.5] });
  run(player, world(ceiling), { sneak: true }, 4);
  assert.equal(player.sneaking, true);
  close(player.eyeHeight, PLAYER.sneakEyeHeight, 0.03);
  run(player, world(ceiling), {}, 4);
  assert.equal(player.sneaking, true, 'kein Platz zum Aufstehen');
  const free = createPlayer({ position: [0.5, 0, 0.5] });
  run(free, world(), { sneak: true }, 4);
  run(free, world(), {}, 1);
  assert.equal(free.sneaking, false);
  assert.ok(free.eyeHeight > PLAYER.sneakEyeHeight && free.eyeHeight < PLAYER.eyeHeight, 'Augenhöhe wird geglättet');
});

test('Doppel-Leertaste schaltet Fliegen (innerhalb von 7 Ticks), Landen beendet das Fliegen', () => {
  const w = world();
  const player = createPlayer({ position: [0.5, 0, 0.5] });
  run(player, w, {}, 3);
  run(player, w, (i) => ({ jump: i === 0 || i === 3 }), 4);
  assert.equal(player.flying, true);
  run(player, w, { sneak: true }, 60);
  assert.equal(player.flying, false, 'beim Aufsetzen endet das Fliegen');
  assert.equal(player.y, 0);

  const slow = createPlayer({ position: [0.5, 0, 0.5] });
  run(slow, w, {}, 3);
  run(slow, w, (i) => ({ jump: i === 0 || i === 7 }), 8);
  assert.equal(slow.flying, false, 'zu langsam getippt');

  const button = createPlayer({ position: [0.5, 0, 0.5] });
  run(button, w, {}, 3);
  run(button, w, (i) => ({ toggleFly: i === 0 }), 6);
  assert.equal(button.flying, true, 'Fliegen-Knopf am Boden springt ab und fliegt');
  assert.ok(button.y > 0.5);

  const noFly = createPlayer({ position: [0.5, 0, 0.5] });
  run(noFly, w, {}, 3);
  for (let i = 0; i < 4; i++) tickPlayer(noFly, { jump: i === 0 || i === 2 }, w, { mayFly: false });
  assert.equal(noFly.flying, false);
});

test('Sprinten per Doppeltipp vorwärts; endet beim Loslassen und bei Wandkontakt', () => {
  const w = world();
  const player = createPlayer({ position: [0.5, 0, 0.5] });
  run(player, w, {}, 3);
  run(player, w, (i) => ({ forward: i === 1 ? 0 : 1 }), 6);
  assert.equal(player.sprinting, true);
  run(player, w, {}, 1);
  assert.equal(player.sprinting, false);
  const walled = createPlayer({ position: [0.5, 0, 0.5] });
  run(walled, world({ '0,0,3': FULL, '0,1,3': FULL }), { forward: 1, sprint: true }, 40);
  assert.equal(walled.sprinting, false);
});

test('Sturz ins Leere: unter voidY wird Fliegen eingeschaltet', () => {
  const player = createPlayer({ position: [0.5, 0, 0.5] });
  for (let i = 0; i < 200; i++) tickPlayer(player, {}, world({}, { floor: false }), { voidY: -20 });
  assert.equal(player.flying, true);
  assert.ok(player.y >= -20.5);
});

test('Interpolation der Augenposition und Blickmatrix', () => {
  const player = createPlayer({ position: [0, 0, 0] });
  player.prevX = 0; player.x = 1;
  player.prevEyeHeight = PLAYER.eyeHeight; player.eyeHeight = PLAYER.eyeHeight;
  const eye = playerEye(player, 0.5);
  close(eye[0], 0.5, 1e-12);
  close(eye[1], 1.62, 1e-12);
  const view = firstPersonViewMatrix(mat4.create(), [0, 1.62, 0], 0, 0);
  const p = mat4.transformPoint([0, 0, 0], view, [0, 1.62, 1]);
  close(p[2], -1, 1e-6);
});

test('Kollisions-Grundlagen: Strecke bis zur Fläche, Berühren blockiert nicht, Überlappung lässt heraus', () => {
  const box = [0, 0, 0, 1, 1, 1];
  assert.equal(sweepAxis(0, box, [[2, 0, 0, 3, 1, 1]], 2), 1);
  assert.equal(sweepAxis(0, box, [[2, 0, 0, 3, 1, 1]], 0.5), 0.5);
  assert.equal(sweepAxis(1, box, [[1, 0, 0, 2, 1, 1]], 3), 3, 'nur berührt');
  assert.equal(sweepAxis(0, box, [[0.5, 0, 0, 1.5, 1, 1]], 2), 2, 'steckt schon drin');
  assert.equal(sweepAxis(0, box, [[-3, 0, 0, -1, 1, 1]], -5), -1);
  const slide = collideWithBoxes(box, [0.5, 0, 2], [[-10, 0, 1.5, 10, 1, 2]]);
  assert.deepEqual(slide, [0.5, 0, 0.5]);
  const step = collideMovement(world({ '1,0,0': SLAB }), playerBox(0.5, 0, 0.5), [0.6, -0.0784, 0], { onGround: true });
  close(step[1], 0.5, 1e-9, 'steigt auf die Stufe');
  close(step[0], 0.6, 1e-9);
});

test('Doppeltipp-Fenster: zweiter Druck nach 1 … 6 Ticks löst aus, nach 7 nicht', () => {
  for (const [gap, expected] of [[1, true], [6, true], [7, false]]) {
    const tap = createDoubleTap(7);
    assert.equal(tap.step(true), false);
    for (let i = 1; i < gap; i++) tap.step(false);
    assert.equal(tap.step(true), expected, `Abstand ${gap}`);
  }
});

test('Orbit: Augenposition, Grenzen, Drehen über ±180°', () => {
  const orbit = createOrbit({ target: [1, 2, 3], distance: 10, yaw: 0, pitch: 0 });
  assert.deepEqual(orbitEye(orbit).map((v) => Math.round(v * 1e9) / 1e9), [1, 2, 13]);
  orbitRotate(orbit, 90 * DEG, 0);
  assert.deepEqual(orbitEye(orbit).map((v) => Math.round(v * 1e9) / 1e9), [11, 2, 3]);
  orbitRotate(orbit, 0, 200 * DEG);
  assert.equal(orbit.pitch, ORBIT_PITCH_LIMIT);
  orbitRotate(orbit, 200 * DEG, 0);
  assert.ok(orbit.yaw > -Math.PI && orbit.yaw <= Math.PI);
  close(orbit.yaw, -70 * DEG, 1e-9);
  orbitZoom(orbit, 1e9);
  assert.equal(orbit.distance, orbit.maxDistance);
  orbitZoom(orbit, 1e-12);
  assert.equal(orbit.distance, orbit.minDistance);
  assert.throws(() => orbitZoom(orbit, 0), /Faktor/);
  assert.throws(() => createOrbit({ minDistance: 0 }), /Abstand/);
});

test('Orbit: Verschieben lässt den alten Zielpunkt dem Zeiger folgen', () => {
  const fovY = 70 * DEG, height = 600, aspect = 1.5;
  const orbit = createOrbit({ target: [4, 1, -2], distance: 25, yaw: 30 * DEG, pitch: 25 * DEG });
  const oldTarget = [...orbit.target];
  orbitPan(orbit, 50, -20, height, fovY);
  const proj = mat4.perspective(mat4.create(), fovY, aspect, 0.1, 1000);
  const vp = mat4.multiply(mat4.create(), proj, orbitViewMatrix(mat4.create(), orbit));
  const ndc = mat4.transformPoint([0, 0, 0], vp, oldTarget);
  close(ndc[0] * (height * aspect) / 2, 50, 0.01, 'x in Pixeln');
  close(-ndc[1] * height / 2, -20, 0.01, 'y in Pixeln (nach unten positiv)');
});

test('Orbit: Einpassen und weiches Nachführen (kurzer Weg über ±180°)', () => {
  const fovY = 60 * DEG;
  const d = orbitFitDistance(10, fovY, 0.5);
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * 0.5);
  close(Math.asin(10 / d), fovX / 2, 1e-9);
  const current = createOrbit({ yaw: 170 * DEG, distance: 10 });
  const goal = createOrbit({ yaw: -170 * DEG, distance: 20, target: [5, 0, 0] });
  approachOrbit(current, goal, 16, 70);
  assert.ok(current.yaw > 170 * DEG || current.yaw < -170 * DEG, 'dreht über ±180° statt zurück');
  let frames = 0;
  while (approachOrbit(current, goal, 16, 70) && frames < 1000) frames++;
  assert.ok(frames < 200);
  close(current.yaw, goal.yaw, 1e-9);
  close(current.distance, 20, 1e-9);
  const snap = createOrbit({ yaw: 0 });
  assert.equal(approachOrbit(snap, goal, 16, 0), false);
  assert.deepEqual(snap.target, goal.target);
});
