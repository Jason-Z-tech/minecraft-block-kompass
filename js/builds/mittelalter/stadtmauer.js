// Stadtmauer mit Wehrgang: ein Modul aus Mauerturm (7 × 7) und Mauerstück (19 lang) plus ein Anschlussstück im Westen.
// Koordinaten: Mauer läuft entlang x; Stadtseite = Norden (−z), Feldseite = Süden (+z). Gelände-Oberkante y = 0.
// Mauerkörper z −2 … 1 (4 dick), Wehrgang-Boden y = 9. Turm x −3 … 3, z −2 … 4.

import {
  STONE, WOOD, COLOR, arch, arrowSlit, battlements, doorway, window, straightStairs, lampPost, hangingLantern, wallLantern, storage,
  workshop, lightRoom, terrain, floorPattern, pathAlong, bush, rock, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'stadtmauer',
  title: 'Stadtmauer mit Wehrgang',
  category: 'mittelalter',
  subtitle: 'Verlängerbarer Mauerabschnitt mit Turm, Treppe und Zinnen',
  tags: ['Mauer', 'Stadtmauer', 'Wehrgang', 'Zinnen', 'Mittelalter', 'Burg', 'Turm', 'Schießscharten', 'Modular', 'Steinziegel'],
  aliases: [
    'stadtmauer', 'stadt mauer', 'burgmauer', 'mauer', 'city wall', 'town wall', 'castle wall', 'wall', 'wehrgang',
    'wehrmauer', 'ringmauer', 'mauer mit turm', 'mauerturm', 'stadmauer', 'stadtmaurer', 'befestigung', 'fortification',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Ein Abschnitt einer mittelalterlichen Stadtmauer, den du beliebig verlängern kannst: Mauerturm mit drei '
    + 'Stockwerken und Zinnenkranz, 19 Blöcke Mauer mit Wehrgang, Zinnen und Stützpfeilern auf der Feldseite. Auf der '
    + 'Stadtseite gliedern Bogennischen mit Schießscharten die Mauer, eine breite Steintreppe führt zum Wehrgang hinauf. '
    + 'Die Anleitung zeigt, wie du Turm und Mauerstück immer wieder aneinandersetzt.',
  facts: [
    'Ein Modul = Turm (7 Blöcke) + Mauerstück (19 Blöcke) = 26 Blöcke; der nächste Turm beginnt direkt am Mauerende.',
    'Mauer 4 Blöcke dick, der Wehrgang liegt 10 Blöcke über der Gasse, die Zinnen ragen 2 Blöcke darüber.',
    'Der Wehrgang führt durch den Turm hindurch; eine Leiter verbindet die drei Stockwerke und das Turmdach.',
    'Stützpfeiler auf der Feldseite stehen an den Pfeilern der Bogennischen, damit die Kreuzscharten frei bleiben.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const stone = STONE.steinziegel;
const spruce = WOOD.fichte;

const TOWN = -2; // Stadtseite der Mauer
const FIELD = 1; // Feldseite der Mauer
const TOP = 9; // Wehrgang-Boden
const SECTIONS = [[-10, -4], [4, 22]]; // Anschlussstück West, Mauerstück Ost
const NICHES = [-7, 7, 19]; // Mitten der Bogennischen (Stadtseite)
const BUTTRESSES = [-10, 10, 16, 22]; // Stützpfeiler (Feldseite) an den Nischenpfeilern
const STAIR_X = 13; // Treppe zum Wehrgang (Mitte)
const TOWER = { x1: -3, x2: 3, z1: -2, z2: 4, top: 14 };
const TOWER_FLOORS = [5, 9]; // Zwischendecke und Wehrgang-Ebene im Turm
const LADDER = [-2, 3];
const BASE = -2; // unterste Geländeebene = „Ebene 1“ der Anleitung
const lvl = (y) => y - BASE + 1;

function wallStone(b, y) {
  if (y <= 3) return b.pickWeighted([[stone.block, 5], [stone.mossy, 3], [stone.rough, 2], ['mossy_cobblestone', 1]]);
  return b.pickWeighted([[stone.block, 9], [stone.mossy, 2], [stone.cracked, 2]]);
}

// Ersetzt in einem Bereich einen Teil der Steinziegel durch bemooste/rissige (Alterung).
function weather(b, x1, y1, z1, x2, y2, z2, share = 0.25) {
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        const state = b.get(x, y, z);
        if (state === stone.block && b.chance(share)) b.set(x, y, z, b.chance(0.6) ? stone.mossy : stone.cracked);
        else if (state.startsWith(`${stone.stairs}[`) && b.chance(share * 0.6)) b.set(x, y, z, state.replace(stone.stairs, stone.mossyStairs));
      }
    }
  }
}

