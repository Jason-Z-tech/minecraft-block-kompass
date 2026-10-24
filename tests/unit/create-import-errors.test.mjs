// Datei-Import: Grenzen (64 MB Datei, 256 MB entpackt, 3 Mio. Blöcke, Kanten ≤ 4064), beschädigte Dateien,
// unbekannte Formate und der Weg zu modelToVolume (create:voxelize) – mit verständlichen deutschen Fehlern.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureData } from '../fixtures/core/setup.mjs';
import { importFile, importToBuildResult, ImportError, IMPORT_LIMITS } from '../../js/create/import/index.js';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'create', 'import');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name));

before(() => loadFixtureData());

// Fehler muss ein ImportError mit Code und deutscher Meldung ohne Stacktrace sein.
async function rejectsWith(promise, code, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ImportError, `ImportError erwartet, bekommen: ${error?.name}: ${error?.message}`);
    assert.equal(error.code, code, error.message);
    assert.match(error.message, pattern);
    assert.doesNotMatch(error.message, /\bat .+:\d+/, 'kein Stacktrace in der Meldung');
    return true;
  });
}

const load = (name, format, extra = {}) => importFile({ format, name, data: fixture(name), ...extra });

test('beschädigte und falsche Dateien', async () => {
  await rejectsWith(load('truncated.schem', 'schem'), 'corrupt', /beschädigt oder unvollständig/);
  await rejectsWith(load('gzip-text.schem', 'schem'), 'corrupt', /beschädigt/);
  await rejectsWith(load('deep.nbt', 'nbt'), 'corrupt', /beschädigt/);
  await rejectsWith(load('garbage.litematic', 'litematic'), 'unknown-format', /keine Minecraft-Datei/);
  await rejectsWith(load('legacy.schematic', 'schem'), 'legacy-schematic', /alte MCEdit-Schematic.*WorldEdit neu als \.schem/);
  await rejectsWith(load('all-air.schem', 'schem'), 'no-blocks', /keine Blöcke/);
  await rejectsWith(importFile({ format: 'schem', name: 'leer.schem', data: new ArrayBuffer(0) }), 'empty-file', /leer/);
  await rejectsWith(importFile({ format: 'exe', name: 'x.exe', data: new ArrayBuffer(4) }), 'unknown-format', /Unbekanntes Dateiformat/);
  await rejectsWith(importFile({ format: 'schem', name: 'x', data: 'kein Puffer' }), 'argument', /nicht gelesen/);
  await rejectsWith(importFile({ format: 'gltf', name: 'x.gltf', data: new TextEncoder().encode('kein json') }), 'unknown-format', /kein glTF/);
});

