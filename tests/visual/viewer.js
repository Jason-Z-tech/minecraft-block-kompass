// Testseite der 3D-Ansicht (ARCHITEKTUR §7.4, §10).
// Quelle: ?structure=<datei> | ?module=<pfad> | ?gallery=1 | ?gallery=<gruppe>[&page=n] | ?synthetic=<anzahl>
// (ohne Angabe: tests/fixtures/core/example-house.js). Weitere Parameter: view=iso|top|front|side,
// progress=<0 … 100 % der Schritte> oder step=<Schritt-Kommazahl>, clip=<Ebene y>, ghost=1, highlight=<Schritt>,
// mode=walk, ui=0 (nur die 3D-Ansicht, für Screenshots), bench=<Sekunden> (Kamera dreht, FPS werden gezählt).
// Fertig-Signal für Tests: window.__viewerTest.ready (oder .error); window.__viewer = Viewer-Instanz.

import { Viewer, VIEWS } from '../../js/render/renderer.js';
import { setNames, blockLabel } from '../../js/core/describe.js';
import { stateId } from '../../js/core/blockstate.js';
import { el, clear } from '../../js/ui/dom.js';
import { initSlider, syncSlider } from '../../js/ui/shared.js';

const test = { ready: false, error: null, params: null, status: [], picks: [], hover: null, stats: null, result: null, bench: null };
window.__viewerTest = test;

const $ = (id) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Element #${id} fehlt in viewer.html.`);
  return node;
};

