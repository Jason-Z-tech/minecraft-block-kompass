// Bau-Seite: Ebenen-Plan (plan-model.js) und Block-Aussehen für Icons/Draufsicht (appearance.js).
// Der Teil mit echten Texturen und Modellen läuft nur, wenn game-data/ vorhanden ist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureData } from '../fixtures/core/setup.mjs';
import { Builder } from '../../js/core/builder.js';
import { BlockVolume } from '../../js/core/volume.js';
import buildHouse from '../fixtures/core/example-house.js';
import {
  readLayer, cellStatus, layerCounts, fitView, zoomAt, clampView, cellAt, rulerStep, bakeResolution,
  CELL_DONE, CELL_CURRENT, CELL_LATER, MIN_CELL_PX, MAX_CELL_PX,
} from '../../js/ui/build/plan-model.js';
import {
  FACE_VIEWS, facingQuads, rasterizeFace, imageHasPixels, coverage, topHeight, spriteImage, statesByItem, Appearance,
} from '../../js/ui/build/appearance.js';
import { TextureStore } from '../../js/render/texture-store.js';
import { BlockModels } from '../../js/render/block-models.js';
import { contrastRatio, mixHex } from '../../js/ui/shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_DATA = path.join(ROOT, 'game-data');
const hasGameData = ['textures.json', 'textures.bin', 'models.json'].every((file) => existsSync(path.join(GAME_DATA, file)));

loadFixtureData();
const house = (() => {
  const b = new Builder();
  buildHouse(b);
  return b.finalize();
})();

test('readLayer: Zellen, Schritte, Ebene darunter', () => {
  const volume = new BlockVolume();
  volume.set(0, 0, 0, 'stone', 0);
  volume.set(1, 0, 0, 'stone', 0);
  volume.set(0, 1, 0, 'oak_planks', 2);
  const layer = readLayer(volume, [2, 2, 1], 1);
  assert.equal(layer.width, 2);
  assert.equal(layer.length, 1);
  assert.equal(layer.blocks, 1);
  assert.deepEqual([...layer.steps], [2, -1]);
  assert.deepEqual([...layer.below], [0, 1], 'Feld (1,0) ist leer, darunter liegt Stein');
  assert.deepEqual(layer.used, [volume.paletteIndex('oak_planks')]);
});

test('readLayer am Beispielhaus: Fundament 9 × 7 (63 Blöcke) und Vorgarten (33) auf Ebene 1', () => {
  const layer = readLayer(house.volume, house.size, 0);
  assert.equal(layer.blocks, 96);
  assert.equal(layer.width * layer.length, house.size[0] * house.size[2]);
  assert.deepEqual(layerCounts(layer, 0), { done: 0, current: 63, later: 33 });
  assert.deepEqual(layerCounts(layer, house.steps.length), { done: 96, current: 0, later: 0 });
  assert.deepEqual(layerCounts(layer, -1), { done: 0, current: 0, later: 96 });
});

test('Zustand je Zelle', () => {
  assert.equal(cellStatus(-1, 3), 0);
  assert.equal(cellStatus(2, 3), CELL_DONE);
  assert.equal(cellStatus(3, 3), CELL_CURRENT);
  assert.equal(cellStatus(4, 3), CELL_LATER);
  assert.equal(cellStatus(0, -1), CELL_LATER, 'vor dem Start ist alles später');
});

