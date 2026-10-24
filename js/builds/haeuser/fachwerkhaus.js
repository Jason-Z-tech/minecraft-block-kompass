// Fachwerkhaus: zwei Geschosse plus Dachboden, giebelständig (Giebel nach Süden), Obergeschoss vorne 1 Block auskragend.
// Bau-Rahmen: Erdgeschoss x 0 … 8, z 0 … 11; Obergeschoss x 0 … 8, z 0 … 12. Fußboden EG auf y = 0, Gelände y = −1.
// Höhen: EG-Wände y 1 … 5 (Rähm = OG-Boden y 5), OG-Wände y 6 … 10 (Rähm = Dachboden y 10), Kniestock y 11,
// steiles Satteldach (2 Blöcke Steigung je Block) bis y 21.

import {
  WOOD, STONE, window, doorway, chimney, timberWall, brace, straightStairs, gardenFence, lampPost, floorPattern, hangingLantern,
  bedroom, kitchen, diningTable, bookWall, storage, fireplace, lightRoom, tree, bush, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'fachwerkhaus',
  title: 'Fachwerkhaus',
  category: 'haeuser',
  subtitle: 'Zweistöckiges Fachwerkhaus mit steilem Ziegeldach, Erker und Kamin',
  tags: ['Fachwerk', 'Fachwerkhaus', 'Deutschland', 'Altstadt', 'Mittelalter', 'Bürgerhaus', 'Zwei Stockwerke', 'Satteldach', 'Erker', 'Kamin', 'Eingerichtet', 'Schwarzeiche'],
  aliases: [
    'fachwerk', 'fachwerk haus', 'fachwerkhäuschen', 'fachwerckhaus', 'fachwekhaus', 'fachwerkhäuser', 'fachwerkhaus mit erker',
    'deutsches haus', 'altes haus', 'altstadthaus', 'bürgerhaus', 'timber frame house', 'half timbered house', 'half-timbered house',
    'tudor house', 'german house', 'medieval house',
  ],
  accuracy: 'nachempfunden',
  difficulty: 3,
  description: 'Ein zweistöckiges Fachwerkhaus wie in einer deutschen Altstadt: dunkles Fachwerk aus geschälter Schwarzeiche mit hellen Kalzit-Feldern auf einem Sockel aus Steinziegeln und Bruchstein. Das Obergeschoss kragt nach vorne aus, im Giebel sitzt ein kleiner Erker, darüber steigt ein steiles Ziegeldach mit Schornstein auf. Innen gibt es Küche und Stube mit Kamin, oben Schlafzimmer und Kammer und unter dem Dach einen Dachboden als Lager.',
  facts: [
    'Grundfläche 9 × 12 Blöcke, das Obergeschoss ist 13 Blöcke tief (1 Block Auskragung nach vorne); bis zum First sind es 22 Blöcke, mit Schornstein 25.',
    'Das Dach steigt 2 Blöcke je Block nach innen (etwa 63°): jede Reihe ist eine umgedrehte Ziegeltreppe mit einer normalen darüber.',
    'Fachwerk ist ein tragendes Gerüst aus Holzbalken – Schwelle unten, Rähm oben, Ständer, Riegel und Streben –, die Felder dazwischen sind ausgefacht, hier mit Kalzit.',
    'Auskragende Obergeschosse waren in mittelalterlichen Städten üblich: oben gab es mehr Wohnfläche, ohne die Gasse unten enger zu machen.',
    'Alle Zimmer und der Dachboden sind so beleuchtet, dass drinnen keine Monster erscheinen können.',
  ],
  sources: [
    { title: 'Wikipedia: Fachwerkhaus', url: 'https://de.wikipedia.org/wiki/Fachwerkhaus' },
  ],
  credits: null,
  tested: null,
};

const dark = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const FRAME = dark.strippedLog;
const FILL = 'calcite';
const ROOF = { stairs: 'brick_stairs', slab: 'brick_slab', full: 'bricks' };
const X0 = 0;
const X1 = 8;
const Z_BACK = 0;
const Z_FRONT_EG = 11;
const Z_FRONT_OG = 12;
const EAVE_Y = 10;
const CENTER_X = 4;
const beam = (axis) => `${FRAME}[axis=${axis}]`;

