import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MC_VERSION, MCMETA_TAG, UserError, createWarnings, parseCliArgs, defaultSourcePaths, buildNames,
  convertMcmetaBlocks, deriveBlocksFromBlockstates, compareBlocksWithBlockstates, extractBlocks, parseVariantKey,
  buildModels, findBlocksWithoutGeometry, defaultFaceUv, axisRotationMatrix, eulerRotationMatrix, applyRescale,
  convertElementRotation, convertConditionTerms, readPngSize, parseAnimation, buildTextures, isIncludedTexture, formatState,
} from '../../scripts/extract-game-data.mjs';
import * as extractScript from '../../scripts/extract-game-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_DATA = path.join(ROOT, 'game-data');
const TMP_DIR = path.join(ROOT, 'tmp');
const M = 'assets/minecraft/models/';
const T = 'assets/minecraft/textures/';

// Objekte ohne Prototyp (aus dem Skript) für Vergleiche in normale JSON-Werte verwandeln.
const plain = (value) => JSON.parse(JSON.stringify(value));

function pngHeader(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

// Gleiche Schnittstelle wie createJarAssets, Daten im Speicher.
function memoryAssets(files) {
  const map = new Map(Object.entries(files).map(([name, content]) => [
    name, Buffer.isBuffer(content) ? content : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content), 'utf8'),
  ]));
  return {
    has: (name) => map.has(name),
    list: (prefix) => [...map.keys()].filter((name) => name.startsWith(prefix)).sort(),
    read: (name) => {
      if (!map.has(name)) throw new Error(`fehlt: ${name}`);
      return map.get(name);
    },
    readJson: (name) => JSON.parse(map.get(name).toString('utf8')),
  };
}

const CUBE_FACES = Object.fromEntries(['down', 'up', 'north', 'south', 'west', 'east'].map((d) => [d, { texture: `#${d}`, cullface: d }]));

function modelFixture() {
  return memoryAssets({
    [`${M}block/block.json`]: { ambientocclusion: true },
    [`${M}block/cube.json`]: { parent: 'block/block', elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: CUBE_FACES }] },
    [`${M}block/cube_all.json`]: {
      parent: 'minecraft:block/cube',
      textures: { particle: '#all', down: '#all', up: '#all', north: '#all', south: '#all', west: '#all', east: '#all' },
    },
    [`${M}block/stone.json`]: { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } },
    [`${M}block/stone_alt.json`]: { parent: 'block/cube_all', textures: { all: 'block/stone' } },
    [`${M}block/glass.json`]: { parent: 'block/cube_all', textures: { all: { sprite: 'minecraft:block/glass', force_translucent: true } } },
    [`${M}block/no_ao_parent.json`]: {
      ambientocclusion: false,
      textures: { side: '#all' },
      elements: [{
        from: [2, 0, 4], to: [14, 8, 12], shade: false, light_emission: 15,
        rotation: { origin: [8, 8, 8], axis: 'y', angle: 45, rescale: true },
        faces: {
          up: { texture: '#side', tintindex: 0, rotation: 90 },
          north: { texture: '#side', uv: [1, 2, 3, 4] },
          south: { texture: '#gibt_es_nicht' },
          east: { texture: 'side' },
        },
      }],
    },
    [`${M}block/child_inherits.json`]: { parent: 'block/no_ao_parent', textures: { all: 'block/dirt', particle: 'block/dirt' } },
    [`${M}block/child_empty.json`]: { parent: 'block/no_ao_parent', textures: { particle: 'block/dirt' }, elements: [] },
    [`${M}block/missing_texture.json`]: { parent: 'block/cube_all', textures: { all: 'block/fehlt' } },
    [`${M}block/euler.json`]: {
      textures: { all: 'block/dirt', particle: 'block/dirt' },
      elements: [{ from: [0, 0, 0], to: [16, 1, 16], rotation: { origin: [8, 0, 8], y: 90 }, faces: { up: { texture: '#all' } } }],
    },
    [`${T}block/stone.png`]: pngHeader(16, 16),
    [`${T}block/glass.png`]: pngHeader(16, 16),
    [`${T}block/dirt.png`]: pngHeader(16, 16),
  });
}

