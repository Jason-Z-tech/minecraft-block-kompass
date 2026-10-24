// Torhaus mit Zugbrücke: zwei Rundtürme mit Wendeltreppen, Tordurchfahrt mit Spitzbogen und halb hochgezogenem
// Fallgitter, Wachstube über der Durchfahrt, Wassergraben mit hölzerner Zugbrücke (dekorativ, heruntergelassen).
// Koordinaten: Durchfahrt entlang z, Feldseite = Süden (+z), Burgseite = Norden (−z); Gelände-Oberkante y = 0.

import {
  STONE, WOOD, COLOR, arch, arrowSlit, battlements, doorway, window, wallLantern, hangingLantern, lampPost, fireplace,
  diningTable, storage, lightRoom, terrain, pathAlong, bush, rock, vegetation, tree,
} from '../lib/index.js';

export const meta = {
  id: 'torhaus',
  title: 'Torhaus mit Zugbrücke',
  category: 'mittelalter',
  subtitle: 'Doppelturm-Tor mit Fallgitter über dem Wassergraben',
  tags: ['Tor', 'Torhaus', 'Burg', 'Mittelalter', 'Zugbrücke', 'Fallgitter', 'Wassergraben', 'Rundturm', 'Wendeltreppe', 'Zinnen'],
  aliases: [
    'torhaus', 'tor haus', 'burgtor', 'stadttor', 'gatehouse', 'gate house', 'castle gate', 'zugbrücke', 'zugbruecke',
    'drawbridge', 'fallgitter', 'portcullis', 'tor mit zugbrücke', 'burg tor', 'torburg', 'toranlage', 'torhaus mit zugbruecke',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Ein wehrhaftes Torhaus aus Steinziegeln: Zwei runde Flankentürme mit Wendeltreppen rahmen eine spitzbogige '
    + 'Tordurchfahrt ein, in der das Fallgitter halb hochgezogen hängt – seine Oberkante und die Winde siehst du in der '
    + 'Wachstube darüber. Vor dem Tor liegt ein Wassergraben mit heruntergelassener Zugbrücke aus Holz, über dem Tor sitzt '
    + 'eine Pechnase. Wachstube mit Kamin und Tisch, Zinnen auf allen Dächern.',
  facts: [
    'Grundfläche ohne Graben 23 × 12 Blöcke, Türme 9 Blöcke Durchmesser und 19 Blöcke hoch (mit Zinnen).',
    'Durchfahrt 5 Blöcke breit, Spitzbogen 5 Blöcke hoch; das Fallgitter aus Eisengittern lässt unten 2 Blöcke frei.',
    'Wassergraben 5 breit und 2 tief, nur aus Wasserquellen; die Zugbrücke ist Deko und lässt sich nicht hochziehen.',
    'Beide Türme haben eine Wendeltreppe bis aufs Dach und Absätze mit Türen zur Wachstube und zum Dach über dem Tor.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const stone = STONE.steinziegel;
const spruce = WOOD.fichte;
const darkOak = WOOD.schwarzeiche;

const GATE = { x1: -3, x2: 3, z1: -5, z2: 4 }; // Mittelbau (Wände inklusive)
const ROOM_FLOOR = 6; // Boden der Wachstube = Scheitelreihe des Bogens
const ROOF = 11; // Dach des Mittelbaus
const PORTCULLIS_Z = 3; // Reihe des Fallgitters
const TOWER = { cx: -7, cz: 2, r: 4, top: 15 }; // Westturm; der Ostturm ist gespiegelt
const LEDGES = [6, 11]; // Absätze in den Türmen (Höhe der Wachstube und des Mitteldachs)
const MOAT = { x1: -17, x2: 17, z1: 8, z2: 12, floor: -3 };
const BASE = -5; // unterste Geländeebene = „Ebene 1“ der Anleitung
const lvl = (y) => y - BASE + 1;

function wallStone(b, y) {
  if (y <= 3) return b.pickWeighted([[stone.block, 5], [stone.mossy, 3], [stone.rough, 1], ['mossy_cobblestone', 1]]);
  return b.pickWeighted([[stone.block, 10], [stone.mossy, 2], [stone.cracked, 2]]);
}

// Zellen einer runden Scheibe (Radius r): Rand (shell) und Inneres mit Chebyshev-Abstand zur Mitte.
function discCells(r) {
  const inDisc = (dx, dz) => dx * dx + dz * dz <= (r + 0.5) ** 2;
  const shell = [];
  const inner = [];
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!inDisc(dx, dz)) continue;
      const edge = !inDisc(dx + 1, dz) || !inDisc(dx - 1, dz) || !inDisc(dx, dz + 1) || !inDisc(dx, dz - 1);
      (edge ? shell : inner).push([dx, dz, Math.max(Math.abs(dx), Math.abs(dz))]);
    }
  }
  return { shell, inner };
}

