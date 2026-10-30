// Großer Handelshafen mit Galeone (eigenes Design).
// Koordinaten: x → Osten, z → Süden, kleinste Ecke (0, 0, 0). Land im Norden (z 0 … 25) mit Speichern, Straße und Kai,
// Kaimauer-Kante z = 25, Hafenbecken ab z = 26. y = 0 Meeresgrund, Wasser y 1 … 6, Kai und Land Oberkante y = 8
// (du läufst auf y = 9). Die Galeone liegt längs x mit dem Heck im Westen und der Backbordseite am Kai.
// Westlich liegen Holzstege mit kleinen Booten, im Osten schützt eine Mole mit Leuchtturm das Becken.
import { doorway, window, lampPost, hangingLantern, wallLantern, storage, lightRoom, findDarkSpots, tree, bush, rock,
  vegetation, floorPattern, chimney, timberWall, dormer, bookWall, bedroom, diningTable, fireplace } from '../lib/index.js';

export const meta = {
  id: 'handelshafen-galeone',
  title: 'Handelshafen mit Galeone',
  category: 'infrastruktur',
  subtitle: 'Galeone und Kogge, Speicher mit Treppengiebeln, Tretradkran, Leuchtturm und Holzstege mit Booten',
  tags: ['Hafen', 'Schiff', 'Galeone', 'Kogge', 'Segelschiff', 'Leuchtturm', 'Kran', 'Speicher', 'Mole', 'Meer', 'Boote', 'Riesig'],
  aliases: [
    'handelshafen', 'grosser hafen', 'großer hafen', 'hafen', 'hafenstadt', 'galeone', 'galleone', 'segelschiff', 'schiff',
    'piratenschiff', 'dreimaster', 'großsegler', 'kriegsschiff', 'kogge', 'hansekogge', 'tretradkran', 'tretkran', 'hafenkran',
    'speicher', 'speicherstadt', 'lagerhaus', 'leuchtturm', 'molenfeuer', 'wellenbrecher', 'mole', 'kaimauer', 'kai', 'steg',
    'holzsteg', 'ruderboot', 'fischerboot', 'hafenmeisterei', 'schänke',
    'galleon', 'harbor', 'harbour', 'port', 'ship', 'sailing ship', 'pirate ship', 'cog', 'lighthouse', 'galeon', 'galion',
  ],
  accuracy: 'eigenes',
  description: 'Ein großer Handelshafen: Vor der Kaimauer liegt eine dreimastige Galeone mit hohem Heckkastell, Kanonenpforten '
    + 'auf zwei Decks, Segeln aus Wolle und Takelage; über eine Gangway kommst du an Bord, in Kajüten, Batteriedeck und Laderaum. '
    + 'Am Kai stehen vier Speicher mit Treppengiebeln und Windenbalken, ein Tretradkran mit zwei Laufrädern, die Hafenmeisterei mit '
    + 'Glockenturm, eine Schänke und eine Fischhalle. Ein Wellenbrecher mit Molenfeuer und eine Mole mit Leuchtturm umschließen das '
    + 'Becken; an der Einfahrt ankert eine Kogge, an den Holzstegen liegen Ruder- und Fischerboote.',
  sources: [],
  credits: null,
};

// ---------------------------------------------------------------- Maße

const SIZE_X = 128; // x 0 … 127
const SIZE_Z = 84; // z 0 … 83
const SEABED = 0;
const WATER_TOP = 6;
const GROUND = 8; // Oberkante Land und Kai
const WALK = GROUND + 1;
const QUAY_Z = 25; // äußerste Reihe der Kaimauer
const STREET = { z1: 14, z2: 19 };

// Galeone: u = Länge (0 = Heckspiegel unten, 53 = Bugspitze), v = quer (negativ = Backbord = Norden), y = Welt-y.
const SHIP = { x0: 36, cz: 37, len: 54 };
const DECK = { keel: 1, hold: 3, gun: 6, main: 10, quarter: 13, poop: 16, fore: 13 };
const BREAK = { poop: 10, quarter: 22, fore: 41 }; // letzte Zelle von Poop/Achterdeck, erste Zelle der Back
const MAST = { mizzen: 14, main: 30, fore: 46 };

// Halbe Breite mittschiffs je Höhe (Kiel schmal, Bauch breit, oben leicht eingezogen).
const MID_HALF = [0, 0.5, 2.6, 4.3, 5.5, 6.3, 6.8, 7, 7, 7, 6.9, 6.75, 6.6, 6.45, 6.3, 6.15, 6.0, 5.85, 5.7];

// ---------------------------------------------------------------- Palette

const P = {
  stone: 'stone_bricks',
  stoneMossy: 'mossy_stone_bricks',
  stoneCracked: 'cracked_stone_bricks',
  cap: 'polished_andesite',
  paving: [['stone_bricks', 5], ['andesite', 2], ['polished_andesite', 2], ['cracked_stone_bricks', 1], ['tuff_bricks', 1]],
  street: [['cobblestone', 4], ['andesite', 3], ['stone', 2], ['mossy_cobblestone', 1], ['gravel', 1]],
  seabed: [['sand', 7], ['gravel', 3], ['clay', 1]],
  // Schiff
  hull: 'dark_oak_planks',
  hullLow: 'dark_oak_planks',
  band: 'spruce_planks',
  wale: 'stripped_dark_oak_log',
  rail: 'dark_oak_slab',
  red: 'mangrove_planks',
  gold: 'bamboo_planks',
  deck: 'spruce_planks',
  deckSeam: 'stripped_spruce_log',
  innerDeck: 'spruce_planks',
  ballast: 'gravel',
  mast: 'spruce_log',
  mastCore: 'stripped_spruce_log',
  yard: 'stripped_spruce_log',
  rope: 'spruce_fence',
  sail: 'white_wool',
  sailShade: 'light_gray_wool',
  sailSeam: 'white_concrete',
  sailCross: 'red_wool',
};

// ---------------------------------------------------------------- Helfer

// Ganzzahliger Hash für Musterwechsel (unabhängig von der Reihenfolge).
function hash3(x, y, z, salt = 0) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791) ^ (salt * 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pickAt(list, x, y, z, salt = 0) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = hash3(x, y, z, salt) * total;
  for (const [id, w] of list) {
    r -= w;
    if (r < 0) return id;
  }
  return list[0][0];
}

function setIfAir(b, x, y, z, state) {
  if (b.get(x, y, z) === 'air') b.set(x, y, z, state);
}

const isWater = (state) => state.startsWith('water');

// Linie mit exakter Rundung (ein Punkt je Schritt der längsten Achse); setzt nur in Luft, wenn keep.
function linePoints(x1, y1, z1, x2, y2, z2) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), Math.abs(z2 - z1));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = (a, c) => (n === 0 ? a : Math.round((a * (n - i) + c * i) / n));
    pts.push([f(x1, x2), f(y1, y2), f(z1, z2)]);
  }
  return pts;
}

// Seil aus Zäunen: wechselt die Höhe und die Lage zugleich, kommt ein Zwischenglied auf die alte Höhe,
// damit die Zäune seitlich verbunden sind und das Seil durchgehend wirkt.
function rope(b, a, c, state = P.rope) {
  let prev = null;
  for (const [x, y, z] of linePoints(...a, ...c)) {
    if (prev && prev[1] !== y && (prev[0] !== x || prev[2] !== z)) setIfAir(b, x, prev[1], z, state);
    setIfAir(b, x, y, z, state);
    prev = [x, y, z];
  }
}

// ---------------------------------------------------------------- Rumpfform der Galeone

function hullTop(u) {
  if (u <= BREAK.poop) return 17;
  if (u <= BREAK.quarter) return 14;
  if (u < BREAK.fore) return 12;
  return 14;
}

// Heckspiegel: oben weiter ausladend (u = −1), am Wasser u = 1, darunter läuft der Rumpf zum Achtersteven aus.
function sternStart(y) {
  if (y >= 13) return -1;
  if (y >= 10) return 0;
  return 1;
}

// Halbe Breite an (u, y) oder −1 außerhalb.
function hullHalf(u, y) {
  if (y < DECK.keel || y > 18 || y > hullTop(Math.max(u, 0))) return -1;
  const mid = MID_HALF[y];
  // Bug: der Vorsteven springt unten zurück, unter Wasser ist der Bug schlanker.
  const rake = y <= 11 ? ((11 - y) ** 2) / 12.5 : 0;
  const tip = SHIP.len - 1 - rake;
  if (u > tip + 0.5) return -1;
  const bowLen = 15 + Math.max(0, 7 - y);
  const t = Math.min(1, Math.max(0, (tip - u) / bowLen));
  let f = Math.sqrt(1 - (1 - t) ** 2);
  // Heck
  if (y >= 7) {
    const s = sternStart(y);
    if (u < s) return -1;
    f = Math.min(f, 0.8 + 0.2 * Math.min(1, (u - s) / 9));
  } else {
    const us = 1 + (7 - y) * 1.2;
    if (u < us - 0.5) return -1;
    f = Math.min(f, Math.sqrt(Math.max(0, Math.min(1, (u - us) / 12))));
  }
  return mid * f;
}

function inHull(u, v, y) {
  const h = hullHalf(u, y);
  return h >= 0 && Math.abs(v) <= h + 0.3;
}

function isShell(u, v, y) {
  if (!inHull(u, v, y)) return false;
  return !inHull(u + 1, v, y) || !inHull(u - 1, v, y) || !inHull(u, v + 1, y) || !inHull(u, v - 1, y) || !inHull(u, v, y - 1);
}

function deckLevels(u) {
  const levels = [DECK.hold, DECK.gun, DECK.main];
  if (u <= BREAK.quarter) levels.push(DECK.quarter);
  if (u <= BREAK.poop) levels.push(DECK.poop);
  if (u >= BREAK.fore) levels.push(DECK.fore);
  return levels;
}

const SX = (u) => SHIP.x0 + u;
const SZ = (v) => SHIP.cz + v;
const sset = (b, u, y, v, state) => b.set(SX(u), y, SZ(v), state);
const sget = (b, u, y, v) => b.get(SX(u), y, SZ(v));

// Welt-Zelle liegt im Rumpf (auch Innenraum) – dort kommt kein Wasser hin.
function inShipWorld(x, y, z) {
  return inHull(x - SHIP.x0, z - SHIP.cz, y) || inCog(z - COG.oz, COG.ox - x, y);
}

// Halbe Breite als ganze Zahl: äußerstes v, das noch zum Rumpf gehört.
function sideV(u, y) {
  const h = hullHalf(u, y);
  return h < 0 ? -1 : Math.floor(h + 0.3);
}

// ---------------------------------------------------------------- Gelände, Kai, Meeresgrund

function buildLand(b) {
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 0; z <= QUAY_Z; z++) {
      b.fill(x, 0, z, x, 4, z, 'stone');
      b.fill(x, 5, z, x, GROUND - 1, z, 'dirt');
      b.set(x, GROUND, z, 'grass_block');
    }
  }
}

function quayStone(x, y, z) {
  const moss = y <= WATER_TOP ? 0.35 : 0.08;
  const r = hash3(x, y, z, 11);
  if (r < moss) return P.stoneMossy;
  if (r < moss + 0.07) return P.stoneCracked;
  return P.stone;
}

function buildQuayWall(b) {
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = 21; z <= QUAY_Z; z++) {
      for (let y = 0; y <= GROUND; y++) b.set(x, y, z, quayStone(x, y, z));
    }
    // Wandpfeiler alle 8 Blöcke, Sockel unter Wasser eine Reihe breiter.
    if (x % 8 === 3) for (let y = 0; y <= GROUND - 1; y++) b.set(x, y, QUAY_Z + 1, y === GROUND - 1 ? 'stone_brick_slab[type=top]' : quayStone(x, y, QUAY_Z + 1));
    b.set(x, 0, QUAY_Z + 1, quayStone(x, 0, QUAY_Z + 1));
  }
  // Kante aus poliertem Andesit, dahinter Pflaster.
  for (let x = 0; x < SIZE_X; x++) b.set(x, GROUND, QUAY_Z, P.cap);
}

function buildSeabed(b) {
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = QUAY_Z + 1; z < SIZE_Z; z++) {
      if (b.get(x, SEABED, z) !== 'air') continue;
      b.set(x, SEABED, z, pickAt(P.seabed, x, 0, z, 3));
    }
  }
}

// Wasser in alle freien Zellen des Beckens, aber nicht in den Schiffsrumpf.
function buildWater(b) {
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = QUAY_Z + 1; z < SIZE_Z; z++) {
      for (let y = SEABED + 1; y <= WATER_TOP; y++) {
        if (inShipWorld(x, y, z)) continue;
        if (b.get(x, y, z) === 'air') b.set(x, y, z, 'water[level=0]');
      }
    }
  }
}

// ---------------------------------------------------------------- Galeone: Rumpf

function hullMaterial(u, v, y) {
  const top = hullTop(Math.max(u, 0));
  if (y === top) return `${P.wale}[axis=x]`;
  if (y <= 5) return P.hullLow;
  if (y === 7 || y === DECK.main) return `${P.wale}[axis=x]`;
  if (y === 8 || y === 9) return P.band;
  if (y >= 11 && y < top) {
    if (u <= BREAK.quarter || u >= BREAK.fore) return y === 13 ? P.gold : P.red;
    return P.red;
  }
  return P.hull;
}

function buildHull(b) {
  for (let u = -2; u <= SHIP.len; u++) {
    for (let v = -8; v <= 8; v++) {
      for (let y = DECK.keel; y <= 18; y++) {
        if (!inHull(u, v, y)) continue;
        if (isShell(u, v, y)) {
          sset(b, u, y, v, hullMaterial(u, v, y));
        } else if (y < DECK.hold) {
          sset(b, u, y, v, P.ballast);
        } else if (deckLevels(u).includes(y)) {
          const weather = y === DECK.main && u > BREAK.quarter && u < BREAK.fore;
          const top = y === DECK.quarter || y === DECK.poop || weather;
          sset(b, u, y, v, top && Math.abs(v) % 3 === 0 ? `${P.deckSeam}[axis=x]` : top ? P.deck : P.innerDeck);
        }
      }
    }
  }
  // Kiel und Achtersteven als durchgehender Balken.
  for (let u = 3; u <= SHIP.len - 9; u++) sset(b, u, DECK.keel, 0, `${P.wale}[axis=x]`);
}

// ---------------------------------------------------------------- Galeone: Querwände, Treppen, Luken

const SIDE = { port: -1, starboard: 1 };
const outward = (side) => (side > 0 ? 'south' : 'north');

// Querwand bei u über die Innenbreite (y1 … y2), Ständer an den Enden, Türen (2 hoch ab y1) und Fenster.
function bulkhead(b, u, y1, y2, { doors = [], windows = [], inside }) {
  for (let y = y1; y <= y2; y++) {
    const s = sideV(u, y);
    for (let v = -s + 1; v <= s - 1; v++) {
      const post = Math.abs(v) === s - 1 || doors.some((d) => Math.abs(v - d) === 1);
      sset(b, u, y, v, post ? `${P.wale}[axis=y]` : P.hull);
    }
  }
  for (const v of windows) sset(b, u, y1 + 1, v, 'glass_pane');
  for (const v of doors) b.door(SX(u), y1, SZ(v), 'dark_oak_door', { facing: inside, hinge: v < 0 ? 'left' : 'right' });
}

// Geländer an der Vorderkante eines Decks (Zellen bei u auf Höhe y), Lücken für die Treppen.
function breakRail(b, u, y, gaps) {
  const s = sideV(u, y);
  for (let v = -s + 1; v <= s - 1; v++) sset(b, u, y, v, gaps.includes(v) ? 'air' : 'dark_oak_fence');
}

// Treppe aus Einzelstufen: cells = [[u, y, v], …], facing = Laufrichtung nach oben.
function stairFlight(b, cells, facing) {
  for (const [u, y, v] of cells) b.stairs(SX(u), y, SZ(v), 'spruce_stairs', { facing });
}

