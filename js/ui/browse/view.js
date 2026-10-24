// Ergebnis der Kategorie-Seite für einen Zustand: Textsuche → Filter → Sortierung, dazu die Zählung je
// Filteroption und welche Filter sichtbar sind. Rein und in Node testbar.
import { searchCatalog } from '../../create/search.js';
import { activeFilterCount, applyFilters, facetCounts, filterValuesOf, presentValues, visibleFilterOptions } from './filters.js';
import { sortItems } from './sort.js';
import { volumeOf } from './model.js';

/** Karten je Nachlade-Schritt (teilbar durch 2, 3 und 4 Spalten) */
export const BATCH_SIZE = 24;
const MAX_RESTORED = 2000;

/** Vorberechnete Werte je Eintrag – einmal pro Kategorie, nicht bei jedem Tastendruck */
export function createBrowseIndex(builds) {
  const items = builds.map((build) => Object.freeze({ build, values: Object.freeze(filterValuesOf(build)), volume: volumeOf(build) }));
  return Object.freeze({
    catalog: Object.freeze({ builds }),
    items,
    byId: new Map(items.map((item) => [item.build.id, item])),
    present: presentValues(items),
  });
}

/**
 * state: { query, filters, sort } (aus parseBrowseState).
 * search(catalog, query, { limit, category }) → [{ entry, score }] – Standard: searchCatalog aus js/create/search.js.
 * → { results: Build[], total, searched, counts, groups, activeFilters }
 */
export function computeView(index, state, { search = searchCatalog, category = null } = {}) {
  let candidates = index.items;
  if (state.query) {
    const hits = search(index.catalog, state.query, { limit: index.items.length, category });
    if (!Array.isArray(hits)) throw new TypeError('Die Suche hat keine Trefferliste geliefert.');
    candidates = [];
    const seen = new Set();
    for (const hit of hits) {
      const item = index.byId.get(hit?.entry?.id);
      if (!item || seen.has(item.build.id)) continue;
      seen.add(item.build.id);
      candidates.push({ ...item, score: Number.isFinite(hit.score) ? hit.score : 0 });
    }
  }
  const results = sortItems(applyFilters(candidates, state.filters), state.sort);
  return {
    results: results.map((item) => item.build),
    total: index.items.length,
    searched: candidates.length,
    counts: facetCounts(candidates, state.filters),
    groups: visibleFilterOptions(index.present, state.filters),
    activeFilters: activeFilterCount(state.filters),
  };
}

/** Wie viele Karten nach dem Laden zeigen: gemerkte Zahl (Zurück-Taste) auf ganze Schritte gerundet */
export function initialShown(requested, total) {
  const wanted = Number.isInteger(requested) && requested > BATCH_SIZE ? Math.min(requested, MAX_RESTORED) : BATCH_SIZE;
  return Math.min(total, Math.ceil(wanted / BATCH_SIZE) * BATCH_SIZE);
}

export function nextShown(shown, total) {
  return Math.min(total, shown + BATCH_SIZE);
}