// Weg der Wendeltreppe wie b.spiralStairs (Ring mit Radius 2, Start im Norden, im Uhrzeigersinn).
function spiralPath(r) {
  const cells = [];
  for (let x = 0; x < r; x++) cells.push([x, -r]);
  for (let z = -r; z < r; z++) cells.push([r, z]);
  for (let x = r; x > -r; x--) cells.push([x, r]);
  for (let z = r; z > -r; z--) cells.push([-r, z]);
  for (let x = -r; x < 0; x++) cells.push([x, -r]);
  return cells;
}

function groundAndMoat(b) {
  b.phase('Gelände und Wassergraben', 'Leg den Bauplatz an und heb vor dem Tor (Süden) den Wassergraben aus: 5 Blöcke breit, '
    + '35 lang und 3 tief. Die Grabenwände mauerst du mit Steinziegeln aus, den Boden belegst du mit Kies und Ton. Dann füllst '
    + 'du 2 Ebenen Wasser ein – nur Quellen, also Eimer für Eimer, damit nichts fließt.', {
    tips: ['Setz das Wasser in jede Zelle einzeln (oder leg zwei Quellen nebeneinander und schöpf daraus nach). Der Wasserspiegel liegt einen Block unter dem Gras.'],
  });
  terrain(b, { x: -21, y: -5, z: -15, width: 43, depth: 34, height: 5, surface: 'gras', seed: 'torhaus' });
  const { x1, x2, z1, z2, floor } = MOAT;
  b.fill(x1 - 1, floor, z1 - 1, x2 + 1, 0, z2 + 1, stone.block);
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, floor, z, b.pickWeighted([['gravel', 3], ['clay', 2], ['sand', 1]]));
  weather(b, x1 - 1, floor, z1 - 1, x2 + 1, 0, z2 + 1, 0.35);
  b.step('Wasser einfüllen', 'Füll den Graben mit zwei Ebenen Wasserquellen. Auf den Grund kommt hier und da Seegras, oben '
    + 'treiben ein paar Seerosen.');
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const seagrass = b.chance(0.12);
      b.set(x, floor + 1, z, seagrass ? 'seagrass' : 'water[level=0]');
      b.set(x, floor + 2, z, 'water[level=0]');
      b.set(x, 0, z, Math.abs(x) > 3 && b.chance(0.05) ? 'lily_pad' : 'air');
    }
  }
  b.step('Wege', 'Leg einen Kiesweg vom Feld bis zum Graben und einen zweiten von der Burgseite bis zum Tor. Der Platz zwischen '
    + 'Graben und Tor wird gepflastert.');
  pathAlong(b, { y: 0, points: [[0, 18], [0, 14]], width: 5, mix: 'kies', wiggle: 0, seed: 'torhaus-feld' });
  pathAlong(b, { y: 0, points: [[0, -6], [0, -15]], width: 5, mix: 'kies', wiggle: 0, seed: 'torhaus-burg' });
  for (let x = -2; x <= 2; x++) {
    for (let z = GATE.z1; z <= 6; z++) b.set(x, 0, z, b.pickWeighted([[stone.rough, 3], [stone.block, 2], ['andesite', 1]]));
  }
}

// Alterung: ein Teil der Steinziegel wird bemoost oder rissig.
function weather(b, x1, y1, z1, x2, y2, z2, share) {
  for (let y = y1; y <= y2; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        if (b.get(x, y, z) === stone.block && b.chance(share)) b.set(x, y, z, b.chance(0.6) ? stone.mossy : stone.cracked);
      }
    }
  }
}

