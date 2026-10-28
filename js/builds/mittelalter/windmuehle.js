// Windmühle – runde Turmwindmühle aus Stein mit Galerie, Kegelkappe aus Schwarzeiche und vier Flügeln.
// Rahmen: Turmmitte bei (0, 0), Flügelkreuz an der Südseite (+z), Tür im Westen; Wiese auf y = 0.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, doorway, lightRoom, tree, bush, path, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'windmuehle',
  title: 'Windmühle',
  category: 'mittelalter',
  subtitle: 'Runde Turmwindmühle aus Stein mit Galerie und Flügelkreuz',
  tags: ['Mittelalter', 'Dorf', 'Mühle', 'Windmühle', 'Turm', 'Landwirtschaft', 'Feld', 'Rund'],
  aliases: [
    'windmühle', 'windmuehle', 'windmuhle', 'windmüle', 'wind mühle', 'mühle', 'muehle', 'turmwindmühle', 'turmmühle',
    'getreidemühle', 'kornmühle', 'steinmühle', 'windmill', 'wind mill', 'tower mill', 'medieval windmill', 'stone windmill',
    'minecraft windmühle',
  ],
  accuracy: 'eigenes',
  description: 'Eine runde Turmwindmühle: unten ein Bruchsteinturm mit 11 Blöcken Durchmesser, darüber ein schlankerer Steinziegelturm mit Galerie, obenauf eine kegelförmige Kappe aus Schwarzeiche. Vier Flügel mit Zaunrahmen und weißer Wollbespannung drehen sich vor der Südseite. Innen geht es über Leitern vom Mehllager mit der Mehlrutsche zum Mahlboden mit den Mühlsteinen, weiter zum Kornboden und bis in die Kappe mit Kammrad und Flügelwelle; daneben liegt ein kleines Weizenfeld.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

// Turm: unten Radius 5 (Ebenen 1 … 5), oben Radius 4 (6 … 13); Böden auf 5, 10 und 14 (Kappe).
const LOW_R = 5;
const HIGH_R = 4;
const LOW_TOP = 5;
const HIGH_TOP = 13;
const CAP_Y = 14;
const HUB = { y: 16, z: 7 };
const ARM = 9;

const key = (x, z) => `${x},${z}`;

// Kreisfläche: alle Felder mit Abstand ≤ r + 0,5 zur Mitte (wie b.disc).
function discCells(r) {
  const cells = [];
  const n = Math.ceil(r + 0.5);
  for (let z = -n; z <= n; z++) for (let x = -n; x <= n; x++) if (Math.hypot(x, z) <= r + 0.5) cells.push([x, z]);
  return cells;
}

// Rand der Kreisfläche: Felder, die seitlich an ein Feld außerhalb grenzen (dicht, wie ein hohler Zylinder).
function ringCells(r) {
  const inside = new Set(discCells(r).map(([x, z]) => key(x, z)));
  return discCells(r).filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inside.has(key(x + dx, z + dz))));
}

function innerCells(r) {
  const ring = new Set(ringCells(r).map(([x, z]) => key(x, z)));
  return discCells(r).filter(([x, z]) => !ring.has(key(x, z)));
}

// Treppe mit der hohen Seite zur Turmmitte.
function facingToCenter(x, z) {
  if (Math.abs(x) >= Math.abs(z)) return x > 0 ? 'west' : 'east';
  return z > 0 ? 'north' : 'south';
}

function lowerStone(x, y, z) {
  const h = hashPosition(x, y, z, 913) % 20;
  if (y <= 2 && h < 7) return 'mossy_cobblestone';
  if (h < 3) return 'andesite';
  return 'cobblestone';
}

function upperStone(x, y, z) {
  const h = hashPosition(x, y, z, 914) % 20;
  if (h < 2) return 'cracked_stone_bricks';
  if (h < 4) return 'mossy_stone_bricks';
  return 'stone_bricks';
}

