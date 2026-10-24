// Türklingel mit Notenblock: kleines Backsteinhäuschen (außen 11 × 7), dessen Klingelknopf neben der Haustür zwei
// Notenblöcke in der Stube spielen lässt – „Ding“ sofort, „Dong“ 0,4 Sekunden später über einen Verstärker in der Wand.
// Bau-Rahmen: Haus x 0 … 10, z 0 … 6, Haustür im Süden bei x = 5 (z = 6), Fußboden y = 0, Wiese y = −1.
//
// Signalweg (Südwand, von außen gesehen links → rechts):
//   Knopf (7, 1, 7) an Ziegel K (7, 1, 6) → K stark versorgt → Notenblock 1 (7, 1, 5) direkt dahinter spielt „Ding“.
//   K → Verstärker (8, 1, 6) in der Wand, Eingang Westen, 4 Ticks → Ziegel (9, 1, 6) stark versorgt → Notenblock 2 (9, 1, 5) „Dong“.
// Unter beiden Notenblöcken liegt ein Goldblock im Fußboden (Instrument Glocke). Der Verstärker steckt in der Wand, innen
// verdeckt ihn ein Bücherregal, außen der Briefkasten. Zwischen Tür und Klingelziegel bleibt ein Block, damit die Tür nicht aufgeht.

import { WOOD, window, doorway, chimney, kitchen, diningTable, floorPattern, findDarkSpots, terrain, path, flowerBed, tree, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'tuerklingel',
  title: 'Türklingel mit Notenblock',
  category: 'redstone',
  subtitle: 'Klingelknopf an der Haustür, Ding-Dong aus zwei Notenblöcken in der Stube',
  tags: ['Redstone', 'Türklingel', 'Klingel', 'Notenblock', 'Verstärker', 'Knopf', 'Haus', 'Häuschen', 'Anfänger', 'Musik', 'Eingang'],
  aliases: [
    'türklingel', 'tuerklingel', 'tür klingel', 'klingel', 'hausklingel', 'haus klingel', 'doorbell', 'door bell',
    'note block doorbell', 'notenblock klingel', 'notenblock', 'note block', 'ding dong', 'dingdong', 'türglocke',
    'turklingel', 'türklinel', 'tuerklingl', 'klingelknopf',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Ein kleines Backsteinhäuschen mit einer echten Türklingel: Drückst du draußen den Knopf neben der Haustür, klingt drinnen ein heller Glockenton und gleich danach ein tieferer – Ding-Dong. Der Knopf versorgt den Ziegel, an dem er sitzt, und der Notenblock direkt dahinter in der Stube spielt sofort. Ein Verstärker in der Wand gibt das Signal 0,4 Sekunden später an den zweiten Notenblock weiter. Goldblöcke im Boden machen aus beiden Notenblöcken Glocken; die Tonhöhe stellst du mit Rechtsklicks ein.',
  facts: [
    'Ein Notenblock spielt nur, wenn direkt über ihm Luft ist (oder ein Kopf).',
    'Der Block unter dem Notenblock wählt das Instrument: Goldblock = Glocke, Packeis = Glockenspiel, Lehm = Flöte, Holz = Kontrabass, Stein = Basstrommel.',
    'Jeder Rechtsklick hebt den Ton um einen Halbton, los geht es bei Fis. 10 Klicks = E („Ding“), 6 Klicks = C („Dong“) – zusammen der klassische Klingelton.',
    'Ein Notenblock spielt nur beim Einschalten. Darum klingt jeder Knopfdruck genau einmal, auch wenn der Holzknopf 1,5 Sekunden gedrückt bleibt.',
    'Der Verstärker auf 4 Ticks wartet 0,4 Sekunden, bevor er das Signal weitergibt – das ist die Pause zwischen Ding und Dong.',
    'Nicht im Spiel getestet: die Schaltung folgt den Beschreibungen von Notenblock, Knopf und Verstärker im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Note Block', url: 'https://minecraft.wiki/w/Note_Block' },
    { title: 'Minecraft Wiki: Button', url: 'https://minecraft.wiki/w/Button' },
    { title: 'Minecraft Wiki: Redstone Repeater', url: 'https://minecraft.wiki/w/Redstone_Repeater' },
  ],
  credits: null,
  tested: false,
};

