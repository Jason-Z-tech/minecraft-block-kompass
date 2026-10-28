// Bauteile der Hilfsbibliothek (§9.1): gültige Zustände, alle 4 Ausrichtungen innerhalb der dokumentierten Box,
// deterministisch, unbekannte Optionen → Error, und die wichtigsten Bauregeln je Bauteil.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setBlockData, validateState, isBlockDataLoaded } from '../../js/core/block-data.js';
import { parseState } from '../../js/core/blockstate.js';
import { Builder } from '../../js/core/builder.js';
import * as parts from '../../js/builds/lib/bauteile.js';
import { checkBuild, collectBuildSources, scanBuildSources } from '../../scripts/check-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOCKS_FILE = path.join(ROOT, 'game-data', 'blocks.json');
const hasGameData = fs.existsSync(BLOCKS_FILE);
if (hasGameData) setBlockData(JSON.parse(fs.readFileSync(BLOCKS_FILE, 'utf8')));
const dataTest = hasGameData ? test : test.skip;

const FACINGS = ['south', 'north', 'east', 'west'];
const ORIGIN = { x: 5, y: 3, z: -7 };

// Alle Bauteile mit mehreren Varianten (Optionen ohne x, y, z, facing).
const CASES = {
  window: [
    {}, { width: 3, height: 2 }, { style: 'framed' }, { style: 'framed', width: 2, shutters: 'oak_trapdoor', flowerBox: true },
    { style: 'arched', width: 3, height: 3 }, { style: 'arched', width: 5, height: 4, frame: 'stone_bricks', stairs: 'stone_brick_stairs' },
    { style: 'arched', width: 2, height: 3 }, { style: 'round' }, { style: 'round', width: 5, frame: 'spruce_planks' },
    { width: 2, flowerBox: { trapdoor: 'birch_trapdoor', soil: 'moss_block', flowers: ['poppy'] }, sill: 'spruce_stairs' },
    { glass: 'blue_stained_glass_pane', shutters: 'dark_oak_trapdoor' },
  ],
  doorway: [
    {}, { width: 2 }, { canopy: 'oak_stairs' }, { canopy: { stairs: 'spruce_stairs', depth: 2, posts: 'spruce_fence' }, width: 2 },
    { frame: null, step: 'cobblestone_stairs', door: 'oak_door', open: true },
  ],
  chimney: [{}, { smoke: 'tall', rim: 'brick_stairs' }, { width: 3, height: 6, smoke: 'tall', rim: 'stone_brick_stairs' }, { smoke: 'none' }, { width: 3, smoke: 'normal', fire: 'soul_campfire' }],
  column: [{}, { height: 3, trim: null }, { height: 7, shaft: 'polished_deepslate', base: 'deepslate_tiles', capital: 'chiseled_deepslate', trim: 'deepslate_tile_stairs' }],
  arch: [{}, { style: 'pointed', width: 3, height: 4 }, { width: 5, height: 5, depth: 3 }, { width: 4, height: 4 }, { width: 6, height: 6, style: 'pointed' }, { width: 1, height: 2, pillars: false }],
  battlements: [{}, { length: 8, corbels: 'stone_brick_stairs', cap: 'stone_brick_slab' }, { length: 9, merlon: 2, gap: 1, height: 2, parapet: 0 }],
  arrowSlit: [{ fill: 'iron_bars' }, { style: 'cross', height: 4, depth: 2, fill: 'black_stained_glass_pane' }],
  balcony: [{}, { width: 5, depth: 3 }, { width: 1, depth: 1, railing: null, supports: null }],
  straightStairs: [{}, { width: 3, height: 5, railing: 'oak_fence' }, { support: null, height: 2 }],
  timberWall: [{}, { pattern: 'cross', length: 11, height: 5 }, { pattern: 'grid', length: 7, height: 6, spacing: 3 }, { pattern: 'plain', length: 2, height: 2 }],
  brace: [{}, { length: 3, beam: 'dark_oak_log' }],
  supportPost: [{}, { sides: 4, height: 4 }, { braces: null }],
  dormer: [{}, { width: 5, wallHeight: 3, depth: 4, corner: null, glass: null }],
  hangingLantern: [{}, { chain: 0 }, { chain: 3, lantern: 'soul_lantern' }],
  wallLantern: [{}, { style: 'shelf' }],
  lampPost: [{}, { style: 'arm', height: 4 }, { style: 'double', base: 'stone_bricks', post: 'stone_brick_wall' }],
  floorPattern: [
    {}, { pattern: 'stripes', width: 4, depth: 6 }, { pattern: 'border', border: 'dark_oak_planks' }, { pattern: 'rings', blocks: ['bricks', 'terracotta', 'mud_bricks'] },
    { pattern: 'diamond', width: 7, depth: 7 }, { pattern: 'herringbone', blocks: ['oak_log', 'spruce_log'], width: 6, depth: 4 },
    { pattern: 'random', blocks: [['stone_bricks', 3], ['mossy_stone_bricks', 1]] },
  ],
  gardenFence: [{}, { gateWidth: 2, posts: 'stripped_oak_log', lanterns: true }, { sides: ['front', 'left'], width: 4, depth: 3 }, { gate: null, sides: ['back'] }],
};

