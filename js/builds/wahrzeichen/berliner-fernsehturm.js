// Berliner Fernsehturm – 1:1 nach echten Maßen (Recherche: docs/recherche/berliner-fernsehturm.md).
// Koordinaten: Turmachse bei x = z = 0.5 (gerade Durchmesser), Platz auf y = 0, 1 Block = 1 m bei scale 1.

export const meta = {
  id: 'berliner-fernsehturm',
  title: 'Berliner Fernsehturm',
  category: 'wahrzeichen',
  subtitle: 'Fernsehturm am Alexanderplatz, 368 m hoch',
  tags: ['Berlin', 'Deutschland', 'Turm', 'Fernsehturm', 'Beton', 'Kugel', 'Riesig', 'Maßstab 1:1', 'Aussichtsturm', 'DDR'],
  aliases: [
    'berliner fernsehturm', 'fernsehturm berlin', 'fernsehturm', 'tv turm', 'tv-turm', 'tv tower berlin', 'berlin tv tower',
    'fernsehturm alexanderplatz', 'alex turm', 'alexanderplatz', 'telespargel', 'fernseturm', 'fernsehtrum', 'berlin turm',
  ],
  accuracy: 'massstab',
  description: 'Der Berliner Fernsehturm im Maßstab 1:1: 368 m hoch, ein Betonschaft, der sich von 16 m auf 9 m verjüngt, die 32 m große Kugel mit Aussichtsgeschoss und Telecafé hinter bronzefarbenen Fensterbändern und der 118 m lange Antennenträger mit rot-weißer Spitze. Im Schaft führt eine Wendeltreppe bis zur Aussichtsetage, unten stehen der Turmfuß mit Bullaugen und die Umbauung mit weißem Faltdach. Kugel, Geschosshöhen und Schaftmaße sind belegt; der genaue Verlauf der Verjüngung, die Form der Umbauung und die Einrichtung sind vereinfacht oder geschätzt.',
  sources: [
    { title: 'Wikipedia (de): Berliner Fernsehturm', url: 'https://de.wikipedia.org/wiki/Berliner_Fernsehturm' },
    { title: 'Wikipedia (en): Fernsehturm Berlin', url: 'https://en.wikipedia.org/wiki/Fernsehturm_Berlin' },
  ],
  credits: null,
  scales: [1, 0.5, 0.25],
  tested: null,
};

const H = {
  footTop: 20,
  shaftTop: 248.78,
  sphereCenter: 213.78,
  sphereDiameter: 32,
  climate: 200,
  observation: 203.78,
  restaurant: 207.53,
  technical: [216, 220, 224],
  antennaTop: 368.03,
  antennaThin: 290,
  stripes: 330,
  portholes: [45, 90, 135, 180],
  warningLights: [91, 136, 181],
  dishPlatforms: [236, 242],
};
const D = { foot: 32, shaftBottom: 16, shaftTop: 9, antenna: 4, antennaThin: 2 };
const ROOF = { peak: 21, slope: 0.3, valleySlope: 0.55, inner: 9, corner: 44, wall: 30, gallery: 4.5 };

const P = {
  concrete: 'polished_diorite',
  concreteLight: 'white_concrete',
  steel: 'iron_block',
  seam: 'smooth_stone',
  window: 'brown_stained_glass',
  floor: 'smooth_stone',
  floorTop: 'polished_diorite',
  core: 'gray_concrete',
  stairs: 'stone_brick_stairs',
  paving: 'smooth_stone',
  pavingRing: 'polished_andesite',
  roof: 'smooth_quartz',
  roofSlab: 'smooth_quartz_slab',
  pane: 'glass_pane',
  mullion: 'white_concrete',
};

const CX = 0.5;
const CZ = 0.5;

function geometry(scale) {
  const s = scale;
  return {
    s,
    level: (m) => 1 + Math.round(m * s), // Ebene, deren Unterkante auf m Metern liegt
    floorAt: (m) => Math.round(m * s), // Bodenblock, dessen Oberkante auf m Metern liegt
    meters: (y) => (y - 0.5) / s,
    radius: (diameterM) => Math.max(0, (diameterM * s) / 2 - 0.5),
  };
}

const dist = (x, z) => Math.hypot(x - CX, z - CZ);
const inside = (x, z, r) => dist(x, z) <= r + 0.5;

function circleCells(r) {
  const cells = [];
  const e = Math.ceil(r + 1);
  for (let x = -e; x <= e + 1; x++) {
    for (let z = -e; z <= e + 1; z++) if (inside(x, z, r)) cells.push([x, z]);
  }
  return cells;
}

// Rand eines Kreises: Zellen im Kreis mit einem Nachbarn außerhalb (dicht, ohne Lücken).
function ringCells(r) {
  return circleCells(r).filter(([x, z]) => !inside(x + 1, z, r) || !inside(x - 1, z, r) || !inside(x, z + 1, r) || !inside(x, z - 1, r));
}

function shaftDiameterM(m) {
  if (m <= H.footTop) return D.shaftBottom;
  const t = Math.min(1, (m - H.footTop) / (H.shaftTop - H.footTop));
  return D.shaftBottom - t * (D.shaftBottom - D.shaftTop);
}

