import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { checkBuild, validateMeta, parseArgs, CATEGORIES } from '../../scripts/check-build.mjs';
import { FIXTURE_DIR, PROJECT_ROOT } from '../fixtures/core/setup.mjs';

const run = promisify(execFile);
const SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'check-build.mjs');
const HOUSE = path.join(FIXTURE_DIR, 'example-house.js');

const goodMeta = () => ({
  id: 'turm', title: 'Turm', category: 'mittelalter', subtitle: 'Ein Turm', tags: ['Turm'], aliases: ['turm'],
  accuracy: 'eigenes', description: 'Ein runder Turm.', sources: [], credits: null, tested: null,
});

test('Beispielhaus besteht die Prüfung mit Kennzahlen', async () => {
  const report = await checkBuild(HOUSE, { dataDir: FIXTURE_DIR });
  assert.deepEqual(report.errors, []);
  assert.equal(report.ok, true);
  assert.equal(report.id, 'example-house');
  assert.deepEqual(report.size, [11, 9, 11]);
  assert.equal(report.blockCount, 348);
  assert.equal(report.phases, 6);
  assert.ok(report.steps > 6);
  assert.deepEqual(report.phaseList, [
    { title: 'Fundament', steps: 1 }, { title: 'Wände', steps: 4 }, { title: 'Tür und Fenster', steps: 2 },
    { title: 'Dach', steps: 5 }, { title: 'Einrichtung', steps: 3 }, { title: 'Vorgarten', steps: 3 },
  ]);
  assert.deepEqual(report.warnings, [], 'keine Warnung „Kapitel hat keinen Text“ mehr');
  assert.ok(report.topMaterials.length <= 20);
  const planks = report.materials.find((m) => m.item === 'oak_planks');
  assert.deepEqual(planks, { item: 'oak_planks', name: 'Eichenholzbretter', count: 88, amount: '1 Stack und 24' });
  assert.ok(report.materials.some((m) => m.item === 'chest' && m.count === 2));
});

test('CLI: --json, Exit-Code 0; fehlende Spieldaten: Hinweis und Exit-Code 1', async () => {
  const { stdout } = await run(process.execPath, [SCRIPT, HOUSE, '--data', FIXTURE_DIR, '--json'], { cwd: PROJECT_ROOT });
  const report = JSON.parse(stdout);
  assert.equal(report.ok, true);
  assert.equal(report.module, 'tests/fixtures/core/example-house.js');
  const text = await run(process.execPath, [SCRIPT, HOUSE, '--data', FIXTURE_DIR], { cwd: PROJECT_ROOT });
  assert.match(text.stdout, /Größe: 11 × 9 × 11/);
  assert.match(text.stdout, /Material \(Top 16 von 16\)/);
  assert.match(text.stdout, /Ergebnis: OK/);
  const missing = path.join(PROJECT_ROOT, 'tmp', 'gibt-es-nicht');
  await assert.rejects(run(process.execPath, [SCRIPT, HOUSE, '--data', missing], { cwd: PROJECT_ROOT }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Spieldaten fehlen: .*blocks\.json\. Erzeuge sie zuerst mit: node scripts\/extract-game-data\.mjs/);
    return true;
  });
});

test('Argumente werden geprüft', () => {
  assert.deepEqual(parseArgs(['a.js', '--scale', '0.5', '--json']).scale, 0.5);
  assert.throws(() => parseArgs([]), /Aufruf/);
  assert.throws(() => parseArgs(['a.js', '--scale', 'x']), /--scale/);
  assert.throws(() => parseArgs(['a.js', '--egal']), /Unbekannte Option/);
});

