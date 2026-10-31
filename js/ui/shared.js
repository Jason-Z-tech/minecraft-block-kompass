// Gemeinsame Bausteine aller Seiten: Konstanten (§8), Formatierung, Suche, localStorage,
// Kopf/Navigation und die DOM-Bausteine des Design-Systems (Chips, Karten, Zustände, Tabs, Toast …).
// Reine Funktionen funktionieren auch in Node; DOM-Funktionen erst beim Aufruf im Browser.
import { el, svgEl, clear, sitePath } from './dom.js';

/* ------------------------------------------------------------------ Konstanten */

/** Kategorien nach ARCHITEKTUR §8, Farben nach §11, Icons aus assets/icons.svg. */
export const CATEGORIES = deepFreeze([
  { slug: 'haeuser', title: 'Häuser & Wohnen', shortTitle: 'Häuser', color: '#b8945f', colorName: 'Eiche', icon: 'cat-haeuser', description: 'Wohnhäuser, Hütten und alles, worin man gemütlich wohnen kann.' },
  { slug: 'wahrzeichen', title: 'Wahrzeichen & Riesenbauten', shortTitle: 'Wahrzeichen', color: '#f2c14e', colorName: 'Gold', icon: 'cat-wahrzeichen', description: 'Berühmte Bauwerke und große Projekte für viele Bauabende.' },
  { slug: 'fantasy', title: 'Fantasy, Anime & Film', shortTitle: 'Fantasy', color: '#9a5cc6', colorName: 'Amethyst', icon: 'cat-fantasy', description: 'Bauten aus Geschichten, Serien, Filmen und eigener Fantasie.' },
  { slug: 'mittelalter', title: 'Mittelalter & Burgen', shortTitle: 'Mittelalter', color: '#9a9a9a', colorName: 'Stein', icon: 'cat-mittelalter', description: 'Burgen, Mauern, Türme und mittelalterliche Gebäude.' },
  { slug: 'klein', title: 'Kleine Projekte & Deko', shortTitle: 'Klein & Deko', color: '#e57ca3', colorName: 'Blüte', icon: 'cat-klein', description: 'Schnelle Bauten und Deko-Ideen für zwischendurch.' },
  { slug: 'infrastruktur', title: 'Brücken, Bahnhöfe & Häfen', shortTitle: 'Infrastruktur', color: '#d0703c', colorName: 'Kupfer', icon: 'cat-infrastruktur', description: 'Brücken, Bahnhöfe, Häfen und Verkehrswege.' },
]);

export const CATEGORY_SLUGS = Object.freeze(CATEGORIES.map((category) => category.slug));

/** Herkunft eines Baus (accuracy) nach §8 */
export const ACCURACY_LABELS = Object.freeze({
  original: 'Original vom Ersteller',
  massstab: 'Nach echten Maßen',
  vorlage: 'Nach bekannter Vorlage',
  nachempfunden: 'Nachempfunden',
  eigenes: 'Eigenes Design',
});

export const ACCURACY_KEYS = Object.freeze(Object.keys(ACCURACY_LABELS));

/** Größenklassen nach Blöcken (Katalog ab Runde 2): klein < 1 000 ≤ mittel < 10 000 ≤ gross < 100 000 ≤ riesig */
export const SIZE_CLASS_KEYS = Object.freeze(['klein', 'mittel', 'gross', 'riesig']);

/** Alle Icons in assets/icons.svg (wird per Test gegen die Datei geprüft). */
export const ICON_NAMES = Object.freeze([
  'search', 'home', 'grid', 'hammer', 'prev', 'next', 'play', 'pause', 'check', 'close', 'info', 'warning',
  'size', 'blocks', 'steps', 'copy', 'retry', 'cube', 'layers', 'chest', 'book', 'arrow-right', 'arrow-left',
  'chevron-down', 'star', 'plus', ...CATEGORIES.map((category) => category.icon),
]);

export const SEARCH_MAX_LENGTH = 120;
export const BUILD_ID_PATTERN = /^[a-z0-9-]{2,80}$/;

