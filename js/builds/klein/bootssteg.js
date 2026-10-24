// Bootssteg mit Hütte: kleine Fischerhütte am Ufer, Holzsteg auf Pfählen in einen Teich, Angelplatz am Ende.
// Wiese und Wasserspiegel auf y = 0, Stegdeck auf y = 1. Die Hütte steht im Norden, der Steg läuft nach Süden.

import { WOOD, window, doorway, lightRoom, terrain, pond, path, fixDirtPaths, tree, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'bootssteg',
  title: 'Bootssteg mit Hütte',
  category: 'klein',
  subtitle: 'Holzsteg mit Pollern und Angelplatz, dazu eine kleine Fischerhütte am Ufer',
  tags: ['Steg', 'Bootssteg', 'Anlegestelle', 'Fischerhütte', 'Hütte', 'Angeln', 'Wasser', 'Teich', 'See', 'Holz', 'Klein', 'Anfänger'],
  aliases: [
    'bootssteg', 'steg', 'boot steg', 'bootsteg', 'holzsteg', 'anlegestelle', 'anleger', 'fischerhütte', 'fischerhuette',
    'angelsteg', 'angelplatz', 'dock', 'boat dock', 'pier', 'jetty', 'fishing dock', 'fishing hut', 'fisherman hut', 'wooden dock',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Eine kleine Fischerhütte aus Fichte steht am Ufer eines Teichs, davor führt ein Holzsteg auf Pfählen ins Wasser. Die Pfähle ragen als Poller über das Deck, am Ende liegt ein breiter Angelplatz mit zwei Sitzen, Fass, Köderkessel und Laternen. In der Hütte gibt es Bett, Räucherofen, Truhe und Fässer.',
  facts: [
    'Der Steg ist 3 Blöcke breit und läuft 5 Blöcke über Strand und Wasser, der Angelplatz am Ende ist 7 × 3 Blöcke groß.',
    'Das Wasser ist nur ein schmaler Streifen aus Wasserquellen – baust du an einem See oder Fluss, lässt du ihn einfach weg.',
    'Die Hütte ist innen 5 × 3 Blöcke groß und mit einer Laterne überall hell genug, damit keine Monster spawnen.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;
const HUT = { x0: -8, x1: -2, z0: -10, z1: -6 };
const DECK_Y = 1;
// Pfähle: schmaler Steg bei x = ±2, Angelplatz an den Ecken bei x = ±4.
const PLATFORM = { z0: 2, z1: 4 };
const NARROW_ROWS = [-1];
const PILES = [[-2, -1], [2, -1], [-4, 2], [4, 2], [-4, 4], [4, 4]];
// Gelände und Teich (Teich = schmaler Wasserstreifen vor der Hütte).
const LAND = { x: -12, z: -13, width: 25, depth: 24 };
const POND = { x: -9, z: -2, width: 19, depth: 10 };

const isWater = (b, x, y, z) => b.get(x, y, z).startsWith('water');

function ground(b) {
  b.phase('Ufer und Wasser', 'Baust du an einem See oder Fluss, kannst du dieses Kapitel überspringen. Sonst legst du eine Wiese an und gräbst vor der Hütte einen schmalen Wasserstreifen, 2 Blöcke tief, mit einem Sandstrand auf der Nordseite.', {
    tips: ['Fülle das Wasser mit Wassereimern von der Mitte aus. Jede Zelle bekommt eine eigene Quelle, dann fließt nichts.'],
  });
  b.step('Wiese', 'Lege die Wiese mit etwa 25 × 24 Blöcken aus.');
  // Drei Lagen dick, damit der Grund des Wassers (2 tief) nicht unter der Wiese herausragt.
  terrain(b, { x: LAND.x, y: -2, z: LAND.z, width: LAND.width, depth: LAND.depth, height: 2, shape: 'rund', seed: 'ufer' });

  b.step('Wasserstreifen', 'Grabe den Wasserstreifen (mit Ufer 19 × 10 Blöcke, das Wasser selbst etwa 17 × 7, in der Mitte 2 tief, am Rand 1 tief), lege Sand, Kies und Ton ans Ufer und fülle Wasser ein. Seerosen, Seegras und Zuckerrohr am Ufer machen ihn lebendig.');
  pond(b, { x: POND.x, y: 0, z: POND.z, width: POND.width, depth: POND.depth, facing: 'north', waterDepth: 2, shore: 'gemischt', seed: 2 });
}

function hut(b) {
  const { x0, x1, z0, z1 } = HUT;
  b.phase('Fischerhütte', 'Die Hütte ist außen 7 × 5 Blöcke groß: ein kleines Blockhaus aus Fichte auf einem Bruchsteinsockel, mit Satteldach aus Schwarzeiche.');
  b.step('Sockel und Boden', 'Lege den Sockel eine Ebene über der Wiese (Ebene 4) aus Bruchstein mit etwas bemoostem Bruchstein und fülle innen den Boden mit Fichtenbrettern.');
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) b.set(x, 1, z, b.chance(0.3) ? 'mossy_cobblestone' : 'cobblestone');
  b.fill(x0 + 1, 1, z0 + 1, x1 - 1, 1, z1 - 1, spruce.planks);

  b.step('Wände', 'Stelle an die vier Ecken je drei Fichtenstämme (Ebene 5 bis 7). Dazwischen legst du drei Lagen geschälte Fichtenstämme liegend wie bei einem Blockhaus: in der Nord- und Südwand in Ost-West-Richtung, in der Ost- und Westwand in Nord-Süd-Richtung. Tür und Fenster setzt du gleich hinein.');
  for (const z of [z0, z1]) b.fill(x0 + 1, 2, z, x1 - 1, 4, z, `${spruce.strippedLog}[axis=x]`);
  for (const x of [x0, x1]) b.fill(x, 2, z0 + 1, x, 4, z1 - 1, `${spruce.strippedLog}[axis=z]`);
  for (const x of [x0, x1]) for (const z of [z0, z1]) b.fill(x, 2, z, x, 4, z, `${spruce.log}[axis=y]`);

  b.step('Dach', 'Das Satteldach hat den First in Ost-West-Richtung und einen Block Überstand. Setze die unterste Treppenreihe neben die Wandkrone (Ebene 7), jede weitere eine Ebene höher und einen Block weiter innen; der First besteht aus unteren Stufen. Die Giebel füllst du mit Fichtenbrettern.');
  b.roof({ x1: x0, z1: z0, x2: x1, z2: z1, y: 4, type: 'gable', axis: 'x', stairs: dark.stairs, slab: dark.slab, full: spruce.planks, overhang: 1 });

  b.step('Tür und Fenster', 'Setze die Fichtentür in die Mitte der Südwand und vier kleine Fenster aus Glasscheiben: zwei neben der Tür und je eines in der Ost- und Westwand, diese beiden mit offenen Falltüren als Fensterläden. In den Ostgiebel kommt ein Guckloch aus einer Glasscheibe. Unter die Dachtraufe rechts neben der Tür hängst du eine Laterne.');
  doorway(b, { x: -5, y: 2, z: z1, facing: 'south', door: spruce.door, frame: null });
  for (const x of [-7, -3]) window(b, { x, y: 3, z: z1, facing: 'south', height: 1 });
  window(b, { x: x0, y: 3, z: -8, facing: 'west', height: 1, shutters: spruce.trapdoor });
  window(b, { x: x1, y: 3, z: -8, facing: 'east', height: 1, shutters: spruce.trapdoor });
  b.set(x1, 5, -8, 'glass_pane');
  b.set(-4, 3, z1 + 1, 'lantern[hanging=true]');
}

function hutInterior(b) {
  b.phase('Einrichtung der Hütte', 'Innen ist Platz für ein Bett, einen Räucherofen für den Fang, eine Truhe und Fässer.');
  b.step('Möbel', 'An die Nordwand kommen von West nach Ost: das Bett mit dem Kopfteil an der Wand, ein Fass, der Räucherofen, eine Truhe und noch ein Fass. Rechts neben der Tür steht eine Werkbank.');
  b.bed(-7, 2, -8, 'blue_bed', { facing: 'north' });
  b.set(-6, 2, -9, 'barrel[facing=up,open=false]');
  b.set(-5, 2, -9, 'smoker[facing=south,lit=false]');
  b.set(-4, 2, -9, 'chest[facing=south]');
  b.set(-3, 2, -9, 'barrel[facing=south,open=false]');
  b.set(-3, 2, -7, 'crafting_table');

  b.step('Licht', 'Hänge unter den First eine Laterne. Sie macht den ganzen Raum hell genug, damit keine Monster spawnen.');
  b.set(-5, 6, -8, 'lantern[hanging=true]');
  // Prüft die Helligkeit (Luftraum bis unter den First); setzt nur zusätzliche Laternen, falls noch etwas dunkel ist.
  lightRoom(b, { x1: HUT.x0 + 1, y1: 2, z1: HUT.z0 + 1, x2: HUT.x1 - 1, y2: 6, z2: HUT.z1 - 1 });
}

// Zuckerrohr vom Teichufer, das nach dem Stegbau nicht mehr stehen bleiben würde, kommt weg: Rohr über dem Deck
// (sein Fuß ist jetzt ein Brett) und Rohr, dessen Wasser neben dem Fuß ein Pfahl ersetzt hat.
function removeLostCane(b, { x1, z1, x2, z2 }) {
  const isCane = (x, y, z) => b.get(x, y, z).startsWith('sugar_cane');
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      for (let y = 1; y <= 4; y++) {
        if (!isCane(x, y, z) || isCane(x, y - 1, z)) continue;
        const soil = b.get(x, y - 1, z);
        const soilOk = ['sand', 'red_sand', 'dirt', 'grass_block', 'coarse_dirt', 'podzol', 'mud', 'moss_block', 'rooted_dirt'].some((id) => soil === id || soil.startsWith(`${id}[`));
        const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isWater(b, x + dx, y - 1, z + dz));
        if (soilOk && wet) continue;
        for (let yy = y; isCane(x, yy, z); yy++) b.remove(x, yy, z);
      }
    }
  }
}

