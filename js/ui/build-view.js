// Bau-Ansicht als wiederverwendbare Komponente (bau.html und „Selber erstellen“):
//   mountBuildView(container, { source, params, entry, progressKey, onReady, onError, onScaleChange })
//     → Promise<{ viewer, result, dispose() }>
// Baut in `container` die 3D-Bühne, den Schritt-Player und die Tabs Anleitung / Material / Ebenen / Infos.
// source/params wie viewer.load; entry = Katalog-Eintrag oder gleich aufgebautes Objekt (fehlende Felder
// werden weggelassen); progressKey = 'bk:progress:<id>[@<maßstab>]' oder null (dann wird nichts gespeichert).
// onError(error, handle): handle ist null, wenn schon der Viewer nicht starten konnte, sonst der Griff mit dispose().
import { el, clear } from './dom.js';
import { loadNames } from './data.js';
import { initTabs, renderLoading, renderInfo, icon, showToast } from './shared.js';
import { Viewer, ViewerError } from '../render/renderer.js';
import { setNames } from '../core/describe.js';
import { ProgressStore } from './build/progress.js';
import { shownStep, clampProgress } from './build/step-model.js';
import { viewEntry, progressKeyFor } from './build/entry.js';
import { Appearance } from './build/appearance.js';
import { Emitter, nextViewId } from './build/kit.js';
import { Stage } from './build/stage.js';
import { StepPlayer } from './build/step-player.js';
import { Guide } from './build/guide.js';
import { MaterialsPanel } from './build/materials.js';
import { LayerPlan } from './build/layer-plan.js';
import { InfoPanel } from './build/info.js';

const HIGHLIGHT_MS = 3000;
const TABS = [
  ['guide', 'Anleitung', 'book'],
  ['materials', 'Material', 'chest'],
  ['layers', 'Ebenen', 'layers'],
  ['info', 'Infos', 'info'],
];

// Namen (de_de.json) einmal je Seite laden; ohne sie zeigen Tooltips und Listen die IDs
let namesPromise = null;
function ensureNames() {
  if (!namesPromise) {
    namesPromise = loadNames().then(setNames).catch((error) => {
      console.warn('[Block-Kompass] Deutsche Blocknamen fehlen, es werden IDs gezeigt:', error);
      namesPromise = null;
    });
  }
  return namesPromise;
}

let appearancePromise = null;
function ensureAppearance() {
  if (!appearancePromise) {
    appearancePromise = Appearance.load().catch((error) => {
      console.warn('[Block-Kompass] Block-Icons nicht verfügbar:', error);
      appearancePromise = null;
      return null;
    });
  }
  return appearancePromise;
}

function placeholderPlayer() {
  return el('section', { class: 'player bv-player is-loading', 'aria-label': 'Schritt-Player', 'aria-busy': 'true' },
    el('div', { class: 'bv-xp', 'aria-hidden': 'true' }, el('span', { class: 'bv-xp__seg' })),
    el('div', { class: 'bv-player__now' },
      el('span', { class: 'skeleton skeleton--text', dataset: { width: 'short' } }),
      el('span', { class: 'skeleton skeleton--title' })),
    el('div', { class: 'player__controls bv-player__controls' },
      ...['prev', 'play', 'next'].map((name) => el('button', { class: ['btn', 'btn--icon', name === 'play' && 'btn--primary'], type: 'button', disabled: true },
        icon(name), el('span', { class: 'visually-hidden' }, { prev: 'Vorheriger Schritt', play: 'Abspielen', next: 'Nächster Schritt' }[name])))));
}

function buildTabs(ids) {
  const list = el('div', { class: 'tabs__list', role: 'tablist', 'aria-label': 'Bereiche' });
  const panels = {};
  const tabs = el('div', { class: 'tabs bv-tabs' }, list);
  for (const [key, label, iconName] of TABS) {
    const tabId = `${ids}-tab-${key}`, panelId = `${ids}-panel-${key}`;
    list.append(el('button', { class: 'tab', type: 'button', role: 'tab', id: tabId, 'aria-controls': panelId, 'aria-selected': key === 'guide' ? 'true' : 'false', tabindex: key === 'guide' ? null : -1, dataset: { tab: key } },
      icon(iconName), el('span', null, label)));
    panels[key] = el('div', { class: ['tabs__panel', 'bv-panel-scroll'], role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, tabindex: 0, hidden: key !== 'guide', dataset: { panel: key } });
    tabs.append(panels[key]);
  }
  return { element: el('section', { class: 'build-panels bv-panels', 'aria-label': 'Anleitung, Material, Ebenen und Infos' }, tabs), tabs, panels };
}

/**
 * Bau-Ansicht einhängen. Ergebnis erst, wenn der Bau geladen ist; bei Fehlern wird onError(error) gerufen,
 * der Fehlerzustand angezeigt und das Promise abgelehnt (error.code wie ViewerError, z. B. 'no-webgl2', 'data').
 */
