// Texturen aus game-data/ laden und als TEXTURE_2D_ARRAY bereitstellen (ARCHITEKTUR §7.3).
// Ebenen 32×32 (16×16-Texturen pixelgenau verdoppelt, 32×32-Texturen wie Schilder in voller Auflösung).
// Mipmaps, Transparenz und Animationen wie Minecraft 26.2 (MipmapGenerator, TextureUtil, SpriteContents).
// PNGs liest ein kleiner eigener Decoder: exakte Pixel, auch die Farbe voll transparenter Pixel,
// die die Glas-Mipmaps (Strategie „mean“) mitteln. Läuft in Browser, Worker und Node.

export const DEFAULT_LAYER_SIZE = 32;
export const TICK_MS = 50;
export const MISSING_TEXTURE = 'missingno';
export const ALPHA_CLASSES = Object.freeze(['opaque', 'cutout', 'translucent']);
export const MIP_STRATEGIES = Object.freeze(['auto', 'mean', 'cutout', 'strict_cutout', 'dark_cutout']);

const NAME_PATTERN = /^[a-z0-9_.\-/]+$/;
const REGION_PATTERN = /^region:([^:]+):(\d{1,5}),(\d{1,5}),(\d{1,5}),(\d{1,5})$/;
const ID_PATTERN = /^[a-z0-9_.-]{1,128}$/;
const MAX_PNG_SIDE = 4096;
const MIN_CAPACITY = 64;
const f32 = Math.fround;

// ---------------------------------------------------------------- Bilder (RGBA, Uint8Array)

export function createImage(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`Ungültige Bildgröße ${width}×${height}.`);
  }
  return { width, height, data: new Uint8Array(width * height * 4) };
}

export function cropImage(src, x, y, width, height) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + width > src.width || y + height > src.height) {
    throw new Error(`Ausschnitt ${x},${y},${width},${height} liegt nicht im Bild ${src.width}×${src.height}.`);
  }
  const out = createImage(width, height);
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * src.width + x) * 4;
    out.data.set(src.data.subarray(start, start + width * 4), row * width * 4);
  }
  return out;
}

// Pixelgenau (nächster Nachbar, Abtastung in Pixelmitte – wie drawImage ohne Glättung).
export function resampleNearest(src, width, height) {
  const out = createImage(width, height);
  const source = new Uint32Array(src.data.buffer, src.data.byteOffset, src.width * src.height);
  const target = new Uint32Array(out.data.buffer);
  const columns = new Int32Array(width);
  for (let x = 0; x < width; x++) columns[x] = Math.min(src.width - 1, Math.floor(((x + 0.5) * src.width) / width));
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor(((y + 0.5) * src.height) / height));
    const rowStart = sy * src.width;
    for (let x = 0; x < width; x++) target[y * width + x] = source[rowStart + columns[x]];
  }
  return out;
}

// Eingebaute Fehltextur des Spiels (MissingTextureAtlasSprite): Magenta/Schwarz in vier Feldern.
export function missingImage(size = 16) {
  const image = createImage(size, size);
  const half = Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const magenta = (y < half) !== (x < half);
      image.data[o] = magenta ? 248 : 0;
      image.data[o + 2] = magenta ? 248 : 0;
      image.data[o + 3] = 255;
    }
  }
  return image;
}

// ---------------------------------------------------------------- PNG lesen und schreiben

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
// Adam7: Start x, Start y, Schritt x, Schritt y
const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

async function transformBytes(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

// Entpacken mit Obergrenze (Schutz vor „Deflate-Bomben“): bricht ab, sobald mehr als limit Bytes entstehen.
async function inflateLimited(bytes, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error('PNG: entpackte Bilddaten sind größer als im Kopf angegeben.');
    }
    parts.push(value);
  }
  if (parts.length === 1) return parts[0];
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Erwartete Größe der entfilterten Rohdaten (Filterbyte + Zeile je Zeile, bei Adam7 je Durchgang).
function expectedRawSize({ width, height, depth, colorType, interlace }) {
  const bitsPerPixel = PNG_CHANNELS[colorType] * depth;
  let total = 0;
  for (const [x0, y0, dx, dy] of interlace ? ADAM7 : [[0, 0, 1, 1]]) {
    const passWidth = width > x0 ? Math.ceil((width - x0) / dx) : 0;
    const passHeight = height > y0 ? Math.ceil((height - y0) / dy) : 0;
    if (passWidth && passHeight) total += passHeight * (1 + Math.ceil((passWidth * bitsPerPixel) / 8));
  }
  return total;
}

function readPngChunks(data) {
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) throw new Error('PNG: Signatur fehlt.');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks = { header: null, palette: null, transparency: null, idat: [] };
  let pos = 8;
  while (pos + 12 <= data.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    if (pos + 12 + length > data.length) throw new Error(`PNG: Abschnitt ${type} reicht über das Dateiende.`);
    const body = data.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('PNG: IHDR hat die falsche Länge.');
      const bodyView = new DataView(body.buffer, body.byteOffset, 13);
      chunks.header = {
        width: bodyView.getUint32(0), height: bodyView.getUint32(4),
        depth: body[8], colorType: body[9], compression: body[10], filter: body[11], interlace: body[12],
      };
    } else if (type === 'PLTE') chunks.palette = body;
    else if (type === 'tRNS') chunks.transparency = body;
    else if (type === 'IDAT') chunks.idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  return chunks;
}

function checkPngHeader(header, palette) {
  if (!header) throw new Error('PNG: IHDR fehlt.');
  const { width, height, depth, colorType, compression, filter, interlace } = header;
  if (width < 1 || height < 1 || width > MAX_PNG_SIDE || height > MAX_PNG_SIDE) throw new Error(`PNG: ungültige Größe ${width}×${height}.`);
  if (!PNG_DEPTHS[colorType]?.includes(depth)) throw new Error(`PNG: Farbtyp ${colorType} mit ${depth} Bit wird nicht unterstützt.`);
  if (compression !== 0 || filter !== 0 || interlace > 1) throw new Error('PNG: unbekannte Kompression, Filtermethode oder Zeilensprung.');
  if (colorType === 3 && !palette) throw new Error('PNG: Palette fehlt.');
}

