import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataTest, createModels, bindFor } from './render-models-fixture.test.mjs';
import { BlockModels, DIRECTIONS, SHADE, blockLightEmission } from '../../js/render/block-models.js';
import { redstoneColor, stemColor, tintColor, PLAINS_COLORS, TINT_NONE } from '../../js/render/tints.js';

const FACINGS = ['north', 'east', 'south', 'west'];
const CLOCKWISE = { north: 'east', east: 'south', south: 'west', west: 'north' };
const COUNTER_CLOCKWISE = { north: 'west', west: 'south', south: 'east', east: 'north' };
const SHAPES = ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'];
const bit = (dir) => 1 << DIRECTIONS.indexOf(dir);

function bounds(quads) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of quads) {
    for (let v = 0; v < 4; v++) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], q.pos[v * 3 + a]);
        max[a] = Math.max(max[a], q.pos[v * 3 + a]);
      }
    }
  }
  return { min, max };
}

// Standard-UV der Fläche an einer Weltposition (FaceBakery.defaultFaceUV) – so liegt eine Textur „welt-fest“.
function worldUv(dir, x, y, z) {
  switch (dir) {
    case 'down': return [16 * x, 16 - 16 * z];
    case 'up': return [16 * x, 16 * z];
    case 'north': return [16 - 16 * x, 16 - 16 * y];
    case 'south': return [16 * x, 16 - 16 * y];
    case 'west': return [16 * z, 16 - 16 * y];
    default: return [16 - 16 * z, 16 - 16 * y];
  }
}

dataTest('Stein: 6 Quads, je Richtung eins mit passender cullface, voll deckend', async () => {
  const models = createModels();
  const map = await bindFor(models, ['stone']);
  const quads = models.quads('stone', 0, 0, 0);
  assert.equal(quads.length, 6);
  assert.deepEqual(quads.map((q) => q.dir).sort(), [...DIRECTIONS].sort());
  // block/stone_mirrored ist ein eigenes Modell, nutzt aber dieselbe Textur mit gespiegelten UVs
  assert.deepEqual([...map.keys()], ['block/stone']);
  for (const q of quads) {
    assert.equal(q.cull, q.dir);
    assert.equal(q.layer, 'solid');
    assert.equal(q.tint, TINT_NONE);
    assert.equal(q.shade, true);
    assert.equal(q.emissive, false);
    assert.equal(q.tex, map.get('block/stone').layer);
    assert.equal(q.pos.length, 12);
    assert.equal(q.uv.length, 8);
    const normal = { down: [0, -1, 0], up: [0, 1, 0], north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0] }[q.dir];
    assert.deepEqual(q.normal.map((v) => Math.round(v)), normal);
  }
  const up = quads.find((q) => q.dir === 'up');
  assert.deepEqual([up.pos[1], up.pos[4], up.pos[7], up.pos[10]], [1, 1, 1, 1]);
  assert.equal(models.isOpaqueFullCube('stone'), true);
  assert.equal(models.cullsSameType('stone'), false);
});

dataTest('Stein: Zufallsvarianten per Positions-Hash – stabil und alle vier kommen vor', async () => {
  const models = createModels();
  await bindFor(models, ['stone']);
  const seen = new Set();
  for (let x = 0; x < 40; x++) {
    const a = models.quads('stone', x, 5, -3);
    assert.equal(models.quads('stone', x, 5, -3), a, 'gleiche Position → gleiche (gecachte) Liste');
    seen.add(a);
  }
  assert.equal(seen.size, 4);
});

dataTest('Schattierung wie im Spiel: oben 1, unten 0,5, N/S 0,8, O/W 0,6; shade:false → 1', async () => {
  const models = createModels();
  await bindFor(models, ['oak_planks', 'short_grass']);
  for (const q of models.quads('oak_planks')) assert.equal(q.shadeValue, SHADE[q.dir]);
  const grass = models.quads('short_grass');
  assert.ok(grass.length > 0);
  for (const q of grass) {
    assert.equal(q.shade, false);
    assert.equal(q.shadeValue, 1);
  }
});