function ground(b) {
  b.phase('Gelände und Fundament');
  b.step();
  b.fill(-15, 0, -14, 20, 0, 14, 'grass_block');
  for (const [x, z] of ringCells(LOW_R)) b.set(x, 0, z, 'cobblestone');
  for (const [x, z] of innerCells(LOW_R)) b.set(x, 0, z, spruce.planks);
}

function tower(b) {
  b.phase('Turm unten');
  for (let y = 1; y <= LOW_TOP; y++) for (const [x, z] of ringCells(LOW_R)) b.set(x, y, z, lowerStone(x, y, z));

  b.phase('Zwischenboden und Galerie');
  b.step();
  for (const [x, z] of innerCells(LOW_R)) b.set(x, LOW_TOP, z, spruce.planks);
  b.set(0, LOW_TOP, -3, 'air');
  b.step();
  const lowDisc = new Set(discCells(LOW_R).map(([x, z]) => key(x, z)));
  const gallery = discCells(LOW_R + 1).filter(([x, z]) => !lowDisc.has(key(x, z)));
  for (const [x, z] of gallery) b.set(x, LOW_TOP, z, `${spruce.slab}[type=top]`);
  for (const [x, z] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, 4], [4, -4], [-4, -4]]) {
    b.set(x, LOW_TOP - 1, z, `${spruce.stairs}[facing=${facingToCenter(x, z)},half=top]`);
  }
  for (const [x, z] of ringCells(LOW_R + 1)) b.set(x, LOW_TOP + 1, z, spruce.fence);

  b.phase('Turm oben');
  for (let y = LOW_TOP + 1; y <= HIGH_TOP; y++) {
    for (const [x, z] of ringCells(HIGH_R)) b.set(x, y, z, upperStone(x, y, z));
    if (y === 10) {
      for (const [x, z] of innerCells(HIGH_R)) b.set(x, y, z, spruce.planks);
      b.set(0, y, -3, 'air');
    }
  }
}

function cap(b) {
  b.phase('Kappe');
  for (const [x, z] of innerCells(LOW_R)) b.set(x, CAP_Y, z, dark.planks);
  b.set(0, CAP_Y, -3, 'air');
  // Stützen innen: ohne sie hätten diese Kegelblöcke keine Fläche, an die man sie im Spiel setzen kann.
  for (const [x, z] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) b.set(x, CAP_Y + 1, z, dark.planks);
  b.set(0, CAP_Y + 4, 0, dark.planks);
  // Jeder Ring deckt genau die Fläche bis zum nächst engeren Ring ab – so bleibt keine Lücke im Kegel.
  for (let k = 0; k < 5; k++) {
    const next = new Set(discCells(LOW_R - k - 1).map(([x, z]) => key(x, z)));
    for (const [x, z] of discCells(LOW_R - k)) {
      if (!next.has(key(x, z))) b.set(x, CAP_Y + k, z, `${dark.stairs}[facing=${facingToCenter(x, z)},half=bottom]`);
    }
  }
  b.set(0, CAP_Y + 5, 0, `${dark.slab}[type=bottom]`);
  b.set(0, CAP_Y + 6, 0, 'lightning_rod[facing=up]');
}

function openings(b) {
  b.phase('Tür und Fenster');
  b.step();
  doorway(b, { x: -LOW_R, y: 1, z: 0, facing: 'west', door: spruce.door, frame: dark.strippedLog, step: null });
  b.step();
  doorway(b, { x: HIGH_R, y: LOW_TOP + 1, z: 0, facing: 'east', door: spruce.door, frame: null });
  b.step();
  window(b, { x: LOW_R, y: 2, z: 0, facing: 'east', height: 2, sill: spruce.stairs, shutters: spruce.trapdoor });
  window(b, { x: 0, y: 2, z: LOW_R, facing: 'south', height: 2, sill: spruce.stairs, shutters: spruce.trapdoor });
  window(b, { x: -HIGH_R, y: 7, z: 0, facing: 'west', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: 0, y: 7, z: HIGH_R, facing: 'south', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: HIGH_R, y: 12, z: 0, facing: 'east', height: 1 });
  window(b, { x: -HIGH_R, y: 12, z: 0, facing: 'west', height: 1 });
}

