// Materialien (§6.5): Block → Gegenstand, Mengen, Stacks und Shulkerkisten.

import { parseStateCached } from './blockstate.js';

// Kein Material: Luftarten, Teile, die von selbst entstehen, und unsichtbare Technik-Blöcke (Lichtblock, Barriere,
// Strukturleere) – im Spiel nicht zu sehen und für das Nachbauen nicht nötig.
const NO_ITEM = new Set([
  'air', 'cave_air', 'void_air', 'piston_head', 'moving_piston', 'fire', 'soul_fire', 'nether_portal',
  'end_portal', 'end_gateway', 'bubble_column', 'frosted_ice', 'light', 'barrier', 'structure_void',
]);

// Sieht aus wie ein normaler Block, ist im Überleben aber nicht zu bekommen → zählt als sein sichtbares Gegenstück
// (infested_stone_bricks → stone_bricks, petrified_oak_slab → oak_slab).
function visibleCounterpart(id) {
  if (id.startsWith('infested_')) return id.slice('infested_'.length);
  if (id === 'petrified_oak_slab') return 'oak_slab';
  return null;
}

const DIRECT_ITEMS = {
  redstone_wire: 'redstone', tripwire: 'string',
  wheat: 'wheat_seeds', carrots: 'carrot', potatoes: 'potato', beetroots: 'beetroot_seeds',
  melon_stem: 'melon_seeds', attached_melon_stem: 'melon_seeds', pumpkin_stem: 'pumpkin_seeds',
  attached_pumpkin_stem: 'pumpkin_seeds', cocoa: 'cocoa_beans', sweet_berry_bush: 'sweet_berries',
  cave_vines: 'glow_berries', cave_vines_plant: 'glow_berries', torchflower_crop: 'torchflower_seeds',
  pitcher_crop: 'pitcher_pod', kelp_plant: 'kelp', twisting_vines_plant: 'twisting_vines',
  weeping_vines_plant: 'weeping_vines', big_dripleaf_stem: 'big_dripleaf', bamboo_sapling: 'bamboo',
  tall_seagrass: 'seagrass', powder_snow: 'powder_snow_bucket', farmland: 'dirt', dirt_path: 'dirt',
};

const HINTS = {
  farmland: 'Erde mit einer Hacke bearbeiten',
  dirt_path: 'Erde mit einer Schaufel bearbeiten',
  tall_seagrass: 'Seegras mit Knochenmehl wachsen lassen',
};

const POTTED_PLANTS = { azalea_bush: 'azalea', flowering_azalea_bush: 'flowering_azalea' };
const CAULDRON_FILLINGS = { water_cauldron: 'water_bucket', lava_cauldron: 'lava_bucket', powder_snow_cauldron: 'powder_snow_bucket' };
const COUNT_PROPS = ['candles', 'pickles', 'eggs', 'layers', 'flower_amount', 'segment_amount'];
const FACE_ITEMS = new Set(['glow_lichen', 'sculk_vein', 'resin_clump', 'vine']);
const FACE_KEYS = ['north', 'east', 'south', 'west', 'up', 'down'];

// Wand-Variante → stehender Block/Gegenstand (wall_torch → torch, white_wall_banner → white_banner), sonst null.
export function wallVariantBase(id) {
  if (id.startsWith('wall_')) return id.slice('wall_'.length);
  const at = id.indexOf('_wall_');
  return at < 0 ? null : `${id.slice(0, at)}_${id.slice(at + '_wall_'.length)}`;
}

function countFromProps(id, props) {
  if (id.endsWith('_slab') && props.type === 'double') return 2;
  for (const key of COUNT_PROPS) {
    const n = Number(props[key]);
    if (props[key] !== undefined && Number.isInteger(n) && n > 0) return n;
  }
  if (FACE_ITEMS.has(id)) return Math.max(1, FACE_KEYS.filter((key) => props[key] === 'true').length);
  return 1;
}

function resolveItem(state) {
  const { id, props } = parseStateCached(state);
  if (NO_ITEM.has(id)) return null;
  if (props.half === 'upper') return null; // Türen, doppelte Pflanzen: nur der untere Teil zählt
  if (id.endsWith('_bed') && props.part === 'foot') return null; // Betten zählen am Kopfteil
  if (id === 'water' || id === 'lava') {
    return props.level === undefined || props.level === '0' ? { item: `${id}_bucket`, count: 1 } : null;
  }
  if (id.startsWith('potted_')) {
    const plant = id.slice('potted_'.length);
    return { item: 'flower_pot', count: 1, extra: [[POTTED_PLANTS[plant] ?? plant, 1]] };
  }
  if (CAULDRON_FILLINGS[id]) return { item: 'cauldron', count: 1, extra: [[CAULDRON_FILLINGS[id], 1]] };
  if (id === 'candle_cake' || id.endsWith('_candle_cake')) {
    return { item: 'cake', count: 1, extra: [[id.slice(0, -'_cake'.length), 1]] };
  }
  const item = DIRECT_ITEMS[id] ?? visibleCounterpart(id) ?? wallVariantBase(id) ?? id;
  const result = { item, count: countFromProps(id, props) };
  if (HINTS[id]) result.hint = HINTS[id];
  return result;
}

