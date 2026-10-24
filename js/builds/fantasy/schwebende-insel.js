// Schwebende Insel – Insel mit zerklüfteter Unterseite, Fachwerkhäuschen, Eiche, Teich und Wasserfall über die Kante.
// Eigenes Design. Oberfläche der Insel auf y = 0, Mitte bei x = 0, z = 0; die Unterseite hängt bis etwa y = −17 hinunter.

import {
  WOOD, timberWall, window, doorway, chimney, lampPost, lightRoom, tree, bush, vegetation, pond, pathAlong, rock,
} from '../lib/index.js';
import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'schwebende-insel',
  title: 'Schwebende Insel',
  category: 'fantasy',
  subtitle: 'Fliegende Insel mit Fachwerkhäuschen, Eiche, Teich und Wasserfall',
  tags: ['Fantasy', 'Insel', 'Schwebend', 'Fliegend', 'Himmel', 'Wasserfall', 'Teich', 'Fachwerk', 'Häuschen', 'Erz', 'Ranken'],
  aliases: [
    'schwebende insel', 'fliegende insel', 'himmelsinsel', 'floating island', 'sky island', 'flying island', 'skyblock insel',
    'schwebeinsel', 'insel in der luft', 'schwebende insle', 'schwebende inzel', 'luftinsel', 'insel mit wasserfall',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Eine Insel schwebt hoch in der Luft: unten läuft sie kegelförmig und zerklüftet aus Stein mit Erzadern, Tropfstein, '
    + 'Leuchtbeeren und hängenden Wurzeln aus, oben wachsen Gras, Blumen und eine große Eiche auf einem kleinen Hügel. Am Rand steht '
    + 'ein Fachwerkhäuschen mit Schornstein, daneben ein Teich, dessen Wasser durch eine Rinne über die Kante stürzt.',
  facts: [
    'Insel etwa 27 × 23 Blöcke, Unterseite bis 18 Blöcke tief.',
    'Gebaut wird von oben nach unten: erst die Oberfläche auf einer Hilfssäule, dann Lage für Lage die Unterseite.',
    'Der Wasserfall entsteht im Spiel von selbst: du setzt nur Wasserquellen in die Rinne, die letzte direkt an der Kante.',
    'Das Häuschen ist 7 × 7 Blöcke groß, innen 5 × 5 mit Bett, Kochecke, Tisch und Truhe.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const OAK = WOOD.eiche;
const SPRUCE = WOOD.fichte;
const DARK = WOOD.schwarzeiche;
const RX = 13;
const RZ = 11;
const HOUSE = { x0: -9, x1: -3, z0: 0, z1: 6 };
const POND = { x: 2, z: -4, width: 7, depth: 6 };
const CHANNEL_Z = -1;
const HILL = { x: -3, z: -6, rx: 5, rz: 4, height: 2 };

function noise(x, y, z, salt) {
  return (hashPosition(x, y, z, salt) % 100000) / 100000;
}

// Form der Insel: Ellipse mit welligem Rand → rho 0 (Mitte) … 1 (Rand).
function rhoAt(x, z) {
  const theta = Math.atan2(z / RZ, x / RX);
  const wobble = 1 + 0.07 * Math.sin(3 * theta + 1) + 0.05 * Math.sin(5 * theta + 2.3);
  return Math.hypot(x / RX, z / RZ) / wobble;
}

function isFlatZone(x, z) {
  const inHouse = x >= HOUSE.x0 - 1 && x <= HOUSE.x1 + 1 && z >= HOUSE.z0 - 1 && z <= HOUSE.z1 + 2;
  const inPond = x >= POND.x - 1 && x < POND.x + POND.width + 1 && z >= POND.z - 1 && z < POND.z + POND.depth + 1;
  const inChannel = x >= POND.x && z >= CHANNEL_Z - 1 && z <= CHANNEL_Z + 1;
  return inHouse || inPond || inChannel;
}

function topAt(x, z, rho) {
  if (isFlatZone(x, z)) return 0;
  let top = 0;
  const h = Math.hypot((x - HILL.x) / HILL.rx, (z - HILL.z) / HILL.rz);
  if (h < 1) top += Math.round(HILL.height * (1 - h * h) + 0.3);
  if (rho > 0.93) top -= 1;
  return top;
}

// Tiefe der Unterseite: Kegel zur Mitte hin, zerklüftet durch Rauschen.
function bottomAt(x, z, rho, top) {
  const cone = 1 + 16 * Math.max(0, 1 - rho) ** 1.5;
  const jag = noise(x, 0, z, 7) * 2.5 + noise(x >> 1, 1, z >> 1, 8) * 3 * Math.min(1, rho * 1.6);
  return top - Math.round(cone + jag);
}

function islandColumns() {
  const cols = [];
  for (let z = -RZ - 2; z <= RZ + 2; z++) {
    for (let x = -RX - 2; x <= RX + 2; x++) {
      const rho = rhoAt(x, z);
      if (rho > 1) continue;
      const top = topAt(x, z, rho);
      cols.push({ x, z, rho, top, bottom: bottomAt(x, z, rho, top) });
    }
  }
  return cols;
}

function underBlock(x, y, z, depthBelowTop, rho, minBottom) {
  const dirtDepth = rho > 0.85 ? 1 : rho > 0.7 ? 2 : 3;
  if (depthBelowTop <= dirtDepth) return noise(x, y, z, 3) < 0.12 ? 'coarse_dirt' : 'dirt';
  if (y - minBottom <= 3) return noise(x, y, z, 4) < 0.5 ? 'deepslate' : 'cobbled_deepslate';
  const n = noise(x, y, z, 5);
  if (n < 0.06) return 'coal_ore';
  if (n < 0.1) return 'iron_ore';
  if (n < 0.13) return 'copper_ore';
  if (n < 0.25) return 'andesite';
  if (n < 0.33) return 'tuff';
  if (n < 0.38) return 'cobblestone';
  return 'stone';
}

export default function build(b) {
  const cols = islandColumns();
  const minBottom = Math.min(...cols.map((c) => c.bottom));

  b.phase('Oberfläche', 'Eine schwebende Insel baust du von oben nach unten. Bau zuerst eine Hilfssäule aus Erde bis zur gewünschten Höhe '
    + 'und leg dann die Grasfläche (etwa 27 × 23 Blöcke, Ellipse mit welligem Rand) in die Luft. Im Nordwesten steigt ein kleiner '
    + 'Hügel 2 Blöcke an, der Rand fällt an manchen Stellen eine Stufe ab.', {
    tips: [
      'Lege erst eine Kreuzlinie durch die Mitte (27 Blöcke Ost–West, 23 Nord–Süd) und arbeite dich von dort nach außen.',
      'Unter dem Gras kommt später Erde – du kannst die Grasblöcke auch erst ganz zum Schluss mit Gras überziehen lassen.',
    ],
  });
  b.step('Grasfläche und Hügel', 'Die oberste Lage aus Grasblöcken, auf dem Hügel mit Erde darunter.');
  for (const c of cols) for (let y = c.top; y >= Math.min(c.top, 0); y--) b.set(c.x, y, c.z, y === c.top ? 'grass_block' : 'dirt');

  b.phase('Unterseite', 'Jetzt arbeitest du dich Lage für Lage nach unten. Stell dich auf die Insel, schleich an den Rand und setz die '
    + 'Blöcke an die Unterseite. Unter dem Gras liegen 2–3 Lagen Erde, darunter Stein mit Andesit, Tuff, Bruchstein und ein paar Erzen '
    + '(Kohle, Eisen, Kupfer). Jede Lage ist etwas kleiner als die darüber, die Spitze ganz unten ist aus Tiefenschiefer.', {
    tips: [
      'Mit Schleichen (Shift) fällst du nicht von der Kante und kannst Blöcke unter dir setzen.',
      'Die Unterseite soll zerklüftet aussehen: lass ruhig einzelne Zapfen 2–3 Blöcke tiefer hängen.',
    ],
  });
  const maxUnder = -1;
  for (let y = maxUnder; y >= minBottom; y--) {
    const layer = cols.filter((c) => c.bottom <= y && c.top > y);
    if (layer.length === 0) continue;
    b.step(`Lage ${-y} unter der Oberfläche`, layerText(y, layer.length));
    for (const c of layer) b.set(c.x, y, c.z, underBlock(c.x, y, c.z, c.top - y, c.rho, minBottom));
  }

  b.phase('Teich und Wasserfall', 'Im Osten liegt ein Teich (7 × 6) mit gemischtem Ufer, Seerosen und Schilf. Von seinem Ostrand führt eine '
    + 'Rinne bis an die Inselkante. Füll Teich und Rinne nur mit Wasserquellen – die letzte Quelle sitzt direkt an der Kante, dort läuft '
    + 'das Wasser im Spiel von selbst hinunter und bildet den Wasserfall.', {
    tips: ['Ein Wassereimer macht eine Quelle. Zwei Quellen nebeneinander und ein Eimer daraus ergeben eine unendliche Wasserquelle.'],
  });
  buildPond(b);

  b.phase('Häuschen: Fundament und Fachwerk', 'Im Südwesten steht ein Fachwerkhäuschen von 7 × 7 Blöcken. Leg das Fundament aus Bruchstein '
    + 'und bemoostem Bruchstein in die Grasschicht, innen einen Boden aus Fichtenbrettern. Darauf kommen vier Fachwerkwände, 5 Blöcke hoch: '
    + 'Rahmen aus geschältem Schwarzeichenstamm (Schwelle, Rähm und Ständer alle 3 Blöcke), die Felder dazwischen aus hellem Calcit.', {
    tips: ['Setze zuerst die vier Eckpfosten und die Ständer alle 3 Blöcke, dann die Schwelle unten und den Rähm oben, zuletzt die Felder.'],
  });
  buildHouseShell(b);

  b.phase('Häuschen: Dach', 'Das Satteldach aus Schwarzeichentreppen hat den First in Ost-West-Richtung und steht 1 Block über. Die Giebel im Osten '
    + 'und Westen füllst du mit Schwarzeichenbrettern. Am Westgiebel steigt ein Schornstein aus Bruchstein mit einem Lagerfeuer obenauf.', {
    tips: ['Schau beim Setzen der Dachtreppen zum First – dann zeigt die hohe Seite automatisch nach innen.'],
  });
  buildHouseRoof(b);

  b.phase('Häuschen: Fenster und Tür', 'Setz die Fenster mit Fensterläden aus Fichtenfalltüren und Blumenkästen, im Osten die Fichtentür mit '
    + 'einem kleinen Vordach und daneben eine Laterne.');
  buildHouseOpenings(b);

  b.phase('Häuschen: Einrichtung', 'Innen ist Platz für ein Bett in der Nordwestecke mit Nachttisch, eine Kochecke mit Ofen und Räucherofen, '
    + 'einen kleinen Tisch (Zaun mit Druckplatte) mit zwei Stühlen aus Treppen – die Lehne zeigt jeweils vom Tisch weg –, Truhe und '
    + 'Bücherregal. Häng zum Schluss eine Laterne an die Decke.');
  furnishHouse(b);

  b.phase('Baum, Garten und Weg', 'Auf dem Hügel wächst eine große Eiche. Vom Haus führt ein Trampelpfad zum Teich, dazu ein paar Büsche, '
    + 'ein bemooster Fels, Gras und Blumen.', {
    tips: ['Große Bäume baust du am einfachsten selbst: Stamm, ein paar Äste aus Eichenholz und darum Laub – oder du pflanzt einen Setzling und düngst ihn.'],
  });
  buildGarden(b);

  b.phase('Ranken und Hängendes', 'Zum Schluss wird die Unterseite lebendig: an der Inselkante hängen Ranken herab, unter der Insel '
    + 'Höhlenranken mit Leuchtbeeren, Hängende Wurzeln und an der Spitze Tropfsteinzapfen.', {
    tips: ['Tropfstein hängt nur unter einem festen Block. Setz zuerst den dicken Teil oben an und dann die Spitze darunter.'],
  });
  buildHanging(b, cols);
}

function layerText(y, count) {
  if (y === -1) return `Direkt unter dem Gras: ${count} Blöcke, vor allem Erde.`;
  if (y >= -3) return `Noch eine Lage Erde und am Rand schon Stein (${count} Blöcke).`;
  return `${count} Blöcke Stein, Andesit, Tuff und Erz.`;
}

// ---------------------------------------------------------------- Teich und Rinne

function buildPond(b) {
  pond(b, { x: POND.x, y: 0, z: POND.z, width: POND.width, depth: POND.depth, facing: 'west', waterDepth: 2, shore: 'gemischt', seed: 3 });
  // Rinne von der Teichmitte bis an die Kante.
  let x = POND.x + 3;
  while (b.get(x, 0, CHANNEL_Z) !== 'air' && rhoAt(x, CHANNEL_Z) <= 1) {
    b.set(x, 0, CHANNEL_Z, 'water[level=0]');
    for (const dz of [-1, 1]) {
      const id = b.get(x, 0, CHANNEL_Z + dz);
      if (id === 'air' || id.startsWith('sugar_cane')) continue;
      if (!id.startsWith('water')) b.set(x, 0, CHANNEL_Z + dz, noise(x, 0, dz, 9) < 0.5 ? 'mossy_cobblestone' : 'cobblestone');
    }
    if (b.get(x, 1, CHANNEL_Z) !== 'air') b.remove(x, 1, CHANNEL_Z);
    x++;
  }
  b.note(x - 1, 0, CHANNEL_Z, 'Letzte Wasserquelle an der Kante: Hier stürzt das Wasser im Spiel von selbst als Wasserfall hinunter.');
}

// ---------------------------------------------------------------- Häuschen

function buildHouseShell(b) {
  const { x0, x1, z0, z1 } = HOUSE;
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      b.set(x, 0, z, edge ? (noise(x, 0, z, 2) < 0.35 ? 'mossy_cobblestone' : 'cobblestone') : SPRUCE.planks);
    }
  }
  const wall = { length: 7, height: 5, frame: DARK.strippedLog, fill: 'calcite', pattern: 'plain', spacing: 3 };
  timberWall(b, { x: x0, y: 1, z: z1, facing: 'south', ...wall });
  timberWall(b, { x: x1, y: 1, z: z0, facing: 'north', ...wall });
  timberWall(b, { x: x0, y: 1, z: z0, facing: 'west', ...wall });
  timberWall(b, { x: x1, y: 1, z: z1, facing: 'east', ...wall });
}

