// Ein Befehl zum Starten: prüft die Spieldaten (fehlen sie, werden sie erzeugt), prüft, ob der Katalog zu den
// Bau-Modulen passt (sonst neu bauen), und startet den lokalen Server.
//   node scripts/start.mjs [--port 8080] [--remote] [--no-thumbs]
// --remote: Spieldaten ohne Minecraft-Installation aus öffentlichen Quellen laden (siehe README „In der Cloud“).
// --no-thumbs: Katalog ohne Vorschaubilder bauen (braucht dann kein Chrome).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_DATA = path.join(ROOT, 'game-data');
const CATALOG = path.join(GAME_DATA, 'catalog.json');
const BUILDS_DIR = path.join(ROOT, 'js', 'builds');
const DEFAULT_PORT = 8080;
const PORT_TRIES = 10;
const REQUIRED_DATA = ['meta.json', 'blocks.json', 'names.json', 'models.json', 'textures.json', 'textures.bin', 'structures/index.json'];
const CATEGORY_DIRS = ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'redstone', 'farmen', 'infrastruktur'];
// Ändert sich eine dieser Dateien oder Ordner, kann der Katalog veraltet sein
const CATALOG_INPUTS = ['js/builds', 'js/core', 'scripts/build-catalog.mjs', 'scripts/check-build.mjs', 'game-data/structures/index.json', 'game-data/blocks.json'];

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

function newestMtime(target) {
  if (!existsSync(target)) return 0;
  const info = statSync(target);
  if (!info.isDirectory()) return info.mtimeMs;
  let newest = info.mtimeMs;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtime(path.join(target, entry.name)));
  }
  return newest;
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
 * Passt der Katalog zu den Modulen? → { fresh, reason, missing }
 * Veraltet, wenn er fehlt, kaputt ist oder älter als ein Modul, der Kern oder die Spieldaten. Fehlen Module im
 * Katalog, obwohl er neuer ist, hatten sie beim letzten Lauf Fehler: dann nicht endlos neu bauen, nur melden.
 */
export function checkCatalog({ root = ROOT, catalogFile = CATALOG } = {}) {
  if (!existsSync(catalogFile)) return { fresh: false, reason: 'Der Katalog fehlt.', missing: [] };
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
  } catch (error) {
    return { fresh: false, reason: `Der Katalog ist nicht lesbar (${error.message}).`, missing: [] };
  }
  if (!Array.isArray(catalog.builds)) return { fresh: false, reason: 'Der Katalog hat ein unbekanntes Format.', missing: [] };
  const catalogTime = statSync(catalogFile).mtimeMs;
  const newer = CATALOG_INPUTS.filter((input) => newestMtime(path.join(root, input)) > catalogTime);
  if (newer.length) return { fresh: false, reason: `Geändert seit dem letzten Katalog: ${newer.join(', ')}.`, missing: [] };
  const listed = new Set(catalog.builds.map((build) => build.module).filter(Boolean));
  const missing = moduleFiles(path.join(root, 'js', 'builds')).filter((file) => !listed.has(file));
  return { fresh: true, reason: null, missing };
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
  let problems = checkGameData();
  if (problems.length) {
    console.log(`Spieldaten fehlen (${problems.join(', ')}). Erzeuge sie jetzt${options.remote ? ' aus öffentlichen Quellen' : ' aus deiner Minecraft-Installation (wird nur gelesen)'} …\n`);
    const status = runNode('scripts/extract-game-data.mjs', options.remote ? ['--remote'] : []);
    problems = checkGameData();
    if (status !== 0 || problems.length) {
      throw new Error([
        'Die Spieldaten konnten nicht erzeugt werden (Meldung oben).',
        options.remote ? 'Prüfe den Netzwerkzugriff (README „In der Cloud“).' : 'Ohne installiertes Minecraft Java 26.2: node scripts/start.mjs --remote',
      ].join('\n'));
    }
  } else {
    console.log('✓ Spieldaten vorhanden (game-data/)');
  }
  if (!existsSync(path.join(GAME_DATA, 'block-colors.json'))) {
    console.log('  Hinweis: game-data/block-colors.json fehlt – 3D-Modelle lassen sich nicht importieren. Erzeugen: node scripts/build-block-colors.mjs');
  }

  // 2. Katalog
  const state = checkCatalog();
  if (!state.fresh) {
    console.log(`${state.reason} Baue den Katalog neu${options.thumbs ? ' (mit Vorschaubildern)' : ''} …\n`);
    const status = runNode('scripts/build-catalog.mjs', options.thumbs ? ['--thumbs'] : []);
    if (status !== 0) {
      if (!existsSync(CATALOG)) throw new Error('Der Katalog konnte nicht erzeugt werden (Meldung oben).');
      console.log('\nAchtung: Beim Katalog gab es Fehler (siehe oben). Fehlerhafte Bauten fehlen in der Seite.\n');
    }
    const after = checkCatalog();
    if (after.missing.length) console.log(`  Nicht im Katalog (Fehler beim Prüfen): ${after.missing.join(', ')}`);
  } else {
    console.log('✓ Katalog passt zu den Bau-Modulen');
    if (state.missing.length) console.log(`  Nicht im Katalog (beim letzten Lauf fehlerhaft): ${state.missing.join(', ')}`);
  }

  // 3. Server
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
