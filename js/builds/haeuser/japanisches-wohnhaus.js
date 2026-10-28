// Japanisches Wohnhaus: Holzständerhaus (13 × 9) mit Engawa, Irimoya-Dach (unten Walm, oben Giebel) und Garten.
// Bau-Rahmen: Hauswände x 0 … 12, z 0 … 8, Engawa im Süden (z 9 … 10) und Osten (x 13 … 14),
// Fußboden auf y = 0 (Raum ab y = 1), Gelände (Gras) auf y = −1.

import { tree, bush, pond, rock, vegetation, isPlantId, lightRoom, hangingLantern } from '../lib/index.js';

export const meta = {
  id: 'japanisches-wohnhaus',
  title: 'Japanisches Wohnhaus',
  category: 'haeuser',
  subtitle: 'Holzhaus mit Engawa, geschwungenem Ziegeldach, Teich und Kirschbaum',
  tags: ['Japan', 'Asiatisch', 'Holzhaus', 'Engawa', 'Veranda', 'Tatami', 'Shoji', 'Irimoya', 'Teich', 'Kirschbaum', 'Garten', 'Steinlaterne', 'Bambus'],
  aliases: [
    'japanisches haus', 'japan haus', 'japanhaus', 'japanisches wohnhaus', 'japanisches holzhaus', 'japanischer stil', 'asiatisches haus',
    'minka', 'japanese house', 'japanese home', 'traditional japanese house', 'japanese style house',
    'asian house', 'japanisches hous', 'japanishes haus', 'japanisches hus', 'sakura haus', 'kirschblüten haus', 'zen haus', 'zen garten',
  ],
  accuracy: 'nachempfunden',
  description: 'Ein traditionelles japanisches Wohnhaus aus dunklen Holzständern und hellen Wandfeldern, an der Süd- und Ostseite mit einer Engawa-Veranda und Schiebetüren aus Birkenfalltüren. Das Irimoya-Dach aus Tiefenschieferziegeln ist unten abgewalmt, oben ein kleiner Giebel, und an den vier Ecken leicht hochgezogen. Innen liegen Tatami aus geschältem Bambus, ein Wohnraum mit Feuerstelle und Bildnische, ein Schlafraum mit Futons und eine kleine Küche. Draußen warten Teich mit Steg, Kirschbaum, Steinlaternen, Kiesgarten und ein Bambushain.',
  sources: [],
  credits: null,
  tested: null,
};

const POST = 'stripped_dark_oak_log';
const POST_WOOD = 'stripped_dark_oak_wood';
const RAFTER = 'stripped_spruce_log';
const PANEL = 'smooth_quartz';
const BAND = 'spruce_planks';
const TATAMI = 'stripped_bamboo_block';
const TILE = { stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'deepslate_tiles', wall: 'deepslate_tile_wall' };

const BODY = { x0: 0, x1: 12, z0: 0, z1: 8 };
const WALL_TOP = 5; // Rähm (Ringbalken) auf y = 5
const ENGAWA = { x1: 14, z1: 10 };
const ROOF = { x0: -2, x1: 14, z0: -2, z1: 10, y: 4, gable: 3 };
const RIDGE_K = Math.floor((ROOF.z1 - ROOF.z0) / 2);
const GROUND = { x0: -8, x1: 34, z0: -10, z1: 20 };
const POND = { x: 17, z: 4, width: 13, depth: 10 };
const DOCK_Z = 8;
const LANTERNS = [[13, 14], [16, 2], [31, 10]];
const BODY_POSTS_X = [0, 4, 8, 12];
const BODY_POSTS_Z = [0, 4, 8];
const ENGAWA_POSTS = [[0, 10], [4, 10], [8, 10], [12, 10], [14, 10], [14, 8], [14, 4], [14, 0]];

const log = (id, axis) => `${id}[axis=${axis}]`;

// --------------------------------------------------------------- Dach-Geometrie