// Zeichenklassen aus Codepunkten gebaut, damit keine unsichtbaren Zeichen im Quelltext stehen:
// Steuerzeichen und Zeilen-/Absatztrenner werden zu Leerzeichen; Nullbreite-Zeichen, Schreibrichtungs-Steuerung
// (Einbettung, Überschreibung, Isolierung) und BOM fallen weg.
const toRegexEscape = (code) => `\\u${code.toString(16).padStart(4, '0')}`;
const charClass = (ranges) => new RegExp(`[${ranges.map(([from, to]) => `${toRegexEscape(from)}-${toRegexEscape(to)}`).join('')}]`, 'g');
const CONTROL_CHARACTERS = charClass([[0x0000, 0x001f], [0x007f, 0x009f], [0x2028, 0x2029]]);
const ZERO_WIDTH_CHARACTERS = charClass([[0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2060], [0x2066, 0x2069], [0xfeff, 0xfeff]]);
const FORM_NAME_PATTERN = /^[a-z0-9-]{1,40}$/;
const STORAGE_PREFIX = 'bk:';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

export function findCategory(slug) {
  return CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function accuracyLabel(key) {
  return Object.hasOwn(ACCURACY_LABELS, key) ? ACCURACY_LABELS[key] : null;
}

export function isValidBuildId(id) {
  return typeof id === 'string' && BUILD_ID_PATTERN.test(id);
}

/* ------------------------------------------------------------------ Formatierung */

const numberFormats = new Map();

/** Deutsche Zahl mit Tausenderpunkt: 12345 → „12.345“, 0.5 → „0,5“. Fehlende Werte → „–“. */
export function formatNumber(value, { maximumFractionDigits = 2 } = {}) {
  if (value === null || value === undefined) return '–';
  if (typeof value !== 'number') throw new TypeError(`formatNumber erwartet eine Zahl, bekam ${typeof value}.`);
  if (!Number.isFinite(value)) return '–';
  let format = numberFormats.get(maximumFractionDigits);
  if (!format) {
    format = new Intl.NumberFormat('de-DE', { maximumFractionDigits, useGrouping: true });
    numberFormats.set(maximumFractionDigits, format);
  }
  return format.format(Object.is(value, -0) ? 0 : value);
}

/** „1 Bau“ / „12 Bauten“ */
export function formatCount(count, singular, plural) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** [w, h, l] → „64 × 120 × 64“ (Breite × Höhe × Länge) */
export function formatSize(size) {
  if (!Array.isArray(size) || size.length !== 3) return '–';
  return size.map((value) => formatNumber(value)).join(' × ');
}

/* ------------------------------------------------------------------ Farben (WCAG 2.x) */

/** „#rgb“ oder „#rrggbb“ → [r, g, b] (0–255) */
export function parseHex(hex) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) throw new TypeError(`Keine Hex-Farbe: ${String(hex)}`);
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

/** Relative Leuchtdichte nach WCAG 2.x */
export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis (1 … 21) */
export function contrastRatio(a, b) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Mischt wie color-mix(in srgb, a weight, b) → „#rrggbb“ */
export function mixHex(a, b, weight) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return `#${ca.map((value, i) => Math.round(value * weight + cb[i] * (1 - weight)).toString(16).padStart(2, '0')).join('')}`;
}

/* ------------------------------------------------------------------ Suche */

/** Suchtext bereinigen: Steuerzeichen raus, Leerraum zusammenfassen, trimmen, höchstens 120 Zeichen. */
export function normalizeSearchQuery(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .normalize('NFC')
    .replace(ZERO_WIDTH_CHARACTERS, '')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // nach Codepunkten kürzen, damit kein Emoji/Ersatzpaar zerschnitten wird
  return Array.from(cleaned).slice(0, SEARCH_MAX_LENGTH).join('').trim();
}

/** Adresse der Suche (Freitext-Seite); leere Suche → Seite ohne Parameter */
export function searchHref(query, root) {
  const normalized = normalizeSearchQuery(query);
  const target = normalized ? `erstellen.html?q=${encodeURIComponent(normalized)}` : 'erstellen.html';
  return root ? sitePath(target, root) : sitePath(target);
}

