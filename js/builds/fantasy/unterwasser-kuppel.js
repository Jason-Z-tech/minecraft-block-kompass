// Unterwasser-Kuppel – eigenes Design: Glaskuppel (Halbkugel) auf dem Meeresgrund mit Wohnbereich, Lager und Garten,
// verbunden über einen Glastunnel mit einem Einstiegsschacht bis an die Wasseroberfläche. Lokal: Kuppelmitte x 0, z 0,
// Meeresgrund-Oberkante y 1, Wasser bis y 14; der Schacht liegt im Osten.

import { hashPosition } from '../../core/random.js';
import { isFullSolid } from '../../core/connections.js';
import { stateId } from '../../core/blockstate.js';
import { rock, findDarkSpots } from '../lib/index.js';

export const meta = {
  id: 'unterwasser-kuppel',
  title: 'Unterwasser-Kuppel',
  category: 'fantasy',
  subtitle: 'Glaskuppel auf dem Meeresgrund mit Garten, Schlafplatz und Einstiegsschacht',
  tags: ['Unterwasser', 'Meer', 'Ozean', 'Kuppel', 'Glas', 'Basis', 'Korallen', 'Seelaterne', 'Prismarin', 'Schwamm'],
  aliases: [
    'unterwasser kuppel', 'unterwasserkuppel', 'unterwasser basis', 'unterwasserbasis', 'unterwasserhaus', 'unterwasser haus',
    'glaskuppel', 'glas kuppel', 'meereskuppel', 'ozeankuppel', 'underwater dome', 'underwater base', 'underwater house',
    'sea dome', 'ocean base', 'ocean dome', 'tauchstation', 'unterwasserstation', 'atlantis', 'unterwaser kuppel',
  ],
  accuracy: 'eigenes',
  description: 'Eine Glaskuppel mit 21 Blöcken Durchmesser steht auf dem Meeresgrund, gehalten von Rippen aus '
    + 'Prismarinziegeln. Drinnen gibt es einen Schlafbereich, ein Lager mit Werkbank und Öfen, einen kleinen Garten mit '
    + 'Beeten und eine Sitzecke in der Mitte, alles von Seelaternen beleuchtet. Ein Glastunnel führt zu einem Schacht mit '
    + 'Leiter hinauf zu einer Plattform an der Wasseroberfläche. Draußen wachsen Korallen, Seetang und Seegras.',
  sources: [],
  credits: null,
  tested: null,
};

// ---------- Maße ----------
const R = 10;
const CY = 1;
const SEA_TOP = 14;
const AREA = 20;
// Tunnel und Schacht werden lokal nach Süden gebaut und mit b.transform nach Osten gedreht (rotate 270).
const TUNNEL = { x1: -1, x2: 1, y1: 2, y2: 4, z1: 7, z2: 13 };
const SHAFT = { x1: -1, x2: 1, z1: 14, z2: 16, y2: 15 };
const ENTRY_ROTATE = 270;
// Welt → lokal (Umkehr von rotate 270: lokal Süden = Welt Osten)
const toLocal = (x, z) => [-z, x];

const FRAME = 'prismarine_bricks';
const DARK = 'dark_prismarine';
const SEABED_MIX = [['sand', 6], ['gravel', 2], ['clay', 1], ['sand', 1]];

function rand01(x, y, z, salt) {
  return hashPosition(x, y, z, salt) / 4294967296;
}

function mixAt(entries, x, y, z, salt) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand01(x, y, z, salt) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

const insideDome = (x, y, z) => y > CY && Math.hypot(x, y - CY, z) < R - 0.5;
const insideTunnel = (x, y, z) => x >= TUNNEL.x1 && x <= TUNNEL.x2 && y >= TUNNEL.y1 && y <= TUNNEL.y2 && z >= TUNNEL.z1 && z <= TUNNEL.z2;
const insideShaft = (x, y, z) => x >= SHAFT.x1 && x <= SHAFT.x2 && z >= SHAFT.z1 && z <= SHAFT.z2 && y >= 2 && y <= SHAFT.y2 + 1;
const inTunnelWorld = (x, y, z) => insideTunnel(toLocal(x, z)[0], y, toLocal(x, z)[1]);
const inShaftWorld = (x, y, z) => insideShaft(toLocal(x, z)[0], y, toLocal(x, z)[1]);
const isDry = (x, y, z) => insideDome(x, y, z) || inTunnelWorld(x, y, z) || inShaftWorld(x, y, z);

// ---------- Meeresgrund ----------