function buildPart(name, extra, facing, origin = ORIGIN) {
  const b = new Builder({ seed: 'lib-test' });
  const box = parts[name](b, { ...origin, facing, ...extra });
  return { box, result: b.finalize() };
}

function blocksOf(result) {
  const cells = [];
  result.volume.forEach((x, y, z, state) => cells.push([x + result.offset[0], y + result.offset[1], z + result.offset[2], state]));
  return cells;
}

function fingerprint(result) {
  return JSON.stringify(blocksOf(result));
}

function boxSize(box) {
  return box.max.map((v, i) => v - box.min[i] + 1);
}

dataTest('jedes Bauteil: 4 Ausrichtungen gültig, in der Box, gleiche Blockzahl, deterministisch', () => {
  assert.ok(isBlockDataLoaded());
  for (const [name, variants] of Object.entries(CASES)) {
    variants.forEach((extra, i) => {
      const label = `${name} #${i} ${JSON.stringify(extra)}`;
      const counts = [];
      let southSize = null;
      for (const facing of FACINGS) {
        const { box, result } = buildPart(name, extra, facing);
        assert.equal(result.warnings.length, 0, `${label} ${facing}: ${result.warnings.join(' ')}`);
        assert.ok(result.blockCount > 0, `${label} ${facing}: setzt keine Blöcke`);
        for (const state of result.volume.palette.slice(1)) assert.ok(validateState(state).ok, `${label} ${facing}: ${state}`);
        for (const [x, y, z, state] of blocksOf(result)) {
          const inside = x >= box.min[0] && x <= box.max[0] && y >= box.min[1] && y <= box.max[1] && z >= box.min[2] && z <= box.max[2];
          assert.ok(inside, `${label} ${facing}: ${state} bei ${x},${y},${z} liegt außerhalb der Box ${JSON.stringify(box)}`);
        }
        const size = boxSize(box);
        if (facing === 'south') southSize = size;
        else if (facing === 'north') assert.deepEqual(size, southSize, `${label}: Box nord ≠ süd`);
        counts.push(result.blockCount);
        assert.equal(fingerprint(buildPart(name, extra, facing).result), fingerprint(result), `${label} ${facing}: nicht deterministisch`);
      }
      const east = boxSize(buildPart(name, extra, 'east').box);
      assert.deepEqual(east, [southSize[2], southSize[1], southSize[0]], `${label}: Box ost = gedrehte Box süd`);
      assert.ok(counts.every((n) => n === counts[0]), `${label}: Blockzahl je Ausrichtung verschieden (${counts.join(', ')})`);
    });
  }
});

