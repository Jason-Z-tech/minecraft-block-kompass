// Windmühle – runde Turmwindmühle aus Stein mit Galerie, Kegelkappe aus Schwarzeiche und vier Flügeln.
// Rahmen: Turmmitte bei (0, 0), Flügelkreuz an der Südseite (+z), Tür im Westen; Wiese auf y = 0.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, doorway, lightRoom, tree, bush, path, flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'windmuehle',
  title: 'Windmühle',
  category: 'mittelalter',
  subtitle: 'Runde Turmwindmühle aus Stein mit Galerie und Flügelkreuz',
  tags: ['Mittelalter', 'Dorf', 'Mühle', 'Windmühle', 'Turm', 'Landwirtschaft', 'Feld', 'Rund'],
  aliases: [
    'windmühle', 'windmuehle', 'windmuhle', 'windmüle', 'wind mühle', 'mühle', 'muehle', 'turmwindmühle', 'turmmühle',
    'getreidemühle', 'kornmühle', 'steinmühle', 'windmill', 'wind mill', 'tower mill', 'medieval windmill', 'stone windmill',
    'minecraft windmühle',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Eine runde Turmwindmühle: unten ein Bruchsteinturm mit 11 Blöcken Durchmesser, darüber ein schlankerer Steinziegelturm mit Galerie, obenauf eine kegelförmige Kappe aus Schwarzeiche. Vier Flügel mit Zaunrahmen und weißer Wollbespannung drehen sich vor der Südseite. Innen geht es über Leitern vom Mehllager mit der Mehlrutsche zum Mahlboden mit den Mühlsteinen, weiter zum Kornboden und bis in die Kappe mit Kammrad und Flügelwelle; daneben liegt ein kleines Weizenfeld.',
  facts: [
    'Turm unten 11 Blöcke, oben 9 Blöcke Durchmesser; mit Kappe 21 Blöcke hoch, mit den Flügeln 26.',
    'Jeder Flügel ist 9 Blöcke lang: ein Balken aus Schwarzeiche, daneben ein 3 breites Segel aus Zaun und Wolle.',
    'Die Mehlrutsche aus Trichtern funktioniert im Spiel: was du oben in den Trichter wirfst, landet unten im Fass.',
    'Der Weizen wächst, weil das Wasser in der Feldmitte höchstens 2 Blöcke von jedem Ackerboden entfernt ist.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

// Turm: unten Radius 5 (Ebenen 1 … 5), oben Radius 4 (6 … 13); Böden auf 5, 10 und 14 (Kappe).
const LOW_R = 5;
const HIGH_R = 4;
const LOW_TOP = 5;
const HIGH_TOP = 13;
const CAP_Y = 14;
const HUB = { y: 16, z: 7 };
const ARM = 9;

const key = (x, z) => `${x},${z}`;

// Kreisfläche: alle Felder mit Abstand ≤ r + 0,5 zur Mitte (wie b.disc).
function discCells(r) {
  const cells = [];
  const n = Math.ceil(r + 0.5);
  for (let z = -n; z <= n; z++) for (let x = -n; x <= n; x++) if (Math.hypot(x, z) <= r + 0.5) cells.push([x, z]);
  return cells;
}

// Rand der Kreisfläche: Felder, die seitlich an ein Feld außerhalb grenzen (dicht, wie ein hohler Zylinder).
function ringCells(r) {
  const inside = new Set(discCells(r).map(([x, z]) => key(x, z)));
  return discCells(r).filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inside.has(key(x + dx, z + dz))));
}

function innerCells(r) {
  const ring = new Set(ringCells(r).map(([x, z]) => key(x, z)));
  return discCells(r).filter(([x, z]) => !ring.has(key(x, z)));
}

// Treppe mit der hohen Seite zur Turmmitte.
function facingToCenter(x, z) {
  if (Math.abs(x) >= Math.abs(z)) return x > 0 ? 'west' : 'east';
  return z > 0 ? 'north' : 'south';
}

function lowerStone(x, y, z) {
  const h = hashPosition(x, y, z, 913) % 20;
  if (y <= 2 && h < 7) return 'mossy_cobblestone';
  if (h < 3) return 'andesite';
  return 'cobblestone';
}

function upperStone(x, y, z) {
  const h = hashPosition(x, y, z, 914) % 20;
  if (h < 2) return 'cracked_stone_bricks';
  if (h < 4) return 'mossy_stone_bricks';
  return 'stone_bricks';
}

