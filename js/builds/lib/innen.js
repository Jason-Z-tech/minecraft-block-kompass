// Einrichtung für Bau-Module (ARCHITEKTUR §9.1): Möbel und Räume pro Raumart plus lightRoom (Licht gegen Monster).
// Gleicher Rahmen wie bauteile.js: fn(b, { x, y, z, facing = 'south', … }) → Box { min, max } (Koordinaten des Aufrufers).
// Räume: Ursprung = hintere linke Ecke auf Bodenhöhe (die erste Luftebene über dem Fußboden), von der Tür aus gesehen.
// Die Rückwand liegt hinter lz = −1, die Möbel stehen an ihr und schauen nach vorne (facing); der Raum reicht width
// nach rechts (lokal +x) und depth nach vorne.

import { formatState, parseState, stateId, isAirState } from '../../core/blockstate.js';
import { isBlockDataLoaded, completeState } from '../../core/block-data.js';
import { isFullSolidState } from '../../core/connections.js';
import { hashPosition } from '../../core/random.js';
import { blockLightEmission } from '../../render/block-models.js';
import { WOOD, COLOR } from './palettes.js';
import { partOptions, checkInt, checkChoice, checkId, placeOriented, orientedBox, withAxis } from './bauteile.js';

const stairs = (id, facing, half = 'bottom') => formatState(id, { facing, half });
const slab = (id, type) => formatState(id, { type });

// Holz-Palette per Name ('fichte') oder als Objekt aus palettes.js.
function woodPalette(fn, value) {
  if (typeof value === 'string') {
    const palette = WOOD[value];
    if (!palette) throw new Error(`${fn}: unbekanntes Holz „${value}“ (erlaubt: ${Object.keys(WOOD).join(', ')}).`);
    return palette;
  }
  if (value && typeof value === 'object' && typeof value.planks === 'string') return value;
  throw new Error(`${fn}: wood muss ein Holzname (z. B. 'fichte') oder eine Holz-Palette sein.`);
}

function colorPalette(fn, value) {
  const palette = COLOR[value];
  if (!palette) throw new Error(`${fn}: unbekannte Farbe „${value}“ (erlaubt: ${Object.keys(COLOR).join(', ')}).`);
  return palette;
}

function checkBool(fn, name, value) {
  if (typeof value !== 'boolean') throw new Error(`${fn}: ${name} muss true oder false sein.`);
  return value;
}

// Kleiner, ortsfester Zufall (unabhängig von der Aufruf-Reihenfolge).
function variant(o, lx, lz, salt, n) {
  return hashPosition(o.x * 31 + lx, o.y, o.z * 17 + lz, salt) % n;
}

// ------------------------------------------------------------------ Schlafzimmer

