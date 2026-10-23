import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from '../../js/core/builder.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';

loadFixtureData();

// Großzügige Grenze, damit der Test auch parallel zu anderen Tests stabil bleibt; Messwerte stehen im Log.
test('1 Mio. Blöcke einzeln setzen und finalize in wenigen Sekunden', (t) => {
  const states = ['stone', 'cobblestone', 'oak_planks', 'glass', 'oak_log[axis=x]', 'oak_stairs[facing=north]', 'oak_fence', 'cobblestone_wall', 'glass_pane', 'redstone_wire'];
  const b = new Builder();
  const t0 = performance.now();
  for (let y = 0; y < 100; y++) {
    for (let z = 0; z < 100; z++) {
      for (let x = 0; x < 100; x++) b.set(x - 50, y - 20, z - 50, states[(x * 7 + y * 3 + z * 11) % states.length]);
    }
  }
  const t1 = performance.now();
  const result = b.finalize();
  const t2 = performance.now();
  t.diagnostic(`set: ${(t1 - t0).toFixed(0)} ms, finalize: ${(t2 - t1).toFixed(0)} ms`);
  assert.equal(result.blockCount, 1_000_000);
  assert.deepEqual(result.size, [100, 100, 100]);
  assert.equal(result.steps.length, 100);
  assert.ok(t2 - t0 < 15_000, `zu langsam: ${(t2 - t0).toFixed(0)} ms`);
});
