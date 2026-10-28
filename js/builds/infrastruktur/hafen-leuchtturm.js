// Kleiner Hafen mit Leuchtturm (eigenes Design).
// Koordinaten: x → Osten, z → Süden. Land im Norden (z 0 … 12), Kaimauer z 13 … 14, Hafenbecken x 4 … 37 / z 15 … 36,
// Molen im Süden und Osten, Leuchtturm auf dem Molenkopf im Südosten. y = 0 Grundschicht, y = 1 Meeresboden,
// Wasser y 2 … 4, Geländeoberkante y = 5 (du läufst auf Ebene 7, y = 6).
import { doorway, window, lampPost, hangingLantern, storage, lightRoom, findDarkSpots, tree, bush, rock, path, vegetation, floorPattern } from '../lib/index.js';

export const meta = {
  id: 'hafen-leuchtturm',
  title: 'Hafen mit Leuchtturm',
  category: 'infrastruktur',
  subtitle: 'Kaimauer, Holzstege, Lagerhaus, Holzkran und rot-weißer Leuchtturm',
  tags: ['Hafen', 'Leuchtturm', 'Meer', 'Küste', 'Steg', 'Kran', 'Lagerhaus', 'Fischerdorf', 'Wasser', 'Mittelgroß'],
  aliases: [
    'hafen', 'leuchtturm', 'hafen mit leuchtturm', 'kleiner hafen', 'fischerhafen', 'hafenbecken', 'kai', 'kaimauer', 'mole',
    'bootssteg', 'holzsteg', 'hafenkran', 'harbor', 'harbour', 'lighthouse', 'harbor with lighthouse', 'port', 'dock', 'pier',
    'leuchturm', 'leuchtturn', 'hafn', 'lighthous',
  ],
  accuracy: 'eigenes',
  description: 'Ein kleiner Hafen für deine Küste: Kaimauer und Molen aus Steinziegeln umschließen ein Becken mit zwei Holzstegen, '
    + 'Pollern und Leitern. Auf dem Molenkopf steht ein rot-weißer Leuchtturm mit Wendeltreppe, Galerie und Lichtraum mit Seelaterne '
    + 'und Leuchtstein. An Land warten ein Lagerhaus mit Fässern und Kisten, ein hölzerner Hafenkran und ein Fischstand.',
  sources: [],
  credits: null,
  tested: null,
};

// ---------------------------------------------------------------- Maße und Palette

const SEABED = 1;
const WATER_TOP = 4;
const GROUND = 5; // Oberkante Gelände, Kai und Molen
const WALK = GROUND + 1;
const SIZE = 42; // x und z 0 … 41

const BASIN = { x1: 4, x2: 37, z1: 15, z2: 36 };
const LIGHTHOUSE = { cx: 35, cz: 34, shaft: 4, gallery: 5, platform: 6 };
const WAREHOUSE = { x1: 3, x2: 16, z1: 1, z2: 9 };
const CRANE = { x: 21, z: 11 };

const P = {
  quay: 'stone_bricks',
  quayMossy: 'mossy_stone_bricks',
  quayCracked: 'cracked_stone_bricks',
  cap: 'polished_andesite',
  capSlab: 'stone_brick_slab[type=bottom]',
  riprap: ['cobblestone', 'mossy_cobblestone', 'stone', 'andesite'],
  seabed: [['sand', 6], ['gravel', 2], ['clay', 1]],
  deck: 'spruce_planks',
  deckBeam: 'stripped_spruce_log',
  post: 'spruce_log',
  bollard: 'polished_blackstone_wall',
  red: 'red_concrete',
  white: 'white_concrete',
  plinth: 'stone_bricks',
  stairs: 'spruce_stairs',
  core: 'stripped_spruce_log',
  coreLight: 'shroomlight',
  galleryFloor: 'smooth_stone',
  railing: 'iron_bars',
  dome: 'waxed_oxidized_cut_copper',
  domeStairs: 'waxed_oxidized_cut_copper_stairs',
  eave: 'waxed_oxidized_cut_copper_slab[type=bottom]',
  wall: 'spruce_planks',
  frame: 'stripped_dark_oak_log',
  roofStairs: 'dark_oak_stairs',
  roofSlab: 'dark_oak_slab',
};

