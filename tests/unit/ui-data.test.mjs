import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadJson, loadCatalog, loadNames, normalizeCatalog, normalizeBuild, recoverySteps, isSafeDataPath, findBuild,
  countByCategory, DataError, CATALOG_PATH, NAMES_PATH,
} from '../../js/ui/data.js';

const ROOT = new URL('http://127.0.0.1:8080/');

function fakeFetch(respond) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return respond(url, options);
  };
  return { fetch, calls };
}

const json = (body, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function quietly(fn) {
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  return Promise.resolve()
    .then(() => fn(warnings))
    .finally(() => { console.warn = warn; });
}

const VALID_BUILD = {
  id: 'tokyo-skytree', title: 'Tokyo Skytree', category: 'wahrzeichen', subtitle: 'Fernseh- und Aussichtsturm in Tokio',
  tags: ['Japan', 'Turm'], aliases: ['skytree'], accuracy: 'massstab', difficulty: 5, size: [68, 634, 68], blocks: 123456,
  steps: 420, topMaterials: [['white_concrete', 5000]], module: 'js/builds/wahrzeichen/tokyo-skytree.js', structure: null,
  scales: [1, 0.5, 0.25], tested: null, thumb: 'thumbs/tokyo-skytree.webp',
};

test('loadJson liefert geparstes JSON und fragt ab der Website-Wurzel', async () => {
  const { fetch, calls } = fakeFetch(() => json({ ok: true }));
  assert.deepEqual(await loadJson('game-data/meta.json', { fetch, root: new URL('http://127.0.0.1:8080/unter/') }), { ok: true });
  assert.equal(calls[0].url, 'http://127.0.0.1:8080/unter/game-data/meta.json');
  assert.equal(calls[0].options.cache, 'no-cache');
  assert.ok(calls[0].options.signal instanceof AbortSignal, 'mit Zeitlimit');
});

test('404 bei Spieldaten → „Spieldaten fehlen“ mit Anleitung', async () => {
  const { fetch } = fakeFetch(() => new Response('Nicht gefunden.', { status: 404 }));
  await assert.rejects(loadJson(CATALOG_PATH, { fetch, root: ROOT }), (error) => {
    assert.ok(error instanceof DataError);
    assert.equal(error.name, 'DataError');
    assert.equal(error.kind, 'missing');
    assert.equal(error.status, 404);
    assert.equal(error.title, 'Spieldaten fehlen');
    assert.match(error.message, /game-data\/catalog\.json/);
    assert.deepEqual(error.steps.map((step) => step.command).filter(Boolean), ['node scripts/start.mjs'], 'ein Befehl, der auch ohne Minecraft geht');
    assert.doesNotMatch(error.steps[0].text, /Minecraft-Installation lesen/, 'verlangt keine Minecraft-Installation');
    assert.match(error.steps[0].text, /ohne Minecraft/);
    return true;
  });
  await assert.rejects(loadJson('daten/liste.json', { fetch, root: ROOT }), { kind: 'missing', title: 'Datei nicht gefunden' });
});

test('Serverfehler, Netzwerk, Zeitlimit und kaputtes JSON haben eigene Meldungen', async () => {
  await assert.rejects(loadJson(NAMES_PATH, { fetch: fakeFetch(() => new Response('x', { status: 500 })).fetch, root: ROOT }), { kind: 'http', status: 500 });
  await assert.rejects(loadJson(NAMES_PATH, { fetch: async () => { throw new TypeError('Failed to fetch'); }, root: ROOT }), (error) => {
    assert.equal(error.kind, 'network');
    assert.ok(error.steps.some((step) => step.command === 'node scripts/serve.mjs'));
    assert.ok(error.cause instanceof TypeError, 'Ursache bleibt erhalten');
    return true;
  });
  await assert.rejects(loadJson(NAMES_PATH, { fetch: async () => { throw new DOMException('Zeit', 'TimeoutError'); }, root: ROOT }), { kind: 'timeout' });
  await assert.rejects(loadJson(NAMES_PATH, { fetch: fakeFetch(() => json('{"kaputt": ')).fetch, root: ROOT }), { kind: 'parse', title: 'Spieldaten beschädigt' });
});

test('loadJson lehnt unsichere Pfade ab, ohne überhaupt anzufragen', async () => {
  const { fetch, calls } = fakeFetch(() => json({}));
  for (const bad of ['../geheim.json', 'game-data/../../x.json', 'https://evil.example/x.json', '//evil.example/x.json', '/game-data/x.json',
    'game-data/x.txt', 'game-data//x.json', 'game-data/x.json?y=1', 'javascript:alert(1)', '', null]) {
    await assert.rejects(loadJson(bad, { fetch, root: ROOT }), { kind: 'invalid-path' }, String(bad));
  }
  assert.equal(calls.length, 0);
  assert.equal(isSafeDataPath('game-data/structures/village__plains__houses__plains_small_house_1.json'), true);
});

test('recoverySteps passt zur Datei', () => {
  assert.equal(recoverySteps(CATALOG_PATH).length, 2);
  assert.deepEqual(recoverySteps(CATALOG_PATH).map((step) => step.command).filter(Boolean), ['node scripts/start.mjs']);
  assert.deepEqual(recoverySteps(NAMES_PATH).map((step) => step.command).filter(Boolean), ['node scripts/extract-game-data.mjs']);
  assert.deepEqual(recoverySteps('andere.json').map((step) => step.command).filter(Boolean), []);
});

test('normalizeBuild übernimmt gültige Einträge vollständig', () => {
  const result = normalizeBuild(VALID_BUILD);
  assert.equal(result.ok, true);
  assert.deepEqual(result.build, VALID_BUILD);
});

test('normalizeBuild: ohne ID, Titel oder Kategorie wird verworfen, andere Felder werden geleert', () => {
  assert.equal(normalizeBuild(null).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, id: 'Tokyo Skytree' }).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, title: '   ' }).ok, false);
  assert.equal(normalizeBuild({ ...VALID_BUILD, category: 'weltall' }).ok, false);
  const { build } = normalizeBuild({
    ...VALID_BUILD, accuracy: 'geraten', difficulty: 9, size: [10, 0, 10], blocks: -5, steps: 1.5, tested: 'ja',
    thumb: '../geheim.webp', module: 'https://evil.example/x.js', structure: '../../x.json', scales: [1, 'x', 0, 9],
    tags: ['ok', 42, '', 'x'.repeat(100)], topMaterials: [['stone', 3], ['Böse<>', 1], ['dirt', -1]],
  });
  assert.equal(build.accuracy, null);
  assert.equal(build.difficulty, null);
  assert.equal(build.size, null);
  assert.equal(build.blocks, null);
  assert.equal(build.steps, null);
  assert.equal(build.tested, null);
  assert.equal(build.thumb, null);
  assert.equal(build.module, null);
  assert.equal(build.structure, null);
  assert.deepEqual(build.scales, [1]);
  assert.deepEqual(build.tags, ['ok', 'x'.repeat(40)]);
  assert.deepEqual(build.topMaterials, [['stone', 3]]);
  for (const thumb of ['thumbs/x.svg', 'https://evil.example/x.webp', 'thumbs/../x.webp', 'thumbs/X Y.webp']) {
    assert.equal(normalizeBuild({ ...VALID_BUILD, thumb }).build.thumb, null, thumb);
  }
});