function ground(b) {
  b.phase('Gelände und Fundament', 'Leg zuerst eine ebene Wiese an. Auf der Stadtseite (Norden) läuft eine gepflasterte '
    + 'Gasse parallel zur Mauer, dazwischen ein Kiesweg zur Turmtür. Dann gräbst du das Fundament ein: eine Reihe Bruchstein '
    + 'unter der ganzen Mauer (4 breit) und unter dem Turm.', {
    tips: ['Spann die Mauerflucht zuerst mit einer Reihe Blöcke auf der ganzen Länge – dann laufen Mauer, Pfeiler und Zinnen später sicher gerade.'],
  });
  terrain(b, { x: -16, y: -2, z: -16, width: 41, depth: 28, height: 2, surface: 'gras', seed: 'stadtmauer' });
  for (const [x1, x2] of SECTIONS) b.fill(x1, 0, TOWN, x2, 0, FIELD, stone.rough);
  b.fill(TOWER.x1, 0, TOWER.z1, TOWER.x2, 0, TOWER.z2, stone.rough);
  floorPattern(b, {
    x: -16, y: 0, z: -14, width: 41, depth: 3, pattern: 'random',
    blocks: [[stone.rough, 4], ['stone', 2], ['andesite', 2], [stone.mossy, 1], ['gravel', 1]],
  });
  pathAlong(b, { y: 0, points: [[0, -11], [0, -3]], width: 3, mix: 'kies', wiggle: 0, seed: 'stadtmauer' });
}

function wallBody(b) {
  b.phase('Mauer bis zum Wehrgang', `Zieh die Mauer 4 Blöcke dick bis Ebene ${lvl(TOP)} hoch – östlich vom Turm 19 Blöcke lang, `
    + 'westlich ein Anschlussstück von 7 Blöcken. Unten mischst du Bruchstein und bemoosten Stein unter die Steinziegel. '
    + `Die oberste Ebene (Ebene ${lvl(TOP)}) ist gleich der Boden des Wehrgangs.`
    + ' Die Bogennischen auf der Stadtseite kommen später.', {
    tips: [
      'Verlängern: Ein Modul ist Turm (7) + Mauerstück (19) = 26 Blöcke. Bau am Ostende direkt den nächsten Turm an '
        + '(Turmwand auf das Feld nach dem letzten Mauerblock), dann wieder 19 Blöcke Mauer – so oft du willst.',
      'Auch nach Westen geht es weiter: Das Anschlussstück ist das Ende eines Mauerstücks. Verlängere es auf 19 Blöcke und setz '
        + 'dort den nächsten Turm. Nischen, Pfeiler und Treppe wiederholen sich im selben Abstand.',
      'Für Ecken drehst du das Mauerstück um 90° und lässt es in einen Turm münden – Türme sind die natürlichen Eckpunkte.',
    ],
  });
  for (const [x1, x2] of SECTIONS) {
    for (let y = 1; y <= TOP; y++) for (let z = TOWN; z <= FIELD; z++) for (let x = x1; x <= x2; x++) b.set(x, y, z, wallStone(b, y));
  }
  b.note(SECTIONS[1][1], TOP, 0, 'Mauerende: hier setzt du den nächsten Turm an');
  b.note(SECTIONS[0][0], TOP, 0, 'Anschluss an das vorige Mauerstück');
}

