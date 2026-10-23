import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  TextureStore, decodePng, encodePng, createImage, cropImage, resampleNearest, missingImage, scanTransparency, alphaClassOf,
  rectAlphaClass, SRGB_TO_LINEAR, LINEAR_TO_SRGB, solidify, fillEmptyAreasWithDarkColor, alphaTestCoverage, scaleAlphaToCoverage,
  generateMipLevels, parseTextureName, animationFrameAt, mixLevels, buildLayer, renderBlockIcon, MISSING_TEXTURE,
} from '../../js/render/texture-store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_DATA = path.join(ROOT, 'game-data');
const hasGameData = fs.existsSync(path.join(GAME_DATA, 'textures.json')) && fs.existsSync(path.join(GAME_DATA, 'textures.bin'));
const dataTest = hasGameData ? test : test.skip;

// ---------------------------------------------------------------- Hilfen: PNG schreiben (Testdaten)

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(body).copy(out, 8);
  out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

function packRow(samples, depth) {
  if (depth === 8) return Buffer.from(samples);
  if (depth === 16) {
    const out = Buffer.alloc(samples.length * 2);
    samples.forEach((v, i) => out.writeUInt16BE(v, i * 2));
    return out;
  }
  const out = Buffer.alloc(Math.ceil((samples.length * depth) / 8));
  samples.forEach((v, i) => {
    const bit = i * depth;
    out[bit >> 3] |= v << (8 - depth - (bit & 7));
  });
  return out;
}

function filterRow(raw, prev, type, bpp) {
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const a = i >= bpp ? raw[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    let predictor = 0;
    if (type === 1) predictor = a;
    else if (type === 2) predictor = b;
    else if (type === 3) predictor = (a + b) >> 1;
    else if (type === 4) {
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    out[i] = (raw[i] - predictor) & 255;
  }
  return out;
}

// sample(x, y) → Liste der Kanalwerte (Rohwerte in voller Bittiefe; Palette: Index)
function writePng({ width, height, colorType, depth, interlace = 0, palette = null, trns = null }, sample) {
  const channels = CHANNELS[colorType];
  const bpp = Math.max(1, (channels * depth) >> 3);
  const rows = [];
  const passes = interlace ? ADAM7 : [[0, 0, 1, 1]];
  let rowIndex = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = width > x0 ? Math.ceil((width - x0) / dx) : 0;
    const ph = height > y0 ? Math.ceil((height - y0) / dy) : 0;
    if (!pw || !ph) continue;
    let prev = Buffer.alloc(Math.ceil((pw * channels * depth) / 8));
    for (let j = 0; j < ph; j++) {
      const samples = [];
      for (let i = 0; i < pw; i++) samples.push(...sample(x0 + i * dx, y0 + j * dy));
      const raw = packRow(samples, depth);
      const type = rowIndex++ % 5;
      rows.push(Buffer.from([type]), filterRow(raw, prev, type, bpp));
      prev = raw;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = depth; header[9] = colorType; header[12] = interlace;
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header)];
  if (palette) parts.push(chunk('PLTE', Buffer.from(palette.flat())));
  if (trns) parts.push(chunk('tRNS', Buffer.from(trns)));
  const data = zlib.deflateSync(Buffer.concat(rows));
  parts.push(chunk('IDAT', data.subarray(0, 5)), chunk('IDAT', data.subarray(5)), chunk('IEND', Buffer.alloc(0)));
  return new Uint8Array(Buffer.concat(parts));
}

function expectPixels(image, width, height, expected) {
  assert.equal(image.width, width);
  assert.equal(image.height, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      assert.deepEqual([...image.data.subarray(o, o + 4)], expected(x, y), `Pixel ${x},${y}`);
    }
  }
}

function solidImage(width, height, rgba) {
  const image = createImage(width, height);
  for (let i = 0; i < width * height; i++) image.data.set(rgba, i * 4);
  return image;
}

function setPixel(image, x, y, rgba) {
  image.data.set(rgba, (y * image.width + x) * 4);
}

function getPixel(image, x, y) {
  const o = (y * image.width + x) * 4;
  return [...image.data.subarray(o, o + 4)];
}

// ---------------------------------------------------------------- Hilfen: WebGL-Ersatz

class FakeGL {
  TEXTURE_2D_ARRAY = 0x8c1a; RGBA8 = 0x8058; RGBA = 0x1908; UNSIGNED_BYTE = 0x1401;
  TEXTURE_MIN_FILTER = 0x2801; TEXTURE_MAG_FILTER = 0x2800; NEAREST = 0x2600; NEAREST_MIPMAP_LINEAR = 0x2702;
  TEXTURE_WRAP_S = 0x2802; TEXTURE_WRAP_T = 0x2803; REPEAT = 0x2901; TEXTURE_BASE_LEVEL = 0x813c; TEXTURE_MAX_LEVEL = 0x813d;
  MAX_ARRAY_TEXTURE_LAYERS = 0x88ff; TEXTURE_BINDING_2D_ARRAY = 0x8c1d; PIXEL_UNPACK_BUFFER = 0x88ec; PIXEL_UNPACK_BUFFER_BINDING = 0x88ef;
  UNPACK_FLIP_Y_WEBGL = 0x9240; UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241; UNPACK_ALIGNMENT = 0x0cf5; UNPACK_ROW_LENGTH = 0x0cf2;
  UNPACK_IMAGE_HEIGHT = 0x806e; UNPACK_SKIP_PIXELS = 0x0cf4; UNPACK_SKIP_ROWS = 0x0cf3; UNPACK_SKIP_IMAGES = 0x806d;
  NO_ERROR = 0; INVALID_OPERATION = 0x0502; TEXTURE0 = 0x84c0;

