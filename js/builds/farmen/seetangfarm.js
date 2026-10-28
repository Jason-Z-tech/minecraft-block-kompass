// Seetangfarm: elf Seetangpflanzen in einer Kammer aus Wasserquellen. Beobachter schauen auf den untersten Block;
// wächst ein zweiter, feuern alle Kolben auf Höhe des zweiten Blocks. Die Stücke steigen im Wasser auf, die Strömung
// drückt sie in eine Rinne über einer Trichterreihe, die alles zur Truhe bringt.
// Lokale Koordinaten: Wiese bis y = −1, Boden y = 0 (Sand unter dem Seetang), Seetang y = 1, Erntehöhe y = 2,
// Vorrat y = 3, Glasdecke y = 4. Kammer x = −5 … 5: z = 0 Seetang, z = 1 Trichter (y = 2) und Rinne (y = 3),
// z = −1 Beobachter (y = 1) und Kolben (y = 2), z = −2 Redstone (y = 1 und y = 3), z = −3 Rückwand.
// Türme x = −8 … −6 (Westturm mit der Redstone-Treppe) und x = 6 … 8.

import { terrain, path, bush, vegetation, pond } from '../lib/index.js';

export const meta = {
  id: 'seetangfarm',
  title: 'Seetangfarm',
  category: 'farmen',
  subtitle: 'Beobachter und Kolben ernten Seetang, eine Trichterreihe sammelt ihn ein',
  tags: ['Farm', 'Seetang', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Wasser', 'Brennstoff', 'Technik'],
  aliases: [
    'seetangfarm', 'seetang farm', 'automatische seetangfarm', 'seetang', 'setangfarm', 'seetangfram', 'algenfarm',
    'algen farm', 'kelp farm', 'kelp', 'automatic kelp farm', 'observer kelp farm', 'dried kelp farm',
    'getrockneter seetang', 'brennstofffarm',
  ],
  accuracy: 'eigenes',
  description: 'Elf Seetangpflanzen wachsen in einer Kammer voller Wasserquellen. Hinter jeder schaut ein Beobachter auf den untersten Block: Wächst ein zweiter, ändert sich der untere – der Beobachter sendet einen Puls, eine Redstone-Treppe im Westturm bringt ihn zwei Ebenen höher, und alle elf Kolben schlagen den zweiten Block ab. Die Stücke steigen im Wasser auf, die Strömung schiebt sie in eine flache Rinne, und die Trichter darunter bringen sie in die Truhe. Du füllst das Wasser ein, pflanzt den Seetang und leerst ab und zu die Truhe.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Seetangfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Kelp_farming' },
    { title: 'Minecraft Wiki: Seetang (englisch)', url: 'https://minecraft.wiki/w/Kelp' },
  ],
  credits: null,
  tested: false,
};

const KELP_FROM = -5;
const KELP_TO = 5;
const KELP_X = [];
for (let x = KELP_FROM; x <= KELP_TO; x++) KELP_X.push(x);
const BRICK = 'prismarine_bricks';
const DARK = 'dark_prismarine';
const GLASS = 'glass';
const WEST = [-8, -7, -6];
const EAST = [6, 7, 8];
const TOWER_CORNERS = [[-8, -3], [-8, 2], [8, -3], [8, 2]];
const FRONT_LIGHTS = [-3, 3];

// Redstone-Treppe im Westturm: untere Leitung → Verstärker → zwei Stufen hinauf (über z = −1) → obere Leitung.
// Sie liegt ganz im Turm (Spalte x = −7); die Außenwand x = −8 bleibt geschlossen.
const REPEATER = [-6, 1, -2];
const STAIR_DUST = [[-7, 1, -2], [-7, 2, -1], [-7, 3, -2]];
const STAIR_GLASS = [-7, 2, -2];
const STAIR_AIR = [-7, 3, -1];

// Nordwest-Ecke des Geländes
const GROUND_X = -16;
const GROUND_Z = -8;

const isStairCell = (x, y, z) =>
  [REPEATER, STAIR_GLASS, STAIR_AIR, ...STAIR_DUST].some(([sx, sy, sz]) => sx === x && sy === y && sz === z);

// Turmblöcke einer Ebene (ohne die Zellen der Redstone-Treppe)
function towerLayer(b, y) {
  for (const x of [...WEST, ...EAST]) {
    for (let z = -3; z <= 2; z++) {
      if (isStairCell(x, y, z)) continue;
      const corner = TOWER_CORNERS.some(([cx, cz]) => cx === x && cz === z);
      const window = y === 2 && Math.abs(x) === 7 && (z === -3 || z === 2);
      b.set(x, y, z, window ? 'sea_lantern' : corner ? DARK : BRICK);
    }
  }
}

function ground(b) {
  b.phase('Platz vorbereiten');
  terrain(b, { x: GROUND_X, y: -3, z: GROUND_Z, width: 31, depth: 19, height: 2, seed: 'seetang' });
}