// Reihe des Irimoya-Dachs: an den Schmalseiten (Westen/Osten) Walm bis Reihe gable − 1, darüber Giebel.
function roofLevel(x, z) {
  const dx = Math.min(x - ROOF.x0, ROOF.x1 - x);
  const dz = Math.min(z - ROOF.z0, ROOF.z1 - z);
  return dx >= ROOF.gable ? dz : Math.min(dx, dz);
}

function inRoof(x, z) {
  return x >= ROOF.x0 && x <= ROOF.x1 && z >= ROOF.z0 && z <= ROOF.z1;
}

// Treppe zeigt mit der hohen Seite zur höheren Nachbarreihe; Walm-Ecken im Windrad (ergibt Außenecken).
function roofState(x, z) {
  const k = roofLevel(x, z);
  if (k === RIDGE_K) return TILE.full;
  const dirs = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];
  const up = dirs.filter(([, dx, dz]) => inRoof(x + dx, z + dz) && roofLevel(x + dx, z + dz) > k);
  let facing;
  if (up.length > 0) facing = up[0][0];
  else {
    const west = x < (ROOF.x0 + ROOF.x1) / 2;
    const north = z < (ROOF.z0 + ROOF.z1) / 2;
    if (north) facing = west ? 'south' : 'west';
    else facing = west ? 'east' : 'north';
  }
  return `${TILE.stairs}[facing=${facing},half=bottom]`;
}

function roofRing(b, k, filter = () => true) {
  for (let x = ROOF.x0; x <= ROOF.x1; x++) {
    for (let z = ROOF.z0; z <= ROOF.z1; z++) {
      if (roofLevel(x, z) === k && filter(x, z)) b.set(x, ROOF.y + k, z, roofState(x, z));
    }
  }
}

// Zellen des Giebeldreiecks bei x = gx: unter den Giebeltreppen, ab y = ROOF.y + gable.
function gableCells(gx) {
  const cells = [];
  for (let z = ROOF.z0; z <= ROOF.z1; z++) {
    const top = ROOF.y + roofLevel(gx, z) - 1;
    for (let y = ROOF.y + ROOF.gable; y <= top; y++) cells.push([gx, y, z]);
  }
  return cells;
}

// --------------------------------------------------------------- Bauplatz und Fundament

function site(b) {
  b.phase('Bauplatz');
  b.step();
  b.fill(GROUND.x0, -1, GROUND.z0, GROUND.x1, -1, GROUND.z1, 'grass_block');
}

function foundation(b) {
  b.phase('Fundament');
  b.step();
  const stones = [];
  for (const x of BODY_POSTS_X) for (const z of [BODY.z0, BODY.z1]) stones.push([x, z]);
  for (const z of BODY_POSTS_Z) for (const x of [BODY.x0, BODY.x1]) stones.push([x, z]);
  stones.push([8, 4], ...ENGAWA_POSTS);
  for (const [x, z] of stones) b.set(x, -1, z, 'polished_andesite');

  b.step();
  for (const x of BODY_POSTS_X) for (const z of [BODY.z0, BODY.z1]) b.set(x, 0, z, log(POST, 'y'));
  for (const z of BODY_POSTS_Z) for (const x of [BODY.x0, BODY.x1]) b.set(x, 0, z, log(POST, 'y'));
  b.set(8, 0, 4, log(POST, 'y'));
  for (let x = BODY.x0 + 1; x < BODY.x1; x++) {
    for (const z of [BODY.z0, BODY.z1]) if (!BODY_POSTS_X.includes(x)) b.set(x, 0, z, log(POST, 'x'));
  }
  for (let z = BODY.z0 + 1; z < BODY.z1; z++) {
    for (const x of [BODY.x0, BODY.x1]) if (!BODY_POSTS_Z.includes(z)) b.set(x, 0, z, log(POST, 'z'));
    if (z !== 4) b.set(8, 0, z, log(POST, 'z'));
  }
  for (let x = 9; x <= 11; x++) b.set(x, 0, 4, log(POST, 'x'));
}

