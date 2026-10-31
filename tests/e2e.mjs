// Klick-Test der ganzen Seite im echten Chrome gegen den echten Katalog (data/catalog.json):
//   node tests/e2e.mjs [--gpu hardware|swiftshader] [--out tmp/integration/e2e] [--only start,bau,erstellen,meine,handy]
// Start (sechs Kategorien, ohne Scrollen bis zur letzten Kachel, Kopf ohne Suche, Navigation mit „Meine Bauten“) →
// Kategorie (Filter samt „Original vom Ersteller“, Sortierung, Zurück) → Bau-Seiten (Tokyo Skytree 1:1, Infinity Castle,
// ein Haus mit Bett und Truhe, ein Community-Bau mit Ersteller und Lizenz: Schritte, Abspielen, Tabs, Abhaken + Neuladen,
// Ebenen-Plan, Schnitt, Laufen, Maßstab; Lauf-Modus ohne hängende Tasten; alte Adressen spiel-…, Redstone, Farmen → unbekannt)
// → „Selber erstellen“ (Freitext, Upload je Fixture-Format) → „Meine Bauten“ (Upload → speichern → Liste → öffnen →
// neu laden → löschen, ZIP mit manifest.json) → Handy 390 × 844. Screenshots nach --out, Leistungswerte (Ladezeit,
// Bildrate beim Drehen) am Ende. Konsolenfehler zählen als Fehler. Exit-Code 1, wenn eine Prüfung fehlschlägt,
// 2 bei falschen Optionen oder fehlenden Spieldaten.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../scripts/serve.mjs';
import { CATEGORY_SLUGS } from '../js/ui/shared.js';
import { launchBrowser } from './browser.mjs';
import { HOME_READY, MINE_READY, homeFits, checkHeader, mineFlowSteps, communityInfoSteps, walkStuckSteps } from './lib/e2e-common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'data', 'catalog.json');
const IMPORT_DIR = path.join(ROOT, 'tests/fixtures/create/import');
const MODEL_DIR = path.join(ROOT, 'tests/fixtures/create/voxelize');
const FLOW_NAMES = ['start', 'bau', 'erstellen', 'meine', 'handy'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readOptions(argv) {
  const options = { gpu: 'hardware', out: 'tmp/integration/e2e', only: FLOW_NAMES };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const value = argv[i + 1];
    if (name === '--gpu' && (value === 'hardware' || value === 'swiftshader')) options.gpu = value;
    else if (name === '--out' && value) options.out = value;
    else if (name === '--only' && value) options.only = value.split(',').map((part) => part.trim());
    else throw new Error(`Unbekannte oder unvollständige Option „${name}“. Erlaubt: --gpu hardware|swiftshader, --out <ordner>, --only ${FLOW_NAMES.join(',')}`);
    i++;
  }
  const unknown = options.only.filter((flow) => !FLOW_NAMES.includes(flow));
  if (unknown.length) throw new Error(`Unbekannter Ablauf „${unknown.join(', ')}“. Erlaubt: ${FLOW_NAMES.join(', ')}`);
  return options;
}

let OPTIONS;
try {
  OPTIONS = readOptions(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
if (!existsSync(CATALOG_FILE)) {
  console.error('data/catalog.json fehlt. Katalog erzeugen (braucht game-data/):\n  node scripts/extract-game-data.mjs\n  node scripts/build-catalog.mjs --thumbs');
  process.exit(2);
}
// Der Klick-Test prüft die lokale Seite mit Spieldaten und Vorschaubildern (Katalog und data/thumbs/ liegen im Repo)
const NEEDED = [['game-data/meta.json', 'node scripts/extract-game-data.mjs'], ['data/thumbs/index.json', 'node scripts/make-thumbs.mjs']];
const absent = NEEDED.filter(([file]) => !existsSync(path.join(ROOT, file)));
if (absent.length) {
  console.error(`Für den Klick-Test fehlt: ${absent.map(([file]) => file).join(', ')}. Erzeugen:\n${absent.map(([, command]) => `  ${command}`).join('\n')}\n(oder alles auf einmal: node scripts/start.mjs)`);
  process.exit(2);
}
const OUT = path.resolve(ROOT, OPTIONS.out);
const catalog = JSON.parse(readFileSync(CATALOG_FILE, 'utf8'));
const byId = new Map(catalog.builds.map((build) => [build.id, build]));

// ---------------------------------------------------------------- Ergebnisse

const results = [];
const perf = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${detail ? ` – ${detail}` : ''}`);
}
function note(text) {
  console.log(`\n== ${text}`);
}

// ---------------------------------------------------------------- Browser-Helfer

const BUILD_READY = "window.__buildView && window.__buildView.context && document.querySelector('.bv-player:not(.is-loading)')";
const CREATE_READY = 'window.__createPage && window.__createPage.ready';
const createViewReady = (slot, host) => `window.__createPage.views.${slot} && window.__createPage.views.${slot}.context && document.querySelector('#${host} .bv-player:not(.is-loading)')`;
// renderer.js meldet jede Ablehnung des Workers per console.error – auch die absichtlich kaputte Testdatei
const EXPECTED_IMPORT_ERRORS = [/^3D-Worker \(load\): Die Datei ist beschädigt oder unvollständig/];

let usedGpu = null;
async function openBrowser({ mobile = false } = {}) {
  const size = mobile ? { width: 390, height: 844, mobile: true, deviceScaleFactor: 2 } : { width: 1280, height: 900 };
  let page = null;
  try {
    page = await launchBrowser({ ...size, gpu: OPTIONS.gpu, reducedMotion: true });
    const webgl = await page.eval("Boolean(document.createElement('canvas').getContext('webgl2'))");
    if (!webgl) throw new Error('kein WebGL2');
    usedGpu = OPTIONS.gpu;
  } catch (error) {
    if (OPTIONS.gpu === 'swiftshader') throw error;
    console.warn(`Grafikkarte nicht nutzbar (${error.message}) – nehme swiftshader.`);
    await page?.close();
    page = await launchBrowser({ ...size, gpu: 'swiftshader', reducedMotion: true });
    usedGpu = 'swiftshader';
  }
  openPages.add(page);
  const close = page.close;
  page.close = async () => {
    openPages.delete(page);
    await close();
  };
  return page;
}

// Offene Browser, damit ein hängender Ablauf (Zeitgrenze) kein Chrome zurücklässt
const openPages = new Set();
const FLOW_TIMEOUT_MS = 10 * 60 * 1000;

async function runWithTimeout(name, run) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Zeitgrenze von ${FLOW_TIMEOUT_MS / 60000} Minuten überschritten (Ablauf hängt)`)), FLOW_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(), timeout]);
  } finally {
    clearTimeout(timer);
    for (const page of [...openPages]) await page.close().catch((error) => console.error(`Browser „${name}“ ließ sich nicht schließen: ${error.message}`));
  }
}

async function shot(page, name) {
  await page.screenshot(path.join(OUT, `${name}.png`));
}

// Einmal durch die Seite scrollen, damit Bilder mit loading="lazy" laden; danach auf alle Bilder warten.
// Rückgabe: Zahl der Bilder, die nicht geladen werden konnten.
async function loadLazyImages(page) {
  const height = await page.eval('document.documentElement.scrollHeight');
  const step = await page.eval('window.innerHeight');
  for (let y = 0; y < height; y += step) {
    await page.eval(`window.scrollTo(0, ${y})`);
    await sleep(60);
  }
  await page.waitFor("[...document.images].every((img) => img.complete)", 10000).catch(() => {});
  return page.eval("[...document.images].filter((img) => img.complete && img.naturalWidth === 0).length");
}

