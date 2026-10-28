// Anleitung: Kapitel (Nummer, Titel, Schrittzahl) mit ihren Schritten (Nummer, Blockzahl, Ebene). Klick springt
// zum Schritt, der aktuelle Schritt ist markiert. Hover/Fokus auf einem Schritt hebt ihn in 3D hervor.
import { el } from '../dom.js';
import { formatNumber, formatCount } from '../shared.js';
import { phaseNumber, stepMetaParts } from './step-model.js';

// Kurzinfo „24 Blöcke · Ebene 3 (y = 2)“; die Ebene bricht nur als Ganzes um (schmale Handys)
function stepMetaElement(step) {
  const [count, layer] = stepMetaParts(step);
  return el('span', { class: 'bv-step__meta' }, count, layer ? ' · ' : null, layer ? el('span', { class: 'bv-step__layer' }, layer) : null);
}

export class Guide {
  #ctx;
  #root;
  #buttons = [];
  #current = -2;
  #doneUntil = 0;
  #offs = [];

  constructor(ctx) {
    this.#ctx = ctx;
    this.#root = this.#build();
    this.#offs.push(ctx.events.on('step', () => this.#update()));
    this.#update();
  }

  get element() { return this.#root; }

  #build() {
    const { result } = this.#ctx;
    if (result.steps.length === 0) {
      return el('div', { class: 'bv-guide' }, el('p', { class: 'muted' }, 'Dieser Bau hat keine Schritte.'));
    }
    const chapters = result.phases.map((phase, phaseIndex) => {
      if (phase.steps.length === 0) return null;
      const steps = phase.steps.map((stepIndex) => {
        const button = el('button', { class: 'bv-step', type: 'button', dataset: { step: stepIndex } },
          el('span', { class: 'bv-step__num' }, el('span', { class: 'visually-hidden' }, 'Schritt '), formatNumber(stepIndex + 1)),
          stepMetaElement(result.steps[stepIndex]));
        button.addEventListener('click', () => this.#ctx.goToStep(stepIndex));
        button.addEventListener('pointerenter', () => this.#ctx.previewStep(stepIndex));
        button.addEventListener('pointerleave', () => this.#ctx.previewStep(null));
        button.addEventListener('focus', () => this.#ctx.previewStep(stepIndex));
        button.addEventListener('blur', () => this.#ctx.previewStep(null));
        this.#buttons[stepIndex] = button;
        return el('li', null, button);
      });
      return el('li', { class: 'bv-chapter', dataset: { phase: phaseIndex } },
        el('div', { class: 'bv-chapter__head' },
          el('span', { class: 'bv-chapter__num' }, `Kapitel ${formatNumber(phaseNumber(result, phaseIndex))}`),
          el('h3', { class: 'bv-chapter__title' }, phase.title),
          el('span', { class: 'bv-chapter__count' }, formatCount(phase.steps.length, 'Schritt', 'Schritte'))),
        el('ol', { class: 'bv-steps', role: 'list' }, steps));
    });
    return el('div', { class: 'bv-guide' }, el('ol', { class: 'bv-chapters', role: 'list' }, chapters));
  }

  #update() {
    const shown = this.#ctx.shown;
    if (shown === this.#current) return;
    const old = this.#buttons[this.#current];
    if (old) {
      old.classList.remove('is-current');
      old.removeAttribute('aria-current');
    }
    // „fertig“ = Schritte vor dem aktuellen; nur den geänderten Bereich anfassen
    const from = Math.min(this.#doneUntil, Math.max(0, shown));
    const to = Math.max(this.#doneUntil, Math.max(0, shown));
    for (let i = from; i < to; i++) this.#buttons[i]?.classList.toggle('is-done', i < shown);
    this.#doneUntil = Math.max(0, shown);
    this.#current = shown;
    const button = this.#buttons[shown];
    if (!button) return;
    button.classList.add('is-current');
    button.setAttribute('aria-current', 'step');
    this.#reveal(button);
  }

  // Den aktuellen Schritt in den sichtbaren Bereich der Liste holen – nur wenn die Liste selbst scrollt
  // (Desktop-Seitenleiste), damit die Seite auf dem Handy nicht springt.
  #reveal(button) {
    const scroller = this.#root.closest('.bv-panel-scroll');
    if (!scroller || scroller.closest('[hidden]') || scroller.scrollHeight <= scroller.clientHeight) return;
    const box = button.getBoundingClientRect();
    const view = scroller.getBoundingClientRect();
    if (box.top >= view.top + 8 && box.bottom <= view.bottom - 8) return;
    scroller.scrollTop += box.top - view.top - view.height / 3;
  }

  /** Nach dem Wechsel auf den Tab: aktuellen Schritt zeigen. */
  revealCurrent() {
    const button = this.#buttons[this.#current];
    if (button) this.#reveal(button);
  }

  dispose() {
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}
