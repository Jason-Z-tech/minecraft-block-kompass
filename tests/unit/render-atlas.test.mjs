// Atlas-Modus des TextureStore (Bauplan Etappe 2, „Verbraucher“): Texturen aus einem einmal dekodierten Atlasbild
// ausschneiden statt einzelne PNGs aus textures.bin zu lesen. Beide Modi müssen pixelgleich dieselben Ebenen liefern.
// Synthetische Atlanten (kein Netz); dazu ein Vergleich mit allen echten Texturen, wenn game-data/ vorhanden ist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TextureStore, TextureSourceError, encodePng, decodePng, createImage, buildLayer, MISSING_TEXTURE,
} from '../../js/render/texture-store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_DATA = path.join(ROOT, 'game-data');
const hasGameData = fs.existsSync(path.join(GAME_DATA, 'textures.json')) && fs.existsSync(path.join(GAME_DATA, 'textures.bin'));
const dataTest = hasGameData ? test : test.skip;

// ---------------------------------------------------------------- Hilfen: WebGL-Ersatz (wie render-base-textures)

class FakeGL {
  TEXTURE_2D_ARRAY = 0x8c1a; RGBA8 = 0x8058; RGBA = 0x1908; UNSIGNED_BYTE = 0x1401;
  TEXTURE_MIN_FILTER = 0x2801; TEXTURE_MAG_FILTER = 0x2800; NEAREST = 0x2600; NEAREST_MIPMAP_LINEAR = 0x2702;
  TEXTURE_WRAP_S = 0x2802; TEXTURE_WRAP_T = 0x2803; REPEAT = 0x2901; TEXTURE_BASE_LEVEL = 0x813c; TEXTURE_MAX_LEVEL = 0x813d;
  MAX_ARRAY_TEXTURE_LAYERS = 0x88ff; TEXTURE_BINDING_2D_ARRAY = 0x8c1d; PIXEL_UNPACK_BUFFER = 0x88ec; PIXEL_UNPACK_BUFFER_BINDING = 0x88ef;
  UNPACK_FLIP_Y_WEBGL = 0x9240; UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241; UNPACK_ALIGNMENT = 0x0cf5; UNPACK_ROW_LENGTH = 0x0cf2;
  UNPACK_IMAGE_HEIGHT = 0x806e; UNPACK_SKIP_PIXELS = 0x0cf4; UNPACK_SKIP_ROWS = 0x0cf3; UNPACK_SKIP_IMAGES = 0x806d;
  NO_ERROR = 0; TEXTURE0 = 0x84c0;

  constructor({ maxLayers = 2048 } = {}) {
    this.maxLayers = maxLayers;
    this.textures = new Set();
    this.bound = null;
    this.uploads = [];
    this.pixelStore = {};
  }

  createTexture() {
    const texture = { levels: null, params: {} };
    this.textures.add(texture);
    return texture;
  }
  deleteTexture(texture) { this.textures.delete(texture); }
  isTexture(texture) { return this.textures.has(texture); }
  isContextLost() { return false; }
  bindTexture(target, texture) { this.bound = texture; }
  activeTexture() {}
  bindBuffer() {}
  pixelStorei(name, value) { this.pixelStore[name] = value; }
  getError() { return 0; }
  getParameter(name) {
    if (name === this.MAX_ARRAY_TEXTURE_LAYERS) return this.maxLayers;
    if (name === this.TEXTURE_BINDING_2D_ARRAY) return this.bound;
    if (name === this.PIXEL_UNPACK_BUFFER_BINDING) return null;
    return this.pixelStore[name] ?? 0;
  }
  texStorage3D(target, levels, format, width, height, depth) {
    this.bound.size = width;
    this.bound.depth = depth;
    this.bound.levels = Array.from({ length: levels }, (_, l) => new Uint8Array((width >> l) * (height >> l) * 4 * depth));
  }
  texParameteri(target, name, value) { this.bound.params[name] = value; }
  texSubImage3D(target, level, x, y, z, width, height, depth, format, type, data, offset) {
    const bytes = width * height * 4;
    this.bound.levels[level].set(data.subarray(offset, offset + bytes * depth), z * bytes);
    this.uploads.push({ level, z, depth });
  }
  layerData(texture, layer, level) {
    const bytes = (texture.size >> level) ** 2 * 4;
    return texture.levels[level].slice(layer * bytes, (layer + 1) * bytes);
  }
}

// ---------------------------------------------------------------- Hilfen: synthetische Texturen und Atlanten

function pattern(width, height, pixel) {
  const image = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) image.data.set(pixel(x, y), (y * width + x) * 4);
  }
  return image;
}

// Hintergrund mit vielen Farben: ein um einen Pixel verschobener Ausschnitt fiele sofort auf.
const noise = (width, height, salt) => pattern(width, height, (x, y) => [(x * 37 + y * 91 + salt) & 255, (x * 17 + salt * 5) & 255, (y * 29 + x) & 255, (x + y + salt) % 3 === 0 ? 77 : 255]);

