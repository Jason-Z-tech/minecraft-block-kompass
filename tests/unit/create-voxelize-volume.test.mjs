// Voxelisierung und Vertrag von modelToVolume (js/create/voxelize/index.js, voxelize.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelToVolume, volumeFromModel, parseModel, normalizeParams, formatFromFileName, MODEL_FORMATS, LIMITS } from '../../js/create/voxelize/index.js';
import { fitToGrid, resolveUpAxis } from '../../js/create/voxelize/voxelize.js';
import { binaryStl, asciiStl, cubeTriangles } from '../fixtures/create/voxelize/make-fixtures.mjs';
import { testBlockColors, sphereTriangles, voxelReader, outsideReachable } from '../fixtures/create/voxelize/test-helpers.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'create', 'voxelize');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name));
const blockColors = testBlockColors();

function countBy(result) {
  const counts = {};
  for (const v of result.data) if (v) counts[result.palette[v]] = (counts[result.palette[v]] ?? 0) + 1;
  return counts;
}

test('Vertrag: size, palette mit air vorn, Uint16Array mit Index (y·l + z)·w + x, warnings, stats', async () => {
  const result = await modelToVolume('stl', fixture('cube-binary.stl').buffer.slice(0), { height: 10 }, { blockColors });
  assert.deepEqual(Object.keys(result).sort(), ['data', 'palette', 'size', 'stats', 'warnings']);
  assert.deepEqual(result.size, [10, 10, 10]);
  assert.equal(result.palette[0], 'air');
  assert.ok(result.data instanceof Uint16Array);
  assert.equal(result.data.length, 1000);
  assert.deepEqual(Object.keys(result.stats).sort(), ['ms', 'triangles', 'voxels']);
  assert.equal(result.stats.triangles, 12);
  assert.ok(Array.isArray(result.warnings));
  const at = voxelReader(result);
  // hohl: Hülle 10³ − 8³
  assert.equal(result.stats.voxels, 1000 - 512);
  assert.ok(at(0, 0, 0) && at(9, 9, 9) && at(9, 0, 5) && !at(5, 5, 5));
  let counted = 0;
  for (const v of result.data) if (v) counted++;
  assert.equal(counted, result.stats.voxels);
});

test('Würfel-STL binär und ASCII ergeben exakt die erwarteten Maße (auch gefüllt und skaliert)', async () => {
  for (const [file, height, expected] of [['cube-binary.stl', 10, [10, 10, 10]], ['cube-ascii.stl', 10, [10, 10, 10]], ['cube-ascii.stl', 7, [7, 7, 7]], ['cube-binary.stl', 1, [1, 1, 1]]]) {
    const result = await modelToVolume('stl', fixture(file), { height, solid: true }, { blockColors });
    assert.deepEqual(result.size, expected, `${file} Höhe ${height}`);
    assert.equal(result.stats.voxels, expected[0] * expected[1] * expected[2], `${file} Höhe ${height} gefüllt`);
  }
  // Quader 20 × 10 × 5 (STL z oben → Minecraft y): Höhe 10 → 20 × 10 × 5 Blöcke
  const box = cubeTriangles(0, 1).map((tri) => tri.map(([x, y, z]) => [x * 20, y * 5, z * 10]));
  const result = await modelToVolume('stl', binaryStl(box), { height: 10, solid: true }, { blockColors });
  assert.deepEqual(result.size, [20, 10, 5]);
  assert.equal(result.stats.voxels, 1000);
});

