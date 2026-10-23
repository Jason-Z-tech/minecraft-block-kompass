// Screenshots der 3D-Ansicht über Chrome (Sichtprüfung, ARCHITEKTUR §10). Nur Node-Bordmittel.
// node scripts/shot.mjs --module <pfad> | --structure <datei> | --gallery <gruppe|all> | --synthetic <anzahl>
//   [--views iso,front,top,side] [--progress 25,50,75] [--clip <ebene y>] [--ghost] [--highlight <schritt>]
//   [--size 1280x800] [--page <n>] [--out tmp/shots] [--gpu hardware|swiftshader] [--bench <sekunden>]
// Startet den lokalen Server (freier Port) und Chrome (Grafikkarte, Rückfall Software-WebGL), wartet auf das
// Fertig-Signal der Testseite (tests/visual/viewer.html) und speichert PNGs nach <out>/<name>/.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser } from '../tests/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWS = ['iso', 'top', 'front', 'side'];
const GALLERY_PAGE_SIZE = 100;
const READY = 'window.__viewerTest && (window.__viewerTest.ready || window.__viewerTest.error)';

const USAGE = `Aufruf: node scripts/shot.mjs --module <pfad> | --structure <datei> | --gallery <gruppe|all> | --synthetic <anzahl>
  --views iso,front,top,side   Ansichten (Standard: iso,front,top)
  --progress 25,50,75          zusätzlich Bilder bei diesen Prozent der Schritte
  --clip <y>                   Schnittansicht bis Ebene y (Block-y, 0 = unterste Ebene)
  --ghost                      künftige Blöcke als Geist zeigen (sinnvoll mit --progress)
  --highlight <schritt>        Schritt hervorheben
  --size 1280x800              Bildgröße in Pixeln
  --page <n>                   Galerie-Seite (bei --gallery all; ohne Angabe alle Seiten)
  --out tmp/shots              Zielordner
  --gpu hardware|swiftshader   Grafik (Standard hardware, Rückfall swiftshader)
  --rows                       Galerie: zusätzlich eine Nahaufnahme je Reihe (row-<n>.png)
  --focus x,y,z[,r]            zusätzlich eine Nahaufnahme um Block (x, y, z) mit Rand r (Standard 0)
  --bench <sekunden>           Kamera dreht, FPS messen`;

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

function fail(message) {
  throw new UsageError(message);
}

function listOf(value, label, check) {
  const items = value.split(',').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0 || !items.every(check)) fail(`Ungültige Angabe für ${label}: ${value}`);
  return items;
}

