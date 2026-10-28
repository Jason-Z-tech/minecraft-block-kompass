// 3D-Ansicht (ARCHITEKTUR §7.4): Viewer-Klasse auf WebGL2. Bauen und Meshen laufen im Modul-Worker
// engine-worker.js; der Hauptthread hält eine Kopie des Volumens für Picking, Laufen und den Ebenen-Plan.
// Zeichnet Himmel, Chunks (deckend → cutout → Bodenraster → durchscheinend nach Abstand sortiert), den
// laufenden Schritt mit Plopp-Animation, Schnitt-Deckflächen, Geist-Blöcke und die Hervorhebung eines Schritts.

import { mat4, frustumPlanes, aabbInFrustum } from './mat.js';
import { OrbitControls, WalkControls, lookVector, DEG } from './controls.js';
import { raycastBlocks, rayFromScreen } from './picking.js';
import { TextureStore } from './texture-store.js';
import { loadGameTextures, onGameDataProgress, toGameDataError } from '../data/game-data.js';
import { createQuadIndices, VERTEX_BYTES } from './mesher.js';
import { BlockVolume, chunkKey } from '../core/volume.js';
import {
  ATTRIBUTES, MESH_KIND, PASS, BLOCK_VERTEX, blockFragment, SKY_VERTEX, SKY_FRAGMENT, GRID_VERTEX, GRID_FRAGMENT,
  LINE_VERTEX, LINE_FRAGMENT, createProgram,
} from './shaders.js';

export const VIEWS = Object.freeze(['iso', 'top', 'front', 'side']);
export const MODES = Object.freeze(['orbit', 'walk']);
export const ORBIT_FOV = 45 * DEG;
export const WALK_FOV = 70 * DEG;
const MAX_PIXEL_RATIO = 2;
// Kantenglättung (4× MSAA) bei antialias 'auto' nur bis zu dieser Zahl an Bildpunkten der Canvas
const MSAA_MAX_PIXELS = 1_500_000;
const MSAA_SAMPLES = 4;
const STEP_CACHE = 4;
const CAP_CACHE = 3;
const PROGRESS_STEP_MS = 900;
const STEP_WAIT_MS = 600;
const WALK_REACH = 6;
// Farben (sRGB 0 … 1): Himmel von Zenit über Horizont zum Boden, Rasterlinien
const SKY = Object.freeze({ zenith: [0.23, 0.35, 0.51], horizon: [0.66, 0.75, 0.83], nadir: [0.36, 0.39, 0.44] });
const GRID_LINE = Object.freeze([0.13, 0.16, 0.2]);
const OUTLINE_COLOR = Object.freeze([0.04, 0.05, 0.06, 0.7]);
const FACE_COLOR = Object.freeze([1, 1, 1, 0.16]);
const GROUND_BOX = Object.freeze([Object.freeze([0, 0, 0, 1, 1, 1])]);
const VIEW_ANGLES = Object.freeze({ iso: [35, 28], top: [0, 89.9], front: [0, 6], side: [90, 6] });

export class ViewerError extends Error {
  // title: eigener Titel für die Anzeige (z. B. „Keine Verbindung zu GitHub“ bei code 'data'), sonst null
  constructor(code, message, { detail = null, title = null } = {}) {
    super(message);
    this.name = 'ViewerError';
    this.code = code;
    this.detail = detail;
    this.title = typeof title === 'string' && title !== '' ? title : null;
  }
}

// ------------------------------------------------------------------ Reine Helfer (in Node testbar)

/** Fortschritt p (Schritt als Kommazahl) → { cur, frac } mit 0 ≤ cur ≤ stepCount. */
export function splitProgress(p, stepCount) {
  const clamped = Math.min(stepCount, Math.max(0, p));
  const cur = Math.min(stepCount, Math.floor(clamped));
  return { cur, frac: cur >= stepCount ? 0 : clamped - cur };
}

/** Ist ein Block mit diesem Schritt beim Fortschritt (cur, frac) schon (teilweise) gesetzt? */
export function isStepShown(step, cur, frac) {
  return step < cur || (step === cur && frac > 0);
}

