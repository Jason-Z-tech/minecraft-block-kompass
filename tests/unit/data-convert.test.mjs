// Reine Umwandlung (js/data/convert.js) und Blockfarben-Kern (js/data/block-colors.js): ohne Node-Importe, laufen im
// echten Chrome genau wie in Node, Strukturnamen hin und zurück, textureEntry wie buildTextures, Assets aus der
// mcmeta-Zusammenfassung, Blockfarben aus vorher dekodierten Bildern. Die Prüfungen mit Spieldaten laufen nur mit
// game-data/ (node scripts/extract-game-data.mjs), der Browser-Teil nur mit Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as convert from '../../js/data/convert.js';
import * as blockColors from '../../js/data/block-colors.js';
import { buildTextures, buildModels as scriptBuildModels, structureFileName as scriptStructureFileName, readPngSize as scriptReadPngSize } from '../../scripts/extract-game-data.mjs';
import { buildBlockColors } from '../../scripts/build-block-colors.mjs';
import { decodePng } from '../../scripts/lib/png.mjs';
import { openZip } from '../../scripts/lib/zip.mjs';
import { archiveAssets } from '../../scripts/lib/remote-source.mjs';
import { extractJsReferences, tokenize } from '../../scripts/check-imports.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME = path.join(ROOT, 'game-data');
const OWN_MODULES = ['js/data/convert.js', 'js/data/block-colors.js'];
const T = 'assets/minecraft/textures/';
const hasGameFiles = (...names) => names.every((name) => fs.existsSync(path.join(GAME, name)));
const NO_GAME_DATA = 'game-data/ fehlt (node scripts/extract-game-data.mjs)';

// Objekte ohne Prototyp in normale JSON-Werte verwandeln.
const plain = (value) => JSON.parse(JSON.stringify(value));
const withoutTime = (colors) => ({ ...colors, generatedAt: null });

function pngHeader(width, height) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

// Gleiche Schnittstelle wie createJarAssets (Jar), Daten im Speicher.
function memoryAssets(files) {
  const map = new Map(Object.entries(files).map(([name, content]) => [
    name, content instanceof Uint8Array ? content : new TextEncoder().encode(typeof content === 'string' ? content : JSON.stringify(content)),
  ]));
  return {
    has: (name) => map.has(name),
    list: (prefix) => [...map.keys()].filter((name) => name.startsWith(prefix)).sort(),
    read: (name) => {
      if (!map.has(name)) throw new Error(`fehlt: ${name}`);
      return map.get(name);
    },
    readJson: (name) => JSON.parse(new TextDecoder().decode(map.get(name))),
  };
}

const CUBE_FACES = Object.fromEntries(['down', 'up', 'north', 'south', 'west', 'east'].map((d) => [d, { texture: '#all', cullface: d }]));
const SUMMARY_BLOCKSTATES = {
  stone: { variants: { '': { model: 'minecraft:block/stone' } } },
  dirt: { variants: { '': [{ model: 'block/dirt' }, { model: 'block/dirt', y: 90 }] } },
};
const SUMMARY_MODELS = {
  'block/cube': { elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: CUBE_FACES }] },
  'block/cube_all': { parent: 'block/cube', textures: { particle: '#all' } },
  'block/stone': { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } },
  'block/dirt': { parent: 'block/cube_all', textures: { all: 'block/dirt' } },
  'item/stick': { parent: 'item/generated', textures: { layer0: 'item/stick' } },
};
const SUMMARY_TEXTURES = ['block/stone', 'block/dirt', 'item/stick'];
const SUMMARY_BLOCKS = { stone: { props: {}, default: {} }, dirt: { props: {}, default: {} } };

