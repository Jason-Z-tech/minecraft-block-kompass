// Blockzustände aus fremden Dateien (Schematics, Litematica, Strukturdateien) auf Minecraft Java 26.2 bringen:
// Namensraum weg, umbenannte Blöcke über eine belegte Tabelle, unbekannte Eigenschaften weg, fehlende mit
// Standardwerten ergänzt (wie completeState). Luftarten und structure_void fallen weg. Rein (Browser/Worker/Node);
// die Blockdaten kommen aus js/core/block-data.js (vorher setBlockData).

import { formatState } from '../../core/blockstate.js';
import { blockProps, defaultPropsFrozen, isBlockDataLoaded } from '../../core/block-data.js';

/**
 * Umbenennungen seit der „Flattening“-Version 1.13 (alter Name → Name in 26.2). Jede Zeile ist gegen
 * game-data/blocks.json geprüft (Test: alter Name fehlt in 26.2, neuer Name existiert). Quellen: Versionsseiten
 * auf minecraft.wiki (Java Edition 1.14, 1.17, 1.20.3, 1.21.9).
 */
export const BLOCK_RENAMES = Object.freeze({
  sign: Object.freeze({ to: 'oak_sign', since: '1.14' }),
  wall_sign: Object.freeze({ to: 'oak_wall_sign', since: '1.14' }),
  grass_path: Object.freeze({ to: 'dirt_path', since: '1.17' }),
  grass: Object.freeze({ to: 'short_grass', since: '1.20.3' }),
  chain: Object.freeze({ to: 'iron_chain', since: '1.21.9' }),
});

// Mauern hatten bis 1.15 true/false an den Seiten, seit 1.16 none/low/tall.
const WALL_SIDES = new Set(['north', 'east', 'south', 'west']);
function renameValue(id, key, value) {
  if (id.endsWith('_wall') && WALL_SIDES.has(key)) {
    if (value === 'true') return 'low';
    if (value === 'false') return 'none';
  }
  return value;
}

/** Fallen beim Import weg (Luftarten und Platzhalter). */
export const DROPPED_IDS = Object.freeze(new Set(['air', 'cave_air', 'void_air', 'structure_void']));

const NAME = /^[a-z0-9_.\-/]+$/;
const MAX_STATE_LENGTH = 1024;

/**
 * Liest einen Zustand wie „minecraft:oak_stairs[facing=north,half=bottom]“ (Sponge-Paletten, jigsaw final_state).
 * Rückgabe { namespace, id, props, trailing } oder null bei Unlesbarem. Ohne Namensraum gilt „minecraft“.
 * trailing = Rest nach „]“ (z. B. NBT in „{…}“).
 */
export function parseForeignState(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_STATE_LENGTH) return null;
  const trimmed = text.trim();
  const open = trimmed.indexOf('[');
  const brace = trimmed.indexOf('{');
  const headEnd = open >= 0 ? open : brace >= 0 ? brace : trimmed.length;
  const head = trimmed.slice(0, headEnd).trim().toLowerCase();
  const colon = head.indexOf(':');
  const namespace = colon >= 0 ? head.slice(0, colon) : 'minecraft';
  const id = colon >= 0 ? head.slice(colon + 1) : head;
  if (!NAME.test(namespace) || !NAME.test(id)) return null;
  const props = new Map();
  let trailing = open >= 0 ? '' : trimmed.slice(headEnd).trim();
  if (open >= 0) {
    const close = trimmed.indexOf(']', open);
    if (close < 0) return null;
    trailing = trimmed.slice(close + 1).trim();
    const body = trimmed.slice(open + 1, close).trim();
    if (body !== '') {
      for (const part of body.split(',')) {
        const eq = part.indexOf('=');
        if (eq < 0) return null;
        props.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim().toLowerCase());
      }
    }
  }
  return { namespace, id, props, trailing };
}

