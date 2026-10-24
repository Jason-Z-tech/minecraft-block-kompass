// Benannte Paletten für Bau-Module (ARCHITEKTUR §9.1): Rolle → echte Block-ID aus Minecraft 26.2.
// Werte sind reine IDs ohne [Eigenschaften], also direkt nutzbar für b.set/b.fill (Standardzustand),
// b.stairs/b.slab/b.door oder zusammengesetzt wie `${p.log}[axis=x]`.
// Jede Palette hat alle Rollen ihrer Art; gibt es eine Variante im Spiel nicht, ist die Rolle null.

export const WOOD_ROLES = Object.freeze([
  'planks', 'log', 'strippedLog', 'wood', 'strippedWood', 'stairs', 'slab', 'fence', 'fenceGate', 'door',
  'trapdoor', 'button', 'pressurePlate', 'sign', 'wallSign', 'hangingSign', 'wallHangingSign', 'shelf',
  'leaves', 'sapling', 'pottedSapling', 'mosaic', 'mosaicStairs', 'mosaicSlab',
]);

export const STONE_ROLES = Object.freeze([
  'block', 'stairs', 'slab', 'wall',
  'bricks', 'brickStairs', 'brickSlab', 'brickWall',
  'polished', 'polishedStairs', 'polishedSlab', 'polishedWall',
  'tiles', 'tileStairs', 'tileSlab', 'tileWall',
  'smooth', 'smoothStairs', 'smoothSlab',
  'cut', 'cutStairs', 'cutSlab',
  'rough', 'roughStairs', 'roughSlab', 'roughWall',
  'mossy', 'mossyStairs', 'mossySlab', 'mossyWall',
  'chiseled', 'chiseledBricks', 'cracked', 'crackedTiles', 'pillar', 'natural',
  'dark', 'darkStairs', 'darkSlab',
  'red', 'redStairs', 'redSlab', 'redWall',
  'gilded', 'fence', 'button', 'pressurePlate',
]);

export const COPPER_ROLES = Object.freeze([
  'grate', 'bulb', 'door', 'trapdoor', 'bars', 'chain', 'lantern', 'chest', 'lightningRod', 'torch', 'wallTorch',
]);

export const COLOR_ROLES = Object.freeze([
  'wool', 'carpet', 'concrete', 'concretePowder', 'terracotta', 'glazedTerracotta', 'stainedGlass',
  'stainedGlassPane', 'bed', 'candle', 'banner', 'wallBanner', 'shulkerBox',
]);

function complete(roles, values) {
  const palette = {};
  for (const role of roles) palette[role] = values[role] ?? null;
  for (const key of Object.keys(values)) {
    if (!roles.includes(key)) throw new Error(`Palette: unbekannte Rolle „${key}“.`);
  }
  return Object.freeze(palette);
}

// --- Holz ---

function woodPalette(prefix, overrides = {}) {
  const base = {
    planks: `${prefix}_planks`, log: `${prefix}_log`, strippedLog: `stripped_${prefix}_log`,
    wood: `${prefix}_wood`, strippedWood: `stripped_${prefix}_wood`, stairs: `${prefix}_stairs`, slab: `${prefix}_slab`,
    fence: `${prefix}_fence`, fenceGate: `${prefix}_fence_gate`, door: `${prefix}_door`, trapdoor: `${prefix}_trapdoor`,
    button: `${prefix}_button`, pressurePlate: `${prefix}_pressure_plate`, sign: `${prefix}_sign`,
    wallSign: `${prefix}_wall_sign`, hangingSign: `${prefix}_hanging_sign`, wallHangingSign: `${prefix}_wall_hanging_sign`,
    shelf: `${prefix}_shelf`, leaves: `${prefix}_leaves`, sapling: `${prefix}_sapling`, pottedSapling: `potted_${prefix}_sapling`,
  };
  return complete(WOOD_ROLES, { ...base, ...overrides });
}

