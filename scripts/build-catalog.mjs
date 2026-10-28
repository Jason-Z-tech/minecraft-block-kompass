// Katalog der Bauten (ARCHITEKTUR §9): prüft alle Bau-Module js/builds/<kategorie>/<id>.js mit checkBuild (für jeden
// Maßstab) und schreibt data/catalog.json atomar.
// Der Katalog liegt im Repo und wird mit der Webseite veröffentlicht: Er enthält nur Projekttexte, Größen, Zahlen und
// Block-IDs, keine Spieldaten und keine Vorschaubilder (die liegen nur lokal in thumbs/, siehe thumbs/index.json).
// „inputs“ hält einen Fingerabdruck der Eingaben (Quelltext und Spieldaten); passt er nicht mehr, ist der Katalog veraltet.
// Aufruf: node scripts/build-catalog.mjs [--thumbs [--force]] [--modules-dir <ordner>] [--data <ordner>] [--out <datei>]
//                                        [--thumbs-dir <ordner>]
// Fehlerhafte Einträge fehlen im Katalog (Hinweis unter „warnings“); alle Fehler stehen am Ende, Exit-Code 1.

import { readFile, readdir, rename, writeFile, unlink, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkBuild, CATEGORIES } from './check-build.mjs';
import { moduleSources } from './lib/module-sources.mjs';
import { CATEGORIES as CATEGORY_INFO } from '../js/ui/shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_MODULES_DIR = path.join(ROOT, 'js', 'builds');
export const DEFAULT_DATA_DIR = path.join(ROOT, 'game-data');
export const DEFAULT_THUMBS_DIR = path.join(ROOT, 'thumbs');
export const DEFAULT_OUT = path.join(ROOT, 'data', 'catalog.json');
const SELF_FILE = fileURLToPath(import.meta.url);
// Einstiegspunkte des Fingerabdrucks (samt aller relativ importierten Dateien), dazu jedes Bau-Modul
const FINGERPRINT_ENTRIES = [path.join(ROOT, 'scripts', 'check-build.mjs'), path.join(ROOT, 'js', 'core', 'materials.js')];

export const TOP_MATERIALS = 8;
export const SIZE_CLASSES = Object.freeze([['klein', 1_000], ['mittel', 10_000], ['gross', 100_000], ['riesig', Infinity]]);
const MAX_WARNINGS_PER_ENTRY = 20;
// Ordner unter js/builds/, die keine Bauten enthalten (Hilfsbibliothek)
const HELPER_FOLDERS = new Set(['lib']);

const USAGE = `Aufruf: node scripts/build-catalog.mjs [Optionen]
  --thumbs                 danach Vorschaubilder erzeugen (scripts/make-thumbs.mjs) und eintragen
  --force                  mit --thumbs: alle Vorschaubilder neu rendern
  --modules-dir <ordner>   Bau-Module (<ordner>/<kategorie>/<id>.js), Standard js/builds
  --data <ordner>          Spieldaten, Standard game-data
  --out <datei>            Ziel, Standard data/catalog.json
  --thumbs-dir <ordner>    Ordner der Vorschaubilder, Standard thumbs`;

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

