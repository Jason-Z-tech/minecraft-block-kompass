// Kategorie-Seite (kategorie.html?k=<slug>; ohne k: Übersicht aller Kategorien)
// Zustand in der Adresse: &q=<text>&groesse=…&herkunft=…&test=…&sort=… (siehe browse/url-state.js)
// Container-IDs (stabil, für spätere Module):
//   #category-head                Seitenkopf; data-category setzt die Akzentfarbe (Grasskante, Icon)
//   #category-crumb-all           Brotkrümel „Kategorien“
//   #category-crumb-current       Brotkrümel der aktuellen Kategorie
//   #category-icon, #category-title, #category-lead, #category-count
//   #category-status              Lade- und Fehlerzustand, leere Kategorie
//   #category-browse              Suche, Filter, Sortierung und Ergebnisse – verborgen, bis der Katalog da ist
//   #category-query-form, #category-query   Textfilter innerhalb der Kategorie
//   #category-sort                Sortierung
//   #category-filter-toggle       Filter ein-/ausklappen (schmale Bildschirme)
//   #category-filters             Filterbereich; darin #category-filters-groups (Größe, Herkunft, Test im Spiel)
//   #category-filters-done        „N Bauten anzeigen“ – klappt die Filter auf dem Handy wieder zu
//   #category-result-count        Anzahl der Treffer (Live-Region)
//   #category-active              aktive Filter als entfernbare Chips
//   #category-empty               Leerzustand, wenn nichts zur Auswahl passt
//   #category-list                Bau-Karten (createBuildCard), schrittweise nachgeladen
//   #category-more, #category-more-button, #category-more-status   Nachladen weiterer Karten
//   #category-overview, #category-overview-title, #category-overview-list   alle Kategorien als Kacheln
import { el, clear, requireElement, setChildren } from './dom.js';
import { loadCatalog, countByCategory } from './data.js';
import {
  initPage, findCategory, icon, renderCategoryGrid, setCategoryCounts, createBuildCard, createSkeletonCards,
  renderError, renderEmpty, renderState, linkButton, formatCount, formatNumber, searchHref, CATEGORIES,
} from './shared.js';
import { FILTER_KEYS, filterOption, filterGroup } from './browse/filters.js';
import { SORT_OPTIONS, defaultSort, isSortAvailable } from './browse/sort.js';
import { parseBrowseState, browseSearch, resetBrowseState, sameBrowseState } from './browse/url-state.js';
import { createBrowseIndex, computeView, initialShown, nextShown, BATCH_SIZE } from './browse/view.js';

const MAX_SHOWN_SLUG = 40;
const TYPING_DELAY_MS = 180;
const SCROLL_SAVE_MS = 300;
// Nachladen, sobald das Ende der Liste so nah ist (eine gute Bildschirmhöhe vorher)
const PRELOAD_PX = 900;
const PRELOAD_MARGIN = `${PRELOAD_PX}px 0px`;
const HISTORY_MARK = 'bk-browse';

initPage();
const slug = new URLSearchParams(window.location.search).get('k');
if (slug === null || slug === '') showOverview();
else {
  const category = findCategory(slug);
  if (category) showCategory(category);
  else showUnknown(slug);
}

/* ------------------------------------------------------------------ Übersicht und unbekannte Kategorie */

function showOverview() {
  const crumbAll = requireElement('category-crumb-all');
  crumbAll.replaceChildren(el('span', { 'aria-current': 'page' }, 'Kategorien'));
  requireElement('category-overview-title').classList.add('visually-hidden');
  loadOverview({ showTotal: true });
}

function showUnknown(rawSlug) {
  const shown = rawSlug.length > MAX_SHOWN_SLUG ? `${rawSlug.slice(0, MAX_SHOWN_SLUG)} …` : rawSlug;
  document.title = 'Kategorie nicht gefunden – Block-Kompass';
  requireElement('category-title').textContent = 'Kategorie nicht gefunden';
  requireElement('category-lead').textContent = 'Wähle eine der Kategorien unten aus.';
  renderState(requireElement('category-status'), {
    kind: 'error',
    title: 'Diese Kategorie gibt es nicht',
    text: `„${shown}“ ist keine bekannte Kategorie. Vielleicht ist die Adresse unvollständig.`,
    actions: [linkButton('Zur Startseite', 'index.html', { variant: 'ghost', iconName: 'home' })],
  });
  loadOverview({ keepStatus: true });
}

