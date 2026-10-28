// Magierturm – runder Turm aus Tiefenschiefer und Schwarzstein mit Außentreppe, Zauberraum und schwebenden Felsen.
// Eigenes Design. Mitte des Turms bei x = 0, z = 0; Gelände-Oberkante y = −1, Erdgeschoss-Boden y = 0.

import {
  STONE, WOOD, window, doorway, hangingLantern, enchantingSetup, terrain, path, rock, vegetation, tree, bush,
} from '../lib/index.js';
import { hashPosition } from '../../core/random.js';
import { cylinder as cylinderCells, disc as discCells } from '../../core/shapes.js';

export const meta = {
  id: 'magierturm',
  title: 'Magierturm',
  category: 'fantasy',
  subtitle: 'Runder Zauberturm mit Außentreppe, Amethyst und schwebenden Felsen',
  tags: ['Fantasy', 'Turm', 'Magier', 'Zauberer', 'Tiefenschiefer', 'Schwarzstein', 'Amethyst', 'Zaubertisch', 'Schwebende Felsen', 'Wendeltreppe'],
  aliases: [
    'magierturm', 'magier turm', 'zauberturm', 'zauberer turm', 'zaubererturm', 'hexerturm', 'wizard tower', 'mage tower',
    'magic tower', 'sorcerer tower', 'magierturn', 'magiertum', 'zauberturn', 'turm mit zaubertisch', 'fantasy turm',
  ],
  accuracy: 'eigenes',
  description: 'Ein schlanker, runder Turm aus Tiefenschiefer- und Schwarzsteinziegeln mit spitzem Karmesin-Dach und Amethyst-Spitze. '
    + 'Innen liegen drei Geschosse: Brauküche, Schlaf- und Bibliotheksraum und ganz oben der hohe Zauberraum mit Zaubertisch '
    + '(Stufe 30) bis unter die Dachspitze. Eine Außentreppe windet sich um den Turm zur Tür des Zauberraums, '
    + 'ringsum wachsen Amethyst-Kristalle und vier Felsen schweben in der Luft.',
  sources: [],
  credits: null,
  tested: null,
};

const DEEP = STONE.tiefenschiefer;
const BLACK = STONE.schwarzstein;
const DARK = WOOD.schwarzeiche;
const ROOF = WOOD.karmesin;
const GLASS_PANE = 'purple_stained_glass_pane';

const R_WALL = 5;          // Außenradius der Mauer (Durchmesser 11)
const R_IN = 4;            // Innenraum
const FLOOR_Y = [0, 6, 12]; // Erdgeschoss, 1. Obergeschoss, Zauberraum
const WALL_TOP = 20;
const ROOF_Y = 21;
const ROOF_R = 7;
const ROOF_H = 15;
const LADDER = { x: -4, z: 0 };

const FACING_TO = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

// Zahl 0 … 1 aus der Position (unabhängig von der Reihenfolge).
function noise(x, y, z, salt) {
  return (hashPosition(x, y, z, salt) % 100000) / 100000;
}

// Himmelsrichtung von (x, z) zur Mitte (cx, cz), nach der stärkeren Achse.
function towardCenter(x, z, cx = 0, cz = 0) {
  const dx = cx - x;
  const dz = cz - z;
  if (Math.abs(dx) > Math.abs(dz) || (Math.abs(dx) === Math.abs(dz) && (x + z) % 2 === 0)) return dx > 0 ? 'east' : 'west';
  return dz > 0 ? 'south' : 'north';
}

function opposite(dir) {
  return { north: 'south', south: 'north', east: 'west', west: 'east' }[dir];
}

const stairs = (id, facing, half = 'bottom') => `${id}[facing=${facing},half=${half}]`;

