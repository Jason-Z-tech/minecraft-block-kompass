// Formen-Generator (js/create/shape-generators.js): Schnittstelle, Prüfung, Bauen, Adresse, Worker-Vertrag.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadFixtureData, readFixture } from '../fixtures/core/setup.mjs';
import { Builder } from '../../js/core/builder.js';
import { setBlockData } from '../../js/core/block-data.js';
import * as generators from '../../js/create/shape-generators.js';
import { checkSource, buildShapeResult, EngineError } from '../../js/render/engine-worker.js';

const {
  SHAPES, SHAPE_IDS, MAX_SHAPE_BLOCKS, validateShapeParams, buildShape, parseShapeQuery, shapeQueryString, defaultShapeParams, shapeSize, archGrid,
} = generators;

// Blöcke aus tests/fixtures/core/blocks.json (dort gibt es z. B. keinen Sandstein)
const FIXTURE_BLOCK = { pyramid: 'stone', ellipsoid: 'stone', torus: 'stone_bricks' };
const PARAM_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;

function build(shapeId, params = {}) {
  const b = new Builder();
  buildShape(b, shapeId, params);
  return b.finalize();
}

function withFixtureBlock(shapeId, params = {}) {
  return FIXTURE_BLOCK[shapeId] && params.block === undefined ? { ...params, block: FIXTURE_BLOCK[shapeId] } : params;
}

// Ist das Innere dicht? Flutet die Luft von außen (6er-Nachbarschaft) und prüft, ob sie den Punkt erreicht.
function outsideReaches(volume, size, target) {
  const [w, h, l] = size.map((v) => v + 2);
  const seen = new Uint8Array(w * h * l);
  const index = (x, y, z) => ((y + 1) * l + (z + 1)) * w + (x + 1);
  const queue = [[-1, -1, -1]];
  seen[index(-1, -1, -1)] = 1;
  while (queue.length) {
    const [x, y, z] = queue.pop();
    if (x === target[0] && y === target[1] && z === target[2]) return true;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < -1 || ny < -1 || nz < -1 || nx > size[0] || ny > size[1] || nz > size[2]) continue;
      const i = index(nx, ny, nz);
      if (seen[i] || volume.has(nx, ny, nz)) continue;
      seen[i] = 1;
      queue.push([nx, ny, nz]);
    }
  }
  return false;
}

before(() => loadFixtureData());

describe('SHAPES – Schnittstelle', () => {
  test('mindestens die geforderten Formen', () => {
    for (const id of ['sphere', 'dome', 'cylinder', 'cone', 'pyramid', 'cube', 'cuboid', 'arch', 'torus', 'ellipsoid', 'spiral-stairs']) {
      assert.ok(SHAPE_IDS.includes(id), id);
    }
  });

  test('jede Form hat id, title, description, params, build', () => {
    for (const [key, shape] of Object.entries(SHAPES)) {
      assert.equal(shape.id, key);
      assert.match(shape.id, /^[a-z0-9-]{1,40}$/);
      assert.ok(shape.title && shape.description.length > 20, key);
      assert.equal(typeof shape.build, 'function');
      assert.ok(Array.isArray(shape.params) && shape.params.length >= 2);
      for (const p of shape.params) {
        assert.match(p.key, PARAM_KEY, `${key}.${p.key} passt nicht zu den Worker-Parametern`);
        assert.ok(['int', 'block', 'bool', 'enum'].includes(p.type));
        assert.ok(p.label);
        if (p.type === 'int') assert.ok(p.min <= p.default && p.default <= p.max && p.step === 1, `${key}.${p.key}`);
        if (p.type === 'enum') assert.ok(p.options.some((o) => o.value === p.default));
      }
    }
  });

  test('Standardwerte sind gültig', () => {
    for (const id of SHAPE_IDS) {
      const result = validateShapeParams(id, { ...defaultShapeParams(id), ...withFixtureBlock(id) });
      assert.ok(result.ok, `${id}: ${result.errors.join(' ')}`);
      assert.ok(result.estimate > 0 && result.estimate <= MAX_SHAPE_BLOCKS);
    }
    assert.equal(defaultShapeParams('nope'), null);
  });
});