// Bett an der Rückwand (Kopfteil hinten), Nachttische mit Licht, Truhe am Fußende, Teppich, Bücherregal mit Topfpflanze.
// width ≥ 3, depth ≥ 3 (Teppich ab depth 4). double: zwei Betten nebeneinander (width ≥ 4).
export function bedroom(b, options) {
  const o = partOptions('bedroom', b, options, { width: 5, depth: 5, wood: 'fichte', color: 'rot', rug: 'weiss', double: false });
  checkInt('bedroom', 'width', o.width, 3, 64);
  checkInt('bedroom', 'depth', o.depth, 3, 64);
  checkBool('bedroom', 'double', o.double);
  if (o.double && o.width < 4) throw new Error('bedroom: ein Doppelbett braucht width ≥ 4.');
  const wood = woodPalette('bedroom', o.wood);
  const bedColor = colorPalette('bedroom', o.color);
  const rug = o.rug === null || o.rug === false ? null : colorPalette('bedroom', o.rug);
  const W = o.width - 1;
  const bedLo = Math.floor((o.width - (o.double ? 2 : 1)) / 2);
  const bedHi = bedLo + (o.double ? 1 : 0);
  placeOriented(b, o, () => {
    for (let lx = bedLo; lx <= bedHi; lx++) b.bed(lx, 0, 1, bedColor.bed, { facing: 'north' });
    for (const lx of [bedLo - 1, bedHi + 1]) {
      if (lx < 0 || lx > W) continue;
      b.set(lx, 0, 0, formatState('barrel', { facing: 'up' }));
      b.set(lx, 1, 0, lx < bedLo ? formatState('lantern', { hanging: 'false' }) : formatState('candle', { candles: '3', lit: 'true' }));
    }
    if (o.depth >= 3) b.set(bedLo, 0, 2, formatState('chest', { facing: 'north', type: 'single' }));
    if (rug && o.depth >= 4) {
      const zEnd = Math.min(o.depth - 1, 4);
      for (let lz = 3; lz <= zEnd; lz++) for (let lx = Math.max(0, bedLo - 1); lx <= Math.min(W, bedHi + 1); lx++) b.set(lx, 0, lz, rug.carpet);
    }
    const corner = bedLo - 1 > 0 ? 0 : bedHi + 1 < W ? W : null;
    if (corner !== null && o.depth >= 4) {
      b.set(corner, 0, 0, 'bookshelf');
      b.set(corner, 1, 0, ['potted_fern', 'potted_azalea_bush', 'potted_red_tulip'][variant(o, corner, 0, 3, 3)]);
    }
    if (o.width >= 6 && o.depth >= 5) {
      const lx = corner === 0 ? W : 0;
      b.set(lx, 0, o.depth - 2, wood.planks);
      b.set(lx, 1, o.depth - 2, wood.planks);
      b.set(lx, 0, o.depth - 1, wood.planks);
      b.set(lx, 1, o.depth - 1, wood.planks);
      const front = lx === 0 ? 'east' : 'west';
      for (const lz of [o.depth - 2, o.depth - 1]) for (let ly = 0; ly <= 1; ly++) b.set(lx === 0 ? 1 : W - 1, ly, lz, formatState(wood.trapdoor, { facing: front, half: 'bottom', open: 'true' }));
    }
  });
  return orientedBox(o, [0, 0, 0], [W, 1, o.depth - 1]);
}

// ------------------------------------------------------------------ Küche

const KITCHEN_ROW = ['smoker', 'water_cauldron', 'barrel', 'furnace', 'crafting_table', 'barrel', 'composter'];

// Arbeitszeile an der Rückwand: Räucherofen (mit Trichter-Abzug darüber), Kessel mit Wasser (Spüle), Fass, Ofen,
// Werkbank …; darüber Hängeschränke aus oberen Treppen. width ≥ 4, braucht 3 Ebenen Raumhöhe.
export function kitchen(b, options) {
  const o = partOptions('kitchen', b, options, { width: 5, wood: 'fichte', cabinets: true });
  checkInt('kitchen', 'width', o.width, 4, 64);
  checkBool('kitchen', 'cabinets', o.cabinets);
  const wood = woodPalette('kitchen', o.wood);
  const W = o.width - 1;
  placeOriented(b, o, () => {
    for (let lx = 0; lx <= W; lx++) {
      const id = KITCHEN_ROW[lx] ?? (lx === W ? 'barrel' : wood.planks);
      let state = id;
      if (id === 'smoker' || id === 'furnace') state = formatState(id, { facing: 'south', lit: 'false' });
      else if (id === 'barrel') state = formatState('barrel', { facing: 'south' });
      else if (id === 'water_cauldron') state = formatState('water_cauldron', { level: '3' });
      b.set(lx, 0, 0, state);
      if (id === 'smoker') b.set(lx, 2, 0, formatState('hopper', { facing: 'down' }));
      else if (o.cabinets) b.set(lx, 2, 0, stairs(wood.stairs, 'north', 'top'));
    }
    const decor = ['flower_pot', formatState('candle', { candles: '2', lit: 'false' }), 'potted_fern'];
    for (let lx = 0; lx <= W; lx++) {
      const id = KITCHEN_ROW[lx] ?? wood.planks;
      if ((id === 'barrel' || id === wood.planks || id === 'crafting_table') && variant(o, lx, 0, 11, 2) === 0) b.set(lx, 1, 0, decor[variant(o, lx, 0, 12, decor.length)]);
    }
  });
  return orientedBox(o, [0, 0, 0], [W, 2, 0]);
}

// ------------------------------------------------------------------ Esstisch