// Fachwerkwand aus Abschnitten mit gemeinsamen Ständern. side = Außenseite; cuts = Ständer-Positionen entlang der
// Wand (x bei Süd/Nord, z bei West/Ost), aufsteigend; patterns = Muster je Abschnitt.
function frameWall(b, { side, plane, y, height, cuts, patterns }) {
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const c = cuts[i + 1];
    const common = { y, facing: side, length: c - a + 1, height, frame: FRAME, fill: FILL, pattern: patterns[i], spacing: 64 };
    if (side === 'south') timberWall(b, { ...common, x: a, z: plane });
    else if (side === 'north') timberWall(b, { ...common, x: c, z: plane });
    else if (side === 'west') timberWall(b, { ...common, x: plane, z: a });
    else timberWall(b, { ...common, x: plane, z: c });
  }
}

// Reihe k des steilen Dachs (0 = Traufe mit Überstand) für die Spalte x und ihre untere Zelle.
const roofRow = (x) => Math.min(x - (X0 - 1), X1 + 1 - x);
const roofLow = (x) => EAVE_Y + 2 * roofRow(x);

// Steiles Satteldach, First entlang z: unten eine umgedrehte Treppe mit der hohen Seite nach außen, darüber eine normale
// Treppe mit der hohen Seite zum First – so schließen die Reihen dicht aneinander. First: Ziegelblock + Stufe.
function steepRoof(b) {
  for (let z = Z_BACK - 1; z <= Z_FRONT_OG + 1; z++) {
    for (let x = X0 - 1; x <= X1 + 1; x++) {
      const y = roofLow(x);
      if (x === CENTER_X) {
        b.set(x, y, z, ROOF.full);
        b.slab(x, y + 1, z, ROOF.slab, { type: 'bottom' });
        continue;
      }
      const inward = x < CENTER_X ? 'east' : 'west';
      const outward = x < CENTER_X ? 'west' : 'east';
      b.stairs(x, y, z, ROOF.stairs, { facing: outward, half: 'top' });
      b.stairs(x, y + 1, z, ROOF.stairs, { facing: inward, half: 'bottom' });
    }
  }
}

// Giebeldreieck in der Ebene z (ab y 11): unten Ständer bei x 3 und 5 über denen der Wand, kurze Streben außen,
// Riegel auf y 14, darüber die Firstsäule in der Mitte. Felder aus Kalzit.
function gable(b, z) {
  for (let x = X0 + 1; x <= X1 - 1; x++) {
    for (let y = 11; y < roofLow(x); y++) {
      let state = FILL;
      if (y === 14) state = beam('x');
      else if (y < 14 && (x === 3 || x === 5)) state = beam('y');
      else if (y > 14 && x === CENTER_X) state = beam('y');
      else if ((x === 1 && y === 11) || (x === 7 && y === 11) || (x === 2 && y === 12) || (x === 6 && y === 12)) state = beam('y');
      b.set(x, y, z, state);
    }
  }
}

function stoneMix(b, x, y, z) {
  b.set(x, y, z, b.pickWeighted([[STONE.steinziegel.block, 5], ['cobblestone', 3], ['mossy_cobblestone', 1], ['cracked_stone_bricks', 1]]));
}

function site(b) {
  b.phase('Bauplatz', 'Eine ebene Wiese von etwa 27 × 30 Blöcken. Unter dem Haus liegt Erde. Den Weg zur Haustür legst du gleich am Anfang an – so steht fest, wo vorne ist.');
  b.step('Wiese', 'Die Wiese rund ums Haus.');
  b.fill(-8, -1, -6, 18, -1, 23, 'grass_block');
  b.fill(X0, -1, Z_BACK, X1, -1, Z_FRONT_EG, 'dirt');
  b.step('Weg', 'Ein gepflasterter Weg, 3 Blöcke breit, führt von der Mitte der Südseite 10 Blöcke nach Süden: Bruchstein, bemooster Bruchstein, Stein und Andesit bunt gemischt, eingelassen ins Gras.');
  floorPattern(b, { x: CENTER_X - 1, y: -1, z: 13, width: 3, depth: 10, pattern: 'random', blocks: [['cobblestone', 4], ['mossy_cobblestone', 2], ['stone', 2], ['andesite', 1]] });
}

