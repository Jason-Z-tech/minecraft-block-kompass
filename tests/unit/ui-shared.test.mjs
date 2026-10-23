import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES, CATEGORY_SLUGS, ACCURACY_LABELS, ICON_NAMES, SEARCH_MAX_LENGTH, findCategory, accuracyLabel, difficultyLabel,
  isValidBuildId, formatNumber, formatCount, formatSize, normalizeSearchQuery, searchHref, parseBuildParams, parseScale,
  storageGet, storageSet, storageRemove, parseHex, contrastRatio, mixHex,
} from '../../js/ui/shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = new URL('http://127.0.0.1:8080/');

test('Kategorien: Slugs, Titel und Reihenfolge wie ARCHITEKTUR §8, Farben wie §11', () => {
  assert.deepEqual(CATEGORIES.map((c) => [c.slug, c.title, c.color]), [
    ['haeuser', 'Häuser & Wohnen', '#b8945f'],
    ['wahrzeichen', 'Wahrzeichen & Riesenbauten', '#f2c14e'],
    ['fantasy', 'Fantasy, Anime & Film', '#9a5cc6'],
    ['mittelalter', 'Mittelalter & Burgen', '#9a9a9a'],
    ['klein', 'Kleine Projekte & Deko', '#e57ca3'],
    ['redstone', 'Redstone', '#e0342f'],
    ['farmen', 'Farmen & Technik', '#d9b84a'],
    ['infrastruktur', 'Brücken, Bahnhöfe & Häfen', '#d0703c'],
  ]);
  assert.deepEqual(CATEGORY_SLUGS, CATEGORIES.map((c) => c.slug));
  for (const category of CATEGORIES) {
    assert.ok(category.shortTitle && category.description && category.colorName, category.slug);
    assert.ok(ICON_NAMES.includes(category.icon), `Icon ${category.icon}`);
  }
});

test('Kategorien sind unveränderlich', () => {
  assert.ok(Object.isFrozen(CATEGORIES));
  assert.ok(CATEGORIES.every((category) => Object.isFrozen(category)));
  assert.throws(() => { CATEGORIES[0].title = 'x'; }, TypeError);
  assert.throws(() => { CATEGORIES.push({}); }, TypeError);
});

test('Kategorie-Farben stimmen mit den CSS-Tokens --cat-<slug> überein', async () => {
  const css = await readFile(path.join(ROOT, 'css', 'style.css'), 'utf8');
  for (const category of CATEGORIES) {
    const match = new RegExp(`--cat-${category.slug}:\\s*(#[0-9a-f]{6});`, 'i').exec(css);
    assert.ok(match, `Token --cat-${category.slug} fehlt`);
    assert.equal(match[1].toLowerCase(), category.color, category.slug);
    assert.match(css, new RegExp(`\\[data-category='${category.slug}'\\]\\s*\\{\\s*--cat: var\\(--cat-${category.slug}\\);`), `data-category-Regel für ${category.slug}`);
  }
});

test('findCategory, Herkunfts-Labels und Schwierigkeit', () => {
  assert.equal(findCategory('redstone').title, 'Redstone');
  for (const bad of ['x', '', null, '__proto__', 'Redstone']) assert.equal(findCategory(bad), null, String(bad));
  assert.deepEqual(ACCURACY_LABELS, {
    original: 'Original aus dem Spiel', massstab: 'Nach echten Maßen', vorlage: 'Nach bekannter Vorlage',
    nachempfunden: 'Nachempfunden', eigenes: 'Eigenes Design',
  });
  assert.equal(accuracyLabel('massstab'), 'Nach echten Maßen');
  assert.equal(accuracyLabel('toString'), null);
  assert.equal(accuracyLabel('unbekannt'), null);
  assert.equal(difficultyLabel(1), 'Sehr leicht');
  assert.equal(difficultyLabel(5), 'Sehr schwer');
  for (const bad of [0, 6, 2.5, '3', null]) assert.equal(difficultyLabel(bad), null);
});

test('Alle Icons der Liste stehen im Sprite und umgekehrt', async () => {
  const sprite = await readFile(path.join(ROOT, 'assets', 'icons.svg'), 'utf8');
  const symbols = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...symbols].sort(), [...ICON_NAMES].sort());
  assert.equal(new Set(ICON_NAMES).size, ICON_NAMES.length, 'doppelte Icon-Namen');
});