const FENCE_PROPS = { east: ['none', 'low', 'tall'], north: ['none', 'low', 'tall'], up: ['true', 'false'] };

function blockstateFixture() {
  return new Map([
    ['stone', { variants: { '': [{ model: 'minecraft:block/stone' }, { model: 'block/stone_alt', y: 180, weight: 3 }] } }],
    ['stone_copy', { variants: { '': { model: 'block/stone' } } }],
    ['glass', { variants: { '': { model: 'block/glass' } } }],
    ['plant', { variants: { 'up=true': { model: 'block/child_inherits', x: 90, y: 270, uvlock: true }, 'up=false': { model: 'block/child_empty' } } }],
    ['broken', { variants: { '': { model: 'block/missing_texture' } } }],
    ['tilted', { variants: { '': { model: 'block/euler' } } }],
    ['wall', {
      multipart: [
        { apply: { model: 'block/stone' } },
        { when: { north: 'low|tall' }, apply: { model: 'block/glass' } },
        { when: { OR: [{ east: '!none' }, { north: 'tall', up: 'true' }] }, apply: { model: 'block/stone' } },
        { when: { AND: [{ up: true }, { east: 'none' }] }, apply: { model: 'block/stone' } },
      ],
    }],
  ]);
}

function buildModelFixture() {
  const warnings = createWarnings();
  const blocks = { wall: { props: FENCE_PROPS, default: { east: 'none', north: 'none', up: 'true' } } };
  const result = buildModels({ assets: modelFixture(), blockstates: blockstateFixture(), blocks, warnings });
  const data = plain(result.data);
  const byName = (name) => data.models.find((model) => model.name === name);
  return { data, warnings: warnings.list, stats: result.stats, byName };
}

// ---------------------------------------------------------------------------------------------
// Reine Funktionen

test('Namen: nur genau dreiteilige block./item.-Schlüssel, de und en zusammengeführt', () => {
  const en = { 'block.minecraft.stone': 'Stone', 'block.minecraft.banner.base.white': 'x', 'item.minecraft.redstone': 'Redstone Dust', 'item.minecraft.only_en': 'Only' };
  const de = { 'block.minecraft.stone': 'Stein', 'item.minecraft.redstone': 'Redstone-Staub', 'entity.minecraft.pig': 'Schwein', 'block.minecraft.__proto__': 'x' };
  const names = plain(buildNames(en, de));
  assert.deepEqual(names.block.stone, { de: 'Stein', en: 'Stone' });
  assert.equal(names.block.banner, undefined);
  assert.deepEqual(names.item.redstone, { de: 'Redstone-Staub', en: 'Redstone Dust' });
  assert.deepEqual(names.item.only_en, { de: null, en: 'Only' });
  assert.deepEqual(names.block.__proto__, { de: 'x', en: null });
  assert.deepEqual(Object.keys(names), ['block', 'item']);
});

test('Kommandozeile und Standardpfade', () => {
  assert.deepEqual(parseCliArgs([]), { jar: undefined, assets: undefined, offline: false, help: false });
  assert.equal(parseCliArgs(['--jar', 'C:\\x\\26.2.jar', '--offline']).jar, 'C:\\x\\26.2.jar');
  assert.throws(() => parseCliArgs(['--foo']), (error) => error instanceof UserError && /Unbekannte Option „--foo“/.test(error.message));
  assert.throws(() => parseCliArgs(['--jar']), UserError);
  assert.throws(() => parseCliArgs(['--jar', '  ']), /braucht einen Pfad/);
  assert.throws(() => parseCliArgs(['zusatz']), /Unerwartetes Argument/);

  const paths = defaultSourcePaths({ APPDATA: 'D:\\Roaming' }, 'D:\\Home');
  assert.equal(paths.jar, path.join('D:\\Roaming', '.minecraft', 'versions', MC_VERSION, `${MC_VERSION}.jar`));
  assert.deepEqual(paths.assetDirs, [path.join('D:\\Home', 'curseforge', 'minecraft', 'Install', 'assets'), path.join('D:\\Roaming', '.minecraft', 'assets')]);
  assert.equal(defaultSourcePaths({}, 'D:\\Home').jar, path.join('D:\\Home', 'AppData', 'Roaming', '.minecraft', 'versions', MC_VERSION, `${MC_VERSION}.jar`));
});