function seabed(b) {
  for (let x = -AREA; x <= AREA; x++) {
    for (let z = -AREA; z <= AREA; z++) {
      b.set(x, 0, z, rand01(x, 0, z, 1) < 0.7 ? 'sandstone' : 'stone');
      b.set(x, 1, z, mixAt(SEABED_MIX, x, 1, z, 2));
    }
  }
}

// ---------- Kuppel ----------

function domeFloor(b) {
  for (let x = -R; x <= R; x++) {
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z);
      if (d > R + 0.5) continue;
      let state;
      if (d > R - 0.5) state = DARK;
      else if (Math.round(d) % 3 === 0) state = DARK;
      else state = FRAME;
      b.set(x, CY, z, state);
    }
  }
  for (const [x, z] of [[0, 0], [4, 4], [-4, 4], [4, -4], [-4, -4], [0, 7], [7, 0], [-7, 0], [0, -7]]) b.set(x, CY, z, 'sea_lantern');
  // Sockel außen: Ring aus Treppen, hohe Seite zur Kuppel (im Wasser, darum geflutet)
  for (let x = -R - 1; x <= R + 1; x++) {
    for (let z = -R - 1; z <= R + 1; z++) {
      const d = Math.hypot(x, z);
      if (d <= R + 0.5 || d > R + 1.5) continue;
      if (inTunnelWorld(x, 2, z)) continue;
      const facing = Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'west' : 'east') : (z > 0 ? 'north' : 'south');
      b.set(x, CY, z, `dark_prismarine_stairs[facing=${facing},half=bottom,waterlogged=true]`);
    }
  }
}

function domeShell(b, yFrom, yTo) {
  for (let y = Math.max(yFrom, CY + 1); y <= yTo; y++) {
    for (let x = -R; x <= R; x++) {
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, y - CY, z);
        if (d > R + 0.5 || d < R - 0.5) continue;
        if (inTunnelWorld(x, y, z)) continue;
        const angle = Math.atan2(z, x);
        const nearest = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const horiz = Math.hypot(x, z);
        const rib = Math.abs(angle - nearest) * horiz <= 0.55;
        const ring = y === 6;
        let state = 'glass';
        if (y === CY + 1) state = DARK;
        else if (rib || ring) state = FRAME;
        if (y === CY + R && x === 0 && z === 0) state = 'sea_lantern';
        b.set(x, y, z, state);
      }
    }
  }
}

// Glastunnel (innen 3 breit, 3 hoch) und Einstiegsschacht (innen 3 × 3) mit Leiter bis über die Wasseroberfläche.
function tunnel(b) {
  for (let z = TUNNEL.z1; z <= TUNNEL.z2; z++) {
    for (let x = TUNNEL.x1 - 1; x <= TUNNEL.x2 + 1; x++) {
      for (let y = TUNNEL.y1 - 1; y <= TUNNEL.y2 + 1; y++) {
        if (insideDome(x, y, z) && !insideTunnel(x, y, z)) continue;
        const inner = insideTunnel(x, y, z);
        if (inner) {
          b.set(x, y, z, 'air');
          continue;
        }
        if (Math.hypot(x, y - CY, z) < R - 0.5) continue;
        const frame = z % 3 === 0 || y === TUNNEL.y1 - 1 || ((x === TUNNEL.x1 - 1 || x === TUNNEL.x2 + 1) && (y === TUNNEL.y2 + 1));
        b.set(x, y, z, y === TUNNEL.y1 - 1 ? DARK : frame ? FRAME : 'glass');
      }
    }
  }
  for (let z = TUNNEL.z1 + 3; z <= TUNNEL.z2; z += 3) b.set(0, TUNNEL.y1 - 1, z, 'sea_lantern');
}

