// Freitext → Bau aus dem Katalog, Form oder ehrlich „nicht gefunden“ (ARCHITEKTUR §12.1). Keine KI, nichts erfunden.
// Rein: kein DOM, läuft in Browser, Worker und Node.

import { normalize, tokenize, searchCatalog, catalogEntries, STOPWORDS, MATCH_THRESHOLD, SUGGEST_THRESHOLD } from './search.js';
import { findBlocks, blockForText, blockDisplayName, blockDisplayLabel, isShapeFriendly, stairsFor, MATERIAL_DEFAULTS } from './block-lookup.js';
import { SHAPES, getShape, validateShapeParams, shapeQueryString } from './shape-generators.js';

export const MAX_REQUEST_LENGTH = 200;
const RELATIVE_CUT = 0.7;
const MAX_MATCHES = 8;

export const NONE_HINTS = Object.freeze([
  'Mit dem Formen-Generator baust du Grundformen wie Kugel, Turm, Kuppel oder Pyramide – zum Beispiel „hohle Kugel Radius 15 aus Glas“.',
  'Hast du eine Bauplan-Datei (.schem, .litematic, .nbt) oder ein 3D-Modell (.stl, .obj, .glb, .vox)? Dann kannst du sie importieren.',
]);

// ------------------------------------------------------------------ Eingabe bereinigen

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const INVISIBLE = /[\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g;

/** Bereinigt die Eingabe: Text, Steuerzeichen raus, Leerraum zusammengefasst, höchstens 200 Zeichen → { text, truncated }. */
export function cleanRequest(raw) {
  if (typeof raw !== 'string') return { text: '', truncated: false };
  const cleaned = raw.slice(0, 4000).normalize('NFC').replace(INVISIBLE, '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(cleaned);
  return { text: chars.slice(0, MAX_REQUEST_LENGTH).join('').trim(), truncated: chars.length > MAX_REQUEST_LENGTH };
}

const UMLAUTS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

// Wie normalize(), behält aber : % = x und Dezimalpunkte zwischen Ziffern (für Maßstab und Maße)
function foldForParse(text) {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c])
    .replace(/[×✕]/g, 'x')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/(\d)[,.](\d)/g, '$1.$2')
    .replace(/[^a-z0-9:%=.]+/g, ' ')
    .replace(/(^|[^\d])\.|\.(?!\d)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------ Maßstab

/** „1:1“, 0.5 → „1:2“, 2 → „2:1“. */
export function formatScale(scale) {
  if (!(scale > 0)) return '';
  if (scale >= 1) return `${Math.round(scale * 100) / 100}:1`;
  return `1:${Math.round((1 / scale) * 100) / 100}`;
}

const GROESSE = 'gro(?:e)?ss(?:e|en)?';
const SCALE_PATTERNS = [
  { re: /\b1\s*block\s*(?:(?:=|ist|pro|fuer|entspricht|je|gleich)\s*(?:(?:1|ein|einem|einen)\s*)?|(?:1|ein|einem|einen)\s*)(?:m|meter)\b/g, value: () => 1 },
  { re: /(?:\b(?:im|in)\s+)?(?:\bmassstab\s*(?:von\s*)?)?\b(\d{1,4}(?:\.\d{1,3})?)\s*(?::|\bzu\b)\s*(\d{1,4}(?:\.\d{1,3})?)\b/g, value: (m) => Number(m[1]) / Number(m[2]) },
  { re: /\b(\d{1,3}(?:\.\d{1,2})?)\s*(?:%|\bprozent\b)/g, value: (m) => Number(m[1]) / 100 },
  { re: new RegExp(`\\b(?:in\\s+)?(?:original\\s*${GROESSE}|originalmassstab|echter?n?\\s*${GROESSE}|realgroesse|lebensgross(?:e)?|in\\s+echt)\\b`, 'g'), value: () => 1 },
  { re: new RegExp(`\\b(?:in\\s+)?(?:halber?n?\\s*${GROESSE}|halb\\s+so\\s+gross|haelfte|halbgross)\\b`, 'g'), value: () => 0.5 },
  { re: new RegExp(`\\b(?:ein\\s+|in\\s+)?(?:viertel\\s*${GROESSE}|viertel)\\b`, 'g'), value: () => 0.25 },
  { re: new RegExp(`\\b(?:ein\\s+|in\\s+)?(?:drittel\\s*${GROESSE}|drittel)\\b`, 'g'), value: () => 1 / 3 },
];

/** Sucht Maßstabsangaben im (gefalteten) Text → { scale, scaleText, conflict, rest } (scale null = keine Angabe). */
export function extractScale(folded) {
  let rest = folded;
  const found = [];
  for (const { re, value } of SCALE_PATTERNS) {
    re.lastIndex = 0;
    rest = rest.replace(re, (...args) => {
      const v = value(args);
      if (Number.isFinite(v) && v > 0 && v <= 16) found.push(v);
      return ' ';
    });
  }
  rest = rest.replace(/\s+/g, ' ').trim();
  if (!found.length) return { scale: null, scaleText: null, conflict: false, rest };
  const scale = found[0];
  const conflict = found.some((v) => Math.abs(v - scale) > 1e-9);
  return { scale, scaleText: formatScale(scale), conflict, rest };
}

function chooseScale(entry, requested) {
  const scales = Array.isArray(entry.scales) ? entry.scales.filter((s) => typeof s === 'number' && s > 0) : [];
  const fallback = typeof entry.defaultScale === 'number' ? entry.defaultScale : scales[0] ?? null;
  if (requested === null) return { scale: fallback, note: null };
  if (!scales.length) {
    return { scale: null, note: `„${entry.title}“ gibt es nur in einer Größe – die Angabe ${formatScale(requested)} habe ich nicht verwendet.` };
  }
  const exact = scales.find((s) => Math.abs(s - requested) < 1e-9);
  if (exact !== undefined) return { scale: exact, note: null };
  const nearest = scales.reduce((best, s) => (Math.abs(Math.log(s / requested)) < Math.abs(Math.log(best / requested)) ? s : best));
  return { scale: nearest, note: `${formatScale(requested)} gibt es für „${entry.title}“ nicht – ich nehme den nächsten möglichen Maßstab ${formatScale(nearest)} (möglich: ${scales.map(formatScale).join(', ')}).` };
}

// ------------------------------------------------------------------ Formen erkennen

// Schlüsselwort → Form. ambiguous: kann auch ein Bau aus dem Katalog gemeint sein. preset: Voreinstellungen.
const SHAPE_WORDS = new Map([
  ['kugel', { shape: 'sphere' }], ['kugeln', { shape: 'sphere' }], ['sphere', { shape: 'sphere' }], ['sphaere', { shape: 'sphere' }], ['ball', { shape: 'sphere' }],
  ['kuppel', { shape: 'dome' }], ['kuppeln', { shape: 'dome' }], ['halbkugel', { shape: 'dome' }], ['dome', { shape: 'dome' }],
  ['zylinder', { shape: 'cylinder' }], ['cylinder', { shape: 'cylinder' }],
  ['turm', { shape: 'cylinder', ambiguous: true, preset: { hollow: true } }], ['tower', { shape: 'cylinder', ambiguous: true, preset: { hollow: true } }],
  ['rundturm', { shape: 'cylinder', preset: { hollow: true } }],
  ['saeule', { shape: 'cylinder', preset: { hollow: false } }], ['saeulen', { shape: 'cylinder', preset: { hollow: false } }], ['pillar', { shape: 'cylinder', preset: { hollow: false } }],
  ['roehre', { shape: 'cylinder', preset: { hollow: true } }], ['rohr', { shape: 'cylinder', preset: { hollow: true } }],
  ['kegel', { shape: 'cone' }], ['cone', { shape: 'cone' }],
  ['pyramide', { shape: 'pyramid', ambiguous: true }], ['pyramid', { shape: 'pyramid', ambiguous: true }],
  ['wuerfel', { shape: 'cube' }], ['cube', { shape: 'cube' }],
  ['quader', { shape: 'cuboid' }], ['cuboid', { shape: 'cuboid' }], ['kasten', { shape: 'cuboid' }], ['box', { shape: 'cuboid' }],
  ['ellipsoid', { shape: 'ellipsoid' }], ['ellipsoide', { shape: 'ellipsoid' }],
  ['torus', { shape: 'torus' }], ['donut', { shape: 'torus' }], ['ring', { shape: 'torus', ambiguous: true }],
  ['kreis', { shape: 'circle' }], ['kreisring', { shape: 'circle', preset: { hollow: true } }], ['scheibe', { shape: 'circle', preset: { hollow: false } }],
  ['circle', { shape: 'circle' }], ['disc', { shape: 'circle', preset: { hollow: false } }],
  ['bogen', { shape: 'arch', ambiguous: true }], ['torbogen', { shape: 'arch' }], ['rundbogen', { shape: 'arch' }], ['arch', { shape: 'arch', ambiguous: true }],
  ['wendeltreppe', { shape: 'spiral-stairs' }], ['spiraltreppe', { shape: 'spiral-stairs' }], ['wendeltreppen', { shape: 'spiral-stairs' }],
]);

const NUMBER_WORDS = {
  zwei: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12,
  fuenfzehn: 15, zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50, sechzig: 60, hundert: 100,
};

const UNIT = '(?:\\s*(?:bloecke|bloecken|block|meter|m))?';
const NUM = '(\\d{1,5})';
const SEP = '\\s*(?:=|:|von|mit)?\\s*';

// Schlüssel-Maße: [Name, Muster „Zahl vor Wort“, Muster „Wort vor Zahl“]
const MEASURES = [
  ['radius', null, `\\b(?:radius|halbmesser)${SEP}${NUM}${UNIT}\\b|\\br\\s*[=:]?\\s*${NUM}\\b`],
  ['tube', null, `\\b(?:roehrenradius|rohrradius|roehre|tube)${SEP}${NUM}${UNIT}\\b`],
  ['diameter', `\\b${NUM}${UNIT}\\s*(?:durchmesser)\\b`, `\\b(?:durchmesser|diameter)${SEP}${NUM}${UNIT}\\b|\\b(?:d|oe)\\s*[=:]\\s*${NUM}\\b`],
  ['height', `\\b${NUM}${UNIT}\\s*(?:hoch|hohe|hoher|hohes|hohen)\\b`, `\\b(?:hoehe|height)${SEP}${NUM}${UNIT}\\b|\\bh\\s*[=:]\\s*${NUM}\\b`],
  ['width', `\\b${NUM}${UNIT}\\s*(?:breit|breite|breiter|breites|breiten|weit)\\b`, `\\b(?:breite|width)${SEP}${NUM}${UNIT}\\b|\\bb\\s*[=:]\\s*${NUM}\\b`],
  ['length', `\\b${NUM}${UNIT}\\s*(?:lang|lange|langer|langes|tief|tiefe|tiefer)\\b`, `\\b(?:laenge|length|tiefe|depth)${SEP}${NUM}${UNIT}\\b|\\bl\\s*[=:]\\s*${NUM}\\b`],
  ['thickness', `\\b${NUM}${UNIT}\\s*(?:dick|dicke|dicker|dicken|stark|starke)\\b`, `\\b(?:dicke|wandstaerke|wanddicke|staerke|thickness)${SEP}${NUM}${UNIT}\\b`],
  ['size', null, `\\b(?:kantenlaenge|kante|seitenlaenge|groesse|size)${SEP}${NUM}${UNIT}\\b`],
];

const MEASURE_LABELS = { radius: 'Radius', tube: 'Röhrenradius', diameter: 'Durchmesser', height: 'Höhe', width: 'Breite', length: 'Länge', thickness: 'Dicke', size: 'Kantenlänge' };

const FLAGS = [
  ['hollow', true, /\b(?:hohl|hohle|hohlen|hohler|hohles|hollow|leer|leere|leeren)\b/g],
  ['hollow', false, /\b(?:voll|volle|vollen|voller|volles|massiv|massive|massiven|massiver|massives|gefuellt|gefuellte|gefuellten|gefuellter|ausgefuellt|solid)\b/g],
  ['floor', true, /\bmit\s+(?:einem\s+)?boden\b/g],
  ['battlements', true, /\b(?:mit\s+)?zinnen\b/g],
  ['roof', 'cone', /\b(?:mit\s+)?(?:spitzdach|kegeldach|spitzem\s+dach|spitzen\s+dach|turmspitze)\b/g],
  ['roof', 'dome', /\b(?:mit\s+)?(?:kuppeldach|kuppel\s+als\s+dach)\b/g],
  ['roof', 'flat', /\b(?:mit\s+)?(?:flachdach|flachem\s+dach|flachen\s+dach)\b/g],
  ['roof', 'cone', /\bmit\s+(?:einem\s+)?dach\b/g],
  ['clockwise', false, /\b(?:gegen\s+den\s+uhrzeigersinn|linksherum|links\s+herum|linksdrehend)\b/g],
  ['clockwise', true, /\b(?:im\s+uhrzeigersinn|rechtsherum|rechts\s+herum|rechtsdrehend)\b/g],
  ['wall', 'auto', /\bmit\s+(?:einer\s+)?(?:aussenwand|wand|mauer)\b/g],
];

const FLAG_TEXTS = {
  hollow: (v) => (v ? 'hohl' : 'voll'),
  floor: () => 'mit Boden',
  battlements: () => 'mit Zinnen',
  roof: (v) => `Dach: ${{ cone: 'Kegeldach', dome: 'Kuppeldach', flat: 'Flachdach' }[v]}`,
  clockwise: (v) => (v ? 'im Uhrzeigersinn' : 'gegen den Uhrzeigersinn'),
  wall: () => 'mit Außenwand',
};

// Wörter vor „aus …“, die das Material einem anderen Teil zuordnen
const MATERIAL_TARGETS = new Map([
  ['dach', 'roofBlock'], ['kegeldach', 'roofBlock'], ['spitzdach', 'roofBlock'], ['kuppeldach', 'roofBlock'], ['flachdach', 'roofBlock'],
  ['wand', 'wall'], ['aussenwand', 'wall'], ['mauer', 'wall'], ['mittelsaeule', 'core'], ['saeule', 'core'], ['kern', 'core'],
]);

// Wörter, die weder Bau noch Form tragen und darum nicht als „nicht verwendet“ gemeldet werden
const FILLER = new Set(['bloecke', 'bloecken', 'block', 'meter', 'm', 'gross', 'grosse', 'grossen', 'grosser', 'grosses', 'form', 'einfach', 'einfache',
  'einfachen', 'schoen', 'schoene', 'schoenen', 'runde', 'runden', 'runder', 'rundes', 'rund', 'neue', 'neuen', 'neuer', 'neues']);

class Scanner {
  constructor(text) {
    this.text = text;
    this.used = new Uint8Array(text.length);
  }

  // Treffer eines Musters, die noch frei sind; markiert sie als verbraucht
  take(re, onMatch) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(this.text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      if (this.isUsed(m.index, m.index + m[0].length)) continue;
      if (onMatch(m) !== false) this.mark(m.index, m.index + m[0].length);
    }
  }

  isUsed(start, end) {
    for (let i = start; i < end; i++) if (this.used[i]) return true;
    return false;
  }

  mark(start, end) {
    this.used.fill(1, start, end);
  }

  // freie Wörter mit Position
  freeWords() {
    const words = [];
    const re = /[a-z0-9:%=.]+/g;
    let m;
    while ((m = re.exec(this.text)) !== null) {
      if (!this.isUsed(m.index, m.index + m[0].length)) words.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    }
    return words;
  }
}

