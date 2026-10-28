// Hühnerfarm mit Brat-Automatik: Hühner stehen oben auf Trichtern, die Eier rutschen in einen Werfer,
// der sie in eine kleine Kammer wirft. Dort schlüpfen Küken auf Stufen; sobald sie erwachsen sind,
// ragt ihr Kopf in den Boden der Lavakessel darüber – das gebratene Hähnchen fällt auf die Stufen, die
// Trichter saugen es durch in die Truhe. Ein Beobachter-Takt löst den Werfer laufend aus.
// Lokale Koordinaten: Wiese bis y = 0, Truhe (1…2, 1, 2), Kammer (1…2, 3, 2), Lavakessel (1…2, 4, 2),
// Gehege-Trichter y = 5 (x 0…2, z 1…3), Hühner auf y = 6. Vorderseite = Süden.

import { WOOD, terrain, path, flowerBed, bush, tree, vegetation, gardenFence, hangingLantern, wallLantern, lampPost } from '../lib/index.js';

export const meta = {
  id: 'huehnerfarm',
  title: 'Hühnerfarm mit Brat-Automatik',
  category: 'farmen',
  subtitle: 'Eier ausbrüten, Küken großziehen, Hähnchen gebraten einsammeln',
  tags: ['Farm', 'Hühner', 'Huhn', 'Essen', 'Gebratenes Hähnchen', 'Federn', 'Werfer', 'Trichter', 'Lava', 'Lavakessel', 'Kessel', 'Automatisch', 'Redstone'],
  aliases: [
    'huehnerfarm', 'hühnerfarm', 'huhnerfarm', 'hünerfarm', 'huehner farm', 'hühner farm', 'hühnchenfarm', 'haehnchenfarm',
    'hähnchenfarm', 'chickenfarm', 'chicken farm', 'cooked chicken farm', 'automatic chicken farm', 'chicken cooker',
    'eierfarm', 'eier farm', 'egg farm', 'brathähnchen farm', 'brathaehnchen', 'grillhähnchen', 'automatische hühnerfarm',
    'federfarm', 'feather farm', 'essensfarm', 'food farm',
  ],
  accuracy: 'vorlage',
  description: 'Neun Hühner stehen in einem Glasgehege auf Trichtern. Ihre Eier wandern durch die Trichter in einen Werfer, den ein kleiner Beobachter-Takt immer wieder auslöst: Er wirft die Eier in eine Kammer darunter, wo ab und zu ein Küken schlüpft. Die Küken stehen auf Stufen, knapp unter zwei Lavakesseln – erst wenn sie nach 20 Minuten erwachsen sind, ragt ihr Kopf in den Kesselboden und sie fangen Feuer. Das gebratene Hähnchen und die Federn fallen auf die Stufen, die Trichter darunter saugen sie in die Truhe vorne.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Hühnerfarm (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Chicken_farming' },
    { title: 'Minecraft Wiki: Huhn (englisch)', url: 'https://minecraft.wiki/w/Chicken' },
    { title: 'Minecraft Wiki: Beobachter (englisch)', url: 'https://minecraft.wiki/w/Observer' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const WALL = 'stone_bricks';
const MOSSY = 'mossy_stone_bricks';
const CORNER = 'polished_andesite';
const PLINTH = 'cobblestone';
const CHAMBER_X = [1, 2];
const CHAMBER_Z = 2;
const PEN = { x1: 0, x2: 2, z1: 1, z2: 3, y: 5 };
const TOWER = { x1: -1, x2: 3, z1: 0, z2: 4, top: 5 };

// Trichter im Gehege schieben alles zum Sammeltrichter (0, 5, 2) über dem Werfer.
function penHopperFacing(x, z) {
  if (x === 0 && z === CHAMBER_Z) return 'down';
  if (z === CHAMBER_Z) return 'west';
  return z < CHAMBER_Z ? 'south' : 'north';
}

// Außenwand-Block: Ecken poliertes Andesit, sonst Steinziegel mit festen Moosflecken.
function towerWallBlock(x, y, z) {
  const corner = (x === TOWER.x1 || x === TOWER.x2) && (z === TOWER.z1 || z === TOWER.z2);
  if (corner) return CORNER;
  return (x * 3 + y * 5 + z * 7) % 11 === 0 ? MOSSY : WALL;
}

// Gesims-Treppen: hohe Seite zum Turm; an den Ecken entstehen Außenecken von selbst.
function corniceFacing(x, z) {
  if (z === TOWER.z1 - 1) return 'south';
  if (z === TOWER.z2 + 1) return 'north';
  return x < TOWER.x1 ? 'east' : 'west';
}

function isTowerShell(x, z) {
  return x === TOWER.x1 || x === TOWER.x2 || z === TOWER.z1 || z === TOWER.z2;
}

function foundation(b) {
  b.phase('Fundament');
  terrain(b, { x: -8, y: -1, z: -7, width: 19, depth: 19, height: 1, seed: 'huehnerfarm' });
  b.step();
  b.fill(TOWER.x1, 0, TOWER.z1, TOWER.x2, 0, TOWER.z2, PLINTH);
}

function collector(b) {
  b.phase('Truhe und Kammer');
  b.step();
  for (const x of CHAMBER_X) b.set(x, 1, CHAMBER_Z, 'chest[facing=south]');

  b.step();
  for (const x of CHAMBER_X) b.set(x, 2, CHAMBER_Z, 'hopper[facing=down]');

  b.step();
  for (const x of CHAMBER_X) b.slab(x, 3, CHAMBER_Z, 'smooth_stone_slab', { type: 'bottom' });
}

function clock(b) {
  b.phase('Werfer und Takt');
  b.step();
  b.set(0, 1, CHAMBER_Z, 'observer[facing=up]');
  b.set(0, 2, CHAMBER_Z, 'observer[facing=down]');

  b.step();
  b.set(0, 3, CHAMBER_Z, 'dispenser[facing=east]');
  b.set(0, 4, CHAMBER_Z, 'hopper[facing=down]');
}

function tower(b) {
  b.phase('Turmwände');
  b.step();
  for (let y = 1; y <= TOWER.top; y++) {
    for (let x = TOWER.x1; x <= TOWER.x2; x++) {
      for (let z = TOWER.z1; z <= TOWER.z2; z++) {
        if (!isTowerShell(x, z)) continue;
        const niche = z === TOWER.z2 && CHAMBER_X.includes(x) && y <= 2;
        if (!niche) b.set(x, y, z, towerWallBlock(x, y, z));
      }
    }
  }

  b.step();
  const keep = new Set([
    '1,1,2', '2,1,2', '1,2,2', '2,2,2', '1,3,2', '2,3,2', '1,4,2', '2,4,2',
    '0,1,2', '0,2,2', '0,3,2', '0,4,2', '1,1,3', '2,1,3', '1,2,3', '2,2,3',
  ]);
  for (let y = 1; y <= 4; y++) {
    for (let x = TOWER.x1 + 1; x < TOWER.x2; x++) {
      for (let z = TOWER.z1 + 1; z < TOWER.z2; z++) {
        if (!keep.has(`${x},${y},${z}`)) b.set(x, y, z, WALL);
      }
    }
  }
  b.step();
  for (const x of CHAMBER_X) b.stairs(x, 3, TOWER.z2, 'stone_brick_stairs', { facing: 'north', half: 'top' });
  b.set(TOWER.x2, 3, CHAMBER_Z, 'glass');

  b.step();
  for (let x = TOWER.x1 - 1; x <= TOWER.x2 + 1; x++) {
    for (let z = TOWER.z1 - 1; z <= TOWER.z2 + 1; z++) {
      const ring = x === TOWER.x1 - 1 || x === TOWER.x2 + 1 || z === TOWER.z1 - 1 || z === TOWER.z2 + 1;
      if (!ring || (x === TOWER.x1 - 1 && z === CHAMBER_Z)) continue;
      b.stairs(x, TOWER.top, z, 'stone_brick_stairs', { facing: corniceFacing(x, z), half: 'top' });
    }
  }
}

function lavaCauldrons(b) {
  b.phase('Lavakessel');
  b.step();
  for (const x of CHAMBER_X) b.set(x, 4, CHAMBER_Z, 'lava_cauldron');
}

function pen(b) {
  b.phase('Gehege');
  b.step();
  for (let x = PEN.x1; x <= PEN.x2; x++) {
    for (let z = PEN.z1; z <= PEN.z2; z++) b.set(x, PEN.y, z, `hopper[facing=${penHopperFacing(x, z)}]`);
  }

  b.step();
  for (const x of [TOWER.x1, TOWER.x2]) {
    for (const z of [TOWER.z1, TOWER.z2]) for (let y = 6; y <= 7; y++) b.set(x, y, z, `${spruce.log}[axis=y]`);
  }

  b.step();
  for (let y = 6; y <= 7; y++) {
    for (let x = TOWER.x1; x <= TOWER.x2; x++) {
      for (let z = TOWER.z1; z <= TOWER.z2; z++) {
        if (!isTowerShell(x, z)) continue;
        const corner = (x === TOWER.x1 || x === TOWER.x2) && (z === TOWER.z1 || z === TOWER.z2);
        if (corner) continue;
        const gate = x === TOWER.x1 && z === CHAMBER_Z && y === 6;
        b.set(x, y, z, gate ? `${spruce.fenceGate}[facing=east]` : 'glass');
      }
    }
  }

  b.step();
  for (let y = 1; y <= TOWER.top; y++) b.set(-2, y, CHAMBER_Z, 'ladder[facing=west]');
}

function roof(b) {
  b.phase('Dach und Hühner');
  b.roof({ x1: TOWER.x1, z1: TOWER.z1, x2: TOWER.x2, z2: TOWER.z2, y: 7, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
  b.step();
  hangingLantern(b, { x: 1, y: 9, z: CHAMBER_Z, chain: 1 });
}

function surroundings(b) {
  b.phase('Hof und Umgebung');
  b.step();
  gardenFence(b, { x: 5, y: 1, z: 0, width: 5, depth: 5, fence: spruce.fence, gate: spruce.fenceGate, posts: spruce.strippedLog, lanterns: true });
  b.set(8, 1, 1, 'hay_block[axis=x]');
  b.set(8, 2, 1, 'hay_block[axis=z]');
  b.set(6, 1, 1, 'composter[level=0]');
  b.set(8, 1, 3, 'water_cauldron[level=3]');

  b.step();
  path(b, { x: 1, y: 0, z: 5, facing: 'south', length: 5, width: 3, mix: 'erde', wiggle: 0.5, seed: 7 });
  wallLantern(b, { x: TOWER.x1, y: 2, z: TOWER.z2, facing: 'south', arm: spruce.fence });
  wallLantern(b, { x: TOWER.x2, y: 2, z: TOWER.z2, facing: 'south', arm: spruce.fence });
  flowerBed(b, { x: -5, y: 0, z: 0, width: 2, depth: 5, facing: 'west', palette: 'warm', seed: 5 });
  lampPost(b, { x: -1, y: 1, z: 7, height: 3, post: spruce.fence, style: 'arm' });
  bush(b, { x: -5, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 3 });
  bush(b, { x: 10, y: 1, z: 7, size: 'klein', leaves: 'azalee', seed: 4 });
  tree(b, { x: 7, y: 1, z: -5, species: 'birke', size: 'klein', seed: 2 });
  vegetation(b, { x: -8, y: 0, z: -7, width: 19, depth: 19, mix: 'wiese', density: 0.3, seed: 11 });
}

export default function build(b) {
  foundation(b);
  collector(b);
  clock(b);
  tower(b);
  lavaCauldrons(b);
  pen(b);
  roof(b);
  surroundings(b);
}
