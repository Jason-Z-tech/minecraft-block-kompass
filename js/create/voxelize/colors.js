// Farbabgleich Modellfarbe → Minecraft-Block (ARCHITEKTUR §12.3): CIELAB (D65) mit ΔE2000 gegen die mittleren
// Seitenfarben aus game-data/block-colors.json (scripts/build-block-colors.mjs). Rein, läuft in Browser, Worker und Node.

import { parseState } from '../../core/blockstate.js';

export const PALETTE_SETS = Object.freeze(['alle', 'beton', 'wolle', 'terrakotta', 'einfarbig']);
export const FACES = Object.freeze(['top', 'side', 'bottom', 'all']);
export const BLOCK_COLORS_FORMAT = 1;

// ------------------------------------------------------------------ sRGB ↔ linear ↔ CIELAB

const srgbChannelToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** sRGB-Kanal 0 … 255 → linear 0 … 1 (Tabelle). */
export const SRGB_TO_LINEAR = Float64Array.from({ length: 256 }, (_, i) => srgbChannelToLinear(i / 255));

/** Linearer Kanal 0 … 1 → sRGB 0 … 1 (ohne Rundung). */
export function linearToSrgb(v) {
  const c = v <= 0 ? 0 : v >= 1 ? 1 : v;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Linearer Kanal 0 … 1 → sRGB 0 … 255 (gerundet). */
export function linearToSrgb8(v) {
  return Math.round(linearToSrgb(v) * 255);
}

// Weißpunkt D65 (2°) und Matrix linear sRGB → XYZ (IEC 61966-2-1)
const WHITE = Object.freeze([0.95047, 1, 1.08883]);
const LAB_EPSILON = (6 / 29) ** 3;
const LAB_KAPPA = 1 / (3 * (6 / 29) ** 2);
const labF = (t) => (t > LAB_EPSILON ? Math.cbrt(t) : t * LAB_KAPPA + 4 / 29);

/** Lineares RGB (0 … 1) → CIELAB [L, a, b] (D65). */
export function linearToLab(r, g, b, out = new Array(3)) {
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0];
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2];
  const fx = labF(x), fy = labF(y), fz = labF(z);
  out[0] = 116 * fy - 16;
  out[1] = 500 * (fx - fy);
  out[2] = 200 * (fy - fz);
  return out;
}

/** sRGB [r, g, b] (0 … 255) → CIELAB [L, a, b]. */
export function srgbToLab(rgb) {
  return linearToLab(SRGB_TO_LINEAR[clampByte(rgb[0])], SRGB_TO_LINEAR[clampByte(rgb[1])], SRGB_TO_LINEAR[clampByte(rgb[2])]);
}

function clampByte(v) {
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

// ------------------------------------------------------------------ ΔE2000 (Sharma, Wu, Dalal 2005)

const DEG = Math.PI / 180;
const POW25_7 = 25 ** 7;

/**
 * Farbabstand CIEDE2000 zwischen zwei Lab-Farben. Optional die Gewichte kL, kC, kH (Bezugsbedingungen: 1).
 */
export function deltaE2000(lab1, lab2, kL = 1, kC = 1, kH = 1) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) / DEG + 360) % 360;
  const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) / DEG + 360) % 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG);
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
    else hbarp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbarp - 30) * DEG) + 0.24 * Math.cos(2 * hbarp * DEG)
    + 0.32 * Math.cos((3 * hbarp + 6) * DEG) - 0.2 * Math.cos((4 * hbarp - 63) * DEG);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7));
  const L50 = (Lbarp - 50) ** 2;
  const SL = 1 + (0.015 * L50) / Math.sqrt(20 + L50);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * DEG) * RC;
  const l = dLp / (kL * SL), c = dCp / (kC * SC), h = dHp / (kH * SH);
  return Math.sqrt(Math.max(0, l * l + c * c + h * h + RT * c * h));
}

// ------------------------------------------------------------------ Blockfarben vorbereiten