function mcmetaFixture(count = 500) {
  const raw = { oak_stairs: [{ facing: ['north', 'south'], half: ['top', 'bottom'] }, { facing: 'north', half: 'bottom' }] };
  for (let i = 0; i < count; i++) raw[`block_${i}`] = [{}, {}];
  return raw;
}

test('mcmeta-Blockbericht wird geprüft und umgewandelt', () => {
  const blocks = plain(convertMcmetaBlocks(mcmetaFixture()));
  assert.deepEqual(blocks.oak_stairs, { props: { facing: ['north', 'south'], half: ['top', 'bottom'] }, default: { facing: 'north', half: 'bottom' } });
  assert.throws(() => convertMcmetaBlocks({ ...mcmetaFixture(), bad: [{ a: ['x'] }, { a: 'y' }] }), /ungültig/);
  assert.throws(() => convertMcmetaBlocks({ ...mcmetaFixture(), 'Böse-ID': [{}, {}] }), /unerwartetes Format/);
  assert.throws(() => convertMcmetaBlocks(mcmetaFixture(3)), /unvollständig/);
  assert.throws(() => convertMcmetaBlocks([]), /kein Objekt/);
});

test('Rückfall „derived“: Eigenschaften aus Blockstates mit Standardwerte-Tabelle', () => {
  const blocks = plain(deriveBlocksFromBlockstates(blockstateFixture()));
  assert.deepEqual(blocks.plant, { props: { up: ['true', 'false'] }, default: { up: 'false' } });
  assert.deepEqual(blocks.wall.props, { east: ['none'], north: ['low', 'tall'], up: ['true'] });
  assert.equal(blocks.wall.default.east, 'none');
  assert.deepEqual(blocks.stone, { props: {}, default: {} });
  const stairs = plain(deriveBlocksFromBlockstates(new Map([['oak_stairs', {
    variants: { 'facing=east,half=top': { model: 'a' }, 'facing=north,half=bottom': { model: 'a' }, 'facing=x,kaputt': { model: 'a' } },
  }]])));
  assert.deepEqual(stairs.oak_stairs.default, { facing: 'north', half: 'bottom' });
  assert.deepEqual(compareBlocksWithBlockstates({ a: {}, b: {} }, ['b', 'c']), [
    '1 Blöcke ohne Blockstate-Datei: a',
    '1 Blockstate-Dateien ohne Eintrag im Blockbericht: c',
  ]);
});

