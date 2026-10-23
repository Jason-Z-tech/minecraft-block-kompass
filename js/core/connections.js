// Automatische Verbindungen wie im Spiel beim Platzieren (§6.3):
// Zäune, Mauern, Scheiben/Gitter, Treppenform, Redstone-Staub, Doppeltruhen, Zauntore, Schnee, Laub.
// Ohne Renderer: „voller Block“ wird über ID-Muster und Listen erkannt.

import { parseStateCached, formatState } from './blockstate.js';
import { isBlockDataLoaded, defaultPropsFrozen } from './block-data.js';

// --- Klassifizierung über IDs ---

const NON_FULL_SUFFIXES = [
  '_slab', '_stairs', '_fence', '_fence_gate', '_wall', '_pane', '_bars', '_door', '_trapdoor', '_carpet',
  '_sign', '_banner', '_pressure_plate', '_button', 'rail', 'torch', 'candle', '_cake', '_head', '_skull',
  '_bed', '_leaves', '_sapling', '_tulip', '_roots', '_fungus', '_sprouts', '_vines', '_plant', '_coral',
  '_coral_fan', '_wall_fan', 'chain', '_rod', 'glass', 'shulker_box', '_bud', '_shelf', '_grate', '_petals',
  '_egg', '_dripleaf', '_mushroom', 'copper_lantern', '_cauldron', 'anvil', 'campfire', '_statue', '_sensor',
  'copper_chest',
];

const NON_FULL_PREFIXES = ['potted_', 'attached_'];

const NON_FULL_IDS = new Set([
  'air', 'cave_air', 'void_air', 'water', 'lava', 'bubble_column', 'fire', 'soul_fire', 'light', 'barrier',
  'structure_void', 'nether_portal', 'end_portal', 'end_gateway', 'cobweb', 'scaffolding', 'ladder', 'snow',
  'powder_snow', 'ice', 'frosted_ice', 'slime_block', 'honey_block', 'farmland', 'dirt_path', 'cactus',
  'cactus_flower', 'sugar_cane', 'bamboo', 'kelp', 'seagrass', 'tall_seagrass', 'grass', 'short_grass',
  'tall_grass', 'fern', 'large_fern', 'dead_bush', 'bush', 'firefly_bush', 'short_dry_grass', 'tall_dry_grass',
  'leaf_litter', 'wildflowers', 'sweet_berry_bush', 'nether_wart', 'wheat', 'carrots', 'potatoes', 'beetroots',
  'melon_stem', 'pumpkin_stem', 'big_dripleaf_stem', 'cocoa', 'torchflower_crop', 'pitcher_crop', 'lily_pad',
  'vine', 'glow_lichen', 'sculk_vein', 'resin_clump', 'pale_hanging_moss', 'spore_blossom', 'mangrove_propagule',
  'chorus_flower', 'azalea', 'flowering_azalea', 'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet',
  'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower', 'sunflower', 'lilac',
  'rose_bush', 'peony', 'open_eyeblossom', 'closed_eyeblossom', 'golden_dandelion', 'frogspawn', 'sea_pickle',
  'sulfur_spike', 'redstone_wire',
  'repeater', 'comparator', 'lever', 'tripwire', 'tripwire_hook', 'daylight_detector', 'lectern', 'hopper',
  'brewing_stand', 'enchanting_table', 'grindstone', 'stonecutter', 'bell', 'composter', 'conduit', 'beacon',
  'end_portal_frame', 'pointed_dripstone', 'flower_pot', 'decorated_pot', 'sculk_shrieker', 'chest',
  'trapped_chest', 'ender_chest', 'piston_head', 'moving_piston', 'spawner',
  'trial_spawner', 'vault', 'heavy_core', 'dried_ghast', 'lantern', 'soul_lantern', 'cauldron', 'amethyst_cluster',
  'mangrove_roots', 'cake',
]);

// Volle Blöcke, deren Name nach einem Muster oben aussieht.
const FULL_OVERRIDES = new Set(['muddy_mangrove_roots', 'jack_o_lantern', 'sea_lantern']);

