// Startseite (index.html)
// Container-IDs (stabil, für spätere Module):
//   #home-search-form, #home-search-input  Suche/Freitext → erstellen.html?q=…
//   #home-total        Gesamtzahlen des Katalogs (Bauten, Kategorien, Original-Strukturen, Blöcke, Stand)
//   #home-status       Lade-, Leer- und Fehlerzustand des Katalogs
//   #home-categories   Kategorie-Kacheln (aus CATEGORIES, Anzahl aus dem Katalog)
//   #home-sections     Abschnitte aus echten Katalogdaten (Riesenbauten, Klein & schnell gebaut …), siehe browse/home-sections.js
import { el, clear, requireElement, sitePath } from './dom.js';
import { loadCatalog, countByCategory } from './data.js';
import {
  initPage, bindSearchForm, renderCategoryGrid, setCategoryCounts, createChip, createBuildCard, createSkeletonCards,
  renderLoading, renderEmpty, renderError, formatCount, icon,
} from './shared.js';
import { selectHomeSections, catalogTotals } from './browse/home-sections.js';
import { formatStatNumber } from './browse/model.js';

const SKELETON_SECTIONS = 2;

initPage();
bindSearchForm(requireElement('home-search-form'), requireElement('home-search-input'));
const tiles = renderCategoryGrid(requireElement('home-categories'));
loadHome();

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
}

async function loadHome() {
  const status = requireElement('home-status');
  const total = clear(requireElement('home-total'));
  const sections = requireElement('home-sections');
  setCategoryCounts(tiles, undefined);
  renderLoading(status, { title: 'Katalog wird geladen …', compact: true });
  renderSkeletonSections(sections);
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    setCategoryCounts(tiles, null);
    clear(sections).removeAttribute('aria-busy');
    renderError(status, error, { onRetry: loadHome });
    return;
  }
  setCategoryCounts(tiles, countByCategory(catalog));
  sections.removeAttribute('aria-busy');
  if (catalog.builds.length === 0) {
    clear(sections);
    renderEmpty(status, {
      title: 'Der Katalog ist noch leer',
      text: 'Er enthält noch keine Bauten.',
      compact: true,
    });
    return;
  }
  clear(status).removeAttribute('aria-busy');
  total.append(...totalsLine(catalog).filter(Boolean));
  sections.replaceChildren(...selectHomeSections(catalog.builds).map(createSection));
}

/** Gesamtzahlen unter der Suche: Zahl groß in Mono, Bezeichnung daneben */
function totalsLine(catalog) {
  const totals = catalogTotals(catalog.builds);
  const stat = (value, label) => el('li', { class: 'hero-stats__item' }, el('strong', { class: 'hero-stats__value' }, formatStatNumber(value)), ` ${label}`);
  const items = [
    stat(totals.builds, totals.builds === 1 ? 'Bau' : 'Bauten'),
    stat(totals.categories, totals.categories === 1 ? 'Kategorie' : 'Kategorien'),
    totals.originals > 0 ? stat(totals.originals, 'original aus dem Spiel') : null,
    stat(totals.blocks, totals.blocks === 1 ? 'Block' : 'Blöcke'),
  ];
  const date = catalog.generatedAt ? formatDate(catalog.generatedAt) : null;
  return [
    el('ul', { class: 'hero-stats', role: 'list', 'aria-label': 'Der Katalog in Zahlen' }, items),
    date ? createChip(`Stand ${date}`, { className: 'chip--version' }) : null,
  ];
}

/** Ein Abschnitt: Kopf mit Titel, Erklärung und Anzahl, vier Karten, Links zu den passenden Kategorien */
function createSection(section) {
  const titleId = `home-section-${section.id}-title`;
  const more = section.total > section.builds.length
    ? el('p', { class: 'shelf__more' },
      el('span', { class: 'shelf__more-label' }, 'Mehr davon:'),
      section.links.map((link) => el('a', { class: 'shelf-link', href: sitePath(link.href), dataset: { category: link.slug } },
        el('span', null, link.label), icon('arrow-right'))))
    : null;
  return el('section', { class: 'shelf', 'aria-labelledby': titleId, dataset: { section: section.id } },
    el('div', { class: 'container' },
      el('div', { class: 'shelf__head' },
        el('div', { class: 'shelf__heading' },
          el('h2', { class: 'section__title', id: titleId }, section.title),
          el('p', { class: 'section__lead' }, section.lead)),
        el('p', { class: 'shelf__count' }, formatCount(section.total, 'Bau', 'Bauten'))),
      el('ul', { class: 'card-grid shelf__list', role: 'list' }, section.builds.map((build) => el('li', null, createBuildCard(build)))),
      more));
}

/** Platzhalter während des Ladens (für Screenreader verborgen, die Ansage macht #home-status) */
function renderSkeletonSections(container) {
  container.setAttribute('aria-busy', 'true');
  container.replaceChildren(...Array.from({ length: SKELETON_SECTIONS }, () => el('div', { class: 'shelf', 'aria-hidden': 'true' },
    el('div', { class: 'container' },
      el('div', { class: 'shelf__head' },
        el('div', { class: 'shelf__heading' },
          el('span', { class: 'skeleton skeleton--title' }),
          el('span', { class: 'skeleton skeleton--text' }))),
      el('ul', { class: 'card-grid shelf__list', role: 'list' }, createSkeletonCards(4))))));
}