function gateBlock(b) {
  const { x1, x2, z1, z2 } = GATE;
  b.phase('Mittelbau und Durchfahrt', `Der Mittelbau zwischen den Türmen ist 7 Blöcke breit und 10 tief. In der Mitte bleibt `
    + 'die Durchfahrt frei: ein Spitzbogen 5 breit und 5 hoch durch die ganze Tiefe, die Rundung aus umgedrehten '
    + `Steinziegeltreppen und -stufen. Auf Ebene ${lvl(ROOM_FLOOR)} liegt über dem Bogen der Holzboden der Wachstube (5 × 8), `
    + `die Außenwände gehen bis Ebene ${lvl(ROOF - 1)} weiter, und auf Ebene ${lvl(ROOF)} schließt eine Steindecke ab.`, {
    tips: ['Setz die Bogensteine (Treppen und Stufen) Ebene für Ebene mit, während die Wände wachsen – dann brauchst du kein Gerüst.'],
  });
  for (let y = 1; y <= ROOF; y++) {
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        const shell = x === x1 || x === x2 || z === z1 || z === z2;
        const inRoom = y > ROOM_FLOOR && y < ROOF;
        if (inRoom && !shell) continue;
        b.set(x, y, z, y === ROOM_FLOOR && !shell ? spruce.planks : wallStone(b, y));
      }
    }
  }
  arch(b, { x: 0, y: 1, z: z2, facing: 'south', width: 5, height: 5, style: 'pointed', depth: z2 - z1 + 1, block: stone.block, stairs: stone.stairs });
}

function towerShape(b) {
  const { cx, cz, r, top } = TOWER;
  const { shell, inner } = discCells(r);
  const path = spiralPath(2);
  for (let y = 1; y <= top; y++) for (const [dx, dz] of shell) b.set(cx + dx, y, cz + dz, wallStone(b, y));
  for (const [dx, dz] of inner) b.set(cx + dx, 0, cz + dz, b.pickWeighted([[stone.block, 2], [stone.rough, 1]]));
  // Absätze: nur der äußere Ring (Chebyshev 3), die Treppe läuft innen auf Ring 2.
  for (const y of LEDGES) for (const [dx, dz, d] of inner) if (d === 3) b.set(cx + dx, y, cz + dz, spruce.planks);
  // Turmdach mit Ausstieg über den letzten Stufen.
  const exit = [path[12], path[13]].map(([dx, dz]) => `${dx},${dz}`);
  for (const [dx, dz] of inner) if (!exit.includes(`${dx},${dz}`)) b.set(cx + dx, top, cz + dz, stone.block);
  // Sockel: Ring aus Bruchstein mit Stufen darauf.
  for (const [dx, dz] of discCells(r + 1).shell) {
    // Nur auf der Feld- und Außenseite, nicht am Mittelbau.
    if (dz <= -2 || cx + dx >= GATE.x1) continue;
    b.set(cx + dx, 1, cz + dz, b.pickWeighted([[stone.rough, 2], ['mossy_cobblestone', 1]]));
    b.slab(cx + dx, 2, cz + dz, 'cobblestone_slab', { type: 'bottom' });
  }
}

function towers(b) {
  b.phase('Rundtürme', 'Die beiden Rundtürme (9 Blöcke Durchmesser) stehen links und rechts am Mittelbau und springen 2 Blöcke '
    + `nach vorne vor. Mauere die runde Wand bis Ebene ${lvl(TOWER.top)} hoch. Innen kommen auf Ebene ${lvl(LEDGES[0])} und `
    + `Ebene ${lvl(LEDGES[1])} schmale Holzabsätze an die Wand (nur der äußere Ring), oben schließt eine Steindecke mit `
    + 'einer Öffnung über der Treppe ab. Auf der Feldseite umgibt ein Sockel aus Bruchstein und Stufen den Turmfuß.', {
    tips: [
      'Runde Wand mit 9 Blöcken Durchmesser, Ring für Ring gleich: je Seite 3 gerade Blöcke in der Mitte, dann zwei Stufen zu 2 und 1 Block.',
      'Den zweiten Turm baust du spiegelbildlich – schau dir die Ebenen des ersten an und spiegle links/rechts.',
    ],
  });
  towerShape(b);
  b.transform({ mirror: 'x' }, () => towerShape(b));
}