describe('validateShapeParams', () => {
  test('Texte aus Formularen werden umgewandelt', () => {
    const r = validateShapeParams('sphere', { diameter: '31', hollow: 'nein', block: 'minecraft:Glass', thickness: ' 2 ' });
    assert.ok(r.ok, r.errors.join(' '));
    assert.deepEqual(r.params, { diameter: 31, block: 'glass', hollow: false, thickness: 2 });
  });

  test('Grenzen und Typen mit deutschen Meldungen', () => {
    let r = validateShapeParams('sphere', { diameter: 999 });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /Durchmesser: bitte eine ganze Zahl von 3 bis 301/);
    r = validateShapeParams('sphere', { diameter: 10.5 });
    assert.equal(r.ok, false);
    r = validateShapeParams('cube', { hollow: 'vielleicht' });
    assert.match(r.errors[0], /ja oder nein/);
    r = validateShapeParams('cylinder', { roof: 'pagode' });
    assert.match(r.errors[0], /Dach: erlaubt sind/);
  });

  test('unbekannte Form oder Parameter', () => {
    assert.match(validateShapeParams('hexagon', {}).errors[0], /Unbekannte Form/);
    assert.match(validateShapeParams('cube', { color: 'red' }).errors[0], /Unbekannter Parameter/);
    assert.match(validateShapeParams('cube', [1, 2]).errors[0], /einfaches Objekt/);
    assert.match(validateShapeParams('__proto__', {}).errors[0], /Unbekannte Form/);
  });

  test('Blöcke werden gegen die Blockdaten geprüft', () => {
    assert.match(validateShapeParams('cube', { block: 'unobtainium' }).errors[0], /gibt es in Minecraft 26.2 nicht/);
    assert.match(validateShapeParams('cube', { block: '<script>' }).errors[0], /keine gültige Block-ID/);
    assert.match(validateShapeParams('cube', { block: 'oak_door' }).errors[0], /nicht als einzelner Block/);
    assert.match(validateShapeParams('spiral-stairs', { stairs: 'stone' }).errors[0], /keine Treppe/);
    const pane = validateShapeParams('cube', { block: 'glass_pane' });
    assert.ok(pane.ok);
    assert.match(pane.warnings[0], /kein voller Block/);
  });

  test('Blockliste als Option (z. B. auf der Seite ohne Kerndaten)', () => {
    assert.ok(validateShapeParams('cube', { block: 'stone' }, { blocks: ['stone'] }).ok);
    assert.equal(validateShapeParams('cube', { block: 'glass' }, { blocks: ['stone'] }).ok, false);
  });

  test('höchstens 2 Mio. Blöcke, vorab geschätzt', () => {
    const r = validateShapeParams('sphere', { diameter: 301, hollow: false });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /höchstens 2 Mio\. .*oder hohl/);
    assert.equal(validateShapeParams('cuboid', { width: 512, height: 512, length: 512 }).ok, false);
    assert.ok(validateShapeParams('sphere', { diameter: 301, hollow: true }).ok);
  });

  test('Abhängigkeiten zwischen Parametern', () => {
    assert.match(validateShapeParams('torus', { radius: 5, tube: 5, block: 'stone' }).errors[0], /Röhrenradius muss kleiner/);
    assert.match(validateShapeParams('arch', { width: 4, thickness: 2 }).errors[0], /zu schmal/);
    assert.match(validateShapeParams('cylinder', { diameter: 3, battlements: true }).errors[0], /Zinnen brauchen/);
  });
});

