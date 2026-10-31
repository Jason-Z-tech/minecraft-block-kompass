// Vorschaubilder des Katalogs (ARCHITEKTUR §10): rendert jeden Eintrag mit der echten 3D-Ansicht in Chrome
// (tests/visual/thumb.html) als WebP 640×400 nach data/thumbs/<id>.webp. Ein Browser für alle Bilder.
// Die Bilder liegen im Repo und werden mit der Seite veröffentlicht (Karten online und lokal, Liste in
// data/thumbs/index.json); tests/unit/thumbs-fresh.test.mjs merkt, wenn eines nicht mehr zum Bau passt.
// Neu gerendert wird nur, wenn sich Eintrag, Modul-Quelltext (samt lokaler Importe) bzw. die Datei eines
// Community-Baus (data/community/), seine Kamera-Einstellung (data/thumbs/views.json) oder die Spieldaten-Version
// geändert haben (Hash in data/thumbs/index.json).
// Kamera je Bau: data/thumbs/views.json = { "<id>": { yaw, pitch, zoom, target, cut } } für Bauten, die die Automatik
// schlecht trifft (Felder siehe validateView in tests/visual/thumb.js).
// Aufruf: node scripts/make-thumbs.mjs [--force] [--only <id>] [--catalog <datei>] [--out <ordner>] [--data <ordner>]
//                                      [--views <datei>] [--gpu hardware|swiftshader] [--prune]

import { readFile, writeFile, rename, unlink, mkdir, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser } from '../tests/browser.mjs';
import { writeFileAtomic } from './build-catalog.mjs';
import { moduleSources, normalizeNewlines } from './lib/module-sources.mjs';
import { COMMUNITY_DIR, isCommunityFile } from '../js/data/community.js';
import { THUMBS_INDEX_VERSION } from '../js/ui/data.js';
import { validateView } from '../tests/visual/thumb.js';

// moduleSources wohnt jetzt in scripts/lib/module-sources.mjs (auch für den Katalog-Fingerabdruck); hier weiter exportiert.
export { moduleSources };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_CATALOG = path.join(ROOT, 'data', 'catalog.json');
export const DEFAULT_OUT_DIR = path.join(ROOT, 'data', 'thumbs');
export const DEFAULT_DATA_DIR = path.join(ROOT, 'game-data');
export const DEFAULT_VIEWS_FILE = path.join(DEFAULT_OUT_DIR, 'views.json');
export const THUMB_SIZE = Object.freeze([640, 400]);
// Höher setzen, wenn sich Kamera oder Bildaufbau ändern (alle Bilder werden dann neu gerendert)
export const THUMB_STYLE = 3;
// Obergrenze aller Vorschaubilder zusammen (sie liegen im Repo und auf GitHub Pages)
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
// Format von index.json: dieselbe Konstante, die die Seite prüft (js/ui/data.js) – sonst zeigte sie still nur Icons
export const INDEX_VERSION = THUMBS_INDEX_VERSION;
// Zwischendateien, die make-thumbs in den Zielordner schreibt (writeBinaryAtomic: <id>.webp.<pid>-<zeit>.tmp;
// writeFileAtomic: index.json.<pid>-<zeit>-<zufall>.tmp). Sie bleiben nur nach einem abgebrochenen Lauf liegen.
export const TEMP_FILE_PATTERN = /^(?:[a-z0-9-]{2,80}\.webp|index\.json)\.\d+-[a-z0-9-]+\.tmp$/;
const ID_PATTERN = /^[a-z0-9-]{2,80}$/;
const MODULE_PATTERN = /^(js\/builds|tests\/fixtures)\/[a-z0-9/-]+\.js$/;
const RENDER_TIMEOUT_MS = 180_000;

