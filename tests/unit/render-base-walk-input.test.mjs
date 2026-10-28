// Lauf-Modus: Keine Taste, kein Finger und kein Ziehen bleibt hängen, wenn der Browser ein Loslassen verschluckt.
// Nachgestellt mit einem kleinen DOM aus EventTarget (Node): Die Fälle stammen aus echten Läufen in Chrome
// (Esc beendet die Zeigersperre und Chrome verschluckt danach das keyup, Kontextmenü, macOS-Cmd, Vollbild).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WalkControls } from '../../js/render/controls.js';

class FakeEvent extends Event {
  constructor(type, init = {}) {
    super(type, { cancelable: true });
    for (const [key, value] of Object.entries(init)) Object.defineProperty(this, key, { value, enumerable: true });
  }
}

const FLOOR = { collisionBoxes: (x, y, z) => (y < 0 ? [[0, 0, 0, 1, 1, 1]] : null) };

function setup({ lockPending = false } = {}) {
  const win = new EventTarget();
  const doc = new EventTarget();
  Object.assign(doc, { defaultView: win, activeElement: null, pointerLockElement: null, hidden: false });
  const el = new EventTarget();
  const other = new EventTarget();
  const lockChanged = () => doc.dispatchEvent(new FakeEvent('pointerlockchange'));
  doc.exitPointerLock = () => {
    doc.pointerLockElement = null;
    lockChanged();
  };
  Object.assign(el, {
    ownerDocument: doc,
    style: {},
    parentElement: null,
    captured: new Set(),
    hasAttribute: () => true,
    focus: () => { doc.activeElement = el; },
    requestPointerLock: () => {
      if (lockPending) return new Promise(() => {});
      doc.pointerLockElement = el;
      lockChanged();
      return Promise.resolve();
    },
    setPointerCapture: (id) => {
      // Chrome: solange eine Zeigersperre angefragt ist, wirft setPointerCapture
      if (lockPending) throw new Error('InvalidStateError');
      el.captured.add(id);
    },
    releasePointerCapture: (id) => { el.captured.delete(id); },
  });
  let exits = 0;
  const walk = new WalkControls(el, { world: FLOOR, position: [0.5, 0, 0.5], yaw: 0, onExit: () => { exits++; } });
  walk.enabled = true;
  el.focus();
  const key = (type, code, mods = {}) => {
    const event = new FakeEvent(type, { code, key: code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false, ...mods });
    win.dispatchEvent(event);
    return event;
  };
  const pointer = (target, type, init) => target.dispatchEvent(new FakeEvent(type, { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 0, clientY: 0, ctrlKey: false, shiftKey: false, ...init }));
  const lock = () => el.requestPointerLock();
  // Browser beendet die Zeigersperre selbst (Esc): Die Seite sieht weder Esc noch das keyup danach
  const browserUnlock = () => {
    doc.pointerLockElement = null;
    doc.activeElement = null;
    lockChanged();
  };
  return { win, doc, el, other, walk, key, pointer, lock, browserUnlock, exits: () => exits };
}

// Waagrechte Strecke in 1 s, nachdem die Figur 0,5 s abbremsen konnte
function moved(walk) {
  for (let i = 0; i < 10; i++) walk.update(50);
  const p = walk.player;
  const x = p.x, z = p.z;
  for (let i = 0; i < 20; i++) walk.update(50);
  return Math.hypot(walk.player.x - x, walk.player.z - z);
}

const WALKING = 2; // Gehen 4,3 Blöcke/s
const STANDING = 0.01;

test('Grundfall: W läuft, keyup hält an; Loslassen ohne Drücken ist harmlos', () => {
  const t = setup();
  t.key('keyup', 'KeyS');
  assert.ok(moved(t.walk) < STANDING);
  t.key('keydown', 'KeyW');
  assert.ok(moved(t.walk) > WALKING, 'W läuft');
  t.key('keyup', 'KeyW');
  assert.ok(moved(t.walk) < STANDING, 'keyup hält an');
});

test('Ende der Zeigersperre (Esc im Browser, keyup verschluckt) lässt alle Tasten los', () => {
  const t = setup();
  t.lock();
  t.key('keydown', 'KeyW');
  t.key('keydown', 'KeyA');
  assert.ok(moved(t.walk) > WALKING);
  t.browserUnlock();
  assert.ok(moved(t.walk) < STANDING, 'steht nach dem Ende der Sperre');
  assert.equal(t.doc.activeElement, t.el, 'Fokus zurück auf der Ansicht');
  // Erneut drücken geht wie gewohnt
  t.key('keydown', 'KeyW');
  assert.ok(moved(t.walk) > WALKING);
});

