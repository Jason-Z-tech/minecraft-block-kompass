// Riesenpilz-Haus – ein großer roter Pilz als Wohnhaus: Stiel aus Pilzstiel-Blöcken, Hut aus rotem Pilzblock mit weißen Punkten.
// Eigenes Design. Mitte bei x = 0, z = 0; Gelände-Oberkante y = −1, Boden im Stiel y = 0.

import {
  WOOD, window, doorway, lightRoom, hangingLantern, terrain, path, vegetation, bush, rock,
} from '../lib/index.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'riesenpilz-haus',
  title: 'Riesenpilz-Haus',
  category: 'fantasy',
  subtitle: 'Wohnen in einem großen roten Pilz – mit Wendeltreppe und Pilzgarten',
  tags: ['Fantasy', 'Pilz', 'Pilzhaus', 'Märchen', 'Haus', 'Rund', 'Wendeltreppe', 'Garten', 'Fliegenpilz'],
  aliases: [
    'riesenpilz haus', 'riesenpilzhaus', 'pilzhaus', 'pilz haus', 'mushroom house', 'giant mushroom house', 'mushroom home',
    'fliegenpilz haus', 'fliegenpilzhaus', 'pilzhütte', 'schlumpfhaus', 'risenpilz haus', 'riesen pilz', 'märchenhaus pilz',
  ],
  accuracy: 'eigenes',
  description: 'Ein gemütliches Haus in einem riesigen roten Pilz. Im runden Stiel aus Pilzstiel-Blöcken liegt die Wohnküche mit zwei '
    + 'Rundfenstern, eine Wendeltreppe um einen Holzpfosten führt hinauf unter den großen Hut. Dort ist ein runder Schlafraum mit '
    + 'Fenstern im Hutrand. Ringsum wächst ein Pilzgarten mit kleinen Riesenpilzen, Pilzlicht und vielen Pilzen auf Podsol und Myzel.',
  sources: [],
  credits: null,
  tested: null,
};

const SPRUCE = WOOD.fichte;
const BIRCH = WOOD.birke;
const STEM = 'mushroom_stem';
const CAP = 'red_mushroom_block';
const R_STEM = 4;
const EG_CEILING = 7;
const OG_FLOOR = 8;
const CAP_R = 9.5;
const CAP_H = 7;
const SHELL = 1.3;
const FACES = [['north', 0, 0, -1], ['south', 0, 0, 1], ['west', -1, 0, 0], ['east', 1, 0, 0], ['up', 0, 1, 0], ['down', 0, -1, 0]];

function noise(x, y, z, salt) {
  return (hashPosition(x, y, z, salt) % 100000) / 100000;
}

const key = (x, y, z) => `${x},${y},${z}`;

// Setzt Pilzblöcke wie im Spiel: eine Seite ist Innenseite (false), wenn dort derselbe Pilzblock sitzt, sonst Außenhaut (true).
// plan = alle Pilzblöcke, die am Ende nebeneinander stehen (für die Seiten), cells = die jetzt zu setzenden.
function placeMushroom(b, cells, plan = cells) {
  for (const [k, id] of cells) {
    const [x, y, z] = k.split(',').map(Number);
    const props = FACES.map(([face, dx, dy, dz]) => `${face}=${plan.get(key(x + dx, y + dy, z + dz)) !== id}`).sort();
    b.set(x, y, z, `${id}[${props.join(',')}]`);
  }
}

function inCap(x, y, z, shrink = 0) {
  if (y < OG_FLOOR) return false;
  const r = CAP_R - shrink;
  const h = CAP_H - shrink;
  return (x * x + z * z) / (r * r) + ((y - OG_FLOOR) / h) ** 2 <= 1;
}

export default function build(b) {
  b.phase('Gelände');
  buildGround(b);

  b.phase('Stiel');
  const plan = new Map([...stemCells(), ...capCells()]);
  buildFloor(b);
  placeMushroom(b, stemCells(), plan);

  const cap = capCells();
  const underside = new Map([...cap].filter(([k]) => Number(k.split(',')[1]) === EG_CEILING));
  const capRest = new Map([...cap].filter(([k]) => Number(k.split(',')[1]) !== EG_CEILING));

  b.phase('Decke und Hutunterseite');
  buildCeiling(b);
  placeMushroom(b, underside, plan);

  b.phase('Hutrand und Kuppel');
  placeMushroom(b, capRest, plan);

  b.phase('Fenster, Tür und Treppe');
  buildOpenings(b);
  buildSpiralStairs(b);

  b.phase('Einrichtung');
  b.step();
  furnishGround(b);
  b.step();
  furnishUpper(b);
  b.step();
  lightHouse(b);

  b.phase('Pilzgarten');
  buildGarden(b);
}

