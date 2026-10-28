// Lokaler Spiegel der festen Spieldaten-Dateien aus misode/mcmeta (für Tests des Online-Modus ohne Netz):
// alle festen Dateien aus js/data/sources.js (Zusammenfassungen, Atlanten, Sprachdateien, die .png.mcmeta der
// Liste MCMETA_TEXTURES).
// Ablage: <out>/<voller Commit-SHA>/<pfad im Repo>, genau wie auf raw.githubusercontent.com. Vorhandenes bleibt.
// Aufruf: node scripts/mirror-mcmeta.mjs [--out tmp/mcmeta-mirror] [--force]

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allFixedFiles, mcmetaUrl, isValidMcmetaPath, MCMETA_COMMITS } from '../js/data/sources.js';
import { fetchBytes, createLimiter } from '../js/data/net.js';
import { proxyRelaunchPlan } from './lib/remote-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_MIRROR_DIR = path.join(ROOT, 'tmp', 'mcmeta-mirror');
const CONCURRENCY = 6;

const USAGE = [
  'Aufruf: node scripts/mirror-mcmeta.mjs [--out <ordner>] [--force]',
  '',
  'Lädt die festen Spieldaten-Dateien von raw.githubusercontent.com/misode/mcmeta in einen lokalen Spiegel',
  '(Standard: tmp/mcmeta-mirror/<commit>/<pfad>). Vorhandene Dateien werden übersprungen.',
  '  --out <ordner>   Zielordner',
  '  --force          vorhandene Dateien neu laden',
].join('\n');

// Alle Dateien des Spiegels: [{ key, commit, path, limit }] (die festen Dateien aus js/data/sources.js).
export function mirrorFileList() {
  return allFixedFiles();
}

// Ablageort einer Datei im Spiegel; wirft bei unbekanntem Commit oder unsicherem Pfad.
export function mirrorFilePath(mirrorDir, commit, repoPath) {
  if (!Object.values(MCMETA_COMMITS).includes(commit)) throw new Error(`Unbekannter Commit „${String(commit).slice(0, 60)}“.`);
  if (!isValidMcmetaPath(repoPath)) throw new Error(`Ungültiger Pfad „${String(repoPath).slice(0, 80)}“.`);
  const base = path.resolve(mirrorDir);
  const target = path.resolve(base, commit, ...repoPath.split('/'));
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Pfad außerhalb des Spiegels: ${repoPath}`);
  return target;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(bytes ? 1 : 0, Math.round(bytes / 1024)).toLocaleString('de-CH')} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('de-CH', { maximumFractionDigits: 1 })} MB`;
}

// → { total, downloaded, skipped, bytes, failed: [{ path, message }] }
export async function mirrorMcmeta({
  outDir = DEFAULT_MIRROR_DIR, force = false, files = mirrorFileList(), fetch = globalThis.fetch,
  concurrency = CONCURRENCY, log = console.log, netOptions = {},
} = {}) {
  const limit = createLimiter(concurrency);
  const result = { total: files.length, downloaded: 0, skipped: 0, bytes: 0, failed: [] };
  let finished = 0;
  await Promise.all(files.map((file) => limit(async () => {
    try {
      const target = mirrorFilePath(outDir, file.commit, file.path);
      if (!force && existsSync(target)) {
        result.skipped++;
        return;
      }
      const bytes = await fetchBytes(mcmetaUrl(file.key, file.path), { maxBytes: file.limit, fetch, ...netOptions });
      await fs.mkdir(path.dirname(target), { recursive: true });
      // Erst vollständig schreiben, dann umbenennen: ein Abbruch hinterlässt keine halbe Datei unter dem echten Namen.
      const partial = `${target}.part-${process.pid}`;
      await fs.writeFile(partial, bytes);
      await fs.rename(partial, target);
      result.downloaded++;
      result.bytes += bytes.length;
    } catch (error) {
      result.failed.push({ path: `${file.commit.slice(0, 7)}/${file.path}`, message: error.message });
    } finally {
      finished++;
      if (finished % 50 === 0 && finished < files.length) log(`  … ${finished}/${files.length}`);
    }
  })));
  result.failed.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return result;
}

// Node-fetch ignoriert HTTPS_PROXY ohne --use-env-proxy: dann einmal damit neu starten. → true, wenn der Kindprozess lief.
function relaunchWithEnvProxy() {
  const plan = proxyRelaunchPlan();
  if (plan.warn) console.warn(`Hinweis: ${plan.reason}. Downloads können am Proxy scheitern.`);
  if (!plan.relaunch) return false;
  console.log(`${plan.reason} – starte mit --use-env-proxy neu, damit die Downloads über den Proxy laufen.`);
  const result = spawnSync(process.execPath, ['--use-env-proxy', ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  return true;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: { out: { type: 'string' }, force: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } },
      strict: true,
    });
    if (values.help) console.log(USAGE);
    else if (!relaunchWithEnvProxy()) {
      const outDir = path.resolve(values.out ?? DEFAULT_MIRROR_DIR);
      const files = mirrorFileList();
      const started = performance.now();
      console.log(`Spiegel ${path.relative(process.cwd(), outDir) || '.'}: ${files.length} Dateien (${CONCURRENCY} gleichzeitig) …`);
      const result = await mirrorMcmeta({ outDir, force: values.force, files });
      const seconds = ((performance.now() - started) / 1000).toLocaleString('de-CH', { maximumFractionDigits: 1 });
      console.log(`Geladen: ${result.downloaded} (${formatBytes(result.bytes)}), schon da: ${result.skipped}, Fehler: ${result.failed.length} – ${seconds} s.`);
      for (const { path: file, message } of result.failed.slice(0, 20)) console.error(`  ✗ ${file}: ${message}`);
      if (result.failed.length > 20) console.error(`  … und ${result.failed.length - 20} weitere`);
      if (result.failed.length > 0) process.exitCode = 1;
    }
  } catch (error) {
    const unknown = error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' || error.code === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL';
    console.error(unknown ? `Fehler: unbekannte Angabe (${error.message})` : `Fehler: ${error.message}`);
    if (unknown) console.log(USAGE);
    process.exitCode = 1;
  }
}
