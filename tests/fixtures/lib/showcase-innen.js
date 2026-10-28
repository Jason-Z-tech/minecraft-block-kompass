// Schaukasten der Einrichtung (js/builds/lib/innen.js): sieben Räume mit Decke, beleuchtet mit lightRoom.
// Ansehen am besten mit Schnitt: node scripts/shot.mjs --module tests/fixtures/lib/showcase-innen.js --clip 4

import {
  bedroom, kitchen, diningTable, bookWall, storage, enchantingSetup, workshop, fireplace, lightRoom,
} from '../../../js/builds/lib/innen.js';
import { doorway, window, floorPattern } from '../../../js/builds/lib/bauteile.js';
import { WOOD } from '../../../js/builds/lib/palettes.js';

export const meta = {
  id: 'showcase-innen',
  title: 'Schaukasten Einrichtung',
  category: 'haeuser',
  subtitle: 'Alle Raumarten der Hilfsbibliothek',
  tags: ['Test', 'Bibliothek'],
  aliases: ['schaukasten einrichtung'],
  accuracy: 'eigenes',
  description: 'Schlafzimmer, Küche mit Esstisch, Bibliothek mit Zaubertisch, Lager, Werkstatt, Wohnzimmer mit Kamin und ein Elternschlafzimmer – jeder Raum mit lightRoom beleuchtet.',
  sources: [],
  credits: null,
  tested: null,
};

const ROOM_TOP = 4;
const spruce = WOOD.fichte;

// Raum mit Boden, Wänden und Decke; Innenraum x1..x2 × z1..z2, Luft y 1 … ROOM_TOP. Tür mittig in der Südwand.
function room(b, { x1, z1, x2, z2, floor, wall = spruce.planks }) {
  b.fill(x1 - 1, 0, z1 - 1, x2 + 1, 0, z2 + 1, 'stone_bricks');
  floor(x1, z1, x2, z2);
  b.walls(x1 - 1, 1, z1 - 1, x2 + 1, ROOM_TOP, z2 + 1, wall);
  for (const [x, z] of [[x1 - 1, z1 - 1], [x2 + 1, z1 - 1], [x1 - 1, z2 + 1], [x2 + 1, z2 + 1]]) b.fill(x, 1, z, x, ROOM_TOP, z, `${spruce.log}[axis=y]`);
  b.fill(x1 - 1, ROOM_TOP + 1, z1 - 1, x2 + 1, ROOM_TOP + 1, z2 + 1, spruce.slab);
  const doorX = Math.floor((x1 + x2) / 2);
  doorway(b, { x: doorX, y: 1, z: z2 + 1, facing: 'south', door: spruce.door, frame: null });
  window(b, { x: doorX - 2, y: 2, z: z2 + 1, facing: 'south', width: 1, height: 2 });
  window(b, { x: doorX + 2, y: 2, z: z2 + 1, facing: 'south', width: 1, height: 2 });
  return { x1, y1: 1, z1, x2, y2: ROOM_TOP, z2 };
}

const planksFloor = (b, id) => (x1, z1, x2, z2) => b.fill(x1, 0, z1, x2, 0, z2, id);
const patternFloor = (b, pattern, blocks) => (x1, z1, x2, z2) => floorPattern(b, { x: x1, y: 0, z: z1, width: x2 - x1 + 1, depth: z2 - z1 + 1, pattern, blocks });

export default function build(b) {
  b.phase('Räume');
  const rooms = {
    bed: room(b, { x1: 1, z1: 1, x2: 7, z2: 6, floor: patternFloor(b, 'border', [spruce.planks, WOOD.schwarzeiche.planks]) }),
    kitchen: room(b, { x1: 10, z1: 1, x2: 16, z2: 6, floor: patternFloor(b, 'checker', ['polished_andesite', 'polished_diorite']) }),
    library: room(b, { x1: 19, z1: 1, x2: 27, z2: 8, floor: patternFloor(b, 'herringbone', [WOOD.schwarzeiche.log, spruce.log]) }),
    storage: room(b, { x1: 30, z1: 1, x2: 35, z2: 5, floor: planksFloor(b, 'cobblestone') }),
    workshop: room(b, { x1: 1, z1: 11, x2: 8, z2: 15, floor: planksFloor(b, 'spruce_planks') }),
    living: room(b, { x1: 11, z1: 11, x2: 19, z2: 17, floor: patternFloor(b, 'rings', [WOOD.eiche.planks, WOOD.birke.planks]) }),
    parents: room(b, { x1: 22, z1: 11, x2: 28, z2: 16, floor: planksFloor(b, WOOD.kirsche.planks) }),
  };

  b.phase('Einrichtung');
  b.step();
  bedroom(b, { x: 1, y: 1, z: 1, width: 7, depth: 6 });
  b.step();
  kitchen(b, { x: 10, y: 1, z: 1, width: 7 });
  diningTable(b, { x: 12, y: 1, z: 4, length: 3, width: 1 });
  b.step();
  bookWall(b, { x: 19, y: 1, z: 1, width: 9, height: 3, ladder: true });
  enchantingSetup(b, { x: 23, y: 1, z: 5 });
  b.step();
  storage(b, { x: 30, y: 1, z: 1, width: 6, height: 2 });
  storage(b, { x: 30, y: 1, z: 5, facing: 'east', width: 4, height: 2, barrel: false });
  b.step();
  workshop(b, { x: 1, y: 1, z: 11, width: 8 });
  b.step();
  fireplace(b, { x: 15, y: 1, z: 11, height: 4 });
  diningTable(b, { x: 13, y: 1, z: 15, length: 5, width: 1, top: 'carpet', cloth: 'rot', headChairs: false, wood: 'schwarzeiche' });
  bookWall(b, { x: 11, y: 1, z: 17, facing: 'east', width: 3, height: 2, crown: false, chiseled: true });
  b.step();
  bedroom(b, { x: 22, y: 1, z: 11, width: 7, depth: 6, double: true, color: 'blau', rug: 'hellgrau', wood: 'kirsche' });

  b.phase('Licht');
  for (const box of Object.values(rooms)) lightRoom(b, box);
}
