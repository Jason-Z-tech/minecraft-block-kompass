import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from '../../js/core/builder.js';
import { getProp } from '../../js/core/blockstate.js';
import { clearBlockData } from '../../js/core/block-data.js';
import { loadFixtureData, blockMap } from '../fixtures/core/setup.mjs';

loadFixtureData();

function finalize(fn, options) {
  const b = new Builder(options);
  fn(b);
  const result = b.finalize();
  const [ox, oy, oz] = result.offset;
  result.at = (x, y, z) => result.volume.get(x - ox, y - oy, z - oz);
  result.stepAt = (x, y, z) => result.volume.getStep(x - ox, y - oy, z - oz);
  return result;
}

test('Kapitel ohne step(): ein Schritt pro Ebene, Blöcke vor phase() im Kapitel „Aufbau“', () => {
  const r = finalize((b) => {
    b.set(0, -5, 0, 'stone');
    b.phase('Turm', 'Bau den Turm.', { tips: ['Fang unten an.'] });
    b.fill(0, -4, 0, 0, -2, 0, 'cobblestone');
    b.set(3, 0, 3, 'dirt');
  });
  assert.deepEqual(r.offset, [0, -5, 0]);
  assert.deepEqual(r.size, [4, 6, 4]);
  assert.deepEqual(r.phases.map((p) => [p.title, p.steps]), [['Aufbau', [0]], ['Turm', [1, 2, 3, 4]]]);
  assert.deepEqual(r.phases[1].tips, ['Fang unten an.']);
  assert.deepEqual(r.steps.map((s) => [s.title, s.layerY, s.blockCount]), [
    ['Ebene 1', 0, 1], ['Ebene 2', 1, 1], ['Ebene 3', 2, 1], ['Ebene 4', 3, 1], ['Ebene 6', 5, 1],
  ]);
  assert.equal(r.stepAt(0, -5, 0), 0);
  assert.equal(r.stepAt(3, 0, 3), 4);
  assert.deepEqual(r.steps[4].materials, [['dirt', 1]]);
});

test('Kapitel mit step(): genau diese Schritte, Vor-Schritt mit Kapiteltitel, leere Schritte bleiben', () => {
  const r = finalize((b) => {
    b.phase('Technik', 'Die Schaltung.');
    b.set(0, 0, 0, 'stone');
    b.step('Leitung', 'Leg den Staub.');
    b.set(1, 0, 0, 'redstone_wire');
    b.set(2, 0, 0, 'redstone_wire');
    b.step('Hebel umlegen', 'Jetzt testen.');
    b.note(1, 0, 0, 'Hier den Hebel umlegen');
    b.phase('Ohne Vor-Schritt');
    b.step('Nur ein Schritt');
    b.set(0, 3, 0, 'glass');
  });
  assert.deepEqual(r.steps.map((s) => [s.title, s.text, s.layerY, s.blockCount]), [
    ['Technik', '', null, 1], ['Leitung', 'Leg den Staub.', null, 2], ['Hebel umlegen', 'Jetzt testen.', null, 0], ['Nur ein Schritt', '', null, 1],
  ]);
  assert.deepEqual(r.notes, [{ x: 1, y: 0, z: 0, text: 'Hier den Hebel umlegen', step: 2 }]);
  assert.deepEqual(r.steps[1].materials, [['redstone', 2]]);
});

test('Überschreiben: letzter Zustand und sein Kapitel gelten, remove entfernt', () => {
  const r = finalize((b) => {
    b.phase('A');
    b.fill(0, 0, 0, 2, 0, 0, 'stone');
    b.phase('B');
    b.set(1, 0, 0, 'dirt');
    b.remove(2, 0, 0);
  });
  assert.equal(r.blockCount, 2);
  assert.equal(r.at(1, 0, 0), 'dirt');
  assert.equal(r.stepAt(1, 0, 0), 1);
  assert.deepEqual(r.materials, [['dirt', 1], ['stone', 1]]);
});