function buildBreaks(b) {
  // Achterdeck-Schott (u 22) mit Tür in die Offiziersmesse, Back-Schott (u 41) mit zwei Türen.
  bulkhead(b, BREAK.quarter, DECK.main + 1, DECK.main + 2, { doors: [0], windows: [-3, 3], inside: 'west' });
  bulkhead(b, BREAK.fore, DECK.main + 1, DECK.main + 2, { doors: [-2, 2], windows: [0], inside: 'east' });
  // Poop-Schott (u 10, y 14 … 15): die obere Reihe ist schon Rumpf, unten fehlt die Wand.
  for (let y = DECK.quarter + 1; y <= DECK.quarter + 2; y++) {
    const s = sideV(BREAK.poop, y);
    for (let v = -s + 1; v <= s - 1; v++) {
      const post = Math.abs(v) === s - 1 || Math.abs(v) === 1;
      sset(b, BREAK.poop, y, v, post ? `${P.wale}[axis=y]` : P.red);
    }
  }
  for (const v of [-3, 3]) sset(b, BREAK.poop, DECK.quarter + 2, v, 'glass_pane');
  b.door(SX(BREAK.poop), DECK.quarter + 1, SZ(0), 'dark_oak_door', { facing: 'west', hinge: 'left' });

  // Geländer an den Deckkanten.
  breakRail(b, BREAK.quarter, DECK.quarter + 1, [-4, 4]);
  breakRail(b, BREAK.fore, DECK.fore + 1, [-4, 4]);
  breakRail(b, BREAK.poop, DECK.poop + 1, [-3, 3]);

  // Treppen: Hauptdeck → Achterdeck, Hauptdeck → Back, Achterdeck → Poop.
  for (const v of [-4, 4]) {
    stairFlight(b, [[BREAK.quarter + 2, DECK.main + 1, v], [BREAK.quarter + 1, DECK.main + 2, v]], 'west');
    stairFlight(b, [[BREAK.fore - 2, DECK.main + 1, v], [BREAK.fore - 1, DECK.main + 2, v]], 'east');
  }
  for (const v of [-3, 3]) stairFlight(b, [[BREAK.poop + 2, DECK.quarter + 1, v], [BREAK.poop + 1, DECK.quarter + 2, v]], 'west');
}

// Geländer auf den Schanzkleidern der Kastelle (eine Zaunreihe auf der obersten Rumpfreihe).
function buildCastleRails(b) {
  for (let u = -1; u <= SHIP.len; u++) {
    const top = hullTop(Math.max(u, 0));
    if (top === 12) continue;
    for (let v = -8; v <= 8; v++) {
      if (!isShell(u, v, top) || inHull(u, v, top + 1)) continue;
      const edge = !inHull(u, v + 1, top) || !inHull(u, v - 1, top) || !inHull(u - 1, v, top) || !inHull(u + 1, v, top);
      if (edge && sget(b, u, top + 1, v) === 'air') sset(b, u, top + 1, v, 'dark_oak_fence');
    }
  }
}

function buildHatches(b) {
  const y = DECK.main;
  // Große Ladeluke mittschiffs: Gitter aus Falltüren, Süll aus Stufen.
  for (let u = 25; u <= 29; u++) {
    for (let v = -2; v <= 2; v++) {
      if (u === 25 || u === 29 || Math.abs(v) === 2) sset(b, u, y + 1, v, 'dark_oak_slab[type=bottom]');
      else sset(b, u, y, v, 'spruce_trapdoor[facing=north,half=top]');
    }
  }
  // Niedergang Hauptdeck → Batteriedeck (v = 2, nach Westen hinauf).
  stairFlight(b, [[36, DECK.gun + 1, 2], [35, DECK.gun + 2, 2], [34, DECK.gun + 3, 2]], 'west');
  for (let u = 34; u <= 36; u++) sset(b, u, y, 2, 'air');
  for (let u = 34; u <= 37; u++) for (const v of [1, 3]) sset(b, u, y + 1, v, 'spruce_fence');
  sset(b, 37, y + 1, 2, 'spruce_fence');
  // Niedergang Batteriedeck → Laderaum (v = −2).
  stairFlight(b, [[37, DECK.hold + 1, -2], [36, DECK.hold + 2, -2]], 'west');
  for (let u = 36; u <= 37; u++) sset(b, u, DECK.gun, -2, 'air');
}

// ---------------------------------------------------------------- Galeone: Pforten, Kanonen, Fenster

function gunPort(b, u, y, side, { carriage = true, lid = false } = {}) {
  const s = sideV(u, y);
  const v = side * s;
  if (!isShell(u, v, y) || isShell(u, v - side, y)) return;
  sset(b, u, y, v, `lightning_rod[facing=${outward(side)}]`);
  sset(b, u, y, v - side, 'polished_basalt[axis=z]');
  if (carriage) sset(b, u, y - 1, v - side, 'spruce_slab[type=top]');
  if (lid) sset(b, u, y + 1, v + side, `dark_oak_trapdoor[facing=${outward(side)},half=top,open=true]`);
}

function buildGunPorts(b) {
  for (const side of [SIDE.port, SIDE.starboard]) {
    for (let u = 8; u <= 44; u += 4) gunPort(b, u, DECK.gun + 2, side, { lid: true });
    for (const u of [24, 34, 38]) gunPort(b, u, DECK.main + 1, side, { carriage: false });
    if (side === SIDE.starboard) gunPort(b, 27, DECK.main + 1, side, { carriage: false });
    // Fenster der Messe unter dem Achterdeck und der Back.
    for (const u of [13, 16, 19]) sset(b, u, DECK.main + 2, side * sideV(u, DECK.main + 2), 'glass_pane');
    for (const u of [44, 48]) sset(b, u, DECK.main + 2, side * sideV(u, DECK.main + 2), 'glass_pane');
  }
}

function buildStern(b) {
  // Fenster: große Kajüte (u 0, y 11 … 12) und Kapitänskajüte (u −1, y 14 … 15) mit Tür zur Heckgalerie.
  for (const v of [-4, -2, 0, 2, 4]) for (const y of [11, 12]) sset(b, 0, y, v, 'glass_pane');
  for (const v of [-4, -3, -1, 1, 3, 4]) for (const y of [14, 15]) sset(b, -1, y, v, 'glass_pane');
  for (const v of [-5, -2, 2, 5]) for (const y of [14, 15]) if (inHull(-1, v, y)) sset(b, -1, y, v, `${P.wale}[axis=y]`);
  b.door(SX(-1), 14, SZ(0), 'dark_oak_door', { facing: 'east', hinge: 'left' });
  // Heckgalerie: Boden bei u −2 auf y 13, Geländer, Konsolen, Dach.
  const s = sideV(-1, 14);
  for (let v = -s; v <= s; v++) {
    sset(b, -2, 13, v, 'dark_oak_slab[type=top]');
    b.stairs(SX(-2), 12, SZ(v), 'dark_oak_stairs', { facing: 'east', half: 'top' });
    sset(b, -2, 14, v, 'dark_oak_fence');
    sset(b, -2, 16, v, 'dark_oak_slab[type=bottom]');
  }
  for (const v of [-s, s]) sset(b, -2, 15, v, 'dark_oak_fence');
  for (const v of [-s, 0, s]) sset(b, -2, 15, v, 'dark_oak_fence');
  // Hecklaternen auf dem Poopdeck.
  for (const v of [-4, 0, 4]) {
    const h = v === 0 ? 3 : 2;
    for (let i = 1; i <= h; i++) sset(b, 0, 17 + i, v, 'dark_oak_fence');
    sset(b, 0, 18 + h, v, 'lantern[hanging=false]');
  }
  // Ruder am Achtersteven.
  for (let y = 2; y <= 12; y++) {
    let u = -2;
    while (u < 20 && !inHull(u, 0, y)) u++;
    if (u >= 20) continue;
    sset(b, u - 1, y, 0, y >= 10 ? `${P.wale}[axis=y]` : P.hull);
  }
}

function buildQuarterGalleries(b) {
  // Seitengalerien am Heck: kleine Erker mit Fenstern, unten Konsolen, oben ein Dach aus Treppen.
  for (const side of [SIDE.port, SIDE.starboard]) {
    for (let u = 2; u <= 6; u++) {
      for (let y = 11; y <= 15; y++) {
        const v = side * (sideV(u, y) + 1);
        const glass = (y === 12 || y === 14) && u >= 3 && u <= 5;
        sset(b, u, y, v, glass ? 'glass_pane' : y === 13 ? P.gold : u === 2 || u === 6 ? `${P.wale}[axis=y]` : P.red);
      }
      b.stairs(SX(u), 10, SZ(side * (sideV(u, 11) + 1)), 'dark_oak_stairs', { facing: outward(-side), half: 'top' });
      b.stairs(SX(u), 16, SZ(side * (sideV(u, 15) + 1)), 'dark_oak_stairs', { facing: outward(-side) });
    }
  }
}

function buildBow(b) {
  // Galion vor dem Bug: Plattform auf Hauptdeckhöhe, Galionsknie darunter, Galionsfigur vorne.
  const beak = [[54, 1], [55, 1], [56, 0], [57, 0]];
  for (const [u, w] of beak) {
    for (let v = -w; v <= w; v++) sset(b, u, DECK.main, v, 'dark_oak_slab[type=top]');
    for (const v of w ? [-w, w] : []) sset(b, u, DECK.main + 1, v, 'dark_oak_fence');
  }
  for (const [u, y1] of [[54, 3], [55, 6], [56, 8], [57, 9]]) for (let y = y1; y <= DECK.main - 1; y++) sset(b, u, y, 0, P.hull);
  sset(b, 58, DECK.main, 0, P.red);
  sset(b, 58, DECK.main + 1, 0, 'gold_block');
  sset(b, 59, DECK.main + 1, 0, 'gold_block');
  b.stairs(SX(59), DECK.main, SZ(0), 'dark_oak_stairs', { facing: 'west', half: 'top' });
  // Kranbalken mit Anker an beiden Seiten.
  for (const side of [SIDE.port, SIDE.starboard]) {
    const v = side * (sideV(50, 13) + 1);
    sset(b, 50, 13, v, `${P.mast}[axis=z]`);
    for (let y = 9; y <= 12; y++) sset(b, 50, y, v, 'iron_chain[axis=y]');
    sset(b, 50, 8, v, 'anvil[facing=east]');
  }
}

// ---------------------------------------------------------------- Galeone: Innenräume und Deck

const isInterior = (u, v, y) => inHull(u, v, y) && !isShell(u, v, y);

function buildHold(b) {
  const y = DECK.hold + 1;
  const goods = [['barrel[facing=up]', 5], ['hay_block[axis=x]', 2], ['white_wool', 2], ['brown_wool', 2], ['composter', 2], ['chest[facing=north]', 1]];
  for (let u = 4; u <= 50; u++) {
    for (let v = -6; v <= 6; v++) {
      if (Math.abs(v) < 3 || !isInterior(u, v, y) || sget(b, u, y, v) !== 'air') continue;
      const h = hash3(u, y, v, 61) < 0.55 ? 2 : 1;
      for (let k = 0; k < h; k++) {
        if (!isInterior(u, v, y + k)) continue;
        let state = pickAt(goods, u, y + k, v, 62);
        if (state.startsWith('chest')) state = `chest[facing=${v > 0 ? 'north' : 'south'}]`;
        sset(b, u, y + k, v, state);
      }
    }
  }
  for (let u = 8; u <= 44; u += 6) sset(b, u, y + 1, 2, 'lantern[hanging=true]');
  for (const u of [11, 23]) sset(b, u, y + 1, -2, 'lantern[hanging=true]');
}

function buildGunDeck(b) {
  const y = DECK.gun + 1;
  for (const u of [10, 18, 22, 26, 38, 42]) sset(b, u, y + 2, 0, 'lantern[hanging=true]');
  // Pulverfässer und Kugelkisten mittschiffs
  for (const [u, v, state] of [[20, 0, 'barrel[facing=up]'], [21, 0, 'barrel[facing=up]'], [20, 1, 'barrel[facing=up]'],
    [24, -1, 'chest[facing=east]'], [40, 1, 'barrel[facing=up]'], [41, 1, 'composter'], [12, 1, 'barrel[facing=up]']]) sset(b, u, y, v, state);
  sset(b, 20, y + 1, 0, 'barrel[facing=up]');
}

function buildCabins(b) {
  const y = DECK.main + 1;
  // Große Kajüte am Heck (u 1 … 9) mit Trennwand zur Offiziersmesse.
  for (let yy = y; yy <= y + 1; yy++) {
    const s = sideV(10, yy);
    for (let v = -s + 1; v <= s - 1; v++) sset(b, 10, yy, v, Math.abs(v) === 1 ? `${P.wale}[axis=y]` : P.hull);
  }
  b.door(SX(10), y, SZ(0), 'dark_oak_door', { facing: 'west', hinge: 'left' });
  diningTable(b, { x: SX(4), y, z: SZ(-1), facing: 'south', length: 3, width: 2, wood: 'schwarzeiche', cloth: 'rot', headChairs: true });
  for (const v of [-4, 4]) {
    sset(b, 2, y, v, 'bookshelf');
    sset(b, 2, y + 1, v, 'bookshelf');
    sset(b, 9, y, v, 'chest[facing=west]');
    sset(b, 9, y + 1, v, 'lantern[hanging=false]');
    sset(b, 1, y, v, 'lantern[hanging=false]');
  }
  // Offiziersmesse (u 11 … 21): Kojen, Truhen, Kolderstock.
  for (const side of [-1, 1]) {
    const v = side * (sideV(12, y) - 1);
    b.bed(SX(12), y, SZ(v), 'red_bed', { facing: 'east' });
    b.bed(SX(17), y, SZ(v), 'red_bed', { facing: 'east' });
    sset(b, 11, y, v, 'chest[facing=east]');
    sset(b, 11, y + 1, v, 'lantern[hanging=false]');
    sset(b, 19, y, v, 'barrel[facing=up]');
    sset(b, 19, y + 1, v, 'lantern[hanging=false]');
  }
  diningTable(b, { x: SX(16), y, z: SZ(-2), facing: 'south', length: 3, width: 1, wood: 'fichte', cloth: 'weiss', headChairs: true });
  sset(b, 20, y, 2, 'lever[face=floor,facing=east]');
  // Kapitänskajüte unter dem Poopdeck (u 0 … 9, y 14 … 15).
  const yc = DECK.quarter + 1;
  b.bed(SX(2), yc, SZ(-4), 'blue_bed', { facing: 'west' });
  sset(b, 3, yc, -4, 'chest[facing=east]');
  sset(b, 3, yc + 1, -4, 'lantern[hanging=false]');
  sset(b, 4, yc, 3, 'cartography_table');
  sset(b, 4, yc + 1, 3, 'lantern[hanging=false]');
  b.stairs(SX(5), yc, SZ(3), 'dark_oak_stairs', { facing: 'east' });
  sset(b, 2, yc, 3, 'lectern[facing=east]');
  for (const v of [3, 4]) for (const yy of [yc, yc + 1]) sset(b, 9, yy, v, 'bookshelf');
  sset(b, 9, yc, -4, 'barrel[facing=up]');
  sset(b, 9, yc + 1, -4, 'lantern[hanging=false]');
  // Back: Kombüse und Kojen der Mannschaft.
  for (const [u, v, state] of [[43, -4, 'furnace[facing=east]'], [44, -4, 'smoker[facing=east]'], [45, -4, 'barrel[facing=up]'],
    [43, 4, 'crafting_table'], [42, -3, 'cauldron'], [48, -3, 'barrel[facing=up]'], [48, 3, 'chest[facing=west]']]) sset(b, u, y, v, state);
  for (const [u, v] of [[45, -4], [48, -3], [48, 3], [43, 4]]) sset(b, u, y + 1, v, 'lantern[hanging=false]');
  b.bed(SX(44), y, SZ(4), 'white_bed', { facing: 'east' });
  b.bed(SX(49), y, SZ(-2), 'white_bed', { facing: 'east' });
  // Teppiche
  const carpet = (u1, u2, yy, color) => {
    for (let u = u1; u <= u2; u++) for (let v = -6; v <= 6; v++) {
      if (isInterior(u, v, yy) && sget(b, u, yy, v) === 'air' && sget(b, u, yy - 1, v) !== 'air') sset(b, u, yy, v, `${color}_carpet`);
    }
  };
  carpet(1, 9, y, 'red');
  carpet(0, 9, yc, 'blue');
}

function buildDeckDetails(b) {
  const y = DECK.main + 1;
  // Ankerspill hinter dem Großmast
  sset(b, 33, y, 0, 'stripped_dark_oak_log[axis=y]');
  sset(b, 33, y + 1, 0, 'dark_oak_slab[type=bottom]');
  for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sset(b, 33 + du, y, dv, 'dark_oak_fence');
  // Schiffsglocke auf der Back, Ruderrad und Kompasshaus auf dem Achterdeck
  sset(b, BREAK.fore + 2, DECK.fore + 1, 0, 'bell[attachment=floor,facing=east]');
  sset(b, 20, DECK.quarter + 1, 0, 'dark_oak_fence');
  sset(b, 21, DECK.quarter + 1, 0, 'dark_oak_trapdoor[facing=east,half=bottom,open=true]');
  sset(b, 19, DECK.quarter + 1, 1, 'spruce_fence');
  sset(b, 19, DECK.quarter + 2, 1, 'lantern[hanging=false]');
  // Fässer und Kisten an der Bordwand
  for (const [u, v, state] of [[37, -5, 'barrel[facing=up]'], [38, -5, 'barrel[facing=up]'], [37, -4, 'composter'], [25, 5, 'barrel[facing=up]'],
    [26, 5, 'composter'], [32, 5, 'barrel[facing=north]']]) sset(b, u, y, v, state);
  sset(b, 37, y + 1, -5, 'barrel[facing=up]');
  // Drehbassen auf dem Achterdeck
  for (const side of [SIDE.port, SIDE.starboard]) for (const u of [16, 19]) gunPort(b, u, DECK.quarter + 1, side, { carriage: false });
}

