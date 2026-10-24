// Textsuche, Ansicht der Kategorie-Seite und Abschnitte der Startseite – mit dem Test-Katalog
// tests/fixtures/ui/browse-catalog.json (Format von Runde 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCatalog } from '../../js/ui/data.js';
import { CATEGORY_SLUGS } from '../../js/ui/shared.js';
import { searchCatalog } from '../../js/create/search.js';
import { createBrowseIndex, computeView, initialShown, nextShown, BATCH_SIZE } from '../../js/ui/browse/view.js';
import { emptyFilters } from '../../js/ui/browse/filters.js';
import { parseBrowseState, browseSearch } from '../../js/ui/browse/url-state.js';
import { sizeClassForBlocks } from '../../js/ui/browse/model.js';
import { selectHomeSections, catalogTotals, diversify, HOME_SECTIONS, SECTION_SIZE } from '../../js/ui/browse/home-sections.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const raw = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/ui/browse-catalog.json'), 'utf8'));
const catalog = normalizeCatalog(raw);
const inCategory = (slug) => catalog.builds.filter((build) => build.category === slug);
const state = (search) => {
  const parsed = parseBrowseState(search);
  return { query: parsed.query, filters: parsed.filters, sort: parsed.sort };
};

test('Test-Katalog: gültiges Format von Runde 2, alle Einträge übernommen', () => {
  assert.equal(raw.version, '26.2');
  assert.equal(catalog.skipped, 0);
  assert.equal(catalog.builds.length, raw.counts.total);
  assert.ok(catalog.builds.length >= 150);
  for (const slug of CATEGORY_SLUGS) assert.equal(inCategory(slug).length, raw.counts.byCategory[slug], slug);
  for (const build of raw.builds) {
    assert.equal(build.sizeClass, sizeClassForBlocks(build.blocks), `${build.id}: Größenklasse`);
    assert.ok(build.blocks <= build.size[0] * build.size[1] * build.size[2], `${build.id}: Blöcke passen in die Größe`);
    if (build.id.startsWith('spiel-')) {
      assert.equal(build.accuracy, 'original');
      assert.equal(build.module, null);
      assert.ok(build.structure);
    }
    if (build.scales) assert.deepEqual(Object.keys(build.variants), build.scales.map(String));
  }
  assert.ok(catalog.builds.some((build) => build.thumb) && catalog.builds.some((build) => !build.thumb), 'mit und ohne Vorschaubild');
  assert.ok(catalog.builds.some((build) => build.tested === false) && catalog.builds.some((build) => build.tested === true));
  // data.js übernimmt die neuen Felder
  const skytree = catalog.builds.find((build) => build.id === 'tokyo-skytree');
  assert.equal(skytree.sizeClass, 'riesig');
  assert.equal(skytree.defaultScale, 1);
  assert.deepEqual(skytree.variants['0.5'].size, [34, 317, 34]);
  assert.equal(skytree.sources[0].url, 'https://de.wikipedia.org/wiki/Tokyo_Skytree');
});

test('Textsuche über searchCatalog (js/create/search.js): Vertrag und Einsatz in der Ansicht', () => {
  const hits = searchCatalog(catalog, 'brücke', { limit: 50 });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((hit) => catalog.builds.includes(hit.entry) && Number.isFinite(hit.score)), '[{ entry, score }] mit Einträgen aus dem Katalog');
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score, 'beste zuerst');
  assert.ok(searchCatalog(catalog, 'turm', { category: 'mittelalter', limit: 50 }).every((hit) => hit.entry.category === 'mittelalter'));
  // Die Ansicht nutzt sie ohne Angabe: gleiche Treffer wie ein direkter Aufruf, nur in der Kategorie
  const builds = inCategory('wahrzeichen');
  const view = computeView(createBrowseIndex(builds), state('?q=skytree'), { category: 'wahrzeichen' });
  const direct = searchCatalog({ builds }, 'skytree', { limit: builds.length, category: 'wahrzeichen' }).map((hit) => hit.entry.id);
  assert.deepEqual(view.results.map((build) => build.id), direct);
  assert.equal(view.results[0].id, 'tokyo-skytree');
  assert.equal(computeView(createBrowseIndex(builds), state('?q=zzzz')).results.length, 0);
});

test('Ansicht: Suche → Filter → Sortierung, Zählung je Option', () => {
  const index = createBrowseIndex(inCategory('klein'));
  const all = computeView(index, state(''));
  assert.equal(all.total, 41);
  assert.equal(all.results.length, 41);
  assert.equal(all.results[0].title, 'Aquarium');
  const garden = computeView(index, state('?q=garten&schwierigkeit=1&sort=bloecke-ab'), { category: 'klein' });
  assert.equal(garden.searched, 13);
  assert.ok(garden.results.length > 0 && garden.results.length < garden.searched);
  assert.ok(garden.results.every((build) => build.difficulty === 1));
  for (let i = 1; i < garden.results.length; i++) assert.ok(garden.results[i - 1].blocks >= garden.results[i].blocks);
  assert.equal(garden.counts.schwierigkeit['1'], garden.results.length);
  assert.equal(garden.counts.schwierigkeit['1'] + garden.counts.schwierigkeit['2'], garden.searched);
  assert.equal(garden.activeFilters, 1);
  // Nichts passt → leere Liste, keine Ausnahme
  assert.deepEqual(computeView(index, state('?q=zzzz')).results, []);
});

