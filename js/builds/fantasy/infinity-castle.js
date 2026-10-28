// Infinity Castle (無限城) – nachempfundener Atrium-Schacht nach docs/recherche/infinity-castle.md (Module M1–M12).
// Der Builder kann nur um y drehen und in x/z spiegeln; kopfstehende und gekippte Teile rechnet makeFrame() selbst um.

import { parseState, formatState } from '../../core/blockstate.js';

export const meta = {
  id: 'infinity-castle',
  title: 'Infinity Castle',
  category: 'fantasy',
  subtitle: 'Muzans Festung aus „Demon Slayer: Kimetsu no Yaiba“ als Schacht mit 19 Galerie-Geschossen',
  tags: ['Anime', 'Japan', 'Demon Slayer', 'Riesig', 'Innenraum', 'Holz'],
  aliases: [
    'infinity castle', 'unendliche festung', 'unendliche burg', 'mugen-jo', 'mugenjo', 'mugen jo', 'mugen-jō', '無限城',
    'demon slayer burg', 'demon slayer festung', 'demon slayer', 'kimetsu no yaiba', 'kimetsu no yaiba burg',
    'nakime', 'muzan', 'akaza', 'doma', 'kokushibo',
    'infinity-castle', 'infinitycastle', 'infinty castle', 'infinity castel', 'demonslayer', 'kimetsu', 'dämonenjäger',
  ],
  accuracy: 'nachempfunden',
  description: 'Nachempfundener Ausschnitt der Anderraum-Festung aus „Demon Slayer: Kimetsu no Yaiba“: ein 193 Blöcke tiefer '
    + 'Schacht mit Säulenhalle und Wasserspiegel am Grund, 19 Galerie-Geschossen aus Schwarzeiche mit Fusuma und leuchtenden '
    + 'Shoji, Brücken und Treppen in alle Richtungen, kopfstehenden und gekippten Räumen, vier Kampfstätten und Nakimes '
    + 'schwebender Bühne. Belegt sind nur die Grundzüge (endlose Holzräume, Gänge, Treppen, Lampenlicht, Dunkelheit, '
    + 'Säulen-Labyrinth, Wassergarten, Figuren kopfüber an Wänden); Grundriss, Maße, Tatami, Schiebetüren und die Gestaltung '
    + 'der Kampfstätten sind eigene Interpretation – die Burg hat im Werk weder Bauplan noch Außenansicht.',
  sources: [
    { title: 'Kimetsu no Yaiba – offizielle Seite, Film „無限城編“: Einführung', url: 'https://kimetsu.com/anime/mugenjyohen_movie/intro/' },
    { title: 'Kimetsu no Yaiba – offizielle Seite, Film „無限城編“: Staff/Cast', url: 'https://kimetsu.com/anime/mugenjyohen_movie/staffcast/' },
    { title: 'Kimetsu no Yaiba – offizielle Seite, Film „無限城編“: Figuren', url: 'https://kimetsu.com/anime/mugenjyohen_movie/character/' },
    { title: 'Wikipedia (ja): 鬼滅の刃', url: 'https://ja.wikipedia.org/wiki/%E9%AC%BC%E6%BB%85%E3%81%AE%E5%88%83' },
    { title: 'Wikipedia (ja): 劇場版「鬼滅の刃」無限城編', url: 'https://ja.wikipedia.org/wiki/%E5%8A%87%E5%A0%B4%E7%89%88_%E9%AC%BC%E6%BB%85%E3%81%AE%E5%88%83_%E7%84%A1%E9%99%90%E5%9F%8E%E7%B7%A8' },
    { title: 'Wikipedia (en): Demon Slayer: Kimetsu no Yaiba – The Movie: Infinity Castle', url: 'https://en.wikipedia.org/wiki/Demon_Slayer:_Kimetsu_no_Yaiba_%E2%80%93_The_Movie:_Infinity_Castle' },
    { title: 'Wikipedia (en): List of Demon Slayer: Kimetsu no Yaiba chapters', url: 'https://en.wikipedia.org/wiki/List_of_Demon_Slayer:_Kimetsu_no_Yaiba_chapters' },
    { title: 'Wikipedia (en): Demon Slayer: Kimetsu no Yaiba season 1', url: 'https://en.wikipedia.org/wiki/Demon_Slayer:_Kimetsu_no_Yaiba_season_1' },
    { title: 'Wikipedia (en): Demon Slayer: Kimetsu no Yaiba season 3', url: 'https://en.wikipedia.org/wiki/Demon_Slayer:_Kimetsu_no_Yaiba_season_3' },
    { title: 'Wikipedia (en): Demon Slayer: Kimetsu no Yaiba season 4', url: 'https://en.wikipedia.org/wiki/Demon_Slayer:_Kimetsu_no_Yaiba_season_4' },
    { title: 'Wikipedia (en): List of Demon Slayer: Kimetsu no Yaiba characters', url: 'https://en.wikipedia.org/wiki/List_of_Demon_Slayer:_Kimetsu_no_Yaiba_characters' },
    { title: 'Wikipedia (de): Demon Slayer: Kimetsu no Yaiba', url: 'https://de.wikipedia.org/wiki/Demon_Slayer:_Kimetsu_no_Yaiba' },
    { title: 'Popverse: Interview mit Yūichi Terao zur Infinity Castle (11.09.2025)', url: 'https://www.thepopverse.com/movies-demon-slayer-kimetsu-no-yaiba-yuichi-terao-interview-making-the-infinity-castle-feel-infinite' },
    { title: 'Popverse: CG im Schmiededorf-Auftakt (06.05.2024)', url: 'https://www.thepopverse.com/demon-slayer-kimetsu-no-yaiba-to-the-swordsmith-village-cgi-animation' },
    { title: 'アニメ！アニメ！: Making-of ufotable (13.01.2026)', url: 'https://animeanime.jp/article/2026/01/13/95098.html' },
    { title: 'Dexerto: The Infinity Castle explained (03.05.2023)', url: 'https://www.dexerto.com/tv-movies/demon-slayer-the-infinity-castle-explained-2133255/' },
    { title: 'Dexerto: Infinity Castle arc explained (03.07.2024)', url: 'https://www.dexerto.com/anime/demon-slayer-infinity-castle-arc-explained-2804714' },
    { title: 'VG+: Analyse Film Teil 1 (21.09.2025)', url: 'https://virtualgorillaplus.com/?p=45527' },
    { title: 'Tokyo Walker: Ōkawasō und Anime-Pilgerorte (01.11.2020)', url: 'https://www.walkerplus.com/article/1008957/' },
  ],
  credits: null,
  tested: null,
};

// --- Maße (Modul-Koordinaten wie in der Recherche: Schacht x/z 0–144, y 0–192) ---

const MAX = 144;
const CENTER = 72;
const TOP_Y = 192;
const FIRST_STOREY_Y = 40;
const STOREY_HEIGHT = 8;
const MIRROR_STOREY_Y = 112;
const SIDE_LENGTH = 137; // eine Ringseite x 0–136, die nächste Seite übernimmt die Ecke
// Die Vordächer (Kapitel 16) ragen 1 Block über x/z 0 hinaus; finalize() verschiebt alles um 1.
const EAVE = 1;

