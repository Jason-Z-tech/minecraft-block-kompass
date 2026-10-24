// Kürbis- und Melonenfarm: eine Reihe Stängel auf Ackerboden, nördlich davon Beobachter, die auf die Stängel schauen,
// südlich die Fruchtfelder (Schlamm) und dahinter Kolben. Wächst eine Frucht, wird der Stängel „angewachsen“ – der
// Beobachter sieht das, die Kolben zerschlagen die Frucht, und zwei Trichterreihen unter Ackerboden und Schlamm sammeln
// die Stücke ein.
// Lokale Koordinaten: Wiese bis y = −1 (Fundament und Trichter liegen eingelassen auf y = −1), Ackerboden y = 0,
// Maschine y = 1, Redstone y = 2.
// Reihe x = 0 … 9: z = −2 Träger, z = −1 Beobachter, z = 0 Stängel, z = 1 Fruchtfeld, z = 2 Kolben, z = 3 Träger.

import { WOOD, terrain, path, bush, vegetation, flowerBed } from '../lib/index.js';

export const meta = {
  id: 'kuerbis-melonen-farm',
  title: 'Kürbis- und Melonenfarm',
  category: 'farmen',
  subtitle: 'Beobachter schauen auf die Stängel, Kolben ernten, Trichter sammeln',
  tags: ['Farm', 'Kürbis', 'Melone', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Technik', 'Essen'],
  aliases: [
    'kürbis- und melonenfarm', 'kürbis und melonen farm', 'kürbisfarm', 'kuerbisfarm', 'kürbis farm', 'kurbisfarm',
    'melonenfarm', 'melonen farm', 'melonfarm', 'automatische melonenfarm', 'automatische kürbisfarm',
    'pumpkin farm', 'melon farm', 'pumpkin and melon farm', 'melon and pumpkin farm', 'automatic melon farm',
    'observer melon farm', 'observer pumpkin farm',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Fünf Melonen- und fünf Kürbisstängel wachsen auf Ackerboden, ihre Früchte auf Schlamm daneben. Hinter jedem Stängel schaut ein Beobachter genau auf den Stängel: Wächst eine Frucht, biegt sich der Stängel zu ihr hin – der Beobachter sendet einen Puls, ein Verstärker trägt ihn um die Farm herum, und alle zehn Kolben zerschlagen die Früchte. Die Stücke fallen auf Ackerboden oder Schlamm, und zwei Trichterreihen darunter bringen sie in die Truhe. Du pflanzt nur die Samen und leerst ab und zu die Truhe.',
  facts: [
    'Der Beobachter schaut auf den Stängel, nicht auf die Frucht: Sonst sähe er den Kolbenkopf und die Kolben feuerten endlos.',
    'Melonen und Kürbisse zerbrechen, wenn ein Kolben sie schiebt – eine Melone gibt 3 bis 7 Melonenscheiben, ein Kürbis einen Kürbis.',
    'Ackerboden und Schlamm sind etwas niedriger als ein ganzer Block. Trichter darunter saugen alles an, was darauf liegt – auf Erde ginge das nicht. Früchte wachsen auf Schlamm genauso wie auf Erde.',
    'Ein Stängel braucht Licht 9 an seinem Platz; die Farm ist nach oben offen und wächst deshalb auch nachts.',
    'Ein ausgewachsener Stängel versucht bei etwa jedem fünften Zufallstick (im Schnitt alle gut 5 Minuten), eine Frucht zu setzen, und wählt dabei eine zufällige Seite. Hier ist nur eine von vier Seiten frei, darum kommt im Schnitt alle 20 bis 25 Minuten eine Frucht: zehn Stängel bringen grob 25 Früchte pro Stunde (geschätzt), solange du in der Nähe bist.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Kürbis- und Melonenfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Pumpkin_and_melon_farming' },
  ],
  credits: null,
  tested: false,
};

const LENGTH = 10;
const LAST = LENGTH - 1;
const EAST = LENGTH; // Ostwand x = 10, dort läuft das Signal um die Farm herum
const MELONS = 5; // x = 0 … 4 Melonen, x = 5 … 9 Kürbisse
const WATER_X = [2, 7]; // Wasser unter den Beobachtern: reicht 4 Felder weit für die ganze Reihe
const dark = WOOD.schwarzeiche;
const BASE = 'stone_bricks';
const CARRIER = 'polished_andesite';
const POSTS = [[-2, -3], [-2, 4], [EAST + 1, -3], [EAST + 1, 4]];

// Ebene in der Anleitung (unterste Geländeschicht y = −2 ist Ebene 1)
const level = (y) => y + 3;
// Koordinaten in den Texten wie im Ebenen-Plan der Bau-Seite: die Nordwest-Ecke des Geländes ist x = 0, z = 0.
const GROUND_X = -7;
const GROUND_Z = -8;
const px = (x) => x - GROUND_X;
const pz = (z) => z - GROUND_Z;

function ground(b) {
  b.phase('Platz vorbereiten', `Such dir eine flache Wiese von etwa 24 × 18 Blöcken. Die Farm ist 12 Blöcke lang (West–Ost) und 6 Blöcke tief, die Truhe steht am Ostende, ringsum steht ein Holzrahmen. Die Grasschicht liegt auf Ebene ${level(-1)}; Fundament und Trichter lässt du in sie ein. Alle Koordinaten zählen wie im Ebenen-Plan ab der Nordwest-Ecke des Platzes.`, {
    tips: ['Melonen und Kürbisse wachsen nur, solange du in der Nähe bist (etwa 128 Blöcke). Bau die Farm also neben deine Basis.'],
  });
  terrain(b, { x: GROUND_X, y: -2, z: GROUND_Z, width: 24, depth: 18, height: 1, seed: 'melonen' });
}

function collector(b) {
  b.phase('Truhe und Trichter', `Ganz unten liegen zwei Sammelreihen: je zehn Trichter unter dem späteren Ackerboden und unter dem Schlamm der Fruchtfelder, alle mit der Spitze nach Osten, dazu je ein elfter unter der Ostwand, der in die Truhe schiebt. Alles auf Ebene ${level(-1)}: Grab dafür eine Rinne in die Grasschicht, die Oberkante der Trichter liegt dann bündig mit der Wiese.`, {
    tips: [
      'Setz zuerst die Truhe. Dann halte Schleichen gedrückt und klicke auf die Westseite der Truhe – der Trichter zeigt dann in die Truhe. Jeden weiteren Trichter setzt du schleichend an die Westseite des vorigen.',
      'Ackerboden und Schlamm sind etwas niedriger als ein ganzer Block. Darum saugen die Trichter darunter Melonenscheiben und Kürbisse durch sie hindurch an.',
    ],
  });
  b.step('Doppeltruhe', `Lass die Doppeltruhe östlich der Farm in den Boden ein (x = ${px(EAST + 1)}, z = ${pz(0)} und ${pz(1)}, Ebene ${level(-1)}), die Öffnung nach Osten. Über der Truhe bleibt Luft, dann öffnest du sie bequem von oben.`);
  b.set(EAST + 1, -1, 0, 'chest[facing=east]');
  b.set(EAST + 1, -1, 1, 'chest[facing=east]');
  b.note(EAST + 1, -1, 0, 'Hier landen Melonenscheiben und Kürbisse');
  b.step('Zwei Trichterreihen', `Lege von jeder Truhenhälfte aus elf Trichter nach Westen (x = ${px(EAST)} bis ${px(0)}, z = ${pz(0)} und z = ${pz(1)}), jeder mit der Spitze nach Osten in den nächsten.`);
  for (const z of [0, 1]) for (let x = EAST; x >= 0; x--) b.set(x, -1, z, 'hopper[facing=east]');
}

function foundation(b) {
  b.phase('Fundament, Ackerboden und Wasser', 'Jetzt kommt der Steinsockel rund um die Trichter, darauf die Reihe Ackerboden für die Stängel, daneben der Schlamm für die Früchte und zwei versteckte Wasserquellen.', {
    tips: [
      `Ackerboden bleibt nur feucht, wenn höchstens 4 Blöcke entfernt Wasser auf gleicher Höhe liegt. Die zwei Quellen bei x = ${px(WATER_X[0])} und x = ${px(WATER_X[1])} reichen für alle zehn Felder.`,
      'Eine Frucht wächst nur auf Erde, Gras, Moos, Schlamm oder Ackerboden – und nur, wenn der Platz darüber frei ist. Schlamm bekommst du, wenn du eine Wasserflasche auf Erde anwendest.',
    ],
  });
  b.step('Fundament', `Ersetze auf Ebene ${level(-1)} das Gras rund um die Trichter durch Steinziegel: x = ${px(-1)} bis ${px(EAST)}, z = ${pz(-2)} bis ${pz(3)}. Nur die beiden Trichterreihen bei z = ${pz(0)} und z = ${pz(1)} bleiben, wie sie sind.`);
  for (let x = -1; x <= EAST; x++) {
    for (let z = -2; z <= 3; z++) {
      if ((z === 0 || z === 1) && x >= 0) continue;
      b.set(x, -1, z, BASE);
    }
  }

  b.step('Rand und Wasser', `Lege auf Ebene ${level(0)} den Rand aus Steinziegeln: die Reihen z = ${pz(-2)}, ${pz(-1)}, ${pz(2)} und ${pz(3)} sowie die beiden Stirnseiten (x = ${px(-1)} und x = ${px(EAST)}). In der Reihe z = ${pz(-1)} lässt du bei x = ${px(WATER_X[0])} und x = ${px(WATER_X[1])} je ein Loch und gießt dort Wasser hinein.`);
  for (let x = -1; x <= EAST; x++) {
    for (const z of [-2, -1, 2, 3]) {
      if (z === -1 && WATER_X.includes(x)) continue;
      b.set(x, 0, z, BASE);
    }
  }
  for (const x of [-1, EAST]) for (const z of [0, 1]) b.set(x, 0, z, BASE);
  for (const x of WATER_X) b.set(x, 0, -1, 'water[level=0]');
  b.note(WATER_X[0], 0, -1, 'Wasser für den Ackerboden – kommt später unter einen Beobachter');

  b.step('Ackerboden und Fruchtfelder', `Lege zehn Erdblöcke auf die nördliche Trichterreihe (z = ${pz(0)}) und mach sie mit einer Hacke zu Ackerboden. Auf die südliche Reihe (z = ${pz(1)}) kommen zehn Schlammblöcke – dort wachsen später die Melonen und Kürbisse.`);
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 0, 0, 'farmland[moisture=7]');
    b.set(x, 0, 1, 'mud');
  }
}