// Ganze Seite statt nur des Fensters. lazy: false auf der Kategorie-Seite – dort lädt Scrollen weitere Karten nach,
// und ein Screenshot über die Fensterhöhe hinaus blieb dann hängen.
async function fullShot(page, name, { lazy = true } = {}) {
  if (lazy) await loadLazyImages(page);
  await page.eval('window.scrollTo(0, 0)');
  await sleep(150);
  const metrics = await page.send('Page.getLayoutMetrics');
  const { width, height } = metrics.cssContentSize ?? metrics.contentSize;
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(width), height: Math.min(Math.ceil(height), 8000), scale: 1 },
  });
  await writeFile(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
}

function takeErrors(page, ignore = []) {
  return page.errors.splice(0).filter((text) => !ignore.some((pattern) => pattern.test(text)));
}

function checkConsole(page, label, ignore = []) {
  const errors = takeErrors(page, ignore);
  check(`${label}: Konsole ohne Fehler`, errors.length === 0, errors.slice(0, 3).join(' | '));
}

const setRange = (page, selector, value) => page.eval(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  input.value = ${JSON.stringify(String(value))};
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

const noHorizontalScroll = (page) => page.eval('document.documentElement.scrollWidth <= window.innerWidth + 1');

async function waitIdle(page) {
  await page.eval('window.__buildView.viewer.idle()');
  await sleep(200);
}

// Kamera erst mit echter Maus ziehen (dreht sie sich?), dann wie die Testseite (?bench) Bild für Bild weiterdrehen und
// die Bilder zählen, die der Viewer wirklich zeichnet. Die Bildrate von headless Chrome endet bei etwa 144.
async function measureOrbitFps(page, seconds = 4) {
  const box = await page.eval("(() => { const r = document.querySelector('.bv-stage__canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; })()");
  const yawBefore = await page.eval('window.__buildView.viewer.controls.orbit.orbit.yaw');
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 10; i++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + i * 12, y: box.y, button: 'left', buttons: 1 });
    await sleep(30);
  }
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + 120, y: box.y, button: 'left', clickCount: 1 });
  await sleep(300);
  const dragged = Math.abs((await page.eval('window.__buildView.viewer.controls.orbit.orbit.yaw')) - yawBefore) > 0.05;
  const bench = await page.eval(`(async () => {
    const viewer = window.__buildView.viewer;
    const orbit = viewer.controls.orbit;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    let yaw = orbit.orbit.yaw;
    const frames = [];
    const start = performance.now();
    while (performance.now() - start < ${seconds * 1000}) {
      yaw += 0.01;
      orbit.setView({ yaw }, { animate: false });
      await nextFrame();
      frames.push(performance.now());
    }
    const gaps = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
    const elapsed = (frames[frames.length - 1] - frames[0]) / 1000;
    return { fps: (frames.length - 1) / elapsed, p95: gaps[Math.floor(gaps.length * 0.95)], viewerFps: viewer.stats.fps, frameCpuMs: viewer.stats.frameCpuMs, quads: viewer.stats.quads };
  })()`);
  return { dragged, ...bench };
}

// ---------------------------------------------------------------- Start und Kategorie

function expectedCategory(slug) {
  return catalog.builds.filter((build) => build.category === slug);
}

// Desktop-Größe für die Prüfung „Startseite ohne Scrollen“ (der übrige Ablauf läuft mit 1280 × 900)
const setViewport = (page, width, height) => page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