describe('buildShape – alle Formen bauen', () => {
  for (const id of Object.keys(SHAPES)) {
    test(`${id}: Standard, voll und hohl`, () => {
      for (const extra of [{}, { hollow: false }, { hollow: true }]) {
        const params = withFixtureBlock(id, Object.fromEntries(Object.entries(extra).filter(([k]) => SHAPES[id].params.some((p) => p.key === k))));
        const check = validateShapeParams(id, params);
        assert.ok(check.ok, check.errors.join(' '));
        const result = build(id, params);
        assert.ok(result.blockCount > 0);
        assert.ok(result.blockCount <= check.estimate, `${id}: Schätzung ${check.estimate} < echt ${result.blockCount}`);
        assert.deepEqual(result.size, shapeSize(id, check.params), id);
        assert.equal(result.offset[1], 0, 'Formen beginnen auf Ebene 1');
        assert.ok(result.phases.length >= 1);
        // Kapitel nur mit Titel und Schrittliste, ohne Text und Tipps; Schritte ohne Titel und Text; keine Notizen
        for (const phase of result.phases) {
          assert.deepEqual(Object.keys(phase).sort(), ['steps', 'title'], `${id}: Kapitel „${phase.title}“`);
          assert.ok(phase.title.trim().length > 0);
        }
        for (const step of result.steps) assert.deepEqual(Object.keys(step).sort(), ['blockCount', 'index', 'layerY', 'materials', 'phase'], `${id}: Schritt ${step.index}`);
        assert.equal('notes' in result, false, `${id}: keine Notizen`);
        assert.deepEqual(result.warnings, []);
      }
    });
  }

  test('ungültige Parameter → Error mit deutscher Meldung', () => {
    assert.throws(() => build('sphere', { diameter: 2 }), /Durchmesser: bitte eine ganze Zahl/);
    assert.throws(() => build('nope', {}), /Unbekannte Form/);
    assert.throws(() => buildShape(null, 'cube', {}), /Builder/);
  });

  test('Kugel: Maße, Symmetrie und dichte Hülle', () => {
    const result = build('sphere', { diameter: 15, block: 'glass', hollow: true });
    assert.deepEqual(result.size, [15, 15, 15]);
    const v = result.volume;
    v.forEach((x, y, z) => assert.ok(v.has(14 - x, y, z) && v.has(x, 14 - y, z) && v.has(x, y, 14 - z), 'symmetrisch'));
    assert.equal(v.has(7, 7, 7), false, 'innen hohl');
    assert.equal(outsideReaches(v, result.size, [7, 7, 7]), false, 'Hülle dicht');
    assert.equal(result.steps.length, 15, 'eine Ebene pro Schritt');
    const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
    assert.deepEqual(result.phases, [
      { title: 'Kugel: Untere Hälfte (Ebene 1–7)', steps: range(0, 6) },
      { title: 'Kugel: Obere Hälfte (Ebene 8–15)', steps: range(7, 14) },
    ], 'Kapitel nur mit Titel und Schritten');
  });

  test('gerader Durchmesser bleibt exakt', () => {
    assert.deepEqual(build('sphere', { diameter: 10 }).size, [10, 10, 10]);
    assert.deepEqual(build('dome', { diameter: 10 }).size, [10, 5, 10]);
    assert.deepEqual(build('circle', { diameter: 8 }).size, [8, 1, 8]);
  });

  test('große Formen bekommen sinnvolle Kapitel', () => {
    const result = build('sphere', { diameter: 61 });
    assert.deepEqual(result.phases.map((p) => p.title), ['Kugel: Unteres Drittel (Ebene 1–20)', 'Kugel: Mittleres Drittel (Ebene 21–40)', 'Kugel: Oberes Drittel (Ebene 41–61)']);
    assert.equal(result.steps.length, 61);
    const tower = build('cylinder', { diameter: 9, height: 200 });
    assert.equal(tower.phases.length, 4);
    assert.match(tower.phases[3].title, /Oberes Viertel/);
  });

  test('Ellipsoid und hohler Ring sind dicht', () => {
    const e = build('ellipsoid', { width: 11, height: 9, length: 15, block: 'stone', hollow: true });
    assert.deepEqual(e.size, [11, 9, 15]);
    assert.equal(outsideReaches(e.volume, e.size, [5, 4, 7]), false);
    const t = build('torus', { radius: 8, tube: 3, block: 'stone', hollow: true });
    // Mitte des Rings bei (11, 3, 11), Mitte der Röhre 8 Blöcke weiter südlich
    assert.equal(t.volume.has(11, 3, 19), false, 'Röhre innen hohl');
    assert.equal(outsideReaches(t.volume, t.size, [11, 3, 19]), false, 'Röhre dicht');
    assert.equal(outsideReaches(t.volume, t.size, [11, 3, 11]), true, 'das Loch in der Mitte ist offen');
  });

  test('Turm mit Boden, Zinnen und Kegeldach', () => {
    const result = build('cylinder', { diameter: 9, height: 12, floor: true, battlements: true, roof: 'cone', roofBlock: 'spruce_planks' });
    const titles = result.phases.map((p) => p.title);
    assert.equal(titles[0], 'Boden (Ebene 1)');
    assert.ok(titles.some((t) => t.startsWith('Zinnen (Ebene 13)')));
    assert.ok(titles.some((t) => t.startsWith('Kegeldach (Ebene 13–')), 'Dach zwischen den Zinnen');
    assert.deepEqual(result.size, shapeSize('cylinder', validateShapeParams('cylinder', { diameter: 9, height: 12, battlements: true, roof: 'cone' }).params));
    assert.ok(result.materials.some(([item]) => item === 'spruce_planks'));
    // Zinnen: auf dem Rand wechseln sich Block und Lücke ab
    const ring = [];
    result.volume.forEach((x, y, z, state) => { if (y === 12 && state === 'stone_bricks') ring.push(`${x},${z}`); });
    assert.ok(ring.length > 4);
  });

  test('Wendeltreppe: eine Treppe pro Ebene in Laufrichtung', () => {
    const result = build('spiral-stairs', { height: 9, radius: 1, core: '', wall: '' });
    assert.equal(result.blockCount, 9);
    const stairs = [];
    result.volume.forEach((x, y, z, state) => stairs.push({ x, y, z, state }));
    stairs.sort((a, b) => a.y - b.y);
    for (let i = 0; i + 1 < stairs.length; i++) {
      const [a, b] = [stairs[i], stairs[i + 1]];
      assert.equal(Math.abs(a.x - b.x) + Math.abs(a.z - b.z), 1, 'nächste Treppe liegt daneben');
      const facing = a.state.match(/facing=(\w+)/)[1];
      const dir = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
      assert.deepEqual([b.x - a.x, b.z - a.z], dir, 'hohe Seite zeigt zur nächsten Treppe');
    }
    assert.equal('notes' in result, false, 'keine Notiz „Hier beginnt die Treppe“ mehr');
  });

  test('Bogen: Öffnung unten in der Mitte, Scheitel geschlossen', () => {
    const { arch } = archGrid(9, 8, 1);
    assert.equal(arch[0 * 9 + 4], 0, 'unten offen');
    assert.equal(arch[0 * 9 + 0], 1, 'Pfeiler links');
    assert.equal(arch[0 * 9 + 8], 1, 'Pfeiler rechts');
    assert.equal(arch[7 * 9 + 4], 1, 'Scheitel');
    const result = build('arch', { width: 9, height: 8, depth: 3 });
    assert.deepEqual(result.size, [9, 8, 3]);
    assert.deepEqual(result.phases.map((p) => p.title.split(' (')[0]), ['Pfeiler', 'Bogen']);
  });

  test('Pyramide: Spitze und Stufen', () => {
    const result = build('pyramid', { width: 9, block: 'stone' });
    assert.deepEqual(result.size, [9, 5, 9]);
    assert.equal(result.blockCount, 81 + 49 + 25 + 9 + 1);
  });

  test('deterministisch', () => {
    const a = build('torus', { radius: 6, tube: 2, block: 'stone' });
    const b = build('torus', { radius: 6, tube: 2, block: 'stone' });
    assert.equal(a.blockCount, b.blockCount);
    assert.deepEqual(a.steps.map((s) => s.blockCount), b.steps.map((s) => s.blockCount));
  });
});

