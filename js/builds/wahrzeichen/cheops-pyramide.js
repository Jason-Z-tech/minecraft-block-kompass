// Cheops-Pyramide (Gizeh) im heutigen Zustand. Grundlage: docs/recherche/cheops-pyramide.md.
// Kennzeichen wie in der Recherche: B belegt, S Sekundärquelle, R Rechnung, G geschätzt.
// Alle Maße in Metern; der Maßstab s rechnet sie in Blöcke um (1 Block = 1 m bei s = 1).

export const meta = {
  id: 'cheops-pyramide',
  title: 'Cheops-Pyramide',
  category: 'wahrzeichen',
  subtitle: 'Große Pyramide von Gizeh im heutigen Zustand',
  tags: ['Ägypten', 'Gizeh', 'Pyramide', 'Weltwunder', 'Antike', 'Wüste', 'Grabmal', 'Riesig', 'Maßstab 1:1'],
  aliases: [
    'cheops', 'cheopspyramide', 'cheops pyramide', 'große pyramide', 'grosse pyramide', 'pyramide von gizeh',
    'pyramide gizeh', 'pyramiden von gizeh', 'great pyramid', 'great pyramid of giza', 'pyramid of giza',
    'pyramid of khufu', 'khufu', 'chufu', 'keops', 'kheops', 'giza', 'gizeh', 'pyramide', 'pyramid', 'ägypten pyramide',
    'aegypten pyramide', 'königskammer', 'koenigskammer', 'große galerie',
  ],
  accuracy: 'massstab',
  description: 'Die Große Pyramide von Gizeh so, wie sie heute dasteht: 230 m Grundseite, 139 m hoch, mit dem '
    + 'abgetreppten Kernmauerwerk, der fehlenden Spitze und den Verkleidungsresten an der Nordseite. Innen sind der '
    + 'absteigende und der aufsteigende Gang, die Granitpfropfen, der Grabräubertunnel, die Große Galerie, Königinnen- '
    + 'und Königskammer mit den Entlastungskammern nach den veröffentlichten Maßen eingebaut. Geschätzt sind die '
    + 'genaue Lage der Kammern (± 3 m) und die Höhe der Kammern über der Entlastung; die Gänge sind 2 Blöcke hoch, '
    + 'damit du gehen kannst (echt rund 1,2 m).',
  sources: [
    { title: 'Wikipedia (de): Cheops-Pyramide', url: 'https://de.wikipedia.org/wiki/Cheops-Pyramide' },
    { title: 'Wikipedia (en): Great Pyramid of Giza', url: 'https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza' },
    { title: 'Howard Vyse: Operations carried on at the Pyramids of Gizeh, Bd. 2 (1840), Anhang (Plattform)', url: 'https://digi.ub.uni-heidelberg.de/diglit/howard_vyse1841bd2/0312/text_ocr' },
  ],
  credits: null,
  scales: [1, 0.5, 0.25],
  tested: null,
};

// --- Maße (Metern) ---
const SLOPE_DEG = 51 + 50 / 60 + 40 / 3600;            // B
const RUN_PER_BLOCK = 1 / Math.tan((SLOPE_DEG * Math.PI) / 180); // 0,7857 m Rücksprung je 1 m Höhe
const BASE_M = 230.33;                                  // B
const HEIGHT_TODAY_M = 138.75;                          // B (de-Wikipedia; en: 138,5)
const CASING_LOSS_M = 1.35;                             // G: Plattform heute ≈ 10 m (Howard Vyse, nicht erneut geprüft) statt 12,7 m Idealmaß
const ENTRANCE_HEIGHT_M = 16.98;                        // B
const ENTRANCE_EAST_M = 7.29;                           // B
const ENTRANCE_NORTH_M = BASE_M / 2 - ENTRANCE_HEIGHT_M * RUN_PER_BLOCK; // R: 101,8 m nördlich der Mitte

