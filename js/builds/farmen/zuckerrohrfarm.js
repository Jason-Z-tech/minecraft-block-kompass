// Zuckerrohrfarm: eine Reihe Zuckerrohr auf Schlamm neben Wasser. Beobachter oben erkennen das dritte Rohr,
// Redstone schaltet alle Kolben in der Mitte, die Trichter unter dem Schlamm sammeln alles in eine Truhe.
// Lokale Koordinaten: Wiese bis y = 0, Reihe x = 0 … 9, Zuckerrohr z = 0, Wasser/Glas im Süden (z = 1),
// Kolben/Beobachter im Norden (z = −1), Redstone z = −2. Vorderseite = Süden (Glasseite).

import { WOOD, terrain, path, bush, vegetation, flowerBed } from '../lib/index.js';

export const meta = {
  id: 'zuckerrohrfarm',
  title: 'Zuckerrohrfarm',
  category: 'farmen',
  subtitle: 'Vollautomatisch mit Beobachtern, Kolben und Trichtern',
  tags: ['Farm', 'Zuckerrohr', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Papier', 'Technik', 'Anfänger'],
  aliases: [
    'zuckerrohrfarm', 'zuckerrohr farm', 'automatische zuckerrohrfarm', 'zuckerrohr', 'zuckerrohfarm', 'zuckerohrfarm',
    'papierfarm', 'papier farm', 'sugar cane farm', 'sugarcane farm', 'automatic sugar cane farm', 'sugar cane',
    'observer sugar cane farm', 'cane farm',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Zehn Zuckerrohre wachsen auf Schlamm direkt neben einer Wasserrinne. Sobald irgendein Rohr drei Blöcke hoch ist, sieht es der Beobachter darüber und schickt über eine Redstone-Leitung einen Puls an alle zehn Kolben – sie schlagen das mittlere Rohr ab, das obere fällt mit. Die Rohre fallen in einem Glasschacht auf den Schlamm, die Trichter darunter ziehen sie durch den Schlamm hindurch und schieben sie in eine Doppeltruhe. Du musst nur das Zuckerrohr pflanzen und ab und zu die Truhe leeren.',
  facts: [
    'Zuckerrohr wächst ohne Licht und höchstens drei Blöcke hoch – die Kolben ernten genau den zweiten und dritten Block.',
    'Schlamm ist nur 14/16 Block hoch: Trichter darunter saugen Gegenstände, die auf ihm liegen, direkt an.',
    'Die unterste Rohrstufe bleibt immer stehen und wächst einfach nach – du musst nie neu pflanzen.',
    'Im Schnitt wächst ein Rohr alle 18 Minuten um einen Block; zehn Rohre bringen rund 30–35 Zuckerrohr pro Stunde, solange du in der Nähe bist.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Zuckerrohr-Farmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Sugar_cane_farming' },
  ],
  credits: null,
  tested: false,
};

const LENGTH = 10;
// Koordinaten in den Texten wie im Ebenen-Plan der Bau-Seite: die Nordwest-Ecke des Geländes ist x = 0, z = 0.
const GROUND_X = -6;
const GROUND_Z = -7;
const px = (x) => x - GROUND_X;
const pz = (z) => z - GROUND_Z;
const LAST = LENGTH - 1;
const spruce = WOOD.fichte;
const WATER = 'water[level=0]';
const BASE = 'stone_bricks';

// Ecken des Rahmens: Pfosten aus Fichtenstamm, außen um den Kasten.
const POSTS = [[-1, -2], [-1, 2], [LENGTH, -2], [LENGTH, 2]];

function ground(b) {
  b.phase('Platz vorbereiten', `Such dir eine flache Wiese von etwa 22 × 15 Blöcken. Die Farm ist 12 Blöcke lang (Ost–West) und 5 Blöcke tief; die Truhe steht am Ostende. Markiere die Reihe x = ${px(0)} bis ${px(LAST)} bei z = ${pz(0)} – dort wächst später das Zuckerrohr. (Alle Koordinaten zählen wie im Ebenen-Plan ab der Nordwest-Ecke des Platzes.)`, {
    tips: ['Baue die Farm in der Nähe deiner Basis: Zuckerrohr wächst nur, solange du höchstens etwa 128 Blöcke entfernt bist.'],
  });
  terrain(b, { x: GROUND_X, y: -1, z: GROUND_Z, width: 22, depth: 15, height: 1, seed: 'zuckerrohr' });
}

function collector(b) {
  b.phase('Truhe und Trichter', 'Ganz unten liegt die Sammelreihe: zehn Trichter unter den späteren Schlammblöcken, alle mit der Spitze nach Osten, dazu ein elfter unter der Ostwand, der in die Truhe schiebt.', {
    tips: [
      'Setz zuerst die Truhe. Dann halte Schleichen gedrückt und klicke auf die Westseite der Truhe – der Trichter zeigt dann mit der Spitze in die Truhe. Jeden weiteren Trichter setzt du schleichend an die Westseite des vorigen.',
      'Prüfe am Ende: Die kleinen Röhrchen unten an den Trichtern müssen alle nach Osten zeigen, nicht nach unten.',
    ],
  });
  b.step('Doppeltruhe', `Stell die Doppeltruhe auf Ebene 3 östlich der Farm auf (x = ${px(LENGTH + 1)}, z = ${pz(0)} und ${pz(1)}), die Öffnung nach Osten. Über der Truhe muss Luft bleiben, sonst lässt sie sich nicht öffnen.`);
  b.set(LENGTH + 1, 1, 0, 'chest[facing=east]');
  b.set(LENGTH + 1, 1, 1, 'chest[facing=east]');
  b.step('Trichterreihe', `Lege elf Trichter von der Truhe aus nach Westen (x = ${px(LENGTH)} bis ${px(0)}, z = ${pz(0)}), jeder mit der Spitze nach Osten in den nächsten.`);
  for (let x = LENGTH; x >= 0; x--) b.set(x, 1, 0, 'hopper[facing=east]');
  b.note(LENGTH, 1, 0, 'Letzter Trichter: schiebt in die Truhe');
}

function base(b) {
  b.phase('Unterbau, Schlamm und Wasser', 'Jetzt kommt der Steinsockel rund um die Trichter, darauf der Schlamm für das Zuckerrohr und daneben die Wasserrinne.', {
    tips: ['Schlamm bekommst du, indem du einen Wassereimer – oder eine Wasserflasche – auf Erde anwendest.'],
  });
  b.step('Sockel', `Mauere den Sockel aus Steinziegeln: auf Ebene 3 die Reihen nördlich und südlich der Trichter (z = ${pz(-2)}, ${pz(-1)}, ${pz(1)} und ${pz(2)}, x = ${px(-1)} bis ${px(LENGTH)}) und das Westende der Trichterreihe (x = ${px(-1)}). Auf Ebene 4 die Südwand (z = ${pz(2)}), die Rückseite (z = ${pz(-1)} und ${pz(-2)}) und die beiden Stirnseiten (x = ${px(-1)} und ${px(LENGTH)}) – die Reihe z = ${pz(1)} bleibt für das Wasser frei.`);
  for (let x = -1; x <= LENGTH; x++) {
    for (const z of [-2, -1, 1, 2]) b.set(x, 1, z, BASE);
    b.set(x, 2, 2, BASE);
    b.set(x, 2, -1, BASE);
    b.set(x, 2, -2, BASE);
  }
  b.set(-1, 1, 0, BASE);
  for (const x of [-1, LENGTH]) for (let z = -2; z <= 2; z++) b.set(x, 2, z, BASE);

  b.step('Schlamm', `Lege zehn Schlammblöcke direkt auf die Trichter (Ebene 4, x = ${px(0)} bis ${px(LAST)}, z = ${pz(0)}). Durch den niedrigen Schlamm hindurch sammeln die Trichter alles ein, was darauf fällt.`);
  for (let x = 0; x <= LAST; x++) b.set(x, 2, 0, 'mud');

  b.step('Wasserrinne', `Fülle die Rinne südlich vom Schlamm (Ebene 4, z = ${pz(1)}) mit Wasser. Gieß Eimer in die Felder x = ${[0, 2, 4, 6, 8, 9].map(px).join(', ')} – die Lücken bei x = ${[1, 3, 5, 7].map(px).join(', ')} werden von selbst zu Quellen, weil sie zwei Quellen neben sich haben. Jedes Zuckerrohr braucht Wasser direkt neben seinem Schlammblock.`);
  for (let x = 0; x <= LAST; x++) b.set(x, 2, 1, WATER);
}

function machine(b) {
  b.phase('Kolben, Beobachter und Redstone', 'Auf der Nordseite steht die Erntemaschine: zehn Kolben auf Höhe des zweiten Rohrs, darüber zehn Beobachter auf Höhe des dritten Rohrs, dahinter eine Redstone-Leitung.', {
    tips: [
      'Ein Beobachter schaut mit seinem Gesicht auf einen Block und gibt hinten (roter Punkt) einen kurzen Puls aus, sobald sich dieser Block ändert.',
      'Setz den Redstone-Staub als Letztes. Dann feuern die Kolben nicht schon beim Bauen.',
    ],
  });
  b.step('Mauer für die Leitung', `Mauere die Rückwand höher: Steinziegel auf Ebene 5 in den Reihen z = ${pz(-1)} (unter die Kolben) und z = ${pz(-2)} (unter den Redstone), dazu Ebene 6 in Reihe z = ${pz(-2)}. An beiden Stirnseiten (x = ${px(-1)} und ${px(LENGTH)}) wächst in Reihe z = ${pz(-1)} ein Pfeiler von Ebene 5 bis 7.`);
  for (let x = 0; x <= LAST; x++) {
    b.set(x, 3, -1, BASE);
    b.set(x, 3, -2, BASE);
    b.set(x, 4, -2, BASE);
  }
  for (const x of [-1, LENGTH]) for (let y = 3; y <= 5; y++) b.set(x, y, -1, BASE);

  b.step('Kolben', `Setz zehn normale Kolben auf Ebene 6 (z = ${pz(-1)}), Kopf nach Süden zum Zuckerrohr. Ein Kolben zeigt beim Setzen mit dem Kopf zu dir: Stell dich auf die Schlammreihe und schau nach Norden.`);
  for (let x = 0; x <= LAST; x++) b.set(x, 4, -1, 'piston[facing=south]');

  b.step('Beobachter', 'Setz zehn Beobachter auf die Kolben (Ebene 7). Ihr Gesicht schaut nach Süden auf das dritte Zuckerrohr, der rote Punkt nach Norden. Ein Beobachter schaut beim Setzen in deine Blickrichtung: Stell dich hinter die Maschine und schau nach Süden.');
  for (let x = 0; x <= LAST; x++) b.set(x, 5, -1, 'observer[facing=south]');
  b.note(0, 5, -1, 'Beobachter: Gesicht nach Süden zum dritten Rohr');

  b.step('Redstone-Leitung', `Streu Redstone-Staub in einer geraden Linie auf die Rückwand (Ebene 7, z = ${pz(-2)}) hinter alle Beobachter. Der Puls eines Beobachters läuft so durch die ganze Linie; der Staub versorgt die Steinziegel darunter, und die schalten die Kolben daneben.`);
  for (let x = 0; x <= LAST; x++) b.set(x, 5, -2, 'redstone_wire');
  b.note(LAST, 5, -2, 'Staub versorgt die Steinziegel darunter – die schalten die Kolben');
}

function enclosure(b) {
  b.phase('Glasschacht und Rahmen', 'Damit kein Zuckerrohr verloren geht, fällt alles in einem engen Schacht: vorne Glas, hinten die Kolben, an den Enden Glas. Ein Fichtenrahmen hält alles zusammen.', {
    tips: ['Das Glas über dem Wasser darf direkt auf der Wasserfläche stehen – das Wasser bleibt eine Quelle und das Zuckerrohr wächst weiter.'],
  });
  b.step('Glaswand', `Setz Glas über die Wasserrinne (z = ${pz(1)}) von Ebene 5 bis 7 und schließe die beiden Enden des Schachts (x = ${px(-1)} und ${px(LENGTH)}, z = ${pz(0)} und ${pz(1)}) ebenfalls mit Glas, Ebene 5 bis 7. Ab jetzt kommst du nicht mehr an den Schlamm – darum hast du vorher gepflanzt.`);
  for (let x = 0; x <= LAST; x++) for (let y = 3; y <= 5; y++) b.set(x, y, 1, 'glass');
  for (const x of [-1, LENGTH]) {
    for (let y = 3; y <= 5; y++) {
      b.set(x, y, 0, 'glass');
      b.set(x, y, 1, 'glass');
    }
  }

  b.step('Rahmen', 'Stell an die vier Ecken Fichtenstämme von Ebene 3 bis 8. Lege oben (Ebene 8) liegende, geschälte Fichtenstämme als Kranz: von Ost nach West auf die Beobachter und auf das Glas, an den Enden von Nord nach Süd. Über dem Zuckerrohr bleibt der Schacht offen; hochspringende Rohre fallen von selbst zurück. Auf die Südwand kommt eine Reihe Steinziegelstufen als Sims.');
  for (const [x, z] of POSTS) for (let y = 1; y <= 6; y++) b.set(x, y, z, `${spruce.log}[axis=y]`);
  for (let x = -1; x <= LENGTH; x++) {
    b.set(x, 6, -1, `${spruce.strippedLog}[axis=x]`);
    b.set(x, 6, 1, `${spruce.strippedLog}[axis=x]`);
    b.set(x, 3, 2, 'stone_brick_slab[type=bottom]');
  }
  for (const x of [-1, LENGTH]) b.set(x, 6, 0, `${spruce.strippedLog}[axis=z]`);
  for (const x of [-1, LENGTH]) b.set(x, 3, 2, `${spruce.log}[axis=y]`);
}

function plant(b) {
  b.phase('Zuckerrohr pflanzen', `Pflanze jetzt, solange der Schlamm noch frei liegt: Stell dich auf die Südwand (Ebene 4, z = ${pz(2)}) und setz auf jeden der zehn Schlammblöcke ein Zuckerrohr. Ab jetzt arbeitet die Farm schon – das Glas kommt erst danach.`, {
    tips: [
      'Pflanze erst, wenn Beobachter und Redstone stehen. Ein Beobachter meldet nur Änderungen: Ist ein Rohr schon drei hoch, bevor er steht, sieht er es nie wachsen.',
      'Wenn ein Rohr drei Blöcke hoch wird, feuern alle zehn Kolben gleichzeitig. Rohre, die erst zwei hoch sind, verlieren dabei ihren zweiten Block – das ist normal und kostet nichts.',
      'Zuckerrohr wächst nur in geladenen Chunks. Bleib in der Nähe, während die Farm arbeiten soll.',
    ],
  });
  for (let x = 0; x <= LAST; x++) b.set(x, 3, 0, 'sugar_cane');
  b.note(4, 3, 0, 'Zuckerrohr auf Schlamm, Wasser direkt daneben');
}

function surroundings(b) {
  b.phase('Licht und Umgebung', 'Laternen auf dem Rahmen halten Monster vom Dach fern. Ein Weg führt zur Truhe, ein paar Blumen und Büsche machen den Platz freundlich.', {
    tips: ['Monster spawnen in 26.2 nur bei Blocklicht 0 – die vier Laternen reichen für die ganze Farm.'],
  });
  b.step('Laternen', 'Stell auf jeden der vier Eckpfosten eine Laterne (Ebene 9).');
  for (const [x, z] of POSTS) b.set(x, 7, z, 'lantern[hanging=false]');

  b.step('Weg und Garten', 'Lege einen Trampelpfad von Süden zur Truhe, ein Blumenbeet vor die Glasseite und setze zwei kleine Büsche an die Ecken.');
  path(b, { x: LENGTH + 2, y: 0, z: 1, facing: 'south', length: 5, width: 3, mix: 'erde', wiggle: 0.5, seed: 3 });
  flowerBed(b, { x: 0, y: 0, z: 3, width: LENGTH, depth: 2, facing: 'south', palette: 'warm', seed: 7 });
  bush(b, { x: -3, y: 1, z: 5, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: -3, y: 1, z: -5, size: 'klein', leaves: 'azalee', seed: 5 });
  vegetation(b, { x: -6, y: 0, z: -7, width: 22, depth: 15, mix: 'wiese', density: 0.3, seed: 11 });
}

export default function build(b) {
  ground(b);
  collector(b);
  base(b);
  machine(b);
  plant(b);
  enclosure(b);
  surroundings(b);
}
