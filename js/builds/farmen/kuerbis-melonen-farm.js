// Kürbis- und Melonenfarm: eine Reihe Stängel auf Ackerboden, nördlich davon Beobachter, die auf die Stängel schauen,
// südlich die Fruchtfelder (Schlamm) und dahinter Kolben. Wächst eine Frucht, wird der Stängel „angewachsen“ – der
// Beobachter sieht das, die Kolben zerschlagen die Frucht, und zwei Trichterreihen unter Ackerboden und Schlamm sammeln
// die Stücke ein.
// Lokale Koordinaten: Wiese bis y = −1 (Fundament und Trichter liegen eingelassen auf y = −1), Ackerboden y = 0,
// Maschine y = 1, Redstone y = 2.
// Reihe x = 0 … 9: z = −2 Träger, z = −1 Beobachter, z = 0 Stängel, z = 1 Fruchtfeld, z = 2 Kolben, z = 3 Träger.

import { WOOD, terrain, path, bush, vegetation, flowerBed } from '../lib/index.js';

export const meta = {
  id: 'kuerbis-melonen-farm',
  title: 'Kürbis- und Melonenfarm',
  category: 'farmen',
  subtitle: 'Beobachter schauen auf die Stängel, Kolben ernten, Trichter sammeln',
  tags: ['Farm', 'Kürbis', 'Melone', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Technik', 'Essen'],
  aliases: [
    'kürbis- und melonenfarm', 'kürbis und melonen farm', 'kürbisfarm', 'kuerbisfarm', 'kürbis farm', 'kurbisfarm',
    'melonenfarm', 'melonen farm', 'melonfarm', 'automatische melonenfarm', 'automatische kürbisfarm',
    'pumpkin farm', 'melon farm', 'pumpkin and melon farm', 'melon and pumpkin farm', 'automatic melon farm',
    'observer melon farm', 'observer pumpkin farm',
  ],
  accuracy: 'eigenes',
  description: 'Fünf Melonen- und fünf Kürbisstängel wachsen auf Ackerboden, ihre Früchte auf Schlamm daneben. Hinter jedem Stängel schaut ein Beobachter genau auf den Stängel: Wächst eine Frucht, biegt sich der Stängel zu ihr hin – der Beobachter sendet einen Puls, ein Verstärker trägt ihn um die Farm herum, und alle zehn Kolben zerschlagen die Früchte. Die Stücke fallen auf Ackerboden oder Schlamm, und zwei Trichterreihen darunter bringen sie in die Truhe. Du pflanzt nur die Samen und leerst ab und zu die Truhe.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Kürbis- und Melonenfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Pumpkin_and_melon_farming' },
  ],
  credits: null,
  tested: false,
};

const LENGTH = 10;
const LAST = LENGTH - 1;
const EAST = LENGTH; // Ostwand x = 10, dort läuft das Signal um die Farm herum
const MELONS = 5; // x = 0 … 4 Melonen, x = 5 … 9 Kürbisse
const WATER_X = [2, 7]; // Wasser unter den Beobachtern: reicht 4 Felder weit für die ganze Reihe
const dark = WOOD.schwarzeiche;
const BASE = 'stone_bricks';
const CARRIER = 'polished_andesite';
const POSTS = [[-2, -3], [-2, 4], [EAST + 1, -3], [EAST + 1, 4]];

// Nordwest-Ecke des Geländes
const GROUND_X = -7;
const GROUND_Z = -8;

function ground(b) {
  b.phase('Platz vorbereiten');
  terrain(b, { x: GROUND_X, y: -2, z: GROUND_Z, width: 24, depth: 18, height: 1, seed: 'melonen' });
}

function collector(b) {
  b.phase('Truhe und Trichter');
  b.step();
  b.set(EAST + 1, -1, 0, 'chest[facing=east]');
  b.set(EAST + 1, -1, 1, 'chest[facing=east]');
  b.step();
  for (const z of [0, 1]) for (let x = EAST; x >= 0; x--) b.set(x, -1, z, 'hopper[facing=east]');
}