// --- Blöcke ---
const CORE = 'sandstone';
const CORE_MIX = [['sandstone', 58], ['smooth_sandstone', 24], ['cut_sandstone', 13], ['sandstone', 5]];
const FINE = 'smooth_sandstone';               // feiner Tura-Kalkstein (Gänge, Verkleidung)
const FINE_SLAB = 'smooth_sandstone_slab';
const FINE_STAIRS = 'smooth_sandstone_stairs';
const CORE_STAIRS = 'sandstone_stairs';
const GRANITE = 'polished_granite';            // Rosengranit aus Assuan
const GRANITE_ROUGH = 'granite';
const PAVEMENT = [['smooth_sandstone', 6], ['cut_sandstone', 3], ['sandstone', 2]];

const PRIO_SOLID = 1;
const PRIO_AIR = 2;
const PRIO_DETAIL = 3;

function checkScale(scale) {
  if (!meta.scales.includes(scale)) throw new Error(`Cheops-Pyramide: Maßstab ${scale} gibt es nicht (erlaubt: ${meta.scales.join(', ')}).`);
  return scale;
}

// Ebenen des Kernmauerwerks: je Ebene ein Quadrat lo..hi (x und z gleich).
function pyramidGeometry(s) {
  const side = Math.round(BASE_M * s);
  const c = (side - 1) / 2;
  const layers = Math.round(HEIGHT_TODAY_M * s);
  const halfCore = (BASE_M * s) / 2 - CASING_LOSS_M * s;
  const span = [];
  for (let y = 0; y < layers; y++) {
    const half = halfCore - (y + 0.5) * RUN_PER_BLOCK;
    span.push({ lo: Math.floor(c - half) + 1, hi: Math.ceil(c + half) - 1 });
  }
  const inCore = (x, y, z) => {
    const row = span[y];
    return row !== undefined && x >= row.lo && x <= row.hi && z >= row.lo && z <= row.hi;
  };
  return { s, side, c, layers, span, inCore, toCell: (meters) => Math.round(c + meters * s) };
}

// Sammelt Gänge und Kammern als Zellen mit Vorrang (Wand < Luft < Ausstattung), sortiert nach Ebenen.
class CellPlan {
  constructor(geo) {
    this.geo = geo;
    this.cells = new Map();
  }

  put(x, y, z, state, prio) {
    if (prio === PRIO_SOLID && !this.geo.inCore(x, y, z)) return;
    const key = `${x},${y},${z}`;
    const old = this.cells.get(key);
    if (old && old.prio > prio) return;
    this.cells.set(key, { x, y, z, state, prio });
  }

  solid(x, y, z, state) { this.put(x, y, z, state, PRIO_SOLID); }
  air(x, y, z) { this.put(x, y, z, 'air', PRIO_AIR); }
  detail(x, y, z, state) { this.put(x, y, z, state, PRIO_DETAIL); }

  byLayer() {
    const layers = new Map();
    for (const cell of this.cells.values()) {
      if (!layers.has(cell.y)) layers.set(cell.y, []);
      layers.get(cell.y).push(cell);
    }
    return layers;
  }
}

// Schräger Gang (Steigung 1:2) entlang z. ft = Fußbodenhöhe (ganz oder halb), clear = lichte Höhe.
// Halbe Höhen: untere Stufe als Boden, obere Stufe als Decke – so bleibt die lichte Höhe gleich.
function rampCells(plan, { x0, x1, zFrom, zTo, ftAt, clear, wall = FINE, floor = FINE, slab = FINE_SLAB, ceiling = FINE }) {
  for (let z = zFrom; z <= zTo; z++) {
    const ft = ftAt(z);
    const whole = Number.isInteger(ft);
    const base = Math.floor(ft);
    const floorY = whole ? ft - 1 : base;
    const airFrom = whole ? ft : base + 1;
    const ceilY = whole ? ft + clear : base + clear;
    for (let x = x0; x <= x1; x++) {
      plan.solid(x, floorY, z, whole ? floor : `${slab}[type=bottom]`);
      for (let y = airFrom; y < ceilY; y++) plan.air(x, y, z);
      plan.solid(x, ceilY, z, whole ? ceiling : `${slab}[type=top]`);
    }
    for (const x of [x0 - 1, x1 + 1]) for (let y = floorY; y <= ceilY; y++) plan.solid(x, y, z, wall);
  }
}

