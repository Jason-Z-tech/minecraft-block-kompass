// Testseite des Voxel-Imports (ARCHITEKTUR §12.3): Modell wählen → modelToVolume hier auf der Seite (Kennzahlen,
// Draufsicht, Blockliste) → dieselbe Datei mit denselben Einstellungen über die Upload-Quelle in den echten Viewer
// (Worker → js/create/import → modelToVolume). Der lokale Server liefert .stl/.obj/.glb/.vox nicht aus – die Datei
// kommt immer aus dem Datei-Feld (in Tests per page.setInputFiles). Eine .mtl wirkt nur in der Seiten-Umwandlung
// (die Upload-Quelle trägt eine Datei).
// Parameter: view=iso|top|front|side, ui=0 (nur die 3D-Ansicht). Fertig-Signal: window.__voxelTest.ready (oder .error),
// dazu loads (Zähler), page (Ergebnis der Seite) und viewer (BuildResult-Kennzahlen).

import { Viewer, VIEWS } from '../../js/render/renderer.js';
import { el, clear } from '../../js/ui/dom.js';
import { modelToVolume, formatFromFileName } from '../../js/create/voxelize/index.js';

const test = { ready: false, error: null, status: [], loads: 0, page: null, viewer: null };
window.__voxelTest = test;

const $ = (id) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} fehlt in voxelize.html.`);
  return node;
};

function showStatus({ state, message }) {
  test.status.push({ state, message });
  const box = $('status');
  clear(box);
  if (state === 'ready') return;
  const kind = state === 'error' ? 'state--error' : 'state--loading';
  box.append(el('div', { class: ['state', kind, 'state--centered'] }, el('p', null, message || state)));
}

async function loadBlockColors() {
  const response = await fetch('../../game-data/block-colors.json');
  if (!response.ok) throw new Error('game-data/block-colors.json fehlt – erzeuge sie mit: node scripts/build-block-colors.mjs');
  return response.json();
}

function readParams() {
  const params = { palette: $('palette').value, solid: $('solid').checked, upAxis: $('up').value };
  const height = Number($('height').value);
  if (!Number.isInteger(height) || height < 1 || height > 1024) throw new Error('Die Höhe muss eine ganze Zahl von 1 bis 1024 sein.');
  params.height = height;
  if (params.palette === 'einfarbig') params.block = $('block').value.trim();
  return params;
}

// Draufsicht: je Spalte (x, z) die Oberseiten-Farbe des obersten Blocks
function drawTopView(result, blockColors) {
  const [w, h, l] = result.size;
  const canvas = $('top-view');
  canvas.width = w;
  canvas.height = l;
  const scale = Math.max(1, Math.floor(256 / Math.max(w, l)));
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${l * scale}px`;
  canvas.style.imageRendering = 'pixelated';
  const context = canvas.getContext('2d');
  const image = context.createImageData(w, l);
  const colorOf = result.palette.map((state) => {
    const id = state.split('[')[0];
    return blockColors.blocks[id]?.top.rgb ?? [255, 0, 255];
  });
  for (let z = 0; z < l; z++) {
    for (let x = 0; x < w; x++) {
      for (let y = h - 1; y >= 0; y--) {
        const value = result.data[(y * l + z) * w + x];
        if (!value) continue;
        const o = (z * w + x) * 4;
        image.data.set([...colorOf[value], 255], o);
        break;
      }
    }
  }
  context.putImageData(image, 0, 0);
}

function showPageResult(name, result, blockColors) {
  const counts = new Map();
  for (const value of result.data) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  $('info').textContent = `${name} · ${result.size.join(' × ')} · ${result.stats.voxels.toLocaleString('de-DE')} Blöcke · `
    + `${result.stats.triangles.toLocaleString('de-DE')} Dreiecke · ${result.stats.ms} ms · ${result.palette.length - 1} Blockarten`;
  const list = $('materials');
  clear(list);
  for (const [value, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    list.append(el('li', { class: 'mono' }, `${count.toLocaleString('de-DE')} × ${result.palette[value]}`));
  }
  const warnings = $('warnings');
  clear(warnings);
  for (const warning of result.warnings) warnings.append(el('li', { class: 'muted' }, warning));
  drawTopView(result, blockColors);
}

async function convert(viewer, files, blockColors, view) {
  const modelFile = files.find((file) => formatFromFileName(file.name));
  if (!modelFile) throw new Error('Wähle eine Datei mit .stl, .obj, .glb, .gltf oder .vox.');
  const format = formatFromFileName(modelFile.name);
  const mtlFile = format === 'obj' ? files.find((file) => /\.mtl$/i.test(file.name)) : null;
  const params = readParams();
  if (format === 'vox' && $('native').checked) delete params.height;
  test.ready = false;
  test.error = null;
  const buffer = await modelFile.arrayBuffer();
  const mtl = mtlFile ? await mtlFile.arrayBuffer() : null;
  const pageResult = await modelToVolume(format, buffer, params, { blockColors, mtl });
  test.page = { size: pageResult.size, palette: pageResult.palette, voxels: pageResult.stats.voxels, warnings: pageResult.warnings, ms: pageResult.stats.ms };
  showPageResult(modelFile.name, pageResult, blockColors);
  const result = await viewer.load({ kind: 'upload', format, name: modelFile.name, data: buffer.slice(0), params });
  test.viewer = { blockCount: result.blockCount, size: result.size, steps: result.steps.length, warnings: result.warnings };
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
  const blockColors = await loadBlockColors();
  const viewer = new Viewer($('view'), { onStatus: showStatus });
  window.__viewer = viewer;
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => viewer.setView(button.dataset.view));

  const input = $('file');
  const button = $('convert');
  const run = () => {
    const files = [...(input.files ?? [])];
    if (files.length === 0) return;
    button.disabled = true;
    convert(viewer, files, blockColors, view)
      .catch((error) => {
        if (error?.code === 'cancelled') return;
        console.error('Voxel-Test:', error);
        test.error = error.message ?? String(error);
        test.loads++;
        $('info').textContent = test.error;
        clear($('warnings'));
      })
      .finally(() => {
        button.disabled = false;
      });
  };
  input.addEventListener('change', run);
  button.addEventListener('click', run);
  test.ready = true;
}

main().catch((error) => {
  if (error?.code === 'cancelled') return;
  console.error('Voxel-Test:', error);
  test.error = error.message ?? String(error);
  showStatus({ state: 'error', message: test.error });
});