// Tisch (length entlang lokal x, width 1 oder 2 tief) mit Stühlen aus Treppen auf beiden Langseiten und optional
// an den Stirnseiten. Ursprung = linke hintere Tischecke; die Stühle stehen eine Zelle um den Tisch herum.
// top 'slab' (obere Stufen, mit Kerzen/Blumen) oder 'carpet' (Zaunbeine mit Teppich).
export function diningTable(b, options) {
  const o = partOptions('diningTable', b, options, { length: 3, width: 1, wood: 'fichte', top: 'slab', cloth: 'weiss', headChairs: true, decor: true });
  checkInt('diningTable', 'length', o.length, 1, 32);
  checkChoice('diningTable', 'width', o.width, [1, 2]);
  checkChoice('diningTable', 'top', o.top, ['slab', 'carpet']);
  checkBool('diningTable', 'headChairs', o.headChairs);
  checkBool('diningTable', 'decor', o.decor);
  const wood = woodPalette('diningTable', o.wood);
  const cloth = colorPalette('diningTable', o.cloth);
  const L = o.length - 1;
  const D = o.width - 1;
  placeOriented(b, o, () => {
    for (let lx = 0; lx <= L; lx++) {
      for (let lz = 0; lz <= D; lz++) {
        if (o.top === 'slab') b.set(lx, 0, lz, slab(wood.slab, 'top'));
        else {
          b.set(lx, 0, lz, wood.fence);
          b.set(lx, 1, lz, cloth.carpet);
        }
      }
      b.set(lx, 0, -1, stairs(wood.stairs, 'north'));
      b.set(lx, 0, D + 1, stairs(wood.stairs, 'south'));
    }
    if (o.headChairs) {
      b.set(-1, 0, 0, stairs(wood.stairs, 'west'));
      b.set(L + 1, 0, D, stairs(wood.stairs, 'east'));
    }
    if (o.decor && o.top === 'slab') {
      const items = [formatState('candle', { candles: '3', lit: 'false' }), 'potted_red_tulip', formatState('white_candle', { candles: '2', lit: 'false' }), 'potted_lily_of_the_valley'];
      for (let lx = 0; lx <= L; lx += 2) b.set(lx, 1, variant(o, lx, 0, 21, o.width), items[variant(o, lx, 0, 22, items.length)]);
    }
  });
  const r = o.headChairs ? 1 : 0;
  return orientedBox(o, [-r, 0, -1], [L + r, o.top === 'carpet' || o.decor ? 1 : 0, D + 1]);
}

// ------------------------------------------------------------------ Bücherwand

// Bücherwand vor der Rückwand (lz 0): Bücherregale, dazwischen gefüllte Bücherregale (chiseled), Ständer aus Stämmen
// an den Enden, oben ein Kranz aus oberen Treppen. ladder: Leiter in der Mitte (lz 1).
export function bookWall(b, options) {
  const o = partOptions('bookWall', b, options, { width: 5, height: 3, wood: 'schwarzeiche', chiseled: true, crown: true, ladder: false });
  checkInt('bookWall', 'width', o.width, 1, 128);
  checkInt('bookWall', 'height', o.height, 1, 32);
  checkBool('bookWall', 'chiseled', o.chiseled);
  checkBool('bookWall', 'crown', o.crown);
  checkBool('bookWall', 'ladder', o.ladder);
  const wood = woodPalette('bookWall', o.wood);
  const W = o.width - 1;
  const H = o.height - 1;
  const ladderX = Math.floor(W / 2);
  placeOriented(b, o, () => {
    for (let lx = 0; lx <= W; lx++) {
      const post = o.width >= 3 && (lx === 0 || lx === W || (o.width > 7 && lx % 4 === 0));
      for (let ly = 0; ly <= H; ly++) {
        if (post) { b.set(lx, ly, 0, withAxis(wood.log, 'y')); continue; }
        if (o.chiseled && variant(o, lx, ly, 31, 5) === 0) {
          const slots = {};
          for (let s = 0; s < 6; s++) slots[`slot_${s}_occupied`] = String(variant(o, lx * 7 + s, ly, 32, 3) > 0);
          b.set(lx, ly, 0, formatState('chiseled_bookshelf', { facing: 'south', ...slots }));
        } else b.set(lx, ly, 0, 'bookshelf');
      }
      if (o.crown) b.set(lx, H + 1, 0, stairs(wood.stairs, 'north', 'top'));
    }
    if (o.ladder) for (let ly = 0; ly <= H; ly++) b.set(ladderX, ly, 1, formatState('ladder', { facing: 'south' }));
  });
  return orientedBox(o, [0, 0, 0], [W, o.crown ? H + 1 : H, o.ladder ? 1 : 0]);
}

