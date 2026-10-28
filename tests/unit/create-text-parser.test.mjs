// Freitext-Erkennung (js/create/text-parser.js): Bau, Form oder ehrlich „nicht gefunden“ – mit echten Beispielsätzen.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseRequest, extractScale, formatScale, cleanRequest, MAX_REQUEST_LENGTH } from '../../js/create/text-parser.js';
import { parseShapeQuery } from '../../js/create/shape-generators.js';

const catalog = JSON.parse(readFileSync(new URL('../fixtures/create/catalog.json', import.meta.url), 'utf8'));

// Auszug aus names.json/blocks.json von Minecraft 26.2 (echte Namen)
const NAMES = {
  block: {
    stone: { de: 'Stein', en: 'Stone' }, stone_bricks: { de: 'Steinziegel', en: 'Stone Bricks' },
    stone_brick_stairs: { de: 'Steinziegeltreppe', en: 'Stone Brick Stairs' }, glass: { de: 'Glas', en: 'Glass' },
    glass_pane: { de: 'Glasscheibe', en: 'Glass Pane' }, red_stained_glass: { de: 'Rotes Glas', en: 'Red Stained Glass' },
    white_concrete: { de: 'Weißer Beton', en: 'White Concrete' }, sandstone: { de: 'Sandstein', en: 'Sandstone' },
    oak_planks: { de: 'Eichenholzbretter', en: 'Oak Planks' }, oak_stairs: { de: 'Eichenholztreppe', en: 'Oak Stairs' },
    spruce_planks: { de: 'Fichtenholzbretter', en: 'Spruce Planks' }, spruce_stairs: { de: 'Fichtenholztreppe', en: 'Spruce Stairs' },
    quartz_block: { de: 'Quarzblock', en: 'Block of Quartz' }, quartz_stairs: { de: 'Quarztreppe', en: 'Quartz Stairs' },
    gold_block: { de: 'Goldblock', en: 'Block of Gold' }, ice: { de: 'Eis', en: 'Ice' }, cobblestone: { de: 'Bruchstein', en: 'Cobblestone' },
    oak_fence: { de: 'Eichenholzzaun', en: 'Oak Fence' }, deepslate_bricks: { de: 'Tiefenschieferziegel', en: 'Deepslate Bricks' },
  },
  item: {},
};
const BLOCKS = { version: '26.2', blocks: Object.fromEntries(Object.keys(NAMES.block).map((id) => [id, { props: {}, default: {} }])) };
const opts = { catalog, names: NAMES, blocks: BLOCKS };
const parse = (text, extra = {}) => parseRequest(text, { ...opts, ...extra });

function expectBuild(text, id, { scale, count } = {}) {
  const r = parse(text);
  assert.equal(r.kind, 'build', `${text} → ${r.kind} ${r.reason ?? ''}`);
  assert.equal(r.matches[0].entry.id, id, `${text}: ${r.matches.map((m) => m.entry.id).join(', ')}`);
  if (scale !== undefined) assert.equal(r.scale, scale, `${text}: Maßstab`);
  if (count !== undefined) assert.equal(r.matches.length, count, `${text}: ${r.matches.map((m) => m.entry.id).join(', ')}`);
  return r;
}

function expectShape(text, shape, params = {}) {
  const r = parse(text);
  assert.equal(r.kind, 'shape', `${text} → ${r.kind}`);
  assert.equal(r.shape, shape, text);
  for (const [key, value] of Object.entries(params)) assert.equal(r.params[key], value, `${text}: ${key}`);
  assert.ok(r.ok, `${text}: ${r.errors.join(' ')}`);
  return r;
}

