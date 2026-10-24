// Klick- und Sichtprüfung der Bau-Seite (bau.html) im echten Chrome:
//   node tests/visual/build-page-check.mjs [--out tmp/ui-build/shots] [--gpu hardware|swiftshader] [--only <name>]
// Schiebt den Test-Katalog tests/fixtures/ui/catalog.json unter, macht Screenshots (Desktop 1280×900,
// Handy 390×844) in vielen Zuständen, prüft Abläufe (Schritte, Tabs, Abhaken nach Neuladen, Maßstab-Wechsel,
// Fehlerzustände), misst die Bildrate beim Abspielen eines großen Baus und meldet Konsolenfehler.
// Braucht game-data/ (node scripts/extract-game-data.mjs). Exit-Code 1, wenn eine Prüfung fehlschlägt.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOG = path.join(ROOT, 'tests/fixtures/ui/catalog.json');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const OUT = path.resolve(ROOT, option('--out', 'tmp/ui-build/shots'));
const GPU = option('--gpu', 'hardware');
const ONLY = option('--only', null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${name}${detail ? ` – ${detail}` : ''}`);
}

const READY = "window.__buildView && window.__buildView.context && document.querySelector('.bv-player:not(.is-loading)')";

async function openBrowser({ mobile = false } = {}) {
  const size = mobile ? { width: 390, height: 844, mobile: true, deviceScaleFactor: 2 } : { width: 1280, height: 900 };
  let page;
  try {
    page = await launchBrowser({ ...size, gpu: GPU, reducedMotion: false });
    const webgl = await page.eval("Boolean(document.createElement('canvas').getContext('webgl2'))");
    if (!webgl && GPU === 'hardware') throw new Error('kein WebGL2 mit Grafikkarte');
  } catch (error) {
    console.warn(`Grafikkarte nicht nutzbar (${error.message}) – nehme swiftshader.`);
    await page?.close();
    page = await launchBrowser({ ...size, gpu: 'swiftshader', reducedMotion: false });
  }
  await page.route('game-data/catalog.json', { file: CATALOG });
  return page;
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot(file);
  return file;
}

async function waitIdle(page) {
  await page.eval('window.__buildView.viewer.idle()');
  await sleep(250);
}

function takeErrors(page, ignore = []) {
  const list = page.errors.splice(0).filter((text) => !ignore.some((pattern) => pattern.test(text)));
  return list;
}

// ---------------------------------------------------------------- Abläufe

async function desktopFlow(server) {
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/bau.html?id=example-house`);
    await shot(page, 'desktop-01-laden');
    await page.waitFor(READY, 40000);
    await waitIdle(page);
    await shot(page, 'desktop-02-fertig');
    check('Desktop: Bau geladen', await page.eval("document.querySelectorAll('.bv-step').length === 18"), '18 Schritte in der Anleitung');

    // Tastatur: Pos1, dann → (Schritt 1)
    await page.eval('document.activeElement?.blur(); document.body.focus()');
    await page.key('Home');
    await page.key('ArrowRight', 'ArrowRight');
    await page.waitFor('window.__buildView.context.p === 1', 5000);
    await waitIdle(page);
    const label1 = await page.eval("document.querySelector('.bv-player__label').textContent");
    check('Tastatur: Pos1 und → zeigen Schritt 1', /Schritt 1/.test(label1), label1);
    check('Anleitung markiert Schritt 1', await page.eval("document.querySelector('.bv-step.is-current')?.dataset.step === '0'"));
    await shot(page, 'desktop-03-schritt-1');

    // Knopf „weiter“ mehrfach, dann Mitte per Regler
    await page.click('.bv-player__controls .btn--icon:nth-of-type(3)');
    await page.waitFor('window.__buildView.context.p === 2', 5000);
    check('Knopf „Nächster Schritt“', true);
    await page.eval("(() => { const s = document.querySelector('.bv-player__slider'); s.value = '9.5'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await waitIdle(page);
    check('Regler mit Kommazahl', await page.eval('Math.abs(window.__buildView.viewer.progress - 9.5) < 0.01'));
    await page.eval("(() => { const s = document.querySelector('.bv-player__slider'); s.value = '9'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await waitIdle(page);
    await shot(page, 'desktop-04-mitte');

    // Klick auf einen Schritt der Anleitung
    await page.click('.bv-step[data-step="13"]');
    await page.waitFor('window.__buildView.context.p === 14', 6000);
    check('Klick in der Anleitung springt zum Schritt', true);

    // Abspielen und Pause per Leertaste
    await page.eval('document.activeElement?.blur()');
    await page.key(' ', 'Space');
    await sleep(400);
    const playing = await page.eval('window.__buildView.context.player.playing');
    await page.key(' ', 'Space');
    check('Leertaste: Abspielen und Pause', playing && !(await page.eval('window.__buildView.context.player.playing')));

    // Ende
    await page.key('End');
    await waitIdle(page);
    check('Ende zeigt den fertigen Bau', await page.eval('window.__buildView.context.p === 18'));
    await shot(page, 'desktop-05-ende');

    // Schnitt
    await page.click('.bv-tools .bv-tool[aria-controls$="-clip"]');
    await page.eval("(() => { const s = document.querySelector('.bv-clip__slider'); s.value = '3'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await waitIdle(page);
    check('Schnitt bis Ebene 3', await page.eval('window.__buildView.viewer.clip?.maxY === 2'));
    await shot(page, 'desktop-06-schnitt');
    await page.click('.bv-clip .btn--ghost');
    check('Schnitt aus', await page.eval('window.__buildView.viewer.clip === null'));
    await page.click('.bv-tools .bv-tool[aria-controls$="-clip"]');

    // Geist und Ansicht
    await page.click('.bv-tools .bv-tool:nth-child(2)');
    check('Geist an', await page.eval('window.__buildView.viewer.ghost === true'));
    await page.eval("(() => { const s = document.querySelector('.bv-player__slider'); s.value = '6'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await page.click('.bv-view[data-view="front"]');
    await waitIdle(page);
    await shot(page, 'desktop-07-geist-vorne');
    await page.click('.bv-tools .bv-tool:nth-child(2)');
    await page.click('.bv-view[data-view="iso"]');

    // Hover-Tooltip über dem Bau
    const box = await page.eval("(() => { const r = document.querySelector('.bv-stage__canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.62 }; })()");
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await sleep(400);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + 2, y: box.y + 1 });
    await page.waitFor("document.querySelector('.bv-stage .bv-tooltip')", 4000).catch(() => {});
    const tip = await page.eval("document.querySelector('.bv-stage .bv-tooltip')?.textContent ?? ''");
    check('Tooltip beim Zeigen auf einen Block', /minecraft:/.test(tip), tip.slice(0, 80));
    await shot(page, 'desktop-08-tooltip');
    // Klick auf den Block springt zu seinem Schritt
    const hoverStep = await page.eval('window.__buildView.viewer.hover?.step ?? null');
    for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: box.x + 2, y: box.y + 1, button: 'left', clickCount: 1 });
    await sleep(300);
    const afterPick = await page.eval('window.__buildView.context.target');
    check('Klick auf einen Block springt zu seinem Schritt', hoverStep !== null && afterPick === hoverStep + 1, `Schritt ${hoverStep} → Ziel ${afterPick}`);

    // Tabs: Material
    await page.click('[data-tab="materials"]');
    await page.waitFor("document.querySelectorAll('.bv-material .slot__icon[src]').length > 5", 15000);
    await sleep(300);
    await shot(page, 'desktop-09-material');
    const first = await page.eval("document.querySelector('.bv-material').dataset.item");
    await page.click('.bv-materials__list li:nth-child(1) .bv-material');
    await page.click('.bv-materials__list li:nth-child(2) .bv-material');
    const checkedBefore = await page.eval("[...document.querySelectorAll('.bv-material[aria-pressed=\"true\"]')].map((b) => b.dataset.item)");
    check('Material abhaken', checkedBefore.length === 2 && checkedBefore.includes(first), checkedBefore.join(', '));
    await shot(page, 'desktop-10-material-abgehakt');
    // Umfang „Schritt“ und Suche ohne Treffer
    await page.click('.bv-segmented__option:nth-child(3)');
    check('Material für den aktuellen Schritt', await page.eval("/Schritt/.test(document.querySelector('.bv-materials__scope').textContent)"));
    await page.click('.bv-segmented__option:nth-child(1)');
    await page.type('.bv-materials__search', 'xyzgibtsnicht');
    await sleep(200);
    check('Suche ohne Treffer zeigt Leerzustand', await page.eval("/Kein Treffer/.test(document.querySelector('.bv-materials__empty').textContent)"));
    await shot(page, 'desktop-11-kein-treffer');
    await page.eval("(() => { const s = document.querySelector('.bv-materials__search'); s.value = 'eiche'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await sleep(200);
    check('Suche „eiche“ findet Eichenholz', await page.eval("document.querySelectorAll('.bv-material').length > 0 && [...document.querySelectorAll('.bv-material__name')].every((n) => /eiche/i.test(n.textContent))"));

    // Ebenen-Plan
    await page.eval("(() => { const s = document.querySelector('.bv-player__slider'); s.value = '4'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await page.click('[data-tab="layers"]');
    await sleep(800);
    // Tooltip im Plan über einem Block der Mauer
    const planBox = await page.eval("(() => { const v = document.querySelector('.bv-plan__viewport'); v.scrollIntoView({ block: 'center' }); const r = v.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()");
    await sleep(200);
    // Raster über den Plan abtasten, bis der Zeiger auf einem Block liegt (die Lage hängt vom Einpassen ab)
    let planTip = '';
    scan: for (let fy = 0.1; fy < 0.95; fy += 0.08) {
      for (let fx = 0.1; fx < 0.95; fx += 0.08) {
        await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: planBox.x + planBox.w * fx, y: planBox.y + planBox.h * fy });
        await sleep(40);
        planTip = await page.eval("document.querySelector('.bv-tooltip')?.textContent ?? ''");
        if (planTip) break scan;
      }
    }
    check('Ebenen-Plan: Tooltip über einem Block', /minecraft:/.test(planTip), planTip.slice(0, 80));
    await shot(page, 'desktop-12-ebenen-plan');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    // Schritt 4 (Index 3) ist „Wände – Ebene 4“ (y = 3)
    check('Ebenen-Plan folgt dem Schritt', await page.eval("/Ebene 4 von/.test(document.querySelector('.bv-plan__layer').textContent)"), await page.eval("document.querySelector('.bv-plan__layer').textContent"));

    // Infos
    await page.click('[data-tab="info"]');
    await sleep(200);
    await shot(page, 'desktop-13-infos');

    // Abhaken bleibt nach Neuladen
    await page.eval('window.__buildView.context.progress.flush()');
    await page.reload();
    await page.waitFor(READY, 40000);
    await page.click('[data-tab="materials"]');
    const checkedAfter = await page.eval("[...document.querySelectorAll('.bv-material[aria-pressed=\"true\"]')].map((b) => b.dataset.item)");
    check('Abgehakte Materialien bleiben nach dem Neuladen', checkedAfter.length === 2 && checkedAfter.includes(first), checkedAfter.join(', '));
    check('Schritt bleibt nach dem Neuladen', await page.eval('window.__buildView.context.p === 4'), String(await page.eval('window.__buildView.context.p')));

    // Fortschritt zurücksetzen (mit Rückfrage)
    await page.click('[data-tab="info"]');
    await page.click('.bv-progress .btn--secondary');
    await shot(page, 'desktop-14-zuruecksetzen-frage');
    await page.click('.bv-progress__confirm');
    await sleep(200);
    check('Fortschritt zurückgesetzt', await page.eval("localStorage.getItem('bk:progress:example-house') === null && window.__buildView.context.p === 18"));

    // Lauf-Modus an und per Knopf aus
    await page.click('.bv-walk-toggle');
    await sleep(500);
    check('Laufen an', await page.eval("window.__buildView.viewer.mode === 'walk' && document.querySelector('.bv-stage').classList.contains('is-walking')"));
    await shot(page, 'desktop-15-laufen');
    await page.click('.bv-walk-toggle');
    check('Laufen aus', await page.eval("window.__buildView.viewer.mode === 'orbit'"));

    const errors = takeErrors(page);
    check('Desktop: keine Konsolenfehler', errors.length === 0, errors.join(' | '));
  } finally {
    await page.close();
  }
}

