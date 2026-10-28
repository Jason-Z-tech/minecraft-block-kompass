// Heuwagen – Leiterwagen aus Fichtenholz auf einem Feldweg: große Hinterräder (2 × 2 Treppen, rund), kleine Vorderräder,
// Ladefläche mit Bordwänden, Strohballen-Ladung, Kutschbock mit Fass und Deichsel. Der Wagen steht längs der x-Achse,
// vorne (Deichsel) ist Osten; die Ladefläche liegt auf y = 3.

import { terrain, vegetation, path, bush, isPlantId } from '../lib/natur.js';
import { stateId } from '../../core/blockstate.js';

export const meta = {
  id: 'heuwagen',
  title: 'Heuwagen',
  category: 'klein',
  subtitle: 'Holzwagen mit Heuladung, runden Holzrädern und Deichsel',
  tags: ['Wagen', 'Heu', 'Stroh', 'Bauernhof', 'Dorf', 'Deko', 'Mittelalter', 'Holz', 'Schnell gebaut', 'Feldweg'],
  aliases: [
    'heuwagen', 'heu wagen', 'heuwägen', 'leiterwagen', 'holzwagen', 'bauernwagen', 'karren', 'handkarren', 'ochsenkarren',
    'pferdewagen', 'wagen', 'erntewagen', 'heukarren', 'fuhrwerk', 'strohwagen', 'stroh wagen', 'wagen mit strohballen',
    'hay wagon', 'hay cart', 'haywagon', 'cart', 'wagon', 'farm cart', 'wooden cart', 'medieval cart',
  ],
  accuracy: 'eigenes',
  description: 'Ein Leiterwagen voller Heu, wie er auf jedem Bauernhof stehen könnte. Die großen Hinterräder sind runde Scheiben aus je vier Schwarzeichenholztreppen, die kleinen Vorderräder je eine offene Falltür; darüber liegt die Ladefläche aus Fichtenholz mit Bordwänden aus Fichtenholzfalltüren. Hinten türmen sich die Strohballen, vorne sitzt der Kutschbock mit einem Fass, und die Deichsel liegt auf dem Feldweg.',
  sources: [],
  credits: null,
  tested: null,
};

const GROUND_Y = 1;
const BED_Y = 3;
const BED = { x1: -3, x2: 2, z1: -1, z2: 1 };
const WHEEL = 'dark_oak_trapdoor';
const WHEEL_STAIRS = 'dark_oak_stairs';
const BOARD = 'spruce_trapdoor';
const AXLE = 'stripped_spruce_log[axis=z]';
const AXLES = [-3, -2, 1];
const DRAWBAR = [[2, 0], [3, 0], [4, 0], [4, -1], [4, 1]];
const GROUND_HAY = [[-5, 3], [-4, 3]];
const GROUND_BARREL = [3, -3];

// Offene Falltür als Platte an der Wagenseite: die Platte liegt auf der Seite gegenüber von facing.
function plate(b, x, y, z, id, facing) {
  b.set(x, y, z, `${id}[facing=${facing},half=bottom,open=true]`);
}

// Strohballen der Ladung: [x, y, z, axis].
function hayLoad() {
  const hay = [];
  for (let x = BED.x1; x <= 1; x++) for (let z = -1; z <= 1; z++) hay.push([x, BED_Y + 1, z, 'x']);
  for (let x = BED.x1; x <= 0; x++) {
    for (let z = -1; z <= 1; z++) {
      if (x === BED.x1 && z !== 0) continue;
      hay.push([x, BED_Y + 2, z, (x + z) % 2 === 0 ? 'z' : 'x']);
    }
  }
  for (const [x, z] of [[-2, 0], [-1, 0], [-1, -1]]) hay.push([x, BED_Y + 3, z, 'x']);
  return hay;
}


// Bewuchs nur auf Gras: Pflanzen, die vegetation() auf grobe Erde gesetzt hat, wieder entfernen (auch obere Hälften).
function clearPlantsOffGrass(b, { x1, z1, x2, z2, y }) {
  let removed = 0;
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) {
      const id = stateId(b.get(x, y, z));
      if (id === 'air' || !isPlantId(id) || stateId(b.get(x, y - 1, z)) === 'grass_block') continue;
      for (let k = 0; k < 2 && isPlantId(stateId(b.get(x, y + k, z))); k++) b.remove(x, y + k, z);
      removed++;
    }
  }
  return removed;
}