test('meta-Prüfung nach §9', () => {
  assert.deepEqual(validateMeta(goodMeta(), { fileId: 'turm' }), { errors: [], warnings: [] });
  const check = (patch, folderCategory = null) => validateMeta({ ...goodMeta(), ...patch }, { fileId: 'turm', folderCategory });
  assert.match(check({ id: 'anders' }).errors[0], /Dateinamen/);
  assert.match(check({ id: 'Turm!' }).errors[0], /2–80 Zeichen/);
  assert.match(check({ category: 'burgen' }).errors[0], /meta.category/);
  assert.match(check({}, 'haeuser').errors[0], /passt nicht zum Ordner/);
  assert.match(check({ accuracy: 'echt' }).errors[0], /meta.accuracy/);
  assert.match(check({ title: ' ' }).errors[0], /meta.title fehlt/);
  assert.match(check({ accuracy: 'massstab' }).errors[0], /mindestens eine Quelle/);
  assert.match(check({ sources: [{ title: 'Wiki', url: 'http://example.org' }] }).errors[0], /https/);
  assert.match(check({ scales: [1, 0.5] }).errors[0], /nur bei accuracy „massstab“/);
  assert.deepEqual(check({ accuracy: 'massstab', scales: [1, 0.5], sources: [{ title: 'Wiki', url: 'https://de.wikipedia.org/' }] }).errors, []);
  assert.match(check({ accuracy: 'massstab', scales: [1, 1], sources: [{ title: 'W', url: 'https://a.b/' }] }).errors[0], /verschiedener Zahlen/);
  assert.match(check({ credits: { author: 'X', url: 'ftp://a', license: 'CC' } }).errors[0], /credits/);
  assert.match(check({ tested: 'ja' }).errors[0], /tested/);
  assert.match(check({ farbe: 'rot' }).warnings[0], /unbekannt/);
  assert.match(check({ category: 'farmen' }).warnings[0], /^Farmen: meta.tested sollte false sein/);
  assert.deepEqual(check({ category: 'farmen', tested: false }), { errors: [], warnings: [] });
  assert.deepEqual(check({ category: 'haeuser' }).warnings, [], 'tested-Warnung nur bei farmen');
  assert.match(validateMeta(undefined, { fileId: 'x' }).errors[0], /kein meta-Objekt/);
});

test('Kategorien: sieben, ohne redstone', () => {
  assert.deepEqual(CATEGORIES, ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'farmen', 'infrastruktur']);
  const check = (patch) => validateMeta({ ...goodMeta(), ...patch }, { fileId: 'turm' });
  const redstone = check({ category: 'redstone' });
  assert.deepEqual(redstone.errors, ['meta.category muss eine von haeuser, wahrzeichen, fantasy, mittelalter, klein, farmen, infrastruktur sein.']);
  assert.deepEqual(redstone.warnings, []);
  assert.match(validateMeta({ ...goodMeta(), category: 'redstone' }, { fileId: 'turm', folderCategory: 'redstone' }).errors[0], /meta.category muss eine von/);
});

test('Schwierigkeit und Wissenswertes gibt es nicht mehr: meta.difficulty und meta.facts sind Fehler', () => {
  const check = (patch) => validateMeta({ ...goodMeta(), ...patch }, { fileId: 'turm' });
  assert.deepEqual(check({ difficulty: 2 }), { errors: ['meta.difficulty gibt es nicht mehr.'], warnings: [] });
  assert.deepEqual(check({ difficulty: 6 }).errors, ['meta.difficulty gibt es nicht mehr.']);
  assert.deepEqual(check({ facts: [] }), { errors: ['meta.facts gibt es nicht mehr.'], warnings: [] });
  assert.deepEqual(check({ facts: ['Ein Fakt'] }).errors, ['meta.facts gibt es nicht mehr.']);
  assert.deepEqual(check({ difficulty: 1, facts: ['x'] }).errors, ['meta.difficulty gibt es nicht mehr.', 'meta.facts gibt es nicht mehr.']);
  // Ohne die beiden Felder ist meta vollständig.
  assert.deepEqual(check({}), { errors: [], warnings: [] });
});

test('Schwierigkeit auch nicht als Schlagwort: Tags wie „Anfänger“ sind Fehler', () => {
  const check = (tags) => validateMeta({ ...goodMeta(), tags }, { fileId: 'turm' });
  assert.deepEqual(check(['Turm', 'Anfänger']), { errors: ['meta.tags: „Anfänger“ ist eine Schwierigkeit – die gibt es nicht mehr.'], warnings: [] });
  assert.deepEqual(check(['einsteiger', 'Fortgeschritten']).errors, [
    'meta.tags: „einsteiger“ ist eine Schwierigkeit – die gibt es nicht mehr.',
    'meta.tags: „Fortgeschritten“ ist eine Schwierigkeit – die gibt es nicht mehr.',
  ]);
  // Nur ganze Tags zählen: „Starterhaus“ oder „Klein“ sind keine Schwierigkeit.
  assert.deepEqual(check(['Starterhaus', 'Klein', 'Profiküche']), { errors: [], warnings: [] });
});