// Volle Form mit stabilen Seiten, aber durchsichtig: Zäune/Mauern/Scheiben verbinden trotzdem.
const STURDY_TRANSPARENT_IDS = new Set(['ice', 'frosted_ice', 'slime_block', 'beacon', 'spawner', 'trial_spawner', 'vault', 'mangrove_roots']);

// Ausnahmen ohne Verbindung (wie isExceptionForConnection im Spiel).
const CONNECTION_EXCEPTIONS = new Set(['barrier', 'carved_pumpkin', 'jack_o_lantern', 'melon', 'pumpkin']);

// Volle Blöcke, die keinen Redstone leiten.
const NON_CONDUCTOR_FULL = new Set(['observer', 'redstone_block', 'piston', 'sticky_piston']);
const PISTONS = new Set(['piston', 'sticky_piston']);

const fullCache = new Map();

export function isFullSolid(id) {
  const hit = fullCache.get(id);
  if (hit !== undefined) return hit;
  let full = true;
  if (FULL_OVERRIDES.has(id)) full = true;
  else if (NON_FULL_IDS.has(id)) full = false;
  else if (NON_FULL_PREFIXES.some((p) => id.startsWith(p))) full = false;
  else if (NON_FULL_SUFFIXES.some((s) => id.endsWith(s))) full = false;
  fullCache.set(id, full);
  return full;
}

export function isSturdyFull(id) {
  if (isFullSolid(id)) return true;
  if (STURDY_TRANSPARENT_IDS.has(id)) return true;
  return (id.endsWith('glass') || id.endsWith('_grate')) && !id.endsWith('_pane');
}

// Zustandsabhängig: Doppelstufen sind volle Blöcke, ausgefahrene Kolben nicht.
export function isFullSolidState(state) {
  const { id, props } = parseStateCached(state);
  if (id.endsWith('_slab')) return props.type === 'double';
  if (PISTONS.has(id)) return props.extended !== 'true';
  return isFullSolid(id);
}

export function isFence(id) {
  return id.endsWith('_fence');
}

export function isWoodenFence(id) {
  return isFence(id) && id !== 'nether_brick_fence';
}

export function isFenceGate(id) {
  return id.endsWith('_fence_gate');
}

export function isWall(id) {
  return id.endsWith('_wall');
}

export function isPaneLike(id) {
  return id.endsWith('glass_pane') || id.endsWith('_bars');
}

export function isStairs(id) {
  return id.endsWith('_stairs');
}

export function isChest(id) {
  return id === 'chest' || id === 'trapped_chest' || id.endsWith('copper_chest');
}

const SIGNAL_SOURCE_IDS = new Set([
  'comparator', 'redstone_torch', 'redstone_wall_torch', 'lever', 'daylight_detector', 'redstone_block', 'target',
  'lectern', 'trapped_chest', 'tripwire_hook', 'detector_rail', 'sculk_sensor', 'calibrated_sculk_sensor',
]);

export function isSignalSource(id) {
  return SIGNAL_SOURCE_IDS.has(id) || id.endsWith('_button') || id.endsWith('_pressure_plate') || id.endsWith('lightning_rod');
}

const KIND = { NONE: 0, FENCE: 1, GATE: 2, WALL: 3, PANE: 4, STAIRS: 5, WIRE: 6, CHEST: 7, SNOWY: 8, LEAVES: 9 };
const SNOWY_IDS = new Set(['grass_block', 'mycelium', 'podzol']);
const SNOW_IDS = new Set(['snow', 'snow_block', 'powder_snow']);

function kindOf(id) {
  if (isStairs(id)) return KIND.STAIRS;
  if (isFenceGate(id)) return KIND.GATE;
  if (isFence(id)) return KIND.FENCE;
  if (isWall(id)) return KIND.WALL;
  if (isPaneLike(id)) return KIND.PANE;
  if (id === 'redstone_wire') return KIND.WIRE;
  if (isChest(id)) return KIND.CHEST;
  if (SNOWY_IDS.has(id)) return KIND.SNOWY;
  if (id.endsWith('_leaves')) return KIND.LEAVES;
  return KIND.NONE;
}

