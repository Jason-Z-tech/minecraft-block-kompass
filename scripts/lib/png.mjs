// PNG lesen und schreiben mit node:zlib (für Skripte und Node-Tests; der Browser nutzt den Decoder in
// js/render/texture-store.js). Lesen: Farbtypen 0/2/3/4/6, Bittiefen 1–16, Zeilenfilter 0–4, Palette mit
// tRNS, Adam7-Zeilensprung, Prüfsummen. Schreiben: RGBA mit 8 Bit. Nur Node-Bordmittel.

import zlib from 'node:zlib';

export const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);
export const PNG_MAX_SIDE = 16384;
export const PNG_MAX_PIXELS = 64 * 1024 * 1024;

const CHANNELS = Object.freeze({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 });
const DEPTHS = Object.freeze({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] });
// Adam7: Start x, Start y, Schritt x, Schritt y
const ADAM7 = Object.freeze([[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]);
const FULL_PASS = Object.freeze([[0, 0, 1, 1]]);
// Was nach dem letzten Bildbyte im Datenstrom noch stehen darf (manche Programme hängen Füllbytes an)
const INFLATE_SLACK = 1024 * 1024;

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('PNG: erwartet werden Bytes (Buffer, Uint8Array oder ArrayBuffer).');
}

function passSizes({ width, height, interlace }) {
  return (interlace ? ADAM7 : FULL_PASS).map(([x0, y0, dx, dy]) => ({
    x0, y0, dx, dy,
    width: width > x0 ? Math.ceil((width - x0) / dx) : 0,
    height: height > y0 ? Math.ceil((height - y0) / dy) : 0,
  }));
}

function rowBytes(width, bitsPerPixel) {
  return Math.ceil((width * bitsPerPixel) / 8);
}

// Abschnitte lesen; prüft Länge, Reihenfolge und die CRC jedes Abschnitts.
function readChunks(data) {
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) throw new Error('PNG: Signatur fehlt – das ist keine PNG-Datei.');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out = { header: null, palette: null, transparency: null, idat: [], ended: false };
  let pos = 8;
  while (pos + 12 <= data.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error('PNG: ungültiger Abschnittsname – die Datei ist beschädigt.');
    if (length > data.length - pos - 12) throw new Error(`PNG: Abschnitt ${type} reicht über das Dateiende.`);
    const body = data.subarray(pos + 8, pos + 8 + length);
    const crc = view.getUint32(pos + 8 + length);
    if (zlib.crc32(data.subarray(pos + 4, pos + 8 + length)) !== crc) throw new Error(`PNG: Prüfsumme von ${type} stimmt nicht – die Datei ist beschädigt.`);
    if (type === 'IHDR') {
      if (out.header) throw new Error('PNG: IHDR kommt doppelt vor.');
      if (length !== 13) throw new Error('PNG: IHDR hat die falsche Länge.');
      const h = new DataView(body.buffer, body.byteOffset, 13);
      out.header = {
        width: h.getUint32(0), height: h.getUint32(4), depth: body[8], colorType: body[9],
        compression: body[10], filter: body[11], interlace: body[12],
      };
    } else if (!out.header) {
      throw new Error('PNG: IHDR muss der erste Abschnitt sein.');
    } else if (type === 'PLTE') {
      if (length % 3 !== 0 || length === 0 || length > 768) throw new Error('PNG: Palette hat eine ungültige Länge.');
      out.palette = body;
    } else if (type === 'tRNS') {
      out.transparency = body;
    } else if (type === 'IDAT') {
      out.idat.push(body);
    } else if (type === 'IEND') {
      out.ended = true;
      break;
    } else if ((data[pos + 4] & 0x20) === 0) {
      // Großbuchstabe am Anfang = kritischer Abschnitt, den wir nicht kennen
      throw new Error(`PNG: unbekannter kritischer Abschnitt ${type}.`);
    }
    pos += 12 + length;
  }
  return out;
}

