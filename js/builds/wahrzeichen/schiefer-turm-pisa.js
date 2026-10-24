// Schiefer Turm von Pisa – 1:1 nach echten Maßen (Recherche: docs/recherche/schiefer-turm-pisa.md).
// Der Turm wird in eigenen, aufrechten Koordinaten entworfen (x, v = Höhe, u = Nord-Süd) und dann mit zwei
// ganzzahligen Scherungen geneigt: Jedes Geschoss rückt als Ganzes nach Süden (versetzte Ebenen), und alles,
// was dadurch weit genug im Süden liegt, sinkt um einen Block (gekippte Gesimse, niedrige Südseite).
// Beide Scherungen sind umkehrbar eindeutig: kein Block geht verloren, keiner wird doppelt belegt.

export const meta = {
  id: 'schiefer-turm-pisa',
  title: 'Schiefer Turm von Pisa',
  category: 'wahrzeichen',
  subtitle: 'Geneigter Glockenturm aus Marmor in Pisa, rund 56 m hoch',
  tags: ['Italien', 'Pisa', 'Toskana', 'Turm', 'Glockenturm', 'Campanile', 'Marmor', 'Mittelalter', 'Romanik', 'Maßstab 1:1', 'Säulen', 'Rund'],
  aliases: [
    'schiefer turm', 'schiefer turm von pisa', 'schiefe turm', 'turm von pisa', 'pisa turm', 'pisaturm', 'pisa',
    'leaning tower', 'leaning tower of pisa', 'tower of pisa', 'torre di pisa', 'torre pendente', 'campanile pisa',
    'schiefer turm pisa', 'shiefer turm', 'schifer turm', 'piza turm', 'glockenturm pisa',
  ],
  accuracy: 'massstab',
  difficulty: 4,
  description: 'Der Glockenturm des Doms von Pisa im Maßstab 1:1: ein Rundturm mit 15 Blöcken Durchmesser, Erdgeschoss mit 15 Blendarkaden, sechs Säulengalerien und der schmaleren Glockenstube mit sieben Glocken. Die Neigung von 3,97° nach Süden entsteht durch versetzte Ebenen – jedes Geschoss rückt einen Block weiter, oben sind es 4 Blöcke – und die Gesimse kippen sichtbar, sodass die Südseite einen Block niedriger ist. Innen führt eine Wendeltreppe am Schacht entlang zu jeder Galerie und auf die Terrasse; Geschosshöhen von Erdgeschoss und Glockenstube sowie Teile der Innengestaltung sind geschätzt.',
  facts: [
    'Höhe: 55,86 m auf der niedrigen und 56,67 m auf der hohen Seite – im Bau 56 und 57 Blöcke.',
    'Außendurchmesser am Fuß 15,48 m, Innendurchmesser 7,37 m – im Bau 15 und 7 Blöcke.',
    'Neigung heute 3,97°, die Spitze steht rund 3,9 m außerhalb der Senkrechten (im Bau 4 Blöcke nach Süden). 1990 waren es 5,5°.',
    'Acht Geschosse: Erdgeschoss mit Blendarkaden, sechs offene Säulengalerien (je 5,82 m hoch) und die Glockenstube von 1372.',
    'Pro Galerie stehen im Original 30 Säulen; bei 1 Block = 1 m hat der äußerste Ring 40 Felder, darauf passen im Wechsel mit Öffnungen 20 Säulen.',
    'Sieben Glocken, die größte („Assunta“, 1654) wiegt rund 3,6 t. Bauzeit 1173 bis 1372, Gewicht rund 14 500 t.',
    'Geschätzt (nicht belegt): Höhe des Erdgeschosses (15 Blöcke) und der Glockenstube (6 Blöcke), Durchmesser der Glockenstube (aus dem Höhenunterschied der Seiten berechnet), Lage des Eingangs. Die echte Treppe läuft in der Mauer; hier windet sie sich innen am Schacht entlang.',
  ],
  sources: [
    { title: 'Wikipedia (en): Leaning Tower of Pisa', url: 'https://en.wikipedia.org/wiki/Leaning_Tower_of_Pisa' },
    { title: 'Wikipedia (it): Torre di Pisa', url: 'https://it.wikipedia.org/wiki/Torre_di_Pisa' },
    { title: 'Wikipedia (de): Schiefer Turm von Pisa', url: 'https://de.wikipedia.org/wiki/Schiefer_Turm_von_Pisa' },
    { title: 'Ministero della Cultura: Torre campanaria pendente', url: 'https://cultura.gov.it/luogo/torre-campanaria-pendente/' },
    { title: 'D. Speiser: The Symmetries of the Baptistery and the Leaning Tower of Pisa (Nexus 1996)', url: 'https://www.maths.tcd.ie/EMIS/journals/NNJ/conferences/N1996-Speiser.html' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

const TILT_DEG = 3.97;
const SIN_TILT = Math.sin((TILT_DEG * Math.PI) / 180);
const TAN_TILT = Math.tan((TILT_DEG * Math.PI) / 180);

const MARBLE = 'calcite';
const TRIM = 'smooth_quartz';
const COLUMN = 'quartz_pillar[axis=y]';
const GALLERY_COLUMN = 'diorite_wall';
const CAPITAL = 'chiseled_quartz_block';
const BASE = 'polished_diorite';
const SHAFT_FLOOR = 'smooth_stone';
const FOUNDATION = 'polished_andesite';
const PATH = 'smooth_stone';
const RAILING = 'iron_bars';
const AIR = 'air';

const slab = (id, type) => `${id}[type=${type}]`;
const stairs = (id, facing, half) => `${id}[facing=${facing},half=${half}]`;

// Radien sind Schwellen für den Abstand Blockmitte–Turmachse (Durchmesser = 2 · Radius bei ganzer Mitte).
function config(scale) {
  if (scale === 1) {
    return {
      scale, cx: 0, cz: 0, rOut: 7.5, rCornice: 8.5, rShaft: 3.5, rBelfry: 5.5, rBelfryCornice: 6.5, rFoundation: 9.8,
      groundH: 15, loggiaH: 6, belfryH: 6, interior: true, lawn: 17,
      diameter: 15, cornice: 17, shaftDiameter: 7, belfryDiameter: 11,
    };
  }
  if (scale === 0.5) {
    return {
      scale, cx: 0.5, cz: 0.5, rOut: 4, rCornice: 5, rShaft: 0, rBelfry: 3, rBelfryCornice: 4, rFoundation: 4.9,
      groundH: 7, loggiaH: 3, belfryH: 3, interior: false, lawn: 9,
      diameter: 8, cornice: 10, shaftDiameter: 0, belfryDiameter: 6,
    };
  }
  throw new Error(`Maßstab ${scale} wird nicht unterstützt (erlaubt: 1 und 0,5).`);
}

const roundHalfUp = (value) => Math.floor(value + 0.5);
const key2 = (x, z) => `${x},${z}`;

function cardinal(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
  return dz >= 0 ? 'south' : 'north';
}

// --- Grundriss: Zellen, Ringe (Flächenabstand nach außen), Säulen ---

function faceLayers(cells, inside) {
  const layer = new Map();
  const queue = [];
  for (const c of cells) {
    if (!inside(c.x, c.z)) continue;
    const touchesOutside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !inside(c.x + dx, c.z + dz));
    if (touchesOutside) { layer.set(key2(c.x, c.z), 0); queue.push(c); }
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const next = layer.get(key2(c.x, c.z)) + 1;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key2(c.x + dx, c.z + dz);
      if (!inside(c.x + dx, c.z + dz) || layer.has(k)) continue;
      layer.set(k, next);
      queue.push({ x: c.x + dx, z: c.z + dz });
    }
  }
  return layer;
}

function ringOrder(cells, cx, cz) {
  return cells
    .map((c) => ({ ...c, angle: Math.atan2(c.z - cz, c.x - cx) }))
    .sort((a, b) => a.angle - b.angle || a.x - b.x || a.z - b.z);
}

// Fügt bei diagonalen Nachbarn die innere Eckzelle ein, damit der Ring Fläche an Fläche läuft (für die Treppe).
function closeRing(ring, dist) {
  const closed = [];
  ring.forEach((c, i) => {
    closed.push(c);
    const n = ring[(i + 1) % ring.length];
    if (Math.abs(c.x - n.x) === 1 && Math.abs(c.z - n.z) === 1) {
      const a = { x: c.x, z: n.z };
      const b = { x: n.x, z: c.z };
      closed.push(dist(a.x, a.z) <= dist(b.x, b.z) ? a : b);
    }
  });
  return closed;
}

function nearestByAngle(ring, angle) {
  let best = null;
  let bestDiff = Infinity;
  for (const c of ring) {
    let diff = Math.abs(c.angle - angle) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff - 1e-9) { best = c; bestDiff = diff; }
  }
  return best;
}