function replaceNumberWords(text) {
  return text.replace(/\b[a-z]+\b/g, (word) => (Object.hasOwn(NUMBER_WORDS, word) ? String(NUMBER_WORDS[word]) : word));
}

// Form-Schlüsselwort suchen (eindeutige Wörter vor mehrdeutigen), auch als Wortende mit Material („glaskugel“, „steinturm“)
function detectShape(scanner, lookupOptions) {
  const words = scanner.freeWords();
  let best = null;
  for (const item of words) {
    const direct = SHAPE_WORDS.get(item.word);
    if (direct) {
      const candidate = { ...direct, word: item.word, start: item.start, end: item.end, material: null };
      if (!best || (best.ambiguous && !candidate.ambiguous)) best = candidate;
      continue;
    }
    for (const [keyword, info] of SHAPE_WORDS) {
      if (keyword.length < 4 || !item.word.endsWith(keyword) || item.word.length - keyword.length < 3) continue;
      const prefix = item.word.slice(0, -keyword.length);
      const material = materialFromCompound(prefix, lookupOptions);
      if (!material) continue;
      const candidate = { ...info, ambiguous: false, word: item.word, start: item.start, end: item.end, material, materialText: prefix };
      if (!best || best.ambiguous) best = candidate;
      break;
    }
  }
  if (best) scanner.mark(best.start, best.end);
  return best;
}