const darkOak = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const HOUSE = { x1: 0, x2: 10, z1: 0, z2: 6 };
const WALL_TOP = 5;
const DOOR_X = 5;
const CHIMNEY_X = 2;
const BELL_BLOCK = { x: 7, y: 1, z: 6 };
const BUTTON = { x: 7, y: 1, z: 7 };
const DING = { x: 7, y: 1, z: 5 };
const REPEATER = { x: 8, y: 1, z: 6 };
const DONG_BLOCK = { x: 9, y: 1, z: 6 };
const DONG = { x: 9, y: 1, z: 5 };
const MAILBOX = { x: 8, y: 1, z: 7 };
const GROUND = { x: -13, z: -10, width: 29, depth: 25 };
const DING_NOTE = 10; // E
const DONG_NOTE = 6; // C

const noteBlock = (note) => `note_block[instrument=bell,note=${note},powered=false]`;

function site(b) {
  b.phase('Bauplatz und Fundament', 'Such dir eine ebene Wiese. Das Häuschen ist außen 11 × 7 Blöcke groß und steht auf einem Sockel aus Bruchstein, eine Ebene über dem Gras.', {
    tips: [
      'Setz zuerst die vier Ecken des Sockels und zähl dann ab: 11 Blöcke von West nach Ost, 7 von Nord nach Süd.',
      'Die beiden Goldblöcke im Fußboden gehören zur Klingel: Auf ihnen stehen später die Notenblöcke, und das Gold macht ihren Ton zur Glocke. Vom Raum aus sieht man sie nicht mehr.',
    ],
  });
  b.step('Wiese', 'Die Wiese rund um das Häuschen.');
  terrain(b, { x: GROUND.x, y: -2, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 1, seed: 'tuerklingel' });

  b.step('Sockel', 'Leg einen Ring aus Bruchstein (11 × 7) auf das Gras, ein paar bemooste Steine dazwischen. Darauf stehen die Wände.');
  for (let x = HOUSE.x1; x <= HOUSE.x2; x++) {
    for (let z = HOUSE.z1; z <= HOUSE.z2; z++) {
      if (x !== HOUSE.x1 && x !== HOUSE.x2 && z !== HOUSE.z1 && z !== HOUSE.z2) continue;
      b.set(x, 0, z, b.chance(0.25) ? 'mossy_cobblestone' : 'cobblestone');
    }
  }

  b.step('Fußboden mit Goldblöcken', 'Innen kommt ein Dielenboden (9 × 5) aus Fichtenbrettern mit einem Rand aus Schwarzeichenbrettern. In der vordersten Reihe ersetzt du zwei Bretter durch Goldblöcke: 2 und 4 Felder östlich der Tür (vom Raum aus rechts der Tür, mit einem Feld Abstand dazwischen).');
  floorPattern(b, { x: HOUSE.x1 + 1, y: 0, z: HOUSE.z1 + 1, width: 9, depth: 5, pattern: 'border', blocks: [spruce.planks, darkOak.planks] });
  b.set(DING.x, 0, DING.z, 'gold_block');
  b.set(DONG.x, 0, DONG.z, 'gold_block');
  b.note(DING.x, 0, DING.z, 'Goldblock unter dem Notenblock = Instrument Glocke');
}