function buttresses(b) {
  b.phase('Stützpfeiler und Sockel', 'Auf der Feldseite (Süden) stützen vier Pfeiler die Mauer: unten 2 Blöcke tief und 5 '
    + `hoch, dann 1 Block tief bis Ebene ${lvl(8)}, der Absatz`
    + ' mit einer Treppe abgedeckt (hohe Seite zur Mauer). Oben tragen die '
    + 'Pfeiler später die vorspringende Brüstung. Dazwischen läuft ein '
    + 'Sockel aus Bruchsteintreppen am Mauerfuß entlang.', {
    tips: ['Die Pfeiler stehen genau hinter den Pfeilern der Bogennischen – so bleiben die Schießscharten in der Mitte frei.'],
  });
  for (const x of BUTTRESSES) {
    for (let y = 1; y <= 5; y++) for (const z of [FIELD + 1, FIELD + 2]) b.set(x, y, z, wallStone(b, y));
    b.stairs(x, 6, FIELD + 2, stone.stairs, { facing: 'north' });
    for (let y = 6; y <= 8; y++) b.set(x, y, FIELD + 1, wallStone(b, y));
  }
  for (const [x1, x2] of SECTIONS) {
    for (let x = x1; x <= x2; x++) if (!BUTTRESSES.includes(x)) b.stairs(x, 1, FIELD + 1, 'cobblestone_stairs', { facing: 'north' });
  }
}

function tower(b) {
  const { x1, x2, z1, z2, top } = TOWER;
  b.phase('Mauerturm', 'Der Turm (7 × 7) steht 3 Blöcke vor der Feldseite der Mauer und schließt auf der Stadtseite bündig '
    + `ab. Mauere ihn bis Ebene ${lvl(TOWER.top)} hoch. Auf Ebene ${lvl(TOWER_FLOORS[0])} und Ebene ${lvl(TOWER_FLOORS[1])} legst `
    + `du Holzböden ein (Ebene ${lvl(TOWER_FLOORS[1])} liegt auf Wehrganghöhe), je mit einem Leiterloch in der Südwestecke. `
    + `Oben schließt eine Steindecke auf Ebene ${lvl(TOWER.top)} ab.`, {
    tips: ['Mauere den Turm gleich mit der Mauer hoch – dann verzahnen sich die Steine an den Anschlussstellen.'],
  });
  for (let y = 1; y <= top; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        const shell = x === x1 || x === x2 || z === z1 || z === z2;
        if (shell || y === top) b.set(x, y, z, y === top && !shell ? stone.block : wallStone(b, y));
      }
    }
    if (TOWER_FLOORS.includes(y)) {
      for (let x = x1 + 1; x < x2; x++) for (let z = z1 + 1; z < z2; z++) b.set(x, y, z, spruce.planks);
      b.remove(LADDER[0], y, LADDER[1]);
    }
  }
  for (let x = x1 + 1; x < x2; x++) for (let z = z1 + 1; z < z2; z++) b.set(x, 0, z, b.pickWeighted([[stone.block, 3], [stone.rough, 1], ['andesite', 1]]));
  // Sockel aus Bruchsteintreppen um den vorspringenden Teil (Feldseite).
  for (let x = x1 - 1; x <= x2 + 1; x++) b.stairs(x, 1, z2 + 1, 'cobblestone_stairs', { facing: 'north' });
  for (let z = FIELD + 2; z <= z2; z++) {
    b.stairs(x1 - 1, 1, z, 'cobblestone_stairs', { facing: 'east' });
    b.stairs(x2 + 1, 1, z, 'cobblestone_stairs', { facing: 'west' });
  }
}