export function parseArgs(argv) {
  const options = {
    modulesDir: DEFAULT_MODULES_DIR, dataDir: DEFAULT_DATA_DIR, out: null, thumbsDir: DEFAULT_THUMBS_DIR, thumbs: false, force: false, help: false,
  };
  const take = (i) => {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${argv[i]} braucht einen Wert.`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--thumbs': options.thumbs = true; break;
      case '--force': options.force = true; break;
      case '--modules-dir': options.modulesDir = path.resolve(take(i++)); break;
      case '--data': options.dataDir = path.resolve(take(i++)); break;
      case '--out': options.out = path.resolve(take(i++)); break;
      case '--thumbs-dir': options.thumbsDir = path.resolve(take(i++)); break;
      case '--help': case '-h': options.help = true; break;
      default: throw new UsageError(`Unbekannte Option ${arg}.`);
    }
  }
  if (options.force && !options.thumbs) throw new UsageError('--force gibt es nur zusammen mit --thumbs.');
  // Mit eigenen Spieldaten (--data) nicht den veröffentlichten Katalog im Repo überschreiben
  options.out ??= options.dataDir === DEFAULT_DATA_DIR ? DEFAULT_OUT : path.join(options.dataDir, 'catalog.json');
  return options;
}

// ------------------------------------------------------------------ Hilfen

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function projectPath(file) {
  return toPosix(path.relative(ROOT, file));
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
// Zeilenenden vereinheitlichen: Eine Windows-Arbeitskopie kann CRLF haben, der Fingerabdruck soll trotzdem gleich bleiben.
const textHash = (text) => sha256(text.replace(/\r\n/g, '\n'));
const byName = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Fingerabdruck des Quelltexts, der den Katalog bestimmt: dieses Skript, scripts/check-build.mjs, js/core/materials.js
 * und alle Bau-Module, jeweils samt aller relativ importierten Dateien (Hilfsbibliothek, Kern, …).
 * Die Oberfläche (js/ui/) zählt nicht. → sha256 als Hex-Text
 */
export async function codeFingerprint({ modulesDir = DEFAULT_MODULES_DIR, root = ROOT } = {}) {
  const { modules } = await findModules(modulesDir);
  const entries = [...FINGERPRINT_ENTRIES, ...modules.map((mod) => mod.file)];
  const files = new Map();
  for (const entry of entries) {
    try {
      for (const { file, text } of await moduleSources(entry, { root })) files.set(file, text);
    } catch (error) {
      // Kaputter Import oder Datei außerhalb des Projekts: nicht abbrechen (den Fehler meldet die Prüfung des Moduls),
      // aber im Fingerabdruck festhalten, damit er sich ändert, sobald das Modul repariert ist
      files.set(`${toPosix(path.relative(root, entry))} (nicht lesbar)`, String(error?.message ?? error));
    }
  }
  // Das Skript selbst nur als Datei: seine Importe für die Konsolen-Ausgabe (js/ui/shared.js) ändern den Katalog nicht
  files.set(toPosix(path.relative(root, SELF_FILE)), await readFile(SELF_FILE, 'utf8'));
  return sha256([...files].sort(byName).map(([file, text]) => `${file} ${textHash(text)}`).join('\n'));
}

/**
 * Fingerabdruck der Spieldaten, die den Katalog bestimmen: Version und blocks.json. Unabhängig davon, ob die Daten aus
 * der Jar oder aus öffentlichen Quellen stammen.
 */
export async function dataFingerprint(dataDir = DEFAULT_DATA_DIR) {
  const parts = [];
  try {
    const meta = await readJson(path.join(dataDir, 'meta.json'));
    parts.push(`version ${meta.version ?? ''}|${meta.worldVersion ?? ''}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    parts.push('version ?');
  }
  try {
    parts.push(`blocks.json ${sha256(await readFile(path.join(dataDir, 'blocks.json')))}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    parts.push('blocks.json fehlt');
  }
  return sha256(parts.join('\n'));
}

/** Beide Fingerabdrücke für das Feld „inputs“ des Katalogs. */
export async function catalogInputs({ modulesDir = DEFAULT_MODULES_DIR, dataDir = DEFAULT_DATA_DIR, root = ROOT } = {}) {
  return { code: await codeFingerprint({ modulesDir, root }), data: await dataFingerprint(dataDir) };
}

/** Größenklasse nach Blockzahl: klein < 1 000 ≤ mittel < 10 000 ≤ gross < 100 000 ≤ riesig. */
export function sizeClass(blocks) {
  if (!Number.isInteger(blocks) || blocks < 0) throw new Error(`sizeClass: ungültige Blockzahl ${blocks}.`);
  return SIZE_CLASSES.find(([, limit]) => blocks < limit)[0];
}

/** Standard-Maßstab: 1, wenn erlaubt, sonst der erste (wie check-build). */
export function defaultScaleOf(scales) {
  return scales.includes(1) ? 1 : scales[0];
}

function topMaterialsOf(materials) {
  return materials.slice(0, TOP_MATERIALS).map(([item, count]) => [item, count]);
}

// Warnungen eines Eintrags begrenzen (ein Modul mit Hunderten gleicher Hinweise soll den Katalog nicht füllen).
function limitWarnings(id, warnings) {
  const unique = [...new Set(warnings)];
  const lines = unique.slice(0, MAX_WARNINGS_PER_ENTRY).map((w) => `${id}: ${w}`);
  if (unique.length > MAX_WARNINGS_PER_ENTRY) lines.push(`${id}: … und ${unique.length - MAX_WARNINGS_PER_ENTRY} weitere Warnungen`);
  return lines;
}

// ------------------------------------------------------------------ Bau-Module

/**
 * Sucht <modulesDir>/<kategorie>/*.js (nur Kategorie-Ordner nach §8). Andere Ordner außer lib/ werden gemeldet.
 * → { modules: [{ file, folder, fileId }], notes: [Text] }
 */
export async function findModules(modulesDir) {
  const modules = [];
  const notes = [];
  let entries;
  try {
    entries = await readdir(modulesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { modules, notes: [`Ordner ${projectPath(modulesDir)} fehlt – keine Bau-Module.`] };
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (!CATEGORIES.includes(entry.name)) {
      if (!HELPER_FOLDERS.has(entry.name) && !entry.name.startsWith('.')) notes.push(`Ordner ${projectPath(path.join(modulesDir, entry.name))} ist keine Kategorie und wird übersprungen.`);
      continue;
    }
    const folder = path.join(modulesDir, entry.name);
    const files = (await readdir(folder, { withFileTypes: true })).filter((f) => f.isFile() && f.name.endsWith('.js'));
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      modules.push({ file: path.join(folder, file.name), folder: entry.name, fileId: file.name.slice(0, -3) });
    }
  }
  return { modules, notes };
}

async function importModule(file) {
  return import(pathToFileURL(file).href);
}

function moduleScales(meta) {
  return Array.isArray(meta?.scales) && meta.scales.length > 0 ? meta.scales : null;
}

function scaleLabel(scale) {
  return `Maßstab ${String(scale).replace('.', ',')}`;
}

/**
 * Prüft ein Modul mit checkBuild (für jeden Maßstab) und baut den Katalog-Eintrag.
 * → { entry | null, errors: [Text], warnings: [Text] }
 */
export async function catalogModule({ file, folder, fileId }, { dataDir = DEFAULT_DATA_DIR } = {}) {
  const label = projectPath(file);
  const errors = [];
  let mod;
  try {
    mod = await importModule(file);
  } catch (error) {
    return { entry: null, errors: [`${label}: Modul lässt sich nicht laden: ${error.message}`], warnings: [] };
  }
  const meta = mod.meta;
  if (meta && typeof meta === 'object') {
    // Unter js/builds/ prüft checkBuild den Ordner selbst; bei --modules-dir anderswo hier
    const checkedByCheckBuild = /^js\/builds\/[^/]+\/[^/]+\.js$/.test(label);
    if (!checkedByCheckBuild && meta.category !== folder) errors.push(`${label}: meta.category „${meta.category}“ passt nicht zum Ordner „${folder}“.`);
  }
  const scales = moduleScales(meta);
  const reports = [];
  for (const scale of scales ?? [null]) {
    const report = await checkBuild(file, { scale, dataDir });
    reports.push({ scale, report });
    const where = scales && scales.length > 1 ? ` (${scaleLabel(report.scale ?? scale)})` : '';
    for (const error of report.errors) errors.push(`${label}${where}: ${error}`);
  }
  const id = typeof meta?.id === 'string' ? meta.id : fileId;
  const warnings = limitWarnings(id, reports.flatMap(({ scale, report }) => report.warnings.map((w) => (scales && scales.length > 1 ? `${scaleLabel(scale)}: ${w}` : w))));
  if (errors.length) return { entry: null, errors, warnings };

  const defaultScale = scales ? defaultScaleOf(scales) : null;
  const main = (reports.find((r) => r.scale === defaultScale) ?? reports[0]).report;
  const variants = scales
    ? Object.fromEntries(reports.map(({ scale, report }) => [String(scale), { size: report.size, blocks: report.blockCount, steps: report.steps }]))
    : null;
  const entry = {
    id: meta.id,
    title: meta.title,
    category: meta.category,
    subtitle: meta.subtitle,
    tags: [...meta.tags],
    aliases: [...meta.aliases],
    accuracy: meta.accuracy,
    description: meta.description,
    sources: meta.sources.map((s) => ({ title: s.title, url: s.url })),
    credits: meta.credits ? { author: meta.credits.author, url: meta.credits.url, license: meta.credits.license } : null,
    tested: typeof meta.tested === 'boolean' ? meta.tested : null,
    module: projectPath(file),
    scales: scales ? [...scales] : null,
    defaultScale,
    size: main.size,
    blocks: main.blockCount,
    steps: main.steps,
    phases: main.phases,
    variants,
    topMaterials: topMaterialsOf(main.materials.map((m) => [m.item, m.count])),
    sizeClass: sizeClass(main.blockCount),
    thumb: null,
  };
  return { entry, errors: [], warnings };
}

// ------------------------------------------------------------------ Katalog

async function readGameDataVersion(dataDir) {
  for (const name of ['meta.json', 'blocks.json']) {
    try {
      const json = await readJson(path.join(dataDir, name));
      if (typeof json.version === 'string') return json.version;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`${projectPath(path.join(dataDir, name))} ist nicht lesbar: ${error.message}`);
    }
  }
  throw new Error(`Spieldaten fehlen in ${projectPath(dataDir)} – erzeuge sie zuerst mit: node scripts/extract-game-data.mjs`);
}

const titleCollator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

function sortBuilds(builds) {
  return builds.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
    || titleCollator.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Doppelte IDs: alle Einträge mit dieser ID fallen weg (Fehler), damit nicht zufällig einer gewinnt.
function removeDuplicateIds(entries, errors, warnings) {
  const byId = new Map();
  for (const item of entries) {
    if (!byId.has(item.entry.id)) byId.set(item.entry.id, []);
    byId.get(item.entry.id).push(item);
  }
  const kept = [];
  for (const [id, items] of byId) {
    if (items.length === 1) {
      kept.push(items[0].entry);
      continue;
    }
    errors.push(`Doppelte ID „${id}“: ${items.map((i) => i.source).join(', ')}.`);
    warnings.push(`${id}: doppelte ID – alle ${items.length} Einträge wurden übersprungen.`);
  }
  return kept;
}

function warnDuplicateTitles(builds, warnings) {
  const byTitle = new Map();
  for (const build of builds) {
    const key = build.title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(build.id);
  }
  for (const [, ids] of byTitle) if (ids.length > 1) warnings.push(`Titel doppelt: ${ids.join(', ')} – bitte unterscheidbar benennen.`);
}

/** Anzahl der Einträge mit lokalem Vorschaubild <thumbsDir>/<id>.webp (nur für die Ausgabe; der Katalog kennt keine Bilder). */
async function countThumbs(builds, thumbsDir) {
  let count = 0;
  for (const build of builds) if (await exists(path.join(thumbsDir, `${build.id}.webp`))) count++;
  return count;
}

export function countBuilds(builds) {
  const byCategory = Object.fromEntries(CATEGORIES.map((slug) => [slug, 0]));
  for (const build of builds) byCategory[build.category] += 1;
  return { total: builds.length, byCategory };
}

/**
 * Baut den Katalog im Speicher. → { catalog, errors, notes, stats }
 * errors: Fehler (Einträge fehlen im Katalog); notes: Hinweise für die Konsole.
 */
export async function buildCatalog({ modulesDir = DEFAULT_MODULES_DIR, dataDir = DEFAULT_DATA_DIR, onProgress = null } = {}) {
  const started = performance.now();
  const version = await readGameDataVersion(dataDir);
  // Fingerabdruck vor dem Bauen: ändert sich eine Eingabe während des Laufs, gilt der Katalog danach als veraltet
  const inputs = await catalogInputs({ modulesDir, dataDir });
  const errors = [];
  const warnings = [];
  const notes = [];
  const collected = [];

  const { modules, notes: moduleNotes } = await findModules(modulesDir);
  notes.push(...moduleNotes);
  for (const [i, mod] of modules.entries()) {
    onProgress?.({ kind: 'module', index: i, total: modules.length, file: projectPath(mod.file) });
    const result = await catalogModule(mod, { dataDir });
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.entry) collected.push({ entry: result.entry, source: projectPath(mod.file) });
    else warnings.push(`${projectPath(mod.file)}: wegen Fehlern nicht im Katalog.`);
  }

  const builds = sortBuilds(removeDuplicateIds(collected, errors, warnings));
  warnDuplicateTitles(builds, warnings);
  const catalog = {
    generatedAt: new Date().toISOString(),
    version,
    inputs,
    counts: countBuilds(builds),
    warnings,
    builds,
  };
  return {
    catalog,
    errors,
    notes,
    stats: { modules: modules.length, durationMs: Math.round(performance.now() - started) },
  };
}

// Ein Eintrag je Zeile: kompakt (die Seite lädt die Datei bei jedem Aufruf) und trotzdem lesbar.
export function serializeCatalog(catalog) {
  const { builds, ...head } = catalog;
  const headJson = JSON.stringify(head, null, 2);
  const list = builds.length ? `[\n${builds.map((b) => `    ${JSON.stringify(b)}`).join(',\n')}\n  ]` : '[]';
  return `${headJson.slice(0, -2)},\n  "builds": ${list}\n}\n`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Windows: Umbenennen scheitert kurz, wenn gerade jemand die Zieldatei liest (EPERM/EBUSY) → kurz warten, neu versuchen.
async function renameWithRetry(from, to, attempts = 10) {
  for (let i = 1; ; i++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (i >= attempts || !['EPERM', 'EBUSY', 'EACCES'].includes(error.code)) throw error;
      await sleep(30 * i);
    }
  }
}

/** Schreibt Text atomar: Zwischendatei im selben Ordner, dann Umbenennen. */
export async function writeFileAtomic(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(temp, text, 'utf8');
  try {
    await renameWithRetry(temp, file);
  } catch (error) {
    await unlink(temp).catch((cleanupError) => console.error(`Zwischendatei ${temp} ließ sich nicht löschen: ${cleanupError.message}`));
    throw error;
  }
}

export async function writeCatalog(file, catalog) {
  await writeFileAtomic(file, serializeCatalog(catalog));
}

/**
 * Wie writeCatalog, lässt die Datei aber unberührt, wenn sich außer generatedAt nichts geändert hat (kein unnötiger
 * Unterschied im Repo). → true, wenn geschrieben wurde
 */
export async function writeCatalogIfChanged(file, catalog) {
  try {
    const { generatedAt: _old, ...previous } = await readJson(file);
    const { generatedAt: _new, ...next } = catalog;
    if (JSON.stringify(previous) === JSON.stringify(next)) return false;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  await writeCatalog(file, catalog);
  return true;
}

// ------------------------------------------------------------------ Ausgabe

function formatNumber(n) {
  return n.toLocaleString('de-CH');
}

export function summaryTable(catalog) {
  const titles = new Map(CATEGORY_INFO.map((c) => [c.slug, c.title]));
  const rows = CATEGORIES.map((slug) => {
    const builds = catalog.builds.filter((b) => b.category === slug);
    return [titles.get(slug) ?? slug, builds.length, builds.reduce((n, b) => n + b.blocks, 0)];
  });
  const all = catalog.builds;
  rows.push(['Gesamt', all.length, all.reduce((n, b) => n + b.blocks, 0)]);
  const header = ['Kategorie', 'Bauten', 'Blöcke'];
  const cells = [header, ...rows.map((r) => [r[0], ...r.slice(1).map(formatNumber)])];
  const widths = header.map((_, i) => Math.max(...cells.map((row) => String(row[i]).length)));
  const line = (row) => row.map((cell, i) => (i === 0 ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]))).join('  ');
  return [line(header), widths.map((w) => '─'.repeat(w)).join('  '), ...cells.slice(1, -1).map(line), widths.map((w) => '─'.repeat(w)).join('  '), line(cells[cells.length - 1])].join('\n');
}

// ------------------------------------------------------------------ Start

async function runThumbs(catalog, options) {
  const { makeThumbs } = await import('./make-thumbs.mjs');
  return makeThumbs({ catalog, outDir: options.thumbsDir, dataDir: options.dataDir, force: options.force, log: (line) => console.log(line) });
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
  const started = performance.now();
  let built;
  try {
    built = await buildCatalog({
      ...options,
      onProgress: (p) => {
        if (p.kind === 'module' && p.total > 0 && (p.index % 10 === 0 || p.index === p.total - 1)) console.log(`Prüfe Bau-Module … ${p.index + 1}/${p.total}`);
      },
    });
  } catch (error) {
    console.error(`Katalog nicht erzeugt: ${error.message}`);
    return 1;
  }
  const { catalog, errors, notes } = built;
  const written = await writeCatalogIfChanged(options.out, catalog);
  if (options.thumbs) {
    const thumbs = await runThumbs(catalog, options);
    errors.push(...thumbs.errors);
  }
  console.log(`\nBlock-Kompass · Katalog für Minecraft ${catalog.version}`);
  console.log(summaryTable(catalog));
  const withThumbs = await countThumbs(catalog.builds, options.thumbsDir);
  console.log(`Vorschaubilder (nur lokal, thumbs/): ${withThumbs} von ${catalog.builds.length}${withThumbs < catalog.builds.length && !options.thumbs ? ' (fehlende erzeugen: node scripts/build-catalog.mjs --thumbs)' : ''}`);
  if (!written) console.log('Katalog inhaltlich unverändert – Datei nicht neu geschrieben.');
  for (const note of notes) console.log(`Hinweis: ${note}`);
  if (catalog.warnings.length) {
    console.log(`Warnungen (${catalog.warnings.length}):`);
    for (const warning of catalog.warnings) console.log(`  ! ${warning}`);
  }
  if (errors.length) {
    console.error(`Fehler (${errors.length}):`);
    for (const error of errors) console.error(`  ✗ ${error}`);
  }
  console.log(`→ ${projectPath(options.out)} · Laufzeit ${((performance.now() - started) / 1000).toFixed(1).replace('.', ',')} s`);
  return errors.length ? 1 : 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`Katalog fehlgeschlagen: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