dataTest('Treppen: alle facing/half/shape – volle Seiten wie StairBlock, hohe Seite in facing-Richtung', async () => {
  const models = createModels();
  const states = [];
  for (const facing of FACINGS) for (const half of ['bottom', 'top']) for (const shape of SHAPES) states.push(`oak_stairs[facing=${facing},half=${half},shape=${shape},waterlogged=false]`);
  await bindFor(models, states);
  for (const state of states) {
    const [, facing, half, shape] = state.match(/facing=(\w+),half=(\w+),shape=(\w+)/);
    let expected = bit(half === 'bottom' ? 'down' : 'up');
    if (shape === 'straight') expected |= bit(facing);
    if (shape === 'inner_left') expected |= bit(facing) | bit(COUNTER_CLOCKWISE[facing]);
    if (shape === 'inner_right') expected |= bit(facing) | bit(CLOCKWISE[facing]);
    const info = models.renderInfo(state);
    assert.equal(info.fullSides, expected, `${state}: volle Seiten ${info.fullSides.toString(2)} statt ${expected.toString(2)}`);
    assert.equal(info.opaqueFull, false);
    // Hohe Stufe: Oberseite auf voller Höhe liegt auf der facing-Seite (gerade Treppe)
    if (shape === 'straight') {
      const topY = half === 'bottom' ? 1 : 0.5;
      const high = models.quads(state).filter((q) => q.dir === 'up' && Math.abs(q.pos[1] - topY) < 1e-6);
      const { min, max } = bounds(high);
      const center = [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2];
      const toward = { north: [0.5, 0.25], south: [0.5, 0.75], west: [0.25, 0.5], east: [0.75, 0.5] }[facing];
      if (half === 'bottom') assert.deepEqual(center, toward, `${state}: hohe Oberseite`);
    }
  }
});

dataTest('uvlock: gedrehte Treppen haben welt-feste UVs auf allen Flächen (wie unverdrehte)', async () => {
  const models = createModels();
  const states = [];
  for (const facing of FACINGS) for (const half of ['bottom', 'top']) for (const shape of SHAPES) states.push(`oak_stairs[facing=${facing},half=${half},shape=${shape},waterlogged=false]`);
  await bindFor(models, states);
  for (const state of states) {
    for (const q of models.quads(state)) {
      for (let v = 0; v < 4; v++) {
        const [u, w] = worldUv(q.dir, q.pos[v * 3], q.pos[v * 3 + 1], q.pos[v * 3 + 2]);
        assert.ok(Math.abs(q.uv[v * 2] - u) < 1e-4 && Math.abs(q.uv[v * 2 + 1] - w) < 1e-4,
          `${state} ${q.dir} Vertex ${v}: UV ${q.uv[v * 2]},${q.uv[v * 2 + 1]} statt ${u},${w}`);
      }
    }
  }
});

dataTest('Ohne uvlock dreht die Textur mit: Ofen facing=east zeigt die Front nach Osten', async () => {
  const models = createModels();
  const map = await bindFor(models, ['furnace[facing=east,lit=false]', 'furnace[facing=north,lit=false]']);
  const front = map.get('block/furnace_front').layer;
  assert.equal(models.quads('furnace[facing=east,lit=false]').find((q) => q.tex === front).dir, 'east');
  assert.equal(models.quads('furnace[facing=north,lit=false]').find((q) => q.tex === front).dir, 'north');
});

dataTest('Stämme: axis=x/z drehen die Stirnseiten (x/y-Drehung der Variante)', async () => {
  const models = createModels();
  const map = await bindFor(models, ['oak_log[axis=x]', 'oak_log[axis=y]', 'oak_log[axis=z]']);
  const top = map.get('block/oak_log_top').layer;
  const ends = (state) => models.quads(state).filter((q) => q.tex === top).map((q) => q.dir).sort();
  assert.deepEqual(ends('oak_log[axis=y]'), ['down', 'up']);
  assert.deepEqual(ends('oak_log[axis=x]'), ['east', 'west']);
  assert.deepEqual(ends('oak_log[axis=z]'), ['north', 'south']);
});

