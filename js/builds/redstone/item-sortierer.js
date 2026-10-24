// Item-Sortierer: bewährter Trichter-Komparator-Sortierer (minecraft.wiki „Basic hopper item sorter“) mit 6 Kammern,
// Einwurf-Truhe, Überlauf-Doppeltruhe und Beschriftung. Bau-Rahmen: Kammer k liegt bei x = k (0 … 5), die Truhen stehen
// im Süden (z = 1), die Technik liegt nördlich davon (z = −1 … −4). Fußboden y = 0, Fundament y = −1.
//
// Querschnitt einer Kammer (von Westen gesehen, Süden rechts), wie im Wiki:
//   y 3:                                          Trichterleitung (→ Osten)
//   y 2:          Staub   Staub   Komparator      Filter-Trichter (→ Norden)
//   y 1:  Staub   Block   Block   Block           unterer Trichter (→ Süden)   Truhe
//   y 0:  Block   Verst.  Block   Fackel          Boden
//   y −1:         Block
//   z:    −4      −3      −2      −1              0                            1

import { WOOD, terrain, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'item-sortierer',
  title: 'Item-Sortierer',
  category: 'redstone',
  subtitle: 'Trichter-Komparator-Sortierer mit 6 Kammern und Überlauf-Schutz',
  tags: ['Redstone', 'Sortierer', 'Lager', 'Trichter', 'Komparator', 'Truhen', 'Automatik', 'Überlauf-Schutz', 'Technik', 'Survival'],
  aliases: [
    'item sortierer', 'itemsortierer', 'sortierer', 'sortiermaschine', 'sortieranlage', 'item sorter', 'hopper sorter',
    'sorting system', 'storage sorter', 'trichter sortierer', 'trichtersortierer', 'lagersystem', 'sortier anlage',
    'item filter', 'itemfilter', 'automatisches lager', 'sotierer', 'sortirer', 'overflow sorter',
  ],
  accuracy: 'vorlage',
  difficulty: 3,
  description: 'Ein Lager, das sich selbst einräumt: Du wirfst alles in die Einwurf-Truhe, eine Trichterleitung trägt die Gegenstände über sechs Kammern, und jede Kammer zieht nur ihre Sorte heraus und legt sie in ihre Truhe. Der Filter jeder Kammer ist ein Trichter mit 41 Stück der Sorte und vier Füllgegenständen, ein Komparator misst ihn und gibt den unteren Trichter erst frei, wenn ein weiteres Stück dazukommt. Durch die genaue Filterbelegung bleibt das Signal selbst bei vollem Filter so schwach, dass die Nachbarkammern nicht gestört werden (Überlauf-Schutz). Alles, was keine Kammer will, landet in der Überlauf-Truhe am Ende.',
  facts: [
    'Filter-Belegung jeder Kammer: Feld 1 = 41 Stück der Sorte, Feld 2 bis 5 = je 1 umbenannter Stock (oder ein anderer Füllgegenstand, der nie durch die Anlage läuft).',
    'Für Gegenstände, die nur bis 16 stapeln (Eier, Schneebälle, Enderperlen, Schilder), legst du 10 statt 41 Stück in Feld 1.',
    'Signalstärke am Komparator: 2 im Ruhezustand, 3 sobald ein zusätzliches Stück im Filter liegt – und auch bei vollem Filter nie mehr als 3.',
    'Durchsatz: 2,5 Gegenstände pro Sekunde, so schnell wie eine Trichterleitung.',
    'Jede Kammer ist 1 Block breit – du kannst die Reihe nach Belieben verlängern.',
    'Nicht im Spiel getestet: der Aufbau folgt Block für Block dem „Basic hopper item sorter“ aus dem Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Hopper – Item sorter', url: 'https://minecraft.wiki/w/Tutorial:Hopper#Item_sorter' },
    { title: 'Minecraft Wiki: Redstone Comparator', url: 'https://minecraft.wiki/w/Redstone_Comparator' },
  ],
  credits: { author: 'Minecraft Wiki (Community)', url: 'https://minecraft.wiki/w/Tutorial:Hopper#Item_sorter', license: 'CC BY-NC-SA 3.0' },
  tested: false,
};

