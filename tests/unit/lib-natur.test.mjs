// Natur-Bibliothek (§9.1): gültige Blöcke aus 26.2, alle Ausrichtungen innerhalb der dokumentierten Ausdehnung,
// Determinismus und die Naturregeln (Seerosen nur auf Wasserquellen, Zuckerrohr am Wasser, Erdpfad nie unter Blöcken).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setBlockData } from '../../js/core/block-data.js';
import { Builder } from '../../js/core/builder.js';
import { parseState } from '../../js/core/blockstate.js';
import {
  TREE_SPECIES, TREE_SIZES, BUSH_SIZES, BUSH_LEAVES, ROCK_SIZES, ROCK_MATERIALS, FLOWER_BED_PALETTES, VEGETATION_MIXES,
  PATH_MIXES, POND_SHORES, TERRAIN_SURFACES,
  tree, treeExtent, bush, bushExtent, flowerBed, vegetation, terrain, hill, pond, rock, rockExtent, path as drawPath,
  pathAlong, fixDirtPaths, groundLevel, isPlantId,
} from '../../js/builds/lib/natur.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOCKS_FILE = path.join(ROOT, 'game-data', 'blocks.json');
const hasGameData = fs.existsSync(BLOCKS_FILE);
const dataTest = hasGameData ? test : test.skip;
let blockIds = null;
if (hasGameData) {
  const json = JSON.parse(fs.readFileSync(BLOCKS_FILE, 'utf8'));
  setBlockData(json);
  blockIds = new Set(Object.keys(json.blocks));
}

const FACINGS = ['north', 'east', 'south', 'west'];
const SOIL_UNDER_PLANTS = new Set(['grass_block', 'dirt', 'podzol', 'coarse_dirt', 'rooted_dirt', 'moss_block', 'mud', 'sand']);

// Baut erst nur den Boden, dann Boden + Bauteil; liefert die Unterschiede in Modul-Koordinaten.
function run(groundFn, featureFn) {
  const plain = new Builder();
  groundFn?.(plain);
  const before = toMap(plain);
  const b = new Builder();
  groundFn?.(b);
  const box = featureFn(b);
  const after = toMap(b);
  const changed = new Map();
  for (const [key, state] of after) if (before.get(key) !== state) changed.set(key, state);
  for (const key of before.keys()) if (!after.has(key)) changed.set(key, 'air');
  return { box, after, changed };
}

function toMap(b) {
  const result = b.finalize();
  const map = new Map();
  if (result.blockCount === 0) return map;
  const [ox, oy, oz] = result.offset;
  result.volume.forEach((x, y, z, state) => map.set(`${x + ox},${y + oy},${z + oz}`, state));
  return map;
}

const pos = (key) => key.split(',').map(Number);
const idAt = (map, x, y, z) => parseState(map.get(`${x},${y},${z}`) ?? 'air').id;

function assertInside(label, changed, min, max) {
  for (const [key, state] of changed) {
    if (state === 'air') continue;
    const p = pos(key);
    for (let k = 0; k < 3; k++) {
      assert.ok(p[k] >= min[k] && p[k] <= max[k], `${label}: ${state} bei ${key} liegt außerhalb ${min} … ${max}`);
    }
  }
}

function assertBoxCovers(label, box, changed) {
  for (const [key, state] of changed) {
    if (state === 'air') continue;
    const p = pos(key);
    for (let k = 0; k < 3; k++) assert.ok(p[k] >= box.min[k] && p[k] <= box.max[k], `${label}: Rückgabe-Box enthält ${key} nicht`);
  }
}

function assertValidIds(label, map) {
  for (const state of map.values()) {
    const { id } = parseState(state);
    assert.ok(blockIds.has(id), `${label}: ${id} gibt es in 26.2 nicht`);
  }
}

const grassPlate = (r, y = -1) => (b) => b.fill(-r, y, -r, r, y, r, 'grass_block');

