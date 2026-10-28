// Gemeinsame Bausteine des Datei-Imports: Fehler mit deutscher Meldung, Grenzen, Block-Sammler je Kapitel.

export const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 64 * 1024 * 1024,
  maxUnpackedBytes: 256 * 1024 * 1024,
  maxBlocks: 3_000_000,
  maxEdge: 4064,
  maxDepth: 512,
});

/** Fehler für den User (Meldung ohne Stacktrace, Details in detail). code siehe ARCHITEKTUR §12.2. */
export class ImportError extends Error {
  constructor(code, message, { detail = null } = {}) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.detail = detail;
  }
}

export const formatInt = (n) => n.toLocaleString('de-DE');
export const formatMb = (bytes) => (bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 });

export function isCompound(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !ArrayBuffer.isView(value);
}

export function corrupt(what, detail = null) {
  return new ImportError('corrupt', `Die Datei ist beschädigt oder unvollständig (${what}).`, { detail });
}

/**
 * Text aus der Datei (Region-, Bau- oder Autorname) für die Anzeige: ohne Steuerzeichen, unsichtbare Zeichen und
 * Schreibrichtungs-Steuerung (die Text optisch verdrehen kann), gekürzt.
 */
export function cleanText(value, max = 80) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text === '') return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Ganze Zahl aus einem NBT-Wert (Byte/Short/Int; Long als BigInt im sicheren Bereich) oder null. */
export function intValue(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'bigint' && value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  return null;
}

export function listLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function tooManyBlocks(limits) {
  return new ImportError('too-many-blocks', `Der Bau hat mehr als ${formatInt(limits.maxBlocks)} Blöcke – so große Bauten kann die Seite nicht laden.`);
}

// Größe aus Anzahl und Ausdehnung; keine Blöcke oder zu lange Kanten → ImportError
function measuredSize(total, min, max, limits) {
  if (total === 0) {
    throw new ImportError('no-blocks', 'Die Datei enthält keine Blöcke, die es in Minecraft 26.2 gibt (nur Luft oder unbekannte Blöcke).');
  }
  const size = [0, 1, 2].map((a) => max[a] - min[a] + 1);
  if (size.some((edge) => edge > limits.maxEdge)) {
    throw new ImportError('too-big', `Der Bau ist ${size.map(formatInt).join(' × ')} Blöcke groß – jede Kante darf höchstens ${formatInt(limits.maxEdge)} Blöcke lang sein.`);
  }
  return size;
}

/**
 * Wie BlockCollector, merkt sich aber nur Anzahl und Ausdehnung (Prüfung einer Datei ohne Bau, z. B. für
 * „Meine Bauten“). Gleiche Grenzen und Fehler. finish() → { size, blockCount }
 */
export class BlockCounter {
  constructor(limits = IMPORT_LIMITS) {
    this.limits = limits;
    this.total = 0;
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
  }

  begin() {}

  push(x, y, z) {
    if (++this.total > this.limits.maxBlocks) throw tooManyBlocks(this.limits);
    if (x < this.min[0]) this.min[0] = x;
    if (y < this.min[1]) this.min[1] = y;
    if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x;
    if (y > this.max[1]) this.max[1] = y;
    if (z > this.max[2]) this.max[2] = z;
  }

  finish() {
    return { size: measuredSize(this.total, this.min, this.max, this.limits), blockCount: this.total };
  }
}

/**
 * Sammelt gesetzte Blöcke (Weltkoordinaten der Datei, auch negativ) in Kapiteln und prüft die Grenzen
 * (höchstens maxBlocks Blöcke, Kanten ≤ maxEdge). finish() verschiebt alles so, dass die kleinste Ecke bei 0 liegt.
 */
export class BlockCollector {
  constructor(limits = IMPORT_LIMITS) {
    this.limits = limits;
    this.parts = [];
    this.total = 0;
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
    this.current = null;
  }

  // Neues Kapitel, nur mit Titel
  begin(title) {
    this.current = { title, blocks: new Int32Array(4096 * 4), count: 0 };
    this.parts.push(this.current);
    return this.current;
  }

  push(x, y, z, index) {
    const part = this.current;
    if (++this.total > this.limits.maxBlocks) throw tooManyBlocks(this.limits);
    if (part.count * 4 === part.blocks.length) {
      const grown = new Int32Array(Math.min(part.blocks.length * 2, (this.limits.maxBlocks + 1) * 4));
      grown.set(part.blocks);
      part.blocks = grown;
    }
    const o = part.count * 4;
    part.blocks[o] = x;
    part.blocks[o + 1] = y;
    part.blocks[o + 2] = z;
    part.blocks[o + 3] = index;
    part.count++;
    if (x < this.min[0]) this.min[0] = x;
    if (y < this.min[1]) this.min[1] = y;
    if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x;
    if (y > this.max[1]) this.max[1] = y;
    if (z > this.max[2]) this.max[2] = z;
  }

  /** → { size, parts: [{ title, blocks: Int32Array (x, y, z, Palettenindex je Block), count }], blockCount } */
  finish() {
    const parts = this.parts.filter((part) => part.count > 0);
    const size = measuredSize(this.total, this.min, this.max, this.limits);
    const [mx, my, mz] = this.min;
    for (const part of parts) {
      const blocks = part.blocks.subarray(0, part.count * 4).slice();
      for (let o = 0; o < blocks.length; o += 4) {
        blocks[o] -= mx;
        blocks[o + 1] -= my;
        blocks[o + 2] -= mz;
      }
      part.blocks = blocks;
    }
    return { size, parts, blockCount: this.total, origin: [mx, my, mz] };
  }
}

/** Fortschritt höchstens alle ~2 Mio. Zellen melden (Rückruf ist optional). */
export function progressTicker(onProgress, label, total) {
  if (typeof onProgress !== 'function' || total < 2_000_000) return () => {};
  let next = 2_000_000;
  return (done) => {
    if (done < next) return;
    next = done + 2_000_000;
    onProgress(`${label} … ${Math.floor((done / total) * 100)} %`, done / total);
  };
}