// ---------------------------------------------------------------- Gelände

function buildGround(b) {
  terrain(b, { x: -14, y: -3, z: -14, width: 29, depth: 29, height: 2, shape: 'rund', edge: 3, surface: 'gras', seed: 'pilz' });
  for (let z = -14; z <= 14; z++) {
    for (let x = -14; x <= 14; x++) {
      if (b.get(x, -1, z).split('[')[0] !== 'grass_block') continue;
      const d = Math.hypot(x, z);
      const n = noise(x >> 1, 0, z >> 1, 3) * 0.6 + noise(x, 0, z, 4) * 0.4;
      if (d < 11 && n < 0.32) b.set(x, -1, z, 'podzol');
      else if (d < 9 && n > 0.78) b.set(x, -1, z, 'mycelium');
    }
  }
}

// ---------------------------------------------------------------- Stiel und Hut

function stemCells() {
  const cells = new Map();
  for (let y = 0; y < EG_CEILING; y++) {
    for (let z = -6; z <= 6; z++) {
      for (let x = -6; x <= 6; x++) {
        const d = Math.hypot(x, z);
        // Fuß unten breiter, darüber der Ring (wie beim Fliegenpilz) zwei Ebenen unter dem Hut.
        const outer = y === 0 || y === EG_CEILING - 2 ? R_STEM + 1.5 : R_STEM + 0.5;
        if (d > outer) continue;
        if (d > R_STEM - 0.5) cells.set(key(x, y, z), STEM);
      }
    }
  }
  // Öffnungen für Tür und Rundfenster bleiben frei.
  for (const k of [key(0, 1, 4), key(0, 2, 4)]) cells.delete(k);
  for (const x of [-4, 4]) for (let y = 2; y <= 4; y++) for (let z = -1; z <= 1; z++) cells.delete(key(x, y, z));
  return cells;
}

// Fußboden im Stiel (y = 0), Decke darüber (y = EG_CEILING) und Boden des Obergeschosses unter dem Hut (y = OG_FLOOR).
function buildFloor(b) {
  for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) if (Math.hypot(x, z) <= R_STEM - 0.5) b.set(x, 0, z, SPRUCE.planks);
}

function buildCeiling(b) {
  for (let z = -10; z <= 10; z++) {
    for (let x = -10; x <= 10; x++) {
      const d = Math.hypot(x, z);
      if (d <= R_STEM - 0.5) b.set(x, EG_CEILING, z, SPRUCE.planks);
      if (inCap(x, OG_FLOOR, z, SHELL)) b.set(x, OG_FLOOR, z, SPRUCE.planks);
    }
  }
}

// Hut ohne die Fensteröffnungen im Hutrand.
function capCells() {
  const cells = capShell();
  const { glass, open } = capWindows(cells);
  for (const [x, y, z] of [...glass, ...open]) cells.delete(key(x, y, z));
  return cells;
}

// Fenster im Hutrand: 3 breit, 2 hoch; die äußerste Schalenzelle wird Glas, dahinter bleibt es frei.
function capWindows(shell) {
  const glass = [];
  const open = [];
  for (const [dx, dz] of CAP_WINDOWS) {
    for (let y = OG_FLOOR + 1; y <= OG_FLOOR + 2; y++) {
      for (let s = -1; s <= 1; s++) {
        let first = true;
        for (let t = 10; t >= 6; t--) {
          const x = dx * t + (dz !== 0 ? s : 0);
          const z = dz * t + (dx !== 0 ? s : 0);
          if (!shell.has(key(x, y, z))) continue;
          (first ? glass : open).push([x, y, z]);
          first = false;
        }
      }
    }
  }
  return { glass, open };
}

