// Meine Bauten (meine.html): eigene Bau-Dateien dauerhaft in diesem Browser – hinzufügen (Auswahl oder Drag & Drop,
// auch ZIP-Archive mit manifest.json), suchen, nach Kategorie filtern, öffnen (bau.html?meine=<id>), umbenennen,
// Kategorie ändern und löschen. Keine Netzanfragen für die Dateien.
// Container-IDs (stabil):
//   #mine-file          verstecktes Datei-Feld (Mehrfachauswahl), geöffnet über #mine-add oder den Leerzustand
//   #mine-bar           Suche #mine-filter-form mit #mine-query und #mine-category, Knopf #mine-add
//   #mine-status        Zustand beim Hinzufügen und Fehler des Speichers
//   #mine-count         Anzahl („3 Bauten“, „2 von 5 Bauten“)
//   #mine-list          Karten der Bauten (js/ui/mine/cards.js)
//   #mine-empty         Leerzustand bzw. „Nichts gefunden“
//   #mine-drop          Fläche beim Ziehen von Dateien über die Seite
// Für Klick-Tests: window.__minePage (ready, error, count, shown, lastAdd).
import { el, clear, requireElement } from './dom.js';
import { initPage, renderLoading, renderState, showToast, icon, formatCount, storageRemove, CATEGORIES } from './shared.js';
import { openMyBuilds, requestPersistence, myBuildProgressKey, MINE_ACCEPT } from '../data/my-builds.js';
import { filterMyBuilds, countText, FILTER_NONE } from './mine/model.js';
import { createMineCard } from './mine/cards.js';

const MAX_LISTED_SKIPS = 20;
const page = { ready: false, error: null, count: 0, shown: 0, lastAdd: null };
window.__minePage = page;

initPage();
const store = openMyBuilds();
const parts = {
  file: requireElement('mine-file'),
  bar: requireElement('mine-bar'),
  form: requireElement('mine-filter-form'),
  query: requireElement('mine-query'),
  category: requireElement('mine-category'),
  add: requireElement('mine-add'),
  status: requireElement('mine-status'),
  count: requireElement('mine-count'),
  list: requireElement('mine-list'),
  empty: requireElement('mine-empty'),
  drop: requireElement('mine-drop'),
};
let entries = [];
let busy = false;
let freshIds = new Set();

setupFilters();
setupAdding();
load();
// Zurück aus dem Browser-Cache (z. B. nach „Zu Meine Bauten“ auf einer anderen Seite): Liste frisch lesen
window.addEventListener('pageshow', (event) => {
  if (event.persisted && page.ready && !busy) load();
});

/* ---------------------------------------------------------------- Laden und Anzeigen */

async function load() {
  renderLoading(parts.status, { title: 'Meine Bauten werden geladen …', compact: true });
  try {
    entries = await store.list();
  } catch (error) {
    showStoreError(error);
    return;
  }
  clear(parts.status).removeAttribute('aria-busy');
  render();
  page.ready = true;
}

function showStoreError(error) {
  page.error = error?.message ?? String(error);
  if (error?.name !== 'MyBuildsError') console.error('[Block-Kompass] Meine Bauten:', error);
  parts.bar.hidden = true;
  parts.list.replaceChildren();
  parts.count.textContent = '';
  clear(parts.empty);
  renderState(parts.status, {
    kind: 'error',
    title: 'Meine Bauten nicht verfügbar',
    text: error?.name === 'MyBuildsError' ? error.message : 'Der Speicher im Browser ließ sich nicht lesen.',
    actions: [el('button', { class: 'btn btn--secondary', type: 'button', on: { click: () => window.location.reload() } }, icon('retry'), el('span', null, 'Erneut versuchen'))],
  });
}

function currentFilter() {
  return { query: parts.query.value, category: parts.category.value };
}

