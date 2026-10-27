// Blockfarben für den Voxel-Import (ARCHITEKTUR §5 block-colors.json, §12.3) – Kern ohne Node: mittlere Farbe je Seite
// aller Blöcke mit vollem, deckendem Würfelmodell, gemittelt in linearem RGB über die echten 26.2-Texturen (inkl.
// Overlays, fester Tönung und aller Animations-Frames). Welche Blöcke volle Würfel sind, entscheidet
// BlockModels.isOpaqueFullCube (js/render/block-models.js) – nicht nachgebaut. Die Bilder kommen schon dekodiert über
// textureImage(name); scripts/build-block-colors.mjs liest sie aus textures.bin, der Browser z. B. aus den Atlanten.

import { BlockModels, FACE_AXES, blockLightEmission } from '../render/block-models.js';
import { buildLayer, parseTextureName } from '../render/texture-store.js';
import { specialKind } from '../render/special-models.js';
import { formatState } from '../core/blockstate.js';
import { SRGB_TO_LINEAR, linearToLab, linearToSrgb8, BLOCK_COLORS_FORMAT } from '../create/voxelize/colors.js';

// Seiten in der Reihenfolge von DIRECTIONS (down, up, north, south, west, east)
const DOWN = 0, UP = 1;

// ------------------------------------------------------------------ Einordnung (Gruppen und Merkmale)

const FALLING = new Set(['sand', 'red_sand', 'gravel', 'suspicious_sand', 'suspicious_gravel']);
// Verändern sich von selbst: werden abgedeckt zu Erde/Netherrack, sterben außerhalb von Wasser, oxidieren
const CHANGING = new Set(['grass_block', 'mycelium', 'crimson_nylium', 'warped_nylium',
  'brain_coral_block', 'bubble_coral_block', 'fire_coral_block', 'horn_coral_block', 'tube_coral_block']);
// Sonderblöcke: nur mit Befehlen erhältlich, unzerstörbar, gefährlich oder mit eigener Mechanik/Vorderseite
const SPECIAL = new Set(['command_block', 'chain_command_block', 'repeating_command_block', 'structure_block', 'jigsaw',
  'test_block', 'test_instance_block', 'bedrock', 'reinforced_deepslate', 'budding_amethyst', 'creaking_heart',
  'potent_sulfur', 'powder_snow', 'spawner', 'trial_spawner', 'vault', 'barrier', 'beacon', 'light', 'carved_pumpkin']);
const TECHNIK = new Set(['dispenser', 'dropper', 'observer', 'piston', 'sticky_piston', 'crafter', 'note_block', 'target',
  'redstone_lamp', 'tnt', 'jukebox', 'lodestone', 'respawn_anchor', 'sculk_catalyst']);
const WORKSTATIONS = new Set(['crafting_table', 'furnace', 'blast_furnace', 'smoker', 'loom', 'cartography_table',
  'fletching_table', 'smithing_table', 'barrel', 'beehive', 'bee_nest']);
const MINERAL = new Set(['iron_block', 'gold_block', 'diamond_block', 'emerald_block', 'lapis_block', 'redstone_block',
  'coal_block', 'netherite_block', 'amethyst_block', 'raw_iron_block', 'raw_gold_block', 'raw_copper_block']);
const NATURE = new Set(['dirt', 'coarse_dirt', 'rooted_dirt', 'grass_block', 'podzol', 'mycelium', 'mud', 'packed_mud', 'clay',
  'sand', 'red_sand', 'gravel', 'suspicious_sand', 'suspicious_gravel', 'snow_block', 'powder_snow', 'packed_ice', 'blue_ice',
  'moss_block', 'pale_moss_block', 'sponge', 'wet_sponge', 'melon', 'pumpkin', 'carved_pumpkin', 'hay_block',
  'dried_kelp_block', 'honeycomb_block', 'bone_block', 'nether_wart_block', 'warped_wart_block', 'crimson_nylium',
  'warped_nylium', 'netherrack', 'soul_sand', 'soul_soil', 'magma_block', 'sculk', 'brown_mushroom_block',
  'red_mushroom_block', 'mushroom_stem', 'resin_block', 'muddy_mangrove_roots', 'creaking_heart']);
const LIGHTS = new Set(['glowstone', 'sea_lantern', 'shroomlight', 'jack_o_lantern', 'ochre_froglight', 'verdant_froglight',
  'pearlescent_froglight']);

/** Unversiegelte Kupferblöcke oxidieren mit der Zeit (die letzte Stufe „oxidized“ bleibt). */
export function oxidizes(id) {
  return id.includes('copper') && !id.startsWith('waxed_') && !id.startsWith('oxidized_') && !id.endsWith('_ore') && !id.startsWith('raw_');
}

