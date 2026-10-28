// Dorfbrunnen: runder Steinbrunnen mit Wasser, Satteldach auf vier Fichtenpfosten, Seilwinde mit Kurbel.
// Mitte des Brunnens bei (0, 0); Wiese auf y = 0, Brunnenmauer ab y = 1, Vorderseite = Süden.

import { WOOD, lampPost, terrain, path, fixDirtPaths, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'dorfbrunnen',
  title: 'Dorfbrunnen',
  category: 'klein',
  subtitle: 'Runder Steinbrunnen mit Satteldach und Seilwinde',
  tags: ['Brunnen', 'Dorf', 'Mittelalter', 'Deko', 'Wasser', 'Dorfplatz', 'Klein'],
  aliases: [
    'brunnen', 'dorfbrunnen', 'dorf brunnen', 'ziehbrunnen', 'steinbrunnen', 'wunschbrunnen', 'brunen', 'dorfbrunen',
    'well', 'village well', 'wishing well', 'medieval well', 'stone well', 'mittelalter brunnen',
  ],
  accuracy: 'eigenes',
  description: 'Ein runder Brunnen aus Bruchstein mit Wasser im Schacht, darüber ein kleines Satteldach aus Fichte auf vier Pfosten. Unter dem First läuft die Seilwinde mit Kette und Kessel-Eimer, außen sitzt ein Hebel als Kurbel; Kopfbänder aus Treppen steifen die Pfosten aus. Ein Pflasterring, eine Laterne, Fass und Wasserkessel machen ihn zum Mittelpunkt eines Dorfplatzes.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const WATER = 'water[level=0]';
const RING_RADIUS = 3;
const WATER_RADIUS = 2;
const POSTS = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
// Pflasterfelder, auf denen später Fass und Kessel stehen (dort kein Trampelpfad).
const UNDER_OBJECTS = new Set(['4,1', '4,-1']);

// Abstand ≤ r + 0,5 wie bei b.disc (Mittelpunkt-Regel aus ARCHITEKTUR §6.2).
const inDisc = (x, z, r) => Math.hypot(x, z) <= r + 0.5;

function ground(b) {
  b.phase('Boden und Pflaster');
  terrain(b, { x: -8, y: -1, z: -8, width: 17, depth: 17, height: 1, shape: 'rund', seed: 'brunnen' });
  b.disc(0, -2, 0, RING_RADIUS + 1, 'dirt');
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      if (!inDisc(x, z, 5) || inDisc(x, z, RING_RADIUS)) continue;
      // Am Rand des Pflasters mehr Kies und Trampelpfad, innen mehr Stein.
      if (UNDER_OBJECTS.has(`${x},${z}`)) {
        b.set(x, 0, z, 'cobblestone');
        continue;
      }
      const outer = Math.hypot(x, z) > 4.3;
      b.set(x, 0, z, b.pickWeighted(outer
        ? [['cobblestone', 3], ['gravel', 3], ['dirt_path', 3], ['mossy_cobblestone', 2], ['grass_block', 2]]
        : [['cobblestone', 5], ['mossy_cobblestone', 3], ['gravel', 2], ['stone', 1]]));
    }
  }
}

function shaft(b) {
  b.phase('Brunnenschacht und Mauer');
  b.step();
  b.disc(0, -2, 0, WATER_RADIUS, 'mossy_cobblestone');
  for (let y = -2; y <= 0; y++) b.cylinder(0, y, 0, RING_RADIUS, 1, y === -2 ? 'mossy_cobblestone' : 'cobblestone', { hollow: true });

  b.step();
  for (let x = -RING_RADIUS; x <= RING_RADIUS; x++) {
    for (let z = -RING_RADIUS; z <= RING_RADIUS; z++) {
      if (!inDisc(x, z, RING_RADIUS) || inDisc(x, z, WATER_RADIUS)) continue;
      b.set(x, 1, z, b.pickWeighted([['cobblestone', 5], ['mossy_cobblestone', 3], ['stone_bricks', 2]]));
    }
  }

  b.step();
  for (let x = -RING_RADIUS; x <= RING_RADIUS; x++) {
    for (let z = -RING_RADIUS; z <= RING_RADIUS; z++) {
      if (!inDisc(x, z, RING_RADIUS) || inDisc(x, z, WATER_RADIUS)) continue;
      if (POSTS.some(([px, pz]) => px === x && pz === z)) continue;
      b.slab(x, 2, z, 'stone_brick_slab', { type: 'bottom' });
    }
  }

  b.step();
  b.disc(0, -1, 0, WATER_RADIUS, WATER);
  b.disc(0, 0, 0, WATER_RADIUS, WATER);
}

function frame(b) {
  b.phase('Dachgestell');
  b.step();
  for (const [x, z] of POSTS) b.fill(x, 2, z, x, 4, z, `${spruce.log}[axis=y]`);

  b.step();
  for (const z of [-2, 2]) b.fill(-2, 5, z, 2, 5, z, `${spruce.strippedLog}[axis=x]`);
  for (const x of [-2, 2]) b.fill(x, 5, -1, x, 5, 1, `${spruce.strippedLog}[axis=z]`);

  b.step();
  for (const [px, pz] of POSTS) {
    const sx = Math.sign(px);
    const sz = Math.sign(pz);
    // Kopfband neben dem Pfosten, Richtung Brunnenmitte; die hohe Seite zeigt zurück zum Pfosten.
    b.stairs(px - sx, 4, pz, spruce.stairs, { facing: sx > 0 ? 'east' : 'west', half: 'top' });
    b.stairs(px, 4, pz - sz, spruce.stairs, { facing: sz > 0 ? 'south' : 'north', half: 'top' });
  }
}

function roof(b) {
  b.phase('Dach');
  b.roof({ x1: -2, z1: -2, x2: 2, z2: 2, y: 5, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
}

function winch(b) {
  b.phase('Seilwinde und Kurbel');
  b.step();
  b.fill(-2, 6, 0, 3, 6, 0, `${spruce.log}[axis=x]`);

  b.step();
  b.fill(0, 3, 0, 0, 5, 0, 'iron_chain[axis=y]');
  b.set(0, 2, 0, 'cauldron');
  b.set(4, 6, 0, 'lever[face=wall,facing=east,powered=false]');
  b.set(0, 4, 2, 'lantern[hanging=true]');
}

function surroundings(b) {
  b.phase('Rund um den Brunnen');
  b.step();
  lampPost(b, { x: -4, y: 1, z: 5, facing: 'east', height: 4, post: spruce.fence, base: 'mossy_cobblestone', style: 'arm' });
  b.set(4, 1, 1, 'barrel[facing=up,open=false]');
  b.set(4, 1, -1, 'water_cauldron[level=3]');

  b.step();
  path(b, { x: 0, y: 0, z: 5, facing: 'south', length: 3, width: 3, mix: 'erde', wiggle: 0.5, seed: 2 });
  bush(b, { x: -6, y: 1, z: -3, size: 'klein', leaves: 'eiche', seed: 1 });
  bush(b, { x: 5, y: 1, z: -5, size: 'klein', leaves: 'azalee', seed: 4 });
  vegetation(b, { x: -8, y: 0, z: -8, width: 17, depth: 17, mix: 'blumen', density: 0.35, seed: 5 });
  fixDirtPaths(b, { x1: -8, y1: 0, z1: -8, x2: 8, y2: 0, z2: 8 });
}

export default function build(b) {
  ground(b);
  shaft(b);
  frame(b);
  roof(b);
  winch(b);
  surroundings(b);
}