dataTest('Zaun-Multipart: Pfosten immer, Seitenteile nur in verbundene Richtungen', async () => {
  const models = createModels();
  const post = 'oak_fence[east=false,north=false,south=false,waterlogged=false,west=false]';
  const eastWest = 'oak_fence[east=true,north=false,south=false,waterlogged=false,west=true]';
  const north = 'oak_fence[east=false,north=true,south=false,waterlogged=false,west=false]';
  await bindFor(models, [post, eastWest, north]);
  const b = (state) => bounds(models.quads(state));
  assert.deepEqual(b(post).min.map((v) => v * 16), [6, 0, 6]);
  assert.deepEqual(b(post).max.map((v) => v * 16), [10, 16, 10]);
  assert.deepEqual([b(eastWest).min[0], b(eastWest).max[0]], [0, 1]);
  assert.deepEqual([b(eastWest).min[2] * 16, b(eastWest).max[2] * 16], [6, 10]);
  assert.deepEqual([b(north).min[2], b(north).max[2] * 16], [0, 10]);
  assert.ok(models.quads(eastWest).length > models.quads(post).length);
  assert.equal(models.isOpaqueFullCube(post), false);
});

dataTest('Render-Schichten: Glas/Buntglas/Scheibe/Redstone durchscheinend (force_translucent), Laub cutout, Eis durchscheinend', async () => {
  const models = createModels();
  const states = ['glass', 'red_stained_glass', 'glass_pane', 'redstone_wire', 'oak_leaves', 'ice', 'slime_block', 'honey_block', 'tinted_glass', 'stone', 'spawner'];
  await bindFor(models, states);
  const layers = (state) => [...new Set(models.quads(state).map((q) => q.layer))].sort().join(',');
  assert.equal(layers('glass'), 'translucent');
  assert.equal(layers('red_stained_glass'), 'translucent');
  assert.equal(layers('glass_pane'), 'translucent');
  assert.equal(layers('redstone_wire'), 'translucent');
  assert.equal(layers('oak_leaves'), 'cutout');
  assert.equal(layers('ice'), 'translucent');
  assert.equal(layers('slime_block'), 'translucent');
  assert.equal(layers('honey_block'), 'translucent');
  assert.equal(layers('tinted_glass'), 'translucent');
  assert.equal(layers('stone'), 'solid');
  assert.equal(layers('spawner'), 'cutout');
  for (const state of ['glass', 'oak_leaves', 'ice']) {
    assert.equal(models.isOpaqueFullCube(state), false, state);
    assert.equal(models.renderInfo(state).aoOccluder, true, `${state} wirft AO (volle Kollisionsbox)`);
  }
});

dataTest('cullsSameType: Glas, Buntglas, Eis, Laub, Scheiben, Wasser – nicht Stein oder Treppen', () => {
  const models = createModels();
  for (const state of ['glass', 'lime_stained_glass', 'ice', 'oak_leaves', 'glass_pane', 'iron_bars', 'water', 'lava', 'slime_block']) {
    assert.equal(models.cullsSameType(state), true, state);
  }
  for (const state of ['stone', 'oak_stairs', 'oak_fence', 'oak_slab[type=bottom,waterlogged=true]']) {
    assert.equal(models.cullsSameType(state), false, state);
  }
});

dataTest('Laub-Tönung nach Art (Ebene-Biom), Kirsche/Azalee ohne Tönung', async () => {
  const models = createModels();
  const leaves = { oak_leaves: 0x77ab2f, birch_leaves: 0x80a755, spruce_leaves: 0x619961, mangrove_leaves: 0x8db127, jungle_leaves: 0x77ab2f, cherry_leaves: TINT_NONE, azalea_leaves: TINT_NONE };
  await bindFor(models, Object.keys(leaves));
  for (const [id, color] of Object.entries(leaves)) {
    assert.deepEqual([...new Set(models.quads(id).map((q) => q.tint))], [color], id);
  }
});