// Vorderteil eines zusammengesetzten Worts als Material – nur eindeutige, volle Blöcke („Glas“, „Stein“, „Holz“)
function materialFromCompound(prefix, { names, blocks }) {
  if (Object.hasOwn(MATERIAL_DEFAULTS, prefix)) return MATERIAL_DEFAULTS[prefix];
  const [best] = findBlocks(prefix, { names, blocks, limit: 1 });
  return best && best.score >= 0.9 && best.full ? best.id : null;
}

function extractMeasures(scanner) {
  const values = {};
  const texts = {};
  const add = (key, raw, matchText) => {
    const n = Number(raw);
    if (!Number.isInteger(n)) return;
    if (values[key] === undefined) {
      values[key] = n;
      texts[key] = matchText.trim();
    }
  };
  scanner.take(/\b(\d{1,5})\s*x\s*(\d{1,5})(?:\s*x\s*(\d{1,5}))?\b/g, (m) => {
    values.dims = m.slice(1).filter((v) => v !== undefined).map(Number);
  });
  for (const [key, before, after] of MEASURES) {
    for (const pattern of [after, before]) {
      if (!pattern) continue;
      scanner.take(new RegExp(pattern, 'g'), (m) => add(key, m.slice(1).find((v) => v !== undefined), m[0]));
    }
  }
  const bare = [];
  scanner.take(/\b\d{1,5}\b/g, (m) => {
    bare.push(Number(m[0]));
  });
  return { values, texts, bare };
}

