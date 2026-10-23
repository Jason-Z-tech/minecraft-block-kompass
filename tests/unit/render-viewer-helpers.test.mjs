// Reine Teile der 3D-Ansicht in Node: Fortschritt, Kamera-Einpassung, Plopp-Kurve, Shader-Quellen,
// Fehler ohne WebGL2, Testseite (CSP, keine Inline-Skripte) und die Argumente von scripts/shot.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Viewer, ViewerError, VIEWS, ORBIT_FOV, splitProgress, isStepShown, sceneBounds, fitOrbitDistance, orbitForView } from '../../js/render/renderer.js';
import { ATTRIBUTES, BLOCK_VERTEX, BLOCK_FRAGMENT, SKY_VERTEX, SKY_FRAGMENT, GRID_VERTEX, GRID_FRAGMENT, LINE_VERTEX, LINE_FRAGMENT, plopScale, PLOP_SPREAD, PLOP_DURATION } from '../../js/render/shaders.js';
import { orbitEye } from '../../js/render/controls.js';
import { mat4 } from '../../js/render/mat.js';
import { TextureStore, createImage, encodePng } from '../../js/render/texture-store.js';
import { CONTENT_SECURITY_POLICY } from '../../scripts/serve.mjs';
import { parseArgs, UsageError } from '../../scripts/shot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('Fortschritt: Schritt als Kommazahl → laufender Schritt und Anteil', () => {
  assert.deepEqual(splitProgress(0, 10), { cur: 0, frac: 0 });
  const { cur, frac } = splitProgress(12.4, 40);
  assert.equal(cur, 12);
  assert.ok(Math.abs(frac - 0.4) < 1e-9);
  assert.deepEqual(splitProgress(40, 40), { cur: 40, frac: 0 }, 'fertig: kein laufender Schritt');
  assert.deepEqual(splitProgress(-3, 10), { cur: 0, frac: 0 });
  assert.deepEqual(splitProgress(99, 10), { cur: 10, frac: 0 });
  assert.deepEqual(splitProgress(0.5, 0), { cur: 0, frac: 0 }, 'ohne Schritte');
  assert.equal(isStepShown(3, 4, 0), true);
  assert.equal(isStepShown(4, 4, 0), false, 'Schritt 4 zu 0 % ist noch nicht gesetzt');
  assert.equal(isStepShown(4, 4, 0.01), true);
  assert.equal(isStepShown(5, 4, 0.99), false);
});

test('Plopp-Kurve: EaseOutBack je Block nach Reihenfolge, am Schrittende alles voll', () => {
  assert.equal(PLOP_SPREAD + PLOP_DURATION, 1);
  assert.equal(plopScale(0, 0), 0);
  assert.equal(plopScale(1, 1), 1);
  assert.equal(plopScale(1, 0.5), 1);
  assert.equal(plopScale(PLOP_SPREAD, 1), 0, 'letzter Block startet erst bei 70 %');
  const samples = Array.from({ length: 31 }, (_, i) => plopScale(i / 100, 0));
  assert.ok(Math.max(...samples) > 1.05, 'überschwingt kurz');
  assert.ok(samples.every((v, i) => i === 0 || v >= 0), 'nie negativ');
  assert.equal(plopScale(0.01, 0, false), 1, 'ohne Animation sofort voll');
  assert.equal(plopScale(0, 0, false), 0);
});

test('Begrenzungsbox und Kamera-Einpassung: alle Ecken im Bild, Box mittig', () => {
  assert.equal(sceneBounds(null).empty, true);
  const bounds = sceneBounds({ min: [0, 0, 0], max: [46, 3, 20] });
  assert.deepEqual(bounds.max, [47, 4, 21]);
  assert.deepEqual(bounds.center, [23.5, 2, 10.5]);
  for (const aspect of [16 / 9, 0.6, 1]) {
    for (const view of VIEWS) {
      const orbit = orbitForView(view, bounds, aspect);
      const eye = orbitEye({ ...orbit });
      const viewMatrix = mat4.lookAt(mat4.create(), eye, orbit.target, [0, 1, 0]);
      const projection = mat4.perspective(mat4.create(), ORBIT_FOV, aspect, 0.1, Infinity);
      const viewProj = mat4.multiply(mat4.create(), projection, viewMatrix);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < 8; i++) {
        const corner = [0, 1, 2].map((a) => ((i >> a) & 1 ? bounds.max[a] : bounds.min[a]));
        const p = mat4.transformPoint([0, 0, 0], viewProj, corner);
        assert.ok(Math.abs(p[0]) <= 1.0001 && Math.abs(p[1]) <= 1.0001, `${view} ${aspect.toFixed(2)}: Ecke ${corner} bei ${p[0].toFixed(3)}, ${p[1].toFixed(3)}`);
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      }
      assert.ok(Math.abs(minX + maxX) < 0.02 && Math.abs(minY + maxY) < 0.02, `${view}: mittig (${minX.toFixed(2)} … ${maxX.toFixed(2)}, ${minY.toFixed(2)} … ${maxY.toFixed(2)})`);
      assert.ok(Math.max(maxX - minX, maxY - minY) > 1.6, `${view}: füllt das Bild (${(maxX - minX).toFixed(2)} × ${(maxY - minY).toFixed(2)})`);
    }
  }
  // Größere Box → größerer Abstand
  const small = fitOrbitDistance(sceneBounds({ min: [0, 0, 0], max: [4, 4, 4] }), 0.6, 0.5, ORBIT_FOV, 1.5);
  const large = fitOrbitDistance(sceneBounds({ min: [0, 0, 0], max: [40, 40, 40] }), 0.6, 0.5, ORBIT_FOV, 1.5);
  assert.ok(large > small * 5);
});

