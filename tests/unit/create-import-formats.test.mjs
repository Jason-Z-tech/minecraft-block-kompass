// Datei-Import (js/create/import/): Sponge-Schematic v1–v3, Litematica (Regionen, negative Größen, Bit-Packing
// über Long-Grenzen mit 4, 5 und 9 Bit), Strukturdatei .nbt, Achsen-Reihenfolge, Formaterkennung am Inhalt.
// Testdateien: tests/fixtures/create/import/ (make-fixtures.mjs); Blockdaten: tests/fixtures/core (echte 26.2-Daten).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureData, blockMap } from '../fixtures/core/setup.mjs';
import { completeState } from '../../js/core/block-data.js';
import {
  importFile, importToBuildResult, sniffContent, formatFromName, cleanFileName, UPLOAD_FORMATS, UPLOAD_ACCEPT,
} from '../../js/create/import/index.js';
import { readLitematic, litematicBits, regionBox } from '../../js/create/import/litematic.js';
import { StateConverter } from '../../js/create/import/rename.js';
import { BlockCollector } from '../../js/create/import/common.js';
import { packBits, TOWER, towerCell, bigPaletteStates } from '../fixtures/create/import/make-fixtures.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'create', 'import');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name));
const strip = (state) => state.replace(/^minecraft:/, '');

before(() => loadFixtureData());

async function load(name, format = formatFromName(name)) {
  const imported = await importFile({ format, name, data: new Uint8Array(fixture(name)) });
  return { imported, result: importToBuildResult(imported) };
}

// Erwartetes Ergebnis der Testszene (5 × 4 × 3) nach den Regeln aus §12.2, unabhängig vom Import-Code notiert.
function expectedScene(dy = 0) {
  const map = new Map();
  const put = (x, y, z, state) => map.set(`${x},${y + dy},${z}`, completeState(state));
  for (let z = 0; z < 3; z++) for (let x = 0; x < 5; x++) if (!(x === 4 && z === 2)) put(x, 0, z, 'stone');
  put(0, 1, 0, 'oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]');
  put(1, 1, 0, 'iron_chain[axis=x,waterlogged=false]');
  put(2, 1, 0, 'cobblestone_wall[east=low,north=none,south=none,up=true,waterlogged=false,west=low]');
  put(4, 1, 0, 'oak_stairs[facing=north,half=top]');
  put(1, 1, 1, 'dirt_path');
  put(2, 1, 1, 'oak_sign[rotation=4]');
  put(1, 1, 2, 'oak_log[axis=y]');
  put(0, 3, 2, 'bricks');
  put(4, 3, 0, 'white_wool');
  put(4, 3, 2, 'glass');
  return map;
}

test('Sponge-Schematic v1, v2, v3 (gzip, zlib, ungepackt) ergeben genau die Testszene', async () => {
  for (const name of ['house-v1.schem', 'house-v2.schem', 'house-v3.schem', 'house-raw-v2.schem', 'house-zlib-v2.schem']) {
    const { imported, result } = await load(name);
    assert.equal(imported.format, 'schem', name);
    assert.deepEqual(blockMap(result.volume), expectedScene(), name);
    assert.deepEqual(result.size, [5, 4, 3], name);
    assert.equal(result.blockCount, 24, name);
    assert.deepEqual(result.phases.map((p) => p.title), ['Aufbau'], name);
    // Schritte = belegte Ebenen, ohne Titel und Text; Kapitel nur mit Titel
    assert.deepEqual(result.steps.map((s) => s.layerY), [0, 1, 3], name);
    assert.ok(result.steps.every((s) => !('title' in s) && !('text' in s)), name);
    assert.deepEqual(Object.keys(result.phases[0]).sort(), ['steps', 'title'], name);
    assert.equal('notes' in result, false, name);
    assert.deepEqual(Object.keys(imported.parts[0]).sort(), ['blocks', 'count', 'title'], `${name}: Kapitel des Imports ohne Text`);
    assert.equal(result.upload.format, 'schem');
    assert.equal(result.upload.name, name);
  }
  const v1 = (await load('house-v1.schem')).imported;
  const v2 = (await load('house-v2.schem')).imported;
  const v3 = (await load('house-v3.schem')).imported;
  assert.deepEqual([v1.formatLabel, v2.formatLabel, v3.formatLabel], ['Sponge-Schematic v1', 'Sponge-Schematic v2', 'Sponge-Schematic v3']);
  // Palette nur mit genutzten Zuständen (die Datei hat 240 ungenutzte Treppen-Einträge)
  assert.equal(v2.palette.length, 12);
  assert.equal(v2.stats.paletteSize, 12);
  assert.equal(v1.stats.dataVersion, null);
  assert.equal(v2.stats.dataVersion, 4903);
  assert.equal(v2.stats.entities, 2);
  assert.equal(v2.stats.blockEntities, 1);
  assert.equal(v3.stats.entities, 1);
  assert.equal(v2.stats.title, 'Testhaus');
  assert.equal(v2.stats.author, 'Block-Kompass');
  assert.equal(v3.stats.title, 'Testhaus v3');
  assert.deepEqual(v2.stats.sourceSize, [5, 4, 3]);
  assert.ok(v2.warnings.some((w) => /2 Objekte/.test(w)));
  assert.ok(v3.warnings.some((w) => /1 Objekt .* es wird nicht angezeigt/.test(w)));
});

