// Stadtmauer mit Wehrgang: ein Modul aus Mauerturm (7 × 7) und Mauerstück (19 lang) plus ein Anschlussstück im Westen.
// Koordinaten: Mauer läuft entlang x; Stadtseite = Norden (−z), Feldseite = Süden (+z). Gelände-Oberkante y = 0.
// Mauerkörper z −2 … 1 (4 dick), Wehrgang-Boden y = 9. Turm x −3 … 3, z −2 … 4.

import {
  STONE, WOOD, COLOR, arch, arrowSlit, battlements, doorway, window, straightStairs, lampPost, hangingLantern, wallLantern, storage,
  workshop, lightRoom, terrain, floorPattern, pathAlong, bush, rock, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'stadtmauer',
  title: 'Stadtmauer mit Wehrgang',
  category: 'mittelalter',
  subtitle: 'Verlängerbarer Mauerabschnitt mit Turm, Treppe und Zinnen',
  tags: ['Mauer', 'Stadtmauer', 'Wehrgang', 'Zinnen', 'Mittelalter', 'Burg', 'Turm', 'Schießscharten', 'Modular', 'Steinziegel'],
  aliases: [
    'stadtmauer', 'stadt mauer', 'burgmauer', 'mauer', 'city wall', 'town wall', 'castle wall', 'wall', 'wehrgang',
    'wehrmauer', 'ringmauer', 'mauer mit turm', 'mauerturm', 'stadmauer', 'stadtmaurer', 'befestigung', 'fortification',
  ],
  accuracy: 'eigenes',
  description: 'Ein Abschnitt einer mittelalterlichen Stadtmauer, den du beliebig verlängern kannst: Mauerturm mit drei '
    + 'Stockwerken und Zinnenkranz, 19 Blöcke Mauer mit Wehrgang, Zinnen und Stützpfeilern auf der Feldseite. Auf der '
    + 'Stadtseite gliedern Bogennischen mit Schießscharten die Mauer, eine breite Steintreppe führt zum Wehrgang hinauf.',
  sources: [],
  credits: null,
  tested: null,
};

const stone = STONE.steinziegel;
const spruce = WOOD.fichte;

const TOWN = -2; // Stadtseite der Mauer
const FIELD = 1; // Feldseite der Mauer
const TOP = 9; // Wehrgang-Boden
const SECTIONS = [[-10, -4], [4, 22]]; // Anschlussstück West, Mauerstück Ost
const NICHES = [-7, 7, 19]; // Mitten der Bogennischen (Stadtseite)
const BUTTRESSES = [-10, 10, 16, 22]; // Stützpfeiler (Feldseite) an den Nischenpfeilern
const STAIR_X = 13; // Treppe zum Wehrgang (Mitte)
const TOWER = { x1: -3, x2: 3, z1: -2, z2: 4, top: 14 };
const TOWER_FLOORS = [5, 9]; // Zwischendecke und Wehrgang-Ebene im Turm
const LADDER = [-2, 3];

function wallStone(b, y) {
  if (y <= 3) return b.pickWeighted([[stone.block, 5], [stone.mossy, 3], [stone.rough, 2], ['mossy_cobblestone', 1]]);
  return b.pickWeighted([[stone.block, 9], [stone.mossy, 2], [stone.cracked, 2]]);
}

// Ersetzt in einem Bereich einen Teil der Steinziegel durch bemooste/rissige (Alterung).
function weather(b, x1, y1, z1, x2, y2, z2, share = 0.25) {
  for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) weatherCell(b, x, y, z, share);
}

function weatherCell(b, x, y, z, share) {
  const state = b.get(x, y, z);
  if (state === stone.block && b.chance(share)) b.set(x, y, z, b.chance(0.6) ? stone.mossy : stone.cracked);
  else if (state.startsWith(`${stone.stairs}[`) && b.chance(share * 0.6)) b.set(x, y, z, state.replace(stone.stairs, stone.mossyStairs));
}