const spruce = WOOD.fichte;
const CHAMBERS = 6;
const LAST = CHAMBERS - 1;
const OVERFLOW_X = CHAMBERS;
const INPUT_X = -1;
const FLOOR = 'polished_andesite';
const BORDER = 'polished_deepslate';
const CARRIER = 'smooth_stone';
const FOUNDATION = 'cobbled_deepslate';
const AREA = { x1: -3, x2: OVERFLOW_X + 3, z1: -6, z2: 4 };

const hopper = (facing, enabled = true) => `hopper[enabled=${enabled},facing=${facing}]`;
// Ruhezustand: Komparator gibt 2 aus, der Staub fällt auf 2 → 1 → 0, die Fackeln brennen, die unteren Trichter sind gesperrt.
const wire = (power) => `redstone_wire[power=${power}]`;

function chambers(fn) {
  for (let x = 0; x <= LAST; x++) fn(x);
}

function foundation(b) {
  b.phase('Fundament und Boden', `Der Sortierer braucht eine Fläche von ${AREA.x2 - AREA.x1 + 1} × ${AREA.z2 - AREA.z1 + 1} Blöcken. Die Technik liegt zum Teil eine Ebene tief im Boden – deshalb kommt zuerst ein Fundament und darauf der Fußboden mit zwei Aussparungen je Kammer.`, {
    tips: [
      'Bau den Sortierer am besten in einen Keller: dann liegt die Redstone-Technik geschützt und du siehst vorne nur die Truhen.',
      'Die sechs Kammern sitzen direkt nebeneinander (je 1 Block breit). Markier dir die erste Kammer und zähl dann nach Osten weiter.',
    ],
  });
  b.step('Bauplatz', 'Such dir eine ebene Wiese (oder einen Kellerraum) von etwa 19 × 17 Blöcken. Der Boden des Sortierers liegt bündig mit dem Gras.');
  terrain(b, { x: AREA.x1 - 3, y: -2, z: AREA.z1 - 3, width: AREA.x2 - AREA.x1 + 7, depth: AREA.z2 - AREA.z1 + 7, height: 2, seed: 'sortierer' });
  b.step('Fundament', 'Grab die Fläche des Sortierers zwei Blöcke tief aus und leg die untere Ebene mit Bruchtiefenschiefer aus. Unter den Verstärkern der Kammern ist dieses Fundament der tragende Block.');
  b.fill(AREA.x1, -1, AREA.z1, AREA.x2, -1, AREA.z2, FOUNDATION);

  b.step('Fußboden', 'Darauf kommt der Fußboden aus poliertem Andesit mit einem Rand aus poliertem Tiefenschiefer. Die sechs Kammern liegen in der 4. bis 9. Spalte von Westen (Rand mitgezählt), ihre Truhen später in der 4. Reihe von Süden, die Trichter in der 5. Reihe. In jeder Kammer-Spalte lässt du die 6. und die 8. Reihe von Süden frei – dort kommen gleich Fackel und Verstärker hinein. Die 7. und 9. Reihe legst du aus glattem Stein, sie tragen Signale.');
  b.fill(AREA.x1, 0, AREA.z1, AREA.x2, 0, AREA.z2, BORDER);
  b.fill(AREA.x1 + 1, 0, AREA.z1 + 1, AREA.x2 - 1, 0, AREA.z2 - 1, FLOOR);
  chambers((x) => {
    b.remove(x, 0, -1);
    b.remove(x, 0, -3);
    b.set(x, 0, -2, CARRIER);
    b.set(x, 0, -4, CARRIER);
  });
}

