// Testserver-Hilfe für den Online-Modus („Weg A“) ohne Netz: liefert die Dateien aus dem lokalen Spiegel
// (node scripts/mirror-mcmeta.mjs) unter /__mcmeta/<commit>/<pfad>, schreibt in js/data/sources.js die Basis-Adresse
// auf '/__mcmeta/' um (gleicher Ursprung, die CSP bleibt unverändert) und versteckt auf Wunsch game-data/.
// Nutzung: startServer({ port: 0, overrides: mirrorOverrides() }) aus scripts/serve.mjs.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mirrorFileList, mirrorFilePath } from '../../scripts/mirror-mcmeta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MIRROR_PREFIX = '/__mcmeta/';
const SOURCES_PATHNAME = '/js/data/sources.js';
const BASE_LINE = /^export const MCMETA_BASE = '[^'\n]*';$/m;

const TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mcmeta': 'text/plain; charset=utf-8',
  '.nbt': 'application/octet-stream',
};
const NOT_FOUND = Object.freeze({ status: 404, body: 'Nicht gefunden.', type: 'text/plain; charset=utf-8' });

// → overrides-Funktion für startServer. mirrorDir relativ zur Projektwurzel (oder absolut).
export function mirrorOverrides({ mirrorDir = 'tmp/mcmeta-mirror', hideGameData = true, rootDir = ROOT } = {}) {
  const base = path.resolve(rootDir, mirrorDir);
  return async (pathname) => {
    if (pathname.startsWith(MIRROR_PREFIX)) {
      const rest = pathname.slice(MIRROR_PREFIX.length);
      const slash = rest.indexOf('/');
      let file;
      try {
        if (slash <= 0) return NOT_FOUND;
        file = mirrorFilePath(base, rest.slice(0, slash), rest.slice(slash + 1));
      } catch {
        return NOT_FOUND;
      }
      let body;
      try {
        body = await readFile(file);
      } catch {
        return NOT_FOUND;
      }
      return { status: 200, body, type: TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' };
    }
    if (pathname === SOURCES_PATHNAME) {
      const source = await readFile(path.join(rootDir, 'js', 'data', 'sources.js'), 'utf8');
      // Fehlt die Zeile, liefe der Test unbemerkt gegen GitHub: lieber laut scheitern (Server antwortet 500).
      if (!BASE_LINE.test(source)) throw new Error('js/data/sources.js: Zeile „export const MCMETA_BASE = \'…\';“ nicht gefunden.');
      return { status: 200, body: source.replace(BASE_LINE, `export const MCMETA_BASE = '${MIRROR_PREFIX}';`), type: 'text/javascript; charset=utf-8' };
    }
    if (hideGameData && (pathname === '/game-data' || pathname.startsWith('/game-data/'))) return NOT_FOUND;
    return null;
  };
}

// → { available, missing: ['<commit>/<pfad>', …] } – vollständig, wenn alle Dateien von mirror-mcmeta.mjs da sind.
export function mirrorStatus(mirrorDir = 'tmp/mcmeta-mirror', { rootDir = ROOT } = {}) {
  const base = path.resolve(rootDir, mirrorDir);
  let files;
  try {
    files = mirrorFileList();
  } catch {
    return { available: false, missing: ['data/catalog.json'] };
  }
  const missing = files.filter((file) => !existsSync(mirrorFilePath(base, file.commit, file.path))).map((file) => `${file.commit}/${file.path}`);
  return { available: missing.length === 0, missing };
}

export function mirrorAvailable(mirrorDir = 'tmp/mcmeta-mirror') {
  return mirrorStatus(mirrorDir).available;
}