// ------------------------------------------------------------------ Lager

// Lagerwand an der Rückwand (lz 0): Doppeltruhen (je 2 breit) und Fässer im Wechsel, height Ebenen hoch gestapelt.
export function storage(b, options) {
  const o = partOptions('storage', b, options, { width: 5, height: 2, chest: 'chest', barrel: true });
  checkInt('storage', 'width', o.width, 2, 128);
  checkInt('storage', 'height', o.height, 1, 3);
  checkBool('storage', 'barrel', o.barrel);
  const chest = checkId('storage', 'chest', o.chest);
  if (!/(^|_)chest$/.test(chest) || chest === 'ender_chest') throw new Error('storage: chest muss eine Truhe sein, die Doppeltruhen bildet (chest, trapped_chest, *copper_chest).');
  const W = o.width - 1;
  const unit = o.barrel ? 3 : 2;
  placeOriented(b, o, () => {
    let lx = 0;
    while (lx <= W) {
      for (let ly = 0; ly < o.height; ly++) {
        if (lx + 1 <= W) {
          // Truhen schauen nach vorne (lokal Süden): die westliche Hälfte ist 'right', die östliche 'left'.
          b.set(lx, ly, 0, formatState(chest, { facing: 'south', type: 'right' }));
          b.set(lx + 1, ly, 0, formatState(chest, { facing: 'south', type: 'left' }));
        } else b.set(lx, ly, 0, formatState('barrel', { facing: 'south' }));
        if (o.barrel && lx + 2 <= W) b.set(lx + 2, ly, 0, formatState('barrel', { facing: 'south' }));
      }
      lx += unit;
    }
  });
  return orientedBox(o, [0, 0, 0], [W, o.height - 1, 0]);
}

// ------------------------------------------------------------------ Zaubertisch

// Positionen der 15 Bücherregale relativ zum Zaubertisch (lokal, Öffnung nach vorne = +z).
export const ENCHANTING_SHELVES = Object.freeze([
  ...[-2, -1, 0, 1, 2].map((dx) => [dx, 0, -2]), [-2, 0, -1], [2, 0, -1], [-2, 0, 0], [2, 0, 0],
  ...[-2, -1, 1, 2].map((dx) => [dx, 1, -2]), [-2, 1, -1], [2, 1, -1],
].map(Object.freeze));

// Zaubertisch mit genau 15 Bücherregalen für Stufe 30 (wie EnchantingTableBlock in 26.2: Regale 2 Felder entfernt auf
// Tischhöhe oder eine höher, das Feld dazwischen frei). Ursprung = Zaubertisch, Öffnung vorne (facing).
// Die 3 × 3 Felder um den Tisch bleiben frei (Luft). lights: Laterne und Kerzen auf den Regalen.
export function enchantingSetup(b, options) {
  const o = partOptions('enchantingSetup', b, options, { lights: true });
  checkBool('enchantingSetup', 'lights', o.lights);
  placeOriented(b, o, () => {
    b.set(0, 0, 0, 'enchanting_table');
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) { b.set(dx, 0, dz, 'air'); b.set(dx, 1, dz, 'air'); }
    for (const [dx, dy, dz] of ENCHANTING_SHELVES) b.set(dx, dy, dz, 'bookshelf');
    if (o.lights) {
      b.set(0, 1, -2, formatState('lantern', { hanging: 'false' }));
      b.set(-2, 2, -2, formatState('candle', { candles: '3', lit: 'true' }));
      b.set(2, 2, -2, formatState('candle', { candles: '2', lit: 'true' }));
      b.set(-2, 1, 0, formatState('candle', { candles: '1', lit: 'true' }));
      b.set(2, 1, 0, formatState('candle', { candles: '1', lit: 'true' }));
    }
  });
  return orientedBox(o, [-2, 0, -2], [2, o.lights ? 2 : 1, 1]);
}

// ------------------------------------------------------------------ Werkstatt