test('Kugel: symmetrisch, ohne Löcher, gefüllt', async () => {
  const stl = binaryStl(sphereTriangles(10, 64, 32));
  const hollow = await modelToVolume('stl', stl, { height: 31 }, { blockColors });
  const solid = await modelToVolume('stl', stl, { height: 31, solid: true }, { blockColors });
  assert.deepEqual(hollow.size, [31, 31, 31]);
  const at = voxelReader(hollow);
  const atSolid = voxelReader(solid);
  const outside = outsideReachable(hollow);
  const [w, h, l] = hollow.size;
  const c = 15;
  for (let y = 0; y < h; y++) {
    for (let z = 0; z < l; z++) {
      for (let x = 0; x < w; x++) {
        const v = !!at(x, y, z);
        assert.equal(v, !!at(w - 1 - x, y, z), `Spiegelung x bei ${x},${y},${z}`);
        assert.equal(v, !!at(x, h - 1 - y, z), `Spiegelung y bei ${x},${y},${z}`);
        assert.equal(v, !!at(x, y, l - 1 - z), `Spiegelung z bei ${x},${y},${z}`);
        assert.equal(v, !!at(z, y, x), `Vertauschung x/z bei ${x},${y},${z}`);
        const d = Math.hypot(x - c, y - c, z - c);
        // Hülle dicht: innen (Abstand < 14) ist von außen nicht erreichbar; gefüllt: alles innen belegt
        if (d < 14) {
          assert.equal(outside(x, y, z), false, `Loch: ${x},${y},${z} ist von außen erreichbar`);
          assert.ok(atSolid(x, y, z), `nicht gefüllt: ${x},${y},${z}`);
        }
        if (d > 16.5) assert.ok(!atSolid(x, y, z), `außerhalb belegt: ${x},${y},${z}`);
      }
    }
  }
  const volume = (4 / 3) * Math.PI * 15.5 ** 3;
  assert.ok(solid.stats.voxels > volume * 0.95 && solid.stats.voxels < volume * 1.25, `Volumen ${solid.stats.voxels} statt ≈ ${Math.round(volume)}`);
});

test('Undichtes Netz: der Mehrheitsentscheid füllt trotzdem (fast) genauso', async () => {
  const full = await modelToVolume('stl', binaryStl(sphereTriangles(10, 64, 32)), { height: 31, solid: true }, { blockColors });
  const leaky = await modelToVolume('stl', binaryStl(sphereTriangles(10, 64, 32, { skip: new Set([100, 101, 640, 1500, 1501, 1502, 2900]) })), { height: 31, solid: true }, { blockColors });
  assert.ok(Math.abs(full.stats.voxels - leaky.stats.voxels) <= full.stats.voxels * 0.01, `${leaky.stats.voxels} statt ${full.stats.voxels}`);
});

test('Hochachse: STL automatisch z, wählbar y; Seitenverhältnis bleibt', async () => {
  // Säule 2 × 2 × 8, lang entlang STL-z
  const column = cubeTriangles(0, 1).map((tri) => tri.map(([x, y, z]) => [x * 2, y * 2, z * 8]));
  const auto = await modelToVolume('stl', binaryStl(column), { height: 8 }, { blockColors });
  assert.deepEqual(auto.size, [2, 8, 2]);
  const yUp = await modelToVolume('stl', binaryStl(column), { height: 2, upAxis: 'y' }, { blockColors });
  assert.deepEqual(yUp.size, [2, 2, 8]);
  assert.equal(resolveUpAxis('auto', 'z'), 'z');
  assert.equal(resolveUpAxis('auto', 'y'), 'y');
  assert.throws(() => resolveUpAxis('x', 'y'), /Unbekannte Hochachse/);
});

test('Flaches Modell: größte Seite bestimmt den Maßstab, mit Hinweis', async () => {
  const quad = [[[0, 0, 0], [4, 0, 0], [4, 2, 0]], [[0, 0, 0], [4, 2, 0], [0, 2, 0]]];
  const result = await modelToVolume('stl', binaryStl(quad), { height: 8 }, { blockColors });
  assert.deepEqual(result.size, [8, 1, 4]);
  assert.equal(result.stats.voxels, 32);
  assert.ok(result.warnings.some((w) => /flach/.test(w)));
});

test('OBJ mit Farben aus der .mtl: rote und blaue Hälfte', async () => {
  const result = await modelToVolume('obj', fixture('colored.obj'), { height: 4, palette: 'wolle', solid: true }, { blockColors, mtl: fixture('colored.mtl') });
  assert.deepEqual(result.size, [8, 4, 4]);
  const at = voxelReader(result);
  assert.equal(result.palette[at(0, 2, 2)], 'red_wool');
  assert.equal(result.palette[at(7, 2, 2)], 'blue_wool');
  assert.equal(result.stats.voxels, 128);
});

test('GLB mit Textur: Viertel der Ebene in vier Farben, Würfel weiß', async () => {
  const result = await modelToVolume('glb', fixture('textured.glb'), { height: 12, palette: 'wolle' }, { blockColors });
  assert.deepEqual(result.size, [32, 12, 32]);
  const at = voxelReader(result);
  const name = (x, y, z) => result.palette[at(x, y, z)];
  assert.equal(name(4, 0, 4), 'red_wool', 'x < 0, z < 0: oben links der Textur');
  assert.equal(name(27, 0, 4), 'lime_wool', 'x > 0, z < 0: oben rechts');
  assert.equal(name(4, 0, 27), 'blue_wool', 'x < 0, z > 0: unten links');
  assert.equal(name(27, 0, 27), 'yellow_wool', 'x > 0, z > 0: unten rechts');
  // Würfel: Welt y 0,25 … 0,75 → Ebenen 4 … 11, x/z 12 … 19
  assert.equal(name(12, 11, 12), 'white_wool');
  assert.equal(at(12, 3, 12), 0);
  assert.deepEqual(countBy(result), { red_wool: 256, lime_wool: 256, blue_wool: 256, yellow_wool: 256, white_wool: 296 });
});

