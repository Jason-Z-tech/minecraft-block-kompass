// Material: gesamt, fürs aktuelle Kapitel oder den aktuellen Schritt – als Inventar-Slots mit Block-Icon,
// deutschem Namen + ID, Menge in Shulkerkisten/Stacks, abhakbar (gespeichert), mit Suche und Summe.
import { el, clear, setChildren } from '../dom.js';
import { formatNumber, renderEmpty } from '../shared.js';
import { itemName } from '../../core/describe.js';
import { stackSize } from '../../core/materials.js';
import {
  materialsForScope, hintsByItem, extrasByItem, materialMatches, amountText, slotCount, summarizeMaterials,
} from './material-data.js';
import { phaseNumber } from './step-model.js';
import { statesByItem } from './appearance.js';

const SCOPE_LABELS = { total: 'Gesamt', phase: 'Kapitel', step: 'Schritt' };

/** „minecraft:stripped_oak_log“ mit Umbruch-Stellen nach dem Namensraum und nach jedem Unterstrich. */
export function idSegments(item) {
  return ['minecraft:', ...item.split(/(?<=_)/)];
}

function breakableId(item) {
  return idSegments(item).flatMap((part, index) => (index === 0 ? [part] : [el('wbr'), part]));
}

export class MaterialsPanel {
  #ctx;
  #root;
  #parts = {};
  #scope = 'total';
  #query = '';
  #hints;
  #extras;
  #stateFor;
  #icons = new Map();
  #offs = [];
  #renderedKey = null;