// ---------------------------------------------------------------- Helfer

const inPlatform = (x, z, extra = 0) => Math.hypot(x - LIGHTHOUSE.cx, z - LIGHTHOUSE.cz) <= LIGHTHOUSE.platform + 0.5 + extra;

function setIfAir(b, x, y, z, state) {
  if (b.get(x, y, z) === 'air') b.set(x, y, z, state);
}

// Steinziegel mit vereinzelten bemoosten/rissigen Steinen (ab Wasserlinie abwärts mehr Moos).
function quayStone(b, y) {
  const moss = y <= WATER_TOP ? 0.3 : 0.08;
  return b.pickWeighted([[P.quay, 1 - moss - 0.06], [P.quayMossy, moss], [P.quayCracked, 0.06]]);
}

function quayBlock(b, x1, z1, x2, z2) {
  for (let y = 0; y <= GROUND; y++) {
    for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, y, z, y === 0 ? 'stone' : quayStone(b, y));
  }
}

// Richtung von (x, z) zur Turmmitte (nächste Hauptrichtung) – für Konsolen-Treppen mit der hohen Seite am Turm.
function towardCenter(x, z) {
  const dx = x - LIGHTHOUSE.cx;
  const dz = z - LIGHTHOUSE.cz;
  if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 'west' : 'east';
  return dz > 0 ? 'north' : 'south';
}

// Randzellen einer Kreisscheibe. Rand = ein Nachbar (auch diagonal) liegt außerhalb → der Ring ist über Flächen
// geschlossen, Geländer haben keine Diagonallücken.
function ringCells(cx, cz, r) {
  const cells = [];
  const inside = (x, z) => Math.hypot(x - cx, z - cz) <= r + 0.5;
  for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++) {
      if (!inside(x, z)) continue;
      let edge = false;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!inside(x + dx, z + dz)) edge = true;
      if (edge) cells.push([x, z]);
    }
  }
  return cells;
}

// ---------------------------------------------------------------- Gelände, Kai, Molen

function buildLand(b) {
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z <= 12; z++) {
      b.fill(x, 0, z, x, 2, z, 'stone');
      b.fill(x, 3, z, x, 4, z, 'dirt');
      b.set(x, GROUND, z, 'grass_block');
    }
  }
  // Uferstreifen im Westen: Erde und Gras, zum Becken hin eine Böschung aus Bruchstein.
  for (let z = 13; z < SIZE; z++) {
    for (let x = 0; x <= 2; x++) {
      b.fill(x, 0, z, x, 2, z, 'stone');
      b.fill(x, 3, z, x, 4, z, 'dirt');
      b.set(x, GROUND, z, z > 38 && x === 0 ? 'coarse_dirt' : 'grass_block');
    }
    for (let y = 0; y <= GROUND; y++) b.set(3, y, z, y === GROUND ? 'mossy_cobblestone' : b.pick(['cobblestone', 'mossy_cobblestone', 'stone']));
  }
}

function buildSeabed(b) {
  for (let x = BASIN.x1; x <= BASIN.x2; x++) {
    for (let z = BASIN.z1; z <= BASIN.z2; z++) {
      if (inPlatform(x, z)) continue;
      b.set(x, 0, z, 'stone');
      b.set(x, SEABED, z, b.pickWeighted(P.seabed));
    }
  }
}

function buildQuay(b) {
  quayBlock(b, 3, 13, 41, 14);
  // Oberseite: Pflaster vor dem Lagerhaus, Kante aus poliertem Andesit.
  floorPattern(b, { x: 0, y: GROUND, z: 10, facing: 'south', width: SIZE, depth: 4, pattern: 'random',
    blocks: [[P.quay, 6], ['andesite', 2], [P.quayCracked, 1], ['polished_andesite', 2]] });
  b.fill(3, GROUND, 14, 41, GROUND, 14, P.cap);
}