// Prüft, dass in allen Innenräumen kein begehbares Feld dunkel ist (Monster spawnen nur bei Blocklicht 0).
function assertLit(b) {
  const rooms = [
    ['Laderaum', SX(4), DECK.hold + 1, SZ(-6), SX(50), DECK.hold + 2, SZ(6), (x, yy, z) => isInterior(x - SHIP.x0, z - SHIP.cz, yy)],
    ['Batteriedeck', SX(4), DECK.gun + 1, SZ(-6), SX(50), DECK.gun + 3, SZ(6), (x, yy, z) => isInterior(x - SHIP.x0, z - SHIP.cz, yy)],
    ['Kajüten', SX(0), DECK.main + 1, SZ(-6), SX(21), DECK.main + 2, SZ(6), (x, yy, z) => isInterior(x - SHIP.x0, z - SHIP.cz, yy)],
    ['Back', SX(42), DECK.main + 1, SZ(-6), SX(53), DECK.main + 2, SZ(6), (x, yy, z) => isInterior(x - SHIP.x0, z - SHIP.cz, yy)],
    ['Kapitänskajüte', SX(0), DECK.quarter + 1, SZ(-6), SX(9), DECK.quarter + 2, SZ(6), (x, yy, z) => isInterior(x - SHIP.x0, z - SHIP.cz, yy)],
    ['Leuchtturm', LIGHT.cx - 4, LIGHT.base, LIGHT.cz - 4, LIGHT.cx + 4, LIGHT.top, LIGHT.cz + 4, (x, yy, z) => inTower(x, yy, z)],
    ['Kran', CRANE.x1 + 1, CRANE.floor + 1, CRANE.z1 + 1, CRANE.x2 - 1, CRANE.top, CRANE.z2 - 1, () => true],
    ['Hafenmeisterei', HM.x1 + 1, WALK, HM.z1 + 1, HM.x2 - 1, 16, HM.z2 - 1, () => true],
    ['Glockenturm', HM.tower.x1 + 1, WALK, HM.tower.z1 + 1, HM.tower.x2 - 1, 20, HM.tower.z2 - 1, () => true],
    ['Schänke', 23, WALK, 5, 31, 16, 12, () => true],
  ];
  for (const w of WAREHOUSES) rooms.push([`Speicher ${w.x1}`, w.x1 + 1, WALK, WH.z1 + 1, w.x1 + WH.width - 2, WH.eave - 1, WH.z2 - 1, () => true]);
  for (const [name, x1, y1, z1, x2, y2, z2, keep] of rooms) {
    const dark = findDarkSpots(b, { x1, y1, z1, x2, y2, z2 }).filter(([x, yy, z]) => keep(x, yy, z));
    if (dark.length > 0) throw new Error(`Hafen: ${name} hat ${dark.length} dunkle Felder, z. B. ${dark[0].join(', ')}.`);
  }
}

// ---------------------------------------------------------------- Galeone: Masten, Rahen, Segel, Takelage

// Mast: unten ein Kreuz aus fünf Stämmen (bis lowerTop), darüber einfach; Mars-Plattform bei topY.
function mast(b, u, { base, deck, lowerTop, top, platform }) {
  for (let y = base; y <= top; y++) sset(b, u, y, 0, `${P.mastCore}[axis=y]`);
  for (let y = deck + 1; y <= lowerTop; y++) {
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sset(b, u + du, y, dv, `${P.mast}[axis=y]`);
  }
  // Mastkorb: 5 × 5 ohne Ecken, Geländer.
  for (let du = -2; du <= 2; du++) {
    for (let dv = -2; dv <= 2; dv++) {
      if (Math.abs(du) === 2 && Math.abs(dv) === 2) continue;
      if (du === 0 && dv === 0) continue;
      sset(b, u + du, platform, dv, 'spruce_slab[type=top]');
      if (Math.abs(du) === 2 || Math.abs(dv) === 2) sset(b, u + du, platform + 1, dv, 'spruce_fence');
    }
  }
  for (const [du, dv, facing] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) {
    b.stairs(SX(u + du * 2), platform - 1, SZ(dv * 2), 'spruce_stairs', { facing, half: 'top' });
  }
}

function yard(b, u, y, half) {
  for (let v = -half; v <= half; v++) {
    const tip = Math.abs(v) > half - 2;
    sset(b, u, y, v, tip ? 'spruce_fence' : `${P.yard}[axis=z]`);
  }
}

// Rahsegel unter einer Rah: Zeilen yTop … yBot, Breite wächst nach unten, Bauch nach vorne (+u).
function squareSail(b, { u, yTop, yBot, hwTop, hwBot, bulge, cross = false }) {
  const rows = Math.max(1, yTop - yBot);
  const d = new Map();
  const key = (y, v) => `${y},${v}`;
  for (let y = yTop; y >= yBot; y--) {
    const t = (yTop - y) / rows;
    const hw = Math.round(hwTop + (hwBot - hwTop) * t);
    for (let v = -hw; v <= hw; v++) {
      const across = 1 - (v / (hw + 1)) ** 2;
      d.set(key(y, v), Math.round(bulge * (0.35 + 0.65 * 4 * t * (1 - t)) * across));
    }
  }
  for (const [k, dd] of d) {
    const [y, v] = k.split(',').map(Number);
    let lo = dd;
    for (const [ny, nv] of [[y + 1, v], [y - 1, v], [y, v + 1], [y, v - 1]]) {
      const n = d.get(key(ny, nv));
      if (n !== undefined) lo = Math.min(lo, n);
    }
    const t = (yTop - y) / rows;
    const hw = Math.round(hwTop + (hwBot - hwTop) * t);
    // Tuchbahnen: jede vierte Bahn etwas heller, Saum am Fuß und an den Seiten grau.
    let state = (v + 40) % 4 === 0 ? P.sailSeam : P.sail;
    if (y === yBot || Math.abs(v) === hw) state = P.sailShade;
    if (cross) {
      const diag = Math.abs(Math.abs(v) - hw * Math.abs(2 * t - 1));
      if (diag < 1.1 && Math.abs(v) < hw) state = P.sailCross;
    }
    for (let du = lo; du <= dd; du++) setIfAir(b, SX(u + du), y, SZ(v), state);
  }
}

// Lateinersegel am Besan: Dreieck unter der schrägen Rah (v = 1), Fuß waagrecht.
function lateenSail(b) {
  const a = [25, 18];
  const c = [3, 36];
  const footY = 19;
  for (const [u, y] of linePoints(a[0], a[1], 0, c[0], c[1], 0).map(([x, yy]) => [x, yy])) sset(b, u, y, 1, `${P.yard}[axis=x]`);
  for (let u = 4; u <= 23; u++) {
    const yardY = Math.round(a[1] + ((c[1] - a[1]) * (a[0] - u)) / (a[0] - c[0]));
    for (let y = footY; y < yardY; y++) {
      const t = (u - 4) / 19;
      const belly = (y - footY) / Math.max(1, yardY - footY);
      const v = 1 + (t > 0.15 && t < 0.85 && belly > 0.2 && belly < 0.8 ? 1 : 0);
      setIfAir(b, SX(u), y, SZ(v), y === footY || u === 4 ? P.sailShade : u % 4 === 0 ? P.sailSeam : P.sail);
      if (v === 2) setIfAir(b, SX(u), y, SZ(1), P.sail);
    }
  }
}

function pennant(b, u, y, colors) {
  sset(b, u, y, 0, 'spruce_fence');
  sset(b, u, y + 1, 0, 'spruce_fence');
  colors.forEach((c, i) => {
    sset(b, u + 1 + i, y + 1, 0, `${c}_wool`);
    if (i < colors.length - 1) sset(b, u + 1 + i, y, 0, `${c}_wool`);
  });
}

function buildMasts(b) {
  const { main, fore, mizzen } = MAST;
  mast(b, main, { base: DECK.hold + 1, deck: DECK.main, lowerTop: 26, top: 52, platform: 27 });
  mast(b, fore, { base: DECK.hold + 1, deck: DECK.fore, lowerTop: 24, top: 47, platform: 25 });
  mast(b, mizzen, { base: DECK.hold + 1, deck: DECK.quarter, lowerTop: 25, top: 40, platform: 26 });
  // Saling (kleine Querhölzer) an den Stengen.
  for (const [u, y] of [[main, 43], [fore, 38], [mizzen, 35]]) {
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) sset(b, u + du, y, dv, 'spruce_slab[type=top]');
  }
  // Bugspriet und Blinde-Stenge.
  const sprit = linePoints(49, 14, 0, 70, 24, 0);
  sprit.forEach(([u, y], i) => {
    sset(b, u, y, 0, `${P.mast}[axis=x]`);
    const next = sprit[i + 1];
    if (next && next[1] > y) b.slab(SX(u), y + 1, SZ(0), 'spruce_slab');
  });
  for (let y = 25; y <= 30; y++) sset(b, 70, y, 0, `${P.mastCore}[axis=y]`);
}

function buildYardsAndSails(b) {
  const { main, fore, mizzen } = MAST;
  // Großmast
  yard(b, main + 1, 26, 12);
  squareSail(b, { u: main + 1, yTop: 25, yBot: 15, hwTop: 11, hwBot: 12, bulge: 2, cross: true });
  yard(b, main + 1, 40, 9);
  squareSail(b, { u: main + 1, yTop: 39, yBot: 30, hwTop: 7, hwBot: 9, bulge: 2 });
  yard(b, main + 1, 49, 6);
  squareSail(b, { u: main + 1, yTop: 48, yBot: 45, hwTop: 5, hwBot: 6, bulge: 1 });
  // Fockmast
  yard(b, fore + 1, 23, 10);
  squareSail(b, { u: fore + 1, yTop: 22, yBot: 16, hwTop: 9, hwBot: 10, bulge: 2 });
  yard(b, fore + 1, 36, 8);
  squareSail(b, { u: fore + 1, yTop: 35, yBot: 27, hwTop: 6, hwBot: 8, bulge: 2 });
  yard(b, fore + 1, 45, 5);
  squareSail(b, { u: fore + 1, yTop: 44, yBot: 41, hwTop: 4, hwBot: 5, bulge: 1 });
  // Besan: Lateinersegel und kleines Kreuzsegel.
  lateenSail(b);
  yard(b, mizzen + 1, 37, 5);
  squareSail(b, { u: mizzen + 1, yTop: 36, yBot: 30, hwTop: 4, hwBot: 5, bulge: 1 });
  // Blinde unter dem Bugspriet, Schiebblinde an der Blinde-Stenge.
  yard(b, 63, 18, 6);
  squareSail(b, { u: 63, yTop: 17, yBot: 14, hwTop: 4, hwBot: 5, bulge: 1 });
  yard(b, 70, 29, 3);
  squareSail(b, { u: 70, yTop: 28, yBot: 25, hwTop: 2, hwBot: 3, bulge: 1 });
  // Wimpel
  pennant(b, main, 53, ['red', 'yellow', 'red', 'yellow']);
  pennant(b, fore, 48, ['yellow', 'red', 'yellow']);
  pennant(b, mizzen, 41, ['red', 'yellow', 'red']);
  // Heckflagge
  for (let y = 18; y <= 24; y++) sset(b, -1, y, 0, 'spruce_fence');
  sset(b, -1, 25, 0, 'lightning_rod[facing=up]');
  // Heckflagge der Hafenstadt: blau mit weißem Streifen und goldenem Feld.
  for (let du = 0; du <= 4; du++) {
    for (let y = 20; y <= 23; y++) {
      const gold = du >= 1 && du <= 2 && (y === 21 || y === 22);
      sset(b, -2 - du, y, 0, gold ? 'yellow_wool' : y === 22 && du > 2 ? 'white_wool' : 'blue_wool');
    }
  }
}

// Wanten von der Mars-Plattform zu den Rüsten an der Bordwand, dazu Stage längs der Mittellinie.
function shrouds(b, mastU, platform, deckY, count = 3) {
  for (const side of [SIDE.port, SIDE.starboard]) {
    const chainY = deckY + 2;
    for (let i = 0; i < count; i++) {
      const u = mastU - 2 + i;
      const v = side * (sideV(u, chainY) + 1);
      rope(b, [SX(u), platform - 1, SZ(side * 2)], [SX(u - 1), chainY, SZ(v)]);
    }
    // Rüste (Planke außen an der Bordwand)
    for (let u = mastU - 4; u <= mastU + 1; u++) sset(b, u, deckY + 1, side * (sideV(u, deckY + 1) + 1), 'dark_oak_slab[type=top]');
  }
}

function buildRigging(b) {
  const { main, fore, mizzen } = MAST;
  shrouds(b, main, 27, DECK.main);
  shrouds(b, fore, 25, DECK.fore - 2);
  shrouds(b, mizzen, 26, DECK.quarter - 2);
  // Stengewanten
  for (const [u, top, plat] of [[main, 42, 27], [fore, 37, 25], [mizzen, 34, 26]]) {
    for (const side of [SIDE.port, SIDE.starboard]) rope(b, [SX(u), top, SZ(side)], [SX(u - 1), plat + 1, SZ(side * 2)]);
  }
  // Stage
  rope(b, [SX(main + 1), 27, SZ(0)], [SX(fore - 1), DECK.fore + 1, SZ(0)]);
  rope(b, [SX(main + 1), 41, SZ(0)], [SX(fore - 1), 26, SZ(0)]);
  rope(b, [SX(main + 1), 50, SZ(0)], [SX(fore - 1), 39, SZ(0)]);
  rope(b, [SX(fore + 1), 25, SZ(0)], [SX(60), 20, SZ(0)]);
  rope(b, [SX(fore + 1), 38, SZ(0)], [SX(69), 24, SZ(0)]);
  rope(b, [SX(mizzen + 1), 26, SZ(0)], [SX(main - 1), DECK.main + 4, SZ(0)]);
  rope(b, [SX(mizzen + 1), 39, SZ(0)], [SX(main - 1), 28, SZ(0)]);
}

// ---------------------------------------------------------------- Speicher am Kai

const WH = { z1: 2, z2: 13, floors: [GROUND, 13, 17, 21], eave: 25, width: 13 };
const WAREHOUSES = [
  { x1: 36, wall: 'bricks', trim: 'stone_bricks', trimStairs: 'stone_brick_stairs', trimSlab: 'stone_brick_slab',
    band: 'stone_brick_stairs', roof: 'deepslate_tile_stairs', roofFull: 'deepslate_tiles', roofSlab: 'deepslate_tile_slab', goods: 'tuch' },
  { x1: 51, wall: 'mud_bricks', trim: 'bricks', trimStairs: 'brick_stairs', trimSlab: 'brick_slab',
    band: 'brick_stairs', roof: 'brick_stairs', roofFull: 'bricks', roofSlab: 'brick_slab', goods: 'fass' },
  { x1: 66, timber: true, wall: 'white_terracotta', trim: 'stone_bricks', trimStairs: 'stone_brick_stairs', trimSlab: 'stone_brick_slab',
    band: 'dark_oak_stairs', roof: 'dark_oak_stairs', roofFull: 'dark_oak_planks', roofSlab: 'dark_oak_slab', goods: 'heu' },
  { x1: 81, wall: 'deepslate_bricks', trim: 'tuff_bricks', trimStairs: 'tuff_brick_stairs', trimSlab: 'tuff_brick_slab',
    band: 'tuff_brick_stairs', roof: 'waxed_weathered_cut_copper_stairs', roofFull: 'waxed_weathered_cut_copper',
    roofSlab: 'waxed_weathered_cut_copper_slab', goods: 'kisten' },
];

// Stufengiebel-Höhe über der Traufe je Abstand e von der Seitenwand (0 … 6).
const gableTop = (e) => WH.eave + 2 * Math.floor(e / 2) + 2;

