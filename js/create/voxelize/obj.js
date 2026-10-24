// Wavefront OBJ lesen: v (optional mit Eckfarbe r g b, sRGB 0 … 1), vt, f mit Polygonen (→ Dreiecksfächer),
// negative Indizes, usemtl. Die .mtl ist optional (zweite Datei): newmtl + Kd (lineares RGB wie Blender es schreibt).
// Texturen aus der .mtl (map_Kd) werden nicht geladen – dann zählt Kd.

import { MeshBuilder, ModelError, createWarnings, decodeText, toBytes, srgbToLinear, DEFAULT_COLOR, LIMITS, formatCount } from './mesh.js';

const MAX_VERTICES = 3 * LIMITS.triangles;

function lines(text, onLine) {
  let start = 0;
  let number = 0;
  let pending = '';
  while (start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end < 0) end = text.length;
    number++;
    let raw = text.slice(start, end);
    start = end + 1;
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);
    // Fortsetzungszeile mit „\“ am Ende
    if (raw.endsWith('\\')) {
      pending += raw.slice(0, -1) + ' ';
      continue;
    }
    const full = (pending + raw).trim();
    pending = '';
    const hash = full.indexOf('#');
    const content = (hash >= 0 ? full.slice(0, hash) : full).trim();
    if (content !== '') onLine(content, number);
  }
}

function numbers(parts, from, count, line, what) {
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const value = Number(parts[from + i]);
    if (parts[from + i] === undefined || !Number.isFinite(value)) throw new ModelError(`OBJ Zeile ${line}: „${what}“ braucht ${count} Zahlen.`);
    out[i] = value;
  }
  return out;
}

/** .mtl-Text → Map<name, { color: [r, g, b] linear | null, texture: string | null }>. */
export function parseMtl(input, warnings = createWarnings()) {
  const text = typeof input === 'string' ? input : decodeText(toBytes(input));
  const materials = new Map();
  let current = null;
  lines(text, (content, line) => {
    const parts = content.split(/\s+/);
    const keyword = parts[0];
    if (keyword === 'newmtl') {
      const name = content.slice(6).trim();
      if (!name) throw new ModelError(`MTL Zeile ${line}: „newmtl“ ohne Namen.`);
      if (materials.size >= LIMITS.materials) throw new ModelError(`Die .mtl-Datei hat mehr als ${LIMITS.materials} Materialien.`, { code: 'limit' });
      current = { color: null, texture: null };
      materials.set(name, current);
    } else if (keyword === 'Kd') {
      if (!current) throw new ModelError(`MTL Zeile ${line}: „Kd“ vor dem ersten „newmtl“.`);
      if (parts[1] === 'spectral' || parts[1] === 'xyz') {
        warnings.add('Farben in der .mtl als „spectral“ oder „xyz“ werden nicht unterstützt – dort gilt die Grundfarbe.');
        return;
      }
      const [r, g, b = r] = parts.length >= 4 ? numbers(parts, 1, 3, line, 'Kd') : numbers(parts, 1, 1, line, 'Kd');
      current.color = [r, g ?? r, b].map((v) => Math.min(1, Math.max(0, v)));
    } else if (keyword === 'map_Kd') {
      if (current) current.texture = parts[parts.length - 1];
    }
  });
  return materials;
}

/**
 * OBJ-Bytes → Mesh (siehe mesh.js). Übliche Hochachse: y.
 * mtl: Inhalt der .mtl als ArrayBuffer/Uint8Array/Text oder null.
 */