const USAGE = `Aufruf: node scripts/make-thumbs.mjs [Optionen]
  --force                alle Bilder neu rendern
  --only <id>            nur diesen Eintrag (mehrfach möglich)
  --catalog <datei>      Katalog, Standard data/catalog.json
  --out <ordner>         Zielordner, Standard data/thumbs
  --data <ordner>        Spieldaten, Standard game-data
  --views <datei>        Kamera-Einstellungen je Bau, Standard data/thumbs/views.json (fehlt sie, gilt die Automatik)
  --gpu <art>            hardware (Standard, Rückfall swiftshader) oder swiftshader
  --prune                Bilder (und ihre Index-Einträge) löschen, deren Eintrag es im Katalog nicht mehr gibt
Zwischendateien eines abgebrochenen Laufs (*.tmp) räumt jeder Lauf zuerst weg.`;

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseArgs(argv) {
  const options = {
    force: false, only: [], catalog: DEFAULT_CATALOG, outDir: DEFAULT_OUT_DIR, dataDir: DEFAULT_DATA_DIR, viewsFile: DEFAULT_VIEWS_FILE, gpu: 'hardware',
    prune: false, help: false,
  };
  const take = (i) => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${argv[i]} braucht einen Wert.`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--force': options.force = true; break;
      case '--prune': options.prune = true; break;
      case '--only': {
        const id = take(i++);
        if (!ID_PATTERN.test(id)) throw new UsageError(`Ungültige ID „${id}“.`);
        options.only.push(id);
        break;
      }
      case '--catalog': options.catalog = path.resolve(take(i++)); break;
      case '--out': options.outDir = path.resolve(take(i++)); break;
      case '--data': options.dataDir = path.resolve(take(i++)); break;
      case '--views': options.viewsFile = path.resolve(take(i++)); break;
      case '--gpu': {
        options.gpu = take(i++);
        if (!['hardware', 'swiftshader'].includes(options.gpu)) throw new UsageError('--gpu muss hardware oder swiftshader sein.');
        break;
      }
      case '--help': case '-h': options.help = true; break;
      default: throw new UsageError(`Unbekannte Option ${arg}.`);
    }
  }
  return options;
}

// ------------------------------------------------------------------ Hash

const sha1 = (data) => createHash('sha1').update(data).digest('hex');

async function readJsonFile(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

/** Spieldaten-Stand für den Hash: Version, Weltversion und Ressourcenpaket aus meta.json. */
export async function dataStamp(dataDir) {
  const meta = await readJsonFile(path.join(dataDir, 'meta.json'));
  if (typeof meta.version !== 'string') throw new Error(`${path.join(dataDir, 'meta.json')} hat keine Version – erzeuge die Spieldaten neu: node scripts/extract-game-data.mjs`);
  return `${meta.version}|${meta.worldVersion ?? ''}|${meta.resourcePack ?? ''}`;
}

/**
 * Kamera-Einstellungen je Bau aus views.json → { id: geprüfte Einstellung } ({} ohne Datei). Wirft bei kaputter
 * Datei, ungültiger ID oder ungültiger Einstellung (mit Dateiname und ID).
 */
export async function loadViews(file = DEFAULT_VIEWS_FILE) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file} ist kein gültiges JSON: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file} muss ein Objekt { "<id>": { yaw, pitch, zoom, target, cut } } sein.`);
  const views = {};
  for (const [id, view] of Object.entries(data)) {
    if (!ID_PATTERN.test(id)) throw new Error(`${file}: ungültige ID „${id.slice(0, 80)}“.`);
    try {
      views[id] = validateView(view);
    } catch (error) {
      throw new Error(`${file}, ${id}: ${error.message}`);
    }
  }
  return views;
}

/**
 * Hash eines Katalog-Eintrags für die Vorschau (ohne das Feld thumb). views = Ergebnis von loadViews: eine
 * Kamera-Einstellung des Eintrags geht mit ein (Bauten ohne Einstellung behalten ihren Hash). Quelltext zählt mit
 * vereinheitlichten Zeilenenden (wie im Katalog-Fingerabdruck: CRLF und LF geben denselben Hash), die Datei eines
 * Community-Baus mit ihren Bytes.
 */
export async function thumbHash(entry, { stamp, root = ROOT, views = {} }) {
  const { thumb, ...rest } = entry;
  const parts = [`style ${THUMB_STYLE}`, `size ${THUMB_SIZE.join('x')}`, `data ${stamp}`, JSON.stringify(rest)];
  const view = Object.hasOwn(views, entry.id) ? views[entry.id] : null;
  if (view) parts.push(`view ${JSON.stringify(view)}`);
  if (entry.module) {
    for (const { file, text } of await moduleSources(path.join(root, entry.module), { root })) parts.push(`${file}\n${sha1(normalizeNewlines(text))}`);
  } else if (isCommunityFile(entry.community?.file)) {
    const file = `${COMMUNITY_DIR}${entry.community.file}`;
    parts.push(`${file}\n${sha1(await readFile(path.join(root, file)))}`);
  }
  return sha1(parts.join('\n'));
}