// Winkel um die Turmmitte: 0° = Osten, 90° = Süden, 180° = Westen, 270° = Norden (im Uhrzeigersinn von oben).
function angleOf(x, z) {
  const a = (Math.atan2(z, x) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
}

function wallBlock(x, y, z) {
  if (y === 0 || FLOOR_Y.includes(y) || y === WALL_TOP) return BLACK.block;
  const n = noise(x, y, z, 11);
  if (n < 0.14) return DEEP.cracked;
  if (n < 0.24) return DEEP.tiles;
  return DEEP.block;
}

// Zellen im Innenraum, die direkt an der Mauer liegen.
function isByWall(x, z) {
  const inside = (a, b) => a * a + b * b <= (R_IN + 0.5) ** 2;
  if (!inside(x, z)) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inside(x + dx, z + dz));
}

export default function build(b) {
  b.phase('Gelände und Fundament');
  buildGround(b);
  buildFoundation(b);

  b.phase('Erdgeschoss-Mauer');
  buildWalls(b, 0, FLOOR_Y[1]);
  buildFloor(b, FLOOR_Y[1], DARK.planks);

  b.phase('Erster Stock');
  buildWalls(b, FLOOR_Y[1] + 1, FLOOR_Y[2]);
  buildMagicFloor(b);

  b.phase('Zauberraum-Mauer und Gesims');
  buildWalls(b, FLOOR_Y[2] + 1, WALL_TOP);
  buildCornice(b);

  b.phase('Spitzdach');
  buildSpire(b);

  b.phase('Außentreppe');
  const consoles = buildOuterStairs(b);

  b.phase('Konsolen und Gesimsbänder');
  for (const [x, y, z, state] of consoles) b.set(x, y, z, state);
  buildStringCourses(b);

  b.phase('Fenster und Türen');
  buildOpenings(b, true);
  buildBanners(b);

  b.phase('Einrichtung');
  b.step();
  furnishGroundFloor(b);
  b.step();
  furnishFirstFloor(b);
  b.step();
  furnishMagicRoom(b);
  b.step();
  lightTower(b);

  b.phase('Kristalle und schwebende Felsen');
  buildCrystals(b);
  buildFloatingRocks(b);

  b.phase('Umgebung');
  buildSurroundings(b);
}

// ---------------------------------------------------------------- Gelände und Fundament

function buildGround(b) {
  terrain(b, { x: -15, y: -4, z: -15, width: 31, depth: 31, height: 3, shape: 'rund', edge: 4, surface: 'gras', seed: 'magierturm' });
  // Die unterste Lage liegt frei: dort kein Kies, der herunterfallen würde.
  b.fill(-15, -4, -15, 15, -4, 15, 'stone', { replace: 'gravel' });
  removeLoneBlocks(b, -15, -4, -15, 15, -1, 15);
}

// Entfernt kleine, abgetrennte Stücke am ausgefransten Geländerand (Gruppen bis maxSize Blöcke).
// Jede Gruppe wird ganz durchsucht: bräche die Suche früh ab, wären Reste einer großen Gruppe später scheinbar klein.
function removeLoneBlocks(b, x1, y1, z1, x2, y2, z2, maxSize = 8) {
  const seen = new Set();
  const key = (x, y, z) => `${x},${y},${z}`;
  const inside = (x, y, z) => x >= x1 && x <= x2 && y >= y1 && y <= y2 && z >= z1 && z <= z2;
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (seen.has(key(x, y, z)) || b.get(x, y, z) === 'air') continue;
        const group = [[x, y, z]];
        seen.add(key(x, y, z));
        for (let i = 0; i < group.length; i++) {
          const [cx, cy, cz] = group[i];
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const n = [cx + dx, cy + dy, cz + dz];
            if (!inside(...n) || seen.has(key(...n)) || b.get(...n) === 'air') continue;
            seen.add(key(...n));
            group.push(n);
          }
        }
        if (group.length <= maxSize) for (const cell of group) b.remove(...cell);
      }
    }
  }
}

