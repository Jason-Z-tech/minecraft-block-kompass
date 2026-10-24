// Blockfarben (scripts/build-block-colors.mjs → game-data/block-colors.json). Die Prüfungen mit Spieltexturen
// laufen nur mit game-data/ (node scripts/extract-game-data.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBlockColors, blockGroup, oxidizes, summarizeSamples, writeBlockColors } from '../../scripts/build-block-colors.mjs';
import { prepareBlockColors } from '../../js/create/voxelize/colors.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME = path.join(ROOT, 'game-data');
const dataTest = ['models.json', 'blocks.json', 'textures.json', 'textures.bin'].every((f) => fs.existsSync(path.join(GAME, f))) ? test : test.skip;

let cached = null;
function gameInput() {
  if (!cached) {
    const read = (name) => JSON.parse(fs.readFileSync(path.join(GAME, name), 'utf8'));
    cached = { modelsJson: read('models.json'), blocksJson: read('blocks.json'), texturesJson: read('textures.json'), texturesBin: fs.readFileSync(path.join(GAME, 'textures.bin')) };
  }
  return cached;
}

test('Gruppen und Merkmale nach Block-ID', () => {
  assert.equal(blockGroup('red_concrete'), 'beton');
  assert.equal(blockGroup('red_concrete_powder'), 'betonpulver');
  assert.equal(blockGroup('white_wool'), 'wolle');
  assert.equal(blockGroup('terracotta'), 'terrakotta');
  assert.equal(blockGroup('cyan_glazed_terracotta'), 'glasierte-terrakotta');
  assert.equal(blockGroup('stripped_oak_log'), 'holz');
  assert.equal(blockGroup('deepslate_diamond_ore'), 'erz');
  assert.equal(blockGroup('infested_stone'), 'sonder');
  assert.equal(blockGroup('command_block'), 'sonder');
  assert.equal(blockGroup('observer'), 'technik');
  assert.equal(blockGroup('furnace'), 'arbeitsblock');
  assert.equal(blockGroup('waxed_copper_block'), 'kupfer');
  assert.equal(blockGroup('stone_bricks'), 'stein');
  assert.ok(oxidizes('copper_block') && oxidizes('exposed_cut_copper') && oxidizes('weathered_chiseled_copper'));
  assert.ok(!oxidizes('waxed_copper_block') && !oxidizes('oxidized_copper') && !oxidizes('copper_ore') && !oxidizes('raw_copper_block'));
});

test('Mittelwert in linearem RGB: Schwarz + Weiß ergibt nicht 128, sondern 188', () => {
  const summary = summarizeSamples([Float64Array.from([0, 0, 0, 1, 1, 1])]);
  assert.deepEqual(summary.rgb, [188, 188, 188]);
  assert.ok(summary.pattern > 40, 'starke Streuung');
  assert.equal(summarizeSamples([new Float64Array(0)]), null);
  const flat = summarizeSamples([Float64Array.from([0.2, 0.2, 0.2, 0.2, 0.2, 0.2])]);
  assert.equal(flat.pattern, 0);
});

test('Ohne Spieldaten: klare Fehlermeldung', () => {
  assert.throws(() => buildBlockColors({}), /models\.json, blocks\.json, textures\.json und textures\.bin werden gebraucht/);
});

