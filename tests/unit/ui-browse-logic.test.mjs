// Reine Logik der Start- und Kategorie-Seite: Größenklassen, Filter, Sortierung, Zustand in der Adresse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE_CLASSES, sizeClassForBlocks, sizeClassOf, sizeClassRange, testStateOf, volumeOf, formatStatNumber,
} from '../../js/ui/browse/model.js';
import {
  FILTER_KEYS, emptyFilters, filterValuesOf, matchesFilters, applyFilters, facetCounts, presentValues, visibleFilterOptions,
  activeFilterCount, allowedFilterValues,
} from '../../js/ui/browse/filters.js';
import { SORT_KEYS, sortItems, defaultSort, isSortAvailable } from '../../js/ui/browse/sort.js';
import {
  parseBrowseState, browseSearch, browseHref, categoryParam, sameBrowseState, resetBrowseState,
} from '../../js/ui/browse/url-state.js';

const build = (id, fields = {}) => ({ id, title: id, category: 'haeuser', tags: [], aliases: [], subtitle: '', ...fields });
const item = (b) => ({ build: b, values: filterValuesOf(b), volume: volumeOf(b) });

test('Größenklassen: Grenzen wie im Katalog (klein < 1 000 ≤ mittel < 10 000 ≤ gross < 100 000 ≤ riesig)', () => {
  assert.deepEqual(SIZE_CLASSES.map((c) => c.key), ['klein', 'mittel', 'gross', 'riesig']);
  const cases = [[0, 'klein'], [999, 'klein'], [1000, 'mittel'], [9999, 'mittel'], [10000, 'gross'], [99999, 'gross'], [100000, 'riesig'], [3_000_000, 'riesig']];
  for (const [blocks, expected] of cases) assert.equal(sizeClassForBlocks(blocks), expected, `${blocks}`);
  for (const bad of [null, undefined, -1, 1.5, '12', NaN]) assert.equal(sizeClassForBlocks(bad), null);
  // Angabe aus dem Katalog hat Vorrang, ungültige Angabe → aus der Blockzahl
  assert.equal(sizeClassOf({ sizeClass: 'riesig', blocks: 5 }), 'riesig');
  assert.equal(sizeClassOf({ sizeClass: 'huge', blocks: 5 }), 'klein');
  assert.equal(sizeClassOf({ blocks: null }), null);
  assert.equal(sizeClassRange('klein'), 'unter 1.000 Blöcke');
  assert.equal(sizeClassRange('mittel'), '1.000 bis 9.999 Blöcke');
  assert.equal(sizeClassRange('riesig'), 'ab 100.000 Blöcke');
  assert.equal(sizeClassRange('x'), null);
});

test('Test im Spiel, Rauminhalt und kompakte Zahlen', () => {
  assert.equal(testStateOf({ tested: true }), 'getestet');
  assert.equal(testStateOf({ tested: false }), 'ungetestet');
  assert.equal(testStateOf({ tested: null }), 'ohne');
  assert.equal(testStateOf({}), 'ohne');
  assert.equal(volumeOf({ size: [2, 3, 4] }), 24);
  assert.equal(volumeOf({ size: [2, 0, 4] }), null);
  assert.equal(volumeOf({ size: null }), null);
  assert.equal(formatStatNumber(12345), '12.345');
  assert.equal(formatStatNumber(999999), '999.999');
  assert.match(formatStatNumber(6_940_841), /^6,9\sMio\.$/);
  assert.equal(formatStatNumber(NaN), '–');
});

