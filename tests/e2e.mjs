// Klick-Test der ganzen Seite im echten Chrome gegen den echten Katalog (data/catalog.json):
//   node tests/e2e.mjs [--gpu hardware|swiftshader] [--out tmp/integration/e2e] [--only start,bau,erstellen,handy]
// Start → Kategorie (Filter, Sortierung, Zurück) → Bau-Seiten (Tokyo Skytree 1:1, Infinity Castle, ein Dorfhaus aus dem
// Spiel, ein Redstone-Bau: Schritte, Abspielen, Tabs, Abhaken + Neuladen, Ebenen-Plan, Schnitt, Laufen, Maßstab) →
// „Selber erstellen“ (Freitext, Upload je Fixture-Format) → Handy 390 × 844. Screenshots nach --out, Leistungswerte
// (Ladezeit, Bildrate beim Drehen) am Ende. Konsolenfehler zählen als Fehler. Exit-Code 1, wenn eine Prüfung fehlschlägt,
// 2 bei falschen Optionen oder fehlenden Spieldaten.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../scripts/serve.mjs';
import { launchBrowser } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = path.join(ROOT, 'data', 'catalog.json');
const IMPORT_DIR = path.join(ROOT, 'tests/fixtures/create/import');
const MODEL_DIR = path.join(ROOT, 'tests/fixtures/create/voxelize');
const FLOW_NAMES = ['start', 'bau', 'erstellen', 'handy'];
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
// Der Klick-Test prüft die lokale Seite mit Spieldaten und Vorschaubildern (der Katalog allein liegt im Repo)
const NEEDED = [['game-data/meta.json', 'node scripts/extract-game-data.mjs'], ['thumbs/index.json', 'node scripts/make-thumbs.mjs']];
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