export default function build(b) {
  // --- Bauplatz ---
  b.phase('Bauplatz');
  terrain(b, { x: -8, y: 0, z: -6, width: 17, depth: 13, height: GROUND_Y, shape: 'rund', seed: 9 });
  path(b, { x: -8, y: GROUND_Y, z: 0, facing: 'east', length: 17, width: 5, mix: 'erde', wiggle: 0.8, seed: 4 });
  // Unter allem, was später auf dem Weg steht, liegt grobe Erde statt Trampelpfad.
  const footprint = [...DRAWBAR, ...GROUND_HAY, GROUND_BARREL];
  for (const x of AXLES) for (let z = BED.z1 - 1; z <= BED.z2 + 1; z++) footprint.push([x, z]);
  for (const [x, z] of footprint) if (b.get(x, GROUND_Y, z) === 'dirt_path') b.set(x, GROUND_Y, z, 'coarse_dirt');

  // --- Fahrgestell ---
  b.phase('Fahrgestell und Ladefläche');
  b.step();
  for (const x of AXLES) for (let z = BED.z1; z <= BED.z2; z++) b.set(x, BED_Y - 1, z, AXLE);
  b.step();
  b.fill(BED.x1, BED_Y, BED.z1, BED.x2, BED_Y, BED.z2, 'spruce_planks');

  // --- Räder ---
  b.phase('Räder');
  b.step();
  for (const z of [BED.z1 - 1, BED.z2 + 1]) {
    for (const [x, facing] of [[AXLES[0], 'east'], [AXLES[1], 'west']]) {
      b.stairs(x, BED_Y, z, WHEEL_STAIRS, { facing, half: 'bottom' });
      b.stairs(x, BED_Y - 1, z, WHEEL_STAIRS, { facing, half: 'top' });
    }
  }
  b.step();
  plate(b, AXLES[2], BED_Y - 1, BED.z2 + 1, WHEEL, 'south');
  plate(b, AXLES[2], BED_Y - 1, BED.z1 - 1, WHEEL, 'north');

  // --- Heu ---
  b.phase('Heuladung');
  for (const [x, y, z, axis] of hayLoad()) b.set(x, y, z, `hay_block[axis=${axis}]`);

  // --- Bordwände, Kutschbock und Deichsel ---
  b.phase('Bordwände, Kutschbock und Deichsel');
  b.step();
  for (let x = BED.x1; x <= 1; x++) {
    plate(b, x, BED_Y + 1, BED.z2 + 1, BOARD, 'south');
    plate(b, x, BED_Y + 1, BED.z1 - 1, BOARD, 'north');
  }
  for (let z = BED.z1; z <= BED.z2; z++) plate(b, BED.x1 - 1, BED_Y + 1, z, BOARD, 'west');
  b.step();
  b.stairs(BED.x2, BED_Y + 1, -1, 'spruce_stairs', { facing: 'west' });
  b.stairs(BED.x2, BED_Y + 1, 0, 'spruce_stairs', { facing: 'west' });
  b.set(BED.x2, BED_Y + 1, 1, 'barrel[facing=up,open=false]');
  for (let z = BED.z1; z <= BED.z2; z++) plate(b, BED.x2 + 1, BED_Y, z, BOARD, 'east');
  b.step();
  for (const [x, z] of DRAWBAR) b.set(x, BED_Y - 1, z, 'spruce_fence');

  // --- Umgebung ---
  b.phase('Wegrand');
  b.set(GROUND_HAY[0][0], GROUND_Y + 1, GROUND_HAY[0][1], 'hay_block[axis=z]');
  b.set(GROUND_HAY[1][0], GROUND_Y + 1, GROUND_HAY[1][1], 'hay_block[axis=y]');
  b.set(GROUND_HAY[1][0], GROUND_Y + 2, GROUND_HAY[1][1], 'hay_block[axis=x]');
  b.set(GROUND_BARREL[0], GROUND_Y + 1, GROUND_BARREL[1], 'barrel[facing=north,open=false]');
  bush(b, { x: 6, y: GROUND_Y + 1, z: -4, size: 'klein', leaves: 'eiche', seed: 3 });
  vegetation(b, { x: -8, y: GROUND_Y + 1, z: -6, width: 17, depth: 13, mix: 'blumen', density: 0.3, seed: 6 });
  clearPlantsOffGrass(b, { x1: -8, z1: -6, x2: 8, z2: 6, y: GROUND_Y + 1 });
}
