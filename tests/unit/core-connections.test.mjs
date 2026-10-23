import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from '../../js/core/builder.js';
import { getProp } from '../../js/core/blockstate.js';
import { isFullSolid, isFullSolidState, isSturdyFull } from '../../js/core/connections.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';

loadFixtureData();

// Baut mit der Funktion und liefert get(x, y, z) in Modul-Koordinaten.
function build(fn) {
  const b = new Builder();
  fn(b);
  const result = b.finalize();
  const [ox, oy, oz] = result.offset;
  return (x, y, z) => result.volume.get(x - ox, y - oy, z - oz);
}

const sides = (state) => ['north', 'east', 'south', 'west'].map((d) => getProp(state, d)).join(' ');

test('isFullSolid erkennt volle undurchsichtige Blöcke über IDs', () => {
  for (const id of ['stone', 'oak_planks', 'stone_bricks', 'grass_block', 'oak_log', 'muddy_mangrove_roots', 'jack_o_lantern',
    'sea_lantern', 'crimson_stem', 'mushroom_stem', 'brown_mushroom_block', 'copper_bulb', 'white_wool', 'bricks', 'dispenser',
    'piston', 'sticky_piston', 'cinnabar', 'sulfur', 'bookshelf', 'chiseled_bookshelf']) {
    assert.equal(isFullSolid(id), true, id);
  }
  for (const id of ['oak_slab', 'oak_stairs', 'oak_fence', 'oak_fence_gate', 'cobblestone_wall', 'glass', 'white_stained_glass',
    'tinted_glass', 'glass_pane', 'iron_bars', 'oak_leaves', 'poppy', 'torch', 'wall_torch', 'redstone_wall_torch', 'oak_door',
    'oak_trapdoor', 'white_carpet', 'oak_sign', 'oak_wall_sign', 'oak_hanging_sign', 'oak_pressure_plate', 'stone_button', 'rail',
    'powered_rail', 'ladder', 'iron_chain', 'candle', 'white_candle', 'skeleton_skull', 'zombie_wall_head', 'red_bed', 'chest',
    'lantern', 'copper_lantern', 'potted_poppy', 'wheat', 'short_grass', 'tall_grass', 'water', 'air', 'snow', 'ice',
    'mangrove_roots', 'sculk_sensor', 'amethyst_cluster', 'small_amethyst_bud', 'pointed_dripstone', 'hopper', 'cake',
    'white_candle_cake', 'scaffolding', 'oak_shelf', 'copper_grate', 'end_rod', 'lightning_rod', 'brown_mushroom', 'kelp_plant',
    'brain_coral_wall_fan', 'white_shulker_box', 'flower_pot', 'turtle_egg', 'white_banner', 'redstone_wire', 'golden_dandelion',
    'sulfur_spike', 'copper_chest', 'copper_golem_statue', 'copper_bars', 'iron_chain', 'copper_chain', 'dried_ghast', 'vault']) {
    assert.equal(isFullSolid(id), false, id);
  }
  assert.equal(isFullSolidState('oak_slab[type=double]'), true);
  assert.equal(isFullSolidState('oak_slab[type=top]'), false);
  assert.equal(isFullSolidState('piston[extended=false,facing=up]'), true);
  assert.equal(isFullSolidState('piston[extended=true,facing=up]'), false);
  assert.equal(isSturdyFull('glass'), true);
  assert.equal(isSturdyFull('white_stained_glass'), true);
  assert.equal(isSturdyFull('glass_pane'), false);
  assert.equal(isSturdyFull('oak_leaves'), false);
});

test('Zäune: Linie, Holzgruppe, Netherziegel, volle Blöcke, Glas, Laub, Zauntor quer', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'oak_fence'); b.set(1, 0, 0, 'spruce_fence'); b.set(2, 0, 0, 'oak_fence');
    b.set(3, 0, 0, 'nether_brick_fence');
    b.set(0, 0, 5, 'oak_fence'); b.set(0, 0, 4, 'stone'); b.set(1, 0, 5, 'glass'); b.set(-1, 0, 5, 'oak_leaves'); b.set(0, 0, 6, 'melon');
    b.set(10, 0, 0, 'oak_fence'); b.set(11, 0, 0, 'oak_fence_gate[facing=north]');
    b.set(10, 0, 3, 'oak_fence'); b.set(11, 0, 3, 'oak_fence_gate[facing=east]');
  });
  assert.equal(sides(get(1, 0, 0)), 'false true false true');
  assert.equal(sides(get(2, 0, 0)), 'false false false true');
  assert.equal(sides(get(3, 0, 0)), 'false false false false');
  assert.equal(sides(get(0, 0, 5)), 'true true false false');
  assert.equal(getProp(get(10, 0, 0), 'east'), 'true');
  assert.equal(getProp(get(10, 0, 3), 'east'), 'false');
});

