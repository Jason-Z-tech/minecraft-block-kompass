// Lauf-Modus im echten Chrome: Ende der Zeigersperre, Kontextmenü und Touch-Steuerung lassen nichts hängen.
// Chrome verschluckt nach Esc in der Zeigersperre das keyup (nur mit echten Tasten nachstellbar, nicht per DevTools);
// hier endet die Sperre darum per exitPointerLock ohne keyup. Ohne Chrome: übersprungen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Bühne mit Canvas und WalkControls auf einer leichten Seite derselben Herkunft
const SETUP = `(async () => {
  const { WalkControls } = await import('/js/render/controls.js');
  document.body.replaceChildren();
  const stage = document.createElement('div');
  Object.assign(stage.style, { position: 'fixed', left: '0', top: '0', width: '400px', height: '300px', zIndex: '1000', background: '#000' });
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { width: '400px', height: '300px', display: 'block' });
  stage.append(canvas);
  const outside = document.createElement('p');
  outside.textContent = 'Außerhalb';
  Object.assign(outside.style, { position: 'fixed', left: '0', top: '320px', width: '400px', height: '60px', margin: '0', zIndex: '1000', background: '#fff' });
  document.body.append(stage, outside);
  const floor = { collisionBoxes: (x, y, z) => (y < 0 ? [[0, 0, 0, 1, 1, 1]] : null) };
  window.__walk = new WalkControls(canvas, { world: floor, position: [0.5, 0, 0.5], yaw: 0, overlayParent: stage });
  window.__walk.enabled = true;
  canvas.focus();
  // Strecke in 1 s nach 0,5 s Abbremsen (Ticks von Hand, unabhängig von der Bildrate)
  window.__moved = () => {
    const w = window.__walk;
    for (let i = 0; i < 10; i++) w.update(50);
    const p = w.player, x = p.x, y = p.y, z = p.z;
    for (let i = 0; i < 20; i++) w.update(50);
    return { horizontal: Math.hypot(w.player.x - x, w.player.z - z), vertical: Math.abs(w.player.y - y) };
  };
  window.__menu = [];
  window.addEventListener('contextmenu', (e) => window.__menu.push(e.defaultPrevented));
})()`;

const keyEvent = (page, type, code, key) => page.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined });
const mouse = (page, type, x, y, button = 'left') => page.send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0, clickCount: 1 });
const touch = (page, type, touchPoints = []) => page.send('Input.dispatchTouchEvent', { type, touchPoints });
const center = (page, selector) => page.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);