const WORKSHOP_ROW = ['crafting_table', 'smithing_table', 'anvil', 'grindstone', 'stonecutter', 'fletching_table', 'cartography_table', 'loom', 'barrel', 'blast_furnace'];

// Werkbank-Zeile an der Rückwand (lz 0) in dieser Reihenfolge, so viele wie width erlaubt (Rest: Fässer);
// shelves: Regale (26.x) eine Ebene darüber, damit Werkzeug ausgestellt werden kann.
export function workshop(b, options) {
  const o = partOptions('workshop', b, options, { width: 6, wood: 'fichte', shelves: true });
  checkInt('workshop', 'width', o.width, 2, 64);
  checkBool('workshop', 'shelves', o.shelves);
  const wood = woodPalette('workshop', o.wood);
  const W = o.width - 1;
  placeOriented(b, o, () => {
    for (let lx = 0; lx <= W; lx++) {
      const id = WORKSHOP_ROW[lx] ?? 'barrel';
      let state = id;
      if (id === 'anvil' || id === 'stonecutter' || id === 'loom') state = formatState(id, { facing: id === 'anvil' ? 'east' : 'south' });
      else if (id === 'grindstone') state = formatState(id, { face: 'floor', facing: 'east' });
      else if (id === 'barrel') state = formatState(id, { facing: 'south' });
      else if (id === 'blast_furnace') state = formatState(id, { facing: 'south', lit: 'false' });
      b.set(lx, 0, 0, state);
      if (o.shelves && wood.shelf) b.set(lx, 2, 0, formatState(wood.shelf, { facing: 'south' }));
    }
  });
  return orientedBox(o, [0, 0, 0], [W, o.shelves && wood.shelf ? 2 : 0, 0]);
}

// ------------------------------------------------------------------ Kamin

// Kamin an der Rückwand. Ursprung = Mitte vorne auf Bodenhöhe; Körper lx −1 … 1, lz 0 (hinten, an der Wand) und
// lz 1 (vorne, Wangen). Das Lagerfeuer brennt vertieft hinten, darüber Sturz, Kaminsims (obere Treppen, 5 breit),
// Deko auf dem Sims und der Schlot bis height − 1 (Raumhöhe). height ≥ 4.
export function fireplace(b, options) {
  const o = partOptions('fireplace', b, options, { height: 4, block: 'bricks', mantel: 'dark_oak_stairs', fire: 'campfire', decor: true });
  checkInt('fireplace', 'height', o.height, 4, 64);
  checkChoice('fireplace', 'fire', o.fire, ['campfire', 'soul_campfire']);
  checkBool('fireplace', 'decor', o.decor);
  const block = checkId('fireplace', 'block', o.block);
  const mantel = checkId('fireplace', 'mantel', o.mantel, { suffix: '_stairs' });
  const H = o.height - 1;
  placeOriented(b, o, () => {
    for (let ly = 0; ly <= H; ly++) for (let lx = -1; lx <= 1; lx++) b.set(lx, ly, 0, block);
    b.set(0, 0, 0, formatState(o.fire, { facing: 'south', lit: 'true', signal_fire: 'false' }));
    b.set(-1, 0, 1, block);
    b.set(1, 0, 1, block);
    b.set(0, 0, 1, 'air');
    b.set(-1, 1, 1, block);
    b.set(1, 1, 1, block);
    b.set(0, 1, 1, stairs(mantel, 'north', 'top'));
    for (let lx = -2; lx <= 2; lx++) b.set(lx, 2, 1, stairs(mantel, 'north', 'top'));
    if (o.decor) {
      b.set(-2, 3, 1, formatState('candle', { candles: '2', lit: 'true' }));
      b.set(0, 3, 1, 'potted_azalea_bush');
      b.set(2, 3, 1, formatState('candle', { candles: '3', lit: 'true' }));
    }
  });
  return orientedBox(o, [-2, 0, 0], [2, H, 1]);
}

// ------------------------------------------------------------------ Licht (lightRoom)

export const LIGHT_MAX = 15;

// Was Licht in diesem Modell durchlässt: Luft und kleine, nicht volle Blöcke (vorsichtig: im Zweifel blockiert).
const LIGHT_PASSABLE = /(^|_)(lantern|torch|wall_torch|candle|carpet|chain|glass_pane|bars|fence|button|pressure_plate|rail|sign|banner|flower_pot)$|^potted_|^(redstone_wire|lever|tripwire|tripwire_hook|ladder|vine|end_rod|lightning_rod|cobweb)$/;

