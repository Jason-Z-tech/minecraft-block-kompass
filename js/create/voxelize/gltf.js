// glTF 2.0 lesen: .glb (binär) und .gltf mit eingebetteten Daten-URIs. Meshes mit Primitiven TRIANGLES
// (auch Streifen und Fächer), Indizes, Knoten-Transformationen samt Hierarchie, baseColorFactor und
// baseColorTexture (über TEXCOORD_n, Sampler-Wiederholung). Bilder dekodiert decodeImage: im Browser/Worker
// createImageBitmap + OffscreenCanvas, in Node scripts/lib/png.mjs (nur PNG). Externe Dateien → Hinweis auf .glb.

import { MeshBuilder, ModelError, createWarnings, decodeText, toBytes, DEFAULT_COLOR, LIMITS, formatCount } from './mesh.js';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });
const COMPONENT_TYPES = Object.freeze({
  5120: { size: 1, read: 'getInt8', norm: (v) => Math.max(v / 127, -1) },
  5121: { size: 1, read: 'getUint8', norm: (v) => v / 255 },
  5122: { size: 2, read: 'getInt16', norm: (v) => Math.max(v / 32767, -1) },
  5123: { size: 2, read: 'getUint16', norm: (v) => v / 65535 },
  5125: { size: 4, read: 'getUint32', norm: (v) => v },
  5126: { size: 4, read: 'getFloat32', norm: (v) => v },
});
const SUPPORTED_REQUIRED = new Set(['KHR_mesh_quantization', 'KHR_texture_transform', 'KHR_materials_unlit',
  'KHR_materials_pbrSpecularGlossiness', 'EXT_texture_webp']);
const MAX_TEXTURE_PIXELS = 16 * 1024 * 1024;
const MAX_NODE_DEPTH = 128;
const WRAP = Object.freeze({ 33071: 'clamp', 33648: 'mirror', 10497: 'repeat' });

const EXPORT_HINT = 'bitte als .glb exportieren (alles in einer Datei)';

// ------------------------------------------------------------------ Container

function readGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || view.getUint32(0, true) !== GLB_MAGIC) throw new ModelError('Das ist keine .glb-Datei (Kennung „glTF“ fehlt).');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new ModelError(`Nur glTF 2.0 wird unterstützt (die Datei hat Version ${version}).`);
  const length = view.getUint32(8, true);
  if (length > bytes.length) throw new ModelError('Die .glb-Datei ist unvollständig.');
  let json = null;
  let bin = null;
  let offset = 12;
  while (offset + 8 <= length) {
    const chunkLength = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + chunkLength > length) throw new ModelError('Die .glb-Datei ist beschädigt (Abschnitt reicht über das Dateiende).');
    if (type === CHUNK_JSON && json === null) json = decodeText(bytes.subarray(start, start + chunkLength));
    else if (type === CHUNK_BIN && bin === null) bin = bytes.subarray(start, start + chunkLength);
    offset = start + chunkLength + ((4 - (chunkLength % 4)) % 4);
  }
  if (json === null) throw new ModelError('Die .glb-Datei hat keinen JSON-Teil.');
  return { json, bin };
}

function parseJson(text) {
  let gltf;
  try {
    gltf = JSON.parse(text);
  } catch (error) {
    throw new ModelError(`Der glTF-Inhalt ist kein gültiges JSON (${error.message}).`);
  }
  if (!gltf || typeof gltf !== 'object' || !gltf.asset || typeof gltf.asset.version !== 'string') {
    throw new ModelError('Der glTF-Inhalt hat keine „asset“-Angabe – ist das wirklich glTF?');
  }
  if (!gltf.asset.version.startsWith('2.')) throw new ModelError(`Nur glTF 2.0 wird unterstützt (die Datei hat Version ${gltf.asset.version}).`);
  return gltf;
}

function decodeDataUri(uri, what) {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!match) throw new ModelError(`${what} verweist auf die externe Datei „${uri.slice(0, 60)}“ – ${EXPORT_HINT}.`);
  if (!match[2]) {
    return { bytes: new TextEncoder().encode(decodeURIComponent(match[3])), mimeType: match[1] };
  }
  let binary;
  try {
    binary = atob(match[3].replace(/\s+/g, ''));
  } catch {
    throw new ModelError(`${what}: die eingebetteten Daten (Base64) sind beschädigt.`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType: match[1] };
}

function checkIndex(list, index, what) {
  if (!Array.isArray(list) || !Number.isInteger(index) || index < 0 || index >= list.length) {
    throw new ModelError(`glTF: ${what} ${index} gibt es nicht – die Datei ist beschädigt.`);
  }
  return list[index];
}

