// Eisenbahn-Viadukt: sieben Rundbögen aus Ziegeln auf hohen Pfeilern über ein Tal, oben ein Gleis mit Antriebsschienen.
// Bau-Rahmen: das Viadukt läuft entlang x (West → Ost), Mitte der Fahrbahn bei z = 0. Pfeiler bei x = 10k … 10k + 2
// (k = 0 … 7), Bögen dazwischen 7 breit. Fahrbahnplatte y = 22, Gleis y = 24 (auf dem Schotter y = 23); Talgrund y = 2.

import { hashPosition } from '../../core/random.js';
import { archProfile, lampPost, terrain, tree, bush, rock, vegetation } from '../lib/index.js';

export const meta = {
  id: 'eisenbahn-viadukt',
  title: 'Eisenbahn-Viadukt',
  category: 'infrastruktur',
  subtitle: 'Sieben Ziegelbögen auf hohen Pfeilern über ein Tal, oben ein Gleis mit Antriebsschienen im richtigen Abstand',
  tags: ['Brücke', 'Viadukt', 'Eisenbahn', 'Bahnstrecke', 'Gleis', 'Lore', 'Minecart', 'Antriebsschiene', 'Ziegel', 'Bögen', 'Tal', 'Bach', 'Hoch'],
  aliases: [
    'eisenbahnviadukt', 'eisenbahn viadukt', 'eisenbahn-viadukt', 'viadukt', 'viaduct', 'railway viaduct', 'railroad viaduct',
    'train bridge', 'railway bridge', 'eisenbahnbrücke', 'eisenbahnbruecke', 'bahnbrücke', 'bahnbruecke',
    'talbrücke', 'talbruecke', 'bogenbrücke eisenbahn', 'minecart brücke', 'lorenbrücke', 'loren bruecke', 'viadukkt', 'viaduckt',
    'ziegelbrücke', 'ziegelviadukt',
  ],
  accuracy: 'eigenes',
  description: 'Ein 73 Blöcke langes Eisenbahn-Viadukt, das mit sieben Rundbögen aus Ziegeln 20 Blöcke hoch über ein Tal mit Bach führt. Die schlanken Pfeiler stehen auf Sockeln aus Steinziegeln, Bogenringe, Kämpfer und ein Gesims aus Steinziegeln setzen helle Akzente. Oben liegt ein Gleis auf Schotter und Schwellen, gesäumt von Wartungswegen, Brüstungen und Laternen über jedem Pfeiler; drei Antriebsschienen auf Redstone-Blöcken halten eine besetzte Lore auf der ganzen Strecke auf Höchstgeschwindigkeit.',
  sources: [
    { title: 'Minecraft Wiki: Tutorial Loren (Abstand der Antriebsschienen)', url: 'https://minecraft.wiki/w/Tutorial:Minecarts' },
    { title: 'Minecraft Wiki: Antriebsschiene (Powered Rail)', url: 'https://minecraft.wiki/w/Powered_Rail' },
  ],
  credits: null,
  tested: null,
};

const DECK = 22;
const ARCH_HEIGHT = 4;
const BASE = DECK - 2 - ARCH_HEIGHT; // Kämpferhöhe: ab hier rundet sich der Bogen
const PIER_COUNT = 8;
const PERIOD = 10;
const BRIDGE = { x1: 0, x2: (PIER_COUNT - 1) * PERIOD + 2, z1: -3, z2: 3 };
const AREA = { x1: -12, x2: BRIDGE.x2 + 12, z1: -11, z2: 11 };
const VALLEY = { mid: BRIDGE.x2 / 2, half: BRIDGE.x2 / 2 + 0.5, floor: 2 };
const STREAM = { x1: 35, x2: 37 };
const BOOSTERS = [-1, 33, 67];
const SIDES = [-1, 1];
const profile = archProfile(7, ARCH_HEIGHT, 'round');

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;
const pick = (entries, x, y, z, salt) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand01(x, y, z, salt) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
};
const inward = (s) => (s > 0 ? 'north' : 'south');
const pierStarts = Array.from({ length: PIER_COUNT }, (_, k) => k * PERIOD);
const isPierX = (x) => x >= 0 && x <= BRIDGE.x2 && x % PERIOD <= 2;

// --- Gelände ---

// Talprofil: steile Hänge, flacher Grund; außerhalb der Brücke liegt das Gelände auf Höhe der Fahrbahnplatte.
function valleyGround(x) {
  if (x < BRIDGE.x1 || x > BRIDGE.x2) return DECK;
  const u = Math.abs(x - VALLEY.mid) / VALLEY.half;
  return Math.round(VALLEY.floor + (DECK - VALLEY.floor) * Math.min(1, u ** 2.4));
}