function base(b) {
  b.phase('Sockel und Böden', 'Der Sockel ist ein Ring aus Steinziegeln mit etwas Bruchstein (9 × 12 Blöcke). Innen legst du den Boden: hinten in der Küche ein Schachbrett aus polierten Steinen, vorne in der Stube Fichtenbretter mit Schwarzeichen-Rand.', {
    tips: ['Die Zwischenwand steht später auf der 6. Reihe von hinten – die Küche ist innen 7 × 4, die Stube 7 × 5 Blöcke groß.'],
  });
  for (let x = X0; x <= X1; x++) for (let z = Z_BACK; z <= Z_FRONT_EG; z++) {
    if (x === X0 || x === X1 || z === Z_BACK || z === Z_FRONT_EG) stoneMix(b, x, 0, z);
  }
  floorPattern(b, { x: 1, y: 0, z: 1, width: 7, depth: 4, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'] });
  b.fill(1, 0, 5, 7, 0, 5, spruce.planks);
  floorPattern(b, { x: 1, y: 0, z: 6, width: 7, depth: 5, pattern: 'border', blocks: [spruce.planks, dark.planks] });
}

function groundFloor(b) {
  b.phase('Erdgeschoss', 'Die Wände des Erdgeschosses sind 5 Blöcke hoch: unten eine liegende Schwelle, oben ein liegender Rähm, dazwischen stehende Ständer. Die Felder füllst du mit Kalzit, in einigen Feldern läuft eine schräge Strebe. Wo die 3D-Ansicht Lücken zeigt, bleiben Haustür und Fenster frei – die kommen im Kapitel „Fenster, Tür und Erker“ hinein.', {
    tips: [
      'Setze zuerst die Ständer an den Ecken und an den Abschnittsgrenzen, dann Schwelle und Rähm, zuletzt Streben und Kalzit.',
      'Liegende Stämme: klick auf die Seite des Nachbarstamms, die in Wandrichtung zeigt. Stehende Stämme: klick auf den Block darunter.',
    ],
  });
  b.step('Vorder- und Rückwand', 'Süd- und Nordwand haben Ständer 0, 3, 5 und 8 Blöcke von der Westecke. Zwischen den beiden mittleren Ständern kommt vorne die Haustür hin.');
  frameWall(b, { side: 'south', plane: Z_FRONT_EG, y: 1, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'plain'] });
  frameWall(b, { side: 'north', plane: Z_BACK, y: 1, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'plain'] });
  b.step('Seitenwände', 'West- und Ostwand haben Ständer bei 0, 4, 8 und 11 Blöcken von der Nordecke. Im mittleren Feld läuft eine Strebe schräg nach oben.');
  frameWall(b, { side: 'west', plane: X0, y: 1, height: 5, cuts: [0, 4, 8, 11], patterns: ['plain', 'diagonal', 'plain'] });
  frameWall(b, { side: 'east', plane: X1, y: 1, height: 5, cuts: [0, 4, 8, 11], patterns: ['plain', 'diagonal', 'plain'] });
  b.step('Zwischenwand', 'Innen trennt eine schlichte, 4 Blöcke hohe Fachwerkwand (6. Reihe von hinten) Küche und Stube. Die Felder sind hier aus weißer Keramik. Lass 2 Blöcke vor der Ostwand eine Türöffnung frei (1 breit, 2 hoch).');
  timberWall(b, { x: 1, y: 1, z: 5, facing: 'south', length: 7, height: 4, frame: FRAME, fill: 'white_terracotta', pattern: 'plain', spacing: 64 });
}

