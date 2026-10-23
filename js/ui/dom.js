// Sichere DOM-Helfer: Elemente nur über DOM-APIs bauen (nie innerHTML), Attribute und Adressen prüfen.
// Der Modul-Code selbst greift beim Laden nicht auf das DOM zu und ist deshalb auch in Node testbar.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Elemente, die Skripte, Styles oder fremde Dokumente einschleusen könnten
const FORBIDDEN_HTML_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'template', 'noscript',
]);
// SVG nur mit harmlosen Grundformen (kein script, foreignObject, animate/set)
const ALLOWED_SVG_TAGS = new Set(['svg', 'g', 'use', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'title', 'desc']);
const FORBIDDEN_ATTRIBUTES = new Set(['style', 'srcdoc', 'innerhtml', 'outerhtml', 'formaction']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'poster', 'cite', 'data', 'xlink:href', 'background']);
const TAG_NAME = /^[a-z][a-z0-9-]*$/;
const SVG_TAG_NAME = /^[a-z][a-zA-Z0-9-]*$/;
const ATTRIBUTE_NAME = /^[a-z][a-z0-9_.:-]*$/i;
const DATASET_KEY = /^[a-z][a-zA-Z0-9]*$/;
const MAX_URL_LENGTH = 2048;
// Bilder als data:-Adresse (z. B. Block-Icons aus einem Canvas) dürfen größer sein
const MAX_DATA_URL_LENGTH = 4_000_000;
const PARSE_BASE = 'https://block-kompass.invalid/seite/';
// Nur Rasterbilder als data:-Adresse (SVG könnte Skripte enthalten)
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|gif|jpeg|webp|avif);base64,[a-z0-9+/]+=*$/i;

// Wurzel der Webseite, abgeleitet vom Ort dieses Moduls (js/ui/dom.js → ../../)
export const SITE_ROOT = new URL('../../', import.meta.url);

/**
 * Prüft eine Adresse für href/src. Erlaubt: relative Pfade (auch „/…“, „#…“, „?…“) und https.
 * Mit allowImageData zusätzlich blob: und data:image/(png|gif|jpeg|webp|avif);base64 (nur für <img src>).
 */
export function isSafeUrl(value, { allowImageData = false } = {}) {
  if (typeof value !== 'string') return false;
  // Steuerzeichen (auch Tab/Zeilenumbruch, mit denen sich „javascript:“ tarnen lässt) nie erlauben
  if (/[\x00-\x1f\x7f]/.test(value)) return false;
  const cleaned = value.trim();
  if (cleaned === '' || cleaned.length > MAX_DATA_URL_LENGTH) return false;
  if (cleaned.includes('\\')) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)?.[1].toLowerCase();
  if (allowImageData && scheme === 'data') return SAFE_IMAGE_DATA_URL.test(cleaned);
  if (cleaned.length > MAX_URL_LENGTH) return false;
  if (scheme) {
    if (scheme === 'https') return parsesTo(cleaned, (url) => url.protocol === 'https:' && url.hostname !== '');
    if (allowImageData && scheme === 'blob') return parsesTo(cleaned, (url) => url.protocol === 'blob:');
    return false;
  }
  // „//host/…“ wäre eine Adresse auf einem fremden Server
  if (cleaned.startsWith('//')) return false;
  return parsesTo(cleaned, (url) => url.origin === new URL(PARSE_BASE).origin, PARSE_BASE);
}

function parsesTo(value, check, base) {
  try {
    return check(base ? new URL(value, base) : new URL(value));
  } catch {
    return false;
  }
}

/**
 * Pfad innerhalb der Webseite (ohne Schema, ohne „..“, ohne führenden Schrägstrich),
 * z. B. „game-data/catalog.json“ oder „bau.html?id=turm“.
 */
