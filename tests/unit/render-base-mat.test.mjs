import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mat4, vec3, frustumPlanes, aabbInFrustum } from '../../js/render/mat.js';

const close = (actual, expected, eps = 1e-5, label = '') => {
  assert.ok(Math.abs(actual - expected) <= eps, `${label} ${actual} ≠ ${expected} (±${eps})`);
};
const closeArray = (actual, expected, eps = 1e-5) => {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) close(actual[i], expected[i], eps, `[${i}]`);
};

test('identity, copy und multiply (auch mit out = a)', () => {
  const id = mat4.create();
  closeArray(id, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const t = mat4.fromTranslation(mat4.create(), [1, 2, 3]);
  const s = Float32Array.from([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1]);
  const ts = mat4.multiply(mat4.create(), t, s);
  // erst skalieren, dann verschieben
  closeArray(mat4.transformPoint([0, 0, 0], ts, [1, 1, 1]), [3, 5, 7]);
  const st = mat4.multiply(mat4.create(), s, t);
  closeArray(mat4.transformPoint([0, 0, 0], st, [1, 1, 1]), [4, 9, 16]);
  const aliased = mat4.copy(mat4.create(), t);
  mat4.multiply(aliased, aliased, s);
  closeArray(aliased, ts);
  closeArray(mat4.multiply(mat4.create(), ts, id), ts);
});

test('invert ergibt die Inverse, singuläre Matrix → null', () => {
  const view = mat4.lookAt(mat4.create(), [3, 4, 5], [0, 1, 0], [0, 1, 0]);
  const proj = mat4.perspective(mat4.create(), 1.1, 1.5, 0.1, 500);
  const vp = mat4.multiply(mat4.create(), proj, view);
  const inv = mat4.invert(mat4.create(), vp);
  assert.ok(inv);
  closeArray(mat4.multiply(mat4.create(), vp, inv), mat4.create(), 1e-4);
  const singular = new Float32Array(16);
  const out = mat4.create();
  assert.equal(mat4.invert(out, singular), null);
  closeArray(out, mat4.create());
});

test('lookAt: Auge im Ursprung, Ziel auf −z, oben bleibt oben', () => {
  const view = mat4.lookAt(mat4.create(), [10, 2, 0], [0, 2, 0], [0, 1, 0]);
  closeArray(mat4.transformPoint([0, 0, 0], view, [10, 2, 0]), [0, 0, 0]);
  closeArray(mat4.transformPoint([0, 0, 0], view, [0, 2, 0]), [0, 0, -10]);
  closeArray(mat4.transformDirection([0, 0, 0], view, [0, 1, 0]), [0, 1, 0]);
  // Blick nach −x: Norden (−z) liegt rechts
  closeArray(mat4.transformDirection([0, 0, 0], view, [0, 0, -1]), [1, 0, 0]);
  assert.throws(() => mat4.lookAt(mat4.create(), [1, 1, 1], [1, 1, 1], [0, 1, 0]), /gleich/);
  assert.throws(() => mat4.lookAt(mat4.create(), [0, 5, 0], [0, 0, 0], [0, 1, 0]), /parallel/);
});

test('perspective: nahe Ebene → z −1, ferne → +1, unendlich ferne Ebene', () => {
  const near = 0.5, far = 100;
  const p = mat4.perspective(mat4.create(), Math.PI / 2, 2, near, far);
  close(mat4.transformPoint([0, 0, 0], p, [0, 0, -near])[2], -1);
  close(mat4.transformPoint([0, 0, 0], p, [0, 0, -far])[2], 1, 1e-4);
  // 90° senkrecht: Punkt auf der oberen Kante bei y = −z
  close(mat4.transformPoint([0, 0, 0], p, [0, 10, -10])[1], 1);
  close(mat4.transformPoint([0, 0, 0], p, [20, 0, -10])[0], 1);
  const inf = mat4.perspective(mat4.create(), 1, 1, 0.1, Infinity);
  close(mat4.transformPoint([0, 0, 0], inf, [0, 0, -0.1])[2], -1);
  const z = mat4.transformPoint([0, 0, 0], inf, [0, 0, -1e6])[2];
  assert.ok(z < 1 && z > 0.9999);
  assert.throws(() => mat4.perspective(mat4.create(), 0, 1, 0.1, 10), /ungültig/);
  assert.throws(() => mat4.perspective(mat4.create(), 1, 1, 1, 0.5), /ungültig/);
});

test('ortho bildet die Grenzen auf ±1 ab', () => {
  const o = mat4.ortho(mat4.create(), -4, 6, -1, 3, 1, 21);
  closeArray(mat4.transformPoint([0, 0, 0], o, [-4, -1, -1]), [-1, -1, -1]);
  closeArray(mat4.transformPoint([0, 0, 0], o, [6, 3, -21]), [1, 1, 1]);
  closeArray(mat4.transformVec4([0, 0, 0, 0], o, [1, 1, -11, 1]), [0, 0, 0, 1]);
  assert.throws(() => mat4.ortho(mat4.create(), 1, 1, 0, 1, 0, 1), /gleich/);
});

test('vec3-Helfer', () => {
  const a = vec3.create(1, 2, 3);
  const b = vec3.create(-2, 0.5, 4);
  closeArray(vec3.add(vec3.create(), a, b), [-1, 2.5, 7]);
  closeArray(vec3.sub(vec3.create(), a, b), [3, 1.5, -1]);
  closeArray(vec3.scaleAndAdd(vec3.create(), a, b, 2), [-3, 3, 11]);
  close(vec3.dot(a, b), -2 + 1 + 12);
  closeArray(vec3.cross(vec3.create(), [1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  closeArray(vec3.normalize(vec3.create(), [0, 0, 0]), [0, 0, 0]);
  close(vec3.length(vec3.normalize(vec3.create(), b)), 1);
  closeArray(vec3.lerp(vec3.create(), [0, 0, 0], [10, -10, 4], 0.25), [2.5, -2.5, 1]);
  close(vec3.distance([1, 1, 1], [4, 5, 1]), 5);
  // cross mit out = a
  const c = vec3.create(0, 1, 0);
  vec3.cross(c, c, [0, 0, 1]);
  closeArray(c, [1, 0, 0]);
});

test('Frustum: Boxen vor, hinter, neben der Kamera', () => {
  const view = mat4.lookAt(mat4.create(), [0, 0, 0], [0, 0, -1], [0, 1, 0]);
  const proj = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 100);
  const planes = frustumPlanes(new Float32Array(24), mat4.multiply(mat4.create(), proj, view));
  for (let i = 0; i < 6; i++) close(Math.hypot(planes[i * 4], planes[i * 4 + 1], planes[i * 4 + 2]), 1);
  assert.equal(aabbInFrustum(planes, -1, -1, -11, 1, 1, -9), true, 'vor der Kamera');
  assert.equal(aabbInFrustum(planes, -1, -1, 5, 1, 1, 7), false, 'hinter der Kamera');
  assert.equal(aabbInFrustum(planes, 30, -1, -11, 32, 1, -9), false, 'weit rechts außerhalb');
  assert.equal(aabbInFrustum(planes, 9, -1, -11, 12, 1, -9), true, 'ragt an der rechten Kante hinein');
  assert.equal(aabbInFrustum(planes, -1, -1, -300, 1, 1, -200), false, 'hinter der fernen Ebene');
  assert.equal(aabbInFrustum(planes, -1, -1, -1, 1, 1, 1), true, 'Kamera in der Box');
  // unendlich ferne Ebene: alles weit vorne bleibt sichtbar
  const infPlanes = frustumPlanes(new Float32Array(24), mat4.multiply(mat4.create(), mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, Infinity), view));
  assert.equal(aabbInFrustum(infPlanes, -1, -1, -1e6, 1, 1, -1e6 + 2), true);
  assert.equal(aabbInFrustum(infPlanes, -1, -1, 5, 1, 1, 7), false);
});