function isAir(state) {
  return isAirState(state);
}

function passesLight(state) {
  return isAir(state) || LIGHT_PASSABLE.test(stateId(state));
}

function emissionOf(state) {
  if (isAir(state)) return 0;
  const full = isBlockDataLoaded() ? completeState(state) : state;
  const { id, props } = parseState(full);
  return blockLightEmission(id, props);
}

function readBox(fn, box) {
  if (!box || typeof box !== 'object') throw new Error(`${fn}: box muss { x1, y1, z1, x2, y2, z2 } sein.`);
  for (const key of Object.keys(box)) if (!['x1', 'y1', 'z1', 'x2', 'y2', 'z2'].includes(key)) throw new Error(`${fn}: box kennt „${key}“ nicht (erlaubt: x1, y1, z1, x2, y2, z2).`);
  for (const key of ['x1', 'y1', 'z1', 'x2', 'y2', 'z2']) if (!Number.isInteger(box[key])) throw new Error(`${fn}: box.${key} muss eine ganze Zahl sein.`);
  const r = {
    x1: Math.min(box.x1, box.x2), x2: Math.max(box.x1, box.x2), y1: Math.min(box.y1, box.y2), y2: Math.max(box.y1, box.y2),
    z1: Math.min(box.z1, box.z2), z2: Math.max(box.z1, box.z2),
  };
  const volume = (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1) * (r.z2 - r.z1 + 1);
  if (volume > 2_000_000) throw new Error(`${fn}: der Raum ist zu groß (${volume} Felder, höchstens 2 000 000) – teile ihn auf.`);
  return r;
}

// Liest den Raum (plus eine Hülle außen, für Boden/Decke/Wände) in ein Raster.
function scanRoom(b, r) {
  const sx = r.x2 - r.x1 + 1;
  const sy = r.y2 - r.y1 + 1;
  const sz = r.z2 - r.z1 + 1;
  const index = (x, y, z) => ((y - r.y1) * sz + (z - r.z1)) * sx + (x - r.x1);
  const states = new Array(sx * sy * sz);
  for (let y = r.y1; y <= r.y2; y++) for (let z = r.z1; z <= r.z2; z++) for (let x = r.x1; x <= r.x2; x++) states[index(x, y, z)] = b.get(x, y, z);
  const at = (x, y, z) => (x < r.x1 || x > r.x2 || y < r.y1 || y > r.y2 || z < r.z1 || z > r.z2 ? b.get(x, y, z) : states[index(x, y, z)]);
  return { sx, sy, sz, index, states, at };
}

const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Blocklicht im Raum: Ausbreitung von allen Lichtquellen im Raum, −1 je Schritt, nur durch lichtdurchlässige Felder.
function computeLight(room, r) {
  const light = new Uint8Array(room.states.length);
  const queue = [];
  for (let y = r.y1; y <= r.y2; y++) {
    for (let z = r.z1; z <= r.z2; z++) {
      for (let x = r.x1; x <= r.x2; x++) {
        const level = emissionOf(room.states[room.index(x, y, z)]);
        if (level > 0) {
          light[room.index(x, y, z)] = level;
          queue.push(x, y, z);
        }
      }
    }
  }
  spread(room, r, light, queue);
  return light;
}

function spread(room, r, light, queue) {
  for (let head = 0; head < queue.length; head += 3) {
    const x = queue[head];
    const y = queue[head + 1];
    const z = queue[head + 2];
    const next = light[room.index(x, y, z)] - 1;
    if (next <= 0) continue;
    for (const [dx, dy, dz] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (nx < r.x1 || nx > r.x2 || ny < r.y1 || ny > r.y2 || nz < r.z1 || nz > r.z2) continue;
      const i = room.index(nx, ny, nz);
      if (light[i] >= next || !passesLight(room.states[i])) continue;
      light[i] = next;
      queue.push(nx, ny, nz);
    }
  }
}