function alternating(ring) {
  return new Set(ring.filter((_, i) => i % 2 === 0).map((c) => key2(c.x, c.z)));
}

function buildGeometry(P) {
  const { cx, cz } = P;
  const span = Math.ceil(P.rCornice) + 1;
  const dist = (x, z) => Math.hypot(x - cx, z - cz);
  const inOut = (x, z) => dist(x, z) <= P.rOut + 1e-9;
  const inBelfry = (x, z) => dist(x, z) <= P.rBelfry + 1e-9;
  const cells = [];
  for (let x = Math.floor(cx - span); x <= Math.ceil(cx + span); x++) {
    for (let z = Math.floor(cz - span); z <= Math.ceil(cz + span); z++) {
      if (dist(x, z) <= P.rCornice + 1e-9) cells.push({ x, z, d: dist(x, z) });
    }
  }
  const outLayer = faceLayers(cells, inOut);
  const belfryLayer = faceLayers(cells, inBelfry);
  const shaftInside = (x, z) => P.interior && dist(x, z) <= P.rShaft + 1e-9;
  const shaftLayer = faceLayers(cells, shaftInside);
  for (const c of cells) {
    const k = key2(c.x, c.z);
    c.inOut = inOut(c.x, c.z);
    c.layer = c.inOut ? outLayer.get(k) : -1;
    c.inCornice = !c.inOut && c.d <= P.rCornice + 1e-9;
    c.inShaft = shaftInside(c.x, c.z);
    c.inCore = c.inOut && c.layer >= (P.interior ? 2 : 1) && !c.inShaft;
    c.inBelfry = inBelfry(c.x, c.z);
    c.belfryRing = c.inBelfry && belfryLayer.get(k) === 0;
    c.inBelfryCornice = !c.inBelfry && c.d <= P.rBelfryCornice + 1e-9;
  }
  const outRing = ringOrder(cells.filter((c) => c.layer === 0), cx, cz);
  const belfryRing = ringOrder(cells.filter((c) => c.belfryRing), cx, cz);
  const shaftRing = closeRing(ringOrder(cells.filter((c) => c.inShaft && shaftLayer.get(key2(c.x, c.z)) === 0), cx, cz), dist);

  const groundColumns = P.interior
    ? new Set(Array.from({ length: 15 }, (_, k) => nearestByAngle(outRing, (k * 2 * Math.PI) / 15)).map((c) => key2(c.x, c.z)))
    : alternating(outRing);
  const loggiaColumns = alternating(outRing);
  const belfryOpenings = P.interior
    ? new Set(Array.from({ length: 16 }, (_, k) => nearestByAngle(belfryRing, ((k + 0.5) * 2 * Math.PI) / 16)).map((c) => key2(c.x, c.z)))
    : alternating(belfryRing);

  const railRing = closeRing(outRing, dist).filter((c) => inOut(c.x, c.z));
  return { cells, byKey: new Map(cells.map((c) => [key2(c.x, c.z), c])), outRing, railRing, belfryRing, shaftRing, groundColumns, loggiaColumns, belfryOpenings };
}