function unfilterRow(line, prev, filterType, bpp) {
  const n = line.length;
  switch (filterType) {
    case 0:
      return;
    case 1:
      for (let i = bpp; i < n; i++) line[i] += line[i - bpp];
      return;
    case 2:
      for (let i = 0; i < n; i++) line[i] += prev[i];
      return;
    case 3:
      for (let i = 0; i < n; i++) line[i] += ((i >= bpp ? line[i - bpp] : 0) + prev[i]) >> 1;
      return;
    case 4:
      for (let i = 0; i < n; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      return;
    default:
      throw new Error(`PNG: unbekannter Zeilenfilter ${filterType}.`);
  }
}

// Liest einen Rohwert (volle Bittiefe) für Pixel i, Kanal c aus einer entfilterten Zeile.
function readSample(line, i, c, channels, depth) {
  if (depth === 8) return line[i * channels + c];
  if (depth === 16) {
    const o = (i * channels + c) * 2;
    return (line[o] << 8) | line[o + 1];
  }
  const bit = i * depth;
  return (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
}

function createPixelWriter(header, palette, transparency) {
  const { colorType, depth } = header;
  const channels = PNG_CHANNELS[colorType];
  const max = (1 << depth) - 1;
  const to8 = depth === 16 ? (v) => v >> 8 : depth === 8 ? (v) => v : (v) => Math.round((v * 255) / max);
  const trnsView = transparency ? new DataView(transparency.buffer, transparency.byteOffset, transparency.byteLength) : null;
  const grayKey = colorType === 0 && trnsView && transparency.length >= 2 ? trnsView.getUint16(0) : -1;
  const rgbKey = colorType === 2 && trnsView && transparency.length >= 6
    ? [trnsView.getUint16(0), trnsView.getUint16(2), trnsView.getUint16(4)] : null;
  const paletteSize = palette ? Math.floor(palette.length / 3) : 0;

  return (line, i, out, o) => {
    switch (colorType) {
      case 0: {
        const v = readSample(line, i, 0, 1, depth);
        out[o] = out[o + 1] = out[o + 2] = to8(v);
        out[o + 3] = v === grayKey ? 0 : 255;
        return;
      }
      case 2: {
        const r = readSample(line, i, 0, 3, depth), g = readSample(line, i, 1, 3, depth), b = readSample(line, i, 2, 3, depth);
        out[o] = to8(r); out[o + 1] = to8(g); out[o + 2] = to8(b);
        out[o + 3] = rgbKey && r === rgbKey[0] && g === rgbKey[1] && b === rgbKey[2] ? 0 : 255;
        return;
      }
      case 3: {
        const index = readSample(line, i, 0, 1, depth);
        if (index >= paletteSize) throw new Error(`PNG: Palettenindex ${index} außerhalb der Palette (${paletteSize}).`);
        out[o] = palette[index * 3]; out[o + 1] = palette[index * 3 + 1]; out[o + 2] = palette[index * 3 + 2];
        out[o + 3] = transparency && index < transparency.length ? transparency[index] : 255;
        return;
      }
      case 4: {
        out[o] = out[o + 1] = out[o + 2] = to8(readSample(line, i, 0, 2, depth));
        out[o + 3] = to8(readSample(line, i, 1, 2, depth));
        return;
      }
      default: {
        for (let c = 0; c < 4; c++) out[o + c] = to8(readSample(line, i, c, channels, depth));
      }
    }
  };
}

// PNG → { width, height, data: Uint8Array RGBA }. Unterstützt alle Farbtypen, Bittiefen und Adam7.
export async function decodePng(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const { header, palette, transparency, idat } = readPngChunks(data);
  checkPngHeader(header, palette);
  if (idat.length === 0) throw new Error('PNG: Bilddaten (IDAT) fehlen.');
  const compressed = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of idat) {
    compressed.set(part, offset);
    offset += part.length;
  }
  const raw = await inflateLimited(compressed, expectedRawSize(header));

  const { width, height, depth, colorType, interlace } = header;
  const bitsPerPixel = PNG_CHANNELS[colorType] * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const image = createImage(width, height);
  const writePixel = createPixelWriter(header, palette, transparency);
  let pos = 0;
  for (const [x0, y0, dx, dy] of interlace ? ADAM7 : [[0, 0, 1, 1]]) {
    const passWidth = width > x0 ? Math.ceil((width - x0) / dx) : 0;
    const passHeight = height > y0 ? Math.ceil((height - y0) / dy) : 0;
    if (passWidth === 0 || passHeight === 0) continue;
    const stride = Math.ceil((passWidth * bitsPerPixel) / 8);
    let prev = new Uint8Array(stride);
    for (let row = 0; row < passHeight; row++) {
      if (pos + 1 + stride > raw.length) throw new Error('PNG: Bilddaten sind zu kurz.');
      const filterType = raw[pos];
      const line = raw.slice(pos + 1, pos + 1 + stride);
      pos += 1 + stride;
      unfilterRow(line, prev, filterType, bpp);
      const y = y0 + row * dy;
      for (let i = 0; i < passWidth; i++) writePixel(line, i, image.data, (y * width + x0 + i * dx) * 4);
      prev = line;
    }
  }
  return image;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, body) {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

// RGBA-Bild → PNG-Bytes (8 Bit, Farbtyp 6, Filter 0).
export async function encodePng(image) {
  const { width, height, data } = image;
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  const compressed = await transformBytes(raw, new CompressionStream('deflate'));
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const parts = [Uint8Array.from(PNG_SIGNATURE), pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// ---------------------------------------------------------------- Transparenz

// Wie NativeImage.computeTransparency: Bereich [x0, x1) × [y0, y1).
export function scanTransparency(image, x0 = 0, y0 = 0, x1 = image.width, y1 = image.height) {
  let transparent = false;
  let translucent = false;
  const { data, width } = image;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a === 0) transparent = true;
      else if (a !== 255) translucent = true;
    }
  }
  return { transparent, translucent };
}

export function alphaClassOf({ transparent, translucent }) {
  return translucent ? 'translucent' : transparent ? 'cutout' : 'opaque';
}

function maskClass(bits) {
  return bits & 2 ? 'translucent' : bits & 1 ? 'cutout' : 'opaque';
}

/**
 * Alpha-Klasse des UV-Rechtecks einer Fläche (UV in Texeln 0 … 16 wie im Modell), wie
 * SpriteContents.computeTransparency in 26.2 – damit wählt das Spiel die Render-Ebene pro Fläche.
 * entry: Eintrag aus prepare() ({ alpha, mask, maskWidth, maskHeight }).
 */
export function rectAlphaClass(entry, u0, v0, u1, v1) {
  if (!entry || !ALPHA_CLASSES.includes(entry.alpha)) throw new Error('rectAlphaClass braucht einen Eintrag aus prepare().');
  if (entry.alpha === 'opaque' || !entry.mask) return entry.alpha;
  const minU = f32(Math.min(u0, u1) / 16), maxU = f32(Math.max(u0, u1) / 16);
  const minV = f32(Math.min(v0, v1) / 16), maxV = f32(Math.max(v0, v1) / 16);
  if (minU === 0 && minV === 0 && maxU === 1 && maxV === 1) return entry.alpha;
  const w = entry.maskWidth, h = entry.maskHeight;
  const clampTo = (v, max) => Math.min(max, Math.max(0, v));
  const x0 = clampTo(Math.floor(f32(minU * w)), w), x1 = clampTo(Math.ceil(f32(maxU * w)), w);
  const y0 = clampTo(Math.floor(f32(minV * h)), h), y1 = clampTo(Math.ceil(f32(maxV * h)), h);
  let bits = 0;
  for (let y = y0; y < y1 && bits !== 3; y++) {
    for (let x = x0; x < x1; x++) bits |= entry.mask[y * w + x];
  }
  return maskClass(bits);
}

// ---------------------------------------------------------------- Mipmaps wie MipmapGenerator (26.2)

const F_SRGB_KNEE = f32(0.04045);
const F_LINEAR_KNEE = f32(0.0031308);
const F_12_92 = f32(12.92);
const F_0_025 = f32(0.025);
const javaRound = (v) => Math.floor(v + 0.5);

function computeSrgbToLinear(v) {
  return v >= F_SRGB_KNEE ? f32(Math.pow((v + 0.055) / 1.055, 2.4)) : f32(v / F_12_92);
}

function computeLinearToSrgb(v) {
  return v >= F_LINEAR_KNEE ? f32(1.055 * Math.pow(v, 0.4166666666666667) - 0.055) : f32(F_12_92 * v);
}

// Tabellen wie ARGB.SRGB_TO_LINEAR (10 Bit) und ARGB.LINEAR_TO_SRGB.
export const SRGB_TO_LINEAR = Int16Array.from({ length: 256 }, (_, i) => javaRound(f32(computeSrgbToLinear(f32(i / 255)) * 1023)));
export const LINEAR_TO_SRGB = Uint8Array.from({ length: 1024 }, (_, i) => javaRound(f32(computeLinearToSrgb(f32(i / 1023)) * 255)) & 255);

const srgbToLinearChannel = (v) => f32(SRGB_TO_LINEAR[v] / 1023);
const linearToSrgbChannel = (v) => LINEAR_TO_SRGB[Math.floor(f32(v * 1023))];

function copyImage(image) {
  return { width: image.width, height: image.height, data: image.data.slice() };
}

// TextureUtil.solidify: Farbe voll transparenter Pixel per Breitensuche vom nächsten sichtbaren Pixel.
export function solidify(image) {
  const { width: w, height: h, data } = image;
  const colors = new Uint32Array(w * h);
  const distance = new Int32Array(w * h).fill(0x7fffffff);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const i = x + y * w;
      if (data[i * 4 + 3] !== 0) {
        distance[i] = 0;
        colors[i] = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
        queue[tail++] = i;
      }
    }
  }
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of steps) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = nx + ny * w;
      if (distance[n] > distance[i] + 1) {
        distance[n] = distance[i] + 1;
        colors[n] = colors[i];
        queue[tail++] = n;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] !== 0) continue;
    data[i * 4] = (colors[i] >> 16) & 255;
    data[i * 4 + 1] = (colors[i] >> 8) & 255;
    data[i * 4 + 2] = colors[i] & 255;
  }
  return image;
}