function spiralAndDoors(b) {
  const { cx, cz, top } = TOWER;
  spiralStairsFor(b);
  b.transform({ mirror: 'x' }, () => spiralStairsFor(b));
  function spiralStairsFor() {
    b.spiralStairs(cx, cz, 1, top, 2, stone.stairs, { core: stone.block });
    doorway(b, { x: cx, y: 1, z: cz - 4, facing: 'north', door: spruce.door, frame: null });
    wallLantern(b, { x: cx + 1, y: 2, z: cz - 4, facing: 'north', style: 'bracket', arm: spruce.fence });
    doorway(b, { x: cx + 4, y: ROOM_FLOOR + 1, z: cz - 1, facing: 'west', door: spruce.door, frame: null });
    doorway(b, { x: cx + 4, y: ROOF + 1, z: cz - 1, facing: 'west', door: spruce.door, frame: null });
  }
}

function stairsPhase(b) {
  b.phase('Wendeltreppen und Türen', 'In jedem Turm windet sich eine Wendeltreppe aus Steinziegeltreppen um eine 3 × 3 große '
    + 'Mittelsäule bis aufs Dach: je Ebene eine Stufe, immer einen Block weiter im Kreis. Der Westturm dreht im Uhrzeigersinn, '
    + 'der Ostturm gegen den Uhrzeigersinn. Unten führt eine Tür zur Burgseite, auf den Absätzen je eine Tür in die Wachstube '
    + `(Ebene ${lvl(ROOM_FLOOR + 1)}) und aufs Dach über dem Tor (Ebene ${lvl(ROOF + 1)}).`, {
    tips: ['Stell dich beim Setzen jeder Stufe auf die vorige und schau in Laufrichtung – dann zeigt die hohe Seite automatisch richtig.'],
  });
  spiralAndDoors(b);
  b.note(TOWER.cx, 1, TOWER.cz - 2, 'Die Wendeltreppe beginnt hier (Nordseite)');
}

function passage(b) {
  const { z1 } = GATE;
  b.phase('Fallgitter und Torflügel', 'In der zweiten Reihe hinter der Feldseite hängt das Fallgitter aus Eisengittern: halb hochgezogen, unten 2 Blöcke frei, oben geht es durch '
    + 'einen Schlitz im Boden bis in die Wachstube. Am inneren Ende stehen die zwei offenen Torflügel aus Falltüren an der Wand.', {
    tips: ['Setz die Eisengitter von oben nach unten – sie verbinden sich mit dem Stein links und rechts von selbst.'],
  });
  for (let y = 3; y <= ROOM_FLOOR + 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const state = b.get(x, y, PORTCULLIS_Z);
      if (state === 'air' || y >= ROOM_FLOOR) b.set(x, y, PORTCULLIS_Z, 'iron_bars');
    }
  }
  for (let x = -2; x <= 2; x++) b.set(x, ROOM_FLOOR + 3, PORTCULLIS_Z, `${spruce.strippedLog}[axis=x]`);
  b.note(0, 3, PORTCULLIS_Z, 'Fallgitter (halb hochgezogen)');
  // Offene Torflügel: Falltüren flach an den Wänden am inneren Ende.
  for (let y = 1; y <= 3; y++) {
    for (const z of [z1 + 1, z1 + 2]) {
      b.set(-2, y, z, `${darkOak.trapdoor}[facing=east,half=bottom,open=true]`);
      b.set(2, y, z, `${darkOak.trapdoor}[facing=west,half=bottom,open=true]`);
    }
  }
  for (const z of [z1 + 2, 0]) hangingLantern(b, { x: 0, y: 5, z, chain: 0 });
}

function drawbridge(b) {
  b.phase('Zugbrücke', 'Über den Graben legst du die heruntergelassene Zugbrücke: 5 breit auf Ebene 1, in der Mitte '
    + 'Fichtenbretter, außen je ein geschälter Schwarzeichenstamm als Längsbalken. Am Tor sitzt der Drehbalken quer davor, an '
    + 'der Brückenspitze stehen zwei Zaunpfosten für die Zugketten. Die Brücke ist Deko – hochziehen lässt sie sich nicht.');
  const { z1, z2 } = MOAT;
  for (let z = z1 - 1; z <= z2 + 1; z++) {
    for (let x = -1; x <= 1; x++) b.set(x, 0, z, spruce.planks);
    b.set(-2, 0, z, `${darkOak.strippedLog}[axis=z]`);
    b.set(2, 0, z, `${darkOak.strippedLog}[axis=z]`);
  }
  for (let x = -2; x <= 2; x++) b.set(x, 0, z1 - 2, `${darkOak.log}[axis=x]`);
  for (const x of [-2, 2]) b.set(x, 1, z2 + 1, spruce.fence);
}