function paste(target, source, x0, y0) {
  for (let y = 0; y < source.height; y++) {
    target.data.set(source.data.subarray(y * source.width * 4, (y + 1) * source.width * 4), ((y0 + y) * target.width + x0) * 4);
  }
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Vier Texturen in zwei Atlanten: statisch 16×16, Animationsstreifen 16×32 (2 Frames, interpoliert, Frame 1
// halbtransparent), 32×32 mit Löchern (strict_cutout) und ein Item genau am Rand des Item-Atlas.
const SPECS = {
  'block/plain': { atlas: 'blocks', x: 40, y: 8, w: 16, h: 16, anim: null,
    pixel: (x, y) => [x * 13, y * 11, (x + y) * 7, 255] },
  'block/flow': { atlas: 'blocks', x: 3, y: 29, w: 16, h: 32, anim: { fw: 16, fh: 16, frames: [[0, 3], [1, 2]], interpolate: true },
    pixel: (x, y) => [200 - x * 5, y * 7, 90, y < 16 ? 255 : 160] },
  'entity/big': { atlas: 'blocks', x: 27, y: 31, w: 32, h: 32, anim: null, mip: 'strict_cutout',
    pixel: (x, y) => [x * 8, 255 - y * 8, (x * y) & 255, (x + y) % 5 === 0 ? 0 : 255] },
  'item/gem': { atlas: 'items', x: 16, y: 0, w: 16, h: 16, anim: null,
    pixel: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? [9, 9, 9, 0] : [30, 160 + x, 220 - y, 255]) },
};
const ATLAS_SIZES = { blocks: [64, 64], items: [32, 16] };
const NAMES = Object.keys(SPECS).sort();

async function makeFixture() {
  const images = {};
  const atlases = Object.fromEntries(Object.entries(ATLAS_SIZES).map(([name, [w, h]], i) => [name, noise(w, h, i * 50 + 1)]));
  const binEntries = {};
  const atlasEntries = {};
  const parts = [];
  let offset = 0;
  for (const [name, spec] of Object.entries(SPECS)) {
    const image = pattern(spec.w, spec.h, spec.pixel);
    images[name] = image;
    paste(atlases[spec.atlas], image, spec.x, spec.y);
    const png = await encodePng(image);
    const base = { w: spec.w, h: spec.h, anim: spec.anim, ...(spec.mip ? { mip: spec.mip } : {}) };
    binEntries[name] = { o: offset, l: png.length, ...base };
    atlasEntries[name] = { ...base, atlas: spec.atlas, x: spec.x, y: spec.y };
    parts.push(png);
    offset += png.length;
  }
  const atlasPng = {};
  for (const [name, image] of Object.entries(atlases)) atlasPng[name] = await encodePng(image);
  return {
    images,
    atlases,
    atlasPng,
    bin: concat(parts),
    binJson: { version: '26.2', entries: binEntries },
    atlasJson: { version: '26.2', entries: atlasEntries },
  };
}

let fixturePromise = null;
const fixture = () => (fixturePromise ??= makeFixture());

// Lader wie js/data/game-data.js: async, kurze Wartezeit (gleichzeitige Aufrufe überlappen), zählt Aufrufe je Atlas.
function countingLoader(pngs, { delayMs = 5 } = {}) {
  const calls = {};
  return {
    calls,
    source: {
      atlas: async (name) => {
        calls[name] = (calls[name] ?? 0) + 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (!(name in pngs)) throw new Error(`Atlas ${name} gibt es nicht`);
        return pngs[name];
      },
    },
  };
}

const withEntries = (json, patch) => ({ ...json, entries: { ...json.entries, ...patch } });
const rejectionOf = (promise) => promise.then(() => assert.fail('hätte ablehnen sollen'), (error) => error);

// Vergleicht zwei Stores über prepare: Ergebnis-Map, Statistik, CPU-Spiegel und hochgeladene Daten aller Ebenen/Stufen.
async function assertSamePrepare(storeA, storeB, names) {
  const glA = new FakeGL();
  const glB = new FakeGL();
  const [mapA, mapB] = await Promise.all([storeA.prepare(glA, names), storeB.prepare(glB, names)]);
  assert.deepEqual([...mapA], [...mapB]);
  const stats = storeA.stats(glA);
  assert.deepEqual(stats, storeB.stats(glB));
  for (let layer = 0; layer < stats.layers; layer++) {
    for (let level = 0; level < storeA.levelCount; level++) {
      const data = storeA.readLayer(glA, layer, level);
      assert.deepEqual(data, storeB.readLayer(glB, layer, level), `Ebene ${layer}, Stufe ${level}`);
      assert.deepEqual(glA.layerData(storeA.texture(glA), layer, level), data);
    }
  }
  return { glA, glB, mapA, mapB, stats };
}

// ---------------------------------------------------------------- Gleichheit der Modi

test('Atlas-Modus: image pixelgleich, info/has/names wie mit textures.bin', async () => {
  const f = await fixture();
  const bin = new TextureStore(f.binJson, f.bin);
  const { source, calls } = countingLoader(f.atlasPng);
  const atlas = new TextureStore(f.atlasJson, source);
  assert.equal(bin.mode, 'bin');
  assert.equal(atlas.mode, 'atlas');
  assert.equal(atlas.version, '26.2');
  assert.deepEqual(calls, {}, 'der Konstruktor lädt noch nichts');
  assert.deepEqual(atlas.names(), NAMES);
  assert.deepEqual(atlas.names(), bin.names());
  for (const name of NAMES) {
    const [fromAtlas, fromBin] = await Promise.all([atlas.image(name), bin.image(name)]);
    assert.deepEqual(fromAtlas, f.images[name], name);
    assert.deepEqual(fromBin, f.images[name], name);
  }
  const probes = [...NAMES, 'minecraft:block/plain', 'region:entity/big:2,3,10,5', 'region:block/flow:4,4,8,8',
    'region:block/flow:0,0,16,17', 'missingno', 'block/gibt_es_nicht', 'Kaputt!', ''];
  for (const name of probes) {
    assert.deepEqual(atlas.info(name), bin.info(name), name);
    assert.equal(atlas.has(name), bin.has(name), name);
  }
  assert.deepEqual([atlas.info('block/flow').animated, atlas.info('block/flow').frameCount, atlas.info('entity/big').mip], [true, 2, 'strict_cutout']);
  await assert.rejects(atlas.image('block/gibt_es_nicht'), /gibt es nicht/);
  assert.deepEqual(calls, { blocks: 1, items: 1 });
});

test('Atlas-Modus: prepare, Animation (tick) und buildLayer liefern dieselben Ebenen wie textures.bin', async (t) => {
  const f = await fixture();
  const warn = t.mock.method(console, 'warn', () => {});
  const names = [...NAMES, 'region:entity/big:2,3,10,5', 'region:block/flow:4,4,8,8', MISSING_TEXTURE, 'block/gibt_es_nicht'];
  for (const layerSize of [16, 32, 64]) {
    const bin = new TextureStore(f.binJson, f.bin, { layerSize });
    const atlas = new TextureStore(f.atlasJson, countingLoader(f.atlasPng).source, { layerSize });
    const { glA, glB, mapA, stats } = await assertSamePrepare(atlas, bin, names);
    assert.equal(stats.layers, 7, `${layerSize}: 6 Texturen + Fehltextur`);
    assert.deepEqual([mapA.get('block/flow').alpha, mapA.get('block/flow').animated], ['translucent', true]);
    assert.equal(mapA.get('entity/big').alpha, 'cutout');
    assert.equal(mapA.get('item/gem').alpha, 'cutout');
    assert.equal(mapA.get('block/plain').alpha, 'opaque');
    assert.equal(mapA.get('block/gibt_es_nicht').missing, true);
    // Animation: gleiche Ticks → gleiche Frames und Mischungen auf allen Stufen
    const flow = mapA.get('block/flow').layer;
    for (const time of [0, 50, 100, 120, 150, 199, 250, 400, 1000]) {
      assert.equal(atlas.tick(glA, time), bin.tick(glB, time), `tick ${time}`);
      for (let level = 0; level < atlas.levelCount; level++) {
        assert.deepEqual(atlas.readLayer(glA, flow, level), bin.readLayer(glB, flow, level), `${layerSize}: tick ${time}, Stufe ${level}`);
      }
    }
    // Weitere prepare-Aufrufe hängen nur Neues an – in beiden Modi gleich
    const [moreA, moreB] = await Promise.all([atlas.prepare(glA, ['block/plain', 'region:item/gem:1,1,14,14']), bin.prepare(glB, ['block/plain', 'region:item/gem:1,1,14,14'])]);
    assert.deepEqual([...moreA], [...moreB]);
    assert.equal(moreA.get('region:item/gem:1,1,14,14').alpha, 'opaque', 'Region ohne den transparenten Rand');
    assert.deepEqual(atlas.readLayer(glA, 7, 0), bin.readLayer(glB, 7, 0));
  }
  assert.equal(warn.mock.callCount(), 6, 'je Modus und Ebenengröße eine Sammel-Warnung');
  for (const call of warn.mock.calls) assert.match(call.arguments[0], /^Fehlende oder fehlerhafte Texturen \(zeige Fehltextur\): block\/gibt_es_nicht \(unbekannt\)$/);
  // Die reinen Bau-Funktionen bekommen in beiden Modi dasselbe Bild und liefern dasselbe
  const bin = new TextureStore(f.binJson, f.bin);
  const atlas = new TextureStore(f.atlasJson, countingLoader(f.atlasPng).source);
  for (const name of NAMES) {
    const entry = f.binJson.entries[name];
    const fromAtlas = buildLayer(name, entry, await atlas.image(name), { layerSize: 32 });
    const fromBin = buildLayer(name, entry, await bin.image(name), { layerSize: 32 });
    assert.deepEqual(fromAtlas, fromBin, name);
    const region = { x: 1, y: 2, w: 9, h: 7 };
    assert.deepEqual(buildLayer(name, entry, await atlas.image(name), { region }), buildLayer(name, entry, await bin.image(name), { region }));
  }
});

test('Atlas-Modus: Icons und data:-URLs wie mit textures.bin', async () => {
  const f = await fixture();
  const bin = new TextureStore(f.binJson, f.bin);
  const atlas = new TextureStore(f.atlasJson, countingLoader(f.atlasPng).source);
  assert.deepEqual(await atlas.iconImage('gem', null, { size: 32 }), await bin.iconImage('gem', null, { size: 32 }));
  assert.deepEqual(await atlas.iconImage('plain'), await bin.iconImage('plain'));
  const faces = { up: 'block/plain', north: ['block/flow', { texture: 'entity/big', tint: 0x80c040 }], east: 'block/flow', height: 0.5 };
  assert.deepEqual(await atlas.iconImage('anything', faces, { size: 48 }), await bin.iconImage('anything', faces, { size: 48 }));
  const url = await atlas.iconDataUrl('plain');
  assert.equal(url, await bin.iconDataUrl('plain'));
  assert.deepEqual(await decodePng(Buffer.from(url.split(',')[1], 'base64')), await bin.iconImage('plain'));
});

// ---------------------------------------------------------------- Laden: einmal je Atlas, Freigabe

test('Atlas wird je Name nur einmal geladen, auch bei gleichzeitigen Aufrufen; erst bei Bedarf', async () => {
  const f = await fixture();
  const { source, calls } = countingLoader(f.atlasPng, { delayMs: 20 });
  const store = new TextureStore(f.atlasJson, source);
  const gl1 = new FakeGL();
  const gl2 = new FakeGL();
  const results = await Promise.all([
    store.image('block/plain'), store.image('block/plain'), store.image('block/flow'),
    store.prepare(gl1, ['block/plain', 'entity/big']),
    store.prepare(gl2, ['block/flow', 'region:entity/big:0,0,4,4']),
  ]);
  assert.equal(results[0], results[1], 'dasselbe Bild-Objekt aus dem Zwischenspeicher');
  assert.deepEqual(calls, { blocks: 1 }, 'Item-Atlas wird nicht gebraucht und nicht geladen');
  assert.equal(store.stats(gl1).layers, 2);
  assert.equal(store.stats(gl2).layers, 2);
  await Promise.all([store.image('item/gem'), store.iconImage('gem'), store.prepare(new FakeGL(), [...NAMES])]);
  assert.deepEqual(calls, { blocks: 1, items: 1 });
});

test('Atlasbild wird freigegeben, sobald alle seine Texturen ausgeschnitten sind', async () => {
  const f = await fixture();
  const { source, calls } = countingLoader(f.atlasPng);
  const store = new TextureStore(f.atlasJson, source);
  assert.deepEqual(store.loadedAtlases(), []);
  const plain = await store.image('block/plain');
  assert.deepEqual(store.loadedAtlases(), ['blocks']);
  await store.image('block/flow');
  assert.deepEqual(store.loadedAtlases(), ['blocks'], 'entity/big fehlt noch');
  await store.image('entity/big');
  assert.deepEqual(store.loadedAtlases(), [], 'alle drei Texturen von „blocks“ sind ausgeschnitten');
  await store.image('item/gem');
  assert.deepEqual(store.loadedAtlases(), [], 'einzige Item-Textur → sofort frei');
  // Danach kommt alles aus dem Zwischenspeicher, auch prepare und Icons – ohne erneutes Laden
  assert.equal(await store.image('block/plain'), plain);
  const gl = new FakeGL();
  const map = await store.prepare(gl, [...NAMES, 'region:entity/big:1,1,3,3']);
  assert.equal(map.size, NAMES.length + 1);
  assert.ok([...map.values()].every((record) => !record.missing));
  await store.iconDataUrl('gem');
  assert.deepEqual(calls, { blocks: 1, items: 1 });
  assert.deepEqual(store.loadedAtlases(), []);

  // Ein Eintrag, der nie ausgeschnitten werden kann (Rechteck außerhalb), hält den Atlas im Speicher
  const broken = new TextureStore(withEntries(f.atlasJson, { 'block/outside': { atlas: 'blocks', x: 60, y: 0, w: 16, h: 16, anim: null } }), countingLoader(f.atlasPng).source);
  await Promise.all(NAMES.map((name) => broken.image(name)));
  await assert.rejects(broken.image('block/outside'));
  assert.deepEqual(broken.loadedAtlases(), ['blocks']);
});

// ---------------------------------------------------------------- Fehler

test('Rechteck außerhalb des Atlasbilds: klare Meldung bei image(), in prepare die Fehltextur', async (t) => {
  const f = await fixture();
  const { source, calls } = countingLoader(f.atlasPng);
  const json = withEntries(f.atlasJson, {
    'block/outside': { atlas: 'blocks', x: 60, y: 0, w: 16, h: 16, anim: null },
    'block/below': { atlas: 'blocks', x: 0, y: 50, w: 16, h: 16, anim: null },
    'item/edge': { atlas: 'items', x: 16, y: 0, w: 16, h: 16, anim: null },
  });
  const store = new TextureStore(json, source);
  const error = await rejectionOf(store.image('block/outside'));
  assert.ok(!(error instanceof TextureSourceError), 'Fehler der Textur, nicht der Quelle');
  assert.match(error.message, /Textur „block\/outside“: Rechteck x 60, y 0, 16×16 liegt außerhalb des Atlas „blocks“ \(64×64\)\./);
  await assert.rejects(store.image('block/below'), /y 50, 16×16 liegt außerhalb des Atlas „blocks“ \(64×64\)/);
  await assert.rejects(store.image('block/outside'), /außerhalb/, 'auch beim zweiten Mal');
  assert.deepEqual(await store.image('item/edge'), f.images['item/gem'], 'genau am Rand ist erlaubt');

  const warn = t.mock.method(console, 'warn', () => {});
  const gl = new FakeGL();
  const map = await store.prepare(gl, ['block/plain', 'block/outside', 'block/flow']);
  assert.equal(map.get('block/outside').missing, true);
  assert.equal(map.get('block/plain').missing, false);
  assert.equal(map.get('block/flow').missing, false);
  assert.equal(store.stats(gl).layers, 3, '2 Texturen + Fehltextur');
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /block\/outside \(Textur „block\/outside“: Rechteck x 60, y 0, 16×16 liegt außerhalb des Atlas „blocks“/);
  assert.deepEqual(calls, { blocks: 1, items: 1 });
});

test('Lader wirft: TextureSourceError mit Ursache, nichts zwischengespeichert, prepare lehnt ohne Änderung ab', async (t) => {
  const f = await fixture();
  let failures = 2;
  let calls = 0;
  const offline = new Error('Netz weg');
  const store = new TextureStore(f.atlasJson, {
    atlas: async (name) => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (failures-- > 0) throw offline;
      return f.atlasPng[name];
    },
  });
  const error = await rejectionOf(store.image('block/plain'));
  assert.ok(error instanceof TextureSourceError);
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'TextureSourceError');
  assert.equal(error.atlas, 'blocks');
  assert.equal(error.cause, offline, 'ursprünglicher Fehler bleibt erhalten (für menschliche Meldungen)');
  assert.equal(error.message, 'Der Textur-Atlas „blocks“ konnte nicht geladen werden: Netz weg');
  assert.deepEqual(store.loadedAtlases(), [], 'Fehler nicht behalten');

  const warn = t.mock.method(console, 'warn', () => {});
  const gl = new FakeGL();
  const failed = await rejectionOf(store.prepare(gl, ['block/plain', 'block/flow', 'entity/big']));
  assert.ok(failed instanceof TextureSourceError);
  assert.equal(failed.cause, offline);
  assert.equal(calls, 2, 'die drei Texturen teilen sich einen Ladeversuch');
  assert.deepEqual(store.stats(gl), { layers: 0, capacity: 0, animated: 0, missing: 0, alpha: { opaque: 0, cutout: 0, translucent: 0 } });
  assert.equal(store.texture(gl), null);
  assert.equal(warn.mock.callCount(), 0, 'keine Fehltextur-Warnung');

  // Netz wieder da → neuer Versuch klappt, Ebenen wie gewohnt ab 0
  const map = await store.prepare(gl, ['block/plain', 'block/flow', 'entity/big']);
  assert.equal(calls, 3);
  assert.deepEqual([...map.values()].map((record) => [record.layer, record.missing]), [[0, false], [1, false], [2, false]]);
  assert.deepEqual(await store.image('block/plain'), f.images['block/plain']);
  assert.equal(calls, 3);

  // Synchron werfender Lader und Nicht-Error-Werte werden ebenso zur abgelehnten Promise
  const sync = new TextureStore(f.atlasJson, { atlas: () => { throw new Error('sofort'); } });
  const pending = sync.image('block/plain');
  assert.ok(pending instanceof Promise);
  await assert.rejects(pending, (e) => e instanceof TextureSourceError && /konnte nicht geladen werden: sofort/.test(e.message));
  const odd = new TextureStore(f.atlasJson, { atlas: () => Promise.reject('kaputt') });
  await assert.rejects(odd.iconImage('plain'), (e) => e instanceof TextureSourceError && /: kaputt$/.test(e.message) && e.cause === 'kaputt');
  // Unbekannter Atlasname: der Lader entscheidet (hier: wirft)
  const unknown = new TextureStore({ entries: { 'block/x': { atlas: 'nowhere', x: 0, y: 0, w: 16, h: 16, anim: null } } }, countingLoader(f.atlasPng).source);
  await assert.rejects(unknown.image('block/x'), /„nowhere“ konnte nicht geladen werden: Atlas nowhere gibt es nicht/);
});