/** Parameter der Bau-Seite: bau.html?id=<id>[&scale=<zahl>] oder bau.html?form=<form> */
export function parseBuildParams(search) {
  const params = new URLSearchParams(search);
  const id = params.get('id');
  const form = params.get('form');
  if (id !== null && form !== null) return { kind: 'invalid', reason: 'both' };
  if (id !== null) {
    if (!isValidBuildId(id)) return { kind: 'invalid', reason: 'id' };
    const rawScale = params.get('scale');
    if (rawScale === null) return { kind: 'build', id, scale: null };
    const scale = parseScale(rawScale);
    return scale === null ? { kind: 'invalid', reason: 'scale' } : { kind: 'build', id, scale };
  }
  if (form !== null) return FORM_NAME_PATTERN.test(form) ? { kind: 'form', form } : { kind: 'invalid', reason: 'form' };
  return { kind: 'none' };
}

/** Maßstab aus der Adresse: Dezimalzahl > 0 und ≤ 4 mit höchstens 4 Nachkommastellen, sonst null */
export function parseScale(raw) {
  if (typeof raw !== 'string' || !/^\d{1,2}(?:\.\d{1,4})?$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 && value <= 4 ? value : null;
}

/* ------------------------------------------------------------------ localStorage */

function storageArea() {
  try {
    return globalThis.localStorage ?? null;
  } catch (error) {
    console.warn('[Block-Kompass] localStorage ist gesperrt:', error);
    return null;
  }
}

function assertStorageKey(key) {
  if (typeof key !== 'string' || !key.startsWith(STORAGE_PREFIX) || key.length > 200) {
    throw new TypeError(`Speicherschlüssel müssen mit „${STORAGE_PREFIX}“ beginnen: ${String(key)}`);
  }
}

/** Liest einen JSON-Wert; bei fehlendem, gesperrtem oder kaputtem Speicher → fallback. */
export function storageGet(key, fallback = null) {
  assertStorageKey(key);
  const area = storageArea();
  if (!area) return fallback;
  try {
    const raw = area.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`[Block-Kompass] Gespeicherter Wert „${key}“ ist nicht lesbar:`, error);
    return fallback;
  }
}

/** Speichert einen JSON-Wert; gibt false zurück, wenn das nicht ging (z. B. Speicher voll). */
export function storageSet(key, value) {
  assertStorageKey(key);
  const area = storageArea();
  if (!area) return false;
  try {
    area.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[Block-Kompass] „${key}“ konnte nicht gespeichert werden:`, error);
    return false;
  }
}

export function storageRemove(key) {
  assertStorageKey(key);
  const area = storageArea();
  if (!area) return false;
  try {
    area.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[Block-Kompass] „${key}“ konnte nicht gelöscht werden:`, error);
    return false;
  }
}

/* ------------------------------------------------------------------ Icons */

const ICON_SIZES = [16, 32, 48, 64];

/** Pixel-Icon aus dem Sprite. size: 16 | 32 | 48 | 64 (ganzzahlige Vielfache bleiben scharf). */
export function icon(name, { size = 16, label = null, className = '' } = {}) {
  if (!ICON_NAMES.includes(name)) throw new TypeError(`Unbekanntes Icon „${name}“.`);
  if (!ICON_SIZES.includes(size)) throw new TypeError(`Icon-Größe ${size} gibt es nicht (erlaubt: ${ICON_SIZES.join(', ')}).`);
  const classes = ['icon', size !== 16 && `icon--${size}`, className].filter(Boolean).join(' ');
  const attrs = { class: classes, viewBox: '0 0 16 16', focusable: 'false' };
  if (label) Object.assign(attrs, { role: 'img', 'aria-label': label });
  else attrs['aria-hidden'] = 'true';
  return svgEl('svg', attrs, label ? svgEl('title', null, label) : null, svgEl('use', { href: `${sitePath('assets/icons.svg')}#${name}` }));
}