async function startFlow(server) {
  note('Start und Kategorie (Desktop 1280 × 800 bzw. 1280 × 900)');
  const page = await openBrowser();
  try {
    await setViewport(page, 1280, 800);
    await page.goto(`${server.url}/index.html`);
    await page.waitFor(HOME_READY, 20000);
    check('Start: Katalog geladen, keine Fehlerbox', await page.eval("!document.querySelector('.state--error')"));
    const home = await homeFits(page);
    check('Start: Gesamtzahl der Bauten (Summe der Kacheln)', home.total === catalog.counts.total && catalog.builds.length === catalog.counts.total, `${home.total} Bauten, Katalog ${catalog.counts.total}`);
    const wrongTiles = Object.entries(catalog.counts.byCategory).filter(([slug, n]) => home.byCategory[slug] !== String(n));
    check('Start: Anzahl je Kategorie-Kachel', wrongTiles.length === 0, wrongTiles.map(([slug, n]) => `${slug} ${home.byCategory[slug]} statt ${n}`).join(', ') || `${CATEGORY_SLUGS.length} Kacheln`);
    check('Start: sechs Kategorien, ohne Redstone und Farmen', CATEGORY_SLUGS.length === 6 && Object.keys(home.byCategory).join(',') === CATEGORY_SLUGS.join(',')
      && !('redstone' in catalog.counts.byCategory) && !('farmen' in catalog.counts.byCategory)
      && catalog.builds.every((build) => build.category !== 'redstone' && build.category !== 'farmen')
      && await page.eval("document.querySelectorAll('#home-categories .category-tile').length === 6 && !document.querySelector('#home-categories [data-category=\"farmen\"], #home-categories [data-category=\"redstone\"]')"),
      Object.keys(home.byCategory).join(', '));
    check('Start 1280 × 800: bis zur letzten Kachel und den Links ohne Scrollen', home.ok, `Kacheln bis ${home.tiles} px, Links bis ${home.links} px, Fenster ${home.height} px`);
    const simple = await page.eval(`({
      cards: document.querySelectorAll('main .build-card, main img.build-card__img, .shelf, .how, .hero-stats, .eyebrow, #home-sections, #home-total').length,
      links: [...document.querySelectorAll('#home-links a')].map((a) => a.getAttribute('href')).join(','),
      search: document.querySelector('#home-search-form')?.getAttribute('action') ?? null,
      text: /Schwierigkeit|So funktioniert|Original aus dem Spiel|Stand /.test(document.querySelector('main').textContent),
    })`);
    check('Start: einfach – Titel, Suche, Kacheln und zwei Links, keine Bau-Reihen', simple.cards === 0 && !simple.text && simple.links === 'erstellen.html,meine.html' && simple.search === 'erstellen.html', JSON.stringify(simple));
    await checkHeader(page, check, 'Start', 'home');
    await shot(page, 'desktop-01-start');
    // Suche der Startseite leitet wie bisher auf „Selber erstellen“
    await page.type('#home-search-input', 'Infinity Castle');
    await page.click('#home-search-form button[type="submit"]');
    await page.waitFor("location.pathname.endsWith('/erstellen.html') && window.__createPage && window.__createPage.request", 30000);
    check('Start: Suche führt zu erstellen.html?q=…', await page.eval("window.__createPage.request.matches?.[0]?.entry.id === 'infinity-castle' && new URLSearchParams(location.search).get('q') === 'Infinity Castle'"),
      await page.eval('location.search'));
    await checkHeader(page, check, 'Erstellen', 'create');
    checkConsole(page, 'Start');

    // Kategorie über die Kachel öffnen
    await setViewport(page, 1280, 900);
    await page.goto(`${server.url}/index.html`);
    await page.waitFor(HOME_READY, 20000);
    await page.click('#home-categories .category-tile[data-category="haeuser"]');
    await page.waitFor("location.pathname.endsWith('/kategorie.html') && document.querySelectorAll('#category-list .build-card').length > 0", 20000);
    const houses = expectedCategory('haeuser');
    const countText = await page.eval("document.getElementById('category-result-count').textContent");
    check('Kategorie Häuser: Trefferzahl', countText.replace(/\D/g, '').startsWith(String(houses.length)), countText.trim());
    await checkHeader(page, check, 'Kategorie', 'category');
    // Vorschaubilder gibt es nur noch auf den Kategorie-Seiten (die Startseite zeigt keine Bauten mehr)
    const brokenImages = await loadLazyImages(page);
    const thumbCount = await page.eval("document.querySelectorAll('#category-list img.build-card__img').length");
    check('Kategorie: alle Vorschaubilder geladen', brokenImages === 0 && thumbCount > 0, `${thumbCount} Vorschaubilder, ${brokenImages} kaputt`);
    await page.eval('window.scrollTo(0, 0)');
    const sorts = await page.eval("[...document.querySelectorAll('#category-sort option')].map((o) => o.value)");
    const filterNames = await page.eval("[...new Set([...document.querySelectorAll('#category-filters input')].map((i) => i.name))]");
    check('Kategorie: weder Filter noch Sortierung nach Schwierigkeit', !sorts.some((key) => key.startsWith('schwierigkeit')) && !filterNames.includes('schwierigkeit'), `${sorts.join(', ')} · ${filterNames.join(', ')}`);
    await fullShot(page, 'desktop-02-kategorie', { lazy: false });

    // Herkunft „original“ heißt jetzt „Original vom Ersteller“ (Community-Bauten); unter Häuser gibt es solche Bauten
    const originals = houses.filter((build) => build.accuracy === 'original');
    const originalLabel = await page.eval("document.querySelector('#category-filters label.filter-option:has(input[name=\"herkunft\"][value=\"original\"])')?.textContent.replace(/\\s+/g, ' ').trim() ?? null");
    check('Filter: Option „Original vom Ersteller“ für die Community-Bauten', originals.length > 0 && originals.every((build) => build.community) && /Original vom Ersteller/.test(originalLabel ?? '')
      && !/Original aus dem Spiel/.test(await page.eval("document.getElementById('category-filters').textContent")), `${originals.length} Community-Häuser · „${originalLabel}“`);
    const filterVisible = await page.eval("(() => { const box = document.querySelector('#category-filters input[name=\"herkunft\"][value=\"nachempfunden\"]'); const label = box && box.closest('label'); return Boolean(label && label.getBoundingClientRect().width > 0); })()");
    if (!filterVisible) await page.click('#category-filter-toggle');
    await page.click('#category-filters label.filter-option:has(input[name="herkunft"][value="nachempfunden"])');
    await page.waitFor("location.search.includes('herkunft=nachempfunden')", 5000);
    const copied = houses.filter((build) => build.accuracy === 'nachempfunden');
    const filtered = await page.eval("document.getElementById('category-result-count').textContent");
    check('Filter „Nachempfunden“', copied.length > 0 && filtered.replace(/\D/g, '').startsWith(String(copied.length)), filtered.trim());

    // Sortierung „Blöcke: viele zuerst“
    await page.eval("(() => { const s = document.getElementById('category-sort'); s.value = 'bloecke-ab'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await page.waitFor("location.search.includes('sort=bloecke-ab')", 5000);
    const maxBlocks = Math.max(...copied.map((build) => build.blocks));
    const firstTitle = await page.eval("document.querySelector('#category-list .build-card__link').textContent");
    const firstOk = copied.some((build) => build.title === firstTitle && build.blocks === maxBlocks);
    check('Sortierung „Blöcke: viele zuerst“', firstOk, `erste Karte: ${firstTitle}`);
    await fullShot(page, 'desktop-03-kategorie-filter-sortiert', { lazy: false });

    // Zurück-Taste: erst Sortierung, dann Filter weg
    await page.eval('history.back()');
    await page.waitFor("!location.search.includes('sort=') && location.search.includes('herkunft=nachempfunden')", 5000);
    check('Zurück: Sortierung zurückgenommen', await page.eval("document.getElementById('category-sort').value === 'name'"));
    await page.eval('history.back()');
    await page.waitFor("!location.search.includes('herkunft=')", 5000);
    const backCount = await page.eval("document.getElementById('category-result-count').textContent");
    check('Zurück: Filter zurückgenommen', backCount.replace(/\D/g, '').startsWith(String(houses.length)) && !(await page.eval("document.querySelector('#category-filters input[value=\"nachempfunden\"]').checked")), backCount.trim());

    // Filter „Original vom Ersteller“: nur die Community-Bauten, jede Karte mit diesem Herkunft-Chip
    if (!(await page.eval("(() => { const box = document.querySelector('#category-filters input[name=\"herkunft\"][value=\"original\"]'); const label = box && box.closest('label'); return Boolean(label && label.getBoundingClientRect().width > 0); })()"))) await page.click('#category-filter-toggle');
    // Echter Klick auf die Option; landet er noch im Nachlauf des Zurück (Liste wird neu gezeichnet), ein zweiter Versuch
    let originalClicks = 0;
    for (; originalClicks < 3; originalClicks++) {
      await sleep(300);
      await page.click('#category-filters label.filter-option:has(input[name="herkunft"][value="original"])');
      if (await page.waitFor("location.search.includes('herkunft=original')", 4000).then(() => true, () => false)) break;
    }
    const originalCount = await page.eval("document.getElementById('category-result-count').textContent");
    const originalCards = await page.eval("[...document.querySelectorAll('#category-list .build-card')].map((card) => ({ id: card.querySelector('.build-card__link')?.getAttribute('href') ?? '', original: /Original vom Ersteller/.test(card.textContent) }))");
    check('Filter „Original vom Ersteller“: nur Community-Bauten', originalCount.replace(/\D/g, '').startsWith(String(originals.length)) && originalCards.length > 0
      && originalCards.every((card) => card.original && originals.some((build) => card.id.endsWith(`id=${build.id}`))), `${originalCount.trim()} · ${originalCards.length} Karten sichtbar · ${originalClicks + 1}. Klick`);
    await fullShot(page, 'desktop-03b-kategorie-original', { lazy: false });
    await page.eval('history.back()');
    await page.waitFor("!location.search.includes('herkunft=')", 5000);

    // Karte öffnet die Bau-Seite
    const href = await page.eval("document.querySelector('#category-list .build-card__link').getAttribute('href')");
    await page.click('#category-list .build-card__link');
    await page.waitFor(`location.pathname.endsWith('/bau.html') && ${BUILD_READY}`, 60000);
    check('Karte öffnet die Bau-Seite', true, href);
    checkConsole(page, 'Kategorie');

    // Übersicht aller Kategorien und unbekannte Kategorie
    await page.goto(`${server.url}/kategorie.html`);
    await page.waitFor(`document.querySelectorAll('#category-overview-list .category-tile').length === ${CATEGORY_SLUGS.length}`, 10000);
    check('Übersicht aller Kategorien', await page.eval("document.querySelectorAll('#category-overview-list [data-category=\"redstone\"]').length === 0"));
    await fullShot(page, 'desktop-04-kategorien');
    await page.goto(`${server.url}/kategorie.html?k=gibtsnicht`);
    await page.waitFor("document.querySelector('#category-status .state--error')", 10000);
    check('Unbekannte Kategorie: Fehlerhinweis', true);
    // Alte Adresse der Kategorie Redstone: derselbe Hinweis wie bei jeder unbekannten Kategorie
    await page.goto(`${server.url}/kategorie.html?k=redstone`);
    await page.waitFor("document.querySelector('#category-status .state--error')", 10000);
    check('Kategorie Redstone gibt es nicht mehr: Hinweis „unbekannt“', await page.eval("/gibt es nicht/.test(document.querySelector('#category-status').textContent)"));
    // Alte Adresse der Kategorie Farmen: ebenso „Diese Kategorie gibt es nicht“
    await page.goto(`${server.url}/kategorie.html?k=farmen`);
    await page.waitFor("document.querySelector('#category-status .state--error')", 10000);
    check('Kategorie Farmen gibt es nicht mehr: „Diese Kategorie gibt es nicht“', await page.eval("document.querySelector('#category-status .state__title')?.textContent.trim() === 'Diese Kategorie gibt es nicht' && document.querySelectorAll('#category-list .build-card').length === 0"),
      await page.eval("document.querySelector('#category-status').textContent.replace(/\\s+/g, ' ').trim().slice(0, 100)"));
    // Alte Adresse mit Schwierigkeit: still auf den Standard zurück
    await page.goto(`${server.url}/kategorie.html?k=haeuser&schwierigkeit=2&sort=schwierigkeit-auf`);
    await page.waitFor("document.querySelectorAll('#category-list .build-card').length > 0", 20000);
    check('Alte Adresse mit Schwierigkeit: Standard-Sortierung, alle Häuser', await page.eval("document.getElementById('category-sort').value === 'name' && location.search === '?k=haeuser'")
      && (await page.eval("document.getElementById('category-result-count').textContent")).replace(/\D/g, '').startsWith(String(houses.length)), await page.eval('location.search'));
    checkConsole(page, 'Übersicht');
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Bau-Seiten

// Ein kleines Haus mit Bett und Truhe (Blöcke mit Entity-Texturen), sonst das kleinste Haus
const HAUS_ID = byId.get('starterhaus-eiche')?.module ? 'starterhaus-eiche'
  : [...catalog.builds].filter((build) => build.category === 'haeuser' && build.module).sort((a, b) => a.blocks - b.blocks)[0]?.id;
// Ein Bau mit tested: false (seit Farmen weg sind nur noch bahnhof-loren); der Chip „Nicht im Spiel getestet“ erscheint dort
const UNTESTED_ID = byId.get('bahnhof-loren')?.tested === false ? 'bahnhof-loren' : catalog.builds.find((build) => build.tested === false)?.id ?? null;
// Community-Bauten (data/community/): ein kleiner .nbt-Bau für den ganzen Ablauf, ein .litematic-Bau zum Laden
const isCommunity = (build) => Boolean(build?.community?.file) && !build.module;
const COMMUNITY_ID = isCommunity(byId.get('qrafty-teehaus')) ? 'qrafty-teehaus'
  : [...catalog.builds].filter((build) => isCommunity(build) && build.community.format === 'nbt').sort((a, b) => a.blocks - b.blocks)[0]?.id;
const COMMUNITY_LITEMATIC_ID = isCommunity(byId.get('gidden-belvedere')) ? 'gidden-belvedere'
  : [...catalog.builds].filter((build) => isCommunity(build) && build.community.format === 'litematic').sort((a, b) => a.blocks - b.blocks)[0]?.id;

// Anleitung und Player nach dem Aufräumen: Kapitel mit Nummer und Titel, Schritte nur mit Nummer, Blockzahl und Ebene –
// keine Schritt-Namen, Schritt-Texte, Tipps, Notizen oder Schwierigkeit.
async function checkGuideWithoutTexts(page, label) {
  const found = await page.eval(`(() => {
    const removed = document.querySelectorAll('.bv-step__title, .bv-step__text, .bv-chapter__text, .bv-tips, .bv-note, .bv-notes, .bv-marker, .difficulty').length;
    const steps = [...document.querySelectorAll('.bv-step')];
    // Kurzinfo „24 Blöcke“ oder „24 Blöcke · Ebene 3 (y = 2)“ – Ebene 1 = y 0
    const metaOk = (text) => {
      const m = /^[\\d.]+ (?:Block|Blöcke)(?: · Ebene ([\\d.]+) \\(y = ([\\d.]+)\\))?$/.exec(text);
      return Boolean(m) && (m[1] === undefined || Number(m[1].replaceAll('.', '')) === Number(m[2].replaceAll('.', '')) + 1);
    };
    const badSteps = steps.filter((b) => b.children.length !== 2 || !metaOk(b.querySelector('.bv-step__meta')?.textContent ?? '')).length;
    const chapters = [...document.querySelectorAll('.bv-chapter__title')].filter((h) => h.textContent.trim() !== '').length;
    return { removed, badSteps, chapters, total: document.querySelectorAll('.bv-chapter').length };
  })()`);
  check(`${label}: Anleitung ohne Schritt-Namen, Texte, Tipps und Notizen`, found.removed === 0 && found.badSteps === 0 && found.chapters === found.total && found.total > 0,
    `${found.removed} alte Elemente, ${found.badSteps} Schritte mit mehr als Nummer/Blockzahl/Ebene, ${found.chapters}/${found.total} Kapitel mit Titel`);
}

function expectedVariant(build, scale) {
  if (scale !== null && build.variants?.[String(scale)]) return build.variants[String(scale)];
  return { blocks: build.blocks, steps: build.steps, size: build.size };
}

async function buildFlow(page, server, { id, scale = null, label, measureFps = false, scaleSwitch = null }) {
  const build = byId.get(id);
  if (!build) {
    check(`${label}: im Katalog`, false, `${id} fehlt`);
    return;
  }
  const expected = expectedVariant(build, scale);
  const url = `${server.url}/bau.html?id=${id}${scale === null ? '' : `&scale=${scale}`}`;
  await page.goto(`${server.url}/index.html`);
  await page.eval('localStorage.clear()');
  const started = Date.now();
  await page.goto(url);
  await page.waitFor(BUILD_READY, 240000, 200);
  await waitIdle(page);
  const loadSeconds = (Date.now() - started) / 1000;
  const stats = await page.eval('(({ loadMs, buildMs, meshMs, textureMs, blocks, quads, chunks }) => ({ loadMs, buildMs, meshMs, textureMs, blocks, quads, chunks }))(window.__buildView.viewer.stats)');
  const result = await page.eval('(() => { const r = window.__buildView.result; return { blocks: r.blockCount, steps: r.steps.length, size: r.size }; })()');
  check(`${label}: geladen`, result.blocks === expected.blocks && result.steps === expected.steps,
    `${result.blocks.toLocaleString('de-CH')} Blöcke, ${result.steps} Schritte, ${loadSeconds.toFixed(1)} s bis fertig gezeichnet`);
  check(`${label}: Anleitung zeigt alle Schritte`, await page.eval(`document.querySelectorAll('.bv-step').length === ${expected.steps}`));
  await checkGuideWithoutTexts(page, label);
  if (scale !== null) check(`${label}: Maßstab ${scale}`, await page.eval(`window.__buildView.context.scale === ${scale}`));
  await shot(page, `bau-${id}-01-fertig`);
  const perfEntry = { label, id, scale, blocks: result.blocks, steps: result.steps, loadSeconds, viewer: stats };

  // Schritte: Pos1, →, Knöpfe vor/zurück
  await page.eval('document.activeElement?.blur(); document.body.focus()');
  await page.key('Home');
  await page.key('ArrowRight', 'ArrowRight');
  await page.waitFor('window.__buildView.context.p === 1', 8000);
  const stepLabel = await page.eval("document.querySelector('.bv-player__label strong').textContent");
  check(`${label}: Pos1 und → zeigen Schritt 1`, stepLabel === 'Schritt 1', stepLabel);
  await page.click('.bv-player__controls .btn--icon:nth-of-type(3)');
  await page.waitFor('window.__buildView.context.p === 2', 8000);
  await page.click('.bv-player__controls .btn--icon:nth-of-type(1)');
  await page.waitFor('window.__buildView.context.p === 1', 8000);
  check(`${label}: Knöpfe Weiter und Zurück`, true);
  await waitIdle(page);
  await shot(page, `bau-${id}-02-schritt-1`);

  // Abspielen und anhalten
  await page.click('.bv-player__controls .btn--icon:nth-of-type(2)');
  await sleep(1500);
  const played = await page.eval('({ playing: window.__buildView.context.player.playing, p: window.__buildView.context.p })');
  await page.click('.bv-player__controls .btn--icon:nth-of-type(2)');
  const paused = !(await page.eval('window.__buildView.context.player.playing'));
  check(`${label}: Abspielen und Pause`, played.playing && played.p > 1 && paused, `Fortschritt nach 1,5 s: ${played.p.toFixed(2)}`);

  // Ende, Anleitung-Klick
  const middle = Math.max(0, Math.floor(expected.steps / 2) - 1);
  await page.click(`.bv-step[data-step="${middle}"]`);
  await page.waitFor(`window.__buildView.context.p === ${middle + 1}`, 8000);
  check(`${label}: Klick in der Anleitung springt zum Schritt`, true, `Schritt ${middle + 1}`);
  await waitIdle(page);
  await shot(page, `bau-${id}-03-mitte`);

  // Material abhaken
  await page.click('[data-tab="materials"]');
  await page.waitFor("document.querySelectorAll('.bv-material .slot__icon[src]').length > 0", 20000);
  const itemCount = await page.eval("document.querySelectorAll('.bv-materials__list .bv-material').length");
  await page.click('.bv-materials__list li:nth-child(1) .bv-material');
  if (itemCount > 1) await page.click('.bv-materials__list li:nth-child(2) .bv-material');
  const checkedBefore = await page.eval("[...document.querySelectorAll('.bv-material[aria-pressed=\"true\"]')].map((b) => b.dataset.item)");
  check(`${label}: Material abhaken`, checkedBefore.length === Math.min(2, itemCount), checkedBefore.join(', '));
  await shot(page, `bau-${id}-04-material`);

  // Ebenen-Plan
  await page.click('[data-tab="layers"]');
  await page.waitFor("/Ebene \\d+ von/.test(document.querySelector('.bv-plan__layer')?.textContent ?? '')", 15000);
  await sleep(500);
  check(`${label}: Ebenen-Plan`, true, await page.eval("document.querySelector('.bv-plan__layer').textContent"));
  await shot(page, `bau-${id}-05-ebenen`);

  // Infos
  await page.click('[data-tab="info"]');
  await sleep(200);
  check(`${label}: Infos zeigen den Titel`, await page.eval(`document.querySelector('.bv-panels').textContent.includes(${JSON.stringify(build.title)}) || document.title.includes(${JSON.stringify(build.title)})`));
  const infoText = await page.eval("document.querySelector('.bv-info')?.textContent ?? ''");
  check(`${label}: Infos ohne Schwierigkeit und Wissenswertes`, infoText !== '' && !/Schwierigkeit|Wissenswert/.test(infoText));
  await shot(page, `bau-${id}-06-infos`);

  // Neu laden: Haken und Schritt bleiben
  await page.eval('window.__buildView.context.progress.flush()');
  await page.reload();
  await page.waitFor(BUILD_READY, 240000, 200);
  await page.click('[data-tab="materials"]');
  const checkedAfter = await page.eval("[...document.querySelectorAll('.bv-material[aria-pressed=\"true\"]')].map((b) => b.dataset.item)");
  check(`${label}: Haken bleiben nach dem Neuladen`, checkedAfter.length === checkedBefore.length && checkedBefore.every((item) => checkedAfter.includes(item)), checkedAfter.join(', '));
  check(`${label}: Schritt bleibt nach dem Neuladen`, await page.eval(`window.__buildView.context.p === ${middle + 1}`), String(await page.eval('window.__buildView.context.p')));
  await waitIdle(page);

  // Schnitt
  const clipY = Math.max(1, Math.floor(result.size[1] / 2));
  await page.click('.bv-tools .bv-tool[aria-controls$="-clip"]');
  await setRange(page, '.bv-clip__slider', clipY);
  await waitIdle(page);
  check(`${label}: Schnitt bis Ebene ${clipY}`, await page.eval(`window.__buildView.viewer.clip?.maxY === ${clipY - 1}`), JSON.stringify(await page.eval('window.__buildView.viewer.clip')));
  await shot(page, `bau-${id}-07-schnitt`);
  await page.click('.bv-clip .btn--ghost');
  check(`${label}: Schnitt aus`, await page.eval('window.__buildView.viewer.clip === null'));
  await page.click('.bv-tools .bv-tool[aria-controls$="-clip"]');

  // Laufen kurz an (W gedrückt), dann aus
  await page.click('.bv-walk-toggle');
  await page.waitFor("window.__buildView.viewer.mode === 'walk'", 5000);
  const before = await page.eval('(() => { const p = window.__buildView.viewer.controls.walk?.player; return p ? [p.x, p.y, p.z] : null; })()');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  await sleep(700);
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
  const after = await page.eval('(() => { const p = window.__buildView.viewer.controls.walk?.player; return p ? [p.x, p.y, p.z] : null; })()');
  const moved = before && after ? Math.hypot(after[0] - before[0], after[2] - before[2]) : null;
  await shot(page, `bau-${id}-08-laufen`);
  await page.click('.bv-walk-toggle');
  await page.waitFor("window.__buildView.viewer.mode === 'orbit'", 5000);
  check(`${label}: Laufmodus an und aus`, true, moved === null ? 'Position nicht lesbar' : `mit W ${moved.toFixed(2)} Blöcke gelaufen`);

  if (measureFps) {
    await page.key('End');
    await waitIdle(page);
    perfEntry.orbit = await measureOrbitFps(page);
    const { dragged, fps, viewerFps, p95, frameCpuMs } = perfEntry.orbit;
    check(`${label}: Ziehen mit der Maus dreht die Kamera`, dragged);
    check(`${label}: Bildrate beim Drehen ≥ 60`, fps >= 60,
      `${fps.toFixed(0)} Bilder/s (Viewer ${viewerFps}), 95 % ≤ ${p95.toFixed(1)} ms, CPU ${frameCpuMs} ms je Bild`);
  }

  if (scaleSwitch !== null) {
    // Maßstab im selben Viewer wechseln (lädt neu ohne Seitenwechsel)
    await page.click('[data-tab="info"]');
    const index = build.scales.indexOf(scaleSwitch) + 1;
    await page.click(`.bv-scale__option:nth-child(${index})`);
    await page.waitFor(`location.search.includes('scale=${scaleSwitch}') && window.__buildView.context && window.__buildView.context.scale === ${scaleSwitch} && ${BUILD_READY}`, 120000, 200);
    await waitIdle(page);
    const switched = expectedVariant(build, scaleSwitch);
    check(`${label}: Maßstab-Wechsel auf ${scaleSwitch}`, await page.eval(`window.__buildView.result.blockCount === ${switched.blocks}`), await page.eval('location.search'));
    await shot(page, `bau-${id}-09-massstab-${scaleSwitch}`);
  }
  perf.push(perfEntry);
  checkConsole(page, label);
}

async function buildPagesFlow(server) {
  note('Bau-Seiten (Desktop 1280 × 900)');
  const page = await openBrowser();
  try {
    await buildFlow(page, server, { id: 'tokyo-skytree', scale: 1, label: 'Tokyo Skytree 1:1', measureFps: true, scaleSwitch: 0.5 });
    await buildFlow(page, server, { id: 'infinity-castle', label: 'Infinity Castle', measureFps: true });
    await buildFlow(page, server, { id: HAUS_ID, label: `Haus ${HAUS_ID}` });
    await walkStuckSteps(page, { check, shot, label: `Laufen ${HAUS_ID}` });
    checkConsole(page, `Laufen ${HAUS_ID}`);

    // Community-Bau komplett (Datei aus data/community/, gebaut wie ein Upload) samt Ersteller und Lizenz
    if (COMMUNITY_ID) {
      await buildFlow(page, server, { id: COMMUNITY_ID, label: `Community ${COMMUNITY_ID}` });
      await communityInfoSteps(page, byId.get(COMMUNITY_ID), { check, label: `Community ${COMMUNITY_ID}` });
      await shot(page, `bau-${COMMUNITY_ID}-10-ersteller`);
      checkConsole(page, `Community ${COMMUNITY_ID} (Infos)`);
    } else check('Katalog: Community-Bau (.nbt)', false, 'keiner gefunden');
    if (COMMUNITY_LITEMATIC_ID) {
      const lite = byId.get(COMMUNITY_LITEMATIC_ID);
      await page.goto(`${server.url}/bau.html?id=${COMMUNITY_LITEMATIC_ID}`);
      await page.waitFor(BUILD_READY, 120000, 200);
      await waitIdle(page);
      check(`Community ${COMMUNITY_LITEMATIC_ID} (.litematic): geladen`, await page.eval(`window.__buildView.result.blockCount === ${lite.blocks} && window.__buildView.result.steps.length === ${lite.steps}`),
        `${lite.blocks} Blöcke, ${lite.steps} Schritte erwartet`);
      await communityInfoSteps(page, lite, { check, label: `Community ${COMMUNITY_LITEMATIC_ID}` });
      await shot(page, `bau-${COMMUNITY_LITEMATIC_ID}-ersteller`);
      checkConsole(page, `Community ${COMMUNITY_LITEMATIC_ID}`);
    } else check('Katalog: Community-Bau (.litematic)', false, 'keiner gefunden');

    // Der einzige Bau mit tested: false zeigt den Chip „Nicht im Spiel getestet“
    if (UNTESTED_ID) {
      await page.goto(`${server.url}/bau.html?id=${UNTESTED_ID}`);
      await page.waitFor(BUILD_READY, 60000);
      check(`Ungetestet ${UNTESTED_ID}: Chip „Nicht im Spiel getestet“`, await page.eval("/Nicht im Spiel getestet/.test(document.getElementById('build-chips').textContent)"));
      checkConsole(page, `Ungetestet ${UNTESTED_ID}`);
    }
    // Ein alter Link auf einen Redstone-Bau zeigt den Hinweis „nicht gefunden“
    await page.goto(`${server.url}/bau.html?id=lauflicht`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Alter Redstone-Bau (lauflicht): Fehlerzustand', !byId.has('lauflicht'));
    // Alte Farm (kaktusfarm): „Bau nicht gefunden“
    await page.goto(`${server.url}/bau.html?id=kaktusfarm`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Alte Farm bau.html?id=kaktusfarm: „Bau nicht gefunden“', !byId.has('kaktusfarm')
      && await page.eval("document.querySelector('#build-status .state__title').textContent === 'Bau nicht gefunden' && document.getElementById('build-layout').hidden"));
    await page.goto(`${server.url}/bau.html?id=gibt-es-nicht`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Unbekannte Bau-ID: Fehlerzustand', true);
    // Alte Adresse einer Spiel-Struktur: dieselbe Anzeige „unbekannt“
    await page.goto(`${server.url}/bau.html?id=spiel-plains-small-house-1`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Alte Adresse bau.html?id=spiel-…: „Bau nicht gefunden“', !catalog.builds.some((build) => build.id.startsWith('spiel-'))
      && await page.eval("document.querySelector('#build-status .state__title').textContent === 'Bau nicht gefunden' && document.getElementById('build-layout').hidden"));
    await checkHeader(page, check, 'Bau-Seite', null);
    await page.goto(`${server.url}/bau.html?form=sphere&diameter=15&block=glass&hollow=1`);
    await page.waitFor(BUILD_READY, 60000);
    check('Formen-Adresse bau.html?form=sphere', await page.eval('window.__buildView.result.blockCount > 0'));
    await waitIdle(page);
    await shot(page, 'bau-form-kugel');
    checkConsole(page, 'Fehlerzustand und Form');
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Selber erstellen

async function ask(page, text) {
  await page.eval(`(() => { document.getElementById('create-query').value = ${JSON.stringify(text)}; })()`);
  await page.click('#create-form button[type="submit"]');
  await page.waitFor(`window.__createPage.request && window.__createPage.request.query === ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`, 8000);
  await sleep(150);
  return page.eval('window.__createPage.request');
}

const resultLinks = (page) => page.eval("[...document.querySelectorAll('#create-results-body a[href]')].map((a) => a.getAttribute('href'))");

async function upload(page, files, { submit = false, timeout = 90000 } = {}) {
  const before = await page.eval('window.__createPage.imports');
  await page.setInputFiles('#import-file', files);
  if (submit) {
    await page.waitFor("document.querySelector('.import-options__submit')", 8000);
    await page.click('.import-options__submit');
  }
  await page.waitFor(`window.__createPage.imports > ${before}`, timeout);
  const outcome = await page.eval('window.__createPage.lastImport');
  if (outcome.ok) await page.waitFor(createViewReady('import', 'import-result'), 60000);
  return outcome;
}

async function createFlow(server) {
  note('Selber erstellen (Desktop 1280 × 900)');
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/erstellen.html`);
    await page.waitFor(CREATE_READY, 30000);
    check('Erstellen: Seite lädt', await page.eval('window.__createPage.error === null'), await page.eval("window.__createPage.error === null ? '' : String(window.__createPage.error)"));
    await fullShot(page, 'desktop-10-erstellen');

    const sky = await ask(page, 'Tokio Skytree Originalgrösse 1:1 (1 Block = 1 m)');
    const skyLinks = await resultLinks(page);
    check('„Tokio Skytree Originalgrösse 1:1 …“ → Skytree mit Maßstab 1',
      sky.kind === 'build' && sky.matches[0]?.entry.id === 'tokyo-skytree' && sky.scale === 1 && skyLinks.some((href) => /bau\.html\?id=tokyo-skytree&scale=1$/.test(href)),
      `${sky.kind}, ${sky.matches?.[0]?.entry.id}, Maßstab ${sky.scale}`);
    await fullShot(page, 'desktop-11-erstellen-skytree');
    // Link führt wirklich zur Bau-Seite mit Maßstab 1 (nur Adresse und Kopf prüfen)
    const castle = await ask(page, 'Infinity Castle');
    check('„Infinity Castle“ → Bau', castle.kind === 'build' && castle.matches[0]?.entry.id === 'infinity-castle', `${castle.kind}, ${castle.matches?.[0]?.entry.id}`);
    const sphere = await ask(page, 'hohle Kugel Radius 12 aus Glas');
    check('„hohle Kugel Radius 12 aus Glas“ → Form', sphere.kind === 'shape' && sphere.shape === 'sphere' && sphere.params.diameter === 25 && sphere.params.block === 'glass' && sphere.params.hollow === true,
      JSON.stringify(sphere.params));
    check('Form: Link auf bau.html?form=…', (await resultLinks(page)).some((href) => href.includes('bau.html?form=sphere&diameter=25&block=glass&hollow=1')));
    await fullShot(page, 'desktop-12-erstellen-kugel');
    const burj = await ask(page, 'Burj Khalifa');
    const burjLinks = await resultLinks(page);
    check('„Burj Khalifa“ → ehrlich nicht vorhanden', burj.kind === 'none' && !burjLinks.some((href) => href.includes('bau.html')), burj.reason ?? '');
    await fullShot(page, 'desktop-13-erstellen-burj');

    // Vorschau einer Form im Reiter Formen
    await page.click('#create-tab-formen');
    await page.click('#shape-preview-button');
    await page.waitFor(createViewReady('shape', 'shape-preview'), 60000);
    await page.eval('window.__createPage.views.shape.viewer.idle()');
    check('Formen: Vorschau geladen', await page.eval('window.__createPage.views.shape.result.blockCount > 0'));
    await fullShot(page, 'desktop-14-erstellen-formen');

    // Upload je Fixture-Format
    await page.click('#create-tab-import');
    const uploads = [
      { label: 'Sponge-Schematic (.schem)', files: [path.join(IMPORT_DIR, 'house-v2.schem')] },
      { label: 'Litematica (.litematic)', files: [path.join(IMPORT_DIR, 'regions.litematic')] },
      { label: 'Strukturdatei (.nbt)', files: [path.join(IMPORT_DIR, 'house.nbt')] },
      { label: 'MagicaVoxel (.vox)', files: [path.join(MODEL_DIR, 'scene.vox')], submit: true },
      { label: 'STL binär (.stl)', files: [path.join(MODEL_DIR, 'cube-binary.stl')], submit: true },
      { label: 'STL Text (.stl)', files: [path.join(MODEL_DIR, 'cube-ascii.stl')], submit: true },
      { label: 'Wavefront (.obj + .mtl)', files: [path.join(MODEL_DIR, 'colored.obj'), path.join(MODEL_DIR, 'colored.mtl')], submit: true },
      { label: 'glTF binär (.glb)', files: [path.join(MODEL_DIR, 'textured.glb')], submit: true },
    ];
    for (const item of uploads) {
      const outcome = await upload(page, item.files, { submit: item.submit });
      check(`Upload ${item.label}`, outcome.ok && outcome.blockCount > 0, outcome.ok ? `${outcome.blockCount} Blöcke` : outcome.error);
    }
    await fullShot(page, 'desktop-15-erstellen-import');
    const broken = await upload(page, [path.join(IMPORT_DIR, 'truncated.schem')]);
    check('Upload kaputte Datei: verständlicher Fehler', !broken.ok && /beschädigt|unvollständig/.test(broken.error ?? ''), broken.error);
    checkConsole(page, 'Erstellen', EXPECTED_IMPORT_ERRORS);

    // Link aus dem Freitext öffnet den Skytree mit Maßstab 1
    await page.goto(`${server.url}/erstellen.html?q=${encodeURIComponent('Tokio Skytree Originalgrösse 1:1 (1 Block = 1 m)')}`);
    await page.waitFor(CREATE_READY, 30000);
    await page.click('.create-feature .btn--primary');
    await page.waitFor("location.pathname.endsWith('/bau.html') && location.search.includes('id=tokyo-skytree') && location.search.includes('scale=1')", 15000);
    check('„Anleitung öffnen“ führt zu bau.html?id=tokyo-skytree&scale=1', true);
    checkConsole(page, 'Erstellen → Bau');
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Meine Bauten

async function mineFlow(server) {
  note('Meine Bauten (Desktop 1280 × 900, frisches Profil)');
  const page = await openBrowser();
  try {
    await mineFlowSteps(page, {
      base: `${server.url}/`, check, shot, importDir: IMPORT_DIR, modelDir: MODEL_DIR, tmpDir: path.join(OUT, 'dateien'), prefix: 'desktop-20-meine',
      checkConsole: (label) => checkConsole(page, label),
    });
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Handy

async function mobileFlow(server) {
  note('Handy 390 × 844');
  const page = await openBrowser({ mobile: true });
  try {
    await page.goto(`${server.url}/index.html`);
    await page.waitFor(HOME_READY, 20000);
    check('Handy Start: kein waagrechtes Scrollen', await noHorizontalScroll(page));
    const home = await homeFits(page);
    check('Handy Start 390 × 844: bis zur letzten Kachel und den Links ohne Scrollen', home.ok && home.width === 390, `Kacheln bis ${home.tiles} px, Links bis ${home.links} px, Fenster ${home.height} px`);
    await checkHeader(page, check, 'Handy Start', 'home');
    await shot(page, 'handy-01-start');
    await fullShot(page, 'handy-01-start-ganz');

    await page.goto(`${server.url}/kategorie.html?k=infrastruktur`);
    await page.waitFor("document.querySelectorAll('#category-list .build-card').length > 0", 20000);
    check('Handy Kategorie: kein waagrechtes Scrollen', await noHorizontalScroll(page));
    await fullShot(page, 'handy-02-kategorie', { lazy: false });
    await page.click('#category-filter-toggle');
    await sleep(300);
    check('Handy: Filter klappen auf', await page.eval("document.getElementById('category-filter-toggle').getAttribute('aria-expanded') === 'true'"));
    await shot(page, 'handy-03-filter');
    // Infrastruktur hat eigene Bauten und Community-Bauten: Filter „Original vom Ersteller“
    await page.click('#category-filters label.filter-option:has(input[name="herkunft"][value="original"])');
    await page.waitFor("location.search.includes('herkunft=original')", 5000);
    await page.click('#category-filters-done');
    await sleep(300);
    const infraOriginals = catalog.builds.filter((build) => build.category === 'infrastruktur' && build.accuracy === 'original').length;
    check('Handy: Filter wirkt, „Bauten anzeigen“ klappt zu', await page.eval("document.getElementById('category-filter-toggle').getAttribute('aria-expanded') === 'false'")
      && (await page.eval("document.getElementById('category-result-count').textContent")).replace(/\D/g, '').startsWith(String(infraOriginals)), `${infraOriginals} Community-Bauten erwartet`);

    await page.goto(`${server.url}/bau.html?id=${HAUS_ID}`);
    await page.waitFor(BUILD_READY, 60000);
    await waitIdle(page);
    check('Handy Bau-Seite: geladen, kein waagrechtes Scrollen', await noHorizontalScroll(page));
    await shot(page, 'handy-04-bau');
    await page.click('.bv-player__controls .btn--icon:nth-of-type(1)');
    await page.click('.bv-player__controls .btn--icon:nth-of-type(3)');
    await page.click('[data-tab="materials"]');
    await page.waitFor("document.querySelectorAll('.bv-material .slot__icon[src]').length > 0", 15000);
    await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await sleep(200);
    await shot(page, 'handy-05-bau-material');
    await page.click('[data-tab="layers"]');
    await sleep(600);
    await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await shot(page, 'handy-06-bau-ebenen');
    await page.eval('window.scrollTo(0, 0)');
    await page.click('.bv-walk-toggle');
    await page.waitFor("window.__buildView.viewer.mode === 'walk'", 5000);
    await sleep(300);
    check('Handy Laufmodus: Touch-Steuerung sichtbar', await page.eval("(() => { const t = document.querySelector('.walk-touch'); return Boolean(t && t.getBoundingClientRect().width > 0); })()"));
    // Block-Tooltip (Fadenkreuz) und Lauf-Hinweis liegen beide oben: der Tooltip rückt unter den Hinweis
    const tipAndHelp = await page.eval(`new Promise((resolve) => {
      const started = performance.now();
      const tick = () => {
        const tip = document.querySelector('.bv-tooltip');
        const help = document.querySelector('.bv-walkhelp');
        if (tip && help && !help.hidden) {
          const a = tip.getBoundingClientRect(), b = help.getBoundingClientRect();
          resolve({ overlap: a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right, tip: Math.round(a.top), help: Math.round(b.bottom) });
        } else if (performance.now() - started > 6000) resolve({ missing: tip ? 'Hinweis' : 'Tooltip' });
        else requestAnimationFrame(tick);
      };
      tick();
    })`);
    check('Handy Laufmodus: Block-Tooltip verdeckt den Lauf-Hinweis nicht', tipAndHelp.overlap === false, JSON.stringify(tipAndHelp));
    await shot(page, 'handy-07-laufen');
    await page.click('.bv-walk-toggle');
    checkConsole(page, 'Handy Start/Kategorie/Bau');

    await page.goto(`${server.url}/bau.html?id=tokyo-skytree&scale=1`);
    await page.waitFor(BUILD_READY, 240000, 200);
    await waitIdle(page);
    check('Handy: Tokyo Skytree 1:1 lädt', await page.eval(`window.__buildView.result.blockCount === ${expectedVariant(byId.get('tokyo-skytree'), 1).blocks}`));
    await shot(page, 'handy-08-skytree');
    checkConsole(page, 'Handy Skytree');

    await page.goto(`${server.url}/erstellen.html?q=${encodeURIComponent('Infinity Castle')}`);
    await page.waitFor(CREATE_READY, 30000);
    check('Handy Erstellen: kein waagrechtes Scrollen', await noHorizontalScroll(page));
    await fullShot(page, 'handy-09-erstellen');
    await page.click('#create-tab-formen');
    await sleep(200);
    await fullShot(page, 'handy-10-erstellen-formen');
    await page.click('#create-tab-import');
    const outcome = await upload(page, [path.join(IMPORT_DIR, 'house.nbt')]);
    check('Handy Upload .nbt', outcome.ok, outcome.error ?? '');
    check('Handy mit Import: kein waagrechtes Scrollen', await noHorizontalScroll(page));
    await fullShot(page, 'handy-11-erstellen-import');
    checkConsole(page, 'Handy Erstellen');

    // Meine Bauten auf dem Handy: Leerzustand, eine Datei hinzufügen, Karte mit Aktionen
    await page.goto(`${server.url}/meine.html`);
    await page.waitFor(MINE_READY, 20000);
    await checkHeader(page, check, 'Handy Meine Bauten', 'mine');
    check('Handy Meine Bauten: Leerzustand, kein waagrechtes Scrollen', await page.eval("window.__minePage.count === 0 && Boolean(document.getElementById('mine-empty-add'))") && await noHorizontalScroll(page));
    await shot(page, 'handy-12-meine-leer');
    await page.setInputFiles('#mine-file', [path.join(IMPORT_DIR, 'house.nbt')]);
    await page.waitFor('window.__minePage.lastAdd', 30000);
    check('Handy Meine Bauten: Datei hinzugefügt, kein waagrechtes Scrollen', await page.eval("window.__minePage.count === 1 && document.querySelectorAll('#mine-list .mine-card [data-action]').length === 4") && await noHorizontalScroll(page),
      JSON.stringify(await page.eval('window.__minePage.lastAdd')));
    await shot(page, 'handy-13-meine-liste');
    checkConsole(page, 'Handy Meine Bauten');
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Ablauf

await mkdir(OUT, { recursive: true });
const server = await startServer({ port: 0 });
const flows = { start: startFlow, bau: buildPagesFlow, erstellen: createFlow, meine: mineFlow, handy: mobileFlow };
const startedAt = Date.now();
try {
  for (const [name, flow] of Object.entries(flows)) {
    if (!OPTIONS.only.includes(name)) continue;
    try {
      await runWithTimeout(name, () => flow(server));
    } catch (error) {
      check(`Ablauf „${name}“ ohne Abbruch`, false, error.message.split('\n')[0]);
    }
  }
} finally {
  await server.close();
}

note(`Leistung (Grafik: ${usedGpu ?? 'unbekannt'})`);
for (const entry of perf) {
  const v = entry.viewer;
  const orbit = entry.orbit ? ` · Drehen: ${entry.orbit.fps.toFixed(0)} Bilder/s, 95 % ≤ ${entry.orbit.p95.toFixed(1)} ms, ${entry.orbit.quads?.toLocaleString('de-CH')} Flächen` : '';
  console.log(`${entry.label}: ${entry.blocks.toLocaleString('de-CH')} Blöcke · ${entry.loadSeconds.toFixed(1)} s bis fertig gezeichnet (Viewer: Laden ${Math.round(v.loadMs)} ms, Bauen ${Math.round(v.buildMs)} ms, Meshing ${Math.round(v.meshMs)} ms)${orbit}`);
}
const failed = results.filter((result) => !result.ok);
await writeFile(path.join(OUT, 'e2e-report.json'), `${JSON.stringify({ when: new Date().toISOString(), gpu: usedGpu, seconds: (Date.now() - startedAt) / 1000, results, perf }, null, 2)}\n`);
console.log(`\n${results.length - failed.length} von ${results.length} Prüfungen OK, ${failed.length} FEHLER · ${((Date.now() - startedAt) / 1000).toFixed(0)} s · Screenshots und Bericht: ${path.relative(ROOT, OUT)}`);
if (failed.length) {
  console.log('Fehlgeschlagen:');
  for (const result of failed) console.log(`  FEHLER ${result.name}${result.detail ? ` – ${result.detail}` : ''}`);
}
// exit statt exitCode: nach einer Zeitgrenze können Anfragen an den abgebrochenen Browser offen bleiben
process.exit(failed.length ? 1 : 0);