function machine(b) {
  b.phase('Beobachter und Kolben', 'Auf den Rand kommt die Erntemaschine: im Norden zehn Beobachter, die genau auf die Stängel schauen, im Süden zehn Kolben hinter den Fruchtfeldern, außen je eine Reihe Andesit, die das Signal trägt.', {
    tips: [
      'Ein Beobachter schaut mit seinem Gesicht auf einen Block und gibt hinten (roter Punkt) einen kurzen Puls aus, sobald sich der Block ändert. Beim Setzen schaut sein Gesicht in deine Blickrichtung.',
      'Ein Kolben zeigt beim Setzen mit dem Kopf zu dir.',
    ],
  });
  b.step('Beobachter', `Setz zehn Beobachter auf Ebene ${level(1)} in die Reihe z = ${pz(-1)}, also auch über die beiden Wasserquellen. Stell dich dazu nördlich davon hin und schau nach Süden: Das Gesicht zeigt dann zum Stängelplatz, der rote Punkt nach Norden.`);
  for (let x = 0; x <= LAST; x++) b.set(x, 1, -1, 'observer[facing=south]');
  b.note(0, 1, -1, 'Beobachter: Gesicht nach Süden auf den Stängel');

  b.step('Kolben', `Setz zehn normale Kolben auf Ebene ${level(1)} in die Reihe z = ${pz(2)}, Kopf nach Norden zum Fruchtfeld. Stell dich auf den Schlamm der Fruchtfelder und schau nach Süden.`);
  for (let x = 0; x <= LAST; x++) b.set(x, 1, 2, 'piston[facing=north]');
  b.note(LAST, 1, 2, 'Kolben schiebt die Frucht ab – sie zerbricht dabei');

  b.step('Träger und Stirnwände', `Lege polierten Andesit hinter die Beobachter (z = ${pz(-2)}) und hinter die Kolben (z = ${pz(3)}), jeweils x = ${px(0)} bis ${px(LAST)}. Schließe die Stirnseiten x = ${px(-1)} und x = ${px(EAST)} auf dieser Ebene mit Steinziegeln (z = ${pz(-2)} bis ${pz(3)}). Wichtig: Die Felder direkt neben dem ersten und dem letzten Stängel müssen belegt sein, sonst wächst dort eine Frucht, die kein Kolben erreicht.`);
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 1, -2, CARRIER);
    b.set(x, 1, 3, CARRIER);
  }
  for (const x of [-1, EAST]) for (let z = -2; z <= 3; z++) b.set(x, 1, z, BASE);
}