// Turmfuß: Kegelstumpf, der sich nach oben hyperbelartig an den Schaft anschmiegt (Form geschätzt).
function footDiameterM(m) {
  const t = Math.max(0, Math.min(1, (H.footTop - m) / H.footTop));
  return D.shaftBottom + (D.foot - D.shaftBottom) * t * t;
}

// n Randzellen in gleichen Winkelabständen (für Bullaugen und Nähte), je Richtung die äußerste passende Zelle.
function evenlySpaced(cells, n, offset = 0) {
  const picked = new Map();
  for (const [x, z] of cells) {
    const a = Math.atan2(z - CZ, x - CX) - offset;
    const k = Math.round((a / (2 * Math.PI)) * n);
    const miss = Math.abs(a - (k * 2 * Math.PI) / n) * dist(x, z);
    const key = ((k % n) + n) % n;
    const best = picked.get(key);
    if (!best || miss < best.miss) picked.set(key, { x, z, miss });
  }
  return [...picked.values()].filter((c) => c.miss <= 0.75).map((c) => [c.x, c.z]);
}

function setRing(b, y, r, state) {
  const cells = ringCells(r);
  for (const [x, z] of cells) b.set(x, y, z, state);
  return cells;
}

const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const solidNeighbors = (b, x, y, z) => FACES.filter(([dx, dy, dz]) => b.get(x + dx, y + dy, z + dz) !== 'air').length;

// Blöcke, die nur über Kanten an der Wand hängen (schräge Kreisränder, schnell schrumpfende Ebenen), lassen sich im
// Spiel nicht ohne Hilfsblock setzen. Je losem Block kommt innen ein gleicher Block dazu, der ihn mit der Wand verbindet.
function connectLooseBlocks(b, cells) {
  for (const [x, y, z] of cells) {
    const state = b.get(x, y, z);
    if (state === 'air' || solidNeighbors(b, x, y, z) > 0) continue;
    let best = null;
    for (const [dx, dy, dz] of FACES) {
      const [nx, ny, nz] = [x + dx, y + dy, z + dz];
      if (b.get(nx, ny, nz) !== 'air' || dist(nx, nz) > dist(x, z)) continue;
      const score = solidNeighbors(b, nx, ny, nz) - 1;
      if (score > 0 && (!best || score > best.score)) best = { nx, ny, nz, score };
    }
    if (best) b.set(best.nx, best.ny, best.nz, state);
  }
}

// Lichter an der Innenwand: von der Achse aus nach außen bis zur Wand, Fackel mit Blick zur Achse.
const AXES = [
  { dx: 1, dz: 0, facing: 'west' },
  { dx: -1, dz: 0, facing: 'east' },
  { dx: 0, dz: 1, facing: 'north' },
  { dx: 0, dz: -1, facing: 'south' },
];

function innerWallCell(b, y, axis, maxSteps = 40) {
  // Start außerhalb von Aufzugskern und Treppenring (Abstand 3 von der Achse)
  let x = axis.dx === 0 ? 0 : axis.dx * 3;
  let z = axis.dz === 0 ? 0 : axis.dz * 3;
  let last = null;
  for (let i = 0; i < maxSteps; i++) {
    if (b.get(x, y, z) !== 'air') return last;
    if (b.get(x + axis.dx, y, z + axis.dz) !== 'air') return [x, z];
    last = [x, z];
    x += axis.dx;
    z += axis.dz;
  }
  return null;
}

function wallTorch(b, y, axis, id = 'wall_torch') {
  const cell = innerWallCell(b, y, axis);
  if (!cell) return false;
  const [x, z] = cell;
  const support = b.get(x + axis.dx, y, z + axis.dz);
  if (support === 'air' || /stairs|torch|lantern/.test(support)) return false;
  b.set(x, y, z, `${id}[facing=${axis.facing}]`);
  return true;
}

// Außenwand: Zelle ganz außen auf der Achse; Hindernisfeuer davor.
function outerTorch(b, y, r, axis) {
  const reach = Math.ceil(r + 2);
  for (let i = reach; i >= 0; i--) {
    const x = (axis.dx > 0 ? 1 : 0) + axis.dx * i;
    const z = (axis.dz > 0 ? 1 : 0) + axis.dz * i;
    if (b.get(x, y, z) !== 'air') {
      const opposite = { west: 'east', east: 'west', north: 'south', south: 'north' }[axis.facing];
      b.set(x + axis.dx, y, z + axis.dz, `redstone_wall_torch[facing=${opposite}]`);
      return;
    }
  }
}

// Wendeltreppe um den Aufzugskern (3 × 3) auf dem Ring mit Abstand 2 um (0, 0), im Uhrzeigersinn, Start im Norden.
// Die Stufe auf Ebene y liegt auf Feld (y − 1) des Rings, damit Abschnitte aus verschiedenen Kapiteln lückenlos anschließen.
const SPIRAL_RADIUS = 2;
const SPIRAL_PATH = (() => {
  const r = SPIRAL_RADIUS;
  const path = [];
  for (let x = 0; x < r; x++) path.push([x, -r]);
  for (let z = -r; z < r; z++) path.push([r, z]);
  for (let x = r; x > -r; x--) path.push([x, r]);
  for (let z = r; z > -r; z--) path.push([-r, z]);
  for (let x = -r; x < 0; x++) path.push([x, -r]);
  return path;
})();

