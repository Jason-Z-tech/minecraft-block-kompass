// Nachtlicht mit Tageslichtsensor: Gartenweg mit sechs Bodenleuchten (Redstone-Lampen bündig in der Wegeinfassung), die ein
// invertierter Tageslichtsensor nachts einschaltet. Der Sensor liegt unter einem Glasblock mitten im Sitzplatz, alle Leitungen
// eine Ebene unter dem Boden. Bau-Rahmen: Sitzplatz x −3 … 3, z −4 … 0; Weg x −1 … 1, z 1 … 12; Einfassung mit Lampen x = ±2;
// Gartenzaun x −8 … 8, z −6 … 13 (Tor bei x = 0). Boden y = 0, Leitungen y = −1 auf glattem Stein y = −2.
//
// Signalweg (y = −1, Ostseite; Westseite gespiegelt):
//   Sensor (0, −1, −2) → Verstärker (1, −1, −2), Eingang Westen → Staub (2, −1, −2 … 0) → Verstärker (2, −1, 1), Eingang Norden
//   → glatter Stein (2, −1, 2) stark versorgt → Lampe darüber (2, 0, 2) und Staub dahinter (2, −1, 3 … 4) → Verstärker (2, −1, 5)
//   → Stein (2, −1, 6) → Lampe (2, 0, 6) → Staub (7 … 8) → Verstärker (2, −1, 9) → Stein (2, −1, 10) → Lampe (2, 0, 10).
// Der erste Verstärker macht aus jedem schwachen Sensorsignal (in der Dämmerung schon ab Stärke 1) wieder Stärke 15.