export function parseArgs(argv) {
  const options = {
    views: ['iso', 'front', 'top'], progress: [], clip: null, ghost: false, highlight: null, size: [1280, 800], page: null,
    out: path.join(ROOT, 'tmp', 'shots'), gpu: 'hardware', bench: null, rows: false, focus: [], source: null,
  };
  const take = (i) => {
    if (i + 1 >= argv.length) fail(`${argv[i]} braucht einen Wert.`);
    return argv[i + 1];
  };
  const setSource = (source) => {
    if (options.source) fail('Nur eine Quelle angeben.');
    options.source = source;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--module': {
        const value = take(i++);
        if (!/^[a-z0-9\-/]+\.js$/.test(value)) fail(`Ungültiger Modulpfad: ${value}`);
        setSource({ key: 'module', value, name: path.basename(value, '.js') });
        break;
      }
      case '--structure': {
        const value = take(i++);
        if (!/^[a-z0-9_]+\.json$/.test(value)) fail(`Ungültiger Strukturname: ${value}`);
        setSource({ key: 'structure', value, name: path.basename(value, '.json') });
        break;
      }
      case '--gallery': {
        const value = take(i++);
        if (!/^[a-z]{1,20}$/.test(value)) fail(`Ungültige Galerie: ${value}`);
        setSource({ key: 'gallery', value, name: `gallery-${value}` });
        break;
      }
      case '--synthetic': {
        const value = Number(take(i++));
        if (!Number.isInteger(value) || value < 1 || value > 2_000_000) fail('--synthetic braucht eine ganze Zahl von 1 bis 2000000.');
        setSource({ key: 'synthetic', value: String(value), name: `synthetic-${value}` });
        break;
      }
      case '--views': options.views = listOf(take(i++), '--views', (v) => VIEWS.includes(v)); break;
      case '--progress': options.progress = listOf(take(i++), '--progress', (v) => /^\d+(\.\d+)?$/.test(v) && Number(v) <= 100).map(Number); break;
      case '--clip': {
        const value = Number(take(i++));
        if (!Number.isInteger(value) || value < 0 || value > 4096) fail('--clip braucht eine ganze Zahl ≥ 0.');
        options.clip = value;
        break;
      }
      case '--ghost': options.ghost = true; break;
      case '--rows': options.rows = true; break;
      case '--focus': {
        const parts = take(i++).split(',').map(Number);
        if ((parts.length !== 3 && parts.length !== 4) || !parts.every((v) => Number.isInteger(v) && Math.abs(v) <= 16384) || (parts[3] ?? 0) < 0) {
          fail('--focus braucht x,y,z oder x,y,z,r (ganze Zahlen).');
        }
        options.focus.push(parts);
        break;
      }
      case '--highlight': {
        const value = Number(take(i++));
        if (!Number.isInteger(value) || value < 0 || value > 65534) fail('--highlight braucht eine Schrittnummer.');
        options.highlight = value;
        break;
      }
      case '--size': {
        const match = /^(\d{2,4})x(\d{2,4})$/.exec(take(i++));
        if (!match) fail('--size braucht BREITExHÖHE, z. B. 1280x800.');
        options.size = [Number(match[1]), Number(match[2])];
        break;
      }
      case '--page': {
        const value = Number(take(i++));
        if (!Number.isInteger(value) || value < 0 || value > 999) fail('--page braucht eine ganze Zahl ≥ 0.');
        options.page = value;
        break;
      }
      case '--out': options.out = path.resolve(take(i++)); break;
      case '--gpu': {
        const value = take(i++);
        if (!['hardware', 'swiftshader'].includes(value)) fail('--gpu: hardware oder swiftshader.');
        options.gpu = value;
        break;
      }
      case '--bench': {
        const value = Number(take(i++));
        if (!(value >= 0.5 && value <= 60)) fail('--bench braucht Sekunden von 0,5 bis 60.');
        options.bench = value;
        break;
      }
      case '--help': case '-h': options.help = true; break;
      default: fail(`Unbekannte Option: ${arg}`);
    }
  }
  if (!options.source && !options.help) fail('Es fehlt die Quelle (--module, --structure, --gallery oder --synthetic).');
  return options;
}

async function openPage(gpu, size) {
  const page = await launchBrowser({ gpu, width: size[0], height: size[1] });
  const hasWebGl2 = await page.eval('(() => { const c = document.createElement("canvas"); return Boolean(c.getContext("webgl2")); })()');
  if (!hasWebGl2) {
    await page.close();
    return null;
  }
  const renderer = await page.eval(`(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  })()`);
  return { page, renderer, gpu };
}

async function loadSource(browser, server, query) {
  const { page } = browser;
  await page.goto(`${server.url}/tests/visual/viewer.html?${query}&ui=0`);
  await page.waitFor(READY, 300000, 250);
  const state = await page.eval('JSON.parse(JSON.stringify(window.__viewerTest))');
  if (state.error) throw new Error(`Testseite meldet: ${state.error}`);
  return state;
}

async function applyState(page, { progress, clip, ghost, highlight, view }) {
  await page.eval(`(async () => {
    const v = window.__viewer;
    v.setView(${JSON.stringify(view)}, { animate: false });
    v.setProgress(${progress === null ? 'v.stepCount' : `v.stepCount * ${progress} / 100`});
    v.setClip(${clip === null ? 'null' : `{ maxY: ${clip} }`});
    v.setGhost(${ghost});
    v.setHighlightStep(${highlight === null ? 'null' : highlight});
    await v.idle();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  })()`);
}