describe('Bauten aus dem Katalog', () => {
  test('„Tokio Skytree Originalgrösse 1:1 (1 Block = 1 m)“ → tokyo-skytree, Maßstab 1', () => {
    const r = expectBuild('Tokio Skytree Originalgrösse 1:1 (1 Block = 1 m)', 'tokyo-skytree', { scale: 1, count: 1 });
    assert.equal(r.scaleText, '1:1');
    assert.deepEqual(r.notes, []);
  });
  test('„Tokyo Sky Tree halbe Größe“ → 0.5', () => expectBuild('Tokyo Sky Tree halbe Größe', 'tokyo-skytree', { scale: 0.5, count: 1 }));
  test('„Infinity Castle“', () => expectBuild('Infinity Castle', 'infinity-castle', { count: 1, scale: null }));
  test('„infinity castle aus demon slayer“', () => expectBuild('infinity castle aus demon slayer', 'infinity-castle', { count: 1 }));
  test('„Eifelturm“ (Tippfehler)', () => expectBuild('Eifelturm', 'eiffelturm', { count: 1 }));
  test('ohne Maßstab → defaultScale', () => expectBuild('Tokyo Skytree', 'tokyo-skytree', { scale: 0.5 }));

  const cases = [
    ['Tokyo Skytree in Originalgröße', 'tokyo-skytree', 1],
    ['Skytree in echter Größe', 'tokyo-skytree', 1],
    ['Skytree Original-Größe', 'tokyo-skytree', 1],
    ['skytree originalgross', 'tokyo-skytree', 1],
    ['Tokyo Skytree 1 zu 1', 'tokyo-skytree', 1],
    ['Tokyo Skytree Maßstab 1:4', 'tokyo-skytree', 0.25],
    ['Tokyo Skytree Viertel', 'tokyo-skytree', 0.25],
    ['Tokyo Skytree 50 %', 'tokyo-skytree', 0.5],
    ['Tokyo Skytree 1:2', 'tokyo-skytree', 0.5],
    ['TOKIO SKYTREE', 'tokyo-skytree', 0.5],
    ['Ich möchte den Eiffelturm bauen', 'eiffelturm', 0.5],
    ['Eiffel Tower', 'eiffelturm', 0.5],
    ['Infinty Castel', 'infinity-castle', null],
    ['Mugen-jō', 'infinity-castle', null],
    ['Unendlichkeitsburg', 'infinity-castle', null],
    ['Big Ben', 'big-ben', 1],
    ['Kolosseum 50 %', 'kolosseum', 0.5],
    ['Golden Gate Brücke', 'golden-gate-bridge', 0.5],
    ['Golden Gate Bridge', 'golden-gate-bridge', 0.5],
    ['Schloss Neuschwanstein', 'neuschwanstein', null],
    ['Leuchtturm', 'leuchtturm', null],
    ['Hobbit Höhle', 'hobbit-hoehle', null],
    ['iron farm', 'eisenfarm', null],
    ['Sakura', 'kirschbluetenbaum', null],
    ['Windmühle', 'windmuehle', null],
    ['Pyramide von Gizeh', 'cheops-pyramide', 0.25],
    ['Wachturm aus Holz', 'wachturm', null],
    ['Tokyo Tower', 'tokyo-tower', 1],
  ];
  for (const [text, id, scale] of cases) {
    test(`„${text}“ → ${id}`, () => expectBuild(text, id, { scale }));
  }

  test('Maßstab, den es nicht gibt → nächster erlaubter mit Hinweis', () => {
    const r = expectBuild('Eiffelturm 1:3', 'eiffelturm', { scale: 0.25 });
    assert.match(r.notes[0], /1:3 gibt es für „Eiffelturm“ nicht.*1:4/);
    const ben = expectBuild('Big Ben Maßstab 1:4', 'big-ben', { scale: 0.5 });
    assert.match(ben.notes[0], /nächsten möglichen Maßstab 1:2/);
  });

  test('Maßstab bei einem Bau ohne Maßstäbe wird nicht still verschluckt', () => {
    const r = expectBuild('Windmühle 1:1', 'windmuehle', { scale: null });
    assert.match(r.notes[0], /nur in einer Größe/);
  });

  test('widersprüchliche Maßstäbe', () => {
    const r = expectBuild('Tokyo Skytree 1:1 halbe Größe', 'tokyo-skytree', { scale: 1 });
    assert.match(r.notes[0], /mehrere Maßstäbe/);
  });
});

