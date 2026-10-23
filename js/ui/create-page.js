// Selber erstellen (erstellen.html[?q=<text>])
// Container-IDs (stabil, für spätere Module):
//   #create-form, #create-query   Freitext (bereinigt, höchstens 120 Zeichen) → erstellen.html?q=…
//   #create-status                Lade- und Fehlerzustand des Katalogs
//   #create-results               Ergebnisse der Freitext-Erkennung: #create-results-title, #create-results-body
//   #shape-generator              Formen-Generator – verborgen, bis ein Modul ihn befüllt (#shape-generator-body)
import { clear, requireElement } from './dom.js';
import { loadCatalog } from './data.js';
import {
  initPage, bindSearchForm, normalizeSearchQuery, renderLoading, renderError, renderInfo, linkButton, formatCount,
} from './shared.js';

initPage();
const query = normalizeSearchQuery(new URLSearchParams(window.location.search).get('q') ?? '');
const input = requireElement('create-query');
input.value = query;
bindSearchForm(requireElement('create-form'), input);
if (query) document.title = `„${query}“ – Selber erstellen – Block-Kompass`;
loadCatalogFor(query);

async function loadCatalogFor(text) {
  const status = requireElement('create-status');
  renderLoading(status, { title: 'Katalog wird geladen …', compact: true });
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    renderError(status, error, { onRetry: () => loadCatalogFor(text) });
    return;
  }
  clear(status).removeAttribute('aria-busy');
  if (!text) return;
  const results = requireElement('create-results');
  requireElement('create-results-title').textContent = `Ergebnisse für „${text}“`;
  results.hidden = false;
  renderInfo(requireElement('create-results-body'), {
    title: 'Freitext-Erkennung noch nicht angeschlossen',
    text: `Der Katalog mit ${formatCount(catalog.builds.length, 'Bau', 'Bauten')} ist geladen. Die Suche nach passenden Bauten und Formen aus deinem Text kommt im nächsten Ausbauschritt. Bis dahin findest du alle Bauten über die Kategorien.`,
    actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' })],
    headingLevel: 3,
  });
}