const P = Object.freeze({
  planks: 'dark_oak_planks',
  log: 'stripped_dark_oak_log',
  stairs: 'dark_oak_stairs',
  slab: 'dark_oak_slab',
  fence: 'dark_oak_fence',
  lightStairs: 'spruce_stairs',
  carrier: 'spruce_planks',
  lightFence: 'spruce_fence',
  fusuma: 'pale_oak_planks',
  flap: 'pale_oak_trapdoor',
  shoji: 'ochre_froglight[axis=y]',
  moon: 'pearlescent_froglight[axis=y]',
  tatami: 'bamboo_mosaic',
  tatamiEdge: 'stripped_bamboo_block',
  lamp: 'shroomlight',
  roofStairs: 'deepslate_tile_stairs',
  roofSlab: 'deepslate_tile_slab',
  abyss: 'polished_blackstone',
  water: 'water',
  lily: 'lily_pad',
  ice: 'packed_ice',
  blueIce: 'blue_ice',
  gold: 'gold_block',
  biwa: 'note_block[instrument=bass]', // auf Holz stellt das Spiel „bass“ ein
});
const log = (axis) => `${P.log}[axis=${axis}]`;
const tatamiEdge = (axis) => `${P.tatamiEdge}[axis=${axis}]`;
const LANTERN_HANGING = 'lantern[hanging=true]';
const LANTERN_STANDING = 'lantern[hanging=false]';
const CHAIN = 'iron_chain[axis=y]';

// --- Kopfstehend und gekippt ---

const VERTICAL_SWAP = { half: { top: 'bottom', bottom: 'top' }, type: { top: 'bottom', bottom: 'top' }, hanging: { true: 'false', false: 'true' } };
const VERTICAL_DEFAULTS = [[/_stairs$|_trapdoor$/, 'half', 'bottom'], [/_slab$/, 'type', 'bottom'], [/lantern$/, 'hanging', 'false']];
const NO_UPSIDE = /_door$|_bed$|_carpet$|_pressure_plate$|^water$|^lily_pad$|torch$|^scaffolding$|_sign$|_banner$/;
const AXIS_BLOCK = /_log$|_wood$|_froglight$|^stripped_bamboo_block$|^bamboo_block$|^iron_chain$/;

// Zustand für einen kopfstehenden Teil: Treppen/Falltüren half, Stufen type, Laternen hanging tauschen.
export function flipVertical(state) {
  const { id, props } = parseState(state);
  if (NO_UPSIDE.test(id)) throw new Error(`Infinity Castle: „${id}“ hat keinen Kopfüber-Zustand und darf nicht kopfstehend gesetzt werden.`);
  const out = { ...props };
  for (const [pattern, key, value] of VERTICAL_DEFAULTS) if (pattern.test(id) && out[key] === undefined) out[key] = value;
  for (const [key, swap] of Object.entries(VERTICAL_SWAP)) if (out[key] in swap) out[key] = swap[out[key]];
  return formatState(id, out);
}

// Zustand für einen seitlich gekippten Teil (Drehung um die z-Achse): nur Vollblöcke und Achsen-Blöcke.
export function tiltState(state) {
  const { id, props } = parseState(state);
  const keys = Object.keys(props);
  if (keys.some((key) => key !== 'axis')) throw new Error(`Infinity Castle: „${state}“ lässt sich nicht seitlich kippen (nur Vollblöcke, Stämme, Froschlichter).`);
  if (!AXIS_BLOCK.test(id)) return state;
  const axis = props.axis ?? 'y';
  return formatState(id, { axis: axis === 'y' ? 'x' : axis === 'x' ? 'y' : 'z' });
}

// Lokale Box w × h × l an origin; orient: normal | upside (y gespiegelt) | tiltWest/tiltEast (Boden zeigt nach Westen/Osten).
export function makeFrame(b, origin, size, orient = 'normal') {
  const [ox, oy, oz] = origin;
  const [w, h] = size;
  const maps = {
    normal: [(x, y, z) => [ox + x, oy + y, oz + z], (s) => s],
    upside: [(x, y, z) => [ox + x, oy + h - 1 - y, oz + z], flipVertical],
    tiltWest: [(x, y, z) => [ox + y, oy + w - 1 - x, oz + z], tiltState],
    tiltEast: [(x, y, z) => [ox + h - 1 - y, oy + x, oz + z], tiltState],
  };
  if (!maps[orient]) throw new Error(`Infinity Castle: unbekannte Ausrichtung „${orient}“.`);
  const [map, convert] = maps[orient];
  const cache = new Map();
  const state = (s) => {
    let out = cache.get(s);
    if (out === undefined) {
      out = convert(s);
      cache.set(s, out);
    }
    return out;
  };
  return {
    set(x, y, z, s) {
      const [wx, wy, wz] = map(x, y, z);
      b.set(wx, wy, wz, state(s));
    },
    fill(x1, y1, z1, x2, y2, z2, s, options) {
      const [ax, ay, az] = map(x1, y1, z1);
      const [cx, cy, cz] = map(x2, y2, z2);
      b.fill(ax, ay, az, cx, cy, cz, state(s), options);
    },
    world: map,
  };
}

// --- Ringseiten: eine Seite in „Nord-Koordinaten“ bauen, um die Mitte gedreht für alle vier Seiten ---

function onSide(b, side, fn) {
  b.transform({ offset: [CENTER, 0, CENTER], rotate: side * 90 }, () => b.transform({ offset: [-CENTER, 0, -CENTER] }, fn));
}

function sideToWorld(side, x, z) {
  if (side === 0) return [x, z];
  if (side === 1) return [MAX - z, x];
  if (side === 2) return [MAX - x, MAX - z];
  return [z, MAX - x];
}

const key = (x, y, z) => `${x},${y},${z}`;

// --- Pläne der Einbauten (für Geländer-Öffnungen) ---

const HALL_STAIR = { first: 90, landing: [129, 131], z: [8, 10], railZ: 11 }; // Nord-Koordinaten, steigt nach Osten
const EMPORE = { x: [65, 79], z: [2, 11], y: 24, stairX: [71, 73] };
const BRIDGES = [
  { name: 'B1', axis: 'z', c: 102, y: 64, covered: false },
  { name: 'B2', axis: 'x', c: 42, y: 96, covered: true },
  { name: 'B3', axis: 'z', c: 38, y: 128, covered: false },
  { name: 'B4', axis: 'x', c: 110, y: 152, covered: true },
  { name: 'B5', axis: 'z', c: 114, y: 176, covered: false },
];
const FLOATING_STAIRS = [
  { name: 'S1', side: 0, start: 18, dir: 1, y: 40, upside: false },
  { name: 'S2', side: 0, start: 118, dir: -1, y: 72, upside: true },
  { name: 'S3', side: 1, start: 22, dir: 1, y: 144, upside: false },
  { name: 'S4', side: 1, start: 122, dir: -1, y: 48, upside: true },
  { name: 'S5', side: 2, start: 26, dir: 1, y: 88, upside: false },
  { name: 'S6', side: 2, start: 110, dir: -1, y: 136, upside: true },
  { name: 'S7', side: 3, start: 30, dir: 1, y: 104, upside: false },
  { name: 'S8', side: 3, start: 126, dir: -1, y: 160, upside: true },
];
const STAIR_RUN = 24;
const CUBES = [
  { name: 'W1', at: [100, 44, 16], orient: 'normal', open: 'south' },
  { name: 'W2', at: [16, 100, 104], orient: 'upside', open: 'east' },
  { name: 'W3', at: [112, 132, 96], orient: 'tiltWest', open: 'north' },
  { name: 'W4', at: [24, 140, 40], orient: 'normal', open: 'east' },
  { name: 'W5', at: [96, 160, 24], orient: 'upside', open: 'south' },
  { name: 'W6', at: [40, 168, 116], orient: 'normal', open: 'north' },
  { name: 'W7', at: [112, 76, 112], orient: 'upside', open: 'west' },
  { name: 'W8', at: [20, 52, 20], orient: 'tiltEast', open: 'south' },
  { name: 'W9', at: [60, 120, 104], orient: 'upside', open: 'north' },
  { name: 'W10', at: [92, 108, 60], orient: 'normal', open: 'west' },
];
const ZENITSU = { x: [64, 80], y: 56, z: [124, 136] };
const AKAZA = { x: [8, 48], y: 72, z: [52, 92], flake: [28, 72] };
const DOMA = { x: [108, 136], y: 104, z: [58, 86], pool: [112, 132, 62, 82] };
const KOKUSHIBO = { x: [56, 88], y: 136, z: [8, 32] };
const NAKIME = { x: [69, 75], y: 160, z: [69, 75] };

