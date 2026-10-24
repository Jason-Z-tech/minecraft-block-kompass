// Villa: symmetrischer Mittelbau (24 × 15, zwei Geschosse, Walmdach) mit zwei einstöckigen Seitenflügeln, deren Flachdächer
// Terrassen sind. Vorne ein Portikus mit vier Säulen, darauf der Balkon, davor eine Freitreppe; im Süden ein formaler
// Garten mit Brunnen, Hecken-Beeten und Wegen. Symmetrieachse x = 11,5 (Spiegel: x → 23 − x).
// Höhen: Gelände y = 0, Sockel y 1 … 3 (Fußboden EG y = 3), EG y 4 … 8, Decke y = 9, OG y 10 … 13, Dachplatte y = 14.

import { formatState } from '../../core/blockstate.js';
import {
  window, doorway, column, arch, dormer, chimney, hangingLantern, lampPost, floorPattern,
  bedroom, kitchen, diningTable, bookWall, storage, fireplace, lightRoom,
  tree, bush, terrain,
} from '../lib/index.js';

export const meta = {
  id: 'villa',
  title: 'Villa',
  category: 'haeuser',
  subtitle: 'Symmetrische Villa mit Säulenportikus, Walmdach und Brunnengarten',
  tags: ['Haus', 'Villa', 'Herrenhaus', 'Klassisch', 'Säulen', 'Portikus', 'Walmdach', 'Balkon', 'Dachterrasse', 'Garten', 'Brunnen', 'Symmetrisch', 'Einrichtung', 'Groß'],
  aliases: [
    'villa', 'vila', 'villla', 'herrenhaus', 'mansion', 'manor', 'manor house', 'landhaus', 'landsitz', 'herrschaftshaus',
    'klassische villa', 'classic villa', 'palladio', 'palladio villa', 'palladianische villa', 'stadtvilla', 'luxusvilla',
    'villa mit garten', 'villa mit brunnen', 'villa mit saeulen', 'haus mit saeulen', 'grosses haus', 'big house', 'schloss klein',
  ],
  accuracy: 'eigenes',
  difficulty: 4,
  description: 'Eine große, streng symmetrische Villa: Der zweigeschossige Mittelbau aus hellem Sandstein trägt ein Walmdach aus Tiefenschieferfliesen, links und rechts schließen einstöckige Flügel an, deren Dächer Terrassen sind. Vor dem Eingang stehen vier Quarzsäulen unter einem Balkon, eine breite Freitreppe führt hinauf. Innen gibt es Halle mit Prachttreppe, Salon, Bibliothek, Speisezimmer, Küche, zwei Schlafzimmer, Bad und Arbeitszimmer; davor liegt ein formaler Garten mit Brunnen.',
  facts: [
    'Mittelbau 24 × 15 Blöcke, mit Flügeln 40 Blöcke breit; Grundstück 50 × 52 Blöcke',
    'Vier Säulen aus Quarzsäulen mit gemeißeltem Quarz als Kapitell tragen den Balkon über dem Eingang',
    'Die Halle ist über die Treppe zwei Geschosse hoch; der Kronleuchter hängt im offenen Treppenauge',
    'Der Brunnen hat zwei Schalen: ein rundes Becken (Durchmesser 10) und eine kleine Schale auf einem Sockel',
    'Alle Räume sind mit Laternen so beleuchtet, dass auf keinem Boden Monster spawnen können',
  ],
  sources: [],
  credits: null,
  tested: null,
};

// ------------------------------------------------------------------ Palette
const WALL = 'smooth_sandstone';
const TRIM = 'smooth_quartz';
const TRIM_STAIRS = 'smooth_quartz_stairs';
const TRIM_SLAB = 'smooth_quartz_slab';
const PILLAR = 'quartz_pillar';
const PLINTH = 'stone_bricks';
const BALUSTER = 'sandstone_wall';
const ROOF = { stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'deepslate_tiles' };
const WOOD_DARK = 'dark_oak_planks';
const FENCE_DARK = 'dark_oak_fence';
const DOOR = 'dark_oak_door';
const HEDGE = formatState('oak_leaves', { persistent: 'true' });
const HEDGE_TALL = formatState('dark_oak_leaves', { persistent: 'true' });

// ------------------------------------------------------------------ Grundriss
const MAIN = { x1: 0, z1: 0, x2: 23, z2: 14 };
const WINGS = [{ x1: -8, x2: 0, outer: -8 }, { x1: 23, x2: 31, outer: 31 }];
const WING_Z = { z1: 2, z2: 12 };
const PLOT = { x1: -13, z1: -6, x2: 36, z2: 45 };
const PORTICO = { x1: 3, x2: 20, z1: 15, z2: 19 };
const COLUMNS_X = [4, 8, 15, 19];
const STAIRWELL = { x1: 10, x2: 13, z1: 5, z2: 9 };
const FLOOR_GF = 3;
const FLOOR_UF = 9;
const TOP = 14;

const st = (id, facing, half = 'bottom') => formatState(id, { facing, half });
const slab = (id, type = 'bottom') => formatState(id, { type });
const axis = (id, a) => formatState(id, { axis: a });
const mirrorX = (x) => 23 - x;
const OUTWARD = { south: [0, 1], north: [0, -1], west: [-1, 0], east: [1, 0] };
const OPPOSITE = { south: 'north', north: 'south', west: 'east', east: 'west' };

// Fenster mit Fensterbank (optional) und einer Verdachung aus oberen Quarztreppen über der Öffnung.
function classicWindow(b, { x, y, z, facing, height, sill = true, hood = true }) {
  window(b, { x, y, z, facing, width: 1, height, style: 'pane', sill: sill ? TRIM_STAIRS : null });
  if (hood) {
    const [dx, dz] = OUTWARD[facing];
    b.set(x + dx, y + height, z + dz, st(TRIM_STAIRS, OPPOSITE[facing], 'top'));
  }
}

// Balustrade: Mauer-Docken zwischen Quarzsäulen-Pfosten mit Stufe obendrauf.
function balustrade(b, cells, posts, y) {
  for (const [x, z] of cells) b.set(x, y, z, BALUSTER);
  for (const [x, z] of posts) {
    b.set(x, y, z, axis(PILLAR, 'y'));
    b.set(x, y + 1, z, slab(TRIM_SLAB));
  }
}

function rectEdge(x1, z1, x2, z2, sides) {
  const cells = [];
  if (sides.includes('north')) for (let x = x1; x <= x2; x++) cells.push([x, z1]);
  if (sides.includes('south')) for (let x = x1; x <= x2; x++) cells.push([x, z2]);
  if (sides.includes('west')) for (let z = z1; z <= z2; z++) cells.push([x1, z]);
  if (sides.includes('east')) for (let z = z1; z <= z2; z++) cells.push([x2, z]);
  return cells;
}

// ------------------------------------------------------------------ Kapitel