/* ------------------------------------------------------------------ Kopf und Suche */

/** body[data-page] → Navigationspunkt [data-nav] (meine.html: data-page="mine") */
export const NAV_FOR_PAGE = Object.freeze({ home: 'home', category: 'category', create: 'create', mine: 'mine' });

/** Initialisiert den Kopf (aktive Navigation) – zuerst in jedem Seitenmodul aufrufen. */
export function initPage() {
  const page = document.body.dataset.page ?? '';
  markActiveNav(Object.hasOwn(NAV_FOR_PAGE, page) ? NAV_FOR_PAGE[page] : null);
  return { page };
}

export function markActiveNav(navKey) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === navKey) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/** Suchformular (Startseite): bereinigt die Eingabe und leitet auf erstellen.html?q=… weiter. */
export function bindSearchForm(form, input) {
  if (!form || !input) throw new Error('Suchformular unvollständig (Formular oder Eingabefeld fehlt).');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = normalizeSearchQuery(input.value);
    if (!query) {
      input.value = '';
      nudge(form);
      input.focus();
      return;
    }
    window.location.assign(searchHref(query));
  });
}

/** Kurzes Wackeln als Rückmeldung (bei weniger Bewegung sofort vorbei). */
export function nudge(node) {
  node.classList.remove('is-shaking');
  // Neustart der Animation erzwingen
  void node.offsetWidth;
  node.classList.add('is-shaking');
  node.addEventListener('animationend', () => node.classList.remove('is-shaking'), { once: true });
}

/* ------------------------------------------------------------------ Chips und Kennzahlen */

export function createChip(text, { className = '', iconName = null, dataset = null } = {}) {
  return el('span', { class: ['chip', iconName && 'chip--icon', className], dataset }, iconName ? icon(iconName) : null, text);
}

export function createCategoryChip(slug) {
  const category = findCategory(slug);
  if (!category) throw new TypeError(`Unbekannte Kategorie „${slug}“.`);
  return createChip(category.title, { className: 'chip--category', dataset: { category: slug } });
}

export function createAccuracyChip(key) {
  const label = accuracyLabel(key);
  if (!label) throw new TypeError(`Unbekannte Herkunft „${key}“.`);
  return createChip(label, { className: 'chip--accuracy', dataset: { accuracy: key } });
}

export function createUntestedChip() {
  return createChip('Nicht im Spiel getestet', { className: 'chip--warning', iconName: 'warning' });
}

function statItem(iconName, label, value) {
  return el('li', null, icon(iconName), el('span', { class: 'visually-hidden' }, `${label}: `), value);
}

export function createStats(build) {
  const items = [];
  if (build.size) items.push(statItem('size', 'Größe (Breite × Höhe × Länge)', formatSize(build.size)));
  if (Number.isInteger(build.blocks)) items.push(statItem('blocks', 'Blöcke', formatNumber(build.blocks)));
  if (Number.isInteger(build.steps)) items.push(statItem('steps', 'Schritte', formatCount(build.steps, 'Schritt', 'Schritte')));
  return items.length ? el('ul', { class: 'stats', role: 'list' }, items) : null;
}

/* ------------------------------------------------------------------ Karten und Kacheln */

