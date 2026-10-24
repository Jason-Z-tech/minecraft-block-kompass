// Erzeugt die Testdateien für den Datei-Import (tests/unit/create-import-*.test.mjs) in diesem Ordner.
// Aufruf: node tests/fixtures/create/import/make-fixtures.mjs   (Ergebnis ist eingecheckt; deterministisch)
// Nur Node-Bordmittel. Zustände stammen aus tests/fixtures/core/blocks.json (echte 26.2-Daten).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CORE_BLOCKS = JSON.parse(fs.readFileSync(path.join(DIR, '..', '..', 'core', 'blocks.json'), 'utf8')).blocks;

// ------------------------------------------------------------------ NBT-Schreiber (big-endian)

const tag = (type, value) => ({ type, value });
export const nbt = {
  byte: (v) => tag(1, v), short: (v) => tag(2, v), int: (v) => tag(3, v), long: (v) => tag(4, BigInt(v)),
  float: (v) => tag(5, v), double: (v) => tag(6, v), byteArray: (v) => tag(7, v), string: (v) => tag(8, v),
  list: (elementType, items) => tag(9, { elementType, items }), compound: (entries) => tag(10, entries),
  intArray: (v) => tag(11, v), longArray: (v) => tag(12, v),
};

class Writer {
  constructor() { this.parts = []; }
  u8(v) { this.parts.push(Buffer.from([v & 0xff])); }
  i16(v) { const b = Buffer.alloc(2); b.writeInt16BE(v); this.parts.push(b); }
  i32(v) { const b = Buffer.alloc(4); b.writeInt32BE(v); this.parts.push(b); }
  i64(v) { const b = Buffer.alloc(8); b.writeBigInt64BE(BigInt.asIntN(64, v)); this.parts.push(b); }
  str(text) { const b = Buffer.from(text, 'utf8'); this.i16(b.length); this.parts.push(b); }
  payload({ type, value }) {
    switch (type) {
      case 1: return this.u8(value);
      case 2: return this.i16(value);
      case 3: return this.i32(value);
      case 4: return this.i64(value);
      case 5: { const b = Buffer.alloc(4); b.writeFloatBE(value); return this.parts.push(b); }
      case 6: { const b = Buffer.alloc(8); b.writeDoubleBE(value); return this.parts.push(b); }
      case 7: this.i32(value.length); return this.parts.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
      case 8: return this.str(value);
      case 9:
        this.u8(value.items.length === 0 ? 0 : value.elementType);
        this.i32(value.items.length);
        for (const item of value.items) this.payload(item);
        return undefined;
      case 10:
        for (const [key, child] of Object.entries(value)) {
          this.u8(child.type);
          this.str(key);
          this.payload(child);
        }
        return this.u8(0);
      case 11: this.i32(value.length); for (const v of value) this.i32(v); return undefined;
      case 12: this.i32(value.length); for (const v of value) this.i64(v); return undefined;
      default: throw new Error(`Tag-Typ ${type}`);
    }
  }
  done() { return Buffer.concat(this.parts); }
}

export function encodeNbt(rootName, root) {
  const w = new Writer();
  w.u8(root.type);
  w.str(rootName);
  w.payload(root);
  return w.done();
}

const gzip = (buffer) => zlib.gzipSync(buffer, { level: 9, mtime: 0 });

function write(name, buffer) {
  fs.writeFileSync(path.join(DIR, name), buffer);
  console.log(`${name.padEnd(28)} ${buffer.length.toLocaleString('de-DE').padStart(9)} Byte`);
}

// ------------------------------------------------------------------ Testszene

