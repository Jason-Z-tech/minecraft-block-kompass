// Einrichtung der Hilfsbibliothek (§9.1): Räume in 4 Ausrichtungen, Zaubertisch Stufe 30 (Regel wie im Spiel),
// Doppeltruhen und lightRoom (rechnerisch: kein begehbares Feld mit Blocklicht 0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setBlockData, validateState } from '../../js/core/block-data.js';
import { parseState, stateId } from '../../js/core/blockstate.js';
import { Builder } from '../../js/core/builder.js';
import { blockLightEmission } from '../../js/render/block-models.js';
import * as innen from '../../js/builds/lib/innen.js';
import { checkBuild } from '../../scripts/check-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOCKS_FILE = path.join(ROOT, 'game-data', 'blocks.json');
const hasGameData = fs.existsSync(BLOCKS_FILE);
if (hasGameData) setBlockData(JSON.parse(fs.readFileSync(BLOCKS_FILE, 'utf8')));
const dataTest = hasGameData ? test : test.skip;

const FACINGS = ['south', 'north', 'east', 'west'];
const ORIGIN = { x: -4, y: 2, z: 9 };
const CW = { north: 'east', east: 'south', south: 'west', west: 'north' };
const CCW = { north: 'west', west: 'south', south: 'east', east: 'north' };
const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

const CASES = {
  bedroom: [{}, { width: 3, depth: 3, rug: null }, { width: 7, depth: 6, double: true, color: 'blau', wood: 'kirsche' }, { width: 6, depth: 5, wood: WOODLESS() }],
  kitchen: [{}, { width: 4, cabinets: false }, { width: 9, wood: 'birke' }],
  diningTable: [{}, { length: 5, width: 2 }, { top: 'carpet', cloth: 'rot', headChairs: false }, { length: 1, decor: false }],
  bookWall: [{}, { width: 1, height: 1, crown: false }, { width: 12, height: 4, ladder: true, wood: 'fichte' }],
  storage: [{}, { width: 2, height: 1 }, { width: 7, height: 3, barrel: false, chest: 'trapped_chest' }, { width: 4, chest: 'copper_chest' }],
  enchantingSetup: [{}, { lights: false }],
  workshop: [{}, { width: 2, shelves: false }, { width: 12, wood: 'dschungel' }],
  fireplace: [{}, { height: 6, block: 'stone_bricks', mantel: 'spruce_stairs', fire: 'soul_campfire', decor: false }],
};

// Eine Holz-Palette als Objekt (statt Name) – testet beide Formen.
function WOODLESS() {
  return { planks: 'acacia_planks', log: 'acacia_log', stairs: 'acacia_stairs', slab: 'acacia_slab', fence: 'acacia_fence', trapdoor: 'acacia_trapdoor', shelf: 'acacia_shelf' };
}

function buildPart(name, extra, facing) {
  const b = new Builder({ seed: 'lib-innen' });
  const box = innen[name](b, { ...ORIGIN, facing, ...extra });
  return { box, result: b.finalize() };
}

function blocksOf(result) {
  const cells = [];
  result.volume.forEach((x, y, z, state) => cells.push([x + result.offset[0], y + result.offset[1], z + result.offset[2], state]));
  return cells;
}

dataTest('jede Einrichtung: 4 Ausrichtungen gültig, in der Box, gleiche Blockzahl, deterministisch', () => {
  for (const [name, variants] of Object.entries(CASES)) {
    variants.forEach((extra, i) => {
      const label = `${name} #${i}`;
      const counts = [];
      let south = null;
      for (const facing of FACINGS) {
        const { box, result } = buildPart(name, extra, facing);
        assert.deepEqual(result.warnings, [], `${label} ${facing}`);
        assert.ok(result.blockCount > 0, `${label} ${facing}: setzt keine Blöcke`);
        for (const state of result.volume.palette.slice(1)) assert.ok(validateState(state).ok, `${label} ${facing}: ${state}`);
        for (const [x, y, z, state] of blocksOf(result)) {
          const inside = x >= box.min[0] && x <= box.max[0] && y >= box.min[1] && y <= box.max[1] && z >= box.min[2] && z <= box.max[2];
          assert.ok(inside, `${label} ${facing}: ${state} bei ${x},${y},${z} außerhalb ${JSON.stringify(box)}`);
        }
        const size = box.max.map((v, k) => v - box.min[k] + 1);
        if (facing === 'south') south = size;
        if (facing === 'east') assert.deepEqual(size, [south[2], south[1], south[0]], `${label}: Box gedreht`);
        counts.push(result.blockCount);
        assert.equal(JSON.stringify(blocksOf(buildPart(name, extra, facing).result)), JSON.stringify(blocksOf(result)), `${label} ${facing}: nicht deterministisch`);
      }
      assert.ok(counts.every((n) => n === counts[0]), `${label}: ${counts.join(', ')}`);
    });
  }
});

