// Orbit- und Lauf-/Flugsteuerung (ARCHITEKTUR §7.4).
// Die Rechenlogik (Kamera, Bewegung, Kollision, Doppeltipp) ist rein und in Node testbar. Die Bewegung
// folgt Minecraft Java Tick für Tick (20 Ticks/s, LivingEntity.travel, Entity.collide); gezeichnet wird
// zwischen zwei Ticks interpoliert. OrbitControls/WalkControls verbinden das mit Pointer-, Rad- und Tastatur-Ereignissen.

import { mat4 } from './mat.js';

export const TICK_MS = 50;
export const DEG = Math.PI / 180;

export const PLAYER = Object.freeze({
  width: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  sneakHeight: 1.5,
  sneakEyeHeight: 1.27,
  stepHeight: 0.6,
});

// Werte aus dem Spiel (pro Tick). Ergebnis: Gehen 4,317, Sprinten 5,612, Fliegen ≈ 10,9 Blöcke/s,
// senkrecht fliegen 7,5 Blöcke/s, Sprunghöhe ≈ 1,25 Blöcke.
export const PHYSICS = Object.freeze({
  gravity: 0.08,
  verticalDrag: 0.98,
  airFriction: 0.91,
  blockFriction: 0.6,
  walkSpeed: 0.1,
  sprintSpeed: 0.13,
  airSpeed: 0.02,
  airSprintSpeed: 0.026,
  flySpeed: 0.05,
  flyVerticalDrag: 0.6,
  jumpVelocity: 0.42,
  sprintJumpBoost: 0.2,
  inputScale: 0.98,
  sneakFactor: 0.3,
  jumpDelayTicks: 10,
  doubleTapTicks: 7,
  minorCollisionAngle: 0.13962634,
});

const EPS = 1e-7;
const MAX_TICKS_PER_FRAME = 10;

// ---------------------------------------------------------------- Boxen und Kollision
// Box = [minX, minY, minZ, maxX, maxY, maxZ] in Weltkoordinaten.

export function playerBox(x, y, z, height = PLAYER.height, width = PLAYER.width) {
  const half = width / 2;
  return [x - half, y, z - half, x + half, y + height, z + half];
}

function moveBox(box, dx, dy, dz) {
  return [box[0] + dx, box[1] + dy, box[2] + dz, box[3] + dx, box[4] + dy, box[5] + dz];
}

function expandTowards(box, dx, dy, dz) {
  return [
    dx < 0 ? box[0] + dx : box[0], dy < 0 ? box[1] + dy : box[1], dz < 0 ? box[2] + dz : box[2],
    dx > 0 ? box[3] + dx : box[3], dy > 0 ? box[4] + dy : box[4], dz > 0 ? box[5] + dz : box[5],
  ];
}

function intersects(a, b) {
  return a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];
}

/**
 * Sammelt alle Kollisionsboxen (Weltkoordinaten), die den Bereich berühren können.
 * world.collisionBoxes(x, y, z) → Liste von Boxen [x1, y1, z1, x2, y2, z2] blocklokal (x/z 0 … 1, y 0 … 1,5).
 */
export function collectBoxes(world, region) {
  const out = [];
  const x0 = Math.floor(region[0] - EPS), x1 = Math.floor(region[3] + EPS);
  const y0 = Math.floor(region[1] - EPS) - 1, y1 = Math.floor(region[4] + EPS);
  const z0 = Math.floor(region[2] - EPS), z1 = Math.floor(region[5] + EPS);
  for (let bx = x0; bx <= x1; bx++) {
    for (let by = y0; by <= y1; by++) {
      for (let bz = z0; bz <= z1; bz++) {
        const boxes = world.collisionBoxes(bx, by, bz);
        if (!boxes) continue;
        for (const b of boxes) {
          const box = [bx + b[0], by + b[1], bz + b[2], bx + b[3], by + b[4], bz + b[5]];
          if (box[3] - box[0] <= 0 || box[4] - box[1] <= 0 || box[5] - box[2] <= 0) continue;
          if (box[0] <= region[3] + EPS && box[3] >= region[0] - EPS && box[1] <= region[4] + EPS && box[4] >= region[1] - EPS
            && box[2] <= region[5] + EPS && box[5] >= region[2] - EPS) out.push(box);
        }
      }
    }
  }
  return out;
}

export function noCollision(world, region) {
  return !collectBoxes(world, region).some((box) => intersects(box, region));
}

// Wie VoxelShape.collide entlang einer Achse (0 = x, 1 = y, 2 = z): erlaubte Strecke ≤ distance.
export function sweepAxis(axis, box, boxes, distance) {
  const b = (axis + 1) % 3, c = (axis + 2) % 3;
  for (const s of boxes) {
    if (Math.abs(distance) < EPS) return 0;
    if (s[3 + b] <= box[b] + EPS || s[b] >= box[3 + b] - EPS) continue;
    if (s[3 + c] <= box[c] + EPS || s[c] >= box[3 + c] - EPS) continue;
    if (distance > 0) {
      const gap = s[axis] - box[3 + axis];
      if (gap >= -EPS) distance = Math.min(distance, gap);
    } else {
      const gap = s[3 + axis] - box[axis];
      if (gap <= EPS) distance = Math.max(distance, gap);
    }
  }
  return distance;
}

// Entity.collideWithShapes: erst y, dann die größere waagrechte Achse zuletzt.
export function collideWithBoxes(box, motion, boxes) {
  let [dx, dy, dz] = motion;
  let moved = box;
  if (dy !== 0) {
    dy = sweepAxis(1, moved, boxes, dy);
    if (dy !== 0) moved = moveBox(moved, 0, dy, 0);
  }
  const zFirst = Math.abs(dx) < Math.abs(dz);
  if (zFirst && dz !== 0) {
    dz = sweepAxis(2, moved, boxes, dz);
    if (dz !== 0) moved = moveBox(moved, 0, 0, dz);
  }
  if (dx !== 0) {
    dx = sweepAxis(0, moved, boxes, dx);
    if (!zFirst && dx !== 0) moved = moveBox(moved, dx, 0, 0);
  }
  if (!zFirst && dz !== 0) dz = sweepAxis(2, moved, boxes, dz);
  return [dx, dy, dz];
}

// Entity.collectCandidateStepUpHeights: Oberkanten in Reichweite, aufsteigend.
function candidateStepHeights(box, boxes, maxStep, skip) {
  const heights = new Set();
  const skipF = Math.fround(skip);
  for (const s of boxes) {
    for (const coord of [s[1], s[4]]) {
      const h = Math.fround(coord - box[1]);
      if (h < 0 || h === skipF) continue;
      if (h > maxStep) break;
      heights.add(h);
    }
  }
  return [...heights].sort((a, b) => a - b);
}

const horizontalSq = (v) => v[0] * v[0] + v[2] * v[2];

/**
 * Entity.collide mit Aufsteigen auf Stufen: liefert die tatsächliche Bewegung für `motion`.
 * onGround = Stand im letzten Tick, stepHeight = 0,6 beim Spieler.
 */