// Tatami: Reihen aus geschältem Bambus, Richtung je Matte wechselnd (Windrad um die Feuerstelle).
function tatami(b, x1, z1, x2, z2, axis) {
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, log(TATAMI, axis));
}

function floors(b) {
  b.phase('Böden');
  b.step();
  for (let x = 3; x <= 5; x++) for (let z = 3; z <= 5; z++) b.set(x, 0, z, 'smooth_stone_slab[type=bottom]');
  b.set(4, 0, 4, 'campfire[facing=south,lit=true]');

  b.step();
  tatami(b, 1, 1, 5, 2, 'x');
  tatami(b, 6, 1, 7, 5, 'z');
  tatami(b, 3, 6, 7, 7, 'x');
  tatami(b, 1, 3, 2, 7, 'z');
  for (let x = 1; x <= 3; x++) b.set(x, 0, 1, 'dark_oak_planks');

  b.step();
  for (let z = 1; z <= 3; z++) {
    b.set(9, 0, z, log(TATAMI, 'z'));
    b.set(10, 0, z, log(TATAMI, 'x'));
    b.set(11, 0, z, log(TATAMI, 'z'));
  }
  for (let x = 9; x <= 11; x++) for (let z = 5; z <= 7; z++) b.set(x, 0, z, 'packed_mud');

  b.step();
  const isPost = (x, z) => ENGAWA_POSTS.some(([px, pz]) => px === x && pz === z);
  for (let x = BODY.x0; x <= ENGAWA.x1; x++) {
    for (let z = BODY.z0; z <= ENGAWA.z1; z++) {
      const onEngawa = z > BODY.z1 || x > BODY.x1;
      if (onEngawa && !isPost(x, z)) b.set(x, 0, z, 'spruce_slab[type=top]');
    }
  }
}

// --------------------------------------------------------------- Ständer, Balken, Wände

function frame(b) {
  b.phase('Ständer und Balken');
  b.step();
  for (const x of BODY_POSTS_X) for (const z of [BODY.z0, BODY.z1]) b.fill(x, 1, z, x, 4, z, log(POST, 'y'));
  for (const z of BODY_POSTS_Z) for (const x of [BODY.x0, BODY.x1]) b.fill(x, 1, z, x, 4, z, log(POST, 'y'));
  b.fill(8, 1, 4, 8, 4, 4, log(POST, 'y'));

  b.step();
  for (let x = BODY.x0 + 1; x < BODY.x1; x++) for (const z of [BODY.z0, BODY.z1]) b.set(x, WALL_TOP, z, log(POST, 'x'));
  for (let z = BODY.z0 + 1; z < BODY.z1; z++) for (const x of [BODY.x0, BODY.x1]) b.set(x, WALL_TOP, z, log(POST, 'z'));
  for (const x of [BODY.x0, BODY.x1]) for (const z of [BODY.z0, BODY.z1]) b.set(x, WALL_TOP, z, `${POST_WOOD}[axis=y]`);

  b.step();
  for (const x of [1, 4, 8, 11]) for (let z = BODY.z0 + 1; z < BODY.z1; z++) b.set(x, WALL_TOP, z, log(POST, 'z'));

  b.step();
  for (const [x, z] of ENGAWA_POSTS) b.fill(x, 0, z, x, 2, z, log(POST, 'y'));
  for (let x = BODY.x0; x < ENGAWA.x1; x++) b.set(x, 3, ENGAWA.z1, log(POST, 'x'));
  for (let z = BODY.z0; z < ENGAWA.z1; z++) b.set(ENGAWA.x1, 3, z, log(POST, 'z'));
  b.set(ENGAWA.x1, 3, ENGAWA.z1, `${POST_WOOD}[axis=y]`);
  b.set(BODY.x0, 3, BODY.z1 + 1, log(POST, 'z'));
  b.set(BODY.x1 + 1, 3, BODY.z0, log(POST, 'x'));
}