/** Gruppe eines Blocks (deutsch, für Sets und Filter). */
export function blockGroup(id) {
  if (SPECIAL.has(id) || id.startsWith('infested_')) return 'sonder';
  if (id.endsWith('_glazed_terracotta')) return 'glasierte-terrakotta';
  if (id === 'terracotta' || id.endsWith('_terracotta')) return 'terrakotta';
  if (id.endsWith('_concrete_powder')) return 'betonpulver';
  if (id.endsWith('_concrete')) return 'beton';
  if (id.endsWith('_wool')) return 'wolle';
  if (id.endsWith('_ore') || id === 'ancient_debris' || id === 'gilded_blackstone') return 'erz';
  if (TECHNIK.has(id) || id.endsWith('copper_bulb')) return 'technik';
  if (WORKSTATIONS.has(id)) return 'arbeitsblock';
  if (MINERAL.has(id)) return 'mineral';
  if (id.includes('copper')) return 'kupfer';
  if (LIGHTS.has(id)) return 'licht';
  if (NATURE.has(id) || id.endsWith('coral_block') || id.endsWith('_ice')) return 'natur';
  if (/(_planks|_log|_wood|_stem|_hyphae)$/.test(id) || id.startsWith('stripped_') || id === 'bamboo_block'
    || id === 'bamboo_mosaic' || id === 'bookshelf') return 'holz';
  return 'stein';
}

// ------------------------------------------------------------------ Texturen ohne GPU binden

// Frames mit Gewicht (Ticks) und Ursprung im Bild; ohne Animation ein Frame.
function framesOf({ entry, image }) {
  const anim = entry.anim ?? null;
  const fw = anim ? anim.fw : image.width;
  const fh = anim ? anim.fh : image.height;
  const columns = image.width / fw;
  if (!anim) return { fw, fh, frames: [{ ox: 0, oy: 0, weight: 1 }] };
  const weights = new Map();
  for (const [index, ticks] of anim.frames) weights.set(index, (weights.get(index) ?? 0) + ticks);
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  const frames = [...weights].map(([index, ticks]) => ({ ox: (index % columns) * fw, oy: Math.floor(index / columns) * fh, weight: ticks / total }));
  return { fw, fh, frames };
}

// ------------------------------------------------------------------ Seiten abtasten

// Rechteck (a, b) einer Fläche auf ihrer Seite und UV an den Ecken (a0,b0) (a1,b0) (a0,b1) (a1,b1).
function faceMapping(quad) {
  const { t1, t2 } = FACE_AXES[quad.dirIndex];
  const as = [], bs = [];
  for (let v = 0; v < 4; v++) {
    as.push(quad.pos[v * 3 + t1]);
    bs.push(quad.pos[v * 3 + t2]);
  }
  const a0 = Math.min(...as), a1 = Math.max(...as), b0 = Math.min(...bs), b1 = Math.max(...bs);
  const corner = (a, b) => {
    for (let v = 0; v < 4; v++) {
      if (Math.abs(as[v] - a) < 1e-6 && Math.abs(bs[v] - b) < 1e-6) return [quad.uv[v * 2], quad.uv[v * 2 + 1]];
    }
    throw new Error(`Blockfarben: Fläche mit Textur „${quad.texture}“ ist kein achsenparalleles Rechteck.`);
  };
  return { a0, a1, b0, b1, c00: corner(a0, b0), c10: corner(a1, b0), c01: corner(a0, b1), c11: corner(a1, b1) };
}

/**
 * Tastet eine Seite (dirIndex) auf einem n×n-Raster ab: Flächen in Zeichenreihenfolge (deckend vor cutout),
 * cutout mit Alpha-Test 0,5, Tönung multipliziert in sRGB wie der Shader, Animations-Frames nach Dauer gewichtet.
 * Rückgabe: Float64Array mit linearem RGB je Abtastpunkt (3 Werte), Punkte ohne deckende Fläche fehlen.
 */