function buildMoles(b) {
  // Südmole z 37 … 40, Ostmole x 38 … 40; außen Brüstung aus Steinziegeln mit Stufe obendrauf.
  quayBlock(b, 3, 37, 37, 40);
  quayBlock(b, 38, 15, 40, 40);
  for (let x = 3; x <= 40; x++) b.set(x, GROUND, 37, P.cap);
  for (let z = 15; z <= 36; z++) b.set(38, GROUND, z, P.cap);
  for (let x = 3; x <= 40; x++) {
    if (inPlatform(x, 40)) continue;
    b.set(x, WALK, 40, P.quay);
    b.set(x, WALK + 1, 40, P.capSlab);
  }
  for (let z = 15; z <= 40; z++) {
    if (inPlatform(40, z)) continue;
    b.set(40, WALK, z, P.quay);
    b.set(40, WALK + 1, z, P.capSlab);
  }
}

function buildPlatform(b) {
  const { cx, cz, platform } = LIGHTHOUSE;
  b.cylinder(cx, 0, cz, platform, GROUND, P.quay);
  for (let y = 1; y < GROUND; y++) {
    for (const [x, z] of ringCells(cx, cz, platform)) b.set(x, y, z, quayStone(b, y));
  }
  b.disc(cx, GROUND, cz, platform, P.quay);
  b.disc(cx, GROUND, cz, platform, P.cap, { hollow: true });
}

function buildRiprap(b) {
  // Steinschüttung vor den Außenseiten der Molen (Wellenbrecher).
  const heights = (x, z) => ((x * 7 + z * 13) % 4 === 0 ? 3 : 2);
  for (let x = 0; x < SIZE; x++) {
    const h = x <= 2 ? 1 : heights(x, 41);
    for (let y = 0; y <= h; y++) b.set(x, y, 41, b.pick(P.riprap));
  }
  for (let z = 13; z <= 40; z++) {
    const h = heights(41, z);
    for (let y = 0; y <= h; y++) setIfAir(b, 41, y, z, b.pick(P.riprap));
  }
}

// ---------------------------------------------------------------- Holzstege

function pierDeck(b, x1, z1, x2, z2, along) {
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const edge = along === 'z' ? x === x1 || x === x2 : z === z1 || z === z2;
      b.set(x, GROUND, z, edge ? `${P.deckBeam}[axis=${along}]` : P.deck);
    }
  }
}

function pierPosts(b, cells) {
  for (const [x, z] of cells) b.fill(x, SEABED + 1, z, x, GROUND - 1, z, `${P.post}[axis=y]`);
}

function buildPiers(b) {
  const posts = [];
  // Steg 1: x 9 … 11, z 15 … 27.
  for (let z = 17; z <= 27; z += 5) posts.push([9, z], [11, z]);
  posts.push([9, 27], [11, 27]);
  // Steg 2 als T: Stiel x 25 … 27 (z 15 … 22), Kopf x 22 … 30 (z 23 … 25).
  posts.push([25, 18], [27, 18], [22, 23], [22, 25], [26, 25], [30, 23], [30, 25]);
  pierPosts(b, posts);
  pierDeck(b, 9, 15, 11, 27, 'z');
  pierDeck(b, 25, 15, 27, 22, 'z');
  pierDeck(b, 22, 23, 30, 25, 'x');
}

function buildBollards(b) {
  const spots = [
    [9, 21], [11, 21], [9, 27], [11, 27], // Steg 1
    [22, 23], [22, 25], [30, 23], [30, 25], [26, 25], // T-Kopf
    [8, 14], [12, 14], [24, 14], [28, 14], // Kaikante neben den Stegen
    [16, 37], [30, 37], [38, 22], // Molen
  ];
  for (const [x, z] of spots) b.set(x, WALK, z, P.bollard);
}

// ---------------------------------------------------------------- Wasser