function walkway(b) {
  b.phase('Wehrgang und Zinnen', 'Auf der Feldseite springt die Brüstung einen Block vor: Setz zuerst eine Reihe umgedrehter '
    + `Steinziegeltreppen als Konsolen auf Ebene ${lvl(TOP)} vor die Mauer (hohe Seite zur Mauer), darauf die Brüstung `
    + `(Ebene ${lvl(TOP + 1)}) mit `
    + 'Zinnen und Lücken im Wechsel, oben je eine Steinziegelstufe. '
    + 'Auf der Stadtseite sichert ein Fichtenzaun den Wehrgang; nur über der Treppe bleibt er offen. '
    + 'Auf jeden sechsten Zaunpfosten kommt eine Laterne. Der Turm bekommt einen vorspringenden Zinnenkranz auf Konsolen und '
    + 'einen Fahnenmast mit blauem Banner.', {
    tips: ['Zinnen zählst du am besten von der Turmseite aus: Zinne, Lücke, Zinne … – das Mauerende ist immer eine Zinne.'],
  });
  for (const [x1, x2] of SECTIONS) {
    battlements(b, { x: x1, y: TOP + 1, z: FIELD, facing: 'south', length: x2 - x1 + 1, block: stone.block, cap: stone.slab, corbels: stone.stairs });
    for (let x = x1; x <= x2; x++) {
      if (Math.abs(x - STAIR_X) <= 1) continue;
      b.set(x, TOP + 1, TOWN, spruce.fence);
      if ((x - x1) % 6 === 3) b.set(x, TOP + 2, TOWN, 'lantern[hanging=false]');
    }
    weather(b, x1, TOP, FIELD + 1, x2, TOP + 3, FIELD + 1, 0.3);
  }
  const { x1, x2, z1, z2, top } = TOWER;
  const sides = [
    { x: x1 - 1, z: z2, facing: 'south', length: x2 - x1 + 3 },
    { x: x2, z: z2 + 1, facing: 'east', length: z2 - z1 + 3 },
    { x: x2 + 1, z: z1, facing: 'north', length: x2 - x1 + 3 },
    { x: x1, z: z1 - 1, facing: 'west', length: z2 - z1 + 3 },
  ];
  for (const s of sides) battlements(b, { x: s.x, y: top + 1, z: s.z, facing: s.facing, length: s.length, block: stone.block, corbels: stone.stairs, cap: stone.slab });
  weather(b, x1 - 1, top, z1 - 1, x2 + 1, top + 3, z2 + 1, 0.3);
  b.fill(0, top + 1, 1, 0, top + 4, 1, spruce.fence);
  b.set(0, top + 5, 1, `${COLOR.blau.banner}[rotation=0]`);
  b.set(LADDER[0], top, LADDER[1], `${spruce.trapdoor}[facing=north,half=top,open=false]`);
}

function stairsUp(b) {
  b.phase('Treppe zum Wehrgang', 'Von der Gasse führt eine 3 Blöcke breite Steintreppe senkrecht auf die Mauer zu: 9 Stufen '
    + 'mit der hohen Seite nach Süden, darunter voll gemauert, links und rechts eine Wange mit Steinziegelmauer als Geländer. '
    + 'Die oberste Stufe liegt auf Höhe des Wehrgangs.', {
    tips: ['Setz zuerst die Wangen als Treppenlinie (je Block eine Ebene höher), dann füllst du die Stufen dazwischen.'],
  });
  straightStairs(b, { x: STAIR_X, y: 1, z: TOWN - 9, facing: 'south', width: 3, height: 9, stairs: stone.stairs, support: stone.block, railing: stone.wall });
  b.note(STAIR_X, TOP + 1, TOWN - 1, 'Hier betrittst du den Wehrgang');
}

