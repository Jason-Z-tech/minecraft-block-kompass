// Abgeleitete Werte eines Katalog-Eintrags für Filter, Sortierung und Startseite.
// Rein (kein DOM, kein Netzwerk) und deshalb auch in Node testbar.
import { SIZE_CLASS_KEYS, formatNumber } from '../shared.js';

export { SIZE_CLASS_KEYS };

const SIZE_CLASS_DETAILS = {
  klein: { label: 'Klein', min: 0, max: 999 },
  mittel: { label: 'Mittel', min: 1000, max: 9999 },
  gross: { label: 'Groß', min: 10000, max: 99999 },
  riesig: { label: 'Riesig', min: 100000, max: Infinity },
};

/** Größenklassen nach Blöcken wie im Katalog: klein < 1 000 ≤ mittel < 10 000 ≤ gross < 100 000 ≤ riesig */
export const SIZE_CLASSES = Object.freeze(SIZE_CLASS_KEYS.map((key) => Object.freeze({ key, ...SIZE_CLASS_DETAILS[key] })));

/** Test im Spiel: tested true → getestet, false → ungetestet, null → ohne (kein Funktionstest nötig) */
export const TEST_STATES = Object.freeze([
  Object.freeze({ key: 'getestet', label: 'Im Spiel getestet' }),
  Object.freeze({ key: 'ungetestet', label: 'Nicht im Spiel getestet' }),
  Object.freeze({ key: 'ohne', label: 'Kein Test nötig' }),
]);

export const TEST_STATE_KEYS = Object.freeze(TEST_STATES.map((state) => state.key));

/** Größenklasse aus der Blockzahl; null, wenn sie fehlt */
export function sizeClassForBlocks(blocks) {
  if (!Number.isInteger(blocks) || blocks < 0) return null;
  return SIZE_CLASSES.find((sizeClass) => blocks <= sizeClass.max).key;
}

/** Größenklasse eines Eintrags: Angabe aus dem Katalog, sonst aus der Blockzahl berechnet */
export function sizeClassOf(build) {
  if (SIZE_CLASS_KEYS.includes(build.sizeClass)) return build.sizeClass;
  return sizeClassForBlocks(build.blocks);
}

export function sizeClassLabel(key) {
  return SIZE_CLASSES.find((sizeClass) => sizeClass.key === key)?.label ?? null;
}

/** Bereich einer Größenklasse als Text, z. B. „1.000 bis 9.999 Blöcke“ */
export function sizeClassRange(key) {
  const sizeClass = SIZE_CLASSES.find((entry) => entry.key === key);
  if (!sizeClass) return null;
  if (sizeClass.min === 0) return `unter ${formatNumber(sizeClass.max + 1)} Blöcke`;
  if (sizeClass.max === Infinity) return `ab ${formatNumber(sizeClass.min)} Blöcke`;
  return `${formatNumber(sizeClass.min)} bis ${formatNumber(sizeClass.max)} Blöcke`;
}

export function testStateOf(build) {
  if (build.tested === true) return 'getestet';
  if (build.tested === false) return 'ungetestet';
  return 'ohne';
}

export function testStateLabel(key) {
  return TEST_STATES.find((state) => state.key === key)?.label ?? null;
}

/** Rauminhalt des umschließenden Quaders (Breite × Höhe × Länge); null ohne Größe */
export function volumeOf(build) {
  const size = build.size;
  if (!Array.isArray(size) || size.length !== 3 || !size.every((n) => Number.isInteger(n) && n > 0)) return null;
  return size[0] * size[1] * size[2];
}

/** Zahl für Kennzahlen: unter einer Million exakt („12.345“), darüber kompakt („4,8 Mio.“) */
const compactFormat = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });

export function formatStatNumber(value) {
  if (!Number.isFinite(value)) return '–';
  return Math.abs(value) < 1_000_000 ? formatNumber(value) : compactFormat.format(value);
}