function buildHouseRoof(b) {
  const { x0, x1, z0, z1 } = HOUSE;
  b.roof({ x1: x0, z1: z0, x2: x1, z2: z1, y: 5, type: 'gable', axis: 'x', stairs: DARK.stairs, slab: DARK.slab, full: DARK.planks, overhang: 1 });
  chimney(b, { x: x0 - 1, y: 0, z: 1, height: 10, block: 'cobblestone', smoke: 'normal', rim: 'cobblestone_stairs', facing: 'west' });
}

function buildHouseOpenings(b) {
  const { x0, x1, z0, z1 } = HOUSE;
  const box = { trapdoor: SPRUCE.trapdoor, soil: 'rooted_dirt', flowers: ['poppy', 'cornflower', 'oxeye_daisy', 'allium'] };
  window(b, { x: x0 + 1, y: 2, z: z1, facing: 'south', width: 2, height: 2, shutters: SPRUCE.trapdoor, flowerBox: box });
  window(b, { x: x0 + 4, y: 2, z: z1, facing: 'south', width: 2, height: 2, shutters: SPRUCE.trapdoor, flowerBox: box });
  window(b, { x: x1 - 4, y: 2, z: z0, facing: 'north', width: 2, height: 2, shutters: SPRUCE.trapdoor });
  window(b, { x: x0, y: 6, z: 3, facing: 'west', width: 1, height: 2 });
  window(b, { x: x1, y: 7, z: 3, facing: 'east', width: 1, height: 1 });
  doorway(b, { x: x1, y: 1, z: 3, facing: 'east', door: SPRUCE.door, frame: null, canopy: DARK.stairs });
  lampPost(b, { x: x1 + 1, y: 1, z: 5, height: 2, post: SPRUCE.fence, style: 'top' });
}