function upperFloor(b) {
  b.phase('Obergeschoss', 'Auf den Rähm des Erdgeschosses kommt der Boden des Obergeschosses. Vorne steht er einen Block über – die Balkenköpfe dieser Auskragung tragen Kopfbänder aus umgedrehten Treppen. In den Wänden bleiben die Fensteröffnungen frei (Lücken in der 3D-Ansicht).', {
    tips: ['Setze die Kopfbänder zuerst, dann halten die Balkenköpfe darüber an ihnen und am Rähm.'],
  });
  b.step('Kopfbänder', 'Unter die Auskragung kommen umgedrehte Schwarzeichentreppen mit der hohen Seite zur Wand – an den Ecken und unter den beiden mittleren Ständern.');
  for (const x of [0, 3, 5, 8]) brace(b, { x, y: 4, z: Z_FRONT_EG, facing: 'south', length: 1, stairs: dark.stairs });
  b.step('Boden und Balkenköpfe', 'Fülle den Boden des Obergeschosses mit Fichtenbrettern. Vorne liegt eine Reihe Stämme quer zur Wand (die Jahresringe zeigen nach Süden) – das sind die Balkenköpfe der Auskragung. Über der Treppe bleiben drei Felder an der Westwand offen.');
  b.fill(1, 5, 1, 7, 5, 10, spruce.planks);
  b.fill(X0, 5, Z_FRONT_OG, X1, 5, Z_FRONT_OG, beam('z'));
  for (let z = 7; z <= 9; z++) b.set(1, 5, z, 'air');
  b.step('Vorder- und Rückwand', 'Die Wände des Obergeschosses sind wieder 5 Blöcke hoch und stehen auf dem Boden. Die Vorderwand steht einen Block weiter vorne auf den Balkenköpfen, die Ständer genau über denen unten. Lass vorne in der Mitte 3 Blöcke breit und 2 hoch (2. und 3. Lage) frei – dort schließt später der Erker an.');
  frameWall(b, { side: 'south', plane: Z_FRONT_OG, y: 6, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'plain'] });
  frameWall(b, { side: 'north', plane: Z_BACK, y: 6, height: 5, cuts: [0, 3, 5, 8], patterns: ['plain', 'plain', 'diagonal'] });
  b.step('Seitenwände', 'Die Seitenwände reichen jetzt 13 Blöcke weit, Ständer bei 0, 4, 8 und 12. Ins mittlere Feld kommt ein Andreaskreuz (zwei gekreuzte Streben).');
  frameWall(b, { side: 'west', plane: X0, y: 6, height: 5, cuts: [0, 4, 8, 12], patterns: ['plain', 'cross', 'plain'] });
  frameWall(b, { side: 'east', plane: X1, y: 6, height: 5, cuts: [0, 4, 8, 12], patterns: ['plain', 'cross', 'plain'] });
  b.step('Zwischenwand', 'Oben steht die Zwischenwand einen Block weiter vorne (7. Reihe von hinten), 4 Blöcke hoch. Lass 3 Blöcke von der Westwand eine Türöffnung frei (1 breit, 2 hoch).');
  timberWall(b, { x: 1, y: 6, z: 6, facing: 'south', length: 7, height: 4, frame: FRAME, fill: 'white_terracotta', pattern: 'plain', spacing: 64 });
  b.step('Dachboden und Kniestock', 'Der Boden des Dachbodens liegt auf Höhe der oberen Rähme (innen 7 × 12 Blöcke). Auf die Rähme der Seitenwände kommt je ein weiterer liegender Balken (Kniestock) – darauf sitzt das Dach. Lass an der Westwand, 4 Blöcke von hinten, ein Feld für die Leiter offen.');
  b.fill(1, 10, 1, 7, 10, 11, spruce.planks);
  for (const x of [X0, X1]) b.fill(x, 11, Z_BACK, x, 11, Z_FRONT_OG, beam('z'));
  b.set(1, 10, 3, 'air');
}

