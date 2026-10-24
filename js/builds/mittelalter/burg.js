// Burg mit Bergfried: quadratische Ringmauer (51 × 51) mit Wehrgang und Zinnen, vier runden Ecktürmen, Torhaus mit
// Fallgitter im Süden, freistehendem Bergfried mit Hocheingang, Burghof mit Brunnen, Stall und Schmiede.
// Koordinaten: Burgmitte x = 0, z = 0; Tor im Süden (+z); Gelände-Oberkante y = 0.

import {
  STONE, WOOD, COLOR, arch, arrowSlit, battlements, doorway, window, straightStairs, timberWall, hangingLantern, wallLantern,
  lampPost, bedroom, storage, workshop, diningTable, lightRoom, floorPattern, terrain, pathAlong, tree, bush, rock,
  flowerBed, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'burg',
  title: 'Burg mit Bergfried',
  category: 'mittelalter',
  subtitle: 'Ringmauer, vier Ecktürme, Torhaus, Bergfried und Burghof',
  tags: ['Burg', 'Mittelalter', 'Bergfried', 'Ringmauer', 'Torhaus', 'Fallgitter', 'Wehrgang', 'Zinnen', 'Brunnen', 'Stall', 'Schmiede', 'Riesenprojekt'],
  aliases: [
    'burg', 'burg mit bergfried', 'castle', 'medieval castle', 'mittelalterliche burg', 'ritterburg', 'knight castle',
    'bergfried', 'keep', 'donjon', 'festung', 'fortress', 'burganlage', 'schloss mittelalter', 'bug', 'burk', 'castel', 'big castle',
  ],
  accuracy: 'eigenes',
  difficulty: 5,
  description: 'Eine komplette Höhenburg zum Nachbauen: quadratische Ringmauer mit Wehrgang und Zinnen auf Konsolen, vier '
    + 'runde Ecktürme und ein Torhaus mit Spitzbogen, halb hochgezogenem Fallgitter und Wachstube. Im Burghof steht der '
    + '33 Blöcke hohe Bergfried mit Hocheingang über eine Holztreppe, Verlies, drei Stockwerken und Dachhaus. Dazu ein '
    + 'Brunnen mit Dach, ein Pferdestall mit Pultdach und eine Schmiede mit Esse, Amboss und Lavakessel.',
  facts: [
    'Ringmauer 51 × 51 Blöcke, 3 Blöcke dick, Wehrgang 10 Blöcke über dem Burghof; mit Türmen rund 61 × 61.',
    'Ecktürme 11 Blöcke Durchmesser und 20 Blöcke hoch, Torhaus 19 breit, die Flankentürme springen 6 Blöcke vor die Mauer.',
    'Bergfried 9 × 9 mit 2 Blöcke dicken Mauern; der Eingang liegt im ersten Stock – unten ist nur das Verlies.',
    'Alle Innenräume, Stall und Schmiede sind ausgeleuchtet; der Burghof hat Laternen an den Wegen.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const stone = STONE.steinziegel;
const slate = STONE.tiefenschiefer;
const spruce = WOOD.fichte;
const darkOak = WOOD.schwarzeiche;

const OUT = 25; // Außenseite der Ringmauer
const IN = 23; // Hofseite der Ringmauer (Mauer 23 … 25)
const TOP = 9; // Wehrgang-Boden
const SPAN = 19; // Mauer zwischen den Ecktürmen: −19 … 19
const TOWER = { c: 25, r: 5, top: 16, ladder: [21, 25] }; // Eckturm (lokal: Südost-Ecke)
const GATE = { x: 9, z1: 20, z2: 29, tz: 31, top: 16, roomFloor: 9, roomTop: 13, portcullis: 28 }; // tz = Front der Tortürme
const KEEP = { x1: -15, x2: -7, z1: -19, z2: -11, top: 25, floors: [7, 13, 19] };
const BUTTRESSES = [-14, -7, 0, 7, 14]; // Strebepfeiler außen an jeder Mauerseite
const STABLE = { x1: 15, x2: 22, z1: -8, z2: 8 };
const SMITHY = { x1: -22, x2: -16, z1: 6, z2: 16 };
const BASE = -4;
const lvl = (y) => y - BASE + 1;
const ROTATIONS = [0, 90, 180, 270]; // Süd, West, Nord, Ost

function wallStone(b, y) {
  if (y <= 2) return b.pickWeighted([[stone.block, 5], [stone.mossy, 3], [stone.rough, 1], ['mossy_cobblestone', 1]]);
  return b.pickWeighted([[stone.block, 12], [stone.mossy, 2], [stone.cracked, 2]]);
}

// Ein Teil der Steinziegel wird bemoost oder rissig.
function weather(b, x1, y1, z1, x2, y2, z2, share) {
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (b.get(x, y, z) === stone.block && b.chance(share)) b.set(x, y, z, b.chance(0.6) ? stone.mossy : stone.cracked);
      }
    }
  }
}

// Zellen einer runden Scheibe: Rand (shell) und Inneres.
function discCells(r) {
  const inDisc = (dx, dz) => dx * dx + dz * dz <= (r + 0.5) ** 2;
  const shell = [];
  const inner = [];
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!inDisc(dx, dz)) continue;
      const edge = !inDisc(dx + 1, dz) || !inDisc(dx - 1, dz) || !inDisc(dx, dz + 1) || !inDisc(dx, dz - 1);
      (edge ? shell : inner).push([dx, dz]);
    }
  }
  return { shell, inner, inDisc };
}

// Welt-Koordinaten eines lokalen Punkts (Drehung um die Burgmitte wie b.transform).
function toWorld(rotate, x, z) {
  if (rotate === 0) return [x, z];
  if (rotate === 90) return [-z, x];
  if (rotate === 180) return [-x, -z];
  return [z, -x];
}

function eachSide(b, draw) {
  for (const rotate of ROTATIONS) b.transform({ rotate }, () => draw(rotate));
}

// ------------------------------------------------------------------ Gelände