function extractFlags(scanner) {
  const flags = {};
  for (const [key, value, re] of FLAGS) {
    scanner.take(re, () => {
      if (flags[key] === undefined) flags[key] = value;
    });
  }
  return flags;
}

// „aus <Material>“ (auch „Dach aus …“, „Wand aus …“) → [{ target, id, text, found }]
function extractMaterials(scanner, lookupOptions) {
  const out = [];
  const words = scanner.freeWords();
  for (let i = 0; i < words.length; i++) {
    if (words[i].word !== 'aus' && words[i].word !== 'of') continue;
    // Wort direkt davor (auch schon verbraucht, z. B. „mit Dach“) bestimmt, wofür das Material gilt
    const before = /([a-z]+)\s*$/.exec(scanner.text.slice(0, words[i].start));
    const target = before && MATERIAL_TARGETS.has(before[1]) ? MATERIAL_TARGETS.get(before[1]) : 'block';
    if (before && target !== 'block') scanner.mark(before.index, before.index + before[1].length);
    const phrase = [];
    for (let j = i + 1; j < words.length && phrase.length < 4; j++) {
      const w = words[j];
      if (w.start !== (j === i + 1 ? words[i].end + 1 : words[j - 1].end + 1) || /^\d/.test(w.word) || w.word === 'aus' || w.word === 'mit' || w.word === 'und') break;
      phrase.push(w);
    }
    if (!phrase.length) continue;
    let found = null;
    for (let n = phrase.length; n >= 1 && !found; n--) {
      const part = phrase.slice(0, n);
      const text = part.map((p) => p.word).join(' ');
      const id = blockForText(text, lookupOptions);
      if (id) found = { id, used: part, text };
    }
    if (found) {
      scanner.mark(words[i].start, found.used[found.used.length - 1].end);
      out.push({ target, id: found.id, text: found.text, found: true });
    } else {
      const text = phrase.slice(0, Math.min(phrase.length, 3)).map((p) => p.word).join(' ');
      scanner.mark(words[i].start, phrase[Math.min(phrase.length, 3) - 1].end);
      out.push({ target, id: null, text, found: false });
    }
  }
  return out;
}