function buildWater(b) {
  b.fill(BASIN.x1, SEABED + 1, BASIN.z1, BASIN.x2, WATER_TOP, BASIN.z2, 'water[level=0]', { keep: true });
  // Leitern an der Kaimauer und der Südmole.
  for (const [x, z, facing] of [[6, 15, 'south'], [33, 15, 'south'], [20, 36, 'north']]) {
    for (let y = SEABED + 1; y <= WATER_TOP; y++) b.set(x, y, z, `ladder[facing=${facing},waterlogged=true]`);
  }
  // Seegras und Seetang auf Sand (nur mitten im Wasser).
  for (let x = BASIN.x1 + 1; x < BASIN.x2; x++) {
    for (let z = BASIN.z1 + 1; z < BASIN.z2; z++) {
      if (b.get(x, SEABED + 1, z) !== 'water[level=0]' || b.get(x, SEABED, z) !== 'sand') continue;
      const roll = ((x * 31 + z * 17) % 23);
      if (roll === 0) {
        b.set(x, SEABED + 1, z, 'kelp_plant');
        b.set(x, SEABED + 2, z, 'kelp[age=20]');
      } else if (roll < 4) {
        b.set(x, SEABED + 1, z, 'seagrass');
      }
    }
  }
}

// ---------------------------------------------------------------- Leuchtturm

const TOWER = {
  plinthTop: WALK + 1, // y 6 … 7 Sockel
  shaftTop: WALK + 16, // y 22
  floor: WALK + 17, // y 23 Galerie und Boden des Lichtraums
};

function bandColor(y) {
  const k = Math.floor((y - (TOWER.plinthTop + 1)) / 3);
  return k % 2 === 0 ? P.red : P.white;
}

function buildTowerShaft(b) {
  const { cx, cz, shaft } = LIGHTHOUSE;
  for (let y = WALK; y <= TOWER.shaftTop; y++) {
    b.cylinder(cx, y, cz, shaft, 1, y <= TOWER.plinthTop ? P.plinth : bandColor(y), { hollow: true, thickness: 2 });
  }
  // Fenster: außen eine Nische, innen die Scheibe (Wand 2 dick).
  const windows = [[11, 1, 0], [14, 0, 1], [17, -1, 0], [20, 0, -1], [9, 0, 1]];
  for (const [y, dx, dz] of windows) {
    b.set(cx + dx * 4, y, cz + dz * 4, 'air');
    b.set(cx + dx * 3, y, cz + dz * 3, 'glass_pane');
  }
}

function buildTowerDoor(b) {
  const { cx, cz } = LIGHTHOUSE;
  doorway(b, { x: cx, y: WALK, z: cz - 4, facing: 'north', door: 'spruce_door', frame: 'chiseled_stone_bricks' });
  b.set(cx, WALK, cz - 3, 'air');
  b.set(cx, WALK + 1, cz - 3, 'air');
}

function buildSpiral(b) {
  const { cx, cz } = LIGHTHOUSE;
  b.spiralStairs(cx, cz, WALK, TOWER.floor, 2, P.stairs, { clockwise: true, core: P.core });
  // Pilzlicht im Kern, je eine Seite alle 4 Ebenen.
  const faces = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let i = 0; WALK + 4 * i < TOWER.floor; i++) {
    const [dx, dz] = faces[i % 4];
    b.set(cx + dx, WALK + 4 * i, cz + dz, P.coreLight);
  }
}

function stairCellAt(b, y) {
  const { cx, cz } = LIGHTHOUSE;
  for (let x = cx - 2; x <= cx + 2; x++) {
    for (let z = cz - 2; z <= cz + 2; z++) if (/_stairs/.test(b.get(x, y, z))) return [x, z];
  }
  throw new Error(`Hafen: keine Treppe auf Ebene ${y + 1} gefunden.`);
}

function buildGallery(b) {
  const { cx, cz, gallery } = LIGHTHOUSE;
  const y = TOWER.floor;
  for (const [x, z] of ringCells(cx, cz, gallery)) b.stairs(x, y - 1, z, P.stairs.replace('spruce', 'stone_brick'), { facing: towardCenter(x, z), half: 'top' });
  // Boden nur in Luft, damit Kern und oberste Treppe bleiben.
  for (let x = cx - gallery; x <= cx + gallery; x++) {
    for (let z = cz - gallery; z <= cz + gallery; z++) if (Math.hypot(x - cx, z - cz) <= gallery + 0.5) setIfAir(b, x, y, z, P.galleryFloor);
  }
  // Kopffreiheit über den letzten beiden Treppen.
  for (const yy of [y - 2, y - 1]) {
    const [x, z] = stairCellAt(b, yy);
    b.set(x, y, z, 'air');
  }
  for (const [x, z] of ringCells(cx, cz, gallery)) b.set(x, y + 1, z, P.railing);
}

