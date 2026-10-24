// Gartenlaube: achteckiger Pavillon mit Zeltdach aus Schwarzeiche, Bänken, Ranken und hängender Laterne.
// Mitte bei (0, 0); Wiese auf y = 0, Fundament auf y = 1, Eingang im Süden (+z).

import { WOOD, hangingLantern, terrain, path, fixDirtPaths, flowerBed, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'gartenlaube',
  title: 'Gartenlaube',
  category: 'klein',
  subtitle: 'Achteckiger Pavillon mit Zeltdach, Bänken und Ranken',
  tags: ['Pavillon', 'Laube', 'Garten', 'Park', 'Deko', 'Achteck', 'Holz', 'Klein', 'Anfänger'],
  aliases: [
    'gartenlaube', 'laube', 'pavillon', 'gartenpavillon', 'gazebo', 'garden gazebo', 'pavilion', 'garden pavilion',
    'gartenhaus offen', 'achteck pavillon', 'octagon gazebo', 'pergola', 'musikpavillon', 'gartenlaub', 'pavilon',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Ein offener, achteckiger Pavillon für den Garten: acht Pfosten aus Schwarzeiche auf einem Steinsockel, dazwischen ein Fichtengeländer, innen eine Sitzbank rundum und ein kleiner Tisch. Das achteckige Zeltdach aus Schwarzeichentreppen trägt eine Spitze, in der Mitte hängt eine Laterne. Ranken an den Pfosten, Blumenbeete und eine Birke machen die Laube gemütlich.',
  facts: [
    'Der Grundriss ist ein Achteck mit 9 Blöcken Durchmesser; das Dach steht ringsum einen Block über.',
    'Die schrägen Dachkanten sind aus versetzten Treppen gestuft; die beiden obersten Ringe sind Quadrate mit echten Außenecken.',
    'Ranken halten nur an vollen Blockseiten: darum wachsen sie an den Stämmen, nicht am Zaun.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const dark = WOOD.schwarzeiche;
const spruce = WOOD.fichte;
const R = 4; // halbe Breite des Grundrisses
const S = 6; // Grenze |x| + |z| der schrägen Seiten
const POSTS = [[-2, -4], [2, -4], [4, -2], [4, 2], [2, 4], [-2, 4], [-4, 2], [-4, -2]];
const DIAGONALS = [[-3, -3], [3, -3], [3, 3], [-3, 3]];

const inOctagon = (x, z, r, s) => Math.max(Math.abs(x), Math.abs(z)) <= r && Math.abs(x) + Math.abs(z) <= s;
const isPost = (x, z) => POSTS.some(([px, pz]) => px === x && pz === z);

// Randzellen eines Achtecks (Nachbar in einer der vier Richtungen liegt außerhalb).
function octagonOutline(r, s) {
  const cells = [];
  for (let z = -r; z <= r; z++) {
    for (let x = -r; x <= r; x++) {
      if (!inOctagon(x, z, r, s)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inOctagon(x + dx, z + dz, r, s));
      if (edge) cells.push([x, z]);
    }
  }
  return cells;
}

// Richtung (hohe Seite zur Mitte) einer Dachtreppe. Die Form (gerade/Außenecke) berechnet finalize() wie das
// Spiel aus den Nachbarn: Ecken der Quadrat-Ringe werden Außenecken, die versetzten Treppen der schrägen
// Kanten bleiben gerade (im Spiel lässt sich dort keine Außenecke erzwingen).
function roofStairFacing(x, z) {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  // Genau auf der Diagonale: Windrad wie bei b.roof (Richtung der Seite rechts davon, von außen gesehen).
  if (ax === az) return x < 0 ? (z < 0 ? 'east' : 'north') : (z < 0 ? 'south' : 'west');
  if (az > ax) return z < 0 ? 'south' : 'north';
  return x < 0 ? 'east' : 'west';
}

// Hochbeete links und rechts vom Weg, Nordwestecke (x0, z0), außen 5 × 5.
const BEDS = [{ x0: -6, z0: R + 1, palette: 'rosa', seed: 1 }, { x0: 2, z0: R + 1, palette: 'kuehl', seed: 2 }];

// Hochbeet außen 5 × 5 ab der Nordwestecke (x0, z0) auf der Wiese (y = 0): Stammrahmen auf y = 1, innen Beet.
// Die Erde darunter legt schon ground() (unter vollen Blöcken wird Gras im Spiel zu Erde).
function raisedBed(b, { x0, z0, palette, seed }) {
  const x1 = x0 + 4;
  const z1 = z0 + 4;
  for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) b.set(x, 1, z, `${spruce.strippedLog}[axis=x]`);
  for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) b.set(x, 1, z, `${spruce.strippedLog}[axis=z]`);
  for (const x of [x0, x1]) for (const z of [z0, z1]) b.set(x, 1, z, spruce.wood);
  flowerBed(b, { x: x0 + 1, y: 1, z: z0 + 1, width: 3, depth: 3, facing: 'south', palette, density: 1, seed });
}

function ground(b) {
  b.phase('Fundament', 'Die Laube steht auf einem achteckigen Sockel, eine Ebene über der Wiese. Das Achteck ist 9 Blöcke breit: die Reihen haben von Norden nach Süden 5, 7, 9, 9, 9, 7 und 5 Blöcke.', {
    tips: ['Leg zuerst die Mittelreihe mit 9 Blöcken und die Mittelspalte mit 9 Blöcken als Kreuz – daran kannst du alle anderen Reihen abzählen.'],
  });
  b.step('Wiese', 'Such dir eine flache Wiese mit etwa 23 Blöcken Durchmesser. Vorne links und rechts vom späteren Eingang ersetzt du je ein Feld von 5 × 5 Blöcken durch Erde: Dort kommen am Schluss die Hochbeete hin, und unter ihnen würde das Gras ohnehin zu Erde werden.');
  terrain(b, { x: -11, y: -1, z: -11, width: 23, depth: 23, height: 1, shape: 'rund', seed: 'laube' });
  for (const { x0, z0 } of BEDS) b.fill(x0, 0, z0, x0 + 4, 0, z0 + 4, 'dirt');

  b.step('Steinkranz und Boden', 'Setze den Rand des Achtecks aus Steinziegeln mit ein paar bemoosten Steinziegeln und fülle die Fläche innen mit Fichtenbrettern.');
  for (let z = -R; z <= R; z++) {
    for (let x = -R; x <= R; x++) if (inOctagon(x, z, R, S)) b.set(x, 1, z, spruce.planks);
  }
  for (const [x, z] of octagonOutline(R, S)) b.set(x, 1, z, b.chance(0.25) ? 'mossy_stone_bricks' : 'stone_bricks');
}

function postsAndRailing(b) {
  b.phase('Pfosten und Geländer', 'Acht Pfosten stehen an den Ecken des Achtecks, dazwischen läuft ein niedriges Geländer.');
  b.step('Pfosten', 'Stelle auf jede Ecke des Achtecks vier Schwarzeichenstämme übereinander (Ebene 4 bis 7). Die Ecken liegen je zwei Blöcke neben der Mittelreihe bzw. Mittelspalte am Rand.');
  for (const [x, z] of POSTS) b.fill(x, 2, z, x, 5, z, `${dark.log}[axis=y]`);

  b.step('Geländer', 'Setze auf alle übrigen Randfelder einen Fichtenzaun – auch auf die vier schrägen Ecken. Vorne in der Mitte bleiben drei Felder als Eingang frei.');
  for (const [x, z] of octagonOutline(R, S)) {
    if (isPost(x, z) || (z === R && Math.abs(x) <= 1)) continue;
    b.set(x, 2, z, spruce.fence);
  }
}

function beams(b) {
  b.phase('Balkenkranz', 'Auf Ebene 8 verbindet ein Kranz aus geschälten Schwarzeichenstämmen alle Pfosten. Er trägt das Dach.');
  for (const [x, z] of octagonOutline(R, S)) {
    if (isPost(x, z)) b.set(x, 6, z, `${dark.log}[axis=y]`);
    else if (Math.abs(x) === Math.abs(z)) b.set(x, 6, z, dark.strippedWood);
    else b.set(x, 6, z, `${dark.strippedLog}[axis=${Math.abs(z) === R ? 'x' : 'z'}]`);
  }
}

function roof(b) {
  b.phase('Zeltdach', 'Das Dach besteht aus fünf achteckigen Treppenringen, jeder eine Ebene höher und einen Block weiter innen. Der unterste Ring steht einen Block über den Balkenkranz über.', {
    tips: [
      'Gerade Kanten: Treppen mit der hohen Seite zur Mitte – schau beim Setzen zur Mitte der Laube.',
      'Schräge Kanten: Die Treppen sitzen dort versetzt. Jede gehört zur geraden Seite, der sie näher liegt, und schaut wie diese zur Mitte. Liegt eine genau auf der Diagonale, nimm die Richtung der Seite rechts davon (von außen gesehen). Sie bleiben gerade Treppen – Außenecken bildet das Spiel nur, wenn direkt vor einer Treppe eine quer stehende liegt.',
      'Die beiden obersten Ringe sind Quadrate: Setz erst die geraden Seiten, dann die Ecktreppen – sie werden von selbst zu Außenecken.',
    ],
  });
  const ringTexts = [
    'Der unterste Ring liegt außen neben dem Balkenkranz und bildet den Überstand: an den geraden Seiten 5 Treppen, an jeder schrägen Kante 2 versetzte Treppen.',
    'Der zweite Ring liegt direkt auf dem Balkenkranz.',
    'Ab hier liegt jeder Ring auf einer Lage Schwarzeichenbretter unter sich – sie schließen das Dach innen und sind von unten als Holzdecke zu sehen.',
    'Der vierte Ring ist ein Quadrat mit 5 × 5 Blöcken; die vier Ecken sind Außenecken.',
    'Der letzte Ring ist ein Quadrat aus 8 Treppen, in die Mitte kommt ein Schwarzeichenbrett.',
  ];
  for (let k = 0; k <= 4; k++) {
    const r = R + 1 - k;
    const s = S + 1 - k;
    const y = 6 + k;
    b.step(`Dachring ${k + 1} (Ebene ${y + 2})`, ringTexts[k]);
    // Unter den Ringen ab dem dritten eine Lage Bretter, damit an den schrägen Ecken keine Lücke bleibt.
    if (k >= 2) for (const [x, z] of octagonOutline(r, s)) b.set(x, y - 1, z, dark.planks);
    for (const [x, z] of octagonOutline(r, s)) b.stairs(x, y, z, dark.stairs, { facing: roofStairFacing(x, z) });
  }
  b.set(0, 10, 0, dark.planks);

  b.step('Spitze', 'Setze auf das mittlere Brett einen Schwarzeichenzaun und obendrauf einen gewachsten Blitzableiter als Spitze.');
  b.set(0, 11, 0, dark.fence);
  b.set(0, 12, 0, 'waxed_lightning_rod[facing=up]');
}

function furnishing(b) {
  b.phase('Eingang und Einrichtung', 'Jetzt die Stufen am Eingang, die Sitzbank rundum, ein kleiner Tisch und das Licht.');
  b.step('Eingangsstufe', 'Setze vor den Eingang drei Steinziegeltreppen auf die Wiese, die hohe Seite zur Laube (schau beim Setzen nach Norden).');
  for (let x = -1; x <= 1; x++) b.stairs(x, 1, R + 1, 'stone_brick_stairs', { facing: 'north' });

  b.step('Sitzbank', 'Die Bank läuft innen an Nord-, Ost- und Westseite entlang: Fichtentreppen mit der hohen Seite zum Geländer, also mit dem Rücken nach außen.');
  for (let x = -2; x <= 2; x++) b.stairs(x, 2, -(R - 1), spruce.stairs, { facing: 'north' });
  for (let z = -2; z <= 2; z++) {
    b.stairs(R - 1, 2, z, spruce.stairs, { facing: 'east' });
    b.stairs(-(R - 1), 2, z, spruce.stairs, { facing: 'west' });
  }

  b.step('Tisch und Laterne', 'In die Mitte kommt ein Tisch aus einem Schwarzeichenzaun mit weißem Teppich. Darüber hängt an drei Ketten eine Laterne unter der Dachspitze. Auf das hintere Geländer stellst du zwei Blumentöpfe.');
  b.set(0, 2, 0, dark.fence);
  b.set(0, 3, 0, 'white_carpet');
  hangingLantern(b, { x: 0, y: 9, z: 0, chain: 3 });
  b.set(-1, 3, -R, 'potted_red_tulip');
  b.set(1, 3, -R, 'potted_blue_orchid');
}

function garden(b) {
  b.phase('Ranken und Garten', 'Zum Schluss wird es grün: Ranken an den Pfosten, ein Kiesweg zum Eingang, Blumenbeete, Büsche und eine Birke.', {
    tips: ['Ranken setzt du an die Außenseite eines Stamms; jede Ranke hält an ihrem eigenen Stamm, nicht an der Ranke darüber.'],
  });
  b.step('Ranken', 'Setze an die Außenseiten von fünf Pfosten Ranken, von Ebene 7 direkt unter dem Dach zwei bis drei Blöcke nach unten.');
  const vines = [
    [-4, -2, 'west', 3], [-4, 2, 'west', 2], [2, -4, 'north', 3], [4, 2, 'east', 3], [-2, -4, 'north', 2],
  ];
  const OFFSET = { west: [-1, 0, 'east'], east: [1, 0, 'west'], north: [0, -1, 'south'], south: [0, 1, 'north'] };
  for (const [x, z, side, count] of vines) {
    const [dx, dz, attach] = OFFSET[side];
    for (let i = 0; i < count; i++) b.set(x + dx, 5 - i, z + dz, `vine[${attach}=true]`);
  }

  b.step('Weg', 'Lege einen 3 Blöcke breiten Kiesweg vom Eingang 4 Blöcke nach Süden.');
  path(b, { x: 0, y: 0, z: R + 2, facing: 'south', length: 4, width: 3, mix: 'kies', wiggle: 0, seed: 3 });

  b.step('Hochbeete', 'Links und rechts vom Weg steht je ein Hochbeet, außen 5 × 5 Blöcke: ein Rahmen aus liegenden, geschälten Fichtenstämmen auf der Wiese (Ecken aus Fichtenholz), innen 3 × 3 Grasblöcke auf Höhe des Rahmens. Links kommen rosa Blumen hinein, rechts blaue und weiße – die hohen Blumen nach hinten.');
  for (const bed of BEDS) raisedBed(b, bed);

  b.step('Büsche und Birke', 'Pflanze hinten links eine Birke, an die Seiten Azaleen- und Kirschbüsche und streue Gras und Blumen auf die Wiese.');
  tree(b, { x: -7, y: 1, z: -6, species: 'birke', size: 'mittel', seed: 4 });
  bush(b, { x: 7, y: 1, z: -5, size: 'mittel', leaves: 'azalee', seed: 5 });
  bush(b, { x: -8, y: 1, z: 1, size: 'klein', leaves: 'kirsche', seed: 6 });
  bush(b, { x: 8, y: 1, z: 2, size: 'klein', leaves: 'eiche', seed: 7 });
  vegetation(b, { x: -11, y: 0, z: -11, width: 23, depth: 23, mix: 'wiese', density: 0.3, seed: 8 });
  fixDirtPaths(b, { x1: -11, y1: 0, z1: -11, x2: 11, y2: 0, z2: 11 });
}

export default function build(b) {
  ground(b);
  postsAndRailing(b);
  beams(b);
  roof(b);
  furnishing(b);
  garden(b);
}
