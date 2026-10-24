// Taverne – zweigeschossiges Wirtshaus: Erdgeschoss aus Stein mit Schankraum, Obergeschoss als Fachwerk mit Vorsprung.
// Rahmen: Vorderseite nach Süden (+z). Erdgeschoss x 0 … 14, z 0 … 10; Obergeschoss ragt vorne bis z 11. Wiese auf y = 0.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, doorway, chimney, timberWall, brace, dormer, wallLantern, hangingLantern, floorPattern, straightStairs,
  bedroom, diningTable, fireplace, lightRoom, tree, bush, path, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'taverne',
  title: 'Taverne',
  category: 'mittelalter',
  subtitle: 'Wirtshaus mit Schankraum, Fachwerk-Obergeschoss und Gästezimmern',
  tags: ['Mittelalter', 'Dorf', 'Wirtshaus', 'Gasthaus', 'Fachwerk', 'Zwei Etagen', 'Innenausbau', 'Kamin'],
  aliases: [
    'taverne', 'tavern', 'taverna', 'tarverne', 'wirtshaus', 'gasthaus', 'gaststätte', 'kneipe', 'schenke', 'schänke',
    'gasthof', 'inn', 'pub', 'medieval tavern', 'medieval inn', 'fachwerk taverne', 'mittelalter taverne', 'minecraft taverne',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Ein zweigeschossiges Wirtshaus: unten Steinmauern, oben Fachwerk aus Schwarzeiche mit hellem Kalzit, das vorne einen Block über die Gasse ragt. Im Schankraum stehen eine Theke aus umgedrehten Treppen, eine Wand voller Fässer, zwei Tische und ein gemauerter Kamin; eine Treppe an der Rückwand führt zu zwei Gästezimmern, darüber liegt der Dachboden als Vorratslager. Draußen hängt das Wirtshausschild, daneben ein kleiner Biergarten unter einer Eiche.',
  facts: [
    'Erdgeschoss 15 × 11 Blöcke, Obergeschoss 15 × 12 (vorne ein Block Vorsprung), bis zum First 16 Blöcke hoch.',
    'Der Vorsprung des Obergeschosses ruht auf Kopfbändern aus umgedrehten Treppen – so wurden Fachwerkhäuser früher größer, ohne mehr Grundfläche zu brauchen.',
    'Die Theke ist aus oberen Fichtentreppen gebaut: oben eine volle Platte, unten Platz für die Füße der Gäste.',
    'Das Lagerfeuer im Kamin leuchtet, darum brauchst du im Schankraum weniger Laternen.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

const X2 = 14;
const Z2 = 10;
const UP_Z2 = 11;
const GROUND_TOP = 4;
const FLOOR_Y = 5;
const PLATE_Y = 9;

function groundStone(x, y, z) {
  const h = hashPosition(x, y, z, 515) % 20;
  if (y === 1) return h < 6 ? 'mossy_cobblestone' : 'cobblestone';
  if (h < 2) return 'cracked_stone_bricks';
  if (h < 4) return 'mossy_stone_bricks';
  return 'stone_bricks';
}

function foundation(b) {
  b.phase('Gelände und Fundament', 'Leg die Wiese aus und darauf die Grundfläche der Taverne: 15 Blöcke breit und 11 tief. Außen kommt ein Ring aus Bruchstein, innen ein Dielenboden aus Fichte mit einem Rand aus Schwarzeiche.', {
    tips: ['Steck zuerst die vier Ecken ab und prüf, dass die Grundfläche 15 × 11 groß ist – alles Weitere richtet sich danach.'],
  });
  b.step('Wiese und Grundfläche', 'Die Wiese ist 33 × 29 Blöcke groß, die Taverne steht im Nordwesten, östlich davon ist Platz für den Biergarten.');
  b.fill(-6, 0, -6, 26, 0, 22, 'grass_block');
  b.fill(0, 0, 0, X2, 0, Z2, 'cobblestone');
  floorPattern(b, { x: 1, y: 0, z: 1, width: X2 - 1, depth: Z2 - 1, pattern: 'border', blocks: [spruce.planks, dark.planks] });
}

function groundFloor(b) {
  b.phase('Erdgeschoss', 'Mauere die Außenwände des Erdgeschosses 4 Blöcke hoch: die unterste Reihe aus Bruchstein (etwas bemoost), darüber Steinziegel mit ein paar rissigen und bemoosten. Fenster und Tür brichst du später heraus.', {
    tips: ['Die Mauer steht auf dem Bruchsteinring. Mauere erst rundherum Reihe für Reihe, dann bleibt alles gerade.'],
  });
  for (let y = 1; y <= GROUND_TOP; y++) {
    for (let x = 0; x <= X2; x++) {
      for (let z = 0; z <= Z2; z++) {
        if (x === 0 || x === X2 || z === 0 || z === Z2) b.set(x, y, z, groundStone(x, y, z));
      }
    }
  }
}

function upperFloor(b) {
  b.phase('Decke und Vorsprung', 'Jetzt kommt die Decke über dem Schankraum. Sie ist zugleich der Boden des Obergeschosses und ragt vorne einen Block über die Mauer hinaus – das ist der Vorsprung, auf dem die Fachwerkwand steht.', {
    tips: [
      'Setz zuerst die Kopfbänder (umgedrehte Schwarzeichentreppen) vorne unter den Vorsprung – dann hast du etwas, woran du die erste Reihe anlegen kannst.',
      'Lass an der Rückwand zwei Felder für die Treppe offen (5 und 6 Blöcke von der Westwand entfernt).',
    ],
  });
  b.step('Kopfbänder', 'Setz vorne an die Mauerkrone fünf umgedrehte Schwarzeichentreppen, die hohe Seite zur Mauer: an beiden Ecken, 4 und 8 Blöcke von der Westecke und 2 Blöcke vor der Ostecke.');
  for (const x of [0, 4, 8, 12, X2]) brace(b, { x, y: GROUND_TOP, z: Z2, facing: 'south', length: 1, stairs: dark.stairs });
  b.step('Boden des Obergeschosses', 'Füll die Decke mit Fichtenbrettern. Quer darunter (Nord–Süd) liegen drei Deckenbalken aus geschälter Schwarzeiche, die man im Schankraum sieht. Das Treppenloch an der Rückwand bleibt offen.');
  b.fill(1, FLOOR_Y, 1, X2 - 1, FLOOR_Y, Z2, spruce.planks);
  for (const x of [3, 7, 11]) b.fill(x, FLOOR_Y, 1, x, FLOOR_Y, Z2, `${dark.strippedLog}[axis=z]`);
  b.fill(6, FLOOR_Y, 1, 7, FLOOR_Y, 1, 'air');

  b.phase('Fachwerk im Obergeschoss', 'Das Obergeschoss ist eine Fachwerkwand aus geschälter Schwarzeiche mit hellem Kalzit in den Gefachen, 5 Ebenen hoch (unten der liegende Schwellbalken, oben der Rähm). Vorne steht sie auf dem Vorsprung, an den anderen Seiten auf der Mauer.', {
    tips: [
      'Setz zuerst Schwelle und Rähm (liegend) und die senkrechten Ständer an den Ecken und alle 4 Blöcke, dann die schrägen Streben, dann füll mit Keramik auf.',
      'Hinten bekommt die Wand Schrägstreben, vorne zwischen den Fenstern ein Andreaskreuz, die Seitenwände haben nur Ständer – so bleibt die Schauseite ruhig.',
    ],
  });
  b.step('Vorderwand', 'Die Vorderwand ist 15 lang: Schwelle, Rähm und Ständer alle 4 Blöcke, in die Gefache kommen später die Fenster. Ins mittlere Gefach (5 bis 7 Blöcke von der Westecke) setzt du ein Andreaskreuz: die vier Ecken und die Mitte aus geschälter Schwarzeiche.');
  timberWall(b, { x: 0, y: FLOOR_Y, z: UP_Z2, facing: 'south', length: X2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' });
  for (const [x, y] of [[5, 6], [7, 6], [6, 7], [5, 8], [7, 8]]) b.set(x, y, UP_Z2, dark.strippedLog);
  b.step('Rückwand', 'Die Rückwand ist ebenfalls 15 lang, mit Schrägstreben.');
  timberWall(b, { x: X2, y: FLOOR_Y, z: 0, facing: 'north', length: X2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'diagonal' });
  b.step('Seitenwände', 'Die Seitenwände sind 12 lang (vom hinteren Ende bis zum Vorsprung), nur mit Ständern.');
  timberWall(b, { x: 0, y: FLOOR_Y, z: 0, facing: 'west', length: UP_Z2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' });
  timberWall(b, { x: X2, y: FLOOR_Y, z: UP_Z2, facing: 'east', length: UP_Z2 + 1, height: 5, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' });
  b.step('Innenwände und Dachboden', 'Innen trennt eine Bretterwand den Flur (an der Rückwand, 3 tief) von den zwei Gästezimmern, und eine zweite Wand teilt die beiden Zimmer. Oben schließt eine Bretterdecke auf Höhe des Rähms die Zimmer ab – darüber liegt der Dachboden.');
  b.fill(1, 6, 4, X2 - 1, 8, 4, spruce.planks);
  b.fill(7, 6, 5, 7, 8, UP_Z2 - 1, spruce.planks);
  for (const x of [1, 7, X2 - 1]) b.fill(x, 6, 4, x, 8, 4, `${spruce.strippedLog}[axis=y]`);
  b.fill(1, PLATE_Y, 1, X2 - 1, PLATE_Y, UP_Z2 - 1, spruce.planks);
  b.set(X2 - 1, PLATE_Y, 1, 'air');
}

function roof(b) {
  b.phase('Dach', 'Das Satteldach aus Schwarzeichentreppen läuft Ost–West und steht ringsum einen Block über. Die unterste Reihe liegt neben dem Rähm, jede Reihe eine Ebene höher, bis sich die beiden Seiten oben treffen. Die Giebel füllst du mit Kalzit wie die Gefache, mit zwei Fenstern (je 2 hoch), einem liegenden Riegel darüber und zwei Ständern unter dem First.', {
    tips: ['Schau beim Setzen der Treppen zur Firstmitte (vorne nach Norden, hinten nach Süden), dann liegen sie richtig herum.'],
  });
  b.roof({ x1: 0, z1: 0, x2: X2, z2: UP_Z2, y: PLATE_Y, type: 'gable', axis: 'x', stairs: dark.stairs, slab: dark.slab, full: 'calcite', overhang: 1 });
  for (const x of [0, X2]) {
    b.fill(x, 12, 3, x, 12, 8, `${dark.strippedLog}[axis=z]`);
    b.fill(x, 13, 5, x, 14, 6, `${dark.strippedLog}[axis=y]`);
    b.fill(x, 10, 3, x, 11, 3, 'glass_pane');
    b.fill(x, 10, 8, x, 11, 8, 'glass_pane');
  }
  b.phase('Gauben', 'Vorne sitzen zwei Gauben im Dach (über den Gästezimmern): Vorderwand auf dem Rähm, Ecken aus Schwarzeichenstämmen, Wände aus Fichtenbrettern, ein Glasfenster und ein kleines Satteldach aus Schwarzeichentreppen mit einer Stufe als First. Die Hauptdachtreppen, wo die Gaube sitzt, nimmst du dafür heraus.', {
    tips: ['Die Vorderwand der Gaube steht genau über der Fachwerkwand, eine Ebene über dem Rähm.'],
  });
  for (const x of [4, 10]) dormer(b, { x, y: PLATE_Y + 1, z: UP_Z2, facing: 'south', width: 3, wallHeight: 2, wall: spruce.planks, corner: dark.log, stairs: dark.stairs });
}

function openings(b) {
  b.phase('Fenster und Tür', 'Brich Fenster und Tür in die fertigen Wände.', {
    tips: ['Fensterläden sind offene Fichtenfalltüren an der Außenwand links und rechts vom Fenster.'],
  });
  b.step('Eingangstür', 'Die Eingangstür (Fichte) liegt vorne, 9 Blöcke von der Westecke, mit einem Rahmen aus geschälter Schwarzeiche.');
  doorway(b, { x: 9, y: 1, z: Z2, facing: 'south', door: spruce.door, frame: dark.strippedLog });
  b.step('Fenster unten', 'Das Erdgeschoss bekommt vorne drei Fenster mit Läden und Steinziegel-Fensterbank, dazu je eines in Rückwand und Westwand und zwei in der Ostwand.');
  for (const x of [2, 5, 13]) window(b, { x, y: 2, z: Z2, facing: 'south', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  window(b, { x: 2, y: 2, z: 0, facing: 'north', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: 12, y: 2, z: 0, facing: 'north', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: 0, y: 2, z: 3, facing: 'west', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  window(b, { x: X2, y: 2, z: 8, facing: 'east', height: 2, shutters: spruce.trapdoor, sill: 'stone_brick_stairs' });
  b.step('Fenster oben', 'Im Fachwerk sitzen die Fenster ohne eigenen Rahmen. Vorne bekommt jedes Zimmer ein Fenster mitten im Gefach (2 und 10 Blöcke von der Westecke), eine Ebene höher als unten, damit innen die Nachttische darunter passen; davor hängt auf dem Vorsprung ein Blumenkasten. Hinten kommen zwei Fenster für den Flur dazu und je eines mit Läden in die Seitenwände.');
  for (const x of [2, 10]) window(b, { x, y: 7, z: UP_Z2, facing: 'south', height: 2, flowerBox: true });
  for (const x of [3, 10]) window(b, { x, y: 6, z: 0, facing: 'north', height: 2 });
  window(b, { x: 0, y: 6, z: 8, facing: 'west', height: 2, shutters: spruce.trapdoor });
  window(b, { x: X2, y: 6, z: 8, facing: 'east', height: 2, shutters: spruce.trapdoor });
}

function chimneyAndHearth(b) {
  b.phase('Kamin und Schornstein', 'Der Kamin steht im Schankraum an der Westwand (Feuerstelle 3 breit, Sims aus Schwarzeichentreppen). Darüber zieht der Schornstein aus Ziegeln durch das Gästezimmer und den Dachboden bis über den First.', {
    tips: ['Unter dem Lagerfeuer oben im Schornstein steckt ein Heuballen – dann steigt der Rauch höher.'],
  });
  b.step('Kamin', 'Mauere die Feuerstelle aus Ziegeln: hinten an der Wand 3 breit und 4 hoch, vorne zwei Wangen, in der Mitte das Lagerfeuer. Darüber kommt der Sims aus umgedrehten Schwarzeichentreppen mit Kerzen und einer Topfpflanze.');
  fireplace(b, { x: 1, y: 1, z: 7, facing: 'east', height: 4, block: 'bricks', mantel: dark.stairs });
  b.step('Schornstein', 'Mauere den Schornstein mittig über der Feuerstelle 12 Blöcke hoch durch Decke, Zimmer und Dach, setz oben einen Heuballen, ein Lagerfeuer und einen Kranz aus Ziegeltreppen.');
  chimney(b, { x: 1, y: FLOOR_Y, z: 7, height: 12, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
}

function taproom(b) {
  b.phase('Schankraum', 'Richte den Schankraum ein: hinten links die Treppe nach oben, rechts die Theke mit der Fasswand, in der Mitte die Tische.', {
    tips: [
      'Die Theke aus oberen Treppen setzt du, indem du auf die obere Hälfte des Blocks davor zielst und dabei nach Osten schaust.',
      'Lass zwischen Tischen und Theke einen Gang frei – von der Tür bis zur Treppe.',
    ],
  });
  b.step('Treppe', 'Die Treppe läuft an der Rückwand von Osten nach Westen hoch: fünf Fichtentreppen, die erste 9 Blöcke von der Westwand, darunter mit Fichtenbrettern verkleidet. Die oberste Stufe sitzt im Treppenloch der Decke.');
  straightStairs(b, { x: 9, y: 1, z: 1, facing: 'west', width: 1, height: 5, stairs: spruce.stairs, support: spruce.planks });
  b.step('Theke', 'Die Theke ist eine Reihe oberer Fichtentreppen (hohe Seite nach Osten, zur Bedienseite) 10 Blöcke von der Westwand, 5 lang, mit einem Knick bis zur Ostwand. Der Durchgang hinter die Theke liegt neben der Treppe.');
  for (let z = 3; z <= 7; z++) b.set(10, 1, z, `${spruce.stairs}[facing=east,half=top]`);
  for (let x = 11; x <= 13; x++) b.set(x, 1, 7, `${spruce.stairs}[facing=north,half=top]`);
  b.set(10, 2, 4, 'brewing_stand');
  b.set(10, 2, 6, 'candle[candles=3,lit=true]');
  b.set(12, 2, 7, 'flower_pot');
  b.set(11, 2, 7, 'potted_red_tulip');
  b.step('Fasswand und Küche', 'Hinter der Theke stehen an der Ostwand Fässer in zwei Lagen (Deckel nach Westen), darüber eine Reihe Fichtenregale (Öffnung nach Westen) für Krüge und Flaschen. In der Ecke an der Rückwand stehen ein Räucherofen und ein Kessel mit Wasser.');
  for (let z = 2; z <= 6; z++) for (let y = 1; y <= 2; y++) b.set(13, y, z, 'barrel[facing=west]');
  for (let z = 2; z <= 6; z++) b.set(13, 3, z, `${spruce.shelf}[facing=west]`);
  b.set(12, 1, 1, 'smoker[facing=south,lit=true]');
  b.set(13, 1, 1, 'water_cauldron[level=3]');
  b.step('Tische', 'Zwei lange Tische mit Stühlen aus Fichtentreppen stehen in der Mitte, dazu zwei Stehfässer mit Kerzen an der Westwand (eines neben dem Fenster, eines vor dem Kamin).');
  diningTable(b, { x: 5, y: 1, z: 4, length: 3, width: 1, wood: 'fichte', top: 'slab' });
  diningTable(b, { x: 5, y: 1, z: 8, length: 3, width: 1, wood: 'fichte', top: 'slab', headChairs: false });
  for (const z of [2, 9]) {
    b.set(2, 1, z, 'barrel[facing=up]');
    b.set(2, 2, z, 'candle[candles=2,lit=true]');
  }
}

function guestRooms(b) {
  b.phase('Obergeschoss', 'Oben liegen der Flur und zwei Gästezimmer. Am Treppenloch schützt ein Geländer, am Ende des Flurs führt eine Leiter auf den Dachboden.', {
    tips: ['Setz die Zimmertüren so, dass sie nach innen aufgehen – du stehst beim Setzen im Flur und schaust ins Zimmer.'],
  });
  b.step('Geländer und Leiter', 'Ums Treppenloch kommt ein Fichtenzaun. An der Ostwand des Flurs führt eine Leiter durch ein Loch in der Decke auf den Dachboden.');
  b.fill(6, 6, 2, 7, 6, 2, spruce.fence);
  b.set(8, 6, 1, spruce.fence);
  b.fill(X2 - 1, 6, 1, X2 - 1, PLATE_Y, 1, 'ladder[facing=west]');
  b.step('Zimmertüren', 'Jedes Zimmer bekommt eine Fichtentür aus dem Flur.');
  doorway(b, { x: 4, y: 6, z: 4, facing: 'north', door: spruce.door, frame: null });
  doorway(b, { x: 10, y: 6, z: 4, facing: 'north', door: spruce.door, frame: null });
  b.step('Gästezimmer', 'Beide Zimmer sind 6 × 6 groß: Bett mit dem Kopfteil an der Vorderwand, Nachttische mit Licht, Truhe am Fußende, Teppich, ein Bücherregal und ein Schrank aus Brettern mit Falltür-Türen.');
  bedroom(b, { x: 6, y: 6, z: UP_Z2 - 1, facing: 'north', width: 6, depth: 6, wood: 'fichte', color: 'rot', rug: 'braun' });
  bedroom(b, { x: X2 - 1, y: 6, z: UP_Z2 - 1, facing: 'north', width: 6, depth: 6, wood: 'fichte', color: 'gruen', rug: 'braun' });
  b.step('Flur und Dachboden', 'Im Flur steht hinter dem Treppengeländer eine Bank aus Fichtentreppen (Lehne an der Rückwand). Auf dem Dachboden lagern Heuballen, Fässer und Truhen.');
  for (let x = 9; x <= 11; x++) b.set(x, 6, 1, `${spruce.stairs}[facing=north]`);
  for (const [x, y, z] of [[2, 10, 2], [3, 10, 2], [2, 11, 2], [12, 10, 6], [12, 10, 7], [12, 11, 6]]) b.set(x, y, z, 'hay_block[axis=y]');
  for (const [x, z] of [[6, 2], [7, 2], [8, 2], [12, 4]]) b.set(x, PLATE_Y + 1, z, 'barrel[facing=up]');
  b.set(4, PLATE_Y + 1, 2, 'chest[facing=south,type=single]');
}

// Höhe der Dachtreppe über der Zeile z (Satteldach mit Überstand 1, Traufe auf PLATE_Y).
const roofY = (z) => PLATE_Y + Math.min(z + 1, UP_Z2 + 1 - z);

// Dachboden beleuchten: lightRoom rechnet im Rechteck. Felder über der Dachfläche werden für die Rechnung kurz mit
// Barrieren gefüllt (sonst landen Laternen außen auf dem Dach) und danach wieder entfernt.
function lightUnderRoof(b, box) {
  const temp = [];
  for (let y = box.y1; y <= box.y2; y++) {
    for (let z = box.z1; z <= box.z2; z++) {
      for (let x = box.x1; x <= box.x2; x++) {
        if (y < roofY(z) || b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, 'barrier');
        temp.push([x, y, z]);
      }
    }
  }
  lightRoom(b, box, { mode: 'floor' });
  for (const [x, y, z] of temp) b.remove(x, y, z);
}

function lights(b) {
  b.phase('Licht', 'Häng Laternen auf: über den Tischen im Schankraum, im Flur, in den Zimmern und auf dem Dachboden. Kein Feld drinnen darf dunkel bleiben, sonst erscheinen Monster.');
  b.step('Schankraum');
  hangingLantern(b, { x: 6, y: GROUND_TOP, z: 4, chain: 0 });
  hangingLantern(b, { x: 6, y: GROUND_TOP, z: 8, chain: 0 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: X2 - 1, y2: GROUND_TOP, z2: Z2 - 1 });
  b.step('Obergeschoss und Dachboden');
  lightRoom(b, { x1: 1, y1: 6, z1: 1, x2: X2 - 1, y2: 8, z2: 3 });
  lightRoom(b, { x1: 1, y1: 6, z1: 5, x2: 6, y2: 8, z2: UP_Z2 - 1 });
  lightRoom(b, { x1: 8, y1: 6, z1: 5, x2: X2 - 1, y2: 8, z2: UP_Z2 - 1 });
  lightUnderRoof(b, { x1: 1, y1: PLATE_Y + 1, z1: 1, x2: X2 - 1, y2: 14, z2: UP_Z2 - 1 });
  b.step('Außen', 'Neben der Tür hängen zwei Laternen an Zaun-Armen.');
  wallLantern(b, { x: 7, y: 3, z: Z2, facing: 'south', style: 'bracket', arm: dark.fence });
  wallLantern(b, { x: 11, y: 3, z: Z2, facing: 'south', style: 'bracket', arm: dark.fence });
}

function signAndGarden(b) {
  b.phase('Wirtshausschild und Umgebung', 'Zum Schluss das Schild, der Weg, ein kleiner Biergarten unter einer Eiche und Blumen vor dem Haus.', {
    tips: ['Ein Hängeschild hängt unter einem Zaun, wenn du beim Setzen auf die Unterseite des Zauns klickst.'],
  });
  b.step('Wirtshausschild', 'An der Südostecke ragt auf Höhe des Vorsprungs ein Ausleger aus zwei Schwarzeichenzäunen nach Osten. Darunter hängt ein Hängeschild aus Schwarzeiche mit der Schrift nach Süden – schreib den Namen deiner Taverne darauf.');
  b.set(X2 + 1, FLOOR_Y, UP_Z2, dark.fence);
  b.set(X2 + 2, FLOOR_Y, UP_Z2, dark.fence);
  b.set(X2 + 2, FLOOR_Y - 1, UP_Z2, `${dark.hangingSign}[attached=false,rotation=0]`);
  b.note(X2 + 2, FLOOR_Y - 1, UP_Z2, 'Wirtshausschild: schreib den Namen der Taverne darauf.');
  b.step('Weg', 'Leg vor der Tür einen 3 breiten Erdweg nach Süden.');
  path(b, { x: 9, y: 0, z: Z2 + 1, facing: 'south', length: 9, width: 3, mix: 'erde', wiggle: 1, seed: 'taverne' });
  b.step('Biergarten', 'Östlich der Taverne steht ein Tisch mit vier Stühlen unter einer Eiche, daneben zwei Fässer.');
  tree(b, { x: 21, y: 1, z: 3, species: 'eiche', size: 'mittel', seed: 9 });
  diningTable(b, { x: 17, y: 1, z: 5, length: 2, width: 1, wood: 'fichte', top: 'slab', headChairs: false, decor: true });
  b.set(17, 1, 8, 'barrel[facing=up]');
  b.set(18, 1, 8, 'barrel[facing=up]');
  b.step('Blumen und Büsche', 'Vor der Westhälfte der Front liegt ein Blumenbeet, an den Ecken stehen Büsche.');
  flowerBed(b, { x: 1, y: 0, z: 12, width: 6, depth: 2, facing: 'south', palette: 'bunt', seed: 4 });
  bush(b, { x: -3, y: 1, z: 2, size: 'klein', seed: 2 });
  bush(b, { x: -2, y: 1, z: 17, size: 'mittel', leaves: 'azalee', seed: 3 });
  bush(b, { x: 21, y: 1, z: 16, size: 'klein', seed: 5 });
  vegetation(b, { x: -6, y: 2, z: -6, width: 33, depth: 29, mix: 'wiese', density: 0.2, shape: 'eckig', seed: 31 });
}

export default function build(b) {
  foundation(b);
  groundFloor(b);
  upperFloor(b);
  roof(b);
  openings(b);
  chimneyAndHearth(b);
  taproom(b);
  guestRooms(b);
  lights(b);
  signAndGarden(b);
}
