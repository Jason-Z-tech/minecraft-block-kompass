// data/thumbs/ liegt im Repo und wird mit der Webseite veröffentlicht (Vorschaubilder der Karten, online und lokal).
// Dieser Test merkt, wenn ein Bau (oder seine Kamera-Einstellung in data/thumbs/views.json) geändert wurde, sein Bild
// aber nicht – oder wenn ein Bild fehlt, eines übrig ist oder alle zusammen zu groß werden. Dann neu erzeugen: node scripts/make-thumbs.mjs --prune (braucht game-data/ und Chrome;
// rendert nur, was sich geändert hat).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  thumbHash, dataStamp, webpSize, loadViews, THUMB_SIZE, THUMB_STYLE, MAX_TOTAL_BYTES, INDEX_VERSION, DEFAULT_OUT_DIR, DEFAULT_CATALOG,
  DEFAULT_VIEWS_FILE, TEMP_FILE_PATTERN,
} from '../../scripts/make-thumbs.mjs';
import { THUMBS_DIR, THUMBS_INDEX_PATH, THUMBS_INDEX_VERSION } from '../../js/ui/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const HAS_GAME_DATA = existsSync(path.join(DATA_DIR, 'meta.json'));
const STALE = 'neu erzeugen: node scripts/make-thumbs.mjs --prune (braucht game-data/ und Chrome)';
// Außer den Bildern und der Liste darf in data/thumbs/ nur die Datei mit Kamera-Einstellungen je Bau liegen
const ALLOWED_FILES = new Set(['index.json', 'views.json']);

const catalog = JSON.parse(readFileSync(DEFAULT_CATALOG, 'utf8'));
const index = JSON.parse(readFileSync(path.join(DEFAULT_OUT_DIR, 'index.json'), 'utf8'));
const files = readdirSync(DEFAULT_OUT_DIR);
// Kamera-Einstellungen je Bau (geprüft; {} ohne Datei) – gehen wie in make-thumbs in den Hash ein
const views = await loadViews(DEFAULT_VIEWS_FILE);
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

test('Seite und make-thumbs nutzen denselben Ordner data/thumbs/', () => {
  assert.equal(path.relative(ROOT, DEFAULT_OUT_DIR).split(path.sep).join('/'), THUMBS_DIR.replace(/\/$/, ''));
  assert.equal(THUMBS_INDEX_PATH, `${THUMBS_DIR}index.json`);
});

test('data/thumbs/index.json hat das Format von make-thumbs (Stil, Größe, Spieldaten-Stand)', async () => {
  // Liest die Seite eine andere Version, zeigt sie still nur Icons
  assert.equal(INDEX_VERSION, THUMBS_INDEX_VERSION, 'make-thumbs und Seite (js/ui/data.js) kennen dieselbe Version');
  assert.equal(index.version, THUMBS_INDEX_VERSION);
  assert.equal(index.style, THUMB_STYLE, `Bildaufbau geändert (THUMB_STYLE) – ${STALE}`);
  assert.deepEqual(index.size, [...THUMB_SIZE]);
  assert.equal(typeof index.data, 'string', 'Spieldaten-Stand der Hashes');
  assert.ok(index.entries && typeof index.entries === 'object' && !Array.isArray(index.entries));
  if (HAS_GAME_DATA) assert.equal(index.data, await dataStamp(DATA_DIR), `Spieldaten geändert – ${STALE}`);
  assert.deepEqual(Object.keys(index.entries), Object.keys(index.entries).sort(), 'Einträge nach ID sortiert');
});

test('Jeder Katalog-Eintrag hat ein Bild (WebP 640 × 400), dessen Hash zum aktuellen Stand passt', async () => {
  // Gleiche Hash-Berechnung wie make-thumbs; ohne game-data/ mit dem Spieldaten-Stand aus der Liste
  const stamp = HAS_GAME_DATA ? await dataStamp(DATA_DIR) : index.data;
  const missing = [];
  const stale = [];
  for (const build of catalog.builds) {
    const entry = index.entries[build.id];
    const file = path.join(DEFAULT_OUT_DIR, `${build.id}.webp`);
    if (!entry || !existsSync(file)) {
      missing.push(build.id);
      continue;
    }
    if (entry.hash !== await thumbHash(build, { stamp, views })) stale.push(build.id);
    const buffer = readFileSync(file);
    assert.deepEqual(webpSize(buffer), [...THUMB_SIZE], `${build.id}: Bildgröße`);
    assert.equal(entry.bytes, buffer.length, `${build.id}: Dateigröße passt nicht zur Liste – ${STALE}`);
  }
  assert.deepEqual(missing, [], `Bauten ohne Vorschaubild – ${STALE}`);
  assert.deepEqual(stale, [], `Bau geändert, Vorschaubild nicht – ${STALE}`);
});

test('Keine Bilder und Listeneinträge ohne Katalog-Eintrag, keine Zwischendateien', () => {
  const ids = new Set(catalog.builds.map((build) => build.id));
  // Reste eines abgebrochenen Laufs: jeder neue Lauf von make-thumbs räumt sie zuerst weg
  assert.deepEqual(files.filter((name) => TEMP_FILE_PATTERN.test(name)), [], 'Zwischendateien eines abgebrochenen Laufs – wegräumen mit: node scripts/make-thumbs.mjs --prune');
  const orphans = files.filter((name) => name.endsWith('.webp') && !ids.has(name.slice(0, -5)));
  assert.deepEqual(orphans, [], 'Bilder ohne Katalog-Eintrag – löschen mit: node scripts/make-thumbs.mjs --prune');
  const foreign = files.filter((name) => !ALLOWED_FILES.has(name) && !name.endsWith('.webp') && !TEMP_FILE_PATTERN.test(name));
  assert.deepEqual(foreign, [], 'Fremde Dateien in data/thumbs/ (gehören nicht zu make-thumbs) – von Hand entfernen');
  assert.deepEqual(Object.keys(index.entries).filter((id) => !ids.has(id)), [], 'Listeneinträge ohne Katalog-Eintrag – node scripts/make-thumbs.mjs --prune');
});

test('Kamera-Einstellungen (views.json) nur für Bauten im Katalog, nach ID sortiert', () => {
  assert.equal(path.dirname(DEFAULT_VIEWS_FILE), DEFAULT_OUT_DIR);
  const ids = new Set(catalog.builds.map((build) => build.id));
  assert.deepEqual(Object.keys(views).filter((id) => !ids.has(id)), [], 'Einstellungen ohne Katalog-Eintrag – aus data/thumbs/views.json entfernen');
  assert.deepEqual(Object.keys(views), Object.keys(views).sort(), 'Einträge nach ID sortiert (kleine Änderungen im Repo)');
});

test(`Alle Vorschaubilder zusammen höchstens ${megabytes(MAX_TOTAL_BYTES)}`, () => {
  const total = files.filter((name) => name.endsWith('.webp')).reduce((sum, name) => sum + statSync(path.join(DEFAULT_OUT_DIR, name)).size, 0);
  assert.ok(total > 0, 'keine Bilder');
  assert.ok(total <= MAX_TOTAL_BYTES, `${megabytes(total)} – WebP-Qualität (THUMB_QUALITY in tests/visual/thumb.js) senken, THUMB_STYLE erhöhen und neu erzeugen`);
});