test('Grenzen: maxBlocks und maxSize mit deutscher Meldung', () => {
  const small = new Builder({ maxBlocks: 10 });
  small.fill(0, 0, 0, 9, 0, 0, 'stone');
  assert.throws(() => small.set(0, 1, 0, 'stone'), /Zu viele Blöcke: mehr als 10/);
  const narrow = new Builder({ maxSize: 8 });
  narrow.set(0, 0, 0, 'stone');
  narrow.set(7, 0, 0, 'stone');
  assert.throws(() => narrow.set(8, 0, 0, 'stone'), /x-Kante 9 Blöcke, erlaubt sind höchstens 8/);
  assert.throws(() => new Builder({ maxSize: 8 }).cylinder(0, 0, 0, 10, 1, 'stone'), /zu groß/);
  // Wieder entfernte Blöcke zählen für die Größe nicht mehr
  const moved = new Builder({ maxSize: 8 });
  moved.set(-20, 0, 0, 'stone');
  moved.remove(-20, 0, 0);
  moved.set(0, 0, 0, 'stone');
  moved.set(7, 0, 0, 'stone');
  assert.equal(moved.blockCount, 2);
});

test('Fehler bei unbekannten Blöcken, falschen Werten und Optionen; finalize nur einmal', () => {
  const b = new Builder();
  assert.throws(() => b.set(0, 0, 0, 'banana_block'), /Unbekannter Block „banana_block“/);
  assert.throws(() => b.set(0, 0, 0, 'oak_stairs[facing=up]'), /Ungültiger Wert „up“/);
  assert.throws(() => b.fill(0, 0, 0, 1, 1, 1, 'stone', { holow: true }), /unbekannte Option „holow“/);
  assert.throws(() => b.set(0.5, 0, 0, 'stone'), /ganze Zahl/);
  assert.throws(() => b.phase(''), /darf nicht leer sein/);
  assert.throws(() => b.door(0, 0, 0, 'oak_planks'), /kein passender Block/);
  assert.throws(() => b.tall(0, 0, 0, 'poppy'), /keine doppelt hohe Pflanze/);
  b.set(0, 0, 0, 'stone');
  b.finalize();
  assert.throws(() => b.finalize(), /schon abgeschlossen/);
  assert.throws(() => b.set(1, 0, 0, 'stone'), /schon abgeschlossen/);
});

test('fill mit hollow, outline, replace und keep', () => {
  const r = finalize((b) => {
    b.fill(0, 0, 0, 4, 4, 4, 'stone', { hollow: true });
    b.fill(0, 0, 0, 4, 4, 4, 'cobblestone', { outline: true });
    b.fill(0, 0, 0, 4, 0, 4, 'dirt', { replace: 'stone' });
    b.fill(1, 1, 1, 3, 3, 3, 'glass', { keep: true });
    b.fill(0, 4, 0, 4, 4, 4, 'oak_planks', { replace: ['air', 'minecraft:stone'] });
  });
  assert.equal(r.at(2, 2, 2), 'glass');
  assert.equal(r.at(2, 0, 2), 'dirt');
  assert.equal(r.at(0, 0, 0), 'cobblestone');
  assert.equal(r.at(2, 4, 2), 'oak_planks');
  assert.equal(r.at(0, 4, 0), 'cobblestone');
  assert.equal(r.at(0, 2, 2), 'stone');
  assert.equal(r.blockCount, 125);
});

test('Bauteile: Tür, Bett, doppelte Pflanze, Treppe, Stufe', () => {
  const r = finalize((b) => {
    b.door(0, 0, 0, 'oak_door', { facing: 'east', hinge: 'right', open: true });
    b.bed(3, 0, 0, 'red_bed', { facing: 'south' });
    b.tall(6, 0, 0, 'sunflower');
    b.stairs(8, 0, 0, 'oak_stairs', { facing: 'west', half: 'top' });
    b.slab(9, 0, 0, 'oak_slab', { type: 'top' });
  });
  assert.equal(r.at(0, 0, 0), 'oak_door[facing=east,half=lower,hinge=right,open=true,powered=false]');
  assert.equal(r.at(0, 1, 0), 'oak_door[facing=east,half=upper,hinge=right,open=true,powered=false]');
  assert.equal(r.at(3, 0, 0), 'red_bed[facing=south,occupied=false,part=foot]');
  assert.equal(r.at(3, 0, 1), 'red_bed[facing=south,occupied=false,part=head]');
  assert.equal(r.at(6, 1, 0), 'sunflower[half=upper]');
  assert.equal(r.at(8, 0, 0), 'oak_stairs[facing=west,half=top,shape=straight,waterlogged=false]');
  assert.equal(r.at(9, 0, 0), 'oak_slab[type=top,waterlogged=false]');
});

