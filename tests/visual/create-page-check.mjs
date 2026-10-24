// Klick- und Sichtprüfung von „Selber erstellen“ (erstellen.html) im echten Chrome:
//   node tests/visual/create-page-check.mjs [--out tmp/ui-create/shots] [--gpu hardware|swiftshader] [--only idee|formen|import|handy|zustaende]
//   [--catalog <datei>]
// Prüft Freitext (Bau mit Maßstab, Fantasy-Bau, Form, ehrlich nicht vorhanden), Formen-Generator (Form wechseln, Zahl,
// Block-Suche per Tastatur, Vorschau, Link), Datei-Import mit den Fixtures aus tests/fixtures/create/** (Erfolg, Fehler,
// 3D-Modelle mit Einstellungen) und die Handy-Ansicht. Screenshots als ganze Seite. Konsolenfehler zählen als Fehler.
// Braucht game-data/ inkl. catalog.json (ohne --catalog der echte Katalog). Exit-Code 1, wenn eine Prüfung fehlschlägt.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMPORT_DIR = path.join(ROOT, 'tests/fixtures/create/import');
const MODEL_DIR = path.join(ROOT, 'tests/fixtures/create/voxelize');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const OUT = path.resolve(ROOT, option('--out', 'tmp/ui-create/shots'));
const GPU = option('--gpu', 'hardware');
const ONLY = option('--only', null);
const CATALOG = option('--catalog', null);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK  ' : 'FEHL'} ${name}${detail ? ` – ${detail}` : ''}`);
}

const READY = 'window.__createPage && window.__createPage.ready';
const viewReady = (slot, host) => `window.__createPage.views.${slot} && window.__createPage.views.${slot}.context && document.querySelector('#${host} .bv-player:not(.is-loading)')`;

async function openBrowser({ mobile = false } = {}) {
  const size = mobile ? { width: 390, height: 844, mobile: true, deviceScaleFactor: 2 } : { width: 1280, height: 900 };
  let page;
  try {
    page = await launchBrowser({ ...size, gpu: GPU, reducedMotion: true });
    const webgl = await page.eval("Boolean(document.createElement('canvas').getContext('webgl2'))");
    if (!webgl && GPU === 'hardware') throw new Error('kein WebGL2 mit Grafikkarte');
  } catch (error) {
    console.warn(`Grafikkarte nicht nutzbar (${error.message}) – nehme swiftshader.`);
    await page?.close();
    page = await launchBrowser({ ...size, gpu: 'swiftshader', reducedMotion: true });
  }
  if (CATALOG) await page.route('game-data/catalog.json', { file: path.resolve(ROOT, CATALOG) });
  return page;
}

// Ganze Seite (nicht nur das Fenster) als PNG
async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  // Oben anfangen, sonst zeichnet Chrome den stehenden Kopf mitten ins Bild
  await page.eval('window.scrollTo(0, 0)');
  await sleep(120);
  const metrics = await page.send('Page.getLayoutMetrics');
  const { width, height } = metrics.cssContentSize ?? metrics.contentSize;
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(width), height: Math.min(Math.ceil(height), 9000), scale: 1 },
  });
  await writeFile(file, Buffer.from(data, 'base64'));
  return file;
}

async function viewShot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot(file);
  return file;
}

// ignore: Muster für erwartete Meldungen (renderer.js loggt jede Ablehnung des Workers mit console.error,
// auch bei absichtlich kaputten Testdateien)
function takeErrors(page, ignore = []) {
  return page.errors.splice(0).filter((text) => !ignore.some((pattern) => pattern.test(text)));
}

const EXPECTED_IMPORT_ERRORS = [/^3D-Worker \(load\): Die Datei ist beschädigt oder unvollständig/, /^3D-Worker \(load\): Das ist eine alte MCEdit-Schematic/];

