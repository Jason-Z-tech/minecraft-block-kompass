// Datei-Import auf „Selber erstellen“: Auswahl oder Drag & Drop, Vorprüfung (Typ, Größe), Einstellungen für
// 3D-Modelle, Laden mit der Bau-Komponente (progressKey null), Kennzahlen und verständliche Warnungen.
import { el, clear } from '../dom.js';
import { icon, renderState, renderLoading, formatNumber } from '../shared.js';
import { loadGameBlockColors } from '../../data/game-data.js';
import { intField, segmentedField, checkboxField } from './fields.js';
import { BlockPicker } from './block-picker.js';
import {
  FILE_ACCEPT, checkSelectedFiles, isModelFormat, formatLabel, fileSizeText, defaultModelOptions, modelParams, uploadEntry,
  uploadFacts, uploadAdjustments, MODEL_PALETTES, MODEL_UP_AXES, MODEL_HEIGHT,
} from './model.js';

export class Importer {
  #slot;
  #names;
  #blocks;
  #parts;
  #selection = null;
  #options = null;
  #fields = {};
  #picker = null;
  #colorIds = null;
  #token = 0;
  #onResult;

  /**
   * parts: { drop, input, body, status, report, reportBody }; slot: ViewSlot für das Ergebnis.
   * onResult({ ok, error?, result? }) nach jedem Ladeversuch (für Tests und Seitentitel).
   */
  constructor({ parts, slot, names, blocks, onResult = null }) {
    this.#parts = parts;
    this.#slot = slot;
    this.#names = names;
    this.#blocks = blocks;
    this.#onResult = typeof onResult === 'function' ? onResult : null;
    parts.input.setAttribute('accept', FILE_ACCEPT);
    parts.input.addEventListener('change', () => {
      const files = [...(parts.input.files ?? [])];
      // Gleiche Datei noch einmal wählen soll wieder auslösen
      parts.input.value = '';
      if (files.length) this.handleFiles(files);
    });
    this.#bindDrop();
  }

