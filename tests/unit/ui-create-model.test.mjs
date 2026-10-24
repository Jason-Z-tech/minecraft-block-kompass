// Reine Helfer der Seite „Selber erstellen“ (js/ui/create/model.js) und das Gerüst von erstellen.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CREATE_TABS, tabFromHash, requestFromSearch, createHref, buildHref, shapeHref, scaleLabel, pickExamples, FILE_ACCEPT,
  UNKNOWN_FORMAT_TEXT, formatMegabytes, fileSizeText, checkSelectedFiles, isModelFormat, defaultModelOptions, modelParams,
  titleFromFileName, uploadEntry, shapeSummary, isParamActive, shapeEntry, estimateText, splitShapeMessages, shapeFacts,
  uploadFacts, uploadAdjustments, readStoredShape, MAX_REQUEST_LENGTH,
} from '../../js/ui/create/model.js';
import { SHAPES, SHAPE_IDS, validateShapeParams, shapeQueryString, parseShapeQuery } from '../../js/create/shape-generators.js';
import { UPLOAD_ACCEPT, IMPORT_LIMITS } from '../../js/create/import/index.js';
import { parseRequest } from '../../js/create/text-parser.js';
import { normalizeCatalog } from '../../js/ui/data.js';
import { SHAPE_GLYPH_IDS } from '../../js/ui/create/shape-glyphs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => readFile(path.join(ROOT, file), 'utf8');
const file = (name, size) => ({ name, size });

test('Reiter und Adresse: Anker, ?q= (bereinigt, 200 Zeichen), Links', () => {
  assert.deepEqual(CREATE_TABS, ['idee', 'formen', 'import']);
  assert.equal(tabFromHash('#formen'), 'formen');
  assert.equal(tabFromHash('#IMPORT'), 'import');
  assert.equal(tabFromHash('#main'), null);
  assert.equal(tabFromHash(undefined), null);
  assert.deepEqual(requestFromSearch('?q=%20Burg%0A%20am%20See%20'), { text: 'Burg am See', truncated: false });
  const long = requestFromSearch(`?q=${'a'.repeat(300)}`);
  assert.equal(long.text.length, MAX_REQUEST_LENGTH);
  assert.equal(long.truncated, true);
  assert.equal(requestFromSearch('').text, '');
  assert.equal(createHref('Burg & See', 'formen'), 'erstellen.html?q=Burg%20%26%20See#formen');
  assert.equal(createHref('', 'idee'), 'erstellen.html');
  assert.equal(buildHref('tokyo-skytree', 1), 'bau.html?id=tokyo-skytree&scale=1');
  assert.equal(buildHref('tokyo-skytree', 0.5), 'bau.html?id=tokyo-skytree&scale=0.5');
  assert.equal(buildHref('infinity-castle', null), 'bau.html?id=infinity-castle');
  assert.equal(shapeHref('form=sphere&diameter=25&block=glass&hollow=1&thickness=1'), 'bau.html?form=sphere&diameter=25&block=glass&hollow=1&thickness=1');
  assert.throws(() => shapeHref('id=x'), TypeError);
  assert.throws(() => shapeHref('form=sphere#x'), TypeError);
  assert.equal(scaleLabel(0.25), 'Maßstab 1:4');
  assert.equal(scaleLabel(null), null);
});

test('Beispiele: nur echte Katalog-Einträge, ohne Katalog nur Formen', async () => {
  const catalog = { builds: [
    { id: 'tokyo-skytree', title: 'Tokyo Skytree', category: 'wahrzeichen', accuracy: 'massstab', scales: [1, 0.5] },
    { id: 'infinity-castle', title: 'Infinity Castle', category: 'fantasy', scales: [] },
  ] };
  const examples = pickExamples(catalog);
  assert.equal(examples[0].query, 'Tokyo Skytree Originalgröße 1:1');
  assert.equal(examples[1].query, 'Infinity Castle');
  assert.ok(examples.length <= 6);
  const shapesOnly = pickExamples(null);
  assert.ok(shapesOnly.length >= 3);
  // Jedes Form-Beispiel wird als Form erkannt (die Test-Spieldaten kennen nicht alle Blöcke; das Material prüft
  // tests/visual/create-page-check.mjs mit den echten Daten)
  const names = JSON.parse(await read('tests/fixtures/core/names.json'));
  for (const example of shapesOnly) {
    const result = parseRequest(example.query, { catalog: { builds: [] }, names });
    assert.equal(result.kind, 'shape', example.query);
    assert.deepEqual(result.errors, [], example.query);
  }
});

