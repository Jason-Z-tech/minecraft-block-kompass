// Infos: Beschreibung, Herkunft, „nicht im Spiel getestet“, Quellen (nur https), Ersteller mit Link und Lizenz
// (credits), Kennzahlen, Maßstab-Auswahl (bei scales) und der eigene Fortschritt mit „Zurücksetzen“.
import { el, isSafeUrl } from '../dom.js';
import {
  formatNumber, formatSize, accuracyLabel, createAccuracyChip, createUntestedChip, createCategoryChip,
  createChip, findCategory, icon,
} from '../shared.js';
import { formatScale, variantFor, isHttpsUrl } from './entry.js';
import { phaseCount, shownStep } from './step-model.js';

/** Kennzahlen [Begriff, Wert, Mono?] – aus dem geladenen Bau, sonst aus dem Eintrag. */
export function buildFacts(entry, result, scale) {
  const variant = variantFor(entry, scale);
  const size = result?.size ?? variant.size;
  const blocks = result?.blockCount ?? variant.blocks;
  const steps = result ? result.steps.length : variant.steps;
  const phases = result ? phaseCount(result) : entry?.phases ?? null;
  return [
    ['Größe (B × H × L)', Array.isArray(size) ? `${formatSize(size)} Blöcke` : null, true],
    ['Blöcke', Number.isInteger(blocks) ? formatNumber(blocks) : null, true],
    ['Schritte', Number.isInteger(steps) ? formatNumber(steps) : null, true],
    ['Kapitel', Number.isInteger(phases) ? formatNumber(phases) : null, true],
    ['Maßstab', scale ? formatScale(scale) : null, true],
    ['Herkunft', entry?.accuracy ? accuracyLabel(entry.accuracy) : null, false],
    ['Im Spiel getestet', entry?.tested === true ? 'Ja' : entry?.tested === false ? 'Nein' : null, false],
  ].filter(([, value]) => value);
}

function externalLink(url, text) {
  if (!isHttpsUrl(url) || !isSafeUrl(url)) return el('span', null, text);
  return el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'bv-info__link' }, text, el('span', { class: 'visually-hidden' }, ' (öffnet in neuem Tab)'));
}

export class InfoPanel {
  #ctx;
  #root;
  #progressBox;
  #confirming = false;
  #offs = [];

  constructor(ctx) {
    this.#ctx = ctx;
    this.#progressBox = el('section', { class: 'bv-info__section bv-progress', 'aria-label': 'Dein Fortschritt' });
    this.#root = this.#build();
    this.#offs.push(ctx.progress.subscribe(() => this.#renderProgress()));
    this.#offs.push(ctx.events.on('step', () => this.#renderProgress()));
    this.#renderProgress();
  }

