// Vanilla-Strukturdatei (.nbt aus dem Strukturblock, Format wie ARCHITEKTUR §5):
// { DataVersion, size [x, y, z], palette [ {Name, Properties} ] | palettes [[…], …], blocks [ {pos [x,y,z], state, nbt?} ],
//   entities [ … ] }. Wie im Spiel beim Platzieren: jigsaw → sein final_state, structure_block fällt weg,
// bei mehreren Paletten zählt die erste.

import { ImportError, corrupt, isCompound, intValue, listLength, progressTicker, formatInt, cleanText } from './common.js';

export function isStructureNbt(root) {
  const value = root?.value;
  return isCompound(value) && Array.isArray(value.size) && Array.isArray(value.blocks) && (Array.isArray(value.palette) || Array.isArray(value.palettes));
}

function pickPalette(value, warnings) {
  if (Array.isArray(value.palette)) return value.palette;
  const first = value.palettes[0];
  if (!Array.isArray(first)) throw corrupt('palettes ist leer');
  if (value.palettes.length > 1) warnings.push(`Die Struktur hat ${value.palettes.length} Paletten (Zufallsvarianten) – genommen wird die erste.`);
  return first;
}

/** Liest die Blöcke in den Sammler. ctx = { converter, collector, onProgress, warnings }. */
export function readStructureNbt(root, { converter, collector, onProgress, warnings, title = 'Aufbau' }) {
  const value = root.value;
  const size = value.size.map(intValue);
  if (size.length !== 3 || size.some((n) => n === null || n < 0)) throw corrupt('size ist ungültig');
  if (size.some((n) => n === 0)) throw new ImportError('no-blocks', 'Die Struktur ist leer (eine Kante hat die Länge 0).');
  const palette = pickPalette(value, warnings);
  const JIGSAW = -1;
  const entries = palette.map((entry) => {
    if (!isCompound(entry)) return converter.invalid('(kein Compound)');
    const name = typeof entry.Name === 'string' ? entry.Name.trim().toLowerCase() : '';
    if (name === 'minecraft:jigsaw' || name === 'jigsaw') return JIGSAW;
    if (name === 'minecraft:structure_block' || name === 'structure_block') return null;
    return converter.fromCompound(entry);
  });
  const jigsawCache = new Map();
  const jigsawEntry = (blockNbt) => {
    const finalState = isCompound(blockNbt) && typeof blockNbt.final_state === 'string' ? blockNbt.final_state : 'minecraft:air';
    let entry = jigsawCache.get(finalState);
    if (!entry) {
      entry = /^(minecraft:)?jigsaw\b/.test(finalState.trim()) ? null : converter.fromString(finalState.replace(/\{.*$/s, ''));
      jigsawCache.set(finalState, entry);
    }
    return entry;
  };

  const blocks = value.blocks;
  const tick = progressTicker(onProgress, 'Lese Blöcke', blocks.length);
  collector.begin(title);
  const seen = new Map();
  let badPos = 0, outside = 0, badState = 0;
  const [sx, sy, sz] = size;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const pos = block?.pos;
    if (!Array.isArray(pos) || pos.length !== 3) {
      badPos++;
      continue;
    }
    const x = intValue(pos[0]), y = intValue(pos[1]), z = intValue(pos[2]);
    if (x === null || y === null || z === null) {
      badPos++;
      continue;
    }
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) {
      outside++;
      continue;
    }
    const stateIndex = intValue(block.state);
    let entry = stateIndex !== null && stateIndex >= 0 && stateIndex < entries.length ? entries[stateIndex] : undefined;
    if (entry === undefined) {
      badState++;
      continue;
    }
    if (entry === JIGSAW) entry = jigsawEntry(block.nbt);
    if (entry === null) continue;
    seen.set(entry, (seen.get(entry) ?? 0) + 1);
    if (entry.index !== 0) collector.push(x, y, z, entry.index);
    tick(i);
  }
  if (badPos > 0) warnings.push(`${formatInt(badPos)} Blöcke ohne gültige Position – übersprungen.`);
  if (outside > 0) warnings.push(`${formatInt(outside)} Blöcke liegen außerhalb der Größe ${size.join(' × ')} – übersprungen.`);
  if (badState > 0) warnings.push(`${formatInt(badState)} Blöcke verweisen auf keinen Paletteneintrag – übersprungen.`);
  for (const [entry, n] of seen) converter.count(entry, n);
  return {
    formatLabel: 'Strukturdatei (.nbt)',
    version: null,
    dataVersion: intValue(value.DataVersion),
    size,
    regions: 1,
    entities: listLength(value.entities),
    blockEntities: blocks.reduce((sum, block) => sum + (isCompound(block?.nbt) ? 1 : 0), 0),
    title: null,
    author: cleanText(value.author),
  };
}
