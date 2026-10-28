// Klick-Test der Start- und Kategorie-Seite in Chrome mit dem Test-Katalog (per page.route untergeschoben):
// Startseite (Kacheln mit Anzahl, Suche → erstellen.html, ohne Scrollen auf Desktop und Handy), Filter, Sortierung,
// Textfilter, Zurück-Taste, Nachladen bei 400 Einträgen, Leer- und Fehlerzustände, Ersatz für fehlende Vorschaubilder,
// Handy-Filter. Ohne Chrome: übersprungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';
import { encodePng } from '../../scripts/lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/ui/browse-catalog.json');
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CARDS = '#category-list .build-card';

// Kleines Vorschaubild (16 × 10, Verlauf) – reicht, damit kein Bild fehlt
function thumbPng() {
  const width = 16;
  const height = 10;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([60 + (i % width) * 8, 90, 140 + Math.floor(i / width) * 8, 255], i * 4);
  return Buffer.from(encodePng({ width, height, data }));
}
const THUMB = thumbPng();

let server;
test.before(async () => { server = await startServer({ port: 0 }); });
test.after(async () => { await server?.close(); });

async function open(t, { catalogBody = null, width = 1280, height = 900, thumbs = true } = {}) {
  let page;
  try {
    page = await launchBrowser({ width, height, mobile: width < 600 });
  } catch (error) {
    if (/Kein Chrome/.test(error.message)) {
      t.skip(error.message);
      return null;
    }
    throw error;
  }
  t.after(() => page.close());
  await page.route('data/catalog.json', catalogBody === null ? { file: FIXTURE } : { body: catalogBody, contentType: 'application/json' });
  if (thumbs) await page.route('/thumbs/', { body: THUMB, contentType: 'image/png' });
  return page;
}

