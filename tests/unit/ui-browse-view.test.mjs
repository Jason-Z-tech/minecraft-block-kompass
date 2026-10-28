// Textsuche, Ansicht der Kategorie-Seite und Anzahlen der Startseite – mit dem Test-Katalog
// tests/fixtures/ui/browse-catalog.json (Katalog-Format ohne Spiel-Strukturen, nur Bau-Module).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCatalog, countByCategory } from '../../js/ui/data.js';
import { CATEGORY_SLUGS } from '../../js/ui/shared.js';
import { searchCatalog } from '../../js/create/search.js';
import { createBrowseIndex, computeView, initialShown, nextShown, BATCH_SIZE } from '../../js/ui/browse/view.js';
import { emptyFilters } from '../../js/ui/browse/filters.js';
import { parseBrowseState, browseSearch } from '../../js/ui/browse/url-state.js';
import { sizeClassForBlocks, sizeClassOf } from '../../js/ui/browse/model.js';

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
  assert.equal(catalog.builds.length, 138);
  for (const slug of CATEGORY_SLUGS) assert.equal(inCategory(slug).length, raw.counts.byCategory[slug], slug);
  assert.deepEqual(Object.keys(raw.counts.byCategory).sort(), [...CATEGORY_SLUGS].sort(), 'keine Kategorie Redstone oder Farmen mehr');
  assert.ok(catalog.builds.every((build) => build.category !== 'farmen' && !build.module.includes('/farmen/')), 'keine Farmen mehr');
  for (const build of raw.builds) {
    assert.ok(!Object.hasOwn(build, 'difficulty') && !Object.hasOwn(build, 'facts'), `${build.id}: keine Schwierigkeit, kein Wissenswertes`);
    assert.equal(build.sizeClass, sizeClassForBlocks(build.blocks), `${build.id}: Größenklasse`);
    assert.ok(build.blocks <= build.size[0] * build.size[1] * build.size[2], `${build.id}: Blöcke passen in die Größe`);
    // Nur noch eigene Bau-Module: keine Spiel-Strukturen (Feld structure, IDs spiel-…, Texte über Strukturen aus dem Spiel).
    // Die Einträge mit Herkunft „original“ sind neutrale Beispiele und decken nur dieses Label ab.
    assert.ok(!Object.hasOwn(build, 'structure') && !build.id.startsWith('spiel-'), `${build.id}: keine Spiel-Struktur`);
    assert.doesNotMatch(`${build.subtitle} ${build.description}`, /Struktur|aus dem Spiel|Spieldateien|village\//, `${build.id}: kein Text über Spiel-Strukturen`);
    assert.equal(build.module, `js/builds/${build.category}/${build.id}.js`, `${build.id}: Bau-Modul`);
    if (build.scales) assert.deepEqual(Object.keys(build.variants), build.scales.map(String));
  }
  assert.ok(catalog.builds.some((build) => build.thumb) && catalog.builds.some((build) => !build.thumb), 'mit und ohne Vorschaubild');
  // tested: true hatten nur die Redstone-Bauten; „getestet“ prüfen die Logik-Tests (ui-browse-logic) mit eigenen Einträgen.
  // Ungetestet ist nur noch der Bahnhof (wie bahnhof-loren im echten Katalog), alle anderen brauchen keinen Test.
  assert.deepEqual(catalog.builds.filter((build) => build.tested === false).map((build) => build.id), ['bahnhof']);
  assert.ok(catalog.builds.every((build) => build.tested === false || build.tested === null));
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
  const klein = computeView(createBrowseIndex(inCategory('klein')), state(''));
  assert.equal(klein.total, 41);
  assert.equal(klein.results.length, 41);
  assert.equal(klein.results[0].title, 'Aquarium');
  const index = createBrowseIndex(inCategory('haeuser'));
  const wood = computeView(index, state('?q=holz&groesse=mittel&sort=bloecke-ab'), { category: 'haeuser' });
  assert.equal(wood.searched, 7);
  assert.ok(wood.results.length > 0 && wood.results.length < wood.searched);
  assert.ok(wood.results.every((build) => sizeClassOf(build) === 'mittel'));
  for (let i = 1; i < wood.results.length; i++) assert.ok(wood.results[i - 1].blocks >= wood.results[i].blocks);
  assert.equal(wood.counts.groesse.mittel, wood.results.length);
  assert.equal(wood.counts.groesse.klein + wood.counts.groesse.mittel, wood.searched);
  assert.deepEqual(Object.keys(wood.counts), ['groesse', 'herkunft', 'test'], 'keine Zählung nach Schwierigkeit');
  assert.equal(wood.activeFilters, 1);
  // Nichts passt → leere Liste, keine Ausnahme
  assert.deepEqual(computeView(index, state('?q=zzzz')).results, []);
});