function foundation(b) {
  b.phase('Fundament und Boden');
  b.step();
  for (let x = -8; x <= 8; x++) for (let z = -3; z <= 2; z++) b.set(x, -1, z, BRICK);
  for (const [x, z] of TOWER_CORNERS) b.set(x, -1, z, 'sea_lantern');

  b.step();
  for (let x = -8; x <= 8; x++) {
    for (let z = -3; z <= 2; z++) {
      const rim = Math.abs(x) === 8 || z === -3 || z === 2;
      b.set(x, 0, z, z === 0 && KELP_X.includes(x) ? 'sand' : rim ? DARK : BRICK);
    }
  }
}

function lowerLevel(b) {
  b.phase('Untere Ebene: Beobachter und Leitung');
  b.step();
  for (let x = -5; x <= 5; x++) b.set(x, 1, -3, DARK);
  towerLayer(b, 1);

  b.step();
  for (const x of KELP_X) b.set(x, 1, -1, 'observer[facing=south]');

  b.step();
  for (const x of KELP_X) b.set(x, 1, -2, 'redstone_wire');
  b.set(...REPEATER, 'repeater[delay=1,facing=east]');
  b.set(...STAIR_DUST[0], 'redstone_wire');

  b.step();
  for (const x of KELP_X) b.set(x, 1, 1, x === 0 ? 'hopper[facing=south]' : BRICK);
  for (const x of KELP_X) if (x !== 0 && x !== 1) b.set(x, 1, 2, DARK);
  b.set(0, 1, 2, 'chest[facing=south]');
  b.set(1, 1, 2, 'chest[facing=south]');
}

function middleLevel(b) {
  b.phase('Mittlere Ebene: Kolben und Trichterreihe');
  b.step();
  for (const x of KELP_X) {
    b.set(x, 2, -1, 'piston[facing=south]');
    b.set(x, 2, -2, BRICK);
    b.set(x, 2, -3, BRICK);
  }

  b.step();
  towerLayer(b, 2);
  b.set(...STAIR_DUST[1], 'redstone_wire');
  b.set(...STAIR_GLASS, GLASS);

  b.step();
  for (const x of KELP_X) {
    const facing = x < 0 ? 'east' : x > 0 ? 'west' : 'down';
    b.set(x, 2, 1, `hopper[facing=${facing}]`);
    if (x !== 0 && x !== 1) b.set(x, 2, 2, FRONT_LIGHTS.includes(x) ? 'sea_lantern' : BRICK);
  }
}

function upperLevel(b) {
  b.phase('Obere Ebene: Leitung und Rinne');
  b.step();
  for (const x of KELP_X) {
    b.set(x, 3, -1, BRICK);
    b.set(x, 3, -3, BRICK);
  }
  b.step();
  towerLayer(b, 3);
  b.set(...STAIR_DUST[2], 'redstone_wire');
  for (let x = -6; x <= KELP_TO; x++) b.set(x, 3, -2, 'redstone_wire');

  b.step();
  for (const x of KELP_X) b.set(x, 3, 2, GLASS);
}

function water(b) {
  b.phase('Wasser und Seetang');
  b.step();
  for (const x of KELP_X) b.set(x, 1, 0, 'kelp[age=0]');

  b.step();
  for (const x of KELP_X) {
    b.set(x, 2, 0, 'water[level=0]');
    b.set(x, 3, 0, 'water[level=0]');
    b.set(x, 3, 1, 'water[level=1]');
  }
}

function cover(b) {
  b.phase('Glasdecke und Turmspitzen');
  b.step();
  for (const x of KELP_X) {
    b.set(x, 4, 0, GLASS);
    b.set(x, 4, 1, GLASS);
    for (const z of [-3, -2, -1, 2]) b.set(x, 4, z, 'dark_prismarine_slab[type=bottom]');
  }
  b.step();
  towerLayer(b, 4);
  for (const x of [...WEST, ...EAST]) {
    for (let z = -3; z <= 2; z++) {
      const edge = Math.abs(x) !== 7 || z === -3 || z === 2;
      if (edge) b.set(x, 5, z, 'prismarine_brick_slab[type=bottom]');
    }
  }
  for (const [x, z] of TOWER_CORNERS) b.set(x, 5, z, 'lantern[hanging=false]');
}

function surroundings(b) {
  b.phase('Umgebung');
  pond(b, { x: -15, y: -1, z: 4, width: 7, depth: 5, facing: 'east', shore: 'sand', seed: 3 });
  path(b, { x: 0, y: -1, z: 3, facing: 'south', length: 6, width: 3, mix: 'erde', wiggle: 0.5, seed: 7 });
  bush(b, { x: 11, y: 0, z: 6, size: 'klein', leaves: 'birke', seed: 4 });
  bush(b, { x: 11, y: 0, z: -6, size: 'klein', leaves: 'eiche', seed: 9 });
  vegetation(b, { x: -16, y: -1, z: -8, width: 31, depth: 19, mix: 'wiese', density: 0.3, seed: 16 });
}

export default function build(b) {
  ground(b);
  foundation(b);
  lowerLevel(b);
  middleLevel(b);
  upperLevel(b);
  water(b);
  cover(b);
  surroundings(b);
}