dataTest('Bäume: alle Arten und Größen in vier Ausrichtungen gültig und innerhalb treeExtent', () => {
  for (const species of TREE_SPECIES) {
    for (const size of TREE_SIZES) {
      const ext = treeExtent(species, size);
      const extra = ext.trunk === 2 ? 1 : 0;
      for (const facing of FACINGS) {
        const label = `${species}/${size}/${facing}`;
        const { box, after, changed } = run(grassPlate(ext.radius + 2), (b) => tree(b, { x: 0, y: 0, z: 0, species, size, facing, seed: 7 }));
        assertValidIds(label, after);
        assertInside(label, changed, [-ext.radius, -ext.below, -ext.radius], [ext.radius + extra, ext.height - 1, ext.radius + extra]);
        assertBoxCovers(label, box, changed);
        // Stammfuß: 1×1 bei (0, 0, 0), 2×2 auf x 0…1, z 0…1 – in jeder Ausrichtung.
        const stiltRoot = species === 'mangrove' ? 'mangrove_roots' : null;
        for (let dx = 0; dx <= extra; dx++) {
          for (let dz = 0; dz <= extra; dz++) {
            const id = idAt(after, dx, 0, dz);
            assert.ok(id.endsWith('_log') || id.endsWith('_wood') || id === stiltRoot, `${label}: Stammfuß bei ${dx},0,${dz} ist ${id}`);
          }
        }
        let leaves = 0;
        for (const state of changed.values()) {
          const { id, props } = parseState(state);
          if (id.endsWith('_leaves')) {
            leaves++;
            assert.equal(props.persistent, 'true', `${label}: Laub muss persistent sein`);
          }
        }
        assert.ok(leaves >= 8, `${label}: zu wenig Laub (${leaves})`);
      }
    }
  }
});

dataTest('Bäume: Äste aus Holz mit axis, Stamm aus Stämmen; Kirsche mit Blüten, Mangrove mit Stelzwurzeln', () => {
  const { after } = run(grassPlate(12), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'eiche', size: 'gross', seed: 1 }));
  const axes = new Set();
  for (const state of after.values()) {
    const { id, props } = parseState(state);
    if (id === 'oak_wood') axes.add(props.axis);
  }
  assert.ok(axes.has('x') || axes.has('z'), 'Eichenäste sollten waagrechte Holz-Blöcke enthalten');
  assert.equal(idAt(after, 0, 3, 0), 'oak_log');

  const cherry = run(grassPlate(12), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'kirsche', size: 'gross', seed: 2 }));
  const petals = [...cherry.changed].filter(([, s]) => s.startsWith('pink_petals'));
  assert.ok(petals.length > 5, 'Kirsche: Blütenblätter am Boden fehlen');
  for (const [key] of petals) {
    const [x, y, z] = pos(key);
    assert.equal(y, 0);
    assert.equal(idAt(cherry.after, x, y - 1, z), 'grass_block', 'Blütenblätter nur auf Gras');
  }
  const noGround = run(null, (b) => tree(b, { x: 0, y: 0, z: 0, species: 'kirsche', size: 'gross', seed: 2 }));
  assert.ok(![...noGround.after.values()].some((s) => s.startsWith('pink_petals')), 'ohne Boden keine schwebenden Blüten');

  const mangrove = run(grassPlate(12), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'mangrove', size: 'gross', seed: 3 }));
  const groundRoots = [...mangrove.changed].filter(([key, s]) => s.startsWith('mangrove_roots') && pos(key)[1] === 0);
  assert.ok(groundRoots.length >= 4, 'Mangrove: Stelzwurzeln müssen den Boden erreichen');
  assert.ok([...mangrove.changed.values()].some((s) => s.startsWith('mangrove_propagule')), 'Mangrove: Keimlinge fehlen');

  const jungle = run(grassPlate(12), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'dschungel', size: 'gross', seed: 4 }));
  const vines = [...jungle.changed.values()].filter((s) => s.startsWith('vine'));
  assert.ok(vines.length > 0, 'Dschungel: Ranken fehlen');
  const noVines = run(grassPlate(12), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'dschungel', size: 'gross', seed: 4, vines: false }));
  assert.ok(![...noVines.changed.values()].some((s) => s.startsWith('vine') || s.startsWith('cocoa')));
});

