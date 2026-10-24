// Formen-Generator auf „Selber erstellen“: Form wählen, Parameter einstellen (Zahl + Regler, Block mit Suche,
// hohl/voll …), Kennzahlen live, Vorschau mit der Bau-Komponente und Link auf bau.html?form=….
import { el, sitePath } from '../dom.js';
import { icon, storageGet, storageSet } from '../shared.js';
import { SHAPES, SHAPE_IDS, defaultShapeParams, validateShapeParams, shapeQueryString, shapeSize } from '../../create/shape-generators.js';
import { formatAmount } from '../../core/materials.js';
import { formProgressKey } from '../build/progress.js';
import { shapeGlyph } from './shape-glyphs.js';
import { intField, segmentedField, checkboxField } from './fields.js';
import { BlockPicker } from './block-picker.js';
import {
  shapeHref, shapeEntry, shapeSummary, shapeFacts, splitShapeMessages, isParamActive, readStoredShape, SHAPE_STORAGE_KEY,
} from './model.js';

const AUTO_REFRESH_MAX = 200_000;
const AUTO_REFRESH_MS = 900;
const HOLLOW_OPTIONS = [{ value: '1', label: 'Hohl' }, { value: '0', label: 'Voll' }];

export class ShapeGenerator {
  #names;
  #blocks;
  #slot;
  #parts = {};
  #shape = null;
  #fields = new Map();
  #raw = {};
  #check = null;
  #previewKey = null;
  #refreshTimer = null;
  #onState;

  /**
   * body/summary: Container im Formular-Bereich; slot: ViewSlot für die Vorschau.
   * onState(state) meldet jede Änderung ({ shape, ok, params, queryString, estimate }).
   */
  constructor({ body, summary, slot, names, blocks, onState = null }) {
    this.#names = names;
    this.#blocks = blocks;
    this.#slot = slot;
    this.#onState = typeof onState === 'function' ? onState : null;
    this.#buildSkeleton(body, summary);
    const stored = readStoredShape(storageGet(SHAPE_STORAGE_KEY));
    this.select(stored?.shape ?? 'sphere', stored?.raw ?? null);
  }