// 5 × 4 × 3 (x, y, z), Zustände wie in einer Datei aus dem Netz (mit Namensraum, alten Namen, Mod-Blöcken).
export const SCENE_SIZE = [5, 4, 3];
export function sceneBlocks() {
  const blocks = [];
  for (let z = 0; z < 3; z++) for (let x = 0; x < 5; x++) if (!(x === 4 && z === 2)) blocks.push([x, 0, z, 'minecraft:stone']);
  blocks.push([4, 0, 2, 'minecraft:cave_air']);
  blocks.push([0, 1, 0, 'minecraft:oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]']);
  blocks.push([1, 1, 0, 'minecraft:chain[axis=x,waterlogged=false]']);
  blocks.push([2, 1, 0, 'minecraft:cobblestone_wall[east=true,north=false,south=false,up=true,waterlogged=false,west=true]']);
  blocks.push([3, 1, 0, 'create:shaft[axis=y]']);
  blocks.push([4, 1, 0, 'minecraft:oak_stairs[facing=north,foo=bar,half=top]']);
  blocks.push([0, 1, 1, 'minecraft:structure_void']);
  blocks.push([1, 1, 1, 'minecraft:grass_path']);
  blocks.push([2, 1, 1, 'minecraft:sign[rotation=4,waterlogged=false]']);
  blocks.push([1, 1, 2, 'minecraft:oak_log[axis=q]']);
  blocks.push([3, 1, 2, 'minecraft:totally_new_block']);
  blocks.push([0, 3, 2, 'minecraft:bricks']);
  blocks.push([4, 3, 0, 'minecraft:white_wool']);
  blocks.push([4, 3, 2, 'minecraft:glass']);
  return blocks;
}

// Zustand → { Name, Properties } (Litematica, Strukturdatei)
function stateCompound(state) {
  const open = state.indexOf('[');
  const name = open < 0 ? state : state.slice(0, open);
  const entries = { Name: nbt.string(name) };
  if (open >= 0) {
    const props = {};
    for (const part of state.slice(open + 1, -1).split(',')) {
      const [k, v] = part.split('=');
      props[k] = nbt.string(v);
    }
    entries.Properties = nbt.compound(props);
  }
  return nbt.compound(entries);
}

function allStates(id) {
  const info = CORE_BLOCKS[id];
  let states = [{}];
  for (const [key, values] of Object.entries(info.props)) states = states.flatMap((s) => values.map((v) => ({ ...s, [key]: v })));
  return states.map((s) => {
    const keys = Object.keys(s).sort();
    return keys.length ? `minecraft:${id}[${keys.map((k) => `${k}=${s[k]}`).join(',')}]` : `minecraft:${id}`;
  });
}

// ------------------------------------------------------------------ Sponge

