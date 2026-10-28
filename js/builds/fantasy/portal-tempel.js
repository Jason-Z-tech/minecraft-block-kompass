// Portal-Tempel – eigenes Design: Säulentempel aus Schwarzstein und Netherziegeln auf einem dreistufigen Podest,
// in der Cella ein Netherportal auf einem Podium, davor und daneben Seelenfeuer-Schalen. Rund um den Tempel hat sich
// der Nether schon in den Boden gefressen. Lokal: Tempelmitte x 0, Vorderseite (Treppe, Eingang) im Süden (+z),
// Gras auf y −1, Podest y 0 … 2, Fußboden-Oberkante y 2.

import { hashPosition } from '../../core/random.js';
import {
  STONE, arch, arrowSlit, column, floorPattern, lampPost, lightRoom,
  terrain, tree, rock, path, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'portal-tempel',
  title: 'Portal-Tempel',
  category: 'fantasy',
  subtitle: 'Säulentempel aus Schwarzstein mit Netherportal und Seelenfeuer-Schalen',
  tags: ['Netherportal', 'Nether', 'Tempel', 'Portal', 'Schwarzstein', 'Netherziegel', 'Säulen', 'Seelenfeuer', 'Obsidian', 'Fantasy'],
  aliases: [
    'portal tempel', 'portaltempel', 'nether tempel', 'nethertempel', 'netherportal tempel', 'nether portal tempel',
    'netherportal', 'nether portal', 'portal temple', 'nether temple', 'nether portal temple', 'portal house',
    'portalhaus', 'portal haus', 'schwarzstein tempel', 'blackstone temple', 'seelenfeuer', 'soul fire temple',
    'portal deko', 'portal design', 'netherportal design', 'nether portl', 'portal templ',
  ],
  accuracy: 'eigenes',
  description: 'Ein Säulentempel auf einem dreistufigen Podest aus polierten Schwarzsteinziegeln: zwanzig Säulen aus '
    + 'poliertem Basalt tragen einen Fries und ein flaches Giebeldach mit verzierten Dreiecksgiebeln. In der Cella aus '
    + 'Netherziegeln steht auf einem Podium ein großes Netherportal, flankiert von Seelenfeuer-Schalen und roten Bannern. '
    + 'Rund um den Tempel hat sich der Nether in den Boden gefressen: Netherrack, Karmesin-Nezel und zwei Riesenpilze.',
  sources: [],
  credits: null,
  tested: null,
};

// ---------- Maße ----------
const FLOOR = 2; // Oberkante Fußboden (oberste Podeststufe)
const Y0 = FLOOR + 1; // erste Luftebene
const TIERS = [
  { y: 0, x: 13, z1: -17, z2: 14 },
  { y: 1, x: 12, z1: -16, z2: 13 },
  { y: 2, x: 11, z1: -15, z2: 12 },
];
const CELLA = { x: 6, z1: -10, z2: 4 }; // Außenkanten der Cella-Wände
const WALL_TOP = 9;
const CEIL = 10; // Fries und Decke
const ROOF_Y = 12; // unterste Dachreihe
const ROOF = { x: 12, z1: -16, z2: 12 };
const COL_HEIGHT = 7;
const PORTAL_Z = -8;
const DAIS = { x: 4, z1: -9, z2: -6 };

const SB = STONE.schwarzstein;
const NB = STONE.netherziegel;
const BRICK_MIX = [[SB.bricks, 20], [SB.cracked, 4], [SB.gilded, 1]];
const WALL_MIX = [[NB.bricks, 10], [NB.cracked, 2]];

function stairs(id, facing, half = 'bottom') {
  return `${id}[facing=${facing},half=${half}]`;
}

// Material aus einer gewichteten Liste, fest an die Position gebunden.
function mixAt(entries, x, y, z, salt) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = (hashPosition(x, y, z, salt) / 4294967296) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;

// Säulen: Seiten (x ±10) alle 4 Blöcke, hinten 6, vorne nur 4 – die Mitte bleibt für die Treppe frei.
const COLUMNS = (() => {
  const list = [];
  for (let z = -14; z <= 10; z += 4) list.push([-10, z], [10, z]);
  for (const x of [-6, -2, 2, 6]) list.push([x, -14]);
  for (const x of [-6, 6]) list.push([x, 10]);
  return list;
})();