function foundation(b) {
  b.phase('Fundament, Ackerboden und Wasser');
  b.step();
  for (let x = -1; x <= EAST; x++) {
    for (let z = -2; z <= 3; z++) {
      if ((z === 0 || z === 1) && x >= 0) continue;
      b.set(x, -1, z, BASE);
    }
  }

  b.step();
  for (let x = -1; x <= EAST; x++) {
    for (const z of [-2, -1, 2, 3]) {
      if (z === -1 && WATER_X.includes(x)) continue;
      b.set(x, 0, z, BASE);
    }
  }
  for (const x of [-1, EAST]) for (const z of [0, 1]) b.set(x, 0, z, BASE);
  for (const x of WATER_X) b.set(x, 0, -1, 'water[level=0]');

  b.step();
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 0, 0, 'farmland[moisture=7]');
    b.set(x, 0, 1, 'mud');
  }
}

function machine(b) {
  b.phase('Beobachter und Kolben');
  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 1, -1, 'observer[facing=south]');

  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 1, 2, 'piston[facing=north]');

  b.step();
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 1, -2, CARRIER);
    b.set(x, 1, 3, CARRIER);
  }
  for (const x of [-1, EAST]) for (let z = -2; z <= 3; z++) b.set(x, 1, z, BASE);
}

function wiring(b) {
  b.phase('Redstone-Leitung');
  b.step();
  for (let x = 0; x <= EAST; x++) b.set(x, 2, -2, 'redstone_wire');

  b.step();
  b.set(EAST, 2, -1, 'redstone_wire');
  b.set(EAST, 2, 0, 'redstone_wire');
  b.set(EAST, 2, 1, 'repeater[delay=1,facing=north]');
  b.set(EAST, 2, 2, 'redstone_wire');
  b.set(EAST, 2, 3, 'redstone_wire');

  b.step();
  for (let x = LAST; x >= 0; x--) b.set(x, 2, 3, 'redstone_wire');
}

function frame(b) {
  b.phase('Glasdach und Holzrahmen');
  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 2, 1, 'glass');

  b.step();
  for (const [x, z] of POSTS) for (let y = 0; y <= 3; y++) b.set(x, y, z, `${dark.log}[axis=y]`);
  for (let x = -1; x <= EAST; x++) {
    b.set(x, 3, -3, `${dark.strippedLog}[axis=x]`);
    b.set(x, 3, 4, `${dark.strippedLog}[axis=x]`);
  }
  for (let z = -2; z <= 3; z++) {
    b.set(-2, 3, z, `${dark.strippedLog}[axis=z]`);
    b.set(EAST + 1, 3, z, `${dark.strippedLog}[axis=z]`);
  }

  b.step();
  for (const x of [1, 5, 8]) {
    b.set(x, 2, -3, 'lantern[hanging=true]');
    b.set(x, 2, 4, 'lantern[hanging=true]');
  }
  for (const [x, z] of POSTS) b.set(x, 4, z, 'lantern[hanging=false]');
}

function plant(b) {
  b.phase('Samen pflanzen');
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 1, 0, x < MELONS ? 'melon_stem[age=7]' : 'pumpkin_stem[age=7]');
  }
}

function surroundings(b) {
  b.phase('Umgebung');
  b.step();
  path(b, { x: EAST + 2, y: -1, z: 1, facing: 'east', length: 4, width: 3, mix: 'erde', wiggle: 0.5, seed: 4 });
  b.set(EAST + 2, 0, -1, 'composter[level=0]');
  b.set(EAST + 2, 0, 3, 'hay_block[axis=y]');
  b.set(EAST + 3, 0, 3, 'hay_block[axis=x]');
  b.set(EAST + 2, 1, 3, 'jack_o_lantern[facing=east]');

  b.step();
  flowerBed(b, { x: 0, y: -1, z: 5, width: LENGTH, depth: 2, facing: 'south', palette: 'warm', seed: 9 });
  bush(b, { x: -4, y: 0, z: 5, size: 'klein', leaves: 'eiche', seed: 3 });
  bush(b, { x: -4, y: 0, z: -5, size: 'klein', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: -7, y: -1, z: -8, width: 24, depth: 18, mix: 'wiese', density: 0.3, seed: 12 });
}

export default function build(b) {
  ground(b);
  collector(b);
  foundation(b);
  machine(b);
  wiring(b);
  frame(b);
  plant(b);
  surroundings(b);
}