function buildFoundation(b) {
  discCells(0, -1, 0, 6, {}, (x, y, z) => b.set(x, y, z, DEEP.rough));
  discCells(0, 0, 0, R_IN, {}, (x, y, z) => {
    const d = Math.hypot(x, z);
    b.set(x, y, z, d > 2.5 && d <= 3.5 ? DEEP.tiles : DEEP.polished);
  });
  // Sockelring: volle Ziegel auf Ebene 1, Treppen (hohe Seite zur Mitte) auf Ebene 2.
  discCells(0, 0, 0, R_WALL + 1, { hollow: true }, (x, y, z) => {
    if (Math.hypot(x, z) <= R_WALL + 0.5) return;
    b.set(x, 0, z, BLACK.block);
    b.set(x, 1, z, stairs(BLACK.stairs, towardCenter(x, z)));
  });
}

// ---------------------------------------------------------------- Mauern, Böden, Öffnungen

function buildWalls(b, y1, y2) {
  cylinderCells(0, y1, 0, R_WALL, y2 - y1 + 1, { hollow: true }, (x, y, z) => b.set(x, y, z, wallBlock(x, y, z)));
  buildOpenings(b, false, y1, y2);
}

function buildFloor(b, y, block) {
  discCells(0, y, 0, R_IN, {}, (x, yy, z) => b.set(x, yy, z, block));
  b.set(LADDER.x, y, LADDER.z, 'air');
}

function buildMagicFloor(b) {
  const y = FLOOR_Y[2];
  discCells(0, y, 0, R_IN, {}, (x, yy, z) => {
    const d = Math.hypot(x, z);
    b.set(x, yy, z, d > 2.5 && d <= 3.5 ? 'amethyst_block' : DEEP.polished);
  });
  b.set(0, y, 0, BLACK.chiseled);
  b.set(LADDER.x, y, LADDER.z, 'air');
}

// Fenster und Türen. final = false: nur die Öffnungen frei lassen (beim Mauern), true: Glas, Rahmen und Türen.
const WINDOWS = [
  { x: 5, y: 2, z: 0, facing: 'east', height: 2, sill: false },
  { x: 0, y: 2, z: -5, facing: 'north', height: 2, sill: true },
  { x: 5, y: 8, z: 0, facing: 'east', height: 2, sill: true },
  { x: 0, y: 8, z: -5, facing: 'north', height: 2, sill: true },
  { x: 0, y: 8, z: 5, facing: 'south', height: 2, sill: true },
  { x: 5, y: 14, z: 0, facing: 'east', height: 3, sill: true },
  { x: -5, y: 14, z: 0, facing: 'west', height: 3, sill: true },
];
const ROUND_WINDOW = { x: 0, y: 15, z: 5, facing: 'south' };
const DOORS = [
  { x: 0, y: 1, z: 5, facing: 'south', step: true },
  { x: 0, y: 13, z: -5, facing: 'north', step: false },
];

function buildOpenings(b, final, y1 = -Infinity, y2 = Infinity) {
  for (const w of WINDOWS) {
    if (w.y > y2 || w.y + w.height - 1 < y1) continue;
    if (!final) {
      for (let k = 0; k < w.height; k++) b.set(w.x, w.y + k, w.z, 'air');
      continue;
    }
    window(b, {
      x: w.x, y: w.y, z: w.z, facing: w.facing, height: w.height, glass: GLASS_PANE, frame: BLACK.block,
      sill: w.sill ? BLACK.stairs : null,
    });
  }
  const rw = ROUND_WINDOW;
  if (!final && rw.y <= y2 && rw.y + 2 >= y1) {
    for (let k = 0; k < 3; k++) for (let dx = -1; dx <= 1; dx++) b.set(rw.x + dx, rw.y + k, rw.z, 'air');
  } else if (final) {
    window(b, { x: rw.x, y: rw.y, z: rw.z, facing: rw.facing, style: 'round', width: 3, glass: GLASS_PANE, stairs: BLACK.stairs });
  }
  for (const d of DOORS) {
    if (!final) {
      if (d.y <= y2 && d.y + 1 >= y1) { b.set(d.x, d.y, d.z, 'air'); b.set(d.x, d.y + 1, d.z, 'air'); }
      continue;
    }
    doorway(b, { x: d.x, y: d.y, z: d.z, facing: d.facing, door: DARK.door, frame: BLACK.polished, step: d.step ? BLACK.stairs : null });
    // Vor der Tür kein Sockel-Treppenstück im Weg.
    const [fx, fz] = FACING_TO[d.facing];
    if (d.step) b.set(d.x + fx, d.y, d.z + fz, 'air');
  }
}