/** Eigenschaften aus einem NBT-Compound (Litematica, Strukturdatei: { Name, Properties }) als Map. */
export function propsFromCompound(compound) {
  const props = new Map();
  if (compound === null || typeof compound !== 'object') return props;
  for (const key of Object.keys(compound)) {
    const value = compound[key];
    props.set(String(key).toLowerCase(), typeof value === 'string' ? value.toLowerCase() : String(value));
  }
  return props;
}

/** Zerlegt „namespace:id“ (Name aus Litematica/Strukturdatei) → { namespace, id } oder null. */
export function splitName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 256) return null;
  const lower = name.trim().toLowerCase();
  const colon = lower.indexOf(':');
  const namespace = colon >= 0 ? lower.slice(0, colon) : 'minecraft';
  const id = colon >= 0 ? lower.slice(colon + 1) : lower;
  return NAME.test(namespace) && NAME.test(id) ? { namespace, id } : null;
}

const MAX_WARNINGS = 40;
const fmt = (n) => n.toLocaleString('de-DE');
const blocksWord = (n) => (n === 1 ? '1 Block' : `${fmt(n)} Blöcke`);
const blocksDative = (n) => (n === 1 ? '1 Block' : `${fmt(n)} Blöcken`);
const shown = (text) => (text.length > 80 ? `${text.slice(0, 77)}…` : text);

/**
 * Wandelt Paletten-Einträge fremder Formate in 26.2-Zustände um und sammelt Warnungen je Block-ID.
 * Gemeinsame Ausgabe-Palette über alle Regionen einer Datei (palette[0] = 'air').
 *
 *   const conv = new StateConverter();
 *   const entry = conv.fromParts(namespace, id, propsMap);  // → { index, notes }
 *   conv.count(entry, n);                                  // n Blöcke mit diesem Eintrag (für Warnungen)
 *   conv.palette / conv.warnings() / conv.summary()
 */
export class StateConverter {
  constructor() {
    if (!isBlockDataLoaded()) throw new Error('Blockdaten sind nicht geladen – zuerst setBlockData(json) aufrufen.');
    this.palette = ['air'];
    this.paletteIndex = new Map([['air', 0]]);
    this.notes = new Map();
    this.cache = new Map();
  }

