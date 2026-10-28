// Rechenkern des 3D-Workers (js/render/engine-worker.js) in Node: Quellen prüfen, Strukturen/Module/Galerie/
// Testvolumen bauen, Kollisionsboxen, Paletten-Infos und Meshing über die Engine. Mit echten Spieldaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dataTest, loadGameData, textureMap, GAME_DATA } from './render-models-fixture.test.mjs';
import {
  Engine, EngineError, checkSource, checkModulePath, checkStructureFile, checkParams, buildStructure, buildModule, buildGallery,
  buildSynthetic, buildShapeResult, galleryBlockIds, galleryPageCount, GALLERY_GROUP_NAMES, GALLERY_PAGE_SIZE, collisionBoxes, paletteInfo,
  serializeResult, meshTransferList, SYNTHETIC_MAX,
} from '../../js/render/engine-worker.js';
import { setBlockData } from '../../js/core/block-data.js';
import { BlockVolume } from '../../js/core/volume.js';

const rejects = (fn, pattern) => assert.throws(fn, (error) => error instanceof EngineError && pattern.test(error.message));

test('Quellen: nur erlaubte Modulpfade, Strukturnamen und Parameter', () => {
  for (const ok of ['js/builds/haeuser/turm.js', 'tests/fixtures/core/example-house.js', 'js/builds/wahrzeichen/tokyo-skytree.js']) {
    assert.equal(checkModulePath(ok), ok);
  }
  for (const bad of ['../js/builds/x.js', 'js/builds/../../x.js', '/js/builds/x.js', 'js/ui/home.js', 'js/builds//x.js', 'js/builds/X.js',
    'https://example.com/js/builds/x.js', 'js/builds/x.mjs', 'js/builds/.hidden/x.js', 42, null]) {
    rejects(() => checkModulePath(bad), /Ungültiger Modulpfad/);
  }
  assert.equal(checkStructureFile('igloo__top.json'), 'igloo__top.json');
  for (const bad of ['index.json', '../igloo.json', 'igloo.JSON', 'a/b.json', 'igloo', '', `${'a'.repeat(200)}.json`]) {
    rejects(() => checkStructureFile(bad), /Ungültiger Strukturname/);
  }
  assert.deepEqual(checkSource({ kind: 'gallery' }), { kind: 'gallery', group: 'all', page: 0 });
  assert.deepEqual(checkSource({ kind: 'gallery', group: 'stairs', page: 0 }), { kind: 'gallery', group: 'stairs', page: 0 });
  rejects(() => checkSource({ kind: 'gallery', group: 'toString' }), /Unbekannte Galerie/);
  rejects(() => checkSource({ kind: 'gallery', page: -1 }), /Galerie-Seite/);
  assert.deepEqual(checkSource({ kind: 'synthetic', count: 10 }), { kind: 'synthetic', count: 10 });
  rejects(() => checkSource({ kind: 'synthetic', count: SYNTHETIC_MAX + 1 }), /Testvolumen/);
  rejects(() => checkSource({ kind: 'synthetic', count: 1.5 }), /Testvolumen/);
  rejects(() => checkSource({ kind: 'shape', shape: 'Kugel!' }), /Formname/);
  assert.deepEqual(checkSource({ kind: 'shape', shape: 'kugel', params: { radius: 5 } }), { kind: 'shape', shape: 'kugel', params: { radius: 5 } });
  rejects(() => checkSource({ kind: 'file', path: 'x' }), /Unbekannte Quelle/);
  rejects(() => checkSource(null), /Unbekannte Quelle/);
  assert.deepEqual(checkParams({ scale: 0.5, label: 'a', on: true, points: [[1, 2], [3, 4]] }), { scale: 0.5, label: 'a', on: true, points: [[1, 2], [3, 4]] });
  assert.deepEqual(checkParams(undefined), {});
  rejects(() => checkParams({ scale: 0 }), /scale/);
  rejects(() => checkParams({ scale: Infinity }), /ungültiger Wert/);
  rejects(() => checkParams({ fn: () => 1 }), /ungültiger Wert/);
  rejects(() => checkParams({ 'bad-key': 1 }), /ungültiger Name/);
  rejects(() => checkParams([1, 2]), /einfaches Objekt/);
  rejects(() => checkParams({ deep: [[[[1]]]] }), /ungültiger Wert/);
});