export function collideMovement(world, box, motion, { onGround = false, stepHeight = PLAYER.stepHeight } = {}) {
  const region = expandTowards(box, motion[0], motion[1], motion[2]);
  const boxes = collectBoxes(world, region);
  let result = horizontalSq(motion) + motion[1] * motion[1] === 0 ? [...motion] : collideWithBoxes(box, motion, boxes);
  const blockedX = motion[0] !== result[0];
  const blockedY = motion[1] !== result[1];
  const blockedZ = motion[2] !== result[2];
  const landed = blockedY && motion[1] < 0;
  if (stepHeight > 0 && (landed || onGround) && (blockedX || blockedZ)) {
    const base = landed ? moveBox(box, 0, result[1], 0) : box;
    let stepRegion = expandTowards(base, motion[0], stepHeight, motion[2]);
    if (!landed) stepRegion = expandTowards(stepRegion, 0, -1e-5, 0);
    const stepBoxes = collectBoxes(world, stepRegion);
    for (const h of candidateStepHeights(base, stepBoxes, stepHeight, result[1])) {
      const attempt = collideWithBoxes(base, [motion[0], h, motion[2]], stepBoxes);
      if (horizontalSq(attempt) > horizontalSq(result)) {
        result = [attempt[0], attempt[1] + (base[1] - box[1]), attempt[2]];
        break;
      }
    }
  }
  return result;
}

// Player.maybeBackOffFromEdge: beim Schleichen nicht von Kanten fallen (Schritte von 0,05).
export function backOffFromEdge(world, box, motion, stepHeight = PLAYER.stepHeight) {
  let [dx, dy, dz] = motion;
  if (dy > 0) return motion;
  const step = 0.05;
  const sx = Math.sign(dx) * step, sz = Math.sign(dz) * step;
  const canFall = (ox, oz) => noCollision(world, [box[0] + EPS + ox, box[1] - stepHeight - EPS, box[2] + EPS + oz, box[3] - EPS + ox, box[1], box[5] - EPS + oz]);
  while (dx !== 0 && canFall(dx, 0)) {
    if (Math.abs(dx) <= step) { dx = 0; break; }
    dx -= sx;
  }
  while (dz !== 0 && canFall(0, dz)) {
    if (Math.abs(dz) <= step) { dz = 0; break; }
    dz -= sz;
  }
  while (dx !== 0 && dz !== 0 && canFall(dx, dz)) {
    dx = Math.abs(dx) <= step ? 0 : dx - sx;
    dz = Math.abs(dz) <= step ? 0 : dz - sz;
  }
  return [dx, dy, dz];
}

// ---------------------------------------------------------------- Doppeltipp

/**
 * Doppeltipp-Erkennung wie jumpTriggerTime/sprintTriggerTime im Spiel: erster Druck startet einen Zähler
 * (window Ticks), ein zweiter Druck, solange er läuft, löst aus. Pro Tick einmal step(pressedEdge) aufrufen.
 */
export function createDoubleTap(windowTicks = PHYSICS.doubleTapTicks) {
  let timer = 0;
  return {
    get pending() { return timer > 0; },
    step(pressedEdge) {
      if (timer > 0) timer--;
      if (!pressedEdge) return false;
      if (timer === 0) {
        timer = windowTicks;
        return false;
      }
      timer = 0;
      return true;
    },
    reset() { timer = 0; },
  };
}

// ---------------------------------------------------------------- Spieler (Laufen/Fliegen)

// Blickrichtung wie Entity.calculateViewVector: yaw 0 = Süden (+z), 90 = Westen; pitch > 0 = nach unten (Grad).
export function lookVector(yaw, pitch, out = [0, 0, 0]) {
  const cp = Math.cos(pitch * DEG);
  out[0] = -Math.sin(yaw * DEG) * cp;
  out[1] = -Math.sin(pitch * DEG);
  out[2] = Math.cos(yaw * DEG) * cp;
  return out;
}

export function createPlayer({ position = [0, 0, 0], yaw = 0, pitch = 0, flying = false } = {}) {
  const [x, y, z] = position;
  if (![x, y, z, yaw, pitch].every(Number.isFinite)) throw new Error('createPlayer: Position und Blickwinkel müssen endliche Zahlen sein.');
  return {
    x, y, z, prevX: x, prevY: y, prevZ: z,
    vx: 0, vy: 0, vz: 0,
    yaw, pitch: Math.max(-90, Math.min(90, pitch)),
    onGround: false,
    flying,
    sprinting: false,
    sneaking: false,
    horizontalCollision: false,
    minorHorizontalCollision: false,
    noJumpDelay: 0,
    wasJumping: false,
    hadSprintImpulse: false,
    eyeHeight: PLAYER.eyeHeight,
    prevEyeHeight: PLAYER.eyeHeight,
    jumpTap: createDoubleTap(),
    sprintTap: createDoubleTap(),
  };
}

// Eingabevektor wie LocalPlayer.modifyInput (×0,98, Schleichen ×0,3, „quadratische“ Diagonale).
export function modifyInput(left, forward, sneaking) {
  let length = Math.hypot(left, forward);
  if (length === 0) return [0, 0];
  if (length > 1) {
    left /= length;
    forward /= length;
    length = 1;
  }
  let scale = PHYSICS.inputScale * (sneaking ? PHYSICS.sneakFactor : 1);
  let x = left * scale, y = forward * scale;
  const len = length * scale;
  const ax = Math.abs(x / len), ay = Math.abs(y / len);
  const ratio = ay > ax ? ax / ay : ay / ax;
  const target = Math.min(len * Math.sqrt(1 + ratio * ratio), 1);
  x = (x / len) * target;
  y = (y / len) * target;
  return [x, y];
}

function frictionSpeed(player) {
  if (player.onGround && !player.flying) {
    const f = PHYSICS.blockFriction;
    return (player.sprinting ? PHYSICS.sprintSpeed : PHYSICS.walkSpeed) * (Math.fround(0.21600002) / (f * f * f));
  }
  if (player.flying) return player.sprinting ? PHYSICS.flySpeed * 2 : PHYSICS.flySpeed;
  return player.sprinting ? PHYSICS.airSprintSpeed : PHYSICS.airSpeed;
}

function fitsAt(world, player, height) {
  return noCollision(world, playerBox(player.x, player.y, player.z, height));
}

function isMinorCollision(player, left, forward, moved) {
  const s = Math.sin(player.yaw * DEG), c = Math.cos(player.yaw * DEG);
  const gx = left * c - forward * s, gz = forward * c + left * s;
  const i = gx * gx + gz * gz, j = moved[0] * moved[0] + moved[2] * moved[2];
  if (i < 1e-5 || j < 1e-5) return false;
  const angle = Math.acos(Math.max(-1, Math.min(1, (gx * moved[0] + gz * moved[2]) / Math.sqrt(i * j))));
  return angle < PHYSICS.minorCollisionAngle;
}

function jumpFromGround(p) {
  p.vy = Math.max(PHYSICS.jumpVelocity, p.vy);
  if (p.sprinting) {
    p.vx += -Math.sin(p.yaw * DEG) * PHYSICS.sprintJumpBoost;
    p.vz += Math.cos(p.yaw * DEG) * PHYSICS.sprintJumpBoost;
  }
}

