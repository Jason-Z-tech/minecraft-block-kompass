// Weizenfarm mit Wasser-Ernte: 8 Weizenreihen à 7 Pflanzen auf Ackerboden, in der Mitte eine abgedeckte
// Wasserrinne zum Bewässern. Ein Knopf schaltet acht Werfer mit Wassereimern: Das Wasser spült alles zur
// Trichterreihe vorne, die in eine Truhe sammelt. Zweiter Knopfdruck holt das Wasser zurück.
// Lokale Koordinaten: Wiese bis y = 0, Ackerboden y = 1, Pflanzen y = 2. Werfer bei z = 0 (Norden),
// Pflanzen z = 1…7, Trichter z = 8, Truhe (4, 1, 9). Vorderseite = Süden (Truhe).

import { WOOD, terrain, path, bush, vegetation, flowerBed, lampPost } from '../lib/index.js';

export const meta = {
  id: 'weizenfarm-wasser',
  title: 'Weizenfarm mit Wasser-Ernte',
  category: 'farmen',
  subtitle: 'Ein Knopfdruck spült das reife Feld in die Truhe',
  tags: ['Farm', 'Weizen', 'Ackerbau', 'Wasser', 'Werfer', 'Trichter', 'Halbautomatisch', 'Redstone', 'Anfänger', 'Brot'],
  aliases: [
    'weizenfarm', 'weizen farm', 'weizenfarm wasser', 'wasser ernte', 'wasserernte', 'halbautomatische weizenfarm',
    'feld', 'ackerfeld', 'weizenfeld', 'weitzenfarm', 'weizn farm', 'getreidefarm', 'brotfarm', 'wheat farm',
    'semi automatic wheat farm', 'water harvest farm', 'dispenser wheat farm', 'crop farm', 'water crop farm',
  ],
  accuracy: 'vorlage',
  description: 'Acht Reihen Weizen mit je sieben Pflanzen, in der Mitte eine Wasserrinne unter Stufen, die den ganzen Acker feucht hält. Hinter jeder Reihe steht ein Werfer mit einem Wassereimer. Ist das Feld reif, drückst du den Knopf: Das Wasser bricht alle Pflanzen ab und schwemmt Weizen und Samen zur Trichterreihe, die alles in die Truhe schiebt. Ein zweiter Knopfdruck holt das Wasser zurück, danach säst du von Hand neu.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Feldfrucht-Farmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Crop_farming' },
    { title: 'Minecraft Wiki: Ackerboden (englisch)', url: 'https://minecraft.wiki/w/Farmland' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const ROWS = [0, 1, 2, 3, 5, 6, 7, 8];
const CHANNEL_X = 4;
const FIRST_Z = 1;
const LAST_Z = 7;
const HOPPER_Z = 8;
const FRONT_Z = 9;
const STONE = 'stone_bricks';
const SLAB = 'stone_brick_slab[type=bottom]';

function hopperFacing(x) {
  if (x < CHANNEL_X) return 'east';
  if (x > CHANNEL_X) return 'west';
  return 'south';
}

function ground(b) {
  b.phase('Platz und Sammelrinne');
  terrain(b, { x: -6, y: -1, z: -6, width: 21, depth: 22, height: 1, seed: 'weizenfarm' });
  b.step();
  b.set(CHANNEL_X, 1, FRONT_Z, 'chest[facing=south]');

  b.step();
  for (let x = 0; x <= 8; x++) b.set(x, 1, HOPPER_Z, `hopper[facing=${hopperFacing(x)}]`);
}

function field(b) {
  b.phase('Acker und Bewässerung');
  b.step();
  for (let x = -1; x <= 9; x++) b.set(x, 1, 0, STONE);
  for (const x of [-1, 9]) for (let z = FIRST_Z; z <= FRONT_Z; z++) b.set(x, 1, z, STONE);
  for (let x = 0; x <= 8; x++) if (x !== CHANNEL_X) b.set(x, 1, FRONT_Z, STONE);

  b.step();
  for (const x of ROWS) for (let z = FIRST_Z; z <= LAST_Z; z++) b.set(x, 1, z, 'farmland[moisture=7]');

  b.step();
  for (let z = FIRST_Z; z <= LAST_Z; z++) {
    b.set(CHANNEL_X, 1, z, 'water[level=0]');
    b.set(CHANNEL_X, 2, z, SLAB);
  }
}

function dispensers(b) {
  b.phase('Werfer und Knopf');
  b.step();
  for (const x of ROWS) b.set(x, 2, 0, 'dispenser[facing=south]');
  for (const x of [-1, CHANNEL_X, 9]) b.set(x, 2, 0, STONE);

  b.step();
  for (let x = -1; x <= 8; x++) b.set(x, 3, 0, 'redstone_wire');
  b.set(-2, 2, 0, 'stone_button[face=wall,facing=west]');
}

function walls(b) {
  b.phase('Mauer und Zaun');
  b.step();
  for (const x of [-1, 9]) for (let z = FIRST_Z; z <= HOPPER_Z; z++) b.set(x, 2, z, STONE);
  for (let x = -1; x <= 9; x++) b.set(x, 2, FRONT_Z, SLAB);

  b.step();
  for (const x of [-1, 9]) {
    b.set(x, 2, FRONT_Z, `${spruce.log}[axis=y]`);
    b.set(x, 3, FRONT_Z, `${spruce.log}[axis=y]`);
    for (let z = FIRST_Z; z <= HOPPER_Z; z++) b.set(x, 3, z, spruce.fence);
  }
  for (let x = 0; x <= 8; x++) {
    b.set(x, 3, FRONT_Z, x === CHANNEL_X ? `${spruce.fenceGate}[facing=north]` : spruce.fence);
  }
  b.stairs(CHANNEL_X, 1, FRONT_Z + 1, 'stone_brick_stairs', { facing: 'north', half: 'bottom' });
}

function sow(b) {
  b.phase('Säen');
  for (const x of ROWS) for (let z = FIRST_Z; z <= LAST_Z; z++) b.set(x, 2, z, 'wheat[age=7]');
}

function surroundings(b) {
  b.phase('Licht und Umgebung');
  b.step();
  for (const x of [-1, 9]) b.set(x, 4, FRONT_Z, 'lantern[hanging=false]');
  lampPost(b, { x: -2, y: 1, z: -1, height: 3, post: spruce.fence });
  lampPost(b, { x: 10, y: 1, z: -1, height: 3, post: spruce.fence });

  b.step();
  path(b, { x: CHANNEL_X, y: 0, z: FRONT_Z + 1, facing: 'south', length: 6, width: 3, mix: 'erde', wiggle: 0.5, seed: 5 });
  flowerBed(b, { x: -1, y: 0, z: FRONT_Z + 1, width: 3, depth: 2, facing: 'south', palette: 'warm', seed: 3 });
  flowerBed(b, { x: 7, y: 0, z: FRONT_Z + 1, width: 3, depth: 2, facing: 'south', palette: 'warm', seed: 4 });
  bush(b, { x: -4, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: 12, y: 1, z: -4, size: 'klein', leaves: 'birke', seed: 8 });
  bush(b, { x: 4, y: 1, z: -4, size: 'mittel', leaves: 'eiche', seed: 5 });
  vegetation(b, { x: -6, y: 0, z: -6, width: 21, depth: 22, mix: 'wiese', density: 0.3, seed: 12 });
}

export default function build(b) {
  ground(b);
  field(b);
  dispensers(b);
  walls(b);
  sow(b);
  surroundings(b);
}