  constructor({ maxLayers = 2048 } = {}) {
    this.maxLayers = maxLayers;
    this.textures = new Set();
    this.bound = null;
    this.lost = false;
    this.error = 0;
    this.storageCalls = 0;
    this.uploads = [];
    this.pixelStore = { [this.UNPACK_FLIP_Y_WEBGL]: false, [this.UNPACK_PREMULTIPLY_ALPHA_WEBGL]: false, [this.UNPACK_ALIGNMENT]: 4,
      [this.UNPACK_ROW_LENGTH]: 0, [this.UNPACK_IMAGE_HEIGHT]: 0, [this.UNPACK_SKIP_PIXELS]: 0, [this.UNPACK_SKIP_ROWS]: 0, [this.UNPACK_SKIP_IMAGES]: 0 };
  }

  createTexture() {
    if (this.lost) return null;
    const texture = { levels: null, params: {} };
    this.textures.add(texture);
    return texture;
  }
  deleteTexture(texture) { this.textures.delete(texture); }
  isTexture(texture) { return !this.lost && this.textures.has(texture); }
  isContextLost() { return this.lost; }
  bindTexture(target, texture) { this.bound = texture; }
  activeTexture() {}
  bindBuffer() {}
  pixelStorei(name, value) { this.pixelStore[name] = value; }
  getError() {
    const e = this.error;
    this.error = 0;
    return e;
  }
  getParameter(name) {
    if (name === this.MAX_ARRAY_TEXTURE_LAYERS) return this.maxLayers;
    if (name === this.TEXTURE_BINDING_2D_ARRAY) return this.bound;
    if (name === this.PIXEL_UNPACK_BUFFER_BINDING) return null;
    if (name in this.pixelStore) return this.pixelStore[name];
    throw new Error(`FakeGL: getParameter(${name}) unbekannt`);
  }
  texStorage3D(target, levels, format, width, height, depth) {
    this.storageCalls++;
    this.bound.size = width;
    this.bound.depth = depth;
    this.bound.levels = Array.from({ length: levels }, (_, l) => new Uint8Array((width >> l) * (height >> l) * 4 * depth));
  }
  texParameteri(target, name, value) { this.bound.params[name] = value; }
  texSubImage3D(target, level, x, y, z, width, height, depth, format, type, data, offset) {
    if (this.pixelStore[this.UNPACK_FLIP_Y_WEBGL] || this.pixelStore[this.UNPACK_PREMULTIPLY_ALPHA_WEBGL]) {
      this.error = this.INVALID_OPERATION;
      return;
    }
    const tex = this.bound;
    assert.ok(tex?.levels, 'texSubImage3D ohne texStorage3D');
    assert.equal(x, 0); assert.equal(y, 0);
    assert.equal(width, tex.size >> level);
    assert.ok(z + depth <= tex.depth, 'Ebene außerhalb der Kapazität');
    const bytes = width * height * 4;
    tex.levels[level].set(data.subarray(offset, offset + bytes * depth), z * bytes);
    this.uploads.push({ level, z, depth });
  }
  // Inhalt einer Ebene in der aktuell gültigen Textur
  layerData(texture, layer, level) {
    const bytes = (texture.size >> level) ** 2 * 4;
    return texture.levels[level].slice(layer * bytes, (layer + 1) * bytes);
  }
}

let storePromise = null;
function loadStore() {
  storePromise ??= Promise.resolve(new TextureStore(
    JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'textures.json'), 'utf8')),
    fs.readFileSync(path.join(GAME_DATA, 'textures.bin')),
  ));
  return storePromise;
}

// ---------------------------------------------------------------- PNG

test('decodePng: Palette 1/2/4/8 Bit mit tRNS, Grau mit Schlüssel, RGB 16 Bit, Grau+Alpha, RGBA, alle Filter', async () => {
  const palette = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [9, 99, 199]];
  for (const depth of [1, 2, 4, 8]) {
    const size = 1 << Math.min(depth, 2);
    const png = writePng({ width: 11, height: 5, colorType: 3, depth, palette: palette.slice(0, size), trns: [255, 0] }, (x, y) => [(x + y) % size]);
    expectPixels(await decodePng(png), 11, 5, (x, y) => {
      const i = (x + y) % size;
      return [...palette[i], i === 1 ? 0 : 255];
    });
  }
  for (const depth of [1, 2, 4, 8, 16]) {
    const max = (1 << depth) - 1;
    const key = max === 1 ? 0 : 1;
    const png = writePng({ width: 9, height: 4, colorType: 0, depth, trns: [key >> 8, key & 255] }, (x, y) => [(x * 3 + y) % (max + 1)]);
    expectPixels(await decodePng(png), 9, 4, (x, y) => {
      const v = (x * 3 + y) % (max + 1);
      const g = depth === 16 ? v >> 8 : Math.round((v * 255) / max);
      return [g, g, g, v === key ? 0 : 255];
    });
  }
  const rgb16 = writePng({ width: 6, height: 3, colorType: 2, depth: 16, trns: [0, 0, 0, 0, 0, 0] }, (x, y) => [x * 9000, y * 20000, 0]);
  expectPixels(await decodePng(rgb16), 6, 3, (x, y) => [(x * 9000) >> 8, (y * 20000) >> 8, 0, x === 0 && y === 0 ? 0 : 255]);
  const gray = writePng({ width: 7, height: 6, colorType: 4, depth: 8 }, (x, y) => [x * 30, y * 40]);
  expectPixels(await decodePng(gray), 7, 6, (x, y) => [x * 30, x * 30, x * 30, y * 40]);
  const rgba = writePng({ width: 8, height: 10, colorType: 6, depth: 8 }, (x, y) => [x * 31, y * 25, (x * y) % 256, 255 - x * 7]);
  expectPixels(await decodePng(rgba), 8, 10, (x, y) => [x * 31, y * 25, (x * y) % 256, 255 - x * 7]);
});