export const FACE_INDEX = Object.freeze({ top: 0, side: 1, bottom: 2, all: 3 });
// Gruppen, die im Set „alle“ fehlen (dazu fallende, leuchtende, sich verändernde und Sonderblöcke)
const EXCLUDED_GROUPS = new Set(['erz', 'sonder', 'technik', 'arbeitsblock']);
const SET_GROUPS = Object.freeze({ beton: 'beton', wolle: 'wolle', terrakotta: 'terrakotta' });
/** Gewicht der Musterstärke: unruhige Blöcke (Bücherregal, glasierte Terrakotta) werden leicht benachteiligt. */
export const PATTERN_WEIGHT = 0.1;
/**
 * Parametrische Faktoren für die Auswahl (ΔE2000 mit kL, kC, kH): Modellfarben sind oft viel kräftiger als jeder Block
 * (#FF0000 hat Chroma 105, roter Beton 53). Bei kräftigen Farben zählt der Farbton mehr als die Helligkeit:
 * kL = 1 + lightnessSlope · max(0, C* − chromaStart) / 100 (C* = Chroma der Modellfarbe), dazu kC und kH < 1.
 * Ruhige Farben (C* ≤ 30, z. B. Haut, Holz, Stein) werden mit kL = 1 verglichen.
 */
export const MATCH_WEIGHTS = Object.freeze({ lightnessSlope: 3, chromaStart: 30, kC: 0.85, kH: 0.75 });

/** kL für eine Modellfarbe (Lab) nach MATCH_WEIGHTS. */
export function lightnessWeight(lab) {
  const chroma = Math.hypot(lab[1], lab[2]);
  return 1 + (MATCH_WEIGHTS.lightnessSlope * Math.max(0, chroma - MATCH_WEIGHTS.chromaStart)) / 100;
}

/** Abstand für die Auswahl: ΔE2000 mit den Faktoren aus MATCH_WEIGHTS (Modellfarbe zuerst). */
export function matchDistance(lab, blockLab, kL = lightnessWeight(lab)) {
  return deltaE2000(lab, blockLab, kL, MATCH_WEIGHTS.kC, MATCH_WEIGHTS.kH);
}
// Vorauswahl über den einfachen Lab-Abstand, danach ΔE2000 nur für die besten Kandidaten
const PREFILTER = 32;
const ID_PATTERN = /^[a-z0-9_]{1,64}$/;

const prepared = new WeakMap();

function checkFace(value, where) {
  if (!value || !Array.isArray(value.rgb) || value.rgb.length !== 3 || !Array.isArray(value.lab) || value.lab.length !== 3
    || !value.lab.every(Number.isFinite) || !Number.isFinite(value.pattern)) {
    throw new Error(`Blockfarben: ${where} ist unvollständig – erzeuge sie neu mit node scripts/build-block-colors.mjs`);
  }
}

/** Gehört ein Eintrag zum Set „alle“? */
export function inAllSet(entry) {
  return !entry.falls && !entry.emissive && !entry.changes && !entry.special && !EXCLUDED_GROUPS.has(entry.group);
}

/**
 * Prüft den Inhalt von game-data/block-colors.json und baut daraus eine Suchstruktur (gecacht je Objekt):
 * { entries: [{ id, state, group, faces: [top, side, bottom, all], … }], byId: Map }.
 */
export function prepareBlockColors(json) {
  if (!json || typeof json !== 'object') throw new Error('Blockfarben fehlen – erzeuge sie mit node scripts/build-block-colors.mjs');
  let ready = prepared.get(json);
  if (ready) return ready;
  if (json.format !== BLOCK_COLORS_FORMAT || !json.blocks || typeof json.blocks !== 'object') {
    throw new Error(`Blockfarben haben ein unbekanntes Format (erwartet format ${BLOCK_COLORS_FORMAT}) – erzeuge sie neu mit node scripts/build-block-colors.mjs`);
  }
  const entries = [];
  for (const id of Object.keys(json.blocks).sort()) {
    const raw = json.blocks[id];
    if (!ID_PATTERN.test(id) || !raw || typeof raw.state !== 'string') throw new Error(`Blockfarben: Eintrag „${String(id).slice(0, 40)}“ ist ungültig.`);
    const faces = FACES.map((face) => {
      checkFace(raw[face], `${id}.${face}`);
      return Object.freeze({ rgb: raw[face].rgb, lab: raw[face].lab, pattern: raw[face].pattern });
    });
    entries.push(Object.freeze({
      id, state: raw.state, group: String(raw.group ?? ''), faces,
      falls: raw.falls === true, emissive: raw.emissive === true, changes: raw.changes === true, special: raw.special === true,
      animated: raw.animated === true, tinted: raw.tinted === true,
    }));
  }
  if (entries.length === 0) throw new Error('Blockfarben: die Liste ist leer – erzeuge sie neu mit node scripts/build-block-colors.mjs');
  ready = Object.freeze({ entries, byId: new Map(entries.map((entry) => [entry.id, entry])) });
  prepared.set(json, ready);
  return ready;
}