// Wie weather, aber nur für Blöcke, die draw() neu setzt: ältere Blöcke (z. B. die fertige Mauer) behalten ihr Kapitel
// und fehlen in der Anleitung nicht bis zu diesem Schritt.
function weatherNew(b, [x1, y1, z1, x2, y2, z2], share, draw) {
  const before = new Map();
  const each = (fn) => {
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) fn(x, y, z);
  };
  each((x, y, z) => before.set(`${x},${y},${z}`, b.get(x, y, z)));
  draw();
  each((x, y, z) => {
    if (b.get(x, y, z) !== before.get(`${x},${y},${z}`)) weatherCell(b, x, y, z, share);
  });
}

function ground(b) {
  b.phase('Gelände und Fundament');
  terrain(b, { x: -16, y: -2, z: -16, width: 41, depth: 28, height: 2, surface: 'gras', seed: 'stadtmauer' });
  for (const [x1, x2] of SECTIONS) b.fill(x1, 0, TOWN, x2, 0, FIELD, stone.rough);
  b.fill(TOWER.x1, 0, TOWER.z1, TOWER.x2, 0, TOWER.z2, stone.rough);
  floorPattern(b, {
    x: -16, y: 0, z: -14, width: 41, depth: 3, pattern: 'random',
    blocks: [[stone.rough, 4], ['stone', 2], ['andesite', 2], [stone.mossy, 1], ['gravel', 1]],
  });
  pathAlong(b, { y: 0, points: [[0, -11], [0, -3]], width: 3, mix: 'kies', wiggle: 0, seed: 'stadtmauer' });
}

function wallBody(b) {
  b.phase('Mauer bis zum Wehrgang');
  for (const [x1, x2] of SECTIONS) {
    for (let y = 1; y <= TOP; y++) for (let z = TOWN; z <= FIELD; z++) for (let x = x1; x <= x2; x++) b.set(x, y, z, wallStone(b, y));
  }
}

function buttresses(b) {
  b.phase('Stützpfeiler und Sockel');
  for (const x of BUTTRESSES) {
    for (let y = 1; y <= 5; y++) for (const z of [FIELD + 1, FIELD + 2]) b.set(x, y, z, wallStone(b, y));
    b.stairs(x, 6, FIELD + 2, stone.stairs, { facing: 'north' });
    for (let y = 6; y <= 8; y++) b.set(x, y, FIELD + 1, wallStone(b, y));
  }
  for (const [x1, x2] of SECTIONS) {
    for (let x = x1; x <= x2; x++) if (!BUTTRESSES.includes(x)) b.stairs(x, 1, FIELD + 1, 'cobblestone_stairs', { facing: 'north' });
  }
}

function tower(b) {
  const { x1, x2, z1, z2, top } = TOWER;
  b.phase('Mauerturm');
  for (let y = 1; y <= top; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        const shell = x === x1 || x === x2 || z === z1 || z === z2;
        if (shell || y === top) b.set(x, y, z, y === top && !shell ? stone.block : wallStone(b, y));
      }
    }
    if (TOWER_FLOORS.includes(y)) {
      for (let x = x1 + 1; x < x2; x++) for (let z = z1 + 1; z < z2; z++) b.set(x, y, z, spruce.planks);
      b.remove(LADDER[0], y, LADDER[1]);
    }
  }
  for (let x = x1 + 1; x < x2; x++) for (let z = z1 + 1; z < z2; z++) b.set(x, 0, z, b.pickWeighted([[stone.block, 3], [stone.rough, 1], ['andesite', 1]]));
  // Sockel aus Bruchsteintreppen um den vorspringenden Teil (Feldseite).
  for (let x = x1 - 1; x <= x2 + 1; x++) b.stairs(x, 1, z2 + 1, 'cobblestone_stairs', { facing: 'north' });
  for (let z = FIELD + 2; z <= z2; z++) {
    b.stairs(x1 - 1, 1, z, 'cobblestone_stairs', { facing: 'east' });
    b.stairs(x2 + 1, 1, z, 'cobblestone_stairs', { facing: 'west' });
  }
}

