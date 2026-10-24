// Schritt-Player: vor/zurück, Abspielen mit Tempo, Schieberegler über alle Schritte (Kommazahlen für
// flüssiges Aufploppen), XP-Leiste mit einem Segment je Kapitel, aktuelles Kapitel mit Schritttext,
// Tastatur (←/→, Pos1/Ende, Leertaste) und eine Live-Region für Schrittwechsel.
import { el } from '../dom.js';
import { icon, formatNumber, syncSlider } from '../shared.js';
import {
  shownStep, previousTarget, nextTarget, phaseSegments, segmentFill, phaseNumber, phaseCount,
  stepAnnouncement, stepInstruction, shortcutAllowed,
} from './step-model.js';
import { prefersReducedMotion } from './kit.js';

/** Tempo-Stufen: Dauer je Schritt beim Abspielen. */
export const SPEEDS = Object.freeze([
  Object.freeze({ label: '½×', name: 'langsam', stepMs: 2400 }),
  Object.freeze({ label: '1×', name: 'normal', stepMs: 1200 }),
  Object.freeze({ label: '2×', name: 'schnell', stepMs: 600 }),
  Object.freeze({ label: '4×', name: 'sehr schnell', stepMs: 300 }),
]);
const DEFAULT_SPEED = 1;
const SLIDER_RESOLUTION = 0.01;

/** Nächste Abspiel-Position nach dt Millisekunden (rein, testbar). Mit reduzierter Bewegung ganze Schritte. */
export function advancePlayback(p, dtMs, stepMs, stepCount, { reduced = false, carry = 0 } = {}) {
  if (reduced) {
    const total = carry + dtMs;
    if (total < stepMs) return { p, carry: total };
    return { p: Math.min(stepCount, Math.floor(p + 1e-9) + 1), carry: 0 };
  }
  return { p: Math.min(stepCount, p + dtMs / stepMs), carry: 0 };
}

/** Text für das Schritt-Label: „Schritt 5 / 18“, „Start“, „Fertig“. */
export function stepLabel(p, stepCount) {
  const shown = shownStep(p, stepCount);
  if (stepCount === 0) return { main: 'Keine Schritte', sub: '' };
  if (shown < 0) return { main: 'Start', sub: `${formatNumber(stepCount)} Schritte` };
  return { main: `Schritt ${formatNumber(shown + 1)}`, sub: p >= stepCount ? `von ${formatNumber(stepCount)} · fertig` : `von ${formatNumber(stepCount)}` };
}

export class StepPlayer {
  #ctx;
  #root;
  #parts = {};
  #segments = [];
  #speed = DEFAULT_SPEED;
  #playing = false;
  #raf = 0;
  #last = 0;
  #carry = 0;
  #announced = null;
  #offs = [];

  constructor(ctx) {
    this.#ctx = ctx;
    this.#root = this.#build();
    this.#offs.push(ctx.events.on('progress', () => this.#render()));
    this.#offs.push(ctx.events.on('step', () => this.#onStep()));
    const onKey = (event) => this.#onKey(event);
    document.addEventListener('keydown', onKey);
    this.#offs.push(() => document.removeEventListener('keydown', onKey));
    this.#render();
    this.#renderText();
  }

  get element() { return this.#root; }
  get playing() { return this.#playing; }

  #build() {
    const { result, ids } = this.#ctx;
    const n = result.steps.length;
    const xp = el('div', { class: 'bv-xp', 'aria-hidden': 'true' });
    this.#segments = phaseSegments(result).map((segment) => {
      const node = el('span', { class: 'bv-xp__seg', title: `${segment.title} · ${formatNumber(segment.count)} ${segment.count === 1 ? 'Schritt' : 'Schritte'}` });
      node.style.flexGrow = String(segment.count);
      xp.append(node);
      return { segment, node };
    });
    const level = el('span', { class: 'bv-xp__level' }, '0');
    xp.append(level);