// Hut: Unterseite auf y = EG_CEILING (über der Stielwand Pilzstiel), Rand eine Ebene tiefer, darüber die Kuppel mit Schale 1–2 dick.
function capShell() {
  const cells = new Map();
  for (let z = -10; z <= 10; z++) {
    for (let x = -10; x <= 10; x++) {
      const d = Math.hypot(x, z);
      if (d > CAP_R || d <= R_STEM - 0.5) continue;
      if (d <= R_STEM + 0.5) cells.set(key(x, EG_CEILING, z), STEM);
      else cells.set(key(x, EG_CEILING, z), CAP);
      if (d > CAP_R - 1) cells.set(key(x, EG_CEILING - 1, z), CAP);
    }
  }
  const dots = capDots();
  for (let y = OG_FLOOR; y <= OG_FLOOR + CAP_H; y++) {
    for (let z = -10; z <= 10; z++) {
      for (let x = -10; x <= 10; x++) {
        if (!inCap(x, y, z) || inCap(x, y, z, SHELL)) continue;
        const dot = dots.some(([dx, dy, dz]) => (x - dx) ** 2 + (y - dy) ** 2 + (z - dz) ** 2 <= 2.3);
        cells.set(key(x, y, z), dot ? STEM : CAP);
      }
    }
  }
  return cells;
}

// Mittelpunkte der weißen Punkte auf der Hutoberfläche: einer oben, darunter drei Ringe; der unterste liegt am steilen
// Hutrand zwischen den Fenstern (um 22,5° versetzt), damit der Pilz auch von vorne gepunktet ist.
function capDots() {
  const dots = [[0, OG_FLOOR + CAP_H, 0]];
  const rings = [[0.1, 8, Math.PI / 8], [0.3, 4, Math.PI / 4], [0.62, 6, 0]];
  for (const [elev, count, phase] of rings) {
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2;
      const horiz = Math.cos(elev * Math.PI / 2);
      const vert = Math.sin(elev * Math.PI / 2);
      dots.push([Math.round(Math.cos(a) * CAP_R * horiz), Math.round(OG_FLOOR + vert * CAP_H), Math.round(Math.sin(a) * CAP_R * horiz)]);
    }
  }
  return dots;
}

// ---------------------------------------------------------------- Öffnungen und Treppe

const CAP_WINDOWS = [[1, 0], [-1, 0], [0, -1], [0, 1]];

function buildOpenings(b) {
  for (const [x, facing] of [[4, 'east'], [-4, 'west']]) {
    window(b, { x, y: 2, z: 0, facing, style: 'round', width: 3, glass: 'glass_pane', stairs: BIRCH.stairs });
  }
  doorway(b, { x: 0, y: 1, z: R_STEM, facing: 'south', door: SPRUCE.door, frame: null, canopy: SPRUCE.stairs, step: SPRUCE.stairs });
  for (const [x, y, z] of capWindows(capShell()).glass) b.set(x, y, z, 'glass_pane');
}

function buildSpiralStairs(b) {
  b.spiralStairs(0, 0, 1, OG_FLOOR, 1, SPRUCE.stairs, { clockwise: true, core: `${SPRUCE.strippedLog}[axis=y]` });
  // Über den oberen Stufen braucht es zwei Blöcke Kopffreiheit: Decke und Obergeschoss-Boden dort öffnen.
  for (let z = -1; z <= 1; z++) {
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && z === 0) continue;
      for (let y = 1; y <= OG_FLOOR; y++) {
        if (!b.get(x, y, z).startsWith(SPRUCE.stairs)) continue;
        for (let k = 1; k <= 2; k++) if (y + k <= OG_FLOOR && y + k >= EG_CEILING) b.set(x, y + k, z, 'air');
      }
    }
  }
  b.set(0, OG_FLOOR + 1, 0, SPRUCE.fence);
  b.set(0, OG_FLOOR + 2, 0, 'lantern[hanging=false]');
}

// ---------------------------------------------------------------- Einrichtung

