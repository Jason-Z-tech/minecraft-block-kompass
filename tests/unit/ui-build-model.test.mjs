// Bau-Seite: reine Teile (Schrittmodell, Player, Anleitung, Infos, Bühne, Material) mit dem echten
// Beispielhaus aus tests/fixtures/core (Builder + Test-Blockdaten).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtureData } from '../fixtures/core/setup.mjs';
import { Builder } from '../../js/core/builder.js';
import buildHouse from '../fixtures/core/example-house.js';
import * as stepModel from '../../js/ui/build/step-model.js';
import {
  shownStep, clampProgress, previousTarget, nextTarget, progressForStep, phaseSegments, segmentFill, phaseNumber, phaseCount,
  stepAnnouncement, stepMeta, stepMetaParts, dominantLayer, shortcutAllowed,
} from '../../js/ui/build/step-model.js';
import { advancePlayback, stepLabel, SPEEDS } from '../../js/ui/build/step-player.js';
import * as guide from '../../js/ui/build/guide.js';
import { buildFacts } from '../../js/ui/build/info.js';
import * as stage from '../../js/ui/build/stage.js';
import { viewerErrorState, VIEW_LABELS } from '../../js/ui/build/stage.js';
import {
  materialsForScope, hintsByItem, extrasByItem, foldSearch, materialMatches, amountText, slotCount, summarizeMaterials,
} from '../../js/ui/build/material-data.js';
import { positionText, blockTooltipParts } from '../../js/ui/build/kit.js';
import { idSegments } from '../../js/ui/build/materials.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

loadFixtureData();
const result = (() => {
  const b = new Builder();
  buildHouse(b);
  return b.finalize();
})();
const n = result.steps.length;

test('Beispielhaus: Schritte und Kapitel stimmen mit check-build überein', () => {
  assert.equal(n, 18);
  assert.equal(phaseCount(result), 6);
  assert.deepEqual(phaseSegments(result).map((s) => s.count), [1, 4, 2, 5, 3, 3]);
});

test('shownStep, Ziele für vor/zurück und Kommazahlen', () => {
  assert.equal(shownStep(0, n), -1);
  assert.equal(shownStep(1, n), 0);
  assert.equal(shownStep(1.4, n), 1, 'laufender Schritt 1 wird angezeigt');
  assert.equal(shownStep(n, n), n - 1);
  assert.equal(shownStep(5, 0), -1);
  assert.equal(clampProgress(-3, n), 0);
  assert.equal(clampProgress(99, n), n);
  assert.equal(clampProgress(Number.NaN, n), 0);
  assert.equal(progressForStep(4), 5);
  assert.equal(nextTarget(0, n), 1);
  assert.equal(nextTarget(4.4, n), 5, 'ein laufender Schritt wird erst fertig gezeigt');
  assert.equal(nextTarget(n, n), n);
  assert.equal(previousTarget(5, n), 4);
  assert.equal(previousTarget(4.4, n), 4);
  assert.equal(previousTarget(0, n), 0);
});

test('Kapitel-Segmente füllen sich mit dem Fortschritt', () => {
  const [first, second] = phaseSegments(result);
  assert.equal(segmentFill(first, 0), 0);
  assert.equal(segmentFill(first, 1), 1);
  assert.equal(segmentFill(second, 3), 0.5);
  assert.equal(segmentFill(second, n), 1);
  assert.equal(phaseNumber(result, 3), 4);
});

test('Ansagen nennen Schritt, Gesamtzahl und Kapitel – keinen Schritt-Namen', () => {
  assert.equal(stepAnnouncement(result, 0), 'Start – noch kein Block gesetzt. 18 Schritte.');
  assert.equal(stepAnnouncement(result, 1), 'Schritt 1 von 18 (Fundament).');
  assert.equal(stepAnnouncement(result, 1.4), 'Schritt 2 von 18 (Wände).', 'laufender Schritt');
  assert.equal(stepAnnouncement(result, n), 'Schritt 18 von 18 (Vorgarten). Der Bau ist fertig.');
  assert.equal(stepAnnouncement({ steps: [], phases: [] }, 0), 'Der Bau hat keine Schritte.');
  // Anleitungssätze und Notizen gibt es nicht mehr
  for (const name of ['stepInstruction', 'notesByStep']) assert.equal(Object.hasOwn(stepModel, name), false, name);
  assert.equal(Object.hasOwn(guide, 'noteWhere'), false);
  assert.equal(Object.hasOwn(result, 'notes'), false);
  assert.ok(result.steps.every((step) => !Object.hasOwn(step, 'title') && !Object.hasOwn(step, 'text')));
});