function walkway(b) {
  b.phase('Wehrgang und Zinnen');
  for (const [x1, x2] of SECTIONS) {
    battlements(b, { x: x1, y: TOP + 1, z: FIELD, facing: 'south', length: x2 - x1 + 1, block: stone.block, cap: stone.slab, corbels: stone.stairs });
    for (let x = x1; x <= x2; x++) {
      if (Math.abs(x - STAIR_X) <= 1) continue;
      b.set(x, TOP + 1, TOWN, spruce.fence);
      if ((x - x1) % 6 === 3) b.set(x, TOP + 2, TOWN, 'lantern[hanging=false]');
    }
    weather(b, x1, TOP, FIELD + 1, x2, TOP + 3, FIELD + 1, 0.3);
  }
  const { x1, x2, z1, z2, top } = TOWER;
  const sides = [
    { x: x1 - 1, z: z2, facing: 'south', length: x2 - x1 + 3 },
    { x: x2, z: z2 + 1, facing: 'east', length: z2 - z1 + 3 },
    { x: x2 + 1, z: z1, facing: 'north', length: x2 - x1 + 3 },
    { x: x1, z: z1 - 1, facing: 'west', length: z2 - z1 + 3 },
  ];
  weatherNew(b, [x1 - 1, top, z1 - 1, x2 + 1, top + 3, z2 + 1], 0.3, () => {
    for (const s of sides) battlements(b, { x: s.x, y: top + 1, z: s.z, facing: s.facing, length: s.length, block: stone.block, corbels: stone.stairs, cap: stone.slab });
  });
  b.fill(0, top + 1, 1, 0, top + 4, 1, spruce.fence);
  b.set(0, top + 5, 1, `${COLOR.blau.banner}[rotation=0]`);
  b.set(LADDER[0], top, LADDER[1], `${spruce.trapdoor}[facing=north,half=top,open=false]`);
}

function stairsUp(b) {
  b.phase('Treppe zum Wehrgang');
  straightStairs(b, { x: STAIR_X, y: 1, z: TOWN - 9, facing: 'south', width: 3, height: 9, stairs: stone.stairs, support: stone.block, railing: stone.wall });
}

function openings(b) {
  b.phase('Nischen, Türen und Schießscharten');
  // Nur die neuen Bogensteine altern; die Mauer selbst ist schon gemischt gemauert und bleibt in ihrem Kapitel.
  weatherNew(b, [-16, 1, TOWN - 1, 24, 8, TOWN + 1], 0.15, () => {
    for (const x of NICHES) {
      arch(b, { x, y: 1, z: TOWN, facing: 'north', width: 5, height: 5, style: 'round', depth: 2, block: stone.block, stairs: stone.stairs });
      arrowSlit(b, { x, y: 2, z: FIELD, facing: 'south', height: 3, style: 'cross', depth: 2 });
      hangingLantern(b, { x, y: 5, z: TOWN + 1, chain: 1 });
    }
  });
  const { x1, x2, z1, z2 } = TOWER;
  doorway(b, { x: 0, y: 1, z: z1, facing: 'north', door: spruce.door, frame: null });
  b.set(0, 3, z1, stone.chiseled);
  for (const x of [-1, 1]) wallLantern(b, { x, y: 2, z: z1, facing: 'north', style: 'bracket', arm: spruce.fence });
  arch(b, { x: x1, y: TOP + 1, z: -1, facing: 'west', width: 2, height: 3, block: stone.block, stairs: stone.stairs });
  arch(b, { x: x2, y: TOP + 1, z: 0, facing: 'east', width: 2, height: 3, block: stone.block, stairs: stone.stairs });
  arrowSlit(b, { x: 0, y: 2, z: z2, facing: 'south', height: 3 });
  arrowSlit(b, { x: 0, y: 6, z: z2, facing: 'south', height: 3, style: 'cross' });
  arrowSlit(b, { x: 0, y: TOP + 1, z: z2, facing: 'south', height: 3, style: 'cross' });
  for (const [x, facing] of [[x1, 'west'], [x2, 'east']]) {
    arrowSlit(b, { x, y: 2, z: 3, facing, height: 3 });
    arrowSlit(b, { x, y: 6, z: 3, facing, height: 2 });
    arrowSlit(b, { x, y: TOP + 1, z: 3, facing, height: 3 });
  }
  window(b, { x: 0, y: 6, z: z1, facing: 'north', width: 1, height: 2, glass: 'glass_pane', sill: stone.stairs });
  window(b, { x: 0, y: TOP + 1, z: z1, facing: 'north', width: 1, height: 2, glass: 'glass_pane', sill: stone.stairs });
}

