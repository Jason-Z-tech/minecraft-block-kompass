// Farbabgleich (js/create/voxelize/colors.js): CIELAB, ΔE2000, Sets, Cache. Läuft mit synthetischen Blockfarben;
// die Prüfungen gegen die echten Blockfarben aus game-data/ werden ohne Spieldaten übersprungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  srgbToLab, deltaE2000, nearestBlock, nearestBlockExhaustive, blocksInSet, createColorMatcher, prepareBlockColors,
  inAllSet, normalizeBlockId, lightnessWeight, PALETTE_SETS,
} from '../../js/create/voxelize/colors.js';
import { testBlockColors } from '../fixtures/create/voxelize/test-helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COLORS_FILE = path.join(ROOT, 'game-data', 'block-colors.json');
const realTest = fs.existsSync(COLORS_FILE) ? test : test.skip;
const realColors = () => JSON.parse(fs.readFileSync(COLORS_FILE, 'utf8'));

test('ΔE2000 stimmt mit den Referenzwerten von Sharma, Wu und Dalal (2005) überein', () => {
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];
  for (const [a, b, expected] of pairs) {
    assert.ok(Math.abs(deltaE2000(a, b) - expected) < 1e-4, `${a} ↔ ${b}: ${deltaE2000(a, b)} statt ${expected}`);
    assert.ok(Math.abs(deltaE2000(b, a) - expected) < 1e-4, 'symmetrisch');
  }
  assert.equal(deltaE2000([40, 10, -5], [40, 10, -5]), 0);
});

test('sRGB → Lab: Weiß, Schwarz und Rot', () => {
  const white = srgbToLab([255, 255, 255]);
  assert.ok(Math.abs(white[0] - 100) < 0.01 && Math.abs(white[1]) < 0.01 && Math.abs(white[2]) < 0.01);
  assert.deepEqual(srgbToLab([0, 0, 0]).map((v) => Math.round(v * 100) / 100), [0, 0, 0]);
  const red = srgbToLab([255, 0, 0]);
  assert.ok(Math.abs(red[0] - 53.24) < 0.05 && Math.abs(red[1] - 80.09) < 0.05 && Math.abs(red[2] - 67.2) < 0.05, red.join(', '));
});

test('Sets: alle ohne fallende, leuchtende, Erze, Sonderblöcke und sich verändernde Blöcke', () => {
  const colors = testBlockColors();
  const all = blocksInSet(colors, 'alle').map((e) => e.id);
  for (const id of ['sand', 'glowstone', 'coal_ore', 'command_block', 'grass_block']) assert.ok(!all.includes(id), `${id} gehört nicht zu „alle“`);
  for (const id of ['stone', 'oak_planks', 'red_concrete', 'white_wool', 'terracotta']) assert.ok(all.includes(id), `${id} gehört zu „alle“`);
  assert.equal(blocksInSet(colors, 'beton').length, 16);
  assert.ok(blocksInSet(colors, 'wolle').every((e) => e.id.endsWith('_wool')));
  assert.deepEqual(blocksInSet(colors, 'terrakotta').map((e) => e.id), ['red_terracotta', 'terracotta', 'white_terracotta']);
  assert.deepEqual(blocksInSet(colors, 'einfarbig', 'minecraft:stone').map((e) => e.id), ['stone']);
  assert.deepEqual(PALETTE_SETS, ['alle', 'beton', 'wolle', 'terrakotta', 'einfarbig']);
});

test('Sets: verständliche Fehler', () => {
  const colors = testBlockColors();
  assert.throws(() => blocksInSet(colors, 'glas'), /Unbekannte Palette „glas“/);
  assert.throws(() => blocksInSet(colors, 'einfarbig'), /fehlt der Block/);
  assert.throws(() => blocksInSet(colors, 'einfarbig', 'glass'), /„glass“ ist kein voller, deckender Block/);
  assert.throws(() => prepareBlockColors(null), /Blockfarben fehlen/);
  assert.throws(() => prepareBlockColors({ format: 99, blocks: {} }), /unbekanntes Format/);
  const broken = testBlockColors();
  delete broken.blocks.stone.top;
  assert.throws(() => prepareBlockColors(broken), /stone\.top ist unvollständig/);
  assert.equal(normalizeBlockId('oak_log[axis=y]'), 'oak_log');
  assert.equal(normalizeBlockId('<script>'), null);
});

test('nearestBlock: Farben landen beim passenden Block, Seiten zählen', () => {
  const blockColors = testBlockColors();
  assert.equal(nearestBlock([200, 30, 30], { set: 'beton', blockColors }).id, 'red_concrete');
  assert.equal(nearestBlock([255, 0, 0], { set: 'wolle', blockColors }).id, 'red_wool');
  assert.equal(nearestBlock([0, 0, 255], { set: 'wolle', blockColors }).id, 'blue_wool');
  assert.equal(nearestBlock([8, 10, 15], { set: 'beton', blockColors }).id, 'black_concrete');
  assert.equal(nearestBlock([128, 128, 128], { set: 'alle', blockColors }).id, 'stone');
  // Grasblock ist nur im Set „einfarbig“ wählbar; dort gilt er immer
  const grass = nearestBlock([255, 0, 255], { set: 'einfarbig', block: 'grass_block', blockColors });
  assert.equal(grass.state, 'grass_block[snowy=false]');
  assert.throws(() => nearestBlock([1, 2], { blockColors }), /Farbe \[r, g, b\]/);
  assert.throws(() => nearestBlock([1, 2, 3], { blockColors, face: 'vorne' }), /Unbekannte Seite/);
});