/** Begrenzungsbox aus volume.bounds (inklusiv) → { min, max (exklusiv), center, radius }. */
export function sceneBounds(volumeBounds) {
  if (!volumeBounds) return { min: [0, 0, 0], max: [1, 1, 1], center: [0.5, 0.5, 0.5], radius: 1, empty: true };
  const min = [...volumeBounds.min];
  const max = volumeBounds.max.map((v) => v + 1);
  const center = min.map((v, i) => (v + max[i]) / 2);
  const radius = Math.max(1, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
  return { min, max, center, radius, empty: false };
}

function cameraBasis(yaw, pitch) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  return { right: [cy, 0, -sy], up: [-sp * sy, cp, -sp * cy], forward: [-cp * sy, -sp, -cp * cy] };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function boxCorners(bounds, target) {
  return Array.from({ length: 8 }, (_, i) => [0, 1, 2].map((a) => ((i >> a) & 1 ? bounds.max[a] : bounds.min[a]) - target[a]));
}

/**
 * Abstand, bei dem alle 8 Ecken der Box für die Blickrichtung (yaw/pitch wie OrbitControls) ins Bild passen,
 * gesehen auf target (Standard: Mitte der Box). margin = Rand als Anteil (0,06 = 6 %).
 */
export function fitOrbitDistance(bounds, yaw, pitch, fovY, aspect, margin = 0.06, target = bounds.center) {
  const { right, up, forward } = cameraBasis(yaw, pitch);
  const tanY = Math.tan(fovY / 2) * (1 - margin);
  const tanX = Math.tan(fovY / 2) * aspect * (1 - margin);
  let distance = 0;
  for (const c of boxCorners(bounds, target)) {
    const z = dot(c, forward);
    distance = Math.max(distance, Math.abs(dot(c, right)) / tanX - z, Math.abs(dot(c, up)) / tanY - z);
  }
  return Math.max(distance, bounds.radius * 0.5, 2);
}

// Bildbereich (in NDC) der Ecken entlang einer Bildachse, wenn das Ziel um offset entlang dieser Achse verschoben ist.
function projectedSpan(corners, axis, forward, distance, offset, tan) {
  let lo = Infinity, hi = -Infinity;
  for (const c of corners) {
    const p = (dot(c, axis) - offset) / ((distance + dot(c, forward)) * tan);
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  return [lo, hi];
}

// Verschiebung, bei der die Ecken mittig liegen (lo + hi = 0; die Summe fällt mit wachsendem offset → Bisektion).
function centeringOffset(corners, axis, forward, distance, tan, range) {
  let a = -range, b = range;
  for (let i = 0; i < 48; i++) {
    const m = (a + b) / 2;
    const [lo, hi] = projectedSpan(corners, axis, forward, distance, m, tan);
    if (lo + hi > 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/**
 * Orbit-Einstellung einer Ansicht (iso, top, front, side) für die Box: kleinster Abstand, bei dem die Box mit
 * margin Rand ins Bild passt, und das Ziel so verschoben, dass sie mittig sitzt (mit Perspektive läge die
 * Boxmitte sonst unterhalb der Bildmitte).
 */
export function orbitForView(view, bounds, aspect, fovY = ORBIT_FOV, margin = 0.06) {
  if (!Object.hasOwn(VIEW_ANGLES, view)) throw new ViewerError('argument', `Unbekannte Ansicht „${view}“ (erlaubt: ${VIEWS.join(', ')}).`);
  const [yawDeg, pitchDeg] = VIEW_ANGLES[view];
  const yaw = yawDeg * DEG, pitch = pitchDeg * DEG;
  const { right, up, forward } = cameraBasis(yaw, pitch);
  const tanY = Math.tan(fovY / 2), tanX = tanY * aspect;
  const corners = boxCorners(bounds, bounds.center);
  // Die mittige Verschiebung liegt immer zwischen den Ecken, also innerhalb des Radius
  const range = bounds.radius * 1.5;
  const fit = (distance) => {
    const x = centeringOffset(corners, right, forward, distance, tanX, range);
    const y = centeringOffset(corners, up, forward, distance, tanY, range);
    const [x0, x1] = projectedSpan(corners, right, forward, distance, x, tanX);
    const [y0, y1] = projectedSpan(corners, up, forward, distance, y, tanY);
    return { x, y, extentX: (x1 - x0) / 2, extentY: (y1 - y0) / 2 };
  };
  // Alle Ecken vor der Kamera: Abstand größer als die größte Tiefe nach vorne
  let near = Math.max(...corners.map((c) => -dot(c, forward))) + bounds.radius * 0.05 + 0.5;
  let far = Math.max(near * 2, fitOrbitDistance(bounds, yaw, pitch, fovY, aspect, margin) * 2);
  const fits = (distance) => {
    const f = fit(distance);
    return Math.max(f.extentX, f.extentY) <= 1 - margin;
  };
  while (!fits(far)) far *= 2;
  if (fits(near)) far = near;
  for (let i = 0; i < 40 && far - near > 1e-4 * far; i++) {
    const m = (near + far) / 2;
    if (fits(m)) far = m;
    else near = m;
  }
  const distance = far;
  const { x, y } = fit(distance);
  return {
    target: [0, 1, 2].map((a) => bounds.center[a] + right[a] * x + up[a] * y),
    distance,
    yaw,
    pitch,
    minDistance: Math.max(0.5, bounds.radius * 0.03),
    maxDistance: bounds.radius * 14 + 96,
  };
}

// Schnittpunkt Strahl/Box (Slab-Test): [tEin, tAus] oder null.
function rayBox(origin, dir, min, max) {
  let t0 = 0, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-12) {
      if (origin[a] < min[a] || origin[a] > max[a]) return null;
      continue;
    }
    let near = (min[a] - origin[a]) / dir[a], far = (max[a] - origin[a]) / dir[a];
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

// ------------------------------------------------------------------ Gemeinsame Texturen

let sharedStore = null;

/**
 * Texturen der Seite (einmal je Seite, geteilt mit den Block-Icons in js/ui/build/appearance.js): lokal aus
 * game-data/, online aus den Atlanten von misode/mcmeta (js/data/game-data.js). Fehler werden nicht behalten.
 */
export function loadTextureStore() {
  if (!sharedStore) {
    sharedStore = loadGameTextures().then((source) => TextureStore.fromSource(source));
    sharedStore.catch(() => { sharedStore = null; });
  }
  return sharedStore;
}

// Fehler der Spieldaten (Laden der Texturen oder Atlasbilder) erkennen; sie bekommen eine menschliche Meldung
function isGameDataFailure(error) {
  return error?.name === 'GameDataError' || error?.name === 'TextureSourceError';
}

// Statische Linien/Flächen: 12 Würfelkanten (24 Punkte), 6 Seiten (je 6 Punkte), Fadenkreuz (3 Rechtecke).
const FACE_ORDER = ['down', 'up', 'north', 'south', 'west', 'east'];

function lineGeometry() {
  const points = [];
  const corner = (i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1];
  for (let a = 0; a < 8; a++) {
    for (let b = a + 1; b < 8; b++) {
      const diff = a ^ b;
      if (diff === 1 || diff === 2 || diff === 4) points.push(...corner(a), ...corner(b));
    }
  }
  const quad = (p0, p1, p2, p3) => points.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  quad([0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]); // down
  quad([0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]); // up
  quad([0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]); // north
  quad([0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]); // south
  quad([0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]); // west
  quad([1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]); // east
  // Fadenkreuz in Pixeln (Mitte frei, damit sich das Invertieren nicht aufhebt)
  quad([-9, -1, 0], [9, -1, 0], [9, 1, 0], [-9, 1, 0]);
  quad([-1, 1, 0], [1, 1, 0], [1, 9, 0], [-1, 9, 0]);
  quad([-1, -9, 0], [1, -9, 0], [1, -1, 0], [-1, -1, 0]);
  return new Float32Array(points);
}

const LINE_GEOMETRY = lineGeometry();
const EDGE_VERTICES = 24;
const FACE_FIRST = 24;
const CROSSHAIR_FIRST = 24 + 36;

// ------------------------------------------------------------------ Viewer

/**
 * const viewer = new Viewer(canvas, { onPick, onHover, onStatus, onProgress, onModeChange, overlayParent })
 * await viewer.load(source, params) · setProgress(p, { animate }) · setClip({ minY, maxY } | null) · setGhost(bool)
 * setHighlightStep(index | null) · setMode('orbit' | 'walk') · setView('iso' | 'top' | 'front' | 'side') · screenshot() · dispose()
 */
export class Viewer {
  #canvas;
  #gl;
  #options;
  #worker = null;
  #job = 0;
  #pending = null;
  #readyWaiter = null;
  #store = null;
  #texturesReady = false;
  #textureBound = false;
  #programs = null;
  #indexBuffer = null;
  #indexCapacity = 0;
  #skyVao = null;
  #gridVao = null;
  #gridBuffer = null;
  #lineVao = null;
  #lineBuffer = null;
  #msaa = null;
  #msaaSamples = 0;
  #msaaChecked = false;
  #chunks = new Map();
  #steps = new Map();
  #caps = new Map();
  #stepRequests = new Map();
  #capRequests = new Set();
  #failedMeshes = new Set();
  #result = null;
  #volume = null;
  #bounds = null;
  #palette = null;
  #stepCount = 0;
  #progress = 0;
  #tween = null;
  #clip = null;
  #ghost = false;
  #highlight = null;
  #mode = 'orbit';
  #orbit;
  #orbitDistance = 30;
  #walk = null;
  #walkFresh = true;
  #hover = null;
  #pointer = null;
  #pointerDirty = false;
  #raf = 0;
  #lastFrame = 0;
  #dirty = true;
  #frameStamps = [];
  #frameCpu = [];
  #drawn = { chunks: 0, quads: 0 };
  #timings = { buildMs: null, textureMs: null, meshMs: null, loadMs: null };
  #warnings = [];
  #missingTextures = [];
  #lost = false;
  #remeshing = false;
  #disposed = false;
  // Phase des laufenden Ladens ('loading' | 'building' | 'textures' | 'meshing' | null) und höchster gezeigter Anteil
  // beim Laden der Spieldaten (Worker und Seite melden getrennt; die Anzeige springt nie zurück)
  #loadPhase = null;
  #dataShare = 0;
  #ready = false;
  #reducedMotion;
  #offs = [];
  #resizeObserver = null;
  #view = mat4.create();
  #projection = mat4.create();
  #viewProj = mat4.create();
  #inverse = mat4.create();
  #matrix = mat4.create();
  #planes = new Float32Array(24);
  #eye = [0, 0, 0];

  constructor(canvas, { onPick = null, onHover = null, onStatus = null, onProgress = null, onModeChange = null, overlayParent = null, antialias = 'auto' } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new ViewerError('argument', 'Die 3D-Ansicht braucht ein <canvas>-Element.');
    if (![true, false, 'auto'].includes(antialias)) throw new ViewerError('argument', "antialias muss true, false oder 'auto' sein.");
    this.#canvas = canvas;
    this.#options = { onPick, onHover, onStatus, onProgress, onModeChange, overlayParent, antialias };
    // Kantenglättung nicht im Kontext, sondern über einen eigenen MSAA-Framebuffer (#renderTarget): bei großen
    // Canvas-Flächen kostet sie auf integrierten Grafikkarten zu viel (gemessen 1080p: ~48 statt 144 FPS)
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) {
      throw new ViewerError('no-webgl2', 'Dein Browser oder deine Grafikkarte unterstützt kein WebGL2 – die 3D-Ansicht braucht es. Aktualisiere den Browser oder schalte die Hardwarebeschleunigung ein.');
    }
    this.#gl = gl;
    try {
      this.#initGl();
    } catch (error) {
      console.error('3D-Ansicht: WebGL-Start fehlgeschlagen', error);
      throw new ViewerError('webgl', 'Die 3D-Ansicht konnte nicht gestartet werden (WebGL-Fehler). Details stehen in der Konsole.', { detail: error.message });
    }
    this.#reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    this.#orbit = new OrbitControls(canvas, {
      fovY: ORBIT_FOV, distance: 30, yaw: VIEW_ANGLES.iso[0] * DEG, pitch: VIEW_ANGLES.iso[1] * DEG,
      onTap: (tap) => this.#onTap(tap),
      onChange: (orbit) => { this.#orbitDistance = orbit.distance; },
    });
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', '3D-Ansicht: ziehen zum Drehen, Rad oder zwei Finger zum Zoomen, Pfeiltasten zum Drehen');
    this.#listen(canvas, 'webglcontextlost', (event) => this.#onContextLost(event));
    this.#listen(canvas, 'webglcontextrestored', () => this.#onContextRestored());
    this.#listen(canvas, 'pointermove', (event) => this.#onPointerMove(event));
    this.#listen(canvas, 'pointerleave', () => this.#setPointer(null));
    this.#listen(canvas, 'pointerdown', (event) => this.#onPointerDown(event));
    // Erster Besuch online: Fortschritt der Spieldaten dieser Seite (Texturen, Namen) in der Ladeanzeige
    this.#offs.push(onGameDataProgress((event) => this.#onDataProgress(event)));
    if (typeof ResizeObserver === 'function') {
      this.#resizeObserver = new ResizeObserver(() => this.#resize());
      this.#resizeObserver.observe(canvas);
    }
    this.#resize();
    this.#raf = requestAnimationFrame(this.#loop);
  }

  // ---------------------------------------------------------------- Öffentliche API

  get result() { return this.#result; }
  get stepCount() { return this.#stepCount; }
  get progress() { return this.#progress; }
  get clip() { return this.#clip ? { ...this.#clip } : null; }
  get ghost() { return this.#ghost; }
  get highlightStep() { return this.#highlight; }
  get mode() { return this.#mode; }
  get ready() { return this.#ready; }
  get hover() { return this.#hover; }
  get bounds() { return this.#bounds ? structuredClone(this.#bounds) : null; }
  get controls() { return { orbit: this.#orbit, walk: this.#walk }; }

  get stats() {
    const now = performance.now();
    const recent = this.#frameStamps.filter((t) => now - t <= 1000);
    const cpu = this.#frameCpu.length ? this.#frameCpu.reduce((a, b) => a + b, 0) / this.#frameCpu.length : 0;
    let quads = 0;
    for (const chunk of this.#chunks.values()) for (const mesh of chunk.layers) if (mesh) quads += mesh.quadCount;
    const textures = this.#store && !this.#lost ? this.#store.stats(this.#gl) : { layers: 0 };
    return {
      fps: recent.length,
      frameCpuMs: Math.round(cpu * 100) / 100,
      chunks: this.#chunks.size,
      drawnChunks: this.#drawn.chunks,
      quads,
      drawnQuads: this.#drawn.quads,
      blocks: this.#volume?.count ?? 0,
      steps: this.#stepCount,
      textureLayers: textures.layers,
      missingTextures: [...this.#missingTextures],
      msaaSamples: this.#msaa ? this.#msaaSamples : 0,
      ...this.#timings,
      warnings: [...this.#warnings],
    };
  }

  /**
   * Lädt einen Bau. source: { kind:'module', path } | { kind:'shape', shape, params } | { kind:'upload', format, name, data, params }
   * (Testquellen: { kind:'gallery', group, page } | { kind:'synthetic', count }). params gehen an das Bau-Modul.
   * Ergebnis: BuildResult (volume = Kopie im Hauptthread). Ein neuer load bricht den laufenden ab (code 'cancelled').
   */
  load(source, params = {}) {
    if (this.#disposed) return Promise.reject(new ViewerError('disposed', 'Die 3D-Ansicht wurde schon geschlossen.'));
    this.#cancelPending();
    if (this.#mode === 'walk') this.setMode('orbit');
    const job = ++this.#job;
    this.#clearScene();
    const promise = new Promise((resolve, reject) => {
      this.#pending = { job, resolve, reject, started: performance.now() };
    });
    this.#loadPhase = 'loading';
    this.#dataShare = 0;
    this.#status('loading', 'Lade Spieldaten …', 0);
    // Fehler beim Texturladen meldet #onBuilt; hier nur früh anstoßen
    loadTextureStore().catch(() => {});
    let worker;
    try {
      worker = this.#ensureWorker();
    } catch (error) {
      console.error('3D-Worker konnte nicht erzeugt werden:', error);
      this.#failPending(new ViewerError('worker', 'Die 3D-Berechnung konnte nicht gestartet werden. Details stehen in der Konsole.', { detail: error.message }));
      return promise;
    }
    try {
      worker.postMessage({ type: 'load', job, source, params });
    } catch (error) {
      this.#failPending(new ViewerError('source', 'Die Quelle des Baus ist ungültig (nicht übertragbar).', { detail: error.message }));
    }
    return promise;
  }

  /** Fortschritt als Schritt-Kommazahl (12.4 = Schritt 12 zu 40 %). animate: über die Zeit hinlaufen (Plopp). */
  setProgress(p, { animate = false } = {}) {
    if (typeof p !== 'number' || Number.isNaN(p)) throw new ViewerError('argument', `setProgress braucht eine Zahl (bekommen: ${p}).`);
    const target = Math.min(this.#stepCount, Math.max(0, p));
    if (animate && !this.#reducedMotion.matches && target !== this.#progress) {
      const steps = Math.abs(target - this.#progress);
      this.#tween = { from: this.#progress, to: target, start: performance.now(), duration: Math.min(4000, Math.max(250, steps * PROGRESS_STEP_MS)) };
      this.#requestStep(splitProgress(this.#progress, this.#stepCount).cur);
    } else {
      this.#tween = null;
      this.#applyProgress(target);
    }
    this.#dirty = true;
  }

  /** Schnittansicht: nur Ebenen minY … maxY zeigen (Block-y, ganze Zahlen); null = alles. */
  setClip(clip) {
    if (clip === null || clip === undefined) {
      this.#clip = null;
      this.#dirty = true;
      return;
    }
    const minY = clip.minY ?? -1e9, maxY = clip.maxY ?? 1e9;
    if (!Number.isInteger(minY) && minY !== -1e9) throw new ViewerError('argument', 'setClip: minY muss eine ganze Zahl sein.');
    if (!Number.isInteger(maxY) && maxY !== 1e9) throw new ViewerError('argument', 'setClip: maxY muss eine ganze Zahl sein.');
    if (minY > maxY) throw new ViewerError('argument', 'setClip: minY darf nicht größer als maxY sein.');
    this.#clip = { minY, maxY };
    this.#requestCap();
    this.#dirty = true;
  }

  setGhost(on) {
    this.#ghost = Boolean(on);
    this.#dirty = true;
  }

  setHighlightStep(index) {
    if (index !== null && index !== undefined && !(Number.isInteger(index) && index >= 0 && index < 65535)) {
      throw new ViewerError('argument', `setHighlightStep braucht eine Schrittnummer oder null (bekommen: ${index}).`);
    }
    this.#highlight = index ?? null;
    this.#dirty = true;
  }

  setMode(mode) {
    if (!MODES.includes(mode)) throw new ViewerError('argument', `Unbekannter Modus „${mode}“ (erlaubt: orbit, walk).`);
    if (mode === this.#mode) return;
    if (mode === 'walk') {
      if (!this.#volume) throw new ViewerError('not-ready', 'Lade zuerst einen Bau, dann kannst du darin herumlaufen.');
      const spawn = this.#walkSpawn();
      if (!this.#walk) {
        this.#walk = new WalkControls(this.#canvas, {
          world: { collisionBoxes: (x, y, z) => this.#collisionAt(x, y, z) },
          position: spawn.position, yaw: spawn.yaw, pitch: spawn.pitch, voidY: this.#bounds.min[1] - 64,
          overlayParent: this.#options.overlayParent ?? this.#canvas.parentElement,
          onExit: () => this.setMode('orbit'),
        });
      } else if (this.#walkFresh) {
        this.#walk.teleport(spawn.position, { yaw: spawn.yaw, pitch: spawn.pitch, flying: false });
      }
      this.#walkFresh = false;
      this.#orbit.enabled = false;
      this.#walk.enabled = true;
      this.#canvas.focus({ preventScroll: true });
    } else {
      this.#walk.enabled = false;
      this.#orbit.enabled = true;
    }
    this.#mode = mode;
    this.#setHover(null);
    this.#dirty = true;
    this.#emit('onModeChange', mode);
  }

  setView(view, { animate = true } = {}) {
    if (!VIEWS.includes(view)) throw new ViewerError('argument', `Unbekannte Ansicht „${view}“ (erlaubt: ${VIEWS.join(', ')}).`);
    if (this.#mode === 'walk') this.setMode('orbit');
    this.#orbit.setView(orbitForView(view, this.#bounds ?? sceneBounds(null), this.#aspect()), { animate });
    this.#dirty = true;
  }

  /**
   * Wartet, bis nichts mehr unterwegs ist (Laden, Schritt-/Schnitt-Meshes, Fortschritts-Animation) und das
   * aktuelle Bild gezeichnet ist. Ergebnis true, oder false, wenn der Viewer vorher geschlossen wurde.
   */
  idle() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.#disposed) {
          resolve(false);
          return;
        }
        const busy = this.#pending || this.#readyWaiter || this.#tween || this.#remeshing || this.#stepRequests.size > 0 || this.#capRequests.size > 0
          || this.#dirty || this.#lost;
        if (busy) requestAnimationFrame(check);
        else resolve(true);
      };
      requestAnimationFrame(check);
    });
  }

  /** Aktuelles Bild als PNG-Blob (rendert vorher ein Bild, damit der Inhalt sicher stimmt). */
  screenshot({ type = 'image/png', quality = undefined } = {}) {
    if (this.#disposed || this.#lost || !this.#programs) return Promise.reject(new ViewerError('not-ready', 'Die 3D-Ansicht ist gerade nicht bereit für ein Bild.'));
    this.#updateCamera();
    this.#render(performance.now());
    return new Promise((resolve, reject) => {
      this.#canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ViewerError('screenshot', 'Das Bild der 3D-Ansicht konnte nicht erzeugt werden.'))), type, quality);
    });
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    cancelAnimationFrame(this.#raf);
    this.#cancelPending('disposed');
    this.#worker?.terminate();
    this.#worker = null;
    this.#orbit.dispose();
    this.#walk?.dispose();
    for (const off of this.#offs) off();
    this.#offs = [];
    this.#resizeObserver?.disconnect();
    const gl = this.#gl;
    if (!gl.isContextLost()) {
      this.#clearScene();
      this.#deleteGl();
      this.#store?.dispose(gl);
    }
  }

  // ---------------------------------------------------------------- Laden und Worker

  #listen(target, type, handler) {
    target.addEventListener(type, handler);
    this.#offs.push(() => target.removeEventListener(type, handler));
  }

  // Rückrufe der Seite: ein Fehler dort darf die 3D-Ansicht nicht anhalten (Meldung in der Konsole)
  #emit(name, value) {
    const callback = this.#options[name];
    if (typeof callback !== 'function') return;
    try {
      callback(value);
    } catch (error) {
      console.error(`3D-Ansicht: Fehler im Rückruf ${name}:`, error);
    }
  }

  #status(state, message = '', progress = null) {
    this.#emit('onStatus', { state, message, progress });
  }

  #ensureWorker() {
    if (this.#worker) return this.#worker;
    const worker = new Worker(new URL('./engine-worker.js', import.meta.url), { type: 'module', name: 'block-kompass-3d' });
    worker.addEventListener('message', (event) => this.#onWorkerMessage(event.data));
    worker.addEventListener('error', (event) => {
      console.error('3D-Worker konnte nicht starten:', event.message ?? event);
      this.#worker?.terminate();
      this.#worker = null;
      this.#failPending(new ViewerError('worker', 'Die 3D-Berechnung konnte nicht gestartet werden. Details stehen in der Konsole.', { detail: event.message ?? null }));
    });
    worker.addEventListener('messageerror', () => this.#failPending(new ViewerError('worker', 'Die 3D-Berechnung hat unlesbare Daten geschickt.')));
    this.#worker = worker;
    return worker;
  }

  #cancelPending(code = 'cancelled') {
    const pending = this.#pending ?? this.#readyWaiter;
    if (this.#readyWaiter) clearTimeout(this.#readyWaiter.timer);
    this.#pending = null;
    this.#readyWaiter = null;
    if (!pending) return;
    const message = code === 'disposed' ? 'Die 3D-Ansicht wurde geschlossen.' : 'Laden abgebrochen – ein anderer Bau wird geladen.';
    pending.reject(new ViewerError(code, message));
  }

  #failPending(error) {
    const pending = this.#pending;
    this.#pending = null;
    this.#loadPhase = null;
    this.#status('error', error.message);
    if (pending) pending.reject(error);
    else console.error('3D-Ansicht:', error.message, error.detail ?? '');
  }

  #onWorkerMessage(message) {
    if (!message || typeof message !== 'object' || message.job !== this.#job || this.#disposed) return;
    try {
      switch (message.type) {
        case 'status': this.#onWorkerStatus(message); break;
        case 'built': this.#onBuilt(message).catch((error) => this.#onFatal(error, 'textures')); break;
        case 'palette': this.#palette = { collision: message.collision, outline: message.outline, pickable: message.pickable }; break;
        case 'chunks': this.#onChunks(message); break;
        case 'meshed': this.#onMeshed(message); break;
        case 'step': this.#onStepMesh(message); break;
        case 'cap': this.#onCapMesh(message); break;
        case 'error': this.#onWorkerError(message); break;
        default: break;
      }
    } catch (error) {
      this.#onFatal(error, 'internal');
    }
  }

  #onWorkerStatus(message) {
    const progress = typeof message.progress === 'number' && Number.isFinite(message.progress) ? Math.max(0, Math.min(1, message.progress)) : null;
    if (message.phase !== 'data') {
      if (this.#loadPhase === 'loading') this.#loadPhase = 'building';
      this.#status('building', message.message, progress);
      return;
    }
    if (progress === null) {
      this.#status('loading', message.message, null);
      return;
    }
    this.#showDataProgress('loading', message.message, progress);
  }

  // Fortschritt der Spieldaten in dieser Seite (js/data/game-data.js): nur während des Ladens der Daten bzw. Texturen
  #onDataProgress(event) {
    if (this.#disposed || !this.#pending) return;
    if (this.#loadPhase !== 'loading' && this.#loadPhase !== 'textures') return;
    this.#showDataProgress(this.#loadPhase, event.text, event.share);
  }

  #showDataProgress(state, message, share) {
    if (share < this.#dataShare) return;
    this.#dataShare = share;
    this.#status(state, message, share);
  }

  #onFatal(error, code) {
    if (error instanceof ViewerError) {
      this.#failPending(error);
      return;
    }
    if (isGameDataFailure(error)) {
      // Erwartbar (z. B. offline): verständlich melden, „Erneut versuchen“ lädt neu (Fehler werden nirgends behalten)
      const failure = toGameDataError(error);
      console.warn('3D-Ansicht:', failure.message, failure.cause ?? '');
      this.#failPending(new ViewerError('data', failure.message, { title: failure.title, detail: String(failure.cause?.message ?? failure.kind) }));
      return;
    }
    console.error('3D-Ansicht:', error);
    const message = code === 'textures'
      ? `Die Texturen konnten nicht geladen werden: ${error.message}`
      : 'In der 3D-Ansicht ist ein unerwarteter Fehler aufgetreten. Details stehen in der Konsole.';
    this.#failPending(new ViewerError(code, message, { detail: error.stack ?? String(error) }));
  }

  #onWorkerError(message) {
    // Fehlende oder nicht ladbare Spieldaten bzw. Community-Dateien sind erwartbar (z. B. offline): Warnung statt Fehler
    if (message.code === 'data' || message.code === 'community') console.warn(`3D-Worker (${message.request}): ${message.message}`, message.detail ?? '');
    else console.error(`3D-Worker (${message.request}): ${message.message}`, message.detail ?? '');
    if (message.request === 'step' || message.request === 'cap') {
      // Nicht endlos neu anfragen: fehlgeschlagene Meshes merken
      if (message.request === 'step') {
        this.#stepRequests.delete(message.step);
        this.#failedMeshes.add(`step:${message.step}`);
      } else {
        this.#capRequests.delete(message.y);
        this.#failedMeshes.add(`cap:${message.y}`);
      }
      this.#status('error', message.message);
      return;
    }
    this.#failPending(new ViewerError(message.code ?? 'build', message.message, { detail: message.detail, title: message.title ?? null }));
  }

  async #onBuilt(message) {
    const job = message.job;
    const volume = BlockVolume.fromTransfer(message.volume);
    this.#volume = volume;
    this.#result = { ...message.result, volume };
    this.#stepCount = message.result.steps.length;
    this.#progress = this.#stepCount;
    this.#bounds = sceneBounds(volume.bounds);
    this.#walkFresh = true;
    this.#timings.buildMs = Math.round(message.buildMs);
    this.#warnings = [...(message.result.warnings ?? [])];
    this.#updateGrid();
    this.#orbit.setView(orbitForView('iso', this.#bounds, this.#aspect()), { animate: false });
    this.#orbit.setHome();
    this.#loadPhase = 'textures';
    this.#dataShare = 0;
    this.#status('textures', 'Lade Texturen …', null);
    const started = performance.now();
    if (!this.#store) this.#store = await loadTextureStore();
    if (job !== this.#job || this.#disposed) return;
    if (this.#lost) throw new ViewerError('context-lost', 'Die Grafikkarte hat die 3D-Ansicht während des Ladens zurückgesetzt. Lade die Seite neu.');
    const map = await this.#store.prepare(this.#gl, message.textureNames);
    if (job !== this.#job || this.#disposed) return;
    // Fehlende Texturen (die eingebaute Fehltextur selbst zählt nicht)
    this.#missingTextures = [...map].filter(([name, entry]) => entry.missing && name !== 'missingno').map(([name]) => name);
    this.#texturesReady = true;
    // prepare kann das Texturobjekt neu anlegen (mehr Ebenen) → beim nächsten Bild neu binden
    this.#textureBound = false;
    this.#timings.textureMs = Math.round(performance.now() - started);
    this.#loadPhase = 'meshing';
    this.#status('meshing', 'Erzeuge das 3D-Modell … 0 %', 0);
    this.#worker.postMessage({ type: 'textures', job, map });
    this.#dirty = true;
  }

  #onChunks(message) {
    if (this.#lost) return;
    for (const chunk of message.chunks) this.#uploadChunk(chunk);
    const share = message.total ? message.done / message.total : 1;
    this.#status(this.#remeshing ? 'restoring' : 'meshing', `Erzeuge das 3D-Modell … ${Math.round(share * 100)} %`, share);
    this.#dirty = true;
  }

  #onMeshed(message) {
    this.#remeshing = false;
    this.#timings.meshMs = Math.round(message.meshMs);
    const newWarnings = (message.warnings ?? []).filter((w) => !this.#warnings.includes(w));
    if (newWarnings.length) console.warn(`3D-Ansicht: ${newWarnings.length} Hinweis(e) der Blockmodelle:\n${newWarnings.join('\n')}`);
    this.#warnings.push(...newWarnings);
    this.#ready = true;
    this.#dirty = true;
    this.#applyProgress(this.#progress);
    this.#requestCap();
    const pending = this.#pending;
    this.#pending = null;
    if (pending) {
      this.#timings.loadMs = Math.round(performance.now() - pending.started);
      // Erst nach dem ersten fertigen Bild melden (Rückfall nach 1 s, falls requestAnimationFrame ruht)
      const waiter = { ...pending, timer: setTimeout(() => this.#resolveReady(), 1000) };
      this.#readyWaiter = waiter;
    }
    this.#status('ready', '', 1);
  }

  #resolveReady() {
    const waiter = this.#readyWaiter;
    if (!waiter) return;
    this.#readyWaiter = null;
    clearTimeout(waiter.timer);
    waiter.resolve(this.#result);
  }

  #onStepMesh(message) {
    this.#stepRequests.delete(message.step);
    if (this.#lost) return;
    this.#deleteGroup(this.#steps.get(message.step));
    this.#steps.set(message.step, this.#uploadGroup(message.mesh));
    const { cur } = splitProgress(this.#progress, this.#stepCount);
    for (const step of this.#steps.keys()) {
      if (this.#steps.size <= STEP_CACHE) break;
      if (step !== cur && step !== cur + 1) {
        this.#deleteGroup(this.#steps.get(step));
        this.#steps.delete(step);
      }
    }
    this.#dirty = true;
  }

  #onCapMesh(message) {
    this.#capRequests.delete(message.y);
    if (this.#lost) return;
    this.#deleteGroup(this.#caps.get(message.y));
    this.#caps.set(message.y, this.#uploadGroup(message.mesh));
    for (const y of this.#caps.keys()) {
      if (this.#caps.size <= CAP_CACHE) break;
      if (y !== this.#clip?.maxY) {
        this.#deleteGroup(this.#caps.get(y));
        this.#caps.delete(y);
      }
    }
    this.#dirty = true;
  }

  #requestStep(step) {
    if (!this.#volume || step === null || step < 0 || step >= this.#stepCount) return;
    if (this.#steps.has(step) || this.#stepRequests.has(step) || this.#failedMeshes.has(`step:${step}`)) return;
    this.#stepRequests.set(step, performance.now());
    this.#worker?.postMessage({ type: 'step', job: this.#job, step });
  }

  #requestCap() {
    const clip = this.#clip;
    if (!clip || !this.#volume || !this.#bounds || this.#bounds.empty) return;
    const y = clip.maxY;
    if (y < this.#bounds.min[1] || y >= this.#bounds.max[1] - 1) return;
    if (this.#caps.has(y) || this.#capRequests.has(y) || this.#failedMeshes.has(`cap:${y}`)) return;
    this.#capRequests.add(y);
    this.#worker?.postMessage({ type: 'cap', job: this.#job, y });
  }

  #applyProgress(p) {
    this.#progress = p;
    const { cur } = splitProgress(p, this.#stepCount);
    if (cur < this.#stepCount) {
      this.#requestStep(cur);
      this.#requestStep(cur + 1);
    }
    this.#emit('onProgress', p);
  }

  // ---------------------------------------------------------------- GPU-Daten

  #initGl() {
    const gl = this.#gl;
    this.#programs = {
      block: createProgram(gl, 'Blöcke', BLOCK_VERTEX, blockFragment({ alphaTest: true })),
      blockSolid: createProgram(gl, 'Blöcke deckend', BLOCK_VERTEX, blockFragment({ alphaTest: false })),
      sky: createProgram(gl, 'Himmel', SKY_VERTEX, SKY_FRAGMENT),
      grid: createProgram(gl, 'Bodenraster', GRID_VERTEX, GRID_FRAGMENT),
      line: createProgram(gl, 'Linien', LINE_VERTEX, LINE_FRAGMENT),
    };
    this.#indexBuffer = gl.createBuffer();
    this.#indexCapacity = 0;
    this.#ensureIndices(16384);
    this.#skyVao = gl.createVertexArray();
    this.#lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.#lineVao);
    this.#lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, LINE_GEOMETRY, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    this.#gridVao = gl.createVertexArray();
    gl.bindVertexArray(this.#gridVao);
    this.#gridBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(12), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.#updateGrid();
    this.#msaa = null;
    this.#msaaChecked = false;
    this.#msaaSamples = this.#options.antialias === false ? 0 : Math.min(MSAA_SAMPLES, gl.getParameter(gl.MAX_SAMPLES) || 0);
  }

  // Ziel des Bildes: MSAA-Framebuffer (gleiches Format wie die Canvas: RGB8 ohne Alpha) oder direkt die Canvas.
  #renderTarget() {
    const gl = this.#gl;
    const width = this.#canvas.width, height = this.#canvas.height;
    const wanted = this.#msaaSamples >= 2 && (this.#options.antialias === true || width * height <= MSAA_MAX_PIXELS);
    if (!wanted) {
      this.#releaseMsaa();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }
    if (!this.#msaa || this.#msaa.width !== width || this.#msaa.height !== height) {
      this.#releaseMsaa();
      const framebuffer = gl.createFramebuffer();
      const color = gl.createRenderbuffer();
      const depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, color);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.#msaaSamples, gl.RGB8, width, height);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, this.#msaaSamples, gl.DEPTH_COMPONENT24, width, height);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      this.#msaa = { framebuffer, color, depth, width, height };
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.warn('3D-Ansicht: Kantenglättung (MSAA) nicht verfügbar – zeichne ohne.');
        this.#disableMsaa();
        return null;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.#msaa.framebuffer);
    return this.#msaa;
  }

  // MSAA-Bild in die Canvas auflösen. Beim ersten Mal prüfen, ob das geklappt hat (sonst ohne MSAA weiter).
  #resolveTarget(target) {
    if (!target) return true;
    const gl = this.#gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, target.width, target.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (this.#msaaChecked) return true;
    this.#msaaChecked = true;
    const error = gl.getError();
    if (error === gl.NO_ERROR) return true;
    console.warn(`3D-Ansicht: Auflösen der Kantenglättung fehlgeschlagen (WebGL-Fehler ${error}) – zeichne ohne.`);
    this.#disableMsaa();
    return false;
  }

  #disableMsaa() {
    this.#releaseMsaa();
    this.#msaaSamples = 0;
    this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, null);
  }

  #releaseMsaa() {
    const target = this.#msaa;
    if (!target) return;
    this.#msaa = null;
    if (this.#lost) return;
    const gl = this.#gl;
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteRenderbuffer(target.color);
    gl.deleteRenderbuffer(target.depth);
  }

  #deleteGl() {
    const gl = this.#gl;
    if (!this.#programs) return;
    this.#releaseMsaa();
    for (const { program } of Object.values(this.#programs)) gl.deleteProgram(program);
    for (const vao of [this.#skyVao, this.#lineVao, this.#gridVao]) gl.deleteVertexArray(vao);
    for (const buffer of [this.#lineBuffer, this.#gridBuffer, this.#indexBuffer]) gl.deleteBuffer(buffer);
    this.#programs = null;
  }

  // Gemeinsamer Index-Puffer (0,1,2, 0,2,3 je Quad). bufferData auf demselben Objekt: alle VAOs sehen die neue Größe.
  #ensureIndices(quads) {
    if (quads <= this.#indexCapacity) return;
    const gl = this.#gl;
    const capacity = Math.max(quads, this.#indexCapacity * 2, 16384);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, createQuadIndices(capacity), gl.STATIC_DRAW);
    this.#indexCapacity = capacity;
  }

  #createMesh(layer) {
    if (!layer || layer.quadCount === 0) return null;
    const gl = this.#gl;
    this.#ensureIndices(layer.quadCount);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, layer.vertices, gl.STATIC_DRAW);
    const stride = VERTEX_BYTES;
    gl.enableVertexAttribArray(ATTRIBUTES.position);
    gl.vertexAttribPointer(ATTRIBUTES.position, 3, gl.SHORT, false, stride, 0);
    gl.enableVertexAttribArray(ATTRIBUTES.layer);
    gl.vertexAttribPointer(ATTRIBUTES.layer, 1, gl.UNSIGNED_SHORT, false, stride, 6);
    gl.enableVertexAttribArray(ATTRIBUTES.uv);
    gl.vertexAttribPointer(ATTRIBUTES.uv, 2, gl.UNSIGNED_SHORT, false, stride, 8);
    gl.enableVertexAttribArray(ATTRIBUTES.color);
    gl.vertexAttribPointer(ATTRIBUTES.color, 4, gl.UNSIGNED_BYTE, true, stride, 12);
    gl.enableVertexAttribArray(ATTRIBUTES.showHide);
    gl.vertexAttribPointer(ATTRIBUTES.showHide, 2, gl.UNSIGNED_SHORT, false, stride, 16);
    gl.enableVertexAttribArray(ATTRIBUTES.flags);
    gl.vertexAttribPointer(ATTRIBUTES.flags, 1, gl.UNSIGNED_BYTE, false, stride, 20);
    let centers = null;
    if (layer.centers) {
      centers = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, centers);
      gl.bufferData(gl.ARRAY_BUFFER, layer.centers, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(ATTRIBUTES.center);
      gl.vertexAttribPointer(ATTRIBUTES.center, 4, gl.FLOAT, false, 16, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.#indexBuffer);
    gl.bindVertexArray(null);
    return { vao, vertices, centers, quadCount: layer.quadCount };
  }

  #deleteMesh(mesh) {
    if (!mesh || this.#lost) return;
    const gl = this.#gl;
    gl.deleteVertexArray(mesh.vao);
    gl.deleteBuffer(mesh.vertices);
    if (mesh.centers) gl.deleteBuffer(mesh.centers);
  }

  #uploadGroup(mesh) {
    return { layers: [this.#createMesh(mesh.solid), this.#createMesh(mesh.cutout), this.#createMesh(mesh.translucent)] };
  }

  #deleteGroup(group) {
    if (group) for (const mesh of group.layers) this.#deleteMesh(mesh);
  }

  #uploadChunk(data) {
    const key = chunkKey(data.cx, data.cy, data.cz);
    this.#deleteGroup(this.#chunks.get(key));
    const group = this.#uploadGroup(data);
    if (!group.layers.some(Boolean)) {
      this.#chunks.delete(key);
      return;
    }
    const ox = data.cx * 16, oy = data.cy * 16, oz = data.cz * 16;
    // Modelle ragen bis 1 Block unter und knapp 2 Blöcke über ihren Block (Banner, Feldfrüchte, Wandfackeln)
    this.#chunks.set(key, {
      ...group, ox, oy, oz, minStep: data.minStep,
      box: [ox - 1, oy - 1, oz - 1, ox + 17, oy + 18, oz + 17], center: [ox + 8, oy + 8, oz + 8], distance: 0,
    });
  }

  #clearScene() {
    for (const group of this.#chunks.values()) this.#deleteGroup(group);
    for (const group of this.#steps.values()) this.#deleteGroup(group);
    for (const group of this.#caps.values()) this.#deleteGroup(group);
    this.#chunks.clear();
    this.#steps.clear();
    this.#caps.clear();
    this.#stepRequests.clear();
    this.#capRequests.clear();
    this.#failedMeshes.clear();
    this.#missingTextures = [];
    this.#ready = false;
    this.#remeshing = false;
    this.#texturesReady = false;
    this.#palette = null;
    this.#tween = null;
    this.#setHover(null);
    this.#dirty = true;
  }

  #updateGrid() {
    if (!this.#gridBuffer || this.#lost) return;
    const b = this.#bounds ?? sceneBounds(null);
    const margin = Math.max(24, b.radius * 1.6);
    const x0 = b.min[0] - margin, x1 = b.max[0] + margin, z0 = b.min[2] - margin, z1 = b.max[2] + margin;
    const gl = this.#gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#gridBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, z0, x0, z1, x1, z1, x0, z0, x1, z1, x1, z0]), gl.DYNAMIC_DRAW);
  }

  // ---------------------------------------------------------------- Kontextverlust und Größe

  #onContextLost(event) {
    event.preventDefault();
    this.#lost = true;
    // Alle GPU-Objekte sind ungültig: nur die Verweise vergessen
    this.#chunks.clear();
    this.#steps.clear();
    this.#caps.clear();
    this.#stepRequests.clear();
    this.#capRequests.clear();
    this.#programs = null;
    this.#indexCapacity = 0;
    this.#msaa = null;
    this.#ready = false;
    this.#textureBound = false;
    this.#status('context-lost', 'Die Grafikkarte hat die 3D-Ansicht zurückgesetzt. Sie wird neu aufgebaut, sobald die Grafikkarte wieder bereit ist.');
  }

  #onContextRestored() {
    this.#lost = false;
    try {
      this.#initGl();
    } catch (error) {
      this.#onFatal(new ViewerError('webgl', 'Die 3D-Ansicht konnte nach dem Zurücksetzen der Grafikkarte nicht neu starten. Lade die Seite neu.', { detail: error.message }), 'webgl');
      return;
    }
    this.#dirty = true;
    if (!this.#volume) return;
    if (!this.#texturesReady) {
      this.#failPending(new ViewerError('context-lost', 'Die Grafikkarte hat die 3D-Ansicht während des Ladens zurückgesetzt. Lade den Bau neu.'));
      return;
    }
    this.#status('restoring', 'Die 3D-Ansicht wird neu aufgebaut …', 0);
    this.#remeshing = true;
    this.#worker?.postMessage({ type: 'remesh', job: this.#job });
    this.#applyProgress(this.#progress);
    this.#requestCap();
  }

  #aspect() {
    return Math.max(1, this.#canvas.width) / Math.max(1, this.#canvas.height);
  }

  #resize() {
    const ratio = Math.min(MAX_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(this.#canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.#canvas.clientHeight * ratio));
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
      this.#dirty = true;
    }
  }

  // ---------------------------------------------------------------- Zeiger, Picking, Laufen

  #setPointer(pointer) {
    this.#pointer = pointer;
    this.#pointerDirty = true;
  }

  #onPointerMove(event) {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    this.#setPointer(event.buttons === 0 ? { x: event.offsetX, y: event.offsetY } : null);
  }

  #onPointerDown(event) {
    // Im Lauf-Modus mit Pointer Lock: Klick wählt den Block im Fadenkreuz
    if (this.#mode === 'walk' && this.#canvas.ownerDocument.pointerLockElement === this.#canvas && event.button === 0) {
      this.#emit('onPick', this.#hover);
    }
  }

  #onTap(tap) {
    if (!this.#options.onPick) return;
    this.#updateCamera();
    this.#emit('onPick', this.#pickAt(tap.x, tap.y));
  }

  #blockShown(x, y, z, index) {
    if (!index || !this.#palette?.pickable[index]) return false;
    if (this.#clip && (y < this.#clip.minY || y > this.#clip.maxY)) return false;
    const { cur, frac } = splitProgress(this.#progress, this.#stepCount);
    return isStepShown(this.#volume.getStep(x, y, z), cur, frac);
  }

  #raycast(origin, direction, maxDistance) {
    const volume = this.#volume;
    if (!volume || !this.#palette || this.#bounds.empty) return null;
    // Strahl erst an der Box des Baus beginnen lassen (spart Zellen bei ferner Kamera)
    const span = rayBox(origin, direction, this.#bounds.min, this.#bounds.max);
    if (!span || span[0] > maxDistance) return null;
    const skip = Math.max(0, span[0] - 0.01);
    const start = [origin[0] + direction[0] * skip, origin[1] + direction[1] * skip, origin[2] + direction[2] * skip];
    const hit = raycastBlocks(start, direction, Math.min(maxDistance, span[1]) - skip + 0.02, (x, y, z) => this.#blockShown(x, y, z, volume.getIndex(x, y, z)));
    if (!hit) return null;
    const index = volume.getIndex(hit.x, hit.y, hit.z);
    return {
      x: hit.x, y: hit.y, z: hit.z, face: hit.face, normal: hit.normal, point: hit.point, distance: hit.distance + skip,
      state: volume.palette[index], step: volume.getStep(hit.x, hit.y, hit.z), index,
    };
  }

  #pickAt(cssX, cssY) {
    const width = this.#canvas.clientWidth || 1, height = this.#canvas.clientHeight || 1;
    const ray = rayFromScreen(this.#inverse, (cssX / width) * 2 - 1, 1 - (cssY / height) * 2);
    return this.#raycast(ray.origin, ray.direction, this.#bounds ? this.#bounds.radius * 6 + this.#orbitDistance + 64 : 0);
  }

  #setHover(hit) {
    const before = this.#hover;
    const same = before && hit && before.x === hit.x && before.y === hit.y && before.z === hit.z && before.face === hit.face;
    if (same || (!before && !hit)) return false;
    this.#hover = hit;
    this.#dirty = true;
    this.#emit('onHover', hit);
    return true;
  }

  #updateHover() {
    this.#pointerDirty = false;
    if (!this.#ready) return this.#setHover(null);
    if (this.#mode === 'walk') {
      const player = this.#walk.player;
      return this.#setHover(this.#raycast(this.#eye, lookVector(player.yaw, player.pitch), WALK_REACH));
    }
    return this.#setHover(this.#pointer ? this.#pickAt(this.#pointer.x, this.#pointer.y) : null);
  }

  #collisionAt(x, y, z) {
    const volume = this.#volume;
    if (!volume) return null;
    const index = volume.getIndex(x, y, z);
    // Virtueller Boden unter dem Bau (Höhe des Bodenrasters), damit man um den Bau herumlaufen kann
    if (y === this.#bounds.min[1] - 1 && !index) return GROUND_BOX;
    if (!index || !this.#palette) return null;
    if (this.#clip && (y < this.#clip.minY || y > this.#clip.maxY)) return null;
    const { cur, frac } = splitProgress(this.#progress, this.#stepCount);
    if (!isStepShown(volume.getStep(x, y, z), cur, frac)) return null;
    return this.#palette.collision[index];
  }

  #walkSpawn() {
    const b = this.#bounds;
    return { position: [b.center[0], b.min[1], b.max[2] + 3], yaw: 180, pitch: 12 };
  }

  // ---------------------------------------------------------------- Bildschleife

  #loop = (now) => {
    this.#raf = requestAnimationFrame(this.#loop);
    if (this.#lost || this.#disposed || !this.#programs) return;
    const dt = this.#lastFrame ? Math.min(100, now - this.#lastFrame) : 16;
    this.#lastFrame = now;
    this.#resize();
    let changed = this.#dirty;
    if (this.#advanceTween(now, dt)) changed = true;
    const controls = this.#mode === 'walk' ? this.#walk : this.#orbit;
    const moved = controls.update(dt);
    if (moved) changed = true;
    if (this.#texturesReady && this.#store.tick(this.#gl, now)) changed = true;
    if (this.#highlight !== null && !this.#reducedMotion.matches) changed = true;
    if (!changed && !this.#pointerDirty) return;
    this.#updateCamera();
    if (moved || this.#pointerDirty || this.#mode === 'walk') this.#updateHover();
    if (!changed && !this.#dirty) return;
    this.#dirty = false;
    const started = performance.now();
    this.#render(now);
    this.#frameCpu.push(performance.now() - started);
    if (this.#frameCpu.length > 60) this.#frameCpu.shift();
    this.#frameStamps.push(now);
    while (this.#frameStamps.length && now - this.#frameStamps[0] > 1000) this.#frameStamps.shift();
    if (this.#readyWaiter) this.#resolveReady();
  };

  #advanceTween(now, dt) {
    const tween = this.#tween;
    if (!tween) return false;
    const t = Math.min(1, Math.max(0, (now - tween.start) / tween.duration));
    const value = tween.from + (tween.to - tween.from) * t;
    // Warten, bis das Mesh des Schritts da ist, der gleich ploppt (sonst fehlen seine Blöcke kurz)
    const { cur, frac } = splitProgress(value, this.#stepCount);
    if (frac > 0 && !this.#steps.has(cur)) {
      this.#requestStep(cur);
      const requested = this.#stepRequests.get(cur);
      if (requested !== undefined && now - requested < STEP_WAIT_MS) {
        tween.start += dt;
        return false;
      }
    }
    if (t >= 1) this.#tween = null;
    this.#applyProgress(t >= 1 ? tween.to : value);
    return true;
  }

  #updateCamera() {
    const aspect = this.#aspect();
    let fov;
    let near;
    if (this.#mode === 'walk') {
      this.#walk.viewMatrix(this.#view);
      this.#walk.eye(this.#eye);
      fov = WALK_FOV;
      near = 0.05;
    } else {
      this.#orbit.viewMatrix(this.#view);
      this.#orbit.eye(this.#eye);
      fov = ORBIT_FOV;
      near = Math.min(4, Math.max(0.03, this.#orbitDistance * 0.004));
    }
    mat4.perspective(this.#projection, fov, aspect, near, Infinity);
    mat4.multiply(this.#viewProj, this.#projection, this.#view);
    mat4.invert(this.#inverse, this.#viewProj);
    frustumPlanes(this.#planes, this.#viewProj);
  }

  #ghostActive(cur) {
    return this.#ghost || (this.#highlight !== null && this.#highlight >= cur);
  }

  #visibleChunks(cur) {
    const list = [];
    const ghost = this.#ghostActive(cur);
    const clip = this.#clip;
    const eye = this.#eye;
    for (const chunk of this.#chunks.values()) {
      if (clip && (chunk.oy > clip.maxY || chunk.oy + 15 < clip.minY)) continue;
      if (!ghost && chunk.minStep >= cur) continue;
      const b = chunk.box;
      if (!aabbInFrustum(this.#planes, b[0], b[1], b[2], b[3], b[4], b[5])) continue;
      const dx = chunk.center[0] - eye[0], dy = chunk.center[1] - eye[1], dz = chunk.center[2] - eye[2];
      chunk.distance = dx * dx + dy * dy + dz * dz;
      list.push(chunk);
    }
    list.sort((a, b) => a.distance - b.distance);
    return list;
  }

  #fogRange() {
    const radius = this.#bounds?.radius ?? 16;
    const start = this.#mode === 'walk' ? Math.max(48, radius * 1.6) : this.#orbitDistance + radius * 1.5 + 32;
    return [start, start * 2.4 + 64];
  }

  #render(now) {
    if (!this.#programs || this.#gl.isContextLost()) return;
    const target = this.#renderTarget();
    this.#drawScene(now);
    // Schlug das Auflösen fehl, das Bild direkt in die Canvas noch einmal zeichnen
    if (!this.#resolveTarget(target)) this.#drawScene(now);
  }

  #drawScene(now) {
    const gl = this.#gl;
    gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.clearColor(SKY.horizon[0], SKY.horizon[1], SKY.horizon[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.#drawSky();
    const { cur, frac } = splitProgress(this.#progress, this.#stepCount);
    const ready = this.#texturesReady && this.#store && this.#chunks.size + this.#steps.size > 0;
    const list = ready ? this.#visibleChunks(cur) : [];
    this.#drawn = { chunks: list.length, quads: 0 };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    if (ready) {
      // Deckend mit dem Programm ohne discard (früher Tiefentest), dann cutout mit Alpha-Test
      const { blockSolid, block } = this.#programs;
      this.#setBlockUniforms(blockSolid, cur, frac, now);
      this.#drawLayer(blockSolid, list, 0, false);
      this.#setBlockUniforms(block, cur, frac, now);
      this.#drawLayer(block, list, 1, false);
      this.#drawOutline();
      this.#drawGrid();
      gl.useProgram(block.program);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      this.#drawLayer(block, list, 2, true);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      if (this.#ghostActive(cur)) this.#drawGhosts(block, list);
    } else {
      this.#drawGrid();
    }
    if (this.#mode === 'walk') this.#drawCrosshair();
    gl.bindVertexArray(null);
  }

  #setBlockUniforms({ program, uniforms: u }, cur, frac, now) {
    const gl = this.#gl;
    gl.useProgram(program);
    // Nur nach prepare/Kontextverlust neu binden: bind() prüft mit gl.isTexture (in Chrome ein synchroner GPU-Aufruf)
    if (!this.#textureBound) this.#textureBound = this.#store.bind(gl, 0);
    gl.uniform1i(u.uTexture, 0);
    gl.uniformMatrix4fv(u.uViewProj, false, this.#viewProj);
    gl.uniform3f(u.uCamera, this.#eye[0], this.#eye[1], this.#eye[2]);
    gl.uniform1f(u.uCur, cur);
    gl.uniform1f(u.uFrac, frac);
    gl.uniform1f(u.uAnimate, this.#reducedMotion.matches ? 0 : 1);
    gl.uniform2f(u.uClip, this.#clip ? this.#clip.minY : -1e9, this.#clip ? this.#clip.maxY : 1e9);
    gl.uniform1f(u.uHighlight, this.#highlight ?? -1);
    gl.uniform1f(u.uGhost, this.#ghost ? 1 : 0);
    gl.uniform1f(u.uPulse, this.#reducedMotion.matches ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.005));
    const [fogStart, fogEnd] = this.#fogRange();
    gl.uniform3f(u.uFogColor, SKY.horizon[0], SKY.horizon[1], SKY.horizon[2]);
    gl.uniform2f(u.uFogRange, fogStart, fogEnd);
    gl.uniform1i(u.uPass, PASS.normal);
  }

  #draw(mesh) {
    const gl = this.#gl;
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.quadCount * 6, gl.UNSIGNED_INT, 0);
    this.#drawn.quads += mesh.quadCount;
  }

  // Eine Schicht: Chunks (durchscheinend von hinten nach vorne), dann laufender Schritt, dann Schnitt-Deckflächen.
  #drawLayer({ uniforms: u }, list, layer, backToFront) {
    const gl = this.#gl;
    gl.uniform1i(u.uLayer, layer);
    gl.uniform1i(u.uKind, MESH_KIND.chunk);
    for (let i = 0; i < list.length; i++) {
      const chunk = list[backToFront ? list.length - 1 - i : i];
      const mesh = chunk.layers[layer];
      if (!mesh) continue;
      gl.uniform3f(u.uOrigin, chunk.ox, chunk.oy, chunk.oz);
      this.#draw(mesh);
    }
    const { cur } = splitProgress(this.#progress, this.#stepCount);
    const step = this.#steps.get(cur)?.layers[layer];
    if (step) {
      gl.uniform1i(u.uKind, MESH_KIND.step);
      this.#draw(step);
    }
    const cap = this.#clip ? this.#caps.get(this.#clip.maxY)?.layers[layer] : null;
    if (cap) {
      gl.uniform1i(u.uKind, MESH_KIND.cap);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -1);
      this.#draw(cap);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
  }

  // Geist: erst nur Tiefe (nächste Geist-Fläche gewinnt), dann Farbe halbdurchsichtig darüber.
  #drawGhosts(block, list) {
    const gl = this.#gl;
    const u = block.uniforms;
    gl.useProgram(block.program);
    gl.uniform1i(u.uPass, PASS.ghost);
    gl.colorMask(false, false, false, false);
    gl.depthMask(true);
    for (const layer of [0, 1, 2]) this.#drawLayer(block, list, layer, false);
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const layer of [0, 1, 2]) this.#drawLayer(block, list, layer, false);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.uniform1i(u.uPass, PASS.normal);
  }

  #drawSky() {
    const gl = this.#gl;
    const { program, uniforms: u } = this.#programs.sky;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.uInverseViewProj, false, this.#inverse);
    gl.uniform3fv(u.uZenith, SKY.zenith);
    gl.uniform3fv(u.uHorizon, SKY.horizon);
    gl.uniform3fv(u.uNadir, SKY.nadir);
    gl.bindVertexArray(this.#skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  #drawGrid() {
    const b = this.#bounds;
    if (!b || this.#eye[1] <= b.min[1]) return;
    const gl = this.#gl;
    const { program, uniforms: u } = this.#programs.grid;
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.uViewProj, false, this.#viewProj);
    gl.uniform3f(u.uCamera, this.#eye[0], this.#eye[1], this.#eye[2]);
    gl.uniform1f(u.uY, b.min[1] - 0.002);
    gl.uniform4f(u.uFootprint, b.min[0], b.min[2], b.max[0], b.max[2]);
    gl.uniform1f(u.uFade, Math.max(12, b.radius * 1.2));
    gl.uniform3fv(u.uLineColor, GRID_LINE);
    gl.uniform3fv(u.uFogColor, SKY.horizon);
    const [fogStart, fogEnd] = this.#fogRange();
    gl.uniform2f(u.uFogRange, fogStart, fogEnd);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.#gridVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // Umriss des Blocks unter dem Zeiger (Form aus den Modellflächen) plus aufgehellte Seite.
  #drawOutline() {
    const hit = this.#hover;
    if (!hit || !this.#palette) return;
    const gl = this.#gl;
    const o = this.#palette.outline.subarray(hit.index * 6, hit.index * 6 + 6);
    const e = 0.004;
    const m = this.#matrix;
    mat4.identity(m);
    m[0] = o[3] - o[0] + 2 * e;
    m[5] = o[4] - o[1] + 2 * e;
    m[10] = o[5] - o[2] + 2 * e;
    m[12] = hit.x + o[0] - e;
    m[13] = hit.y + o[1] - e;
    m[14] = hit.z + o[2] - e;
    mat4.multiply(m, this.#viewProj, m);
    const { program, uniforms: u } = this.#programs.line;
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.uMatrix, false, m);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(this.#lineVao);
    gl.uniform4fv(u.uColor, OUTLINE_COLOR);
    gl.drawArrays(gl.LINES, 0, EDGE_VERTICES);
    const face = FACE_ORDER.indexOf(hit.face);
    if (face >= 0) {
      gl.disable(gl.CULL_FACE);
      gl.uniform4fv(u.uColor, FACE_COLOR);
      gl.drawArrays(gl.TRIANGLES, FACE_FIRST + face * 6, 6);
      gl.enable(gl.CULL_FACE);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // Fadenkreuz wie im Spiel: invertiert den Hintergrund.
  #drawCrosshair() {
    const gl = this.#gl;
    const ratio = Math.min(MAX_PIXEL_RATIO, globalThis.devicePixelRatio || 1);
    const m = this.#matrix;
    mat4.identity(m);
    m[0] = (2 * ratio) / this.#canvas.width;
    m[5] = (2 * ratio) / this.#canvas.height;
    const { program, uniforms: u } = this.#programs.line;
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.uMatrix, false, m);
    gl.uniform4f(u.uColor, 1, 1, 1, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ZERO);
    gl.bindVertexArray(this.#lineVao);
    gl.drawArrays(gl.TRIANGLES, CROSSHAIR_FIRST, 18);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }
}