function buildLanternRoom(b) {
  const { cx, cz } = LIGHTHOUSE;
  const y0 = TOWER.floor + 1;
  b.cylinder(cx, y0, cz, 3, 3, 'glass', { hollow: true });
  b.door(cx, y0, cz + 3, 'spruce_door', { facing: 'north', hinge: 'left' });
  b.set(cx, y0, cz, 'chiseled_stone_bricks');
  b.set(cx, y0 + 1, cz, 'sea_lantern');
  b.set(cx, y0 + 2, cz, 'glowstone');
}

function buildDome(b) {
  const { cx, cz } = LIGHTHOUSE;
  const y = TOWER.floor + 4;
  // Traufe als geschlossener Ring (ringCells): auch an den Schrägen hängen die Stufen über Flächen zusammen.
  for (const [x, z] of ringCells(cx, cz, 4)) b.set(x, y, z, P.eave);
  // Kegeldach aus Treppenringen (hohe Seite zur Mitte), Ecken formen sich automatisch.
  for (const [r, dy] of [[3, 0], [2, 1], [1, 2]]) {
    for (const [x, z] of ringCells(cx, cz, r)) b.stairs(x, y + dy, z, P.domeStairs, { facing: towardCenter(x, z) });
  }
  b.set(cx, y + 2, cz, P.dome);
  b.set(cx, y + 3, cz, P.dome);
  b.set(cx, y + 4, cz, 'waxed_oxidized_lightning_rod[facing=up]');
  for (const [dx, dz] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) b.set(cx + dx, y - 1, cz + dz, 'lantern[hanging=true]');
}

function buildPlatformRailing(b) {
  const { cx, cz, platform } = LIGHTHOUSE;
  for (const [x, z] of ringCells(cx, cz, platform)) {
    const ox = Math.sign(x - cx);
    const oz = Math.sign(z - cz);
    const outside = [[x + ox, z], [x, z + oz]].some(([nx, nz]) => /^water/.test(b.get(nx, GROUND, nz)) || /^water/.test(b.get(nx, WATER_TOP, nz)));
    if (outside) b.set(x, WALK, z, 'stone_brick_wall');
  }
}

// ---------------------------------------------------------------- Lagerhaus

function buildWarehouseShell(b) {
  const { x1, x2, z1, z2 } = WAREHOUSE;
  b.fill(x1 + 1, GROUND, z1 + 1, x2 - 1, GROUND, z2 - 1, P.deck);
  b.walls(x1, WALK, z1, x2, WALK, z2, P.plinth);
  b.walls(x1, WALK + 1, z1, x2, WALK + 3, z2, P.wall);
  const postsX = [x1, 7, 12, x2];
  const postsZ = [z1, 5, z2];
  for (const x of postsX) for (const z of [z1, z2]) b.fill(x, WALK, z, x, WALK + 3, z, `${P.frame}[axis=y]`);
  for (const z of postsZ) for (const x of [x1, x2]) b.fill(x, WALK, z, x, WALK + 3, z, `${P.frame}[axis=y]`);
  // Rähm: liegende Stämme als Abschluss der Wände.
  b.fill(x1, WALK + 4, z1, x2, WALK + 4, z1, `${P.frame}[axis=x]`);
  b.fill(x1, WALK + 4, z2, x2, WALK + 4, z2, `${P.frame}[axis=x]`);
  b.fill(x1, WALK + 4, z1 + 1, x1, WALK + 4, z2 - 1, `${P.frame}[axis=z]`);
  b.fill(x2, WALK + 4, z1 + 1, x2, WALK + 4, z2 - 1, `${P.frame}[axis=z]`);
  // Zugbalken quer durch den Raum.
  for (const x of [7, 12]) b.fill(x, WALK + 4, z1 + 1, x, WALK + 4, z2 - 1, `${P.frame}[axis=z]`);
}

function buildWarehouseRoof(b) {
  const { x1, x2, z1, z2 } = WAREHOUSE;
  b.roof({ x1, z1, x2, z2, y: WALK + 4, type: 'gable', axis: 'x', stairs: P.roofStairs, slab: P.roofSlab, full: P.wall, overhang: 1 });
}