function wiring(b) {
  b.phase('Redstone-Leitung', `Die Leitung läuft auf Ebene ${level(2)} einmal um die Farm herum: von den Beobachtern über die Ostwand zu den Kolben. Setz sie erst jetzt, dann feuert beim Bauen nichts.`, {
    tips: [
      'Redstone-Staub verliert pro Block eine Stärke. Der Verstärker an der Ostwand frischt das Signal wieder auf 15 auf, damit es bis zum letzten Kolben reicht.',
      'Ein Verstärker schickt das Signal in deine Blickrichtung weiter: Schau beim Setzen nach Süden.',
    ],
  });
  b.step('Leitung hinter den Beobachtern', `Streu Redstone-Staub auf den Andesit hinter den Beobachtern (z = ${pz(-2)}, x = ${px(0)} bis ${px(EAST)}). Jeder Beobachter macht den Andesit hinter sich stark an, der Staub darauf nimmt den Puls auf.`);
  for (let x = 0; x <= EAST; x++) b.set(x, 2, -2, 'redstone_wire');

  b.step('Über die Ostwand', `Führe den Staub über die Ostwand nach Süden (x = ${px(EAST)}, z = ${pz(-1)} und ${pz(0)}). Auf z = ${pz(1)} kommt ein Verstärker auf 1 Tick, das Dreieck zeigt nach Süden. Danach wieder Staub auf z = ${pz(2)} und z = ${pz(3)}.`);
  b.set(EAST, 2, -1, 'redstone_wire');
  b.set(EAST, 2, 0, 'redstone_wire');
  b.set(EAST, 2, 1, 'repeater[delay=1,facing=north]');
  b.set(EAST, 2, 2, 'redstone_wire');
  b.set(EAST, 2, 3, 'redstone_wire');
  b.note(EAST, 2, 1, 'Verstärker: Signal läuft nach Süden, 1 Tick');

  b.step('Leitung hinter den Kolben', `Streu Staub auf den Andesit hinter den Kolben (z = ${pz(3)}, x = ${px(LAST)} bis ${px(0)}). Der Staub versorgt den Andesit darunter, und der schaltet den Kolben direkt davor.`);
  for (let x = LAST; x >= 0; x--) b.set(x, 2, 3, 'redstone_wire');
}

