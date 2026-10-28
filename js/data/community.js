// Community-Bauten (ARCHITEKTUR §9.2): fertige Bauten anderer Ersteller mit offener Lizenz. Die Dateien liegen
// unverändert unter data/community/<id>.<endung>, die Angaben in data/community/builds.json. Gemeinsame Regeln für
// Katalog (Node), 3D-Worker und Seite; ohne DOM und ohne Netzwerk.

/** Ordner relativ zur Website-Wurzel (auch unter /minecraft-block-kompass/ auf GitHub Pages) */
export const COMMUNITY_DIR = 'data/community/';
export const COMMUNITY_LIST_FILE = 'builds.json';
export const COMMUNITY_LICENSE_DIR = 'licenses/';
/** Nur Baupläne aus Minecraft (die alte .schematic vor 1.13 nicht) */
export const COMMUNITY_FORMATS = Object.freeze(['nbt', 'schem', 'litematic']);
export const COMMUNITY_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const COMMUNITY_MAX_TOTAL_BYTES = 200 * 1024 * 1024;
export const COMMUNITY_MAX_BLOCKS = 3_000_000;

// <id>.<endung>: Kleinbuchstaben, Ziffern und Bindestriche, kein Pfad, kein führender Punkt
const FILE_PATTERN = /^([a-z0-9][a-z0-9-]{1,79})\.(nbt|schem|litematic)$/;

/**
 * Offene Lizenzen (SPDX-Kennung → Anzeige und Lizenz-Adresse). Andere Lizenzen oder „All rights reserved“ kommen
 * nicht ins Repo.
 */
export const OPEN_LICENSES = Object.freeze({
  'CC0-1.0': Object.freeze({ label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' }),
  'CC-BY-3.0': Object.freeze({ label: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' }),
  'CC-BY-4.0': Object.freeze({ label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }),
  'CC-BY-SA-3.0': Object.freeze({ label: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' }),
  'CC-BY-SA-4.0': Object.freeze({ label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }),
  'CC-BY-NC-3.0': Object.freeze({ label: 'CC BY-NC 3.0', url: 'https://creativecommons.org/licenses/by-nc/3.0/' }),
  'CC-BY-NC-4.0': Object.freeze({ label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' }),
  'CC-BY-NC-SA-3.0': Object.freeze({ label: 'CC BY-NC-SA 3.0', url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/' }),
  'CC-BY-NC-SA-4.0': Object.freeze({ label: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }),
  MIT: Object.freeze({ label: 'MIT', url: 'https://opensource.org/license/mit' }),
  'Apache-2.0': Object.freeze({ label: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' }),
  Unlicense: Object.freeze({ label: 'Unlicense', url: 'https://unlicense.org/' }),
});

export const OPEN_LICENSE_IDS = Object.freeze(Object.keys(OPEN_LICENSES));

/** Dateiname eines Community-Baus prüfen → { id, format } oder null */
export function parseCommunityFile(file) {
  if (typeof file !== 'string') return null;
  const match = FILE_PATTERN.exec(file);
  if (!match || match[1].endsWith('-') || match[1].includes('--')) return null;
  return { id: match[1], format: match[2] };
}

export function isCommunityFile(file) {
  return parseCommunityFile(file) !== null;
}

/** Anzeige einer Lizenz (SPDX-Kennung) oder null, wenn sie nicht als offen gilt */
export function licenseLabel(id) {
  return typeof id === 'string' && Object.hasOwn(OPEN_LICENSES, id) ? OPEN_LICENSES[id].label : null;
}