test('Filter: „oder“ innerhalb einer Gruppe, „und“ zwischen Gruppen', () => {
  const items = [
    item(build('a', { blocks: 50, accuracy: 'eigenes', tested: null })),
    item(build('b', { blocks: 5000, accuracy: 'original', tested: null })),
    item(build('c', { blocks: 50000, accuracy: 'massstab', tested: false })),
    item(build('d', { blocks: 200, accuracy: 'eigenes', tested: true })),
  ];
  const filters = { ...emptyFilters(), groesse: ['klein', 'gross'] };
  assert.deepEqual(applyFilters(items, filters).map((i) => i.build.id), ['a', 'c', 'd']);
  const both = { ...filters, herkunft: ['original', 'massstab'] };
  assert.deepEqual(applyFilters(items, both).map((i) => i.build.id), ['c']);
  assert.equal(activeFilterCount(both), 4);
  assert.equal(matchesFilters(items[0].values, both), false);
  assert.equal(matchesFilters(items[0].values, both, 'herkunft'), true);
  // Zählung je Option: die eigene Gruppe zählt nicht mit, die anderen schon
  const counts = facetCounts(items, both);
  assert.deepEqual(counts.groesse, { klein: 0, mittel: 1, gross: 1, riesig: 0 });
  assert.deepEqual(counts.herkunft, { original: 0, massstab: 1, vorlage: 0, nachempfunden: 0, eigenes: 2 });
  assert.deepEqual(counts.test, { getestet: 0, ungetestet: 1, ohne: 0 });
});

test('Filter: keine Schwierigkeit mehr, alte Felder im Eintrag stören nicht', () => {
  assert.deepEqual(FILTER_KEYS, ['groesse', 'herkunft', 'test']);
  const values = filterValuesOf(build('alt', { blocks: 50, accuracy: 'eigenes', difficulty: 3 }));
  assert.deepEqual(values, { groesse: 'klein', herkunft: 'eigenes', test: 'ohne' });
  assert.deepEqual(allowedFilterValues('schwierigkeit'), []);
});

test('Filter: Gruppen erscheinen nur, wenn sie etwas unterscheiden oder etwas gewählt ist', () => {
  const items = [item(build('a', { blocks: 10, accuracy: 'eigenes', tested: true })), item(build('b', { blocks: 20, accuracy: 'eigenes', tested: false }))];
  const present = presentValues(items);
  const groups = Object.fromEntries(visibleFilterOptions(present, emptyFilters()).map((g) => [g.key, g]));
  assert.deepEqual(Object.keys(groups), ['groesse', 'herkunft', 'test']);
  assert.equal(groups.groesse.visible, false, 'nur eine Größe');
  assert.equal(groups.test.visible, true);
  assert.deepEqual(groups.test.options.map((o) => o.value), ['getestet', 'ungetestet']);
  assert.equal(groups.herkunft.visible, false);
  // Über die Adresse gewählt, aber nicht vorhanden → trotzdem sichtbar (sonst ließe es sich nicht abwählen)
  const selected = Object.fromEntries(visibleFilterOptions(present, { ...emptyFilters(), herkunft: ['original'] }).map((g) => [g.key, g]));
  assert.equal(selected.herkunft.visible, true);
  assert.deepEqual(selected.herkunft.options.map((o) => o.value), ['original', 'eigenes']);
});

test('Sortierung: alle Schlüssel, fehlende Werte am Ende, Gleichstand nach Name', () => {
  const items = [
    item(build('zelt', { title: 'Zelt', blocks: 10, size: [3, 2, 3] })),
    item(build('aerger', { title: 'Ärger-Turm', blocks: 10, size: [5, 20, 5] })),
    item(build('burg', { title: 'Burg', blocks: 900, size: null })),
    item(build('brunnen', { title: 'brunnen', blocks: null, size: [3, 3, 3] })),
  ];
  const ids = (key) => sortItems(items, key).map((i) => i.build.id);
  assert.deepEqual(ids('name'), ['aerger', 'brunnen', 'burg', 'zelt'], 'deutsch, ohne Groß/Klein, Ä wie A');
  assert.deepEqual(ids('bloecke-auf'), ['aerger', 'zelt', 'burg', 'brunnen']);
  assert.deepEqual(ids('bloecke-ab'), ['burg', 'aerger', 'zelt', 'brunnen']);
  assert.deepEqual(ids('groesse-auf'), ['zelt', 'brunnen', 'aerger', 'burg']);
  assert.deepEqual(ids('groesse-ab'), ['aerger', 'brunnen', 'zelt', 'burg']);
  // Nach Schwierigkeit sortiert die Seite nicht mehr
  assert.deepEqual(SORT_KEYS, ['relevanz', 'name', 'groesse-auf', 'groesse-ab', 'bloecke-auf', 'bloecke-ab']);
  assert.throws(() => sortItems(items, 'schwierigkeit-auf'), /Unbekannte Sortierung/);
  const scored = items.map((entry, i) => ({ ...entry, score: [1, 5, 5, 0][i] }));
  assert.deepEqual(sortItems(scored, 'relevanz').map((i) => i.build.id), ['aerger', 'burg', 'zelt', 'brunnen']);
  assert.throws(() => sortItems(items, 'zufall'), /Unbekannte Sortierung/);
  assert.equal(sortItems(items, 'name')[0], items[1], 'sortiert eine Kopie, das Original bleibt');
  assert.equal(items[0].build.id, 'zelt');
  assert.ok(SORT_KEYS.every((key) => key === 'relevanz' || isSortAvailable(key, '')));
  assert.equal(isSortAvailable('relevanz', ''), false);
  assert.equal(isSortAvailable('relevanz', 'turm'), true);
  assert.equal(defaultSort(''), 'name');
  assert.equal(defaultSort('turm'), 'relevanz');
});