function walls(b) {
  b.phase('Wände', 'Schwarzeichenstämme an den Ecken, dazwischen Ziegel, oben ein Ringbalken aus geschälten Schwarzeichenstämmen. Die Wände sind 5 Blöcke hoch.', {
    tips: [
      'Lass in der Südwand die Türöffnung frei (Mitte, 2 Blöcke hoch) und in der untersten Ziegelreihe das dritte Feld rechts neben der Tür (von außen gesehen). Dort kommt später der Verstärker für den zweiten Ton hinein – willst du nur einen Ton, setz dort einfach einen Ziegel.',
    ],
  });
  b.step('Eckpfosten', 'Stell auf jede Ecke des Sockels einen Schwarzeichenstamm, 5 Blöcke hoch.');
  for (const [x, z] of [[HOUSE.x1, HOUSE.z1], [HOUSE.x2, HOUSE.z1], [HOUSE.x1, HOUSE.z2], [HOUSE.x2, HOUSE.z2]]) {
    b.fill(x, 1, z, x, WALL_TOP, z, `${darkOak.log}[axis=y]`);
  }
  b.step('Ziegelwände', 'Mauere die Wände aus Ziegeln hoch, 4 Reihen. In der Südwand bleibt die Türöffnung frei (Mitte) und das Feld für den Verstärker (unterste Reihe, 3 Felder rechts der Tür).');
  b.fill(HOUSE.x1 + 1, 1, HOUSE.z1, HOUSE.x2 - 1, WALL_TOP - 1, HOUSE.z1, 'bricks');
  b.fill(HOUSE.x1 + 1, 1, HOUSE.z2, HOUSE.x2 - 1, WALL_TOP - 1, HOUSE.z2, 'bricks');
  b.fill(HOUSE.x1, 1, HOUSE.z1 + 1, HOUSE.x1, WALL_TOP - 1, HOUSE.z2 - 1, 'bricks');
  b.fill(HOUSE.x2, 1, HOUSE.z1 + 1, HOUSE.x2, WALL_TOP - 1, HOUSE.z2 - 1, 'bricks');
  b.fill(DOOR_X, 1, HOUSE.z2, DOOR_X, 2, HOUSE.z2, 'air');
  b.remove(REPEATER.x, REPEATER.y, REPEATER.z);
  b.note(BELL_BLOCK.x, BELL_BLOCK.y, BELL_BLOCK.z, 'Klingelziegel: hier sitzt außen der Knopf');

  b.step('Ringbalken', 'Die oberste, fünfte Reihe legst du ringsum aus geschälten Schwarzeichenstämmen, liegend entlang der Wand.');
  b.fill(HOUSE.x1 + 1, WALL_TOP, HOUSE.z1, HOUSE.x2 - 1, WALL_TOP, HOUSE.z1, `${darkOak.strippedLog}[axis=x]`);
  b.fill(HOUSE.x1 + 1, WALL_TOP, HOUSE.z2, HOUSE.x2 - 1, WALL_TOP, HOUSE.z2, `${darkOak.strippedLog}[axis=x]`);
  b.fill(HOUSE.x1, WALL_TOP, HOUSE.z1 + 1, HOUSE.x1, WALL_TOP, HOUSE.z2 - 1, `${darkOak.strippedLog}[axis=z]`);
  b.fill(HOUSE.x2, WALL_TOP, HOUSE.z1 + 1, HOUSE.x2, WALL_TOP, HOUSE.z2 - 1, `${darkOak.strippedLog}[axis=z]`);
}

function roof(b) {
  b.phase('Balken und Dach', 'Zwei Querbalken tragen später die Laternen, darüber kommt ein Satteldach aus Tiefenschieferfliesen mit First von Westen nach Osten.', {
    tips: [
      'Stell dich beim Setzen der Dachtreppen auf die Traufseite und schau zur Firstmitte – dann zeigt die hohe Seite nach innen.',
      'Die Giebel im Westen und Osten füllst du mit Schwarzeichenbrettern; Holzgiebel auf Ziegelwänden sehen typisch nach Landhaus aus.',
    ],
  });
  b.step('Querbalken', 'Leg zwei Balken aus geschälten Schwarzeichenstämmen quer durchs Haus (von Nord nach Süd) auf die Ringbalken, eine Reihe höher: 3 und 7 Felder von der Westwand entfernt.');
  for (const x of [3, 7]) b.fill(x, WALL_TOP + 1, HOUSE.z1, x, WALL_TOP + 1, HOUSE.z2, `${darkOak.strippedLog}[axis=z]`);

  b.step('Satteldach', 'Das Dach steht ringsum einen Block über. Die unterste Treppenreihe liegt auf Höhe des Ringbalkens vor der Wand, jede weitere Reihe einen Block höher und weiter innen; den First bildet eine Reihe Stufen. Die Querbalken enden in der ersten Dachreihe.');
  b.roof({ x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z2, y: WALL_TOP, type: 'gable', axis: 'x', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: darkOak.planks, overhang: 1 });

  b.step('Schornstein', 'Über der Küche (3 Felder von der Westwand) steht auf dem hinteren Ringbalken ein Schornstein aus Ziegeln: Er ersetzt dort die Dachtreppe und ragt 5 Blöcke hoch bis über den First. Oben ein Kranz aus Ziegeltreppen und ein Lagerfeuer, das raucht.');
  chimney(b, { x: CHIMNEY_X, y: WALL_TOP + 1, z: HOUSE.z1, height: 5, block: 'bricks', smoke: 'normal', rim: 'brick_stairs' });
}

