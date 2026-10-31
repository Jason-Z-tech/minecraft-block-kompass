// Render-Seite für Vorschaubilder (scripts/make-thumbs.mjs): eine 3D-Ansicht für alle Bilder.
// Node ruft window.__thumb.render(job) auf und bekommt das Bild als WebP (Base64) zurück.
// Die Kamera-Helfer sind rein und in Node testbar; der DOM-Teil startet nur im Browser.

import { Viewer, ORBIT_FOV, fitOrbitDistance } from '../../js/render/renderer.js';
import { isCommunityFile } from '../../js/data/community.js';
import { checkCrop } from '../../js/render/engine-worker.js';

export const THUMB_WIDTH = 640;
export const THUMB_HEIGHT = 400;
export const THUMB_QUALITY = 0.86;
const DEG = Math.PI / 180;
const ISO = Object.freeze({ yaw: 35, pitch: 28 });

// Kamera-Einstellung je Bau aus data/thumbs/views.json (für Bauten, die die Automatik schlecht trifft)
export const VIEW_KEYS = Object.freeze(['yaw', 'pitch', 'zoom', 'target', 'cut']);
export const VIEW_PITCH_LIMIT = 89;
export const VIEW_ZOOM_RANGE = Object.freeze([0.25, 8]);

/**
 * Prüft eine Kamera-Einstellung { yaw, pitch, zoom, target, cut } (alle Felder optional, mindestens eins):
 * yaw/pitch in Grad wie thumbAngles (ersetzen die Automatik), zoom = wie viel näher als „Bau füllt das Bild“,
 * target = Blickpunkt [x, y, z] in Block-Koordinaten (null = Achse automatisch), cut = Schnitt
 * { minX, maxX, minY, maxY, minZ, maxZ } (Blöcke außerhalb fehlen, z. B. eine Decke). → bereinigte Kopie in fester
 * Feldreihenfolge (geht so in den Hash von make-thumbs ein); wirft bei unbekannten Feldern oder Werten.
 */
export function validateView(view) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) throw new Error('Kamera-Einstellung muss ein Objekt sein.');
  const unknown = Object.keys(view).filter((key) => !VIEW_KEYS.includes(key));
  if (unknown.length) throw new Error(`Unbekanntes Feld ${unknown.slice(0, 3).join(', ').slice(0, 80)} (erlaubt: ${VIEW_KEYS.join(', ')}).`);
  const clean = {};
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  if (view.yaw !== undefined) {
    if (!finite(view.yaw)) throw new Error('yaw muss eine Zahl (Grad) sein.');
    clean.yaw = ((view.yaw % 360) + 360) % 360;
  }
  if (view.pitch !== undefined) {
    if (!finite(view.pitch) || Math.abs(view.pitch) > VIEW_PITCH_LIMIT) throw new Error(`pitch muss eine Zahl von −${VIEW_PITCH_LIMIT} bis ${VIEW_PITCH_LIMIT} (Grad) sein.`);
    clean.pitch = view.pitch;
  }
  if (view.zoom !== undefined) {
    if (!finite(view.zoom) || view.zoom < VIEW_ZOOM_RANGE[0] || view.zoom > VIEW_ZOOM_RANGE[1]) throw new Error(`zoom muss eine Zahl von ${VIEW_ZOOM_RANGE[0]} bis ${VIEW_ZOOM_RANGE[1]} sein.`);
    clean.zoom = view.zoom;
  }
  if (view.target !== undefined) {
    const t = view.target;
    if (!Array.isArray(t) || t.length !== 3 || !t.every((v) => v === null || finite(v)) || t.every((v) => v === null)) {
      throw new Error('target muss [x, y, z] sein (Zahlen, null = automatisch, mindestens eine Zahl).');
    }
    clean.target = [...t];
  }
  if (view.cut !== undefined) {
    try {
      clean.cut = checkCrop(view.cut);
    } catch (error) {
      throw new Error(`cut: ${error.message.replace(/^Schnitt:\s*/, '')}`);
    }
  }
  if (!Object.keys(clean).length) throw new Error('Kamera-Einstellung ohne Feld.');
  return clean;
}