test('Adresse: nur erlaubte Werte, Mehrfachwerte, feste Reihenfolge', () => {
  const state = parseBrowseState('?k=farmen&q=  Kaktus%20%20Farm  &groesse=riesig&groesse=klein,mittel&groesse=klein&groesse=winzig&herkunft=original&test=ungetestet&sort=bloecke-ab&foo=1');
  assert.equal(state.query, 'Kaktus Farm');
  assert.deepEqual(state.filters, { groesse: ['klein', 'mittel', 'riesig'], herkunft: ['original'], test: ['ungetestet'] });
  assert.equal(state.sort, 'bloecke-ab');
  assert.deepEqual(state.ignored, ['groesse=winzig']);
  // Alte Adressen mit Schwierigkeit: Filter fällt still weg, Sortierung zurück auf den Standard
  const old = parseBrowseState('?k=klein&schwierigkeit=1&schwierigkeit=2&sort=schwierigkeit-auf');
  assert.deepEqual(old.filters, emptyFilters());
  assert.equal(old.sort, 'name');
  assert.equal(parseBrowseState('?q=turm&sort=schwierigkeit-ab').sort, 'relevanz');
  assert.equal(browseSearch('klein', old), '?k=klein', 'die Adresse wird ohne die alten Angaben neu geschrieben');
  // Angriffsversuche fallen weg, nichts davon landet im Zustand
  const evil = parseBrowseState('?groesse=<img src=x onerror=alert(1)>&sort=javascript:alert(1)&herkunft=__proto__');
  assert.deepEqual(evil.filters, emptyFilters());
  assert.equal(evil.sort, 'name');
  assert.equal(evil.ignored.length, 3);
  assert.ok(evil.ignored.every((entry) => entry.length <= 60), 'gemeldete Werte sind gekürzt');
  // „Passend zuerst“ nur mit Suche
  assert.equal(parseBrowseState('?sort=relevanz').sort, 'name');
  assert.equal(parseBrowseState('?q=turm').sort, 'relevanz');
  assert.equal(parseBrowseState(`?q=${'a'.repeat(500)}`).query.length, 120);
  assert.deepEqual(allowedFilterValues('unbekannt'), []);
  assert.equal(FILTER_KEYS.length, 3);
});