/** Block-ID aus „minecraft:red_wool“, „red_wool“ oder einem Zustand „oak_log[axis=y]“; sonst null. */
export function normalizeBlockId(block) {
  if (typeof block !== 'string' || block.length > 200) return null;
  try {
    return parseState(block.trim()).id;
  } catch {
    return null;
  }
}

/** Kandidaten eines Sets (Einträge aus prepareBlockColors); 'einfarbig' braucht block. Wirft bei leerem Set. */
export function blocksInSet(blockColors, set = 'alle', block = null) {
  const { entries, byId } = prepareBlockColors(blockColors);
  if (!PALETTE_SETS.includes(set)) throw new Error(`Unbekannte Palette „${String(set).slice(0, 40)}“ – erlaubt: ${PALETTE_SETS.join(', ')}.`);
  if (set === 'einfarbig') {
    const id = normalizeBlockId(block);
    if (!id) throw new Error('Für „einfarbig“ fehlt der Block (z. B. white_concrete).');
    const entry = byId.get(id);
    if (!entry) throw new Error(`„${id}“ ist kein voller, deckender Block aus der Farbliste – wähle z. B. white_concrete.`);
    return [entry];
  }
  const list = set === 'alle' ? entries.filter(inAllSet) : entries.filter((entry) => entry.group === SET_GROUPS[set]);
  if (list.length === 0) throw new Error(`Die Palette „${set}“ enthält keine Blöcke – erzeuge die Blockfarben neu.`);
  return list;
}

// Schnelle Näherung des Auswahl-Abstands für die Vorauswahl: dieselben Gewichte S_L, S_C, S_H und kL, kC, kH
// (ohne Farbton-Korrektur T und ohne Drehterm), gerechnet in Lab statt in a′-gestrecktem Lab.
function approximateDistance(a, b, kL) {
  const c1 = Math.hypot(a[1], a[2]), c2 = Math.hypot(b[1], b[2]);
  const dl = a[0] - b[0], dc = c1 - c2;
  const da = a[1] - b[1], db = a[2] - b[2];
  const dh2 = Math.max(0, da * da + db * db - dc * dc);
  const lMean = (a[0] + b[0]) / 2 - 50, cMean = (c1 + c2) / 2;
  const sl = kL * (1 + (0.015 * lMean * lMean) / Math.sqrt(20 + lMean * lMean));
  const sc = MATCH_WEIGHTS.kC * (1 + 0.045 * cMean), sh = MATCH_WEIGHTS.kH * (1 + 0.015 * cMean);
  return Math.sqrt((dl * dl) / (sl * sl) + (dc * dc) / (sc * sc) + dh2 / (sh * sh));
}

// Bester Kandidat für eine Lab-Farbe und Seite: kleinster Auswahl-Abstand (matchDistance) + patternWeight · Musterstärke.
function bestCandidate(candidates, lab, faceIndex, patternWeight) {
  const kL = lightnessWeight(lab);
  const pool = candidates.map((entry, index) => {
    const face = entry.faces[faceIndex];
    return { index, d: approximateDistance(lab, face.lab, kL) + patternWeight * face.pattern };
  });
  if (pool.length > PREFILTER) {
    pool.sort((a, b) => a.d - b.d || a.index - b.index);
    pool.length = PREFILTER;
  }
  let best = null;
  for (const { index } of pool) {
    const face = candidates[index].faces[faceIndex];
    const score = matchDistance(lab, face.lab, kL) + patternWeight * face.pattern;
    if (!best || score < best.score || (score === best.score && index < best.index)) best = { index, score };
  }
  return best;
}

/** Exakte Suche ohne Vorauswahl (für Tests und Vergleiche); deltaE = echtes ΔE2000 (kL = kC = kH = 1). */
export function nearestBlockExhaustive(rgb, { set = 'alle', face = 'all', blockColors, block = null, patternWeight = PATTERN_WEIGHT } = {}) {
  const candidates = blocksInSet(blockColors, set, block);
  const lab = srgbToLab(rgb);
  const kL = lightnessWeight(lab);
  const faceIndex = FACE_INDEX[face];
  let best = null;
  candidates.forEach((entry, index) => {
    const faceData = entry.faces[faceIndex];
    const score = matchDistance(lab, faceData.lab, kL) + patternWeight * faceData.pattern;
    if (!best || score < best.score) best = { index, id: entry.id, state: entry.state, score, faceLab: faceData.lab };
  });
  const { faceLab, ...result } = best;
  return { ...result, deltaE: deltaE2000(lab, faceLab) };
}