/**
 * Blickwinkel für das Vorschaubild (Grad, yaw 0 = Kamera im Süden): Iso wie die 3D-Ansicht; lange Bauten von ihrer
 * Längsseite (sehr lange fast genau von der Seite und flacher), hohe Bauten flacher, flache Bauten steiler von oben.
 * view (geprüft, siehe validateView): yaw bzw. pitch ersetzen die Automatik.
 */
export function thumbAngles(bounds, scores = null, view = null) {
  const [w, h, l] = [0, 1, 2].map((a) => bounds.max[a] - bounds.min[a]);
  const horizontal = Math.max(w, l, 1);
  const ratio = Math.max(w, l) / Math.max(1, Math.min(w, l));
  let { yaw, pitch } = ISO;
  if (w >= 2.2 * l) yaw = ratio >= 4 ? 10 : 22;
  else if (l >= 2.2 * w) yaw = ratio >= 4 ? 80 : 68;
  if (h >= 1.5 * horizontal) pitch = 12;
  else if (ratio >= 4) pitch = 22;
  else if (h <= 0.2 * horizontal) pitch = 42;
  if (view?.pitch !== undefined) pitch = view.pitch;
  if (view?.yaw !== undefined) return { yaw: view.yaw, pitch };
  return { yaw: scores ? pickYaw(yaw, scores) : yaw, pitch };
}

/** Gespiegelte Varianten des Grundwinkels (gleiche Ansicht von den anderen Ecken); bei langen Bauten nur die Längsseiten. */
export function yawCandidates(baseYaw) {
  const mirrored = [baseYaw, 180 - baseYaw, 180 + baseYaw, 360 - baseYaw];
  // Iso-Winkel (nicht lange Bauten): auch die um die Diagonale gespiegelten Winkel (35° ↔ 55°)
  const swapped = Math.abs(baseYaw - 45) < 20 ? [90 - baseYaw, 90 + baseYaw, 270 - baseYaw, 270 + baseYaw] : [];
  return [...new Set([...mirrored, ...swapped].map((y) => ((y % 360) + 360) % 360))];
}

/**
 * Wählt die Ecke, von der aus die abwechslungsreichsten Seiten zu sehen sind (scores je Himmelsrichtung, z. B. aus
 * sideScores). Der Grundwinkel bleibt, solange keine andere Ecke mindestens 15 % besser ist.
 */
export function pickYaw(baseYaw, scores) {
  const value = (yaw) => {
    const s = Math.sin(yaw * DEG), c = Math.cos(yaw * DEG);
    return Math.max(0, s) * scores.east + Math.max(0, -s) * scores.west + Math.max(0, c) * scores.south + Math.max(0, -c) * scores.north;
  };
  const base = value(baseYaw);
  let best = baseYaw, bestValue = base;
  for (const yaw of yawCandidates(baseYaw)) {
    const v = value(yaw);
    if (v > bestValue) { best = yaw; bestValue = v; }
  }
  return bestValue > base * 1.15 ? best : baseYaw;
}

const idOf = (state) => {
  const i = state.indexOf('[');
  return i < 0 ? state : state.slice(0, i);
};

/**
 * Abwechslung je Seite: Für jede Seite der zuerst sichtbare Block jeder Spalte (Stichprobe bei großen Bauten); gezählt
 * wird, wie viele davon nicht der häufigste Block der Seite sind (hochgerechnet auf die ganze Fläche).
 * volume braucht bounds ({ min, max } inklusiv) und get(x, y, z). → { north, east, south, west }
 */