function netherWood(prefix, wart) {
  return woodPalette(prefix, {
    log: `${prefix}_stem`, strippedLog: `stripped_${prefix}_stem`, wood: `${prefix}_hyphae`,
    strippedWood: `stripped_${prefix}_hyphae`, leaves: wart, sapling: `${prefix}_fungus`, pottedSapling: `potted_${prefix}_fungus`,
  });
}

export const WOOD = Object.freeze({
  eiche: woodPalette('oak'),
  fichte: woodPalette('spruce'),
  birke: woodPalette('birch'),
  dschungel: woodPalette('jungle'),
  akazie: woodPalette('acacia'),
  schwarzeiche: woodPalette('dark_oak'),
  mangrove: woodPalette('mangrove', { sapling: 'mangrove_propagule', pottedSapling: 'potted_mangrove_propagule' }),
  kirsche: woodPalette('cherry'),
  // Bambus: kein Laub und kein „Holz“ (sechsseitige Rinde); Stamm = Bambusblock.
  bambus: woodPalette('bamboo', {
    log: 'bamboo_block', strippedLog: 'stripped_bamboo_block', wood: null, strippedWood: null, leaves: null,
    sapling: 'bamboo_sapling', pottedSapling: 'potted_bamboo',
    mosaic: 'bamboo_mosaic', mosaicStairs: 'bamboo_mosaic_stairs', mosaicSlab: 'bamboo_mosaic_slab',
  }),
  blasseiche: woodPalette('pale_oak'),
  // Nether-Hölzer: Stängel/Hyphen statt Stamm/Holz, Warzenblock als Laub, Pilz als Setzling.
  karmesin: netherWood('crimson', 'nether_wart_block'),
  wirr: netherWood('warped', 'warped_wart_block'),
});

// --- Stein ---

const stone = (values) => complete(STONE_ROLES, values);
const STONE_PRESSURE = { button: 'stone_button', pressurePlate: 'stone_pressure_plate' };
const STONE_BRICKS = {
  bricks: 'stone_bricks', brickStairs: 'stone_brick_stairs', brickSlab: 'stone_brick_slab', brickWall: 'stone_brick_wall',
  mossy: 'mossy_stone_bricks', mossyStairs: 'mossy_stone_brick_stairs', mossySlab: 'mossy_stone_brick_slab',
  mossyWall: 'mossy_stone_brick_wall', cracked: 'cracked_stone_bricks', chiseled: 'chiseled_stone_bricks',
};
const COBBLE = { rough: 'cobblestone', roughStairs: 'cobblestone_stairs', roughSlab: 'cobblestone_slab', roughWall: 'cobblestone_wall' };
const SMOOTH_STONE = { smooth: 'smooth_stone', smoothSlab: 'smooth_stone_slab' };

function sandstonePalette(prefix) {
  return stone({
    block: `${prefix}sandstone`, stairs: `${prefix}sandstone_stairs`, slab: `${prefix}sandstone_slab`, wall: `${prefix}sandstone_wall`,
    smooth: `smooth_${prefix}sandstone`, smoothStairs: `smooth_${prefix}sandstone_stairs`, smoothSlab: `smooth_${prefix}sandstone_slab`,
    cut: `cut_${prefix}sandstone`, cutSlab: `cut_${prefix}sandstone_slab`, chiseled: `chiseled_${prefix}sandstone`,
    natural: `${prefix}sandstone`,
  });
}

function stonyPalette(name, { slabStairsWall = true, polished = true } = {}) {
  return stone({
    block: name, stairs: `${name}_stairs`, slab: `${name}_slab`, wall: slabStairsWall ? `${name}_wall` : null, natural: name,
    ...(polished ? { polished: `polished_${name}`, polishedStairs: `polished_${name}_stairs`, polishedSlab: `polished_${name}_slab` } : {}),
  });
}