describe('mehrdeutig → mehrere Treffer statt raten', () => {
  test('„Turm“ → mehrere Bauten plus Form als Alternative', () => {
    const r = parse('Turm');
    assert.equal(r.kind, 'build');
    assert.ok(r.matches.length >= 4);
    assert.ok(r.matches.every((m) => /turm|tower/i.test(`${m.entry.title} ${m.entry.tags.join(' ')} ${m.entry.aliases.join(' ')}`)));
    assert.equal(r.alternative.kind, 'shape');
    assert.equal(r.alternative.shape, 'cylinder');
    assert.ok(parseShapeQuery(r.alternative.queryString).ok);
  });

  test('„Tokyo“ → Skytree und Tower', () => {
    const r = parse('Tokyo');
    assert.deepEqual(r.matches.map((m) => m.entry.id).sort(), ['tokyo-skytree', 'tokyo-tower']);
  });

  test('„Burg“ → mehrere Burgen', () => {
    const r = parse('Burg');
    assert.ok(r.matches.length >= 2);
    assert.equal(r.matches[0].entry.id, 'mittelalterliche-burg');
  });

  test('„Brücke“ → alle Brücken', () => {
    const r = parse('Brücke');
    const got = r.matches.map((m) => m.entry.id);
    assert.ok(got.includes('golden-gate-bridge') && got.includes('steinbruecke'), got.join(', '));
  });

  test('„Tokyo Tower“: Bau statt Turm-Form, keine Alternative', () => {
    const r = parse('Tokyo Tower');
    assert.equal(r.matches.length, 1);
    assert.equal(r.alternative, null);
  });
});

