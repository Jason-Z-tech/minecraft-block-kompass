// Schmiede – offene Dorfschmiede mit Esse, Amboss, Schleifstein, Werkzeugwand, Wassertrog und Kohlelager.
// Rahmen: Vorderseite (offen) nach Süden (+z), Grundfläche x 0 … 12, z 0 … 9; Boden auf y = 0 bündig mit der Wiese.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, chimney, supportPost, hangingLantern, wallLantern, floorPattern, lightRoom,
  tree, bush, path, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'schmiede',
  title: 'Schmiede',
  category: 'mittelalter',
  subtitle: 'Offene Dorfschmiede mit Esse, Amboss und Wassertrog',
  tags: ['Mittelalter', 'Dorf', 'Werkstatt', 'Schmied', 'Esse', 'Amboss', 'Fachwerk', 'Klein', 'Einsteiger'],
  aliases: [
    'schmiede', 'schmide', 'schmiedte', 'dorfschmiede', 'mittelalter schmiede', 'mittelalterliche schmiede', 'waffenschmiede',
    'hufschmied', 'esse', 'werkstatt schmied', 'blacksmith', 'smithy', 'forge', 'blacksmith house', 'medieval blacksmith',
    'medieval forge', 'minecraft schmiede',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Eine offene Dorfschmiede: Rückwand und Westseite aus Bruchstein, vorne und an der Ostseite stehen Schwarzeichenpfosten mit Kopfbändern unter einem Fichtendach. In der gemauerten Esse glüht Lava sicher hinter Glas, flankiert von zwei Hochöfen, darüber zieht ein Ziegelschlot durchs Dach. Davor stehen Amboss, Schleifstein und ein Abschreckkessel, an den Wänden Werkzeugregale, ein Wassertrog und das Kohlelager.',
  facts: [
    'Grundfläche 13 × 10 Blöcke, bis zum Schlot 13 Blöcke hoch.',
    'Die Lava ist ringsum eingemauert: unten, oben und an den Seiten Ziegel, vorne ein Glasblock. Sie kann nicht fließen und nichts anzünden.',
    'Hochofen, Schmiedetisch, Schleifstein und Amboss sind echte Arbeitsblöcke – ein Dorfbewohner ohne Beruf kann hier Waffen- oder Werkzeugschmied werden.',
    'Das Dach ist mit Überstand 15 Blöcke breit – bei ungerader Breite schließt oben eine Reihe Fichtenstufen den First.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

// Grundriss
const X1 = 0;
const X2 = 12;
const Z1 = 0;
const Z2 = 9;
const WALL_TOP = 4;
const POST_TOP = 3;

// Bruchsteinmauer: unten mehr Moos, oben vereinzelt Stein und Andesit (fest je Position).
function rubble(x, y, z) {
  const h = hashPosition(x, y, z, 4242) % 20;
  if (y === 1) return h < 7 ? 'mossy_cobblestone' : 'cobblestone';
  if (h < 2) return 'andesite';
  if (h < 5) return 'stone';
  return 'cobblestone';
}

function rubbleWall(b, x1, y1, z1, x2, y2, z2) {
  for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) b.set(x, y, z, rubble(x, y, z));
}

function groundAndFloor(b) {
  b.phase('Gelände und Boden', 'Leg zuerst die Wiese aus und darin die Bodenplatte der Schmiede: 13 Blöcke breit (Ost–West) und 10 tief (Nord–Süd), bündig mit dem Gras, damit man von vorne und von der Ostseite ebenerdig hineingeht.', {
    tips: ['Steck die vier Ecken der Bodenplatte zuerst mit Bruchstein ab und füll dann auf.', 'Der Rand aus Steinziegeln zeigt dir später genau, wo Mauern und Pfosten stehen.'],
  });
  b.step('Wiese und Bodenplatte', 'Die Wiese ist 30 × 29 Blöcke groß. In ihre Mitte legst du die Bodenplatte: innen Bruchstein mit etwas Stein, Andesit und bemoostem Bruchstein, außen ein Rand aus Steinziegeln.');
  b.fill(-8, 0, -8, 21, 0, 20, 'grass_block');
  floorPattern(b, {
    x: X1, y: 0, z: Z1, width: X2 - X1 + 1, depth: Z2 - Z1 + 1, pattern: 'random', border: 'stone_bricks',
    blocks: [['cobblestone', 5], ['stone', 2], ['andesite', 2], ['mossy_cobblestone', 1]],
  });
}

function wallsAndPosts(b) {
  b.phase('Mauern, Pfosten und Balken', 'Die Rückwand (Norden) und die Westwand sind 4 Blöcke hoch und aus Bruchstein. Vorne und an der Ostseite bleibt die Schmiede offen: dort stehen Schwarzeichenstämme, die oben einen liegenden Balken tragen.', {
    tips: [
      'Die Ecken bekommen aufrechte Schwarzeichenstämme – das gibt der Mauer einen klaren Rahmen.',
      'Die Kopfbänder sind umgedrehte Treppen: setz sie mit dem Fadenkreuz an die obere Hälfte der Seitenfläche, dann liegen sie oben.',
      'Liegende Balken setzt du, indem du auf die Seitenfläche des Nachbarblocks klickst – so zeigt der Stamm in die richtige Richtung.',
    ],
  });
  b.step('Rückwand und Westwand', 'Mauere auf dem Steinziegelrand die Rückwand (13 lang, an der Nordkante) und die Westwand (10 lang) je 4 Blöcke hoch. In die unterste Reihe mischst du etwas bemoosten Bruchstein, weiter oben ein paar Stein- und Andesitblöcke. An die drei Mauerecken kommen aufrechte Schwarzeichenstämme.');
  rubbleWall(b, X1, 1, Z1, X2, WALL_TOP, Z1);
  rubbleWall(b, X1, 1, Z1, X1, WALL_TOP, Z2);
  for (const [x, z] of [[X1, Z1], [X2, Z1], [X1, Z2]]) b.fill(x, 1, z, x, WALL_TOP, z, `${dark.log}[axis=y]`);
  b.step('Pfosten mit Kopfbändern', 'Stell an der Vorderkante 4 und 8 Blöcke von der Westwand entfernt und an der Südostecke je einen 3 hohen Schwarzeichenstamm auf, an der Ostkante einen in der Mitte (5 Blöcke vor der Rückwand). Oben bekommt jeder Pfosten links und rechts ein Kopfband aus einer umgedrehten Schwarzeichentreppe.');
  for (const x of [4, 8]) supportPost(b, { x, y: 1, z: Z2, height: POST_TOP, log: dark.log, braces: dark.stairs });
  supportPost(b, { x: X2, y: 1, z: 5, facing: 'east', height: POST_TOP, log: dark.log, braces: dark.stairs });
  b.fill(X2, 1, Z2, X2, POST_TOP, Z2, `${dark.log}[axis=y]`);
  b.set(X2 - 1, POST_TOP, Z2, `${dark.stairs}[facing=west,half=top]`);
  b.set(X2, POST_TOP, Z2 - 1, `${dark.stairs}[facing=north,half=top]`);
  b.set(X1 + 1, POST_TOP, Z2, `${dark.stairs}[facing=east,half=top]`);
  b.step('Balken', 'Leg auf die Pfosten, also in 4 Blöcken Höhe wie die Mauerkrone, einen durchgehenden Balken aus geschälter Schwarzeiche: vorne über die ganze Breite (liegend Ost–West) und an der Ostseite bis zur Rückwand (liegend Nord–Süd).');
  b.fill(X1 + 1, WALL_TOP, Z2, X2, WALL_TOP, Z2, `${dark.strippedLog}[axis=x]`);
  b.fill(X2, WALL_TOP, Z1 + 1, X2, WALL_TOP, Z2 - 1, `${dark.strippedLog}[axis=z]`);
}

// Esse an der Rückwand: Ziegelherd 3 × 2, Lava hinten in der Mitte (ringsum zu), vorne Glas, daneben zwei Hochöfen.
function forge(b) {
  b.phase('Esse', 'Die Esse steht mittig an der Rückwand: ein 3 breiter und 2 tiefer Herd aus Ziegeln direkt vor der Mauer. In der Mitte glüht ein Lavablock hinter Glas, links und rechts davon stehen zwei Hochöfen.', {
    tips: [
      'Mauere die Kammer für die Lava erst ganz zu (unten, links, rechts, hinten und oben Ziegel, vorne Glas) und gieß die Lava zuletzt von oben durch eine Lücke – dann schließ die Lücke sofort.',
      'Brennbares (Holz, Wolle) gehört nie direkt neben die Lava. Hier ist alles ringsum Ziegel, Stein und Glas.',
    ],
  });
  b.step('Herd', 'Setz die unterste Lage (3 × 2) komplett aus Ziegeln. In der zweiten Lage kommen hinten links und rechts Ziegel, vorne links und rechts je ein Hochofen mit der Öffnung nach Süden und vorne in der Mitte ein Glasblock.');
  b.fill(5, 1, 1, 7, 1, 2, 'bricks');
  b.set(5, 2, 1, 'bricks');
  b.set(7, 2, 1, 'bricks');
  b.set(5, 2, 2, 'blast_furnace[facing=south,lit=true]');
  b.set(7, 2, 2, 'blast_furnace[facing=south,lit=true]');
  b.set(6, 2, 2, 'glass');
  b.step('Lava und Deckel', 'Gieß einen Eimer Lava in die Kammer hinter dem Glas und deck die Esse mit einer Ebene Ziegel ab.');
  b.set(6, 2, 1, 'lava');
  b.note(6, 2, 1, 'Lava erst einfüllen, wenn die Kammer ringsum geschlossen ist.');
  b.fill(5, 3, 1, 7, 3, 2, 'bricks');
  b.step('Haube', 'Auf den Deckel kommt eine Haube aus Ziegeltreppen, die hohe Seite immer zur Mitte hin (vorne nach Norden, links nach Osten, rechts nach Westen). Die Mitte hinten bleibt für den Schlot frei.');
  b.set(5, 4, 1, 'brick_stairs[facing=east,half=bottom]');
  b.set(7, 4, 1, 'brick_stairs[facing=west,half=bottom]');
  for (let x = 5; x <= 7; x++) b.set(x, 4, 2, 'brick_stairs[facing=north,half=bottom]');
}

function roof(b) {
  b.phase('Dach', 'Das Satteldach aus Fichtentreppen läuft Nord–Süd, damit vorne über der offenen Werkstatt ein Giebel steht. Es steht ringsum einen Block über: die unterste Reihe liegt außen neben der Mauerkrone (4 Blöcke über dem Boden), jede Reihe nach innen eine Ebene höher, oben schließt eine Reihe Fichtenstufen den First (die Breite ist ungerade). Den Giebel hinten mauerst du aus Bruchstein. Vorne wird er Fachwerk: weiße Terrakotta als Gefach, darin ein Mittelständer und zwei Streben aus geschälter Schwarzeiche und zwei kleine Fenster.', {
    tips: [
      'Schau beim Setzen der Treppen zur Firstmitte (auf der Westseite nach Osten, auf der Ostseite nach Westen) – dann zeigt die hohe Seite richtig.',
      'Setz zuerst die beiden Giebeldreiecke, dann hast du für jede Dachreihe einen Anschlag.',
    ],
  });
  b.roof({ x1: X1, z1: Z1, x2: X2, z2: Z2, y: WALL_TOP, type: 'gable', axis: 'z', stairs: spruce.stairs, slab: spruce.slab, full: 'cobblestone', overhang: 1 });
  // Vorderer Giebel als Fachwerk: helles Gefach aus weißer Terrakotta, Mittelständer, zwei Streben und zwei kleine Fenster.
  b.fill(X1, WALL_TOP + 1, Z2, X2, WALL_TOP + 7, Z2, 'white_terracotta', { replace: 'cobblestone' });
  b.fill(6, WALL_TOP + 2, Z2, 6, WALL_TOP + 6, Z2, `${dark.strippedLog}[axis=y]`);
  b.line(2, WALL_TOP + 2, Z2, 4, WALL_TOP + 4, Z2, dark.strippedLog);
  b.line(10, WALL_TOP + 2, Z2, 8, WALL_TOP + 4, Z2, dark.strippedLog);
  b.set(5, WALL_TOP + 3, Z2, 'glass_pane');
  b.set(7, WALL_TOP + 3, Z2, 'glass_pane');
  // Traufkante an der offenen Ostseite: umgedrehte Treppen unter dem Überstand.
  for (let z = Z1 - 1; z <= Z2 + 1; z++) b.set(X2 + 1, WALL_TOP - 1, z, `${spruce.stairs}[facing=west,half=top]`);
}

function chimneyAndWindow(b) {
  b.phase('Schlot und Fenster', 'Jetzt zieht der Schlot von der Haube durchs Dach: ein Ziegelschacht über der hinteren Mitte der Esse, 9 Blöcke hoch. Wo er das Dach kreuzt, nimmst du die Dachtreppe wieder heraus. In die Westwand kommt eine offene Fensterluke mit Fensterläden.', {
    tips: ['Unter dem Lagerfeuer oben im Schlot steckt ein Heuballen – dadurch steigt der Rauch viel höher, wie bei einer echten Esse.'],
  });
  b.step('Schlot', 'Mauere den Schlot hinten in der Mitte der Haube 9 Blöcke hoch aus Ziegeln (er geht genau durch den First, dort ersetzt er die Firststufe), setz in die oberste Zelle einen Heuballen, darauf ein Lagerfeuer und rundherum einen Kranz aus umgedrehten Ziegeltreppen.');
  chimney(b, { x: 6, y: WALL_TOP, z: 1, height: 9, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
  b.step('Fensterluke', 'Brich in der Westwand, 5 Blöcke vor der Rückwand, eine 1 breite und 2 hohe Luke auf (zweite und dritte Lage über dem Boden), setz außen eine umgedrehte Fichtentreppe als Fensterbank darunter und häng außen links und rechts offene Fichtenfalltüren als Läden an.');
  window(b, { x: X1, y: 2, z: 5, facing: 'west', width: 1, height: 2, glass: 'air', shutters: spruce.trapdoor, sill: spruce.stairs });
}

function furnishing(b) {
  b.phase('Einrichtung', 'Richte die Schmiede ein. Der Amboss steht frei vor der Esse, damit der Schmied von allen Seiten herankommt.', {
    tips: ['Amboss und Kohle brauchen festen Boden – der Amboss fällt sonst wie Sand herunter.'],
  });
  b.step('Amboss, Kessel und Schleifstein', 'Stell den Amboss mittig zwei Blöcke vor die Esse, schräg links davor einen Kessel mit Wasser zum Abschrecken und rechts, drei Blöcke neben dem Amboss, den Schleifstein.');
  b.set(6, 1, 4, 'anvil[facing=east]');
  b.set(4, 1, 3, 'water_cauldron[level=3]');
  b.set(9, 1, 4, 'grindstone[face=floor,facing=east]');
  b.step('Werkzeugwand', 'Links an der Rückwand stehen ein Fass, der Schmiedetisch und eine Werkbank. Darüber hängen in der dritten Lage drei Fichtenregale direkt vor der Mauer (Öffnung nach Süden) – dort liegen Zangen, Hämmer und fertige Klingen.');
  b.set(1, 1, 1, 'barrel[facing=up]');
  b.set(2, 1, 1, 'smithing_table');
  b.set(3, 1, 1, 'crafting_table');
  for (let x = 1; x <= 3; x++) b.set(x, 3, Z1 + 1, `${spruce.shelf}[facing=south]`);
  b.step('Kohlelager', 'Rechts an der Rückwand lagert die Kohle: drei Kohleblöcke in einer Reihe in der Ecke, zwei weitere obendrauf und einer davor, daneben ein Fass mit Holzkohle.');
  for (const [x, y, z] of [[9, 1, 1], [10, 1, 1], [11, 1, 1], [10, 2, 1], [11, 2, 1], [11, 1, 2]]) b.set(x, y, z, 'coal_block');
  b.set(10, 1, 2, 'barrel[facing=up]');
  b.step('Wassertrog', 'An der Westwand baust du den Wassertrog: ein 1 hoher Rand aus geschälten Fichtenstämmen um drei Felder direkt an der Mauer (4 bis 6 Blöcke vor der Rückwand), in die du je einen Eimer Wasser gießt. Die Stämme liegen längs zur Wand, die beiden Endstücke quer.');
  b.fill(1, 1, 4, 2, 1, 8, `${spruce.strippedLog}[axis=z]`);
  b.set(1, 1, 4, `${spruce.strippedLog}[axis=x]`);
  b.set(1, 1, 8, `${spruce.strippedLog}[axis=x]`);
  b.fill(1, 1, 5, 1, 1, 7, 'water');
  b.step('Ablage für fertige Ware', 'Vorne rechts an der Ostkante steht ein Fass mit einer Laterne darauf, davor eine Truhe für fertige Ware (Öffnung nach Westen).');
  b.set(11, 1, 7, 'barrel[facing=up]');
  b.set(11, 1, 8, 'chest[facing=west,type=single]');
  b.set(11, 2, 7, 'lantern[hanging=false]');
}

function lights(b) {
  b.phase('Licht', 'Unter die Balken kommen Laternen, damit in der offenen Schmiede kein Monster erscheint. Die Lava und die brennenden Hochöfen leuchten zusätzlich.');
  hangingLantern(b, { x: 2, y: WALL_TOP - 1, z: Z2, chain: 0 });
  hangingLantern(b, { x: 10, y: WALL_TOP - 1, z: Z2, chain: 0 });
  wallLantern(b, { x: X1, y: 3, z: 2, facing: 'east', style: 'bracket', arm: dark.fence });
  lightRoom(b, { x1: X1 + 1, y1: 1, z1: Z1 + 1, x2: X2 - 1, y2: WALL_TOP, z2: Z2 });
}

function surroundings(b) {
  b.phase('Umgebung', 'Zum Schluss die Umgebung: ein Kiesweg zur offenen Vorderseite, ein Holzstapel an der Ostseite, ein Baum hinter der Schmiede und etwas Bewuchs.', {
    tips: ['Wege und Bewuchs kommen immer zuletzt, damit nichts unter Bauteilen verschwindet.'],
  });
  b.step('Weg', 'Leg vor der Vorderseite einen 3 breiten Kiesweg nach Süden.');
  path(b, { x: 6, y: 0, z: Z2 + 1, facing: 'south', length: 8, width: 3, mix: 'kies', wiggle: 1, seed: 'schmiede' });
  b.step('Holzstapel und Heu', 'An der Ostseite stapelst du Fichtenstämme liegend (Nord–Süd, 4 lang): unten 3 nebeneinander, darauf 2, ganz oben 1. Vorne daneben stehen drei Heuballen für die Pferde, die hier beschlagen werden.');
  b.fill(14, 1, 2, 16, 1, 5, `${spruce.log}[axis=z]`);
  b.fill(14, 2, 2, 15, 2, 5, `${spruce.log}[axis=z]`);
  b.fill(14, 3, 2, 14, 3, 5, `${spruce.log}[axis=z]`);
  for (const [x, y, z] of [[15, 1, 9], [15, 1, 10], [15, 2, 9]]) b.set(x, y, z, 'hay_block[axis=y]');
  b.step('Baum und Büsche', 'Ein Eichenbaum steht hinten links, Büsche an den Ecken.');
  tree(b, { x: -3, y: 1, z: -3, species: 'eiche', size: 'mittel', seed: 7 });
  bush(b, { x: 18, y: 1, z: 13, size: 'klein', seed: 3 });
  bush(b, { x: -4, y: 1, z: 12, size: 'klein', leaves: 'azalee', seed: 5 });
  vegetation(b, { x: -8, y: 2, z: -8, width: 30, depth: 29, mix: 'wiese', density: 0.22, shape: 'eckig', seed: 11 });
}

export default function build(b) {
  groundAndFloor(b);
  wallsAndPosts(b);
  forge(b);
  roof(b);
  chimneyAndWindow(b);
  furnishing(b);
  lights(b);
  surroundings(b);
}