test('Esc lässt immer alles los: ohne Sperre beendet es den Modus, mit Fokus außerhalb nur das Laufen', () => {
  const t = setup();
  t.key('keydown', 'KeyW');
  t.key('keydown', 'Escape');
  assert.equal(t.exits(), 1, 'onExit');
  assert.ok(moved(t.walk) < STANDING, 'steht nach Esc');

  t.key('keydown', 'KeyW');
  t.doc.activeElement = t.other;
  t.key('keydown', 'Escape');
  assert.equal(t.exits(), 1, 'Fokus außerhalb: kein onExit');
  assert.ok(moved(t.walk) < STANDING, 'aber alles losgelassen');
});

test('Ausschalten und Wiedereintritt geben alles frei; Tasten im ausgeschalteten Zustand zählen nicht', () => {
  const t = setup();
  t.key('keydown', 'KeyW');
  t.walk.enabled = false;
  t.key('keyup', 'KeyW'); // kommt an, während der Modus aus ist
  t.key('keydown', 'KeyD');
  t.walk.enabled = true;
  t.el.focus();
  assert.ok(moved(t.walk) < STANDING, 'nach dem Wiedereintritt steht die Figur');
  // Verlorenes keyup während der Pause: Wiedereintritt beginnt trotzdem losgelassen
  t.key('keydown', 'KeyW');
  t.walk.enabled = false;
  t.walk.enabled = true;
  t.el.focus();
  assert.ok(moved(t.walk) < STANDING);
});

test('Vollbild-Wechsel, Fensterwechsel und verdeckter Tab lassen los', () => {
  const t = setup();
  for (const leave of [
    () => t.doc.dispatchEvent(new FakeEvent('fullscreenchange')),
    () => t.win.dispatchEvent(new FakeEvent('blur')),
    () => { t.doc.hidden = true; t.doc.dispatchEvent(new FakeEvent('visibilitychange')); t.doc.hidden = false; },
  ]) {
    t.key('keydown', 'KeyW');
    leave();
    assert.ok(moved(t.walk) < STANDING);
  }
});

test('Kontextmenü: über der Ansicht verhindert (Tasten bleiben), anderswo lässt es alles los', () => {
  const t = setup();
  t.key('keydown', 'KeyW');
  const onView = new FakeEvent('contextmenu', { target: t.el });
  t.win.dispatchEvent(onView);
  assert.equal(onView.defaultPrevented, true, 'kein Browser-Menü über der Ansicht');
  assert.ok(moved(t.walk) > WALKING, 'W bleibt gehalten');

  const elsewhere = new FakeEvent('contextmenu', { target: t.other });
  t.win.dispatchEvent(elsewhere);
  assert.equal(elsewhere.defaultPrevented, false, 'Menü anderswo bleibt erlaubt');
  assert.ok(moved(t.walk) < STANDING, 'das Menü schluckt das keyup: alles losgelassen');

  // Hat die Seite das Menü selbst verhindert, öffnet sich keins: nichts loslassen
  t.key('keydown', 'KeyW');
  const handled = new FakeEvent('contextmenu', { target: t.other });
  handled.preventDefault();
  t.win.dispatchEvent(handled);
  assert.ok(moved(t.walk) > WALKING);
});

test('macOS: W, Cmd dazu, W los ohne keyup, Cmd los → steht; Cmd/Alt/Windows-Kombinationen lösen nichts aus', () => {
  const t = setup();
  t.key('keydown', 'KeyW');
  t.key('keydown', 'MetaLeft', { metaKey: true });
  t.key('keyup', 'MetaLeft');
  assert.ok(moved(t.walk) < STANDING, 'Cmd lässt los');

  t.key('keydown', 'KeyW');
  t.key('keydown', 'AltLeft', { altKey: true });
  assert.ok(moved(t.walk) < STANDING, 'Alt lässt los');
  t.key('keyup', 'AltLeft');

  const combo = t.key('keydown', 'KeyW', { metaKey: true });
  assert.equal(combo.defaultPrevented, false, 'Cmd+W gehört dem Browser');
  t.key('keydown', 'KeyD', { altKey: true });
  assert.ok(moved(t.walk) < STANDING, 'Kombinationen laufen nicht');

  // Windows-Taste und AltGr (Strg+Alt rechts) lassen ebenso los, auch den künstlichen Strg-Druck
  t.key('keydown', 'KeyW');
  t.key('keydown', 'OSLeft');
  assert.ok(moved(t.walk) < STANDING);
  t.key('keydown', 'ControlLeft', { ctrlKey: true });
  t.key('keydown', 'AltRight', { ctrlKey: true, altKey: true });
  t.key('keydown', 'KeyW');
  for (let i = 0; i < 5; i++) t.walk.update(50);
  assert.equal(t.walk.player.sprinting, false, 'AltGr hinterlässt kein Strg');
});

