// Seetangfarm: elf Seetangpflanzen in einer Kammer aus Wasserquellen. Beobachter schauen auf den untersten Block;
// wächst ein zweiter, feuern alle Kolben auf Höhe des zweiten Blocks. Die Stücke steigen im Wasser auf, die Strömung
// drückt sie in eine Rinne über einer Trichterreihe, die alles zur Truhe bringt.
// Lokale Koordinaten: Wiese bis y = −1, Boden y = 0 (Sand unter dem Seetang), Seetang y = 1, Erntehöhe y = 2,
// Vorrat y = 3, Glasdecke y = 4. Kammer x = −5 … 5: z = 0 Seetang, z = 1 Trichter (y = 2) und Rinne (y = 3),
// z = −1 Beobachter (y = 1) und Kolben (y = 2), z = −2 Redstone (y = 1 und y = 3), z = −3 Rückwand.
// Türme x = −8 … −6 (Westturm mit der Redstone-Treppe) und x = 6 … 8.

import { terrain, path, bush, vegetation, pond } from '../lib/index.js';

export const meta = {
  id: 'seetangfarm',
  title: 'Seetangfarm',
  category: 'farmen',
  subtitle: 'Beobachter und Kolben ernten Seetang, eine Trichterreihe sammelt ihn ein',
  tags: ['Farm', 'Seetang', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Wasser', 'Brennstoff', 'Technik'],
  aliases: [
    'seetangfarm', 'seetang farm', 'automatische seetangfarm', 'seetang', 'setangfarm', 'seetangfram', 'algenfarm',
    'algen farm', 'kelp farm', 'kelp', 'automatic kelp farm', 'observer kelp farm', 'dried kelp farm',
    'getrockneter seetang', 'brennstofffarm',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Elf Seetangpflanzen wachsen in einer Kammer voller Wasserquellen. Hinter jeder schaut ein Beobachter auf den untersten Block: Wächst ein zweiter, ändert sich der untere – der Beobachter sendet einen Puls, eine Redstone-Treppe im Westturm bringt ihn zwei Ebenen höher, und alle elf Kolben schlagen den zweiten Block ab. Die Stücke steigen im Wasser auf, die Strömung schiebt sie in eine flache Rinne, und die Trichter darunter bringen sie in die Truhe. Du füllst das Wasser ein, pflanzt den Seetang und leerst ab und zu die Truhe.',
  facts: [
    'Seetang wächst nur in volles Wasser – eine Quelle oder herabfallendes Wasser, nie in flach fließendes. Darum stehen über dem Seetang zwei Schichten Wasserquellen.',
    'Fährt ein Kolben in Wasser, verdrängt er es. Danach füllen die Quellen der obersten Schicht das Erntefeld mit herabfließendem Wasser – darin wächst der Seetang genauso weiter.',
    'Seetang-Stücke steigen im Wasser nach oben. Die Strömung aus der Kammer schiebt sie in die Rinne direkt über den Trichtern.',
    'Der unterste Seetangblock bleibt stehen und bekommt beim Abbrechen ein neues Alter – er wächst immer weiter.',
    'Ein Seetang wächst im Schnitt etwa alle 8 Minuten einen Block; elf Pflanzen bringen so rund 80 Seetang pro Stunde. Getrocknet und als Block gepresst ist er ein guter Brennstoff.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Seetangfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Kelp_farming' },
    { title: 'Minecraft Wiki: Seetang (englisch)', url: 'https://minecraft.wiki/w/Kelp' },
  ],
  credits: null,
  tested: false,
};

const KELP_FROM = -5;
const KELP_TO = 5;
const KELP_X = [];
for (let x = KELP_FROM; x <= KELP_TO; x++) KELP_X.push(x);
const BRICK = 'prismarine_bricks';
const DARK = 'dark_prismarine';
const GLASS = 'glass';
const WEST = [-8, -7, -6];
const EAST = [6, 7, 8];
const TOWER_CORNERS = [[-8, -3], [-8, 2], [8, -3], [8, 2]];
const FRONT_LIGHTS = [-3, 3];

// Redstone-Treppe im Westturm: untere Leitung → Verstärker → zwei Stufen hinauf (über z = −1) → obere Leitung.
// Sie liegt ganz im Turm (Spalte x = −7); die Außenwand x = −8 bleibt geschlossen.
const REPEATER = [-6, 1, -2];
const STAIR_DUST = [[-7, 1, -2], [-7, 2, -1], [-7, 3, -2]];
const STAIR_GLASS = [-7, 2, -2];
const STAIR_AIR = [-7, 3, -1];

// Ebene in der Anleitung (unterste Geländeschicht y = −3 ist Ebene 1)
const level = (y) => y + 4;
// Koordinaten in den Texten wie im Ebenen-Plan der Bau-Seite: die Nordwest-Ecke des Geländes ist x = 0, z = 0.
const GROUND_X = -16;
const GROUND_Z = -8;
const px = (x) => x - GROUND_X;
const pz = (z) => z - GROUND_Z;
const KELP_SPAN = `x = ${px(KELP_FROM)} bis ${px(KELP_TO)}`;

const isStairCell = (x, y, z) =>
  [REPEATER, STAIR_GLASS, STAIR_AIR, ...STAIR_DUST].some(([sx, sy, sz]) => sx === x && sy === y && sz === z);

// Turmblöcke einer Ebene (ohne die Zellen der Redstone-Treppe)
function towerLayer(b, y) {
  for (const x of [...WEST, ...EAST]) {
    for (let z = -3; z <= 2; z++) {
      if (isStairCell(x, y, z)) continue;
      const corner = TOWER_CORNERS.some(([cx, cz]) => cx === x && cz === z);
      const window = y === 2 && Math.abs(x) === 7 && (z === -3 || z === 2);
      b.set(x, y, z, window ? 'sea_lantern' : corner ? DARK : BRICK);
    }
  }
}

function ground(b) {
  b.phase('Platz vorbereiten', `Such dir eine flache Wiese von etwa 31 × 19 Blöcken. Die Farm ist 17 Blöcke lang (West–Ost) und 6 Blöcke tief, die Truhe sitzt in der Südwand. Die Grasschicht liegt auf Ebene ${level(-1)}. Alle Koordinaten zählen wie im Ebenen-Plan ab der Nordwest-Ecke des Platzes.`, {
    tips: ['Seetang wächst nur, solange du in der Nähe bist (etwa 128 Blöcke). Licht braucht er keines, nur Wasser.'],
  });
  terrain(b, { x: GROUND_X, y: -3, z: GROUND_Z, width: 31, depth: 19, height: 2, seed: 'seetang' });
}

function foundation(b) {
  b.phase('Fundament und Boden', 'Zuerst kommen ein Fundament aus Prismarinziegeln und darauf der Boden der Farm mit einer Reihe Sand für den Seetang.', {
    tips: ['Seetang hält sich auf jedem festen Block außer Magma. Sand ist am einfachsten – und du findest ihn sowieso am Meer.'],
  });
  b.step('Fundament', `Ersetze auf Ebene ${level(-1)} das Gras unter der Farm durch Prismarinziegel (x = ${px(-8)} bis ${px(8)}, z = ${pz(-3)} bis ${pz(2)}). In die vier Ecken kommen Seelaternen.`);
  for (let x = -8; x <= 8; x++) for (let z = -3; z <= 2; z++) b.set(x, -1, z, BRICK);
  for (const [x, z] of TOWER_CORNERS) b.set(x, -1, z, 'sea_lantern');

  b.step('Boden', `Leg darauf eine volle Schicht Prismarinziegel (Ebene ${level(0)}, gleiche Fläche). Den äußeren Rand legst du aus dunklem Prismarin, in die Seetangreihe (z = ${pz(0)}, ${KELP_SPAN}) kommt statt Ziegeln Sand.`);
  for (let x = -8; x <= 8; x++) {
    for (let z = -3; z <= 2; z++) {
      const rim = Math.abs(x) === 8 || z === -3 || z === 2;
      b.set(x, 0, z, z === 0 && KELP_X.includes(x) ? 'sand' : rim ? DARK : BRICK);
    }
  }
}

function lowerLevel(b) {
  b.phase('Untere Ebene: Beobachter und Leitung', `Auf Ebene ${level(1)} stehen die Beobachter, die auf den untersten Seetangblock schauen. Dahinter liegt die untere Redstone-Leitung, die im Westturm über einen Verstärker zur Treppe führt. Vorne sitzen Truhe und der letzte Trichter.`, {
    tips: [
      'Ein Beobachter schaut beim Setzen mit dem Gesicht in deine Blickrichtung, der rote Punkt (Ausgang) zeigt zu dir. Stell dich nördlich davon hin und schau nach Süden.',
      'Ein Verstärker schickt das Signal in deine Blickrichtung weiter. Schau beim Setzen nach Westen.',
    ],
  });
  b.step('Rückwand und Türme', `Mauere die Rückwand aus dunklem Prismarin (z = ${pz(-3)}, ${KELP_SPAN}) und die beiden Türme (x = ${px(-8)} bis ${px(-6)} und ${px(6)} bis ${px(8)}, z = ${pz(-3)} bis ${pz(2)}) eine Ebene hoch, Ecken aus dunklem Prismarin. Im Westturm bleiben zwei Felder frei: x = ${px(REPEATER[0])} und ${px(STAIR_DUST[0][0])} bei z = ${pz(-2)} (für Verstärker und Staub).`);
  for (let x = -5; x <= 5; x++) b.set(x, 1, -3, DARK);
  towerLayer(b, 1);

  b.step('Beobachter', `Setz elf Beobachter in die Reihe z = ${pz(-1)} (${KELP_SPAN}), Gesicht nach Süden zur Seetangreihe.`);
  for (const x of KELP_X) b.set(x, 1, -1, 'observer[facing=south]');
  b.note(-5, 1, -1, 'Beobachter: schaut auf den untersten Seetangblock');

  b.step('Untere Leitung und Verstärker', `Streu Redstone-Staub hinter alle Beobachter (z = ${pz(-2)}, ${KELP_SPAN}). Im Westturm folgt bei x = ${px(REPEATER[0])} ein Verstärker auf 1 Tick (Signal nach Westen) und bei x = ${px(STAIR_DUST[0][0])} noch ein Stück Staub.`);
  for (const x of KELP_X) b.set(x, 1, -2, 'redstone_wire');
  b.set(...REPEATER, 'repeater[delay=1,facing=east]');
  b.set(...STAIR_DUST[0], 'redstone_wire');
  b.note(...REPEATER, 'Verstärker: frischt das Signal auf, bevor es nach oben geht');

  b.step('Vorderreihe, Trichter und Truhe', `Mauere die Reihe vor dem Seetang (z = ${pz(1)}, ${KELP_SPAN}) mit Prismarinziegeln, nur in die Mitte (x = ${px(0)}) kommt ein Trichter mit der Spitze nach Süden. Davor, in die Südwand (z = ${pz(2)}), setzt du die Doppeltruhe (x = ${px(0)} und ${px(1)}, Öffnung nach Süden) und links und rechts dunkles Prismarin als Sockel.`);
  for (const x of KELP_X) b.set(x, 1, 1, x === 0 ? 'hopper[facing=south]' : BRICK);
  for (const x of KELP_X) if (x !== 0 && x !== 1) b.set(x, 1, 2, DARK);
  b.set(0, 1, 2, 'chest[facing=south]');
  b.set(1, 1, 2, 'chest[facing=south]');
  b.note(1, 1, 2, 'Hier landet der Seetang');
}

function middleLevel(b) {
  b.phase('Mittlere Ebene: Kolben und Trichterreihe', `Auf Ebene ${level(2)} kommen die Kolben auf Höhe des zweiten Seetangblocks, dahinter die Träger der oberen Leitung, im Westturm die erste Treppenstufe – und vor dem Seetang die Trichterreihe.`, {
    tips: [
      'Ein Kolben zeigt beim Setzen mit dem Kopf zu dir: Stell dich auf die Seetangreihe und schau nach Norden.',
      'Trichter setzt du schleichend an die Seite des Trichters, in den sie schieben sollen. Das Röhrchen zeigt dann zu ihm.',
    ],
  });
  b.step('Kolben und Träger', `Setz elf normale Kolben über die Beobachter (z = ${pz(-1)}, ${KELP_SPAN}), Kopf nach Süden. Dahinter (z = ${pz(-2)}) und als Rückwand (z = ${pz(-3)}) kommen Prismarinziegel.`);
  for (const x of KELP_X) {
    b.set(x, 2, -1, 'piston[facing=south]');
    b.set(x, 2, -2, BRICK);
    b.set(x, 2, -3, BRICK);
  }
  b.note(5, 2, -1, 'Kolben auf Höhe des zweiten Seetangblocks');

  b.step('Türme und Treppenstufe', `Mauere die Türme eine Ebene höher, in die Mitte jeder Turmfront und -rückseite (x = ${px(-7)} und ${px(7)}) kommt eine Seelaterne. Im Westturm kommt auf x = ${px(STAIR_DUST[1][0])}, z = ${pz(STAIR_DUST[1][2])} ein Stück Redstone-Staub (es verbindet sich schräg nach unten mit dem Staub bei z = ${pz(STAIR_DUST[0][2])}), und direkt über dem unteren Staub (x = ${px(STAIR_GLASS[0])}, z = ${pz(STAIR_GLASS[2])}) sitzt ein Glasblock statt eines Ziegels: Glas leitet kein Signal, darum darf der Staub darunter hindurch nach oben steigen.`);
  towerLayer(b, 2);
  b.set(...STAIR_DUST[1], 'redstone_wire');
  b.set(...STAIR_GLASS, GLASS);
  b.note(...STAIR_DUST[1], 'Redstone-Treppe: unten → Mitte → oben');

  b.step('Trichterreihe', `Lege vor den Seetang (z = ${pz(1)}) elf Trichter: Die westlichen fünf zeigen nach Osten, die östlichen fünf nach Westen, der mittlere (x = ${px(0)}) zeigt nach unten in den Trichter vor der Truhe. Davor (z = ${pz(2)}) mauerst du Ziegel, bei x = ${FRONT_LIGHTS.map(px).join(' und ')} je eine Seelaterne – nur über der Truhe (x = ${px(0)} und ${px(1)}) bleibt Luft, sonst geht sie nicht auf.`);
  for (const x of KELP_X) {
    const facing = x < 0 ? 'east' : x > 0 ? 'west' : 'down';
    b.set(x, 2, 1, `hopper[facing=${facing}]`);
    if (x !== 0 && x !== 1) b.set(x, 2, 2, FRONT_LIGHTS.includes(x) ? 'sea_lantern' : BRICK);
  }
  b.note(0, 2, 1, 'Mittlerer Trichter: schiebt nach unten zur Truhe');
}

function upperLevel(b) {
  b.phase('Obere Ebene: Leitung und Rinne', `Auf Ebene ${level(3)} liegt die obere Redstone-Leitung, die die Kolben schaltet. Vorne entsteht die Rinne über den Trichtern, mit Glas nach Süden.`, {
    tips: ['Ganz außen hat das Signal noch die Stärke 1. Das reicht, aber verlängere die Leitung nicht.'],
  });
  b.step('Wand über den Kolben', `Mauere über die Kolben eine Reihe Prismarinziegel (z = ${pz(-1)}, ${KELP_SPAN}) und die Rückwand (z = ${pz(-3)}).`);
  for (const x of KELP_X) {
    b.set(x, 3, -1, BRICK);
    b.set(x, 3, -3, BRICK);
  }
  b.step('Türme und obere Leitung', `Mauere die Türme eine Ebene höher – im Westturm bleibt das Feld über dem schrägen Staub (x = ${px(STAIR_AIR[0])}, z = ${pz(STAIR_AIR[2])}) frei, sonst kann der Staub nicht hinaufsteigen. Streu dann Redstone-Staub von x = ${px(STAIR_DUST[2][0])} (auf das Glas) bis x = ${px(KELP_TO)} auf die Träger hinter den Kolben (z = ${pz(-2)}). Der Staub versorgt die Ziegel darunter, und die schalten die Kolben davor.`);
  towerLayer(b, 3);
  b.set(...STAIR_DUST[2], 'redstone_wire');
  for (let x = -6; x <= KELP_TO; x++) b.set(x, 3, -2, 'redstone_wire');
  b.note(0, 3, -2, 'Obere Leitung: schaltet alle elf Kolben');

  b.step('Glaswand der Rinne', `Setz Glas als Südwand der Rinne auf die Ziegel (z = ${pz(2)}, ${KELP_SPAN}).`);
  for (const x of KELP_X) b.set(x, 3, 2, GLASS);
}

function water(b) {
  b.phase('Wasser und Seetang', 'Jetzt kommt das Wasser – Schicht für Schicht von unten nach oben, dazwischen pflanzt du den Seetang.', {
    tips: [
      `Gieß in jede Reihe abwechselnd Eimer (x = ${[-5, -3, -1, 1, 3, 5].map(px).join(', ')}): Die Felder dazwischen werden von selbst zu Quellen, weil sie zwei Quellen neben sich haben.`,
      'Seetang setzt du in eine Wasserquelle direkt auf den Sand. Er wächst nur in Quellen oder herabfallendes Wasser hinein.',
    ],
  });
  b.step('Seetang pflanzen', `Füll die Seetangreihe auf Ebene ${level(1)} mit Wasserquellen (z = ${pz(0)}, ${KELP_SPAN}) und setz in jede Quelle einen Seetang auf den Sand. Am besten stehst du dabei auf den Trichtern davor.`);
  for (const x of KELP_X) b.set(x, 1, 0, 'kelp[age=0]');
  b.note(-3, 1, 0, 'Der unterste Seetangblock bleibt immer stehen');

  b.step('Erntehöhe und Vorrat', `Füll die Reihe darüber (Ebene ${level(2)}) und die Reihe darüber (Ebene ${level(3)}) ebenfalls mit Quellen. Aus der obersten Reihe fließt das Wasser von selbst ein Feld weit in die Rinne über den Trichtern – dort ist es flach und strömt nach Süden.`);
  for (const x of KELP_X) {
    b.set(x, 2, 0, 'water[level=0]');
    b.set(x, 3, 0, 'water[level=0]');
    b.set(x, 3, 1, 'water[level=1]');
  }
  b.note(-5, 3, 1, 'Rinne: die Strömung drückt die Stücke über die Trichter');
}

function cover(b) {
  b.phase('Glasdecke und Turmspitzen', 'Eine Glasdecke hält die aufsteigenden Stücke im Wasser. Die Türme bekommen einen Abschluss mit Laternen.', {
    tips: ['Ohne Decke schwimmen die Stücke oben auf und bleiben liegen, statt in die Rinne zu treiben.'],
  });
  b.step('Glasdecke', `Leg eine Glasdecke auf Ebene ${level(4)} über Seetang und Rinne (z = ${pz(0)} und ${pz(1)}, ${KELP_SPAN}). Auf die Mauern davor und dahinter (z = ${pz(-3)} bis ${pz(-1)} und z = ${pz(2)}) kommen Stufen aus dunklem Prismarin.`);
  for (const x of KELP_X) {
    b.set(x, 4, 0, GLASS);
    b.set(x, 4, 1, GLASS);
    for (const z of [-3, -2, -1, 2]) b.set(x, 4, z, 'dark_prismarine_slab[type=bottom]');
  }
  b.step('Turmspitzen', `Mauere die Türme eine letzte Ebene hoch (Ebene ${level(4)}). Leg oben auf den Rand jedes Turms Prismarinziegelstufen (Ebene ${level(5)}) und setz auf jede äußere Turmecke eine Laterne.`);
  towerLayer(b, 4);
  for (const x of [...WEST, ...EAST]) {
    for (let z = -3; z <= 2; z++) {
      const edge = Math.abs(x) !== 7 || z === -3 || z === 2;
      if (edge) b.set(x, 5, z, 'prismarine_brick_slab[type=bottom]');
    }
  }
  for (const [x, z] of TOWER_CORNERS) b.set(x, 5, z, 'lantern[hanging=false]');
}

function surroundings(b) {
  b.phase('Umgebung', 'Ein kleiner Teich mit Seerosen, ein Weg zur Truhe und ein paar Büsche runden den Platz ab.');
  pond(b, { x: -15, y: -1, z: 4, width: 7, depth: 5, facing: 'east', shore: 'sand', seed: 3 });
  path(b, { x: 0, y: -1, z: 3, facing: 'south', length: 6, width: 3, mix: 'erde', wiggle: 0.5, seed: 7 });
  bush(b, { x: 11, y: 0, z: 6, size: 'klein', leaves: 'birke', seed: 4 });
  bush(b, { x: 11, y: 0, z: -6, size: 'klein', leaves: 'eiche', seed: 9 });
  vegetation(b, { x: -16, y: -1, z: -8, width: 31, depth: 19, mix: 'wiese', density: 0.3, seed: 16 });
}

export default function build(b) {
  ground(b);
  foundation(b);
  lowerLevel(b);
  middleLevel(b);
  upperLevel(b);
  water(b);
  cover(b);
  surroundings(b);
}