function roof(b) {
  b.phase('Giebel', 'Vorne und hinten bekommt das Haus ein Giebeldreieck aus Fachwerk, unten 7 Blöcke breit und 9 Blöcke hoch: Ständer über denen der Wand, kurze Streben außen, ein Riegel auf der 4. Ebene und darüber die Firstsäule.');
  b.step('Vorderer Giebel', 'Über der Vorderwand des Obergeschosses. Lass in der Mitte zwischen den Ständern auf der 2. und 3. Ebene zwei Blöcke für das Giebelfenster frei.');
  gable(b, Z_FRONT_OG);
  b.step('Hinterer Giebel', 'Genauso über der Rückwand, nur sitzt die Lücke fürs Fenster hier auf der 1. und 2. Ebene.');
  gable(b, Z_BACK);

  b.phase('Dach', 'Das steile Ziegeldach steigt 2 Blöcke je Block nach innen. Jede Reihe besteht aus einer umgedrehten Ziegeltreppe (hohe Seite nach außen) und einer normalen darüber (hohe Seite zum First). Der First ist eine Reihe Ziegelblöcke mit Ziegelstufen obendrauf; vorne und hinten steht das Dach einen Block über.', {
    tips: [
      'Umgedrehte Treppen setzt du, indem du auf die obere Hälfte einer Blockseite klickst. Für die untere Treppe schaust du nach außen, für die obere zur Firstmitte.',
      'Die unterste Reihe hängt seitlich am Kniestock, die zweite liegt genau auf ihm.',
      'Andersherum gedreht würden zwischen den Reihen schmale Schlitze bleiben – so ist das Dach dicht.',
    ],
  });
  steepRoof(b);

  b.phase('Kamin', 'Der Kamin steht in der Stube an der Zwischenwand, sein Schornstein läuft mitten durchs Haus bis über den First. Dafür bleibt in den Böden, in der oberen Zwischenwand und im First je ein Feld frei (die 3D-Ansicht zeigt dort vorher schon Lücken).', {
    tips: ['Unter dem Lagerfeuer oben sitzt ein Heuballen: dann steigt der Rauch viel höher, wie bei einem Signalfeuer.'],
  });
  b.step('Kamin in der Stube', 'Der Kamin ist 3 Blöcke breit und steht mit dem Rücken an der Zwischenwand: hinten Ziegel mit einem Lagerfeuer in der Mitte, vorne zwei Wangen, darüber ein Sims aus umgedrehten Schwarzeichentreppen mit Kerzen und einer Pflanze.');
  fireplace(b, { x: CENTER_X, y: 1, z: 6, facing: 'south', height: 4, block: 'bricks', mantel: dark.stairs });
  b.step('Schornstein', 'Über der Mitte des Kamins mauerst du den Schornstein einen Block breit nach oben: durch den Boden des Obergeschosses, die obere Zwischenwand, den Dachboden und den First – 19 Blöcke hoch, mit einem Kranz aus Ziegeltreppen, Heuballen und Lagerfeuer obendrauf.');
  chimney(b, { x: CENTER_X, y: 5, z: 6, height: 19, block: 'bricks', smoke: 'tall', rim: 'brick_stairs' });
}