// TextureUtil.fillEmptyAreasWithDarkColor: transparente Pixel bekommen ¾ der dunkelsten Farbe (Laub).
export function fillEmptyAreasWithDarkColor(image) {
  const { width: w, height: h, data } = image;
  let darkest = -1;
  let darkestSum = 0x7fffffff;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] === 0) continue;
      const sum = data[o] + data[o + 1] + data[o + 2];
      if (sum < darkestSum) {
        darkestSum = sum;
        darkest = o;
      }
    }
  }
  const pick = (c) => (darkest < 0 ? 255 : data[darkest + c]);
  const r = (3 * pick(0)) >> 2, g = (3 * pick(1)) >> 2, b = (3 * pick(2)) >> 2;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] !== 0) continue;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
  }
  return image;
}

// Anteil der Fläche, der den Alpha-Test besteht (bilinear, 4×4 Proben je Zelle). 1-Pixel-Kanten → NaN wie im Spiel.
export function alphaTestCoverage(image, alphaRef, alphaScale) {
  const { width: w, height: h, data } = image;
  const ref = f32(alphaRef);
  const scale = f32(alphaScale);
  const alphaAt = (x, y) => Math.min(1, Math.max(0, f32(f32(data[(y * w + x) * 4 + 3] / 255) * scale)));
  let coverage = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a00 = alphaAt(x, y), a10 = alphaAt(x + 1, y), a01 = alphaAt(x, y + 1), a11 = alphaAt(x + 1, y + 1);
      let texelCoverage = 0;
      for (let sy = 0; sy < 4; sy++) {
        const fy = (sy + 0.5) / 4;
        for (let sx = 0; sx < 4; sx++) {
          const fx = (sx + 0.5) / 4;
          let v = f32(f32(a00 * (1 - fx)) * (1 - fy));
          v = f32(v + f32(f32(a10 * fx) * (1 - fy)));
          v = f32(v + f32(f32(a01 * (1 - fx)) * fy));
          v = f32(v + f32(f32(a11 * fx) * fy));
          if (v > ref) texelCoverage++;
        }
      }
      coverage = f32(coverage + f32(texelCoverage / 16));
    }
  }
  return f32(coverage / ((w - 1) * (h - 1)));
}

// Alpha so skalieren, dass die Abdeckung der Stufe 0 erhalten bleibt (Binärsuche, 5 Schritte).
export function scaleAlphaToCoverage(image, targetCoverage, alphaRef, alphaBias) {
  let minScale = 0;
  let maxScale = 4;
  let scale = 1;
  let bestScale = 1;
  let bestError = f32(3.4028234663852886e38);
  for (let i = 0; i < 5; i++) {
    const coverage = alphaTestCoverage(image, alphaRef, scale);
    const error = Math.abs(f32(coverage - targetCoverage));
    if (error < bestError) {
      bestError = error;
      bestScale = scale;
    }
    if (coverage < targetCoverage) minScale = scale;
    else if (coverage > targetCoverage) maxScale = scale;
    else break;
    scale = f32(f32(minScale + maxScale) * 0.5);
  }
  const { data } = image;
  const bias = f32(alphaBias);
  for (let o = 3; o < data.length; o += 4) {
    let a = f32(data[o] / 255);
    a = f32(f32(f32(a * bestScale) + bias) + F_0_025);
    a = Math.min(1, Math.max(0, a));
    data[o] = Math.floor(f32(a * 255));
  }
  return image;
}

function downsample(prev, darkened) {
  const next = createImage(prev.width >> 1, prev.height >> 1);
  const src = prev.data, out = next.data, pw = prev.width;
  for (let y = 0; y < next.height; y++) {
    for (let x = 0; x < next.width; x++) {
      const i00 = (y * 2 * pw + x * 2) * 4, i10 = i00 + 4, i01 = i00 + pw * 4, i11 = i01 + 4;
      const o = (y * next.width + x) * 4;
      if (darkened) {
        // darkenedAlphaBlend: voll transparente Pixel zählen als Schwarz, auch Alpha wird linear gemittelt.
        const sums = [0, 0, 0, 0];
        for (const i of [i00, i10, i01, i11]) {
          if (src[i + 3] === 0) continue;
          for (let c = 0; c < 4; c++) sums[c] = f32(sums[c] + srgbToLinearChannel(src[i + c]));
        }
        for (let c = 0; c < 4; c++) out[o + c] = linearToSrgbChannel(f32(sums[c] / 4));
      } else {
        // ARGB.meanLinear: Alpha arithmetisch, Farben linear gemittelt.
        out[o + 3] = (src[i00 + 3] + src[i10 + 3] + src[i01 + 3] + src[i11 + 3]) >> 2;
        for (let c = 0; c < 3; c++) {
          out[o + c] = LINEAR_TO_SRGB[(SRGB_TO_LINEAR[src[i00 + c]] + SRGB_TO_LINEAR[src[i10 + c]] + SRGB_TO_LINEAR[src[i01 + c]] + SRGB_TO_LINEAR[src[i11 + c]]) >> 2];
        }
      }
    }
  }
  return next;
}

/**
 * MipmapGenerator.generateMipLevels: liefert [Stufe 0 (ggf. aufgefüllt), Stufe 1, …, Stufe `levels`].
 * name: Texturname (item/… werden nicht aufgefüllt), strategy: auto|mean|cutout|strict_cutout|dark_cutout,
 * bias: alpha_cutoff_bias aus der .mcmeta. Das Eingabebild bleibt unverändert.
 */