test('Adresse: Schreiben und Lesen ergeben denselben Zustand, Standardwerte fehlen', () => {
  const state = { query: 'Brücke', filters: { ...emptyFilters(), herkunft: ['massstab', 'original'], test: ['ohne'] }, sort: 'groesse-ab' };
  const search = browseSearch('infrastruktur', state);
  assert.equal(search, '?k=infrastruktur&q=Br%C3%BCcke&herkunft=original&herkunft=massstab&test=ohne&sort=groesse-ab');
  const back = parseBrowseState(search);
  assert.ok(sameBrowseState(back, { ...state, filters: { ...state.filters, herkunft: ['original', 'massstab'] } }));
  assert.equal(browseSearch('klein', { query: '', filters: emptyFilters(), sort: 'name' }), '?k=klein');
  assert.equal(browseSearch('klein', { query: 'x', filters: emptyFilters(), sort: 'relevanz' }), '?k=klein&q=x');
  assert.equal(browseSearch('klein', { query: '', filters: emptyFilters(), sort: 'relevanz' }), '?k=klein', 'unpassende Sortierung fällt weg');
  assert.equal(browseHref('farmen', { sort: 'bloecke-ab' }), 'kategorie.html?k=farmen&sort=bloecke-ab');
  assert.equal(browseSearch(null, {}), '');
  assert.deepEqual(categoryParam('?k=haeuser'), { kind: 'category', slug: 'haeuser' });
  assert.deepEqual(categoryParam('?k='), { kind: 'overview' });
  assert.deepEqual(categoryParam(''), { kind: 'overview' });
  assert.deepEqual(resetBrowseState({ query: 'x', filters: { ...emptyFilters(), groesse: ['klein'] }, sort: 'relevanz' }), { query: '', filters: emptyFilters(), sort: 'name' });
  assert.equal(resetBrowseState({ query: 'x', filters: emptyFilters(), sort: 'bloecke-ab' }).sort, 'bloecke-ab');
});

test('Kontraste der neuen Farbpaare (css/browse.css) erreichen WCAG AA', async () => {
  const { readFile } = await import('node:fs/promises');
  const { contrastRatio, mixHex, CATEGORIES } = await import('../../js/ui/shared.js');
  const css = await readFile(new URL('../../css/style.css', import.meta.url), 'utf8');
  const token = (name) => {
    const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(css);
    assert.ok(match, `Token --${name} fehlt in style.css`);
    return match[1];
  };
  const [text, muted, surface, surface2, grass, redstone, gold, onAccent, grassText, slot, head, bg, line] = [
    'c-text', 'c-text-muted', 'c-surface', 'c-surface-2', 'c-grass', 'c-redstone', 'c-gold', 'c-on-accent', 'c-grass-text', 'c-slot', 'c-head', 'c-bg', 'c-line',
  ].map(token);
  const pairs = [
    ['Text auf aktivem Filter-Chip', text, mixHex(grass, surface2, 0.18), 4.5],
    ['Text auf aktivem Filter-Chip (Hover)', text, mixHex(redstone, surface2, 0.22), 4.5],
    ['Gewählte Filteroption', grassText, surface, 4.5],
    ['Leere Filteroption, Anzahl und Bereich', muted, surface, 4.5],
    ['Zahl im Filter-Knopf', onAccent, gold, 4.5],
    ['Schrittnummer „So funktioniert’s“', gold, slot, 4.5],
    ['Kennzahlen im Seitenkopf', muted, head, 4.5],
  ];
  for (const category of CATEGORIES) {
    pairs.push([`Link „Mehr davon“ ${category.slug}`, text, mixHex(category.color, surface, 0.2), 4.5]);
    pairs.push([`Rand des Links ${category.slug} (Grafik)`, mixHex(category.color, line, 0.75), bg, 3]);
  }
  for (const [label, fg, back, min] of pairs) {
    const ratio = contrastRatio(fg, back);
    assert.ok(ratio >= min, `${label}: ${ratio.toFixed(2)} : 1 < ${min}`);
  }
  // Die Mischanteile im Test entsprechen denen im CSS
  const browse = await readFile(new URL('../../css/browse.css', import.meta.url), 'utf8');
  for (const snippet of ['var(--c-grass) 18%, var(--c-surface-2)', 'var(--c-redstone) 22%, var(--c-surface-2)', 'var(--cat) 20%, var(--c-surface)', 'var(--cat) 75%, var(--c-line)']) {
    assert.ok(browse.includes(snippet), `browse.css: ${snippet}`);
  }
  assert.doesNotMatch(browse, /opacity:\s*0\.[0-6]/, 'keine stark ausgeblendeten Texte');
});
