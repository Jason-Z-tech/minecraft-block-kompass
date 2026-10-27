// Feste Quellen der Spieldaten im Browser („Weg A“): einzelne Dateien aus misode/mcmeta auf GitHub, jede an einen
// vollen Commit-SHA gebunden (unveränderlich, darum dauerhaft speicherbar). Läuft in Browser, Worker und Node.
// Für Tests ersetzt der Testserver MCMETA_BASE beim Ausliefern durch '/__mcmeta/' (tests/lib/mcmeta-mirror.mjs);
// die Zeile darum genau so lassen: export const MCMETA_BASE = '…';

import { structurePathFromFile } from './convert.js';

export const MCMETA_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/';

// summary: Blockbericht, alle Blockstates und Modelle · atlas: Textur-Atlanten · assets: .png.mcmeta der Texturen ·
// assetsJson: Sprachdateien · data: Struktur-NBTs (alle für Minecraft Java 26.2)
export const MCMETA_COMMITS = Object.freeze({
  summary: '711a353b47d84e6cb592a1b72f682e5f44759284',
  atlas: 'dbfab67355c11fdddefdab9f5099e3ae72e7c8f5',
  assets: 'a4151022c4c3870ac75e8d3a90e5c28e81137b60',
  assetsJson: '9a92e5dfd8f4539e636fa32e3e19879019d696ea',
  data: '4d12c0553e21e461085d08dcb2c5d412398c494e',
});

export const GAME_VERSION = Object.freeze({ id: '26.2', dataVersion: 4903 });

export const ATLASES = Object.freeze(['blocks', 'items', 'entities']);

// Dateien im summary-Commit
export const SUMMARY_FILES = Object.freeze({
  version: 'version.json',
  blocks: 'blocks/data.min.json',
  blockDefinitions: 'assets/block_definition/data.min.json',
  models: 'assets/model/data.min.json',
});

// Dateien im assetsJson-Commit
export const LANG_FILES = Object.freeze({
  de: 'assets/minecraft/lang/de_de.json',
  en: 'assets/minecraft/lang/en_us.json',
});

// Texturen, deren .png.mcmeta gebraucht wird (Animation oder mipmap_strategy): genau die Einträge von
// game-data/textures.json mit `anim` oder `mip` (ein Unit-Test vergleicht beides). Sortiert.
export const MCMETA_TEXTURES = Object.freeze([
  'block/acacia_leaves', 'block/allium', 'block/amethyst_cluster', 'block/azalea_leaves', 'block/azure_bluet',
  'block/birch_leaves', 'block/blast_furnace_front_on', 'block/blue_orchid', 'block/brown_mushroom', 'block/cactus_flower',
  'block/campfire_fire', 'block/campfire_log_lit', 'block/chain_command_block_back', 'block/chain_command_block_conditional',
  'block/chain_command_block_front', 'block/chain_command_block_side', 'block/cherry_leaves', 'block/closed_eyeblossom',
  'block/command_block_back', 'block/command_block_conditional', 'block/command_block_front', 'block/command_block_side',
  'block/copper_lantern', 'block/cornflower', 'block/crimson_fungus', 'block/crimson_stem', 'block/dandelion',
  'block/dark_oak_leaves', 'block/exposed_copper_lantern', 'block/fire_0', 'block/fire_1', 'block/firefly_bush_emissive',
  'block/flowering_azalea_leaves', 'block/glass', 'block/jungle_leaves', 'block/kelp', 'block/kelp_plant', 'block/lantern',
  'block/large_amethyst_bud', 'block/lava_flow', 'block/lava_still', 'block/lily_of_the_valley', 'block/magma',
  'block/mangrove_leaves', 'block/mangrove_roots_side', 'block/mangrove_roots_top', 'block/medium_amethyst_bud',
  'block/nether_portal', 'block/nether_sprouts', 'block/oak_leaves', 'block/open_eyeblossom', 'block/orange_tulip',
  'block/oxeye_daisy', 'block/oxidized_copper_lantern', 'block/pale_oak_leaves', 'block/pink_tulip', 'block/poppy',
  'block/prismarine', 'block/red_mushroom', 'block/red_tulip', 'block/redstone_dust_dot', 'block/redstone_dust_line0',
  'block/redstone_dust_line1', 'block/redstone_dust_overlay', 'block/repeating_command_block_back',
  'block/repeating_command_block_conditional', 'block/repeating_command_block_front', 'block/repeating_command_block_side',
  'block/respawn_anchor_top', 'block/sculk', 'block/sculk_catalyst_side_bloom', 'block/sculk_catalyst_top_bloom',
  'block/sculk_sensor_tendril_active', 'block/sculk_sensor_tendril_inactive', 'block/sculk_shrieker_can_summon_inner_top',
  'block/sculk_shrieker_inner_top', 'block/sculk_vein', 'block/sea_lantern', 'block/seagrass', 'block/small_amethyst_bud',
  'block/smoker_front_on', 'block/soul_campfire_fire', 'block/soul_campfire_log_lit', 'block/soul_fire_0', 'block/soul_fire_1',
  'block/soul_lantern', 'block/spruce_leaves', 'block/stonecutter_saw', 'block/sweet_berry_bush_stage0',
  'block/tall_seagrass_bottom', 'block/tall_seagrass_top', 'block/torchflower', 'block/warped_fungus', 'block/warped_stem',
  'block/water_flow', 'block/water_still', 'block/weathered_copper_lantern', 'block/white_tulip', 'block/wither_rose',
  'entity/conduit/wind', 'entity/conduit/wind_vertical',
]);