async function mobileFlow(server) {
  const page = await openBrowser({ mobile: true });
  try {
    await page.goto(`${server.url}/bau.html?id=spiel-plains-small-house-1`);
    await shot(page, 'handy-01-laden');
    await page.waitFor(READY, 40000);
    await waitIdle(page);
    await shot(page, 'handy-02-fertig');
    check('Handy: Original-Struktur geladen', await page.eval("document.querySelectorAll('.bv-step').length === 7"));
    await page.click('.bv-player__controls .btn--icon:nth-of-type(1)');
    await page.eval('window.scrollTo(0, 0)');
    await page.eval("(() => { const s = document.querySelector('.bv-player__slider'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await page.click('.bv-player__controls .btn--icon:nth-of-type(3)');
    await waitIdle(page);
    await page.eval("document.querySelector('.bv-player').scrollIntoView({ block: 'start' })");
    await sleep(200);
    await shot(page, 'handy-03-schritt-1-player');
    await page.click('[data-tab="materials"]');
    await page.waitFor("document.querySelectorAll('.bv-material .slot__icon[src]').length > 3", 15000);
    await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await sleep(200);
    await shot(page, 'handy-04-material');
    await page.click('[data-tab="layers"]');
    await sleep(600);
    await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await sleep(200);
    await shot(page, 'handy-05-ebenen');
    await page.click('[data-tab="info"]');
    await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await sleep(200);
    await shot(page, 'handy-06-infos');
    await page.eval('window.scrollTo(0, 0)');
    await page.click('.bv-tools .bv-tool[aria-controls$="-help"]');
    await sleep(200);
    await shot(page, 'handy-07-steuerung');
    const overflow = await page.eval('document.documentElement.scrollWidth > window.innerWidth + 1');
    check('Handy: kein waagrechtes Scrollen', !overflow);
    const errors = takeErrors(page);
    check('Handy: keine Konsolenfehler', errors.length === 0, errors.join(' | '));
  } finally {
    await page.close();
  }
}

async function errorFlow(server) {
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/bau.html?id=gibt-es-nicht`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Unbekannte ID: Fehlerzustand mit Link', await page.eval("/Bau nicht gefunden/.test(document.querySelector('#build-status').textContent) && Boolean(document.querySelector('#build-status a[href*=\"kategorie.html\"]'))"));
    await shot(page, 'fehler-01-unbekannte-id');
    await page.goto(`${server.url}/bau.html?id=big-plaza&scale=0.3`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Unbekannter Maßstab: Fehler mit Maßstab-Links', await page.eval("document.querySelectorAll('#build-status a[href*=\"scale=\"]').length === 2"));
    await shot(page, 'fehler-02-massstab');
    await page.goto(`${server.url}/bau.html?id=x%3Cscript%3E`);
    await page.waitFor("document.querySelector('#build-status .state--error')", 15000);
    check('Ungültige ID: Fehlerzustand', await page.eval("/Ungültige Adresse/.test(document.querySelector('#build-status').textContent)"));
    // Struktur fehlt in game-data → „Spieldaten fehlen“ mit Befehl
    await page.unroute('game-data/catalog.json');
    const broken = JSON.stringify({ version: '26.2', builds: [{ id: 'spiel-fehlt', title: 'Fehlt', category: 'haeuser', accuracy: 'original', structure: 'gibt_es_nicht.json', module: null, size: [3, 3, 3], blocks: 1, steps: 1 }] });
    await page.route('game-data/catalog.json', { body: broken, contentType: 'application/json' });
    await page.goto(`${server.url}/bau.html?id=spiel-fehlt`);
    await page.waitFor("document.querySelector('.bv-stage.is-error')", 30000);
    check('Fehlende Spieldaten: Anleitung mit Befehl', await page.eval("/extract-game-data/.test(document.querySelector('.bv-stage__status').textContent)"));
    await shot(page, 'fehler-03-spieldaten');
    takeErrors(page);
    await page.unroute('game-data/catalog.json');
    await page.route('game-data/catalog.json', { file: CATALOG });
    // Kein WebGL2
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : original.call(this, type, ...rest); }; })();" });
    await page.goto(`${server.url}/bau.html?id=example-house`);
    await page.waitFor("document.querySelector('.bv-stage.is-error')", 15000);
    check('Kein WebGL2: verständlicher Fehler', await page.eval("/WebGL2/.test(document.querySelector('.bv-stage__status').textContent)"));
    await shot(page, 'fehler-04-kein-webgl');
    takeErrors(page);
  } finally {
    await page.close();
  }
}

async function bigFlow(server) {
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/bau.html?id=big-plaza`);
    await sleep(300);
    await shot(page, 'gross-01-laden');
    await page.waitFor(READY, 60000);
    await waitIdle(page);
    await shot(page, 'gross-02-fertig');
    // Bildrate beim Abspielen (4×) über 6 s
    await page.eval("(() => { const s = document.querySelector('.bv-player__slider'); s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await waitIdle(page);
    // Tempo 1× → 2× → 4×
    await page.click('.bv-player__speed');
    await page.click('.bv-player__speed');
    check('Tempo 4×', await page.eval("document.querySelector('.bv-player__speed').textContent === '4×'"));
    const fps = await page.eval(`new Promise((resolve) => {
      const view = window.__buildView;
      view.context.player.play();
      const frames = [];
      let last = performance.now();
      const start = last;
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        if (now - start < 6000 && view.context.player.playing) requestAnimationFrame(tick);
        else {
          view.context.player.pause();
          const sorted = [...frames].sort((a, b) => a - b);
          resolve({ frames: frames.length, seconds: (now - start) / 1000, fps: frames.length / ((now - start) / 1000), p95: sorted[Math.floor(sorted.length * 0.95)], viewerFps: view.viewer.stats.fps, progress: view.context.p });
        }
      };
      requestAnimationFrame(tick);
    })`);
    check('Großer Bau: Bildrate beim Abspielen', fps.fps >= 30, `${fps.fps.toFixed(1)} FPS (rAF), 95 % ≤ ${fps.p95.toFixed(1)} ms, Viewer ${fps.viewerFps} Bilder/s, Fortschritt ${fps.progress.toFixed(2)}`);
    await shot(page, 'gross-03-abspielen');
    // Ebenen-Plan 150 × 150
    await page.click('[data-tab="layers"]');
    await page.eval("(() => { const s = document.querySelector('.bv-plan__slider'); s.value = '3'; s.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await sleep(1500);
    const plan = await page.eval(`new Promise((resolve) => {
      const viewport = document.querySelector('.bv-plan__viewport');
      const box = viewport.getBoundingClientRect();
      const times = [];
      let n = 0;
      let last = performance.now();
      const step = (now) => {
        times.push(now - last);
        last = now;
        viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: n < 30 ? -40 : 40, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, bubbles: true, cancelable: true }));
        n++;
        if (n < 60) requestAnimationFrame(step);
        else {
          const sorted = times.slice(2).sort((a, b) => a - b);
          resolve({ median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * 0.95)] });
        }
      };
      requestAnimationFrame(step);
    })`);
    check('Ebenen-Plan 150 × 150: Zoomen flüssig', plan.p95 < 34, `Bildzeit Median ${plan.median.toFixed(1)} ms, 95 % ${plan.p95.toFixed(1)} ms`);
    await shot(page, 'gross-04-plan-150');
    // Maßstab wechseln
    await page.click('[data-tab="info"]');
    await page.click('.bv-scale__option:nth-child(2)');
    await page.waitFor("location.search.includes('scale=0.5') && window.__buildView.context && window.__buildView.context.scale === 0.5", 60000);
    await waitIdle(page);
    check('Maßstab-Wechsel lädt 1:2', await page.eval('window.__buildView.result.size[0] === 75'), await page.eval("location.search"));
    await shot(page, 'gross-05-massstab-halb');
    const errors = takeErrors(page);
    check('Großer Bau: keine Konsolenfehler', errors.length === 0, errors.join(' | '));
  } finally {
    await page.close();
  }
}

async function infoFlow(server) {
  const page = await openBrowser({ mobile: true });
  try {
    await page.goto(`${server.url}/bau.html?id=beispiel-ungetestet`);
    await page.waitFor(READY, 40000);
    check('Ungetestet: Chip im Kopf', await page.eval("/Nicht im Spiel getestet/.test(document.querySelector('#build-chips').textContent)"));
    await page.click('[data-tab="info"]');
    await page.eval("document.querySelector('.bv-panels').scrollIntoView({ block: 'start' })");
    await sleep(200);
    await shot(page, 'handy-08-infos-quellen');
    const links = await page.eval("[...document.querySelectorAll('.bv-info a[href]')].map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel'), target: a.getAttribute('target') }))");
    check('Quellen und Credits: nur https mit rel="noopener noreferrer"', links.length === 2 && links.every((l) => l.href.startsWith('https://') && l.rel === 'noopener noreferrer' && l.target === '_blank'), JSON.stringify(links));
    check('Credits mit Lizenz', await page.eval("/Testautor/.test(document.querySelector('.bv-info').textContent) && /CC BY-NC-SA 3\\.0/.test(document.querySelector('.bv-info').textContent)"));
    const errors = takeErrors(page);
    check('Infos: keine Konsolenfehler', errors.length === 0, errors.join(' | '));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Start

await mkdir(OUT, { recursive: true });
const server = await startServer({ port: 0 });
const flows = { desktop: desktopFlow, handy: mobileFlow, infos: infoFlow, fehler: errorFlow, gross: bigFlow };
try {
  for (const [name, flow] of Object.entries(flows)) {
    if (ONLY && ONLY !== name) continue;
    try {
      await flow(server);
    } catch (error) {
      check(`Ablauf „${name}“ ohne Abbruch`, false, error.message);
    }
  }
} finally {
  await server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} von ${results.length} Prüfungen bestanden. Screenshots: ${OUT}`);
process.exitCode = failed.length ? 1 : 0;