/**
 * Nächster Block zu einer sRGB-Farbe [r, g, b] (0 … 255).
 * Optionen: set ('alle' | 'beton' | 'wolle' | 'terrakotta' | 'einfarbig'), face ('top' | 'side' | 'bottom' | 'all'),
 * blockColors (Inhalt von block-colors.json), block (nur bei 'einfarbig'), patternWeight.
 * Rückgabe { id, state, deltaE, score } (über den Cache des Matchers, Farbe auf 6 Bit je Kanal gerundet):
 * deltaE = echtes ΔE2000 zum gewählten Block, score = Auswahl-Abstand (MATCH_WEIGHTS) + patternWeight · Musterstärke.
 */
export function nearestBlock(rgb, { set = 'alle', face = 'all', blockColors, block = null, patternWeight = PATTERN_WEIGHT } = {}) {
  if (!Array.isArray(rgb) || rgb.length < 3 || !rgb.slice(0, 3).every(Number.isFinite)) throw new Error('nearestBlock braucht eine Farbe [r, g, b] mit Werten 0 … 255.');
  if (!Object.hasOwn(FACE_INDEX, face)) throw new Error(`Unbekannte Seite „${String(face).slice(0, 20)}“ – erlaubt: ${FACES.join(', ')}.`);
  const matcher = createColorMatcher({ blockColors, set, block, patternWeight });
  const entry = matcher.candidates[matcher.match(rgb[0], rgb[1], rgb[2], FACE_INDEX[face])];
  const faceData = entry.faces[FACE_INDEX[face]];
  const lab = srgbToLab(rgb);
  return {
    id: entry.id, state: entry.state, deltaE: deltaE2000(lab, faceData.lab),
    score: matchDistance(lab, faceData.lab) + patternWeight * faceData.pattern,
  };
}

// Farben werden für den Cache auf 6 Bit je Kanal gerundet (höchstens 2 Stufen Abweichung).
const QUANT_BITS = 6;
const QUANT_SIZE = 1 << (QUANT_BITS * 3);
const matcherCache = new WeakMap();

/**
 * Schneller Abgleich für viele Voxel: match(r, g, b, faceIndex) → Index in candidates, gecacht je gerundeter Farbe
 * und Seite (faceIndex 0 oben, 1 seitlich, 2 unten, 3 alle). Matcher werden je Blockfarben-Objekt und Set gecacht.
 */
export function createColorMatcher({ blockColors, set = 'alle', block = null, patternWeight = PATTERN_WEIGHT } = {}) {
  const candidates = blocksInSet(blockColors, set, block);
  if (!(Number.isFinite(patternWeight) && patternWeight >= 0)) throw new Error('patternWeight muss eine Zahl ≥ 0 sein.');
  const key = `${set}|${set === 'einfarbig' ? candidates[0].id : ''}|${patternWeight}`;
  let perJson = matcherCache.get(blockColors);
  if (!perJson) {
    perJson = new Map();
    matcherCache.set(blockColors, perJson);
  }
  const cached = perJson.get(key);
  if (cached) return cached;
  let table = null;
  const shift = 8 - QUANT_BITS;
  const half = 1 << (shift - 1);
  const lab = [0, 0, 0];
  const matcher = Object.freeze({
    candidates,
    set,
    match(r, g, b, faceIndex = 3) {
      if (candidates.length === 1) return 0;
      const qr = clampByte(r) >> shift, qg = clampByte(g) >> shift, qb = clampByte(b) >> shift;
      const slot = ((((qr << QUANT_BITS) | qg) << QUANT_BITS) | qb) * 4 + faceIndex;
      if (!table) table = new Int16Array(QUANT_SIZE * 4).fill(-1);
      let index = table[slot];
      if (index < 0) {
        linearToLab(SRGB_TO_LINEAR[(qr << shift) | half], SRGB_TO_LINEAR[(qg << shift) | half], SRGB_TO_LINEAR[(qb << shift) | half], lab);
        index = bestCandidate(candidates, lab, faceIndex, patternWeight).index;
        table[slot] = index;
      }
      return index;
    },
  });
  perJson.set(key, matcher);
  return matcher;
}