function rampCeiling(ft, clear) {
  return Number.isInteger(ft) ? ft + clear : Math.floor(ft) + clear;
}

function airFromFloor(ft) {
  return Number.isInteger(ft) ? ft : Math.floor(ft) + 1;
}

// Rechteckiger Raum: Innenraum x0..x1, z0..z1, Boden-Oberkante floorTop, lichte Höhe h, Wände/Boden/Decke aus wall.
function roomCells(plan, { x0, x1, z0, z1, floorTop, h, wall, floor = wall, ceiling = wall }) {
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    for (let z = z0 - 1; z <= z1 + 1; z++) {
      const inside = x >= x0 && x <= x1 && z >= z0 && z <= z1;
      plan.solid(x, floorTop - 1, z, inside ? floor : wall);
      plan.solid(x, floorTop + h, z, inside ? ceiling : wall);
      for (let y = floorTop; y < floorTop + h; y++) {
        if (inside) plan.air(x, y, z);
        else plan.solid(x, y, z, wall);
      }
    }
  }
}

function planInterior(geo) {
  const { s, span } = geo;
  const plan = new CellPlan(geo);
  const detailed = s >= 1;
  const px = geo.toCell(ENTRANCE_EAST_M);                     // Achse der Gänge, 7,29 m östlich der Mitte
  const yE = Math.round(ENTRANCE_HEIGHT_M * s);
  const zAnchor = geo.toCell(-ENTRANCE_NORTH_M);             // ursprünglicher Eingang in der Verkleidung
  const zFace = span[yE].lo;
  const descFt = (z) => yE - (z - zAnchor) / 2;

  // Absteigender Gang bis kurz über die Basis (darunter läuft er im Fels weiter).
  const zDescEnd = zAnchor + 2 * yE - 1;
  rampCells(plan, { x0: px, x1: px, zFrom: zFace, zTo: zDescEnd, ftAt: descFt, clear: 2 });
  for (let z = zFace + 3; z <= zDescEnd; z += 10) plan.detail(px, airFromFloor(descFt(z)) + (Number.isInteger(descFt(z)) ? 1 : 0), z, 'wall_torch[facing=east]');

  // Abzweig des aufsteigenden Gangs: 27,3 m schräg = 24,4 m waagrecht hinter dem Eingang.
  const zJ = zAnchor + 2 * Math.round(12.2 * s);
  const ftJ = descFt(zJ);
  const zG = zJ + Math.round(33.9 * s);
  const ascFt = (z) => ftJ + (z - zJ) / 2;
  const ftG = ascFt(zG);
  rampCells(plan, { x0: px, x1: px, zFrom: zJ + 1, zTo: zG, ftAt: ascFt, clear: 2 });
  // Pfropfen nur im aufsteigenden Gang, nicht in der Luft des absteigenden darunter.
  const plugs = Math.max(1, Math.round(4.24 * s));
  for (let z = zJ + 1; z <= zJ + plugs; z++) {
    const ft = ascFt(z);
    const descCeiling = rampCeiling(descFt(z), 2);
    for (let y = Math.max(Math.floor(ft), descCeiling); y <= Math.floor(ft) + 2; y++) plan.detail(px, y, z, GRANITE);
  }
  for (let z = zJ + plugs + 3; z < zG; z += 10) {
    const ft = ascFt(z);
    plan.detail(px, airFromFloor(ft) + (Number.isInteger(ft) ? 1 : 0), z, 'wall_torch[facing=east]');
  }

  // Grabräubertunnel: etwa 7 m hoch, 7,3 m westlich des Eingangs, 27 m nach Süden, dann zum aufsteigenden Gang.
  const yR = Math.round(7 * s);
  const xR = px - Math.round(7.3 * s);
  const tunnelWidth = detailed ? 2 : 1;
  const tunnelHeight = detailed ? 3 : 2;
  const zFaceR = span[yR].lo;
  const zT = zFaceR + Math.round(27 * s);
  const zMeet = zJ + plugs + 1;
  const tunnelColumn = (x, z) => {
    for (let dx = 0; dx < tunnelWidth; dx++) for (let y = yR; y < yR + tunnelHeight; y++) plan.air(x - dx, y, z);
  };
  for (let z = zFaceR - 1; z <= zT; z++) tunnelColumn(xR, z);
  const steps = Math.max(Math.abs(px - 1 - xR), Math.abs(zMeet - zT));
  // Schräg verlaufendes Stück: immer über Flächen verbunden (keine reinen Eckkontakte).
  let last = [xR, zT];
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(xR + ((px - 1 - xR) * i) / steps);
    const z = Math.round(zT + ((zMeet - zT) * i) / steps);
    if (x !== last[0] && z !== last[1]) tunnelColumn(x, last[1]);
    tunnelColumn(x, z);
    last = [x, z];
  }
  for (let z = zFaceR + 4; z <= zT; z += detailed ? 8 : 5) plan.detail(xR - tunnelWidth + 1, yR + 1, z, 'wall_torch[facing=east]');
  const bend = Math.round(steps / 2);
  plan.detail(Math.round(xR + ((px - 1 - xR) * bend) / steps), yR, Math.round(zT + ((zMeet - zT) * bend) / steps), 'torch');

  // Waagrechter Gang zur Königinnenkammer (38,15 m, die ersten 5 m nach oben offen).
  const ftQ = Math.floor(ftG);
  const zQ = zG + Math.round(38.15 * s);
  rampCells(plan, { x0: px, x1: px, zFrom: zG, zTo: zQ - 1, ftAt: () => ftQ, clear: 2 });
  for (let z = zG + 6; z < zQ; z += 10) plan.detail(px, ftQ + 1, z, 'wall_torch[facing=east]');

  // Königinnenkammer: 5,23 m (N–S) × 5,76 m (O–W), Wände 4,69 m, Satteldach bis 6,26 m (First O–W).
  const qNs = Math.max(2, Math.round(5.23 * s));
  const qEw = Math.max(2, Math.round(5.76 * s));
  const qWall = Math.max(2, Math.round(4.69 * s));
  const qx0 = px - Math.floor(qEw / 2);
  const qx1 = qx0 + qEw - 1;
  const qz0 = zQ;
  const qz1 = zQ + qNs - 1;
  roomCells(plan, { x0: qx0, x1: qx1, z0: qz0, z1: qz1, floorTop: ftQ, h: qWall + (detailed ? 1 : 0), wall: FINE });
  if (detailed) {
    for (let x = qx0; x <= qx1; x++) {
      plan.detail(x, ftQ + qWall, qz0, `${FINE_STAIRS}[facing=north,half=top]`);
      plan.detail(x, ftQ + qWall, qz1, `${FINE_STAIRS}[facing=south,half=top]`);
    }
    // Kragnische in der Ostwand, 4,69 m hoch und 1 m tief.
    const nz = Math.round((qz0 + qz1) / 2);
    for (let y = ftQ; y < ftQ + qWall; y++) {
      const half = y < ftQ + 2 ? 1 : 0;
      for (let z = nz - half; z <= nz + half; z++) plan.air(qx1 + 1, y, z);
    }
  }
  plan.detail(qx0, ftQ, qz0, 'lantern[hanging=false]');

  // Große Galerie: 46,7 m lang, 8,6 m hoch, steigt 21 m.
  let kG = Math.round(41.45 * s);
  if (!Number.isInteger(ftG + kG / 2)) kG += 1;
  const zTop = zG + kG;
  const galleryFt = (z) => ftG + (z - zG) / 2;
  const ftTop = galleryFt(zTop);
  if (detailed) {
    planGrandGallery(plan, { px, zG, zTop, ftQ, galleryFt });
  } else {
    rampCells(plan, { x0: px, x1: px, zFrom: zG + 1, zTo: zTop, ftAt: galleryFt, clear: Math.round(8.6 * s) });
    for (let z = zG + 6; z < zTop; z += 8) plan.detail(px, airFromFloor(galleryFt(z)) + 1, z, 'wall_torch[facing=east]');
    // Ohne Seitenbänke führt eine Leiter neben dem offenen Gangstück auf die Rampe.
    const zLadder = firstRampCell(zG, zTop, galleryFt, ftQ);
    for (let y = ftQ; y <= Math.floor(galleryFt(zLadder)) + 1; y++) plan.air(px + 1, y, zLadder);
    for (let y = ftQ; y <= Math.floor(galleryFt(zLadder)); y++) plan.detail(px + 1, y, zLadder, 'ladder[facing=west]');
  }

  // Großer Absatz, Vorkammer mit Granitblatt, Gang und Königskammer.
  const zStep = zTop + 1;
  const zLow1 = zStep + 1;
  const ante = detailed ? 3 : 1;
  const zAnte = zLow1 + 1;
  const low2 = detailed ? 2 : 1;
  const zLow2 = zAnte + ante;
  const zKing = zLow2 + low2;
  rampCells(plan, { x0: px, x1: px, zFrom: zStep, zTo: zLow1, ftAt: () => ftTop, clear: 2 });
  if (detailed) {
    roomCells(plan, { x0: px, x1: px, z0: zAnte, z1: zAnte + ante - 1, floorTop: ftTop, h: 4, wall: FINE, floor: GRANITE });
    for (let z = zAnte; z < zAnte + ante; z++) for (const x of [px - 1, px + 1]) for (let y = ftTop - 1; y <= ftTop + 1; y++) plan.solid(x, y, z, GRANITE);
    plan.detail(px, ftTop + 2, zAnte, GRANITE);
    plan.detail(px, ftTop + 1, zAnte + 1, 'wall_torch[facing=east]');
  } else {
    rampCells(plan, { x0: px, x1: px, zFrom: zAnte, zTo: zAnte, ftAt: () => ftTop, clear: 2 });
  }
  rampCells(plan, { x0: px, x1: px, zFrom: zLow2, zTo: zKing - 1, ftAt: () => ftTop, clear: 2, wall: GRANITE, floor: GRANITE, ceiling: GRANITE });

  const kEw = Math.max(3, Math.round(10.49 * s));
  const kNs = Math.max(2, Math.round(5.24 * s));
  const kH = Math.max(2, Math.round(5.84 * s));
  const kx1 = px;
  const kx0 = px - kEw + 1;
  const kz0 = zKing;
  const kz1 = zKing + kNs - 1;
  roomCells(plan, { x0: kx0, x1: kx1, z0: kz0, z1: kz1, floorTop: ftTop, h: kH, wall: GRANITE, ceiling: GRANITE_ROUGH });
  const sarcoX = kx0 + (detailed ? 1 : 0);
  plan.detail(sarcoX, ftTop, kz0 + (detailed ? 1 : 0), GRANITE_ROUGH);
  if (detailed) plan.detail(sarcoX, ftTop, kz0 + 2, GRANITE_ROUGH);
  // Stehende Laternen an der Südwand (hängende kämen in der Ebenen-Anleitung vor ihrer Decke dran).
  plan.detail(kx0 + Math.floor(kEw / 4), ftTop, kz1, 'lantern[hanging=false]');
  plan.detail(kx1 - Math.floor(kEw / 4), ftTop, kz1, 'lantern[hanging=false]');

  if (detailed) planRelievingChambers(plan, { x0: kx0, x1: kx1, z0: kz0, z1: kz1, ceilingY: ftTop + kH });

  // Eingang: doppelte Giebelsteine über der Gangmündung.
  if (detailed) planEntranceNiche(plan, geo, px, yE);
  return plan;
}