// Satteldach mit First längs z, Überstand nur an den Traufen; Giebelwände bei z1/z2 bleiben frei.
function warehouseRoof(b, w, x1, x2, { z1 = WH.z1, z2 = WH.z2, ends = 0 } = {}) {
  const y = WH.eave;
  const span = x2 - x1 + 3;
  const half = Math.floor(span / 2);
  for (let d = 0; d < half; d++) {
    for (let z = z1 + 1 - ends; z <= z2 - 1 + ends; z++) {
      b.stairs(x1 - 1 + d, y + d, z, w.roof, { facing: 'east' });
      b.stairs(x2 + 1 - d, y + d, z, w.roof, { facing: 'west' });
      if (d >= 1) {
        b.set(x1 - 1 + d, y + d - 1, z, w.roofFull);
        b.set(x2 + 1 - d, y + d - 1, z, w.roofFull);
      }
    }
  }
  const cx = x1 - 1 + half;
  for (let z = z1 + 1 - ends; z <= z2 - 1 + ends; z++) {
    b.set(cx, y + half - 1, z, w.roofFull);
    b.slab(cx, y + half, z, w.roofSlab);
  }
  // Traufgesims unter dem Überstand.
  for (let z = z1; z <= z2; z++) {
    b.stairs(x1 - 1, y - 1, z, w.band, { facing: 'east', half: 'top' });
    b.stairs(x2 + 1, y - 1, z, w.band, { facing: 'west', half: 'top' });
  }
}

// Massive Giebelfassade (Süd z2 oder Nord z1) mit Lisenen, Gesimsen, Fenstern, Ladeluken und Stufengiebel.
function brickFacade(b, w, z, out) {
  const x1 = w.x1;
  const x2 = x1 + WH.width - 1;
  const c = x1 + 6;
  const dz = out === 'south' ? 1 : -1;
  const toWall = out === 'south' ? 'north' : 'south';
  const front = out === 'south';
  // Wand (unten 2 dick für tiefe Fensterlaibungen) und Stufengiebel mit Abdeckplatten.
  for (let x = x1; x <= x2; x++) {
    const e = Math.min(x - x1, x2 - x);
    for (let y = WALK; y <= gableTop(e); y++) b.set(x, y, z, w.wall);
    for (let y = WALK; y < WH.eave; y++) b.set(x, y, z - dz, w.wall);
    b.slab(x, gableTop(e) + 1, z, w.trimSlab);
  }
  // Sockel aus Stein.
  for (let x = x1; x <= x2; x++) b.set(x, WALK, z, w.trim);
  // Lisenen (vorstehend) an den Ecken und neben der Mittelachse.
  for (const x of [x1, x1 + 5, x2 - 5, x2]) {
    for (let y = WALK; y <= WH.eave - 1; y++) b.set(x, y, z + dz, y === WALK ? w.trim : w.wall);
    b.stairs(x, WH.eave, z + dz, w.trimStairs, { facing: toWall });
  }
  // Geschossgesimse zwischen den Lisenen.
  for (const fy of WH.floors.slice(1)) {
    for (let x = x1 + 1; x <= x2 - 1; x++) {
      if (x === x1 + 5 || x === x2 - 5) continue;
      b.stairs(x, fy, z + dz, w.band, { facing: toWall, half: 'top' });
    }
  }
  // Fenster mit Laibung (Glas eine Ebene innen) und Sturz.
  const windowAt = (x, y, h = 2, recess = true) => {
    for (let k = 0; k < h; k++) {
      b.set(x, y + k, z, recess ? 'air' : 'glass_pane');
      if (recess) b.set(x, y + k, z - dz, 'glass_pane');
    }
    b.set(x, y + h, z, w.trim);
  };
  for (const fy of WH.floors.slice(1)) for (const e of [2, 4]) for (const x of [x1 + e, x2 - e]) windowAt(x, fy + 1);
  windowAt(x1 + 2, WALK + 1);
  windowAt(x2 - 2, WALK + 1);
  // Giebelfenster
  for (const x of [x1 + 3, x2 - 3]) windowAt(x, WH.eave + 1, 2, false);
  windowAt(c, WH.eave + 5, 1, false);
  // Mittelachse: Ladeluken in jedem Geschoss, unten ein Tor.
  for (const fy of [...WH.floors.slice(1), WH.eave]) {
    for (let k = 1; k <= 2; k++) b.set(c, fy + k, z, `spruce_trapdoor[facing=${toWall},half=bottom,open=true]`);
    b.set(c, fy + 3, z, w.trim);
  }
  if (front) {
    for (let x = c - 1; x <= c + 1; x++) for (let y = WALK; y <= WALK + 2; y++) for (const zz of [z, z - dz]) b.set(x, y, zz, 'air');
    b.stairs(c - 1, WALK + 2, z, w.trimStairs, { facing: 'west', half: 'top' });
    b.stairs(c + 1, WALK + 2, z, w.trimStairs, { facing: 'east', half: 'top' });
    b.set(c, WALK + 3, z, w.trim);
    for (const x of [c - 2, c + 2]) for (let y = WALK; y <= WALK + 3; y++) b.set(x, y, z, w.trim);
    // Windenbalken mit Kette und Fass.
    b.fill(c, WH.eave + 4, z, c, WH.eave + 4, z + 2 * dz, 'spruce_log[axis=z]');
    b.stairs(c, WH.eave + 3, z + dz, 'spruce_stairs', { facing: toWall, half: 'top' });
    b.fill(c, 15, z + 2 * dz, c, WH.eave + 3, z + 2 * dz, 'iron_chain[axis=y]');
    b.set(c, 14, z + 2 * dz, 'barrel[facing=up]');
  } else {
    b.door(c, WALK, z, 'spruce_door', { facing: toWall, hinge: 'left' });
    b.set(c, WALK, z - dz, 'air');
    b.set(c, WALK + 1, z - dz, 'air');
  }
}

function brickSides(b, w) {
  const x1 = w.x1;
  const x2 = x1 + WH.width - 1;
  for (const x of [x1, x2]) {
    for (let z = WH.z1 + 1; z <= WH.z2 - 1; z++) {
      for (let y = WALK; y <= WH.eave - 1; y++) b.set(x, y, z, y === WALK ? w.trim : w.wall);
    }
    const out = x === x1 ? -1 : 1;
    for (const fy of WH.floors.slice(1)) {
      for (const z of [6, 9]) {
        b.set(x, fy + 1, z, 'glass_pane');
        b.set(x, fy + 2, z, 'glass_pane');
        b.stairs(x + out, fy, z, w.band, { facing: out > 0 ? 'west' : 'east', half: 'top' });
      }
    }
  }
}

function timberWarehouse(b, w) {
  const x1 = w.x1;
  const x2 = x1 + WH.width - 1;
  const { z1, z2 } = WH;
  const c = x1 + 6;
  // Erdgeschoss aus Stein mit Tor, darüber drei Fachwerkgeschosse.
  b.walls(x1, WALK, z1, x2, WALK + 3, z2, 'stone_bricks');
  for (let x = x1; x <= x2; x++) for (const z of [z1, z2]) b.set(x, WALK, z, 'polished_andesite');
  for (const fy of WH.floors.slice(1)) {
    const h = 4;
    timberWallSafe(b, { x: x1, y: fy, z: z2, facing: 'south', length: WH.width, height: h });
    timberWallSafe(b, { x: x2, y: fy, z: z1, facing: 'north', length: WH.width, height: h });
    timberWallSafe(b, { x: x1, y: fy, z: z1, facing: 'west', length: z2 - z1 + 1, height: h });
    timberWallSafe(b, { x: x2, y: fy, z: z2, facing: 'east', length: z2 - z1 + 1, height: h });
  }
  b.roof({ x1, z1, x2, z2, y: WH.eave, type: 'gable', axis: 'z', stairs: w.roof, slab: w.roofSlab, full: w.wall, overhang: 1 });
  // Giebelständer
  for (const z of [z1, z2]) {
    for (const x of [x1 + 3, c, x2 - 3]) {
      for (let y = WH.eave; y <= WH.eave + 5; y++) if (b.get(x, y, z) === w.wall) b.set(x, y, z, 'stripped_dark_oak_log[axis=y]');
    }
    for (let x = x1 + 1; x <= x2 - 1; x++) if (b.get(x, WH.eave + 3, z) === w.wall) b.set(x, WH.eave + 3, z, 'stripped_dark_oak_log[axis=x]');
  }
  // Fenster
  for (const fy of WH.floors.slice(1)) {
    for (const x of [x1 + 2, x1 + 4, x2 - 4, x2 - 2]) {
      for (const z of [z1, z2]) {
        b.set(x, fy + 1, z, 'glass_pane');
        b.set(x, fy + 2, z, 'glass_pane');
      }
      b.set(x, fy + 1, z2 + 1, `spruce_trapdoor[facing=south,half=top,open=false]`);
    }
    for (const z of [5, 10]) for (const x of [x1, x2]) {
      b.set(x, fy + 1, z, 'glass_pane');
      b.set(x, fy + 2, z, 'glass_pane');
    }
  }
  for (const x of [x1 + 3, x2 - 3]) for (const z of [z1, z2]) {
    b.set(x, WALK + 1, z, 'glass_pane');
    b.set(x, WALK + 2, z, 'glass_pane');
  }
  // Ladeluken und Tor
  for (const fy of [...WH.floors.slice(1), WH.eave]) for (let k = 1; k <= 2; k++) b.set(c, fy + k, z2, 'spruce_trapdoor[facing=north,half=bottom,open=true]');
  for (let x = c - 1; x <= c + 1; x++) for (let y = WALK; y <= WALK + 2; y++) b.set(x, y, z2, 'air');
  b.fill(c - 2, WALK + 3, z2, c + 2, WALK + 3, z2, 'stripped_dark_oak_log[axis=x]');
  b.door(c, WALK, z1, 'spruce_door', { facing: 'south', hinge: 'left' });
  // Windenerker: kleiner Giebel mit Balken über der obersten Luke.
  b.fill(c, WH.eave + 5, z2, c, WH.eave + 5, z2 + 3, 'spruce_log[axis=z]');
  b.fill(c, 15, z2 + 3, c, WH.eave + 4, z2 + 3, 'iron_chain[axis=y]');
  b.set(c, 14, z2 + 3, 'barrel[facing=up]');
}

// timberWall aus der Bibliothek, Fenster werden danach eingesetzt.
function timberWallSafe(b, o) {
  timberWall(b, { ...o, frame: 'stripped_dark_oak_log', fill: 'white_terracotta', pattern: 'diagonal', spacing: 4 });
}

// Böden, Treppen und Einrichtung eines Speichers.
function warehouseInterior(b, w) {
  const x1 = w.x1;
  const x2 = x1 + WH.width - 1;
  const { z1, z2 } = WH;
  b.fill(x1 + 1, GROUND, z1 + 1, x2 - 1, GROUND, z2 - 1, 'spruce_planks');
  for (const fy of WH.floors.slice(1)) {
    for (let x = x1 + 1; x <= x2 - 1; x++) {
      for (let z = z1 + 1; z <= z2 - 1; z++) b.set(x, fy, z, (x - x1) % 4 === 2 ? 'stripped_spruce_log[axis=z]' : 'spruce_planks');
    }
  }
  // Treppen im Zickzack an der Rückwand (Reihen z1 + 1 und z1 + 2).
  const r1 = z1 + 2;
  const r2 = z1 + 3;
  for (let k = 0; k < 4; k++) b.stairs(x1 + 1 + k, GROUND + 1 + k, r1, 'spruce_stairs', { facing: 'east' });
  for (const x of [x1 + 3, x1 + 4]) b.set(x, 13, r1, 'air');
  for (let k = 0; k < 3; k++) b.stairs(x1 + 4 - k, 14 + k, r2, 'spruce_stairs', { facing: 'west' });
  for (const x of [x1 + 3, x1 + 2]) b.set(x, 17, r2, 'air');
  for (let k = 0; k < 3; k++) b.stairs(x1 + 2 + k, 18 + k, r1, 'spruce_stairs', { facing: 'east' });
  for (const x of [x1 + 3, x1 + 4]) b.set(x, 21, r1, 'air');
  // Ware je Geschoss
  for (const [i, fy] of WH.floors.entries()) {
    const y = fy + 1;
    storage(b, { x: x2 - 1, y, z: z1 + 2, facing: 'west', width: 4, height: i === 0 ? 2 : 1 });
    goodsStack(b, w.goods, x1 + 2, y, z2 - 3, i);
    goodsStack(b, i % 2 ? 'fass' : w.goods, x2 - 4, y, z2 - 3, i + 1);
  }
  for (const fy of WH.floors) {
    const top = fy === GROUND ? 12 : fy + 3;
    lightRoom(b, { x1: x1 + 1, y1: fy + 1, z1: z1 + 1, x2: x2 - 1, y2: top, z2: z2 - 1 });
  }
}

function goodsStack(b, kind, x, y, z, seed) {
  const stack = {
    tuch: ['white_wool', 'red_wool', 'blue_wool', 'brown_wool'],
    fass: ['barrel[facing=up]', 'barrel[facing=north]'],
    heu: ['hay_block[axis=y]', 'hay_block[axis=x]'],
    kisten: ['barrel[facing=up]', 'chest[facing=south]', 'composter'],
  }[kind];
  for (let dx = 0; dx < 2; dx++) {
    for (let dz = 0; dz < 2; dz++) {
      const h = 1 + Math.floor(hash3(x + dx, y, z + dz, seed) * 2);
      for (let k = 0; k < h; k++) b.set(x + dx, y + k, z + dz, stack[Math.floor(hash3(x + dx, y + k, z + dz, seed + 7) * stack.length)]);
    }
  }
}

function buildWarehouse(b, w) {
  if (w.timber) {
    timberWarehouse(b, w);
  } else {
    brickSides(b, w);
    brickFacade(b, w, WH.z2, 'south');
    brickFacade(b, w, WH.z1, 'north');
    warehouseRoof(b, w, w.x1, w.x1 + WH.width - 1);
  }
}

// ---------------------------------------------------------------- Straße und Kai

function buildStreet(b) {
  for (let x = 0; x < SIZE_X; x++) {
    for (let z = STREET.z1; z <= 20; z++) b.set(x, GROUND, z, pickAt(P.street, x, GROUND, z, 5));
    // Bordstein und Rinne zum Kai hin.
    b.set(x, GROUND, 20, x % 2 ? 'polished_andesite' : 'andesite');
    for (let z = 21; z < QUAY_Z; z++) b.set(x, GROUND, z, pickAt(P.paving, x, GROUND, z, 6));
  }
  // Vorplatz vor den Speichern
  for (let x = 34; x <= 110; x++) b.set(x, GROUND, 14, 'stone_bricks');
}

function buildBollards(b) {
  for (let x = 4; x < SIZE_X - 16; x += 7) {
    if (x >= 57 && x <= 67) continue;
    b.set(x, WALK, QUAY_Z - 1, 'polished_blackstone_wall');
    b.set(x, WALK + 1, QUAY_Z - 1, 'polished_blackstone_button[face=floor,facing=south]');
  }
  // Leitern in der Kaimauer
  for (const x of [20, 44, 98]) for (let y = 1; y <= GROUND; y++) b.set(x, y, QUAY_Z + 1, y <= WATER_TOP ? 'ladder[facing=south,waterlogged=true]' : 'ladder[facing=south]');
}

// Kaitreppe ins Wasser im Westen (an der Mauer entlang nach Westen hinab).
function buildQuayStairs(b) {
  for (let i = 0; i <= GROUND - 1; i++) {
    const x = 33 - i;
    const y = GROUND - 1 - i;
    for (const z of [QUAY_Z + 1, QUAY_Z + 2]) {
      b.stairs(x, y, z, 'stone_brick_stairs', { facing: 'east' });
      for (let yy = 0; yy < y; yy++) b.set(x, yy, z, quayStone(x, yy, z));
    }
  }
  // Seitenwange mit Brüstung zum offenen Wasser.
  for (let x = 26; x <= 34; x++) {
    const top = x === 34 ? GROUND : GROUND - 1 - (33 - x);
    for (let y = 0; y <= top; y++) b.set(x, y, QUAY_Z + 3, quayStone(x, y, QUAY_Z + 3));
    b.set(x, top + 1, QUAY_Z + 3, 'stone_brick_wall');
  }
  for (let y = 0; y <= GROUND; y++) for (const z of [QUAY_Z + 1, QUAY_Z + 2]) b.set(34, y, z, y === GROUND ? P.cap : quayStone(34, y, z));
}

function buildGangway(b) {
  // Gangway vom Kai zur Pforte in der Backbord-Bordwand (u 35 … 36).
  for (const u of [35, 36]) {
    const x = SX(u);
    b.slab(x, WALK, QUAY_Z + 1, 'spruce_slab');
    b.slab(x, WALK, QUAY_Z + 2, 'spruce_slab', { type: 'top' });
    b.slab(x, WALK + 1, QUAY_Z + 3, 'spruce_slab');
    b.slab(x, WALK + 1, QUAY_Z + 4, 'spruce_slab', { type: 'top' });
    sset(b, u, DECK.main + 1, -sideV(u, DECK.main + 1), 'air');
    sset(b, u, DECK.main + 2, -sideV(u, DECK.main + 2), 'air');
  }
  for (const x of [SX(34), SX(37)]) {
    b.set(x, WALK + 1, QUAY_Z + 1, 'spruce_fence');
    b.set(x, WALK + 1, QUAY_Z + 2, 'spruce_fence');
    b.set(x, WALK + 2, QUAY_Z + 3, 'spruce_fence');
    b.set(x, WALK + 2, QUAY_Z + 4, 'spruce_fence');
  }
  // Festmacher von Bug und Heck zu den Pollern.
  rope(b, [SX(8), 15, SZ(-sideV(8, 14) - 1)], [32, WALK + 1, QUAY_Z - 1]);
  rope(b, [SX(50), 15, SZ(-sideV(50, 14) - 1)], [88, WALK + 1, QUAY_Z - 1]);
  for (const x of [32, 88]) b.set(x, WALK, QUAY_Z - 1, 'polished_blackstone_wall');
  // Fender zwischen Bordwand und Kai
  for (const u of [8, 20, 44]) {
    const v = -sideV(u, 9) - 1;
    sset(b, u, 9, v, 'spruce_trapdoor[facing=north,half=bottom,open=true]');
    sset(b, u, 8, v, 'spruce_trapdoor[facing=north,half=bottom,open=true]');
  }
}