function spiralCell(y) {
  return SPIRAL_PATH[(y - 1) % SPIRAL_PATH.length];
}

// Gitter rund um die Wendeltreppe (Ring mit Abstand 3), damit niemand in den hohlen Schaft fällt.
// Eingang unten auf der Nordseite (Ebene 1–2), oben öffnet ihn das Podest der Aussichtsetage.
const CAGE_RADIUS = SPIRAL_RADIUS + 1;
const CAGE_CELLS = (() => {
  const cells = [];
  for (let x = -CAGE_RADIUS; x <= CAGE_RADIUS; x++) {
    for (let z = -CAGE_RADIUS; z <= CAGE_RADIUS; z++) if (Math.max(Math.abs(x), Math.abs(z)) === CAGE_RADIUS) cells.push([x, z]);
  }
  return cells;
})();
const isCageEntrance = (x, y, z) => y <= 2 && z === -CAGE_RADIUS && x >= -2 && x <= 0;

function buildSpiral(b, y1, y2) {
  for (let y = y1; y <= y2; y++) {
    const [x, z] = spiralCell(y);
    const [nx, nz] = spiralCell(y + 1);
    const facing = nx > x ? 'east' : nx < x ? 'west' : nz > z ? 'south' : 'north';
    b.stairs(x, y, z, P.stairs, { facing });
    b.fill(-1, y, -1, 1, y, 1, P.core);
    for (const [cx, cz] of CAGE_CELLS) {
      if (!isCageEntrance(cx, y, cz) && b.get(cx, y, cz) === 'air') b.set(cx, y, cz, 'iron_bars');
    }
  }
}

function buildPlaza(b, g) {
  const r = g.radius(2 * 52);
  for (const [x, z] of circleCells(r)) {
    const d = dist(x, z) / g.s;
    const ring = Math.round(d) % 8 === 0 && d > 20;
    b.set(x, 0, z, ring ? P.pavingRing : P.paving);
  }
}

function buildFoot(b, g, hollow) {
  const yTop = g.level(H.footTop) - 1;
  const wall = [];
  for (let y = 1; y <= yTop; y++) {
    const r = g.radius(footDiameterM(g.meters(y)));
    if (!hollow) {
      for (const [x, z] of circleCells(r)) b.set(x, y, z, P.concrete);
      continue;
    }
    const cells = setRing(b, y, r, P.concrete);
    for (const [x, z] of cells) wall.push([x, y, z]);
    if (y === g.level(10) && g.s >= 0.5) for (const [x, z] of evenlySpaced(cells, 16)) b.set(x, y, z, 'glass');
  }
  if (hollow) {
    connectLooseBlocks(b, wall);
    // Fackeln an der Innenwand des Fußes, damit auf der Wendeltreppe bis zum Schaft keine Monster erscheinen
    for (let y = 4; y <= yTop; y += 3) {
      const pair = Math.floor((y - 4) / 3) % 2 === 0 ? [AXES[0], AXES[1]] : [AXES[2], AXES[3]];
      for (const axis of pair) wallTorch(b, y, axis);
    }
    // Eingang nach Süden, zwei Blöcke hoch
    const r0 = g.radius(footDiameterM(0.5));
    for (let y = 1; y <= 2; y++) {
      for (let z = 0; z <= Math.ceil(r0) + 1; z++) {
        for (const x of [0, 1]) if (!inside(x, z, r0 - 1.2) && inside(x, z, r0)) b.remove(x, y, z);
      }
    }
    // Licht in der Halle
    const rl = g.radius(footDiameterM(0.5)) - 3;
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * 2 * Math.PI; // halb versetzt: keine Lampe direkt hinter dem Eingang im Süden
      const x = Math.round(CX + rl * Math.cos(a));
      const z = Math.round(CZ + rl * Math.sin(a));
      b.set(x, 1, z, 'andesite_wall');
      b.set(x, 2, z, 'lantern');
    }
    // Laterne auf dem Boden unter der Wendeltreppe (Südseite des Kerns, abseits des Einstiegs im Norden)
    b.set(1, 1, 2, 'lantern');
  }
}

function buildShaftLevels(b, g, y1, y2, { hollow, stairs }) {
  for (let y = y1; y <= y2; y++) {
    const m = g.meters(y);
    const r = g.radius(shaftDiameterM(m));
    if (!hollow) {
      for (const [x, z] of circleCells(r)) b.set(x, y, z, P.concrete);
    } else {
      const cells = setRing(b, y, r, P.concrete);
      if (H.portholes.some((h) => g.level(h) === y)) for (const [x, z] of evenlySpaced(cells, 12)) b.set(x, y, z, 'glass');
    }
    if (g.s >= 1 && H.warningLights.some((h) => g.level(h) === y)) for (const axis of AXES) outerTorch(b, y, r, axis);
  }
  if (stairs) {
    for (let y = y1; y <= y2; y++) {
      if ((y - y1) % 3 === 1) {
        const pair = Math.floor((y - y1) / 3) % 2 === 0 ? [AXES[0], AXES[1]] : [AXES[2], AXES[3]];
        for (const axis of pair) wallTorch(b, y, axis);
      }
    }
  }
}