test('Lader liefert keine oder kaputte PNG-Bytes: klare Meldung, kein Zwischenspeichern; ArrayBuffer und Buffer gehen', async () => {
  const f = await fixture();
  const cases = [
    ['Text', 'kein PNG', /„blocks“ kam nicht als PNG-Bytes an/],
    ['nichts', undefined, /kam nicht als PNG-Bytes an/],
    ['Müll', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), /„blocks“ lässt sich nicht lesen: PNG: Signatur fehlt/],
    ['abgeschnitten', f.atlasPng.blocks.subarray(0, 60), /„blocks“ lässt sich nicht lesen: PNG: /],
    ['zu groß', await encodePng(createImage(4097, 1)), /„blocks“ lässt sich nicht lesen: PNG: ungültige Größe 4097×1/],
  ];
  for (const [label, value, pattern] of cases) {
    let calls = 0;
    const store = new TextureStore(f.atlasJson, { atlas: async () => { calls++; return value; } });
    const error = await rejectionOf(store.image('block/plain'));
    assert.ok(error instanceof TextureSourceError, label);
    assert.match(error.message, pattern, label);
    await assert.rejects(store.prepare(new FakeGL(), ['block/plain']), pattern, label);
    assert.equal(calls, 2, `${label}: zweiter Versuch lädt neu`);
  }
  const png = f.atlasPng.blocks;
  const asArrayBuffer = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
  for (const value of [asArrayBuffer, Buffer.from(png), new DataView(asArrayBuffer)]) {
    const store = new TextureStore(f.atlasJson, { atlas: async () => value });
    assert.deepEqual(await store.image('entity/big'), f.images['entity/big']);
  }
});

