// Blockfarben für den Voxel-Import (ARCHITEKTUR §5 block-colors.json, §12.3): mittlere Farbe je Seite aller Blöcke
// mit vollem, deckendem Würfelmodell, gemittelt in linearem RGB über die echten 26.2-Texturen (inkl. Overlays,
// fester Tönung und aller Animations-Frames). Welche Blöcke volle Würfel sind, entscheidet BlockModels.isOpaqueFullCube
// (js/render/block-models.js) – nicht nachgebaut. Rechenkern: js/data/block-colors.js; hier nur Lesen (textures.bin) und Schreiben.
//
// Aufruf: node scripts/build-block-colors.mjs [--data <ordner>]   (Standard: game-data/)
// Läuft auch am Ende von scripts/extract-game-data.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodePng } from './lib/png.mjs';
import { buildBlockColorsFrom, blockGroup, oxidizes, summarizeSamples } from '../js/data/block-colors.js';

// Der Rechenkern liegt in js/data/block-colors.js (läuft auch im Browser); hier unter den bisherigen Namen weiter exportiert.
export { blockGroup, oxidizes, summarizeSamples };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DATA_DIR = path.join(ROOT, 'game-data');
export const OUTPUT_FILE = 'block-colors.json';

// ------------------------------------------------------------------ Hauptfunktion

/**
 * Erzeugt den Inhalt von block-colors.json aus den Spieldaten (Objekte wie in game-data/, textures.bin als Bytes).
 * Rückgabe { format, version, generatedAt, count, blocks: { id: { state, group, top, side, bottom, all, … } } }.
 */
export function buildBlockColors({ modelsJson, blocksJson, texturesJson, texturesBin }) {
  if (!modelsJson?.blocks || !blocksJson?.blocks || !texturesJson?.entries || !texturesBin) {
    throw new Error('Blockfarben: models.json, blocks.json, textures.json und textures.bin werden gebraucht.');
  }
  const textureImage = (name) => {
    const entry = texturesJson.entries[name];
    return decodePng(texturesBin.subarray(entry.o, entry.o + entry.l));
  };
  return buildBlockColorsFrom({ modelsJson, blocksJson, texturesJson, textureImage });
}

/** Liest die Spieldaten aus einem Ordner, erzeugt die Blockfarben und schreibt block-colors.json (atomar). */
export function writeBlockColors({ dataDir = DEFAULT_DATA_DIR, data = null } = {}) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
  const input = data ?? {
    modelsJson: read('models.json'),
    blocksJson: read('blocks.json'),
    texturesJson: read('textures.json'),
    texturesBin: fs.readFileSync(path.join(dataDir, 'textures.bin')),
  };
  const result = buildBlockColors(input);
  const target = path.join(dataDir, OUTPUT_FILE);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(result));
  fs.renameSync(temporary, target);
  return { result, file: target, bytes: fs.statSync(target).size };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    const args = process.argv.slice(2);
    let dataDir = DEFAULT_DATA_DIR;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--data' && args[i + 1]) dataDir = path.resolve(args[++i]);
      else if (args[i] === '--help' || args[i] === '-h') {
        console.log('Aufruf: node scripts/build-block-colors.mjs [--data <ordner>]');
        process.exit(0);
      } else throw new Error(`Unbekannte Option „${args[i]}“. Aufruf: node scripts/build-block-colors.mjs [--data <ordner>]`);
    }
    if (!fs.existsSync(path.join(dataDir, 'models.json'))) {
      throw new Error(`In ${dataDir} fehlen die Spieldaten – zuerst: node scripts/extract-game-data.mjs`);
    }
    const started = performance.now();
    const { result, file, bytes } = writeBlockColors({ dataDir });
    console.log(`✓ Blockfarben: ${result.count} volle Blöcke → ${path.relative(ROOT, file)} (${Math.round(bytes / 1024)} KB, ${Math.round(performance.now() - started)} ms)`);
  } catch (error) {
    console.error(`Fehler: ${error.message}`);
    process.exitCode = 1;
  }
}
