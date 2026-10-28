// „Meine Bauten“ in der Oberfläche: Adresse bau.html?meine=<id> (gültig, ungültig, unbekannt), Laden für die Bau-Seite,
// Suche und Filter der Liste, Kartentexte und Herkunft in den Infos (js/ui/mine/model.js, js/ui/build/entry.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBuildAddress, viewEntry } from '../../js/ui/build/entry.js';
import {
  loadMineView, mineViewEntry, mineViewSource, creditsFromSource, filterMyBuilds, searchKey, sizeText, dateText, formatShort,
  cardMeta, countText, FILTER_NONE,
} from '../../js/ui/mine/model.js';
import { createMyBuilds, createMemoryBackend, myBuildHref } from '../../js/data/my-builds.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFile(path.join(ROOT, file));
const ID = '0a3f0ffd-c9f9-4543-a227-0ac78ff11b8d';

test('Adresse bau.html?meine=<id>: gültig, ungültig, gemischt; die übrigen Adressen wie bisher', () => {
  assert.deepEqual(parseBuildAddress(`?meine=${ID}`), { kind: 'mine', id: ID });
  for (const bad of ['', 'abc', '../meine.html', `${ID}x`, ID.toUpperCase(), '%3Cscript%3E', `${ID}%00`]) {
    assert.deepEqual(parseBuildAddress(`?meine=${bad}`), { kind: 'invalid', reason: 'meine' }, bad);
  }
  assert.deepEqual(parseBuildAddress(`?meine=${ID}&id=turm`), { kind: 'invalid', reason: 'mixed' });
  assert.deepEqual(parseBuildAddress(`?form=kugel&meine=${ID}`), { kind: 'invalid', reason: 'mixed' });
  assert.deepEqual(parseBuildAddress(`?meine=${ID}&meine=${ID}`), { kind: 'invalid', reason: 'mixed' });
  // Ohne meine= gilt parseBuildParams unverändert
  assert.deepEqual(parseBuildAddress('?id=tokyo-skytree&scale=0.5'), { kind: 'build', id: 'tokyo-skytree', scale: 0.5 });
  assert.deepEqual(parseBuildAddress('?id=spiel-dorf'), { kind: 'build', id: 'spiel-dorf', scale: null });
  assert.deepEqual(parseBuildAddress('?form=kugel'), { kind: 'form', form: 'kugel' });
  assert.deepEqual(parseBuildAddress(''), { kind: 'none' });
});

test('Bau-Seite: eigener Bau wird wie ein Upload geladen, unbekannt → null', async () => {
  const store = createMyBuilds({ backend: createMemoryBackend() });
  const house = await read('tests/fixtures/create/import/house-v2.schem');
  const stl = await read('tests/fixtures/create/voxelize/cube-ascii.stl');
  const entry = await store.add({ title: 'Haus', fileName: 'house-v2.schem', data: house, category: 'haeuser', source: { author: 'Erika', url: 'https://example.org/haus', license: 'CC BY 4.0' } });
  const view = await loadMineView(entry.id, store);
  assert.equal(view.progressKey, `bk:progress:mine:${entry.id}`);
  assert.equal(view.source.kind, 'upload');
  assert.equal(view.source.format, 'schem');
  assert.equal(view.source.name, 'house-v2.schem');
  assert.deepEqual(view.source.params, {});
  assert.deepEqual(Buffer.from(view.source.data), house);
  assert.deepEqual(view.entry, { title: 'Haus', subtitle: 'Sponge-Schematic (.schem)', category: 'haeuser', credits: { author: 'Erika', url: 'https://example.org/haus', license: 'CC BY 4.0' } });
  // Die Bau-Ansicht übernimmt Titel, Kategorie und Credits (Infos-Tab)
  const shown = viewEntry(view.entry);
  assert.equal(shown.category, 'haeuser');
  assert.deepEqual(shown.credits, { author: 'Erika', url: 'https://example.org/haus', license: 'CC BY 4.0', licenseUrl: null });
  // Modelle bekommen ihre gespeicherten Einstellungen
  const model = await store.add({ fileName: 'cube.stl', data: stl, params: { height: 12, palette: 'wolle', solid: false, upAxis: 'auto' } });
  assert.deepEqual((await loadMineView(model.id, store)).source.params, { height: 12, palette: 'wolle', solid: false, upAxis: 'auto' });
  // Unbekannt oder ungültig
  assert.equal(await loadMineView('00000000-0000-4000-8000-000000000000', store), null);
  assert.equal(await loadMineView('kaputt', store), null);
  await store.remove(entry.id);
  assert.equal(await loadMineView(entry.id, store), null);
  assert.deepEqual(mineViewSource({ format: 'nbt', fileName: 'a.nbt', data: new ArrayBuffer(1), params: null }).params, {});
});