// Kamera auf eine Box (inklusive Blockgrenzen) ausrichten, z. B. eine Galerie-Reihe.
async function frameBox(page, box, view) {
  await page.eval(`(async () => {
    const { orbitForView, sceneBounds } = await import('/js/render/renderer.js');
    const canvas = document.getElementById('view');
    const bounds = sceneBounds(${JSON.stringify({ min: box.min, max: box.max })});
    window.__viewer.controls.orbit.setView(orbitForView(${JSON.stringify(view)}, bounds, canvas.width / canvas.height), { animate: false });
    await window.__viewer.idle();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  })()`);
}

function fileName({ view, progress, clip, ghost, highlight }) {
  return [view, progress !== null ? `p${progress}` : null, clip !== null ? `clip${clip}` : null, ghost ? 'ghost' : null, highlight !== null ? `h${highlight}` : null]
    .filter(Boolean).join('-') + '.png';
}

async function shootSource(browser, server, options, query, folder) {
  const started = Date.now();
  const state = await loadSource(browser, server, query);
  const dir = path.join(options.out, folder);
  await mkdir(dir, { recursive: true });
  const files = [];
  const progressList = [null, ...options.progress];
  for (const progress of progressList) {
    for (const view of options.views) {
      const shot = { view, progress, clip: options.clip, ghost: options.ghost, highlight: options.highlight };
      await applyState(browser.page, shot);
      const file = path.join(dir, fileName(shot));
      await browser.page.screenshot(file);
      files.push(path.relative(ROOT, file));
    }
  }
  const rows = state.result.gallery?.rows ?? [];
  if (options.rows && rows.length) {
    await applyState(browser.page, { view: 'iso', progress: null, clip: null, ghost: false, highlight: null });
    for (let i = 0; i < rows.length; i++) {
      await frameBox(browser.page, rows[i], 'iso');
      const file = path.join(dir, `row-${String(i).padStart(2, '0')}.png`);
      await browser.page.screenshot(file);
      files.push(`${path.relative(ROOT, file)}  (${rows[i].title})`);
    }
  }
  for (const [x, y, z, r = 0] of options.focus) {
    await applyState(browser.page, { view: 'iso', progress: null, clip: options.clip, ghost: false, highlight: null });
    await frameBox(browser.page, { min: [x - r, y - r, z - r], max: [x + r, y + r, z + r] }, 'iso');
    const file = path.join(dir, `focus-${x}_${y}_${z}${r ? `_${r}` : ''}.png`);
    await browser.page.screenshot(file);
    files.push(path.relative(ROOT, file));
  }
  let bench = null;
  if (options.bench) {
    bench = await browser.page.eval(`(async () => {
      const v = window.__viewer;
      v.setProgress(v.stepCount);
      v.setClip(null);
      v.setGhost(false);
      await v.idle();
      const orbit = v.controls.orbit;
      let yaw = orbit.orbit.yaw;
      const frames = [];
      const start = performance.now();
      while (performance.now() - start < ${options.bench * 1000}) {
        yaw += 0.01;
        orbit.setView({ yaw }, { animate: false });
        await new Promise((r) => requestAnimationFrame(r));
        frames.push(performance.now());
      }
      const gaps = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
      const seconds = (frames[frames.length - 1] - frames[0]) / 1000;
      return { fps: Math.round((frames.length - 1) / seconds * 10) / 10, medianFrameMs: Math.round(gaps[gaps.length >> 1] * 10) / 10,
        p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10, frameCpuMs: v.stats.frameCpuMs, drawnChunks: v.stats.drawnChunks };
    })()`);
  }
  const stats = await browser.page.eval('JSON.parse(JSON.stringify(window.__viewer.stats))');
  return { state, stats, files, bench, seconds: (Date.now() - started) / 1000 };
}

