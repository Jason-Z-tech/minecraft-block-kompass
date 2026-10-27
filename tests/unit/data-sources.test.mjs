import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MCMETA_BASE, MCMETA_COMMITS, GAME_VERSION, ATLASES, MCMETA_TEXTURES, LIMITS, SUMMARY_FILES, LANG_FILES,
  isValidMcmetaPath, mcmetaUrl, atlasFiles, textureMcmetaPath, structureRepoPath, structureUrl, structureFileToUrl, allFixedFiles,
} from '../../js/data/sources.js';
import { catalogStructureFiles, mirrorFileList, mirrorFilePath } from '../../scripts/mirror-mcmeta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXTURES_JSON = path.join(ROOT, 'game-data', 'textures.json');

test('Quellen: feste Commits (volle SHAs), Version, Atlanten und Grenzen', () => {
  assert.equal(MCMETA_BASE, 'https://raw.githubusercontent.com/misode/mcmeta/');
  assert.deepEqual(Object.keys(MCMETA_COMMITS), ['summary', 'atlas', 'assets', 'assetsJson', 'data']);
  for (const sha of Object.values(MCMETA_COMMITS)) assert.match(sha, /^[0-9a-f]{40}$/);
  assert.equal(new Set(Object.values(MCMETA_COMMITS)).size, 5);
  assert.deepEqual(GAME_VERSION, { id: '26.2', dataVersion: 4903 });
  assert.deepEqual(ATLASES, ['blocks', 'items', 'entities']);
  for (const value of Object.values(LIMITS)) assert.ok(Number.isInteger(value) && value > 0);
  assert.equal(LIMITS.json, 4 * 1024 * 1024);
  assert.equal(LIMITS.mcmeta, 64 * 1024);
  for (const frozen of [MCMETA_COMMITS, GAME_VERSION, ATLASES, MCMETA_TEXTURES, LIMITS, SUMMARY_FILES, LANG_FILES]) assert.ok(Object.isFrozen(frozen));
});

test('mcmetaUrl: baut die Adresse und lehnt unsichere Pfade und fremde Commits ab', () => {
  assert.equal(mcmetaUrl('summary', 'blocks/data.min.json'),
    'https://raw.githubusercontent.com/misode/mcmeta/711a353b47d84e6cb592a1b72f682e5f44759284/blocks/data.min.json');
  assert.equal(mcmetaUrl('assets', 'assets/minecraft/textures/block/water_still.png.mcmeta'),
    `${MCMETA_BASE}${MCMETA_COMMITS.assets}/assets/minecraft/textures/block/water_still.png.mcmeta`);
  const badPaths = [
    '', '/version.json', 'version.json/', 'a//b', '../x', 'a/../b', 'a/./b', '.', 'a..b', 'A/b', 'a b', 'a?x=1', 'a#b',
    'a\\b', 'a%2e', 'ä', 'https://example.com/x', 'x'.repeat(301), null, undefined, 42, ['a'],
  ];
  for (const bad of badPaths) {
    assert.equal(isValidMcmetaPath(bad), false, `gültig: ${JSON.stringify(bad)}`);
    assert.throws(() => mcmetaUrl('summary', bad), /Ungültiger Dateipfad/, `kein Fehler: ${JSON.stringify(bad)}`);
  }
  for (const bad of ['main', 'toString', '__proto__', 'constructor', '', null, MCMETA_COMMITS.summary]) {
    assert.throws(() => mcmetaUrl(bad, 'version.json'), /Unbekannte Spieldaten-Quelle/);
  }
  assert.ok(isValidMcmetaPath('a-b_c.d/e9'));
});

test('Atlanten, Texturen und Strukturen: Pfade und Adressen', () => {
  assert.deepEqual(atlasFiles('blocks'), { png: 'blocks/atlas.png', data: 'blocks/data.min.json' });
  assert.throws(() => atlasFiles('all'), /Unbekannter Atlas/);
  assert.throws(() => atlasFiles('../blocks'), /Unbekannter Atlas/);
  assert.equal(textureMcmetaPath('entity/conduit/wind'), 'assets/minecraft/textures/entity/conduit/wind.png.mcmeta');
  for (const bad of ['../x', 'block//x', 'Block/X', '', 7]) assert.throws(() => textureMcmetaPath(bad), /Ungültiger Texturname/);

  const plains = 'village/plains/houses/plains_small_house_1';
  assert.equal(structureRepoPath(plains), `data/minecraft/structure/${plains}.nbt`);
  assert.equal(structureUrl(plains), `${MCMETA_BASE}${MCMETA_COMMITS.data}/data/minecraft/structure/${plains}.nbt`);
  assert.equal(structureFileToUrl('village__plains__houses__plains_small_house_1.json'), structureUrl(plains));
  for (const bad of ['', '/a', 'a/', 'a//b', '../a', 'a/../b', 'a.nbt', 'A', 'a b', 'a/./b', null]) {
    assert.throws(() => structureUrl(bad), /Ungültiger Strukturpfad/, `kein Fehler: ${JSON.stringify(bad)}`);
  }
  for (const bad of ['village/plains.json', 'a__b.nbt', '../x.json', 'x.json/../y.json', '__a.json', 'a.JSON', 7]) {
    assert.throws(() => structureFileToUrl(bad), /Ungültiger Strukturname/, `kein Fehler: ${JSON.stringify(bad)}`);
  }
});

