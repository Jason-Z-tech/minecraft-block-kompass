// Lichtschalter mit Kupferbirne: kleine Hütte (außen 7 × 7), deren vier Deckenlampen ein Knopf neben der Tür an- und
// ausschaltet. Bau-Rahmen: Hütte x 0 … 6, z 0 … 6, Tür im Süden (z = 6), Fußboden y = 0, Gelände y = −1.
//
// Signalweg (Südwand von innen gesehen): Knopf an Wandblock (3, 2, 6) → Kupferbirne darüber (3, 3, 6) schaltet bei jedem
// Druck um → Komparator (4, 3, 6) liest die Birne (15, wenn sie leuchtet) → Block (5, 3, 6) → Staub auf der Wandkrone und
// über die Decke (y = 5) auf die vier Redstone-Lampen in der Decke (y = 4).

import { WOOD, window, doorway, bookWall, flowerBed, terrain, path, tree, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'lichtschalter-kupferbirne',
  title: 'Lichtschalter mit Kupferbirne',
  category: 'redstone',
  subtitle: 'Ein Knopf schaltet die Deckenlampen an und wieder aus – dank Kupferbirne als Speicher',
  tags: ['Redstone', 'Lichtschalter', 'Kupferbirne', 'T-Flipflop', 'Komparator', 'Redstone-Lampe', 'Licht', 'Hütte', 'Anfänger', 'Kupfer'],
  aliases: [
    'lichtschalter', 'licht schalter', 'kupferbirne', 'kupfer birne', 'kupferlampe', 'light switch', 'copper bulb',
    'copper bulb switch', 't flip flop', 't-flipflop', 'flipflop', 'flip flop', 'toggle', 'lichtschater', 'lichtschalte',
    'redstone licht', 'lampe an aus', 'knopf lampe',
  ],
  accuracy: 'vorlage',
  difficulty: 2,
  description: 'Eine kleine Hütte mit vier Redstone-Lampen in der Decke, die ein einziger Knopf neben der Tür an- und wieder ausschaltet. Das Geheimnis ist die Kupferbirne über dem Knopf: Sie wechselt bei jedem Signal zwischen an und aus und merkt sich ihren Zustand. Ein Komparator liest die Birne und versorgt die Lampen über Redstone-Staub auf dem Dachboden. Die Technik steckt in der Wand und unter der Traufe – sichtbar bleibt innen nur die Birne als Kontrolllampe.',
  facts: [
    'Ein Knopfdruck = ein Signal = die Kupferbirne wechselt zwischen an und aus (T-Flipflop).',
    'Ein Komparator gibt bei leuchtender Kupferbirne Stärke 15 aus, bei dunkler 0 – egal, wie stark sie oxidiert ist.',
    'Gewachste Kupferbirne: Sie oxidiert nicht und bleibt hell (Lichtstufe 15).',
    'Vier Kerzen auf dem Tisch halten den Raum auch bei ausgeschaltetem Licht hell genug, dass keine Monster erscheinen.',
    'Nicht im Spiel getestet: die Schaltung folgt der Beschreibung der Kupferbirne im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Copper Bulb', url: 'https://minecraft.wiki/w/Copper_Bulb' },
    { title: 'Minecraft Wiki: Redstone Comparator', url: 'https://minecraft.wiki/w/Redstone_Comparator' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const darkOak = WOOD.schwarzeiche;
const SWITCH = { x: 3, y: 2, z: 6 };
const BULB = { x: 3, y: 3, z: 6 };
const COMPARATOR = { x: 4, y: 3, z: 6 };
const RELAY = { x: 5, y: 3, z: 6 };
const LAMPS = [[4, 4], [4, 2], [2, 2], [2, 4]];
// Staub ab dem Block hinter dem Komparator (Stärke 15, je Feld −1): Wandkrone, dann über die Decke zu allen Lampen.
const WIRE = [[5, 4, 6], [5, 5, 5], [4, 5, 5], [4, 5, 4], [4, 5, 3], [4, 5, 2], [3, 5, 2], [2, 5, 2], [2, 5, 3], [2, 5, 4]];

function site(b) {
  b.phase('Bauplatz und Boden', 'Such dir eine ebene Wiese. Die Hütte ist außen 7 × 7 Blöcke groß und steht auf einem Sockel aus Bruchstein.', {
    tips: ['Setz zuerst die vier Ecken des Sockels und zähl dann die Seiten ab: 7 Blöcke nach Osten, 7 nach Süden.'],
  });
  b.step('Wiese', 'Die Wiese rund um die Hütte.');
  terrain(b, { x: -5, y: -2, z: -4, width: 17, depth: 17, height: 1, seed: 'lichtschalter' });
  b.step('Sockel und Fußboden', 'Ein Ring aus Bruchstein (7 × 7) ist der Sockel, innen liegt ein Boden aus Fichtenbrettern (5 × 5).');
  b.fill(0, 0, 0, 6, 0, 6, 'cobblestone');
  b.fill(1, 0, 1, 5, 0, 5, spruce.planks);
}

function walls(b) {
  b.phase('Wände', 'Fichtenstämme an den Ecken, dazwischen Fichtenbretter. Die Wände sind 4 Blöcke hoch, die oberste Reihe ist zugleich die Höhe der Decke.');
  b.step('Eckpfosten', 'Stell auf jede Ecke einen Fichtenstamm, 4 Blöcke hoch.');
  for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) b.fill(x, 1, z, x, 4, z, `${spruce.log}[axis=y]`);
  b.step('Bretterwände', 'Fülle die Wände mit Fichtenbrettern, 4 Blöcke hoch. In der Südwand lässt du ganz links (neben dem Eckpfosten im Westen) zwei Blöcke für die Tür frei.');
  b.fill(1, 1, 0, 5, 4, 0, spruce.planks);
  b.fill(1, 1, 6, 5, 4, 6, spruce.planks);
  b.fill(0, 1, 1, 0, 4, 5, spruce.planks);
  b.fill(6, 1, 1, 6, 4, 5, spruce.planks);
}

function circuit(b) {
  b.phase('Schalter und Kupferbirne', 'Jetzt kommt das Herz der Schaltung in die Südwand. Von innen gesehen sitzt der Schalter zwei Blöcke östlich der Tür – nicht direkt daneben, sonst würde der Knopf auch die Tür aufstoßen.', {
    tips: [
      'So funktioniert es: Der Knopf versorgt den Wandblock, an dem er sitzt. Die Kupferbirne direkt darüber spürt das und wechselt ihren Zustand – an oder aus. Sie bleibt so, bis der nächste Knopfdruck kommt.',
      'Der Komparator liest die Birne wie eine Truhe: leuchtet sie, gibt er Stärke 15 weiter, sonst nichts.',
      'Nimm eine gewachste Kupferbirne (Kupferbirne mit Honigwabe bearbeiten). Ungewachst oxidiert sie mit der Zeit und wird dunkler – schalten würde sie trotzdem.',
    ],
  });
  b.step('Kupferbirne', 'Brich in der Südwand den Block in der dritten Reihe über dem Fußboden heraus, zwei Felder östlich der Tür, und setz dort die gewachste Kupferbirne ein. Direkt darunter bleibt das Brett stehen – an ihm sitzt gleich der Knopf.');
  b.set(BULB.x, BULB.y, BULB.z, 'waxed_copper_bulb[lit=true,powered=false]');
  b.note(BULB.x, BULB.y, BULB.z, 'Kupferbirne: wechselt bei jedem Knopfdruck zwischen an und aus');

  b.step('Komparator', 'Brich östlich neben der Birne den Wandblock heraus und setz einen Komparator auf das Brett darunter. Er muss die Birne lesen: Stell dich so, dass du nach Osten schaust (von der Birne weg) – dann zeigen die zwei kleinen Fackeln zur Birne und die Spitze nach Osten.');
  b.set(COMPARATOR.x, COMPARATOR.y, COMPARATOR.z, 'comparator[facing=west,mode=compare,powered=true]');

  b.step('Knopf', 'Setz innen an das Brett unter der Birne (zweite Reihe über dem Fußboden, Augenhöhe) einen Fichtenknopf. Jeder Druck schaltet die Birne um.');
  b.set(SWITCH.x, SWITCH.y, SWITCH.z - 1, `${spruce.button}[face=wall,facing=north,powered=false]`);
  b.note(SWITCH.x, SWITCH.y, SWITCH.z - 1, 'Lichtschalter: einmal drücken = an, nochmal = aus');
}

function ceilingAndWire(b) {
  b.phase('Decke, Lampen und Leitung', 'Die Decke liegt auf Höhe der obersten Wandreihe. Vier Redstone-Lampen sitzen in der Decke, darüber läuft der Redstone-Staub auf dem Dachboden von Lampe zu Lampe.', {
    tips: [
      'Staub auf einem Block versorgt den Block darunter – deshalb leuchten die Lampen, über die die Leitung läuft.',
      'Achte darauf, dass kein Staub auf dem Block über der Kupferbirne liegt. Sonst bekäme die Birne dauernd Strom und ließe sich nicht mehr umschalten.',
    ],
  });
  b.step('Decke mit Lampen', 'Leg die Decke aus Fichtenbrettern (5 × 5, auf Höhe der obersten Wandreihe) und setz dabei vier Redstone-Lampen ein: je zwei Blöcke von den Wänden entfernt in einem Quadrat (die Felder 2 und 4 von jeder Wand aus gezählt).');
  b.fill(1, 4, 1, 5, 4, 5, spruce.planks);
  for (const [x, z] of LAMPS) b.set(x, 4, z, 'redstone_lamp[lit=true]');

  b.step('Leitung auf den Dachboden', 'Der Komparator zeigt in das Brett östlich von ihm. Brich das Brett darüber in der obersten Wandreihe heraus und leg dort Redstone-Staub hinein. Von dort klettert die Leitung auf die Decke und läuft nach Norden über die beiden östlichen Lampen, dann nach Westen und zurück nach Süden über die anderen zwei – 10 Felder Staub.');
  WIRE.forEach(([x, y, z], i) => b.set(x, y, z, `redstone_wire[power=${15 - i}]`));
  b.note(RELAY.x, RELAY.y + 1, RELAY.z, 'Staub auf der Wandkrone: hier klettert die Leitung auf den Dachboden');
}

function roofAndTrim(b) {
  b.phase('Dach', 'Ein Satteldach aus Schwarzeichentreppen mit First von Westen nach Osten. Die unterste Treppenreihe liegt einen Block vor der Wand auf Höhe der Wandkrone und verdeckt dort von außen den Staub; eine Reihe umgedrehter Treppen darunter verdeckt Kupferbirne und Komparator.', {
    tips: [
      'Umgedrehte Treppen setzt du, indem du auf die obere Hälfte der Blockseite klickst, an der sie haften sollen.',
      'Stell dich beim Setzen der Dachtreppen auf die Traufseite und schau zur Firstmitte – dann zeigt die hohe Seite nach innen.',
    ],
  });
  b.step('Licht im Dachboden', 'Stell vor dem Dach eine Laterne auf die Decke über der Westseite. Sonst ist der abgeschlossene Dachboden stockdunkel und Monster könnten darin erscheinen.');
  b.set(1, 5, 3, 'lantern[hanging=false]');
  b.step('Traufkante', 'Setz an die Nord- und Südwand in der dritten Reihe über dem Fußboden (eine unter der Wandkrone) je eine Reihe umgedrehter Schwarzeichentreppen, hohe Seite zur Wand, einen Block über die Ecken hinaus – darauf liegt gleich die unterste Dachreihe. Die Traufe wirkt so doppelt so dick, und im Süden sieht man von außen weder Birne noch Komparator.');
  for (let x = -1; x <= 7; x++) {
    b.stairs(x, 3, 7, darkOak.stairs, { facing: 'north', half: 'top' });
    b.stairs(x, 3, -1, darkOak.stairs, { facing: 'south', half: 'top' });
  }
  b.step('Satteldach', 'Das Dach steht ringsum einen Block über. Die unterste Reihe liegt auf Höhe der Wandkrone vor der Wand, jede weitere Reihe einen Block höher und weiter innen; in der Mitte bildet eine Reihe Stufen den First. Die Giebel im Westen und Osten füllst du mit Fichtenbrettern.');
  b.roof({ x1: 0, z1: 0, x2: 6, z2: 6, y: 4, type: 'gable', axis: 'x', stairs: darkOak.stairs, slab: darkOak.slab, full: spruce.planks, overhang: 1 });
}

function openings(b) {
  b.phase('Tür und Fenster', 'Jetzt die Öffnungen: die Tür ganz links in der Südwand und drei kleine Fenster mit Läden.');
  b.step('Tür', 'Setz die Fichtentür in die freie Öffnung, davor eine Bruchsteintreppe als Stufe.');
  doorway(b, { x: 1, y: 1, z: 6, facing: 'south', door: spruce.door, frame: null, step: 'cobblestone_stairs' });
  b.step('Fenster', 'Je ein Fenster aus einer Glasscheibe in Augenhöhe (zweite Reihe über dem Fußboden): in der Südwand ganz rechts, in der West-, Ost- und Nordwand mittig. Daneben klappst du Fichtenfalltüren als Läden an die Wand.');
  window(b, { x: 5, y: 2, z: 6, facing: 'south', height: 1, shutters: spruce.trapdoor });
  window(b, { x: 0, y: 2, z: 3, facing: 'west', height: 1, shutters: spruce.trapdoor });
  window(b, { x: 6, y: 2, z: 3, facing: 'east', height: 1, shutters: spruce.trapdoor });
  window(b, { x: 3, y: 2, z: 0, facing: 'north', height: 1, shutters: spruce.trapdoor });
}

function interior(b) {
  b.phase('Einrichtung', 'Innen kommen eine Zierleiste unter der Decke, ein Bücherregal, ein Tisch mit Kerzen und zwei Stühle hinein.', {
    tips: ['Die Kerzen sind wichtig: Sie leuchten immer, auch wenn du das Deckenlicht ausschaltest, und halten so Monster fern.'],
  });
  b.step('Zierleiste', 'Unter die Decke kommt ringsum eine Leiste aus umgedrehten Fichtentreppen, hohe Seite zur Wand. Über dem Knopf lässt du ein Feld frei – dort siehst du die Kupferbirne als Kontrolllampe. Vor dem Komparator verdeckt die Leiste die Technik.');
  for (let x = 1; x <= 5; x++) {
    if (x !== BULB.x) b.stairs(x, 3, 5, spruce.stairs, { facing: 'south', half: 'top' });
    b.stairs(x, 3, 1, spruce.stairs, { facing: 'north', half: 'top' });
  }
  for (let z = 2; z <= 4; z++) {
    b.stairs(1, 3, z, spruce.stairs, { facing: 'west', half: 'top' });
    b.stairs(5, 3, z, spruce.stairs, { facing: 'east', half: 'top' });
  }
  b.step('Bücherregal', 'An der Nordwand steht unter dem Fenster ein niedriges Bücherregal, drei Blöcke breit und einen hoch: ein Regal zwischen zwei Fichtenstämmen. Links davon ein Fass mit einem Farn, rechts eine Topfpflanze.');
  bookWall(b, { x: 2, y: 1, z: 1, facing: 'south', width: 3, height: 1, wood: 'fichte', crown: false });
  b.set(1, 1, 1, 'barrel[facing=up,open=false]');
  b.set(1, 2, 1, 'potted_fern');
  b.set(5, 1, 1, 'potted_azalea_bush');
  b.step('Tisch und Kerzen', 'In die Mitte des Raums kommt ein Tisch aus einer oberen Fichtenstufe, darauf vier angezündete Kerzen (mit Feuerzeug anzünden). Links und rechts je eine Fichtentreppe als Stuhl, die Lehne vom Tisch weg. In die Südostecke legst du einen kleinen Teppich: zwei weiße Felder an der Ostwand und ein rotes daneben an der Südwand.');
  b.slab(3, 1, 3, spruce.slab, { type: 'top' });
  b.set(3, 2, 3, 'white_candle[candles=4,lit=true,waterlogged=false]');
  b.stairs(2, 1, 3, spruce.stairs, { facing: 'west' });
  b.stairs(4, 1, 3, spruce.stairs, { facing: 'east' });
  b.set(5, 1, 4, 'white_carpet');
  b.set(5, 1, 5, 'white_carpet');
  b.set(4, 1, 5, 'red_carpet');
}

function garden(b) {
  b.phase('Vor der Hütte', 'Ein Weg zur Tür, Blumen an der Südwand, eine kleine Birke im Westen und ein Azaleenbusch vorne rechts.');
  b.step('Weg', 'Von der Stufe vor der Tür führt ein schmaler Erdpfad 4 Blöcke nach Süden (Gras mit der Schaufel bearbeiten).');
  path(b, { x: 1, y: -1, z: 8, facing: 'south', length: 4, width: 1, mix: 'erde', wiggle: 0, seed: 3 });
  b.step('Blumenbeet', 'Rechts neben der Stufe kommt ein schmales Beet mit warmen Farben an die Südwand, 4 Blöcke lang.');
  flowerBed(b, { x: 3, y: -1, z: 7, width: 4, depth: 1, facing: 'south', palette: 'warm', seed: 4 });
  b.step('Birke und Busch', 'Westlich der Hütte pflanzt du eine kleine Birke (3 Blöcke Abstand zur Wand), vorne rechts kommt ein kleiner Azaleenbusch.');
  tree(b, { x: -3, y: 0, z: 1, species: 'birke', size: 'klein', seed: 10 });
  bush(b, { x: 9, y: 0, z: 9, size: 'klein', leaves: 'azalee', seed: 6 });
  b.step('Wiese', 'Zum Schluss etwas Gras und Wildblumen rund um die Hütte.');
  vegetation(b, { x: -5, y: -1, z: -4, width: 17, depth: 17, mix: 'blumen', density: 0.3, seed: 7 });
}

export default function build(b) {
  site(b);
  walls(b);
  circuit(b);
  ceilingAndWire(b);
  roofAndTrim(b);
  openings(b);
  interior(b);
  garden(b);
}
