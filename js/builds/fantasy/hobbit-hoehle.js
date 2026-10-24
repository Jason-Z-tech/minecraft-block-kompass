// Hobbit-Höhle – nachempfunden nach Beutelsend (Bag End) aus „Der Hobbit“ und „Der Herr der Ringe“.
// Aufbau: erst das Holzgerüst der Räume (Hülle), dann wird es mit Erde zu einem Hügel überdeckt, danach Tür,
// Fenster, Einrichtung und Garten. Lokal: Vorderseite (Tür, Garten) im Süden (+z), Hügel nach Norden.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, wallLantern, hangingLantern, chimney, floorPattern, gardenFence, lampPost,
  bedroom, kitchen, diningTable, bookWall, storage, fireplace, lightRoom,
  terrain, tree, bush, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'hobbit-hoehle',
  title: 'Hobbit-Höhle',
  category: 'fantasy',
  subtitle: 'Gemütliches Hobbit-Loch im Grashügel mit runder grüner Tür',
  tags: ['Hobbit', 'Auenland', 'Herr der Ringe', 'Tolkien', 'Hügel', 'Erdhaus', 'Garten', 'Gemüsebeet', 'Rundfenster', 'Gemütlich'],
  aliases: [
    'hobbit hoehle', 'hobbithoehle', 'hobbit höhle', 'hobbithöhle', 'hobbit loch', 'hobbitloch', 'hobbit hole', 'hobbit house',
    'hobbithaus', 'hobbit haus', 'beutelsend', 'bag end', 'bagend', 'beutelsend auenland', 'auenland haus', 'shire house',
    'hobbingen', 'hobbiton', 'bilbo', 'frodo', 'erdhaus', 'huegelhaus', 'hügelhaus', 'hobit höhle', 'hobbit hohle',
  ],
  accuracy: 'nachempfunden',
  difficulty: 3,
  description: 'Ein Hobbit-Loch nach dem Vorbild von Beutelsend: Ein runder Grashügel mit einer Eiche obenauf, vorne eine '
    + 'runde grüne Tür und tief eingesetzte Rundfenster mit Blumenkästen. Innen führt ein getäfelter, gewölbter Gang zu '
    + 'Wohnzimmer mit Kamin, Küche mit Esstisch, Schlafzimmer, Speisekammer und Arbeitszimmer – alles auf einer Ebene. '
    + 'Davor liegt ein umzäunter Garten mit Blumenbeet, Gemüsebeet und Vogelscheuche.',
  facts: [
    'Im Buch hat Beutelsend eine „vollkommen runde Tür wie ein Bullauge, grün gestrichen, mit einem glänzenden gelben Messingknauf genau in der Mitte“.',
    'Laut Tolkien liegen alle Zimmer auf einer Ebene an einem langen, röhrenförmigen Flur; die besten Zimmer haben tiefe Rundfenster zum Garten.',
    'Die Tür ist aus Wirrholz (grün), weil Minecraft keine grüne Holztür kennt; einen Knauf in der Mitte gibt es als Block nicht.',
    'Die Eiche auf dem Hügel erinnert an den Baum über Beutelsend im Filmset von Hobbingen (Neuseeland).',
    'Grundriss, Raumaufteilung und Maße sind frei nachempfunden, nicht maßstabsgetreu.',
  ],
  sources: [
    { title: 'Wikipedia (en): Bag End', url: 'https://en.wikipedia.org/wiki/Bag_End' },
    { title: 'Tolkien Gateway: Bag End', url: 'https://tolkiengateway.net/wiki/Bag_End' },
  ],
  credits: null,
  tested: null,
};

// ---------- Maße (Modul-Koordinaten) ----------
// Hülle innen: Boden y 0, Luft y 1 … 4, Decke y 5. Außenwände x 0 / 26, z 0, Innenwand der Front z 16, Steinfront z 17.
const FLOOR = 0;
const CEIL = 5;
const X0 = 0;
const X1 = 26;
const Z_BACK = 0;
const Z_FRONT = 16;
const Z_FACADE = 17;
const DOOR_X = 13;

const ROOMS = {
  bedroom: { x1: 1, z1: 1, x2: 7, z2: 5 },
  pantry: { x1: 9, z1: 1, x2: 15, z2: 5 },
  study: { x1: 17, z1: 1, x2: 25, z2: 5 },
  hall: { x1: 1, z1: 7, x2: 25, z2: 9 },
  living: { x1: 1, z1: 11, x2: 9, z2: 15 },
  entry: { x1: 11, z1: 11, x2: 15, z2: 15 },
  kitchen: { x1: 17, z1: 11, x2: 25, z2: 15 },
};
const WINDOWS_X = [2, 7, 19, 24];

