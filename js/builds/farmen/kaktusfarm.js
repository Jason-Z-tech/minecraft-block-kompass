// Kaktusfarm (passiv, ohne Redstone): 13 Kakteen im Zickzack auf Sandblöcken, die auf Schnur über einer Wasserrinne
// schweben. Ein Zaun in der Mitte steht neben jedem Feld, in das ein Kaktus hineinwächst – der neue Block bricht ab,
// fällt zwischen den Sandblöcken hindurch ins Wasser und schwimmt zur Mitte, wo Trichter ihn in die Truhe bringen.
// Lokale Koordinaten: Wüste bis y = −1 (Boden der Rinne), Wasser y = 0, Schnur y = 1, Sand y = 2, Kakteen y = 3,
// Zaun y = 4. Rinne x = −7 … 7, z = −2 … 2; Wände bei x = ±8 und z = ±3; Truhe südlich bei z = 4.

import { WOOD, terrain, path, vegetation, rock, tree } from '../lib/index.js';

export const meta = {
  id: 'kaktusfarm',
  title: 'Kaktusfarm',
  category: 'farmen',
  subtitle: 'Passiv: Kaktus bricht am Zaun ab, Wasser trägt ihn zur Truhe',
  tags: ['Farm', 'Kaktus', 'Passiv', 'Ohne Redstone', 'Wasserstrom', 'Trichter', 'Schnur', 'Wüste', 'Grüner Farbstoff', 'Anfänger', 'Technik'],
  aliases: [
    'kaktusfarm', 'kaktus farm', 'kakteenfarm', 'kaktus', 'kaktussfarm', 'kaktusfram', 'automatische kaktusfarm',
    'passive kaktusfarm', 'cactus farm', 'cactus', 'automatic cactus farm', 'passive cactus farm', 'green dye farm',
    'grüner farbstoff farm', 'farbstofffarm',
  ],
  accuracy: 'eigenes',
  difficulty: 1,
  description: 'Dreizehn Kakteen stehen im Zickzack auf Sandblöcken, die auf Schnur über einer Wasserrinne schweben. Wächst ein Kaktus einen Block höher, steht der neue Block direkt neben dem Zaun in der Mitte – das verträgt ein Kaktus nicht, er bricht sofort ab. Der Block fällt zwischen den Sandblöcken hindurch ins Wasser, die Strömung von beiden Enden trägt ihn zur Mitte, und Trichter bringen ihn in die Truhe. Die Farm braucht keinen Redstone und kein Licht; du musst nur in der Nähe sein.',
  facts: [
    'Ein Kaktus bricht ab, sobald direkt neben ihm etwas Festes steht – auch ein schmaler Zaun, eine Glasscheibe oder ein anderer Kaktus. Darum stehen die Kakteen im Zickzack.',
    'Sand fällt nicht durch Schnur: Schnur ist kein ersetzbarer Block wie Gras oder Wasser. Unter den Sandblöcken bleibt so alles offen, und kein Kaktus bleibt irgendwo liegen.',
    'Fällt ein abgebrochener Kaktus auf die Pflanze darunter, wird er zerstört. Ein Teil der Ernte geht so verloren – das gilt für alle passiven Kaktusfarmen.',
    'Weil neben dem neuen Block kein Kaktus stehen könnte, wächst auch keine Kaktusblüte – die Farm verstopft nicht.',
    'Ein Kaktus wächst im Schnitt etwa alle 18 Minuten einen Block; dreizehn Kakteen bringen nach Abzug der Verluste grob 30 Kakteen pro Stunde. Im Ofen werden sie zu grünem Farbstoff.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Kaktusfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Cactus_farming' },
    { title: 'Minecraft Wiki: Kaktus (englisch)', url: 'https://minecraft.wiki/w/Cactus' },
  ],
  credits: null,
  tested: false,
};

const HALF = 7; // Rinne x = −7 … 7, Wasserquellen bei x = ±7
const END = HALF + 1; // Stirnwände x = ±8
const SIDE = 3; // Längswände z = ±3
const LANE = 2; // Rinne z = −2 … 2
const acacia = WOOD.akazie;
const FLOOR = 'smooth_sandstone';
const RIM = 'cut_sandstone';
const CORNERS = [[-END, -SIDE], [END, -SIDE], [-END, SIDE], [END, SIDE]];
const PILLARS = [...CORNERS, [0, -SIDE], [0, SIDE]]; // Ecken und Mitte der Längsseiten
// Wilde Kakteen in der Umgebung: x, z, Höhe
const WILD_CACTI = [[-13, -4, 3], [-4, -6, 2], [5, 9, 2], [13, 2, 1]];
const STRING = 'tripwire[attached=false,disarmed=false,east=false,north=false,powered=false,south=false,west=false]';

