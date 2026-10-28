// Monsterfarm (Dunkel-Turm): drei stockdunkle Spawn-Etagen hoch über einer Plattform am Himmel.
// Je Etage vier Wasserkanäle (2 breit, 8 lang, eine Stufe tiefer als die Spawnflächen), die alle
// Monster zum Fallschacht in der Mitte schwemmen. Der Sturz von rund 30 Blöcken tötet sie, Lagerfeuer
// erledigen den Rest, Trichter sammeln die Beute in zwei Truhen. Der AFK-Platz liegt unten an den Truhen.
// Lokale Koordinaten: Plattform y = 0 (Welt Y 200), Etagen-Spawnflächen y = 32 / 36 / 40,
// Innenraum je Etage x 0…17, z 0…17, Schacht x 8…9, z 8…9. Vorderseite = Süden (Truhen).

import { lampPost, wallLantern } from '../lib/index.js';

export const meta = {
  id: 'monsterfarm-turm',
  title: 'Monsterfarm (Dunkel-Turm)',
  category: 'farmen',
  subtitle: 'Drei dunkle Spawn-Etagen, Wasserkanäle und 30 Blöcke Fallschacht',
  tags: ['Farm', 'Monster', 'Mobfarm', 'Dunkelraum', 'Zombie', 'Skelett', 'Creeper', 'Knochen', 'Schwarzpulver', 'Pfeile', 'Fallschacht', 'Wasserkanäle', 'Trichter', 'Groß'],
  aliases: [
    'monsterfarm', 'monster farm', 'monsterturm', 'mobfarm', 'mob farm', 'mob turm', 'mobturm', 'mob tower', 'mob grinder',
    'dark room farm', 'darkroom', 'dunkelraum farm', 'dunkler turm', 'dunkel-turm', 'spawn turm', 'spawner lose farm',
    'spawnerless mob farm', 'general mob farm', 'xp farm', 'erfahrungsfarm', 'knochenfarm', 'schwarzpulverfarm',
    'gunpowder farm', 'bone farm', 'monstafarm', 'monsterfram',
  ],
  accuracy: 'vorlage',
  description: 'Ein dunkler Turm aus Tiefenschiefer hoch am Himmel: Auf drei stockfinsteren Etagen spawnen Zombies, Skelette, Creeper, Spinnen und Hexen. Sie laufen von den Spawnflächen in vier Wasserkanäle, die sie zu einem 2 × 2 großen Fallschacht in der Mitte schwemmen. Nach rund 30 Blöcken Sturz landen sie auf Lagerfeuern über vier Trichtern – Knochen, Pfeile, Schwarzpulver, Fäden und Verrottetes Fleisch landen in einer Doppeltruhe. Du wartest unten am AFK-Platz, genau so weit weg, dass die Monster oben spawnen dürfen und nicht verschwinden.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Mob-Farm (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Mob_farm' },
    { title: 'Minecraft Wiki: Spawn (englisch)', url: 'https://minecraft.wiki/w/Mob_spawning' },
    { title: 'Minecraft Wiki: Fallschaden (englisch)', url: 'https://minecraft.wiki/w/Damage#Fall_damage' },
  ],
  credits: null,
  tested: false,
};

const SIZE = 18;
const SHAFT = [8, 9];
const FLOORS = [32, 36, 40];
const ROOF_Y = 43;
const BASE = { x1: 2, x2: 15, z1: 2, z2: 15 };
const LADDER = { x: 7, z: 6 };
const WALL = 'deepslate_bricks';
const TILE = 'deepslate_tiles';
const PILLAR = 'polished_deepslate';
const FILL = 'cobbled_deepslate';
const WATER = 'water[level=0]';

const inShaftRange = (v) => SHAFT.includes(v);
const isShaft = (x, z) => inShaftRange(x) && inShaftRange(z);
const isTrench = (x, z) => !isShaft(x, z) && (inShaftRange(x) || inShaftRange(z));
// Wasserstand im Kanal: Quelle an der Außenwand, danach Fließstufe 1…7 bis zum Schachtrand.
function trenchWater(x, z) {
  const distance = inShaftRange(x) ? Math.min(z, SIZE - 1 - z) : Math.min(x, SIZE - 1 - x);
  return distance === 0 ? WATER : `water[level=${distance}]`;
}
const isLadderHole = (x, z) => x === LADDER.x && z === LADDER.z;

