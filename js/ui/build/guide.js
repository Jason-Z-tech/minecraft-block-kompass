// Anleitung: Kapitel (Titel, Text, Tipps) mit ihren Schritten. Klick springt zum Schritt, der aktuelle
// Schritt ist markiert, Notizen (b.note) stehen beim Schritt. Hover/Fokus auf einem Schritt hebt ihn in 3D hervor.
import { el } from '../dom.js';
import { formatNumber, formatCount } from '../shared.js';
import { phaseNumber, notesByStep } from './step-model.js';

/** Kurzinfo eines Schritts: „24 Blöcke · y = 2“ (Ebenen-Schritt) bzw. „12 Blöcke“. */
export function stepMeta(step) {
  const count = formatCount(step.blockCount, 'Block', 'Blöcke');
  return Number.isInteger(step.layerY) ? `${count} · y = ${formatNumber(step.layerY)}` : count;
}

/** Koordinaten einer Notiz für Menschen: Ebene = y + 1. */
export function noteWhere(note) {
  return `x ${formatNumber(note.x)} · Ebene ${formatNumber(note.y + 1)} · z ${formatNumber(note.z)}`;
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
    const notes = notesByStep(result);
    let noteNumber = 0;
    const noteIndex = new Map();
    for (const note of result.notes ?? []) noteIndex.set(note, ++noteNumber);
    const chapters = result.phases.map((phase, phaseIndex) => {
      if (phase.steps.length === 0) return null;
      const steps = phase.steps.map((stepIndex) => {
        const step = result.steps[stepIndex];
        // Ebenen-Schritte ohne eigenen Text: Titel und Kurzinfo sagen schon alles
        const text = step.text;
        const stepNotes = notes.get(stepIndex) ?? [];
        const button = el('button', { class: 'bv-step', type: 'button', dataset: { step: stepIndex } },
          el('span', { class: 'bv-step__num' }, formatNumber(stepIndex + 1)),
          el('span', { class: 'bv-step__body' },
            el('span', { class: 'bv-step__title' }, step.title),
            el('span', { class: 'bv-step__meta' }, stepMeta(step)),
            text && text !== step.title ? el('span', { class: 'bv-step__text' }, text) : null,
            stepNotes.length ? el('span', { class: 'bv-step__notes' }, stepNotes.map((note) => el('span', { class: 'bv-note' },
              el('span', { class: 'bv-note__pin', 'aria-hidden': 'true' }, String(noteIndex.get(note))),
              el('span', null, note.text, el('span', { class: 'bv-note__where' }, ` (${noteWhere(note)})`))))) : null));
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
        phase.text ? el('p', { class: 'bv-chapter__text' }, phase.text) : null,
        phase.tips?.length ? el('ul', { class: 'bv-tips', 'aria-label': 'Tipps' }, phase.tips.map((tip) => el('li', null, tip))) : null,
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