function groundHeight(x, z) {
  const base = valleyGround(x);
  if (base >= DECK || isPierX(x) || (x >= STREAM.x1 - 1 && x <= STREAM.x2 + 1)) return base;
  const bump = Math.round((rand01(Math.floor(x / 3), 0, Math.floor(z / 3), 11) - 0.5) * 2.2);
  return Math.max(VALLEY.floor, Math.min(DECK, base + bump));
}

function valley(b) {
  b.phase('Tal und Bach');
  b.step();
  const ground = terrain(b, {
    x: AREA.x1, y: 0, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1,
    heightAt: (dx, dz) => groundHeight(AREA.x1 + dx, AREA.z1 + dz), surface: 'gras', rocky: true, seed: 5,
  });
  b.step();
  for (let x = STREAM.x1; x <= STREAM.x2; x++) {
    for (let z = AREA.z1; z <= AREA.z2; z++) {
      b.set(x, VALLEY.floor - 1, z, pick([['gravel', 3], ['sand', 2], ['clay', 1]], x, 1, z, 21));
      b.set(x, VALLEY.floor, z, 'water[level=0]');
    }
  }
  return ground;
}

// --- Pfeiler ---

function pierBlock(x, y, z, p) {
  const corner = (x === p || x === p + 2) && Math.abs(z) === BRIDGE.z2;
  return corner && y % 2 === 0 ? 'stone_bricks' : 'bricks';
}

function piers(b, ground) {
  b.phase('Pfeiler');
  for (const p of pierStarts) {
    const centerGround = ground.top(p + 1, 0);
    const plinthTop = Math.min(BASE - 2, centerGround + 2);
    for (let x = p - 1; x <= p + 3; x++) {
      for (let z = BRIDGE.z1 - 1; z <= BRIDGE.z2 + 1; z++) {
        const foot = ground.top(x, z) - 1;
        const isCore = x >= p && x <= p + 2 && z >= BRIDGE.z1 && z <= BRIDGE.z2;
        const top = isCore ? BASE - 1 : plinthTop;
        for (let y = foot; y <= top; y++) {
          if (!isCore || y <= plinthTop) b.set(x, y, z, y === plinthTop && !isCore ? 'stone_brick_slab[type=bottom]' : 'stone_bricks');
          else b.set(x, y, z, pierBlock(x, y, z, p));
        }
      }
    }
  }
}

// --- Bögen ---

function archCell(x, y) {
  if (x < BRIDGE.x1 || x > BRIDGE.x2 || isPierX(x)) return 'solid';
  const p = Math.floor(x / PERIOD) * PERIOD;
  const lx = x - (p + 6);
  if (y < BASE) return 'open';
  return profile.get(lx, y - BASE);
}

function isRing(x, y) {
  if (archCell(x, y) !== 'solid') return false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1]]) {
    if (archCell(x + dx, y + dy) !== 'solid' && y + dy >= BASE) return true;
  }
  return false;
}

function bodyState(x, y, z) {
  const kind = archCell(x, y);
  if (kind === 'open') return null;
  const lx = x - (Math.floor(x / PERIOD) * PERIOD + 6);
  if (kind === 'stairs') return `stone_brick_stairs[facing=${lx < 0 ? 'west' : 'east'},half=top]`;
  if (kind === 'slab') return 'stone_brick_slab[type=top]';
  const face = Math.abs(z) === BRIDGE.z2;
  if (face && lx === 0 && y === BASE + ARCH_HEIGHT && !isPierX(x)) return 'chiseled_stone_bricks';
  if (face && (isRing(x, y) || y === DECK - 1)) return 'stone_bricks';
  return 'bricks';
}

function arches(b) {
  b.phase('Kämpfer und Bögen');
  for (const p of pierStarts) {
    for (let z = BRIDGE.z1; z <= BRIDGE.z2; z++) {
      if (p > BRIDGE.x1) b.stairs(p - 1, BASE - 1, z, 'stone_brick_stairs', { facing: 'east', half: 'top' });
      if (p + 2 < BRIDGE.x2) b.stairs(p + 3, BASE - 1, z, 'stone_brick_stairs', { facing: 'west', half: 'top' });
    }
    for (const s of SIDES) {
      for (let x = p - (p > BRIDGE.x1 ? 1 : 0); x <= p + (p + 2 < BRIDGE.x2 ? 3 : 2); x++) {
        b.stairs(x, BASE - 1, (BRIDGE.z2 + 1) * s, 'stone_brick_stairs', { facing: inward(s), half: 'top' });
      }
    }
  }
  for (let y = BASE; y <= DECK - 1; y++) {
    for (let x = BRIDGE.x1; x <= BRIDGE.x2; x++) {
      for (let z = BRIDGE.z1; z <= BRIDGE.z2; z++) {
        const state = bodyState(x, y, z);
        if (state) b.set(x, y, z, state);
      }
    }
  }
}