/**
 * Ein Spiel-Tick (50 ms). input = { forward, left (−1 … 1, links positiv), jump, sneak, sprint, toggleFly },
 * world = { collisionBoxes(x, y, z) }. options: { mayFly = true, voidY = -64 }. Verändert player.
 */
export function tickPlayer(player, input, world, { mayFly = true, voidY = -64 } = {}) {
  const p = player;
  p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
  p.prevEyeHeight = p.eyeHeight;
  if (p.noJumpDelay > 0) p.noJumpDelay--;

  const jump = Boolean(input.jump), sneak = Boolean(input.sneak);
  const jumpEdge = jump && !p.wasJumping;
  p.wasJumping = jump;
  const doubleJump = p.jumpTap.step(jumpEdge && mayFly);
  if (mayFly && (doubleJump || input.toggleFly)) {
    p.flying = !p.flying;
    if (p.flying) {
      p.sneaking = false;
      // Wie im Spiel: am Boden abspringen, sonst würde man sofort wieder landen.
      if (p.onGround) jumpFromGround(p);
    }
  }

  if (sneak && !p.flying) p.sneaking = true;
  else if (p.sneaking && fitsAt(world, p, PLAYER.height)) p.sneaking = false;

  const [left, forward] = modifyInput(Number(input.left) || 0, Number(input.forward) || 0, p.sneaking);
  const rawForward = Math.max(-1, Math.min(1, Number(input.forward) || 0));
  const sprintImpulse = rawForward >= 0.8;
  const sprintEdge = sprintImpulse && !p.hadSprintImpulse;
  p.hadSprintImpulse = sprintImpulse;
  const canStart = !p.sprinting && !p.sneaking && sprintImpulse;
  if (p.sprintTap.step(sprintEdge && canStart && (p.onGround || p.flying) && !input.sprint)) p.sprinting = true;
  if (canStart && input.sprint) p.sprinting = true;
  if (p.sprinting && (rawForward <= 1e-5 || p.sneaking || (p.horizontalCollision && !p.minorHorizontalCollision))) p.sprinting = false;

  if (p.flying) {
    const dir = (jump ? 1 : 0) - (sneak ? 1 : 0);
    if (dir !== 0) p.vy += dir * PHYSICS.flySpeed * 3;
  } else if (jump) {
    if (p.onGround && p.noJumpDelay === 0) {
      jumpFromGround(p);
      p.noJumpDelay = PHYSICS.jumpDelayTicks;
    }
  } else {
    p.noJumpDelay = 0;
  }

  // LivingEntity.moveRelative
  const speed = frictionSpeed(p);
  const lengthSq = left * left + forward * forward;
  if (lengthSq >= 1e-7) {
    const norm = lengthSq > 1 ? 1 / Math.sqrt(lengthSq) : 1;
    const ix = left * norm * speed, iz = forward * norm * speed;
    const s = Math.sin(p.yaw * DEG), c = Math.cos(p.yaw * DEG);
    p.vx += ix * c - iz * s;
    p.vz += iz * c + ix * s;
  }

  const flyingVy = p.vy;
  const drag = (p.onGround ? PHYSICS.blockFriction : 1) * PHYSICS.airFriction;
  const height = p.sneaking ? PLAYER.sneakHeight : PLAYER.height;
  const box = playerBox(p.x, p.y, p.z, height);
  let motion = [p.vx, p.vy, p.vz];
  if (p.sneaking && p.onGround && !p.flying) motion = backOffFromEdge(world, box, motion);
  const moved = collideMovement(world, box, motion, { onGround: p.onGround });
  p.x += moved[0]; p.y += moved[1]; p.z += moved[2];

  const blockedX = Math.abs(motion[0] - moved[0]) >= 1e-5;
  const blockedZ = Math.abs(motion[2] - moved[2]) >= 1e-5;
  p.horizontalCollision = blockedX || blockedZ;
  p.minorHorizontalCollision = p.horizontalCollision && isMinorCollision(p, left, forward, moved);
  const verticalCollision = motion[1] !== moved[1];
  p.onGround = verticalCollision && motion[1] < 0;
  if (blockedX) p.vx = 0;
  if (blockedZ) p.vz = 0;
  if (verticalCollision) p.vy = 0;

  p.vy = (p.vy - PHYSICS.gravity) * PHYSICS.verticalDrag;
  p.vx *= drag;
  p.vz *= drag;
  if (p.flying) p.vy = flyingVy * PHYSICS.flyVerticalDrag;
  if (p.flying && p.onGround) p.flying = false;
  if (p.y < voidY) {
    p.y = voidY;
    p.vy = 0;
    p.flying = true;
  }
  const targetEye = p.sneaking ? PLAYER.sneakEyeHeight : PLAYER.eyeHeight;
  p.eyeHeight += (targetEye - p.eyeHeight) * 0.5;
  return p;
}

// Augenposition zwischen den Ticks (alpha 0 … 1).
export function playerEye(player, alpha = 1, out = [0, 0, 0]) {
  const t = Math.max(0, Math.min(1, alpha));
  out[0] = player.prevX + (player.x - player.prevX) * t;
  out[1] = player.prevY + (player.y - player.prevY) * t + player.prevEyeHeight + (player.eyeHeight - player.prevEyeHeight) * t;
  out[2] = player.prevZ + (player.z - player.prevZ) * t;
  return out;
}

export function firstPersonViewMatrix(out, eye, yaw, pitch) {
  const dir = lookVector(yaw, Math.max(-89.99, Math.min(89.99, pitch)));
  return mat4.lookAt(out, eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]], [0, 1, 0]);
}

// ---------------------------------------------------------------- Orbit-Kamera (Bogenmaß)

export const ORBIT_PITCH_LIMIT = 89.9 * DEG;

export function createOrbit({ target = [0, 0, 0], distance = 30, yaw = 45 * DEG, pitch = 30 * DEG, minDistance = 0.5, maxDistance = 4000 } = {}) {
  if (!(minDistance > 0) || !(maxDistance >= minDistance)) throw new Error('createOrbit: ungültige Abstandsgrenzen.');
  const orbit = { target: [...target], distance, yaw, pitch, minDistance, maxDistance };
  return clampOrbit(orbit);
}

function wrapAngle(a) {
  const twoPi = Math.PI * 2;
  let v = (a + Math.PI) % twoPi;
  if (v < 0) v += twoPi;
  return v - Math.PI;
}

export function clampOrbit(orbit) {
  if (![orbit.distance, orbit.yaw, orbit.pitch, ...orbit.target].every(Number.isFinite)) throw new Error('Orbit-Werte müssen endliche Zahlen sein.');
  orbit.distance = Math.max(orbit.minDistance, Math.min(orbit.maxDistance, orbit.distance));
  orbit.pitch = Math.max(-ORBIT_PITCH_LIMIT, Math.min(ORBIT_PITCH_LIMIT, orbit.pitch));
  orbit.yaw = wrapAngle(orbit.yaw);
  return orbit;
}