test('Lauf-Modus im Browser: Sperre endet, Kontextmenü, Touch – nichts läuft weiter', { timeout: 120000 }, async (t) => {
  const server = await startServer({ port: 0 });
  const page = await openBrowser(t, { width: 900, height: 700, gpu: 'swiftshader' });
  if (!page) {
    await server.close();
    return;
  }
  try {
    await page.goto(`${server.url}/docs/ARCHITEKTUR.md`);
    await page.eval(SETUP);

    // Zeigersperre per Klick, W halten, Sperre endet ohne keyup → steht; erneut W geht
    await mouse(page, 'mouseMoved', 200, 150);
    await mouse(page, 'mousePressed', 200, 150);
    await mouse(page, 'mouseReleased', 200, 150);
    await page.waitFor('document.pointerLockElement !== null', 5000);
    await keyEvent(page, 'keyDown', 'KeyW', 'w');
    assert.ok((await page.eval('window.__moved()')).horizontal > 2, 'W läuft');
    await page.eval('new Promise((resolve) => { document.addEventListener("pointerlockchange", resolve, { once: true }); document.exitPointerLock(); })');
    assert.ok((await page.eval('window.__moved()')).horizontal < 0.01, 'nach dem Ende der Sperre steht die Figur');
    assert.equal(await page.eval('document.activeElement === document.querySelector("canvas")'), true, 'Fokus bleibt auf der Ansicht');
    await keyEvent(page, 'keyUp', 'KeyW', 'w');
    await keyEvent(page, 'keyDown', 'KeyW', 'w');
    assert.ok((await page.eval('window.__moved()')).horizontal > 2, 'erneut W läuft');

    // Rechtsklick in die Ansicht: kein Browser-Menü, W bleibt gehalten; Rechtsklick daneben: alles los
    await mouse(page, 'mousePressed', 250, 150, 'right');
    await mouse(page, 'mouseReleased', 250, 150, 'right');
    assert.deepEqual(await page.eval('window.__menu'), [true], 'Menü über der Ansicht verhindert');
    assert.ok((await page.eval('window.__moved()')).horizontal > 2, 'W bleibt gehalten');
    await mouse(page, 'mousePressed', 200, 350, 'right');
    await mouse(page, 'mouseReleased', 200, 350, 'right');
    assert.deepEqual(await page.eval('window.__menu'), [true, false], 'Menü daneben erlaubt');
    assert.ok((await page.eval('window.__moved()')).horizontal < 0.01, 'das Menü schluckt das keyup: steht');
    await keyEvent(page, 'keyUp', 'KeyW', 'w');
    // Ziehen nach dem Rechtsklick hängt nicht: Mausbewegung ohne Taste dreht nicht
    const yaw = await page.eval('window.__walk.player.yaw');
    for (const x of [260, 300, 340]) await mouse(page, 'mouseMoved', x, 150);
    assert.equal(await page.eval('window.__walk.player.yaw'), yaw, 'kein Drehen ohne gedrückte Taste');

    // Touch: Steuerung erscheint nach dem ersten Antippen
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 3 });
    await touch(page, 'touchStart', [{ x: 300, y: 60, id: 1 }]);
    await touch(page, 'touchEnd');
    await page.waitFor('document.querySelector(".walk-touch") && !document.querySelector(".walk-touch").hidden', 5000);
    const [sx, sy] = await center(page, '.walk-touch__stick');

    // Joystick nach vorn läuft, Loslassen hält an
    await touch(page, 'touchStart', [{ x: sx, y: sy, id: 2 }]);
    await touch(page, 'touchMove', [{ x: sx, y: sy - 45, id: 2 }]);
    assert.ok((await page.eval('window.__moved()')).horizontal > 2, 'Joystick läuft');
    await touch(page, 'touchEnd');
    assert.ok((await page.eval('window.__moved()')).horizontal < 0.01, 'Joystick losgelassen: steht');
    assert.equal(await page.eval('document.querySelector(".walk-touch__knob").style.transform'), '', 'Knopf mittig');

    // Joystick gehalten, Lauf-Modus aus und wieder an: Joystick ist frei, auch wenn der Finger noch liegt
    await touch(page, 'touchStart', [{ x: sx, y: sy, id: 3 }]);
    await touch(page, 'touchMove', [{ x: sx, y: sy - 45, id: 3 }]);
    await page.eval('(() => { window.__walk.enabled = false; window.__walk.enabled = true; })()');
    await touch(page, 'touchMove', [{ x: sx, y: sy - 40, id: 3 }]);
    assert.ok((await page.eval('window.__moved()')).horizontal < 0.01, 'nach dem Wiedereintritt steht die Figur');
    await touch(page, 'touchEnd');

    // Springen doppelt antippen → Fliegen; der Finger bleibt auf dem (jetzt versteckten) Knopf, dann loslassen
    const [jx, jy] = await center(page, '.walk-touch button[aria-label="Springen"]');
    await touch(page, 'touchStart', [{ x: jx, y: jy, id: 4 }]);
    await page.eval('window.__walk.update(50)');
    await touch(page, 'touchEnd');
    await page.eval('window.__walk.update(50)');
    await touch(page, 'touchStart', [{ x: jx, y: jy, id: 5 }]);
    await page.eval('window.__walk.update(50)');
    assert.equal(await page.eval('window.__walk.player.flying'), true, 'Doppeltipp fliegt');
    assert.equal(await page.eval('document.querySelector(".walk-touch button[aria-label=\\"Springen\\"]").hidden'), true);
    await touch(page, 'touchEnd');
    assert.ok((await page.eval('window.__moved()')).vertical < 0.01, 'nach dem Loslassen schwebt die Figur');

    // Langes Halten des Joysticks (am Boden): kein Kontextmenü, die Figur läuft weiter
    await page.eval('window.__walk.teleport([0.5, 0, 0.5], { flying: false })');
    await touch(page, 'touchStart', [{ x: sx, y: sy, id: 6 }]);
    await touch(page, 'touchMove', [{ x: sx, y: sy - 45, id: 6 }]);
    await sleep(1200);
    assert.ok((await page.eval('window.__moved()')).horizontal > 2, 'Langdruck läuft weiter');
    await touch(page, 'touchEnd');
    assert.ok((await page.eval('window.__moved()')).horizontal < 0.01);

    await page.eval('window.__walk.dispose()');
    assert.deepEqual(page.errors.filter((e) => !/404 \(Not Found\) http:\/\/127\.0\.0\.1:\d+\/favicon\.ico$/.test(e)), [], 'Konsolenfehler');
  } finally {
    await page.close();
    await server.close();
  }
});