  constructor(ctx) {
    this.#ctx = ctx;
    const palette = ctx.result.volume.palette;
    this.#hints = hintsByItem(palette);
    this.#extras = extrasByItem(palette);
    this.#stateFor = statesByItem(palette);
    this.#root = this.#build();
    this.#offs.push(ctx.events.on('step', () => {
      if (this.#scope !== 'total') this.render();
    }));
    this.#offs.push(ctx.events.on('checked', () => this.render({ force: true })));
    this.render();
  }

  get element() { return this.#root; }

  #build() {
    const { ids } = this.#ctx;
    const name = `${ids}-scope`;
    const scopes = el('div', { class: 'bv-segmented', role: 'radiogroup', 'aria-label': 'Umfang der Materialliste' },
      Object.entries(SCOPE_LABELS).map(([value, label]) => {
        const input = el('input', { class: 'bv-segmented__input', type: 'radio', name, value, id: `${name}-${value}`, checked: value === this.#scope });
        input.addEventListener('change', () => {
          if (!input.checked) return;
          this.#scope = value;
          this.render();
        });
        return el('label', { class: 'bv-segmented__option', for: `${name}-${value}` }, input, el('span', null, label));
      }));
    const searchId = `${ids}-material-search`;
    const search = el('input', {
      class: 'field__input bv-materials__search', id: searchId, type: 'search', maxlength: 60, placeholder: 'Material suchen …',
      autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
    });
    search.addEventListener('input', () => {
      this.#query = search.value.slice(0, 60);
      this.render();
    });
    const scopeNote = el('p', { class: 'bv-materials__scope' });
    const summary = el('p', { class: 'bv-materials__summary', 'aria-live': 'polite' });
    const list = el('ul', { class: 'bv-materials__list', role: 'list' });
    const empty = el('div', { class: 'bv-materials__empty' });
    Object.assign(this.#parts, { search, scopeNote, summary, list, empty });
    return el('div', { class: 'bv-materials' },
      el('div', { class: 'bv-materials__bar' },
        scopes,
        el('div', { class: 'field bv-materials__field' },
          el('label', { class: 'visually-hidden', for: searchId }, 'Material suchen'),
          search)),
      scopeNote,
      summary,
      empty,
      list);
  }

  #scopeInfo() {
    const { result, shown } = this.#ctx;
    if (this.#scope === 'total') return { index: null, note: `Alles für den ganzen Bau (${formatNumber(result.blockCount)} Blöcke).` };
    const stepIndex = Math.max(0, shown);
    const step = result.steps[stepIndex];
    if (!step) return { index: null, note: 'Dieser Bau hat keine Schritte.' };
    if (this.#scope === 'step') {
      return { index: stepIndex, note: `Schritt ${formatNumber(stepIndex + 1)}: ${step.title}${shown < 0 ? ' (als Nächstes)' : ''}` };
    }
    const phase = result.phases[step.phase];
    return { index: step.phase, note: `Kapitel ${formatNumber(phaseNumber(result, step.phase))}: ${phase?.title ?? ''}${shown < 0 ? ' (als Nächstes)' : ''}` };
  }

  render({ force = false } = {}) {
    const { result, progress } = this.#ctx;
    const info = this.#scopeInfo();
    const key = `${this.#scope}|${info.index}|${this.#query}`;
    if (!force && key === this.#renderedKey) return;
    this.#renderedKey = key;
    const all = this.#scope === 'total' ? result.materials : materialsForScope(result, this.#scope, info.index);
    const list = all.filter(([item]) => materialMatches(item, itemName(item), this.#query));
    const sum = summarizeMaterials(list, (item) => progress.isChecked(item));
    this.#parts.scopeNote.textContent = info.note;
    setChildren(this.#parts.summary,
      el('span', null, el('strong', { class: 'mono' }, formatNumber(sum.kinds)), sum.kinds === 1 ? ' Sorte' : ' Sorten'),
      el('span', null, el('strong', { class: 'mono' }, formatNumber(sum.total)), ' Stück'),
      el('span', null, el('strong', { class: 'mono' }, formatNumber(sum.doneKinds)), ' abgehakt'),
      sum.doneKinds ? el('span', null, 'noch ', el('strong', { class: 'mono' }, formatNumber(sum.remaining))) : null);
    const target = clear(this.#parts.list);
    const empty = clear(this.#parts.empty);
    if (all.length === 0) {
      renderEmpty(empty, { title: 'Kein Material nötig', text: 'In diesem Abschnitt wird nichts gesetzt.', compact: true, headingLevel: 0 });
      return;
    }
    if (list.length === 0) {
      const reset = el('button', { class: 'btn btn--sm btn--secondary', type: 'button' }, 'Suche löschen');
      reset.addEventListener('click', () => {
        this.#parts.search.value = '';
        this.#query = '';
        this.render();
        this.#parts.search.focus();
      });
      renderEmpty(empty, { title: 'Kein Treffer', text: `Kein Material passt zu „${this.#query.trim()}“.`, compact: true, headingLevel: 0, actions: [reset] });
      return;
    }
    target.append(...list.map(([item, count]) => el('li', null, this.#row(item, count))));
  }

  #row(item, count) {
    const checked = this.#ctx.progress.isChecked(item);
    const iconImg = el('img', { class: 'slot__icon', alt: '', width: 32, height: 32, decoding: 'async' });
    this.#loadIcon(item, iconImg);
    const hints = [...(this.#hints.get(item) ?? [])];
    const extraFor = [...(this.#extras.get(item) ?? [])];
    const name = itemName(item);
    const button = el('button', {
      class: ['bv-material', checked && 'is-done'], type: 'button', 'aria-pressed': String(checked),
      dataset: { item },
    },
    el('span', { class: ['slot', 'bv-material__slot', checked && 'is-done'], 'aria-hidden': 'true' },
      iconImg, el('span', { class: 'slot__count' }, slotCount(count))),
    el('span', { class: 'bv-material__body' },
      el('span', { class: 'bv-material__name' }, name),
      el('span', { class: 'bv-material__id' }, ...breakableId(item)),
      el('span', { class: 'bv-material__amount' }, amountText(item, count),
        stackSize(item) !== 64 ? el('span', { class: 'bv-material__stack' }, ` · Stapel ${stackSize(item)}`) : null),
      hints.length ? el('span', { class: 'bv-material__hint' }, hints.join(' · ')) : null,
      extraFor.length ? el('span', { class: 'bv-material__hint' }, `Auch für: ${extraFor.map((base) => itemName(base)).join(', ')}`) : null),
    el('span', { class: 'bv-material__check', 'aria-hidden': 'true' }),
    el('span', { class: 'visually-hidden' }, checked ? ' – abgehakt' : ' – noch offen'));
    button.addEventListener('click', () => {
      this.#ctx.setChecked(item, !this.#ctx.progress.isChecked(item));
    });
    return button;
  }

  #loadIcon(item, img) {
    const cached = this.#icons.get(item);
    if (cached) {
      img.setAttribute('src', cached);
      return;
    }
    img.classList.add('is-loading');
    this.#ctx.appearance
      .then((appearance) => (appearance ? appearance.iconUrl(item, this.#stateFor.get(item) ?? null, 64) : null))
      .then((url) => {
        img.classList.remove('is-loading');
        if (!url) {
          img.classList.add('is-missing');
          return;
        }
        this.#icons.set(item, url);
        img.setAttribute('src', url);
      })
      .catch((error) => {
        img.classList.remove('is-loading');
        img.classList.add('is-missing');
        console.warn(`[Block-Kompass] Icon für „${item}“ fehlt:`, error);
      });
  }

  dispose() {
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}
