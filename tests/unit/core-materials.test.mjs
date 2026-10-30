import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemForState, countMaterials, stackSize, splitAmount, formatAmount } from '../../js/core/materials.js';
import { BlockVolume } from '../../js/core/volume.js';
import { Builder } from '../../js/core/builder.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';

test('formatAmount auf Deutsch inklusive Grenzfälle', () => {
  assert.equal(formatAmount(0), '0');
  assert.equal(formatAmount(12), '12');
  assert.equal(formatAmount(63), '63');
  assert.equal(formatAmount(64), '1 Stack');
  assert.equal(formatAmount(67), '1 Stack und 3');
  assert.equal(formatAmount(128), '2 Stacks');
  assert.equal(formatAmount(1727), '26 Stacks und 63');
  assert.equal(formatAmount(1728), '1 Shulkerkiste');
  assert.equal(formatAmount(1729), '1 Shulkerkiste und 1');
  assert.equal(formatAmount(1728 + 128 + 5), '1 Shulkerkiste, 2 Stacks und 5');
  assert.equal(formatAmount(2 * 1728 + 5 * 64 + 12), '2 Shulkerkisten, 5 Stacks und 12');
  assert.equal(formatAmount(1728 + 64), '1 Shulkerkiste und 1 Stack');
  assert.equal(formatAmount(16, 16), '1 Stack');
  assert.equal(formatAmount(20, 16), '1 Stack und 4');
  assert.equal(formatAmount(30, 1), '30');
  assert.throws(() => formatAmount(-1), /ganze Zahl ≥ 0/);
  assert.throws(() => formatAmount(1.5), /ganze Zahl/);
  assert.deepEqual(splitAmount(1729), { shulkers: 1, stacks: 0, rest: 1 });
  assert.deepEqual(splitAmount(100, 16), { shulkers: 0, stacks: 6, rest: 4 });
});

test('stackSize: 64, 16 und 1', () => {
  assert.equal(stackSize('stone'), 64);
  assert.equal(stackSize('oak_sign'), 16);
  assert.equal(stackSize('oak_hanging_sign'), 16);
  assert.equal(stackSize('white_banner'), 16);
  assert.equal(stackSize('ender_pearl'), 16);
  assert.equal(stackSize('bucket'), 16);
  assert.equal(stackSize('armor_stand'), 16);
  assert.equal(stackSize('red_bed'), 1);
  assert.equal(stackSize('water_bucket'), 1);
  assert.equal(stackSize('oak_boat'), 1);
  assert.equal(stackSize('minecart'), 1);
  assert.equal(stackSize('chest_minecart'), 1);
  assert.equal(stackSize('white_shulker_box'), 1);
  assert.equal(stackSize('cake'), 1);
});

