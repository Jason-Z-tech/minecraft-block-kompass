// Browser-Test der fertigen 3D-Ansicht (tests/visual/viewer.html) mit echtem WebGL2: Laden, Fortschritt,
// Schnitt, Geist, Hervorhebung, Picking, Lauf-Modus mit Tasten, Kontextverlust, Leistung (300 000 Blöcke),
// Galerie aller Blöcke, Pixeldichte. Grafikkarte zuerst, ohne WebGL2 dort Software (swiftshader).
// Ohne Chrome oder Spieldaten: übersprungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hasGameData = ['models.json', 'blocks.json', 'textures.json', 'textures.bin'].every((f) => fs.existsSync(path.join(ROOT, 'game-data', f)));
const READY = 'window.__viewerTest && (window.__viewerTest.ready || window.__viewerTest.error)';
const HOUSE = 'module=tests/fixtures/core/example-house.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Nur die bekannte Ersatz-Warnung (Kupfergolem-Statuen ohne Entity-Textur) ist erlaubt
const KNOWN_MODEL_WARNING = /copper_golem_statue“ hat kein Modell mit Elementen/;

async function openBrowser(t, options) {
  for (const gpu of ['hardware', 'swiftshader']) {
    let page;
    try {
      page = await launchBrowser({ ...options, gpu });
    } catch (error) {
      if (/Kein Chrome/.test(error.message)) {
        t.skip(error.message);
        return null;
      }
      throw error;
    }
    const renderer = await page.eval(`(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    })()`);
    if (renderer) {
      page.gpu = gpu;
      page.renderer = renderer;
      return page;
    }
    await page.close();
  }
  throw new Error('Chrome liefert kein WebGL2 (weder Grafikkarte noch swiftshader).');
}

async function openViewer(page, server, query) {
  await page.goto(`${server.url}/tests/visual/viewer.html?${query}`);
  await page.waitFor(READY, 180000, 200);
  const state = await page.eval('JSON.parse(JSON.stringify(window.__viewerTest))');
  assert.equal(state.error, null, `Testseite: ${state.error}`);
  return state;
}

// Bild der Ansicht als Raster aus 48 × 30 Mittelwerten (für Vergleiche ohne Referenzbilder).
const FINGERPRINT = `(async () => {
  await window.__viewer.idle();
  const blob = await window.__viewer.screenshot();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(48, 30);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, 48, 30);
  return Array.from(ctx.getImageData(0, 0, 48, 30).data);
})()`;

function difference(a, b) {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 18) changed++;
  }
  return changed / (a.length / 4);
}

async function fingerprint(page, setup = '') {
  if (setup) await page.eval(`(() => { const v = window.__viewer; ${setup} })()`);
  return page.eval(FINGERPRINT);
}