// Pfahl vom Teichgrund bis eine Ebene über das Deck (als Poller).
function pile(b, x, z) {
  let y = 0;
  while (y > -6 && isWater(b, x, y - 1, z)) y--;
  b.fill(x, y, z, x, DECK_Y + 1, z, `${spruce.log}[axis=y]`);
}

function dock(b) {
  b.phase('Steg', 'Der Steg beginnt vor der Hütte als Veranda, läuft 3 Blöcke breit über den Strand ins Wasser und endet in einem breiten Angelplatz.', {
    tips: [
      'Pfähle setzt du von oben ins Wasser: auf den Teichgrund klicken und nach oben stapeln.',
      'Ein Boot setzt du mit Rechtsklick aufs Wasser direkt neben den Angelplatz – vom Steg aus steigst du ohne nasse Füße ein.',
    ],
  });
  b.step('Pfähle', 'Setze die sechs Pfähle aus Fichtenstämmen bis eine Ebene über das Deck (Ebene 5): ein Paar links und rechts neben dem schmalen Steg vorne am Strand, dazu vier im Wasser an den Ecken des Angelplatzes – die stehen auf dem Grund.');
  for (const [x, z] of PILES) pile(b, x, z);

  b.step('Querbalken', 'Lege bei jedem Pfahlpaar einen Querbalken aus geschälten Fichtenstämmen auf Deckhöhe (Ebene 4, eine Ebene über der Wiese) in Ost-West-Richtung von Pfahl zu Pfahl. Am Angelplatz liegen zwei Balken: vorne und hinten.');
  for (const z of NARROW_ROWS) b.fill(-1, DECK_Y, z, 1, DECK_Y, z, `${spruce.strippedLog}[axis=x]`);
  for (const z of [PLATFORM.z0, PLATFORM.z1]) b.fill(-3, DECK_Y, z, 3, DECK_Y, z, `${spruce.strippedLog}[axis=x]`);

  b.step('Deck', 'Fülle das Deck zwischen den Querbalken mit Fichtenbrettern: vor der Hütte eine Veranda (2 Blöcke tief) bis zum Steg, dann der Steg (3 breit, 5 lang) und dazwischen auf dem Angelplatz (7 × 3) die mittlere Reihe.');
  b.fill(HUT.x0, DECK_Y, HUT.z1 + 1, 1, DECK_Y, HUT.z1 + 2, spruce.planks);
  const beamRows = new Set([...NARROW_ROWS, PLATFORM.z0, PLATFORM.z1]);
  for (let z = HUT.z1 + 3; z <= PLATFORM.z1; z++) {
    if (beamRows.has(z)) continue;
    const half = z >= PLATFORM.z0 ? 3 : 1;
    b.fill(-half, DECK_Y, z, half, DECK_Y, z, spruce.planks);
  }
  removeLostCane(b, { x1: LAND.x, z1: -6, x2: LAND.x + LAND.width - 1, z2: LAND.z + LAND.depth - 1 });

  b.step('Geländer an der Veranda', 'Setze an das Westende der Veranda einen Fichtenzaun als Geländer.');
  b.fill(HUT.x0, DECK_Y + 1, HUT.z1 + 1, HUT.x0, DECK_Y + 1, HUT.z1 + 2, spruce.fence);
}

