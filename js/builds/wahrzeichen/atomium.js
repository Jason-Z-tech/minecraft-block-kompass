// Atomium, Brüssel – 1:1 nach echten Maßen (Recherche: docs/recherche/atomium.md).
// Koordinaten: Turmachse (Raumdiagonale des Würfels) senkrecht bei x = z = 0,5, Platz auf y = 0, 1 Block = 1 m bei scale 1.
// Der Würfel steht auf einer Ecke: unten Kugel B, in der Mitte C, oben T, dazwischen je drei Kugeln auf zwei Höhen.

import { tree } from '../lib/natur.js';

export const meta = {
  id: 'atomium',
  title: 'Atomium',
  category: 'wahrzeichen',
  subtitle: 'Neun Stahlkugeln als Eisenkristall in Brüssel, 102 m hoch',
  tags: ['Belgien', 'Brüssel', 'Expo 58', 'Weltausstellung', 'Kugel', 'Stahl', 'Moderne', 'Riesig', 'Maßstab 1:1', 'Aussicht', 'Restaurant'],
  aliases: [
    'atomium', 'atomium brüssel', 'atomium brussel', 'atomium bruxelles', 'atomium brussels', 'atomium belgien',
    'atom', 'atomiom', 'atomuim', 'atonium', 'atomium expo 58', 'eisenkristall', 'brüssel kugeln', 'kugeln brüssel',
  ],
  accuracy: 'massstab',
  difficulty: 5,
  description: 'Das Atomium im Maßstab 1:1: neun Kugeln mit 18 Blöcken Durchmesser bilden einen auf der Spitze stehenden Würfel mit 47 Blöcken Kantenlänge – die Elementarzelle eines Eisenkristalls –, verbunden durch 20 Röhren und gestützt von drei Doppelstützen. Mit dem Eingangspavillon ist es 103 Blöcke hoch. Die Achsenkugeln sind über eine Leiter im senkrechten Mittelrohr begehbar, oben mit Panorama-Restaurant; die übrigen Kugeln haben Böden und Licht, aber keinen Zugang. Form und Lage der Stützen, die Höhe der untersten Kugel und die Fensterverteilung sind geschätzt.',
  facts: [
    'Höhe 102 m (vom Boden bis zur Oberkante der obersten Kugel 102,705 m), gebaut für die Weltausstellung Expo 58 und am 17. April 1958 eröffnet.',
    'Neun Kugeln mit je 18 m Durchmesser, Abstand zwischen den Kugeln 29 m – von Mitte zu Mitte also 47 m Würfelkante.',
    '20 Röhren mit 3,3 m Durchmesser: 12 entlang der Würfelkanten, 8 von den Ecken zur Mittelkugel.',
    'Es zeigt die Elementarzelle eines Eisenkristalls, rund 165 Milliarden Mal vergrößert.',
    'Seit der Sanierung 2004–2006 sind die Kugeln mit Edelstahl statt Aluminium verkleidet; Gewicht rund 2 500 t.',
    'Im Original fährt ein Aufzug (5 m/s) durch das Mittelrohr nach oben, in den schrägen Röhren laufen Rolltreppen. Hier ersetzt eine Leiter den Aufzug, die schrägen Röhren sind massiv.',
    'Geschätzt (nicht belegt): Form, Breite und Fußpunkte der drei Stützen, Höhe des Pavillons, Lage und Zahl der Fenster.',
  ],
  sources: [
    { title: 'Atomium: The Atomium in figures', url: 'https://atomium.be/the_atomium_in_figures' },
    { title: 'Wikipedia (en): Atomium', url: 'https://en.wikipedia.org/wiki/Atomium' },
    { title: 'Wikipedia (de): Atomium', url: 'https://de.wikipedia.org/wiki/Atomium' },
    { title: 'ICOMOS Hefte des Deutschen Nationalkomitees: Beitrag zum Atomium (Universität Heidelberg)', url: 'https://journals.ub.uni-heidelberg.de/index.php/icomoshefte/article/view/75097/68770' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

const SPHERE_M = 18;
const EDGE_M = 47; // 29 m Abstand zwischen den Kugeln + 18 m Durchmesser
const TUBE_M = 3.3;
const PAVILION_M = 26;

const SHELL = 'iron_block';
const TUBE = 'iron_block';
const SUPPORT = 'light_gray_concrete';
const WINDOW = 'gray_stained_glass';
const PANORAMA = 'light_gray_stained_glass';
const FLOOR = 'smooth_stone';
const CORE = 'smooth_stone';
const LIGHT_TILE = 'glowstone';
const PAVING = 'smooth_stone';
const PAVILION_WALL = 'glass_pane';
const PAVILION_POST = 'white_concrete';
const PAVILION_ROOF = 'white_concrete';

function config(scale) {
  if (scale === 1) return { scale, interior: true, plaza: 50, pavilionH: 3, legW: 3, tubeR: TUBE_M / 2 };
  if (scale === 0.5) return { scale, interior: false, plaza: 26, pavilionH: 1, legW: 2, tubeR: 0.9 };
  throw new Error(`Maßstab ${scale} wird nicht unterstützt (erlaubt: 1 und 0,5).`);
}

const key3 = (x, y, z) => `${x},${y},${z}`;
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Mitte so wählen, dass die Kugel genau D Blöcke breit wird: gerade D → halbe Mitte, ungerade → ganze.
function snapper(diameter) {
  return diameter % 2 === 0 ? (v) => Math.floor(v) + 0.5 : (v) => Math.round(v);
}

function cardinal(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) return dx >= 0 ? 'east' : 'west';
  return dz >= 0 ? 'south' : 'north';
}

// --- Geometrie ---

function buildGeometry(P) {
  const s = P.scale;
  const D = Math.round(SPHERE_M * s);
  const R = D / 2; // Schwelle für den Abstand der Blockmitte
  const snap = snapper(D);
  const edge = EDGE_M * s;
  const axis = snap(0);
  const pavilionD = Math.round(PAVILION_M * s);
  const roofY = P.pavilionH + 1;
  const bottomY = roofY + 1; // unterste Blockreihe der Kugel B liegt auf dem Pavillondach
  const cyB = bottomY + R - 0.5;
  const rh = edge * Math.sqrt(2 / 3);
  const level = (k) => snap(cyB + (k * edge) / Math.sqrt(3));
  const at = (deg, k) => {
    const a = (deg * Math.PI) / 180;
    return [snap(axis + rh * Math.cos(a)), level(k), snap(axis + rh * Math.sin(a))];
  };
  const spheres = {
    B: { name: 'B', c: [axis, cyB, axis], label: 'untere Kugel' },
    L1: { name: 'L1', c: at(90, 1), label: 'Kugel Süd (unten)', deg: 90 },
    L2: { name: 'L2', c: at(210, 1), label: 'Kugel Nordwest (unten)', deg: 210 },
    L3: { name: 'L3', c: at(330, 1), label: 'Kugel Nordost (unten)', deg: 330 },
    C: { name: 'C', c: [axis, level(1.5), axis], label: 'Mittelkugel' },
    U1: { name: 'U1', c: at(30, 2), label: 'Kugel Südost (oben)', deg: 30 },
    U2: { name: 'U2', c: at(150, 2), label: 'Kugel Südwest (oben)', deg: 150 },
    U3: { name: 'U3', c: at(270, 2), label: 'Kugel Nord (oben)', deg: 270 },
    T: { name: 'T', c: [axis, level(3), axis], label: 'oberste Kugel' },
  };
  const tubes = {
    lowerEdges: [['B', 'L1'], ['B', 'L2'], ['B', 'L3']],
    lowerCenter: [['L1', 'C'], ['L2', 'C'], ['L3', 'C']],
    middleEdges: [['L1', 'U1'], ['L1', 'U2'], ['L2', 'U2'], ['L2', 'U3'], ['L3', 'U3'], ['L3', 'U1']],
    upperCenter: [['C', 'U1'], ['C', 'U2'], ['C', 'U3']],
    upperEdges: [['U1', 'T'], ['U2', 'T'], ['U3', 'T']],
  };
  return { D, R, snap, edge, axis, pavilionD, roofY, bottomY, rh, spheres, tubes, list: Object.values(spheres) };
}

function insideAnySphere(g, p) {
  return g.list.some((sp) => dist3(p, sp.c) <= g.R + 1e-9);
}

// Hülle = Blöcke der Kugel mit einem Nachbarn außerhalb über Fläche ODER Kante. So hängen die Ringe an den Polen
// Fläche an Fläche zusammen (jede Ebene lässt sich gegen die darunter setzen), nicht nur über Kanten.
const SHELL_NEIGHBORS = [];
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (n === 1 || n === 2) SHELL_NEIGHBORS.push([dx, dy, dz]);
    }
  }
}