function ground(b) {
  b.phase('Gelände und Fundamente', 'Leg den Bauplatz an (eine Wiese 77 × 81 Blöcke) und grab die Fundamente ein: unter der '
    + 'ganzen Ringmauer und den Türmen eine Ebene Bruchstein. Im Hof bekommt der Brunnen gleich seinen Schacht: 3 × 3 Wasser, '
    + '3 Ebenen tief, rundherum und darunter Steinziegel.', {
    tips: [
      'Steck zuerst die vier Turmmitten ab (je 25 Blöcke von der Burgmitte nach Ost/West und Nord/Süd) – daran hängt alles andere.',
      'Die Burg ist auf allen vier Seiten gleich gebaut: hast du eine Seite fertig, wiederholst du sie dreimal um 90° gedreht.',
    ],
  });
  terrain(b, { x: -38, y: BASE, z: -38, width: 77, depth: 81, height: -BASE, surface: 'gras', seed: 'burg' });
  eachSide(b, () => {
    b.fill(-SPAN, 0, IN, SPAN, 0, OUT, stone.rough);
    for (const [dx, dz] of [...discCells(TOWER.r).shell, ...discCells(TOWER.r).inner]) b.set(TOWER.c + dx, 0, TOWER.c + dz, stone.rough);
  });
  for (let x = -GATE.x; x <= GATE.x; x++) {
    const zMax = Math.abs(x) >= 3 ? GATE.tz : GATE.z2;
    for (let z = GATE.z1; z <= zMax; z++) b.set(x, 0, z, stone.rough);
  }
  for (let x = KEEP.x1; x <= KEEP.x2; x++) for (let z = KEEP.z1; z <= KEEP.z2; z++) b.set(x, 0, z, stone.rough);
  b.fill(-2, -3, -2, 2, 0, 2, stone.block);
  for (let y = -2; y <= 0; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) b.set(x, y, z, 'water[level=0]');
}

// ------------------------------------------------------------------ Ringmauer und Ecktürme

function curtainWalls(b) {
  b.phase('Ringmauer', `Zieh die Ringmauer 3 Blöcke dick bis Ebene ${lvl(TOP)} hoch, auf jeder Seite 39 Blöcke lang zwischen `
    + 'den Ecktürmen. Im Süden bleibt in der Mitte die Lücke für das Torhaus (19 Blöcke). Unten mischst du Bruchstein und '
    + 'Moos unter die Steinziegel, außen am Fuß läuft ein Sockel aus Bruchsteintreppen.');
  eachSide(b, (rotate) => {
    for (let x = -SPAN; x <= SPAN; x++) {
      if (rotate === 0 && Math.abs(x) <= GATE.x) continue;
      for (let y = 1; y <= TOP; y++) for (let z = IN; z <= OUT; z++) b.set(x, y, z, wallStone(b, y));
      b.stairs(x, 1, OUT + 1, 'cobblestone_stairs', { facing: 'north' });
    }
  });
  b.phase('Strebepfeiler', `Damit die lange Mauer nicht flach wirkt, setzt du außen alle 7 Blöcke einen Strebepfeiler: 1 Block `
    + `vor der Mauer, von Ebene ${lvl(1)} bis ${lvl(TOP - 2)} aus Steinziegeln (unten Bruchstein), oben eine Steinziegeltreppe mit `
    + 'der hohen Seite zur Mauer, unten davor eine Bruchsteintreppe als Fuß. Je Seite sind es fünf; im Süden fallen die drei '
    + 'mittleren weg, dort steht das Torhaus.');
  eachSide(b, (rotate) => {
    for (const x of BUTTRESSES) {
      if (rotate === 0 && Math.abs(x) <= GATE.x + 1) continue;
      for (let y = 1; y <= TOP - 2; y++) b.set(x, y, OUT + 1, y <= 2 ? stone.rough : wallStone(b, y));
      b.stairs(x, TOP - 1, OUT + 1, stone.stairs, { facing: 'north' });
      b.stairs(x, 1, OUT + 2, 'cobblestone_stairs', { facing: 'north' });
    }
  });
}

function cornerTower(b) {
  const { c, r, top } = TOWER;
  const { shell, inner } = discCells(r);
  for (let y = 1; y <= top; y++) for (const [dx, dz] of shell) b.set(c + dx, y, c + dz, wallStone(b, y));
  for (const y of [TOP, top]) for (const [dx, dz] of inner) b.set(c + dx, y, c + dz, y === top ? stone.block : spruce.planks);
  for (const [dx, dz] of inner) b.set(c + dx, 0, c + dz, b.pickWeighted([[stone.block, 2], [stone.rough, 1]]));
  for (const y of [TOP, top]) b.remove(TOWER.ladder[0], y, TOWER.ladder[1]);
  // Sockel auf der Feldseite.
  for (const [dx, dz] of discCells(r + 1).shell) {
    if (dx < 0 && dz < 0) continue;
    const x = c + dx;
    const z = c + dz;
    if ((x <= SPAN && z >= IN) || (z <= SPAN && x >= IN)) continue;
    b.set(x, 1, z, b.pickWeighted([[stone.rough, 2], ['mossy_cobblestone', 1]]));
    b.slab(x, 2, z, 'cobblestone_slab', { type: 'bottom' });
  }
}

function towers(b) {
  b.phase('Ecktürme', `Die vier Ecktürme sind rund (11 Blöcke Durchmesser) und stehen mit ihrer Mitte genau auf der Mauerecke. `
    + `Mauere die runde Wand bis Ebene ${lvl(TOWER.top)} hoch. Innen kommt auf Wehrganghöhe (Ebene ${lvl(TOP)}) ein Holzboden, `
    + 'oben eine Steindecke, beide mit einem Loch für die Leiter. Außen umgibt ein Sockel aus Bruchstein und Stufen den Fuß.', {
    tips: ['Ein Ring mit 11 Blöcken Durchmesser hat je Seite 5 gerade Blöcke, dann Stufen zu 2, 1 und 1 Block bis zur nächsten Seite.'],
  });
  eachSide(b, () => cornerTower(b));
}

// ------------------------------------------------------------------ Torhaus

function gatehouse(b) {
  const { x: gx, z1, z2, tz, top, roomFloor, roomTop } = GATE;
  b.phase('Torhaus', 'Das Torhaus füllt die Lücke in der Südmauer: zwei Flankentürme (7 × 12), die 6 Blöcke vor die Mauer '
    + 'springen, und dazwischen die 2 Blöcke zurückgesetzte Durchfahrt mit spitzem Bogen (5 breit, 6 hoch). So liegt das Tor in '
    + 'einer Nische, die man von beiden Türmen aus beschießen kann. Über der Durchfahrt liegt die Wachstube, die Türme '
    + `haben Böden auf Wehrganghöhe (Ebene ${lvl(roomFloor)}) und gehen bis Ebene ${lvl(top)}.`, {
    tips: ['Mauer die Bogensteine Ebene für Ebene mit den Wänden hoch, dann brauchst du kein Gerüst.'],
  });
  for (let y = 1; y <= top; y++) {
    for (let z = z1; z <= tz; z++) {
      for (let x = -gx; x <= gx; x++) {
        const ax = Math.abs(x);
        const inTower = ax >= 3;
        const height = inTower ? top : roomTop;
        const front = inTower ? tz : z2;
        if (y > height || z > front) continue;
        const shell = ax === 3 || ax === gx || z === z1 || z === front;
        if (inTower) {
          const floor = y === roomFloor || y === top;
          if (shell || floor) b.set(x, y, z, shell ? wallStone(b, y) : (y === top ? stone.block : spruce.planks));
          else b.set(x, y, z, 'air');
        } else if (y > roomFloor && y < roomTop && !shell) b.set(x, y, z, 'air');
        else b.set(x, y, z, y === roomFloor && !shell ? spruce.planks : wallStone(b, y));
      }
    }
  }
  for (const side of [-1, 1]) for (const y of [roomFloor, top]) b.remove(side * 4, y, z1 + 1);
  arch(b, { x: 0, y: 1, z: z2, facing: 'south', width: 5, height: 6, style: 'pointed', depth: z2 - z1 + 1, block: stone.block, stairs: stone.stairs });
  for (let x = -2; x <= 2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, b.pickWeighted([[stone.rough, 3], [stone.block, 2], ['andesite', 1]]));
}