dataTest('Ranken und Kakao hängen an einem Block oder an der Ranke darüber', () => {
  const { after } = run(grassPlate(12), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'dschungel', size: 'riesig', seed: 5 }));
  const offsets = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  for (const [key, state] of after) {
    const { id, props } = parseState(state);
    const [x, y, z] = pos(key);
    if (id === 'vine') {
      const faces = Object.keys(offsets).filter((f) => props[f] === 'true');
      assert.equal(faces.length, 1, `Ranke bei ${key}: genau eine Seite`);
      const [dx, dz] = offsets[faces[0]];
      const holder = idAt(after, x + dx, y, z + dz);
      const above = after.get(`${x},${y + 1},${z}`) ?? 'air';
      assert.ok(holder !== 'air' || (above.startsWith('vine') && parseState(above).props[faces[0]] === 'true'), `Ranke bei ${key} hängt in der Luft`);
    }
    if (id === 'cocoa') {
      const [dx, dz] = offsets[props.facing];
      assert.equal(idAt(after, x + dx, y, z + dz), 'jungle_log', `Kakao bei ${key} zeigt nicht zum Stamm`);
    }
  }
});

dataTest('Bäume: deterministisch und unabhängig von der Reihenfolge', () => {
  const a = run(grassPlate(30), (b) => {
    tree(b, { x: -10, y: 0, z: 0, species: 'eiche', size: 'gross', seed: 1 });
    tree(b, { x: 10, y: 0, z: 0, species: 'kirsche', size: 'gross', seed: 1 });
  });
  const b2 = run(grassPlate(30), (b) => {
    tree(b, { x: 10, y: 0, z: 0, species: 'kirsche', size: 'gross', seed: 1 });
    tree(b, { x: -10, y: 0, z: 0, species: 'eiche', size: 'gross', seed: 1 });
  });
  assert.deepEqual([...a.after].sort(), [...b2.after].sort());
  const c = run(grassPlate(30), (b) => tree(b, { x: -10, y: 0, z: 0, species: 'eiche', size: 'gross', seed: 2 }));
  const d = run(grassPlate(30), (b) => tree(b, { x: -10, y: 0, z: 0, species: 'eiche', size: 'gross', seed: 1 }));
  assert.notDeepEqual([...c.changed].sort(), [...d.changed].sort(), 'anderer seed → anderer Baum');
});

dataTest('Büsche: alle Größen und Laubarten in vier Ausrichtungen innerhalb bushExtent', () => {
  for (const size of BUSH_SIZES) {
    const ext = bushExtent(size);
    for (const leaves of BUSH_LEAVES) {
      for (const facing of FACINGS) {
        const label = `bush ${size}/${leaves}/${facing}`;
        const { box, after, changed } = run(grassPlate(5), (b) => bush(b, { x: 0, y: 0, z: 0, size, leaves, facing, seed: 3 }));
        assertValidIds(label, after);
        assertInside(label, changed, [-ext.radius, 0, -ext.radius], [ext.radius, ext.height - 1, ext.radius]);
        assertBoxCovers(label, box, changed);
        assert.ok(changed.size >= 5, `${label}: zu klein`);
      }
    }
  }
});

dataTest('Blumenbeete: Fläche, Boden, Rand und doppelte Pflanzen hinten', () => {
  for (const palette of FLOWER_BED_PALETTES) {
    for (const border of [null, 'stein', 'holz']) {
      for (const facing of FACINGS) {
        const label = `flowerBed ${palette}/${border}/${facing}`;
        const { box, after, changed } = run(null, (b) => flowerBed(b, { x: 2, y: 0, z: 3, width: 7, depth: 6, palette, border, facing, seed: 1 }));
        assertValidIds(label, after);
        assertInside(label, changed, [2, 0, 3], [8, 2, 8]);
        assertBoxCovers(label, box, changed);
        for (const [key, state] of after) {
          const [x, y, z] = pos(key);
          const { id, props } = parseState(state);
          if (y === 1 && isPlantId(id)) assert.ok(SOIL_UNDER_PLANTS.has(idAt(after, x, 0, z)), `${label}: Pflanze ohne Erde bei ${key}`);
          if (props.half === 'lower') assert.equal(parseState(after.get(`${x},${y + 1},${z}`)).props.half, 'upper');
        }
      }
    }
  }
  // Hohe Pflanzen stehen hinten (facing = vorne).
  const { after } = run(null, (b) => flowerBed(b, { x: 0, y: 0, z: 0, width: 9, depth: 7, palette: 'bunt', facing: 'south', density: 1, seed: 4 }));
  for (const [key, state] of after) if (parseState(state).props.half === 'lower') assert.ok(pos(key)[2] <= 1, `hohe Pflanze vorne bei ${key}`);
});