// Öffnungen in den Außenwänden: [x, z, yMin, yMax]
const SHOJI_SOUTH = [1, 2, 3, 5, 6, 7];
const SHOJI_EAST = [1, 2, 3];
const WINDOWS = [[6, 0], [10, 0], [0, 2], [0, 6], [12, 6]];
const DOOR = [10, 8];

function isOpening(x, y, z) {
  if (z === BODY.z1 && SHOJI_SOUTH.includes(x) && y <= 3) return true;
  if (x === BODY.x1 && SHOJI_EAST.includes(z) && y <= 3) return true;
  if (WINDOWS.some(([wx, wz]) => wx === x && wz === z) && (y === 2 || y === 3)) return true;
  if (x === DOOR[0] && z === DOOR[1] && y <= 2) return true;
  return false;
}

function forEachWallCell(fn) {
  for (let x = BODY.x0; x <= BODY.x1; x++) {
    for (let z = BODY.z0; z <= BODY.z1; z++) {
      const edge = x === BODY.x0 || x === BODY.x1 || z === BODY.z0 || z === BODY.z1;
      const post = (BODY_POSTS_X.includes(x) && (z === BODY.z0 || z === BODY.z1)) || (BODY_POSTS_Z.includes(z) && (x === BODY.x0 || x === BODY.x1));
      if (edge && !post) fn(x, z);
    }
  }
}

function walls(b) {
  b.phase('Wände');
  b.step();
  forEachWallCell((x, z) => { if (!isOpening(x, 1, z)) b.set(x, 1, z, BAND); });
  b.step();
  forEachWallCell((x, z) => {
    for (let y = 2; y <= 4; y++) if (!isOpening(x, y, z)) b.set(x, y, z, PANEL);
  });
}

// --------------------------------------------------------------- Dach

function roof(b) {
  b.phase('Dach');
  b.step();
  roofRing(b, 2);
  b.step();
  roofRing(b, 1);
  b.step();
  rafters(b);
  b.step();
  roofRing(b, 0);

  b.step();
  for (const x of [1, 11]) for (let z = BODY.z0 + 1; z < BODY.z1; z++) b.set(x, 6, z, log(POST, 'z'));
  b.step();
  for (const gx of [1, 11]) {
    for (const [x, y, z] of gableCells(gx)) {
      if (y === ROOF.y + ROOF.gable) b.set(x, y, z, log(POST, 'z'));
      else if (z === (ROOF.z0 + ROOF.z1) / 2) b.set(x, y, z, log(POST, 'y'));
      else b.set(x, y, z, PANEL);
    }
  }
  b.step();
  for (let k = ROOF.gable; k < RIDGE_K; k++) roofRing(b, k);
  b.step();
  roofRing(b, RIDGE_K);
  const ridgeZ = (ROOF.z0 + ROOF.z1) / 2;
  const ridgeX0 = ROOF.x0 + ROOF.gable;
  const ridgeX1 = ROOF.x1 - ROOF.gable;
  const capY = ROOF.y + RIDGE_K + 1;
  for (let x = ridgeX0 + 1; x < ridgeX1; x++) b.set(x, capY, ridgeZ, TILE.wall);
  b.stairs(ridgeX0, capY, ridgeZ, TILE.stairs, { facing: 'west' });
  b.stairs(ridgeX1, capY, ridgeZ, TILE.stairs, { facing: 'east' });

  b.step();
  const tips = [
    [ROOF.x0, ROOF.z0, 'west'], [ROOF.x1, ROOF.z0, 'north'], [ROOF.x1, ROOF.z1, 'east'], [ROOF.x0, ROOF.z1, 'south'],
  ];
  for (const [x, z, facing] of tips) b.set(x, ROOF.y + 1, z, `${TILE.stairs}[facing=${facing},half=bottom,shape=outer_right]`, { raw: true });
}