test('Freitext mit normalisiertem Katalog: Maßstab, eindeutig, ehrlich nicht vorhanden', () => {
  const catalog = normalizeCatalog({ builds: [
    { id: 'tokyo-skytree', title: 'Tokyo Skytree', category: 'wahrzeichen', aliases: ['skytree', 'tokio skytree'], accuracy: 'massstab', scales: [1, 0.5, 0.25], defaultScale: 1 },
    { id: 'infinity-castle', title: 'Infinity Castle', category: 'fantasy', accuracy: 'nachempfunden', scales: [] },
  ] });
  const sky = parseRequest('Tokio Skytree Originalgrösse 1:1 (1 Block = 1 m)', { catalog });
  assert.equal(sky.kind, 'build');
  assert.equal(sky.matches.length, 1);
  assert.equal(buildHref(sky.matches[0].entry.id, sky.matches[0].scale), 'bau.html?id=tokyo-skytree&scale=1');
  const half = parseRequest('Skytree halbe Größe', { catalog });
  assert.equal(half.matches[0].scale, 0.5);
  const castle = parseRequest('Infinity Castle', { catalog });
  assert.equal(castle.kind, 'build');
  assert.equal(buildHref(castle.matches[0].entry.id, castle.matches[0].scale), 'bau.html?id=infinity-castle');
  const burj = parseRequest('Burj Khalifa', { catalog });
  assert.equal(burj.kind, 'none');
  assert.equal(burj.suggestions.length, 0);
});

test('Datei-Vorprüfung: Endung, Größe, leere Datei, .mtl nur zu .obj', () => {
  assert.equal(FILE_ACCEPT, `${UPLOAD_ACCEPT},.mtl`);
  assert.deepEqual(checkSelectedFiles([]), { ok: false, error: 'Keine Datei gewählt.' });
  const ok = checkSelectedFiles([file('Haus.schem', 2000)]);
  assert.equal(ok.ok, true);
  assert.equal(ok.format, 'schem');
  assert.equal(ok.mtl, null);
  assert.equal(checkSelectedFiles([file('alt.schematic', 120)]).format, 'schem');
  assert.equal(checkSelectedFiles([file('notiz.txt', 10)]).error, UNKNOWN_FORMAT_TEXT);
  assert.equal(checkSelectedFiles([file('leer.nbt', 0)]).error, 'Die Datei ist leer.');
  const big = checkSelectedFiles([file('riesig.litematic', IMPORT_LIMITS.maxFileBytes + 1)]);
  assert.equal(big.ok, false);
  assert.match(big.error, /^Die Datei ist zu groß \(64 MB\) – erlaubt sind höchstens 64 MB\.$/);
  assert.equal(checkSelectedFiles([file('a.schem', 5), file('b.nbt', 5)]).ok, false);
  const obj = checkSelectedFiles([file('m.mtl', 40), file('m.obj', 300)]);
  assert.equal(obj.ok, true);
  assert.equal(obj.format, 'obj');
  assert.equal(obj.mtl.name, 'm.mtl');
  assert.equal(checkSelectedFiles([file('m.mtl', 40)]).ok, false);
  assert.equal(checkSelectedFiles([file('m.stl', 40), file('m.mtl', 40)]).ok, false);
  assert.equal(isModelFormat('glb'), true);
  assert.equal(isModelFormat('nbt'), false);
  assert.equal(formatMegabytes(1.5 * 1024 * 1024), '1,5 MB');
  assert.equal(fileSizeText(812), '812 Bytes');
  assert.equal(fileSizeText(14 * 1024), '14 KB');
  assert.equal(fileSizeText(-1), '–');
});