test('formatNumber: deutsche Tausendertrennung und Dezimalkomma', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(7), '7');
  assert.equal(formatNumber(1234), '1.234');
  assert.equal(formatNumber(1234567), '1.234.567');
  assert.equal(formatNumber(-1234), '-1.234');
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(0.5), '0,5');
  assert.equal(formatNumber(12.345), '12,35');
  assert.equal(formatNumber(12.5, { maximumFractionDigits: 0 }), '13');
  for (const missing of [null, undefined, Number.NaN, Infinity, -Infinity]) assert.equal(formatNumber(missing), '–');
  assert.throws(() => formatNumber('12'), TypeError);
  assert.throws(() => formatNumber(12n), TypeError);
});

test('formatCount und formatSize', () => {
  assert.equal(formatCount(1, 'Bau', 'Bauten'), '1 Bau');
  assert.equal(formatCount(0, 'Bau', 'Bauten'), '0 Bauten');
  assert.equal(formatCount(1234, 'Block', 'Blöcke'), '1.234 Blöcke');
  assert.equal(formatSize([64, 120, 64]), '64 × 120 × 64');
  assert.equal(formatSize([1200, 3, 4]), '1.200 × 3 × 4');
  assert.equal(formatSize(null), '–');
  assert.equal(formatSize([1, 2]), '–');
});

test('normalizeSearchQuery: trimmen, Leerraum zusammenfassen, Steuerzeichen raus', () => {
  const nl = String.fromCharCode(10);
  const tab = String.fromCharCode(9);
  const zeroWidth = String.fromCharCode(0x200b);
  const lineSeparator = String.fromCharCode(0x2028);
  assert.equal(normalizeSearchQuery('  Turm  '), 'Turm');
  assert.equal(normalizeSearchQuery(`Burg${tab}am${nl}${nl}See`), 'Burg am See');
  assert.equal(normalizeSearchQuery(`Bu${zeroWidth}rg${lineSeparator}Turm`), 'Burg Turm');
  assert.equal(normalizeSearchQuery(`a${String.fromCharCode(0)}b${String.fromCharCode(0x7f)}c`), 'a b c');
  assert.equal(normalizeSearchQuery('Straße  „Brücke“'), 'Straße „Brücke“');
  assert.equal(normalizeSearchQuery('   '), '');
  for (const value of [null, undefined, 42, {}]) assert.equal(normalizeSearchQuery(value), '');
});

test('normalizeSearchQuery begrenzt auf 120 Zeichen, ohne Emoji zu zerschneiden', () => {
  assert.equal(SEARCH_MAX_LENGTH, 120);
  assert.equal(normalizeSearchQuery('a'.repeat(200)).length, 120);
  const emoji = String.fromCodePoint(0x1f3f0);
  const atBoundary = normalizeSearchQuery(`${'a'.repeat(119)}${emoji}bcd`);
  assert.equal(Array.from(atBoundary).length, 120);
  assert.ok(atBoundary.endsWith(emoji), 'Emoji bleibt ganz');
  // Leerzeichen genau an der Schnittkante wird anschließend abgeschnitten
  assert.equal(normalizeSearchQuery(`${'a'.repeat(119)} b`), 'a'.repeat(119));
  // Kombinierte Zeichen werden zu NFC zusammengefasst
  assert.equal(normalizeSearchQuery(`Hu${String.fromCharCode(0x308)}tte`), 'Hütte');
});

test('searchHref baut die Adresse der Freitext-Seite sicher zusammen', () => {
  assert.equal(searchHref('  Burg am See ', SITE), '/erstellen.html?q=Burg%20am%20See');
  assert.equal(searchHref('', SITE), '/erstellen.html');
  assert.equal(searchHref('a&b=c#d<x>', SITE), '/erstellen.html?q=a%26b%3Dc%23d%3Cx%3E');
  assert.equal(searchHref('x'.repeat(300), SITE), `/erstellen.html?q=${'x'.repeat(120)}`);
});