  /** Dateien prüfen und (bei Bauplänen sofort, bei Modellen nach den Einstellungen) laden. */
  handleFiles(files) {
    const check = checkSelectedFiles(files);
    if (!check.ok) {
      this.#selection = null;
      this.#renderSelection();
      this.#showError('Diese Auswahl geht nicht', check.error);
      this.#report(null);
      if (this.#onResult) this.#onResult({ ok: false, error: check.error });
      return;
    }
    this.#selection = check;
    this.#options = defaultModelOptions(check.format);
    this.#renderSelection();
    if (isModelFormat(check.format)) {
      clear(this.#parts.status);
      this.#parts.body.querySelector('.import-options__submit')?.focus();
    } else {
      this.load();
    }
  }

  /** Gewählte Datei mit den aktuellen Einstellungen laden. */
  async load() {
    const selection = this.#selection;
    if (!selection) return;
    const token = ++this.#token;
    let params = {};
    if (isModelFormat(selection.format)) {
      const checked = modelParams(selection.format, this.#readOptions());
      if (!checked.ok) {
        this.#showError('Bitte die Einstellungen prüfen', checked.errors.join(' '));
        return;
      }
      params = checked.params;
    }
    const { file, format } = selection;
    renderLoading(this.#parts.status, { title: `„${file.name}“ wird gelesen …`, text: 'Den Fortschritt siehst du in der 3D-Ansicht.', compact: true });
    this.#setBusy(true);
    this.#report(null);
    let data;
    try {
      data = await file.arrayBuffer();
    } catch (error) {
      console.error('[Block-Kompass] Datei nicht lesbar:', error);
      if (token !== this.#token) return;
      this.#setBusy(false);
      this.#slot.clear();
      this.#showError('Die Datei ließ sich nicht lesen', 'Der Browser konnte die Datei nicht öffnen. Liegt sie noch am selben Ort?');
      if (this.#onResult) this.#onResult({ ok: false, error: 'Die Datei ließ sich nicht lesen.' });
      return;
    }
    if (token !== this.#token) return;
    this.#revealResult();
    try {
      const handle = await this.#slot.show({
        source: { kind: 'upload', format, name: file.name, data, params },
        params: {},
        entry: uploadEntry(file.name, format),
        progressKey: null,
      });
      if (token !== this.#token || !handle) return;
      clear(this.#parts.status);
      this.#report(handle.result);
      if (this.#onResult) this.#onResult({ ok: true, result: handle.result });
    } catch (error) {
      if (token !== this.#token) return;
      // Eine kaputte Datei lässt sich nicht „erneut versuchen“: Ansicht weg, Meldung bei der Auswahl
      this.#slot.clear();
      const message = typeof error?.message === 'string' && error.message ? error.message : 'Unbekannter Fehler.';
      // Erwartbare Fälle (kaputte Datei, kein WebGL2) stehen schon verständlich auf der Seite
      if (['upload', 'source', 'no-webgl2'].includes(error?.code)) console.warn('[Block-Kompass] Import nicht möglich:', message);
      else console.error('[Block-Kompass] Import fehlgeschlagen:', error);
      this.#showError(error?.code === 'no-webgl2' ? '3D-Ansicht nicht möglich' : 'Die Datei konnte nicht geladen werden', message);
      if (this.#onResult) this.#onResult({ ok: false, error: message, code: error?.code ?? null });
    } finally {
      if (token === this.#token) this.#setBusy(false);
    }
  }

  // ---------------------------------------------------------------- Auswahl und Drag & Drop

  #bindDrop() {
    const { drop } = this.#parts;
    const hasFiles = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
    let depth = 0;
    drop.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      drop.classList.add('is-dragover');
    });
    drop.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    drop.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) drop.classList.remove('is-dragover');
    });
    drop.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      drop.classList.remove('is-dragover');
      this.handleFiles([...event.dataTransfer.files]);
    });
    // Daneben fallen gelassene Dateien soll der Browser nicht öffnen (die Seite wäre weg)
    for (const type of ['dragover', 'drop']) {
      window.addEventListener(type, (event) => {
        if (hasFiles(event) && !drop.contains(event.target)) event.preventDefault();
      });
    }
  }

  #renderSelection() {
    const { body } = this.#parts;
    this.#fields = {};
    this.#picker = null;
    const selection = this.#selection;
    if (!selection) {
      body.replaceChildren();
      return;
    }
    const { file, format, mtl } = selection;
    const card = el('div', { class: 'import-file plate' },
      el('span', { class: 'import-file__icon', 'aria-hidden': 'true' }, icon(isModelFormat(format) ? 'cube' : 'layers', { size: 32 })),
      el('div', { class: 'import-file__body' },
        el('p', { class: 'import-file__name' }, file.name),
        el('p', { class: 'import-file__meta mono' }, `${formatLabel(format)} · ${fileSizeText(file.size)}${mtl ? ` · Farben: ${mtl.name}` : ''}`)));
    const nodes = [card];
    if (mtl) {
      nodes.push(el('ul', { class: 'create-notes', role: 'list' }, el('li', { class: 'create-note create-note--warning' }, icon('warning'),
        el('span', null, 'Die Farben aus der .mtl-Datei kann der Import noch nicht übernehmen – das Modell bekommt eine einheitliche Grundfarbe. Mit der Palette „Ein Block“ wählst du selbst, woraus es besteht.'))));
    }
    if (isModelFormat(format)) nodes.push(this.#modelOptions(format));
    body.replaceChildren(...nodes);
  }

  // ---------------------------------------------------------------- Einstellungen für 3D-Modelle

  #modelOptions(format) {
    const options = this.#options;
    const form = el('form', { class: 'import-options', id: 'import-options', novalidate: true, 'aria-labelledby': 'import-options-title' });
    const fields = {};
    const sync = () => this.#syncOptionVisibility();
    if (format === 'vox') {
      fields.keepSize = checkboxField({ id: 'import-keep-size', label: 'Originalgröße behalten (1 Voxel = 1 Block)', value: options.keepSize, onChange: (v) => { options.keepSize = v; sync(); } });
    }
    fields.height = intField({
      id: 'import-height', label: 'Höhe in Blöcken', min: MODEL_HEIGHT.min, max: MODEL_HEIGHT.max, value: options.height, unit: 'Blöcke',
      hint: 'Das Seitenverhältnis bleibt; bei flachen Modellen bestimmt die längste Seite.', onInput: (v) => { options.height = v; },
    });
    fields.solid = segmentedField({
      id: 'import-solid', label: 'Füllung', value: options.solid ? '1' : '0',
      options: [{ value: '0', label: 'Hohl', hint: 'Nur die Oberfläche – spart viele Blöcke.' }, { value: '1', label: 'Voll', hint: 'Auch das Innere wird gefüllt.' }],
      onChange: (v) => { options.solid = v === '1'; },
    });
    fields.palette = segmentedField({ id: 'import-palette', label: 'Blöcke für die Farben', value: options.palette, options: MODEL_PALETTES, onChange: (v) => { options.palette = v; sync(); } });
    const blockLabelId = 'import-block-label';
    this.#picker = new BlockPicker({
      names: this.#names, blocks: this.#blocks, kind: 'full', allowed: this.#colorIds, value: options.block, labelId: blockLabelId, inputId: 'import-block',
      onChange: (id) => { options.block = id; },
    });
    fields.block = { element: el('div', { class: 'field create-field create-field--block' }, el('label', { class: 'field__label', id: blockLabelId, for: 'import-block' }, 'Block für das ganze Modell'), this.#picker.element) };
    fields.upAxis = segmentedField({ id: 'import-up-axis', label: 'Welche Achse zeigt nach oben?', value: options.upAxis, options: MODEL_UP_AXES, onChange: (v) => { options.upAxis = v; } });
    const submit = el('button', { class: 'btn btn--primary import-options__submit', type: 'submit' }, icon('cube'), el('span', null, 'In Blöcke umwandeln'));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.load();
    });
    form.append(
      el('h3', { class: 'import-options__title', id: 'import-options-title' }, 'Einstellungen für das 3D-Modell'),
      el('div', { class: 'import-options__grid' }, Object.values(fields).map((field) => field.element)),
      el('div', { class: 'import-options__actions' }, submit));
    this.#fields = fields;
    this.#syncOptionVisibility();
    return form;
  }

