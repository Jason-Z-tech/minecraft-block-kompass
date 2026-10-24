// STL lesen (binär und ASCII). Erkennung über die Dateigröße (binär: 84 + 50 · Dreiecke) und den Inhalt –
// nicht nur über „solid“ am Anfang (viele binäre Exporter schreiben „solid“ in den Kopf).
// Farben je Dreieck: VisCAM/SolidView (Bit 15 = gültig, 5 Bit je Kanal, Blau unten) und Materialise Magics
// („COLOR=“ im Kopf, Bit 15 = 0 heißt gültig, Rot unten).

import { MeshBuilder, ModelError, createWarnings, decodeText, toBytes, srgbToLinear, DEFAULT_COLOR, LIMITS, formatCount } from './mesh.js';

const HEADER = 80;
const RECORD = 50;

/** 'binary' | 'ascii' | null (kein STL erkennbar). */
export function detectStlKind(bytes) {
  const headBytes = bytes.subarray(0, Math.min(bytes.length, 4096));
  const head = decodeText(headBytes);
  const startsWithSolid = /^\s*solid\b/i.test(head);
  // Reiner Text (Tabulator, Zeilenumbrüche, druckbare Zeichen) mit „facet“ am Anfang kann kein binäres STL sein
  const printable = headBytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127));
  if (startsWithSolid && printable && /\bfacet\b/i.test(head)) return 'ascii';
  if (bytes.length >= HEADER + 4) {
    const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(HEADER, true);
    if (HEADER + 4 + count * RECORD === bytes.length) return 'binary';
  }
  if (startsWithSolid && /\b(facet|vertex|endsolid)\b/i.test(head + decodeText(bytes.subarray(Math.max(0, bytes.length - 512))))) return 'ascii';
  if (bytes.length >= HEADER + 4) return 'binary';
  return null;
}

function colorFromAttribute(attr, magics) {
  // 5 Bit je Kanal (sRGB) → linear
  const channel = (v) => srgbToLinear(v / 31);
  if (magics) {
    if (attr & 0x8000) return null;
    return [channel(attr & 31), channel((attr >> 5) & 31), channel((attr >> 10) & 31)];
  }
  if (!(attr & 0x8000)) return null;
  return [channel((attr >> 10) & 31), channel((attr >> 5) & 31), channel(attr & 31)];
}

function parseBinary(bytes, warnings) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declared = view.getUint32(HEADER, true);
  const available = Math.floor((bytes.length - HEADER - 4) / RECORD);
  if (declared > available) {
    throw new ModelError(`Die STL-Datei ist unvollständig: Der Kopf nennt ${formatCount(declared)} Dreiecke, es sind aber nur ${formatCount(available)} enthalten.`);
  }
  if (declared === 0) throw new ModelError('Die STL-Datei enthält keine Dreiecke.');
  if (declared < available) warnings.add('Am Ende der STL-Datei stehen überzählige Bytes – sie werden ignoriert.');
  if (declared > LIMITS.triangles) {
    throw new ModelError(`Das Modell hat ${formatCount(declared)} Dreiecke – höchstens ${formatCount(LIMITS.triangles)} sind möglich. Vereinfache es (z. B. „Decimate“ in Blender).`, { code: 'limit' });
  }
  const header = decodeText(bytes.subarray(0, HEADER));
  const magics = /COLOR=/.test(header);
  const builder = new MeshBuilder();
  // Hat irgendein Dreieck eine Farbe, tragen alle eine Eckfarbe (ohne Farbe: Grundfarbe) und das Material ist weiß.
  let colored = 0;
  for (let t = 0; t < declared; t++) if (colorFromAttribute(view.getUint16(HEADER + 4 + t * RECORD + 48, true), magics)) colored++;
  const fallback = [DEFAULT_COLOR, DEFAULT_COLOR, DEFAULT_COLOR];
  let skipped = 0;
  for (let t = 0; t < declared; t++) {
    const o = HEADER + 4 + t * RECORD + 12;
    const v = new Array(9);
    let ok = true;
    for (let k = 0; k < 9; k++) {
      v[k] = view.getFloat32(o + k * 4, true);
      if (!Number.isFinite(v[k])) ok = false;
    }
    if (!ok) {
      skipped++;
      continue;
    }
    if (colored > 0) {
      const color = colorFromAttribute(view.getUint16(o + 36, true), magics);
      builder.add([v[0], v[1], v[2]], [v[3], v[4], v[5]], [v[6], v[7], v[8]], 0, null, color ? [color, color, color] : fallback);
    } else {
      builder.addFlat(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], 0);
    }
  }
  if (skipped > 0) warnings.add(`${formatCount(skipped)} Dreiecke mit ungültigen Koordinaten wurden übersprungen.`);
  if (colored > 0 && colored < declared) warnings.add('Nur ein Teil der Dreiecke hat eine Farbe – die übrigen bekommen die Grundfarbe.');
  if (builder.count === 0) throw new ModelError('Die STL-Datei enthält keine gültigen Dreiecke.');
  return { builder, colored: colored > 0 };
}

function parseAscii(bytes, warnings) {
  const text = decodeText(bytes);
  const builder = new MeshBuilder();
  const corners = [];
  let line = 0;
  let start = 0;
  let inLoop = false;
  let skipped = 0;
  const flush = () => {
    if (corners.length < 3) {
      if (corners.length > 0) skipped++;
    } else {
      for (let i = 1; i + 1 < corners.length; i++) builder.add(corners[0], corners[i], corners[i + 1]);
    }
    corners.length = 0;
  };
  while (start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end < 0) end = text.length;
    line++;
    const raw = text.slice(start, end).trim();
    start = end + 1;
    if (raw === '') continue;
    const parts = raw.split(/\s+/);
    const keyword = parts[0].toLowerCase();
    if (keyword === 'vertex') {
      if (parts.length < 4) throw new ModelError(`STL Zeile ${line}: „vertex“ braucht drei Zahlen.`);
      const p = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
      if (!p.every(Number.isFinite)) throw new ModelError(`STL Zeile ${line}: ungültige Zahl in „${raw.slice(0, 60)}“.`);
      corners.push(p);
    } else if (keyword === 'outer') {
      inLoop = true;
      corners.length = 0;
    } else if (keyword === 'endloop') {
      if (!inLoop) throw new ModelError(`STL Zeile ${line}: „endloop“ ohne „outer loop“.`);
      inLoop = false;
      flush();
    }
  }
  if (inLoop) flush();
  if (skipped > 0) warnings.add(`${skipped} Flächen mit weniger als drei Ecken wurden übersprungen.`);
  if (builder.count === 0) throw new ModelError('Die STL-Datei enthält keine Dreiecke.');
  return { builder, colored: false };
}

/** STL-Bytes → Mesh (siehe mesh.js). Übliche Hochachse: z (CAD und 3D-Druck). */
export function parseStl(input) {
  const bytes = toBytes(input);
  if (bytes.length < 15) throw new ModelError('Die STL-Datei ist zu kurz.');
  const kind = detectStlKind(bytes);
  if (!kind) throw new ModelError('Das ist keine STL-Datei (weder binär noch ASCII erkennbar).');
  const warnings = createWarnings();
  const { builder, colored } = kind === 'binary' ? parseBinary(bytes, warnings) : parseAscii(bytes, warnings);
  const color = colored ? [1, 1, 1] : [...DEFAULT_COLOR];
  const mesh = builder.build({ materials: [{ name: 'STL', color, texture: null }], upAxis: 'z', warnings: warnings.list });
  mesh.stlKind = kind;
  return mesh;
}