test('Blockbericht: Cache, kaputter Cache und Offline-Rückfall', async () => {
  const cacheDir = path.join(TMP_DIR, `game-data-test-cache-${process.pid}`);
  fs.rmSync(cacheDir, { recursive: true, force: true });
  try {
    const blockstates = blockstateFixture();
    let warnings = createWarnings();
    const offline = await extractBlocks({ blockstates, worldVersion: 4903, offline: true, warnings, cacheDir });
    assert.equal(offline.data.source, 'derived');
    assert.match(warnings.list[0], /nicht verfügbar.*derived/);

    fs.mkdirSync(cacheDir, { recursive: true });
    const versionFile = path.join(cacheDir, `mcmeta-${MCMETA_TAG}-version.json`);
    const blocksFile = path.join(cacheDir, `mcmeta-${MCMETA_TAG}-blocks.json`);
    fs.writeFileSync(versionFile, JSON.stringify({ id: MC_VERSION, data_version: 4903 }));
    fs.writeFileSync(blocksFile, JSON.stringify(mcmetaFixture()));
    warnings = createWarnings();
    const cached = await extractBlocks({ blockstates, worldVersion: 4903, offline: true, warnings, cacheDir });
    assert.equal(cached.data.source, 'mcmeta');
    assert.equal(cached.cached, true);
    assert.deepEqual(plain(cached.data.blocks.oak_stairs.default), { facing: 'north', half: 'bottom' });
    assert.ok(warnings.list.some((w) => /Blockstate-Dateien ohne Eintrag/.test(w)), 'Abgleich meldet Blockstates ohne Bericht');

    fs.writeFileSync(versionFile, JSON.stringify({ id: '26.1', data_version: 4700 }));
    warnings = createWarnings();
    const wrongVersion = await extractBlocks({ blockstates, worldVersion: 4903, offline: true, warnings, cacheDir });
    assert.equal(wrongVersion.data.source, 'derived');
    assert.match(warnings.list[0], /Cache des Blockberichts unbrauchbar.*26\.1/);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('Variantenschlüssel und Multipart-Werte', () => {
  assert.deepEqual(plain(parseVariantKey('facing=east,half=bottom')), { facing: 'east', half: 'bottom' });
  assert.deepEqual(plain(parseVariantKey('')), {});
  assert.throws(() => parseVariantKey('normal'), /ungültiger Variantenschlüssel/);
  assert.deepEqual(convertConditionTerms('low|tall', null), ['low', 'tall']);
  assert.deepEqual(convertConditionTerms(true, null), ['true']);
  assert.deepEqual(convertConditionTerms('!none', ['none', 'low', 'tall']), ['low', 'tall']);
  assert.deepEqual(convertConditionTerms('!low|none', ['none', 'low', 'tall']), ['none', 'tall']);
  assert.throws(() => convertConditionTerms('!none', null), /Werteliste/);
  assert.throws(() => convertConditionTerms('a||b', null), /leerer Wert/);
});

test('Modelle: Eltern-Kette, Texturverweise, Standardwerte und Standard-UVs', () => {
  const { data, byName } = buildModelFixture();
  const stone = byName('block/stone');
  assert.equal(stone.ao, true);
  assert.equal(data.textures[stone.particle], 'block/stone');
  assert.equal(stone.elements.length, 1);
  const [element] = stone.elements;
  assert.deepEqual(element.from, [0, 0, 0]);
  assert.equal(element.rotation, null);
  assert.equal(element.shade, true);
  assert.equal(element.light, 0);
  assert.deepEqual(Object.keys(element.faces), ['down', 'up', 'north', 'south', 'west', 'east']);
  for (const [direction, face] of Object.entries(element.faces)) {
    assert.deepEqual(face, { tex: data.textures.indexOf('block/stone'), uv: [0, 0, 16, 16], rotation: 0, cull: direction, tint: -1 });
  }
  // Nur genutzte Modelle, jedes genau einmal (Vorlagen wie block/cube fehlen).
  assert.equal(data.models.filter((model) => model.name === 'block/stone').length, 1);
  assert.equal(byName('block/cube'), undefined);
  assert.equal(data.blocks.stone_copy.variants[0].apply[0].model, data.blocks.stone.variants[0].apply[0].model);
});

test('Modelle: Element-Felder, rescale, leere elements und Probleme', () => {
  const { data, byName, warnings } = buildModelFixture();
  const inherited = byName('block/child_inherits');
  assert.equal(inherited.ao, false, 'ambientocclusion wird vererbt');
  const [element] = inherited.elements;
  assert.equal(element.shade, false);
  assert.equal(element.light, 15);
  assert.deepEqual(element.rotation, { origin: [8, 8, 8], axis: 'y', angle: 45, rescale: true, matrix: [1, 0, 1, 0, 1, 0, -1, 0, 1] });
  const dirt = data.textures.indexOf('block/dirt');
  assert.deepEqual(element.faces.up, { tex: dirt, uv: [2, 4, 14, 12], rotation: 90, cull: null, tint: 0 });
  assert.deepEqual(element.faces.north.uv, [1, 2, 3, 4]);
  assert.equal(element.faces.south.tex, -1);
  assert.equal(element.faces.east.tex, dirt, 'Flächen-Textur ohne # meint ebenfalls den Platz');
  assert.ok(warnings.some((w) => /child_inherits: Textur „#gibt_es_nicht“ nicht auflösbar/.test(w)));

  assert.deepEqual(byName('block/child_empty').elements, [], 'vorhandenes leeres elements beendet die Vererbung');

  const glassFace = byName('block/glass').elements[0].faces.up;
  assert.equal(glassFace.translucent, true);
  assert.equal(data.textures[glassFace.tex], 'block/glass');

  assert.equal(byName('block/missing_texture').elements[0].faces.up.tex, -1);
  assert.ok(warnings.some((w) => /Textur fehlt in der Jar: block\/fehlt/.test(w)));
  for (const name of data.textures) assert.notEqual(name, 'block/fehlt');

  const euler = byName('block/euler').elements[0].rotation;
  assert.deepEqual(euler, { origin: [8, 0, 8], axis: null, angle: null, euler: [0, 90, 0], rescale: false, matrix: [0, 0, 1, 0, 1, 0, -1, 0, 0] });
});

test('Blockstates: Varianten mit Gewicht/Drehung und Multipart mit OR/AND/|/!', () => {
  const { data, stats } = buildModelFixture();
  const [stoneVariant] = data.blocks.stone.variants;
  assert.deepEqual(stoneVariant.when, {});
  assert.equal(stoneVariant.apply.length, 2);
  assert.deepEqual({ ...stoneVariant.apply[1], model: 'x' }, { model: 'x', x: 0, y: 180, uvlock: false, weight: 3 });
  assert.equal(stats.weightedLists, 1);

  const plant = data.blocks.plant.variants;
  assert.deepEqual(plant.map((v) => v.when), [{ up: 'true' }, { up: 'false' }]);
  assert.deepEqual({ ...plant[0].apply[0], model: 'x' }, { model: 'x', x: 90, y: 270, uvlock: true, weight: 1 });

  const parts = data.blocks.wall.multipart;
  assert.equal(parts[0].when, null);
  assert.deepEqual(parts[1].when, { north: ['low', 'tall'] });
  assert.deepEqual(parts[2].when, { OR: [{ east: ['low', 'tall'] }, { north: ['tall'], up: ['true'] }] });
  assert.deepEqual(parts[3].when, { AND: [{ up: ['true'] }, { east: ['none'] }] });
  assert.deepEqual(findBlocksWithoutGeometry(data), []);
});

test('Drehmatrizen wie im Spiel', () => {
  const close = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 1e-9, `${actual} ≈ ${expected}`));
  close(axisRotationMatrix('x', 90), [1, 0, 0, 0, 0, -1, 0, 1, 0]);
  close(axisRotationMatrix('z', 90), [0, -1, 0, 1, 0, 0, 0, 0, 1]);
  close(eulerRotationMatrix([0, -67.5, 0]), axisRotationMatrix('y', -67.5));
  // Hängeschild in 26.2: x=180, y=-67.5, z=-180 ergibt eine Y-Drehung um −112,5°.
  close(eulerRotationMatrix([180, -67.5, -180]), axisRotationMatrix('y', -112.5));
  close(applyRescale(axisRotationMatrix('z', 22.5)), axisRotationMatrix('z', 22.5).map((v, i) => (i % 3 === 2 ? v : v / Math.cos(Math.PI / 8))));
  assert.equal(convertElementRotation({ origin: [8, 8, 8], axis: 'y', angle: 0, rescale: true }, () => {}).matrix.join(), '1,0,0,0,1,0,0,0,1');
  const problems = [];
  assert.equal(convertElementRotation({ origin: [8, 8, 8] }, (m) => problems.push(m)), null);
  assert.equal(convertElementRotation({ origin: [8, 8, 8], axis: 'w', angle: 1 }, (m) => problems.push(m)), null);
  assert.equal(problems.length, 2);
});

test('Standard-UVs aus der Elementgröße', () => {
  const from = [1, 2, 3];
  const to = [5, 9, 12];
  assert.deepEqual(defaultFaceUv('down', from, to), [1, 4, 5, 13]);
  assert.deepEqual(defaultFaceUv('up', from, to), [1, 3, 5, 12]);
  assert.deepEqual(defaultFaceUv('north', from, to), [11, 7, 15, 14]);
  assert.deepEqual(defaultFaceUv('south', from, to), [1, 7, 5, 14]);
  assert.deepEqual(defaultFaceUv('west', from, to), [3, 7, 12, 14]);
  assert.deepEqual(defaultFaceUv('east', from, to), [4, 7, 13, 14]);
});

test('PNG-Größe, Animationen und Texturauswahl', () => {
  assert.deepEqual(readPngSize(pngHeader(16, 512)), { width: 16, height: 512 });
  assert.throws(() => readPngSize(Buffer.from('GIF89a........................')), /keine PNG/);

  assert.equal(parseAnimation(undefined, 16, 16), null);
  assert.deepEqual(parseAnimation({ frametime: 2 }, 16, 64), { fw: 16, fh: 16, frames: [[0, 2], [1, 2], [2, 2], [3, 2]], interpolate: false });
  assert.deepEqual(parseAnimation({ frames: [1, { index: 0, time: 5 }], interpolate: true }, 16, 32), { fw: 16, fh: 16, frames: [[1, 1], [0, 5]], interpolate: true });
  assert.deepEqual(parseAnimation({ height: 8 }, 32, 16).frames, [[0, 1], [1, 1]]);
  assert.deepEqual(parseAnimation({ width: 8 }, 16, 16), { fw: 8, fh: 16, frames: [[0, 1], [1, 1]], interpolate: false });
  assert.deepEqual(parseAnimation({}, 32, 16).fw, 16, 'ohne Angabe: Quadrat mit der kürzeren Seite');
  assert.throws(() => parseAnimation({ frames: [5] }, 16, 32), /außerhalb/);
  assert.throws(() => parseAnimation({ frametime: 0 }, 16, 32), /frametime/);
  assert.throws(() => parseAnimation({ width: 7 }, 16, 16), /kein Vielfaches/);

  assert.ok(isIncludedTexture('block/stone'));
  assert.ok(isIncludedTexture('entity/chest/normal'));
  assert.ok(isIncludedTexture('entity/banner/banner_base'));
  assert.ok(isIncludedTexture('entity/player/wide/steve'));
  assert.ok(!isIncludedTexture('entity/pig/pig'));
  assert.ok(!isIncludedTexture('gui/title/minecraft'));

  const warnings = createWarnings();
  const assets = memoryAssets({
    [`${T}block/water_still.png`]: pngHeader(16, 32),
    [`${T}block/water_still.png.mcmeta`]: { animation: { frametime: 2 } },
    [`${T}block/oak_leaves.png`]: pngHeader(16, 16),
    [`${T}block/oak_leaves.png.mcmeta`]: { texture: { mipmap_strategy: 'dark_cutout' } },
    [`${T}block/kaputt.png`]: Buffer.from('nicht png'),
    [`${T}entity/pig/pig.png`]: pngHeader(64, 64),
  });
  const result = buildTextures({ assets, referenced: [], warnings });
  const entries = plain(result.data.entries);
  assert.deepEqual(Object.keys(entries), ['block/oak_leaves', 'block/water_still']);
  assert.deepEqual(entries['block/oak_leaves'], { o: 0, l: 33, w: 16, h: 16, anim: null, mip: 'dark_cutout' });
  assert.deepEqual(entries['block/water_still'], { o: 33, l: 33, w: 16, h: 32, anim: { fw: 16, fh: 16, frames: [[0, 2], [1, 2]], interpolate: false } });
  assert.equal(result.bin.length, 66);
  assert.ok(warnings.list.some((w) => /block\/kaputt übersprungen/.test(w)));
});

test('Zustände formatieren: Eigenschaften sortiert', () => {
  assert.equal(formatState('oak_stairs', { half: 'top', facing: 'east' }), 'oak_stairs[facing=east,half=top]');
});

test('Keine Original-Strukturen mehr: das Skript wandelt keine Strukturen um', () => {
  for (const name of ['parseStateString', 'createStateNormalizer', 'convertStructure', 'encodeRle', 'structureFileName']) {
    assert.equal(name in extractScript, false, name);
  }
});

// ---------------------------------------------------------------------------------------------
// Erzeugte Dateien in game-data/ (nur, wenn die Extraktion schon gelaufen ist)

const hasGameData = fs.existsSync(path.join(GAME_DATA, 'meta.json'));
const dataTest = hasGameData ? test : test.skip;
const SKIP_HINT = hasGameData ? '' : ' (übersprungen: zuerst „node scripts/extract-game-data.mjs“ ausführen)';
const readGameJson = (name) => JSON.parse(fs.readFileSync(path.join(GAME_DATA, name), 'utf8'));

dataTest(`game-data: meta.json und names.json${SKIP_HINT}`, () => {
  const meta = readGameJson('meta.json');
  assert.equal(meta.version, '26.2');
  assert.equal(meta.worldVersion, 4903);
  assert.ok(!Number.isNaN(Date.parse(meta.extractedAt)));
  assert.ok(meta.counts.blocks > 1000 && meta.counts.models > 1000 && meta.counts.textures > 1000, JSON.stringify(meta.counts));
  assert.ok(Array.isArray(meta.warnings));

  const names = readGameJson('names.json');
  assert.deepEqual(names.block.stone_bricks, { de: 'Steinziegel', en: 'Stone Bricks' });
  assert.equal(names.block.oak_planks.en, 'Oak Planks');
  assert.equal(names.item.redstone.en, 'Redstone Dust');
  assert.ok(names.block.repeater.de && names.block.redstone_wire.de);
  assert.ok(Object.keys(names.block).every((id) => /^[a-z0-9_]+$/.test(id)));
});

dataTest(`game-data: blocks.json${SKIP_HINT}`, () => {
  const blocks = readGameJson('blocks.json');
  assert.equal(blocks.version, '26.2');
  if (blocks.source === 'mcmeta') {
    assert.deepEqual(blocks.blocks.oak_stairs, {
      props: { facing: ['north', 'south', 'west', 'east'], half: ['top', 'bottom'], shape: ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'], waterlogged: ['true', 'false'] },
      default: { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' },
    });
  } else {
    assert.equal(blocks.source, 'derived');
  }
  for (const [id, block] of Object.entries(blocks.blocks)) {
    for (const [prop, value] of Object.entries(block.default)) assert.ok(block.props[prop].includes(value), `${id}.${prop}`);
  }
});

dataTest(`game-data: models.json${SKIP_HINT}`, () => {
  const models = readGameJson('models.json');
  const textures = readGameJson('textures.json');
  const modelOf = (id, i = 0) => models.models[(models.blocks[id].variants ?? models.blocks[id].multipart)[i].apply[0].model];

  const stone = modelOf('stone');
  assert.equal(stone.elements.length, 1);
  const faces = Object.entries(stone.elements[0].faces);
  assert.equal(faces.length, 6);
  for (const [direction, face] of faces) {
    assert.equal(face.cull, direction);
    assert.equal(models.textures[face.tex], 'block/stone');
  }
  assert.equal(models.blocks.oak_stairs.variants.length, 40);
  const fence = models.blocks.oak_fence.multipart;
  assert.equal(fence[0].when, null);
  assert.deepEqual(fence.slice(1).map((part) => part.when), [{ north: ['true'] }, { east: ['true'] }, { south: ['true'] }, { west: ['true'] }]);
  assert.deepEqual(modelOf('chest').elements, []);
  assert.equal(models.textures[modelOf('chest').particle], 'block/oak_planks');

  for (const definition of Object.values(models.blocks)) {
    for (const part of definition.variants ?? definition.multipart) {
      for (const apply of part.apply) assert.ok(apply.model >= 0 && apply.model < models.models.length);
    }
  }
  for (const model of models.models) {
    assert.ok(model.particle >= -1 && model.particle < models.textures.length, model.name);
    for (const element of model.elements) {
      if (element.rotation) assert.equal(element.rotation.matrix.length, 9, model.name);
      for (const face of Object.values(element.faces)) assert.ok(face.tex >= -1 && face.tex < models.textures.length, model.name);
    }
  }
  for (const name of models.textures) assert.ok(textures.entries[name], `Textur ${name} fehlt in textures.json`);
});

dataTest(`game-data: textures.json + textures.bin${SKIP_HINT}`, () => {
  const textures = readGameJson('textures.json');
  const bin = fs.readFileSync(path.join(GAME_DATA, 'textures.bin'));
  let offset = 0;
  for (const [name, entry] of Object.entries(textures.entries)) {
    assert.equal(entry.o, offset, name);
    assert.equal(bin.readUInt32BE(entry.o), 0x89504e47, `${name} beginnt nicht mit PNG-Signatur`);
    assert.equal(bin.readUInt32BE(entry.o + 16), entry.w, name);
    offset += entry.l;
  }
  assert.equal(offset, bin.length);
  const water = textures.entries['block/water_still'];
  assert.equal(water.anim.fw, 16);
  assert.equal(water.anim.frames.length, water.h / 16);
  assert.ok(water.anim.frames.every(([, ticks]) => ticks === 2));
  assert.equal(textures.entries['block/stone'].anim, null);
});