function portcullis(b) {
  const { z1, roomFloor, portcullis: pz } = GATE;
  b.step('Fallgitter und Torflügel', 'Das Fallgitter aus Eisengittern hängt in der vorletzten Reihe zum Feld hin: halb hochgezogen, '
    + 'unten 2 Blöcke frei, oben durch einen Schlitz in der Decke bis in die Wachstube, wo es an einem liegenden Stamm (der '
    + 'Winde) endet. Am Hofende stehen die offenen Torflügel aus Falltüren an den Wänden.');
  for (let y = 3; y <= roomFloor + 2; y++) {
    for (let x = -2; x <= 2; x++) if (b.get(x, y, pz) === 'air' || y >= 7) b.set(x, y, pz, 'iron_bars');
  }
  for (let x = -2; x <= 2; x++) b.set(x, roomFloor + 3, pz, `${spruce.strippedLog}[axis=x]`);
  for (let y = 1; y <= 4; y++) {
    for (const z of [z1 + 1, z1 + 2]) {
      b.set(-2, y, z, `${darkOak.trapdoor}[facing=east,half=bottom,open=true]`);
      b.set(2, y, z, `${darkOak.trapdoor}[facing=west,half=bottom,open=true]`);
    }
  }
  for (const z of [z1 + 3, z1 + 6]) hangingLantern(b, { x: 0, y: 6, z, chain: 0 });
  b.note(0, 3, pz, 'Fallgitter');
}

// ------------------------------------------------------------------ Wehrgang, Zinnen, Treppen

function walkways(b) {
  b.phase('Wehrgang und Zinnen', 'Auf der Feldseite springt die Brüstung einen Block vor: unten umgedrehte Steinziegeltreppen als '
    + `Konsolen (Ebene ${lvl(TOP)}), darauf Brüstung und Zinnen im Wechsel mit Stufen obenauf. Zum Hof hin sichert eine `
    + 'niedrige Steinziegelmauer den Wehrgang. Ecktürme, Torhaus und später der Bergfried bekommen ebenfalls Zinnen auf '
    + 'Konsolen, die Türme runde Zinnenkränze und Fahnen.', {
    tips: ['Zähl die Zinnen von einer Turmseite aus: Zinne, Lücke, Zinne … – die Reihe endet an jedem Turm auf einer Zinne.'],
  });
  eachSide(b, (rotate) => {
    const parts = rotate === 0 ? [[-SPAN, -GATE.x - 1], [GATE.x + 1, SPAN]] : [[-SPAN, SPAN]];
    for (const [x1, x2] of parts) {
      battlements(b, { x: x1, y: TOP + 1, z: OUT, facing: 'south', length: x2 - x1 + 1, block: stone.block, corbels: stone.stairs, cap: stone.slab });
      for (let x = x1; x <= x2; x++) {
        const [wx, wz] = toWorld(rotate, x, IN);
        if (isStairExit(wx, wz)) continue;
        b.set(x, TOP + 1, IN, stone.wall);
        if ((x - x1) % 8 === 4) b.set(x, TOP + 2, IN, 'lantern[hanging=false]');
      }
    }
    roundBattlements(b, 'blau');
  });
  gateBattlements(b);
  weather(b, -OUT - 6, TOP, -OUT - 6, OUT + 6, TOWER.top + 4, OUT + 6, 0.2);
}

// Austritte der beiden Mauertreppen auf den Wehrgang (Welt-Koordinaten der Brüstungslücke).
const WALL_STAIRS = [
  { x: 2, z: -IN + 1, facing: 'east', exit: [[10, -IN], [11, -IN]] },
  { x: IN - 1, z: -10, facing: 'north', exit: [[IN, -18], [IN, -19]] },
];
function isStairExit(x, z) {
  return WALL_STAIRS.some((s) => s.exit.some(([ex, ez]) => ex === x && ez === z));
}

function roundBattlements(b, color) {
  const { c, r, top } = TOWER;
  const ring = discCells(r + 1).shell.slice().sort((a, b2) => Math.atan2(a[1], a[0]) - Math.atan2(b2[1], b2[0]));
  ring.forEach(([dx, dz], i) => {
    const x = c + dx;
    const z = c + dz;
    const inward = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south');
    b.stairs(x, top, z, stone.stairs, { facing: inward, half: 'top' });
    b.set(x, top + 1, z, stone.block);
    if (i % 2 === 0) {
      b.set(x, top + 2, z, stone.block);
      b.slab(x, top + 3, z, stone.slab, { type: 'bottom' });
    }
  });
  b.fill(c, top + 1, c, c, top + 4, c, spruce.fence);
  b.set(c, top + 5, c, `${COLOR[color].banner}[rotation=0]`);
}

function gateBattlements(b) {
  const { x: gx, z1, z2, tz, top, roomTop } = GATE;
  for (const s of [-1, 1]) {
    const xo = s * gx;
    const xi = s * 3;
    // Turm: Feldseite, Außenseite, Hofseite und Innenseite (über dem Mitteldach).
    battlements(b, { x: s < 0 ? xo - 1 : xi, y: top + 1, z: tz, facing: 'south', length: gx - 3 + 2, corbels: stone.stairs, cap: stone.slab });
    battlements(b, { x: s < 0 ? xi : xo + 1, y: top + 1, z: z1, facing: 'north', length: gx - 3 + 2, corbels: stone.stairs, cap: stone.slab });
    battlements(b, { x: xo, y: top + 1, z: s < 0 ? z1 - 1 : tz + 1, facing: s < 0 ? 'west' : 'east', length: tz - z1 + 3, corbels: stone.stairs, cap: stone.slab });
    battlements(b, { x: xi, y: top + 1, z: s < 0 ? tz : z1, facing: s < 0 ? 'east' : 'west', length: tz - z1 + 1, cap: stone.slab });
  }
  battlements(b, { x: -2, y: roomTop + 1, z: z2, facing: 'south', length: 5, corbels: stone.stairs, cap: stone.slab });
  battlements(b, { x: 2, y: roomTop + 1, z: z1, facing: 'north', length: 5, corbels: stone.stairs, cap: stone.slab });
  for (const x of [-6, 6]) {
    b.fill(x, top + 1, 25, x, top + 4, 25, spruce.fence);
    b.set(x, top + 5, 25, `${COLOR.rot.banner}[rotation=0]`);
  }
}