test('decodePng: Adam7-Zeilensprung, auch bei winzigen Bildern mit leeren Durchgängen', async () => {
  for (const [w, h] of [[13, 11], [1, 1], [3, 2], [16, 16]]) {
    const png = writePng({ width: w, height: h, colorType: 6, depth: 8, interlace: 1 }, (x, y) => [x * 10, y * 10, 7, 200]);
    expectPixels(await decodePng(png), w, h, (x, y) => [x * 10, y * 10, 7, 200]);
  }
});

test('decodePng meldet kaputte Dateien verständlich', async () => {
  await assert.rejects(decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])), /Signatur/);
  const good = writePng({ width: 4, height: 4, colorType: 6, depth: 8 }, () => [1, 2, 3, 4]);
  await assert.rejects(decodePng(good.subarray(0, 40)), /PNG/);
  const raw = Buffer.concat([Buffer.from([9]), Buffer.alloc(16)]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  const badFilter = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  await assert.rejects(decodePng(new Uint8Array(badFilter)), /Zeilenfilter 9/);
  // Kopf sagt 2×2, die Daten entpacken aber zu 200×200 → abbrechen statt Speicher fluten
  const bombHeader = Buffer.alloc(13);
  bombHeader.writeUInt32BE(2, 0); bombHeader.writeUInt32BE(2, 4); bombHeader[8] = 8; bombHeader[9] = 6;
  const bomb = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', bombHeader), chunk('IDAT', zlib.deflateSync(Buffer.alloc(200 * 801))), chunk('IEND', Buffer.alloc(0))]);
  await assert.rejects(decodePng(new Uint8Array(bomb)), /größer als im Kopf/);
  const paletteMissing = Buffer.from(writePng({ width: 2, height: 2, colorType: 3, depth: 8, palette: [[0, 0, 0]] }, () => [0]));
  const without = Buffer.concat([paletteMissing.subarray(0, 33), paletteMissing.subarray(33 + 12 + 3)]);
  await assert.rejects(decodePng(new Uint8Array(without)), /Palette fehlt/);
});

test('encodePng → decodePng ergibt dasselbe Bild', async () => {
  const image = createImage(7, 5);
  for (let i = 0; i < image.data.length; i++) image.data[i] = (i * 37) % 256;
  const decoded = await decodePng(await encodePng(image));
  assert.deepEqual(decoded, image);
});

// ---------------------------------------------------------------- Bilder, Transparenz

test('Fehltextur, Ausschnitt und pixelgenaues Skalieren', () => {
  const missing = missingImage(16);
  assert.deepEqual(getPixel(missing, 0, 0), [0, 0, 0, 255]);
  assert.deepEqual(getPixel(missing, 15, 0), [248, 0, 248, 255]);
  assert.deepEqual(getPixel(missing, 0, 15), [248, 0, 248, 255]);
  assert.deepEqual(getPixel(missing, 8, 8), [0, 0, 0, 255]);

  const src = createImage(4, 2);
  for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) setPixel(src, x, y, [x, y, 0, 255]);
  const crop = cropImage(src, 1, 1, 2, 1);
  assert.deepEqual([getPixel(crop, 0, 0), getPixel(crop, 1, 0)], [[1, 1, 0, 255], [2, 1, 0, 255]]);
  assert.throws(() => cropImage(src, 3, 0, 2, 1), /Ausschnitt/);
  const up = resampleNearest(src, 8, 4);
  assert.deepEqual(getPixel(up, 5, 3), getPixel(src, 2, 1));
  const down = resampleNearest(src, 2, 1);
  assert.deepEqual([getPixel(down, 0, 0), getPixel(down, 1, 0)], [getPixel(src, 1, 1), getPixel(src, 3, 1)]);
  const odd = resampleNearest(createImage(14, 14), 16, 16);
  assert.equal(odd.width, 16);
});

test('Alpha-Klassen und Rechteck-Abfrage wie SpriteContents.computeTransparency', () => {
  const image = solidImage(4, 4, [9, 9, 9, 255]);
  assert.equal(alphaClassOf(scanTransparency(image)), 'opaque');
  setPixel(image, 0, 0, [0, 0, 0, 0]);
  assert.equal(alphaClassOf(scanTransparency(image)), 'cutout');
  setPixel(image, 3, 3, [0, 0, 0, 128]);
  assert.equal(alphaClassOf(scanTransparency(image)), 'translucent');
  assert.deepEqual(scanTransparency(image, 1, 1, 3, 3), { transparent: false, translucent: false });

  // Maske 4×4: linke zwei Spalten transparent, (3,3) halbtransparent
  const mask = new Uint8Array(16);
  for (let y = 0; y < 4; y++) { mask[y * 4] = 1; mask[y * 4 + 1] = 1; }
  mask[15] = 2;
  const entry = { alpha: 'translucent', mask, maskWidth: 4, maskHeight: 4 };
  assert.equal(rectAlphaClass(entry, 0, 0, 16, 16), 'translucent');
  assert.equal(rectAlphaClass(entry, 8, 0, 16, 8), 'opaque');
  assert.equal(rectAlphaClass(entry, 0, 0, 8, 16), 'cutout');
  assert.equal(rectAlphaClass(entry, 12, 12, 16, 16), 'translucent');
  assert.equal(rectAlphaClass(entry, 16, 8, 8, 0), 'opaque', 'vertauschte UV');
  assert.equal(rectAlphaClass(entry, 9, 0, 9, 16), 'opaque', 'leeres Rechteck');
  assert.equal(rectAlphaClass(entry, 7.9, 0, 8.1, 4), 'cutout', 'Rand wird abgerundet (floor/ceil)');
  assert.equal(rectAlphaClass({ alpha: 'opaque', mask: null }, 0, 0, 1, 1), 'opaque');
  assert.throws(() => rectAlphaClass(null, 0, 0, 1, 1), /prepare/);
});