// Rohwerte → Parameter der Form, mit Texten für „verstanden“ und Warnungen
function assignShapeParams(shapeId, measures, flags, materials, preset, lookupOptions) {
  const shape = SHAPES[shapeId];
  const keys = new Set(shape.params.map((p) => p.key));
  const params = {};
  const understood = [`Form: ${shape.title}`];
  const warnings = [];
  const used = new Set();
  const { values, texts, bare } = measures;
  const set = (key, value, text) => {
    if (!keys.has(key) || params[key] !== undefined) return false;
    params[key] = value;
    if (text) understood.push(text);
    return true;
  };
  const useMeasure = (from, to, convert = (v) => v, describe = null) => {
    if (values[from] === undefined || used.has(from)) return;
    const value = convert(values[from]);
    if (set(to, value, describe ? describe(values[from], value) : `${paramLabel(shapeId, to)} ${value}`)) used.add(from);
  };
  const diameterFromRadius = (r) => 2 * r + 1;
  const radiusText = (r, d) => `${paramLabel(shapeId, 'diameter')} ${d} (aus Radius ${r})`;

  // Maße nach Form zuordnen
  if (values.dims) {
    const [a, b, c] = values.dims;
    if (shapeId === 'cuboid' || shapeId === 'ellipsoid') {
      set('width', a, `Breite ${a}`);
      set('height', b, `Höhe ${b}`);
      if (c !== undefined) set('length', c, `Länge ${c}`);
      else warnings.push(`„${a}x${b}“: Die Länge fehlt – ich nehme den Standardwert.`);
    } else if (shapeId === 'arch') {
      set('width', a, `Breite ${a}`);
      set('height', b, `Höhe ${b}`);
      if (c !== undefined) set('depth', c, `Tiefe ${c}`);
    } else if (shapeId === 'cube' && values.dims.every((v) => v === a)) {
      set('size', a, `Kantenlänge ${a}`);
    } else {
      warnings.push(`Die Maße ${values.dims.join(' × ')} passen nicht zu ${shape.title} und wurden nicht verwendet.`);
    }
  }
  switch (shapeId) {
    case 'sphere': case 'dome': case 'circle':
      useMeasure('diameter', 'diameter');
      useMeasure('radius', 'diameter', diameterFromRadius, radiusText);
      useMeasure('width', 'diameter');
      break;
    case 'cylinder': case 'cone':
      useMeasure('diameter', 'diameter');
      useMeasure('radius', 'diameter', diameterFromRadius, radiusText);
      useMeasure('width', 'diameter');
      useMeasure('height', 'height');
      break;
    case 'pyramid':
      useMeasure('width', 'width');
      useMeasure('size', 'width');
      useMeasure('diameter', 'width');
      useMeasure('height', 'width', (h) => 2 * h - 1, (h, w) => `Breite ${w} (aus Höhe ${h})`);
      break;
    case 'cube':
      for (const key of ['size', 'width', 'height', 'length']) useMeasure(key, 'size');
      break;
    case 'cuboid':
      useMeasure('width', 'width');
      useMeasure('height', 'height');
      useMeasure('length', 'length');
      if (values.size !== undefined && !used.has('size')) {
        for (const key of ['width', 'height', 'length']) set(key, values.size, null);
        understood.push(`Kantenlänge ${values.size}`);
        used.add('size');
      }
      break;
    case 'ellipsoid':
      useMeasure('width', 'width');
      useMeasure('height', 'height');
      useMeasure('length', 'length');
      break;
    case 'torus':
      useMeasure('radius', 'radius');
      useMeasure('tube', 'tube');
      useMeasure('thickness', 'tube', (t) => Math.max(1, Math.round((t - 1) / 2)), (t, r) => `Röhrenradius ${r} (aus Dicke ${t})`);
      useMeasure('diameter', 'radius', (d) => Math.max(2, Math.floor((d - 1) / 2)), (d, r) => `Ringradius ${r} (aus Durchmesser ${d})`);
      break;
    case 'arch':
      useMeasure('width', 'width');
      useMeasure('height', 'height');
      useMeasure('length', 'depth');
      break;
    case 'spiral-stairs':
      useMeasure('height', 'height');
      useMeasure('radius', 'radius');
      useMeasure('width', 'radius', (w) => Math.max(1, Math.floor((w - 1) / 2)), (w, r) => `Abstand zur Mitte ${r} (aus Breite ${w})`);
      useMeasure('diameter', 'radius', (d) => Math.max(1, Math.floor((d - 1) / 2)), (d, r) => `Abstand zur Mitte ${r} (aus Durchmesser ${d})`);
      break;
    default:
      break;
  }
  if (keys.has('thickness')) useMeasure('thickness', 'thickness');
  for (const key of Object.keys(values)) {
    if (key !== 'dims' && !used.has(key)) warnings.push(`„${texts[key]}“ passt nicht zu ${shape.title} und wurde nicht verwendet.`);
  }

  // Zahlen ohne Wort: der Reihe nach auf die Hauptmaße
  const order = BARE_ORDER[shapeId] ?? [];
  const free = order.filter((key) => params[key] === undefined);
  bare.forEach((n, i) => {
    if (i < free.length) {
      params[free[i]] = n;
      understood.push(`„${n}“ als ${paramLabel(shapeId, free[i])} verstanden`);
    } else {
      warnings.push(`Die Zahl ${n} konnte ich keinem Maß zuordnen.`);
    }
  });

  // Schalter
  for (const [key, value] of Object.entries({ ...preset, ...flags })) {
    if (!keys.has(key)) {
      if (Object.hasOwn(flags, key)) warnings.push(`„${FLAG_TEXTS[key](value)}“ gibt es bei ${shape.title} nicht.`);
      continue;
    }
    if (key === 'wall') continue;
    params[key] = value;
    if (Object.hasOwn(flags, key)) understood.push(FLAG_TEXTS[key](value));
  }

  // Material
  const { names } = lookupOptions;
  for (const material of materials) {
    if (!material.found) {
      const suggestions = findBlocks(material.text, { ...lookupOptions, limit: 3 }).map((s) => s.name);
      warnings.push(`Den Block „${material.text}“ habe ich nicht gefunden${suggestions.length ? ` (meintest du ${suggestions.map((s) => `„${s}“`).join(', ')}?)` : ''} – es bleibt beim Standard.`);
      continue;
    }
    let target = material.target;
    if (!keys.has(target)) target = 'block';
    if (shapeId === 'spiral-stairs' && target === 'block') target = 'stairs';
    let id = material.id;
    if (target === 'stairs') {
      const stairs = stairsFor(id, lookupOptions);
      if (!stairs) {
        warnings.push(`Zu „${blockDisplayName(id, names)}“ gibt es keine Treppe – es bleibt bei ${blockDisplayName(paramDefault(shapeId, 'stairs'), names)}.`);
        continue;
      }
      id = stairs;
    }
    if (!keys.has(target)) {
      warnings.push(`Das Material „${material.text}“ passt nicht zu ${shape.title}.`);
      continue;
    }
    if (params[target] !== undefined && params[target] !== '') {
      warnings.push(`Mehr als ein Material angegeben – ich nehme ${blockDisplayName(params[target], names)}.`);
      continue;
    }
    params[target] = id;
    understood.push(`${paramLabel(shapeId, target)}: ${blockDisplayLabel(id, names)}`);
    if (target !== 'stairs' && !isShapeFriendly(id)) warnings.push(`${blockDisplayName(id, names)} ist kein voller Block – die Form kann löchrig oder ungewohnt aussehen.`);
  }
  if (params.roofBlock && params.roof === undefined) {
    params.roof = 'cone';
    understood.push('Dach: Kegeldach');
  }
  if (flags.wall && keys.has('wall') && !params.wall) {
    params.wall = 'stone_bricks';
    understood.push(`Außenwand: ${blockDisplayLabel('stone_bricks', names)}`);
  } else if (flags.wall && !keys.has('wall')) {
    warnings.push(`„mit Außenwand“ gibt es bei ${shape.title} nicht.`);
  }

  // Grenzen: zu große oder kleine Zahlen auf den erlaubten Bereich setzen und das sagen
  for (const param of shape.params) {
    if (param.type !== 'int' || params[param.key] === undefined) continue;
    const v = params[param.key];
    if (v > param.max) {
      params[param.key] = param.max;
      warnings.push(`${param.label} ${v} ist zu groß – höchstens ${param.max}. Ich nehme ${param.max}.`);
    } else if (v < param.min) {
      params[param.key] = param.min;
      warnings.push(`${param.label} ${v} ist zu klein – mindestens ${param.min}. Ich nehme ${param.min}.`);
    }
  }
  return { params, understood, warnings };
}