// Erste Stelle, an der die Rampe über dem waagrechten Gang liegt (Boden höher als dessen Decke).
function firstRampCell(zG, zTop, galleryFt, ftQ) {
  for (let z = zG + 1; z <= zTop; z++) if (Math.floor(galleryFt(z)) >= ftQ + 2) return z;
  throw new Error('Cheops-Pyramide: die Galerie-Rampe liegt nirgends über dem waagrechten Gang.');
}

function planGrandGallery(plan, { px, zG, zTop, ftQ, galleryFt }) {
  const pitEnd = zG + 4;   // die ersten Meter ohne Rampe: darunter der offene waagrechte Gang
  for (let z = zG; z <= zTop; z++) {
    const ft = galleryFt(z);
    const base = Math.floor(ft);
    const top = base + 8;                     // lichte Höhe 8 Blöcke über der Rampe
    // Mittelrampe
    if (z > zG && z <= pitEnd) {
      for (let y = ftQ; y < top; y++) plan.air(px, y, z);
    } else {
      plan.solid(px, Number.isInteger(ft) ? ft - 1 : base, z, Number.isInteger(ft) ? FINE : `${FINE_SLAB}[type=bottom]`);
      for (let y = airFromFloor(ft); y < top; y++) plan.air(px, y, z);
    }
    plan.solid(px, top, z, Number.isInteger(ft) ? FINE : `${FINE_SLAB}[type=top]`);
    // Seitenbänke (eine halbe Stufe höher) und unterer, breiter Teil
    const side = ft + 0.5;
    for (const [x, outward] of [[px - 1, 'west'], [px + 1, 'east']]) {
      plan.solid(x, Number.isInteger(side) ? side - 1 : Math.floor(side), z, Number.isInteger(side) ? FINE : `${FINE_SLAB}[type=bottom]`);
      for (let y = airFromFloor(side); y <= base + 3; y++) plan.air(x, y, z);
      plan.detail(x, base + 4, z, `${FINE_STAIRS}[facing=${outward},half=top]`);
      for (let y = base + 5; y <= top; y++) plan.solid(x, y, z, FINE);
    }
    for (const x of [px - 2, px + 2]) for (let y = Math.floor(side) - 1; y <= base + 5; y++) plan.solid(x, y, z, FINE);
    if ((z - zG) % 6 === 3) {
      const west = ((z - zG) / 6) % 2 < 1;
      plan.detail(west ? px - 1 : px + 1, base + 2, z, `wall_torch[facing=${west ? 'east' : 'west'}]`);
    }
  }
}