/** Bau-Karte aus einem Katalog-Eintrag (§9). imageSrc überschreibt das Vorschaubild (nur Testseiten). */
export function createBuildCard(build, { headingLevel = 3, imageSrc = null } = {}) {
  const category = findCategory(build.category);
  if (!category) throw new TypeError(`Bau „${build.id}“ hat eine unbekannte Kategorie.`);
  const src = imageSrc ?? (build.thumb ? sitePath(build.thumb) : null);
  const fallback = () => el('div', { class: 'build-card__fallback' }, icon(category.icon, { size: 64 }));
  let preview = fallback();
  if (src) {
    // Feste Größe (wie die Bilder aus data/thumbs/, 16:10 wie der Rahmen): kein Springen beim Laden
    preview = el('img', { class: 'build-card__img', src, alt: '', loading: 'lazy', decoding: 'async', width: 640, height: 400 });
    // Fehlt das Vorschaubild, erscheint das Kategorie-Icon statt eines kaputten Bildes
    preview.addEventListener('error', () => {
      console.warn(`[Block-Kompass] Vorschaubild fehlt: ${src}`);
      preview.replaceWith(fallback());
    }, { once: true });
  }
  const media = el('div', { class: 'build-card__media' }, preview);
  const footItems = [
    build.accuracy && accuracyLabel(build.accuracy) ? createAccuracyChip(build.accuracy) : null,
    build.tested === false ? createUntestedChip() : null,
  ].filter(Boolean);
  const foot = footItems.length ? el('div', { class: 'build-card__foot' }, el('span', { class: 'cluster' }, footItems)) : null;
  const title = el(`h${headingLevel}`, { class: 'build-card__title' },
    el('a', { class: 'build-card__link', href: sitePath(`bau.html?id=${encodeURIComponent(build.id)}`) }, build.title));
  return el('article', { class: 'build-card', dataset: { category: category.slug } },
    media,
    el('div', { class: 'build-card__body' },
      title,
      build.subtitle ? el('p', { class: 'build-card__subtitle' }, build.subtitle) : null,
      createStats(build),
      foot));
}

/** Platzhalter-Karten während des Ladens (rein visuell, für Screenreader verborgen). */
export function createSkeletonCards(count = 3) {
  return Array.from({ length: count }, () => el('li', { 'aria-hidden': 'true' },
    el('div', { class: 'skeleton-card plate' },
      el('span', { class: 'skeleton skeleton--media' }),
      el('div', { class: 'skeleton-card__body' },
        el('span', { class: 'skeleton skeleton--title' }),
        el('span', { class: 'skeleton skeleton--text' }),
        el('span', { class: 'skeleton skeleton--text', dataset: { width: 'short' } })))));
}

/**
 * Kategorie-Kachel; count: undefined = lädt, null = unbekannt, Zahl = Anzahl Bauten.
 * compact: nur Icon, Name und Anzahl (Startseite); auf schmalen Schirmen der Kurzname.
 */
export function createCategoryTile(category, { count, compact = false } = {}) {
  const countNode = el('span', { class: 'category-tile__count' });
  const title = compact
    ? el('span', { class: 'category-tile__title' },
      el('span', { class: 'label-long' }, category.title),
      el('span', { class: 'label-short' }, category.shortTitle))
    : el('span', { class: 'category-tile__title' }, category.title);
  const tile = el('a', { class: ['category-tile', compact && 'category-tile--compact'], href: sitePath(`kategorie.html?k=${category.slug}`), dataset: { category: category.slug } },
    el('span', { class: 'category-tile__icon' }, icon(category.icon, { size: compact ? 32 : 48 })),
    title,
    compact ? null : el('span', { class: 'category-tile__text' }, category.description),
    countNode);
  setTileCount(tile, count);
  return tile;
}

/** Füllt eine Liste mit allen Kategorie-Kacheln; gibt Map slug → Kachel zurück. */
export function renderCategoryGrid(list, { compact = false } = {}) {
  const tiles = new Map();
  list.replaceChildren(...CATEGORIES.map((category) => {
    const tile = createCategoryTile(category, { compact });
    tiles.set(category.slug, tile);
    return el('li', null, tile);
  }));
  return tiles;
}

/** counts: undefined = lädt, null = unbekannt, sonst { slug: anzahl } */
export function setCategoryCounts(tiles, counts) {
  for (const [slug, tile] of tiles) setTileCount(tile, counts === undefined || counts === null ? counts : counts[slug] ?? 0);
}

export function setTileCount(tile, count) {
  const node = tile.querySelector('.category-tile__count');
  node.classList.remove('skeleton', 'is-loading');
  if (count === undefined) {
    node.classList.add('skeleton', 'is-loading');
    node.textContent = '';
    node.setAttribute('aria-hidden', 'true');
    return;
  }
  node.removeAttribute('aria-hidden');
  node.textContent = count === null ? '' : count === 0 ? 'Noch keine Bauten' : formatCount(count, 'Bau', 'Bauten');
}