function wallStairs(b) {
  b.step('Treppen zum Wehrgang', 'Zwei Steintreppen führen vom Hof auf den Wehrgang: eine an der Nordmauer (steigt nach Osten) und '
    + 'eine an der Ostmauer (steigt nach Norden), je 9 Stufen, darunter voll gemauert. Oben bleibt die Hofbrüstung offen.');
  for (const s of WALL_STAIRS) straightStairs(b, { x: s.x, y: 1, z: s.z, facing: s.facing, width: 1, height: TOP, stairs: stone.stairs, support: stone.block });
}

// ------------------------------------------------------------------ Bergfried

function keepShell(b) {
  const { x1, x2, z1, z2, top, floors } = KEEP;
  b.phase('Bergfried', 'Der Bergfried steht frei im Nordwesten des Hofs: 9 × 9 Blöcke mit 2 Blöcke dicken Mauern, innen bleibt ein '
    + `Raum von 5 × 5. Mauere ihn bis Ebene ${lvl(top)} hoch. Die Ecken setzt du als Eckquader aus poliertem Andesit und `
    + `Steinziegeln im Wechsel. Innen kommen Holzböden auf Ebene ${floors.map(lvl).join(', ')}, oben eine Steindecke – jeweils `
    + 'mit Leiterloch in der Nordostecke.', {
    tips: ['Ein 2 Blöcke dicker Ring braucht pro Ebene 56 Blöcke – rechne für den ganzen Turm mit gut 22 Stacks Stein.'],
  });
  for (let y = 1; y <= top; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        const ring = Math.min(x - x1, x2 - x, z - z1, z2 - z);
        if (ring >= 2 && y !== top && !floors.includes(y)) continue;
        const corner = (x === x1 || x === x2) && (z === z1 || z === z2);
        let state;
        if (ring >= 2) state = y === top ? stone.block : spruce.planks;
        else if (corner) state = y % 2 === 0 ? 'polished_andesite' : stone.block;
        else state = b.pickWeighted([[stone.block, 9], [stone.rough, 1], [stone.mossy, y < 6 ? 3 : 1], [stone.cracked, 1]]);
        b.set(x, y, z, state);
      }
    }
  }
  for (const y of [...floors.slice(1), top]) b.remove(x2 - 2, y, z1 + 2);
}

function keepTop(b) {
  const { x1, x2, z1, z2, top } = KEEP;
  b.step('Zinnen und Dachhaus des Bergfrieds', 'Oben bekommt der Bergfried einen Zinnenkranz auf Konsolen (11 × 11). Auf der '
    + 'Plattform steht ein kleines Dachhaus: vier Steinziegelpfeiler und ein Zeltdach aus Tiefenschieferziegeln, darauf der '
    + 'Fahnenmast mit rotem Banner. Die Falltür über der Leiter liegt daneben.');
  const sides = [
    { x: x1 - 1, z: z2, facing: 'south', length: x2 - x1 + 3 },
    { x: x2, z: z2 + 1, facing: 'east', length: z2 - z1 + 3 },
    { x: x2 + 1, z: z1, facing: 'north', length: x2 - x1 + 3 },
    { x: x1, z: z1 - 1, facing: 'west', length: z2 - z1 + 3 },
  ];
  for (const s of sides) battlements(b, { x: s.x, y: top + 1, z: s.z, facing: s.facing, length: s.length, corbels: stone.stairs, cap: stone.slab });
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.fill(cx + dx, top + 1, cz + dz, cx + dx, top + 3, cz + dz, stone.block);
  b.roof({ x1: cx - 1, z1: cz - 1, x2: cx + 1, z2: cz + 1, y: top + 4, type: 'pyramid', stairs: slate.tileStairs, slab: slate.tileSlab, full: slate.tiles, overhang: 1 });
  b.set(cx, top + 6, cz, slate.tiles);
  b.fill(cx, top + 7, cz, cx, top + 9, cz, spruce.fence);
  b.set(cx, top + 10, cz, `${COLOR.rot.banner}[rotation=0]`);
  hangingLantern(b, { x: cx, y: top + 4, z: cz, chain: 1 });
  b.set(x2 - 2, top, z1 + 2, `${spruce.trapdoor}[facing=west,half=top,open=false]`);
}

function keepEntrance(b) {
  const { z2, floors } = KEEP;
  const ex = -11;
  b.step('Hocheingang', `Der Bergfried hat keinen Eingang zu ebener Erde: Die Tür liegt auf Ebene ${lvl(floors[0] + 1)}. Davor `
    + 'baust du eine Holztreppe aus Fichte, die vom Hof senkrecht auf den Turm zuläuft, mit einem kleinen Podest vor der Tür. '
    + 'Im Ernstfall hätte man sie abbrennen können.', {
  });
  straightStairs(b, { x: ex, y: 1, z: z2 + 8, facing: 'north', width: 1, height: floors[0], stairs: spruce.stairs, support: spruce.planks, railing: spruce.fence });
  b.set(ex, floors[0], z2 + 1, spruce.planks);
  for (const x of [ex - 1, ex + 1]) {
    b.fill(x, 1, z2 + 1, x, floors[0], z2 + 1, `${spruce.log}[axis=y]`);
    b.set(x, floors[0] + 1, z2 + 1, spruce.fence);
  }
  doorway(b, { x: ex, y: floors[0] + 1, z: z2, facing: 'south', door: spruce.door, frame: null });
  b.set(ex, floors[0] + 1, z2 - 1, 'air');
  b.set(ex, floors[0] + 2, z2 - 1, 'air');
  wallLantern(b, { x: ex + 1, y: floors[0] + 2, z: z2, facing: 'south', style: 'bracket', arm: spruce.fence });
  b.note(ex, floors[0] + 1, z2, 'Hocheingang');
}

// ------------------------------------------------------------------ Öffnungen