function hoppersAndChests(b) {
  b.phase('Truhen und Trichter', 'Jetzt kommt die Trichter-Strecke: unten die Truhen der Kammern, darüber zwei Trichter je Kammer und oben die Leitung, die alles von Westen nach Osten trägt.', {
    tips: [
      'Ein Trichter zeigt immer in den Block, auf den du beim Setzen klickst. Halte dabei Schleichen gedrückt, sonst öffnest du die Truhe statt den Trichter anzusetzen.',
      'Setz die Truhen mit gedrückter Schleichen-Taste nebeneinander, sonst verbinden sich zwei Nachbarn zu einer Doppeltruhe und zwei Sorten landen in derselben Truhe.',
    ],
  });
  b.step('Truhen der Kammern', `Stell die ${CHAMBERS} Truhen in einer Reihe von Westen nach Osten auf den Boden, Öffnung nach Süden (du stehst im Süden und schaust beim Setzen nach Norden). Jede Kammer bekommt ihre eigene, einzelne Truhe.`);
  chambers((x) => b.set(x, 1, 1, 'chest[facing=south,type=single]'));

  b.step('Überlauf-Truhe', 'Östlich neben die letzte Kammer kommt die Überlauf-Doppeltruhe, ebenfalls mit der Öffnung nach Süden. Stell zuerst die östliche Hälfte auf (zwei Felder neben der letzten Truhe). Die westliche setzt du dann schleichend mit Klick auf die Westseite der ersten: So verbindet sie sich mit ihr und nicht mit der Truhe der letzten Kammer – ohne Schleichen würde sie genau das tun.');
  b.set(OVERFLOW_X + 1, 1, 1, 'chest[facing=south,type=left]');
  b.set(OVERFLOW_X, 1, 1, 'chest[facing=south,type=right]');
  b.note(OVERFLOW_X, 1, 1, 'Überlauf: alles ohne passenden Filter');

  b.step('Untere Trichter', 'Direkt nördlich hinter jede Kammer-Truhe und hinter die westliche Hälfte der Überlauf-Truhe kommt ein Trichter, der in die Truhe zeigt: Schleich dich hinter die Reihe und klick auf die Rückseite der Truhe. Die Trichter der Kammern holen später die sortierten Gegenstände aus dem Filter.');
  chambers((x) => b.set(x, 1, 0, hopper('south', false)));
  b.set(OVERFLOW_X, 1, 0, hopper('south'));

  b.step('Tragende Blöcke', 'Hinter jeden unteren Trichter kommt eine Reihe aus drei Blöcken glattem Stein (1 bis 3 Blöcke nördlich der Trichter, direkt auf dem Fußboden). Der vordere liegt genau über der Fackel: Sie versorgt ihn mit Strom, und er sperrt so den Trichter.');
  chambers((x) => b.fill(x, 1, -3, x, 1, -1, CARRIER));

  b.step('Komparatoren', 'Auf den vordersten der drei Steinblöcke jeder Kammer setzt du einen Komparator. Stell dich dafür in den Süden und schau nach Norden: Die zwei kleinen Fackeln zeigen dann zu dir (Eingang), die einzelne Spitze nach Norden (Ausgang). Lass ihn im normalen Modus (vordere Fackel aus).');
  chambers((x) => b.set(x, 2, -1, 'comparator[facing=south,mode=compare,powered=true]'));

  b.step('Filter-Trichter', 'Auf jeden unteren Trichter kommt der Filter-Trichter. Er muss nach Norden in den Komparator zeigen, nicht nach unten: Schleich dich und klick auf die schmale Südkante des Komparators (er ist nur so hoch wie eine Druckplatte, ziel genau). Zeigt er nach unten, schiebt er alles in die Truhe und der Filter wirkt nicht.');
  chambers((x) => b.set(x, 2, 0, hopper('north')));
  b.note(0, 2, 0, 'Filter-Trichter: Feld 1 = 41 Stück der Sorte, Feld 2–5 = je 1 umbenannter Stock');

  b.step('Überlauf-Fallrohr', 'Auf den Trichter hinter der Überlauf-Truhe setzt du zwei Trichter, die nach unten zeigen: schleichend jeweils oben auf den letzten Trichter klicken. Der obere ist das Ende der Leitung.');
  b.set(OVERFLOW_X, 2, 0, hopper('down'));
  b.set(OVERFLOW_X, 3, 0, hopper('down'));

  b.step('Trichterleitung', `Oben auf die Filter-Trichter kommt die Leitung: ${CHAMBERS} Trichter, die alle nach Osten zeigen. Fang im Osten an: Den ersten setzt du schleichend mit Klick auf die Westseite des oberen Überlauf-Trichters, jeden weiteren mit Klick auf die Westseite des zuletzt gesetzten.`);
  for (let x = LAST; x >= 0; x--) b.set(x, 3, 0, hopper('east'));
}