function furnishHouse(b) {
  const y = 1;
  b.bed(-8, y, 2, 'red_bed', { facing: 'north' });
  b.set(-7, y, 1, 'barrel[facing=up]');
  b.set(-7, y + 1, 1, 'candle[candles=2,lit=true]');
  b.set(-8, y, 5, 'furnace[facing=east]');
  b.set(-8, y, 4, 'smoker[facing=east]');
  b.set(-7, y, 5, 'crafting_table');
  b.set(-8, y + 2, 4, `${SPRUCE.stairs}[facing=west,half=top]`);
  b.set(-8, y + 2, 5, `${SPRUCE.stairs}[facing=west,half=top]`);
  b.set(-6, y, 3, SPRUCE.fence);
  b.set(-6, y + 1, 3, SPRUCE.pressurePlate);
  // Stühle: die hohe Seite (Lehne) zeigt vom Tisch weg.
  b.set(-6, y, 2, `${SPRUCE.stairs}[facing=north]`);
  b.set(-6, y, 4, `${SPRUCE.stairs}[facing=south]`);
  b.set(-4, y, 1, 'chest[facing=west]');
  b.set(-4, y, 5, 'bookshelf');
  b.set(-4, y + 1, 5, 'potted_red_tulip');
  b.set(-5, y, 1, 'barrel[facing=up]');
  for (const [x, z] of [[-7, 3], [-6, 3], [-5, 3], [-7, 2], [-5, 2], [-7, 4], [-5, 4]]) if (b.get(x, y, z) === 'air') b.set(x, y, z, 'green_carpet');
  lightRoom(b, { x1: -8, y1: 1, z1: 1, x2: -4, y2: 6, z2: 5 });
}