function upperParts(b) {
  const { x1, x2, z1, z2 } = GATE;
  b.phase('Pechnase, Zinnen und Fahnen', 'Über dem Tor kragt eine kleine Pechnase vor: auf umgedrehten Treppen als Konsolen '
    + 'zwei Ebenen Stein mit einer Schießscharte, oben eine Stufe. Dann bekommt der Mittelbau vorne und hinten einen Zinnenkranz '
    + 'auf Konsolen, die Türme einen runden Zinnenkranz, und auf beide Turmdächer kommt ein Fahnenmast mit rotem Banner.');
  for (const x of [-1, 0, 1]) b.stairs(x, ROOM_FLOOR + 1, z2 + 1, stone.stairs, { facing: 'north', half: 'top' });
  b.fill(-1, ROOM_FLOOR + 2, z2 + 1, 1, ROOM_FLOOR + 3, z2 + 1, stone.block);
  for (const x of [-1, 0, 1]) b.slab(x, ROOM_FLOOR + 4, z2 + 1, stone.slab, { type: 'bottom' });
  arrowSlit(b, { x: 0, y: ROOM_FLOOR + 2, z: z2 + 1, facing: 'south', height: 2, fill: 'iron_bars' });
  battlements(b, { x: x1, y: ROOF + 1, z: z2, facing: 'south', length: x2 - x1 + 1, corbels: stone.stairs, cap: stone.slab });
  battlements(b, { x: x2, y: ROOF + 1, z: z1, facing: 'north', length: x2 - x1 + 1, corbels: stone.stairs, cap: stone.slab });
  roundBattlements(b);
  b.transform({ mirror: 'x' }, () => roundBattlements(b));
  weather(b, -12, ROOF, z1 - 1, 12, TOWER.top + 4, 8, 0.25);
}

// Runder Zinnenkranz auf Konsolen um einen Turm (eigene Funktion: die Bibliothek hat nur gerade Zinnen).
function roundBattlements(b) {
  const { cx, cz, r, top } = TOWER;
  const ring = discCells(r + 1).shell.filter(([dx, dz]) => {
    // Auf der Seite des Mittelbaus (dx ≥ 3) liegt das Mitteldach tiefer – dort bleibt der Kranz trotzdem geschlossen.
    return dx * dx + dz * dz > (r - 0.5) ** 2;
  });
  ring.sort((a, b2) => Math.atan2(a[1], a[0]) - Math.atan2(b2[1], b2[0]));
  ring.forEach(([dx, dz], i) => {
    const x = cx + dx;
    const z = cz + dz;
    const inward = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south');
    b.stairs(x, top, z, stone.stairs, { facing: inward, half: 'top' });
    b.set(x, top + 1, z, stone.block);
    if (i % 2 === 0) {
      b.set(x, top + 2, z, stone.block);
      b.slab(x, top + 3, z, stone.slab, { type: 'bottom' });
    }
  });
  // Ringfläche zwischen Turmwand und Kranz schließen.
  for (const [dx, dz] of discCells(r).shell) b.set(cx + dx, top, cz + dz, stone.block);
  b.fill(cx, top + 1, cz, cx, top + 4, cz, spruce.fence);
  b.set(cx, top + 5, cz, `${COLOR.rot.banner}[rotation=0]`);
}

function windows(b) {
  const { cx, cz, r } = TOWER;
  const { z1, z2 } = GATE;
  b.phase('Schießscharten und Fenster', 'Die Türme bekommen auf der Feld- und der Außenseite Kreuzscharten in drei Höhen, die '
    + 'Wachstube zwei Scharten zum Feld und zwei Fenster zur Burg. An die Türme kommen vorne Laternen am Zaunarm.');
  const towerSlits = () => {
    for (const y of [2, 7, 12]) {
      arrowSlit(b, { x: cx, y, z: cz + r, facing: 'south', height: 3, style: 'cross' });
      arrowSlit(b, { x: cx - r, y, z: cz, facing: 'west', height: 3, style: 'cross' });
    }
    wallLantern(b, { x: cx + 2, y: 3, z: cz + r - 1 + 1, facing: 'south', style: 'bracket', arm: spruce.fence });
  };
  towerSlits();
  b.transform({ mirror: 'x' }, towerSlits);
  for (const x of [-2, 2]) {
    arrowSlit(b, { x, y: ROOM_FLOOR + 1, z: z2, facing: 'south', height: 3 });
    window(b, { x, y: ROOM_FLOOR + 1, z: z1, facing: 'north', width: 1, height: 2, glass: 'glass_pane', sill: stone.stairs });
  }
}