// ---------- Podest ----------

function podium(b) {
  for (const t of TIERS) {
    for (let x = -t.x; x <= t.x; x++) {
      for (let z = t.z1; z <= t.z2; z++) b.set(x, t.y, z, mixAt(BRICK_MIX, x, t.y, z, 3));
    }
  }
}

// Freitreppe vorne, 9 breit; Wangen links und rechts steigen mit.
function frontStairs(b) {
  for (let k = 0; k < 3; k++) {
    const z = TIERS[0].z2 + 1 - k;
    for (let x = -4; x <= 4; x++) b.set(x, k, z, stairs(SB.brickStairs, 'north'));
    for (const x of [-5, 5]) b.set(x, k, z, SB.bricks);
  }
  for (const x of [-5, 5]) {
    b.set(x, 0, TIERS[0].z2, SB.bricks);
    b.set(x, 1, TIERS[1].z2, SB.bricks);
  }
}

function templeFloor(b) {
  // Umgang und Vorhalle: polierter Schwarzstein mit Ziegelrand
  floorPattern(b, { x: -TIERS[2].x, y: FLOOR, z: TIERS[2].z1, width: 2 * TIERS[2].x + 1, depth: TIERS[2].z2 - TIERS[2].z1 + 1, pattern: 'border', blocks: [SB.polished, SB.bricks] });
  // Cella: Rand aus Ziegeln, innen poliert, Läufer aus roten Netherziegeln zum Portal
  const ix = CELLA.x - 1;
  floorPattern(b, { x: -ix, y: FLOOR, z: CELLA.z1 + 1, width: 2 * ix + 1, depth: CELLA.z2 - CELLA.z1 - 1, pattern: 'checker', blocks: [SB.polished, SB.bricks], border: SB.bricks });
  for (let z = DAIS.z2 + 1; z <= CELLA.z2; z++) for (let x = -1; x <= 1; x++) b.set(x, FLOOR, z, x === 0 ? NB.red : NB.chiseled);
}

// ---------- Cella ----------

const isPilaster = (along, ends) => ends.includes(along);

function cellaWalls(b) {
  const { x: cx, z1, z2 } = CELLA;
  const sidePilasters = [z1, z1 + 1, -5, -1, z2 - 1, z2];
  const endPilasters = [-cx, -cx + 1, -2, 2, cx - 1, cx];
  for (let y = Y0; y <= WALL_TOP; y++) {
    const band = y === Y0 ? 'base' : y === WALL_TOP ? 'top' : 'mid';
    for (let z = z1; z <= z2; z++) {
      for (const x of [-cx, cx]) b.set(x, y, z, wallBlock(band, isPilaster(z, sidePilasters), x, y, z));
    }
    for (let x = -cx + 1; x <= cx - 1; x++) {
      for (const z of [z1, z2]) b.set(x, y, z, wallBlock(band, isPilaster(x, endPilasters), x, y, z));
    }
  }
}

function wallBlock(band, pilaster, x, y, z) {
  if (band === 'base') return SB.bricks;
  if (pilaster) return band === 'top' ? SB.chiseled : SB.bricks;
  if (band === 'top') return NB.red;
  return mixAt(WALL_MIX, x, y, z, 5);
}

function cellaOpenings(b) {
  // Spitzbogen-Eingang (5 breit, 6 hoch)
  arch(b, { x: 0, y: Y0, z: CELLA.z2, facing: 'south', width: 5, height: 6, style: 'pointed', block: SB.bricks, stairs: SB.brickStairs, depth: 1 });
  // Schlanke Fenster mit rotem Glas, oben ein Sturz aus gemeißelten Netherziegeln
  for (const z of [-7, -3, 1]) {
    for (const [x, facing] of [[-CELLA.x, 'west'], [CELLA.x, 'east']]) {
      arrowSlit(b, { x, y: Y0 + 2, z, facing, height: 3, fill: 'red_stained_glass_pane' });
      b.set(x, Y0 + 5, z, NB.chiseled);
    }
  }
}