test('unbekannte Optionen, falsche Werte und fehlender Builder werfen verständliche Fehler', () => {
  const b = new Builder();
  for (const name of Object.keys(CASES)) {
    assert.throws(() => parts[name](b, { x: 0, y: 0, z: 0, colour: 'red' }), /unbekannte Option „colour“/, name);
    assert.throws(() => parts[name](b, { x: 0.5, y: 0, z: 0 }), /x muss eine ganze Zahl/, name);
    assert.throws(() => parts[name](b, { x: 0, y: 0, z: 0, facing: 'up' }), /facing muss/, name);
    assert.throws(() => parts[name](null, { x: 0, y: 0, z: 0 }), /Builder/, name);
  }
  assert.throws(() => parts.window(b, { x: 0, y: 0, z: 0, style: 'gothic' }), /style muss/);
  assert.throws(() => parts.window(b, { x: 0, y: 0, z: 0, style: 'round', width: 4 }), /width muss/);
  assert.throws(() => parts.window(b, { x: 0, y: 0, z: 0, flowerBox: { colour: 1 } }), /flowerBox kennt/);
  assert.throws(() => parts.arch(b, { x: 0, y: 0, z: 0, width: 9, height: 3 }), /mindestens Höhe 5/);
  assert.throws(() => parts.dormer(b, { x: 0, y: 0, z: 0, width: 4 }), /ungerade/);
  assert.throws(() => parts.straightStairs(b, { x: 0, y: 0, z: 0, support: null, railing: 'oak_fence' }), /railing braucht support/);
  assert.throws(() => parts.gardenFence(b, { x: 0, y: 0, z: 0, lanterns: true }), /lanterns braucht posts/);
  assert.throws(() => parts.floorPattern(b, { x: 0, y: 0, z: 0, blocks: ['stone'] }), /mindestens zwei/);
  assert.throws(() => parts.doorway(b, { x: 0, y: 0, z: 0, door: 'oak_trapdoor' }), /\*_door/);
});

// Zustand an einer Stelle relativ zum Ursprung (Aufrufer-Koordinaten).
function stateAt(result, x, y, z) {
  return result.volume.get(x - result.offset[0], y - result.offset[1], z - result.offset[2]);
}

// Lokaler Punkt (Vorderseite = Süden) → Aufrufer-Koordinaten für facing.
function local(facing, lx, ly, lz, origin = ORIGIN) {
  const rot = { south: [lx, lz], west: [-lz, lx], north: [-lx, -lz], east: [lz, -lx] }[facing];
  return [origin.x + rot[0], origin.y + ly, origin.z + rot[1]];
}

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

dataTest('Fenster: Glas in der Wandebene, Läden flach an der Wand, Blumenkasten davor', () => {
  for (const facing of FACINGS) {
    const { result } = buildPart('window', { width: 1, height: 2, shutters: 'oak_trapdoor', flowerBox: true }, facing);
    assert.match(stateAt(result, ...local(facing, 0, 0, 0)), /^glass_pane/);
    assert.match(stateAt(result, ...local(facing, 0, 1, 0)), /^glass_pane/);
    const shutter = parseState(stateAt(result, ...local(facing, -1, 0, 1)));
    assert.equal(shutter.id, 'oak_trapdoor');
    // Offene Falltür liegt an der Seite gegenüber von facing → facing = außen = an der Wand anliegend.
    assert.equal(shutter.props.facing, facing);
    assert.equal(shutter.props.open, 'true');
    assert.equal(stateAt(result, ...local(facing, 0, -1, 1)), 'rooted_dirt');
    assert.equal(parseState(stateAt(result, ...local(facing, 0, -1, 2))).props.facing, facing);
    assert.ok(stateAt(result, ...local(facing, 0, 0, 1)) !== 'air', 'Blume im Kasten');
  }
  const round = buildPart('window', { style: 'round', width: 3 }, 'south').result;
  assert.equal(parseState(stateAt(round, ...local('south', -1, 2, 0))).props.half, 'top');
  assert.equal(parseState(stateAt(round, ...local('south', -1, 2, 0))).props.facing, 'west');
  assert.equal(parseState(stateAt(round, ...local('south', 1, 0, 0))).props.half, 'bottom');
  assert.equal(parseState(stateAt(round, ...local('south', 1, 0, 0))).props.facing, 'east');
});

