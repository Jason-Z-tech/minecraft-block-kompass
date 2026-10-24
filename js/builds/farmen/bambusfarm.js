// Bambusfarm: zwei Reihen Bambus auf Schlamm, außen je eine Reihe Kolben, darüber Beobachter auf Höhe des vierten Rohrs.
// Wird ein Bambus vier Blöcke hoch, feuert die ganze Reihe: die Kolben schlagen das zweite Rohr ab, alles darüber
// bricht mit, die Stücke fallen auf den Schlamm und die Trichter darunter bringen sie in die Truhe.
// Lokale Koordinaten: Wiese bis y = −1 (Trichter eingelassen auf y = −1), Schlamm y = 0, Bambus ab y = 1.
// Reihe x = 0 … 7: z = 0 und z = 1 Bambus, z = −1 und z = 2 Kolben/Beobachter, z = −2 und z = 3 Redstone.

import { WOOD, terrain, path, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'bambusfarm',
  title: 'Bambusfarm',
  category: 'farmen',
  subtitle: 'Zwei Reihen Bambus, Beobachter und Kolben ernten automatisch',
  tags: ['Farm', 'Bambus', 'Automatisch', 'Redstone', 'Beobachter', 'Kolben', 'Trichter', 'Brennstoff', 'Gerüst', 'Technik'],
  aliases: [
    'bambusfarm', 'bambus farm', 'automatische bambusfarm', 'bambus', 'bamboo farm', 'bamboo', 'automatic bamboo farm',
    'observer bamboo farm', 'bambusfram', 'bamusfarm', 'gerüstfarm', 'brennstofffarm', 'fuel farm',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Sechzehn Bambuspflanzen wachsen in zwei Reihen auf Schlamm. Erreicht ein Bambus seinen vierten Block, sieht ihn der Beobachter auf dieser Höhe, und die acht Kolben seiner Reihe schlagen den zweiten Block ab – alles darüber bricht mit und fällt herunter. Unter dem Schlamm sammeln Trichter jedes Stück ein und füllen die Truhe. Der unterste Block bleibt stehen und wächst einfach nach; du musst nur einmal pflanzen.',
  facts: [
    'Bambus braucht kein Wasser, nur Licht 9 über seiner Spitze – deshalb ist der Schacht nach oben offen.',
    'Schlamm ist nur 14/16 Block hoch: Trichter darunter ziehen alles an, was auf ihm liegt.',
    'Bambus wächst schnell, im Schnitt etwa alle 3 bis 4 Minuten ein Block. Sechzehn Pflanzen bringen so grob 250 Bambus pro Stunde, solange du in der Nähe bist.',
    'Bambus ist ein guter Brennstoff, und aus Bambus und Faden baust du Gerüste.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Bambusfarmen (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Bamboo_farming' },
  ],
  credits: null,
  tested: false,
};

const LENGTH = 8;
const LAST = LENGTH - 1;
const EAST = LENGTH; // Ostwand x = 8
const bamboo = WOOD.bambus;
const BASE = 'mud_bricks';
const CARRIER = 'packed_mud';
// Pfeiler vor den Außenwänden: Ecken und ein Doppelpfeiler in der Mitte
const PILLAR_X = [-1, 3, 4, EAST];

// Beide Seiten sind gleich gebaut: innen = Bambusreihe, mech = Kolben/Beobachter, wire = Redstone
const SIDES = [
  { name: 'Nordseite', inner: 0, mech: -1, wire: -2, face: -3, push: 'south', out: 'north', look: 'nach Süden' },
  { name: 'Südseite', inner: 1, mech: 2, wire: 3, face: 4, push: 'north', out: 'south', look: 'nach Norden' },
];

// Ebene in der Anleitung (unterste Geländeschicht y = −2 ist Ebene 1)
const level = (y) => y + 3;
// Koordinaten in den Texten wie im Ebenen-Plan der Bau-Seite: die Nordwest-Ecke des Geländes ist x = 0, z = 0.
const GROUND_X = -6;
const GROUND_Z = -7;
const px = (x) => x - GROUND_X;
const pz = (z) => z - GROUND_Z;