// ---------- Säulen, Fries, Decke ----------

function columns(b) {
  for (const [x, z] of COLUMNS) {
    column(b, { x, y: Y0, z, height: COL_HEIGHT, shaft: 'polished_basalt', base: SB.bricks, capital: SB.chiseled, trim: SB.brickStairs });
  }
}

function ceilingAndFrieze(b) {
  const t = TIERS[2];
  for (let x = -t.x; x <= t.x; x++) {
    for (let z = t.z1; z <= t.z2 - 1; z++) {
      const edge = Math.abs(x) === t.x || z === t.z1 || z === t.z2 - 1;
      if (edge) {
        // Fries: Triglyphen (gemeißelt) im Wechsel mit Ziegeln
        const along = z === t.z1 || z === t.z2 - 1 ? x : z;
        b.set(x, CEIL, z, along % 2 === 0 ? SB.chiseled : SB.bricks);
        continue;
      }
      const inCella = Math.abs(x) < CELLA.x && z > CELLA.z1 && z < CELLA.z2;
      if (inCella) {
        // Kassettendecke: Balken aus Ziegeln, Felder aus roten Netherziegeln
        const beam = (x + CELLA.x - 1) % 4 === 0 || (z - CELLA.z1 - 1) % 4 === 0;
        b.set(x, CEIL, z, beam ? SB.bricks : NB.red);
      } else {
        b.set(x, CEIL, z, SB.polished);
      }
    }
  }
}

// ---------- Dach ----------

// Reihe i (von der Traufe aus) liegt auf ROOF_Y + floor(i / 2): gerade i = untere Stufe, ungerade = obere Stufe.
const roofRowY = (i) => ROOF_Y + Math.floor(i / 2);
const roofRow = (x) => ROOF.x - Math.abs(x);

function cornice(b) {
  const { x: rx, z1, z2 } = ROOF;
  // innerer Ring: Sockel des Dachstuhls auf dem Fries
  for (let x = -rx + 1; x <= rx - 1; x++) {
    for (let z = z1 + 1; z <= z2 - 1; z++) {
      if (Math.abs(x) === rx - 1 || z === z1 + 1 || z === z2 - 1) b.set(x, CEIL + 1, z, SB.bricks);
    }
  }
  // äußerer Ring: Gesims aus umgedrehten Treppen, die hohe Seite zum Tempel
  for (let x = -rx; x <= rx; x++) {
    b.set(x, CEIL + 1, z1, stairs(SB.brickStairs, 'south', 'top'));
    b.set(x, CEIL + 1, z2, stairs(SB.brickStairs, 'north', 'top'));
  }
  for (let z = z1 + 1; z <= z2 - 1; z++) {
    b.set(-rx, CEIL + 1, z, stairs(SB.brickStairs, 'east', 'top'));
    b.set(rx, CEIL + 1, z, stairs(SB.brickStairs, 'west', 'top'));
  }
}

// Giebelfelder (eine Reihe hinter der Dachkante), mit Zeichen aus vergoldetem Schwarzstein und weinendem Obsidian.
function pediments(b) {
  for (const z of [ROOF.z1 + 1, ROOF.z2 - 1]) {
    for (let x = -ROOF.x + 2; x <= ROOF.x - 2; x++) {
      const i = roofRow(x);
      for (let y = CEIL + 2; y < roofRowY(i); y++) b.set(x, y, z, mixAt(WALL_MIX, x, y, z, 9));
    }
    const cy = CEIL + 4;
    b.set(0, cy, z, 'crying_obsidian');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.set(dx, cy + dy, z, SB.gilded);
    for (const dx of [-3, 3]) b.set(dx, CEIL + 2, z, SB.chiseled);
  }
}

function roof(b) {
  const slab = SB.brickSlab;
  for (let x = -ROOF.x; x <= ROOF.x; x++) {
    const i = roofRow(x);
    const y = roofRowY(i);
    for (let z = ROOF.z1; z <= ROOF.z2; z++) {
      // In der Giebelebene schließt ein voller Block die Lücke unter der oberen Stufe (oben bündig).
      const gable = (z === ROOF.z1 + 1 || z === ROOF.z2 - 1) && i % 2 === 1 && Math.abs(x) < ROOF.x - 1;
      b.set(x, y, z, gable ? SB.bricks : `${slab}[type=${i % 2 === 0 ? 'bottom' : 'top'}]`);
    }
  }
}