test('Formen: ohne Generator verständliche Ablehnung, mit Generator ein BuildResult', () => {
  rejects(() => buildShapeResult({}, 'kugel', {}), /Formen-Generator ist noch nicht verfügbar/);
  const result = buildShapeResult({ buildShape: (b, shape, params) => b.fill(0, 0, 0, params.size - 1, 0, params.size - 1, 'stone') }, 'platte', { size: 3 });
  assert.equal(result.blockCount, 9);
  assert.deepEqual(result.shape, { shape: 'platte', params: { size: 3 } });
  rejects(() => buildShapeResult({ buildShape: () => { throw new Error('Radius fehlt.'); } }, 'kugel', {}), /Die Form „kugel“ konnte nicht gebaut werden: Radius fehlt\./);
});

dataTest('Bau-Module: meta wird übernommen, Fehler werden verständlich gemeldet', async () => {
  setBlockData(loadGameData().blocks);
  const mod = await import('../fixtures/core/example-house.js');
  const result = buildModule(mod, {}, 'tests/fixtures/core/example-house.js');
  assert.equal(result.meta.id, 'example-house');
  assert.ok(result.blockCount > 300 && result.steps.length > 10);
  assert.ok(result.phases.every((p) => Object.keys(p).sort().join() === 'steps,title' && p.title !== ''), 'Kapitel nur mit Titel');
  assert.ok(result.steps.every((s) => !('title' in s) && !('text' in s) && !('tips' in s)), 'Schritte ohne Titel und Text');
  assert.equal('notes' in result, false, 'keine Notizen');
  rejects(() => buildModule({}, {}, 'js/builds/x.js'), /ist kein Bau-Modul/);
  rejects(() => buildModule({ default: (b) => b.set(0, 0, 0, 'gibtsnicht') }, {}, 'js/builds/x.js'), /Das Bau-Modul „js\/builds\/x\.js“ konnte nicht gebaut werden: .*gibtsnicht/);
  rejects(() => buildModule({ default: async () => {} }, {}, 'js/builds/x.js'), /synchron/);
});

dataTest('Original-Struktur → BuildResult mit Kapitel „Aufbau“ in Ebenen', () => {
  setBlockData(loadGameData().blocks);
  const file = 'igloo__top.json';
  const data = JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'structures', file), 'utf8'));
  let solid = 0;
  for (let i = 0; i < data.rle.length; i += 2) if (data.rle[i] !== 0) solid += data.rle[i + 1];
  const result = buildStructure(data, { file });
  assert.equal(result.blockCount, solid);
  assert.equal(result.phases.length, 1);
  assert.equal(result.phases[0].title, 'Aufbau');
  // Kapitel nur mit Titel, Schritte ohne Titel und Text, keine Notizen
  assert.deepEqual(result.phases, [{ title: 'Aufbau', steps: result.steps.map((s) => s.index) }]);
  for (const step of result.steps) assert.deepEqual(Object.keys(step).sort(), ['blockCount', 'index', 'layerY', 'materials', 'phase']);
  assert.equal('notes' in result, false);
  assert.ok(result.steps.every((s, i) => i === 0 || s.layerY > result.steps[i - 1].layerY), 'Ebenen von unten nach oben');
  assert.deepEqual(result.structure.size, data.size);
  assert.equal(result.structure.file, file);
  // Beschädigte Datei: Anzahl der Zellen passt nicht
  assert.throws(() => buildStructure({ ...data, rle: data.rle.slice(0, -2) }, { file }), (e) => e instanceof EngineError && e.code === 'data');
  assert.throws(() => buildStructure({ ...data, palette: ['stone'] }, { file }), (e) => e instanceof EngineError && /palette/.test(e.message));
});