test('MCMETA_TEXTURES: 101 sortierte, eindeutige Namen, gleich wie game-data/textures.json (anim oder mip)', (t) => {
  assert.equal(MCMETA_TEXTURES.length, 101);
  assert.deepEqual([...MCMETA_TEXTURES], [...new Set(MCMETA_TEXTURES)].sort());
  for (const name of MCMETA_TEXTURES) assert.match(name, /^(block|entity)\/[a-z0-9_/]+$/);
  if (!existsSync(TEXTURES_JSON)) {
    t.skip('game-data/textures.json fehlt – Vergleich übersprungen');
    return;
  }
  const { entries } = JSON.parse(readFileSync(TEXTURES_JSON, 'utf8'));
  const expected = Object.keys(entries).filter((name) => entries[name].anim || entries[name].mip !== undefined).sort();
  assert.deepEqual([...MCMETA_TEXTURES], expected);
});

test('allFixedFiles: Zusammenfassungen, Atlanten, Sprachdateien und alle .mcmeta mit Grenzen', () => {
  const files = allFixedFiles();
  assert.equal(files.length, 4 + 6 + 2 + 101);
  const keys = new Set();
  for (const file of files) {
    assert.deepEqual(Object.keys(file).sort(), ['commit', 'key', 'limit', 'path']);
    assert.equal(file.commit, MCMETA_COMMITS[file.key]);
    assert.ok(isValidMcmetaPath(file.path), file.path);
    assert.ok(Number.isInteger(file.limit) && file.limit > 0);
    assert.doesNotThrow(() => mcmetaUrl(file.key, file.path));
    keys.add(`${file.key}|${file.path}`);
  }
  assert.equal(keys.size, files.length, 'keine Datei doppelt');
  const pick = (key, filePath) => files.find((file) => file.key === key && file.path === filePath);
  assert.equal(pick('summary', 'version.json').limit, LIMITS.json);
  assert.equal(pick('summary', 'assets/model/data.min.json').limit, LIMITS.json);
  assert.equal(pick('atlas', 'entities/atlas.png').limit, LIMITS.png);
  assert.equal(pick('atlas', 'items/data.min.json').limit, LIMITS.json);
  assert.equal(pick('assetsJson', 'assets/minecraft/lang/de_de.json').limit, LIMITS.lang);
  assert.equal(pick('assets', 'assets/minecraft/textures/block/water_still.png.mcmeta').limit, LIMITS.mcmeta);
  assert.equal(files.filter((file) => file.key === 'assets').length, 101);
  // Jeder Aufruf liefert eine neue Liste (Aufrufer dürfen sie verändern).
  files.pop();
  assert.equal(allFixedFiles().length, 113);
});

test('Spiegel-Liste: feste Dateien plus alle Katalog-Strukturen, Ablage nur im Spiegel', () => {
  const catalog = JSON.parse(readFileSync(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
  const structures = catalogStructureFiles(catalog);
  assert.ok(structures.length >= 200, `nur ${structures.length} Strukturen im Katalog`);
  assert.deepEqual(structures, [...new Set(structures)].sort());
  const list = mirrorFileList({ catalog });
  assert.equal(list.length, 113 + structures.length);
  const plains = list.find((file) => file.path === 'data/minecraft/structure/village/savanna/houses/savanna_library_1.nbt');
  assert.deepEqual(plains, { key: 'data', commit: MCMETA_COMMITS.data, path: plains.path, limit: LIMITS.nbt });
  assert.deepEqual(catalogStructureFiles({ builds: [{ structure: 'b__c.json' }, { structure: null }, { structure: 'a.json' }, { structure: 'a.json' }] }), ['a.json', 'b__c.json']);
  assert.throws(() => catalogStructureFiles({}), /unbekanntes Format/);
  assert.throws(() => mirrorFileList({ catalog: { builds: [{ structure: '../x.json' }] } }), /Ungültiger Strukturname/);

  const dir = path.join(ROOT, 'tmp', 'spiegel');
  assert.equal(mirrorFilePath(dir, MCMETA_COMMITS.atlas, 'blocks/atlas.png'), path.join(dir, MCMETA_COMMITS.atlas, 'blocks', 'atlas.png'));
  assert.throws(() => mirrorFilePath(dir, 'main', 'version.json'), /Unbekannter Commit/);
  assert.throws(() => mirrorFilePath(dir, MCMETA_COMMITS.atlas, '../x'), /Ungültiger Pfad/);
  assert.throws(() => mirrorFilePath(dir, MCMETA_COMMITS.atlas, '/etc/passwd'), /Ungültiger Pfad/);
});
