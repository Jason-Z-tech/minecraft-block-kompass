// Ein Befehl zum Starten: prüft die Spieldaten (fehlen sie, werden sie erzeugt), prüft, ob der Katalog zu den
// Bau-Modulen passt (sonst neu bauen), und startet den lokalen Server.
//   node scripts/start.mjs [--port 8080] [--remote] [--no-thumbs]
// Spieldaten: aus der Minecraft-Installation (nur lesend); ohne Installation oder wenn das scheitert automatisch aus
// öffentlichen Quellen (siehe README „Ohne Minecraft“).
// --remote: immer aus öffentlichen Quellen laden, auch wenn Minecraft installiert ist.
// --no-thumbs: keine Vorschaubilder rendern (braucht dann kein Chrome); die lokale Seite zeigt dann Kategorie-Icons.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';
import { defaultSourcePaths } from './extract-game-data.mjs';
import { catalogInputs, DEFAULT_OUT as CATALOG } from './build-catalog.mjs';
import { CATEGORIES } from './check-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_DATA = path.join(ROOT, 'game-data');
const BUILDS_DIR = path.join(ROOT, 'js', 'builds');
const THUMBS_DIR = path.join(ROOT, 'thumbs');
const DEFAULT_PORT = 8080;
const PORT_TRIES = 10;
const REQUIRED_DATA = ['meta.json', 'blocks.json', 'names.json', 'models.json', 'textures.json', 'textures.bin', 'structures/index.json'];
// Kategorie-Ordner wie in check-build (eine Liste für alle Skripte)
const CATEGORY_DIRS = CATEGORIES;

export function parseStartArgs(argv) {
  const options = { port: DEFAULT_PORT, portGiven: false, remote: false, thumbs: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--remote') options.remote = true;
    else if (arg === '--no-thumbs') options.thumbs = false;
    else if (arg === '--port') {
      const port = Number(argv[++i]);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`Ungültiger Port „${argv[i] ?? ''}“ – erlaubt sind ganze Zahlen von 1024 bis 65535.`);
      options.port = port;
      options.portGiven = true;
    } else throw new Error(`Unbekannte Option „${arg}“. Erlaubt: --port <zahl>, --remote, --no-thumbs`);
  }
  return options;
}

/** Fehlende oder unbrauchbare Spieldaten → Liste der Gründe (leer = alles da). */
export function checkGameData(dir = GAME_DATA) {
  const problems = REQUIRED_DATA.filter((file) => !existsSync(path.join(dir, file))).map((file) => `${file} fehlt`);
  if (problems.length) return problems;
  try {
    const meta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    if (meta.version !== '26.2') problems.push(`meta.json nennt Version ${meta.version} statt 26.2`);
  } catch (error) {
    problems.push(`meta.json ist nicht lesbar (${error.message})`);
  }
  return problems;
}

function moduleFiles(buildsDir = BUILDS_DIR) {
  const files = [];
  for (const category of CATEGORY_DIRS) {
    const dir = path.join(buildsDir, category);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) if (name.endsWith('.js')) files.push(`js/builds/${category}/${name}`);
  }
  return files.sort();
}

/**
 * Passt der Katalog (data/catalog.json) zu Modulen und Spieldaten? → { fresh, reason, missing }
 * Veraltet, wenn er fehlt, kaputt ist oder sein Fingerabdruck („inputs“, siehe build-catalog.mjs) nicht mehr zum
 * Quelltext oder zu den Spieldaten passt. Fehlen Module im Katalog, obwohl er aktuell ist, hatten sie beim letzten Lauf
 * Fehler: dann nicht endlos neu bauen, nur melden. inputs: für Tests, sonst aus den Dateien berechnet.
 */
export async function checkCatalog({ root = ROOT, catalogFile = CATALOG, inputs = null } = {}) {
  if (!existsSync(catalogFile)) return { fresh: false, reason: 'Der Katalog fehlt.', missing: [] };
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
  } catch (error) {
    return { fresh: false, reason: `Der Katalog ist nicht lesbar (${error.message}).`, missing: [] };
  }
  if (!Array.isArray(catalog.builds)) return { fresh: false, reason: 'Der Katalog hat ein unbekanntes Format.', missing: [] };
  const current = inputs ?? await catalogInputs();
  const changed = [];
  if (catalog.inputs?.code !== current.code) changed.push('Bau-Module oder Kern');
  if (catalog.inputs?.data !== current.data) changed.push('Spieldaten');
  if (changed.length) return { fresh: false, reason: `Geändert seit dem letzten Katalog: ${changed.join(' und ')}.`, missing: [] };
  const listed = new Set(catalog.builds.map((build) => build.module).filter(Boolean));
  const missing = moduleFiles(path.join(root, 'js', 'builds')).filter((file) => !listed.has(file));
  return { fresh: true, reason: null, missing };
}

/** Minecraft-Jar 26.2 am Standardort → Pfad, sonst null. */
export function findMinecraftJar(jarPath = defaultSourcePaths().jar) {
  return statSync(jarPath, { throwIfNoEntry: false })?.isFile() ? jarPath : null;
}

/**
 * Sorgt für vollständige Spieldaten. Mit Minecraft-Installation: daraus lesen; ohne (oder wenn das scheitert) und mit
 * --remote: aus öffentlichen Quellen laden. → 'present' | 'local' | 'remote', sonst Error.
 * run(script, args) → Exit-Code, check() → Liste der Probleme (für Tests austauschbar).
 */