test('itemForState: Sonderfälle nach §6.5', () => {
  const item = (state) => {
    const r = itemForState(state);
    return r && [r.item, r.count, ...(r.extra ?? []).flat()].join(' ');
  };
  assert.equal(item('oak_door[half=lower]'), 'oak_door 1');
  assert.equal(item('oak_door[half=upper]'), null);
  assert.equal(item('red_bed[part=head]'), 'red_bed 1');
  assert.equal(item('red_bed[part=foot]'), null);
  assert.equal(item('sunflower[half=lower]'), 'sunflower 1');
  assert.equal(item('sunflower[half=upper]'), null);
  assert.equal(item('tall_seagrass[half=lower]'), 'seagrass 1');
  assert.equal(item('oak_slab[type=double]'), 'oak_slab 2');
  assert.equal(item('oak_slab[type=top]'), 'oak_slab 1');
  assert.equal(item('candle[candles=3]'), 'candle 3');
  assert.equal(item('sea_pickle[pickles=4]'), 'sea_pickle 4');
  assert.equal(item('turtle_egg[eggs=2]'), 'turtle_egg 2');
  assert.equal(item('snow[layers=5]'), 'snow 5');
  assert.equal(item('glow_lichen[north=true,up=true]'), 'glow_lichen 2');
  assert.equal(item('redstone_wire[north=side]'), 'redstone 1');
  assert.equal(item('wall_torch[facing=north]'), 'torch 1');
  assert.equal(item('soul_wall_torch'), 'soul_torch 1');
  assert.equal(item('redstone_wall_torch'), 'redstone_torch 1');
  assert.equal(item('oak_wall_sign'), 'oak_sign 1');
  assert.equal(item('oak_wall_hanging_sign'), 'oak_hanging_sign 1');
  assert.equal(item('white_wall_banner'), 'white_banner 1');
  assert.equal(item('skeleton_wall_skull'), 'skeleton_skull 1');
  assert.equal(item('zombie_wall_head'), 'zombie_head 1');
  assert.equal(item('cobblestone_wall'), 'cobblestone_wall 1');
  assert.equal(item('wheat[age=7]'), 'wheat_seeds 1');
  assert.equal(item('carrots'), 'carrot 1');
  assert.equal(item('potatoes'), 'potato 1');
  assert.equal(item('beetroots'), 'beetroot_seeds 1');
  assert.equal(item('melon_stem'), 'melon_seeds 1');
  assert.equal(item('pumpkin_stem'), 'pumpkin_seeds 1');
  assert.equal(item('cocoa'), 'cocoa_beans 1');
  assert.equal(item('sweet_berry_bush'), 'sweet_berries 1');
  assert.equal(item('cave_vines_plant'), 'glow_berries 1');
  assert.equal(item('torchflower_crop'), 'torchflower_seeds 1');
  assert.equal(item('pitcher_crop[half=lower]'), 'pitcher_pod 1');
  assert.equal(item('kelp_plant'), 'kelp 1');
  assert.equal(item('weeping_vines_plant'), 'weeping_vines 1');
  assert.equal(item('potted_poppy'), 'flower_pot 1 poppy 1');
  assert.equal(item('potted_azalea_bush'), 'flower_pot 1 azalea 1');
  assert.equal(item('water[level=0]'), 'water_bucket 1');
  assert.equal(item('water[level=3]'), null);
  assert.equal(item('lava'), 'lava_bucket 1');
  assert.equal(item('farmland[moisture=7]'), 'dirt 1');
  assert.equal(itemForState('farmland').hint, 'Erde mit einer Hacke bearbeiten');
  assert.equal(itemForState('dirt_path').hint, 'Erde mit einer Schaufel bearbeiten');
  assert.equal(item('water_cauldron[level=3]'), 'cauldron 1 water_bucket 1');
  assert.equal(item('white_candle_cake'), 'cake 1 white_candle 1');
  for (const id of ['air', 'piston_head', 'moving_piston', 'fire', 'soul_fire', 'nether_portal', 'end_portal', 'end_gateway', 'bubble_column', 'frosted_ice']) {
    assert.equal(itemForState(id), null, id);
  }
});

test('itemForState: unsichtbare Technik-Blöcke sind kein Material, befallene Blöcke zählen als ihr sichtbares Gegenstück', () => {
  const item = (state) => {
    const r = itemForState(state);
    return r && [r.item, r.count].join(' ');
  };
  for (const state of ['light[level=15,waterlogged=false]', 'light', 'barrier[waterlogged=false]', 'structure_void']) {
    assert.equal(itemForState(state), null, state);
  }
  assert.equal(item('infested_stone'), 'stone 1');
  assert.equal(item('infested_cobblestone'), 'cobblestone 1');
  assert.equal(item('infested_stone_bricks'), 'stone_bricks 1');
  assert.equal(item('infested_mossy_stone_bricks'), 'mossy_stone_bricks 1');
  assert.equal(item('infested_cracked_stone_bricks'), 'cracked_stone_bricks 1');
  assert.equal(item('infested_chiseled_stone_bricks'), 'chiseled_stone_bricks 1');
  assert.equal(item('infested_deepslate[axis=y]'), 'deepslate 1');
  assert.equal(item('petrified_oak_slab[type=bottom,waterlogged=false]'), 'oak_slab 1');
  assert.equal(item('petrified_oak_slab[type=double,waterlogged=false]'), 'oak_slab 2');
});

test('countMaterials zählt Türen, Betten und doppelte Pflanzen einmal, Doppelstufen doppelt', () => {
  loadFixtureData();
  const b = new Builder();
  b.door(0, 0, 0, 'oak_door');
  b.bed(2, 0, 0, 'red_bed', { facing: 'east' });
  b.tall(5, 0, 0, 'sunflower');
  b.slab(7, 0, 0, 'oak_slab', { type: 'double' });
  b.slab(8, 0, 0, 'oak_slab');
  b.set(9, 0, 0, 'potted_poppy');
  const result = b.finalize();
  const totals = Object.fromEntries(result.materials);
  assert.deepEqual(totals, { oak_door: 1, red_bed: 1, sunflower: 1, oak_slab: 3, flower_pot: 1, poppy: 1 });
  assert.deepEqual(Object.fromEntries(countMaterials(result.volume)), totals);
  assert.equal(result.blockCount, 9);
  // nach Schritt gefiltert
  const v = new BlockVolume();
  v.set(0, 0, 0, 'stone', 0);
  v.set(1, 0, 0, 'stone', 1);
  v.set(2, 0, 0, 'dirt', 1);
  assert.deepEqual(countMaterials(v, 1), [['dirt', 1], ['stone', 1]]);
  assert.deepEqual(countMaterials(v), [['stone', 2], ['dirt', 1]]);
});