function buildWarehouseOpenings(b) {
  const { x1, x2, z1, z2 } = WAREHOUSE;
  doorway(b, { x: 9, y: WALK, z: z2, facing: 'south', door: 'spruce_door', width: 2, frame: P.frame, canopy: P.roofStairs });
  // Fenster eine Ebene über dem Sockel: so sitzt die Fensterbank an der Bretterwand und nicht am Boden.
  for (const x of [5, 14]) {
    window(b, { x, y: WALK + 2, z: z2, facing: 'south', height: 2, sill: P.stairs, shutters: 'spruce_trapdoor' });
    window(b, { x, y: WALK + 2, z: z1, facing: 'north', height: 2, sill: P.stairs, shutters: 'spruce_trapdoor' });
  }
  for (const z of [3, 7]) {
    window(b, { x: x1, y: WALK + 2, z, facing: 'west', height: 2, sill: P.stairs });
    window(b, { x: x2, y: WALK + 2, z, facing: 'east', height: 2, sill: P.stairs });
  }
  // Ladeluke im Ostgiebel mit Kranbalken und hängendem Fass.
  b.set(x2, WALK + 6, 5, 'spruce_trapdoor[facing=east,half=bottom,open=true]');
  b.fill(x2 + 1, WALK + 7, 5, x2 + 2, WALK + 7, 5, `${P.frame}[axis=x]`);
  b.fill(x2 + 2, WALK + 4, 5, x2 + 2, WALK + 6, 5, 'iron_chain[axis=y]');
  b.set(x2 + 2, WALK + 3, 5, 'barrel[facing=up]');
}

function buildWarehouseInterior(b) {
  const { x1, x2, z1, z2 } = WAREHOUSE;
  storage(b, { x: x1 + 1, y: WALK, z: z1 + 1, facing: 'south', width: 6, height: 2 });
  // Fassstapel und Kisten (Komposter) in der Nordostecke.
  for (let x = 12; x <= x2 - 1; x++) {
    b.set(x, WALK, z1 + 1, 'barrel[facing=up]');
    b.set(x, WALK + 1, z1 + 1, x === 13 ? 'barrel[facing=north]' : 'barrel[facing=up]');
    b.set(x, WALK, z1 + 2, 'composter');
  }
  b.set(x2 - 1, WALK + 2, z1 + 1, 'barrel[facing=up]');
  b.set(14, WALK + 1, z1 + 2, 'composter');
  // Getrockneter Seetang in Ballen an der Westwand.
  b.fill(x1 + 1, WALK, 6, x1 + 1, WALK + 1, z2 - 1, 'dried_kelp_block');
  b.set(x1 + 2, WALK, z2 - 1, 'dried_kelp_block');
  // Schreibpult des Hafenmeisters.
  b.set(13, WALK, 6, 'cartography_table');
  b.stairs(13, WALK, 7, 'spruce_stairs', { facing: 'south' });
  b.set(14, WALK, 6, 'chest[facing=south]');
  b.set(13, WALK + 1, 6, 'lantern[hanging=false]');
  // Je eine Laterne an einer Kette mitten unter den beiden Zugbalken.
  for (const x of [7, 12]) hangingLantern(b, { x, y: WALK + 3, z: 5, chain: 1 });
  lightRoom(b, { x1: x1 + 1, y1: WALK, z1: z1 + 1, x2: x2 - 1, y2: WALK + 3, z2: z2 - 1 });
}

// ---------------------------------------------------------------- Hafenkran

// Schräge Strebe ab dem Mast: geschältes Fichtenholz im 45°-Winkel, unter jedem weiteren Holz eine obere Treppe mit der
// hohen Seite zum Mast – so hängt die Strebe über Flächen zusammen statt nur über Kanten.
function craneBrace(b, x, y0, z0, steps, dz) {
  const towardMast = dz > 0 ? 'north' : 'south';
  for (let i = 0; i <= steps; i++) {
    b.set(x, y0 + i, z0 + i * dz, 'stripped_spruce_wood');
    if (i > 0) b.stairs(x, y0 + i - 1, z0 + i * dz, P.stairs, { facing: towardMast, half: 'top' });
  }
}

