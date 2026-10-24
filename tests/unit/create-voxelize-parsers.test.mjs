// Parser des Voxel-Imports: STL (binär/ASCII), OBJ + MTL, glTF/GLB, MagicaVoxel – Erkennung, Farben, Grenzen, Fehler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStl, detectStlKind } from '../../js/create/voxelize/stl.js';
import { parseObj, parseMtl } from '../../js/create/voxelize/obj.js';
import { parseGltf } from '../../js/create/voxelize/gltf.js';
import { parseVox, voxRotation, DEFAULT_VOX_PALETTE } from '../../js/create/voxelize/vox.js';
import { MeshBuilder, ModelError } from '../../js/create/voxelize/mesh.js';
import { binaryStl, asciiStl, cubeTriangles, texturedGlb, sceneVox, plainVox, writeFixtures } from '../fixtures/create/voxelize/make-fixtures.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'create', 'voxelize');
const fixture = (name) => fs.readFileSync(path.join(FIXTURES, name));

test('Fixtures im Repo entsprechen dem Generator', () => {
  const base = path.join(FIXTURES, '..', '..', '..', '..', 'tmp', 'create-voxelize'); // tmp/ ist gitignored
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'fixtures-'));
  try {
    for (const name of writeFixtures(dir)) {
      assert.ok(fs.readFileSync(path.join(dir, name)).equals(fixture(name)), `${name} weicht ab – node tests/fixtures/create/voxelize/make-fixtures.mjs ausführen`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('STL: binär trotz „solid“ im Kopf, ASCII am Inhalt erkannt', () => {
  const binary = fixture('cube-binary.stl');
  assert.equal(binary.subarray(0, 5).toString('latin1'), 'solid');
  assert.equal(detectStlKind(binary), 'binary');
  assert.equal(detectStlKind(fixture('cube-ascii.stl')), 'ascii');
  const mesh = parseStl(binary);
  assert.equal(mesh.triangleCount, 12);
  assert.equal(mesh.upAxis, 'z');
  assert.equal(mesh.colors, null);
  const ascii = parseStl(fixture('cube-ascii.stl'));
  assert.deepEqual(Array.from(ascii.positions), Array.from(mesh.positions));
  assert.equal(ascii.stlKind, 'ascii');
});

test('STL: ASCII mit Windows-Zeilenenden, Großschreibung und Vierecken', () => {
  const text = 'SOLID quad\r\n facet normal 0 0 1\r\n  outer loop\r\n   VERTEX 0 0 0\r\n   vertex 1 0 0\r\n   vertex 1 1 0\r\n   vertex 0 1 0\r\n  endloop\r\n endfacet\r\nendsolid\r\n';
  const mesh = parseStl(Buffer.from(text));
  assert.equal(mesh.triangleCount, 2);
});

test('STL: Farben nach VisCAM (Bit 15 gesetzt) und Magics („COLOR=“ im Kopf)', () => {
  const tris = cubeTriangles(0, 1);
  // VisCAM: 5 Bit Rot oben (10–14), Blau unten; nur das erste Dreieck farbig → die anderen Grundfarbe
  const red = 0x8000 | (31 << 10);
  const mesh = parseStl(binaryStl(tris, { header: 'farbig', attributes: tris.map((_, i) => (i === 0 ? red : 0)) }));
  assert.ok(mesh.colors);
  assert.deepEqual(Array.from(mesh.colors.subarray(0, 3)), [1, 0, 0]);
  assert.deepEqual(mesh.materials[0].color, [1, 1, 1]);
  assert.ok(mesh.warnings.some((w) => /Teil der Dreiecke/.test(w)));
  // Magics: Rot unten (0–4), Bit 15 = 0 heißt gültig
  const magics = parseStl(binaryStl(tris, { header: 'COLOR=xxxx MATERIAL=', attributes: tris.map(() => 31) }));
  assert.deepEqual(Array.from(magics.colors.subarray(0, 3)), [1, 0, 0]);
});

test('STL: Fehler und Grenzen', () => {
  assert.throws(() => parseStl(Buffer.alloc(10)), /zu kurz/);
  const truncated = binaryStl(cubeTriangles()).subarray(0, 84 + 50 * 5 + 10);
  assert.throws(() => parseStl(truncated), (e) => e instanceof ModelError && /unvollständig/.test(e.message));
  const empty = Buffer.alloc(84);
  assert.throws(() => parseStl(empty), /keine Dreiecke/);
  assert.throws(() => parseStl(Buffer.from('solid x\n facet normal 0 0 1\n outer loop\n vertex 0 0 abc\n')), /ungültige Zahl/);
  const huge = Buffer.alloc(84);
  huge.writeUInt32LE(2_000_001, 80);
  assert.throws(() => parseStl(Buffer.concat([huge, Buffer.alloc(50)])), /unvollständig/);
  const builder = new MeshBuilder({ limit: 2 });
  builder.addFlat(0, 0, 0, 1, 0, 0, 0, 1, 0);
  builder.addFlat(0, 0, 0, 1, 0, 0, 0, 1, 0);
  assert.throws(() => builder.addFlat(0, 0, 0, 1, 0, 0, 0, 1, 0), /mehr als 2 Dreiecke/);
});

test('OBJ: Vierecke, negative Indizes, usemtl und Kd aus der .mtl', () => {
  const mesh = parseObj(fixture('colored.obj'), { mtl: fixture('colored.mtl') });
  assert.equal(mesh.triangleCount, 24);
  assert.equal(mesh.upAxis, 'y');
  assert.deepEqual(mesh.materials.map((m) => [m.name, m.color]), [['Rot', [1, 0, 0]], ['Blau', [0, 0, 1]]]);
  assert.equal(mesh.triMaterial[0], 0);
  assert.equal(mesh.triMaterial[23], 1);
  assert.deepEqual(mesh.warnings, []);
  // ohne .mtl: Grundfarbe und Hinweis
  const plain = parseObj(fixture('colored.obj'));
  assert.ok(plain.warnings.some((w) => /\.mtl-Datei fehlt/.test(w)));
  assert.ok(plain.materials.every((m) => m.color[0] > 0.5 && m.color[0] === m.color[2]));
});

test('OBJ: Eckfarben, Formen v/vt/vn, Kommentare, Fortsetzungszeilen', () => {
  const text = [
    '# Test', 'v 0 0 0 1 0 0', 'v 1 0 0 1 0 0', 'v 1 1 0 0 0 1', 'v 0 1 0 0 0 1',
    'vt 0 0', 'vt 1 0', 'vt 1 1', 'vn 0 0 1',
    'f 1/1/1 2/2/1 \\', '  3/3/1 4//1', 'o x', 'g y', 's off', 'l 1 2',
  ].join('\n');
  const mesh = parseObj(Buffer.from(text));
  assert.equal(mesh.triangleCount, 2);
  assert.ok(mesh.colors);
  assert.deepEqual(Array.from(mesh.colors.subarray(0, 3)), [1, 0, 0]);
  assert.deepEqual(mesh.materials[0].color, [1, 1, 1], 'Eckfarben ohne Material bleiben unverändert');
  assert.ok(mesh.warnings.some((w) => /Linien und Punkte/.test(w)));
});

test('OBJ und MTL: Fehler', () => {
  assert.throws(() => parseObj(Buffer.from('v 0 0 0\nf 1 2 3\n')), /verweist auf nichts/);
  assert.throws(() => parseObj(Buffer.from('v 0 0\n')), /braucht 3 Zahlen/);
  assert.throws(() => parseObj(Buffer.from('v 0 0 0\nv 1 0 0\nf 1 2\n')), /mindestens drei Ecken/);
  assert.throws(() => parseObj(Buffer.from('v 0 0 0\n')), /keine Flächen/);
  assert.throws(() => parseObj(Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 0 2\n')), /ungültiger Eckpunkt-Index/);
  assert.throws(() => parseMtl('Kd 1 0 0'), /vor dem ersten „newmtl“/);
  const library = parseMtl('newmtl A\nKd 0.5\nmap_Kd textur.png\n');
  assert.deepEqual(library.get('A'), { color: [0.5, 0.5, 0.5], texture: 'textur.png' });
});

test('GLB: Knoten-Hierarchie, Indizes, Textur und Materialfarbe', async () => {
  const mesh = await parseGltf(fixture('textured.glb'));
  assert.equal(mesh.triangleCount, 2 + 12);
  assert.equal(mesh.upAxis, 'y');
  const textured = mesh.materials[0];
  assert.equal(textured.texture.width, 2);
  assert.equal(textured.texture.wrapS, 'clamp');
  assert.deepEqual(Array.from(textured.texture.data.subarray(0, 4)), [255, 0, 0, 255]);
  // Wurzel skaliert ×2: Ebene −1 … 1, Würfel (Mitte y = 0,5) 0,25 … 0,75
  let maxY = -Infinity, minX = Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    maxY = Math.max(maxY, mesh.positions[i + 1]);
    minX = Math.min(minX, mesh.positions[i]);
  }
  assert.ok(Math.abs(maxY - 0.75) < 1e-6 && Math.abs(minX + 1) < 1e-6, `maxY ${maxY}, minX ${minX}`);
  assert.ok(mesh.uvs, 'UV bleibt erhalten');
});

test('glTF mit eingebetteten Daten-URIs; externe Dateien → Hinweis auf .glb', async () => {
  const glb = texturedGlb();
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
  const bin = glb.subarray(20 + jsonLength + 8);
  json.buffers = [{ byteLength: bin.length, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` }];
  const mesh = await parseGltf(Buffer.from(JSON.stringify(json)), { format: 'gltf' });
  assert.equal(mesh.triangleCount, 14);
  json.buffers = [{ byteLength: bin.length, uri: 'modell.bin' }];
  await assert.rejects(parseGltf(Buffer.from(JSON.stringify(json)), { format: 'gltf' }), /externe Datei „modell\.bin“ – bitte als \.glb exportieren/);
});

test('glTF: Fehler, Erweiterungen, eigener Bild-Dekoder', async () => {
  await assert.rejects(parseGltf(Buffer.from('{ kaputt'), { format: 'gltf' }), /kein gültiges JSON/);
  await assert.rejects(parseGltf(Buffer.from('{"asset":{"version":"1.0"}}'), { format: 'gltf' }), /Nur glTF 2\.0/);
  await assert.rejects(parseGltf(Buffer.from('{"asset":{"version":"2.0"},"extensionsRequired":["KHR_draco_mesh_compression"]}'), { format: 'gltf' }), /Draco/);
  await assert.rejects(parseGltf(Buffer.from('{"asset":{"version":"2.0"},"extensionsRequired":["EXT_unbekannt"]}'), { format: 'gltf' }), /EXT_unbekannt/);
  await assert.rejects(parseGltf(Buffer.from('{"asset":{"version":"2.0"},"nodes":[{}]}'), { format: 'gltf' }), /keine sichtbaren Dreiecke/);
  await assert.rejects(parseGltf(Buffer.from('glTF0000'), { format: 'glb' }), /keine \.glb-Datei/);
  // Ein eigener Dekoder wird benutzt (so dekodiert der Worker per createImageBitmap)
  let calls = 0;
  const mesh = await parseGltf(fixture('textured.glb'), {
    decodeImage: async (bytes, mime) => {
      calls++;
      assert.equal(mime, 'image/png');
      return { width: 1, height: 1, data: new Uint8Array([9, 8, 7, 255]) };
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(Array.from(mesh.materials[0].texture.data), [9, 8, 7, 255]);
  // Kaputtes Bild → Warnung, Materialfarbe gilt
  const fallback = await parseGltf(fixture('textured.glb'), { decodeImage: async () => { throw new Error('defekt'); } });
  assert.equal(fallback.materials[0].texture, null);
  assert.ok(fallback.warnings.some((w) => /Textur 0 lässt sich nicht lesen/.test(w)));
});

test('VOX: Szene mit Verschiebung und Drehung, eigene Palette', () => {
  const vox = parseVox(fixture('scene.vox'));
  assert.equal(vox.models, 2);
  assert.equal(vox.count, 8 + 3);
  const voxels = [];
  for (let i = 0; i < vox.count; i++) voxels.push([...vox.positions.subarray(i * 3, i * 3 + 3), ...vox.colors.subarray(i * 3, i * 3 + 3)].join(','));
  // Würfel 2×2×2 um (0, 0, 1): Ecken −1 … 0, z 0 … 1, rot
  for (const p of ['-1,-1,0', '0,0,1', '-1,0,1']) assert.ok(voxels.includes(`${p},255,0,0`), `${p} rot`);
  // Säule 1×1×3 um (5, 0, 1), um x gedreht: liegt entlang y (y −1 … 1), z = 1, blau
  for (const p of ['5,-1,1', '5,0,1', '5,1,1']) assert.ok(voxels.includes(`${p},0,0,255`), `${p} blau`);
  assert.deepEqual(voxRotation(40), [1, 0, 0, 0, 0, -1, 0, 1, 0]);
  assert.throws(() => voxRotation(0b0101), /ungültige Drehung/);
});

test('VOX: ohne Palette die Standardpalette, ohne Szene nebeneinander', () => {
  assert.equal(DEFAULT_VOX_PALETTE[1], 0xffffff);
  assert.equal(DEFAULT_VOX_PALETTE[255], 0x111111);
  assert.equal(DEFAULT_VOX_PALETTE[216], 0xee0000);
  const vox = parseVox(fixture('plain.vox'));
  assert.equal(vox.count, 4);
  assert.deepEqual(Array.from(vox.colors.subarray(0, 3)), [255, 255, 255]);
  assert.ok(sceneVox().length > plainVox().length);
});

test('VOX: Fehler', () => {
  assert.throws(() => parseVox(Buffer.from('NOPE0000000000000000')), /keine MagicaVoxel-Datei/);
  const broken = Buffer.from(fixture('plain.vox'));
  broken.writeInt32LE(1_000_000, 16);
  assert.throws(() => parseVox(broken), /unvollständig/);
  // Voxel außerhalb der Größe
  const bad = Buffer.from(fixture('plain.vox'));
  const xyzi = bad.indexOf('XYZI');
  bad[xyzi + 16] = 9;
  assert.throws(() => parseVox(bad), /außerhalb der Modellgröße/);
});

test('ASCII-STL-Generator und Würfel-Hilfen sind stimmig', () => {
  assert.equal(cubeTriangles().length, 12);
  assert.match(asciiStl(cubeTriangles(), 'w'), /^solid w\n/);
});