// Querschnitt quer zum First: Zeichen je Spalte (v/^/>/< = Treppe mit facing S/N/O/W, _ = Stufe, # = full)
function profile(r, fixed, y, from, to, axis) {
  let line = '';
  for (let v = from; v <= to; v++) {
    const s = axis === 'x' ? r.at(fixed, y, v) : r.at(v, y, fixed);
    const facing = getProp(s, 'facing');
    if (s.includes('_stairs')) line += { south: 'v', north: '^', east: '>', west: '<' }[facing];
    else if (s.includes('_slab')) line += '_';
    else if (s === 'air') line += '.';
    else line += '#';
  }
  return line;
}

test('Satteldach: ungerade Breite mit Stufen-First, gerade Breite treffen sich, Überstand, Giebel', () => {
  const odd = finalize((b) => {
    b.walls(0, 0, 0, 6, 2, 4, 'cobblestone');
    b.roof({ x1: 0, z1: 0, x2: 6, z2: 4, y: 3, stairs: 'oak_stairs', slab: 'oak_slab', full: 'oak_planks', overhang: 1 });
  });
  // Breite 5 + 2 Überstand = 7 → Reihen y 3, 4, 5 und First (Stufe) auf y 6
  assert.equal(profile(odd, 3, 3, -1, 5, 'x'), 'v.....^');
  assert.equal(profile(odd, 3, 6, -1, 5, 'x'), '..._...');
  assert.equal(profile(odd, 0, 4, -1, 5, 'x'), '.v###^.', 'Giebel am Westende gefüllt');
  assert.equal(profile(odd, 3, 4, -1, 5, 'x'), '.v...^.', 'innen hohl');
  assert.equal(odd.at(-1, 3, 2), 'air');
  assert.equal(odd.at(7, 4, 0), 'oak_stairs[facing=south,half=bottom,shape=straight,waterlogged=false]');
  const even = finalize((b) => {
    b.roof({ x1: 0, z1: 0, x2: 3, z2: 5, y: 0, axis: 'z', stairs: 'oak_stairs', full: 'oak_planks' });
  });
  assert.equal(profile(even, 2, 0, 0, 3, 'z'), '>..<');
  assert.equal(profile(even, 2, 1, 0, 3, 'z'), '.><.');
  assert.equal(profile(even, 0, 0, 0, 3, 'z'), '>##<', 'Giebel an der Nordseite');
  assert.equal(profile(even, 5, 0, 0, 3, 'z'), '>##<', 'Giebel an der Südseite');
  assert.equal(even.size[1], 2);
});

test('Satteldach: Giebel ohne full gibt Warnung, hollow: false füllt alles', () => {
  const b = new Builder();
  b.roof({ x1: 0, z1: 0, x2: 4, z2: 4, y: 0, stairs: 'oak_stairs', slab: 'oak_slab' });
  assert.deepEqual(b.finalize().warnings, ['roof: Giebel offen gelassen (kein full-Block angegeben).']);
  const solid = finalize((b2) => b2.roof({ x1: 0, z1: 0, x2: 4, z2: 4, y: 0, stairs: 'oak_stairs', full: 'oak_planks', hollow: false }));
  assert.equal(profile(solid, 2, 1, 0, 4, 'x'), '.v#^.');
  assert.equal(profile(solid, 2, 0, 0, 4, 'x'), 'v###^');
  assert.throws(() => new Builder().roof({ x1: 0, z1: 0, x2: 4, z2: 4, y: 0, stairs: 'oak_stairs' }), /ungerader Breite/);
  assert.throws(() => new Builder().roof({ x1: 0, z1: 0, x2: 3, z2: 3, y: 0, stairs: 'oak_stairs', hollow: false }), /hollow: false/);
});

test('Walmdach: Außenecken an allen Ecken, First bei ungerader Breite', () => {
  const r = finalize((b) => b.roof({ x1: 0, z1: 0, x2: 6, z2: 4, y: 0, type: 'hip', stairs: 'oak_stairs', slab: 'oak_slab' }));
  for (const [x, z] of [[0, 0], [6, 0], [6, 4], [0, 4], [1, 1], [5, 1], [5, 3], [1, 3]]) {
    const y = Math.min(x, z, 6 - x, 4 - z);
    assert.equal(getProp(r.at(x, y, z), 'shape'), 'outer_right', `${x},${z}`);
  }
  assert.equal(getProp(r.at(3, 0, 0), 'facing'), 'south');
  assert.equal(getProp(r.at(0, 0, 2), 'facing'), 'east');
  assert.equal(getProp(r.at(3, 1, 3), 'shape'), 'straight');
  for (let x = 2; x <= 4; x++) assert.equal(r.at(x, 2, 2), 'oak_slab[type=bottom,waterlogged=false]');
  assert.equal(r.size[1], 3);
});