test('parseBuildParams und parseScale prüfen die Adresse der Bau-Seite', () => {
  assert.deepEqual(parseBuildParams('?id=tokyo-skytree'), { kind: 'build', id: 'tokyo-skytree', scale: null });
  assert.deepEqual(parseBuildParams('?id=turm-2&scale=0.5'), { kind: 'build', id: 'turm-2', scale: 0.5 });
  assert.deepEqual(parseBuildParams('?form=wendeltreppe'), { kind: 'form', form: 'wendeltreppe' });
  assert.deepEqual(parseBuildParams(''), { kind: 'none' });
  assert.deepEqual(parseBuildParams('?id=Tokyo'), { kind: 'invalid', reason: 'id' });
  assert.deepEqual(parseBuildParams('?id=a'), { kind: 'invalid', reason: 'id' });
  assert.deepEqual(parseBuildParams(`?id=${'a'.repeat(81)}`), { kind: 'invalid', reason: 'id' });
  assert.deepEqual(parseBuildParams('?id=%3Cscript%3E'), { kind: 'invalid', reason: 'id' });
  assert.deepEqual(parseBuildParams('?id=turm&scale=0'), { kind: 'invalid', reason: 'scale' });
  assert.deepEqual(parseBuildParams('?id=turm&scale=abc'), { kind: 'invalid', reason: 'scale' });
  assert.deepEqual(parseBuildParams('?form=Turm!'), { kind: 'invalid', reason: 'form' });
  assert.deepEqual(parseBuildParams('?id=turm&form=kugel'), { kind: 'invalid', reason: 'both' });
  assert.equal(parseScale('1'), 1);
  assert.equal(parseScale('0.25'), 0.25);
  assert.equal(parseScale('4'), 4);
  for (const bad of ['4.5', '0', '-1', '1e2', '0.12345', ' 1', '1,5', '', null]) assert.equal(parseScale(bad), null, String(bad));
  assert.equal(isValidBuildId('tokyo-skytree'), true);
  assert.equal(isValidBuildId('Tokyo'), false);
});

function withStorage(storage, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: typeof storage === 'function' ? storage : () => storage });
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    fn(warnings);
  } finally {
    console.warn = warn;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
}

test('localStorage-Helfer: JSON hin und zurück, fehlende Werte → Standard', () => {
  const storage = memoryStorage();
  withStorage(storage, (warnings) => {
    assert.equal(storageGet('bk:progress:turm', 0), 0);
    assert.equal(storageSet('bk:progress:turm', { step: 12, done: [1, 2] }), true);
    assert.deepEqual(storageGet('bk:progress:turm'), { step: 12, done: [1, 2] });
    assert.equal(storage.map.get('bk:progress:turm'), '{"step":12,"done":[1,2]}');
    assert.equal(storageRemove('bk:progress:turm'), true);
    assert.equal(storageGet('bk:progress:turm', 'leer'), 'leer');
    storage.map.set('bk:kaputt', '{nicht json');
    assert.equal(storageGet('bk:kaputt', 'standard'), 'standard');
    assert.equal(warnings.length, 1, 'kaputter Wert wird gemeldet, nicht still geschluckt');
  });
});

test('localStorage-Helfer: gesperrter oder voller Speicher bricht nichts ab', () => {
  withStorage(() => { throw new Error('SecurityError'); }, (warnings) => {
    assert.equal(storageGet('bk:x', 'standard'), 'standard');
    assert.equal(storageSet('bk:x', 1), false);
    assert.equal(storageRemove('bk:x'), false);
    assert.ok(warnings.length >= 3);
  });
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('kaputt'); } };
  withStorage(full, (warnings) => {
    assert.equal(storageSet('bk:x', 'x'.repeat(10)), false);
    assert.equal(storageRemove('bk:x'), false);
    assert.equal(warnings.length, 2);
  });
  withStorage(null, () => {
    assert.equal(storageGet('bk:x', 3), 3);
    assert.equal(storageSet('bk:x', 3), false);
  });
});

test('localStorage-Helfer verlangen den Präfix bk:', () => {
  withStorage(memoryStorage(), () => {
    for (const key of ['progress', 'xbk:a', '', null, `bk:${'a'.repeat(300)}`]) {
      assert.throws(() => storageGet(key), TypeError, String(key));
      assert.throws(() => storageSet(key, 1), TypeError, String(key));
    }
  });
});

test('Farbfunktionen: Hex lesen, Kontrast nach WCAG, Mischen wie color-mix', () => {
  assert.deepEqual(parseHex('#abc'), [0xaa, 0xbb, 0xcc]);
  assert.deepEqual(parseHex('#15171B'), [0x15, 0x17, 0x1b]);
  assert.throws(() => parseHex('red'), TypeError);
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('#5da33b', '#5da33b'), 1);
  assert.equal(Number(contrastRatio('#777777', '#ffffff').toFixed(2)), 4.48);
  assert.equal(mixHex('#ffffff', '#000000', 0.5), '#808080');
  assert.equal(mixHex('#f2c14e', '#272b32', 0.16), '#474336');
});
