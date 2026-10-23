// Bau-Seite (bau.html?id=<id>[&scale=<zahl>] oder bau.html?form=<form>)
// Container-IDs (stabil, für spätere Module):
//   #build-status          seitenweiter Zustand (Adresse ungültig, Katalog fehlt, Bau unbekannt)
//   #build-layout          Raster aus Kopf, 3D-Bühne, Player und Tabs (Handy untereinander, Desktop zweispaltig)
//   #build-head            Kopf: #build-crumb-category, #build-crumb-current, #build-title, #build-subtitle, #build-chips
//   #build-stage           3D-Bühne: #viewer-canvas (WebGL2-Viewer §7.4), #viewer-preview (Vorschaubild),
//                          #viewer-toolbar (Ansicht, Modus, Geist, Schnitt), #viewer-status (Zustand über der Bühne)
//   #step-player           Schritt-Player: #step-xp (setXpProgress), #step-level, #step-prev, #step-play (aria-pressed),
//                          #step-next, #step-label, #step-slider (initSlider)
//   #build-tabs            Tabs (initTabs): #tab-guide/#panel-guide, #tab-materials/#panel-materials,
//                          #tab-layers/#panel-layers, #tab-info/#panel-info
import { el, clear, setChildren, requireElement, sitePath } from './dom.js';
import { loadCatalog, findBuild } from './data.js';
import {
  initPage, parseBuildParams, findCategory, initTabs, initSlider, setXpProgress, renderState, renderLoading,
  renderError, renderInfo, linkButton, showToast, createCategoryChip, createAccuracyChip, createUntestedChip, createChip,
  formatNumber, formatSize, accuracyLabel, difficultyLabel,
} from './shared.js';

const INVALID_TEXTS = {
  id: 'Die Kennung des Baus in der Adresse ist ungültig. Erlaubt sind Kleinbuchstaben, Ziffern und Bindestriche.',
  scale: 'Der Maßstab in der Adresse ist ungültig. Erlaubt ist eine Zahl wie 1 oder 0.5.',
  form: 'Der Name der Form in der Adresse ist ungültig.',
  both: 'Die Adresse enthält gleichzeitig einen Bau und eine Form. Wähle eins von beidem.',
};

// Bereiche, die mit der 3D-Ansicht kommen (Viewer, Schrittplan und Materialliste)
const PENDING_PANELS = [
  ['panel-guide', 'Anleitung folgt', 'Die Schritt-für-Schritt-Anleitung wird zusammen mit der 3D-Ansicht angeschlossen.'],
  ['panel-materials', 'Materialliste folgt', 'Die Materialliste (gesamt und pro Schritt, abhakbar) kommt zusammen mit der 3D-Ansicht.'],
  ['panel-layers', 'Ebenen-Plan folgt', 'Der Ebenen-Plan mit Block-Icons kommt zusammen mit der 3D-Ansicht.'],
];

initPage();
const tabs = initTabs(requireElement('build-tabs'));
initSlider(requireElement('step-slider'));
setXpProgress(requireElement('step-xp'), { value: 0, max: 0, level: 0, label: 'Noch kein Bau geladen' });
start(parseBuildParams(window.location.search));

function start(params) {
  if (params.kind === 'build') {
    loadBuild(params);
    return;
  }
  if (params.kind === 'form') {
    showPageState({
      kind: 'info',
      title: 'Formen-Generator noch nicht verfügbar',
      text: `Die Form „${params.form}“ kann angezeigt werden, sobald der Formen-Generator angeschlossen ist.`,
      actions: [linkButton('Selber erstellen', 'erstellen.html', { iconName: 'hammer' })],
    });
    return;
  }
  if (params.kind === 'none') {
    showPageState({
      kind: 'info',
      title: 'Kein Bau ausgewählt',
      text: 'Wähle einen Bau in einer Kategorie aus oder beschreibe deine eigene Idee.',
      actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' }), linkButton('Selber erstellen', 'erstellen.html', { variant: 'ghost', iconName: 'hammer' })],
    });
    return;
  }
  showPageState({
    kind: 'error',
    title: 'Ungültige Adresse',
    text: INVALID_TEXTS[params.reason],
    actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' })],
  });
}

function showPageState(spec) {
  requireElement('build-layout').hidden = true;
  document.title = `${spec.title} – Block-Kompass`;
  renderState(requireElement('build-status'), { headingLevel: 1, ...spec });
}

