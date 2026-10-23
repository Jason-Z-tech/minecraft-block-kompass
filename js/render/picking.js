// Strahl-Test durch das Blockgitter (DDA nach Amanatides & Woo) für Hover und Klick.
// Weltkoordinaten wie Minecraft: Block (x, y, z) belegt den Würfel [x, x+1) × [y, y+1) × [z, z+1).

import { mat4 } from './mat.js';

// Seite, durch die der Strahl in den Block eintritt, je Achse und Schrittrichtung.
const FACE_BY_STEP = {
  x: { 1: 'west', [-1]: 'east' },
  y: { 1: 'down', [-1]: 'up' },
  z: { 1: 'north', [-1]: 'south' },
};

function checkVector(value, label) {
  if (!value || value.length < 3 || ![0, 1, 2].every((i) => Number.isFinite(value[i]))) {
    throw new Error(`${label} muss drei endliche Zahlen enthalten.`);
  }
}

// Startzelle: liegt der Ursprung genau auf einer Gitterebene und zeigt der Strahl in die negative Richtung,
// gehört er schon zur unteren Zelle (der Strahl verläuft für alle t > 0 dort).
function startCell(origin, direction) {
  const cell = Math.floor(origin);
  return direction < 0 && cell === origin ? cell - 1 : cell;
}

function firstBoundary(origin, cell, step, direction) {
  if (step > 0) return (cell + 1 - origin) / direction;
  if (step < 0) return (cell - origin) / direction;
  return Infinity;
}

/**
 * Verfolgt einen Strahl bis maxDistance und ruft isHit(x, y, z) für jede durchquerte Zelle auf.
 * Rückgabe beim ersten Treffer:
 *   { x, y, z, face, normal: [nx, ny, nz], distance, point: [px, py, pz], inside: false }
 * Startet der Strahl im Inneren eines getroffenen Blocks: face = null, normal = null, distance = 0, inside = true;
 * liegt der Ursprung genau auf einer Seite dieses Blocks (Strahl zeigt hinein): diese Seite, distance = 0.
 * Ohne Treffer: null. direction muss nicht normiert sein; distance ist in Blöcken.
 */
export function raycastBlocks(origin, direction, maxDistance, isHit) {
  checkVector(origin, 'Strahl-Ursprung');
  checkVector(direction, 'Strahl-Richtung');
  if (!Number.isFinite(maxDistance) || maxDistance < 0) throw new Error(`maxDistance muss eine endliche Zahl ≥ 0 sein (bekommen: ${maxDistance}).`);
  if (typeof isHit !== 'function') throw new Error('isHit muss eine Funktion (x, y, z) → boolean sein.');
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (length === 0) throw new Error('Strahl-Richtung darf nicht (0, 0, 0) sein.');

  const ox = origin[0], oy = origin[1], oz = origin[2];
  const dx = direction[0] / length, dy = direction[1] / length, dz = direction[2] / length;
  const stepX = Math.sign(dx), stepY = Math.sign(dy), stepZ = Math.sign(dz);
  let x = startCell(ox, dx), y = startCell(oy, dy), z = startCell(oz, dz);

  if (isHit(x, y, z)) {
    // Liegt der Ursprung genau auf einer Seite der Startzelle und zeigt der Strahl hinein, ist das die getroffene Seite.
    const axes = [['x', ox, stepX], ['y', oy, stepY], ['z', oz, stepZ]];
    for (let i = 0; i < 3; i++) {
      const [axis, value, step] = axes[i];
      if (step !== 0 && Number.isInteger(value)) {
        const normal = [0, 0, 0];
        normal[i] = -step;
        return { x, y, z, face: FACE_BY_STEP[axis][step], normal, distance: 0, point: [ox, oy, oz], inside: false };
      }
    }
    return { x, y, z, face: null, normal: null, distance: 0, point: [ox, oy, oz], inside: true };
  }

  const tDeltaX = stepX !== 0 ? 1 / Math.abs(dx) : Infinity;
  const tDeltaY = stepY !== 0 ? 1 / Math.abs(dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? 1 / Math.abs(dz) : Infinity;
  let tMaxX = firstBoundary(ox, x, stepX, dx);
  let tMaxY = firstBoundary(oy, y, stepY, dy);
  let tMaxZ = firstBoundary(oz, z, stepZ, dz);

  for (;;) {
    let t;
    let axis;
    // Bei Gleichstand zuerst x, dann y, dann z (feste Reihenfolge = reproduzierbare Ergebnisse).
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX; axis = 'x'; x += stepX; tMaxX += tDeltaX;
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY; axis = 'y'; y += stepY; tMaxY += tDeltaY;
    } else {
      t = tMaxZ; axis = 'z'; z += stepZ; tMaxZ += tDeltaZ;
    }
    if (!(t <= maxDistance)) return null;
    if (isHit(x, y, z)) {
      const step = axis === 'x' ? stepX : axis === 'y' ? stepY : stepZ;
      const normal = [0, 0, 0];
      normal[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] = -step;
      return {
        x, y, z,
        face: FACE_BY_STEP[axis][step],
        normal,
        distance: t,
        point: [ox + dx * t, oy + dy * t, oz + dz * t],
        inside: false,
      };
    }
  }
}

/**
 * Strahl durch einen Bildschirmpunkt. ndcX/ndcY von −1 … 1 (links unten = −1, −1).
 * invViewProj = Inverse von projection · view. Funktioniert für Perspektive (auch unendlich fern) und Ortho.
 * Rückgabe { origin: [x, y, z], direction: [x, y, z] (normiert) }.
 */
export function rayFromScreen(invViewProj, ndcX, ndcY) {
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) throw new Error('rayFromScreen: Bildschirmkoordinaten müssen endliche Zahlen sein.');
  const near = mat4.transformVec4([0, 0, 0, 0], invViewProj, [ndcX, ndcY, -1, 1]);
  const mid = mat4.transformVec4([0, 0, 0, 0], invViewProj, [ndcX, ndcY, 0, 1]);
  if (Math.abs(near[3]) < 1e-12 || Math.abs(mid[3]) < 1e-12) throw new Error('rayFromScreen: Matrix bildet den Punkt ins Unendliche ab.');
  const origin = [near[0] / near[3], near[1] / near[3], near[2] / near[3]];
  const dir = [mid[0] / mid[3] - origin[0], mid[1] / mid[3] - origin[1], mid[2] / mid[3] - origin[2]];
  const length = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(length > 0)) throw new Error('rayFromScreen: Richtung nicht bestimmbar (Matrix ungültig?).');
  return { origin, direction: [dir[0] / length, dir[1] / length, dir[2] / length] };
}
