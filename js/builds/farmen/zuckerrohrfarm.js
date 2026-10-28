// Zuckerrohrfarm: eine Reihe Zuckerrohr auf Schlamm neben Wasser. Beobachter oben erkennen das dritte Rohr,
// Redstone schaltet alle Kolben in der Mitte, die Trichter unter dem Schlamm sammeln alles in eine Truhe.
// Lokale Koordinaten: Wiese bis y = 0, Reihe x = 0 … 9, Zuckerrohr z = 0, Wasser/Glas im Süden (z = 1),
// Kolben/Beobachter im Norden (z = −1), Redstone z = −2. Vorderseite = Süden (Glasseite).

import { WOOD, terrain, path, bush, vegetation, flowerBed } from '../lib/index.js';

export const meta = {
  id: 'zuckerrohrfarm',
  title: 'Zuckerrohrfarm',
  category: 'farmen',
  subtitle: 'Vollautomatisch mit Beobachtern, Kolben und Trichtern',
  tags: ['Farm', 'Zuckerrohr', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Papier', 'Technik', 'Anfänger'],
  aliases: [
    'zuckerrohrfarm', 'zuckerrohr farm', 'automatische zuckerrohrfarm', 'zuckerrohr', 'zuckerrohfarm', 'zuckerohrfarm',
    'papierfarm', 'papier farm', 'sugar cane farm', 'sugarcane farm', 'automatic sugar cane farm', 'sugar cane',
    'observer sugar cane farm', 'cane farm',
  ],
  accuracy: 'eigenes',
  description: 'Zehn Zuckerrohre wachsen auf Schlamm direkt neben einer Wasserrinne. Sobald irgendein Rohr drei Blöcke hoch ist, sieht es der Beobachter darüber und schickt über eine Redstone-Leitung einen Puls an alle zehn Kolben – sie schlagen das mittlere Rohr ab, das obere fällt mit. Die Rohre fallen in einem Glasschacht auf den Schlamm, die Trichter darunter ziehen sie durch den Schlamm hindurch und schieben sie in eine Doppeltruhe. Du musst nur das Zuckerrohr pflanzen und ab und zu die Truhe leeren.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Zuckerrohr-Farmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Sugar_cane_farming' },
  ],
  credits: null,
  tested: false,
};

const LENGTH = 10;
// Nordwest-Ecke des Geländes
const GROUND_X = -6;
const GROUND_Z = -7;
const LAST = LENGTH - 1;
const spruce = WOOD.fichte;
const WATER = 'water[level=0]';
const BASE = 'stone_bricks';

// Ecken des Rahmens: Pfosten aus Fichtenstamm, außen um den Kasten.
const POSTS = [[-1, -2], [-1, 2], [LENGTH, -2], [LENGTH, 2]];

function ground(b) {
  b.phase('Platz vorbereiten');
  terrain(b, { x: GROUND_X, y: -1, z: GROUND_Z, width: 22, depth: 15, height: 1, seed: 'zuckerrohr' });
}

function collector(b) {
  b.phase('Truhe und Trichter');
  b.step();
  b.set(LENGTH + 1, 1, 0, 'chest[facing=east]');
  b.set(LENGTH + 1, 1, 1, 'chest[facing=east]');
  b.step();
  for (let x = LENGTH; x >= 0; x--) b.set(x, 1, 0, 'hopper[facing=east]');
}

function base(b) {
  b.phase('Unterbau, Schlamm und Wasser');
  b.step();
  for (let x = -1; x <= LENGTH; x++) {
    for (const z of [-2, -1, 1, 2]) b.set(x, 1, z, BASE);
    b.set(x, 2, 2, BASE);
    b.set(x, 2, -1, BASE);
    b.set(x, 2, -2, BASE);
  }
  b.set(-1, 1, 0, BASE);
  for (const x of [-1, LENGTH]) for (let z = -2; z <= 2; z++) b.set(x, 2, z, BASE);

  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 2, 0, 'mud');

  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 2, 1, WATER);
}

function machine(b) {
  b.phase('Kolben, Beobachter und Redstone');
  b.step();
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 3, -1, BASE);
    b.set(x, 3, -2, BASE);
    b.set(x, 4, -2, BASE);
  }
  for (const x of [-1, LENGTH]) for (let y = 3; y <= 5; y++) b.set(x, y, -1, BASE);

  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 4, -1, 'piston[facing=south]');

  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 5, -1, 'observer[facing=south]');

  b.step();
  for (let x = 0; x <= LAST; x++) b.set(x, 5, -2, 'redstone_wire');
}

function enclosure(b) {
  b.phase('Glasschacht und Rahmen');
  b.step();
  for (let x = 0; x <= LAST; x++) for (let y = 3; y <= 5; y++) b.set(x, y, 1, 'glass');
  for (const x of [-1, LENGTH]) {
    for (let y = 3; y <= 5; y++) {
      b.set(x, y, 0, 'glass');
      b.set(x, y, 1, 'glass');
    }
  }

  b.step();
  for (const [x, z] of POSTS) for (let y = 1; y <= 6; y++) b.set(x, y, z, `${spruce.log}[axis=y]`);
  for (let x = -1; x <= LENGTH; x++) {
    b.set(x, 6, -1, `${spruce.strippedLog}[axis=x]`);
    b.set(x, 6, 1, `${spruce.strippedLog}[axis=x]`);
    b.set(x, 3, 2, 'stone_brick_slab[type=bottom]');
  }
  for (const x of [-1, LENGTH]) b.set(x, 6, 0, `${spruce.strippedLog}[axis=z]`);
  for (const x of [-1, LENGTH]) b.set(x, 3, 2, `${spruce.log}[axis=y]`);
}

function plant(b) {
  b.phase('Zuckerrohr pflanzen');
  for (let x = 0; x <= LAST; x++) b.set(x, 3, 0, 'sugar_cane');
}

function surroundings(b) {
  b.phase('Licht und Umgebung');
  b.step();
  for (const [x, z] of POSTS) b.set(x, 7, z, 'lantern[hanging=false]');

  b.step();
  path(b, { x: LENGTH + 2, y: 0, z: 1, facing: 'south', length: 5, width: 3, mix: 'erde', wiggle: 0.5, seed: 3 });
  flowerBed(b, { x: 0, y: 0, z: 3, width: LENGTH, depth: 2, facing: 'south', palette: 'warm', seed: 7 });
  bush(b, { x: -3, y: 1, z: 5, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: -3, y: 1, z: -5, size: 'klein', leaves: 'azalee', seed: 5 });
  vegetation(b, { x: -6, y: 0, z: -7, width: 22, depth: 15, mix: 'wiese', density: 0.3, seed: 11 });
}

export default function build(b) {
  ground(b);
  collector(b);
  base(b);
  machine(b);
  plant(b);
  enclosure(b);
  surroundings(b);
}
