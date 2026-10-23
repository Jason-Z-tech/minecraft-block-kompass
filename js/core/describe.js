// Deutsche Namen und Bauanweisungen zu Blockzuständen (§6.6). Bedeutungen der Eigenschaften: §4.

import { parseStateCached } from './blockstate.js';
import { wallVariantBase } from './materials.js';

let names = { block: {}, item: {} };

export function setNames(json) {
  if (!json || typeof json !== 'object') throw new Error('Namensdaten ungültig (erwartet wird game-data/names.json).');
  const block = json.block && typeof json.block === 'object' ? json.block : {};
  const item = json.item && typeof json.item === 'object' ? json.item : {};
  names = { block, item };
}

function nameFrom(table, id) {
  if (!Object.hasOwn(table, id)) return null;
  const entry = table[id];
  if (entry && typeof entry.de === 'string' && entry.de) return entry.de;
  if (entry && typeof entry.en === 'string' && entry.en) return entry.en;
  return null;
}

export function blockName(id) {
  const own = nameFrom(names.block, id) ?? nameFrom(names.item, id);
  if (own) return own;
  // Wandvarianten ohne eigenen Sprachschlüssel (Wandbanner) heißen im Spiel wie der stehende Block (overrideDescription)
  const base = wallVariantBase(id);
  return (base && (nameFrom(names.block, base) ?? nameFrom(names.item, base))) || id;
}

export function itemName(id) {
  return nameFrom(names.item, id) ?? nameFrom(names.block, id) ?? id;
}

// „Steinziegel · minecraft:stone_bricks“
export function blockLabel(id) {
  return `${blockName(id)} · minecraft:${id}`;
}

const DIR_DE = { north: 'Norden', south: 'Süden', east: 'Osten', west: 'Westen', up: 'oben', down: 'unten' };
const SIDE_DE = { north: 'Nordseite', south: 'Südseite', east: 'Ostseite', west: 'Westseite' };
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
const ROTATION_DE = [
  'Süden', 'Südsüdwesten', 'Südwesten', 'Westsüdwesten', 'Westen', 'Westnordwesten', 'Nordwesten', 'Nordnordwesten',
  'Norden', 'Nordnordosten', 'Nordosten', 'Ostnordosten', 'Osten', 'Ostsüdosten', 'Südosten', 'Südsüdosten',
];
const STAIR_SHAPES_DE = { inner_left: 'Innenecke links', inner_right: 'Innenecke rechts', outer_left: 'Außenecke links', outer_right: 'Außenecke rechts' };
const SLAB_DE = { bottom: 'untere Hälfte', top: 'obere Hälfte', double: 'doppelt (2 Stufen)' };
const AXIS_DE = { x: 'liegend, Ost–West', z: 'liegend, Nord–Süd', y: 'stehend' };
const FACE_DE = { floor: 'auf dem Boden', ceiling: 'an der Decke' };
const BELL_DE = { floor: 'auf dem Boden', ceiling: 'an der Decke', single_wall: 'an einer Wand', double_wall: 'zwischen zwei Wänden' };

function toward(dir) {
  if (dir === 'up') return 'nach oben';
  if (dir === 'down') return 'nach unten';
  return DIR_DE[dir] ? `nach ${DIR_DE[dir]}` : dir;
}

function axisOfDir(dir) {
  return dir === 'north' || dir === 'south' ? 'Nord–Süd' : 'Ost–West';
}

function plural(n, one, many) {
  return `${n} ${Number(n) === 1 ? one : many}`;
}

function isWallMounted(id) {
  return id.startsWith('wall_') || id.includes('_wall_') || id === 'ladder' || id === 'tripwire_hook';
}

// Stehende Köpfe zählen rotation andersherum als Schilder und Banner: 0 = Gesicht nach Norden (§4).
function rotationDirection(id, rotation) {
  const r = Number(rotation);
  if (!Number.isInteger(r) || r < 0 || r > 15) return null;
  const skull = (id.endsWith('_head') || id.endsWith('_skull')) && !id.includes('_wall_');
  return ROTATION_DE[skull ? (r + 8) % 16 : r];
}

function stairsDetail(p) {
  const parts = [`hohe Seite ${toward(p.facing)}`, p.half === 'top' ? 'oben (umgedreht)' : 'unten'];
  if (STAIR_SHAPES_DE[p.shape]) parts.push(STAIR_SHAPES_DE[p.shape]);
  return parts;
}

function railDetail(shape) {
  if (shape === 'north_south') return 'gerade, Nord–Süd';
  if (shape === 'east_west') return 'gerade, Ost–West';
  if (shape.startsWith('ascending_')) return `steigt ${toward(shape.slice('ascending_'.length))} an`;
  const [a, b] = shape.split('_');
  return DIR_DE[a] && DIR_DE[b] ? `Kurve ${DIR_DE[a]}–${DIR_DE[b]}` : shape;
}

function wireDetail(p) {
  const sides = ['north', 'east', 'south', 'west'];
  const connected = sides.filter((s) => p[s] && p[s] !== 'none');
  if (connected.length === 0) return 'Punkt (nicht verbunden)';
  if (connected.length === 4 && sides.every((s) => p[s] === 'side')) return 'Kreuz';
  return `verbunden: ${connected.map((s) => (p[s] === 'up' ? `${DIR_DE[s]} (hoch)` : DIR_DE[s])).join(', ')}`;
}

