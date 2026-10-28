// Orbit-Ansicht: Pfeiltasten bleiben nicht hängen, wenn der Browser ein keyup verschluckt (macOS: bei gehaltener
// Cmd-Taste kommt kein keyup der anderen Tasten). Nachgestellt mit einem kleinen DOM aus EventTarget (Node).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrbitControls } from '../../js/render/controls.js';

class FakeEvent extends Event {
  constructor(type, init = {}) {
    super(type, { cancelable: true });
    for (const [key, value] of Object.entries(init)) Object.defineProperty(this, key, { value, enumerable: true });
  }
}

function setup() {
  const win = new EventTarget();
  const doc = new EventTarget();
  Object.assign(doc, { defaultView: win });
  const el = new EventTarget();
  Object.assign(el, { ownerDocument: doc, style: {}, clientHeight: 600, hasAttribute: () => true });
  const orbit = new OrbitControls(el, { distance: 30, yaw: 0, pitch: 0.3 });
  const key = (type, code, mods = {}) => {
    const event = new FakeEvent(type, { code, key: code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, target: el, ...mods });
    el.dispatchEvent(event);
    return event;
  };
  return { win, el, orbit, key };
}

// Drehung (Bogenmaß, über ±π hinweg) in 1 s, nachdem die Glättung (70 ms) 2 s auslaufen konnte
function turned(orbit) {
  for (let i = 0; i < 40; i++) orbit.update(50);
  const yaw = orbit.orbit.yaw;
  for (let i = 0; i < 20; i++) orbit.update(50);
  const delta = orbit.orbit.yaw - yaw;
  return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
}

const TURNING = 0.5;
const STILL = 1e-6;

test('Grundfall: Pfeil links dreht, keyup hält an; Loslassen ohne Drücken ist harmlos', () => {
  const t = setup();
  t.key('keyup', 'ArrowRight');
  assert.ok(turned(t.orbit) < STILL);
  const down = t.key('keydown', 'ArrowLeft');
  assert.equal(down.defaultPrevented, true);
  assert.ok(turned(t.orbit) > TURNING, 'dreht');
  t.key('keyup', 'ArrowLeft');
  assert.ok(turned(t.orbit) < STILL, 'steht');
});

test('macOS: Pfeil halten, Cmd dazu, Pfeil los ohne keyup, Cmd los → steht', () => {
  const t = setup();
  t.key('keydown', 'ArrowLeft');
  t.key('keydown', 'MetaLeft', { metaKey: true });
  // kein keyup für ArrowLeft (macOS)
  t.key('keyup', 'MetaLeft');
  assert.ok(turned(t.orbit) < STILL);
  // auch ein keyup von Alt, Cmd oder Windows-Taste allein (ohne keydown) lässt los
  for (const code of ['AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']) {
    t.key('keydown', 'ArrowRight');
    t.key('keyup', code);
    assert.ok(turned(t.orbit) < STILL, code);
  }
  // Kombinationen mit Alt oder Cmd drehen nicht und lassen gehaltene Tasten los
  t.key('keydown', 'ArrowUp');
  const combo = t.key('keydown', 'ArrowLeft', { altKey: true });
  assert.equal(combo.defaultPrevented, false, 'gehört dem Browser');
  assert.ok(turned(t.orbit) < STILL);
});

test('Esc stoppt jede Drehung; Fokus- und Fensterwechsel lassen los', () => {
  const t = setup();
  t.key('keydown', 'ArrowLeft');
  assert.ok(turned(t.orbit) > TURNING);
  const esc = t.key('keydown', 'Escape');
  assert.equal(esc.defaultPrevented, false, 'Esc bleibt für die Seite');
  assert.ok(turned(t.orbit) < STILL, 'Esc stoppt');
  for (const leave of [() => t.el.dispatchEvent(new FakeEvent('blur')), () => t.win.dispatchEvent(new FakeEvent('blur'))]) {
    t.key('keydown', 'ArrowLeft');
    leave();
    assert.ok(turned(t.orbit) < STILL);
  }
  // Danach geht alles wie gewohnt
  t.key('keydown', 'ArrowLeft');
  assert.ok(turned(t.orbit) > TURNING);
});

test('Ausschalten (Lauf-Modus) und dispose lassen los; dispose entfernt auch den Fenster-Listener', () => {
  const t = setup();
  t.key('keydown', 'ArrowLeft');
  t.orbit.enabled = false;
  t.orbit.enabled = true;
  assert.ok(turned(t.orbit) < STILL);
  t.orbit.dispose();
  t.key('keydown', 'ArrowLeft');
  assert.ok(turned(t.orbit) < STILL);
});
