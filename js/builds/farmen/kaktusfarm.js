// Kaktusfarm (passiv, ohne Redstone): 13 Kakteen im Zickzack auf Sandblöcken, die auf Schnur über einer Wasserrinne
// schweben. Ein Zaun in der Mitte steht neben jedem Feld, in das ein Kaktus hineinwächst – der neue Block bricht ab,
// fällt zwischen den Sandblöcken hindurch ins Wasser und schwimmt zur Mitte, wo Trichter ihn in die Truhe bringen.
// Lokale Koordinaten: Wüste bis y = −1 (Boden der Rinne), Wasser y = 0, Schnur y = 1, Sand y = 2, Kakteen y = 3,
// Zaun y = 4. Rinne x = −7 … 7, z = −2 … 2; Wände bei x = ±8 und z = ±3; Truhe südlich bei z = 4.

import { WOOD, terrain, path, vegetation, rock, tree } from '../lib/index.js';

export const meta = {
  id: 'kaktusfarm',
  title: 'Kaktusfarm',
  category: 'farmen',
  subtitle: 'Passiv: Kaktus bricht am Zaun ab, Wasser trägt ihn zur Truhe',
  tags: ['Farm', 'Kaktus', 'Passiv', 'Ohne Redstone', 'Wasserstrom', 'Trichter', 'Schnur', 'Wüste', 'Grüner Farbstoff', 'Technik'],
  aliases: [
    'kaktusfarm', 'kaktus farm', 'kakteenfarm', 'kaktus', 'kaktussfarm', 'kaktusfram', 'automatische kaktusfarm',
    'passive kaktusfarm', 'cactus farm', 'cactus', 'automatic cactus farm', 'passive cactus farm', 'green dye farm',
    'grüner farbstoff farm', 'farbstofffarm',
  ],
  accuracy: 'eigenes',
  description: 'Dreizehn Kakteen stehen im Zickzack auf Sandblöcken, die auf Schnur über einer Wasserrinne schweben. Wächst ein Kaktus einen Block höher, steht der neue Block direkt neben dem Zaun in der Mitte – das verträgt ein Kaktus nicht, er bricht sofort ab. Der Block fällt zwischen den Sandblöcken hindurch ins Wasser, die Strömung von beiden Enden trägt ihn zur Mitte, und Trichter bringen ihn in die Truhe. Die Farm braucht keinen Redstone und kein Licht; du musst nur in der Nähe sein.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Kaktusfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Cactus_farming' },
    { title: 'Minecraft Wiki: Kaktus (englisch)', url: 'https://minecraft.wiki/w/Cactus' },
  ],
  credits: null,
  tested: false,
};

const HALF = 7; // Rinne x = −7 … 7, Wasserquellen bei x = ±7
const END = HALF + 1; // Stirnwände x = ±8
const SIDE = 3; // Längswände z = ±3
const LANE = 2; // Rinne z = −2 … 2
const acacia = WOOD.akazie;
const FLOOR = 'smooth_sandstone';
const RIM = 'cut_sandstone';
const CORNERS = [[-END, -SIDE], [END, -SIDE], [-END, SIDE], [END, SIDE]];
const PILLARS = [...CORNERS, [0, -SIDE], [0, SIDE]]; // Ecken und Mitte der Längsseiten
// Wilde Kakteen in der Umgebung: x, z, Höhe
const WILD_CACTI = [[-13, -4, 3], [-4, -6, 2], [5, 9, 2], [13, 2, 1]];
const STRING = 'tripwire[attached=false,disarmed=false,east=false,north=false,powered=false,south=false,west=false]';

// Zickzack: gerade x in der Nordreihe (z = −1), ungerade x in der Südreihe (z = 1) – nie zwei Kakteen nebeneinander.
const CACTI = [];
for (let x = -6; x <= 6; x++) CACTI.push([x, x % 2 === 0 ? -1 : 1]);

// Nordwest-Ecke des Geländes
const GROUND_X = -15;
const GROUND_Z = -8;

// Wasser fließt von den Quellen bei x = ±7 zur Mitte, je Block eine Stufe schwächer (x = 0: Stufe 7).
const waterLevel = (x) => HALF - Math.abs(x);