function frame(b) {
  b.phase('Glasdach und Holzrahmen', 'Eine Glasreihe über den Fruchtfeldern hält hochspringende Stücke im Feld. Ein Rahmen aus Schwarzeiche mit Laternen gibt der Farm einen Abschluss und hält Monster fern.', {
    tips: ['Über den Stängeln bleibt alles offen – sie brauchen Licht von oben. Glas über den Fruchtfeldern stört nicht.'],
  });
  b.step('Glas über den Fruchtfeldern', `Setz zehn Glasblöcke auf Ebene ${level(2)} über die Fruchtfelder (z = ${pz(1)}, x = ${px(0)} bis ${px(LAST)}).`);
  for (let x = 0; x <= LAST; x++) b.set(x, 2, 1, 'glass');

  b.step('Eckpfosten und Balken', `Stell an die vier Ecken außerhalb des Fundaments Schwarzeichenstämme von Ebene ${level(0)} bis ${level(3)} (x = ${px(-2)} und ${px(EAST + 1)}, z = ${pz(-3)} und ${pz(4)}). Verbinde sie oben auf Ebene ${level(3)} mit liegenden, geschälten Schwarzeichenstämmen zu einem Rahmen.`);
  for (const [x, z] of POSTS) for (let y = 0; y <= 3; y++) b.set(x, y, z, `${dark.log}[axis=y]`);
  for (let x = -1; x <= EAST; x++) {
    b.set(x, 3, -3, `${dark.strippedLog}[axis=x]`);
    b.set(x, 3, 4, `${dark.strippedLog}[axis=x]`);
  }
  for (let z = -2; z <= 3; z++) {
    b.set(-2, 3, z, `${dark.strippedLog}[axis=z]`);
    b.set(EAST + 1, 3, z, `${dark.strippedLog}[axis=z]`);
  }

  b.step('Laternen', `Häng unter die beiden langen Balken je drei Laternen (Ebene ${level(2)}, x = ${[1, 5, 8].map(px).join(', ')}) und stell auf jeden Eckpfosten eine Laterne.`);
  for (const x of [1, 5, 8]) {
    b.set(x, 2, -3, 'lantern[hanging=true]');
    b.set(x, 2, 4, 'lantern[hanging=true]');
  }
  for (const [x, z] of POSTS) b.set(x, 4, z, 'lantern[hanging=false]');
}

