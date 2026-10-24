// Fortschritt eines Baus im localStorage (ARCHITEKTUR §8): Schritt und abgehakte Materialien.
// Schlüssel „bk:progress:<id>“ bzw. „bk:progress:<id>@<maßstab>“; Zugriffe laufen über storageGet/storageSet
// aus shared.js (immer in try/catch). Ohne Schlüssel (null) wird nichts gespeichert.
import { storageGet, storageSet, storageRemove } from '../shared.js';

export const PROGRESS_VERSION = 1;
const ITEM_ID = /^[a-z0-9_]{1,80}$/;
const MAX_CHECKED = 4000;
const SAVE_DELAY_MS = 400;

/** Gespeicherten Wert prüfen: → { step: Zahl 0 … stepCount | null, checked: Set<item>, updatedAt } */
export function parseStoredProgress(raw, stepCount) {
  const empty = { step: null, checked: new Set(), updatedAt: null };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return empty;
  let step = null;
  if (typeof raw.step === 'number' && Number.isFinite(raw.step) && raw.step >= 0) {
    step = Math.min(stepCount, Math.round(raw.step * 100) / 100);
  }
  const checked = new Set(Array.isArray(raw.checked) ? raw.checked.filter((item) => typeof item === 'string' && ITEM_ID.test(item)).slice(0, MAX_CHECKED) : []);
  const updatedAt = typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : null;
  return { step, checked, updatedAt };
}

export function serializeProgress({ step, checked }, now = new Date()) {
  return {
    v: PROGRESS_VERSION,
    step: step === null ? null : Math.round(step * 100) / 100,
    checked: [...checked].sort(),
    updatedAt: now.toISOString(),
  };
}

/** Kurzer, stabiler Hash (FNV-1a, 32 Bit) als Base36 – für Schlüssel von Formen mit vielen Parametern. */
export function hashText(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

/** Schlüssel für eine Form aus dem Formen-Generator: „bk:progress:form-<form>-<hash der Parameter>“ */
export function formProgressKey(shape, params) {
  const safeShape = String(shape).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'form';
  return `bk:progress:form-${safeShape}-${hashText(JSON.stringify(canonical(params ?? {})))}`;
}

const DEFAULT_STORAGE = { get: storageGet, set: storageSet, remove: storageRemove };

/**
 * Fortschritt eines Baus. step = Fortschritt als Schritt-Zahl (wie viewer.setProgress) oder null (nie gespeichert).
 * Speichern des Schritts gebündelt (400 ms), Abhaken sofort. flush() schreibt Ausstehendes.
 */
export class ProgressStore {
  #key;
  #stepCount;
  #storage;
  #delay;
  #step = null;
  #checked = new Set();
  #updatedAt = null;
  #timer = null;
  #listeners = new Set();

  constructor(key, { stepCount, storage = DEFAULT_STORAGE, delayMs = SAVE_DELAY_MS } = {}) {
    if (key !== null && (typeof key !== 'string' || !key.startsWith('bk:progress:'))) {
      throw new TypeError(`Fortschritts-Schlüssel muss mit „bk:progress:“ beginnen oder null sein: ${String(key)}`);
    }
    if (!Number.isInteger(stepCount) || stepCount < 0) throw new TypeError('ProgressStore braucht die Zahl der Schritte.');
    this.#key = key;
    this.#stepCount = stepCount;
    this.#storage = storage;
    this.#delay = delayMs;
    if (key !== null) {
      const parsed = parseStoredProgress(storage.get(key, null), stepCount);
      this.#step = parsed.step;
      this.#checked = parsed.checked;
      this.#updatedAt = parsed.updatedAt;
    }
  }

  get enabled() { return this.#key !== null; }
  get key() { return this.#key; }
  get step() { return this.#step; }
  get updatedAt() { return this.#updatedAt; }
  get checkedCount() { return this.#checked.size; }
  get hasData() { return this.#step !== null || this.#checked.size > 0; }

  isChecked(item) {
    return this.#checked.has(item);
  }

  checkedItems() {
    return [...this.#checked];
  }

  /** Rückruf bei jeder Änderung (z. B. Anzeige „Dein Fortschritt“). Gibt eine Abmelde-Funktion zurück. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setStep(step) {
    if (typeof step !== 'number' || !Number.isFinite(step)) throw new TypeError(`Schritt muss eine Zahl sein: ${step}`);
    const value = Math.min(this.#stepCount, Math.max(0, Math.round(step * 100) / 100));
    if (value === this.#step) return;
    this.#step = value;
    this.#schedule();
  }

  setChecked(item, checked) {
    if (typeof item !== 'string' || !ITEM_ID.test(item)) throw new TypeError(`Ungültige Gegenstands-ID: ${String(item)}`);
    const had = this.#checked.has(item);
    if (checked === had) return;
    if (checked) this.#checked.add(item);
    else this.#checked.delete(item);
    this.#write();
  }

  /** Alles vergessen (Speicher wird gelöscht). */
  reset() {
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#step = null;
    this.#checked = new Set();
    this.#updatedAt = null;
    if (this.#key !== null) this.#storage.remove(this.#key);
    this.#notify();
  }

  flush() {
    if (this.#timer === null) return;
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#write();
  }

  dispose() {
    this.flush();
    this.#listeners.clear();
  }

  #schedule() {
    if (this.#key === null) {
      this.#notify();
      return;
    }
    clearTimeout(this.#timer);
    if (this.#delay <= 0) {
      this.#timer = null;
      this.#write();
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#write();
    }, this.#delay);
  }

  #write() {
    if (this.#key !== null) {
      const value = serializeProgress({ step: this.#step, checked: this.#checked });
      if (this.#storage.set(this.#key, value)) this.#updatedAt = value.updatedAt;
    }
    this.#notify();
  }

  #notify() {
    for (const listener of this.#listeners) {
      try {
        listener(this);
      } catch (error) {
        console.error('[Block-Kompass] Fehler in einem Fortschritts-Rückruf:', error);
      }
    }
  }
}