// Außenwand der Etagen: Ecken und Lisenen aus poliertem Tiefenschiefer, Bänder aus Fliesen an den Decken.
function outerWallBlock(x, y, z) {
  const edgeX = x === -1 || x === SIZE;
  const edgeZ = z === -1 || z === SIZE;
  if (edgeX && edgeZ) return PILLAR;
  const along = edgeX ? z : x;
  if (along === 4 || along === 13) return PILLAR;
  if (y === FLOORS[0] - 1 || FLOORS.includes(y + 1) || y === ROOF_Y) return TILE;
  return (x * 7 + y * 13 + z * 5) % 9 === 0 ? 'cracked_deepslate_bricks' : WALL;
}

// Lage entlang der Außenkante (für Lisenen, Strebepfeiler und Zinnen).
function alongEdge(x, z, low, high) {
  return x === low || x === high ? z : x;
}

const isButtressSpot = (along) => along === 4 || along === 13;

// Ring um den Schacht (x 7…10, z 7…10 ohne die Mitte).
function isShaftRing(x, z) {
  return x >= 7 && x <= 10 && z >= 7 && z <= 10 && !isShaft(x, z);
}

function platform(b) {
  b.phase('Plattform am Himmel');
  b.step();
  for (let x = BASE.x1; x <= BASE.x2; x++) {
    for (let z = BASE.z1; z <= BASE.z2; z++) {
      const edge = x === BASE.x1 || x === BASE.x2 || z === BASE.z1 || z === BASE.z2;
      if (x === 3 && z === 13) continue;
      b.set(x, 0, z, edge ? PILLAR : TILE);
    }
  }
  b.step();
  for (let y = -4; y <= -1; y++) b.set(3, y, 14, FILL);
  b.set(3, 0, 14, PILLAR);
  for (let y = -4; y <= 0; y++) b.set(3, y, 13, 'ladder[facing=north]');
}

function killChamber(b) {
  b.phase('Truhen und Lagerfeuer');
  b.step();
  for (const x of SHAFT) b.set(x, 1, 10, 'chest[facing=south]');

  b.step();
  for (const x of SHAFT) {
    b.set(x, 1, 8, 'hopper[facing=south]');
    b.set(x, 1, 9, 'hopper[facing=south]');
  }

  b.step();
  for (const x of SHAFT) for (const z of SHAFT) b.set(x, 2, z, 'campfire[facing=south,lit=true]');

  b.step();
  for (let y = 1; y <= 2; y++) {
    for (let x = 7; x <= 10; x++) {
      for (let z = 7; z <= 10; z++) {
        if (!isShaftRing(x, z)) continue;
        if (z === 10 && inShaftRange(x)) {
          if (y === 2) b.set(x, y, z, 'tinted_glass');
          continue;
        }
        b.set(x, y, z, (x === 7 || x === 10) && (z === 7 || z === 10) ? PILLAR : WALL);
      }
    }
  }
}

function shaft(b) {
  const top = FLOORS[0] - 2;
  b.phase('Fallschacht');
  b.step();
  for (let y = 3; y <= top; y++) {
    for (let x = 7; x <= 10; x++) {
      for (let z = 7; z <= 10; z++) {
        if (!isShaftRing(x, z)) continue;
        const corner = (x === 7 || x === 10) && (z === 7 || z === 10);
        const window = z === 10 && inShaftRange(x) && ((y >= 9 && y <= 11) || (y >= 19 && y <= 21));
        b.set(x, y, z, corner ? PILLAR : window ? 'tinted_glass' : WALL);
      }
    }
  }
  b.step();
  for (let y = 1; y <= FLOORS[0]; y++) b.set(LADDER.x, y, LADDER.z, 'ladder[facing=north]');
}

function corbels(b) {
  const y = FLOORS[0] - 2;
  b.step();
  for (let x = -2; x <= SIZE + 1; x++) {
    for (let z = -2; z <= SIZE + 1; z++) {
      const ring = x === -2 || x === SIZE + 1 || z === -2 || z === SIZE + 1;
      if (!ring) continue;
      let facing = 'north';
      if (z === -2) facing = 'south';
      else if (x === -2) facing = 'east';
      else if (x === SIZE + 1) facing = 'west';
      b.stairs(x, y, z, 'deepslate_brick_stairs', { facing, half: 'top' });
      const corner = (x === -2 || x === SIZE + 1) && (z === -2 || z === SIZE + 1);
      if (corner || !isButtressSpot(alongEdge(x, z, -2, SIZE + 1))) b.slab(x, y + 1, z, 'deepslate_brick_slab', { type: 'bottom' });
    }
  }
}