// Auge = Ziel + Abstand · (cos p · sin y, sin p, cos p · cos y); yaw 0 = Kamera im Süden, Blick nach Norden.
export function orbitEye(orbit, out = [0, 0, 0]) {
  const cp = Math.cos(orbit.pitch);
  out[0] = orbit.target[0] + orbit.distance * cp * Math.sin(orbit.yaw);
  out[1] = orbit.target[1] + orbit.distance * Math.sin(orbit.pitch);
  out[2] = orbit.target[2] + orbit.distance * cp * Math.cos(orbit.yaw);
  return out;
}

export function orbitViewMatrix(out, orbit) {
  return mat4.lookAt(out, orbitEye(orbit), orbit.target, [0, 1, 0]);
}

export function orbitRotate(orbit, dYaw, dPitch) {
  orbit.yaw += dYaw;
  orbit.pitch += dPitch;
  return clampOrbit(orbit);
}

export function orbitZoom(orbit, factor) {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new Error(`orbitZoom: Faktor ${factor} ungültig.`);
  orbit.distance *= factor;
  return clampOrbit(orbit);
}

// Verschiebt das Ziel so, dass der Punkt in Zieltiefe dem Zeiger folgt (dx/dy in CSS-Pixeln).
export function orbitPan(orbit, dx, dy, viewportHeight, fovY) {
  if (!(viewportHeight > 0)) return orbit;
  const unitsPerPixel = (2 * orbit.distance * Math.tan(fovY / 2)) / viewportHeight;
  const sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw), sp = Math.sin(orbit.pitch), cp = Math.cos(orbit.pitch);
  const right = [cy, 0, -sy];
  const up = [-sp * sy, cp, -sp * cy];
  for (let i = 0; i < 3; i++) orbit.target[i] += (-dx * right[i] + dy * up[i]) * unitsPerPixel;
  return clampOrbit(orbit);
}

// Abstand, bei dem eine Kugel mit Radius r ganz ins Bild passt.
export function orbitFitDistance(radius, fovY, aspect) {
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  return radius / Math.sin(Math.min(fovY, fovX) / 2);
}

// Weiches Nachführen: current nähert sich goal (Zeitkonstante tauMs; 0 = sofort). Gibt true zurück, solange es sich bewegt.
export function approachOrbit(current, goal, dtMs, tauMs) {
  const k = tauMs > 0 ? 1 - Math.exp(-Math.max(0, dtMs) / tauMs) : 1;
  let moving = false;
  const blend = (a, b, threshold) => {
    const v = a + (b - a) * k;
    if (Math.abs(b - v) > threshold) {
      moving = true;
      return v;
    }
    return b;
  };
  const yawDelta = wrapAngle(goal.yaw - current.yaw);
  current.yaw = wrapAngle(blend(current.yaw, current.yaw + yawDelta, 1e-5));
  current.pitch = blend(current.pitch, goal.pitch, 1e-5);
  current.distance = blend(current.distance, goal.distance, current.distance * 1e-5);
  for (let i = 0; i < 3; i++) current.target[i] = blend(current.target[i], goal.target[i], 1e-4);
  current.minDistance = goal.minDistance;
  current.maxDistance = goal.maxDistance;
  return moving;
}

// ---------------------------------------------------------------- Gemeinsame DOM-Helfer

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isTypingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

function makeFocusable(element) {
  if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
  element.style.touchAction = 'none';
}

function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

function wheelPixels(event, element) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * (element.clientHeight || 800);
  return event.deltaY;
}

// ---------------------------------------------------------------- OrbitControls

const ORBIT_ROTATE_PER_PIXEL = 0.006;
const ORBIT_KEY_ROTATE_PER_SECOND = 90 * DEG;
const ORBIT_KEY_PAN_PIXELS_PER_SECOND = 420;
const ORBIT_KEY_ZOOM_PER_SECOND = 2.2;
const ORBIT_SMOOTHING_MS = 70;
const TAP_MAX_MOVE = 6;
const TAP_MAX_MS = 500;
const ORBIT_KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  PageUp: 'in', PageDown: 'out', NumpadAdd: 'in', NumpadSubtract: 'out', Equal: 'in', Minus: 'out',
};

/**
 * Orbit: Ziehen = drehen, Rechtsziehen/Mittelziehen/Umschalt+Ziehen/zwei Finger = verschieben,
 * Rad/Pinch = zoomen, Pfeiltasten drehen (mit Umschalt verschieben), +/− und Bild↑/↓ zoomen, Pos1 = Startansicht.
 * options: { target, distance, yaw, pitch (Bogenmaß), minDistance, maxDistance, fovY, onChange(orbit), onTap({ x, y, button, pointerType }) }
 */
export class OrbitControls {
  #element;
  #goal;
  #current;
  #home;
  #fovY;
  #enabled = true;
  #pointers = new Map();
  #keys = new Map();
  #shift = false;
  #pinch = null;
  #tap = null;
  #offs = [];
  #onChange;
  #onTap;
  #dirty = true;