// Sparren unter Ring 1, quer zur Wand, jeder zweite; Ecken als Holzblock.
function rafters(b) {
  const y = ROOF.y;
  const xa = ROOF.x0 + 1;
  const xb = ROOF.x1 - 1;
  const za = ROOF.z0 + 1;
  const zb = ROOF.z1 - 1;
  for (let x = xa; x <= xb; x++) {
    for (const z of [za, zb]) {
      if (x === xa || x === xb) b.set(x, y, z, `${POST_WOOD}[axis=y]`);
      else if (x % 2 === 0) b.set(x, y, z, log(RAFTER, 'z'));
    }
  }
  for (let z = za + 1; z < zb; z++) {
    for (const x of [xa, xb]) if (z % 2 === 0) b.set(x, y, z, log(RAFTER, 'x'));
  }
}

// --------------------------------------------------------------- Türen und Fenster

// Offene Falltür liegt an der Seite gegenüber ihrem facing: für die Außenkante also facing nach innen.
function shutterFacing(x, z) {
  if (z === BODY.z0) return 'south';
  if (z === BODY.z1) return 'north';
  return x === BODY.x0 ? 'east' : 'west';
}

function openings(b) {
  b.phase('Schiebetüren, Fenster und Haustür');
  b.step();
  for (const x of SHOJI_SOUTH) for (let y = 1; y <= 3; y++) b.set(x, y, BODY.z1, 'birch_trapdoor[facing=north,half=bottom,open=true]');
  for (const z of SHOJI_EAST) for (let y = 1; y <= 3; y++) b.set(BODY.x1, y, z, 'birch_trapdoor[facing=west,half=bottom,open=true]');

  b.step();
  for (const [x, z] of WINDOWS) {
    const facing = shutterFacing(x, z);
    for (const y of [2, 3]) b.set(x, y, z, `bamboo_trapdoor[facing=${facing},half=bottom,open=true]`);
  }

  b.step();
  b.door(DOOR[0], 1, DOOR[1], 'bamboo_door', { facing: 'north', hinge: 'left' });
  b.set(DOOR[0], 3, DOOR[1] + 1, 'blue_wall_banner[facing=south]');
  b.set(DOOR[0], 0, ENGAWA.z1 + 1, 'smooth_stone_slab[type=bottom]');
  b.set(ENGAWA.x1 + 1, 0, DOCK_Z, 'smooth_stone_slab[type=bottom]');
}

// --------------------------------------------------------------- Innenwände und Einrichtung

function partitions(b) {
  b.phase('Innenwände');
  b.step();
  for (let z = 1; z <= 7; z++) {
    if (z === 4) continue;
    if (z !== 3 && z !== 6) for (let y = 1; y <= 3; y++) b.set(8, y, z, 'birch_trapdoor[facing=west,half=bottom,open=true]');
    b.set(8, 4, z, log(POST, 'z'));
  }
  b.step();
  for (let x = 9; x <= 11; x++) {
    for (let y = 1; y <= 3; y++) b.set(x, y, 4, 'birch_trapdoor[facing=north,half=bottom,open=true]');
    b.set(x, 4, 4, log(POST, 'x'));
  }
}