function fishingSpot(b) {
  b.phase('Angelplatz', 'Am Ende des Stegs sitzt man und angelt.');
  b.step('Sitze und Fässer', 'Setze an die Südkante zwei Fichtentreppen als Sitze, die hohe Seite nach Norden (du schaust beim Sitzen aufs Wasser). Daneben kommen ein Fass für den Fang und ein Wasserkessel mit Ködern, hinten links ein Stapel aus drei Fässern.');
  b.stairs(-2, DECK_Y + 1, PLATFORM.z1, spruce.stairs, { facing: 'north' });
  b.stairs(2, DECK_Y + 1, PLATFORM.z1, spruce.stairs, { facing: 'north' });
  b.set(0, DECK_Y + 1, PLATFORM.z1, 'barrel[facing=up,open=false]');
  b.set(3, DECK_Y + 1, PLATFORM.z0 + 1, 'water_cauldron[level=3]');
  b.set(-3, DECK_Y + 1, PLATFORM.z0 + 1, 'barrel[facing=east,open=false]');
  b.set(-3, DECK_Y + 1, PLATFORM.z0, 'barrel[facing=east,open=false]');
  b.set(-3, DECK_Y + 2, PLATFORM.z0 + 1, 'barrel[facing=up,open=false]');

  b.step('Laternen', 'Stelle auf die beiden äußeren Pfähle am Ende und auf den ersten Pfahl am Ufer je eine Laterne.');
  for (const [x, z] of [[-4, PLATFORM.z1], [4, PLATFORM.z1], [2, NARROW_ROWS[0]]]) b.set(x, DECK_Y + 2, z, 'lantern[hanging=false]');
  b.note(0, DECK_Y + 1, PLATFORM.z0 + 1, 'Angelplatz');
}