// ------------------------------------------------------------------ Accessoren

function createReader(gltf, bin) {
  const buffers = (gltf.buffers ?? []).map((buffer, i) => {
    if (typeof buffer.uri === 'string') return decodeDataUri(buffer.uri, `Puffer ${i}`).bytes;
    if (i === 0 && bin) return bin;
    throw new ModelError(`glTF: Puffer ${i} hat keine Daten – ${EXPORT_HINT}.`);
  });

  const viewBytes = (index) => {
    const view = checkIndex(gltf.bufferViews, index, 'BufferView');
    const buffer = buffers[view.buffer];
    if (!buffer) throw new ModelError(`glTF: BufferView ${index} verweist auf einen fehlenden Puffer.`);
    const offset = view.byteOffset ?? 0;
    if (!Number.isInteger(view.byteLength) || offset + view.byteLength > buffer.length) {
      throw new ModelError(`glTF: BufferView ${index} reicht über das Ende des Puffers.`);
    }
    return { bytes: buffer.subarray(offset, offset + view.byteLength), stride: view.byteStride ?? 0 };
  };

  // Liest count Elemente mit n Komponenten ab einem BufferView-Ausschnitt in out (Float64-Werte).
  const readInto = (out, viewIndex, byteOffset, count, n, componentType, normalized, stride0 = 0) => {
    const type = COMPONENT_TYPES[componentType];
    if (!type) throw new ModelError(`glTF: unbekannter Komponententyp ${componentType}.`);
    const { bytes, stride } = viewBytes(viewIndex);
    const step = stride || stride0 || type.size * n;
    const end = byteOffset + (count - 1) * step + type.size * n;
    if (count > 0 && end > bytes.length) throw new ModelError('glTF: ein Accessor reicht über das Ende seiner Daten.');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const read = dv[type.read].bind(dv);
    for (let i = 0; i < count; i++) {
      const base = byteOffset + i * step;
      for (let c = 0; c < n; c++) {
        const raw = read(base + c * type.size, true);
        out[i * n + c] = normalized ? type.norm(raw) : raw;
      }
    }
  };

  const cache = new Map();
  const accessor = (index) => {
    let result = cache.get(index);
    if (result) return result;
    const acc = checkIndex(gltf.accessors, index, 'Accessor');
    const n = COMPONENTS[acc.type];
    if (!n) throw new ModelError(`glTF: Accessor ${index} hat den unbekannten Typ „${acc.type}“.`);
    if (!Number.isInteger(acc.count) || acc.count < 0 || acc.count > 3 * LIMITS.triangles * 2) {
      throw new ModelError(`glTF: Accessor ${index} ist zu groß oder ungültig.`, { code: 'limit' });
    }
    const values = new Float64Array(acc.count * n);
    if (acc.bufferView !== undefined) readInto(values, acc.bufferView, acc.byteOffset ?? 0, acc.count, n, acc.componentType, acc.normalized === true);
    if (acc.sparse) {
      const { count, indices, values: sparseValues } = acc.sparse;
      const which = new Float64Array(count);
      readInto(which, indices.bufferView, indices.byteOffset ?? 0, count, 1, indices.componentType, false);
      const replacement = new Float64Array(count * n);
      readInto(replacement, sparseValues.bufferView, sparseValues.byteOffset ?? 0, count, n, acc.componentType, acc.normalized === true);
      for (let i = 0; i < count; i++) {
        const target = which[i];
        if (!Number.isInteger(target) || target < 0 || target >= acc.count) throw new ModelError(`glTF: Sparse-Index in Accessor ${index} ist ungültig.`);
        for (let c = 0; c < n; c++) values[target * n + c] = replacement[i * n + c];
      }
    }
    result = { values, count: acc.count, n };
    cache.set(index, result);
    return result;
  };

  const imageBytes = (image, index) => {
    if (typeof image.uri === 'string') return decodeDataUri(image.uri, `Bild ${index}`);
    if (image.bufferView !== undefined) return { bytes: viewBytes(image.bufferView).bytes, mimeType: image.mimeType ?? '' };
    throw new ModelError(`glTF: Bild ${index} hat keine Daten.`);
  };

  return { accessor, imageBytes };
}

// ------------------------------------------------------------------ Matrizen (spaltenweise wie glTF)