// Geländer-Stellen (Welt-Koordinaten, Laufhöhe der Galerie), an denen Treppen, Brücken und Hallen anschließen.
function planOpenings() {
  const open = new Set();
  const addSide = (side, x1, x2, y) => {
    for (let x = x1; x <= x2; x++) {
      const [wx, wz] = sideToWorld(side, x, 7);
      open.add(key(wx, y, wz));
    }
  };
  for (let side = 0; side < 4; side++) addSide(side, HALL_STAIR.landing[0], HALL_STAIR.landing[1], FIRST_STOREY_Y + 1);
  // Nur neben den ersten bzw. letzten zwei Stufen öffnen, sonst entstehen Löcher zum Schacht
  for (const s of FLOATING_STAIRS) {
    if (s.upside) continue;
    const end = s.start + s.dir * (STAIR_RUN - 1);
    addSide(s.side, Math.min(s.start, s.start + s.dir), Math.max(s.start, s.start + s.dir), s.y + 1);
    addSide(s.side, Math.min(end, end - s.dir), Math.max(end, end - s.dir), s.y + STAIR_RUN + 1);
  }
  for (const br of BRIDGES) {
    for (let u = br.c - 1; u <= br.c + 1; u++) {
      for (const v of [7, MAX - 7]) open.add(br.axis === 'z' ? key(u, br.y + 1, v) : key(v, br.y + 1, u));
    }
  }
  for (let z = AKAZA.z[0] + 1; z < AKAZA.z[1]; z++) open.add(key(7, AKAZA.y + 1, z));
  for (let z = DOMA.z[0] + 1; z < DOMA.z[1]; z++) open.add(key(MAX - 7, DOMA.y + 1, z));
  for (let x = KOKUSHIBO.x[0] + 1; x < KOKUSHIBO.x[1]; x++) open.add(key(x, KOKUSHIBO.y + 1, 7));
  for (let x = ZENITSU.x[0] + 1; x < ZENITSU.x[1]; x++) open.add(key(x, ZENITSU.y + 1, MAX - 7));
  return open;
}

// --- M1 Säulenhalle ---

const PILLAR_GRID = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 132];
const CENTER_BEAMS = [60, 72, 84]; // Balken über dem Wasserspiegel (freie Mittelachse)
const inBox = (x, z, [x1, x2], [z1, z2]) => x >= x1 && x <= x2 && z >= z1 && z <= z2;

// Grundflächen der vier Aufgänge samt Zaunreihe (Welt-Koordinaten), dort entfallen Säulen und Bodenlaternen.
const HALL_STAIR_BOXES = [
  [[90, 132], [8, 11]], [[133, 136], [90, 132]], [[12, 54], [133, 136]], [[8, 11], [12, 54]],
];

function hallReserved(x, z) {
  return inBox(x, z, EMPORE.x, [1, EMPORE.z[1]]) || inBox(x, z, [EMPORE.stairX[0] - 1, EMPORE.stairX[1] + 1], [12, 35])
    || HALL_STAIR_BOXES.some(([bx, bz]) => inBox(x, z, bx, bz));
}

// Freier Platz vor dem Fuß der Empore-Treppe (sonst stünde eine Säule direkt nach der letzten Stufe)
const EMPORE_STAIR_FOOT = [[EMPORE.stairX[0] - 1, EMPORE.stairX[1] + 1], [36, 39]];

// Rasterpunkte der Säulen außerhalb des Wasserspiegels; blocked = Empore oder Aufgang im Weg (Säule entfällt).
function pillarPositions() {
  const list = [];
  for (const px of PILLAR_GRID) {
    for (const pz of PILLAR_GRID) {
      if (px >= 60 && px <= 84 && pz >= 60 && pz <= 84) continue;
      const blocked = [[px, pz], [px + 1, pz], [px, pz + 1], [px + 1, pz + 1]]
        .some(([x, z]) => hallReserved(x, z) || inBox(x, z, ...EMPORE_STAIR_FOOT));
      list.push({ px, pz, blocked });
    }
  }
  return list;
}

function buildHallFloor(b) {
  b.fill(0, 0, 0, MAX, 0, MAX, P.planks);
  b.fill(60, 0, 60, 84, 0, 84, P.abyss);
  b.fill(59, 1, 59, 85, 1, 59, log('x'));
  b.fill(59, 1, 85, 85, 1, 85, log('x'));
  b.fill(59, 1, 60, 59, 1, 84, log('z'));
  b.fill(85, 1, 60, 85, 1, 84, log('z'));
  b.fill(60, 1, 60, 84, 1, 84, P.water);
  for (let v = 60; v <= 84; v += 6) {
    for (const edge of [59, 85]) {
      b.set(v, 2, edge, LANTERN_STANDING);
      b.set(edge, 2, v, LANTERN_STANDING);
    }
  }
}

function buildPillarForest(b) {
  const pillars = pillarPositions();
  for (const { px, pz, blocked } of pillars) {
    if (!blocked) b.fill(px, 1, pz, px + 1, 38, pz + 1, log('y'));
    for (const [lx, lz] of [[px - 1, pz - 1], [px + 2, pz + 2]]) {
      if (!hallReserved(lx, lz)) b.set(lx, 1, lz, LANTERN_STANDING);
    }
  }
  for (const g of PILLAR_GRID) {
    b.fill(2, 39, g, 142, 39, g + 1, log('x'));
    b.fill(g, 39, 2, g + 1, 39, 142, log('z'));
  }
  // Laternen auf den Balkenkreuzungen (außerhalb der freien Mittelachse)
  for (const gx of PILLAR_GRID) {
    for (const gz of PILLAR_GRID) {
      if (gx >= 56 && gx <= 88 && gz >= 56 && gz <= 88) continue;
      b.set(gx, 40, gz, LANTERN_STANDING);
    }
  }
  for (const g of PILLAR_GRID) {
    for (let x = 18; x <= 126; x += 12) {
      b.fill(x, 36, g, x, 38, g, CHAIN);
      b.set(x, 35, g, LANTERN_HANGING);
    }
  }
  // In der Mitte fehlen die Laternen auf den Kreuzungen: dort hängen zusätzlich Laternen unter den Balken in z-Richtung
  for (const g of CENTER_BEAMS) {
    for (const z of [66, 78]) {
      b.fill(g, 36, z, g, 38, z, CHAIN);
      b.set(g, 35, z, LANTERN_HANGING);
    }
  }
}