describe('Formen', () => {
  test('„hohle Kugel Radius 15 aus Glas“', () => {
    const r = expectShape('hohle Kugel Radius 15 aus Glas', 'sphere', { diameter: 31, block: 'glass', hollow: true });
    assert.ok(r.understood.includes('Durchmesser 31 (aus Radius 15)'));
    assert.ok(r.understood.includes('Block: Glas · minecraft:glass'));
    assert.deepEqual(r.warnings, []);
    assert.equal(r.queryString, 'form=sphere&diameter=31&block=glass&hollow=1&thickness=1');
  });
  test('„Turm 40 hoch Durchmesser 9 aus Steinziegeln“', () => expectShape('Turm 40 hoch Durchmesser 9 aus Steinziegeln', 'cylinder', { height: 40, diameter: 9, block: 'stone_bricks', hollow: true }));
  test('„Pyramide 31 breit aus Sandstein“', () => expectShape('Pyramide 31 breit aus Sandstein', 'pyramid', { width: 31, block: 'sandstone' }));
  test('„Kuppel Durchmesser 21“', () => expectShape('Kuppel Durchmesser 21', 'dome', { diameter: 21 }));
  test('„Bogen 15 breit 10 hoch“', () => expectShape('Bogen 15 breit 10 hoch', 'arch', { width: 15, height: 10 }));
  test('„Ring Radius 20“', () => expectShape('Ring Radius 20', 'torus', { radius: 20 }));
  test('„Würfel 10“', () => expectShape('Würfel 10', 'cube', { size: 10 }));
  test('„Quader 10x5x20 aus Holz“', () => expectShape('Quader 10x5x20 aus Holz', 'cuboid', { width: 10, height: 5, length: 20, block: 'oak_planks' }));
  test('„Kegel“ mit Standardwerten', () => {
    const r = expectShape('Kegel', 'cone', { diameter: 11, height: 15 });
    assert.ok(r.defaults.includes('Höhe 15 (Standard)'));
  });
  test('„Wendeltreppe 30 hoch“', () => expectShape('Wendeltreppe 30 hoch', 'spiral-stairs', { height: 30, stairs: 'oak_stairs' }));
  test('„Kugel“ allein', () => {
    const r = expectShape('Kugel', 'sphere', { diameter: 21, block: 'glass' });
    assert.deepEqual(r.understood, ['Form: Kugel']);
    assert.ok(r.defaults.some((d) => d.startsWith('Durchmesser 21')));
  });

  const cases = [
    ['Glaskugel 25', 'sphere', { diameter: 25, block: 'glass' }],
    ['volle Kugel Durchmesser 11 aus Stein', 'sphere', { diameter: 11, hollow: false, block: 'stone' }],
    ['Kugel r=7', 'sphere', { diameter: 15 }],
    ['Kugel aus weißem Beton', 'sphere', { block: 'white_concrete' }],
    ['Halbkugel Radius 10 aus rotem Glas', 'dome', { diameter: 21, block: 'red_stained_glass' }],
    ['Kuppel 31 aus Quarz', 'dome', { diameter: 31, block: 'quartz_block' }],
    ['Steinturm 30 hoch', 'cylinder', { height: 30, block: 'stone' }],
    ['Säule 12 hoch aus Quarz', 'cylinder', { height: 12, hollow: false, block: 'quartz_block' }],
    ['Turm 25 hoch mit Zinnen', 'cylinder', { height: 25, battlements: true }],
    ['Turm mit Kegeldach aus Fichtenholzbrettern', 'cylinder', { roof: 'cone', roofBlock: 'spruce_planks', block: 'stone_bricks' }],
    ['Turm 20 hoch Durchmesser 11 mit Boden und Flachdach', 'cylinder', { floor: true, roof: 'flat', diameter: 11 }],
    ['Turm 30 Blöcke hoch, 2 Blöcke dick', 'cylinder', { height: 30, thickness: 2 }],
    ['Zylinder Höhe 10 Radius 4', 'cylinder', { height: 10, diameter: 9 }],
    ['Kegel 20 hoch Durchmesser 15 aus Sandstein', 'cone', { height: 20, diameter: 15, block: 'sandstone' }],
    ['Pyramide Höhe 16', 'pyramid', { width: 31 }],
    ['hohle Pyramide 21 breit', 'pyramid', { width: 21, hollow: true }],
    ['Würfel Kantenlänge 7 hohl', 'cube', { size: 7, hollow: true }],
    ['Quader Breite 12 Höhe 4 Länge 30', 'cuboid', { width: 12, height: 4, length: 30 }],
    ['Ellipsoid 21x15x31', 'ellipsoid', { width: 21, height: 15, length: 31 }],
    ['Torus Radius 30 Dicke 7 aus Gold', 'torus', { radius: 30, tube: 3, block: 'gold_block' }],
    ['Donut Radius 12 Röhre 4', 'torus', { radius: 12, tube: 4 }],
    ['Kreis Radius 10', 'circle', { diameter: 21, hollow: true }],
    ['Scheibe Durchmesser 15 aus Bruchstein', 'circle', { diameter: 15, hollow: false, block: 'cobblestone' }],
    ['Torbogen 9 breit 7 hoch 3 tief', 'arch', { width: 9, height: 7, depth: 3 }],
    ['Wendeltreppe 50 hoch aus Steinziegeln mit Wand aus Glas', 'spiral-stairs', { height: 50, stairs: 'stone_brick_stairs', wall: 'glass' }],
    ['Wendeltreppe 20 hoch gegen den Uhrzeigersinn', 'spiral-stairs', { height: 20, clockwise: false }],
    ['Wendeltreppe aus Quarz', 'spiral-stairs', { stairs: 'quartz_stairs' }],
    ['zehn hohe Säule', 'cylinder', { height: 10 }],
    ['sphere diameter 9 of glass', 'sphere', { diameter: 9, block: 'glass' }],
  ];
  for (const [text, shape, params] of cases) {
    test(`„${text}“ → ${shape}`, () => expectShape(text, shape, params));
  }

  test('„Würfel 10x5x20“ wird ein Quader mit Hinweis', () => {
    const r = expectShape('Würfel 10x5x20', 'cuboid', { width: 10, height: 5, length: 20 });
    assert.match(r.warnings[0], /gleich lange Kanten/);
  });

  test('zu große Zahlen werden begrenzt und gemeldet', () => {
    const r = expectShape('Kugel Durchmesser 5000', 'sphere', { diameter: 301 });
    assert.ok(r.warnings.some((w) => /zu groß – höchstens 301/.test(w)));
  });

  test('zu viele Blöcke → Fehler statt raten', () => {
    const r = parse('volle Kugel Durchmesser 301');
    assert.equal(r.kind, 'shape');
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /höchstens 2 Mio/);
  });

  test('unbekanntes Material → Warnung mit Standardblock', () => {
    const r = expectShape('Kugel aus Unobtanium', 'sphere', { block: 'glass' });
    assert.ok(r.warnings.some((w) => /„unobtanium“ habe ich nicht gefunden/.test(w)));
  });

  test('kein voller Block → Warnung', () => {
    const r = expectShape('Kugel aus Glasscheiben', 'sphere', { block: 'glass_pane' });
    assert.ok(r.warnings.some((w) => /kein voller Block/.test(w)));
  });

  test('ungenutzte Wörter und Maße werden genannt', () => {
    const r = expectShape('Kugel für meine Basis', 'sphere');
    assert.ok(r.warnings.some((w) => /nicht verwendet: „basis“/.test(w)));
    const cube = expectShape('Würfel 10 Radius 5', 'cube', { size: 10 });
    assert.ok(cube.warnings.some((w) => /„radius 5“ passt nicht zu Würfel/.test(w)));
  });

  test('Maßstab bei einer Form wird genannt, nicht still verschluckt', () => {
    const r = expectShape('Kugel 1:2', 'sphere');
    assert.ok(r.warnings.some((w) => /keinen Maßstab/.test(w)));
  });

  test('Ergebnis passt zur Adresse der Bau-Seite', () => {
    const r = expectShape('Turm 40 hoch Durchmesser 9 aus Steinziegeln', 'cylinder');
    const parsed = parseShapeQuery(r.queryString);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.params, r.params);
  });
});