test('Zeltdach: gerade Seitenlänge endet in vier Außenecken (Windrad), ungerade in einer Spitze', () => {
  const even = finalize((b) => b.roof({ x1: 0, z1: 0, x2: 5, z2: 5, y: 0, type: 'pyramid', stairs: 'oak_stairs' }));
  for (const [x, z] of [[2, 2], [3, 2], [3, 3], [2, 3]]) assert.equal(getProp(even.at(x, 2, z), 'shape'), 'outer_right', `${x},${z}`);
  assert.equal(even.size[1], 3);
  const odd = finalize((b) => b.roof({ x1: 0, z1: 0, x2: 4, z2: 4, y: 0, type: 'pyramid', stairs: 'oak_stairs', full: 'oak_planks', overhang: 1 }));
  assert.equal(odd.at(2, 3, 2), 'oak_planks');
  assert.equal(odd.size[1], 4);
  assert.throws(() => new Builder().roof({ x1: 0, z1: 0, x2: 5, z2: 3, y: 0, type: 'pyramid', stairs: 'oak_stairs' }), /quadratische Fläche/);
});

test('Flachdach und gedrehtes Dach', () => {
  const flat = finalize((b) => b.roof({ x1: 0, z1: 0, x2: 2, z2: 2, y: 5, type: 'flat', slab: 'oak_slab', overhang: 1 }));
  assert.equal(flat.blockCount, 25);
  assert.equal(flat.at(-1, 5, -1), 'oak_slab[type=bottom,waterlogged=false]');
  const turned = finalize((b) => b.transform({ rotate: 90 }, () => b.roof({ x1: 0, z1: 0, x2: 6, z2: 3, y: 0, stairs: 'oak_stairs', full: 'oak_planks' })));
  const facings = new Set();
  turned.volume.forEach((x, y, z, s) => {
    if (s.includes('stairs')) facings.add(getProp(s, 'facing'));
  });
  assert.deepEqual([...facings].sort(), ['east', 'west']);
});

test('Wendeltreppe: eine Treppe pro Ebene, Laufrichtung = facing, Kern', () => {
  const r = finalize((b) => b.spiralStairs(0, 0, 0, 9, 1, 'oak_stairs', { core: 'stone_bricks' }));
  const path = [];
  for (let y = 0; y <= 9; y++) {
    r.volume.forEach((x, yy, z, s) => {
      if (yy === y && s.includes('stairs')) path.push([x + r.offset[0], z + r.offset[2], getProp(s, 'facing')]);
    });
  }
  assert.equal(path.length, 10);
  assert.deepEqual(path.slice(0, 4), [[0, -1, 'east'], [1, -1, 'south'], [1, 0, 'south'], [1, 1, 'west']]);
  for (let i = 0; i + 1 < path.length; i++) {
    const [x, z, facing] = path[i];
    const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
    assert.deepEqual([x + step[0], z + step[1]], path[i + 1].slice(0, 2), `Schritt ${i}`);
  }
  assert.equal(r.at(0, 5, 0), 'stone_bricks');
  const ccw = finalize((b) => b.spiralStairs(0, 0, 0, 1, 2, 'oak_stairs', { clockwise: false }));
  assert.equal(getProp(ccw.at(0, 0, -2), 'facing'), 'west');
});

test('Zufall im Builder ist deterministisch (seed)', () => {
  const run = (seed) => {
    const b = new Builder({ seed });
    return [b.rng(), b.rngInt(1, 6), b.pick(['a', 'b', 'c']), b.pickWeighted([['x', 1], ['y', 3]]), b.chance(0.5)];
  };
  assert.deepEqual(run('haus'), run('haus'));
  assert.notDeepEqual(run('haus'), run('turm'));
});

test('Leerer Bau und Bau ohne Blockdaten liefern Warnungen statt still zu scheitern', () => {
  const empty = new Builder().finalize();
  assert.deepEqual(empty.size, [0, 0, 0]);
  assert.deepEqual(empty.warnings, ['Der Bau enthält keine Blöcke.']);
  clearBlockData();
  try {
    const b = new Builder();
    b.stairs(0, 0, 0, 'oak_stairs', { facing: 'east' });
    b.stairs(1, 0, 0, 'oak_stairs', { facing: 'north' });
    const r = b.finalize();
    assert.match(r.warnings[0], /Blockdaten nicht geladen/);
    assert.equal(blockMap(r.volume).get('0,0,0'), 'oak_stairs[facing=east,half=bottom,shape=outer_left]');
  } finally {
    loadFixtureData();
  }
});
