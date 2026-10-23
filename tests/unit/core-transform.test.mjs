import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTransform, composeTransforms, invertTransform, applyToPoint, transformState, rotateState, mirrorState, transformDirection, decompose } from '../../js/core/transform.js';
import { Builder } from '../../js/core/builder.js';
import { loadFixtureData, blockMap } from '../fixtures/core/setup.mjs';

loadFixtureData();

test('Positionen: Drehung im Uhrzeigersinn von oben, Spiegeln, Verschieben', () => {
  const r90 = makeTransform({ rotate: 90 });
  assert.deepEqual(applyToPoint(r90, 1, 5, 0), [0, 5, 1]); // Osten → Süden
  assert.deepEqual(applyToPoint(r90, 0, 0, -1), [1, 0, 0]); // Norden → Osten
  assert.deepEqual(applyToPoint(makeTransform({ rotate: 180 }), 2, 0, 3), [-2, 0, -3]);
  assert.deepEqual(applyToPoint(makeTransform({ rotate: 270 }), 1, 0, 0), [0, 0, -1]);
  assert.deepEqual(applyToPoint(makeTransform({ rotate: -90 }), 1, 0, 0), [0, 0, -1]);
  assert.deepEqual(applyToPoint(makeTransform({ mirror: 'x' }), 3, 1, 2), [-3, 1, 2]);
  assert.deepEqual(applyToPoint(makeTransform({ mirror: 'z' }), 3, 1, 2), [3, 1, -2]);
  // erst spiegeln, dann drehen, dann verschieben
  assert.deepEqual(applyToPoint(makeTransform({ offset: [5, 1, 0], rotate: 90, mirror: 'x' }), 1, 0, 0), [5, 1, -1]);
  assert.throws(() => makeTransform({ rotate: 45 }), /Vielfaches von 90/);
  assert.throws(() => makeTransform({ mirror: 'y' }), /mirror/);
  assert.throws(() => makeTransform({ offset: [0.5, 0, 0] }), /offset/);
});

test('Verschachtelung und Umkehrung', () => {
  const outer = makeTransform({ offset: [10, 0, 0] });
  const inner = makeTransform({ rotate: 90 });
  const both = composeTransforms(outer, inner);
  assert.deepEqual(applyToPoint(both, 1, 0, 0), [10, 0, 1]);
  const complex = composeTransforms(makeTransform({ offset: [3, 2, -7], rotate: 270, mirror: 'z' }), makeTransform({ offset: [1, 0, 4], rotate: 90 }));
  const inv = invertTransform(complex);
  for (const p of [[0, 0, 0], [5, -3, 2], [-8, 1, 9]]) {
    assert.deepEqual(applyToPoint(inv, ...applyToPoint(complex, ...p)), p);
  }
  assert.deepEqual(decompose(makeTransform({ mirror: 'z' })), { mirrored: true, turns: 2 });
});

test('facing, axis und Seiten-Eigenschaften drehen in alle Richtungen', () => {
  const expected = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };
  for (const [deg, dir] of Object.entries(expected)) {
    assert.equal(rotateState('oak_stairs[facing=north,half=bottom]', Number(deg)), `oak_stairs[facing=${dir},half=bottom]`);
  }
  assert.equal(rotateState('observer[facing=up]', 90), 'observer[facing=up]');
  assert.equal(rotateState('oak_log[axis=x]', 90), 'oak_log[axis=z]');
  assert.equal(rotateState('oak_log[axis=x]', 180), 'oak_log[axis=x]');
  assert.equal(rotateState('oak_log[axis=y]', 270), 'oak_log[axis=y]');
  assert.equal(rotateState('oak_fence[east=false,north=true,south=false,west=true]', 90), 'oak_fence[east=true,north=true,south=false,west=false]');
  assert.equal(rotateState('redstone_wire[east=none,north=up,south=side,west=none]', 180), 'redstone_wire[east=none,north=side,south=up,west=none]');
  assert.equal(mirrorState('cobblestone_wall[east=tall,north=low,south=none,up=true,west=none]', 'x'), 'cobblestone_wall[east=none,north=low,south=none,up=true,west=tall]');
  assert.equal(transformDirection(makeTransform({ rotate: 270 }), 'south'), 'east');
});

test('rotation 0–15 (Schilder, Banner, Köpfe)', () => {
  assert.equal(rotateState('oak_sign[rotation=0]', 90), 'oak_sign[rotation=4]'); // Süden → Westen
  assert.equal(rotateState('oak_sign[rotation=14]', 90), 'oak_sign[rotation=2]');
  assert.equal(rotateState('white_banner[rotation=3]', 180), 'white_banner[rotation=11]');
  assert.equal(mirrorState('skeleton_skull[rotation=4]', 'x'), 'skeleton_skull[rotation=12]'); // Westen → Osten
  assert.equal(mirrorState('skeleton_skull[rotation=1]', 'x'), 'skeleton_skull[rotation=15]');
  assert.equal(mirrorState('oak_sign[rotation=0]', 'z'), 'oak_sign[rotation=8]'); // Süden → Norden
  assert.equal(mirrorState('oak_sign[rotation=4]', 'z'), 'oak_sign[rotation=4]');
});