function ground(b) {
  b.phase('Platz vorbereiten', `Such dir eine flache Wiese von etwa 20 × 16 Blöcken. Die Farm ist 10 Blöcke lang (West–Ost) und 6 Blöcke tief, die Truhe liegt am Ostende im Boden. Die Grasschicht liegt auf Ebene ${level(-1)}. Alle Koordinaten zählen wie im Ebenen-Plan ab der Nordwest-Ecke des Platzes.`, {
    tips: ['Bambus wächst nur, solange du in der Nähe bist (etwa 128 Blöcke). Bau die Farm neben deine Basis.'],
  });
  terrain(b, { x: GROUND_X, y: -2, z: GROUND_Z, width: 20, depth: 16, height: 1, seed: 'bambus' });
}

function collector(b) {
  b.phase('Truhe und Trichter', `Ganz unten liegen zwei Trichterreihen, eingelassen in die Grasschicht (Ebene ${level(-1)}): je acht Trichter unter den späteren Schlammblöcken und einer unter der Ostwand, alle mit der Spitze nach Osten in die Doppeltruhe.`, {
    tips: [
      'Setz zuerst die Truhe. Dann halte Schleichen gedrückt und klicke auf die Westseite der Truhe – der Trichter zeigt in die Truhe. Jeden weiteren Trichter setzt du schleichend an die Westseite des vorigen.',
      'Ein voller Trichter gibt pro Sekunde 2,5 Gegenstände weiter. Zwei Reihen schaffen also auch eine volle Ernte locker.',
    ],
  });
  b.step('Doppeltruhe', `Lass die Doppeltruhe östlich der Farm in den Boden ein (x = ${px(EAST + 1)}, z = ${pz(0)} und ${pz(1)}), die Öffnung nach Osten. Über ihr bleibt Luft, dann öffnest du sie von oben.`);
  b.set(EAST + 1, -1, 0, 'chest[facing=east]');
  b.set(EAST + 1, -1, 1, 'chest[facing=east]');
  b.note(EAST + 1, -1, 1, 'Hier landet der Bambus');
  b.step('Zwei Trichterreihen', `Lege von der Truhe aus zwei Reihen mit je neun Trichtern nach Westen (x = ${px(EAST)} bis ${px(0)}, z = ${pz(0)} und z = ${pz(1)}), jeder mit der Spitze nach Osten in den nächsten.`);
  for (const z of [0, 1]) for (let x = EAST; x >= 0; x--) b.set(x, -1, z, 'hopper[facing=east]');
}

function foundation(b) {
  b.phase('Fundament und Schlamm', 'Rund um die Trichter kommt ein Sockel aus Schlammziegeln, darauf die beiden Reihen Schlamm für den Bambus.', {
    tips: ['Schlamm bekommst du, wenn du eine Wasserflasche auf Erde anwendest. Bambus wächst auch auf Erde oder Gras – nur saugen Trichter durch die nicht hindurch.'],
  });
  b.step('Sockel', `Ersetze auf Ebene ${level(-1)} das Gras rund um die Trichter durch Schlammziegel (x = ${px(-1)} bis ${px(EAST)}, z = ${pz(-2)} bis ${pz(3)}). Mauere auf Ebene ${level(0)} die Reihen z = ${[-2, -1, 2, 3].map(pz).join(', ')} sowie die beiden Stirnseiten (x = ${px(-1)} und ${px(EAST)}).`);
  for (let x = -1; x <= EAST; x++) {
    for (let z = -2; z <= 3; z++) {
      if ((z === 0 || z === 1) && x >= 0) continue;
      b.set(x, -1, z, BASE);
    }
    for (const z of [-2, -1, 2, 3]) b.set(x, 0, z, BASE);
  }
  for (const x of [-1, EAST]) for (const z of [0, 1]) b.set(x, 0, z, BASE);

  b.step('Schlamm', `Lege sechzehn Schlammblöcke direkt auf die Trichter (Ebene ${level(0)}, x = ${px(0)} bis ${px(LAST)}, z = ${pz(0)} und ${pz(1)}).`);
  for (let x = 0; x <= LAST; x++) for (const z of [0, 1]) b.set(x, 0, z, 'mud');
}