test('Ansicht: fremde Suchfunktion nach dem Vertrag von searchCatalog wird genutzt und geprüft', () => {
  const builds = inCategory('redstone');
  const index = createBrowseIndex(builds);
  const calls = [];
  const fake = (cat, query, options) => {
    calls.push({ count: cat.builds.length, query, options });
    return [{ entry: builds[3], score: 2 }, { entry: { id: 'fremd' }, score: 9 }, { entry: builds[1], score: 5 }, { entry: builds[1], score: 1 }];
  };
  const view = computeView(index, state('?q=irgendwas'), { search: fake, category: 'redstone' });
  assert.deepEqual(calls, [{ count: builds.length, query: 'irgendwas', options: { limit: builds.length, category: 'redstone' } }]);
  assert.deepEqual(view.results.map((build) => build.id), [builds[1].id, builds[3].id], 'unbekannte und doppelte Treffer fallen weg');
  assert.throws(() => computeView(index, state('?q=x'), { search: () => null }), /keine Trefferliste/);
});

test('Ansicht: über 300 Einträge schnell genug, Nachladen in Schritten', () => {
  const many = Array.from({ length: 1200 }, (_, i) => ({ ...catalog.builds[i % catalog.builds.length], id: `bau-${i}`, title: `${catalog.builds[i % catalog.builds.length].title} ${i}` }));
  const start = performance.now();
  const index = createBrowseIndex(many);
  for (const search of ['', '?q=turm', '?groesse=klein&schwierigkeit=1&schwierigkeit=2', '?q=haus&sort=bloecke-ab&herkunft=eigenes']) computeView(index, state(search));
  const ms = performance.now() - start;
  assert.ok(ms < 1000, `zu langsam: ${ms.toFixed(0)} ms`);
  assert.equal(BATCH_SIZE % 12, 0);
  assert.equal(initialShown(null, 1200), BATCH_SIZE);
  assert.equal(initialShown(null, 5), 5);
  assert.equal(initialShown(50, 1200), 72, 'gemerkte Zahl auf ganze Schritte');
  assert.equal(initialShown(99999, 5000), 2016, 'höchstens 2000 (gerundet) wiederherstellen');
  assert.equal(initialShown('48', 1200), BATCH_SIZE, 'nur ganze Zahlen');
  assert.equal(nextShown(24, 30), 30);
  assert.equal(nextShown(24, 100), 48);
});

test('Startseite: feste Auswahl aus echten Daten, kein Bau doppelt, gleiche Eingabe → gleiches Ergebnis', () => {
  const sections = selectHomeSections(catalog.builds);
  assert.deepEqual(sections.map((section) => section.id), HOME_SECTIONS.map((section) => section.id));
  const shown = sections.flatMap((section) => section.builds.map((build) => build.id));
  assert.equal(new Set(shown).size, shown.length, 'kein Bau in zwei Abschnitten');
  for (const section of sections) assert.ok(section.builds.length > 0 && section.builds.length <= SECTION_SIZE);
  assert.deepEqual(selectHomeSections([...catalog.builds].reverse()).map((s) => s.builds.map((b) => b.id)), sections.map((s) => s.builds.map((b) => b.id)), 'unabhängig von der Reihenfolge im Katalog');
  const byId = Object.fromEntries(sections.map((section) => [section.id, section]));
  assert.equal(byId.riesig.builds[0].id, 'cheops-pyramide', 'die meisten Blöcke zuerst');
  assert.ok(byId.schnell.builds.every((build) => build.blocks < 1000 && build.difficulty <= 2));
  assert.ok(byId.original.builds.every((build) => build.accuracy === 'original'));
  assert.equal(byId.original.total, 13);
  assert.ok(byId.massstab.builds.every((build) => build.accuracy === 'massstab'));
  assert.ok(byId.technik.builds.every((build) => ['redstone', 'farmen'].includes(build.category)));
  assert.ok(new Set(byId.original.builds.map((build) => build.category)).size >= 3, 'abwechselnd aus mehreren Kategorien');
  // Leerer Katalog oder ein Bau: keine leeren Abschnitte
  assert.deepEqual(selectHomeSections([]), []);
  assert.deepEqual(selectHomeSections([catalog.builds.find((b) => b.id === 'spiel-igloo-top')]).map((s) => s.id), ['schnell', 'original']);
});

test('Startseite: Links „N Bauten in …“ führen auf genau diese Auswahl der Kategorie-Seite', () => {
  for (const section of selectHomeSections(catalog.builds)) {
    assert.ok(section.links.length >= 1 && section.links.length <= 2, section.id);
    for (const link of section.links) {
      const url = new URL(link.href, 'https://test.invalid/');
      assert.equal(url.pathname, '/kategorie.html');
      const slug = url.searchParams.get('k');
      assert.equal(slug, link.slug);
      const view = computeView(createBrowseIndex(inCategory(slug)), state(url.search));
      assert.equal(view.results.length, link.count, `${section.id} → ${slug}`);
      assert.match(link.label, /^\d+ Bauten? in /);
      assert.equal(browseSearch(slug, state(url.search)), url.search, 'Adresse ist schon in Normalform');
    }
  }
});

test('Startseite: Gesamtzahlen und reihum-Auswahl', () => {
  const totals = catalogTotals(catalog.builds);
  assert.equal(totals.builds, 175);
  assert.equal(totals.categories, 8);
  assert.equal(totals.originals, 13);
  assert.equal(totals.blocks, catalog.builds.reduce((sum, build) => sum + build.blocks, 0));
  assert.equal(totals.untested, catalog.builds.filter((build) => build.tested === false).length);
  assert.deepEqual(diversify(['a1', 'a2', 'a3', 'b1', 'c1', 'b2'], (x) => x[0], 4), ['a1', 'b1', 'c1', 'a2']);
  assert.deepEqual(diversify(['a1', 'a2'], (x) => x[0], 4), ['a1', 'a2']);
  assert.deepEqual(emptyFilters(), { groesse: [], schwierigkeit: [], herkunft: [], test: [] });
});
