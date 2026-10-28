// Startseite (index.html): Titel, Suche, Kategorie-Kacheln und zwei Links – bewusst klein, ohne Bau-Reihen.
// Container-IDs (stabil, für spätere Module):
//   #home-search-form, #home-search-input  Suche/Freitext → erstellen.html?q=…
//   #home-status       Fehlerzustand des Katalogs (Laden zeigen die Kacheln selbst)
//   #home-categories   kompakte Kategorie-Kacheln (aus CATEGORIES, Anzahl aus dem Katalog)
//   #home-links        Links „Selber erstellen“ und „Meine Bauten“ (statisch im HTML)
import { clear, requireElement } from './dom.js';
import { loadCatalog, countByCategory } from './data.js';
import { initPage, bindSearchForm, renderCategoryGrid, setCategoryCounts, renderError } from './shared.js';

initPage();
bindSearchForm(requireElement('home-search-form'), requireElement('home-search-input'));
const grid = requireElement('home-categories');
const tiles = renderCategoryGrid(grid, { compact: true });
loadHome();

async function loadHome() {
  const status = requireElement('home-status');
  clear(status).removeAttribute('aria-busy');
  setCategoryCounts(tiles, undefined);
  grid.setAttribute('aria-busy', 'true');
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    setCategoryCounts(tiles, null);
    renderError(status, error, { onRetry: loadHome, compact: true });
    return;
  } finally {
    grid.removeAttribute('aria-busy');
  }
  setCategoryCounts(tiles, countByCategory(catalog));
}
