// Eisenfarm: drei Dorfbewohner schlafen in einem Glasraum über einer Wasserplattform, ein Zombie schaut
// von oben zu und versetzt sie in Panik – dann rufen sie Eisengolems. Die Golems spawnen auf der
// Plattform, das Wasser schiebt sie in eine Grube, wo eine Lavaklinge über Schildern sie verbrennt.
// Eisen und Mohnblumen schwimmen zu zwei Trichtern und fallen in die Truhe.
// Lokale Koordinaten: Wiese bis y = 0, Plattformboden y = 6 (x 0…8, z 0…7), Grube z 8…9 (Boden y = 2,
// Lava y = 5), Dorfbewohner-Raum y = 11 (x 3…5, z 3…4), Zombie y = 14 (x 4, z 2). Vorderseite = Süden.

import { WOOD, terrain, path, bush, tree, vegetation, flowerBed, lightRoom } from '../lib/index.js';

export const meta = {
  id: 'eisenfarm',
  title: 'Eisenfarm',
  category: 'farmen',
  subtitle: 'Drei Dorfbewohner, ein Zombie und eine Lavaklinge für Eisengolems',
  tags: ['Farm', 'Eisen', 'Eisengolem', 'Golem', 'Dorfbewohner', 'Zombie', 'Panik', 'Lava', 'Trichter', 'Automatisch'],
  aliases: [
    'eisenfarm', 'eisen farm', 'eisengolemfarm', 'eisengolem farm', 'golemfarm', 'golem farm', 'iron farm', 'iron golem farm',
    'ironfarm', 'eisnfarm', 'eisenfram', 'eisen golem farm', 'panik farm', 'villager iron farm', 'dorfbewohner eisenfarm',
    'eisenbarren farm', 'iron ingot farm', 'mohnfarm',
  ],
  accuracy: 'vorlage',
  description: 'Drei Dorfbewohner schlafen in einem kleinen Glasraum über einer Wasserplattform, jeder mit eigenem Bett und Arbeitsplatz. Über ihnen steht ein Zombie in einer Zelle, den sie sehen, aber nicht erreichen können – sie geraten in Panik und rufen etwa alle 35 Sekunden einen Eisengolem. Der Golem erscheint auf der Plattform, das Wasser schiebt ihn in eine Grube, wo sein Kopf in eine Lavaklinge über Schildern ragt. Eisenbarren und Mohnblumen schwimmen zu zwei Trichtern und landen in der Truhe.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Eisengolem-Farm (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Iron_golem_farming' },
    { title: 'Minecraft Wiki: Eisengolem (englisch)', url: 'https://minecraft.wiki/w/Iron_Golem' },
    { title: 'Minecraft Wiki: Dorfbewohner (englisch)', url: 'https://minecraft.wiki/w/Villager' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const STONE = 'stone_bricks';
const DARK = 'polished_andesite';
const PLATFORM_Y = 6;
const PIT_FLOOR_Y = 2;
const LAVA_Y = 5;
const VILLAGER_Y = 11;
const ROOM_X = [3, 4, 5];
const ZOMBIE = { x: 4, y: VILLAGER_Y + 3, z: 2 };
const WORKSTATIONS = ['fletching_table', 'composter[level=0]', 'smithing_table'];
const BEDS = ['red_bed', 'blue_bed', 'yellow_bed'];

const isPlatformEdge = (x, z) => x === -1 || x === 9 || z === -1;

// Vorderwand der Grube: Lisene in der Mitte, sonst Steinziegel mit festen Moos- und Rissflecken.
function frontWallBlock(x, y) {
  if (x === 4) return DARK;
  const h = (x * 5 + y * 3) % 7;
  if (h === 0) return 'mossy_stone_bricks';
  return h === 3 ? 'cracked_stone_bricks' : STONE;
}

function base(b) {
  b.phase('Unterbau');
  terrain(b, { x: -9, y: -1, z: -8, width: 27, depth: 27, height: 1, seed: 'eisenfarm' });
  b.step();
  for (const x of [-1, 9]) {
    for (const z of [-1, 3, 10]) {
      for (let y = 1; y <= PLATFORM_Y; y++) {
        if (x === 9 && z === 10 && y <= 2) continue;
        b.set(x, y, z, DARK);
      }
    }
  }
}

function pit(b) {
  b.phase('Grube und Truhe');
  b.step();
  for (const z of [8, 9]) {
    b.set(8, 1, z, 'chest[facing=east]');
    b.set(8, PIT_FLOOR_Y, z, 'hopper[facing=down]');
  }

  b.step();
  for (let x = 0; x <= 7; x++) {
    for (const z of [8, 9]) {
      b.set(x, 1, z, 'cobblestone');
      b.set(x, PIT_FLOOR_Y, z, STONE);
    }
  }
  for (let x = 0; x <= 8; x++) {
    for (let y = 1; y <= LAVA_Y; y++) b.set(x, y, 7, STONE);
    for (let y = 1; y <= PLATFORM_Y; y++) b.set(x, y, 10, frontWallBlock(x, y));
  }
  for (const z of [8, 9]) {
    for (let y = 1; y <= PLATFORM_Y; y++) b.set(-1, y, z, STONE);
    for (let y = PIT_FLOOR_Y + 1; y <= PLATFORM_Y; y++) b.set(9, y, z, STONE);
  }
  b.set(9, PIT_FLOOR_Y + 1, 10, DARK);
  for (let x = -1; x <= 8; x++) b.stairs(x, 1, 11, 'stone_brick_stairs', { facing: 'north', half: 'bottom' });
  for (let y = PIT_FLOOR_Y + 2; y < PLATFORM_Y; y++) b.set(9, y, 10, DARK);
}

function platform(b) {
  b.phase('Plattform');
  b.step();
  for (let x = -1; x <= 9; x++) {
    for (let z = -1; z <= 7; z++) b.set(x, PLATFORM_Y, z, isPlatformEdge(x, z) ? STONE : 'smooth_stone');
  }
  b.step();
  for (let y = PLATFORM_Y + 1; y <= PLATFORM_Y + 3; y++) {
    for (let x = -1; x <= 9; x++) {
      for (let z = -1; z <= 10; z++) {
        const edge = x === -1 || x === 9 || z === -1 || z === 10;
        if (!edge) continue;
        const corner = (x === -1 || x === 9) && (z === -1 || z === 10);
        b.set(x, y, z, corner ? DARK : 'glass');
      }
    }
  }
  for (const x of [-1, 9]) for (const z of [-1, 10]) b.set(x, PLATFORM_Y + 4, z, 'lantern[hanging=false]');
}

function lavaBlade(b) {
  b.phase('Lavaklinge');
  b.step();
  for (let x = 0; x <= 8; x++) {
    b.set(x, LAVA_Y - 1, 9, `${spruce.wallSign}[facing=north]`);
    b.set(x, LAVA_Y, 8, `${spruce.wallSign}[facing=south]`);
  }
  b.step();
  for (let x = 0; x <= 8; x++) b.set(x, LAVA_Y, 9, 'lava[level=0]');
}

function water(b) {
  b.phase('Wasser');
  b.step();
  for (let x = 0; x <= 8; x++) {
    for (let z = 0; z <= 7; z++) b.set(x, PLATFORM_Y + 1, z, z === 0 ? 'water[level=0]' : `water[level=${z}]`);
  }
  b.step();
  for (let x = 0; x <= 7; x++) {
    for (const z of [8, 9]) b.set(x, PIT_FLOOR_Y + 1, z, x === 0 ? 'water[level=0]' : `water[level=${x}]`);
  }
}

function villagerRoom(b) {
  const y = VILLAGER_Y;
  b.phase('Raum der Dorfbewohner');
  b.step();
  for (let x = 2; x <= 6; x++) for (let z = 2; z <= 5; z++) b.set(x, y - 1, z, STONE);

  b.step();
  ROOM_X.forEach((x, i) => b.bed(x, y, 4, BEDS[i], { facing: 'north' }));

  b.step();
  for (let wy = y; wy <= y + 1; wy++) {
    for (let x = 2; x <= 6; x++) {
      for (let z = 2; z <= 5; z++) {
        const edge = x === 2 || x === 6 || z === 2 || z === 5;
        if (!edge) continue;
        const station = z === 5 && wy === y && ROOM_X.includes(x);
        b.set(x, wy, z, station ? WORKSTATIONS[ROOM_X.indexOf(x)] : 'glass');
      }
    }
  }
}

function zombieCell(b) {
  const { x, y, z } = ZOMBIE;
  b.phase('Zombie-Zelle');
  b.step();
  b.set(x, y - 1, z, STONE);
  for (let wy = y - 1; wy <= y + 1; wy++) {
    b.set(x - 1, wy, z, 'glass');
    b.set(x + 1, wy, z, 'glass');
    b.set(x, wy, z - 1, 'glass');
  }
  b.step();
  b.set(x, y + 1, z + 1, 'glass');
  b.step();
  b.set(x, y + 2, z, STONE);
  b.set(x, y + 3, z, 'glass');
}

function surroundings(b) {
  b.phase('Licht und Umgebung');
  b.step();
  lightRoom(b, { x1: -1, y1: 1, z1: -1, x2: 9, y2: PLATFORM_Y - 1, z2: 9 }, { lantern: 'lantern' });

  b.step();
  path(b, { x: 10, y: 0, z: 8, facing: 'east', length: 6, width: 2, mix: 'kies', wiggle: 0, seed: 3 });
  flowerBed(b, { x: 0, y: 0, z: 12, width: 9, depth: 2, facing: 'south', palette: 'rosa', seed: 6 });
  tree(b, { x: -7, y: 1, z: 15, species: 'eiche', size: 'mittel', seed: 4 });
  tree(b, { x: 15, y: 1, z: -6, species: 'fichte', size: 'mittel', seed: 9 });
  bush(b, { x: -6, y: 1, z: -6, size: 'mittel', leaves: 'eiche', seed: 2 });
  bush(b, { x: 15, y: 1, z: 15, size: 'klein', leaves: 'azalee', seed: 5 });
  vegetation(b, { x: -9, y: 0, z: -8, width: 27, depth: 27, mix: 'wiese', density: 0.3, seed: 8 });
}

export default function build(b) {
  base(b);
  pit(b);
  platform(b);
  lavaBlade(b);
  water(b);
  villagerRoom(b);
  zombieCell(b);
  surroundings(b);
}