const BARE_ORDER = {
  sphere: ['diameter'], dome: ['diameter'], circle: ['diameter'],
  cylinder: ['height', 'diameter'], cone: ['height', 'diameter'],
  pyramid: ['width'], cube: ['size'], cuboid: ['width', 'height', 'length'], ellipsoid: ['width', 'height', 'length'],
  torus: ['radius', 'tube'], arch: ['width', 'height'], 'spiral-stairs': ['height', 'radius'],
};

function paramLabel(shapeId, key) {
  return SHAPES[shapeId].params.find((p) => p.key === key)?.label ?? MEASURE_LABELS[key] ?? key;
}

function paramDefault(shapeId, key) {
  return SHAPES[shapeId].params.find((p) => p.key === key)?.default;
}

function describeDefaults(shapeId, params, names) {
  const out = [];
  for (const param of SHAPES[shapeId].params) {
    if (params[param.key] !== undefined) continue;
    if (param.dependsOn && param.dependsOn !== 'roof' && params[param.dependsOn] === false) continue;
    if (param.type === 'int') out.push(`${param.label} ${param.default} (Standard)`);
    else if (param.type === 'block' && param.default) out.push(`${param.label}: ${blockDisplayName(param.default, names)} (Standard)`);
  }
  return out;
}

// ------------------------------------------------------------------ Hauptfunktion