test('normalizeCatalog: überspringt ungültige und doppelte Einträge und meldet sie', async () => {
  await quietly((warnings) => {
    const catalog = normalizeCatalog({
      generatedAt: '2026-10-22T12:00:00Z', version: '26.2',
      builds: [VALID_BUILD, { id: 'x' }, { ...VALID_BUILD }, { ...VALID_BUILD, id: 'zweiter-bau', category: 'redstone' }],
    });
    assert.equal(catalog.builds.length, 2);
    assert.equal(catalog.skipped, 2);
    assert.equal(catalog.version, '26.2');
    assert.equal(catalog.generatedAt, '2026-10-22T12:00:00Z');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /2 Einträge/);
  });
  assert.throws(() => normalizeCatalog([]), { kind: 'format' });
  assert.throws(() => normalizeCatalog({ builds: {} }), { kind: 'format', title: 'Spieldaten unvollständig' });
});

test('loadCatalog: fehlt nur der Katalog, nennt die Anleitung nur build-catalog', async () => {
  const onlyMeta = fakeFetch((url, options) => (String(url).endsWith('meta.json') && options.method === 'HEAD' ? new Response(null, { status: 200 }) : new Response('', { status: 404 })));
  await assert.rejects(loadCatalog({ fetch: onlyMeta.fetch, root: ROOT }), (error) => {
    assert.equal(error.kind, 'missing');
    assert.equal(error.title, 'Katalog fehlt');
    assert.deepEqual(error.steps.map((step) => step.command).filter(Boolean), ['node scripts/build-catalog.mjs']);
    return true;
  });
  assert.deepEqual(onlyMeta.calls.map((call) => call.url), ['http://127.0.0.1:8080/game-data/catalog.json', 'http://127.0.0.1:8080/game-data/meta.json']);
  const nothing = fakeFetch(() => new Response('', { status: 404 }));
  await assert.rejects(loadCatalog({ fetch: nothing.fetch, root: ROOT }), { title: 'Spieldaten fehlen' });
  await quietly(async (warnings) => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls === 1) return new Response('', { status: 404 });
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(loadCatalog({ fetch: flaky, root: ROOT }), { title: 'Spieldaten fehlen' });
    assert.equal(warnings.length, 1, 'fehlgeschlagene Prüfung wird gemeldet');
  });
});

test('loadCatalog, findBuild und countByCategory', async () => {
  const { fetch } = fakeFetch(() => json({ version: '26.2', builds: [VALID_BUILD, { ...VALID_BUILD, id: 'kolben-tuer', category: 'redstone' }] }));
  const catalog = await loadCatalog({ fetch, root: ROOT });
  assert.equal(findBuild(catalog, 'kolben-tuer').category, 'redstone');
  assert.equal(findBuild(catalog, 'gibt-es-nicht'), null);
  assert.deepEqual(countByCategory(catalog), { haeuser: 0, wahrzeichen: 1, fantasy: 0, mittelalter: 0, klein: 0, redstone: 1, farmen: 0, infrastruktur: 0 });
});

test('loadNames prüft das Format von names.json', async () => {
  const good = { block: { stone_bricks: { de: 'Steinziegel', en: 'Stone Bricks' } }, item: {} };
  assert.deepEqual(await loadNames({ fetch: fakeFetch(() => json(good)).fetch, root: ROOT }), good);
  await assert.rejects(loadNames({ fetch: fakeFetch(() => json({ block: {} })).fetch, root: ROOT }), { kind: 'format' });
});