// --- Richtungen und Zustandsinfos ---

const DIRS = ['north', 'east', 'south', 'west'];
const OFFSET = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const CW = { north: 'east', east: 'south', south: 'west', west: 'north' };
const CCW = { north: 'west', west: 'south', south: 'east', east: 'north' };
const AXIS = { north: 'z', south: 'z', east: 'x', west: 'x' };
const STAIR_SHAPES = ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'];
const WALL_SIDES = ['none', 'low', 'tall'];
const WIRE_SIDES = ['none', 'side', 'up'];
const CHEST_TYPES = ['single', 'left', 'right'];
// Block-Tag wall_post_override (26.2) ohne die Gruppen #signs, #banners, #pressure_plates (siehe isPostOverride).
const POST_OVERRIDE_IDS = new Set(['torch', 'soul_torch', 'redstone_torch', 'copper_torch', 'tripwire', 'cactus_flower']);

// Unterseite (Kollisionsform bei y = 0) des Blocks über einer Mauer, wie WallBlock mit getFaceShape(DOWN) und isCovered:
// voll = deckt den Pfosten-Test und jeden Arm (→ Seite tall), Mitte = nur den Pfosten-Test 7 … 9 (→ Pfosten).
const COVER_NONE = 0;
const COVER_CENTER = 1;
const COVER_FULL = 2;
const FULL_BOTTOM_IDS = new Set([
  'farmland', 'dirt_path', 'daylight_detector', 'barrier', 'end_portal_frame', 'enchanting_table', 'stonecutter', 'lectern',
  'campfire', 'soul_campfire', 'composter', 'sculk_sensor', 'calibrated_sculk_sensor', 'sculk_shrieker',
]);
const CENTER_BOTTOM_IDS = new Set([
  'flower_pot', 'decorated_pot', 'cake', 'brewing_stand', 'sea_pickle', 'turtle_egg', 'lily_pad', 'cactus', 'honey_block',
  'ender_chest', 'anvil', 'chipped_anvil', 'damaged_anvil',
]);

// Standardwerte, falls keine Blockdaten geladen sind (nur was die Logik hier liest).
function fallbackDefaults(id) {
  if (isStairs(id)) return { facing: 'north', half: 'bottom', shape: 'straight' };
  if (isFenceGate(id)) return { facing: 'north', in_wall: 'false', open: 'false' };
  if (isChest(id)) return { facing: 'north', type: 'single' };
  if (id === 'repeater' || id === 'comparator') return { facing: 'north' };
  if (id === 'observer') return { facing: 'south' };
  if (id.endsWith('_slab')) return { type: 'bottom' };
  if (isWall(id)) return { up: 'true', north: 'none', east: 'none', south: 'none', west: 'none' };
  if (isFence(id) || isPaneLike(id)) return { north: 'false', east: 'false', south: 'false', west: 'false' };
  if (id === 'redstone_wire') return { north: 'none', east: 'none', south: 'none', west: 'none', power: '0' };
  if (id.endsWith('_leaves')) return { persistent: 'false' };
  if (SNOWY_IDS.has(id)) return { snowy: 'false' };
  return {};
}

function stairsFullFaces(props) {
  const f = props.facing;
  switch (props.shape) {
    case 'inner_left': return [f, CCW[f]];
    case 'inner_right': return [f, CW[f]];
    case 'outer_left':
    case 'outer_right': return [];
    default: return [f];
  }
}