function ground(b) {
  b.phase('Gelände und Fundament', 'Leg die Wiese aus und darin das runde Fundament: ein Kreis mit 11 Blöcken Durchmesser – außen ein Ring aus Bruchstein, innen Fichtenbretter als Fußboden.', {
    tips: ['Für den Kreis: setz zuerst die vier äußersten Blöcke 5 Felder von der Mitte, dann je 3 Blöcke gerade Kante dazwischen und verbinde sie in Zweier- und Einerstufen.'],
  });
  b.step('Wiese und Fundamentkreis', 'Die Wiese ist 36 × 29 Blöcke groß. Der Fundamentkreis hat 11 Blöcke Durchmesser.');
  b.fill(-15, 0, -14, 20, 0, 14, 'grass_block');
  for (const [x, z] of ringCells(LOW_R)) b.set(x, 0, z, 'cobblestone');
  for (const [x, z] of innerCells(LOW_R)) b.set(x, 0, z, spruce.planks);
}

function tower(b) {
  b.phase('Turm unten', 'Mauere den unteren Turm als Ring auf dem Fundament 5 Ebenen hoch aus Bruchstein. Unten mischst du etwas bemoosten Bruchstein ein, dazwischen ein paar Andesitblöcke. Tür und Fenster setzt du später ein – mauere erst ganz durch.', {
    tips: ['Jede Ebene ist derselbe Ring: zähl einmal die Blöcke einer Ebene ab und setz dann Ebene für Ebene darauf.'],
  });
  for (let y = 1; y <= LOW_TOP; y++) for (const [x, z] of ringCells(LOW_R)) b.set(x, y, z, lowerStone(x, y, z));

  b.phase('Zwischenboden und Galerie', 'Auf die Mauerkrone kommt der Boden des Mahlbodens aus Fichtenbrettern. Außen umläuft eine schmale Galerie den Turm: ein Ring aus oberen Fichtenstufen vor der Mauer, getragen von umgedrehten Treppen, mit einem Zaun als Geländer.', {
    tips: ['Lass im Boden an der Nordseite, 3 Felder von der Mitte, ein Loch für die Leiter frei.'],
  });
  b.step('Boden des Mahlbodens', 'Füll den Ring innen auf Höhe der Mauerkrone mit Fichtenbrettern. Ein Feld an der Nordseite (3 Felder hinter der Mitte) bleibt als Leiterloch offen, in die Mitte kommt später der Trichter der Mehlrutsche.');
  for (const [x, z] of innerCells(LOW_R)) b.set(x, LOW_TOP, z, spruce.planks);
  b.set(0, LOW_TOP, -3, 'air');
  b.step('Galerie', 'Leg außen um den Turm einen Ring aus oberen Fichtenstufen (in Höhe der Mauerkrone). Darunter stützen acht umgedrehte Fichtentreppen den Ring, die hohe Seite zur Mauer. Auf den äußeren Rand kommt ein Fichtenzaun.');
  const lowDisc = new Set(discCells(LOW_R).map(([x, z]) => key(x, z)));
  const gallery = discCells(LOW_R + 1).filter(([x, z]) => !lowDisc.has(key(x, z)));
  for (const [x, z] of gallery) b.set(x, LOW_TOP, z, `${spruce.slab}[type=top]`);
  for (const [x, z] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, 4], [4, -4], [-4, -4]]) {
    b.set(x, LOW_TOP - 1, z, `${spruce.stairs}[facing=${facingToCenter(x, z)},half=top]`);
  }
  for (const [x, z] of ringCells(LOW_R + 1)) b.set(x, LOW_TOP + 1, z, spruce.fence);

  b.phase('Turm oben', 'Der obere Turm ist schlanker: ein Ring mit 9 Blöcken Durchmesser aus Steinziegeln (mit ein paar rissigen und bemoosten), 8 Ebenen hoch auf dem Zwischenboden. In der fünften Ebene über dem Zwischenboden ziehst du den Boden des Kornbodens ein.', {
    tips: ['Der obere Ring sitzt einen Block weiter innen – so bleibt außen die Mauerkrone des unteren Turms als Laufsteg der Galerie frei.'],
  });
  for (let y = LOW_TOP + 1; y <= HIGH_TOP; y++) {
    for (const [x, z] of ringCells(HIGH_R)) b.set(x, y, z, upperStone(x, y, z));
    if (y === 10) {
      for (const [x, z] of innerCells(HIGH_R)) b.set(x, y, z, spruce.planks);
      b.set(0, y, -3, 'air');
    }
  }
}