// --- Geschosse und Neigung ---

function buildStoreys(P) {
  const list = [{ kind: 'ground', L: 0, h: P.groundH }];
  for (let k = 0; k < 6; k++) list.push({ kind: 'loggia', index: k + 1, L: P.groundH + k * P.loggiaH, h: P.loggiaH });
  list.push({ kind: 'belfry', L: P.groundH + 6 * P.loggiaH, h: P.belfryH });
  for (const st of list) st.shift = roundHalfUp(TAN_TILT * (st.L + (st.h - 1) / 2));
  return list;
}

function toWorld(P, x, v, u, shift) {
  const wz = u + shift;
  const drop = Math.min(0, roundHalfUp(-SIN_TILT * (wz - P.cz)));
  return [x, v + drop, wz];
}

// Sammelt Blöcke eines Geschosses in Turm-Koordinaten; flush() setzt sie geneigt in die Welt.
class LocalLayer {
  constructor() { this.cells = new Map(); }
  set(x, v, u, state) { this.cells.set(`${x},${v},${u}`, { x, v, u, state }); }
  flush(b, P, shift) {
    for (const { x, v, u, state } of this.cells.values()) {
      const [wx, wy, wz] = toWorld(P, x, v, u, shift);
      if (state === AIR) b.remove(wx, wy, wz);
      else b.set(wx, wy, wz, state);
    }
  }
}

// --- Treppe im Schacht (nur Maßstab 1) ---