function varints(values) {
  const out = [];
  for (let v of values) {
    while ((v & ~0x7f) !== 0) {
      out.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    out.push(v);
  }
  return Int8Array.from(out, (b) => (b > 127 ? b - 256 : b));
}

// Palette mit Luft, Szene-Zuständen, 240 ungenutzten Treppen (Nummern > 127 → zwei Byte je Varint) und Glas am Ende.
function spongeData(blocks, [w, h, l]) {
  const sceneStates = [...new Set(blocks.map((b) => b[3]))].filter((s) => s !== 'minecraft:glass');
  const filler = ['oak_stairs', 'spruce_stairs', 'stone_brick_stairs'].flatMap(allStates);
  const order = ['minecraft:air', ...sceneStates, ...filler.filter((s) => !sceneStates.includes(s)), 'minecraft:glass'];
  const palette = {};
  order.forEach((s, i) => { palette[s] = nbt.int(i); });
  const cells = new Array(w * h * l).fill(0);
  for (const [x, y, z, s] of blocks) cells[x + z * w + y * w * l] = order.indexOf(s);
  return { palette, paletteMax: order.length, data: varints(cells) };
}

function spongeV2(blocks, size, { version = 2, dataVersion = 4903 } = {}) {
  const [w, h, l] = size;
  const { palette, paletteMax, data } = spongeData(blocks, size);
  const entries = {
    Version: nbt.int(version),
    Width: nbt.short(w), Height: nbt.short(h), Length: nbt.short(l),
    Offset: nbt.intArray([0, 0, 0]),
    PaletteMax: nbt.int(paletteMax),
    Palette: nbt.compound(palette),
    BlockData: nbt.byteArray(data),
    Metadata: nbt.compound({ Name: nbt.string('Testhaus'), Author: nbt.string('Block-Kompass') }),
  };
  if (version === 2) {
    entries.DataVersion = nbt.int(dataVersion);
    entries.BlockEntities = nbt.list(10, [nbt.compound({ Id: nbt.string('minecraft:chest'), Pos: nbt.intArray([4, 3, 2]) })]);
    entries.Entities = nbt.list(10, [
      nbt.compound({ Id: nbt.string('minecraft:armor_stand'), Pos: nbt.list(6, [nbt.double(1.5), nbt.double(1), nbt.double(1.5)]) }),
      nbt.compound({ Id: nbt.string('minecraft:item_frame'), Pos: nbt.list(6, [nbt.double(2.5), nbt.double(2), nbt.double(0.5)]) }),
    ]);
  } else {
    entries.TileEntities = nbt.list(10, []);
  }
  return encodeNbt('Schematic', nbt.compound(entries));
}

function spongeV3(blocks, size) {
  const [w, h, l] = size;
  const { palette, data } = spongeData(blocks, size);
  return encodeNbt('', nbt.compound({
    Schematic: nbt.compound({
      Version: nbt.int(3),
      DataVersion: nbt.int(4903),
      Width: nbt.short(w), Height: nbt.short(h), Length: nbt.short(l),
      Offset: nbt.intArray([10, 64, -3]),
      Metadata: nbt.compound({ Name: nbt.string('Testhaus v3'), Date: nbt.long(1761200000000n) }),
      Blocks: nbt.compound({ Palette: nbt.compound(palette), Data: nbt.byteArray(data), BlockEntities: nbt.list(10, []) }),
      Entities: nbt.list(10, [nbt.compound({ Id: nbt.string('minecraft:cow'), Pos: nbt.list(6, [nbt.double(1), nbt.double(1), nbt.double(1)]) })]),
    }),
  }));
}

// Einfache Schematic aus einer Zellenfunktion (für Grenzen-Tests), Palette [air, stone].
function spongeFilled(size, fill = () => 1) {
  const [w, h, l] = size;
  const cells = new Uint8Array(w * h * l);
  for (let i = 0; i < cells.length; i++) cells[i] = fill(i);
  return encodeNbt('Schematic', nbt.compound({
    Version: nbt.int(2), DataVersion: nbt.int(4903),
    Width: nbt.short(w), Height: nbt.short(h), Length: nbt.short(l),
    PaletteMax: nbt.int(2),
    Palette: nbt.compound({ 'minecraft:air': nbt.int(0), 'minecraft:stone': nbt.int(1) }),
    BlockData: nbt.byteArray(new Int8Array(cells.buffer)),
  }));
}

// ------------------------------------------------------------------ Litematica

/** Werte lückenlos über Long-Grenzen packen (LitematicaBitArray). */
export function packBits(values, bits) {
  const longs = new Array(Math.ceil((values.length * bits) / 64)).fill(0n);
  values.forEach((value, i) => {
    const start = i * bits;
    const index = Math.floor(start / 64), offset = BigInt(start % 64);
    longs[index] |= (BigInt(value) << offset) & ((1n << 64n) - 1n);
    if (start % 64 + bits > 64) longs[index + 1] |= BigInt(value) >> (64n - offset);
  });
  return longs.map((v) => BigInt.asIntN(64, v));
}

const vec = ([x, y, z]) => nbt.compound({ x: nbt.int(x), y: nbt.int(y), z: nbt.int(z) });

function litematicRegion(position, size, palette, cells, bits) {
  return nbt.compound({
    Position: vec(position),
    Size: vec(size),
    BlockStatePalette: nbt.list(10, palette.map(stateCompound)),
    BlockStates: nbt.longArray(packBits(cells, bits)),
    TileEntities: nbt.list(10, []),
    Entities: nbt.list(10, []),
    PendingBlockTicks: nbt.list(10, []),
    PendingFluidTicks: nbt.list(10, []),
  });
}

function litematicFile(regions, { name = 'Test', enclosing = [1, 1, 1] } = {}) {
  return encodeNbt('', nbt.compound({
    MinecraftDataVersion: nbt.int(4903),
    Version: nbt.int(6),
    SubVersion: nbt.int(1),
    Metadata: nbt.compound({
      Name: nbt.string(name), Author: nbt.string('Block-Kompass'), Description: nbt.string(''),
      RegionCount: nbt.int(Object.keys(regions).length), EnclosingSize: vec(enclosing),
      TimeCreated: nbt.long(1761200000000n), TimeModified: nbt.long(1761200000000n),
    }),
    Regions: nbt.compound(regions),
  }));
}

// Region „Haus“ = Testszene (Palette 15 Einträge → 4 Bit), Region „Turm“ mit negativer Größe (20 Einträge → 5 Bit).
export const TOWER = Object.freeze({ position: [10, 0, 5], size: [-3, -6, -2], states: allStates('oak_stairs').slice(0, 19) });
export function towerCell(i) {
  return i % 7 === 3 ? 0 : 1 + (i % 19);
}

function regionsLitematic() {
  const blocks = sceneBlocks();
  const [w, h, l] = SCENE_SIZE;
  const housePalette = ['minecraft:air', ...new Set(blocks.map((b) => b[3]))];
  const houseCells = new Array(w * h * l).fill(0);
  for (const [x, y, z, s] of blocks) houseCells[(y * l + z) * w + x] = housePalette.indexOf(s);
  const towerPalette = ['minecraft:air', ...TOWER.states];
  const [tx, ty, tz] = TOWER.size.map(Math.abs);
  const towerCells = Array.from({ length: tx * ty * tz }, (_, i) => towerCell(i));
  return litematicFile({
    Haus: litematicRegion([0, 0, 0], SCENE_SIZE, housePalette, houseCells, 4),
    Turm: litematicRegion(TOWER.position, TOWER.size, towerPalette, towerCells, 5),
  }, { name: 'Haus mit Turm', enclosing: [11, 6, 6] });
}

// Eine Region 20 × 1 × 16 mit 300 verschiedenen Zuständen (Palette 301 → 9 Bit).
export function bigPaletteStates() {
  return [...allStates('oak_stairs'), ...allStates('spruce_stairs'), ...allStates('stone_brick_stairs'), ...allStates('cobblestone_wall').slice(0, 60)];
}

function bigPaletteLitematic() {
  const states = bigPaletteStates();
  const palette = ['minecraft:air', ...states];
  const cells = Array.from({ length: 20 * 16 }, (_, i) => (i < states.length ? i + 1 : 0));
  return litematicFile({ Palette: litematicRegion([0, 0, 0], [20, 1, 16], palette, cells, 9) }, { name: 'Große Palette', enclosing: [20, 1, 16] });
}

// ------------------------------------------------------------------ Strukturdatei

function structureNbt() {
  const blocks = sceneBlocks();
  const palette = ['minecraft:air', ...new Set(blocks.map((b) => b[3])), 'minecraft:jigsaw[orientation=north_up]', 'minecraft:structure_block[mode=save]'];
  const list = blocks.map(([x, y, z, s]) => nbt.compound({ pos: nbt.list(3, [nbt.int(x), nbt.int(y), nbt.int(z)]), state: nbt.int(palette.indexOf(s)) }));
  list.push(nbt.compound({ pos: nbt.list(3, [nbt.int(0), nbt.int(2), nbt.int(0)]), state: nbt.int(0) }));
  list.push(nbt.compound({
    pos: nbt.list(3, [nbt.int(2), nbt.int(2), nbt.int(2)]), state: nbt.int(palette.length - 2),
    nbt: nbt.compound({ id: nbt.string('minecraft:jigsaw'), final_state: nbt.string('minecraft:spruce_planks'), joint: nbt.string('rollable') }),
  }));
  list.push(nbt.compound({ pos: nbt.list(3, [nbt.int(3), nbt.int(2), nbt.int(2)]), state: nbt.int(palette.length - 1) }));
  return encodeNbt('', nbt.compound({
    DataVersion: nbt.int(4903),
    size: nbt.list(3, [nbt.int(5), nbt.int(4), nbt.int(3)]),
    palette: nbt.list(10, palette.map(stateCompound)),
    blocks: nbt.list(10, list),
    entities: nbt.list(10, [nbt.compound({
      pos: nbt.list(6, [nbt.double(1.5), nbt.double(1), nbt.double(1.5)]), blockPos: nbt.list(3, [nbt.int(1), nbt.int(1), nbt.int(1)]),
      nbt: nbt.compound({ id: nbt.string('minecraft:villager') }),
    })]),
  }));
}

// ------------------------------------------------------------------ beschädigte und zu große Dateien

function legacySchematic() {
  return encodeNbt('Schematic', nbt.compound({
    Width: nbt.short(2), Height: nbt.short(1), Length: nbt.short(1), Materials: nbt.string('Alpha'),
    Blocks: nbt.byteArray(Int8Array.from([1, 4])), Data: nbt.byteArray(Int8Array.from([0, 0])),
    Entities: nbt.list(10, []), TileEntities: nbt.list(10, []),
  }));
}

function protoSchematic() {
  return encodeNbt('Schematic', nbt.compound({
    Version: nbt.int(2), DataVersion: nbt.int(4903), Width: nbt.short(3), Height: nbt.short(1), Length: nbt.short(1),
    Palette: nbt.compound({ 'minecraft:air': nbt.int(0), ['__proto__']: nbt.int(1), constructor: nbt.int(2), 'minecraft:stone[__proto__=x]': nbt.int(3) }),
    BlockData: nbt.byteArray(Int8Array.from([1, 2, 3])),
  }));
}

function deepNbt() {
  const w = new Writer();
  w.u8(9);
  w.str('');
  for (let i = 0; i < 600; i++) {
    w.u8(9);
    w.i32(1);
  }
  w.u8(0);
  w.i32(0);
  return w.done();
}

// Deterministische „Zufallsbytes“ (kein NBT, kein gzip)
function garbage(length) {
  const out = Buffer.alloc(length);
  let s = 12345;
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (s >> 16) & 0xff;
  }
  out[0] = 0x42;
  return out;
}