const spruce = WOOD.fichte;
const darkOak = WOOD.schwarzeiche;
const WAINSCOT = darkOak.planks;
const PANEL = spruce.planks;
const POST = `${darkOak.strippedLog}[axis=y]`;
const FACADE_MIX = [['stone_bricks', 5], ['mossy_stone_bricks', 3], ['cobblestone', 1], ['mossy_cobblestone', 1]];
const PATH_MIX = [['mossy_cobblestone', 3], ['cobblestone', 2], ['stone_bricks', 2], ['mossy_stone_bricks', 2], ['andesite', 1]];

// Material aus einer gewichteten Liste, fest an die Position gebunden (gleiches Ergebnis bei jedem Bauen).
function mixAt(entries, x, y, z, salt) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = (hashPosition(x, y, z, salt) / 4294967296) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

function stairs(id, facing, half = 'bottom') {
  return `${id}[facing=${facing},half=${half}]`;
}

// ---------- Hügel ----------

// Höhe des Hügels über dem Gelände (y 0). Über der Hülle mindestens 6 (Decke y 5 + Grasschicht), nach außen fällt er ab.
function moundHeight(x, z) {
  const wobble = 0.8 * Math.sin(x * 0.37 + z * 0.21) + 0.6 * Math.cos(z * 0.43 - x * 0.29) + 0.45 * Math.sin((x + z) * 0.71);
  const cx = Math.min(Math.max(x, X0), X1);
  const cz = Math.min(Math.max(z, Z_BACK), Z_FACADE);
  const bell = Math.max(0, 1 - ((cx - 13) / 15) ** 2 - ((cz - 5) / 12) ** 2);
  const crest = 6 + 4 * bell;
  if (z > Z_FACADE) {
    // Flügel links und rechts vom Garten, vor der Front fällt der Hügel steil ab.
    if (x >= X0 && x <= X1) return 0;
    const dx = x < X0 ? X0 - x : x - X1;
    return Math.round(crest - 0.8 * dx - 1.25 * (z - Z_FACADE) + 0.4 * wobble);
  }
  const d = Math.hypot(x - cx, z - cz);
  if (d === 0) return Math.max(6, Math.round(crest + 0.7 * wobble));
  return Math.round(crest - 0.75 * d + wobble);
}

const insideShell = (x, y, z) => x >= X0 && x <= X1 && z >= Z_BACK && z <= Z_FACADE && y <= CEIL;

// Schüttet den Hügel nur in Luft auf (Hülle und Schornstein bleiben), oben Gras, darunter Erde.
function heapMound(b, area) {
  const tops = new Map();
  for (let x = area.x1; x <= area.x2; x++) {
    for (let z = area.z1; z <= area.z2; z++) {
      const h = moundHeight(x, z);
      if (h <= 0) continue;
      tops.set(`${x},${z}`, h);
      for (let y = 1; y <= h; y++) {
        if (insideShell(x, y, z) || b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, y === h ? 'grass_block' : mixAt([['dirt', 6], ['coarse_dirt', 1], ['rooted_dirt', 1]], x, y, z, 31));
      }
    }
  }
  return (x, z) => tops.get(`${x},${z}`) ?? 0;
}

// Stützmauern an den Flügeln neben dem Garten (sonst stünden dort senkrechte Erdwände).
function wingWalls(b) {
  for (const x of [X0 - 1, X1 + 1]) {
    for (let z = Z_FACADE + 1; z <= Z_FACADE + 8; z++) {
      const h = moundHeight(x, z);
      if (h <= 0) continue;
      for (let y = 1; y <= h; y++) b.set(x, y, z, y === h ? 'mossy_cobblestone' : mixAt(FACADE_MIX, x, y, z, 7));
    }
  }
}

// ---------- Hülle ----------

function wallColumn(b, x, z) {
  b.set(x, 1, z, WAINSCOT);
  for (let y = 2; y < CEIL; y++) b.set(x, y, z, PANEL);
}

function shellWalls(b) {
  const lines = [
    // [x1, z1, x2, z2]
    [X0, Z_BACK, X1, Z_BACK], [X0, Z_BACK, X0, Z_FRONT], [X1, Z_BACK, X1, Z_FRONT], [X0, Z_FRONT, X1, Z_FRONT],
    [X0, 6, X1, 6], [X0, 10, X1, 10], [8, Z_BACK, 8, 6], [16, Z_BACK, 16, 6], [10, 10, 10, Z_FRONT], [16, 10, 16, Z_FRONT],
  ];
  for (const [x1, z1, x2, z2] of lines) {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) wallColumn(b, x, z);
  }
  // Stämme an Ecken und Wandanschlüssen
  const posts = [
    [X0, Z_BACK], [X1, Z_BACK], [X0, Z_FRONT], [X1, Z_FRONT], [8, Z_BACK], [16, Z_BACK], [8, 6], [16, 6], [X0, 6], [X1, 6],
    [X0, 10], [X1, 10], [10, 10], [16, 10], [10, Z_FRONT], [16, Z_FRONT],
  ];
  for (const [x, z] of posts) b.fill(x, 1, z, x, CEIL - 1, z, POST);
}