function spawnFloor(b, index) {
  const y = FLOORS[index];
  const n = index + 1;
  const first = index === 0;
  b.phase(`Etage ${n}`);
  b.step();
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      if (isShaft(x, z) || (first && isLadderHole(x, z))) continue;
      b.set(x, y - 1, z, FILL);
    }
  }
  b.step();
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      if (isShaft(x, z) || isTrench(x, z)) continue;
      if (first && isLadderHole(x, z)) continue;
      b.set(x, y, z, FILL);
    }
  }
  if (first) {
    b.set(LADDER.x, y + 1, LADDER.z, 'spruce_trapdoor[facing=south,half=bottom,open=false]');
  }
  b.step();
  for (let wy = y - 1; wy <= y + 2; wy++) {
    for (let x = -1; x <= SIZE; x++) {
      for (let z = -1; z <= SIZE; z++) {
        const edge = x === -1 || x === SIZE || z === -1 || z === SIZE;
        if (edge) b.set(x, wy, z, outerWallBlock(x, wy, z));
      }
    }
  }
  b.step();
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) if (isTrench(x, z)) b.set(x, y, z, trenchWater(x, z));
  }
}

function roof(b) {
  b.phase('Dach');
  b.step();
  for (let x = -2; x <= SIZE + 1; x++) {
    for (let z = -2; z <= SIZE + 1; z++) {
      const ring = x === -2 || x === SIZE + 1 || z === -2 || z === SIZE + 1;
      const corner = (x === -2 || x === SIZE + 1) && (z === -2 || z === SIZE + 1);
      if (!ring || corner || !isButtressSpot(alongEdge(x, z, -2, SIZE + 1))) continue;
      for (let y = FLOORS[0] - 1; y <= ROOF_Y; y++) b.set(x, y, z, PILLAR);
      b.slab(x, ROOF_Y + 1, z, 'deepslate_brick_slab', { type: 'bottom' });
    }
  }
  b.step();
  for (let x = -1; x <= SIZE; x++) {
    for (let z = -1; z <= SIZE; z++) {
      const edge = x === -1 || x === SIZE || z === -1 || z === SIZE;
      b.set(x, ROOF_Y, z, edge ? outerWallBlock(x, ROOF_Y, z) : FILL);
    }
  }
  b.step();
  for (let x = -1; x <= SIZE; x++) {
    for (let z = -1; z <= SIZE; z++) {
      const edgeX = x === -1 || x === SIZE;
      const edgeZ = z === -1 || z === SIZE;
      if (edgeX && edgeZ) {
        b.set(x, ROOF_Y + 1, z, PILLAR);
        b.set(x, ROOF_Y + 2, z, 'chiseled_deepslate');
        b.set(x, ROOF_Y + 3, z, 'soul_lantern[hanging=false]');
      } else if ((edgeX || edgeZ) && alongEdge(x, z, -1, SIZE) % 3 === 1) {
        b.set(x, ROOF_Y + 1, z, PILLAR);
        b.slab(x, ROOF_Y + 2, z, 'deepslate_brick_slab', { type: 'bottom' });
      } else if (edgeX || edgeZ) {
        b.set(x, ROOF_Y + 1, z, 'deepslate_brick_wall');
      } else {
        b.slab(x, ROOF_Y + 1, z, 'deepslate_brick_slab', { type: 'bottom' });
      }
    }
  }
}

function lights(b) {
  b.phase('Licht auf der Plattform');
  b.step();
  for (const [x, z] of [[BASE.x1 + 1, BASE.z1 + 1], [BASE.x2 - 1, BASE.z1 + 1], [BASE.x1 + 1, BASE.z2 - 1], [BASE.x2 - 1, BASE.z2 - 1]]) {
    lampPost(b, { x, y: 1, z, height: 2, post: 'deepslate_tile_wall', base: PILLAR });
  }
  wallLantern(b, { x: 7, y: 2, z: 10, facing: 'south', style: 'bracket', arm: 'deepslate_tile_wall' });
  wallLantern(b, { x: 10, y: 2, z: 10, facing: 'south', style: 'bracket', arm: 'deepslate_tile_wall' });

  b.step();
  for (const x of SHAFT) b.stairs(x, 1, 13, 'deepslate_tile_stairs', { facing: 'south', half: 'bottom' });

  b.step();
  for (let x = BASE.x1; x <= BASE.x2; x++) {
    for (let z = BASE.z1; z <= BASE.z2; z++) {
      const edge = x === BASE.x1 || x === BASE.x2 || z === BASE.z1 || z === BASE.z2;
      if (!edge || b.get(x, 1, z) !== 'air') continue;
      b.set(x, 1, z, 'deepslate_tile_wall');
    }
  }
}

export default function build(b) {
  platform(b);
  killChamber(b);
  shaft(b);
  corbels(b);
  FLOORS.forEach((_, i) => spawnFloor(b, i));
  roof(b);
  lights(b);
}