// Zickzack: gerade x in der Nordreihe (z = −1), ungerade x in der Südreihe (z = 1) – nie zwei Kakteen nebeneinander.
const CACTI = [];
for (let x = -6; x <= 6; x++) CACTI.push([x, x % 2 === 0 ? -1 : 1]);

// Ebene in der Anleitung (unterste Geländeschicht y = −2 ist Ebene 1)
const level = (y) => y + 3;
// Koordinaten in den Texten wie im Ebenen-Plan der Bau-Seite: die Nordwest-Ecke des Geländes ist x = 0, z = 0.
const GROUND_X = -15;
const GROUND_Z = -8;
const px = (x) => x - GROUND_X;
const pz = (z) => z - GROUND_Z;
const NORTH_ROW = CACTI.filter(([, z]) => z < 0).map(([x]) => px(x));
const SOUTH_ROW = CACTI.filter(([, z]) => z > 0).map(([x]) => px(x));

// Wasser fließt von den Quellen bei x = ±7 zur Mitte, je Block eine Stufe schwächer (x = 0: Stufe 7).
const waterLevel = (x) => HALF - Math.abs(x);

function ground(b) {
  b.phase('Platz vorbereiten', `Such dir eine flache Stelle von etwa 31 × 21 Blöcken – Wüste passt gut, Kakteen wachsen aber überall. Die Farm ist 17 Blöcke lang (West–Ost) und 7 Blöcke breit, die Truhe liegt südlich der Mitte im Boden. Die oberste Sandschicht liegt auf Ebene ${level(-1)}. Alle Koordinaten zählen wie im Ebenen-Plan ab der Nordwest-Ecke des Platzes.`, {
    tips: ['Kakteen wachsen nur, solange du in der Nähe bist (etwa 128 Blöcke). Licht brauchen sie keines.'],
  });
  terrain(b, { x: GROUND_X, y: -2, z: GROUND_Z, width: 31, depth: 21, height: 1, surface: 'sand', seed: 'kaktus' });
}

function collector(b) {
  b.phase('Truhe und Trichter', `In der Mitte unter der Rinne sammeln Trichter alles ein. Sie liegen in der obersten Sandschicht (Ebene ${level(-1)}), alle mit der Spitze nach Süden, der letzte schiebt in die Doppeltruhe.`, {
    tips: ['Setz zuerst die Truhe. Halte dann Schleichen gedrückt und klicke auf die Nordseite der Truhe – der Trichter zeigt mit seinem Röhrchen in die Truhe. Jeden weiteren Trichter setzt du schleichend an die Nordseite des vorigen.'],
  });
  b.step('Doppeltruhe', `Lass die Doppeltruhe in den Boden ein (x = ${px(0)} und ${px(1)}, z = ${pz(4)}, Ebene ${level(-1)}), die Öffnung nach Süden. Darüber bleibt Luft, dann öffnest du sie von oben.`);
  b.set(0, -1, 4, 'chest[facing=south]');
  b.set(1, -1, 4, 'chest[facing=south]');
  b.note(1, -1, 4, 'Hier landen die Kakteen');
  b.step('Trichter', `Lege von der Truhe aus sechs Trichter nach Norden (x = ${px(0)}, z = ${pz(SIDE)} bis ${pz(-LANE)}), jeder mit der Spitze nach Süden in den nächsten. Fünf davon liegen später unter dem Wasser, der sechste unter dem Rand.`);
  for (let z = SIDE; z >= -LANE; z--) b.set(0, -1, z, 'hopper[facing=south]');
}