/* ------------------------------------------------------------------ Zustände (Laden, Leer, Fehler, Info) */

const STATE_ICONS = { empty: 'cube', info: 'info', warning: 'warning', error: 'warning' };

/**
 * Baut einen Zustandsblock. kind: loading | empty | info | warning | error.
 * steps: [{ text, command? }] – nummerierte Anleitung, Befehle mit Kopier-Knopf.
 * headingLevel: 1–6 für eine Überschrift, 0 für einen einfachen Absatz (z. B. Ladeanzeigen).
 */
export function createState({ kind = 'info', title, text = '', steps = [], actions = [], iconName = null, headingLevel = 2, compact = false, centered = false }) {
  const iconNode = kind === 'loading' ? el('span', { class: 'spinner' }) : icon(iconName ?? STATE_ICONS[kind] ?? 'info', { size: 32 });
  const titleTag = Number.isInteger(headingLevel) && headingLevel >= 1 && headingLevel <= 6 ? `h${headingLevel}` : 'p';
  return el('div', { class: ['state', `state--${kind}`, compact && 'state--compact', centered && 'state--centered'] },
    el('div', { class: 'state__icon', 'aria-hidden': 'true' }, iconNode),
    el(titleTag, { class: 'state__title' }, title),
    text ? el('p', { class: 'state__text' }, text) : null,
    steps.length ? el('ol', { class: 'state__steps' }, steps.map(createStep)) : null,
    actions.length ? el('div', { class: 'state__actions' }, actions) : null);
}

function createStep(step) {
  return el('li', null, el('p', null, step.text), step.command ? createCommand(step.command) : null);
}

/** Befehlszeile mit Kopier-Knopf */
export function createCommand(command) {
  const code = el('code', null, command);
  const button = el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, icon('copy'), el('span', null, 'Kopieren'));
  button.addEventListener('click', () => copyCommand(command, code, button));
  return el('div', { class: 'command' }, code, button);
}

async function copyCommand(command, code, button) {
  const label = button.querySelector('span');
  try {
    if (!navigator.clipboard) throw new Error('Zwischenablage nicht verfügbar');
    await navigator.clipboard.writeText(command);
    label.textContent = 'Kopiert';
    showToast({ title: 'Befehl kopiert', text: command, kind: 'success', duration: 3000 });
    setTimeout(() => { label.textContent = 'Kopieren'; }, 2000);
  } catch (error) {
    console.warn('[Block-Kompass] Kopieren nicht möglich:', error);
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToast({ title: 'Bitte selbst kopieren', text: 'Der Befehl ist markiert – kopiere ihn mit Strg + C.', kind: 'warning' });
  }
}

/** Ersetzt den Inhalt eines Containers durch einen Zustand. */
export function renderState(container, spec) {
  clear(container);
  if (spec.kind === 'loading') container.setAttribute('aria-busy', 'true');
  else container.removeAttribute('aria-busy');
  const node = createState(spec);
  container.append(node);
  return node;
}

export function renderLoading(container, { title = 'Wird geladen …', text = '', headingLevel = 0, ...rest } = {}) {
  return renderState(container, { kind: 'loading', title, text, headingLevel, ...rest });
}

export function renderEmpty(container, { title, text = '', ...rest }) {
  return renderState(container, { kind: 'empty', title, text, ...rest });
}

export function renderInfo(container, { title, text = '', ...rest }) {
  return renderState(container, { kind: 'info', title, text, ...rest });
}

const EXPECTED_DATA_ERRORS = new Set(['missing', 'network', 'timeout', 'rate-limit']);

export function isExpectedDataError(error) {
  return EXPECTED_DATA_ERRORS.has(error.kind) || (error.kind === 'http' && Number(error.status) >= 500);
}