function bottomCover(id, props, kind, sturdyAll) {
  if (sturdyAll) return COVER_FULL;
  if (id.endsWith('_slab')) return props.type === 'top' ? COVER_NONE : COVER_FULL;
  if (kind === KIND.STAIRS) return props.half === 'top' ? COVER_NONE : COVER_FULL;
  if (id.endsWith('_trapdoor')) return props.half !== 'top' && props.open !== 'true' ? COVER_FULL : COVER_NONE;
  if (id === 'snow') return Number(props.layers) >= 2 ? COVER_FULL : COVER_NONE;
  if (id === 'pale_moss_carpet') return props.bottom === 'false' ? COVER_NONE : COVER_FULL;
  if (id.endsWith('_carpet') || id.endsWith('_leaves') || id.endsWith('shulker_box') || FULL_BOTTOM_IDS.has(id)) return COVER_FULL;
  if (kind === KIND.FENCE || kind === KIND.PANE || kind === KIND.WALL || kind === KIND.CHEST) return COVER_CENTER;
  if (kind === KIND.GATE) return props.open === 'true' ? COVER_NONE : COVER_CENTER;
  if (id === 'lantern' || id === 'soul_lantern' || id.endsWith('copper_lantern')) return props.hanging === 'true' ? COVER_NONE : COVER_CENTER;
  if (id === 'hopper') return props.facing === 'down' ? COVER_CENTER : COVER_NONE;
  if (id === 'candle' || id.endsWith('_candle') || id.endsWith('candle_cake') || id.startsWith('potted_') || CENTER_BOTTOM_IDS.has(id)) return COVER_CENTER;
  if ((id.endsWith('_head') || id.endsWith('_skull')) && !id.includes('_wall_') && id !== 'piston_head') return COVER_CENTER;
  if (id.endsWith('chain')) return props.axis === 'y' ? COVER_CENTER : COVER_NONE;
  if (id === 'end_rod' || id.endsWith('lightning_rod')) return props.facing === 'up' || props.facing === 'down' ? COVER_CENTER : COVER_NONE;
  return COVER_NONE;
}

function describeIndex(volume, index) {
  const { id, props } = parseStateCached(volume.palette[index]);
  const defaults = (isBlockDataLoaded() && defaultPropsFrozen(id)) || fallbackDefaults(id);
  const merged = { ...defaults, ...props };
  const isSlab = id.endsWith('_slab');
  const stairs = isStairs(id);
  const extendedPiston = PISTONS.has(id) && merged.extended === 'true';
  const fullState = isSlab ? merged.type === 'double' : !extendedPiston && isFullSolid(id);
  const sturdyAll = isSlab ? merged.type === 'double' : !stairs && !extendedPiston && isSturdyFull(id);
  const kind = index === 0 ? KIND.NONE : kindOf(id);
  return {
    index, id, props: merged, explicit: props, kind,
    sturdyAll,
    bottomCover: index === 0 ? COVER_NONE : bottomCover(id, merged, kind, sturdyAll),
    stairFaces: stairs ? stairsFullFaces(merged) : null,
    conductor: index !== 0 && fullState && !NON_CONDUCTOR_FULL.has(id),
    topSturdy: sturdyAll || id === 'hopper' || (isSlab && merged.type === 'top') || (stairs && merged.half === 'top'),
    exception: CONNECTION_EXCEPTIONS.has(id),
  };
}

function sturdyFace(info, face) {
  if (info.sturdyAll) return true;
  return info.stairFaces ? info.stairFaces.includes(face) : false;
}

function gateAcross(gate, dir) {
  return AXIS[gate.props.facing] === AXIS[CW[dir]];
}

function fenceConnects(self, n, dir) {
  if (n.kind === KIND.FENCE) return isWoodenFence(self.id) === isWoodenFence(n.id);
  if (n.kind === KIND.GATE) return gateAcross(n, dir);
  return !n.exception && sturdyFace(n, OPPOSITE[dir]);
}

function paneConnects(n, dir) {
  if (n.kind === KIND.PANE || n.kind === KIND.WALL) return true;
  return !n.exception && sturdyFace(n, OPPOSITE[dir]);
}

function wallConnects(n, dir) {
  if (n.kind === KIND.WALL || n.kind === KIND.PANE) return true;
  if (n.kind === KIND.GATE) return gateAcross(n, dir);
  return !n.exception && sturdyFace(n, OPPOSITE[dir]);
}

function connectsSide(info, dir) {
  const value = info.props[dir];
  return value !== undefined && value !== 'none' && value !== 'false';
}