function basin(b) {
  b.phase('Boden und Rand der Rinne', 'Die Rinne ist nur einen Block tief: ein Boden aus glattem Sandstein und ein niedriger Rand aus geschnittenem Sandstein.', {
    tips: ['Setz den Rand erst ganz, bevor du später Wasser eingießt – sonst läuft es aus.'],
  });
  b.step('Boden', `Ersetze auf Ebene ${level(-1)} den Sand unter der Farm durch glatten Sandstein (x = ${px(-END)} bis ${px(END)}, z = ${pz(-SIDE)} bis ${pz(SIDE)}). Nur die Trichter bleiben, wie sie sind.`);
  for (let x = -END; x <= END; x++) {
    for (let z = -SIDE; z <= SIDE; z++) {
      if (x === 0 && z >= -LANE) continue;
      b.set(x, -1, z, FLOOR);
    }
  }
  b.step('Rand', `Mauere auf Ebene ${level(0)} den Rand aus geschnittenem Sandstein: die Längsseiten z = ${pz(-SIDE)} und z = ${pz(SIDE)}, die Stirnseiten x = ${px(-END)} und ${px(END)}. In die vier Ecken kommt gemeißelter Sandstein. Innen (x = ${px(-HALF)} bis ${px(HALF)}, z = ${pz(-LANE)} bis ${pz(LANE)}) bleibt die Rinne frei.`);
  for (let x = -END; x <= END; x++) {
    b.set(x, 0, -SIDE, RIM);
    b.set(x, 0, SIDE, RIM);
  }
  for (const x of [-END, END]) for (let z = -LANE; z <= LANE; z++) b.set(x, 0, z, RIM);
  for (const [x, z] of CORNERS) b.set(x, 0, z, 'chiseled_sandstone');
}

function sandOnString(b) {
  b.phase('Sand auf Schnur', `Jetzt kommt der Trick dieser Farm: Jeder Kaktus steht auf einem Sandblock, der auf einem Stück Schnur über der Rinne schwebt (Schnur auf Ebene ${level(1)}, Sand auf Ebene ${level(2)}). Darunter bleibt alles offen, und die Rinne ist durchgehend frei.`, {
    tips: [
      'Sand fällt nur, wenn unter ihm Luft, Wasser oder etwas Ersetzbares wie Gras ist. Schnur gehört nicht dazu – der Sand bleibt liegen.',
      'Schnur braucht keinen Block darunter. Sie bleibt in der Luft hängen, wenn du ihren Hilfsblock wieder abbaust.',
      `Die Plätze bilden ein Zickzack: sieben in der Nordreihe (z = ${pz(-1)}), sechs in der Südreihe (z = ${pz(1)}), immer versetzt – nie zwei Kakteen nebeneinander.`,
    ],
  });
  b.step('Schnur auf Hilfsblöcken', `Stell auf jeden der 13 Plätze einen Hilfsblock (z. B. Erde) auf den trockenen Boden der Rinne (Ebene ${level(0)}): x = ${NORTH_ROW.join(', ')} bei z = ${pz(-1)} und x = ${SOUTH_ROW.join(', ')} bei z = ${pz(1)}. Lege oben auf jeden Hilfsblock ein Stück Schnur.`);
  for (const [x, z] of CACTI) b.set(x, 1, z, STRING);
  b.note(0, 1, -1, 'Schnur: hält den Sand, Gegenstände fallen hindurch');
  b.step('Sand', `Setz auf jedes Stück Schnur einen Sandblock (Ebene ${level(2)}) – zielen kannst du direkt auf die Schnur. Bau danach alle 13 Hilfsblöcke darunter wieder ab: Schnur und Sand bleiben schweben.`);
  for (const [x, z] of CACTI) b.set(x, 2, z, 'sand');
}

function cacti(b) {
  b.phase('Kakteen pflanzen', `Setz auf jeden der 13 Sandblöcke einen Kaktus (Ebene ${level(3)}). Neben einem Kaktus darf auf seiner Höhe nichts stehen – das Zickzack sorgt dafür.`);
  for (const [x, z] of CACTI) b.set(x, 3, z, 'cactus[age=0]');
}

function water(b) {
  b.phase('Wasser einlassen', `Jetzt füllst du die Rinne (Ebene ${level(0)}). Das Wasser fließt von beiden Enden sieben Blöcke weit und endet genau über den Trichtern in der Mitte.`, {
    tips: ['Gießt du in zwei Felder mit einer Lücke dazwischen je einen Eimer, wird die Lücke von selbst zur Quelle. So brauchst du pro Ende nur drei Eimer.'],
  });
  for (let x = -HALF; x <= HALF; x++) {
    for (let z = -LANE; z <= LANE; z++) b.set(x, 0, z, `water[level=${waterLevel(x)}]`);
  }
  b.note(-HALF, 0, 0, `Quellen am Ende: je ein Eimer bei z = ${pz(-2)}, ${pz(0)} und ${pz(2)}`);
  b.note(0, 0, 1, 'Die Strömungen treffen sich über den Trichtern');
}