test('Häufigste Ebene eines Schritts', () => {
  const door = result.phases.find((phase) => phase.title === 'Tür und Fenster').steps[0];
  assert.equal(dominantLayer(result, 0), 0);
  assert.equal(dominantLayer(result, door), 1, 'Tür: untere Hälfte und obere Hälfte, die untere zählt zuerst');
  assert.equal(dominantLayer(result, 999), null);
});

test('Tastenkürzel nur außerhalb von Eingabefeldern und nicht im Lauf-Modus', () => {
  const target = (match) => ({ closest: (selector) => (selector.split(',').some((part) => match(part.trim())) ? {} : null) });
  const plain = target(() => false);
  assert.equal(shortcutAllowed({ key: 'ArrowRight', target: plain }), true);
  assert.equal(shortcutAllowed({ key: 'ArrowRight', target: plain }, { walkMode: true }), false);
  assert.equal(shortcutAllowed({ key: 'x', target: plain }), false);
  assert.equal(shortcutAllowed({ key: 'ArrowLeft', target: plain, ctrlKey: true }), false);
  assert.equal(shortcutAllowed({ key: 'ArrowLeft', target: target((s) => s === 'input') }), false);
  assert.equal(shortcutAllowed({ key: ' ', target: target((s) => s === 'button') }), false, 'Leertaste gehört dem Knopf');
  assert.equal(shortcutAllowed({ key: 'Home', target: target((s) => s === 'button') }), true);
  assert.equal(shortcutAllowed({ key: 'ArrowLeft', target: target((s) => s === '[data-keys="own"]') }), false, 'Ebenen-Plan nutzt die Pfeile selbst');
});

test('Abspielen: Tempo, Ende und reduzierte Bewegung', () => {
  assert.deepEqual(SPEEDS.map((s) => s.label), ['½×', '1×', '2×', '4×']);
  assert.deepEqual(advancePlayback(2, 600, 1200, n), { p: 2.5, carry: 0 });
  assert.equal(advancePlayback(17.9, 1000, 300, n).p, n, 'nie über das Ende');
  const waiting = advancePlayback(2, 500, 1200, n, { reduced: true });
  assert.deepEqual(waiting, { p: 2, carry: 500 });
  assert.deepEqual(advancePlayback(2, 800, 1200, n, { reduced: true, carry: waiting.carry }), { p: 3, carry: 0 }, 'ganze Schritte');
});

test('Schritt-Label', () => {
  assert.deepEqual(stepLabel(0, n), { main: 'Start', sub: '18 Schritte' });
  assert.deepEqual(stepLabel(5, n), { main: 'Schritt 5', sub: 'von 18' });
  assert.deepEqual(stepLabel(n, n), { main: 'Schritt 18', sub: 'von 18 · fertig' });
  assert.equal(stepLabel(0, 0).main, 'Keine Schritte');
});

test('Kurzinfo eines Schritts in Anleitung und Player', () => {
  // Ebene 1 = y 0, wie im Ebenen-Plan und in den Kapiteltiteln der Formen („Ebene 1–10“)
  assert.equal(stepMeta(result.steps[0]), '63 Blöcke · Ebene 1 (y = 0)');
  assert.equal(stepMeta({ blockCount: 24, layerY: 2 }), '24 Blöcke · Ebene 3 (y = 2)');
  assert.equal(stepMeta({ blockCount: 1, layerY: 1199 }), '1 Block · Ebene 1.200 (y = 1.199)');
  assert.equal(stepMeta({ blockCount: 1, layerY: null }), '1 Block');
  assert.equal(stepMeta({ blockCount: 1234, layerY: null }), '1.234 Blöcke');
  // Teile für die Anleitung: die Ebene bricht nur als Ganzes um
  assert.deepEqual(stepMetaParts({ blockCount: 24, layerY: 2 }), ['24 Blöcke', 'Ebene 3 (y = 2)']);
  assert.deepEqual(stepMetaParts({ blockCount: 12, layerY: null }), ['12 Blöcke']);
});