export function isSafeSitePath(value) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_URL_LENGTH) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/') || value.includes('\\')) return false;
  const pathPart = value.split(/[?#]/)[0];
  if (pathPart === '' || /[\x00-\x20\x7f]/.test(pathPart)) return false;
  return !pathPart.split('/').some((segment) => segment === '..' || segment === '.' || /^%2e/i.test(segment));
}

/**
 * Wandelt einen Seitenpfad in eine Adresse ab der Website-Wurzel um („/bau.html?id=…“).
 * Funktioniert von jeder Seite aus, auch aus Unterordnern (z. B. tests/visual/).
 */
export function sitePath(relativePath, root = SITE_ROOT) {
  if (!isSafeSitePath(relativePath)) throw new TypeError(`Ungültiger Seitenpfad: ${String(relativePath)}`);
  const url = new URL(relativePath, root);
  return `${url.pathname}${url.search}${url.hash}`;
}

function assertAttributeName(name) {
  if (!ATTRIBUTE_NAME.test(name)) throw new TypeError(`Ungültiger Attributname „${name}“.`);
  const lower = name.toLowerCase();
  if (lower.startsWith('on')) throw new TypeError(`Event-Attribute wie „${name}“ sind verboten – bitte das „on“-Objekt (addEventListener) nutzen.`);
  if (FORBIDDEN_ATTRIBUTES.has(lower)) throw new TypeError(`Das Attribut „${name}“ ist verboten (CSP und Sicherheit).`);
}

function attributeValue(name, value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new TypeError(`Attribut „${name}“: nur Text, endliche Zahlen oder true/false erlaubt.`);
}

function setUrlAttribute(node, tag, name, value) {
  const lower = name.toLowerCase();
  if (lower === 'srcset') {
    const candidates = value.split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
    if (candidates.length === 0 || !candidates.every((url) => isSafeUrl(url))) throw new TypeError('Unsichere Adresse in „srcset“.');
  } else if (!isSafeUrl(value, { allowImageData: tag === 'img' && lower === 'src' })) {
    throw new TypeError(`Unsichere Adresse in „${name}“ – erlaubt sind relative Pfade und https.`);
  }
  node.setAttribute(name, value);
}

function applyAttributes(node, tag, attrs) {
  if (attrs === null || attrs === undefined) return;
  if (typeof attrs !== 'object' || Array.isArray(attrs)) throw new TypeError('Attribute müssen als Objekt übergeben werden.');
  for (const [name, raw] of Object.entries(attrs)) {
    if (raw === null || raw === undefined || raw === false) continue;
    if (name === 'class' || name === 'className') {
      const value = Array.isArray(raw) ? raw.filter(Boolean).join(' ') : attributeValue('class', raw);
      if (value) node.setAttribute('class', value);
      continue;
    }
    if (name === 'dataset') {
      for (const [key, value] of Object.entries(raw)) {
        if (!DATASET_KEY.test(key)) throw new TypeError(`Ungültiger data-Schlüssel „${key}“.`);
        if (value === null || value === undefined) continue;
        node.dataset[key] = attributeValue(`data-${key}`, value);
      }
      continue;
    }
    if (name === 'on') {
      for (const [type, handler] of Object.entries(raw)) {
        if (typeof handler !== 'function') throw new TypeError(`Ereignis „${type}“: Funktion erwartet.`);
        node.addEventListener(type, handler);
      }
      continue;
    }
    assertAttributeName(name);
    if (raw === true) {
      node.setAttribute(name, '');
      continue;
    }
    const value = attributeValue(name, raw);
    if (URL_ATTRIBUTES.has(name.toLowerCase()) || name.toLowerCase() === 'srcset') setUrlAttribute(node, tag, name, value);
    else node.setAttribute(name, value);
  }
}

function isDomNode(value) {
  return value !== null && typeof value === 'object' && typeof value.nodeType === 'number';
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') node.append(document.createTextNode(String(child)));
    else if (isDomNode(child)) node.append(child);
    else throw new TypeError('Kindelemente: nur Text, Zahlen oder DOM-Knoten erlaubt.');
  }
}

/**
 * Baut ein HTML-Element. Text wird immer als Textknoten eingesetzt (nie als HTML).
 * attrs: normale Attribute, class (Text oder Liste), dataset (Objekt), on (Ereignis → Funktion).
 */
export function el(tag, attrs = null, ...children) {
  if (typeof tag !== 'string' || !TAG_NAME.test(tag)) throw new TypeError(`Ungültiger Elementname „${String(tag)}“.`);
  if (FORBIDDEN_HTML_TAGS.has(tag)) throw new TypeError(`Das Element <${tag}> darf nicht erzeugt werden.`);
  const node = document.createElement(tag);
  applyAttributes(node, tag, attrs);
  appendChildren(node, children);
  return node;
}

/** Wie el(), aber für SVG-Elemente (nur eine kleine, harmlose Auswahl). */
export function svgEl(tag, attrs = null, ...children) {
  if (typeof tag !== 'string' || !SVG_TAG_NAME.test(tag) || !ALLOWED_SVG_TAGS.has(tag)) throw new TypeError(`Das SVG-Element <${String(tag)}> ist nicht erlaubt.`);
  const node = document.createElementNS(SVG_NS, tag);
  applyAttributes(node, tag, attrs);
  appendChildren(node, children);
  return node;
}

/** Entfernt alle Kindknoten und gibt den Knoten zurück. */
export function clear(node) {
  node.replaceChildren();
  return node;
}

/** Ersetzt den Inhalt wie el(): Text als Textknoten, null/undefined/false werden übersprungen. */
export function setChildren(node, ...children) {
  clear(node);
  appendChildren(node, children);
  return node;
}

/** Holt ein Element per ID; fehlt es, ist das ein Fehler im Seitengerüst. */
export function requireElement(id, root = document) {
  const node = root.getElementById(id);
  if (!node) throw new Error(`Seitengerüst unvollständig: Element #${id} fehlt.`);
  return node;
}