function shellCeiling(b) {
  b.fill(X0, CEIL, Z_BACK, X1, CEIL, Z_FRONT, PANEL);
  for (let x = 2; x < X1; x += 4) b.fill(x, CEIL, Z_BACK + 1, x, CEIL, Z_FRONT - 1, `${darkOak.strippedLog}[axis=z]`);
}

// Gewölbter Flur: obere Treppen in den Ecken unter der Decke, Mitte frei.
function hallVault(b) {
  const r = ROOMS.hall;
  for (let x = r.x1; x <= r.x2; x++) {
    b.set(x, CEIL - 1, r.z1, stairs(spruce.stairs, 'north', 'top'));
    b.set(x, CEIL - 1, r.z2, stairs(spruce.stairs, 'south', 'top'));
  }
}

// Durchgänge: Bogen vom Eingang in den Flur, offene Türen in Wohnzimmer und Küche, Türen zu den hinteren Zimmern.
function openings(b) {
  for (let x = DOOR_X - 1; x <= DOOR_X + 1; x++) b.fill(x, 1, 10, x, 2, 10, 'air');
  b.set(DOOR_X, 3, 10, 'air');
  b.set(DOOR_X - 1, 3, 10, stairs(spruce.stairs, 'west', 'top'));
  b.set(DOOR_X + 1, 3, 10, stairs(spruce.stairs, 'east', 'top'));
  for (const x of [10, 16]) {
    b.fill(x, 1, 13, x, 2, 13, 'air');
    b.set(x, 3, 13, `${darkOak.strippedLog}[axis=z]`);
  }
  for (const x of [4, 12, 21]) b.door(x, 1, 6, spruce.door, { facing: 'north', hinge: 'left' });
}

// ---------- Front ----------

function facade(b) {
  for (let x = X0; x <= X1; x++) {
    for (let y = 1; y <= CEIL; y++) b.set(x, y, Z_FACADE, mixAt(FACADE_MIX, x, y, Z_FACADE, 3));
  }
}

// Runde grüne Tür (5 breit, 4 hoch, oben gerundet) mit rundem Fichtenrahmen; dahinter ein Durchgang in der Innenwand.
function roundDoor(b) {
  const z = Z_FACADE;
  const x = DOOR_X;
  for (let dx = -2; dx <= 2; dx++) b.fill(x + dx, 1, z, x + dx, 3, z, 'warped_planks');
  b.fill(x - 1, 4, z, x + 1, 4, z, 'warped_planks');
  b.set(x - 2, 3, z, stairs('warped_stairs', 'east'));
  b.set(x + 2, 3, z, stairs('warped_stairs', 'west'));
  b.set(x - 1, 4, z, stairs('warped_stairs', 'east'));
  b.set(x + 1, 4, z, stairs('warped_stairs', 'west'));
  b.door(x, 1, z, 'warped_door', { facing: 'north', hinge: 'left' });
  // Rahmen: senkrechte Stämme, oben ein liegender Stamm, dazwischen Treppen als Rundung
  for (const dx of [-3, 3]) b.fill(x + dx, 1, z, x + dx, 3, z, `${spruce.strippedLog}[axis=y]`);
  b.set(x - 3, 4, z, stairs(spruce.stairs, 'east'));
  b.set(x + 3, 4, z, stairs(spruce.stairs, 'west'));
  b.set(x - 2, 4, z, stairs(spruce.stairs, 'west', 'top'));
  b.set(x + 2, 4, z, stairs(spruce.stairs, 'east', 'top'));
  b.set(x - 2, 5, z, stairs(spruce.stairs, 'east'));
  b.set(x + 2, 5, z, stairs(spruce.stairs, 'west'));
  b.fill(x - 1, 5, z, x + 1, 5, z, `${spruce.strippedLog}[axis=x]`);
  b.fill(x, 1, Z_FRONT, x, 2, Z_FRONT, 'air');
  // Laternen links und rechts
  wallLantern(b, { x: x - 4, y: 3, z, facing: 'south', arm: spruce.fence });
  wallLantern(b, { x: x + 4, y: 3, z, facing: 'south', arm: spruce.fence });
}

// Gesims aus umgedrehten Steinziegeltreppen unter der Grasschicht, ein paar Ranken hängen über die Front.
function cornice(b) {
  for (let x = X0; x <= X1; x++) {
    if (Math.abs(x - DOOR_X) <= 3) continue;
    b.set(x, CEIL, Z_FACADE + 1, stairs('stone_brick_stairs', 'north', 'top'));
  }
  for (const [x, len] of [[0, 2], [4, 1], [5, 2], [21, 2], [22, 1], [26, 2]]) {
    for (let k = 0; k < len; k++) b.set(x, CEIL - 1 - k, Z_FACADE + 1, 'vine[north=true]');
  }
}