// ---------------------------------------------------------------- Tretradkran

const CRANE = { x1: 58, x2: 66, z1: 18, z2: 25, cx: 62, floor: 12, top: 21 };

function buildCraneBase(b) {
  const { x1, x2, z1, z2, floor } = CRANE;
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      for (let y = WALK; y <= floor; y++) {
        const edge = x === x1 || x === x2 || z === z1 || z === z2;
        const corner = (x === x1 || x === x2) && (z === z1 || z === z2);
        b.set(x, y, z, corner ? 'chiseled_stone_bricks' : edge ? quayStone(x, y, z) : 'stone');
      }
      b.set(x, floor, z, x === x1 || x === x2 || z === z1 || z === z2 ? 'polished_andesite' : 'spruce_planks');
    }
  }
  // Außentreppe an der Nordseite mit Podest vor der Tür.
  for (let i = 0; i < 4; i++) {
    const x = x1 - 1 + i;
    b.stairs(x, WALK + i, z1 - 1, 'stone_brick_stairs', { facing: 'east' });
    for (let y = WALK; y < WALK + i; y++) b.set(x, y, z1 - 1, 'stone_bricks');
  }
  for (let x = x1 + 3; x <= CRANE.cx + 1; x++) {
    for (let y = WALK; y <= floor; y++) b.set(x, y, z1 - 1, y === floor ? 'polished_andesite' : 'stone_bricks');
  }
  b.set(CRANE.cx + 2, floor + 1, z1 - 1, 'stone_brick_wall');
}

function buildCraneHouse(b) {
  const { x1, x2, z1, z2, floor, top } = CRANE;
  const y = floor + 1;
  const h = top - floor;
  const o = { frame: 'stripped_dark_oak_log', fill: 'oak_planks', pattern: 'cross', spacing: 4, height: h };
  timberWall(b, { ...o, x: x1, y, z: z2, facing: 'south', length: x2 - x1 + 1 });
  timberWall(b, { ...o, x: x2, y, z: z1, facing: 'north', length: x2 - x1 + 1 });
  timberWall(b, { ...o, x: x1, y, z: z1, facing: 'west', length: z2 - z1 + 1 });
  timberWall(b, { ...o, x: x2, y, z: z2, facing: 'east', length: z2 - z1 + 1 });
  b.roof({ x1, z1, x2, z2, y: top + 1, type: 'hip', axis: 'x', stairs: 'dark_oak_stairs', slab: 'dark_oak_slab', full: 'dark_oak_planks', overhang: 1 });
  // Dachreiter mit Wetterfahne.
  b.set(CRANE.cx, top + 6, (z1 + z2) >> 1, 'dark_oak_fence');
  b.set(CRANE.cx, top + 7, (z1 + z2) >> 1, 'lightning_rod[facing=up]');
  doorway(b, { x: CRANE.cx, y, z: z1, facing: 'north', door: 'spruce_door', frame: 'stripped_dark_oak_log', canopy: 'dark_oak_stairs' });
  for (const z of [20, 23]) for (const x of [x1, x2]) {
    b.set(x, y + 3, z, 'glass_pane');
    b.set(x, y + 4, z, 'glass_pane');
  }
  // Öffnung für das Seil zum Ausleger.
  b.set(CRANE.cx, top - 1, z2, 'air');
  b.set(CRANE.cx, top - 2, z2, 'air');
}

// Zwei Laufräder (Ebene y-z) auf einer Welle längs x, dazwischen die Seiltrommel.
function buildTreadwheels(b) {
  const cy = 16.5;
  const cz = 21.5;
  for (const [xa, xb] of [[59, 60], [64, 65]]) {
    for (let yy = 13; yy <= 20; yy++) {
      for (let z = 19; z <= 24; z++) {
        const d2 = (yy - cy) ** 2 + (z - cz) ** 2;
        if (d2 > 5 && d2 <= 9) for (const x of [xa, xb]) b.set(x, yy, z, 'spruce_planks');
      }
    }
    const outer = xa === 59 ? xa : xb;
    for (const z of [19, 20, 23, 24]) for (const yy of [16, 17]) if (b.get(outer, yy, z) === 'air') b.set(outer, yy, z, 'stripped_spruce_log[axis=z]');
    for (const yy of [14, 15, 18, 19]) for (const z of [21, 22]) if (b.get(outer, yy, z) === 'air') b.set(outer, yy, z, 'stripped_spruce_log[axis=y]');
  }
  for (let x = 59; x <= 65; x++) for (const yy of [16, 17]) for (const z of [21, 22]) b.set(x, yy, z, 'stripped_spruce_log[axis=x]');
  for (let x = 61; x <= 63; x++) b.set(x, 18, 22, 'iron_chain[axis=x]');
  // Lager der Welle auf Böcken.
  for (const x of [59, 65]) for (const z of [21, 22]) b.fill(x, 13, z, x, 13, z, 'dark_oak_fence');
  b.set(62, 13, 21, 'barrel[facing=up]');
  b.set(62, 13, 22, 'barrel[facing=up]');
  rope(b, [62, 18, 23], [62, 19, 24]);
  lightRoom(b, { x1: 59, y1: 13, z1: 19, x2: 65, y2: 20, z2: 24 }, { mode: 'floor' });
}

function buildCraneJib(b) {
  const x = CRANE.cx;
  // Ausleger über das Schiff, Strebe darunter, Seil mit Fässern über der Ladeluke.
  for (const [, y, z] of linePoints(x, 20, 24, x, 25, 36)) b.set(x, y, z, 'stripped_spruce_log[axis=z]');
  for (const [, y, z] of linePoints(x, 14, 26, x, 20, 31)) {
    if (b.get(x, y, z) === 'air') b.set(x, y, z, 'dark_oak_log[axis=z]');
  }
  b.set(x, 25, 36, 'stripped_spruce_wood[axis=z]');
  b.fill(x, 16, 36, x, 24, 36, 'iron_chain[axis=y]');
  b.set(x, 15, 36, 'barrel[facing=up]');
  b.set(x, 14, 36, 'barrel[facing=north]');
}

// ---------------------------------------------------------------- Holzstege und Boote

const PIERS = [
  { x1: 6, x2: 8, z1: QUAY_Z + 1, z2: 57 },
  { x1: 1, x2: 13, z1: 54, z2: 57 },
  { x1: 22, x2: 24, z1: QUAY_Z + 1, z2: 49 },
  { x1: 25, x2: 31, z1: 40, z2: 41 },
];

function pierDeck(b, p) {
  const alongZ = p.z2 - p.z1 >= p.x2 - p.x1;
  for (let x = p.x1; x <= p.x2; x++) {
    for (let z = p.z1; z <= p.z2; z++) {
      const edge = alongZ ? x === p.x1 || x === p.x2 : z === p.z1 || z === p.z2;
      b.set(x, GROUND, z, edge ? `stripped_spruce_log[axis=${alongZ ? 'z' : 'x'}]` : (x + z) % 5 === 0 ? 'oak_planks' : 'spruce_planks');
    }
  }
  // Pfähle (Stämme) an den Rändern, darunter Querriegel.
  const posts = [];
  if (alongZ) {
    for (let z = p.z1 + 2; z <= p.z2; z += 4) posts.push([p.x1, z], [p.x2, z]);
    posts.push([p.x1, p.z2], [p.x2, p.z2]);
  } else {
    for (let x = p.x1; x <= p.x2; x += 4) posts.push([x, p.z1], [x, p.z2]);
    posts.push([p.x2, p.z1], [p.x2, p.z2]);
  }
  for (const [x, z] of posts) {
    b.fill(x, SEABED + 1, z, x, GROUND - 1, z, 'spruce_log[axis=y]');
    b.set(x, WALK, z, 'spruce_fence');
  }
}

function buildPiers(b) {
  for (const p of PIERS) pierDeck(b, p);
  // Riegel unter den Stegen (Querbalken knapp über dem Wasser).
  for (let z = 30; z <= 57; z += 4) b.fill(6, GROUND - 1, z, 8, GROUND - 1, z, 'spruce_planks');
  for (let z = 30; z <= 49; z += 4) b.fill(22, GROUND - 1, z, 24, GROUND - 1, z, 'spruce_planks');
  // Geländer am Kopf des großen Stegs und Laternen.
  for (let x = 1; x <= 13; x++) if (x !== 6 && x !== 8 && x % 4 !== 1) b.set(x, WALK, 57, 'spruce_fence');
  for (const [x, z] of [[8, 34], [6, 46], [1, 54], [13, 54], [24, 36], [22, 47], [31, 40]]) {
    lampPost(b, { x, y: WALK, z, facing: 'south', height: 3, post: 'spruce_fence' });
  }
  // Fischkisten und Netze
  for (const [x, z, s] of [[7, 30, 'barrel[facing=up]'], [3, 55, 'barrel[facing=up]'], [4, 55, 'composter'], [3, 56, 'composter'],
    [12, 56, 'barrel[facing=north]'], [23, 44, 'composter'], [23, 45, 'barrel[facing=up]'], [29, 41, 'barrel[facing=up]']]) b.set(x, WALK, z, s);
  b.set(3, WALK + 1, 55, 'barrel[facing=up]');
}

// Kleiner Wippkran am Stegkopf.
function buildPierCrane(b) {
  const x = 10;
  const z = 55;
  b.fill(x, WALK, z, x, WALK + 7, z, 'spruce_log[axis=y]');
  for (const [dx, dz, facing] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) b.stairs(x + dx, WALK, z + dz, 'spruce_stairs', { facing });
  for (const [, y, zz] of linePoints(x, WALK + 4, z - 1, x, WALK + 8, z + 6)) b.set(x, y, zz, 'stripped_spruce_log[axis=z]');
  for (const [, y, zz] of linePoints(x, WALK + 6, z, x, WALK + 6, z - 2)) setIfAir(b, x, y, zz, 'stripped_spruce_log[axis=z]');
  b.set(x, WALK + 5, z - 2, 'cobblestone');
  b.fill(x, WALK + 3, z + 6, x, WALK + 7, z + 6, 'iron_chain[axis=y]');
  b.set(x, WALK + 2, z + 6, 'barrel[facing=up]');
  b.set(x - 1, WALK + 1, z, 'grindstone[face=floor,facing=east]');
}

// Boot in lokalen Koordinaten (Bug bei lz = 0, Heck bei lz = len − 1, quer lx), mit b.transform platziert.
function rowBoat(b, { x, z, rotate = 0, wood = 'oak', seed = 0 }) {
  b.transform({ offset: [x, 0, z], rotate }, () => {
    const len = 7;
    for (let lz = 0; lz < len; lz++) {
      const hw = lz === 0 ? 0 : 1;
      for (let lx = -hw; lx <= hw; lx++) {
        const side = Math.abs(lx) === hw;
        b.set(lx, WATER_TOP, lz, `${wood}_planks`);
        if (lz > 0 && lz < len - 1 && lx === 0) b.set(lx, WATER_TOP - 1, lz, `${wood}_planks`);
        if (side || lz === len - 1) b.slab(lx, WATER_TOP + 1, lz, `${wood}_slab`);
      }
    }
    b.stairs(0, WATER_TOP + 1, 0, `${wood}_stairs`, { facing: 'south' });
    for (const lz of [2, 4]) b.slab(0, WATER_TOP + 1, lz, `${wood}_slab`);
    const oar = seed % 2 === 0;
    if (oar) {
      for (const lx of [-2, 2]) b.set(lx, WATER_TOP + 1, 3, `${wood}_fence`);
    } else {
      b.set(0, WATER_TOP + 1, 3, `${wood}_trapdoor[facing=north,half=bottom]`);
    }
  });
}

function fishingBoat(b, { x, z, rotate = 0, hull = 'spruce_planks', stripe = 'blue_terracotta', cap = 'birch_slab', sail = 'white_wool' }) {
  const half = [0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1];
  const len = half.length;
  b.transform({ offset: [x, 0, z], rotate }, () => {
    for (let lz = 0; lz < len; lz++) {
      const hw = half[lz];
      for (let lx = -hw; lx <= hw; lx++) {
        const side = Math.abs(lx) === hw || lz === 0 || lz === len - 1;
        if (lz >= 2 && lz <= len - 2 && Math.abs(lx) <= Math.max(0, hw - 1)) b.set(lx, WATER_TOP - 1, lz, hull);
        b.set(lx, WATER_TOP, lz, side ? hull : 'spruce_planks');
        if (side) {
          b.set(lx, WATER_TOP + 1, lz, stripe);
          b.slab(lx, WATER_TOP + 2, lz, cap);
        }
      }
      if (lz >= 2 && lz <= len - 2) b.set(0, WATER_TOP - 2, lz, 'stripped_spruce_log[axis=z]');
    }
    // Hoher Bug
    b.set(0, WATER_TOP + 2, 0, hull);
    b.slab(0, WATER_TOP + 3, 0, cap);
    for (const lx of [-1, 1]) b.set(lx, WATER_TOP + 2, 1, hull);
    // Mast, Baum mit aufgetuchtem Segel, Gaffel, Wanten
    b.fill(0, WATER_TOP + 1, 4, 0, WATER_TOP + 10, 4, 'stripped_spruce_log[axis=y]');
    b.set(0, WATER_TOP + 11, 4, 'spruce_fence');
    b.set(0, WATER_TOP + 12, 4, 'red_wool');
    b.set(0, WATER_TOP + 12, 5, 'red_wool');
    b.fill(0, WATER_TOP + 4, 5, 0, WATER_TOP + 4, 10, 'spruce_fence');
    b.fill(0, WATER_TOP + 5, 5, 0, WATER_TOP + 5, 9, sail);
    b.fill(0, WATER_TOP + 6, 5, 0, WATER_TOP + 6, 8, 'spruce_fence');
    for (const [a, c] of [[[0, WATER_TOP + 10, 4], [-2, WATER_TOP + 3, 4]], [[0, WATER_TOP + 10, 4], [2, WATER_TOP + 3, 4]], [[0, WATER_TOP + 10, 4], [0, WATER_TOP + 4, 0]]]) {
      for (const [px, py, pz] of linePoints(...a, ...c)) if (b.get(px, py, pz) === 'air') b.set(px, py, pz, 'spruce_fence');
    }
    // Ruder, Ladung, Laterne
    b.fill(0, WATER_TOP - 1, len, 0, WATER_TOP + 1, len, 'spruce_planks');
    b.set(0, WATER_TOP + 2, len, 'spruce_fence');
    b.set(-1, WATER_TOP + 1, 7, 'barrel[facing=up]');
    b.set(1, WATER_TOP + 1, 7, 'composter');
    b.set(1, WATER_TOP + 1, 8, 'composter');
    b.set(-1, WATER_TOP + 1, 9, 'chest[facing=east]');
    b.set(0, WATER_TOP + 1, 2, 'lantern[hanging=false]');
  });
}

function buildBoats(b) {
  rowBoat(b, { x: 11, z: 30, wood: 'oak', seed: 0 });
  rowBoat(b, { x: 3, z: 33, wood: 'spruce', seed: 1 });
  rowBoat(b, { x: 27, z: 29, wood: 'birch', seed: 2 });
  rowBoat(b, { x: 4, z: 60, rotate: 270, wood: 'dark_oak', seed: 4 });
  fishingBoat(b, { x: 16, z: 36 });
  fishingBoat(b, { x: 28, z: 44, hull: 'dark_oak_planks', stripe: 'red_terracotta', cap: 'oak_slab' });
  fishingBoat(b, { x: 47, z: 66, rotate: 270, hull: 'oak_planks', stripe: 'green_terracotta', cap: 'spruce_slab' });
  rowBoat(b, { x: 72, z: 62, rotate: 270, wood: 'spruce', seed: 3 });
}

// ---------------------------------------------------------------- Mole und Leuchtturm

