// Lädt die Test-Blockdaten und -Namen (Format wie game-data/, §5) in den Kern.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setBlockData } from '../../../js/core/block-data.js';
import { setNames } from '../../../js/core/describe.js';

export const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(FIXTURE_DIR, '..', '..', '..');

export function readFixture(name) {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

export function loadFixtureData() {
  setBlockData(readFixture('blocks.json'));
  setNames(readFixture('names.json'));
}

// Alle gesetzten Blöcke als Map "x,y,z" → Zustand (nur für kleine Test-Bauten).
export function blockMap(volume) {
  const map = new Map();
  volume.forEach((x, y, z, state) => map.set(`${x},${y},${z}`, state));
  return map;
}