test('Einrichtung: unbekannte Optionen und zu kleine Räume werfen Fehler', () => {
  const b = new Builder();
  for (const name of Object.keys(CASES)) assert.throws(() => innen[name](b, { x: 0, y: 0, z: 0, size: 3 }), /unbekannte Option „size“/, name);
  assert.throws(() => innen.bedroom(b, { x: 0, y: 0, z: 0, width: 2 }), /width muss/);
  assert.throws(() => innen.bedroom(b, { x: 0, y: 0, z: 0, width: 3, double: true }), /Doppelbett/);
  assert.throws(() => innen.bedroom(b, { x: 0, y: 0, z: 0, wood: 'plastik' }), /unbekanntes Holz/);
  assert.throws(() => innen.kitchen(b, { x: 0, y: 0, z: 0, width: 3 }), /width muss/);
  assert.throws(() => innen.storage(b, { x: 0, y: 0, z: 0, chest: 'ender_chest' }), /Doppeltruhen/);
  assert.throws(() => innen.fireplace(b, { x: 0, y: 0, z: 0, height: 3 }), /height muss/);
  assert.throws(() => innen.lightRoom(b, { x1: 0, y1: 0, z1: 0, x2: 1, y2: 1 }), /box\.z2/);
  assert.throws(() => innen.lightRoom(b, { x1: 0, y1: 0, z1: 0, x2: 1, y2: 1, z2: 1 }, { lantern: 'torch' }), /Laterne/);
  assert.throws(() => innen.lightRoom(b, { x1: 0, y1: 0, z1: 0, x2: 1, y2: 1, z2: 1 }, { radius: 3 }), /unbekannte Option/);
});

// EnchantingTableBlock.BOOKSHELF_OFFSETS: |dx| = 2 oder |dz| = 2, dy 0 … 1; zählt, wenn dort ein Bücherregal steht
// und das Feld auf halbem Weg (dx/2, 0, dz/2 – ganzzahlig, Richtung 0) frei ist (Tag enchantment_power_transmitter).
function enchantingPower(get, [tx, ty, tz]) {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
      for (let dy = 0; dy <= 1; dy++) {
        const shelf = get(tx + dx, ty + dy, tz + dz);
        const between = get(tx + Math.trunc(dx / 2), ty + Math.trunc(dy / 2), tz + Math.trunc(dz / 2));
        if (stateId(shelf) === 'bookshelf' && between === 'air') n++;
      }
    }
  }
  return n;
}

dataTest('Zaubertisch: genau 15 wirksame Bücherregale (Stufe 30) in jeder Ausrichtung, Zugang vorne frei', () => {
  assert.equal(innen.ENCHANTING_SHELVES.length, 15);
  for (const facing of FACINGS) {
    const { result } = buildPart('enchantingSetup', {}, facing);
    const get = (x, y, z) => result.volume.get(x - result.offset[0], y - result.offset[1], z - result.offset[2]);
    assert.equal(get(ORIGIN.x, ORIGIN.y, ORIGIN.z), 'enchanting_table');
    assert.equal(enchantingPower(get, [ORIGIN.x, ORIGIN.y, ORIGIN.z]), 15, facing);
    const [fx, fz] = STEP[facing];
    assert.equal(get(ORIGIN.x + 2 * fx, ORIGIN.y, ORIGIN.z + 2 * fz), 'air', `${facing}: vorne offen`);
  }
});

dataTest('Lager: jede Truhe hat ihre Partnerhälfte wie im Spiel (left → Partner im Uhrzeigersinn von facing)', () => {
  for (const facing of FACINGS) {
    const { result } = buildPart('storage', { width: 8, height: 2 }, facing);
    const get = (x, y, z) => result.volume.get(x - result.offset[0], y - result.offset[1], z - result.offset[2]);
    let chests = 0;
    for (const [x, y, z, state] of blocksOf(result)) {
      const { id, props } = parseState(state);
      if (id !== 'chest') continue;
      chests++;
      assert.equal(props.facing, facing);
      assert.notEqual(props.type, 'single');
      const dir = props.type === 'left' ? CW[props.facing] : CCW[props.facing];
      const partner = parseState(get(x + STEP[dir][0], y, z + STEP[dir][1]));
      assert.equal(partner.id, 'chest', `${facing}: Partner fehlt bei ${x},${y},${z}`);
      assert.equal(partner.props.type, props.type === 'left' ? 'right' : 'left');
    }
    assert.equal(chests, 12, `${facing}: 3 Doppeltruhen × 2 Ebenen`);
  }
});