describe('nicht gefunden – ehrlich', () => {
  test('„Burj Khalifa“ → none mit Begründung und Hinweisen', () => {
    const r = parse('Burj Khalifa');
    assert.equal(r.kind, 'none');
    assert.equal(r.reason, 'Für „Burj Khalifa“ gibt es noch keinen geprüften Bauplan.');
    assert.ok(r.hints.some((h) => /Formen-Generator/.test(h)));
    assert.ok(r.hints.some((h) => /importieren/.test(h)));
    for (const s of r.suggestions) assert.ok(catalog.builds.includes(s.entry), 'Vorschläge nur aus dem Katalog');
  });

  test('Vorschläge nur aus echten Einträgen (niedrigere Schwelle)', () => {
    const r = parse('Japanischer Tempel mit Garten');
    assert.equal(r.kind, 'none');
    assert.ok(r.suggestions.length > 0);
    assert.ok(r.suggestions.every((s) => catalog.builds.includes(s.entry)));
  });

  for (const text of ['Raumschiff Enterprise', 'Burj Khalifa 1:1', 'Mondbasis aus Käse']) {
    test(`„${text}“ → none`, () => assert.equal(parse(text).kind, 'none'));
  }

  test('Redstone-Bauten gibt es nicht mehr: „kolbentür“ → none', () => {
    assert.ok(catalog.builds.every((b) => b.category !== 'redstone'), 'Fixture ohne Kategorie redstone');
    const r = parse('kolbentür');
    assert.equal(r.kind, 'none');
    assert.equal(r.reason, 'Für „kolbentür“ gibt es noch keinen geprüften Bauplan.');
  });

  test('ohne Katalog: Formen gehen, Bauten nicht', () => {
    assert.equal(parseRequest('Tokyo Skytree', { names: NAMES, blocks: BLOCKS }).kind, 'none');
    assert.equal(parseRequest('Würfel 5', { names: NAMES, blocks: BLOCKS }).kind, 'shape');
    assert.equal(parseRequest('Turm', {}).kind, 'shape');
  });
});