const MOLE = { x1: 112, x2: 119, z1: QUAY_Z + 1, z2: 66 };
const LIGHT = { cx: 116, cz: 72, platform: 7, base: WALK, top: 40 };
// Wellenbrecher im Süden (Steinschüttung mit Weg) und Molenfeuer an seinem Kopf; die Einfahrt liegt zwischen ihm und dem Leuchtturm.
const BREAKWATER = { x1: 0, x2: 86, cz: 77, half: 4 };
const BEACON = { cx: 89, cz: 76 };

const inCircle = (x, z, cx, cz, r) => (x - cx) ** 2 + (z - cz) ** 2 <= (r + 0.5) ** 2;
const inPlatform = (x, z) => inCircle(x, z, LIGHT.cx, LIGHT.cz, LIGHT.platform);
const inMole = (x, z) => (x >= MOLE.x1 && x <= MOLE.x2 && z >= MOLE.z1 && z <= MOLE.z2) || inPlatform(x, z);

function buildMole(b) {
  for (let x = MOLE.x1 - 8; x <= MOLE.x2 + 8; x++) {
    for (let z = MOLE.z1; z < SIZE_Z; z++) {
      if (!inMole(x, z)) continue;
      for (let y = 0; y <= GROUND; y++) b.set(x, y, z, quayStone(x, y, z));
      b.set(x, GROUND, z, pickAt(P.paving, x, GROUND, z, 9));
    }
  }
  // Kanten: polierter Andesit zum Becken, Brüstung zur See.
  for (let z = MOLE.z1; z <= MOLE.z2; z++) {
    b.set(MOLE.x1, GROUND, z, P.cap);
    b.set(MOLE.x2, WALK, z, z % 6 === 0 ? 'chiseled_stone_bricks' : P.stone);
    b.slab(MOLE.x2, WALK + 1, z, 'stone_brick_slab');
  }
  for (let x = LIGHT.cx - LIGHT.platform - 1; x <= LIGHT.cx + LIGHT.platform + 1; x++) {
    for (let z = LIGHT.cz - LIGHT.platform - 1; z <= LIGHT.cz + LIGHT.platform + 1; z++) {
      if (!inPlatform(x, z)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inPlatform(x + dx, z + dz) && !inMole(x + dx, z + dz));
      if (!edge) continue;
      b.set(x, GROUND, z, P.cap);
      if (z > MOLE.z2 + 1 || x > MOLE.x2 || x < MOLE.x1) b.set(x, WALK, z, 'stone_brick_wall');
    }
  }
  // Poller und Leitern an der Beckenseite.
  for (let z = 32; z <= MOLE.z2; z += 9) {
    b.set(MOLE.x1, WALK, z, 'polished_blackstone_wall');
    b.set(MOLE.x1, WALK + 1, z, 'polished_blackstone_button[face=floor,facing=west]');
  }
  for (let y = 1; y <= GROUND; y++) b.set(MOLE.x1 - 1, y, 60, y <= WATER_TOP ? 'ladder[facing=west,waterlogged=true]' : 'ladder[facing=west]');
}

// Steinschüttung vor der Seeseite der Mole und rund um den Molenkopf.
function buildRiprap(b) {
  const stones = [['cobblestone', 4], ['mossy_cobblestone', 3], ['stone', 3], ['andesite', 2], ['tuff', 1], ['mossy_stone_bricks', 1]];
  for (let x = MOLE.x1 - 10; x < SIZE_X; x++) {
    for (let z = MOLE.z1; z < SIZE_Z; z++) {
      if (inMole(x, z)) continue;
      // Abstand zur Mole (Seeseite und Kopf)
      let d = 99;
      if (x > MOLE.x2 && z <= MOLE.z2 + 2) d = x - MOLE.x2;
      const dc = Math.sqrt((x - LIGHT.cx) ** 2 + (z - LIGHT.cz) ** 2) - LIGHT.platform;
      if (z > LIGHT.cz - LIGHT.platform - 6) d = Math.min(d, dc);
      if (d > 4.5 || d <= 0) continue;
      const h = Math.round(WATER_TOP + 1 - d * 1.6 + hash3(x, 0, z, 21) * 2);
      for (let y = 1; y <= h; y++) b.set(x, y, z, pickAt(stones, x, y, z, 22));
    }
  }
}

// Querschnitt des Wellenbrechers: Höhe der Steinschüttung je Abstand zur Mittellinie (Weg oben auf GROUND).
function breakwaterHeight(x, z) {
  const { x1, x2, cz, half } = BREAKWATER;
  const dz = Math.abs(z - cz);
  const headD = Math.max(0, x - x2);
  const d = Math.sqrt(dz * dz + headD * headD);
  if (x < x1 || d > half + 0.5) return -1;
  if (d <= 1.5) return GROUND;
  return Math.round(GROUND - (d - 1.5) * 1.9 + hash3(x, 1, z, 41) * 1.4);
}

function buildBreakwater(b) {
  const stones = [['cobblestone', 4], ['mossy_cobblestone', 4], ['stone', 3], ['andesite', 2], ['tuff', 1], ['mossy_stone_bricks', 1]];
  const { x2, cz, half } = BREAKWATER;
  for (let x = 0; x <= x2 + half + 1; x++) {
    for (let z = cz - half - 1; z <= cz + half + 1; z++) {
      const h = breakwaterHeight(x, z);
      if (h < 0 || z >= SIZE_Z) continue;
      for (let y = 1; y <= h; y++) b.set(x, y, z, pickAt(stones, x, y, z, 42));
      if (h === GROUND) b.set(x, GROUND, z, Math.abs(z - cz) === 0 ? pickAt(P.paving, x, GROUND, z, 43) : 'polished_andesite');
    }
  }
  // Brüstung zur See (Süden) aus Steinziegelmauer, Poller zur Beckenseite.
  for (let x = 0; x <= x2; x++) {
    if (breakwaterHeight(x, cz + 1) === GROUND) b.set(x, WALK, cz + 1, x % 9 === 4 ? 'stone_bricks' : 'stone_brick_wall');
    if (x % 9 === 0) b.set(x, WALK, cz - 1, 'polished_blackstone_wall');
  }
}

// Kleines Molenfeuer: runder Backsteinturm (4 × 4 ohne Ecken) mit rotem Licht.
function buildBeacon(b) {
  const { cx, cz } = BEACON; // Nordwestzelle des 2 × 2-Innenraums
  const ring = (x, z, r) => (x - cx - 0.5) ** 2 + (z - cz - 0.5) ** 2 <= (r + 0.5) ** 2;
  for (let x = cx - 3; x <= cx + 4; x++) {
    for (let z = cz - 3; z <= cz + 4; z++) {
      if (!ring(x, z, 2.5)) continue;
      for (let y = 1; y <= GROUND; y++) b.set(x, y, z, quayStone(x, y, z));
      b.set(x, GROUND, z, ring(x, z, 1.5) ? 'stone_bricks' : P.cap);
    }
  }
  const top = WALK + 8;
  for (let y = WALK; y < top; y++) {
    for (let x = cx - 1; x <= cx + 2; x++) {
      for (let z = cz - 1; z <= cz + 2; z++) {
        if (!ring(x, z, 1.5)) continue;
        const inner = x >= cx && x <= cx + 1 && z >= cz && z <= cz + 1;
        b.set(x, y, z, inner ? 'air' : Math.floor((y - WALK) / 2) % 2 === 1 ? 'white_terracotta' : 'bricks');
      }
    }
  }
  b.door(cx, WALK, cz - 1, 'spruce_door', { facing: 'south', hinge: 'left' });
  b.set(cx + 1, WALK + 4, cz - 1, 'glass_pane');
  b.set(cx, WALK + 4, cz + 2, 'glass_pane');
  // Plattform mit Geländer, rote Laterne mit Licht darunter, Kupferhaube.
  for (let x = cx - 2; x <= cx + 3; x++) {
    for (let z = cz - 2; z <= cz + 3; z++) {
      if (!ring(x, z, 2.5)) continue;
      const edge = !ring(x, z, 1.5);
      if (edge) b.stairs(x, top - 1, z, 'stone_brick_stairs', { facing: Math.abs(x - cx - 0.5) >= Math.abs(z - cz - 0.5) ? (x > cx ? 'west' : 'east') : z > cz ? 'north' : 'south', half: 'top' });
      b.set(x, top, z, edge ? 'polished_andesite' : 'sea_lantern');
      if (edge) b.set(x, top + 1, z, 'iron_bars');
    }
  }
  for (let x = cx; x <= cx + 1; x++) {
    for (let z = cz; z <= cz + 1; z++) {
      b.set(x, top + 1, z, 'red_stained_glass');
      b.set(x, top + 2, z, 'red_stained_glass');
      b.slab(x, top + 3, z, 'waxed_weathered_cut_copper_slab');
    }
  }
  b.set(cx, top + 4, cz, 'waxed_weathered_lightning_rod[facing=up]');
}

function towerRadius(y) {
  return 5 - (1.5 * (y - LIGHT.base)) / (LIGHT.top - LIGHT.base);
}

function inTower(x, y, z) {
  const r = towerRadius(y);
  return (x - LIGHT.cx) ** 2 + (z - LIGHT.cz) ** 2 <= (r + 0.5) ** 2;
}

function towerMaterial(x, y, z) {
  if (y <= LIGHT.base + 2) return y === LIGHT.base ? 'polished_andesite' : P.stone;
  if (y === 18 || y === 19 || y === 29 || y === 30) return 'polished_deepslate';
  if (y === LIGHT.top) return 'polished_deepslate';
  return hash3(x, y, z, 31) < 0.1 ? 'polished_diorite' : 'calcite';
}

// Spiralring um den Kern (Chebyshev-Abstand 2), im Uhrzeigersinn ab der Nordwestecke.
function spiralRing(cx, cz) {
  const cells = [];
  for (let x = cx - 2; x < cx + 2; x++) cells.push([x, cz - 2, 'east']);
  for (let z = cz - 2; z < cz + 2; z++) cells.push([cx + 2, z, 'south']);
  for (let x = cx + 2; x > cx - 2; x--) cells.push([x, cz + 2, 'west']);
  for (let z = cz + 2; z > cz - 2; z--) cells.push([cx - 2, z, 'north']);
  return cells;
}

const spiralCell = (y) => spiralRing(LIGHT.cx, LIGHT.cz)[(((y - (LIGHT.top - 2)) % 16) + 16) % 16];

function buildLighthouseTower(b) {
  const { cx, cz, base, top } = LIGHT;
  for (let y = base; y <= top; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      for (let z = cz - 6; z <= cz + 6; z++) {
        if (!inTower(x, y, z)) continue;
        const wall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inTower(x + dx, y, z + dz));
        b.set(x, y, z, wall ? towerMaterial(x, y, z) : 'air');
      }
    }
  }
  // Kern mit Seelaternen und Boden
  b.fill(cx - 1, base, cz - 1, cx + 1, top, cz + 1, 'stone_bricks');
  const faces = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let y = base + 2, k = 0; y < top; y += 3, k++) {
    const [dx, dz] = faces[k % 4];
    b.set(cx + dx, y, cz + dz, 'sea_lantern');
  }
  for (let x = cx - 4; x <= cx + 4; x++) for (let z = cz - 4; z <= cz + 4; z++) if (inTower(x, base, z) && b.get(x, base, z) === 'air') b.set(x, GROUND, z, 'polished_andesite');
  // Wendeltreppe bis zur Galerie (eine Stufe je Ebene); die letzte Stufe liegt in der Nordseite des Laternenraums.
  for (let y = base; y <= top; y++) {
    const [x, z, facing] = spiralCell(y);
    b.stairs(x, y, z, 'spruce_stairs', { facing });
  }
  // Tür nach Norden zur Mole, Fenster spiralförmig.
  const doorZ = cz - Math.floor(towerRadius(base) + 0.5);
  doorway(b, { x: cx, y: base, z: doorZ, facing: 'north', door: 'spruce_door', frame: 'chiseled_stone_bricks', canopy: 'stone_brick_stairs' });
  for (let zz = doorZ + 1; zz < cz - 2; zz++) {
    b.set(cx, base, zz, 'air');
    b.set(cx, base + 1, zz, 'air');
  }
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (let y = base + 5, k = 0; y < top - 2; y += 4, k++) {
    const [dx, dz] = dirs[k % 4];
    const r = Math.floor(towerRadius(y) + 0.5);
    b.set(cx + dx * r, y, cz + dz * r, 'glass_pane');
    b.set(cx + dx * r, y + 1, cz + dz * r, 'glass_pane');
  }
}

function buildLighthouseTop(b) {
  const { cx, cz, top } = LIGHT;
  const g = top + 1;
  // Galerie auf Konsolen
  for (let x = cx - 6; x <= cx + 6; x++) {
    for (let z = cz - 6; z <= cz + 6; z++) {
      if (!inCircle(x, z, cx, cz, 5)) continue;
      const ring = !inCircle(x, z, cx, cz, 4);
      const dx = x - cx;
      const dz = z - cz;
      const facing = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south';
      if (ring || !inCircle(x, z, cx, cz, 3.5)) b.stairs(x, top, z, 'polished_deepslate_stairs', { facing, half: 'top' });
      b.set(x, g, z, 'smooth_stone');
      if (ring) b.set(x, g + 1, z, 'iron_bars');
    }
  }
  // Treppenausgang: Öffnungen über den obersten Stufen, die letzte Stufe auf Galeriehöhe.
  for (const y of [top - 1, top]) {
    const [x, z] = spiralCell(y);
    b.set(x, g, z, 'air');
  }
  const [ex, ez, ef] = spiralCell(g);
  b.stairs(ex, g, ez, 'spruce_stairs', { facing: ef });
  // Laternenraum: Glas, Leuchtfeuer in der Mitte, Tür zur Galerie.
  b.cylinder(cx, g + 1, cz, 3, 4, 'glass', { hollow: true });
  b.door(cx, g + 1, cz + 3, 'spruce_door', { facing: 'north', hinge: 'left' });
  b.set(cx, g + 1, cz, 'chiseled_stone_bricks');
  b.set(cx, g + 2, cz, 'sea_lantern');
  b.set(cx, g + 3, cz, 'glowstone');
  b.set(cx, g + 4, cz, 'sea_lantern');
  // Kupferkuppel
  const d = g + 5;
  const facingTo = (x, z) => {
    const dx = x - cx;
    const dz = z - cz;
    return Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : dz > 0 ? 'north' : 'south';
  };
  for (let x = cx - 5; x <= cx + 5; x++) {
    for (let z = cz - 5; z <= cz + 5; z++) {
      const rr = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
      if (rr > 4.5) continue;
      if (rr > 3.5) b.slab(x, d, z, 'waxed_oxidized_cut_copper_slab');
      else b.set(x, d, z, 'waxed_oxidized_cut_copper');
      if (rr > 2.5 && rr <= 3.5) b.stairs(x, d + 1, z, 'waxed_oxidized_cut_copper_stairs', { facing: facingTo(x, z) });
      else if (rr <= 2.5) b.set(x, d + 1, z, 'waxed_oxidized_cut_copper');
      if (rr > 1.5 && rr <= 2.5) b.stairs(x, d + 2, z, 'waxed_oxidized_cut_copper_stairs', { facing: facingTo(x, z) });
      else if (rr <= 1.5) b.set(x, d + 2, z, 'waxed_oxidized_cut_copper');
      if (rr > 0.5 && rr <= 1.5) b.stairs(x, d + 3, z, 'waxed_oxidized_cut_copper_stairs', { facing: facingTo(x, z) });
    }
  }
  b.set(cx, d + 3, cz, 'waxed_oxidized_cut_copper');
  b.set(cx, d + 4, cz, 'waxed_oxidized_copper_bulb[lit=true]');
  b.set(cx, d + 5, cz, 'waxed_oxidized_lightning_rod[facing=up]');
}

// ---------------------------------------------------------------- Hafenmeisterei mit Glockenturm

const HM = { x1: 97, x2: 105, z1: 4, z2: 13, tower: { x1: 106, x2: 110, z1: 9, z2: 13 } };

