// Weizenfarm mit Wasser-Ernte: 8 Weizenreihen à 7 Pflanzen auf Ackerboden, in der Mitte eine abgedeckte
// Wasserrinne zum Bewässern. Ein Knopf schaltet acht Werfer mit Wassereimern: Das Wasser spült alles zur
// Trichterreihe vorne, die in eine Truhe sammelt. Zweiter Knopfdruck holt das Wasser zurück.
// Lokale Koordinaten: Wiese bis y = 0, Ackerboden y = 1, Pflanzen y = 2. Werfer bei z = 0 (Norden),
// Pflanzen z = 1…7, Trichter z = 8, Truhe (4, 1, 9). Vorderseite = Süden (Truhe).

import { WOOD, terrain, path, bush, vegetation, flowerBed, lampPost } from '../lib/index.js';

export const meta = {
  id: 'weizenfarm-wasser',
  title: 'Weizenfarm mit Wasser-Ernte',
  category: 'farmen',
  subtitle: 'Ein Knopfdruck spült das reife Feld in die Truhe',
  tags: ['Farm', 'Weizen', 'Ackerbau', 'Wasser', 'Werfer', 'Trichter', 'Halbautomatisch', 'Redstone', 'Anfänger', 'Brot'],
  aliases: [
    'weizenfarm', 'weizen farm', 'weizenfarm wasser', 'wasser ernte', 'wasserernte', 'halbautomatische weizenfarm',
    'feld', 'ackerfeld', 'weizenfeld', 'weitzenfarm', 'weizn farm', 'getreidefarm', 'brotfarm', 'wheat farm',
    'semi automatic wheat farm', 'water harvest farm', 'dispenser wheat farm', 'crop farm', 'water crop farm',
  ],
  accuracy: 'vorlage',
  difficulty: 2,
  description: 'Acht Reihen Weizen mit je sieben Pflanzen, in der Mitte eine Wasserrinne unter Stufen, die den ganzen Acker feucht hält. Hinter jeder Reihe steht ein Werfer mit einem Wassereimer. Ist das Feld reif, drückst du den Knopf: Das Wasser bricht alle Pflanzen ab und schwemmt Weizen und Samen zur Trichterreihe, die alles in die Truhe schiebt. Ein zweiter Knopfdruck holt das Wasser zurück, danach säst du von Hand neu.',
  facts: [
    'Wasser bricht jede Feldfrucht ab – auch unreife. Drück den Knopf also erst, wenn das ganze Feld goldgelb ist.',
    'Ackerboden bleibt feucht, solange Wasser höchstens 4 Blöcke entfernt auf gleicher Höhe ist: Die Rinne in der Mitte reicht für alle acht Reihen.',
    'Fließendes Wasser reicht 7 Blöcke weit – darum hat jede Reihe genau sieben Pflanzen und die Trichter liegen im achten Feld.',
    'Ein Werfer mit Wassereimer setzt beim ersten Signal Wasser und nimmt es beim nächsten Signal wieder auf.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Feldfrucht-Farmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Crop_farming' },
    { title: 'Minecraft Wiki: Ackerboden (englisch)', url: 'https://minecraft.wiki/w/Farmland' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const ROWS = [0, 1, 2, 3, 5, 6, 7, 8];
const CHANNEL_X = 4;
const FIRST_Z = 1;
const LAST_Z = 7;
const HOPPER_Z = 8;
const FRONT_Z = 9;
const STONE = 'stone_bricks';
const SLAB = 'stone_brick_slab[type=bottom]';

function hopperFacing(x) {
  if (x < CHANNEL_X) return 'east';
  if (x > CHANNEL_X) return 'west';
  return 'south';
}

function ground(b) {
  b.phase('Platz und Sammelrinne', 'Such dir eine flache Wiese von etwa 21 × 22 Blöcken. Das Feld wird 11 Blöcke breit (Ost–West) und 10 Blöcke tief; die Werfer stehen im Norden, die Truhe im Süden. Du fängst ganz vorne an: mit der Truhe und der Trichterreihe, in die später alles hineinschwimmt.', {
    tips: [
      'Setz zuerst die Truhe und dann die Trichter schleichend an ihre Seite – so zeigen die Trichter-Röhrchen gleich richtig.',
    ],
  });
  terrain(b, { x: -6, y: -1, z: -6, width: 21, depth: 22, height: 1, seed: 'weizenfarm' });
  b.step('Truhe', `Stell die Truhe auf Ebene 2 in die Mitte der Vorderkante (x = 4, z = ${FRONT_Z}), die Öffnung nach Süden zu dir.`);
  b.set(CHANNEL_X, 1, FRONT_Z, 'chest[facing=south]');
  b.note(CHANNEL_X, 1, FRONT_Z, 'Hier landet die Ernte');

  b.step('Trichterreihe', `Lege neun Trichter auf Ebene 2 in die Reihe z = ${HOPPER_Z} (x = 0 bis 8). Der mittlere Trichter zeigt nach Süden in die Truhe, die vier links davon zeigen nach Osten, die vier rechts nach Westen – alle schieben zur Mitte.`);
  for (let x = 0; x <= 8; x++) b.set(x, 1, HOPPER_Z, `hopper[facing=${hopperFacing(x)}]`);
}

function field(b) {
  b.phase('Acker und Bewässerung', 'Jetzt entsteht das Feld: ein Rand aus Steinziegeln, acht Reihen Ackerboden und in der Mitte die Wasserrinne, die den Boden feucht hält.', {
    tips: [
      'Ackerboden machst du, indem du mit einer Hacke auf Erde oder Gras klickst. Spring nie auf Ackerboden – er wird sonst wieder zu Erde.',
      'Die Stufen auf der Rinne halten das Ernte-Wasser fern und sind gleichzeitig ein Steg, auf dem du beim Säen läufst.',
    ],
  });
  b.step('Rand', `Leg auf Ebene 2 einen Rand aus Steinziegeln: die Rückseite (z = 0, x = −1 bis 9) und die beiden Seiten (x = −1 und 9, z = 1 bis ${FRONT_Z}). Vorne links und rechts der Truhe (z = ${FRONT_Z}) ebenfalls Steinziegel.`);
  for (let x = -1; x <= 9; x++) b.set(x, 1, 0, STONE);
  for (const x of [-1, 9]) for (let z = FIRST_Z; z <= FRONT_Z; z++) b.set(x, 1, z, STONE);
  for (let x = 0; x <= 8; x++) if (x !== CHANNEL_X) b.set(x, 1, FRONT_Z, STONE);

  b.step('Ackerboden', `Füll die Fläche innerhalb des Rands auf Ebene 2 mit Erde (z = ${FIRST_Z} bis ${LAST_Z}) – links vier Reihen (x = 0 bis 3), rechts vier Reihen (x = 5 bis 8) – und hacke sie zu Ackerboden um. Die Mitte (x = 4) bleibt für das Wasser frei.`);
  for (const x of ROWS) for (let z = FIRST_Z; z <= LAST_Z; z++) b.set(x, 1, z, 'farmland[moisture=7]');

  b.step('Wasserrinne', `Die freie Mitte (x = 4, z = ${FIRST_Z} bis ${LAST_Z}) wird die Rinne: Gieß je einen Eimer Wasser in jedes zweite Feld (z = 1, 3, 5 und 7). Die drei Felder dazwischen liegen dann zwischen zwei Quellen und werden von selbst zu Quellen. Leg danach Steinziegelstufen (untere Hälfte) auf Ebene 3 über die ganze Rinne.`);
  for (let z = FIRST_Z; z <= LAST_Z; z++) {
    b.set(CHANNEL_X, 1, z, 'water[level=0]');
    b.set(CHANNEL_X, 2, z, SLAB);
  }
  b.note(CHANNEL_X, 1, 4, 'Wasserrinne unter den Stufen: hält alle Reihen feucht');
}

function dispensers(b) {
  b.phase('Werfer und Knopf', 'Hinter jede Reihe kommt ein Werfer mit Wassereimer. Eine Redstone-Leitung oben auf den Werfern verbindet alle mit einem Knopf am Westende.', {
    tips: [
      'Ein Werfer schaut beim Setzen zu dir: Stell dich auf den Acker und schau nach Norden, dann zeigt sein Loch nach Süden aufs Feld.',
      'Setz den Redstone-Staub erst, wenn alle Eimer drin sind – dann löst nichts aus Versehen aus.',
    ],
  });
  b.step('Werfer', 'Stell acht Werfer auf die Rückseite (Ebene 3, z = 0) hinter jede Ackerreihe, das Loch nach Süden. Hinter die Rinne (x = 4) und an die beiden Enden (x = −1 und 9) kommen Steinziegel.');
  for (const x of ROWS) b.set(x, 2, 0, 'dispenser[facing=south]');
  for (const x of [-1, CHANNEL_X, 9]) b.set(x, 2, 0, STONE);
  b.note(0, 2, 0, 'In jeden Werfer einen Wassereimer legen');

  b.step('Leitung und Knopf', 'Streu Redstone-Staub in einer Linie oben auf die Werferreihe (Ebene 4, x = −1 bis 8). Setz einen Steinknopf an die Westseite des Steinziegels am Westende (x = −2, Ebene 3). Der Knopf schaltet den Steinziegel, der den Staub darauf versorgt – der Staub schaltet alle Werfer darunter.');
  for (let x = -1; x <= 8; x++) b.set(x, 3, 0, 'redstone_wire');
  b.set(-2, 2, 0, 'stone_button[face=wall,facing=west]');
  b.note(-2, 2, 0, 'Knopf: einmal = Wasser an, nochmal = Wasser weg');
}

function walls(b) {
  b.phase('Mauer und Zaun', 'Eine niedrige Mauer mit Zaun hält Tiere vom Acker fern – Tiere, die auf den Ackerboden springen, machen ihn kaputt. Vorne lässt ein Tor dich auf den Steg in der Mitte.', {
    tips: ['Die Stufen vorne halten das Ernte-Wasser auf, ohne die Truhe zu blockieren: Eine Truhe geht nur auf, wenn über ihr kein voller Block steht.'],
  });
  b.step('Mauer', `Mauere auf Ebene 3 die Seiten mit Steinziegeln (x = −1 und 9, z = 1 bis ${HOPPER_Z}) und leg vorne eine Reihe Steinziegelstufen (untere Hälfte) über die ganze Breite (z = ${FRONT_Z}, x = −1 bis 9), auch über die Truhe.`);
  for (const x of [-1, 9]) for (let z = FIRST_Z; z <= HOPPER_Z; z++) b.set(x, 2, z, STONE);
  for (let x = -1; x <= 9; x++) b.set(x, 2, FRONT_Z, SLAB);

  b.step('Zaun und Tor', `Setz an die beiden vorderen Ecken Fichtenstämme (Ebene 3 bis 4) und zieh einen Fichtenzaun auf Ebene 4 rundum über die Seitenmauern und vorne über die Stufen. In der Mitte vorne (x = 4) kommt ein Zauntor, das sich nach Norden öffnet. Vor die Truhe stellst du eine Steinziegeltreppe (Ebene 2, z = ${FRONT_Z + 1}), die hohe Seite nach Norden: Über sie steigst du auf die Stufenreihe und durchs Tor auf den Steg. Die Truhe darunter öffnest du trotzdem ganz normal.`);
  for (const x of [-1, 9]) {
    b.set(x, 2, FRONT_Z, `${spruce.log}[axis=y]`);
    b.set(x, 3, FRONT_Z, `${spruce.log}[axis=y]`);
    for (let z = FIRST_Z; z <= HOPPER_Z; z++) b.set(x, 3, z, spruce.fence);
  }
  for (let x = 0; x <= 8; x++) {
    b.set(x, 3, FRONT_Z, x === CHANNEL_X ? `${spruce.fenceGate}[facing=north]` : spruce.fence);
  }
  b.stairs(CHANNEL_X, 1, FRONT_Z + 1, 'stone_brick_stairs', { facing: 'north', half: 'bottom' });
}

function sow(b) {
  b.phase('Säen', 'Säe Weizensamen auf alle 56 Ackerfelder. Nach jeder Ernte musst du von Hand neu säen – das geht schnell vom Steg aus.', {
    tips: [
      'Mit Knochenmehl wächst der Weizen sofort. Ohne braucht er im Schnitt etwa eine halbe Stunde bis zur Reife.',
      'Ablauf einer Ernte: Warten, bis alles reif ist → Knopf drücken → kurz warten, bis alles in der Truhe ist → Knopf nochmal drücken → aus der Truhe Samen nehmen und neu säen.',
      'Weizen wächst nur bei genug Licht. Die Laternen an den Ecken helfen nachts.',
    ],
  });
  for (const x of ROWS) for (let z = FIRST_Z; z <= LAST_Z; z++) b.set(x, 2, z, 'wheat[age=7]');
  b.note(2, 2, 4, 'Reifer Weizen: jetzt Knopf drücken');
}

function surroundings(b) {
  b.phase('Licht und Umgebung', 'Laternen an allen vier Ecken, ein Weg zur Truhe und ein bisschen Garten.', {
    tips: ['Monster spawnen in 26.2 nur bei Blocklicht 0 – mit den Laternen bleibt das Feld nachts frei von Zombies, die sonst den Acker zertrampeln.'],
  });
  b.step('Laternen', `Stell auf die beiden vorderen Eckstämme je eine Laterne (Ebene 5). Hinten außen kommen zwei Laternenpfähle aus Fichtenzaun (x = −2 und 10, z = −1).`);
  for (const x of [-1, 9]) b.set(x, 4, FRONT_Z, 'lantern[hanging=false]');
  lampPost(b, { x: -2, y: 1, z: -1, height: 3, post: spruce.fence });
  lampPost(b, { x: 10, y: 1, z: -1, height: 3, post: spruce.fence });

  b.step('Weg und Garten', 'Leg einen Trampelpfad von Süden zur Truhe, Blumenbeete links und rechts davon und ein paar Büsche hinter das Feld.');
  path(b, { x: CHANNEL_X, y: 0, z: FRONT_Z + 1, facing: 'south', length: 6, width: 3, mix: 'erde', wiggle: 0.5, seed: 5 });
  flowerBed(b, { x: -1, y: 0, z: FRONT_Z + 1, width: 3, depth: 2, facing: 'south', palette: 'warm', seed: 3 });
  flowerBed(b, { x: 7, y: 0, z: FRONT_Z + 1, width: 3, depth: 2, facing: 'south', palette: 'warm', seed: 4 });
  bush(b, { x: -4, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: 12, y: 1, z: -4, size: 'klein', leaves: 'birke', seed: 8 });
  bush(b, { x: 4, y: 1, z: -4, size: 'mittel', leaves: 'eiche', seed: 5 });
  vegetation(b, { x: -6, y: 0, z: -6, width: 21, depth: 22, mix: 'wiese', density: 0.3, seed: 12 });
}

export default function build(b) {
  ground(b);
  field(b);
  dispensers(b);
  walls(b);
  sow(b);
  surroundings(b);
}