function buildSphere(b, g, hollow) {
  const r = g.radius(H.sphereDiameter);
  const cy = Math.floor(1 + H.sphereCenter * g.s) + 0.5;
  b.sphere(CX, cy, CZ, r, P.steel, { hollow });
  const onSurface = (x, y, z) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
    .some(([dx, dy, dz]) => b.get(x + dx, y + dy, z + dz) === 'air');
  const yLow = Math.ceil(cy - r - 0.5);
  const yHigh = Math.floor(cy + r + 0.5);
  const obs = g.floorAt(H.observation);
  const rest = g.floorAt(H.restaurant);
  const bandA = [obs + 1, Math.max(obs + 1, rest - 1)];
  const bandB = [rest + 1, rest + Math.max(1, Math.round(3 * g.s))];
  for (let y = yLow; y <= yHigh; y++) {
    const inBand = (y >= bandA[0] && y <= bandA[1]) || (y >= bandB[0] && y <= bandB[1]);
    for (const [x, z] of circleCells(r + 1)) {
      if (b.get(x, y, z) !== P.steel || !onSurface(x, y, z)) continue;
      if (inBand) {
        b.set(x, y, z, P.window);
        continue;
      }
      const turns = ((Math.atan2(z - CZ, x - CX) / (2 * Math.PI)) * 12 % 1 + 1) % 1;
      const arc = (Math.min(turns, 1 - turns) * (2 * Math.PI * dist(x, z))) / 12;
      if (arc <= 0.5 && dist(x, z) > r * 0.45 && g.s >= 0.5) b.set(x, y, z, P.seam);
    }
  }
  return { cy, r, yLow, yHigh, obs, rest };
}

// Bodenfläche in der Kugel zwischen Schaft und Kugelhaut (nur in Luft).
function sphereFloor(b, g, sphere, y, state) {
  const dy = y - sphere.cy;
  const rr = Math.sqrt(Math.max(0, (sphere.r + 0.5) ** 2 - dy * dy)) - 0.5;
  const shaftR = g.radius(shaftDiameterM(g.meters(y)));
  let count = 0;
  for (const [x, z] of circleCells(rr)) {
    if (inside(x, z, shaftR)) continue;
    if (b.get(x, y, z) !== 'air') continue;
    b.set(x, y, z, state);
    count++;
  }
  return count;
}

function ringPositions(rad, n, offset = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * 2 * Math.PI;
    out.push([Math.round(CX + rad * Math.cos(a)), Math.round(CZ + rad * Math.sin(a)), a]);
  }
  return out;
}

function horizontalRadiusAt(sphere, y) {
  const dy = y - sphere.cy;
  return Math.sqrt(Math.max(0, (sphere.r + 0.5) ** 2 - dy * dy)) - 0.5;
}

function facingToward(a) {
  // Richtung von außen zur Achse (Winkel a zeigt von der Achse weg)
  const dx = -Math.cos(a);
  const dz = -Math.sin(a);
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'east' : 'west';
  return dz > 0 ? 'south' : 'north';
}

function buildSphereInterior(b, g, sphere, levels) {
  const shaftR = (y) => g.radius(shaftDiameterM(g.meters(y)));
  const lanternRing = (yFloor, count) => {
    const rad = (shaftR(yFloor + 1) + horizontalRadiusAt(sphere, yFloor + 1)) / 2;
    for (const [x, z] of ringPositions(rad, count, Math.PI / count)) {
      if (b.get(x, yFloor, z) !== 'air' && b.get(x, yFloor + 1, z) === 'air') b.set(x, yFloor + 1, z, 'lantern');
    }
  };

  b.step();
  const obsRoomTop = sphere.rest - 1;
  for (const [x, z, a] of ringPositions(shaftR(sphere.obs + 1) + 1.6, 12)) {
    if (b.get(x, sphere.obs + 1, z) !== 'air') continue;
    b.slab(x, sphere.obs + 1, z, 'smooth_quartz_slab', { type: 'top' });
    const [hx, hz] = [Math.round(CX + (shaftR(sphere.obs + 1) + 2.8) * Math.cos(a)), Math.round(CZ + (shaftR(sphere.obs + 1) + 2.8) * Math.sin(a))];
    if (b.get(hx, sphere.obs + 1, hz) === 'air') b.stairs(hx, sphere.obs + 1, hz, 'spruce_stairs', { facing: facingToward(a + Math.PI) });
  }
  const obsLightR = (shaftR(sphere.obs + 1) + horizontalRadiusAt(sphere, sphere.obs + 1)) / 2 + 1;
  for (const [x, z] of ringPositions(obsLightR, 10)) {
    if (b.get(x, obsRoomTop, z) === 'air' && b.get(x, obsRoomTop + 1, z) !== 'air') b.set(x, obsRoomTop, z, 'lantern[hanging=true]');
  }

  b.step();
  const restR = horizontalRadiusAt(sphere, sphere.rest + 1) - 1.6;
  const tableCount = Math.max(6, Math.round(restR * 1.3));
  for (const [x, z, a] of ringPositions(restR, tableCount)) {
    if (b.get(x, sphere.rest + 1, z) !== 'air') continue;
    b.set(x, sphere.rest + 1, z, 'dark_oak_fence');
    b.set(x, sphere.rest + 2, z, 'white_carpet');
    const ta = a + Math.PI / 2;
    for (const side of [-1, 1]) {
      const sx = x + Math.round(Math.cos(ta) * side);
      const sz = z + Math.round(Math.sin(ta) * side);
      if (b.get(sx, sphere.rest + 1, sz) !== 'air') continue;
      const dx = x - sx;
      const dz = z - sz;
      const facing = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south');
      b.stairs(sx, sphere.rest + 1, sz, 'dark_oak_stairs', { facing });
    }
  }
  const restCeiling = levels.technical[0] - 1;
  for (const [x, z] of ringPositions((shaftR(sphere.rest + 1) + restR) / 2, 10)) {
    if (b.get(x, restCeiling + 1, z) === 'air') continue;
    const drop = Math.min(3, restCeiling - sphere.rest - 3);
    for (let i = 0; i < drop; i++) b.set(x, restCeiling - i, z, 'iron_chain');
    b.set(x, restCeiling - drop, z, 'lantern[hanging=true]');
  }

  b.step();
  for (const yFloor of [levels.climate, ...levels.technical]) {
    lanternRing(yFloor, 6);
    const cabinets = ringPositions(shaftR(yFloor + 1) + 1.5, 8, 0.3);
    cabinets.forEach(([x, z, a], i) => {
      if (b.get(x, yFloor, z) === 'air' || b.get(x, yFloor + 1, z) !== 'air' || b.get(x, yFloor + 2, z) !== 'air') return;
      if (i % 2 === 0) {
        b.set(x, yFloor + 1, z, 'barrel[facing=up]');
        b.set(x, yFloor + 2, z, 'barrel[facing=up]');
      } else {
        b.set(x, yFloor + 1, z, 'iron_block');
        b.set(x, yFloor + 2, z, `blast_furnace[facing=${facingToward(a + Math.PI)}]`);
      }
    });
  }
}