// ---------------------------------------------------------------- Mipmaps (MipmapGenerator 26.2)

test('sRGB-Tabellen wie ARGB (10 Bit linear)', () => {
  assert.equal(SRGB_TO_LINEAR[0], 0);
  assert.equal(SRGB_TO_LINEAR[255], 1023);
  assert.equal(SRGB_TO_LINEAR[128], 221);
  assert.equal(LINEAR_TO_SRGB[0], 0);
  assert.equal(LINEAR_TO_SRGB[1023], 255);
  assert.equal(LINEAR_TO_SRGB[221], 128);
  for (let i = 1; i < 256; i++) assert.ok(SRGB_TO_LINEAR[i] >= SRGB_TO_LINEAR[i - 1]);
  for (let i = 1; i < 1024; i++) assert.ok(LINEAR_TO_SRGB[i] >= LINEAR_TO_SRGB[i - 1]);
});

test('mean: lineares Mitteln (Schachbrett schwarz/weiß → 187, nicht 128)', () => {
  const gray = generateMipLevels(solidImage(16, 16, [128, 128, 128, 255]), { levels: 4 });
  assert.deepEqual(gray.map((l) => l.width), [16, 8, 4, 2, 1]);
  for (const level of gray) assert.deepEqual(getPixel(level, 0, 0), [128, 128, 128, 255]);
  const checker = createImage(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPixel(checker, x, y, (x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
  const mips = generateMipLevels(checker, { strategy: 'mean', levels: 1 });
  const expected = Math.round(255 * (1.055 * Math.pow(511 / 1023, 1 / 2.4) - 0.055));
  assert.equal(expected, 187);
  assert.deepEqual(getPixel(mips[1], 3, 5), [187, 187, 187, 255]);
  assert.deepEqual(getPixel(checker, 0, 0), [0, 0, 0, 255], 'Eingabe bleibt unverändert');
});

test('cutout: Abdeckung bleibt erhalten, transparente Pixel bekommen Nachbarfarbe, Alpha +0,025', () => {
  const disc = createImage(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const inside = (x - 7.5) ** 2 + (y - 7.5) ** 2 < 30 || (x + y) % 5 === 0;
      setPixel(disc, x, y, inside ? [40, 160, 30, 255] : [250, 0, 250, 0]);
    }
  }
  const target = alphaTestCoverage(disc, 0.5, 1);
  const mips = generateMipLevels(disc, { levels: 4 });
  // auto → cutout: Farbe transparenter Pixel aus dem nächsten sichtbaren Pixel
  assert.deepEqual(getPixel(disc, 1, 15), [250, 0, 250, 0]);
  assert.deepEqual(getPixel(mips[0], 1, 15), [40, 160, 30, 0]);
  // Binärsuche mit 5 Schritten plus Zuschlag 0,025 (wie im Spiel): nah am Ziel, nicht exakt
  for (let level = 1; level <= 2; level++) {
    const deviation = Math.abs(alphaTestCoverage(mips[level], 0.5, 1) - target);
    assert.ok(deviation < 0.1, `Stufe ${level}: Abdeckung weicht um ${deviation} ab`);
  }
  // Feine Linien (jede zweite Spalte): einfaches Mitteln lässt sie verschwinden, das Spiel-Verfahren nicht
  const lines = createImage(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPixel(lines, x, y, x % 2 === 0 ? [40, 160, 30, 255] : [0, 0, 0, 0]);
  const lineMips = generateMipLevels(lines, { levels: 3 });
  const lineNaive = generateMipLevels(lines, { strategy: 'mean', levels: 3 });
  for (let level = 1; level <= 3; level++) {
    assert.equal(alphaTestCoverage(lineNaive[level], 0.5, 1), 0, `Mitteln, Stufe ${level}`);
    assert.equal(alphaTestCoverage(lineMips[level], 0.5, 1), 1, `Spiel-Verfahren, Stufe ${level}`);
  }
  assert.deepEqual([1, 2, 3].map((level) => lineMips[level].data[3]), [133, 139, 145], 'Zuschlag summiert sich je Stufe');
  const empty = createImage(2, 2);
  const emptyMips = generateMipLevels(empty, { strategy: 'cutout', levels: 1 });
  assert.equal(getPixel(emptyMips[1], 0, 0)[3], Math.floor(Math.fround(0.025) * 255), 'nur der Zuschlag 0,025');
});

test('strict_cutout prüft gegen 0,3, dark_cutout dunkelt ab, item/… wird nicht aufgefüllt', () => {
  const faint = solidImage(4, 4, [200, 200, 200, 100]);
  assert.equal(alphaTestCoverage(faint, 0.5, 1), 0);
  assert.equal(alphaTestCoverage(faint, 0.3, 1), 1);

  // Schachbrett: jeder 2×2-Block halb deckend (weiß), halb transparent
  const leaf = createImage(4, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) setPixel(leaf, x, y, (x + y) % 2 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 0]);
  setPixel(leaf, 2, 2, [40, 80, 120, 255]);
  const dark = generateMipLevels(leaf, { strategy: 'dark_cutout', levels: 1 });
  assert.deepEqual(getPixel(dark[0], 1, 0), [30, 60, 90, 0], '¾ der dunkelsten Farbe');
  assert.deepEqual(getPixel(dark[1], 0, 0).slice(0, 3), [187, 187, 187], 'transparente Hälfte zählt als Schwarz (linear)');
  const cut = generateMipLevels(leaf, { strategy: 'cutout', levels: 1 });
  assert.deepEqual(getPixel(cut[1], 0, 0).slice(0, 3), [255, 255, 255], 'cutout: aufgefüllte Nachbarfarbe');
  const halfClear = createImage(4, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) setPixel(halfClear, x, y, [255, 255, 255, 255]);
  const darkHalf = generateMipLevels(halfClear, { strategy: 'dark_cutout', levels: 1 });
  assert.deepEqual(getPixel(darkHalf[1], 1, 0).slice(0, 3), [0, 0, 0], 'nur transparente Pixel → schwarz');

  const item = createImage(2, 1);
  setPixel(item, 0, 0, [255, 0, 0, 255]);
  setPixel(item, 1, 0, [10, 20, 30, 0]);
  assert.deepEqual(getPixel(generateMipLevels(item, { name: 'item/thing' })[0], 1, 0), [10, 20, 30, 0]);
  assert.deepEqual(getPixel(generateMipLevels(item, { name: 'block/thing' })[0], 1, 0), [255, 0, 0, 0]);

  const allClear = fillEmptyAreasWithDarkColor(createImage(2, 2));
  assert.deepEqual(getPixel(allClear, 0, 0), [191, 191, 191, 0]);
  const line = createImage(3, 1);
  setPixel(line, 0, 0, [5, 6, 7, 255]);
  solidify(line);
  assert.deepEqual(getPixel(line, 2, 0), [5, 6, 7, 0]);
  assert.ok(Number.isNaN(alphaTestCoverage(createImage(1, 4), 0.5, 1)), '1 Pixel breit → NaN wie im Spiel');
  const single = solidImage(1, 1, [1, 2, 3, 100]);
  scaleAlphaToCoverage(single, 0.5, 0.5, 0);
  assert.equal(getPixel(single, 0, 0)[3], Math.floor(Math.fround(Math.fround(100 / 255) + Math.fround(0.025)) * 255));
  assert.throws(() => generateMipLevels(leaf, { strategy: 'blur' }), /Strategie/);
  assert.throws(() => generateMipLevels(leaf, { levels: 3 }), /zu klein/);
});

// ---------------------------------------------------------------- Namen, Animation, Ebenen

test('parseTextureName', () => {
  assert.deepEqual(parseTextureName('block/stone'), { kind: 'texture', texture: 'block/stone' });
  assert.deepEqual(parseTextureName('minecraft:block/stone'), { kind: 'texture', texture: 'block/stone' });
  assert.deepEqual(parseTextureName('region:entity/chest/normal:14,14,14,5'), { kind: 'region', texture: 'entity/chest/normal', x: 14, y: 14, w: 14, h: 5 });
  assert.deepEqual(parseTextureName(MISSING_TEXTURE), { kind: 'missing' });
  for (const bad of ['', 'Block/Stone', '../secret', 'block/../x', 'region:x', 'region:block/stone:0,0,0,4', 'region:block/stone:1,2,3', 42, null]) {
    assert.equal(parseTextureName(bad).kind, 'invalid', String(bad));
  }
});

test('animationFrameAt: Ticks, Wiederholung, Interpolationsanteil, negative Zeit', () => {
  const simple = { frames: [[0, 2], [1, 2]], interpolate: false };
  const seq = [0, 1, 2, 3, 4].map((t) => { const f = animationFrameAt(simple, t); return [f.index, f.subFrame]; });
  assert.deepEqual(seq, [[0, 0], [0, 1], [1, 0], [1, 1], [0, 0]]);
  assert.deepEqual([animationFrameAt(simple, -1).index, animationFrameAt(simple, -1).subFrame], [1, 1]);
  const lerp = { frames: [[0, 3], [1, 3]], interpolate: true };
  assert.equal(animationFrameAt(lerp, 1).progress, 0.333);
  assert.equal(animationFrameAt(lerp, 2).progress, 0.666);
  const uneven = { frames: [[5, 1], [2, 10], [5, 4]], interpolate: false };
  assert.equal(animationFrameAt(uneven, 1).index, 2);
  const f = animationFrameAt(uneven, 11);
  assert.deepEqual([f.index, f.position, f.subFrame, f.nextIndex], [5, 2, 0, 5]);
  assert.deepEqual([...mixLevels([Uint8Array.from([0, 100, 200, 255])], [Uint8Array.from([255, 0, 100, 255])], 0.5)[0]], [128, 50, 150, 255]);
});

test('buildLayer: 16×16 verdoppelt, 32×32 unverändert, Streifen-Animation, Region mit eigener Alpha-Klasse', () => {
  const small = createImage(16, 16);
  for (let i = 0; i < 256; i++) small.data.set([i, 255 - i, (i * 7) % 256, 255], i * 4);
  const layer = buildLayer('block/test', { w: 16, h: 16, anim: null }, small, { layerSize: 32 });
  const levels = layer.frames.get(0);
  assert.equal(levels.length, 6);
  assert.deepEqual(levels.map((l) => l.length), [32, 16, 8, 4, 2, 1].map((s) => s * s * 4));
  assert.deepEqual(levels[1], small.data, 'Stufe 1 = Original');
  const level0 = { width: 32, height: 32, data: levels[0] };
  assert.deepEqual(getPixel(level0, 9, 13), getPixel(small, 4, 6));
  assert.equal(layer.alpha, 'opaque');

  const big = createImage(32, 32);
  for (let i = 0; i < 1024; i++) big.data.set([i % 256, 9, 9, 255], i * 4);
  assert.deepEqual(buildLayer('block/sign', { w: 32, h: 32, anim: null }, big, { layerSize: 32 }).frames.get(0)[0], big.data);

  const strip = createImage(16, 48);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 16; x++) setPixel(strip, x, y, [Math.floor(y / 16) * 100, x, y, 255]);
  const anim = buildLayer('block/anim', { w: 16, h: 48, anim: { fw: 16, fh: 16, frames: [[0, 1], [2, 1]], interpolate: false } }, strip, { layerSize: 32 });
  assert.deepEqual([...anim.frames.keys()], [0, 2]);
  assert.deepEqual(anim.frames.get(2)[1], cropImage(strip, 0, 32, 16, 16).data);
  assert.deepEqual(anim.animation.frames, [[0, 1], [2, 1]]);

  const holes = solidImage(16, 16, [7, 7, 7, 255]);
  setPixel(holes, 0, 0, [0, 0, 0, 0]);
  setPixel(holes, 15, 15, [0, 0, 0, 0]);
  const region = buildLayer('entity/x', { w: 16, h: 16, anim: null }, holes, { region: { x: 2, y: 3, w: 5, h: 4 }, layerSize: 32 });
  assert.equal(region.alpha, 'opaque');
  assert.deepEqual([region.maskWidth, region.maskHeight], [5, 4]);
  assert.equal(buildLayer('entity/x', { w: 16, h: 16, anim: null }, holes, { layerSize: 32 }).alpha, 'cutout');
  assert.throws(() => buildLayer('entity/x', { w: 16, h: 16, anim: null }, holes, { region: { x: 12, y: 0, w: 5, h: 4 } }), /Region/);
  assert.throws(() => buildLayer('entity/x', { w: 32, h: 16, anim: null }, holes), /PNG ist 16×16/);
});

test('renderBlockIcon: Ostseite links (0,6), Nordseite rechts (0,8), oben 1,0, Texturrichtung, Stufenhöhe', () => {
  const half = (left, right) => {
    const image = createImage(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) setPixel(image, x, y, x < 8 ? left : right);
    return image;
  };
  const top = solidImage(16, 16, [255, 255, 255, 255]);
  setPixel(top, 0, 0, [255, 0, 0, 255]);
  const red = [250, 0, 0, 255], blue = [0, 0, 250, 255];
  const icon = renderBlockIcon({ up: [{ image: top, tint: -1 }], north: [{ image: half(red, blue), tint: -1 }], east: [{ image: half(red, blue), tint: -1 }] }, 64);
  assert.deepEqual(getPixel(icon, 32, 16), [255, 255, 255, 255], 'Oberseite');
  assert.deepEqual(getPixel(icon, 58, 14), [255, 0, 0, 255], 'Texel (0,0) oben an der Nordwest-Ecke (rechts)');
  assert.deepEqual(getPixel(icon, 8, 35), [150, 0, 0, 255], 'Ostseite links, Textur links = Süden');
  assert.deepEqual(getPixel(icon, 28, 48), [0, 0, 150, 255]);
  assert.deepEqual(getPixel(icon, 36, 45), [200, 0, 0, 255], 'Nordseite rechts, Textur links = Osten');
  assert.deepEqual(getPixel(icon, 58, 30), [0, 0, 200, 255]);
  assert.deepEqual(getPixel(icon, 1, 1), [0, 0, 0, 0]);
  const tinted = renderBlockIcon({ up: [{ image: top, tint: 0x80ff00 }], north: [{ image: top, tint: -1 }], east: [{ image: top, tint: -1 }] }, 64);
  assert.deepEqual(getPixel(tinted, 32, 16), [128, 255, 0, 255]);
  const slab = renderBlockIcon({ up: [{ image: top, tint: -1 }], north: [{ image: top, tint: -1 }], east: [{ image: top, tint: -1 }] }, 64, { height: 0.5 });
  assert.equal(getPixel(slab, 32, 10)[3], 0, 'Stufe: oben frei');
  assert.equal(getPixel(slab, 32, 40)[3], 255);
  assert.throws(() => renderBlockIcon({}, 4), /Größe/);
});

// ---------------------------------------------------------------- TextureStore mit echten Spieldaten

dataTest('alle PNGs aus textures.bin dekodieren mit passender Größe', async () => {
  const json = JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'textures.json'), 'utf8'));
  const store = await loadStore();
  const counts = { opaque: 0, cutout: 0, translucent: 0 };
  for (const name of store.names()) {
    const image = await store.image(name);
    assert.equal(image.width, json.entries[name].w, name);
    assert.equal(image.height, json.entries[name].h, name);
    counts[alphaClassOf(scanTransparency(image))]++;
  }
  assert.equal(counts.opaque + counts.cutout + counts.translucent, Object.keys(json.entries).length);
  assert.ok(counts.cutout > 0 && counts.translucent > 0 && counts.opaque > 0);
});