async function startFlow(server) {
  note('Start und Kategorie (Desktop 1280 × 900)');
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/index.html`);
    await page.waitFor("document.querySelectorAll('#home-sections .build-card').length > 0", 20000);
    const total = await page.eval("document.getElementById('home-total').textContent");
    check('Start: Gesamtzahl der Bauten', total.replace(/[.'’\s]/g, '').includes(String(catalog.counts.total)), total.trim().slice(0, 120));
    const tileCounts = await page.eval("Object.fromEntries([...document.querySelectorAll('#home-categories .category-tile')].map((t) => [t.dataset.category, t.querySelector('.category-tile__count').textContent.replace(/\\D/g, '')]))");
    const wrongTiles = Object.entries(catalog.counts.byCategory).filter(([slug, n]) => tileCounts[slug] !== String(n));
    check('Start: Anzahl je Kategorie-Kachel', wrongTiles.length === 0, wrongTiles.map(([slug, n]) => `${slug} ${tileCounts[slug]} statt ${n}`).join(', ') || '8 Kacheln');
    const brokenImages = await loadLazyImages(page);
    const thumbCount = await page.eval("document.querySelectorAll('#home-sections img.build-card__img').length");
    check('Start: alle Vorschaubilder geladen', brokenImages === 0 && thumbCount > 0, `${thumbCount} Vorschaubilder, ${brokenImages} kaputt`);
    await fullShot(page, 'desktop-01-start');
    checkConsole(page, 'Start');

    // Kategorie über die Kachel öffnen
    await page.click('#home-categories .category-tile[data-category="haeuser"]');
    await page.waitFor("location.pathname.endsWith('/kategorie.html') && document.querySelectorAll('#category-list .build-card').length > 0", 20000);
    const houses = expectedCategory('haeuser');
    const countText = await page.eval("document.getElementById('category-result-count').textContent");
    check('Kategorie Häuser: Trefferzahl', countText.replace(/\D/g, '').startsWith(String(houses.length)), countText.trim());
    await fullShot(page, 'desktop-02-kategorie', { lazy: false });

    // Filter Herkunft „Original aus dem Spiel“
    const filterVisible = await page.eval("(() => { const box = document.querySelector('#category-filters input[name=\"herkunft\"][value=\"original\"]'); const label = box && box.closest('label'); return Boolean(label && label.getBoundingClientRect().width > 0); })()");
    if (!filterVisible) await page.click('#category-filter-toggle');
    await page.click('#category-filters label.filter-option:has(input[name="herkunft"][value="original"])');
    await page.waitFor("location.search.includes('herkunft=original')", 5000);
    const originals = houses.filter((build) => build.accuracy === 'original');
    const filtered = await page.eval("document.getElementById('category-result-count').textContent");
    check('Filter „Original aus dem Spiel“', filtered.replace(/\D/g, '').startsWith(String(originals.length)), filtered.trim());

    // Sortierung „Blöcke: viele zuerst“
    await page.eval("(() => { const s = document.getElementById('category-sort'); s.value = 'bloecke-ab'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await page.waitFor("location.search.includes('sort=bloecke-ab')", 5000);
    const maxBlocks = Math.max(...originals.map((build) => build.blocks));
    const firstTitle = await page.eval("document.querySelector('#category-list .build-card__link').textContent");
    const firstOk = originals.some((build) => build.title === firstTitle && build.blocks === maxBlocks);
    check('Sortierung „Blöcke: viele zuerst“', firstOk, `erste Karte: ${firstTitle}`);
    await fullShot(page, 'desktop-03-kategorie-filter-sortiert', { lazy: false });

    // Zurück-Taste: erst Sortierung, dann Filter weg
    await page.eval('history.back()');
    await page.waitFor("!location.search.includes('sort=') && location.search.includes('herkunft=original')", 5000);
    check('Zurück: Sortierung zurückgenommen', await page.eval("document.getElementById('category-sort').value === 'name'"));
    await page.eval('history.back()');
    await page.waitFor("!location.search.includes('herkunft=')", 5000);
    const backCount = await page.eval("document.getElementById('category-result-count').textContent");
    check('Zurück: Filter zurückgenommen', backCount.replace(/\D/g, '').startsWith(String(houses.length)) && !(await page.eval("document.querySelector('#category-filters input[value=\"original\"]').checked")), backCount.trim());

    // Karte öffnet die Bau-Seite
    const href = await page.eval("document.querySelector('#category-list .build-card__link').getAttribute('href')");
    await page.click('#category-list .build-card__link');
    await page.waitFor(`location.pathname.endsWith('/bau.html') && ${BUILD_READY}`, 60000);
    check('Karte öffnet die Bau-Seite', true, href);
    checkConsole(page, 'Kategorie');

    // Übersicht aller Kategorien und unbekannte Kategorie
    await page.goto(`${server.url}/kategorie.html`);
    await page.waitFor("document.querySelectorAll('#category-overview-list .category-tile').length === 8", 10000);
    check('Übersicht aller Kategorien', true);
    await fullShot(page, 'desktop-04-kategorien');
    await page.goto(`${server.url}/kategorie.html?k=gibtsnicht`);
    await page.waitFor("document.querySelector('#category-status .state--error')", 10000);
    check('Unbekannte Kategorie: Fehlerhinweis', true);
    checkConsole(page, 'Übersicht');
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Bau-Seiten

const DORFHAUS_ID = catalog.builds.find((build) => build.structure === 'village__plains__houses__plains_small_house_1.json')?.id
  ?? catalog.builds.find((build) => build.category === 'haeuser' && build.id.startsWith('spiel-'))?.id;
const REDSTONE_ID = byId.has('lauflicht') ? 'lauflicht' : catalog.builds.find((build) => build.category === 'redstone')?.id;

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
    await buildFlow(page, server, { id: DORFHAUS_ID, label: `Dorfhaus ${DORFHAUS_ID}` });
    await buildFlow(page, server, { id: REDSTONE_ID, label: `Redstone ${REDSTONE_ID}` });
    const untested = byId.get(REDSTONE_ID)?.tested === false;
    if (untested) {
      await page.goto(`${server.url}/bau.html?id=${REDSTONE_ID}`);
      await page.waitFor(BUILD_READY, 60000);
      check('Redstone: Chip „Nicht im Spiel getestet“', await page.eval("/Nicht im Spiel getestet/.test(document.getElementById('build-chips').textContent)"));
    }
    await page.goto(`${server.url}/bau.html?id=gibt-es-nicht`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Unbekannte Bau-ID: Fehlerzustand', true);
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

// ---------------------------------------------------------------- Handy

async function mobileFlow(server) {
  note('Handy 390 × 844');
  const page = await openBrowser({ mobile: true });
  try {
    await page.goto(`${server.url}/index.html`);
    await page.waitFor("document.querySelectorAll('#home-sections .build-card').length > 0", 20000);
    check('Handy Start: kein waagrechtes Scrollen', await noHorizontalScroll(page));
    await fullShot(page, 'handy-01-start');

    await page.goto(`${server.url}/kategorie.html?k=redstone`);
    await page.waitFor("document.querySelectorAll('#category-list .build-card').length > 0", 20000);
    check('Handy Kategorie: kein waagrechtes Scrollen', await noHorizontalScroll(page));
    await fullShot(page, 'handy-02-kategorie', { lazy: false });
    await page.click('#category-filter-toggle');
    await sleep(300);
    check('Handy: Filter klappen auf', await page.eval("document.getElementById('category-filter-toggle').getAttribute('aria-expanded') === 'true'"));
    await shot(page, 'handy-03-filter');
    await page.click('#category-filters label.filter-option:has(input[name="schwierigkeit"])');
    await page.waitFor("location.search.includes('schwierigkeit=')", 5000);
    await page.click('#category-filters-done');
    await sleep(300);
    check('Handy: Filter wirkt, „Bauten anzeigen“ klappt zu', await page.eval("document.getElementById('category-filter-toggle').getAttribute('aria-expanded') === 'false'"));

    await page.goto(`${server.url}/bau.html?id=${DORFHAUS_ID}`);
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
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Ablauf

await mkdir(OUT, { recursive: true });
const server = await startServer({ port: 0 });
const flows = { start: startFlow, bau: buildPagesFlow, erstellen: createFlow, handy: mobileFlow };
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