dataTest('Blockfarben aus den 26.2-Texturen: nur volle deckende Würfel, plausible Farben, kurze Laufzeit', () => {
  const input = gameInput();
  const started = performance.now();
  const colors = buildBlockColors(input);
  const ms = performance.now() - started;
  assert.ok(ms < 5000, `Laufzeit ${Math.round(ms)} ms`);
  assert.ok(colors.count > 300 && colors.count < 600, `${colors.count} Blöcke`);
  assert.equal(colors.version, '26.2');
  prepareBlockColors(colors);
  const near = (rgb, expected, tolerance = 3) => rgb.every((v, i) => Math.abs(v - expected[i]) <= tolerance);
  // bekannte Mittelwerte (gerundet) als Plausibilitätsprüfung
  assert.ok(near(colors.blocks.red_concrete.side.rgb, [142, 33, 33]), colors.blocks.red_concrete.side.rgb.join(','));
  assert.ok(near(colors.blocks.white_concrete.side.rgb, [207, 213, 214]), colors.blocks.white_concrete.side.rgb.join(','));
  assert.ok(near(colors.blocks.stone.side.rgb, [126, 126, 126]), colors.blocks.stone.side.rgb.join(','));
  // Grasblock: oben getönt grün, seitlich Erde mit grünem Rand
  const grass = colors.blocks.grass_block;
  assert.ok(grass.tinted && grass.changes);
  assert.ok(grass.top.rgb[1] > grass.top.rgb[0] && grass.top.rgb[1] > grass.top.rgb[2], 'Oberseite grün');
  assert.ok(grass.side.rgb[0] > grass.side.rgb[2], 'Seite erdig');
  // Stamm: oben Jahresringe hell, Seite Rinde dunkler
  assert.ok(colors.blocks.oak_log.top.rgb[0] > colors.blocks.oak_log.side.rgb[0]);
  // Merkmale
  assert.ok(colors.blocks.sand.falls && colors.blocks.white_concrete_powder.falls);
  assert.ok(colors.blocks.glowstone.emissive && colors.blocks.sea_lantern.animated && colors.blocks.magma_block.emissive);
  assert.ok(colors.blocks.command_block.special);
  assert.ok(colors.blocks.bookshelf.side.pattern > colors.blocks.white_concrete.side.pattern * 5);
  // Keine Blöcke mit durchsichtigen Flächen oder Teilmodellen
  for (const id of ['glass', 'oak_leaves', 'oak_stairs', 'chest', 'ice', 'spawner', 'slime_block']) assert.ok(!colors.blocks[id], `${id} ist kein voller deckender Würfel`);
  // Zustände sind vollständig (Standardwerte aus blocks.json), z. B. Stämme mit axis
  assert.equal(colors.blocks.oak_log.state, 'oak_log[axis=y]');
  assert.ok(Object.entries(colors.blocks).every(([id, entry]) => entry.state === id || entry.state.startsWith(`${id}[`)));
});

dataTest('block-colors.json schreiben (in tmp/) und die Datei in game-data/ ist aktuell', () => {
  const dir = path.join(ROOT, 'tmp', 'create-voxelize', 'colors-out');
  fs.mkdirSync(dir, { recursive: true });
  const { result, file, bytes } = writeBlockColors({ dataDir: dir, data: gameInput() });
  assert.ok(fs.existsSync(file) && bytes > 50_000);
  const back = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(back.count, result.count);
  const existing = path.join(GAME, 'block-colors.json');
  if (fs.existsSync(existing)) {
    const current = JSON.parse(fs.readFileSync(existing, 'utf8'));
    assert.deepEqual(current.blocks, back.blocks, 'game-data/block-colors.json ist veraltet – node scripts/build-block-colors.mjs');
  }
});

test('extract-game-data.mjs erzeugt die Blockfarben mit (bei Fehlern nur Warnung, Rest bleibt gültig)', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'extract-game-data.mjs'), 'utf8');
  assert.match(source, /import \{ buildBlockColors, OUTPUT_FILE as BLOCK_COLORS_FILE \} from '\.\/build-block-colors\.mjs';/);
  assert.match(source, /buildBlockColors\(\{ modelsJson: models\.data, blocksJson: blocks\.data, texturesJson: textures\.data, texturesBin: textures\.bin \}\)/);
  assert.match(source, /const blockColors = extractBlockColors\(\{ models, blocks, textures, warnings, log \}\);\n\s+const meta = \{/);
  assert.match(source, /\.\.\.\(blockColors \? \[\{ name: BLOCK_COLORS_FILE, data: JSON\.stringify\(blockColors\) \}\] : \[\]\)/);
  assert.match(source, /warnings\.add\(message\);/);
});
