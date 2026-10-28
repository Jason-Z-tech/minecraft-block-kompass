// Katalogsuche (js/create/search.js): Normalisieren, Synonyme, Tippfehler, Bewertung, Schwellen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalize, tokenize, stem, damerauLevenshtein, allowedTypos, synonymsOf, searchCatalog, scoreEntry, catalogEntries,
  MATCH_THRESHOLD, SUGGEST_THRESHOLD,
} from '../../js/create/search.js';

const catalog = JSON.parse(readFileSync(new URL('../fixtures/create/catalog.json', import.meta.url), 'utf8'));
const ids = (results) => results.map((r) => r.entry.id);

describe('normalize', () => {
  test('Umlaute, ß, Akzente und Satzzeichen', () => {
    assert.equal(normalize('Größe Ärger Öl Übel'), 'groesse aerger oel uebel');
    assert.equal(normalize('Café-Crème!!'), 'cafe creme');
    assert.equal(normalize('  Tokio   Skytree  '), 'tokio skytree');
    assert.equal(normalize('Mugen-jō (無限城)'), 'mugen jo');
    assert.equal(normalize('Straße'), 'strasse');
  });

  test('Nicht-Texte ergeben einen leeren Text', () => {
    assert.equal(normalize(null), '');
    assert.equal(normalize(undefined), '');
    assert.equal(normalize({}), '');
    assert.equal(normalize(42), '42');
  });
});

describe('tokenize und stem', () => {
  test('Füllwörter fallen weg, Doppelte auch', () => {
    assert.deepEqual(tokenize('Ich möchte den Eiffelturm bauen'), ['eiffelturm']);
    assert.deepEqual(tokenize('Burg Burg aus Stein'), ['burg', 'stein']);
  });

  test('nur Füllwörter → bleiben erhalten', () => {
    assert.deepEqual(tokenize('der die das'), ['der', 'die', 'das']);
  });

  test('höchstens 12 Wörter und 200 Zeichen', () => {
    const long = Array.from({ length: 40 }, (_, i) => `wort${i}`).join(' ');
    assert.equal(tokenize(long).length, 12);
    assert.ok(tokenize('a'.repeat(5000)).every((t) => t.length <= 200));
  });

  test('stem kürzt Endungen nur bei längeren Wörtern', () => {
    assert.equal(stem('bruecken'), 'brueck');
    assert.equal(stem('bruecke'), 'brueck');
    assert.equal(stem('turm'), 'turm');
    assert.equal(stem('haeuser'), 'haeus');
    assert.equal(stem('burgen'), 'burg');
  });
});

describe('damerauLevenshtein und Tippfehler', () => {
  test('bekannte Abstände', () => {
    assert.equal(damerauLevenshtein('kitten', 'sitting'), 3);
    assert.equal(damerauLevenshtein('eifelturm', 'eiffelturm'), 1);
    assert.equal(damerauLevenshtein('castel', 'castle'), 1);
    assert.equal(damerauLevenshtein('ab', 'ba'), 1);
    assert.equal(damerauLevenshtein('', 'abc'), 3);
    assert.equal(damerauLevenshtein('gleich', 'gleich'), 0);
  });

  test('Abbruch über der Grenze', () => {
    assert.ok(damerauLevenshtein('abcdefgh', 'zyxwvuts', 2) > 2);
  });

  test('erlaubte Fehler je Länge', () => {
    assert.equal(allowedTypos(3), 0);
    assert.equal(allowedTypos(4), 0);
    assert.equal(allowedTypos(6), 1);
    assert.equal(allowedTypos(9), 2);
  });

  test('Synonyme gelten in beide Richtungen', () => {
    assert.ok(synonymsOf('tokio').has('tokyo'));
    assert.ok(synonymsOf('tokyo').has('tokio'));
    assert.ok(synonymsOf('burg').has('castle'));
    assert.ok(synonymsOf('bruecke').has('bridge'));
    assert.ok(synonymsOf('haus').has('house'));
    assert.equal(synonymsOf('xyz').size, 0);
  });
});

