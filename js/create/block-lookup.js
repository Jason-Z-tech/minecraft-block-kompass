// Blöcke aus Freitext finden (ARCHITEKTUR §12.1): deutsche und englische Namen aus names.json, IDs, Beugung
// („aus Steinziegeln“ → Steinziegel, „aus weißem Beton“ → Weißer Beton). Nur Blöcke aus blocks.json.
// Rein: kein DOM, läuft in Browser, Worker und Node.

import { normalize, damerauLevenshtein, allowedTypos } from './search.js';
import { isSturdyFull } from '../core/connections.js';
import { itemForState } from '../core/materials.js';
import { isBlockDataLoaded, allBlockIds, hasBlock, blockProps } from '../core/block-data.js';

export const BLOCK_MATCH_THRESHOLD = 0.6;
const ID_PATTERN = /^[a-z0-9_]{1,64}$/;

// Allgemeine Stoffwörter ohne eigenen Block → sinnvoller Standardblock (normalisiert, auch Stämme)
export const MATERIAL_DEFAULTS = Object.freeze({
  holz: 'oak_planks', bretter: 'oak_planks', planken: 'oak_planks', holzbretter: 'oak_planks', wood: 'oak_planks', planks: 'oak_planks',
  eiche: 'oak_planks', eichenholz: 'oak_planks', fichte: 'spruce_planks', fichtenholz: 'spruce_planks', birke: 'birch_planks',
  birkenholz: 'birch_planks', tropenholz: 'jungle_planks', akazie: 'acacia_planks', akazienholz: 'acacia_planks',
  schwarzeiche: 'dark_oak_planks', dunkeleiche: 'dark_oak_planks', mangrove: 'mangrove_planks', kirsche: 'cherry_planks',
  kirschholz: 'cherry_planks', bambus: 'bamboo_planks', blasseiche: 'pale_oak_planks',
  beton: 'white_concrete', concrete: 'white_concrete', wolle: 'white_wool', wool: 'white_wool',
  buntglas: 'white_stained_glass', ziegel: 'bricks', backstein: 'bricks', backsteine: 'bricks', bricks: 'bricks',
  quarz: 'quartz_block', quartz: 'quartz_block', gold: 'gold_block', eisen: 'iron_block', iron: 'iron_block',
  diamant: 'diamond_block', diamond: 'diamond_block', smaragd: 'emerald_block', emerald: 'emerald_block', lapis: 'lapis_block',
  kupfer: 'copper_block', copper: 'copper_block', redstone: 'redstone_block', kohle: 'coal_block', netherit: 'netherite_block',
  eis: 'ice', ice: 'ice', packeis: 'packed_ice', blaueis: 'blue_ice', schnee: 'snow_block', snow: 'snow_block',
  erde: 'dirt', dirt: 'dirt', gras: 'grass_block', grass: 'grass_block', sand: 'sand', kies: 'gravel', lehm: 'mud',
  ton: 'clay', laub: 'oak_leaves', blaetter: 'oak_leaves', leaves: 'oak_leaves', stamm: 'oak_log', staemme: 'oak_log', log: 'oak_log',
  terrakotta: 'terracotta', terracotta: 'terracotta', keramik: 'terracotta', marmor: 'quartz_block', granit: 'granite',
  netherziegel: 'nether_bricks', endstein: 'end_stone', purpur: 'purpur_block', leuchtstein: 'glowstone', glowstone: 'glowstone',
  seelaterne: 'sea_lantern', prismarin: 'prismarine', schleim: 'slime_block', honig: 'honey_block', amethyst: 'amethyst_block',
  tiefenschiefer: 'deepslate', schwarzstein: 'blackstone', basalt: 'basalt', tuff: 'tuff', calcit: 'calcite', moos: 'moss_block',
});