function openings(b) {
  b.phase('Fenster, Tür und Erker', 'Jetzt kommen Haustür, Fenster mit Läden und Blumenkästen und der kleine Erker im Obergeschoss.');
  b.step('Haustür', 'Die Fichtentür sitzt vorne genau in der Mitte zwischen den beiden mittleren Ständern. Davor liegt eine Bruchsteinstufe; das auskragende Obergeschoss ist ihr Vordach.');
  doorway(b, { x: CENTER_X, y: 1, z: Z_FRONT_EG, facing: 'south', door: spruce.door, frame: null, step: 'cobblestone_stairs' });
  b.step('Fenster unten', 'Im Erdgeschoss vorne links und rechts der Tür je ein Fenster mit Blumenkasten (direkt neben den mittleren Ständern, außen bleibt eine Spalte Kalzit stehen), hinten zwei Doppelfenster, seitlich je zwei Fenster mit Läden aus Fichtenfalltüren – alle 2 Blöcke hoch auf der 2. und 3. Wandebene.');
  for (const x of [2, 6]) window(b, { x, y: 2, z: Z_FRONT_EG, facing: 'south', width: 1, height: 2, flowerBox: true });
  for (const x of [2, 7]) window(b, { x, y: 2, z: Z_BACK, facing: 'north', width: 2, height: 2, shutters: spruce.trapdoor });
  window(b, { x: X0, y: 2, z: 2, facing: 'west', height: 2, shutters: spruce.trapdoor });
  window(b, { x: X1, y: 2, z: 2, facing: 'east', height: 2, shutters: spruce.trapdoor });
  window(b, { x: X0, y: 2, z: 9, facing: 'west', width: 2, height: 2, shutters: spruce.trapdoor });
  window(b, { x: X1, y: 2, z: 10, facing: 'east', width: 2, height: 2, shutters: spruce.trapdoor });
  b.step('Fenster oben', 'Im Obergeschoss vorne links und rechts vom Erker je ein schmales Fenster mit Fensterbank, hinten ein Doppelfenster, an den Seiten je zwei Fenster mit Läden.');
  for (const x of [1, 7]) window(b, { x, y: 7, z: Z_FRONT_OG, facing: 'south', width: 1, height: 2, sill: dark.stairs });
  window(b, { x: 2, y: 7, z: Z_BACK, facing: 'north', width: 2, height: 2, sill: dark.stairs });
  for (const z of [2, 10]) {
    window(b, { x: X0, y: 7, z, facing: 'west', height: 2, shutters: spruce.trapdoor });
    window(b, { x: X1, y: 7, z, facing: 'east', height: 2, shutters: spruce.trapdoor });
  }
  b.step('Giebelfenster', 'In jeden Giebel kommt mittig ein schmales Fenster aus zwei Glasscheiben übereinander: hinten auf der 1. und 2. Ebene des Giebels, vorne eine Ebene höher (2. und 3.), weil davor das Pultdach des Erkers liegt.');
  for (const [z, y] of [[Z_FRONT_OG, 12], [Z_BACK, 11]]) b.fill(CENTER_X, y, z, CENTER_X, y + 1, z, 'glass_pane');
  b.step('Erker', 'Der Erker sitzt vorne mitten im Obergeschoss, 5 Blöcke breit und einen Block vor der Wand: unten umgedrehte Treppen als Konsolen, darauf ein liegender Balken, an den Ecken stehende Balken, dazwischen drei Glasscheiben nebeneinander (2 hoch) mit Kalzit darüber, oben wieder ein Balken und ein Pultdach aus Ziegeltreppen. Hinten öffnest du die Wand zum Schlafzimmer (3 breit, 2 hoch).');
  for (let x = 2; x <= 6; x++) {
    b.stairs(x, 5, 13, dark.stairs, { facing: 'north', half: 'top' });
    b.set(x, 6, 13, beam('x'));
    b.set(x, 10, 13, beam('x'));
    b.stairs(x, 11, 13, ROOF.stairs, { facing: 'north' });
  }
  for (const x of [2, 6]) b.fill(x, 7, 13, x, 9, 13, beam('y'));
  b.fill(3, 7, 13, 5, 8, 13, 'glass_pane');
  b.fill(3, 9, 13, 5, 9, 13, FILL);
  b.fill(3, 7, Z_FRONT_OG, 5, 8, Z_FRONT_OG, 'air');
}

function stairsAndLadder(b) {
  b.phase('Treppe und Leiter', 'Eine gerade Fichtentreppe führt in der Stube an der Westwand nach oben, eine Leiter aus der Kammer auf den Dachboden.');
  b.step('Treppe', 'Die Treppe beginnt direkt vor der Zwischenwand und steigt 5 Stufen nach Süden. Schau beim Setzen nach Süden – dann liegt die hohe Seite vorne.');
  straightStairs(b, { x: 1, y: 1, z: 6, facing: 'south', width: 1, height: 5, stairs: spruce.stairs, support: null });
  b.step('Geländer', 'Oben sichert ein Zaun aus Schwarzeiche das Treppenloch.');
  b.fill(2, 6, 7, 2, 6, 9, dark.fence);
  b.step('Leiter', 'Die Leiter hängt in der Kammer an der Westwand (4. Block von hinten) und reicht durch das offene Feld im Dachboden.');
  b.fill(1, 6, 3, 1, 10, 3, 'ladder[facing=east]');
}