// Bewegen ohne gedrückte Taste: button 'none' (mit 'left' meldet Chrome buttons = 1, also Ziehen)
const mouse = (page, type, x, y) => page.send('Input.dispatchMouseEvent', type === 'mouseMoved'
  ? { type, x, y, button: 'none', buttons: 0 }
  : { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
const key = (page, type, code, value, keyCode) => page.send('Input.dispatchKeyEvent', { type, code, key: value, windowsVirtualKeyCode: keyCode });

function consoleErrors(page) {
  return page.errors.filter((e) => !/favicon\.ico/.test(e));
}

test('3D-Ansicht: laden, Fortschritt, Schnitt, Geist, Hervorhebung, Picking, Laufen, Kontextverlust', { timeout: 240000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt (node scripts/extract-game-data.mjs)');
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 1000, height: 700 });
  if (!page) {
    await server.close();
    return;
  }
  try {
    t.diagnostic(`WebGL: ${page.gpu} · ${page.renderer}`);
    const state = await openViewer(page, server, `${HOUSE}&ui=0`);
    assert.equal(state.result.blockCount, 348);
    assert.equal(state.result.steps, 18);
    assert.equal(state.stats.chunks, 1);
    assert.ok(state.stats.quads > 500 && state.stats.textureLayers > 20, JSON.stringify(state.stats));
    assert.deepEqual(state.stats.missingTextures, []);
    assert.deepEqual(state.status.map((s) => s.state).filter((s, i, list) => list.indexOf(s) === i), ['loading', 'building', 'textures', 'meshing', 'ready']);
    // Kantenglättung über den eigenen MSAA-Framebuffer (1000 × 700 liegt unter dem Pixelbudget)
    const maxSamples = await page.eval('document.createElement("canvas").getContext("webgl2").getParameter(WebGL2RenderingContext.MAX_SAMPLES)');
    assert.equal(state.stats.msaaSamples, maxSamples >= 2 ? Math.min(4, maxSamples) : 0);
    const steps = state.result.steps;
    assert.equal(typeof steps, 'number');

    // Fortschritt: 0 % = nur Himmel und Raster, dann wächst der Bau
    const full = await fingerprint(page);
    const empty = await fingerprint(page, 'v.setProgress(0);');
    const share = [];
    for (const p of [0.25, 0.5, 0.75]) share.push(difference(empty, await fingerprint(page, `v.setProgress(${steps * p});`)));
    share.push(difference(empty, full));
    t.diagnostic(`Bildanteil des Baus bei 25/50/75/100 %: ${share.map((s) => s.toFixed(3)).join(' / ')}`);
    assert.ok(share[3] > 0.12, `fertiges Haus füllt das Bild (${share[3]})`);
    assert.ok(share[0] > 0.01 && share[0] <= share[1] + 0.01 && share[1] <= share[2] + 0.01 && share[2] <= share[3] + 0.01, 'wächst mit dem Fortschritt');

    // Halber Schritt (ohne Animation, da prefers-reduced-motion): ein Teil der Blöcke des Schritts ist gesetzt
    const atStep = await fingerprint(page, 'v.setProgress(6);');
    const halfStep = await fingerprint(page, 'v.setProgress(6.5);');
    const nextStep = await fingerprint(page, 'v.setProgress(7);');
    assert.ok(difference(atStep, nextStep) > 0, 'Schritt 6 setzt Blöcke');
    assert.ok(difference(atStep, halfStep) <= difference(atStep, nextStep) + 0.005, 'halber Schritt liegt dazwischen');

    // Schnitt: Dach weg, Deckflächen der Schnittebene da (sonst sähe man in die Wände hinein)
    const clipped = await fingerprint(page, 'v.setProgress(v.stepCount); v.setClip({ maxY: 2 });');
    assert.ok(difference(full, clipped) > 0.03, 'Schnitt verändert das Bild');
    const capped = await page.eval('(() => window.__viewer.clip)()');
    assert.deepEqual(capped, { minY: -1e9, maxY: 2 });
    await page.eval('window.__viewer.setClip(null)');

    // Geist: künftige Blöcke halbdurchsichtig
    const half = await fingerprint(page, 'v.setProgress(v.stepCount / 2);');
    const ghost = await fingerprint(page, 'v.setGhost(true);');
    assert.ok(difference(half, ghost) > 0.05, `Geist sichtbar (${difference(half, ghost)})`);
    await page.eval('window.__viewer.setGhost(false)');

    // Hervorhebung: gebauter Schritt golden getönt; künftiger Schritt als goldener Geist
    const counts = await page.eval('window.__viewer.result.steps.map((s) => s.blockCount)');
    const biggest = counts.indexOf(Math.max(...counts));
    const marked = await fingerprint(page, `v.setProgress(v.stepCount); v.setHighlightStep(${biggest});`);
    assert.ok(difference(full, marked) > 0.01, 'Hervorhebung sichtbar');
    const futureMarked = await fingerprint(page, `v.setProgress(0); v.setHighlightStep(${biggest});`);
    assert.ok(difference(empty, futureMarked) > 0.01, 'künftiger Schritt als Geist sichtbar');
    await page.eval('(() => { window.__viewer.setHighlightStep(null); window.__viewer.setProgress(window.__viewer.stepCount); })()');
    await page.eval('window.__viewer.idle()');

    // Picking: Zeiger über dem Haus → Hover; Klick → onPick mit Block; Klick in den Himmel → null
    await mouse(page, 'mouseMoved', 500, 380);
    await page.waitFor('window.__viewerTest.hover !== null', 5000);
    const hover = await page.eval('JSON.parse(JSON.stringify(window.__viewerTest.hover))');
    assert.match(hover.state, /^[a-z_]+(\[.*\])?$/);
    assert.ok(Number.isInteger(hover.step) && hover.step >= 0);
    await mouse(page, 'mousePressed', 500, 380);
    await mouse(page, 'mouseReleased', 500, 380);
    await mouse(page, 'mousePressed', 20, 20);
    await mouse(page, 'mouseReleased', 20, 20);
    const picks = await page.eval('JSON.parse(JSON.stringify(window.__viewerTest.picks))');
    assert.equal(picks.length, 2);
    assert.equal(picks[0].state, hover.state);
    assert.equal(picks[1], null, 'Himmel: kein Block');
    // Bei 0 % gibt es nichts zu treffen
    await page.eval('window.__viewer.setProgress(0)');
    await mouse(page, 'mousePressed', 500, 380);
    await mouse(page, 'mouseReleased', 500, 380);
    assert.equal(await page.eval('window.__viewerTest.picks[2]'), null, 'ungebaute Blöcke sind nicht auswählbar');
    await page.eval('window.__viewer.setProgress(window.__viewer.stepCount)');

    // Bild: PNG in Größe der Canvas
    const shot = await page.eval(`(async () => {
      const blob = await window.__viewer.screenshot();
      const bitmap = await createImageBitmap(blob);
      const canvas = document.getElementById('view');
      return [blob.type, bitmap.width, bitmap.height, canvas.width, canvas.height];
    })()`);
    assert.deepEqual(shot.slice(0, 1), ['image/png']);
    assert.deepEqual(shot.slice(1, 3), shot.slice(3, 5));

    // Laufen: Spawn südlich des Hauses mit Blick nach Norden, W bis zur Südwand (z = 10 + halbe Breite 0,3)
    await page.eval('window.__viewer.setMode("walk")');
    const start = await page.eval('(() => { const p = window.__viewer.controls.walk.player; return [p.x, p.y, p.z, p.yaw]; })()');
    assert.deepEqual(start, [5.5, 0, 14, 180]);
    await key(page, 'keyDown', 'KeyW', 'w', 87);
    await sleep(2200);
    await key(page, 'keyUp', 'KeyW', 'w', 87);
    await sleep(150);
    const walked = await page.eval('(() => { const p = window.__viewer.controls.walk.player; return [p.x, p.y, p.z, p.onGround]; })()');
    assert.ok(Math.abs(walked[2] - 10.3) < 0.01 && walked[0] === 5.5 && walked[1] === 0 && walked[3], `vor der Wand gestoppt: ${walked}`);
    const aimed = await page.eval('JSON.parse(JSON.stringify(window.__viewerTest.hover))');
    assert.ok(aimed && aimed.z === 9, `Fadenkreuz zielt auf die Wand: ${JSON.stringify(aimed)}`);
    await key(page, 'keyDown', 'Space', ' ', 32);
    await sleep(200);
    const jumpY = await page.eval('window.__viewer.controls.walk.player.y');
    await key(page, 'keyUp', 'Space', ' ', 32);
    assert.ok(jumpY > 0.4, `Sprung: y = ${jumpY}`);
    await sleep(900);
    await key(page, 'keyDown', 'Escape', 'Escape', 27);
    await key(page, 'keyUp', 'Escape', 'Escape', 27);
    await sleep(100);
    assert.equal(await page.eval('window.__viewer.mode'), 'orbit', 'Esc beendet das Laufen');

    // Kontextverlust: Szene wird aus dem Worker neu aufgebaut
    await page.eval('window.__viewer.setView("iso", { animate: false })');
    const before = await fingerprint(page);
    await page.eval(`(async () => {
      const ext = document.getElementById('view').getContext('webgl2').getExtension('WEBGL_lose_context');
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 300));
      ext.restoreContext();
    })()`);
    await page.waitFor('window.__viewerTest.status.some((s) => s.state === "restoring") && window.__viewer.ready', 30000);
    const after = await fingerprint(page);
    assert.ok(difference(before, after) < 0.01, `nach dem Kontextverlust gleiches Bild (${difference(before, after)})`);
    const states = await page.eval('window.__viewerTest.status.map((s) => s.state)');
    assert.ok(states.includes('context-lost') && states.at(-1) === 'ready', states.join(','));

    await page.eval('window.__viewer.dispose()');
    assert.deepEqual(consoleErrors(page), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});

test('3D-Ansicht: Original-Strukturen (Dorfhaus, Iglu, Endschiff) mit Schritten in Ebenen', { timeout: 180000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt');
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 800, height: 600 });
  if (!page) {
    await server.close();
    return;
  }
  try {
    for (const file of ['village__plains__houses__plains_library_1.json', 'igloo__top.json', 'end_city__ship.json']) {
      const structure = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-data', 'structures', file), 'utf8'));
      let blocks = 0;
      for (let i = 0; i < structure.rle.length; i += 2) if (structure.rle[i] !== 0) blocks += structure.rle[i + 1];
      const state = await openViewer(page, server, `structure=${file}&ui=0&progress=50`);
      assert.equal(state.result.blockCount, blocks, file);
      assert.deepEqual(state.result.phases, ['Aufbau']);
      assert.deepEqual(state.stats.missingTextures, [], file);
      assert.equal(await page.eval('window.__viewer.progress'), state.result.steps / 2);
      t.diagnostic(`${file}: ${blocks} Blöcke, ${state.result.steps} Ebenen, ${state.stats.quads} Quads, Laden ${state.stats.loadMs} ms`);
    }
    assert.deepEqual(consoleErrors(page), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});

test('3D-Ansicht: Galerie aller Blöcke und aller Zustandsreihen ohne fehlende Texturen', { timeout: 300000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt');
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 900, height: 600 });
  if (!page) {
    await server.close();
    return;
  }
  try {
    const first = await openViewer(page, server, 'gallery=1&ui=0');
    const pages = first.result.gallery.pages;
    const groups = ['stairs', 'orientation', 'fences', 'glass', 'plants', 'fluids', 'chests', 'beds', 'signs', 'doors', 'redstone', 'special'];
    const queries = [...Array.from({ length: pages - 1 }, (_, i) => `gallery=all&page=${i + 1}`), ...groups.map((g) => `gallery=${g}`)];
    let blocks = first.result.gallery.items.length;
    for (const query of queries) {
      const state = await openViewer(page, server, `${query}&ui=0`);
      assert.deepEqual(state.result.warnings, [], query);
      assert.deepEqual(state.stats.missingTextures, [], query);
      assert.deepEqual(state.stats.warnings.filter((w) => !KNOWN_MODEL_WARNING.test(w)), [], `${query}: unerwartete Modell-Hinweise`);
      if (query.startsWith('gallery=all')) blocks += state.result.gallery.items.length;
    }
    t.diagnostic(`${pages} Galerie-Seiten mit ${blocks} Blöcken, ${groups.length} Zustandsreihen`);
    assert.ok(blocks > 1100);
    assert.deepEqual(consoleErrors(page), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});

test('3D-Ansicht: Leistung mit 300 000 Blöcken (Meshing, FPS, Frustum-Culling)', { timeout: 300000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt');
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 1280, height: 800 });
  if (!page) {
    await server.close();
    return;
  }
  try {
    const state = await openViewer(page, server, 'synthetic=300000&ui=0&bench=3');
    const { stats, bench } = state;
    t.diagnostic(`WebGL: ${page.gpu} · ${page.renderer}`);
    t.diagnostic(`${state.result.blockCount} Blöcke · ${stats.quads} Quads · ${stats.chunks} Chunks · Bauen ${stats.buildMs} ms · Meshing ${stats.meshMs} ms · Laden ${stats.loadMs} ms`);
    t.diagnostic(`Drehende Kamera: ${bench.fps} FPS · Median ${bench.medianFrameMs} ms · 95 % ${bench.p95FrameMs} ms · CPU je Bild ${bench.frameCpuMs} ms`);
    assert.ok(state.result.blockCount >= 300000);
    assert.ok(stats.meshMs < 20000, `Meshing ${stats.meshMs} ms`);
    // Software-WebGL ist deutlich langsamer; mit der Grafikkarte wird 60 FPS angepeilt
    assert.ok(bench.fps >= (page.gpu === 'hardware' ? 30 : 2), `${bench.fps} FPS`);
    // An einer Ecke mit Blick nach außen: nur wenige Chunks liegen im Sichtfeld
    const culled = await page.eval(`(async () => {
      const v = window.__viewer;
      v.controls.orbit.setView({ target: [2, 12, 2], distance: 6, yaw: Math.PI / 4, pitch: 0.3 }, { animate: false });
      await v.idle();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [v.stats.drawnChunks, v.stats.chunks];
    })()`);
    t.diagnostic(`Frustum-Culling nah an einer Ecke: ${culled[0]} von ${culled[1]} Chunks gezeichnet`);
    assert.ok(culled[0] < culled[1] / 2, `Culling: ${culled.join(' von ')}`);
    assert.deepEqual(consoleErrors(page), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});

test('3D-Ansicht: Pixeldichte höchstens 2, Größe folgt dem Element (ResizeObserver)', { timeout: 120000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt');
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 600, height: 400, deviceScaleFactor: 3 });
  if (!page) {
    await server.close();
    return;
  }
  try {
    await openViewer(page, server, `${HOUSE}&ui=0`);
    const size = await page.eval('(() => { const c = document.getElementById("view"); return [c.clientWidth, c.clientHeight, c.width, c.height, devicePixelRatio]; })()');
    assert.equal(size[4], 3);
    assert.deepEqual(size.slice(2), [size[0] * 2, size[1] * 2, 3], `Canvas ${size}`);
    const resized = await page.eval(`(async () => {
      const stage = document.getElementById('stage');
      Object.assign(stage.style, { width: '300px', height: '200px', right: 'auto', bottom: 'auto' });
      await new Promise((r) => setTimeout(r, 200));
      await window.__viewer.idle();
      const c = document.getElementById('view');
      return [c.width, c.height];
    })()`);
    assert.deepEqual(resized, [600, 400]);
    // Große Canvas (2000 × 1600 Bildpunkte): ohne MSAA, das Bild bleibt trotzdem vollständig
    const large = await page.eval(`(async () => {
      const stage = document.getElementById('stage');
      Object.assign(stage.style, { width: '1000px', height: '800px' });
      await new Promise((r) => setTimeout(r, 200));
      await window.__viewer.idle();
      const c = document.getElementById('view');
      return [c.width, c.height, window.__viewer.stats.msaaSamples];
    })()`);
    assert.deepEqual(large, [2000, 1600, 0]);
    assert.deepEqual(consoleErrors(page), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});