// Farben: Wortstamm → ID-Vorsilbe (für „rotem Glas“ → red_stained_glass)
const COLOR_STEMS = Object.freeze({
  weiss: 'white', hellgrau: 'light_gray', grau: 'gray', schwarz: 'black', braun: 'brown', rot: 'red', orange: 'orange',
  gelb: 'yellow', hellgruen: 'lime', limette: 'lime', gruen: 'green', tuerkis: 'cyan', hellblau: 'light_blue', blau: 'blue',
  violett: 'purple', lila: 'purple', magenta: 'magenta', rosa: 'pink', pink: 'pink',
});

const WORD_ENDINGS = ['ern', 'em', 'en', 'er', 'es', 'e', 'n', 's'];

/** Wortstamm für Blocknamen: Beugungs- und Pluralendungen weg (beide Seiten gleich behandelt). */
// Wiederholt bis nichts mehr abfällt, damit „grün“, „grüner“ und „grünem“ denselben Stamm bekommen.
export function blockStem(word) {
  let current = word;
  for (;;) {
    const ending = current.length > 3 ? WORD_ENDINGS.find((e) => current.endsWith(e) && current.length - e.length >= 3) : null;
    if (!ending) return current;
    current = current.slice(0, -ending.length);
  }
}

function stemWords(text) {
  return normalize(text).split(' ').filter(Boolean).map(blockStem);
}

/** Block-IDs aus blocks.json ({ blocks }), einer Liste/Menge von IDs oder (Rückfall) den geladenen Kerndaten. */
export function blockIdsOf(blocks, names = null) {
  if (Array.isArray(blocks)) return blocks.filter((id) => typeof id === 'string');
  if (blocks instanceof Set) return [...blocks].filter((id) => typeof id === 'string');
  if (blocks && typeof blocks === 'object') {
    const map = blocks.blocks && typeof blocks.blocks === 'object' ? blocks.blocks : blocks;
    return Object.keys(map);
  }
  if (isBlockDataLoaded()) return allBlockIds();
  if (names?.block && typeof names.block === 'object') return Object.keys(names.block);
  return [];
}

/** Eigenschaften eines Blocks ({ prop: [werte] }) aus blocks.json oder den Kerndaten; null = unbekannt. */
export function blockPropsOf(id, blocks) {
  const map = blocks && typeof blocks === 'object' && !Array.isArray(blocks) && !(blocks instanceof Set)
    ? (blocks.blocks && typeof blocks.blocks === 'object' ? blocks.blocks : blocks)
    : null;
  if (map) return Object.hasOwn(map, id) ? (map[id]?.props ?? {}) : null;
  if (isBlockDataLoaded()) return hasBlock(id) ? blockProps(id) ?? {} : null;
  return undefined;
}

/** Gibt es den Block? true/false, oder null, wenn keine Blockliste bekannt ist. */
export function blockExists(id, blocks) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return false;
  if (Array.isArray(blocks)) return blocks.includes(id);
  if (blocks instanceof Set) return blocks.has(id);
  const props = blockPropsOf(id, blocks);
  if (props === undefined) return null;
  return props !== null;
}

function nameEntry(names, id) {
  const table = names?.block && Object.hasOwn(names.block, id) ? names.block : names?.item && Object.hasOwn(names.item, id) ? names.item : null;
  const entry = table ? table[id] : null;
  return {
    de: typeof entry?.de === 'string' ? entry.de : null,
    en: typeof entry?.en === 'string' ? entry.en : null,
  };
}

/** Anzeigename: deutsch, sonst englisch, sonst ID. */
export function blockDisplayName(id, names) {
  const { de, en } = nameEntry(names, id);
  return de || en || id;
}

/** „Steinziegel · minecraft:stone_bricks“ */
export function blockDisplayLabel(id, names) {
  return `${blockDisplayName(id, names)} · minecraft:${id}`;
}

/** Für Formen gut geeignet: voller Würfel mit stabilen Seiten (auch Glas und Eis). */
export function isShapeFriendly(id) {
  return isSturdyFull(id);
}

