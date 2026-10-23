// Kategorie-Seite (kategorie.html?k=<slug>; ohne k: Übersicht aller Kategorien)
// Container-IDs (stabil, für spätere Module):
//   #category-head                Seitenkopf; data-category setzt die Akzentfarbe (Grasskante, Icon)
//   #category-crumb-all           Brotkrümel „Kategorien“
//   #category-crumb-current       Brotkrümel der aktuellen Kategorie
//   #category-icon, #category-title, #category-lead, #category-count
//   #category-status              Lade-, Leer- und Fehlerzustand
//   #category-filters             Filter und Sortierung – verborgen, bis ein Modul sie befüllt
//   #category-list                Bau-Karten der Kategorie (createBuildCard)
//   #category-overview, #category-overview-title, #category-overview-list   alle Kategorien als Kacheln
import { el, clear, requireElement } from './dom.js';
import { loadCatalog, countByCategory } from './data.js';
import {
  initPage, findCategory, icon, renderCategoryGrid, setCategoryCounts, createBuildCard, createSkeletonCards,
  renderError, renderEmpty, renderState, linkButton, formatCount,
} from './shared.js';

const MAX_SHOWN_SLUG = 40;

initPage();
const slug = new URLSearchParams(window.location.search).get('k');
if (slug === null || slug === '') showOverview();
else {
  const category = findCategory(slug);
  if (category) showCategory(category);
  else showUnknown(slug);
}

function showOverview() {
  const crumbAll = requireElement('category-crumb-all');
  crumbAll.replaceChildren(el('span', { 'aria-current': 'page' }, 'Kategorien'));
  requireElement('category-overview-title').classList.add('visually-hidden');
  loadOverview();
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
async function loadOverview({ keepStatus = false } = {}) {
  const overview = requireElement('category-overview');
  overview.hidden = false;
  const tiles = renderCategoryGrid(requireElement('category-overview-list'));
  setCategoryCounts(tiles, undefined);
  try {
    setCategoryCounts(tiles, countByCategory(await loadCatalog()));
  } catch (error) {
    setCategoryCounts(tiles, null);
    // Ein bereits angezeigter Hinweis (z. B. unbekannte Kategorie) bleibt stehen; Details in der Konsole
    if (keepStatus) console.warn('[Block-Kompass] Katalog für die Kategorie-Übersicht nicht verfügbar:', error);
    else renderError(requireElement('category-status'), error, { onRetry: () => loadOverview() });
  }
}

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
  const list = requireElement('category-list');
  const count = clear(requireElement('category-count'));
  status.replaceChildren(el('p', { class: 'visually-hidden' }, 'Bauten werden geladen …'));
  list.hidden = false;
  list.setAttribute('aria-busy', 'true');
  list.replaceChildren(...createSkeletonCards(6));
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    list.hidden = true;
    list.removeAttribute('aria-busy');
    clear(list);
    renderError(status, error, { onRetry: () => loadList(category) });
    return;
  }
  const builds = catalog.builds.filter((build) => build.category === category.slug);
  list.removeAttribute('aria-busy');
  count.textContent = builds.length ? formatCount(builds.length, 'Bau', 'Bauten') : '';
  if (builds.length === 0) {
    list.hidden = true;
    clear(list);
    renderEmpty(status, {
      title: 'Noch keine Bauten in dieser Kategorie',
      text: 'Sobald der Katalog Bauten zu diesem Thema enthält, erscheinen sie hier.',
      actions: [linkButton('Alle Kategorien', 'kategorie.html', { iconName: 'grid' })],
    });
    return;
  }
  clear(status);
  list.replaceChildren(...builds.map((build) => el('li', null, createBuildCard(build))));
}