// Doppelte Hallenwand: außen Bretter mit Stützen alle 8, innen ein Raster aus Schiebetüren in fünf Reihen.
function buildHallWallSide(b) {
  b.fill(0, 1, 0, 143, 39, 0, P.planks);
  for (let x = 0; x <= 143; x += 8) b.fill(x, 1, 0, x, 39, 0, log('y'));
  const rows = [[1, 7], [9, 15], [17, 23], [25, 31], [33, 38]];
  b.fill(1, 1, 1, 1, 39, 1, log('y'));
  for (let x = 4; x <= 140; x += 4) b.fill(x, 1, 1, x, 39, 1, log('y'));
  for (const y of [8, 16, 24, 32, 39]) b.fill(2, y, 1, 142, y, 1, log('x'));
  for (let x0 = 2; x0 <= 142; x0 = nextPost(x0) + 1) {
    const x1 = Math.min(nextPost(x0) - 1, 142);
    for (const [y0, y1] of rows) {
      b.fill(x0, y0, 1, x1, y0, 1, P.planks);
      b.fill(x0, y0 + 1, 1, x1, y1, 1, b.chance(0.3) ? P.shoji : P.fusuma);
    }
  }
}

function nextPost(x) {
  let p = x;
  while (p % 4 !== 0) p++;
  return p;
}

function buildEmpore(b) {
  const [x1, x2] = EMPORE.x;
  const [z1, z2] = EMPORE.z;
  const y = EMPORE.y;
  b.fill(x1, y, z1, x2, y, z2, P.planks);
  b.fill(x1, y, z2, x2, y, z2, log('x'));
  b.fill(71, y, 3, 73, y, 5, P.tatami);
  b.fill(x1, 1, z2, x1, y - 1, z2, log('y'));
  b.fill(x2, 1, z2, x2, y - 1, z2, log('y'));
  b.fill(x1, y - 1, z1, x1, y - 1, z2 - 1, log('z'));
  b.fill(x2, y - 1, z1, x2, y - 1, z2 - 1, log('z'));
  for (let x = x1; x <= x2; x++) if (x < EMPORE.stairX[0] || x > EMPORE.stairX[1]) b.set(x, y + 1, z2, P.fence);
  for (let z = z1; z < z2; z++) {
    b.set(x1, y + 1, z, P.fence);
    b.set(x2, y + 1, z, P.fence);
  }
  b.set(x1, y + 2, z2, LANTERN_STANDING);
  b.set(x2, y + 2, z2, LANTERN_STANDING);
  for (const x of [68, 76]) b.set(x, 1, 6, LANTERN_STANDING);
  for (const z of [16, 22, 28]) b.set(72, 1, z, LANTERN_STANDING);
  // Wangen links und rechts (x 70 und 74): gleiche Treppe auf einem Brett, darauf der Zaun
  for (let k = 0; k < 24; k++) {
    const z = 12 + k;
    const sy = y - k;
    const [w1, w2] = [EMPORE.stairX[0] - 1, EMPORE.stairX[1] + 1];
    b.fill(w1, sy, z, w2, sy, z, `${P.stairs}[facing=north,half=bottom]`);
    if (sy - 1 >= 1) b.fill(w1, sy - 1, z, w2, sy - 1, z, P.carrier);
    for (const x of [w1, w2]) {
      if (k > 0) b.set(x, sy + 1, z, P.fence);
      if (k % 6 === 3) b.set(x, sy + 2, z, LANTERN_STANDING);
    }
  }
}

// Aufgang in Nord-Koordinaten: 39 Stufen an z 8–10 von x 90 (y 1) bis x 128 (y 39), Podest x 129–131 auf y 40.
function buildHallStair(b) {
  const [z1, z2] = HALL_STAIR.z;
  // Stufen z 8–10 plus Wange auf z 11 (trägt den Zaun); die 39. Wangenstufe läge an Ost- und Südwand im Balkenrost
  for (let k = 1; k <= 39; k++) {
    const x = HALL_STAIR.first - 1 + k;
    const outer = k <= 38 ? HALL_STAIR.railZ : z2;
    b.fill(x, k, z1, x, k, outer, `${P.stairs}[facing=east,half=bottom]`);
    if (k >= 2) b.fill(x, k - 1, z1, x, k - 1, outer, P.carrier);
    // Ab y 39 läge der Zaun im Balkenrost der Halle; dort schützt der Balken.
    if (k <= 37) b.set(x, k + 1, HALL_STAIR.railZ, P.fence);
    if (k % 8 === 4) b.set(x, k + 2, HALL_STAIR.railZ, LANTERN_STANDING);
  }
  // Laternen im Gang hinter dem Aufgang (unter der Galerie)
  for (let x = HALL_STAIR.first + 2; x <= HALL_STAIR.landing[1]; x += 12) b.set(x, 1, 5, LANTERN_STANDING);
  const [l1, l2] = HALL_STAIR.landing;
  b.fill(l1, FIRST_STOREY_Y, z1, l2 + 1, FIRST_STOREY_Y, HALL_STAIR.railZ, P.planks);
  b.fill(l1, FIRST_STOREY_Y + 1, HALL_STAIR.railZ, l2, FIRST_STOREY_Y + 1, HALL_STAIR.railZ, P.fence);
  b.fill(l2 + 1, FIRST_STOREY_Y + 1, z1, l2 + 1, FIRST_STOREY_Y + 1, HALL_STAIR.railZ, P.fence);
}

// --- M2 Schachtwand-Ring ---

// Ein Wandfeld (3 breit) zwischen zwei Stützen; cells = lokale [x, z] der drei Felder, axis = Richtung der Wand.
function wallField(f, b, cells, axis) {
  const kind = b.pickWeighted([['closed', 60], ['glow', 30], ['open', 10]]);
  for (const [x, z] of cells) {
    f.set(x, 1, z, P.planks);
    if (kind === 'closed') f.fill(x, 2, z, x, 5, z, P.fusuma);
    else if (kind === 'glow') f.fill(x, 2, z, x, 5, z, P.shoji);
    f.set(x, 6, z, kind === 'glow' ? P.shoji : tatamiEdge(axis));
  }
}

function buildSideStorey(b, side, y0, mirrored, openings) {
  const f = makeFrame(b, [0, y0, 0], [SIDE_LENGTH, STOREY_HEIGHT, 8], mirrored ? 'upside' : 'normal');
  const last = SIDE_LENGTH - 1;
  f.fill(0, 0, 0, last, 0, 7, P.planks);
  // Geschoss 1 ragt über die Halle: dort bleibt der Raumboden aus Brettern, weil man ihn von unten sieht
  if (y0 !== FIRST_STOREY_Y) {
    f.fill(1, 0, 1, last, 0, 3, P.tatami);
    f.fill(1, 0, 4, 3, 0, 7, P.tatami);
  }
  // Außenwand mit Stützen alle 8 und einem Pilzlicht je Raum
  f.fill(0, 1, 0, last, 7, 0, P.planks);
  f.fill(0, 1, 1, 0, 7, 7, P.planks);
  for (let x = 0; x <= last; x += 8) f.fill(x, 1, 0, x, 7, 0, log('y'));
  f.set(0, 5, 4, P.lamp);
  for (let p = 4; p < last; p += 12) f.set(p + 6, 5, 0, P.lamp);
  // Trennwände der Räume alle 12
  for (let p = 4; p <= last; p += 12) {
    f.fill(p, 1, 1, p, 1, 3, P.planks);
    f.fill(p, 2, 1, p, 6, 3, P.fusuma);
    f.fill(p, 7, 1, p, 7, 3, log('z'));
  }
  // Shoji-/Fusuma-Wand: Stützen alle 4, Felder 3 breit
  for (let x = 4; x <= last; x += 4) f.fill(x, 1, 4, x, 6, 4, log('y'));
  f.fill(4, 7, 4, last, 7, 4, log('x'));
  f.fill(4, 7, 5, 4, 7, 7, log('z'));
  wallField(f, b, [[4, 5], [4, 6], [4, 7]], 'z');
  for (let x0 = 5; x0 < last; x0 += 4) wallField(f, b, [[x0, 4], [x0 + 1, 4], [x0 + 2, 4]], 'x');
  // Geländer mit Stützen alle 4, Kantenbalken und Laternen alle 6
  f.fill(7, 1, 7, 7, 6, 7, log('y'));
  for (let x = 8; x <= last; x += 4) f.fill(x, 1, 7, x, 6, 7, log('y'));
  f.fill(7, 7, 7, last, 7, 7, log('x'));
  for (let x = 9; x <= last; x++) {
    if (x % 4 === 0) continue;
    const [wx, wz] = sideToWorld(side, x, 7);
    if (!mirrored && openings.has(key(wx, y0 + 1, wz))) continue;
    f.set(x, 1, 7, P.fence);
  }
  for (let x = 9; x <= last; x += 6) {
    f.set(x, 6, 7, CHAIN);
    f.set(x, 5, 7, LANTERN_HANGING);
  }
  // Im Spiegel-Geschoss liegt die Galerie an der Decke; ein Laufboden auf der Unterkante macht es begehbar.
  if (mirrored) b.fill(0, y0, 0, last, y0, 7, P.planks, { keep: true });
}

