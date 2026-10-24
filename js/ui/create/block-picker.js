// Block-Auswahl mit Suche (Combobox nach WAI-ARIA 1.2): Tippen sucht deutsche/englische Namen und IDs
// (findBlocks), Pfeiltasten wählen, Enter übernimmt, Esc schließt. Jede Zeile zeigt Icon, Namen und ID.
import { el } from '../dom.js';
import { findBlocks, blockDisplayName, blockExists } from '../../create/block-lookup.js';
import { fillBlockIcon } from './block-icons.js';

const LIMIT = 24;
let pickerCounter = 0;

// Vorschläge bei leerem Feld (nur, was es in blocks.json gibt)
const POPULAR = Object.freeze({
  full: ['stone_bricks', 'stone', 'cobblestone', 'oak_planks', 'spruce_planks', 'glass', 'white_concrete', 'quartz_block',
    'sandstone', 'bricks', 'deepslate_bricks', 'smooth_stone', 'polished_andesite', 'dark_oak_planks', 'mossy_stone_bricks', 'prismarine'],
  stairs: ['oak_stairs', 'spruce_stairs', 'dark_oak_stairs', 'stone_brick_stairs', 'cobblestone_stairs', 'quartz_stairs',
    'sandstone_stairs', 'brick_stairs', 'deepslate_brick_stairs', 'birch_stairs', 'polished_andesite_stairs', 'mossy_stone_brick_stairs'],
});

export class BlockPicker {
  #names;
  #blocks;
  #kind;
  #allowed;
  #optional;
  #emptyLabel;
  #value;
  #onChange;
  #options = [];
  #active = -1;
  #parts = {};
  #id;

  /**
   * names/blocks: names.json und blocks.json. kind: 'full' (volle Blöcke) | 'stairs' | 'any'.
   * allowed: optionale Menge erlaubter IDs (z. B. Blöcke mit Farbwert). optional + emptyLabel: Eintrag „keiner“ (Wert '').
   * labelId: ID des sichtbaren Labels; inputId: ID des Eingabefelds (für <label for>).
   */
  constructor({ names, blocks, kind = 'full', allowed = null, optional = false, emptyLabel = 'keiner', value = '', labelId = null, inputId = null, describedBy = null, onChange = null }) {
    this.#names = names;
    this.#blocks = blocks;
    this.#kind = kind;
    this.#allowed = allowed instanceof Set ? allowed : null;
    this.#optional = Boolean(optional);
    this.#emptyLabel = emptyLabel;
    this.#value = typeof value === 'string' ? value : '';
    this.#onChange = typeof onChange === 'function' ? onChange : null;
    this.#id = inputId ?? `block-picker-${++pickerCounter}`;
    this.element = this.#build({ labelId, describedBy });
    this.#showValue();
  }