test('Zäune an Treppen und Stufen: nur volle Seiten verbinden', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'oak_fence');
    b.stairs(1, 0, 0, 'oak_stairs', { facing: 'west' }); // hohe Seite zum Zaun → volle Fläche
    b.stairs(0, 0, 1, 'oak_stairs', { facing: 'east' }); // Seite zum Zaun ist keine volle Fläche
    b.slab(-1, 0, 0, 'oak_slab', { type: 'double' });
    b.slab(0, 0, -1, 'oak_slab', { type: 'bottom' });
  });
  assert.equal(sides(get(0, 0, 0)), 'false true false true');
});

test('Mauern: Pfosten, low/tall, gerade Linie, Ecke, Kreuz, Fackel darauf', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'cobblestone_wall');
    for (let x = 10; x <= 12; x++) b.set(x, 0, 0, 'cobblestone_wall');
    b.set(11, 1, 0, 'stone');
    for (let x = 20; x <= 22; x++) b.set(x, 0, 0, 'cobblestone_wall');
    b.set(30, 0, 0, 'cobblestone_wall'); b.set(31, 0, 0, 'cobblestone_wall'); b.set(30, 0, 1, 'cobblestone_wall');
    for (const [x, z] of [[40, 0], [41, 0], [39, 0], [40, 1], [40, -1]]) b.set(x, 0, z, 'cobblestone_wall');
    for (let x = 50; x <= 52; x++) b.set(x, 0, 0, 'cobblestone_wall');
    b.set(51, 1, 0, 'torch');
  });
  const wall = (state) => `${sides(state)} up=${getProp(state, 'up')}`;
  assert.equal(wall(get(0, 0, 0)), 'none none none none up=true');
  assert.equal(wall(get(11, 0, 0)), 'none tall none tall up=false');
  assert.equal(wall(get(10, 0, 0)), 'none low none none up=true');
  assert.equal(wall(get(21, 0, 0)), 'none low none low up=false');
  assert.equal(wall(get(30, 0, 0)), 'none low low none up=true');
  assert.equal(wall(get(40, 0, 0)), 'low low low low up=false');
  assert.equal(wall(get(51, 0, 0)), 'none low none low up=true');
});

test('Mauern übereinander: untere Seiten tall, Pfosten wird durchgereicht', () => {
  const get = build((b) => {
    for (let y = 0; y <= 1; y++) for (let x = 0; x <= 2; x++) b.set(x, y, 0, 'cobblestone_wall');
    b.set(10, 0, 0, 'cobblestone_wall'); b.set(10, 1, 0, 'cobblestone_wall');
    b.set(9, 0, 0, 'cobblestone_wall'); b.set(11, 0, 0, 'cobblestone_wall');
  });
  assert.equal(`${sides(get(1, 0, 0))} ${getProp(get(1, 0, 0), 'up')}`, 'none tall none tall false');
  assert.equal(`${sides(get(1, 1, 0))} ${getProp(get(1, 1, 0), 'up')}`, 'none low none low false');
  // Einzelne Mauer oben hat einen Pfosten → die gerade Linie darunter bekommt auch einen
  assert.equal(getProp(get(10, 1, 0), 'up'), 'true');
  assert.equal(getProp(get(10, 0, 0), 'up'), 'true');
});

test('Glasscheiben/Gitter verbinden zu Scheiben, Gittern, Mauern und vollen Blöcken', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'stone'); b.set(1, 0, 0, 'glass_pane'); b.set(2, 0, 0, 'iron_bars'); b.set(3, 0, 0, 'cobblestone_wall');
    b.set(1, 0, 1, 'oak_fence');
    b.set(10, 0, 0, 'white_stained_glass_pane');
  });
  assert.equal(sides(get(1, 0, 0)), 'false true false true');
  assert.equal(sides(get(2, 0, 0)), 'false true false true');
  assert.equal(getProp(get(3, 0, 0), 'west'), 'low');
  assert.equal(sides(get(10, 0, 0)), 'false false false false');
});

