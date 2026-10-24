// Materiallisten (rein, in Node testbar): gesamt, je Kapitel, je Schritt; Hinweise aus itemForState,
// Suche, Summen. Mengen als Shulkerkisten/Stacks mit formatAmount (§6.5).
import { itemForState, sortMaterials, stackSize, formatAmount } from '../../core/materials.js';
import { formatNumber } from '../shared.js';

export const MATERIAL_SCOPES = Object.freeze(['total', 'phase', 'step']);

/** Liste [[item, n], …] für einen Umfang: 'total' | 'phase' (Kapitel index) | 'step' (Schritt index). */
export function materialsForScope(result, scope, index = null) {
  if (scope === 'total') return result.materials;
  if (scope === 'step') return result.steps[index]?.materials ?? [];
  if (scope === 'phase') {
    const phase = result.phases[index];
    if (!phase) return [];
    const totals = new Map();
    for (const stepIndex of phase.steps) {
      for (const [item, n] of result.steps[stepIndex]?.materials ?? []) totals.set(item, (totals.get(item) ?? 0) + n);
    }
    return sortMaterials(totals);
  }
  throw new TypeError(`Unbekannter Material-Umfang „${scope}“ (erlaubt: ${MATERIAL_SCOPES.join(', ')}).`);
}

/** Hinweise je Gegenstand aus den Zuständen der Palette (z. B. Ackerboden → „Erde mit einer Hacke bearbeiten“). */
export function hintsByItem(palette) {
  const hints = new Map();
  for (const state of palette) {
    if (state === 'air') continue;
    const entry = itemForState(state);
    if (!entry?.hint) continue;
    if (!hints.has(entry.item)) hints.set(entry.item, new Set());
    hints.get(entry.item).add(entry.hint);
  }
  return hints;
}

/** Zusätzliche Gegenstände, die aus einem Block entstehen (Blumentopf + Pflanze …): Map<extraItem, Set<block-item>> */
export function extrasByItem(palette) {
  const extras = new Map();
  for (const state of palette) {
    if (state === 'air') continue;
    const entry = itemForState(state);
    for (const [item] of entry?.extra ?? []) {
      if (!extras.has(item)) extras.set(item, new Set());
      extras.get(item).add(entry.item);
    }
  }
  return extras;
}

/** Suchtext vergleichbar machen: klein, ohne Akzente (ä → a), ohne „minecraft:“, Leerraum zusammengefasst. */
export function foldSearch(text) {
  return String(text)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/minecraft:/g, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

/** Passt ein Gegenstand zur Suche? Alle Wörter müssen im Namen oder in der ID vorkommen. */
export function materialMatches(item, name, query) {
  const words = foldSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${foldSearch(name)} ${foldSearch(item)}`;
  return words.every((word) => haystack.includes(word));
}

/** Menge als Text: „2 Stacks und 12“ */
export function amountText(item, count) {
  return formatAmount(count, stackSize(item));
}

/** Zahl im Inventar-Slot: bis 9 999 genau, darüber gekürzt („12k“, „1,2M“). */
export function slotCount(count) {
  if (count < 10_000) return formatNumber(count);
  if (count < 1_000_000) return `${formatNumber(Math.floor(count / 1000))}k`;
  return `${formatNumber(Math.floor(count / 100_000) / 10)}M`;
}

/** Summe einer Liste: { kinds, total, doneKinds, remaining } mit isDone(item). */
export function summarizeMaterials(list, isDone = () => false) {
  let total = 0;
  let remaining = 0;
  let doneKinds = 0;
  for (const [item, n] of list) {
    total += n;
    if (isDone(item)) doneKinds += 1;
    else remaining += n;
  }
  return { kinds: list.length, total, doneKinds, remaining };
}