// Nicht als einzelner Block setzbar (Luft, Feuer, Portale …) oder mehrteilig (Türen, Betten, hohe Pflanzen)
export function isPlaceableAlone(id, blocks) {
  if (!itemForState(id)) return false;
  const props = blockPropsOf(id, blocks);
  if (props && typeof props === 'object') {
    if (Array.isArray(props.part) && props.part.includes('head') && props.part.includes('foot')) return false;
    if (Array.isArray(props.half) && props.half.includes('upper') && props.half.includes('lower')) return false;
  }
  return !['structure_block', 'jigsaw', 'structure_void', 'light', 'barrier', 'water', 'lava', 'command_block',
    'chain_command_block', 'repeating_command_block', 'test_block', 'test_instance_block'].includes(id);
}

const indexCache = new WeakMap();
const EMPTY_KEY = {};

function buildIndex(names, blocks) {
  const ids = blockIdsOf(blocks, names);
  const entries = [];
  for (const id of ids) {
    if (!ID_PATTERN.test(id) || !itemForState(id)) continue;
    const { de, en } = nameEntry(names, id);
    const keys = [];
    for (const text of [de, en, id.replace(/_/g, ' ')]) {
      if (!text) continue;
      const words = stemWords(text);
      if (words.length) keys.push({ words, compact: words.join(''), plain: normalize(text).replace(/ /g, ''), set: new Set(words) });
    }
    entries.push({ id, de, en, keys, full: isShapeFriendly(id) });
  }
  return { entries, byId: new Map(entries.map((e) => [e.id, e])), ids: new Set(ids) };
}

function getIndex(names, blocks) {
  const outer = names && typeof names === 'object' ? names : EMPTY_KEY;
  const inner = blocks && typeof blocks === 'object' ? blocks : EMPTY_KEY;
  let byBlocks = indexCache.get(outer);
  if (!byBlocks) {
    byBlocks = new WeakMap();
    indexCache.set(outer, byBlocks);
  }
  let index = byBlocks.get(inner);
  // Ohne blocks hängt der Index an den geladenen Kerndaten – dann nicht dauerhaft zwischenspeichern
  if (!index || (inner === EMPTY_KEY && index.dataVersion !== (isBlockDataLoaded() ? allBlockIds().length : 0))) {
    index = buildIndex(names, blocks);
    index.dataVersion = inner === EMPTY_KEY ? (isBlockDataLoaded() ? allBlockIds().length : 0) : null;
    byBlocks.set(inner, index);
  }
  return index;
}

// „rotes Buntglas“ → Buntglas zu Glas (im Spiel heißt es „Rotes Glas“)
function prepareQueryWords(words) {
  const hasColor = words.some((w) => Object.hasOwn(COLOR_STEMS, w));
  return hasColor ? words.map((w) => (w === 'buntgla' ? 'gla' : w)) : words;
}

// Güte: genau gleich 1 · gleicher Stamm 0,96 · allgemeines Stoffwort 0,98 (siehe findBlocks) · Teilmengen und Tippfehler darunter
function scoreKey(queryWords, queryCompact, queryPlain, key) {
  if (key.plain === queryPlain) return 1;
  if (key.compact === queryCompact) return key.words.length === queryWords.length ? 0.96 : 0.94;
  const qSet = new Set(queryWords);
  const inKey = queryWords.filter((w) => key.set.has(w)).length;
  const inQuery = key.words.filter((w) => qSet.has(w)).length;
  let score = 0;
  if (inKey === queryWords.length) score = 0.9 * (queryWords.length / key.words.length);
  if (inQuery === key.words.length) score = Math.max(score, 0.8 * (key.words.length / queryWords.length));
  if (queryCompact.length >= 5 && key.compact.length >= 5) {
    const allowed = allowedTypos(Math.min(queryCompact.length, key.compact.length));
    if (queryCompact[0] === key.compact[0] && damerauLevenshtein(queryCompact, key.compact, allowed) <= allowed) score = Math.max(score, 0.7);
  }
  return score;
}