function cap(b) {
  b.phase('Kappe', 'Die Kappe ist ein Kegel aus Schwarzeichentreppen. Zuerst schließt ein Boden aus Schwarzeichenbrettern den Turm oben ab (mit Leiterloch im Norden), dann folgen fünf Ringe Treppen – jeder Ring einen Block enger und eine Ebene höher, die hohe Seite immer zur Mitte. Der unterste Ring steht einen Block über die Turmmauer.', {
    tips: [
      'Die Ecken der Ringe formen sich von selbst zu Innen- und Außenecken, wenn du die Treppen der Reihe nach setzt.',
      'Auf die Spitze kommt eine Schwarzeichenstufe und darauf ein Blitzableiter.',
      'Vier Ecktreppen im dritten Ring und die Spitzenstufe berühren nur Kanten. Setz innen darunter je ein Schwarzeichenbrett als Stütze (diagonal 2 Felder von der Mitte und unter der Spitze) – von außen sieht man die Bretter nicht.',
    ],
  });
  for (const [x, z] of innerCells(LOW_R)) b.set(x, CAP_Y, z, dark.planks);
  b.set(0, CAP_Y, -3, 'air');
  // Stützen innen: ohne sie hätten diese Kegelblöcke keine Fläche, an die man sie im Spiel setzen kann.
  for (const [x, z] of [[2, 2], [-2, 2], [2, -2], [-2, -2]]) b.set(x, CAP_Y + 1, z, dark.planks);
  b.set(0, CAP_Y + 4, 0, dark.planks);
  // Jeder Ring deckt genau die Fläche bis zum nächst engeren Ring ab – so bleibt keine Lücke im Kegel.
  for (let k = 0; k < 5; k++) {
    const next = new Set(discCells(LOW_R - k - 1).map(([x, z]) => key(x, z)));
    for (const [x, z] of discCells(LOW_R - k)) {
      if (!next.has(key(x, z))) b.set(x, CAP_Y + k, z, `${dark.stairs}[facing=${facingToCenter(x, z)},half=bottom]`);
    }
  }
  b.set(0, CAP_Y + 5, 0, `${dark.slab}[type=bottom]`);
  b.set(0, CAP_Y + 6, 0, 'lightning_rod[facing=up]');
}

function openings(b) {
  b.phase('Tür und Fenster', 'Brich Tür und Fenster in die fertigen Mauern. Die Haustür liegt im Westen (die Flügel drehen sich vor der Südseite), eine zweite Tür führt vom Mahlboden im Osten auf die Galerie.', {
    tips: ['In einer runden Mauer setzt du Fenster am besten auf die geraden Stücke genau im Norden, Osten, Süden und Westen.'],
  });
  b.step('Haustür', 'Setz in die Westseite eine Fichtentür mit einem Rahmen aus geschälter Schwarzeiche (zwei Stämme seitlich, einer liegend darüber).');
  doorway(b, { x: -LOW_R, y: 1, z: 0, facing: 'west', door: spruce.door, frame: dark.strippedLog, step: null });
  b.step('Galerietür', 'Im Osten des Mahlbodens kommt eine Fichtentür auf die Galerie.');
  doorway(b, { x: HIGH_R, y: LOW_TOP + 1, z: 0, facing: 'east', door: spruce.door, frame: null });
  b.step('Fenster', 'Unten bekommt der Turm zwei Fenster (Osten und Süden) mit Fensterbank, der Mahlboden zwei (Westen und Süden), der Kornboden zwei kleine (Osten und Westen).');
  window(b, { x: LOW_R, y: 2, z: 0, facing: 'east', height: 2, sill: spruce.stairs, shutters: spruce.trapdoor });
  window(b, { x: 0, y: 2, z: LOW_R, facing: 'south', height: 2, sill: spruce.stairs, shutters: spruce.trapdoor });
  window(b, { x: -HIGH_R, y: 7, z: 0, facing: 'west', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: 0, y: 7, z: HIGH_R, facing: 'south', height: 2, sill: 'stone_brick_stairs' });
  window(b, { x: HIGH_R, y: 12, z: 0, facing: 'east', height: 1 });
  window(b, { x: -HIGH_R, y: 12, z: 0, facing: 'west', height: 1 });
}