function interior(b) {
  b.phase('Einrichtung');
  b.step();
  b.set(2, 3, 1, 'white_wall_banner[facing=south]');
  b.set(1, 1, 1, 'potted_flowering_azalea_bush');
  b.set(3, 1, 1, 'decorated_pot[facing=south]');
  b.fill(4, 1, 1, 4, 3, 1, 'stripped_oak_log[axis=y]');
  b.fill(1, 4, 1, 3, 4, 1, 'stripped_oak_log[axis=x]');

  b.step();
  for (const [x, z] of [[4, 2], [4, 6], [2, 4], [6, 4]]) b.set(x, 1, z, 'red_carpet');
  b.set(4, 4, 4, 'iron_chain[axis=y]');
  b.set(4, 3, 4, 'iron_chain[axis=y]');
  b.set(4, 2, 4, 'cauldron');

  b.step();
  b.bed(9, 1, 2, 'white_bed', { facing: 'north' });
  b.bed(11, 1, 2, 'white_bed', { facing: 'north' });
  b.set(10, 1, 1, 'lantern[hanging=false]');
  b.set(11, 1, 3, 'chest[facing=west]');

  b.step();
  b.set(9, 1, 5, 'smoker[facing=south]');
  b.set(10, 1, 5, 'water_cauldron[level=3]');
  b.set(11, 1, 5, 'barrel[facing=up]');
  b.set(11, 2, 5, 'potted_bamboo');
  b.set(11, 1, 6, 'furnace[facing=west]');
  b.set(11, 1, 7, 'chest[facing=west]');
  b.set(9, 2, 5, 'lantern[hanging=false]');
}

function lights(b) {
  b.phase('Licht');
  b.step();
  hangingLantern(b, { x: 4, y: WALL_TOP - 1, z: 2, chain: 1 });
  hangingLantern(b, { x: 4, y: WALL_TOP - 1, z: 6, chain: 1 });
  // Bis y = 6 liegt die Box ganz unter dem Dach (darüber gehörten auch Felder auf der Dachfläche dazu).
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 11, y2: ROOF.y + ROOF.gable - 1, z2: 7 });
  b.step();
  for (const [x, z] of [[2, ENGAWA.z1], [6, ENGAWA.z1], [10, ENGAWA.z1], [ENGAWA.x1, 2], [ENGAWA.x1, 6]]) b.set(x, 2, z, 'lantern[hanging=true]');
}

// --------------------------------------------------------------- Garten

// Steinlaterne (Tōrō): Sockel, Mauerschaft, Laterne, kleines Pyramidendach.
function stoneLantern(b, x, z) {
  b.set(x, 0, z, 'chiseled_stone_bricks');
  b.set(x, 1, z, 'stone_brick_wall');
  b.set(x, 2, z, 'lantern[hanging=false]');
  b.set(x, 3, z, 'stone_bricks');
  const ring = [['north', 0, 1], ['south', 0, -1], ['west', 1, 0], ['east', -1, 0]];
  for (const [facing, dx, dz] of ring) b.stairs(x + dx, 3, z + dz, 'stone_brick_stairs', { facing });
  for (const [dx, dz, facing] of [[-1, -1, 'south'], [1, -1, 'west'], [1, 1, 'north'], [-1, 1, 'east']]) b.stairs(x + dx, 3, z + dz, 'stone_brick_stairs', { facing });
  b.slab(x, 4, z, 'stone_brick_slab');
}

// Kies braucht festen Boden: eine Erdschicht darunter (die Wiese ist nur eine Grasschicht).
function gravelAt(b, x, z) {
  b.set(x, -2, z, 'dirt');
  b.set(x, -1, z, 'gravel');
}

// Fester Zufallswert 0 … 1 je Feld (unabhängig von der Aufruf-Reihenfolge).
function cellNoise(x, z, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Bambushain: dichte, unregelmäßige Halme, zum Rand hin lichter.
function bambooGrove(b, x1, z1, x2, z2) {
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const rx = (x2 - x1) / 2 + 0.5;
  const rz = (z2 - z1) / 2 + 0.5;
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const edge = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2;
      if (edge > 1 || cellNoise(x, z, 1) > 0.6 - edge * 0.35) continue;
      const height = 6 + Math.floor(cellNoise(x, z, 2) * 6 * (1.2 - edge * 0.5));
      for (let y = 0; y < height; y++) {
        let leaves = 'none';
        if (y >= height - 2) leaves = 'large';
        else if (y === height - 3) leaves = 'small';
        b.set(x, y, z, `bamboo[age=1,leaves=${leaves},stage=0]`);
      }
    }
  }
}