test('Einträge: gemischte Formen, Form passend zur Quelle, ungültige Felder', async () => {
  const f = await fixture();
  const loader = countingLoader(f.atlasPng).source;
  const mixed = withEntries(f.atlasJson, { 'block/old': f.binJson.entries['block/plain'] });
  assert.throws(() => new TextureStore(mixed, loader), /textures\.json mischt Einträge aus textures\.bin \(\{ o, l \}, z\. B\. „block\/old“\) und aus Atlanten/);
  assert.throws(() => new TextureStore(mixed, f.bin), /mischt Einträge/);
  assert.throws(() => new TextureStore(f.atlasJson, f.bin), /„block\/plain“ ist ein Atlas-Eintrag \(\{ atlas, x, y \}\), die Quelle ist aber textures\.bin/);
  assert.throws(() => new TextureStore(f.binJson, loader), /„block\/plain“ hat kein Feld atlas, die Quelle liefert aber Atlanten/);
  assert.equal(new TextureStore({ entries: {} }, loader).names().length, 0, 'leer geht in beiden Modi');
  assert.equal(new TextureStore({ entries: {} }, new Uint8Array(0)).mode, 'bin');

  const base = { atlas: 'blocks', x: 0, y: 0, w: 16, h: 16, anim: null };
  const one = (entry) => new TextureStore({ entries: { 'block/t': entry } }, loader);
  const bad = [
    [{ atlas: 'Blocks' }, /„block\/t“ hat einen ungültigen Atlasnamen/],
    [{ atlas: '1blocks' }, /ungültigen Atlasnamen/],
    [{ atlas: '' }, /ungültigen Atlasnamen/],
    [{ atlas: 'a'.repeat(33) }, /ungültigen Atlasnamen/],
    [{ atlas: 'blocks/../x' }, /ungültigen Atlasnamen/],
    [{ atlas: 42 }, /ungültigen Atlasnamen/],
    [{ atlas: null }, /ungültigen Atlasnamen/],
    [{ x: -1 }, /ungültige Atlas-Position/],
    [{ x: 1.5 }, /ungültige Atlas-Position/],
    [{ y: '0' }, /ungültige Atlas-Position/],
    [{ y: undefined }, /ungültige Atlas-Position/],
    [{ x: Number.NaN }, /ungültige Atlas-Position/],
    [{ w: 0 }, /ungültige Größe/],
    [{ h: 4097 }, /ungültige Größe/],
    [{ w: 16.5 }, /ungültige Größe/],
    [{ x: 4081 }, /liegt außerhalb jedes möglichen Atlas \(höchstens 4096×4096\)/],
    [{ y: 4090 }, /außerhalb jedes möglichen Atlas/],
    [{ o: 0 }, /zugleich atlas und o\/l/],
    [{ l: 100 }, /zugleich atlas und o\/l/],
    [{ h: 32, anim: { fw: 16, fh: 16, frames: [[2, 1]], interpolate: false } }, /ungültiger Frame/],
    [{ h: 32, anim: { fw: 16, fh: 10, frames: [[0, 1]], interpolate: false } }, /kein Vielfaches/],
    [{ h: 32, anim: { fw: 16, fh: 16, frames: [[0, 1]] } }, /interpolate/],
    [{ mip: 5 }, /ungültiges mip/],
    [{ bias: 'x' }, /ungültiges bias/],
  ];
  for (const [patch, pattern] of bad) {
    assert.throws(() => one({ ...base, ...patch }), pattern, JSON.stringify(patch));
  }
  assert.throws(() => new TextureStore({ entries: { 'block/t': null } }, loader), /„block\/t“ fehlt oder ist kein Objekt/);
  assert.throws(() => new TextureStore({ entries: { 'block/t': { w: 16, h: 16 } } }, f.bin), /„block\/t“ hat weder o\/l \(textures\.bin\) noch atlas\/x\/y/);
  // Grenzfälle, die gültig sind
  for (const patch of [{ atlas: 'a'.repeat(32) }, { atlas: 'entities_2' }, { x: 4080, y: 4080 }, { w: 4096, h: 4096 }, { mip: 'mean', bias: 0.1 }, { anim: undefined }]) {
    assert.doesNotThrow(() => one({ ...base, ...patch }), JSON.stringify(patch));
  }
});