function plant(b) {
  b.phase('Samen pflanzen', `Pflanze auf die fünf westlichen Ackerböden Melonenkerne, auf die fünf östlichen Kürbiskerne (Ebene ${level(1)}, z = ${pz(0)}). Stell dich dazu auf die Beobachter, von dort erreichst du jeden Ackerboden. Ab jetzt läuft die Farm von allein.`, {
    tips: [
      'Die Stängel wachsen erst ein paar Minuten, bevor die erste Frucht kommt. Während sie wachsen, ändern sie sich – dabei feuern die Kolben ins Leere. Das ist harmlos.',
      'Melonen kannst du in der Werkbank zu Melonenkernen machen, Kürbisse zu Kürbiskernen.',
    ],
  });
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 1, 0, x < MELONS ? 'melon_stem[age=7]' : 'pumpkin_stem[age=7]');
  }
  b.note(2, 1, 1, 'Fruchtfeld: hier wächst die Melone');
  b.note(7, 1, 1, 'Fruchtfeld: hier wächst der Kürbis');
}

function surroundings(b) {
  b.phase('Umgebung', 'Ein Weg führt zur Truhe, ein Beet und ein paar Büsche machen den Platz freundlich, Heuballen mit einer Kürbislaterne stehen neben der Truhe.', {
    tips: ['Leg einen Komposter neben die Truhe: Überzählige Melonenscheiben werden darin zu Knochenmehl.'],
  });
  b.step('Weg und Deko', 'Lege einen Trampelpfad von Osten zur Truhe. Stell daneben einen Komposter und zwei Heuballen mit einer Kürbislaterne darauf.');
  path(b, { x: EAST + 2, y: -1, z: 1, facing: 'east', length: 4, width: 3, mix: 'erde', wiggle: 0.5, seed: 4 });
  b.set(EAST + 2, 0, -1, 'composter[level=0]');
  b.set(EAST + 2, 0, 3, 'hay_block[axis=y]');
  b.set(EAST + 3, 0, 3, 'hay_block[axis=x]');
  b.set(EAST + 2, 1, 3, 'jack_o_lantern[facing=east]');

  b.step('Garten', 'Pflanze vor die Südseite ein Blumenbeet und setze zwei kleine Büsche an die westlichen Ecken.');
  flowerBed(b, { x: 0, y: -1, z: 5, width: LENGTH, depth: 2, facing: 'south', palette: 'warm', seed: 9 });
  bush(b, { x: -4, y: 0, z: 5, size: 'klein', leaves: 'eiche', seed: 3 });
  bush(b, { x: -4, y: 0, z: -5, size: 'klein', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: -7, y: -1, z: -8, width: 24, depth: 18, mix: 'wiese', density: 0.3, seed: 12 });
}

export default function build(b) {
  ground(b);
  collector(b);
  foundation(b);
  machine(b);
  wiring(b);
  frame(b);
  plant(b);
  surroundings(b);
}