/** Zeigt einen Fehler allgemein verständlich an; Details landen in der Konsole. */
export function renderError(container, error, { onRetry = null, actions = [], ...rest } = {}) {
  const known = error && error.name === 'DataError';
  // Erwartbare Fälle (Datei fehlt, Netz weg, Server überlastet) sind kein Programmfehler
  if (known && isExpectedDataError(error)) console.warn('[Block-Kompass]', error.message, error);
  else console.error('[Block-Kompass]', error);
  // Nach dem Klick verschwindet der Knopf – der Fokus bleibt deshalb im Statusbereich
  const retryAndKeepFocus = () => {
    container.setAttribute('tabindex', '-1');
    container.focus({ preventScroll: true });
    onRetry();
  };
  const retry = onRetry
    ? el('button', { class: 'btn btn--secondary', type: 'button', on: { click: retryAndKeepFocus } }, icon('retry'), el('span', null, 'Erneut versuchen'))
    : null;
  return renderState(container, {
    kind: 'error',
    title: known ? error.title : 'Etwas ist schiefgelaufen',
    text: known ? error.message : 'Bitte lade die Seite neu. Technische Details stehen in der Browser-Konsole (F12).',
    steps: known ? error.steps : [],
    actions: [retry, ...actions].filter(Boolean),
    ...rest,
  });
}

/** Link-Button (z. B. „Zu den Kategorien“) */
export function linkButton(text, path, { variant = 'secondary', iconName = null } = {}) {
  return el('a', { class: ['btn', `btn--${variant}`], href: sitePath(path) }, iconName ? icon(iconName) : null, el('span', null, text));
}

/* ------------------------------------------------------------------ Tabs, Schieberegler, XP-Leiste */

/**
 * Barrierearme Tabs (WAI-ARIA, automatische Aktivierung): Klick, Pfeiltasten, Pos1/Ende.
 * Erwartet [role=tablist] mit [role=tab] (aria-controls → Panel-ID).
 */
export function initTabs(root, { selected = null, onChange = null } = {}) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  if (tabs.length === 0) throw new Error('initTabs: keine Tabs gefunden.');
  const panels = tabs.map((tab) => {
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (!panel) throw new Error(`initTabs: Panel für #${tab.id} fehlt.`);
    return panel;
  });
  const select = (tab, { focus = false } = {}) => {
    tabs.forEach((candidate, index) => {
      const active = candidate === tab;
      candidate.setAttribute('aria-selected', String(active));
      candidate.tabIndex = active ? 0 : -1;
      panels[index].hidden = !active;
    });
    if (focus) tab.focus();
    if (onChange) onChange(tab.id);
  };
  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab && tabs.includes(tab)) select(tab);
  });
  root.addEventListener('keydown', (event) => {
    const current = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (current < 0) return;
    const targets = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    select(tabs[(targets[event.key] + tabs.length) % tabs.length], { focus: true });
  });
  const initial = tabs.find((tab) => tab.id === selected) ?? tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') ?? tabs[0];
  select(initial);
  return { select: (id) => select(tabs.find((tab) => tab.id === id) ?? initial) };
}

/** Füllt die Spur eines Schiebereglers bis zum Griff (CSS-Variable --fill). */
export function syncSlider(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--fill', `${Math.min(100, Math.max(0, percent))}%`);
}

export function initSlider(input, { onInput = null } = {}) {
  syncSlider(input);
  input.addEventListener('input', () => {
    syncSlider(input);
    if (onInput) onInput(Number(input.value));
  });
}

/** Segmentierte XP-Leiste: value von max, level = große Zahl über der Leiste. */
export function setXpProgress(node, { value, max, level = value, label = null }) {
  const progress = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  node.style.setProperty('--progress', String(progress));
  node.setAttribute('aria-valuemin', '0');
  node.setAttribute('aria-valuemax', String(max));
  node.setAttribute('aria-valuenow', String(value));
  node.setAttribute('aria-valuetext', label ?? `${formatNumber(value)} von ${formatNumber(max)}`);
  const levelNode = node.querySelector('.xp__level');
  if (levelNode && levelNode.textContent !== String(level)) {
    levelNode.textContent = String(level);
    node.classList.remove('is-bumped');
    void node.offsetWidth;
    node.classList.add('is-bumped');
  }
}

