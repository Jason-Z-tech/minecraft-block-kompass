// Strandhaus auf Stelzen: helles Birkenholzhaus über Sand und Lagune, Veranda zum Meer, Steg mit Leiter, Palmen.
// Bau-Rahmen: Meer im Süden (+z), Land im Norden. Sandoberkante y = 0, Wasserspiegel y = 0, Hausboden y = 4.

import { formatState } from '../../core/blockstate.js';
import { hashPosition } from '../../core/random.js';
import { WOOD, window, doorway, straightStairs, lightRoom, bedroom, kitchen } from '../lib/index.js';

export const meta = {
  id: 'strandhaus-stelzen',
  title: 'Strandhaus auf Stelzen',
  category: 'haeuser',
  subtitle: 'Helles Holzhaus über Sand und Lagune, mit Veranda, Steg und Palmen',
  tags: ['Haus', 'Strand', 'Meer', 'Stelzenhaus', 'Holzhaus', 'Birke', 'Veranda', 'Steg', 'Palmen', 'Sommer', 'Einsteiger'],
  aliases: [
    'strandhaus', 'stelzenhaus', 'strand haus', 'haus auf stelzen', 'pfahlhaus', 'beach house', 'stilt house', 'beachhouse',
    'beach hut', 'strandhütte', 'strandhuette', 'ferienhaus', 'haus am meer', 'haus am strand', 'lagunenhaus', 'strandhaus stelzen',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Ein kleines Ferienhaus aus Birkenholz steht auf Stelzen am Ufer einer flachen Lagune, die vorderen Verandastelzen stehen schon im Wasser. Das türkise Kupferdach zieht sich über die Veranda, von dort führt eine Treppe auf den Steg mit Leiter ins Wasser. Innen gibt es ein Schlafzimmer und eine offene Wohnküche unter dem offenen Dachstuhl; am Strand stehen Palmen, Liegestühle und ein Sonnenschirm.',
  facts: [
    'Haus 11 × 9 Blöcke, Boden 4 Blöcke über dem Sand',
    'Dach aus gewachstem oxidiertem Kupfer: es bleibt türkis und läuft nicht weiter an',
    'Die Lagune ist ringsum von einer Sandbank eingefasst, damit kein Wasser ausläuft',
    'Palmen aus Tropenholz mit Kakaobohnen am Stamm',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const birch = WOOD.birke;
const pale = WOOD.blasseiche;
const jungle = WOOD.dschungel;
const ROOF = { stairs: 'waxed_oxidized_cut_copper_stairs', slab: 'waxed_oxidized_cut_copper_slab', full: 'waxed_oxidized_cut_copper' };
const SHUTTER = 'warped_trapdoor';

const PLOT = { x1: 0, z1: 0, x2: 33, z2: 39 };
const HOUSE = { x1: 11, z1: 8, x2: 21, z2: 16 };
const FLOOR = 4;
const WALL_TOP = 8;
const VERANDA = { x1: 10, z1: 17, x2: 22, z2: 20 };
const PIER = { x1: 15, x2: 17, z1: 21, z2: 33 };
const PORCH = { x1: 15, z1: 5, x2: 19, z2: 7 };

const log = (id, axis) => formatState(id, { axis });
const stair = (id, facing, half = 'bottom') => formatState(id, { facing, half });

// Uferlinie: ab hier (z) beginnt das Wasser; leicht geschwungen.
const shore = (x) => 19 + Math.round(1.3 * Math.sin((x + 2) / 4.2));
// Lagune: nach Süden rund auslaufend, mit leicht welligem Rand; tiefer Teil innen.
const lagoon = (x, z, rx, rz) => ((x - 16.5) / rx) ** 2 + (Math.max(0, z - 21) / rz) ** 2 <= 1 + 0.08 * Math.sin(x * 1.3 + z * 0.7);
const inWater = (x, z) => x > PLOT.x1 && x < PLOT.x2 && z < PLOT.z2 && z >= shore(x) && lagoon(x, z, 17.5, 17.5);
const deepWater = (x, z) => x > PLOT.x1 + 1 && x < PLOT.x2 - 1 && z < PLOT.z2 - 1 && z >= shore(x) + 3 && lagoon(x, z, 15, 15.5);
const dune = (x, z) => z <= 2 + Math.round(1.2 + Math.sin(x / 3.1) + 0.6 * Math.sin(x / 1.7)) && !(x >= 15 && x <= 19);

function ground(b) {
  b.phase('Strand und Lagune', 'Leg die Sandfläche aus: unten Sandstein, darauf Sand. Wo später Wasser steht, bleibt der Boden ein bis zwei Blöcke tiefer. Rundherum bleibt eine Sandbank stehen, die das Wasser einfasst.', {
    tips: ['Baust du an einem echten Strand, lässt du dieses Kapitel weg und suchst dir eine Stelle, an der das Meer flach ausläuft.'],
  });
  b.fill(PLOT.x1, -3, PLOT.z1, PLOT.x2, -3, PLOT.z2, 'sandstone');
  for (let z = PLOT.z1; z <= PLOT.z2; z++) {
    for (let x = PLOT.x1; x <= PLOT.x2; x++) {
      if (deepWater(x, z)) {
        b.set(x, -2, z, 'sand');
      } else if (inWater(x, z)) {
        b.set(x, -2, z, 'sandstone');
        b.set(x, -1, z, 'sand');
      } else {
        b.set(x, -2, z, 'sandstone');
        b.set(x, -1, z, 'sand');
        b.set(x, 0, z, 'sand');
        if (dune(x, z)) b.set(x, 1, z, 'sand');
      }
    }
  }
}

function water(b) {
  b.phase('Wasser einfüllen', 'Fülle die Lagune mit Wassereimern: nur Quellblöcke, Ebene für Ebene von unten. Da die Sandbank ringsum stehen bleibt, fließt nichts aus.', {
    tips: ['Setz Wasser zuerst in die Ecken und dann in die Mitte – so füllt sich die Fläche mit wenigen Eimern.'],
  });
  b.step('Untere Wasserebene', 'Zuerst die tiefe Mitte der Lagune: eine Ebene Wasserquellen auf dem Sandgrund.');
  forPlot((x, z) => { if (deepWater(x, z)) b.set(x, -1, z, 'water'); });
  b.step('Obere Wasserebene', 'Dann die ganze Lagune bis zur Sandkante auffüllen.');
  forPlot((x, z) => { if (inWater(x, z)) b.set(x, 0, z, 'water'); });
  b.step('Seegras und Meeresgurken', 'Setz Seegras und ein paar Meeresgurken in die tiefe Mitte auf den Grund – beides geht nur unter Wasser.');
  forPlot((x, z) => {
    const h = hashPosition(x, 0, z, 77) % 100;
    if (!deepWater(x, z)) return;
    if (h < 12) b.set(x, -1, z, 'seagrass');
    else if (h < 15) b.set(x, -1, z, formatState('sea_pickle', { pickles: String(1 + (h % 3)), waterlogged: 'true' }));
  });
}

function forPlot(fn) {
  for (let z = PLOT.z1; z <= PLOT.z2; z++) for (let x = PLOT.x1; x <= PLOT.x2; x++) fn(x, z);
}

// Stelze von der Bodenhöhe (Sand oder Lagunengrund) bis top.
function stilt(b, x, z, top) {
  let y = top;
  while (y > -3 && (b.get(x, y, z) === 'air' || b.get(x, y, z).startsWith('water'))) y--;
  b.fill(x, y + 1, z, x, top, z, log(birch.strippedLog, 'y'));
}

function frame(b) {
  b.phase('Stelzen und Balken', 'Stell die Stelzen aus geschälten Birkenstämmen bis auf den Lagunengrund und leg die Balken quer darüber. Unter dem Haus stehen 3 × 3 Stelzen, unter der Veranda und dem Steg weitere.', {
    tips: ['Im Wasser kannst du Stämme einfach von oben in die Wasserblöcke setzen. Fang mit den vier Hausecken an und spanne dazwischen eine Schnur aus Blöcken, dann stehen alle Stelzen in einer Flucht.'],
  });
  const beamY = FLOOR - 1;
  for (const x of [HOUSE.x1, 16, HOUSE.x2]) for (const z of [HOUSE.z1, 12, HOUSE.z2]) stilt(b, x, z, beamY);
  for (const x of [VERANDA.x1, 14, 18, VERANDA.x2]) stilt(b, x, VERANDA.z2, beamY);
  for (const x of [PORCH.x1, PORCH.x2]) stilt(b, x, PORCH.z1, beamY);
  for (const z of [HOUSE.z1, 12, HOUSE.z2]) b.fill(HOUSE.x1, beamY, z, HOUSE.x2, beamY, z, log(birch.strippedLog, 'x'));
  b.fill(VERANDA.x1, beamY, VERANDA.z2, VERANDA.x2, beamY, VERANDA.z2, log(birch.strippedLog, 'x'));
  for (const x of [VERANDA.x1, 14, 18, VERANDA.x2]) b.fill(x, beamY, HOUSE.z2 + 1, x, beamY, VERANDA.z2 - 1, log(birch.strippedLog, 'z'));
  b.fill(PORCH.x1, beamY, PORCH.z1, PORCH.x2, beamY, PORCH.z1, log(birch.strippedLog, 'x'));
  for (const x of [PORCH.x1, PORCH.x2]) b.fill(x, beamY, PORCH.z1 + 1, x, beamY, PORCH.z2, log(birch.strippedLog, 'z'));
  b.note(16, beamY, 12, 'Mittlere Stelze unter dem Haus – sie trägt den Längsbalken in der Mitte.');
}

function floors(b) {
  b.phase('Böden', 'Leg den Hausboden aus Birkenbrettern auf die Balken. Veranda und Vorplatz bekommen Dielen aus geschälten Birkenstämmen, die in Laufrichtung liegen.');
  b.fill(HOUSE.x1, FLOOR, HOUSE.z1, HOUSE.x2, FLOOR, HOUSE.z2, birch.planks);
  b.fill(VERANDA.x1, FLOOR, VERANDA.z1, VERANDA.x2, FLOOR, VERANDA.z2, log(birch.strippedLog, 'x'));
  b.fill(PORCH.x1, FLOOR, PORCH.z1, PORCH.x2, FLOOR, PORCH.z2, log(birch.strippedLog, 'z'));
}

// Innenluft unter dem Satteldach (First entlang x): höchste freie Ebene je z.
const roofRow = (z) => WALL_TOP + 1 + Math.min(z - HOUSE.z1, HOUSE.z2 - z);

function walls(b) {
  b.phase('Wände', 'Mauere die Wände 4 Blöcke hoch aus Blasseichenbrettern – sie wirken wie weiß gestrichenes Holz. In die Ecken kommen Birkenstämme mit Rinde, ihr schwarz-weißes Muster rahmt das Haus. Die Trennwand zwischen Schlafzimmer und Wohnküche reicht bis unters Dach.', {
    tips: ['Setz zuerst die vier Eckstämme, dann siehst du sofort, ob das Haus gerade steht.'],
  });
  b.walls(HOUSE.x1, FLOOR + 1, HOUSE.z1, HOUSE.x2, WALL_TOP, HOUSE.z2, pale.planks);
  for (const [x, z] of [[HOUSE.x1, HOUSE.z1], [HOUSE.x2, HOUSE.z1], [HOUSE.x1, HOUSE.z2], [HOUSE.x2, HOUSE.z2]]) b.fill(x, FLOOR + 1, z, x, WALL_TOP, z, log(birch.log, 'y'));
  for (let z = HOUSE.z1 + 1; z < HOUSE.z2; z++) b.fill(15, FLOOR + 1, z, 15, roofRow(z) - 1, z, pale.planks);
}

function roof(b) {
  b.phase('Dach', 'Das Satteldach aus gewachsten oxidierten Kupfertreppen steht einen Block über. Die Treppen schauen mit der hohen Seite zum First, der First ist eine Reihe Kupferstufen. Die beiden Giebeldreiecke füllst du mit Blasseichenbrettern. Über der Veranda geht das Dach als flache Ebene aus Kupferstufen weiter.', {
    tips: ['Kupfer immer gewachst verbauen (mit Honigwabe bearbeiten), sonst färbt es sich mit der Zeit weiter.', 'Setz die Treppen von außen nach innen: erst die unterste Reihe ringsum, dann jede Reihe eine Ebene höher.'],
  });
  b.roof({ x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z2, y: WALL_TOP, type: 'gable', axis: 'x', stairs: ROOF.stairs, slab: ROOF.slab, full: pale.planks, overhang: 1 });
  b.fill(HOUSE.x1 - 1, WALL_TOP, HOUSE.z2 + 2, HOUSE.x2 + 1, WALL_TOP, VERANDA.z2 + 1, formatState(ROOF.slab, { type: 'bottom' }));
  for (const x of [VERANDA.x1, 14, 18, VERANDA.x2]) b.fill(x, FLOOR + 1, VERANDA.z2, x, WALL_TOP - 1, VERANDA.z2, log(birch.strippedLog, 'y'));
  b.note(16, WALL_TOP + 5, 12, 'Der First besteht aus Kupferstufen (untere Hälfte).');
}

function openings(b) {
  b.phase('Fenster und Türen', 'Setz die Fenster aus Glasscheiben und daneben die Fensterläden: offene Wirrholz-Falltüren flach an der Wand – ihr Türkis passt zum Dach. Die Haustür kommt in die Nordwand zum Vorplatz, eine zweite Tür führt auf die Veranda. In die Giebel kommen runde Fenster.');
  const shutters = SHUTTER;
  window(b, { x: 13, y: FLOOR + 2, z: HOUSE.z1, facing: 'north', width: 1, height: 2, shutters });
  window(b, { x: 20, y: FLOOR + 2, z: HOUSE.z1, facing: 'north', width: 1, height: 2, shutters });
  doorway(b, { x: 17, y: FLOOR + 1, z: HOUSE.z1, facing: 'north', door: birch.door, frame: null });
  window(b, { x: 13, y: FLOOR + 2, z: HOUSE.z2, facing: 'south', width: 3, height: 2, shutters });
  window(b, { x: 16, y: FLOOR + 1, z: HOUSE.z2, facing: 'south', width: 2, height: 3 });
  doorway(b, { x: 18, y: FLOOR + 1, z: HOUSE.z2, facing: 'south', door: birch.door, frame: null });
  window(b, { x: 20, y: FLOOR + 1, z: HOUSE.z2, facing: 'south', width: 1, height: 3 });
  window(b, { x: HOUSE.x1, y: FLOOR + 2, z: 12, facing: 'west', width: 3, height: 2, shutters });
  window(b, { x: HOUSE.x2, y: FLOOR + 2, z: 14, facing: 'east', width: 2, height: 2, shutters });
  window(b, { x: HOUSE.x1, y: WALL_TOP + 1, z: 12, facing: 'west', style: 'round', width: 3, stairs: birch.stairs });
  window(b, { x: HOUSE.x2, y: WALL_TOP + 1, z: 12, facing: 'east', style: 'round', width: 3, stairs: birch.stairs });
  doorway(b, { x: 15, y: FLOOR + 1, z: 10, facing: 'east', door: birch.door, frame: null });
}

function verandaAndPier(b) {
  b.phase('Veranda, Treppen und Steg', 'Setz das Geländer aus Birkenzaun rund um Veranda und Vorplatz. Vom Vorplatz führt eine breite Treppe hinunter in den Sand, von der Veranda eine Treppe auf den Steg. Der Steg liegt einen Block über dem Wasser auf Pfosten; am Ende hängt eine Leiter ins Wasser.', {
    tips: ['Leitern im Wasser werden automatisch geflutet – du kannst also direkt vom Steg ins Wasser klettern.'],
  });
  b.step('Geländer', 'Zaun auf die Kante der Veranda und des Vorplatzes. Lass vorne in der Mitte drei Blöcke für die Stegtreppe frei.');
  const railY = FLOOR + 1;
  for (let x = VERANDA.x1; x <= VERANDA.x2; x++) if ((x < 15 || x > 17) && ![10, 14, 18, 22].includes(x)) b.set(x, railY, VERANDA.z2, birch.fence);
  for (let z = VERANDA.z1; z < VERANDA.z2; z++) { b.set(VERANDA.x1, railY, z, birch.fence); b.set(VERANDA.x2, railY, z, birch.fence); }
  for (const x of [PORCH.x1, PORCH.x2]) for (let z = PORCH.z1; z <= PORCH.z2; z++) b.set(x, railY, z, birch.fence);
  b.set(PORCH.x1, railY + 1, PORCH.z1, formatState('lantern', { hanging: 'false' }));
  b.set(PORCH.x2, railY + 1, PORCH.z1, formatState('lantern', { hanging: 'false' }));

  b.step('Treppe zum Strand', 'Die Treppe zum Vorplatz ist 3 breit und steigt nach Süden. Schau beim Setzen nach Süden, dann zeigt die hohe Seite der Stufen zum Haus. Darunter füllst du mit Birkenbrettern auf, seitlich kommen Wangen mit Zaunpfosten.');
  straightStairs(b, { x: 17, y: 1, z: PORCH.z1 - 4, facing: 'south', width: 3, height: 4, stairs: birch.stairs, support: birch.planks, railing: birch.fence });

  b.step('Steg', 'Schlag die Stegpfosten aus Birkenstamm in den Lagunengrund (je zwei, alle 3 Blöcke) und leg die Dielen aus Birkenstämmen quer darüber, einen Block über dem Wasser.');
  for (let z = PIER.z1; z <= PIER.z2; z += 3) for (const x of [PIER.x1 - 1, PIER.x2 + 1]) stilt(b, x, z, 2);
  for (let z = PIER.z1; z <= PIER.z2; z++) {
    for (let x = PIER.x1; x <= PIER.x2; x++) b.set(x, 1, z, log(birch.strippedLog, 'x'));
    if ((z - PIER.z1) % 3 === 0) { b.set(PIER.x1 - 1, 1, z, log(birch.strippedLog, 'y')); b.set(PIER.x2 + 1, 1, z, log(birch.strippedLog, 'y')); }
  }
  stilt(b, 16, PIER.z2, 0);

  b.step('Treppe zum Steg', 'Von der Veranda gehen drei Stufen hinunter auf den Steg. Schau beim Setzen nach Norden (zum Haus), dann liegt die hohe Seite oben an der Veranda.');
  straightStairs(b, { x: 16, y: 2, z: PIER.z1 + 2, facing: 'north', width: 3, height: 3, stairs: birch.stairs, support: birch.planks });
  b.set(PIER.x1 - 1, 2, PIER.z1, birch.fence);
  b.set(PIER.x2 + 1, 2, PIER.z1, birch.fence);
  for (const z of [PIER.z1 + 6, PIER.z2]) for (const x of [PIER.x1 - 1, PIER.x2 + 1]) b.set(x, 2, z, birch.fence);
  for (const x of [PIER.x1 - 1, PIER.x2 + 1]) b.set(x, 3, PIER.z2, formatState('lantern', { hanging: 'false' }));

  b.step('Leiter ins Wasser', 'Häng die Leiter an den Endpfosten des Stegs: drei Sprossen, zwei davon im Wasser.');
  for (let y = -1; y <= 1; y++) b.set(16, y, PIER.z2 + 1, formatState('ladder', { facing: 'south', waterlogged: String(y <= 0) }));
  b.note(16, 1, PIER.z2 + 1, 'Leiter am Stegende – von hier kannst du ins Wasser steigen.');
}

function furnish(b) {
  b.phase('Einrichtung', 'Richte die beiden Räume ein. Das Dach ist innen offen, deshalb hängen die Laternen an langen Ketten vom First.');
  b.step('Schlafzimmer', 'Das Bett steht mit dem Kopfteil an der Westwand, daneben Nachttische aus Fässern, am Fußende eine Truhe, ein Teppich und ein Bücherregal.');
  bedroom(b, { x: HOUSE.x1 + 1, y: FLOOR + 1, z: HOUSE.z2 - 1, facing: 'east', width: 7, depth: 3, wood: 'birke', color: 'hellblau', rug: 'weiss' });

  b.step('Wohnküche', 'Die Küchenzeile steht an der Ostwand. Davor ein kleiner Esstisch aus Birkenstufen mit Stühlen aus Birkentreppen, ein Sessel am Fenster und ein Teppich in Hellblau.');
  kitchen(b, { x: HOUSE.x2 - 1, y: FLOOR + 1, z: HOUSE.z1 + 1, facing: 'west', width: 5, wood: 'birke' });
  const y = FLOOR + 1;
  // Tisch bei x 17, damit vor der Schlafzimmertür (x 15) ein Gang frei bleibt.
  b.set(17, y, 11, formatState(birch.slab, { type: 'top' }));
  b.set(17, y, 12, formatState(birch.slab, { type: 'top' }));
  b.set(17, y, 10, stair(birch.stairs, 'north'));
  b.set(17, y, 13, stair(birch.stairs, 'south'));
  b.set(18, y, 11, stair(birch.stairs, 'east'));
  b.set(18, y, 12, stair(birch.stairs, 'east'));
  b.set(17, y + 1, 11, 'potted_cactus');
  b.set(17, y + 1, 12, formatState('white_candle', { candles: '2', lit: 'false' }));
  b.set(20, y, 15, stair(birch.stairs, 'south'));
  b.set(20, y, 14, formatState(SHUTTER, { facing: 'north', half: 'bottom', open: 'true' }));
  b.set(19, y, 15, formatState(SHUTTER, { facing: 'west', half: 'bottom', open: 'true' }));
  b.set(19, y, 14, 'light_blue_carpet');
  b.set(18, y, 14, 'light_blue_carpet');
  b.set(17, y, 14, 'white_carpet');
  b.set(16, y, 15, 'potted_bamboo');
  b.set(18, y + 3, HOUSE.z1 + 1, formatState(birch.shelf, { facing: 'south' }));

  b.step('Veranda', 'Auf die Veranda kommen zwei Liegestühle (Birkentreppe als Rückenlehne, zwei Teppiche als Liegefläche) und ein kleiner Tisch aus einer oberen Birkenstufe mit zwei Stühlen.');
  for (const z of [18, 19]) {
    b.set(11, y, z, stair(birch.stairs, 'west'));
    b.set(12, y, z, z === 18 ? 'light_blue_carpet' : 'white_carpet');
    b.set(13, y, z, z === 18 ? 'light_blue_carpet' : 'white_carpet');
  }
  b.set(20, y, 18, formatState(birch.slab, { type: 'top' }));
  b.set(20, y + 1, 18, 'potted_dead_bush');
  b.set(19, y, 18, stair(birch.stairs, 'west'));
  b.set(21, y, 18, stair(birch.stairs, 'east'));
}

function lights(b) {
  b.phase('Licht', 'Damit nachts keine Monster im Haus oder unter dem Haus erscheinen: Laternen an Ketten vom First, Laternen unter dem Verandadach und zwei Laternen unter den Bodenbalken.');
  b.step('Laternen im Haus', 'Häng in jedes Zimmer eine Laterne an einer Kette vom First: Kette oben am First anfangen und nach unten verlängern, dann die Laterne unten an die Kette.');
  const ridgeY = roofRow(12);
  for (const x of [13, 18]) {
    b.fill(x, FLOOR + 4, 12, x, ridgeY - 1, 12, formatState('iron_chain', { axis: 'y' }));
    b.set(x, FLOOR + 3, 12, formatState('lantern', { hanging: 'true' }));
  }
  b.step('Laternen außen', 'Zwei Laternen hängen unter dem Verandadach, zwei weitere unter dem mittleren Bodenbalken – sonst ist es unter dem Haus nachts stockdunkel.');
  for (const x of [12, 20]) b.set(x, WALL_TOP - 1, VERANDA.z1 + 1, formatState('lantern', { hanging: 'true' }));
  for (const x of [13, 19]) b.set(x, FLOOR - 2, 12, formatState('lantern', { hanging: 'true' }));
  lightRoom(b, { x1: HOUSE.x1 + 1, y1: FLOOR + 1, z1: HOUSE.z1 + 1, x2: 14, y2: FLOOR + 5, z2: HOUSE.z2 - 1 });
  lightRoom(b, { x1: 16, y1: FLOOR + 1, z1: HOUSE.z1 + 1, x2: HOUSE.x2 - 1, y2: FLOOR + 5, z2: HOUSE.z2 - 1 });
}

// Palme aus Tropenholz: Stamm neigt sich in lean-Richtung, Krone aus Wedeln, die nach außen hängen.
function palm(b, x, z, height, lean, seed) {
  const [lx, lz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[lean];
  let cx = x;
  let cz = z;
  let y = 1;
  while (b.get(cx, y, cz) !== 'air') y++;
  const base = y;
  for (let i = 0; i < height; i++) {
    b.set(cx, base + i, cz, log(jungle.log, 'y'));
    if (i >= 2 && i % 2 === 0 && i < height - 2) {
      cx += lx;
      cz += lz;
    }
  }
  const top = base + height;
  const leaf = formatState(jungle.leaves, { persistent: 'true' });
  b.set(cx, top, cz, leaf);
  b.set(cx, top - 1, cz, log(jungle.log, 'y'));
  // Wedel hängen nach außen; jede Zelle berührt die vorige mit einer Fläche (so lässt sich alles setzen).
  const longFrond = [[1, 0], [2, 0], [3, 0], [3, -1], [4, -1], [4, -2]];
  const shortFrond = [[1, 0], [2, 0], [2, -1], [3, -1], [3, -2]];
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz], i) => {
    const frond = hashPosition(x, i, z, seed) % 2 === 0 ? longFrond : shortFrond;
    for (const [k, dy] of frond) b.set(cx + dx * k, top + dy, cz + dz * k, leaf);
  });
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.set(cx + dx, top, cz + dz, leaf);
    b.set(cx + dx, top - 1, cz + dz, leaf);
  }
  const cocoaFacing = { north: 'south', south: 'north', east: 'west', west: 'east' };
  for (const [dx, dz, face] of [[1, 0, 'east'], [0, 1, 'south']]) {
    if (b.get(cx + dx, top - 2, cz + dz) === 'air') b.set(cx + dx, top - 2, cz + dz, formatState('cocoa', { facing: cocoaFacing[face], age: '2' }));
  }
}