// Ein Flügel in der Ebene z = HUB.z: Balken von der Nabe nach außen, Segel 3 breit auf einer Seite (Windrad-Anordnung).
function sail(b, dx, dy) {
  const sx = dy;
  const sy = -dx;
  const at = (dist, side) => [dx * dist + sx * side, HUB.y + dy * dist + sy * side];
  const axis = dx !== 0 ? 'x' : 'y';
  for (let d = 1; d <= ARM; d++) {
    const [x, y] = at(d, 0);
    b.set(x, y, HUB.z, `${dark.strippedLog}[axis=${axis}]`);
  }
  for (let d = 3; d <= ARM; d++) {
    for (let side = 1; side <= 3; side++) {
      const [x, y] = at(d, side);
      const frame = side === 3 || d === 3 || d === ARM;
      b.set(x, y, HUB.z, frame ? dark.fence : 'white_wool');
    }
  }
}

function sails(b) {
  b.phase('Flügelwelle und Flügel', 'Die Flügelwelle ragt aus der Südseite der Kappe. An ihrem Ende sitzt die Nabe, daran vier Flügel im Kreuz. Jeder Flügel hat einen 9 Blöcke langen Balken aus geschälter Schwarzeiche und daneben ein Segel: 3 breit, ab dem dritten Block bis zur Spitze, mit einem Rahmen aus Schwarzeichenzaun und weißer Wolle innen.', {
    tips: [
      'Die Segel sitzen bei jedem Flügel auf der Seite, die im Uhrzeigersinn folgt (von vorne gesehen): oben rechts, rechts unten, unten links, links oben – so sieht das Kreuz aus, als würde es sich drehen.',
      'Die Nabe liegt 10 Blöcke über der Galerie – für Welle, Nabe und die oberen drei Flügel brauchst du ein Gerüst (z. B. Gerüstblöcke vor der Südseite), das du danach wieder abbaust. Nur das untere Ende des unteren Flügels erreichst du von der Galerie aus.',
    ],
  });
  b.step('Flügelwelle und Nabe', 'Leg die Welle (geschälte Schwarzeiche, liegend Nord–Süd) mittig durch die Kappe: hinten auf einem Lagerbock, vorne durch die Kappenwand bis 3 Blöcke vor den Turm. Das Ende ist die Nabe aus Schwarzeichenholz.');
  b.fill(0, HUB.y, -1, 0, HUB.y, HUB.z - 1, `${dark.strippedLog}[axis=z]`);
  b.set(0, HUB.y, HUB.z, 'dark_oak_wood[axis=z]');
  for (const [dx, dy, name] of [[0, 1, 'oben'], [1, 0, 'rechts'], [0, -1, 'unten'], [-1, 0, 'links']]) {
    b.step(`Flügel ${name}`, `Setz den Balken des Flügels ${name} 9 Blöcke lang an die Nabe und daneben das Segel: Zaun als Rahmen außen und an beiden Enden, innen 2 × 5 weiße Wolle.`);
    sail(b, dx, dy);
  }
}