// Fünf Entlastungskammern: Granitbalken mit niedrigen Hohlräumen, oben ein Giebel aus Kalksteinbalken.
function planRelievingChambers(plan, { x0, x1, z0, z1, ceilingY }) {
  const midX = Math.round((x0 + x1) / 2);
  const midZ = Math.round((z0 + z1) / 2);
  let y = ceilingY + 1;
  for (let chamber = 0; chamber < 5; chamber++) {
    const last = chamber === 4;
    const h = last ? 2 : 1;
    roomCells(plan, { x0, x1, z0, z1, floorTop: y, h, wall: FINE, floor: GRANITE_ROUGH, ceiling: last ? FINE : GRANITE_ROUGH });
    plan.detail(midX, y, midZ, 'lantern[hanging=false]');
    if (last) {
      for (let x = x0; x <= x1; x++) {
        plan.air(x, y + h, z0 + 1);
        plan.air(x, y + h, z1 - 1);
        plan.air(x, y + h, midZ);
        plan.detail(x, y + h, z0, `${FINE_STAIRS}[facing=north,half=top]`);
        plan.detail(x, y + h, z1, `${FINE_STAIRS}[facing=south,half=top]`);
        plan.detail(x, y + h + 1, z0 + 1, `${FINE_STAIRS}[facing=north,half=top]`);
        plan.detail(x, y + h + 1, z1 - 1, `${FINE_STAIRS}[facing=south,half=top]`);
        plan.air(x, y + h + 1, midZ);
        plan.solid(x, y + h + 2, midZ, FINE);
      }
    }
    y += h + 1;
  }
}