dataTest('Grasblock: Oberseite und Seiten-Overlay grasgrün, Erde-Seite ohne Tönung', async () => {
  const models = createModels();
  const map = await bindFor(models, ['grass_block[snowy=false]']);
  const quads = models.quads('grass_block[snowy=false]', 1, 2, 3);
  const top = quads.find((q) => q.dir === 'up');
  assert.equal(top.tint, PLAINS_COLORS.grass);
  const overlay = quads.filter((q) => q.tex === map.get('block/grass_block_side_overlay').layer);
  assert.equal(overlay.length, 4);
  for (const q of overlay) {
    assert.equal(q.tint, 0x91bd59);
    assert.equal(q.layer, 'cutout');
  }
  for (const q of quads.filter((q) => q.tex === map.get('block/grass_block_side').layer)) assert.equal(q.tint, TINT_NONE);
});

test('Redstone-Farbe nach Signalstärke wie RedStoneWireBlock, Stängel nach Alter', () => {
  assert.equal(redstoneColor(0), 0x4c0000);
  assert.equal(redstoneColor(1), 0x700000);
  // Java-float: (0,7F − 0,5F) · 255F = 50,999996F → Mth.floor → 50 (0x32), nicht 51
  assert.equal(redstoneColor(15), 0xff3200);
  assert.equal(stemColor(0), 0x00ff00);
  assert.equal(stemColor(7), 0xe0c71c);
  assert.equal(tintColor('redstone_wire', { power: '15' }, 0), 0xff3200);
  assert.equal(tintColor('melon_stem', { age: '3' }, 0), (96 << 16) | (231 << 8) | 12);
  assert.equal(tintColor('pink_petals', {}, 0), TINT_NONE);
  assert.equal(tintColor('pink_petals', {}, 1), PLAINS_COLORS.grass);
  assert.equal(tintColor('water_cauldron', {}, 0), PLAINS_COLORS.water);
  assert.equal(tintColor('stone', {}, 0), TINT_NONE);
  assert.equal(tintColor('grass_block', {}, -1), TINT_NONE);
  assert.throws(() => redstoneColor(16), /0 … 15/);
  assert.throws(() => stemColor(8), /0 … 7/);
});

test('Lichtstärke wie im Spiel (feste Werte und nach Zustand)', () => {
  assert.equal(blockLightEmission('glowstone'), 15);
  assert.equal(blockLightEmission('torch'), 14);
  assert.equal(blockLightEmission('redstone_lamp', { lit: 'false' }), 0);
  assert.equal(blockLightEmission('redstone_lamp', { lit: 'true' }), 15);
  assert.equal(blockLightEmission('candle', { lit: 'true', candles: '4' }), 12);
  assert.equal(blockLightEmission('red_candle', { lit: 'false', candles: '4' }), 0);
  assert.equal(blockLightEmission('sea_pickle', { pickles: '4', waterlogged: 'true' }), 15);
  assert.equal(blockLightEmission('sea_pickle', { pickles: '4', waterlogged: 'false' }), 0);
  assert.equal(blockLightEmission('respawn_anchor', { charges: '2' }), 7);
  assert.equal(blockLightEmission('waxed_weathered_copper_bulb', { lit: 'true' }), 8);
  assert.equal(blockLightEmission('oxidized_copper_lantern'), 15);
  assert.equal(blockLightEmission('stone'), 0);
});

dataTest('Leuchtend: Leuchtstein und Laterne ganz, Glühwürmchenbusch nur das leuchtende Element', async () => {
  const models = createModels();
  const map = await bindFor(models, ['glowstone', 'lantern[hanging=false,waterlogged=false]', 'firefly_bush', 'stone', 'redstone_lamp[lit=true]', 'redstone_lamp[lit=false]']);
  assert.ok(models.quads('glowstone').every((q) => q.emissive));
  assert.ok(models.quads('lantern[hanging=false,waterlogged=false]').every((q) => q.emissive));
  assert.ok(models.quads('redstone_lamp[lit=true]').every((q) => q.emissive));
  assert.ok(models.quads('redstone_lamp[lit=false]').every((q) => !q.emissive));
  assert.ok(models.quads('stone').every((q) => !q.emissive));
  const bush = models.quads('firefly_bush');
  const glow = map.get('block/firefly_bush_emissive').layer;
  assert.ok(bush.some((q) => q.tex === glow) && bush.filter((q) => q.tex === glow).every((q) => q.emissive));
  assert.ok(bush.filter((q) => q.tex !== glow).every((q) => !q.emissive));
  // Leuchtende Blöcke bekommen wie im Spiel keine Umgebungsverdeckung
  assert.equal(models.renderInfo('glowstone').ao, false);
  assert.equal(models.renderInfo('stone').ao, true);
});