function openings(b) {
  b.phase('Nischen, Türen und Schießscharten', 'Jetzt schlägst du die Öffnungen in die fertige Mauer: auf der Stadtseite drei '
    + 'Rundbogennischen (5 breit, 5 hoch, 2 tief), aus jeder führt eine Kreuzscharte durch die restliche Mauer zum Feld. Der '
    + `Turm bekommt eine Tür zur Stadt, Durchgänge für den Wehrgang auf Ebene ${lvl(TOP + 1)} und Schießscharten auf allen `
    + 'Feldseiten.');
  for (const x of NICHES) {
    arch(b, { x, y: 1, z: TOWN, facing: 'north', width: 5, height: 5, style: 'round', depth: 2, block: stone.block, stairs: stone.stairs });
    arrowSlit(b, { x, y: 2, z: FIELD, facing: 'south', height: 3, style: 'cross', depth: 2 });
    hangingLantern(b, { x, y: 5, z: TOWN + 1, chain: 1 });
  }
  const { x1, x2, z1, z2 } = TOWER;
  doorway(b, { x: 0, y: 1, z: z1, facing: 'north', door: spruce.door, frame: null });
  b.set(0, 3, z1, stone.chiseled);
  for (const x of [-1, 1]) wallLantern(b, { x, y: 2, z: z1, facing: 'north', style: 'bracket', arm: spruce.fence });
  arch(b, { x: x1, y: TOP + 1, z: -1, facing: 'west', width: 2, height: 3, block: stone.block, stairs: stone.stairs });
  arch(b, { x: x2, y: TOP + 1, z: 0, facing: 'east', width: 2, height: 3, block: stone.block, stairs: stone.stairs });
  arrowSlit(b, { x: 0, y: 2, z: z2, facing: 'south', height: 3 });
  arrowSlit(b, { x: 0, y: 6, z: z2, facing: 'south', height: 3, style: 'cross' });
  arrowSlit(b, { x: 0, y: TOP + 1, z: z2, facing: 'south', height: 3, style: 'cross' });
  for (const [x, facing] of [[x1, 'west'], [x2, 'east']]) {
    arrowSlit(b, { x, y: 2, z: 3, facing, height: 3 });
    arrowSlit(b, { x, y: 6, z: 3, facing, height: 2 });
    arrowSlit(b, { x, y: TOP + 1, z: 3, facing, height: 3 });
  }
  window(b, { x: 0, y: 6, z: z1, facing: 'north', width: 1, height: 2, glass: 'glass_pane', sill: stone.stairs });
  window(b, { x: 0, y: TOP + 1, z: z1, facing: 'north', width: 1, height: 2, glass: 'glass_pane', sill: stone.stairs });
  weather(b, -16, 1, TOWN - 1, 24, 8, TOWN + 1, 0.15);
}