function floorRedstone(b) {
  b.phase('Redstone im Boden', 'Bevor die Trichter kommen, setzt du Fackel und Verstärker in die beiden Aussparungen jeder Kammer. Später liegen Steinblöcke darüber, dann kommst du nicht mehr heran.', {
    tips: [
      'Fackel und Verstärker gehören zur Sperre des unteren Trichters: Die Fackel brennt im Ruhezustand und sperrt ihn, der Verstärker schaltet sie aus, sobald etwas zu sortieren ist.',
    ],
  });
  b.step('Redstone-Fackeln', 'In die vordere Aussparung (1 Block nördlich der späteren Trichterreihe) kommt je eine Redstone-Fackel an die Südseite des glatten Steins dahinter. Gleich kommt ein Steinblock auf sie: Den versorgt sie mit Strom, und er sperrt den unteren Trichter.');
  chambers((x) => b.set(x, 0, -1, 'redstone_wall_torch[facing=south,lit=true]'));
  b.note(0, 0, -1, 'Fackel brennt = unterer Trichter gesperrt');

  b.step('Verstärker', 'In die hintere Aussparung kommt je ein Verstärker auf 1 Tick (nicht weiterdrehen). Er zeigt nach Süden: Schau beim Setzen nach Süden. Er holt sein Signal aus dem glatten Stein im Norden und gibt es an den Stein weiter, an dem die Fackel hängt.');
  chambers((x) => b.set(x, 0, -3, 'repeater[delay=1,facing=north,locked=false,powered=false]'));
}

function dust(b) {
  b.phase('Redstone-Staub', 'Zum Schluss der Schaltung kommt der Staub: Der Komparator misst den Filter, zwei Staubfelder schwächen das Signal ab, und nur bei genug Stärke kommt beim Verstärker im Boden noch etwas an.', {
    tips: [
      'So funktioniert es: Im Ruhezustand gibt der Komparator die Stärke 2 aus. Der Staub verliert je Feld 1 Stärke – beim dritten Staubfeld kommt nichts mehr an, die Fackel brennt und sperrt den unteren Trichter.',
      'Kommt ein passendes Stück in den Filter, steigt die Stärke auf 3: Das dritte Staubfeld bekommt 1, der Verstärker schaltet, die Fackel geht aus und der untere Trichter zieht genau ein Stück heraus. Danach ist wieder Ruhe.',
      'Die Staubleitungen benachbarter Kammern berühren sich. Das ist gewollt: Selbst bei vollem Filter (Stärke 3) kommt beim Nachbarn eine Stärke zu wenig an.',
    ],
  });
  b.step('Redstone-Staub', 'Leg den Staub: je ein Feld hinter dem Komparator und eins dahinter auf den Steinblöcken, dann eine Stufe tiefer auf den glatten Stein ganz hinten im Fußboden. Der Staub verbindet sich mit den Nachbarkammern zu durchgehenden Linien.');
  chambers((x) => {
    b.set(x, 2, -2, wire(2));
    b.set(x, 2, -3, wire(1));
    b.set(x, 1, -4, wire(0));
  });
  b.note(0, 1, -4, 'Hier kommt nur Strom an, wenn der Komparator 3 ausgibt: dann schaltet der Verstärker darunter');
}

function input(b) {
  b.phase('Einwurf', 'Am Westende kommt die Einwurf-Truhe hin. Alles, was du in sie legst, läuft durch den Sortierer; was keine Kammer haben will, landet in der Überlauf-Truhe am Ostende.');
  b.step('Einwurf', 'Westlich neben den Anfang der Leitung stellst du einen Sockel aus zwei Blöcken polierten Tiefenschiefers. Darauf kommt ein Trichter, der nach Osten in die Leitung zeigt (schleichend auf die Westseite des ersten Leitungs-Trichters klicken), und obendrauf die Einwurf-Truhe.');
  b.fill(INPUT_X, 1, 0, INPUT_X, 2, 0, BORDER);
  b.set(INPUT_X, 3, 0, hopper('east'));
  b.set(INPUT_X, 4, 0, 'chest[facing=south,type=single]');
  b.note(INPUT_X, 4, 0, 'Einwurf-Truhe: hier alles hineinlegen');

  b.step('Trittstufe', 'Die Einwurf-Truhe steht drei Blöcke über dem Boden. Damit du bequem hineinkommst, setz westlich neben den Sockel eine Tiefenschiefertreppe als Trittstufe, die hohe Seite zum Sockel (beim Setzen nach Osten schauen). Von der Stufe aus hast du die Truhe auf Augenhöhe.');
  b.stairs(INPUT_X - 1, 1, 0, 'polished_deepslate_stairs', { facing: 'east' });
}