// Begehbar = Luft im Raum mit einem Block darunter (dort könnte ein Monster stehen).
function walkableCells(room, r) {
  const cells = [];
  for (let y = r.y1; y <= r.y2; y++) {
    for (let z = r.z1; z <= r.z2; z++) {
      for (let x = r.x1; x <= r.x2; x++) {
        if (isAir(room.states[room.index(x, y, z)]) && !isAir(room.at(x, y - 1, z))) cells.push([x, y, z]);
      }
    }
  }
  return cells;
}

// Begehbare Felder mit Blocklicht 0 (in 26.2 spawnen Monster nur dort) → [[x, y, z], …] in Aufrufer-Koordinaten.
export function findDarkSpots(b, box) {
  const r = readBox('findDarkSpots', box);
  const room = scanRoom(b, r);
  const light = computeLight(room, r);
  return walkableCells(room, r).filter(([x, y, z]) => light[room.index(x, y, z)] === 0);
}

// Licht für einen Raum. box = Luftraum innen { x1, y1, z1, x2, y2, z2 } (inklusive, Koordinaten des Aufrufers).
// Setzt so lange Laternen, bis jedes begehbare Feld Blocklicht > 0 hat (rechnerisch: Licht −1 je Block, nur durch
// Luft und kleine Blöcke wie Laternen, Teppiche, Zäune). Bestehende Lichtquellen im Raum zählen mit.
// lantern: 'lantern' (15) | 'soul_lantern' (10) | Kupferlaterne (15); mode 'auto' (an die Decke, wenn der Raum
// mindestens 3 hoch ist, sonst auf den Boden an die Wand) | 'ceiling' | 'floor'. → { placed: [[x, y, z], …], walkable }
export function lightRoom(b, box, options = {}) {
  if (!b || typeof b.get !== 'function' || typeof b.set !== 'function') throw new Error('lightRoom: der erste Parameter muss der Builder b sein.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('lightRoom: Optionen müssen ein Objekt sein.');
  for (const key of Object.keys(options)) if (!['lantern', 'mode', 'chain'].includes(key)) throw new Error(`lightRoom: unbekannte Option „${key}“ (erlaubt: lantern, mode, chain).`);
  const r = readBox('lightRoom', box);
  const lantern = checkId('lightRoom', 'lantern', options.lantern ?? 'lantern');
  if (!/(^|_)lantern$/.test(lantern)) throw new Error('lightRoom: lantern muss eine Laterne sein (lantern, soul_lantern, *copper_lantern).');
  const mode = checkChoice('lightRoom', 'mode', options.mode ?? 'auto', ['auto', 'ceiling', 'floor']);
  const height = r.y2 - r.y1 + 1;
  // Kettenglieder über hängenden Laternen: Standard so, dass die Laterne etwa 3 Ebenen über dem Boden hängt.
  const chain = options.chain === undefined || options.chain === 'auto' ? Math.max(0, height - 4) : checkInt('lightRoom', 'chain', options.chain, 0, Math.max(0, height - 3));
  const level = emissionOf(formatState(lantern, { hanging: 'false' }));
  const room = scanRoom(b, r);
  const light = computeLight(room, r);
  const walkable = walkableCells(room, r);
  const useCeiling = mode === 'ceiling' || (mode === 'auto' && height >= 3);
  const placed = [];
  const isDark = ([x, y, z]) => light[room.index(x, y, z)] === 0 && isAir(room.states[room.index(x, y, z)]);
  let dark = walkable.filter(isDark);
  while (dark.length > 0) {
    const spot = chooseLampSpot(room, r, light, dark, dark[0], level, useCeiling, chain);
    const state = formatState(lantern, { hanging: String(spot.hanging) });
    for (let k = 1; k <= spot.chain; k++) {
      const link = formatState('iron_chain', { axis: 'y' });
      b.set(spot.x, spot.y + k, spot.z, link);
      room.states[room.index(spot.x, spot.y + k, spot.z)] = link;
    }
    b.set(spot.x, spot.y, spot.z, state);
    room.states[room.index(spot.x, spot.y, spot.z)] = state;
    light[room.index(spot.x, spot.y, spot.z)] = Math.max(light[room.index(spot.x, spot.y, spot.z)], level);
    spread(room, r, light, [spot.x, spot.y, spot.z]);
    placed.push([spot.x, spot.y, spot.z]);
    dark = dark.filter(isDark);
  }
  return { placed, walkable: walkable.length };
}

// Sucht für das dunkle Feld d einen Laternenplatz, der d erreicht und möglichst viele dunkle Felder hell macht.
function chooseLampSpot(room, r, light, dark, d, level, useCeiling, chain) {
  const reach = bfsDistances(room, r, d, level - 1);
  const darkSet = new Set(dark.map(([x, y, z]) => room.index(x, y, z)));
  const candidates = [];
  for (const [i, x, y, z] of reach) {
    const placement = lampPlacement(room, r, x, y, z, useCeiling, chain);
    if (placement) candidates.push({ i, x, y, z, ...placement });
  }
  if (candidates.length === 0) return { x: d[0], y: d[1], z: d[2], hanging: false, chain: 0 };
  const best = { score: -1, spot: null };
  const preferred = candidates.filter((c) => c.preferred);
  const pool = preferred.length > 0 ? preferred : candidates;
  // Große Hallen: höchstens ~300 Kandidaten bewerten (gleichmäßig ausgedünnt, deterministisch).
  const stride = Math.max(1, Math.ceil(pool.length / 300));
  for (let k = 0; k < pool.length; k += stride) {
    const c = pool[k];
    let score = 0;
    for (const [i] of bfsDistances(room, r, [c.x, c.y, c.z], level - 1, light, level)) if (darkSet.has(i) && i !== c.i) score++;
    if (score > best.score) {
      best.score = score;
      best.spot = { x: c.x, y: c.y, z: c.z, hanging: c.hanging, chain: c.chain };
    }
  }
  return best.spot;
}

const canCarry = (state) => !isAir(state) && (isFullSolidState(state) || /(_chain|_fence|_wall|_slab)$/.test(stateId(state)));

// Darf hier eine Laterne hin? Hängend (an chain Kettengliedern) unter einem tragenden Block, sonst direkt darunter,
// oder stehend auf einem vollen Block. preferred: an der Decke (useCeiling) bzw. am Boden direkt an einer Wand.
function lampPlacement(room, r, x, y, z, useCeiling, chain) {
  if (!isAir(room.at(x, y, z))) return null;
  // Bevorzugt an der Decke des Raums (oberste Ebene der Box), mit Kette etwas tiefer.
  if (useCeiling && chain > 0 && y + chain === r.y2) {
    let free = true;
    for (let k = 1; k <= chain && free; k++) free = isAir(room.at(x, y + k, z));
    if (free && canCarry(room.at(x, y + chain + 1, z))) return { hanging: true, chain, preferred: true };
  }
  const canHang = canCarry(room.at(x, y + 1, z));
  if (useCeiling && canHang && chain === 0 && y === r.y2) return { hanging: true, chain: 0, preferred: true };
  const below = room.at(x, y - 1, z);
  if (!isAir(below) && isFullSolidState(below)) {
    const byWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isFullSolidState(room.at(x + dx, y, z + dz)));
    return { hanging: false, chain: 0, preferred: !useCeiling && byWall };
  }
  if (canHang) return { hanging: true, chain: 0, preferred: false };
  return null;
}

// Felder im Abstand ≤ maxDist (durch lichtdurchlässige Felder). Mit light/level: nur Felder, deren Licht dadurch stiege.
function bfsDistances(room, r, [sx, sy, sz], maxDist, light = null, level = 0) {
  const seen = new Map([[room.index(sx, sy, sz), 0]]);
  const out = [[room.index(sx, sy, sz), sx, sy, sz]];
  const queue = [sx, sy, sz, 0];
  for (let head = 0; head < queue.length; head += 4) {
    const dist = queue[head + 3];
    if (dist >= maxDist) continue;
    for (const [dx, dy, dz] of NEIGHBORS) {
      const nx = queue[head] + dx;
      const ny = queue[head + 1] + dy;
      const nz = queue[head + 2] + dz;
      if (nx < r.x1 || nx > r.x2 || ny < r.y1 || ny > r.y2 || nz < r.z1 || nz > r.z2) continue;
      const i = room.index(nx, ny, nz);
      if (seen.has(i) || !passesLight(room.states[i])) continue;
      if (light && light[i] >= level - dist - 1) continue;
      seen.set(i, dist + 1);
      out.push([i, nx, ny, nz]);
      queue.push(nx, ny, nz, dist + 1);
    }
  }
  return out;
}
