// Gemeinsame Prüfungen der Klick-Tests tests/e2e.mjs (lokal mit game-data/) und tests/e2e-remote.mjs (Pages-Nachbau):
// Startseite ohne Scrollen, Kopf ohne Suche mit „Meine Bauten“, der Ablauf „Meine Bauten“ (Hinzufügen per ZIP mit
// manifest.json und per „Zu Meine Bauten“ auf erstellen.html, Liste, Öffnen, Neuladen, Umbenennen, Löschen), die Infos
// eines Community-Baus (Ersteller, Lizenz) und der Lauf-Modus ohne hängende Tasten.
// Nur Node-Bordmittel; das ZIP für den Test entsteht hier (Deflate über node:zlib, Prüfsumme aus js/data/zip.js).
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { CATEGORY_SLUGS } from '../../js/ui/shared.js';
import { crc32 } from '../../js/data/zip.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Startseite fertig: alle Kacheln mit Anzahl (oder Fehlerbox)
export const HOME_READY = `document.querySelectorAll('#home-categories .category-tile').length === ${CATEGORY_SLUGS.length}
  && (!document.querySelector('#home-categories .category-tile__count.is-loading') || document.querySelector('#home-status .state--error'))`;

const NAV_EXPECTED = ['index.html|home|Start', 'kategorie.html|category|Kategorien', 'erstellen.html|create|Selber erstellen', 'meine.html|mine|Meine Bauten'];

/** Startseite: Inhalt bis zur letzten Kachel und den Links ohne Scrollen sichtbar? → { ok, tiles, links, height, total } */
export async function homeFits(page) {
  await page.eval('document.fonts.ready.then(() => true)');
  await page.eval('window.scrollTo(0, 0)');
  await sleep(100);
  return page.eval(`(() => {
    const bottom = (selector) => Math.max(...[...document.querySelectorAll(selector)].map((node) => node.getBoundingClientRect().bottom));
    const tiles = bottom('#home-categories .category-tile');
    const links = bottom('#home-links a');
    const counts = [...document.querySelectorAll('#home-categories .category-tile__count')].map((node) => Number(node.textContent.replace(/\\D/g, '') || 0));
    return {
      ok: scrollY === 0 && tiles <= innerHeight && links <= innerHeight,
      tiles: Math.round(tiles), links: Math.round(links), height: innerHeight, width: innerWidth,
      total: counts.reduce((sum, n) => sum + n, 0),
      byCategory: Object.fromEntries([...document.querySelectorAll('#home-categories .category-tile')].map((tile) => [tile.dataset.category, tile.querySelector('.category-tile__count').textContent.replace(/\\D/g, '')])),
    };
  })()`);
}

/** Kopf: kein Suchfeld, kein Such-Knopf; Navigation Start · Kategorien · Selber erstellen · Meine Bauten; aktiver Punkt. */
export async function checkHeader(page, check, label, current) {
  const state = await page.eval(`(() => {
    const header = document.getElementById('site-header');
    const slots = [...header.querySelectorAll('.hotbar__slot')];
    return {
      search: header.querySelectorAll('input, button, form, [role="search"], .site-search, .site-search-toggle, #site-search, #site-search-toggle').length,
      anywhere: document.querySelectorAll('.site-search, .site-search-toggle, #site-search, #site-search-toggle').length,
      nav: slots.map((a) => [(a.getAttribute('href') ?? '').split('/').pop(), a.dataset.nav, (a.querySelector('.label-long') ?? a).textContent.trim()].join('|')),
      current: header.querySelector('[aria-current="page"]')?.dataset.nav ?? null,
    };
  })()`);
  check(`${label}: Kopf ohne Suchfeld und Such-Knopf`, state.search === 0 && state.anywhere === 0, `${state.search} Such-Elemente im Kopf`);
  check(`${label}: Navigation mit „Meine Bauten“`, state.nav.join(',') === NAV_EXPECTED.join(',') && state.current === current,
    `${state.nav.map((entry) => entry.split('|')[2]).join(' · ')} · aktiv: ${state.current}`);
}