test('Achsen: index = x + z·Breite + y·Breite·Länge (Ecken der Szene an der richtigen Stelle)', async () => {
  const { result } = await load('house-v2.schem');
  const v = result.volume;
  assert.equal(v.get(0, 3, 2), 'bricks');
  assert.equal(v.get(4, 3, 0), 'white_wool');
  assert.equal(v.get(4, 3, 2), 'glass');
  assert.equal(v.get(0, 3, 0), 'air');
  assert.equal(v.get(4, 0, 2), 'air');
});

test('Strukturdatei .nbt: Testszene plus jigsaw → final_state, structure_block und Luft fallen weg', async () => {
  const { imported, result } = await load('house.nbt');
  const expected = expectedScene();
  expected.set('2,2,2', 'spruce_planks');
  assert.deepEqual(blockMap(result.volume), expected);
  assert.equal(imported.format, 'nbt');
  assert.equal(imported.stats.entities, 1);
  assert.equal(imported.stats.dataVersion, 4903);
});

test('Litematica: zwei Regionen als Kapitel, negative Größe, 4 und 5 Bit über Long-Grenzen', async () => {
  const { imported, result } = await load('regions.litematic');
  assert.equal(imported.format, 'litematic');
  assert.equal(imported.formatLabel, 'Litematica v6');
  assert.deepEqual(result.phases.map((p) => p.title), ['Region „Haus“', 'Region „Turm“']);
  assert.equal(imported.stats.regions, 2);
  assert.deepEqual(imported.stats.regionList.map((r) => [r.name, r.min, r.size]), [['Haus', [0, 0, 0], [5, 4, 3]], ['Turm', [8, -5, 4], [3, 6, 2]]]);

  // Turm: Position (10, 0, 5), Größe (−3, −6, −2) → kleinste Ecke (8, −5, 4); alles um y + 5 verschoben
  const expected = expectedScene(5);
  const [sx, sy, sz] = TOWER.size.map(Math.abs);
  for (let i = 0; i < sx * sy * sz; i++) {
    const value = towerCell(i);
    if (value === 0) continue;
    const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz));
    expected.set(`${8 + x},${y},${4 + z}`, completeState(strip(TOWER.states[value - 1])));
  }
  assert.deepEqual(blockMap(result.volume), expected);
  assert.deepEqual(result.size, [11, 9, 6]);
  assert.equal(result.offset.join(), '0,0,0');
  // jedes Kapitel in Ebenen von unten nach oben
  const turm = result.phases[1].steps.map((i) => result.steps[i]);
  assert.deepEqual(turm.map((s) => s.layerY), [0, 1, 2, 3, 4, 5]);
});

test('Litematica: 300 Zustände → 9 Bit je Eintrag', async () => {
  const { imported, result } = await load('big-palette.litematic');
  const states = bigPaletteStates();
  assert.equal(imported.blockCount, 300);
  assert.equal(imported.palette.length, 301);
  for (let i = 0; i < states.length; i++) {
    assert.equal(result.volume.get(i % 20, 0, Math.floor(i / 20)), completeState(strip(states[i])), `Zelle ${i}`);
  }
});

