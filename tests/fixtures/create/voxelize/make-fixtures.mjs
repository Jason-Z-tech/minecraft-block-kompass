// Erzeugt die Testmodelle für den Voxel-Import (selbst gebaut, keine fremden Dateien):
//   node tests/fixtures/create/voxelize/make-fixtures.mjs
// cube-binary.stl / cube-ascii.stl  Würfel 0 … 10 (binär mit „solid“ im Kopf, damit die Erkennung über die Größe zählt)
// colored.obj + colored.mtl         zwei Quader (rot, blau) aus Vierecken, mit negativen Indizes
// textured.glb                      Ebene mit 2×2-Textur (rot, grün, blau, gelb) + weißer Würfel über Knoten-Hierarchie
// scene.vox                         zwei Modelle mit Szene (Verschiebung, Drehung) und eigener Palette
// plain.vox                         ein Modell ohne Palette (Standardpalette) und ohne Szene

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from '../../../../scripts/lib/png.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------ Würfel

export function cubeTriangles(min = 0, max = 10) {
  const c = (x, y, z) => [x ? max : min, y ? max : min, z ? max : min];
  const quads = [
    [c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), c(1, 0, 0)], // z = min
    [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], // z = max
    [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], // y = min
    [c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0)], // y = max
    [c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)], // x = min
    [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)], // x = max
  ];
  return quads.flatMap(([a, b, cc, d]) => [[a, b, cc], [a, cc, d]]);
}

/** Binäres STL aus Dreiecken [[p0, p1, p2], …]; colors optional: 16-Bit-Attribut je Dreieck. */
export function binaryStl(triangles, { header = 'solid cube (binary STL)', attributes = null } = {}) {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write(header.padEnd(80, ' ').slice(0, 80), 0, 'latin1');
  buffer.writeUInt32LE(triangles.length, 80);
  triangles.forEach((tri, t) => {
    const o = 84 + t * 50;
    tri.flat().forEach((v, k) => buffer.writeFloatLE(v, o + 12 + k * 4));
    buffer.writeUInt16LE(attributes ? attributes[t] : 0, o + 48);
  });
  return buffer;
}

export function asciiStl(triangles, name = 'cube') {
  const lines = [`solid ${name}`];
  for (const tri of triangles) {
    lines.push('  facet normal 0 0 0', '    outer loop');
    for (const p of tri) lines.push(`      vertex ${p.join(' ')}`);
    lines.push('    endloop', '  endfacet');
  }
  lines.push(`endsolid ${name}`);
  return lines.join('\n') + '\n';
}

// ------------------------------------------------------------------ OBJ

function boxObj(x0, y0, z0, x1, y1, z1, material) {
  const v = [];
  for (const z of [z0, z1]) for (const y of [y0, y1]) for (const x of [x0, x1]) v.push(`v ${x} ${y} ${z}`);
  // Vierecke mit negativen Indizes (relativ zu den gerade geschriebenen 8 Ecken)
  const idx = (i) => i - 8;
  const faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  return [...v, `usemtl ${material}`, ...faces.map((f) => `f ${f.map((i) => idx(i)).join(' ')}`)];
}

// ------------------------------------------------------------------ GLB

function glb(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);
  const chunk = (type, body) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(body.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, body]);
  };
  return Buffer.concat([header, chunk(0x4e4f534a, jsonPadded), chunk(0x004e4942, binPadded)]);
}

export function texturedGlb() {
  // 2×2-Textur: oben links rot, oben rechts grün, unten links blau, unten rechts gelb
  const png = encodePng({ width: 2, height: 2, data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]) });
  const parts = [];
  let offset = 0;
  const views = [];
  const add = (buffer) => {
    const padded = Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)]);
    views.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length });
    parts.push(padded);
    offset += padded.length;
    return views.length - 1;
  };
  const floats = (list) => Buffer.from(Float32Array.from(list).buffer);
  const shorts = (list) => Buffer.from(Uint16Array.from(list).buffer);
  // Ebene y = 0, x/z −0,5 … 0,5, UV (0,0) bei (−0,5, −0,5)
  const planePos = add(floats([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]));
  const planeUv = add(floats([0, 0, 1, 0, 1, 1, 0, 1]));
  const planeIdx = add(shorts([0, 2, 1, 0, 3, 2]));
  // Würfel −0,125 … 0,125
  const s = 0.125;
  const cube = cubeTriangles(-s, s);
  const cubePos = add(floats(cube.flat(2)));
  const image = add(png);
  const json = {
    asset: { version: '2.0', generator: 'Block-Kompass Testdaten' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Wurzel', scale: [2, 2, 2], children: [1, 2] },
      { name: 'Ebene', mesh: 0 },
      { name: 'Würfel', mesh: 1, translation: [0, 0.25, 0] },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] },
      { primitives: [{ attributes: { POSITION: 3 }, material: 1 }] },
    ],
    materials: [
      { name: 'Textur', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
      { name: 'Weiß', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: image, mimeType: 'image/png' }],
    accessors: [
      { bufferView: planePos, componentType: 5126, count: 4, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 0, 0.5] },
      { bufferView: planeUv, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: planeIdx, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: cubePos, componentType: 5126, count: cube.length * 3, type: 'VEC3', min: [-s, -s, -s], max: [s, s, s] },
    ],
    bufferViews: views,
    buffers: [{ byteLength: offset }],
  };
  return glb(json, Buffer.concat(parts));
}