/** Kleines ZIP-Archiv (Deflate) aus [{ name, data }] → Buffer */
export function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const packed = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** ZIP mit manifest.json für „Meine Bauten“: zwei Bauten, einer mit Herkunft, einer mit Feldern, die bereinigt werden. */
export async function writeMineZip(dir, importDir) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'meine-bauten-test.zip');
  await writeFile(file, makeZip([
    { name: 'paket/manifest.json', data: JSON.stringify([
      { file: 'haus.schem', title: 'Haus aus dem ZIP', category: 'haeuser', author: 'Testautor', url: 'https://example.org/haus', license: 'CC BY 4.0' },
      { file: 'regionen.litematic', title: '  Regionen\u0007 aus dem ZIP  ', category: 'gibtsnicht', url: 'javascript:alert(1)' },
    ]) },
    { name: 'paket/haus.schem', data: readFileSync(path.join(importDir, 'house-v3.schem')) },
    { name: 'paket/regionen.litematic', data: readFileSync(path.join(importDir, 'regions.litematic')) },
  ]));
  return file;
}

export const MINE_READY = 'window.__minePage && (window.__minePage.ready || window.__minePage.error)';
const CREATE_READY = 'window.__createPage && window.__createPage.ready';
const BUILD_VIEW_READY = "window.__buildView && window.__buildView.context && window.__buildView.result && document.querySelector('.bv-player:not(.is-loading)')";
const BUILD_ERROR = "document.querySelector('.bv-stage.is-error')";
const STATUS_TITLE = "document.querySelector('#build-status .state__title')";

const cardsOf = (page) => page.eval(`[...document.querySelectorAll('#mine-list .mine-card')].map((card) => ({
  id: card.dataset.id,
  title: card.querySelector('.mine-card__title').textContent,
  meta: card.querySelector('.mine-card__meta').textContent,
  chip: card.querySelector('.chip--category')?.textContent ?? null,
  href: card.querySelector('.mine-card__link').getAttribute('href'),
}))`);

