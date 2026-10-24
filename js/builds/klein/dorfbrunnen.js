// Dorfbrunnen: runder Steinbrunnen mit Wasser, Satteldach auf vier Fichtenpfosten, Seilwinde mit Kurbel.
// Mitte des Brunnens bei (0, 0); Wiese auf y = 0, Brunnenmauer ab y = 1, Vorderseite = Süden.

import { WOOD, lampPost, terrain, path, fixDirtPaths, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'dorfbrunnen',
  title: 'Dorfbrunnen',
  category: 'klein',
  subtitle: 'Runder Steinbrunnen mit Satteldach und Seilwinde',
  tags: ['Brunnen', 'Dorf', 'Mittelalter', 'Deko', 'Wasser', 'Dorfplatz', 'Klein', 'Anfänger'],
  aliases: [
    'brunnen', 'dorfbrunnen', 'dorf brunnen', 'ziehbrunnen', 'steinbrunnen', 'wunschbrunnen', 'brunen', 'dorfbrunen',
    'well', 'village well', 'wishing well', 'medieval well', 'stone well', 'mittelalter brunnen',
  ],
  accuracy: 'eigenes',
  difficulty: 1,
  description: 'Ein runder Brunnen aus Bruchstein mit Wasser im Schacht, darüber ein kleines Satteldach aus Fichte auf vier Pfosten. Unter dem First läuft die Seilwinde mit Kette, außen sitzt ein Hebel als Kurbel. Ein Pflasterring, eine Laterne, Fass und Wasserkessel machen ihn zum Mittelpunkt eines Dorfplatzes.',
  facts: [
    'Der Brunnenring hat 7 Blöcke Durchmesser, das Wasser darin 5 Blöcke.',
    'Das Wasser ist 2 Blöcke tief und besteht nur aus Wasserquellen – es fließt nichts aus.',
    'Ein Hebel an der Giebelseite sieht aus wie die Kurbel der Seilwinde.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const WATER = 'water[level=0]';
const RING_RADIUS = 3;
const WATER_RADIUS = 2;
const POSTS = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
// Pflasterfelder, auf denen später Fass und Kessel stehen (dort kein Trampelpfad).
const UNDER_OBJECTS = new Set(['4,1', '4,-1']);

// Abstand ≤ r + 0,5 wie bei b.disc (Mittelpunkt-Regel aus ARCHITEKTUR §6.2).
const inDisc = (x, z, r) => Math.hypot(x, z) <= r + 0.5;

function ground(b) {
  b.phase('Boden und Pflaster', 'Such dir eine flache Wiese. Der Brunnen steht in einem Pflasterring mit 11 Blöcken Durchmesser. Grabe in der Mitte ein rundes Loch mit 7 Blöcken Durchmesser und 3 Blöcken Tiefe für den Schacht.', {
    tips: [
      'Den Rasen musst du nicht neu legen – er zeigt nur, wo das Pflaster aufhört.',
      'Mische Bruchstein, bemoosten Bruchstein, Kies und Trampelpfad unregelmäßig, dann wirkt der Platz alt und belebt.',
    ],
  });
  terrain(b, { x: -8, y: -1, z: -8, width: 17, depth: 17, height: 1, shape: 'rund', seed: 'brunnen' });
  b.disc(0, -2, 0, RING_RADIUS + 1, 'dirt');
  for (let x = -5; x <= 5; x++) {
    for (let z = -5; z <= 5; z++) {
      if (!inDisc(x, z, 5) || inDisc(x, z, RING_RADIUS)) continue;
      // Am Rand des Pflasters mehr Kies und Trampelpfad, innen mehr Stein.
      if (UNDER_OBJECTS.has(`${x},${z}`)) {
        b.set(x, 0, z, 'cobblestone');
        continue;
      }
      const outer = Math.hypot(x, z) > 4.3;
      b.set(x, 0, z, b.pickWeighted(outer
        ? [['cobblestone', 3], ['gravel', 3], ['dirt_path', 3], ['mossy_cobblestone', 2], ['grass_block', 2]]
        : [['cobblestone', 5], ['mossy_cobblestone', 3], ['gravel', 2], ['stone', 1]]));
    }
  }
}

function shaft(b) {
  b.phase('Brunnenschacht und Mauer', 'Der Schacht ist innen 5 Blöcke breit und rund, die Mauer ist einen Block dick.');
  b.step('Schacht ausmauern', 'Lege den Boden des Lochs (Ebene 1) mit bemoostem Bruchstein aus und mauere die Schachtwand ringsum bis zur Wiese hoch (Ebene 1 bis 3). Setze erst die vier geraden Stücke mit je 3 Blöcken, dann die Ecken dazwischen.');
  b.disc(0, -2, 0, WATER_RADIUS, 'mossy_cobblestone');
  for (let y = -2; y <= 0; y++) b.cylinder(0, y, 0, RING_RADIUS, 1, y === -2 ? 'mossy_cobblestone' : 'cobblestone', { hollow: true });

  b.step('Brunnenmauer', 'Die Mauer über der Wiese ist eine Ebene hoch (Ebene 4). Mische Bruchstein mit etwas bemoostem Bruchstein und Steinziegeln.');
  for (let x = -RING_RADIUS; x <= RING_RADIUS; x++) {
    for (let z = -RING_RADIUS; z <= RING_RADIUS; z++) {
      if (!inDisc(x, z, RING_RADIUS) || inDisc(x, z, WATER_RADIUS)) continue;
      b.set(x, 1, z, b.pickWeighted([['cobblestone', 5], ['mossy_cobblestone', 3], ['stone_bricks', 2]]));
    }
  }

  b.step('Abdeckung', 'Lege oben auf die Mauer untere Steinziegelstufen (Ebene 5). Lass die vier Felder frei, auf denen gleich die Pfosten stehen: je zwei Blöcke von der Mitte nach links/rechts und nach vorne/hinten.');
  for (let x = -RING_RADIUS; x <= RING_RADIUS; x++) {
    for (let z = -RING_RADIUS; z <= RING_RADIUS; z++) {
      if (!inDisc(x, z, RING_RADIUS) || inDisc(x, z, WATER_RADIUS)) continue;
      if (POSTS.some(([px, pz]) => px === x && pz === z)) continue;
      b.slab(x, 2, z, 'stone_brick_slab', { type: 'bottom' });
    }
  }

  b.step('Wasser einfüllen', 'Fülle den Schacht mit Wassereimern: unten und oben je 21 Quellen. Gieß zuerst die untere Lage, dann die obere – so entstehen keine fließenden Ränder.');
  b.disc(0, -1, 0, WATER_RADIUS, WATER);
  b.disc(0, 0, 0, WATER_RADIUS, WATER);
}

function frame(b) {
  b.phase('Dachgestell', 'Vier Pfosten tragen einen Balkenkranz, auf dem das Dach liegt.');
  b.step('Pfosten', 'Stelle auf die vier freien Felder der Mauer je 3 Fichtenstämme übereinander (Ebene 5 bis 7).');
  for (const [x, z] of POSTS) b.fill(x, 2, z, x, 4, z, `${spruce.log}[axis=y]`);

  b.step('Balkenkranz', 'Lege auf Ebene 8 geschälte Fichtenstämme liegend von Pfosten zu Pfosten: vorne und hinten in Ost-West-Richtung, links und rechts in Nord-Süd-Richtung. Schau beim Setzen in die Richtung, in die der Balken laufen soll.');
  for (const z of [-2, 2]) b.fill(-2, 5, z, 2, 5, z, `${spruce.strippedLog}[axis=x]`);
  for (const x of [-2, 2]) b.fill(x, 5, -1, x, 5, 1, `${spruce.strippedLog}[axis=z]`);
}

function roof(b) {
  b.phase('Dach', 'Ein Satteldach aus Fichtentreppen mit First in Ost-West-Richtung, an jeder Seite einen Block Überstand. Die Giebel über den seitlichen Balken füllst du mit Fichtenbrettern.', {
    tips: ['Setze jede Treppenreihe von außen nach innen und schau dabei zur Firstmitte – dann zeigt die hohe Seite automatisch nach oben zur Mitte.'],
  });
  b.roof({ x1: -2, z1: -2, x2: 2, z2: 2, y: 5, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
}

function winch(b) {
  b.phase('Seilwinde und Kurbel', 'Jetzt kommt die Seilwinde unter den First.');
  b.step('Welle', 'Ersetze in beiden Giebeln das mittlere Brett auf Ebene 9 durch einen liegenden Fichtenstamm und verbinde sie mit drei weiteren Stämmen zu einer durchgehenden Welle in Ost-West-Richtung.');
  b.fill(-2, 6, 0, 2, 6, 0, `${spruce.log}[axis=x]`);

  b.step('Seil und Kurbel', 'Hänge unter die Mitte der Welle drei Eisenketten nach unten – das ist das Brunnenseil. Setze an die Ostseite der Welle außen einen Hebel: er sieht aus wie die Kurbel. Unter den vorderen Balken kommt eine hängende Laterne.');
  b.fill(0, 3, 0, 0, 5, 0, 'iron_chain[axis=y]');
  b.set(3, 6, 0, 'lever[face=wall,facing=east,powered=false]');
  b.set(0, 4, 2, 'lantern[hanging=true]');
  b.note(3, 6, 0, 'Hebel als Kurbel der Seilwinde');
}

function surroundings(b) {
  b.phase('Rund um den Brunnen', 'Zum Schluss der Dorfplatz: eine Laterne, ein Fass, ein Wasserkessel, ein Weg nach Süden und etwas Grün.', {
    tips: ['Den Wasserkessel füllst du mit einem Wassereimer – er sieht aus wie ein gefüllter Eimer, der gerade hochgezogen wurde.'],
  });
  b.step('Laterne, Fass und Kessel', 'Stelle vorne links am Rand des Pflasters einen Laternenpfahl: ein bemooster Bruchstein als Sockel, darauf drei Fichtenzäune, oben ein Zaun als Arm nach Osten, darunter die hängende Laterne. Östlich vom Brunnen kommen ein Fass und ein gefüllter Wasserkessel.');
  lampPost(b, { x: -4, y: 1, z: 5, facing: 'east', height: 4, post: spruce.fence, base: 'mossy_cobblestone', style: 'arm' });
  b.set(4, 1, 1, 'barrel[facing=up,open=false]');
  b.set(4, 1, -1, 'water_cauldron[level=3]');

  b.step('Weg und Grün', 'Lege einen Trampelpfad nach Süden, setze zwei kleine Büsche und streue Gras und Blumen auf die Wiese.');
  path(b, { x: 0, y: 0, z: 5, facing: 'south', length: 3, width: 3, mix: 'erde', wiggle: 0.5, seed: 2 });
  bush(b, { x: -6, y: 1, z: -3, size: 'klein', leaves: 'eiche', seed: 1 });
  bush(b, { x: 5, y: 1, z: -5, size: 'klein', leaves: 'azalee', seed: 4 });
  vegetation(b, { x: -8, y: 0, z: -8, width: 17, depth: 17, mix: 'blumen', density: 0.35, seed: 5 });
  fixDirtPaths(b, { x1: -8, y1: 0, z1: -8, x2: 8, y2: 0, z2: 8 });
}

export default function build(b) {
  ground(b);
  shaft(b);
  frame(b);
  roof(b);
  winch(b);
  surroundings(b);
}