function openings(b) {
  b.phase('Türen und Schießscharten', 'Jetzt schlägst du die Öffnungen heraus: Türen vom Hof in die Ecktürme und Torhaustürme, '
    + 'Türen vom Wehrgang in alle Türme, Kreuzscharten nach außen und schmale Fenster im Bergfried.');
  eachSide(b, () => {
    doorway(b, { x: 22, y: 1, z: 21, facing: 'north', door: spruce.door, frame: null });
    doorway(b, { x: 20, y: TOP + 1, z: 24, facing: 'west', door: spruce.door, frame: null });
    doorway(b, { x: 24, y: TOP + 1, z: 20, facing: 'north', door: spruce.door, frame: null });
    for (const y of [3, TOP + 2]) {
      arrowSlit(b, { x: TOWER.c + TOWER.r, y, z: TOWER.c, facing: 'east', height: 3, style: 'cross' });
      arrowSlit(b, { x: TOWER.c, y, z: TOWER.c + TOWER.r, facing: 'south', height: 3, style: 'cross' });
    }
  });
  const { x: gx, z1, z2, tz, roomFloor } = GATE;
  for (const s of [-1, 1]) {
    doorway(b, { x: s * 6, y: 1, z: z1, facing: 'north', door: spruce.door, frame: null });
    doorway(b, { x: s * gx, y: roomFloor + 1, z: 24, facing: s < 0 ? 'west' : 'east', door: spruce.door, frame: null });
    doorway(b, { x: s * 3, y: roomFloor + 1, z: 22, facing: s < 0 ? 'east' : 'west', door: spruce.door, frame: null });
    for (const y of [3, roomFloor + 2]) arrowSlit(b, { x: s * 6, y, z: tz, facing: 'south', height: 3, style: 'cross' });
    arrowSlit(b, { x: s * gx, y: 3, z: 27, facing: s < 0 ? 'west' : 'east', height: 3 });
    wallLantern(b, { x: s * 3, y: 3, z: tz - 1, facing: s < 0 ? 'east' : 'west', style: 'bracket', arm: spruce.fence });
    wallLantern(b, { x: s * 4, y: 3, z: z1, facing: 'north', style: 'bracket', arm: spruce.fence });
  }
  window(b, { x: 0, y: roomFloor + 1, z: z2, facing: 'south', width: 1, height: 2, glass: 'iron_bars' });
  const { x1, x2, z1: k1, z2: k2, floors } = KEEP;
  for (const y of [floors[0] + 2, floors[1] + 2, floors[2] + 2]) {
    arrowSlit(b, { x: x1, y, z: -15, facing: 'west', height: 2, depth: 2, fill: 'glass_pane' });
    arrowSlit(b, { x: x2, y, z: -15, facing: 'east', height: 2, depth: 2, fill: 'glass_pane' });
    arrowSlit(b, { x: -11, y, z: k1, facing: 'north', height: 2, depth: 2, fill: 'glass_pane' });
  }
  for (const y of [floors[1] + 2, floors[2] + 2]) arrowSlit(b, { x: -11, y, z: k2, facing: 'south', height: 2, depth: 2, fill: 'glass_pane' });
  arrowSlit(b, { x: -11, y: 3, z: k1, facing: 'north', height: 1, depth: 2, fill: 'iron_bars' });
}

// ------------------------------------------------------------------ Einrichtung

function interiors(b) {
  b.phase('Türme und Bergfried einrichten', 'Setz in allen Türmen die Leitern und richte die Räume ein. Jeder Raum bekommt Laternen, '
    + 'damit dort keine Monster spawnen.', {
    tips: ['Leitern setzt du von unten nach oben, immer mit Blick auf die Wand, an der sie hängen sollen.'],
  });
  b.step('Ecktürme', 'In jedem Eckturm führt eine Leiter von unten bis unter die Falltür im Dach. Unten lagern Fässer und Truhen, '
    + 'auf Wehrganghöhe stehen ein Tisch mit Hockern und ein Fass mit Pfeilen.');
  eachSide(b, () => {
    const { c, top, ladder } = TOWER;
    for (let y = 1; y < top; y++) b.set(ladder[0], y, ladder[1], 'ladder[facing=east]');
    b.set(ladder[0], top, ladder[1], `${spruce.trapdoor}[facing=east,half=top,open=false]`);
    storage(b, { x: c + 3, y: 1, z: c - 2, facing: 'west', width: 4, height: 2 });
    b.set(c, 1, c + 3, 'barrel[facing=up]');
    b.set(c + 1, 1, c + 3, 'barrel[facing=up]');
    hangingLantern(b, { x: c, y: TOP - 1, z: c, chain: 2 });
    b.set(c + 2, TOP + 1, c + 2, spruce.fence);
    b.set(c + 2, TOP + 2, c + 2, spruce.pressurePlate);
    b.stairs(c + 1, TOP + 1, c + 2, spruce.stairs, { facing: 'east' });
    b.stairs(c + 2, TOP + 1, c + 1, spruce.stairs, { facing: 'south' });
    b.set(c + 3, TOP + 1, c, 'barrel[facing=up]');
    hangingLantern(b, { x: c, y: top - 1, z: c, chain: 1 });
    lightRoom(b, { x1: c - 4, y1: 1, z1: c - 4, x2: c + 4, y2: TOP - 1, z2: c + 4 });
    lightRoom(b, { x1: c - 4, y1: TOP + 1, z1: c - 4, x2: c + 4, y2: top - 1, z2: c + 4 });
  });

  const { x: gx, z1, z2, tz, top, roomFloor, roomTop } = GATE;
  b.step('Torhaus', 'In beiden Torhaustürmen führt eine Leiter an der Innenwand bis aufs Dach. Unten lagern Truhen und Fässer, '
    + 'oben schlafen die Torwachen: zwei Betten an der Feldseite, ein Tisch mit Hockern, Truhe und Fass. In der Wachstube über '
    + 'der Durchfahrt stehen ein Tisch, Bänke und Truhen; hinter dem Fallgitter-Schlitz liegt die Winde.');
  for (const s of [-1, 1]) {
    const away = s < 0 ? 'west' : 'east'; // Leiter hängt an der Innenwand (x = ±3)
    for (let y = 1; y < top; y++) b.set(s * 4, y, z1 + 1, `ladder[facing=${away}]`);
    b.set(s * 4, top, z1 + 1, `${spruce.trapdoor}[facing=${away},half=top,open=false]`);
    storage(b, { x: s < 0 ? -gx + 1 : gx - 1, y: 1, z: s < 0 ? z2 - 1 : z1 + 3, facing: s < 0 ? 'east' : 'west', width: 4, height: 2 });
    hangingLantern(b, { x: s * 6, y: roomFloor - 1, z: 25, chain: 1 });
    hangingLantern(b, { x: s * 6, y: top - 1, z: 25, chain: 1 });
    bedroom(b, { x: s < 0 ? -4 : 8, y: roomFloor + 1, z: tz - 1, facing: 'north', width: 5, depth: 4, wood: 'fichte', color: 'blau', rug: null, double: true });
    b.set(s * 8, roomFloor + 1, z1 + 1, `chest[facing=${s < 0 ? 'east' : 'west'},type=single]`);
    b.set(s * 8, roomFloor + 1, z1 + 2, 'barrel[facing=up]');
    b.set(s * 6, roomFloor + 1, 25, spruce.fence);
    b.set(s * 6, roomFloor + 2, 25, spruce.pressurePlate);
    b.stairs(s * 6, roomFloor + 1, 24, spruce.stairs, { facing: 'north' });
    b.stairs(s * 6, roomFloor + 1, 26, spruce.stairs, { facing: 'south' });
    const rx1 = s < 0 ? -gx + 1 : 4;
    const rx2 = s < 0 ? -4 : gx - 1;
    lightRoom(b, { x1: rx1, y1: 1, z1: z1 + 1, x2: rx2, y2: roomFloor - 1, z2: tz - 1 });
    lightRoom(b, { x1: rx1, y1: roomFloor + 1, z1: z1 + 1, x2: rx2, y2: top - 1, z2: tz - 1 });
  }
  diningTable(b, { x: -1, y: roomFloor + 1, z: 24, facing: 'south', length: 3, width: 1, wood: 'fichte' });
  storage(b, { x: -2, y: roomFloor + 1, z: z2 - 2, facing: 'north', width: 2, height: 1, barrel: false });
  hangingLantern(b, { x: 0, y: roomTop - 1, z: 23, chain: 0 });
  lightRoom(b, { x1: -2, y1: roomFloor + 1, z1: z1 + 1, x2: 2, y2: roomTop - 1, z2: GATE.portcullis - 1 });
  lightRoom(b, { x1: -2, y1: 1, z1, x2: 2, y2: 6, z2 });

  keepInterior(b);
}