/** Kacheln aller Kategorien mit Anzahl aus dem Katalog */
async function loadOverview({ keepStatus = false, showTotal = false } = {}) {
  const overview = requireElement('category-overview');
  overview.hidden = false;
  const tiles = renderCategoryGrid(requireElement('category-overview-list'));
  setCategoryCounts(tiles, undefined);
  try {
    const catalog = await loadCatalog();
    setCategoryCounts(tiles, countByCategory(catalog));
    if (!keepStatus) clear(requireElement('category-status'));
    if (showTotal) requireElement('category-count').textContent = `${formatCount(catalog.builds.length, 'Bau', 'Bauten')} in ${formatCount(CATEGORIES.length, 'Kategorie', 'Kategorien')}`;
  } catch (error) {
    setCategoryCounts(tiles, null);
    // Ein bereits angezeigter Hinweis (z. B. unbekannte Kategorie) bleibt stehen; Details in der Konsole
    if (keepStatus) console.warn('[Block-Kompass] Katalog für die Kategorie-Übersicht nicht verfügbar:', error);
    else renderError(requireElement('category-status'), error, { onRetry: () => loadOverview({ showTotal }) });
  }
}

/* ------------------------------------------------------------------ Kategorie */

function showCategory(category) {
  document.title = `${category.title} – Block-Kompass`;
  requireElement('category-head').dataset.category = category.slug;
  requireElement('category-icon').replaceChildren(icon(category.icon, { size: 48 }));
  requireElement('category-title').textContent = category.title;
  requireElement('category-lead').textContent = category.description;
  const current = requireElement('category-crumb-current');
  current.textContent = category.title;
  current.hidden = false;
  loadList(category);
}

async function loadList(category) {
  const status = requireElement('category-status');
  const browse = requireElement('category-browse');
  const list = requireElement('category-list');
  const count = clear(requireElement('category-count'));
  status.replaceChildren(el('p', { class: 'visually-hidden' }, 'Bauten werden geladen …'));
  browse.hidden = false;
  browse.classList.add('is-loading');
  list.setAttribute('aria-busy', 'true');
  list.replaceChildren(...createSkeletonCards(6));
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    browse.hidden = true;
    browse.classList.remove('is-loading');
    list.removeAttribute('aria-busy');
    clear(list);
    renderError(status, error, { onRetry: () => loadList(category) });
    return;
  }
  browse.classList.remove('is-loading');
  list.removeAttribute('aria-busy');
  const builds = catalog.builds.filter((build) => build.category === category.slug);
  count.textContent = builds.length ? formatCount(builds.length, 'Bau', 'Bauten') : '';
  if (builds.length === 0) {
    browse.hidden = true;
    clear(list);
    renderEmpty(status, {
      title: 'Noch keine Bauten in dieser Kategorie',
      text: 'Sobald der Katalog Bauten zu diesem Thema enthält, erscheinen sie hier.',
      actions: [linkButton('Alle Kategorien', 'kategorie.html', { iconName: 'grid' })],
    });
    return;
  }
  clear(status);
  startBrowse(category, builds);
}

/* ------------------------------------------------------------------ Suchen, Filtern, Sortieren */

/** Alles, was die Ansicht einer Kategorie ausmacht (eine Instanz pro Seite) */
const ui = {
  category: null,
  index: null,
  state: null,
  view: null,
  shown: BATCH_SIZE,
  cards: new Map(),
  filterSignature: '',
  typing: false,
  typingTimer: null,
  observer: null,
};

function startBrowse(category, builds) {
  ui.category = category;
  ui.index = createBrowseIndex(builds);
  ui.state = readStateFromLocation();
  ui.shown = initialShown(history.state?.mark === HISTORY_MARK ? history.state.shown : null, builds.length);
  // Die Adresse in der Normalform festhalten (ungültige Angaben fallen weg), gemerkte Werte bleiben
  replaceHistory({ shown: ui.shown, scrollY: savedScrollY() });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  bindControls();
  syncQueryInput();
  render({ restoreScroll: true });
  window.addEventListener('popstate', onPopState);
  window.addEventListener('scroll', throttle(saveScroll, SCROLL_SAVE_MS), { passive: true });
  window.addEventListener('pagehide', saveScroll);
}