export function generateMipLevels(image, { name = '', strategy = 'auto', bias = 0, levels = 0 } = {}) {
  if (!MIP_STRATEGIES.includes(strategy)) throw new Error(`Unbekannte Mipmap-Strategie „${strategy}“.`);
  let resolved = strategy;
  if (resolved === 'auto') resolved = scanTransparency(image).transparent ? 'cutout' : 'mean';
  const base = copyImage(image);
  if (!name.startsWith('item/')) {
    if (resolved === 'cutout' || resolved === 'strict_cutout') solidify(base);
    else if (resolved === 'dark_cutout') fillEmptyAreasWithDarkColor(base);
  }
  const result = [base];
  const isCutout = resolved !== 'mean';
  const alphaRef = resolved === 'strict_cutout' ? 0.3 : 0.5;
  const target = isCutout ? alphaTestCoverage(base, alphaRef, 1) : 0;
  for (let level = 1; level <= levels; level++) {
    const prev = result[level - 1];
    if (prev.width < 2 || prev.height < 2) throw new Error(`Mipmap-Stufe ${level} nicht möglich: Bild ${prev.width}×${prev.height} ist zu klein.`);
    const next = downsample(prev, resolved === 'dark_cutout');
    if (isCutout) scaleAlphaToCoverage(next, target, alphaRef, bias);
    result.push(next);
  }
  return result;
}

// ---------------------------------------------------------------- Namen, Animationen, Ebenen

/**
 * 'block/stone' | 'minecraft:block/stone' → { kind: 'texture', texture }
 * 'region:entity/chest/normal:14,14,14,5' → { kind: 'region', texture, x, y, w, h }
 * 'missingno' → { kind: 'missing' }; sonst { kind: 'invalid', reason }.
 */
export function parseTextureName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 256) return { kind: 'invalid', reason: 'kein gültiger Name' };
  if (name === MISSING_TEXTURE) return { kind: 'missing' };
  const cleanTexture = (raw) => {
    const texture = raw.startsWith('minecraft:') ? raw.slice(10) : raw;
    return NAME_PATTERN.test(texture) && !texture.split('/').includes('..') ? texture : null;
  };
  if (name.startsWith('region:')) {
    const match = REGION_PATTERN.exec(name);
    if (!match) return { kind: 'invalid', reason: 'Region braucht die Form region:<textur>:<x>,<y>,<w>,<h>' };
    const texture = cleanTexture(match[1]);
    const [x, y, w, h] = match.slice(2).map(Number);
    if (!texture) return { kind: 'invalid', reason: `ungültiger Texturname „${match[1]}“` };
    if (w < 1 || h < 1) return { kind: 'invalid', reason: 'Region braucht Breite und Höhe ≥ 1' };
    return { kind: 'region', texture, x, y, w, h };
  }
  const texture = cleanTexture(name);
  return texture ? { kind: 'texture', texture } : { kind: 'invalid', reason: 'ungültige Zeichen im Namen' };
}

function canonicalKey(parsed) {
  if (parsed.kind === 'missing') return MISSING_TEXTURE;
  if (parsed.kind === 'region') return `region:${parsed.texture}:${parsed.x},${parsed.y},${parsed.w},${parsed.h}`;
  return parsed.texture;
}

function checkAnimation(anim, width, height, name) {
  const { fw, fh, frames, interpolate } = anim;
  if (!Number.isInteger(fw) || !Number.isInteger(fh) || fw < 1 || fh < 1 || fw > width || fh > height) {
    throw new Error(`${name}: ungültige Framegröße ${fw}×${fh}.`);
  }
  if (width % fw !== 0 || height % fh !== 0) throw new Error(`${name}: Bild ${width}×${height} ist kein Vielfaches der Framegröße ${fw}×${fh}.`);
  const count = (width / fw) * (height / fh);
  if (!Array.isArray(frames) || frames.length === 0) throw new Error(`${name}: Animation ohne Frames.`);
  for (const frame of frames) {
    if (!Array.isArray(frame) || !Number.isInteger(frame[0]) || frame[0] < 0 || frame[0] >= count || !Number.isInteger(frame[1]) || frame[1] < 1) {
      throw new Error(`${name}: ungültiger Frame ${JSON.stringify(frame)} (Frames 0 … ${count - 1}, Dauer ≥ 1 Tick).`);
    }
  }
  if (typeof interpolate !== 'boolean') throw new Error(`${name}: interpolate muss true oder false sein.`);
  return count;
}

function checkEntry(name, entry, binLength) {
  const isInt = (v) => Number.isInteger(v) && v >= 0;
  if (!entry || typeof entry !== 'object') throw new Error(`textures.json: Eintrag „${name}“ fehlt oder ist kein Objekt.`);
  if (!isInt(entry.o) || !isInt(entry.l) || entry.l < 8 || entry.o + entry.l > binLength) throw new Error(`textures.json: „${name}“ zeigt außerhalb von textures.bin.`);
  if (!isInt(entry.w) || !isInt(entry.h) || entry.w < 1 || entry.h < 1 || entry.w > MAX_PNG_SIDE || entry.h > MAX_PNG_SIDE) {
    throw new Error(`textures.json: „${name}“ hat eine ungültige Größe.`);
  }
  if (entry.anim !== null && entry.anim !== undefined) checkAnimation(entry.anim, entry.w, entry.h, name);
  if (entry.mip !== undefined && typeof entry.mip !== 'string') throw new Error(`textures.json: „${name}“ hat ein ungültiges mip.`);
  if (entry.bias !== undefined && !Number.isFinite(entry.bias)) throw new Error(`textures.json: „${name}“ hat ein ungültiges bias.`);
}

/**
 * Animationsstand nach `ticks` Spiel-Ticks (Start: Frame 0, subFrame 0), wie SpriteContents.AnimationState.
 * progress = Mischanteil des nächsten Frames bei interpolate (auf 1/1000 abgeschnitten wie im Spiel).
 */
export function animationFrameAt(animation, ticks) {
  const { frames } = animation;
  const cycle = animation.cycleTicks ?? frames.reduce((sum, frame) => sum + frame[1], 0);
  let rest = ((Math.floor(ticks) % cycle) + cycle) % cycle;
  let position = 0;
  while (rest >= frames[position][1]) {
    rest -= frames[position][1];
    position++;
  }
  const [index, time] = frames[position];
  const nextIndex = frames[(position + 1) % frames.length][0];
  return { position, index, nextIndex, subFrame: rest, time, progress: Math.trunc(f32(f32(rest / time) * 1000)) / 1000 };
}

// Zwei Frames mischen (alle Kanäle, wie animate_sprite_interpolate.fsh).
export function mixLevels(levelsA, levelsB, progress) {
  return levelsA.map((a, level) => {
    const b = levelsB[level];
    const out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.round(a[i] + (b[i] - a[i]) * progress);
    return out;
  });
}

const isPowerOfTwo = (v) => v > 0 && (v & (v - 1)) === 0;

/**
 * Baut die Ebenen-Daten einer Textur (rein, ohne GL).
 * Rückgabe { alpha, mask, maskWidth, maskHeight, frames: Map<frameIndex, Uint8Array[] je Mip-Stufe>, animation }.
 * Quadratische Zweierpotenz-Frames ohne Region: Mipmaps wie im Spiel über das ganze Bild, dann je Stufe passend
 * zugeschnitten (kleinere Quellen pixelgenau vergrößert). Sonst: Ausschnitt pixelgenau auf layerSize skaliert.
 */