// Eigene, unabhängige Lichtrechnung: Lichtquellen → −1 je Schritt, nur durch Luft und das, was lightRoom setzt.
function checkLight(result, box) {
  const off = result.offset;
  const get = (x, y, z) => result.volume.get(x - off[0], y - off[1], z - off[2]);
  const inBox = (x, y, z) => x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2 && z >= box.z1 && z <= box.z2;
  const passes = (s) => s === 'air' || /lantern|chain|carpet|candle|torch|fence|flower_pot|potted_|glass_pane/.test(stateId(s));
  const light = new Map();
  const queue = [];
  for (let x = box.x1; x <= box.x2; x++) for (let y = box.y1; y <= box.y2; y++) for (let z = box.z1; z <= box.z2; z++) {
    const s = get(x, y, z);
    if (s === 'air') continue;
    const { id, props } = parseState(s);
    const level = blockLightEmission(id, props);
    if (level > 0) { light.set(`${x},${y},${z}`, level); queue.push([x, y, z, level]); }
  }
  while (queue.length) {
    const [x, y, z, level] = queue.shift();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const n = [x + dx, y + dy, z + dz];
      if (!inBox(...n) || !passes(get(...n))) continue;
      const key = n.join(',');
      if ((light.get(key) ?? 0) >= level - 1) continue;
      light.set(key, level - 1);
      if (level - 1 > 1) queue.push([...n, level - 1]);
    }
  }
  const dark = [];
  let walkable = 0;
  for (let x = box.x1; x <= box.x2; x++) for (let y = box.y1; y <= box.y2; y++) for (let z = box.z1; z <= box.z2; z++) {
    if (get(x, y, z) !== 'air' || get(x, y - 1, z) === 'air') continue;
    walkable++;
    if (!(light.get(`${x},${y},${z}`) > 0)) dark.push([x, y, z]);
  }
  return { dark, walkable };
}

function shell(b, box, { ceiling = true, wall = 'stone_bricks' } = {}) {
  b.fill(box.x1 - 1, box.y1 - 1, box.z1 - 1, box.x2 + 1, box.y1 - 1, box.z2 + 1, 'oak_planks');
  b.walls(box.x1 - 1, box.y1, box.z1 - 1, box.x2 + 1, box.y2, box.z2 + 1, wall);
  if (ceiling) b.fill(box.x1 - 1, box.y2 + 1, box.z1 - 1, box.x2 + 1, box.y2 + 1, box.z2 + 1, 'spruce_planks');
}