function intParam(search, key, min, max) {
  if (!search.has(key)) return null;
  const raw = search.get(key);
  const value = Number(raw);
  if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Parameter ${key}: ganze Zahl von ${min} bis ${max} erwartet.`);
  return value;
}

function numberParam(search, key, min, max) {
  if (!search.has(key)) return null;
  const raw = search.get(key);
  const value = Number(raw);
  if (!/^-?\d+(\.\d+)?$/.test(raw) || value < min || value > max) throw new Error(`Parameter ${key}: Zahl von ${min} bis ${max} erwartet.`);
  return value;
}

// Adresse prüfen (Whitelist + Zahlengrenzen); die Quelle prüft der Worker zusätzlich.
function parseParams(search) {
  const sources = ['structure', 'module', 'gallery', 'synthetic'].filter((key) => search.has(key));
  if (sources.length > 1) throw new Error('Nur eine Quelle angeben: structure, module, gallery oder synthetic.');
  let source = { kind: 'module', path: 'tests/fixtures/core/example-house.js' };
  if (search.has('structure')) {
    const file = search.get('structure');
    if (!/^[a-z0-9_]{1,150}\.json$/.test(file)) throw new Error('Parameter structure: Dateiname aus game-data/structures/ erwartet.');
    source = { kind: 'structure', file };
  } else if (search.has('module')) {
    const path = search.get('module');
    if (!/^[a-z0-9\-/]{1,150}\.js$/.test(path)) throw new Error('Parameter module: Pfad wie js/builds/haeuser/x.js erwartet.');
    source = { kind: 'module', path };
  } else if (search.has('gallery')) {
    const group = search.get('gallery') === '1' ? 'all' : search.get('gallery');
    if (!/^[a-z]{1,20}$/.test(group)) throw new Error('Parameter gallery: 1 oder ein Gruppenname erwartet.');
    source = { kind: 'gallery', group, page: intParam(search, 'page', 0, 999) ?? 0 };
  } else if (search.has('synthetic')) {
    source = { kind: 'synthetic', count: intParam(search, 'synthetic', 1, 2_000_000) };
  }
  const view = search.get('view') ?? 'iso';
  if (!VIEWS.includes(view)) throw new Error(`Parameter view: ${VIEWS.join(', ')} erwartet.`);
  const mode = search.get('mode') ?? 'orbit';
  if (!['orbit', 'walk'].includes(mode)) throw new Error('Parameter mode: orbit oder walk erwartet.');
  const scale = numberParam(search, 'scale', 0.01, 8);
  return {
    source,
    params: scale === null ? {} : { scale },
    view,
    mode,
    progress: numberParam(search, 'progress', 0, 100),
    step: numberParam(search, 'step', 0, 65535),
    clip: intParam(search, 'clip', -16384, 16383),
    ghost: search.get('ghost') === '1',
    highlight: intParam(search, 'highlight', 0, 65534),
    ui: search.get('ui') !== '0',
    bench: numberParam(search, 'bench', 0.5, 60),
  };
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function summarize(result) {
  return {
    size: result.size,
    blockCount: result.blockCount,
    steps: result.steps.length,
    phases: result.phases.map((p) => p.title),
    warnings: result.warnings,
    gallery: result.gallery ?? null,
    meta: result.meta ? { id: result.meta.id, title: result.meta.title } : null,
    structure: result.structure ?? null,
  };
}

function describeHit(hit) {
  if (!hit) return 'Kein Block unter dem Zeiger.';
  const id = stateId(hit.state);
  return `${blockLabel(id)} · ${hit.state} · Schritt ${hit.step + 1} · (${hit.x}, ${hit.y}, ${hit.z}) · Seite ${hit.face ?? '–'}`;
}

function setPressed(button, on) {
  button.setAttribute('aria-pressed', String(on));
}

async function loadNames() {
  try {
    const response = await fetch('../../game-data/names.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setNames(await response.json());
  } catch (error) {
    console.warn('Testseite: deutsche Namen nicht geladen (game-data/names.json) – zeige nur IDs.', error.message);
  }
}

// Kamera dreht sich gleichmäßig; gezählt werden die Bilder, die der Viewer wirklich zeichnet.
async function runBenchmark(viewer, seconds) {
  const orbit = viewer.controls.orbit;
  const start = performance.now();
  const frames = [];
  let yaw = orbit.orbit.yaw;
  while (performance.now() - start < seconds * 1000) {
    yaw += 0.01;
    orbit.setView({ yaw }, { animate: false });
    await nextFrame();
    frames.push(performance.now());
  }
  const gaps = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
  const elapsed = (frames[frames.length - 1] - frames[0]) / 1000;
  return {
    seconds: Math.round(elapsed * 100) / 100,
    frames: frames.length,
    fps: Math.round(((frames.length - 1) / elapsed) * 10) / 10,
    medianFrameMs: Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10,
    p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10,
    viewerFps: viewer.stats.fps,
    frameCpuMs: viewer.stats.frameCpuMs,
  };
}

function initControls(viewer, options) {
  const progress = $('progress');
  const progressLabel = $('progress-label');
  const clipOn = $('clip-on');
  const clip = $('clip');
  const clipLabel = $('clip-label');
  const play = $('play');
  const modeButton = $('mode');
  const ghostButton = $('ghost');
  const steps = viewer.stepCount;
  const bounds = viewer.bounds;
  progress.max = String(steps);
  progress.value = String(viewer.progress);
  clip.min = String(bounds.min[1]);
  clip.max = String(bounds.max[1] - 1);
  clip.value = String(bounds.max[1] - 1);
  const showProgress = (p) => {
    progress.value = String(p);
    syncSlider(progress);
    const done = Math.min(steps, Math.floor(p));
    const step = viewer.result.steps[Math.min(steps - 1, done)];
    progressLabel.textContent = steps ? `${p.toFixed(2)} von ${steps} · ${done >= steps ? 'fertig' : step.title}` : 'keine Schritte';
  };
  options.onProgress = showProgress;
  showProgress(viewer.progress);
  initSlider(progress, { onInput: (value) => viewer.setProgress(value) });
  initSlider(clip, { onInput: (value) => {
    clipLabel.textContent = String(value + 1);
    if (clipOn.checked) viewer.setClip({ maxY: value });
  } });
  clipLabel.textContent = String(Number(clip.value) + 1);
  clipOn.addEventListener('change', () => {
    clip.disabled = !clipOn.checked;
    viewer.setClip(clipOn.checked ? { maxY: Number(clip.value) } : null);
  });
  $('prev').addEventListener('click', () => viewer.setProgress(Math.max(0, Math.ceil(viewer.progress) - 1), { animate: true }));
  $('next').addEventListener('click', () => viewer.setProgress(Math.min(steps, Math.floor(viewer.progress) + 1), { animate: true }));
  let playing = false;
  play.addEventListener('click', async () => {
    playing = !playing;
    setPressed(play, playing);
    play.textContent = playing ? 'Anhalten' : 'Abspielen';
    if (playing && viewer.progress >= steps) viewer.setProgress(0);
    while (playing && viewer.progress < steps) {
      viewer.setProgress(Math.floor(viewer.progress) + 1, { animate: true });
      await viewer.idle();
      // kurze Pause je Schritt (ohne Animation bei prefers-reduced-motion sonst zu schnell)
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    playing = false;
    setPressed(play, false);
    play.textContent = 'Abspielen';
  });
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => viewer.setView(button.dataset.view));
  }
  modeButton.addEventListener('click', () => viewer.setMode(viewer.mode === 'walk' ? 'orbit' : 'walk'));
  options.onModeChange = (mode) => setPressed(modeButton, mode === 'walk');
  ghostButton.addEventListener('click', () => {
    viewer.setGhost(!viewer.ghost);
    setPressed(ghostButton, viewer.ghost);
  });
}

function showStatus({ state, message }) {
  test.status.push({ state, message });
  const box = $('status');
  clear(box);
  if (state === 'ready') return;
  const kind = state === 'error' ? 'state--error' : 'state--loading';
  box.append(el('div', { class: ['state', kind, 'state--centered'] }, el('p', null, message || state)));
}

async function main() {
  let options;
  try {
    options = parseParams(new URLSearchParams(location.search));
  } catch (error) {
    test.error = error.message;
    showStatus({ state: 'error', message: error.message });
    return;
  }
  test.params = options;
  const stage = $('stage');
  if (!options.ui) {
    $('controls').hidden = true;
    Object.assign(stage.style, { position: 'fixed', inset: '0', height: '100vh', minHeight: '0' });
  } else {
    // .stage ist auf der Bau-Seite ab 1024 px „sticky“ (neben der Anleitung); hier steht die Leiste darunter
    Object.assign(stage.style, { position: 'relative', top: 'auto', height: 'min(72vh, 900px)' });
    $('controls').style.paddingBlock = '16px 32px';
  }
  await loadNames();
  const callbacks = {};
  const viewer = new Viewer($('view'), {
    onStatus: showStatus,
    onHover: (hit) => {
      test.hover = hit;
      $('hover').textContent = describeHit(hit);
    },
    onPick: (hit) => test.picks.push(hit),
    onProgress: (p) => callbacks.onProgress?.(p),
    onModeChange: (mode) => callbacks.onModeChange?.(mode),
  });
  window.__viewer = viewer;
  const result = await viewer.load(options.source, options.params);
  test.result = summarize(result);
  if (options.ui) initControls(viewer, callbacks);
  viewer.setView(options.view, { animate: false });
  if (options.step !== null) viewer.setProgress(options.step);
  else if (options.progress !== null) viewer.setProgress((viewer.stepCount * options.progress) / 100);
  if (options.clip !== null) viewer.setClip({ maxY: options.clip });
  if (options.ghost) viewer.setGhost(true);
  if (options.highlight !== null) viewer.setHighlightStep(options.highlight);
  if (options.mode === 'walk') viewer.setMode('walk');
  await viewer.idle();
  await nextFrame();
  if (options.bench) test.bench = await runBenchmark(viewer, options.bench);
  test.stats = viewer.stats;
  if (options.ui) $('stats').textContent = `${test.result.blockCount} Blöcke · ${test.stats.quads} Quads · ${test.stats.chunks} Chunks · Bauen ${test.stats.buildMs} ms · Texturen ${test.stats.textureMs} ms · Meshing ${test.stats.meshMs} ms · Laden gesamt ${test.stats.loadMs} ms`;
  test.ready = true;
}

main().catch((error) => {
  console.error('Testseite der 3D-Ansicht:', error);
  test.error = error.message ?? String(error);
  showStatus({ state: 'error', message: test.error });
});
