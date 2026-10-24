// PNG-Dekoder (scripts/lib/png.mjs): alle Farbtypen und Bittiefen, Filter 0–4, Palette + tRNS, Adam7, Fehler.
// Die Testbilder baut ein kleiner Encoder hier im Test (mit echten Vorwärts-Filtern), dazu ein Abgleich mit dem
// Browser-Dekoder aus js/render/texture-store.js über alle Spieltexturen (nur mit game-data/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, readPngInfo, PNG_SIGNATURE } from '../../scripts/lib/png.mjs';
import { decodePng as decodePngBrowser } from '../../js/render/texture-store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME = path.join(ROOT, 'game-data');
const dataTest = fs.existsSync(path.join(GAME, 'textures.bin')) ? test : test.skip;

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'latin1');
  body.copy(out, 8);
  out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Rohzeile (Bytes) mit Filter f gegen die vorige Rohzeile prev filtern.
function filterRow(raw, prev, f, bpp) {
  const out = Buffer.alloc(raw.length + 1);
  out[0] = f;
  for (let i = 0; i < raw.length; i++) {
    const a = i >= bpp ? raw[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
    const predictor = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
    out[i + 1] = (raw[i] - predictor) & 255;
  }
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

/** PNG mit beliebigem Farbtyp; sample(x, y) → Kanalwerte; Filter je Zeile wechselnd 0 … 4. */
function makePng({ width, height, colorType, depth, sample, palette = null, trns = null, interlace = 0, splitIdat = true }) {
  const channels = CHANNELS[colorType];
  const bpp = Math.max(1, (channels * depth) >> 3);
  const passes = interlace ? ADAM7 : [[0, 0, 1, 1]];
  const rows = [];
  let rowNumber = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = width > x0 ? Math.ceil((width - x0) / dx) : 0;
    const ph = height > y0 ? Math.ceil((height - y0) / dy) : 0;
    if (!pw || !ph) continue;
    let prev = Buffer.alloc(Math.ceil((pw * channels * depth) / 8));
    for (let r = 0; r < ph; r++) {
      const samples = [];
      for (let i = 0; i < pw; i++) samples.push(...sample(x0 + i * dx, y0 + r * dy));
      const raw = packRow(samples, depth);
      rows.push(filterRow(raw, prev, rowNumber++ % 5, bpp));
      prev = raw;
    }
  }
  const data = zlib.deflateSync(Buffer.concat(rows));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([depth, colorType, 0, 0, interlace], 8);
  const idat = splitIdat ? [chunk('IDAT', data.subarray(0, 5)), chunk('IDAT', data.subarray(5))] : [chunk('IDAT', data)];
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE), chunk('IHDR', header), chunk('tEXt', Buffer.from('Comment\0Test')),
    ...(palette ? [chunk('PLTE', Buffer.from(palette))] : []), ...(trns ? [chunk('tRNS', Buffer.from(trns))] : []),
    ...idat, chunk('IEND', Buffer.alloc(0)),
  ]);
}

const W = 13, H = 7;
const to8 = (v, depth) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / ((1 << depth) - 1)));