dataTest('Bewuchs: alle Mischungen, nur auf passendem Boden, findet den Boden auf Hügeln', () => {
  for (const mix of VEGETATION_MIXES) {
    for (const facing of FACINGS) {
      const label = `vegetation ${mix}/${facing}`;
      const ground = (b) => {
        b.fill(0, 0, 0, 15, 0, 15, mix === 'trocken' ? 'sand' : 'grass_block');
        b.fill(0, 1, 0, 5, 3, 5, 'grass_block');
      };
      const { box, after, changed } = run(ground, (b) => vegetation(b, { x: 0, y: 5, z: 0, width: 16, depth: 16, mix, facing, density: 0.8, seed: 2 }));
      assertValidIds(label, after);
      assertInside(label, changed, [0, 1, 0], [15, 6, 15]);
      assert.ok(changed.size > 10, `${label}: fast nichts gesetzt`);
      assertBoxCovers(label, box, changed);
      for (const [key, state] of changed) {
        const [x, y, z] = pos(key);
        if (parseState(state).props.half === 'upper') continue;
        assert.ok(SOIL_UNDER_PLANTS.has(idAt(after, x, y - 1, z)), `${label}: ${state} ohne Boden bei ${key}`);
      }
    }
  }
  const empty = run(null, (b) => vegetation(b, { x: 0, y: 5, z: 0, width: 4, depth: 4 }));
  assert.equal(empty.box, null, 'ohne Boden: nichts setzen, Rückgabe null');
});

dataTest('Gelände und Hügel: Schichten, Fläche, top() und alle Oberflächen', () => {
  for (const surface of TERRAIN_SURFACES) {
    for (const facing of FACINGS) {
      const label = `terrain ${surface}/${facing}`;
      const res = run(null, (b) => terrain(b, { x: 0, y: 0, z: 0, width: 12, depth: 9, facing, surface, heightAt: (dx) => dx / 2, edge: 2, shape: 'rund', seed: 1 }));
      assertValidIds(label, res.after);
      assertInside(label, res.changed, [0, 0, 0], [11, 6, 8]);
      assertBoxCovers(label, res.box, res.changed);
    }
  }
  const flat = run(null, (b) => terrain(b, { x: 0, y: 0, z: 0, width: 5, depth: 5, height: 4 }));
  assert.equal(idAt(flat.after, 2, 4, 2), 'grass_block');
  assert.equal(idAt(flat.after, 2, 3, 2), 'dirt');
  assert.ok(['stone', 'andesite', 'gravel', 'tuff'].includes(idAt(flat.after, 2, 0, 2)));
  assert.equal(flat.box.top(2, 2), 4);
  assert.equal(flat.box.top(9, 9), null);
  assert.throws(() => terrain(new Builder(), { x: 0, y: 0, z: 0, width: 3, depth: 3, heightAt: () => NaN }), /Höhenfunktion/);

  for (const facing of FACINGS) {
    const label = `hill ${facing}`;
    const res = run(null, (b) => hill(b, { x: 0, y: 0, z: 0, width: 20, depth: 16, height: 7, facing, seed: 2 }));
    assertValidIds(label, res.after);
    assertInside(label, res.changed, [0, 0, 0], [19, 7, 15]);
    // Gipfel liegt hinten: die Vorderseite (facing) ist flacher.
    const [fx, fz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
    let front = 0;
    let back = 0;
    for (let dz = 0; dz < 16; dz++) {
      for (let dx = 0; dx < 20; dx++) {
        const top = res.box.top(dx, dz);
        if (top === null) continue;
        const side = (dx - 9.5) * fx + (dz - 7.5) * fz;
        if (side > 2) front += top;
        if (side < -2) back += top;
      }
    }
    assert.ok(back > front, `${label}: Gipfel sollte hinten liegen (vorne ${front}, hinten ${back})`);
  }
});

dataTest('Teich: Wasserquellen, Ufer, Seerosen nur auf Wasser, Zuckerrohr direkt am Wasser', () => {
  for (const shore of POND_SHORES) {
    for (const facing of FACINGS) {
      const label = `pond ${shore}/${facing}`;
      const ground = (b) => {
        b.fill(-2, -4, -2, 17, -1, 15, 'dirt');
        b.fill(-2, 0, -2, 17, 0, 15, 'grass_block');
        b.set(7, 1, 1, 'short_grass');
      };
      const { box, after, changed } = run(ground, (b) => pond(b, { x: 0, y: 0, z: 0, width: 16, depth: 14, waterDepth: 3, shore, facing, seed: 3 }));
      assertValidIds(label, after);
      assertInside(label, changed, [0, -3, 0], [15, 3, 13]);
      assertBoxCovers(label, box, changed);
      let water = 0;
      for (const [key, state] of after) {
        const [x, y, z] = pos(key);
        const { id, props } = parseState(state);
        if (id === 'water') {
          water++;
          assert.equal(props.level, '0', `${label}: nur Wasserquellen`);
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const side = idAt(after, x + dx, y, z + dz);
            assert.notEqual(side, 'air', `${label}: Wasser läuft bei ${key} aus`);
          }
          assert.notEqual(idAt(after, x, y - 1, z), 'air', `${label}: Wasser ohne Boden bei ${key}`);
        }
        if (id === 'lily_pad') assert.equal(after.get(`${x},${y - 1},${z}`), 'water[level=0]', `${label}: Seerose nicht auf Wasserquelle`);
        if (id === 'sugar_cane' && idAt(after, x, y - 1, z) !== 'sugar_cane') {
          assert.ok(['sand', 'grass_block', 'dirt', 'mud'].includes(idAt(after, x, y - 1, z)), `${label}: Zuckerrohr auf falschem Boden`);
          const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => idAt(after, x + dx, y - 1, z + dz) === 'water');
          assert.ok(wet, `${label}: Zuckerrohr bei ${key} nicht direkt am Wasser`);
        }
      }
      assert.ok(water > 30, `${label}: zu wenig Wasser (${water})`);
    }
  }
});

