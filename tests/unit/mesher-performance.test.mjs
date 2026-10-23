// Leistung des Meshers (Ziel laut Auftrag: ein 16³-Chunk im Schnitt unter 5 ms). Die Grenzen haben Puffer,
// weil node --test die Dateien parallel ausführt; die Messwerte stehen im Log (t.diagnostic).
import assert from 'node:assert/strict';
import { dataTest, createModels, bindFor } from './render-models-fixture.test.mjs';
import { meshChunk } from '../../js/render/mesher.js';
import { BlockVolume } from '../../js/core/volume.js';
import { hashPosition } from '../../js/core/random.js';

const MIX = [
  'stone', 'oak_planks', 'glass', 'oak_leaves[distance=1,persistent=true,waterlogged=false]', 'grass_block[snowy=false]',
  'oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]',
  'oak_fence[east=true,north=false,south=false,waterlogged=false,west=true]', 'stone_bricks', 'cobblestone', 'white_concrete',
];

function measure(volume, models) {
  const ctx = { volume, models };
  const chunks = volume.chunkList();
  meshChunk(ctx, chunks[0].cx, chunks[0].cy, chunks[0].cz); // Aufwärmen (Paletten-Infos, JIT)
  let quads = 0;
  let max = 0;
  const start = performance.now();
  for (const chunk of chunks) {
    const t0 = performance.now();
    const mesh = meshChunk(ctx, chunk.cx, chunk.cy, chunk.cz);
    max = Math.max(max, performance.now() - t0);
    quads += mesh.solid.quadCount + mesh.cutout.quadCount + mesh.translucent.quadCount;
  }
  const total = performance.now() - start;
  return { chunks: chunks.length, total, average: total / chunks.length, max, quads };
}

const describe = (label, r) => `${label}: ${r.chunks} Chunks in ${r.total.toFixed(0)} ms (Ø ${r.average.toFixed(2)} ms, max ${r.max.toFixed(1)} ms), ${r.quads} Quads`;

dataTest('Leistung: voller 64³-Würfel und 300 000 verstreute Blöcke', async (t) => {
  const models = createModels();
  await bindFor(models, MIX);

  const cube = (stepOf) => {
    const volume = new BlockVolume();
    const stone = volume.paletteIndex('stone');
    for (let y = 0; y < 64; y++) for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) volume.setIndex(x, y, z, stone, stepOf(y));
    return volume;
  };
  const full = measure(cube(() => 0), models);
  t.diagnostic(describe('64³ Stein, alles Schritt 0', full));
  // Schritt je Ebene: jede Ebene behält ihre Oberseite, bis die nächste Ebene kommt (hide = Schritt darüber)
  const layered = measure(cube((y) => y), models);
  t.diagnostic(describe('64³ Stein, Schritt je Ebene', layered));

  const scattered = new BlockVolume();
  const indices = MIX.map((state) => scattered.paletteIndex(state));
  let placed = 0;
  for (let i = 0; placed < 300_000; i++) {
    const h = hashPosition(i, 7, 13, 99);
    const x = h % 128, y = (h >>> 7) % 64, z = (h >>> 13) % 128;
    if (scattered.has(x, y, z)) continue;
    scattered.setIndex(x, y, z, indices[(h >>> 20) % indices.length], y);
    placed++;
  }
  const loose = measure(scattered, models);
  t.diagnostic(describe('300 000 verstreut (Mischung aus 10 Zuständen)', loose));

  assert.equal(full.chunks, 64);
  // Alles in einem Schritt: nur die Hülle (6 × 64 × 64 Blockflächen, teils zu Streifen zusammengelegt)
  assert.ok(full.quads <= 6 * 64 * 64, `${full.quads} Quads`);
  // Schritt je Ebene: Hülle plus höchstens eine Zwischendecke je Ebene
  assert.ok(layered.quads > full.quads && layered.quads <= 6 * 64 * 64 + 63 * 64 * 64, `${layered.quads} Quads`);
  assert.ok(full.average < 5, `voller Würfel: Ø ${full.average.toFixed(2)} ms pro Chunk`);
  assert.ok(layered.average < 10, `Würfel mit Ebenen-Schritten: Ø ${layered.average.toFixed(2)} ms pro Chunk`);
  assert.ok(loose.average < 15, `verstreut: Ø ${loose.average.toFixed(2)} ms pro Chunk`);
});