import { WOOD, gardenFence, terrain, flowerBed, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'nachtlicht-sensor',
  title: 'Nachtlicht mit Tageslichtsensor',
  category: 'redstone',
  subtitle: 'Gartenweg mit Bodenleuchten, die nachts von selbst angehen – Sensor und Leitungen unsichtbar im Boden',
  tags: ['Redstone', 'Tageslichtsensor', 'Nachtlicht', 'Redstone-Lampe', 'Automatisch', 'Garten', 'Weg', 'Beleuchtung', 'Verstärker', 'Anfänger'],
  aliases: [
    'nachtlicht', 'nacht licht', 'tageslichtsensor', 'tageslicht sensor', 'daylight sensor', 'daylight detector', 'night light',
    'automatic lights', 'automatische lampen', 'automatisches licht', 'lampen nachts an', 'bodenleuchten', 'wegbeleuchtung',
    'gartenbeleuchtung', 'redstone lampe nachts', 'inverted daylight sensor', 'tageslichtsenor', 'tagessensor', 'lichtsensor',
  ],
  accuracy: 'vorlage',
  difficulty: 2,
  description: 'Ein Gartenweg mit sechs Redstone-Lampen, die bündig in der steinernen Einfassung liegen und nachts von selbst angehen. Gesteuert werden sie von einem Tageslichtsensor im invertierten Modus: Er liegt unter einem Glasblock mitten im Sitzplatz am Ende des Wegs und gibt ein Signal, sobald es dunkel wird. Alle Leitungen laufen eine Ebene unter dem Boden; Verstärker frischen das Signal vor jeder Lampe wieder auf. Ein Gartenzaun mit Tor und Laternen, Blumenbeete und eine Bank machen daraus einen fertigen Garten.',
  facts: [
    'Invertierter Sensor: Er gibt 15 minus das Himmelslicht aus – tagsüber 0, in klarer Nacht 11. Schon in der Dämmerung kommt Stärke 1, und der erste Verstärker macht daraus 15.',
    'Bei Regen und Gewitter wird das Himmelslicht schwächer – dann gehen die Lampen auch tagsüber an.',
    'Glas lässt das Himmelslicht ungeschwächt durch: Unter einem Glasblock arbeitet der Sensor wie unter freiem Himmel. Ein Laubdach oder ein anderer Block darüber würde ihn dagegen dauerhaft einschalten.',
    'Ein Rechtsklick schaltet den Sensor zwischen normal und invertiert um; invertiert sind seine Felder blau.',
    'Redstone-Staub versorgt nur den Block unter sich und den, auf den er zeigt – nicht den darüber. Darum liegt unter jeder Lampe ein Steinblock, den ein Verstärker von der Seite stark versorgt.',
    'Nicht im Spiel getestet: die Schaltung folgt den Beschreibungen von Tageslichtsensor, Verstärker und Redstone-Lampe im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Daylight Detector', url: 'https://minecraft.wiki/w/Daylight_Detector' },
    { title: 'Minecraft Wiki: Redstone Repeater', url: 'https://minecraft.wiki/w/Redstone_Repeater' },
    { title: 'Minecraft Wiki: Redstone Lamp', url: 'https://minecraft.wiki/w/Redstone_Lamp' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const GROUND = { x: -9, z: -7, width: 19, depth: 23 };
const PLAZA = { x1: -3, x2: 3, z1: -4, z2: 0 };
const PATH = { x1: -1, x2: 1, z1: 1, z2: 12 };
const EDGE_X = 2;
const SENSOR = { x: 0, y: -1, z: -2 };
const LAMP_Z = [2, 6, 10];
const FENCE = { x: -8, z: -6, width: 17, depth: 20 };
const CARRIER = 'smooth_stone';
// Nachtzustand: Sensor gibt 11 aus, alle Verstärker an, Lampen leuchten.
const repeater = (facing) => `repeater[delay=1,facing=${facing},locked=false,powered=true]`;
const wire = (power) => `redstone_wire[power=${power}]`;

// Leitung einer Seite (side = 1 Osten, −1 Westen) von der Ecke am Sitzplatz bis zur letzten Lampe.
function sideLine(side) {
  const x = EDGE_X * side;
  const cells = [];
  cells.push([x, -2, wire(15)], [x, -1, wire(14)], [x, 0, wire(13)]);
  for (const lampZ of LAMP_Z) {
    cells.push([x, lampZ - 1, repeater('north')], [x, lampZ, CARRIER]);
    if (lampZ !== LAMP_Z[LAMP_Z.length - 1]) cells.push([x, lampZ + 1, wire(15)], [x, lampZ + 2, wire(14)]);
  }
  return cells;
}

function site(b) {
  b.phase('Bauplatz', `Such dir ein ebenes Stück Wiese von ${GROUND.width} × ${GROUND.depth} Blöcken. Der Weg läuft von Süden (Gartentor) nach Norden zum Sitzplatz.`, {
    tips: ['Markier dir zuerst die Mitte des Sitzplatzes: Dort liegt später der Sensor unter Glas. Von ihr aus zählst du alles ab.'],
  });
  b.step('Wiese', 'Die Wiese, auf der der Garten entsteht.');
  terrain(b, { x: GROUND.x, y: -2, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 2, seed: 'nachtlicht' });
}

function trench(b) {
  b.phase('Graben und Sensor', 'Die ganze Technik liegt eine Ebene unter dem Gras. Zuerst gräbst du die Gräben und legst sie mit glattem Stein aus, dann kommt der Sensor in die Mitte.', {
    tips: [
      'Die Gräben sind zwei Ebenen tief: Unten liegt die Leitung auf glattem Stein, die obere Ebene schließt du am Ende wieder mit Einfassung, Lampen und Sitzplatz.',
      'Ein Rechtsklick auf den Tageslichtsensor schaltet ihn um. Invertiert hat er blaue Felder und gibt nachts Strom statt tagsüber.',
    ],
  });
  b.step('Gräben', 'Grab einen Querstreifen durch die Mitte des späteren Sitzplatzes (5 Blöcke von West nach Ost) und von seinen Enden aus zwei Gräben nach Süden, 2 Blöcke links und rechts der Wegmitte, bis unter die letzte Lampe (13 Blöcke lang). Grab alle Gräben zwei Blöcke tief und ersetz den Boden darunter durch glatten Stein.');
  // Graben = Gras und Erde darunter heraus (y 0 und −1); die obere Ebene schließt das Kapitel „Lampen, Weg und Sitzplatz“.
  const dig = (x, z) => {
    b.set(x, -2, z, CARRIER);
    b.remove(x, -1, z);
    b.remove(x, 0, z);
  };
  for (let x = -EDGE_X; x <= EDGE_X; x++) dig(x, SENSOR.z);
  for (const side of [-1, 1]) {
    for (let z = SENSOR.z; z <= LAMP_Z[LAMP_Z.length - 1]; z++) dig(EDGE_X * side, z);
  }

  b.step('Tageslichtsensor', 'Setz den Tageslichtsensor in die Mitte des Querstreifens und klick ihn einmal mit Rechtsklick an, damit er invertiert ist (blaue Felder).');
  b.set(SENSOR.x, SENSOR.y, SENSOR.z, 'daylight_detector[inverted=true,power=11]');
  b.note(SENSOR.x, SENSOR.y, SENSOR.z, 'Tageslichtsensor, invertiert (Rechtsklick): gibt nachts Strom');
}

function wiring(b) {
  b.phase('Leitungen', 'Jetzt verlegst du die Leitungen in den Gräben. Unter jede spätere Lampe kommt ein glatter Stein, den ein Verstärker von Norden her stark versorgt – nur so springt das Signal nach oben in die Lampe und gleichzeitig weiter nach Süden.', {
    tips: [
      'Verstärker setzt du mit dem Blick in Signalrichtung: Für die beiden ersten schaust du vom Sensor weg nach außen, für alle anderen nach Süden. Der Pfeil auf dem Verstärker zeigt dann weg vom Sensor.',
      'Lass die Verstärker auf der kürzesten Verzögerung (nicht anklicken).',
      'Der Staub darf nur in den Gräben liegen. Liegt er irgendwo direkt neben einer Lampe auf gleicher Höhe, schaltet er sie mit.',
    ],
  });
  b.step('Verstärker am Sensor', 'Links und rechts direkt neben den Sensor kommt je ein Verstärker, der vom Sensor wegzeigt: Der östliche bekommt sein Signal von Westen, der westliche von Osten.');
  b.set(SENSOR.x + 1, -1, SENSOR.z, repeater('west'));
  b.set(SENSOR.x - 1, -1, SENSOR.z, repeater('east'));
  b.note(SENSOR.x + 1, -1, SENSOR.z, 'Verstärker: macht aus dem schwachen Dämmerungssignal wieder Stärke 15');

  b.step('Ostleitung', 'Im östlichen Graben: drei Felder Staub (um die Ecke nach Süden), dann ein Verstärker mit Eingang im Norden, ein glatter Stein unter der ersten Lampe, zwei Felder Staub, wieder Verstärker und Stein unter der zweiten Lampe, zwei Felder Staub, Verstärker und Stein unter der dritten Lampe.');
  for (const [x, z, state] of sideLine(1)) b.set(x, -1, z, state);
  b.note(EDGE_X, -1, LAMP_Z[0], 'Glatter Stein unter der Lampe: vom Verstärker stark versorgt, gibt den Strom an Lampe und Staub weiter');

  b.step('Westleitung', 'Im westlichen Graben genauso, spiegelbildlich.');
  for (const [x, z, state] of sideLine(-1)) b.set(x, -1, z, state);
}

function surface(b) {
  b.phase('Lampen, Weg und Sitzplatz', 'Jetzt schließt du den Boden über der Technik: Lampen über die Steinblöcke, ein Glasblock über den Sensor, dann Sitzplatz, Weg und Einfassung.', {
    tips: [
      'Über dem Sensor muss Glas liegen, kein anderer Block – sonst sieht er den Himmel nicht und schaltet die Lampen dauerhaft ein.',
      'Halte über dem Glas den Himmel frei: keine Bäume, kein Dach.',
    ],
  });
  b.step('Lampen', 'Setz auf jeden glatten Stein in den Gräben eine Redstone-Lampe, bündig mit dem Gras (6 Lampen, je 4 Blöcke auseinander).');
  for (const side of [-1, 1]) for (const z of LAMP_Z) b.set(EDGE_X * side, 0, z, 'redstone_lamp[lit=true]');

  b.step('Sitzplatz mit Sensorfenster', 'Der Sitzplatz (7 × 5) bekommt einen Boden aus poliertem Andesit mit einem Rand aus Steinziegeln. In die Mitte über den Sensor kommt ein Glasblock, ringsum gemeißelte Steinziegel als Rahmen.');
  b.fill(PLAZA.x1, 0, PLAZA.z1, PLAZA.x2, 0, PLAZA.z2, 'stone_bricks');
  b.fill(PLAZA.x1 + 1, 0, PLAZA.z1 + 1, PLAZA.x2 - 1, 0, PLAZA.z2 - 1, 'polished_andesite');
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.set(SENSOR.x + dx, 0, SENSOR.z + dz, 'chiseled_stone_bricks');
  b.set(SENSOR.x, 0, SENSOR.z, 'glass');
  b.note(SENSOR.x, 0, SENSOR.z, 'Glas über dem Sensor: lässt das Himmelslicht durch');

  b.step('Weg und Einfassung', 'Der Weg ist 3 Blöcke breit und 12 lang, aus Erdpfad (Gras mit der Schaufel bearbeiten). Die Einfassung links und rechts – über den Gräben – legst du aus Steinziegeln, ein paar bemooste dazwischen.');
  for (let z = PATH.z1; z <= PATH.z2; z++) {
    for (let x = PATH.x1; x <= PATH.x2; x++) b.set(x, 0, z, b.chance(0.12) ? 'coarse_dirt' : 'dirt_path');
    for (const side of [-1, 1]) {
      if (LAMP_Z.includes(z)) continue;
      b.set(EDGE_X * side, 0, z, b.chance(0.3) ? 'mossy_stone_bricks' : 'stone_bricks');
    }
  }
}

function seating(b) {
  b.phase('Bank und Hecke', 'Am Nordrand des Sitzplatzes steht eine Bank aus Fichtentreppen vor einer Hecke – hier sitzt du abends und siehst die Lampen angehen.', {
    tips: ['Die Bank-Treppen setzt du mit dem Blick nach Norden: Dann liegt die Lehne hinten an der Hecke.'],
  });
  b.step('Bank', 'Drei Fichtentreppen am Nordrand des Sitzplatzes, Lehne nach Norden; an den Enden je ein Blumentopf mit Farn.');
  for (let x = -1; x <= 1; x++) b.stairs(x, 1, PLAZA.z1, spruce.stairs, { facing: 'north' });
  b.set(-2, 1, PLAZA.z1, 'potted_fern');
  b.set(2, 1, PLAZA.z1, 'potted_fern');

  b.step('Hecke', 'Hinter der Bank eine Hecke aus Eichenlaub, 9 Blöcke breit und 2 hoch.');
  b.fill(PLAZA.x1 - 1, 1, PLAZA.z1 - 1, PLAZA.x2 + 1, 2, PLAZA.z1 - 1, 'oak_leaves[distance=7,persistent=true,waterlogged=false]');
}

function garden(b) {
  b.phase('Garten', 'Zum Schluss der Gartenzaun mit Tor und Laternen, Blumenbeete links und rechts des Wegs, zwei Birken und ein paar Büsche.');
  b.step('Gartenzaun', 'Ein Fichtenzaun rund um den Garten, im Süden mittig ein Tor zwischen zwei geschälten Fichtenstämmen mit Laternen.');
  gardenFence(b, { x: FENCE.x, y: 1, z: FENCE.z, width: FENCE.width, depth: FENCE.depth, fence: spruce.fence, gate: spruce.fenceGate, posts: spruce.strippedLog, lanterns: true });

  b.step('Blumenbeete', 'Links und rechts neben der Wegeinfassung je ein Beet (3 Blöcke breit, 11 lang) mit blauen und weißen Blumen – die leuchten im Lampenlicht besonders schön.');
  flowerBed(b, { x: EDGE_X + 1, y: 0, z: PATH.z1, width: 3, depth: 11, facing: 'west', palette: 'kuehl', seed: 2 });
  flowerBed(b, { x: -EDGE_X - 3, y: 0, z: PATH.z1, width: 3, depth: 11, facing: 'east', palette: 'kuehl', seed: 3 });

  b.step('Bäume und Büsche', 'Zwei kleine Birken in den hinteren Ecken, Büsche neben dem Sitzplatz und am Tor.');
  tree(b, { x: -6, y: 1, z: -3, species: 'birke', size: 'klein', seed: 4 });
  tree(b, { x: 6, y: 1, z: -3, species: 'birke', size: 'klein', seed: 5 });
  bush(b, { x: -6, y: 1, z: 10, size: 'klein', leaves: 'azalee', seed: 6 });
  bush(b, { x: 6, y: 1, z: 10, size: 'klein', leaves: 'eiche', seed: 7 });

  b.step('Wiese', 'Etwas hohes Gras und Wildblumen auf der restlichen Wiese.');
  vegetation(b, { x: GROUND.x, y: 0, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.25, seed: 8 });
}

export default function build(b) {
  site(b);
  trench(b);
  wiring(b);
  surface(b);
  seating(b);
  garden(b);
}