// Ein Flügel in der Ebene z = HUB.z: Balken von der Nabe nach außen, Segel 3 breit auf einer Seite (Windrad-Anordnung).
function sail(b, dx, dy) {
  const sx = dy;
  const sy = -dx;
  const at = (dist, side) => [dx * dist + sx * side, HUB.y + dy * dist + sy * side];
  const axis = dx !== 0 ? 'x' : 'y';
  for (let d = 1; d <= ARM; d++) {
    const [x, y] = at(d, 0);
    b.set(x, y, HUB.z, `${dark.strippedLog}[axis=${axis}]`);
  }
  for (let d = 3; d <= ARM; d++) {
    for (let side = 1; side <= 3; side++) {
      const [x, y] = at(d, side);
      const frame = side === 3 || d === 3 || d === ARM;
      b.set(x, y, HUB.z, frame ? dark.fence : 'white_wool');
    }
  }
}

function sails(b) {
  b.phase('Flügelwelle und Flügel');
  b.step();
  b.fill(0, HUB.y, -1, 0, HUB.y, HUB.z - 1, `${dark.strippedLog}[axis=z]`);
  b.set(0, HUB.y, HUB.z, 'dark_oak_wood[axis=z]');
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { // oben, rechts, unten, links
    b.step();
    sail(b, dx, dy);
  }
}