dataTest('Gedrehte Elemente: Richtung aus der gedrehten Normalen, Kreuzpflanzen ohne cullface', async () => {
  const models = createModels();
  await bindFor(models, ['poppy', 'oak_sign[rotation=2,waterlogged=false]']);
  const poppy = models.quads('poppy');
  assert.equal(poppy.length, 4);
  for (const q of poppy) {
    assert.equal(q.cull, null);
    assert.ok(Math.abs(Math.abs(q.normal[0]) - Math.SQRT1_2) < 1e-4 && Math.abs(Math.abs(q.normal[2]) - Math.SQRT1_2) < 1e-4);
    assert.ok(['north', 'south', 'west', 'east'].includes(q.dir));
  }
  const sign = models.quads('oak_sign[rotation=2,waterlogged=false]');
  assert.ok(sign.length > 0);
  for (const q of sign) assert.ok(Math.abs(Math.hypot(...q.normal) - 1) < 1e-6);
});

dataTest('Fehlerfälle: ohne bindTextures, nicht gebundene Textur, ungültige Map, falsche Daten', async () => {
  const models = createModels();
  assert.throws(() => models.quads('stone'), /bindTextures/);
  assert.throws(() => models.bindTextures(new Map([['block/stone', { layer: -1, alpha: 'opaque' }]])), /layer/);
  assert.throws(() => models.bindTextures(new Map([['block/stone', { layer: 0, alpha: 'halb' }]])), /alpha/);
  assert.throws(() => models.bindTextures(null), /Map/);
  models.bindTextures(new Map([['block/stone', { layer: 0, alpha: 'opaque' }]]));
  assert.throws(() => models.quads('glass'), /nicht gebunden/);
  assert.throws(() => models.quads('stone', 0.5, 0, 0), /ganze Koordinaten/);
  assert.throws(() => models.textureNames('stone'), /Liste/);
  assert.throws(() => models.quads('stone[', 0, 0, 0), /Ungültiger Blockzustand/);
});

test('Konstruktor prüft das Datenformat', () => {
  assert.throws(() => new BlockModels(null), /models.json/);
  assert.throws(() => new BlockModels({ textures: [], models: [{}], blocks: {} }), /elements/);
  assert.throws(() => new BlockModels({ textures: [], models: [], blocks: {} }, { falsch: true }), /blocks.json/);
});

dataTest('Unbekannte Blöcke und Blöcke ohne Elemente: Ersatzwürfel mit Warnung', async () => {
  const models = createModels();
  const map = await bindFor(models, ['copper_golem_statue', 'gibt_es_nicht']);
  assert.ok(map.has('missingno'));
  assert.ok(map.has('block/copper_block'));
  assert.equal(models.quads('copper_golem_statue').length, 6);
  assert.equal(models.quads('gibt_es_nicht').length, 6);
  assert.ok(models.quads('gibt_es_nicht').every((q) => q.tex === map.get('missingno').layer));
  assert.ok(models.warnings.some((w) => w.includes('copper_golem_statue')));
  assert.ok(models.warnings.some((w) => w.includes('gibt_es_nicht')));
});

dataTest('Unvollständige Zustände werden mit den Standardwerten aus blocks.json ergänzt', async () => {
  const models = createModels();
  await bindFor(models, ['oak_stairs', 'oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]']);
  const a = models.quads('oak_stairs').map((q) => Array.from(q.pos).join());
  const b = models.quads('oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]').map((q) => Array.from(q.pos).join());
  assert.deepEqual(a, b);
});