test('Shader-Quellen: GLSL ES 3.00, Attribut-Plätze wie das Vertex-Format, gemeinsame Uniforms mit gleicher Präzision', () => {
  for (const source of [BLOCK_VERTEX, BLOCK_FRAGMENT, SKY_VERTEX, SKY_FRAGMENT, GRID_VERTEX, GRID_FRAGMENT, LINE_VERTEX, LINE_FRAGMENT]) {
    assert.match(source, /^#version 300 es\n/);
  }
  const inputs = { position: 'vec3 aPos', layer: 'float aLayer', uv: 'vec2 aUv', color: 'vec4 aColor', showHide: 'vec2 aShowHide', flags: 'float aFlags', center: 'vec4 aCenter' };
  for (const [name, decl] of Object.entries(inputs)) assert.ok(BLOCK_VERTEX.includes(`layout(location = ${ATTRIBUTES[name]}) in ${decl};`), name);
  // uPass steht in beiden Stufen → im Fragment-Shader highp int (Vertex-Standard), sonst Link-Fehler
  assert.match(BLOCK_FRAGMENT, /precision highp int;/);
  assert.match(BLOCK_FRAGMENT, /texel\.a < 0\.5\) discard/);
  assert.match(BLOCK_FRAGMENT, /texel\.a < 0\.1\) discard/);
  assert.match(BLOCK_VERTEX, /show < uCur && hide >= uCur/, 'Sichtbarkeit nach §7.2');
  assert.match(BLOCK_VERTEX, /floor\(aCenter\.xyz \/ 16\.0\) \* 16\.0/, 'Ursprung der Schritt-/Kappen-Meshes');
});

test('Viewer ohne WebGL2 oder ohne Canvas: verständlicher Fehler', () => {
  assert.throws(() => new Viewer({ getContext: () => null }), (e) => e instanceof ViewerError && e.code === 'no-webgl2' && /WebGL2/.test(e.message));
  assert.throws(() => new Viewer(null), (e) => e instanceof ViewerError && e.code === 'argument');
});

