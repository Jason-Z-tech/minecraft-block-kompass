import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataTest, meshContext, createModels, bindFor, volumeFrom } from './render-models-fixture.test.mjs';
import { meshChunk, meshStep, meshCap, decodeVertex, createQuadIndices, resetMeshCache, QUAD_BYTES, VERTEX_BYTES, HIDE_NEVER, AO_LEVELS } from '../../js/render/mesher.js';

const PLANKS = 'oak_planks';
const STONE = 'stone';

function quadsOf(mesh) {
  const quads = [];
  for (let q = 0; q < mesh.quadCount; q++) quads.push([0, 1, 2, 3].map((v) => decodeVertex(mesh, q * 4 + v)));
  return quads;
}

function allQuads(result) {
  return ['solid', 'cutout', 'translucent'].flatMap((layer) => quadsOf(result[layer]).map((vertices) => ({ layer, vertices })));
}

function normalOf(vertices) {
  const [a, b, c] = vertices;
  const ux = a.x - b.x, uy = a.y - b.y, uz = a.z - b.z;
  const vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
  return [vy * uz - vz * uy, vz * ux - vx * uz, vx * uy - vy * ux].map((v) => Math.sign(Math.round(v * 1e4)) + 0);
}

function dirOf(vertices) {
  const n = normalOf(vertices).join();
  return { '0,-1,0': 'down', '0,1,0': 'up', '0,0,-1': 'north', '0,0,1': 'south', '-1,0,0': 'west', '1,0,0': 'east' }[n] ?? n;
}

function areaOf(vertices) {
  const [a, b, c] = vertices;
  const ux = a.x - b.x, uy = a.y - b.y, uz = a.z - b.z;
  const vx = c.x - b.x, vy = c.y - b.y, vz = c.z - b.z;
  return Math.hypot(vy * uz - vz * uy, vz * ux - vx * uz, vx * uy - vy * ux);
}

const totalArea = (quads) => quads.reduce((sum, q) => sum + areaOf(q.vertices), 0);
const onPlane = (q, axis, value) => q.vertices.every((v) => Math.abs(v[axis] - value) < 1e-3);

dataTest('Einzelner Stein: 6 Flächen, Licht = Schattierung ohne Nachbarn, show 0, hide nie', async () => {
  const ctx = await meshContext([[0, 0, 0, STONE]]);
  const result = meshChunk(ctx, 0, 0, 0);
  assert.equal(result.solid.quadCount, 6);
  assert.equal(result.cutout.quadCount, 0);
  assert.equal(result.translucent.quadCount, 0);
  const lights = { up: 255, down: 128, north: 204, south: 204, west: 153, east: 153 };
  for (const q of allQuads(result)) {
    const dir = dirOf(q.vertices);
    for (const v of q.vertices) {
      assert.equal(v.light, lights[dir], dir);
      assert.equal(v.show, 0);
      assert.equal(v.hide, HIDE_NEVER);
      assert.deepEqual(v.tint, [255, 255, 255]);
    }
  }
  assert.deepEqual(allQuads(result).map((q) => dirOf(q.vertices)).sort(), ['down', 'east', 'north', 'south', 'up', 'west']);
});

dataTest('Zwei Steine nebeneinander: die inneren Flächen fehlen', async () => {
  const ctx = await meshContext([[0, 0, 0, STONE], [1, 0, 0, STONE]]);
  const quads = allQuads(meshChunk(ctx, 0, 0, 0));
  assert.ok(!quads.some((q) => onPlane(q, 'x', 1)), 'keine Fläche auf x = 1');
  assert.ok(Math.abs(totalArea(quads) - 10) < 1e-6, `Fläche ${totalArea(quads)}`);
});

