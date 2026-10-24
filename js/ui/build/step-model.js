// Schrittmodell des Players (rein, in Node testbar). Fortschritt p wie viewer.setProgress:
// p = 0 → noch nichts gebaut, p = i + 1 → Schritt i fertig, p = n → ganzer Bau. Kommazahlen = Schritt läuft gerade.
import { formatNumber } from '../shared.js';

/** Schritt, den die Anzeige als „aktuell“ zeigt: −1 vor dem Start, sonst 0 … n − 1. */
export function shownStep(p, stepCount) {
  if (!(stepCount > 0) || !(p > 0)) return -1;
  return Math.min(stepCount - 1, Math.ceil(p - 1e-9) - 1);
}

export function clampProgress(p, stepCount) {
  if (typeof p !== 'number' || Number.isNaN(p)) return 0;
  return Math.min(stepCount, Math.max(0, p));
}

/** Ziel für „Schritt i zeigen“ */
export function progressForStep(index) {
  return index + 1;
}

/** Vorheriger Schritt: von p ∈ (i, i + 1] nach i (Schritt i − 1 fertig); vom Start bleibt es beim Start. */
export function previousTarget(p, stepCount) {
  const shown = shownStep(p, stepCount);
  return shown < 0 ? 0 : shown;
}

/** Nächster Schritt: ein laufender Schritt wird erst fertig gezeigt. */
export function nextTarget(p, stepCount) {
  return Math.min(stepCount, Math.floor(clampProgress(p, stepCount) + 1e-9) + 1);
}

/** Zusammenhängende Kapitel-Abschnitte der Schrittfolge: [{ phase, title, first, count }] */
export function phaseSegments(result) {
  const segments = [];
  for (const step of result.steps) {
    const last = segments[segments.length - 1];
    if (last && last.phase === step.phase) last.count += 1;
    else segments.push({ phase: step.phase, title: result.phases[step.phase]?.title ?? '', first: step.index, count: 1 });
  }
  return segments;
}

/** Wie weit ein Kapitel-Abschnitt gefüllt ist (0 … 1) bei Fortschritt p. */
export function segmentFill(segment, p) {
  return Math.min(1, Math.max(0, (p - segment.first) / segment.count));
}

/** Kapitel-Nummer (1-basiert) eines Schritts unter den Kapiteln, die Schritte haben. */
export function phaseNumber(result, phaseIndex) {
  let number = 0;
  for (let i = 0; i <= phaseIndex && i < result.phases.length; i++) if (result.phases[i].steps.length) number += 1;
  return number;
}

export function phaseCount(result) {
  return result.phases.filter((phase) => phase.steps.length > 0).length;
}

/** Text für die Live-Region und den Schieberegler. */
export function stepAnnouncement(result, p) {
  const n = result.steps.length;
  if (n === 0) return 'Der Bau hat keine Schritte.';
  const shown = shownStep(p, n);
  if (shown < 0) return `Start – noch kein Block gesetzt. ${formatNumber(n)} Schritte.`;
  const step = result.steps[shown];
  const phase = result.phases[step.phase];
  const done = p >= n ? ' Der Bau ist fertig.' : '';
  return `Schritt ${formatNumber(shown + 1)} von ${formatNumber(n)}: ${step.title}${phase ? ` (${phase.title})` : ''}.${done}`;
}

/** Anleitungstext eines Schritts: eigener Text, sonst bei Ebenen-Schritten eine kurze Bauanweisung. */
export function stepInstruction(result, index) {
  const step = result.steps[index];
  if (!step) return '';
  if (step.text) return step.text;
  if (step.layerY !== null && step.layerY !== undefined) {
    const where = `der Ebene ${formatNumber(step.layerY + 1)} (y = ${formatNumber(step.layerY)})`;
    return step.blockCount === 1 ? `Setze den einen Block ${where}.` : `Setze alle ${formatNumber(step.blockCount)} Blöcke ${where}.`;
  }
  return '';
}

/** Markierungen (b.note) je Schritt: Map<step, note[]> */
export function notesByStep(result) {
  const map = new Map();
  for (const note of result.notes ?? []) {
    if (!Number.isInteger(note.step)) continue;
    if (!map.has(note.step)) map.set(note.step, []);
    map.get(note.step).push(note);
  }
  return map;
}

/**
 * Häufigste Ebene (Block-y) der Blöcke eines Schritts; Ebenen-Schritte liefern ihr layerY.
 * Ergebnis null, wenn der Schritt keine Blöcke hat. Durchläuft dafür die Chunks des Volumens.
 */
export function dominantLayer(result, index) {
  const step = result.steps[index];
  if (!step) return null;
  if (step.layerY !== null && step.layerY !== undefined) return step.layerY;
  const counts = new Map();
  for (const chunk of result.volume.chunks.values()) {
    const { blocks, steps } = chunk;
    for (let i = 0; i < 4096; i++) {
      if (blocks[i] === 0 || steps[i] !== index) continue;
      const y = chunk.cy * 16 + (i >> 8);
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  let best = null;
  let bestCount = 0;
  for (const [y, count] of counts) {
    if (count > bestCount || (count === bestCount && y < best)) {
      best = y;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Sollen Tastenkürzel des Players greifen? Nicht in Eingabefeldern, nicht im Lauf-Modus, nicht bei Tasten,
 * die das fokussierte Element selbst braucht (Leertaste auf Knöpfen, Pfeile in Tabs, Regler, 3D-Ansicht, Plan).
 */
export function shortcutAllowed({ key, target, defaultPrevented = false, altKey = false, ctrlKey = false, metaKey = false }, { walkMode = false } = {}) {
  if (defaultPrevented || walkMode || altKey || ctrlKey || metaKey) return false;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', ' '].includes(key)) return false;
  if (!target || typeof target.closest !== 'function') return true;
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="tablist"], [role="slider"], [role="listbox"], [role="menu"], canvas, [data-keys="own"]')) return false;
  if (key === ' ' && target.closest('button, a[href], summary, [role="button"], [role="tab"]')) return false;
  return true;
}