const itemCache = new Map();

// → { item, count, extra?: [[item, n], …], hint?: string } | null (nicht platzierbar / entsteht von selbst)
export function itemForState(state) {
  if (itemCache.has(state)) return itemCache.get(state);
  const result = resolveItem(state);
  if (result) Object.freeze(result);
  if (itemCache.size > 50_000) itemCache.clear();
  itemCache.set(state, result);
  return result;
}

export function sortMaterials(totals) {
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

// Zählt je Paletten-Index, wandelt dann in Gegenstände um. counts: Array/TypedArray je Index.
export function materialsFromPaletteCounts(palette, counts) {
  const totals = new Map();
  for (let index = 1; index < palette.length; index++) {
    const n = counts[index];
    if (!n) continue;
    addItems(totals, itemForState(palette[index]), n);
  }
  return sortMaterials(totals);
}

export function addItems(totals, entry, blocks) {
  if (!entry) return;
  totals.set(entry.item, (totals.get(entry.item) ?? 0) + entry.count * blocks);
  for (const [item, n] of entry.extra ?? []) totals.set(item, (totals.get(item) ?? 0) + n * blocks);
}

export function countMaterials(volume, step = null) {
  const counts = new Float64Array(volume.palette.length);
  for (const chunk of volume.chunks.values()) {
    const { blocks, steps } = chunk;
    for (let i = 0; i < 4096; i++) {
      const index = blocks[i];
      if (index === 0) continue;
      if (step !== null && steps[i] !== step) continue;
      counts[index]++;
    }
  }
  return materialsFromPaletteCounts(volume.palette, counts);
}

const STACK_16_IDS = new Set(['egg', 'blue_egg', 'brown_egg', 'snowball', 'ender_pearl', 'armor_stand', 'honey_bottle', 'bucket', 'written_book']);
const STACK_1_IDS = new Set(['cake', 'saddle', 'totem_of_undying', 'potion', 'splash_potion', 'lingering_potion', 'writable_book', 'shulker_box', 'minecart', 'elytra', 'trident', 'bow', 'crossbow', 'shield', 'spyglass', 'mace']);
const STACK_1_SUFFIXES = ['_bed', '_bucket', '_boat', '_raft', '_minecart', '_shulker_box', '_sword', '_pickaxe', '_axe', '_shovel', '_hoe', '_helmet', '_chestplate', '_leggings', '_boots', '_horse_armor', '_music_disc'];

export function stackSize(item) {
  if (STACK_16_IDS.has(item) || item.endsWith('_sign') || item.endsWith('_banner')) return 16;
  if (STACK_1_IDS.has(item) || STACK_1_SUFFIXES.some((s) => item.endsWith(s)) || item.startsWith('music_disc_')) return 1;
  return 64;
}

function checkAmount(n, stack) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Menge muss eine ganze Zahl ≥ 0 sein, bekommen: ${n}.`);
  if (!Number.isInteger(stack) || stack < 1) throw new Error(`Stapelgröße muss eine ganze Zahl ≥ 1 sein, bekommen: ${stack}.`);
}

// 1 Shulkerkiste = 27 Stacks.
export function splitAmount(n, stack = 64) {
  checkAmount(n, stack);
  const perShulker = 27 * stack;
  const shulkers = Math.floor(n / perShulker);
  const left = n - shulkers * perShulker;
  const stacks = Math.floor(left / stack);
  return { shulkers, stacks, rest: left - stacks * stack };
}

function joinGerman(parts) {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
}

// „2 Shulkerkisten, 5 Stacks und 12“ / „1 Stack und 3“ / „12“. Nicht stapelbare Dinge: nur die Zahl.
export function formatAmount(n, stack = 64) {
  checkAmount(n, stack);
  if (n === 0) return '0';
  if (stack === 1) return String(n);
  const { shulkers, stacks, rest } = splitAmount(n, stack);
  const parts = [];
  if (shulkers) parts.push(`${shulkers} ${shulkers === 1 ? 'Shulkerkiste' : 'Shulkerkisten'}`);
  if (stacks) parts.push(`${stacks} ${stacks === 1 ? 'Stack' : 'Stacks'}`);
  if (rest) parts.push(String(rest));
  return joinGerman(parts);
}
