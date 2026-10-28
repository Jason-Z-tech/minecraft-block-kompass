// Klick-Test der Start- und Kategorie-Seite in Chrome mit dem Test-Katalog (per page.route untergeschoben):
// Abschnitte, Suche → erstellen.html, Filter, Sortierung, Textfilter, Zurück-Taste, Nachladen bei 400 Einträgen,
// Leer- und Fehlerzustände, Ersatz für fehlende Vorschaubilder, Handy-Filter. Ohne Chrome: übersprungen.
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

test('Startseite: Abschnitte aus dem Katalog, Zahlen, Suche leitet auf erstellen.html', async (t) => {
  const page = await open(t);
  if (!page) return;
  await page.goto(`${server.url}/index.html`);
  await page.waitFor('document.querySelector("#home-sections .shelf__list .build-card")');
  const shelves = await page.eval('[...document.querySelectorAll("#home-sections .shelf")].map((s) => [s.dataset.section, s.querySelectorAll(".build-card").length])');
  assert.deepEqual(shelves, [['riesig', 4], ['schnell', 4], ['original', 4], ['massstab', 4], ['farmen', 4]]);
  assert.equal(await text(page, '#home-sections .shelf .build-card__title'), 'Cheops-Pyramide');
  assert.equal(await text(page, '#home-section-schnell-title'), 'Klein & schnell gebaut');
  assert.equal(await text(page, '#home-section-farmen-title'), 'Farmen');
  assert.match(await text(page, '#home-total'), /155\s*Bauten/);
  assert.equal(await text(page, '#home-categories [data-category="klein"] .category-tile__count'), '41 Bauten');
  // Sieben Kategorien, keine Redstone-Kachel, keine Schwierigkeit auf den Karten
  assert.deepEqual(await page.eval('[...document.querySelectorAll("#home-categories .category-tile")].map((t) => t.dataset.category)'),
    ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'farmen', 'infrastruktur']);
  assert.equal(await page.eval('document.querySelectorAll(".difficulty, [aria-label^=\'Schwierigkeit\']").length'), 0);
  assert.doesNotMatch(await page.eval('document.querySelector("main").textContent'), /Schwierigkeit/);
  // Vorschaubild genau bei den Karten, deren Eintrag eines hat (im Test-Katalog die Originale)
  const cardIds = (selector) => page.eval(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((a) => new URL(a.href).searchParams.get("id"))`);
  const shownIds = await cardIds('#home-sections .build-card .build-card__link');
  const withImage = await page.eval('[...document.querySelectorAll("#home-sections .build-card")].filter((c) => c.querySelector("img.build-card__img")).map((c) => new URL(c.querySelector(".build-card__link").href).searchParams.get("id"))');
  const thumbIds = new Set(fixture.builds.filter((build) => build.thumb).map((build) => build.id));
  assert.deepEqual(withImage, shownIds.filter((id) => thumbIds.has(id)));
  assert.ok(withImage.length >= 4, 'Originale haben Vorschaubilder');
  const link = await page.eval('document.querySelector("[data-section=riesig] .shelf-link").getAttribute("href")');
  assert.equal(link, '/kategorie.html?k=wahrzeichen&groesse=gross&groesse=riesig&sort=bloecke-ab');
  await page.type('#home-search-input', '  Burg   Eltz ');
  await page.click('#home-search-form button[type="submit"]');
  await page.waitFor('location.pathname.endsWith("/erstellen.html")');
  assert.equal(await search(page), '?q=Burg%20Eltz');
  assert.deepEqual(page.errors, []);
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
  await page.goto(`${server.url}/kategorie.html?k=farmen&q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&groesse=gigantisch&sort=zufall&test=ungetestet`);
  await page.waitFor('document.querySelector("#category-empty .state")');
  assert.equal(await search(page), '?k=farmen&q=%3Cimg+src%3Dx+onerror%3Dalert%281%29%3E&test=ungetestet');
  assert.equal(await page.eval('document.querySelectorAll("main img[src=x]").length'), 0);
  assert.match(await text(page, '#category-result-count'), /^Keiner von 17 Bauten passt zu „<img src=x onerror=alert\(1\)>“ und deinen Filtern$/);
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
  const empty = { ...fixture, builds: fixture.builds.filter((build) => build.category !== 'farmen') };
  const page = await open(t, { catalogBody: JSON.stringify(empty) });
  if (!page) return;
  await page.goto(`${server.url}/kategorie.html?k=farmen`);
  await page.waitFor('document.querySelector("#category-status .state--empty")');
  assert.equal(await page.eval('document.querySelector("#category-browse").hidden'), true);
  await page.goto(`${server.url}/kategorie.html?k=gibtsnicht`);
  await page.waitFor('document.querySelector("#category-overview-list .category-tile__count:not(.is-loading)")');
  assert.equal(await text(page, '#category-status .state__title'), 'Diese Kategorie gibt es nicht');
  // Die Kategorie Redstone gibt es nicht mehr: alte Adressen zeigen denselben Hinweis
  await page.goto(`${server.url}/kategorie.html?k=redstone`);
  await page.waitFor('document.querySelector("#category-overview-list .category-tile__count:not(.is-loading)")');
  assert.equal(await text(page, '#category-status .state__title'), 'Diese Kategorie gibt es nicht');
  assert.equal(await page.eval('document.querySelectorAll("#category-overview-list [data-category=redstone]").length'), 0);
  await page.goto(`${server.url}/kategorie.html`);
  await page.waitFor('document.querySelector("#category-count").textContent');
  assert.equal(await text(page, '#category-count'), '138 Bauten in 7 Kategorien');
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
  await page.goto(`${server.url}/kategorie.html?k=farmen`);
  await page.waitFor(`document.querySelector(${JSON.stringify(CARDS)})`);
  const display = () => page.eval('getComputedStyle(document.querySelector("#category-filters")).display');
  assert.equal(await display(), 'none');
  await page.click('#category-filter-toggle');
  assert.equal(await display(), 'grid');
  assert.equal(await page.eval('document.querySelector("#category-filter-toggle").getAttribute("aria-expanded")'), 'true');
  await page.click('#category-filters input[name="test"][value="ohne"]');
  assert.equal(await text(page, '#category-filters-done'), '4 Bauten anzeigen');
  assert.equal(await text(page, '#category-filter-toggle .browse__toggle-count'), '1');
  await page.click('#category-filters-done');
  assert.equal(await display(), 'none');
  assert.equal(await count(page), 4);
  const ratio = await page.eval('(() => { const r = document.querySelector("#category-list .build-card__media").getBoundingClientRect(); return r.width / r.height; })()');
  assert.ok(Math.abs(ratio - 1.6) < 0.02, `16:10-Rahmen: ${ratio}`);
  assert.equal(await page.eval('document.documentElement.scrollWidth'), 390, 'kein waagrechtes Scrollen');
  assert.deepEqual(page.errors, []);
});