function roofLanterns(b) {
  const top = roofRowY(ROOF.x) + 1;
  for (const z of [ROOF.z1, ROOF.z2]) {
    // Am Firstende ein voller Ziegel statt der unteren Stufe – sonst schwebt das Mauerstück einen halben Block darüber.
    b.set(0, top - 1, z, SB.bricks);
    b.set(0, top, z, SB.brickWall);
    b.set(0, top + 1, z, 'soul_lantern[hanging=false]');
  }
}

// ---------- Portal ----------

function dais(b) {
  for (let x = -DAIS.x; x <= DAIS.x; x++) {
    for (let z = DAIS.z1; z <= DAIS.z2; z++) b.set(x, Y0, z, Math.abs(x) === DAIS.x || z === DAIS.z2 ? SB.bricks : SB.polished);
    b.set(x, Y0, DAIS.z2 + 1, stairs(SB.brickStairs, 'north'));
  }
  for (const [x, z] of [[-3, PORTAL_Z], [3, PORTAL_Z], [-1, DAIS.z1], [1, DAIS.z1]]) b.set(x, Y0, z, 'crying_obsidian');
}

function portalFrame(b) {
  const yb = Y0 + 1;
  for (let x = -2; x <= 2; x++) {
    b.set(x, yb, PORTAL_Z, 'obsidian');
    b.set(x, yb + 5, PORTAL_Z, 'obsidian');
  }
  for (let y = yb + 1; y <= yb + 4; y++) {
    b.set(-2, y, PORTAL_Z, 'obsidian');
    b.set(2, y, PORTAL_Z, 'obsidian');
  }
}

function lightPortal(b) {
  for (let x = -1; x <= 1; x++) for (let y = Y0 + 2; y <= Y0 + 5; y++) b.set(x, y, PORTAL_Z, 'nether_portal[axis=x]');
}

// ---------- Seelenfeuer-Schalen ----------

// Schale auf einem Pfosten: Sockel, Mauerstück(e), Seelenerde mit einem Kranz aus umgedrehten Treppen (hohe Seite zur Mitte,
// außen unterschnitten wie eine Schale), obendrauf Seelenfeuer.
function brazier(b, x, y, z, post) {
  b.set(x, y, z, SB.polished);
  for (let k = 1; k <= post; k++) b.set(x, y + k, z, SB.brickWall);
  const ys = y + post + 1;
  b.set(x, ys, z, 'soul_soil');
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const facing = dz === -1 ? 'south' : dz === 1 ? 'north' : dx === -1 ? 'east' : 'west';
      b.set(x + dx, ys, z + dz, stairs(SB.brickStairs, facing, 'top'));
    }
  }
  return [x, ys + 1, z];
}

function igniteBraziers(b, fires) {
  for (const [x, y, z] of fires) b.set(x, y, z, 'soul_fire');
}

// ---------- Einrichtung ----------

function furnishCella(b) {
  const ix = CELLA.x - 1;
  // Rote Banner an den Wandpfeilern
  for (const z of [-5, -1]) {
    b.set(-ix, WALL_TOP - 1, z, 'red_wall_banner[facing=east]');
    b.set(ix, WALL_TOP - 1, z, 'red_wall_banner[facing=west]');
  }
  // Bänke an den Seitenwänden, Lehne zur Wand
  for (const z of [-3, -2, 1, 2]) {
    b.set(-ix, Y0, z, stairs(NB.stairs, 'west'));
    b.set(ix, Y0, z, stairs(NB.stairs, 'east'));
  }
  // Opfertruhen neben dem Läufer und Kerzen vor dem Podium
  b.set(-3, Y0, 3, 'chest[facing=east]');
  b.set(3, Y0, 3, 'chest[facing=west]');
  for (const x of [-3, 3]) b.set(x, Y0 + 1, DAIS.z2, 'red_candle[candles=3,lit=true]');
}