function sampleSide(quads, dirIndex, textures) {
  const layers = quads.filter((q) => q.boundary && q.dirIndex === dirIndex).sort((p, q) => p.layerIndex - q.layerIndex)
    .map((quad) => {
      const texture = textures(quad.texture);
      return { quad, map: faceMapping(quad), texture, ...framesOf(texture) };
    });
  if (layers.length === 0) return new Float64Array(0);
  const n = Math.min(64, Math.max(16, ...layers.map((l) => l.fw)));
  const out = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n, b = (j + 0.5) / n;
      let r = 0, g = 0, bl = 0, covered = false;
      for (const { quad, map, texture, fw, fh, frames } of layers) {
        if (a < map.a0 || a > map.a1 || b < map.b0 || b > map.b1) continue;
        const sa = map.a1 > map.a0 ? (a - map.a0) / (map.a1 - map.a0) : 0;
        const sb = map.b1 > map.b0 ? (b - map.b0) / (map.b1 - map.b0) : 0;
        const u = (1 - sb) * ((1 - sa) * map.c00[0] + sa * map.c10[0]) + sb * ((1 - sa) * map.c01[0] + sa * map.c11[0]);
        const v = (1 - sb) * ((1 - sa) * map.c00[1] + sa * map.c10[1]) + sb * ((1 - sa) * map.c01[1] + sa * map.c11[1]);
        const tx = ((Math.floor((u / 16) * fw) % fw) + fw) % fw;
        const ty = ((Math.floor((v / 16) * fh) % fh) + fh) % fh;
        const tint = quad.tint >= 0 ? [(quad.tint >> 16) & 255, (quad.tint >> 8) & 255, quad.tint & 255] : null;
        let lr = 0, lg = 0, lb = 0, alpha = 0;
        for (const frame of frames) {
          const o = ((frame.oy + ty) * texture.image.width + frame.ox + tx) * 4;
          const d = texture.image.data;
          let pr = d[o], pg = d[o + 1], pb = d[o + 2];
          if (tint) {
            pr = Math.round((pr * tint[0]) / 255);
            pg = Math.round((pg * tint[1]) / 255);
            pb = Math.round((pb * tint[2]) / 255);
          }
          lr += SRGB_TO_LINEAR[pr] * frame.weight;
          lg += SRGB_TO_LINEAR[pg] * frame.weight;
          lb += SRGB_TO_LINEAR[pb] * frame.weight;
          alpha += (d[o + 3] / 255) * frame.weight;
        }
        if (quad.layerIndex === 1 && alpha < 0.5) continue;
        r = lr;
        g = lg;
        bl = lb;
        covered = true;
      }
      if (covered) out.push(r, g, bl);
    }
  }
  return Float64Array.from(out);
}

const round2 = (v) => Math.round(v * 100) / 100;

/** Mittelwert (linear) mehrerer Abtast-Listen → { rgb (sRGB 0 … 255), lab, pattern (mittlerer Lab-Abstand zum Mittel) }. */
export function summarizeSamples(lists) {
  let r = 0, g = 0, b = 0, count = 0;
  for (const list of lists) {
    for (let i = 0; i < list.length; i += 3) {
      r += list[i];
      g += list[i + 1];
      b += list[i + 2];
      count++;
    }
  }
  if (count === 0) return null;
  r /= count;
  g /= count;
  b /= count;
  const mean = linearToLab(r, g, b);
  let spread = 0;
  const lab = [0, 0, 0];
  for (const list of lists) {
    for (let i = 0; i < list.length; i += 3) {
      linearToLab(list[i], list[i + 1], list[i + 2], lab);
      spread += Math.hypot(lab[0] - mean[0], lab[1] - mean[1], lab[2] - mean[2]);
    }
  }
  return {
    rgb: [linearToSrgb8(r), linearToSrgb8(g), linearToSrgb8(b)],
    lab: mean.map(round2),
    pattern: round2(spread / count),
  };
}

// ------------------------------------------------------------------ Hauptfunktion

// Kandidaten (Standardzustand aller Blöcke mit JSON-Modell und Elementen) und die Texturnamen ihrer Modelle.
function collectCandidates(modelsJson, blocksJson) {
  const models = new BlockModels(modelsJson, blocksJson);
  const candidates = [];
  for (const id of Object.keys(blocksJson.blocks).sort()) {
    if (specialKind(id) !== null || !modelsJson.blocks[id]) continue;
    candidates.push({ id, state: formatState(id, { ...blocksJson.blocks[id].default }) });
  }
  // Nur Blöcke mit Elementen (die anderen zeichnet special-models.js oder ein Ersatzwürfel)
  const withGeometry = candidates.filter(({ id }) => {
    const definition = modelsJson.blocks[id];
    const parts = definition.variants ?? definition.multipart ?? [];
    return parts.some((part) => (Array.isArray(part.apply) ? part.apply : [part.apply]).some((entry) => modelsJson.models[entry?.model]?.elements.length > 0));
  });
  const names = models.textureNames(withGeometry.map((c) => c.state));
  return { models, withGeometry, names };
}

function checkModelData(modelsJson, blocksJson) {
  if (!modelsJson?.blocks || !modelsJson?.models || !blocksJson?.blocks) throw new Error('Blockfarben: models.json und blocks.json werden gebraucht.');
}

/**
 * Namen der Texturen (Schlüssel in textures.json, z. B. „block/stone“), die buildBlockColorsFrom über textureImage
 * anfragt – damit sie vorher (z. B. asynchron im Browser) dekodiert werden können. Sortiert, ohne Doppelte.
 */
