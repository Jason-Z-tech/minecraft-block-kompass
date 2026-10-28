// Kleine gemeinsame Bausteine der Bau-Ansicht: eindeutige IDs, Ereignis-Verteiler, Knöpfe und der
// Block-Tooltip an einer Bildschirmposition. Ohne DOM-Zugriff beim Laden.
import { el } from '../dom.js';
import { icon, tooltipContent, formatNumber } from '../shared.js';
import { describeState } from '../../core/describe.js';
import { stateId } from '../../core/blockstate.js';

let idCounter = 0;

/** Eindeutige ID-Vorsilbe je Bau-Ansicht (mehrere Ansichten auf einer Seite stören sich nicht). */
export function nextViewId() {
  idCounter += 1;
  return `bv${idCounter}`;
}

/** Minimaler Ereignis-Verteiler; Fehler in Empfängern landen in der Konsole. */
export class Emitter {
  #listeners = new Map();

  on(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
    return () => this.#listeners.get(type)?.delete(listener);
  }

  emit(type, value) {
    for (const listener of this.#listeners.get(type) ?? []) {
      try {
        listener(value);
      } catch (error) {
        console.error(`[Block-Kompass] Fehler bei „${type}“:`, error);
      }
    }
  }

  clear() {
    this.#listeners.clear();
  }
}

/** Kleiner Knopf der Werkzeugleiste (Text, optional Icon, optional umschaltbar mit aria-pressed). */
export function toolButton(label, { iconName = null, pressed = null, title = null, className = '', hideLabel = false } = {}) {
  return el('button', {
    class: ['btn', 'btn--sm', 'bv-tool', className],
    type: 'button',
    'aria-pressed': pressed === null ? null : String(pressed),
    title,
  }, iconName ? icon(iconName) : null, el('span', { class: hideLabel ? 'visually-hidden' : 'bv-tool__label' }, label));
}

export function setPressed(button, pressed) {
  button.setAttribute('aria-pressed', String(Boolean(pressed)));
}

/** Koordinaten eines Blocks für Tooltips; ohne Tausenderpunkt, damit „x 1200“ nicht wie eine Kommazahl aussieht. */
export function positionText(x, y, z) {
  return `Position x ${x} · y ${y} · z ${z}`;
}

/** Zeilen für den Block-Tooltip: deutscher Name, Zustand, Schritt („Schritt 5“), ID. */
export function blockTooltipParts(state, { step = null, coords = null } = {}) {
  let info;
  try {
    info = describeState(state);
  } catch (error) {
    console.warn(`[Block-Kompass] Zustand „${state}“ nicht beschreibbar:`, error);
    info = { name: stateId(state), id: stateId(state), detail: '' };
  }
  const lines = [];
  if (info.detail) lines.push({ text: info.detail, tone: 'blue' });
  if (Number.isInteger(step) && step >= 0) lines.push({ text: `Schritt ${formatNumber(step + 1)}`, tone: 'gold' });
  if (coords) lines.push({ text: coords });
  return { title: info.name, lines, meta: `minecraft:${info.id}` };
}

/**
 * Schwebender Tooltip im Spiel-Stil an einer Bildschirmposition (clientX/Y). parent: wo er hängt
 * (in der Bühne, damit er auch im Vollbild sichtbar ist).
 */
export class FloatingTooltip {
  #parent;
  #node = null;
  #timer = null;

  constructor(parent) {
    this.#parent = parent;
  }

  show(parts, clientX, clientY, { duration = 0 } = {}) {
    clearTimeout(this.#timer);
    const node = el('div', { class: 'tooltip tooltip--floating bv-tooltip', role: 'tooltip' }, tooltipContent(parts.title, { lines: parts.lines, meta: parts.meta }));
    if (this.#node) this.#node.replaceWith(node);
    else this.#parent.append(node);
    this.#node = node;
    this.move(clientX, clientY);
    if (duration > 0) this.#timer = setTimeout(() => this.hide(), duration);
  }

  move(clientX, clientY) {
    if (!this.#node) return;
    const box = this.#node.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth || window.innerWidth;
    const viewH = document.documentElement.clientHeight || window.innerHeight;
    let left = clientX + 16;
    let top = clientY + 18;
    if (left + box.width > viewW - 8) left = clientX - box.width - 16;
    if (top + box.height > viewH - 8) top = clientY - box.height - 12;
    this.#node.style.left = `${Math.round(Math.max(8, left))}px`;
    this.#node.style.top = `${Math.round(Math.max(8, top))}px`;
  }

  hide() {
    clearTimeout(this.#timer);
    this.#node?.remove();
    this.#node = null;
  }

  get visible() {
    return this.#node !== null;
  }
}

/** Bewegung reduzieren? (Systemeinstellung) */
export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