dataTest('Felsen: alle Größen, Gesteine und Ausrichtungen innerhalb rockExtent', () => {
  for (const size of ROCK_SIZES) {
    const ext = rockExtent(size);
    for (const material of ROCK_MATERIALS) {
      for (const facing of FACINGS) {
        const label = `rock ${size}/${material}/${facing}`;
        const { box, after, changed } = run(grassPlate(ext.radius + 1), (b) => rock(b, { x: 0, y: 0, z: 0, size, material, facing, seed: 2 }));
        assertValidIds(label, after);
        assertInside(label, changed, [-ext.radius, -ext.below, -ext.radius], [ext.radius, ext.height - 1, ext.radius]);
        assertBoxCovers(label, box, changed);
        assert.ok(changed.size >= 1);
      }
    }
  }
});

dataTest('Wege: Erdpfad nie unter einem Block, gemischte Materialien, Ausdehnung', () => {
  for (const mix of PATH_MIXES) {
    for (const facing of FACINGS) {
      const label = `path ${mix}/${facing}`;
      const [fx, fz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
      const ground = (b) => {
        b.fill(-25, 0, -25, 25, 0, 25, 'grass_block');
        b.set(fx * 5, 1, fz * 5, 'oak_fence');
        b.set(fx * 6, 1, fz * 6, 'short_grass');
      };
      const { box, after, changed } = run(ground, (b) => drawPath(b, { x: 0, y: 0, z: 0, length: 20, width: 3, mix, facing, wiggle: 1, seed: 1 }));
      assertValidIds(label, after);
      const along = [0, 19];
      const across = [-2, 2]; // ±floor(width/2 + wiggle)
      const min = fx !== 0 ? [Math.min(along[0] * fx, along[1] * fx), -1, across[0]] : [across[0], -1, Math.min(along[0] * fz, along[1] * fz)];
      const max = fx !== 0 ? [Math.max(along[0] * fx, along[1] * fx), 0, across[1]] : [across[1], 0, Math.max(along[0] * fz, along[1] * fz)];
      assertInside(label, changed, min, max);
      assertBoxCovers(label, box, changed);
      assert.notEqual(idAt(after, fx * 5, 0, fz * 5), 'dirt_path', `${label}: Erdpfad unter dem Zaun`);
      assert.equal(idAt(after, fx * 6, 1, fz * 6), 'air', `${label}: Gras auf dem Weg wurde nicht entfernt`);
      const kinds = new Set();
      for (const [key, state] of after) {
        const [x, y, z] = pos(key);
        const { id } = parseState(state);
        if (y === 0 && changed.has(key)) kinds.add(id);
        if (id === 'dirt_path') assert.equal(after.get(`${x},${y + 1},${z}`) ?? 'air', 'air', `${label}: Erdpfad unter Block bei ${key}`);
      }
      assert.ok(kinds.size >= 2, `${label}: Weg sollte gemischt sein (${[...kinds]})`);
    }
  }
  const along = run((b) => b.fill(-5, 0, -5, 30, 0, 30, 'grass_block'), (b) => pathAlong(b, { y: 0, points: [[0, 0], [20, 0], [20, 20]], width: 2 }));
  assertInside('pathAlong', along.changed, [-1, -1, -1], [21, 0, 21]);
  assert.notEqual(idAt(along.after, 10, 0, 0), 'grass_block');
  assert.notEqual(idAt(along.after, 20, 0, 10), 'grass_block');
});

dataTest('Wege: follow folgt dem Gelände; fixDirtPaths und groundLevel', () => {
  const ground = (b) => {
    b.fill(0, 0, 0, 20, 0, 4, 'grass_block');
    b.fill(10, 1, 0, 20, 2, 4, 'grass_block');
  };
  const res = run(ground, (b) => drawPath(b, { x: 0, y: 6, z: 2, length: 21, width: 1, facing: 'east', wiggle: 0, follow: true }));
  assert.notEqual(idAt(res.after, 3, 0, 2), 'grass_block');
  assert.notEqual(idAt(res.after, 15, 2, 2), 'grass_block');
  assert.equal(idAt(res.after, 15, 0, 2), 'grass_block', 'follow: unter dem Gelände nichts ändern');

  const b = new Builder();
  b.set(0, 0, 0, 'dirt_path');
  b.set(0, 1, 0, 'oak_planks');
  b.set(1, 0, 0, 'dirt_path');
  assert.equal(fixDirtPaths(b, { x1: 0, y1: 0, z1: 0, x2: 1, y2: 0, z2: 0 }), 1);
  assert.equal(b.get(0, 0, 0), 'coarse_dirt');
  assert.equal(b.get(1, 0, 0), 'dirt_path');
  b.set(1, 4, 0, 'stone');
  b.set(1, 5, 0, 'poppy');
  assert.equal(groundLevel(b, 1, 0, { from: 10 }), 4);
  assert.equal(groundLevel(b, 5, 5, { from: 10 }), null);
});

dataTest('Unbekannte und fehlende Optionen werfen einen Error', () => {
  const b = new Builder();
  assert.throws(() => tree(b, { x: 0, y: 0, z: 0, art: 'eiche' }), /unbekannte Option „art“/);
  assert.throws(() => tree(b, { x: 0, y: 0, species: 'eiche' }), /„z“ fehlt/);
  assert.throws(() => tree(b, { x: 0, y: 0, z: 0, species: 'palme' }), /species/);
  assert.throws(() => tree(b, { x: 0, y: 0, z: 0, facing: 'up' }), /facing/);
  assert.throws(() => bush(b, { x: 0, y: 0, z: 0, size: 'riesig' }), /size/);
  assert.throws(() => pond(b, { x: 0, y: 0, z: 0, width: 3, depth: 8 }), /width/);
  assert.throws(() => flowerBed(b, { x: 0, y: 0, z: 0, width: 3, depth: 3, farbe: 'rot' }), /unbekannte Option/);
  assert.throws(() => pathAlong(b, { y: 0, points: [[0, 0]] }), /points/);
  assert.throws(() => rock(b, { x: 0.5, y: 0, z: 0 }), /ganze Zahl/);
  assert.throws(() => vegetation(b, { x: 0, y: 0, z: 0, width: 2, depth: 2, mix: 'dschungel' }), /mix/);
  assert.throws(() => hill(b, { x: 0, y: 0, z: 0, width: 5, depth: 5, seed: {} }), /seed/);
});

dataTest('Alles wirkt mit b.transform (Drehung von außen)', () => {
  // facing 'west' = 90° im Uhrzeigersinn; dasselbe wie ein äußerer Transform mit rotate 90.
  const inner = run(grassPlate(10), (b) => tree(b, { x: 0, y: 0, z: 0, species: 'akazie', size: 'mittel', facing: 'west', seed: 1 }));
  const outer = run(grassPlate(10), (b) => b.transform({ rotate: 90 }, () => tree(b, { x: 0, y: 0, z: 0, species: 'akazie', size: 'mittel', facing: 'south', seed: 1 })));
  assert.deepEqual([...outer.after].sort(), [...inner.after].sort());
});