function sphereCells(g, sp) {
  const { R } = g;
  const [cx, cy, cz] = sp.c;
  const inside = (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) <= R + 1e-9;
  const cells = [];
  for (let x = Math.ceil(cx - R); x <= Math.floor(cx + R); x++) {
    for (let y = Math.ceil(cy - R); y <= Math.floor(cy + R); y++) {
      for (let z = Math.ceil(cz - R); z <= Math.floor(cz + R); z++) {
        if (!inside(x, y, z)) continue;
        const shell = SHELL_NEIGHBORS.some(([dx, dy, dz]) => !inside(x + dx, y + dy, z + dz));
        cells.push({ x, y, z, shell });
      }
    }
  }
  return cells;
}

// Röhre zwischen zwei Kugelmitten: alle Blöcke mit Abstand ≤ r zur Achse, außerhalb jeder Kugel.
function tubeCells(g, a, b, r) {
  const cells = [];
  const min = [0, 1, 2].map((i) => Math.floor(Math.min(a[i], b[i]) - r - 1));
  const max = [0, 1, 2].map((i) => Math.ceil(Math.max(a[i], b[i]) + r + 1));
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  for (let x = min[0]; x <= max[0]; x++) {
    for (let y = min[1]; y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        const t = ((x - a[0]) * d[0] + (y - a[1]) * d[1] + (z - a[2]) * d[2]) / len2;
        if (t <= 0 || t >= 1) continue;
        const p = [a[0] + t * d[0], a[1] + t * d[1], a[2] + t * d[2]];
        if (dist3([x, y, z], p) > r + 1e-9) continue;
        if (insideAnySphere(g, [x, y, z])) continue;
        cells.push([x, y, z]);
      }
    }
  }
  return cells;
}

