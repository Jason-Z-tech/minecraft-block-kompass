// Karte eines eigenen Baus auf meine.html: Titel (Link zur Bau-Seite), Format · Größe · Datum, Kategorie-Chip und die
// Aktionen Öffnen, Umbenennen, Kategorie und Löschen (mit Rückfrage). Alle Texte als Textknoten (el()).
import { el } from '../dom.js';
import { icon, createCategoryChip, findCategory, CATEGORIES } from '../shared.js';
import { MODEL_FORMATS } from '../../create/import/index.js';
import { myBuildHref } from '../../data/my-builds.js';
import { cardMeta } from './model.js';

let cardCounter = 0;

/** Auswahlliste der Kategorien („Ohne Kategorie“ + die sieben) */
export function categorySelect({ id, value = null, extra = [] }) {
  const select = el('select', { class: 'field__input', id },
    extra.map(([optionValue, label]) => el('option', { value: optionValue }, label)),
    el('option', { value: '' }, 'Ohne Kategorie'),
    CATEGORIES.map((category) => el('option', { value: category.slug }, category.title)));
  select.value = value ?? '';
  return el('span', { class: 'select' }, select);
}

/**
 * Baut eine Karte. actions: { onRename(entry, title), onCategory(entry, category), onDelete(entry) } – jeweils
 * Promise; bei Erfolg zeichnet die Seite die Karte neu, bei Fehlern bleibt die Bearbeitung offen.
 */
export function createMineCard(entry, actions) {
  const uid = `mine-card-${++cardCounter}`;
  const category = findCategory(entry.category);
  const card = el('article', { class: 'mine-card', dataset: { id: entry.id, category: category?.slug ?? null }, 'aria-labelledby': `${uid}-title` });
  const title = el('h2', { class: 'mine-card__title', id: `${uid}-title` },
    el('a', { class: 'mine-card__link', href: myBuildHref(entry.id) }, entry.title));
  const head = el('div', { class: 'mine-card__head' },
    el('span', { class: 'mine-card__icon', 'aria-hidden': 'true' }, icon(MODEL_FORMATS.includes(entry.format) ? 'cube' : 'layers', { size: 32 })),
    el('div', { class: 'mine-card__text' },
      title,
      el('p', { class: 'mine-card__meta mono' }, cardMeta(entry))));
  const chips = category ? el('ul', { class: 'chip-list mine-card__chips', role: 'list' }, el('li', null, createCategoryChip(category.slug))) : null;
  const zone = el('div', { class: 'mine-card__zone' });
  card.append(...[head, chips, zone].filter(Boolean));

  const showActions = (focusKey = null) => {
    const buttons = {
      rename: el('button', { class: 'btn btn--sm btn--ghost', type: 'button', dataset: { action: 'rename' } }, el('span', null, 'Umbenennen')),
      category: el('button', { class: 'btn btn--sm btn--ghost', type: 'button', dataset: { action: 'category' } }, el('span', null, 'Kategorie')),
      delete: el('button', { class: 'btn btn--sm btn--ghost mine-card__delete', type: 'button', dataset: { action: 'delete' } }, icon('close'), el('span', null, 'Löschen')),
    };
    buttons.rename.addEventListener('click', showRename);
    buttons.category.addEventListener('click', showCategory);
    buttons.delete.addEventListener('click', showDelete);
    zone.replaceChildren(el('div', { class: 'mine-card__actions' },
      el('a', { class: 'btn btn--sm btn--primary', href: myBuildHref(entry.id), dataset: { action: 'open' } }, icon('arrow-right'), el('span', null, 'Öffnen')),
      Object.values(buttons)));
    if (focusKey) buttons[focusKey]?.focus();
  };

  // Formular in der Karte (Umbenennen, Kategorie) mit Speichern/Abbrechen
  const editForm = ({ key, field, read, save }) => {
    const error = el('p', { class: 'field__error', role: 'alert', hidden: true });
    const submit = el('button', { class: 'btn btn--sm btn--primary', type: 'submit' }, icon('check'), el('span', null, 'Speichern'));
    const cancel = el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, el('span', null, 'Abbrechen'));
    const form = el('form', { class: 'mine-card__form', novalidate: true, dataset: { mode: key } }, field, error, el('div', { class: 'mine-card__actions' }, submit, cancel));
    cancel.addEventListener('click', () => showActions(key));
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        showActions(key);
      }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.classList.add('is-busy');
      error.hidden = true;
      try {
        await save(read());
      } catch (failure) {
        error.replaceChildren(icon('warning'), el('span', null, failure?.message || 'Speichern ging nicht.'));
        error.hidden = false;
        submit.disabled = false;
        submit.classList.remove('is-busy');
      }
    });
    zone.replaceChildren(form);
    return form;
  };

  function showRename() {
    const inputId = `${uid}-name`;
    const input = el('input', { class: 'field__input', id: inputId, type: 'text', maxlength: 120, autocomplete: 'off', spellcheck: 'false', value: entry.title });
    editForm({
      key: 'rename',
      field: el('div', { class: 'field' }, el('label', { class: 'field__label', for: inputId }, 'Neuer Name'), input),
      read: () => input.value,
      save: (value) => actions.onRename(entry, value),
    });
    input.focus();
    input.select();
  }

  function showCategory() {
    const selectId = `${uid}-category`;
    const wrap = categorySelect({ id: selectId, value: entry.category });
    const select = wrap.querySelector('select');
    editForm({
      key: 'category',
      field: el('div', { class: 'field' }, el('label', { class: 'field__label', for: selectId }, 'Kategorie'), wrap),
      read: () => select.value || null,
      save: (value) => actions.onCategory(entry, value),
    });
    select.focus();
  }

  function showDelete() {
    const yes = el('button', { class: 'btn btn--sm btn--danger mine-card__confirm', type: 'button', dataset: { action: 'confirm-delete' } }, icon('close'), el('span', null, 'Ja, löschen'));
    const no = el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, el('span', null, 'Abbrechen'));
    const error = el('p', { class: 'field__error', hidden: true });
    yes.addEventListener('click', async () => {
      yes.disabled = true;
      no.disabled = true;
      try {
        await actions.onDelete(entry);
      } catch (failure) {
        error.replaceChildren(icon('warning'), el('span', null, failure?.message || 'Löschen ging nicht.'));
        error.hidden = false;
        yes.disabled = false;
        no.disabled = false;
      }
    });
    no.addEventListener('click', () => showActions('delete'));
    zone.replaceChildren(el('div', { class: 'mine-card__confirm-box', role: 'group', 'aria-label': 'Löschen bestätigen' },
      el('p', { class: 'mine-card__question', role: 'alert' }, `„${entry.title}“ löschen?`),
      error,
      el('div', { class: 'mine-card__actions' }, yes, no)));
    yes.focus();
  }

  showActions();
  return { element: card, focus: (key) => (key === 'title' ? title.querySelector('a').focus() : zone.querySelector(`[data-action="${key}"]`)?.focus()) };
}