// Läuft in Node und (als Quelltext) im Browser mit denselben Eingaben: c = convert.js, bc = block-colors.js.
function probe(c, bc, pngBytes) {
  const warnings = c.createWarnings();
  const png = Uint8Array.from(pngBytes);
  const padded = new Uint8Array(png.length + 7);
  padded.set(png, 7);
  const errorOf = (fn) => {
    try {
      fn();
      return null;
    } catch (error) {
      return error.message;
    }
  };
  const faces = Object.fromEntries(c.DIRECTIONS.map((d) => [d, { texture: '#all', cullface: d }]));
  const assets = c.createAssetsFromSummary({
    blockstates: { stone: { variants: { '': { model: 'minecraft:block/stone' } } } },
    models: {
      'block/cube': { elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces }] },
      'block/cube_all': { parent: 'block/cube', textures: { particle: '#all' } },
      'block/stone': { parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } },
    },
    textureNames: ['block/stone'],
  });
  const blocks = { stone: { props: {}, default: {} } };
  const models = c.buildModels({ assets, blockstates: c.loadBlockstates(assets, warnings), blocks, warnings }).data;
  const image = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) };
  for (let i = 0; i < 256; i++) image.data.set([200, 40, 10, 255], i * 4);
  const colorInput = { modelsJson: models, blocksJson: { blocks }, texturesJson: { entries: { 'block/stone': { w: 16, h: 16, anim: null } } } };
  const colors = bc.buildBlockColorsFrom({ ...colorInput, textureImage: () => image });
  const meta = new TextEncoder().encode('﻿{"animation":{"frametime":2,"interpolate":true},"texture":{"mipmap_strategy":"cutout"}}');
  return JSON.parse(JSON.stringify({
    path: c.structurePathFromFile('village__plains__houses__plains_small_house_1.json'),
    file: c.structureFileName('village/plains/houses/plains_small_house_1'),
    invalid: errorOf(() => c.structurePathFromFile('../evil.json')),
    size: c.readPngSize(png),
    sizeFromArrayBuffer: c.readPngSize(png.buffer),
    sizeWithOffset: c.readPngSize(padded.subarray(7)),
    notPng: errorOf(() => c.readPngSize(new Uint8Array(30))),
    entry: c.textureEntry({ name: 'block/fire_0', width: 16, height: 32, meta, warnings }),
    broken: c.textureEntry({ name: 'block/kaputt', width: 16, height: 16, meta: '{nicht json', warnings }),
    names: c.buildNames({ 'block.minecraft.stone': 'Stone', 'item.minecraft.stick': 'Stick' }, { 'block.minecraft.stone': 'Stein' }),
    state: c.formatState('oak_stairs', { half: 'top', facing: 'east' }),
    models,
    colorTextures: bc.blockColorTextureNames(colorInput),
    colors: { ...colors, generatedAt: null },
    group: bc.blockGroup('red_concrete'),
    summary: bc.summarizeSamples([Float64Array.from([0, 0, 0, 1, 1, 1])]),
    // JSON-Fehlertexte unterscheiden sich je nach JS-Engine-Version: nur den Rahmen vergleichen.
    warnings: warnings.list.map((message) => message.replace(/unbrauchbar \(.*\) – /, 'unbrauchbar (…) – ')),
  }));
}

// ---------------------------------------------------------------------------------------------
// (a) ohne Node

const FORBIDDEN_GLOBALS = new Set(['Buffer', 'process', 'require', 'module', 'exports', '__dirname', '__filename', 'global', 'setImmediate']);

test('convert.js und block-colors.js: keine Node- oder Paket-Importe, keine Node-Globale', () => {
  for (const file of OWN_MODULES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const refs = extractJsReferences(source);
    for (const ref of refs) {
      assert.match(ref.spec, /^\.\.?\/.+\.js$/, `${file}:${ref.line} importiert „${ref.spec}“ – nur relative .js-Module sind erlaubt`);
    }
    const tokens = tokenize(source);
    tokens.forEach((token, i) => {
      const property = tokens[i - 1]?.type === 'punct' && tokens[i - 1].value === '.';
      if (token.type === 'ident' && !property) assert.ok(!FORBIDDEN_GLOBALS.has(token.value), `${file}:${token.line} nutzt „${token.value}“`);
    });
    assert.ok(!/\bnode:/.test(refs.map((ref) => ref.spec).join(' ')));
  }
  assert.deepEqual(extractJsReferences(fs.readFileSync(path.join(ROOT, 'js/data/convert.js'), 'utf8')), [], 'convert.js braucht gar keine Importe');
});

test('auch alle Module, die block-colors.js lädt, kommen ohne Node- und Paket-Importe aus', () => {
  const seen = new Set();
  const queue = [...OWN_MODULES];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const ref of extractJsReferences(source)) {
      if (ref.kind !== 'import' && ref.kind !== 'export' && ref.kind !== 'import()') continue;
      assert.match(ref.spec, /^\.\.?\/.+\.js$/, `${file}:${ref.line} importiert „${ref.spec}“`);
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), ref.spec)));
    }
  }
  for (const needed of ['js/render/block-models.js', 'js/render/texture-store.js', 'js/core/blockstate.js', 'js/create/voxelize/colors.js']) {
    assert.ok(seen.has(needed), `${needed} fehlt im Importgraphen`);
  }
});