// Reihen der Galerie (von Norden nach Süden) mit ihren Einträgen (von Westen nach Osten), damit man sie im Bild wiederfindet.
function galleryLayout(result) {
  if (!result.gallery) return null;
  const { rows, items } = result.gallery;
  return rows.map((row, i) => `  ${String(i).padStart(2, '0')} ${row.title}: ${items.filter((e) => e.row === i).sort((a, b) => a.x - b.x).map((e) => e.label).join(' | ')}`).join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }
  const server = await startServer({ port: 0 });
  let browser = null;
  let failed = false;
  try {
    browser = await openPage(options.gpu, options.size);
    if (!browser && options.gpu === 'hardware') {
      console.warn('Grafikkarte liefert kein WebGL2 – weiter mit Software-WebGL (swiftshader).');
      browser = await openPage('swiftshader', options.size);
    }
    if (!browser) throw new Error('Chrome liefert kein WebGL2 (auch nicht mit swiftshader).');
    console.log(`Chrome: ${browser.gpu} · ${browser.renderer}`);
    const { key, value, name } = options.source;
    const jobs = [];
    if (key === 'gallery' && value === 'all' && options.page === null) {
      // Seitenzahl aus der Blockliste (die Galerie zeigt GALLERY_PAGE_SIZE Blöcke je Seite)
      const { readFile } = await import('node:fs/promises');
      const blocks = JSON.parse(await readFile(path.join(ROOT, 'game-data', 'blocks.json'), 'utf8')).blocks;
      const count = Object.keys(blocks).filter((id) => !['air', 'cave_air', 'void_air'].includes(id)).length;
      for (let page = 0; page < Math.ceil(count / GALLERY_PAGE_SIZE); page++) jobs.push({ query: `gallery=all&page=${page}`, folder: `${name}-${page}` });
    } else {
      const pageQuery = key === 'gallery' && options.page !== null ? `&page=${options.page}` : '';
      jobs.push({ query: `${key}=${encodeURIComponent(value)}${pageQuery}`, folder: key === 'gallery' && options.page !== null ? `${name}-${options.page}` : name });
    }
    for (const job of jobs) {
      const run = await shootSource(browser, server, options, job.query, job.folder);
      const { result } = run.state;
      console.log(`\n${job.folder}: ${result.size.join(' × ')} · ${result.blockCount} Blöcke · ${result.steps} Schritte · ${run.stats.quads} Quads · ${run.stats.chunks} Chunks · ${run.stats.textureLayers} Textur-Ebenen`);
      if (run.stats.missingTextures.length) console.log(`  Fehlende Texturen (${run.stats.missingTextures.length}): ${run.stats.missingTextures.join(', ')}`);
      console.log(`  Zeiten: Bauen ${run.stats.buildMs} ms · Texturen ${run.stats.textureMs} ms · Meshing ${run.stats.meshMs} ms · Laden ${run.stats.loadMs} ms (Lauf ${run.seconds.toFixed(1)} s)`);
      if (run.bench) console.log(`  Leistung: ${run.bench.fps} FPS · Median ${run.bench.medianFrameMs} ms · 95 % ${run.bench.p95FrameMs} ms · CPU je Bild ${run.bench.frameCpuMs} ms · ${run.bench.drawnChunks} Chunks gezeichnet`);
      if (result.warnings.length) console.log(`  Warnungen (${result.warnings.length}):\n    ${result.warnings.slice(0, 20).join('\n    ')}`);
      if (run.stats.warnings.length) console.log(`  Hinweise der Modelle (${run.stats.warnings.length}):\n    ${run.stats.warnings.slice(0, 20).join('\n    ')}`);
      const layout = galleryLayout(result);
      if (layout) console.log(`  Galerie-Reihen (Norden → Süden, Einträge Westen → Osten):\n${layout}`);
      for (const file of run.files) console.log(`  → ${file}`);
    }
    const errors = browser.page.errors.filter((e) => !/favicon\.ico/.test(e));
    if (errors.length) {
      failed = true;
      console.error(`\nBrowser-Fehler (${errors.length}):\n  ${errors.join('\n  ')}`);
    }
  } finally {
    await browser?.page.close();
    await server.close();
  }
  if (failed) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(`Screenshots fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  });
}