// Richtung, in die das Podest am Ende der Wendeltreppe aus dem Schaft führt.
function stairExitAxis(yEnd) {
  const [lx, lz] = spiralCell(yEnd + 1);
  return Math.abs(lx - CX) >= Math.abs(lz - CZ) ? { dx: Math.sign(lx - CX), dz: 0 } : { dx: 0, dz: Math.sign(lz - CZ) };
}

function buildStairAccess(b, g, sphere) {
  // Die letzte Stufe liegt auf der Bodenebene der Aussichtsetage; das Podest schließt bündig an und führt durch die Schaftwand.
  const yEnd = sphere.obs;
  const [lx, lz] = spiralCell(yEnd + 1);
  const axis = stairExitAxis(yEnd);
  const r = g.radius(shaftDiameterM(g.meters(yEnd + 1)));
  let x = lx;
  let z = lz;
  for (let i = 0; i < 20 && inside(x, z, r); i++) {
    b.set(x, yEnd, z, P.floor);
    b.remove(x, yEnd + 1, z);
    b.remove(x, yEnd + 2, z);
    x += axis.dx;
    z += axis.dz;
  }
  const torchAxis = AXES.find((a) => a.dx === axis.dz && a.dz === -axis.dx) ?? AXES[0];
  wallTorch(b, yEnd + 2, torchAxis);
  // Treppe von der Aussichtsetage zum Telecafé (Ostseite, läuft nach Süden hinauf)
  const sx = Math.round(CX + g.radius(shaftDiameterM(g.meters(yEnd + 1))) + 2);
  const rise = sphere.rest - sphere.obs;
  for (let i = 0; i < rise; i++) {
    const y = sphere.obs + 1 + i;
    b.stairs(sx, y, -1 + i, 'stone_brick_stairs', { facing: 'south' });
    // Unterbau aus Steinziegeln unter jeder Stufe
    for (let yy = sphere.obs + 1; yy < y; yy++) if (b.get(sx, yy, -1 + i) === 'air') b.set(sx, yy, -1 + i, 'stone_bricks');
  }
  for (let i = 0; i < rise - 1; i++) b.remove(sx, sphere.rest, -1 + i);
}

function buildAntenna(b, g, yStart) {
  const yTop = g.level(H.antennaTop) - 1;
  const yThin = g.level(H.antennaThin);
  const yStripes = g.level(H.stripes);
  const band = Math.max(1, Math.round(6 * g.s));
  const thick = g.radius(D.antenna);
  const thin = Math.max(0, g.radius(D.antennaThin));
  for (let y = yStart; y <= yTop; y++) {
    const r = y < yThin ? thick : thin;
    let state = 'iron_block';
    if (y >= yStripes) state = Math.floor((yTop - y) / band) % 2 === 0 ? 'white_concrete' : 'red_concrete';
    if (r <= 0) b.set(0, y, 0, state);
    else for (const [x, z] of circleCells(r)) b.set(x, y, z, state);
  }
  return yTop;
}