function interior(b) {
  b.phase('Einrichtung', 'Richte die Mühle von unten nach oben ein. Leitern verbinden alle Böden an der Nordseite.', {
    tips: ['Die Mühlsteine liegen genau über der Mehlrutsche: die Trichter geben das Mehl nach unten ins Fass weiter.'],
  });
  b.step('Mehllager', 'Unten im Turm stehen die Mehlsäcke: Fässer entlang der Südostwand, zwei davon gestapelt, dazu eine Truhe. In der Mitte hängt die Mehlrutsche aus drei Trichtern (Ausgang nach unten) von der Decke und endet in zwei gestapelten Fässern. An der Nordwand steht ein Stützbalken mit der Leiter.');
  for (const [x, y, z] of [[4, 1, 1], [4, 1, 2], [3, 1, 3], [2, 1, 4], [4, 2, 2], [3, 2, 3], [-3, 1, 3], [-2, 1, 4]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(-3, 1, -3, 'chest[facing=south,type=single]');
  b.set(0, 1, 0, 'barrel[facing=up]');
  b.set(0, 2, 0, 'barrel[facing=up]');
  for (let y = 3; y <= LOW_TOP; y++) b.set(0, y, 0, 'hopper[facing=down]');
  b.fill(0, 1, -4, 0, 4, -4, `${spruce.strippedLog}[axis=y]`);
  b.fill(0, 1, -3, 0, LOW_TOP, -3, 'ladder[facing=south]');

  b.step('Mahlboden', 'Auf dem Mahlboden liegen in der Mitte die Mühlsteine: unten der Bodenstein aus glattem Stein (ein Kreuz aus 5 Blöcken, die Ecken aus oberen Fichtenstufen), darauf der Läuferstein aus Glatter-Stein-Stufen. Daneben füllt ein Trichter (der Rumpf) das Korn ein. Kornfässer stehen an der Wand, die Leiter führt weiter nach oben.');
  const y = LOW_TOP + 1;
  for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    b.set(x, y, z, 'smooth_stone');
    b.set(x, y + 1, z, 'smooth_stone_slab[type=bottom]');
  }
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x, y, z, `${spruce.slab}[type=top]`);
  b.set(1, y + 2, 0, 'hopper[facing=down]');
  for (const [x, z] of [[-3, 1], [-3, -1], [-2, 2], [2, -2], [-2, -2]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(-3, y + 1, -1, 'barrel[facing=up]');
  b.fill(0, y, -3, 0, 10, -3, 'ladder[facing=south]');

  b.step('Königswelle und Kornboden', 'Von den Mühlsteinen läuft die Königswelle (geschälter Fichtenstamm, senkrecht) mitten durch den Kornboden bis in die Kappe. Auf dem Kornboden trägt sie das Stirnrad: ein Ring aus oberen Schwarzeichenstufen um die Welle. Heuballen stehen als Kornvorrat an der Wand.');
  b.fill(0, y + 2, 0, 0, CAP_Y + 1, 0, `${spruce.strippedLog}[axis=y]`);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x, 12, z, `${dark.slab}[type=top]`);
  for (const [x, yy, z] of [[2, 11, 2], [-2, 11, 2], [2, 11, -2], [2, 12, 2], [-3, 11, 1]]) b.set(x, yy, z, 'hay_block[axis=y]');
  b.fill(0, 11, -3, 0, CAP_Y, -3, 'ladder[facing=south]');

  b.step('Kammrad in der Kappe', 'In der Kappe sitzt auf der Flügelwelle das Kammrad: ein senkrechter Ring aus Schwarzeichenbrettern um die Welle, der unten in die Königswelle greift. Hinten trägt ein Fichtenstamm die Welle als Lagerbock.');
  for (const [x, yy] of [[-1, 15], [1, 15], [-1, 16], [1, 16], [-1, 17], [0, 17], [1, 17]]) b.set(x, yy, 0, dark.planks);
  b.set(0, CAP_Y + 1, -1, `${spruce.log}[axis=y]`);
}

// lightRoom rechnet in Rechtecken. Damit keine Laterne in den Ecken außerhalb des runden Turms landet, werden die
// freien Eckfelder für die Rechnung kurz mit Barrieren gefüllt und danach wieder entfernt.
function lightRound(b, y1, y2, wallR, options = {}) {
  const inside = new Set(innerCells(wallR).map(([x, z]) => key(x, z)));
  const n = wallR;
  const temp = [];
  for (let y = y1; y <= y2; y++) {
    for (let z = -n; z <= n; z++) {
      for (let x = -n; x <= n; x++) {
        if (inside.has(key(x, z)) || b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, 'barrier');
        temp.push([x, y, z]);
      }
    }
  }
  lightRoom(b, { x1: -n, y1, z1: -n, x2: n, y2, z2: n }, options);
  for (const [x, y, z] of temp) b.remove(x, y, z);
}

function lights(b) {
  b.phase('Licht', 'Häng in jedes Geschoss Laternen, damit drinnen kein Monster erscheint. Außen leuchtet eine Laterne über der Haustür an einem Zaun-Arm.');
  b.step('Laterne an der Haustür');
  b.set(-LOW_R - 1, 4, 1, `${dark.fence}`);
  b.set(-LOW_R - 1, 3, 1, 'lantern[hanging=true]');
  b.step('Erdgeschoss');
  lightRound(b, 1, 4, LOW_R);
  b.step('Mahlboden');
  lightRound(b, LOW_TOP + 1, 9, HIGH_R);
  b.step('Kornboden');
  lightRound(b, 11, HIGH_TOP, HIGH_R);
  b.step('Kappe', 'In der Kappe hängt eine Laterne direkt unter der Flügelwelle, vor dem Kammrad.');
  b.set(0, CAP_Y + 1, 2, 'lantern[hanging=true]');
  lightRound(b, CAP_Y + 1, CAP_Y + 1, HIGH_R);
}

function field(b) {
  const [x1, x2, z1, z2, zWater] = [7, 15, -11, -7, -9];
  b.step('Weizenfeld', 'Im Nordosten liegt ein Weizenfeld, 9 × 5 Blöcke. Grab in der Mitte eine Rinne (7 lang) und füll sie mit Wasser – darunter muss ein Erdblock liegen. Bearbeite die Erde ringsum mit der Hacke und säe Weizen. Am Westende der Rinne bleibt ein Erdblock unbearbeitet – darauf steht der Komposter.');
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) {
      if (z === zWater && x > x1 && x < x2) {
        b.set(x, -1, z, 'dirt');
        b.set(x, 0, z, 'water');
        continue;
      }
      b.set(x, 0, z, 'farmland[moisture=7]');
      const age = hashPosition(x, 0, z, 77) % 4 === 0 ? 5 + (hashPosition(x, 1, z, 78) % 2) : 7;
      b.set(x, 1, z, `wheat[age=${age}]`);
    }
  }
  // Unter dem Komposter normale Erde: Ackerboden unter einem Block wird im Spiel sofort zu Erde.
  b.set(x1, 0, zWater, 'dirt');
  b.set(x1, 1, zWater, 'composter[level=4]');
  b.step('Vogelscheuche', 'Neben dem Feld steht eine Vogelscheuche: ein Zaunpfosten, darauf ein Heuballen mit zwei Zaun-Armen und ein geschnitzter Kürbis als Kopf, der aufs Feld schaut.');
  b.set(17, 1, zWater, spruce.fence);
  b.set(17, 2, zWater, 'hay_block[axis=y]');
  b.set(17, 2, zWater - 1, spruce.fence);
  b.set(17, 2, zWater + 1, spruce.fence);
  b.set(17, 3, zWater, 'carved_pumpkin[facing=west]');
}