dataTest('info/has: Texturen, Regionen, missingno', async () => {
  const store = await loadStore();
  assert.equal(store.layerSize, 32);
  assert.equal(store.levelCount, 6);
  const water = store.info('block/water_still');
  assert.deepEqual([water.animated, water.frameCount, water.frameWidth], [true, 32, 16]);
  assert.equal(store.info('block/magma').interpolate, true);
  assert.equal(store.info('block/oak_leaves').mip, 'dark_cutout');
  assert.equal(store.has('region:entity/chest/normal:14,14,14,5'), true);
  assert.equal(store.has('region:entity/chest/normal:60,60,10,10'), false);
  assert.equal(store.has('missingno'), true);
  assert.equal(store.has('block/gibt_es_nicht'), false);
  assert.ok(store.names().length > 2000);
  assert.throws(() => new TextureStore({ entries: { 'block/x': { o: 0, l: 99, w: 16, h: 16 } } }, new Uint8Array(10)), /außerhalb/);
  assert.throws(() => new TextureStore({}, new Uint8Array(0)), /Format/);
  assert.throws(() => new TextureStore({ entries: {} }, new Uint8Array(0), { layerSize: 24 }), /Ebenengröße/);
});

dataTest('prepare: Ebenen, Alpha-Klassen, Fehltextur mit Warnung, CPU-Spiegel = hochgeladene Daten', async (t) => {
  const store = await loadStore();
  const gl = new FakeGL();
  gl.pixelStore[gl.UNPACK_FLIP_Y_WEBGL] = true;
  const warn = t.mock.method(console, 'warn', () => {});
  const names = ['block/stone', 'block/oak_leaves', 'block/water_still', 'block/magma', 'block/oak_sign',
    'region:entity/chest/normal:14,14,14,5', 'block/gibt_es_nicht', 'region:block/stone:0,0,17,1', 'Kaputt!', 'minecraft:block/stone'];
  const map = await store.prepare(gl, names);
  assert.equal(gl.pixelStore[gl.UNPACK_FLIP_Y_WEBGL], true, 'Pixel-Speicher-Zustand wiederhergestellt');
  assert.equal(gl.error, 0, 'kein INVALID_OPERATION beim Hochladen');
  assert.equal(map.size, names.length);
  assert.equal(map.get('block/stone').alpha, 'opaque');
  assert.equal(map.get('block/stone').layer, map.get('minecraft:block/stone').layer);
  assert.equal(map.get('block/oak_leaves').alpha, 'cutout');
  assert.equal(map.get('block/water_still').alpha, 'translucent');
  assert.equal(map.get('block/water_still').animated, true);
  assert.equal(map.get('block/magma').animated, true);
  assert.deepEqual([map.get('region:entity/chest/normal:14,14,14,5').maskWidth, map.get('region:entity/chest/normal:14,14,14,5').maskHeight], [14, 5]);
  for (const bad of ['block/gibt_es_nicht', 'region:block/stone:0,0,17,1', 'Kaputt!']) {
    assert.equal(map.get(bad).missing, true, bad);
    assert.equal(map.get(bad).layer, map.get('block/gibt_es_nicht').layer);
  }
  assert.equal(map.get('block/stone').missing, false);
  assert.equal(warn.mock.callCount(), 1);
  const message = warn.mock.calls[0].arguments[0];
  for (const part of [/block\/gibt_es_nicht \(unbekannt\)/, /Kaputt! \(ungültige Zeichen/, /0,0,17,1 \(Region 0,0,17,1 liegt nicht im Frame 16×16/]) assert.match(message, part);

  const texture = store.texture(gl);
  assert.equal(texture.params[gl.TEXTURE_MAG_FILTER], gl.NEAREST);
  assert.equal(texture.params[gl.TEXTURE_MIN_FILTER], gl.NEAREST_MIPMAP_LINEAR);
  assert.equal(texture.params[gl.TEXTURE_WRAP_S], gl.REPEAT);
  assert.equal(texture.params[gl.TEXTURE_MAX_LEVEL], 5);
  const stats = store.stats(gl);
  assert.equal(stats.layers, 7, '6 Texturen + Fehltextur');
  for (let layer = 0; layer < stats.layers; layer++) {
    for (let level = 0; level < 6; level++) assert.deepEqual(gl.layerData(texture, layer, level), store.readLayer(gl, layer, level));
  }
  const stone = await store.image('block/stone');
  assert.deepEqual(store.readLayer(gl, map.get('block/stone').layer, 1), stone.data, 'Stufe 1 = Original-16×16');
  // 32×32 in voller Auflösung; transparente Pixel bekommen wie im Spiel nur eine aufgefüllte Farbe (solidify)
  const sign = await store.image('block/oak_sign');
  const signLayer = store.readLayer(gl, map.get('block/oak_sign').layer, 0);
  let visible = 0;
  for (let i = 0; i < sign.data.length; i += 4) {
    if (sign.data[i + 3] === 0) {
      assert.equal(signLayer[i + 3], 0);
    } else {
      visible++;
      assert.deepEqual([...signLayer.subarray(i, i + 4)], [...sign.data.subarray(i, i + 4)]);
    }
  }
  assert.ok(visible > 500);
  const missingLayer = store.readLayer(gl, map.get('Kaputt!').layer, 1);
  assert.deepEqual([...missingLayer.subarray(15 * 4, 15 * 4 + 4)], [248, 0, 248, 255]);

  const again = await store.prepare(gl, ['block/stone', 'block/dirt']);
  assert.equal(again.get('block/stone').layer, map.get('block/stone').layer, 'Ebenen bleiben stabil');
  assert.equal(again.get('block/dirt').layer, 7);
  assert.equal(warn.mock.callCount(), 1, 'keine neue Warnung');
});

dataTest('prepare: Kapazität wächst (alles neu hochgeladen), Ebenen-Grenze mit klarer Meldung', async () => {
  const store = await loadStore();
  const names = store.names().filter((n) => n.startsWith('block/')).slice(0, 70);
  const gl = new FakeGL();
  await store.prepare(gl, names.slice(0, 10));
  assert.equal(store.stats(gl).capacity, 64);
  await store.prepare(gl, names);
  assert.equal(store.stats(gl).capacity, 128);
  assert.equal(gl.storageCalls, 2);
  const texture = store.texture(gl);
  for (let layer = 0; layer < 70; layer += 7) assert.deepEqual(gl.layerData(texture, layer, 0), store.readLayer(gl, layer, 0));

  const small = new FakeGL({ maxLayers: 8 });
  await assert.rejects(store.prepare(small, names.slice(0, 10)), /10 Ebenen nötig.*höchstens 8.*MAX_ARRAY_TEXTURE_LAYERS/);
  const ok = await store.prepare(small, names.slice(0, 3));
  assert.equal(ok.get(names[2]).layer, 2, 'Zustand nach dem Fehler unverändert');
  await assert.rejects(store.prepare(small, 'block/stone'), /Liste/);
  await assert.rejects(store.prepare({}, ['block/stone']), /WebGL2/);
});

dataTest('tick: Frames nach Liste (50 ms), Interpolation wie im Spiel, nur geänderte Ebenen', async () => {
  const store = await loadStore();
  const json = JSON.parse(fs.readFileSync(path.join(GAME_DATA, 'textures.json'), 'utf8'));
  const gl = new FakeGL();
  const map = await store.prepare(gl, ['block/stone', 'block/water_still', 'block/magma']);
  const expected = async (name) => buildLayer(name, json.entries[name], await store.image(name), { layerSize: 32 });
  const water = await expected('block/water_still');
  const magma = await expected('block/magma');
  assert.equal(store.tick(gl, 0), false, 'Stand 0 ist schon hochgeladen');
  gl.uploads = [];
  assert.equal(store.tick(gl, 100), true);
  assert.deepEqual(store.readLayer(gl, map.get('block/water_still').layer, 0), water.frames.get(water.animation.frames[1][0])[0]);
  // Wasser wechselt den Frame, Magma (interpoliert) mischt in jedem Tick neu, Stein bleibt unberührt
  const touched = new Set(gl.uploads.map((u) => u.z));
  assert.ok(gl.uploads.every((u) => u.depth === 1));
  assert.deepEqual([...touched].sort(), [map.get('block/water_still').layer, map.get('block/magma').layer].sort());
  assert.equal(store.tick(gl, 149), false, 'gleicher Tick');
  store.tick(gl, 200);
  const mixed = mixLevels(magma.frames.get(0), magma.frames.get(1), 0.5);
  for (let level = 0; level < 6; level++) assert.deepEqual(store.readLayer(gl, map.get('block/magma').layer, level), mixed[level]);
  assert.deepEqual(gl.layerData(store.texture(gl), map.get('block/magma').layer, 2), mixed[2]);
  assert.throws(() => store.tick(gl, NaN), /Zeit/);
  assert.equal(store.tick(new FakeGL(), 500), false, 'unbekannter Kontext');
});

dataTest('Kontextverlust: prepare lehnt ab, danach wird die Textur aus dem CPU-Spiegel neu angelegt', async () => {
  const store = await loadStore();
  const gl = new FakeGL();
  const map = await store.prepare(gl, ['block/stone', 'block/water_still']);
  gl.lost = true;
  await assert.rejects(store.prepare(gl, ['block/dirt']), /verloren/);
  assert.equal(store.tick(gl, 1000), false);
  assert.equal(store.texture(gl), null);
  gl.lost = false;
  gl.textures.clear();
  const texture = store.texture(gl);
  assert.ok(texture && gl.isTexture(texture));
  assert.deepEqual(gl.layerData(texture, map.get('block/stone').layer, 0), store.readLayer(gl, map.get('block/stone').layer, 0));
  store.dispose(gl);
  assert.equal(store.texture(gl), null);
  assert.equal(gl.textures.size, 0);
});

dataTest('Icons: Item-Textur flach, Block isometrisch (auch getönt), data:-URL dekodierbar', async () => {
  const store = await loadStore();
  const redstone = await store.iconImage('redstone', null, { size: 64 });
  assert.deepEqual(redstone, resampleNearest(await store.image('item/redstone'), 64, 64));
  assert.equal(store.has('item/stone'), false);
  const stone = await store.iconImage('stone');
  const stoneTex = await store.image('block/stone');
  const top = getPixel(stone, 32, 16);
  assert.equal(top[3], 255);
  assert.ok(Array.from({ length: 256 }, (_, i) => [...stoneTex.data.subarray(i * 4, i * 4 + 3)].join()).includes(top.slice(0, 3).join()), 'Oberseite zeigt Stein-Texel');
  const grass = await store.iconImage('grass_block', {
    up: { texture: 'block/grass_block_top', tint: 0x91bd59 },
    north: ['block/grass_block_side', { texture: 'block/grass_block_side_overlay', tint: 0x91bd59 }],
    east: ['block/grass_block_side', { texture: 'block/grass_block_side_overlay', tint: 0x91bd59 }],
  });
  const grassTop = getPixel(grass, 32, 16);
  assert.ok(grassTop[1] > grassTop[0] && grassTop[1] > grassTop[2], 'grün getönt');
  const torch = await store.iconImage('torch', { flat: 'block/torch' }, { size: 32 });
  assert.deepEqual(torch, resampleNearest(await store.image('block/torch'), 32, 32));
  const url = await store.iconDataUrl('stone');
  assert.match(url, /^data:image\/png;base64,/);
  assert.deepEqual(await decodePng(Buffer.from(url.split(',')[1], 'base64')), stone);
  assert.equal(await store.iconDataUrl('stone'), url, 'zwischengespeichert');
  await assert.rejects(store.iconImage('gibt_es_nicht'), /Kein Icon/);
  await assert.rejects(store.iconImage('stone', { up: 'block/stone', north: 'block/stone' }), /east/);
  await assert.rejects(store.iconImage('<script>'), /ungültige ID/);
});
