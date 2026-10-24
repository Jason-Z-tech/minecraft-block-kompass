// Sponge-Schematic (.schem) Version 1, 2 und 3 (WorldEdit, FastAsyncWorldEdit).
// Spezifikation: github.com/SpongePowered/Schematic-Specification (versions/schematic-1/2/3.md).
// v1/v2: Wurzel „Schematic“ mit Width/Height/Length (Short, vorzeichenlos), Palette { zustand: index }, BlockData
// (Varints). v3: unbenannte Wurzel mit Compound „Schematic“, Blöcke unter Blocks { Palette, Data, BlockEntities }.
// Reihenfolge der Zellen: index = x + z·Width + y·Width·Length (y außen, x innen).

import { ImportError, corrupt, isCompound, intValue, listLength, cleanText, progressTicker } from './common.js';

const MAX_VARINT_BYTES = 5;

/** Ist das eine Sponge-Schematic? Liefert das Schematic-Compound und die Version oder null. */
export function findSpongeSchematic(root) {
  const value = root?.value;
  if (!isCompound(value)) return null;
  if (isCompound(value.Schematic) && intValue(value.Schematic.Version) !== null) {
    return { schematic: value.Schematic, version: intValue(value.Schematic.Version) };
  }
  const version = intValue(value.Version);
  if (version !== null && (value.BlockData instanceof Int8Array || isCompound(value.Palette) || isCompound(value.Blocks))) {
    return { schematic: value, version };
  }
  return null;
}

function readDimension(schematic, key) {
  const raw = intValue(schematic[key]);
  if (raw === null) throw corrupt(`${key} fehlt`);
  const value = raw & 0xffff;
  if (value === 0) throw new ImportError('no-blocks', 'Die Schematic ist leer (eine Kante hat die Länge 0).');
  return value;
}

// Palette { "minecraft:stone": 0, … } → Liste rawIndex → Eintrag des Konverters.
function readPalette(palette, converter) {
  if (!isCompound(palette)) throw corrupt('Palette fehlt');
  const keys = Object.keys(palette);
  if (keys.length === 0) throw corrupt('Palette ist leer');
  let maxIndex = -1;
  for (const key of keys) {
    const index = intValue(palette[key]);
    if (index === null || index < 0) throw corrupt(`Paletteneintrag „${cleanText(key, 60)}“ ohne gültige Nummer`);
    if (index > maxIndex) maxIndex = index;
  }
  if (maxIndex >= keys.length * 4 + 1024) throw corrupt('Palette mit unplausiblen Nummern');
  const entries = new Array(maxIndex + 1).fill(null);
  for (const key of keys) entries[intValue(palette[key])] = converter.fromString(key);
  return entries;
}

/**
 * Liest die Blöcke einer Sponge-Schematic in den Sammler.
 * ctx = { converter, collector, onProgress, warnings }. Rückgabe: Infos für result.upload.
 */
export function readSchem(found, { converter, collector, onProgress, warnings, title = 'Aufbau', text = '' }) {
  const { schematic, version } = found;
  if (version < 1 || version > 3) {
    throw new ImportError('unsupported', `Sponge-Schematic Version ${version} wird nicht unterstützt (bekannt sind Version 1, 2 und 3).`);
  }
  const width = readDimension(schematic, 'Width');
  const height = readDimension(schematic, 'Height');
  const length = readDimension(schematic, 'Length');
  const container = version === 3 ? schematic.Blocks : schematic;
  if (version === 3 && !isCompound(container)) {
    throw new ImportError('no-blocks', 'Die Schematic enthält keine Blöcke (nur Biome oder Objekte).');
  }
  const data = version === 3 ? container.Data : container.BlockData;
  if (!(data instanceof Int8Array)) throw corrupt(version === 3 ? 'Blocks.Data fehlt' : 'BlockData fehlt');
  const entries = readPalette(container.Palette, converter);
  const indexMap = new Int32Array(entries.length);
  for (let i = 0; i < entries.length; i++) indexMap[i] = entries[i] ? entries[i].index : 0;
  const counts = new Float64Array(entries.length);

  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const total = width * height * length;
  const tick = progressTicker(onProgress, 'Lese Blöcke', total);
  collector.begin(title, text);
  let offset = 0;
  let missing = 0;
  let x = 0, y = 0, z = 0;
  for (let cell = 0; cell < total; cell++) {
    let value = 0, shift = 0, byte;
    do {
      if (offset >= bytes.length) throw corrupt(`die Blockdaten enden nach ${cell} von ${total} Zellen`);
      if (shift >= MAX_VARINT_BYTES * 7) throw corrupt('ungültige Zahl in den Blockdaten');
      byte = bytes[offset++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    value >>>= 0;
    if (value < entries.length && entries[value] !== null) {
      counts[value]++;
      const index = indexMap[value];
      if (index !== 0) collector.push(x, y, z, index);
    } else {
      missing++;
    }
    if (++x === width) {
      x = 0;
      if (++z === length) {
        z = 0;
        y++;
        tick(cell);
      }
    }
  }
  if (offset < bytes.length) warnings.push(`Nach den ${total.toLocaleString('de-DE')} Zellen folgen ${(bytes.length - offset).toLocaleString('de-DE')} überzählige Byte – ignoriert.`);
  if (missing > 0) warnings.push(`${missing.toLocaleString('de-DE')} Zellen verweisen auf keinen Paletteneintrag – als Luft behandelt.`);
  for (let i = 0; i < entries.length; i++) if (entries[i] && counts[i] > 0) converter.count(entries[i], counts[i]);

  const blockEntities = version === 3 ? listLength(container.BlockEntities) : listLength(schematic.BlockEntities) + listLength(schematic.TileEntities);
  const metadata = isCompound(schematic.Metadata) ? schematic.Metadata : {};
  return {
    formatLabel: `Sponge-Schematic v${version}`,
    version,
    dataVersion: intValue(schematic.DataVersion),
    size: [width, height, length],
    regions: 1,
    entities: listLength(schematic.Entities),
    blockEntities,
    title: cleanText(metadata.Name),
    author: cleanText(metadata.Author),
  };
}