const selectValue = (page, selector, value) => page.eval(`(() => {
  const select = document.querySelector(${JSON.stringify(selector)});
  select.value = ${JSON.stringify(value)};
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

// Eigenen Bau öffnen und warten, bis er fertig gezeichnet ist (oder einen Fehler zeigt) → Zustand
async function openMine(page, url, { reload = false } = {}) {
  if (reload) await page.reload(); else await page.goto(url);
  await page.waitFor(`(${BUILD_VIEW_READY}) || ${BUILD_ERROR} || ${STATUS_TITLE}`, 240000, 150);
  const failed = await page.eval(`Boolean(${BUILD_ERROR} || ${STATUS_TITLE})`);
  if (!failed) await page.eval('window.__buildView.viewer.idle()');
  return failed;
}

/**
 * Ablauf „Meine Bauten“ in einem frischen Browser-Profil.
 * options: { base (mit „/“ am Ende), check, shot, checkConsole(label), importDir, modelDir, tmpDir, prefix,
 *            onSection(label) – z. B. Anfragen prüfen, checkMaterials(label) – optional }
 */
export async function mineFlowSteps(page, { base, check, shot, checkConsole, importDir, modelDir, tmpDir, prefix = 'meine', onSection = null, checkMaterials = null }) {
  const section = async (label) => {
    checkConsole(label);
    if (onSection) await onSection(label);
  };

  // Leerzustand
  await page.goto(`${base}meine.html`);
  await page.waitFor(MINE_READY, 20000);
  const empty = await page.eval(`({ error: window.__minePage.error, count: window.__minePage.count, bar: document.getElementById('mine-bar').hidden,
    title: document.querySelector('#mine-empty .state__title')?.textContent ?? '', button: Boolean(document.getElementById('mine-empty-add')) })`);
  check('Meine Bauten: Leerzustand mit Satz und Knopf „Dateien hinzufügen“', empty.error === null && empty.count === 0 && empty.bar && empty.title === 'Noch keine Bauten' && empty.button, JSON.stringify(empty));
  await checkHeader(page, check, 'Meine Bauten', 'mine');
  await shot(page, `${prefix}-01-leer`);

  // ZIP mit manifest.json hinzufügen
  const zipFile = await writeMineZip(tmpDir, importDir);
  await page.setInputFiles('#mine-file', [zipFile]);
  await page.waitFor('window.__minePage.lastAdd', 60000);
  const lastAdd = await page.eval('window.__minePage.lastAdd');
  check('Meine Bauten: ZIP mit manifest.json → 2 Bauten', lastAdd.added === 2 && lastAdd.skipped === 0 && lastAdd.error === null && await page.eval('window.__minePage.count') === 2, JSON.stringify(lastAdd));
  const zipCards = await cardsOf(page);
  const house = zipCards.find((card) => card.title === 'Haus aus dem ZIP');
  const regions = zipCards.find((card) => card.title === 'Regionen aus dem ZIP');
  check('Meine Bauten: Titel und Kategorie aus dem Manifest', house?.chip === 'Häuser & Wohnen' && /^bau\.html\?meine=[0-9a-f-]{36}$/.test(house?.href ?? ''), JSON.stringify(house));
  check('Meine Bauten: Manifest bereinigt (Steuerzeichen weg, unbekannte Kategorie → keine)', Boolean(regions) && regions.chip === null, JSON.stringify(regions));
  check('Meine Bauten: Karte zeigt Format, Größe und Datum', /^\.schem · [\d.,]+ (?:Bytes|KB) · \d\d\.\d\d\.\d{4}$/.test(house?.meta ?? ''), house?.meta);
  check('Meine Bauten: Liste ohne Quelle und Lizenz', !(await page.eval("/Testautor|CC BY|example\\.org/.test(document.getElementById('mine-list').textContent)")));
  await page.type('#mine-query', 'haus');
  const searched = await page.eval('window.__minePage.shown');
  await page.eval("(() => { const q = document.getElementById('mine-query'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await selectValue(page, '#mine-category', 'haeuser');
  const filtered = await page.eval('window.__minePage.shown');
  await selectValue(page, '#mine-category', '');
  check('Meine Bauten: Suche und Kategorie-Filter', searched === 1 && filtered === 1 && await page.eval('window.__minePage.shown') === 2, `Suche „haus“ ${searched}, Häuser ${filtered}`);
  await shot(page, `${prefix}-02-zip`);
  // Dateien, die sich nicht öffnen ließen (alte MCEdit-.schematic, beschädigt, nur Luft), kommen gar nicht erst hinein
  await page.eval('window.__minePage.lastAdd = null');
  await page.setInputFiles('#mine-file', ['legacy.schematic', 'truncated.schem', 'all-air.schem'].map((name) => path.join(importDir, name)));
  await page.waitFor('window.__minePage.lastAdd', 60000);
  const rejected = await page.eval(`({ ...window.__minePage.lastAdd, count: window.__minePage.count,
    kind: document.querySelector('#mine-status .state')?.className ?? '', lines: [...document.querySelectorAll('#mine-status li')].map((li) => li.textContent.trim()) })`);
  check('Meine Bauten: alte, beschädigte und leere Baupläne werden mit Grund übersprungen', rejected.added === 0 && rejected.skipped === 3 && rejected.count === 2
    && /state--warning/.test(rejected.kind) && /alte MCEdit-Schematic/.test(rejected.lines.join(' ')) && /beschädigt/.test(rejected.lines.join(' ')) && /keine Blöcke/.test(rejected.lines.join(' ')),
    JSON.stringify(rejected).slice(0, 300));
  await shot(page, `${prefix}-02b-uebersprungen`);
  await page.click('#mine-status button');
  await section('Meine Bauten (Liste)');

  // Öffnen → bau.html?meine=<id>: Bau-Ansicht wie ein Upload
  const openHref = await page.eval(`document.querySelector('.mine-card[data-id="${house?.id}"] [data-action="open"]')?.getAttribute('href') ?? null`);
  check('Meine Bauten: „Öffnen“ führt zu bau.html?meine=<id>', openHref === `bau.html?meine=${house?.id}`, String(openHref));
  const failed = await openMine(page, `${base}bau.html?meine=${house?.id}`);
  if (failed) {
    check('Meine Bauten: Öffnen zeigt den Bau in 3D', false, await page.eval("(document.querySelector('.bv-stage__status, #build-status')?.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 200)"));
    return null;
  }
  const view = await page.eval(`(() => {
    const r = window.__buildView.result;
    const crumb = document.getElementById('build-crumb-category');
    return { steps: r.steps.length, blocks: r.blockCount, shownSteps: document.querySelectorAll('.bv-step').length, title: document.getElementById('build-title').textContent,
      crumb: crumb.textContent, crumbHref: crumb.getAttribute('href'), docTitle: document.title };
  })()`);
  check('Meine Bauten: Öffnen zeigt den Bau mit Schritten Ebene für Ebene', view.blocks > 0 && view.steps > 1 && view.shownSteps === view.steps, `${view.blocks} Blöcke, ${view.steps} Schritte`);
  check('Meine Bauten: Kopf mit Titel und Brotkrümel „Meine Bauten“', view.title === 'Haus aus dem ZIP' && view.crumb === 'Meine Bauten' && view.crumbHref.endsWith('meine.html'), `${view.title} · ${view.crumb}`);
  await shot(page, `${prefix}-03-bau`);
  if (checkMaterials) await checkMaterials('Meine Bauten: Haus aus dem ZIP');
  else {
    await page.click('[data-tab="materials"]');
    await page.waitFor("document.querySelectorAll('.bv-material .slot__icon[src]').length > 0", 20000);
  }
  await page.click('[data-tab="layers"]');
  await page.waitFor("/Ebene \\d+ von/.test(document.querySelector('.bv-plan__layer')?.textContent ?? '')", 20000)
    .then(() => check('Meine Bauten: Ebenen-Plan', true), (error) => check('Meine Bauten: Ebenen-Plan', false, error.message.split('\n')[0]));
  await page.click('[data-tab="info"]');
  await sleep(200);
  const info = await page.eval(`(() => {
    const panel = document.querySelector('.bv-info');
    const link = [...(panel?.querySelectorAll('a[href]') ?? [])].find((a) => a.getAttribute('href') === 'https://example.org/haus');
    return { text: (panel?.textContent ?? '').replace(/\\s+/g, ' '), link: Boolean(link), rel: link?.getAttribute('rel') ?? null };
  })()`);
  check('Meine Bauten: Infos zeigen Autor, Link und Lizenz aus dem Manifest', info.text.includes('Testautor') && info.text.includes('CC BY 4.0') && info.link && info.rel === 'noopener noreferrer', info.text.slice(0, 160));
  // Abhaken und Schritt bleiben nach dem Neuladen (Fortschritt „bk:progress:mine:<id>“)
  await page.click('[data-tab="materials"]');
  await page.click('.bv-materials__list li:nth-child(1) .bv-material');
  const middle = Math.max(1, Math.floor(view.steps / 2));
  await page.click('[data-tab="guide"]');
  await page.click(`.bv-step[data-step="${middle - 1}"]`);
  await page.waitFor(`window.__buildView.context.p === ${middle}`, 8000);
  const ticked = await page.eval("[...document.querySelectorAll('.bv-material[aria-pressed=\"true\"]')].map((b) => b.dataset.item)");
  await page.eval('window.__buildView.context.progress.flush()');
  const key = await page.eval("Object.keys(localStorage).find((k) => k.startsWith('bk:progress:mine:')) ?? null");
  await openMine(page, null, { reload: true });
  await page.click('[data-tab="materials"]');
  const tickedAfter = await page.eval("[...document.querySelectorAll('.bv-material[aria-pressed=\"true\"]')].map((b) => b.dataset.item)");
  check('Meine Bauten: Neu laden – Bau, Haken und Schritt bleiben', ticked.length === 1 && tickedAfter.join(',') === ticked.join(',')
    && await page.eval(`window.__buildView.context.p === ${middle} && window.__buildView.result.blockCount === ${view.blocks}`) && key === `bk:progress:mine:${house.id}`,
    `${key} · Haken ${tickedAfter.join(', ')} · Schritt ${await page.eval('window.__buildView.context.p')}`);
  await section('Meine Bauten (Bau-Seite)');

  // „Zu Meine Bauten“ nach einem Upload auf erstellen.html (Bauplan mit Kategorie, Modell mit eigenen Optionen)
  await page.goto(`${base}erstellen.html#import`);
  await page.waitFor(CREATE_READY, 120000);
  await page.setInputFiles('#import-file', [path.join(importDir, 'house-v2.schem')]);
  await page.waitFor("window.__createPage.imports === 1 && window.__createPage.lastImport && (!window.__createPage.lastImport.ok || !document.getElementById('import-save').hidden)", 120000);
  const prefilled = await page.eval("document.getElementById('import-save-title-input')?.value ?? null");
  check('Erstellen: nach dem Upload „Zu Meine Bauten“ mit vorbelegtem Namen', prefilled === 'house-v2', String(prefilled));
  await selectValue(page, '#import-save-category', 'mittelalter');
  await page.click('#import-save-submit');
  await page.waitFor('window.__createPage.saved && window.__createPage.saved.id', 20000);
  const saved = await page.eval('window.__createPage.saved');
  check('Erstellen: Bauplan in Meine Bauten gespeichert', saved.title === 'house-v2' && saved.category === 'mittelalter' && await page.eval("Boolean(document.getElementById('import-save-open'))"), JSON.stringify(saved));
  await page.eval("document.getElementById('import-save').scrollIntoView({ block: 'center' })");
  await shot(page, `${prefix}-04-erstellen-gespeichert`);
  await page.setInputFiles('#import-file', [path.join(modelDir, 'cube-ascii.stl')]);
  await page.waitFor("document.getElementById('import-height')", 10000);
  await page.eval(`(() => {
    const height = document.getElementById('import-height');
    height.value = '12';
    height.dispatchEvent(new Event('input', { bubbles: true }));
    height.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#import-palette input[value="wolle"]').click();
  })()`);
  await page.click('.import-options__submit');
  await page.waitFor("window.__createPage.imports === 2 && window.__createPage.lastImport && (!window.__createPage.lastImport.ok || !document.getElementById('import-save').hidden)", 120000);
  const model = await page.eval('window.__createPage.lastImport');
  await page.click('#import-save-submit');
  await page.waitFor('window.__createPage.saved && window.__createPage.saved.id', 20000);
  const modelId = await page.eval('window.__createPage.saved.id');
  await section('Meine Bauten (Erstellen)');
  const savedHref = await page.eval("document.getElementById('import-save-open')?.getAttribute('href') ?? null");
  check('Erstellen: Link „Öffnen“ nach dem Speichern', Boolean(savedHref?.endsWith(`/bau.html?meine=${modelId}`)), String(savedHref));
  await openMine(page, `${base}bau.html?meine=${modelId}`);
  const reopened = await page.eval('window.__buildView?.result ? { blocks: window.__buildView.result.blockCount, size: window.__buildView.result.size } : null');
  check('Meine Bauten: Modell mit gespeicherten Optionen (Höhe 12, Wolle) gleich gebaut', model.ok && reopened?.blocks === model.blockCount && reopened?.size?.[1] === model.size?.[1],
    `${reopened?.blocks} Blöcke (beim Upload ${model.blockCount}), Höhe ${reopened?.size?.[1]}`);

  // Liste: Neuladen, Umbenennen, Kategorie, Löschen mit Rückfrage
  await page.goto(`${base}meine.html`);
  await page.waitFor(MINE_READY, 20000);
  await page.reload();
  await page.waitFor(MINE_READY, 20000);
  check('Meine Bauten: nach dem Neuladen 4 Bauten', await page.eval('window.__minePage.count') === 4, String(await page.eval('window.__minePage.count')));
  const target = (await cardsOf(page)).find((card) => card.title === 'house-v2');
  const card = `.mine-card[data-id="${target?.id}"]`;
  await page.click(`${card} [data-action="rename"]`);
  await page.type(`${card} input[type="text"]`, 'Mein Haus <b>fett</b>');
  await page.click(`${card} button[type="submit"]`);
  await page.waitFor(`document.querySelector('${card} .mine-card__title')?.textContent === 'Mein Haus <b>fett</b>'`, 10000);
  await page.click(`${card} [data-action="category"]`);
  await selectValue(page, `${card} select`, 'fantasy');
  await page.click(`${card} button[type="submit"]`);
  await page.waitFor(`document.querySelector('${card} .chip--category')?.textContent === 'Fantasy, Anime & Film'`, 10000);
  await page.reload();
  await page.waitFor(MINE_READY, 20000);
  const renamed = await page.eval(`({ title: document.querySelector('${card} .mine-card__title')?.textContent, bold: Boolean(document.querySelector('${card} .mine-card__title b')), chip: document.querySelector('${card} .chip--category')?.textContent })`);
  check('Meine Bauten: Umbenennen (Text bleibt Text) und Kategorie bleiben', renamed.title === 'Mein Haus <b>fett</b>' && !renamed.bold && renamed.chip === 'Fantasy, Anime & Film', JSON.stringify(renamed));
  const houseCard = `.mine-card[data-id="${house.id}"]`;
  await page.click(`${houseCard} [data-action="delete"]`);
  const question = await page.eval(`document.querySelector('${houseCard} .mine-card__question')?.textContent ?? ''`);
  await shot(page, `${prefix}-05-loeschen-rueckfrage`);
  await page.click(`${houseCard} [data-action="confirm-delete"]`);
  await page.waitFor(`!document.querySelector('${houseCard}')`, 10000);
  await page.reload();
  await page.waitFor(MINE_READY, 20000);
  check('Meine Bauten: Löschen mit Rückfrage, weg auch nach dem Neuladen', question === '„Haus aus dem ZIP“ löschen?' && await page.eval('window.__minePage.count') === 3
    && await page.eval(`localStorage.getItem('bk:progress:mine:${house.id}') === null`), `${question} · ${await page.eval('window.__minePage.count')} Bauten`);
  await shot(page, `${prefix}-06-liste`);
  await section('Meine Bauten (Bearbeiten)');

  // Gelöschte oder unbekannte ID und alte Adresse einer Spiel-Struktur
  await page.goto(`${base}bau.html?meine=${house.id}`);
  await page.waitFor(STATUS_TITLE, 20000);
  const gone = await page.eval(`({ title: ${STATUS_TITLE}.textContent, link: document.querySelector('#build-status a[href$="meine.html"]') !== null })`);
  check('Meine Bauten: gelöschter Bau → „Bau nicht gefunden“ mit Link zu Meine Bauten', gone.title === 'Bau nicht gefunden' && gone.link, JSON.stringify(gone));
  await page.goto(`${base}bau.html?meine=gibtsnicht`);
  await page.waitFor(STATUS_TITLE, 20000);
  const invalid = await page.eval(`({ title: ${STATUS_TITLE}.textContent, link: document.querySelector('#build-status a[href$="meine.html"]') !== null })`);
  check('Meine Bauten: ungültige Kennung → „Bau nicht gefunden“ mit Link zu Meine Bauten', invalid.title === 'Bau nicht gefunden' && invalid.link, JSON.stringify(invalid));
  await page.goto(`${base}bau.html?id=spiel-plains-small-house-1`);
  await page.waitFor(STATUS_TITLE, 30000);
  check('Alte Adresse bau.html?id=spiel-… zeigt „unbekannt“', await page.eval(`${STATUS_TITLE}.textContent === 'Bau nicht gefunden' && document.getElementById('build-layout').hidden`),
    await page.eval(`${STATUS_TITLE}.textContent`));
  await section('Meine Bauten (unbekannt)');
  return { house: house.id, model: modelId };
}