  #syncOptionVisibility() {
    const fields = this.#fields;
    const options = this.#options;
    if (!fields.height) return;
    fields.height.element.hidden = Boolean(fields.keepSize && options.keepSize);
    const single = options.palette === 'einfarbig';
    fields.block.element.hidden = !single;
    if (single && !this.#colorIds) this.#loadColorIds();
  }

  // Nur Blöcke mit Farbwert (volle, deckende Würfel) taugen für „Ein Block“. Blockfarben erst hier, bei Bedarf
  // (online beim ersten Mal aus den Texturen berechnet, js/data/game-data.js)
  async #loadColorIds() {
    try {
      const json = await loadGameBlockColors();
      const ids = json && typeof json.blocks === 'object' && json.blocks ? Object.keys(json.blocks) : [];
      if (ids.length === 0) throw new Error('block-colors.json enthält keine Blöcke.');
      this.#colorIds = new Set(ids);
      this.#picker?.setAllowed(this.#colorIds);
    } catch (error) {
      console.warn('[Block-Kompass] Blockfarben nicht geladen – die Auswahl zeigt alle vollen Blöcke:', error);
    }
  }

  #readOptions() {
    const options = { ...this.#options };
    if (this.#fields.height) options.height = this.#fields.height.get();
    return options;
  }

  // ---------------------------------------------------------------- Zustände und Ergebnis

  #setBusy(busy) {
    const submit = this.#parts.body.querySelector('.import-options__submit');
    if (submit) {
      submit.disabled = busy;
      submit.classList.toggle('is-busy', busy);
    }
    this.#parts.drop.classList.toggle('is-busy', busy);
  }

  #showError(title, text) {
    renderState(this.#parts.status, { kind: 'error', title, text, headingLevel: 3, compact: true });
  }

  #revealResult() {
    const host = this.#slot.host;
    host.hidden = false;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    host.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  #report(result) {
    const { report, reportBody } = this.#parts;
    if (!result || !result.upload) {
      report.hidden = true;
      reportBody.replaceChildren();
      return;
    }
    const upload = result.upload;
    const facts = uploadFacts(upload);
    const adjustments = uploadAdjustments(upload);
    const warnings = Array.isArray(result.warnings) ? result.warnings.filter((text) => typeof text === 'string') : [];
    const chapters = Array.isArray(result.phases) ? result.phases.length : 0;
    const steps = Array.isArray(result.steps) ? result.steps.length : 0;
    reportBody.replaceChildren(
      el('div', { class: 'import-report__grid' },
        el('dl', { class: 'facts import-report__facts' },
          [...facts, ['Anleitung', `${formatNumber(chapters)} Kapitel, ${formatNumber(steps)} ${steps === 1 ? 'Schritt' : 'Schritte'}`]]
            .map(([term, value]) => el('div', null, el('dt', null, term), el('dd', null, value)))),
        el('div', { class: 'import-report__notes' },
          adjustments.length
            ? el('ul', { class: 'cluster import-report__badges', role: 'list', 'aria-label': 'Anpassungen' }, adjustments.map((item) => el('li', { class: `import-badge import-badge--${item.kind}` }, item.text)))
            : el('p', { class: 'import-report__clean' }, icon('check'), el('span', null, 'Alle Blöcke gibt es so in Minecraft 26.2 – nichts musste angepasst werden.')),
          warnings.length
            ? el('details', { class: 'import-report__warnings', open: warnings.length <= 6 },
              el('summary', null, `${formatNumber(warnings.length)} ${warnings.length === 1 ? 'Hinweis' : 'Hinweise'} zur Datei`),
              el('ul', { class: 'create-notes', role: 'list' }, warnings.map((text) => el('li', { class: 'create-note create-note--warning' }, icon('warning'), el('span', null, text)))))
            : null)));
    report.hidden = false;
  }
}