function ground(b) {
  b.phase('Platz vorbereiten');
  terrain(b, { x: GROUND_X, y: -2, z: GROUND_Z, width: 31, depth: 21, height: 1, surface: 'sand', seed: 'kaktus' });
}

function collector(b) {
  b.phase('Truhe und Trichter');
  b.step();
  b.set(0, -1, 4, 'chest[facing=south]');
  b.set(1, -1, 4, 'chest[facing=south]');
  b.step();
  for (let z = SIDE; z >= -LANE; z--) b.set(0, -1, z, 'hopper[facing=south]');
}

function basin(b) {
  b.phase('Boden und Rand der Rinne');
  b.step();
  for (let x = -END; x <= END; x++) {
    for (let z = -SIDE; z <= SIDE; z++) {
      if (x === 0 && z >= -LANE) continue;
      b.set(x, -1, z, FLOOR);
    }
  }
  b.step();
  for (let x = -END; x <= END; x++) {
    b.set(x, 0, -SIDE, RIM);
    b.set(x, 0, SIDE, RIM);
  }
  for (const x of [-END, END]) for (let z = -LANE; z <= LANE; z++) b.set(x, 0, z, RIM);
  for (const [x, z] of CORNERS) b.set(x, 0, z, 'chiseled_sandstone');
}

function sandOnString(b) {
  b.phase('Sand auf Schnur');
  b.step();
  for (const [x, z] of CACTI) b.set(x, 1, z, STRING);
  b.step();
  for (const [x, z] of CACTI) b.set(x, 2, z, 'sand');
}

function cacti(b) {
  b.phase('Kakteen pflanzen');
  for (const [x, z] of CACTI) b.set(x, 3, z, 'cactus[age=0]');
}

function water(b) {
  b.phase('Wasser einlassen');
  for (let x = -HALF; x <= HALF; x++) {
    for (let z = -LANE; z <= LANE; z++) b.set(x, 0, z, `water[level=${waterLevel(x)}]`);
  }
}

function walls(b) {
  b.phase('Glaswände und Zaun');
  b.step();
  for (const [x, z] of PILLARS) {
    for (let y = 1; y <= 4; y++) b.set(x, y, z, `${acacia.strippedLog}[axis=y]`);
    b.set(x, 5, z, 'chiseled_sandstone');
    b.set(x, 6, z, 'lantern[hanging=false]');
  }
  b.step();
  for (let y = 1; y <= 4; y++) {
    for (let x = -HALF; x <= HALF; x++) {
      if (x === 0) continue;
      b.set(x, y, -SIDE, 'glass');
      b.set(x, y, SIDE, 'glass');
    }
    for (const x of [-END, END]) for (let z = -LANE; z <= LANE; z++) b.set(x, y, z, 'glass');
  }
  for (let x = -HALF; x <= HALF; x++) {
    if (x === 0) continue;
    b.set(x, 5, -SIDE, 'cut_sandstone_slab[type=bottom]');
    b.set(x, 5, SIDE, 'cut_sandstone_slab[type=bottom]');
  }
  for (const x of [-END, END]) for (let z = -LANE; z <= LANE; z++) b.set(x, 5, z, 'cut_sandstone_slab[type=bottom]');

  b.step();
  for (let x = -HALF; x <= HALF; x++) b.set(x, 4, 0, acacia.fence);
}

function surroundings(b) {
  b.phase('Umgebung');
  path(b, { x: 0, y: -1, z: 5, facing: 'south', length: 6, width: 3, mix: 'kies', wiggle: 0.5, seed: 6 });
  tree(b, { x: -11, y: 0, z: 7, species: 'akazie', size: 'klein', seed: 2 });
  for (const [x, z, height] of WILD_CACTI) for (let y = 0; y < height; y++) b.set(x, y, z, 'cactus[age=0]');
  rock(b, { x: 11, y: 0, z: -5, size: 'mittel', material: 'sandstein', moss: false, seed: 4 });
  rock(b, { x: 10, y: 0, z: 7, size: 'klein', material: 'sandstein', moss: false, rubble: false, seed: 9 });
  vegetation(b, { x: -15, y: -1, z: -8, width: 31, depth: 21, mix: 'trocken', density: 0.25, seed: 15 });
}

export default function build(b) {
  ground(b);
  collector(b);
  basin(b);
  sandOnString(b);
  cacti(b);
  water(b);
  walls(b);
  surroundings(b);
}
