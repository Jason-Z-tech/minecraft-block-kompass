// Litematica (.litematic, Version 1 … 7) mit allen Regionen; jede Region wird ein Kapitel.
// Aufbau (fi.dy.masa.litematica LitematicaSchematic): Wurzel { Version, MinecraftDataVersion, Metadata, Regions:
// { name: { Position {x,y,z}, Size {x,y,z}, BlockStatePalette [ {Name, Properties} ], BlockStates long[], … } } }.
// Size darf negativ sein: die Region reicht dann von Position + Size + 1 bis Position. Die Blöcke liegen relativ zur
// kleinsten Ecke, Index (y·|sz| + z)·|sx| + x. BlockStates: je Eintrag max(2, ceil(log2(Palettengröße))) Bit,
// lückenlos über die Long-Grenzen gepackt (LitematicaBitArray, niedrigstes Bit zuerst).

import { longArrayWords } from './nbt.js';
import { ImportError, corrupt, isCompound, intValue, listLength, cleanText, progressTicker, formatInt } from './common.js';

const COORD_LIMIT = 2 ** 30;

export function isLitematic(root) {
  return isCompound(root?.value) && isCompound(root.value.Regions);
}

/** Bits pro Eintrag wie LitematicaBlockStateContainer: max(2, Bitlänge von (Palettengröße − 1)). */
export function litematicBits(paletteSize) {
  return Math.max(2, 32 - Math.clz32(Math.max(0, paletteSize - 1)));
}

function readVec(value, what) {
  if (!isCompound(value)) throw corrupt(`${what} fehlt`);
  const v = [intValue(value.x), intValue(value.y), intValue(value.z)];
  if (v.some((n) => n === null)) throw corrupt(`${what} unvollständig`);
  return v;
}

/** Kleinste Ecke und Betrag der Größe einer Region (negative Größen wie Litematica). */
export function regionBox(position, size) {
  const min = position.map((p, a) => (size[a] < 0 ? p + size[a] + 1 : p));
  return { min, size: size.map(Math.abs) };
}

function readRegion(name, region, ctx) {
  const { converter, collector, onProgress, warnings } = ctx;
  const label = cleanText(name, 60) ?? '(ohne Namen)';
  const where = `Region „${label}“`;
  if (!isCompound(region)) throw corrupt(`${where} ist kein Compound`);
  const { min, size } = regionBox(readVec(region.Position, `${where}: Position`), readVec(region.Size, `${where}: Size`));
  const [sx, sy, sz] = size;
  const info = { name: label, min, size, blocks: 0, entities: listLength(region.Entities), blockEntities: listLength(region.TileEntities) };
  if (sx === 0 || sy === 0 || sz === 0) {
    warnings.push(`${where} ist leer (Größe ${size.join(' × ')}).`);
    return info;
  }
  if (min.some((v, a) => Math.abs(v) > COORD_LIMIT || Math.abs(v + size[a]) > COORD_LIMIT)) throw corrupt(`${where} liegt außerhalb des gültigen Bereichs`);

  const palette = region.BlockStatePalette;
  if (!Array.isArray(palette) || palette.length === 0) throw corrupt(`${where}: BlockStatePalette fehlt`);
  if (palette.length > 65536) throw corrupt(`${where}: Palette mit ${palette.length} Einträgen`);
  const entries = palette.map((entry) => (isCompound(entry) ? converter.fromCompound(entry) : converter.invalid('(kein Compound)')));
  const indexMap = Int32Array.from(entries, (entry) => entry.index);
  const counts = new Float64Array(entries.length);

  const bits = litematicBits(palette.length);
  const volume = sx * sy * sz;
  const states = region.BlockStates;
  if (!(states instanceof BigInt64Array)) throw corrupt(`${where}: BlockStates fehlt`);
  const needed = Math.ceil((volume * bits) / 64);
  if (states.length < needed) {
    throw corrupt(`${where}: ${formatInt(states.length)} statt ${formatInt(needed)} Long-Werte für ${formatInt(volume)} Zellen mit ${bits} Bit`);
  }
  const words = longArrayWords(states);
  const mask = (1 << bits) - 1;
  const tick = progressTicker(onProgress, `Lese ${where}`, volume);
  collector.begin(ctx.multiple ? where : 'Aufbau');
  let outside = 0;
  let x = 0, y = 0, z = 0;
  const [ox, oy, oz] = min;
  for (let i = 0, bit = 0; i < volume; i++, bit += bits) {
    const w = bit >>> 5, shift = bit & 31;
    let value = words[w] >>> shift;
    if (shift + bits > 32) value |= words[w + 1] << (32 - shift);
    value &= mask;
    if (value < entries.length) {
      counts[value]++;
      const index = indexMap[value];
      if (index !== 0) {
        collector.push(ox + x, oy + y, oz + z, index);
        info.blocks++;
      }
    } else {
      outside++;
    }
    if (++x === sx) {
      x = 0;
      if (++z === sz) {
        z = 0;
        y++;
        tick(i);
      }
    }
  }
  if (outside > 0) warnings.push(`${where}: ${formatInt(outside)} Zellen verweisen auf keinen Paletteneintrag – als Luft behandelt.`);
  for (let i = 0; i < entries.length; i++) if (counts[i] > 0) converter.count(entries[i], counts[i]);
  return info;
}

/** Liest alle Regionen in den Sammler. ctx = { converter, collector, onProgress, warnings }. */
export function readLitematic(root, ctx) {
  const value = root.value;
  const version = intValue(value.Version);
  if (version !== null && version > 7) {
    ctx.warnings.push(`Litematica-Version ${version} ist neuer als bekannt (bis 7) – die Datei wird trotzdem gelesen.`);
  }
  const names = Object.keys(value.Regions);
  if (names.length === 0) throw new ImportError('no-blocks', 'Die Litematica-Datei enthält keine Regionen.');
  if (names.length > 1024) throw corrupt(`${names.length} Regionen`);
  const multiple = names.length > 1;
  const regions = names.map((name) => readRegion(name, value.Regions[name], { ...ctx, multiple }));
  const metadata = isCompound(value.Metadata) ? value.Metadata : {};
  return {
    formatLabel: version !== null ? `Litematica v${version}` : 'Litematica',
    version,
    dataVersion: intValue(value.MinecraftDataVersion),
    regions: regions.length,
    regionList: regions,
    entities: regions.reduce((sum, r) => sum + r.entities, 0),
    blockEntities: regions.reduce((sum, r) => sum + r.blockEntities, 0),
    title: cleanText(metadata.Name),
    author: cleanText(metadata.Author),
  };
}