// Eingangsnische: Verkleidung und vordere Kernsteine fehlen, darin die doppelten Giebelsteine (zwei Λ übereinander).
// Die Giebelbalken stehen einen Block vor der Rückwand, damit sie sich im Schatten abzeichnen.
function planEntranceNiche(plan, geo, px, yE) {
  const top = yE + 5;
  const back = geo.span[top].lo;
  for (let y = yE + 1; y <= top + 1; y++) {
    for (let x = px - 3; x <= px + 3; x++) for (let z = geo.span[y].lo; z <= back; z++) plan.air(x, y, z);
  }
  const east = `${FINE_STAIRS}[facing=east,half=bottom]`;
  const west = `${FINE_STAIRS}[facing=west,half=bottom]`;
  const beams = [
    // [dx, Höhe über yE, Block]: inneres Λ direkt über dem Gang, äußeres Λ darüber
    [-2, 1, east], [-1, 2, east], [0, 3, FINE], [1, 2, west], [2, 1, west],
    [-3, 2, east], [-2, 3, east], [-1, 4, east], [0, 5, FINE], [1, 4, west], [2, 3, west], [3, 2, west],
    [0, 6, `${FINE_SLAB}[type=bottom]`],
  ];
  for (const [dx, dy, state] of beams) plan.detail(px + dx, yE + dy, back, state);
}