function buildStoreys(b, fromY, toY, openings) {
  for (let y = fromY; y <= toY; y += STOREY_HEIGHT) {
    for (let side = 0; side < 4; side++) onSide(b, side, () => buildSideStorey(b, side, y, y === MIRROR_STOREY_Y, openings));
  }
}

// --- M3 Brücken ---

function buildBridge(b, br) {
  const put = (u, y, v, s) => (br.axis === 'z' ? b.set(u, y, v, s) : b.set(v, y, u, s));
  const fillUV = (u1, y1, v1, u2, y2, v2, s) => (br.axis === 'z' ? b.fill(u1, y1, v1, u2, y2, v2, s) : b.fill(v1, y1, u1, v2, y2, u2, s));
  const along = br.axis === 'z' ? 'z' : 'x';
  const across = br.axis === 'z' ? 'x' : 'z';
  const { c, y } = br;
  const v1 = 8;
  const v2 = MAX - 8;
  fillUV(c - 1, y, v1, c + 1, y, v2, P.planks);
  fillUV(c - 2, y, v1, c - 2, y, v2, log(along));
  fillUV(c + 2, y, v1, c + 2, y, v2, log(along));
  for (let v = v1; v <= v2; v++) {
    const post = v % 8 === 0;
    for (const u of [c - 2, c + 2]) {
      if (!post) put(u, y + 1, v, P.fence);
      else if (br.covered) fillUV(u, y + 1, v, u, y + 4, v, log('y'));
      else {
        fillUV(u, y + 1, v, u, y + 2, v, log('y'));
        put(u, y + 3, v, LANTERN_STANDING);
      }
    }
    if (post && br.covered) {
      fillUV(c - 2, y + 5, v, c + 2, y + 5, v, log(across));
      put(c, y + 4, v, LANTERN_HANGING);
    }
  }
  if (br.covered) {
    const roof = { y: y + 6, type: 'gable', axis: along, stairs: P.roofStairs, slab: P.roofSlab, full: P.planks };
    if (br.axis === 'z') b.roof({ ...roof, x1: c - 2, x2: c + 2, z1: v1, z2: v2 });
    else b.roof({ ...roof, x1: v1, x2: v2, z1: c - 2, z2: c + 2 });
  }
}

// --- M4 Schwebetreppen (Nord-Koordinaten einer Ringseite, 3 breit an z 8–10) ---

function buildFloatingStair(b, s) {
  const facing = s.dir > 0 ? 'east' : 'west';
  for (let i = 0; i < STAIR_RUN; i++) {
    const x = s.start + s.dir * i;
    // z 8–10 Stufen, z 11 Wange (gleiche Treppe), daran der Zaun
    if (!s.upside) {
      const y = s.y + 1 + i;
      b.fill(x, y, 8, x, y, 11, `${P.lightStairs}[facing=${facing},half=bottom]`);
      b.fill(x, y - 1, 8, x, y - 1, 11, P.carrier);
      b.set(x, y + 1, 11, P.lightFence);
    } else {
      const y = s.y + STAIR_RUN - i;
      b.fill(x, y, 8, x, y, 11, `${P.lightStairs}[facing=${facing},half=top]`);
      b.fill(x, y + 1, 8, x, y + 1, 11, P.carrier);
      b.set(x, y - 1, 11, P.lightFence);
    }
  }
}

// --- M5 Raumwürfel (11 × 9 × 11, lokal) ---

const CUBE_SIZE = [11, 9, 11];

function buildRoomCube(b, cube) {
  const f = makeFrame(b, cube.at, CUBE_SIZE, cube.orient);
  const tilted = cube.orient.startsWith('tilt');
  for (const yy of [0, 8]) {
    f.fill(0, yy, 0, 10, yy, 0, log('x'));
    f.fill(0, yy, 10, 10, yy, 10, log('x'));
    f.fill(0, yy, 1, 0, yy, 9, log('z'));
    f.fill(10, yy, 1, 10, yy, 9, log('z'));
  }
  f.fill(1, 0, 1, 9, 0, 9, P.tatami);
  for (const z of [3, 7]) f.fill(1, 0, z, 9, 0, z, tatamiEdge('x'));
  // Kopfstehend liegt die Tatami-Seite oben: ein Pilzlicht darin hält das Dach hell (sonst Blocklicht 0)
  if (cube.orient === 'upside') f.set(5, 0, 5, P.lamp);
  f.fill(1, 8, 1, 9, 8, 9, P.planks);
  f.set(5, 8, 5, P.lamp);
  for (const [cx, cz] of [[0, 0], [10, 0], [0, 10], [10, 10]]) f.fill(cx, 1, cz, cx, 7, cz, log('y'));
  const walls = {
    north: (u) => [u, 0], south: (u) => [u, 10], west: (u) => [0, u], east: (u) => [10, u],
  };
  for (const [name, at] of Object.entries(walls)) {
    const beamAxis = name === 'north' || name === 'south' ? 'x' : 'z';
    const openHalf = name === cube.open ? (b.chance(0.5) ? 1 : 6) : 0;
    for (let u = 1; u <= 9; u++) {
      const [x, z] = at(u);
      f.set(x, 7, z, log(beamAxis));
      if (u === 5) {
        f.fill(x, 1, z, x, 6, z, log('y'));
        continue;
      }
      f.set(x, 1, z, P.planks);
      f.set(x, 6, z, P.shoji);
      const half = u < 5 ? 1 : 6;
      if (half === openHalf) continue;
      f.fill(x, 2, z, x, 5, z, P.fusuma);
    }
  }
  if (!tilted) {
    f.set(2, 7, 2, LANTERN_HANGING);
    f.set(8, 7, 8, LANTERN_HANGING);
  }
}

// --- M6 Zenitsus Sturzraum ---