function wireConnectsSameLevel(n, dir) {
  if (n.id === 'redstone_wire') return true;
  if (n.id === 'repeater') return AXIS[n.props.facing] === AXIS[dir];
  if (n.id === 'observer') return n.props.facing === dir;
  return isSignalSource(n.id);
}

function packKey(x, y, z) {
  return ((x + 16384) * 32768 + (y + 16384)) * 32768 + (z + 16384);
}

function sidesFromMask(mask, yes, no) {
  return Object.fromEntries(DIRS.map((dir, bit) => [dir, mask & (1 << bit) ? yes : no]));
}

function sideCode(sides, values) {
  return sides.reduce((sum, side, k) => sum + values.indexOf(side) * 3 ** k, 0);
}

// --- Hauptfunktion ---

// Wendet alle Verbindungen auf das Volumen an. isRawStep(step) → true: Block bleibt unverändert
// (wirkt aber als Nachbar). Gibt { changed } zurück.
export function applyConnections(volume, { isRawStep = () => false } = {}) {
  const infos = [];
  const info = (index) => infos[index] ?? (infos[index] = describeIndex(volume, index));
  const ctx = { stats: { changed: 0 }, resolved: new Map(), volume, info };
  ctx.at = (x, y, z) => info(volume.getIndex(x, y, z));
  ctx.current = (e) => info(e.chunk.blocks[e.i]);
  const byKind = collectCandidates(volume, info, isRawStep);
  const list = (kind) => byKind.get(kind) ?? [];

  for (const e of list(KIND.STAIRS)) {
    const self = ctx.current(e);
    const shape = stairsShape(self, (dx, dz) => ctx.at(e.x + dx, e.y, e.z + dz));
    apply(ctx, e, self, STAIR_SHAPES.indexOf(shape), () => ({ shape }));
  }
  for (const e of list(KIND.FENCE)) {
    const self = ctx.current(e);
    const mask = neighborMask(ctx, e, (n, dir) => fenceConnects(self, n, dir));
    apply(ctx, e, self, mask, () => sidesFromMask(mask, 'true', 'false'));
  }
  for (const e of list(KIND.PANE)) {
    const self = ctx.current(e);
    const mask = neighborMask(ctx, e, paneConnects);
    apply(ctx, e, self, mask, () => sidesFromMask(mask, 'true', 'false'));
  }
  for (const e of list(KIND.GATE)) {
    const self = ctx.current(e);
    const sides = AXIS[self.props.facing] === 'x' ? ['north', 'south'] : ['west', 'east'];
    const inWall = sides.some((dir) => ctx.at(e.x + OFFSET[dir][0], e.y, e.z + OFFSET[dir][1]).kind === KIND.WALL);
    apply(ctx, e, self, inWall ? 1 : 0, () => ({ in_wall: String(inWall) }));
  }
  for (const e of list(KIND.SNOWY)) {
    const self = ctx.current(e);
    const snowy = SNOW_IDS.has(ctx.at(e.x, e.y + 1, e.z).id);
    apply(ctx, e, self, snowy ? 1 : 0, () => ({ snowy: String(snowy) }));
  }
  for (const e of list(KIND.LEAVES)) {
    const self = ctx.current(e);
    apply(ctx, e, self, 0, () => ({ persistent: 'true' }));
  }
  for (const e of list(KIND.WIRE)) {
    const self = ctx.current(e);
    const sides = wireSides(self, e, ctx.at);
    apply(ctx, e, self, sideCode(sides, WIRE_SIDES), () => Object.fromEntries(DIRS.map((dir, k) => [dir, sides[k]])));
  }
  connectWalls(ctx, list(KIND.WALL));
  pairChests(ctx, list(KIND.CHEST));
  return { changed: ctx.stats.changed };
}

function collectCandidates(volume, info, isRawStep) {
  const byKind = new Map();
  for (const chunk of volume.chunkList()) {
    const { blocks, steps } = chunk;
    for (let i = 0; i < 4096; i++) {
      const index = blocks[i];
      if (index === 0) continue;
      const kind = info(index).kind;
      if (kind === KIND.NONE || isRawStep(steps[i])) continue;
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push({ chunk, i, x: chunk.cx * 16 + (i & 15), y: chunk.cy * 16 + (i >> 8), z: chunk.cz * 16 + ((i >> 4) & 15) });
    }
  }
  return byKind;
}