function machine(b) {
  b.phase('Kolben, Beobachter und Redstone', `Außen an beiden Reihen steht je eine Erntemaschine: Kolben auf Höhe des zweiten Bambusblocks (Ebene ${level(2)}), Beobachter auf Höhe des vierten (Ebene ${level(4)}), dahinter eine Redstone-Leitung.`, {
    tips: [
      'Ein Kolben zeigt beim Setzen mit dem Kopf zu dir. Ein Beobachter schaut mit dem Gesicht in deine Blickrichtung; der rote Punkt hinten ist sein Ausgang.',
      'Setz den Redstone-Staub vor den Beobachtern, aber erst wenn alle Kolben stehen – dann löst nichts beim Bauen aus.',
    ],
  });
  b.step('Mauer unter den Kolben', `Mauere auf Ebene ${level(1)} die Reihen z = ${[-2, -1, 2, 3].map(pz).join(', ')} mit Schlammziegeln hoch (x = ${px(0)} bis ${px(LAST)}).`);
  for (let x = 0; x <= LAST; x++) for (const z of [-2, -1, 2, 3]) b.set(x, 1, z, BASE);

  for (const side of SIDES) {
    b.step(`Kolben ${side.name}`, `Setz acht normale Kolben auf Ebene ${level(2)} in die Reihe z = ${pz(side.mech)}, den Kopf ${side.look} zum Bambus. Dahinter (z = ${pz(side.wire)}) kommt eine Reihe Lehmziegel.`);
    for (let x = 0; x <= LAST; x++) {
      b.set(x, 2, side.mech, `piston[facing=${side.push}]`);
      b.set(x, 2, side.wire, CARRIER);
    }
  }
  b.note(0, 2, -1, 'Kolben auf Höhe des zweiten Bambusblocks');

  for (const side of SIDES) {
    b.step(`Leitung ${side.name}`, `Streu Redstone-Staub in einer geraden Linie auf die Lehmziegel (Ebene ${level(3)}, z = ${pz(side.wire)}) und setz Schlammziegel auf die Kolben (z = ${pz(side.mech)}). Der Staub versorgt die Lehmziegel darunter, und die schalten die Kolben davor.`);
    for (let x = 0; x <= LAST; x++) {
      b.set(x, 3, side.wire, 'redstone_wire');
      b.set(x, 3, side.mech, BASE);
    }
  }

  for (const side of SIDES) {
    b.step(`Beobachter ${side.name}`, `Setz acht Beobachter auf Ebene ${level(4)} in die Reihe z = ${pz(side.mech)}, Gesicht ${side.look} zum vierten Bambusblock. Schau dazu beim Setzen selbst ${side.look}. Leg dann Lehmziegel auf den Staub dahinter (z = ${pz(side.wire)}): Der Beobachter macht diesen Block stark an, und der gibt das Signal an den Staub darunter weiter.`);
    for (let x = 0; x <= LAST; x++) {
      b.set(x, 4, side.mech, `observer[facing=${side.push}]`);
      b.set(x, 4, side.wire, CARRIER);
    }
  }
  b.note(LAST, 4, 2, 'Beobachter: sieht den vierten Bambusblock');
  b.note(LAST, 3, 3, 'Redstone unter dem Lehmziegel: nimmt den Puls auf');
}