// Querschnitt des senkrechten Mittelrohrs (12 Blöcke um die Achse) und sein Hohlraum (2 × 2).
function axisSection(g, r) {
  const ring = [];
  const hollow = [];
  for (let x = Math.floor(g.axis - r - 1); x <= Math.ceil(g.axis + r + 1); x++) {
    for (let z = Math.floor(g.axis - r - 1); z <= Math.ceil(g.axis + r + 1); z++) {
      const d = Math.hypot(x - g.axis, z - g.axis);
      if (d > r + 1e-9) continue;
      if (d < 1) hollow.push([x, z]);
      else ring.push([x, z]);
    }
  }
  return { ring, hollow };
}

// --- Kugeln ---

function floorLevels(sp) {
  const f1 = Math.round(sp.c[1]) - 4;
  return { f1, f2: f1 + 5 };
}

function isWindow(g, sp, x, y, z, P) {
  const { f1, f2 } = floorLevels(sp);
  const angle = Math.atan2(z - sp.c[2], x - sp.c[0]);
  const slot = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 24);
  if (!P.interior) return sp.name === 'T' && y === Math.round(sp.c[1]) ? PANORAMA : null;
  if (sp.name === 'T' && (y === f1 + 1 || y === f1 + 2)) return PANORAMA;
  if (y === f1 + 2 || y === f2 + 2) return slot % 3 === 0 ? WINDOW : null;
  return null;
}

function buildSphere(b, g, sp, P, axisSec) {
  const cells = sphereCells(g, sp);
  const onAxis = sp.c[0] === g.axis && sp.c[2] === g.axis;
  const { f1, f2 } = floorLevels(sp);
  const tiles = new Set();
  for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) tiles.add(`${Math.floor(sp.c[0] + dx)},${Math.floor(sp.c[2] + dz)}`);
  for (const c of cells) {
    if (c.shell) {
      b.set(c.x, c.y, c.z, isWindow(g, sp, c.x, c.y, c.z, P) ?? SHELL);
      continue;
    }
    if (!P.interior) { b.set(c.x, c.y, c.z, SHELL); continue; }
    if (c.y === f1 || c.y === f2) b.set(c.x, c.y, c.z, tiles.has(`${c.x},${c.z}`) ? LIGHT_TILE : FLOOR);
  }
  if (!P.interior || !onAxis) return;
  // Kern mit Leiterschacht durch die Achsenkugeln; Türöffnung nach Süden auf jedem Boden.
  const yMin = Math.ceil(sp.c[1] - g.R);
  const yMax = sp.name === 'T' ? f2 + 3 : Math.floor(sp.c[1] + g.R);
  for (let y = yMin; y <= yMax; y++) {
    for (const [x, z] of axisSec.ring) b.set(x, y, z, CORE);
    for (const [x, z] of axisSec.hollow) {
      const floorHere = (y === f1 || y === f2) && !(x === Math.floor(g.axis) && z === Math.floor(g.axis));
      if (sp.name === 'T' && y === yMax) b.set(x, y, z, CORE);
      else if (floorHere) b.set(x, y, z, FLOOR);
      else b.remove(x, y, z);
    }
  }
  for (const f of [f1, f2]) {
    for (const [x, z] of axisSec.ring) {
      if (z === Math.ceil(g.axis + 1)) { b.remove(x, f + 1, z); b.remove(x, f + 2, z); }
    }
  }
}

// --- Stützen ---

// Schräges Bein: auf jeder Ebene ein Quadrat mit w × w Blöcken, dessen Mitte der Linie Fuß → Kopf folgt.
// So bleibt der Querschnitt überall gleich, und das Bein rückt in sauberen Ein-Block-Stufen zur Kugel.
function legCells(g, from, to, w) {
  const cells = [];
  const y1 = Math.max(1, Math.round(from[1]));
  const y2 = Math.round(to[1]);
  for (let y = y1; y <= y2; y++) {
    const t = y2 === y1 ? 0 : (y - y1) / (y2 - y1);
    const cx = from[0] + t * (to[0] - from[0]);
    const cz = from[2] + t * (to[2] - from[2]);
    const x0 = Math.round(cx - (w - 1) / 2);
    const z0 = Math.round(cz - (w - 1) / 2);
    for (let x = x0; x < x0 + w; x++) {
      for (let z = z0; z < z0 + w; z++) {
        if (insideAnySphere(g, [x, y, z])) continue;
        cells.push([x, y, z]);
      }
    }
  }
  return cells;
}

