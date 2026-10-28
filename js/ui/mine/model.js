// Reine Hilfen für „Meine Bauten“ (ohne DOM, in Node testbar): Suche und Filter der Liste, Texte der Karten,
// Eintrag, Quelle und Fortschritts-Schlüssel für die Bau-Ansicht (bau.html?meine=<id>).
import { FORMAT_LABELS } from '../../create/import/index.js';
import { formatNumber, formatCount, CATEGORY_SLUGS } from '../shared.js';
import { isMyBuildId, myBuildProgressKey, cleanLine } from '../../data/my-builds.js';

/** Filterwert „ohne Kategorie“ (die übrigen Werte: '' = alle, sonst eine Kategorie) */
export const FILTER_NONE = 'ohne';
export const MAX_QUERY_LENGTH = 120;

/** Text für den Vergleich: klein, ohne Akzente, Leerraum zusammengefasst */
export function searchKey(text) {
  return cleanLine(String(text ?? ''), MAX_QUERY_LENGTH * 4)
    .toLocaleLowerCase('de')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Liste filtern: query (Teil des Titels oder Dateinamens), category ('' alle, 'ohne', Kategorie) */
export function filterMyBuilds(list, { query = '', category = '' } = {}) {
  const words = searchKey(cleanLine(query, MAX_QUERY_LENGTH)).split(' ').filter(Boolean);
  return (Array.isArray(list) ? list : []).filter((entry) => {
    if (category === FILTER_NONE && entry.category) return false;
    if (CATEGORY_SLUGS.includes(category) && entry.category !== category) return false;
    if (words.length === 0) return true;
    const haystack = searchKey(`${entry.title} ${entry.fileName}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Dateigröße: „812 Bytes“, „14 KB“, „3,4 MB“ */
export function sizeText(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes < 1024) return `${formatNumber(bytes)} Bytes`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${formatNumber(bytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB`;
}

/** Datum: „28.10.2026“ (fehlend → '') */
export function dateText(iso) {
  const time = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Kurzform des Formats: die Endung der Datei („.schem“, auch „.schematic“) */
export function formatShort(entry) {
  const ext = /\.([a-z0-9]{2,10})$/i.exec(entry?.fileName ?? '')?.[1]?.toLowerCase();
  return ext ? `.${ext}` : `.${entry?.format ?? '?'}`;
}

/** Zeile unter dem Titel: „.schem · 2 KB · 28.10.2026“ */
export function cardMeta(entry) {
  return [formatShort(entry), sizeText(entry?.size), dateText(entry?.addedAt)].filter(Boolean).join(' · ');
}

/** „3 Bauten“ bzw. „2 von 5 Bauten“ */
export function countText(shown, total) {
  return shown === total ? formatCount(total, 'Bau', 'Bauten') : `${formatNumber(shown)} von ${formatCount(total, 'Bau', 'Bauten')}`;
}

/** Herkunft → Credits der Infos ({ author, url, license }); ohne Autor steht dort die Seite der Adresse */
export function creditsFromSource(source) {
  if (!source || typeof source !== 'object') return null;
  let author = source.author ?? null;
  if (!author && source.url) {
    try {
      author = new URL(source.url).hostname;
    } catch {
      author = null;
    }
  }
  if (!author && !source.license) return null;
  return { author: author ?? 'Unbekannt', url: source.url ?? null, license: source.license ?? null };
}

/** Eintrag für die Bau-Ansicht (Kopf und Infos) */
export function mineViewEntry(record) {
  return {
    title: record.title,
    subtitle: Object.hasOwn(FORMAT_LABELS, record.format) ? FORMAT_LABELS[record.format] : '',
    category: record.category ?? null,
    credits: creditsFromSource(record.source),
  };
}

/** Quelle für viewer.load: wie ein Upload auf „Selber erstellen“ */
export function mineViewSource(record) {
  return { kind: 'upload', format: record.format, name: record.fileName, data: record.data, params: record.params ?? {} };
}

/**
 * Eigenen Bau für die Bau-Seite laden → { record, entry, source, progressKey } oder null (unbekannt).
 * store: Ergebnis von createMyBuilds/openMyBuilds; Speicherfehler (MyBuildsError) gehen weiter.
 */
export async function loadMineView(id, store) {
  if (!isMyBuildId(id)) return null;
  const record = await store.get(id);
  if (!record) return null;
  return { record, entry: mineViewEntry(record), source: mineViewSource(record), progressKey: myBuildProgressKey(id) };
}