describe('Grenzfälle', () => {
  test('leer, nur Leerzeichen, kein Text', () => {
    for (const input of ['', '    ', null, undefined, 42, {}, ['Turm']]) {
      const r = parse(input);
      assert.equal(r.kind, 'none');
      assert.equal(r.query, '');
      assert.match(r.reason, /Schreib, was du bauen möchtest/);
    }
  });

  test('500 Zeichen werden auf 200 gekürzt', () => {
    const long = `Tokyo Skytree ${'x'.repeat(486)}`;
    const r = parse(long);
    assert.equal(r.truncated, true);
    assert.equal(Array.from(r.query).length, MAX_REQUEST_LENGTH);
    assert.equal(r.kind, 'build');
    assert.ok(r.notes.some((n) => /länger als 200 Zeichen/.test(n)));
  });

  test('nur Zahlen', () => {
    const r = parse('12345');
    assert.equal(r.kind, 'none');
    assert.match(r.reason, /kann ich nichts anfangen/);
    assert.deepEqual(r.suggestions, []);
  });

  test('Sonderzeichen und HTML bleiben reiner Text', () => {
    const r = parse('<script>alert(1)</script>');
    assert.equal(r.kind, 'none');
    assert.equal(r.query, '<script>alert(1)</script>');
    assert.equal(parse('!!!???***').kind, 'none');
    assert.equal(parse('🏰🗼').kind, 'none');
  });

  test('Steuer- und unsichtbare Zeichen werden entfernt', () => {
    assert.deepEqual(cleanRequest('Tokyo\u0000\u200b Skytree\n'), { text: 'Tokyo Skytree', truncated: false });
    assert.equal(parse('Tokyo\u202eSkytree').kind, 'build');
  });

  test('Emojis werden beim Kürzen nicht zerschnitten', () => {
    const { text } = cleanRequest('🏰'.repeat(300));
    assert.equal(Array.from(text).length, 200);
    assert.ok(!/[\ud800-\udbff]$/.test(text));
  });

  test('sehr lange Eingabe bleibt schnell', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) parse(`Turm ${'1x2x3 aus aus aus '.repeat(40)}`);
    assert.ok(performance.now() - start < 2000);
  });
});

describe('Maßstab erkennen', () => {
  const cases = [
    ['1:1', 1], ['1 zu 1', 1], ['originalgroesse', 1], ['original groesse', 1], ['originalgross', 1], ['originalgrosse', 1],
    ['1 block = 1 m', 1], ['1 block pro meter', 1], ['echte groesse', 1], ['halbe groesse', 0.5], ['1:2', 0.5], ['50 %', 0.5],
    ['massstab 1:4', 0.25], ['viertel', 0.25], ['25 prozent', 0.25], ['1:10', 0.1],
  ];
  for (const [text, scale] of cases) {
    test(`„${text}“ → ${scale}`, () => assert.equal(extractScale(text).scale, scale));
  }
  test('ohne Angabe', () => assert.equal(extractScale('tokyo skytree').scale, null));
  test('formatScale', () => {
    assert.equal(formatScale(1), '1:1');
    assert.equal(formatScale(0.5), '1:2');
    assert.equal(formatScale(0.25), '1:4');
    assert.equal(formatScale(2), '2:1');
  });
});

const GAME_DATA = new URL('../../game-data/', import.meta.url);
const hasGameData = existsSync(new URL('names.json', GAME_DATA)) && existsSync(new URL('blocks.json', GAME_DATA));
describe('mit den echten Spieldaten', { skip: hasGameData ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)' }, () => {
  const real = hasGameData ? {
    catalog,
    names: JSON.parse(readFileSync(new URL('names.json', GAME_DATA), 'utf8')),
    blocks: JSON.parse(readFileSync(new URL('blocks.json', GAME_DATA), 'utf8')),
  } : null;
  const cases = [
    ['hohle Kugel Radius 15 aus Glas', 'sphere', 'block', 'glass'],
    ['Turm 40 hoch Durchmesser 9 aus Steinziegeln', 'cylinder', 'block', 'stone_bricks'],
    ['Pyramide 31 breit aus Sandstein', 'pyramid', 'block', 'sandstone'],
    ['Kugel aus weißem Beton', 'sphere', 'block', 'white_concrete'],
    ['Würfel 8 aus Tiefenschieferziegeln', 'cube', 'block', 'deepslate_bricks'],
    ['Wendeltreppe 30 hoch aus Tiefenschieferziegeln', 'spiral-stairs', 'stairs', 'deepslate_brick_stairs'],
  ];
  for (const [text, shape, key, id] of cases) {
    test(`„${text}“`, () => {
      const r = parseRequest(text, real);
      assert.equal(r.kind, 'shape');
      assert.equal(r.shape, shape);
      assert.equal(r.params[key], id);
      assert.ok(r.ok, r.errors.join(' '));
    });
  }
});