function surroundings(b) {
  b.phase('Rund um die Hütte', 'Zum Schluss ein Trampelpfad zur Veranda, Fässer und ein Holzstapel, Bäume und Gras.');
  b.step('Pfad, Fässer und Holzstapel', 'Lege einen Trampelpfad von Osten an die Veranda. Unter das Westfenster kommt ein Brennholzstapel: zwei Lagen zu drei Fichtenstämmen, liegend in Ost-West-Richtung, damit du von außen auf die Schnittflächen schaust. Klick dafür jeden Stamm an die Westseite der Hütte (Sockel bzw. Wand) – Stämme legen sich in die Richtung der angeklickten Fläche. Der Stapel bleibt unter dem Fenster. Vorne auf die Veranda stellst du zwei Fässer.');
  path(b, { x: 2, y: 0, z: -5, facing: 'east', length: 9, width: 3, mix: 'erde', wiggle: 0.6, seed: 3 });
  b.fill(HUT.x0 - 1, 1, -9, HUT.x0 - 1, 2, -7, `${spruce.log}[axis=x]`);
  b.set(-7, DECK_Y + 1, HUT.z1 + 2, 'barrel[facing=up,open=false]');
  b.set(-6, DECK_Y + 1, HUT.z1 + 2, 'barrel[facing=south,open=false]');

  b.step('Bäume und Gras', 'Pflanze zwei Birken hinter der Hütte und einen Busch und streue Gras und Blumen auf die Wiese.');
  tree(b, { x: 3, y: 1, z: -10, species: 'birke', size: 'mittel', seed: 1 });
  tree(b, { x: 8, y: 1, z: -7, species: 'birke', size: 'klein', seed: 2 });
  bush(b, { x: -9, y: 1, z: -11, size: 'klein', leaves: 'eiche', seed: 3 });
  vegetation(b, { x: LAND.x, y: 0, z: LAND.z, width: LAND.width, depth: LAND.depth, mix: 'wiese', density: 0.3, seed: 4 });
  fixDirtPaths(b, { x1: LAND.x, y1: 0, z1: LAND.z, x2: LAND.x + LAND.width - 1, y2: 0, z2: LAND.z + LAND.depth - 1 });
}

export default function build(b) {
  ground(b);
  hut(b);
  hutInterior(b);
  dock(b);
  fishingSpot(b);
  surroundings(b);
}