dataTest('Tür: öffnet nach innen, Vordach über der Tür, Doppeltür mit Gegenscharnier', () => {
  for (const facing of FACINGS) {
    const { result } = buildPart('doorway', { width: 2, canopy: 'oak_stairs' }, facing);
    const lower = parseState(stateAt(result, ...local(facing, 0, 0, 0)));
    const right = parseState(stateAt(result, ...local(facing, 1, 0, 0)));
    assert.equal(lower.props.half, 'lower');
    assert.equal(lower.props.facing, OPPOSITE[facing]);
    assert.equal(lower.props.hinge, 'left');
    assert.equal(right.props.hinge, 'right');
    assert.equal(parseState(stateAt(result, ...local(facing, 0, 1, 0))).props.half, 'upper');
    const canopy = parseState(stateAt(result, ...local(facing, 0, 3, 1)));
    assert.equal(canopy.id, 'oak_stairs');
    assert.equal(canopy.props.facing, OPPOSITE[facing], 'hohe Seite zur Wand');
  }
});

dataTest('Schornstein: Signalfeuer auf Heuballen bei smoke tall', () => {
  const thin = buildPart('chimney', { height: 5, smoke: 'tall' }, 'south').result;
  assert.match(stateAt(thin, ORIGIN.x, ORIGIN.y + 4, ORIGIN.z), /^hay_block/);
  const fire = parseState(stateAt(thin, ORIGIN.x, ORIGIN.y + 5, ORIGIN.z));
  assert.equal(fire.id, 'campfire');
  assert.equal(fire.props.signal_fire, 'true');
  assert.equal(fire.props.lit, 'true');
  const wide = buildPart('chimney', { width: 3, height: 5, smoke: 'tall' }, 'east').result;
  assert.equal(parseState(stateAt(wide, ORIGIN.x, ORIGIN.y + 4, ORIGIN.z)).props.signal_fire, 'true');
  assert.match(stateAt(wide, ORIGIN.x, ORIGIN.y + 3, ORIGIN.z), /^hay_block/);
  assert.equal(stateAt(wide, ORIGIN.x + 1, ORIGIN.y + 4, ORIGIN.z), 'bricks', 'Feuer sitzt vertieft im Kranz');
});

dataTest('Bogen: Öffnung frei, Bogenschultern als obere Treppen nach außen, Spitzbogen', () => {
  const b = new Builder();
  b.fill(0, 0, 0, 8, 6, 0, 'stone_bricks');
  const box = parts.arch(b, { x: 4, y: 0, z: 0, width: 3, height: 3 });
  assert.deepEqual(box, { min: [2, 0, 0], max: [6, 3, 0] });
  const r = b.finalize();
  const at = (x, y) => r.volume.get(x - r.offset[0], y - r.offset[1], 0 - r.offset[2]);
  for (let y = 0; y < 3; y++) assert.equal(at(4, y), 'air');
  assert.equal(at(3, 0), 'air');
  const left = parseState(at(3, 2));
  assert.equal(left.id, 'stone_brick_stairs');
  assert.deepEqual([left.props.half, left.props.facing], ['top', 'west']);
  assert.equal(parseState(at(5, 2)).props.facing, 'east');
  assert.equal(at(4, 3), 'stone_bricks');
  const profile = parts.archProfile(3, 4, 'pointed');
  assert.equal(profile.get(0, 3), 'open');
  assert.equal(profile.get(-1, 3), 'stairs');
  assert.equal(profile.get(-1, 1), 'open');
  assert.throws(() => parts.archProfile(6, 3, 'pointed'), /mindestens Höhe 5/);
});