// --- Kapitel ---
function chapterList(geo, interior, detailed) {
  const m = (meters) => Math.round(meters * geo.s);
  const top = geo.layers - 1;
  const list = [
    { from: -1, title: 'Gelände: Pflaster und Sand' },
    { from: 0, title: interior ? 'Unterbau mit Verkleidungsresten' : 'Unterer Kern' },
  ];
  if (interior) {
    list.push(
      { from: m(6), title: 'Grabräubertunnel und absteigender Gang' },
      { from: m(16), title: 'Eingang und aufsteigender Gang' },
      { from: m(22), title: 'Königinnenkammer und Fuß der Großen Galerie' },
      { from: m(30), title: 'Große Galerie' },
      { from: m(42), title: 'Königskammer' },
    );
    if (detailed) list.push({ from: m(50), title: 'Entlastungskammern' });
  }
  list.push(
    { from: m(interior ? 64 : 50), title: interior ? 'Obere Pyramide' : 'Mittlerer und oberer Kern' },
    { from: top, title: 'Plattform heute' },
  );
  return list;
}

// --- Bauen ---
export default function build(b, { scale = 1 } = {}) {
  const s = checkScale(scale);
  const geo = pyramidGeometry(s);
  const interior = s >= 0.5;
  const detailed = s >= 1;
  const plan = interior ? planInterior(geo) : new CellPlan(geo);
  const planLayers = plan.byLayer();
  const chapters = chapterList(geo, interior, detailed);
  const casing = casingStretches(b, geo);

  let chapter = -1;
  for (let y = -1; y < geo.layers; y++) {
    while (chapter + 1 < chapters.length && y >= chapters[chapter + 1].from) {
      chapter++;
      const c = chapters[chapter];
      b.phase(c.title);
    }
    if (y === -1) buildGround(b, geo, s);
    else buildCoreLayer(b, geo, y);
    if (y === 0 || y === 1) buildCasingLayer(b, geo, y, casing);
    for (const cell of planLayers.get(y) ?? []) {
      if (cell.state === 'air') b.remove(cell.x, cell.y, cell.z);
      else b.set(cell.x, cell.y, cell.z, cell.state);
    }
    if (y === geo.layers - 1) buildSummit(b, geo, y);
  }
}

function buildGround(b, geo, s) {
  const { span, side } = geo;
  const pave = Math.max(2, Math.round(10 * s));
  const sand = Math.max(1, Math.round(6 * s));
  const lo0 = span[0].lo;
  const hi0 = span[0].hi;
  const outerLo = -(pave + sand);
  const outerHi = side - 1 + pave + sand;
  for (let x = outerLo; x <= outerHi; x++) {
    for (let z = outerLo; z <= outerHi; z++) {
      if (x >= lo0 && x <= hi0 && z >= lo0 && z <= hi0) continue;
      const ring = Math.max(lo0 - Math.min(x, z), Math.max(x, z) - hi0);
      const outside = Math.max(-Math.min(x, z), Math.max(x, z) - (side - 1));
      // Pflaster ist im Norden und Osten besser erhalten als im Süden und Westen.
      const worn = (z > side * 0.6 || x < side * 0.4) ? 0.35 : 0.12;
      if (outside <= pave && ring > 0 && !b.chance(worn)) b.set(x, -1, z, b.pickWeighted(PAVEMENT));
      else b.set(x, -1, z, 'sand');
    }
  }
}