function keepInterior(b) {
  const { x1, x2, z1, z2, top, floors } = KEEP;
  const ix1 = x1 + 2;
  const ix2 = x2 - 2;
  const iz1 = z1 + 2;
  const iz2 = z2 - 2;
  b.step('Bergfried', 'Im Bergfried führt eine Leiter in der Nordostecke vom Eingangsgeschoss bis unter die Falltür. Unten liegt '
    + 'das Verlies – nur durch eine Eisenfalltür im Boden erreichbar, mit Ketten an der Wand und einer Seelenlaterne. Im '
    + 'Eingangsgeschoss ist die Wachstube, darüber die Kammer des Burgherrn, ganz oben die Rüstkammer.');
  for (let y = floors[0] + 1; y < top; y++) b.set(ix2, y, iz1, 'ladder[facing=west]');
  b.set(-11, floors[0], -15, 'iron_trapdoor[facing=south,half=top,open=false]');
  for (const [x, z] of [[ix1, iz1], [ix1, iz2], [ix2, iz2]]) b.fill(x, floors[0] - 2, z, x, floors[0] - 1, z, 'iron_chain[axis=y]');
  b.set(ix1 + 1, 1, iz1, 'skeleton_skull[rotation=4]');
  b.set(ix2, 1, iz2 - 1, 'cobweb');
  hangingLantern(b, { x: -11, y: floors[0] - 1, z: -14, chain: 1, lantern: 'soul_lantern' });
  lightRoom(b, { x1: ix1, y1: 1, z1: iz1, x2: ix2, y2: floors[0] - 1, z2: iz2 }, { lantern: 'soul_lantern' });

  diningTable(b, { x: ix1 + 1, y: floors[0] + 1, z: iz1 + 1, facing: 'south', length: 2, width: 1, wood: 'schwarzeiche', headChairs: false });
  storage(b, { x: ix1, y: floors[0] + 1, z: iz2, facing: 'north', width: 2, height: 1, barrel: false });
  b.set(ix2, floors[0] + 1, iz2, 'barrel[facing=up]');
  hangingLantern(b, { x: -11, y: floors[1] - 1, z: -15, chain: 0 });
  lightRoom(b, { x1: ix1, y1: floors[0] + 1, z1: iz1, x2: ix2, y2: floors[1] - 1, z2: iz2 });

  bedroom(b, { x: ix1, y: floors[1] + 1, z: iz1, facing: 'south', width: 4, depth: 5, wood: 'schwarzeiche', color: 'rot', rug: 'gelb' });
  hangingLantern(b, { x: -11, y: floors[2] - 1, z: -14, chain: 0 });
  lightRoom(b, { x1: ix1, y1: floors[1] + 1, z1: iz1, x2: ix2, y2: floors[2] - 1, z2: iz2 });

  workshop(b, { x: ix1, y: floors[2] + 1, z: iz1, facing: 'south', width: 4, wood: 'schwarzeiche', shelves: true });
  storage(b, { x: ix1, y: floors[2] + 1, z: iz2, facing: 'north', width: 3, height: 2, barrel: true });
  hangingLantern(b, { x: -11, y: top - 1, z: -15, chain: 1 });
  lightRoom(b, { x1: ix1, y1: floors[2] + 1, z1: iz1, x2: ix2, y2: top - 1, z2: iz2 });
}

// ------------------------------------------------------------------ Stall, Schmiede, Brunnen

// Pultdach aus Stufen: steigt von der Hofseite (front) zur Mauer (back) um eine halbe Ebene je Block.
function leanToRoof(b, { front, back, z1, z2, y }) {
  const dir = Math.sign(back - front);
  const cells = [];
  for (let i = 0, x = front - dir; i <= Math.abs(back - front) + 1; i++, x += dir) {
    const h = y + (i - 1) / 2;
    cells.push({ x, y: Math.floor(h), top: h % 1 !== 0 });
  }
  for (const c of cells) {
    for (let z = z1 - 1; z <= z2 + 1; z++) b.slab(c.x, c.y, z, darkOak.slab, { type: c.top ? 'top' : 'bottom' });
  }
  return cells;
}

