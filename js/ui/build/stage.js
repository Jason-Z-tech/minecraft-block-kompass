// 3D-Bühne der Bau-Ansicht: Canvas für den Viewer, Vorschaubild, Lade- und Fehlerzustände, Werkzeugleiste
// (Ansichten, Schnitt, Geist, Laufen, Vollbild, Hilfe), Block-Tooltip beim Zeigen, Notiz-Markierungen und
// eine kleine Schritt-Steuerung im Vollbild.
import { el, clear, sitePath } from '../dom.js';
import { createState, renderState, formatNumber, icon } from '../shared.js';
import { ORBIT_FOV, WALK_FOV, splitProgress, isStepShown } from '../../render/renderer.js';
import { mat4 } from '../../render/mat.js';
import { raycastBlocks } from '../../render/picking.js';
import { toolButton, setPressed, FloatingTooltip, blockTooltipParts, positionText } from './kit.js';
import { stepLabel } from './step-player.js';

export const VIEW_LABELS = Object.freeze({ iso: 'Iso', top: 'Oben', front: 'Vorne', side: 'Seite' });
const VIEW_TITLES = { iso: 'Schräg von oben', top: 'Von oben', front: 'Von vorne (Süden)', side: 'Von der Seite (Osten)' };
const STATUS_STEPS = [
  ['loading', 'Daten'],
  ['building', 'Bauen'],
  ['textures', 'Texturen'],
  ['meshing', '3D-Modell'],
];

/**
 * Punkt (Welt) → Bildschirm: { x, y } in CSS-Pixeln der Fläche oder null (hinter der Kamera / außerhalb).
 * viewProj spaltenweise (wie mat.js).
 */
export function projectPoint(m, x, y, z, width, height) {
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (cw <= 1e-6) return null;
  const nx = cx / cw, ny = cy / cw;
  if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) return null;
  return { x: ((nx + 1) / 2) * width, y: ((1 - ny) / 2) * height };
}

/** Fehler des Viewers → Zustand für die Anzeige (Titel, Text, Schritte). */
export function viewerErrorState(error) {
  const code = error?.code ?? null;
  const message = error?.message ?? 'Unbekannter Fehler.';
  if (code === 'no-webgl2') {
    return { kind: 'error', title: '3D-Ansicht nicht möglich', text: message, steps: [] };
  }
  if (code === 'data') {
    return {
      kind: 'error', title: 'Spieldaten fehlen', text: message,
      steps: [{ text: 'Lade die Seite neu. Hilft das nicht, versuche es später noch einmal.' }],
    };
  }
  if (code === 'context-lost') return { kind: 'error', title: 'Grafikkarte zurückgesetzt', text: message, steps: [{ text: 'Lade die Seite neu.' }] };
  return { kind: 'error', title: 'Der Bau konnte nicht geladen werden', text: message, steps: [] };
}

export class Stage {
  #ctx = null;
  #root;
  #parts = {};
  #tooltip;
  #pointer = null;
  #notes = [];
  #noteRaf = 0;
  #lastMatrix = new Float32Array(16);
  #matrix = mat4.create();
  #projection = mat4.create();
  #view = mat4.create();
  #eye = [0, 0, 0];
  #offs = [];
  #walkHelpTimer = null;

  constructor({ entry = null } = {}) {
    this.#root = this.#build(entry);
    this.#tooltip = new FloatingTooltip(this.#root);
  }