  get state() {
    const check = this.#check;
    return {
      shape: this.#shape,
      ok: Boolean(check?.ok),
      params: check?.ok ? check.params : null,
      queryString: check?.ok ? shapeQueryString(this.#shape, check.params) : null,
      estimate: check?.estimate ?? 0,
    };
  }

  /** Form wählen; raw = Startwerte (sonst Standard). */
  select(shapeId, raw = null) {
    const id = SHAPE_IDS.includes(shapeId) ? shapeId : 'sphere';
    this.#shape = id;
    const defaults = defaultShapeParams(id);
    this.#raw = { ...defaults };
    if (raw && typeof raw === 'object') {
      for (const key of Object.keys(defaults)) if (Object.hasOwn(raw, key)) this.#raw[key] = raw[key];
    }
    for (const input of this.#parts.picker.querySelectorAll('input[name="shape"]')) input.checked = input.value === id;
    this.#parts.description.textContent = SHAPES[id].description;
    this.#renderFields();
    this.#update({ fromUser: false });
  }

  /** Ergebnis des Freitexts übernehmen (Form + vollständige Parameter). */
  apply(shapeId, params) {
    this.select(shapeId, params);
  }

  /** Vorschau mit den aktuellen Werten bauen (nur bei gültigen Werten). */
  async showPreview() {
    clearTimeout(this.#refreshTimer);
    const check = this.#check;
    if (!check?.ok) return null;
    const shape = this.#shape;
    const params = check.params;
    this.#previewKey = shapeQueryString(shape, params);
    this.#parts.preview.disabled = true;
    this.#parts.preview.classList.add('is-busy');
    this.#renderStale();
    try {
      return await this.#slot.show({
        source: { kind: 'shape', shape, params },
        params: {},
        entry: shapeEntry(shape, params, this.#names),
        progressKey: formProgressKey(shape, params),
      });
    } catch (error) {
      // Den Fehler zeigt die Ansicht selbst (mit „Erneut versuchen“)
      console.warn('[Block-Kompass] Vorschau der Form fehlgeschlagen:', error);
      return null;
    } finally {
      this.#parts.preview.classList.remove('is-busy');
      this.#renderActions();
    }
  }

  // ---------------------------------------------------------------- Aufbau

  #buildSkeleton(body, summary) {
    const picker = el('fieldset', { class: 'shape-picker' },
      el('legend', { class: 'field__label' }, 'Form'),
      el('div', { class: 'shape-picker__grid' }, SHAPE_IDS.map((id) => {
        const input = el('input', { class: 'shape-option__input', type: 'radio', name: 'shape', value: id });
        input.addEventListener('change', () => {
          if (input.checked) this.select(id, this.#carryOver(id));
        });
        return el('label', { class: 'shape-option' }, input,
          el('span', { class: 'shape-option__card' }, shapeGlyph(id, { size: 40 }), el('span', { class: 'shape-option__title' }, SHAPES[id].title)));
      })));
    const description = el('p', { class: 'shape-description' });
    const fields = el('div', { class: 'shape-fields' });
    const form = el('form', { class: 'shape-form', id: 'shape-form', novalidate: true, 'aria-label': 'Maße und Material' }, fields);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.showPreview();
    });
    body.replaceChildren(picker, description, form);

    const glyph = el('span', { class: 'shape-summary__glyph' });
    const name = el('p', { class: 'shape-summary__name' });
    const subline = el('p', { class: 'shape-summary__subline' });
    const facts = el('dl', { class: 'facts shape-summary__facts', id: 'shape-metrics' });
    const messages = el('div', { class: 'shape-messages', 'aria-live': 'polite' });
    const preview = el('button', { class: 'btn btn--primary', type: 'button', id: 'shape-preview-button' }, icon('cube'), el('span', null, 'Vorschau hier bauen'));
    preview.addEventListener('click', () => this.showPreview());
    const open = el('a', { class: 'btn btn--secondary', id: 'shape-open-link' }, icon('book'), el('span', null, 'Als Anleitung öffnen'));
    open.addEventListener('click', (event) => {
      if (open.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });
    const stale = el('p', { class: 'shape-summary__stale', hidden: true });
    summary.replaceChildren(
      el('div', { class: 'shape-summary__head' }, glyph, el('div', null, name, subline)),
      facts, messages,
      el('div', { class: 'shape-actions' }, preview, open),
      stale);
    Object.assign(this.#parts, { picker, description, fields, glyph, name, subline, facts, messages, preview, open, stale });
  }

  // Gleiche Schlüssel (Durchmesser, Block, hohl …) beim Formwechsel mitnehmen, wenn sie für die neue Form gültig sind
  #carryOver(nextId) {
    const next = defaultShapeParams(nextId);
    const raw = {};
    for (const key of Object.keys(next)) {
      if (!Object.hasOwn(this.#raw, key)) continue;
      const trial = validateShapeParams(nextId, { [key]: this.#raw[key] }, { blocks: this.#blocks });
      if (!trial.errors.some((message) => message.startsWith(`${SHAPES[nextId].params.find((p) => p.key === key).label}: `))) raw[key] = this.#raw[key];
    }
    return raw;
  }

  #renderFields() {
    this.#fields.clear();
    const shape = SHAPES[this.#shape];
    const nodes = shape.params.map((param) => {
      const field = this.#createField(param);
      this.#fields.set(param.key, { param, ...field });
      return field.element;
    });
    this.#parts.fields.replaceChildren(...nodes);
  }

  #createField(param) {
    const id = `shape-${param.key}`;
    const value = this.#raw[param.key];
    const change = (next) => {
      this.#raw[param.key] = next;
      this.#update({ fromUser: true });
    };
    if (param.type === 'int') {
      return intField({ id, label: param.label, min: param.min, max: param.max, value, unit: param.unit ?? '', hint: param.hint ?? '', onInput: change });
    }
    if (param.type === 'bool' && param.key === 'hollow') {
      const field = segmentedField({ id, label: 'Bauweise', options: HOLLOW_OPTIONS, value: value ? '1' : '0', hint: param.hint ?? '', onChange: (v) => change(v === '1') });
      return { ...field, get: () => field.get() === '1', set: (v) => field.set(v ? '1' : '0') };
    }
    if (param.type === 'bool') {
      return checkboxField({ id, label: param.label, value, hint: param.hint ?? '', onChange: change });
    }
    if (param.type === 'enum') {
      return segmentedField({ id, label: param.label, options: param.options, value, hint: param.hint ?? '', onChange: change });
    }
    return this.#blockField(param, id, value, change);
  }

  #blockField(param, id, value, change) {
    const labelId = `${id}-label`;
    const hintId = param.hint ? `${id}-hint` : null;
    const errorId = `${id}-error`;
    const picker = new BlockPicker({
      names: this.#names, blocks: this.#blocks, kind: param.kind === 'stairs' ? 'stairs' : 'full', optional: Boolean(param.optional),
      emptyLabel: param.emptyLabel ?? 'keiner', value, labelId, inputId: id, describedBy: [hintId, errorId].filter(Boolean).join(' ') || null,
      onChange: change,
    });
    const error = el('p', { class: 'field__error create-field__error', id: errorId, hidden: true });
    const element = el('div', { class: 'field create-field create-field--block' },
      el('label', { class: 'field__label', id: labelId, for: id }, param.label),
      picker.element,
      param.hint ? el('p', { class: 'field__hint', id: hintId }, param.hint) : null,
      error);
    return {
      element,
      get: () => picker.value,
      set: (v) => picker.setValue(v),
      setError(messages) {
        const list = (messages ?? []).filter(Boolean);
        error.textContent = list.join(' ');
        error.hidden = list.length === 0;
        picker.setInvalid(list.length > 0);
      },
      setVisible(visible) { element.hidden = !visible; },
    };
  }

  // ---------------------------------------------------------------- Prüfen und anzeigen

  #update({ fromUser }) {
    const shapeId = this.#shape;
    for (const { param, setVisible } of this.#fields.values()) setVisible(isParamActive(param, this.#raw));
    const check = validateShapeParams(shapeId, this.#raw, { blocks: this.#blocks });
    this.#check = check;
    const errors = splitShapeMessages(shapeId, check.errors);
    const warnings = splitShapeMessages(shapeId, check.warnings);
    for (const [key, field] of this.#fields) field.setError(errors.byKey[key] ?? []);
    this.#renderSummary(check, errors.general, warnings);
    this.#renderActions();
    this.#renderStale();
    if (check.ok && fromUser) storageSet(SHAPE_STORAGE_KEY, { shape: shapeId, raw: check.params });
    if (fromUser) this.#scheduleRefresh();
    if (this.#onState) this.#onState(this.state);
  }

  #renderSummary(check, generalErrors, warnings) {
    const shapeId = this.#shape;
    const { glyph, name, subline, facts, messages } = this.#parts;
    glyph.replaceChildren(shapeGlyph(shapeId, { size: 64 }));
    name.textContent = SHAPES[shapeId].title;
    subline.textContent = check.ok ? shapeSummary(shapeId, check.params, this.#names) : 'Bitte die markierten Felder prüfen.';
    const size = check.ok ? shapeSize(shapeId, check.params) : null;
    const amount = check.ok && check.estimate > 0 ? formatAmount(check.estimate) : null;
    const list = check.ok ? shapeFacts(shapeId, check.params, check.estimate, { size, amount, names: this.#names }) : [];
    facts.replaceChildren(...list.map(([term, value, mono]) => el('div', null, el('dt', null, term), el('dd', { class: mono ? 'mono' : null }, value))));
    facts.hidden = list.length === 0;
    const items = [
      ...generalErrors.map((text) => ({ text, kind: 'error' })),
      ...(check.ok ? [] : [{ text: 'Mit diesen Werten lässt sich die Form nicht bauen.', kind: 'error' }]),
      ...Object.entries(warnings.byKey).flatMap(([key, texts]) => texts.map((text) => ({ text: `${this.#fields.get(key)?.param.label ?? key}: ${text}`, kind: 'warning' }))),
      ...warnings.general.map((text) => ({ text, kind: 'warning' })),
    ];
    messages.replaceChildren(...(items.length ? [el('ul', { class: 'create-notes', role: 'list' }, items.map((item) => el('li', { class: `create-note create-note--${item.kind}` },
      icon(item.kind === 'error' ? 'close' : 'warning'), el('span', null, item.text))))] : []));
  }

  #renderActions() {
    const { preview, open } = this.#parts;
    const ok = Boolean(this.#check?.ok);
    preview.disabled = !ok || this.#slot.loading;
    if (ok) {
      open.setAttribute('href', sitePath(shapeHref(shapeQueryString(this.#shape, this.#check.params))));
      open.removeAttribute('aria-disabled');
    } else {
      open.removeAttribute('href');
      open.setAttribute('aria-disabled', 'true');
    }
    const label = preview.querySelector('span');
    label.textContent = this.#previewKey ? 'Vorschau aktualisieren' : 'Vorschau hier bauen';
  }

  #renderStale() {
    const { stale } = this.#parts;
    const current = this.#check?.ok ? shapeQueryString(this.#shape, this.#check.params) : null;
    const isStale = this.#previewKey !== null && current !== this.#previewKey;
    this.#slot.host.classList.toggle('is-stale', isStale);
    if (!isStale) {
      stale.hidden = true;
      return;
    }
    stale.hidden = false;
    stale.textContent = this.#check?.ok && this.#check.estimate <= AUTO_REFRESH_MAX
      ? 'Die Vorschau wird gleich neu gebaut …'
      : 'Die Vorschau zeigt noch die alten Werte – „Vorschau aktualisieren“ baut sie neu.';
  }

  // Kleine Formen baut die Vorschau nach einer kurzen Pause von selbst neu, große erst auf Knopfdruck
  #scheduleRefresh() {
    clearTimeout(this.#refreshTimer);
    if (this.#previewKey === null || !this.#check?.ok || this.#check.estimate > AUTO_REFRESH_MAX) return;
    this.#refreshTimer = setTimeout(() => {
      if (this.#check?.ok && shapeQueryString(this.#shape, this.#check.params) !== this.#previewKey) this.showPreview();
    }, AUTO_REFRESH_MS);
  }
}