test('.vox: Originalgröße, vox-z = Minecraft-y, skaliert, gefüllt', async () => {
  const result = await modelToVolume('vox', fixture('scene.vox'), { palette: 'wolle' }, { blockColors });
  // vox x −1 … 5, y −1 … 1, z 0 … 1 → Minecraft x 7, y (vox-z) 2, z (−vox-y) 3
  assert.deepEqual(result.size, [7, 2, 3]);
  assert.deepEqual(countBy(result), { red_wool: 8, blue_wool: 3 });
  const at = voxelReader(result);
  // Säule entlang vox-y liegt in Minecraft entlang z bei x = 6, y = 1
  assert.equal(result.palette[at(6, 1, 0)], 'blue_wool');
  assert.equal(result.palette[at(6, 1, 2)], 'blue_wool');
  const doubled = await modelToVolume('vox', fixture('scene.vox'), { palette: 'wolle', height: 4 }, { blockColors });
  assert.deepEqual(doubled.size, [14, 4, 6]);
  assert.equal(doubled.stats.voxels, 8 * 8 + 3 * 8);
  // Hohlkugel aus Voxeln: gefüllt schließt das Innere
  const plain = await modelToVolume('vox', fixture('plain.vox'), { solid: true }, { blockColors });
  assert.equal(plain.stats.voxels, 4);
});

test('Palette „einfarbig“ und Häufigkeits-Reihenfolge der Palette', async () => {
  const single = await modelToVolume('glb', fixture('textured.glb'), { height: 12, palette: 'einfarbig', block: 'minecraft:stone' }, { blockColors });
  assert.deepEqual(single.palette, ['air', 'stone']);
  const result = await modelToVolume('glb', fixture('textured.glb'), { height: 12, palette: 'wolle' }, { blockColors });
  assert.equal(result.palette[1], 'white_wool', 'häufigster Block zuerst');
});

test('Parameter: Standardwerte und verständliche Fehler', async () => {
  assert.deepEqual(normalizeParams('stl', {}), { height: 64, solid: false, palette: 'alle', block: null, upAxis: 'auto' });
  assert.equal(normalizeParams('vox', {}).height, null);
  assert.throws(() => normalizeParams('stl', { height: 0 }), /ganze Zahl von 1 bis 1024/);
  assert.throws(() => normalizeParams('stl', { height: 1025 }), /1 bis 1024/);
  assert.throws(() => normalizeParams('stl', { height: 2.5 }), /ganze Zahl/);
  assert.throws(() => normalizeParams('stl', { solid: 'ja' }), /true oder false/);
  assert.throws(() => normalizeParams('stl', { palette: 'glas' }), /Unbekannte Palette/);
  assert.throws(() => normalizeParams('stl', { palette: 'einfarbig' }), /fehlt der Block/);
  assert.throws(() => normalizeParams('stl', { block: 'stone' }), /nur zusammen mit der Palette „einfarbig“/);
  assert.throws(() => normalizeParams('stl', { upAxis: 'x' }), /Unbekannte Hochachse/);
  assert.throws(() => normalizeParams('stl', { scale: 2 }), /Unbekannte Einstellung „scale“/);
  await assert.rejects(modelToVolume('fbx', new ArrayBuffer(10), {}, { blockColors }), /Unbekanntes Format „fbx“/);
  await assert.rejects(modelToVolume('stl', new ArrayBuffer(0), {}, { blockColors }), /Datei ist leer/);
  await assert.rejects(modelToVolume('stl', fixture('cube-binary.stl'), {}, {}), /Blockfarben fehlen/);
  await assert.rejects(modelToVolume('stl', fixture('cube-binary.stl'), { palette: 'einfarbig', block: 'glass' }, { blockColors }), /kein voller, deckender Block/);
  assert.equal(formatFromFileName('Burg.GLB'), 'glb');
  assert.equal(formatFromFileName('modell.fbx'), null);
  assert.deepEqual(MODEL_FORMATS, ['stl', 'obj', 'glb', 'gltf', 'vox']);
});