// ---------------------------------------------------------------- Bau-Seite: Community-Bau und Lauf-Modus

// Infos eines Community-Baus: Herkunft „Original vom Ersteller“, Ersteller als Link (credits.url), Lizenz als Link
// (credits.licenseUrl), Quelle als Link; kein Chip „Nicht im Spiel getestet“.
export async function communityInfoSteps(page, build, { check, label }) {
  await page.click('[data-tab="info"]');
  await sleep(200);
  const info = await page.eval(`(() => {
    const credits = document.querySelector('.bv-info__credits');
    // Linktext ohne den versteckten Zusatz „(öffnet in neuem Tab)“
    const linkText = (a) => [...a.childNodes].filter((node) => !node.classList?.contains('visually-hidden')).map((node) => node.textContent).join('').trim();
    const links = credits ? [...credits.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: linkText(a), rel: a.getAttribute('rel') ?? '' })) : [];
    const heading = credits?.closest('section')?.querySelector('.bv-info__heading')?.textContent.trim() ?? '';
    const sources = [...document.querySelectorAll('.bv-info__sources a')].map((a) => a.getAttribute('href'));
    return { heading, links, text: credits?.textContent.replace(/\\s+/g, ' ').trim() ?? '', sources,
      chips: document.getElementById('build-chips')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      info: document.querySelector('.bv-info')?.textContent ?? '' };
  })()`);
  const author = info.links.find((link) => link.href === build.credits.url);
  const license = info.links.find((link) => link.href === build.credits.licenseUrl);
  check(`${label}: Infos zeigen Ersteller mit Link und Lizenz mit Link`, info.heading === 'Ersteller' && author?.text === build.credits.author && license?.text === build.credits.license
    && info.links.every((link) => /noopener/.test(link.rel)) && info.sources.includes(build.sources[0].url), info.text.slice(0, 200));
  check(`${label}: Herkunft „Original vom Ersteller“, kein Chip „Nicht im Spiel getestet“`, /Original vom Ersteller/.test(info.chips + info.info) && !/Nicht im Spiel getestet/.test(info.chips + info.info), info.chips);
}

