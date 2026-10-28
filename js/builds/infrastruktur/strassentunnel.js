// Straßentunnel: gemauertes Gewölbe durch einen Hügel, Portale aus Tuffsteinziegeln, Straße aus Andesit und Stein mit Gehwegen.
// Bau-Rahmen: die Straße läuft entlang z, Mitte bei x = 0. Röhre von z = 0 (Nordportal) bis z = 22 (Südportal, Ansicht von vorne).
// Gelände y = 0 … 1 (Gras auf y = 1), Fahrbahn auf y = 1 (man geht auf y = 2), Gewölbescheitel innen y = 7.

import { hashPosition } from '../../core/random.js';
import { archProfile, hangingLantern, wallLantern, lampPost, terrain, tree, bush, rock, vegetation } from '../lib/index.js';

export const meta = {
  id: 'strassentunnel',
  title: 'Straßentunnel',
  category: 'infrastruktur',
  subtitle: 'Gemauerter Tunnel durch einen Hügel – mit Portalen, Gewölbe, Laternen, Gehwegen und Straße aus Andesit',
  tags: ['Tunnel', 'Straßentunnel', 'Straße', 'Gewölbe', 'Portal', 'Hügel', 'Gehweg', 'Andesit', 'Tuffstein', 'Laternen', 'Verkehr', 'Berg'],
  aliases: [
    'straßentunnel', 'strassentunnel', 'strasentunnel', 'strassen tunnel', 'straßen tunnel', 'tunnel', 'tunell', 'tunnell',
    'autotunnel', 'bergtunnel', 'hügeltunnel', 'huegeltunnel', 'tunnelportal', 'gewölbetunnel', 'road tunnel', 'tunnel entrance',
    'mountain tunnel', 'highway tunnel', 'stone tunnel', 'hill tunnel',
  ],
  accuracy: 'eigenes',
  description: 'Eine Straße führt durch einen 23 Blöcke langen Tunnel unter einem grünen Hügel hindurch. Die Röhre ist ein Rundgewölbe aus Steinziegeln mit Gehwegen auf beiden Seiten, Fluchtnischen und Laternen im Scheitel. Beide Portale bekommen eine Stirnwand aus Tuffsteinziegeln mit Pilastern, Schlussstein, Gesims und Brüstung; davor fängt der Einschnitt die Hänge mit gestuften Stützmauern ab. Straßenlaternen, Bäume und Wiese auf dem Hügel runden das Bild ab.',
  sources: [],
  credits: null,
  tested: null,
};

const ROAD = 1;
const T = 22;
const VAULT = { width: 9, height: 6 };
const CUT = 7; // halbe Breite des Einschnitts: Stützmauern bei x = ±7
const AREA = { x1: -24, x2: 24, z1: -10, z2: T + 14 };
const FACE_TOP = ROAD + 10;
const LANTERNS_Z = [2, 8, 14, 20];
const NICHES_Z = [5, 17];
const SIDES = [-1, 1];
const profile = archProfile(VAULT.width, VAULT.height, 'round');
const WALL = 'tuff_bricks';

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
const outerSide = (lx) => (lx < 0 ? 'west' : 'east');

// --- Querschnitt der Röhre ---

// Art der Zelle im Querschnitt (lx = x, ly = y − ROAD − 1): 'open', 'stairs', 'slab', 'ring' (Mauerwerk) oder 'rock'.
function vaultCell(lx, ly) {
  const kind = ly < 0 ? 'solid' : profile.get(lx, ly);
  if (kind !== 'solid') return kind;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const n = ly + dy < 0 ? 'solid' : profile.get(lx + dx, ly + dy);
      if (n !== 'solid' && Math.abs(lx) <= 5) return 'ring';
    }
  }
  return 'rock';
}

const ringTop = new Map();
for (let lx = -5; lx <= 5; lx++) {
  let top = 0;
  for (let ly = 0; ly <= VAULT.height + 1; ly++) if (vaultCell(lx, ly) === 'ring') top = ly;
  ringTop.set(lx, top);
}
const inTube = (x, z) => Math.abs(x) <= 5 && z >= 0 && z <= T;

// --- Gelände ---

function smoothNoise(x, z, cell, salt) {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const fx = x / cell - gx;
  const fz = z / cell - gz;
  const s = (t) => t * t * (3 - 2 * t);
  const v = (i, k) => rand01(gx + i, 0, gz + k, salt);
  const a = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
  const c = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
  return a + (c - a) * s(fz);
}