  get element() { return this.#root; }

  #build() {
    const { entry, result, scale } = this.#ctx;
    const chips = [
      entry.category && findCategory(entry.category) ? createCategoryChip(entry.category) : null,
      entry.accuracy && accuracyLabel(entry.accuracy) ? createAccuracyChip(entry.accuracy) : null,
      entry.tested === false ? createUntestedChip() : null,
    ].filter(Boolean);
    const facts = buildFacts(entry, result, scale);
    const sources = Array.isArray(entry.sources) ? entry.sources.filter((source) => isHttpsUrl(source?.url)) : [];
    const credits = entry.credits && entry.credits.author ? entry.credits : null;
    return el('div', { class: 'bv-info' },
      chips.length ? el('ul', { class: 'chip-list', role: 'list', 'aria-label': 'Einordnung' }, chips.map((chip) => el('li', null, chip))) : null,
      entry.description ? el('p', { class: 'bv-info__description' }, entry.description) : null,
      this.#scaleSection(),
      el('section', { class: 'bv-info__section' },
        el('h3', { class: 'bv-info__heading' }, 'Kennzahlen'),
        el('dl', { class: 'facts' }, facts.map(([term, value, mono]) => el('div', null, el('dt', null, term),
          el('dd', { class: mono ? 'mono' : null }, value))))),
      sources.length ? el('section', { class: 'bv-info__section' },
        el('h3', { class: 'bv-info__heading' }, 'Quellen'),
        el('ul', { class: 'bv-info__sources' }, sources.map((source) => el('li', null, externalLink(source.url, source.title || new URL(source.url).hostname))))) : null,
      credits ? el('section', { class: 'bv-info__section' },
        el('h3', { class: 'bv-info__heading' }, 'Ersteller'),
        el('p', { class: 'bv-info__credits' }, 'Von ', credits.url ? externalLink(credits.url, credits.author) : el('strong', null, credits.author),
          credits.license ? ' · Lizenz: ' : '',
          credits.license ? (credits.licenseUrl ? externalLink(credits.licenseUrl, credits.license) : credits.license) : '')) : null,
      Array.isArray(entry.tags) && entry.tags.length ? el('ul', { class: 'chip-list bv-info__tags', role: 'list', 'aria-label': 'Schlagwörter' }, entry.tags.map((tag) => el('li', null, createChip(tag)))) : null,
      this.#progressBox);
  }

  #scaleSection() {
    const { entry, scale, ids } = this.#ctx;
    const scales = Array.isArray(entry.scales) ? entry.scales : [];
    if (scales.length < 2) return null;
    const name = `${ids}-scale`;
    const options = scales.map((value) => {
      const id = `${name}-${String(value).replace('.', '-')}`;
      const variant = variantFor(entry, value);
      const input = el('input', { class: 'bv-segmented__input', type: 'radio', name, id, value: String(value), checked: value === scale });
      input.addEventListener('change', () => {
        if (input.checked) this.#ctx.changeScale(value);
      });
      return el('label', { class: 'bv-segmented__option bv-scale__option', for: id }, input,
        el('span', null, el('strong', { class: 'mono' }, formatScale(value)),
          Number.isInteger(variant.blocks) ? el('small', { class: 'mono' }, `${formatNumber(variant.blocks)} Blöcke`) : null));
    });
    return el('section', { class: 'bv-info__section' },
      el('h3', { class: 'bv-info__heading', id: `${name}-label` }, 'Maßstab'),
      el('div', { class: 'bv-segmented bv-scale', role: 'radiogroup', 'aria-labelledby': `${name}-label` }, options),
      el('p', { class: 'bv-info__hint' }, '1:1 heißt ein Block pro Meter. Jeder Maßstab merkt sich seinen eigenen Fortschritt.'));
  }

  #renderProgress() {
    // Während der Rückfrage nicht neu zeichnen (sonst würde sie erneut angesagt)
    if (this.#confirming) return;
    const { progress, result, p } = this.#ctx;
    const box = this.#progressBox;
    if (!progress.enabled) {
      box.replaceChildren(el('h3', { class: 'bv-info__heading' }, 'Dein Fortschritt'), el('p', { class: 'muted' }, 'Für diese Ansicht wird kein Fortschritt gespeichert.'));
      return;
    }
    const n = result.steps.length;
    const shown = shownStep(p, n);
    const lines = [
      ['Schritt', shown < 0 ? 'Start' : `${formatNumber(shown + 1)} von ${formatNumber(n)}`],
      ['Abgehakte Materialien', formatNumber(progress.checkedCount)],
      ['Zuletzt gespeichert', progress.updatedAt ? new Date(progress.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–'],
    ];
    const reset = el('button', { class: 'btn btn--sm btn--secondary', type: 'button', disabled: !progress.hasData }, icon('retry'), el('span', null, 'Fortschritt zurücksetzen'));
    const actions = el('div', { class: 'bv-progress__actions' }, reset);
    reset.addEventListener('click', () => {
      this.#confirming = true;
      this.#renderConfirm(actions, { focus: true });
    });
    box.replaceChildren(
      el('h3', { class: 'bv-info__heading' }, 'Dein Fortschritt'),
      el('dl', { class: 'facts' }, lines.map(([term, value]) => el('div', null, el('dt', null, term), el('dd', { class: 'mono' }, value)))),
      actions);
  }

  #renderConfirm(actions, { focus }) {
    const yes = el('button', { class: 'btn btn--sm btn--primary bv-progress__confirm', type: 'button' }, 'Ja, zurücksetzen');
    const no = el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, 'Abbrechen');
    yes.addEventListener('click', () => {
      this.#confirming = false;
      this.#ctx.resetProgress();
      // Der Knopf verschwindet: Fokus im Abschnitt halten
      this.#progressBox.setAttribute('tabindex', '-1');
      this.#progressBox.focus({ preventScroll: true });
    });
    no.addEventListener('click', () => {
      this.#confirming = false;
      this.#renderProgress();
      this.#progressBox.querySelector('button')?.focus();
    });
    actions.replaceChildren(el('p', { class: 'bv-progress__question', role: 'alert' }, 'Schritt und alle Haken für diesen Bau löschen?'), yes, no);
    if (focus) yes.focus();
  }

  dispose() {
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}