test('Treppenform: Außen- und Innenecken wie im Spiel, half und Nachbarn beachtet', () => {
  const get = build((b) => {
    b.stairs(0, 0, 0, 'oak_stairs', { facing: 'east' }); b.stairs(1, 0, 0, 'oak_stairs', { facing: 'north' });
    b.stairs(5, 0, 0, 'oak_stairs', { facing: 'east' }); b.stairs(6, 0, 0, 'oak_stairs', { facing: 'south' });
    b.stairs(10, 0, 0, 'oak_stairs', { facing: 'north' }); b.stairs(10, 0, 1, 'oak_stairs', { facing: 'east' });
    b.stairs(15, 0, 0, 'oak_stairs', { facing: 'north' }); b.stairs(15, 0, 1, 'oak_stairs', { facing: 'west' });
    b.stairs(20, 0, 0, 'oak_stairs', { facing: 'east', half: 'top' }); b.stairs(21, 0, 0, 'oak_stairs', { facing: 'north' });
    // canTakeShape: Nachbar mit gleichem facing verhindert die Ecke
    b.stairs(30, 0, 0, 'oak_stairs', { facing: 'east' }); b.stairs(31, 0, 0, 'oak_stairs', { facing: 'north' });
    b.stairs(30, 0, 1, 'oak_stairs', { facing: 'east' });
  });
  const shape = (x, z) => getProp(get(x, 0, z), 'shape');
  assert.equal(shape(0, 0), 'outer_left');
  assert.equal(shape(5, 0), 'outer_right');
  assert.equal(shape(10, 0), 'inner_right');
  assert.equal(shape(15, 0), 'inner_left');
  assert.equal(shape(20, 0), 'straight');
  assert.equal(shape(30, 0), 'straight');
});

test('Redstone: Kreuz, Punkt, Linie, Ecke, hoch und runter', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'redstone_wire');
    b.set(5, 0, 0, 'redstone_wire[east=none,north=none,south=none,west=none]');
    for (let x = 10; x <= 12; x++) b.set(x, 0, 0, 'redstone_wire');
    b.set(20, 0, 0, 'redstone_wire'); b.set(21, 0, 0, 'redstone_wire'); b.set(20, 0, 1, 'redstone_wire');
    b.set(30, 0, 0, 'redstone_wire'); b.set(31, 0, 0, 'stone'); b.set(31, 1, 0, 'redstone_wire');
    b.set(40, 0, 0, 'redstone_wire'); b.set(41, 0, 0, 'stone'); b.set(41, 1, 0, 'redstone_wire'); b.set(40, 1, 0, 'stone');
    b.set(50, 0, 0, 'redstone_wire'); b.set(51, 0, 0, 'glass'); b.set(51, 1, 0, 'redstone_wire');
  });
  assert.equal(sides(get(0, 0, 0)), 'side side side side');
  assert.equal(sides(get(5, 0, 0)), 'none none none none');
  assert.equal(sides(get(11, 0, 0)), 'none side none side');
  assert.equal(sides(get(12, 0, 0)), 'none side none side');
  assert.equal(sides(get(20, 0, 0)), 'none side side none');
  assert.equal(sides(get(30, 0, 0)), 'none up none side');
  assert.equal(sides(get(31, 1, 0)), 'none side none side');
  // Block über dem unteren Staub: keine Verbindung nach oben, der obere Staub sieht einen Leiter
  assert.equal(sides(get(40, 0, 0)), 'side side side side');
  assert.equal(sides(get(41, 1, 0)), 'side side side side');
  // Glas leitet nicht: unten sieht man die Verbindung als „up“, oben geht es seitlich hinunter
  assert.equal(getProp(get(50, 0, 0), 'east'), 'up');
  assert.equal(getProp(get(51, 1, 0), 'west'), 'side');
});