dataTest('Nachbarn über Chunk-Grenzen verdecken ebenfalls', async () => {
  const ctx = await meshContext([[15, 0, 0, PLANKS], [16, 0, 0, PLANKS], [0, 0, 15, PLANKS], [0, 0, 16, PLANKS], [0, 15, 3, PLANKS], [0, 16, 3, PLANKS]]);
  const a = allQuads(meshChunk(ctx, 0, 0, 0));
  assert.ok(!a.some((q) => onPlane(q, 'x', 16)), 'Ostseite an der Chunk-Grenze fehlt');
  assert.ok(!a.some((q) => onPlane(q, 'z', 16)), 'Südseite an der Chunk-Grenze fehlt');
  assert.ok(!a.some((q) => onPlane(q, 'y', 16)), 'Oberseite an der Chunk-Grenze fehlt');
  const b = allQuads(meshChunk(ctx, 1, 0, 0));
  assert.ok(!b.some((q) => onPlane(q, 'x', 0)), 'Westseite im Nachbar-Chunk fehlt');
  assert.ok(Math.abs(totalArea(b) - 5) < 1e-6);
});

dataTest('Glas: Glas-Glas verdeckt, Glas neben Buntglas nicht, Stein neben Glas bleibt sichtbar', async () => {
  const glassGlass = allQuads(meshChunk(await meshContext([[0, 0, 0, 'glass'], [1, 0, 0, 'glass']]), 0, 0, 0));
  assert.ok(Math.abs(totalArea(glassGlass) - 10) < 1e-6);
  assert.ok(glassGlass.every((q) => q.layer === 'translucent'));
  const mixed = allQuads(meshChunk(await meshContext([[0, 0, 0, 'glass'], [1, 0, 0, 'red_stained_glass']]), 0, 0, 0));
  assert.ok(Math.abs(totalArea(mixed) - 12) < 1e-6);
  const stoneGlass = allQuads(meshChunk(await meshContext([[0, 0, 0, STONE], [1, 0, 0, 'glass']]), 0, 0, 0));
  assert.ok(Math.abs(totalArea(stoneGlass.filter((q) => q.layer === 'solid')) - 6) < 1e-6, 'Stein: alle 6 Seiten');
  assert.ok(Math.abs(totalArea(stoneGlass.filter((q) => q.layer === 'translucent')) - 5) < 1e-6, 'Glas: Seite zum Stein fehlt');
});

dataTest('Laub gleicher Art verdeckt sich, verschiedene Arten nicht; Tönung im Vertex', async () => {
  const same = allQuads(meshChunk(await meshContext([[0, 0, 0, 'oak_leaves'], [0, 1, 0, 'oak_leaves']]), 0, 0, 0));
  assert.ok(Math.abs(totalArea(same) - 10) < 1e-6);
  const other = allQuads(meshChunk(await meshContext([[0, 0, 0, 'oak_leaves'], [0, 1, 0, 'birch_leaves']]), 0, 0, 0));
  assert.ok(Math.abs(totalArea(other) - 12) < 1e-6);
  const tints = new Set(other.map((q) => q.vertices[0].tint.join()));
  assert.deepEqual([...tints].sort(), ['119,171,47', '128,167,85']);
  assert.ok(other.every((q) => q.layer === 'cutout'));
});

dataTest('Treppen: Rückseite verdeckt den Nachbarn, Treppen gleicher Richtung verdecken ihre Seiten', async () => {
  const stairs = 'oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]';
  // Stein östlich der Treppe: die volle Treppen-Rückseite (Osten) und die Westseite des Steins fehlen
  const back = allQuads(meshChunk(await meshContext([[0, 0, 0, stairs], [1, 0, 0, STONE]]), 0, 0, 0));
  assert.ok(!back.some((q) => onPlane(q, 'x', 1)));
  // Zwei Treppen nebeneinander (Nord-Süd): gleiche Seitenform → Seiten dazwischen fehlen
  const row = allQuads(meshChunk(await meshContext([[0, 0, 0, stairs], [0, 0, 1, stairs]]), 0, 0, 0));
  assert.ok(!row.some((q) => onPlane(q, 'z', 1) && ['north', 'south'].includes(dirOf(q.vertices))));
});