function render({ focus = null } = {}) {
  page.count = entries.length;
  if (entries.length === 0) {
    parts.bar.hidden = true;
    parts.list.replaceChildren();
    parts.count.textContent = '';
    page.shown = 0;
    renderState(parts.empty, {
      kind: 'empty',
      iconName: 'star',
      title: 'Noch keine Bauten',
      text: 'Füg Bau-Dateien (.schem, .litematic, .nbt), 3D-Modelle oder ein .zip hinzu.',
      actions: [el('button', { class: 'btn btn--primary', type: 'button', id: 'mine-empty-add', on: { click: openPicker } }, icon('plus'), el('span', null, 'Dateien hinzufügen'))],
    });
    return;
  }
  parts.bar.hidden = false;
  const shown = filterMyBuilds(entries, currentFilter());
  page.shown = shown.length;
  parts.count.textContent = countText(shown.length, entries.length);
  const cards = new Map();
  parts.list.replaceChildren(...shown.map((entry) => {
    const card = createMineCard(entry, { onRename, onCategory, onDelete });
    cards.set(entry.id, card);
    if (freshIds.has(entry.id)) card.element.classList.add('is-new');
    return el('li', null, card.element);
  }));
  if (shown.length === 0) {
    renderState(parts.empty, {
      kind: 'empty',
      title: 'Nichts gefunden',
      text: 'Kein Bau passt zur Suche.',
      headingLevel: 2,
      compact: true,
      actions: [el('button', { class: 'btn btn--secondary', type: 'button', on: { click: resetFilters } }, icon('retry'), el('span', null, 'Suche zurücksetzen'))],
    });
  } else {
    clear(parts.empty);
  }
  if (focus) cards.get(focus.id)?.focus(focus.key);
}

/* ---------------------------------------------------------------- Suche und Filter */

function setupFilters() {
  parts.category.replaceChildren(
    el('option', { value: '' }, 'Alle Kategorien'),
    el('option', { value: FILTER_NONE }, 'Ohne Kategorie'),
    ...CATEGORIES.map((category) => el('option', { value: category.slug }, category.title)));
  parts.category.value = '';
  parts.form.addEventListener('submit', (event) => event.preventDefault());
  parts.query.addEventListener('input', () => render());
  parts.category.addEventListener('change', () => render());
}

function resetFilters() {
  parts.query.value = '';
  parts.category.value = '';
  render();
  parts.query.focus();
}

/* ---------------------------------------------------------------- Bearbeiten */

function replaceEntry(next) {
  entries = entries.map((entry) => (entry.id === next.id ? next : entry));
}

async function onRename(entry, title) {
  const next = await store.rename(entry.id, title);
  replaceEntry(next);
  render({ focus: { id: next.id, key: 'rename' } });
  showToast({ kind: 'success', title: 'Umbenannt', text: next.title });
}

async function onCategory(entry, category) {
  const next = await store.setCategory(entry.id, category);
  replaceEntry(next);
  render({ focus: { id: next.id, key: 'category' } });
  showToast({ kind: 'success', title: 'Kategorie geändert', text: next.title });
}

async function onDelete(entry) {
  const shownBefore = filterMyBuilds(entries, currentFilter());
  const index = shownBefore.findIndex((item) => item.id === entry.id);
  await store.remove(entry.id);
  // Fortschritt (Schritt und Haken) gehört zum Bau und geht mit
  storageRemove(myBuildProgressKey(entry.id));
  entries = entries.filter((item) => item.id !== entry.id);
  const shownAfter = filterMyBuilds(entries, currentFilter());
  const neighbour = shownAfter[Math.min(index, shownAfter.length - 1)] ?? null;
  render({ focus: neighbour ? { id: neighbour.id, key: 'title' } : null });
  if (!neighbour) (entries.length ? parts.query : document.getElementById('mine-empty-add'))?.focus();
  showToast({ kind: 'success', title: 'Gelöscht', text: entry.title });
}

/* ---------------------------------------------------------------- Hinzufügen */

function openPicker() {
  if (busy) return;
  // Klick des Users: den Browser still um dauerhaften Speicher bitten
  requestPersistence();
  parts.file.click();
}

function setupAdding() {
  parts.file.setAttribute('accept', MINE_ACCEPT);
  parts.add.addEventListener('click', openPicker);
  parts.file.addEventListener('change', () => {
    const files = [...(parts.file.files ?? [])];
    // Gleiche Dateien noch einmal wählen soll wieder auslösen
    parts.file.value = '';
    if (files.length) addFiles(files);
  });
  const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
  let depth = 0;
  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth++;
    parts.drop.classList.add('is-active');
  });
  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
  });
  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) parts.drop.classList.remove('is-active');
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    parts.drop.classList.remove('is-active');
    if (busy || !page.ready) return;
    requestPersistence();
    addFiles([...event.dataTransfer.files]);
  });
}