// ------------------------------------------------------------------ VOX

function voxChunk(id, content, children = Buffer.alloc(0)) {
  const head = Buffer.alloc(12);
  head.write(id, 0, 'latin1');
  head.writeInt32LE(content.length, 4);
  head.writeInt32LE(children.length, 8);
  return Buffer.concat([head, content, children]);
}

const int = (v) => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(v, 0);
  return b;
};
const str = (s) => Buffer.concat([int(Buffer.byteLength(s)), Buffer.from(s, 'utf8')]);
const dict = (obj) => Buffer.concat([int(Object.keys(obj).length), ...Object.entries(obj).flatMap(([k, v]) => [str(k), str(v)])]);

function voxModel(size, voxels) {
  return [
    voxChunk('SIZE', Buffer.concat(size.map(int))),
    voxChunk('XYZI', Buffer.concat([int(voxels.length), Buffer.from(voxels.flat())])),
  ];
}

function voxFile(chunks) {
  const children = Buffer.concat(chunks);
  return Buffer.concat([Buffer.from('VOX ', 'latin1'), int(150), voxChunk('MAIN', Buffer.alloc(0), children)]);
}

export function sceneVox() {
  // Modell 0: 2×2×2 rot (Farbe 1); Modell 1: Säule 1×1×3 blau (Farbe 2)
  const cube = [];
  for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) cube.push([x, y, z, 1]);
  const column = [[0, 0, 0, 2], [0, 0, 1, 2], [0, 0, 2, 2]];
  const palette = Buffer.alloc(1024);
  palette.set([255, 0, 0, 255], 0); // Farbe 1
  palette.set([0, 0, 255, 255], 4); // Farbe 2
  const nTRN = (id, child, frame) => voxChunk('nTRN', Buffer.concat([int(id), dict({}), int(child), int(-1), int(0), int(1), dict(frame)]));
  return voxFile([
    ...voxModel([2, 2, 2], cube),
    ...voxModel([1, 1, 3], column),
    nTRN(0, 1, {}),
    voxChunk('nGRP', Buffer.concat([int(1), dict({}), int(2), int(2), int(4)])),
    nTRN(2, 3, { _t: '0 0 1' }),
    voxChunk('nSHP', Buffer.concat([int(3), dict({}), int(1), int(0), dict({})])),
    // 90° um x: Säule (vox-z) liegt danach entlang vox-y
    nTRN(4, 5, { _t: '5 0 1', _r: '40' }),
    voxChunk('nSHP', Buffer.concat([int(5), dict({}), int(1), int(1), dict({})])),
    voxChunk('RGBA', palette),
  ]);
}

export function plainVox() {
  return voxFile(voxModel([3, 1, 2], [[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 1], [1, 0, 1, 1]]));
}

// ------------------------------------------------------------------ Schreiben

export function writeFixtures(dir = DIR) {
  const cube = cubeTriangles(0, 10);
  const files = {
    'cube-binary.stl': binaryStl(cube),
    'cube-ascii.stl': asciiStl(cube),
    'colored.obj': ['# zwei Quader, rot und blau', 'mtllib colored.mtl',
      ...boxObj(0, 0, 0, 4, 4, 4, 'Rot'), ...boxObj(4, 0, 0, 8, 4, 4, 'Blau')].join('\n') + '\n',
    'colored.mtl': ['newmtl Rot', 'Kd 1 0 0', 'newmtl Blau', 'Kd 0 0 1'].join('\n') + '\n',
    'textured.glb': texturedGlb(),
    'scene.vox': sceneVox(),
    'plain.vox': plainVox(),
  };
  for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), data);
  return Object.keys(files);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Geschrieben: ${writeFixtures().join(', ')}`);
}