// Stützen (geschätzt): Beine oben 2,5 m neben der Kugelachse, unten 7 m zur Seite und 3 m nach außen.
const LEG_TOP_M = 2.5;
const LEG_SPREAD_M = 7;
const LEG_OUT_M = 3;

// Waagrechter Abstand eines Stützenfußes von der Achse.
function footDistance(g, scale) {
  return Math.round(Math.hypot(g.rh + LEG_OUT_M * scale, LEG_SPREAD_M * scale));
}

function supportLegs(g, sp, P) {
  const s = P.scale;
  const a = (sp.deg * Math.PI) / 180;
  const radial = [Math.cos(a), Math.sin(a)];
  const tangent = [-Math.sin(a), Math.cos(a)];
  const topY = sp.c[1] - g.R + 1;
  const legs = [];
  for (const side of [-1, 1]) {
    const spread = side * LEG_SPREAD_M * s;
    const out = LEG_OUT_M * s;
    const top = [sp.c[0] + side * LEG_TOP_M * s * tangent[0], topY, sp.c[2] + side * LEG_TOP_M * s * tangent[1]];
    const foot = [sp.c[0] + spread * tangent[0] + out * radial[0], 1, sp.c[2] + spread * tangent[1] + out * radial[1]];
    legs.push({ top, foot });
  }
  return legs;
}

// --- Pavillon ---

function pavilionCells(g) {
  const r = g.pavilionD / 2;
  const cells = [];
  for (let x = Math.floor(g.axis - r); x <= Math.ceil(g.axis + r); x++) {
    for (let z = Math.floor(g.axis - r); z <= Math.ceil(g.axis + r); z++) {
      const d = Math.hypot(x - g.axis, z - g.axis);
      if (d > r + 1e-9) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => Math.hypot(x + dx - g.axis, z + dz - g.axis) > r + 1e-9);
      cells.push({ x, z, d, edge, angle: Math.atan2(z - g.axis, x - g.axis) });
    }
  }
  // Außenring lückenlos Fläche an Fläche schließen, damit sich die Glasscheiben verbinden.
  const ring = cells.filter((c) => c.edge).sort((a, b) => a.angle - b.angle || a.x - b.x || a.z - b.z);
  const byKey = new Map(cells.map((c) => [`${c.x},${c.z}`, c]));
  ring.forEach((c, i) => {
    const n = ring[(i + 1) % ring.length];
    if (Math.abs(c.x - n.x) === 1 && Math.abs(c.z - n.z) === 1) {
      const options = [byKey.get(`${c.x},${n.z}`), byKey.get(`${n.x},${c.z}`)].filter(Boolean);
      options.sort((a, b) => b.d - a.d);
      if (options[0]) options[0].edge = true;
    }
  });
  return cells;
}

// --- Pavillon-Einrichtung ---

function furnishPavilion(b, g) {
  const a = Math.floor(g.axis); // Achse liegt zwischen a und a + 1
  // Empfangstresen im Norden, Hocker dahinter (Lehne nach Norden, man sitzt zum Tresen)
  for (let x = a - 2; x <= a + 3; x++) {
    b.set(x, 1, a - 6, PAVILION_POST);
    b.slab(x, 2, a - 6, 'smooth_quartz_slab', { type: 'bottom' });
  }
  for (const x of [a - 1, a + 2]) b.stairs(x, 1, a - 7, 'smooth_quartz_stairs', { facing: 'north' });
  b.set(a + 3, 3, a - 6, 'lantern[hanging=true]');
  // Bänke an der Ost- und Westseite, Lehne zum Glas
  for (let z = a - 1; z <= a + 2; z++) {
    b.stairs(a + 11, 1, z, 'smooth_quartz_stairs', { facing: 'east' });
    b.stairs(a - 10, 1, z, 'smooth_quartz_stairs', { facing: 'west' });
  }
  // Topfpflanzen in den vier Schrägrichtungen
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.set(a + (dx > 0 ? 7 : -6), 1, a + (dz > 0 ? 7 : -6), 'potted_flowering_azalea_bush');
  }
}

// --- Bau ---

