// Selber erstellen (erstellen.html[?q=<text>], Reiter über den Adress-Anker „formen“ bzw. „import“) – Freitext,
// Formen-Generator und Datei-Import.
// Container-IDs (stabil):
//   #create-tabs                  Reiter: #create-tab-idee, #create-tab-formen, #create-tab-import
//   #create-panel-idee            Freitext: #create-form, #create-query, Beispiele #create-examples / #create-examples-list,
//                                 Lade-/Fehlerzustand #create-status, Ergebnis #create-results (#create-results-title, #create-results-body)
//   #create-panel-formen          Formen-Generator: #shape-generator-body (Form und Felder), #shape-summary-body (Kennzahlen,
//                                 Knöpfe), Vorschau #shape-preview (Bau-Komponente)
//   #create-panel-import          Import: #import-drop, #import-file, #import-body (Datei, Modell-Einstellungen),
//                                 #import-status, Bericht #import-report (#import-report-body), Ergebnis #import-result
// Für Klick-Tests: window.__createPage (ready, error, request, shape, imports, views { shape, import }).
import { el, clear, requireElement } from './dom.js';
import { loadCatalog, loadNames, loadBlockList } from './data.js';
import { onGameDataProgress } from '../data/game-data.js';
import { initPage, initTabs, renderLoading, renderError, renderState, nudge, icon } from './shared.js';
import { parseRequest } from '../create/text-parser.js';
import { ViewSlot } from './create/view-slot.js';
import { ShapeGenerator } from './create/shape-form.js';
import { Importer } from './create/importer.js';
import { renderRequestResult } from './create/idea.js';
import { CREATE_TABS, tabFromHash, requestFromSearch, createHref, pickExamples } from './create/model.js';

const page = { ready: false, error: null, request: null, shape: null, imports: 0, lastImport: null, views: { shape: null, import: null } };
window.__createPage = page;

initPage();
const tabsRoot = requireElement('create-tabs');
let currentTab = tabFromHash(window.location.hash) ?? 'idee';
const tabs = initTabs(tabsRoot, {
  selected: `create-tab-${currentTab}`,
  onChange: (tabId) => {
    currentTab = tabId.replace('create-tab-', '');
    const url = new URL(window.location.href);
    url.hash = currentTab === 'idee' ? '' : currentTab;
    if (url.href !== window.location.href) history.replaceState(history.state, '', url);
  },
});
window.addEventListener('hashchange', () => {
  const tab = tabFromHash(window.location.hash);
  if (tab && tab !== currentTab) tabs.select(`create-tab-${tab}`);
});

const shapeSlot = new ViewSlot(requireElement('shape-preview'));
const importSlot = new ViewSlot(requireElement('import-result'));
Object.defineProperty(page.views, 'shape', { get: () => shapeSlot.handle, enumerable: true });
Object.defineProperty(page.views, 'import', { get: () => importSlot.handle, enumerable: true });

const query = requestFromSearch(window.location.search);
const input = requireElement('create-query');
input.value = query.text;

let data = null;
let generator = null;
main();

function selectTab(key, { focus = false } = {}) {
  if (!CREATE_TABS.includes(key)) return;
  tabs.select(`create-tab-${key}`);
  const tab = requireElement(`create-tab-${key}`);
  tab.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (focus) tab.focus({ preventScroll: true });
}

/* ---------------------------------------------------------------- Daten laden */

async function main() {
  const status = requireElement('create-status');
  const shapeBody = requireElement('shape-generator-body');
  renderLoading(status, { title: 'Katalog und Blockdaten werden geladen …', compact: true });
  renderLoading(shapeBody, { title: 'Blockdaten werden geladen …', compact: true });
  // Erster Besuch online: Fortschritt der Spieldaten (Blocknamen und Blockliste) in beiden Ladeanzeigen
  const offProgress = onGameDataProgress((event) => {
    renderLoading(status, { title: 'Katalog und Blockdaten werden geladen …', text: event.text, compact: true });
    renderLoading(shapeBody, { title: 'Blockdaten werden geladen …', text: event.text, compact: true });
  });
  let results;
  try {
    results = await Promise.allSettled([loadCatalog(), loadNames(), loadBlockList()]);
  } finally {
    offProgress();
  }
  const [catalog, names, blocks] = results;
  data = {
    catalog: catalog.status === 'fulfilled' ? catalog.value : null,
    names: names.status === 'fulfilled' ? names.value : null,
    blocks: blocks.status === 'fulfilled' ? blocks.value : null,
  };
  const failure = [catalog, names, blocks].find((item) => item.status === 'rejected');
  if (failure) page.error = failure.reason?.message ?? String(failure.reason);

  setupIdea(catalog.status === 'rejected' ? catalog.reason : null);
  setupShapes(names.status === 'rejected' ? names.reason : blocks.status === 'rejected' ? blocks.reason : null);
  setupImport();
  page.ready = true;
}