function interior(b) {
  b.phase('Einrichtung', 'Jetzt richtest du die Zimmer ein: unten Küche und Stube, oben Schlafzimmer und Kammer, ganz oben den Dachboden.');
  b.step('Küche', 'An der Rückwand eine Arbeitszeile: Räucherofen mit Trichter als Abzug, Kessel mit Wasser als Spüle, Fässer, Ofen, Werkbank und Komposter. Davor ein Esstisch mit Stühlen aus Treppen. Die Küchentür in der Zwischenwand sitzt 2 Blöcke vor der Ostwand.');
  b.door(6, 1, 5, spruce.door, { facing: 'north', hinge: 'right' });
  kitchen(b, { x: 1, y: 1, z: 1, facing: 'south', width: 7, wood: 'fichte', cabinets: false });
  diningTable(b, { x: 3, y: 1, z: 3, facing: 'south', length: 3, width: 1, wood: 'fichte', cloth: 'weiss' });
  b.step('Stube', 'Vor dem Kamin stehen zwei Sessel aus Treppen mit Falltüren als Armlehnen, davor ein roter Teppich. In der Ecke steht ein Fass mit Blumentopf.');
  for (const x of [3, 5]) {
    b.stairs(x, 1, 9, spruce.stairs, { facing: 'south' });
    b.set(x - 1, 1, 9, `${spruce.trapdoor}[facing=west,half=bottom,open=true]`);
    b.set(x + 1, 1, 9, `${spruce.trapdoor}[facing=east,half=bottom,open=true]`);
  }
  b.set(CENTER_X, 1, 9, 'red_carpet');
  b.fill(3, 1, 8, 5, 1, 8, 'red_carpet');
  b.set(7, 1, 7, 'barrel[facing=up]');
  b.set(7, 2, 7, 'potted_azalea_bush');
  b.step('Schlafzimmer', 'Oben vorne: Bett mit dem Kopfteil an der Zwischenwand, Nachttische mit Licht, Truhe am Fußende, Teppich und ein Bücherregal mit Pflanze. Die Tür zur Kammer sitzt links neben dem Schornstein.');
  b.door(3, 6, 6, spruce.door, { facing: 'north', hinge: 'left' });
  bedroom(b, { x: 4, y: 6, z: 7, facing: 'south', width: 4, depth: 5, wood: 'schwarzeiche', color: 'rot', rug: 'weiss' });
  b.step('Kammer', 'Oben hinten: eine Bücherwand an der Rückwand, Truhen und Fass an der Ostwand und in der Mitte ein Kartentisch als Schreibtisch mit einem Stuhl aus einer Fichtentreppe.');
  bookWall(b, { x: 3, y: 6, z: 1, facing: 'south', width: 5, height: 3, wood: 'schwarzeiche', crown: true });
  storage(b, { x: X1 - 1, y: 6, z: 3, facing: 'west', width: 3, height: 2, chest: 'chest', barrel: true });
  b.set(4, 6, 3, 'cartography_table');
  b.stairs(4, 6, 4, spruce.stairs, { facing: 'south' });
  b.set(5, 6, 3, 'brown_carpet');
  b.set(3, 6, 3, 'brown_carpet');
  b.step('Dachboden', 'Auf dem Dachboden lagern Heuballen und Fässer in der Mitte unter dem First.');
  for (const [x, z] of [[4, 2], [4, 3], [3, 2]]) b.set(x, 11, z, 'hay_block[axis=y]');
  b.set(4, 12, 2, 'hay_block[axis=x]');
  for (const [x, z] of [[3, 9], [4, 9], [5, 9], [4, 10]]) b.set(x, 11, z, 'barrel[facing=up]');
}