describe('searchCatalog', () => {
  test('Katalog-Format: Objekt mit builds oder Liste', () => {
    assert.equal(catalogEntries(catalog).length, catalog.builds.length);
    assert.equal(catalogEntries(catalog.builds).length, catalog.builds.length);
    assert.deepEqual(catalogEntries(null), []);
    assert.deepEqual(catalogEntries({ builds: [null, 3, { id: 'x' }] }), []);
  });

  test('Synonym tokio → tokyo-skytree zuerst', () => {
    const results = searchCatalog(catalog, 'Tokio Skytree');
    assert.equal(results[0].entry.id, 'tokyo-skytree');
    assert.equal(results[0].score, 1);
    assert.ok(results[0].matched.some((m) => m.kind === 'synonym' || m.kind === 'exact'));
  });

  test('Tippfehler „Eifelturm“ findet den Eiffelturm', () => {
    assert.equal(searchCatalog(catalog, 'Eifelturm')[0].entry.id, 'eiffelturm');
  });

  test('getrennt geschrieben: „Tokyo Sky Tree“', () => {
    assert.equal(searchCatalog(catalog, 'Tokyo Sky Tree')[0].entry.id, 'tokyo-skytree');
  });

  test('Schlagwörter und Untertitel zählen (Demon Slayer)', () => {
    assert.equal(searchCatalog(catalog, 'demon slayer')[0].entry.id, 'infinity-castle');
  });

  test('Unpassendes erscheint nicht', () => {
    assert.deepEqual(searchCatalog(catalog, 'Burj Khalifa'), []);
    assert.deepEqual(searchCatalog(catalog, 'Raumschiff Enterprise'), []);
    assert.deepEqual(searchCatalog(catalog, 'qwertz'), []);
  });

  test('Ergebnisse absteigend sortiert, alle über der Schwelle', () => {
    const results = searchCatalog(catalog, 'Turm');
    assert.ok(results.length >= 4);
    for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].score >= results[i].score);
    assert.ok(results.every((r) => r.score >= MATCH_THRESHOLD));
  });

  test('Kategorie-Filter und limit', () => {
    const results = searchCatalog(catalog, 'Turm', { category: 'mittelalter' });
    assert.ok(results.length > 0);
    assert.ok(results.every((r) => r.entry.category === 'mittelalter'));
    assert.equal(searchCatalog(catalog, 'Turm', { limit: 2 }).length, 2);
  });

  test('leere Suche liefert alle Einträge (für Textfilter)', () => {
    const results = searchCatalog(catalog, '');
    assert.equal(results.length, Math.min(20, catalog.builds.length));
    assert.ok(results.every((r) => r.score === 0));
    assert.equal(searchCatalog(catalog, '   ', { limit: 1000 }).length, catalog.builds.length);
  });

  test('relative Grenze: genaue Treffer zuerst, gute Teiltreffer folgen, schwache fallen weg', () => {
    const tower = searchCatalog(catalog, 'Tokyo Tower', { relative: 0.7 });
    assert.deepEqual(tower.map((r) => [r.entry.id, r.exact]), [['tokyo-tower', true], ['tokyo-skytree', false]]);
    assert.ok(tower.every((r) => r.score >= tower[0].score * 0.7));
    assert.deepEqual(ids(searchCatalog(catalog, 'Tokyo', { relative: 0.7 })).sort(), ['tokyo-skytree', 'tokyo-tower']);
    assert.deepEqual(ids(searchCatalog(catalog, 'Tokyo Skytree', { relative: 0.7 })), ['tokyo-skytree'], 'Tokyo Tower (nur halber Treffer) fällt weg');
  });

  test('genauer Treffer verdrängt keine anderen Bauten mit demselben Namen (z. B. Community-Bauten)', () => {
    const builds = [
      { id: 'windmuehle', title: 'Windmühle', subtitle: '', category: 'mittelalter', tags: [], aliases: [] },
      { id: 'qrafty-windmuehle', title: 'Windmühle aus Eiche', subtitle: '', category: 'mittelalter', tags: ['Community'], aliases: ['windmill'] },
      { id: 'qrafty-tulpen-windmuehle', title: 'Tulpen-Windmühle', subtitle: '', category: 'klein', tags: ['Community'], aliases: ['tulip windmill'] },
      { id: 'leuchtturm', title: 'Leuchtturm', subtitle: '', category: 'infrastruktur', tags: [], aliases: [] },
    ];
    const hits = searchCatalog({ builds }, 'Windmühle', { relative: 0.7 });
    assert.deepEqual(hits.map((r) => [r.entry.id, r.exact]).slice(0, 1), [['windmuehle', true]]);
    assert.deepEqual(ids(hits).sort(), ['qrafty-tulpen-windmuehle', 'qrafty-windmuehle', 'windmuehle']);
    assert.ok(hits.slice(1).every((r) => r.exact === false));
  });

  test('niedrigere Schwelle für Vorschläge', () => {
    assert.ok(SUGGEST_THRESHOLD < MATCH_THRESHOLD);
    const strict = searchCatalog(catalog, 'Japan Garten Teich');
    const loose = searchCatalog(catalog, 'Japan Garten Teich', { threshold: SUGGEST_THRESHOLD });
    assert.ok(loose.length >= strict.length);
  });

  test('Wortgruppen als Liste und ohne Katalog', () => {
    assert.equal(searchCatalog(catalog, ['big', 'ben'])[0].entry.id, 'big-ben');
    assert.deepEqual(searchCatalog(null, 'Turm'), []);
  });

  test('scoreEntry meldet genaue Treffer', () => {
    const entry = catalog.builds.find((b) => b.id === 'leuchtturm');
    const { score, exact } = scoreEntry(entry, ['leuchtturm']);
    assert.equal(score, 1);
    assert.equal(exact, true);
    assert.equal(scoreEntry(entry, []).score, 0);
  });
});