export function buildLayer(textureName, entry, image, { region = null, layerSize = DEFAULT_LAYER_SIZE } = {}) {
  if (!isPowerOfTwo(layerSize)) throw new Error(`Ebenengröße ${layerSize} ist keine Zweierpotenz.`);
  if (image.width !== entry.w || image.height !== entry.h) {
    throw new Error(`${textureName}: PNG ist ${image.width}×${image.height}, textures.json sagt ${entry.w}×${entry.h}.`);
  }
  const anim = entry.anim ?? null;
  const fw = anim ? anim.fw : image.width;
  const fh = anim ? anim.fh : image.height;
  const columns = image.width / fw;
  const uniqueFrames = anim ? [...new Set(anim.frames.map((frame) => frame[0]))].sort((a, b) => a - b) : [0];
  const origin = (index) => [(index % columns) * fw, Math.floor(index / columns) * fh];
  const rx = region ? region.x : 0, ry = region ? region.y : 0;
  const sw = region ? region.w : fw, sh = region ? region.h : fh;
  if (rx + sw > fw || ry + sh > fh) throw new Error(`Region ${rx},${ry},${sw},${sh} liegt nicht im Frame ${fw}×${fh} von ${textureName}.`);

  const mask = new Uint8Array(sw * sh);
  for (const index of uniqueFrames) {
    const [ox, oy] = origin(index);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const a = image.data[((oy + ry + y) * image.width + ox + rx + x) * 4 + 3];
        if (a === 0) mask[y * sw + x] |= 1;
        else if (a !== 255) mask[y * sw + x] |= 2;
      }
    }
  }
  const bits = mask.reduce((acc, v) => acc | v, 0);

  const mipOptions = { name: textureName, strategy: entry.mip ?? 'auto', bias: entry.bias ?? 0 };
  const layerLevels = Math.log2(layerSize) + 1;
  const frames = new Map();
  if (!region && fw === fh && isPowerOfTwo(fw)) {
    const sourceLevels = Math.log2(fw);
    const mips = generateMipLevels(image, { ...mipOptions, levels: sourceLevels });
    const shift = sourceLevels - Math.log2(layerSize);
    for (const index of uniqueFrames) {
      const [ox, oy] = origin(index);
      const levels = [];
      for (let level = 0; level < layerLevels; level++) {
        const source = level + shift;
        if (source >= 0) {
          levels.push(cropImage(mips[source], ox >> source, oy >> source, fw >> source, fh >> source).data);
        } else {
          const size = layerSize >> level;
          levels.push(resampleNearest(cropImage(mips[0], ox, oy, fw, fh), size, size).data);
        }
      }
      frames.set(index, levels);
    }
  } else {
    for (const index of uniqueFrames) {
      const [ox, oy] = origin(index);
      const scaled = resampleNearest(cropImage(image, ox + rx, oy + ry, sw, sh), layerSize, layerSize);
      frames.set(index, generateMipLevels(scaled, { ...mipOptions, levels: layerLevels - 1 }).map((level) => level.data));
    }
  }
  const animation = anim
    ? { frames: anim.frames.map((frame) => [frame[0], frame[1]]), interpolate: anim.interpolate, cycleTicks: anim.frames.reduce((sum, frame) => sum + frame[1], 0) }
    : null;
  return { alpha: maskClass(bits), mask, maskWidth: sw, maskHeight: sh, frames, animation };
}

// ---------------------------------------------------------------- Block-Icons (rein)

const SIN_30 = 0.5;
const COS_30 = Math.cos(Math.PI / 6);
const COS_225 = Math.cos((225 * Math.PI) / 180);
const SIN_225 = Math.sin((225 * Math.PI) / 180);
const ICON_FACES = [
  // Schattierung wie im Spiel: oben 1.0, Nord/Süd 0.8, Ost/West 0.6
  { key: 'up', shade: 1, corners: (h) => [[0, h, 0], [1, h, 0], [0, h, 1]], side: false },
  { key: 'north', shade: 0.8, corners: (h) => [[1, h, 0], [0, h, 0], [1, 0, 0]], side: true },
  { key: 'east', shade: 0.6, corners: (h) => [[1, h, 1], [1, h, 0], [1, 0, 1]], side: true },
];

// Ansicht wie das Inventar (block/block.json „gui“: Drehung 30°/225°, Maßstab 0,625): von Nordosten oben,
// Ostseite links, Nordseite rechts.
function projectIconPoint([px, py, pz], size) {
  const x = px - 0.5, y = py - 0.5, z = pz - 0.5;
  const x1 = x * COS_225 + z * SIN_225;
  const z1 = -x * SIN_225 + z * COS_225;
  const y2 = y * COS_30 - z1 * SIN_30;
  const scale = size * 0.625;
  return [size / 2 + x1 * scale, size / 2 - y2 * scale];
}

function sampleLayers(layers, u, v) {
  let r = 0, g = 0, b = 0, a = 0;
  for (const { image, tint } of layers) {
    const tx = Math.min(image.width - 1, Math.floor(u * image.width));
    const ty = Math.min(image.height - 1, Math.floor(v * image.height));
    const o = (ty * image.width + tx) * 4;
    const sa = image.data[o + 3] / 255;
    if (sa === 0) continue;
    let sr = image.data[o], sg = image.data[o + 1], sb = image.data[o + 2];
    if (tint >= 0) {
      sr = (sr * ((tint >> 16) & 255)) / 255;
      sg = (sg * ((tint >> 8) & 255)) / 255;
      sb = (sb * (tint & 255)) / 255;
    }
    const outA = sa + a * (1 - sa);
    r = (sr * sa + r * a * (1 - sa)) / outA;
    g = (sg * sa + g * a * (1 - sa)) / outA;
    b = (sb * sa + b * a * (1 - sa)) / outA;
    a = outA;
  }
  return [r, g, b, a];
}

/**
 * Isometrisches Block-Icon. faces = { up, north, east }: je Liste von { image, tint } (unten → oben),
 * image = RGBA beliebiger Größe, tint = 0xRRGGBB oder −1. height (0 … 1] für Stufen u. Ä.
 */
export function renderBlockIcon(faces, size, { height = 1 } = {}) {
  if (!Number.isInteger(size) || size < 8 || size > 1024) throw new Error(`Icon-Größe ${size} ungültig (8 … 1024).`);
  if (!(height > 0 && height <= 1)) throw new Error(`Icon-Höhe ${height} ungültig (0 … 1).`);
  const out = createImage(size, size);
  const prepared = ICON_FACES.map((face) => {
    const [o, u, v] = face.corners(height).map((p) => projectIconPoint(p, size));
    const ux = u[0] - o[0], uy = u[1] - o[1], vx = v[0] - o[0], vy = v[1] - o[1];
    return { ...face, o, ux, uy, vx, vy, det: ux * vy - uy * vx, layers: faces[face.key] };
  });
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      for (const face of prepared) {
        const dx = px + 0.5 - face.o[0], dy = py + 0.5 - face.o[1];
        const u = (dx * face.vy - dy * face.vx) / face.det;
        const v = (face.ux * dy - face.uy * dx) / face.det;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        const [r, g, b, a] = sampleLayers(face.layers, u, face.side ? 1 - height + v * height : v);
        if (a > 0) {
          const o = (py * size + px) * 4;
          out.data[o] = Math.round(r * face.shade);
          out.data[o + 1] = Math.round(g * face.shade);
          out.data[o + 2] = Math.round(b * face.shade);
          out.data[o + 3] = Math.round(a * 255);
        }
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- GPU (WebGL2)

const UPLOAD_PARAMS = ['UNPACK_FLIP_Y_WEBGL', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_ALIGNMENT', 'UNPACK_ROW_LENGTH',
  'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES'];
const UPLOAD_DEFAULTS = { UNPACK_FLIP_Y_WEBGL: false, UNPACK_PREMULTIPLY_ALPHA_WEBGL: false, UNPACK_ALIGNMENT: 4 };

// Setzt den Pixel-Speicher-Zustand für Uploads aus Typed Arrays und stellt ihn danach wieder her.
function withUploadState(gl, texture, run) {
  const saved = UPLOAD_PARAMS.map((name) => [name, gl.getParameter(gl[name])]);
  const unpackBuffer = gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
  const bound = gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY);
  try {
    for (const name of UPLOAD_PARAMS) gl.pixelStorei(gl[name], UPLOAD_DEFAULTS[name] ?? 0);
    if (unpackBuffer) gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    run();
  } finally {
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, bound);
    if (unpackBuffer) gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, unpackBuffer);
    for (const [name, value] of saved) gl.pixelStorei(gl[name], value);
  }
}