// Neuer Zustand = bisherige Eigenschaften + Patch; code identifiziert den Patch für den Zwischenspeicher.
function apply(ctx, e, base, code, makePatch) {
  const key = base.index * 1024 + code;
  let index = ctx.resolved.get(key);
  if (index === undefined) {
    index = ctx.volume.paletteIndex(formatState(base.id, { ...base.props, ...makePatch() }));
    ctx.resolved.set(key, index);
  }
  if (e.chunk.blocks[e.i] !== index) {
    e.chunk.blocks[e.i] = index;
    ctx.stats.changed++;
  }
}

function neighborMask(ctx, e, connects) {
  let mask = 0;
  DIRS.forEach((dir, bit) => {
    if (connects(ctx.at(e.x + OFFSET[dir][0], e.y, e.z + OFFSET[dir][1]), dir)) mask |= 1 << bit;
  });
  return mask;
}

// Logik wie StairBlock.getStairsShape; at(dx, dz) liefert den Nachbarn auf gleicher Höhe.
function stairsShape(self, at) {
  const { facing, half } = self.props;
  if (!OFFSET[facing]) return 'straight';
  const canTakeShape = (dir) => {
    const n = at(...OFFSET[dir]);
    return n.kind !== KIND.STAIRS || n.props.facing !== facing || n.props.half !== half;
  };
  const front = at(...OFFSET[facing]);
  if (front.kind === KIND.STAIRS && front.props.half === half) {
    const f2 = front.props.facing;
    if (AXIS[f2] && AXIS[f2] !== AXIS[facing] && canTakeShape(OPPOSITE[f2])) return f2 === CCW[facing] ? 'outer_left' : 'outer_right';
  }
  const back = at(...OFFSET[OPPOSITE[facing]]);
  if (back.kind === KIND.STAIRS && back.props.half === half) {
    const f3 = back.props.facing;
    if (AXIS[f3] && AXIS[f3] !== AXIS[facing] && canTakeShape(f3)) return f3 === CCW[facing] ? 'inner_left' : 'inner_right';
  }
  return 'straight';
}

// Logik wie RedStoneWireBlock.getConnectionState (Seiten none/side/up; Punkt, Kreuz, Linie).
function wireSides(self, e, at) {
  const canConnectUp = !at(e.x, e.y + 1, e.z).conductor;
  const sides = DIRS.map((dir) => {
    const [dx, dz] = OFFSET[dir];
    const n = at(e.x + dx, e.y, e.z + dz);
    if (canConnectUp) {
      const supports = n.id.endsWith('_trapdoor') || n.topSturdy;
      if (supports && at(e.x + dx, e.y + 1, e.z + dz).id === 'redstone_wire') return sturdyFace(n, OPPOSITE[dir]) ? 'up' : 'side';
    }
    if (wireConnectsSameLevel(n, dir)) return 'side';
    if (!n.conductor && at(e.x + dx, e.y - 1, e.z + dz).id === 'redstone_wire') return 'side';
    return 'none';
  });
  const [north, east, south, west] = sides.map((s) => s !== 'none');
  const explicitDot = DIRS.every((dir) => self.explicit[dir] === 'none');
  if (explicitDot && !north && !east && !south && !west) return sides;
  if (!north && !south) {
    if (!west) sides[3] = 'side';
    if (!east) sides[1] = 'side';
  }
  if (!east && !west) {
    if (!north) sides[0] = 'side';
    if (!south) sides[2] = 'side';
  }
  return sides;
}