function dock(b, z1, z2, length) {
  // Steg ab dem Westufer des Teichs: obere Fichtenstufen auf Höhe des Geländes, im Wasser gewässert.
  let start = null;
  for (let x = 16; x <= 30 && start === null; x++) if (b.get(x, -1, z1).startsWith('water')) start = x - 1;
  if (start === null) throw new Error('Steg: kein Wasser im Teich gefunden.');
  const end = start + length - 1;
  for (let x = start; x <= end; x++) {
    for (let z = z1; z <= z2; z++) {
      const wet = b.get(x, -1, z).startsWith('water');
      b.set(x, -1, z, `spruce_slab[type=top,waterlogged=${wet}]`);
      for (let y = 0; y <= 2; y++) if (isPlantId(b.get(x, y, z).split('[')[0])) b.remove(x, y, z);
    }
  }
  for (const z of [z1, z2]) {
    b.set(end, 0, z, 'spruce_fence');
  }
  b.set(end, 1, z1, 'lantern[hanging=false]');
  return { start, end };
}

function garden(b) {
  b.phase('Garten');
  b.step();
  b.fill(POND.x, -4, POND.z, POND.x + POND.width - 1, -2, POND.z + POND.depth - 1, 'dirt');
  pond(b, { x: POND.x, y: -1, z: POND.z, width: POND.width, depth: POND.depth, facing: 'west', shore: 'kies', waterDepth: 2, seed: 4 });
  b.step();
  const steg = dock(b, DOCK_Z, DOCK_Z + 1, 6);

  b.step();
  for (let x = ROOF.x0 - 1; x <= ROOF.x1 + 1; x++) for (const z of [ROOF.z0 - 1, ROOF.z1 + 1]) gravelAt(b, x, z);
  for (let z = ROOF.z0; z <= ROOF.z1; z++) for (const x of [ROOF.x0 - 1, ROOF.x1 + 1]) gravelAt(b, x, z);

  b.step();
  const front = [[10, 12], [9, 13], [10, 14], [11, 15], [10, 16], [9, 17], [10, 18]];
  front.forEach(([x, z], i) => b.set(x, -1, z, i % 2 === 0 ? 'smooth_stone' : 'polished_andesite'));
  for (let x = ENGAWA.x1 + 2; x < steg.start; x++) b.set(x, -1, DOCK_Z + (x % 2), x % 2 === 0 ? 'smooth_stone' : 'polished_andesite');

  b.step();
  for (let x = 0; x <= 7; x++) for (let z = 13; z <= 18; z++) gravelAt(b, x, z);
  rock(b, { x: 2, y: 0, z: 15, size: 'mittel', material: 'andesit', rubble: false, seed: 3 });
  rock(b, { x: 6, y: 0, z: 17, size: 'klein', material: 'andesit', rubble: false, seed: 8 });

  b.step();
  for (const [x, z] of LANTERNS) stoneLantern(b, x, z);

  b.step();
  tree(b, { x: 27, y: 0, z: -3, species: 'kirsche', size: 'gross', seed: 2 });
  b.step();
  bambooGrove(b, GROUND.x0 + 1, GROUND.z0 + 1, 4, -4);
  b.step();
  bush(b, { x: -5, y: 0, z: 11, size: 'klein', leaves: 'azalee', seed: 2 });
  bush(b, { x: 16, y: 0, z: -3, size: 'klein', leaves: 'azalee', seed: 5 });
  bush(b, { x: 31, y: 0, z: 16, size: 'mittel', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: GROUND.x0, y: 0, z: GROUND.z0, width: GROUND.x1 - GROUND.x0 + 1, depth: GROUND.z1 - GROUND.z0 + 1, mix: 'wiese', density: 0.15, shape: 'eckig', seed: 11 });
}

export default function build(b) {
  site(b);
  foundation(b);
  floors(b);
  frame(b);
  walls(b);
  roof(b);
  openings(b);
  partitions(b);
  interior(b);
  lights(b);
  garden(b);
}