function stable(b) {
  const { x1, x2, z1, z2 } = STABLE;
  b.phase('Pferdestall', 'An der Ostmauer steht der Pferdestall: Boden aus grober Erde, Giebelwände aus Fachwerk, vorne zum Hof '
    + 'offen auf Fichtenstämmen mit einem Querbalken. Das Pultdach aus Schwarzeichenstufen steigt zur Mauer hin an – je Block '
    + 'eine halbe Stufe. Innen gibt es vier Boxen mit Heu, Wassertrog und Zauntoren.', {
    tips: [
      'Für das Pultdach wechseln untere und obere Stufen: unten, oben, eine Ebene höher unten, oben … – so entsteht eine flache Schräge.',
      'Wo über einer Giebelwand eine obere Stufe käme, setzt du eine doppelte Stufe – sonst bleibt unter ihr ein halber Block Luft.',
    ],
  });
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, b.pickWeighted([['coarse_dirt', 3], ['packed_mud', 2], ['dirt', 1]]));
  const roof = leanToRoof(b, { front: x1, back: x2, z1, z2, y: 6 });
  for (const z of [z1, z2]) {
    timberWall(b, { x: z === z2 ? x1 : x2, y: 1, z, facing: z === z2 ? 'south' : 'north', length: x2 - x1 + 1, height: 5, pattern: 'diagonal', fill: 'white_terracotta' });
    for (const c of roof) {
      if (c.x < x1 || c.x > x2) continue;
      for (let y = 6; y < c.y; y++) b.set(c.x, y, z, spruce.planks);
      if (c.top) b.slab(c.x, c.y, z, darkOak.slab, { type: 'double' }); // Giebel bündig unter der oberen Stufe
    }
  }
  for (let z = z1; z <= z2; z += 4) b.fill(x1, 1, z, x1, 5, z, `${spruce.log}[axis=y]`);
  b.fill(x1, 5, z1, x1, 5, z2, `${spruce.log}[axis=z]`);
  for (let z = z1 + 1; z < z2; z++) if ((z - z1) % 4 === 1) b.stairs(x1, 4, z, spruce.stairs, { facing: 'north', half: 'top' });
  for (let z = z1 + 3; z < z2; z++) if ((z - z1) % 4 === 3) b.stairs(x1, 4, z, spruce.stairs, { facing: 'south', half: 'top' });
  // Boxen
  for (const z of [-4, 0, 4]) b.fill(19, 1, z, x2, 1, z, spruce.fence);
  for (const [za, zb] of [[-7, -5], [-3, -1], [1, 3], [5, 7]]) {
    for (let z = za; z <= zb; z++) b.set(19, 1, z, z === za + 1 ? `${spruce.fenceGate}[facing=west,open=false]` : spruce.fence);
    b.set(x2, 1, za, 'hay_block[axis=y]');
    b.set(x2, 1, zb, 'water_cauldron[level=3]');
    b.set(x2 - 1, 1, za, 'hay_block[axis=z]');
  }
  b.fill(19, 1, z1 + 1, 19, 1, z1 + 1, spruce.fence);
  for (const z of [-6, 0, 6]) hangingLantern(b, { x: 17, y: 6, z, chain: 0 });
  b.set(x1 + 1, 1, z2 - 1, 'hay_block[axis=y]');
  b.set(x1 + 1, 2, z2 - 1, 'hay_block[axis=x]');
  b.set(x1 + 2, 1, z2 - 1, 'hay_block[axis=z]');
  b.set(x1 + 1, 1, z1 + 1, 'barrel[facing=up]');
  lightRoom(b, { x1, y1: 1, z1: z1 + 1, x2, y2: 5, z2: z2 - 1 });
}

function smithy(b) {
  const { x1, x2, z1, z2 } = SMITHY;
  b.phase('Schmiede', 'An der Westmauer liegt die Schmiede: Seitenwände aus Bruchstein, vorne offen auf Stämmen, darüber ein '
    + 'Pultdach wie beim Stall. An der Rückwand steht die Esse mit einem Lavakessel und einer Haube aus Steinziegeltreppen, '
    + 'daneben der Hochofen. Ein Schornstein führt durch das Dach. Davor stehen Amboss, Löschtrog, Schleifstein und '
    + 'Schmiedetisch, an der Wand Regale fürs Werkzeug.', {
    tips: ['Lava im Kessel kann nicht auslaufen und zündet nichts an – trotzdem nichts Brennbares direkt danebenstellen.'],
  });
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, b.pickWeighted([[stone.rough, 3], ['gravel', 1], ['andesite', 1]]));
  const roof = leanToRoof(b, { front: x2, back: x1, z1, z2, y: 6 });
  for (const z of [z1, z2]) {
    for (let x = x1; x <= x2; x++) for (let y = 1; y <= 5; y++) b.set(x, y, z, b.pickWeighted([[stone.rough, 3], ['mossy_cobblestone', 1]]));
    for (const c of roof) {
      if (c.x < x1 || c.x > x2) continue;
      for (let y = 6; y < c.y; y++) b.set(c.x, y, z, stone.rough);
      if (c.top) b.slab(c.x, c.y, z, darkOak.slab, { type: 'double' });
    }
  }
  for (const z of [z1, 11, z2]) b.fill(x2, 1, z, x2, 5, z, `${spruce.log}[axis=y]`);
  b.fill(x2, 5, z1, x2, 5, z2, `${spruce.log}[axis=z]`);
  // Esse
  for (const z of [9, 11]) b.set(x1, 1, z, 'bricks');
  b.set(x1, 1, 10, 'lava_cauldron');
  b.set(x1 + 1, 1, 9, 'bricks');
  b.set(x1 + 1, 1, 11, 'bricks');
  for (let z = 9; z <= 11; z++) b.stairs(x1 + 1, 3, z, 'brick_stairs', { facing: 'west', half: 'top' });
  for (let z = 9; z <= 11; z++) b.set(x1, 3, z, 'bricks');
  b.fill(x1, 4, 10, x1, 12, 10, 'bricks');
  b.set(x1, 13, 10, 'campfire[facing=east,lit=true,signal_fire=false]');
  b.set(x1, 1, 12, 'blast_furnace[facing=east,lit=true]');
  b.set(x1, 1, 13, 'smithing_table');
  b.set(x1, 1, 14, 'barrel[facing=east]');
  b.set(x1, 1, 8, 'furnace[facing=east,lit=false]');
  b.set(x1, 1, 7, 'chest[facing=east,type=single]');
  for (let z = 12; z <= 14; z++) b.set(x1, 3, z, `${spruce.shelf}[facing=east]`);
  b.set(x1 + 3, 1, 10, 'anvil[facing=north]');
  b.set(x1 + 3, 1, 8, 'water_cauldron[level=3]');
  b.set(x1 + 3, 1, 13, 'grindstone[face=floor,facing=north]');
  b.set(x1 + 1, 1, 15, 'coal_block');
  b.set(x1 + 2, 1, 15, 'coal_block');
  b.set(x1 + 1, 2, 15, 'coal_block');
  hangingLantern(b, { x: x1 + 4, y: 6, z: 13, chain: 0 });
  b.note(x1, 1, 10, 'Esse mit Lavakessel');
  lightRoom(b, { x1, y1: 1, z1: z1 + 1, x2, y2: 5, z2: z2 - 1 });
}