// Mauern: erst alle Verbindungen, dann von oben nach unten low/tall und Pfosten (up) wie WallBlock.
function connectWalls(ctx, walls) {
  const masks = new Map();
  for (const e of walls) masks.set(packKey(e.x, e.y, e.z), neighborMask(ctx, e, wallConnects));
  const ordered = [...walls].sort((p, q) => q.y - p.y || p.z - q.z || p.x - q.x);
  for (const e of ordered) {
    const self = ctx.current(e);
    const mask = masks.get(packKey(e.x, e.y, e.z));
    const above = ctx.at(e.x, e.y + 1, e.z);
    const aboveMask = masks.get(packKey(e.x, e.y + 1, e.z));
    const sides = DIRS.map((dir, bit) => {
      if (!(mask & (1 << bit))) return 'none';
      return aboveCoversSide(above, aboveMask, dir, bit) ? 'tall' : 'low';
    });
    const up = wallPost(sides, above);
    const code = sideCode(sides, WALL_SIDES) + (up ? 81 : 0);
    apply(ctx, e, self, code, () => ({ ...Object.fromEntries(DIRS.map((dir, k) => [dir, sides[k]])), up: String(up) }));
  }
}

function aboveCoversSide(above, aboveMask, dir, bit) {
  if (above.bottomCover === COVER_FULL) return true;
  if (above.kind === KIND.WALL) return aboveMask !== undefined ? Boolean(aboveMask & (1 << bit)) : connectsSide(above, dir);
  if (above.kind === KIND.FENCE || above.kind === KIND.PANE) return connectsSide(above, dir);
  // Geschlossenes Zauntor: liegt quer durch die Mitte und deckt die beiden Arme in seiner Ebene
  if (above.kind === KIND.GATE) return above.props.open !== 'true' && AXIS[above.props.facing] !== AXIS[dir];
  return false;
}

function wallPost(sides, above) {
  if (above.kind === KIND.WALL && above.props.up === 'true') return true;
  const [n, e, s, w] = sides.map((side) => side === 'none');
  if ((n && s && w && e) || n !== s || w !== e) return true;
  if ((sides[0] === 'tall' && sides[2] === 'tall') || (sides[1] === 'tall' && sides[3] === 'tall')) return false;
  return isPostOverride(above) || above.bottomCover !== COVER_NONE;
}

// Tag wall_post_override: dazu alle Schilder außer Hängeschildern (#signs, auch an der Wand), alle Banner, Druckplatten.
function isPostOverride(info) {
  const { id } = info;
  if (POST_OVERRIDE_IDS.has(id) || id.endsWith('_pressure_plate') || id.endsWith('_banner')) return true;
  return id.endsWith('_sign') && !id.endsWith('hanging_sign');
}

// Wie ChestBlock.chestCanConnectTo: gleicher Block; Kupfertruhen (Tag copper_chests) in jeder Oxidationsstufe untereinander.
function chestsConnect(a, b) {
  return a === b || (a.endsWith('copper_chest') && b.endsWith('copper_chest'));
}

// Doppeltruhen: passende Truhe, gleiches facing, nebeneinander quer zu facing.
// Truhen mit ausdrücklich gesetztem type bleiben, wie sie sind.
function pairChests(ctx, chests) {
  const free = chests.filter((e) => ctx.current(e).explicit.type === undefined);
  const byPos = new Map(free.map((e) => [packKey(e.x, e.y, e.z), e]));
  const ordered = [...free].sort((p, q) => p.y - q.y || p.z - q.z || p.x - q.x);
  const paired = new Set();
  const setType = (e, type) => apply(ctx, e, ctx.current(e), CHEST_TYPES.indexOf(type), () => ({ type }));
  for (const e of ordered) {
    if (paired.has(e)) continue;
    const self = ctx.current(e);
    const facing = self.props.facing;
    if (!OFFSET[facing]) continue;
    for (const [side, mine, theirs] of [[CW[facing], 'left', 'right'], [CCW[facing], 'right', 'left']]) {
      const partner = byPos.get(packKey(e.x + OFFSET[side][0], e.y, e.z + OFFSET[side][1]));
      if (!partner || paired.has(partner)) continue;
      const other = ctx.current(partner);
      if (!chestsConnect(self.id, other.id) || other.props.facing !== facing) continue;
      setType(e, mine);
      setType(partner, theirs);
      paired.add(e);
      paired.add(partner);
      break;
    }
    if (!paired.has(e)) setType(e, 'single');
  }
}