function interior(b) {
  const { x1, x2, z1, z2 } = TOWER;
  b.phase('Turm einrichten');
  b.step();
  for (let y = 1; y < TOWER.top; y++) b.set(LADDER[0], y, LADDER[1], 'ladder[facing=north]');

  b.step();
  storage(b, { x: x2 - 1, y: 1, z: z1 + 1, facing: 'west', width: 4, height: 2 });
  b.set(x1 + 2, 1, z2 - 1, 'hay_block[axis=y]');
  b.set(x1 + 2, 2, z2 - 1, 'hay_block[axis=x]');
  b.set(x1 + 3, 1, z2 - 1, 'barrel[facing=up]');
  hangingLantern(b, { x: 0, y: 4, z: 1, chain: 1 });
  lightRoom(b, { x1: x1 + 1, y1: 1, z1: z1 + 1, x2: x2 - 1, y2: 4, z2: z2 - 1 });

  b.step();
  workshop(b, { x: x2 - 1, y: 6, z: z1 + 1, facing: 'west', width: 3, wood: 'fichte', shelves: false });
  b.set(x2 - 1, 6, z2 - 1, 'barrel[facing=up]');
  b.set(x2 - 2, 6, z2 - 1, 'chest[facing=north,type=single]');
  b.set(x1 + 1, 6, z1 + 1, 'grindstone[face=floor,facing=north]');
  b.set(x1 + 1, 6, z1 + 2, 'barrel[facing=east]');
  hangingLantern(b, { x: 0, y: 8, z: 1, chain: 0 });
  lightRoom(b, { x1: x1 + 1, y1: 6, z1: z1 + 1, x2: x2 - 1, y2: 8, z2: z2 - 1 });

  b.step();
  b.set(x2 - 1, TOP + 1, z2 - 1, spruce.fence);
  b.set(x2 - 1, TOP + 2, z2 - 1, spruce.pressurePlate);
  b.stairs(x2 - 1, TOP + 1, z2 - 2, spruce.stairs, { facing: 'north' });
  b.stairs(x2 - 2, TOP + 1, z2 - 1, spruce.stairs, { facing: 'west' });
  b.set(0, TOP + 1, z2 - 1, 'barrel[facing=up]');
  b.set(0, TOP + 2, z2 - 1, 'lantern[hanging=false]');
  for (let x = x1 + 1; x < x2; x++) for (const z of [-1, 0]) b.set(x, TOP + 1, z, COLOR.rot.carpet);
  lightRoom(b, { x1: x1 + 1, y1: TOP + 1, z1: z1 + 1, x2: x2 - 1, y2: TOP + 4, z2: z2 - 1 });
}

function surroundings(b) {
  b.phase('Umgebung');
  for (const x of [-9, 5, 21]) lampPost(b, { x, y: 1, z: -11, facing: 'east', height: 3, style: 'double', post: stone.wall, base: stone.chiseled });
  b.set(-3, 1, -3, 'barrel[facing=up]');
  b.set(-2, 1, -3, 'barrel[facing=north]');
  b.set(3, 1, -3, 'hay_block[axis=y]');
  b.set(3, 2, -3, 'hay_block[axis=x]');
  b.set(4, 1, -3, 'hay_block[axis=z]');
  bush(b, { x: -13, y: 1, z: 7, size: 'mittel', leaves: 'eiche', seed: 1 });
  bush(b, { x: 8, y: 1, z: 6, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: 18, y: 1, z: -7, size: 'klein', leaves: 'birke', seed: 3 });
  rock(b, { x: 13, y: 1, z: 8, size: 'mittel', material: 'stein', seed: 4 });
  rock(b, { x: -5, y: 1, z: 9, size: 'klein', material: 'andesit', seed: 5 });
  vegetation(b, { x: -16, y: 3, z: 2, width: 41, depth: 10, mix: 'wiese', density: 0.35, shape: 'eckig', seed: 'feld' });
  vegetation(b, { x: -16, y: 3, z: -11, width: 41, depth: 8, mix: 'blumen', density: 0.15, shape: 'eckig', seed: 'stadt' });
}

export default function build(b) {
  ground(b);
  wallBody(b);
  buttresses(b);
  tower(b);
  walkway(b);
  stairsUp(b);
  openings(b);
  interior(b);
  surroundings(b);
}