export default function build(b, { scale = 1 } = {}) {
  const P = config(scale);
  const g = buildGeometry(P);
  const S = g.spheres;
  const axisSec = axisSection(g, P.tubeR);
  const plaza = P.plaza;
  const pav = pavilionCells(g);
  const pr = g.pavilionD / 2;

  // 1. Fundament
  b.phase(
    'Fundament und Pavillonboden',
    `Lege zuerst den runden Boden des Eingangspavillons aus Glattem Stein: ${g.pavilionD} Blöcke Durchmesser, die Mitte ist die senkrechte Achse des ganzen Atomiums. Alle neun Kugeln richten sich nach dieser Achse aus. Dazu kommen sechs Fundamentplatten aus Hellgrauem Beton für die Beine der drei Stützen.`,
    { tips: [`Markiere die Achse mit einem farbigen Block. Die Fußpunkte der drei Stützen liegen rund ${footDistance(g, scale)} Blöcke von ihr entfernt.`] },
  );
  for (const c of pav) b.set(c.x, 0, c.z, PAVING);
  for (const sp of [S.L1, S.L2, S.L3]) {
    for (const leg of supportLegs(g, sp, P)) {
      for (const [x, y, z] of legCells(g, leg.foot, leg.top, P.legW)) {
        if (y !== 1) continue;
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) b.set(x + dx, 0, z + dz, SUPPORT);
      }
    }
  }

  // 2. Pavillon
  b.phase(
    'Eingangspavillon',
    `Der Pavillon ist ein flacher Rundbau: ${P.interior ? `Außenring aus Glasscheiben, alle paar Blöcke ein Pfosten aus Weißem Beton, ${P.pavilionH} Ebenen hoch, darüber ein Flachdach aus Weißem Beton. Auf der Südseite führen zwei gewachste Kupfertüren hinein; in der Mitte steht der Kern des Mittelrohrs mit dem Einstieg zur Leiter.` : 'eine Ebene Glasscheiben mit Pfosten aus Weißem Beton und ein Flachdach. Bei 1:2 ist er nur angedeutet.'} Auf dem Dach sitzt später die unterste Kugel.`,
    { tips: ['Setze erst die Pfosten, dann die Glasscheiben dazwischen – sie verbinden sich von selbst.'] },
  );
  for (const c of pav) {
    if (c.edge) {
      const slot = Math.round(((c.angle + Math.PI) / (2 * Math.PI)) * 64);
      for (let y = 1; y <= P.pavilionH; y++) b.set(c.x, y, c.z, slot % 6 === 0 ? PAVILION_POST : PAVILION_WALL);
    }
    b.set(c.x, g.roofY, c.z, PAVILION_ROOF);
  }
  if (P.interior) {
    // Türen nach Süden
    const doorZ = Math.max(...pav.filter((c) => c.x === Math.floor(g.axis)).map((c) => c.z));
    for (const dx of [0, 1]) {
      const x = Math.floor(g.axis) + dx;
      const z = Math.max(...pav.filter((c) => c.x === x).map((c) => c.z));
      b.remove(x, 3, z);
      b.set(x, 1, z, `waxed_copper_door[facing=north,half=lower,hinge=${dx === 0 ? 'left' : 'right'},open=false]`);
      b.set(x, 2, z, `waxed_copper_door[facing=north,half=upper,hinge=${dx === 0 ? 'left' : 'right'},open=false]`);
      b.set(x, 3, z, PAVILION_POST);
    }
    b.note(Math.floor(g.axis), 1, doorZ, 'Eingang: zwei gewachste Kupfertüren auf der Südseite des Pavillons (gewachst, damit sie nicht anlaufen).');
    for (let y = 1; y < g.roofY; y++) for (const [x, z] of axisSec.ring) b.set(x, y, z, CORE);
    for (const [x, z] of axisSec.ring) if (z === Math.ceil(g.axis + 1)) { b.remove(x, 1, z); b.remove(x, 2, z); }
    for (const [x, z] of axisSec.hollow) b.remove(x, g.roofY, z);
  } else {
    for (let y = 1; y <= P.pavilionH; y++) for (const c of pav) if (!c.edge) b.set(c.x, y, c.z, PAVILION_ROOF);
  }

  // 3. Stützen
  b.phase(
    'Drei Doppelstützen',
    `Unter den drei unteren Außenkugeln (Süd, Nordwest, Nordost) steht je eine Doppelstütze aus Hellgrauem Beton: zwei schräge Beine, die unten ${Math.round(2 * LEG_SPREAD_M * scale)} Blöcke auseinander stehen und oben direkt unter der Kugel zusammenlaufen. Baue sie Ebene für Ebene von unten nach oben – jede Ebene rückt ein Stück zur Kugel hin.`,
    { tips: [`Die Fußpunkte liegen rund ${footDistance(g, scale)} Blöcke von der Achse entfernt, jeweils in Richtung der Kugel darüber.`,'Ein Gerüst (Gerüstblöcke) neben den Beinen erleichtert die oberen Ebenen.'] },
  );
  for (const sp of [S.L1, S.L2, S.L3]) {
    for (const leg of supportLegs(g, sp, P)) for (const [x, y, z] of legCells(g, leg.foot, leg.top, P.legW)) b.set(x, y, z, SUPPORT);
  }

  // 4.–11. Kugeln und Röhren in Bau-Reihenfolge
  const tubeGroup = (pairs) => {
    for (const [a, c] of pairs) for (const [x, y, z] of tubeCells(g, S[a].c, S[c].c, P.tubeR)) b.set(x, y, z, TUBE);
  };
  const shellText = P.interior
    ? `Jede Kugel hat ${g.D} Blöcke Durchmesser und eine Hülle aus Eisenblöcken. Innen liegen zwei Böden aus Glattem Stein (der untere 4 Ebenen unter der Kugelmitte, der obere 5 Ebenen darüber) mit je vier Leuchtsteinen als Deckenlicht für beide Räume. Auf Höhe der Böden sitzen Fensterreihen aus Grauem Glas.`
    : `Jede Kugel hat ${g.D} Blöcke Durchmesser und ist bei 1:2 massiv aus Eisenblöcken.`;
  const scaffoldTip = 'Unter einer frei hängenden Kugel brauchst du Hilfsblöcke: Stelle ein Gerüst bis zur untersten Ebene und baue die Hülle Ring für Ring nach oben. Entferne das Gerüst, sobald die Röhren die Kugel halten.';

  b.phase(
    'Untere Kugel',
    `Die unterste Kugel sitzt mitten auf dem Pavillondach. ${shellText}${P.interior ? ' Durch die Kugel läuft der Kern des Mittelrohrs aus Glattem Stein mit dem Leiterschacht; auf beiden Böden hat er nach Süden eine zwei Blöcke breite Öffnung.' : ''}`,
    { tips: ['Baue die Kugel Ebene für Ebene: Jede Ebene ist ein Kreis, der bis zur Mitte wächst und dann wieder schrumpft.'] },
  );
  buildSphere(b, g, S.B, P, axisSec);

  b.phase(
    'Drei Kugeln auf den Stützen',
    `Die drei unteren Außenkugeln liegen ${Math.round(S.L1.c[1] - S.B.c[1])} Ebenen über der Mitte der unteren Kugel und ${Math.round(g.rh)} Blöcke waagrecht von der Achse entfernt (Süd, Nordwest, Nordost). Sie ruhen auf den Doppelstützen. ${shellText}${P.interior ? ' Diese Kugeln haben keinen Zugang (im Original führen Rolltreppen in den schrägen Röhren hinein).' : ''}`,
    { tips: ['Fang direkt auf den Stützen an: Die unterste Ebene jeder Kugel liegt auf den Beinen auf.'] },
  );
  for (const sp of [S.L1, S.L2, S.L3]) buildSphere(b, g, sp, P, axisSec);

  b.phase(
    'Röhren der unteren Hälfte',
    `Jetzt verbindest du: drei Röhren von der unteren Kugel schräg hinauf zu den drei Außenkugeln (Würfelkanten) und drei Röhren von den Außenkugeln schräg zur Mitte, wo später die Mittelkugel sitzt. Die Röhren haben ${P.interior ? 'rund 3 Blöcke (3,3 m)' : '1–2 Blöcke'} Durchmesser und sind aus Eisenblöcken${P.interior ? '; das senkrechte Mittelrohr zur Mittelkugel ist hohl und enthält die Leiter' : ''}.`,
    { tips: ['Schräge Röhren baust du am besten von der tragenden Kugel aus: Jede Ebene ist eine kleine Scheibe, die ein Stück weiter wandert.', scaffoldTip] },
  );
  tubeGroup(g.tubes.lowerEdges);
  tubeGroup(g.tubes.lowerCenter);
  if (P.interior) {
    for (let y = Math.floor(S.B.c[1] + g.R) + 1; y < Math.ceil(S.C.c[1] - g.R); y++) {
      for (const [x, z] of axisSec.ring) b.set(x, y, z, TUBE);
      for (const [x, z] of axisSec.hollow) b.remove(x, y, z);
    }
  } else tubeGroup([['B', 'C']]);

  b.phase(
    'Mittelkugel',
    `Die Mittelkugel sitzt genau über der unteren Kugel auf der Achse, ${Math.round(S.C.c[1] - S.B.c[1])} Ebenen höher. Sie hängt an vier Röhren. ${shellText}${P.interior ? ' Auch hier läuft der Kern mit dem Leiterschacht durch, mit Öffnungen nach Süden auf beiden Böden.' : ''}`,
    { tips: [scaffoldTip] },
  );
  buildSphere(b, g, S.C, P, axisSec);

  b.phase(
    'Röhren zu den oberen Kugeln',
    'Von jeder unteren Außenkugel laufen zwei Röhren schräg hinauf zu den beiden benachbarten oberen Kugeln (sechs Würfelkanten), dazu drei Röhren von der Mittelkugel zu den oberen Kugeln. Die oberen Kugeln stehen genau zwischen den unteren: über Südost, Südwest und Nord.',
    { tips: [scaffoldTip] },
  );
  tubeGroup(g.tubes.middleEdges);
  tubeGroup(g.tubes.upperCenter);

  b.phase(
    'Drei obere Kugeln',
    `Die oberen Außenkugeln liegen ${Math.round(S.U1.c[1] - S.B.c[1])} Ebenen über der Mitte der unteren Kugel, wieder ${Math.round(g.rh)} Blöcke von der Achse. ${shellText}${P.interior ? ' Wie im Original sind sie nicht zugänglich.' : ''}`,
    { tips: [scaffoldTip] },
  );
  for (const sp of [S.U1, S.U2, S.U3]) buildSphere(b, g, sp, P, axisSec);

  b.phase(
    'Röhren zur Spitze',
    `Drei Röhren laufen von den oberen Kugeln zur Spitze; ${P.interior ? 'das hohle senkrechte Mittelrohr führt die Leiter von der Mittelkugel hinauf' : 'dazu das senkrechte Mittelrohr'}.`,
    { tips: ['Die Spitzenkugel hängt nur an diesen vier Röhren – lass das Gerüst stehen, bis alle vier fertig sind.'] },
  );
  tubeGroup(g.tubes.upperEdges);
  if (P.interior) {
    for (let y = Math.floor(S.C.c[1] + g.R) + 1; y < Math.ceil(S.T.c[1] - g.R); y++) {
      for (const [x, z] of axisSec.ring) b.set(x, y, z, TUBE);
      for (const [x, z] of axisSec.hollow) b.remove(x, y, z);
    }
  } else tubeGroup([['C', 'T']]);

  b.phase(
    'Oberste Kugel',
    `Die Spitzenkugel krönt das Atomium; ihre Oberkante liegt ${Math.ceil(S.T.c[1] + g.R) - 1} Ebenen über dem Platz. ${P.interior ? 'Auf dem unteren Boden liegt das Restaurant mit einem umlaufenden Panoramaband aus Hellgrauem Glas (zwei Reihen), darüber die Aussichtsebene mit kleineren Fenstern. Hülle, Böden und Leuchtsteine wie bei den anderen Kugeln.' : 'Ein Band aus Hellgrauem Glas um die Mitte deutet das Panorama-Restaurant an.'}`,
    { tips: [scaffoldTip] },
  );
  buildSphere(b, g, S.T, P, axisSec);

  // 12. Leiter, Einrichtung, Licht
  if (P.interior) {
    b.phase(
      'Leiter, Einrichtung und Licht',
      'Setze die Leiter an die Nordwand des Mittelrohrs: von der Mitte des Pavillons bis zum oberen Boden der Spitzenkugel, ohne Lücke. Hänge im Pavillon sechs Laternen unter das Dach und richte ihn mit Empfangstresen, Bänken und Pflanzen ein. In der unteren Kugel und der Mittelkugel stellst du Lesepulte als Ausstellungstafeln auf, in der Spitzenkugel Tische (Fichtenzaun mit Druckplatte) und Stühle (Fichtentreppen, Lehne nach außen) fürs Restaurant und Bänke auf der Aussichtsebene. Unter jedem oberen Boden hängen vier Laternen.',
      { tips: ['Leitern hängen nur an einer festen Wand: Schau beim Setzen nach Norden auf die Rohrwand.', 'Am Ausstieg in jeder Kugel ist der Boden neben der Leiter fest – dort steigst du aus und gehst durch die Öffnung nach Süden.'] },
    );
    const lx = Math.floor(g.axis);
    const lz = Math.floor(g.axis);
    const top = floorLevels(S.T).f2 + 1;
    b.step('Leiter im Mittelrohr', `Setze eine durchgehende Leiter an die Nordwand des Mittelrohrs, von Ebene 2 bis Ebene ${top + 1}: Schau beim Setzen nach Norden auf die Wand, dann zeigt die Leiter nach Süden. In jedem Kugelboden ist genau über der Leiter ein Loch frei.`);
    for (let y = 1; y <= top; y++) b.set(lx, y, lz, 'ladder[facing=south]');
    b.step('Licht im Pavillon', 'Sechs Laternen hängen unter dem Pavillondach.');
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      b.set(Math.floor(g.axis + 8 * Math.cos(a)), g.roofY - 1, Math.floor(g.axis + 8 * Math.sin(a)), 'lantern[hanging=true]');
    }
    b.step('Empfang im Pavillon', 'Stelle an die Nordseite einen 6 Blöcke langen Empfangstresen aus Weißem Beton mit Glatten Quarzstufen obendrauf und dahinter zwei Hocker. An die Ost- und Westseite kommen Bänke aus Glatten Quarztreppen (Lehne zum Glas), in die vier Ecken dazwischen blühende Azaleen im Topf.');
    furnishPavilion(b, g);
    b.step('Einrichtung der Achsenkugeln', 'Ausstellung in der unteren Kugel und der Mittelkugel, Restaurant und Aussichtsebene in der Spitzenkugel, dazu Laternen unter den oberen Böden.');
    for (const sp of [S.B, S.C, S.T]) furnish(b, g, sp);
    b.note(lx, floorLevels(S.T).f1 + 1, lz + 3, 'Restaurant mit Panoramafenstern in der obersten Kugel.');
  }

  // 13. Umgebung
  b.phase(
    'Platz, Rasen und Bäume',
    `Rund um den Pavillon liegt ein gepflasterter Platz aus Glattem Stein, von dem drei Wege zu den Stützen und einer nach Süden führen. Der Rest ist Rasen bis ${plaza} Blöcke von der Achse, mit kleinen Eichen und Birken am Rand.`,
    { tips: ['Lege erst die Wege, dann den Rasen – so bleiben die Kanten sauber.'] },
  );
  const forecourt = pr + Math.round(6 * scale);
  const pathHalf = Math.max(1, Math.round(1.5 * scale));
  for (let x = Math.floor(g.axis - plaza); x <= Math.ceil(g.axis + plaza); x++) {
    for (let z = Math.floor(g.axis - plaza); z <= Math.ceil(g.axis + plaza); z++) {
      const dx = x - g.axis;
      const dz = z - g.axis;
      const d = Math.hypot(dx, dz);
      if (d > plaza + 1e-9 || b.get(x, 0, z) !== 'air') continue;
      let path = d <= forecourt;
      for (const deg of [90, 210, 330]) {
        const a = (deg * Math.PI) / 180;
        const along = dx * Math.cos(a) + dz * Math.sin(a);
        const across = Math.abs(-dx * Math.sin(a) + dz * Math.cos(a));
        if (along > 0 && along <= g.rh + 8 * scale && across <= pathHalf + 6 * scale * (along > g.rh - 10 * scale ? 1 : 0)) path = true;
      }
      if (Math.abs(dx) <= pathHalf + 0.5 && dz > 0) path = true;
      b.set(x, 0, z, path ? PAVING : 'grass_block');
    }
  }
  if (P.interior) {
    for (let k = 0; k < 12; k++) {
      const a = ((15 + k * 30) * Math.PI) / 180;
      const x = Math.round(g.axis + 45 * Math.cos(a));
      const z = Math.round(g.axis + 45 * Math.sin(a));
      if (b.get(x, 0, z) === 'grass_block' && b.get(x, 1, z) === 'air') {
        tree(b, { x, y: 1, z, species: k % 3 === 2 ? 'birke' : 'eiche', size: 'klein', seed: k, facing: cardinal(g.axis - x, g.axis - z) });
      }
    }
  }
}