function openings(b) {
  b.phase('Tür und Fenster', 'Jetzt die Haustür mit Rahmen und Stufe und vier Fenster mit Fensterläden aus Schwarzeiche.', {
    tips: ['Lass rechts neben der Tür (von außen gesehen) das Feld direkt neben dem Türrahmen und die beiden Felder dahinter ohne Fensterläden oder Falltüren: Hier sitzen Klingelknopf und Briefkasten, und eine Falltür daneben würde beim Klingeln auf- und zuklappen.'],
  });
  b.step('Haustür', 'Setz die Schwarzeichentür in die Öffnung, links und rechts je einen geschälten Schwarzeichenstamm als Rahmen (2 hoch) und einen liegenden darüber. Vor die Tür kommt eine Bruchsteintreppe als Stufe.');
  doorway(b, { x: DOOR_X, y: 1, z: HOUSE.z2, facing: 'south', door: darkOak.door, frame: darkOak.strippedLog, step: 'cobblestone_stairs' });

  b.step('Fenster', 'Je ein Fenster aus zwei Glasscheiben übereinander (zweite und dritte Reihe über dem Fußboden): links der Tür in der Südwand mit Blumenkasten, mittig in der West- und Ostwand und hinten rechts in der Nordwand. Daneben klappst du Schwarzeichenfalltüren als Läden an die Wand.');
  window(b, { x: 2, y: 2, z: HOUSE.z2, facing: 'south', height: 2, shutters: darkOak.trapdoor, flowerBox: true });
  window(b, { x: HOUSE.x1, y: 2, z: 3, facing: 'west', height: 2, shutters: darkOak.trapdoor });
  window(b, { x: HOUSE.x2, y: 2, z: 3, facing: 'east', height: 2, shutters: darkOak.trapdoor });
  window(b, { x: 7, y: 2, z: HOUSE.z1, facing: 'north', height: 2, shutters: darkOak.trapdoor });
}

function doorbell(b) {
  b.phase('Klingel: Knopf und erster Ton', 'Das Herz der Klingel sind nur zwei Teile: ein Knopf außen an der Wand und ein Notenblock innen direkt dahinter.', {
    tips: [
      'So funktioniert es: Ein gedrückter Knopf versorgt den Block, an dem er sitzt, stark mit Strom. Alles, was direkt an diesem Block steht, wird mitgeschaltet – hier der Notenblock in der Stube.',
      'Der Klingelziegel ist zwei Felder von der Tür entfernt. Direkt neben der Tür würde der Knopf sonst auch die Tür aufstoßen.',
      'Den Ton kannst du jederzeit ändern: Jeder Rechtsklick auf den Notenblock hebt ihn um einen Halbton, nach 24 Klicks fängt er wieder unten an.',
    ],
  });
  b.step('Klingelknopf', 'Setz außen an den Ziegel rechts neben dem Türrahmen (zwei Felder rechts der Tür, unterste Ziegelreihe – von der Wiese aus genau auf Augenhöhe) einen Schwarzeichenknopf.');
  b.set(BUTTON.x, BUTTON.y, BUTTON.z, `${darkOak.button}[face=wall,facing=south,powered=false]`);
  b.note(BUTTON.x, BUTTON.y, BUTTON.z, 'Klingelknopf: einmal drücken = Ding-Dong');

  b.step('Notenblock „Ding“', `Stell in der Stube direkt hinter den Klingelziegel einen Notenblock auf den ersten Goldblock. Klick ihn ${DING_NOTE}-mal mit Rechtsklick an: Dann spielt er ein E – das helle „Ding“. Über ihm muss Luft bleiben.`);
  b.set(DING.x, DING.y, DING.z, noteBlock(DING_NOTE));
  b.note(DING.x, DING.y, DING.z, `Notenblock 1 „Ding“: ${DING_NOTE}× Rechtsklick = Ton E, darüber Luft lassen`);
}