function buildCrane(b) {
  const { x, z } = CRANE;
  b.fill(x - 1, WALK, z - 1, x + 1, WALK, z + 1, P.deck);
  b.fill(x, WALK, z, x, WALK + 10, z, `${P.post}[axis=y]`);
  // Fuß: Treppen rundum mit der hohen Seite zum Mast, Ecken aus Stufen.
  for (const [dx, dz, facing] of [[0, -1, 'south'], [1, 0, 'west'], [0, 1, 'north'], [-1, 0, 'east']]) b.stairs(x + dx, WALK + 1, z + dz, P.stairs, { facing });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.slab(x + dx, WALK + 1, z + dz, 'spruce_slab');
  b.set(x, WALK + 2, z - 1, 'spruce_trapdoor[facing=north,half=bottom,open=true]');
  // Ausleger über das Wasser, hinten Gegengewicht.
  const boomY = WALK + 11;
  b.fill(x, boomY, z - 3, x, boomY, z + 8, `${P.post}[axis=z]`);
  craneBrace(b, x, WALK + 7, z + 1, 3, 1);
  craneBrace(b, x, WALK + 8, z - 1, 2, -1);
  b.fill(x, boomY - 2, z - 3, x, boomY - 1, z - 3, 'cobblestone');
  b.fill(x, boomY - 4, z + 8, x, boomY - 1, z + 8, 'iron_chain[axis=y]');
  b.set(x, boomY - 5, z + 8, 'barrel[facing=up]');
  // Winde neben dem Fuß.
  b.set(x - 2, WALK, z, 'grindstone[face=floor,facing=north]');
}

// ---------------------------------------------------------------- Umgebung

function buildCargo(b) {
  const groups = [
    // Vor dem Lagerhaus
    [[14, 11, 'barrel[facing=up]'], [15, 11, 'barrel[facing=up]'], [15, 12, 'composter'], [14, 11, 'barrel[facing=up]', 1], [16, 11, 'composter']],
    // T-Steg
    [[28, 24, 'barrel[facing=up]'], [29, 24, 'composter'], [29, 24, 'barrel[facing=up]', 1], [23, 24, 'chest[facing=east]']],
    // Steg 1
    [[10, 26, 'barrel[facing=south]']],
    // Kai Ost
    [[35, 11, 'composter'], [36, 11, 'composter'], [36, 12, 'barrel[facing=up]'], [36, 11, 'composter', 1]],
  ];
  for (const group of groups) for (const [x, z, state, up = 0] of group) b.set(x, WALK + up, z, state);
}

function buildStall(b) {
  const x1 = 27;
  const x2 = 31;
  const z1 = 5;
  const z2 = 8;
  for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) b.fill(x, WALK, z, x, WALK + 2, z, 'spruce_fence');
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, WALK + 3, z, (x - x1) % 2 === 0 ? 'red_wool' : 'white_wool');
  b.set(28, WALK, z2, 'barrel[facing=south]');
  b.set(29, WALK, z2, 'smoker[facing=south]');
  b.set(30, WALK, z2, 'barrel[facing=south]');
  b.set(29, WALK + 1, z2, 'lantern[hanging=false]');
  b.stairs(29, WALK, z1 + 1, 'spruce_stairs', { facing: 'north' });
  b.set(29, WALK + 2, 6, 'lantern[hanging=true]');
}

function buildLamps(b) {
  for (const x of [2, 18, 31, 39]) lampPost(b, { x, y: WALK, z: 13, facing: 'south', height: 3, post: 'dark_oak_fence', base: P.quay });
  for (const x of [9, 23]) lampPost(b, { x, y: WALK, z: 38, facing: 'south', height: 3, post: 'dark_oak_fence', base: P.quay });
  lampPost(b, { x: 39, y: WALK, z: 26, facing: 'south', height: 3, post: 'dark_oak_fence', base: P.quay });
  lampPost(b, { x: 10, y: WALK, z: 27, facing: 'south', height: 2, post: 'spruce_fence' });
  lampPost(b, { x: 26, y: WALK, z: 24, facing: 'south', height: 2, post: 'spruce_fence' });
}