function checkHeader(header, palette) {
  if (!header) throw new Error('PNG: IHDR fehlt.');
  const { width, height, depth, colorType, compression, filter, interlace } = header;
  if (width < 1 || height < 1 || width > PNG_MAX_SIDE || height > PNG_MAX_SIDE) {
    throw new Error(`PNG: Bildgröße ${width}×${height} wird nicht unterstützt (1 … ${PNG_MAX_SIDE} Pixel je Seite).`);
  }
  if (width * height > PNG_MAX_PIXELS) throw new Error(`PNG: Bild mit ${width}×${height} Pixeln ist zu groß.`);
  if (!DEPTHS[colorType]?.includes(depth)) throw new Error(`PNG: Farbtyp ${colorType} mit ${depth} Bit gibt es nicht.`);
  if (compression !== 0) throw new Error(`PNG: unbekannte Kompression ${compression}.`);
  if (filter !== 0) throw new Error(`PNG: unbekannte Filtermethode ${filter}.`);
  if (interlace > 1) throw new Error(`PNG: unbekannter Zeilensprung ${interlace}.`);
  if (colorType === 3 && !palette) throw new Error('PNG: Palette (PLTE) fehlt.');
}

function unfilterRow(line, prev, filterType, bpp) {
  const n = line.length;
  switch (filterType) {
    case 0:
      return;
    case 1:
      for (let i = bpp; i < n; i++) line[i] = (line[i] + line[i - bpp]) & 255;
      return;
    case 2:
      for (let i = 0; i < n; i++) line[i] = (line[i] + prev[i]) & 255;
      return;
    case 3:
      for (let i = 0; i < n; i++) line[i] = (line[i] + (((i >= bpp ? line[i - bpp] : 0) + prev[i]) >> 1)) & 255;
      return;
    case 4:
      for (let i = 0; i < n; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      return;
    default:
      throw new Error(`PNG: unbekannter Zeilenfilter ${filterType}.`);
  }
}

function readSample(line, i, c, channels, depth) {
  if (depth === 8) return line[i * channels + c];
  if (depth === 16) {
    const o = (i * channels + c) * 2;
    return (line[o] << 8) | line[o + 1];
  }
  const bit = i * depth;
  return (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
}

// Schreibt Pixel i einer entfilterten Zeile als RGBA (8 Bit) nach out[o].
function createPixelWriter({ colorType, depth }, palette, transparency) {
  const channels = CHANNELS[colorType];
  const max = (1 << depth) - 1;
  // wie js/render/texture-store.js: 16 Bit → oberes Byte, kleine Tiefen auf 0 … 255 gestreckt
  const to8 = depth === 16 ? (v) => v >> 8 : depth === 8 ? (v) => v : (v) => Math.round((v * 255) / max);
  const tView = transparency ? new DataView(transparency.buffer, transparency.byteOffset, transparency.byteLength) : null;
  const grayKey = colorType === 0 && tView && transparency.length >= 2 ? tView.getUint16(0) : -1;
  const rgbKey = colorType === 2 && tView && transparency.length >= 6 ? [tView.getUint16(0), tView.getUint16(2), tView.getUint16(4)] : null;
  const paletteSize = palette ? palette.length / 3 : 0;
  switch (colorType) {
    case 0:
      return (line, i, out, o) => {
        const v = readSample(line, i, 0, 1, depth);
        out[o] = out[o + 1] = out[o + 2] = to8(v);
        out[o + 3] = v === grayKey ? 0 : 255;
      };
    case 2:
      return (line, i, out, o) => {
        const r = readSample(line, i, 0, 3, depth), g = readSample(line, i, 1, 3, depth), b = readSample(line, i, 2, 3, depth);
        out[o] = to8(r);
        out[o + 1] = to8(g);
        out[o + 2] = to8(b);
        out[o + 3] = rgbKey && r === rgbKey[0] && g === rgbKey[1] && b === rgbKey[2] ? 0 : 255;
      };
    case 3:
      return (line, i, out, o) => {
        const index = readSample(line, i, 0, 1, depth);
        if (index >= paletteSize) throw new Error(`PNG: Palettenindex ${index} liegt außerhalb der Palette (${paletteSize} Farben).`);
        out[o] = palette[index * 3];
        out[o + 1] = palette[index * 3 + 1];
        out[o + 2] = palette[index * 3 + 2];
        out[o + 3] = transparency && index < transparency.length ? transparency[index] : 255;
      };
    case 4:
      return (line, i, out, o) => {
        out[o] = out[o + 1] = out[o + 2] = to8(readSample(line, i, 0, 2, depth));
        out[o + 3] = to8(readSample(line, i, 1, 2, depth));
      };
    default:
      return (line, i, out, o) => {
        for (let c = 0; c < 4; c++) out[o + c] = to8(readSample(line, i, c, channels, depth));
      };
  }
}

/** Nur den Kopf lesen: { width, height, depth, colorType, interlace }. */
export function readPngInfo(input) {
  const data = toBytes(input);
  const { header, palette } = readChunks(data);
  checkHeader(header, palette);
  return { width: header.width, height: header.height, depth: header.depth, colorType: header.colorType, interlace: header.interlace };
}

/** PNG → { width, height, data: Uint8Array (RGBA, 8 Bit, Zeilen von oben) }. Wirft Error mit deutscher Meldung. */
export function decodePng(input) {
  const data = toBytes(input);
  const { header, palette, transparency, idat } = readChunks(data);
  checkHeader(header, palette);
  if (idat.length === 0) throw new Error('PNG: Bilddaten (IDAT) fehlen.');
  const bitsPerPixel = CHANNELS[header.colorType] * header.depth;
  const passes = passSizes(header);
  const expected = passes.reduce((sum, p) => (p.width && p.height ? sum + p.height * (1 + rowBytes(p.width, bitsPerPixel)) : sum), 0);
  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: expected + INFLATE_SLACK });
  } catch (error) {
    if (error.code === 'ERR_BUFFER_TOO_LARGE') throw new Error('PNG: die entpackten Bilddaten sind viel größer als im Kopf angegeben.');
    throw new Error(`PNG: Bilddaten lassen sich nicht entpacken (${error.message}).`);
  }
  if (raw.length < expected) throw new Error('PNG: Bilddaten sind zu kurz – die Datei ist unvollständig.');

  const { width, height } = header;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const pixels = new Uint8Array(width * height * 4);
  const writePixel = createPixelWriter(header, palette, transparency);
  let pos = 0;
  for (const pass of passes) {
    if (pass.width === 0 || pass.height === 0) continue;
    const stride = rowBytes(pass.width, bitsPerPixel);
    let prev = new Uint8Array(stride);
    for (let row = 0; row < pass.height; row++) {
      const filterType = raw[pos];
      // in place entfiltern: die vorige Zeile ist dann schon fertig
      const line = raw.subarray(pos + 1, pos + 1 + stride);
      pos += 1 + stride;
      unfilterRow(line, prev, filterType, bpp);
      const y = pass.y0 + row * pass.dy;
      for (let i = 0; i < pass.width; i++) writePixel(line, i, pixels, (y * width + pass.x0 + i * pass.dx) * 4);
      prev = line;
    }
  }
  return { width, height, data: pixels };
}

function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(body.buffer, body.byteOffset, body.byteLength).copy(out, 8);
  out.writeUInt32BE(zlib.crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** RGBA-Bild { width, height, data } → PNG-Bytes (Buffer; Farbtyp 6, 8 Bit, Filter 0). */
export function encodePng({ width, height, data }, { level = 6 } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > PNG_MAX_SIDE || height > PNG_MAX_SIDE) {
    throw new Error(`PNG: ungültige Bildgröße ${width}×${height}.`);
  }
  if (!data || data.length !== width * height * 4) throw new Error(`PNG: erwartet werden ${width * height * 4} RGBA-Bytes.`);
  const rowLength = width * 4;
  const raw = Buffer.alloc(height * (rowLength + 1));
  for (let y = 0; y < height; y++) {
    raw.set(data.subarray(y * rowLength, (y + 1) * rowLength), y * (rowLength + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from(PNG_SIGNATURE), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level })), chunk('IEND', Buffer.alloc(0))]);
}
