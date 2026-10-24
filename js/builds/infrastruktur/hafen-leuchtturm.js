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
  difficulty: 4,
  description: 'Ein kleiner Hafen für deine Küste: Kaimauer und Molen aus Steinziegeln umschließen ein Becken mit zwei Holzstegen, '
    + 'Pollern und Leitern. Auf dem Molenkopf steht ein rot-weißer Leuchtturm mit Wendeltreppe, Galerie und Lichtraum mit Seelaterne '
    + 'und Leuchtstein. An Land warten ein Lagerhaus mit Fässern und Kisten, ein hölzerner Hafenkran und ein Fischstand.',
  facts: [
    'Das Becken ist ganz von Mauern umschlossen, damit kein Wasser ausläuft. Liegt dein Hafen am Meer, brich an der Markierung in der Südmole eine Einfahrt auf.',
    'Der Leuchtturm ragt 26 Blöcke über den Molenkopf: eine Wendeltreppe mit 18 Stufen um einen Kern aus Fichtenholz, oben Galerie mit Gitter und Lichtraum unter einem Kupferdach.',
    'Alle begehbaren Innenräume (Leuchtturm, Lichtraum, Lagerhaus) haben Blocklicht über 0 – dort spawnen keine Monster.',
    'Das gewachste Kupferdach und der Blitzableiter bleiben grün und laufen nicht weiter an.',
    'Fässer und Truhen im Lagerhaus sind echte Behälter; Komposter dienen als Holzkisten.',
  ],
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
  const lvl = (y) => y + 1;
  const { cx, cz } = LIGHTHOUSE;

  b.phase('Gelände und Hafenbecken', `Der Hafen ist ${SIZE} × ${SIZE} Blöcke groß. Im Norden liegt das Land (Oberkante Ebene ${lvl(GROUND)}), `
    + `im Süden das Becken: Grund auf Ebene ${lvl(SEABED)}, darüber 3 Ebenen Wasser bis Ebene ${lvl(WATER_TOP)}.`, {
    tips: ['Baust du an einer echten Küste, grab das Becken einfach 4 Blöcke tief aus und spar dir die Aufschüttung.',
      'Sand und Kies im Becken liegen auf einer Steinschicht – so fällt nichts nach unten weg.'],
  });
  b.step('Land aufschütten', `Fülle das Land im Norden (z 0 … 12) und den Uferstreifen im Westen: unten Stein, dann 2 Schichten Erde, oben Gras. Die Böschung zum Becken (x = 3) setzt du aus Bruchstein.`);
  buildLand(b);
  b.step('Meeresboden', 'Lege den Beckengrund: eine Lage Stein und darauf Sand mit etwas Kies und Ton.');
  buildSeabed(b);

  b.phase('Kaimauer und Molen', 'Die Mauern aus Steinziegeln reichen vom Grund bis zur Geländeoberkante. Unter Wasser mischst du mehr bemooste Steinziegel ein – das sieht nach altem Hafen aus.', {
    tips: ['Setze erst die äußeren Kanten jeder Mauer als Linie, dann füllst du dazwischen.',
      'Der Molenkopf ist ein Kreis mit 13 Blöcken Durchmesser – setz zuerst die vier äußersten Punkte, 6 Blöcke von der Mitte.'],
  });
  b.step('Kaimauer', `Zwei Blöcke dick (z 13 … 14), oben vorne eine Kante aus Poliertem Andesit. Davor pflasterst du den Kai (z 10 … 13) mit Steinziegeln und Andesit.`);
  buildQuay(b);
  b.step('Molen', 'Die Südmole (z 37 … 40) und die Ostmole (x 38 … 40) schließen das Becken. Außen bekommen sie eine Brüstung: ein Steinziegel und darauf eine Steinziegelstufe.');
  buildMoles(b);
  b.note(20, WALK, 39, 'Hier kannst du eine Einfahrt aufbrechen, wenn hinter der Mole echtes Meer liegt – sonst läuft das Becken aus.');
  b.step('Molenkopf', `Runder Sockel für den Leuchtturm mit Mitte bei x ${cx}, z ${cz}, Radius 6, Rand aus Poliertem Andesit.`);
  buildPlatform(b);
  b.step('Steinschüttung', 'Vor die Außenseiten der Molen kommen lose Steine in unterschiedlicher Höhe – sie brechen im Original die Wellen.');
  buildRiprap(b);

  b.phase('Holzstege', `Zwei Stege aus Fichtenholz auf Pfählen: ein gerader (x 9 … 11) und ein T-förmiger (x 22 … 30). Der Belag liegt auf Ebene ${lvl(GROUND)}, genau auf Kaihöhe.`, {
    tips: ['Setze erst die Pfähle vom Grund bis unter den Belag, dann die Randbalken (liegende geschälte Stämme) und zuletzt die Bretter.'],
  });
  b.step('Pfähle', 'Fichtenstämme stehend vom Grund (Ebene 3) bis Ebene 5 an den Rändern und Ecken der Stege.');
  buildPiers(b);
  b.step('Poller', 'Poller aus Polierter-Schwarzstein-Mauer auf den Stegköpfen, an der Kaikante neben den Stegen und auf den Molen.');
  buildBollards(b);

  b.phase('Wasser', 'Jetzt flutest du das Becken: nur Wasserquellen, keine fließenden Blöcke.', {
    tips: ['Mit zwei Quellen in einer Ecke entsteht eine unendliche Quelle – daraus schöpfst du beliebig viele Eimer.',
      'Fülle Lage für Lage von unten nach oben; stehen Quellen in jeder Zelle, bleibt die Oberfläche glatt.'],
  });
  b.step('Becken fluten', `Wasserquellen von Ebene ${lvl(SEABED + 1)} bis ${lvl(WATER_TOP)} im ganzen Becken.`);
  buildWater(b);
  b.note(6, WATER_TOP, 15, 'Leitern an der Kaimauer: Wer ins Becken fällt, kommt hier wieder heraus.');

  b.phase('Leuchtturm: Schaft und Wendeltreppe', `Der Schaft ist ein Rohr mit 9 Blöcken Durchmesser und 2 Blöcken Wandstärke, innen bleibt ein 5 × 5-Feld. `
    + `Unten 2 Ebenen Steinziegel als Sockel, darüber Bänder aus Rotem und Weißem Beton zu je 3 Ebenen. Die Treppe läuft im Uhrzeigersinn um einen 3 × 3-Kern aus geschälten Fichtenstämmen.`, {
    tips: ['Setze in jeder Ebene zuerst die Wand, dann die eine Treppenstufe – so stehst du immer auf der letzten Stufe und baust bequem weiter.',
      'Die Fenster sitzen innen in der Wand: außen bleibt eine Nische frei, dahinter die Glasscheibe.',
      'Im Kern steckt alle 4 Ebenen ein Pilzlicht – es leuchtet den ganzen Treppenturm aus.'],
  });
  buildTowerShaft(b);
  buildTowerDoor(b);
  buildSpiral(b);
  b.note(cx, WALK, cz - 2, 'Die Wendeltreppe beginnt direkt hinter der Tür und geht im Uhrzeigersinn nach oben.');

  b.phase('Leuchtturm: Galerie und Lichtraum', `Oben trägt ein Kranz aus umgedrehten Steinziegeltreppen die Galerie auf Ebene ${lvl(TOWER.floor)}. `
    + 'Der Lichtraum ist ein Glaszylinder mit Seelaterne und Leuchtstein, darüber ein grünes Kupferdach.', {
    tips: ['Die Konsolen-Treppen setzt du umgedreht: schau beim Setzen zum Turm und klicke auf die obere Hälfte der Turmwand – dann sitzt die Treppe oben im Block.',
      'Gewachstes Kupfer bleibt so grün, wie es ist. Ungewachstes würdest du erst mit der Axt abkratzen müssen.'],
  });
  b.step('Konsolen und Galerieboden', `Ring aus oberen Steinziegeltreppen auf Ebene ${lvl(TOWER.floor - 1)} (hohe Seite zum Turm), darauf der Boden aus Glattem Stein mit 11 Blöcken Durchmesser. Über den letzten beiden Treppenstufen bleiben zwei Felder offen – dort kommst du hoch.`);
  buildGallery(b);
  b.step('Lichtraum', 'Glasring mit 7 Blöcken Durchmesser und 3 Ebenen Höhe, nach Süden eine Tür auf die Galerie. In der Mitte: Gemeißelter Steinziegel als Sockel, darauf Seelaterne und Leuchtstein.');
  buildLanternRoom(b);
  b.note(cx, TOWER.floor + 2, cz, 'Seelaterne und Leuchtstein: das Leuchtfeuer. Beide leuchten mit Stärke 15 auch durch das Glas.');
  b.step('Dach und Laternen', 'Traufe aus gewachsten oxidierten Kupferstufen, darüber ein Kegeldach aus drei Ringen gewachster oxidierter geschnittener Kupfertreppen (hohe Seite zur Mitte), oben ein Kupferblock mit Blitzableiter. Unter die Traufe hängst du vier Laternen.');
  buildDome(b);
  b.step('Brüstung am Molenkopf', 'Steinziegelmauer am Rand des Molenkopfs, überall dort, wo Wasser angrenzt.');
  buildPlatformRailing(b);

  b.phase('Lagerhaus', `Das Lagerhaus (${WAREHOUSE.x2 - WAREHOUSE.x1 + 1} × ${WAREHOUSE.z2 - WAREHOUSE.z1 + 1}) steht hinter dem Kai: ein Sockel aus Steinziegeln, Wände aus Fichtenbrettern und ein Fachwerk-Gerippe aus geschälten Schwarzeichenstämmen.`, {
    tips: ['Setze zuerst alle Pfosten (Ecken und je zwei auf den Längsseiten), dann füllst du die Felder dazwischen.',
      'An den beiden Zugbalken quer durch den Raum hängen später die Laternen.'],
  });
  b.step('Boden, Sockel und Wände', 'Boden aus Fichtenbrettern, eine Ebene Steinziegel als Sockel, darauf 3 Ebenen Bretterwand mit Pfosten, oben ein Kranz aus liegenden Stämmen.');
  buildWarehouseShell(b);
  b.step('Satteldach', 'Satteldach aus Schwarzeichentreppen mit 1 Block Überstand, First als Stufen. Die Giebel im Westen und Osten füllst du mit Fichtenbrettern.');
  buildWarehouseRoof(b);
  b.step('Tor und Fenster', 'Zweiflügelige Tür nach Süden zum Kai mit Vordach, Fenster mit Fensterbank und Läden, im Ostgiebel eine Ladeluke mit Kranbalken.');
  buildWarehouseOpenings(b);
  b.step('Einrichtung und Licht', 'Truhen und Fässer an der Nordwand, Fassstapel und Kisten (Komposter) in der Ecke, Seetangballen im Westen und ein Pult für den Hafenmeister. Die Laternen hängen an Ketten.');
  buildWarehouseInterior(b);

  b.phase('Hafenkran', 'Ein Drehkran aus Holz auf dem Kai: Mast aus Fichtenstamm, Ausleger bis über das Wasser, hinten ein Gegengewicht aus Bruchstein.', {
    tips: ['Setze zuerst den Mast ganz hoch, dann den Ausleger obendrauf – die Streben kommen zuletzt.'],
  });
  b.step('Mast, Ausleger und Streben', 'Plattform 3 × 3 aus Fichtenbrettern, Mast 11 Blöcke hoch, am Fuß ein Kranz aus Fichtentreppen (hohe Seite zum Mast) und Stufen in den Ecken. '
    + 'Obendrauf der 12 Blöcke lange Ausleger, darunter zwei schräge Streben aus geschältem Fichtenholz, jede Stufe unten mit einer umgedrehten Fichtentreppe ausgefüllt. Der Schleifstein daneben ist die Winde.');
  buildCrane(b);
  b.note(CRANE.x, WALK + 6, CRANE.z + 8, 'Am Kranhaken hängt ein Fass über dem Wasser – wie beim Entladen eines Schiffs.');

  b.phase('Umgebung', 'Zum Schluss Ladung, Licht und Grün: Fässer und Kisten auf Kai und Stegen, ein Fischstand mit Räucherofen, Laternenmasten, ein Kiesweg, Baum und Büsche.', {
    tips: ['Laternenmasten stehen auf einem Steinziegel – so wirken sie wie gusseiserne Hafenlampen.'],
  });
  b.step('Fässer und Kisten', 'Gruppen aus Fässern und Kompostern (Kisten) vor dem Lagerhaus, auf dem T-Steg und am Ostende des Kais.');
  buildCargo(b);
  b.step('Fischstand', 'Vier Zaunpfosten, ein Dach aus roter und weißer Wolle, vorne Fässer und ein Räucherofen als Theke.');
  buildStall(b);
  b.step('Laternen', 'Laternenmasten an der Kaikante, auf den Molen und an den Stegköpfen.');
  buildLamps(b);
  b.step('Weg und Grün', 'Kiesweg vom Land zum Kai, eine kleine Eiche, Büsche, Felsen und Blumen auf dem Uferstreifen.');
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