test('Einstellungen für 3D-Modelle → params für den Voxelizer', () => {
  assert.equal(defaultModelOptions('vox').keepSize, true);
  assert.equal(defaultModelOptions('stl').keepSize, false);
  assert.deepEqual(modelParams('stl', { ...defaultModelOptions('stl'), height: '80', solid: true }),
    { ok: true, params: { height: 80, solid: true, palette: 'alle', upAxis: 'auto' }, errors: [] });
  // .vox in Originalgröße: keine Höhe
  assert.deepEqual(modelParams('vox', defaultModelOptions('vox')).params, { solid: false, palette: 'alle', upAxis: 'auto' });
  const single = modelParams('obj', { ...defaultModelOptions('obj'), palette: 'einfarbig', block: 'minecraft:Red_Concrete ' });
  assert.equal(single.params.block, 'red_concrete');
  const bad = modelParams('glb', { height: '0', palette: 'gold', upAxis: 'x' });
  assert.equal(bad.ok, false);
  assert.equal(bad.params, null);
  assert.equal(bad.errors.length, 3);
  assert.equal(modelParams('stl', { ...defaultModelOptions('stl'), height: '12.5' }).ok, false);
  assert.equal(modelParams('stl', { ...defaultModelOptions('stl'), palette: 'einfarbig', block: '<b>' }).ok, false);
});

test('Einträge für die Bau-Ansicht: Upload und Form', () => {
  assert.equal(titleFromFileName('C:\\Bauten\\Burg am See.litematic'), 'Burg am See');
  assert.equal(titleFromFileName('.schem'), '.schem');
  assert.equal(titleFromFileName(''), 'Importierte Datei');
  assert.equal(titleFromFileName(`${'x'.repeat(300)}.nbt`).length, 120);
  assert.deepEqual(uploadEntry('haus.schem', 'schem'), { title: 'haus', subtitle: 'Importiert aus Sponge-Schematic (.schem)', accuracy: 'eigenes', tags: ['Import', 'Bauplan'] });
  assert.equal(uploadEntry('kopf.stl', 'stl').tags[1], '3D-Modell');
  const names = { block: { glass: { de: 'Glas', en: 'Glass' } }, item: {} };
  const params = validateShapeParams('sphere', { diameter: 25, block: 'glass', hollow: true }).params;
  assert.equal(shapeSummary('sphere', params, names), 'Durchmesser 25 · Glas · hohl');
  const entry = shapeEntry('sphere', params, names);
  assert.equal(entry.title, 'Kugel');
  assert.equal(entry.accuracy, 'eigenes');
  const tower = validateShapeParams('cylinder', { roof: 'cone', battlements: true }).params;
  assert.match(shapeSummary('cylinder', tower, names), /Zinnen · Kegeldach \(spitz\)$/);
  assert.equal(isParamActive(SHAPES.cylinder.params.find((p) => p.key === 'roofBlock'), { roof: 'none' }), false);
  assert.equal(isParamActive(SHAPES.cylinder.params.find((p) => p.key === 'roofBlock'), { roof: 'dome' }), true);
  assert.equal(isParamActive(SHAPES.sphere.params.find((p) => p.key === 'thickness'), { hollow: false }), false);
});

test('Formen: Meldungen den Feldern zuordnen, Kennzahlen', () => {
  const check = validateShapeParams('sphere', { diameter: '999', block: 'nope_block' }, { blocks: ['glass', 'stone'] });
  const split = splitShapeMessages('sphere', check.errors);
  assert.deepEqual(Object.keys(split.byKey).sort(), ['block', 'diameter']);
  assert.match(split.byKey.diameter[0], /^Bitte eine ganze Zahl von 3 bis 301/);
  assert.deepEqual(split.general, []);
  assert.deepEqual(splitShapeMessages('sphere', ['Etwas anderes.']).general, ['Etwas anderes.']);
  assert.equal(estimateText(2854), 'bis zu 2.854 Blöcke');
  assert.equal(estimateText(0), '–');
  const ok = validateShapeParams('sphere', { diameter: 25, block: 'glass' });
  const facts = shapeFacts('sphere', ok.params, ok.estimate, { size: [25, 25, 25], amount: '44 Stacks' });
  assert.deepEqual(facts.map(([term]) => term), ['Größe (B × H × L)', 'Ebenen', 'Blöcke (Schätzung)', 'Das sind höchstens', 'Material']);
  assert.equal(facts[0][1], '25 × 25 × 25 Blöcke');
});