test('Bit-Packing: Bitbreite wie Litematica und Werte, die Long-Grenzen überspannen', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8, 9, 16, 17, 32, 33, 256, 257, 512, 513, 65536].map(litematicBits), [2, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 8, 9, 9, 10, 16]);
  const states = bigPaletteStates();
  for (const [paletteSize, bits] of [[3, 2], [6, 3], [17, 5], [100, 7], [301, 9]]) {
    const palette = ['minecraft:air', ...states.slice(0, paletteSize - 1)];
    const size = [7, 3, 5];
    const cells = Array.from({ length: 105 }, (_, i) => (i * 37 + 11) % paletteSize);
    const root = { value: { Version: 6, Regions: { R: {
      Position: { x: 0, y: 0, z: 0 }, Size: { x: size[0], y: size[1], z: size[2] },
      BlockStatePalette: palette.map((s) => {
        const open = s.indexOf('[');
        if (open < 0) return { Name: s };
        return { Name: s.slice(0, open), Properties: Object.fromEntries(s.slice(open + 1, -1).split(',').map((p) => p.split('='))) };
      }),
      BlockStates: BigInt64Array.from(packBits(cells, bits)),
    } } } };
    assert.equal(litematicBits(paletteSize), bits);
    const converter = new StateConverter();
    const collector = new BlockCollector();
    readLitematic(root, { converter, collector, warnings: [] });
    const got = new Map();
    const part = collector.parts[0];
    for (let o = 0; o < part.count * 4; o += 4) got.set(`${part.blocks[o]},${part.blocks[o + 1]},${part.blocks[o + 2]}`, converter.palette[part.blocks[o + 3]]);
    cells.forEach((value, i) => {
      const key = `${i % 7},${Math.floor(i / 35)},${Math.floor(i / 7) % 5}`;
      assert.equal(got.get(key), value === 0 ? undefined : completeState(strip(palette[value])), `${bits} Bit, Zelle ${i}`);
    });
  }
  assert.deepEqual(regionBox([10, 0, 5], [-3, -6, -2]), { min: [8, -5, 4], size: [3, 6, 2] });
  assert.deepEqual(regionBox([-4, 2, 0], [2, 1, -1]), { min: [-4, 2, 0], size: [2, 1, 1] });
});

test('Formaterkennung am Inhalt, nicht an der Endung', async () => {
  const lit = await importFile({ format: 'schem', name: 'eigentlich.schem', data: fixture('regions.litematic') });
  assert.equal(lit.format, 'litematic');
  assert.equal(lit.declaredFormat, 'schem');
  assert.ok(lit.warnings.some((w) => /eigentlich im Format Litematica/.test(w)));
  const schem = await importFile({ format: 'nbt', name: 'haus.nbt', data: fixture('house-v3.schem') });
  assert.equal(schem.format, 'schem');
  // NBT-Inhalt mit Modell-Endung → trotzdem als Minecraft-Datei
  const asModel = await importFile({ format: 'stl', name: 'haus.stl', data: fixture('house-v2.schem'), importVoxelizer: () => { throw new Error('darf nicht aufgerufen werden'); } });
  assert.equal(asModel.format, 'schem');
  assert.ok(asModel.warnings.some((w) => /eigentlich eine Minecraft-Datei/.test(w)));

  assert.equal(sniffContent(new Uint8Array(fixture('house-v2.schem'))), 'nbt');
  assert.equal(sniffContent(new Uint8Array(fixture('house-raw-v2.schem'))), 'nbt-raw');
  assert.equal(sniffContent(new TextEncoder().encode('VOX \u0096\u0000\u0000\u0000')), 'vox');
  assert.equal(sniffContent(new TextEncoder().encode('glTF\u0002\u0000\u0000\u0000')), 'glb');
  assert.equal(sniffContent(new TextEncoder().encode('  {"asset":{"version":"2.0"}}')), 'json');
  assert.equal(sniffContent(new TextEncoder().encode('# OBJ\nv 0 0 0\nv 1 0 0\nf 1 2 3\n')), 'text');
  assert.equal(sniffContent(new Uint8Array([0x42, 0x00, 0x01, 0x02, 0xff, 0x00, 0x00, 0x00])), 'binary');

  assert.equal(formatFromName('Burg.SCHEM'), 'schem');
  assert.equal(formatFromName('alt.schematic'), 'schem');
  assert.equal(formatFromName('farm.litematic'), 'litematic');
  assert.equal(formatFromName('modell.gltf'), 'gltf');
  assert.equal(formatFromName('bild.png'), null);
  assert.equal(formatFromName(null), null);
  assert.equal(cleanFileName('C:\\Users\\x\\Downloads\\Burg\u0007.schem'), 'Burg .schem');
  assert.equal(cleanFileName(''), 'Datei');
  assert.deepEqual([...UPLOAD_FORMATS], ['schem', 'litematic', 'nbt', 'vox', 'stl', 'obj', 'glb', 'gltf']);
  assert.match(UPLOAD_ACCEPT, /\.litematic/);
});

test('Neuere Datenversion → Warnung; Fortschritt wird gemeldet', async () => {
  const messages = [];
  const imported = await importFile({ format: 'schem', name: 'neu.schem', data: fixture('future-v2.schem'), onProgress: (m) => messages.push(m) });
  assert.ok(imported.warnings.some((w) => /neueren Minecraft-Version \(Datenversion 9999/.test(w)));
  assert.ok(messages.includes('Entpacke Datei …'));
  const result = importToBuildResult(imported, { onProgress: (m) => messages.push(m) });
  assert.ok(messages.some((m) => /^Baue 24 Blöcke/.test(m)));
  assert.ok(result.warnings.some((w) => /neueren Minecraft-Version/.test(w)));
});