// Violette Wandbanner neben dem Rundfenster und dem Ostfenster des Zauberraums.
function buildBanners(b) {
  for (const x of [-2, 2]) b.set(x, 18, R_WALL + 1, 'purple_wall_banner[facing=south]');
  for (const z of [-2, 2]) b.set(R_WALL + 1, 18, z, 'purple_wall_banner[facing=east]');
}

function buildCornice(b) {
  discCells(0, 0, 0, R_WALL + 1, { hollow: true }, (x, y, z) => {
    if (Math.hypot(x, z) <= R_WALL + 0.5) return;
    b.set(x, WALL_TOP - 1, z, stairs(BLACK.stairs, towardCenter(x, z), 'top'));
    b.set(x, WALL_TOP, z, BLACK.block);
  });
}

// Steiler Kegel: Ringe 2 dick; freiliegende Außenkanten als Treppen (hohe Seite zur Mitte).
function buildSpire(b) {
  const radiusAt = (k) => ROOF_R * (1 - k / ROOF_H);
  const top = ROOF_Y + ROOF_H - 1;
  for (let k = 0; k < ROOF_H; k++) {
    const r = radiusAt(k);
    const next = k + 1 < ROOF_H ? radiusAt(k + 1) : -1;
    const outer = (r + 0.5) ** 2;
    const inner = r >= 2 ? (r - 1.5) ** 2 : -1;
    const span = Math.ceil(r + 0.5);
    for (let z = -span; z <= span; z++) {
      for (let x = -span; x <= span; x++) {
        const d2 = x * x + z * z;
        if (d2 > outer || d2 <= inner) continue;
        const covered = next >= 0 && d2 <= (next + 0.5) ** 2;
        b.set(x, ROOF_Y + k, z, covered || (x === 0 && z === 0) ? ROOF.planks : stairs(ROOF.stairs, towardCenter(x, z)));
      }
    }
  }
  // Unter dem Überstand eine schräge Untersicht aus umgedrehten Treppen.
  discCells(0, 0, 0, ROOF_R, { hollow: true }, (x, y, z) => {
    if (Math.hypot(x, z) > R_WALL + 1.5 && b.get(x, ROOF_Y - 1, z) === 'air') b.set(x, ROOF_Y - 1, z, stairs(ROOF.stairs, towardCenter(x, z), 'top'));
  });
  b.set(0, top, 0, 'amethyst_block');
  b.set(0, top + 1, 0, 'amethyst_cluster[facing=up]');
}

// ---------------------------------------------------------------- Außentreppe

const STAIR_TURN = 270;           // Grad von Osten bis zur Tür im Norden
const HALF_STEPS = 26;            // 13 Blöcke in halben Schritten
const STEP_ANGLE = STAIR_TURN / HALF_STEPS;
const LANDING_END = 292;
const SPRUCE = WOOD.fichte;
const TREAD = SPRUCE.slab;