test('die Skripte nutzen den Kern und exportieren weiter dieselben Funktionen', () => {
  assert.equal(scriptStructureFileName, convert.structureFileName);
  assert.equal(scriptReadPngSize, convert.readPngSize);
  assert.equal(scriptBuildModels, convert.buildModels);
  const extract = fs.readFileSync(path.join(ROOT, 'scripts', 'extract-game-data.mjs'), 'utf8');
  assert.match(extract, /from '\.\.\/js\/data\/convert\.js';/);
  assert.ok(!/^export function (buildModels|convertStructure|parseAnimation|readPngSize)\b/m.test(extract), 'Umwandlung nicht doppelt im Skript');
  const colors = fs.readFileSync(path.join(ROOT, 'scripts', 'build-block-colors.mjs'), 'utf8');
  assert.match(colors, /from '\.\.\/js\/data\/block-colors\.js';/);
  assert.ok(!/function sampleSide/.test(colors), 'Abtastung nicht doppelt im Skript');
});

// ---------------------------------------------------------------------------------------------
// (b) im echten Chrome

async function openBrowser(t) {
  const { launchBrowser } = await import('../browser.mjs');
  try {
    return await launchBrowser({ gpu: 'swiftshader' });
  } catch (error) {
    if (/Kein Chrome/.test(error.message)) {
      t.skip(error.message);
      return null;
    }
    throw error;
  }
}