function buildDishPlatforms(b, g) {
  for (const h of H.dishPlatforms) {
    const y = g.floorAt(h);
    const r = g.radius(shaftDiameterM(h));
    const outer = r + Math.max(1, Math.round(2 * g.s));
    for (const [x, z] of circleCells(outer)) {
      if (inside(x, z, r)) continue;
      b.slab(x, y, z, 'smooth_stone_slab', { type: 'top' });
    }
    if (g.s >= 0.5) for (const [x, z] of ringCells(outer)) b.set(x, y + 1, z, 'iron_bars');
    if (g.s >= 1) {
      // Richtfunkantennen als kleine Pfosten mit weißem Spiegel
      for (const [x, z] of ringPositions(outer - 0.5, 6, 0.4)) {
        b.set(x, y + 1, z, 'iron_block');
        b.set(x, y + 2, z, 'white_concrete');
      }
      // Laternen zwischen den Antennen, damit auf den überdachten Bühnen keine Monster erscheinen
      for (const [x, z] of ringPositions(r + 1.5, 6, 0.4 + Math.PI / 6)) {
        if (b.get(x, y, z) !== 'air' && b.get(x, y + 1, z) === 'air') b.set(x, y + 1, z, 'lantern');
      }
    }
  }
}

// --- Umbauung mit Faltdach (Form geschätzt) ---

const RIDGES = [30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180);

function inHexagon(x, z, apothem) {
  return RIDGES.every((a) => (x - CX) * Math.cos(a) + (z - CZ) * Math.sin(a) <= apothem);
}

function roofHeightM(x, z, s) {
  const r = dist(x, z) / s;
  let deg = (Math.atan2(z - CZ, x - CX) * 180) / Math.PI;
  deg = ((deg - 30) % 60 + 60) % 60; // 0 = First, 30 = Kehle
  const w = 1 - Math.abs(1 - deg / 30);
  const ridge = ROOF.peak - ROOF.slope * (r - ROOF.inner);
  const valley = ROOF.peak - ROOF.valleySlope * (r - ROOF.inner);
  return ridge - w * (ridge - valley);
}