describe('Adresse: parseShapeQuery und shapeQueryString', () => {
  test('hin und zurück', () => {
    for (const id of SHAPE_IDS) {
      const params = validateShapeParams(id, withFixtureBlock(id)).params;
      const query = shapeQueryString(id, params);
      assert.ok(query.startsWith(`form=${id}&`));
      const parsed = parseShapeQuery(new URLSearchParams(query));
      assert.ok(parsed.ok, `${id}: ${parsed.errors.join(' ')}`);
      assert.equal(parsed.shape, id);
      assert.deepEqual(parsed.params, params);
    }
  });

  test('Text mit „?“ geht nicht, ohne geht; Wahrheitswerte als 1/0', () => {
    assert.equal(shapeQueryString('cube', { size: 5, block: 'stone', hollow: true }), 'form=cube&size=5&block=stone&hollow=1');
    const parsed = parseShapeQuery('form=cube&size=5&hollow=1');
    assert.deepEqual(parsed.params, { size: 5, block: 'stone', hollow: true });
  });

  test('Whitelist: fremde Parameter werden ignoriert, Werte geprüft', () => {
    const parsed = parseShapeQuery('form=sphere&diameter=11&evil=<script>&scale=3');
    assert.ok(parsed.ok);
    assert.deepEqual(Object.keys(parsed.params).sort(), ['block', 'diameter', 'hollow', 'thickness']);
    assert.equal(parseShapeQuery('form=sphere&diameter=1e9').ok, false);
    assert.equal(parseShapeQuery('form=sphere&block=%3Cscript%3E').ok, false);
    assert.equal(parseShapeQuery('form=sphere&diameter=-5').ok, false);
  });

  test('fehlende oder unbekannte Form', () => {
    assert.match(parseShapeQuery('').errors[0], /fehlt die Form/);
    assert.match(parseShapeQuery('form=../../etc').errors[0], /Unbekannte Form/);
    assert.match(parseShapeQuery('form=constructor').errors[0], /Unbekannte Form/);
    assert.throws(() => shapeQueryString('nope'), /Unbekannte Form/);
  });
});