async function ask(page, text) {
  await page.eval(`(() => { const i = document.getElementById('create-query'); i.value = ${JSON.stringify(text)}; })()`);
  await page.click('#create-form button[type="submit"]');
  await page.waitFor(`window.__createPage.request && window.__createPage.request.query === ${JSON.stringify(text.replace(/\s+/g, ' ').trim())}`, 5000);
  await sleep(150);
  return page.eval('window.__createPage.request.kind');
}

const resultLinks = (page) => page.eval("[...document.querySelectorAll('#create-results-body a[href]')].map((a) => a.getAttribute('href'))");

// ---------------------------------------------------------------- Freitext

async function ideaFlow(server) {
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/erstellen.html`);
    await page.waitFor(READY, 30000);
    check('Seite lädt (Katalog, Namen, Blöcke)', await page.eval('window.__createPage.error === null'), await page.eval('String(window.__createPage.error)'));
    check('Beispiel-Chips sichtbar', await page.eval("!document.getElementById('create-examples').hidden && document.querySelectorAll('.create-example').length >= 3"));
    await shot(page, 'desktop-01-start');

    // Jedes Beispiel führt zu einem echten Bau oder einer baubaren Form
    const exampleCount = await page.eval("document.querySelectorAll('.create-example').length");
    const badExamples = [];
    for (let i = 0; i < exampleCount; i++) {
      await page.click(`#create-examples-list li:nth-child(${i + 1}) .create-example`);
      await sleep(120);
      const r = await page.eval('(() => { const r = window.__createPage.request; return { q: r.query, kind: r.kind, ok: r.kind === "build" ? r.matches.length > 0 : r.kind === "shape" && r.ok }; })()');
      if (!r.ok) badExamples.push(`${r.q} → ${r.kind}`);
    }
    check('Alle Beispiel-Chips führen zu Bau oder baubarer Form', badExamples.length === 0, badExamples.join(' | ') || `${exampleCount} Beispiele`);

    const skytree = await ask(page, 'Tokio Skytree Originalgrösse 1:1 (1 Block = 1 m)');
    const skyLinks = await resultLinks(page);
    const skyId = await page.eval('window.__createPage.request.matches?.[0]?.entry.id ?? null');
    check('„Tokio Skytree … 1:1“ → Bau', skytree === 'build', `${skytree}, ${skyId}`);
    if (skyId === 'tokyo-skytree') {
      check('Skytree mit Maßstab 1 verlinkt', skyLinks.some((href) => /bau\.html\?id=tokyo-skytree&scale=1$/.test(href)), skyLinks.join(' '));
      check('Eindeutig: großer Knopf „Anleitung öffnen“', await page.eval("[...document.querySelectorAll('.create-feature .btn--primary')].some((b) => b.textContent.includes('Anleitung öffnen'))"));
      check('Maßstab-Chip erkannt', await page.eval("document.querySelector('#create-results-body').textContent.includes('Maßstab erkannt: 1:1')"));
    } else {
      check('Skytree im Katalog', false, 'tokyo-skytree fehlt im Katalog – mit --catalog prüfen');
    }
    check('Adresse enthält ?q=', await page.eval("location.search.startsWith('?q=Tokio')"));
    await shot(page, 'desktop-02-skytree');

    const castle = await ask(page, 'Infinity Castle');
    const castleLinks = await resultLinks(page);
    check('„Infinity Castle“ → Bau', castle === 'build' && castleLinks.some((href) => /bau\.html\?id=infinity-castle$/.test(href)), castleLinks.slice(0, 3).join(' '));
    await shot(page, 'desktop-03-infinity');

    const sphere = await ask(page, 'hohle Kugel Radius 12 aus Glas');
    const sphereReq = await page.eval('window.__createPage.request');
    check('„hohle Kugel Radius 12 aus Glas“ → Form', sphere === 'shape' && sphereReq.shape === 'sphere' && sphereReq.params.diameter === 25 && sphereReq.params.block === 'glass' && sphereReq.params.hollow === true,
      JSON.stringify(sphereReq.params));
    check('„So verstanden“ mit Link auf bau.html?form=', (await resultLinks(page)).some((href) => href.includes('bau.html?form=sphere&diameter=25&block=glass&hollow=1')));
    check('Formular vorbefüllt', await page.eval("window.__createPage.shape?.shape === 'sphere' && window.__createPage.shape.params?.diameter === 25"));
    await shot(page, 'desktop-04-kugel');

    const burj = await ask(page, 'Burj Khalifa');
    const burjLinks = await resultLinks(page);
    check('„Burj Khalifa“ → ehrlich nicht vorhanden', burj === 'none' && !burjLinks.some((href) => href.includes('bau.html')), burjLinks.join(' '));
    check('Hinweise auf Formen und Import', await page.eval("document.querySelectorAll('.create-none__hints button').length === 2"));
    await shot(page, 'desktop-05-burj');

    // Mehrdeutig: „Turm“ zeigt mehrere Treffer und die Form als Alternative, öffnet nichts automatisch
    const tower = await ask(page, 'Turm');
    check('„Turm“ → mehrere Treffer + Form als Alternative', tower === 'build' && await page.eval("document.querySelectorAll('.create-matches .build-card').length > 1 && !!document.querySelector('.create-alt')"));
    await shot(page, 'desktop-06-turm');

    // HTML in der Anfrage wird nur als Text gezeigt
    await ask(page, '<img src=x onerror=alert(1)>Burg');
    check('HTML in der Anfrage bleibt Text', await page.eval("!document.querySelector('#create-results-body img[src=\"x\"]') && !document.querySelector('#create-results-body [onerror]')"));

    // Adresse ?q= (wie von der Kopf-Suche) und Vorschau aus dem Ergebnis
    await page.goto(`${server.url}/erstellen.html?q=${encodeURIComponent('hohle Kugel Radius 12 aus Glas')}`);
    await page.waitFor(READY, 30000);
    check('?q= wird gelesen', await page.eval("window.__createPage.request?.kind === 'shape'"));
    await page.click('.create-understood .btn--primary');
    await page.waitFor(viewReady('shape', 'shape-preview'), 60000);
    await page.eval('window.__createPage.views.shape.viewer.idle()');
    check('Vorschau aus dem Freitext: Reiter Formen, Ansicht geladen', await page.eval("document.getElementById('create-tab-formen').getAttribute('aria-selected') === 'true' && location.hash === '#formen'"));
    check('Vorschau: Kugel mit Kapiteln', await page.eval("window.__createPage.views.shape.result.phases.length >= 2"), await page.eval("window.__createPage.views.shape.result.phases.map((p) => p.title).join(' | ')"));
    await viewShot(page, 'desktop-07-kugel-vorschau');
    const errors = takeErrors(page);
    check('Freitext: keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Formen-Generator

async function shapeFlow(server) {
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/erstellen.html#formen`);
    await page.waitFor(READY, 30000);
    await page.eval("localStorage.removeItem('bk:create:shape')");
    await page.reload();
    await page.waitFor(READY, 30000);
    check('Anker #formen öffnet den Reiter', await page.eval("!document.getElementById('create-panel-formen').hidden"));
    check('Standardform Kugel gültig', await page.eval("window.__createPage.shape?.shape === 'sphere' && window.__createPage.shape.ok"));
    await shot(page, 'desktop-10-formen');

    // Turm wählen, Durchmesser tippen, Zinnen und Kegeldach
    await page.click('.shape-option:has(input[value="cylinder"])');
    check('Form wechseln: Turm', await page.eval("window.__createPage.shape.shape === 'cylinder'"));
    await page.type('#shape-diameter', '13');
    await page.click('#shape-battlements');
    await page.click('#shape-roof .bv-segmented__option:nth-child(3)');
    const tower = await page.eval('window.__createPage.shape');
    check('Zahl, Kästchen und Umschalter wirken', tower.ok && tower.params.diameter === 13 && tower.params.battlements === true && tower.params.roof === 'cone', JSON.stringify(tower.params));
    check('Abhängiges Feld „Dach-Block“ erscheint', await page.eval("!document.getElementById('shape-roofBlock').closest('.create-field').hidden"));

    // Block-Suche per Tastatur
    await page.click('#shape-block');
    await page.send('Input.insertText', { text: 'Sandstein' });
    await sleep(200);
    const options = await page.eval("[...document.querySelectorAll('#shape-block-list [role=option]')].map((o) => o.dataset.block).slice(0, 5)");
    await page.key('ArrowDown', 'ArrowDown');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(150);
    const block = await page.eval('window.__createPage.shape.params?.block');
    check('Block-Suche „Sandstein“ + Pfeil + Enter', options.includes('sandstone') && /sandstone/.test(block ?? ''), `${options.join(', ')} → ${block}`);
    await sleep(600);
    check('Block-Icons geladen', await page.eval("!!document.querySelector('.block-picker__field .block-picker__icon:not([hidden])')"));
    const href = await page.eval("document.getElementById('shape-open-link').getAttribute('href')");
    check('Link „Als Anleitung öffnen“', /\/bau\.html\?form=cylinder&diameter=13&/.test(href ?? ''), href);

    // Ungültiger Wert: Fehler am Feld, kein Link
    await page.type('#shape-diameter', '999');
    check('Ungültige Zahl: Fehler am Feld, Link gesperrt', await page.eval("!document.getElementById('shape-diameter-error').hidden && document.getElementById('shape-open-link').getAttribute('aria-disabled') === 'true' && document.getElementById('shape-preview-button').disabled"));
    await shot(page, 'desktop-11-formen-fehler');
    await page.type('#shape-diameter', '13');

    await page.click('#shape-preview-button');
    await page.waitFor(viewReady('shape', 'shape-preview'), 60000);
    await page.eval('window.__createPage.views.shape.viewer.idle()');
    const titles = await page.eval('window.__createPage.views.shape.result.phases.map((p) => p.title)');
    check('Vorschau Turm mit Zinnen und Kegeldach', titles.some((t) => /Zinnen/.test(t)) && titles.some((t) => /Kegeldach/.test(t)), titles.join(' | '));
    await shot(page, 'desktop-12-turm-vorschau');

    // Änderung → Vorschau baut sich nach kurzer Pause neu
    const before = await page.eval('window.__createPage.views.shape.result.blockCount');
    await page.type('#shape-height', '30');
    await page.waitFor(`window.__createPage.views.shape && window.__createPage.views.shape.result && window.__createPage.views.shape.result.blockCount !== ${before}`, 30000);
    check('Vorschau aktualisiert sich nach Änderung', true);

    // Gespeicherte Form nach Neuladen
    await page.reload();
    await page.waitFor(READY, 30000);
    check('Letzte Form bleibt nach Neuladen', await page.eval("window.__createPage.shape.shape === 'cylinder' && window.__createPage.shape.params.height === 30"));
    const errors = takeErrors(page);
    check('Formen: keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Import

async function importOnce(page, files) {
  const before = await page.eval('window.__createPage.imports');
  await page.setInputFiles('#import-file', files);
  return before;
}

async function waitImport(page, before, timeout = 60000) {
  await page.waitFor(`window.__createPage.imports > ${before}`, timeout);
  return page.eval('window.__createPage.lastImport');
}

async function importFlow(server) {
  const page = await openBrowser();
  try {
    await page.goto(`${server.url}/erstellen.html#import`);
    await page.waitFor(READY, 30000);
    check('Datei-Feld mit accept', await page.eval("document.getElementById('import-file').accept.includes('.litematic') && document.getElementById('import-file').accept.includes('.mtl')"));
    await shot(page, 'desktop-20-import');

    let before = await importOnce(page, [path.join(IMPORT_DIR, 'house-v2.schem')]);
    let outcome = await waitImport(page, before);
    check('house-v2.schem geladen', outcome.ok && outcome.blockCount > 0, JSON.stringify({ ok: outcome.ok, blocks: outcome.blockCount, error: outcome.error }));
    await page.waitFor(viewReady('import', 'import-result'), 30000);
    await page.eval('window.__createPage.views.import.viewer.idle()');
    check('Bericht sichtbar', await page.eval("!document.getElementById('import-report').hidden && document.querySelectorAll('#import-report .facts > div').length >= 3"));
    await shot(page, 'desktop-21-import-schem');

    before = await importOnce(page, [path.join(IMPORT_DIR, 'regions.litematic')]);
    outcome = await waitImport(page, before);
    check('regions.litematic: Regionen als Kapitel', outcome.ok && await page.eval("window.__createPage.views.import?.result.phases.some((p) => p.title.startsWith('Region'))"));

    before = await importOnce(page, [path.join(IMPORT_DIR, 'future-v2.schem')]);
    outcome = await waitImport(page, before);
    check('future-v2.schem: Warnungen werden gezeigt', outcome.ok && outcome.warnings.length > 0 && await page.eval("document.querySelectorAll('.import-report__warnings li').length > 0"), outcome.warnings.slice(0, 2).join(' | '));
    await shot(page, 'desktop-22-import-warnungen');

    before = await importOnce(page, [path.join(IMPORT_DIR, 'truncated.schem')]);
    outcome = await waitImport(page, before);
    check('truncated.schem: verständlicher Fehler', !outcome.ok && /beschädigt|unvollständig/.test(outcome.error), outcome.error);
    check('Nach Fehler keine halbe Ansicht', await page.eval("document.getElementById('import-result').hidden && document.querySelector('#import-status .state--error') !== null"));
    await shot(page, 'desktop-23-import-fehler');

    before = await importOnce(page, [path.join(IMPORT_DIR, 'legacy.schematic')]);
    outcome = await waitImport(page, before);
    check('legacy.schematic: alte MCEdit-Datei', !outcome.ok && /MCEdit/.test(outcome.error), outcome.error);

    before = await importOnce(page, [path.join(IMPORT_DIR, 'make-fixtures.mjs')]);
    outcome = await waitImport(page, before, 5000);
    check('Unbekannte Endung vorab abgelehnt', !outcome.ok && /Unbekanntes Dateiformat/.test(outcome.error), outcome.error);

    before = await importOnce(page, [path.join(MODEL_DIR, 'colored.obj'), path.join(MODEL_DIR, 'colored.mtl')]);
    check('OBJ + MTL: Einstellungen erscheinen', await page.eval("!!document.getElementById('import-options') && document.querySelector('.import-file__meta').textContent.includes('colored.mtl')"));
    await page.type('#import-height', '24');
    await page.click('#import-palette .bv-segmented__option:nth-child(2)');
    await shot(page, 'desktop-24-import-modell-optionen');
    await page.click('.import-options__submit');
    outcome = await waitImport(page, before);
    check('OBJ in Blöcke umgewandelt (Höhe 24, Beton)', outcome.ok && outcome.size?.[1] <= 24 && outcome.size?.[1] >= 20, JSON.stringify({ size: outcome.size, error: outcome.error }));
    await page.waitFor(viewReady('import', 'import-result'), 30000);
    await shot(page, 'desktop-25-import-modell');

    before = await importOnce(page, [path.join(MODEL_DIR, 'scene.vox')]);
    check('.vox: Originalgröße angeboten', await page.eval("document.getElementById('import-keep-size')?.checked === true && document.getElementById('import-height').closest('.create-field').hidden"));
    await page.click('.import-options__submit');
    outcome = await waitImport(page, before);
    check('scene.vox geladen', outcome.ok, outcome.error ?? '');

    before = await importOnce(page, [path.join(MODEL_DIR, 'cube-binary.stl')]);
    await page.click('#import-palette .bv-segmented__option:nth-child(5)');
    await sleep(300);
    await page.click('.import-options__submit');
    outcome = await waitImport(page, before);
    check('STL einfarbig (white_concrete)', outcome.ok, outcome.error ?? '');

    const errors = takeErrors(page, EXPECTED_IMPORT_ERRORS);
    check('Import: keine unerwarteten Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Handy

async function mobileFlow(server) {
  const page = await openBrowser({ mobile: true });
  try {
    await page.goto(`${server.url}/erstellen.html?q=${encodeURIComponent('Tokio Skytree halbe Größe')}`);
    await page.waitFor(READY, 30000);
    await sleep(300);
    check('Handy: kein waagrechtes Scrollen', await page.eval('document.documentElement.scrollWidth <= window.innerWidth + 1'), await page.eval('`${document.documentElement.scrollWidth} / ${window.innerWidth}`'));
    await shot(page, 'handy-01-idee');
    await page.click('#create-tab-formen');
    await sleep(200);
    await shot(page, 'handy-02-formen');
    await page.click('#shape-preview-button');
    await page.waitFor(viewReady('shape', 'shape-preview'), 60000);
    await page.eval('window.__createPage.views.shape.viewer.idle()');
    check('Handy: kein waagrechtes Scrollen mit Vorschau', await page.eval('document.documentElement.scrollWidth <= window.innerWidth + 1'));
    await shot(page, 'handy-03-formen-vorschau');
    await page.click('#create-tab-import');
    const before = await importOnce(page, [path.join(IMPORT_DIR, 'house.nbt')]);
    const outcome = await waitImport(page, before);
    check('Handy: house.nbt geladen', outcome.ok, outcome.error ?? '');
    await page.waitFor(viewReady('import', 'import-result'), 30000);
    await shot(page, 'handy-04-import');
    const errors = takeErrors(page);
    check('Handy: keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Zustände: Katalog fehlt, kein WebGL2

async function statesFlow(server) {
  const page = await openBrowser();
  try {
    await page.route('game-data/catalog.json', { body: 'nicht da', status: 404, contentType: 'text/plain' });
    await page.goto(`${server.url}/erstellen.html?q=Burg`);
    await page.waitFor(READY, 30000);
    check('Katalog fehlt: Fehlerzustand mit Anleitung', await page.eval("!!document.querySelector('#create-status .state--error .state__steps')"));
    check('Katalog fehlt: Formen gehen trotzdem', await page.eval("window.__createPage.shape?.ok === true"));
    await shot(page, 'zustand-01-katalog-fehlt');
    takeErrors(page);
    await page.unroute();

    // Kein WebGL2: getContext('webgl2') liefert null
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : original.call(this, type, ...rest); }; })();",
    });
    await page.goto(`${server.url}/erstellen.html#formen`);
    await page.waitFor(READY, 30000);
    await page.click('#shape-preview-button');
    await page.waitFor("document.querySelector('#shape-preview .state--error')", 15000);
    check('Kein WebGL2: verständlicher Zustand in der Vorschau', await page.eval("document.querySelector('#shape-preview .state__title').textContent.includes('3D-Ansicht nicht möglich')"));
    await viewShot(page, 'zustand-02-kein-webgl2');
    await page.click('#create-tab-import');
    const before = await importOnce(page, [path.join(IMPORT_DIR, 'house.nbt')]);
    const outcome = await waitImport(page, before, 15000);
    check('Kein WebGL2: Import meldet es bei der Auswahl', !outcome.ok && outcome.code === 'no-webgl2', outcome.error);
    const errors = takeErrors(page);
    check('Zustände: keine Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------- Start

await mkdir(OUT, { recursive: true });
const server = await startServer({ port: 0 });
const flows = { idee: ideaFlow, formen: shapeFlow, import: importFlow, handy: mobileFlow, zustaende: statesFlow };
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
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden. Screenshots: ${path.relative(ROOT, OUT)}`);
process.exit(failed.length ? 1 : 0);
