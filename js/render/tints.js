// Einfärbungen wie BlockColors im Spiel (Java 26.2), mit festen Werten des Ebene-Bioms (plains):
// Temperatur 0,8, Niederschlag 0,4 → Pixel (51, 173) der Colormaps grass/foliage/dry_foliage.
// Ergebnis immer 0xRRGGBB oder TINT_NONE (−1 = Fläche nicht einfärben).

export const TINT_NONE = -1;

export const PLAINS_COLORS = Object.freeze({
  grass: 0x91bd59,
  foliage: 0x77ab2f,
  dryFoliage: 0xa37546,
  birch: 0x80a755,
  spruce: 0x619961,
  // Mangroven im Mangrovensumpf (foliage_color des Bioms), nicht in der Ebene
  mangrove: 0x8db127,
  water: 0x3f76e4,
  lilyPad: 0x208030,
  attachedStem: 0xe0c71c,
});

const GRASS_TINTED = new Set(['grass_block', 'short_grass', 'fern', 'tall_grass', 'large_fern', 'potted_fern', 'bush', 'sugar_cane']);
// Nur tintindex 1 (Stängel) wird eingefärbt, tintindex 0 (Blüten) bleibt weiß.
const GRASS_TINTED_STEMS = new Set(['pink_petals', 'wildflowers']);

const FIXED_TINTS = new Map([
  ['oak_leaves', PLAINS_COLORS.foliage],
  ['jungle_leaves', PLAINS_COLORS.foliage],
  ['acacia_leaves', PLAINS_COLORS.foliage],
  ['dark_oak_leaves', PLAINS_COLORS.foliage],
  ['vine', PLAINS_COLORS.foliage],
  ['mangrove_leaves', PLAINS_COLORS.mangrove],
  ['birch_leaves', PLAINS_COLORS.birch],
  ['spruce_leaves', PLAINS_COLORS.spruce],
  ['leaf_litter', PLAINS_COLORS.dryFoliage],
  ['water', PLAINS_COLORS.water],
  ['bubble_column', PLAINS_COLORS.water],
  ['water_cauldron', PLAINS_COLORS.water],
  ['lily_pad', PLAINS_COLORS.lilyPad],
  ['attached_melon_stem', PLAINS_COLORS.attachedStem],
  ['attached_pumpkin_stem', PLAINS_COLORS.attachedStem],
]);

const f32 = Math.fround;

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// Wie ARGB.as8BitChannel: Mth.floor(wert * 255.0F) in float-Genauigkeit.
function channel(value) {
  return Math.floor(f32(value * 255));
}

// Wie RedStoneWireBlock.COLORS: Rot nach Signalstärke 0 … 15.
const REDSTONE_COLORS = Object.freeze(Array.from({ length: 16 }, (_, power) => {
  const f = f32(power / 15);
  const red = f32(f32(f * f32(0.6)) + (f > 0 ? f32(0.4) : f32(0.3)));
  const ff = f32(f * f);
  const green = clamp01(f32(f32(ff * f32(0.7)) - f32(0.5)));
  const blue = clamp01(f32(f32(ff * f32(0.6)) - f32(0.7)));
  return (channel(red) << 16) | (channel(green) << 8) | channel(blue);
}));

export function redstoneColor(power) {
  const level = Number(power);
  if (!Number.isInteger(level) || level < 0 || level > 15) throw new Error(`Redstone-Signalstärke muss 0 … 15 sein (bekommen: ${power}).`);
  return REDSTONE_COLORS[level];
}

// Wie BlockColors für Melonen-/Kürbisstängel: ARGB.color(age·32, 255 − age·8, age·4).
export function stemColor(age) {
  const stage = Number(age);
  if (!Number.isInteger(stage) || stage < 0 || stage > 7) throw new Error(`Stängel-Alter muss 0 … 7 sein (bekommen: ${age}).`);
  return ((stage * 32) << 16) | ((255 - stage * 8) << 8) | (stage * 4);
}

// Farbe für eine Fläche mit tintindex ≥ 0; props = Eigenschaften des vollständigen Zustands.
export function tintColor(id, props, tintIndex) {
  if (!Number.isInteger(tintIndex) || tintIndex < 0) return TINT_NONE;
  if (GRASS_TINTED.has(id)) return PLAINS_COLORS.grass;
  if (GRASS_TINTED_STEMS.has(id)) return tintIndex === 0 ? TINT_NONE : PLAINS_COLORS.grass;
  if (id === 'redstone_wire') return redstoneColor(props?.power ?? 0);
  if (id === 'melon_stem' || id === 'pumpkin_stem') return stemColor(props?.age ?? 0);
  return FIXED_TINTS.get(id) ?? TINT_NONE;
}

// Alle Blöcke mit eigener Einfärbung (für Tests und Fehlersuche).
export function tintedBlockIds() {
  return [...GRASS_TINTED, ...GRASS_TINTED_STEMS, 'redstone_wire', 'melon_stem', 'pumpkin_stem', ...FIXED_TINTS.keys()].sort();
}
