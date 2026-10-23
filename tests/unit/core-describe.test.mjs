import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setNames, blockName, itemName, blockLabel, describeState } from '../../js/core/describe.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';

test('Namen: Deutsch, sonst Englisch, sonst ID', () => {
  setNames({ block: {}, item: {} });
  assert.equal(blockName('stone'), 'stone');
  loadFixtureData();
  assert.equal(blockName('stone_bricks'), 'Steinziegel');
  assert.equal(blockName('spruce_planks'), 'Spruce Planks');
  assert.equal(blockName('banana_block'), 'banana_block');
  assert.equal(blockName('constructor'), 'constructor');
  assert.equal(itemName('redstone'), 'Redstone-Staub');
  assert.equal(itemName('stone'), 'Stein');
  assert.equal(blockLabel('stone_bricks'), 'Steinziegel · minecraft:stone_bricks');
  assert.throws(() => setNames(null), /Namensdaten ungültig/);
});

test('describeState für Repeater, Komparator, Beobachter, Treppe, Bett', () => {
  loadFixtureData();
  assert.deepEqual(describeState('repeater[delay=2,facing=south,locked=false,powered=false]'),
    { name: 'Redstone-Verstärker', id: 'repeater', detail: 'Signal läuft nach Norden, 2 Ticks' });
  assert.equal(describeState('repeater[delay=1,facing=west,locked=true]').detail, 'Signal läuft nach Osten, 1 Tick, gesperrt');
  assert.equal(describeState('comparator[facing=north,mode=subtract]').detail, 'Signal läuft nach Süden, Subtraktionsmodus');
  assert.equal(describeState('comparator[facing=east,mode=compare]').detail, 'Signal läuft nach Westen, Vergleichsmodus');
  assert.equal(describeState('observer[facing=north]').detail, 'Gesicht nach Norden, Ausgang nach Süden');
  assert.equal(describeState('observer[facing=up]').detail, 'Gesicht nach oben, Ausgang nach unten');
  assert.equal(describeState('oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]').detail, 'hohe Seite nach Norden, unten');
  assert.equal(describeState('oak_stairs[facing=east,half=top,shape=outer_left]').detail, 'hohe Seite nach Osten, oben (umgedreht), Außenecke links');
  assert.equal(describeState('red_bed[facing=west,part=head]').detail, 'Kopfteil, Kopfende nach Westen');
  assert.equal(describeState('red_bed[facing=west,part=foot]').detail, 'Fußteil, Kopfende nach Westen');
});

test('describeState für weitere Blöcke', () => {
  loadFixtureData();
  const detail = (state) => describeState(state).detail;
  assert.equal(detail('oak_slab[type=double]'), 'doppelt (2 Stufen)');
  assert.equal(detail('oak_log[axis=x]'), 'liegend, Ost–West');
  assert.equal(detail('oak_log[axis=y]'), 'stehend');
  assert.equal(detail('oak_door[facing=south,half=lower,hinge=right,open=false]'), 'unterer Teil, Scharnier rechts, geschlossen, beim Setzen nach Süden schauen');
  assert.equal(detail('wall_torch[facing=north]'), 'an der Wand, zeigt nach Norden');
  assert.equal(detail('lever[face=wall,facing=east,powered=true]'), 'an der Wand, zeigt nach Osten, an');
  assert.equal(detail('stone_button[face=floor,facing=north]'), 'auf dem Boden');
  assert.equal(detail('oak_sign[rotation=4]'), 'zeigt nach Westen');
  // Köpfe: rotation 0 = Gesicht nach Norden, 8 = Süden (§4, wie SkullBlock/SkullBlockRenderer)
  assert.equal(detail('skeleton_skull[rotation=10]'), 'zeigt nach Südwesten');
  assert.equal(detail('piston[facing=up]'), 'schiebt nach oben');
  assert.equal(detail('hopper[facing=down]'), 'gibt nach unten aus');
  assert.equal(detail('chest[facing=north,type=left]'), 'Vorderseite nach Norden, Doppeltruhe, linke Hälfte');
  assert.equal(detail('rail[shape=ascending_east]'), 'steigt nach Osten an');
  assert.equal(detail('rail[shape=south_west]'), 'Kurve Süden–Westen');
  assert.equal(detail('redstone_wire[east=side,north=up,south=none,west=none]'), 'verbunden: Norden (hoch), Osten');
  assert.equal(detail('redstone_wire[east=side,north=side,south=side,west=side]'), 'Kreuz');
  assert.equal(detail('candle[candles=3,lit=true]'), '3 Kerzen, angezündet');
  assert.equal(detail('sea_pickle[pickles=2,waterlogged=true]'), '2 Stück, geflutet (Wasser im Block)');
  assert.equal(detail('water[level=0]'), 'Quelle');
  assert.equal(detail('crafter[orientation=down_north]'), 'vorne nach unten, oben nach Norden');
  assert.equal(detail('oak_trapdoor[facing=north,half=top,open=false]'), 'geschlossen, obere Hälfte');
  assert.equal(detail('oak_trapdoor[facing=north,open=true]'), 'offen, steht an der Südseite');
  assert.equal(detail('oak_trapdoor[facing=west,open=true]'), 'offen, steht an der Ostseite');
  assert.equal(detail('stone'), '');
});
