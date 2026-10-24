// Baumhaus: Rieseneiche mit 5 Blöcke dickem Stamm, Wendeltreppe um den Stamm, Plattform mit Hütte, Aussichtsplattform
// im Blätterdach und Hängebrücke zu einer zweiten Eiche mit kleiner Plattform.
// Bau-Rahmen: Stammmitte bei (0, 0), Gelände-Oberkante y = 0. Plattform unten y = 8, oben y = 17.

import { formatState, getProp } from '../../core/blockstate.js';
import { hashPosition } from '../../core/random.js';
import { WOOD, window, doorway, bedroom, lightRoom, wallLantern, bush, rock, terrain, vegetation, pathAlong, flowerBed } from '../lib/index.js';

export const meta = {
  id: 'baumhaus',
  title: 'Baumhaus',
  category: 'haeuser',
  subtitle: 'Hütte in einer Rieseneiche mit Wendeltreppe, Aussichtsplattform und Hängebrücke',
  tags: ['Haus', 'Baumhaus', 'Baum', 'Eiche', 'Wald', 'Hängebrücke', 'Wendeltreppe', 'Plattform', 'Holz', 'Abenteuer', 'Einrichtung'],
  aliases: [
    'baumhaus', 'baum haus', 'treehouse', 'tree house', 'baumhütte', 'baumhuette', 'haus im baum', 'riesenbaum', 'giant tree',
    'baumhaus mit hängebrücke', 'hängebrücke', 'haengebruecke', 'rope bridge', 'baumhaus eiche', 'bauhaus baum', 'baumhous',
    'baumhaus mit wendeltreppe', 'big tree house',
  ],
  accuracy: 'eigenes',
  difficulty: 4,
  description: 'Eine Rieseneiche mit 5 Blöcke dickem Stamm und sechs mächtigen Ästen trägt auf 8 Blöcken Höhe eine runde Plattform mit einer kleinen Holzhütte – der Stamm wächst mitten durch ihre Rückwand. Eine Wendeltreppe windet sich um den Stamm hinauf, eine Leiter führt weiter zur Aussichtsplattform im Blätterdach. Von der unteren Plattform schwingt eine Hängebrücke mit Seilgeländer zu einer zweiten Eiche mit eigener kleiner Plattform.',
  facts: [
    'Stamm 5 × 5 Blöcke mit abgerundeten Ecken, darüber 3 × 3, Krone bis etwa 31 Blöcke hoch und gut 25 Blöcke breit',
    'Die Äste sind unten 3 Blöcke dick und werden zum Ende hin dünner',
    'Die Hängebrücke ist 10 Felder lang und hängt in der Mitte zwei Blöcke durch',
    'Laternen auf Zaunpfosten, an den Balken und in der Hütte halten nachts Monster fern',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const oak = WOOD.eiche;
const spruce = WOOD.fichte;
const P1_Y = 8;
const P2_Y = 17;
const TREE2 = { x: -20, z: 1 };
const PLOT = { x1: -27, z1: -14, x2: 14, z2: 15 };
const HOUSE = { x1: -4, z1: 2, x2: 4, z2: 8 };
const HOUSE_TOP = 12;
const LEAVES = formatState(oak.leaves, { persistent: 'true' });

const st = (id, facing, half = 'bottom') => formatState(id, { facing, half });
const slab = (id, type = 'bottom') => formatState(id, { type });
const log = (id, axis = 'y') => formatState(id, { axis });
const lantern = (hanging = false) => formatState('lantern', { hanging: String(hanging) });
const OPPOSITE = { north: 'south', south: 'north', west: 'east', east: 'west' };
const key = (x, z) => `${x},${z}`;

// Stammquerschnitt je Höhe: unten 5 × 5 ohne Ecken, ab y 19 3 × 3, ganz oben ein einzelner Stamm.
function isTrunk(x, y, z) {
  if (y >= 1 && y <= 18) return Math.max(Math.abs(x), Math.abs(z)) <= 2 && !(Math.abs(x) === 2 && Math.abs(z) === 2);
  if (y >= 19 && y <= 23) return Math.abs(x) <= 1 && Math.abs(z) <= 1;
  if (y >= 24 && y <= 26) return x === 0 && z === 0;
  return false;
}
// Zweiter Baum: Stamm als Plus (Mitte + 4 Nachbarn) bis y 12, darüber ein einzelner Stamm.
function isTrunk2(x, y, z) {
  const dx = x - TREE2.x;
  const dz = z - TREE2.z;
  if (y >= 1 && y <= 12) return Math.abs(dx) + Math.abs(dz) <= 1;
  if (y >= 13 && y <= 15) return dx === 0 && dz === 0;
  return false;
}

// Treppenloch: drei Felder Kopffreiheit über den letzten Stufen, im vierten (3, 1) liegt die oberste Stufe.
const SPIRAL_HOLE = new Set([key(3, -2), key(3, -1), key(3, 0), key(3, 1)]);
const inP1 = (x, z) => (x * x + z * z <= 42.25 || (x >= -5 && x <= 5 && z >= 2 && z <= 9)) && !isTrunk(x, P1_Y, z) && !SPIRAL_HOLE.has(key(x, z));
const inP2 = (x, z) => x * x + z * z <= 30.25 && z <= -1 && !isTrunk(x, P2_Y, z) && !(x === 0 && z === -3);
const LADDER2 = { x: TREE2.x - 2, z: TREE2.z };
const inP3 = (x, z) => (x - TREE2.x) ** 2 + (z - TREE2.z) ** 2 <= 12.25 && !isTrunk2(x, P1_Y, z) && !(x === LADDER2.x && z === LADDER2.z);

function cells(test, x1, z1, x2, z2) {
  const out = [];
  for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) if (test(x, z)) out.push([x, z]);
  return out;
}

// Randzellen: mindestens ein Nachbar liegt außerhalb der Fläche (und ist weder Stamm noch eine der ausgenommenen Zellen).
function rim(test, list, inside) {
  return list.filter(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !test(x + dx, z + dz) && !inside(x + dx, z + dz)));
}