// Lauf-Modus ohne hängende Tasten (Fehler „läuft von allein weiter“): W halten, dann Zeigersperre beenden, Esc, Lauf-Modus
// mit der Maus verlassen oder Kontextmenü – jedes Mal steht die Figur, auch nach dem Wiedereintritt. Das keyup von W kommt
// dabei absichtlich nicht (Chrome verschluckt es nach Esc in der Zeigersperre bzw. beim Kontextmenü).
export async function walkStuckSteps(page, { check, label, shot = null, shotName = 'bau-laufen-haengt-nicht' }) {
  const W = { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 };
  const keyW = (type) => page.send('Input.dispatchKeyEvent', { type, ...W });
  const escape = async () => {
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  };
  const canvasBox = () => page.eval("(() => { const r = document.querySelector('.bv-stage__canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  const mouse = (type, x, y, button = 'left') => page.send('Input.dispatchMouseEvent', { type, x, y, button, buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0, clickCount: 1 });
  const setMode = async (mode) => {
    if (await page.eval(`window.__buildView.viewer.mode === '${mode}'`)) return;
    await page.click('.bv-walk-toggle');
    await page.waitFor(`window.__buildView.viewer.mode === '${mode}'`, 5000);
  };
  // Strecke in 1 s (20 Ticks) nach 0,5 s Abbremsen bzw. Anlaufen. Die Ticks laufen hier von Hand in einem Stück (wie im
  // Unit-Test), damit die Bildrate von swiftshader nichts verfälscht; im Lauf-Modus tickt die Bildschleife dazwischen weiter.
  const moved = () => page.eval(`(() => {
    const walk = window.__buildView.viewer.controls.walk;
    if (!walk.enabled) return -1;
    for (let i = 0; i < 10; i++) walk.update(50);
    const x = walk.player.x, z = walk.player.z;
    for (let i = 0; i < 20; i++) walk.update(50);
    return Math.hypot(walk.player.x - x, walk.player.z - z);
  })()`);
  // Vor dem Bau auf den (virtuellen) Boden, Blick vom Bau weg nach Süden: W läuft ins Freie, keine Wand bremst
  const reset = () => page.eval(`(() => {
    const b = window.__buildView.viewer.bounds;
    window.__buildView.viewer.controls.walk.teleport([b.center[0], b.min[1], b.max[2] + 3], { yaw: 0, pitch: 0, flying: false });
  })()`);
  const stands = (distance) => distance >= 0 && distance < 0.05;
  const fmt = (distance) => (distance < 0 ? 'Lauf-Modus aus' : `${distance.toFixed(2)} Blöcke in 1 s`);
  try {
    await page.eval('window.scrollTo(0, 0)');
    await setMode('walk');
    await reset();
    const box = await canvasBox();

    // 1) Zeigersperre per Klick, W halten, Sperre endet (wie Esc im Browser, ohne keyup) → steht, auch nach erneutem Klick
    await mouse('mouseMoved', box.x, box.y);
    await mouse('mousePressed', box.x, box.y);
    await mouse('mouseReleased', box.x, box.y);
    await page.waitFor('document.pointerLockElement !== null', 5000);
    await keyW('keyDown');
    const walking = await moved();
    await page.eval('new Promise((resolve) => { document.addEventListener("pointerlockchange", resolve, { once: true }); document.exitPointerLock(); })');
    const afterLock = await moved();
    await mouse('mousePressed', box.x, box.y);
    await mouse('mouseReleased', box.x, box.y);
    await page.waitFor('document.pointerLockElement !== null', 5000);
    const relocked = await moved();
    check(`${label}: W gehalten, Zeigersperre endet → die Figur steht (auch nach erneutem Klick)`, walking > 1 && stands(afterLock) && stands(relocked),
      `mit W ${fmt(walking)}, danach ${fmt(afterLock)}, wieder im Bild ${fmt(relocked)}`);
    // Ein spätes keyup ohne Drücken schadet nicht; W geht danach normal
    await reset();
    await keyW('keyUp');
    await keyW('keyDown');
    const again = await moved();
    await keyW('keyUp');
    const released = await moved();
    check(`${label}: danach läuft W normal und hält beim Loslassen`, again > 1 && stands(released), `${fmt(again)} · losgelassen ${fmt(released)}`);
    await page.eval('new Promise((resolve) => { if (!document.pointerLockElement) return resolve(); document.addEventListener("pointerlockchange", resolve, { once: true }); document.exitPointerLock(); })');

    // 2) W halten, Esc (Fokus in der Ansicht) verlässt den Lauf-Modus; wieder rein → steht
    await reset();
    await page.eval("document.querySelector('.bv-stage__canvas').focus()");
    await keyW('keyDown');
    const walking2 = await moved();
    await escape();
    await page.waitFor("window.__buildView.viewer.mode === 'orbit'", 5000);
    await setMode('walk');
    const afterEscape = await moved();
    check(`${label}: W gehalten, Esc beendet den Lauf-Modus, wieder rein → die Figur steht`, walking2 > 1 && stands(afterEscape), `mit W ${fmt(walking2)}, nach Esc und Wiedereintritt ${fmt(afterEscape)}`);
    await keyW('keyUp');

    // 3) W halten, Lauf-Modus mit der Maus aus- und wieder einschalten → steht
    await reset();
    await page.eval("document.querySelector('.bv-stage__canvas').focus()");
    await keyW('keyDown');
    const walking3 = await moved();
    await setMode('orbit');
    await setMode('walk');
    const afterToggle = await moved();
    check(`${label}: W gehalten, Lauf-Modus per Knopf aus und an → die Figur steht`, walking3 > 1 && stands(afterToggle), `mit W ${fmt(walking3)}, danach ${fmt(afterToggle)}`);
    await keyW('keyUp');

    // 4) W halten, Kontextmenü: über der Ansicht kein Browser-Menü (W bleibt gehalten), daneben lässt es alles los
    await reset();
    await page.eval("document.querySelector('.bv-stage__canvas').focus(); window.__e2eMenu = []; window.addEventListener('contextmenu', (e) => window.__e2eMenu.push(e.defaultPrevented), { once: false })");
    await keyW('keyDown');
    const walking4 = await moved();
    await mouse('mousePressed', box.x, box.y, 'right');
    await mouse('mouseReleased', box.x, box.y, 'right');
    const inView = await moved();
    // Rechtsklick daneben: in die Kopfzeile (oben, außerhalb der Ansicht)
    const outside = await page.eval("(() => { const r = document.getElementById('site-header').getBoundingClientRect(); return { x: r.left + 12, y: r.top + r.height / 2 }; })()");
    await mouse('mouseMoved', outside.x, outside.y);
    await mouse('mousePressed', outside.x, outside.y, 'right');
    await mouse('mouseReleased', outside.x, outside.y, 'right');
    const afterMenu = await moved();
    const menu = await page.eval('window.__e2eMenu');
    check(`${label}: W gehalten, Kontextmenü → die Figur steht`, walking4 > 1 && inView > 1 && stands(afterMenu) && menu.join(',') === 'true,false',
      `mit W ${fmt(walking4)}, Rechtsklick in die Ansicht (kein Menü) ${fmt(inView)}, Menü daneben ${fmt(afterMenu)} · verhindert: ${menu.join(', ')}`);
    if (shot) await shot(page, shotName);
    await keyW('keyUp');
  } catch (error) {
    check(`${label}: Lauf-Modus ohne hängende Tasten`, false, error.message.split('\n')[0]);
  } finally {
    await page.eval("window.__buildView.viewer.mode === 'walk' && window.__buildView.viewer.setMode('orbit')").catch(() => {});
  }
}