function guardRoom(b) {
  const { z1 } = GATE;
  b.phase('Wachstube', 'Richte die Wachstube über der Durchfahrt ein: an der Rückwand ein Kamin aus Steinziegeln mit Sims, davor '
    + 'ein Tisch mit Stühlen, in den Ecken Truhen und Fässer. Über dem Fallgitter-Schlitz liegt die Winde (ein liegender Stamm). '
    + 'Laternen hängen an der Decke, in den Türmen unter den Absätzen.');
  fireplace(b, { x: 0, y: ROOM_FLOOR + 1, z: z1 + 1, facing: 'south', height: 4, block: stone.block, mantel: spruce.stairs });
  diningTable(b, { x: -1, y: ROOM_FLOOR + 1, z: -1, facing: 'south', length: 3, width: 1, wood: 'fichte', headChairs: false });
  storage(b, { x: -2, y: ROOM_FLOOR + 1, z: 2, facing: 'south', width: 2, height: 1, barrel: false });
  b.set(2, ROOM_FLOOR + 1, 2, 'barrel[facing=up]');
  b.set(2, ROOM_FLOOR + 2, 2, 'barrel[facing=up]');
  for (const z of [-1, 1]) hangingLantern(b, { x: 0, y: ROOF - 1, z, chain: 0 });
  lightRoom(b, { x1: -2, y1: ROOM_FLOOR + 1, z1: z1 + 1, x2: 2, y2: ROOF - 1, z2: PORTCULLIS_Z - 1 });
  // Schornstein auf dem Mitteldach über dem Kamin.
  for (let y = ROOF + 1; y <= ROOF + 3; y++) b.set(0, y, z1 + 1, 'stone_bricks');
  b.set(0, ROOF + 4, z1 + 1, 'campfire[facing=south,lit=true,signal_fire=false]');
  const towerLights = () => {
    const { cx, cz } = TOWER;
    hangingLantern(b, { x: cx - 3, y: LEDGES[0] - 1, z: cz, chain: 0 });
    hangingLantern(b, { x: cx, y: LEDGES[1] - 1, z: cz + 3, chain: 0 });
    hangingLantern(b, { x: cx, y: TOWER.top - 1, z: cz - 3, chain: 0 });
  };
  towerLights();
  b.transform({ mirror: 'x' }, towerLights);
}

function surroundings(b) {
  b.phase('Umgebung', 'Zum Schluss: Laternenpfähle an der Brücke, ein paar Felsen und Büsche am Graben, Bäume auf der Burgseite '
    + 'und Gras auf der Wiese.');
  for (const x of [-4, 4]) lampPost(b, { x, y: 1, z: 14, facing: 'east', height: 3, style: 'top', post: stone.wall, base: stone.chiseled });
  tree(b, { x: -15, y: 1, z: -9, species: 'eiche', size: 'mittel', seed: 2 });
  tree(b, { x: 14, y: 1, z: -10, species: 'birke', size: 'mittel', seed: 3 });
  bush(b, { x: -12, y: 1, z: 15, size: 'klein', leaves: 'eiche', seed: 4 });
  bush(b, { x: 11, y: 1, z: 16, size: 'mittel', leaves: 'eiche', seed: 5 });
  rock(b, { x: 16, y: 1, z: 15, size: 'klein', material: 'stein', seed: 6 });
  rock(b, { x: -17, y: 1, z: 4, size: 'mittel', material: 'andesit', seed: 7 });
  vegetation(b, { x: -21, y: 3, z: -15, width: 43, depth: 34, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 'torhaus' });
}

export default function build(b) {
  groundAndMoat(b);
  gateBlock(b);
  towers(b);
  stairsPhase(b);
  passage(b);
  drawbridge(b);
  upperParts(b);
  windows(b);
  guardRoom(b);
  surroundings(b);
}