function buildGreen(b) {
  path(b, { x: 23, y: GROUND, z: 0, facing: 'south', length: 10, width: 3, mix: 'kies', wiggle: 0, seed: 4 });
  tree(b, { x: 37, y: WALK, z: 4, species: 'eiche', size: 'klein', seed: 3 });
  bush(b, { x: 20, y: WALK, z: 3, size: 'klein', leaves: 'fichte', seed: 2 });
  bush(b, { x: 1, y: WALK, z: 30, size: 'klein', leaves: 'eiche', seed: 5 });
  rock(b, { x: 1, y: GROUND, z: 20, size: 'klein', material: 'andesit', seed: 1 });
  rock(b, { x: 1, y: GROUND, z: 36, size: 'klein', material: 'stein', seed: 2 });
  vegetation(b, { x: 24, y: WALK, z: 0, width: 18, depth: 10, mix: 'wiese', density: 0.3, seed: 6 });
  vegetation(b, { x: 0, y: WALK, z: 13, width: 3, depth: 28, mix: 'blumen', density: 0.35, seed: 7 });
}

// ---------------------------------------------------------------- Kapitel

export default function build(b) {
  b.phase('Gelände und Hafenbecken');
  b.step();
  buildLand(b);
  b.step();
  buildSeabed(b);

  b.phase('Kaimauer und Molen');
  b.step();
  buildQuay(b);
  b.step();
  buildMoles(b);
  b.step();
  buildPlatform(b);
  b.step();
  buildRiprap(b);

  b.phase('Holzstege');
  b.step();
  buildPiers(b);
  b.step();
  buildBollards(b);

  b.phase('Wasser');
  b.step();
  buildWater(b);

  b.phase('Leuchtturm: Schaft und Wendeltreppe');
  buildTowerShaft(b);
  buildTowerDoor(b);
  buildSpiral(b);

  b.phase('Leuchtturm: Galerie und Lichtraum');
  b.step();
  buildGallery(b);
  b.step();
  buildLanternRoom(b);
  b.step();
  buildDome(b);
  b.step();
  buildPlatformRailing(b);

  b.phase('Lagerhaus');
  b.step();
  buildWarehouseShell(b);
  b.step();
  buildWarehouseRoof(b);
  b.step();
  buildWarehouseOpenings(b);
  b.step();
  buildWarehouseInterior(b);

  b.phase('Hafenkran');
  b.step();
  buildCrane(b);

  b.phase('Umgebung');
  b.step();
  buildCargo(b);
  b.step();
  buildStall(b);
  b.step();
  buildLamps(b);
  b.step();
  buildGreen(b);

  assertLit(b);
}

// Prüft, dass in allen Innenräumen kein begehbares Feld dunkel ist (sonst Fehler statt still dunkler Bau).
function assertLit(b) {
  const { cx, cz } = LIGHTHOUSE;
  const rooms = [
    ['Leuchtturm', { x1: cx - 2, y1: WALK, z1: cz - 3, x2: cx + 2, y2: TOWER.floor - 1, z2: cz + 2 }],
    ['Lichtraum', { x1: cx - 2, y1: TOWER.floor + 1, z1: cz - 2, x2: cx + 2, y2: TOWER.floor + 3, z2: cz + 2 }],
    ['Lagerhaus', { x1: WAREHOUSE.x1 + 1, y1: WALK, z1: WAREHOUSE.z1 + 1, x2: WAREHOUSE.x2 - 1, y2: WALK + 8, z2: WAREHOUSE.z2 - 1 }],
  ];
  // Nur Felder unter einem Dach zählen (die Box des Lagerhauses reicht bis in den Dachraum und schneidet die Dachfläche).
  const covered = ([x, y, z]) => {
    for (let yy = y + 1; yy <= y + 12; yy++) if (b.get(x, yy, z) !== 'air') return true;
    return false;
  };
  for (const [name, box] of rooms) {
    const dark = findDarkSpots(b, box).filter(covered);
    if (dark.length > 0) throw new Error(`Hafen: ${name} hat ${dark.length} dunkle Felder, z. B. ${dark[0].join(', ')}.`);
  }
}