/** Auftrag für die Render-Seite (view = geprüfte Kamera-Einstellung des Eintrags oder null). */
export function jobFor(entry, view = null) {
  const extra = view ? { view } : {};
  if (entry.module) {
    if (!MODULE_PATTERN.test(entry.module)) throw new Error(`ungültiger Modulpfad „${entry.module}“`);
    return { source: { kind: 'module', path: entry.module }, scale: entry.defaultScale ?? null, ...extra };
  }
  if (entry.community) {
    if (!isCommunityFile(entry.community.file)) throw new Error(`ungültiger Community-Bau „${String(entry.community.file).slice(0, 80)}“`);
    return { source: { kind: 'community', file: entry.community.file }, scale: null, ...extra };
  }
  throw new Error('weder Bau-Modul noch Community-Bau gesetzt');
}

// ------------------------------------------------------------------ Index

/**
 * Inhalt von index.json: { version, style, size, data (Spieldaten-Stand der Hashes), entries } – Einträge nach ID
 * sortiert, damit Änderungen im Repo klein bleiben.
 */
export function indexText(index, stamp) {
  const entries = Object.fromEntries(Object.keys(index.entries).sort().map((id) => [id, index.entries[id]]));
  return `${JSON.stringify({ version: INDEX_VERSION, style: THUMB_STYLE, size: THUMB_SIZE, data: stamp, entries }, null, 2)}\n`;
}

/** Summe der Dateigrößen aller Bilder <outDir>/*.webp in Byte. */
export async function totalThumbBytes(outDir) {
  let total = 0;
  for (const name of await readdir(outDir)) if (name.endsWith('.webp')) total += (await stat(path.join(outDir, name))).size;
  return total;
}

export async function loadIndex(outDir) {
  const file = path.join(outDir, 'index.json');
  try {
    const index = await readJsonFile(file);
    if (index?.version === INDEX_VERSION && index.entries && typeof index.entries === 'object') return index;
    console.warn(`${file} hat ein unbekanntes Format – alle Bilder werden neu geprüft.`);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`${file} ist nicht lesbar (${error.message}) – alle Bilder werden neu geprüft.`);
  }
  return { version: INDEX_VERSION, entries: {} };
}