dataTest('Zinnen: Muster Zinne/Lücke, letzte Zelle immer Zinne, Konsolen nach außen', () => {
  const { result } = buildPart('battlements', { length: 6, corbels: 'stone_brick_stairs' }, 'south');
  const row = [0, 1, 2, 3, 4, 5].map((i) => stateAt(result, ...local('south', i, 1, 1)));
  assert.deepEqual(row.map((s) => s !== 'air'), [true, false, true, false, true, true]);
  assert.equal(stateAt(result, ...local('south', 1, 0, 1)), 'stone_bricks', 'Brüstung');
  const corbel = parseState(stateAt(result, ...local('south', 0, -1, 1)));
  assert.deepEqual([corbel.props.half, corbel.props.facing], ['top', 'north']);
});

dataTest('Treppe steigt in facing-Richtung, Laternen hängen, Tor sitzt mittig vorne', () => {
  for (const facing of FACINGS) {
    const stairs = buildPart('straightStairs', { height: 4 }, facing).result;
    const top = parseState(stateAt(stairs, ...local(facing, 0, 3, 3)));
    assert.equal(top.props.facing, facing);
    assert.equal(stateAt(stairs, ...local(facing, 0, 0, 3)), 'spruce_planks');
    const lamp = buildPart('hangingLantern', { chain: 2 }, facing).result;
    assert.match(stateAt(lamp, ORIGIN.x, ORIGIN.y, ORIGIN.z), /^iron_chain\[axis=y/);
    assert.equal(parseState(stateAt(lamp, ORIGIN.x, ORIGIN.y - 2, ORIGIN.z)).props.hanging, 'true');
    const fence = buildPart('gardenFence', { width: 7, depth: 4 }, facing).result;
    const gate = parseState(stateAt(fence, ...local(facing, 3, 0, 3)));
    assert.equal(gate.id, 'spruce_fence_gate');
    assert.ok([facing, OPPOSITE[facing]].includes(gate.props.facing), 'Tor quer zur Zaunreihe');
    assert.match(stateAt(fence, ...local(facing, 2, 0, 3)), /^spruce_fence\[/);
  }
  const post = buildPart('lampPost', { style: 'arm', height: 3 }, 'west').result;
  assert.equal(parseState(stateAt(post, ...local('west', 0, 1, 1))).props.hanging, 'true');
});

dataTest('Fachwerk, Bodenmuster und Kopfband', () => {
  const wall = buildPart('timberWall', { length: 9, height: 5, pattern: 'plain' }, 'south').result;
  assert.equal(stateAt(wall, ...local('south', 4, 2, 0)), 'stripped_dark_oak_log[axis=y]');
  assert.equal(stateAt(wall, ...local('south', 2, 2, 0)), 'white_terracotta');
  assert.equal(stateAt(wall, ...local('south', 2, 4, 0)), 'stripped_dark_oak_log[axis=x]');
  const east = buildPart('timberWall', { length: 9, height: 5, pattern: 'plain' }, 'east').result;
  assert.equal(stateAt(east, ...local('east', 2, 4, 0)), 'stripped_dark_oak_log[axis=z]', 'Achse dreht mit');
  const floor = buildPart('floorPattern', { pattern: 'herringbone', blocks: ['oak_log'], width: 4, depth: 4 }, 'south').result;
  const axes = new Set(blocksOf(floor).map(([, , , s]) => parseState(s).props.axis));
  assert.deepEqual([...axes].sort(), ['x', 'z']);
  const brace = buildPart('brace', { length: 2 }, 'north').result;
  const low = parseState(stateAt(brace, ...local('north', 0, -1, 1)));
  assert.deepEqual([low.props.half, low.props.facing], ['top', 'south'], 'hohe Seite zur Wand (Wand liegt im Süden)');
});

dataTest('Bauteile setzen über b: Kapitel, Schritte und verschachtelte transform wirken', () => {
  const b = new Builder();
  b.phase('Fenster');
  b.step();
  b.transform({ offset: [10, 0, 0], rotate: 90 }, () => parts.window(b, { x: 0, y: 1, z: 0, facing: 'south', style: 'framed' }));
  const r = b.finalize();
  assert.equal(r.steps.length, 1);
  assert.ok(r.steps[0].blockCount > 0);
  // Lokal south innerhalb rotate 90 → Welt west: Fensterbank liegt westlich der Wand.
  const sill = [];
  r.volume.forEach((x, y, z, s) => { if (s.startsWith('spruce_stairs')) sill.push([x + r.offset[0], y + r.offset[1], z + r.offset[2], parseState(s).props.facing]); });
  assert.deepEqual(sill, [[9, 0, 0, 'east']]);
});

dataTest('Schaukasten der Bauteile besteht check-build', async () => {
  const report = await checkBuild(path.join(ROOT, 'tests/fixtures/lib/showcase-bauteile.js'));
  assert.deepEqual(report.errors, []);
  assert.ok(report.ok);
});

test('check-build durchsucht auch importierte Dateien unter js/builds/ (Hilfsbibliothek)', async () => {
  const showcase = path.join(ROOT, 'tests/fixtures/lib/showcase-bauteile.js');
  const files = (await collectBuildSources(showcase)).map(({ file }) => path.relative(ROOT, file).split(path.sep).join('/'));
  assert.equal(files[0], 'tests/fixtures/lib/showcase-bauteile.js');
  assert.ok(files.includes('js/builds/lib/bauteile.js') && files.includes('js/builds/lib/palettes.js'), files.join(', '));
  assert.ok(!files.some((f) => f.startsWith('js/core/') || f.startsWith('js/render/')), 'Kern/3D werden nicht durchsucht');
  assert.deepEqual(await scanBuildSources(showcase), []);
  // Verbotenes in einer importierten Datei (zwei Ebenen tief) wird mit Dateiname gemeldet.
  const dir = path.join(ROOT, 'tmp', 'lib-bauteile', 'scan-test');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'mod.js'), "import { a } from './lib/a.js';\nexport default function build(b) { a(b); }\n");
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "export { c } from './c.js';\nexport function a(b) { b.set(0, 0, 0, 'stone'); }\n");
  fs.writeFileSync(path.join(dir, 'lib', 'c.js'), '// Math.random() im Kommentar zählt nicht\nexport const c = () => Math.random() + Date.now();\n');
  const errors = await scanBuildSources(path.join(dir, 'mod.js'), { within: dir });
  assert.equal(errors.length, 2, errors.join('\n'));
  assert.ok(errors.every((e) => e.startsWith('tmp/lib-bauteile/scan-test/lib/c.js (importiert): Die Datei')), errors.join('\n'));
  assert.deepEqual(await scanBuildSources(path.join(dir, 'mod.js')), [], 'außerhalb von js/builds/ nur das Modul selbst');
});

test('index.js sammelt alle Exporte (ohne Namenskonflikte), sobald natur.js da ist', async (t) => {
  const libDir = path.join(ROOT, 'js', 'builds', 'lib');
  if (!fs.existsSync(path.join(libDir, 'natur.js'))) {
    t.skip('natur.js fehlt noch');
    return;
  }
  const index = await import(pathToFileURL(path.join(libDir, 'index.js')).href);
  for (const file of ['palettes.js', 'bauteile.js', 'innen.js', 'natur.js']) {
    const mod = await import(pathToFileURL(path.join(libDir, file)).href);
    for (const [name, value] of Object.entries(mod)) assert.equal(index[name], value, `${file}: ${name} fehlt in index.js oder ist doppelt`);
  }
});