function walls(b) {
  b.phase('Glaswände und Zaun', 'Glaswände halten abgebrochene Kakteen in der Farm. Der Zaun in der Mitte ist das, woran die neuen Kaktusblöcke abbrechen.', {
    tips: [
      'Zwischen Wand und Kaktus muss immer ein Feld frei bleiben – die Wände stehen deshalb außen auf dem Rand.',
      'Ein schmaler Zaun ist besser als ein voller Block: Der abgebrochene Kaktus prallt ab und fällt eher daneben als auf die Pflanze darunter.',
    ],
  });
  b.step('Pfeiler', `Stell sechs Pfeiler auf den Rand – an die vier Ecken und in die Mitte der beiden Längsseiten (x = ${px(0)}): geschälte Akazienstämme von Ebene ${level(1)} bis ${level(4)}, oben gemeißelter Sandstein (Ebene ${level(5)}) und darauf eine Laterne.`);
  for (const [x, z] of PILLARS) {
    for (let y = 1; y <= 4; y++) b.set(x, y, z, `${acacia.strippedLog}[axis=y]`);
    b.set(x, 5, z, 'chiseled_sandstone');
    b.set(x, 6, z, 'lantern[hanging=false]');
  }
  b.step('Glas', `Setz Glas auf den ganzen Rand zwischen die Pfeiler, vier Blöcke hoch (Ebene ${level(1)} bis ${level(4)}), und leg oben eine Reihe Sandsteinstufen darauf (Ebene ${level(5)}, untere Hälfte).`);
  for (let y = 1; y <= 4; y++) {
    for (let x = -HALF; x <= HALF; x++) {
      if (x === 0) continue;
      b.set(x, y, -SIDE, 'glass');
      b.set(x, y, SIDE, 'glass');
    }
    for (const x of [-END, END]) for (let z = -LANE; z <= LANE; z++) b.set(x, y, z, 'glass');
  }
  for (let x = -HALF; x <= HALF; x++) {
    if (x === 0) continue;
    b.set(x, 5, -SIDE, 'cut_sandstone_slab[type=bottom]');
    b.set(x, 5, SIDE, 'cut_sandstone_slab[type=bottom]');
  }
  for (const x of [-END, END]) for (let z = -LANE; z <= LANE; z++) b.set(x, 5, z, 'cut_sandstone_slab[type=bottom]');

  b.step('Zaun', `Zieh einen Akazienzaun durch die Mitte (Ebene ${level(4)}, z = ${pz(0)}, x = ${px(-HALF)} bis ${px(HALF)}) von Stirnwand zu Stirnwand. Er steht genau neben jedem Feld, in das ein Kaktus hineinwächst – in beiden Reihen.`);
  for (let x = -HALF; x <= HALF; x++) b.set(x, 4, 0, acacia.fence);
  b.note(2, 4, 0, 'Wächst ein Kaktus neben den Zaun, bricht der neue Block sofort ab');
}

function surroundings(b) {
  b.phase('Umgebung', 'Ein Kiesweg führt zur Truhe, ringsum stehen eine Akazie, ein paar Sandsteinfelsen, wilde Kakteen und trockene Büsche.', {
    tips: ['Wilde Kakteen brauchen nach allen vier Seiten ein freies Feld. Trockene Büsche und Gras daneben stören nicht.'],
  });
  path(b, { x: 0, y: -1, z: 5, facing: 'south', length: 6, width: 3, mix: 'kies', wiggle: 0.5, seed: 6 });
  tree(b, { x: -11, y: 0, z: 7, species: 'akazie', size: 'klein', seed: 2 });
  for (const [x, z, height] of WILD_CACTI) for (let y = 0; y < height; y++) b.set(x, y, z, 'cactus[age=0]');
  rock(b, { x: 11, y: 0, z: -5, size: 'mittel', material: 'sandstein', moss: false, seed: 4 });
  rock(b, { x: 10, y: 0, z: 7, size: 'klein', material: 'sandstein', moss: false, rubble: false, seed: 9 });
  vegetation(b, { x: -15, y: -1, z: -8, width: 31, depth: 21, mix: 'trocken', density: 0.25, seed: 15 });
}

export default function build(b) {
  ground(b);
  collector(b);
  basin(b);
  sandOnString(b);
  cacti(b);
  water(b);
  walls(b);
  surroundings(b);
}
