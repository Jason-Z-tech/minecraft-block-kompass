// Platz für eine Bau-Ansicht auf „Selber erstellen“ (Formen-Vorschau bzw. Import). Jede neue Last baut eine frische
// Ansicht (mountBuildView) und räumt die alte vorher ab – auch nach Fehlern und bei überholten Ladevorgängen.
import { el } from '../dom.js';
import { mountBuildView } from '../build-view.js';

export class ViewSlot {
  #host;
  #handle = null;
  #token = 0;
  #loading = false;

  /** host: Container im Dokument (wird beim Zeigen eingeblendet). */
  constructor(host) {
    if (!host || typeof host.replaceChildren !== 'function') throw new TypeError('ViewSlot braucht einen Container.');
    this.#host = host;
  }

  get host() { return this.#host; }
  /** Griff der geladenen Ansicht ({ viewer, result, context, dispose }) oder null */
  get handle() { return this.#handle; }
  get loading() { return this.#loading; }

  /**
   * Lädt eine Quelle in eine frische Ansicht → Griff, oder null, wenn ein neuerer Aufruf diesen überholt hat.
   * Ladefehler: Die Ansicht zeigt den Fehler selbst; das Promise lehnt mit dem Fehler ab (code wie ViewerError).
   */
  async show({ source, params = {}, entry = null, progressKey = null }) {
    const token = ++this.#token;
    this.#release();
    const container = el('div', { class: 'create-view__mount' });
    this.#host.replaceChildren(container);
    this.#host.hidden = false;
    this.#loading = true;
    let failed = null;
    try {
      const handle = await mountBuildView(container, {
        source, params, entry, progressKey,
        onError: (_error, failedHandle) => { failed = failedHandle ?? null; },
      });
      if (token !== this.#token) {
        handle.dispose();
        return null;
      }
      this.#handle = handle;
      return handle;
    } catch (error) {
      if (failed) {
        if (token === this.#token) this.#handle = failed;
        else failed.dispose();
      }
      if (token !== this.#token || error?.code === 'cancelled') return null;
      throw error;
    } finally {
      if (token === this.#token) this.#loading = false;
    }
  }

  /** Ansicht abbauen und den Platz ausblenden. */
  clear() {
    this.#token++;
    this.#loading = false;
    this.#release();
    this.#host.replaceChildren();
    this.#host.hidden = true;
  }

  #release() {
    const handle = this.#handle;
    this.#handle = null;
    if (!handle) return;
    try {
      handle.dispose();
    } catch (error) {
      console.error('[Block-Kompass] Ansicht ließ sich nicht abbauen:', error);
    }
  }
}
