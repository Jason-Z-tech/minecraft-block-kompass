// Block-Icons für Auswahllisten (echte Modelle und Texturen über Appearance aus build/appearance.js).
// Wird erst beim ersten Icon geladen; scheitert das, bleiben die Listen ohne Bilder (Hinweis in der Konsole).
import { Appearance } from '../build/appearance.js';
import { formatState } from '../../core/blockstate.js';

const ID_PATTERN = /^[a-z0-9_]{1,64}$/;
let appearancePromise = null;

function loadAppearance() {
  if (!appearancePromise) {
    appearancePromise = Appearance.load().catch((error) => {
      console.warn('[Block-Kompass] Block-Icons für die Auswahl nicht verfügbar:', error);
      return null;
    });
  }
  return appearancePromise;
}

/** Standardzustand eines Blocks aus blocks.json („oak_stairs[facing=north,…]“), sonst nur die ID. */
export function defaultStateOf(id, blocks) {
  const map = blocks?.blocks && typeof blocks.blocks === 'object' ? blocks.blocks : null;
  const defaults = map && Object.hasOwn(map, id) ? map[id]?.default : null;
  if (!defaults || typeof defaults !== 'object') return id;
  try {
    return formatState(id, defaults);
  } catch (error) {
    console.warn(`[Block-Kompass] Standardzustand von „${id}“ unlesbar:`, error);
    return id;
  }
}

/** data:-URL des Icons (32 px) oder null. */
export async function blockIconUrl(id, blocks) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  const appearance = await loadAppearance();
  if (!appearance) return null;
  return appearance.iconUrl(id, defaultStateOf(id, blocks), 32);
}

/** Setzt das Icon in ein <img> (nur wenn es noch zum selben Block gehört). */
export function fillBlockIcon(img, id, blocks) {
  img.dataset.block = id;
  img.hidden = true;
  if (!id) return;
  blockIconUrl(id, blocks).then((url) => {
    if (!url || img.dataset.block !== id) return;
    img.src = url;
    img.hidden = false;
  }).catch((error) => console.warn(`[Block-Kompass] Icon für „${id}“ fehlt:`, error));
}