  get value() { return this.#value; }
  get input() { return this.#parts.input; }

  /** Wert von außen setzen (ohne onChange). */
  setValue(id) {
    this.#value = typeof id === 'string' ? id : '';
    this.#showValue();
  }

  setInvalid(invalid) {
    if (invalid) this.#parts.input.setAttribute('aria-invalid', 'true');
    else this.#parts.input.removeAttribute('aria-invalid');
  }

  /** Erlaubte IDs nachträglich setzen (z. B. wenn die Blockfarben geladen sind). */
  setAllowed(allowed) {
    this.#allowed = allowed instanceof Set ? allowed : null;
  }

  #build({ labelId, describedBy }) {
    const listId = `${this.#id}-list`;
    const icon = el('img', { class: 'block-picker__icon', alt: '', width: 32, height: 32, hidden: true });
    const none = el('span', { class: 'block-picker__none', 'aria-hidden': 'true', hidden: true });
    const input = el('input', {
      class: 'field__input block-picker__input', id: this.#id, type: 'text', role: 'combobox', autocomplete: 'off', spellcheck: 'false',
      'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-labelledby': labelId, 'aria-describedby': describedBy,
      maxlength: 80, enterkeyhint: 'done',
    });
    const meta = el('span', { class: 'block-picker__id mono' });
    const list = el('ul', { class: 'block-picker__list', id: listId, role: 'listbox', 'aria-labelledby': labelId, hidden: true });
    const status = el('span', { class: 'visually-hidden', 'aria-live': 'polite' });
    Object.assign(this.#parts, { icon, none, input, meta, list, status });

    input.addEventListener('focus', () => {
      input.select();
      this.#open('');
    });
    input.addEventListener('input', () => this.#open(input.value));
    input.addEventListener('keydown', (event) => this.#onKey(event));
    input.addEventListener('blur', () => {
      // Klick in die Liste kommt über pointerdown vorher an; sonst: offene Liste schließen, Anzeige zurücksetzen
      this.#close();
      this.#showValue();
    });
    list.addEventListener('pointerdown', (event) => {
      const option = event.target.closest('[role="option"]');
      if (!option) return;
      event.preventDefault();
      this.#choose(Number(option.dataset.index));
    });
    return el('div', { class: 'block-picker' },
      el('div', { class: 'block-picker__field' }, icon, none, input),
      meta, list, status);
  }

  #label(id) {
    return id ? blockDisplayName(id, this.#names) : this.#emptyLabel;
  }

  #showValue() {
    const { input, meta, icon, none } = this.#parts;
    input.value = this.#label(this.#value);
    none.hidden = Boolean(this.#value);
    meta.textContent = this.#value ? `minecraft:${this.#value}` : '';
    fillBlockIcon(icon, this.#value, this.#blocks);
  }

  #fits(id) {
    if (this.#allowed && !this.#allowed.has(id)) return false;
    if (this.#kind === 'stairs') return id.endsWith('_stairs');
    return true;
  }

  #search(query) {
    const text = query.trim();
    if (!text || text === this.#label(this.#value)) {
      const popular = (this.#kind === 'stairs' ? POPULAR.stairs : POPULAR.full)
        .filter((id) => blockExists(id, this.#blocks) !== false && this.#fits(id));
      const list = this.#value && !popular.includes(this.#value) ? [this.#value, ...popular] : popular;
      return list.map((id) => ({ id, name: blockDisplayName(id, this.#names) }));
    }
    const found = findBlocks(text, { names: this.#names, blocks: this.#blocks, fullOnly: this.#kind === 'full', limit: this.#allowed || this.#kind === 'stairs' ? 100 : LIMIT });
    return found.filter((entry) => this.#fits(entry.id)).slice(0, LIMIT).map(({ id, name }) => ({ id, name }));
  }

  #open(query) {
    const results = this.#search(query);
    const options = this.#optional ? [{ id: '', name: this.#emptyLabel }, ...results] : results;
    this.#options = options;
    const { list, input, status } = this.#parts;
    list.replaceChildren(...options.map((option, index) => {
      const img = el('img', { class: 'block-picker__icon', alt: '', width: 32, height: 32, hidden: true });
      fillBlockIcon(img, option.id, this.#blocks);
      return el('li', {
        class: ['block-picker__option', !option.id && 'block-picker__option--empty'], role: 'option', id: `${this.#id}-opt-${index}`,
        'aria-selected': option.id === this.#value ? 'true' : 'false', dataset: { index: String(index), block: option.id },
      }, option.id ? img : el('span', { class: 'block-picker__none', 'aria-hidden': 'true' }),
      el('span', { class: 'block-picker__name' }, option.name),
      option.id ? el('span', { class: 'block-picker__option-id mono' }, option.id) : null);
    }));
    if (options.length === 0) {
      list.append(el('li', { class: 'block-picker__empty', role: 'presentation' }, 'Kein passender Block gefunden.'));
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    status.textContent = options.length ? `${options.length} Blöcke` : 'Kein passender Block gefunden.';
    const selected = options.findIndex((option) => option.id === this.#value);
    this.#setActive(query.trim() && results.length ? (this.#optional ? 1 : 0) : selected);
  }

  #close() {
    const { list, input } = this.#parts;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    this.#active = -1;
  }

  #setActive(index) {
    const items = [...this.#parts.list.querySelectorAll('[role="option"]')];
    this.#active = index >= 0 && index < items.length ? index : -1;
    items.forEach((item, i) => item.classList.toggle('is-active', i === this.#active));
    if (this.#active >= 0) {
      this.#parts.input.setAttribute('aria-activedescendant', items[this.#active].id);
      items[this.#active].scrollIntoView({ block: 'nearest' });
    } else {
      this.#parts.input.removeAttribute('aria-activedescendant');
    }
  }

  #onKey(event) {
    const open = !this.#parts.list.hidden;
    const count = this.#options.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        this.#open('');
        return;
      }
      if (count === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.#setActive(this.#active < 0 ? (step > 0 ? 0 : count - 1) : (this.#active + step + count) % count);
    } else if (event.key === 'Enter') {
      if (open && this.#active >= 0) {
        event.preventDefault();
        this.#choose(this.#active);
      } else if (open) {
        event.preventDefault();
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        this.#close();
        this.#showValue();
        this.#parts.input.select();
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      if (open && count > 0 && event.altKey) {
        event.preventDefault();
        this.#setActive(event.key === 'Home' ? 0 : count - 1);
      }
    }
  }

  #choose(index) {
    const option = this.#options[index];
    if (!option) return;
    const changed = option.id !== this.#value;
    this.#value = option.id;
    this.#close();
    this.#showValue();
    this.#parts.input.select();
    this.#parts.status.textContent = `Gewählt: ${this.#label(option.id)}`;
    if (changed && this.#onChange) this.#onChange(option.id);
  }
}
