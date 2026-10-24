// Upload-Quelle im 3D-Worker (js/render/engine-worker.js): { kind:'upload', format, name, data: ArrayBuffer, params }
// prüfen, über js/create/import/index.js bauen, Fehler als EngineError code 'upload', Datei nicht im Ergebnis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureData } from '../fixtures/core/setup.mjs';
import { dataTest, loadGameData, textureMap } from './render-models-fixture.test.mjs';
import { Engine, EngineError, checkSource, buildUploadResult, UPLOAD_MAX_BYTES } from '../../js/render/engine-worker.js';
import * as uploader from '../../js/create/import/index.js';
import { setBlockData } from '../../js/core/block-data.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'create', 'import');
const fixtureBuffer = (name) => {
  const bytes = fs.readFileSync(path.join(FIXTURES, name));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
};
const engineError = (pattern, code = null) => (error) => error instanceof EngineError && pattern.test(error.message) && (code === null || error.code === code);

test('checkSource: Upload-Quellen werden geprüft und bereinigt', () => {
  const data = new ArrayBuffer(8);
  const clean = checkSource({ kind: 'upload', format: 'schem', name: 'C:\\Downloads\\Burg\u0000.schem', data, params: { height: 40 } });
  assert.deepEqual(clean, { kind: 'upload', format: 'schem', name: 'Burg.schem', data, params: { height: 40 } });
  assert.equal(clean.data, data, 'kein Kopieren der Datei');
  assert.equal(checkSource({ kind: 'upload', format: 'glb', data }).name, 'Datei');
  assert.throws(() => checkSource({ kind: 'upload', format: 'exe', data }), engineError(/Unbekanntes Dateiformat/, 'source'));
  assert.throws(() => checkSource({ kind: 'upload', format: 'toString', data }), engineError(/Unbekanntes Dateiformat/));
  assert.throws(() => checkSource({ kind: 'upload', format: 'schem', data: new Uint8Array(4) }), engineError(/ArrayBuffer/, 'source'));
  assert.throws(() => checkSource({ kind: 'upload', format: 'schem', data: new ArrayBuffer(0) }), engineError(/leer/, 'upload'));
  assert.throws(() => checkSource({ kind: 'upload', format: 'schem', data: new ArrayBuffer(UPLOAD_MAX_BYTES + 1) }), engineError(/zu groß .* höchstens 64 MB/, 'upload'));
  assert.throws(() => checkSource({ kind: 'upload', format: 'schem', data, params: { 'bad-key': 1 } }), engineError(/Upload-Parameter/));
});

test('buildUploadResult: Datei → BuildResult, Fortschritt, Fehler als EngineError', async () => {
  loadFixtureData();
  const messages = [];
  const source = checkSource({ kind: 'upload', format: 'litematic', name: 'regions.litematic', data: fixtureBuffer('regions.litematic') });
  const result = await buildUploadResult(uploader, source, { progress: (m) => messages.push(m) });
  assert.deepEqual(result.phases.map((p) => p.title), ['Region „Haus“', 'Region „Turm“']);
  assert.equal(result.upload.format, 'litematic');
  assert.equal(result.upload.blockCount, 55);
  assert.deepEqual(result.upload.chapters, ['Region „Haus“', 'Region „Turm“']);
  assert.ok(messages.includes('Entpacke Datei …'));
  assert.ok(messages.some((m) => /^Baue 55 Blöcke/.test(m)));
  // Ergebnis lässt sich wie jedes BuildResult übertragen
  const { volume, ...plain } = result;
  assert.doesNotThrow(() => structuredClone(plain));

  const broken = checkSource({ kind: 'upload', format: 'schem', name: 'kaputt.schem', data: fixtureBuffer('truncated.schem') });
  await assert.rejects(buildUploadResult(uploader, broken), engineError(/^Die Datei ist beschädigt oder unvollständig/, 'upload'));
  const wide = checkSource({ kind: 'upload', format: 'schem', name: 'breit.schem', data: fixtureBuffer('too-wide.schem') });
  await assert.rejects(buildUploadResult(uploader, wide), engineError(/jede Kante darf höchstens 4\.064/, 'upload'));
  await assert.rejects(buildUploadResult({}, source), engineError(/Datei-Import ist noch nicht verfügbar/, 'source'));
  const model = checkSource({ kind: 'upload', format: 'stl', name: 'a.stl', data: new TextEncoder().encode('solid a\nendsolid a\n').buffer });
  await assert.rejects(buildUploadResult(uploader, model, { importVoxelizer: async () => { throw new EngineError('Der Import von 3D-Modellen (.vox, .stl, .obj, .glb, .gltf) ist noch nicht verfügbar.'); } }),
    engineError(/3D-Modellen .* noch nicht verfügbar/, 'upload'));
});