test('Strg und Umschalt folgen dem gemeldeten Zustand: verlorenes keyup heilt beim nächsten Ereignis', () => {
  const t = setup();
  const guarded = () => {
    const event = new FakeEvent('beforeunload');
    t.win.dispatchEvent(event);
    return event.defaultPrevented;
  };
  // Strg + W: sprintet, Schließen-Rückfrage aktiv
  t.key('keydown', 'ControlLeft', { ctrlKey: true });
  t.key('keydown', 'KeyW', { ctrlKey: true });
  for (let i = 0; i < 5; i++) t.walk.update(50);
  assert.equal(t.walk.player.sprinting, true);
  assert.equal(guarded(), true, 'Rückfrage solange Strg gehalten');
  // keyup von Strg ging verloren (Rückfrage-Dialog); das nächste Ereignis meldet Strg nicht mehr
  t.key('keyup', 'KeyW');
  for (let i = 0; i < 10; i++) t.walk.update(50);
  t.key('keydown', 'KeyW');
  for (let i = 0; i < 10; i++) t.walk.update(50);
  assert.equal(t.walk.player.sprinting, false, 'kein Sprinten ohne Strg');
  assert.equal(guarded(), false, 'Rückfrage aufgehoben');
  t.key('keyup', 'KeyW');

  // Umschalt hängt: eine Mausbewegung ohne Umschalt beendet das Schleichen
  t.key('keydown', 'ShiftLeft', { shiftKey: true });
  for (let i = 0; i < 3; i++) t.walk.update(50);
  assert.equal(t.walk.player.sneaking, true);
  t.doc.dispatchEvent(new FakeEvent('mousemove', { movementX: 0, movementY: 0, ctrlKey: false, shiftKey: false }));
  for (let i = 0; i < 3; i++) t.walk.update(50);
  assert.equal(t.walk.player.sneaking, false);

  // Die Modifikatortaste selbst zählt, auch wenn ihr eigenes keydown den Zustand noch nicht meldet
  t.key('keydown', 'ShiftLeft');
  for (let i = 0; i < 3; i++) t.walk.update(50);
  assert.equal(t.walk.player.sneaking, true);
  t.key('keyup', 'ShiftLeft');
});

test('Strg gehalten, dann Esc, Fensterwechsel oder Ausschalten: keine Schließen-Rückfrage bleibt zurück', () => {
  for (const [label, release] of [
    ['Esc', (t) => t.key('keydown', 'Escape', { ctrlKey: true })],
    ['Fensterwechsel', (t) => t.win.dispatchEvent(new FakeEvent('blur'))],
    ['Ausschalten', (t) => { t.walk.enabled = false; }],
    ['Cmd', (t) => t.key('keydown', 'MetaLeft', { ctrlKey: true, metaKey: true })],
  ]) {
    const t = setup();
    const guarded = () => {
      const event = new FakeEvent('beforeunload');
      t.win.dispatchEvent(event);
      return event.defaultPrevented;
    };
    t.key('keydown', 'ControlLeft', { ctrlKey: true });
    assert.equal(guarded(), true, `${label}: Rückfrage solange Strg gehalten`);
    release(t);
    // Das keyup von Strg kommt nie an (z. B. losgelassen, während das Fenster im Hintergrund war)
    assert.equal(guarded(), false, `${label}: Rückfrage aufgehoben`);
    t.walk.enabled = true;
    assert.equal(guarded(), false, `${label}: auch nach dem Wiedereintritt`);
  }
});

test('keyup von Alt, Cmd oder Windows-Taste ohne vorheriges keydown lässt alles los', () => {
  for (const code of ['AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']) {
    const t = setup();
    t.key('keydown', 'KeyW');
    t.key('keydown', 'KeyD');
    assert.ok(moved(t.walk) > WALKING, `${code}: läuft`);
    // Das keydown sah die Seite nicht (z. B. gedrückt, während der Fokus woanders lag)
    t.key('keyup', code);
    assert.ok(moved(t.walk) < STANDING, `${code}: steht`);
  }
});

test('Jedes keyup beendet seine Taste, auch wenn der Fokus inzwischen woanders liegt', () => {
  const t = setup();
  t.key('keydown', 'KeyW');
  t.doc.activeElement = t.other;
  assert.ok(moved(t.walk) > WALKING);
  t.key('keyup', 'KeyW');
  assert.ok(moved(t.walk) < STANDING);
  // Ohne Fokus und ohne Sperre zählt ein neues keydown nicht
  t.key('keydown', 'KeyW');
  assert.ok(moved(t.walk) < STANDING);
});