// Tief eingesetzte Rundfenster: Glas außen, innen eine runde Laibung aus Fichtentreppen, davor ein Blumenkasten.
function roundWindows(b) {
  for (const x of WINDOWS_X) {
    window(b, { x, y: 2, z: Z_FACADE, facing: 'south', style: 'round', width: 3, stairs: 'stone_brick_stairs', flowerBox: { trapdoor: spruce.trapdoor, soil: 'rooted_dirt', flowers: ['poppy', 'dandelion', 'azure_bluet', 'oxeye_daisy', 'cornflower'] } });
    for (const [dx, dy] of [[0, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) b.set(x + dx, 2 + dy, Z_FRONT, 'air');
    b.set(x - 1, 2, Z_FRONT, stairs(spruce.stairs, 'west'));
    b.set(x + 1, 2, Z_FRONT, stairs(spruce.stairs, 'east'));
    b.set(x - 1, 4, Z_FRONT, stairs(spruce.stairs, 'west', 'top'));
    b.set(x + 1, 4, Z_FRONT, stairs(spruce.stairs, 'east', 'top'));
  }
}

// ---------- Einrichtung ----------

function furnishEntry(b) {
  const r = ROOMS.entry;
  // Kleiderhaken (Haken) an beiden Seitenwänden, Sitzbank, Schirmständer
  for (const z of [r.z1, r.z1 + 1]) {
    b.set(r.x1, 2, z, 'tripwire_hook[facing=east]');
    b.set(r.x2, 2, z, 'tripwire_hook[facing=west]');
  }
  b.set(r.x1, 1, r.z2 - 1, stairs(spruce.stairs, 'west'));
  b.set(r.x1, 1, r.z2, stairs(spruce.stairs, 'west'));
  b.set(r.x2, 1, r.z2, 'barrel[facing=up]');
  b.set(r.x2, 2, r.z2, 'potted_fern');
  b.set(r.x2, 1, r.z1 + 2, 'spruce_shelf[facing=west]');
  for (let z = r.z1; z <= r.z2; z++) b.set(DOOR_X, 1, z, 'green_carpet');
  hangingLantern(b, { x: DOOR_X, y: CEIL - 1, z: 13, chain: 1 });
}

function furnishHall(b) {
  const r = ROOMS.hall;
  for (let x = r.x1 + 1; x <= r.x2 - 1; x++) b.set(x, 1, 8, 'green_carpet');
  // Enden des Flurs: Kommode mit Blumen
  b.set(r.x1, 1, 8, 'barrel[facing=up]');
  b.set(r.x1, 2, 8, 'potted_flowering_azalea_bush');
  b.set(r.x2, 1, 8, 'barrel[facing=up]');
  b.set(r.x2, 2, 8, 'potted_red_tulip');
  for (const x of [7, 19]) b.set(x, 2, r.z2, 'tripwire_hook[facing=north]');
}

function furnishLiving(b) {
  const r = ROOMS.living;
  fireplace(b, { x: r.x1, y: 1, z: 13, facing: 'east', height: 4, block: 'bricks', mantel: darkOak.stairs });
  // Zwei Sessel zum Kamin, dazwischen ein Beistelltisch
  for (const z of [12, 14]) {
    b.set(5, 1, z, stairs(darkOak.stairs, 'east'));
    b.set(5, 1, z === 12 ? 11 : 15, `${darkOak.trapdoor}[facing=${z === 12 ? 'north' : 'south'},half=bottom,open=true]`);
  }
  b.set(5, 1, 13, spruce.fence);
  b.set(5, 2, 13, 'candle[candles=3,lit=true]');
  for (let x = 3; x <= 4; x++) for (let z = 12; z <= 14; z++) b.set(x, 1, z, 'red_carpet');
  // Bücherregale an der Rückwand, Fenstersitze unter den Rundfenstern
  for (let x = 6; x <= 8; x++) {
    b.set(x, 1, r.z1, 'bookshelf');
    b.set(x, 2, r.z1, x === 7 ? 'chiseled_bookshelf[facing=south,slot_0_occupied=true,slot_2_occupied=true,slot_3_occupied=true,slot_4_occupied=true]' : 'bookshelf');
  }
  b.set(7, 3, r.z1, 'potted_fern');
  for (const x of [2, 7]) b.set(x, 1, r.z2, stairs(spruce.stairs, 'south'));
  b.set(9, 1, 13, 'air');
}

function furnishKitchen(b) {
  const r = ROOMS.kitchen;
  kitchen(b, { x: r.x2, y: 1, z: r.z1, facing: 'west', width: 5, wood: 'fichte' });
  diningTable(b, { x: 19, y: 1, z: 12, facing: 'south', length: 3, width: 2, wood: 'fichte', cloth: 'weiss', headChairs: false });
}

function furnishBedroom(b) {
  const r = ROOMS.bedroom;
  bedroom(b, { x: r.x1, y: 1, z: r.z1, facing: 'south', width: 7, depth: 5, wood: 'fichte', color: 'gruen', rug: 'braun' });
}

function furnishPantry(b) {
  const r = ROOMS.pantry;
  storage(b, { x: r.x1, y: 1, z: r.z1, facing: 'south', width: 7, height: 2 });
  // Westwand: Fässer mit Regal darüber; Ostwand: Heu, Kürbis, Melone
  for (let z = 2; z <= 4; z++) {
    b.set(r.x1, 1, z, 'barrel[facing=up]');
    b.set(r.x1, 2, z, 'spruce_shelf[facing=east]');
  }
  b.set(r.x2, 1, 2, 'hay_block[axis=y]');
  b.set(r.x2, 2, 2, 'hay_block[axis=y]');
  b.set(r.x2, 1, 3, 'pumpkin');
  b.set(r.x2, 1, 4, 'melon');
  b.set(r.x2, 2, 3, 'smoker[facing=west]');
  b.set(r.x2, 2, 4, 'cake');
}

function furnishStudy(b) {
  const r = ROOMS.study;
  bookWall(b, { x: r.x1, y: 1, z: r.z1, facing: 'south', width: 9, height: 3, wood: 'schwarzeiche' });
  // Schreibtisch mit Stuhl, Lesepult, Kartentisch
  for (let x = 22; x <= 24; x++) b.set(x, 1, 3, `${spruce.slab}[type=top]`);
  b.set(22, 2, 3, 'candle[candles=2,lit=true]');
  b.set(24, 2, 3, 'potted_lily_of_the_valley');
  b.set(23, 1, 4, stairs(spruce.stairs, 'south'));
  b.set(18, 1, 4, 'lectern[facing=south]');
  b.set(r.x2, 1, r.z2, 'cartography_table');
  b.set(r.x2, 2, r.z2, 'decorated_pot');
}

// ---------- Garten ----------

function gardenPath(b) {
  for (let z = Z_FACADE + 1; z <= 31; z++) {
    for (let x = DOOR_X - 1; x <= DOOR_X + 1; x++) {
      b.set(x, 0, z, z === Z_FACADE + 1 && x === DOOR_X ? 'stone_bricks' : mixAt(PATH_MIX, x, 0, z, 11));
    }
  }
}

const PATCH = { x1: 18, z1: 20, x2: 26, z2: 26 };

function vegetablePatch(b) {
  const { x1, z1, x2, z2 } = PATCH;
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const edge = x === x1 || x === x2 || z === z1 || z === z2;
      if (edge) {
        b.set(x, 1, z, `${spruce.log}[axis=${z === z1 || z === z2 ? 'x' : 'z'}]`);
        continue;
      }
      if (z === 23) {
        b.set(x, 1, z, 'water[level=0]');
        continue;
      }
      b.set(x, 1, z, 'farmland[moisture=7]');
      const crop = [['carrots', 7], ['potatoes', 7], ['beetroots', 3], ['wheat', 7]][Math.floor((x - x1 - 1) / 2) % 4];
      const age = Math.max(1, crop[1] - (hashPosition(x, 1, z, 5) % 3));
      b.set(x, 2, z, `${crop[0]}[age=${age}]`);
    }
  }
  b.set(x1, 1, z1, `${spruce.log}[axis=y]`);
  b.set(x2, 1, z1, `${spruce.log}[axis=y]`);
  b.set(x1, 1, z2, `${spruce.log}[axis=y]`);
  b.set(x2, 1, z2, `${spruce.log}[axis=y]`);
}

