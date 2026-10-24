// Hängebrücke aus Holz zwischen zwei Felsen: die Fahrbahn hängt als Kettenlinie durch, Tragseile aus Zäunen, Hänger aus Ketten.
// Bau-Rahmen (lokal): die Brücke läuft entlang z, Mitte bei x = 0; die Schlucht liegt zwischen z = 10 und z = 36.
// Der ganze Bau ist um 90° gedreht, damit die Brücke von Westen nach Osten läuft und die Ansicht von vorne den Durchhang zeigt.
// Felsoberkante y = 18, am Rand der Felsen geht man auf y = 19.

import { hashPosition } from '../../core/random.js';
import { WOOD, terrain, tree, bush, rock, vegetation, path } from '../lib/index.js';

export const meta = {
  id: 'haengebruecke',
  title: 'Hängebrücke',
  category: 'infrastruktur',
  subtitle: 'Holz-Hängebrücke über eine Felsschlucht – die Fahrbahn hängt als echte Kettenlinie durch',
  tags: ['Brücke', 'Hängebrücke', 'Holzbrücke', 'Seilbrücke', 'Schlucht', 'Felsen', 'Ketten', 'Fichte', 'Abenteuer', 'Berge', 'Nadelwald'],
  aliases: [
    'hängebrücke', 'haengebruecke', 'hangebrucke', 'hängebruecke', 'haengebrücke', 'seilbrücke', 'seilbruecke', 'hängebrück',
    'holzbrücke', 'holzbruecke', 'schluchtbrücke', 'kettenbrücke', 'rope bridge', 'suspension bridge', 'wooden bridge',
    'hanging bridge', 'canyon bridge', 'jungle bridge',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Eine Hängebrücke aus Fichtenholz spannt sich 29 Blöcke weit über eine Felsschlucht mit Bach. Die Fahrbahn aus Fichtenstufen hängt als Kettenlinie durch – vier Blöcke tiefer in der Mitte als an den Enden –, getragen von Tragseilen aus Fichtenzäunen, die über zwei Holztore laufen und hinten im Fels verankert sind. Hängeseile, ein Zaungeländer und Laternen machen sie sicher; Fichten, Farne und Felsen geben den Klippen Bergstimmung.',
  facts: [
    'Freie Spannweite 29 Blöcke, Durchhang der Fahrbahn 4 Blöcke, die Felsen ragen 18 Blöcke über den Bach.',
    'Die Fahrbahn folgt einer Kettenlinie (cosh-Kurve) – der Form, die ein hängendes Seil von selbst annimmt. Halbe Höhen entstehen aus oberen und unteren Stufen.',
    'Tragseile und Rückhalteseile sind Fichtenzäune, die Hänger Eisenketten; die Tore sind 8 Blöcke hohe Fichtenstämme.',
    'Alle Stufen der Fahrbahn sind höchstens einen halben Block höher als ihre Nachbarn – man läuft ohne Springen hinüber.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const AREA = { x1: -15, z1: -6, x2: 15, z2: 52 };
const ROCK_TOP = 18;
const GORGE = { z1: 10, z2: 36 };
const POSTS = [8, 38];
const SPAN = { z1: 9, z2: 37, mid: 23 };
const SAG = 4;
const POST_TOP = ROCK_TOP + 8;
const CABLE_TOP = POST_TOP - 1;
const ANCHORS = [3, 43];
const SIDES = [-1, 1];
const CHAIN_Y = 'iron_chain[axis=y]';
const ROPE = spruce.fence;
const EDGE_SLAB = WOOD.schwarzeiche.slab;

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;
const pick = (entries, x, y, z, salt) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand01(x, y, z, salt) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
};

function smoothNoise(x, z, cell, salt) {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const fx = x / cell - gx;
  const fz = z / cell - gz;
  const s = (t) => t * t * (3 - 2 * t);
  const v = (i, k) => rand01(gx + i, 0, gz + k, salt);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
  return top + (bottom - top) * s(fz);
}

// --- Kettenlinie ---

// Normierte Kettenlinie: 0 an den Enden (u = ±1), 1 in der Mitte; c bestimmt, wie stark sie zu den Enden hin ansteigt.
function catenary(u, c) {
  return (Math.cosh(c) - Math.cosh(c * u)) / (Math.cosh(c) - 1);
}

const half = (SPAN.z2 - SPAN.z1 + 2) / 2;
const spanU = (z) => (z - SPAN.mid) / half;

// Lauffläche über der Spannweite: Kettenlinie in halben Blöcken, von den Enden zur Mitte höchstens einen halben Block
// tiefer je Block (an den Enden ist die Kurve steiler) – so läuft man ohne Springen. An Land ROCK_TOP + 1.
const DECK_PROFILE = new Map();
{
  let previous = ROCK_TOP + 1;
  for (let z = SPAN.z1; z <= SPAN.mid; z++) {
    const ideal = Math.round((ROCK_TOP + 1 - SAG * catenary(spanU(z), 1.2)) * 2) / 2;
    previous = Math.max(ideal, previous - 0.5);
    DECK_PROFILE.set(z, previous);
    DECK_PROFILE.set(2 * SPAN.mid - z, previous);
  }
}

function deckSurface(z) {
  return DECK_PROFILE.get(z) ?? ROCK_TOP + 1;
}

const railY = (z) => Math.ceil(deckSurface(z));

function cableY(z) {
  const low = railY(SPAN.mid) + 2;
  return Math.round(CABLE_TOP - (CABLE_TOP - low) * catenary(spanU(z), 1.6));
}

// --- Gelände ---

function gorgeEdges(x) {
  if (Math.abs(x) <= 3) return { north: GORGE.z1, south: GORGE.z2 };
  return {
    north: GORGE.z1 + Math.round(smoothNoise(x, 0, 5, 11) * 3 - 0.5),
    south: GORGE.z2 - Math.round(smoothNoise(x, 0, 5, 12) * 3 - 0.5),
  };
}

function streamBand(x) {
  const center = 23 + Math.round((smoothNoise(x, 0, 6, 13) - 0.5) * 4);
  return { z1: center - 1, z2: center + 2 };
}

function groundHeight(x, z) {
  const { north, south } = gorgeEdges(x);
  if (z < north || z > south) {
    const nearBridge = Math.abs(x) <= 4 && (z >= POSTS[0] - 6 || z <= POSTS[1] + 6);
    if (nearBridge) return ROCK_TOP;
    return ROCK_TOP + Math.round(smoothNoise(x, z, 5, 14) * 1.6 - 0.5);
  }
  const t = Math.min(z - north + 1, south - z + 1);
  const band = streamBand(x);
  if (z >= band.z1 && z <= band.z2) return 0;
  const floor = 1 + Math.round(smoothNoise(x, z, 4, 15) * 2);
  const wall = ROCK_TOP - Math.round(t * 3.4 + (smoothNoise(x, z, 3, 16) - 0.5) * 3);
  return Math.max(floor, Math.min(ROCK_TOP, wall));
}

function cliffs(b) {
  b.phase('Felsen und Schlucht', 'Die Brücke spannt sich über eine 27 Blöcke breite Schlucht zwischen zwei Felsen. Unten fließt ein schmaler Bach. Hast du schon eine Schlucht in deiner Welt, nimm einfach eine Stelle mit etwa dieser Breite und überspringe dieses Kapitel.', {
    tips: ['Die Felskanten, an denen die Tore stehen, sollten auf gleicher Höhe liegen – sonst hängt die Brücke schief.'],
  });
  b.step('Felsen', 'Forme die beiden Felsen mit steilen Wänden aus Stein und Andesit, oben Gras. Die Felsoberkante liegt 18 Blöcke über dem Bachbett.');
  const width = AREA.x2 - AREA.x1 + 1;
  const depth = AREA.z2 - AREA.z1 + 1;
  terrain(b, {
    x: AREA.x1, y: 0, z: AREA.z1, width, depth, surface: 'gras', rocky: true, seed: 7,
    heightAt: (dx, dz) => groundHeight(AREA.x1 + dx, AREA.z1 + dz),
  });
  b.step('Bach', 'Unten in der Schlucht liegt ein Bachbett aus Kies und Sand, darauf eine Ebene Wasserquellen.');
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    const band = streamBand(x);
    for (let z = band.z1; z <= band.z2; z++) {
      b.set(x, 0, z, pick([['gravel', 3], ['sand', 2], ['clay', 1]], x, 0, z, 21));
      b.set(x, 1, z, 'water[level=0]');
    }
  }
}

// --- Tore und Anker ---

function gates(b) {
  b.phase('Tore und Anker', 'Auf jeder Felskante steht ein Tor aus zwei Fichtenstämmen mit einem Querbalken. Hinter jedem Tor sitzen zwei Ankerblöcke im Fels, an denen später die Tragseile enden.', {
    tips: [
      'Grabe die Stämme zwei Blöcke tief in den Boden ein – so wirken sie fest verankert.',
      'Die beiden Tore stehen genau 30 Blöcke auseinander, Mitte auf Mitte.',
    ],
  });
  b.step('Torpfosten', 'Je zwei Fichtenstämme, 5 Blöcke auseinander (Mitte auf Mitte 4), stehen an der Felskante. Sie reichen von 2 Blöcken unter der Oberfläche bis 8 Blöcke darüber.');
  for (const z of POSTS) {
    for (const s of SIDES) b.fill(2 * s, ROCK_TOP - 2, z, 2 * s, POST_TOP, z, `${spruce.log}[axis=y]`);
  }
  b.step('Querbalken', 'Oben verbindet ein liegender, geschälter Fichtenstamm die Pfosten und steht auf jeder Seite einen Block über. Darunter stützen umgedrehte Treppen die Ecken.');
  for (const z of POSTS) {
    b.fill(-3, POST_TOP, z, 3, POST_TOP, z, `${spruce.strippedLog}[axis=x]`);
    for (const s of SIDES) b.stairs(1 * s, POST_TOP - 1, z, spruce.stairs, { facing: s > 0 ? 'east' : 'west', half: 'top' });
    for (const s of SIDES) b.stairs(3 * s, POST_TOP - 1, z, spruce.stairs, { facing: s > 0 ? 'west' : 'east', half: 'top' });
  }
  b.step('Ankerblöcke', 'Fünf Blöcke hinter jedem Pfosten setzt du einen Anker aus bemoostem Bruchstein in den Boden, darauf einen Steinziegel. Daran werden die Rückhalteseile befestigt.');
  for (const z of ANCHORS) {
    for (const s of SIDES) {
      b.set(2 * s, ROCK_TOP, z, 'mossy_cobblestone');
      b.set(2 * s, ROCK_TOP + 1, z, 'chiseled_stone_bricks');
    }
  }
  b.note(2, POST_TOP, POSTS[0], 'Tragseil liegt hier auf dem Pfosten auf');
}

// --- Seile ---

// Ein Seil aus Zäunen entlang der Punkte [z, y]: Sprünge nach oben werden senkrecht gefüllt, damit das Seil nicht abreißt.
function ropeLine(b, x, points) {
  for (let i = 0; i < points.length; i++) {
    const [z, y] = points[i];
    const prev = i > 0 ? points[i - 1][1] : y;
    for (let yy = Math.min(y, prev); yy <= Math.max(y, prev); yy++) b.set(x, yy, z, ROPE);
  }
}

function cables(b) {
  b.phase('Tragseile', 'Die beiden Tragseile aus Fichtenzäunen hängen von den Torpfosten in einer Kettenlinie durch – an den Toren steil, in der Mitte flach. Hinter den Toren laufen sie schräg hinunter zu den Ankern.', {
    tips: [
      'Zäune verbinden sich von selbst mit dem Nachbarzaun und mit dem Torpfosten. Wo das Seil eine Ebene springt, stapelst du die Zäune senkrecht – so bleibt es durchgehend.',
      'Zähle die Stufen des Seils ab, statt zu schätzen: von jedem Tor aus sinkt es die ersten vier Blöcke um je eine Ebene, danach nur noch alle ein bis drei Blöcke – in der Mitte liegt es neun Blöcke lang flach.',
    ],
  });
  b.step('Tragseile über der Schlucht', 'Spanne von Tor zu Tor je ein Tragseil über beiden Seiten der Fahrbahn. Es setzt direkt neben dem Torpfosten an, zwei Blöcke unter dem Querbalken, und sinkt bis zur Mitte auf zwei Blöcke über die Fahrbahn.');
  const points = [];
  for (let z = SPAN.z1; z <= SPAN.z2; z++) points.push([z, cableY(z)]);
  for (const s of SIDES) ropeLine(b, 2 * s, points);
  b.step('Rückhalteseile', 'Von der Rückseite jedes Pfostens läuft ein Zaunseil in Stufen hinunter bis direkt neben den Ankerblock und verbindet sich mit ihm.');
  for (const s of SIDES) {
    for (const [post, anchor] of [[POSTS[0], ANCHORS[0]], [POSTS[1], ANCHORS[1]]]) {
      const dir = Math.sign(anchor - post);
      const steps = Math.abs(anchor - post);
      const back = [];
      for (let i = 1; i < steps; i++) {
        const y = Math.round(CABLE_TOP - ((CABLE_TOP - (ROCK_TOP + 1)) * i) / (steps - 1));
        back.push([post + dir * i, y]);
      }
      if (dir < 0) back.reverse();
      ropeLine(b, 2 * s, back);
    }
  }
}

// --- Fahrbahn ---

// Querbohlen etwa alle vier Blöcke, nur in Reihen mit ganzer Höhe – so liegt der Stamm bündig mit den oberen Stufen.
const BEAM_ROWS = new Set([7, 12, 16, 20, 23, 26, 30, 34, 39]);
const isBeamRow = (z) => BEAM_ROWS.has(z);

function deckBlock(x, z) {
  const s = deckSurface(z);
  if (isBeamRow(z)) {
    if (!Number.isInteger(s)) throw new Error(`haengebruecke: Querbohle bei z = ${z} läge auf halber Höhe.`);
    return { y: s - 1, state: `${spruce.strippedLog}[axis=x]` };
  }
  if (Number.isInteger(s)) return { y: s - 1, state: `${spruce.slab}[type=top]` };
  return { y: Math.floor(s), state: `${spruce.slab}[type=bottom]` };
}

function deck(b) {
  b.phase('Fahrbahn', 'Die Fahrbahn ist 3 Blöcke breit und besteht aus Fichtenstufen. Wo sie durchhängt, wechseln sich obere und untere Stufen ab – so steigt sie in halben Blöcken. Etwa alle vier Blöcke liegt ein geschälter Stamm quer als Bohle, bündig mit der Fahrbahn, der links und rechts einen Block übersteht. Dazwischen säumen Randbohlen aus oberen Schwarzeichenstufen die Fahrbahn.', {
    tips: [
      'Baue von beiden Toren aus zur Mitte und stell dich dabei immer auf das letzte fertige Stück. Ein Seil zur Sicherung brauchst du nicht – aber falle nicht!',
      'Obere Stufen setzt du mit einem Klick auf die obere Hälfte der Nachbarstufe, untere mit einem Klick auf die untere Hälfte.',
      'Die Randbohlen sind immer obere Stufen. Wo die Fahrbahn aus unteren Stufen besteht, steht die Randbohle einen halben Block höher – ein kleiner Bordstein, auf dem das Geländer sitzt.',
    ],
  });
  for (const [label, z1, z2, dir] of [['vom ersten Tor zur Mitte', POSTS[0] - 3, SPAN.mid, 1], ['vom zweiten Tor zur Mitte', POSTS[1] + 3, SPAN.mid + 1, -1]]) {
    b.step(`Fahrbahn ${label}`, 'Leg die Fahrbahn Reihe für Reihe. Die Höhe jeder Reihe zeigt dir die 3D-Ansicht; an Land liegt sie bündig mit dem Fels.');
    for (let z = z1; dir > 0 ? z <= z2 : z >= z2; z += dir) {
      for (let x = -1; x <= 1; x++) {
        const cell = deckBlock(x, z);
        b.set(x, cell.y, z, cell.state);
      }
      if (z === POSTS[0] || z === POSTS[1]) continue;
      for (const s of SIDES) {
        if (isBeamRow(z)) b.set(2 * s, railY(z) - 1, z, `${spruce.strippedLog}[axis=x]`);
        else b.slab(2 * s, railY(z) - 1, z, EDGE_SLAB, { type: 'top' });
      }
    }
  }
  b.note(0, deckBlock(0, SPAN.mid).y, SPAN.mid, 'Tiefster Punkt: 4 Blöcke unter den Enden');
}

function hangersAndRailing(b) {
  b.phase('Hänger und Geländer', 'Jetzt verbindest du Fahrbahn und Tragseile: ein Zaungeländer auf den Randbohlen und alle zwei Blöcke ein senkrechtes Hängeseil aus Ketten vom Geländer bis zum Tragseil.', {
    tips: ['Fange in der Mitte an: dort sind die Hänger am kürzesten, an den Toren am längsten.'],
  });
  b.step('Geländer', 'Auf jede Randbohle kommt ein Fichtenzaun. Die Zäune verbinden sich von selbst zu einem Geländer.');
  for (let z = POSTS[0] + 1; z <= POSTS[1] - 1; z++) for (const s of SIDES) b.set(2 * s, railY(z), z, spruce.fence);
  b.step('Hängeseile', 'Alle zwei Blöcke hängst du eine senkrechte Kette vom Tragseil hinunter bis auf den Zaun.');
  for (let z = SPAN.z1 + 1; z <= SPAN.z2 - 1; z++) {
    if ((z - SPAN.mid) % 2 !== 0) continue;
    for (const s of SIDES) {
      const top = cableY(z) - 1;
      for (let y = railY(z) + 1; y <= top; y++) b.set(2 * s, y, z, CHAIN_Y);
    }
  }
}

function lights(b) {
  b.phase('Laternen', 'Unter jedem Querbalken hängt eine Laterne an einer Kette, und auf der Brücke hängen drei Laternenpaare zwischen Geländer und Tragseil – so findest du auch nachts sicher hinüber.');
  for (const z of POSTS) {
    b.set(0, POST_TOP - 1, z, CHAIN_Y);
    b.set(0, POST_TOP - 2, z, 'lantern[hanging=true]');
  }
  for (const z of [SPAN.mid - 6, SPAN.mid, SPAN.mid + 6]) {
    for (const s of SIDES) b.set(2 * s, railY(z) + 1, z, 'lantern[hanging=true]');
  }
}

// --- Umgebung ---

function surroundings(b) {
  b.phase('Nadelwald', 'Auf den Felsen wächst ein kleiner Nadelwald: Fichten, Büsche, bemooste Felsen und Farne. Ein Pfad führt auf jeder Seite zum Tor.');
  b.step('Pfade', 'Ein schmaler Pfad aus Erde und Kies führt von hinten zu jedem Tor.');
  path(b, { x: 0, y: ROCK_TOP, z: AREA.z1, facing: 'south', length: POSTS[0] - 3 - AREA.z1, width: 3, mix: 'gemischt', wiggle: 1, seed: 3 });
  path(b, { x: 0, y: ROCK_TOP, z: AREA.z2, facing: 'north', length: AREA.z2 - (POSTS[1] + 3), width: 3, mix: 'gemischt', wiggle: 1, seed: 4 });
  b.step('Fichten und Büsche', 'Fichten stehen ein Stück abseits der Tore, Büsche an den Felskanten.');
  const trees = [[-10, -1, 'gross', 1], [-12, 5, 'mittel', 2], [-9, 46, 'mittel', 3], [9, 49, 'gross', 4], [12, -4, 'klein', 5]];
  for (const [x, z, size, seed] of trees) {
    tree(b, { x, y: groundHeight(x, z) + 1, z, species: 'fichte', size, seed });
  }
  for (const [x, z, seed] of [[-6, 6, 1], [7, 41, 2], [12, 7, 3]]) {
    bush(b, { x, y: groundHeight(x, z) + 1, z, size: 'klein', leaves: 'fichte', seed });
  }
  rock(b, { x: 6, y: ROCK_TOP + 1, z: 3, size: 'klein', material: 'stein', seed: 1 });
  rock(b, { x: -7, y: ROCK_TOP + 1, z: 44, size: 'mittel', material: 'andesit', seed: 2 });
  rock(b, { x: 4, y: 3, z: 19, size: 'mittel', material: 'stein', seed: 3, rubble: false });
  b.step('Farne und Gras', 'Farne und Gras auf den Felsen und unten am Bach.');
  vegetation(b, { x: AREA.x1, y: ROCK_TOP + 3, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1, mix: 'farn', density: 0.35, shape: 'eckig', scan: 24, seed: 6 });
}

export default function build(b) {
  b.transform({ rotate: 90 }, () => {
    cliffs(b);
    gates(b);
    cables(b);
    deck(b);
    hangersAndRailing(b);
    lights(b);
    surroundings(b);
  });
}