test('Einrasten (#latched): ein Tipp innerhalb eines Ticks zählt einmal und bleibt nicht hängen', () => {
  const t = setup();
  t.key('keydown', 'KeyW');
  t.key('keyup', 'KeyW');
  t.walk.update(50);
  assert.ok(t.walk.player.z > 0.5, 'der kurze Tipp bewegt');
  assert.ok(moved(t.walk) < STANDING, 'danach steht die Figur');
  // Loslassen aller Tasten vor dem nächsten Tick verwirft auch den eingerasteten Tipp
  const z = t.walk.player.z;
  t.key('keydown', 'KeyW');
  t.win.dispatchEvent(new FakeEvent('blur'));
  t.walk.update(50);
  assert.ok(Math.abs(t.walk.player.z - z) < 1e-6);
  // Doppeltipp Leertaste → Fliegen; danach schwebt die Figur ohne Tasten
  for (const type of ['keydown', 'keyup']) t.key(type, 'Space');
  t.walk.update(50);
  t.walk.update(50);
  for (const type of ['keydown', 'keyup']) t.key(type, 'Space');
  t.walk.update(50);
  assert.equal(t.walk.player.flying, true, 'zwei kurze Tipps innerhalb von 7 Ticks');
  for (let i = 0; i < 20; i++) t.walk.update(50);
  const y = t.walk.player.y;
  for (let i = 0; i < 20; i++) t.walk.update(50);
  assert.ok(Math.abs(t.walk.player.y - y) < 0.01, 'schwebt');
});

test('Ziehen: Fehler beim Fangen (Sperre angefragt) wirft nicht; Maus ohne Taste beendet ein hängendes Ziehen', () => {
  const t = setup({ lockPending: true });
  assert.doesNotThrow(() => t.pointer(t.el, 'pointerdown', { clientX: 100, clientY: 100 }));
  t.pointer(t.el, 'pointermove', { clientX: 120, clientY: 100 });
  const yaw = t.walk.player.yaw;
  assert.ok(Math.abs(yaw - 20 * 0.15 * 2) < 1e-9, `Ziehen dreht: ${yaw}`);
  // pointerup ging verloren (z. B. Kontextmenü); die nächste Bewegung meldet keine Taste mehr
  t.pointer(t.el, 'pointermove', { clientX: 140, clientY: 100, buttons: 0 });
  t.pointer(t.el, 'pointermove', { clientX: 300, clientY: 100, buttons: 0 });
  assert.equal(t.walk.player.yaw, yaw, 'kein Drehen ohne gedrückte Taste');
  // Neues Ziehen geht wieder
  t.pointer(t.el, 'pointerdown', { clientX: 0, clientY: 0, button: 2, buttons: 2 });
  t.pointer(t.el, 'pointermove', { clientX: 10, clientY: 0, buttons: 2 });
  assert.ok(t.walk.player.yaw > yaw);
});

test('Touch: Blick-Ziehen endet, wenn kein Finger mehr auf dem Bildschirm ist', () => {
  const t = setup();
  t.pointer(t.el, 'pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 50, clientY: 50 });
  t.pointer(t.el, 'pointermove', { pointerId: 7, pointerType: 'touch', clientX: 60, clientY: 50 });
  const yaw = t.walk.player.yaw;
  assert.ok(yaw > 0);
  // pointerup kam nicht an, aber touchend meldet: kein Finger mehr
  t.doc.dispatchEvent(new FakeEvent('touchend', { touches: [] }));
  t.pointer(t.el, 'pointermove', { pointerId: 7, pointerType: 'touch', clientX: 200, clientY: 50 });
  assert.equal(t.walk.player.yaw, yaw);
  // Ein pointerup irgendwo auf der Seite beendet das Ziehen ebenso
  t.pointer(t.el, 'pointerdown', { pointerId: 8, pointerType: 'touch', clientX: 50, clientY: 50 });
  t.pointer(t.doc, 'pointerup', { pointerId: 8, pointerType: 'touch' });
  t.pointer(t.el, 'pointermove', { pointerId: 8, pointerType: 'touch', clientX: 200, clientY: 50 });
  assert.equal(t.walk.player.yaw, yaw);
});

test('dispose entfernt alle Listener: danach bewegen Ereignisse nichts mehr', () => {
  const t = setup();
  t.walk.dispose();
  t.key('keydown', 'KeyW');
  assert.equal(t.walk.update(50), false);
  assert.equal(t.walk.enabled, false);
});