function furnishGround(b) {
  const y = 1;
  b.set(-1, y, -3, 'smoker[facing=south]');
  b.set(0, y, -3, 'furnace[facing=south]');
  b.set(1, y, -3, 'crafting_table');
  b.set(-2, y, -2, 'barrel[facing=up]');
  b.set(-2, y + 1, -2, 'potted_red_mushroom');
  b.set(2, y, -2, 'barrel[facing=up]');
  b.set(2, y + 1, -2, 'potted_brown_mushroom');
  for (const x of [-1, 0, 1]) b.set(x, y + 2, -3, `${SPRUCE.stairs}[facing=north,half=top]`);
  // Westen: Tisch mit Stuhl unter dem Rundfenster.
  b.set(-3, y, 0, SPRUCE.fence);
  b.set(-3, y + 1, 0, SPRUCE.pressurePlate);
  b.set(-3, y, 1, `${SPRUCE.stairs}[facing=south]`); // Stuhl: Lehne vom Tisch weg
  b.set(-3, y, -1, 'barrel[facing=east]');
  // Osten: Doppeltruhe und Bücherregal.
  b.set(3, y, -1, 'chest[facing=west]');
  b.set(3, y, 0, 'chest[facing=west]');
  b.set(3, y, 1, 'bookshelf');
  b.set(3, y + 1, 1, 'potted_crimson_fungus');
  b.set(2, y, 2, 'composter');
  b.set(-2, y, 2, 'potted_fern');
  for (const [x, z] of [[-1, 2], [1, 2], [0, 2], [-2, 1], [2, 1], [-2, -1], [2, -1], [-1, -2], [1, -2], [0, -2]]) {
    if (b.get(x, y, z) === 'air') b.set(x, y, z, 'red_carpet');
  }
}

function furnishUpper(b) {
  const y = OG_FLOOR + 1;
  b.bed(-1, y, -6, 'red_bed', { facing: 'north' });
  b.bed(0, y, -6, 'white_bed', { facing: 'north' });
  b.set(-2, y, -7, 'barrel[facing=up]');
  b.set(-2, y + 1, -7, 'candle[candles=2,lit=true]');
  b.set(1, y, -7, 'barrel[facing=up]');
  b.set(1, y + 1, -7, 'potted_red_mushroom');
  b.set(-1, y, -5, 'white_carpet');
  b.set(0, y, -5, 'red_carpet');
  // Bücherregale im Nordosten an der Hutwand.
  for (const [x, z, facing] of [[4, -6, 'south'], [5, -5, 'west'], [6, -4, 'west'], [3, -7, 'south']]) {
    b.set(x, y, z, 'bookshelf');
    b.set(x, y + 1, z, `chiseled_bookshelf[facing=${facing},slot_0_occupied=true,slot_1_occupied=true,slot_2_occupied=false,slot_3_occupied=true,slot_4_occupied=true,slot_5_occupied=false]`);
  }
  // Die Nischen hinter den Regalen zur Hutwand füllst du mit Regalen, damit dort kein dunkles Feld bleibt.
  b.set(5, y, -6, 'bookshelf');
  b.set(6, y, -5, 'bookshelf');
  b.set(4, y, -7, 'bookshelf');
  b.set(4, y, -3, 'lectern[facing=west,has_book=true]');
  // Runder Tisch mit Hockern im Südwesten, Truhe und Werkbank im Südosten.
  b.set(-4, y, 3, SPRUCE.fence);
  b.set(-4, y + 1, 3, 'moss_carpet');
  b.set(-5, y, 3, `${SPRUCE.slab}[type=bottom]`);
  b.set(-3, y, 3, `${SPRUCE.slab}[type=bottom]`);
  b.set(-4, y, 4, `${SPRUCE.slab}[type=bottom]`);
  b.set(5, y, 3, 'chest[facing=west]');
  b.set(5, y, 4, 'chest[facing=west]');
  b.set(-6, y, -2, 'potted_brown_mushroom');
  b.set(6, y, 0, 'potted_red_mushroom');
  b.set(-6, y, 2, 'composter');
  // Runder Teppich um die Treppe: innen weiß, außen rot.
  for (let z = -5; z <= 5; z++) {
    for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x, z);
      if (d <= 2.5 || d > 4.5 || b.get(x, y, z) !== 'air' || b.get(x, OG_FLOOR, z) === 'air') continue;
      b.set(x, y, z, d <= 3.5 ? 'white_carpet' : 'red_carpet');
    }
  }
  b.set(-6, y, 0, 'crafting_table');
  b.set(-6, y, 1, 'barrel[facing=east]');
  b.set(-6, y + 1, 1, 'potted_red_mushroom');
  b.set(6, y, -1, 'water_cauldron[level=2]');
  // Geländer um die Treppenöffnung (offene Seite dort, wo die Treppe oben ankommt).
  for (let z = -2; z <= 2; z++) {
    for (let x = -2; x <= 2; x++) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== 2) continue;
      const besideOpening = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
        const nx = x + dx;
        const nz = z + dz;
        return Math.max(Math.abs(nx), Math.abs(nz)) === 1 && b.get(nx, OG_FLOOR, nz) === 'air';
      });
      if (besideOpening && b.get(x, y, z) === 'air') b.set(x, y, z, SPRUCE.fence);
    }
  }
}