export function parseObj(input, { mtl = null } = {}) {
  const text = decodeText(toBytes(input));
  const warnings = createWarnings();
  const library = mtl ? parseMtl(mtl, warnings) : null;
  const positions = [];
  const vertexColors = [];
  const texcoords = [];
  let hasVertexColors = false;
  const materialIndex = new Map();
  const materials = [];
  let currentMaterial = -1;
  let usedMtllib = false;
  const builder = new MeshBuilder();

  const useMaterial = (name) => {
    let index = materialIndex.get(name);
    if (index === undefined) {
      if (materials.length >= LIMITS.materials) throw new ModelError(`Das Modell nutzt mehr als ${LIMITS.materials} Materialien.`, { code: 'limit' });
      index = materials.length;
      materialIndex.set(name, index);
      materials.push({ name, color: null, texture: null, known: false });
    }
    return index;
  };

  const resolve = (token, count, line, what) => {
    const value = Number(token);
    if (!Number.isInteger(value) || value === 0) throw new ModelError(`OBJ Zeile ${line}: ungültiger ${what}-Index „${token}“.`);
    const index = value < 0 ? count + value : value - 1;
    if (index < 0 || index >= count) throw new ModelError(`OBJ Zeile ${line}: ${what}-Index ${value} verweist auf nichts (es gibt ${count}).`);
    return index;
  };

  lines(text, (content, line) => {
    const space = content.search(/\s/);
    const keyword = space < 0 ? content : content.slice(0, space);
    if (keyword === 'v') {
      const parts = content.split(/\s+/);
      if (positions.length >= MAX_VERTICES * 3) throw new ModelError(`Das Modell hat mehr als ${formatCount(MAX_VERTICES)} Eckpunkte.`, { code: 'limit' });
      positions.push(...numbers(parts, 1, 3, line, 'v'));
      if (parts.length >= 7) {
        const [r, g, b] = numbers(parts, 4, 3, line, 'v (Farbe)');
        // Farben 0 … 1 (MeshLab, ZBrush) oder 0 … 255
        const scale = r > 1 || g > 1 || b > 1 ? 255 : 1;
        vertexColors.push(srgbToLinear(Math.min(1, r / scale)), srgbToLinear(Math.min(1, g / scale)), srgbToLinear(Math.min(1, b / scale)));
        hasVertexColors = true;
      } else {
        vertexColors.push(1, 1, 1);
      }
    } else if (keyword === 'vt') {
      const parts = content.split(/\s+/);
      const u = Number(parts[1]);
      const v = parts[2] === undefined ? 0 : Number(parts[2]);
      if (!Number.isFinite(u) || !Number.isFinite(v)) throw new ModelError(`OBJ Zeile ${line}: „vt“ braucht Zahlen.`);
      texcoords.push(u, v);
    } else if (keyword === 'f') {
      const parts = content.split(/\s+/);
      if (parts.length < 4) throw new ModelError(`OBJ Zeile ${line}: eine Fläche braucht mindestens drei Ecken.`);
      const vertexCount = positions.length / 3;
      const uvCount = texcoords.length / 2;
      const corners = [];
      for (let i = 1; i < parts.length; i++) {
        const [vToken, tToken] = parts[i].split('/');
        const vi = resolve(vToken, vertexCount, line, 'Eckpunkt');
        const ti = tToken ? resolve(tToken, uvCount, line, 'Textur') : -1;
        corners.push({ vi, ti });
      }
      if (currentMaterial < 0) currentMaterial = useMaterial('');
      const point = (c) => [positions[c.vi * 3], positions[c.vi * 3 + 1], positions[c.vi * 3 + 2]];
      const uv = (c) => (c.ti >= 0 ? [texcoords[c.ti * 2], texcoords[c.ti * 2 + 1]] : [0, 0]);
      const color = (c) => [vertexColors[c.vi * 3], vertexColors[c.vi * 3 + 1], vertexColors[c.vi * 3 + 2]];
      for (let i = 1; i + 1 < corners.length; i++) {
        const a = corners[0], b = corners[i], c = corners[i + 1];
        builder.add(point(a), point(b), point(c), currentMaterial, [uv(a), uv(b), uv(c)], hasVertexColors ? [color(a), color(b), color(c)] : null);
      }
    } else if (keyword === 'usemtl') {
      currentMaterial = useMaterial(content.slice(6).trim());
    } else if (keyword === 'mtllib') {
      usedMtllib = true;
    } else if (keyword === 'l' || keyword === 'p') {
      warnings.add('Linien und Punkte (l, p) im OBJ werden ignoriert.');
    } else if (!['vn', 'vp', 'o', 'g', 's', 'mg', 'usemap', 'maplib', 'shadow_obj', 'trace_obj', 'lod', 'bevel', 'c_interp', 'd_interp'].includes(keyword)) {
      if (['curv', 'curv2', 'surf', 'cstype', 'deg', 'bmat', 'step', 'parm', 'trim', 'hole', 'scrv', 'sp', 'end', 'con'].includes(keyword)) {
        warnings.add('Freiformflächen (Kurven, NURBS) im OBJ werden ignoriert – exportiere als Polygone.');
      } else {
        warnings.add(`Unbekannte OBJ-Anweisung „${keyword.slice(0, 20)}“ wird ignoriert.`);
      }
    }
  });

  if (builder.count === 0) throw new ModelError('Die OBJ-Datei enthält keine Flächen (f).');
  if (materials.length === 0) useMaterial('');
  let missing = 0;
  let textured = 0;
  const finalMaterials = materials.map(({ name }) => {
    const known = library?.get(name);
    if (known?.texture) textured++;
    if (known?.color) return { name, color: [...known.color], texture: null };
    if (name !== '') missing++;
    // Ohne Materialfarbe: Eckfarben unverändert, sonst Grundfarbe
    return { name, color: hasVertexColors ? [1, 1, 1] : [...DEFAULT_COLOR], texture: null };
  });
  if (!library && (usedMtllib || materials.some((m) => m.name !== ''))) {
    warnings.add('Das OBJ nutzt Materialien, aber die .mtl-Datei fehlt – lade sie mit hoch, sonst gilt die Grundfarbe.');
  } else if (library && missing > 0) {
    warnings.add(`${missing} Materialien fehlen in der .mtl oder haben kein Kd – dort gilt die Grundfarbe.`);
  }
  if (textured > 0) warnings.add('Texturen aus der .mtl (map_Kd) werden nicht geladen – es zählt die Farbe Kd. Für Texturen exportiere als .glb.');
  return builder.build({ materials: finalMaterials, upAxis: 'y', warnings: warnings.list });
}