dataTest('Wasser: Oberfläche 14/16 im Becken, Säule ohne Zwischenfläche, Overlay neben Glas, Einfärbung', async () => {
  const pool = [];
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) pool.push([x, 0, z, STONE]);
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) if (x === 0 || z === 0 || x === 4 || z === 4) pool.push([x, 1, z, STONE]);
  for (let x = 1; x < 4; x++) for (let z = 1; z < 4; z++) pool.push([x, 1, z, 'water[level=0]']);
  const ctx = await meshContext(pool);
  const water = allQuads(meshChunk(ctx, 0, 0, 0)).filter((q) => q.layer === 'translucent');
  assert.equal(water.length, 9, 'nur die 9 Oberflächen (Seiten und Boden verdeckt)');
  for (const q of water) {
    assert.equal(dirOf(q.vertices), 'up');
    for (const v of q.vertices) {
      assert.ok(Math.abs(v.y - (1 + 14 / 16)) <= 1 / 128, `Höhe ${v.y}`);
      assert.deepEqual(v.tint, [0x3f, 0x76, 0xe4]);
      assert.equal(v.light, 255);
    }
  }
  const column = allQuads(meshChunk(await meshContext([[0, 0, 0, 'water[level=0]'], [0, 1, 0, 'water[level=0]']]), 0, 0, 0));
  assert.ok(!column.some((q) => onPlane(q, 'y', 1)), 'keine Fläche zwischen den Wasserblöcken');
  const lowerSide = column.find((q) => dirOf(q.vertices) === 'north' && q.vertices.every((v) => v.y <= 1 + 1e-3));
  assert.ok(lowerSide.vertices.some((v) => Math.abs(v.y - 1) < 1e-3), 'untere Seitenfläche reicht ganz nach oben');
  const tank = await meshContext([[0, 0, 0, 'water[level=0]'], [1, 0, 0, 'glass']]);
  const overlay = tank.models.textureLayer('block/water_overlay').layer;
  const east = allQuads(meshChunk(tank, 0, 0, 0)).find((q) => q.layer === 'translucent' && dirOf(q.vertices) === 'east' && q.vertices[0].x < 1);
  assert.equal(east.vertices[0].tex, overlay);
});

dataTest('Lava: undurchsichtig (solid) und leuchtend', async () => {
  const quads = allQuads(meshChunk(await meshContext([[0, 0, 0, 'lava[level=0]']]), 0, 0, 0));
  assert.equal(quads.length, 6);
  assert.ok(quads.every((q) => q.layer === 'solid' && q.vertices.every((v) => v.emissive)));
});

dataTest('Wassergeflutete Stufe: Wasser über der unteren Stufe, nicht unter einer oberen', async () => {
  const bottom = allQuads(meshChunk(await meshContext([[0, 0, 0, 'oak_slab[type=bottom,waterlogged=true]']]), 0, 0, 0));
  assert.ok(bottom.some((q) => q.layer === 'translucent' && dirOf(q.vertices) === 'up'));
  assert.ok(!bottom.some((q) => q.layer === 'translucent' && dirOf(q.vertices) === 'down'), 'Stufe verdeckt den Wasserboden');
  const top = allQuads(meshChunk(await meshContext([[0, 0, 0, 'oak_slab[type=top,waterlogged=true]']]), 0, 0, 0));
  assert.ok(!top.some((q) => q.layer === 'translucent' && dirOf(q.vertices) === 'up'), 'obere Stufe verdeckt die Wasseroberfläche');
});