function stairPlan(P, g, storeys) {
  const ring = g.shaftRing;
  const N = ring.length;
  for (let i = 0; i < N; i++) {
    const a = ring[i];
    const b2 = ring[(i + 1) % N];
    if (Math.abs(a.x - b2.x) + Math.abs(a.z - b2.z) !== 1) throw new Error('Schacht-Ring ist nicht lückenlos – Treppe nicht planbar.');
  }
  const inShaft = (x, z) => g.byKey.get(key2(x, z))?.inShaft === true;
  const doorCandidates = [
    { x: P.cx, z: P.cz - 3, dir: [0, -1] },
    { x: P.cx - 3, z: P.cz, dir: [-1, 0] },
    { x: P.cx + 3, z: P.cz, dir: [1, 0] },
  ];
  const entrance = key2(P.cx - 3, P.cz);
  const plans = [];
  let fromBelow = null;
  for (let i = 0; i < storeys.length - 1; i++) {
    const st = storeys[i];
    const next = storeys[i + 1];
    const n = st.h - 1;
    const dS = next.shift - st.shift;
    let chosen = null;
    for (const strict of [true, false]) {
      for (let s = 0; s < N && !chosen; s++) {
        const path = Array.from({ length: n + 1 }, (_, j) => ring[(s + j) % N]);
        const k0 = key2(path[0].x, path[0].z);
        const k1 = key2(path[1].x, path[1].z);
        const blocked0 = fromBelow ? [fromBelow.conn, fromBelow.clear] : [entrance];
        const blocked1 = fromBelow ? [fromBelow.conn] : [entrance];
        if (blocked0.includes(k0) || blocked1.includes(k1)) continue;
        const last = path[n];
        const conn = { x: last.x, z: last.z - dS };
        if (!inShaft(conn.x, conn.z)) continue;
        const holes = [path[n - 2], path[n - 1]].map((c) => ({ x: c.x, z: c.z - dS }));
        if (strict && holes.some((h) => !inShaft(h.x, h.z))) continue;
        let door = null;
        if (st.kind === 'loggia') {
          const taken = new Set([k0, k1, ...(fromBelow ? [fromBelow.conn, fromBelow.clear, ...fromBelow.holes] : [])]);
          door = doorCandidates.find((d) => !taken.has(key2(d.x, d.z))) ?? null;
          if (!door) continue;
        }
        chosen = { path, conn, holes, door, dS };
      }
      if (chosen) break;
    }
    if (!chosen) throw new Error(`Keine passende Treppenführung im Geschoss ${i + 1} gefunden.`);
    const facings = [];
    for (let j = 0; j < n; j++) facings.push(cardinal(chosen.path[j + 1].x - chosen.path[j].x, chosen.path[j + 1].z - chosen.path[j].z));
    plans.push({ stairs: chosen.path.slice(0, n), facings, door: chosen.door, fromBelow });
    fromBelow = {
      conn: key2(chosen.conn.x, chosen.conn.z),
      connCell: chosen.conn,
      connFacing: facings[n - 1],
      clear: key2(chosen.holes[1].x, chosen.holes[1].z),
      holes: chosen.holes.map((h) => key2(h.x, h.z)),
      holeCells: chosen.holes,
    };
  }
  plans.push({ stairs: [], facings: [], door: null, fromBelow });
  return plans;
}

// --- Entwurf der Geschosse ---

function archFacing(g, ring, index, columns) {
  const cell = ring[index];
  const prev = ring[(index - 1 + ring.length) % ring.length];
  const next = ring[(index + 1) % ring.length];
  const prevCol = columns.has(key2(prev.x, prev.z));
  const nextCol = columns.has(key2(next.x, next.z));
  if (prevCol === nextCol) return null;
  const col = prevCol ? prev : next;
  return cardinal(col.x - cell.x, col.z - cell.z);
}

function designGround(P, g, st, plan, local) {
  const { L, h } = st;
  const ring = g.outRing;
  const arch = new Map();
  ring.forEach((c, i) => {
    if (!g.groundColumns.has(key2(c.x, c.z))) arch.set(key2(c.x, c.z), archFacing(g, ring, i, g.groundColumns));
  });
  const colTop = h - 5;
  for (const c of g.cells) {
    const k = key2(c.x, c.z);
    const isCol = g.groundColumns.has(k);
    for (let r = 0; r < h; r++) {
      const v = L + r;
      if (c.inCornice) {
        if (r === 0) {
          // Auf der abgesunkenen Südseite liegt die Sockelstufe in Höhe des Pflasters: dort voller Block statt Stufe.
          const sunk = toWorld(P, c.x, v, c.z, st.shift)[1] < v;
          local.set(c.x, v, c.z, sunk ? BASE : slab('polished_diorite_slab', 'bottom'));
        }
        if (r === h - 2) local.set(c.x, v, c.z, stairs('smooth_quartz_stairs', cardinal(P.cx - c.x, P.cz - c.z), 'top'));
        continue;
      }
      if (!c.inOut) continue;
      if (r === 0) { local.set(c.x, v, c.z, BASE); continue; }
      if (c.inShaft) continue;
      if (c.layer === 0 && !P.interior) {
        // Maßstab 1:2: Blendarkade über die ganze Höhe, oben direkt das Gesims.
        if (r <= h - 3) { if (isCol) local.set(c.x, v, c.z, COLUMN); }
        else local.set(c.x, v, c.z, TRIM);
        continue;
      }
      if (c.layer === 0) {
        if (r === 1) local.set(c.x, v, c.z, BASE);
        else if (r <= colTop) { if (isCol) local.set(c.x, v, c.z, COLUMN); }
        else if (r === h - 4) {
          if (isCol) local.set(c.x, v, c.z, CAPITAL);
          else {
            const facing = arch.get(k);
            local.set(c.x, v, c.z, facing ? stairs('quartz_stairs', facing, 'top') : slab('smooth_quartz_slab', 'top'));
          }
        } else if (r === h - 3) local.set(c.x, v, c.z, MARBLE);
        else local.set(c.x, v, c.z, TRIM);
        continue;
      }
      if (r === h - 1 && c.layer === 1) local.set(c.x, v, c.z, TRIM);
      else local.set(c.x, v, c.z, MARBLE);
    }
  }
  if (!P.interior) return;
  // Eingang auf der Westseite: Tür in der Mauer, Gang bis in den Schacht.
  const z = P.cz;
  for (let x = P.cx - 7; x <= P.cx - 4; x++) for (let v = L + 1; v <= L + 2; v++) local.set(x, v, z, AIR);
  local.set(P.cx - 6, L + 1, z, 'dark_oak_door[facing=east,half=lower,hinge=left,open=false]');
  local.set(P.cx - 6, L + 2, z, 'dark_oak_door[facing=east,half=upper,hinge=left,open=false]');
  for (const dz of [-1, 1]) for (let v = L + 1; v <= L + 2; v++) local.set(P.cx - 6, v, z + dz, COLUMN);
  for (let dz = -1; dz <= 1; dz++) local.set(P.cx - 6, L + 3, z + dz, CAPITAL);
  designShaft(P, st, plan, local);
}