async function loadBuild(params) {
  const layout = requireElement('build-layout');
  const status = clear(requireElement('build-status'));
  layout.hidden = false;
  renderLoading(requireElement('viewer-status'), { title: 'Bau wird geladen …', compact: true, centered: true });
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    layout.hidden = true;
    document.title = 'Bau nicht verfügbar – Block-Kompass';
    renderError(status, error, { onRetry: () => loadBuild(params), headingLevel: 1 });
    return;
  }
  const build = findBuild(catalog, params.id);
  if (!build) {
    showPageState({
      kind: 'error',
      title: 'Bau nicht gefunden',
      text: `Im Katalog gibt es keinen Bau mit der Kennung „${params.id}“.`,
      actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' })],
    });
    return;
  }
  showBuild(build, params);
}

function showBuild(build, params) {
  const category = findCategory(build.category);
  document.title = `${build.title} – Block-Kompass`;
  const crumb = requireElement('build-crumb-category');
  crumb.textContent = category.title;
  crumb.setAttribute('href', sitePath(`kategorie.html?k=${category.slug}`));
  requireElement('build-crumb-current').textContent = build.title;
  requireElement('build-title').textContent = build.title;
  requireElement('build-subtitle').textContent = build.subtitle;
  const chips = [
    createCategoryChip(build.category),
    build.accuracy ? createAccuracyChip(build.accuracy) : null,
    build.tested === false ? createUntestedChip() : null,
  ].filter(Boolean);
  requireElement('build-chips').replaceChildren(...chips.map((chip) => el('li', null, chip)));
  showPreview(build);
  renderInfo(requireElement('viewer-status'), {
    title: '3D-Ansicht folgt',
    text: 'Die 3D-Ansicht mit Schritt-Player wird im nächsten Ausbauschritt angeschlossen. Größe, Blöcke und Herkunft findest du schon unter „Infos“.',
    compact: true,
    centered: true,
    headingLevel: 2,
  });
  for (const [panelId, title, text] of PENDING_PANELS) renderInfo(requireElement(panelId), { title, text, compact: true, headingLevel: 2 });
  renderFacts(requireElement('panel-info'), build);
  tabs.select('tab-info');
  if (params.scale !== null && !build.scales.includes(params.scale)) {
    showToast({
      kind: 'warning',
      title: 'Maßstab nicht verfügbar',
      text: build.scales.length
        ? `Für diesen Bau gibt es nur: ${build.scales.map(formatScale).join(', ')}.`
        : 'Dieser Bau hat nur seine Originalgröße.',
    });
  }
}

function showPreview(build) {
  const preview = requireElement('viewer-preview');
  if (!build.thumb) {
    preview.hidden = true;
    return;
  }
  preview.addEventListener('error', () => {
    console.warn(`[Block-Kompass] Vorschaubild fehlt: ${build.thumb}`);
    preview.hidden = true;
  }, { once: true });
  preview.setAttribute('src', sitePath(build.thumb));
  preview.setAttribute('alt', `Vorschaubild: ${build.title}`);
  preview.hidden = false;
}

// 1 = 1 Block pro Meter; 0.5 → „1:2“
function formatScale(scale) {
  return `1:${formatNumber(1 / scale)}`;
}

function renderFacts(panel, build) {
  // [Begriff, Wert, Zahl in Mono-Schrift?]
  const facts = [
    ['Größe (B × H × L)', build.size ? `${formatSize(build.size)} Blöcke` : null, true],
    ['Blöcke', Number.isInteger(build.blocks) ? formatNumber(build.blocks) : null, true],
    ['Schritte', Number.isInteger(build.steps) ? formatNumber(build.steps) : null, true],
    ['Schwierigkeit', build.difficulty ? `${difficultyLabel(build.difficulty)} (${build.difficulty} von 5)` : null, false],
    ['Herkunft', build.accuracy ? accuracyLabel(build.accuracy) : null, false],
    ['Im Spiel getestet', build.tested === true ? 'Ja' : build.tested === false ? 'Nein' : null, false],
    ['Maßstäbe', build.scales.length ? build.scales.map(formatScale).join(' · ') : null, true],
  ].filter(([, value]) => value);
  setChildren(panel,
    facts.length
      ? el('dl', { class: 'facts' }, facts.map(([term, value, numeric]) => el('div', null, el('dt', null, term), el('dd', { class: numeric ? 'mono' : null }, value))))
      : el('p', { class: 'muted' }, 'Zu diesem Bau sind noch keine Kennzahlen im Katalog.'),
    build.tags.length ? el('ul', { class: 'chip-list panel-tags', role: 'list', 'aria-label': 'Schlagwörter' }, build.tags.map((tag) => el('li', null, createChip(tag)))) : null,
  );
}