export async function mountBuildView(container, { source, params = {}, entry = null, progressKey = null, onReady = null, onError = null, onScaleChange = null } = {}) {
  if (!container || typeof container.append !== 'function') throw new TypeError('mountBuildView braucht ein Container-Element.');
  if (!source || typeof source !== 'object') throw new TypeError('mountBuildView braucht eine Quelle (source wie viewer.load).');
  if (progressKey !== null && (typeof progressKey !== 'string' || !progressKey.startsWith('bk:progress:'))) {
    throw new TypeError('progressKey muss mit „bk:progress:“ beginnen oder null sein.');
  }
  const info = viewEntry(entry);
  const ids = nextViewId();
  const events = new Emitter();
  const stage = new Stage({ entry: info });
  const { element: panelsElement, tabs: tabsElement, panels } = buildTabs(ids);
  let playerElement = placeholderPlayer();
  container.classList.add('build-view');
  clear(container).append(stage.element, playerElement, panelsElement);
  let components = null;
  let plan = null;
  let guide = null;
  const tabs = initTabs(tabsElement, {
    onChange: (tabId) => {
      const key = tabId.slice(tabId.lastIndexOf('-') + 1);
      if (key === 'layers') plan?.activate();
      else plan?.deactivate();
      if (key === 'guide') guide?.revealCurrent();
    },
  });
  stage.showStatus({ state: 'loading', message: 'Starte die 3D-Ansicht …', progress: 0 });

  let disposed = false;
  let ctx = null;
  // Griff zum Aufräumen; onError bekommt ihn mit, weil das Promise bei Fehlern keinen liefert
  let handle = null;
  let scale = typeof params.scale === 'number' ? params.scale : null;
  let currentKey = progressKey;
  const offs = [];

  const fail = (error) => {
    if (disposed) return;
    // Fehler eines erneuten Versuchs zeigt fail() selbst an
    stage.showError(error, { onRetry: viewer ? () => { start().catch(() => {}); } : null });
    playerElement.classList.add('is-error');
    playerElement.removeAttribute('aria-busy');
    playerElement.querySelector('.bv-player__now')?.replaceChildren(el('p', { class: 'bv-player__title' }, 'Kein Bau geladen'));
    for (const key of ['guide', 'materials', 'layers', 'info']) {
      renderInfo(panels[key], { title: 'Nicht verfügbar', text: 'Ohne geladenen Bau gibt es hier nichts anzuzeigen.', compact: true, headingLevel: 0 });
    }
    if (typeof onError === 'function') {
      try {
        onError(error, handle);
      } catch (callbackError) {
        console.error('[Block-Kompass] Fehler in onError:', callbackError);
      }
    }
  };

  let viewer = null;
  try {
    viewer = new Viewer(stage.canvas, {
      overlayParent: stage.element,
      onStatus: (status) => {
        if (!ctx) stage.showStatus(status);
        else if (status.state === 'error') showToast({ kind: 'warning', title: '3D-Ansicht', text: status.message });
        else if (status.state === 'context-lost' || status.state === 'restoring' || status.state === 'ready') stage.showStatus(status);
      },
      onHover: (hit) => stage.onHover(hit),
      onPick: (hit) => stage.onPick(hit),
      onProgress: (p) => ctx?.onViewerProgress(p),
      onModeChange: (mode) => stage.onModeChange(mode),
    });
  } catch (error) {
    if (!(error instanceof ViewerError)) console.error('[Block-Kompass] 3D-Ansicht konnte nicht starten:', error);
    fail(error);
    throw error;
  }

  const teardown = () => {
    components?.forEach((component) => component.dispose());
    components = null;
    plan = null;
    guide = null;
    stage.detach();
    ctx?.dispose();
    ctx = null;
  };

  async function start() {
    teardown();
    for (const key of ['guide', 'materials', 'layers', 'info']) renderLoading(panels[key], { title: 'Wird vorbereitet …', compact: true });
    stage.clearError();
    stage.showStatus({ state: 'loading', message: 'Lade Spieldaten …', progress: 0 });
    const loadParams = scale === null ? { ...params } : { ...params, scale };
    let result;
    try {
      [result] = await Promise.all([viewer.load(source, loadParams), ensureNames()]);
    } catch (error) {
      if (error?.code === 'cancelled' || disposed) return null;
      fail(error);
      throw error;
    }
    if (disposed) return null;
    ctx = createContext({ ids, viewer, result, entry: info, scale, progressKey: currentKey, events, overlayRoot: container, changeScale });
    const player = new StepPlayer(ctx);
    ctx.player = player;
    playerElement.replaceWith(player.element);
    playerElement = player.element;
    guide = new Guide(ctx);
    const materials = new MaterialsPanel(ctx);
    plan = new LayerPlan(ctx);
    const infoPanel = new InfoPanel(ctx);
    components = [player, guide, materials, plan, infoPanel];
    panels.guide.replaceChildren(guide.element);
    panels.materials.replaceChildren(materials.element);
    panels.layers.replaceChildren(plan.element);
    panels.info.replaceChildren(infoPanel.element);
    stage.attach(ctx);
    if (!panels.layers.hidden) plan.activate();
    guide.revealCurrent();
    stage.showStatus({ state: 'ready' });
    return result;
  }

  async function changeScale(next) {
    if (next === scale) return;
    scale = next;
    if (progressKey !== null && info.id) currentKey = progressKeyFor(info.id, next);
    if (typeof onScaleChange === 'function') {
      try {
        onScaleChange(next);
      } catch (error) {
        console.error('[Block-Kompass] Fehler in onScaleChange:', error);
      }
    }
    try {
      await start();
      tabs.select(`${ids}-tab-info`);
    } catch (error) {
      console.error('[Block-Kompass] Maßstab konnte nicht geladen werden:', error);
    }
  }

  const flush = () => ctx?.progress.flush();
  window.addEventListener('pagehide', flush);
  offs.push(() => window.removeEventListener('pagehide', flush));

  handle = {
    viewer,
    get result() { return ctx?.result ?? null; },
    get context() { return ctx; },
    dispose() {
      if (disposed) return;
      disposed = true;
      teardown();
      for (const off of offs) off();
      events.clear();
      stage.dispose();
      viewer.dispose();
    },
  };
  const result = await start();
  if (!result) return handle;
  if (typeof onReady === 'function') {
    try {
      onReady(handle);
    } catch (error) {
      console.error('[Block-Kompass] Fehler in onReady:', error);
    }
  }
  return handle;
}