function multiply(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix)) {
    if (node.matrix.length !== 16 || !node.matrix.every(Number.isFinite)) throw new ModelError('glTF: ein Knoten hat eine ungültige Matrix.');
    return node.matrix;
  }
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  if (![tx, ty, tz, x, y, z, w, sx, sy, sz].every(Number.isFinite)) throw new ModelError('glTF: ein Knoten hat ungültige Werte für Verschiebung, Drehung oder Größe.');
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// ------------------------------------------------------------------ Bilder

function sniffMime(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return '';
}

/** Standard-Dekoder: Browser/Worker über createImageBitmap + OffscreenCanvas, Node über png.mjs (nur PNG). */
export async function defaultDecodeImage(bytes, mimeType) {
  const type = sniffMime(bytes) || mimeType || 'image/png';
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function') {
    const blob = new Blob([bytes], { type });
    const options = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
    let bitmap = await createImageBitmap(blob, options);
    if (bitmap.width * bitmap.height > MAX_TEXTURE_PIXELS) {
      const factor = Math.sqrt(MAX_TEXTURE_PIXELS / (bitmap.width * bitmap.height));
      const resizeWidth = Math.max(1, Math.floor(bitmap.width * factor));
      const resizeHeight = Math.max(1, Math.floor(bitmap.height * factor));
      bitmap.close();
      bitmap = await createImageBitmap(blob, { ...options, resizeWidth, resizeHeight, resizeQuality: 'medium' });
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const image = { width: bitmap.width, height: bitmap.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
    bitmap.close();
    return image;
  }
  if (globalThis.process?.versions?.node) {
    if (type !== 'image/png') throw new ModelError(`In Node können nur PNG-Texturen gelesen werden (diese ist ${type}).`);
    const { decodePng } = await import('../../../scripts/lib/png.mjs');
    return decodePng(bytes);
  }
  throw new ModelError('Bilder lassen sich in dieser Umgebung nicht dekodieren (createImageBitmap fehlt).');
}

// ------------------------------------------------------------------ Hauptfunktion

function primitiveTriangles(mode, indices, count) {
  const index = indices ? (i) => indices.values[i] : (i) => i;
  const total = indices ? indices.count : count;
  const out = [];
  if (mode === 4) {
    for (let i = 0; i + 2 < total; i += 3) out.push(index(i), index(i + 1), index(i + 2));
  } else if (mode === 5) {
    for (let i = 0; i + 2 < total; i++) {
      if (i % 2 === 0) out.push(index(i), index(i + 1), index(i + 2));
      else out.push(index(i + 1), index(i), index(i + 2));
    }
  } else if (mode === 6) {
    for (let i = 1; i + 1 < total; i++) out.push(index(0), index(i), index(i + 1));
  }
  return out;
}

/**
 * glTF/GLB-Bytes → Mesh (siehe mesh.js). Übliche Hochachse: y (glTF-Standard).
 * Optionen: format 'glb' | 'gltf' (sonst Erkennung an der Kennung), decodeImage(bytes, mimeType) → { width, height, data }.
 */
export async function parseGltf(input, { format = null, decodeImage = defaultDecodeImage } = {}) {
  const bytes = toBytes(input);
  const warnings = createWarnings();
  const isGlb = format === 'glb' || (format === null && bytes.length >= 4 && new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true) === GLB_MAGIC);
  const { json, bin } = isGlb ? readGlb(bytes) : { json: decodeText(bytes), bin: null };
  const gltf = parseJson(json);

  for (const name of gltf.extensionsRequired ?? []) {
    if (name === 'KHR_draco_mesh_compression' || name === 'EXT_meshopt_compression') {
      throw new ModelError(`Das Modell ist mit ${name === 'KHR_draco_mesh_compression' ? 'Draco' : 'Meshopt'} komprimiert – exportiere es ohne Kompression als .glb.`);
    }
    if (!SUPPORTED_REQUIRED.has(name)) throw new ModelError(`Das Modell braucht die glTF-Erweiterung „${String(name).slice(0, 60)}“, die nicht unterstützt wird.`);
  }
  if ((gltf.extensionsUsed ?? []).includes('KHR_texture_transform')) warnings.add('Textur-Verschiebungen (KHR_texture_transform) werden ignoriert.');

  const reader = createReader(gltf, bin);

  // Materialien: Farbe linear, Textur (Bild + Sampler) und genutzte TEXCOORD-Nummer
  const imageCache = new Map();
  const loadImage = async (imageIndex) => {
    if (imageCache.has(imageIndex)) return imageCache.get(imageIndex);
    const image = checkIndex(gltf.images, imageIndex, 'Bild');
    const { bytes: data, mimeType } = reader.imageBytes(image, imageIndex);
    let decoded;
    try {
      decoded = await decodeImage(data, image.mimeType ?? mimeType);
    } catch (error) {
      if (error instanceof ModelError) throw error;
      throw new ModelError(`Die Textur ${imageIndex} lässt sich nicht lesen (${error?.message ?? error}).`, { cause: error });
    }
    if (!decoded || !Number.isInteger(decoded.width) || !Number.isInteger(decoded.height) || decoded.width < 1 || decoded.height < 1
      || decoded.width > LIMITS.textureSide || decoded.height > LIMITS.textureSide || decoded.data?.length !== decoded.width * decoded.height * 4) {
      throw new ModelError(`Die Textur ${imageIndex} hat eine ungültige Größe (höchstens ${LIMITS.textureSide} Pixel je Seite).`);
    }
    imageCache.set(imageIndex, decoded);
    return decoded;
  };

  const textureOf = async (info) => {
    if (!info || info.index === undefined) return null;
    const texture = checkIndex(gltf.textures, info.index, 'Textur');
    const source = texture.extensions?.EXT_texture_webp?.source ?? texture.source;
    if (source === undefined) {
      warnings.add('Eine Textur hat kein lesbares Bild (z. B. KTX2/Basis) – dort gilt die Materialfarbe.');
      return null;
    }
    const image = await loadImage(source);
    const sampler = texture.sampler !== undefined ? checkIndex(gltf.samplers, texture.sampler, 'Sampler') : {};
    return {
      ...image,
      wrapS: WRAP[sampler.wrapS ?? 10497] ?? 'repeat',
      wrapT: WRAP[sampler.wrapT ?? 10497] ?? 'repeat',
      texCoord: Number.isInteger(info.texCoord) ? info.texCoord : 0,
    };
  };

  const materials = [];
  for (const [i, material] of (gltf.materials ?? []).entries()) {
    if (i >= LIMITS.materials) throw new ModelError(`Das Modell hat mehr als ${LIMITS.materials} Materialien.`, { code: 'limit' });
    const pbr = material.pbrMetallicRoughness ?? {};
    const specGloss = material.extensions?.KHR_materials_pbrSpecularGlossiness;
    const factor = pbr.baseColorFactor ?? specGloss?.diffuseFactor ?? [1, 1, 1, 1];
    if (!Array.isArray(factor) || factor.length < 3 || !factor.slice(0, 3).every(Number.isFinite)) throw new ModelError(`glTF: Material ${i} hat eine ungültige Farbe.`);
    let texture = null;
    try {
      texture = await textureOf(pbr.baseColorTexture ?? specGloss?.diffuseTexture);
    } catch (error) {
      if (!(error instanceof ModelError)) throw error;
      // Externe Bilder sind ein Fehler, kaputte nur eine Warnung
      if (error.message.includes(EXPORT_HINT)) throw error;
      warnings.add(`${error.message} Es gilt die Materialfarbe.`);
    }
    materials.push({ name: String(material.name ?? `Material ${i}`).slice(0, 80), color: factor.slice(0, 3).map((v) => Math.min(1, Math.max(0, v))), texture });
  }
  const defaultMaterial = materials.length;
  materials.push({ name: 'Standard', color: [...DEFAULT_COLOR], texture: null });
  // Texturiertes Material ohne Texturkoordinaten: Kopie ohne Textur (sonst würde UV (0, 0) abgetastet)
  const untextured = new Map();
  const untexturedCopy = (index) => {
    if (!untextured.has(index)) {
      untextured.set(index, materials.length);
      materials.push({ ...materials[index], texture: null });
    }
    return untextured.get(index);
  };

  // Szene durchlaufen
  const nodes = gltf.nodes ?? [];
  let roots;
  if (Array.isArray(gltf.scenes) && gltf.scenes.length > 0) {
    const scene = checkIndex(gltf.scenes, gltf.scene ?? 0, 'Szene');
    roots = scene.nodes ?? [];
  } else {
    const children = new Set(nodes.flatMap((node) => node.children ?? []));
    roots = nodes.map((_, i) => i).filter((i) => !children.has(i));
  }

  const builder = new MeshBuilder();
  let skippedModes = 0;
  let instances = 0;
  const visit = (index, parent, depth, path) => {
    if (depth > MAX_NODE_DEPTH) throw new ModelError('glTF: die Knoten sind zu tief verschachtelt.');
    if (path.has(index)) throw new ModelError('glTF: die Knoten bilden einen Kreis – die Datei ist beschädigt.');
    const node = checkIndex(nodes, index, 'Knoten');
    const world = multiply(parent, nodeMatrix(node));
    if (node.skin !== undefined) warnings.add('Skelett-Animationen (Skins) werden ignoriert – das Modell erscheint in der Grundhaltung.');
    if (node.mesh !== undefined) {
      instances++;
      const mesh = checkIndex(gltf.meshes, node.mesh, 'Mesh');
      if (mesh.weights || mesh.primitives?.some((p) => p.targets)) warnings.add('Morph-Ziele werden ignoriert.');
      for (const primitive of mesh.primitives ?? []) {
        const mode = primitive.mode ?? 4;
        if (mode < 4 || mode > 6) {
          skippedModes++;
          continue;
        }
        if (primitive.extensions?.KHR_draco_mesh_compression) throw new ModelError('Das Modell ist mit Draco komprimiert – exportiere es ohne Kompression als .glb.');
        if (primitive.attributes?.POSITION === undefined) throw new ModelError('glTF: ein Primitiv hat keine Positionen.');
        const position = reader.accessor(primitive.attributes.POSITION);
        if (position.n !== 3) throw new ModelError('glTF: Positionen müssen VEC3 sein.');
        const declared = primitive.material;
        if (declared !== undefined && !(Number.isInteger(declared) && declared >= 0 && declared < defaultMaterial)) {
          throw new ModelError(`glTF: Material ${declared} gibt es nicht.`);
        }
        let materialIndex = declared ?? defaultMaterial;
        const material = materials[materialIndex];
        const uvName = `TEXCOORD_${material.texture?.texCoord ?? 0}`;
        const uv = material.texture && primitive.attributes[uvName] !== undefined ? reader.accessor(primitive.attributes[uvName]) : null;
        if (material.texture && !uv) {
          warnings.add(`Ein texturiertes Primitiv hat keine Texturkoordinaten (${uvName}) – dort gilt die Materialfarbe.`);
          materialIndex = untexturedCopy(materialIndex);
        }
        if (uv && uv.n !== 2) throw new ModelError(`glTF: ${uvName} muss VEC2 sein.`);
        const color = primitive.attributes.COLOR_0 !== undefined ? reader.accessor(primitive.attributes.COLOR_0) : null;
        if (color && color.n !== 3 && color.n !== 4) throw new ModelError('glTF: COLOR_0 muss VEC3 oder VEC4 sein.');
        const indices = primitive.indices !== undefined ? reader.accessor(primitive.indices) : null;
        if (indices && indices.n !== 1) throw new ModelError('glTF: Indizes müssen SCALAR sein.');
        const triangles = primitiveTriangles(mode, indices, position.count);
        if (builder.count + triangles.length / 3 > LIMITS.triangles) {
          throw new ModelError(`Das Modell hat mehr als ${formatCount(LIMITS.triangles)} Dreiecke – vereinfache es (z. B. „Decimate“ in Blender).`, { code: 'limit' });
        }
        const point = (i) => {
          if (!(i >= 0 && i < position.count)) throw new ModelError('glTF: ein Index zeigt außerhalb der Positionen.');
          const x = position.values[i * 3], y = position.values[i * 3 + 1], z = position.values[i * 3 + 2];
          return [
            world[0] * x + world[4] * y + world[8] * z + world[12],
            world[1] * x + world[5] * y + world[9] * z + world[13],
            world[2] * x + world[6] * y + world[10] * z + world[14],
          ];
        };
        const uvAt = (i) => [uv.values[i * 2], uv.values[i * 2 + 1]];
        const colorAt = (i) => [color.values[i * color.n], color.values[i * color.n + 1], color.values[i * color.n + 2]];
        for (let t = 0; t < triangles.length; t += 3) {
          const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
          const p0 = point(a), p1 = point(b), p2 = point(c);
          if (![...p0, ...p1, ...p2].every(Number.isFinite)) continue;
          builder.add(p0, p1, p2, materialIndex, uv ? [uvAt(a), uvAt(b), uvAt(c)] : null, color ? [colorAt(a), colorAt(b), colorAt(c)] : null);
        }
      }
    }
    const next = new Set(path).add(index);
    for (const child of node.children ?? []) visit(child, world, depth + 1, next);
  };
  for (const root of roots) visit(root, IDENTITY, 0, new Set());

  if (skippedModes > 0) warnings.add('Punkte und Linien im glTF werden ignoriert.');
  if (instances === 0 || builder.count === 0) throw new ModelError('Das glTF-Modell enthält keine sichtbaren Dreiecke (keine Meshes in der Szene).');
  // Texturen ohne UV bringen nichts – das Mesh behält UV nur, wenn ein Material eine Textur hat (mesh.js)
  return builder.build({ materials, upAxis: 'y', warnings: warnings.list });
}
