// Zustand der Kategorie-Seite in der Adresse (Teilen, Zurück-Taste):
// kategorie.html?k=<slug>&q=<text>&groesse=klein&groesse=mittel&herkunft=original&test=ungetestet&sort=bloecke-ab
// Mehrfachwerte als wiederholte Parameter (wie ein Formular sie sendet); Komma-Listen werden auch gelesen.
// Alles wird gegen Whitelists geprüft, Unbekanntes fällt weg (auch alte Angaben wie sort=schwierigkeit-auf:
// dann gilt die Standard-Sortierung). Rein und in Node testbar.
import { normalizeSearchQuery } from '../shared.js';
import { FILTER_KEYS, allowedFilterValues, emptyFilters } from './filters.js';
import { defaultSort, isSortAvailable } from './sort.js';

const MAX_VALUES_PER_KEY = 32;
const MAX_REPORTED_LENGTH = 40;

const shorten = (text) => (text.length > MAX_REPORTED_LENGTH ? `${text.slice(0, MAX_REPORTED_LENGTH)}…` : text);

/** k aus der Adresse: { kind: 'overview' } | { kind: 'category', slug } (Prüfung gegen CATEGORIES macht die Seite) */
export function categoryParam(search) {
  const slug = new URLSearchParams(search).get('k');
  return slug === null || slug === '' ? { kind: 'overview' } : { kind: 'category', slug };
}

/**
 * Liest Suche, Filter und Sortierung. ignored nennt verworfene Angaben (für einen Hinweis in der Konsole).
 * → { query, filters: { groesse: [], herkunft: [], test: [] }, sort, ignored }
 */
export function parseBrowseState(search) {
  const params = new URLSearchParams(search);
  const ignored = [];
  const query = normalizeSearchQuery(params.get('q') ?? '');
  const filters = emptyFilters();
  for (const key of FILTER_KEYS) {
    const allowed = allowedFilterValues(key);
    const raw = params.getAll(key).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
    if (raw.length > MAX_VALUES_PER_KEY) ignored.push(`${key}: ${raw.length - MAX_VALUES_PER_KEY} Werte zu viel`);
    const picked = new Set();
    for (const value of raw.slice(0, MAX_VALUES_PER_KEY)) {
      if (allowed.includes(value)) picked.add(value);
      else ignored.push(`${key}=${shorten(value)}`);
    }
    // feste Reihenfolge, damit gleiche Auswahl immer dieselbe Adresse ergibt
    filters[key] = allowed.filter((value) => picked.has(value));
  }
  let sort = defaultSort(query);
  const rawSort = params.get('sort');
  if (rawSort !== null && rawSort !== '') {
    if (isSortAvailable(rawSort, query)) sort = rawSort;
    else ignored.push(`sort=${shorten(rawSort)}`);
  }
  return { query, filters, sort, ignored };
}

/** Adress-Teil ab „?“ (leer, wenn nichts gesetzt ist); Standardwerte bleiben weg */
export function browseSearch(slug, { query = '', filters = emptyFilters(), sort = null } = {}) {
  const params = new URLSearchParams();
  if (slug) params.set('k', slug);
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery) params.set('q', normalizedQuery);
  for (const key of FILTER_KEYS) {
    for (const value of allowedFilterValues(key)) if (filters[key]?.includes(value)) params.append(key, value);
  }
  if (sort && sort !== defaultSort(normalizedQuery) && isSortAvailable(sort, normalizedQuery)) params.set('sort', sort);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** Seitenpfad der Kategorie-Seite mit Zustand, z. B. „kategorie.html?k=klein&sort=bloecke-ab“ */
export function browseHref(slug, state = {}) {
  return `kategorie.html${browseSearch(slug, state)}`;
}

export function sameBrowseState(a, b) {
  return a.query === b.query && a.sort === b.sort
    && FILTER_KEYS.every((key) => (a.filters[key] ?? []).join(',') === (b.filters[key] ?? []).join(','));
}

/** Zustand ohne Suche und Filter (Sortierung bleibt, außer sie braucht eine Suche) */
export function resetBrowseState(state) {
  return { query: '', filters: emptyFilters(), sort: isSortAvailable(state.sort, '') ? state.sort : defaultSort('') };
}