// --- Fahrbahn ---

function deck(b) {
  b.phase('Fahrbahnplatte und Gesims');
  b.step();
  b.fill(BRIDGE.x1, DECK, BRIDGE.z1, BRIDGE.x2, DECK, BRIDGE.z2, 'stone_bricks');
  b.step();
  for (const s of SIDES) {
    for (let x = BRIDGE.x1; x <= BRIDGE.x2; x++) b.stairs(x, DECK, (BRIDGE.z2 + 1) * s, 'stone_brick_stairs', { facing: inward(s), half: 'top' });
  }
}

function parapets(b) {
  b.phase('Wege, Brüstung und Laternen');
  b.step();
  for (const s of SIDES) b.fill(BRIDGE.x1, DECK + 1, 2 * s, BRIDGE.x2, DECK + 1, 2 * s, 'polished_andesite');
  b.step();
  for (const s of SIDES) {
    for (let x = BRIDGE.x1; x <= BRIDGE.x2; x++) {
      if (x % PERIOD === 1) continue;
      b.fill(x, DECK + 1, BRIDGE.z2 * s, x, DECK + 2, BRIDGE.z2 * s, 'bricks');
      b.slab(x, DECK + 3, BRIDGE.z2 * s, 'stone_brick_slab');
    }
  }
  b.step();
  for (const p of pierStarts) {
    for (const s of SIDES) lampPost(b, { x: p + 1, y: DECK + 1, z: BRIDGE.z2 * s, post: 'stone_brick_wall', base: 'chiseled_stone_bricks', height: 3, style: 'top' });
  }
}

function track(b) {
  b.phase('Gleis');
  b.step();
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    for (let z = -1; z <= 1; z++) b.set(x, DECK + 1, z, x % 2 === 0 ? 'stripped_spruce_log[axis=z]' : 'gravel');
  }
  b.step();
  for (const x of BOOSTERS) b.set(x, DECK + 1, 0, 'redstone_block');
  b.step();
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    b.set(x, DECK + 2, 0, BOOSTERS.includes(x) ? 'powered_rail[powered=true,shape=east_west]' : 'rail[shape=east_west]');
  }
}

// --- Umgebung ---

function surroundings(b, ground) {
  b.phase('Umgebung');
  b.step();
  const trees = [
    [-8, -6, 'fichte', 'gross', 1], [-5, 7, 'fichte', 'mittel', 2], [6, -7, 'fichte', 'mittel', 3], [17, 8, 'fichte', 'klein', 4],
    [25, -8, 'birke', 'mittel', 5], [46, 6, 'eiche', 'mittel', 6], [55, -8, 'birke', 'klein', 7], [66, 7, 'fichte', 'mittel', 8],
    [79, -6, 'fichte', 'gross', 9], [80, 7, 'fichte', 'mittel', 10],
  ];
  for (const [x, z, species, size, seed] of trees) tree(b, { x, y: ground.top(x, z) + 1, z, species, size, seed });
  b.step();
  for (const [x, z, seed] of [[33, 7, 1], [40, -7, 2], [28, 6, 3], [47, -5, 4]]) bush(b, { x, y: ground.top(x, z) + 1, z, size: 'klein', leaves: 'eiche', seed });
  for (const [x, z, size, material, seed] of [[14, -6, 'mittel', 'andesit', 1], [58, 7, 'klein', 'stein', 2], [38, 8, 'klein', 'stein', 3]]) {
    rock(b, { x, y: ground.top(x, z) + 1, z, size, material, seed });
  }
  b.step();
  vegetation(b, { x: AREA.x1, y: DECK + 1, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1, mix: 'wiese', density: 0.3, shape: 'eckig', scan: 24, seed: 7 });
}

export default function build(b) {
  const ground = valley(b);
  piers(b, ground);
  arches(b);
  deck(b);
  parapets(b);
  track(b);
  surroundings(b, ground);
}