describe('Worker-Vertrag (engine-worker.js, Quelle kind: shape)', () => {
  test('checkSource akzeptiert alle Formen mit ihren Parametern', () => {
    for (const id of SHAPE_IDS) {
      const params = validateShapeParams(id, withFixtureBlock(id)).params;
      const clean = checkSource({ kind: 'shape', shape: id, params });
      assert.deepEqual(clean.params, params);
    }
  });

  test('buildShapeResult baut über den Namensraum des Moduls', () => {
    const result = buildShapeResult(generators, 'sphere', { diameter: 9, block: 'glass' });
    assert.ok(result.blockCount > 0);
    assert.deepEqual(result.shape, { shape: 'sphere', params: { diameter: 9, block: 'glass' } });
  });

  test('Fehler kommen verständlich als EngineError an', () => {
    assert.throws(() => buildShapeResult(generators, 'sphere', { diameter: 2000 }), (error) => error instanceof EngineError && error.code === 'build' && /Durchmesser/.test(error.message));
  });
});

const GAME_BLOCKS = new URL('../../game-data/blocks.json', import.meta.url);
describe('mit den echten Spieldaten', { skip: existsSync(GAME_BLOCKS) ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)' }, () => {
  test('alle Formen mit ihren Standard-Blöcken', () => {
    setBlockData(JSON.parse(readFileSync(GAME_BLOCKS, 'utf8')));
    try {
      for (const id of SHAPE_IDS) {
        const result = build(id, {});
        assert.ok(result.blockCount > 0, id);
        assert.deepEqual(result.warnings, [], id);
      }
    } finally {
      setBlockData(readFixture('blocks.json'));
    }
  });
});
