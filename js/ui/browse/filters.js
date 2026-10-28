// Filter der Kategorie-Seite: Größe, Herkunft, Test im Spiel.
// Innerhalb einer Gruppe gilt „oder“, zwischen den Gruppen „und“. Rein und in Node testbar.
import { ACCURACY_KEYS, ACCURACY_LABELS } from '../shared.js';
import { SIZE_CLASSES, TEST_STATES, sizeClassOf, sizeClassRange, testStateOf } from './model.js';

const freezeGroup = (group) => Object.freeze({ ...group, options: Object.freeze(group.options.map((option) => Object.freeze(option))) });

/** Reihenfolge = Reihenfolge in der Seite und in der Adresse */
export const FILTER_GROUPS = Object.freeze([
  freezeGroup({
    key: 'groesse',
    title: 'Größe',
    options: SIZE_CLASSES.map((sizeClass) => ({ value: sizeClass.key, label: sizeClass.label, hint: sizeClassRange(sizeClass.key) })),
    valueOf: (build) => sizeClassOf(build),
  }),
  freezeGroup({
    key: 'herkunft',
    title: 'Herkunft',
    options: ACCURACY_KEYS.map((key) => ({ value: key, label: ACCURACY_LABELS[key] })),
    valueOf: (build) => (ACCURACY_KEYS.includes(build.accuracy) ? build.accuracy : null),
  }),
  freezeGroup({
    key: 'test',
    title: 'Test im Spiel',
    options: TEST_STATES.map((state) => ({ value: state.key, label: state.label })),
    valueOf: (build) => testStateOf(build),
  }),
]);

export const FILTER_KEYS = Object.freeze(FILTER_GROUPS.map((group) => group.key));

export function filterGroup(key) {
  return FILTER_GROUPS.find((group) => group.key === key) ?? null;
}

export function filterOption(key, value) {
  return filterGroup(key)?.options.find((option) => option.value === value) ?? null;
}

/** Erlaubte Werte je Gruppe (für die Prüfung der Adresse) */
export function allowedFilterValues(key) {
  return filterGroup(key)?.options.map((option) => option.value) ?? [];
}

export function emptyFilters() {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, []]));
}

/** Werte eines Eintrags je Gruppe, z. B. { groesse: 'klein', herkunft: 'original', test: 'ohne' } */
export function filterValuesOf(build) {
  return Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, group.valueOf(build)]));
}

export function activeFilterCount(filters) {
  return FILTER_KEYS.reduce((sum, key) => sum + (filters[key]?.length ?? 0), 0);
}

/** Passt ein Eintrag (seine Werte) zu allen Gruppen – außer exceptKey (für die Zählung je Gruppe)? */
export function matchesFilters(values, filters, exceptKey = null) {
  for (const key of FILTER_KEYS) {
    if (key === exceptKey) continue;
    const selected = filters[key];
    if (selected && selected.length > 0 && !selected.includes(values[key])) return false;
  }
  return true;
}

/** items: [{ values, … }] → passende items (Reihenfolge bleibt) */
export function applyFilters(items, filters) {
  return items.filter((item) => matchesFilters(item.values, filters));
}

/**
 * Anzahl je Option, wenn die übrigen Gruppen gelten (die eigene Auswahl zählt nicht mit):
 * so zeigt jede Option, wie viele Bauten sie zur aktuellen Auswahl beitragen würde.
 */
export function facetCounts(items, filters) {
  const counts = Object.fromEntries(FILTER_GROUPS.map((group) => [group.key, Object.fromEntries(group.options.map((option) => [option.value, 0]))]));
  for (const item of items) {
    for (const key of FILTER_KEYS) {
      const value = item.values[key];
      if (value === null || !(value in counts[key])) continue;
      if (matchesFilters(item.values, filters, key)) counts[key][value] += 1;
    }
  }
  return counts;
}

/** Welche Werte kommen überhaupt vor? → { groesse: Set, … } */
export function presentValues(items) {
  const present = Object.fromEntries(FILTER_KEYS.map((key) => [key, new Set()]));
  for (const item of items) {
    for (const key of FILTER_KEYS) if (item.values[key] !== null) present[key].add(item.values[key]);
  }
  return present;
}

/**
 * Sichtbarkeit der Filter: eine Gruppe erscheint, wenn in der Kategorie mindestens zwei Werte vorkommen
 * (sonst filtert sie nichts) oder in ihr etwas gewählt ist; eine Option, wenn ihr Wert vorkommt oder gewählt ist.
 */
export function visibleFilterOptions(present, filters) {
  return FILTER_GROUPS.map((group) => {
    const selected = filters[group.key] ?? [];
    const options = group.options.filter((option) => present[group.key].has(option.value) || selected.includes(option.value));
    const visible = present[group.key].size >= 2 || selected.length > 0;
    return { key: group.key, title: group.title, visible, options };
  });
}