dataTest('show/hide: früherer Nachbar → Fläche fehlt, späterer Nachbar → hide = sein Schritt', async () => {
  const ctx = await meshContext([[0, 0, 0, PLANKS, 0], [1, 0, 0, PLANKS, 1]]);
  const quads = allQuads(meshChunk(ctx, 0, 0, 0));
  const between = quads.filter((q) => onPlane(q, 'x', 1));
  assert.equal(between.length, 1, 'nur die Ostseite des früheren Blocks');
  assert.equal(dirOf(between[0].vertices), 'east');
  assert.ok(between[0].vertices.every((v) => v.show === 0 && v.hide === 1));
  const reverse = allQuads(meshChunk(await meshContext([[0, 0, 0, PLANKS, 1], [1, 0, 0, PLANKS, 0]]), 0, 0, 0)).filter((q) => onPlane(q, 'x', 1));
  assert.equal(reverse.length, 1);
  assert.equal(dirOf(reverse[0].vertices), 'west');
  assert.ok(reverse[0].vertices.every((v) => v.show === 0 && v.hide === 1));
  const same = allQuads(meshChunk(await meshContext([[0, 0, 0, PLANKS, 2], [1, 0, 0, PLANKS, 2]]), 0, 0, 0));
  assert.ok(!same.some((q) => onPlane(q, 'x', 1)), 'gleicher Schritt → beide Flächen fehlen');
  // Alle Flächen des späteren Blocks (x 1 … 2, ohne die Ebene x = 1) zeigen sich ab Schritt 1
  const later = allQuads(meshChunk(ctx, 0, 0, 0)).filter((q) => q.vertices.every((v) => v.x >= 1 - 1e-6) && !onPlane(q, 'x', 1));
  assert.equal(later.length, 5);
  for (const q of later) assert.ok(q.vertices.every((v) => v.show === 1 && v.hide === HIDE_NEVER));
});

dataTest('Greedy: 16×16-Boden = 1 Deckfläche (UV über 16 Kacheln), Seiten je Zeile zusammengelegt', async () => {
  const floor = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) floor.push([x, 0, z, PLANKS]);
  const ctx = await meshContext(floor);
  const result = meshChunk(ctx, 0, 0, 0);
  assert.equal(result.solid.quadCount, 6);
  const up = allQuads(result).find((q) => dirOf(q.vertices) === 'up');
  const xs = up.vertices.map((v) => v.x), zs = up.vertices.map((v) => v.z);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], [0, 16, 0, 16]);
  const us = up.vertices.map((v) => v.u), vs = up.vertices.map((v) => v.v);
  assert.equal(Math.max(...us) - Math.min(...us), 256);
  assert.equal(Math.max(...vs) - Math.min(...vs), 256);
  assert.ok(us.every((u) => u >= 0) && vs.every((v) => v >= 0));
  // Welt-feste Kacheln: u = 16·x, v = 16·z (wie die einzelnen Flächen)
  for (const v of up.vertices) {
    assert.equal(v.u % 16, (16 * v.x) % 16);
    assert.equal(v.u - Math.min(...us), 16 * v.x);
    assert.equal(v.v - Math.min(...vs), 16 * v.z);
  }
  // Zwei Ebenen übereinander: Seiten werden nicht über y hinweg zusammengelegt (Block-y je Vertex)
  const twoLayers = [...floor, ...floor.map(([x, , z, s]) => [x, 1, z, s])];
  const sides = allQuads(meshChunk(await meshContext(twoLayers), 0, 0, 0)).filter((q) => !['up', 'down'].includes(dirOf(q.vertices)));
  assert.equal(sides.length, 8);
  for (const q of sides) assert.equal(new Set(q.vertices.map((v) => v.blockY)).size, 1);
});

dataTest('Greedy legt nur Gleiches zusammen: andere Textur, anderer Schritt oder AO trennen', async () => {
  const entries = [];
  for (let x = 0; x < 4; x++) entries.push([x, 0, 0, x === 2 ? 'spruce_planks' : PLANKS, x === 3 ? 1 : 0]);
  const quads = allQuads(meshChunk(await meshContext(entries), 0, 0, 0)).filter((q) => dirOf(q.vertices) === 'up');
  assert.equal(quads.length, 3, 'Eiche (x 0–1 zusammen), Fichte (x 2), Eiche mit Schritt 1 (x 3)');
});