dataTest('Galerie: alle Gruppen ohne Warnungen, „all“ zeigt jeden Block genau einmal', () => {
  setBlockData(loadGameData().blocks);
  for (const group of GALLERY_GROUP_NAMES.filter((g) => g !== 'all')) {
    const result = buildGallery(group);
    assert.deepEqual(result.warnings, [], `${group}: ${result.warnings.join(' | ')}`);
    assert.ok(result.gallery.items.length > 0 && result.gallery.rows.length === result.steps.length, group);
    // Den Namen einer Reihe trägt gallery.rows, nicht der Schritt
    assert.ok(result.gallery.rows.every((row) => typeof row.title === 'string' && row.title !== ''), group);
    assert.ok(result.steps.every((s) => !('title' in s)), group);
    assert.deepEqual(result.phases.map((p) => p.title), [`Galerie: ${group}`]);
    for (const row of result.gallery.rows) assert.ok(row.min.every((v, a) => v >= 0 && v <= row.max[a] && row.max[a] < result.size[a]), `${group}: ${row.title}`);
  }
  const pages = galleryPageCount('all');
  assert.equal(pages, Math.ceil(galleryBlockIds().length / GALLERY_PAGE_SIZE));
  const seen = [];
  for (let page = 0; page < pages; page++) {
    const result = buildGallery('all', page);
    assert.deepEqual(result.warnings, [], `Seite ${page}`);
    assert.ok(result.gallery.items.length <= GALLERY_PAGE_SIZE);
    seen.push(...result.gallery.items.map((item) => item.label));
    // Erster Teil jedes Eintrags = Standardzustand des Blocks an der gemeldeten Position
    for (const item of result.gallery.items.slice(0, 5)) assert.equal(result.volume.get(item.x, item.y, item.z).split('[')[0], item.label);
  }
  assert.deepEqual(seen, galleryBlockIds());
  assert.ok(!seen.includes('air') && seen.includes('stone') && seen.length > 1100);
  assert.throws(() => buildGallery('all', pages), /hat nur/);
});

dataTest('Testvolumen: deterministisch, mindestens count Blöcke, Schritte = Ebenen', () => {
  setBlockData(loadGameData().blocks);
  const a = buildSynthetic(6000);
  const b = buildSynthetic(6000);
  assert.ok(a.blockCount >= 6000 && a.blockCount < 6000 + 120, `${a.blockCount} Blöcke`);
  assert.equal(a.blockCount, b.blockCount);
  assert.deepEqual(a.volume.palette, b.volume.palette);
  assert.ok(a.volume.palette.some((s) => s.startsWith('water')) && a.volume.palette.some((s) => s.startsWith('oak_leaves')), 'Wasser und Laub dabei');
  assert.ok(a.steps.every((s) => s.layerY !== null));
});

dataTest('Kollisionsboxen aus den Modellflächen (Treppen, Stufen, Zäune 1,5, Pflanzen ohne)', async () => {
  const { models, blocks } = loadGameData();
  setBlockData(blocks);
  const engine = new Engine({ modelsJson: models, blocksJson: blocks });
  const states = {
    stone: [[0, 0, 0, 1, 1, 1]],
    'oak_slab[type=bottom,waterlogged=false]': [[0, 0, 0, 1, 0.5, 1]],
    'oak_slab[type=top,waterlogged=false]': [[0, 0.5, 0, 1, 1, 1]],
    'oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]': [[0, 0, 0, 1, 1, 0.5], [0, 0, 0.5, 1, 0.5, 1]],
    'white_carpet': [[0, 0, 0, 1, 1 / 16, 1]],
    'oak_trapdoor[facing=north,half=bottom,open=false,powered=false,waterlogged=false]': [[0, 0, 0, 1, 3 / 16, 1]],
    glass: [[0, 0, 0, 1, 1, 1]],
    'oak_leaves[distance=7,persistent=true,waterlogged=false]': [[0, 0, 0, 1, 1, 1]],
    'skeleton_skull[powered=false,rotation=0]': [[0.25, 0, 0.25, 0.75, 0.5, 0.75]],
  };
  const none = ['torch', 'poppy', 'water[level=0]', 'rail[shape=north_south,waterlogged=false]', 'oak_sign[rotation=0,waterlogged=false]', 'red_banner[rotation=0]',
    'stone_button[face=floor,facing=north,powered=false]', 'oak_pressure_plate[powered=false]', 'short_grass', 'light[level=15,waterlogged=false]',
    'oak_fence_gate[facing=north,in_wall=false,open=true,powered=false]', 'redstone_wire[east=none,north=none,power=0,south=none,west=none]'];
  const tall = ['oak_fence[east=true,north=false,south=false,waterlogged=false,west=true]', 'cobblestone_wall[east=low,north=none,south=none,up=true,waterlogged=false,west=low]',
    'oak_fence_gate[facing=north,in_wall=false,open=false,powered=false]'];
  const door = 'oak_door[facing=north,half=lower,hinge=left,open=false,powered=false]';
  const all = [...Object.keys(states), ...none, ...tall, door];
  engine.models.bindTextures(await textureMap(engine.models.textureNames(all)));
  const round = (boxes) => boxes?.map((box) => box.map((v) => Math.round(v * 1e4) / 1e4)) ?? null;
  for (const [state, expected] of Object.entries(states)) assert.deepEqual(round(collisionBoxes(engine.models, state)), round(expected), state);
  for (const state of none) assert.equal(collisionBoxes(engine.models, state), null, state);
  for (const state of tall) {
    const boxes = collisionBoxes(engine.models, state);
    assert.ok(boxes && boxes.every((box) => box[4] === 1.5), `${state}: ${JSON.stringify(boxes)}`);
  }
  // Tür (untere Hälfte ohne Oberseite): 3/16 dicke Platte über die ganze Höhe
  const doorBoxes = collisionBoxes(engine.models, door);
  assert.equal(doorBoxes.length, 1);
  const [x1, y1, z1, x2, y2, z2] = doorBoxes[0];
  assert.deepEqual([y1, y2], [0, 1]);
  assert.ok(Math.min(x2 - x1, z2 - z1) === 3 / 16 && Math.max(x2 - x1, z2 - z1) === 1, JSON.stringify(doorBoxes));
});