function shaft(b) {
  for (let y = CY; y <= SHAFT.y2; y++) {
    for (let x = SHAFT.x1 - 1; x <= SHAFT.x2 + 1; x++) {
      for (let z = SHAFT.z1 - 1; z <= SHAFT.z2 + 1; z++) {
        const inner = x >= SHAFT.x1 && x <= SHAFT.x2 && z >= SHAFT.z1 && z <= SHAFT.z2;
        if (y === CY) {
          b.set(x, y, z, inner && x === 0 && z === SHAFT.z1 + 1 ? 'sea_lantern' : DARK);
          continue;
        }
        if (inner) {
          b.set(x, y, z, 'air');
          continue;
        }
        if (insideTunnel(x, y, z) || (z === SHAFT.z1 - 1 && x >= TUNNEL.x1 && x <= TUNNEL.x2 && y <= TUNNEL.y2)) {
          b.set(x, y, z, 'air');
          continue;
        }
        const corner = (x === SHAFT.x1 - 1 || x === SHAFT.x2 + 1) && (z === SHAFT.z1 - 1 || z === SHAFT.z2 + 1);
        const window = !corner && x === 0 && y % 4 === 2 && y <= SEA_TOP - 1;
        const windowSide = !corner && z === SHAFT.z1 + 1 && y % 4 === 0 && y <= SEA_TOP - 1;
        b.set(x, y, z, corner || y === SHAFT.y2 ? DARK : window || windowSide ? 'glass' : FRAME);
      }
    }
  }
  // Leiter an der (lokalen) Südwand innen, von unten bis oben – nach dem Drehen die Ostwand
  for (let y = CY + 1; y <= SHAFT.y2; y++) b.set(0, y, SHAFT.z2, 'ladder[facing=north]');
  // Seelaternen im Schacht (in die Wand eingelassen)
  for (const y of [6, 11]) {
    b.set(SHAFT.x1 - 1, y, SHAFT.z1 + 1, 'sea_lantern');
    b.set(SHAFT.x2 + 1, y, SHAFT.z1 + 1, 'sea_lantern');
  }
}

// Plattform an der Oberfläche: Ring um den Schacht, Geländer, Laternen auf Pfosten.
function surfaceDock(b) {
  const y = SEA_TOP + 1;
  for (let x = SHAFT.x1 - 3; x <= SHAFT.x2 + 3; x++) {
    for (let z = SHAFT.z1 - 3; z <= SHAFT.z2 + 3; z++) {
      if (x >= SHAFT.x1 - 1 && x <= SHAFT.x2 + 1 && z >= SHAFT.z1 - 1 && z <= SHAFT.z2 + 1) continue;
      const edge = x === SHAFT.x1 - 3 || x === SHAFT.x2 + 3 || z === SHAFT.z1 - 3 || z === SHAFT.z2 + 3;
      b.set(x, y, z, edge ? 'stripped_spruce_log[axis=y]' : 'spruce_planks');
    }
  }
  for (let x = SHAFT.x1 - 3; x <= SHAFT.x2 + 3; x++) {
    for (let z = SHAFT.z1 - 3; z <= SHAFT.z2 + 3; z++) {
      const edge = x === SHAFT.x1 - 3 || x === SHAFT.x2 + 3 || z === SHAFT.z1 - 3 || z === SHAFT.z2 + 3;
      if (!edge) continue;
      if (z === SHAFT.z2 + 3 && Math.abs(x) <= 1) continue;
      b.set(x, y + 1, z, 'spruce_fence');
    }
  }
  for (const [x, z] of [[SHAFT.x1 - 3, SHAFT.z1 - 3], [SHAFT.x2 + 3, SHAFT.z1 - 3], [SHAFT.x1 - 3, SHAFT.z2 + 3], [SHAFT.x2 + 3, SHAFT.z2 + 3]]) {
    b.set(x, y + 2, z, 'lantern[hanging=false]');
  }
  // Abdeckung über dem Schacht, nur das Leiterfeld bleibt offen
  b.set(0, SHAFT.y2, SHAFT.z2, 'ladder[facing=north]');
  for (let x = SHAFT.x1; x <= SHAFT.x2; x++) {
    for (let z = SHAFT.z1; z <= SHAFT.z2; z++) if (!(x === 0 && z === SHAFT.z2)) b.set(x, SHAFT.y2, z, 'prismarine_brick_slab[type=top]');
  }
}

// ---------- Einrichtung ----------

function sleepingArea(b) {
  const y = CY + 1;
  for (let x = -3; x <= 3; x++) for (let z = -6; z <= -3; z++) b.set(x, y, z, 'light_blue_carpet');
  b.bed(-2, y, -5, 'light_blue_bed', { facing: 'north' });
  b.bed(2, y, -5, 'light_blue_bed', { facing: 'north' });
  b.set(0, y, -6, 'barrel[facing=up]');
  b.set(0, y + 1, -6, 'lantern[hanging=false]');
  b.set(-4, y, -6, 'chest[facing=east]');
  b.set(4, y, -6, 'chest[facing=west]');
  b.set(-2, y, -3, 'white_carpet');
  b.set(2, y, -3, 'white_carpet');
  b.set(-1, y, -7, 'bookshelf');
  b.set(1, y, -7, 'bookshelf');
  b.set(0, y, -7, 'potted_blue_orchid');
  b.set(0, y, -8, 'bookshelf');
}