test('beide Module laden im echten Chrome (CSP der Seite) und rechnen dort genau wie in Node', { timeout: 120_000 }, async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  const { startServer } = await import('../../scripts/serve.mjs');
  const server = await startServer({ port: 0 });
  try {
    await browser.goto(`${server.url}/index.html`);
    const png = [...pngHeader(16, 512)];
    const inBrowser = await browser.eval(`(async () => {
      const [c, bc] = await Promise.all([import('/js/data/convert.js'), import('/js/data/block-colors.js')]);
      return (${probe.toString()})(c, bc, ${JSON.stringify(png)});
    })()`);
    const inNode = probe(convert, blockColors, png);
    assert.deepEqual(inBrowser, inNode);
    // Stichproben, damit der Vergleich nicht zwei gleich falsche Ergebnisse durchwinkt
    assert.equal(inNode.path, 'village/plains/houses/plains_small_house_1');
    assert.equal(inNode.file, 'village__plains__houses__plains_small_house_1.json');
    assert.match(inNode.invalid, /Ungültiger Strukturname/);
    assert.deepEqual(inNode.size, { width: 16, height: 512 });
    assert.deepEqual(inNode.sizeFromArrayBuffer, inNode.size);
    assert.deepEqual(inNode.sizeWithOffset, inNode.size);
    assert.equal(inNode.notPng, 'keine PNG-Datei');
    assert.deepEqual(inNode.entry, { w: 16, h: 32, anim: { fw: 16, fh: 16, frames: [[0, 2], [1, 2]], interpolate: true }, mip: 'cutout' });
    assert.deepEqual(inNode.broken, { w: 16, h: 16, anim: null });
    assert.deepEqual(inNode.names, { block: { stone: { de: 'Stein', en: 'Stone' } }, item: { stick: { de: null, en: 'Stick' } } });
    assert.deepEqual(inNode.colorTextures, ['block/stone']);
    assert.deepEqual(inNode.colors.blocks.stone.side.rgb, [200, 40, 10]);
    assert.deepEqual(inNode.warnings, ['Textur block/kaputt: .mcmeta unbrauchbar (…) – ohne Animation übernommen.']);
    const ownErrors = browser.errors.filter((message) => /js\/data\//.test(message));
    assert.deepEqual(ownErrors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});

test('Blockfarben im Browser: Texturen vorab asynchron dekodiert → genau game-data/block-colors.json', {
  timeout: 180_000,
  skip: hasGameFiles('models.json', 'blocks.json', 'textures.json', 'textures.bin', 'block-colors.json') ? false : NO_GAME_DATA,
}, async (t) => {
  const browser = await openBrowser(t);
  if (!browser) return;
  const { startServer } = await import('../../scripts/serve.mjs');
  const server = await startServer({ port: 0 });
  try {
    await browser.goto(`${server.url}/index.html`);
    const text = await browser.eval(`(async () => {
      const [{ buildBlockColorsFrom, collectBlockColorTextures }, { decodePng }] = await Promise.all([
        import('/js/data/block-colors.js'), import('/js/render/texture-store.js')]);
      const get = async (name) => {
        const response = await fetch('/game-data/' + name);
        if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
        return response;
      };
      const [modelsJson, blocksJson, texturesJson] = await Promise.all(['models.json', 'blocks.json', 'textures.json'].map(async (name) => (await get(name)).json()));
      const bin = new Uint8Array(await (await get('textures.bin')).arrayBuffer());
      const names = await collectBlockColorTextures({ modelsJson, blocksJson });
      const images = new Map();
      await Promise.all(names.map(async (name) => {
        const entry = texturesJson.entries[name];
        images.set(name, await decodePng(bin.subarray(entry.o, entry.o + entry.l)));
      }));
      const asked = new Set();
      const result = buildBlockColorsFrom({ modelsJson, blocksJson, texturesJson, textureImage: (name) => { asked.add(name); return images.get(name); } });
      return JSON.stringify({ colors: { ...result, generatedAt: null }, names, asked: [...asked].sort() });
    })()`);
    const { colors, names, asked } = JSON.parse(text);
    assert.deepEqual(asked, names, 'genau die vorab genannten Texturen werden gebraucht');
    const expected = JSON.parse(fs.readFileSync(path.join(GAME, 'block-colors.json'), 'utf8'));
    assert.deepEqual(colors, withoutTime(expected));
  } finally {
    await browser.close();
    await server.close();
  }
});

// ---------------------------------------------------------------------------------------------
// (c) Strukturnamen

test('structurePathFromFile kehrt structureFileName um und lehnt alles andere ab', () => {
  for (const structurePath of ['igloo/top', 'village/plains/houses/plains_small_house_1', 'shipwreck/rightsideup_backhalf_degraded', 'a', 'a1/b_2/c3']) {
    const file = convert.structureFileName(structurePath);
    assert.equal(convert.structurePathFromFile(file), structurePath);
  }
  if (hasGameFiles('structures/index.json')) {
    const index = JSON.parse(fs.readFileSync(path.join(GAME, 'structures', 'index.json'), 'utf8'));
    assert.ok(index.structures.length > 1000);
    for (const { path: structurePath, file } of index.structures) {
      assert.equal(convert.structureFileName(structurePath), file);
      assert.equal(convert.structurePathFromFile(file), structurePath);
    }
  }
  const invalid = [
    '', 'x', 'igloo__top', 'igloo__top.nbt', 'igloo__top.JSON', '.json', '__a.json', 'a__.json', 'a___b.json', '_a.json', 'a_.json',
    'a__b.json.json', '../x.json', '..__x.json', 'a/b.json', 'a\\b.json', 'A__b.json', 'a b.json', 'ä.json', 'a%2fb.json', 'a-b.json',
    'a.b.json', `${'a'.repeat(300)}.json`, null, undefined, 5, {}, ['a.json'],
  ];
  for (const file of invalid) {
    assert.throws(() => convert.structurePathFromFile(file), /Ungültiger Strukturname/, `„${String(file).slice(0, 40)}“ müsste abgelehnt werden`);
  }
});

// ---------------------------------------------------------------------------------------------
// (d) textureEntry wie buildTextures

test('textureEntry ergibt dieselben Einträge und Warnungen wie buildTextures (Animation, interpolate, frames, mipmap_strategy, kaputt)', () => {
  const cases = {
    'block/water_still': { size: [16, 64], meta: { animation: { frametime: 2 } } },
    'block/fire_0': { size: [16, 32], meta: { animation: { interpolate: true, frames: [1, { index: 0, time: 5 }] } } },
    'block/wide': { size: [32, 16], meta: { animation: { width: 16 } } },
    'block/oak_leaves': { size: [16, 16], meta: { texture: { mipmap_strategy: 'dark_cutout' } } },
    'block/glass': { size: [16, 16] },
    'block/half_broken': { size: [16, 32], meta: { texture: { mipmap_strategy: 'cutout' }, animation: { frames: [7] } } },
    'block/zero_frametime': { size: [16, 32], meta: { animation: { frametime: 0 } } },
    'block/broken_json': { size: [16, 16], meta: '{kaputt' },
    'block/null_meta': { size: [16, 16], meta: 'null' },
  };
  const files = {};
  for (const [name, { size, meta }] of Object.entries(cases)) {
    files[`${T}${name}.png`] = pngHeader(...size);
    if (meta !== undefined) files[`${T}${name}.png.mcmeta`] = meta;
  }
  const assets = memoryAssets(files);
  const scriptWarnings = convert.createWarnings();
  const built = buildTextures({ assets, referenced: [], warnings: scriptWarnings });
  assert.deepEqual(Object.keys(built.data.entries), Object.keys(cases).sort());

  // Mit Lesefunktion (so nutzt es buildTextures): Einträge und Warnungen exakt gleich, Reihenfolge der Felder inklusive
  const ownWarnings = convert.createWarnings();
  for (const name of Object.keys(cases).sort()) {
    const metaName = `${T}${name}.png.mcmeta`;
    const [width, height] = cases[name].size;
    const meta = assets.has(metaName) ? () => assets.readJson(metaName) : undefined;
    const entry = convert.textureEntry({ name, width, height, meta, warnings: ownWarnings });
    const { o, l, ...rest } = built.data.entries[name];
    assert.equal(typeof o, 'number');
    assert.equal(l, 33);
    assert.deepEqual(plain(entry), plain(rest), name);
    assert.deepEqual(Object.keys(entry), Object.keys(rest), `${name}: Feldreihenfolge`);
  }
  assert.deepEqual(ownWarnings.list, scriptWarnings.list);
  assert.equal(built.animated, 3);

  // Einzelfälle wie im Spiel
  const entries = built.data.entries;
  assert.deepEqual(plain(entries['block/water_still']), { o: entries['block/water_still'].o, l: 33, w: 16, h: 64, anim: { fw: 16, fh: 16, frames: [[0, 2], [1, 2], [2, 2], [3, 2]], interpolate: false } });
  assert.deepEqual(entries['block/fire_0'].anim, { fw: 16, fh: 16, frames: [[1, 1], [0, 5]], interpolate: true });
  assert.deepEqual(entries['block/wide'].anim.frames, [[0, 1], [1, 1]]);
  assert.deepEqual(Object.keys(entries['block/oak_leaves']), ['o', 'l', 'w', 'h', 'anim', 'mip']);
  assert.equal(entries['block/oak_leaves'].mip, 'dark_cutout');
  assert.deepEqual(Object.keys(entries['block/glass']), ['o', 'l', 'w', 'h', 'anim']);
  assert.equal(entries['block/half_broken'].mip, 'cutout', 'mipmap_strategy bleibt, auch wenn die Animation kaputt ist');
  assert.equal(entries['block/half_broken'].anim, null);
  assert.equal(entries['block/null_meta'].anim, null);
  assert.equal(scriptWarnings.list.length, 3);
  assert.match(scriptWarnings.list.join('\n'), /Textur block\/half_broken: \.mcmeta unbrauchbar \(Frame 7 außerhalb von 0…1\) – ohne Animation übernommen\./);
  assert.match(scriptWarnings.list.join('\n'), /Textur block\/zero_frametime: \.mcmeta unbrauchbar \(frametime 0 ungültig\)/);
  assert.match(scriptWarnings.list.join('\n'), /Textur block\/broken_json: \.mcmeta unbrauchbar/);

  // Andere Formen von meta (Browser: Bytes, Text oder schon gelesenes JSON) geben dieselben Einträge
  for (const name of Object.keys(cases)) {
    const { size: [width, height], meta } = cases[name];
    const raw = meta === undefined ? undefined : (typeof meta === 'string' ? meta : JSON.stringify(meta));
    const forms = raw === undefined ? [undefined] : [raw, new TextEncoder().encode(raw), new TextEncoder().encode(raw).buffer];
    if (raw !== undefined && typeof meta !== 'string') forms.push(structuredClone(meta));
    if (meta === 'null') forms.push(null);
    for (const form of forms) {
      const warnings = convert.createWarnings();
      const entry = convert.textureEntry({ name, width, height, meta: form, warnings });
      const { o, l, ...expected } = built.data.entries[name];
      assert.deepEqual(plain(entry), plain(expected), `${name} (${form?.constructor?.name ?? form})`);
      assert.equal(warnings.list.length, scriptWarnings.list.filter((message) => message.startsWith(`Textur ${name}:`)).length, `${name}: Warnungen`);
    }
  }
  // Kaputtes JSON aus Bytes: Meldung nennt die Datei, BOM wird übersprungen
  const warnings = convert.createWarnings();
  convert.textureEntry({ name: 'block/x', width: 16, height: 16, meta: new TextEncoder().encode('{kaputt'), warnings });
  assert.match(warnings.list[0], /^Textur block\/x: \.mcmeta unbrauchbar \(block\/x\.png\.mcmeta: ungültiges JSON \(/);
  const bom = convert.textureEntry({ name: 'block/y', width: 16, height: 16, meta: new TextEncoder().encode('﻿{"texture":{"mipmap_strategy":"mean"}}'), warnings });
  assert.equal(bom.mip, 'mean');
  assert.equal(warnings.list.length, 1);
  assert.throws(() => convert.textureEntry({ name: 'block/z', width: 16, height: 16, meta: '{', warnings: undefined }), TypeError, 'ohne warnings kein stilles Verschlucken');
});

test('readPngSize ohne Node-Puffer: Uint8Array, ArrayBuffer, Teilansichten; Fehler wie bisher', () => {
  assert.deepEqual(convert.readPngSize(pngHeader(16, 512)), { width: 16, height: 512 });
  assert.deepEqual(convert.readPngSize(Buffer.from(pngHeader(64, 32))), { width: 64, height: 32 }, 'Node-Puffer geht weiter');
  assert.deepEqual(convert.readPngSize(pngHeader(2, 3).buffer), { width: 2, height: 3 });
  const big = new Uint8Array(100);
  big.set(pngHeader(20, 40), 11);
  assert.deepEqual(convert.readPngSize(big.subarray(11)), { width: 20, height: 40 });
  assert.throws(() => convert.readPngSize(new TextEncoder().encode('GIF89a........................')), /keine PNG/);
  assert.throws(() => convert.readPngSize(pngHeader(16, 16).subarray(0, 20)), /keine PNG/);
  assert.throws(() => convert.readPngSize('\x89PNG'), /keine PNG/);
  assert.throws(() => convert.readPngSize([0x89, 0x50, 0x4e, 0x47]), /keine PNG/);
  const noIhdr = pngHeader(16, 16);
  noIhdr.set([0x49, 0x44, 0x41, 0x54], 12);
  assert.throws(() => convert.readPngSize(noIhdr), /ohne IHDR/);
  assert.throws(() => convert.readPngSize(pngHeader(0, 16)), /unplausible Bildgröße 0×16/);
  assert.throws(() => convert.readPngSize(pngHeader(16, 16385)), /unplausible/);
  assert.throws(() => convert.readPngSize(pngHeader(0xffffffff, 16)), /unplausible Bildgröße 4294967295×16/);
});

test('selectTextureNames: genutzte plus vorhandene nach den Mustern, sortiert', () => {
  const names = convert.selectTextureNames(['block/zzz', 'item/apple', 'block/zzz'], ['block/stone', 'gui/title', 'entity/pig/pig', 'block/Bad Name', 'entity/chest/normal']);
  assert.deepEqual(names, ['block/stone', 'block/zzz', 'entity/chest/normal', 'item/apple']);
});

// ---------------------------------------------------------------------------------------------
// (e) Assets aus der mcmeta-Zusammenfassung

test('createAssetsFromSummary: has/list/readJson/read wie die Jar-Assets, buildModels gleich', () => {
  const assets = convert.createAssetsFromSummary({ blockstates: SUMMARY_BLOCKSTATES, models: SUMMARY_MODELS, textureNames: SUMMARY_TEXTURES });
  assert.ok(assets.has('assets/minecraft/blockstates/stone.json'));
  assert.ok(assets.has('assets/minecraft/models/block/cube_all.json'));
  assert.ok(assets.has('assets/minecraft/models/item/stick.json'));
  assert.ok(assets.has('assets/minecraft/textures/block/stone.png'));
  assert.ok(!assets.has('assets/minecraft/textures/block/gravel.png'));
  assert.ok(!assets.has('assets/minecraft/textures/block/stone.png.mcmeta'));
  assert.ok(!assets.has('assets/minecraft/blockstates/gravel.json'));
  assert.ok(!assets.has('assets/minecraft/models/block/stone'));
  assert.deepEqual(assets.list('assets/minecraft/blockstates/'), ['assets/minecraft/blockstates/dirt.json', 'assets/minecraft/blockstates/stone.json']);
  assert.deepEqual(assets.list('assets/minecraft/textures/'), ['assets/minecraft/textures/block/dirt.png', 'assets/minecraft/textures/block/stone.png', 'assets/minecraft/textures/item/stick.png']);
  assert.deepEqual(assets.list('assets/minecraft/models/item/'), ['assets/minecraft/models/item/stick.json']);
  assert.deepEqual(assets.readJson('assets/minecraft/models/block/stone.json'), SUMMARY_MODELS['block/stone']);
  assert.throws(() => assets.readJson('assets/minecraft/models/block/gravel.json'), /fehlt/);
  assert.throws(() => assets.read('assets/minecraft/textures/block/stone.png'), /nur JSON/);

  // Gleiche Dateien als „Jar“ → gleiche Blockstates und gleiches models.json
  const jarFiles = {};
  for (const [id, definition] of Object.entries(SUMMARY_BLOCKSTATES)) jarFiles[`assets/minecraft/blockstates/${id}.json`] = definition;
  for (const [name, model] of Object.entries(SUMMARY_MODELS)) jarFiles[`assets/minecraft/models/${name}.json`] = model;
  for (const name of SUMMARY_TEXTURES) jarFiles[`${T}${name}.png`] = pngHeader(16, 16);
  const jar = memoryAssets(jarFiles);
  const run = (source) => {
    const warnings = convert.createWarnings();
    const blockstates = convert.loadBlockstates(source, warnings);
    const result = convert.buildModels({ assets: source, blockstates, blocks: SUMMARY_BLOCKS, warnings });
    return { blockstates: [...blockstates.keys()], json: JSON.stringify(result.data), warnings: warnings.list };
  };
  const fromSummary = run(assets);
  assert.deepEqual(fromSummary, run(jar));
  assert.deepEqual(fromSummary.blockstates, ['dirt', 'stone']);
  assert.deepEqual(JSON.parse(fromSummary.json).textures, ['block/dirt', 'block/stone']);
  assert.deepEqual(fromSummary.warnings, []);

  // Map statt Objekt geht genauso; Unsinn wird abgelehnt
  const fromMaps = convert.createAssetsFromSummary({
    blockstates: new Map(Object.entries(SUMMARY_BLOCKSTATES)), models: new Map(Object.entries(SUMMARY_MODELS)), textureNames: new Set(SUMMARY_TEXTURES),
  });
  assert.deepEqual(run(fromMaps), fromSummary);
  assert.throws(() => convert.createAssetsFromSummary({ blockstates: null, models: SUMMARY_MODELS }), /Blockstates: kein Objekt/);
  assert.throws(() => convert.createAssetsFromSummary({ blockstates: SUMMARY_BLOCKSTATES, models: [] }), /Modelle: kein Objekt/);
  // Ungültige Blockstate-Namen und Nicht-Objekte meldet loadBlockstates wie bei der Jar
  const odd = convert.createAssetsFromSummary({ blockstates: { 'Bad-Name': {}, broken: 'x', stone: SUMMARY_BLOCKSTATES.stone }, models: {} });
  const warnings = convert.createWarnings();
  assert.deepEqual([...convert.loadBlockstates(odd, warnings).keys()], ['stone']);
  assert.equal(warnings.list.length, 2);
  // Fremde Schlüssel wie „__proto__“ bleiben harmlos
  const proto = convert.createAssetsFromSummary({ blockstates: JSON.parse('{"__proto__":{"variants":{}}}'), models: {} });
  assert.ok(proto.has('assets/minecraft/blockstates/__proto__.json'));
  assert.equal({}.variants, undefined);
});

const TINY_ZIP = path.join(GAME, '.cache', `mcmeta-${convert.MC_VERSION}-assets-tiny.zip`);

test('createAssetsFromSummary mit allen echten Blockstates und Modellen ergibt genau game-data/models.json', {
  skip: fs.existsSync(TINY_ZIP) && hasGameFiles('models.json', 'blocks.json') ? false : 'game-data/ oder game-data/.cache/…-assets-tiny.zip fehlt (node scripts/extract-game-data.mjs --remote)',
}, () => {
  const zip = archiveAssets(openZip(TINY_ZIP), 'assets-tiny');
  const blockstates = {};
  for (const entry of zip.list(convert.BLOCKSTATE_PREFIX)) {
    if (entry.endsWith('.json')) blockstates[entry.slice(convert.BLOCKSTATE_PREFIX.length, -'.json'.length)] = zip.readJson(entry);
  }
  const models = {};
  for (const entry of zip.list(convert.MODEL_PREFIX)) {
    if (entry.endsWith('.json')) models[entry.slice(convert.MODEL_PREFIX.length, -'.json'.length)] = zip.readJson(entry);
  }
  const textureNames = zip.list(convert.TEXTURE_PREFIX).filter((entry) => entry.endsWith('.png')).map((entry) => entry.slice(convert.TEXTURE_PREFIX.length, -'.png'.length));
  const assets = convert.createAssetsFromSummary({ blockstates, models, textureNames });
  const warnings = convert.createWarnings();
  const blocks = JSON.parse(fs.readFileSync(path.join(GAME, 'blocks.json'), 'utf8')).blocks;
  const result = convert.buildModels({ assets, blockstates: convert.loadBlockstates(assets, warnings), blocks, warnings });
  assert.ok(JSON.stringify(result.data) === fs.readFileSync(path.join(GAME, 'models.json'), 'utf8'), 'models.json weicht ab');
});

test('Blockbericht aus dem Cache: parseMcmetaReport + mcmetaBlocksData ergibt genau game-data/blocks.json', {
  skip: hasGameFiles('blocks.json', 'meta.json', `.cache/mcmeta-${convert.MCMETA_TAG}-version.json`, `.cache/mcmeta-${convert.MCMETA_TAG}-blocks.json`) ? false : NO_GAME_DATA,
}, () => {
  const read = (name) => fs.readFileSync(path.join(GAME, name), 'utf8');
  const meta = JSON.parse(read('meta.json'));
  if (meta.sources.blocks !== 'mcmeta') return;
  const texts = { version: read(`.cache/mcmeta-${convert.MCMETA_TAG}-version.json`), blocks: read(`.cache/mcmeta-${convert.MCMETA_TAG}-blocks.json`) };
  const blocks = convert.parseMcmetaReport(texts, meta.worldVersion);
  assert.ok(JSON.stringify(convert.mcmetaBlocksData(blocks)) === read('blocks.json'), 'blocks.json weicht ab');
  assert.throws(() => convert.parseMcmetaReport(texts, meta.worldVersion + 1), /erwartet 26\.2/);
});

// ---------------------------------------------------------------------------------------------
// (f) Blockfarben aus vorher dekodierten Bildern

test('buildBlockColorsFrom: klare Fehler bei fehlenden Eingaben oder kaputten Bildern', async () => {
  assert.throws(() => blockColors.buildBlockColorsFrom({}), /models\.json, blocks\.json, textures\.json und die Texturbilder werden gebraucht/);
  assert.throws(() => blockColors.blockColorTextureNames({}), /models\.json und blocks\.json werden gebraucht/);
  const assets = convert.createAssetsFromSummary({ blockstates: SUMMARY_BLOCKSTATES, models: SUMMARY_MODELS, textureNames: SUMMARY_TEXTURES });
  const warnings = convert.createWarnings();
  const modelsJson = convert.buildModels({ assets, blockstates: convert.loadBlockstates(assets, warnings), blocks: SUMMARY_BLOCKS, warnings }).data;
  const input = {
    modelsJson,
    blocksJson: { blocks: SUMMARY_BLOCKS },
    texturesJson: { entries: { 'block/stone': { w: 16, h: 16, anim: null }, 'block/dirt': { w: 16, h: 16, anim: null } } },
  };
  assert.deepEqual(blockColors.blockColorTextureNames(input), ['block/dirt', 'block/stone']);
  assert.deepEqual(await blockColors.collectBlockColorTextures(input), ['block/dirt', 'block/stone']);
  assert.throws(() => blockColors.buildBlockColorsFrom({ ...input, textureImage: () => null }), /Bild der Textur „block\/dirt“ fehlt oder ist kein RGBA-Bild/);
  assert.throws(() => blockColors.buildBlockColorsFrom({ ...input, textureImage: () => ({ width: 16, height: 16, data: new Uint8Array(10) }) }), /kein RGBA-Bild/);
  assert.throws(() => blockColors.buildBlockColorsFrom({ ...input, textureImage: () => ({ width: 8, height: 8, data: new Uint8Array(256) }) }), /PNG ist 8×8, textures\.json sagt 16×16/);
  const solid = (rgba) => ({ width: 16, height: 16, data: Uint8Array.from({ length: 16 * 16 * 4 }, (_, i) => rgba[i % 4]) });
  // decodeTexture ist derselbe Parameter (Name aus dem Bauplan)
  const colors = blockColors.buildBlockColorsFrom({ ...input, decodeTexture: (name) => solid(name === 'block/stone' ? [120, 120, 120, 255] : [130, 90, 60, 255]) });
  assert.equal(colors.count, 2);
  assert.deepEqual(colors.blocks.stone.all.rgb, [120, 120, 120]);
  assert.deepEqual(colors.blocks.dirt.top.rgb, [130, 90, 60]);
  assert.equal(colors.blocks.dirt.group, 'natur');
  assert.equal(colors.blocks.stone.group, 'stein');
});

test('buildBlockColorsFrom mit Bildern aus textures.bin ergibt genau game-data/block-colors.json', {
  skip: hasGameFiles('models.json', 'blocks.json', 'textures.json', 'textures.bin', 'block-colors.json') ? false : NO_GAME_DATA,
}, () => {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(GAME, name), 'utf8'));
  const modelsJson = read('models.json');
  const blocksJson = read('blocks.json');
  const texturesJson = read('textures.json');
  const bin = new Uint8Array(fs.readFileSync(path.join(GAME, 'textures.bin')));
  const names = blockColors.blockColorTextureNames({ modelsJson, blocksJson });
  assert.ok(names.length > 300 && names.every((name) => Object.hasOwn(texturesJson.entries, name)), `${names.length} Texturen`);
  const images = new Map(names.map((name) => {
    const entry = texturesJson.entries[name];
    return [name, decodePng(bin.subarray(entry.o, entry.o + entry.l))];
  }));
  const asked = new Set();
  const colors = blockColors.buildBlockColorsFrom({
    modelsJson, blocksJson, texturesJson, textureImage: (name) => {
      asked.add(name);
      return images.get(name);
    },
  });
  assert.deepEqual([...asked].sort(), names, 'blockColorTextureNames nennt genau die gebrauchten Texturen');
  // Byte für Byte wie die Datei (nur der Zeitstempel ist der aus der Datei)
  const fileText = fs.readFileSync(path.join(GAME, 'block-colors.json'), 'utf8');
  const { generatedAt } = JSON.parse(fileText);
  assert.ok(JSON.stringify({ ...colors, generatedAt }) === fileText, 'block-colors.json weicht ab');
  // Das Skript (textures.bin direkt) rechnet über denselben Kern dasselbe
  const viaScript = buildBlockColors({ modelsJson, blocksJson, texturesJson, texturesBin: bin });
  assert.ok(JSON.stringify({ ...viaScript, generatedAt }) === fileText, 'build-block-colors.mjs weicht ab');
});