test('Kennzahlen der Infos: aus dem Bau, sonst aus dem Eintrag und seiner Variante', () => {
  // difficulty als altes Feld: wird nicht mehr gezeigt
  const entry = { difficulty: 2, accuracy: 'massstab', tested: false, size: [10, 20, 30], blocks: 999, steps: 9, variants: { 0.5: { size: [5, 10, 15], blocks: 120, steps: 4 } } };
  const fromResult = Object.fromEntries(buildFacts(entry, result, null).map(([term, value]) => [term, value]));
  assert.equal(fromResult['Blöcke'], '348');
  assert.equal(fromResult['Schritte'], '18');
  assert.equal(fromResult.Kapitel, '6');
  assert.equal(fromResult['Im Spiel getestet'], 'Nein');
  assert.equal(fromResult.Maßstab, undefined);
  const fromVariant = Object.fromEntries(buildFacts(entry, null, 0.5).map(([term, value]) => [term, value]));
  assert.equal(fromVariant['Größe (B × H × L)'], '5 × 10 × 15 Blöcke');
  assert.equal(fromVariant['Blöcke'], '120');
  assert.equal(fromVariant.Maßstab, '1:2');
  assert.equal(fromVariant.Schwierigkeit, undefined, 'keine Schwierigkeit mehr');
  assert.deepEqual(buildFacts(entry, result, null).map(([term]) => term), ['Größe (B × H × L)', 'Blöcke', 'Schritte', 'Kapitel', 'Herkunft', 'Im Spiel getestet']);
});

test('Bau-Seite ohne Schritt-Namen, Texte, Tipps, Notizen, Schwierigkeit und Wissenswertes', () => {
  // Die 3D-Bühne hat keine Notiz-Markierungen mehr (projectPoint diente nur ihnen)
  assert.equal(Object.hasOwn(stage, 'projectPoint'), false);
  const dir = path.join(ROOT, 'js/ui/build');
  const files = [...readdirSync(dir).filter((name) => name.endsWith('.js')).map((name) => path.join(dir, name)), path.join(ROOT, 'js/ui/build-view.js')];
  for (const file of files) {
    // Kommentare dürfen die alten Felder nennen (z. B. „difficulty wird nicht übernommen“)
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const name = path.relative(ROOT, file);
    assert.doesNotMatch(source, /step\??\.(?:title|text)\b|phase\??\.(?:text|tips)\b|\.notes\b|stepTitle|stepInstruction/, `${name}: Schritt-Texte, Tipps oder Notizen`);
    assert.doesNotMatch(source, /bv-marker|bv-note|bv-tips|difficulty|Schwierigkeit|\.facts\b|Wissenswert/, `${name}: Notizen, Schwierigkeit oder Wissenswertes`);
  }
});

test('Fehler des Viewers werden verständlich, Spieldaten ohne Befehle', () => {
  const data = viewerErrorState({ code: 'data', message: 'Die Spieldaten fehlen.' });
  assert.equal(data.title, 'Spieldaten fehlen');
  assert.equal(data.text, 'Die Spieldaten fehlen.');
  assert.ok(data.steps.length > 0, 'ein Hinweis, was man tun kann');
  assert.deepEqual(data.steps.map((step) => step.command).filter(Boolean), [], 'keine Befehle (läuft auch online)');
  assert.doesNotMatch(data.steps.map((step) => step.text).join(' '), /node|scripts\/|Projektordner/);
  // Spieldaten online (js/data/game-data.js): eigener Titel, gleicher Hinweis ohne Befehle
  const offline = viewerErrorState({ code: 'data', title: 'Keine Verbindung zu GitHub', message: 'Die Spieldaten konnten nicht von GitHub geladen werden. Prüfe die Internetverbindung.' });
  assert.equal(offline.title, 'Keine Verbindung zu GitHub');
  assert.match(offline.text, /Internetverbindung/);
  assert.deepEqual(offline.steps, data.steps);
  assert.equal(viewerErrorState({ code: 'data', title: '  ', message: 'x' }).title, 'Spieldaten fehlen', 'leerer Titel → allgemein');
  assert.equal(viewerErrorState({ code: 'no-webgl2', message: 'kein WebGL2' }).title, '3D-Ansicht nicht möglich');
  assert.equal(viewerErrorState({ code: 'build', message: 'kaputt' }).text, 'kaputt');
  // „Erneut versuchen“ nur, wenn es helfen kann: nicht ohne WebGL2 und nicht bei Fehlern der Datei selbst
  assert.deepEqual(['no-webgl2', 'upload', 'build', 'data', 'context-lost', 'worker'].map((code) => viewerErrorState({ code, message: 'x' }).retry), [false, false, true, true, true, true]);
  assert.equal(viewerErrorState({ code: 'upload', message: 'Die Datei ist beschädigt.' }).title, 'Der Bau konnte nicht geladen werden');
  assert.equal(viewerErrorState(null).title, 'Der Bau konnte nicht geladen werden');
  assert.deepEqual(Object.keys(VIEW_LABELS), ['iso', 'top', 'front', 'side']);
});