export function sideScores(volume, { maxColumns = 40000 } = {}) {
  const b = volume.bounds;
  if (!b) return { north: 0, east: 0, south: 0, west: 0 };
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, l = z1 - z0 + 1;
  const scan = (uCount, depth, cellAt) => {
    const step = Math.max(1, Math.ceil(Math.sqrt((uCount * h) / maxColumns)));
    const counts = new Map();
    let total = 0;
    // Je Zeile versetzt abtasten, damit regelmäßige Muster (z. B. jede zweite Spalte) nicht durchrutschen
    for (let v = 0, row = 0; v < h; v += step, row++) {
      for (let u = (row * 5) % step; u < uCount; u += step) {
        for (let d = 0; d < depth; d++) {
          const state = cellAt(u, v, d);
          if (state === 'air') continue;
          const id = idOf(state);
          counts.set(id, (counts.get(id) ?? 0) + 1);
          total++;
          break;
        }
      }
    }
    const top = counts.size ? Math.max(...counts.values()) : 0;
    return (total - top) * step * step;
  };
  return {
    north: scan(w, l, (u, v, d) => volume.get(x0 + u, y0 + v, z0 + d)),
    south: scan(w, l, (u, v, d) => volume.get(x0 + u, y0 + v, z1 - d)),
    west: scan(l, w, (u, v, d) => volume.get(x0 + d, y0 + v, z0 + u)),
    east: scan(l, w, (u, v, d) => volume.get(x1 - d, y0 + v, z0 + u)),
  };
}

function cameraBasis(yaw, pitch) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return { right: [cy, 0, -sy], up: [-sp * sy, cp, -sp * cy], forward: [-cp * sy, -sp, -cp * cy] };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Orbit-Einstellung, bei der die Box das Bild füllt (margin = Rand je Seite als Anteil) und mittig sitzt.
 * bounds = { min, max, center } wie Viewer.bounds. view (geprüft): eigene Winkel, danach Blickpunkt (target) und
 * zoom (Abstand geteilt durch zoom). → { target, distance, yaw, pitch } (Bogenmaß)
 */
export function thumbOrbit(bounds, aspect, { fovY = ORBIT_FOV, margin = 0.07, scores = null, view = null } = {}) {
  const angles = thumbAngles(bounds, scores, view);
  const yaw = angles.yaw * DEG, pitch = angles.pitch * DEG;
  const { right, up, forward } = cameraBasis(yaw, pitch);
  const tanY = Math.tan(fovY / 2), tanX = tanY * aspect;
  const target = [...bounds.center];
  let distance = fitOrbitDistance(bounds, yaw, pitch, fovY, aspect, margin, target);
  // Mit Perspektive liegt die Boxmitte nicht in der Bildmitte: Ziel ein paarmal nachschieben und neu einpassen
  for (let i = 0; i < 6; i++) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let c = 0; c < 8; c++) {
      const corner = [0, 1, 2].map((a) => ((c >> a) & 1 ? bounds.max[a] : bounds.min[a]) - target[a]);
      const depth = distance + dot(corner, forward);
      const px = dot(corner, right) / (depth * tanX), py = dot(corner, up) / (depth * tanY);
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const shiftX = ((x0 + x1) / 2) * tanX * distance, shiftY = ((y0 + y1) / 2) * tanY * distance;
    for (let a = 0; a < 3; a++) target[a] += right[a] * shiftX + up[a] * shiftY;
    distance = fitOrbitDistance(bounds, yaw, pitch, fovY, aspect, margin, target);
  }
  if (view?.target) view.target.forEach((value, a) => { if (value !== null) target[a] = value; });
  if (view?.zoom !== undefined) distance /= view.zoom;
  return { target, distance, yaw, pitch };
}