dataTest('lightRoom: kein begehbares Feld mit Licht 0 – leer, möbliert, ohne Decke, niedrig, gedreht', () => {
  const scenarios = [
    { name: 'kleiner Raum', box: { x1: 0, y1: 1, z1: 0, x2: 4, y2: 3, z2: 4 } },
    { name: 'Halle 31×31', box: { x1: 0, y1: 1, z1: 0, x2: 30, y2: 5, z2: 30 }, maxLamps: 14 },
    { name: 'niedriger Gang 2 hoch', box: { x1: 0, y1: 1, z1: 0, x2: 40, y2: 2, z2: 2 } },
    { name: 'ohne Decke', box: { x1: 0, y1: 1, z1: 0, x2: 12, y2: 4, z2: 9 }, ceiling: false },
    {
      name: 'möbliert', box: { x1: 0, y1: 1, z1: 0, x2: 8, y2: 3, z2: 7 },
      furnish: (b) => {
        innen.bedroom(b, { x: 0, y: 1, z: 0, width: 5, depth: 5 });
        innen.diningTable(b, { x: 5, y: 1, z: 5, length: 2, top: 'carpet' });
        innen.storage(b, { x: 8, y: 1, z: 0, facing: 'west', width: 6, height: 2 });
        b.fill(2, 1, 6, 4, 2, 6, 'bookshelf');
      },
    },
    { name: 'Seelenlaternen, am Boden', box: { x1: 0, y1: 1, z1: 0, x2: 14, y2: 4, z2: 14 }, options: { lantern: 'soul_lantern', mode: 'floor' } },
  ];
  for (const s of scenarios) {
    for (const rotate of [0, 90, 180, 270]) {
      const b = new Builder();
      let placed;
      b.transform({ offset: [3, 0, -2], rotate }, () => {
        shell(b, s.box, { ceiling: s.ceiling !== false });
        s.furnish?.(b);
        placed = innen.lightRoom(b, s.box, s.options).placed;
        assert.deepEqual(innen.findDarkSpots(b, s.box), [], `${s.name} ${rotate}°: findDarkSpots`);
      });
      const result = b.finalize();
      // Prüfung in Welt-Koordinaten des Ergebnisses: Box mitdrehen.
      const corners = [[s.box.x1, s.box.z1], [s.box.x2, s.box.z2]].map(([x, z]) => {
        const r = { 0: [x, z], 90: [-z, x], 180: [-x, -z], 270: [z, -x] }[rotate];
        return [r[0] + 3, r[1] - 2];
      });
      const box = {
        x1: Math.min(corners[0][0], corners[1][0]), x2: Math.max(corners[0][0], corners[1][0]), y1: s.box.y1, y2: s.box.y2,
        z1: Math.min(corners[0][1], corners[1][1]), z2: Math.max(corners[0][1], corners[1][1]),
      };
      const { dark, walkable } = checkLight(result, box);
      assert.ok(walkable > 0, s.name);
      assert.deepEqual(dark, [], `${s.name} ${rotate}°: dunkle begehbare Felder`);
      assert.ok(placed.length > 0, `${s.name}: keine Laterne gesetzt`);
      if (s.maxLamps) assert.ok(placed.length <= s.maxLamps, `${s.name}: ${placed.length} Laternen sind zu viele`);
      for (const [x, y, z] of placed) {
        assert.ok(x >= s.box.x1 && x <= s.box.x2 && y >= s.box.y1 && y <= s.box.y2 && z >= s.box.z1 && z <= s.box.z2, `${s.name}: Laterne außerhalb`);
      }
    }
  }
});

dataTest('lightRoom: hängt an die Decke, wenn der Raum hoch genug ist, nutzt vorhandenes Licht, deterministisch', () => {
  const box = { x1: 0, y1: 1, z1: 0, x2: 9, y2: 3, z2: 9 };
  const b = new Builder();
  shell(b, box);
  const { placed } = innen.lightRoom(b, box);
  for (const [x, y, z] of placed) {
    assert.equal(y, 3, 'an der Decke');
    assert.equal(parseState(b.get(x, y, z)).props.hanging, 'true');
  }
  const again = new Builder();
  shell(again, box);
  assert.deepEqual(innen.lightRoom(again, box).placed, placed);
  const lit = new Builder();
  shell(lit, box);
  lit.set(1, 1, 1, 'soul_lantern');
  const before = innen.findDarkSpots(lit, box).length;
  assert.ok(before > 0 && before < 100, `dunkle Felder vorher: ${before}`);
  assert.ok(innen.lightRoom(lit, box).placed.length <= placed.length);
  const tall = new Builder();
  const tallBox = { x1: 0, y1: 1, z1: 0, x2: 11, y2: 7, z2: 11 };
  shell(tall, tallBox);
  for (const [x, y, z] of innen.lightRoom(tall, tallBox).placed) {
    assert.equal(y, 4, 'hohe Halle: Laterne hängt an 3 Kettengliedern');
    for (let k = 5; k <= 7; k++) assert.match(tall.get(x, k, z), /^iron_chain\[axis=y\]/);
  }
  const low = new Builder();
  const lowBox = { x1: 0, y1: 1, z1: 0, x2: 9, y2: 2, z2: 9 };
  shell(low, lowBox);
  for (const [x, y, z] of innen.lightRoom(low, lowBox).placed) {
    assert.equal(y, 1, 'niedriger Raum: Laterne steht am Boden');
    assert.equal(parseState(low.get(x, y, z)).props.hanging, 'false');
  }
});

dataTest('Schaukasten der Einrichtung besteht check-build', async () => {
  const report = await checkBuild(path.join(ROOT, 'tests/fixtures/lib/showcase-innen.js'));
  assert.deepEqual(report.errors, []);
  assert.ok(report.ok);
});