function buildPavilionComplex(b, g) {
  const s = g.s;
  const apothemRoof = ROOF.corner * Math.cos(Math.PI / 6) * s;
  const apothemWall = ROOF.wall * Math.cos(Math.PI / 6) * s;
  const footR = g.radius(footDiameterM(0.5));
  const span = Math.ceil(ROOF.corner * s) + 2;
  const roofY = new Map();
  const roofSlab = new Set();
  for (let x = -span; x <= span + 1; x++) {
    for (let z = -span; z <= span + 1; z++) {
      if (!inHexagon(x, z, apothemRoof)) continue;
      const h = roofHeightM(x, z, s);
      const half = Math.round(Math.max(0.3, h) * s * 2) / 2; // Dachoberkante in halben Blöcken über dem Platz
      const y = Math.max(1, Math.floor(half));
      const footHere = g.radius(footDiameterM(Math.min(H.footTop, h)));
      if (inside(x, z, footHere + 0.5)) continue;
      roofY.set(`${x},${z}`, y);
      if (half % 1 !== 0) roofSlab.add(`${x},${z}`);
    }
  }
  const wallTop = (x, z) => (roofY.get(`${x},${z}`) ?? 2) - 1;
  const gallery = g.floorAt(ROOF.gallery);

  b.step();
  // Rand mit 8er-Nachbarschaft: an den schrägen Seiten stoßen die Scheiben über Flächen aneinander und verbinden sich
  const NEIGHBORS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const isWall = (x, z) => inHexagon(x, z, apothemWall) && NEIGHBORS8.some(([dx, dz]) => !inHexagon(x + dx, z + dz, apothemWall));
  const span2 = Math.ceil(ROOF.wall * s) + 1;
  const wallCells = [];
  for (let x = -span2; x <= span2 + 1; x++) {
    for (let z = -span2; z <= span2 + 1; z++) if (isWall(x, z)) wallCells.push([x, z]);
  }
  const corners = RIDGES.map((a) => a - Math.PI / 6).map((a) => [CX + ROOF.wall * s * Math.cos(a), CZ + ROOF.wall * s * Math.sin(a)]);
  for (const [x, z] of wallCells) {
    const nearCorner = corners.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 1.6);
    const top = wallTop(x, z);
    for (let y = 1; y <= top; y++) b.set(x, y, z, nearCorner || y === gallery ? P.mullion : P.pane);
  }
  const doorHalf = Math.max(1, Math.round(2 * s));
  for (const [x, z] of wallCells) {
    if (z > CZ && Math.abs(x - CX) <= doorHalf + 0.5) for (let y = 1; y <= 3; y++) b.remove(x, y, z);
  }

  if (s >= 0.5) {
    b.step();
    const galleryInner = Math.max(footR + 3, apothemWall - Math.round(7 * s));
    for (let x = -span2; x <= span2 + 1; x++) {
      for (let z = -span2; z <= span2 + 1; z++) {
        if (!inHexagon(x, z, apothemWall) || isWall(x, z)) continue;
        if (inHexagon(x, z, galleryInner)) continue;
        if (b.get(x, gallery, z) === 'air') b.set(x, gallery, z, P.floorTop);
      }
    }
    for (let x = -span2; x <= span2 + 1; x++) {
      for (let z = -span2; z <= span2 + 1; z++) {
        if (!inHexagon(x, z, galleryInner + 1) || inHexagon(x, z, galleryInner)) continue;
        if (b.get(x, gallery, z) === P.floorTop && b.get(x, gallery + 1, z) === 'air') b.set(x, gallery + 1, z, 'iron_bars');
      }
    }
    // Treppe zur Galerie an der Westseite
    const tx = -Math.round(apothemWall) + 3;
    for (let i = 0; i < gallery; i++) {
      b.stairs(tx + i, 1 + i, 0, 'smooth_quartz_stairs', { facing: 'east' });
      for (let y = 1; y < 1 + i; y++) b.set(tx + i, y, 0, P.roof);
    }
    for (let i = 0; i < gallery - 1; i++) b.remove(tx + i, gallery, 0);
  }

  b.step();
  for (const [key, y] of roofY) {
    const [x, z] = key.split(',').map(Number);
    let low = y;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = roofY.get(`${x + dx},${z + dz}`);
      if (n !== undefined) low = Math.min(low, n + 1);
    }
    for (let yy = Math.min(low, y); yy <= y; yy++) if (b.get(x, yy, z) === 'air' || yy === y) b.set(x, yy, z, P.roof);
    if (roofSlab.has(key) && b.get(x, y + 1, z) === 'air') b.slab(x, y + 1, z, P.roofSlab);
  }
  // Einzelne Dachblöcke, die nur über Kanten am Dach hängen (Spitzen der Flügel), fallen weg
  for (const [key, y] of roofY) {
    const [x, z] = key.split(',').map(Number);
    for (let yy = y + 1; yy >= 1; yy--) {
      const state = b.get(x, yy, z);
      if ((state === P.roof || state.startsWith(P.roofSlab)) && solidNeighbors(b, x, yy, z) === 0) b.remove(x, yy, z);
    }
  }

  // Lampen in zwei Ringen in der Halle (Mauer mit Laterne) und ein Ring auf der Galerie
  const lamps = [];
  const hallInner = footR + 2;
  const hallOuter = apothemWall - 1.5;
  for (const t of s >= 0.5 ? [0.3, 0.75] : [0.5]) {
    const rad = hallInner + t * (hallOuter - hallInner);
    for (const [x, z] of ringPositions(rad, Math.max(6, Math.round(rad / 2.2)), t)) {
      if (!inHexagon(x, z, apothemWall - 1) || inside(x, z, footR + 1)) continue;
      if (b.get(x, 1, z) !== 'air' || b.get(x, 2, z) !== 'air') continue;
      if (lamps.some(([lx, lz]) => Math.abs(lx - x) + Math.abs(lz - z) < 3)) continue;
      lamps.push([x, z]);
    }
  }
  const galleryLights = [];
  if (s >= 0.5) {
    const rad = (Math.max(footR + 3, apothemWall - Math.round(7 * s)) + apothemWall) / 2;
    const spots = [...ringPositions(rad, Math.max(8, Math.round(rad / 1.6))), ...ringPositions(ROOF.wall * s - 3, 6)];
    for (const [x, z] of spots) {
      if (b.get(x, gallery, z) === P.floorTop && b.get(x, gallery + 1, z) === 'air') galleryLights.push([x, z]);
    }
  }
  // Laternen auf den Absätzen des Turmfußes beleuchten die hohe Halle von innen
  const ledgeLights = [];
  for (let y = gallery + 3; y <= g.level(H.footTop) - 2; y += Math.max(2, Math.round(4 * s))) {
    const rad = g.radius(footDiameterM(g.meters(y - 1)));
    for (const [, , a] of ringPositions(rad, 8, Math.PI / 8)) {
      for (let d = rad + 1; d >= rad - 2; d -= 0.5) {
        const x = Math.round(CX + d * Math.cos(a));
        const z = Math.round(CZ + d * Math.sin(a));
        if (b.get(x, y - 1, z) === P.concrete && b.get(x, y, z) === 'air') {
          ledgeLights.push([x, y, z]);
          break;
        }
      }
    }
  }
  if (lamps.length === 0 && ledgeLights.length === 0) return;
  b.step();
  for (const [x, z] of lamps) {
    b.set(x, 1, z, 'andesite_wall');
    b.set(x, 2, z, 'lantern');
  }
  for (const [x, z] of galleryLights) b.set(x, gallery + 1, z, 'lantern');
  for (const [x, y, z] of ledgeLights) b.set(x, y, z, 'lantern');
  if (s >= 0.5) {
    for (const side of [-1, 1]) {
      const x0 = side * Math.round(footR + 4);
      for (let dz = -2; dz <= 2; dz++) if (b.get(x0, 1, dz) === 'air') b.slab(x0, 1, dz, 'smooth_quartz_slab', { type: 'top' });
    }
  }
}