test('NBT ohne bekannten Aufbau und unbekannte Sponge-Version', async () => {
  const { encodeNbt, nbt } = await import('../fixtures/create/import/make-fixtures.mjs');
  const other = encodeNbt('', nbt.compound({ Level: nbt.compound({ xPos: nbt.int(1) }) }));
  await rejectsWith(importFile({ format: 'nbt', name: 'region.nbt', data: other }), 'unknown-format', /weder eine Schematic/);
  const v4 = encodeNbt('', nbt.compound({ Schematic: nbt.compound({ Version: nbt.int(4), Width: nbt.short(1), Height: nbt.short(1), Length: nbt.short(1) }) }));
  await rejectsWith(importFile({ format: 'schem', name: 'v4.schem', data: v4 }), 'unsupported', /Version 4 wird nicht unterstützt/);
  const short = encodeNbt('Schematic', nbt.compound({
    Version: nbt.int(2), Width: nbt.short(4), Height: nbt.short(1), Length: nbt.short(1),
    Palette: nbt.compound({ 'minecraft:stone': nbt.int(0) }), BlockData: nbt.byteArray(Int8Array.from([0, 0])),
  }));
  await rejectsWith(importFile({ format: 'schem', name: 'kurz.schem', data: short }), 'corrupt', /enden nach 2 von 4 Zellen/);
  const region = (states) => encodeNbt('', nbt.compound({ Regions: nbt.compound({ R: nbt.compound({
    Position: nbt.compound({ x: nbt.int(0), y: nbt.int(0), z: nbt.int(0) }), Size: nbt.compound({ x: nbt.int(4), y: nbt.int(4), z: nbt.int(4) }),
    BlockStatePalette: nbt.list(10, [nbt.compound({ Name: nbt.string('minecraft:air') }), nbt.compound({ Name: nbt.string('minecraft:stone') })]),
    BlockStates: nbt.longArray(states),
  }) }) }));
  await rejectsWith(importFile({ format: 'litematic', name: 'r.litematic', data: region([1n]) }), 'corrupt', /1 statt 2 Long-Werte/);
  // Wert 3 in jedem 2-Bit-Feld zeigt auf keinen Paletteneintrag → Luft mit Warnung → keine Blöcke
  await rejectsWith(importFile({ format: 'litematic', name: 'r.litematic', data: region([-1n, -1n]) }), 'no-blocks', /keine Blöcke/);
  const big = await importFile({ format: 'litematic', name: 'r.litematic', data: region([0x5555555555555555n, 0x5555555555555555n]) });
  assert.equal(big.blockCount, 64, 'Wert 1 in jedem 2-Bit-Feld = Stein');
});

test('Grenzen: Blöcke, Kanten, Dateigröße, entpackte Größe', async () => {
  await rejectsWith(load('too-many-blocks.schem', 'schem'), 'too-many-blocks', /mehr als 3\.000\.000 Blöcke/);
  await rejectsWith(load('too-wide.schem', 'schem'), 'too-big', /4\.100 × 1 × 1 Blöcke.*höchstens 4\.064/);
  await rejectsWith(load('bomb.nbt', 'nbt'), 'unpacked-too-large', /entpackt größer als 256 MB/);
  await rejectsWith(load('house-v2.schem', 'schem', { limits: { ...IMPORT_LIMITS, maxFileBytes: 1000 } }), 'file-too-large', /zu groß \(0 MB\) – erlaubt sind höchstens 0 MB/);
  await rejectsWith(load('house-raw-v2.schem', 'schem', { limits: { ...IMPORT_LIMITS, maxUnpackedBytes: 1000 } }), 'unpacked-too-large', /entpackt größer/);
  await rejectsWith(load('house-v2.schem', 'schem', { limits: { ...IMPORT_LIMITS, maxBlocks: 10 } }), 'too-many-blocks', /mehr als 10 Blöcke/);
  await rejectsWith(load('regions.litematic', 'litematic', { limits: { ...IMPORT_LIMITS, maxEdge: 10 } }), 'too-big', /11 × 9 × 6/);
  assert.equal(IMPORT_LIMITS.maxFileBytes, 64 * 1024 * 1024);
  assert.equal(IMPORT_LIMITS.maxUnpackedBytes, 256 * 1024 * 1024);
  assert.equal(IMPORT_LIMITS.maxBlocks, 3_000_000);
  assert.equal(IMPORT_LIMITS.maxEdge, 4064);
});

test('Prototyp-Tricks in der Palette ändern nichts am Objekt-Prototyp', async () => {
  const imported = await load('proto.schem', 'schem');
  assert.equal({}.polluted, undefined);
  assert.deepEqual(imported.palette, ['air', 'stone']);
  assert.equal(imported.blockCount, 1);
  assert.ok(imported.warnings.some((w) => /„__proto__“/.test(w)));
});

// ------------------------------------------------------------------ Modelle (Vertrag mit create:voxelize)

function fakeVoxelizer(calls, result) {
  return async () => ({
    modelToVolume: async (format, buffer, params, extra) => {
      calls.push({ format, buffer, params, extra });
      if (result instanceof Error) throw result;
      return typeof result === 'function' ? result() : result;
    },
  });
}