// Die Blumen des Beets kommen erst im Garten-Kapitel dran: Pflanzen neu setzen, damit sie in diesem Schritt landen
// (das Beet selbst wird schon mit dem Gelände angelegt, sonst klafft dort beim Bauen ein Loch).
function replantBed(b, { x1, z1, x2, z2 }) {
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      for (let y = FLOOR + 1; y <= FLOOR + 2; y++) {
        const state = b.get(x, y, z);
        if (state !== 'air') b.set(x, y, z, state, { raw: true });
      }
    }
  }
}

function scarecrow(b, x, z) {
  b.set(x, 1, z, spruce.fence);
  b.set(x, 2, z, 'hay_block[axis=y]');
  b.set(x, 3, z, 'carved_pumpkin[facing=west]');
  b.set(x, 2, z - 1, spruce.fence);
  b.set(x, 2, z + 1, spruce.fence);
}

function gardenBench(b, x, z) {
  for (let dx = 0; dx < 3; dx++) b.set(x + dx, 1, z, stairs(spruce.stairs, 'south'));
  b.set(x - 1, 1, z, `${spruce.trapdoor}[facing=west,half=bottom,open=true]`);
  b.set(x + 3, 1, z, `${spruce.trapdoor}[facing=east,half=bottom,open=true]`);
}