test('Quelle und fromSource: Bytes oder Lader, genau eins, Fehler sofort', async () => {
  const f = await fixture();
  for (const source of [undefined, null, 'abc', 42, {}, { bin: f.bin }]) {
    assert.throws(() => new TextureStore(f.binJson, source), /Texturquelle fehlt/, String(source));
  }
  assert.throws(() => new TextureStore(f.atlasJson, { atlas: 'blocks' }), /atlas muss eine Funktion/);
  assert.throws(() => new TextureStore({}, f.bin), /Format/, 'Format von textures.json zuerst');

  // textures.bin als ArrayBuffer, DataView und Buffer
  const arrayBuffer = f.bin.buffer.slice(f.bin.byteOffset, f.bin.byteOffset + f.bin.byteLength);
  for (const bin of [arrayBuffer, new DataView(arrayBuffer), Buffer.from(f.bin)]) {
    assert.deepEqual(await new TextureStore(f.binJson, bin).image('block/flow'), f.images['block/flow']);
  }

  const fromBin = TextureStore.fromSource({ json: f.binJson, bin: f.bin });
  assert.equal(fromBin.mode, 'bin');
  assert.deepEqual(await fromBin.image('entity/big'), f.images['entity/big']);
  const { source, calls } = countingLoader(f.atlasPng);
  const fromAtlas = TextureStore.fromSource({ json: f.atlasJson, atlas: source.atlas }, { layerSize: 16 });
  assert.equal(fromAtlas.mode, 'atlas');
  assert.equal(fromAtlas.layerSize, 16);
  assert.deepEqual(await fromAtlas.image('item/gem'), f.images['item/gem']);
  assert.deepEqual(calls, { items: 1 });
  // Lader als Methode, die this braucht
  const withThis = { json: f.atlasJson, pngs: f.atlasPng, atlas(name) { return Promise.resolve(this.pngs[name]); } };
  assert.deepEqual(await TextureStore.fromSource(withThis).image('block/plain'), f.images['block/plain']);

  assert.throws(() => TextureStore.fromSource(null), /Texturquelle fehlt/);
  assert.throws(() => TextureStore.fromSource('x'), /Texturquelle fehlt/);
  assert.throws(() => TextureStore.fromSource({ json: f.binJson }), /genau eins von bin/);
  assert.throws(() => TextureStore.fromSource({ json: f.binJson, bin: f.bin, atlas: source.atlas }), /genau eins von bin/);
  assert.throws(() => TextureStore.fromSource({ json: f.atlasJson, atlas: 'blocks' }), /atlas muss eine Funktion/);
  assert.throws(() => TextureStore.fromSource({ json: {}, bin: f.bin }), /Format/);
  assert.throws(() => TextureStore.fromSource({ json: f.atlasJson, bin: f.bin }), /ist ein Atlas-Eintrag/);
  assert.throws(() => TextureStore.fromSource({ json: f.binJson, bin: f.bin }, { layerSize: 24 }), /Ebenengröße/);
});