function designLoggia(P, g, st, plan, local) {
  const { L, h } = st;
  for (const c of g.cells) {
    const k = key2(c.x, c.z);
    const isCol = g.loggiaColumns.has(k);
    for (let r = 0; r < h; r++) {
      const v = L + r;
      if (c.inCornice) {
        if (r === h - 1) local.set(c.x, v, c.z, slab('smooth_quartz_slab', 'top'));
        continue;
      }
      if (!c.inOut) continue;
      if (c.inShaft) { if (r === 0) local.set(c.x, v, c.z, SHAFT_FLOOR); continue; }
      if (c.inCore) { local.set(c.x, v, c.z, MARBLE); continue; }
      if (r === 0 && P.interior) { local.set(c.x, v, c.z, TRIM); continue; }
      if (r === h - 1) {
        // Oberste Ebene: über den Säulen Kapitelle, über den Öffnungen flache Bögen, dahinter die Decke des Umgangs.
        if (P.interior && c.layer === 0) local.set(c.x, v, c.z, isCol ? CAPITAL : slab('smooth_quartz_slab', 'top'));
        else local.set(c.x, v, c.z, TRIM);
        continue;
      }
      if (c.layer === 0 && isCol) local.set(c.x, v, c.z, GALLERY_COLUMN);
    }
  }
  if (!P.interior) return;
  const door = plan.door;
  let x = door.x;
  let z = door.z;
  for (let step = 1; step <= 6; step++) {
    x += door.dir[0];
    z += door.dir[1];
    const c = g.byKey.get(key2(x, z));
    if (!c || !c.inCore) break;
    local.set(x, L + 1, z, AIR);
    local.set(x, L + 2, z, AIR);
  }
  designShaft(P, st, plan, local);
}

function designBelfry(P, g, st, plan, local) {
  const { L, h } = st;
  for (const c of g.cells) {
    const k = key2(c.x, c.z);
    const open = g.belfryOpenings.has(k);
    for (let r = 0; r < h; r++) {
      const v = L + r;
      if (r === 0) { if (c.inOut) local.set(c.x, v, c.z, TRIM); continue; }
      if (r === h - 1) {
        if (c.inBelfry) local.set(c.x, v, c.z, TRIM);
        else if (c.inBelfryCornice) local.set(c.x, v, c.z, slab('smooth_quartz_slab', 'bottom'));
        continue;
      }
      if (c.belfryRing) {
        if (P.interior && r === h - 2) local.set(c.x, v, c.z, open ? slab('smooth_quartz_slab', 'top') : CAPITAL);
        else if (!open) local.set(c.x, v, c.z, COLUMN);
        continue;
      }
      if (c.inBelfry && !P.interior) local.set(c.x, v, c.z, MARBLE);
    }
  }
  if (P.interior) designShaft(P, st, plan, local);
}

// Boden-Löcher über der Treppe von unten, Anschlussstufe und die eigene Treppe des Geschosses.
function designShaft(P, st, plan, local) {
  const { L } = st;
  const below = plan.fromBelow;
  if (below) {
    for (const hole of below.holeCells) local.set(hole.x, L, hole.z, AIR);
    const [hx, hz] = below.clear.split(',').map(Number);
    local.set(hx, L + 1, hz, AIR);
    local.set(below.connCell.x, L, below.connCell.z, stairs('smooth_quartz_stairs', below.connFacing, 'bottom'));
  }
  plan.stairs.forEach((c, j) => local.set(c.x, L + 1 + j, c.z, stairs('smooth_quartz_stairs', plan.facings[j], 'bottom')));
}