function enclosure(b) {
  b.phase('Schacht, Fassade und Rahmen', 'Glas an den Stirnseiten und ein Kranz aus Bambusholz oben halten herunterfallende Stücke im Schacht. Außen bekommen die langen Wände Bambuspfeiler, einen Sockel, Falltüren vor der Redstone-Fuge und ein kleines Vordach.', {
    tips: ['Über dem Bambus bleibt alles offen: Er braucht Licht von oben, sonst wächst er nicht.'],
  });
  b.step('Stirnseiten', `Schließe die beiden Stirnseiten (x = ${px(-1)} und x = ${px(EAST)}) von Ebene ${level(1)} bis ${level(5)}: vor den Bambusreihen (z = ${pz(0)} und ${pz(1)}) Glas, sonst Bambusmosaik (z = ${[-2, -1, 2, 3].map(pz).join(', ')}).`);
  for (const x of [-1, EAST]) {
    for (let y = 1; y <= 5; y++) {
      b.set(x, y, 0, 'glass');
      b.set(x, y, 1, 'glass');
      for (const z of [-2, -1, 2, 3]) b.set(x, y, z, bamboo.mosaic);
    }
  }

  b.step('Kranz', `Leg oben auf Ebene ${level(5)} einen Kranz aus liegenden, geschälten Bambusblöcken auf die Beobachter und die Lehmziegel (z = ${[-2, -1, 2, 3].map(pz).join(', ')}, x = ${px(0)} bis ${px(LAST)}).`);
  for (let x = 0; x <= LAST; x++) {
    for (const z of [-2, -1, 2, 3]) b.set(x, 5, z, 'stripped_bamboo_block[axis=x]');
  }

  for (const side of SIDES) {
    const toWall = side.push;
    b.step(`Fassade ${side.name}`, `Stell vor die ${side.name} (z = ${pz(side.face)}) Pfeiler aus Bambusblöcken von Ebene ${level(0)} bis ${level(6)}: an den Ecken (x = ${px(-1)} und ${px(EAST)}) und als Doppelpfeiler in der Mitte (x = ${px(3)} und ${px(4)}). Dazwischen kommen unten Schlammziegeltreppen als Sockel (hohe Seite zur Wand), auf Ebene ${level(3)} offene Bambusfalltüren flach an der Wand – sie verdecken die Redstone-Fuge – und auf Ebene ${level(5)} umgedrehte Bambusmosaiktreppen als Vordach.`);
    for (const x of PILLAR_X) for (let y = 0; y <= 6; y++) b.set(x, y, side.face, `${bamboo.log}[axis=y]`);
    for (let x = 0; x <= LAST; x++) {
      if (PILLAR_X.includes(x)) continue;
      b.set(x, 0, side.face, `mud_brick_stairs[facing=${toWall},half=bottom]`);
      b.set(x, 3, side.face, `${bamboo.trapdoor}[facing=${side.out},half=bottom,open=true]`);
      b.set(x, 5, side.face, `${bamboo.mosaicStairs}[facing=${toWall},half=top]`);
    }
  }

  b.step('Laternen', `Stell auf jeden der acht Pfeiler eine Laterne (Ebene ${level(7)}).`);
  for (const side of SIDES) for (const x of PILLAR_X) b.set(x, 7, side.face, 'lantern[hanging=false]');
}

function plant(b) {
  b.phase('Bambus pflanzen', `Pflanze jetzt, solange die Stirnseiten noch offen sind: Geh von Westen in den zwei Blöcke breiten Gang zwischen den beiden Maschinen, fang ganz hinten am Ostende an und setz auf beide Schlammreihen je ein Stück Bambus (Ebene ${level(1)}), während du rückwärts nach Westen hinausgehst. Von oben erreichst du den Schlamm später nicht mehr.`, {
    tips: [
      'Pflanze erst, wenn die Beobachter stehen. Ein Beobachter meldet nur Änderungen: Wächst ein Bambus schon vorher über den vierten Block hinaus, sieht er ihn nicht mehr wachsen.',
      'Gepflanzter Bambus ist erst ein kleiner Setzling und wird bald ein richtiger Stamm. Mit Knochenmehl geht es schneller.',
      'Feuert eine Reihe, verlieren auch die kürzeren Pflanzen ihren zweiten Block. Das ist normal: Der unterste Block bleibt immer stehen.',
    ],
  });
  for (let x = 0; x <= LAST; x++) for (const z of [0, 1]) b.set(x, 1, z, 'bamboo[age=0,leaves=none,stage=0]');
  b.note(3, 1, 0, 'Der unterste Bambusblock bleibt immer stehen');
}

function surroundings(b) {
  b.phase('Umgebung', 'Ein Weg führt zur Truhe, ringsum wachsen Farne und Büsche wie am Rand eines Dschungels, eine Azalee blüht in der Ecke.');
  path(b, { x: EAST + 2, y: -1, z: 1, facing: 'east', length: 3, width: 3, mix: 'gemischt', wiggle: 0.5, seed: 5 });
  bush(b, { x: -4, y: 0, z: 5, size: 'mittel', leaves: 'dschungel', seed: 1 });
  bush(b, { x: 12, y: 0, z: -5, size: 'klein', leaves: 'dschungel', seed: 8 });
  bush(b, { x: -4, y: 0, z: -5, size: 'klein', leaves: 'azalee', seed: 3 });
  vegetation(b, { x: -6, y: -1, z: -7, width: 20, depth: 16, mix: 'farn', density: 0.35, seed: 14 });
}

export default function build(b) {
  ground(b);
  collector(b);
  foundation(b);
  machine(b);
  plant(b);
  enclosure(b);
  surroundings(b);
}