// ---------- Bau ----------

export default function build(b) {
  b.phase('Gelände und Fußböden', 'Lege eine ebene Grasfläche an (hier 51 × 44 Blöcke). Auf der Fläche des Hobbit-Lochs '
    + '(27 × 18 Blöcke) ersetzt du das Gras durch die Fußböden: Eichenholzbretter in den Zimmern, ein Muster aus Fichten- '
    + 'und Schwarzeichenbrettern im Flur und Fischgrät aus geschälten Stämmen im Eingang. Unter die künftige Steinfront '
    + 'kommt eine Reihe Bruchstein. Leg im Garten gleich den 3 breiten Steinweg von der Tür bis zum Tor, die Erdfläche '
    + 'fürs Gemüsebeet (9 × 7, rechts) und links das Blumenbeet an.', {
    tips: [
      'Steck zuerst die vier Ecken der Hülle ab (27 Blöcke breit, 18 tief) – alles Weitere richtet sich danach.',
      'Die Tür liegt genau in der Mitte der Vorderseite, 14 Blöcke von der linken Ecke.',
    ],
  });
  terrain(b, { x: -12, y: FLOOR, z: -12, width: 51, depth: 44, height: 0, surface: 'gras', seed: 'hobbit' });
  b.fill(X0, FLOOR, Z_BACK, X1, FLOOR, Z_FRONT, WOOD.eiche.planks);
  floorPattern(b, { x: 1, y: FLOOR, z: 7, width: 25, depth: 3, pattern: 'border', blocks: [spruce.planks, darkOak.planks] });
  floorPattern(b, { x: 11, y: FLOOR, z: 11, width: 5, depth: 5, pattern: 'herringbone', blocks: ['stripped_oak_log', 'stripped_dark_oak_log'] });
  floorPattern(b, { x: 1, y: FLOOR, z: 11, width: 9, depth: 5, pattern: 'border', blocks: [WOOD.eiche.planks, spruce.planks] });
  b.fill(X0, FLOOR, Z_FACADE, X1, FLOOR, Z_FACADE, 'cobblestone');
  gardenPath(b);
  b.fill(PATCH.x1, FLOOR, PATCH.z1, PATCH.x2, FLOOR, PATCH.z2, 'dirt');
  flowerBed(b, { x: 1, y: FLOOR, z: 21, width: 9, depth: 3, facing: 'south', palette: 'bunt', seed: 'hobbit' });

  b.phase('Holzgerüst der Räume', 'Zieh alle Wände 4 Blöcke hoch: unten eine Reihe Schwarzeichenholzbretter als '
    + 'Täfelung, darüber Fichtenholzbretter, an Ecken und Wandanschlüssen geschälte Schwarzeichenstämme. Ganz hinten '
    + 'liegen Schlafzimmer, Speisekammer und Arbeitszimmer (je 5 tief), davor der 3 breite Flur quer durchs Haus, '
    + 'vorne Wohnzimmer, Eingang und Küche.', {
    tips: ['Setz zuerst die Stämme an allen Ecken und Anschlüssen – dann kannst du die Bretterwände einfach dazwischen ziehen.'],
  });
  b.step('Wände', 'Außenwände, die zwei langen Flurwände und die Trennwände zwischen den Zimmern.');
  shellWalls(b);
  b.step('Durchgänge und Türen', 'Lass vom Eingang einen 3 breiten Bogen in den Flur frei (oben mit zwei umgedrehten '
    + 'Fichtentreppen gerundet), je einen offenen Durchgang links ins Wohnzimmer und rechts in die Küche und setz drei '
    + 'Fichtentüren in die hintere Flurwand. Schau beim Setzen der Türen nach Norden.');
  openings(b);
  b.step('Decke mit Balken', 'Leg die Decke aus Fichtenholzbrettern auf Höhe 6 über alle Räume; alle 4 Blöcke läuft ein '
    + 'Balken aus geschälter Schwarzeiche von vorne nach hinten.');
  shellCeiling(b);
  b.step('Gewölbe im Flur', 'Setz unter die Decke an beiden Flurwänden eine Reihe umgedrehter Fichtentreppen, die hohe '
    + 'Seite zur Wand. So wirkt der Flur wie eine runde Röhre – genau wie bei Tolkien.');
  hallVault(b);

  b.phase('Steinfront', 'Vor die vordere Wand kommt eine zweite Wand aus Steinziegeln, bemoosten Steinziegeln und etwas '
    + 'Bruchstein, 5 hoch. Sie trägt später die Tür und die Fenster, und weil sie zwei Blöcke dick ist, sitzen die '
    + 'Rundfenster schön tief in der Wand.', {
    tips: ['Misch die Steine locker durcheinander, aber setz nicht zwei gleiche bemooste Blöcke nebeneinander – das wirkt natürlicher.'],
  });
  facade(b);

  b.phase('Hügel aufschütten', 'Jetzt verschwindet das Holzhaus unter der Erde: Schütte rundherum und obendrauf Erde '
    + 'auf, bis über der Decke überall mindestens eine Schicht liegt, und deck alles mit Grasblöcken ab. Nach hinten '
    + 'wird der Hügel etwas höher, zu den Seiten läuft er flach aus. Links und rechts vom Garten halten zwei kleine '
    + 'Stützmauern aus Stein die Erde.', {
    tips: [
      'Grasblöcke bekommst du mit der Behutsamkeit-Verzauberung, oder du legst Erde aus und wartest, bis das Gras von selbst hinüberwächst.',
      'Bau den Schornstein, bevor du die Erde aufschüttest – dann musst du nichts wieder ausgraben.',
    ],
  });
  b.step('Schornstein', 'Über dem Kamin im Wohnzimmer (vorne links) steigt ein Schornstein aus Steinziegeln durch die '
    + 'Erde. Ersetz das Deckenbrett direkt über dem Rauchabzug des Kamins durch einen Ziegelstein, darauf mauerst du den '
    + 'Schornstein. Er ragt zwei Blöcke aus dem Gras, oben mit einem Kranz aus Treppen und einem Lagerfeuer für den Rauch.');
  const chimneyTop = moundHeight(1, 13);
  b.set(1, CEIL, 13, 'bricks');
  chimney(b, { x: 1, y: CEIL + 1, z: 13, height: chimneyTop - CEIL + 2, block: 'stone_bricks', rim: 'stone_brick_stairs' });
  b.step('Erde und Gras', 'Schütte den Hügel auf. Über der Steinfront liegt die Grasschicht auf Höhe 7, über der Tür '
    + 'eine Ebene höher.');
  const top = heapMound(b, { x1: -12, z1: -12, x2: 38, z2: 31 });
  b.step('Stützmauern', 'Setz neben dem Garten links und rechts die Stützmauern aus Stein, oben mit bemoostem Bruchstein.');
  wingWalls(b);

  b.phase('Runde Tür und Rundfenster', 'Die berühmte runde grüne Tür sitzt genau in der Mitte der Front. Weil es keine '
    + 'grüne Holztür gibt, nimmst du eine Wirrholztür und baust links, rechts und oben Wirrholzbretter und -treppen an, '
    + 'sodass ein grünes Rund entsteht. Ein Rahmen aus geschälten Fichtenstämmen und Fichtentreppen macht den Kreis '
    + 'fertig. Die vier Rundfenster bekommen außen Glasscheiben mit Steinziegeltreppen in den Ecken und innen eine '
    + 'runde Laibung aus Fichtentreppen.', {
    tips: [
      'Die Wirrholztür setzt du von außen mit Blick nach Norden, dann geht sie nach innen auf.',
      'Für die gerundeten Ecken: Treppen in den oberen Ecken zielst du auf die obere Blockhälfte, damit sie umgedreht liegen.',
    ],
  });
  b.step('Runde Tür', 'Wirrholztür, grüne Rundung, Fichtenrahmen, zwei Laternen an Zaunarmen neben der Tür.');
  roundDoor(b);
  b.step('Rundfenster mit Blumenkästen', 'Vier Rundfenster (3 × 3) – zwei fürs Wohnzimmer links, zwei für die Küche '
    + 'rechts. Unter jedem Fenster ein Kasten aus Wurzelerde mit Fichtenfalltüren und Blumen.');
  roundWindows(b);
  b.step('Gesims und Ranken', 'Unter die Grasschicht kommt über die ganze Front ein Gesims aus umgedrehten '
    + 'Steinziegeltreppen (hohe Seite zur Wand); zwischen den Fenstern hängen ein paar Ranken herab.');
  cornice(b);

  b.phase('Einrichtung', 'Richte die Zimmer gemütlich ein – Hobbits lieben Essen, Bücher und ein warmes Feuer.', {
    tips: ['Die Haken (Stolperdrahthaken) an den Wänden sind die Kleiderhaken für Hüte und Mäntel.'],
  });
  b.step('Eingang', 'Grüner Läufer, Kleiderhaken an beiden Seiten, eine Sitzbank aus Fichtentreppen, ein Fass als '
    + 'Schirmständer und eine Laterne.');
  furnishEntry(b);
  b.step('Flur', 'Grüner Läufer über die ganze Länge, an den Enden je ein Fass mit Topfpflanze.');
  furnishHall(b);
  b.step('Wohnzimmer', 'Backsteinkamin an der linken Wand, zwei Sessel aus Schwarzeichentreppen, ein roter Teppich, '
    + 'Bücherregale und Fenstersitze unter den Rundfenstern.');
  furnishLiving(b);
  b.step('Küche', 'Küchenzeile an der rechten Wand, in der Mitte ein Esstisch für sechs mit weißem Tischtuch.');
  furnishKitchen(b);
  b.step('Schlafzimmer', 'Bett mit grüner Decke, Nachttische, Truhe und Teppich.');
  furnishBedroom(b);
  b.step('Speisekammer', 'Truhen und Fässer an der Rückwand, Fässer mit Regal links, Heu, Kürbis, Melone, Räucherofen und Kuchen rechts.');
  furnishPantry(b);
  b.step('Arbeitszimmer', 'Bücherwand, Schreibtisch mit Stuhl und Kerze, Lesepult und ein Kartentisch für Bilbos Karten.');
  furnishStudy(b);
  b.step('Licht', 'Häng in jedem Zimmer genug Laternen auf, damit kein Monster spawnen kann.');
  for (const r of Object.values(ROOMS)) lightRoom(b, { x1: r.x1, y1: 1, z1: r.z1, x2: r.x2, y2: CEIL - 1, z2: r.z2 });

  b.phase('Garten', 'Vor dem Hügel liegt der Garten: ein Steinweg von der Tür zum Gartentor, links ein Blumenbeet mit '
    + 'Bank, rechts ein Hochbeet mit Gemüse und einer Vogelscheuche, ringsum ein Fichtenzaun.', {
    tips: [
      'Im Hochbeet liegt in der Mitte eine Reihe Wasser – so bleibt jeder Ackerboden feucht (Wasser wirkt 4 Blöcke weit).',
      'Den Ackerboden machst du, indem du Erde mit einer Hacke bearbeitest.',
    ],
  });
  b.step('Gemüsebeet', 'Hochbeet 9 × 7 mit Fichtenstamm-Rand: in der Mitte eine Reihe Wasser, daneben Ackerboden mit '
    + 'Karotten, Kartoffeln, Roter Bete und Weizen.');
  vegetablePatch(b);
  scarecrow(b, 16, 23);
  b.step('Blumenbeet und Bank', 'Links ein Blumenbeet, davor eine Bank mit Blick aufs Haus und eine Laterne.');
  replantBed(b, { x1: 1, z1: 21, x2: 9, z2: 23 });
  gardenBench(b, 4, 26);
  lampPost(b, { x: 8, y: 1, z: 26, height: 2, post: spruce.fence, style: 'top' });
  b.step('Zaun', 'Fichtenzaun vorne mit Tor in der Mitte, Torpfosten aus geschälten Stämmen mit Laternen, seitlich bis an die Stützmauern.');
  gardenFence(b, { x: X0 - 1, y: 1, z: 18, width: X1 - X0 + 3, depth: 13, fence: spruce.fence, gate: spruce.fenceGate, posts: spruce.strippedLog, lanterns: true, sides: ['front'] });
  for (const x of [X0 - 1, X1 + 1]) {
    let z = Z_FACADE + 1;
    while (moundHeight(x, z) > 0) z++;
    b.fill(x, 1, z, x, 1, 29, spruce.fence);
  }
  b.note(DOOR_X, 1, Z_FACADE, 'Die runde grüne Tür – Wirrholztür mit grüner Rundung.');

  b.phase('Hügel bepflanzen', 'Zum Schluss wächst der Hügel zu: eine große Eiche obenauf, ein paar Azaleenbüsche an den '
    + 'Hängen, Gras und Blumen überall.', {
    tips: ['Pflanz die Eiche erst, wenn der Hügel fertig ist – ihre Wurzeln liegen auf dem Gras.'],
  });
  b.step('Eiche auf dem Hügel', 'Pflanz eine große Eiche hinten auf den Hügel, etwas rechts von der Mitte.');
  const treeX = 16;
  const treeZ = 4;
  tree(b, { x: treeX, y: top(treeX, treeZ) + 1, z: treeZ, species: 'eiche', size: 'gross', seed: 'beutelsend', facing: 'south' });
  b.step('Büsche, Gras und Blumen', 'Ein paar Azaleenbüsche an den Hängen, dazu Gras, Farne und Wildblumen über den ganzen Hügel.');
  for (const [x, z, s] of [[-5, 8, 1], [31, 6, 2], [4, -6, 3], [24, -7, 4]]) {
    const h = top(x, z);
    if (h > 0) bush(b, { x, y: h + 1, z, size: 'klein', leaves: 'azalee', seed: s });
  }
  vegetation(b, { x: -12, y: 14, z: -12, width: 51, depth: 30, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 'huegel' });
  vegetation(b, { x: -12, y: 14, z: -12, width: 51, depth: 30, mix: 'blumen', density: 0.12, shape: 'eckig', seed: 'huegel-blumen' });
}