async function fileExists(file) {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Löscht Zwischendateien eines abgebrochenen Laufs (TEMP_FILE_PATTERN) in outDir; andere Dateien bleiben. Zwei Läufe
 * gleichzeitig im selben Ordner gibt es nicht (sie überschrieben sich auch index.json). → [Dateiname], sortiert
 */
export async function removeTempFiles(outDir) {
  const removed = [];
  for (const name of await readdir(outDir)) {
    if (!TEMP_FILE_PATTERN.test(name)) continue;
    try {
      await unlink(path.join(outDir, name));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    removed.push(name);
  }
  return removed.sort();
}

async function writeBinaryAtomic(file, buffer) {
  const temp = `${file}.${process.pid}-${Date.now().toString(36)}.tmp`;
  await writeFile(temp, buffer);
  try {
    await rename(temp, file);
  } catch (error) {
    await unlink(temp).catch((cleanupError) => console.error(`Zwischendatei ${temp} ließ sich nicht löschen: ${cleanupError.message}`));
    throw error;
  }
}

/** Prüft ein WebP (RIFF/WEBP-Kopf) und liest seine Bildgröße (VP8, VP8L, VP8X). → [w, h] */
export function webpSize(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') throw new Error('kein WebP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  if (chunk === 'VP8 ') return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  throw new Error(`unbekannter WebP-Block ${chunk}`);
}

// ------------------------------------------------------------------ Browser

async function openRenderer(gpu, serverUrl, log) {
  const tries = gpu === 'hardware' ? ['hardware', 'swiftshader'] : ['swiftshader'];
  for (const mode of tries) {
    const page = await launchBrowser({ gpu: mode, width: THUMB_SIZE[0], height: THUMB_SIZE[1], deviceScaleFactor: 2 });
    try {
      await page.goto(`${serverUrl}/tests/visual/thumb.html`);
      await page.waitFor(READY_EXPRESSION, 30000, 100);
      const state = await page.eval('({ ready: window.__thumb.ready, error: window.__thumb.error, renderer: window.__thumb.renderer })');
      if (state.ready) {
        log(`Browser: ${mode} (${state.renderer})`);
        return page;
      }
      log(`Browser mit ${mode}: ${state.error}${mode !== tries.at(-1) ? ' – versuche swiftshader' : ''}`);
    } catch (error) {
      log(`Browser mit ${mode} ließ sich nicht starten: ${error.message}`);
    }
    await page.close();
  }
  throw new Error('Keine 3D-Ansicht im Browser verfügbar (weder Grafikkarte noch swiftshader).');
}

const READY_EXPRESSION = 'window.__thumb && (window.__thumb.ready || window.__thumb.error)';

async function reloadRenderer(page) {
  await page.reload();
  await page.waitFor(READY_EXPRESSION, 30000, 100);
  const error = await page.eval('window.__thumb.error');
  if (error) throw new Error(`Render-Seite nach dem Neuladen nicht bereit: ${error}`);
}

function renderOnPage(page, job, label) {
  return withTimeout(page.eval(`window.__thumb.render(${JSON.stringify(job)})`), RENDER_TIMEOUT_MS, label);
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: keine Antwort nach ${ms / 1000} s`)), ms); }),
  ]);
}

// ------------------------------------------------------------------ Ablauf

/**
 * Erzeugt fehlende oder veraltete Vorschaubilder. Räumt zuerst Zwischendateien eines abgebrochenen Laufs weg.
 * → { rendered: [id], skipped: [id], retried: [id], errors: [Text], orphans: [Datei], removedTemp: [Datei], durationMs }
 */
export async function makeThumbs({
  catalog, outDir = DEFAULT_OUT_DIR, dataDir = DEFAULT_DATA_DIR, viewsFile = DEFAULT_VIEWS_FILE, force = false, only = [], gpu = 'hardware',
  prune = false, log = () => {}, root = ROOT,
}) {
  const started = performance.now();
  const errors = [];
  const rendered = [];
  const skipped = [];
  const retried = [];
  await mkdir(outDir, { recursive: true });
  // Bricht ein Lauf ab (z. B. Neustart des Rechners), bleiben Zwischendateien liegen; der nächste Lauf räumt sie weg
  const removedTemp = await removeTempFiles(outDir);
  if (removedTemp.length) log(`${removedTemp.length} Zwischendatei${removedTemp.length === 1 ? '' : 'en'} eines abgebrochenen Laufs gelöscht.`);
  const stamp = await dataStamp(dataDir);
  const views = await loadViews(viewsFile);
  const index = await loadIndex(outDir);
  const indexFile = path.join(outDir, 'index.json');
  const builds = catalog.builds.filter((b) => only.length === 0 || only.includes(b.id));
  for (const id of only) if (!catalog.builds.some((b) => b.id === id)) errors.push(`${id}: nicht im Katalog.`);

  const todo = [];
  for (const entry of builds) {
    if (!ID_PATTERN.test(entry.id)) {
      errors.push(`Ungültige ID „${String(entry.id).slice(0, 80)}“ im Katalog.`);
      continue;
    }
    let hash, job;
    try {
      job = jobFor(entry, Object.hasOwn(views, entry.id) ? views[entry.id] : null);
      hash = await thumbHash(entry, { stamp, root, views });
    } catch (error) {
      errors.push(`${entry.id}: ${error.message}`);
      continue;
    }
    const file = path.join(outDir, `${entry.id}.webp`);
    if (!force && index.entries[entry.id]?.hash === hash && await fileExists(file)) skipped.push(entry.id);
    else todo.push({ entry, job, hash, file });
  }

  if (todo.length) {
    log(`Rendere ${todo.length} Vorschaubild${todo.length === 1 ? '' : 'er'} (${skipped.length} aktuell) …`);
    const server = await startServer({ port: 0, rootDir: root });
    let page = null;
    try {
      page = await openRenderer(gpu, server.url, log);
      for (const [i, { entry, job, hash, file }] of todo.entries()) {
        try {
          let result = await renderOnPage(page, job, entry.id);
          if (!result?.ok) {
            // Frische Seite (neuer WebGL-Kontext) und ein zweiter Versuch, z. B. nach einem Fehler beim Textur-Upload
            log(`  ! ${entry.id}: ${result?.error ?? 'keine Antwort'} – lade die Seite neu und versuche es noch einmal`);
            await reloadRenderer(page);
            result = await renderOnPage(page, job, entry.id);
            retried.push(entry.id);
          }
          if (!result?.ok) throw new Error(result?.error ?? 'keine Antwort der Render-Seite');
          const buffer = Buffer.from(result.data, 'base64');
          const size = webpSize(buffer);
          if (size[0] !== THUMB_SIZE[0] || size[1] !== THUMB_SIZE[1]) throw new Error(`Bild hat ${size.join('×')} statt ${THUMB_SIZE.join('×')}`);
          await writeBinaryAtomic(file, buffer);
          index.entries[entry.id] = { hash, bytes: buffer.length, renderedAt: new Date().toISOString() };
          // Nach jedem Bild sichern: bricht der Lauf ab, rendert der nächste nur, was noch fehlt
          await writeFileAtomic(indexFile, indexText(index, stamp));
          rendered.push(entry.id);
          const missing = Array.isArray(result.missingTextures) ? result.missingTextures.length : Number(result.missingTextures) || 0;
          const extra = missing ? ` · ${missing} fehlende Texturen` : '';
          // Blöcke im Bild (mit Schnitt aus views.json weniger als der ganze Bau)
          const blocks = Number.isInteger(result.blocks) ? ` · ${result.blocks.toLocaleString('de-DE')} Blöcke` : '';
          log(`  ${String(i + 1).padStart(String(todo.length).length)}/${todo.length} ${entry.id} · ${Math.round(buffer.length / 1024)} KB${blocks} · ${result.ms} ms${extra}`);
        } catch (error) {
          errors.push(`${entry.id}: Vorschaubild fehlgeschlagen: ${error.message}`);
          delete index.entries[entry.id];
          log(`  ✗ ${entry.id}: ${error.message}`);
        }
      }
    } finally {
      await page?.close().catch((error) => console.error(`Browser ließ sich nicht schließen: ${error.message}`));
      await server.close();
      await writeFileAtomic(indexFile, indexText(index, stamp));
    }
  }

  const ids = new Set(catalog.builds.map((b) => b.id));
  const orphans = (await readdir(outDir)).filter((name) => name.endsWith('.webp') && !ids.has(name.slice(0, -5))).sort();
  const staleEntries = Object.keys(index.entries).filter((id) => !ids.has(id));
  if (prune && (orphans.length || staleEntries.length)) {
    for (const name of orphans) await unlink(path.join(outDir, name));
    for (const id of staleEntries) delete index.entries[id];
    await writeFileAtomic(indexFile, indexText(index, stamp));
    if (orphans.length) log(`${orphans.length} veraltete Bilder gelöscht.`);
  }
  return { rendered, skipped, retried, errors, orphans: prune ? [] : orphans, removedTemp, durationMs: Math.round(performance.now() - started) };
}

/** Anzahl der Katalog-Einträge, zu denen es ein Vorschaubild <outDir>/<id>.webp gibt. */
export async function countThumbs(catalog, outDir) {
  let count = 0;
  for (const build of catalog.builds) if (await fileExists(path.join(outDir, `${build.id}.webp`))) count++;
  return count;
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    console.error(USAGE);
    return 2;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  let catalog;
  try {
    catalog = await readJsonFile(options.catalog);
    if (!Array.isArray(catalog?.builds)) throw new Error('kein Feld „builds“');
  } catch (error) {
    console.error(`Katalog ${options.catalog} nicht lesbar (${error.message}) – erzeuge ihn mit: node scripts/build-catalog.mjs`);
    return 1;
  }
  const result = await makeThumbs({ ...options, catalog, log: (line) => console.log(line) });
  // Der Katalog bleibt unverändert (er kennt keine Bilder); die Seite findet sie über data/thumbs/index.json.
  const withThumbs = await countThumbs(catalog, options.outDir);
  const total = await totalThumbBytes(options.outDir);
  const megabytes = (bytes) => (bytes / 1024 / 1024).toFixed(1).replace('.', ',');
  console.log(`Fertig: ${result.rendered.length} gerendert${result.retried.length ? ` (${result.retried.length} im zweiten Versuch)` : ""}, ${result.skipped.length} aktuell, ${withThumbs}/${catalog.builds.length} Einträge mit Bild · ${megabytes(total)} MB · ${(result.durationMs / 1000).toFixed(1).replace('.', ',')} s`);
  if (total > MAX_TOTAL_BYTES) result.errors.push(`Alle Bilder zusammen ${megabytes(total)} MB – mehr als ${megabytes(MAX_TOTAL_BYTES)} MB erlaubt (THUMB_QUALITY in tests/visual/thumb.js senken und THUMB_STYLE erhöhen).`);
  if (result.orphans.length) console.log(`Hinweis: ${result.orphans.length} Bilder ohne Katalog-Eintrag (löschen mit --prune): ${result.orphans.slice(0, 10).join(', ')}${result.orphans.length > 10 ? ' …' : ''}`);
  if (result.errors.length) {
    console.error(`Fehler (${result.errors.length}):`);
    for (const error of result.errors) console.error(`  ✗ ${error}`);
  }
  return result.errors.length ? 1 : 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`Vorschaubilder fehlgeschlagen: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
