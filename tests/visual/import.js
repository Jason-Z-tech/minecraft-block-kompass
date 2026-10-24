// Testseite für den Datei-Import (ARCHITEKTUR §12.2) mit der echten 3D-Ansicht.
// Quelle: das Datei-Feld #file (in Tests per page.setInputFiles; der lokale Server liefert .schem/.litematic/.nbt nicht
// aus, wie auf der echten Seite kommt die Datei also immer vom Rechner). Parameter: view=iso|top|front|side, ui=0 (nur
// die 3D-Ansicht). Fertig-Signal: window.__importTest.ready (oder .error), dazu loads (Zähler), result und status.

import { Viewer, VIEWS } from '../../js/render/renderer.js';
import { el, clear } from '../../js/ui/dom.js';

const UPLOAD_EXTENSIONS = { schem: 'schem', schematic: 'schem', litematic: 'litematic', nbt: 'nbt', vox: 'vox', stl: 'stl', obj: 'obj', glb: 'glb', gltf: 'gltf' };
const test = { ready: false, error: null, status: [], result: null, loads: 0 };
window.__importTest = test;

const $ = (id) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} fehlt in import.html.`);
  return node;
};

function formatOf(name) {
  const match = /\.([a-z0-9]{2,10})$/i.exec(name);
  const ext = match ? match[1].toLowerCase() : '';
  return Object.hasOwn(UPLOAD_EXTENSIONS, ext) ? UPLOAD_EXTENSIONS[ext] : null;
}

function showStatus({ state, message }) {
  test.status.push({ state, message });
  const box = $('status');
  clear(box);
  if (state === 'ready') return;
  const kind = state === 'error' ? 'state--error' : 'state--loading';
  box.append(el('div', { class: ['state', kind, 'state--centered'] }, el('p', null, message || state)));
}

function showResult(result) {
  const upload = result.upload;
  $('info').textContent = `${upload.name} · ${upload.formatLabel} · ${result.size.join(' × ')} · ${result.blockCount.toLocaleString('de-DE')} Blöcke · `
    + `${result.phases.length} Kapitel · ${result.steps.length} Schritte · Palette ${upload.paletteSize}`;
  const list = $('warnings');
  clear(list);
  for (const warning of result.warnings) list.append(el('li', { class: 'muted' }, warning));
}

async function loadFile(viewer, name, buffer, view) {
  const format = formatOf(name);
  if (!format) throw new Error(`„${name}“ hat keine bekannte Endung.`);
  test.ready = false;
  test.error = null;
  const result = await viewer.load({ kind: 'upload', format, name, data: buffer });
  test.result = {
    blockCount: result.blockCount, size: result.size, phases: result.phases.map((p) => p.title), steps: result.steps.length,
    warnings: result.warnings, upload: result.upload, source: result.source,
  };
  showResult(result);
  viewer.setView(view, { animate: false });
  await viewer.idle();
  test.loads++;
  test.ready = true;
}

async function main() {
  const search = new URLSearchParams(location.search);
  const view = search.get('view') ?? 'iso';
  if (!VIEWS.includes(view)) throw new Error(`Parameter view: ${VIEWS.join(', ')} erwartet.`);
  const stage = $('stage');
  if (search.get('ui') === '0') {
    $('controls').hidden = true;
    Object.assign(stage.style, { position: 'fixed', inset: '0', height: '100vh', minHeight: '0' });
  } else {
    Object.assign(stage.style, { position: 'relative', top: 'auto', height: 'min(64vh, 800px)' });
    $('controls').style.paddingBlock = '16px 32px';
  }
  const viewer = new Viewer($('view'), { onStatus: showStatus });
  window.__viewer = viewer;
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => viewer.setView(button.dataset.view));

  const input = $('file');
  input.accept = Object.keys(UPLOAD_EXTENSIONS).map((ext) => `.${ext}`).join(',');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    file.arrayBuffer()
      .then((buffer) => loadFile(viewer, file.name, buffer, view))
      .catch((error) => {
        if (error?.code === 'cancelled') return;
        console.error('Import-Test:', error);
        test.error = error.message ?? String(error);
        test.loads++;
        $('info').textContent = test.error;
        clear($('warnings'));
      });
  });
  test.ready = true;
}

main().catch((error) => {
  if (error?.code === 'cancelled') return;
  console.error('Import-Test:', error);
  test.error = error.message ?? String(error);
  showStatus({ state: 'error', message: test.error });
});