test('Herkunft in den Infos: Autor, sonst die Seite der Adresse; nur Lizenz → „Unbekannt“', () => {
  assert.equal(creditsFromSource(null), null);
  assert.deepEqual(creditsFromSource({ author: null, url: 'https://www.planetminecraft.com/project/x/', license: null }), { author: 'www.planetminecraft.com', url: 'https://www.planetminecraft.com/project/x/', license: null });
  assert.deepEqual(creditsFromSource({ author: null, url: null, license: 'CC0' }), { author: 'Unbekannt', url: null, license: 'CC0' });
  assert.equal(creditsFromSource({ author: null, url: null, license: null }), null);
  assert.equal(mineViewEntry({ title: 'x', format: 'nbt', category: null, source: null }).credits, null);
});

test('Liste: Suche (ohne Groß/klein, Umlaute, mehrere Wörter) und Kategorie-Filter', () => {
  const list = [
    { id: '1', title: 'Große Burg', fileName: 'burg.schem', category: 'mittelalter' },
    { id: '2', title: 'Häuschen am See', fileName: 'haus.nbt', category: 'haeuser' },
    { id: '3', title: 'Würfel', fileName: 'cube.stl', category: null },
  ];
  const ids = (options) => filterMyBuilds(list, options).map((entry) => entry.id);
  assert.deepEqual(ids({}), ['1', '2', '3']);
  assert.deepEqual(ids({ query: 'GROSSE' }), ['1']);
  assert.deepEqual(ids({ query: 'hauschen see' }), ['2']);
  assert.deepEqual(ids({ query: 'cube' }), ['3']);
  assert.deepEqual(ids({ query: 'burg see' }), []);
  assert.deepEqual(ids({ category: 'haeuser' }), ['2']);
  assert.deepEqual(ids({ category: FILTER_NONE }), ['3']);
  assert.deepEqual(ids({ category: 'unbekannt' }), ['1', '2', '3']);
  assert.deepEqual(ids({ query: 'w', category: FILTER_NONE }), ['3']);
  assert.equal(searchKey('  Äpfel   und ÖL '), 'apfel und ol');
  assert.deepEqual(filterMyBuilds(null), []);
});

test('Kartentexte: Format, Größe, Datum, Anzahl', () => {
  assert.equal(sizeText(812), '812 Bytes');
  assert.equal(sizeText(14 * 1024 + 100), '14 KB');
  assert.equal(sizeText(3.44 * 1024 * 1024), '3,4 MB');
  assert.equal(sizeText(-1), '–');
  assert.equal(dateText('2026-10-28T12:00:00.000Z'), '28.10.2026');
  assert.equal(dateText(null), '');
  assert.equal(formatShort({ fileName: 'alt.schematic', format: 'schem' }), '.schematic');
  assert.equal(formatShort({ fileName: 'ohne', format: 'nbt' }), '.nbt');
  assert.equal(cardMeta({ fileName: 'a.litematic', format: 'litematic', size: 2048, addedAt: '2026-10-28T12:00:00.000Z' }), '.litematic · 2 KB · 28.10.2026');
  assert.equal(cardMeta({ fileName: 'a.nbt', format: 'nbt', size: 10, addedAt: null }), '.nbt · 10 Bytes');
  assert.equal(countText(1, 1), '1 Bau');
  assert.equal(countText(5, 5), '5 Bauten');
  assert.equal(countText(2, 5), '2 von 5 Bauten');
  assert.equal(myBuildHref(ID), `bau.html?meine=${ID}`);
});

test('meine.html und Seitenmodule: keine Netzanfragen, kein innerHTML, Texte als Textknoten', async () => {
  const files = ['js/data/my-builds.js', 'js/data/zip.js', 'js/ui/mine-page.js', 'js/ui/mine/cards.js', 'js/ui/mine/model.js', 'js/ui/create/save-mine.js',
    // Prüfung beim Hinzufügen: die Leser des Uploads
    'js/create/import/index.js', 'js/create/import/nbt.js', 'js/create/import/schem.js', 'js/create/import/litematic.js', 'js/create/import/structure-nbt.js',
    'js/create/import/rename.js', 'js/create/import/common.js'];
  for (const file of files) {
    const source = String(await read(file));
    assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, file);
  }
  const html = String(await read('meine.html'));
  assert.match(html, /<body data-page="mine">/);
  assert.match(html, /<link rel="stylesheet" href="css\/mine\.css">/);
  assert.match(html, /<input class="visually-hidden" id="mine-file" type="file" multiple/);
  // Hinweis- oder Disclaimer-Texte gibt es nicht; der einzige Absatz im Hauptteil ist der noscript-Hinweis bzw. die Anzahl
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.equal((main.match(/<p\b/g) ?? []).length, 2);
  // „Zu Meine Bauten“ steht auf erstellen.html beim Import
  const create = String(await read('erstellen.html'));
  assert.match(create, /<section class="panel import-save" id="import-save" aria-labelledby="import-save-title" hidden>/);
});