function floorWithRim(b, test, list, y, inside) {
  const edge = rim(test, list, inside);
  const edgeSet = new Set(edge.map(([x, z]) => key(x, z)));
  for (const [x, z] of list) b.set(x, y, z, edgeSet.has(key(x, z)) ? log(spruce.wood) : spruce.planks);
  return edge;
}

// Holzlinie, deren Blöcke sich immer mit einer Fläche berühren (baubar ohne Hilfsblöcke): ein Schritt je Achse.
function faceWalk(b, a, c, state, skip = () => false) {
  const cur = a.map((v) => Math.round(v));
  const put = () => { if (!skip(cur[0], cur[1], cur[2])) b.set(cur[0], cur[1], cur[2], state); };
  put();
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = Math.max(1, Math.ceil(Math.max(...d.map(Math.abs)) * 2));
  for (let i = 1; i <= n; i++) {
    const target = [0, 1, 2].map((k) => Math.round(a[k] + d[k] * (i / n)));
    while (target.some((v, k) => v !== cur[k])) {
      let k = 0;
      for (const cand of [1, 2]) if (Math.abs(target[cand] - cur[cand]) > Math.abs(target[k] - cur[k])) k = cand;
      cur[k] += Math.sign(target[k] - cur[k]);
      put();
    }
  }
}

// Ast: dicker Kern (Radius r0 → r1) entlang a → c aus Holz (Rinde rundum), Achse in Hauptrichtung.
function limb(b, a, c, r0, r1, woodId, skip) {
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const abs = d.map(Math.abs);
  const axis = abs[1] >= abs[0] && abs[1] >= abs[2] ? 'y' : abs[0] >= abs[2] ? 'x' : 'z';
  const state = log(woodId, axis);
  faceWalk(b, a, c, state, skip);
  const n = Math.ceil(Math.hypot(...d) * 3);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
    const r = r0 + (r1 - r0) * t;
    if (r < 0.75) continue;
    const R = Math.ceil(r);
    for (let y = Math.round(p[1]) - R; y <= Math.round(p[1]) + R; y++) {
      for (let z = Math.round(p[2]) - R; z <= Math.round(p[2]) + R; z++) {
        for (let x = Math.round(p[0]) - R; x <= Math.round(p[0]) + R; x++) {
          if (Math.hypot(x - p[0], y - p[1], z - p[2]) > r || skip(x, y, z)) continue;
          if (b.get(x, y, z) === 'air' || b.get(x, y, z) === LEAVES) b.set(x, y, z, state);
        }
      }
    }
  }
}

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;

// Blätterwolke aus überlappenden Ellipsoiden: dichter Kern, ausgefranster Rand, leichte Beulen (nur in Luft).
function canopy(b, blobs, salt, keepOut) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const { c, rx, ry, rz } of blobs) {
    [rx, ry, rz].forEach((r, k) => {
      lo[k] = Math.min(lo[k], Math.floor(c[k] - r * 1.2));
      hi[k] = Math.max(hi[k], Math.ceil(c[k] + r * 1.2));
    });
  }
  const placed = [];
  for (let y = lo[1]; y <= hi[1]; y++) {
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let x = lo[0]; x <= hi[0]; x++) {
        let d = Infinity;
        for (const { c, rx, ry, rz } of blobs) d = Math.min(d, Math.hypot((x - c[0]) / rx, (y - c[1]) / ry, (z - c[2]) / rz));
        d *= 1 + (rand01(x >> 1, y >> 1, z >> 1, salt) - 0.5) * 0.25;
        const inCore = d <= 0.8;
        const inFray = d <= 1.12 && rand01(x, y, z, salt + 7) < (1.12 - d) / 0.32;
        if (!(inCore || inFray) || keepOut(x, y, z) || b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, LEAVES);
        placed.push([x, y, z]);
      }
    }
  }
  // Laubgruppen, die weder Holz noch älteres Laub berühren, wären nicht baubar und sehen wie Krümel aus: weg damit.
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const own = new Set(placed.map((p) => p.join(',')));
  const seen = new Set();
  for (const start of placed) {
    const k0 = start.join(',');
    if (seen.has(k0)) continue;
    const group = [start];
    seen.add(k0);
    let anchored = false;
    for (let i = 0; i < group.length; i++) {
      const [x, y, z] = group[i];
      for (const [dx, dy, dz] of N6) {
        const n = [x + dx, y + dy, z + dz];
        const k = n.join(',');
        if (own.has(k)) {
          if (!seen.has(k)) { seen.add(k); group.push(n); }
        } else if (b.get(...n) !== 'air') anchored = true;
      }
    }
    if (!anchored) for (const cell of group) b.remove(...cell);
  }
}