  #note(key, data) {
    let note = this.notes.get(key);
    if (!note) {
      note = { key, count: 0, ...data };
      this.notes.set(key, note);
    }
    return note;
  }

  #indexOf(state) {
    let index = this.paletteIndex.get(state);
    if (index === undefined) {
      if (this.palette.length >= 65535) throw new Error('mehr als 65535 verschiedene Blockzustände');
      index = this.palette.length;
      this.palette.push(state);
      this.paletteIndex.set(state, index);
    }
    return index;
  }

  /** Unlesbarer Eintrag (z. B. kaputter Paletten-Text) → Luft mit Warnung. */
  invalid(raw) {
    const text = shown(String(raw));
    return { index: 0, notes: [this.#note(`invalid:${text}`, { kind: 'invalid', id: text })] };
  }

  /** Zustand als Text („minecraft:stone[…]“). */
  fromString(text) {
    const cacheKey = `s:${text}`;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;
    const parsed = parseForeignState(text);
    const entry = parsed ? this.fromParts(parsed.namespace, parsed.id, parsed.props) : this.invalid(text);
    this.cache.set(cacheKey, entry);
    return entry;
  }

  /** Eintrag { Name, Properties } (Litematica, Strukturdatei). */
  fromCompound(compound) {
    const split = splitName(compound?.Name);
    if (!split) return this.invalid(compound?.Name ?? '(ohne Name)');
    return this.fromParts(split.namespace, split.id, propsFromCompound(compound.Properties));
  }

  fromParts(namespace, rawId, props) {
    const cacheKey = `p:${namespace}:${rawId}[${[...props].map(([k, v]) => `${k}=${v}`).join(',')}]`;
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;
    const entry = this.#convert(namespace, rawId, props);
    this.cache.set(cacheKey, entry);
    return entry;
  }

  #convert(namespace, rawId, props) {
    const notes = [];
    if (namespace !== 'minecraft') {
      notes.push(this.#note(`ns:${namespace}:${rawId}`, { kind: 'foreign', id: `${namespace}:${rawId}` }));
      return { index: 0, notes };
    }
    if (DROPPED_IDS.has(rawId)) return { index: 0, notes };
    let id = rawId;
    if (Object.hasOwn(BLOCK_RENAMES, rawId)) {
      id = BLOCK_RENAMES[rawId].to;
      notes.push(this.#note(`rename:${rawId}`, { kind: 'rename', id: rawId, to: id }));
    }
    const known = blockProps(id);
    if (!known) {
      notes.push(this.#note(`block:${id}`, { kind: 'unknown', id }));
      return { index: 0, notes };
    }
    const defaults = defaultPropsFrozen(id);
    const out = {};
    for (const key of Object.keys(known)) {
      let value = props.has(key) ? renameValue(id, key, props.get(key)) : defaults[key];
      if (!known[key].includes(value)) {
        notes.push(this.#note(`value:${id}:${key}:${shown(value)}`, { kind: 'value', id, prop: key, value: shown(value) }));
        value = defaults[key];
      }
      out[key] = value;
    }
    for (const key of props.keys()) {
      if (!Object.hasOwn(known, key)) notes.push(this.#note(`prop:${id}:${shown(key)}`, { kind: 'prop', id, prop: shown(key) }));
    }
    return { index: this.#indexOf(formatState(id, out)), notes };
  }

  /** n Blöcke nutzen diesen Eintrag (zählt für die Warnungen). */
  count(entry, n = 1) {
    if (n <= 0) return;
    for (const note of entry.notes) note.count += n;
  }

  #message(note) {
    const n = note.count;
    switch (note.kind) {
      case 'rename': return `„${note.id}“ heißt in Minecraft 26.2 „${note.to}“ – ${blocksWord(n)} umbenannt.`;
      case 'foreign': return `Block „${note.id}“ stammt aus einer Mod und fehlt in Minecraft 26.2 – ${blocksWord(n)} weggelassen.`;
      case 'unknown': return `Unbekannter Block „${note.id}“ (gibt es in Minecraft 26.2 nicht) – ${blocksWord(n)} weggelassen.`;
      case 'invalid': return `Unlesbarer Blockzustand „${note.id}“ – ${blocksWord(n)} weggelassen.`;
      case 'value': return `„${note.id}“ mit ${note.prop}=${note.value} gibt es in 26.2 nicht – bei ${blocksDative(n)} Standardwert gesetzt.`;
      default: return `„${note.id}“ hat in 26.2 keine Eigenschaft „${note.prop}“ – bei ${blocksDative(n)} ignoriert.`;
    }
  }

  /** Deutsche Warnungen (nur Einträge, die wirklich Blöcke betreffen), meiste zuerst, höchstens 40 + Sammelzeile. */
  warnings() {
    const used = [...this.notes.values()].filter((note) => note.count > 0).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    const lines = used.slice(0, MAX_WARNINGS).map((note) => this.#message(note));
    if (used.length > MAX_WARNINGS) lines.push(`… und ${used.length - MAX_WARNINGS} weitere Hinweise zu Blockzuständen.`);
    return lines;
  }

  /** Zählungen für stats: { renamed: [[alt, n]], dropped: [[id, n]], fixedValues: n, ignoredProps: n } (Listen, meiste zuerst). */
  summary() {
    const renamed = new Map();
    const dropped = new Map();
    let fixedValues = 0;
    let ignoredProps = 0;
    for (const note of this.notes.values()) {
      if (note.count === 0) continue;
      if (note.kind === 'rename') renamed.set(note.id, (renamed.get(note.id) ?? 0) + note.count);
      else if (note.kind === 'value') fixedValues += note.count;
      else if (note.kind === 'prop') ignoredProps += note.count;
      else dropped.set(note.id, (dropped.get(note.id) ?? 0) + note.count);
    }
    const sorted = (map) => [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { renamed: sorted(renamed), dropped: sorted(dropped), fixedValues, ignoredProps };
  }
}