function storageArea(b) {
  const y = CY + 1;
  // Fässer unten, Truhen obendrauf: Über einer Truhe darf kein voller Block stehen, sonst geht sie nicht auf.
  for (const x of [-2, -1, 1, 2]) b.set(x, y, 7, 'barrel[facing=north]');
  for (const x of [-2, -1, 1, 2]) b.set(x, y + 1, 7, 'chest[facing=north]');
  b.set(0, y, 7, 'crafting_table');
  b.set(0, y + 1, 7, 'lantern[hanging=false]');
  b.set(3, y, 6, 'furnace[facing=north]');
  b.set(4, y, 5, 'blast_furnace[facing=north]');
  b.set(-3, y, 6, 'smoker[facing=north]');
  b.set(-4, y, 5, 'smithing_table');
  b.set(5, y, 4, 'anvil[facing=west]');
}

function gardenArea(b) {
  const y = CY;
  // Beet mit Wasserquelle in der Mitte, Ackerboden ringsum (alles im Abstand ≤ 4)
  for (let x = -7; x <= -5; x++) {
    for (let z = -2; z <= 2; z++) {
      if (x === -6 && z === 0) {
        b.set(x, y, z, 'water[level=0]');
        b.set(x, y + 1, z, 'lily_pad');
        continue;
      }
      b.set(x, y, z, 'farmland[moisture=7]');
      const crop = z < 0 ? `carrots[age=${5 + ((x + z) & 1) * 2}]` : z > 0 ? `wheat[age=${6 + ((x + z) & 1)}]` : 'beetroots[age=3]';
      b.set(x, y + 1, z, crop);
    }
  }
  // Rand des Beets aus Fichtenstämmen, daneben Blumen auf Moos, Komposter, Azaleen
  for (let z = -3; z <= 3; z++) b.set(-4, y + 1, z, 'spruce_trapdoor[facing=east,half=bottom,open=true]');
  for (const [x, z] of [[-5, 4], [-6, 3], [-4, 5], [-5, -4], [-6, -3], [-4, -5]]) {
    b.set(x, y, z, 'moss_block');
    b.set(x, y + 1, z, ['allium', 'blue_orchid', 'azure_bluet', 'cornflower', 'lily_of_the_valley', 'oxeye_daisy'][Math.abs(x * 3 + z) % 6]);
  }
  b.set(-7, y, 4, 'moss_block');
  b.set(-7, y + 1, 4, 'flowering_azalea');
  b.set(-7, y, -4, 'moss_block');
  b.set(-7, y + 1, -4, 'azalea');
  b.set(-8, y + 1, 1, 'composter[level=4]');
  b.set(-8, y + 1, -1, 'barrel[facing=east]');
}

function lounge(b) {
  const y = CY + 1;
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) b.set(x, y, z, x === 0 && z === 0 ? 'air' : 'cyan_carpet');
  b.set(0, y, 2, 'prismarine_brick_stairs[facing=south,half=bottom]');
  b.set(0, y, -2, 'prismarine_brick_stairs[facing=north,half=bottom]');
  b.set(2, y, 0, 'prismarine_brick_stairs[facing=east,half=bottom]');
  b.set(-2, y, 0, 'prismarine_brick_stairs[facing=west,half=bottom]');
  b.set(0, y, 0, 'potted_dead_bush');
}

// Dunkle begehbare Stellen im trockenen Bereich: Laterne darauf (nur innen, auf vollem Block).
function lightInside(b) {
  const box = { x1: -R, y1: CY + 1, z1: -R, x2: SHAFT.z2, y2: SHAFT.y2 + 1, z2: R };
  const placed = [];
  for (let guard = 0; guard < 60; guard++) {
    const dark = findDarkSpots(b, box).filter(([x, y, z]) => isDry(x, y, z) && isFullSolid(stateId(b.get(x, y - 1, z))));
    if (dark.length === 0) return placed;
    const [x, y, z] = dark[0];
    b.set(x, y, z, 'lantern[hanging=false]');
    placed.push([x, y, z]);
  }
  throw new Error('unterwasser-kuppel: der Innenraum lässt sich nicht ausleuchten.');
}

// ---------- Meer ----------

const CORALS = ['tube', 'brain', 'bubble', 'fire', 'horn'];
const DIRS = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