test('Ansicht einpassen, zoomen, begrenzen, Zelle finden', () => {
  const view = fitView(400, 300, 150, 150);
  assert.ok(view.cell >= MIN_CELL_PX && view.cell <= MAX_CELL_PX);
  assert.ok(Math.abs(view.x + (150 * view.cell) / 2 - 200) < 1e-9, 'waagrecht mittig');
  const zoomed = zoomAt({ cell: 10, x: 0, y: 0 }, 2, 100, 50);
  assert.deepEqual(zoomed, { cell: 20, x: -100, y: -50 }, 'Punkt unter dem Zeiger bleibt');
  assert.equal(zoomAt({ cell: 90, x: 0, y: 0 }, 4, 0, 0).cell, MAX_CELL_PX);
  assert.equal(zoomAt({ cell: 2, x: 0, y: 0 }, 0.1, 0, 0).cell, MIN_CELL_PX);
  const clamped = clampView({ cell: 10, x: 5000, y: -5000 }, 400, 300, 10, 10);
  assert.ok(clamped.x <= 400 - 48 && clamped.y >= 48 - 100, 'ein Rest bleibt sichtbar');
  assert.deepEqual(cellAt({ cell: 10, x: 5, y: 5 }, 26, 16, 4, 4), { x: 2, z: 1 });
  assert.equal(cellAt({ cell: 10, x: 5, y: 5 }, 1, 1, 4, 4), null);
  assert.equal(cellAt({ cell: 10, x: 0, y: 0 }, 45, 5, 4, 4), null);
  assert.equal(rulerStep(30), 1);
  assert.equal(rulerStep(3), 10);
  assert.equal(rulerStep(2), 20);
  assert.equal(bakeResolution(10, 10), 16);
  assert.equal(bakeResolution(150, 150), 8, '150 × 150 mit 8 px je Feld (1,4 Mio. Pixel)');
  assert.equal(bakeResolution(1000, 1000), 2);
});

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const sampler = (name) => (name === 'red' ? RED : name === 'blue' ? BLUE : null);
const quad = (texture, pos, normal, tint = -1) => ({ texture, pos, normal, tint, uv: [0, 0, 0, 16, 16, 16, 16, 0] });
const TOP_FULL = quad('red', [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0], [0, 1, 0]);
const TOP_HALF = quad('blue', [0, 0.5, 0, 0, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0], [0, 1, 0]);
const NORTH = quad('blue', [1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0], [0, 0, -1]);

test('Raster: Draufsicht deckt die Fläche, höhere Flächen liegen oben', () => {
  assert.deepEqual(facingQuads([TOP_FULL, TOP_HALF, NORTH], FACE_VIEWS.up).map((q) => q.texture), ['blue', 'red'], 'tiefere zuerst');
  const image = rasterizeFace([TOP_FULL, TOP_HALF], FACE_VIEWS.up, 16, sampler);
  assert.equal(coverage(image), 1);
  assert.deepEqual([...image.data.subarray(0, 4)], RED, 'rot liegt oben');
  const half = rasterizeFace([TOP_HALF], FACE_VIEWS.up, 16, sampler);
  assert.ok(Math.abs(coverage(half) - 0.5) < 0.01);
  assert.deepEqual([...half.data.subarray(0, 4)], BLUE, 'Westhälfte (x 0 … 0,5) links');
  assert.equal(imageHasPixels(rasterizeFace([NORTH], FACE_VIEWS.up, 16, sampler)), false, 'Nordseite ist von oben unsichtbar');
  assert.equal(coverage(rasterizeFace([NORTH], FACE_VIEWS.north, 16, sampler)), 1);
  const tinted = rasterizeFace([quad('red', TOP_FULL.pos, [0, 1, 0], 0x808080)], FACE_VIEWS.up, 4, sampler);
  assert.equal(tinted.data[0], 128, 'Tönung multipliziert');
  assert.equal(topHeight([TOP_HALF]), 0.5);
  assert.equal(topHeight([]), 1);
  assert.ok(Math.abs(coverage(spriteImage('red', 16, sampler)) - 144 / 256) < 1e-9, '12 × 12 Pixel mittig (Maßstab 0,8)');
  assert.equal(coverage(spriteImage('red', 16, sampler, 1)), 1);
});

test('statesByItem: Gegenstand → Zustand aus dem Bau', () => {
  const map = statesByItem(house.volume.palette);
  assert.ok(map.get('oak_door').startsWith('oak_door['));
  assert.ok(map.get('torch').startsWith('wall_torch['), 'Wandfackel liefert den Gegenstand Fackel');
  assert.equal(map.has('air'), false);
});