test('Testseite viewer.html: CSP wie der Server, ein Modul-Skript, keine Inline-Skripte oder -Styles, Verweise vorhanden', async () => {
  const file = path.join(ROOT, 'tests', 'visual', 'viewer.html');
  const html = await readFile(file, 'utf8');
  assert.match(html, /^<!doctype html>\n<html lang="de">/);
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  assert.ok(csp, 'CSP-Meta fehlt');
  assert.equal(csp[1], CONTENT_SECURITY_POLICY.split('; ').filter((rule) => !rule.startsWith('frame-ancestors')).join('; '));
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<link'));
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.match(scripts[0][1], /type="module" src="viewer\.js"/);
  assert.equal(scripts[0][2].trim(), '');
  assert.doesNotMatch(html, /<style\b|\sstyle="|\son[a-z]+\s*=|javascript:/i);
  for (const ref of [...html.matchAll(/\b(?:href|src)="([^"#]+)"/g)].map((m) => m[1])) {
    assert.ok((await stat(path.resolve(path.dirname(file), ref))).isFile(), `${ref} fehlt`);
  }
  const ids = ['view', 'stage', 'status', 'controls', 'progress', 'progress-label', 'clip', 'clip-on', 'clip-label', 'play', 'prev', 'next', 'mode', 'ghost', 'hover', 'stats'];
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
  const source = await readFile(path.join(ROOT, 'tests', 'visual', 'viewer.js'), 'utf8');
  for (const [, id] of source.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `viewer.js nutzt #${id}, das im HTML fehlt`);
  assert.doesNotMatch(source, /innerHTML|setAttribute\('style'/);
});

// Kleinster WebGL2-Ersatz für das Textur-Array, mit Canvas (Ereignisse) und Zähler für isTexture.
class CountingGL {
  TEXTURE_2D_ARRAY = 0x8c1a; RGBA8 = 0x8058; RGBA = 0x1908; UNSIGNED_BYTE = 0x1401; TEXTURE0 = 0x84c0; NO_ERROR = 0;
  TEXTURE_MIN_FILTER = 0x2801; TEXTURE_MAG_FILTER = 0x2800; NEAREST = 0x2600; NEAREST_MIPMAP_LINEAR = 0x2702;
  TEXTURE_WRAP_S = 0x2802; TEXTURE_WRAP_T = 0x2803; REPEAT = 0x2901; TEXTURE_BASE_LEVEL = 0x813c; TEXTURE_MAX_LEVEL = 0x813d;
  MAX_ARRAY_TEXTURE_LAYERS = 0x88ff; TEXTURE_BINDING_2D_ARRAY = 0x8c1d; PIXEL_UNPACK_BUFFER = 0x88ec; PIXEL_UNPACK_BUFFER_BINDING = 0x88ef;
  UNPACK_FLIP_Y_WEBGL = 0x9240; UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241; UNPACK_ALIGNMENT = 0x0cf5; UNPACK_ROW_LENGTH = 0x0cf2;
  UNPACK_IMAGE_HEIGHT = 0x806e; UNPACK_SKIP_PIXELS = 0x0cf4; UNPACK_SKIP_ROWS = 0x0cf3; UNPACK_SKIP_IMAGES = 0x806d;
  canvas = new EventTarget();
  textures = new Set();
  created = 0;
  isTextureCalls = 0;
  lost = false;
  bound = null;
  pixelStore = {};
  createTexture() {
    if (this.lost) return null;
    const texture = {};
    this.textures.add(texture);
    this.created++;
    return texture;
  }
  deleteTexture(texture) { this.textures.delete(texture); if (this.bound === texture) this.bound = null; }
  isTexture(texture) { this.isTextureCalls++; return !this.lost && this.textures.has(texture); }
  isContextLost() { return this.lost; }
  bindTexture(target, texture) { this.bound = texture; }
  activeTexture() {}
  bindBuffer() {}
  pixelStorei(name, value) { this.pixelStore[name] = value; }
  getError() { return 0; }
  getParameter(name) {
    if (name === this.MAX_ARRAY_TEXTURE_LAYERS) return 2048;
    if (name === this.TEXTURE_BINDING_2D_ARRAY) return this.bound;
    if (name === this.PIXEL_UNPACK_BUFFER_BINDING) return null;
    return this.pixelStore[name] ?? 0;
  }
  texStorage3D() {}
  texParameteri() {}
  texSubImage3D() {}
}

test('Textur-Array: bind() fragt nicht jedes Mal gl.isTexture (synchron in Chrome), Kontextverlust per Ereignis', async () => {
  const image = createImage(16, 16);
  image.data.fill(200);
  const png = await encodePng(image);
  const store = new TextureStore({ version: '26.2', entries: { 'block/test': { o: 0, l: png.length, w: 16, h: 16, anim: null } } }, png);
  const gl = new CountingGL();
  await store.prepare(gl, ['block/test']);
  const calls = gl.isTextureCalls;
  for (let i = 0; i < 20; i++) assert.equal(store.bind(gl, 0), true);
  assert.equal(gl.isTextureCalls, calls, 'keine isTexture-Abfrage je bind()');
  // Kontextverlust: Ereignis am Canvas → nach dem Wiederherstellen neue Textur aus dem CPU-Spiegel
  gl.lost = true;
  gl.canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.equal(store.bind(gl, 0), false);
  gl.lost = false;
  gl.textures.clear();
  const before = gl.created;
  assert.equal(store.bind(gl, 0), true);
  assert.equal(gl.created, before + 1, 'Textur neu angelegt');
  assert.ok(gl.textures.has(store.texture(gl)));
  store.dispose(gl);
  assert.equal(store.texture(gl), null);
});

test('scripts/shot.mjs: Optionen werden geprüft', () => {
  const options = parseArgs(['--structure', 'igloo__top.json', '--views', 'iso,top', '--progress', '25,50', '--clip', '3', '--size', '800x600', '--ghost']);
  assert.deepEqual(options.source, { key: 'structure', value: 'igloo__top.json', name: 'igloo__top' });
  assert.deepEqual(options.views, ['iso', 'top']);
  assert.deepEqual(options.progress, [25, 50]);
  assert.equal(options.clip, 3);
  assert.deepEqual(options.size, [800, 600]);
  assert.equal(options.ghost, true);
  assert.deepEqual(parseArgs(['--gallery', 'all', '--page', '2', '--rows', '--focus', '1,0,2,1']).focus, [[1, 0, 2, 1]]);
  assert.equal(parseArgs(['--synthetic', '300000', '--bench', '3']).bench, 3);
  for (const bad of [[], ['--module', '../x.js'], ['--structure', 'a.json', '--module', 'js/builds/x.js'], ['--views', 'iso,schräg', '--gallery', 'all'],
    ['--gallery', 'all', '--size', 'groß'], ['--gallery', 'all', '--clip'], ['--gallery', 'all', '--unbekannt'], ['--synthetic', '0'], ['--gallery', 'all', '--focus', '1,2']]) {
    assert.throws(() => parseArgs(bad), UsageError, bad.join(' '));
  }
});