// Setzt Sockel, Stufen, Wange und Absatz; gibt die Konsolen [x, y, z, zustand] zurück (sie kommen im nächsten Kapitel unter die Stufen).
function buildOuterStairs(b) {
  const lanterns = new Set([6, 14, 22]);
  const lanternDone = new Set();
  const consoles = [];
  for (let z = -9; z <= 9; z++) {
    for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x, z);
      if (d <= R_WALL + 0.5 || d > 8.5) continue;
      const a = angleOf(x, z);
      if (a > LANDING_END) continue;
      const curb = d > 7.5;
      if (a >= STAIR_TURN) {
        landingCell(b, x, z, curb, a, consoles);
        continue;
      }
      const k = Math.floor(a / STEP_ANGLE);
      const s2 = k + 1;                    // Lauffläche in halben Blöcken über Ebene 1
      const y = Math.ceil(s2 / 2) - 1;
      if (curb) {
        b.set(x, y, z, SPRUCE.strippedWood);
        b.set(x, y + 1, z, SPRUCE.fence);
        if (lanterns.has(k) && !lanternDone.has(k) && Math.abs(z) + Math.abs(x) >= 8) {
          b.set(x, y + 2, z, 'lantern[hanging=false]');
          lanternDone.add(k);
        }
      } else {
        b.set(x, y, z, `${TREAD}[type=${s2 % 2 === 1 ? 'bottom' : 'top'}]`);
      }
      supportBelow(b, x, y, z, d, s2, consoles);
    }
  }
  return consoles;
}

function landingCell(b, x, z, curb, a, consoles) {
  const y = FLOOR_Y[2];
  if (curb || a > LANDING_END - 4) {
    b.set(x, y, z, SPRUCE.strippedWood);
    b.set(x, y + 1, z, SPRUCE.fence);
  } else {
    b.set(x, y, z, SPRUCE.planks);
  }
  if (b.get(x, y - 1, z) === 'air') consoles.push([x, y - 1, z, stairs(SPRUCE.stairs, towardCenter(x, z), 'top')]);
}

// Gesimsbänder auf Höhe der Böden: umgedrehte Treppen rund um den Turm, wo die Außentreppe nicht vorbeiführt.
function buildStringCourses(b) {
  for (const y of [FLOOR_Y[1], FLOOR_Y[2]]) {
    discCells(0, y, 0, R_WALL + 1, { hollow: true }, (x, yy, z) => {
      if (Math.hypot(x, z) <= R_WALL + 0.5 || b.get(x, yy, z) !== 'air' || b.get(x, yy + 1, z) !== 'air') return;
      b.set(x, yy, z, stairs(BLACK.stairs, towardCenter(x, z), 'top'));
    });
  }
}

// Unter den ersten Stufen ein gemauerter Sockel, weiter oben Konsolen unter der inneren Reihe und unter der Wange (nur vorgemerkt).
function supportBelow(b, x, y, z, d, s2, consoles) {
  if (s2 <= 6) {
    for (let yy = 0; yy < y; yy++) b.set(x, yy, z, BLACK.block);
    return;
  }
  if (y < 1) return;
  const inner = d <= 6.5;
  const curb = d > 7.5;
  if ((inner || curb) && b.get(x, y - 1, z) === 'air') consoles.push([x, y - 1, z, stairs(SPRUCE.stairs, towardCenter(x, z), 'top')]);
}

// ---------------------------------------------------------------- Einrichtung