function buildWaterAndLamps(b, g) {
  const s = g.s;
  // vor der Dachkante (Südseite des Sechsecks), auch wenn die Rundung bei kleinen Maßstäben knapp wird
  const roofEdge = Math.floor(CZ + ROOF.corner * Math.cos(Math.PI / 6) * s);
  const z0 = Math.max(Math.round((ROOF.corner * Math.cos(Math.PI / 6) + 3) * s), roofEdge + 2);
  const w = Math.max(2, Math.round(6 * s));
  const d = Math.max(2, Math.round(4 * s));
  const gap = Math.max(1, Math.round(2 * s));
  // rechts der Achse zwei Becken, links gespiegelt (Spiegelachse x = 0.5)
  const right = [gap + 2, gap + 2 + w + 2 + 2 * gap];
  const starts = [...right, ...right.map((x1) => 1 - (x1 + w - 1))];
  for (const x1 of starts) {
    for (let x = x1 - 1; x <= x1 + w; x++) {
      for (let z = z0 - 1; z <= z0 + d; z++) {
        const rim = x === x1 - 1 || x === x1 + w || z === z0 - 1 || z === z0 + d;
        // Bei kleinen Maßstäben reicht ein Becken bis an den Platzrand: Boden ergänzen, sonst läuft das Wasser aus
        if (b.get(x, 0, z) === 'air') b.set(x, 0, z, P.paving);
        b.set(x, 1, z, rim ? 'smooth_quartz' : 'water');
      }
    }
  }
  const plazaR = g.radius(2 * 52) - 2;
  for (const [x, z] of ringPositions(plazaR, 12, Math.PI / 12)) {
    if (b.get(x, 1, z) !== 'air') continue;
    const tall = Math.max(2, Math.round(4 * s));
    for (let y = 1; y < 1 + tall; y++) b.set(x, y, z, 'andesite_wall');
    b.set(x, 1 + tall, z, 'lantern');
  }
}

export default function build(b, { scale = 1 } = {}) {
  if (!meta.scales.includes(scale)) throw new Error(`Maßstab ${scale} gibt es für den Berliner Fernsehturm nicht (erlaubt: ${meta.scales.join(', ')}).`);
  const g = geometry(scale);
  const hollow = scale >= 1;
  const footTop = g.level(H.footTop) - 1;
  const sphereR = g.radius(H.sphereDiameter);
  const sphereCy = Math.floor(1 + H.sphereCenter * g.s) + 0.5;
  const sphereLow = Math.ceil(sphereCy - sphereR - 0.5);
  const sphereHigh = Math.floor(sphereCy + sphereR + 0.5);
  const shaftTop = g.level(H.shaftTop) - 1;
  const obs = g.floorAt(H.observation);

  b.phase('Platz und Fundament');
  buildPlaza(b, g);

  b.phase('Turmfuß');
  buildFoot(b, g, hollow);
  if (hollow) buildSpiral(b, 1, footTop);

  b.phase('Schaft bis zur Kugel');
  buildShaftLevels(b, g, footTop + 1, sphereLow - 1, { hollow, stairs: hollow });
  if (hollow) buildSpiral(b, footTop + 1, sphereLow - 1);

  b.phase('Die Kugel');
  const sphere = buildSphere(b, g, hollow);
  const levels = { climate: g.floorAt(H.climate), technical: H.technical.map((h) => g.floorAt(h)) };
  if (hollow) {
    // Schaft durch die Kugel: Kugelhaut im Schaft öffnen, Schaftwand setzen
    const sphereStates = new Set([P.steel, P.seam, P.window]);
    for (let y = sphereLow; y <= sphereHigh; y++) {
      const r = g.radius(shaftDiameterM(g.meters(y)));
      for (const [x, z] of circleCells(r)) if (sphereStates.has(b.get(x, y, z))) b.remove(x, y, z);
      setRing(b, y, r, P.concrete);
      b.fill(-1, y, -1, 1, y, 1, P.core);
    }
    // Erst jetzt die Wendeltreppe in der Kugel weiterführen – die Kugelhaut hätte sie unten sonst überschrieben.
    buildSpiral(b, sphereLow, obs);
    const shell = [];
    for (let y = sphereLow; y <= sphereHigh; y++) {
      const shaftR = g.radius(shaftDiameterM(g.meters(y)));
      for (const [x, z] of circleCells(sphereR + 1)) if (!inside(x, z, shaftR + 1)) shell.push([x, y, z]);
    }
    connectLooseBlocks(b, shell);
    for (const yFloor of [levels.climate, sphere.obs, sphere.rest, ...levels.technical]) sphereFloor(b, g, sphere, yFloor, P.floor);
  } else {
    for (let y = sphereLow; y <= sphereHigh; y++) {
      const r = g.radius(shaftDiameterM(g.meters(y)));
      for (const [x, z] of circleCells(r)) if (b.get(x, y, z) === 'air') b.set(x, y, z, P.concrete);
    }
  }

  if (hollow) {
    b.phase('Einrichtung der Kugel');
    b.step();
    buildStairAccess(b, g, sphere);
    buildSphereInterior(b, g, sphere, levels);
  }

  b.phase('Schaft über der Kugel und Antennenträger');
  if (hollow) {
    buildShaftLevels(b, g, sphereHigh + 1, shaftTop - 1, { hollow: true, stairs: false });
    for (let y = sphereHigh + 1; y < shaftTop; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) b.set(dx, y, dz, P.core);
    for (const [x, z] of circleCells(g.radius(shaftDiameterM(H.shaftTop)))) b.set(x, shaftTop, z, P.concrete);
  } else {
    buildShaftLevels(b, g, sphereHigh + 1, shaftTop, { hollow: false, stairs: false });
  }
  buildDishPlatforms(b, g);
  buildAntenna(b, g, shaftTop + 1);

  b.phase('Umbauung mit Faltdach');
  buildPavilionComplex(b, g);

  b.phase('Wasserbecken und Laternen');
  buildWaterAndLamps(b, g);
}