test('TextureStore.load lädt wie bisher textures.json + textures.bin (Modus bin)', async (t) => {
  const f = await fixture();
  const server = http.createServer((request, response) => {
    if (request.url === '/gd/textures.json') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(f.binJson));
    } else if (request.url === '/gd/textures.bin') {
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(Buffer.from(f.bin));
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const store = await TextureStore.load(`${base}/gd/`);
  assert.equal(store.mode, 'bin');
  assert.deepEqual(store.names(), NAMES);
  assert.deepEqual(await store.image('block/flow'), f.images['block/flow']);
  await assert.rejects(TextureStore.load(`${base}/fehlt/`), /Die Texturen konnten nicht geladen werden \(\/fehlt\/textures\.(json|bin): HTTP 404\)/);
});

// ---------------------------------------------------------------- Echte Spieldaten: alle Texturen über Atlanten

// Packt Bilder zeilenweise (nach Höhe sortiert) in ein Atlasbild mit 1 Pixel Abstand und buntem Hintergrund.
function packAtlas(items, width) {
  const sorted = [...items].sort((a, b) => b.image.height - a.image.height || (a.name < b.name ? -1 : 1));
  const placed = [];
  let x = 0, y = 0, rowHeight = 0;
  for (const item of sorted) {
    if (x + item.image.width > width) {
      y += rowHeight + 1;
      x = 0;
      rowHeight = 0;
    }
    placed.push({ ...item, x, y });
    x += item.image.width + 1;
    rowHeight = Math.max(rowHeight, item.image.height);
  }
  const image = noise(width, y + rowHeight, 7);
  for (const item of placed) paste(image, item.image, item.x, item.y);
  return { image, placed };
}

dataTest('Echte Spieldaten: alle Texturen aus Atlanten pixelgleich, prepare und tick wie mit textures.bin', async (t) => {
  const json = JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'textures.json'), 'utf8'));
  const bin = new TextureStore(json, fs.readFileSync(path.join(GAME_DATA, 'textures.bin')));
  const names = bin.names();
  const images = new Map(await Promise.all(names.map(async (name) => [name, await bin.image(name)])));
  // Atlanten wie bei misode/mcmeta nach Art getrennt (blocks, items, entities; colormap hier eigener Atlas)
  const groups = { blocks: 'block/', items: 'item/', entities: 'entity/', colormaps: 'colormap/' };
  const atlasPng = {};
  const entries = {};
  for (const [atlasName, prefix] of Object.entries(groups)) {
    const items = names.filter((name) => name.startsWith(prefix)).map((name) => ({ name, image: images.get(name) }));
    const { image, placed } = packAtlas(items, 1024);
    assert.ok(image.height <= 4096, `${atlasName}: ${image.width}×${image.height}`);
    atlasPng[atlasName] = await encodePng(image);
    for (const { name, x, y } of placed) {
      const { o, l, ...rest } = json.entries[name];
      entries[name] = { ...rest, atlas: atlasName, x, y };
    }
  }
  assert.equal(Object.keys(entries).length, names.length, 'jede Textur in genau einem Atlas');
  const { source, calls } = countingLoader(atlasPng, { delayMs: 1 });
  const atlas = new TextureStore({ version: json.version, entries }, source);
  assert.deepEqual(atlas.names(), names);
  const cropped = await Promise.all(names.map((name) => atlas.image(name)));
  names.forEach((name, i) => {
    assert.deepEqual(cropped[i], images.get(name), name);
    assert.deepEqual(atlas.info(name), bin.info(name), name);
  });
  assert.deepEqual(calls, { blocks: 1, items: 1, entities: 1, colormaps: 1 });
  assert.deepEqual(atlas.loadedAtlases(), [], 'alle Texturen ausgeschnitten → alle Atlanten frei');

  // prepare/tick: alle animierten Texturen, alle mit mip, große Entity-Texturen, Regionen, Fehltextur
  const chosen = names.filter((name) => json.entries[name].anim || json.entries[name].mip || json.entries[name].w > 16
    || ['block/stone', 'block/glass', 'item/redstone', 'block/oak_leaves'].includes(name));
  chosen.push('region:entity/chest/normal:14,14,14,5', 'region:block/water_still:0,0,8,8', 'block/gibt_es_nicht');
  const warn = t.mock.method(console, 'warn', () => {});
  const { glA, glB, mapA, stats } = await assertSamePrepare(atlas, bin, chosen);
  assert.ok(stats.layers > 100 && stats.animated > 20, JSON.stringify(stats));
  assert.equal(mapA.get('block/water_still').alpha, 'translucent');
  for (const time of [0, 50, 100, 350, 1234, 5000]) {
    assert.equal(atlas.tick(glA, time), bin.tick(glB, time));
    for (let layer = 0; layer < stats.layers; layer++) assert.deepEqual(atlas.readLayer(glA, layer, 0), bin.readLayer(glB, layer, 0), `tick ${time}, Ebene ${layer}`);
  }
  assert.equal(warn.mock.callCount(), 2, 'je Modus eine Sammel-Warnung (block/gibt_es_nicht)');
  warn.mock.restore();
  assert.deepEqual(await atlas.iconImage('grass_block', { up: { texture: 'block/grass_block_top', tint: 0x91bd59 }, north: 'block/grass_block_side', east: 'block/grass_block_side' }),
    await bin.iconImage('grass_block', { up: { texture: 'block/grass_block_top', tint: 0x91bd59 }, north: 'block/grass_block_side', east: 'block/grass_block_side' }));
  assert.deepEqual(calls, { blocks: 1, items: 1, entities: 1, colormaps: 1 });
});