function furnishGroundFloor(b) {
  const y = 1;
  b.set(-2, y, -4, 'barrel[facing=up]');
  b.set(-1, y, -4, BLACK.chiseled);
  b.set(-1, y + 1, -4, 'brewing_stand[has_bottle_0=true,has_bottle_1=false,has_bottle_2=true]');
  b.set(0, y, -4, 'water_cauldron[level=3]');
  b.set(1, y, -4, BLACK.chiseled);
  b.set(1, y + 1, -4, 'brewing_stand[has_bottle_0=true,has_bottle_1=true,has_bottle_2=false]');
  b.set(2, y, -4, 'barrel[facing=up]');
  b.set(-2, y + 1, -4, 'potted_crimson_fungus');
  b.set(2, y + 1, -4, 'potted_warped_fungus');
  for (let x = -2; x <= 2; x++) b.set(x, y + 2, -4, `${DARK.shelf}[facing=south]`);
  // Truhen im Osten, Kräuter und Lesepult im Westen und Süden.
  b.set(4, y, 1, 'chest[facing=west]');
  b.set(4, y, 2, 'chest[facing=west]');
  b.set(3, y, -3, 'barrel[facing=west]');
  b.set(3, y + 1, -3, 'potted_red_mushroom');
  b.set(-3, y, 3, 'lectern[facing=east,has_book=true]');
  b.set(-3, y, -3, 'crafting_table');
  b.set(-4, y, -2, 'barrel[facing=east]');
  b.set(-4, y + 1, -2, 'candle[candles=3,lit=true]');
  b.set(3, y, 3, 'decorated_pot[facing=north]');
  b.set(2, y, 4, 'potted_fern');
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) b.set(x, y, z, 'purple_carpet');
  b.set(0, y, 2, 'magenta_carpet');
  b.set(0, y, -2, 'magenta_carpet');
  b.set(2, y, 0, 'magenta_carpet');
  b.set(-2, y, 0, 'magenta_carpet');
  ladder(b, FLOOR_Y[0] + 1, FLOOR_Y[1]);
}

function ladder(b, y1, y2) {
  for (let y = y1; y <= y2; y++) b.set(LADDER.x, y, LADDER.z, 'ladder[facing=east]');
}

function furnishFirstFloor(b) {
  const y = FLOOR_Y[1] + 1;
  // Bücherregale an der Nordhälfte der Wand, das Nordfenster bleibt frei.
  for (let z = -R_IN; z <= -1; z++) {
    for (let x = -R_IN; x <= R_IN; x++) {
      if (!isByWall(x, z) || (x === LADDER.x && z === LADDER.z)) continue;
      if (Math.abs(x) <= 1 && z === -R_IN) continue;
      for (let k = 0; k < 3; k++) {
        const n = noise(x, y + k, z, 5);
        const facing = towardCenter(x, z);
        b.set(x, y + k, z, n < 0.3 ? `chiseled_bookshelf[facing=${facing},slot_0_occupied=true,slot_1_occupied=${n < 0.15},slot_2_occupied=true,slot_3_occupied=true,slot_4_occupied=false,slot_5_occupied=true]` : 'bookshelf');
      }
      b.set(x, y + 3, z, stairs(DARK.stairs, opposite(towardCenter(x, z)), 'top'));
    }
  }
  b.set(0, y, -R_IN, 'lectern[facing=south,has_book=true]');
  b.set(-1, y, -R_IN, 'candle[candles=2,lit=true]');
  b.set(1, y, -R_IN, 'potted_azure_bluet');
  // Bett mit Nachttisch im Osten.
  b.bed(3, y, 2, 'purple_bed', { facing: 'east' });
  b.set(4, y, 1, 'barrel[facing=up]');
  b.set(4, y + 1, 1, 'candle[candles=1,lit=true]');
  b.set(2, y, 2, 'chest[facing=west]');
  b.set(3, y, 3, 'purple_carpet');
  b.set(-2, y, 4, 'cartography_table');
  b.set(-3, y, 3, 'chest[facing=east]');
  b.set(-1, y, 4, `${DARK.stairs}[facing=south]`);
  for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x, y, z, 'gray_carpet');
  ladder(b, FLOOR_Y[1] + 1, FLOOR_Y[2]);
}

