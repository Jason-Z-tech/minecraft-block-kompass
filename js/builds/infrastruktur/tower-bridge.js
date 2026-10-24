// Tower Bridge, London – 1:1 nach echten Maßen (Recherche: docs/recherche/tower-bridge.md).
// Bau-Rahmen: die Brücke läuft entlang z (Norden = −z, Nordufer = Tower of London), die Themse fließt entlang x.
// Brückenmitte (Fuge der Klappen) bei z = 0, Wasserspiegel y = 0. In London ist die Achse um 23° gedreht (Richtung 203°).
// Gebaut wird die Südhälfte; die Nordhälfte entsteht gespiegelt (b.transform mit mirror 'z').

import { hashPosition } from '../../core/random.js';

export const meta = {
  id: 'tower-bridge',
  title: 'Tower Bridge',
  category: 'infrastruktur',
  subtitle: 'Klapp- und Hängebrücke über die Themse in London, 287 m lang',
  tags: ['London', 'England', 'Großbritannien', 'Brücke', 'Klappbrücke', 'Hängebrücke', 'Türme', 'Neugotik', 'Wahrzeichen', 'Maßstab 1:1', 'Riesig', 'Fluss'],
  aliases: [
    'tower bridge', 'towerbridge', 'tower brücke', 'tower bridge london', 'london bridge', 'londoner brücke', 'tauer bridge',
    'tower brige', 'towerbrücke', 'themse brücke', 'thames bridge', 'klappbrücke london', 'bascule bridge london', 'tower bridge england',
  ],
  accuracy: 'massstab',
  difficulty: 5,
  description: 'Die Tower Bridge im Maßstab 1:1: 287 m von Widerlager zu Widerlager, zwei 65 m hohe neugotische Türme auf mächtigen Pfeilern, dazwischen die geschlossene Klappbrücke mit 61 m Spannweite und darüber die beiden verglasten Fußgängerstege rund 44 m über der Themse. Zu beiden Seiten hängen die 82 m langen Seitenfelder an blau-weißen Ketten, die an den kleinen Widerlagertürmen enden. Spannweiten, Turmhöhe, Steghöhe, Brückenbreiten und Pfeiler sind belegt; Gliederung der Türme, Fenster, Kettenkurve und Innenräume sind nach Fotos geschätzt.',
  facts: [
    'Eröffnet am 30. Juni 1894 nach acht Jahren Bauzeit; Architekt Horace Jones, nach seinem Tod 1887 Ingenieur John Wolfe Barry.',
    'Gesamtlänge 940 ft (rund 287 m) mit Widerlagern; Mittelöffnung 200 ft (61 m), Seitenfelder je 270 ft (82 m).',
    'Die Türme sind 65 m hoch, die oberen Stege liegen 143 ft (43,6 m) über der Themse bei Hochwasser.',
    'Die Brücke ist 60 ft (18,3 m) breit, über der Klappe 49 ft (14,9 m); unter der geschlossenen Klappe bleiben 29 ft (8,8 m) Durchfahrtshöhe.',
    'Jede Klappe wiegt rund 1 070 t und hebt sich in etwa fünf Minuten; die Angaben zum Winkel schwanken zwischen 82° und 86°.',
    'Die Türme haben ein Stahlskelett, verkleidet mit Granit aus Cornwall und Portland-Kalkstein. Seit 2014 haben die Stege Glasböden.',
    'Blau-weiß gestrichen seit der Sanierung 2008–2012; zum Silberjubiläum 1977 war sie rot-weiß-blau.',
    'Im Modell läuft die Brücke genau Nord–Süd; in London ist sie um 23° gedreht. Der Wasserspiegel steht für Hochwasser.',
    'Geschätzt (nicht belegt): Grundriss der Türme (29 × 19 m), Ecktürmchen, Fenster, Dachform, Kettenkurve, Länge der Glasböden, Innenräume.',
  ],
  sources: [
    { title: 'Wikipedia (en): Tower Bridge', url: 'https://en.wikipedia.org/wiki/Tower_Bridge' },
    { title: 'Wikipedia (de): Tower Bridge', url: 'https://de.wikipedia.org/wiki/Tower_Bridge' },
    { title: 'Tower Bridge (offizielle Seite): Geschichte', url: 'https://www.towerbridge.org.uk/discover/history' },
    { title: 'OpenStreetMap (ODbL): Tower Bridge, Pfeiler, Stege, Widerlager', url: 'https://www.openstreetmap.org/way/367652787' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

// Alle Maße der Südhälfte (z ≥ 0). x = quer zur Brücke (Osten positiv).
const SPECS = {
  1: {
    y: { bed: -1, water: 0, deck: 9, walk: 10, ground: 4 },
    waterHalfX: 31, rimX: 32, waterEndZ: 133,
    pier: { z0: 31, z1: 51, rectX: 18, endR: 10.5, top: 7 },
    tower: {
      z0: 32, z1: 50, hx: 14, base: 8, granite: 17, top: 50, wall: 2,
      turret: { a: 3.5, x: 12, zs: [34, 48], top: 54, roofTop: 61 },
      arch: { hx: 7, top: 16, point: [[17, 5]] },
      floors: [18, 26, 35, 43], roofSlope: 1, spireTop: 64,
      stair: { kind: 'spiral', x: 12, z: 48, y1: 10, door: [[8, 48], [9, 48], [10, 48]] },
      windowsSide: [39, 41, 43], windowsFront: [-6, -3, 0, 3, 6], windowsFrontWalk: [-2, 0, 2],
      windowHeight: 4, blindSide: [39, 41, 43], blindY: [11, 15],
    },
    bascule: { z1: 31, roadX: 4, walkX: 6, parapetX: 7, seam: true, girderX: [3, 7] },
    side: { z0: 51, z1: 133, roadX: 5, walkX: 7, parapetX: 8, edgeX: 9, girderEvery: 4 },
    walkway: { x0: 5, x1: 9, floor: 43, top: 47, z1: 31, glassZ: 5 },
    chain: { x: 9, z0: 51, z1: 133, yStart: 43, yEnd: 21, yLow: 12, hangerEvery: 4 },
    abut: { z0: 134, z1: 143, hx: 11, top: 21, arch: { hx: 8, top: 15, point: [[16, 7], [17, 5]] },
      turret: { a: 2.5, x: 10, zs: [135, 142], top: 24, roofTop: 28 }, blind: [-4, 0, 4], blindY: [18, 20] },
    approach: { z0: 144, z1: 150, hx: 9 },
    land: { x: 32 },
    lampEvery: 12,
  },
  0.5: {
    y: { bed: -1, water: 0, deck: 4, walk: 5, ground: 2 },
    waterHalfX: 15, rimX: 16, waterEndZ: 66,
    pier: { z0: 15, z1: 25, rectX: 9, endR: 5.5, top: 3 },
    tower: {
      z0: 16, z1: 24, hx: 7, base: 4, granite: 8, top: 25, wall: 1,
      turret: { a: 1.5, x: 7, zs: [17, 23], top: 27, roofTop: 30 },
      arch: { hx: 3, top: 7, point: [[8, 2]] },
      floors: [9, 13, 17, 21], roofSlope: 1, spireTop: 32,
      stair: { kind: 'ladder', x: 6, z: 21, wallX: 7, door: [[4, 21], [5, 21]] },
      windowsSide: [20], windowsFront: [-3, 0, 3], windowsFrontWalk: [0],
      windowHeight: 2, blindSide: [20], blindY: [6, 6],
    },
    bascule: { z1: 15, roadX: 1, walkX: 2, parapetX: 3, seam: true, girderX: [3] },
    side: { z0: 25, z1: 66, roadX: 1, walkX: 2, parapetX: 3, edgeX: 4, girderEvery: 4 },
    walkway: { x0: 3, x1: 5, floor: 21, top: 24, z1: 15, glassZ: 2 },
    chain: { x: 4, z0: 25, z1: 66, yStart: 21, yEnd: 10, yLow: 6, hangerEvery: 3 },
    abut: { z0: 67, z1: 71, hx: 6, top: 10, arch: { hx: 4, top: 7, point: [[8, 3]] },
      turret: { a: 1.5, x: 6, zs: [67, 71], top: 12, roofTop: 14 }, blind: [0], blindY: [9, 9] },
    approach: { z0: 72, z1: 75, hx: 4 },
    land: { x: 16 },
    lampEvery: 8,
  },
};

const STONE = {
  granite: 'stone_bricks', graniteAlt: 'cracked_stone_bricks', plinth: 'polished_andesite', mossy: 'mossy_stone_bricks',
  portland: 'polished_diorite', portlandAlt: 'diorite', trim: 'calcite', wall: 'diorite_wall', glass: 'gray_stained_glass_pane',
};
const STEEL = { blue: 'light_blue_concrete', white: 'white_concrete', rail: 'iron_bars', pane: 'glass_pane' };
const SLATE = { stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'deepslate_tiles' };
const ROAD = { asphalt: 'gray_concrete', mark: 'white_concrete', seam: 'light_gray_concrete', walk: 'smooth_stone' };
const DIRS = [['east', 1, 0], ['west', -1, 0], ['south', 0, 1], ['north', 0, -1]];
const key = (x, z) => `${x},${z}`;
const mod = (n, m) => ((n % m) + m) % m;

function inOctagon(u, w, a) {
  const au = Math.abs(u);
  const aw = Math.abs(w);
  return Math.max(au, aw) <= a - 0.5 + 1e-9 && au + aw <= a * Math.SQRT2 + 1e-6;
}

// Gestuftes Dach über einer Höhenkarte: Treppen zur höheren Seite, Lücken an Stufen mit Vollblöcken geschlossen.
function placeStepRoof(b, heights, mat, { full = () => false, fillFrom = null } = {}) {
  const facings = new Map();
  for (const [k, cell] of heights) {
    let best = null;
    for (const [dir, dx, dz] of DIRS) {
      const n = heights.get(key(cell.x + dx, cell.z + dz));
      if (n && n.h > cell.h && (!best || n.h > best.h)) best = { dir, h: n.h };
    }
    facings.set(k, best ? best.dir : null);
  }
  const opposite = { east: 'west', west: 'east', south: 'north', north: 'south' };
  for (const [k, cell] of heights) {
    const facing = facings.get(k);
    if (full(cell)) b.set(cell.x, cell.h, cell.z, mat.full);
    else if (facing === null) b.slab(cell.x, cell.h, cell.z, mat.slab);
    else b.stairs(cell.x, cell.h, cell.z, mat.stairs, { facing });
  }
  for (const cell of heights.values()) {
    let low = cell.h;
    for (const [dir, dx, dz] of DIRS) {
      const n = heights.get(key(cell.x + dx, cell.z + dz));
      if (!n || n.h >= cell.h) continue;
      low = Math.min(low, facings.get(key(n.x, n.z)) === opposite[dir] ? n.h + 1 : n.h);
    }
    const from = fillFrom === null ? low : Math.min(low, fillFrom);
    for (let y = from; y < cell.h; y++) if (b.get(cell.x, y, cell.z) === 'air') b.set(cell.x, y, cell.z, mat.full);
  }
}

function pick(x, y, z, salt, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = hashPosition(x, y, z, salt) % total;
  for (const [v, w] of entries) {
    if (r < w) return v;
    r -= w;
  }
  return entries[0][0];
}

const granite = (x, y, z) => (y <= 1 && hashPosition(x, y, z, 2) % 3 === 0 ? STONE.mossy
  : pick(x, y, z, 3, [[STONE.granite, 8], [STONE.graniteAlt, 1]]));
const portland = (x, y, z) => pick(x, y, z, 4, [[STONE.portland, 7], [STONE.portlandAlt, 2]]);

// Beide Hälften: Süden direkt, Norden gespiegelt.
function bothHalves(b, fn) {
  fn();
  b.transform({ mirror: 'z' }, fn);
}

export default function build(b, { scale = 1 } = {}) {
  const spec = SPECS[scale];
  if (!spec) throw new Error(`Maßstab ${scale} gibt es für die Tower Bridge nicht (erlaubt: 1, 0.5).`);
  const geo = towerGeometry(spec);

  buildRiverbed(b, spec);
  buildPiers(b, spec);
  buildTowerBase(b, spec, geo);
  buildTowerUpper(b, spec, geo);
  buildAbutments(b, spec);
  buildBascule(b, spec);
  buildSideSpans(b, spec);
  buildWalkways(b, spec);
  buildChains(b, spec);
  buildRoofs(b, spec, geo);
  buildInterior(b, spec, geo);
  buildRailings(b, spec);
  buildBanks(b, spec);
  buildWater(b, spec);
}

// --- Geometrie der Haupttürme ---

function towerGeometry(spec) {
  const t = spec.tower;
  const turrets = [];
  for (const sx of [-1, 1]) for (const z of t.turret.zs) turrets.push({ x: sx * t.turret.x, z });
  const turretAt = (x, z) => turrets.find((c) => inOctagon(x - c.x, z - c.z, t.turret.a)) ?? null;
  const inBody = (x, z) => Math.abs(x) <= t.hx && z >= t.z0 && z <= t.z1;
  const inTower = (x, z) => inBody(x, z) || turretAt(x, z) !== null;
  const stair = t.stair;
  const stairShaft = (x, z) => (stair.kind === 'spiral' ? inOctagon(x - stair.x, z - stair.z, 1.5) : x === stair.x && z === stair.z);
  // Innenraum über der Durchfahrt (Wand t.wall dick, ohne Ecktürmchen)
  const interior = (x, z) => inBody(x, z) && Math.abs(x) <= t.hx - t.wall && z >= t.z0 + t.wall && z <= t.z1 - t.wall && turretAt(x, z) === null;
  const archHalf = (y) => {
    if (y < spec.y.walk) return -1;
    if (y <= t.arch.top) return t.arch.hx;
    const p = t.arch.point.find(([py]) => py === y);
    return p ? p[1] : -1;
  };
  return { turrets, turretAt, inBody, inTower, stairShaft, interior, archHalf };
}

// --- Kapitel ---

function buildRiverbed(b, spec) {
  const y = spec.y;
  b.phase('Flussbett und Ufermauern',
    `Leg zuerst das Flussbett der Themse an: ${spec.waterHalfX * 2 + 1} Blöcke breit und ${spec.waterEndZ * 2 + 1} Blöcke lang zwischen den beiden Ufermauern. Das Wasser kommt erst ganz am Schluss hinein. An beiden Enden steht eine Ufermauer aus Steinziegeln bis auf ${y.ground - y.water} Blöcke über dem Wasser, dahinter das flache Ufer.`,
    { tips: [
      'Markier dir die Brückenachse mit einer Linie aus Wolle – alles andere misst du von dort aus.',
      'Die Brücke ist symmetrisch: Bau immer zuerst eine Hälfte und übertrag die Maße auf die andere.',
    ] });
  bothHalves(b, () => {
    for (let z = 0; z <= spec.waterEndZ; z++) {
      for (let x = -spec.rimX; x <= spec.rimX; x++) {
        b.set(x, y.bed, z, pick(x, 0, z, 5, [['mud', 3], ['clay', 2], ['coarse_dirt', 2]]));
        if (Math.abs(x) === spec.rimX) b.set(x, y.water, z, 'mud');
      }
    }
    const wallZ = spec.abut.z0;
    for (let x = -spec.land.x; x <= spec.land.x; x++) {
      for (let yy = y.bed; yy <= y.ground; yy++) b.set(x, yy, wallZ, granite(x, yy, wallZ));
    }
  });
  b.note(0, y.water, 0, 'Brückenmitte: Hier treffen sich die beiden Klappen.');
}

function pierCell(spec, x, z) {
  const p = spec.pier;
  if (z < p.z0 || z > p.z1) return false;
  const cz = (p.z0 + p.z1) / 2;
  const ax = Math.abs(x);
  if (ax <= p.rectX) return true;
  return Math.hypot(ax - p.rectX, z - cz) <= p.endR;
}

function buildPiers(b, spec) {
  const p = spec.pier;
  b.phase('Pfeiler',
    `Die beiden Flusspfeiler tragen die Haupttürme: je ${p.z1 - p.z0 + 1} Blöcke breit (in Brückenrichtung) und ${Math.round(2 * (p.rectX + p.endR))} Blöcke lang, mit runden Enden gegen die Strömung. Mauere sie aus Steinziegeln vom Flussbett bis ${p.top - spec.y.water + 1} Blöcke über das Wasser, oben schließt eine Lage poliertem Andesit ab.`,
    { tips: ['Die runden Enden: Setz erst den Halbkreis mit einem Zirkel aus Wolle (Radius ' + String(p.endR).replace('.', ',') + ') und füll dann auf.'] });
  bothHalves(b, () => {
    for (let z = p.z0; z <= p.z1; z++) {
      for (let x = -Math.ceil(p.rectX + p.endR); x <= Math.ceil(p.rectX + p.endR); x++) {
        if (!pierCell(spec, x, z)) continue;
        for (let yy = spec.y.bed; yy <= p.top; yy++) b.set(x, yy, z, yy === p.top ? STONE.plinth : granite(x, yy, z));
      }
    }
  });
}

// Wandblock eines Turms an (x, y, z) – mit Fensterbändern, Gesimsen und Fenstern.
function towerWallState(spec, geo, x, y, z) {
  const t = spec.tower;
  const outer = Math.abs(x) === t.hx || z === t.z0 || z === t.z1;
  const turret = geo.turretAt(x, z);
  if (y <= t.granite) return y <= t.base + 1 ? STONE.plinth : granite(x, y, z);
  if ((y === t.granite + 1 || y === t.top) && (outer || turret)) return STONE.trim;
  if (t.floors.includes(y) && outer && !turret) return STONE.trim;
  return portland(x, y, z);
}

function buildTowerBase(b, spec, geo) {
  const t = spec.tower;
  const y = spec.y;
  b.phase('Haupttürme: Sockel und Durchfahrt',
    `Auf jedem Pfeiler steht ein Hauptturm, ${t.hx * 2 + 1} × ${t.z1 - t.z0 + 1} Blöcke groß, mit vier achteckigen Ecktürmchen, die einen Block vorstehen. Der Sockel bis Ebene ${t.granite - y.bed + 1} ist aus Granit (Steinziegel). Mitten hindurch führt die Fahrbahn in einem spitzen Torbogen, ${t.arch.hx * 2 + 1} Blöcke breit und ${t.arch.top - y.walk + 1 + t.arch.point.length} Blöcke hoch.`,
    { tips: [
      'Setz zuerst die Mittelpunkte der vier Ecktürmchen und mauere die Achtecke, dann die Wände dazwischen.',
      'Die Bogenspitze bekommt einen Rahmen aus Kalzit – so sieht der Torbogen auch aus der Ferne sauber aus.',
    ] });
  bothHalves(b, () => {
    for (let yy = t.base; yy <= t.granite; yy++) {
      const half = geo.archHalf(yy);
      for (let z = t.z0 - 1; z <= t.z1 + 1; z++) {
        for (let x = -t.hx - 1; x <= t.hx + 1; x++) {
          if (!geo.inTower(x, z)) continue;
          if (half >= 0 && Math.abs(x) <= half && z >= t.z0 && z <= t.z1) continue;
          if (yy >= y.walk && geo.stairShaft(x, z)) continue;
          if (yy >= y.walk && yy <= y.walk + 1 && t.stair.door.some(([dx, dz]) => dx === x && dz === z)) continue;
          let state = towerWallState(spec, geo, x, yy, z);
          const ring = (z === t.z0 || z === t.z1) && half < 0 && Math.abs(x) <= t.arch.hx && yy <= t.arch.top + t.arch.point.length + 1 && yy > t.arch.top;
          if (ring || ((z === t.z0 || z === t.z1) && half >= 0 && Math.abs(x) === half + 1)) state = STONE.trim;
          const blind = Math.abs(x) === t.hx && t.blindSide.includes(z) && yy >= t.blindY[0] && yy <= t.blindY[1];
          b.set(x, yy, z, blind ? STONE.glass : state);
        }
      }
    }
  });
  b.note(0, y.walk, t.z0, 'Torbogen der Durchfahrt im Südturm.');
}

function windowCell(spec, geo, x, y, z) {
  const t = spec.tower;
  const floor = t.floors.find((f) => y >= f + 2 && y <= f + 1 + t.windowHeight);
  if (floor === undefined) return null;
  const sideCol = t.windowsSide.includes(z);
  const frontList = floor === spec.walkway.floor ? t.windowsFrontWalk : t.windowsFront;
  if (Math.abs(x) >= t.hx - t.wall + 1 && sideCol) return Math.abs(x) === t.hx && t.wall > 1 ? 'recess' : 'glass';
  if ((z <= t.z0 + t.wall - 1 || z >= t.z1 - t.wall + 1) && frontList.includes(x) && geo.turretAt(x, z) === null) {
    if (t.wall > 1) return z === t.z0 || z === t.z1 ? 'recess' : 'glass';
    return 'glass';
  }
  return null;
}

function walkwayDoor(spec, x, y, z) {
  const w = spec.walkway;
  const t = spec.tower;
  return Math.abs(x) > w.x0 && Math.abs(x) < w.x1 && y > w.floor && y < w.top && z >= t.z0 && z < t.z0 + t.wall;
}

function buildTowerUpper(b, spec, geo) {
  const t = spec.tower;
  b.phase('Haupttürme: Mauern, Fenster und Böden',
    `Über dem Sockel geht es in hellem Portland-Kalkstein weiter (polierter Diorit mit etwas Diorit) bis Ebene ${t.top - spec.y.bed + 1}. Die Mauer ist ${t.wall > 1 ? `${t.wall} Blöcke dick; die schmalen Fenster (graue Glasscheiben) sitzen innen, außen bleibt eine Nische` : '1 Block dick, die schmalen Fenster sind graue Glasscheiben'}. Unter jedes Fenster kommt außen eine obere Stufe aus poliertem Diorit als Fensterbank${t.windowHeight >= 4 ? ', darüber eine Treppe mit der hohen Seite zur Wand als Tropfgesims' : ''}. Auf jeder Geschosshöhe läuft ein Gesims aus Kalzit um den Turm, und innen legst du dort den Boden aus Schwarzeichenbrettern. Die Ecktürmchen steigen ${t.turret.top - t.top} Blöcke über die Mauerkrone hinaus.`,
    { tips: [
      `Geschosse auf den Ebenen ${t.floors.map((f) => f - spec.y.bed + 1).join(', ')} – auf der obersten Ebene setzen später die Fußgängerstege an.`,
      'Lass auf der Innenseite zur Klappbrücke die Öffnungen für die beiden Stege frei.',
    ] });
  bothHalves(b, () => {
    for (let yy = t.granite + 1; yy <= t.turret.top; yy++) {
      for (let z = t.z0 - 1; z <= t.z1 + 1; z++) {
        for (let x = -t.hx - 1; x <= t.hx + 1; x++) {
          if (!geo.inTower(x, z)) continue;
          const turret = geo.turretAt(x, z);
          if (yy > t.top && !turret) continue;
          if (geo.stairShaft(x, z) && yy <= t.floors[t.floors.length - 1] + 2) continue;
          if (stairPassage(spec, geo, x, yy, z)) continue;
          if (geo.interior(x, z)) {
            if (t.floors.includes(yy)) b.set(x, yy, z, 'dark_oak_planks');
            continue;
          }
          if (walkwayDoor(spec, x, yy, z)) continue;
          const win = turret ? null : windowCell(spec, geo, x, yy, z);
          if (win === 'recess') continue;
          if (win === 'glass') { b.set(x, yy, z, STONE.glass); continue; }
          b.set(x, yy, z, towerWallState(spec, geo, x, yy, z));
        }
      }
    }
    // Brüstung auf der Mauerkrone
    for (let z = t.z0; z <= t.z1; z++) {
      for (let x = -t.hx; x <= t.hx; x++) {
        const edge = Math.abs(x) === t.hx || z === t.z0 || z === t.z1;
        if (edge && !geo.turretAt(x, z) && mod(x + z, 2) === 0) b.set(x, t.top + 1, z, STONE.wall);
      }
    }
    windowTrim(b, spec);
  });
}

// Fensterbank (obere Stufe) unter und Tropfgesims (Treppe, hohe Seite zur Wand) über jedem Fenster, außen vor der Wand.
function windowTrim(b, spec) {
  const t = spec.tower;
  for (const f of t.floors) {
    const front = f === spec.walkway.floor ? t.windowsFrontWalk : t.windowsFront;
    const cells = [];
    for (const x of front) cells.push([x, t.z0 - 1, 'south'], [x, t.z1 + 1, 'north']);
    for (const z of t.windowsSide) cells.push([-t.hx - 1, z, 'east'], [t.hx + 1, z, 'west']);
    for (const [x, z, facing] of cells) {
      b.slab(x, f + 1, z, 'polished_diorite_slab', { type: 'top' });
      if (t.windowHeight >= 4) b.stairs(x, f + 2 + t.windowHeight, z, 'polished_diorite_stairs', { facing });
    }
  }
}

function stairPassage(spec, geo, x, y, z) {
  const st = spec.tower.stair;
  if (st.kind !== 'spiral') return false;
  const floors = spec.tower.floors;
  if (!floors.some((f) => y === f + 1 || y === f + 2)) return false;
  return x === st.x && (z === st.z - 2 || z === st.z - 3);
}

function abutCell(spec, x, z) {
  const a = spec.abut;
  const inBody = Math.abs(x) <= a.hx && z >= a.z0 && z <= a.z1;
  const turret = a.turret.zs.some((tz) => [-1, 1].some((sx) => inOctagon(x - sx * a.turret.x, z - tz, a.turret.a)));
  return { inBody, turret, any: inBody || turret };
}

function buildAbutments(b, spec) {
  const a = spec.abut;
  const y = spec.y;
  b.phase('Widerlagertürme',
    `An beiden Ufern steht ein kleinerer Turm, das Widerlager: ${a.hx * 2 + 1} × ${a.z1 - a.z0 + 1} Blöcke, ${a.top - y.water + 1} Blöcke über dem Wasser, mit vier Ecktürmchen. Er ist massiv gemauert, unten Granit, oben Portland-Kalkstein, und hat einen spitzen Torbogen für die Fahrbahn. In ihm enden später die Ketten der Seitenfelder.`,
    { tips: ['Die Fenster auf der Flussseite sind Blendfenster: graue Glasscheiben direkt vor dem Mauerwerk.'] });
  const archHalf = (yy) => {
    if (yy < y.walk) return -1;
    if (yy <= a.arch.top) return a.arch.hx;
    const p = a.arch.point.find(([py]) => py === yy);
    return p ? p[1] : -1;
  };
  bothHalves(b, () => {
    for (let yy = y.bed; yy <= a.turret.top; yy++) {
      const half = archHalf(yy);
      for (let z = a.z0 - 2; z <= a.z1 + 2; z++) {
        for (let x = -a.hx - 2; x <= a.hx + 2; x++) {
          const c = abutCell(spec, x, z);
          if (!c.any) continue;
          if (yy > a.top && !c.turret) continue;
          if (c.inBody && half >= 0 && Math.abs(x) <= half) continue;
          if (yy < y.ground && z < a.z0) continue;
          const outerZ = z === a.z0 || z === a.z1;
          const blind = c.inBody && !c.turret && outerZ && a.blind.includes(x) && yy >= a.blindY[0] && yy <= a.blindY[1];
          let state = yy <= spec.tower.granite - (spec.tower.top - a.top) ? granite(x, yy, z) : portland(x, yy, z);
          if (yy === a.top || (c.inBody && outerZ && half < 0 && Math.abs(x) <= a.arch.hx + 1 && yy === a.arch.top + a.arch.point.length + 1)) state = STONE.trim;
          b.set(x, yy, z, blind ? STONE.glass : state);
        }
      }
    }
    for (let z = a.z0; z <= a.z1; z++) {
      for (let x = -a.hx; x <= a.hx; x++) {
        const edge = Math.abs(x) === a.hx || z === a.z0 || z === a.z1;
        if (edge && !abutCell(spec, x, z).turret && mod(x + z, 2) === 0) b.set(x, a.top + 1, z, STONE.wall);
      }
    }
  });
}

function buildBascule(b, spec) {
  const k = spec.bascule;
  const y = spec.y;
  b.phase('Klappbrücke (geschlossen)',
    `Zwischen den Pfeilern liegen die beiden Klappen, zusammen ${k.z1 * 2 + 1} Blöcke lang (davon ${(spec.pier.z0 - 1) * 2 + 1} Blöcke lichte Weite über dem Wasser, die äußersten Reihen liegen auf den Pfeilern) und ${k.parapetX * 2 + 1} Blöcke breit, ${y.deck - y.water} Blöcke über dem Wasser. Leg zuerst die stählernen Längsträger (hellblauer Beton) – sie werden zu den Pfeilern hin tiefer, weil dort das Gegengewicht sitzt. Darauf kommt die Fahrbahn aus grauem Beton, links und rechts der Gehweg aus glattem Stein. In der Mitte, wo sich die Klappen treffen, markiert eine hellgraue Fuge die Trennung.`,
    { tips: ['Bau die Träger von beiden Pfeilern aus zur Mitte – so hängt nichts frei in der Luft.'] });
  bothHalves(b, () => {
    for (let z = 0; z <= k.z1; z++) {
      // Träger werden zu den Pfeilern hin tiefer; an der Spitze trägt nur die Fahrbahnplatte (Durchfahrtshöhe).
      const depth = Math.floor(z / Math.max(2, Math.round(k.z1 / 4)));
      for (const gx of k.girderX) {
        for (const sx of [-1, 1]) {
          const x = sx * gx;
          for (let yy = y.deck - depth; yy < y.deck; yy++) if (!pierCell(spec, x, z) || yy > spec.pier.top) b.set(x, yy, z, STEEL.blue);
        }
      }
      if (depth > 0 && mod(z, 4) === 0) for (let x = -k.parapetX; x <= k.parapetX; x++) b.set(x, y.deck - 1, z, STEEL.blue);
      for (let x = -k.parapetX; x <= k.parapetX; x++) {
        const ax = Math.abs(x);
        let state = ax <= k.roadX ? ROAD.asphalt : ax <= k.walkX ? ROAD.walk : STEEL.blue;
        if (z === 0 && k.seam && ax <= k.walkX) state = ROAD.seam;
        else if (x === 0 && mod(z, 6) < 3 && z > 0) state = ROAD.mark;
        b.set(x, y.deck, z, state);
      }
      if (z >= spec.pier.z0) for (let x = -k.parapetX; x <= k.parapetX; x++) b.set(x, y.deck - 1, z, granite(x, y.deck - 1, z));
    }
    // Fahrbahn durch den Turm
    const t = spec.tower;
    for (let z = t.z0; z <= t.z1; z++) {
      for (let x = -t.arch.hx; x <= t.arch.hx; x++) {
        const ax = Math.abs(x);
        const state = ax <= k.roadX ? (x === 0 && mod(z, 6) < 3 ? ROAD.mark : ROAD.asphalt) : ROAD.walk;
        b.set(x, y.deck, z, state);
      }
    }
  });
  b.note(0, y.deck, 0, 'Fuge zwischen den beiden Klappen – hier öffnet sich die Brücke.');
}

function buildSideSpans(b, spec) {
  const s = spec.side;
  const y = spec.y;
  const ap = spec.approach;
  b.phase('Seitenfelder und Zufahrten',
    `Die beiden Seitenfelder spannen ${s.z1 - s.z0} Blöcke vom Pfeiler bis zum Widerlager. Sie sind breiter als die Klappen: ${s.parapetX * 2 + 1} Blöcke von Brüstung zu Brüstung. Leg alle ${s.girderEvery} Blöcke einen Querträger aus hellblauem Beton, an den Außenkanten je einen Randträger (blau, oben weiß), dann Fahrbahn und Gehwege. Hinter den Widerlagern führt die Straße auf einem gemauerten Damm noch ein Stück weiter.`,
    { tips: ['Arbeite von beiden Enden zur Mitte des Feldes – die Hänger an den Ketten kommen erst später, bis dahin trägt die Fahrbahn sich im Spiel selbst.'] });
  bothHalves(b, () => {
    for (let z = s.z0; z <= ap.z1; z++) {
      const inAbut = z >= spec.abut.z0 && z <= spec.abut.z1;
      const onApproach = z >= ap.z0;
      const span = z <= s.z1;
      for (let x = -s.edgeX; x <= s.edgeX; x++) {
        const ax = Math.abs(x);
        if (inAbut && ax > spec.abut.arch.hx) continue;
        if ((inAbut || onApproach) && ax > s.parapetX) continue;
        if (ax <= s.parapetX - 1) {
          const state = ax <= s.roadX ? (x === 0 && mod(z, 6) < 3 ? ROAD.mark : ROAD.asphalt) : ROAD.walk;
          b.set(x, y.deck, z, state);
        } else if (ax === s.parapetX) {
          b.set(x, y.deck, z, span ? STEEL.blue : granite(x, y.deck, z));
        } else if (span) {
          b.set(x, y.deck - 1, z, STEEL.blue);
          b.set(x, y.deck, z, STEEL.blue);
          b.set(x, y.deck + 1, z, STEEL.white);
        }
        if (span && mod(z - s.z0, s.girderEvery) === 0 && ax <= s.parapetX) b.set(x, y.deck - 1, z, STEEL.blue);
        if (z === s.z0 && ax <= s.edgeX) b.set(x, y.deck - 1, z, granite(x, y.deck - 1, z));
        if (onApproach) for (let yy = y.ground + 1; yy < y.deck; yy++) b.set(x, yy, z, granite(x, yy, z));
      }
    }
  });
}

function buildWalkways(b, spec) {
  const w = spec.walkway;
  b.phase('Obere Fußgängerstege',
    `In ${w.floor - spec.y.water + 1} Blöcken Höhe verbinden zwei verglaste Stege die Türme. Jeder ist ${w.x1 - w.x0 + 1} Blöcke breit und ${w.z1 * 2 + 1} Blöcke lang. Bau zuerst Boden und Untergurt aus den Turmöffnungen heraus zur Mitte, dann die Seitenwände als Gitterträger: hellblaue Diagonalen im Rautenmuster, dazwischen Glasscheiben. Oben schließt ein weißes Dach ab, in das Seelaternen eingelassen sind. In der Mitte hat jeder Steg einen Glasboden.`,
    { tips: [
      'Für das Rautenmuster: Zähl in jeder Reihe vier Blöcke weiter – die Diagonalen kreuzen sich dann von selbst.',
      'Für den Glasboden nimmst du echtes Glas statt Scheiben, damit man darauf stehen kann.',
    ] });
  bothHalves(b, () => {
    for (const sx of [-1, 1]) {
      for (let z = 0; z <= w.z1; z++) {
        for (let ax = w.x0; ax <= w.x1; ax++) {
          const x = sx * ax;
          const side = ax === w.x0 || ax === w.x1;
          b.set(x, w.floor - 1, z, side || mod(z, 4) === 0 ? STEEL.blue : 'air');
          if (b.get(x, w.floor - 1, z) === 'air') b.remove(x, w.floor - 1, z);
          const glass = !side && z <= w.glassZ && ax === Math.round((w.x0 + w.x1) / 2);
          b.set(x, w.floor, z, side ? STEEL.blue : glass ? 'glass' : 'polished_andesite');
          for (let yy = w.floor + 1; yy < w.top; yy++) {
            if (!side) continue;
            const k = yy - w.floor;
            const lattice = mod(z + k, 4) === 0 || mod(z - k, 4) === 0 || mod(z, 8) === 0;
            b.set(x, yy, z, lattice ? STEEL.blue : STEEL.pane);
          }
          const lamp = !side && ax === Math.round((w.x0 + w.x1) / 2) && mod(z, 6) === 3;
          b.set(x, w.top, z, side ? STEEL.blue : lamp ? 'sea_lantern' : STEEL.white);
        }
      }
    }
  });
  b.note(Math.round((w.x0 + w.x1) / 2), w.floor, 0, `Glasboden im Steg – ${w.floor + 1 - spec.y.water} Blöcke über der Themse.`);
}

function chainCurve(spec) {
  const c = spec.chain;
  // Parabel y = low + k (z − z0)² durch Start (Turm) und Ende (Widerlager)
  const r = Math.sqrt((c.yStart - c.yLow) / (c.yEnd - c.yLow));
  const vz = (c.z0 + r * c.z1) / (1 + r);
  const k = (c.yStart - c.yLow) / (c.z0 - vz) ** 2;
  return (z) => c.yLow + k * (z - vz) ** 2;
}

function buildChains(b, spec) {
  const c = spec.chain;
  const curve = chainCurve(spec);
  b.phase('Ketten und Hänger',
    `Über jedem Seitenfeld hängen zwei Ketten, eine an jeder Seite. Sie beginnen am Hauptturm auf Höhe der Stege, hängen in einem Bogen bis knapp über die Fahrbahn durch und steigen zum Widerlagerturm wieder an. Jede Kette ist drei Blöcke hoch: oben und unten hellblauer Beton, in der Mitte ein weißes Band. Alle ${c.hangerEvery} Blöcke hängt die Fahrbahn an einem Hänger aus Eisengittern.`,
    { tips: [
      'Steck die Kurve zuerst mit einzelnen Blöcken alle 5 Felder ab und verbinde sie dann.',
      'Die Kette ist am Turm steil – dort springt sie pro Block auch mal um zwei Ebenen.',
    ] });
  bothHalves(b, () => {
    for (const sx of [-1, 1]) {
      const x = sx * c.x;
      let prev = null;
      for (let z = c.z0; z <= c.z1; z++) {
        const yc = Math.round(curve(z));
        const lo = Math.min(yc, prev ?? yc) - 1;
        const hi = Math.max(yc, prev ?? yc) + 1;
        for (let yy = lo; yy <= hi; yy++) {
          const mid = yy > lo && yy < hi;
          if (b.get(x, yy, z) !== 'air') continue;
          b.set(x, yy, z, mid ? STEEL.white : STEEL.blue);
        }
        if (mod(z - c.z0, c.hangerEvery) === 0 && z > c.z0) {
          for (let yy = spec.y.deck + 2; yy < lo; yy++) b.set(x, yy, z, STEEL.rail);
        }
        prev = yc;
      }
    }
  });
}

function buildRoofs(b, spec, geo) {
  const t = spec.tower;
  const a = spec.abut;
  b.phase('Dächer und Turmspitzen',
    'Die Türme tragen steile Dächer aus Tiefenschiefer-Fliesen. Auf den Hauptturm kommt ein Walmdach hinter der Brüstung, darüber eine Spitze mit goldenem Knauf. Die Ecktürmchen bekommen spitze, achteckige Helme mit einem Blitzableiter als Spitze. Die Widerlagertürme erhalten dieselben Dächer in klein.',
    { tips: ['Setz bei den spitzen Helmen zuerst die Mittelachse bis zur Spitze und bau die Treppen ringweise darum.'] });
  bothHalves(b, () => {
    // Walmdach des Hauptturms (innerhalb der Brüstung)
    const heights = new Map();
    for (let z = t.z0 + 1; z <= t.z1 - 1; z++) {
      for (let x = -t.hx + 1; x <= t.hx - 1; x++) {
        if (geo.turretAt(x, z)) continue;
        const d = Math.min(t.hx - Math.abs(x), z - t.z0, t.z1 - z);
        heights.set(key(x, z), { x, z, h: t.top + Math.round(d * t.roofSlope) });
      }
    }
    placeStepRoof(b, heights, SLATE);
    const ridge = Math.max(...[...heights.values()].map((c) => c.h));
    const cz = Math.round((t.z0 + t.z1) / 2);
    for (let yy = ridge; yy < t.spireTop - 1; yy++) b.set(0, yy, cz, yy === ridge ? SLATE.full : 'polished_blackstone_wall');
    b.set(0, t.spireTop - 1, cz, 'gold_block');
    b.set(0, t.spireTop, cz, 'lightning_rod');
    // Helme der Ecktürmchen
    for (const tur of geo.turrets) helmet(b, tur.x, tur.z, t.turret.a, t.turret.top + 1, t.turret.roofTop);
    // Widerlager
    const ah = new Map();
    for (let z = a.z0 + 1; z <= a.z1 - 1; z++) {
      for (let x = -a.hx + 1; x <= a.hx - 1; x++) {
        if (abutCell(spec, x, z).turret) continue;
        const d = Math.min(a.hx - Math.abs(x), z - a.z0, a.z1 - z);
        ah.set(key(x, z), { x, z, h: a.top + d });
      }
    }
    // Massiv unter dem Dach: keine Hohlräume, in denen Monster erscheinen könnten.
    placeStepRoof(b, ah, SLATE, { fillFrom: a.top + 1 });
    for (const tz of a.turret.zs) for (const sx of [-1, 1]) helmet(b, sx * a.turret.x, tz, a.turret.a, a.turret.top + 1, a.turret.roofTop);
  });
}

function helmet(b, cx, cz, a, base, apex) {
  const heights = new Map();
  const rMax = a - 0.5;
  const span = Math.ceil(a);
  for (let dz = -span; dz <= span; dz++) {
    for (let dx = -span; dx <= span; dx++) {
      if (!inOctagon(dx, dz, a)) continue;
      const r = Math.max(Math.abs(dx), Math.abs(dz), (Math.abs(dx) + Math.abs(dz)) / Math.SQRT2);
      const h = base + Math.round(((rMax - r) / rMax) * (apex - base));
      heights.set(key(cx + dx, cz + dz), { x: cx + dx, z: cz + dz, h: Math.max(base, Math.min(apex, h)) });
    }
  }
  placeStepRoof(b, heights, SLATE, { full: (c) => c.x === cx && c.z === cz, fillFrom: base });
  b.set(cx, apex + 1, cz, 'lightning_rod');
}

function buildInterior(b, spec, geo) {
  const t = spec.tower;
  const y = spec.y;
  b.phase('Treppe, Ausstellung und Licht',
    'Die Türme sind innen hohl: Hier liegen heute Treppen, Aufzüge und die Ausstellung zur Brücke. Bau die Treppe hinauf zu den Stegen und richte die Geschosse mit Vitrinen, Bänken und Lesepulten ein. Jedes Geschoss und die Durchfahrt bekommen Laternen, damit nirgends Monster erscheinen.');
  b.step('Treppe zu den Stegen', t.stair.kind === 'spiral'
    ? 'In einem Ecktürmchen auf der Außenseite windet sich eine Wendeltreppe aus Schwarzeichentreppen um eine Mittelsäule aus Kalzit nach oben; alle fünf Ebenen sitzt eine Seelaterne in der Säule. Den Eingang erreichst du vom Gehweg in der Durchfahrt; auf jedem Geschoss führt ein kurzer Gang in den Turm.'
    : 'In der Ostwand führt eine Leiter vom Gehweg in der Durchfahrt durch alle Geschosse bis zu den Stegen.');
  bothHalves(b, () => {
    const st = t.stair;
    if (st.kind === 'spiral') {
      const top = t.floors[t.floors.length - 1];
      b.spiralStairs(st.x, st.z, st.y1, top, 1, 'dark_oak_stairs', { core: STONE.trim });
      b.door(st.door[0][0], y.walk, st.door[0][1], 'dark_oak_door', { facing: 'east', hinge: 'right' });
      // Erreicht die Treppe ein Geschoss eine Ebene zu tief, führt eine Stufe hinauf in den Gang.
      for (const f of t.floors) {
        const offset = mod(f - st.y1, 8);
        if (offset === 1) b.stairs(st.x, f, st.z - 2, 'dark_oak_stairs', { facing: 'north' });
        else if (offset !== 0) throw new Error(`Tower Bridge: Die Wendeltreppe trifft das Geschoss auf Höhe ${f} nicht (Abstand ${offset}).`);
      }
      // Seelaternen im Kern leuchten den ganzen Treppenschacht aus.
      for (let yy = st.y1 + 2; yy <= top; yy += 5) b.set(st.x, yy, st.z, 'sea_lantern');
      for (const f of t.floors) b.set(st.x, f + 3, st.z - 2, 'lantern[hanging=true]');
    } else {
      const top = t.floors[t.floors.length - 1];
      for (let yy = y.walk; yy <= top; yy++) b.set(st.x, yy, st.z, 'ladder[facing=west]');
      for (const [dx, dz] of st.door) for (let yy = y.walk; yy <= y.walk + 1; yy++) b.remove(dx, yy, dz);
    }
  });
  b.step('Ausstellung in den Geschossen', t.hx >= 10
    ? 'Stell in die unteren Geschosse Vitrinen (Glas auf poliertem Andesit), eine Bankreihe aus Schwarzeichentreppen vor dem Lesepult, Fensterbänke unter den Seitenfenstern und einen roten Teppich als Läufer durch die Mitte. Im obersten Geschoss, wo die Stege ansetzen, stehen nur Bänke an den Wänden und ein Lesepult. Unter jede Decke kommen Laternen im Raster. Das oberste Geschoss ist zum Dachstuhl hin offen – dort hängen die Laternen an Eisenketten, die bis unter das Dach reichen.'
    : 'Stell in jedes Geschoss ein Lesepult und eine Laterne auf den Boden; im obersten Geschoss hängen die Laternen zusätzlich an Eisenketten unter dem Dach.');
  bothHalves(b, () => {
    const floors = t.floors;
    floors.forEach((f, i) => {
      const ceiling = i + 1 < floors.length ? floors[i + 1] : t.top + 1;
      exhibitFloor(b, spec, geo, f, ceiling, i);
    });
  });
  b.step('Licht in den Durchfahrten', 'Häng in den Durchfahrten der Haupttürme und der Widerlagertürme unter den Bogenscheitel Laternen an einem Kettenglied – alle 4 Blöcke eine Reihe, die erste und letzte direkt an den Bogenöffnungen. So ist es dort auch nachts hell.');
  bothHalves(b, () => {
    const archTop = t.arch.top + t.arch.point.length;
    const hx = t.arch.point.length ? t.arch.point[t.arch.point.length - 1][1] : t.arch.hx;
    // Laternenreihen alle 4 Blöcke, die letzte direkt am Ende der Durchfahrt.
    const rows = (z0, z1) => {
      const list = [];
      for (let z = z0 + 1; z < z1 - 1; z += 4) list.push(z);
      return [...list, z1 - 1];
    };
    const zs = rows(t.z0, t.z1);
    const hang = (x, top, z) => {
      b.set(x, top, z, 'iron_chain[axis=y]');
      b.set(x, top - 1, z, 'lantern[hanging=true]');
    };
    for (const z of zs) for (const sx of [-1, 1]) hang(sx * Math.min(2, hx - 1), archTop, z);
    // Durchfahrt der Widerlagertürme
    const a = spec.abut;
    const aTop = a.arch.top + a.arch.point.length;
    const ahx = a.arch.point.length ? a.arch.point[a.arch.point.length - 1][1] : a.arch.hx;
    for (const z of rows(a.z0, a.z1)) for (const sx of [-1, 1]) hang(sx * Math.min(2, ahx - 1), aTop, z);
  });
}

function exhibitFloor(b, spec, geo, f, ceiling, index) {
  const t = spec.tower;
  const cells = [];
  for (let z = t.z0; z <= t.z1; z++) for (let x = -t.hx; x <= t.hx; x++) if (geo.interior(x, z) && !geo.stairShaft(x, z)) cells.push([x, z]);
  const big = t.hx >= 10;
  const grid = big ? 6 : 4;
  // Laternen im Raster unter der Decke
  for (const [x, z] of cells) {
    if (mod(x, grid) !== 0 || mod(z - t.z0, grid) !== 2 || ceiling - 1 <= f + 2) continue;
    b.set(x, ceiling - 1, z, 'lantern[hanging=true]');
    // Oberstes Geschoss ist zum Dachstuhl offen: Kette bis unter das Dach.
    for (let yy = ceiling; b.get(x, yy, z) === 'air' && yy < ceiling + 24; yy++) b.set(x, yy, z, 'iron_chain[axis=y]');
  }
  if (!big) {
    b.set(-2, f + 1, Math.round((t.z0 + t.z1) / 2), 'lantern');
    b.set(2, f + 1, Math.round((t.z0 + t.z1) / 2), 'lectern[facing=north]');
    return;
  }
  const cz = Math.round((t.z0 + t.z1) / 2);
  if (f === spec.walkway.floor) {
    for (const x of [-9, 9]) for (const z of [cz - 3, cz + 3]) b.stairs(x, f + 1, z, 'dark_oak_stairs', { facing: x < 0 ? 'west' : 'east' });
    b.set(0, f + 1, cz, 'lectern[facing=north]');
    return;
  }
  const cases = [[-6, cz - 3], [-6, cz + 3], [6, cz - 3], [6, cz + 3]];
  for (const [x, z] of cases) {
    b.set(x, f + 1, z, 'polished_andesite');
    b.set(x, f + 2, z, 'glass');
  }
  b.set(0, f + 1, cz - 4, 'lectern[facing=south]');
  for (const x of [-2, -1, 1, 2]) b.stairs(x, f + 1, cz + 1, 'dark_oak_stairs', { facing: 'south' });
  // Fensterbänke unter den Seitenfenstern (Lehne zur Wand)
  for (const z of t.windowsSide) {
    for (const sx of [-1, 1]) {
      const x = sx * (t.hx - t.wall);
      if (geo.interior(x, z)) b.stairs(x, f + 1, z, 'dark_oak_stairs', { facing: sx > 0 ? 'east' : 'west' });
    }
  }
  const extra = ['potted_fern', 'potted_azalea_bush', 'potted_red_tulip', 'potted_white_tulip'][index % 4];
  b.set(-9, f + 1, t.z0 + t.wall, extra);
  b.set(9, f + 1, t.z0 + t.wall, extra);
  // Roter Läufer durch die Mitte des Saals
  for (let z = t.z0 + t.wall; z <= t.z1 - t.wall; z++) if (geo.interior(0, z) && b.get(0, f + 1, z) === 'air') b.set(0, f + 1, z, 'red_carpet');
}

function buildRailings(b, spec) {
  const y = spec.y;
  const k = spec.bascule;
  const s = spec.side;
  b.phase('Geländer und Laternen',
    `Jetzt kommen die Geländer: auf der Klappbrücke und den Seitenfeldern Eisengitter mit einem hellblauen Pfosten alle 8 Blöcke, auf den Zufahrten eine Steinmauer. Alle ${spec.lampEvery} Blöcke steht eine Laterne auf einem dunklen Pfosten – so ist die ganze Brücke beleuchtet.`,
    { tips: ['Setz zuerst alle Pfosten, dann füll mit Eisengittern auf – die Gitter verbinden sich automatisch.'] });
  bothHalves(b, () => {
    const rail = (x, z, lampOk) => {
      const lamp = lampOk && mod(z, spec.lampEvery) === spec.lampEvery / 2;
      if (lamp) {
        b.set(x, y.walk, z, 'polished_blackstone_wall');
        b.set(x, y.walk + 1, z, 'polished_blackstone_wall');
        b.set(x, y.walk + 2, z, 'lantern');
      } else {
        b.set(x, y.walk, z, mod(z, 8) === 0 ? STEEL.blue : STEEL.rail);
      }
    };
    for (let z = 0; z <= k.z1; z++) for (const sx of [-1, 1]) rail(sx * k.parapetX, z, true);
    for (let z = s.z0; z <= s.z1; z++) for (const sx of [-1, 1]) rail(sx * s.parapetX, z, z > s.z0 + 1);
    for (let z = spec.approach.z0; z <= spec.approach.z1; z++) for (const sx of [-1, 1]) b.set(sx * s.parapetX, y.walk, z, 'stone_brick_wall');
  });
}

function buildBanks(b, spec) {
  const y = spec.y;
  const L = spec.land.x;
  b.phase('Ufer: Wege, Rasen und Bäume',
    'Hinter den Ufermauern liegt das Ufer: am Nordufer Rasen wie vor dem Tower of London, am Südufer ein gepflasterter Platz. Ein paar Platanen (hier Eichen), Laternen und Bänke runden es ab.',
    { tips: ['Das Gelände ist hier nur eine Ebene dick – im Spiel baust du es einfach auf deinen Boden.'] });
  const ground = (north) => {
    for (let z = spec.abut.z0 + 1; z <= spec.approach.z1; z++) {
      for (let x = -L; x <= L; x++) {
        const c = abutCell(spec, x, z);
        if (c.any) continue;
        if (Math.abs(x) <= spec.approach.hx + 1 && z >= spec.approach.z0) continue;
        const path = Math.abs(x) <= spec.approach.hx + 3 || z === spec.abut.z0 + 1;
        const state = north && !path ? 'grass_block' : pick(x, 1, z, 6, [['stone_bricks', 3], ['polished_andesite', 2], ['andesite', 1]]);
        b.set(x, y.ground, z, state);
      }
    }
    for (let x = -L; x <= L; x++) if (!abutCell(spec, x, spec.abut.z0).any) b.set(x, y.ground + 1, spec.abut.z0, STEEL.rail);
    const trees = spec.land.x > 20 ? [[-24, 140], [24, 146], [-18, 148]] : [[-12, 70], [12, 73]];
    for (const [x, z] of trees) if (north) tree(b, x, y.ground + 1, z, spec.land.x > 20);
    const lamps = spec.land.x > 20 ? [[-15, 137], [15, 137], [-28, 145], [28, 145]] : [[-8, 69], [8, 69]];
    for (const [x, z] of lamps) {
      for (let i = 1; i <= 3; i++) b.set(x, y.ground + i, z, 'polished_blackstone_wall');
      b.set(x, y.ground + 4, z, 'lantern');
    }
    const benches = spec.land.x > 20 ? [[-20, 137], [20, 137]] : [[-10, 69]];
    for (const [x, z] of benches) b.stairs(x, y.ground + 1, z, 'dark_oak_stairs', { facing: 'south' });
  };
  ground(false);
  b.transform({ mirror: 'z' }, () => ground(true));
}

function tree(b, x, y, z, big) {
  const h = big ? 7 : 4;
  b.set(x, y - 1, z, 'grass_block');
  for (let i = 0; i < h; i++) b.set(x, y + i, z, 'oak_log[axis=y]');
  const r = big ? 3 : 2;
  for (let dy = h - 3; dy <= h + 1; dy++) {
    const rr = dy >= h + 1 ? r - 1 : dy <= h - 3 ? r - 1 : r;
    for (let dx = -rr; dx <= rr; dx++) {
      for (let dz = -rr; dz <= rr; dz++) {
        if (dx * dx + dz * dz > rr * rr + 1) continue;
        if (b.get(x + dx, y + dy, z + dz) === 'air') b.set(x + dx, y + dy, z + dz, 'oak_leaves');
      }
    }
  }
}

function buildWater(b, spec) {
  const y = spec.y;
  b.phase('Wasser einfüllen',
    'Zum Schluss füllst du die Themse mit Wasserquellen. Am schnellsten geht es mit einer unendlichen Wasserquelle und mehreren Eimern; der Rand aus Schlamm hält das Wasser im Streifen.',
    { tips: ['Fang an einer Ufermauer an und arbeite dich Reihe für Reihe zur anderen vor.'] });
  bothHalves(b, () => {
    for (let z = 0; z <= spec.waterEndZ; z++) {
      for (let x = -spec.waterHalfX; x <= spec.waterHalfX; x++) {
        if (b.get(x, y.water, z) !== 'air') continue;
        b.set(x, y.water, z, 'water');
      }
    }
  });
}