function buildCoreLayer(b, geo, y) {
  const { lo, hi } = geo.span[y];
  b.fill(lo, y, lo, hi, y, hi, CORE);
  const depth = Math.min(2, Math.ceil((hi - lo + 1) / 2));
  const above = geo.span[y + 1];
  for (let d = 0; d < depth; d++) {
    const a = lo + d;
    const z2 = hi - d;
    for (let i = a; i <= z2; i++) {
      for (const [x, z] of [[i, a], [i, z2], [a, i], [z2, i]]) b.set(x, y, z, b.pickWeighted(CORE_MIX));
    }
  }
  // Abgewitterte Stufenkanten (nur dort, wo darüber eine Trittfläche liegt).
  if (!above || above.lo === lo) return;
  // An den Kanten der Pyramide ist das Mauerwerk stärker ausgebrochen.
  for (let i = lo + 1; i < hi; i++) {
    const nearCorner = Math.min(i - lo, hi - i) <= 3;
    for (const [x, z, facing] of [[i, lo, 'south'], [i, hi, 'north'], [lo, i, 'east'], [hi, i, 'west']]) {
      const roll = b.rng();
      if (roll < (nearCorner ? 0.3 : 0.05)) b.set(x, y, z, `${CORE_STAIRS}[facing=${facing},half=bottom]`);
      else if (roll > 0.975) b.remove(x, y, z); // ausgebrochener Stein
    }
  }
  for (const [x, z] of [[lo, lo], [lo, hi], [hi, lo], [hi, hi]]) if (b.chance(0.4)) b.set(x, y, z, `${CORE_STAIRS.replace('_stairs', '_slab')}[type=bottom]`);
}

// Reste der Verkleidung: an der Nordseite ein langer Abschnitt, sonst kurze Stücke.
function casingStretches(b, geo) {
  const { c, s } = geo;
  const stretches = [{ side: 'north', from: Math.round(c - 28 * s), to: Math.round(c + 24 * s) }];
  for (const side of ['east', 'south', 'west']) {
    const len = Math.max(2, Math.round(b.rngInt(5, 9) * s));
    const start = Math.round(c + b.rngInt(-60, 50) * s);
    stretches.push({ side, from: start, to: start + len - 1 });
  }
  const gaps = new Set();
  for (const { side, from, to } of stretches) for (let i = from; i <= to; i++) if (b.chance(0.12)) gaps.add(`${side}:${i}`);
  return { stretches, gaps };
}

function buildCasingLayer(b, geo, y, { stretches, gaps }) {
  const { lo, hi } = geo.span[0];
  const inward = { north: 'south', south: 'north', west: 'east', east: 'west' };
  for (const { side, from, to } of stretches) {
    for (let i = from; i <= to; i++) {
      if (gaps.has(`${side}:${i}`)) continue; // ausgebrochene Steine
      const cells = y === 0 ? [[1, FINE], [2, `${FINE_STAIRS}[facing=${inward[side]},half=bottom]`]] : [[1, `${FINE_STAIRS}[facing=${inward[side]},half=bottom]`]];
      for (const [offset, state] of cells) {
        const pos = { north: [i, lo - offset], south: [i, hi + offset], west: [lo - offset, i], east: [hi + offset, i] }[side];
        b.set(pos[0], y, pos[1], state);
      }
    }
  }
}

function buildSummit(b, geo, y) {
  const { lo, hi } = geo.span[y];
  const mid = Math.floor((lo + hi) / 2);
  const stones = geo.s >= 1 ? [[mid - 2, mid - 1], [mid - 1, mid - 1], [mid - 2, mid], [mid + 1, mid + 2]] : [[mid, mid]];
  for (const [x, z] of stones) b.set(x, y + 1, z, b.pickWeighted(CORE_MIX));
}