function interior(b) {
  b.phase('Einrichtung');
  b.step();
  for (const [x, y, z] of [[4, 1, 1], [4, 1, 2], [3, 1, 3], [2, 1, 4], [4, 2, 2], [3, 2, 3], [-3, 1, 3], [-2, 1, 4]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(-3, 1, -3, 'chest[facing=south,type=single]');
  b.set(0, 1, 0, 'barrel[facing=up]');
  b.set(0, 2, 0, 'barrel[facing=up]');
  for (let y = 3; y <= LOW_TOP; y++) b.set(0, y, 0, 'hopper[facing=down]');
  b.fill(0, 1, -4, 0, 4, -4, `${spruce.strippedLog}[axis=y]`);
  b.fill(0, 1, -3, 0, LOW_TOP, -3, 'ladder[facing=south]');

  b.step();
  const y = LOW_TOP + 1;
  for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(x, y, z, 'smooth_stone');
    b.set(x, y + 1, z, 'smooth_stone_slab[type=bottom]');
  }
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x, y, z, `${spruce.slab}[type=top]`);
  b.set(1, y + 2, 0, 'hopper[facing=down]');
  for (const [x, z] of [[-3, 1], [-3, -1], [-2, 2], [2, -2], [-2, -2]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(-3, y + 1, -1, 'barrel[facing=up]');
  b.fill(0, y, -3, 0, 10, -3, 'ladder[facing=south]');

  b.step();
  b.fill(0, y + 2, 0, 0, CAP_Y + 1, 0, `${spruce.strippedLog}[axis=y]`);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x, 12, z, `${dark.slab}[type=top]`);
  for (const [x, yy, z] of [[2, 11, 2], [-2, 11, 2], [2, 11, -2], [2, 12, 2], [-3, 11, 1]]) b.set(x, yy, z, 'hay_block[axis=y]');
  b.fill(0, 11, -3, 0, CAP_Y, -3, 'ladder[facing=south]');

  b.step();
  for (const [x, yy] of [[-1, 15], [1, 15], [-1, 16], [1, 16], [-1, 17], [0, 17], [1, 17]]) b.set(x, yy, 0, dark.planks);
  b.set(0, CAP_Y + 1, -1, `${spruce.log}[axis=y]`);
}

// lightRoom rechnet in Rechtecken. Damit keine Laterne in den Ecken außerhalb des runden Turms landet, werden die
// freien Eckfelder für die Rechnung kurz mit Barrieren gefüllt und danach wieder entfernt.
function lightRound(b, y1, y2, wallR, options = {}) {
  const inside = new Set(innerCells(wallR).map(([x, z]) => key(x, z)));
  const n = wallR;
  const temp = [];
  for (let y = y1; y <= y2; y++) {
    for (let z = -n; z <= n; z++) {
      for (let x = -n; x <= n; x++) {
        if (inside.has(key(x, z)) || b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, 'barrier');
        temp.push([x, y, z]);
      }
    }
  }
  lightRoom(b, { x1: -n, y1, z1: -n, x2: n, y2, z2: n }, options);
  for (const [x, y, z] of temp) b.remove(x, y, z);
}

function lights(b) {
  b.phase('Licht');
  b.step();
  b.set(-LOW_R - 1, 4, 1, `${dark.fence}`);
  b.set(-LOW_R - 1, 3, 1, 'lantern[hanging=true]');
  b.step();
  lightRound(b, 1, 4, LOW_R);
  b.step();
  lightRound(b, LOW_TOP + 1, 9, HIGH_R);
  b.step();
  lightRound(b, 11, HIGH_TOP, HIGH_R);
  b.step();
  b.set(0, CAP_Y + 1, 2, 'lantern[hanging=true]');
  lightRound(b, CAP_Y + 1, CAP_Y + 1, HIGH_R);
}

function field(b) {
  const [x1, x2, z1, z2, zWater] = [7, 15, -11, -7, -9];
  b.step();
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) {
      if (z === zWater && x > x1 && x < x2) {
        b.set(x, -1, z, 'dirt');
        b.set(x, 0, z, 'water');
        continue;
      }
      b.set(x, 0, z, 'farmland[moisture=7]');
      const age = hashPosition(x, 0, z, 77) % 4 === 0 ? 5 + (hashPosition(x, 1, z, 78) % 2) : 7;
      b.set(x, 1, z, `wheat[age=${age}]`);
    }
  }
  // Unter dem Komposter normale Erde: Ackerboden unter einem Block wird im Spiel sofort zu Erde.
  b.set(x1, 0, zWater, 'dirt');
  b.set(x1, 1, zWater, 'composter[level=4]');
  b.step();
  b.set(17, 1, zWater, spruce.fence);
  b.set(17, 2, zWater, 'hay_block[axis=y]');
  b.set(17, 2, zWater - 1, spruce.fence);
  b.set(17, 2, zWater + 1, spruce.fence);
  b.set(17, 3, zWater, 'carved_pumpkin[facing=west]');
}

function surroundings(b) {
  b.phase('Umgebung');
  field(b);
  b.step();
  path(b, { x: -LOW_R - 1, y: 0, z: 0, facing: 'west', length: 9, width: 3, mix: 'erde', wiggle: 1, seed: 'muehle' });
  for (const [x, y, z] of [[-7, 1, -3], [-8, 1, -3], [-7, 2, -3]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(-8, 1, -4, 'hay_block[axis=y]');
  b.step();
  tree(b, { x: -10, y: 1, z: -8, species: 'eiche', size: 'mittel', seed: 4 });
  tree(b, { x: -11, y: 1, z: 9, species: 'birke', size: 'mittel', seed: 2 });
  bush(b, { x: 9, y: 1, z: 9, size: 'mittel', seed: 6 });
  bush(b, { x: 17, y: 1, z: 3, size: 'klein', leaves: 'azalee', seed: 8 });
  flowerBed(b, { x: -12, y: 0, z: 3, width: 5, depth: 2, facing: 'south', palette: 'warm', seed: 3 });
  vegetation(b, { x: -15, y: 2, z: -14, width: 36, depth: 29, mix: 'wiese', density: 0.22, shape: 'eckig', seed: 21 });
}

export default function build(b) {
  ground(b);
  tower(b);
  cap(b);
  openings(b);
  sails(b);
  interior(b);
  lights(b);
  surroundings(b);
}