test('Matcher: Cache je Blockfarben und Set, gleiche Antwort wie die exakte Suche', () => {
  const blockColors = testBlockColors();
  const a = createColorMatcher({ blockColors, set: 'beton' });
  assert.equal(createColorMatcher({ blockColors, set: 'beton' }), a, 'gleicher Matcher aus dem Cache');
  assert.notEqual(createColorMatcher({ blockColors, set: 'wolle' }), a);
  let state = 12345;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 300; i++) {
    const rgb = [Math.floor(random() * 64) * 4 + 2, Math.floor(random() * 64) * 4 + 2, Math.floor(random() * 64) * 4 + 2];
    const fast = a.candidates[a.match(rgb[0], rgb[1], rgb[2], 3)].id;
    assert.equal(fast, nearestBlockExhaustive(rgb, { set: 'beton', blockColors }).id, `Farbe ${rgb}`);
  }
});

realTest('echte Blockfarben: Vorauswahl stimmt mit der exakten Suche überein (Set „alle“)', () => {
  const blockColors = realColors();
  const matcher = createColorMatcher({ blockColors, set: 'alle' });
  let state = 777;
  const random = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  let same = 0;
  const total = 2000;
  for (let i = 0; i < total; i++) {
    // Mitte der 6-Bit-Stufe, damit Cache-Rundung und exakte Suche dieselbe Farbe sehen
    const rgb = [0, 1, 2].map(() => Math.floor(random() * 64) * 4 + 2);
    const face = i % 4;
    const fast = matcher.candidates[matcher.match(rgb[0], rgb[1], rgb[2], face)].id;
    const exact = nearestBlockExhaustive(rgb, { set: 'alle', face: ['top', 'side', 'bottom', 'all'][face], blockColors }).id;
    if (fast === exact) same++;
  }
  assert.ok(same / total >= 0.995, `Übereinstimmung ${same} von ${total}`);
});

realTest('echte Blockfarben: Sets und bekannte Zuordnungen', () => {
  const blockColors = realColors();
  const all = blocksInSet(blockColors, 'alle');
  assert.ok(all.length > 150, `„alle“ hat ${all.length} Blöcke`);
  assert.ok(all.every(inAllSet));
  for (const id of ['sand', 'gravel', 'red_concrete_powder', 'glowstone', 'sea_lantern', 'diamond_ore', 'spawner', 'command_block',
    'barrier', 'structure_block', 'beacon', 'bedrock', 'tnt', 'grass_block', 'copper_block', 'infested_stone']) {
    assert.ok(!all.some((e) => e.id === id), `${id} darf nicht in „alle“ sein`);
  }
  assert.equal(blocksInSet(blockColors, 'beton').length, 16);
  assert.equal(blocksInSet(blockColors, 'wolle').length, 16);
  assert.equal(blocksInSet(blockColors, 'terrakotta').length, 17);
  // Reines Rot #FF0000 → roter Beton: mit kL = kC = kH = 1 läge es näher am hellen orangen Beton (ΔE ≈ 13,6) als am
  // dunklen roten (ΔE ≈ 23,2); MATCH_WEIGHTS gewichten bei kräftigen Farben den Farbton stärker.
  const red = nearestBlock([255, 0, 0], { set: 'beton', blockColors });
  assert.equal(red.id, 'red_concrete');
  assert.ok(Math.abs(red.deltaE - 23.2) < 0.5, `deltaE ist das echte ΔE2000 (${red.deltaE})`);
  assert.equal(nearestBlock([200, 30, 30], { set: 'beton', blockColors }).id, 'red_concrete');
  assert.equal(nearestBlock([142, 33, 33], { set: 'beton', blockColors }).id, 'red_concrete');
  assert.equal(nearestBlock([255, 0, 0], { set: 'wolle', blockColors }).id, 'red_wool');
  assert.equal(nearestBlock([255, 0, 0], { set: 'terrakotta', blockColors }).id, 'red_terracotta');
  // Grundfarben (z. B. „Kd 0 0 1“ aus einer .mtl) behalten ihren Farbnamen
  const primaries = [
    [[0, 0, 255], 'blue'], [[0, 255, 0], 'lime'], [[0, 100, 0], 'green'], [[255, 0, 255], 'magenta'], [[255, 128, 0], 'orange'],
    [[128, 0, 255], 'purple'], [[0, 160, 160], 'cyan'], [[0, 255, 255], 'cyan'], [[255, 230, 0], 'yellow'], [[255, 150, 200], 'pink'],
    [[120, 70, 30], 'brown'], [[100, 180, 255], 'light_blue'], [[70, 70, 70], 'gray'], [[128, 0, 0], 'red'],
  ];
  for (const [rgb, name] of primaries) {
    for (const set of ['beton', 'wolle']) {
      const suffix = set === 'beton' ? 'concrete' : 'wool';
      assert.equal(nearestBlock(rgb, { set, blockColors }).id, `${name}_${suffix}`, `${rgb} im Set ${set}`);
    }
  }
  // Ruhige Farben vergleicht der Abgleich mit kL = 1 (Helligkeit zählt voll)
  assert.equal(lightnessWeight(srgbToLab([200, 170, 140])), 1);
  assert.ok(lightnessWeight(srgbToLab([255, 0, 0])) > 3);
  assert.equal(nearestBlock([200, 30, 30], { set: 'wolle', blockColors }).id, 'red_wool');
  assert.equal(nearestBlock([30, 30, 200], { set: 'beton', blockColors }).id, 'blue_concrete');
  assert.equal(nearestBlock([255, 255, 255], { set: 'beton', blockColors }).id, 'white_concrete');
  assert.equal(nearestBlock([0, 0, 0], { set: 'wolle', blockColors }).id, 'black_wool');
  assert.equal(nearestBlock([125, 125, 125], { set: 'alle', blockColors, face: 'side' }).id, 'stone');
});