function buildHarbourMaster(b) {
  const { x1, x2, z1, z2 } = HM;
  // Erdgeschoss Stein, Obergeschoss Backstein-Fachwerk, Satteldach mit Gaube.
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      if (x !== x1 && x !== x2 && z !== z1 && z !== z2) continue;
      for (let y = WALK; y <= WALK + 3; y++) {
        const corner = (x === x1 || x === x2) && (z === z1 || z === z2);
        b.set(x, y, z, corner ? 'polished_andesite' : y === WALK ? 'cobblestone' : quayStone(x, y + 20, z));
      }
    }
  }
  const o = { frame: 'stripped_dark_oak_log', fill: 'bricks', pattern: 'diagonal', spacing: 4, height: 4 };
  timberWall(b, { ...o, x: x1, y: 13, z: z2, facing: 'south', length: x2 - x1 + 1 });
  timberWall(b, { ...o, x: x2, y: 13, z: z1, facing: 'north', length: x2 - x1 + 1 });
  timberWall(b, { ...o, x: x1, y: 13, z: z1, facing: 'west', length: z2 - z1 + 1 });
  timberWall(b, { ...o, x: x2, y: 13, z: z2, facing: 'east', length: z2 - z1 + 1 });
  b.fill(x1 + 1, GROUND, z1 + 1, x2 - 1, GROUND, z2 - 1, 'spruce_planks');
  b.fill(x1 + 1, 13, z1 + 1, x2 - 1, 13, z2 - 1, 'spruce_planks');
  b.roof({ x1, z1, x2, z2, y: 17, type: 'gable', axis: 'x', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'bricks', overhang: 1 });
  dormer(b, { x: 101, y: 17, z: z2, facing: 'south', wall: 'bricks', corner: 'stripped_dark_oak_log', stairs: 'deepslate_tile_stairs' });
  chimney(b, { x: 103, y: 14, z: 6, facing: 'south', height: 11, block: 'bricks', rim: 'brick_stairs' });
  // Fenster und Tür
  doorway(b, { x: 101, y: WALK, z: z2, facing: 'south', door: 'spruce_door', frame: 'stripped_dark_oak_log', canopy: 'deepslate_tile_stairs' });
  for (const x of [99, 103]) window(b, { x, y: WALK + 1, z: z2, facing: 'south', style: 'framed', frame: 'stripped_dark_oak_log', shutters: 'spruce_trapdoor' });
  for (const x of [99, 101, 103]) window(b, { x, y: 14, z: z2, facing: 'south', flowerBox: true });
  for (const x of [99, 103]) {
    window(b, { x, y: WALK + 1, z: z1, facing: 'north', style: 'framed', frame: 'stripped_dark_oak_log' });
    window(b, { x, y: 14, z: z1, facing: 'north' });
  }
  for (const z of [7, 10]) {
    window(b, { x: x1, y: WALK + 1, z, facing: 'west', style: 'framed', frame: 'stripped_dark_oak_log', shutters: 'spruce_trapdoor' });
    window(b, { x: x1, y: 14, z, facing: 'west', flowerBox: true });
  }
  // Einrichtung: Kontor unten, Stube oben, Treppe an der Nordwand.
  for (let k = 0; k < 4; k++) b.stairs(x2 - 1 - k, WALK + k, z1 + 1, 'spruce_stairs', { facing: 'west' });
  for (const x of [x2 - 3, x2 - 4]) b.set(x, 13, z1 + 1, 'air');
  b.set(x1 + 1, WALK, z1 + 2, 'cartography_table');
  b.set(x1 + 1, WALK, z1 + 3, 'lectern[facing=east]');
  b.stairs(x1 + 2, WALK, z1 + 2, 'spruce_stairs', { facing: 'east' });
  bookWall(b, { x: x1 + 1, y: WALK, z: z2 - 1, facing: 'north', width: 3, height: 3, wood: 'schwarzeiche', chiseled: true, crown: false });
  b.set(x2 - 1, WALK, z2 - 1, 'chest[facing=west]');
  b.set(x2 - 2, WALK, z2 - 1, 'barrel[facing=north]');
  bedroom(b, { x: x1 + 1, y: 14, z: z1 + 2, facing: 'south', width: 4, depth: 4, wood: 'schwarzeiche', color: 'blau', rug: 'weiss' });
  lightRoom(b, { x1: x1 + 1, y1: WALK, z1: z1 + 1, x2: x2 - 1, y2: 12, z2: z2 - 1 });
  lightRoom(b, { x1: x1 + 1, y1: 14, z1: z1 + 1, x2: x2 - 1, y2: 16, z2: z2 - 1 });
}

function buildBellTower(b) {
  const { x1, x2, z1, z2 } = HM.tower;
  const top = 24;
  for (let y = WALK; y <= top; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        const edge = x === x1 || x === x2 || z === z1 || z === z2;
        const corner = (x === x1 || x === x2) && (z === z1 || z === z2);
        if (edge) b.set(x, y, z, corner ? 'polished_andesite' : y === 20 || y === WALK ? 'polished_andesite' : quayStone(x, y + 30, z));
        else b.set(x, y, z, 'air');
      }
    }
  }
  for (const y of [13, 17, 21]) b.fill(x1 + 1, y, z1 + 1, x2 - 1, y, z2 - 1, 'spruce_planks');
  b.fill(x1 + 1, top, z1 + 1, x2 - 1, top, z2 - 1, 'spruce_planks');
  // Glockenstube: Bogenöffnungen auf allen Seiten, Glocke unter der Decke.
  for (const z of [z1, z2]) {
    for (let x = x1 + 1; x <= x2 - 1; x++) b.set(x, 22, z, 'air');
    b.set(x1 + 2, 23, z, 'air');
    b.stairs(x1 + 1, 23, z, 'stone_brick_stairs', { facing: 'west', half: 'top' });
    b.stairs(x2 - 1, 23, z, 'stone_brick_stairs', { facing: 'east', half: 'top' });
  }
  for (const x of [x1, x2]) {
    for (let z = z1 + 1; z <= z2 - 1; z++) b.set(x, 22, z, 'air');
    b.set(x, 23, z1 + 2, 'air');
    b.stairs(x, 23, z1 + 1, 'stone_brick_stairs', { facing: 'north', half: 'top' });
    b.stairs(x, 23, z2 - 1, 'stone_brick_stairs', { facing: 'south', half: 'top' });
  }
  for (let x = x1 + 1; x <= x2 - 1; x++) for (const z of [z1, z2]) b.stairs(x, 21, z + (z === z1 ? -1 : 1), 'stone_brick_stairs', { facing: z === z1 ? 'south' : 'north', half: 'top' });
  b.set(108, 23, 11, 'bell[attachment=ceiling,facing=north]');
  // Rundfenster an der Front, Leiter innen an der Nordwand.
  window(b, { x: 108, y: 17, z: z2, facing: 'south', style: 'round', width: 3, height: 3, stairs: 'stone_brick_stairs' });
  for (let y = WALK; y <= 21; y++) b.set(108, y, z1 + 1, 'ladder[facing=south]');
  b.door(x1, WALK, 11, 'spruce_door', { facing: 'east', hinge: 'left' });
  b.set(HM.x2, WALK, 11, 'air');
  b.set(HM.x2, WALK + 1, 11, 'air');
  b.roof({ x1, z1, x2, z2, y: top + 1, type: 'pyramid', stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'deepslate_tiles', overhang: 1 });
  b.set(108, top + 5, 11, 'dark_oak_fence');
  b.set(108, top + 6, 11, 'lightning_rod[facing=up]');
  for (const y of [WALK, 14, 18]) b.set(109, y, 12, 'lantern[hanging=false]');
}

// ---------------------------------------------------------------- Fischhalle und Hafenschänke

function buildFishHall(b) {
  const x1 = 3;
  const x2 = 19;
  const z1 = 4;
  const z2 = 12;
  floorPattern(b, { x: x1, y: GROUND, z: z1, facing: 'south', width: x2 - x1 + 1, depth: z2 - z1 + 1, pattern: 'checker',
    blocks: ['polished_andesite', 'stone_bricks'] });
  for (let x = x1; x <= x2; x += 4) {
    for (const z of [z1, z2]) {
      b.fill(x, WALK, z, x, WALK + 3, z, 'stripped_spruce_log[axis=y]');
      b.set(x, WALK, z, 'stone_bricks');
      for (const [dx, facing] of [[-1, 'east'], [1, 'west']]) {
        if (x + dx >= x1 && x + dx <= x2) b.stairs(x + dx, WALK + 3, z, 'spruce_stairs', { facing, half: 'top' });
      }
    }
  }
  for (const z of [z1, z2]) b.fill(x1, WALK + 4, z, x2, WALK + 4, z, 'stripped_spruce_log[axis=x]');
  for (const x of [x1, x2]) b.fill(x, WALK + 4, z1 + 1, x, WALK + 4, z2 - 1, 'stripped_spruce_log[axis=z]');
  for (let x = x1 + 4; x < x2; x += 4) b.fill(x, WALK + 4, z1 + 1, x, WALK + 4, z2 - 1, 'stripped_spruce_log[axis=z]');
  b.roof({ x1, z1, x2, z2, y: WALK + 5, type: 'gable', axis: 'x', stairs: 'spruce_stairs', slab: 'spruce_slab', full: 'spruce_planks', overhang: 1 });
  // Verkaufstische: Fässer mit Platten, Räucheröfen, Wasserkessel.
  for (let x = x1 + 2; x <= x2 - 2; x += 4) {
    for (const z of [z1 + 3, z2 - 3]) {
      b.set(x, WALK, z, 'barrel[facing=up]');
      b.slab(x + 1, WALK, z, 'spruce_slab', { type: 'top' });
      b.set(x + 1, WALK + 1, z, x % 8 === 5 ? 'dried_kelp_block' : 'cauldron');
      b.set(x, WALK + 1, z, 'composter');
    }
  }
  for (let x = x1 + 4; x < x2; x += 4) hangingLantern(b, { x, y: WALK + 3, z: 8, chain: 0 });
  b.set(x1 + 1, WALK, z2 - 1, 'smoker[facing=north]');
  b.set(x1 + 2, WALK, z2 - 1, 'smoker[facing=north]');
  b.set(x2 - 1, WALK, z1 + 1, 'hay_block[axis=x]');
  b.set(x2 - 1, WALK, z1 + 2, 'barrel[facing=up]');
  b.set(x2 - 2, WALK, z1 + 1, 'barrel[facing=up]');
}

function buildTavern(b) {
  const x1 = 22;
  const x2 = 32;
  const z1 = 4;
  const z2 = 12;
  b.walls(x1, WALK, z1, x2, WALK + 3, z2, 'stone_bricks');
  for (let x = x1; x <= x2; x++) for (const z of [z1, z2]) b.set(x, WALK, z, 'cobblestone');
  for (let z = z1; z <= z2; z++) for (const x of [x1, x2]) b.set(x, WALK, z, 'cobblestone');
  // Obergeschoss kragt nach Süden um eine Reihe vor.
  const zt = z2 + 1;
  const o = { frame: 'stripped_spruce_log', fill: 'white_terracotta', pattern: 'cross', spacing: 5, height: 4 };
  b.fill(x1, 13, z1, x2, 13, zt, 'spruce_planks');
  timberWall(b, { ...o, x: x1, y: 13, z: zt, facing: 'south', length: x2 - x1 + 1 });
  timberWall(b, { ...o, x: x2, y: 13, z: z1, facing: 'north', length: x2 - x1 + 1 });
  timberWall(b, { ...o, x: x1, y: 13, z: z1, facing: 'west', length: zt - z1 + 1 });
  timberWall(b, { ...o, x: x2, y: 13, z: zt, facing: 'east', length: zt - z1 + 1 });
  for (let x = x1; x <= x2; x += 2) b.stairs(x, 12, zt, 'spruce_stairs', { facing: 'north', half: 'top' });
  b.roof({ x1, z1, x2, z2: zt, y: 17, type: 'gable', axis: 'x', stairs: 'spruce_stairs', slab: 'spruce_slab', full: 'white_terracotta', overhang: 1 });
  chimney(b, { x: x2 - 2, y: 13, z: z1 + 2, facing: 'south', height: 11, block: 'cobblestone', rim: 'cobblestone_stairs' });
  b.fill(x1 + 1, GROUND, z1 + 1, x2 - 1, GROUND, z2 - 1, 'spruce_planks');
  doorway(b, { x: 27, y: WALK, z: z2, facing: 'south', door: 'spruce_door', width: 2, frame: 'stripped_spruce_log' });
  for (const x of [24, 30]) window(b, { x, y: WALK + 1, z: z2, facing: 'south', style: 'framed', shutters: 'spruce_trapdoor' });
  for (const x of [24, 27, 30]) window(b, { x, y: 14, z: zt, facing: 'south', flowerBox: true });
  for (const z of [7, 10]) {
    window(b, { x: x1, y: WALK + 1, z, facing: 'west', style: 'framed' });
    window(b, { x: x2, y: WALK + 1, z, facing: 'east', style: 'framed' });
  }
  // Schankraum: Theke, Fässer, Tische, Kamin.
  for (let x = x1 + 1; x <= x1 + 5; x++) b.slab(x, WALK, z1 + 3, 'spruce_slab', { type: 'top' });
  for (let x = x1 + 1; x <= x1 + 5; x++) b.set(x, WALK, z1 + 1, 'barrel[facing=south]');
  for (let x = x1 + 1; x <= x1 + 3; x++) b.set(x, WALK + 1, z1 + 1, 'barrel[facing=south]');
  diningTable(b, { x: x1 + 3, y: WALK, z: z2 - 3, facing: 'south', length: 2, width: 1, wood: 'fichte', headChairs: false });
  diningTable(b, { x: x2 - 4, y: WALK, z: z2 - 3, facing: 'south', length: 2, width: 1, wood: 'fichte' });
  fireplace(b, { x: x2 - 2, y: WALK, z: z1 + 1, facing: 'south', height: 4, block: 'cobblestone' });
  for (let k = 0; k < 4; k++) b.stairs(x1 + 1, WALK + k, z2 - 2 - k, 'spruce_stairs', { facing: 'north' });
  for (const z of [z2 - 4, z2 - 5]) b.set(x1 + 1, 13, z, 'air');
  bedroom(b, { x: x1 + 4, y: 14, z: z1 + 1, facing: 'south', width: 4, depth: 4, wood: 'fichte', color: 'gruen' });
  lightRoom(b, { x1: x1 + 1, y1: WALK, z1: z1 + 1, x2: x2 - 1, y2: 12, z2: z2 - 1 });
  lightRoom(b, { x1: x1 + 1, y1: 14, z1: z1 + 1, x2: x2 - 1, y2: 16, z2: zt - 1 });
  // Ausleger mit Laterne als Wirtshauszeichen.
  b.fill(x1 - 1, 15, zt, x1 - 2, 15, zt, 'spruce_fence');
  b.set(x1 - 2, 14, zt, 'lantern[hanging=true]');
}

// ---------------------------------------------------------------- Umgebung an Land

function buildLandscape(b) {
  // Bäume und Büsche im Osten, Blumen hinter den Speichern.
  tree(b, { x: 120, y: WALK, z: 6, species: 'eiche', size: 'mittel', seed: 3 });
  tree(b, { x: 124, y: WALK, z: 12, species: 'birke', size: 'mittel', seed: 4 });
  tree(b, { x: 113, y: WALK, z: 4, species: 'fichte', size: 'mittel', seed: 5 });
  bush(b, { x: 114, y: WALK, z: 11, size: 'mittel', leaves: 'azalee', seed: 1 });
  bush(b, { x: 125, y: WALK, z: 2, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: 1, y: WALK, z: 6, size: 'klein', leaves: 'eiche', seed: 4 });
  rock(b, { x: 118, y: GROUND, z: 12, size: 'klein', material: 'andesit', seed: 2 });
  vegetation(b, { x: 111, y: WALK, z: 0, width: 17, depth: 14, mix: 'wiese', density: 0.35, seed: 8 });
  vegetation(b, { x: 34, y: WALK, z: 0, width: 62, depth: 2, mix: 'blumen', density: 0.3, seed: 9 });
  vegetation(b, { x: 0, y: WALK, z: 0, width: 3, depth: 14, mix: 'wiese', density: 0.4, seed: 10 });
  // Hecke am Nordrand hinter den Speichern, Lücken an den Hintertüren.
  const doors = WAREHOUSES.map((w) => w.x1 + 6);
  for (let x = 34; x <= 96; x++) {
    if (doors.some((d) => Math.abs(x - d) <= 1)) continue;
    b.set(x, WALK, 0, hash3(x, 0, 0, 71) < 0.3 ? 'spruce_leaves' : 'oak_leaves');
    if (hash3(x, 1, 0, 72) < 0.25) b.set(x, WALK + 1, 0, 'oak_leaves');
  }
}