test('Farbpaare der Bau-Ansicht haben genug Kontrast (AA)', () => {
  const tokens = { text: '#ece8df', muted: '#b3ada2', surface: '#1e2127', surface2: '#272b32', surface3: '#30353d', onAccent: '#0d1a08', gold: '#f2c14e', grass: '#5da33b', slot: '#22262d', tooltipBg: '#100010' };
  const pairs = [
    ['aktueller Schritt: Text auf Fläche 3', tokens.text, tokens.surface3],
    ['aktueller Schritt: gedämpfter Text', tokens.muted, tokens.surface3],
    ['Schrittnummer aktuell (gold)', tokens.onAccent, tokens.gold],
    ['Schrittnummer fertig (grün)', tokens.onAccent, tokens.grass],
    ['Schrittnummer offen', tokens.text, tokens.slot],
    ['abgehaktes Material', tokens.muted, mixHex(tokens.grass, tokens.surface, 0.08)],
    ['Segment gewählt', tokens.onAccent, tokens.grass],
    ['Notiz-Beschriftung', tokens.text, tokens.tooltipBg],
    ['Werkzeug über der 3D-Ansicht', tokens.text, mixHex('#15171b', '#8899aa', 0.82)],
  ];
  for (const [name, fg, bg] of pairs) assert.ok(contrastRatio(fg, bg) >= 4.5, `${name}: ${contrastRatio(fg, bg).toFixed(2)}`);
});

test('Echte Spieldaten: Draufsicht und Icons aus Modellen und Texturen', { skip: !hasGameData && 'game-data/ fehlt' }, async () => {
  const store = new TextureStore(JSON.parse(readFileSync(path.join(GAME_DATA, 'textures.json'), 'utf8')), new Uint8Array(readFileSync(path.join(GAME_DATA, 'textures.bin'))));
  const models = new BlockModels(JSON.parse(readFileSync(path.join(GAME_DATA, 'models.json'), 'utf8')), JSON.parse(readFileSync(path.join(GAME_DATA, 'blocks.json'), 'utf8')));
  const appearance = new Appearance(store, models);
  // Stein von oben = Textur block/stone
  const stone = await appearance.topTile('stone');
  const texture = await store.image('block/stone');
  assert.deepEqual([...stone.data.subarray(0, 4)], [...texture.data.subarray(0, 4)]);
  assert.equal(coverage(stone), 1);
  // Gras: getönte Oberseite (grün, nicht grau)
  const grass = await appearance.topTile('grass_block[snowy=false]');
  const [r, g, b] = grass.data.subarray(0, 3);
  assert.ok(g > r && g > b, `Gras ist grün (${r}, ${g}, ${b})`);
  // Untere Stufe: halbe Höhe, von oben voll
  assert.equal(coverage(await appearance.topTile('oak_slab[type=bottom,waterlogged=false]')), 1);
  // Mohn hat keine Fläche nach oben → verkleinertes Bild
  const poppy = await appearance.topTile('poppy');
  assert.ok(coverage(poppy) > 0.05 && coverage(poppy) < 0.9);
  // Wasser: getönte Wasser-Textur
  assert.ok(coverage(await appearance.topTile('water[level=0]')) > 0.9);
  // Icons
  const stairs = await appearance.iconUrl('oak_stairs', 'oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]');
  assert.match(stairs, /^data:image\/png;base64,/);
  const torch = await appearance.iconUrl('torch', 'wall_torch[facing=north]');
  assert.match(torch, /^data:image\/png;base64,/);
  assert.match(await appearance.iconUrl('redstone', 'redstone_wire[east=none,north=none,power=0,south=none,west=none]'), /^data:image\/png;base64,/, 'Item-Bild des Spiels');
  assert.equal(await appearance.iconUrl('gibt_es_nicht', null), null);
});