function main() {
  const blocks = sceneBlocks();
  const v2 = gzip(spongeV2(blocks, SCENE_SIZE));
  write('house-v1.schem', gzip(spongeV2(blocks, SCENE_SIZE, { version: 1 })));
  write('house-v2.schem', v2);
  write('house-v3.schem', gzip(spongeV3(blocks, SCENE_SIZE)));
  write('house-raw-v2.schem', spongeV2(blocks, SCENE_SIZE));
  write('house-zlib-v2.schem', zlib.deflateSync(spongeV2(blocks, SCENE_SIZE), { level: 9 }));
  write('future-v2.schem', gzip(spongeV2(blocks, SCENE_SIZE, { dataVersion: 9999 })));
  write('regions.litematic', gzip(regionsLitematic()));
  write('big-palette.litematic', gzip(bigPaletteLitematic()));
  write('house.nbt', gzip(structureNbt()));
  write('legacy.schematic', gzip(legacySchematic()));
  write('proto.schem', gzip(protoSchematic()));
  write('all-air.schem', gzip(spongeFilled([4, 4, 4], () => 0)));
  write('truncated.schem', v2.subarray(0, Math.floor(v2.length / 2)));
  write('gzip-text.schem', gzip(Buffer.from('Das ist keine NBT-Datei.\n', 'utf8')));
  write('garbage.litematic', garbage(512));
  write('deep.nbt', gzip(deepNbt()));
  // 200 × 100 × 151 = 3.020.000 Steinblöcke (mehr als 3 Mio.)
  write('too-many-blocks.schem', gzip(spongeFilled([200, 100, 151])));
  // 4100 × 1 × 1: eine Kante länger als 4064
  write('too-wide.schem', gzip(spongeFilled([4100, 1, 1])));
  // entpackt 260 MB Nullen (Zip-Bombe für die 256-MB-Grenze)
  write('bomb.nbt', gzip(Buffer.alloc(260 * 1024 * 1024)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