test('Modelle: Weitergabe an modelToVolume, Umwandlung des Volumens, Fehler', async () => {
  const calls = [];
  const volume = { size: [2, 2, 1], palette: ['air', 'white_wool', 'minecraft:stone'], data: Uint16Array.from([1, 0, 2, 1]), warnings: ['3 Dreiecke ohne Fläche übersprungen.'], stats: { triangles: 12 } };
  const obj = new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
  const imported = await importFile({
    format: 'obj', name: 'figur.obj', data: obj, params: { height: 2 },
    loadBlockColors: async () => ({ format: 1, blocks: [] }), importVoxelizer: fakeVoxelizer(calls, volume),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].format, 'obj');
  assert.ok(calls[0].buffer instanceof ArrayBuffer);
  assert.equal(calls[0].buffer.byteLength, obj.length);
  assert.deepEqual(calls[0].params, { height: 2 });
  assert.deepEqual(calls[0].extra.blockColors, { format: 1, blocks: [] });
  assert.equal(imported.format, 'obj');
  assert.equal(imported.blockCount, 3);
  assert.deepEqual(imported.size, [2, 2, 1]);
  assert.deepEqual(imported.stats.model, { triangles: 12 });
  assert.ok(imported.warnings.includes('3 Dreiecke ohne Fläche übersprungen.'));
  const result = importToBuildResult(imported);
  assert.equal(result.volume.get(0, 0, 0), 'white_wool');
  assert.equal(result.volume.get(0, 1, 0), 'stone');
  assert.equal(result.volume.get(1, 1, 0), 'white_wool');
  assert.equal(result.volume.get(1, 0, 0), 'air');
  assert.deepEqual(result.phases.map((p) => p.title), ['Aufbau']);

  // VOX-Kennung mit falscher Endung → als .vox weitergegeben
  const voxCalls = [];
  const vox = await importFile({ format: 'schem', name: 'x.schem', data: new TextEncoder().encode('VOX \u0096\u0000\u0000\u0000'), importVoxelizer: fakeVoxelizer(voxCalls, volume) });
  assert.equal(voxCalls[0].format, 'vox');
  assert.ok(vox.warnings.some((w) => /eigentlich im Format MagicaVoxel/.test(w)));

  await rejectsWith(importFile({ format: 'stl', name: 'a.stl', data: obj, importVoxelizer: async () => { throw new Error('Cannot find module'); } }),
    'module-missing', /3D-Modellen .* noch nicht verfügbar/);
  await rejectsWith(importFile({ format: 'stl', name: 'a.stl', data: obj, importVoxelizer: async () => ({}) }), 'module-missing', /noch nicht verfügbar/);
  await rejectsWith(importFile({ format: 'stl', name: 'a.stl', data: obj, importVoxelizer: fakeVoxelizer([], new Error('Das Modell hat keine Dreiecke.')) }),
    'model', /Das Modell konnte nicht umgewandelt werden: Das Modell hat keine Dreiecke\./);
  await rejectsWith(importFile({ format: 'stl', name: 'a.stl', data: obj, importVoxelizer: fakeVoxelizer([], { size: [1, 1, 1], palette: ['stone'], data: new Uint16Array(1) }) }),
    'model', /ungültiges Ergebnis geliefert \(palette\)/);
  await rejectsWith(importFile({ format: 'stl', name: 'a.stl', data: obj, importVoxelizer: fakeVoxelizer([], { size: [1, 1, 1], palette: ['air', 'stone'], data: Uint16Array.from([5]) }) }),
    'model', /Index außerhalb der Palette/);
  await rejectsWith(importFile({ format: 'stl', name: 'a.stl', data: obj, importVoxelizer: fakeVoxelizer([], volume),
    loadBlockColors: async () => { throw new Error('Die Blockfarben fehlen (game-data/block-colors.json).'); } }), 'data-missing', /Blockfarben fehlen/);
});
