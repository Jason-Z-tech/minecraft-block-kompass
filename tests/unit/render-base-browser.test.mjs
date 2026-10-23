// Browser-Test der 3D-Grundbausteine: Texturen-Testseite mit echtem WebGL2 (Screenshot nach tmp/) und
// Steuerung mit echten Maus-, Rad-, Tastatur- und Touch-Ereignissen. Ohne Chrome oder Spieldaten: übersprungen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TMP = path.join(ROOT, 'tmp');
const hasGameData = fs.existsSync(path.join(ROOT, 'game-data', 'textures.json'));

async function openBrowser(t, options) {
  try {
    return await launchBrowser(options);
  } catch (error) {
    if (/Kein Chrome/.test(error.message)) {
      t.skip(error.message);
      return null;
    }
    throw error;
  }
}

async function runTexturePage(t, server, gpu) {
  const page = await openBrowser(t, { gpu, width: 1280, height: 2600 });
  if (!page) return null;
  try {
    await page.goto(`${server.url}/tests/visual/textures.html`);
    await page.waitFor('window.__textureTest && window.__textureTest.done', 180000, 250);
    const result = await page.eval('JSON.parse(JSON.stringify(window.__textureTest))');
    if (gpu === 'hardware' && result.checks.some((c) => /WebGL2 ist in diesem Browser nicht verfügbar/.test(c.detail))) return { retry: true };
    fs.mkdirSync(TMP, { recursive: true });
    await page.screenshot(path.join(TMP, `render-base-textures-${gpu}.png`));
    return { result, errors: [...page.errors], logs: [...page.logs] };
  } finally {
    await page.close();
  }
}

test('Texturen-Testseite: alle Prüfungen mit echtem WebGL2 bestanden', { timeout: 240000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt (node scripts/extract-game-data.mjs)');
  const server = await startServer({ port: 0 });
  try {
    let run = await runTexturePage(t, server, 'hardware');
    if (run?.retry) run = await runTexturePage(t, server, 'swiftshader');
    if (!run) return;
    const { result, errors } = run;
    const failed = result.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    assert.deepEqual(failed, [], 'fehlgeschlagene Prüfungen');
    assert.equal(result.ok, true);
    assert.deepEqual(errors, [], 'Konsolenfehler');
    assert.ok(result.checks.length >= 10);
    t.diagnostic(`Renderer: ${result.stats.renderer}, Ebenen max. ${result.stats.maxLayers}, Gesamt ${result.stats.totalMs} ms`);
    for (const id of ['block', 'item', 'other']) t.diagnostic(`${id}: ${JSON.stringify(result.stats[id])}`);
    t.diagnostic(`Decoder: ${JSON.stringify(result.stats.decoder)}`);
  } finally {
    await server.close();
  }
});

// Ereignis-Hilfen über das DevTools-Protokoll
const mouse = (page, type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
const keyEvent = (page, type, code, key) => page.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined });

test('Steuerung im Browser: Orbit (Ziehen, Rad, Pfeiltasten) und Laufen (WASD, Touch-Knöpfe)', { timeout: 120000 }, async (t) => {
  if (!hasGameData) return t.skip('game-data/ fehlt');
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 900, height: 700, gpu: 'swiftshader' });
  if (!page) {
    await server.close();
    return;
  }
  try {
    // Leichtes Dokument derselben Herkunft (Textdatei), damit nichts im Hintergrund rechnet
    await page.goto(`${server.url}/docs/ARCHITEKTUR.md`);
    await page.eval(`(async () => {
      const { OrbitControls, WalkControls } = await import('/js/render/controls.js');
      document.body.replaceChildren();
      const stage = document.createElement('div');
      Object.assign(stage.style, { position: 'fixed', left: '0', top: '0', width: '400px', height: '300px', zIndex: '1000', background: '#000' });
      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, { width: '400px', height: '300px', display: 'block' });
      stage.append(canvas);
      document.body.append(stage);
      window.__taps = [];
      window.__orbit = new OrbitControls(canvas, { distance: 20, yaw: 0, pitch: 0.3, onTap: (tap) => window.__taps.push(tap) });
      const floor = { collisionBoxes: (x, y, z) => (y < 0 ? [[0, 0, 0, 1, 1, 1]] : null) };
      window.__walk = new WalkControls(canvas, { world: floor, position: [0.5, 0, 0.5], yaw: 0 });
      window.__canvas = canvas;
    })()`);

    // Orbit: ziehen nach rechts → yaw sinkt um 60 px · 0,006
    await mouse(page, 'mouseMoved', 200, 150, { buttons: 0 });
    await mouse(page, 'mousePressed', 200, 150);
    for (const x of [220, 240, 260]) await mouse(page, 'mouseMoved', x, 150);
    await mouse(page, 'mouseReleased', 260, 150);
    const yaw = await page.eval('(() => { window.__orbit.update(5000); return window.__orbit.orbit.yaw; })()');
    assert.ok(Math.abs(yaw - -0.36) < 1e-6, `yaw nach Ziehen: ${yaw}`);
    assert.equal(await page.eval('window.__taps.length'), 0, 'Ziehen ist kein Tippen');

    // Tippen ohne Bewegung → onTap mit Position im Element
    await mouse(page, 'mousePressed', 100, 80);
    await mouse(page, 'mouseReleased', 100, 80);
    assert.deepEqual(await page.eval('window.__taps.map((t) => [t.x, t.y, t.pointerType])'), [[100, 80, 'mouse']]);

    // Rad: Abstand × e^(100 · 0,0015)
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 200, y: 150, deltaX: 0, deltaY: 100 });
    const distance = await page.eval('(() => { window.__orbit.update(5000); return window.__orbit.orbit.distance; })()');
    assert.ok(Math.abs(distance - 20 * Math.exp(0.15)) < 1e-6, `Abstand nach Rad: ${distance}`);

    // Pfeiltaste links halten: Kamera dreht (yaw steigt)
    await keyEvent(page, 'keyDown', 'ArrowLeft', 'ArrowLeft');
    const yawKeys = await page.eval('(() => { for (let i = 0; i < 10; i++) window.__orbit.update(50); return window.__orbit.orbit.yaw; })()');
    await keyEvent(page, 'keyUp', 'ArrowLeft', 'ArrowLeft');
    assert.ok(yawKeys > yaw + 0.3, `yaw nach Pfeiltaste: ${yawKeys}`);

    // Laufen: Orbit aus, Lauf an, W eine Sekunde halten → etwa 4 Blöcke nach Süden
    await page.eval('(() => { window.__orbit.enabled = false; window.__walk.enabled = true; window.__canvas.focus(); })()');
    await keyEvent(page, 'keyDown', 'KeyW', 'w');
    const walked = await page.eval('(() => { for (let i = 0; i < 20; i++) window.__walk.update(50); const p = window.__walk.player; return [p.x, p.y, p.z]; })()');
    await keyEvent(page, 'keyUp', 'KeyW', 'w');
    // 20 Ticks ab Stand (erst Luft, dann Boden): 3,7579 Blöcke wie in der Node-Rechnung
    assert.ok(Math.abs(walked[2] - 0.5 - 3.7579) < 0.001, `Strecke ${walked[2] - 0.5}`);
    assert.equal(walked[1], 0);

    // Doppelt Leertaste → Fliegen
    await keyEvent(page, 'keyDown', 'Space', ' ');
    await page.eval('window.__walk.update(50)');
    await keyEvent(page, 'keyUp', 'Space', ' ');
    await page.eval('window.__walk.update(50)');
    await keyEvent(page, 'keyDown', 'Space', ' ');
    await page.eval('window.__walk.update(50)');
    await keyEvent(page, 'keyUp', 'Space', ' ');
    assert.equal(await page.eval('window.__walk.player.flying'), true, 'Doppel-Leertaste schaltet Fliegen ein');

    // Touch: Antippen blendet die Touch-Steuerung mit beschrifteten Knöpfen ein
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 100 }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 340, y: 100 }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const labels = await page.eval('[...document.querySelectorAll(".walk-touch button")].map((b) => [b.getAttribute("aria-label"), b.hidden])');
    assert.deepEqual(labels.map((l) => l[0]).sort(), ['Fliegen ein- oder ausschalten', 'Hochfliegen', 'Runterfliegen oder schleichen', 'Springen']);
    assert.deepEqual(labels.filter((l) => !l[1]).map((l) => l[0]).sort(), ['Fliegen ein- oder ausschalten', 'Hochfliegen', 'Runterfliegen oder schleichen'], 'im Flug: Hoch/Runter sichtbar');
    const yawTouch = await page.eval('window.__walk.player.yaw');
    assert.ok(Math.abs(yawTouch - 40 * 0.28) < 1e-6, `Blick per Touch: ${yawTouch}`);

    // Knopf „Landen“ (Fliegen aus) per Touch antippen
    const box = await page.eval('(() => { const b = [...document.querySelectorAll(".walk-touch button")].find((x) => x.getAttribute("aria-pressed") !== null); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, b.textContent]; })()');
    assert.equal(box[2], 'Landen');
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box[0], y: box[1] }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Den Klick erzeugt Chrome erst nach der Tipp-Geste; bis dahin weiter ticken.
    await page.waitFor('(window.__walk.update(50), window.__walk.player.flying === false)', 5000);
    assert.equal(await page.eval('document.querySelector(".walk-touch button[aria-pressed]").textContent'), 'Fliegen');

    // Orbit mit zwei Fingern: auseinanderziehen (100 → 200 px) halbiert den Abstand, Mitte bleibt → kein Verschieben
    await page.eval('(() => { window.__walk.enabled = false; window.__orbit.enabled = true; })()');
    assert.equal(await page.eval('document.querySelector(".walk-touch").hidden'), true, 'Touch-Steuerung beim Orbit ausgeblendet');
    const before = await page.eval('(() => { window.__orbit.update(5000); const o = window.__orbit.orbit; return [o.distance, ...o.target]; })()');
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 150, id: 1 }, { x: 250, y: 150, id: 2 }] });
    for (const step of [1, 2, 3, 4]) {
      await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150 - 12.5 * step, y: 150, id: 1 }, { x: 250 + 12.5 * step, y: 150, id: 2 }] });
    }
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await page.eval('(() => { window.__orbit.update(5000); const o = window.__orbit.orbit; return [o.distance, ...o.target]; })()');
    assert.ok(Math.abs(after[0] - before[0] / 2) < 1e-6, `Abstand nach Pinch: ${after[0]} statt ${before[0] / 2}`);
    for (let i = 1; i < 4; i++) assert.ok(Math.abs(after[i] - before[i]) < 1e-9, 'Ziel unverändert');

    await page.eval('(() => { window.__walk.dispose(); window.__orbit.dispose(); })()');
    assert.equal(await page.eval('document.querySelectorAll(".walk-touch").length'), 0);
    // Für das Textdokument fragt Chrome selbst /favicon.ico an (gibt es im Projekt nicht) – nur diese Meldung ausnehmen.
    assert.deepEqual(page.errors.filter((e) => !/404 \(Not Found\) http:\/\/127\.0\.0\.1:\d+\/favicon\.ico$/.test(e)), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});
