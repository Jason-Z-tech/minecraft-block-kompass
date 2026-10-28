// „Zu Meine Bauten“ auf „Selber erstellen“: nach einem erfolgreichen Import Titel (vorbelegt mit dem Dateinamen ohne
// Endung) und Kategorie (optional) wählen und die Datei dauerhaft im Browser speichern. Bei 3D-Modellen werden die
// gewählten Einstellungen mitgespeichert. Danach Links zur Bau-Seite und zu „Meine Bauten“.
import { el, clear } from '../dom.js';
import { icon, linkButton, showToast } from '../shared.js';
import { requestPersistence, titleFromFileName, myBuildHref, MINE_LIMITS } from '../../data/my-builds.js';
import { categorySelect } from '../mine/cards.js';

export class SaveToMine {
  #section;
  #body;
  #getStore;
  #upload = null;
  #saved = null;
  #onSaved;

  /** section: #import-save (wird ein- und ausgeblendet), body: #import-save-body, getStore(): Meine Bauten */
  constructor({ section, body, getStore, onSaved = null }) {
    this.#section = section;
    this.#body = body;
    this.#getStore = getStore;
    this.#onSaved = typeof onSaved === 'function' ? onSaved : null;
    this.hide();
  }

  /** Gespeicherter Eintrag (für Tests) oder null */
  get saved() { return this.#saved; }

  /** Nach erfolgreichem Import: upload = { name, format, data, params } */
  show(upload) {
    if (!upload || !(upload.data instanceof ArrayBuffer) || upload.data.byteLength === 0) {
      this.hide();
      return;
    }
    this.#upload = upload;
    this.#saved = null;
    this.#renderForm();
    this.#section.hidden = false;
  }

  hide() {
    this.#upload = null;
    this.#saved = null;
    clear(this.#body);
    this.#section.hidden = true;
  }

  #renderForm() {
    const upload = this.#upload;
    const title = el('input', {
      class: 'field__input', id: 'import-save-title-input', type: 'text', maxlength: MINE_LIMITS.maxTitle, autocomplete: 'off',
      spellcheck: 'false', value: titleFromFileName(upload.name),
    });
    const category = categorySelect({ id: 'import-save-category' });
    const select = category.querySelector('select');
    const error = el('p', { class: 'field__error', role: 'alert', hidden: true });
    const submit = el('button', { class: 'btn btn--primary import-save__submit', type: 'submit', id: 'import-save-submit' }, icon('star'), el('span', null, 'Zu Meine Bauten'));
    const form = el('form', { class: 'import-save__form', novalidate: true },
      el('div', { class: 'field import-save__name' }, el('label', { class: 'field__label', for: 'import-save-title-input' }, 'Name'), title),
      el('div', { class: 'field import-save__category' }, el('label', { class: 'field__label', for: 'import-save-category' }, 'Kategorie'), category),
      el('div', { class: 'import-save__actions' }, submit),
      error);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit.disabled || this.#upload !== upload) return;
      // Klick des Users: den Browser still um dauerhaften Speicher bitten
      requestPersistence();
      submit.disabled = true;
      submit.classList.add('is-busy');
      error.hidden = true;
      try {
        const entry = await this.#getStore().add({
          title: title.value,
          category: select.value || null,
          format: upload.format,
          fileName: upload.name,
          data: upload.data,
          params: upload.params,
        });
        if (this.#upload !== upload) return;
        this.#saved = entry;
        this.#renderSaved(entry);
        showToast({ kind: 'success', title: 'Zu Meine Bauten hinzugefügt', text: entry.title });
        if (this.#onSaved) this.#onSaved(entry);
      } catch (failure) {
        if (failure?.name !== 'MyBuildsError') console.error('[Block-Kompass] Speichern in Meine Bauten fehlgeschlagen:', failure);
        error.replaceChildren(icon('warning'), el('span', null, failure?.name === 'MyBuildsError' ? failure.message : 'Speichern ging nicht. Details stehen in der Konsole.'));
        error.hidden = false;
        submit.disabled = false;
        submit.classList.remove('is-busy');
      }
    });
    this.#body.replaceChildren(form);
  }

  #renderSaved(entry) {
    const open = linkButton('Öffnen', myBuildHref(entry.id), { variant: 'primary', iconName: 'arrow-right' });
    open.id = 'import-save-open';
    this.#body.replaceChildren(el('div', { class: 'import-save__done' },
      el('p', { class: 'import-save__message' }, icon('check'), el('span', null, `„${entry.title}“ ist jetzt in Meine Bauten.`)),
      el('div', { class: 'import-save__actions' }, open, linkButton('Zu Meine Bauten', 'meine.html', { variant: 'secondary', iconName: 'star' }))));
    open.focus();
  }
}
