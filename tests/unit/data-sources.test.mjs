import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sources from '../../js/data/sources.js';
import {
  MCMETA_BASE, MCMETA_COMMITS, GAME_VERSION, ATLASES, MCMETA_TEXTURES, LIMITS, SUMMARY_FILES, LANG_FILES,
  isValidMcmetaPath, mcmetaUrl, atlasFiles, textureMcmetaPath, allFixedFiles,
} from '../../js/data/sources.js';
import * as mirror from '../../scripts/mirror-mcmeta.mjs';
import { mirrorFileList, mirrorFilePath } from '../../scripts/mirror-mcmeta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXTURES_JSON = path.join(ROOT, 'game-data', 'textures.json');

test('Quellen: feste Commits (volle SHAs), Version, Atlanten und Grenzen', () => {
  assert.equal(MCMETA_BASE, 'https://raw.githubusercontent.com/misode/mcmeta/');
  // Ohne Original-Strukturen braucht es den Commit „data“ (Struktur-NBTs) nicht mehr
  assert.deepEqual(Object.keys(MCMETA_COMMITS), ['summary', 'atlas', 'assets', 'assetsJson']);
  for (const sha of Object.values(MCMETA_COMMITS)) assert.match(sha, /^[0-9a-f]{40}$/);
  assert.equal(new Set(Object.values(MCMETA_COMMITS)).size, 4);
  assert.deepEqual(GAME_VERSION, { id: '26.2', dataVersion: 4903 });
  assert.deepEqual(ATLASES, ['blocks', 'items', 'entities']);
  assert.deepEqual(Object.keys(LIMITS), ['json', 'lang', 'png', 'mcmeta'], 'keine Grenze für Struktur-NBTs mehr');
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
  for (const bad of ['main', 'data', 'toString', '__proto__', 'constructor', '', null, MCMETA_COMMITS.summary]) {
    assert.throws(() => mcmetaUrl(bad, 'version.json'), /Unbekannte Spieldaten-Quelle/);
  }
  assert.ok(isValidMcmetaPath('a-b_c.d/e9'));
});

test('Atlanten und Texturen: Pfade und Adressen; keine Strukturen mehr', () => {
  assert.deepEqual(atlasFiles('blocks'), { png: 'blocks/atlas.png', data: 'blocks/data.min.json' });
  assert.throws(() => atlasFiles('all'), /Unbekannter Atlas/);
  assert.throws(() => atlasFiles('../blocks'), /Unbekannter Atlas/);
  assert.equal(textureMcmetaPath('entity/conduit/wind'), 'assets/minecraft/textures/entity/conduit/wind.png.mcmeta');
  for (const bad of ['../x', 'block//x', 'Block/X', '', 7]) assert.throws(() => textureMcmetaPath(bad), /Ungültiger Texturname/);

  for (const name of ['structureRepoPath', 'structureUrl', 'structureFileToUrl']) assert.equal(name in sources, false, name);
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

test('Spiegel-Liste: genau die festen Dateien (ohne Strukturen, unabhängig vom Katalog), Ablage nur im Spiegel', () => {
  const list = mirrorFileList();
  assert.deepEqual(list, allFixedFiles());
  assert.equal(list.length, 113);
  assert.ok(list.every((file) => !file.path.startsWith('data/')), 'keine Struktur-NBTs');
  assert.equal('catalogStructureFiles' in mirror, false);

  const dir = path.join(ROOT, 'tmp', 'spiegel');
  assert.equal(mirrorFilePath(dir, MCMETA_COMMITS.atlas, 'blocks/atlas.png'), path.join(dir, MCMETA_COMMITS.atlas, 'blocks', 'atlas.png'));
  assert.throws(() => mirrorFilePath(dir, 'main', 'version.json'), /Unbekannter Commit/);
  assert.throws(() => mirrorFilePath(dir, MCMETA_COMMITS.atlas, '../x'), /Ungültiger Pfad/);
  assert.throws(() => mirrorFilePath(dir, MCMETA_COMMITS.atlas, '/etc/passwd'), /Ungültiger Pfad/);
});