  get element() { return this.#root; }
  get canvas() { return this.#parts.canvas; }

  #build(entry) {
    const canvas = el('canvas', { class: 'stage__canvas bv-stage__canvas', tabindex: 0 });
    const preview = el('img', { class: 'stage__preview bv-stage__preview', alt: '', hidden: true, decoding: 'async' });
    if (entry?.thumb) {
      preview.addEventListener('error', () => {
        console.warn(`[Block-Kompass] Vorschaubild fehlt: ${entry.thumb}`);
        preview.hidden = true;
      }, { once: true });
      preview.setAttribute('src', sitePath(entry.thumb));
      preview.hidden = false;
    }
    const notes = el('div', { class: 'bv-notes', 'aria-label': 'Markierungen' });
    const views = el('div', { class: 'bv-views', role: 'group', 'aria-label': 'Ansicht' });
    const tools = el('div', { class: 'bv-tools', role: 'toolbar', 'aria-label': '3D-Werkzeuge' });
    const clipPanel = el('div', { class: 'bv-clip', hidden: true });
    const help = el('div', { class: 'bv-help', hidden: true });
    const walkHelp = el('div', { class: 'bv-walkhelp', hidden: true, 'aria-live': 'polite' });
    const mini = el('div', { class: 'bv-mini', role: 'group', 'aria-label': 'Schritt-Steuerung' });
    const status = el('div', { class: 'stage__status bv-stage__status' });
    Object.assign(this.#parts, { canvas, preview, notes, views, tools, clipPanel, help, walkHelp, mini, status });
    return el('section', { class: 'stage bv-stage', 'aria-label': '3D-Ansicht' },
      canvas, preview, notes, views, tools, clipPanel, help, walkHelp, mini, status);
  }

  // ---------------------------------------------------------------- Zustände

  /** Ladefortschritt aus viewer.onStatus. */
  showStatus({ state, message, progress }) {
    if (state === 'ready') {
      clear(this.#parts.status);
      this.#parts.status.removeAttribute('aria-busy');
      return;
    }
    if (state === 'error') return;
    if (state === 'context-lost' || state === 'restoring') {
      renderState(this.#parts.status, { kind: 'loading', title: state === 'context-lost' ? 'Grafikkarte wurde zurückgesetzt …' : 'Stelle die 3D-Ansicht wieder her …', text: message, headingLevel: 0, compact: true, centered: true });
      return;
    }
    const index = STATUS_STEPS.findIndex(([key]) => key === state);
    const node = createState({ kind: 'loading', title: 'Bau wird geladen …', text: message || '', headingLevel: 0, compact: true, centered: true });
    const bar = el('div', { class: 'bv-load', role: 'progressbar', 'aria-label': 'Ladefortschritt', 'aria-valuemin': 0, 'aria-valuemax': 100 });
    const share = Math.max(0, Math.min(1, ((index < 0 ? 0 : index) + (typeof progress === 'number' ? progress : 0.3)) / STATUS_STEPS.length));
    bar.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    const fill = el('span', { class: 'bv-load__fill' });
    fill.style.setProperty('--share', String(share));
    bar.append(fill);
    const steps = el('ol', { class: 'bv-load__steps', 'aria-hidden': 'true' }, STATUS_STEPS.map(([, label], i) => el('li', { class: [i < index && 'is-done', i === index && 'is-active'] }, label)));
    node.append(bar, steps);
    this.#parts.status.setAttribute('aria-busy', 'true');
    this.#parts.status.replaceChildren(node);
  }

  /** Fehlerzustand über der Bühne (mit optionalem „Erneut versuchen“). */
  showError(error, { onRetry = null } = {}) {
    const spec = viewerErrorState(error);
    const actions = [];
    if (onRetry && error?.code !== 'no-webgl2') {
      actions.push(el('button', { class: 'btn btn--secondary', type: 'button', on: { click: onRetry } }, icon('retry'), el('span', null, 'Erneut versuchen')));
    }
    this.#parts.canvas.hidden = error?.code === 'no-webgl2';
    renderState(this.#parts.status, { ...spec, actions, headingLevel: 2, compact: true });
    this.#root.classList.add('is-error');
  }

  clearError() {
    this.#root.classList.remove('is-error');
    clear(this.#parts.status);
  }

  // ---------------------------------------------------------------- Nach dem Laden

  /** Werkzeuge, Tooltip und Markierungen mit dem geladenen Bau verbinden. */
  attach(ctx) {
    this.detach();
    this.#ctx = ctx;
    this.#parts.preview.hidden = true;
    this.#root.classList.remove('is-error');
    this.#buildViews();
    this.#buildTools();
    this.#buildHelp();
    this.#buildMini();
    this.#buildNotes();
    const canvas = this.#parts.canvas;
    const onMove = (event) => {
      this.#pointer = { x: event.clientX, y: event.clientY, type: event.pointerType };
      if (this.#tooltip.visible && event.pointerType === 'mouse') this.#tooltip.move(event.clientX, event.clientY);
    };
    const onLeave = () => {
      this.#pointer = null;
      if (this.#ctx?.viewer.mode !== 'walk') this.#tooltip.hide();
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    const onFullscreen = () => this.#syncFullscreen();
    document.addEventListener('fullscreenchange', onFullscreen);
    this.#offs.push(
      () => canvas.removeEventListener('pointermove', onMove),
      () => canvas.removeEventListener('pointerdown', onMove),
      () => canvas.removeEventListener('pointerleave', onLeave),
      () => document.removeEventListener('fullscreenchange', onFullscreen),
      ctx.events.on('progress', () => this.#renderMini()),
      ctx.events.on('step', () => this.#updateNotes(true)),
      ctx.events.on('clip', () => this.#updateNotes(true)),
    );
    this.#renderMini();
  }

  detach() {
    for (const off of this.#offs) off();
    this.#offs = [];
    cancelAnimationFrame(this.#noteRaf);
    this.#noteRaf = 0;
    clearTimeout(this.#walkHelpTimer);
    this.#tooltip.hide();
    for (const key of ['views', 'tools', 'clipPanel', 'help', 'walkHelp', 'mini', 'notes']) clear(this.#parts[key]);
    this.#parts.clipPanel.hidden = true;
    this.#parts.help.hidden = true;
    this.#parts.walkHelp.hidden = true;
    this.#ctx = null;
  }

  #buildViews() {
    const { viewer } = this.#ctx;
    for (const [view, label] of Object.entries(VIEW_LABELS)) {
      const button = toolButton(label, { title: VIEW_TITLES[view], className: 'bv-view' });
      button.dataset.view = view;
      button.addEventListener('click', () => viewer.setView(view));
      this.#parts.views.append(button);
    }
  }

  #buildTools() {
    const { viewer, result } = this.#ctx;
    const height = result.size[1];
    const clip = toolButton('Schnitt', { iconName: 'layers', pressed: false, title: 'Schnitt: nur bis zu einer Ebene zeigen' });
    clip.setAttribute('aria-expanded', 'false');
    const ghost = toolButton('Geist', { iconName: 'cube', pressed: viewer.ghost, title: 'Geist: kommende Blöcke durchsichtig zeigen' });
    const walk = toolButton('Laufen', { iconName: 'arrow-right', pressed: viewer.mode === 'walk', title: 'Laufen wie im Spiel (WASD, Maus)', className: 'bv-walk-toggle' });
    const help = toolButton('Steuerung', { iconName: 'info', title: 'Steuerung anzeigen', hideLabel: true, className: 'bv-tool--icon' });
    help.setAttribute('aria-expanded', 'false');
    const tools = [clip, ghost, walk, help];
    const canFullscreen = typeof this.#root.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
    let full = null;
    if (canFullscreen) {
      full = toolButton('Vollbild', { iconName: 'size', pressed: false, title: 'Vollbild', hideLabel: true, className: 'bv-tool--icon' });
      full.addEventListener('click', () => this.#toggleFullscreen());
      tools.push(full);
    }
    // Schnitt-Regler
    const clipId = `${this.#ctx.ids}-clip`;
    clip.setAttribute('aria-controls', clipId);
    help.setAttribute('aria-controls', `${this.#ctx.ids}-help`);
    const slider = el('input', { class: 'slider bv-clip__slider', id: `${clipId}-range`, type: 'range', min: 1, max: Math.max(1, height), step: 1, value: height });
    const value = el('output', { class: 'bv-clip__value', for: `${clipId}-range` });
    const off = el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, 'Aus');
    const applyClip = (layer) => {
      const active = layer < height;
      viewer.setClip(active ? { maxY: layer - 1 } : null);
      value.textContent = active ? `bis Ebene ${formatNumber(layer)} von ${formatNumber(height)}` : `alle ${formatNumber(height)} Ebenen`;
      slider.value = String(layer);
      slider.style.setProperty('--fill', `${height > 1 ? ((layer - 1) / (height - 1)) * 100 : 100}%`);
      setPressed(clip, active);
      this.#ctx.events.emit('clip', active ? layer - 1 : null);
    };
    slider.addEventListener('input', () => applyClip(Number(slider.value)));
    off.addEventListener('click', () => applyClip(height));
    this.#parts.clipPanel.id = clipId;
    this.#parts.clipPanel.replaceChildren(
      el('label', { class: 'bv-clip__label', for: `${clipId}-range` }, 'Schnitt'),
      slider, value, off);
    applyClip(viewer.clip && Number.isFinite(viewer.clip.maxY) ? viewer.clip.maxY + 1 : height);
    clip.addEventListener('click', () => {
      const open = this.#parts.clipPanel.hidden;
      this.#parts.clipPanel.hidden = !open;
      clip.setAttribute('aria-expanded', String(open));
      if (open) slider.focus();
    });
    ghost.addEventListener('click', () => {
      viewer.setGhost(!viewer.ghost);
      setPressed(ghost, viewer.ghost);
    });
    walk.addEventListener('click', () => {
      try {
        viewer.setMode(viewer.mode === 'walk' ? 'orbit' : 'walk');
      } catch (error) {
        console.error('[Block-Kompass] Laufen nicht möglich:', error);
      }
    });
    help.addEventListener('click', () => {
      const open = this.#parts.help.hidden;
      this.#parts.help.hidden = !open;
      help.setAttribute('aria-expanded', String(open));
    });
    this.#parts.tools.append(...tools);
    Object.assign(this.#parts, { clipButton: clip, ghostButton: ghost, walkButton: walk, helpButton: help, fullButton: full, clipSlider: slider });
  }

  #buildHelp() {
    const row = (keys, text) => el('li', null, el('span', { class: 'bv-help__keys' }, keys.map((key) => el('kbd', null, key))), el('span', null, text));
    this.#parts.help.id = `${this.#ctx.ids}-help`;
    const close = el('button', { class: 'btn btn--icon btn--sm btn--ghost bv-help__close', type: 'button', title: 'Schließen' }, icon('close'), el('span', { class: 'visually-hidden' }, 'Steuerung schließen'));
    close.addEventListener('click', () => {
      this.#parts.help.hidden = true;
      this.#parts.helpButton?.setAttribute('aria-expanded', 'false');
      this.#parts.helpButton?.focus();
    });
    this.#parts.help.replaceChildren(close,
      el('h3', { class: 'bv-help__title' }, 'Ansehen'),
      el('ul', { class: 'bv-help__list' },
        row(['Ziehen'], 'drehen'),
        row(['Rechts', 'Ziehen'], 'verschieben (Touch: zwei Finger)'),
        row(['Rad'], 'zoomen (Touch: zwei Finger auseinander)'),
        row(['←', '→', '↑', '↓'], 'drehen, wenn die 3D-Ansicht den Fokus hat'),
        row(['Klick'], 'springt zum Schritt des Blocks')),
      el('h3', { class: 'bv-help__title' }, 'Schritte'),
      el('ul', { class: 'bv-help__list' },
        row(['←', '→'], 'Schritt zurück / weiter'),
        row(['Pos1', 'Ende'], 'zum Anfang / zum fertigen Bau'),
        row(['Leertaste'], 'abspielen / anhalten')),
      el('h3', { class: 'bv-help__title' }, 'Laufen'),
      el('ul', { class: 'bv-help__list' },
        row(['W', 'A', 'S', 'D'], 'laufen'),
        row(['Maus'], 'umsehen (erst in die Ansicht klicken)'),
        row(['Leertaste'], 'springen, doppelt: fliegen'),
        row(['Shift'], 'schleichen / runter'),
        row(['Strg'], 'sprinten'),
        row(['Esc'], 'beenden')));
  }

  #buildMini() {
    const player = this.#ctx.player;
    const button = (name, label, onClick) => el('button', { class: 'btn btn--icon btn--sm', type: 'button', title: label, on: { click: onClick } }, icon(name), el('span', { class: 'visually-hidden' }, label));
    const label = el('span', { class: 'bv-mini__label' });
    this.#parts.mini.replaceChildren(
      button('prev', 'Vorheriger Schritt', () => player.previous()),
      button('play', 'Abspielen oder anhalten', () => player.toggle()),
      button('next', 'Nächster Schritt', () => player.next()),
      label);
    this.#parts.miniLabel = label;
  }

  #renderMini() {
    if (!this.#ctx || !this.#parts.miniLabel) return;
    const text = stepLabel(this.#ctx.p, this.#ctx.stepCount);
    this.#parts.miniLabel.textContent = `${text.main} ${text.sub}`.trim();
  }

  async #toggleFullscreen() {
    try {
      if (document.fullscreenElement === this.#root) await document.exitFullscreen();
      else await this.#root.requestFullscreen();
    } catch (error) {
      console.warn('[Block-Kompass] Vollbild nicht möglich:', error);
    }
  }

  #syncFullscreen() {
    const active = document.fullscreenElement === this.#root;
    this.#root.classList.toggle('is-fullscreen', active);
    if (this.#parts.fullButton) setPressed(this.#parts.fullButton, active);
  }

  /** Viewer-Modus gewechselt (z. B. Esc im Lauf-Modus). */
  onModeChange(mode) {
    const walking = mode === 'walk';
    this.#root.classList.toggle('is-walking', walking);
    if (this.#parts.walkButton) {
      setPressed(this.#parts.walkButton, walking);
      this.#parts.walkButton.querySelector('.bv-tool__label').textContent = walking ? 'Laufen beenden' : 'Laufen';
    }
    this.#tooltip.hide();
    clearTimeout(this.#walkHelpTimer);
    const help = this.#parts.walkHelp;
    if (!walking) {
      help.hidden = true;
      return;
    }
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    help.replaceChildren(el('p', null, touch
      ? 'Links bewegen, rechts umsehen. Knöpfe: springen, fliegen, hoch und runter.'
      : 'Klick in die Ansicht, dann: WASD laufen, Maus umsehen, Leertaste springen (doppelt: fliegen), Shift runter, Strg sprinten, Esc beendet.'));
    help.hidden = false;
    this.#walkHelpTimer = setTimeout(() => { help.hidden = true; }, 7000);
  }

  // ---------------------------------------------------------------- Tooltip

  onHover(hit) {
    if (!this.#ctx) return;
    if (!hit) {
      this.#tooltip.hide();
      return;
    }
    const { viewer, result } = this.#ctx;
    const step = result.steps[hit.step];
    const parts = blockTooltipParts(hit.state, { step: hit.step, stepTitle: step?.title ?? '', coords: positionText(hit.x, hit.y, hit.z) });
    if (viewer.mode === 'walk') {
      const box = this.#root.getBoundingClientRect();
      this.#tooltip.show(parts, box.left + box.width / 2 + 12, box.top + box.height / 2 + 12);
      return;
    }
    if (this.#pointer && this.#pointer.type === 'mouse') this.#tooltip.show(parts, this.#pointer.x, this.#pointer.y);
  }

  onPick(hit) {
    if (!this.#ctx || !hit || !Number.isInteger(hit.step) || hit.step < 0) return;
    const { result } = this.#ctx;
    if (this.#pointer && this.#pointer.type !== 'mouse') {
      const step = result.steps[hit.step];
      this.#tooltip.show(blockTooltipParts(hit.state, { step: hit.step, stepTitle: step?.title ?? '' }), this.#pointer.x, this.#pointer.y, { duration: 2500 });
    }
    this.#ctx.goToStep(hit.step);
  }

  // ---------------------------------------------------------------- Notizen

  #buildNotes() {
    const { result } = this.#ctx;
    this.#notes = (result.notes ?? []).map((note, index) => {
      const button = el('button', { class: 'bv-marker', type: 'button', title: note.text, dataset: { step: note.step ?? '' } },
        el('span', { class: 'bv-marker__pin', 'aria-hidden': 'true' }, String(index + 1)),
        el('span', { class: 'bv-marker__text' }, note.text));
      button.addEventListener('click', () => {
        if (Number.isInteger(note.step)) this.#ctx.goToStep(note.step);
      });
      this.#parts.notes.append(button);
      return { note, button };
    });
    if (this.#notes.length) this.#updateNotes(true);
  }

  #updateNotes(force = false) {
    if (!this.#ctx || this.#notes.length === 0) return;
    const shown = this.#ctx.shown;
    for (const { note, button } of this.#notes) {
      const visible = Number.isInteger(note.step) && note.step <= shown;
      button.hidden = !visible;
      button.classList.toggle('is-current', note.step === shown);
    }
    if (force) this.#lastMatrix.fill(NaN);
    if (!this.#noteRaf) this.#noteRaf = requestAnimationFrame(this.#positionNotes);
  }

  // Markierungen jedes Bild an die Kamera anpassen (nur wenn sie sich bewegt hat)
  #positionNotes = () => {
    this.#noteRaf = 0;
    const ctx = this.#ctx;
    if (!ctx || this.#notes.length === 0) return;
    this.#noteRaf = requestAnimationFrame(this.#positionNotes);
    const { viewer } = ctx;
    const canvas = this.#parts.canvas;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (width < 2 || height < 2) return;
    const walking = viewer.mode === 'walk';
    const controls = walking ? viewer.controls.walk : viewer.controls.orbit;
    if (!controls) return;
    controls.viewMatrix(this.#view);
    mat4.perspective(this.#projection, walking ? WALK_FOV : ORBIT_FOV, Math.max(1, canvas.width) / Math.max(1, canvas.height), 0.05, Infinity);
    mat4.multiply(this.#matrix, this.#projection, this.#view);
    let same = true;
    for (let i = 0; i < 16; i++) if (this.#matrix[i] !== this.#lastMatrix[i]) same = false;
    if (same) return;
    this.#lastMatrix.set(this.#matrix);
    const clip = viewer.clip;
    controls.eye(this.#eye);
    for (const { note, button } of this.#notes) {
      if (button.hidden) continue;
      const cut = clip && (note.y < clip.minY || note.y > clip.maxY);
      const point = cut ? null : projectPoint(this.#matrix, note.x + 0.5, note.y + 0.5, note.z + 0.5, width, height);
      button.classList.toggle('is-offscreen', !point);
      if (!point) continue;
      button.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
      button.classList.toggle('is-behind', this.#noteHidden(note, clip));
    }
  };

  // Liegt zwischen Kamera und Markierung ein gesetzter Block? Dann wird sie gedämpft gezeigt.
  #noteHidden(note, clip) {
    const { result, viewer, stepCount } = this.#ctx;
    const volume = result.volume;
    const target = [note.x + 0.5, note.y + 0.5, note.z + 0.5];
    const dir = [target[0] - this.#eye[0], target[1] - this.#eye[1], target[2] - this.#eye[2]];
    const distance = Math.hypot(dir[0], dir[1], dir[2]);
    if (distance < 1e-3) return false;
    for (let i = 0; i < 3; i++) dir[i] /= distance;
    const { cur, frac } = splitProgress(viewer.progress, stepCount);
    const hit = raycastBlocks(this.#eye, dir, distance - 0.5, (x, y, z) => {
      if (x === note.x && y === note.y && z === note.z) return false;
      if (clip && (y < clip.minY || y > clip.maxY)) return false;
      return volume.getIndex(x, y, z) !== 0 && isStepShown(volume.getStep(x, y, z), cur, frac);
    });
    return hit !== null;
  }

  /** Für Schnitt-Änderungen: Markierungen neu setzen. */
  refreshNotes() {
    this.#updateNotes(true);
  }

  dispose() {
    this.detach();
    this.#tooltip.hide();
  }
}