dataTest('AO an Ecken: Stufen 0,45/0,65/0,82/1,0 und Diagonale tauschen bei a00 + a11 < a01 + a10', async () => {
  const ctx = await meshContext([[0, 0, 0, PLANKS], [1, 1, 0, STONE], [0, 1, 1, STONE]]);
  const quads = allQuads(meshChunk(ctx, 0, 0, 0));
  const top = quads.find((q) => dirOf(q.vertices) === 'up' && q.vertices.every((v) => Math.abs(v.y - 1) < 1e-6 && v.x <= 1 && v.z <= 1));
  const lightAt = (x, z) => top.vertices.find((v) => v.x === x && v.z === z).light;
  assert.equal(lightAt(0, 0), 255);
  assert.equal(lightAt(1, 0), Math.round(AO_LEVELS[2] * 255));
  assert.equal(lightAt(0, 1), Math.round(AO_LEVELS[2] * 255));
  assert.equal(lightAt(1, 1), Math.round(AO_LEVELS[0] * 255));
  // Diagonale v0–v2 verbindet die beiden hellen Ecken (1,0) und (0,1)
  const [v0, , v2] = top.vertices;
  assert.equal(v0.light + v2.light, 2 * Math.round(AO_LEVELS[2] * 255));
  // Eine Ecke allein: (1,1,1) → 0,82 nur an dieser Ecke; ohne AO alles 255
  const corner = await meshContext([[0, 0, 0, PLANKS], [1, 1, 1, STONE]]);
  const cornerTop = allQuads(meshChunk(corner, 0, 0, 0)).find((q) => dirOf(q.vertices) === 'up' && q.vertices.every((v) => v.x <= 1 && v.z <= 1 && v.y === 1));
  assert.deepEqual(cornerTop.vertices.map((v) => v.light).sort((a, b) => a - b), [209, 255, 255, 255]);
  const flat = allQuads(meshChunk({ ...corner, ao: false }, 0, 0, 0)).find((q) => dirOf(q.vertices) === 'up' && q.vertices.every((v) => v.y === 1 && v.x <= 1));
  assert.ok(flat.vertices.every((v) => v.light === 255));
  // Eine Seite plus Ecke (Ecken-Block liegt im Nachbar-Chunk z < 0): Stufe 1 = 0,65
  const three = await meshContext([[0, 0, 0, PLANKS], [1, 1, 0, STONE], [1, 1, -1, STONE]]);
  const threeTop = allQuads(meshChunk(three, 0, 0, 0)).find((q) => dirOf(q.vertices) === 'up' && q.vertices.every((v) => v.y === 1 && v.x <= 1 && v.z >= 0 && v.z <= 1));
  assert.equal(threeTop.vertices.find((v) => v.x === 1 && v.z === 0).light, Math.round(AO_LEVELS[1] * 255));
  assert.equal(threeTop.vertices.find((v) => v.x === 0 && v.z === 0).light, 255);
});

dataTest('Vertex-Bytes exakt nach §7.2 (Position, Ebene, UV, Tönung, Licht, show/hide, Flags, Reserve)', async () => {
  const ctx = await meshContext([[17, 3, -2, PLANKS, 7]]);
  const layer = ctx.models.textureLayer('block/oak_planks').layer;
  const result = meshChunk(ctx, 1, 0, -1);
  assert.equal(result.solid.quadCount, 6);
  assert.equal(result.solid.vertices.byteLength, 6 * QUAD_BYTES);
  assert.equal(QUAD_BYTES, 4 * VERTEX_BYTES);
  assert.equal(VERTEX_BYTES, 24);
  const view = new DataView(result.solid.vertices);
  let upFound = false;
  for (let q = 0; q < 6; q++) {
    const vertices = [0, 1, 2, 3].map((v) => q * 96 + v * 24);
    const ys = vertices.map((o) => view.getInt16(o + 2, true));
    for (const o of vertices) {
      const x = view.getInt16(o, true), y = view.getInt16(o + 2, true), z = view.getInt16(o + 4, true);
      assert.ok([256, 512].includes(x) && [768, 1024].includes(y) && [3584, 3840].includes(z), `Position ${x},${y},${z}`);
      assert.equal(view.getUint16(o + 6, true), layer);
      assert.ok([0, 1024].includes(view.getUint16(o + 8, true)) && [0, 1024].includes(view.getUint16(o + 10, true)));
      assert.deepEqual([view.getUint8(o + 12), view.getUint8(o + 13), view.getUint8(o + 14)], [255, 255, 255]);
      assert.ok([255, 128, 204, 153].includes(view.getUint8(o + 15)));
      assert.equal(view.getUint16(o + 16, true), 7);
      assert.equal(view.getUint16(o + 18, true), 65535);
      assert.equal(view.getUint8(o + 20), 3 << 4);
      assert.deepEqual([view.getUint8(o + 21), view.getUint8(o + 22), view.getUint8(o + 23)], [0, 0, 0]);
    }
    if (ys.every((y) => y === 1024)) {
      upFound = true;
      for (const o of vertices) assert.equal(view.getUint8(o + 15), 255);
    }
  }
  assert.ok(upFound);
  // Tönung und Leuchten
  const grass = await meshContext([[0, 0, 0, 'grass_block[snowy=false]'], [2, 0, 0, 'glowstone']]);
  const quads = allQuads(meshChunk(grass, 0, 0, 0));
  const grassTop = quads.find((q) => dirOf(q.vertices) === 'up' && q.vertices[0].x < 1.5);
  assert.deepEqual(grassTop.vertices[0].tint, [0x91, 0xbd, 0x59]);
  assert.ok(quads.filter((q) => q.vertices[0].x >= 2).every((q) => q.vertices.every((v) => v.emissive)));
  assert.ok(quads.filter((q) => q.vertices[0].x < 1.5).every((q) => q.vertices.every((v) => !v.emissive)));
});