// --- Ausstattung: Glocken, Laternen, Geländer ---

function belfryBells(P, g) {
  // Himmelsrichtungen nach der Glockentabelle (de.wikipedia): Assunta NO, Crocifisso SO, San Ranieri S,
  // Pasquereccia SW, Del Pozzo W; Terza und Vespruccio hängen im Original eine Reihe höher (SW, S).
  const bearings = [45, 135, 180, 225, 270, 247.5, 157.5];
  const used = new Set();
  const result = [];
  for (const bearing of bearings) {
    const rad = (bearing * Math.PI) / 180;
    const angle = Math.atan2(-Math.cos(rad), Math.sin(rad));
    const candidates = g.belfryRing.filter((c) => g.belfryOpenings.has(key2(c.x, c.z)) && !used.has(key2(c.x, c.z)));
    const cell = nearestByAngle(candidates, angle);
    used.add(key2(cell.x, cell.z));
    result.push(cell);
  }
  return result;
}

function nearestLayerCell(g, layer, dx, dz, P) {
  let best = null;
  let bestScore = -Infinity;
  for (const c of g.cells) {
    if (c.layer !== layer) continue;
    const score = ((c.x - P.cx) * dx + (c.z - P.cz) * dz) / c.d;
    if (score > bestScore + 1e-9) { best = c; bestScore = score; }
  }
  return best;
}

// --- Texte ---

function storeyText(P, st, prevShift) {
  const moved = st.shift - prevShift;
  const shiftText = moved > 0
    ? ` Neigung: Alles in diesem Geschoss sitzt ${moved === 1 ? 'einen Block' : `${moved} Blöcke`} weiter südlich als das Geschoss darunter (insgesamt ${st.shift} ${st.shift === 1 ? 'Block' : 'Blöcke'} gegenüber dem Fuß) – das vorstehende Gesims darunter trägt die neue Südkante.`
    : '';
  return shiftText;
}

// --- Bau ---