// Wächterköpfe auf den Treppenwangen, Blick zur Treppe hinunter (Köpfe: rotation 8 = Gesicht nach Süden).
function guardians(b) {
  for (const x of [-5, 5]) b.set(x, TIERS[2].y + 1, TIERS[1].z2, 'piglin_head[rotation=8]');
}

// ---------- Umgebung ----------

const TERRAIN = { x1: -26, z1: -28, x2: 26, z2: 32 };
const FUNGI = [[-19, -12, 9, 41], [18, -20, 7, 43]];

// Abstand eines Bodenfelds zum Podest (0 = darunter).
function distToPodium(x, z) {
  const t = TIERS[0];
  const dx = Math.max(0, Math.abs(x) - t.x);
  const dz = Math.max(0, t.z1 - z, z - (t.z2 + 1));
  return Math.hypot(dx, dz);
}

// Der Nether frisst sich in den Boden: Netherrack in Flecken, darauf Karmesin-Nezel, etwas Magma und Seelenerde.
// Gibt die Nezel-Felder zurück (dort wachsen später Wurzeln und Pilze).
function corruptGround(b) {
  const nylium = [];
  for (let x = TERRAIN.x1 + 2; x <= TERRAIN.x2 - 2; x++) {
    for (let z = TERRAIN.z1 + 2; z <= TERRAIN.z2 - 2; z++) {
      const d = distToPodium(x, z);
      if (d === 0 || b.get(x, -1, z) !== 'grass_block' || b.get(x, 0, z) !== 'air') continue;
      const n = (rand01(x >> 1, 0, z >> 1, 31) + rand01(x, 0, z, 32)) / 2;
      const strength = n + 0.55 - d * 0.075;
      if (strength < 0.62) continue;
      let state = 'netherrack';
      const v = rand01(x, -1, z, 33);
      if (strength > 0.78 && v < 0.45) state = 'crimson_nylium';
      else if (v < 0.07) state = 'magma_block';
      else if (v < 0.13) state = 'soul_soil';
      b.set(x, -1, z, state);
      if (state === 'crimson_nylium') nylium.push([x, z]);
    }
  }
  return nylium;
}

function netherPlants(b, nylium) {
  for (const [x, z] of nylium) {
    if (b.get(x, 0, z) !== 'air') continue;
    const r = rand01(x, 0, z, 34);
    if (r < 0.28) b.set(x, 0, z, 'crimson_roots');
    else if (r < 0.36) b.set(x, 0, z, 'crimson_fungus');
    else if (r < 0.42) b.set(x, 0, z, 'nether_sprouts');
  }
}

// Riesiger Karmesinpilz: Stängel, Hut aus Warzenblöcken mit Pilzlichtern, Trauerranken unter dem Rand.
function fungusGround(b, x, z) {
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) b.set(x + dx, -1, z + dz, 'crimson_nylium');
}

function crimsonFungus(b, x, z, height, salt) {
  for (let y = 0; y < height; y++) b.set(x, y, z, 'crimson_stem[axis=y]');
  const capY = height - 2;
  const radii = [3.4, 3.4, 2.5, 1.5];
  radii.forEach((r, k) => {
    const y = capY + k;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > r) continue;
        if (k === 0 && d <= 2.2) continue; // unten offen: nur der Rand hängt herab
        if (k === 1 && dx === 0 && dz === 0) continue; // Stängel
        const light = rand01(x + dx, y, z + dz, salt) < 0.14;
        b.set(x + dx, y, z + dz, light ? 'shroomlight' : 'nether_wart_block');
      }
    }
  });
  b.set(x, capY + 1, z, 'crimson_stem[axis=y]');
  // Trauerranken unter dem Rand
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const d = Math.hypot(dx, dz);
      if (d <= 2.2 || d > 3.4 || rand01(x + dx, 0, z + dz, salt + 1) > 0.45) continue;
      const len = 1 + (hashPosition(x + dx, 1, z + dz, salt) % 3);
      for (let k = 1; k <= len; k++) {
        const y = capY - k;
        if (y < 1 || b.get(x + dx, y, z + dz) !== 'air') break;
        b.set(x + dx, y, z + dz, k === len ? `weeping_vines[age=${20 + k}]` : 'weeping_vines_plant');
      }
    }
  }
}