function ground(b) {
  b.phase('Waldboden', 'Leg den Waldboden aus: Gras auf zwei Ebenen Erde. Die Rieseneiche steht ungefähr in der Mitte, die zweite Eiche für die Hängebrücke 20 Blöcke weiter westlich.', {
    tips: ['Markier dir die beiden Stammmitten mit einem Block, bevor du anfängst – alle Maße hier gehen von ihnen aus.'],
  });
  terrain(b, { x: PLOT.x1, y: -2, z: PLOT.z1, width: PLOT.x2 - PLOT.x1 + 1, depth: PLOT.z2 - PLOT.z1 + 1, height: 2, seed: 11 });
}

function trunk(b) {
  b.phase('Stamm und Wurzeln', 'Bau den Stamm der Rieseneiche aus Eichenstämmen: bis Ebene 21 ist er 5 × 5 Blöcke mit abgeschnittenen Ecken, dann bis Ebene 26 3 × 3 und darüber noch drei einzelne Stämme. Am Fuß machen Eichenholz-Blöcke in den Ecken und Wurzeln, die über den Boden kriechen, den Stamm breiter.', {
    tips: ['Setz zuerst einen Ring der untersten Ebene und kontrollier die Form von oben – danach ist jede Ebene bis zur Verjüngung gleich.', 'Eichenholz (Holz mit Rinde auf allen Seiten) sieht an Wurzeln und Ästen besser aus als Stämme, weil keine Jahresringe zu sehen sind.'],
  });
  const trunkLayers = (y1, y2) => {
    for (let y = y1; y <= y2; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (isTrunk(x, y, z)) b.set(x, y, z, log(oak.log));
  };
  const bark = log(oak.wood);
  const flare = [
    [-2, 1, -2], [2, 1, -2], [-2, 1, 2], [2, 1, 2], [-2, 2, 2], [2, 2, -2],
    [-3, 1, 0], [-3, 2, 0], [-3, 3, 0], [-4, 1, 0], [-5, 1, 0], [-5, 1, -1], [-6, 1, -1],
    [-3, 1, 1], [-3, 1, -2], [-4, 1, -2], [-4, 1, -3],
    [0, 1, 3], [0, 2, 3], [1, 1, 3], [0, 1, 4], [-1, 1, 4], [-1, 1, 5],
    [3, 1, 0], [3, 2, 0], [4, 1, 0], [5, 1, 0], [5, 1, 1], [3, 1, -2], [3, 1, 2], [4, 1, 3],
  ];
  b.step('Wurzelansatz', 'Ebene 4 bis 6: die ersten drei Ringe des Stamms (5 × 5 ohne die vier Ecken) und rundherum Wurzeln aus Eichenholz – in die Ecken des Stamms, als Stummel nach außen und als lange Wurzeln über den Boden.');
  trunkLayers(1, 3);
  for (const [x, y, z] of flare) b.set(x, y, z, bark);
  b.step('Stamm bis Ebene 21', 'Setz Ring für Ring weiter, jede Ebene sieht gleich aus wie die unterste: 21 Stämme pro Ring, bis der Stamm auf Ebene 21 steht.');
  trunkLayers(4, 18);
  b.step('Verjüngung und Spitze', 'Ab Ebene 22 wird der Stamm 3 × 3 (bis Ebene 26), darüber kommen noch drei einzelne Stämme übereinander in die Mitte.');
  trunkLayers(19, 26);
}

function spiral(b) {
  b.phase('Wendeltreppe um den Stamm', 'Die Wendeltreppe aus Fichtentreppen läuft im Abstand von einem Block um den Stamm: Start an der Nordseite, dann im Uhrzeigersinn nach Osten, jede Stufe einen Block höher, bis sie auf Ebene 11 in der Plattform ankommt. Unter jede Stufe kommt eine umgedrehte Fichtentreppe – sie trägt die nächste Stufe und gibt der Treppe von unten eine glatte Schräge. Außen stehen Zaunpfosten als Geländer, je zwei übereinander.', {
    tips: ['Schau beim Setzen jeder Stufe in Laufrichtung, dann zeigt die hohe Seite richtig nach vorne.', 'Die Reihenfolge ist immer gleich: erst die umgedrehte Treppe neben die letzte Stufe, dann die neue Stufe obendrauf.'],
  });
  b.step('Stufen', 'Erste Stufe auf Ebene 4 direkt nördlich vom Stamm, Blick nach Osten. Die Eckstufe im Nordosten (Ebene 7) setzt du ebenfalls mit Blick nach Osten, erst danach drehst du dich nach Süden – so kommst du um die Ecke, ohne zu springen.');
  b.spiralStairs(0, 0, 1, P1_Y, 3, spruce.stairs);
  // Eckstufe zeigt in die Ankunftsrichtung: Nach Süden gedreht läge ihre hohe Hälfte quer im Weg (ein voller Block Absatz).
  b.set(3, 4, -3, st(spruce.stairs, 'east'));
  const ring = [];
  for (let y = 1; y <= P1_Y; y++) {
    for (let z = -3; z <= 3; z++) {
      for (let x = -3; x <= 3; x++) {
        if (Math.max(Math.abs(x), Math.abs(z)) !== 3) continue;
        const state = b.get(x, y, z);
        if (state.startsWith(`${spruce.stairs}[`)) ring.push({ x, y, z, facing: getProp(state, 'facing') });
      }
    }
  }
  for (const s of ring) if (s.y >= 2) b.set(s.x, s.y - 1, s.z, st(spruce.stairs, OPPOSITE[s.facing], 'top'));
  b.note(0, 1, -3, 'Hier beginnt die Wendeltreppe: von Westen her auf die erste Stufe.');

  b.step('Geländer', 'Neben jede Stufe zwei Fichtenzäune übereinander auf die Außenseite. Die Pfosten verbinden sich zu einem Geländer, das mit den Stufen ansteigt; zwei davon tragen eine Laterne.');
  for (const s of ring) {
    if (s.y >= P1_Y - 1) continue;
    const outs = [];
    if (Math.abs(s.z) === 3) outs.push([s.x, s.z + Math.sign(s.z)]);
    if (Math.abs(s.x) === 3) outs.push([s.x + Math.sign(s.x), s.z]);
    if (outs.length === 2) outs.push([s.x + Math.sign(s.x), s.z + Math.sign(s.z)]);
    for (const [x, z] of outs) for (const y of [s.y, s.y + 1]) if (b.get(x, y, z) === 'air') b.set(x, y, z, spruce.fence);
  }
  b.set(1, 4, -4, lantern());
  b.set(4, 6, -3, lantern());
}

// Kopfband-Strebe unter der Plattform: treppenförmig vom Stamm schräg hinauf zum Balken, unten mit Treppen geglättet.
function strut(b, x0, z0, dx, dz, outward, lift = 0) {
  const wood = log(spruce.wood);
  const at = (d, y, state) => b.set(x0 + dx * d, y, z0 + dz * d, state);
  for (let k = 0; k <= 2; k++) {
    at(3 + k, 3 + lift + k, wood);
    at(3 + k, 4 + lift + k, wood);
    at(4 + k, 3 + lift + k, st(spruce.stairs, OPPOSITE[outward], 'top'));
  }
  at(6, 6 + lift, wood);
  for (let d = 3; d <= 7; d++) at(d, P1_Y - 1, log(spruce.log, dx !== 0 ? 'x' : 'z'));
}

function lowerPlatform(b) {
  b.phase('Untere Plattform', 'Die Plattform liegt auf Ebene 11. Erst kommt das Tragwerk: zwei Streben am Stamm (nach Westen und nach Norden), zwei Pfosten unter der Hütte und die Balken. Dann legst du den Boden aus Fichtenbrettern mit einem Rand aus Fichtenholz und setzt ringsum ein Zaungeländer. Über dem Ende der Wendeltreppe bleiben vier Felder frei – drei für die Kopffreiheit, in das vierte kommt die oberste Stufe.', {
    tips: ['Die Streben sind Treppen aus Holzblöcken: Jeder Block berührt den vorigen mit einer Fläche, du kannst sie also ohne Hilfsblöcke vom Stamm aus hochbauen.', 'Den Boden baust du vom Stamm aus nach außen – jedes Brett klebt am vorigen.'],
  });
  b.step('Streben, Pfosten und Balken', 'Die Strebe nach Westen beginnt auf Ebene 6 direkt am Stamm, die nach Norden eine Ebene höher auf Ebene 7 – so stößt du am Fuß der Wendeltreppe nicht mit dem Kopf an. Die Pfosten unter den Südecken der Hütte reichen vom Boden bis Ebene 10, darauf liegen die Balken der Hütte.');
  strut(b, -1, 0, 0, -1, 'north', 1);
  strut(b, 0, 0, -1, 0, 'west');
  for (const x of [HOUSE.x1, HOUSE.x2]) b.fill(x, 1, HOUSE.z2, x, P1_Y - 1, HOUSE.z2, log(spruce.log));
  for (const x of [HOUSE.x1, HOUSE.x2]) b.fill(x, P1_Y - 1, HOUSE.z1 + 1, x, P1_Y - 1, HOUSE.z2 - 1, log(spruce.log, 'z'));
  b.fill(HOUSE.x1 + 1, P1_Y - 1, HOUSE.z2, HOUSE.x2 - 1, P1_Y - 1, HOUSE.z2, log(spruce.log, 'x'));

  b.step('Boden', 'Fichtenbretter auf die Balken, außen eine Reihe Fichtenholz als Rand.');
  const list = cells(inP1, -7, -7, 7, 9);
  const edge = floorWithRim(b, inP1, list, P1_Y, (x, z) => isTrunk(x, P1_Y, z) || SPIRAL_HOLE.has(key(x, z)));

  b.step('Geländer', 'Zaun auf den Rand. Im Westen bleibt die Lücke für die Hängebrücke, um das Treppenloch stehen fünf Zaunpfosten.');
  for (const [x, z] of edge) {
    if (x <= -5 && z >= 0 && z <= 2) continue;
    b.set(x, P1_Y + 1, z, spruce.fence);
  }
  for (const [x, z] of [[4, -2], [4, -1], [4, 0], [3, -3], [2, -2]]) b.set(x, P1_Y + 1, z, spruce.fence);
  b.note(3, P1_Y, 1, 'Ende der Wendeltreppe: Hier trittst du auf die Plattform.');
}

function cabin(b) {
  b.phase('Hütte', 'Die Hütte steht auf der Südseite der Plattform, ihre Rückwand ist der Stamm selbst. Wände aus Fichtenbrettern mit Ecken aus Eichenstämmen, 4 Blöcke hoch. Das Satteldach aus Schwarzeichentreppen baust du um den Stamm herum.');
  b.step('Wände', 'Erst die vier Eckstämme 4 hoch, dann die Bretter dazwischen. Wo die Nordwand auf den Stamm trifft, endet sie am Stamm.');
  const top = HOUSE_TOP;
  for (let y = P1_Y + 1; y <= top; y++) {
    for (let x = HOUSE.x1; x <= HOUSE.x2; x++) for (const z of [HOUSE.z1, HOUSE.z2]) if (!isTrunk(x, y, z)) b.set(x, y, z, spruce.planks);
    for (let z = HOUSE.z1; z <= HOUSE.z2; z++) for (const x of [HOUSE.x1, HOUSE.x2]) b.set(x, y, z, spruce.planks);
    for (const [x, z] of [[HOUSE.x1, HOUSE.z1], [HOUSE.x2, HOUSE.z1], [HOUSE.x1, HOUSE.z2], [HOUSE.x2, HOUSE.z2]]) b.set(x, y, z, log(oak.log));
  }
  b.step('Fenster und Tür', 'Glasscheiben mit Läden aus Fichtenfalltüren, vorne ein Blumenkasten, die Tür auf der Ostseite und daneben eine Laterne am Wandarm.');
  const shutters = spruce.trapdoor;
  window(b, { x: -2, y: P1_Y + 2, z: HOUSE.z2, facing: 'south', width: 2, height: 2, shutters, flowerBox: true });
  window(b, { x: 2, y: P1_Y + 2, z: HOUSE.z2, facing: 'south', width: 1, height: 2, shutters });
  window(b, { x: HOUSE.x1, y: P1_Y + 2, z: 5, facing: 'west', width: 2, height: 2, shutters });
  doorway(b, { x: HOUSE.x2, y: P1_Y + 1, z: 4, facing: 'east', door: spruce.door, frame: null });
  window(b, { x: HOUSE.x2, y: P1_Y + 2, z: 6, facing: 'east', width: 1, height: 2, shutters });
  wallLantern(b, { x: HOUSE.x2, y: P1_Y + 3, z: 3, facing: 'east', style: 'bracket', arm: spruce.fence });

  b.step('Dach', 'Satteldach mit einem Block Überstand: Schwarzeichentreppen mit der hohen Seite zum First, der First aus Schwarzeichenstufen. Wo der Stamm durch das Dach geht, lässt du die Treppen weg. Die Giebel füllst du mit Fichtenbrettern und setzt je ein kleines Fenster hinein.');
  gableRoofAroundTrunk(b, { x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z2, y: top, overhang: 1 });
}

// Satteldach mit First entlang x, das Stammblöcke ausspart (b.roof würde sie überschreiben).
function gableRoofAroundTrunk(b, { x1, z1, x2, z2, y, overhang }) {
  const dark = WOOD.schwarzeiche;
  const za = z1 - overhang;
  const zb = z2 + overhang;
  const mid = (za + zb) / 2;
  for (let z = za; z <= zb; z++) {
    const h = y + Math.min(z - za, zb - z);
    for (let x = x1 - overhang; x <= x2 + overhang; x++) {
      if (isTrunk(x, h, z)) continue;
      b.set(x, h, z, z === mid ? slab(dark.slab) : st(dark.stairs, z < mid ? 'south' : 'north'));
      if (z >= z1 && z <= z2 && (x === x1 || x === x2)) for (let yy = y + 1; yy < h; yy++) b.set(x, yy, z, spruce.planks);
    }
  }
  window(b, { x: x1, y: y + 1, z: mid, facing: 'west', width: 1, height: 2 });
  window(b, { x: x2, y: y + 1, z: mid, facing: 'east', width: 1, height: 2 });
}

function upperPlatform(b) {
  b.phase('Leiter und Aussichtsplattform', 'Eine Leiter an der Nordseite des Stamms führt von der unteren Plattform hinauf zur Aussichtsplattform auf Ebene 20. Sie ist ein Halbkreis auf der Nordseite, ruht auf drei Konsolen am Stamm und hat ein Zaungeländer mit Laternen.');
  b.step('Leiter', 'Häng die Leiter an die Nordseite des Stamms, von der Plattform bis ganz oben – das oberste Stück steckt im Loch der Aussichtsplattform.');
  for (let y = P1_Y + 1; y <= P2_Y; y++) b.set(0, y, -3, formatState('ladder', { facing: 'north' }));
  b.step('Konsolen', 'Drei Streben aus Fichtenholz unter der Plattform, jeweils vom Stamm aus treppenförmig nach außen.');
  const wood = log(spruce.wood);
  faceWalk(b, [-2, 14, -1], [-4, 16, -3], wood);
  faceWalk(b, [2, 14, -1], [4, 16, -3], wood);
  faceWalk(b, [1, 14, -3], [1, 16, -5], wood);
  b.step('Boden und Geländer');
  const list = cells(inP2, -6, -6, 6, -1);
  const edge = floorWithRim(b, inP2, list, P2_Y, (x, z) => isTrunk(x, P2_Y, z) || (x === 0 && z === -3));
  for (const [x, z] of edge) b.set(x, P2_Y + 1, z, spruce.fence);
  for (const [x, z] of [[-5, -2], [5, -2], [-2, -5], [2, -5]]) if (b.get(x, P2_Y + 1, z) === spruce.fence) b.set(x, P2_Y + 2, z, lantern());
  b.set(-1, P2_Y + 1, -3, spruce.fence);
  b.set(1, P2_Y + 1, -3, spruce.fence);
  b.note(0, P2_Y, -3, 'Oberes Ende der Leiter.');
}

function secondTree(b) {
  b.phase('Zweite Eiche, Plattform und Hängebrücke', 'Westlich steht eine zweite, kleinere Eiche mit einem Stamm in Kreuzform. Um sie kommt eine runde Plattform auf derselben Höhe wie die große, mit einer Leiter am Stamm. Dazwischen spannst du die Hängebrücke.', {
    tips: ['Der Durchhang entsteht durch Stufen: oben, unten, eine Ebene tiefer oben, unten … bis zur Mitte und auf der anderen Seite wieder hinauf.'],
  });
  b.step('Stamm', 'Der Stamm ist ein Kreuz aus fünf Eichenstämmen bis Ebene 15, darüber ein einzelner Stamm. Ein paar Wurzeln aus Eichenholz am Fuß.');
  for (let y = 1; y <= 15; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (isTrunk2(TREE2.x + dx, y, TREE2.z + dz)) b.set(TREE2.x + dx, y, TREE2.z + dz, log(oak.log));
  for (const [dx, dz] of [[1, 1], [-1, -1], [2, 0], [0, 2], [3, 0], [1, -1]]) b.set(TREE2.x + dx, 1, TREE2.z + dz, log(oak.wood));

  b.step('Plattform', 'Unter die Plattform kommen umgedrehte Fichtentreppen rund um den Stamm als Konsolen. Dann Boden mit Holzrand, Zaungeländer mit der Lücke zur Brücke im Osten und die Leiter an der Westseite des Stamms bis hinunter zum Boden.');
  for (const [dx, dz, f] of [[2, 0, 'west'], [0, -2, 'south'], [0, 2, 'north'], [1, 1, 'west'], [1, -1, 'west'], [-1, 1, 'east'], [-1, -1, 'east']]) b.set(TREE2.x + dx, P1_Y - 1, TREE2.z + dz, st(spruce.stairs, f, 'top'));
  const list = cells(inP3, TREE2.x - 4, TREE2.z - 4, TREE2.x + 4, TREE2.z + 4);
  const edge = floorWithRim(b, inP3, list, P1_Y, (x, z) => isTrunk2(x, P1_Y, z) || (x === LADDER2.x && z === LADDER2.z));
  for (let y = 1; y <= P1_Y; y++) b.set(LADDER2.x, y, LADDER2.z, formatState('ladder', { facing: 'west' }));
  for (const [x, z] of edge) if (!(x >= TREE2.x + 3 && z >= 0 && z <= 2)) b.set(x, P1_Y + 1, z, spruce.fence);

  b.step('Hängebrücke', 'Zehn Felder lang und drei breit: Die mittlere Reihe ist der Laufweg, auf den Außenreihen läuft das Zaunseil. Wo das Seil eine Ebene springt, setzt du einen zweiten Zaun obendrauf, damit es durchgeht. An beiden Enden stehen Stammpfosten mit Laternen, unter dem Laufweg hängt eine Kette als Tragseil.');
  const surface = [9, 8.5, 8, 7.5, 7, 7, 7.5, 8, 8.5, 9];
  const slabY = surface.map((s) => (Number.isInteger(s) ? s - 1 : s - 0.5));
  const rope = slabY.map((y) => y + 1);
  for (let i = 0; i < surface.length; i++) {
    const x = -7 - i;
    const type = Number.isInteger(surface[i]) ? 'top' : 'bottom';
    for (let z = 0; z <= 2; z++) b.set(x, slabY[i], z, slab(spruce.slab, type));
    b.set(x, slabY[i] - 1, 1, formatState('iron_chain', { axis: 'x' }));
    if (i === 0 || i === surface.length - 1) continue;
    const highest = Math.max(rope[i], rope[i - 1], rope[i + 1]);
    for (const z of [0, 2]) for (let y = rope[i]; y <= Math.min(highest, rope[i] + 1); y++) b.set(x, y, z, spruce.fence);
  }
  for (const x of [-7, -16]) for (const z of [0, 2]) {
    b.set(x, P1_Y + 1, z, log(spruce.log));
    b.set(x, P1_Y + 2, z, spruce.fence);
    b.set(x, P1_Y + 3, z, lantern());
  }
  b.note(-11, 6, 1, 'Tiefster Punkt der Hängebrücke.');
}

const LIMBS = [
  { a: [1, 16, 1], c: [8, 21, 7] },
  { a: [-1, 16, 1], c: [-8, 21, 6] },
  { a: [1, 18, 1], c: [10, 22, 2] },
  { a: [-1, 18, 1], c: [-10, 23, 2] },
  { a: [0, 21, -1], c: [6, 25, -7] },
  { a: [0, 22, -1], c: [-6, 26, -6] },
];
const LIMBS2 = [
  { a: [TREE2.x, 11, TREE2.z], c: [TREE2.x - 4, 14, TREE2.z - 2] },
  { a: [TREE2.x, 11, TREE2.z], c: [TREE2.x + 3, 14, TREE2.z + 3] },
  { a: [TREE2.x, 12, TREE2.z], c: [TREE2.x + 1, 15, TREE2.z - 4] },
];

// Freiräume, in die kein Laub wachsen soll: über der Aussichtsplattform und über der kleinen Plattform.
const keepOutMain = (x, y, z) => y >= P2_Y && y <= P2_Y + 3 && z <= 0 && x * x + z * z <= 49;
const keepOutSecond = (x, y, z) => y <= P1_Y + 3 && (x - TREE2.x) ** 2 + (z - TREE2.z) ** 2 <= 30;

function crown(b) {
  b.phase('Äste und Krone', 'Jetzt die Krone: Sechs dicke Äste aus Eichenholz wachsen schräg aus dem Stamm nach außen und oben – unten 3 Blöcke dick, am Ende nur noch einer. Darauf setzt du große Blätterwolken, die zusammen eine geschlossene Krone ergeben. Über der Aussichtsplattform bleibt ein Freiraum, damit du dort stehen kannst.', {
    tips: ['Bau jeden Ast zuerst als einfache Linie aus Holzblöcken (jeder Block berührt den vorigen mit einer Fläche), dann machst du ihn mit weiteren Blöcken ringsum dick.', 'Selbst gesetztes Laub verrottet nicht. Für den ausgefransten Rand lässt du außen einfach jeden zweiten bis dritten Block weg.'],
  });
  b.step('Äste der Rieseneiche');
  const skipMain = (x, y, z) => keepOutMain(x, y, z) || isTrunk(x, y, z);
  for (const { a, c } of LIMBS) limb(b, a, c, 1.3, 0.5, oak.wood, skipMain);
  b.step('Äste der zweiten Eiche');
  for (const { a, c } of LIMBS2) limb(b, a, c, 0.9, 0.5, oak.wood, (x, y, z) => isTrunk2(x, y, z));
  b.step('Blätterdach der Rieseneiche', 'Um jedes Astende eine flache Wolke aus Eichenlaub (etwa 11 breit und 6 hoch), oben auf dem Stamm die größte. Zwischen den Ästen füllst du auf, bis keine Lücken mehr sind.');
  const blobs = LIMBS.map(({ c }) => ({ c: [c[0], c[1] + 1.5, c[2]], rx: 5.5, ry: 3.2, rz: 5.5 }));
  blobs.push({ c: [0, 27, 0], rx: 7, ry: 4, rz: 7 });
  for (let i = 0; i < LIMBS.length; i++) {
    const p = LIMBS[i].c;
    const q = LIMBS[(i + 2) % LIMBS.length].c;
    blobs.push({ c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 1, (p[2] + q[2]) / 2], rx: 4.5, ry: 3, rz: 4.5 });
  }
  canopy(b, blobs, 101, keepOutMain);
  b.step('Blätterdach der zweiten Eiche');
  const blobs2 = LIMBS2.map(({ c }) => ({ c: [c[0], c[1] + 1, c[2]], rx: 4, ry: 2.6, rz: 4 }));
  blobs2.push({ c: [TREE2.x, 16, TREE2.z], rx: 4.5, ry: 3, rz: 4.5 });
  canopy(b, blobs2, 202, keepOutSecond);
}

function furnish(b) {
  b.phase('Einrichtung', 'Richte die Hütte ein und stell auf die Plattformen ein paar Dinge zum Ausruhen. Unter der Hütte hängt eine Schaukel an Ketten.');
  b.step('Hütte', 'Bett mit dem Kopfteil am Stamm, Nachttisch und Truhe, dazu ein Tisch mit zwei Stühlen, Werkbank, Fass, Bücherregal und ein Wandregal.');
  const y = P1_Y + 1;
  bedroom(b, { x: -3, y, z: 3, facing: 'south', width: 4, depth: 5, wood: 'fichte', color: 'gruen', rug: 'braun' });
  b.set(2, y, 6, slab(spruce.slab, 'top'));
  b.set(2, y + 1, 6, 'potted_red_tulip');
  b.set(2, y, 7, st(spruce.stairs, 'south'));
  b.set(3, y, 6, st(spruce.stairs, 'east'));
  b.set(1, y, 3, 'crafting_table');
  b.set(2, y, 3, formatState('barrel', { facing: 'up' }));
  b.set(3, y, 3, 'bookshelf');
  b.set(3, y + 1, 3, 'potted_fern');
  b.set(0, y + 2, 3, formatState(spruce.shelf, { facing: 'south' }));

  b.step('Plattformen', 'Unten eine Bank aus Treppen mit Blick nach Norden und ein Fass mit Topfpflanze, oben eine lange Bank und eine Truhe, auf der kleinen Plattform eine Bank am Geländer.');
  for (const x of [-4, -3]) b.set(x, P1_Y + 1, -4, st(spruce.stairs, 'south'));
  b.set(-5, P1_Y + 1, -3, formatState('barrel', { facing: 'up' }));
  b.set(-5, P1_Y + 2, -3, 'potted_azalea_bush');
  b.set(5, P1_Y + 1, 6, formatState('composter', { level: '0' }));
  for (const x of [-2, -1, 1, 2]) b.set(x, P2_Y + 1, -4, st(spruce.stairs, 'south'));
  b.set(3, P2_Y + 1, -2, formatState('chest', { facing: 'west', type: 'single' }));
  for (const dx of [-1, 0, 1]) b.set(TREE2.x + dx, P1_Y + 1, TREE2.z - 2, st(spruce.stairs, 'south'));
  b.set(TREE2.x, P1_Y + 1, TREE2.z + 2, formatState('barrel', { facing: 'up' }));
  b.set(TREE2.x, P1_Y + 2, TREE2.z + 2, 'potted_red_mushroom');

  b.step('Schaukel', 'Zwei Ketten hängen unter dem Südrand der Plattform, unten hält eine Reihe oberer Fichtenstufen als Sitz.');
  for (const x of [-3, -1]) b.fill(x, 4, 9, x, P1_Y - 1, 9, formatState('iron_chain', { axis: 'y' }));
  b.fill(-3, 3, 9, -1, 3, 9, slab(spruce.slab, 'top'));
}

function lights(b) {
  b.phase('Licht', 'Laternen gegen Monster: in der Hütte an der Decke, unter der Plattform an den Balken und auf den Geländerpfosten.');
  b.step('Laternen');
  lightRoom(b, { x1: HOUSE.x1 + 1, y1: P1_Y + 1, z1: HOUSE.z1 + 1, x2: HOUSE.x2 - 1, y2: HOUSE_TOP, z2: HOUSE.z2 - 1 });
  for (const [x, z] of [[-4, 4], [4, 6], [-7, 0], [-1, -7]]) b.set(x, P1_Y - 2, z, lantern(true));
  for (const [x, z] of [[-5, -3], [6, 3], [-4, 5], [4, -5], [-2, 6]]) if (b.get(x, P1_Y + 1, z) === spruce.fence) b.set(x, P1_Y + 2, z, lantern());
  for (const [x, z] of [[TREE2.x, TREE2.z - 3], [TREE2.x, TREE2.z + 3]]) if (b.get(x, P1_Y + 1, z) === spruce.fence) b.set(x, P1_Y + 2, z, lantern());
}

function surroundings(b) {
  b.phase('Waldboden gestalten', 'Zum Schluss der Wald drumherum: ein Pfad zur Wendeltreppe, Felsen mit Moos, Büsche, Farne und Blumen und eine Feuerstelle mit Sitzbänken aus Stämmen.');
  b.step('Pfad und Feuerstelle');
  pathAlong(b, { y: 0, points: [[-3, PLOT.z1 + 1], [-4, -9], [-2, -4]], width: 2, mix: 'gemischt', wiggle: 1, seed: 3 });
  b.set(9, 0, -6, 'cobblestone');
  b.set(9, 1, -6, formatState('campfire', { lit: 'true', signal_fire: 'false', facing: 'south' }));
  b.set(8, 1, -8, log(spruce.log, 'x'));
  b.set(9, 1, -8, log(spruce.log, 'x'));
  b.set(11, 1, -6, log(spruce.log, 'z'));
  b.set(11, 1, -5, log(spruce.log, 'z'));
  b.step('Felsen, Büsche und Blumen');
  rock(b, { x: -10, y: 1, z: -9, size: 'mittel', material: 'andesit', seed: 2 });
  rock(b, { x: 10, y: 1, z: 11, size: 'klein', seed: 5 });
  for (const [x, z, s] of [[-10, 10, 'mittel'], [10, 3, 'klein'], [-24, -10, 'mittel'], [-14, 11, 'klein'], [11, -12, 'klein'], [-25, 11, 'klein']]) bush(b, { x, y: 1, z, size: s, leaves: 'eiche', seed: x * 3 + z });
  flowerBed(b, { x: -3, y: 0, z: 12, width: 7, depth: 2, facing: 'south', palette: 'wiese', seed: 4 });
  b.step('Bewuchs');
  vegetation(b, { x: PLOT.x1, y: 0, z: PLOT.z1, width: PLOT.x2 - PLOT.x1 + 1, depth: PLOT.z2 - PLOT.z1 + 1, mix: 'wald', density: 0.3, shape: 'eckig', seed: 7 });
}

export default function build(b) {
  ground(b);
  trunk(b);
  spiral(b);
  lowerPlatform(b);
  cabin(b);
  upperPlatform(b);
  secondTree(b);
  crown(b);
  furnish(b);
  lights(b);
  surroundings(b);
}