test('Material: Umfänge, Summen, Suche und Mengen', () => {
  const total = materialsForScope(result, 'total');
  assert.equal(total, result.materials);
  const step0 = materialsForScope(result, 'step', 0);
  assert.deepEqual(step0, [['cobblestone', 63]]);
  const walls = materialsForScope(result, 'phase', 1);
  assert.equal(walls.reduce((sum, [, count]) => sum + count, 0), result.phases[1].steps.reduce((sum, i) => sum + result.steps[i].blockCount, 0));
  assert.deepEqual(materialsForScope(result, 'phase', 99), []);
  assert.throws(() => materialsForScope(result, 'alles'), /Unbekannter Material-Umfang/);
  const sum = summarizeMaterials([['a', 10], ['b', 5]], (item) => item === 'b');
  assert.deepEqual(sum, { kinds: 2, total: 15, doneKinds: 1, remaining: 10 });
  assert.equal(foldSearch('  Grüne_Wolle minecraft:Oak '), 'grune wolle oak');
  assert.equal(materialMatches('oak_planks', 'Eichenholzbretter', 'eichen bretter'), true);
  assert.equal(materialMatches('oak_planks', 'Eichenholzbretter', 'minecraft:oak'), true);
  assert.equal(materialMatches('oak_planks', 'Eichenholzbretter', 'stein'), false);
  assert.equal(materialMatches('oak_planks', 'Eichenholzbretter', '   '), true);
  assert.equal(amountText('stone', 64 * 27 + 70), '1 Shulkerkiste, 1 Stack und 6');
  assert.equal(slotCount(9999), '9.999');
  assert.equal(slotCount(12_345), '12k');
  assert.equal(slotCount(1_250_000), '1,2M');
});

test('Material: Hinweise und Zusatz-Gegenstände aus der Palette', () => {
  const hints = hintsByItem(['air', 'farmland[moisture=0]', 'dirt_path', 'stone']);
  assert.ok([...hints.get('dirt')].some((hint) => /Hacke/.test(hint)));
  const extras = extrasByItem(['potted_poppy']);
  assert.deepEqual([...extras.get('poppy')], ['flower_pot']);
});

test('Block-Tooltip: Koordinaten ohne Tausenderpunkt, Schritt 1-basiert', () => {
  assert.equal(positionText(1200, 3, -4), 'Position x 1200 · y 3 · z -4');
  const parts = blockTooltipParts('oak_log[axis=y]', { step: 3, coords: positionText(1, 3, 3) });
  assert.equal(parts.meta, 'minecraft:oak_log');
  assert.deepEqual(parts.lines.map((line) => line.text).slice(-2), ['Schritt 4', 'Position x 1 · y 3 · z 3'], 'nur die Nummer, kein Schritt-Name');
  assert.deepEqual(blockTooltipParts('stone', { step: 0 }).lines.map((line) => line.text), ['Schritt 1']);
});

test('Material-ID: Umbruch-Stellen nach dem Namensraum und nach Unterstrichen, Text bleibt gleich', () => {
  assert.deepEqual(idSegments('stripped_oak_log'), ['minecraft:', 'stripped_', 'oak_', 'log']);
  assert.deepEqual(idSegments('stone'), ['minecraft:', 'stone']);
  assert.equal(idSegments('polished_blackstone_brick_stairs').join(''), 'minecraft:polished_blackstone_brick_stairs');
});