// Kupfer: Stufe '' | 'exposed_' | 'weathered_' | 'oxidized_', gewachst mit Präfix 'waxed_'.
function copperPalette(stage, waxed) {
  const w = waxed ? 'waxed_' : '';
  const blockId = stage === '' ? `${w}copper_block` : `${w}${stage}copper`;
  return Object.freeze({
    ...stone({
      block: blockId, stairs: `${w}${stage}cut_copper_stairs`, slab: `${w}${stage}cut_copper_slab`,
      cut: `${w}${stage}cut_copper`, cutStairs: `${w}${stage}cut_copper_stairs`, cutSlab: `${w}${stage}cut_copper_slab`,
      chiseled: `${w}${stage}chiseled_copper`,
    }),
    grate: `${w}${stage}copper_grate`, bulb: `${w}${stage}copper_bulb`, door: `${w}${stage}copper_door`,
    trapdoor: `${w}${stage}copper_trapdoor`, bars: `${w}${stage}copper_bars`, chain: `${w}${stage}copper_chain`,
    lantern: `${w}${stage}copper_lantern`, chest: `${w}${stage}copper_chest`, lightningRod: `${w}${stage}lightning_rod`,
    torch: 'copper_torch', wallTorch: 'copper_wall_torch',
  });
}

export const COPPER = Object.freeze({
  kupfer: copperPalette('', false),
  'kupfer-angelaufen': copperPalette('exposed_', false),
  'kupfer-verwittert': copperPalette('weathered_', false),
  'kupfer-oxidiert': copperPalette('oxidized_', false),
  'kupfer-gewachst': copperPalette('', true),
  'kupfer-angelaufen-gewachst': copperPalette('exposed_', true),
  'kupfer-verwittert-gewachst': copperPalette('weathered_', true),
  'kupfer-oxidiert-gewachst': copperPalette('oxidized_', true),
});