function lounger(b, x, z, facing, color) {
  const back = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
  b.set(x, 1, z, stair(birch.stairs, facing));
  b.set(x - back[0], 1, z - back[1], `${color}_carpet`);
  b.set(x - back[0] * 2, 1, z - back[1] * 2, `${color}_carpet`);
}

function beach(b) {
  b.phase('Strand und Palmen', 'Zum Schluss der Strand: Palmen aus Tropenholz, Liegestühle aus Birkentreppen mit Teppich als Polster, ein Sonnenschirm aus Wolle auf einem Zaunpfahl, Strandhandtücher und Dünengras.', {
    tips: ['Eine Palme baust du so: Tropenholzstamm, ab dem dritten Block alle zwei Blöcke schräg um eins versetzt. Für den Versatz setzt du kurz einen Hilfsblock (z. B. Sand) neben den Stamm, klebst den nächsten Stamm daran und baust den Hilfsblock wieder ab. Oben kommt ein Kreuz aus Tropenlaub mit hängenden Wedeln hin; Laub, das du selbst setzt, verrottet nicht.', 'Kakaobohnen wachsen nur an Tropenholz.'],
  });
  b.step('Palmen');
  palm(b, 5, 13, 7, 'east', 1);
  palm(b, 28, 11, 8, 'west', 2);
  palm(b, 30, 18, 5, 'west', 3);
  palm(b, 7, 5, 5, 'south', 4);
  b.step('Liegestühle und Sonnenschirm', 'Zwei Liegestühle schauen nach Süden zur Lagune, dazwischen steht der Sonnenschirm: Birkenzaun 3 hoch, darauf ein 3 × 3-Dach aus weißer und hellblauer Wolle mit einem Block obendrauf. Westlich vom Haus liegen Strandhandtücher aus türkisem Teppich und eine kleine Sandburg aus Sandstein, Sandsteinmauern und einer Stufe.');
  lounger(b, 24, 13, 'north', 'light_blue');
  lounger(b, 26, 13, 'north', 'white');
  b.fill(25, 1, 14, 25, 3, 14, birch.fence);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) b.set(25 + dx, 4, 14 + dz, (dx + dz) % 2 === 0 ? 'white_wool' : 'light_blue_wool');
  b.set(25, 5, 14, 'white_wool');
  b.fill(6, 1, 16, 7, 1, 17, 'cyan_carpet');
  b.set(4, 1, 18, 'sandstone_wall');
  b.set(5, 1, 18, 'sandstone');
  b.set(5, 2, 18, 'sandstone_wall');
  b.set(6, 1, 18, 'sandstone_wall');
  b.set(5, 1, 19, formatState('sandstone_slab', { type: 'bottom' }));
  b.step('Dünengras', 'Streu Trockengras und ein paar tote Büsche über Sand und Dünen, rund ums Haus bleibt der Sand frei.');
  for (let z = PLOT.z1; z <= PLOT.z2; z++) {
    for (let x = PLOT.x1; x <= PLOT.x2; x++) {
      const h = hashPosition(x, 0, z, 77) % 100;
      const top = dune(x, z) ? 2 : 1;
      if (!inWater(x, z) && b.get(x, top, z) === 'air' && b.get(x, top - 1, z) === 'sand') {
        const nearHouse = x >= HOUSE.x1 - 2 && x <= HOUSE.x2 + 2 && z >= PORCH.z1 - 5 && z <= VERANDA.z2 + 1;
        if (!nearHouse && h < (dune(x, z) ? 30 : 5)) b.set(x, top, z, h % 3 === 0 ? 'tall_dry_grass' : h % 7 === 0 ? 'dead_bush' : 'short_dry_grass');
      }
    }
  }
}

export default function build(b) {
  ground(b);
  water(b);
  frame(b);
  floors(b);
  walls(b);
  roof(b);
  openings(b);
  verandaAndPier(b);
  furnish(b);
  lights(b);
  beach(b);
}