for (const interlace of [0, 1]) {
  for (const [colorType, depths] of [[0, [1, 2, 4, 8, 16]], [2, [8, 16]], [3, [1, 2, 4, 8]], [4, [8, 16]], [6, [8, 16]]]) {
    for (const depth of depths) {
      test(`PNG Farbtyp ${colorType}, ${depth} Bit${interlace ? ', Adam7' : ''}`, () => {
        const max = (1 << depth) - 1;
        const value = (x, y, c) => ((x * 7 + y * 13 + c * 5) * 2654435761 >>> 7) % (max + 1);
        let palette = null, trns = null;
        if (colorType === 3) {
          const size = Math.min(256, max + 1);
          palette = [];
          for (let i = 0; i < size; i++) palette.push((i * 37) & 255, (i * 91) & 255, (i * 53) & 255);
          trns = [0, 128];
        }
        // Graustufen ohne Alpha: Schlüsselfarbe max/2 per tRNS durchsichtig
        const grayKey = Math.floor(max / 2);
        if (colorType === 0) trns = [grayKey >> 8, grayKey & 255];
        const sample = (x, y) => Array.from({ length: CHANNELS[colorType] }, (_, c) => value(x, y, c));
        const png = makePng({ width: W, height: H, colorType, depth, sample, palette, trns, interlace });
        const image = decodePng(png);
        assert.equal(image.width, W);
        assert.equal(image.height, H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const s = sample(x, y);
            let expected;
            if (colorType === 0) expected = [to8(s[0], depth), to8(s[0], depth), to8(s[0], depth), s[0] === grayKey ? 0 : 255];
            else if (colorType === 2) expected = [...s.map((v) => to8(v, depth)), 255];
            else if (colorType === 3) expected = [palette[s[0] * 3], palette[s[0] * 3 + 1], palette[s[0] * 3 + 2], s[0] < 2 ? trns[s[0]] : 255];
            else if (colorType === 4) expected = [to8(s[0], depth), to8(s[0], depth), to8(s[0], depth), to8(s[1], depth)];
            else expected = s.map((v) => to8(v, depth));
            const o = (y * W + x) * 4;
            assert.deepEqual(Array.from(image.data.subarray(o, o + 4)), expected, `Pixel ${x},${y}`);
          }
        }
        assert.deepEqual(readPngInfo(png), { width: W, height: H, depth, colorType, interlace });
      });
    }
  }
}

test('PNG: Schreiben und Lesen ergibt dasselbe Bild', () => {
  const data = Uint8Array.from({ length: 5 * 3 * 4 }, (_, i) => (i * 29) & 255);
  const back = decodePng(encodePng({ width: 5, height: 3, data }));
  assert.deepEqual(Array.from(back.data), Array.from(data));
  assert.throws(() => encodePng({ width: 2, height: 2, data: new Uint8Array(3) }), /16 RGBA-Bytes/);
});

test('PNG: verständliche Fehler bei kaputten Dateien', () => {
  const good = makePng({ width: 4, height: 4, colorType: 2, depth: 8, sample: () => [1, 2, 3] });
  assert.throws(() => decodePng(Buffer.from('keine png-datei')), /Signatur fehlt/);
  const crc = Buffer.from(good);
  crc[crc.length - 20] ^= 0xff;
  assert.throws(() => decodePng(crc), /Prüfsumme/);
  assert.throws(() => decodePng(good.subarray(0, 40)), /reicht über das Dateiende|IDAT|zu kurz/);
  const critical = Buffer.concat([good.subarray(0, 33), chunk('ABCD', Buffer.alloc(1)), good.subarray(33)]);
  assert.throws(() => decodePng(critical), /unbekannter kritischer Abschnitt ABCD/);
  const badIndex = makePng({ width: 2, height: 1, colorType: 3, depth: 8, sample: () => [5], palette: [0, 0, 0, 255, 255, 255] });
  assert.throws(() => decodePng(badIndex), /Palettenindex 5/);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([3, 2, 0, 0, 0], 8);
  assert.throws(() => decodePng(Buffer.concat([Buffer.from(PNG_SIGNATURE), chunk('IHDR', header), chunk('IEND', Buffer.alloc(0))])), /Farbtyp 2 mit 3 Bit/);
  assert.throws(() => decodePng('text'), /erwartet werden Bytes/);
});

dataTest('PNG: alle Spieltexturen wie der Browser-Dekoder aus texture-store.js', async () => {
  const json = JSON.parse(fs.readFileSync(path.join(GAME, 'textures.json'), 'utf8'));
  const bin = fs.readFileSync(path.join(GAME, 'textures.bin'));
  const entries = Object.entries(json.entries);
  assert.ok(entries.length > 1000);
  for (const [name, entry] of entries) {
    const bytes = bin.subarray(entry.o, entry.o + entry.l);
    const mine = decodePng(bytes);
    const theirs = await decodePngBrowser(bytes);
    assert.equal(mine.width, theirs.width, name);
    assert.equal(mine.height, theirs.height, name);
    assert.ok(Buffer.from(mine.data).equals(Buffer.from(theirs.data)), `${name}: Pixel weichen ab`);
  }
});
