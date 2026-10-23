// Startseite (index.html)
// Container-IDs (stabil, für spätere Module):
//   #home-search-form, #home-search-input  Suche/Freitext → erstellen.html?q=…
//   #home-total        Kurzinfo zum Katalog (Anzahl Bauten, Stand)
//   #home-status       Lade- und Fehlerzustand des Katalogs
//   #home-categories   Kategorie-Kacheln (aus CATEGORIES, Anzahl aus dem Katalog)
//   #home-picks        Abschnitt „Empfehlungen“ – bleibt verborgen, bis ein Modul ihn befüllt
//   #home-picks-list   Liste für Bau-Karten (createBuildCard)
import { el, clear, requireElement } from './dom.js';
import { loadCatalog, countByCategory } from './data.js';
import {
  initPage, bindSearchForm, CATEGORIES, renderCategoryGrid, setCategoryCounts, createChip,
  renderLoading, renderError, formatCount,
} from './shared.js';

initPage();
bindSearchForm(requireElement('home-search-form'), requireElement('home-search-input'));
const tiles = renderCategoryGrid(requireElement('home-categories'));
loadCounts();

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
}

async function loadCounts() {
  const status = requireElement('home-status');
  const total = clear(requireElement('home-total'));
  setCategoryCounts(tiles, undefined);
  renderLoading(status, { title: 'Katalog wird geladen …', compact: true });
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    setCategoryCounts(tiles, null);
    renderError(status, error, { onRetry: loadCounts });
    return;
  }
  setCategoryCounts(tiles, countByCategory(catalog));
  clear(status).removeAttribute('aria-busy');
  const date = catalog.generatedAt ? formatDate(catalog.generatedAt) : null;
  total.append(
    createChip(formatCount(catalog.builds.length, 'Bau', 'Bauten'), { className: 'chip--version' }),
    el('span', null, `in ${CATEGORIES.length} Kategorien${date ? ` · Katalog vom ${date}` : ''}`),
  );
}