/**
 * Sucht Blöcke → [{ id, name, nameEn, score, full }], beste zuerst.
 * Optionen: names (names.json), blocks (blocks.json, Liste oder Menge von IDs), limit (8), fullOnly (nur volle Blöcke).
 */
export function findBlocks(query, { names = null, blocks = null, limit = 8, fullOnly = false } = {}) {
  const raw = typeof query === 'string' ? query.slice(0, 120) : '';
  const max = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 8;
  const index = getIndex(names, blocks);
  const scores = new Map();
  const put = (id, score) => {
    if (score > (scores.get(id) ?? 0)) scores.set(id, score);
  };

  // direkte ID („stone_bricks“, „minecraft:stone_bricks“)
  const idText = raw.trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_');
  if (ID_PATTERN.test(idText) && index.ids.has(idText)) put(idText, 1);

  const normalizedWords = normalize(raw).split(' ').filter(Boolean);
  const queryWords = prepareQueryWords(normalizedWords.map(blockStem));
  if (queryWords.length) {
    const queryCompact = queryWords.join('');
    const queryPlain = normalizedWords.join('');
    for (const entry of index.entries) {
      let best = 0;
      for (const key of entry.keys) best = Math.max(best, scoreKey(queryWords, queryCompact, queryPlain, key));
      if (best > 0) put(entry.id, best);
    }
    // allgemeines Stoffwort, ggf. mit Farbe („weißer Beton“ steht als Name schon oben)
    const material = [normalizedWords.join(''), ...normalizedWords].find((w) => Object.hasOwn(MATERIAL_DEFAULTS, w));
    if (material && normalizedWords.length === 1 && index.ids.has(MATERIAL_DEFAULTS[material])) put(MATERIAL_DEFAULTS[material], 0.98);
  }

  const out = [];
  for (const [id, score] of scores) {
    if (score < 0.3) continue;
    const entry = index.byId.get(id);
    const full = entry ? entry.full : isShapeFriendly(id);
    if (fullOnly && !full) continue;
    out.push({ id, name: blockDisplayName(id, names), nameEn: entry?.en ?? null, score: Math.round(score * 1000) / 1000, full });
  }
  // gleich gut: volle Blöcke und kürzere IDs zuerst (Glas vor Glasscheibe)
  out.sort((a, b) => b.score - a.score || Number(b.full) - Number(a.full) || a.id.length - b.id.length || a.id.localeCompare(b.id));
  return out.slice(0, max);
}

/** Beste Block-ID für einen Text oder null (Schwelle BLOCK_MATCH_THRESHOLD). */
export function blockForText(text, { names = null, blocks = null, fullOnly = false } = {}) {
  const [best] = findBlocks(text, { names, blocks, limit: 1, fullOnly });
  return best && best.score >= BLOCK_MATCH_THRESHOLD ? best.id : null;
}

/** Passende Treppe zu einem Block (stone_bricks → stone_brick_stairs, oak_planks → oak_stairs) oder null. */
export function stairsFor(id, { blocks = null } = {}) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (id.endsWith('_stairs')) return blockExists(id, blocks) === false ? null : id;
  const bases = [
    id,
    id.replace(/s$/, ''),
    id.replace(/_planks$/, ''),
    id.replace(/_block$/, ''),
    id.replace(/_(log|wood|stem|hyphae)$/, ''),
    id.replace(/^stripped_/, '').replace(/_(log|wood)$/, ''),
    id.replace(/_pillar$/, ''),
    id.replace(/^(chiseled|cut)_/, ''),
  ];
  for (const base of new Set(bases)) {
    const candidate = `${base}_stairs`;
    if (blockExists(candidate, blocks) === true) return candidate;
  }
  return null;
}