test('Redstone verbindet zu Bauteilen nur an den richtigen Seiten', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'redstone_wire'); b.set(1, 0, 0, 'repeater[facing=west]');
    b.set(0, 0, 5, 'redstone_wire'); b.set(1, 0, 5, 'repeater[facing=north]');
    b.set(10, 0, 0, 'redstone_wire'); b.set(11, 0, 0, 'observer[facing=east]');
    b.set(10, 0, 5, 'redstone_wire'); b.set(11, 0, 5, 'observer[facing=north]');
    b.set(20, 0, 0, 'redstone_wire'); b.set(20, 0, 1, 'lever[face=floor,facing=north]');
    b.set(30, 0, 0, 'redstone_wire'); b.set(30, 0, -1, 'redstone_torch');
    b.set(40, 0, 0, 'redstone_wire'); b.set(41, 0, 0, 'comparator[facing=north]');
  });
  assert.equal(sides(get(0, 0, 0)), 'none side none side');
  assert.equal(sides(get(0, 0, 5)), 'side side side side');
  assert.equal(sides(get(10, 0, 0)), 'none side none side');
  assert.equal(sides(get(10, 0, 5)), 'side side side side');
  assert.equal(sides(get(20, 0, 0)), 'side none side none');
  assert.equal(sides(get(30, 0, 0)), 'side none side none');
  assert.equal(getProp(get(40, 0, 0), 'east'), 'side');
});

test('Doppeltruhen: Paare quer zu facing, Dreierreihe, ausdrückliches type bleibt', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'chest[facing=north]'); b.set(1, 0, 0, 'chest[facing=north]');
    b.set(10, 0, 0, 'chest[facing=south]'); b.set(11, 0, 0, 'chest[facing=south]'); b.set(12, 0, 0, 'chest[facing=south]');
    b.set(20, 0, 0, 'chest[facing=north]'); b.set(20, 0, 1, 'chest[facing=north]');
    b.set(30, 0, 0, 'chest[facing=north]'); b.set(31, 0, 0, 'chest[facing=east]');
    b.set(40, 0, 0, 'chest[facing=north]'); b.set(41, 0, 0, 'trapped_chest[facing=north]');
    b.set(50, 0, 0, 'chest[facing=north,type=single]'); b.set(51, 0, 0, 'chest[facing=north,type=single]');
  });
  const type = (x, z = 0) => getProp(get(x, 0, z), 'type');
  assert.deepEqual([type(0), type(1)], ['left', 'right']);
  assert.deepEqual([type(10), type(11), type(12)], ['right', 'left', 'single']);
  assert.deepEqual([type(20), type(20, 1)], ['single', 'single']);
  assert.deepEqual([type(30), type(31)], ['single', 'single']);
  assert.deepEqual([type(40), type(41)], ['single', 'single']);
  assert.deepEqual([type(50), type(51)], ['single', 'single']);
});

test('Zauntor in Mauer, Schnee auf Gras, Laub bleibt, raw bleibt unverändert', () => {
  const get = build((b) => {
    b.set(0, 0, 0, 'cobblestone_wall'); b.set(1, 0, 0, 'oak_fence_gate[facing=north]'); b.set(2, 0, 0, 'cobblestone_wall');
    b.set(10, 0, 0, 'oak_fence_gate[facing=east]'); b.set(11, 0, 0, 'cobblestone_wall');
    b.set(20, 0, 0, 'grass_block'); b.set(20, 1, 0, 'snow');
    b.set(21, 0, 0, 'grass_block');
    b.set(30, 0, 0, 'oak_leaves');
    b.set(40, 0, 0, 'oak_fence', { raw: true }); b.set(41, 0, 0, 'oak_fence');
  });
  assert.equal(getProp(get(1, 0, 0), 'in_wall'), 'true');
  assert.equal(getProp(get(0, 0, 0), 'east'), 'low');
  assert.equal(getProp(get(10, 0, 0), 'in_wall'), 'false');
  assert.equal(getProp(get(11, 0, 0), 'west'), 'none');
  assert.equal(getProp(get(20, 0, 0), 'snowy'), 'true');
  assert.equal(getProp(get(21, 0, 0), 'snowy'), 'false');
  assert.equal(getProp(get(30, 0, 0), 'persistent'), 'true');
  assert.equal(getProp(get(40, 0, 0), 'east'), 'false');
  assert.equal(getProp(get(41, 0, 0), 'west'), 'true');
});