function surroundings(b) {
  b.phase('Umgebung', 'Zum Schluss das Umland: ein Weizenfeld mit Wasserrinne, ein Erdweg zur Haustür, Mehlsäcke vor der Tür, Bäume und Blumen.', {
    tips: ['Ackerboden trocknet aus, wenn kein Wasser in 4 Blöcken Nähe ist – die Rinne in der Mitte reicht hier für das ganze Feld.'],
  });
  field(b);
  b.step('Weg und Vorplatz', 'Leg von der Haustür aus einen 3 breiten Erdweg nach Westen. Neben der Tür warten drei Mehlsäcke (Fässer) und ein Heuballen auf den Karren.');
  path(b, { x: -LOW_R - 1, y: 0, z: 0, facing: 'west', length: 9, width: 3, mix: 'erde', wiggle: 1, seed: 'muehle' });
  for (const [x, y, z] of [[-7, 1, -3], [-8, 1, -3], [-7, 2, -3]]) b.set(x, y, z, 'barrel[facing=up]');
  b.set(-8, 1, -4, 'hay_block[axis=y]');
  b.step('Bäume, Büsche und Blumen', 'Eine Eiche steht im Nordwesten, eine Birke im Südwesten, dazu Büsche und ein Blumenbeet südlich vom Weg.');
  tree(b, { x: -10, y: 1, z: -8, species: 'eiche', size: 'mittel', seed: 4 });
  tree(b, { x: -11, y: 1, z: 9, species: 'birke', size: 'mittel', seed: 2 });
  bush(b, { x: 9, y: 1, z: 9, size: 'mittel', seed: 6 });
  bush(b, { x: 17, y: 1, z: 3, size: 'klein', leaves: 'azalee', seed: 8 });
  flowerBed(b, { x: -12, y: 0, z: 3, width: 5, depth: 2, facing: 'south', palette: 'warm', seed: 3 });
  vegetation(b, { x: -15, y: 2, z: -14, width: 36, depth: 29, mix: 'wiese', density: 0.22, shape: 'eckig', seed: 21 });
}

export default function build(b) {
  ground(b);
  tower(b);
  cap(b);
  openings(b);
  sails(b);
  interior(b);
  lights(b);
  surroundings(b);
}