function setBusy(value) {
  busy = value;
  parts.add.disabled = value;
  parts.add.classList.toggle('is-busy', value);
  document.getElementById('mine-empty-add')?.toggleAttribute('disabled', value);
}

async function addFiles(files) {
  if (busy) return;
  setBusy(true);
  renderLoading(parts.status, { title: 'Dateien werden gespeichert …', compact: true });
  let report;
  try {
    report = await store.addFiles(files, {
      onProgress: ({ index, total, name }) => renderLoading(parts.status, {
        title: 'Dateien werden gespeichert …',
        text: total > 1 ? `${index + 1} von ${total}: ${name}` : name,
        compact: true,
      }),
    });
  } catch (error) {
    console.error('[Block-Kompass] Hinzufügen fehlgeschlagen:', error);
    report = { added: [], skipped: [], notSaved: [], error: { message: 'Die Dateien ließen sich nicht speichern. Details stehen in der Browser-Konsole (F12).' } };
  }
  page.lastAdd = { added: report.added.length, skipped: report.skipped.length, notSaved: report.notSaved?.length ?? 0, error: report.error?.message ?? null };
  freshIds = new Set(report.added.map((entry) => entry.id));
  try {
    entries = await store.list();
  } catch (error) {
    setBusy(false);
    showStoreError(error);
    return;
  }
  // Neue Bauten sollen sichtbar sein, auch wenn gerade gefiltert wird
  const shown = new Set(filterMyBuilds(entries, currentFilter()).map((entry) => entry.id));
  if ([...freshIds].some((id) => !shown.has(id))) {
    parts.query.value = '';
    parts.category.value = '';
  }
  render();
  setBusy(false);
  showAddReport(report);
  if (report.added.length) parts.list.querySelector('.mine-card.is-new .mine-card__link')?.focus({ preventScroll: false });
  // Hervorhebung nur bis zum nächsten Neuzeichnen (Suche, Bearbeiten)
  freshIds = new Set();
}

function showAddReport({ added, skipped, notSaved = [], error }) {
  const addedText = added.length ? `${formatCount(added.length, 'Bau', 'Bauten')} hinzugefügt` : 'Nichts hinzugefügt';
  if (!error && skipped.length === 0 && added.length > 0) {
    clear(parts.status).removeAttribute('aria-busy');
    showToast({ kind: 'success', title: addedText, text: added.length === 1 ? added[0].title : '' });
    return;
  }
  const steps = skipped.slice(0, MAX_LISTED_SKIPS).map((item) => ({ text: `${item.name}: ${item.reason}` }));
  if (skipped.length > MAX_LISTED_SKIPS) steps.push({ text: `… und ${formatCount(skipped.length - MAX_LISTED_SKIPS, 'weitere Datei', 'weitere Dateien')}` });
  // Nach einem Abbruch (z. B. Speicher voll) den Grund nur einmal nennen, die Dateien in einer Zeile
  if (notSaved.length) {
    const names = notSaved.slice(0, MAX_LISTED_SKIPS).join(', ');
    const more = notSaved.length > MAX_LISTED_SKIPS ? ` … und ${formatCount(notSaved.length - MAX_LISTED_SKIPS, 'weitere Datei', 'weitere Dateien')}` : '';
    steps.push({ text: `Nicht gespeichert: ${names}${more}` });
  }
  renderState(parts.status, {
    kind: error ? 'error' : 'warning',
    title: addedText,
    text: error ? error.message : skipped.length === 0 ? 'Keine der Dateien enthielt einen Bau.' : skipped.length === 1 ? 'Diese Datei wurde übersprungen:' : 'Diese Dateien wurden übersprungen:',
    steps,
    headingLevel: 2,
    compact: true,
    actions: [el('button', { class: 'btn btn--sm btn--ghost', type: 'button', on: { click: hideReport } }, icon('close'), el('span', null, 'Ausblenden'))],
  });
}

function hideReport() {
  clear(parts.status);
  (parts.bar.hidden ? document.getElementById('mine-empty-add') : parts.add)?.focus();
}