dataTest('Positionen überstehender Modelle sind vorzeichenbehaftet (Weizen unter y = 0 im Chunk)', async () => {
  const ctx = await meshContext([[0, 16, 0, 'wheat[age=7]']]);
  const quads = allQuads(meshChunk(ctx, 0, 1, 0));
  assert.ok(quads.length > 0);
  assert.ok(quads.some((q) => q.vertices.some((v) => v.y < 0)), 'Weizen reicht 1/16 unter den Block');
  assert.ok(quads.every((q) => q.vertices.every((v) => v.blockY === 0)));
});

dataTest('meshCap: verdeckte Oberseiten der Ebene ohne AO, show = eigener Schritt, mit centers', async () => {
  const ctx = await meshContext([[0, 0, 0, PLANKS, 0], [0, 1, 0, STONE, 0], [3, 0, 0, PLANKS, 2], [3, 1, 0, STONE, 5], [5, 0, 0, PLANKS, 0]]);
  const chunk = allQuads(meshChunk(ctx, 0, 0, 0));
  assert.ok(!chunk.some((q) => dirOf(q.vertices) === 'up' && onPlane(q, 'y', 1) && q.vertices[0].x < 1), 'Deckfläche unter dem Stein fehlt im Chunk-Mesh');
  const later = chunk.find((q) => dirOf(q.vertices) === 'up' && onPlane(q, 'y', 1) && q.vertices.every((v) => v.x >= 3 && v.x <= 4));
  assert.ok(later.vertices.every((v) => v.show === 2 && v.hide === 5));
  const cap = meshCap(ctx, 0);
  assert.equal(cap.solid.quadCount, 2, 'unter beiden Steinen, nicht beim freien Brett');
  for (const q of quadsOf(cap.solid)) {
    assert.equal(dirOf(q), 'up');
    for (const v of q) {
      assert.equal(v.light, 255);
      assert.equal(v.hide, HIDE_NEVER);
      assert.ok(Math.abs(v.y - 1) < 1e-6);
    }
  }
  const shows = quadsOf(cap.solid).map((q) => q[0].show).sort();
  assert.deepEqual(shows, [0, 2]);
  assert.equal(cap.solid.centers.length, 2 * 16);
  const first = quadsOf(cap.solid).find((q) => q[0].show === 0)[0];
  assert.deepEqual(first.center, [0.5, 0.5, 0.5, 0]);
  assert.equal(meshCap(ctx, 1).solid.quadCount, 0);
  // Volle Ebene unter einer vollen Ebene: Kappe wird zusammengelegt
  const floor = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) floor.push([x, 4, z, PLANKS], [x, 5, z, PLANKS]);
  assert.equal(meshCap(await meshContext(floor), 4).solid.quadCount, 1);
});