// Höhe der Geländeoberkante: Hügelkamm über der Röhre, steile Hänge vor den Portalen, Einschnitt für die Straße.
function hillTop(x, z) {
  const inside = z >= 0 && z <= T;
  if (!inside && Math.abs(x) <= CUT) return ROAD;
  // Flanken: erst flach, dann steiler (Viertelkreis-Profil statt gleichmäßiger Ringe), dazu großflächiges Rauschen.
  const d = Math.max(0, Math.abs(x) - 10);
  const side = 9 * (1 - Math.cos(Math.min(1, d / 14) * Math.PI / 2)) + d * 0.15;
  const roll = (smoothNoise(x, z, 7, 14) - 0.5) * 3.2 + (smoothNoise(x, z, 3, 15) - 0.5) * 1.2;
  if (inside) {
    const t = Math.min(1, Math.max(0, (z - 2) / (T - 4)));
    const crest = FACE_TOP + 4 * Math.sin(Math.PI * t);
    const near = Math.abs(x) <= CUT + 2 && (z <= 2 || z >= T - 2);
    const top = Math.round(crest - side + (near ? 0 : roll));
    // Über der Röhre nie tiefer als die Stirnwand, damit das Gewölbe überall bedeckt ist.
    return Math.max(ROAD, Math.abs(x) <= CUT + 2 ? Math.max(FACE_TOP, top) : top);
  }
  const dist = z < 0 ? -z : z - T;
  const slope = dist * 1.2 + Math.max(0, dist - 4) * 0.5;
  return Math.max(ROAD, Math.round(FACE_TOP - slope - side + roll * Math.min(1, dist / 3)));
}

function hill(b) {
  b.phase('Hügel und Einschnitte');
  const ground = terrain(b, {
    x: AREA.x1, y: 0, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1,
    heightAt: (dx, dz) => {
      const x = AREA.x1 + dx;
      const z = AREA.z1 + dz;
      return inTube(x, z) ? -1 : hillTop(x, z);
    },
    surface: 'gras', rocky: true, seed: 3,
  });
  return ground;
}

// --- Röhre ---

function tubeState(lx, ly, z) {
  const kind = vaultCell(lx, ly);
  if (kind === 'stairs') return `stone_brick_stairs[facing=${outerSide(lx)},half=top]`;
  if (kind === 'slab') return 'stone_brick_slab[type=top]';
  if (kind !== 'ring') return null;
  const nearPortal = z <= 1 || z >= T - 1;
  return pick(nearPortal
    ? [['stone_bricks', 6], ['mossy_stone_bricks', 3], ['cracked_stone_bricks', 1]]
    : [['stone_bricks', 14], ['cracked_stone_bricks', 2], ['mossy_stone_bricks', 1]], lx, ly, z, 31);
}

function tube(b) {
  b.phase('Tunnelröhre');
  for (let ly = -1; ly <= VAULT.height + 1; ly++) {
    for (let z = 0; z <= T; z++) {
      for (let lx = -5; lx <= 5; lx++) {
        const niche = Math.abs(lx) === 5 && NICHES_Z.includes(z);
        if (ly === -1) {
          b.set(lx, ROAD - 1, z, 'stone');
          if (Math.abs(lx) === 5) b.set(lx, ROAD, z, 'stone_bricks');
          if (niche) b.set(lx + Math.sign(lx), ROAD, z, 'stone_bricks');
          continue;
        }
        if (niche && ly <= 2) b.set(lx + Math.sign(lx), ROAD + 1 + ly, z, 'stone_bricks');
        if (niche && ly <= 1) continue;
        const state = tubeState(lx, ly, z);
        if (state) b.set(lx, ROAD + 1 + ly, z, state);
      }
    }
  }
}

function cover(b) {
  b.phase('Überdeckung');
  for (let z = 0; z <= T; z++) {
    for (let x = -5; x <= 5; x++) {
      const from = ROAD + 2 + ringTop.get(x);
      const top = hillTop(x, z);
      for (let y = from; y <= top; y++) {
        const state = y === top ? 'grass_block' : y >= top - 2 ? 'dirt' : pick([['stone', 6], ['andesite', 2], ['tuff', 1]], x, y, z, 41);
        b.set(x, y, z, state);
      }
    }
  }
}

// --- Portale ---

function portalFace(b, zFace, out) {
  const facing = out > 0 ? 'south' : 'north';
  const inwardFacing = out > 0 ? 'north' : 'south';
  for (let y = ROAD; y <= FACE_TOP; y++) {
    for (let x = -CUT; x <= CUT; x++) {
      const ly = y - ROAD - 1;
      if (Math.abs(x) <= 4 && y === ROAD) continue;
      const kind = Math.abs(x) <= 4 && ly >= 0 ? profile.get(x, ly) : 'solid';
      if (kind === 'open') continue;
      let state;
      if (kind === 'stairs') state = `stone_brick_stairs[facing=${outerSide(x)},half=top]`;
      else if (kind === 'slab') state = 'stone_brick_slab[type=top]';
      else if (x === 0 && ly === VAULT.height) state = 'chiseled_stone_bricks';
      else if (Math.abs(x) <= 5 && ly >= -1 && vaultCell(x, ly) === 'ring') state = 'stone_bricks';
      else state = WALL;
      b.set(x, y, zFace, state);
    }
  }
  b.step();
  for (const s of SIDES) {
    b.fill(6 * s, ROAD, zFace + out, 6 * s, FACE_TOP - 2, zFace + out, 'polished_tuff');
    b.set(6 * s, FACE_TOP - 1, zFace + out, 'chiseled_tuff_bricks');
  }
  for (let x = -CUT; x <= CUT; x++) b.stairs(x, FACE_TOP, zFace + out, 'tuff_brick_stairs', { facing: inwardFacing, half: 'top' });
  for (let x = -CUT; x <= CUT; x++) b.set(x, FACE_TOP + 1, zFace, 'tuff_brick_wall');
  for (const s of SIDES) wallLantern(b, { x: 6 * s, y: ROAD + 4, z: zFace + out, facing, style: 'bracket', arm: 'dark_oak_fence' });
}