function buildZenitsuFloor(b, breaks) {
  const { x: [x1, x2], y, z: [z1, z2] } = ZENITSU;
  for (let x = x1; x <= x2; x++) {
    const front = z1 + breaks[x - x1];
    const edge = x === x1 || x === x2;
    b.fill(x, y, front, x, y, z2, edge ? log('z') : P.tatami);
    // Schwelle zur Galerie aus einem liegenden Stamm
    if (!edge) b.set(x, y, z2, log('x'));
    // Bruchstück: umgedrehte Treppe unter der Bruchkante
    if (b.chance(0.55)) b.set(x, y - 1, front, `${P.stairs}[facing=${b.chance(0.5) ? 'south' : 'north'},half=top]`);
  }
  for (let x = x1 + 4; x < x2; x += 4) b.fill(x, y - 1, z1 + 5, x, y - 1, z2, log('z'));
}

function buildZenitsuWalls(b, breaks) {
  const { x: [x1, x2], y, z: [z1, z2] } = ZENITSU;
  for (const x of [x1, x2]) {
    const front = z1 + breaks[x - x1] + 1;
    for (let z = front; z <= z2; z++) {
      const post = (z - z2) % 4 === 0 || z === front;
      if (post) {
        b.fill(x, y + 1, z, x, y + 6, z, log('y'));
        continue;
      }
      b.set(x, y + 1, z, P.planks);
      const torn = z < front + 3 && b.chance(0.5);
      const top = torn ? y + 2 + b.rngInt(0, 2) : y + 5;
      b.fill(x, y + 2, z, x, top, z, P.fusuma);
      b.set(x, y + 6, z, P.shoji);
    }
  }
}

function buildZenitsuCeiling(b, breaks) {
  const { x: [x1, x2], y, z: [z1, z2] } = ZENITSU;
  const top = y + 7;
  for (let x = x1; x <= x2; x++) {
    const front = z1 + Math.max(0, breaks[x - x1] - 1);
    b.fill(x, top, front, x, top, z2, P.planks);
  }
  for (let x = x1; x <= x2; x += 4) b.fill(x, top, z1 + 4, x, top, z2, log('z'));
  for (const x of [68, 76]) {
    b.set(x, top - 1, 130, LANTERN_HANGING);
  }
  b.set(72, top, 132, P.lamp);
}

// --- M7 Akazas Halle ---

// Abstand des Punkts p zur Strecke a–b.
function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// Sechsarmige Schneeflocke (Ø 25) als Liste von Strecken um (0, 0).
function snowflakeSegments() {
  const segments = [];
  for (let arm = 0; arm < 6; arm++) {
    const a = (arm * Math.PI) / 3;
    segments.push([0, 0, 12 * Math.cos(a), 12 * Math.sin(a)]);
    for (const [r, len] of [[5, 3.2], [8.5, 2.6]]) {
      const bx = r * Math.cos(a);
      const bz = r * Math.sin(a);
      for (const side of [-1, 1]) {
        const ba = a + side * (Math.PI / 3);
        segments.push([bx, bz, bx + len * Math.cos(ba), bz + len * Math.sin(ba)]);
      }
    }
  }
  return segments;
}

function buildAkazaFloor(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = AKAZA;
  b.fill(x1, y, z1, x2, y, z2, P.planks);
  b.fill(x1, y, z1, x2, y, z1, log('x'));
  b.fill(x1, y, z2, x2, y, z2, log('x'));
  b.fill(x2, y, z1 + 1, x2, y, z2 - 1, log('z'));
  for (let x = x1 + 8; x < x2; x += 8) b.fill(x, y - 1, z1, x, y - 1, z2, log('z'));
}

function buildSnowflake(b) {
  const [cx, cz] = AKAZA.flake;
  const segments = snowflakeSegments();
  for (let dx = -13; dx <= 13; dx++) {
    for (let dz = -13; dz <= 13; dz++) {
      const hit = Math.hypot(dx, dz) <= 1.6 || segments.some((s) => segmentDistance(dx, dz, ...s) <= 0.55);
      if (hit) b.set(cx + dx, AKAZA.y, cz + dz, P.ice);
    }
  }
}

// Wand mit 12 Blöcken Höhe; line(u) → [x, z]; broken = Felder (Index), die herausgebrochen sind.
function buildAkazaWall(b, length, line, beamAxis, broken) {
  const y = AKAZA.y;
  let field = 0;
  for (let u = 0; u <= length; u++) {
    const [x, z] = line(u);
    if (u % 4 === 0) {
      b.fill(x, y + 1, z, x, y + 12, z, log('y'));
      continue;
    }
    const isBroken = broken.includes(Math.floor(u / 4));
    b.set(x, y + 1, z, P.planks);
    b.set(x, y + 12, z, log(beamAxis));
    for (const [r1, r2] of [[2, 5], [7, 10]]) {
      const glow = (field + r1) % 7 === 0;
      for (let yy = y + r1; yy <= y + r2; yy++) {
        if (isBroken && !(yy === y + r1 && b.chance(0.3))) continue;
        b.set(x, yy, z, glow ? P.shoji : P.fusuma);
      }
    }
    const beam = !isBroken || b.chance(0.4);
    if (beam) b.set(x, y + 6, z, log(beamAxis));
    // Ein Rest des oberen Felds bleibt nur, wenn der Balken darunter noch da ist
    else if (b.get(x, y + 7, z) !== 'air') b.remove(x, y + 7, z);
    if (isBroken && b.chance(0.5)) b.set(x, y + 1, z, `${P.slab}[type=bottom]`);
    b.set(x, y + 11, z, P.shoji);
    if (u % 4 === 3) field++;
  }
}

function buildAkazaWalls(b) {
  const { x: [x1, x2], z: [z1, z2] } = AKAZA;
  buildAkazaWall(b, x2 - x1, (u) => [x1 + u, z1], 'x', [3]);
  buildAkazaWall(b, x2 - x1, (u) => [x1 + u, z2], 'x', [5]);
  buildAkazaWall(b, z2 - z1, (u) => [x2, z1 + u], 'z', [2, 6]);
}

function buildAkazaRoof(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = AKAZA;
  const top = y + 13;
  for (let x = x1; x <= x2; x += 8) b.fill(x, top, z1, x, top, z2, log('z'));
  for (let z = z1 + 4; z < z2; z += 8) b.fill(x1, top, z, x2, top, z, log('x'));
  for (let x = x1 + 8; x < x2; x += 8) {
    for (let z = z1 + 4; z < z2; z += 8) {
      b.fill(x, y + 7, z, x, top - 1, z, CHAIN);
      b.set(x, y + 6, z, LANTERN_HANGING);
    }
  }
}

// --- M8 Domas Lotushalle ---

function buildDomaFloor(b) {
  const { x: [x1, x2], y, z: [z1, z2], pool: [px1, px2, pz1, pz2] } = DOMA;
  b.fill(x1, y, z1, x2, y, z2, P.planks);
  b.fill(x1, y, z1, x2, y, z1, log('x'));
  b.fill(x1, y, z2, x2, y, z2, log('x'));
  b.fill(x1, y, z1 + 1, x1, y, z2 - 1, log('z'));
  for (let z = z1 + 4; z < z2; z += 8) b.fill(x1, y - 1, z, x2, y - 1, z, log('x'));
  b.fill(px1 - 1, y, pz1 - 1, px2 + 1, y, pz1 - 1, log('x'));
  b.fill(px1 - 1, y, pz2 + 1, px2 + 1, y, pz2 + 1, log('x'));
  b.fill(px1 - 1, y, pz1, px1 - 1, y, pz2, log('z'));
  b.fill(px2 + 1, y, pz1, px2 + 1, y, pz2, log('z'));
  b.fill(px1, y - 1, pz1, px2, y - 1, pz2, P.abyss);
  b.fill(px1, y, pz1, px2, y, pz2, P.water);
}