function ground(b) {
  b.phase('Grundstück abstecken', 'Das Grundstück ist 50 × 52 Blöcke groß und eben: oben Gras, darunter zwei Ebenen Erde. Der Mittelbau steht im Norden, davor bleibt viel Platz für den Garten.', {
    tips: ['Markiere zuerst die Symmetrieachse: Sie verläuft genau zwischen der 12. und 13. Blockreihe des Mittelbaus. Alles links davon baust du rechts gespiegelt.'],
  });
  terrain(b, { x: PLOT.x1, y: -2, z: PLOT.z1, width: PLOT.x2 - PLOT.x1 + 1, depth: PLOT.z2 - PLOT.z1 + 1, height: 2, seed: 17 });
  b.step('Kieswege abstecken', 'Leg gleich die Wege an, dann siehst du beim Bauen immer, wo was hinkommt: Der Hauptweg (6 breit) läuft von der späteren Freitreppe bis zur Straße und weitet sich in der Mitte zu einem 14 × 14 großen Platz für den Brunnen. Ein Querweg (2 breit) teilt den Garten, hinter dem Haus liegt ein kleiner Kieshof. Ersetz dafür das Gras durch Kies und fass die Wege mit poliertem Andesit ein.');
  gravelPath(b, 9, 23, 14, 26, ['west', 'east']);
  gravelPath(b, 9, 41, 14, 44, ['west', 'east']);
  gravelPath(b, 5, 27, 18, 40, ['north', 'south', 'west', 'east']);
  for (const x of [9, 10, 11, 12, 13, 14]) { b.set(x, 0, 26, 'gravel'); b.set(x, 0, 41, 'gravel'); }
  gravelPath(b, -11, 33, 3, 34, ['north', 'south']);
  gravelPath(b, 20, 33, 34, 34, ['north', 'south']);
  for (const z of [33, 34]) { b.set(4, 0, z, 'gravel'); b.set(19, 0, z, 'gravel'); }
  b.fill(8, 0, -5, 15, 0, -4, 'gravel');
}