// ---------------------------------------------------------------- Garten

function buildGarden(b) {
  tree(b, { x: HILL.x, y: 3, z: HILL.z, species: 'eiche', size: 'gross', seed: 11 });
  pathAlong(b, { y: 0, points: [[HOUSE.x1 + 1, 3], [-1, 2], [1, 1]], width: 2, mix: 'erde', wiggle: 0, seed: 4 });
  bush(b, { x: HOUSE.x0 - 1, y: 1, z: HOUSE.z1 + 1, size: 'klein', leaves: 'azalee', seed: 7 });
  bush(b, { x: 8, y: 1, z: 5, size: 'klein', leaves: 'eiche', seed: 8 });
  bush(b, { x: -9, y: 1, z: -4, size: 'klein', leaves: 'birke', seed: 9 });
  rock(b, { x: 5, y: 1, z: 6, size: 'klein', material: 'andesit', seed: 10 });
  vegetation(b, { x: -RX, y: 4, z: -RZ, width: RX * 2 + 1, depth: RZ * 2 + 1, mix: 'blumen', density: 0.3, seed: 12 });
}

// ---------------------------------------------------------------- Ranken, Wurzeln, Tropfstein

const SIDES = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];

function buildHanging(b, cols) {
  b.step('Ranken an der Kante', 'An den Inselrand kommen Ranken, die 2–6 Blöcke an der Felswand hinunterhängen.');
  for (const c of cols) {
    if (c.rho < 0.82) continue;
    for (const [face, dx, dz] of SIDES) {
      const ax = c.x + dx;
      const az = c.z + dz;
      if (noise(ax, 0, az, 31) > 0.35) continue;
      const startY = c.top - 1;
      if (b.get(ax, startY, az) !== 'air' || b.get(c.x, startY, c.z) === 'air') continue;
      const length = 2 + (hashPosition(ax, 1, az, 32) % 5);
      const attach = { north: 'south', south: 'north', west: 'east', east: 'west' }[face];
      for (let k = 0; k < length; k++) {
        const y = startY - k;
        if (b.get(ax, y, az) !== 'air') break;
        b.set(ax, y, az, `vine[${attach}=true]`);
      }
    }
  }
  b.step('Unter der Insel', 'Unter der Insel hängen Höhlenranken (mit Leuchtbeeren), Hängende Wurzeln und an der tiefsten Stelle Tropfsteinzapfen.');
  for (const c of cols) {
    const below = c.bottom - 1;
    if (b.get(c.x, below, c.z) !== 'air') continue;
    const n = noise(c.x, 2, c.z, 33);
    if (c.rho < 0.35 && n < 0.55) dripstone(b, c.x, below, c.z, 1 + (hashPosition(c.x, 3, c.z, 34) % 3));
    else if (c.rho >= 0.35 && c.rho < 0.75 && n < 0.18) caveVines(b, c.x, below, c.z, 2 + (hashPosition(c.x, 4, c.z, 35) % 4));
    else if (c.rho >= 0.5 && n > 0.86) b.set(c.x, below, c.z, 'hanging_roots');
  }
}

// Tropfstein nach unten: oben dick (base/middle), unten die Spitze (tip), wie im Spiel.
function dripstone(b, x, y, z, length) {
  const shape = length === 1 ? ['tip'] : length === 2 ? ['frustum', 'tip'] : ['base', ...Array(length - 3).fill('middle'), 'frustum', 'tip'];
  b.set(x, y + 1, z, 'dripstone_block');
  shape.forEach((thickness, k) => b.set(x, y - k, z, `pointed_dripstone[thickness=${thickness},vertical_direction=down]`));
}

function caveVines(b, x, y, z, length) {
  for (let k = 0; k < length; k++) {
    const berries = hashPosition(x, y - k, z, 36) % 3 === 0;
    const last = k === length - 1;
    b.set(x, y - k, z, last ? `cave_vines[age=25,berries=${berries}]` : `cave_vines_plant[berries=${berries}]`);
  }
}