function interior(b) {
  const { x1, x2, z1, z2 } = TOWER;
  b.phase('Turm einrichten', 'Jetzt richtest du die drei Stockwerke ein. Der Durchgang des Wehrgangs (die zwei Reihen an der '
    + 'Nordseite im obersten Stock) bleibt frei.', {
    tips: ['Schau beim Setzen der Leiter nach Süden auf die Wand – dann hängt sie richtig.'],
  });
  b.step('Leiter', 'Setz die Leiter in der Südwestecke an die Südwand, vom Boden durch beide Leiterlöcher bis unter die Falltür im Turmdach.');
  for (let y = 1; y < TOWER.top; y++) b.set(LADDER[0], y, LADDER[1], 'ladder[facing=north]');

  b.step('Erdgeschoss: Lager', 'Unten lagert die Wache Vorräte: Doppeltruhen und ein Fass an der Ostwand, Heuballen und ein Fass '
    + 'neben der Leiter. In der Mitte hängt eine Laterne an einer Kette.');
  storage(b, { x: x2 - 1, y: 1, z: z1 + 1, facing: 'west', width: 4, height: 2 });
  b.set(x1 + 2, 1, z2 - 1, 'hay_block[axis=y]');
  b.set(x1 + 2, 2, z2 - 1, 'hay_block[axis=x]');
  b.set(x1 + 3, 1, z2 - 1, 'barrel[facing=up]');
  hangingLantern(b, { x: 0, y: 4, z: 1, chain: 1 });
  lightRoom(b, { x1: x1 + 1, y1: 1, z1: z1 + 1, x2: x2 - 1, y2: 4, z2: z2 - 1 });

  b.step('Erster Stock: Waffenkammer', 'Im ersten Stock ist die Waffenkammer: Werkbank, Schmiedetisch und Amboss an der Ostwand, '
    + 'Schleifstein und Fass gegenüber, Truhe und Fass an der Südwand.');
  workshop(b, { x: x2 - 1, y: 6, z: z1 + 1, facing: 'west', width: 3, wood: 'fichte', shelves: false });
  b.set(x2 - 1, 6, z2 - 1, 'barrel[facing=up]');
  b.set(x2 - 2, 6, z2 - 1, 'chest[facing=north,type=single]');
  b.set(x1 + 1, 6, z1 + 1, 'grindstone[face=floor,facing=north]');
  b.set(x1 + 1, 6, z1 + 2, 'barrel[facing=east]');
  hangingLantern(b, { x: 0, y: 8, z: 1, chain: 0 });
  lightRoom(b, { x1: x1 + 1, y1: 6, z1: z1 + 1, x2: x2 - 1, y2: 8, z2: z2 - 1 });

  b.step('Zweiter Stock: Wachstube', 'Oben auf Wehrganghöhe sitzt die Wache: Tisch mit zwei Stühlen in der Südostecke, ein Fass mit '
    + 'Laterne, ein roter Läufer über den Durchgang.');
  b.set(x2 - 1, TOP + 1, z2 - 1, spruce.fence);
  b.set(x2 - 1, TOP + 2, z2 - 1, spruce.pressurePlate);
  b.stairs(x2 - 1, TOP + 1, z2 - 2, spruce.stairs, { facing: 'north' });
  b.stairs(x2 - 2, TOP + 1, z2 - 1, spruce.stairs, { facing: 'west' });
  b.set(0, TOP + 1, z2 - 1, 'barrel[facing=up]');
  b.set(0, TOP + 2, z2 - 1, 'lantern[hanging=false]');
  for (let x = x1 + 1; x < x2; x++) for (const z of [-1, 0]) b.set(x, TOP + 1, z, COLOR.rot.carpet);
  lightRoom(b, { x1: x1 + 1, y1: TOP + 1, z1: z1 + 1, x2: x2 - 1, y2: TOP + 4, z2: z2 - 1 });
}

function surroundings(b) {
  b.phase('Umgebung', 'Zum Schluss stellst du Laternenpfähle an die Gasse, setzt Fässer und Heu an den Turm und lässt auf '
    + 'der Feldseite Büsche, Felsen und hohes Gras wachsen.');
  for (const x of [-9, 5, 21]) lampPost(b, { x, y: 1, z: -11, facing: 'east', height: 3, style: 'double', post: stone.wall, base: stone.chiseled });
  b.set(-3, 1, -3, 'barrel[facing=up]');
  b.set(-2, 1, -3, 'barrel[facing=north]');
  b.set(3, 1, -3, 'hay_block[axis=y]');
  b.set(3, 2, -3, 'hay_block[axis=x]');
  b.set(4, 1, -3, 'hay_block[axis=z]');
  bush(b, { x: -13, y: 1, z: 7, size: 'mittel', leaves: 'eiche', seed: 1 });
  bush(b, { x: 8, y: 1, z: 6, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: 18, y: 1, z: -7, size: 'klein', leaves: 'birke', seed: 3 });
  rock(b, { x: 13, y: 1, z: 8, size: 'mittel', material: 'stein', seed: 4 });
  rock(b, { x: -5, y: 1, z: 9, size: 'klein', material: 'andesit', seed: 5 });
  vegetation(b, { x: -16, y: 3, z: 2, width: 41, depth: 10, mix: 'wiese', density: 0.35, shape: 'eckig', seed: 'feld' });
  vegetation(b, { x: -16, y: 3, z: -11, width: 41, depth: 8, mix: 'blumen', density: 0.15, shape: 'eckig', seed: 'stadt' });
}

export default function build(b) {
  ground(b);
  wallBody(b);
  buttresses(b);
  tower(b);
  walkway(b);
  stairsUp(b);
  openings(b);
  interior(b);
  surroundings(b);
}