    const chapter = el('p', { class: 'bv-player__chapter' });
    const title = el('p', { class: 'bv-player__title' });
    const text = el('p', { class: 'bv-player__text' });
    const prev = this.#iconButton('prev', 'Vorheriger Schritt', () => this.previous());
    const play = this.#iconButton('play', 'Abspielen', () => this.toggle(), { primary: true });
    play.setAttribute('aria-pressed', 'false');
    const next = this.#iconButton('next', 'Nächster Schritt', () => this.next());
    const speed = el('button', { class: 'btn btn--sm btn--ghost bv-player__speed', type: 'button', on: { click: () => this.#cycleSpeed() } });
    const labelMain = el('strong');
    const labelSub = el('span');
    const label = el('p', { class: 'player__label bv-player__label' }, labelMain, labelSub);
    const sliderId = `${ids}-slider`;
    const slider = el('input', {
      class: 'slider bv-player__slider', id: sliderId, type: 'range', min: 0, max: n, step: SLIDER_RESOLUTION, value: this.#ctx.p,
      'aria-label': 'Baufortschritt: Schritt wählen', disabled: n === 0,
    });
    slider.addEventListener('input', () => {
      this.pause();
      this.#ctx.setProgress(Number(slider.value));
    });
    slider.addEventListener('keydown', (event) => this.#onSliderKey(event));
    const live = el('p', { class: 'visually-hidden', 'aria-live': 'polite', 'aria-atomic': 'true' });
    for (const button of [prev, play, next, speed]) button.disabled = n === 0;
    Object.assign(this.#parts, { xp, level, chapter, title, text, prev, play, next, speed, labelMain, labelSub, slider, live });
    this.#renderSpeed();
    return el('section', { class: 'player bv-player', 'aria-label': 'Schritt-Player' },
      xp,
      el('div', { class: 'bv-player__now' }, chapter, title, text),
      el('div', { class: 'player__controls bv-player__controls' }, prev, play, next, speed, label),
      slider,
      live);
  }

  #iconButton(name, label, onClick, { primary = false } = {}) {
    return el('button', { class: ['btn', 'btn--icon', primary && 'btn--primary'], type: 'button', title: label, on: { click: onClick } },
      icon(name), el('span', { class: 'visually-hidden' }, label));
  }

  // ---------------------------------------------------------------- Bedienung

  // Ausgangspunkt ist das Ziel einer laufenden Animation, damit schnelles Klicken weiterzählt
  previous() {
    this.pause();
    const { target, stepCount } = this.#ctx;
    if (target <= 0) return;
    this.#ctx.setProgress(previousTarget(target, stepCount), { animate: true });
  }

  next() {
    this.pause();
    const { target, stepCount } = this.#ctx;
    if (target >= stepCount) return;
    this.#ctx.setProgress(nextTarget(target, stepCount), { animate: true });
  }

  first() {
    this.pause();
    this.#ctx.setProgress(0);
  }

  last() {
    this.pause();
    this.#ctx.setProgress(this.#ctx.stepCount);
  }

  toggle() {
    if (this.#playing) this.pause();
    else this.play();
  }

  play() {
    const { stepCount } = this.#ctx;
    if (this.#playing || stepCount === 0) return;
    // Am Ende von vorn beginnen
    if (this.#ctx.p >= stepCount) this.#ctx.setProgress(0);
    this.#playing = true;
    this.#last = 0;
    this.#carry = 0;
    this.#renderPlay();
    this.#raf = requestAnimationFrame(this.#tick);
  }

  pause() {
    if (!this.#playing) return;
    this.#playing = false;
    cancelAnimationFrame(this.#raf);
    this.#renderPlay();
    this.#announce(true);
  }

  #tick = (now) => {
    if (!this.#playing) return;
    const dt = this.#last ? Math.min(100, now - this.#last) : 0;
    this.#last = now;
    const { p, stepCount } = this.#ctx;
    const next = advancePlayback(p, dt, SPEEDS[this.#speed].stepMs, stepCount, { reduced: prefersReducedMotion(), carry: this.#carry });
    this.#carry = next.carry;
    if (next.p !== p) this.#ctx.setProgress(next.p);
    if (next.p >= stepCount) {
      this.pause();
      return;
    }
    this.#raf = requestAnimationFrame(this.#tick);
  };

  #cycleSpeed() {
    this.#speed = (this.#speed + 1) % SPEEDS.length;
    this.#renderSpeed();
  }

  #onSliderKey(event) {
    const { target: p, stepCount } = this.#ctx;
    const targets = {
      ArrowLeft: () => previousTarget(p, stepCount),
      ArrowDown: () => previousTarget(p, stepCount),
      ArrowRight: () => nextTarget(p, stepCount),
      ArrowUp: () => nextTarget(p, stepCount),
      PageDown: () => Math.max(0, Math.ceil(p - 1e-9) - 10),
      PageUp: () => Math.min(stepCount, Math.floor(p + 1e-9) + 10),
      Home: () => 0,
      End: () => stepCount,
    };
    if (!targets[event.key]) return;
    event.preventDefault();
    this.pause();
    this.#ctx.setProgress(targets[event.key]());
  }

  #onKey(event) {
    if (!this.#root.isConnected || this.#ctx.stepCount === 0) return;
    if (!shortcutAllowed(event, { walkMode: this.#ctx.viewer.mode === 'walk' })) return;
    const actions = { ArrowLeft: () => this.previous(), ArrowRight: () => this.next(), Home: () => this.first(), End: () => this.last(), ' ': () => this.toggle() };
    event.preventDefault();
    actions[event.key]();
  }

  // ---------------------------------------------------------------- Anzeige

  #render() {
    const { p, stepCount, shown } = this.#ctx;
    const { slider, level, labelMain, labelSub } = this.#parts;
    if (document.activeElement !== slider || this.#playing) slider.value = String(p);
    syncSlider(slider);
    slider.setAttribute('aria-valuetext', stepAnnouncement(this.#ctx.result, p));
    for (const { segment, node } of this.#segments) node.style.setProperty('--fill', String(segmentFill(segment, p)));
    const levelText = String(Math.max(0, shown + 1));
    if (level.textContent !== levelText) {
      level.textContent = levelText;
      level.classList.remove('is-bumped');
      void level.offsetWidth;
      level.classList.add('is-bumped');
    }
    const label = stepLabel(p, stepCount);
    labelMain.textContent = label.main;
    labelSub.textContent = label.sub;
    // aria-disabled statt disabled: der Fokus bleibt auf dem Knopf, wenn das Ende erreicht ist
    const { target } = this.#ctx;
    this.#parts.prev.setAttribute('aria-disabled', String(stepCount === 0 || target <= 0));
    this.#parts.next.setAttribute('aria-disabled', String(stepCount === 0 || target >= stepCount));
  }

  #onStep() {
    this.#renderText();
    if (!this.#playing) this.#announce(false);
  }

  #renderText() {
    const { result, shown, stepCount } = this.#ctx;
    const { chapter, title, text } = this.#parts;
    if (stepCount === 0) {
      chapter.textContent = '';
      title.textContent = 'Dieser Bau hat keine Schritte.';
      text.textContent = '';
      return;
    }
    if (shown < 0) {
      chapter.textContent = `${formatNumber(phaseCount(result))} Kapitel · ${formatNumber(stepCount)} ${stepCount === 1 ? 'Schritt' : 'Schritte'}`;
      title.textContent = 'Bereit zum Bauen';
      text.textContent = 'Drück auf Abspielen oder → für den ersten Schritt.';
      return;
    }
    const step = result.steps[shown];
    const phase = result.phases[step.phase];
    chapter.textContent = phase ? `Kapitel ${formatNumber(phaseNumber(result, step.phase))} · ${phase.title}` : '';
    title.textContent = step.title;
    text.textContent = stepInstruction(result, shown);
  }

  #renderPlay() {
    const { play } = this.#parts;
    const label = this.#playing ? 'Pause' : 'Abspielen';
    play.replaceChildren(icon(this.#playing ? 'pause' : 'play'), el('span', { class: 'visually-hidden' }, label));
    play.title = label;
    play.setAttribute('aria-pressed', String(this.#playing));
    this.#root.classList.toggle('is-playing', this.#playing);
  }

  #renderSpeed() {
    const speed = SPEEDS[this.#speed];
    this.#parts.speed.textContent = speed.label;
    this.#parts.speed.setAttribute('aria-label', `Tempo: ${speed.name} – klicken zum Wechseln`);
    this.#parts.speed.title = `Tempo: ${speed.name}`;
  }

  #announce(force) {
    const text = stepAnnouncement(this.#ctx.result, this.#ctx.p);
    if (!force && text === this.#announced) return;
    this.#announced = text;
    this.#parts.live.textContent = text;
  }

  /** Für die Mini-Steuerung im Vollbild. */
  get speedLabel() {
    return SPEEDS[this.#speed].label;
  }

  dispose() {
    this.pause();
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}