export default function build(b, { scale = 1 } = {}) {
  const P = config(scale);
  const g = buildGeometry(P);
  const storeys = buildStoreys(P);
  const plans = P.interior ? stairPlan(P, g, storeys) : storeys.map(() => null);
  const topShift = storeys[storeys.length - 1].shift;

  // 1. Fundament
  b.phase(
    'Fundament',
    `Lege zuerst eine runde Fundamentplatte aus Poliertem Andesit mit rund ${Math.round(2 * P.rFoundation)} Blöcken Durchmesser eine Ebene unter dem späteren Rasen. Sie bildet um den Turm herum den gepflasterten Rand. Der Turm selbst steht in der Mitte; die Turmachse liegt im Fuß genau über der Mitte der Platte.`,
    { tips: ['Markiere die Mitte mit einem Block in auffälliger Farbe – alle Kreise des Turms gehen von dieser Achse aus.', 'Der Turm kippt später nach Süden. Lass dort auf dem Bauplatz mehr Platz als im Norden.'] },
  );
  const span = Math.ceil(P.rFoundation);
  for (let x = Math.floor(P.cx - span); x <= Math.ceil(P.cx + span); x++) {
    for (let z = Math.floor(P.cz - span); z <= Math.ceil(P.cz + span); z++) {
      if (Math.hypot(x - P.cx, z - P.cz) <= P.rFoundation + 1e-9) b.set(x, -1, z, FOUNDATION);
    }
  }

  // 2.–9. Geschosse
  let prevShift = 0;
  storeys.forEach((st, i) => {
    const local = new LocalLayer();
    const plan = plans[i];
    if (st.kind === 'ground') {
      b.phase(
        'Erdgeschoss mit Blendarkaden',
        `Das Erdgeschoss ist ein Ring mit ${P.diameter} Blöcken Außendurchmesser und ${st.h} Ebenen Höhe. Unten liegt ein Sockel aus Poliertem Diorit mit einer umlaufenden Stufe aus Dioritstufen. Darüber stehen ${P.interior ? '15' : g.groundColumns.size} Halbsäulen aus Quarzsäulen direkt in der Außenwand; dazwischen bleibt die äußerste Blockreihe offen, sodass flache Blendbögen entstehen. Oben schließen umgedrehte Quarztreppen die Bögen ab, darüber folgen eine Ebene Kalzit und ein Gesims aus umgedrehten Quarztreppen, deren hohe Seite zur Turmmitte zeigt.${P.interior ? ` Innen bleibt ein runder Schacht mit ${P.shaftDiameter} Blöcken Durchmesser frei; an seiner Wand windet sich die Treppe nach oben. Auf der Westseite führt ein zwei Blöcke hoher Gang mit einer Schwarzeichentür in den Schacht.` : ' Im Maßstab 1:2 ist der Turm innen massiv.'}`,
        { tips: ['Setze erst die Halbsäulen rundherum, dann die Wand dazwischen – so stimmen die Abstände der Bögen.', 'Die Gesims-Treppen setzt du am einfachsten von oben: Schau beim Setzen zur Turmmitte und klicke an die Unterkante des Nachbarblocks, dann landet die Treppe umgedreht.'] },
      );
    } else if (st.kind === 'loggia') {
      b.phase(
        `${st.index}. Säulengalerie`,
        `Jede Galerie ist ${st.h} Ebenen hoch. ${P.interior ? `Unterste Ebene: Boden aus Glattem Quarz bis zur Außenkante. Dann vier Ebenen offener Säulengang: Auf dem äußersten Ring wechseln schlanke Säulen aus Dioritmauer und Öffnungen ab (${g.loggiaColumns.size} Säulen), dahinter bleibt ein Block breiter Umgang frei, innen steht die Kernmauer aus Kalzit. In der obersten Ebene sitzen über den Säulen Gemeißelte Quarzblöcke als Kapitelle und über den Öffnungen obere Quarzstufen als flache Bögen; der Umgang bekommt eine Decke aus Glattem Quarz, und ein Ring oberer Quarzstufen steht einen Block über die Wand vor.` : 'Zwei Ebenen lang wechseln auf dem äußersten Ring Säulen aus Dioritmauer und Nischen ab (dahinter massiver Kalzit), darüber folgt ein Gesims aus Glattem Quarz mit einem vorstehenden Ring oberer Quarzstufen.'}${storeyText(P, st, prevShift)}${P.interior ? ' Von der Treppe im Schacht führt ein Durchgang durch die Kernmauer auf die Galerie.' : ''}`,
        { tips: st.shift !== prevShift
          ? ['Zähle beim Versetzen von der Turmachse aus: Die neue Achse liegt genau einen Block südlich der alten. Setze erst die vier Punkte Nord, Ost, Süd und West des neuen Rings.']
          : ['Die Säulen stehen genau über den Säulen der Galerie darunter – du kannst sie einfach nach oben weiterziehen.'] },
      );
      if (st.shift !== prevShift) {
        const [nx, ny, nz] = toWorld(P, Math.floor(P.cx), st.L, Math.floor(P.cz + P.rOut), st.shift);
        b.note(nx, ny, nz, `Ab hier liegt alles ${st.shift - prevShift === 1 ? 'einen Block' : `${st.shift - prevShift} Blöcke`} weiter südlich – so entsteht die Neigung.`);
      }
    } else {
      b.phase(
        'Glockenstube und Terrasse',
        `Auf der letzten Galerie liegt eine runde Terrasse aus Glattem Quarz (${P.diameter} Blöcke). Darauf steht die schmalere Glockenstube mit ${P.belfryDiameter} Blöcken Durchmesser: ein Ring aus Quarzsäulen mit ${P.interior ? '16 Bogenöffnungen' : 'Nischen'}, oben ein Dach aus Glattem Quarz mit einem vorstehenden Rand aus unteren Quarzstufen.${storeyText(P, st, prevShift)}`,
        { tips: ['Die Glockenstube ist kleiner als der Turm: Ihr Ring beginnt zwei Blöcke innerhalb der Terrassenkante.'] },
      );
      if (st.shift !== prevShift) {
        const [nx, ny, nz] = toWorld(P, Math.floor(P.cx), st.L, Math.floor(P.cz + P.rOut), st.shift);
        b.note(nx, ny, nz, `Die Terrasse liegt noch einmal einen Block weiter südlich – jetzt ${st.shift} Blöcke gegenüber dem Fuß.`);
      }
    }
    if (st.kind === 'ground') designGround(P, g, st, plan, local);
    else if (st.kind === 'loggia') designLoggia(P, g, st, plan, local);
    else designBelfry(P, g, st, plan, local);
    local.flush(b, P, st.shift);
    prevShift = st.shift;
  });

  // 10. Ausstattung
  const belfry = storeys[storeys.length - 1];
  b.phase(
    P.interior ? 'Glocken, Geländer und Licht' : 'Geländer',
    P.interior
      ? 'Hänge die sieben Glocken in die Bogenöffnungen der Glockenstube: Jede Glocke hängt an der Decke über der Öffnung (Glocke an die Unterseite des Blocks setzen). Um die Terrasse läuft ein Geländer aus Eisengittern. Damit im Turm keine Monster entstehen, hängt in jedem Geschoss des Schachts eine Laterne unter dem nächsten Boden, im Erdgeschoss steht zusätzlich eine auf dem Boden, auf jeder Galerie hängen vier Laternen und in der Glockenstube eine in der Mitte.'
      : 'Setze auf den äußersten Ring der Terrasse ein Geländer aus Eisengittern.',
    { tips: P.interior ? ['Laternen hängen nur, wenn du sie an die Unterseite eines Blocks setzt – im Schacht ist das jeweils der Boden des nächsten Geschosses.'] : [] },
  );
  if (P.interior) b.step('Geländer', 'Setze auf den äußersten Ring der Terrasse Eisengitter. Sie verbinden sich von selbst zu einem durchgehenden Geländer.');
  const railing = new LocalLayer();
  for (const c of g.railRing) railing.set(c.x, belfry.L + 1, c.z, RAILING);
  railing.flush(b, P, belfry.shift);
  if (P.interior) {
    b.step('Glocken', 'Setze über jede der sieben Glockenöffnungen einen Glatten Quarzblock statt der Stufe und hänge die Glocke direkt darunter an seine Unterseite. Die Glocken hängen nach Nordosten, Südosten, Süden, Südwesten, Westen und die zwei kleineren dazwischen nach Südsüdost und Westsüdwest (im Original hängen diese beiden eine Reihe höher).');
    const bells = new LocalLayer();
    for (const cell of belfryBells(P, g)) {
      bells.set(cell.x, belfry.L + belfry.h - 2, cell.z, TRIM);
      bells.set(cell.x, belfry.L + belfry.h - 3, cell.z, `bell[attachment=ceiling,facing=${cardinal(cell.x - P.cx, cell.z - P.cz)}]`);
    }
    bells.set(P.cx, belfry.L + belfry.h - 2, P.cz, 'lantern[hanging=true]');
    bells.flush(b, P, belfry.shift);
    const bellCell = belfryBells(P, g)[0];
    const [bx, by, bz] = toWorld(P, bellCell.x, belfry.L + belfry.h - 3, bellCell.z, belfry.shift);
    b.note(bx, by, bz, 'Die größte Glocke „Assunta“ hängt nach Nordosten.');
    b.step('Laternen in Schacht und Galerien', 'Hänge in jedem Geschoss eine Laterne mitten unter den Boden des nächsten Geschosses, stelle im Erdgeschoss eine zweite auf den Boden und hänge auf jeder Galerie vier Laternen (Nord, Ost, Süd, West) an die Decke des Umgangs.');
    storeys.forEach((st) => {
      if (st.kind === 'belfry') return;
      const lights = new LocalLayer();
      lights.set(P.cx, st.L + st.h - 1, P.cz, 'lantern[hanging=true]');
      if (st.kind === 'ground') lights.set(P.cx, st.L + 1, P.cz, 'lantern[hanging=false]');
      if (st.kind === 'loggia') {
        for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const c = nearestLayerCell(g, 1, dx, dz, P);
          lights.set(c.x, st.L + st.h - 2, c.z, 'lantern[hanging=true]');
        }
      }
      lights.flush(b, P, st.shift);
    });
  }

  // 11. Umgebung
  b.phase(
    'Rasen und Weg',
    `Rund um den Turm liegt der Rasen der Piazza dei Miracoli. Fülle die Fläche um die Fundamentplatte auf derselben Ebene mit Grasblöcken und lege von Westen einen ${P.interior ? 'drei' : 'einen'} Block breiten Weg aus Glattem Stein bis zum Sockel${P.interior ? ' vor der Eingangstür' : ''}. Ein paar Grasbüschel lockern den Rasen auf.`,
    { tips: ['Die Gras-Ebene liegt genau eine Ebene unter dem Sockel – der Turm steht also auf dem Boden, nicht darin.'] },
  );
  const lawn = P.lawn;
  const x1 = Math.floor(P.cx - lawn);
  const x2 = Math.ceil(P.cx + lawn);
  const z1 = Math.floor(P.cz - lawn);
  const z2 = Math.ceil(P.cz + lawn + topShift);
  const pathHalf = P.interior ? 1 : 0;
  for (let x = x1; x <= Math.floor(P.cx - P.rFoundation); x++) {
    for (let dz = -pathHalf; dz <= pathHalf; dz++) {
      const z = Math.round(P.cz - 0.25) + dz;
      if (b.get(x, -1, z) === AIR) b.set(x, -1, z, PATH);
    }
  }
  b.fill(x1, -1, z1, x2, -1, z2, 'grass_block', { keep: true });
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      if (!b.get(x, -1, z).startsWith('grass_block') || b.get(x, 0, z) !== AIR) continue;
      if (b.chance(0.07)) b.set(x, 0, z, 'short_grass');
    }
  }
  if (P.interior) b.note(P.cx - 7, 1, P.cz, 'Eingang: Schwarzeichentür auf der Westseite, dahinter der Gang zur Wendeltreppe.');
}