const LOTUS = [[115, 65], [129, 65], [115, 79], [129, 79]];

function buildLotusSculpture(b, cx, cz) {
  const y = DOMA.y;
  b.fill(cx, y, cz, cx, y + 1, cz, P.blueIce);
  for (let d = -2; d <= 2; d++) {
    b.set(cx + d, y + 2, cz, P.ice);
    b.set(cx, y + 2, cz + d, P.ice);
  }
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) b.set(cx + dx, y + 3, cz + dz, dx === 0 && dz === 0 ? P.blueIce : P.ice);
  b.set(cx, y + 4, cz, P.ice);
}

function buildDomaPool(b) {
  const y = DOMA.y;
  const [px1, px2, pz1, pz2] = DOMA.pool;
  b.fill(120, y, 70, 124, y, 74, P.gold);
  b.fill(121, y, 71, 123, y, 73, P.planks);
  b.set(122, y + 1, 72, LANTERN_STANDING);
  for (const [cx, cz] of LOTUS) buildLotusSculpture(b, cx, cz);
  for (let x = px1; x <= px2; x++) {
    for (let z = pz1; z <= pz2; z++) {
      const nearIsland = x >= 119 && x <= 125 && z >= 69 && z <= 75;
      const nearLotus = LOTUS.some(([lx, lz]) => Math.abs(x - lx) <= 2 && Math.abs(z - lz) <= 2);
      if (!nearIsland && !nearLotus && b.chance(0.16)) b.set(x, y + 1, z, P.lily);
    }
  }
}

function buildDomaWall(b, length, line, beamAxis) {
  const y = DOMA.y;
  for (let u = 0; u <= length; u++) {
    const [x, z] = line(u);
    if (u % 4 === 0) {
      b.fill(x, y + 1, z, x, y + 10, z, log('y'));
      continue;
    }
    b.set(x, y + 1, z, P.planks);
    b.fill(x, y + 2, z, x, y + 5, z, P.fusuma);
    b.set(x, y + 6, z, P.gold);
    b.fill(x, y + 7, z, x, y + 8, z, P.fusuma);
    b.set(x, y + 9, z, P.shoji);
    b.set(x, y + 10, z, log(beamAxis));
  }
}

function buildDomaWalls(b) {
  const { x: [x1, x2], z: [z1, z2] } = DOMA;
  buildDomaWall(b, x2 - x1, (u) => [x1 + u, z1], 'x');
  buildDomaWall(b, x2 - x1, (u) => [x1 + u, z2], 'x');
  buildDomaWall(b, z2 - z1, (u) => [x1, z1 + u], 'z');
}

function buildDomaCeiling(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = DOMA;
  const top = y + 11;
  b.fill(x1, top, z1, x2, top, z2, P.planks);
  for (let x = x1 + 2; x < x2; x += 4) for (let z = z1 + 2; z < z2; z += 4) b.set(x, top, z, P.lamp);
}

// --- M9 Kokushibos Säulenhalle ---

const KOKUSHIBO_PILLARS = [60, 66, 72, 78, 84].flatMap((x) => [[x, 16], [x, 24]]);
const CUT_PILLARS = new Map([['66,16', 5], ['78,24', 7], ['84,16', 4]]);

function buildKokushiboFloor(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = KOKUSHIBO;
  b.fill(x1, y, z1, x2, y, z2, P.tatami);
  b.fill(x1, y, z1, x2, y, z1, log('x'));
  b.fill(x1, y, z2, x2, y, z2, log('x'));
  b.fill(x1, y, z1 + 1, x1, y, z2 - 1, log('z'));
  b.fill(x2, y, z1 + 1, x2, y, z2 - 1, log('z'));
  for (let x = x1 + 4; x < x2; x += 4) b.fill(x, y, z1 + 1, x, y, z2 - 1, tatamiEdge('z'));
  for (let x = x1 + 8; x < x2; x += 8) b.fill(x, y - 1, z1, x, y - 1, z2, log('z'));
}

function buildKokushiboPillars(b) {
  const y = KOKUSHIBO.y;
  for (const [x, z] of KOKUSHIBO_PILLARS) {
    const cut = CUT_PILLARS.get(`${x},${z}`);
    if (!cut) {
      b.fill(x, y + 1, z, x, y + 11, z, log('y'));
      b.set(x + 1, y + 1, z, LANTERN_STANDING);
      continue;
    }
    // Durchtrennt: unteres Stück mit schräger Schnittkante, oben nur ein Stumpf an der Decke
    b.fill(x, y + 1, z, x, y + cut, z, log('y'));
    b.set(x, y + cut + 1, z, `${P.stairs}[facing=east,half=bottom]`);
    b.fill(x, y + 10, z, x, y + 11, z, log('y'));
    b.set(x, y + 9, z, `${P.stairs}[facing=west,half=top]`);
    b.set(x + 1, y + 1, z, `${P.slab}[type=bottom]`);
  }
}

function buildKokushiboWall(b, length, line, beamAxis, openFields) {
  const y = KOKUSHIBO.y;
  for (let u = 0; u <= length; u++) {
    const [x, z] = line(u);
    if (u % 4 === 0) {
      b.fill(x, y + 1, z, x, y + 11, z, log('y'));
      continue;
    }
    const open = openFields.includes(Math.floor(u / 4));
    b.set(x, y + 1, z, P.planks);
    b.set(x, y + 6, z, log(beamAxis));
    b.set(x, y + 11, z, log(beamAxis));
    if (!open) b.fill(x, y + 2, z, x, y + 5, z, P.fusuma);
    b.fill(x, y + 7, z, x, y + 10, z, Math.floor(u / 4) % 3 === 1 ? P.moon : P.fusuma);
  }
}

function buildKokushiboWalls(b) {
  const { x: [x1, x2], z: [z1, z2] } = KOKUSHIBO;
  buildKokushiboWall(b, z2 - z1, (u) => [x1, z1 + u], 'z', []);
  buildKokushiboWall(b, z2 - z1, (u) => [x2, z1 + u], 'z', []);
  buildKokushiboWall(b, x2 - x1, (u) => [x1 + u, z2], 'x', [2, 5]);
}

function buildKokushiboCeiling(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = KOKUSHIBO;
  const top = y + 12;
  b.fill(x1, top, z1, x2, top, z2, P.planks);
  for (let x = x1; x <= x2; x += 8) b.fill(x, top, z1, x, top, z2, log('z'));
  // Mondsichel: Scheibe r 6 um (72, 20) ohne Scheibe r 5 um (74, 18)
  for (let dx = -7; dx <= 7; dx++) {
    for (let dz = -7; dz <= 7; dz++) {
      const inMoon = Math.hypot(dx, dz) <= 6.5 && Math.hypot(dx - 2, dz + 2) > 5.2;
      if (inMoon) b.set(72 + dx, top, 20 + dz, P.moon);
    }
  }
  for (const x of [60, 68, 76, 84]) {
    for (const z of [12, 28]) {
      b.set(x, top - 1, z, CHAIN);
      b.set(x, top - 2, z, LANTERN_HANGING);
    }
  }
}

// --- M10 Nakimes Bühne ---