function emptyNone(query, truncated, reason) {
  return { kind: 'none', query, suggestions: [], reason, hints: [...NONE_HINTS], truncated };
}

/**
 * Versteht eine Bau-Anfrage. Liefert genau eines von:
 *   { kind: 'build', query, matches: [{ entry, score, exact, scale }], scale, scaleText, notes, alternative, truncated }
 *     (exact: Titel, Alias oder ID entspricht der ganzen Anfrage; solche Treffer stehen vorn)
 *   { kind: 'shape', query, shape, title, params, understood, defaults, warnings, errors, ok, estimate, queryString, truncated }
 *   { kind: 'none', query, suggestions: [{ entry, score }], reason, hints, truncated }
 * Optionen: catalog (catalog.json), names (names.json), blocks (blocks.json).
 */
export function parseRequest(text, { catalog = null, names = null, blocks = null } = {}) {
  const { text: query, truncated } = cleanRequest(text);
  if (!query) return emptyNone('', truncated, 'Schreib, was du bauen möchtest – zum Beispiel „Tokyo Skytree“ oder „hohle Kugel Radius 15 aus Glas“.');
  const lookupOptions = { names, blocks };
  const entries = catalogEntries(catalog);

  const folded = replaceNumberWords(foldForParse(query));
  const scaleInfo = extractScale(folded);
  const scanner = new Scanner(scaleInfo.rest);
  const shapeHit = detectShape(scanner, lookupOptions);

  // Suchwörter für den Katalog: alles außer der Maßstabsangabe
  // Zahlen helfen bei Namen kaum („Turm 40“); nur behalten, wenn sonst nichts übrig ist
  const allTokens = tokenize(scaleInfo.rest);
  const wordTokens = allTokens.filter((t) => !/^\d+$/.test(t));
  const searchTokens = wordTokens.length ? wordTokens : allTokens;
  const results = entries.length && searchTokens.length
    ? searchCatalog(entries, searchTokens, { limit: MAX_MATCHES, threshold: MATCH_THRESHOLD, relative: RELATIVE_CUT })
    : [];

  if (shapeHit) {
    const measures = extractMeasures(scanner);
    const flags = extractFlags(scanner);
    const materials = extractMaterials(scanner, lookupOptions);
    if (shapeHit.material) materials.unshift({ target: 'block', id: shapeHit.material, text: shapeHit.materialText, found: true });
    const leftover = scanner.freeWords().map((w) => w.word).filter((w) => !STOPWORDS.has(w) && !FILLER.has(w) && !/^[\d:%=.]+$/.test(w));
    const hasParams = Object.keys(measures.values).length > 0 || measures.bare.length > 0 || Object.keys(flags).length > 0 || materials.length > 0;
    const top = results[0];
    const leftoverHitsCatalog = top && leftover.length > 0 && top.matched.some((m) => leftover.includes(m.token));
    const shapeResult = () => buildShapeResult(shapeHit, measures, flags, materials, leftover, query, truncated, scaleInfo, lookupOptions);
    if (leftoverHitsCatalog) return buildResult(results, scaleInfo, query, truncated, null);
    // nur „Turm“, „Pyramide“ …: Bauten aus dem Katalog zeigen, die Form als Alternative mitgeben
    if (shapeHit.ambiguous && !hasParams && results.length) {
      const alternative = shapeResult();
      return buildResult(results, scaleInfo, query, truncated, { kind: 'shape', shape: alternative.shape, params: alternative.params, queryString: alternative.queryString });
    }
    return shapeResult();
  }

  if (results.length) return buildResult(results, scaleInfo, query, truncated, null);

  const suggestions = entries.length && searchTokens.length
    ? searchCatalog(entries, searchTokens, { limit: 5, threshold: SUGGEST_THRESHOLD }).map(({ entry, score }) => ({ entry, score }))
    : [];
  const hasLetters = /[a-z]/.test(normalize(query));
  const reason = hasLetters
    ? `Für „${query}“ gibt es noch keinen geprüften Bauplan.`
    : `Mit „${query}“ kann ich nichts anfangen – schreib, was du bauen möchtest, zum Beispiel „Tokyo Skytree“ oder „Würfel 10“.`;
  return { kind: 'none', query, suggestions, reason, hints: [...NONE_HINTS], truncated };
}

