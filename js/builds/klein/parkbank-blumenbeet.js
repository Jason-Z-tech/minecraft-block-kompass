// Parkbank mit Blumenbeet: Bank aus Treppen mit Falltür-Lehne und Schild-Armlehnen, dahinter ein Hochbeet,
// daneben eine Laterne, davor ein Kiesweg. Bank bei x = −1 … 1, z = 0 (Blick nach Süden); Wiese auf y = 0.

import { WOOD, lampPost, terrain, flowerBed, path, fixDirtPaths, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'parkbank-blumenbeet',
  title: 'Parkbank mit Blumenbeet',
  category: 'klein',
  subtitle: 'Sitzbank mit Lehne und Armlehnen vor einem Hochbeet, mit Laterne und Kiesweg',
  tags: ['Bank', 'Parkbank', 'Blumenbeet', 'Hochbeet', 'Park', 'Garten', 'Deko', 'Sitzplatz', 'Klein', 'Anfänger'],
  aliases: [
    'parkbank', 'bank', 'sitzbank', 'gartenbank', 'holzbank', 'park bank', 'blumenbeet', 'hochbeet', 'beet',
    'bench', 'park bench', 'garden bench', 'flower bed', 'flowerbed', 'sitzecke', 'parkbankk', 'parkbnak',
  ],
  accuracy: 'eigenes',
  difficulty: 1,
  description: 'Eine gemütliche Parkbank aus Schwarzeichentreppen mit hoher Lehne aus offenen Falltüren und Armlehnen aus Wandschildern. Dahinter wächst ein Hochbeet mit Fichtenrahmen und bunten Blumen, daneben stehen eine Laterne und ein Mülleimer, davor führt ein Kiesweg vorbei. In wenigen Minuten gebaut und überall im Dorf oder Park einsetzbar.',
  facts: [
    'Offene Falltüren stehen senkrecht an einer Blockkante – auf der Treppe ergeben sie eine hohe Rückenlehne.',
    'Wandschilder brauchen einen festen Block dahinter: hier halten sie an den Enden der Treppen.',
    'Im Spiel kannst du dich nicht auf Treppen setzen – die Bank ist reine Deko.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const dark = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const BED = { x0: -4, x1: 4, z0: -5, z1: -1 };

function ground(b) {
  b.phase('Wiese', 'Such dir ein flaches Stück Wiese mit etwa 17 × 16 Blöcken. Die Bank schaut nach Süden.');
  terrain(b, { x: -8, y: -1, z: -9, width: 17, depth: 16, height: 1, shape: 'rund', seed: 'parkbank' });
}

function flowerBox(b) {
  const { x0, x1, z0, z1 } = BED;
  b.phase('Hochbeet', 'Hinter der Bank steht ein Hochbeet: 9 × 5 Blöcke, eine Ebene hoch, mit einem Rahmen aus Fichte.', {
    tips: ['Hohe Blumen wie Flieder und Rosenstrauch kommen nach hinten, kleine nach vorne – dann siehst du von der Bank aus alle.'],
  });
  b.step('Rahmen', 'Lege den Rahmen auf die Wiese: an den Ecken Fichtenholz (Rinde ringsum), dazwischen liegende Fichtenstämme – vorne und hinten in Ost-West-Richtung, an den Seiten in Nord-Süd-Richtung.');
  for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) b.set(x, 1, z, `${spruce.log}[axis=x]`);
  for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) b.set(x, 1, z, `${spruce.log}[axis=z]`);
  for (const x of [x0, x1]) for (const z of [z0, z1]) b.set(x, 1, z, `${spruce.wood}[axis=y]`);

  b.step('Erde und Blumen', 'Fülle das Innere (7 × 3) mit Grasblöcken und pflanze die Blumen: hinten Flieder, Pfingstrosen und Rosensträucher, vorne kleine Blumen in Grüppchen.');
  flowerBed(b, { x: x0 + 1, y: 1, z: z0 + 1, width: x1 - x0 - 1, depth: z1 - z0 - 1, facing: 'south', palette: 'bunt', density: 0.9, seed: 3 });
}

function bench(b) {
  b.phase('Parkbank', 'Die Bank ist 3 Blöcke lang und steht direkt vor dem Hochbeet.');
  b.step('Sitzfläche', 'Setze drei Schwarzeichentreppen nebeneinander, die hohe Seite nach hinten zum Beet: schau beim Setzen nach Norden.');
  for (let x = -1; x <= 1; x++) b.stairs(x, 1, 0, dark.stairs, { facing: 'north' });

  b.step('Lehne', 'Setze auf jede Treppe eine Schwarzeichenfalltür und öffne sie. Schau dabei nach Süden und klick auf die hintere Hälfte – dann klappt die Falltür an die Rückseite und bildet mit der Treppe eine hohe Lehne.');
  for (let x = -1; x <= 1; x++) b.set(x, 2, 0, `${dark.trapdoor}[facing=south,half=bottom,open=true]`);

  b.step('Armlehnen', 'Klick mit einem Schwarzeichenschild an die linke und die rechte Stirnseite der Bank. Den Text lässt du leer (Esc drücken).');
  b.set(-2, 1, 0, `${dark.wallSign}[facing=west]`);
  b.set(2, 1, 0, `${dark.wallSign}[facing=east]`);
}

function extras(b) {
  b.phase('Laterne und Mülleimer', 'Rechts neben der Bank steht eine Laterne, links ein Kessel als Mülleimer.');
  b.step('Laterne', 'Setze rechts mit zwei Blöcken Abstand einen Steinziegel, darauf drei Schwarzeichenzäune und oben einen Zaun als Arm nach links zur Bank. Darunter hängt die Laterne.');
  lampPost(b, { x: 4, y: 1, z: 0, facing: 'west', height: 4, post: dark.fence, base: 'stone_bricks', style: 'arm' });

  b.step('Mülleimer', 'Stelle links neben die Bank einen Kessel.');
  b.set(-3, 1, 0, 'cauldron');
}

function surroundings(b) {
  b.phase('Weg und Grün', 'Zum Schluss der Kiesweg vor der Bank, ein kleiner Baum, Büsche und Gras.');
  b.step('Kiesweg', 'Lege vor der Bank einen 3 Blöcke breiten Weg aus Kies und etwas grober Erde quer über die Wiese.');
  path(b, { x: -7, y: 0, z: 2, facing: 'east', length: 15, width: 3, mix: 'kies', wiggle: 0.6, seed: 4 });

  b.step('Baum und Büsche', 'Pflanze hinten links eine kleine Eiche, setze Büsche an die Ecken des Beets und streue Gras und Blumen auf die Wiese.');
  tree(b, { x: -6, y: 1, z: -6, species: 'eiche', size: 'klein', seed: 2 });
  bush(b, { x: 6, y: 1, z: -3, size: 'klein', leaves: 'azalee', seed: 5 });
  bush(b, { x: 6, y: 1, z: -6, size: 'klein', leaves: 'birke', seed: 6 });
  vegetation(b, { x: -8, y: 0, z: -9, width: 17, depth: 16, mix: 'wiese', density: 0.3, seed: 7 });
  fixDirtPaths(b, { x1: -8, y1: 0, z1: -9, x2: 8, y2: 0, z2: 6 });
}

export default function build(b) {
  ground(b);
  flowerBox(b);
  bench(b);
  extras(b);
  surroundings(b);
}