test('Fehlerhafte Module: unbekannter Block, Zufall, fehlende build-Funktion, Maßstab', async () => {
  await mkdir(path.join(PROJECT_ROOT, 'tmp'), { recursive: true });
  const dir = await mkdtemp(path.join(PROJECT_ROOT, 'tmp', 'check-build-'));
  try {
    const write = async (name, meta, body) => {
      const file = path.join(dir, `${name}.js`);
      await writeFile(file, `export const meta = ${JSON.stringify({ ...goodMeta(), id: name, ...meta })};\n${body}\n`);
      return file;
    };
    const unknown = await checkBuild(await write('unbekannt', {}, "export default function build(b) { b.set(0, 0, 0, 'banana_block'); }"), { dataDir: FIXTURE_DIR });
    assert.equal(unknown.ok, false);
    assert.match(unknown.errors.join(' '), /Bau fehlgeschlagen: Unbekannter Block „banana_block“/);

    const randomBody = "export default function build(b) { for (let x = 0; x < 30; x++) b.set(x, 0, 0, Math.random() < 0.5 ? 'stone' : 'dirt'); }";
    const random = await checkBuild(await write('zufall', {}, randomBody), { dataDir: FIXTURE_DIR });
    assert.match(random.errors.join(' '), /Math\.random/);
    assert.match(random.errors.join(' '), /nicht deterministisch/);

    const noBuild = await checkBuild(await write('ohne', {}, ''), { dataDir: FIXTURE_DIR });
    assert.match(noBuild.errors.join(' '), /keine build-Funktion/);

    const empty = await checkBuild(await write('leer', {}, 'export default function build() {}'), { dataDir: FIXTURE_DIR });
    assert.match(empty.errors.join(' '), /keine Blöcke/);

    const oldMeta = await checkBuild(await write('alt', { difficulty: 2, facts: ['x'] }, "export default function build(b) { b.set(0, 0, 0, 'stone'); }"), { dataDir: FIXTURE_DIR });
    assert.equal(oldMeta.ok, false);
    assert.deepEqual(oldMeta.errors, ['meta.difficulty gibt es nicht mehr.', 'meta.facts gibt es nicht mehr.']);

    const phaseText = await checkBuild(await write('kapiteltext', {}, "export default function build(b) { b.phase('Boden', 'Leg den Boden.'); b.set(0, 0, 0, 'stone'); }"), { dataDir: FIXTURE_DIR });
    assert.deepEqual(phaseText.errors, ['Bau fehlgeschlagen: phase: nur ein Titel – Texte und Tipps gibt es nicht mehr.']);
    const stepText = await checkBuild(await write('schritttext', {}, "export default function build(b) { b.phase('Boden'); b.step('Erste Reihe'); b.set(0, 0, 0, 'stone'); }"), { dataDir: FIXTURE_DIR });
    assert.deepEqual(stepText.errors, ['Bau fehlgeschlagen: step: Schritte haben keinen Titel und keinen Text mehr.']);
    const note = await checkBuild(await write('notiz', {}, "export default function build(b) { b.set(0, 0, 0, 'stone'); b.note(0, 0, 0, 'Hier'); }"), { dataDir: FIXTURE_DIR });
    assert.match(note.errors.join(' '), /Bau fehlgeschlagen: .*note/);

    const titleOnly = await checkBuild(await write('nurtitel', {}, "export default function build(b) { b.phase('Boden'); b.set(0, 0, 0, 'stone'); b.phase('Leer'); b.phase('Möbel'); b.step(); b.set(0, 1, 0, 'stone'); b.step(); }"), { dataDir: FIXTURE_DIR });
    assert.equal(titleOnly.ok, true);
    assert.deepEqual(titleOnly.phaseList, [{ title: 'Boden', steps: 1 }, { title: 'Leer', steps: 0 }, { title: 'Möbel', steps: 2 }]);
    assert.deepEqual(titleOnly.warnings, ['Kapitel „Leer“ hat keine Schritte (keine Blöcke).', 'Schritt 3 (Kapitel „Möbel“) setzt keine Blöcke.']);

    const scaledMeta = { accuracy: 'massstab', scales: [1, 0.5], sources: [{ title: 'Quelle', url: 'https://example.org/' }] };
    const body = "export default function build(b, { scale = 1 } = {}) { b.fill(0, 0, 0, Math.round(9 * scale), 0, 0, 'stone'); }";
    const scaledFile = await write('massstab', scaledMeta, body);
    const half = await checkBuild(scaledFile, { dataDir: FIXTURE_DIR, scale: 0.5 });
    assert.equal(half.ok, true);
    assert.deepEqual(half.size, [6, 1, 1]);
    const wrong = await checkBuild(scaledFile, { dataDir: FIXTURE_DIR, scale: 0.3 });
    assert.match(wrong.errors.join(' '), /Maßstab 0.3 ist nicht erlaubt/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