export function blockColorTextureNames({ modelsJson, blocksJson }) {
  checkModelData(modelsJson, blocksJson);
  const textures = new Set();
  for (const name of collectCandidates(modelsJson, blocksJson).names) {
    const parsed = parseTextureName(name);
    if (parsed.kind === 'texture') textures.add(parsed.texture);
  }
  return [...textures].sort();
}

// Gleiche Liste als Promise (Name aus dem Bauplan).
export async function collectBlockColorTextures({ modelsJson, blocksJson }) {
  return blockColorTextureNames({ modelsJson, blocksJson });
}

function checkImage(image, name) {
  const valid = image && Number.isInteger(image.width) && Number.isInteger(image.height) && image.width > 0 && image.height > 0
    && ArrayBuffer.isView(image.data) && image.data.length >= image.width * image.height * 4;
  if (!valid) throw new Error(`Blockfarben: Bild der Textur „${name}“ fehlt oder ist kein RGBA-Bild.`);
  return image;
}

/**
 * Erzeugt den Inhalt von block-colors.json aus models.json, blocks.json, textures.json (Objekte wie in game-data/;
 * Einträge brauchen w, h, anim, mip) und den Bildern: textureImage(name) → { width, height, data: RGBA-Bytes }
 * (synchron, name wie in textures.json; decodeTexture ist derselbe Parameter unter dem Namen aus dem Bauplan).
 * Rückgabe { format, version, generatedAt, count, blocks: { id: { state, group, top, side, bottom, all, … } } }.
 */
export function buildBlockColorsFrom({ modelsJson, blocksJson, texturesJson, textureImage, decodeTexture }) {
  const loadImage = textureImage ?? decodeTexture;
  if (!modelsJson?.blocks || !blocksJson?.blocks || !texturesJson?.entries || typeof loadImage !== 'function') {
    throw new Error('Blockfarben: models.json, blocks.json, textures.json und die Texturbilder werden gebraucht.');
  }
  const { models, withGeometry, names } = collectCandidates(modelsJson, blocksJson);
  const cache = new Map();
  const textures = (name) => {
    let item = cache.get(name);
    if (item) return item;
    const parsed = parseTextureName(name);
    if (parsed.kind !== 'texture') throw new Error(`Blockfarben: unerwarteter Texturname „${name}“ bei einem vollen Würfel.`);
    const entry = texturesJson.entries[parsed.texture];
    if (!entry) throw new Error(`Blockfarben: Textur „${parsed.texture}“ fehlt in textures.json.`);
    const image = checkImage(loadImage(parsed.texture), parsed.texture);
    const layer = buildLayer(parsed.texture, entry, image, { layerSize: 16 });
    item = { entry, image, layer };
    cache.set(name, item);
    return item;
  };
  const binding = new Map();
  let layerIndex = 0;
  for (const name of [...names].sort()) {
    if (parseTextureName(name).kind !== 'texture') {
      binding.set(name, { layer: layerIndex++, alpha: 'opaque' });
      continue;
    }
    const { layer } = textures(name);
    binding.set(name, { layer: layerIndex++, alpha: layer.alpha, mask: layer.mask, maskWidth: layer.maskWidth, maskHeight: layer.maskHeight });
  }
  models.bindTextures(binding);

  const blocks = {};
  for (const { id, state } of withGeometry) {
    if (!models.isOpaqueFullCube(state)) continue;
    const quads = models.quads(state, 0, 0, 0);
    const sides = [0, 1, 2, 3, 4, 5].map((dir) => sampleSide(quads, dir, textures));
    const top = summarizeSamples([sides[UP]]);
    const bottom = summarizeSamples([sides[DOWN]]);
    const side = summarizeSamples(sides.slice(2));
    const all = summarizeSamples(sides);
    if (!top || !bottom || !side) throw new Error(`Blockfarben: „${state}“ hat eine Seite ohne deckende Fläche.`);
    const light = blockLightEmission(id, { ...blocksJson.blocks[id].default });
    const animated = quads.some((q) => q.boundary && textures(q.texture).entry.anim);
    const tinted = quads.some((q) => q.boundary && q.tint >= 0);
    const group = blockGroup(id);
    blocks[id] = {
      state, group, top, side, bottom, all,
      animated, light, emissive: light > 0, tinted,
      falls: FALLING.has(id) || id.endsWith('_concrete_powder'),
      changes: CHANGING.has(id) || oxidizes(id),
      special: group === 'sonder',
    };
  }
  return {
    format: BLOCK_COLORS_FORMAT,
    version: modelsJson.version ?? null,
    generatedAt: new Date().toISOString(),
    count: Object.keys(blocks).length,
    blocks,
  };
}