function secondTone(b) {
  b.phase('Zweiter Ton (auf Wunsch)', 'Mit einem Verstärker in der Wand und einem zweiten Notenblock wird aus dem Ding ein Ding-Dong. Willst du nur einen Ton, lässt du dieses Kapitel weg und mauerst das freie Feld in der Wand mit einem Ziegel zu.', {
    tips: [
      'Der Verstärker holt sich das Signal vom Klingelziegel links von ihm und gibt es nach rechts an den nächsten Ziegel weiter – erst nach seiner Verzögerung. Der Ziegel versorgt dann den zweiten Notenblock dahinter.',
      'Ein Notenblock auf Goldblock reicht zwei Oktaven von Fis bis Fis. E und C liegen eine große Terz auseinander – so klingen viele echte Türklingeln.',
      'Bücherregal und Briefkasten sind nicht nur Deko: Sie verdecken das Loch in der Wand, in dem der Verstärker liegt.',
    ],
  });
  b.step('Verstärker in der Wand', 'Leg in das freie Feld rechts neben dem Klingelziegel einen Verstärker auf den Sockel. Schau beim Setzen nach Osten (der Pfeil zeigt dann vom Klingelziegel weg) und klick ihn dreimal an, bis der Schieber ganz hinten steht: 4 Ticks, also 0,4 Sekunden Pause.');
  b.set(REPEATER.x, REPEATER.y, REPEATER.z, 'repeater[delay=4,facing=west,locked=false,powered=false]');
  b.note(REPEATER.x, REPEATER.y, REPEATER.z, 'Verstärker: Eingang am Klingelziegel, 4 Ticks Verzögerung');

  b.step('Notenblock „Dong“', `Der Ziegel rechts neben dem Verstärker bekommt nun dessen Signal. Stell in der Stube direkt dahinter den zweiten Notenblock auf den zweiten Goldblock und klick ihn ${DONG_NOTE}-mal an: Das ist ein C, das tiefere „Dong“.`);
  b.set(DONG.x, DONG.y, DONG.z, noteBlock(DONG_NOTE));
  b.note(DONG.x, DONG.y, DONG.z, `Notenblock 2 „Dong“: ${DONG_NOTE}× Rechtsklick = Ton C`);
  b.note(DONG_BLOCK.x, DONG_BLOCK.y, DONG_BLOCK.z, 'Diesen Ziegel versorgt der Verstärker');

  b.step('Abdeckung innen', 'Zwischen die beiden Notenblöcke kommt ein Bücherregal vor das Loch in der Wand, darauf ein Blumentopf mit Farn. Auf die Notenblöcke selbst stellst du nichts.');
  b.set(REPEATER.x, REPEATER.y, REPEATER.z - 1, 'bookshelf');
  b.set(REPEATER.x, REPEATER.y + 1, REPEATER.z - 1, 'potted_fern');

  b.step('Briefkasten außen', 'Vor das Loch setzt du außen einen Briefkasten: einen Schwarzeichenzaun als Pfosten auf das Gras, darauf ein Fass mit dem Deckel nach Süden und obendrauf eine Laterne, die nachts den Klingelknopf beleuchtet.');
  b.set(MAILBOX.x, MAILBOX.y - 1, MAILBOX.z, darkOak.fence);
  b.set(MAILBOX.x, MAILBOX.y, MAILBOX.z, 'barrel[facing=south,open=false]');
  b.set(MAILBOX.x, MAILBOX.y + 1, MAILBOX.z, 'lantern[hanging=false]');
}

function interior(b) {
  b.phase('Einrichtung', 'Die Stube bekommt eine Küchenzeile, ein Bett, einen Esstisch und zwei Laternen an den Querbalken.', {
    tips: ['Die Laternen hängen direkt unter den Balken. Sie leuchten das ganze Haus aus, damit drinnen keine Monster erscheinen.'],
  });
  b.step('Küche', 'Hinten links an der Nordwand eine Küchenzeile aus Räucherofen, Wasserkessel, Fass und Ofen mit Hängeschränken darüber.');
  kitchen(b, { x: HOUSE.x1 + 1, y: 1, z: HOUSE.z1 + 1, facing: 'south', width: 4, wood: 'schwarzeiche' });

  b.step('Bett und Truhe', 'Hinten rechts ein rotes Bett mit dem Kopfteil an der Nordwand, daneben ein Fass als Nachttisch mit einer Kerze, am Fußende eine Truhe.');
  b.bed(HOUSE.x2 - 1, 1, HOUSE.z1 + 2, 'red_bed', { facing: 'north' });
  b.set(HOUSE.x2 - 2, 1, HOUSE.z1 + 1, 'barrel[facing=up,open=false]');
  b.set(HOUSE.x2 - 2, 2, HOUSE.z1 + 1, 'white_candle[candles=2,lit=true,waterlogged=false]');
  b.set(HOUSE.x2 - 1, 1, HOUSE.z1 + 3, 'chest[facing=west,type=single,waterlogged=false]');

  b.step('Esstisch', 'Links in der Mitte ein Tisch aus zwei Zaunpfosten mit weißem Teppich als Decke, davor und dahinter je zwei Treppen als Stühle.');
  diningTable(b, { x: 2, y: 1, z: 3, facing: 'south', length: 2, width: 1, wood: 'schwarzeiche', top: 'carpet', headChairs: false });

  b.step('Teppich', 'Vor der Tür liegt ein roter Teppich, 3 × 3 Felder, mittig vor der Türöffnung.');
  b.fill(DOOR_X - 1, 1, 3, DOOR_X + 1, 1, 5, 'red_carpet');

  b.step('Laternen', 'Häng unter jeden Querbalken mittig eine Laterne.');
  for (const x of [3, 7]) b.set(x, WALL_TOP, 3, 'lantern[hanging=true,waterlogged=false]');
}