function frontAndLight(b) {
  b.phase('Schilder und Licht', 'Zum Schluss bekommt die Truhenreihe einen Balken mit Hängeschildern, damit du jede Kammer beschriften kannst, und Laternen, damit auf dem Boden keine Monster erscheinen.', {
    tips: [
      'Über einer Truhe darf kein voller Block liegen, sonst lässt sie sich nicht öffnen. Hängeschilder sind kein voller Block – sie stören nicht.',
      'Schreib auf jedes Schild die Sorte der Kammer, zum Beispiel „Bruchstein“ oder „Weizen“.',
    ],
  });
  b.step('Balken', 'Leg einen Balken aus geschälten Fichtenstämmen von Westen nach Osten vor die Trichterleitung (auf Höhe der Trichterleitung, eine Reihe südlich davon), vom Einwurf bis zum Ende der Überlauf-Truhe.');
  b.fill(INPUT_X, 3, 1, OVERFLOW_X + 1, 3, 1, `${spruce.strippedLog}[axis=x]`);
  b.fill(INPUT_X - 1, 1, 1, INPUT_X - 1, 3, 1, `${spruce.log}[axis=y]`);
  b.fill(OVERFLOW_X + 2, 1, 1, OVERFLOW_X + 2, 3, 1, `${spruce.log}[axis=y]`);
  b.set(INPUT_X - 1, 3, 1, `${spruce.strippedLog}[axis=x]`);
  b.set(OVERFLOW_X + 2, 3, 1, `${spruce.strippedLog}[axis=x]`);

  b.step('Hängeschilder', 'Unter den Balken hängst du über jede Truhe ein Fichten-Hängeschild, Schrift nach Süden.');
  for (let x = 0; x <= OVERFLOW_X + 1; x++) b.set(x, 2, 1, `${spruce.hangingSign}[attached=false,rotation=0,waterlogged=false]`);

  b.step('Laternen', 'Stell Laternen auf den Balken und auf die beiden Eckpfosten hinten. So bleibt der ganze Boden hell genug.');
  for (const x of [INPUT_X - 1, 2, OVERFLOW_X + 2]) b.set(x, 4, 1, 'lantern[hanging=false]');
  for (const x of [AREA.x1 + 1, AREA.x2 - 1]) {
    b.set(x, 1, AREA.z1 + 1, `${spruce.log}[axis=y]`);
    b.set(x, 2, AREA.z1 + 1, 'lantern[hanging=false]');
  }
  b.set(2, 1, AREA.z1 + 1, `${spruce.log}[axis=y]`);
  b.set(2, 2, AREA.z1 + 1, 'lantern[hanging=false]');
}

function surroundings(b) {
  b.phase('Rund um den Sortierer', 'Ein paar Fässer für Werkzeug und Ersatzteile neben dem Einwurf, Büsche an den hinteren Ecken und etwas Gras machen den Platz wohnlich.');
  b.set(INPUT_X - 1, 1, 3, 'barrel[facing=up,open=false]');
  b.set(INPUT_X - 1, 2, 3, 'barrel[facing=north,open=false]');
  b.set(INPUT_X, 1, 3, 'crafting_table');
  b.set(OVERFLOW_X + 2, 1, 3, 'barrel[facing=up,open=false]');
  bush(b, { x: AREA.x1 - 2, y: 1, z: AREA.z1 - 1, size: 'mittel', leaves: 'azalee', seed: 3 });
  bush(b, { x: AREA.x2 + 2, y: 1, z: AREA.z1 - 1, size: 'mittel', leaves: 'fichte', seed: 5 });
  vegetation(b, { x: AREA.x1 - 3, y: 0, z: AREA.z1 - 3, width: AREA.x2 - AREA.x1 + 7, depth: AREA.z2 - AREA.z1 + 7, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 8 });
}

export default function build(b) {
  foundation(b);
  floorRedstone(b);
  hoppersAndChests(b);
  dust(b);
  input(b);
  frontAndLight(b);
  surroundings(b);
}
