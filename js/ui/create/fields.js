// Formular-Bausteine für „Selber erstellen“: Zahl mit Regler, Umschalter (Radio-Segmente), Kästchen.
// Jede Funktion liefert { element, get(), set(wert), setError(meldungen), setVisible(sichtbar) }.
import { el } from '../dom.js';
import { syncSlider, formatNumber } from '../shared.js';

function errorNode(id) {
  return el('p', { class: 'field__error create-field__error', id, hidden: true });
}

function showError(node, messages, inputs) {
  const list = (Array.isArray(messages) ? messages : []).filter(Boolean);
  node.textContent = list.join(' ');
  node.hidden = list.length === 0;
  for (const input of inputs) {
    if (list.length) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function describedBy(...ids) {
  const list = ids.filter(Boolean);
  return list.length ? list.join(' ') : null;
}

/**
 * Ganze Zahl: Eingabefeld (Tastatur) plus Schieberegler (Maus/Touch). onInput(text) bei jeder Änderung.
 * Der Regler ist nur Zusatz – Screenreader und Tastatur nutzen das Zahlenfeld.
 */
export function intField({ id, label, min, max, value, unit = '', hint = '', onInput }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = `${id}-error`;
  const number = el('input', {
    class: 'field__input create-field__number mono', id, type: 'number', inputmode: 'numeric', min, max, step: 1, value: String(value),
    'aria-describedby': describedBy(hintId, errorId),
  });
  const range = el('input', { class: 'slider create-field__range', type: 'range', min, max, step: 1, value: String(value), tabindex: -1, 'aria-hidden': 'true' });
  syncSlider(range);
  const error = errorNode(errorId);
  number.addEventListener('input', () => {
    const n = Number(number.value);
    if (Number.isInteger(n) && n >= min && n <= max) {
      range.value = String(n);
      syncSlider(range);
    }
    onInput(number.value);
  });
  range.addEventListener('input', () => {
    number.value = range.value;
    syncSlider(range);
    onInput(range.value);
  });
  const element = el('div', { class: 'field create-field create-field--int' },
    el('div', { class: 'create-field__head' },
      el('label', { class: 'field__label', for: id }, label),
      el('span', { class: 'create-field__range-text mono' }, `${formatNumber(min)}–${formatNumber(max)}${unit ? ` ${unit}` : ''}`)),
    el('div', { class: 'create-field__control' }, range, number),
    hint ? el('p', { class: 'field__hint', id: hintId }, hint) : null,
    error);
  return {
    element,
    get: () => number.value,
    set(next) {
      number.value = String(next);
      range.value = String(next);
      syncSlider(range);
    },
    setError: (messages) => showError(error, messages, [number]),
    setVisible(visible) { element.hidden = !visible; },
  };
}

let segmentCounter = 0;

/**
 * Umschalter aus Radio-Feldern (Pfeiltasten wechseln wie bei normalen Radios).
 * options: [{ value, label, hint? }]; value-Vergleich als Text.
 */
export function segmentedField({ id, label, options, value, hint = '', onChange, className = '' }) {
  const name = `${id}-${++segmentCounter}`;
  const hintId = hint ? `${id}-hint` : null;
  const errorId = `${id}-error`;
  const optionHint = el('p', { class: 'field__hint create-field__option-hint', id: `${id}-option-hint` });
  const inputs = options.map((option) => el('input', {
    class: 'bv-segmented__input', type: 'radio', name, value: String(option.value), checked: String(option.value) === String(value),
  }));
  const error = errorNode(errorId);
  const updateHint = () => {
    const current = options.find((option) => String(option.value) === getValue());
    optionHint.textContent = current?.hint ?? '';
    optionHint.hidden = !current?.hint;
  };
  const getValue = () => inputs.find((input) => input.checked)?.value ?? '';
  for (const input of inputs) {
    input.addEventListener('change', () => {
      updateHint();
      onChange(input.value);
    });
  }
  const element = el('fieldset', { class: ['field create-field create-field--segmented', className], id, 'aria-describedby': describedBy(hintId, `${id}-option-hint`, errorId) },
    el('legend', { class: 'field__label' }, label),
    el('div', { class: ['bv-segmented create-segmented', options.length > 3 && 'create-segmented--many'] }, options.map((option, index) => el('label', { class: 'bv-segmented__option' },
      inputs[index], el('span', null, option.label)))),
    hint ? el('p', { class: 'field__hint', id: hintId }, hint) : null,
    optionHint,
    error);
  updateHint();
  return {
    element,
    get: getValue,
    set(next) {
      for (const input of inputs) input.checked = input.value === String(next);
      updateHint();
    },
    setError: (messages) => showError(error, messages, inputs),
    setVisible(visible) { element.hidden = !visible; },
  };
}

/** Kästchen (ja/nein) */
export function checkboxField({ id, label, value, hint = '', onChange }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = `${id}-error`;
  const input = el('input', { type: 'checkbox', id, checked: Boolean(value), 'aria-describedby': describedBy(hintId, errorId) });
  input.addEventListener('change', () => onChange(input.checked));
  const error = errorNode(errorId);
  const element = el('div', { class: 'field create-field create-field--check' },
    el('label', { class: 'choice' }, input, el('span', null, label)),
    hint ? el('p', { class: 'field__hint', id: hintId }, hint) : null,
    error);
  return {
    element,
    get: () => input.checked,
    set(next) { input.checked = Boolean(next); },
    setError: (messages) => showError(error, messages, [input]),
    setVisible(visible) { element.hidden = !visible; },
  };
}