// Marktstand 3 × 3 (x … x + 2, z … z + 2): Theke zur Straße (Norden), gestreiftes Dach auf Zaunpfosten.
function marketStall(b, x, z, colors, goods) {
  for (const [dx, dz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) b.fill(x + dx, WALK, z + dz, x + dx, WALK + 2, z + dz, 'spruce_fence');
  for (let dx = 0; dx <= 2; dx++) {
    for (let dz = -1; dz <= 2; dz++) b.set(x + dx, WALK + 3, z + dz, colors[dx % 2]);
    b.slab(x + dx, WALK, z, 'spruce_slab', { type: 'top' });
    b.set(x + dx, WALK + 1, z, goods[dx]);
  }
  for (let dx = 0; dx <= 2; dx++) b.stairs(x + dx, WALK + 2, z - 1, 'spruce_stairs', { facing: 'south', half: 'top' });
  b.set(x + 1, WALK, z + 2, 'barrel[facing=up]');
  b.set(x + 1, WALK + 2, z + 1, 'lantern[hanging=true]');
}

// Handkarren längs x: Ladefläche aus oberen Stufen, Räder aus offenen Falltüren, Deichsel nach Westen.
function handcart(b, x, z) {
  for (let dx = 0; dx <= 2; dx++) b.slab(x + dx, WALK, z, 'spruce_slab', { type: 'top' });
  b.set(x + 1, WALK, z - 1, 'dark_oak_trapdoor[facing=north,half=bottom,open=true]');
  b.set(x + 1, WALK, z + 1, 'dark_oak_trapdoor[facing=south,half=bottom,open=true]');
  b.set(x - 1, WALK, z, 'spruce_fence');
  b.set(x, WALK + 1, z, 'barrel[facing=up]');
  b.set(x + 1, WALK + 1, z, 'barrel[facing=east]');
  b.set(x + 2, WALK + 1, z, 'hay_block[axis=x]');
}

function buildStreetLife(b) {
  for (const x of [2, 15, 28, 41, 53, 71, 84, 96, 108, 121]) {
    lampPost(b, { x, y: WALK, z: 20, facing: 'south', height: 3, post: 'dark_oak_fence', base: 'polished_andesite' });
  }
  // Ladung auf dem Kai
  const cargo = [
    [40, 22, 'barrel[facing=up]', 2], [41, 22, 'barrel[facing=up]', 1], [40, 23, 'barrel[facing=north]', 1], [42, 22, 'hay_block[axis=x]', 1],
    [48, 22, 'composter', 2], [49, 22, 'composter', 1], [48, 23, 'composter', 1],
    [76, 22, 'barrel[facing=up]', 1], [77, 22, 'barrel[facing=up]', 2], [78, 22, 'chest[facing=south]', 1], [77, 23, 'barrel[facing=east]', 1],
    [92, 22, 'hay_block[axis=y]', 2], [93, 22, 'hay_block[axis=z]', 1], [92, 23, 'composter', 1],
    [104, 22, 'barrel[facing=up]', 1], [105, 22, 'barrel[facing=up]', 1], [104, 23, 'barrel[facing=up]', 1],
    [68, 22, 'composter', 2], [69, 22, 'barrel[facing=up]', 1], [68, 23, 'barrel[facing=north]', 1],
  ];
  for (const [x, z, state, h] of cargo) for (let k = 0; k < h; k++) b.set(x, WALK + k, z, state);
  // Marktstände am Kai vor der Fischhalle, Handkarren vor dem ersten Speicher.
  marketStall(b, 1, 21, ['blue_wool', 'white_wool'], ['barrel[facing=up]', 'water_cauldron[level=3]', 'dried_kelp_block']);
  marketStall(b, 7, 21, ['red_wool', 'white_wool'], ['melon', 'pumpkin', 'hay_block[axis=x]']);
  marketStall(b, 13, 21, ['green_wool', 'yellow_wool'], ['barrel[facing=up]', 'composter', 'cake']);
  handcart(b, 44, 16);
  handcart(b, 88, 17);
  // Bänke vor der Schänke und der Hafenmeisterei
  for (const x of [23, 24, 30, 31, 98, 99]) b.stairs(x, WALK, 15, 'spruce_stairs', { facing: 'north' });
}

// ---------------------------------------------------------------- Kogge vor Anker

// Kogge: u = Länge (0 = Achtersteven), v = quer, y = Welt-y. Gerade, geneigte Steven, hohes Achterkastell.
// Gebaut in lokalen Koordinaten (x = u, z = v) und mit b.transform um 90° gedreht: Bug nach Süden zur Hafeneinfahrt.
// Welt: x = ox − v, z = oz + u.
const COG = { ox: 100, oz: 46, len: 30, deck: 9, castle: 12, fore: 11, mast: 15 };
const COG_FRAME = { offset: [COG.ox, 0, COG.oz], rotate: 90 };
const COG_HALF = [0, 0, 1.4, 2.8, 3.6, 4.1, 4.4, 4.5, 4.6, 4.6, 4.6, 4.5, 4.4, 4.3];

function cogTop(u) {
  if (u <= 7) return COG.castle + 1;
  if (u >= 24) return COG.fore + 1;
  return COG.deck + 2;
}

function cogHalf(u, y) {
  if (y < 2 || y > cogTop(Math.max(0, u))) return -1;
  const bow = COG.len - 1 - (13 - y) * 0.5;
  const stern = (13 - y) * 0.3;
  if (u > bow + 0.5 || u < stern - 0.5) return -1;
  const f = Math.max(0, Math.min(1, (bow - u) / 8, (u - stern) / 6));
  return COG_HALF[y] * Math.sqrt(f);
}

const inCog = (u, v, y) => {
  const h = cogHalf(u, y);
  return h >= 0 && Math.abs(v) <= h + 0.3;
};
const cogShell = (u, v, y) => inCog(u, v, y)
  && (!inCog(u + 1, v, y) || !inCog(u - 1, v, y) || !inCog(u, v + 1, y) || !inCog(u, v - 1, y) || !inCog(u, v, y - 1));
const cset = (b, u, y, v, state) => b.set(u, y, v, state);
const cget = (b, u, y, v) => b.get(u, y, v);
const cogSide = (u, y) => Math.floor(cogHalf(u, y) + 0.3);

function cogDecks(u) {
  const levels = [3, COG.deck];
  if (u <= 7) levels.push(COG.castle);
  if (u >= 24) levels.push(COG.fore);
  return levels;
}

function buildCogHull(b) {
  b.transform(COG_FRAME, () => cogHullLocal(b));
}

function cogHullLocal(b) {
  for (let u = -1; u <= COG.len; u++) {
    for (let v = -6; v <= 6; v++) {
      for (let y = 2; y <= 14; y++) {
        if (!inCog(u, v, y)) continue;
        const top = cogTop(Math.max(0, u));
        if (cogShell(u, v, y)) {
          let state = y <= 5 ? 'spruce_planks' : y % 3 === 1 ? 'stripped_oak_log[axis=x]' : 'oak_planks';
          if (y === top) state = (u + v) % 2 === 0 || u > 7 ? 'stripped_spruce_log[axis=x]' : 'spruce_fence';
          cset(b, u, y, v, state);
        } else if (y < 3) {
          cset(b, u, y, v, 'gravel');
        } else if (cogDecks(u).includes(y)) {
          cset(b, u, y, v, y === 3 ? 'spruce_planks' : Math.abs(v) % 2 === 0 ? 'oak_planks' : 'birch_planks');
        }
      }
    }
  }
  // Schott des Achterkastells mit Tür, Kastellgeländer vorne, Vorderkastell-Kante.
  for (let y = COG.deck + 1; y < COG.castle; y++) {
    const s = cogSide(7, y);
    for (let v = -s + 1; v <= s - 1; v++) cset(b, 7, y, v, Math.abs(v) === 2 ? 'stripped_oak_log[axis=y]' : 'oak_planks');
  }
  b.door(7, COG.deck + 1, 0, 'oak_door', { facing: 'west', hinge: 'left' });
  for (const v of [-2, 2]) cset(b, 7, COG.deck + 2, v, 'glass_pane');
  {
    const s = cogSide(7, COG.castle + 1);
    for (let v = -s + 1; v <= s - 1; v++) cset(b, 7, COG.castle + 1, v, v === 3 ? 'air' : 'oak_fence');
    const sf = cogSide(24, COG.fore + 1);
    for (let v = -sf + 1; v <= sf - 1; v++) cset(b, 24, COG.fore + 1, v, v === -2 ? 'air' : 'oak_fence');
  }
  // Treppen: Deck → Achterkastell, Deck → Vorderkastell; Luke mit Leiter in den Laderaum.
  b.stairs(9, COG.deck + 1, 3, 'oak_stairs', { facing: 'west' });
  b.stairs(8, COG.deck + 2, 3, 'oak_stairs', { facing: 'west' });
  b.stairs(23, COG.deck + 1, -2, 'oak_stairs', { facing: 'east' });
  for (let u = 11; u <= 13; u++) for (let v = -1; v <= 1; v++) cset(b, u, COG.deck, v, v === 1 && u === 11 ? 'air' : 'oak_trapdoor[facing=north,half=top]');
  for (let y = 4; y <= COG.deck; y++) cset(b, 11, y, 1, 'ladder[facing=east]');
  cset(b, 10, 4, 1, 'oak_planks');
  for (let y = 5; y <= COG.deck - 1; y++) cset(b, 10, y, 1, 'oak_planks');
  // Ruder am Achtersteven mit Pinne.
  for (let y = 2; y <= COG.castle; y++) {
    let u = -1;
    while (u < 10 && !inCog(u, 0, y)) u++;
    cset(b, u - 1, y, 0, y >= COG.deck ? 'stripped_spruce_log[axis=y]' : 'spruce_planks');
  }
  // Ladung im Raum, Kajüte im Kastell
  for (let u = 13; u <= 21; u++) {
    for (const v of [-3, -2, 2, 3]) {
      if (!inCog(u, v, 4) || cogShell(u, v, 4)) continue;
      const h = 1 + Math.floor(hash3(u, 4, v, 51) * 3);
      for (let k = 0; k < h; k++) if (cget(b, u, 4 + k, v) === 'air') cset(b, u, 4 + k, v, ['barrel[facing=up]', 'white_wool', 'hay_block[axis=x]', 'brown_wool'][Math.floor(hash3(u, k, v, 52) * 4)]);
    }
  }
  b.bed(2, COG.deck + 1, -2, 'blue_bed', { facing: 'west' });
  cset(b, 2, COG.deck + 1, 2, 'chest[facing=east]');
  cset(b, 5, COG.deck + 1, -2, 'barrel[facing=up]');
  cset(b, 5, COG.deck + 1, 2, 'cartography_table');
  lightRoom(b, { x1: 1, y1: COG.deck + 1, z1: -3, x2: 6, y2: COG.castle - 1, z2: 3 }, { mode: 'floor' });
  lightRoom(b, { x1: 8, y1: 4, z1: -3, x2: 22, y2: COG.deck - 1, z2: 3 }, { mode: 'ceiling', chain: 0 });
}

function buildCogRig(b) {
  b.transform(COG_FRAME, () => cogRigLocal(b));
}

function cogRigLocal(b) {
  const m = COG.mast;
  for (let y = 4; y <= 31; y++) cset(b, m, y, 0, 'stripped_spruce_log[axis=y]');
  // Mastkorb
  for (let du = -1; du <= 1; du++) for (let dv = -1; dv <= 1; dv++) {
    if (du === 0 && dv === 0) continue;
    cset(b, m + du, 26, dv, 'spruce_slab[type=top]');
    cset(b, m + du, 27, dv, 'spruce_fence');
  }
  for (const [du, dv, facing] of [[1, 0, 'west'], [-1, 0, 'east'], [0, 1, 'north'], [0, -1, 'south']]) b.stairs(m + du, 25, dv, 'spruce_stairs', { facing, half: 'top' });
  // Rah und gestreiftes Rahsegel (Bauch nach vorne)
  for (let v = -8; v <= 8; v++) cset(b, m + 1, 24, v, Math.abs(v) > 6 ? 'spruce_fence' : 'stripped_spruce_log[axis=z]');
  const rows = 10;
  const d = new Map();
  for (let y = 23; y >= 13; y--) {
    const t = (23 - y) / rows;
    const hw = Math.round(7 + 2 * t);
    for (let v = -hw; v <= hw; v++) d.set(`${y},${v}`, Math.round(2.6 * (0.3 + 0.7 * 4 * t * (1 - t)) * (1 - (v / (hw + 1)) ** 2)));
  }
  for (const [k, dd] of d) {
    const [y, v] = k.split(',').map(Number);
    let lo = dd;
    for (const n of [`${y + 1},${v}`, `${y - 1},${v}`, `${y},${v + 1}`, `${y},${v - 1}`]) if (d.has(n)) lo = Math.min(lo, d.get(n));
    const state = Math.floor((v + 9) / 2) % 2 === 0 ? 'red_wool' : 'white_wool';
    for (let du = lo; du <= dd; du++) if (cget(b, m + 1 + du, y, v) === 'air') cset(b, m + 1 + du, y, v, state);
  }
  // Wanten, Stage, Wimpel
  for (const side of [-1, 1]) {
    for (const du of [-1, 0, 1]) {
      const v = side * (cogSide(m + du - 1, COG.deck + 2) + 1);
      rope(b, [m + du, 25, side], [m + du - 1, COG.deck + 2, v]);
      cset(b, m + du - 1, COG.deck + 1, v, 'oak_slab[type=top]');
    }
  }
  rope(b, [m + 1, 26, 0], [COG.len - 1, COG.fore + 2, 0]);
  rope(b, [m - 1, 26, 0], [1, COG.castle + 2, 0]);
  cset(b, m, 32, 0, 'spruce_fence');
  for (let du = 1; du <= 4; du++) cset(b, m + du, 32, 0, du % 2 ? 'red_wool' : 'white_wool');
  for (let du = 1; du <= 2; du++) cset(b, m + du, 31, 0, 'red_wool');
  // Ankertau vom Bug ins Wasser, Laterne am Heck.
  const ax = COG.len - 3;
  const av = -cogSide(ax, COG.fore) - 1;
  for (let y = 2; y <= COG.fore; y++) cset(b, ax, y, av, 'iron_chain[axis=y]');
  cset(b, ax, 1, av, 'anvil[facing=east]');
  cset(b, 0, COG.castle + 2, 0, 'spruce_fence');
  cset(b, 0, COG.castle + 3, 0, 'lantern[hanging=false]');
}

export default function build(b) {
  b.phase('Gelände und Kaimauer');
  b.step();
  buildLand(b);
  b.step();
  buildQuayWall(b);
  b.step();
  buildSeabed(b);

  b.phase('Straße und Kai');
  b.step();
  buildStreet(b);
  b.step();
  buildBollards(b);
  b.step();
  buildQuayStairs(b);

  b.phase('Speicher');
  for (const w of WAREHOUSES) {
    b.step();
    buildWarehouse(b, w);
  }

  b.phase('Speicher: Böden und Waren');
  for (const w of WAREHOUSES) {
    b.step();
    warehouseInterior(b, w);
  }

  b.phase('Tretradkran');
  b.step();
  buildCraneBase(b);
  b.step();
  buildCraneHouse(b);
  b.step();
  buildTreadwheels(b);
  b.step();
  buildCraneJib(b);

  b.phase('Holzstege');
  b.step();
  buildPiers(b);
  b.step();
  buildPierCrane(b);

  b.phase('Boote');
  b.step();
  buildBoats(b);

  b.phase('Mole');
  b.step();
  buildMole(b);
  b.step();
  buildRiprap(b);

  b.phase('Wellenbrecher und Molenfeuer');
  b.step();
  buildBreakwater(b);
  b.step();
  buildBeacon(b);

  b.phase('Leuchtturm');
  b.step();
  buildLighthouseTower(b);
  b.step();
  buildLighthouseTop(b);

  b.phase('Hafenmeisterei');
  b.step();
  buildHarbourMaster(b);
  b.step();
  buildBellTower(b);

  b.phase('Fischhalle und Hafenschänke');
  b.step();
  buildFishHall(b);
  b.step();
  buildTavern(b);

  b.phase('Grün, Laternen und Ladung');
  b.step();
  buildLandscape(b);
  b.step();
  buildStreetLife(b);

  b.phase('Galeone: Rumpf');
  b.step();
  buildHull(b);

  b.phase('Galeone: Decks und Aufbauten');
  b.step();
  buildBreaks(b);
  b.step();
  buildCastleRails(b);
  b.step();
  buildHatches(b);

  b.phase('Galeone: Pforten, Heck und Bug');
  b.step();
  buildGunPorts(b);
  b.step();
  buildStern(b);
  b.step();
  buildQuarterGalleries(b);
  b.step();
  buildBow(b);

  b.phase('Galeone: Laderaum und Batteriedeck');
  b.step();
  buildHold(b);
  b.step();
  buildGunDeck(b);

  b.phase('Galeone: Kajüten');
  b.step();
  buildCabins(b);

  b.phase('Galeone: Deck');
  b.step();
  buildDeckDetails(b);

  b.phase('Galeone: Masten');
  b.step();
  buildMasts(b);

  b.phase('Galeone: Rahen und Segel');
  b.step();
  buildYardsAndSails(b);

  b.phase('Galeone: Takelage');
  b.step();
  buildRigging(b);

  b.phase('Kogge vor Anker');
  b.step();
  buildCogHull(b);
  b.step();
  buildCogRig(b);

  b.phase('Gangway und Festmacher');
  b.step();
  buildGangway(b);

  b.phase('Hafenbecken');
  b.step();
  buildWater(b);

  assertLit(b);
}