  constructor(element, { fovY = 70 * DEG, onChange = null, onTap = null, ...orbitOptions } = {}) {
    if (!element || typeof element.addEventListener !== 'function') throw new Error('OrbitControls braucht ein DOM-Element.');
    this.#element = element;
    this.#goal = createOrbit(orbitOptions);
    this.#current = structuredClone(this.#goal);
    this.#home = structuredClone(this.#goal);
    this.#fovY = fovY;
    this.#onChange = onChange;
    this.#onTap = onTap;
    makeFocusable(element);
    this.#offs.push(
      listen(element, 'pointerdown', (e) => this.#pointerDown(e)),
      listen(element, 'pointermove', (e) => this.#pointerMove(e)),
      listen(element, 'pointerup', (e) => this.#pointerUp(e, true)),
      listen(element, 'pointercancel', (e) => this.#pointerUp(e, false)),
      listen(element, 'lostpointercapture', (e) => this.#pointerUp(e, false)),
      listen(element, 'wheel', (e) => this.#wheel(e), { passive: false }),
      listen(element, 'contextmenu', (e) => { if (this.#enabled) e.preventDefault(); }),
      listen(element, 'keydown', (e) => this.#keyDown(e)),
      listen(element, 'keyup', (e) => this.#keyUp(e)),
      listen(element, 'blur', () => this.#keys.clear()),
    );
  }

  get enabled() { return this.#enabled; }

  set enabled(value) {
    this.#enabled = Boolean(value);
    if (!this.#enabled) {
      this.#pointers.clear();
      this.#keys.clear();
      this.#pinch = null;
      this.#tap = null;
    }
  }

  get fovY() { return this.#fovY; }
  set fovY(value) {
    if (!(value > 0 && value < Math.PI)) throw new Error(`fovY ${value} ungültig.`);
    this.#fovY = value;
  }

  // Aktueller (geglätteter) Stand als Kopie.
  get orbit() { return structuredClone(this.#current); }

  setView(view, { animate = true } = {}) {
    const next = { ...this.#goal, ...view, target: view.target ? [...view.target] : [...this.#goal.target] };
    this.#goal = clampOrbit(next);
    if (!animate || prefersReducedMotion()) this.#current = structuredClone(this.#goal);
    this.#dirty = true;
  }

  // Startansicht für Pos1 merken (z. B. nach dem Laden eines Baus).
  setHome(view = this.#goal) {
    this.#home = clampOrbit({ ...structuredClone(this.#goal), ...structuredClone(view) });
  }

  // Einmal pro Bild aufrufen. Gibt true zurück, wenn sich die Kamera bewegt hat.
  update(dtMs) {
    const seconds = Math.min(0.1, Math.max(0, dtMs) / 1000);
    if (this.#enabled && this.#keys.size > 0) this.#applyKeys(seconds);
    const moving = approachOrbit(this.#current, this.#goal, dtMs, prefersReducedMotion() ? 0 : ORBIT_SMOOTHING_MS);
    const changed = moving || this.#dirty;
    this.#dirty = moving;
    if (changed && this.#onChange) this.#onChange(this.orbit);
    return changed;
  }

  viewMatrix(out = mat4.create()) {
    return orbitViewMatrix(out, this.#current);
  }

  eye(out = [0, 0, 0]) {
    return orbitEye(this.#current, out);
  }

  dispose() {
    for (const off of this.#offs) off();
    this.#offs = [];
    this.#pointers.clear();
    this.#keys.clear();
  }

  #changed() {
    this.#dirty = true;
  }

  #pointerDown(event) {
    if (!this.#enabled) return;
    if (event.pointerType === 'mouse' && event.button > 2) return;
    this.#element.focus({ preventScroll: true });
    this.#element.setPointerCapture?.(event.pointerId);
    const mode = event.pointerType === 'mouse' && (event.button === 1 || event.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey) ? 'pan' : 'rotate';
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, mode });
    this.#tap = this.#pointers.size === 1
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, button: event.button, pointerType: event.pointerType, moved: 0 }
      : null;
    if (this.#pointers.size === 2) this.#startPinch();
    event.preventDefault();
  }

  #fingers() {
    const [a, b] = [...this.#pointers.values()];
    return { spread: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  // Pinch wird absolut vom Start der Geste gerechnet: die Finger melden sich einzeln, schrittweises
  // Verrechnen würde das Ziel sonst wandern lassen.
  #startPinch() {
    this.#pinch = { ...this.#fingers(), distance: this.#goal.distance, target: [...this.#goal.target] };
  }

  #pointerMove(event) {
    const pointer = this.#pointers.get(event.pointerId);
    if (!pointer || !this.#enabled) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (this.#tap && this.#tap.id === event.pointerId) this.#tap.moved = Math.max(this.#tap.moved, Math.hypot(event.clientX - this.#tap.x, event.clientY - this.#tap.y));
    if (this.#pointers.size >= 2) {
      const now = this.#fingers();
      const start = this.#pinch;
      if (start && now.spread > 0 && start.spread > 0) {
        this.#goal.distance = (start.distance * start.spread) / now.spread;
        this.#goal.target = [...start.target];
        clampOrbit(this.#goal);
        orbitPan(this.#goal, now.cx - start.cx, now.cy - start.cy, this.#element.clientHeight, this.#fovY);
      }
    } else if (pointer.mode === 'pan') {
      orbitPan(this.#goal, dx, dy, this.#element.clientHeight, this.#fovY);
    } else {
      orbitRotate(this.#goal, -dx * ORBIT_ROTATE_PER_PIXEL, dy * ORBIT_ROTATE_PER_PIXEL);
    }
    this.#changed();
  }

  #pointerUp(event, released) {
    if (!this.#pointers.has(event.pointerId)) return;
    this.#pointers.delete(event.pointerId);
    this.#element.releasePointerCapture?.(event.pointerId);
    const tap = this.#tap;
    if (released && tap && tap.id === event.pointerId && tap.moved <= TAP_MAX_MOVE && event.timeStamp - tap.time <= TAP_MAX_MS && this.#onTap) {
      const rect = this.#element.getBoundingClientRect();
      this.#onTap({ x: event.clientX - rect.left, y: event.clientY - rect.top, button: tap.button, pointerType: tap.pointerType });
    }
    if (!tap || tap.id === event.pointerId) this.#tap = null;
    if (this.#pointers.size >= 2) this.#startPinch();
    else this.#pinch = null;
  }

  #wheel(event) {
    if (!this.#enabled) return;
    event.preventDefault();
    const pixels = wheelPixels(event, this.#element);
    // Strg+Rad = Pinch auf dem Touchpad (feinere Werte)
    orbitZoom(this.#goal, Math.exp(pixels * (event.ctrlKey ? 0.01 : 0.0015)));
    this.#changed();
  }

  #keyDown(event) {
    this.#shift = event.shiftKey;
    if (!this.#enabled || event.altKey || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return;
    if (event.code === 'Home') {
      this.setView(this.#home);
      event.preventDefault();
      return;
    }
    const action = ORBIT_KEYS[event.code] ?? (event.key === '+' ? 'in' : event.key === '-' ? 'out' : null);
    if (!action) return;
    this.#keys.set(event.code, action);
    event.preventDefault();
  }

  #keyUp(event) {
    this.#shift = event.shiftKey;
    this.#keys.delete(event.code);
  }

  #applyKeys(seconds) {
    const actions = new Set(this.#keys.values());
    const has = (action) => actions.has(action);
    const h = (has('right') ? 1 : 0) - (has('left') ? 1 : 0);
    const v = (has('down') ? 1 : 0) - (has('up') ? 1 : 0);
    const zoom = (has('out') ? 1 : 0) - (has('in') ? 1 : 0);
    if (h || v) {
      if (this.#shift) {
        const step = ORBIT_KEY_PAN_PIXELS_PER_SECOND * seconds;
        orbitPan(this.#goal, -h * step, -v * step, this.#element.clientHeight || 600, this.#fovY);
      } else {
        orbitRotate(this.#goal, -h * ORBIT_KEY_ROTATE_PER_SECOND * seconds, -v * ORBIT_KEY_ROTATE_PER_SECOND * seconds);
      }
      this.#changed();
    }
    if (zoom) {
      orbitZoom(this.#goal, Math.exp(zoom * ORBIT_KEY_ZOOM_PER_SECOND * seconds * 0.5));
      this.#changed();
    }
  }
}

// ---------------------------------------------------------------- WalkControls

const WALK_KEYS = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  Space: 'jump', ShiftLeft: 'sneak', ShiftRight: 'sneak', ControlLeft: 'sprint', ControlRight: 'sprint',
  ArrowLeft: 'turnLeft', ArrowRight: 'turnRight', ArrowUp: 'lookUp', ArrowDown: 'lookDown',
};
const KEY_TURN_DEGREES_PER_SECOND = 120;
const TOUCH_LOOK_DEGREES_PER_PIXEL = 0.28;
const JOYSTICK_RADIUS = 48;
// Alt, Cmd und Windows-Taste gehören System und Browser: Solange sie gehalten werden, kann das keyup anderer Tasten
// fehlen (macOS meldet bei gehaltener Cmd-Taste kein keyup, Alt und Windows-Taste öffnen Menüs).
const SYSTEM_KEYS = new Set(['AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight']);

function safeCapture(element, pointerId, capture) {
  try {
    if (capture) element.setPointerCapture?.(pointerId);
    else element.releasePointerCapture?.(pointerId);
  } catch {
    // Chrome lehnt das Fangen ab, solange eine Zeigersperre angefragt ist; das Ende des Ziehens erkennt pointermove
  }
}

function createTouchButton(label, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm walk-touch__button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  Object.assign(button.style, { pointerEvents: 'auto', minWidth: '88px', minHeight: '48px', touchAction: 'none' });
  return button;
}

/**
 * Laufen/Fliegen wie im Spiel: WASD, Maus (Pointer Lock nach Klick; sonst Ziehen), Leertaste springen,
 * doppelt Leertaste = Fliegen an/aus, Umschalt = schleichen/runter, Strg (oder doppelt W) = sprinten,
 * Pfeiltasten drehen/neigen den Blick, Esc = alles loslassen und beenden (onExit). Touch: Joystick links,
 * Blicken durch Ziehen, Knöpfe Springen/Fliegen/Hoch/Runter.
 * Nichts bleibt hängen, wenn der Browser ein keyup verschluckt: Ein- und Ausschalten, Ende der Zeigersperre, Vollbild-
 * Wechsel, Fokusverlust, Kontextmenü außerhalb der Ansicht und Alt/Cmd/Windows-Taste lassen alle Tasten los;
 * Strg/Umschalt folgen dem Zustand, den jedes Tasten- und Mausereignis meldet; ohne Finger auf dem Bildschirm
 * ist nichts Berührtes mehr gehalten.
 * options: { world: { collisionBoxes(x, y, z) }, position: [x, y, z] (Füße), yaw, pitch (Grad), flying, mayFly,
 *            voidY, sensitivity (Grad je Pixel, wie im Spiel 0,15), overlayParent, onExit(), onChange(player) }
 */
export class WalkControls {
  #element;
  #world;
  #player;
  #options;
  #enabled = false;
  #keys = new Set();
  #latched = new Set();
  #accumulator = 0;
  #offs = [];
  #activeOffs = [];
  #look = null;
  #stick = { id: null, left: 0, forward: 0 };
  // Gehaltene Touch-Knöpfe: Zeiger-ID → Aktion (jeder Finger lässt nur seinen Knopf los)
  #touchHeld = new Map();
  #overlay = null;
  #touchUsed = false;
  #unloadGuard = null;
  #pendingFlyToggle = false;

  constructor(element, { world, position = [0, 0, 0], yaw = 0, pitch = 0, flying = false, mayFly = true, voidY = -64,
    sensitivity = 0.15, overlayParent = null, onExit = null, onChange = null } = {}) {
    if (!element || typeof element.addEventListener !== 'function') throw new Error('WalkControls braucht ein DOM-Element.');
    if (!world || typeof world.collisionBoxes !== 'function') throw new Error('WalkControls braucht world.collisionBoxes(x, y, z).');
    this.#element = element;
    this.#world = world;
    this.#player = createPlayer({ position, yaw, pitch, flying });
    this.#options = { mayFly, voidY, sensitivity, overlayParent, onExit, onChange };
    makeFocusable(element);
    this.#offs.push(
      listen(element, 'pointerdown', (e) => this.#pointerDown(e)),
      listen(element, 'pointermove', (e) => this.#pointerMove(e)),
      listen(element, 'pointerup', (e) => this.#pointerUp(e)),
      listen(element, 'pointercancel', (e) => this.#pointerUp(e)),
      listen(element, 'lostpointercapture', (e) => this.#pointerUp(e)),
    );
  }

  get player() { return this.#player; }
  get enabled() { return this.#enabled; }

  set enabled(value) {
    const next = Boolean(value);
    if (next === this.#enabled) return;
    this.#enabled = next;
    // Beim Ein- und Ausschalten ist alles losgelassen: keyup-Ereignisse aus der Zeit dazwischen fehlen
    this.#releaseAll();
    this.#pendingFlyToggle = false;
    if (next) {
      const doc = this.#element.ownerDocument;
      const win = doc.defaultView;
      const touchOptions = { capture: true, passive: true };
      this.#activeOffs.push(
        listen(win, 'keydown', (e) => this.#keyDown(e)),
        listen(win, 'keyup', (e) => this.#keyUp(e)),
        listen(win, 'blur', () => this.#releaseAll()),
        listen(win, 'contextmenu', (e) => this.#contextMenu(e)),
        listen(doc, 'visibilitychange', () => { if (doc.hidden) this.#releaseAll(); }),
        listen(doc, 'pointerlockchange', () => this.#pointerLockChange()),
        listen(doc, 'fullscreenchange', () => this.#releaseAll()),
        listen(doc, 'mousemove', (e) => this.#lockedMouseMove(e)),
        listen(doc, 'pointerup', (e) => this.#pointerEnded(e), true),
        listen(doc, 'pointercancel', (e) => this.#pointerEnded(e), true),
        listen(doc, 'touchend', (e) => this.#touchEnded(e), touchOptions),
        listen(doc, 'touchcancel', (e) => this.#touchEnded(e), touchOptions),
      );
      this.#accumulator = 0;
      if (this.#touchUsed || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)) this.#showOverlay();
    } else {
      for (const off of this.#activeOffs) off();
      this.#activeOffs = [];
      this.#hideOverlay();
      this.exitPointerLock();
    }
  }

  teleport(position, { yaw = this.#player.yaw, pitch = this.#player.pitch, flying = this.#player.flying } = {}) {
    this.#player = createPlayer({ position, yaw, pitch, flying });
    this.#accumulator = 0;
    this.#updateOverlay();
  }

  requestPointerLock() {
    if (!this.#element.requestPointerLock || this.#isLocked()) return;
    try {
      const result = this.#element.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch((error) => console.warn('Pointer Lock nicht möglich:', error.message));
    } catch (error) {
      console.warn('Pointer Lock nicht möglich:', error.message);
    }
  }

  exitPointerLock() {
    if (this.#isLocked()) this.#element.ownerDocument.exitPointerLock();
  }

  // Einmal pro Bild aufrufen; führt die fälligen 50-ms-Ticks aus. Gibt true zurück, wenn sich etwas bewegt hat.
  update(dtMs) {
    if (!this.#enabled) return false;
    const seconds = Math.min(0.1, Math.max(0, dtMs) / 1000);
    this.#applyKeyLook(seconds);
    this.#accumulator += Math.max(0, dtMs);
    let ticks = Math.floor(this.#accumulator / TICK_MS);
    if (ticks > MAX_TICKS_PER_FRAME) {
      ticks = MAX_TICKS_PER_FRAME;
      this.#accumulator = ticks * TICK_MS;
    }
    for (let i = 0; i < ticks; i++) {
      const wasFlying = this.#player.flying;
      tickPlayer(this.#player, this.#input(), this.#world, this.#options);
      this.#latched.clear();
      if (wasFlying !== this.#player.flying) this.#updateOverlay();
    }
    this.#accumulator -= ticks * TICK_MS;
    if (this.#options.onChange) this.#options.onChange(this.#player);
    return true;
  }

  // Augenposition (interpoliert).
  eye(out = [0, 0, 0]) {
    return playerEye(this.#player, this.#accumulator / TICK_MS, out);
  }

  viewMatrix(out = mat4.create()) {
    return firstPersonViewMatrix(out, this.eye(), this.#player.yaw, this.#player.pitch);
  }

  dispose() {
    this.enabled = false;
    for (const off of this.#offs) off();
    this.#offs = [];
    this.#overlay?.root.remove();
    this.#overlay = null;
  }

  #isLocked() {
    return this.#element.ownerDocument.pointerLockElement === this.#element;
  }

  #held(action) {
    for (const code of this.#keys) if (WALK_KEYS[code] === action) return true;
    for (const code of this.#latched) if (WALK_KEYS[code] === action) return true;
    for (const held of this.#touchHeld.values()) if (held === action) return true;
    return false;
  }

  // Tastatur gehört der Ansicht: Zeigersperre, Fokus auf dem Canvas oder auf der Touch-Steuerung
  #keyboardFocused() {
    const doc = this.#element.ownerDocument;
    return this.#isLocked() || doc.activeElement === this.#element || Boolean(this.#overlay?.root.contains(doc.activeElement));
  }

  #input() {
    const forward = (this.#held('forward') ? 1 : 0) - (this.#held('back') ? 1 : 0);
    const left = (this.#held('left') ? 1 : 0) - (this.#held('right') ? 1 : 0);
    const keyLength = Math.hypot(forward, left);
    const useStick = this.#stick.id !== null && keyLength === 0;
    const toggleFly = this.#pendingFlyToggle;
    this.#pendingFlyToggle = false;
    return {
      forward: useStick ? this.#stick.forward : keyLength > 0 ? forward / keyLength : 0,
      left: useStick ? this.#stick.left : keyLength > 0 ? left / keyLength : 0,
      jump: this.#held('jump'),
      sneak: this.#held('sneak'),
      sprint: this.#held('sprint') || (useStick && Math.hypot(this.#stick.forward, this.#stick.left) > 0.95 && this.#stick.forward > 0.8),
      toggleFly,
    };
  }

  #turn(dYaw, dPitch) {
    const p = this.#player;
    p.yaw = ((p.yaw + dYaw) % 360 + 360) % 360;
    p.pitch = Math.max(-90, Math.min(90, p.pitch + dPitch));
  }

  #applyKeyLook(seconds) {
    const h = (this.#held('turnRight') ? 1 : 0) - (this.#held('turnLeft') ? 1 : 0);
    const v = (this.#held('lookDown') ? 1 : 0) - (this.#held('lookUp') ? 1 : 0);
    if (h || v) this.#turn(h * KEY_TURN_DEGREES_PER_SECOND * seconds, v * KEY_TURN_DEGREES_PER_SECOND * seconds);
  }

  #keyDown(event) {
    if (!this.#enabled) return;
    this.#syncModifiers(event);
    // Esc lässt immer alles los, auch wenn der Fokus woanders liegt; beendet wird nur aus der Ansicht heraus
    if (event.code === 'Escape') {
      this.#releaseAll();
      if (!this.#isLocked() && this.#keyboardFocused() && !isTypingTarget(event.target) && this.#options.onExit) this.#options.onExit();
      return;
    }
    if (event.altKey || event.metaKey || SYSTEM_KEYS.has(event.code)) {
      this.#releaseKeys();
      return;
    }
    if (isTypingTarget(event.target) || !this.#keyboardFocused()) return;
    const action = WALK_KEYS[event.code];
    if (!action) return;
    if (action === 'sprint') this.#guardUnload(true);
    this.#keys.add(event.code);
    this.#latched.add(event.code);
    // Auch mit gehaltenem Strg (Sprinten): Strg+S/D/A nicht an den Browser weitergeben.
    event.preventDefault();
  }

  // Loslassen braucht kein vorheriges Drücken und keinen Fokus: jedes keyup beendet seine Taste
  #keyUp(event) {
    if (!this.#enabled) return;
    this.#syncModifiers(event);
    if (SYSTEM_KEYS.has(event.code)) {
      // macOS: Was während der gehaltenen Cmd-Taste losgelassen wurde, hat kein keyup geschickt
      this.#releaseKeys();
      return;
    }
    if (!this.#keys.delete(event.code)) return;
    if (WALK_KEYS[event.code] === 'sprint' && !this.#held('sprint')) this.#guardUnload(false);
  }

  // Strg und Umschalt melden ihren Zustand mit jedem Tasten- und Mausereignis: Ein verlorenes keyup
  // (z. B. nach der Rückfrage bei Strg+W) heilt so beim nächsten Ereignis.
  #syncModifiers(event) {
    const code = typeof event.code === 'string' ? event.code : '';
    let dropped = false;
    for (const held of [...this.#keys]) {
      const stale = (held.startsWith('Control') && event.ctrlKey === false && !code.startsWith('Control'))
        || (held.startsWith('Shift') && event.shiftKey === false && !code.startsWith('Shift'));
      if (stale) {
        this.#keys.delete(held);
        dropped = true;
      }
    }
    if (dropped && !this.#held('sprint')) this.#guardUnload(false);
  }

  #releaseKeys() {
    this.#keys.clear();
    this.#latched.clear();
    this.#guardUnload(false);
  }

  #releaseTouch() {
    this.#touchHeld.clear();
    this.#resetStick();
    if (this.#look?.type === 'touch') this.#look = null;
  }

  #releaseAll() {
    this.#releaseKeys();
    this.#releaseTouch();
    this.#look = null;
    this.#updateOverlay();
  }

  #resetStick() {
    this.#stick = { id: null, left: 0, forward: 0 };
    if (this.#overlay) this.#overlay.knob.style.transform = '';
  }

  // Esc beendet die Zeigersperre im Browser selbst: Die Seite sieht die Taste nicht, und Chrome verschluckt danach
  // alle keyup bis zum nächsten Tastendruck. Darum hier alles loslassen (wie das Spiel beim Öffnen des Menüs).
  #pointerLockChange() {
    if (!this.#isLocked()) this.#releaseAll();
    this.#element.focus({ preventScroll: true });
  }

  // Im Lauf-Modus kein Kontextmenü über der Ansicht; ein Menü anderswo schluckt die keyup-Ereignisse
  #contextMenu(event) {
    const target = event.target;
    const ours = target === this.#element || Boolean(this.#overlay && typeof target?.nodeType === 'number' && this.#overlay.root.contains(target));
    if (ours) {
      event.preventDefault();
      return;
    }
    if (!event.defaultPrevented) this.#releaseAll();
  }

  // Ende eines Zeigers irgendwo auf der Seite (auch wenn das Fangen verloren ging)
  #pointerEnded(event) {
    const id = event.pointerId;
    this.#touchHeld.delete(id);
    if (this.#stick.id === id) this.#resetStick();
    if (this.#look?.id === id) this.#endLook(id);
  }

  // Kein Finger mehr auf dem Bildschirm: nichts Berührtes kann noch gehalten sein
  #touchEnded(event) {
    if (event.touches && event.touches.length > 0) return;
    this.#releaseTouch();
  }

  // Strg+W schließt im Browser den Tab und lässt sich nicht abfangen. Solange Strg gehalten wird,
  // fragt der Browser deshalb vor dem Schließen nach.
  #guardUnload(active) {
    const win = this.#element.ownerDocument.defaultView;
    if (active && !this.#unloadGuard) {
      this.#unloadGuard = (event) => {
        event.preventDefault();
        event.returnValue = '';
      };
      win.addEventListener('beforeunload', this.#unloadGuard);
    } else if (!active && this.#unloadGuard) {
      win.removeEventListener('beforeunload', this.#unloadGuard);
      this.#unloadGuard = null;
    }
  }

  #lockedMouseMove(event) {
    if (!this.#enabled) return;
    this.#syncModifiers(event);
    if (!this.#isLocked()) return;
    const s = this.#options.sensitivity;
    this.#turn(event.movementX * s, event.movementY * s);
  }

  #pointerDown(event) {
    if (!this.#enabled) return;
    this.#syncModifiers(event);
    this.#element.focus({ preventScroll: true });
    if (event.pointerType === 'touch') {
      if (!this.#touchUsed) {
        this.#touchUsed = true;
        this.#showOverlay();
      }
    } else if (event.pointerType === 'mouse' && event.button === 0 && !this.#isLocked()) {
      this.requestPointerLock();
    }
    // Ein zweiter Finger dreht nicht mit; derselbe Zeiger ersetzt ein Ziehen, dessen Ende verloren ging
    if (this.#isLocked() || (this.#look && this.#look.id !== event.pointerId)) return;
    safeCapture(this.#element, event.pointerId, true);
    this.#look = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY };
    event.preventDefault();
  }

  #pointerMove(event) {
    if (!this.#look || this.#look.id !== event.pointerId) return;
    // Maus ohne gedrückte Taste: Das Loslassen ging verloren (z. B. außerhalb des Fensters) → Ziehen beenden
    if (event.pointerType !== 'touch' && event.buttons === 0) {
      this.#endLook(event.pointerId);
      return;
    }
    if (this.#isLocked()) return;
    const dx = event.clientX - this.#look.x, dy = event.clientY - this.#look.y;
    this.#look.x = event.clientX;
    this.#look.y = event.clientY;
    const perPixel = event.pointerType === 'touch' ? TOUCH_LOOK_DEGREES_PER_PIXEL : this.#options.sensitivity * 2;
    this.#turn(dx * perPixel, dy * perPixel);
  }

  #pointerUp(event) {
    if (this.#look && this.#look.id === event.pointerId) this.#endLook(event.pointerId);
  }

  #endLook(pointerId) {
    this.#look = null;
    safeCapture(this.#element, pointerId, false);
  }

  #showOverlay() {
    if (typeof document === 'undefined') return;
    if (!this.#overlay) this.#overlay = this.#createOverlay();
    this.#overlay.root.hidden = false;
    this.#updateOverlay();
  }

  #hideOverlay() {
    if (this.#overlay) this.#overlay.root.hidden = true;
  }

  #createOverlay() {
    const parent = this.#options.overlayParent ?? this.#element.parentElement;
    if (!parent) throw new Error('WalkControls: Touch-Steuerung braucht ein Eltern-Element (overlayParent).');
    const root = document.createElement('div');
    root.className = 'walk-touch';
    Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '3', userSelect: 'none' });

    const stick = document.createElement('div');
    stick.className = 'walk-touch__stick';
    stick.setAttribute('role', 'presentation');
    Object.assign(stick.style, {
      position: 'absolute', left: '16px', bottom: '16px', width: `${JOYSTICK_RADIUS * 2 + 16}px`, height: `${JOYSTICK_RADIUS * 2 + 16}px`,
      borderRadius: '50%', background: 'rgb(15 17 20 / 0.55)', border: '2px solid rgb(236 232 223 / 0.35)',
      pointerEvents: 'auto', touchAction: 'none',
    });
    const knob = document.createElement('div');
    knob.className = 'walk-touch__knob';
    Object.assign(knob.style, {
      position: 'absolute', left: '50%', top: '50%', width: '48px', height: '48px', margin: '-24px 0 0 -24px',
      borderRadius: '50%', background: 'rgb(236 232 223 / 0.85)', boxShadow: '0 3px 0 rgb(0 0 0 / 0.4)',
    });
    stick.append(knob);

    const buttons = document.createElement('div');
    buttons.className = 'walk-touch__buttons';
    Object.assign(buttons.style, {
      position: 'absolute', right: '16px', bottom: '16px', display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, auto)', pointerEvents: 'none',
    });
    const jump = createTouchButton('Springen', 'Springen');
    const fly = createTouchButton('Fliegen', 'Fliegen ein- oder ausschalten');
    const up = createTouchButton('Hoch', 'Hochfliegen');
    const down = createTouchButton('Runter', 'Runterfliegen oder schleichen');
    buttons.append(up, down, jump, fly);
    root.append(stick, buttons);
    parent.append(root);

    const hold = (button, action) => {
      const press = (event) => {
        event.preventDefault();
        safeCapture(button, event.pointerId, true);
        this.#touchHeld.set(event.pointerId, action);
        if (action === 'jump') this.#latched.add('Space');
      };
      const release = (event) => this.#touchHeld.delete(event.pointerId);
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    };
    hold(jump, 'jump');
    hold(up, 'jump');
    hold(down, 'sneak');
    // Beim Drücken auslösen: einen Tipp direkt nach schnellem Wischen meldet der Browser oft nicht als click.
    // click mit detail 0 = Tastatur (Enter/Leertaste auf dem fokussierten Knopf).
    fly.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.#options.mayFly) this.#pendingFlyToggle = true;
    });
    fly.addEventListener('click', (event) => {
      if (event.detail === 0 && this.#options.mayFly) this.#pendingFlyToggle = true;
    });

    const moveStick = (event) => {
      const rect = stick.getBoundingClientRect();
      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy);
      if (length > JOYSTICK_RADIUS) {
        dx = (dx / length) * JOYSTICK_RADIUS;
        dy = (dy / length) * JOYSTICK_RADIUS;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.#stick.left = -dx / JOYSTICK_RADIUS;
      this.#stick.forward = -dy / JOYSTICK_RADIUS;
    };
    stick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      safeCapture(stick, event.pointerId, true);
      this.#stick.id = event.pointerId;
      moveStick(event);
    });
    stick.addEventListener('pointermove', (event) => {
      if (this.#stick.id === event.pointerId) moveStick(event);
    });
    const endStick = (event) => {
      if (this.#stick.id === event.pointerId) this.#resetStick();
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    stick.addEventListener('lostpointercapture', endStick);
    return { root, knob, jump, fly, up, down };
  }

  #updateOverlay() {
    const overlay = this.#overlay;
    if (!overlay) return;
    const flying = this.#player.flying;
    overlay.up.hidden = !flying;
    overlay.down.hidden = !flying;
    overlay.jump.hidden = flying;
    overlay.fly.hidden = !this.#options.mayFly;
    overlay.fly.textContent = flying ? 'Landen' : 'Fliegen';
    overlay.fly.setAttribute('aria-pressed', String(flying));
    if (this.#stick.id === null) overlay.knob.style.transform = '';
  }
}