test('Ansicht: fremde Suchfunktion nach dem Vertrag von searchCatalog wird genutzt und geprüft', () => {
  const builds = inCategory('infrastruktur');
  const index = createBrowseIndex(builds);
  const calls = [];
  const fake = (cat, query, options) => {
    calls.push({ count: cat.builds.length, query, options });
    return [{ entry: builds[3], score: 2 }, { entry: { id: 'fremd' }, score: 9 }, { entry: builds[1], score: 5 }, { entry: builds[1], score: 1 }];
  };
  const view = computeView(index, state('?q=irgendwas'), { search: fake, category: 'infrastruktur' });
  assert.deepEqual(calls, [{ count: builds.length, query: 'irgendwas', options: { limit: builds.length, category: 'infrastruktur' } }]);
  assert.deepEqual(view.results.map((build) => build.id), [builds[1].id, builds[3].id], 'unbekannte und doppelte Treffer fallen weg');
  assert.throws(() => computeView(index, state('?q=x'), { search: () => null }), /keine Trefferliste/);
});

test('Ansicht: über 300 Einträge schnell genug, Nachladen in Schritten', () => {
  const many = Array.from({ length: 1200 }, (_, i) => ({ ...catalog.builds[i % catalog.builds.length], id: `bau-${i}`, title: `${catalog.builds[i % catalog.builds.length].title} ${i}` }));
  const start = performance.now();
  const index = createBrowseIndex(many);
  for (const search of ['', '?q=turm', '?groesse=klein&herkunft=eigenes&herkunft=original', '?q=haus&sort=bloecke-ab&herkunft=eigenes']) computeView(index, state(search));
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

test('Startseite: Anzahl je Kategorie für die Kacheln – alle sechs, fehlende mit 0, Summe = Katalog', () => {
  const counts = countByCategory(catalog);
  assert.deepEqual(Object.keys(counts), [...CATEGORY_SLUGS]);
  for (const slug of CATEGORY_SLUGS) assert.equal(counts[slug], inCategory(slug).length, slug);
  assert.equal(Object.values(counts).reduce((sum, n) => sum + n, 0), catalog.builds.length);
  assert.equal(counts.klein, 41);
  // Kategorie ohne Bauten → 0 (die Kachel zeigt „Noch keine Bauten“), kein Eintrag für alte Kategorien
  const withoutBridges = countByCategory({ builds: catalog.builds.filter((build) => build.category !== 'infrastruktur') });
  assert.equal(withoutBridges.infrastruktur, 0);
  for (const old of ['redstone', 'farmen']) assert.equal(Object.hasOwn(withoutBridges, old), false, old);
  // Einträge alter Kategorien (z. B. aus einem alten Katalog) zählen nirgends mit
  const old = countByCategory({ builds: [...catalog.builds, { ...catalog.builds[0], id: 'kaktusfarm', category: 'farmen' }] });
  assert.deepEqual(old, counts);
  assert.deepEqual(countByCategory({ builds: [] }), Object.fromEntries(CATEGORY_SLUGS.map((slug) => [slug, 0])));
  assert.deepEqual(emptyFilters(), { groesse: [], herkunft: [], test: [] });
});