/** Prüft einen Auftrag aus Node (nur bekannte Quellen und Felder; view = Kamera-Einstellung oder null). */
export function validateJob(job) {
  if (!job || typeof job !== 'object') throw new Error('Auftrag fehlt.');
  const { source, scale = null } = job;
  if (scale !== null && !(typeof scale === 'number' && Number.isFinite(scale) && scale > 0)) throw new Error('Ungültiger Maßstab.');
  const view = job.view === undefined || job.view === null ? null : validateView(job.view);
  if (source?.kind === 'module') {
    if (typeof source.path !== 'string' || !/^(js\/builds|tests\/fixtures)\/[a-z0-9/-]+\.js$/.test(source.path)) throw new Error(`Ungültiger Modulpfad „${String(source.path).slice(0, 80)}“.`);
    return { source: { kind: 'module', path: source.path }, scale, view };
  }
  // Community-Bau (data/community/<datei>): nur ein Dateiname, ohne Maßstab
  if (source?.kind === 'community') {
    if (!isCommunityFile(source.file)) throw new Error(`Ungültiger Community-Bau „${String(source.file).slice(0, 80)}“.`);
    if (scale !== null) throw new Error('Community-Bauten haben keinen Maßstab.');
    return { source: { kind: 'community', file: source.file }, scale, view };
  }
  throw new Error('Quelle muss { kind: "module", path } oder { kind: "community", file } sein.');
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// Gerendert wird in doppelter Auflösung und dann verkleinert (glatte Kanten).
async function toWebp(pngBlob) {
  const bitmap = await createImageBitmap(pngBlob);
  try {
    const canvas = new OffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    const webp = await canvas.convertToBlob({ type: 'image/webp', quality: THUMB_QUALITY });
    if (webp.type !== 'image/webp') throw new Error(`Der Browser kann kein WebP schreiben (Ergebnis ${webp.type}).`);
    return webp;
  } finally {
    bitmap.close();
  }
}

function startPage() {
  const canvas = document.getElementById('thumb-canvas');
  document.documentElement.style.background = '#15171b';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  canvas.style.display = 'block';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  const state = { ready: false, error: null, renderer: null, render: null };
  window.__thumb = state;
  let viewer;
  try {
    viewer = new Viewer(canvas, { antialias: true, onStatus: (s) => { if (s.state === 'error') console.error(`Vorschaubild: ${s.message}`); } });
  } catch (error) {
    state.error = error.message;
    console.error(error);
    return;
  }
  const gl = canvas.getContext('webgl2');
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  state.renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  let queue = Promise.resolve();
  state.render = (job) => {
    const run = queue.then(() => renderJob(viewer, canvas, job));
    queue = run.catch(() => {});
    return run;
  };
  state.ready = true;
}

async function renderJob(viewer, canvas, job) {
  const started = performance.now();
  try {
    const { source, scale, view } = validateJob(job);
    await viewer.load(source, scale === null ? {} : { scale }, { crop: view?.cut ?? null });
    viewer.setProgress(viewer.stepCount);
    viewer.setClip(null);
    viewer.setGhost(false);
    viewer.setHighlightStep(null);
    const scores = sideScores(viewer.result.volume);
    const orbit = thumbOrbit(viewer.bounds, canvas.width / canvas.height, { scores, view });
    viewer.controls.orbit.setView(orbit, { animate: false });
    await viewer.idle();
    await nextFrame();
    await nextFrame();
    const webp = await toWebp(await viewer.screenshot());
    const stats = viewer.stats;
    return {
      ok: true,
      data: await blobToBase64(webp),
      bytes: webp.size,
      canvas: [canvas.width, canvas.height],
      blocks: stats.blocks,
      missingTextures: stats.missingTextures,
      warnings: stats.warnings,
      // Zum Einstellen der Kamera (views.json): Box des gezeigten Baus und die benutzte Kamera (Grad)
      bounds: viewer.result.volume.bounds,
      camera: { yaw: orbit.yaw / DEG, pitch: orbit.pitch / DEG, target: orbit.target, distance: orbit.distance },
      ms: Math.round(performance.now() - started),
    };
  } catch (error) {
    console.error(error);
    return { ok: false, error: error.message ?? String(error), ms: Math.round(performance.now() - started) };
  }
}

if (typeof document !== 'undefined' && document.getElementById('thumb-canvas')) startPage();