const KIB = 1024;
const MIB = 1024 * KIB;

// Größte erlaubte Antwort je Dateiart (entpackt). Heute: Modelle ≈ 0,9 MB, Sprachdatei ≈ 0,6 MB, größter Atlas ≈ 1 MB,
// .mcmeta < 1 KB, größte Struktur ≈ 80 KB.
export const LIMITS = Object.freeze({
  json: 4 * MIB,
  lang: 2 * MIB,
  png: 4 * MIB,
  mcmeta: 64 * KIB,
  nbt: 1 * MIB,
});

// Pfad im Repo: nur Kleinbuchstaben, Ziffern und _ . / -, keine leeren Segmente, kein „..“, nicht mit „/“ beginnend.
const PATH_PATTERN = /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/;
const MAX_PATH_LENGTH = 300;
// Texturname („block/water_still“) und Strukturpfad unter data/minecraft/structure/ (ohne Endung): Segmente aus [a-z0-9_-]
const RESOURCE_PATH_PATTERN = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/;

export function isValidMcmetaPath(path) {
  return typeof path === 'string' && path.length <= MAX_PATH_LENGTH && PATH_PATTERN.test(path) && !path.includes('..')
    && path.split('/').every((segment) => segment !== '.');
}

function shown(value) {
  return typeof value === 'string' ? value.slice(0, 80) : typeof value;
}

// → volle Adresse einer Datei im angegebenen Commit. Wirft bei unbekanntem Commit oder unsicherem Pfad.
export function mcmetaUrl(commitKey, path) {
  if (typeof commitKey !== 'string' || !Object.prototype.hasOwnProperty.call(MCMETA_COMMITS, commitKey)) {
    throw new Error(`Unbekannte Spieldaten-Quelle „${shown(commitKey)}“ (erlaubt: ${Object.keys(MCMETA_COMMITS).join(', ')}).`);
  }
  if (!isValidMcmetaPath(path)) throw new Error(`Ungültiger Dateipfad „${shown(path)}“ für die Spieldaten.`);
  return `${MCMETA_BASE}${MCMETA_COMMITS[commitKey]}/${path}`;
}

// Pfade im atlas-Commit: Bild und Positionen ({ "block/stone": [x, y, w, h], … })
export function atlasFiles(name) {
  if (!ATLASES.includes(name)) throw new Error(`Unbekannter Atlas „${shown(name)}“ (erlaubt: ${ATLASES.join(', ')}).`);
  return { png: `${name}/atlas.png`, data: `${name}/data.min.json` };
}

// Pfad der .png.mcmeta einer Textur im assets-Commit, z. B. „block/water_still“
export function textureMcmetaPath(textureName) {
  if (typeof textureName !== 'string' || textureName.length > MAX_PATH_LENGTH || !RESOURCE_PATH_PATTERN.test(textureName)) {
    throw new Error(`Ungültiger Texturname „${shown(textureName)}“.`);
  }
  return `assets/minecraft/textures/${textureName}.png.mcmeta`;
}

// Pfad einer Struktur im data-Commit, z. B. „village/plains/houses/plains_small_house_1“
export function structureRepoPath(structurePath) {
  if (typeof structurePath !== 'string' || structurePath.length > MAX_PATH_LENGTH || !RESOURCE_PATH_PATTERN.test(structurePath)) {
    throw new Error(`Ungültiger Strukturpfad „${shown(structurePath)}“.`);
  }
  return `data/minecraft/structure/${structurePath}.nbt`;
}

export function structureUrl(structurePath) {
  return mcmetaUrl('data', structureRepoPath(structurePath));
}

// Dateiname wie in game-data/structures/ („village__plains__houses__plains_small_house_1.json“) → Adresse der .nbt
export function structureFileToUrl(file) {
  return structureUrl(structurePathFromFile(file));
}

// Alle festen Dateien (ohne Strukturen, die hängen vom Katalog ab): { key: Commit-Schlüssel, commit: voller SHA,
// path, limit: Bytes }. Reihenfolge: summary, atlas, assetsJson, assets (.mcmeta).
export function allFixedFiles() {
  const entry = (key, path, limit) => ({ key, commit: MCMETA_COMMITS[key], path, limit: LIMITS[limit] });
  return [
    ...Object.values(SUMMARY_FILES).map((path) => entry('summary', path, 'json')),
    ...ATLASES.flatMap((name) => {
      const files = atlasFiles(name);
      return [entry('atlas', files.png, 'png'), entry('atlas', files.data, 'json')];
    }),
    ...Object.values(LANG_FILES).map((path) => entry('assetsJson', path, 'lang')),
    ...MCMETA_TEXTURES.map((name) => entry('assets', textureMcmetaPath(name), 'mcmeta')),
  ];
}