test('Grenzen: Dateigröße, Raster, Blöcke', async () => {
  const big = new Uint8Array(LIMITS.fileBytes + 1);
  await assert.rejects(modelToVolume('stl', big, {}, { blockColors }), /größer als 64 MB/);
  // langer dünner Stab: Höhe 1024 → Länge über 4064 Blöcke
  const rod = cubeTriangles(0, 1).map((tri) => tri.map(([x, y, z]) => [x * 1000, y, z]));
  await assert.rejects(modelToVolume('stl', binaryStl(rod), { height: 1024, upAxis: 'y' }, { blockColors }), /höchstens 4064 je Seite/);
  // gefüllter Würfel mit Höhe 400 → 64 Mio. Blöcke: Raster zu groß, Vorschlag einer Höhe
  await assert.rejects(modelToVolume('stl', fixture('cube-binary.stl'), { height: 450, solid: true }, { blockColors }), /Wähle höchstens Höhe 406/);
  // gefüllter Würfel mit Höhe 150 → 3,4 Mio. Blöcke
  await assert.rejects(modelToVolume('stl', fixture('cube-binary.stl'), { height: 150, solid: true }, { blockColors }), /Gefüllt wären es 3\.375\.000 Blöcke – höchstens 3\.000\.000/);
  const positions = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.throws(() => fitToGrid(positions, { height: 4, up: 'y' }), /keine Ausdehnung/);
});

test('volumeFromModel: gelesenes Modell mehrfach nutzbar; onProgress meldet die Schritte', async () => {
  const model = await parseModel('stl', fixture('cube-binary.stl'));
  const before = Array.from(model.mesh.positions);
  const a = volumeFromModel(model, { height: 10 }, { blockColors });
  const b = volumeFromModel(model, { height: 5 }, { blockColors });
  assert.deepEqual(a.size, [10, 10, 10]);
  assert.deepEqual(b.size, [5, 5, 5]);
  assert.deepEqual(Array.from(model.mesh.positions), before, 'Modell unverändert');
  const messages = [];
  await modelToVolume('stl', fixture('cube-binary.stl'), { height: 4, solid: true }, { blockColors, onProgress: (text, share) => messages.push([text, share]) });
  assert.deepEqual(messages, [['Lese das Modell …', null], ['Lege die Oberfläche in Blöcke und fülle das Innere …', null]]);
  // Fehler im Rückruf brechen den Import nicht ab
  const original = console.error;
  console.error = () => {};
  try {
    const result = await modelToVolume('stl', fixture('cube-binary.stl'), { height: 4 }, { blockColors, onProgress: () => { throw new Error('kaputt'); } });
    assert.equal(result.stats.voxels, 64 - 8);
  } finally {
    console.error = original;
  }
  assert.throws(() => volumeFromModel({ kind: 'anders' }, {}, { blockColors }), /braucht das Ergebnis von parseModel/);
});

test('ASCII- und Binär-STL derselben Kugel ergeben dasselbe Volumen', async () => {
  const tris = sphereTriangles(3, 24, 12);
  const a = await modelToVolume('stl', Buffer.from(asciiStl(tris)), { height: 12 }, { blockColors });
  const b = await modelToVolume('stl', binaryStl(tris), { height: 12 }, { blockColors });
  assert.deepEqual(a.size, b.size);
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
});

test('Leistung: 100 000 Dreiecke, Höhe 128 (gemessen)', async () => {
  const tris = sphereTriangles(50, 316, 158);
  assert.ok(tris.length > 99_000);
  const stl = binaryStl(tris);
  const started = performance.now();
  const hollow = await modelToVolume('stl', stl, { height: 128 }, { blockColors });
  const hollowMs = performance.now() - started;
  const solidStart = performance.now();
  const solid = await modelToVolume('stl', stl, { height: 128, solid: true, palette: 'beton' }, { blockColors });
  const solidMs = performance.now() - solidStart;
  console.log(`Leistung: ${tris.length} Dreiecke, Höhe 128 – hohl ${Math.round(hollowMs)} ms (${hollow.stats.voxels} Blöcke), gefüllt ${Math.round(solidMs)} ms (${solid.stats.voxels} Blöcke)`);
  assert.deepEqual(hollow.size, [128, 128, 128]);
  assert.ok(solid.stats.voxels > 1_000_000);
  // großzügige Grenze, damit langsame Rechner nicht scheitern
  assert.ok(hollowMs < 15_000 && solidMs < 15_000);
});