function coralPatch(b, cx, cz, size, salt) {
  for (let dx = -size; dx <= size; dx++) {
    for (let dz = -size; dz <= size; dz++) {
      if (Math.hypot(dx, dz) > size + 0.3 || rand01(cx + dx, 0, cz + dz, salt) < 0.25) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (b.get(x, 2, z) !== 'air') continue;
      const kind = CORALS[hashPosition(x, 1, z, salt + 1) % CORALS.length];
      const h = Math.hypot(dx, dz) < size * 0.5 ? 1 + (hashPosition(x, 2, z, salt) % 2) : 1;
      for (let k = 0; k < h; k++) b.set(x, 2 + k, z, `${kind}_coral_block`);
      const top = 2 + h;
      const r = rand01(x, top, z, salt + 2);
      if (r < 0.35) b.set(x, top, z, `${kind}_coral[waterlogged=true]`);
      else if (r < 0.6) b.set(x, top, z, `${kind}_coral_fan[waterlogged=true]`);
      else if (r < 0.72) b.set(x, top, z, `sea_pickle[pickles=${1 + (hashPosition(x, top, z, 3) % 4)},waterlogged=true]`);
    }
  }
  // Fächer an den Seiten der Korallenblöcke
  for (let dx = -size - 1; dx <= size + 1; dx++) {
    for (let dz = -size - 1; dz <= size + 1; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (b.get(x, 2, z) !== 'air' || rand01(x, 2, z, salt + 4) > 0.4) continue;
      for (const [facing, [ox, oz]] of Object.entries(DIRS)) {
        const behind = stateId(b.get(x - ox, 2, z - oz));
        if (!behind.endsWith('_coral_block')) continue;
        b.set(x, 2, z, `${behind.replace('_coral_block', '')}_coral_wall_fan[facing=${facing},waterlogged=true]`);
        break;
      }
    }
  }
}

function kelp(b, x, z, height) {
  if (b.get(x, 2, z) !== 'air') return;
  for (let k = 0; k < height - 1; k++) b.set(x, 2 + k, z, 'kelp_plant');
  b.set(x, 1 + height, z, `kelp[age=${10 + (hashPosition(x, height, z, 8) % 10)}]`);
}

function seaPlants(b) {
  for (let x = -AREA; x <= AREA; x++) {
    for (let z = -AREA; z <= AREA; z++) {
      if (Math.hypot(x, z) < R + 3 || b.get(x, 2, z) !== 'air') continue;
      if (stateId(b.get(x, 1, z)) !== 'sand' && stateId(b.get(x, 1, z)) !== 'gravel') continue;
      const r = rand01(x, 2, z, 21);
      if (r < 0.045) kelp(b, x, z, 6 + (hashPosition(x, 3, z, 22) % 7));
      else if (r < 0.15) b.set(x, 2, z, 'seagrass');
      else if (r < 0.19 && b.get(x, 3, z) === 'air') b.tall(x, 2, z, 'tall_seagrass');
    }
  }
}

function fillSea(b) {
  for (let x = -AREA; x <= AREA; x++) {
    for (let z = -AREA; z <= AREA; z++) {
      for (let y = 2; y <= SEA_TOP; y++) {
        if (b.get(x, y, z) !== 'air' || isDry(x, y, z)) continue;
        b.set(x, y, z, 'water[level=0]');
      }
    }
  }
}

// ---------- Bau ----------

export default function build(b) {
  b.phase('Meeresgrund');
  seabed(b);

  b.phase('Boden und Sockel der Kuppel');
  domeFloor(b);

  b.phase('Glaskuppel');
  const bands = [[2, 4], [5, 7], [8, 11]];
  for (const [y1, y2] of bands) {
    b.step();
    domeShell(b, y1, y2);
  }

  b.phase('Tunnel und Einstiegsschacht');
  const entry = (fn) => b.transform({ rotate: ENTRY_ROTATE }, () => fn(b));
  b.step();
  entry(tunnel);
  b.step();
  entry(shaft);
  b.step();
  entry(surfaceDock);

  b.phase('Einrichtung');
  b.step();
  sleepingArea(b);
  b.step();
  storageArea(b);
  b.step();
  gardenArea(b);
  b.step();
  lounge(b);
  b.step();
  lightInside(b);

  b.phase('Riff und Meer');
  b.step();
  rock(b, { x: -15, y: 2, z: -12, size: 'mittel', material: 'andesit', moss: false, rubble: false, sink: 0, seed: 1 });
  rock(b, { x: 14, y: 2, z: 13, size: 'klein', material: 'stein', moss: false, rubble: false, sink: 0, seed: 2 });
  for (const [x, z, size, salt] of [[-14, 4, 3, 31], [13, -6, 3, 41], [-6, -15, 2, 51], [8, -15, 3, 61], [15, 4, 2, 71], [-12, 13, 3, 81], [-3, 16, 2, 91]]) {
    coralPatch(b, x, z, size, salt);
  }
  b.step();
  seaPlants(b);
  b.step();
  fillSea(b);
}