function readStateFromLocation() {
  const parsed = parseBrowseState(window.location.search);
  if (parsed.ignored.length) console.warn(`[Block-Kompass] Unbekannte Angaben in der Adresse ignoriert: ${parsed.ignored.join(', ')}`);
  return { query: parsed.query, filters: parsed.filters, sort: parsed.sort };
}

function currentUrl(state) {
  return `${window.location.pathname}${browseSearch(ui.category.slug, state)}`;
}

function historyData(extra = {}) {
  return { mark: HISTORY_MARK, shown: ui.shown, scrollY: window.scrollY, ...extra };
}

function replaceHistory(extra = {}) {
  history.replaceState(historyData(extra), '', currentUrl(ui.state));
}

function savedScrollY() {
  const value = history.state?.mark === HISTORY_MARK ? history.state.scrollY : null;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function saveScroll() {
  if (!ui.state) return;
  history.replaceState(historyData(), '', window.location.href);
}

/** Neuer Zustand: Adresse aktualisieren (push = eigener Eintrag für die Zurück-Taste) und neu zeichnen */
function commit(nextState, { push }) {
  if (sameBrowseState(nextState, ui.state)) return;
  if (push) saveScroll();
  ui.state = nextState;
  ui.shown = BATCH_SIZE;
  if (push) history.pushState(historyData({ scrollY: 0 }), '', currentUrl(nextState));
  else replaceHistory();
  render();
}

function onPopState(event) {
  clearTimeout(ui.typingTimer);
  ui.typing = false;
  ui.state = readStateFromLocation();
  const data = event.state?.mark === HISTORY_MARK ? event.state : null;
  ui.shown = initialShown(data?.shown ?? null, ui.index.items.length);
  syncQueryInput();
  render({ restoreScroll: true });
}

/** Sortierung bei geänderter Suche: wer nichts gewählt hat, bekommt die passende Standard-Sortierung */
function sortForQuery(sort, oldQuery, newQuery) {
  if (sort === defaultSort(oldQuery) || !isSortAvailable(sort, newQuery)) return defaultSort(newQuery);
  return sort;
}

function withQuery(query) {
  return { ...ui.state, query, sort: sortForQuery(ui.state.sort, ui.state.query, query) };
}

function bindControls() {
  const form = requireElement('category-query-form');
  const input = requireElement('category-query');
  input.setAttribute('aria-describedby', 'category-result-count');
  // Tippen: erster Tastendruck legt einen Eintrag für die Zurück-Taste an, weitere ersetzen ihn
  input.addEventListener('input', () => {
    clearTimeout(ui.typingTimer);
    ui.typingTimer = setTimeout(() => applyQuery(input.value), TYPING_DELAY_MS);
  });
  input.addEventListener('blur', () => { ui.typing = false; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(ui.typingTimer);
    applyQuery(input.value);
    ui.typing = false;
  });
  requireElement('category-sort').addEventListener('change', (event) => {
    const sort = event.target.value;
    if (isSortAvailable(sort, ui.state.query)) commit({ ...ui.state, sort }, { push: true });
  });
  requireElement('category-filters').addEventListener('change', onFilterChange);
  const toggle = requireElement('category-filter-toggle');
  toggle.addEventListener('click', () => setFiltersOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  requireElement('category-filters-done').addEventListener('click', () => {
    setFiltersOpen(false);
    requireElement('category-result-count').scrollIntoView({ block: 'start' });
    toggle.focus({ preventScroll: true });
  });
  const moreButton = requireElement('category-more-button');
  moreButton.addEventListener('click', () => loadMore({ focusNew: true }));
  if ('IntersectionObserver' in window) {
    // Hat der Knopf den Fokus (Tastatur), lädt erst sein Druck – sonst spränge er beim Ansteuern weg
    ui.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && document.activeElement !== moreButton) loadMore();
    }, { rootMargin: PRELOAD_MARGIN });
    ui.observer.observe(requireElement('category-more'));
  }
}

function applyQuery(rawValue) {
  const next = withQuery(normalizedQuery(rawValue));
  commit(next, { push: !ui.typing });
  ui.typing = true;
}

function normalizedQuery(value) {
  return parseBrowseState(`?q=${encodeURIComponent(value)}`).query;
}

function syncQueryInput() {
  requireElement('category-query').value = ui.state.query;
}

function setFiltersOpen(open) {
  requireElement('category-browse').classList.toggle('is-filters-open', open);
  requireElement('category-filter-toggle').setAttribute('aria-expanded', String(open));
}

function onFilterChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox' || !filterGroup(input.name)) return;
  const checked = [...requireElement('category-filters').querySelectorAll(`input[name="${input.name}"]:checked`)].map((box) => box.value);
  const allowed = filterGroup(input.name).options.map((option) => option.value);
  const filters = { ...ui.state.filters, [input.name]: allowed.filter((value) => checked.includes(value)) };
  commit({ ...ui.state, filters }, { push: true });
}

function removeFilter(key, value) {
  const filters = { ...ui.state.filters, [key]: ui.state.filters[key].filter((entry) => entry !== value) };
  commit({ ...ui.state, filters }, { push: true });
}

function resetAll() {
  commit(resetBrowseState(ui.state), { push: true });
  syncQueryInput();
}

/* ------------------------------------------------------------------ Zeichnen */

function render({ restoreScroll = false } = {}) {
  try {
    ui.view = computeView(ui.index, ui.state, { category: ui.category.slug });
  } catch (error) {
    requireElement('category-browse').hidden = true;
    renderError(requireElement('category-status'), error);
    return;
  }
  renderSort();
  renderFilters();
  renderSummary();
  renderActiveFilters();
  renderResults();
  if (restoreScroll) {
    const y = savedScrollY();
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}

function renderSort() {
  const select = requireElement('category-sort');
  const options = SORT_OPTIONS.filter((option) => isSortAvailable(option.key, ui.state.query));
  const signature = options.map((option) => option.key).join(',');
  if (select.dataset.options !== signature) {
    select.replaceChildren(...options.map((option) => el('option', { value: option.key }, option.label)));
    select.dataset.options = signature;
  }
  select.value = ui.state.sort;
}

function renderFilters() {
  const container = requireElement('category-filters-groups');
  const groups = ui.view.groups.filter((group) => group.visible);
  const signature = groups.map((group) => `${group.key}:${group.options.map((option) => option.value).join(',')}`).join('|');
  if (signature !== ui.filterSignature) {
    ui.filterSignature = signature;
    container.replaceChildren(...groups.map(createFilterGroup));
  }
  for (const input of container.querySelectorAll('input[type="checkbox"]')) {
    const selected = ui.state.filters[input.name]?.includes(input.value) ?? false;
    const count = ui.view.counts[input.name]?.[input.value] ?? 0;
    input.checked = selected;
    const label = input.closest('.filter-option');
    label.classList.toggle('is-empty', count === 0 && !selected);
    label.querySelector('.filter-option__number').textContent = formatNumber(count);
    label.querySelector('.filter-option__unit').textContent = count === 1 ? ' Bau' : ' Bauten';
  }
  const active = ui.view.activeFilters;
  const badge = requireElement('category-filter-toggle').querySelector('.browse__toggle-count');
  badge.textContent = active ? String(active) : '';
  badge.hidden = active === 0;
  requireElement('category-filters-done').querySelector('span').textContent = `${formatCount(ui.view.results.length, 'Bau', 'Bauten')} anzeigen`;
}

function createFilterGroup(group) {
  const titleId = `filter-${group.key}-title`;
  return el('fieldset', { class: 'filter-group', dataset: { group: group.key } },
    el('legend', { class: 'filter-group__title', id: titleId }, group.title),
    el('ul', { class: 'filter-group__list', role: 'list' }, group.options.map((option) => el('li', null,
      el('label', { class: 'choice filter-option' },
        el('input', { type: 'checkbox', name: group.key, value: option.value }),
        el('span', { class: 'filter-option__text' },
          el('span', { class: 'filter-option__label' }, option.label),
          option.hint ? el('span', { class: 'filter-option__hint' }, option.hint) : null),
        el('span', { class: 'filter-option__count' },
          el('span', { class: 'filter-option__number' }),
          el('span', { class: 'visually-hidden filter-option__unit' })))))));
}

function renderSummary() {
  const { results, total } = ui.view;
  const { query } = ui.state;
  const filters = ui.view.activeFilters > 0;
  let text = formatCount(total, 'Bau', 'Bauten');
  if (query || filters) {
    const what = query ? `zu „${query}“${filters ? ' und deinen Filtern' : ''}` : 'zu deinen Filtern';
    if (results.length === 0) text = `Keiner von ${text} passt ${what}`;
    else text = `${formatNumber(results.length)} von ${text} ${results.length === 1 ? 'passt' : 'passen'} ${what}`;
  }
  const node = requireElement('category-result-count');
  if (node.textContent !== text) node.textContent = text;
}

function renderActiveFilters() {
  const container = requireElement('category-active');
  const chips = [];
  if (ui.state.query) {
    chips.push(activeChip(`Suche: „${ui.state.query}“`, 'Suche entfernen', () => {
      commit(withQuery(''), { push: true });
      syncQueryInput();
    }));
  }
  for (const key of FILTER_KEYS) {
    const group = filterGroup(key);
    for (const value of ui.state.filters[key]) {
      const label = filterOption(key, value)?.label ?? value;
      chips.push(activeChip(`${group.title}: ${label}`, `Filter ${group.title}: ${label} entfernen`, () => removeFilter(key, value)));
    }
  }
  if (chips.length > 1) {
    chips.push(el('li', null, el('button', { class: 'btn btn--ghost btn--sm', type: 'button', on: { click: resetAll } }, icon('retry'), el('span', null, 'Alles zurücksetzen'))));
  }
  container.replaceChildren(...chips);
  container.hidden = chips.length === 0;
}

function activeChip(text, label, onRemove) {
  return el('li', null, el('button', { class: 'active-chip', type: 'button', 'aria-label': label, on: { click: onRemove } },
    el('span', null, text), icon('close')));
}

function cardFor(build) {
  let item = ui.cards.get(build.id);
  if (!item) {
    item = el('li', null, createBuildCard(build));
    ui.cards.set(build.id, item);
  }
  return item;
}

function renderResults() {
  const list = requireElement('category-list');
  const empty = requireElement('category-empty');
  const { results } = ui.view;
  if (results.length === 0) {
    clear(list);
    list.hidden = true;
    requireElement('category-more').hidden = true;
    renderNoMatches(empty);
    return;
  }
  clear(empty);
  list.hidden = false;
  list.replaceChildren(...results.slice(0, ui.shown).map(cardFor));
  updateMore();
}

function renderNoMatches(container) {
  const actions = [el('button', { class: 'btn btn--secondary', type: 'button', on: { click: resetAll } }, icon('retry'), el('span', null, 'Suche und Filter zurücksetzen'))];
  if (ui.state.query) {
    actions.push(el('a', { class: 'btn btn--ghost', href: searchHref(ui.state.query) }, icon('search'), el('span', null, 'In allen Kategorien suchen')));
  }
  renderEmpty(container, {
    title: 'Keine Bauten passen zu deiner Auswahl',
    text: ui.state.query
      ? `In „${ui.category.title}“ passt nichts zu „${ui.state.query}“${ui.view.activeFilters ? ' mit diesen Filtern' : ''}.`
      : 'Mit dieser Kombination von Filtern bleibt in dieser Kategorie nichts übrig. Nimm einen Filter heraus.',
    actions,
    headingLevel: 3,
  });
}

function updateMore() {
  const total = ui.view.results.length;
  const more = requireElement('category-more');
  more.hidden = ui.shown >= total;
  if (more.hidden) return;
  const next = Math.min(BATCH_SIZE, total - ui.shown);
  setChildren(requireElement('category-more-button').querySelector('span'), `${formatCount(next, 'weiteren Bau', 'weitere Bauten')} laden`);
  requireElement('category-more-status').textContent = `${formatNumber(ui.shown)} von ${formatNumber(total)} angezeigt`;
}

function loadMore({ focusNew = false } = {}) {
  if (!ui.view) return;
  const total = ui.view.results.length;
  if (ui.shown >= total) return;
  const from = ui.shown;
  ui.shown = nextShown(ui.shown, total);
  const list = requireElement('category-list');
  const added = ui.view.results.slice(from, ui.shown).map(cardFor);
  list.append(...added);
  updateMore();
  replaceHistory();
  if (focusNew) {
    added[0]?.querySelector('a')?.focus();
    return;
  }
  // Ist das Listenende danach immer noch im Vorlade-Bereich (große Bildschirme), gleich weiter
  requestAnimationFrame(() => {
    const more = requireElement('category-more');
    const focused = document.activeElement === requireElement('category-more-button');
    if (!more.hidden && !focused && more.getBoundingClientRect().top < window.innerHeight + PRELOAD_PX) loadMore();
  });
}

function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  return () => {
    const wait = last + ms - Date.now();
    if (wait <= 0) {
      last = Date.now();
      fn();
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn();
      }, wait);
    }
  };
}
