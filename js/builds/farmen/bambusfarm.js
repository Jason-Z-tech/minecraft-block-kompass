// Bambusfarm: zwei Reihen Bambus auf Schlamm, außen je eine Reihe Kolben, darüber Beobachter auf Höhe des vierten Rohrs.
// Wird ein Bambus vier Blöcke hoch, feuert die ganze Reihe: die Kolben schlagen das zweite Rohr ab, alles darüber
// bricht mit, die Stücke fallen auf den Schlamm und die Trichter darunter bringen sie in die Truhe.
// Lokale Koordinaten: Wiese bis y = −1 (Trichter eingelassen auf y = −1), Schlamm y = 0, Bambus ab y = 1.
// Reihe x = 0 … 7: z = 0 und z = 1 Bambus, z = −1 und z = 2 Kolben/Beobachter, z = −2 und z = 3 Redstone.

import { WOOD, terrain, path, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'bambusfarm',
  title: 'Bambusfarm',
  category: 'farmen',
  subtitle: 'Zwei Reihen Bambus, Beobachter und Kolben ernten automatisch',
  tags: ['Farm', 'Bambus', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Brennstoff', 'Gerüst', 'Technik'],
  aliases: [
    'bambusfarm', 'bambus farm', 'automatische bambusfarm', 'bambus', 'bamboo farm', 'bamboo', 'automatic bamboo farm',
    'observer bamboo farm', 'bambusfram', 'bamusfarm', 'gerüstfarm', 'brennstofffarm', 'fuel farm',
  ],
  accuracy: 'eigenes',
  description: 'Sechzehn Bambuspflanzen wachsen in zwei Reihen auf Schlamm. Erreicht ein Bambus seinen vierten Block, sieht ihn der Beobachter auf dieser Höhe, und die acht Kolben seiner Reihe schlagen den zweiten Block ab – alles darüber bricht mit und fällt herunter. Unter dem Schlamm sammeln Trichter jedes Stück ein und füllen die Truhe. Der unterste Block bleibt stehen und wächst einfach nach; du musst nur einmal pflanzen.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Bambusfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Bamboo_farming' },
  ],
  credits: null,
  tested: false,
};

const LENGTH = 8;
const LAST = LENGTH - 1;
const EAST = LENGTH; // Ostwand x = 8
const bamboo = WOOD.bambus;
const BASE = 'mud_bricks';
const CARRIER = 'packed_mud';
// Pfeiler vor den Außenwänden: Ecken und ein Doppelpfeiler in der Mitte
const PILLAR_X = [-1, 3, 4, EAST];

// Beide Seiten sind gleich gebaut: innen = Bambusreihe, mech = Kolben/Beobachter, wire = Redstone
const SIDES = [
  { inner: 0, mech: -1, wire: -2, face: -3, push: 'south', out: 'north' }, // Nordseite
  { inner: 1, mech: 2, wire: 3, face: 4, push: 'north', out: 'south' }, // Südseite
];

// Nordwest-Ecke des Geländes
const GROUND_X = -6;
const GROUND_Z = -7;

function ground(b) {
  b.phase('Platz vorbereiten');
  terrain(b, { x: GROUND_X, y: -2, z: GROUND_Z, width: 20, depth: 16, height: 1, seed: 'bambus' });
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
  b.phase('Fundament und Schlamm');
  b.step();
  for (let x = -1; x <= EAST; x++) {
    for (let z = -2; z <= 3; z++) {
      if ((z === 0 || z === 1) && x >= 0) continue;
      b.set(x, -1, z, BASE);
    }
    for (const z of [-2, -1, 2, 3]) b.set(x, 0, z, BASE);
  }
  for (const x of [-1, EAST]) for (const z of [0, 1]) b.set(x, 0, z, BASE);

  b.step();
  for (let x = 0; x <= LAST; x++) for (const z of [0, 1]) b.set(x, 0, z, 'mud');
}

function machine(b) {
  b.phase('Kolben, Beobachter und Redstone');
  b.step();
  for (let x = 0; x <= LAST; x++) for (const z of [-2, -1, 2, 3]) b.set(x, 1, z, BASE);

  for (const side of SIDES) {
    b.step();
    for (let x = 0; x <= LAST; x++) {
      b.set(x, 2, side.mech, `piston[facing=${side.push}]`);
      b.set(x, 2, side.wire, CARRIER);
    }
  }

  for (const side of SIDES) {
    b.step();
    for (let x = 0; x <= LAST; x++) {
      b.set(x, 3, side.wire, 'redstone_wire');
      b.set(x, 3, side.mech, BASE);
    }
  }

  for (const side of SIDES) {
    b.step();
    for (let x = 0; x <= LAST; x++) {
      b.set(x, 4, side.mech, `observer[facing=${side.push}]`);
      b.set(x, 4, side.wire, CARRIER);
    }
  }
}

function enclosure(b) {
  b.phase('Schacht, Fassade und Rahmen');
  b.step();
  for (const x of [-1, EAST]) {
    for (let y = 1; y <= 5; y++) {
      b.set(x, y, 0, 'glass');
      b.set(x, y, 1, 'glass');
      for (const z of [-2, -1, 2, 3]) b.set(x, y, z, bamboo.mosaic);
    }
  }

  b.step();
  for (let x = 0; x <= LAST; x++) {
    for (const z of [-2, -1, 2, 3]) b.set(x, 5, z, 'stripped_bamboo_block[axis=x]');
  }

  for (const side of SIDES) {
    const toWall = side.push;
    b.step();
    for (const x of PILLAR_X) for (let y = 0; y <= 6; y++) b.set(x, y, side.face, `${bamboo.log}[axis=y]`);
    for (let x = 0; x <= LAST; x++) {
      if (PILLAR_X.includes(x)) continue;
      b.set(x, 0, side.face, `mud_brick_stairs[facing=${toWall},half=bottom]`);
      b.set(x, 3, side.face, `${bamboo.trapdoor}[facing=${side.out},half=bottom,open=true]`);
      b.set(x, 5, side.face, `${bamboo.mosaicStairs}[facing=${toWall},half=top]`);
    }
  }

  b.step();
  for (const side of SIDES) for (const x of PILLAR_X) b.set(x, 7, side.face, 'lantern[hanging=false]');
}

function plant(b) {
  b.phase('Bambus pflanzen');
  for (let x = 0; x <= LAST; x++) for (const z of [0, 1]) b.set(x, 1, z, 'bamboo[age=0,leaves=none,stage=0]');
}

function surroundings(b) {
  b.phase('Umgebung');
  path(b, { x: EAST + 2, y: -1, z: 1, facing: 'east', length: 3, width: 3, mix: 'gemischt', wiggle: 0.5, seed: 5 });
  bush(b, { x: -4, y: 0, z: 5, size: 'mittel', leaves: 'dschungel', seed: 1 });
  bush(b, { x: 12, y: 0, z: -5, size: 'klein', leaves: 'dschungel', seed: 8 });
  bush(b, { x: -4, y: 0, z: -5, size: 'klein', leaves: 'azalee', seed: 3 });
  vegetation(b, { x: -6, y: -1, z: -7, width: 20, depth: 16, mix: 'farn', density: 0.35, seed: 14 });
}

export default function build(b) {
  ground(b);
  collector(b);
  foundation(b);
  machine(b);
  plant(b);
  enclosure(b);
  surroundings(b);
}