/* ------------------------------------------------------------------ Tooltip */

let tooltipCounter = 0;

/**
 * Tooltip im Spiel-Stil an einem Element: erscheint bei Maus und Tastaturfokus, Esc schließt.
 * render() liefert den Inhalt (DOM-Knoten oder Text), z. B. Titel + ID.
 */
export function attachTooltip(target, render) {
  let tip = null;
  const id = `tooltip-${++tooltipCounter}`;
  const place = () => {
    const box = target.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, box.left + box.width / 2 - size.width / 2), window.innerWidth - size.width - 8);
    const above = box.top - size.height - 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(above >= 8 ? above : box.bottom + 8)}px`;
  };
  const hide = () => {
    if (!tip) return;
    tip.remove();
    tip = null;
    target.removeAttribute('aria-describedby');
  };
  const show = () => {
    hide();
    tip = el('div', { class: 'tooltip tooltip--floating', role: 'tooltip', id }, render());
    document.body.append(tip);
    target.setAttribute('aria-describedby', id);
    place();
  };
  target.addEventListener('pointerenter', show);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);
  target.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  return { show, hide };
}

/** Inhalt für Block-Tooltips: deutscher Name, optionale Zeilen, ID */
export function tooltipContent(title, { lines = [], meta = null } = {}) {
  return [
    el('span', { class: 'tooltip__title' }, title),
    ...lines.map(({ text, tone = null }) => el('span', { class: tone ? `tooltip__line--${tone}` : null }, text)),
    meta ? el('span', { class: 'tooltip__meta' }, meta) : null,
  ];
}

/* ------------------------------------------------------------------ Toast */

const TOAST_ICONS = { success: 'check', info: 'info', warning: 'warning', error: 'warning' };
const MAX_TOASTS = 3;

function toastRegion() {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = el('div', { id: 'toast-region', class: 'toast-region', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    document.body.append(region);
  }
  return region;
}

/** Baut eine Toast-Meldung (ohne Timer). onClose: was der Schließen-Knopf tut (Standard: entfernen). */
export function createToast({ title, text = '', kind = 'info', onClose = null }) {
  const close = el('button', { class: 'btn btn--ghost btn--icon btn--sm toast__close', type: 'button' }, icon('close'), el('span', { class: 'visually-hidden' }, 'Meldung schließen'));
  const toast = el('div', { class: ['toast', `toast--${kind}`] },
    el('span', { class: 'toast__icon', 'aria-hidden': 'true' }, icon(TOAST_ICONS[kind] ?? 'info')),
    el('div', { class: 'toast__body' }, el('p', { class: 'toast__title' }, title), text ? el('p', { class: 'toast__text' }, text) : null),
    close);
  close.addEventListener('click', () => (onClose ? onClose() : toast.remove()));
  return toast;
}

/** Kurze Meldung unten rechts; verschwindet nach duration ms (Fehler bleiben länger). */
export function showToast({ title, text = '', kind = 'info', duration = kind === 'error' ? 10000 : 5000 }) {
  const region = toastRegion();
  let timer = null;
  let toast = null;
  const dismiss = () => {
    clearTimeout(timer);
    if (!toast.isConnected || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  // Ansage über die bestehende Live-Region (#toast-region, aria-live="polite")
  toast = createToast({ title, text, kind, onClose: dismiss });
  const schedule = () => {
    clearTimeout(timer);
    if (duration > 0) timer = setTimeout(dismiss, duration);
  };
  toast.addEventListener('pointerenter', () => clearTimeout(timer));
  toast.addEventListener('pointerleave', schedule);
  toast.addEventListener('focusin', () => clearTimeout(timer));
  toast.addEventListener('focusout', schedule);
  while (region.children.length >= MAX_TOASTS) region.firstElementChild.remove();
  region.append(toast);
  schedule();
  return { element: toast, dismiss };
}