function furnishMagicRoom(b) {
  const y = FLOOR_Y[2] + 1;
  enchantingSetup(b, { x: 0, y, z: 0, facing: 'south' });
  b.set(3, y, 2, 'lectern[facing=west,has_book=true]');
  b.set(-3, y, 2, 'amethyst_block');
  b.set(-3, y + 1, 2, 'amethyst_cluster[facing=up]');
  b.set(2, y, 3, 'potted_wither_rose');
  b.set(-2, y, 3, 'decorated_pot[facing=north]');
  // Amethyst wächst aus der Wand: Kristalle hoch oben, mit der Spitze zur Raummitte.
  for (const [x, z] of [[3, -3], [-3, -3], [3, 3], [-3, 3], [4, -2], [-4, 2], [2, -4], [-2, 4]]) {
    const facing = towardCenter(x, z);
    const [dx, dz] = FACING_TO[opposite(facing)];
    const wy = 17 + (hashPosition(x, 0, z, 3) % 3);
    b.set(x + dx, wy, z + dz, 'budding_amethyst');
    b.set(x, wy, z, `amethyst_cluster[facing=${facing}]`);
  }
}

function lightTower(b) {
  hangingLantern(b, { x: 0, y: FLOOR_Y[1] - 1, z: 0, chain: 1 });
  hangingLantern(b, { x: 0, y: FLOOR_Y[2] - 1, z: 0, chain: 1 });
  // Langer Leuchter aus der Dachspitze: der Innenraum des Kegels ist in der Mitte bis Ebene 32 offen.
  let topAir = ROOF_Y;
  while (b.get(0, topAir + 1, 0) === 'air') topAir++;
  hangingLantern(b, { x: 0, y: topAir, z: 0, chain: topAir - 26 });
  hangingLantern(b, { x: 0, y: 25, z: 0, chain: 6 });
  // Wandlaternen an den Mauerkronen innen (stehen auf der Mauer unter dem Dach).
  for (const [x, z] of [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 3], [-4, -3], [3, -4], [-3, 4]]) {
    if (b.get(x, ROOF_Y, z) === 'air') b.set(x, ROOF_Y, z, 'lantern[hanging=false]');
  }
}

// ---------------------------------------------------------------- Kristalle, Felsen, Umgebung

const CRYSTAL_GROUPS = [
  { x: 9, z: -5, salt: 1 },
  { x: -9, z: 6, salt: 2 },
  { x: 5, z: 10, salt: 3 },
];

function buildCrystals(b) {
  for (const g of CRYSTAL_GROUPS) {
    const ground = -1;
    // Calcit-Rand und Basalt-Flecken im Gras.
    discCells(g.x, ground, g.z, 2, {}, (x, y, z) => {
      const n = noise(x, 0, z, g.salt);
      b.set(x, y, z, n < 0.55 ? 'calcite' : n < 0.8 ? 'smooth_basalt' : 'amethyst_block');
    });
    const pillars = [[0, 0, 3], [1, 0, 2], [0, 1, 1], [-1, 0, 2], [0, -1, 1]];
    for (const [dx, dz, h] of pillars) {
      const x = g.x + dx;
      const z = g.z + dz;
      const hh = h + (hashPosition(x, 1, z, g.salt) % 2);
      for (let k = 0; k < hh; k++) b.set(x, ground + 1 + k, z, k === 0 ? 'budding_amethyst' : 'amethyst_block');
      b.set(x, ground + 1 + hh, z, 'amethyst_cluster[facing=up]');
    }
    // Knospen an den Seiten der hohen Säule.
    for (const [dir, dx, dz] of [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]]) {
      const x = g.x + dx;
      const z = g.z + dz;
      for (let k = 2; k <= 3; k++) if (b.get(x, ground + k, z) === 'air') b.set(x, ground + k, z, `${k === 2 ? 'large_amethyst_bud' : 'medium_amethyst_bud'}[facing=${dir}]`);
    }
  }
}

const ROCKS = [
  { x: -12, y: 9, z: 6, r: 3, salt: 21, top: 'bush' },
  { x: 11, y: 15, z: -8, r: 3, salt: 22, top: 'crystal' },
  { x: -9, y: 24, z: -11, r: 2, salt: 23, top: 'lantern' },
  { x: 10, y: 28, z: 9, r: 2, salt: 24, top: 'grass' },
];