function lights(b) {
  b.phase('Licht', 'Jedes Zimmer bekommt Laternen an der Decke, bis kein begehbares Feld mehr dunkel ist – so erscheinen drinnen keine Monster.');
  b.step('Deckenlaternen', 'In jedes Zimmer hängt eine Laterne mitten unter die Decke: in der Küche über den Esstisch, in der Stube über die Sessel, oben über den Schreibtisch und über die Truhe am Bett. Auf dem Dachboden hängen zwei Laternen an langen Ketten vom First.');
  hangingLantern(b, { x: CENTER_X, y: 4, z: 3, chain: 0 });
  hangingLantern(b, { x: CENTER_X, y: 4, z: 9, chain: 0 });
  hangingLantern(b, { x: CENTER_X, y: 9, z: 3, chain: 0 });
  hangingLantern(b, { x: 5, y: 9, z: 9, chain: 0 });
  for (const z of [3, 9]) hangingLantern(b, { x: CENTER_X, y: roofLow(CENTER_X) - 1, z, chain: 6 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 7, y2: 4, z2: 4 });
  lightRoom(b, { x1: 1, y1: 1, z1: 6, x2: 7, y2: 4, z2: 10 });
  lightRoom(b, { x1: 1, y1: 6, z1: 1, x2: 7, y2: 9, z2: 5 });
  lightRoom(b, { x1: 1, y1: 6, z1: 7, x2: 7, y2: 9, z2: 11 });
  lightRoom(b, { x1: 1, y1: 11, z1: 1, x2: 7, y2: 13, z2: 11 });
}

// Blumen direkt ins Gras setzen, in kleinen Gruppen derselben Sorte.
function plantFlowers(b, { x1, z1, x2, z2, flowers }) {
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, flowers[(Math.floor((x - x1) / 2) + (z - z1)) % flowers.length]);
}

function garden(b) {
  b.phase('Garten', 'Ein Vorgarten mit Zaun, Blumen am Weg und Laternen, dazu Bäume und Büsche ums Haus.');
  b.step('Gartenzaun', 'Ein Fichtenzaun begrenzt den Vorgarten links und rechts (je 8 Blöcke lang, 15 Blöcke auseinander), die Eckpfosten sind geschälte Fichtenstämme. Vorne bleibt er offen, dort stehen zwei Laternenpfähle am Weg.');
  gardenFence(b, { x: -3, y: 0, z: 14, facing: 'south', width: 15, depth: 8, fence: spruce.fence, gate: null, sides: ['left', 'right'], posts: spruce.strippedLog });
  for (const x of [2, 6]) lampPost(b, { x, y: 0, z: 21, facing: 'south', height: 3, style: 'top', post: dark.fence, base: 'mossy_cobblestone' });
  b.step('Blumen', 'Links und rechts vom Weg je ein Blumenfeld direkt im Gras.');
  plantFlowers(b, { x1: -1, z1: 16, x2: 1, z2: 19, flowers: ['poppy', 'oxeye_daisy', 'cornflower'] });
  plantFlowers(b, { x1: 7, z1: 16, x2: 9, z2: 19, flowers: ['allium', 'dandelion', 'azure_bluet'] });
  b.step('Bäume und Büsche', 'Östlich vom Haus wachsen zwei Birken, an den hinteren Ecken stehen Büsche.');
  tree(b, { x: 15, y: 0, z: 1, species: 'birke', size: 'mittel', seed: 11 });
  tree(b, { x: 15, y: 0, z: 9, species: 'birke', size: 'klein', seed: 12 });
  bush(b, { x: -3, y: 0, z: 1, size: 'klein', leaves: 'eiche', seed: 3 });
  bush(b, { x: -4, y: 0, z: 9, size: 'mittel', leaves: 'azalee', seed: 4 });
  b.step('Wiese', 'Gras und ein paar Blumen auf der Wiese.');
  vegetation(b, { x: -8, y: 0, z: -6, width: 27, depth: 30, mix: 'wiese', density: 0.22, shape: 'eckig', seed: 8 });
}

export default function build(b) {
  site(b);
  base(b);
  groundFloor(b);
  upperFloor(b);
  roof(b);
  openings(b);
  stairsAndLadder(b);
  interior(b);
  lights(b);
  garden(b);
}