function portals(b) {
  b.phase('Portale');
  for (const [zFace, out] of [[T, 1], [0, -1]]) {
    b.step();
    portalFace(b, zFace, out);
  }
}

function retainingWalls(b) {
  b.phase('Stützmauern');
  for (const [zStart, zEnd, out] of [[T + 1, AREA.z2, 1], [-1, AREA.z1, -1]]) {
    for (let z = zStart; out > 0 ? z <= zEnd : z >= zEnd; z += out) {
      for (const s of SIDES) {
        const behind = hillTop((CUT + 1) * s, z);
        if (behind <= ROAD) continue;
        b.fill(CUT * s, ROAD, z, CUT * s, behind, z, WALL);
        b.slab(CUT * s, behind + 1, z, 'tuff_brick_slab');
      }
    }
  }
}

// --- Straße ---

function roadBlock(x, z) {
  if (x === 0 && ((z % 4) + 4) % 4 < 2) return 'polished_diorite';
  return pick([['andesite', 6], ['stone', 3], ['polished_andesite', 1]], x, ROAD, z, 51);
}

function road(b) {
  b.phase('Straße und Gehwege');
  b.step();
  for (let z = AREA.z1; z <= AREA.z2; z++) {
    for (let x = -3; x <= 3; x++) b.set(x, ROAD, z, roadBlock(x, z));
  }
  b.step();
  for (let z = AREA.z1; z <= AREA.z2; z++) {
    for (const s of SIDES) {
      b.set(4 * s, ROAD, z, 'stone_bricks');
      b.slab(4 * s, ROAD + 1, z, 'smooth_stone_slab');
    }
  }
}

// --- Licht und Umgebung ---

function lights(b) {
  b.phase('Beleuchtung');
  b.step();
  for (const z of LANTERNS_Z) hangingLantern(b, { x: 0, y: ROAD + VAULT.height, z, chain: 1 });
  b.step();
  for (const z of NICHES_Z) for (const s of SIDES) b.set(5 * s, ROAD + 1, z, 'lantern[hanging=false]');
  b.step();
  for (const z of [T + 7, T + 13]) lampPost(b, { x: 5, y: ROAD + 1, z, facing: 'west', height: 5, post: 'dark_oak_fence', base: 'stone_bricks', style: 'arm' });
  for (const z of [T + 10]) lampPost(b, { x: -5, y: ROAD + 1, z, facing: 'east', height: 5, post: 'dark_oak_fence', base: 'stone_bricks', style: 'arm' });
  lampPost(b, { x: -5, y: ROAD + 1, z: -6, facing: 'east', height: 5, post: 'dark_oak_fence', base: 'stone_bricks', style: 'arm' });
}

function surroundings(b, ground) {
  b.phase('Umgebung');
  b.step();
  const trees = [[-14, 6, 'eiche', 'mittel', 1], [13, 12, 'eiche', 'gross', 2], [-9, 15, 'birke', 'mittel', 3], [18, -4, 'birke', 'klein', 4], [-19, T + 8, 'eiche', 'klein', 5], [4, 10, 'birke', 'klein', 6]];
  // Über der Röhre hat das Gelände ein Loch (dort liegt die Überdeckung), also gilt dort die Hügelhöhe.
  const surface = (x, z) => (inTube(x, z) ? hillTop(x, z) : ground.top(x, z));
  for (const [x, z, species, size, seed] of trees) tree(b, { x, y: surface(x, z) + 1, z, species, size, seed });
  for (const [x, z, seed] of [[-11, T + 3, 1], [12, T + 4, 2], [-12, -3, 3], [9, 4, 4]]) bush(b, { x, y: surface(x, z) + 1, z, size: 'klein', leaves: 'eiche', seed });
  for (const [x, z, size, seed] of [[17, T + 6, 'mittel', 1], [-17, 18, 'klein', 2]]) rock(b, { x, y: surface(x, z) + 1, z, size, material: 'andesit', seed });
  b.step();
  vegetation(b, { x: AREA.x1, y: FACE_TOP + 8, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1, mix: 'blumen', density: 0.32, shape: 'eckig', scan: 24, seed: 9 });
}

export default function build(b) {
  const ground = hill(b);
  tube(b);
  cover(b);
  portals(b);
  retainingWalls(b);
  road(b);
  lights(b);
  surroundings(b, ground);
}