/** Gemeinsamer Zustand der Teile einer Bau-Ansicht (Fortschritt, Hervorhebung, Haken). */
function createContext({ ids, viewer, result, entry, scale, progressKey, events, overlayRoot, changeScale }) {
  const stepCount = result.steps.length;
  const progress = new ProgressStore(progressKey, { stepCount });
  let p = viewer.progress;
  let target = p;
  let touched = false;
  let preview = null;
  let freshUntil = 0;
  let highlightTimer = null;
  let lastShown = shownStep(p, stepCount);

  const ctx = {
    ids, viewer, result, entry, scale, events, progress, overlayRoot, stepCount, player: null,
    appearance: ensureAppearance(),
    get p() { return p; },
    get target() { return target; },
    get shown() { return shownStep(p, stepCount); },
    changeScale,

    setProgress(value, { animate = false } = {}) {
      touched = true;
      target = clampProgress(value, stepCount);
      viewer.setProgress(target, { animate });
    },

    goToStep(index, { animate = true } = {}) {
      ctx.player?.pause();
      ctx.setProgress(index + 1, { animate });
    },

    previewStep(index) {
      preview = Number.isInteger(index) ? index : null;
      updateHighlight();
    },

    setChecked(item, checked) {
      progress.setChecked(item, checked);
      events.emit('checked', item);
    },

    resetProgress() {
      progress.reset();
      touched = false;
      target = stepCount;
      viewer.setProgress(stepCount);
      events.emit('checked', null);
      showToast({ kind: 'success', title: 'Fortschritt zurückgesetzt', text: 'Schritt und Haken sind gelöscht.' });
    },

    // Der Viewer meldet jeden Fortschritt (auch während Animationen); das Ziel setzt nur setProgress
    onViewerProgress(value) {
      p = value;
      const shown = shownStep(p, stepCount);
      if (touched && progress.enabled) progress.setStep(p);
      events.emit('progress', p);
      if (shown !== lastShown) {
        lastShown = shown;
        freshUntil = performance.now() + HIGHLIGHT_MS;
        events.emit('step', shown);
        updateHighlight();
      }
    },

    dispose() {
      clearTimeout(highlightTimer);
      progress.dispose();
    },
  };

  // Goldene Hervorhebung: der Schritt unter dem Zeiger, sonst kurz der gerade gebaute Schritt
  function updateHighlight() {
    clearTimeout(highlightTimer);
    const shown = shownStep(p, stepCount);
    let index = preview;
    if (index === null && shown >= 0 && (performance.now() < freshUntil || ctx.player?.playing)) index = shown;
    if (viewer.highlightStep !== index) viewer.setHighlightStep(index);
    if (index !== null && preview === null) {
      highlightTimer = setTimeout(updateHighlight, Math.max(50, freshUntil - performance.now() + 20));
    }
  }

  // Gespeicherten Schritt wiederherstellen
  if (progress.step !== null && progress.step !== p) {
    viewer.setProgress(progress.step);
    p = viewer.progress;
    target = p;
    lastShown = shownStep(p, stepCount);
  }
  return ctx;
}
