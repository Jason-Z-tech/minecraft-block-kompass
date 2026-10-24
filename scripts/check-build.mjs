// Prüft ein Bau-Modul (§9, §10): baut es, prüft Zustände, Grenzen, Texte und meta, gibt Kennzahlen aus.
// Aufruf: node scripts/check-build.mjs <modulpfad> [--scale <zahl>] [--json] [--data <ordner>]
// Exit-Code 1 bei Fehlern.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setBlockData, validateState } from '../js/core/block-data.js';
import { setNames, itemName } from '../js/core/describe.js';
import { Builder } from '../js/core/builder.js';
import { formatAmount, stackSize } from '../js/core/materials.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CATEGORIES = ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'redstone', 'farmen', 'infrastruktur'];
export const ACCURACIES = ['original', 'massstab', 'vorlage', 'nachempfunden', 'eigenes'];
const META_KEYS = ['id', 'title', 'category', 'subtitle', 'tags', 'aliases', 'accuracy', 'difficulty', 'description', 'facts', 'sources', 'credits', 'scales', 'tested'];
const ID_PATTERN = /^[a-z0-9-]{2,80}$/;
const TOP_MATERIALS = 20;

export function parseArgs(argv) {
  const options = { modulePath: null, scale: null, json: false, dataDir: path.join(ROOT, 'game-data') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--scale') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value <= 0 || value > 16) throw new Error(`--scale braucht eine Zahl größer 0 (bis 16), bekommen: ${argv[i]}.`);
      options.scale = value;
    } else if (arg === '--data') {
      if (!argv[i + 1]) throw new Error('--data braucht einen Ordner.');
      options.dataDir = path.resolve(argv[++i]);
    } else if (arg.startsWith('--')) throw new Error(`Unbekannte Option ${arg}.`);
    else if (options.modulePath) throw new Error('Bitte nur ein Modul angeben.');
    else options.modulePath = arg;
  }
  if (!options.modulePath) throw new Error('Aufruf: node scripts/check-build.mjs <modulpfad> [--scale <zahl>] [--json] [--data <ordner>]');
  return options;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

