// Gemeinsame Hilfen für die Render-Tests (Blockmodelle, Mesher) mit den echten Spieldaten aus game-data/.
// Texturen werden ohne GPU gebunden: PNG dekodieren und Alpha-Klasse/Maske wie TextureStore.prepare bestimmen.
// Die Selbsttests unten laufen nur, wenn diese Datei direkt gestartet wird (nicht beim Import).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BlockModels } from '../../js/render/block-models.js';
import { decodePng, buildLayer, parseTextureName } from '../../js/render/texture-store.js';
import { BlockVolume } from '../../js/core/volume.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GAME_DATA = path.join(ROOT, 'game-data');
const REQUIRED = ['models.json', 'blocks.json', 'textures.json', 'textures.bin', 'meta.json'];
export const hasGameData = REQUIRED.every((file) => fs.existsSync(path.join(GAME_DATA, file)));
// Ohne erzeugte Spieldaten (node scripts/extract-game-data.mjs) werden die Tests übersprungen.
export const dataTest = hasGameData ? test : test.skip;

let gameData = null;

export function loadGameData() {
  if (!gameData) {
    const json = (file) => JSON.parse(fs.readFileSync(path.join(GAME_DATA, file), 'utf8'));
    gameData = {
      models: json('models.json'),
      blocks: json('blocks.json'),
      textures: json('textures.json'),
      meta: json('meta.json'),
      bin: fs.readFileSync(path.join(GAME_DATA, 'textures.bin')),
    };
  }
  return gameData;
}

export function createModels() {
  const data = loadGameData();
  return new BlockModels(data.models, data.blocks);
}

const layerCache = new Map();

// Wie TextureStore.prepare (ohne GL): { alpha, mask, maskWidth, maskHeight } je Name.
async function textureInfo(name) {
  let info = layerCache.get(name);
  if (info) return info;
  const parsed = parseTextureName(name);
  if (parsed.kind === 'missing') info = { alpha: 'opaque', mask: null, maskWidth: 16, maskHeight: 16, missing: true };
  else {
    const data = loadGameData();
    if (parsed.kind === 'invalid') throw new Error(`Ungültiger Texturname ${name}: ${parsed.reason}`);
    const entry = data.textures.entries[parsed.texture];
    if (!entry) throw new Error(`Textur ${parsed.texture} fehlt in textures.json`);
    const image = await decodePng(data.bin.subarray(entry.o, entry.o + entry.l));
    const built = buildLayer(parsed.texture, entry, image, { region: parsed.kind === 'region' ? parsed : null });
    info = { alpha: built.alpha, mask: built.mask, maskWidth: built.maskWidth, maskHeight: built.maskHeight, missing: false };
  }
  layerCache.set(name, info);
  return info;
}

// Map<name, { layer, alpha, mask … }> mit fortlaufenden Ebenen in sortierter Namensreihenfolge.
export async function textureMap(names) {
  const map = new Map();
  let layer = 0;
  for (const name of [...names].sort()) map.set(name, { layer: layer++, ...(await textureInfo(name)) });
  return map;
}

// Bindet alle Texturen, die diese Zustände brauchen, und gibt die Map zurück.
export async function bindFor(models, states) {
  const map = await textureMap(models.textureNames(states));
  models.bindTextures(map);
  return map;
}

// Volumen aus [[x, y, z, state, step = 0], …].
export function volumeFrom(entries) {
  const volume = new BlockVolume();
  for (const [x, y, z, state, step = 0] of entries) volume.set(x, y, z, state, step);
  return volume;
}

// Fertige Kontexte für Mesher-Tests: Modelle mit den Texturen genau dieses Volumens.
export async function meshContext(entries, { models = createModels(), ao = true } = {}) {
  const volume = volumeFrom(entries);
  await bindFor(models, volume.palette.slice(1));
  return { volume, models, ao };
}

const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntry) {
  dataTest('Testdaten: Bindung ohne GPU liefert Ebenen, Alpha-Klassen und Masken', async () => {
    const models = createModels();
    const map = await bindFor(models, ['stone', 'glass', 'oak_leaves', 'chest']);
    assert.equal(map.get('block/stone').alpha, 'opaque');
    assert.equal(map.get('block/oak_leaves').alpha, 'cutout');
    assert.ok(map.get('block/glass').mask instanceof Uint8Array);
    assert.ok([...map.keys()].some((name) => name.startsWith('region:entity/chest/normal:')));
    assert.deepEqual([...map.values()].map((entry) => entry.layer), [...Array(map.size).keys()]);
  });

  dataTest('Testdaten: volumeFrom setzt Zustände und Schritte', () => {
    const volume = volumeFrom([[0, 0, 0, 'stone', 3], [1, 2, 3, 'glass']]);
    assert.equal(volume.get(0, 0, 0), 'stone');
    assert.equal(volume.getStep(0, 0, 0), 3);
    assert.equal(volume.getStep(1, 2, 3), 0);
  });
}
