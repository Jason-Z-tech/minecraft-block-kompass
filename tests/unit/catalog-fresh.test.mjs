// data/catalog.json liegt im Repo und wird mit der Webseite veröffentlicht (GitHub Pages). Dieser Test merkt, wenn er
// nicht mehr zu den Bau-Modulen oder den Spieldaten passt. Dann neu erzeugen: node scripts/build-catalog.mjs (braucht game-data/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeFingerprint, dataFingerprint, countBuilds, findModules, DEFAULT_OUT } from '../../scripts/build-catalog.mjs';
import { normalizeCatalog } from '../../js/ui/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const HAS_GAME_DATA = existsSync(path.join(DATA_DIR, 'meta.json')) && existsSync(path.join(DATA_DIR, 'blocks.json'));
const STALE = 'data/catalog.json ist veraltet – neu erzeugen: node scripts/build-catalog.mjs (braucht game-data/, siehe README)';

const catalog = JSON.parse(readFileSync(DEFAULT_OUT, 'utf8'));

test('data/catalog.json passt zum Quelltext (Bau-Module, Kern, Prüf- und Katalog-Skript)', async () => {
  assert.equal(catalog.inputs?.code, await codeFingerprint(), STALE);
});

test('data/catalog.json passt zu den Spieldaten', { skip: HAS_GAME_DATA ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)' }, async () => {
  assert.equal(catalog.inputs?.data, await dataFingerprint(DATA_DIR), STALE);
});

test('data/catalog.json ist vollständig gültig, ohne Bildpfade (die Vorschaubilder stehen in data/thumbs/index.json)', () => {
  assert.equal(catalog.version, '26.2');
  assert.deepEqual(catalog.counts, countBuilds(catalog.builds));
  assert.ok(catalog.builds.length > 0);
  const normalized = normalizeCatalog(catalog);
  assert.equal(normalized.skipped, 0, 'kein Eintrag wird von der Seite verworfen');
  assert.equal(normalized.builds.length, catalog.builds.length);
  for (const build of catalog.builds) assert.equal(build.thumb, null, `${build.id}: kein Vorschaubild-Pfad im veröffentlichten Katalog`);
  // Schwierigkeit, Wissenswertes, die Kategorien Redstone und Farmen und Original-Strukturen gibt es nicht mehr
  for (const build of catalog.builds) {
    assert.equal('difficulty' in build, false, `${build.id}: difficulty`);
    assert.equal('facts' in build, false, `${build.id}: facts`);
    assert.notEqual(build.category, 'redstone', build.id);
    assert.notEqual(build.category, 'farmen', build.id);
    assert.equal('structure' in build, false, `${build.id}: structure`);
    // Jeder Bau ist ein Bau-Modul oder ein Community-Bau mit Datei unter data/community/
    if (build.community) {
      assert.equal(build.module, null, build.id);
      assert.ok(existsSync(path.join(ROOT, 'data', 'community', build.community.file)), `${build.id}: Datei fehlt`);
    } else {
      assert.ok(typeof build.module === 'string' && build.module.startsWith('js/builds/'), `${build.id}: Bau-Modul`);
    }
  }
});

test('data/catalog.json ohne Warnungen, mit jedem Community-Bau aus data/community/builds.json samt Ersteller und Lizenz', () => {
  assert.deepEqual(catalog.warnings, [], 'Warnungen im Katalog – node scripts/build-catalog.mjs zeigt sie');
  const listed = JSON.parse(readFileSync(path.join(ROOT, 'data', 'community', 'builds.json'), 'utf8'));
  const byId = new Map(catalog.builds.map((build) => [build.id, build]));
  for (const item of listed) {
    const build = byId.get(item.id);
    assert.ok(build, `${item.id}: fehlt im Katalog`);
    assert.deepEqual(build.community, { file: item.file, format: item.format }, item.id);
    assert.equal(build.accuracy, 'original', item.id);
    assert.equal(build.credits.author, item.author, item.id);
    assert.equal(build.credits.url, item.url, item.id);
    assert.match(build.credits.licenseUrl, /^https:\/\//, item.id);
    assert.ok(build.credits.license, item.id);
  }
  assert.equal(catalog.builds.filter((build) => build.community).length, listed.length, 'keine Community-Bauten ohne Eintrag');
});

test('data/catalog.json enthält jedes Bau-Modul (ein Modul mit Fehlern fehlt sonst online, obwohl der Fingerabdruck passt)', async () => {
  const { modules } = await findModules(path.join(ROOT, 'js', 'builds'));
  const listed = new Set(catalog.builds.map((build) => build.module).filter(Boolean));
  const missing = modules.map((mod) => path.relative(ROOT, mod.file).split(path.sep).join('/')).filter((file) => !listed.has(file));
  assert.deepEqual(missing, [], 'Module fehlen im Katalog (beim Bauen fehlerhaft?) – node scripts/build-catalog.mjs zeigt die Fehler');
});