export const STONE = Object.freeze({
  stein: stone({
    block: 'stone', stairs: 'stone_stairs', slab: 'stone_slab', natural: 'stone',
    ...STONE_BRICKS, ...COBBLE, ...SMOOTH_STONE, ...STONE_PRESSURE,
  }),
  bruchstein: stone({
    block: 'cobblestone', stairs: 'cobblestone_stairs', slab: 'cobblestone_slab', wall: 'cobblestone_wall',
    ...COBBLE, mossy: 'mossy_cobblestone', mossyStairs: 'mossy_cobblestone_stairs', mossySlab: 'mossy_cobblestone_slab',
    mossyWall: 'mossy_cobblestone_wall', natural: 'stone', ...SMOOTH_STONE, ...STONE_PRESSURE,
  }),
  steinziegel: stone({
    block: 'stone_bricks', stairs: 'stone_brick_stairs', slab: 'stone_brick_slab', wall: 'stone_brick_wall',
    ...STONE_BRICKS, ...COBBLE, ...SMOOTH_STONE, natural: 'stone', ...STONE_PRESSURE,
  }),
  tiefenschiefer: stone({
    block: 'deepslate_bricks', stairs: 'deepslate_brick_stairs', slab: 'deepslate_brick_slab', wall: 'deepslate_brick_wall',
    bricks: 'deepslate_bricks', brickStairs: 'deepslate_brick_stairs', brickSlab: 'deepslate_brick_slab', brickWall: 'deepslate_brick_wall',
    polished: 'polished_deepslate', polishedStairs: 'polished_deepslate_stairs', polishedSlab: 'polished_deepslate_slab', polishedWall: 'polished_deepslate_wall',
    tiles: 'deepslate_tiles', tileStairs: 'deepslate_tile_stairs', tileSlab: 'deepslate_tile_slab', tileWall: 'deepslate_tile_wall',
    rough: 'cobbled_deepslate', roughStairs: 'cobbled_deepslate_stairs', roughSlab: 'cobbled_deepslate_slab', roughWall: 'cobbled_deepslate_wall',
    chiseled: 'chiseled_deepslate', cracked: 'cracked_deepslate_bricks', crackedTiles: 'cracked_deepslate_tiles', natural: 'deepslate',
  }),
  schwarzstein: stone({
    block: 'polished_blackstone_bricks', stairs: 'polished_blackstone_brick_stairs', slab: 'polished_blackstone_brick_slab', wall: 'polished_blackstone_brick_wall',
    bricks: 'polished_blackstone_bricks', brickStairs: 'polished_blackstone_brick_stairs', brickSlab: 'polished_blackstone_brick_slab', brickWall: 'polished_blackstone_brick_wall',
    polished: 'polished_blackstone', polishedStairs: 'polished_blackstone_stairs', polishedSlab: 'polished_blackstone_slab', polishedWall: 'polished_blackstone_wall',
    rough: 'blackstone', roughStairs: 'blackstone_stairs', roughSlab: 'blackstone_slab', roughWall: 'blackstone_wall',
    chiseled: 'chiseled_polished_blackstone', cracked: 'cracked_polished_blackstone_bricks', natural: 'blackstone', gilded: 'gilded_blackstone',
    button: 'polished_blackstone_button', pressurePlate: 'polished_blackstone_pressure_plate',
  }),
  sandstein: sandstonePalette(''),
  'roter-sandstein': sandstonePalette('red_'),
  quarz: stone({
    block: 'quartz_block', stairs: 'quartz_stairs', slab: 'quartz_slab', bricks: 'quartz_bricks',
    smooth: 'smooth_quartz', smoothStairs: 'smooth_quartz_stairs', smoothSlab: 'smooth_quartz_slab',
    chiseled: 'chiseled_quartz_block', pillar: 'quartz_pillar',
  }),
  ziegel: stone({
    block: 'bricks', stairs: 'brick_stairs', slab: 'brick_slab', wall: 'brick_wall',
    bricks: 'bricks', brickStairs: 'brick_stairs', brickSlab: 'brick_slab', brickWall: 'brick_wall',
  }),
  schlammziegel: stone({
    block: 'mud_bricks', stairs: 'mud_brick_stairs', slab: 'mud_brick_slab', wall: 'mud_brick_wall',
    bricks: 'mud_bricks', brickStairs: 'mud_brick_stairs', brickSlab: 'mud_brick_slab', brickWall: 'mud_brick_wall', natural: 'packed_mud',
  }),
  tuffstein: stone({
    block: 'tuff_bricks', stairs: 'tuff_brick_stairs', slab: 'tuff_brick_slab', wall: 'tuff_brick_wall',
    bricks: 'tuff_bricks', brickStairs: 'tuff_brick_stairs', brickSlab: 'tuff_brick_slab', brickWall: 'tuff_brick_wall',
    polished: 'polished_tuff', polishedStairs: 'polished_tuff_stairs', polishedSlab: 'polished_tuff_slab', polishedWall: 'polished_tuff_wall',
    rough: 'tuff', roughStairs: 'tuff_stairs', roughSlab: 'tuff_slab', roughWall: 'tuff_wall',
    chiseled: 'chiseled_tuff', chiseledBricks: 'chiseled_tuff_bricks', natural: 'tuff',
  }),
  prismarin: stone({
    block: 'prismarine_bricks', stairs: 'prismarine_brick_stairs', slab: 'prismarine_brick_slab', wall: 'prismarine_wall',
    bricks: 'prismarine_bricks', brickStairs: 'prismarine_brick_stairs', brickSlab: 'prismarine_brick_slab',
    rough: 'prismarine', roughStairs: 'prismarine_stairs', roughSlab: 'prismarine_slab', roughWall: 'prismarine_wall',
    dark: 'dark_prismarine', darkStairs: 'dark_prismarine_stairs', darkSlab: 'dark_prismarine_slab', natural: 'prismarine',
  }),
  endstein: stone({
    block: 'end_stone_bricks', stairs: 'end_stone_brick_stairs', slab: 'end_stone_brick_slab', wall: 'end_stone_brick_wall',
    bricks: 'end_stone_bricks', brickStairs: 'end_stone_brick_stairs', brickSlab: 'end_stone_brick_slab', brickWall: 'end_stone_brick_wall',
    natural: 'end_stone',
  }),
  netherziegel: stone({
    block: 'nether_bricks', stairs: 'nether_brick_stairs', slab: 'nether_brick_slab', wall: 'nether_brick_wall',
    bricks: 'nether_bricks', brickStairs: 'nether_brick_stairs', brickSlab: 'nether_brick_slab', brickWall: 'nether_brick_wall',
    cracked: 'cracked_nether_bricks', chiseled: 'chiseled_nether_bricks', fence: 'nether_brick_fence', natural: 'netherrack',
    red: 'red_nether_bricks', redStairs: 'red_nether_brick_stairs', redSlab: 'red_nether_brick_slab', redWall: 'red_nether_brick_wall',
  }),
  purpur: stone({ block: 'purpur_block', stairs: 'purpur_stairs', slab: 'purpur_slab', pillar: 'purpur_pillar' }),
  harz: stone({
    block: 'resin_bricks', stairs: 'resin_brick_stairs', slab: 'resin_brick_slab', wall: 'resin_brick_wall',
    bricks: 'resin_bricks', brickStairs: 'resin_brick_stairs', brickSlab: 'resin_brick_slab', brickWall: 'resin_brick_wall',
    chiseled: 'chiseled_resin_bricks', natural: 'resin_block',
  }),
  andesit: stonyPalette('andesite'),
  diorit: stonyPalette('diorite'),
  granit: stonyPalette('granite'),
  ...COPPER,
});

