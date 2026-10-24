// Sortierung der Kategorie-Seite. Fehlende Werte stehen immer am Ende; Gleichstand → Name, dann ID
// (so ist die Reihenfolge immer gleich). Rein und in Node testbar.

export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ key: 'relevanz', label: 'Passend zuerst', needsQuery: true }),
  Object.freeze({ key: 'name', label: 'Name (A–Z)' }),
  Object.freeze({ key: 'groesse-auf', label: 'Größe: klein zuerst' }),
  Object.freeze({ key: 'groesse-ab', label: 'Größe: groß zuerst' }),
  Object.freeze({ key: 'bloecke-auf', label: 'Blöcke: wenige zuerst' }),
  Object.freeze({ key: 'bloecke-ab', label: 'Blöcke: viele zuerst' }),
  Object.freeze({ key: 'schwierigkeit-auf', label: 'Schwierigkeit: leicht zuerst' }),
  Object.freeze({ key: 'schwierigkeit-ab', label: 'Schwierigkeit: schwer zuerst' }),
]);

export const SORT_KEYS = Object.freeze(SORT_OPTIONS.map((option) => option.key));

const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

/** Ohne Suche nach Name, mit Suche die besten Treffer zuerst */
export function defaultSort(query) {
  return query ? 'relevanz' : 'name';
}

/** „Passend zuerst“ gibt es nur, wenn gesucht wird */
export function isSortAvailable(key, query) {
  const option = SORT_OPTIONS.find((entry) => entry.key === key);
  return Boolean(option) && (!option.needsQuery || Boolean(query));
}

export function compareTitles(a, b) {
  return collator.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function compareMissingLast(a, b, direction) {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  return direction * (a - b);
}

const NUMERIC_SORTS = {
  'groesse-auf': ['volume', 1],
  'groesse-ab': ['volume', -1],
  'bloecke-auf': ['blocks', 1],
  'bloecke-ab': ['blocks', -1],
  'schwierigkeit-auf': ['difficulty', 1],
  'schwierigkeit-ab': ['difficulty', -1],
};

/**
 * Sortiert items ({ build, volume, score }) neu (Kopie). key aus SORT_KEYS; unbekannt → Fehler,
 * weil die Adresse vorher geprüft wird.
 */
export function sortItems(items, key) {
  const byTitle = (a, b) => compareTitles(a.build, b.build);
  let compare;
  if (key === 'name') compare = byTitle;
  else if (key === 'relevanz') compare = (a, b) => (b.score ?? 0) - (a.score ?? 0) || byTitle(a, b);
  else if (NUMERIC_SORTS[key]) {
    const [field, direction] = NUMERIC_SORTS[key];
    const valueOf = field === 'volume' ? (item) => item.volume : (item) => item.build[field];
    compare = (a, b) => compareMissingLast(valueOf(a), valueOf(b), direction) || byTitle(a, b);
  } else {
    throw new TypeError(`Unbekannte Sortierung „${String(key)}“.`);
  }
  return [...items].sort(compare);
}