function lightHouse(b) {
  lightRoom(b, { x1: -3, y1: 1, z1: -3, x2: 3, y2: EG_CEILING - 1, z2: 3 });
  // Unter dem Hut: Laternen an Ketten von der Kuppel, je nach Höhe der Decke.
  for (const [x, z] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) {
    let top = OG_FLOOR + 1;
    while (b.get(x, top + 1, z) === 'air') top++;
    hangingLantern(b, { x, y: top, z, chain: Math.max(0, top - OG_FLOOR - 4) });
  }
}

// ---------------------------------------------------------------- Pilzgarten

function buildGarden(b) {
  b.step();
  brownMushroom(b, 9, -7);
  redMushroom(b, -10, 4);
  b.step();
  // follow: der Weg liegt auf dem Gelände und läuft am Rand mit ihm hinab.
  path(b, { x: 0, y: -1, z: 6, facing: 'south', length: 8, width: 2, mix: 'gemischt', wiggle: 1, follow: true, seed: 5 });
  for (const [x, z] of [[-2, 8], [2, 11]]) mushroomLamp(b, x, z);
  b.step();
  for (let z = -14; z <= 14; z++) {
    for (let x = -14; x <= 14; x++) {
      const ground = b.get(x, -1, z).split('[')[0];
      if ((ground !== 'podzol' && ground !== 'mycelium') || b.get(x, 0, z) !== 'air') continue;
      const n = noise(x, 1, z, 6);
      if (n < 0.22) b.set(x, 0, z, 'red_mushroom');
      else if (n < 0.4) b.set(x, 0, z, 'brown_mushroom');
    }
  }
  bush(b, { x: -7, y: 0, z: -8, size: 'klein', leaves: 'azalee', seed: 3 });
  bush(b, { x: 8, y: 0, z: 6, size: 'klein', leaves: 'eiche', seed: 4 });
  rock(b, { x: 6, y: 0, z: 9, size: 'klein', material: 'stein', seed: 5 });
  vegetation(b, { x: -14, y: 2, z: -14, width: 29, depth: 29, mix: 'wald', density: 0.35, seed: 7 });
  removeMushroomsOffSoil(b, -14, -3, -14, 14, 3, 14);
}

// Pilze halten bei Tageslicht nur auf Podsol und Myzel; der Bewuchs „wald“ setzt sie auch auf Gras – dort wieder entfernen.
function removeMushroomsOffSoil(b, x1, y1, z1, x2, y2, z2) {
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        const id = b.get(x, y, z).split('[')[0];
        if (id !== 'red_mushroom' && id !== 'brown_mushroom') continue;
        const below = b.get(x, y - 1, z).split('[')[0];
        if (below !== 'podzol' && below !== 'mycelium') b.remove(x, y, z);
      }
    }
  }
}

function brownMushroom(b, cx, cz) {
  const cells = new Map();
  for (let y = 0; y <= 3; y++) cells.set(key(cx, y, cz), STEM);
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      if (Math.abs(x) === 3 && Math.abs(z) === 3) continue;
      cells.set(key(cx + x, 4, cz + z), 'brown_mushroom_block');
    }
  }
  placeMushroom(b, cells);
  b.set(cx + 1, 3, cz, 'shroomlight');
  b.set(cx - 1, 3, cz, 'shroomlight');
}

function redMushroom(b, cx, cz) {
  const cells = new Map();
  for (let y = 0; y <= 3; y++) cells.set(key(cx, y, cz), STEM);
  for (let z = -2; z <= 2; z++) {
    for (let x = -2; x <= 2; x++) {
      if (Math.abs(x) <= 1 && Math.abs(z) <= 1) cells.set(key(cx + x, 4, cz + z), CAP);
      else if (Math.abs(x) !== 2 || Math.abs(z) !== 2) cells.set(key(cx + x, 3, cz + z), CAP);
    }
  }
  placeMushroom(b, cells);
  b.set(cx + 1, 3, cz, 'shroomlight');
}

function mushroomLamp(b, x, z) {
  const cells = new Map([[key(x, 0, z), STEM], [key(x, 1, z), STEM], [key(x, 3, z), CAP]]);
  placeMushroom(b, cells);
  b.set(x, 2, z, 'shroomlight');
}