function buildFloatingRocks(b) {
  for (const rk of ROCKS) {
    b.step();
    floatingRock(b, rk);
  }
}

function floatingRock(b, { x: cx, y: cy, z: cz, r, salt, top }) {
  const depth = r * 2 + 1;
  const fill = ['stone', 'stone', 'andesite', 'tuff', 'cobblestone', 'deepslate'];
  for (let k = depth; k >= 0; k--) {
    const rr = k <= 1 ? r : r * (1 - (k - 1) / depth) ** 0.85;
    const span = Math.ceil(rr + 1);
    for (let z = -span; z <= span; z++) {
      for (let x = -span; x <= span; x++) {
        const jag = noise(cx + x, cy - k, cz + z, salt) * 0.9;
        if (Math.hypot(x, z) > rr + 0.5 - jag * (k <= 1 ? 0.6 : 1)) continue;
        const wx = cx + x;
        const wz = cz + z;
        let state;
        if (k === 0) state = 'grass_block';
        else if (k === 1) state = 'dirt';
        else state = fill[hashPosition(wx, cy - k, wz, salt + 7) % fill.length];
        b.set(wx, cy - k, wz, state);
      }
    }
  }
  // Unterseite: Wurzeln hängen aus der Erde.
  for (let z = -r; z <= r; z++) {
    for (let x = -r; x <= r; x++) {
      const wx = cx + x;
      const wz = cz + z;
      if (b.get(wx, cy - 1, wz) === 'dirt' && b.get(wx, cy - 2, wz) === 'air' && noise(wx, 0, wz, salt + 3) < 0.6) b.set(wx, cy - 2, wz, 'hanging_roots');
    }
  }
  if (top === 'bush') bush(b, { x: cx, y: cy + 1, z: cz, size: 'klein', leaves: 'azalee', seed: salt });
  else if (top === 'crystal') {
    b.set(cx, cy, cz, 'budding_amethyst');
    b.set(cx, cy + 1, cz, 'amethyst_block');
    b.set(cx, cy + 2, cz, 'amethyst_cluster[facing=up]');
    b.set(cx + 1, cy + 1, cz, 'large_amethyst_bud[facing=up]');
    b.set(cx - 1, cy + 1, cz, 'amethyst_cluster[facing=up]');
    b.set(cx, cy + 1, cz + 1, 'medium_amethyst_bud[facing=up]');
  } else if (top === 'lantern') {
    let low = cy;
    while (b.get(cx, low - 1, cz) !== 'air') low--;
    b.set(cx, low - 1, cz, 'iron_chain[axis=y]');
    b.set(cx, low - 2, cz, 'lantern[hanging=true]');
  }
  vegetation(b, { x: cx - r - 1, y: cy + 1, z: cz - r - 1, width: r * 2 + 3, depth: r * 2 + 3, mix: 'blumen', density: 0.45, scan: 2, seed: salt });
}

function buildSurroundings(b) {
  // follow: der Weg liegt auf dem Gelände und läuft am Rand mit ihm hinab (sonst stünde er dort als Klotz über dem Hang).
  path(b, { x: 0, y: -1, z: 7, facing: 'south', length: 8, width: 3, mix: 'kies', wiggle: 1, follow: true, seed: 4 });
  tree(b, { x: -11, y: 0, z: -7, species: 'fichte', size: 'mittel', seed: 3 });
  rock(b, { x: 11, y: 0, z: 4, size: 'klein', material: 'andesit', seed: 5 });
  rock(b, { x: -7, y: 0, z: 9, size: 'klein', material: 'stein', seed: 6 });
  bush(b, { x: 4, y: 0, z: -12, size: 'klein', leaves: 'fichte', seed: 7 });
  bush(b, { x: -12, y: 0, z: 1, size: 'klein', leaves: 'azalee', seed: 8 });
  vegetation(b, { x: -15, y: 0, z: -15, width: 31, depth: 31, mix: 'wiese', density: 0.3, seed: 9 });
}