dataTest('Engine: bauen, Texturen binden, Chunks, Schritt und Kappe meshen, Ergebnis übertragen', async () => {
  const { models, blocks } = loadGameData();
  const engine = new Engine({ modelsJson: models, blocksJson: blocks });
  const loaders = {
    importModule: (p) => import(`../../${p}`),
    loadStructure: (file) => JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'structures', file), 'utf8')),
    importShapes: async () => ({}),
  };
  await assert.rejects(engine.build({ kind: 'module', path: '../secret.js' }, {}, loaders), EngineError);
  await assert.rejects(engine.build({ kind: 'shape', shape: 'kugel' }, {}, loaders), /Formen-Generator/);
  const result = await engine.build({ kind: 'module', path: 'tests/fixtures/core/example-house.js' }, {}, loaders);
  assert.equal(engine.volume, null, 'build verändert die Engine nicht');
  engine.use(result);
  assert.deepEqual(result.source, { kind: 'module', path: 'tests/fixtures/core/example-house.js' });
  const names = engine.textureNames();
  assert.ok(names.includes('block/oak_planks') && names.some((n) => n.startsWith('region:entity/chest/normal')));
  const info = engine.bind(await textureMap(names));
  const palette = engine.volume.palette;
  assert.equal(info.collision.length, palette.length);
  assert.equal(info.outline.length, palette.length * 6);
  assert.equal(info.pickable[0], 0, 'Luft ist nicht auswählbar');
  assert.ok(info.pickable.slice(1).every((v) => v === 1), 'alle Blöcke des Hauses sind auswählbar');
  const order = engine.chunkOrder();
  assert.equal(order.length, engine.volume.chunks.size);
  assert.ok(order.every((c, i) => i === 0 || order[i - 1].cy <= c.cy), 'von unten nach oben');
  let quads = 0;
  for (const { cx, cy, cz } of order) {
    const mesh = engine.meshChunk(cx, cy, cz);
    assert.ok(mesh.minStep >= 0 && mesh.minStep < result.steps.length);
    quads += mesh.solid.quadCount + mesh.cutout.quadCount + mesh.translucent.quadCount;
    assert.equal(meshTransferList(mesh).length, [mesh.solid, mesh.cutout, mesh.translucent].filter((l) => l.quadCount > 0).length);
  }
  assert.ok(quads > 500, `${quads} Quads`);
  const step = engine.meshStep(0);
  assert.ok(step.solid.quadCount > 0);
  assert.equal(step.solid.centers.length, step.solid.quadCount * 16);
  const cap = engine.meshCap(1);
  assert.ok(cap.solid.quadCount > 0, 'Schnitt durch Ebene 2 hat Deckflächen');
  const { result: plain, volume, transferList } = serializeResult(result);
  assert.equal(plain.volume, undefined);
  // Worker-Nachricht „built“: ohne notes, Kapitel nur mit Titel, Schritte ohne Titel und Text
  assert.equal('notes' in plain, false);
  assert.ok(plain.phases.length >= 2 && plain.phases.every((p) => Object.keys(p).sort().join() === 'steps,title'));
  for (const step of plain.steps) assert.deepEqual(Object.keys(step).sort(), ['blockCount', 'index', 'layerY', 'materials', 'phase']);
  assert.equal(transferList.length, volume.chunks.length * 2);
  assert.equal(BlockVolume.fromTransfer(volume).count, result.blockCount);
});