const search = (page) => page.eval('location.search');
const count = (page, selector = CARDS) => page.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
const text = (page, selector) => page.eval(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim() ?? null`);

async function goBack(page) {
  await page.eval('history.back()');
  await sleep(400);
}

// Startseite: alles bis zu den Links ist ohne Scrollen sichtbar, nichts ragt seitlich hinaus
async function measureHome(page) {
  return page.eval(`(() => {
    const links = document.getElementById('home-links').getBoundingClientRect();
    const tiles = [...document.querySelectorAll('#home-categories .category-tile')];
    return {
      innerHeight, innerWidth, scrollWidth: document.documentElement.scrollWidth,
      linksBottom: links.bottom,
      tilesInside: tiles.every((tile) => { const box = tile.getBoundingClientRect(); return [...tile.querySelectorAll('span')].every((s) => s.getBoundingClientRect().right <= box.right + 0.5); }),
      // Kacheln je Reihe (nach Oberkante) sowie alle Breiten und Höhen – für ein ordentliches Raster
      rows: Object.values(tiles.reduce((rows, tile) => { const top = Math.round(tile.getBoundingClientRect().top); (rows[top] ??= []).push(tile.dataset.category); return rows; }, {})).map((row) => row.length),
      widths: [...new Set(tiles.map((tile) => Math.round(tile.getBoundingClientRect().width)))],
      heights: [...new Set(tiles.map((tile) => Math.round(tile.getBoundingClientRect().height)))],
    };
  })()`);
}

test('Startseite: Titel, Suche, sechs kompakte Kategorien mit Anzahl, zwei Links – ohne Bau-Reihen und ohne Scrollen', async (t) => {
  const page = await open(t, { width: 1280, height: 800 });
  if (!page) return;
  await page.goto(`${server.url}/index.html`);
  await page.waitFor('document.querySelector("#home-categories .category-tile") && !document.querySelector("#home-categories .is-loading")');
  await page.eval('document.fonts.ready.then(() => true)');
  // Sechs Kategorien (keine Redstone- und keine Farmen-Kachel) mit Name und Anzahl aus dem Katalog, Link wie bisher
  const tiles = await page.eval('[...document.querySelectorAll("#home-categories .category-tile")].map((t) => [t.dataset.category, t.querySelector(".category-tile__title").innerText.trim(), t.querySelector(".category-tile__count").textContent, t.getAttribute("href")])');
  assert.deepEqual(tiles.map(([slug]) => slug), ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'infrastruktur']);
  for (const [slug, title, countText, href] of tiles) {
    const expected = fixture.builds.filter((build) => build.category === slug).length;
    assert.equal(countText, `${expected} ${expected === 1 ? 'Bau' : 'Bauten'}`, slug);
    assert.equal(href, `/kategorie.html?k=${slug}`);
    assert.ok(title.length > 0, slug);
  }
  assert.equal(await text(page, '#home-categories [data-category="klein"] .category-tile__count'), '41 Bauten');
  assert.equal(await page.eval('document.querySelector("#home-categories [data-category=klein] .category-tile__title").innerText.trim()'), 'Kleine Projekte & Deko', 'Desktop: voller Name');
  assert.equal(await page.eval('document.querySelectorAll("#home-categories .category-tile__text").length'), 0, 'keine Beschreibung in den Kacheln');
  // Keine Bau-Reihen, keine Karten, keine Kennzahlen, kein „So funktioniert’s“, keine Schwierigkeit
  assert.equal(await page.eval('document.querySelectorAll("main .build-card, main .shelf, #home-sections, #home-total, .how, .hero-stats, .eyebrow").length'), 0);
  const mainText = await page.eval('document.querySelector("main").innerText');
  assert.doesNotMatch(mainText, /So funktioniert|(?:^|\n)Riesenbauten\n|Klein & schnell|Original aus dem Spiel|Nach echten Maßen|Stand |Schwierigkeit/);
  // Zwei Links unter den Kacheln
  assert.deepEqual(await page.eval('[...document.querySelectorAll("#home-links a")].map((a) => [a.getAttribute("href"), a.textContent.trim()])'),
    [['erstellen.html', 'Selber erstellen'], ['meine.html', 'Meine Bauten']]);
  // Kopf: keine Suche, „Start“ aktiv, „Meine Bauten“ in der Navigation
  assert.equal(await page.eval('document.querySelectorAll("#site-header form, #site-header input, #site-header button").length'), 0);
  assert.deepEqual(await page.eval('[...document.querySelectorAll("#site-header [data-nav]")].map((a) => [a.dataset.nav, a.getAttribute("aria-current")])'),
    [['home', 'page'], ['category', null], ['create', null], ['mine', null]]);
  // Alles bis zu den Links ohne Scrollen sichtbar
  const desktop = await measureHome(page);
  assert.ok(desktop.linksBottom < desktop.innerHeight, `Desktop: Links enden bei ${desktop.linksBottom} px (Fenster ${desktop.innerHeight} px)`);
  assert.equal(desktop.scrollWidth, 1280, 'kein waagrechtes Scrollen');
  assert.ok(desktop.tilesInside, 'Kachel-Texte bleiben in der Kachel');
  assert.deepEqual(desktop.rows, [3, 3], 'Desktop: zwei volle Reihen mit je drei Kacheln');
  assert.equal(desktop.widths.length, 1, `gleich breite Kacheln: ${desktop.widths}`);
  assert.equal(desktop.heights.length, 1, `gleich hohe Kacheln: ${desktop.heights}`);
  // Leere Suche bleibt auf der Seite, eine Suche leitet auf erstellen.html?q=…
  await page.click('#home-search-form button[type="submit"]');
  assert.equal(await page.eval('location.pathname'), '/index.html');
  await page.type('#home-search-input', '  Burg   Eltz ');
  await page.click('#home-search-form button[type="submit"]');
  await page.waitFor('location.pathname.endsWith("/erstellen.html")');
  assert.equal(await search(page), '?q=Burg%20Eltz');
  assert.deepEqual(page.errors, []);
});

test('Startseite auf dem Handy: Kurznamen, alles ohne Scrollen, Nav mit vier Punkten in einer Zeile', async (t) => {
  // Auch große Zahlen und „Noch keine Bauten“ müssen passen
  const builds = [
    ...Array.from({ length: 12345 }, (_, i) => ({ id: `haus-${i}`, title: `Haus ${i}`, category: 'haeuser' })),
    ...fixture.builds.filter((build) => !['haeuser', 'infrastruktur'].includes(build.category)),
  ];
  const page = await open(t, { width: 390, height: 844, catalogBody: JSON.stringify({ ...fixture, builds }) });
  if (!page) return;
  await page.goto(`${server.url}/index.html`);
  await page.waitFor('document.querySelector("#home-categories .category-tile") && !document.querySelector("#home-categories .is-loading")');
  await page.eval('document.fonts.ready.then(() => true)');
  assert.equal(await text(page, '#home-categories [data-category="haeuser"] .category-tile__count'), '12.345 Bauten');
  assert.equal(await text(page, '#home-categories [data-category="infrastruktur"] .category-tile__count'), 'Noch keine Bauten');
  assert.deepEqual(await page.eval('[...document.querySelectorAll("#home-categories .category-tile__title")].map((t) => t.innerText.trim())'),
    ['Häuser', 'Wahrzeichen', 'Fantasy', 'Mittelalter', 'Klein & Deko', 'Infrastruktur']);
  const phone = await measureHome(page);
  assert.ok(phone.linksBottom < phone.innerHeight, `Handy: Links enden bei ${phone.linksBottom} px (Fenster ${phone.innerHeight} px)`);
  assert.equal(phone.scrollWidth, 390, 'kein waagrechtes Scrollen');
  assert.ok(phone.tilesInside, 'Kachel-Texte bleiben in der Kachel');
  // Auch mit extremen Zahlen drei volle Reihen gleich breiter Kacheln („Noch keine Bauten“ darf umbrechen)
  assert.deepEqual(phone.rows, [2, 2, 2], 'Handy: drei volle Reihen mit je zwei Kacheln');
  assert.equal(phone.widths.length, 1, `gleich breite Kacheln: ${phone.widths}`);
  // Navigation: vier Punkte nebeneinander mit Kurzformen, Beschriftung bleibt im Slot
  const nav = await page.eval(`[...document.querySelectorAll('#site-header .hotbar__slot')].map((slot) => {
    const box = slot.getBoundingClientRect();
    const label = [...slot.querySelectorAll('span')].find((s) => getComputedStyle(s).display !== 'none');
    const r = label.getBoundingClientRect();
    return { top: Math.round(box.top), text: label.textContent, inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5 };
  })`);
  assert.deepEqual(nav.map((slot) => slot.text), ['Start', 'Kategorien', 'Erstellen', 'Meine']);
  assert.equal(new Set(nav.map((slot) => slot.top)).size, 1, 'eine Zeile');
  assert.ok(nav.every((slot) => slot.inside), JSON.stringify(nav));
  assert.deepEqual(page.errors, []);
});

test('Startseite auf dem Handy: sechs Kacheln als ordentliches 2 × 3-Raster, auch auf schmalen Geräten', async (t) => {
  for (const [width, height] of [[390, 844], [360, 640]]) {
    const page = await open(t, { width, height });
    if (!page) return;
    await page.goto(`${server.url}/index.html`);
    await page.waitFor('document.querySelector("#home-categories .category-tile") && !document.querySelector("#home-categories .is-loading")');
    await page.eval('document.fonts.ready.then(() => true)');
    const phone = await measureHome(page);
    assert.deepEqual(phone.rows, [2, 2, 2], `${width} px: drei volle Reihen`);
    assert.equal(phone.widths.length, 1, `${width} px: gleich breite Kacheln ${phone.widths}`);
    assert.equal(phone.heights.length, 1, `${width} px: gleich hohe Kacheln ${phone.heights} (auch „Infrastruktur“ in einer Zeile)`);
    assert.ok(phone.tilesInside, `${width} px: Kachel-Texte bleiben in der Kachel`);
    assert.ok(phone.linksBottom < phone.innerHeight, `${width} px: Links enden bei ${phone.linksBottom} px (Fenster ${phone.innerHeight} px)`);
    assert.equal(phone.scrollWidth, width, `${width} px: kein waagrechtes Scrollen`);
    assert.deepEqual(page.errors, []);
  }
});

test('Startseite: Fehler beim Laden des Katalogs, erneut versuchen füllt die Anzahlen', async (t) => {
  const page = await open(t, { catalogBody: 'kaputt' });
  if (!page) return;
  // Server antwortet mit 500 statt mit dem Katalog
  await page.unroute('data/catalog.json');
  await page.route('data/catalog.json', { body: 'kaputt', status: 500, contentType: 'text/plain' });
  await page.goto(`${server.url}/index.html`);
  await page.waitFor('document.querySelector("#home-status .state--error")');
  assert.equal(await text(page, '#home-status .state__title'), 'Datei konnte nicht geladen werden');
  assert.equal(await page.eval('[...document.querySelectorAll("#home-categories .category-tile__count")].every((n) => n.textContent === "" && !n.classList.contains("is-loading"))'), true);
  assert.equal(await page.eval('document.querySelector("#home-categories").hasAttribute("aria-busy")'), false);
  await page.unroute('data/catalog.json');
  await page.route('data/catalog.json', { file: FIXTURE });
  await page.click('#home-status button');
  await page.waitFor('document.querySelector("#home-categories [data-category=klein] .category-tile__count").textContent === "41 Bauten"', 5000);
  assert.equal(await page.eval('document.querySelector("#home-status").children.length'), 0, 'Fehlerhinweis verschwindet');
  assert.ok(page.errors.every((line) => /500|Datei konnte nicht|DataError|catalog\.json/.test(line)), page.errors.join('\n'));
});

test('Kategorie: Filter, Sortierung und Textfilter in der Adresse, Zurück-Taste stellt alles wieder her', async (t) => {
  const page = await open(t);
  if (!page) return;
  await page.goto(`${server.url}/kategorie.html?k=haeuser`);
  await page.waitFor(`document.querySelector(${JSON.stringify(CARDS)})`);
  assert.equal(await text(page, '#category-result-count'), '27 Bauten');
  assert.equal(await count(page), 24, 'zuerst ein Schritt');
  // Der Rest kommt, sobald das Listenende in die Nähe kommt
  await page.eval('window.scrollTo(0, document.documentElement.scrollHeight)');
  await page.waitFor(`document.querySelectorAll(${JSON.stringify(CARDS)}).length === 27`, 3000);
  assert.equal(await page.eval('document.querySelector("#category-more").hidden'), true);
  await page.eval('window.scrollTo(0, 0)');
  // Weder Filter noch Sortierung nach Schwierigkeit
  assert.deepEqual(await page.eval('[...new Set([...document.querySelectorAll("#category-filters input")].map((i) => i.name))]'), ['groesse', 'herkunft']);
  assert.deepEqual(await page.eval('[...document.querySelectorAll("#category-sort option")].map((o) => o.value)'), ['name', 'groesse-auf', 'groesse-ab', 'bloecke-auf', 'bloecke-ab']);
  // Filter „Mittel“
  await page.click('#category-filters input[name="groesse"][value="mittel"]');
  assert.equal(await search(page), '?k=haeuser&groesse=mittel');
  assert.equal(await text(page, '#category-result-count'), '12 von 27 Bauten passen zu deinen Filtern');
  assert.equal(await count(page), 12);
  assert.equal(await count(page, '#category-active .active-chip'), 1);
  // Sortierung
  await page.eval('(() => { const s = document.querySelector("#category-sort"); s.value = "bloecke-ab"; s.dispatchEvent(new Event("change", { bubbles: true })); })()');
  assert.equal(await search(page), '?k=haeuser&groesse=mittel&sort=bloecke-ab');
  const blocks = await page.eval(`[...document.querySelectorAll(${JSON.stringify(CARDS)})].map((c) => Number(c.querySelectorAll(".stats li")[1].textContent.replace(/\\D/g, "")))`);
  assert.deepEqual(blocks, [...blocks].sort((a, b) => b - a));
  // Textfilter (nach kurzer Pause übernommen)
  await page.type('#category-query', 'holz');
  await page.waitFor('location.search.includes("q=holz")', 3000);
  assert.equal(await search(page), '?k=haeuser&q=holz&groesse=mittel&sort=bloecke-ab');
  assert.equal(await text(page, '#category-result-count'), '4 von 27 Bauten passen zu „holz“ und deinen Filtern');
  // Zurück: ohne Suche, dann ohne Sortierung, dann ohne Filter; vorwärts wieder mit Suche
  await goBack(page);
  assert.equal(await search(page), '?k=haeuser&groesse=mittel&sort=bloecke-ab');
  assert.equal(await page.eval('document.querySelector("#category-query").value'), '');
  assert.equal(await count(page), 12);
  await goBack(page);
  assert.equal(await page.eval('document.querySelector("#category-sort").value'), 'name');
  await goBack(page);
  assert.equal(await search(page), '?k=haeuser');
  assert.equal(await page.eval('document.querySelector("#category-filters input[value=\\"mittel\\"]").checked'), false);
  assert.equal(await count(page), 27);
  await page.eval('history.go(3)');
  await sleep(400);
  assert.equal(await page.eval('document.querySelector("#category-query").value'), 'holz');
  assert.equal(await count(page), 4);
  // Chip entfernt die Suche, „Passend zuerst“ war nie gewählt → Sortierung bleibt
  // (erst in die Mitte holen: nach history.go kann die wiederhergestellte Stelle ihn unter den Kopf schieben)
  await page.eval('document.querySelector("#category-active .active-chip").scrollIntoView({ block: "center" })');
  await sleep(100);
  await page.click('#category-active .active-chip');
  assert.equal(await search(page), '?k=haeuser&groesse=mittel&sort=bloecke-ab');
  // Nichts passt → Leerzustand mit Zurücksetzen und Suche in allen Kategorien
  await page.type('#category-query', 'zzzz');
  await page.waitFor('document.querySelector("#category-empty .state")', 3000);
  assert.equal(await page.eval('document.querySelector("#category-list").hidden'), true);
  assert.equal(await page.eval('document.querySelector("#category-empty a").getAttribute("href")'), '/erstellen.html?q=zzzz');
  await page.click('#category-empty button');
  assert.equal(await search(page), '?k=haeuser&sort=bloecke-ab');
  assert.equal(await count(page), 24, 'neue Auswahl beginnt wieder mit einem Schritt');
  assert.deepEqual(page.errors, []);
});

test('Kategorie: ungültige Angaben in der Adresse fallen weg, Text erscheint nie als HTML', async (t) => {
  const page = await open(t);
  if (!page) return;
  await page.goto(`${server.url}/kategorie.html?k=infrastruktur&q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&groesse=gigantisch&sort=zufall&test=ungetestet`);
  await page.waitFor('document.querySelector("#category-empty .state")');
  assert.equal(await search(page), '?k=infrastruktur&q=%3Cimg+src%3Dx+onerror%3Dalert%281%29%3E&test=ungetestet');
  assert.equal(await page.eval('document.querySelectorAll("main img[src=x]").length'), 0);
  assert.match(await text(page, '#category-result-count'), /^Keiner von 14 Bauten passt zu „<img src=x onerror=alert\(1\)>“ und deinen Filtern$/);
  assert.ok(page.logs.some((line) => /ignoriert/.test(line) && /gigantisch/.test(line)));
  // Alte Adresse mit Schwierigkeit: Filter und Sortierung fallen still weg, die Adresse wird bereinigt
  await page.goto(`${server.url}/kategorie.html?k=klein&schwierigkeit=2&sort=schwierigkeit-auf`);
  await page.waitFor(`document.querySelector(${JSON.stringify(CARDS)})`);
  assert.equal(await search(page), '?k=klein');
  assert.equal(await page.eval('document.querySelector("#category-sort").value'), 'name');
  assert.equal(await text(page, '#category-result-count'), '41 Bauten');
  assert.equal(await page.eval('document.querySelectorAll("#category-status .state").length'), 0, 'kein Fehlerhinweis');
  assert.deepEqual(page.errors, []);
});

test('Kategorie: 400 Einträge werden schrittweise geladen, Zurück vom Bau stellt Liste und Stelle wieder her', async (t) => {
  const base = fixture.builds.filter((build) => build.category === 'haeuser');
  const builds = Array.from({ length: 400 }, (_, i) => ({ ...base[i % base.length], id: `haus-${String(i).padStart(3, '0')}`, title: `Haus ${String(i).padStart(3, '0')}`, thumb: null }));
  const page = await open(t, { catalogBody: JSON.stringify({ ...fixture, builds }), height: 800 });
  if (!page) return;
  const started = Date.now();
  await page.goto(`${server.url}/kategorie.html?k=haeuser`);
  await page.waitFor(`document.querySelector(${JSON.stringify(CARDS)})`);
  assert.ok(Date.now() - started < 5000);
  assert.equal(await count(page), 24);
  assert.match(await text(page, '#category-more-status'), /^24 von 400 angezeigt$/);
  await page.eval('window.scrollTo(0, document.documentElement.scrollHeight)');
  await page.waitFor(`document.querySelectorAll(${JSON.stringify(CARDS)}).length >= 48`, 3000);
  // Tastatur: Knopf ansteuern lädt nichts von selbst, erst der Druck – dann Fokus auf der ersten neuen Karte
  await page.eval('document.querySelector("#category-more-button").focus()');
  await sleep(400);
  const beforePress = await count(page);
  await page.eval('document.querySelector("#category-more-button").click()');
  const shown = await count(page);
  assert.equal(shown, beforePress + 24);
  assert.equal(await page.eval(`document.activeElement === document.querySelectorAll(${JSON.stringify(CARDS)})[${beforePress}].querySelector("a")`), true);
  await page.eval('window.scrollTo(0, 2400)');
  await sleep(500);
  // Link öffnen, ohne dass ein Klick vorher die Stelle verschiebt
  await page.eval(`location.assign(document.querySelectorAll(${JSON.stringify(CARDS)})[30].querySelector("a").href)`);
  await page.waitFor('location.pathname.endsWith("/bau.html")');
  await goBack(page);
  await page.waitFor(`document.querySelectorAll(${JSON.stringify(CARDS)}).length >= ${shown}`, 5000);
  await sleep(300);
  const y = await page.eval('window.scrollY');
  assert.ok(Math.abs(y - 2400) < 300, `Stelle wiederhergestellt: ${y}`);
  assert.deepEqual(page.errors, []);
});

test('Kategorie: Fehler beim Laden, leere und unbekannte Kategorie, Übersicht', async (t) => {
  const empty = { ...fixture, builds: fixture.builds.filter((build) => build.category !== 'infrastruktur') };
  const page = await open(t, { catalogBody: JSON.stringify(empty) });
  if (!page) return;
  await page.goto(`${server.url}/kategorie.html?k=infrastruktur`);
  await page.waitFor('document.querySelector("#category-status .state--empty")');
  assert.equal(await page.eval('document.querySelector("#category-browse").hidden'), true);
  await page.goto(`${server.url}/kategorie.html?k=gibtsnicht`);
  await page.waitFor('document.querySelector("#category-overview-list .category-tile__count:not(.is-loading)")');
  assert.equal(await text(page, '#category-status .state__title'), 'Diese Kategorie gibt es nicht');
  // Die Kategorien Redstone und Farmen gibt es nicht mehr: alte Adressen zeigen denselben Hinweis
  for (const old of ['redstone', 'farmen']) {
    await page.goto(`${server.url}/kategorie.html?k=${old}`);
    await page.waitFor('document.querySelector("#category-overview-list .category-tile__count:not(.is-loading)")');
    assert.equal(await text(page, '#category-status .state__title'), 'Diese Kategorie gibt es nicht', old);
    assert.equal(await page.eval(`document.querySelectorAll("#category-overview-list [data-category=${old}]").length`), 0, old);
  }
  await page.goto(`${server.url}/kategorie.html`);
  await page.waitFor('document.querySelector("#category-count").textContent');
  assert.equal(await text(page, '#category-count'), '124 Bauten in 6 Kategorien');
  // Übersicht: sechs Kacheln in zwei vollen Reihen zu je drei
  const overviewRows = await page.eval('Object.values([...document.querySelectorAll("#category-overview-list .category-tile")].reduce((rows, tile) => { const top = Math.round(tile.getBoundingClientRect().top); (rows[top] ??= []).push(tile.dataset.category); return rows; }, {})).map((row) => row.length)');
  assert.deepEqual(overviewRows, [3, 3]);
  await page.unroute('data/catalog.json');
  await page.route('data/catalog.json', { body: 'kaputt', status: 500, contentType: 'text/plain' });
  await page.goto(`${server.url}/kategorie.html?k=haeuser`);
  await page.waitFor('document.querySelector("#category-status .state--error")');
  assert.equal(await page.eval('document.querySelector("#category-browse").hidden'), true);
  assert.equal(await text(page, '#category-status .state__title'), 'Datei konnte nicht geladen werden');
  await page.unroute('data/catalog.json');
  await page.route('data/catalog.json', { file: FIXTURE });
  await page.click('#category-status button');
  await page.waitFor(`document.querySelector(${JSON.stringify(CARDS)})`, 5000);
  assert.equal(await text(page, '#category-more-status'), '24 von 27 angezeigt');
  assert.equal(await text(page, '#category-more-button'), '3 weitere Bauten laden');
  assert.ok(page.errors.every((line) => /500|Datei konnte nicht|DataError|catalog\.json/.test(line)), page.errors.join('\n'));
});

test('Fehlendes Vorschaubild: Ersatz aus Kategorie-Farbe und Icon statt kaputtem Bild', async (t) => {
  const page = await open(t, { thumbs: false });
  if (!page) return;
  await page.route('/thumbs/', { body: 'fehlt', status: 404, contentType: 'text/plain' });
  // Die 7 Häuser mit Herkunft „original“ im Test-Katalog sind neutrale Beispiele (nur für dieses Label)
  await page.goto(`${server.url}/kategorie.html?k=haeuser&herkunft=original`);
  await page.waitFor(`document.querySelectorAll(${JSON.stringify(CARDS)}).length === 7`);
  await page.waitFor('document.querySelectorAll("#category-list .build-card__fallback").length === 7', 5000);
  assert.equal(await page.eval('document.querySelectorAll("#category-list img").length'), 0);
  const ratio = await page.eval('(() => { const r = document.querySelector("#category-list .build-card__media").getBoundingClientRect(); return r.width / r.height; })()');
  assert.ok(Math.abs(ratio - 1.6) < 0.02, `16:10-Rahmen: ${ratio}`);
  assert.ok(page.errors.every((line) => /404|thumbs\//.test(line)), page.errors.join('\n'));
});

test('Handy: Filter klappen auf und zu, Karten kompakt im 16:10-Rahmen', async (t) => {
  const page = await open(t, { width: 390, height: 844 });
  if (!page) return;
  await page.goto(`${server.url}/kategorie.html?k=infrastruktur`);
  await page.waitFor(`document.querySelector(${JSON.stringify(CARDS)})`);
  const display = () => page.eval('getComputedStyle(document.querySelector("#category-filters")).display');
  assert.equal(await display(), 'none');
  await page.click('#category-filter-toggle');
  assert.equal(await display(), 'grid');
  assert.equal(await page.eval('document.querySelector("#category-filter-toggle").getAttribute("aria-expanded")'), 'true');
  // „Test im Spiel“ nur mit den Werten, die es gibt: ein ungetesteter Bau (wie bahnhof-loren), der Rest ohne Test
  assert.deepEqual(await page.eval('[...document.querySelectorAll("#category-filters input[name=test]")].map((i) => i.value)'), ['ungetestet', 'ohne']);
  assert.equal(await page.eval('document.querySelectorAll("#category-list .chip--warning").length'), 1, 'Chip nur am ungetesteten Bau');
  await page.click('#category-filters input[name="test"][value="ohne"]');
  assert.equal(await text(page, '#category-filters-done'), '13 Bauten anzeigen');
  assert.equal(await text(page, '#category-filter-toggle .browse__toggle-count'), '1');
  await page.click('#category-filters-done');
  assert.equal(await display(), 'none');
  assert.equal(await count(page), 13);
  assert.equal(await page.eval('document.querySelectorAll("#category-list .chip--warning").length'), 0);
  const ratio = await page.eval('(() => { const r = document.querySelector("#category-list .build-card__media").getBoundingClientRect(); return r.width / r.height; })()');
  assert.ok(Math.abs(ratio - 1.6) < 0.02, `16:10-Rahmen: ${ratio}`);
  assert.equal(await page.eval('document.documentElement.scrollWidth'), 390, 'kein waagrechtes Scrollen');
  assert.deepEqual(page.errors, []);
});