export function ensureGameData({ remote = false, run = runNode, check = checkGameData, minecraftJar = findMinecraftJar, log = console.log } = {}) {
  const problems = check();
  if (!problems.length) {
    log('✓ Spieldaten vorhanden (game-data/)');
    return 'present';
  }
  log(`Spieldaten fehlen (${problems.join(', ')}).`);
  const jar = remote ? null : minecraftJar();
  if (jar) {
    log(`Lese sie aus deiner Minecraft-Installation (nur lesend): ${jar} …\n`);
    if (run('scripts/extract-game-data.mjs', []) === 0 && check().length === 0) return 'local';
    log('\nAus der Installation ging es nicht (Meldung oben). Lade die Spieldaten stattdessen aus öffentlichen Quellen …\n');
  } else if (remote) {
    log('Lade sie aus öffentlichen Quellen (misode/mcmeta auf GitHub, Mojang; einmalig ≈ 13 MB) …\n');
  } else {
    log('Keine Minecraft-Installation gefunden – lade sie ohne Minecraft aus öffentlichen Quellen (misode/mcmeta auf GitHub, Mojang; einmalig ≈ 13 MB) …\n');
  }
  const status = run('scripts/extract-game-data.mjs', ['--remote']);
  const left = check();
  if (status !== 0 || left.length) {
    throw new Error([
      'Die Spieldaten konnten nicht erzeugt werden (Meldung oben).',
      left.length ? `Noch offen: ${left.join(', ')}.` : null,
      'Ohne Minecraft braucht es einmalig Internet (Domains im README unter „Ohne Minecraft“).',
    ].filter(Boolean).join('\n'));
  }
  return 'remote';
}

/**
 * Vorschaubilder für die lokale Seite. Mit thumbs: make-thumbs (rendert nur Fehlendes/Veraltetes). Ohne: eine leere
 * thumbs/index.json anlegen, falls keine da ist – die lokale Seite fragt sie ab und soll dabei keinen 404 bekommen.
 * → 'rendered' | 'failed' | 'placeholder' | 'present'
 */
export function ensureThumbs({ thumbs = true, run = runNode, thumbsDir = THUMBS_DIR, log = console.log } = {}) {
  if (thumbs) {
    const status = run('scripts/make-thumbs.mjs', []);
    if (status !== 0) log('  Hinweis: Nicht alle Vorschaubilder ließen sich erzeugen (siehe oben); die Seite zeigt dort das Kategorie-Icon.');
    return status === 0 ? 'rendered' : 'failed';
  }
  const index = path.join(thumbsDir, 'index.json');
  if (existsSync(index)) return 'present';
  mkdirSync(thumbsDir, { recursive: true });
  writeFileSync(index, `${JSON.stringify({ version: 1, entries: {} }, null, 2)}\n`);
  return 'placeholder';
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { stdio: 'inherit', cwd: ROOT });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function listen(options) {
  const last = options.portGiven ? options.port : options.port + PORT_TRIES - 1;
  for (let port = options.port; port <= last; port++) {
    try {
      return await startServer({ port });
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      console.log(`Port ${port} ist belegt${port < last ? ', versuche den nächsten …' : '.'}`);
    }
  }
  throw new Error(options.portGiven
    ? `Port ${options.port} ist belegt. Anderen wählen, z. B.: node scripts/start.mjs --port ${options.port + 1}`
    : `Die Ports ${options.port} bis ${last} sind alle belegt. Wähle einen mit --port <zahl>.`);
}

async function main() {
  const options = parseStartArgs(process.argv.slice(2));
  console.log('Block-Kompass · Minecraft Java 26.2\n');

  // 1. Spieldaten
  ensureGameData({ remote: options.remote });
  if (!existsSync(path.join(GAME_DATA, 'block-colors.json'))) {
    console.log('  Hinweis: game-data/block-colors.json fehlt – 3D-Modelle lassen sich nicht importieren. Erzeugen: node scripts/build-block-colors.mjs');
  }

  // 2. Katalog (liegt im Repo; neu bauen nur, wenn er nicht mehr zu Modulen oder Spieldaten passt)
  const state = await checkCatalog();
  if (!state.fresh) {
    console.log(`${state.reason} Baue den Katalog neu …\n`);
    const status = runNode('scripts/build-catalog.mjs', []);
    if (status !== 0) {
      if (!existsSync(CATALOG)) throw new Error('Der Katalog konnte nicht erzeugt werden (Meldung oben).');
      console.log('\nAchtung: Beim Katalog gab es Fehler (siehe oben). Fehlerhafte Bauten fehlen in der Seite.\n');
    }
    const after = await checkCatalog();
    if (after.missing.length) console.log(`  Nicht im Katalog (Fehler beim Prüfen): ${after.missing.join(', ')}`);
  } else {
    console.log('✓ Katalog passt zu den Bau-Modulen');
    if (state.missing.length) console.log(`  Nicht im Katalog (beim letzten Lauf fehlerhaft): ${state.missing.join(', ')}`);
  }

  // 3. Vorschaubilder (nur lokal): fehlende oder veraltete rendern; ohne --no-thumbs geht das schnell, wenn alle aktuell sind
  ensureThumbs({ thumbs: options.thumbs });

  // 4. Server
  const server = await listen(options);
  console.log(`\nBlock-Kompass läuft: ${server.url}  (nur auf diesem Rechner erreichbar, beenden mit Strg+C)`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(`\nFehler: ${error.message}`);
    process.exitCode = 1;
  });
}