// ---------- Bau ----------

export default function build(b) {
  const braziers = [];

  b.phase('Gelände und Podest');
  b.step();
  terrain(b, { x: TERRAIN.x1, y: -1, z: TERRAIN.z1, width: TERRAIN.x2 - TERRAIN.x1 + 1, depth: TERRAIN.z2 - TERRAIN.z1 + 1, height: 0, surface: 'gras', seed: 'portal' });
  b.step();
  const nylium = corruptGround(b);
  for (const [x, z] of FUNGI) fungusGround(b, x, z);
  path(b, { x: 0, y: -1, z: TIERS[0].z2 + 2, facing: 'south', length: TERRAIN.z2 - TIERS[0].z2 - 2, width: 5, mix: 'kies', wiggle: 0.5, seed: 'portal' });
  b.step();
  podium(b);
  b.step();
  frontStairs(b);
  b.step();
  templeFloor(b);

  b.phase('Cella');
  b.step();
  cellaWalls(b);
  b.step();
  cellaOpenings(b);

  b.phase('Säulen');
  columns(b);

  b.phase('Fries und Decke');
  ceilingAndFrieze(b);

  b.phase('Dach');
  b.step();
  cornice(b);
  b.step();
  pediments(b);
  b.step();
  roof(b);
  b.step();
  roofLanterns(b);

  b.phase('Netherportal');
  b.step();
  dais(b);
  b.step();
  portalFrame(b);
  b.step();
  lightPortal(b);

  b.phase('Seelenfeuer-Schalen');
  b.step();
  for (const x of [-4, 4]) braziers.push(brazier(b, x, Y0 + 1, DAIS.z2, 1));
  for (const x of [-4, 4]) braziers.push(brazier(b, x, Y0, 7, 2));
  for (const x of [-8, 8]) braziers.push(brazier(b, x, 0, TIERS[0].z2 + 2, 2));
  b.step();
  igniteBraziers(b, braziers);

  b.phase('Einrichtung und Licht');
  b.step();
  furnishCella(b);
  b.step();
  guardians(b);
  b.step();
  lightRoom(b, { x1: -CELLA.x + 1, y1: Y0, z1: CELLA.z1 + 1, x2: CELLA.x - 1, y2: WALL_TOP, z2: CELLA.z2 - 1 }, { lantern: 'soul_lantern' });
  lightRoom(b, { x1: -TIERS[2].x, y1: Y0, z1: TIERS[2].z1, x2: TIERS[2].x, y2: WALL_TOP, z2: TIERS[2].z2 }, { lantern: 'soul_lantern' });

  b.phase('Umgebung');
  b.step();
  netherPlants(b, nylium);
  b.step();
  for (const [x, z, h, salt] of FUNGI) crimsonFungus(b, x, z, h, salt);
  b.step();
  for (const z of [21, 28]) {
    for (const x of [-5, 5]) lampPost(b, { x, y: 0, z, height: 3, post: SB.brickWall, base: SB.polished, lantern: 'soul_lantern' });
  }
  b.step();
  for (const [x, z, size, seed] of [[-20, 24, 'mittel', 1], [21, 22, 'mittel', 2], [-21, -24, 'mittel', 3], [21, 0, 'mittel', 4]]) {
    tree(b, { x, y: 0, z, species: 'fichte', size, seed });
  }
  rock(b, { x: -13, y: 0, z: 25, size: 'klein', material: 'schiefer', sink: 0, seed: 1 });
  rock(b, { x: 15, y: 0, z: 28, size: 'klein', material: 'schiefer', sink: 0, seed: 5 });
  rock(b, { x: -22, y: 0, z: 5, size: 'mittel', material: 'schiefer', sink: 0, seed: 3 });
  vegetation(b, { x: TERRAIN.x1, y: 4, z: TERRAIN.z1, width: TERRAIN.x2 - TERRAIN.x1 + 1, depth: TERRAIN.z2 - TERRAIN.z1 + 1, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 'portal' });
}