function well(b) {
  b.phase('Brunnen', 'In der Hofmitte steht der Brunnen: ein Kranz aus bemoostem Bruchstein um den Wasserschacht, zwei Stämme '
    + 'tragen ein kleines Satteldach aus Fichte mit der Kette für den Eimer. Rundherum liegt ein gepflasterter Platz.');
  floorPattern(b, {
    x: -5, y: 0, z: -5, width: 11, depth: 11, pattern: 'random',
    blocks: [[stone.rough, 4], ['stone', 2], ['andesite', 2], [stone.mossy, 1]],
  });
  for (let y = -2; y <= 0; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) b.set(x, y, z, 'water[level=0]');
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) === 2 || Math.abs(z) === 2) b.set(x, 1, z, b.pickWeighted([['mossy_cobblestone', 2], [stone.rough, 2], [stone.mossy, 1]]));
    }
  }
  for (const x of [-2, 2]) b.fill(x, 2, 0, x, 5, 0, `${spruce.log}[axis=y]`);
  b.fill(-2, 6, 0, 2, 6, 0, `${spruce.strippedLog}[axis=x]`);
  b.roof({ x1: -2, z1: -2, x2: 2, z2: 2, y: 5, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
  b.fill(0, 3, 0, 0, 5, 0, 'iron_chain[axis=y]');
  b.set(0, 2, 0, 'lantern[hanging=true]');
  for (const [x, z, facing] of [[-4, 0, 'east'], [4, 0, 'west']]) for (const dz of [-1, 0, 1]) b.stairs(x, 1, z + dz, spruce.stairs, { facing });
}

// ------------------------------------------------------------------ Hof und Umgebung

function courtyard(b) {
  b.phase('Burghof und Umgebung', 'Zum Schluss legst du die Kieswege im Hof an (vom Tor zum Brunnen und weiter zu Bergfried, '
    + 'Stall und Schmiede), stellst Laternenpfähle auf, setzt eine große Eiche, ein Kräuterbeet und einen Übungsplatz mit '
    + 'Zielscheiben. Außerhalb der Mauer führt der Weg nach Süden, dazu Bäume, Felsen und Wiese.');
  b.step('Wege und Laternen', 'Kieswege 3 breit, an den Kreuzungen Laternenpfähle aus Steinziegelmauer.');
  pathAlong(b, { y: 0, points: [[0, GATE.z1 - 1], [0, 6]], width: 3, mix: 'kies', wiggle: 0, seed: 'hof-tor' });
  pathAlong(b, { y: 0, points: [[-6, 0], [-11, -2], [-11, KEEP.z2 + 9]], width: 3, mix: 'kies', wiggle: 0, seed: 'hof-keep' });
  pathAlong(b, { y: 0, points: [[6, 0], [STABLE.x1 - 1, 0]], width: 3, mix: 'kies', wiggle: 0, seed: 'hof-stall' });
  pathAlong(b, { y: 0, points: [[-4, 5], [-10, 11], [SMITHY.x2 + 1, 11]], width: 3, mix: 'kies', wiggle: 0, seed: 'hof-schmiede' });
  pathAlong(b, { y: 0, points: [[0, GATE.z2 + 1], [0, 42]], width: 5, mix: 'kies', wiggle: 1, seed: 'weg-sued' });
  for (const [x, z] of [[3, 8], [-3, 8], [8, -3], [-8, 3], [-13, -4], [12, 3], [-13, 13]]) {
    lampPost(b, { x, y: 1, z, facing: 'east', height: 3, style: 'top', post: stone.wall, base: stone.chiseled });
  }
  for (const x of [-4, 4]) lampPost(b, { x, y: 1, z: GATE.tz + 2, facing: 'east', height: 3, style: 'top', post: stone.wall, base: stone.chiseled });

  b.step('Eiche, Beet und Übungsplatz', 'Im Nordosten des Hofs wächst eine große Eiche, vor dem Bergfried ein Kräuterbeet. Im '
    + 'Südosten üben die Bogenschützen: Zielscheiben auf Heuballen.');
  tree(b, { x: 6, y: 1, z: -13, species: 'eiche', size: 'gross', seed: 11 });
  flowerBed(b, { x: -6, y: 0, z: -14, width: 3, depth: 6, palette: 'kuehl', facing: 'east', border: 'stein', seed: 12 });
  for (const z of [13, 16, 19]) {
    b.set(14, 1, z, 'hay_block[axis=y]');
    b.set(14, 2, z, 'target');
  }
  for (let z = 13; z <= 19; z++) b.set(8, 1, z, z % 3 === 1 ? 'barrel[facing=up]' : spruce.fence);
  bush(b, { x: -18, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 13 });
  bush(b, { x: 18, y: 1, z: 16, size: 'klein', leaves: 'eiche', seed: 14 });

  b.step('Vor der Burg', 'Außerhalb der Ringmauer: Bäume, ein paar bemooste Felsen und Wiese.');
  for (const [x, z, species, size, seed] of [
    [-33, 4, 'eiche', 'mittel', 21], [33, -8, 'birke', 'mittel', 22], [-12, -34, 'fichte', 'mittel', 23],
    [16, 36, 'eiche', 'mittel', 24], [-20, 37, 'birke', 'klein', 25], [32, 30, 'fichte', 'klein', 26],
  ]) tree(b, { x, y: 1, z, species, size, seed });
  rock(b, { x: 9, y: 1, z: 34, size: 'mittel', material: 'stein', seed: 27 });
  rock(b, { x: -34, y: 1, z: -20, size: 'gross', material: 'andesit', seed: 28 });
  rock(b, { x: 35, y: 1, z: 12, size: 'klein', material: 'stein', seed: 29 });
  vegetation(b, { x: -38, y: 3, z: -38, width: 77, depth: 81, mix: 'wiese', density: 0.25, shape: 'eckig', seed: 'burg' });
}

export default function build(b) {
  ground(b);
  curtainWalls(b);
  towers(b);
  gatehouse(b);
  portcullis(b);
  walkways(b);
  wallStairs(b);
  keepShell(b);
  keepTop(b);
  keepEntrance(b);
  openings(b);
  interiors(b);
  stable(b);
  smithy(b);
  well(b);
  courtyard(b);
}