dataTest('meshCap: Wasser unter Wasser bekommt eine volle Oberfläche', async () => {
  const ctx = await meshContext([[0, 0, 0, 'water[level=0]'], [0, 1, 0, 'water[level=0]']]);
  const cap = meshCap(ctx, 0);
  assert.equal(cap.translucent.quadCount, 1);
  for (const v of quadsOf(cap.translucent)[0]) assert.ok(Math.abs(v.y - 1) <= 1 / 128);
});

dataTest('meshStep: Blöcke des Schritts mit centers, Reihenfolge 0 … 1 nach y, z, x; Plopp-Flächen bleiben', async () => {
  const ctx = await meshContext([[0, 0, 0, PLANKS, 0], [0, 1, 0, PLANKS, 1], [1, 1, 0, PLANKS, 1], [20, 1, 0, PLANKS, 1], [0, 2, 0, PLANKS, 2]]);
  const step = meshStep(ctx, 1);
  const quads = quadsOf(step.solid);
  // Block (0,1,0): Unterseite zum früheren Block fehlt; Seite zum Nachbarn im selben Schritt bleibt; Oberseite zum späteren bleibt
  const at = (x, y, z) => quads.filter((q) => q[0].center[0] === x + 0.5 && q[0].center[1] === y + 0.5 && q[0].center[2] === z + 0.5);
  const first = at(0, 1, 0);
  assert.equal(first.length, 5);
  assert.ok(!first.some((q) => dirOf(q) === 'down'));
  assert.ok(first.some((q) => dirOf(q) === 'east'), 'Fläche zum Nachbarn im gleichen Schritt bleibt');
  assert.ok(first.some((q) => dirOf(q) === 'up'));
  for (const q of quads) for (const v of q) assert.ok(v.show === 1 && v.hide === HIDE_NEVER);
  const orders = [at(0, 1, 0), at(1, 1, 0), at(20, 1, 0)].map((list) => list[0][0].center[3]);
  assert.deepEqual(orders, [0, 0.5, 1]);
  // Block in einem anderen Chunk: Position chunk-lokal, Mitte in Weltkoordinaten
  const far = at(20, 1, 0)[0];
  assert.ok(far.every((v) => v.x >= 4 && v.x <= 5));
  assert.equal(step.solid.centers.length, step.solid.quadCount * 16);
  assert.equal(meshStep(ctx, 9).solid.quadCount, 0);
});

dataTest('Fehler: ohne gebundene Modelle, falscher ctx, ungültige Koordinaten; leerer Chunk', async () => {
  const volume = volumeFrom([[0, 0, 0, STONE]]);
  assert.throws(() => meshChunk({ volume }, 0, 0, 0), /models/);
  assert.throws(() => meshChunk(null, 0, 0, 0), /ctx/);
  assert.throws(() => meshChunk({ volume, models: createModels() }, 0, 0, 0), /bindTextures/);
  const models = createModels();
  await bindFor(models, ['stone']);
  assert.throws(() => meshChunk({ volume, models }, 0.5, 0, 0), /Chunk-Koordinaten/);
  assert.throws(() => meshStep({ volume, models }, -1), /Schritt/);
  assert.throws(() => meshCap({ volume, models }, 1.5), /ganze Zahl/);
  const empty = meshChunk({ volume, models }, 5, 5, 5);
  assert.deepEqual([empty.solid.quadCount, empty.cutout.quadCount, empty.translucent.quadCount], [0, 0, 0]);
  assert.equal(empty.solid.vertices.byteLength, 0);
  // Nicht gebundene Textur → klarer Fehler, danach meshen andere Aufrufe sauber weiter
  const other = volumeFrom([[0, 0, 0, 'glass']]);
  assert.throws(() => meshChunk({ volume: other, models }, 0, 0, 0), /nicht gebunden/);
  assert.equal(meshChunk({ volume, models }, 0, 0, 0).solid.quadCount, 6);
  resetMeshCache(volume);
  assert.equal(meshChunk({ volume, models }, 0, 0, 0).solid.quadCount, 6);
});

test('createQuadIndices: 0,1,2, 0,2,3 je Quad', () => {
  assert.deepEqual([...createQuadIndices(2)], [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  assert.ok(createQuadIndices(20000) instanceof Uint32Array);
  assert.throws(() => createQuadIndices(-1), /ungültig/);
});