function furnish(b, g, sp) {
  const { f1, f2 } = floorLevels(sp);
  const cx = sp.c[0];
  const cz = sp.c[2];
  const ring = (r, count, offset = 0) => Array.from({ length: count }, (_, k) => {
    const a = ((k + offset) * 2 * Math.PI) / count;
    return [Math.floor(cx + r * Math.cos(a)), Math.floor(cz + r * Math.sin(a)), a];
  });
  // Laternen unter dem oberen Boden (für den unteren Raum)
  for (const [x, z] of ring(5, 4, 0.5)) b.set(x, f2 - 1, z, 'lantern[hanging=true]');
  if (sp.name === 'T') {
    for (const [x, z, a] of ring(5, 6, 0.25)) {
      b.set(x, f1 + 1, z, 'spruce_fence');
      b.set(x, f1 + 2, z, 'spruce_pressure_plate');
      const out = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
      const side = [-out[1], out[0]];
      for (const sgn of [-1, 1]) {
        const sx = x + sgn * side[0];
        const sz = z + sgn * side[1];
        if (b.get(sx, f1 + 1, sz) === 'air') b.stairs(sx, f1 + 1, sz, 'spruce_stairs', { facing: cardinal(sgn * side[0], sgn * side[1]) });
      }
    }
    for (const [x, z, a] of ring(5, 8, 0.5)) {
      if (b.get(x, f2 + 1, z) === 'air') b.stairs(x, f2 + 1, z, 'spruce_stairs', { facing: cardinal(-Math.cos(a), -Math.sin(a)) });
    }
    for (const [x, z] of ring(3, 4)) if (b.get(x, f2 + 1, z) === 'air') b.set(x, f2 + 1, z, 'lantern[hanging=false]');
  } else {
    for (const [x, z, a] of ring(5, 6, 0.25)) {
      if (b.get(x, f1 + 1, z) === 'air') b.set(x, f1 + 1, z, `lectern[facing=${cardinal(-Math.cos(a), -Math.sin(a))}]`);
    }
    for (const [x, z] of ring(4, 4, 0.5)) if (b.get(x, f2 + 1, z) === 'air') b.set(x, f2 + 1, z, 'potted_azalea_bush');
  }
}