function buildNakimeStage(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = NAKIME;
  b.fill(x1, y, z1, x2, y, z2, P.planks);
  b.fill(x1, y, z1, x2, y, z1, log('x'));
  b.fill(x1, y, z2, x2, y, z2, log('x'));
  b.fill(x1, y, z1 + 1, x1, y, z2 - 1, log('z'));
  b.fill(x2, y, z1 + 1, x2, y, z2 - 1, log('z'));
  b.fill(x1 + 1, y - 1, z1 + 1, x2 - 1, y - 1, z2 - 1, P.planks);
  b.set(CENTER, y - 2, CENTER, LANTERN_HANGING);
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const rim = x === x1 || x === x2 || z === z1 || z === z2;
      const gap = z === z2 && x >= 71 && x <= 73;
      const chain = (x === CENTER && (z === z1 || z === z2)) || (z === CENTER && (x === x1 || x === x2));
      if (rim && !gap && !chain) b.set(x, y + 1, z, P.lightFence);
    }
  }
  b.set(CENTER, y + 1, CENTER, P.biwa);
  for (const [x, z] of [[70, 70], [74, 70], [70, 74], [74, 74]]) b.set(x, y + 1, z, LANTERN_STANDING);
}

function buildNakimeChains(b) {
  const { x: [x1, x2], y, z: [z1, z2] } = NAKIME;
  for (const [x, z] of [[CENTER, z1], [CENTER, z2], [x1, CENTER], [x2, CENTER]]) b.fill(x, y + 1, z, x, TOP_Y - 1, z, CHAIN);
}

// --- M11 Sturzdecke ---

const OPEN_FIELD = [10, 25]; // Feld-Indizes (Feld i = x 4i+1 … 4i+3) der offenen Mitte x/z 41–103

function isOpenField(i, j) {
  return i >= OPEN_FIELD[0] && i <= OPEN_FIELD[1] && j >= OPEN_FIELD[0] && j <= OPEN_FIELD[1];
}

function buildCeilingBeams(b) {
  for (let g = 0; g <= MAX; g += 4) b.fill(0, TOP_Y, g, MAX, TOP_Y, g, log('x'));
  for (let g = 0; g <= MAX; g += 4) {
    for (let z = 1; z <= MAX; z += 4) b.fill(g, TOP_Y, z, g, TOP_Y, z + 2, log('z'));
  }
}

function buildCeilingFields(b) {
  for (let i = 0; i < 36; i++) {
    for (let j = 0; j < 36; j++) {
      if (!isOpenField(i, j)) b.fill(4 * i + 1, TOP_Y, 4 * j + 1, 4 * i + 3, TOP_Y, 4 * j + 3, P.fusuma);
    }
  }
}

// Aufgeklappte Schiebetüren: je offenem Feld eine Reihe Falltüren (2 hoch) an der Nord- oder Westkante.
function buildCeilingFlaps(b) {
  for (let i = OPEN_FIELD[0]; i <= OPEN_FIELD[1]; i++) {
    for (let j = OPEN_FIELD[0]; j <= OPEN_FIELD[1]; j++) {
      const x0 = 4 * i + 1;
      const z0 = 4 * j + 1;
      const northEdge = (i + j) % 2 === 0;
      for (const y of [TOP_Y - 1, TOP_Y - 2]) {
        if (northEdge) b.fill(x0, y, z0, x0 + 2, y, z0, `${P.flap}[facing=south,half=top,open=true]`);
        else b.fill(x0, y, z0, x0, y, z0 + 2, `${P.flap}[facing=east,half=top,open=true]`);
      }
    }
  }
}

function buildCeilingLanterns(b) {
  for (let x = 12; x <= 132; x += 4) {
    for (let z = 12; z <= 132; z += 4) {
      const axis = x >= 56 && x <= 88 && z >= 56 && z <= 88;
      if (axis || !b.chance(0.12)) continue;
      const length = b.rngInt(3, 10);
      b.fill(x, TOP_Y - length, z, x, TOP_Y - 1, z, CHAIN);
      b.set(x, TOP_Y - length - 1, z, LANTERN_HANGING);
    }
  }
}

// --- Bauablauf ---

export default function build(b) {
  const openings = planOpenings();
  // Erst Luft der Sturzkante festlegen, damit sie in mehreren Kapiteln gleich bleibt
  const zenitsuBreaks = [];
  for (let x = ZENITSU.x[0]; x <= ZENITSU.x[1]; x++) zenitsuBreaks.push(b.rngInt(2, 4));

  b.transform({ offset: [EAVE, 0, EAVE] }, () => {
    b.phase('Grund und Wasserspiegel');
    buildHallFloor(b);

    b.phase('Säulenwald');
    buildPillarForest(b);

    b.phase('Muzans Empore und Aufgänge');
    onSide(b, 0, () => buildHallWallSide(b));
    onSide(b, 1, () => buildHallWallSide(b));
    onSide(b, 2, () => buildHallWallSide(b));
    onSide(b, 3, () => buildHallWallSide(b));
    buildEmpore(b);
    for (let side = 0; side < 4; side++) onSide(b, side, () => buildHallStair(b));

    b.phase('Schachtwände, Geschosse 1–6');
    buildStoreys(b, 40, 80, openings);

    b.phase('Schachtwände, Geschosse 7–13');
    buildStoreys(b, 88, 136, openings);

    b.phase('Schachtwände, Geschosse 14–19');
    buildStoreys(b, 144, 184, openings);

    b.phase('Brücken');
    for (const br of BRIDGES) {
      b.step();
      buildBridge(b, br);
    }

    b.phase('Schwebetreppen');
    for (const s of FLOATING_STAIRS) {
      b.step();
      onSide(b, s.side, () => buildFloatingStair(b, s));
    }

    b.phase('Raumwürfel');
    for (const cube of CUBES) {
      b.step();
      buildRoomCube(b, cube);
    }

    b.phase('Zenitsus Sturzraum');
    b.step();
    buildZenitsuFloor(b, zenitsuBreaks);
    b.step();
    buildZenitsuWalls(b, zenitsuBreaks);
    b.step();
    buildZenitsuCeiling(b, zenitsuBreaks);

    b.phase('Akazas Halle');
    b.step();
    buildAkazaFloor(b);
    b.step();
    buildSnowflake(b);
    b.step();
    buildAkazaWalls(b);
    b.step();
    buildAkazaRoof(b);

    b.phase('Domas Lotushalle');
    b.step();
    buildDomaFloor(b);
    b.step();
    buildDomaPool(b);
    b.step();
    buildDomaWalls(b);
    b.step();
    buildDomaCeiling(b);

    b.phase('Kokushibos Säulenhalle');
    b.step();
    buildKokushiboFloor(b);
    b.step();
    buildKokushiboWalls(b);
    b.step();
    buildKokushiboCeiling(b);
    b.step();
    buildKokushiboPillars(b);

    b.phase('Nakimes Bühne');
    b.step();
    buildNakimeStage(b);
    b.step();
    buildNakimeChains(b);

    b.phase('Sturzdecke');
    b.step();
    buildCeilingBeams(b);
    b.step();
    buildCeilingFields(b);
    b.step();
    buildCeilingFlaps(b);
    b.step();
    buildCeilingLanterns(b);

    b.phase('Außenhaut und Vordächer');
    b.step();
    buildEavesRange(b, 0, 9);
    b.step();
    buildEavesRange(b, 10, 19);
  });
}

// Vordach-Reihe i liegt auf y 39 + 8 · i (Höhe der Kantenbalken), 1 Block vor der Außenwand.
function buildEavesRange(b, fromIndex, toIndex) {
  for (let i = fromIndex; i <= toIndex; i++) {
    const y = FIRST_STOREY_Y - 1 + i * STOREY_HEIGHT;
    for (let side = 0; side < 4; side++) onSide(b, side, () => b.fill(-1, y, -1, MAX, y, -1, `${P.roofSlab}[type=top]`));
  }
}