function plinth(b) {
  b.phase('Sockel und Fußböden', 'Die Villa steht auf einem 3 Blöcke hohen Sockel aus Steinziegeln, damit sie erhaben wirkt. Mauere zuerst den Rand von Mittelbau (24 × 15) und Flügeln (je 9 × 11, um 2 nach hinten versetzt), füll das Innere 2 Ebenen hoch mit Erde auf und leg auf Ebene 6 die Fußböden. Vor dem Mittelbau ragt der Sockel des Portikus 5 Blöcke nach vorne.', {
    tips: [
      'Setz zuerst die vier Ecken des Mittelbaus, dann die Ecken der Flügel – so siehst du sofort, ob alles symmetrisch ist.',
      'Die Fußböden haben Muster: Schachbrett in der Halle, Fischgrät im Salon, Rahmenmuster in Speisezimmer und Bibliothek.',
    ],
  });
  b.walls(MAIN.x1, 1, MAIN.z1, MAIN.x2, FLOOR_GF, MAIN.z2, PLINTH);
  for (const w of WINGS) b.walls(w.x1, 1, WING_Z.z1, w.x2, FLOOR_GF, WING_Z.z2, PLINTH);
  b.fill(MAIN.x1 + 1, 1, MAIN.z1 + 1, MAIN.x2 - 1, 2, MAIN.z2 - 1, 'dirt');
  for (const w of WINGS) b.fill(w.x1 + 1, 1, WING_Z.z1 + 1, w.x2 - 1, 2, WING_Z.z2 - 1, 'dirt');
  // Portikus-Sockel
  b.fill(PORTICO.x1, 1, PORTICO.z1, PORTICO.x2, 2, PORTICO.z2, PLINTH);
  floorPattern(b, { x: PORTICO.x1, y: FLOOR_GF, z: PORTICO.z1, width: PORTICO.x2 - PORTICO.x1 + 1, depth: PORTICO.z2 - PORTICO.z1 + 1, pattern: 'border', blocks: ['polished_diorite', TRIM] });
  // Fußböden Erdgeschoss
  floorPattern(b, { x: 1, y: FLOOR_GF, z: 1, width: 6, depth: 13, pattern: 'herringbone', blocks: ['stripped_oak_log', 'stripped_dark_oak_log'] });
  floorPattern(b, { x: 8, y: FLOOR_GF, z: 1, width: 8, depth: 13, pattern: 'checker', blocks: [TRIM, 'polished_deepslate'] });
  floorPattern(b, { x: 17, y: FLOOR_GF, z: 1, width: 6, depth: 13, pattern: 'border', blocks: ['spruce_planks', WOOD_DARK] });
  floorPattern(b, { x: -7, y: FLOOR_GF, z: 3, width: 7, depth: 9, pattern: 'border', blocks: ['spruce_planks', WOOD_DARK] });
  floorPattern(b, { x: 24, y: FLOOR_GF, z: 3, width: 7, depth: 9, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'] });
  for (const x of [7, 16]) b.fill(x, FLOOR_GF, 1, x, FLOOR_GF, 13, WOOD_DARK);
}

function groundFloorWalls(b) {
  b.phase('Erdgeschoss: Mauern', 'Die Mauern des Erdgeschosses sind 5 Blöcke hoch (Ebene 7 bis 11) aus glattem Sandstein. An die Ecken des Mittelbaus und der Flügel kommen Quarzsäulen als Eckpfeiler. Innen trennen zwei Wände Salon, Halle und Speisezimmer.', {
    tips: ['Lass die Öffnungen erst einmal zu – Fenster, Türen und Bögen setzt du später hinein. So bleiben die Abstände leichter zählbar.'],
  });
  b.walls(MAIN.x1, 4, MAIN.z1, MAIN.x2, 8, MAIN.z2, WALL);
  for (const w of WINGS) b.walls(w.x1, 4, WING_Z.z1, w.x2, 8, WING_Z.z2, WALL);
  for (const x of [7, 16]) b.fill(x, 4, 1, x, 8, 13, WALL);
  for (const [x, z] of [[0, 0], [23, 0], [0, 14], [23, 14]]) b.fill(x, 4, z, x, 8, z, axis(PILLAR, 'y'));
  for (const w of WINGS) for (const z of [WING_Z.z1, WING_Z.z2]) b.fill(w.outer, 4, z, w.outer, 8, z, axis(PILLAR, 'y'));
}

function porticoColumns(b) {
  b.phase('Portikus: Säulen', 'Vor dem Eingang stehen vier Säulen, 5 Blöcke hoch: unten ein Sockel aus glattem Quarz, darüber drei Quarzsäulen und oben gemeißelter Quarz als Kapitell. Um Fuß und Kapitell legst du einen Kranz aus Quarztreppen (unten normal, oben kopfüber), immer mit der hohen Seite zur Säule.', {
    tips: ['Die beiden mittleren Säulen haben 6 Blöcke Abstand – genau Platz für die Doppeltür samt Rahmen.'],
  });
  for (const x of COLUMNS_X) column(b, { x, y: 4, z: 18, height: 5 });
}

function upperSlab(b) {
  b.phase('Decke, Balkon und Terrassen', 'Die Decke über dem Erdgeschoss (Ebene 12) trägt das Obergeschoss. Außen läuft ein Gesimsband aus glattem Quarz ringsum. Über dem Portikus wird die Decke zum Balkon (innen Quarzziegel, außen ein Rand aus glattem Quarz), auf den Flügeln zur Dachterrasse mit Holzboden. Lass über der Halle ein 4 × 5 großes Treppenauge offen.', {
    tips: [
      'Setz den Balkon Reihe für Reihe von der Hauswand aus nach vorne – die Säulen tragen ihn an der Vorderkante.',
      'Unter die Vorderkante des Balkons kommt eine Reihe kopfüber gesetzter Quarztreppen als Zierbalken.',
    ],
  });
  b.fill(MAIN.x1, FLOOR_UF, MAIN.z1, MAIN.x2, FLOOR_UF, MAIN.z2, TRIM);
  b.fill(1, FLOOR_UF, 1, 22, FLOOR_UF, 13, WOOD_DARK);
  floorPattern(b, { x: 1, y: FLOOR_UF, z: 8, width: 6, depth: 6, pattern: 'border', blocks: ['spruce_planks', WOOD_DARK] });
  floorPattern(b, { x: 17, y: FLOOR_UF, z: 8, width: 6, depth: 6, pattern: 'border', blocks: ['spruce_planks', WOOD_DARK] });
  floorPattern(b, { x: 17, y: FLOOR_UF, z: 1, width: 6, depth: 6, pattern: 'border', blocks: ['spruce_planks', WOOD_DARK] });
  floorPattern(b, { x: 1, y: FLOOR_UF, z: 1, width: 6, depth: 6, pattern: 'checker', blocks: [TRIM, 'cyan_terracotta'] });
  b.fill(STAIRWELL.x1, FLOOR_UF, STAIRWELL.z1, STAIRWELL.x2, FLOOR_UF, STAIRWELL.z2, 'air');
  // Balkon über dem Portikus
  b.fill(PORTICO.x1, FLOOR_UF, PORTICO.z1, PORTICO.x2, FLOOR_UF, PORTICO.z2 + 1, TRIM);
  b.fill(PORTICO.x1 + 1, FLOOR_UF, PORTICO.z1, PORTICO.x2 - 1, FLOOR_UF, PORTICO.z2, 'quartz_bricks');
  for (let x = PORTICO.x1; x <= PORTICO.x2; x++) b.set(x, FLOOR_UF - 1, PORTICO.z2 + 1, st(TRIM_STAIRS, 'north', 'top'));
  // Flügeldächer = Terrassen
  b.fill(-8, FLOOR_UF, WING_Z.z1, -1, FLOOR_UF, WING_Z.z2, TRIM);
  b.fill(-7, FLOOR_UF, WING_Z.z1 + 1, -1, FLOOR_UF, WING_Z.z2 - 1, 'spruce_planks');
  b.fill(24, FLOOR_UF, WING_Z.z1, 31, FLOOR_UF, WING_Z.z2, TRIM);
  b.fill(24, FLOOR_UF, WING_Z.z1 + 1, 30, FLOOR_UF, WING_Z.z2 - 1, 'spruce_planks');
}

function upperWalls(b) {
  b.phase('Obergeschoss: Mauern', 'Das Obergeschoss ist 4 Blöcke hoch (Ebene 13 bis 16). Innen teilen Wände es in Bad, Elternschlafzimmer, Galerie, Arbeitszimmer und Gästezimmer.');
  b.walls(MAIN.x1, 10, MAIN.z1, MAIN.x2, 13, MAIN.z2, WALL);
  for (const x of [7, 16]) b.fill(x, 10, 1, x, 13, 13, WALL);
  b.fill(1, 10, 7, 6, 13, 7, WALL);
  b.fill(17, 10, 7, 22, 13, 7, WALL);
  for (const [x, z] of [[0, 0], [23, 0], [0, 14], [23, 14]]) b.fill(x, 10, z, x, 13, z, axis(PILLAR, 'y'));
  // Schornsteinzüge (laufen vom Kamin im Erdgeschoss durch bis übers Dach)
  for (const x of [3, 20]) b.fill(x, FLOOR_UF, 1, x, 13, 1, 'bricks');
}

function topPlate(b) {
  b.phase('Dachplatte und Hauptgesims', 'Schließ das Obergeschoss mit einer Decke aus Schwarzeichenbrettern ab (Ebene 17), außen mit einem Rand aus glattem Quarz. Direkt unter dem späteren Dachüberstand setzt du ringsum kopfüber Quarztreppen mit der hohen Seite zur Wand – das ist das Hauptgesims.');
  b.fill(MAIN.x1, TOP, MAIN.z1, MAIN.x2, TOP, MAIN.z2, TRIM);
  b.fill(MAIN.x1 + 1, TOP, MAIN.z1 + 1, MAIN.x2 - 1, TOP, MAIN.z2 - 1, WOOD_DARK);
  for (const x of [3, 20]) b.set(x, TOP, 1, 'bricks');
  for (let x = MAIN.x1 - 1; x <= MAIN.x2 + 1; x++) {
    b.set(x, TOP - 1, MAIN.z1 - 1, st(TRIM_STAIRS, 'south', 'top'));
    b.set(x, TOP - 1, MAIN.z2 + 1, st(TRIM_STAIRS, 'north', 'top'));
  }
  for (let z = MAIN.z1; z <= MAIN.z2; z++) {
    b.set(MAIN.x1 - 1, TOP - 1, z, st(TRIM_STAIRS, 'east', 'top'));
    b.set(MAIN.x2 + 1, TOP - 1, z, st(TRIM_STAIRS, 'west', 'top'));
  }
}

function hipRoof(b) {
  b.phase('Walmdach', 'Das Walmdach aus Tiefenschieferfliesen steigt von allen vier Seiten gleichmäßig an. Die unterste Reihe steht einen Block über (Ebene 17), jede weitere Reihe sitzt einen Block weiter innen und eine Ebene höher, die hohe Seite der Treppen zeigt immer zur Dachmitte. Oben schließt ein First aus Stufen ab.', {
    tips: [
      'Bau das Dach Ring für Ring. An den Ecken bilden die Treppen von selbst Außenecken, wenn du beide Seiten bis in die Ecke führst.',
      'Jeder neue Ring berührt den darunter nur über Eck. Setz für die erste Treppe eines Rings einen Hilfsblock (z. B. Erde) oben auf die Treppe darunter, setz die neue Treppe seitlich daran und nimm den Hilfsblock wieder weg – der Rest des Rings hält sich dann an seinen Nachbarn.',
    ],
  });
  b.roof({ x1: MAIN.x1, z1: MAIN.z1, x2: MAIN.x2, z2: MAIN.z2, y: TOP, type: 'hip', axis: 'x', ...ROOF, overhang: 1 });
  b.step('Dachgauben', 'Auf der Vorderseite sitzen zwei Gauben mit kleinem Satteldach. Ihre Vorderwand steht auf der Mauerkrone (Ebene 18), die Ecken sind Quarzsäulen.');
  for (const x of [5, mirrorX(5)]) dormer(b, { x, y: TOP + 1, z: MAIN.z2, facing: 'south', width: 3, wallHeight: 2, wall: WALL, corner: PILLAR, stairs: ROOF.stairs, slab: ROOF.slab });
  b.step('Schornsteine', 'Zwei Schornsteine aus Ziegeln stehen über den Kaminen von Salon und Speisezimmer. Sie beginnen auf dem Dachboden und ragen über den First; oben brennt ein Lagerfeuer, ein Kranz aus Ziegeltreppen schließt ab.');
  for (const x of [3, 20]) chimney(b, { x, y: TOP + 1, z: 1, height: 8, block: 'bricks', smoke: 'normal', rim: 'brick_stairs' });
}

function windowsAndDoors(b) {
  b.phase('Fenster und Türen', 'Alle Fenster sitzen genau übereinander und spiegeln sich an der Mittelachse. Unten sind sie 3 hoch, oben 2 hoch, jedes mit einer Fensterbank und einer Verdachung aus Quarztreppen. In die Flügel kommen außen große Bogenfenster.');
  b.step('Fenster', 'Setz die Glasscheiben, darunter eine kopfüber gesetzte Quarztreppe als Fensterbank und darüber eine zweite als Verdachung – beide mit der hohen Seite zur Wand.');
  // Erdgeschoss
  for (const x of [2, 21]) classicWindow(b, { x, y: 5, z: MAIN.z2, facing: 'south', height: 3 });
  for (const x of [5, 18]) classicWindow(b, { x, y: 5, z: MAIN.z2, facing: 'south', height: 3, sill: false });
  for (const x of [1, 5, 9, 14, 18, 22]) classicWindow(b, { x, y: 5, z: MAIN.z1, facing: 'north', height: 3 });
  for (const z of [1, 13]) {
    classicWindow(b, { x: MAIN.x1, y: 5, z, facing: 'west', height: 3 });
    classicWindow(b, { x: MAIN.x2, y: 5, z, facing: 'east', height: 3 });
  }
  for (const x of [-6, -2, 25, 29]) classicWindow(b, { x, y: 5, z: WING_Z.z2, facing: 'south', height: 3 });
  for (const x of [25, 29]) classicWindow(b, { x, y: 5, z: WING_Z.z1, facing: 'north', height: 3 });
  window(b, { x: -8, y: 4, z: 7, facing: 'west', width: 3, height: 4, style: 'arched', stairs: TRIM_STAIRS, slab: TRIM_SLAB, sill: TRIM_STAIRS });
  window(b, { x: 31, y: 4, z: 7, facing: 'east', width: 3, height: 4, style: 'arched', stairs: TRIM_STAIRS, slab: TRIM_SLAB, sill: TRIM_STAIRS });
  // Obergeschoss
  for (const x of [2, 21]) classicWindow(b, { x, y: 10, z: MAIN.z2, facing: 'south', height: 2 });
  for (const x of [5, 9, 14, 18]) classicWindow(b, { x, y: 10, z: MAIN.z2, facing: 'south', height: 2, sill: false });
  for (const x of [2, 5, 9, 14, 18, 21]) classicWindow(b, { x, y: 10, z: MAIN.z1, facing: 'north', height: 2 });
  for (const z of [3, 12]) {
    classicWindow(b, { x: MAIN.x1, y: 10, z, facing: 'west', height: 2, sill: false });
    classicWindow(b, { x: MAIN.x2, y: 10, z, facing: 'east', height: 2, sill: false });
  }

  b.step('Außentüren', 'Die Haustür ist eine Doppeltür aus Schwarzeiche mit einem Rahmen aus Quarzsäulen und einem Oberlicht aus Glas. Hinten führt eine gleiche Tür in den Garten, oben eine Doppeltür auf den Balkon und je eine Tür auf die Flügelterrassen.');
  doorway(b, { x: 11, y: 4, z: MAIN.z2, facing: 'south', door: DOOR, width: 2, frame: PILLAR });
  doorway(b, { x: 12, y: 4, z: MAIN.z1, facing: 'north', door: DOOR, width: 2, frame: PILLAR });
  for (const z of [MAIN.z1, MAIN.z2]) b.fill(11, 7, z, 12, 8, z, 'glass_pane');
  doorway(b, { x: 11, y: 10, z: MAIN.z2, facing: 'south', door: DOOR, width: 2, frame: null });
  b.fill(11, 12, MAIN.z2, 12, 12, MAIN.z2, 'glass_pane');
  doorway(b, { x: MAIN.x1, y: 10, z: 10, facing: 'west', door: DOOR, frame: null });
  doorway(b, { x: MAIN.x2, y: 10, z: 10, facing: 'east', door: DOOR, frame: null });
  b.note(11, 4, MAIN.z2, 'Haustür: Doppeltür mit Quarzrahmen und Oberlicht');

  b.step('Innentüren und Bögen', 'Zwischen Halle, Salon und Speisezimmer öffnen sich breite Rundbögen (3 breit, 4 hoch), ebenso vom Salon in die Bibliothek. Zur Küche, zu Bad, Schlafzimmern und Arbeitszimmer führen einfache Türen.');
  arch(b, { x: 7, y: 4, z: 11, facing: 'west', width: 3, height: 4, style: 'round', block: WALL, stairs: TRIM_STAIRS, slab: TRIM_SLAB });
  arch(b, { x: 16, y: 4, z: 11, facing: 'east', width: 3, height: 4, style: 'round', block: WALL, stairs: TRIM_STAIRS, slab: TRIM_SLAB });
  arch(b, { x: 0, y: 4, z: 7, facing: 'west', width: 3, height: 4, style: 'round', block: WALL, stairs: TRIM_STAIRS, slab: TRIM_SLAB });
  doorway(b, { x: 23, y: 4, z: 7, facing: 'east', door: 'spruce_door', frame: null });
  for (const z of [3, 10]) {
    doorway(b, { x: 7, y: 10, z, facing: 'west', door: DOOR, frame: null });
    doorway(b, { x: 16, y: 10, z, facing: 'east', door: DOOR, frame: null });
  }
}

function porticoAndTerraces(b) {
  b.phase('Freitreppe und Balustraden', 'Jetzt die Schmuckstücke außen: die Freitreppe zum Portikus, Balustraden aus Sandsteinmauern zwischen Quarzpfosten auf Balkon und Terrassen und Möbel für draußen.');
  b.step('Freitreppe', 'Die Freitreppe ist 10 breit und hat drei Stufen aus glatten Quarztreppen, die hohe Seite zeigt zum Haus (nach Norden). Die Wangen links und rechts sind Steinziegel mit Quarzstufen obendrauf, vorne steht je ein Blumentopf. Hinten führt eine schmale Treppe gleicher Art (2 breit, hohe Seite nach Süden) von der Gartentür in den Kieshof.');
  for (let k = 0; k < 3; k++) {
    const z = 22 - k;
    const y = 1 + k;
    for (let x = 7; x <= 16; x++) {
      if (y > 1) b.fill(x, 1, z, x, y - 1, z, PLINTH);
      b.set(x, y, z, st(TRIM_STAIRS, 'north'));
    }
  }
  for (const x of [6, 17]) {
    b.fill(x, 1, 20, x, FLOOR_GF, 22, PLINTH);
    b.set(x, FLOOR_GF + 1, 20, slab(TRIM_SLAB));
    b.set(x, FLOOR_GF + 1, 21, slab(TRIM_SLAB));
    b.set(x, FLOOR_GF + 1, 22, 'potted_azalea_bush');
  }
  b.note(11, 1, 22, 'Freitreppe: drei Stufen, hohe Seite zum Haus');
  // Hintertreppe in den Hof
  for (let k = 0; k < 3; k++) {
    const z = -1 - k;
    const y = FLOOR_GF - k;
    for (const x of [11, 12]) {
      if (y > 1) b.fill(x, 1, z, x, y - 1, z, PLINTH);
      b.set(x, y, z, st(TRIM_STAIRS, 'south'));
    }
    for (const x of [10, 13]) b.fill(x, 1, z, x, y, z, PLINTH);
  }

  b.step('Balustraden', 'Auf dem Portikus sichern Sandsteinmauern die offenen Seiten zwischen Hauswand und Säulen, neben der Treppe stehen Kübelpflanzen. Auf Balkon und Terrassen läuft die Balustrade ringsum: Sandsteinmauern als Docken, an den Ecken und über den Säulen Pfosten aus Quarzsäulen mit einer Quarzstufe obendrauf.');
  balustrade(b, [[3, 15], [3, 16], [20, 15], [20, 16]], [], FLOOR_GF + 1);
  for (const x of [6, 17]) b.set(x, FLOOR_GF + 1, PORTICO.z2, 'potted_azalea_bush');
  balustrade(b, rectEdge(PORTICO.x1, PORTICO.z1, PORTICO.x2, PORTICO.z2 + 1, ['south', 'west', 'east']), [[3, 20], [8, 20], [15, 20], [20, 20], [3, 15], [20, 15]], FLOOR_UF + 1);
  balustrade(b, rectEdge(-8, WING_Z.z1, -1, WING_Z.z2, ['north', 'south', 'west']), [[-8, 2], [-8, 12], [-8, 7], [-4, 2], [-4, 12]], FLOOR_UF + 1);
  balustrade(b, rectEdge(24, WING_Z.z1, 31, WING_Z.z2, ['north', 'south', 'east']), [[31, 2], [31, 12], [31, 7], [27, 2], [27, 12]], FLOOR_UF + 1);

  b.step('Terrassenmöbel', 'Auf jede Terrasse kommt ein kleiner Tisch (Zaun mit weißem Teppich) mit zwei Stühlen aus Treppen und Kübelpflanzen in den Ecken.');
  for (const cx of [-4, 27]) {
    b.set(cx, 10, 7, FENCE_DARK);
    b.set(cx, 11, 7, 'white_carpet');
    b.set(cx - 1, 10, 7, st('dark_oak_stairs', 'west'));
    b.set(cx + 1, 10, 7, st('dark_oak_stairs', 'east'));
  }
  for (const [x, z] of [[-7, 3], [-7, 11], [30, 3], [30, 11]]) b.set(x, 10, z, 'potted_azalea_bush');
  for (const [x, z] of [[4, 19], [19, 19]]) b.set(x, 10, z, 'potted_flowering_azalea_bush');
}

function grandStairs(b) {
  b.phase('Halle und Prachttreppe', 'Die Halle reicht über die Treppe bis unters Dach. Die Treppe ist 4 breit und steigt von vorne nach hinten (nach Norden) bis auf die Galerie im Obergeschoss.');
  b.step('Prachttreppe', 'Setz sechs Reihen glatte Quarztreppen (hohe Seite nach Norden), jede eine Ebene höher und einen Block weiter nördlich, und füll darunter mit glattem Quarz – so wirkt sie wie aus Marmor. Links und rechts laufen Wangen aus glattem Quarz mit einem Handlauf aus Schwarzeichenzaun.');
  for (let k = 0; k <= 5; k++) {
    const z = 9 - k;
    const y = 4 + k;
    for (let x = STAIRWELL.x1; x <= STAIRWELL.x2; x++) {
      if (k > 0) b.fill(x, 4, z, x, y - 1, z, TRIM);
      b.set(x, y, z, st(TRIM_STAIRS, 'north'));
    }
    for (const x of [STAIRWELL.x1 - 1, STAIRWELL.x2 + 1]) {
      b.fill(x, 4, z, x, Math.min(y, 8), z, TRIM);
      if (y + 1 <= 8) b.set(x, y + 1, z, FENCE_DARK);
      if (k === 5) b.set(x, FLOOR_UF + 1, z, FENCE_DARK);
    }
  }
  b.note(11, FLOOR_UF, 4, 'Oberste Stufe: hier kommst du auf der Galerie an');

  b.step('Galeriegeländer', 'Oben sichert ein Zaungeländer das Treppenauge an drei Seiten.');
  for (let z = STAIRWELL.z1; z <= STAIRWELL.z2; z++) for (const x of [STAIRWELL.x1 - 1, STAIRWELL.x2 + 1]) b.set(x, FLOOR_UF + 1, z, FENCE_DARK);
  for (let x = STAIRWELL.x1 - 1; x <= STAIRWELL.x2 + 1; x++) b.set(x, FLOOR_UF + 1, STAIRWELL.z2 + 1, FENCE_DARK);

  b.step('Halle einrichten', 'Ein roter Läufer führt von der Haustür zur Treppe. Links und rechts der Tür hängen rote Banner, in den Ecken stehen Pflanzen auf Sockeln aus gemeißeltem Quarz. Im Treppenauge hängt ein Kronleuchter aus zwei Laternen an Ketten von der Dachplatte.');
  for (let z = 10; z <= 13; z++) for (const x of [11, 12]) b.set(x, 4, z, 'red_carpet');
  for (const x of [9, 14]) b.set(x, 6, 13, formatState('red_wall_banner', { facing: 'north' }));
  for (const [x, z, plant] of [[8, 13, 'potted_fern'], [15, 13, 'potted_fern'], [8, 1, 'potted_bamboo'], [15, 1, 'potted_bamboo']]) {
    b.set(x, 4, z, 'chiseled_quartz_block');
    b.set(x, 5, z, plant);
  }
  for (const x of [11, 12]) hangingLantern(b, { x, y: 13, z: 7, chain: 2 });
}

function groundFloorRooms(b) {
  b.phase('Einrichtung Erdgeschoss', 'Links der Halle liegt der Salon mit Kamin, dahinter im Flügel die Bibliothek. Rechts der Halle das Speisezimmer, im rechten Flügel die Küche.');
  b.step('Salon', 'Der Kamin aus Quarzziegeln steht mittig an der Rückwand, davor ein roter Teppich mit niedrigem Tisch, ein Sofa aus Schwarzeichentreppen (hohe Seite nach Süden) und zwei Sessel. Vorne am Fenster steht ein Spieltisch, an der Seite eine Jukebox.');
  fireplace(b, { x: 3, y: 4, z: 1, facing: 'south', height: 5, block: 'quartz_bricks', mantel: 'dark_oak_stairs' });
  for (let x = 2; x <= 5; x++) {
    b.set(x, 4, 6, st('dark_oak_stairs', 'south'));
    for (let z = 3; z <= 5; z++) b.set(x, 4, z, 'red_carpet');
  }
  b.set(1, 4, 6, formatState('dark_oak_trapdoor', { facing: 'west', half: 'bottom', open: 'true' }));
  b.set(6, 4, 6, formatState('dark_oak_trapdoor', { facing: 'east', half: 'bottom', open: 'true' }));
  for (const x of [3, 4]) b.set(x, 4, 4, slab('dark_oak_slab', 'top'));
  b.set(3, 5, 4, formatState('candle', { candles: '2', lit: 'true' }));
  b.set(1, 4, 4, st('dark_oak_stairs', 'west'));
  b.set(6, 4, 4, st('dark_oak_stairs', 'east'));
  for (const x of [3, 4]) {
    b.set(x, 4, 11, slab('dark_oak_slab', 'top'));
    b.set(x, 4, 10, st('dark_oak_stairs', 'north'));
    b.set(x, 4, 12, st('dark_oak_stairs', 'south'));
  }
  b.set(4, 5, 11, 'potted_white_tulip');
  // Jukebox südlich vom Bibliotheksbogen (z 6 … 8), damit der Durchgang ganz frei bleibt.
  b.set(1, 4, 9, 'jukebox');
  b.set(1, 5, 9, formatState('candle', { candles: '1', lit: 'true' }));
  b.set(1, 4, 10, 'note_block');
  for (const [x, z] of [[1, 13], [6, 13], [6, 8]]) b.set(x, 4, z, 'potted_bamboo');

  b.step('Bibliothek', 'Im linken Flügel stehen Bücherwände an Rück- und Außenwand, mit Stämmen aus Schwarzeiche als Ständern und einer Leiter. Das Bogenfenster bleibt frei. In der Mitte ein Lesetisch mit grüner Decke, vorne zwischen den beiden Fenstern ein niedriges Regal, unter den Fenstern ein Lesesessel und ein Lesepult.');
  bookWall(b, { x: -7, y: 4, z: 3, facing: 'south', width: 7, height: 3, wood: 'schwarzeiche', chiseled: true, crown: true, ladder: true });
  bookWall(b, { x: -7, y: 4, z: 11, facing: 'east', width: 3, height: 3, wood: 'schwarzeiche', chiseled: true, crown: true });
  bookWall(b, { x: -7, y: 4, z: 5, facing: 'east', width: 2, height: 3, wood: 'schwarzeiche', chiseled: true, crown: true });
  diningTable(b, { x: -5, y: 4, z: 7, facing: 'south', length: 3, width: 1, wood: 'schwarzeiche', top: 'carpet', cloth: 'gruen', headChairs: false });
  for (let x = -5; x <= -3; x++) b.set(x, 4, 11, 'bookshelf');
  b.set(-4, 5, 11, formatState('candle', { candles: '3', lit: 'true' }));
  b.set(-2, 4, 11, formatState('lectern', { facing: 'north', has_book: 'false', powered: 'false' }));
  b.set(-1, 4, 11, 'potted_fern');
  b.set(-6, 4, 11, st('dark_oak_stairs', 'south'));

  b.step('Speisezimmer', 'Der lange Tisch für zwölf Personen steht quer zum Kamin, an den Stirnseiten je ein Stuhl. Unter den Fenstern zur Straße steht eine Anrichte aus oberen Schwarzeichenstufen mit Kerzen und Blumen.');
  fireplace(b, { x: 20, y: 4, z: 1, facing: 'south', height: 5, block: 'quartz_bricks', mantel: 'dark_oak_stairs' });
  diningTable(b, { x: 19, y: 4, z: 10, facing: 'east', length: 5, width: 2, wood: 'schwarzeiche', top: 'slab', cloth: 'weiss', headChairs: true });
  for (let x = 18; x <= 21; x++) b.set(x, 4, 13, slab('dark_oak_slab', 'top'));
  b.set(18, 5, 13, 'potted_red_tulip');
  b.set(21, 5, 13, formatState('white_candle', { candles: '3', lit: 'true' }));
  for (const [x, z] of [[17, 1], [22, 1], [22, 13], [17, 13]]) b.set(x, 4, z, 'potted_bamboo');

  b.step('Küche', 'Die Küchenzeile steht im rechten Flügel unter den hinteren Fenstern, ohne Hängeschränke. In der Mitte eine Kochinsel aus glattem Quarz, an der Außenwand Vorratstruhen und Fässer, dazu ein kleiner Tisch fürs Personal.');
  kitchen(b, { x: 24, y: 4, z: 3, facing: 'south', width: 7, wood: 'fichte', cabinets: false });
  b.fill(26, 4, 7, 28, 4, 7, TRIM);
  b.set(27, 5, 7, formatState('cake', { bites: '0' }));
  b.set(26, 5, 7, 'potted_red_tulip');
  storage(b, { x: 30, y: 4, z: 9, facing: 'west', width: 3, height: 2, chest: 'chest' });
  b.set(25, 4, 10, 'spruce_fence');
  b.set(25, 5, 10, 'white_carpet');
  b.set(25, 4, 9, st('spruce_stairs', 'north'));
  b.set(25, 4, 11, st('spruce_stairs', 'south'));
}

function upperRooms(b) {
  b.phase('Einrichtung Obergeschoss', 'Oben verbindet die Galerie um das Treppenauge alle Räume: hinten links das Bad, vorne links das Elternschlafzimmer mit Tür zur Terrasse, rechts Arbeitszimmer und Gästezimmer.');
  b.step('Galerie', 'Vorne an der Balkontür stehen zwei Sessel, hinten auf dem Treppenabsatz eine Bank mit Blick auf die Treppe.');
  b.set(9, 10, 12, st('dark_oak_stairs', 'west'));
  b.set(14, 10, 12, st('dark_oak_stairs', 'east'));
  for (const [x, z] of [[8, 13], [15, 13], [8, 1], [15, 1]]) b.set(x, 10, z, 'potted_flowering_azalea_bush');
  for (let x = 10; x <= 13; x++) b.set(x, 10, 1, st('dark_oak_stairs', 'north'));

  b.step('Elternschlafzimmer', 'Das Doppelbett steht mit dem Kopfteil an der Wand zum Bad, daneben Nachttische. Am Vorderfenster steht ein Schreibtisch, links führt eine Tür auf die Terrasse des Flügels.');
  bedroom(b, { x: 1, y: 10, z: 8, facing: 'south', width: 5, depth: 6, wood: 'schwarzeiche', color: 'rot', rug: 'weiss', double: true });
  for (const x of [5, 6]) b.set(x, 10, 13, slab('dark_oak_slab', 'top'));
  b.set(5, 10, 12, st('dark_oak_stairs', 'north'));
  b.set(6, 11, 13, formatState('candle', { candles: '1', lit: 'true' }));
  b.set(6, 10, 8, 'potted_bamboo');

  b.step('Bad', 'Die Badewanne sind zwei Kessel mit Wasser, das Waschbecken ein weiterer Kessel mit einem Stolperdrahthaken als Wasserhahn. Die Toilette ist eine Quarztreppe mit einer offenen Birkenfalltür als Deckel. Zwischen Wanne und Becken läuft der Schornstein durch.');
  for (const x of [1, 2]) b.set(x, 10, 1, formatState('water_cauldron', { level: '3' }));
  b.set(4, 10, 1, formatState('water_cauldron', { level: '3' }));
  b.set(4, 11, 1, formatState('tripwire_hook', { facing: 'south', attached: 'false', powered: 'false' }));
  b.set(6, 10, 1, st(TRIM_STAIRS, 'north'));
  b.set(6, 11, 1, formatState('birch_trapdoor', { facing: 'south', half: 'bottom', open: 'true' }));
  b.fill(2, 10, 3, 4, 10, 4, 'light_blue_carpet');
  b.set(1, 10, 6, formatState('barrel', { facing: 'up' }));
  b.set(1, 11, 6, formatState('white_candle', { candles: '2', lit: 'true' }));
  b.set(6, 10, 6, 'potted_fern');

  b.step('Arbeitszimmer', 'Eine Bücherwand steht an der Wand zum Gästezimmer. Der Schreibtisch aus Schwarzeichenstufen steht am hinteren Fenster, daneben ein Kartentisch und ein Lesepult.');
  bookWall(b, { x: 22, y: 10, z: 6, facing: 'north', width: 6, height: 3, wood: 'schwarzeiche', chiseled: true, crown: true });
  for (const x of [18, 19]) b.set(x, 10, 2, slab('dark_oak_slab', 'top'));
  b.set(18, 10, 3, st('dark_oak_stairs', 'south'));
  b.set(19, 11, 2, formatState('lantern', { hanging: 'false' }));
  b.set(22, 10, 2, 'cartography_table');
  b.set(17, 10, 1, formatState('lectern', { facing: 'south', has_book: 'false', powered: 'false' }));
  b.fill(19, 10, 4, 21, 10, 4, 'brown_carpet');

  b.step('Gästezimmer', 'Ein Einzelbett mit hellblauer Decke, Nachttische, eine Truhe und ein kleiner Schreibtisch am Fenster; rechts geht es auf die zweite Terrasse.');
  bedroom(b, { x: 18, y: 10, z: 8, facing: 'south', width: 5, depth: 6, wood: 'birke', color: 'hellblau', rug: 'hellgrau', double: false });
  for (const x of [17, 18]) b.set(x, 10, 13, slab('birch_slab', 'top'));
  b.set(18, 10, 12, st('birch_stairs', 'north'));
  b.set(17, 11, 13, 'potted_blue_orchid');
}

function lighting(b) {
  b.phase('Licht', 'Damit nirgends Monster spawnen, hängen in allen Räumen Laternen an der Decke, auch unter dem Portikus und auf dem Dachboden.', {
    tips: ['Monster spawnen in 26.2 nur bei Blocklicht 0. Jede Laterne leuchtet mit Stärke 15 und reicht damit gut 14 Blöcke weit.'],
  });
  b.step('Erdgeschoss und Portikus');
  lightRoom(b, { x1: 1, y1: 4, z1: 1, x2: 6, y2: 8, z2: 13 });
  lightRoom(b, { x1: 8, y1: 4, z1: 1, x2: 15, y2: 8, z2: 13 });
  lightRoom(b, { x1: 17, y1: 4, z1: 1, x2: 22, y2: 8, z2: 13 });
  lightRoom(b, { x1: -7, y1: 4, z1: 3, x2: -1, y2: 8, z2: 11 });
  lightRoom(b, { x1: 24, y1: 4, z1: 3, x2: 30, y2: 8, z2: 11 });
  lightRoom(b, { x1: PORTICO.x1, y1: 4, z1: PORTICO.z1, x2: PORTICO.x2, y2: 8, z2: PORTICO.z2 });
  b.step('Obergeschoss');
  lightRoom(b, { x1: 1, y1: 10, z1: 1, x2: 6, y2: 13, z2: 6 });
  lightRoom(b, { x1: 1, y1: 10, z1: 8, x2: 6, y2: 13, z2: 13 });
  lightRoom(b, { x1: 8, y1: 10, z1: 1, x2: 15, y2: 13, z2: 13 });
  lightRoom(b, { x1: 17, y1: 10, z1: 1, x2: 22, y2: 13, z2: 6 });
  lightRoom(b, { x1: 17, y1: 10, z1: 8, x2: 22, y2: 13, z2: 13 });
  b.step('Dachboden', 'Unter dem Dach hängen zwei Laternen an je zwei Kettengliedern unter den Dachtreppen; sie reichen bis in die Ecken und in die Gauben.');
  for (const x of [6, mirrorX(6)]) hangingLantern(b, { x, y: TOP + 6, z: 7, chain: 2 });
}

// Weg aus Kies (y = 0) mit Randsteinen aus poliertem Andesit an den Langseiten.
function gravelPath(b, x1, z1, x2, z2, kerbSides) {
  b.fill(x1, 0, z1, x2, 0, z2, 'gravel');
  for (const [x, z] of rectEdge(x1 - 1, z1 - 1, x2 + 1, z2 + 1, kerbSides)) b.set(x, 0, z, 'polished_andesite');
}

const armrest = (facing) => formatState('dark_oak_trapdoor', { facing, half: 'bottom', open: 'true' });

// Gartenbank aus zwei Treppen (Lehne zur Seite facing) mit offenen Falltüren als Armlehnen; läuft von z1 nach Süden.
function gardenBench(b, x, z1, facing) {
  for (const z of [z1, z1 + 1]) b.set(x, 1, z, st('dark_oak_stairs', facing));
  b.set(x, 1, z1 - 1, armrest('north'));
  b.set(x, 1, z1 + 2, armrest('south'));
}

// Blumen in Reihen entlang x, direkt auf den Rasen (y = 1); rows[i] gilt für die Reihe z1 + i. Hohe Pflanzen über b.tall.
const TALL_FLOWERS = new Set(['peony', 'lilac', 'rose_bush', 'sunflower']);
function flowerRows(b, x1, x2, z1, rows) {
  rows.forEach((flower, i) => {
    for (let x = x1; x <= x2; x++) {
      if (TALL_FLOWERS.has(flower)) b.tall(x, 1, z1 + i, flower);
      else b.set(x, 1, z1 + i, flower);
    }
  });
}

// Parterre-Beet: Rand aus Eichenlaub (Ecken 2 hoch), innen symmetrische Blumenreihen, in der Mitte ein Azaleenbusch.
function hedgeBed(b, x1, z1, x2, z2, flowers, seed) {
  for (const [x, z] of rectEdge(x1, z1, x2, z2, ['north', 'south', 'west', 'east'])) b.set(x, 1, z, HEDGE);
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) b.set(x, 2, z, HEDGE);
  const [tall, outer, inner] = flowers;
  flowerRows(b, x1 + 1, x2 - 1, z1 + 1, [tall, outer, inner, inner, outer, tall]);
  bush(b, { x: Math.round((x1 + x2) / 2), y: 1, z: Math.round((z1 + z2) / 2), size: 'klein', leaves: 'azalee', seed });
}

function garden(b) {
  b.phase('Garten', 'Zum Schluss der formale Garten an den Kieswegen: ein Brunnen in der Mitte, vier Beete mit niedrigen Hecken, Zypressen vor den Flügeln, Laternen und eine niedrige Mauer an der Straße.', {
    tips: [
      'Die Beete pflanzt du direkt in den Rasen – Blumen halten auf Grasblöcken, du musst nichts umgraben.',
      'Setz die Hecken vor den Blumen, dann trittst du beim Pflanzen nichts kaputt.',
    ],
  });
  b.step('Brunnen', 'Das Becken hat einen Durchmesser von 10 Blöcken: Boden aus glattem Quarz mit Seelaternen eine Ebene unter dem Gelände, ringsum ein Rand aus glattem Quarz, 2 Ebenen hoch. In der Mitte steht ein 2 × 2 großer Sockel aus Quarzsäulen mit einer kleinen Schale aus kopfüber gesetzten Quarztreppen. Füll beide Schalen mit Wassereimern – alles sind Quellen, nichts fließt.');
  const fx = 11.5;
  const fz = 33.5;
  b.disc(fx, -1, fz, 4.5, TRIM);
  for (const [x, z] of [[9, 31], [14, 31], [9, 36], [14, 36]]) b.set(x, -1, z, 'sea_lantern');
  for (const y of [0, 1]) {
    b.disc(fx, y, fz, 4.5, 'water');
    b.disc(fx, y, fz, 4.5, TRIM, { hollow: true });
  }
  b.fill(11, 0, 33, 12, 2, 34, axis(PILLAR, 'y'));
  for (let x = 10; x <= 13; x++) {
    b.set(x, 3, 32, st(TRIM_STAIRS, 'south', 'top'));
    b.set(x, 3, 35, st(TRIM_STAIRS, 'north', 'top'));
  }
  for (const z of [33, 34]) {
    b.set(10, 3, z, st(TRIM_STAIRS, 'east', 'top'));
    b.set(13, 3, z, st(TRIM_STAIRS, 'west', 'top'));
  }
  b.fill(11, 3, 33, 12, 3, 34, 'water');
  b.note(11, 3, 33, 'Obere Brunnenschale: 4 Wasserquellen');

  b.step('Beete und Hecken', 'Die vier Beete (13 × 8) bekommen einen Rand aus Eichenlaub, an den Ecken 2 hoch als kleine Formschnitt-Säulen. Innen stehen die Blumen in Reihen, gespiegelt zur Mitte: außen hohe Pfingstrosen bzw. Flieder, dann Tulpen bzw. Kornblumen, innen Zierlauch bzw. Porzellansternchen; in der Mitte ein Azaleenbusch. Vor den Flügeln wachsen Rosenbüsche und weiße Tulpen. Um das ganze Grundstück wächst eine 2 hohe Hecke aus Schwarzeichenlaub.');
  const ROSE_BED = ['peony', 'pink_tulip', 'allium'];
  const BLUE_BED = ['lilac', 'cornflower', 'azure_bluet'];
  hedgeBed(b, -10, 24, 2, 31, ROSE_BED, 1);
  hedgeBed(b, 21, 24, 33, 31, ROSE_BED, 2);
  hedgeBed(b, -10, 36, 2, 43, BLUE_BED, 3);
  hedgeBed(b, 21, 36, 33, 43, BLUE_BED, 4);
  for (const y of [1, 2]) {
    for (let z = PLOT.z1; z < PLOT.z2; z++) { b.set(PLOT.x1, y, z, HEDGE_TALL); b.set(PLOT.x2, y, z, HEDGE_TALL); }
    for (let x = PLOT.x1 + 1; x < PLOT.x2; x++) b.set(x, y, PLOT.z1, HEDGE_TALL);
  }
  for (const x1 of [-7, 24]) flowerRows(b, x1, x1 + 6, 13, ['rose_bush', 'white_tulip']);

  b.step('Mauer an der Straße', 'Vorne schließt eine Steinziegelmauer das Grundstück ab. Alle 7 Blöcke steht ein Pfeiler aus Steinziegeln (2 hoch, oben gemeißelt) mit einer Laterne obendrauf; die Einfahrt in der Mitte bleibt 6 breit offen.');
  const pillars = [-13, -6, 1, 8, 15, 22, 29, 36];
  for (let x = PLOT.x1; x <= PLOT.x2; x++) {
    if (x >= 9 && x <= 14) continue;
    if (pillars.includes(x)) {
      b.set(x, 1, PLOT.z2, PLINTH);
      b.set(x, 2, PLOT.z2, 'chiseled_stone_bricks');
      b.set(x, 3, PLOT.z2, formatState('lantern', { hanging: 'false' }));
    } else b.set(x, 1, PLOT.z2, 'stone_brick_wall');
  }

  b.step('Bäume, Laternen und Bänke', 'Vor die Flügel kommen je zwei schlanke Fichten wie Zypressen, hinter das Haus zwei Birken. Laternenpfähle aus Steinziegelmauern säumen Hauptweg und Brunnenplatz, Bänke laden am Brunnen und an den Enden des Querwegs zum Sitzen ein.');
  for (const [x, seed] of [[-10, 1], [-4, 2], [27, 3], [33, 4]]) tree(b, { x, y: 1, z: 17, species: 'fichte', size: 'klein', seed });
  tree(b, { x: -9, y: 1, z: -2, species: 'birke', size: 'mittel', seed: 5 });
  tree(b, { x: 32, y: 1, z: -2, species: 'birke', size: 'mittel', seed: 6 });
  for (const [x, z] of [[7, 24], [16, 24], [7, 43], [16, 43], [5, 27], [18, 27], [5, 40], [18, 40]]) {
    lampPost(b, { x, y: 1, z, height: 3, post: 'stone_brick_wall', base: 'chiseled_stone_bricks', style: 'top' });
  }
  for (let x = 10; x <= 13; x++) b.set(x, 1, -5, st('dark_oak_stairs', 'north'));
  b.set(9, 1, -5, armrest('west'));
  b.set(14, 1, -5, armrest('east'));
  for (const [x, z1, facing] of [[5, 29, 'west'], [5, 37, 'west'], [18, 29, 'east'], [18, 37, 'east'], [-11, 33, 'west'], [34, 33, 'east']]) gardenBench(b, x, z1, facing);
}

export default function build(b) {
  ground(b);
  plinth(b);
  groundFloorWalls(b);
  porticoColumns(b);
  upperSlab(b);
  upperWalls(b);
  topPlate(b);
  hipRoof(b);
  windowsAndDoors(b);
  porticoAndTerraces(b);
  grandStairs(b);
  groundFloorRooms(b);
  upperRooms(b);
  lighting(b);
  garden(b);
}