test('Schienen inklusive ascending und Kurven', () => {
  assert.equal(rotateState('rail[shape=north_south]', 90), 'rail[shape=east_west]');
  assert.equal(rotateState('rail[shape=ascending_north]', 90), 'rail[shape=ascending_east]');
  assert.equal(rotateState('rail[shape=south_east]', 90), 'rail[shape=south_west]');
  assert.equal(rotateState('rail[shape=north_east]', 180), 'rail[shape=south_west]');
  assert.equal(mirrorState('rail[shape=south_east]', 'x'), 'rail[shape=south_west]');
  assert.equal(mirrorState('powered_rail[shape=ascending_east]', 'x'), 'powered_rail[shape=ascending_west]');
  assert.equal(mirrorState('rail[shape=ascending_north]', 'z'), 'rail[shape=ascending_south]');
});

test('Spiegeln tauscht links/rechts: Treppenform, Scharnier, Truhen-type; Drehen nicht', () => {
  assert.equal(mirrorState('oak_stairs[facing=east,shape=outer_left]', 'x'), 'oak_stairs[facing=west,shape=outer_right]');
  assert.equal(mirrorState('oak_stairs[facing=north,shape=inner_right]', 'x'), 'oak_stairs[facing=north,shape=inner_left]');
  assert.equal(rotateState('oak_stairs[facing=north,shape=inner_right]', 90), 'oak_stairs[facing=east,shape=inner_right]');
  assert.equal(mirrorState('oak_door[facing=north,half=lower,hinge=left]', 'z'), 'oak_door[facing=south,half=lower,hinge=right]');
  assert.equal(rotateState('oak_door[facing=north,hinge=left]', 90), 'oak_door[facing=east,hinge=left]');
  assert.equal(mirrorState('chest[facing=north,type=left]', 'x'), 'chest[facing=north,type=right]');
  assert.equal(mirrorState('oak_slab[type=top]', 'x'), 'oak_slab[type=top]');
});

test('orientation von Crafter und Verbund-Block', () => {
  assert.equal(rotateState('crafter[orientation=north_up]', 90), 'crafter[orientation=east_up]');
  assert.equal(rotateState('crafter[orientation=down_north]', 270), 'crafter[orientation=down_west]');
  assert.equal(mirrorState('jigsaw[orientation=down_north]', 'z'), 'jigsaw[orientation=down_south]');
  assert.equal(mirrorState('jigsaw[orientation=up_west]', 'x'), 'jigsaw[orientation=up_east]');
  assert.equal(transformState('jigsaw[orientation=west_up]', makeTransform({ rotate: 180, mirror: 'z' })), 'jigsaw[orientation=east_up]');
});

// Eine gedrehte/gespiegelte Treppen-Anordnung muss dieselben Formen bekommen wie die
// gedrehten/gespiegelten Formen der Original-Anordnung (Transform und Auto-Verbindung passen zusammen).
test('Drehen/Spiegeln passt zur automatischen Treppenform (verschachtelt)', () => {
  const layout = (b) => {
    b.stairs(0, 0, 0, 'oak_stairs', { facing: 'east' });
    b.stairs(1, 0, 0, 'oak_stairs', { facing: 'north' });
    b.stairs(1, 0, 1, 'oak_stairs', { facing: 'north' });
    b.stairs(3, 0, 3, 'oak_stairs', { facing: 'south' });
    b.stairs(3, 0, 4, 'oak_stairs', { facing: 'west' });
    b.stairs(5, 0, 0, 'oak_stairs', { facing: 'west', half: 'top' });
    b.stairs(5, 0, 1, 'oak_stairs', { facing: 'north', half: 'top' });
    b.stairs(8, 0, 0, 'oak_stairs', { facing: 'north' });
    b.stairs(8, 0, 1, 'oak_stairs', { facing: 'east' });
    b.stairs(8, 0, 5, 'oak_stairs', { facing: 'south' });
    b.stairs(8, 0, 4, 'oak_stairs', { facing: 'east' });
  };
  const plain = new Builder();
  layout(plain);
  const base = plain.finalize();
  const shapes = new Set(base.volume.palette.slice(1).map((s) => s.match(/shape=(\w+)/)[1]));
  for (const shape of ['outer_left', 'outer_right', 'inner_left', 'inner_right', 'straight']) assert.ok(shapes.has(shape), shape);
  for (const options of [{ rotate: 90 }, { rotate: 180 }, { rotate: 270 }, { mirror: 'x' }, { mirror: 'z' }, { rotate: 90, mirror: 'x' }]) {
    const t = makeTransform(options);
    const b = new Builder();
    b.transform({ offset: [7, 0, -2] }, () => b.transform(options, () => layout(b)));
    const moved = blockMap(b.finalize().volume);
    const expected = new Map();
    base.volume.forEach((x, y, z, state) => {
      expected.set(applyToPoint(t, x, y, z).join(','), transformState(state, t));
    });
    // beide auf die kleinste Ecke bringen
    const normalize = (map) => {
      const keys = [...map.keys()].map((k) => k.split(',').map(Number));
      const min = [0, 1, 2].map((i) => Math.min(...keys.map((k) => k[i])));
      return new Map([...map].map(([k, s]) => [k.split(',').map((v, i) => Number(v) - min[i]).join(','), s]));
    };
    assert.deepEqual(normalize(moved), normalize(expected), JSON.stringify(options));
  }
});

test('Builder.get liefert den Zustand in lokaler Ausrichtung', () => {
  const b = new Builder();
  b.transform({ rotate: 90, offset: [4, 0, 4] }, () => {
    b.stairs(1, 0, 0, 'oak_stairs', { facing: 'north' });
    assert.equal(b.get(1, 0, 0), 'oak_stairs[facing=north,half=bottom]');
  });
  assert.equal(b.get(4, 0, 5), 'oak_stairs[facing=east,half=bottom]');
  assert.throws(() => b.transform({ rotate: 90 }, async () => {}), /synchron/);
});