// Lädt blocks.json (Pflicht) und names.json (sonst Warnung). Wirft mit Hinweis, wenn die Daten fehlen.
export async function loadGameData(dataDir) {
  const warnings = [];
  const blocksFile = path.join(dataDir, 'blocks.json');
  let blocks;
  try {
    blocks = await readJson(blocksFile);
  } catch (error) {
    const hint = error.code === 'ENOENT'
      ? `Spieldaten fehlen: ${path.relative(ROOT, blocksFile) || blocksFile}. Erzeuge sie zuerst mit: node scripts/extract-game-data.mjs`
      : `Spieldaten nicht lesbar (${path.relative(ROOT, blocksFile)}): ${error.message}`;
    throw new Error(hint);
  }
  setBlockData(blocks);
  try {
    setNames(await readJson(path.join(dataDir, 'names.json')));
  } catch (error) {
    warnings.push(`Namen fehlen (${error.code === 'ENOENT' ? 'names.json nicht gefunden' : error.message}) – es werden IDs angezeigt. Erzeugen mit: node scripts/extract-game-data.mjs`);
  }
  return { warnings, version: blocks.version ?? null };
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function checkHttps(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function checkTextList(meta, key, errors) {
  if (!Array.isArray(meta[key]) || meta[key].some((v) => !isNonEmptyText(v))) errors.push(`meta.${key} muss eine Liste aus nicht leeren Texten sein.`);
}

// Prüft meta nach §9. fileId = Dateiname ohne .js; folderCategory = Ordner unter js/builds/ (oder null).
export function validateMeta(meta, { fileId, folderCategory = null }) {
  const errors = [];
  const warnings = [];
  if (!meta || typeof meta !== 'object') return { errors: ['Das Modul exportiert kein meta-Objekt.'], warnings };
  for (const key of Object.keys(meta)) if (!META_KEYS.includes(key)) warnings.push(`meta.${key} ist unbekannt und wird ignoriert.`);
  if (typeof meta.id !== 'string' || !ID_PATTERN.test(meta.id)) errors.push('meta.id muss aus 2–80 Zeichen a–z, 0–9 und - bestehen.');
  else if (meta.id !== fileId) errors.push(`meta.id „${meta.id}“ muss dem Dateinamen „${fileId}“ entsprechen.`);
  for (const key of ['title', 'subtitle', 'description']) if (!isNonEmptyText(meta[key])) errors.push(`meta.${key} fehlt oder ist leer.`);
  if (!CATEGORIES.includes(meta.category)) errors.push(`meta.category muss eine von ${CATEGORIES.join(', ')} sein.`);
  else if (folderCategory && folderCategory !== meta.category) errors.push(`meta.category „${meta.category}“ passt nicht zum Ordner „${folderCategory}“.`);
  if (!ACCURACIES.includes(meta.accuracy)) errors.push(`meta.accuracy muss eine von ${ACCURACIES.join(', ')} sein.`);
  if (!Number.isInteger(meta.difficulty) || meta.difficulty < 1 || meta.difficulty > 5) errors.push('meta.difficulty muss eine ganze Zahl von 1 bis 5 sein.');
  for (const key of ['tags', 'aliases', 'facts']) checkTextList(meta, key, errors);
  if (Array.isArray(meta.aliases) && meta.aliases.some((a) => typeof a === 'string' && a !== a.toLowerCase())) warnings.push('meta.aliases sollten klein geschrieben sein (für die Suche).');
  checkSources(meta, errors);
  checkCredits(meta, errors);
  checkScales(meta, errors);
  if (meta.tested !== null && meta.tested !== undefined && typeof meta.tested !== 'boolean') errors.push('meta.tested muss null, true oder false sein.');
  if (['redstone', 'farmen'].includes(meta.category) && typeof meta.tested !== 'boolean') warnings.push('Redstone/Farmen: meta.tested sollte false sein („nicht im Spiel getestet“), solange es niemand im Spiel geprüft hat.');
  if (isNonEmptyText(meta.description) && meta.description.length > 700) warnings.push('meta.description ist lang – gedacht sind 2–4 Sätze.');
  return { errors, warnings };
}

function checkSources(meta, errors) {
  if (!Array.isArray(meta.sources)) {
    errors.push('meta.sources muss eine Liste sein (darf leer sein, außer bei „massstab“).');
    return;
  }
  meta.sources.forEach((source, i) => {
    if (!source || !isNonEmptyText(source.title)) errors.push(`meta.sources[${i}].title fehlt.`);
    if (!source || !checkHttps(source.url)) errors.push(`meta.sources[${i}].url muss eine https-Adresse sein.`);
  });
  if (meta.accuracy === 'massstab' && meta.sources.length === 0) errors.push('Bei accuracy „massstab“ braucht es mindestens eine Quelle (meta.sources).');
}

function checkCredits(meta, errors) {
  if (meta.credits === null || meta.credits === undefined) return;
  const c = meta.credits;
  if (typeof c !== 'object' || !isNonEmptyText(c.author) || !isNonEmptyText(c.license) || !checkHttps(c.url)) {
    errors.push('meta.credits muss null oder { author, url (https), license } sein.');
  }
}

function checkScales(meta, errors) {
  if (meta.scales === null || meta.scales === undefined) return;
  if (meta.accuracy !== 'massstab') errors.push('meta.scales gibt es nur bei accuracy „massstab“.');
  const ok = Array.isArray(meta.scales) && meta.scales.length > 0
    && meta.scales.every((s) => Number.isFinite(s) && s > 0 && s <= 16)
    && new Set(meta.scales).size === meta.scales.length;
  if (!ok) errors.push('meta.scales muss eine Liste verschiedener Zahlen größer 0 sein, z. B. [1, 0.5, 0.25].');
}

// Grobe Quelltext-Prüfung auf Verbotenes (§9: deterministisch, kein DOM, kein Netzwerk).
function scanSource(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const errors = [];
  if (/Math\.random\s*\(/.test(code)) errors.push('Das Modul nutzt Math.random() – nur b.rng() ist erlaubt (deterministisch).');
  if (/\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(|\bnew\s+(XMLHttpRequest|WebSocket)\b/.test(code)) errors.push('Das Modul nutzt Netzwerk-Zugriffe – nicht erlaubt.');
  if (/\b(document|window|localStorage|sessionStorage|navigator)\s*\./.test(code)) errors.push('Das Modul nutzt Browser-/DOM-APIs – nicht erlaubt.');
  if (/\bDate\.now\s*\(|\bnew\s+Date\s*\(/.test(code)) errors.push('Das Modul nutzt die aktuelle Zeit – das ist nicht deterministisch.');
  return errors;
}

const RELATIVE_IMPORT = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

// Modul plus alle Dateien unter js/builds/, die es (auch über Umwege) relativ importiert – z. B. die Hilfsbibliothek
// js/builds/lib/. Kern und 3D-Ansicht außerhalb von js/builds/ werden nicht durchsucht.
// within: Ordner, dessen Dateien mitgeprüft werden (Standard js/builds/, für Tests änderbar).
export async function collectBuildSources(entry, { within = path.join(ROOT, 'js', 'builds') } = {}) {
  const buildsDir = path.resolve(within) + path.sep;
  const seen = new Set();
  const queue = [path.resolve(entry)];
  const files = [];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    files.push({ file, source });
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const target = path.resolve(path.dirname(file), match[1]);
      if (target.startsWith(buildsDir) && !seen.has(target)) queue.push(target);
    }
  }
  return files;
}

export async function scanBuildSources(absolute, options) {
  const errors = [];
  for (const [i, { file, source }] of (await collectBuildSources(absolute, options)).entries()) {
    const found = scanSource(source);
    if (i === 0) errors.push(...found);
    else errors.push(...found.map((e) => `${path.relative(ROOT, file).split(path.sep).join('/')} (importiert): ${e.replace(/^Das Modul/, 'Die Datei')}`));
  }
  return errors;
}

function fingerprint(result) {
  let h = 2166136261;
  const mix = (n) => {
    h = Math.imul(h ^ n, 16777619);
  };
  for (const state of result.volume.palette) for (let i = 0; i < state.length; i++) mix(state.charCodeAt(i));
  for (const chunk of result.volume.chunkList()) {
    mix(chunk.cx); mix(chunk.cy); mix(chunk.cz);
    for (let i = 0; i < 4096; i++) mix(chunk.blocks[i] * 65536 + chunk.steps[i]);
  }
  return h >>> 0;
}

function runBuild(build, scale) {
  const b = new Builder();
  const returned = build(b, { scale });
  if (returned && typeof returned.then === 'function') throw new Error('build() darf nicht async sein.');
  return b.finalize();
}

function chooseScale(meta, requested, errors) {
  const scales = Array.isArray(meta?.scales) ? meta.scales : null;
  if (requested === null) return scales && !scales.includes(1) ? scales[0] : 1;
  if (scales && !scales.includes(requested)) errors.push(`Maßstab ${requested} ist nicht erlaubt (meta.scales: ${scales.join(', ')}).`);
  if (!scales && requested !== 1) errors.push('Das Modul hat keine meta.scales – nur Maßstab 1 ist möglich.');
  return requested;
}

function checkResult(result, errors, warnings) {
  for (const state of result.volume.palette.slice(1)) {
    const check = validateState(state);
    if (!check.ok) errors.push(...check.errors);
  }
  if (result.blockCount === 0) errors.push('Der Bau enthält keine Blöcke.');
  for (const phase of result.phases) {
    if (!phase.text) warnings.push(`Kapitel „${phase.title}“ hat keinen Text.`);
    if (phase.steps.length === 0) warnings.push(`Kapitel „${phase.title}“ hat keine Schritte (keine Blöcke).`);
  }
  for (const step of result.steps) if (step.blockCount === 0) warnings.push(`Schritt „${step.title}“ setzt keine Blöcke.`);
  warnings.push(...result.warnings);
}

function materialRows(materials) {
  return materials.map(([item, count]) => ({ item, name: itemName(item), count, amount: formatAmount(count, stackSize(item)) }));
}

// Baut und prüft ein Modul; gibt einen Bericht zurück (wirft nur bei fehlenden Spieldaten).
export async function checkBuild(modulePath, { scale = null, dataDir = path.join(ROOT, 'game-data') } = {}) {
  const started = performance.now();
  const absolute = path.resolve(modulePath);
  const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
  const report = { ok: false, module: relative, id: null, title: null, category: null, scale: null, size: null, blockCount: 0, phases: 0, steps: 0, phaseList: [], materials: [], topMaterials: [], warnings: [], errors: [], durationMs: 0 };
  const data = await loadGameData(dataDir);
  report.warnings.push(...data.warnings);
  let mod;
  try {
    mod = await import(pathToFileURL(absolute).href);
  } catch (error) {
    report.errors.push(`Modul lässt sich nicht laden: ${error.message}`);
    return finish(report, started);
  }
  const folder = relative.match(/^js\/builds\/([^/]+)\/[^/]+\.js$/)?.[1] ?? null;
  const meta = validateMeta(mod.meta, { fileId: path.basename(absolute, '.js'), folderCategory: folder });
  report.errors.push(...meta.errors);
  report.warnings.push(...meta.warnings);
  Object.assign(report, { id: mod.meta?.id ?? null, title: mod.meta?.title ?? null, category: mod.meta?.category ?? null });
  report.errors.push(...await scanBuildSources(absolute));
  if (typeof mod.default !== 'function') {
    report.errors.push('Das Modul exportiert keine build-Funktion (export default function build(b, { scale })).');
    return finish(report, started);
  }
  report.scale = chooseScale(mod.meta, scale, report.errors);
  let result;
  try {
    result = runBuild(mod.default, report.scale);
    if (fingerprint(runBuild(mod.default, report.scale)) !== fingerprint(result)) {
      report.errors.push('Das Modul ist nicht deterministisch: zwei Durchläufe ergeben verschiedene Bauten.');
    }
  } catch (error) {
    report.errors.push(`Bau fehlgeschlagen: ${error.message}`);
    return finish(report, started);
  }
  checkResult(result, report.errors, report.warnings);
  Object.assign(report, {
    size: result.size, blockCount: result.blockCount, phases: result.phases.length, steps: result.steps.length,
    phaseList: result.phases.map((p) => ({ title: p.title, steps: p.steps.length })),
    materials: materialRows(result.materials),
  });
  report.topMaterials = report.materials.slice(0, TOP_MATERIALS);
  return finish(report, started);
}

function finish(report, started) {
  report.ok = report.errors.length === 0;
  report.durationMs = Math.round(performance.now() - started);
  return report;
}

function printReport(report) {
  const lines = [`Block-Kompass · Prüfung von ${report.module}`];
  if (report.title) lines.push(`Titel: ${report.title} (${report.id}, Kategorie ${report.category})`);
  if (report.scale !== null) lines.push(`Maßstab: ${report.scale}`);
  if (report.size) {
    lines.push(`Größe: ${report.size[0]} × ${report.size[1]} × ${report.size[2]} Blöcke (Breite x × Höhe y × Länge z)`);
    lines.push(`Blöcke: ${report.blockCount.toLocaleString('de-CH')}`);
    lines.push(`Kapitel: ${report.phases} · Schritte: ${report.steps}`);
    for (const phase of report.phaseList) lines.push(`  · ${phase.title}: ${phase.steps} ${phase.steps === 1 ? 'Schritt' : 'Schritte'}`);
    lines.push(`Material (Top ${Math.min(TOP_MATERIALS, report.materials.length)} von ${report.materials.length}):`);
    const width = Math.max(...report.topMaterials.map((m) => `${m.name} (${m.item})`.length), 10);
    report.topMaterials.forEach((m, i) => {
      lines.push(`  ${String(i + 1).padStart(2)}. ${`${m.name} (${m.item})`.padEnd(width)}  ${String(m.count).padStart(7)}  = ${m.amount}`);
    });
  }
  lines.push(`Warnungen (${report.warnings.length}):${report.warnings.length ? '' : ' keine'}`);
  for (const w of report.warnings) lines.push(`  ! ${w}`);
  lines.push(`Fehler (${report.errors.length}):${report.errors.length ? '' : ' keine'}`);
  for (const e of report.errors) lines.push(`  ✗ ${e}`);
  lines.push(`Ergebnis: ${report.ok ? 'OK' : 'FEHLER'} (${report.durationMs} ms)`);
  console.log(lines.join('\n'));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  try {
    const report = await checkBuild(options.modulePath, options);
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    process.exit(report.ok ? 0 : 1);
  } catch (error) {
    if (options.json) console.log(JSON.stringify({ ok: false, module: options.modulePath, errors: [error.message] }, null, 2));
    else console.error(error.message);
    process.exit(1);
  }
}