dataTest('Engine.build: Upload mit echten Spieldaten bauen und meshen, Datei nicht im Ergebnis', async () => {
  const { models, blocks } = loadGameData();
  const engine = new Engine({ modelsJson: models, blocksJson: blocks });
  const data = fixtureBuffer('house-v3.schem');
  const progress = [];
  const loaders = { importUploader: async () => uploader, progress: (m) => progress.push(m) };
  const result = await engine.build({ kind: 'upload', format: 'schem', name: 'house-v3.schem', data }, {}, loaders);
  assert.deepEqual(result.source, { kind: 'upload', format: 'schem', name: 'house-v3.schem', bytes: data.byteLength, params: {} });
  assert.equal(result.blockCount, 24);
  assert.equal(result.volume.get(1, 1, 0), 'iron_chain[axis=x,waterlogged=false]');
  engine.use(result);
  const names = engine.textureNames();
  assert.ok(names.includes('block/stone'));
  engine.bind(await textureMap(names));
  let quads = 0;
  for (const { cx, cy, cz } of engine.chunkOrder()) {
    const mesh = engine.meshChunk(cx, cy, cz);
    quads += mesh.solid.quadCount + mesh.cutout.quadCount + mesh.translucent.quadCount;
  }
  assert.ok(quads > 50, `Quads: ${quads}`);
  assert.ok(progress.length > 0);
});

// Gegenprobe mit dem echten Modell-Import (create:voxelize), sobald Modul und game-data/block-colors.json da sind.
const VOXELIZE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'create', 'voxelize', 'index.js');
const BLOCK_COLORS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'game-data', 'block-colors.json');
const voxelTest = fs.existsSync(VOXELIZE) && fs.existsSync(BLOCK_COLORS) ? dataTest : test.skip;

function cubeStl() {
  const quads = [
    [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  ];
  const facet = (a, b, c) => `facet normal 0 0 0\nouter loop\n${[a, b, c].map((v) => `vertex ${v.join(' ')}`).join('\n')}\nendloop\nendfacet\n`;
  return `solid cube\n${quads.map(([a, b, c, d]) => facet(a, b, c) + facet(a, c, d)).join('')}endsolid cube\n`;
}

voxelTest('Modell-Import mit dem echten modelToVolume: STL-Würfel → hohler Würfel aus Blöcken', async () => {
  setBlockData(loadGameData().blocks);
  const blockColors = JSON.parse(fs.readFileSync(BLOCK_COLORS, 'utf8'));
  const data = new TextEncoder().encode(cubeStl()).buffer;
  const source = checkSource({ kind: 'upload', format: 'stl', name: 'wuerfel.stl', data, params: { height: 8 } });
  const result = await buildUploadResult(uploader, source, { loadBlockColors: async () => blockColors });
  assert.deepEqual(result.size, [8, 8, 8]);
  assert.equal(result.blockCount, 8 ** 3 - 6 ** 3, 'Hülle eines 8er-Würfels');
  assert.equal(result.upload.format, 'stl');
  assert.equal(result.upload.model.triangles, 12);
});