function buildResult(results, scaleInfo, query, truncated, alternative) {
  const notes = [];
  if (scaleInfo.conflict) notes.push(`Du hast mehrere Maßstäbe angegeben – ich nehme ${scaleInfo.scaleText}.`);
  const matches = results.map(({ entry, score, exact }) => {
    const choice = chooseScale(entry, scaleInfo.scale);
    return { entry, score, exact: exact === true, scale: choice.scale, note: choice.note };
  });
  if (matches[0].note) notes.push(matches[0].note);
  if (truncated) notes.push(`Deine Eingabe war länger als ${MAX_REQUEST_LENGTH} Zeichen; ich habe nur den Anfang gelesen.`);
  const scale = matches[0].scale;
  return {
    kind: 'build',
    query,
    matches: matches.map(({ entry, score, exact, scale: s }) => ({ entry, score, exact, scale: s })),
    scale,
    scaleText: scale === null ? null : formatScale(scale),
    notes,
    alternative,
    truncated,
  };
}

function buildShapeResult(shapeHit, measures, flags, materials, leftover, query, truncated, scaleInfo, lookupOptions) {
  let shapeId = shapeHit.shape;
  const dims = measures.values.dims;
  // „Würfel 10x5x20“: ungleiche Kanten → Quader
  const switched = shapeId === 'cube' && dims && dims.length === 3 && !dims.every((v) => v === dims[0]);
  if (switched) shapeId = 'cuboid';
  const { params, understood, warnings } = assignShapeParams(shapeId, measures, flags, materials, shapeHit.preset ?? {}, lookupOptions);
  if (switched) warnings.unshift(`Ein Würfel hat gleich lange Kanten – mit ${dims.join(' × ')} wird es ein Quader.`);
  if (scaleInfo.scale !== null) warnings.push(`Eine Form hat keinen Maßstab – die Angabe ${scaleInfo.scaleText} habe ich nicht verwendet.`);
  if (leftover.length) warnings.push(`Diese Wörter habe ich nicht verwendet: ${leftover.map((w) => `„${w}“`).join(', ')}.`);
  if (truncated) warnings.push(`Deine Eingabe war länger als ${MAX_REQUEST_LENGTH} Zeichen; ich habe nur den Anfang gelesen.`);
  const defaults = describeDefaults(shapeId, params, lookupOptions.names);
  const check = validateShapeParams(shapeId, params, { blocks: lookupOptions.blocks });
  const finalParams = check.params ?? params;
  return {
    kind: 'shape',
    query,
    shape: shapeId,
    title: getShape(shapeId).title,
    params: finalParams,
    understood,
    defaults,
    warnings,
    errors: check.errors,
    ok: check.ok,
    estimate: check.estimate,
    queryString: shapeQueryString(shapeId, finalParams),
    truncated,
  };
}