test('Gespeicherte Form: nur bekannte Formen und Schlüssel, Werte werden später geprüft', () => {
  assert.equal(readStoredShape(null), null);
  assert.equal(readStoredShape({ shape: '__proto__' }), null);
  assert.equal(readStoredShape({ shape: 'unbekannt' }), null);
  assert.deepEqual(readStoredShape({ shape: 'cube', raw: { size: 12, block: 'stone', hollow: true, extra: 1, x: { a: 1 } } }),
    { shape: 'cube', raw: { size: 12, block: 'stone', hollow: true } });
  assert.deepEqual(readStoredShape({ shape: 'cube', raw: { block: 'x'.repeat(200) } }).raw, {});
  // Rundweg über die Adresse der Bau-Seite
  const params = validateShapeParams('spiral-stairs', { height: 12, stairs: 'spruce_stairs', core: '' }).params;
  const parsed = parseShapeQuery(shapeQueryString('spiral-stairs', params));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.params, params);
});

test('Kennzahlen eines Imports und Anpassungen verständlich', () => {
  const upload = {
    formatLabel: 'Litematica v6', size: [12, 9, 30], blockCount: 1834, paletteSize: 23, regions: 2, title: 'Burg', author: 'Jemand',
    dataVersion: 4903, fileBytes: 20480, compression: 'gzip', model: null,
    renamed: [['chain', 3], ['grass', 2]], dropped: [['create:shaft', 7]], fixedValues: 1, entities: 2,
  };
  const facts = Object.fromEntries(uploadFacts(upload));
  assert.equal(facts.Format, 'Litematica v6');
  assert.equal(facts['Größe (B × H × L)'], '12 × 9 × 30');
  assert.equal(facts.Blöcke, '1.834');
  assert.equal(facts['Verschiedene Zustände'], '22');
  assert.equal(facts.Regionen, '2');
  assert.equal(facts.Packung, 'gzip');
  assert.equal(facts.Dateigröße, '20 KB');
  assert.deepEqual(uploadAdjustments(upload).map((item) => item.text), [
    '5 Blöcke auf 26.2-Namen umbenannt', '7 Blöcke weggelassen (gibt es in 26.2 nicht)', '1 Wert auf Standard gesetzt', '2 Objekte nicht angezeigt',
  ]);
  assert.deepEqual(uploadFacts(null), []);
  assert.deepEqual(uploadAdjustments({ renamed: 'x', dropped: [['a', 'b']] }), []);
});

test('Jede Form hat ein Pixel-Symbol', () => {
  assert.deepEqual([...SHAPE_GLYPH_IDS].sort(), [...SHAPE_IDS].sort());
});

test('erstellen.html: Stylesheets in Reihenfolge, Reiter vollständig, keine Inline-Styles', async () => {
  const html = await read('erstellen.html');
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(sheets, ['css/style.css', 'css/build-view.css', 'css/create.css']);
  for (const key of CREATE_TABS) {
    assert.match(html, new RegExp(`id="create-tab-${key}"[^>]*aria-controls="create-panel-${key}"`));
    assert.match(html, new RegExp(`role="tabpanel" id="create-panel-${key}" aria-labelledby="create-tab-${key}"`));
  }
  assert.match(html, /<input class="dropzone__input visually-hidden" id="import-file" type="file" multiple/);
  assert.match(html, /<label class="dropzone__label" for="import-file">/);
  assert.match(html, /id="create-query"[^>]*maxlength="200"/);
  const css = await read('css/create.css');
  assert.doesNotMatch(css, /@import|url\(\s*['"]?(?:https?:)?\/\//i, 'keine externen Ressourcen');
});