function nextPowerOfTwo(v) {
  let p = 1;
  while (p < v) p *= 2;
  return p;
}

function normalizeFaceLayers(spec, label) {
  const list = Array.isArray(spec) ? spec : [spec];
  if (list.length === 0) throw new Error(`Icon: Fläche „${label}“ ohne Textur.`);
  return list.map((item) => {
    const texture = typeof item === 'string' ? item : item?.texture;
    const tint = typeof item === 'object' && item !== null && item.tint !== undefined ? item.tint : -1;
    if (typeof texture !== 'string') throw new Error(`Icon: Fläche „${label}“ braucht einen Texturnamen.`);
    if (!Number.isInteger(tint) || tint < -1 || tint > 0xffffff) throw new Error(`Icon: Tönung von „${label}“ muss 0xRRGGBB oder −1 sein.`);
    return { texture, tint };
  });
}

export class TextureStore {
  #version;
  #entries;
  #bin;
  #layerSize;
  #levelCount;
  #images = new Map();
  #icons = new Map();
  #contexts = new WeakMap();
  #warnedStrategies = new Set();

  /**
   * json: Inhalt von textures.json, bin: Bytes von textures.bin (ArrayBuffer oder Uint8Array).
   * options.layerSize: Ebenengröße (Zweierpotenz 16 … 64, Standard 32).
   */
  constructor(json, bin, { layerSize = DEFAULT_LAYER_SIZE } = {}) {
    if (!json || typeof json !== 'object' || !json.entries || typeof json.entries !== 'object') {
      throw new Error('textures.json hat nicht das erwartete Format ({ version, entries }).');
    }
    if (![16, 32, 64].includes(layerSize)) throw new Error(`Ebenengröße ${layerSize} nicht erlaubt (16, 32 oder 64).`);
    this.#bin = bin instanceof Uint8Array ? bin : new Uint8Array(bin);
    this.#entries = new Map();
    for (const [name, entry] of Object.entries(json.entries)) {
      checkEntry(name, entry, this.#bin.length);
      this.#entries.set(name, entry);
    }
    this.#version = typeof json.version === 'string' ? json.version : null;
    this.#layerSize = layerSize;
    this.#levelCount = Math.log2(layerSize) + 1;
  }

  // Lädt textures.json und textures.bin (je ein fetch) relativ zur Seite.
  static async load(baseUrl = 'game-data/', options = {}) {
    const base = new URL(baseUrl, globalThis.document?.baseURI ?? globalThis.location?.href);
    const fetchOk = async (file) => {
      const url = new URL(file, base);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Spieldaten fehlen (${url.pathname}: HTTP ${response.status}). Erzeuge sie mit: node scripts/extract-game-data.mjs`);
      return response;
    };
    const [jsonResponse, binResponse] = await Promise.all([fetchOk('textures.json'), fetchOk('textures.bin')]);
    const [json, bin] = await Promise.all([jsonResponse.json(), binResponse.arrayBuffer()]);
    return new TextureStore(json, bin, options);
  }

  get version() { return this.#version; }
  get layerSize() { return this.#layerSize; }
  get levelCount() { return this.#levelCount; }

  names() {
    return [...this.#entries.keys()].sort();
  }

  has(name) {
    return this.info(name) !== null;
  }

  // Beschreibung eines Namens (Textur, Region oder missingno) oder null.
  info(name) {
    const parsed = parseTextureName(name);
    if (parsed.kind === 'missing') return { name, kind: 'missing', texture: MISSING_TEXTURE, width: 16, height: 16, frameWidth: 16, frameHeight: 16, frameCount: 1, animated: false, interpolate: false, mip: null };
    if (parsed.kind === 'invalid') return null;
    const entry = this.#entries.get(parsed.texture);
    if (!entry) return null;
    const frameWidth = entry.anim ? entry.anim.fw : entry.w;
    const frameHeight = entry.anim ? entry.anim.fh : entry.h;
    const info = {
      name,
      kind: parsed.kind,
      texture: parsed.texture,
      width: entry.w,
      height: entry.h,
      frameWidth,
      frameHeight,
      frameCount: entry.anim ? (entry.w / frameWidth) * (entry.h / frameHeight) : 1,
      animated: Boolean(entry.anim) && new Set(entry.anim.frames.map((frame) => frame[0])).size > 1,
      interpolate: Boolean(entry.anim?.interpolate),
      mip: entry.mip ?? null,
    };
    if (parsed.kind === 'region') {
      if (parsed.x + parsed.w > frameWidth || parsed.y + parsed.h > frameHeight) return null;
      info.region = { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };
    }
    return info;
  }

  // Dekodiertes Gesamtbild einer Textur (alle Frames), zwischengespeichert.
  image(texture) {
    let promise = this.#images.get(texture);
    if (!promise) {
      const entry = this.#entries.get(texture);
      if (!entry) return Promise.reject(new Error(`Textur „${texture}“ gibt es nicht.`));
      promise = decodePng(this.#bin.subarray(entry.o, entry.o + entry.l)).catch((error) => {
        throw new Error(`Textur „${texture}“ lässt sich nicht lesen: ${error.message}`);
      });
      this.#images.set(texture, promise);
    }
    return promise;
  }

  #strategyOf(texture, entry) {
    if (entry.mip === undefined || MIP_STRATEGIES.includes(entry.mip)) return entry;
    if (!this.#warnedStrategies.has(texture)) {
      this.#warnedStrategies.add(texture);
      console.warn(`Textur „${texture}“: unbekannte Mipmap-Strategie „${entry.mip}“, nutze „auto“.`);
    }
    return { ...entry, mip: 'auto' };
  }

  async #buildFor(parsed) {
    if (parsed.kind === 'missing') {
      const image = missingImage(16);
      return buildLayer(MISSING_TEXTURE, { w: 16, h: 16, anim: null }, image, { layerSize: this.#layerSize });
    }
    const entry = this.#strategyOf(parsed.texture, this.#entries.get(parsed.texture));
    const image = await this.image(parsed.texture);
    const region = parsed.kind === 'region' ? parsed : null;
    return buildLayer(parsed.texture, entry, image, { region, layerSize: this.#layerSize });
  }

  #state(gl) {
    let state = this.#contexts.get(gl);
    if (!state) {
      state = { texture: null, capacity: 0, layerCount: 0, mirror: [], byKey: new Map(), animated: [], lastTick: null, queue: Promise.resolve(), stopWatching: null };
      // Kontextverlust über das Ereignis merken: gl.isTexture ist in Chrome ein synchroner GPU-Aufruf und bremste
      // jedes bind()/tick() aus (gemessen ~5 ms je Bild). Ohne Canvas (Tests mit Ersatz-Kontext) bleibt isTexture.
      const canvas = gl.canvas;
      if (canvas && typeof canvas.addEventListener === 'function') {
        const onLost = () => { state.texture = null; };
        canvas.addEventListener('webglcontextlost', onLost);
        state.stopWatching = () => canvas.removeEventListener('webglcontextlost', onLost);
      }
      this.#contexts.set(gl, state);
    }
    return state;
  }

  #textureValid(gl, state) {
    if (!state.texture) return false;
    return state.stopWatching ? !gl.isContextLost() : gl.isTexture(state.texture);
  }

  #levelBytes(level) {
    const size = this.#layerSize >> level;
    return size * size * 4;
  }

  #uploadRange(gl, state, first, count) {
    for (let level = 0; level < this.#levelCount; level++) {
      const size = this.#layerSize >> level;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, level, 0, 0, first, size, size, count, gl.RGBA, gl.UNSIGNED_BYTE,
        state.mirror[level], first * this.#levelBytes(level));
    }
  }

  // Legt die GL-Textur an (oder neu nach Kontextverlust/Wachstum) und lädt alle vorhandenen Ebenen hoch.
  #ensureTexture(gl, state, needed) {
    const valid = this.#textureValid(gl, state);
    if (valid && needed <= state.capacity) return;
    const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
    if (needed > maxLayers) {
      throw new Error(`Zu viele Texturen: ${needed} Ebenen nötig, die Grafikkarte erlaubt höchstens ${maxLayers} (MAX_ARRAY_TEXTURE_LAYERS).`);
    }
    const capacity = Math.max(state.capacity, Math.min(maxLayers, Math.max(MIN_CAPACITY, nextPowerOfTwo(needed))));
    if (capacity > state.capacity) {
      state.mirror = Array.from({ length: this.#levelCount }, (_, level) => {
        const grown = new Uint8Array(capacity * this.#levelBytes(level));
        if (state.mirror[level]) grown.set(state.mirror[level]);
        return grown;
      });
      state.capacity = capacity;
    }
    if (valid) gl.deleteTexture(state.texture);
    const texture = gl.createTexture();
    if (!texture) throw new Error('WebGL konnte keine Textur anlegen (Kontext verloren?).');
    state.texture = texture;
    withUploadState(gl, texture, () => {
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, this.#levelCount, gl.RGBA8, this.#layerSize, this.#layerSize, state.capacity);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_BASE_LEVEL, 0);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, this.#levelCount - 1);
      // Immer die ganze Kapazität hochladen (unbenutzte Ebenen = 0): nur teilweise beschriebene Ebenen
      // lässt ANGLE/D3D11 sonst einzeln nachträglich initialisieren (gemessen ~700 statt ~90 ms bei 2048 Ebenen).
      this.#uploadRange(gl, state, 0, state.capacity);
    });
  }

  #writeLayer(state, layer, levels) {
    for (let level = 0; level < this.#levelCount; level++) state.mirror[level].set(levels[level], layer * this.#levelBytes(level));
  }

  /**
   * Bereitet die Texturen für einen WebGL2-Kontext vor (nur neue werden dekodiert und hochgeladen; Ebenen
   * bleiben für diesen Kontext stabil). Rückgabe: Map<name, { layer, alpha, mask, maskWidth, maskHeight,
   * animated, missing }>. Unbekannte oder ungültige Namen bekommen die Fehltextur (Warnung in der Konsole).
   */
  prepare(gl, names) {
    if (!gl || typeof gl.texStorage3D !== 'function') return Promise.reject(new Error('prepare braucht einen WebGL2-Kontext.'));
    if (names === null || names === undefined || typeof names[Symbol.iterator] !== 'function' || typeof names === 'string') {
      return Promise.reject(new Error('prepare braucht eine Liste oder Menge von Texturnamen.'));
    }
    const list = [...names];
    const state = this.#state(gl);
    const run = state.queue.then(() => this.#prepareNow(gl, state, list));
    state.queue = run.catch(() => {});
    return run;
  }

  async #prepareNow(gl, state, list) {
    if (gl.isContextLost()) throw new Error('Der WebGL-Kontext ist verloren gegangen – Texturen können gerade nicht geladen werden.');
    const problems = [];
    const requested = list.map((name) => {
      const parsed = parseTextureName(name);
      if (parsed.kind === 'invalid') problems.push(`${String(name)} (${parsed.reason})`);
      else if (parsed.kind !== 'missing' && !this.#entries.has(parsed.texture)) problems.push(`${name} (unbekannt)`);
      const usable = parsed.kind !== 'invalid' && (parsed.kind === 'missing' || this.#entries.has(parsed.texture));
      return { name, parsed: usable ? parsed : { kind: 'missing' } };
    });

    const newKeys = [];
    const seen = new Set();
    for (const { parsed } of requested) {
      const key = canonicalKey(parsed);
      if (!state.byKey.has(key) && !seen.has(key)) {
        seen.add(key);
        newKeys.push({ key, parsed });
      }
    }
    // Früh abbrechen, bevor dekodiert wird (die Fehltextur kann später noch eine Ebene dazubringen).
    const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
    if (state.layerCount + newKeys.length > maxLayers) {
      throw new Error(`Zu viele Texturen: ${state.layerCount + newKeys.length} Ebenen nötig, die Grafikkarte erlaubt höchstens ${maxLayers} (MAX_ARRAY_TEXTURE_LAYERS).`);
    }

    // Alle auf einmal: DecompressionStream braucht mehrere Runden der Ereignisschleife, parallel ist es am schnellsten
    // (gemessen: 1269 Block-Texturen 217 ms statt ~900 ms mit 16 bis 64 gleichzeitig).
    const built = await Promise.all(newKeys.map(async ({ key, parsed }) => {
      try {
        return { key, layer: await this.#buildFor(parsed) };
      } catch (error) {
        problems.push(`${key} (${error.message})`);
        return { key, layer: null, fallback: true };
      }
    }));
    if (built.some((item) => item.layer === null) && !state.byKey.has(MISSING_TEXTURE) && !seen.has(MISSING_TEXTURE)) {
      built.push({ key: MISSING_TEXTURE, layer: await this.#buildFor({ kind: 'missing' }) });
    }
    const fresh = built.filter((item) => item.layer !== null);

    if (gl.isContextLost()) throw new Error('Der WebGL-Kontext ist verloren gegangen – Texturen können gerade nicht geladen werden.');
    const pendingError = gl.getError();
    if (pendingError !== gl.NO_ERROR) console.warn(`WebGL meldete schon vor dem Textur-Upload einen Fehler (Code ${pendingError}).`);
    this.#ensureTexture(gl, state, state.layerCount + fresh.length);

    const first = state.layerCount;
    for (const { key, layer } of fresh) {
      const index = state.layerCount++;
      const firstFrame = layer.animation ? layer.animation.frames[0][0] : 0;
      this.#writeLayer(state, index, layer.frames.get(firstFrame));
      const record = Object.freeze({
        layer: index,
        alpha: layer.alpha,
        mask: layer.mask,
        maskWidth: layer.maskWidth,
        maskHeight: layer.maskHeight,
        animated: layer.animation !== null && layer.frames.size > 1,
        missing: key === MISSING_TEXTURE,
      });
      state.byKey.set(key, record);
      if (record.animated) state.animated.push({ layer: index, frames: layer.frames, animation: layer.animation, lastKey: `${firstFrame}` });
    }
    if (fresh.length > 0) withUploadState(gl, state.texture, () => this.#uploadRange(gl, state, first, fresh.length));
    for (const item of built) {
      if (item.fallback) state.byKey.set(item.key, { ...state.byKey.get(MISSING_TEXTURE), missing: true });
    }
    const uploadError = gl.getError();
    if (uploadError !== gl.NO_ERROR) throw new Error(`WebGL-Fehler beim Hochladen der Texturen (Code ${uploadError}).`);
    if (problems.length > 0) console.warn(`Fehlende oder fehlerhafte Texturen (zeige Fehltextur): ${problems.join(', ')}`);

    const result = new Map();
    for (const { name, parsed } of requested) {
      const record = state.byKey.get(canonicalKey(parsed));
      const invalid = parsed.kind === 'missing' && name !== MISSING_TEXTURE;
      result.set(name, invalid ? { ...record, missing: true } : record);
    }
    return result;
  }

  // Animationen weiterschalten (Tick = 50 ms). Gibt true zurück, wenn etwas hochgeladen wurde.
  tick(gl, timeMs) {
    if (!Number.isFinite(timeMs)) throw new Error(`tick braucht eine Zeit in ms (bekommen: ${timeMs}).`);
    const state = this.#contexts.get(gl);
    if (!state || state.animated.length === 0 || gl.isContextLost()) return false;
    const ticks = Math.floor(timeMs / TICK_MS);
    if (ticks === state.lastTick) return false;
    state.lastTick = ticks;
    const changed = [];
    for (const anim of state.animated) {
      const frame = animationFrameAt(anim.animation, ticks);
      const mixing = anim.animation.interpolate && frame.progress > 0 && frame.index !== frame.nextIndex;
      const key = mixing ? `${frame.index}>${frame.nextIndex}@${frame.progress}` : `${frame.index}`;
      if (key === anim.lastKey) continue;
      anim.lastKey = key;
      const levels = mixing
        ? mixLevels(anim.frames.get(frame.index), anim.frames.get(frame.nextIndex), frame.progress)
        : anim.frames.get(frame.index);
      this.#writeLayer(state, anim.layer, levels);
      changed.push(anim.layer);
    }
    if (changed.length === 0) return false;
    if (!this.#textureValid(gl, state)) {
      this.#ensureTexture(gl, state, state.layerCount);
      return true;
    }
    withUploadState(gl, state.texture, () => {
      for (const layer of changed) this.#uploadRange(gl, state, layer, 1);
    });
    return true;
  }

  // Die GL-Textur dieses Kontexts (null vor prepare). Nach Kontextverlust neu angelegt.
  texture(gl) {
    const state = this.#contexts.get(gl);
    if (!state || state.layerCount === 0 || gl.isContextLost()) return null;
    this.#ensureTexture(gl, state, state.layerCount);
    return state.texture;
  }

  // Bindet das Textur-Array an die Textureinheit `unit`. Gibt false zurück, wenn nichts vorbereitet ist.
  bind(gl, unit = 0) {
    const texture = this.texture(gl);
    if (!texture) return false;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    return true;
  }

  // Kopie einer Ebene aus dem CPU-Spiegel (für Tests und Fehlersuche).
  readLayer(gl, layer, level = 0) {
    const state = this.#contexts.get(gl);
    if (!state || !Number.isInteger(layer) || layer < 0 || layer >= state.layerCount) throw new Error(`Ebene ${layer} gibt es in diesem Kontext nicht.`);
    if (!Number.isInteger(level) || level < 0 || level >= this.#levelCount) throw new Error(`Mip-Stufe ${level} gibt es nicht (0 … ${this.#levelCount - 1}).`);
    const bytes = this.#levelBytes(level);
    return state.mirror[level].slice(layer * bytes, (layer + 1) * bytes);
  }

  stats(gl) {
    const state = this.#contexts.get(gl);
    if (!state) return { layers: 0, capacity: 0, animated: 0, missing: 0, alpha: { opaque: 0, cutout: 0, translucent: 0 } };
    const alpha = { opaque: 0, cutout: 0, translucent: 0 };
    let missing = 0;
    const layers = new Map();
    for (const record of state.byKey.values()) layers.set(record.layer, record);
    for (const record of layers.values()) {
      alpha[record.alpha]++;
      if (record.missing) missing++;
    }
    return { layers: state.layerCount, capacity: state.capacity, animated: state.animated.length, missing, alpha };
  }

  // Gibt die GL-Textur frei und vergisst alle Ebenen dieses Kontexts.
  dispose(gl) {
    const state = this.#contexts.get(gl);
    if (!state) return;
    if (state.texture && !gl.isContextLost() && gl.isTexture(state.texture)) gl.deleteTexture(state.texture);
    state.stopWatching?.();
    this.#contexts.delete(gl);
  }

  async #firstFrame(texture) {
    const parsed = parseTextureName(texture);
    if (parsed.kind !== 'texture' || !this.#entries.has(parsed.texture)) throw new Error(`Icon: Textur „${texture}“ gibt es nicht.`);
    const entry = this.#entries.get(parsed.texture);
    const image = await this.image(parsed.texture);
    if (!entry.anim) return image;
    const index = entry.anim.frames[0][0];
    const columns = entry.w / entry.anim.fw;
    return cropImage(image, (index % columns) * entry.anim.fw, Math.floor(index / columns) * entry.anim.fh, entry.anim.fw, entry.anim.fh);
  }

  /**
   * Icon als RGBA-Bild: item/<id> flach, sonst faceTextures.flat flach, sonst isometrischer Block aus
   * faceTextures { up, north, east, height? } (je Textur, { texture, tint } oder Liste davon), sonst block/<id>.
   */
  async iconImage(id, faceTextures = null, { size = 64 } = {}) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id.replace(/^minecraft:/, ''))) throw new Error(`Icon: ungültige ID „${String(id)}“.`);
    if (!Number.isInteger(size) || size < 16 || size > 512) throw new Error(`Icon-Größe ${size} ungültig (16 … 512).`);
    const cleanId = id.replace(/^minecraft:/, '');
    if (faceTextures !== null && typeof faceTextures !== 'object') throw new Error('Icon: faceTextures muss ein Objekt oder null sein.');
    const flat = this.#entries.has(`item/${cleanId}`) ? `item/${cleanId}` : faceTextures?.flat ?? null;
    if (flat) return resampleNearest(await this.#firstFrame(flat), size, size);
    let faces = faceTextures;
    if (!faces) {
      if (!this.#entries.has(`block/${cleanId}`)) throw new Error(`Kein Icon für „${cleanId}“: weder item/${cleanId} noch block/${cleanId} noch Flächen-Texturen.`);
      faces = { up: `block/${cleanId}`, north: `block/${cleanId}`, east: `block/${cleanId}` };
    }
    const layers = {};
    for (const key of ['up', 'north', 'east']) {
      if (faces[key] === undefined) throw new Error(`Icon: Fläche „${key}“ fehlt.`);
      layers[key] = await Promise.all(normalizeFaceLayers(faces[key], key).map(async ({ texture, tint }) => ({ image: await this.#firstFrame(texture), tint })));
    }
    return renderBlockIcon(layers, size, { height: faces.height ?? 1 });
  }

  // Wie iconImage, als data:-URL (PNG), zwischengespeichert.
  iconDataUrl(id, faceTextures = null, { size = 64 } = {}) {
    const key = JSON.stringify([id, faceTextures, size]);
    let promise = this.#icons.get(key);
    if (!promise) {
      promise = this.iconImage(id, faceTextures, { size })
        .then(encodePng)
        .then((bytes) => `data:image/png;base64,${toBase64(bytes)}`);
      this.#icons.set(key, promise);
      promise.catch(() => this.#icons.delete(key));
    }
    return promise;
  }
}