function garden(b) {
  b.phase('Vor dem Haus', 'Ein Weg zur Haustür, Blumen an den Hauswänden, eine Eiche hinter dem Haus und ein paar Büsche.');
  b.step('Weg', 'Ein 3 Blöcke breiter Erdweg führt von Süden zur Stufe vor der Haustür.');
  path(b, { x: DOOR_X, y: -1, z: HOUSE.z2 + 1, facing: 'south', length: 7, width: 3, mix: 'erde', wiggle: 1, seed: 2 });

  b.step('Blumenbeete', 'Entlang der West- und Ostwand je ein schmales Beet, rechts vom Briefkasten ein kleines.');
  flowerBed(b, { x: HOUSE.x1 - 2, y: -1, z: HOUSE.z1, width: 2, depth: 7, facing: 'west', palette: 'warm', tall: false, seed: 3 });
  flowerBed(b, { x: HOUSE.x2 + 1, y: -1, z: HOUSE.z1, width: 2, depth: 7, facing: 'east', palette: 'warm', tall: false, seed: 4 });
  flowerBed(b, { x: DONG.x, y: -1, z: HOUSE.z2 + 1, width: 2, depth: 1, facing: 'south', palette: 'warm', tall: false, seed: 5 });

  b.step('Bäume und Büsche', 'Hinten links neben dem Haus eine mittelgroße Eiche, an den vorderen Ecken Büsche.');
  tree(b, { x: -7, y: 0, z: -4, species: 'eiche', size: 'mittel', seed: 6 });
  bush(b, { x: HOUSE.x1 - 3, y: 0, z: HOUSE.z2 + 3, size: 'klein', leaves: 'azalee', seed: 7 });
  bush(b, { x: HOUSE.x2 + 3, y: 0, z: HOUSE.z2 + 3, size: 'klein', leaves: 'eiche', seed: 8 });

  b.step('Wiese', 'Etwas hohes Gras und Wildblumen auf der Wiese.');
  vegetation(b, { x: GROUND.x, y: -1, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.3, seed: 9 });
}

// Sicherheitsnetz: meldet dunkle begehbare Felder im Haus als Fehler, statt sie still zu übergehen. Zwei Kästen, weil der
// Dachraum schräg ist: Stube bis unter die erste Dachreihe, dazu die mittleren Reihen bis über die Querbalken.
function checkLight(b) {
  const boxes = [
    { x1: HOUSE.x1 + 1, y1: 1, z1: HOUSE.z1 + 1, x2: HOUSE.x2 - 1, y2: WALL_TOP + 1, z2: HOUSE.z2 - 1 },
    { x1: HOUSE.x1 + 1, y1: 1, z1: HOUSE.z1 + 2, x2: HOUSE.x2 - 1, y2: WALL_TOP + 2, z2: HOUSE.z2 - 2 },
  ];
  for (const box of boxes) {
    const dark = findDarkSpots(b, box);
    if (dark.length > 0) throw new Error(`tuerklingel: ${dark.length} dunkle Felder im Haus, z. B. ${dark[0].join(', ')}.`);
  }
}

export default function build(b) {
  site(b);
  walls(b);
  roof(b);
  openings(b);
  doorbell(b);
  secondTone(b);
  interior(b);
  checkLight(b);
  garden(b);
}