function trapdoorDetail(p) {
  if (p.open === 'true') return SIDE_DE[OPPOSITE[p.facing]] ? [`offen, steht an der ${SIDE_DE[OPPOSITE[p.facing]]}`] : ['offen'];
  return [p.half === 'top' ? 'geschlossen, obere Hälfte' : 'geschlossen, untere Hälfte'];
}

function kindDetail(id, p) {
  if (id.endsWith('_stairs')) return stairsDetail(p);
  if (id.endsWith('_slab')) return [SLAB_DE[p.type] ?? p.type];
  if (id === 'repeater') {
    const parts = [`Signal läuft ${toward(OPPOSITE[p.facing])}`, plural(p.delay ?? 1, 'Tick', 'Ticks')];
    if (p.locked === 'true') parts.push('gesperrt');
    return parts;
  }
  if (id === 'comparator') return [`Signal läuft ${toward(OPPOSITE[p.facing])}`, p.mode === 'subtract' ? 'Subtraktionsmodus' : 'Vergleichsmodus'];
  if (id === 'observer') return [`Gesicht ${toward(p.facing)}`, `Ausgang ${toward(OPPOSITE[p.facing])}`];
  if (id === 'piston' || id === 'sticky_piston') return [`schiebt ${toward(p.facing)}`];
  if (id === 'hopper') return [`gibt ${toward(p.facing)} aus`];
  if (id === 'dispenser' || id === 'dropper') return [`Ausgabe ${toward(p.facing)}`];
  if (id.endsWith('_bed')) return [p.part === 'head' ? 'Kopfteil' : 'Fußteil', `Kopfende ${toward(p.facing)}`];
  if (id.endsWith('_door')) {
    return [p.half === 'upper' ? 'oberer Teil' : 'unterer Teil', `Scharnier ${p.hinge === 'right' ? 'rechts' : 'links'}`,
      p.open === 'true' ? 'offen' : 'geschlossen', `beim Setzen ${toward(p.facing)} schauen`];
  }
  if (id.endsWith('_trapdoor')) return trapdoorDetail(p);
  if (id.endsWith('_fence_gate')) return [p.open === 'true' ? 'offen' : 'geschlossen', `Durchgang ${axisOfDir(p.facing)}`];
  if (id === 'chest' || id === 'trapped_chest' || id.endsWith('copper_chest')) {
    const parts = [`Vorderseite ${toward(p.facing)}`];
    if (p.type === 'left') parts.push('Doppeltruhe, linke Hälfte');
    if (p.type === 'right') parts.push('Doppeltruhe, rechte Hälfte');
    return parts;
  }
  if (id === 'redstone_wire') return [wireDetail(p)];
  if (id.endsWith('rail') && p.shape) return [railDetail(p.shape)];
  if (id === 'bell' && p.attachment) return [BELL_DE[p.attachment] ?? p.attachment, `zeigt ${toward(p.facing)}`];
  if (p.face && p.facing) {
    const parts = p.face === 'wall' ? [`an der Wand, zeigt ${toward(p.facing)}`] : [FACE_DE[p.face] ?? p.face];
    if (id === 'lever') parts.push(p.powered === 'true' ? 'an' : 'aus');
    return parts;
  }
  if (p.facing && isWallMounted(id)) return [`an der Wand, zeigt ${toward(p.facing)}`];
  return null;
}

function genericDetail(id, p) {
  const parts = [];
  const facingRotation = p.rotation !== undefined ? rotationDirection(id, p.rotation) : null;
  if (facingRotation) parts.push(`zeigt nach ${facingRotation}`);
  if (p.orientation) {
    const [front, top] = p.orientation.split('_');
    parts.push(`vorne ${toward(front)}, oben ${toward(top)}`);
  }
  if (p.facing && !parts.length) parts.push(`zeigt ${toward(p.facing)}`);
  if (p.axis && AXIS_DE[p.axis]) parts.push(AXIS_DE[p.axis]);
  if (p.candles) parts.push(plural(p.candles, 'Kerze', 'Kerzen'));
  if (p.pickles) parts.push(`${p.pickles} Stück`);
  if (p.eggs) parts.push(plural(p.eggs, 'Ei', 'Eier'));
  if (p.layers && id === 'snow') parts.push(plural(p.layers, 'Schicht', 'Schichten'));
  if (p.flower_amount) parts.push(`${p.flower_amount} Stück`);
  if (p.segment_amount) parts.push(`${p.segment_amount} Stück`);
  if ((id === 'water' || id === 'lava') && p.level !== undefined) parts.push(p.level === '0' ? 'Quelle' : `fließend (Stufe ${p.level})`);
  if (p.hanging === 'true') parts.push('hängend');
  return parts;
}

// → { name, id, detail }  z. B. detail „hohe Seite nach Norden, unten“
export function describeState(state) {
  const { id, props } = parseStateCached(state);
  const parts = kindDetail(id, props) ?? genericDetail(id, props);
  if (props.lit === 'true') parts.push(id.includes('candle') ? 'angezündet' : 'an');
  if (props.waterlogged === 'true') parts.push('geflutet (Wasser im Block)');
  return { name: blockName(id), id, detail: parts.join(', ') };
}