/* ---------------------------------------------------------------- Freitext */

function setupIdea(catalogError) {
  const status = requireElement('create-status');
  const form = requireElement('create-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runRequest(input.value, { updateUrl: true });
  });
  if (catalogError) {
    renderError(status, catalogError, { onRetry: () => window.location.reload() });
    return;
  }
  clear(status).removeAttribute('aria-busy');
  renderExamples();
  if (query.text) runRequest(query.text, { updateUrl: false });
}

function renderExamples() {
  const examples = pickExamples(data.catalog);
  const list = requireElement('create-examples-list');
  list.replaceChildren(...examples.map((example) => el('li', null,
    el('button', { class: 'create-example', type: 'button', on: { click: () => {
      input.value = example.query;
      runRequest(example.query, { updateUrl: true });
    } } }, example.label))));
  requireElement('create-examples').hidden = examples.length === 0;
}

function runRequest(raw, { updateUrl }) {
  const status = requireElement('create-status');
  const results = requireElement('create-results');
  if (!data?.catalog) return;
  const result = parseRequest(raw, { catalog: data.catalog, names: data.names, blocks: data.blocks });
  page.request = result;
  if (!result.query) {
    results.hidden = true;
    clear(requireElement('create-results-body'));
    nudge(requireElement('create-form'));
    input.focus();
    renderState(status, { kind: 'info', title: 'Schreib, was du bauen möchtest', text: 'Zum Beispiel einen Bau aus dem Katalog oder eine Form mit Maßen.', headingLevel: 0, compact: true });
    return;
  }
  clear(status);
  if (updateUrl) {
    const url = new URL(createHref(result.query, currentTab), window.location.href);
    history.replaceState(history.state, '', url);
  }
  document.title = `„${result.query}“ – Selber erstellen – Block-Kompass`;
  const { title, nodes } = renderRequestResult(result, {
    names: data.names,
    actions: {
      onShape: (shape, params, { preview }) => openShape(shape, params, { preview }),
      onTab: (key) => selectTab(key, { focus: true }),
    },
  });
  requireElement('create-results-title').textContent = title;
  requireElement('create-results-body').replaceChildren(...nodes);
  results.hidden = false;
  // Formen gleich im Generator vorbefüllen
  if (result.kind === 'shape' && generator) generator.apply(result.shape, result.params);
}

/* ---------------------------------------------------------------- Formen */

function setupShapes(dataError) {
  const body = requireElement('shape-generator-body');
  const summary = requireElement('shape-summary-body');
  if (dataError) {
    renderError(body, dataError, { onRetry: () => window.location.reload(), headingLevel: 3 });
    renderState(summary, { kind: 'empty', title: 'Ohne Blockdaten keine Formen', text: 'Sobald die Spieldaten da sind, stellst du hier Maße und Block ein.', headingLevel: 0, compact: true });
    return;
  }
  generator = new ShapeGenerator({
    body, summary, slot: shapeSlot, names: data.names, blocks: data.blocks,
    onState: (state) => { page.shape = state; },
  });
  if (page.request?.kind === 'shape') generator.apply(page.request.shape, page.request.params);
}

function openShape(shape, params, { preview }) {
  if (!generator) {
    selectTab('formen', { focus: true });
    return;
  }
  generator.apply(shape, params);
  selectTab('formen', { focus: !preview });
  if (preview) {
    generator.showPreview();
    requireElement('shape-preview').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

/* ---------------------------------------------------------------- Import */

function setupImport() {
  const parts = {
    drop: requireElement('import-drop'),
    input: requireElement('import-file'),
    body: requireElement('import-body'),
    status: requireElement('import-status'),
    report: requireElement('import-report'),
    reportBody: requireElement('import-report-body'),
  };
  // Ohne names.json kann die Blockauswahl nur IDs zeigen – der Import selbst braucht sie nicht
  new Importer({
    parts, slot: importSlot, names: data.names, blocks: data.blocks,
    onResult: (outcome) => {
      page.imports += 1;
      page.lastImport = outcome.ok
        ? { ok: true, blockCount: outcome.result.blockCount, size: outcome.result.size, warnings: outcome.result.warnings, upload: outcome.result.upload }
        : { ok: false, error: outcome.error, code: outcome.code ?? null };
    },
  });
  if (!data.names) {
    parts.status.append(el('p', { class: 'field__hint' }, icon('info'), ' Deutsche Blocknamen fehlen – Listen zeigen die IDs.'));
  }
}
