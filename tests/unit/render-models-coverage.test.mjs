// Vollständigkeit: jeder Zustand jedes Blocks aus 26.2 und jeder Zustand aus den Bau-Modulen
// lässt sich mit den echten Daten in Quads umwandeln (keine Ausnahme, gültige Werte).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataTest, createModels, textureMap, loadGameData, ROOT } from './render-models-fixture.test.mjs';
import { LAYERS } from '../../js/render/block-models.js';
import { formatState } from '../../js/core/blockstate.js';
import { setBlockData } from '../../js/core/block-data.js';
import { Builder } from '../../js/core/builder.js';
import { CATEGORIES } from '../../scripts/check-build.mjs';

function allStates(blocks) {
  const states = [];
  for (const [id, entry] of Object.entries(blocks.blocks)) {
    const keys = Object.keys(entry.props).sort();
    const walk = (index, props) => {
      if (index === keys.length) {
        states.push(formatState(id, props));
        return;
      }
      for (const value of entry.props[keys[index]]) walk(index + 1, { ...props, [keys[index]]: value });
    };
    walk(0, {});
  }
  return states;
}

function checkQuads(state, quads, layers) {
  for (const q of quads) {
    assert.ok(layers.has(q.tex), `${state}: Ebene ${q.tex} nicht gebunden`);
    assert.ok(LAYERS.includes(q.layer), `${state}: Schicht ${q.layer}`);
    assert.ok(q.tint === -1 || (Number.isInteger(q.tint) && q.tint >= 0 && q.tint <= 0xffffff), `${state}: Tönung ${q.tint}`);
    assert.ok(Math.abs(Math.hypot(...q.normal) - 1) < 1e-5, `${state}: Normale`);
    for (const v of q.pos) assert.ok(v > -1.5 && v < 2.5, `${state}: Position ${v}`);
    for (const v of q.uv) assert.ok(v >= -1e-6 && v <= 16 + 1e-6, `${state}: UV ${v}`);
  }
}

dataTest('Alle 32 366 Blockzustände: Texturnamen, Bindung und Quads ohne Fehler', async (t) => {
  const { blocks } = loadGameData();
  const models = createModels();
  const states = allStates(blocks);
  const t0 = performance.now();
  const names = models.textureNames(states);
  const t1 = performance.now();
  const map = await textureMap(names);
  const t2 = performance.now();
  models.bindTextures(map);
  const layers = new Set([...map.values()].map((entry) => entry.layer));
  let quadCount = 0;
  let opaque = 0;
  for (const state of states) {
    const quads = models.quads(state, 3, 64, -7);
    checkQuads(state, quads, layers);
    quadCount += quads.length;
    if (models.isOpaqueFullCube(state)) opaque++;
  }
  const t3 = performance.now();
  t.diagnostic(`${states.length} Zustände, ${names.size} Texturen/Regionen, ${quadCount} Quads, ${opaque} voll deckend; `
    + `Namen ${(t1 - t0).toFixed(0)} ms, Texturen ${(t2 - t1).toFixed(0)} ms, Quads ${(t3 - t2).toFixed(0)} ms`);
  assert.equal(states.length, 32366);
  const unexpected = models.warnings.filter((w) => !w.includes('copper_golem_statue'));
  assert.deepEqual(unexpected, []);
  assert.ok(opaque > 300, `nur ${opaque} voll deckende Zustände`);
});

// Früher prüfte dieser Test die Zustände der Original-Strukturen; die gibt es nicht mehr. Jetzt: alle Bau-Module
// (Standard-Maßstab wie im Katalog: 1, wenn erlaubt, sonst der erste).
dataTest('Alle Zustände der Bau-Module ergeben Quads', { timeout: 120_000 }, async (t) => {
  setBlockData(loadGameData().blocks);
  const states = new Set();
  let modules = 0;
  for (const category of CATEGORIES) {
    const dir = path.join(ROOT, 'js', 'builds', category);
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js')).sort()) {
      const mod = await import(pathToFileURL(path.join(dir, file)).href);
      const scales = Array.isArray(mod.meta?.scales) && mod.meta.scales.length ? mod.meta.scales : null;
      const b = new Builder();
      mod.default(b, scales ? { scale: scales.includes(1) ? 1 : scales[0] } : {});
      for (const state of b.finalize().volume.palette) if (state !== 'air') states.add(state);
      modules++;
    }
  }
  t.diagnostic(`${modules} Bau-Module, ${states.size} verschiedene Zustände`);
  assert.ok(modules >= 69, `nur ${modules} Bau-Module`);
  const models = createModels();
  const map = await textureMap(models.textureNames(states));
  models.bindTextures(map);
  const layers = new Set([...map.values()].map((entry) => entry.layer));
  for (const state of states) checkQuads(state, models.quads(state, 0, 0, 0), layers);
  assert.ok(states.size > 1000, `nur ${states.size} Zustände`);
  assert.deepEqual(models.warnings, []);
});