// --- Farben (16 Farbstoffe) ---

export const COLOR_IDS = Object.freeze({
  weiss: 'white', orange: 'orange', magenta: 'magenta', hellblau: 'light_blue', gelb: 'yellow', hellgruen: 'lime',
  rosa: 'pink', grau: 'gray', hellgrau: 'light_gray', tuerkis: 'cyan', violett: 'purple', blau: 'blue',
  braun: 'brown', gruen: 'green', rot: 'red', schwarz: 'black',
});

function colorPalette(color) {
  return complete(COLOR_ROLES, {
    wool: `${color}_wool`, carpet: `${color}_carpet`, concrete: `${color}_concrete`, concretePowder: `${color}_concrete_powder`,
    terracotta: `${color}_terracotta`, glazedTerracotta: `${color}_glazed_terracotta`, stainedGlass: `${color}_stained_glass`,
    stainedGlassPane: `${color}_stained_glass_pane`, bed: `${color}_bed`, candle: `${color}_candle`, banner: `${color}_banner`,
    wallBanner: `${color}_wall_banner`, shulkerBox: `${color}_shulker_box`,
  });
}

export const COLOR = Object.freeze(Object.fromEntries(Object.entries(COLOR_IDS).map(([name, id]) => [name, colorPalette(id)])));

// --- Glas, Pflanzen, Licht ---

export const GLASS = Object.freeze({ block: 'glass', pane: 'glass_pane', tinted: 'tinted_glass' });

// Kleine Blumen (1 Block hoch), passend für Blumenkästen und Beete; POTTED = dieselben im Topf.
export const FLOWERS = Object.freeze([
  'poppy', 'dandelion', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip',
  'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley',
]);
export const WARM_FLOWERS = Object.freeze(['poppy', 'dandelion', 'red_tulip', 'orange_tulip']);
export const COOL_FLOWERS = Object.freeze(['blue_orchid', 'allium', 'azure_bluet', 'cornflower', 'lily_of_the_valley', 'white_tulip']);
export const POTTED = Object.freeze([
  ...FLOWERS.map((id) => `potted_${id}`), 'potted_fern', 'potted_azalea_bush', 'potted_flowering_azalea_bush', 'potted_cactus',
]);

// Alle Paletten nach Art, z. B. für Auswahl-Listen: allPalettes().wood → [['eiche', {…}], …].
export function allPalettes() {
  return { wood: Object.entries(WOOD), stone: Object.entries(STONE), color: Object.entries(COLOR) };
}
