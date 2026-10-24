// Reine Hilfen der Seite „Selber erstellen“ (ohne DOM, in Node testbar): Adresse, Links, Beispiele,
// Datei-Vorprüfung, Einstellungen für 3D-Modelle, Einträge und Kennzahlen für die Bau-Ansicht.
import { cleanRequest, MAX_REQUEST_LENGTH } from '../../create/text-parser.js';
import { formatFromName, FORMAT_LABELS, IMPORT_LIMITS, MODEL_FORMATS, UPLOAD_ACCEPT } from '../../create/import/index.js';
import { SHAPES } from '../../create/shape-generators.js';
import { blockDisplayName } from '../../create/block-lookup.js';
import { scaleToken, formatScale } from '../build/entry.js';
import { formatNumber, formatSize, formatCount } from '../shared.js';

export { MAX_REQUEST_LENGTH };

/* ------------------------------------------------------------------ Bereiche (Tabs) und Adresse */

export const CREATE_TABS = Object.freeze(['idee', 'formen', 'import']);

/** „#formen“ → 'formen'; Unbekanntes → null */
export function tabFromHash(hash) {
  const key = typeof hash === 'string' ? hash.replace(/^#/, '').toLowerCase() : '';
  return CREATE_TABS.includes(key) ? key : null;
}

/** Freitext aus der Adresse (?q=…), bereinigt wie parseRequest (höchstens 200 Zeichen). */
export function requestFromSearch(search) {
  let raw = '';
  try {
    raw = new URLSearchParams(typeof search === 'string' ? search : '').get('q') ?? '';
  } catch {
    raw = '';
  }
  return cleanRequest(raw);
}

/** Adresse der Seite für einen Freitext: „erstellen.html?q=…“ (leer → ohne Parameter), dazu der Bereich als #… */
export function createHref(text, tab = null) {
  const { text: clean } = cleanRequest(text);
  const query = clean ? `?q=${encodeURIComponent(clean)}` : '';
  const hash = tab && CREATE_TABS.includes(tab) && tab !== 'idee' ? `#${tab}` : '';
  return `erstellen.html${query}${hash}`;
}

/** Link zur Bau-Seite: bau.html?id=<id>[&scale=<zahl>] */
export function buildHref(id, scale = null) {
  const base = `bau.html?id=${encodeURIComponent(id)}`;
  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0 ? `${base}&scale=${scaleToken(scale)}` : base;
}

/** Link zur Bau-Seite für eine Form (queryString aus shapeQueryString) */
export function shapeHref(queryString) {
  if (typeof queryString !== 'string' || !/^form=[a-z0-9-]{1,40}(?:&[a-zA-Z]+=[^&#]*)*$/.test(queryString)) {
    throw new TypeError('Ungültiger Formen-Link.');
  }
  return `bau.html?${queryString}`;
}

/** „Maßstab 1:1“ für Treffer mit Maßstab, sonst null */
export function scaleLabel(scale) {
  return typeof scale === 'number' && scale > 0 ? `Maßstab ${formatScale(scale)}` : null;
}

/* ------------------------------------------------------------------ Beispiele */

const SHAPE_EXAMPLES = Object.freeze([
  'hohle Kugel Radius 12 aus Glas',
  'Steinturm 30 hoch mit Zinnen und Kegeldach',
  'Pyramide 31 breit aus Sandstein',
  'Wendeltreppe 20 hoch aus Eichenholz',
]);

/**
 * Beispiel-Anfragen für die Chips: echte Bauten aus dem Katalog (ein Bau mit Maßstäben, ein Fantasy-Bau) und Formen.
 * Ohne Katalog nur Formen – so führt kein Beispiel ins Leere.
 */
export function pickExamples(catalog) {
  const builds = Array.isArray(catalog?.builds) ? catalog.builds : [];
  const examples = [];
  const scaled = builds.find((entry) => entry.id === 'tokyo-skytree' && entry.scales?.includes(1))
    ?? builds.find((entry) => entry.accuracy === 'massstab' && Array.isArray(entry.scales) && entry.scales.includes(1));
  if (scaled) examples.push({ label: `${scaled.title} 1:1`, query: `${scaled.title} Originalgröße 1:1` });
  const fantasy = builds.find((entry) => entry.id === 'infinity-castle') ?? builds.find((entry) => entry.category === 'fantasy');
  if (fantasy) examples.push({ label: fantasy.title, query: fantasy.title });
  for (const query of SHAPE_EXAMPLES) examples.push({ label: query, query });
  return examples.slice(0, 6);
}

/* ------------------------------------------------------------------ Datei-Import: Vorprüfung */

/** accept= des Datei-Felds: alle Import-Formate und dazu .mtl (Farben einer .obj) */
export const FILE_ACCEPT = `${UPLOAD_ACCEPT},.mtl`;

export const UNKNOWN_FORMAT_TEXT ='Unbekanntes Dateiformat. Unterstützt werden .schem, .litematic, .nbt (Strukturblock), .vox, .stl, .obj, .glb und .gltf.';
const MTL_PATTERN = /\.mtl$/i;

/** Bytes → „12,3 MB“ wie die Meldungen des Imports (de-DE, höchstens eine Nachkommastelle) */
export function formatMegabytes(bytes) {
  return `${formatNumber(bytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`;
}

/** Dateigröße zum Anzeigen: „812 Bytes“, „14 KB“, „3,4 MB“ */
export function fileSizeText(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${formatNumber(bytes)} Bytes`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return formatMegabytes(bytes);
}

/**
 * Prüft die gewählten Dateien vor dem Lesen (Typ und Größe). files: Liste von { name, size } (File-Objekte).
 * → { ok: true, file, format, mtl } | { ok: false, error }
 * Erlaubt ist genau eine Bau- oder Modelldatei; zu einer .obj darf zusätzlich eine .mtl kommen.
 */
export function checkSelectedFiles(files, { maxBytes = IMPORT_LIMITS.maxFileBytes } = {}) {
  const list = Array.from(files ?? []).filter((file) => file && typeof file.name === 'string');
  if (list.length === 0) return { ok: false, error: 'Keine Datei gewählt.' };
  const mtls = list.filter((file) => MTL_PATTERN.test(file.name));
  const others = list.filter((file) => !MTL_PATTERN.test(file.name));
  if (others.length === 0) return { ok: false, error: 'Eine .mtl-Datei enthält nur Farben. Wähle die passende .obj-Datei mit aus.' };
  if (others.length > 1) return { ok: false, error: 'Bitte nur eine Datei auf einmal wählen (zu einer .obj darf die .mtl dazu).' };
  const file = others[0];
  const format = formatFromName(file.name);
  if (!format) return { ok: false, error: UNKNOWN_FORMAT_TEXT };
  if (mtls.length > 1) return { ok: false, error: 'Bitte höchstens eine .mtl-Datei dazu wählen.' };
  if (mtls.length === 1 && format !== 'obj') return { ok: false, error: 'Eine .mtl-Datei passt nur zu einer .obj-Datei.' };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: 'Die Datei ist leer.' };
  if (file.size > maxBytes) {
    return { ok: false, error: `Die Datei ist zu groß (${formatMegabytes(file.size)}) – erlaubt sind höchstens ${formatNumber(maxBytes / 1024 / 1024)} MB.` };
  }
  const mtl = mtls[0] ?? null;
  if (mtl && mtl.size > maxBytes) return { ok: false, error: `Die .mtl-Datei ist zu groß (${formatMegabytes(mtl.size)}).` };
  return { ok: true, file, format, mtl };
}

export function isModelFormat(format) {
  return MODEL_FORMATS.includes(format);
}

export function formatLabel(format) {
  return Object.hasOwn(FORMAT_LABELS, format) ? FORMAT_LABELS[format] : 'Unbekanntes Format';
}

/* ------------------------------------------------------------------ Datei-Import: Einstellungen für 3D-Modelle */

export const MODEL_PALETTES = Object.freeze([
  { value: 'alle', label: 'Alle Blöcke', hint: 'Rund 260 Blöcke mit festen Farben – am genauesten.' },
  { value: 'beton', label: 'Beton', hint: '16 Betonfarben, sehr gleichmäßig.' },
  { value: 'wolle', label: 'Wolle', hint: '16 Wollfarben, weich und matt.' },
  { value: 'terrakotta', label: 'Terrakotta', hint: '17 Terrakotta-Töne, eher gedeckt.' },
  { value: 'einfarbig', label: 'Ein Block', hint: 'Das ganze Modell aus einem Block deiner Wahl.' },
]);
export const MODEL_UP_AXES = Object.freeze([
  { value: 'auto', label: 'Automatisch', hint: 'STL und .vox: z oben, OBJ und glTF: y oben.' },
  { value: 'y', label: 'y oben' },
  { value: 'z', label: 'z oben' },
]);
export const MODEL_HEIGHT = Object.freeze({ min: 1, max: 1024, default: 64 });

/** Standard-Einstellungen für ein Format (bei .vox die Originalgröße). */
export function defaultModelOptions(format) {
  return { keepSize: format === 'vox', height: MODEL_HEIGHT.default, solid: false, palette: 'alle', block: 'white_concrete', upAxis: 'auto' };
}

/**
 * Formular-Werte → params für viewer.load (Schlüssel wie normalizeParams im Voxelizer). Texte werden umgewandelt.
 * → { ok, params, errors }
 */
export function modelParams(format, options) {
  const raw = options ?? {};
  const errors = [];
  const params = {};
  const keepSize = format === 'vox' && raw.keepSize === true;
  if (!keepSize) {
    const height = typeof raw.height === 'number' ? raw.height : Number(String(raw.height ?? '').trim());
    if (!Number.isInteger(height) || height < MODEL_HEIGHT.min || height > MODEL_HEIGHT.max) {
      errors.push(`Höhe: bitte eine ganze Zahl von ${MODEL_HEIGHT.min} bis ${formatNumber(MODEL_HEIGHT.max)} Blöcken.`);
    } else {
      params.height = height;
    }
  }
  params.solid = raw.solid === true;
  const palette = MODEL_PALETTES.some((option) => option.value === raw.palette) ? raw.palette : null;
  if (!palette) errors.push('Palette: bitte eine der angebotenen Paletten wählen.');
  else params.palette = palette;
  if (palette === 'einfarbig') {
    const block = typeof raw.block === 'string' ? raw.block.trim().toLowerCase().replace(/^minecraft:/, '') : '';
    if (!/^[a-z0-9_]{1,64}$/.test(block)) errors.push('Block: bitte einen Block für das einfarbige Modell wählen.');
    else params.block = block;
  }
  const upAxis = MODEL_UP_AXES.some((option) => option.value === raw.upAxis) ? raw.upAxis : null;
  if (!upAxis) errors.push('Hochachse: bitte automatisch, y oder z wählen.');
  else params.upAxis = upAxis;
  return { ok: errors.length === 0, params: errors.length ? null : params, errors };
}

/* ------------------------------------------------------------------ Einträge für die Bau-Ansicht */

/** Dateiname ohne Endung als Titel (höchstens 120 Zeichen) */
export function titleFromFileName(name) {
  const base = String(name ?? '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  const withoutExt = base.replace(/\.[a-z0-9]{2,10}$/i, '').trim();
  return Array.from(withoutExt || base || 'Importierte Datei').slice(0, 120).join('');
}

/** Eintrag für eine importierte Datei (vor dem Laden bekannt: Name und Format) */
export function uploadEntry(name, format) {
  return {
    title: titleFromFileName(name),
    subtitle: `Importiert aus ${formatLabel(format)}`,
    accuracy: 'eigenes',
    tags: ['Import', isModelFormat(format) ? '3D-Modell' : 'Bauplan'],
  };
}

/** Kurzbeschreibung einer Form: „Durchmesser 25 · Glas · hohl“ */
export function shapeSummary(shapeId, params, names = null) {
  const shape = SHAPES[shapeId];
  if (!shape || !params) return '';
  const parts = [];
  for (const param of shape.params) {
    const value = params[param.key];
    if (param.dependsOn && !isParamActive(param, params)) continue;
    if (param.type === 'int') {
      if (param.key === 'thickness' && value === 1) continue;
      parts.push(`${param.label} ${formatNumber(value)}`);
    } else if (param.type === 'block') {
      if (value) parts.push(param.key === 'block' || param.key === 'stairs' ? blockDisplayName(value, names) : `${param.label}: ${blockDisplayName(value, names)}`);
    } else if (param.type === 'bool') {
      if (param.key === 'hollow') parts.push(value ? 'hohl' : 'voll');
      else if (value) parts.push(param.key === 'clockwise' ? 'im Uhrzeigersinn' : param.label);
      else if (param.key === 'clockwise') parts.push('gegen den Uhrzeigersinn');
    } else if (param.type === 'enum') {
      if (value !== 'none') parts.push(param.options.find((option) => option.value === value)?.label ?? String(value));
    }
  }
  return parts.join(' · ');
}

/** Ist ein abhängiges Feld aktiv? (dependsOn: true bei bool, nicht 'none'/'' bei anderen) */
export function isParamActive(param, params) {
  if (!param.dependsOn) return true;
  const value = params?.[param.dependsOn];
  return !(value === false || value === 'none' || value === '' || value === undefined || value === null);
}

/** Eintrag für eine Form */
export function shapeEntry(shapeId, params, names = null) {
  const shape = SHAPES[shapeId];
  return {
    title: shape ? shape.title : 'Form',
    subtitle: shapeSummary(shapeId, params, names) || (shape?.description ?? ''),
    accuracy: 'eigenes',
    tags: ['Form'],
    description: shape?.description ?? '',
  };
}

/** „bis zu 2.854 Blöcke“ (Schätzung als Obergrenze) */
export function estimateText(estimate) {
  return Number.isFinite(estimate) && estimate > 0 ? `bis zu ${formatCount(estimate, 'Block', 'Blöcke')}` : '–';
}

/**
 * Meldungen von validateShapeParams den Feldern zuordnen: „Durchmesser: …“ gehört zum Feld mit dem Label „Durchmesser“.
 * → { byKey: { key: [meldung] }, general: [meldung] }
 */
export function splitShapeMessages(shapeId, messages) {
  const shape = SHAPES[shapeId];
  const byKey = {};
  const general = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    if (typeof message !== 'string') continue;
    const param = shape?.params.find((candidate) => message.startsWith(`${candidate.label}: `));
    if (param) {
      const text = message.slice(param.label.length + 2);
      (byKey[param.key] ??= []).push(text.charAt(0).toUpperCase() + text.slice(1));
    }
    else general.push(message);
  }
  return { byKey, general };
}

/** Kennzahlen einer geprüften Form → [[Begriff, Wert, mono], …] */
export function shapeFacts(shapeId, params, estimate, { size = null, amount = null, names = null } = {}) {
  const shape = SHAPES[shapeId];
  if (!shape || !params) return [];
  const facts = [];
  if (Array.isArray(size)) facts.push(['Größe (B × H × L)', `${formatSize(size)} Blöcke`, true]);
  if (Array.isArray(size)) facts.push(['Ebenen', formatNumber(size[1]), true]);
  facts.push(['Blöcke (Schätzung)', estimateText(estimate), true]);
  if (amount) facts.push(['Das sind höchstens', amount, false]);
  const mainKey = shape.params.find((param) => param.type === 'block' && !param.optional)?.key;
  if (mainKey && params[mainKey]) facts.push(['Material', blockDisplayName(params[mainKey], names), false]);
  return facts;
}

/* ------------------------------------------------------------------ Ergebnis einer importierten Datei */

const COMPRESSION_LABELS = Object.freeze({ gzip: 'gzip', zlib: 'zlib', none: 'ungepackt' });

/** Kennzahlen aus result.upload für die Ergebnis-Übersicht → [[Begriff, Wert], …] (nur vorhandene Werte) */
export function uploadFacts(upload) {
  if (!upload || typeof upload !== 'object') return [];
  const facts = [];
  const text = (value, max = 120) => (typeof value === 'string' && value.trim() ? Array.from(value.trim()).slice(0, max).join('') : null);
  if (text(upload.formatLabel)) facts.push(['Format', text(upload.formatLabel)]);
  if (Array.isArray(upload.size)) facts.push(['Größe (B × H × L)', formatSize(upload.size)]);
  if (Number.isInteger(upload.blockCount)) facts.push(['Blöcke', formatNumber(upload.blockCount)]);
  if (Number.isInteger(upload.paletteSize)) facts.push(['Verschiedene Zustände', formatNumber(Math.max(0, upload.paletteSize - 1))]);
  if (Number.isInteger(upload.regions) && upload.regions > 1) facts.push(['Regionen', formatNumber(upload.regions)]);
  if (text(upload.title)) facts.push(['Name in der Datei', text(upload.title)]);
  if (text(upload.author)) facts.push(['Autor laut Datei', text(upload.author)]);
  if (Number.isInteger(upload.dataVersion)) facts.push(['Datenversion', String(upload.dataVersion)]);
  if (Number.isInteger(upload.fileBytes)) facts.push(['Dateigröße', fileSizeText(upload.fileBytes)]);
  if (Object.hasOwn(COMPRESSION_LABELS, upload.compression)) facts.push(['Packung', COMPRESSION_LABELS[upload.compression]]);
  if (upload.model && Number.isInteger(upload.model.triangles) && upload.model.triangles > 0) facts.push(['Dreiecke im Modell', formatNumber(upload.model.triangles)]);
  return facts;
}

/** Zusammenfassung der Anpassungen: „3 Blöcke umbenannt · 7 weggelassen · 2 Objekte nicht angezeigt“ → Liste von Texten */
export function uploadAdjustments(upload) {
  if (!upload || typeof upload !== 'object') return [];
  const sum = (list) => (Array.isArray(list) ? list.reduce((total, item) => total + (Number.isInteger(item?.[1]) ? item[1] : 0), 0) : 0);
  const out = [];
  const renamed = sum(upload.renamed);
  const dropped = sum(upload.dropped);
  if (renamed > 0) out.push({ kind: 'renamed', text: `${formatCount(renamed, 'Block', 'Blöcke')} auf 26.2-Namen umbenannt` });
  if (dropped > 0) out.push({ kind: 'dropped', text: `${formatCount(dropped, 'Block', 'Blöcke')} weggelassen (gibt es in 26.2 nicht)` });
  if (Number.isInteger(upload.fixedValues) && upload.fixedValues > 0) out.push({ kind: 'fixed', text: `${formatCount(upload.fixedValues, 'Wert', 'Werte')} auf Standard gesetzt` });
  if (Number.isInteger(upload.entities) && upload.entities > 0) out.push({ kind: 'entities', text: `${formatCount(upload.entities, 'Objekt', 'Objekte')} nicht angezeigt` });
  return out;
}

/* ------------------------------------------------------------------ Zuletzt genutzte Form (localStorage) */

export const SHAPE_STORAGE_KEY = 'bk:create:shape';

/** Gespeicherten Wert prüfen → { shape, raw } oder null (raw wird später mit validateShapeParams geprüft) */
export function readStoredShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.shape !== 'string' || !Object.hasOwn(SHAPES, value.shape)) return null;
  const raw = {};
  const input = value.raw && typeof value.raw === 'object' && !Array.isArray(value.raw) ? value.raw : {};
  for (const param of SHAPES[value.shape].params) {
    const item = input[param.key];
    if (typeof item === 'number' || typeof item === 'boolean' || (typeof item === 'string' && item.length <= 80)) raw[param.key] = item;
  }
  return { shape: value.shape, raw };
}
