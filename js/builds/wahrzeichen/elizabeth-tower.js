// Elizabeth Tower (Big Ben), London – Nachbau nach echten Maßen.
// Recherche, Maße und Quellen: docs/recherche/elizabeth-tower.md

export const meta = {
  id: 'elizabeth-tower',
  title: 'Elizabeth Tower (Big Ben)',
  category: 'wahrzeichen',
  subtitle: 'Uhrturm am Palace of Westminster in London',
  tags: ['London', 'England', 'Großbritannien', 'Uhrturm', 'Turm', 'Neugotik', 'Glocken', 'Maßstab 1:1'],
  aliases: [
    'big ben', 'bigben', 'big-ben', 'elizabeth tower', 'elisabeth tower', 'elizabeth turm', 'elisabethturm',
    'clock tower', 'uhrturm london', 'londoner uhrturm', 'westminster', 'palace of westminster',
    'parlament london', 'great clock', 'westminster clock', 'st stephens tower', 'big ben london',
  ],
  accuracy: 'massstab',
  description: 'Der 96 m hohe Uhrturm des britischen Parlaments im Maßstab 1:1: quadratischer Schaft aus hellem '
    + 'Kalkstein mit Lisenen, Spitzbogenfenstern und Gesimsen, darüber das Uhrengeschoss mit vier 7-m-Zifferblättern, '
    + 'die Glockenstube mit der großen Glocke und den vier Viertelstunden-Glocken und der gusseiserne Spitzhelm mit '
    + 'Gauben, Ayrton-Laterne und Kreuzblume. Innen führt eine Wendeltreppe bis in die Uhrenstube. Die Höhen der oberen '
    + 'Bauteile stammen aus dem 3D-Modell von OpenStreetMap und sind deshalb Schätzungen.',
  sources: [
    { title: 'Wikipedia (en): Big Ben', url: 'https://en.wikipedia.org/wiki/Big_Ben' },
    { title: 'Wikipedia (de): Elizabeth Tower', url: 'https://de.wikipedia.org/wiki/Elizabeth_Tower' },
    { title: 'OpenStreetMap: Elizabeth Tower (Way 123557148 und 3D-Bauteile, ODbL)', url: 'https://www.openstreetmap.org/way/123557148' },
    { title: 'Civic Trust Awards: Elizabeth Tower (Restaurierung 2017–2022)', url: 'https://www.civictrustawards.org.uk/winners/elizabeth-tower' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

// Höhen in Ebenen (Ebene 0 = Pflaster, ein Bauteil bis h m über dem Boden endet auf Ebene h · scale).
const LEVELS = {
  1: {
    hw: 6, plinthTop: 7, bands: [8, 21, 35], shaftTop: 47, corbel: 48, stageTop: 60,
    dialY: 56, dialR: 3, frameHalf: 4, inscription: 51, cornice: 61, belfry: [62, 65],
    roof: [[66, 5], [67, 4], [68, 4], [69, 4], [70, 3], [71, 3], [72, 3]],
    lantern: [73, 76], lanternHalf: 2, spire: [[77, 1], [78, 1], [79, 1], [80, 1], [81, 1], [82, 1], [83, 1]], spireThin: [84, 89], orb: 90, top: 96,
    windows: [10, 16, 24, 30, 38, 44], plaza: 11,
  },
  0.5: {
    hw: 3, plinthTop: 4, bands: [10, 17], shaftTop: 23, corbel: 24, stageTop: 30,
    dialY: 28, dialR: 1, frameHalf: 2, inscription: 25, cornice: 31, belfry: [32, 33],
    roof: [[34, 2], [35, 1]],
    lantern: [36, 38], lanternHalf: 1, spire: [], spireThin: [39, 45], orb: 46, top: 48,
    windows: [6, 12, 19], plaza: 7,
  },
};

const STONE = 'cut_sandstone';
const STRIP = 'smooth_sandstone';
const ACCENT = 'chiseled_sandstone';
const STONE_STAIRS = 'smooth_sandstone_stairs';
const IRON_ROOF = 'deepslate_tiles';
const IRON_STAIRS = 'deepslate_tile_stairs';
const GOLD = 'gold_block';
const GILT_TIP = 'yellow_candle[candles=1,lit=false]';
const COLONNETTE = 'sandstone_wall';
const PRUSSIAN_BLUE = 'blue_concrete';
const DIAL = 'white_concrete';

export default function build(b, { scale = 1 } = {}) {
  const L = LEVELS[scale];
  if (!L) throw new Error(`Maßstab ${scale} wird nicht unterstützt (erlaubt: 1 und 0,5).`);
  const detail = scale === 1;

  b.phase('Fundament und Platz');
  buildPlaza(b, L);

  b.phase('Sockel');
  buildPlinth(b, L, detail);

  b.phase('Turmschaft');
  buildShaft(b, L, detail);

  b.phase('Uhrengeschoss');
  buildStage(b, L, detail);

  b.phase('Zifferblätter');
  buildDials(b, L, detail);

  b.phase('Glockenstube');
  buildBelfry(b, L, detail);

  b.phase('Gusseiserner Helm');
  buildRoof(b, L, detail);

  b.phase('Ayrton-Laterne und Spitze');
  buildLanternAndSpire(b, L, detail);

  if (detail) {
    b.phase('Einrichtung');
    buildInterior(b, L);
  }

  b.phase(detail ? 'Eingang und Umgebung' : 'Umgebung');
  buildEntranceAndSurroundings(b, L, detail);
}

// ---------- Hilfen ----------

// Zeichnet etwas auf allen vier Seiten: fn baut die Nordseite (z negativ), gedreht um die Turmmitte.
function onFourSides(b, fn) {
  for (const rotate of [0, 90, 180, 270]) b.transform({ rotate }, fn);
}

function isStrip(x) {
  return Math.abs(x) % 3 === 0;
}

function fillSquare(b, y, half, state) {
  b.fill(-half, y, -half, half, y, half, state);
}

// Ring mit Abstand r um die Mitte: Stufen mit der hohen Seite zur Mitte.
function stairRing(b, y, r, id, half = 'bottom', inward = true) {
  onFourSides(b, () => {
    for (let x = -r; x < r; x++) b.stairs(x, y, -r, id, { facing: inward ? 'south' : 'north', half });
  });
}

// Weg der Wendeltreppe: quadratischer Ring, Start Mitte Nordseite, im Uhrzeigersinn.
function ringPath(r) {
  const cells = [];
  for (let x = 0; x < r; x++) cells.push([x, -r]);
  for (let z = -r; z < r; z++) cells.push([r, z]);
  for (let x = r; x > -r; x--) cells.push([x, r]);
  for (let z = r; z > -r; z--) cells.push([-r, z]);
  for (let x = -r; x < 0; x++) cells.push([x, -r]);
  return cells;
}

function directionBetween([x1, z1], [x2, z2]) {
  if (x2 > x1) return 'east';
  if (x2 < x1) return 'west';
  return z2 > z1 ? 'south' : 'north';
}

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

// ---------- Bauteile ----------

function buildPlaza(b, L) {
  const p = L.plaza;
  b.fill(-p, 0, -p, p, 0, p, 'polished_andesite');
  b.walls(-p, 0, -p, p, 0, p, 'stone_bricks');
  b.fill(-L.hw - 1, 0, -L.hw - 1, L.hw + 1, 0, L.hw + 1, 'smooth_stone');
}

function buildPlinth(b, L, detail) {
  const { hw } = L;
  // abgeschrägte Sockelkante
  stairRing(b, 1, hw + 1, STONE_STAIRS);
  for (let y = 1; y <= L.plinthTop; y++) {
    onFourSides(b, () => {
      for (let x = -hw; x < hw; x++) {
        if (x === -hw) {
          b.set(x, y, -hw, STRIP);
          continue;
        }
        b.set(x, y, -hw + 1, STONE);
        b.set(x, y, -hw, isStrip(x) ? STRIP : STONE);
      }
    });
    // Maßstab 1: Kern aus Ziegeln, rundherum bleibt der Gang für die Wendeltreppe frei
    if (detail) fillSquare(b, y, hw - 3, 'bricks');
    else fillSquare(b, y, hw - 2, STONE);
  }
}

function buildShaft(b, L, detail) {
  const { hw } = L;
  const path = detail ? ringPath(hw - 2) : null;
  const firstY = L.plinthTop + 1;
  for (let y = firstY; y <= L.shaftTop; y++) {
    const band = L.bands.includes(y);
    onFourSides(b, () => {
      for (let x = -hw; x < hw; x++) {
        if (x === -hw) {
          b.set(x, y, -hw, STRIP);
          continue;
        }
        if (isStrip(x)) {
          b.set(x, y, -hw, STRIP);
          b.set(x, y, -hw + 1, STRIP);
        } else {
          b.set(x, y, -hw + 1, STONE);
          if (band) b.stairs(x, y, -hw, STONE_STAIRS, { facing: 'south', half: 'top' });
        }
      }
    });
    if (!detail) fillSquare(b, y, hw - 2, STONE);
    else fillSquare(b, y, hw - 3, 'bricks');
  }
  buildShaftWindows(b, L, detail);
  // Wendeltreppe (Maßstab 1): ab Ebene 1 bis zum Boden der Uhrenstube; die ersten Stufen liegen im Sockel.
  if (detail) buildSpiralStairs(b, L, path);
}

function buildShaftWindows(b, L, detail) {
  const { hw } = L;
  const panels = detail ? [[-5, -4, false], [-2, -1, true], [1, 2, true], [4, 5, false]] : [[-2, -1, false], [1, 2, false]];
  const height = detail ? 3 : 2;
  onFourSides(b, () => {
    for (const y0 of L.windows) {
      for (const [x1, x2, glazed] of panels) {
        if (glazed) b.fill(x1, y0, -hw + 1, x2, y0 + height - 1, -hw + 1, 'glass_pane');
        else b.fill(x1, y0, -hw + 1, x2, y0, -hw + 1, ACCENT);
        // Spitzbogen: zwei umgedrehte Stufen, volle Seite außen
        b.stairs(x1, y0 + height, -hw, STONE_STAIRS, { facing: 'west', half: 'top' });
        b.stairs(x2, y0 + height, -hw, STONE_STAIRS, { facing: 'east', half: 'top' });
      }
    }
  });
}

function buildSpiralStairs(b, L, path) {
  const n = path.length;
  for (let i = 0; i < L.corbel - 1; i++) {
    const y = 1 + i;
    const cell = path[i % n];
    const facing = directionBetween(cell, path[(i + 1) % n]);
    b.stairs(cell[0], y, cell[1], 'stone_brick_stairs', { facing, half: 'bottom' });
    if (y > 1) b.stairs(cell[0], y - 1, cell[1], 'stone_brick_stairs', { facing: OPPOSITE[facing], half: 'top' });
    // Wandfackel an der Lisene, zwei Ebenen über der Stufe
    const [x, z] = cell;
    const onMiddle = (x === 0 && Math.abs(z) === L.hw - 2) || (z === 0 && Math.abs(x) === L.hw - 2);
    if (onMiddle && y + 2 <= L.shaftTop) {
      const facingAway = z < 0 ? 'south' : z > 0 ? 'north' : x < 0 ? 'east' : 'west';
      b.set(x, y + 2, z, `wall_torch[facing=${facingAway}]`);
    }
  }
}

function buildStage(b, L, detail) {
  const { hw } = L;
  // Kragsims: umgedrehte Stufen in den Feldern, Lisenen laufen durch
  onFourSides(b, () => {
    for (let x = -hw; x < hw; x++) {
      if (x === -hw) {
        b.set(x, L.corbel, -hw, STRIP);
        continue;
      }
      b.set(x, L.corbel, -hw + 1, STONE);
      if (isStrip(x)) b.set(x, L.corbel, -hw, STRIP);
      else b.stairs(x, L.corbel, -hw, STONE_STAIRS, { facing: 'south', half: 'top' });
    }
  });
  if (detail) {
    fillSquare(b, L.corbel, hw - 1, 'dark_oak_planks');
    openStairwell(b, L);
  } else {
    fillSquare(b, L.corbel, hw - 2, STONE);
  }
  for (let y = L.corbel + 1; y <= L.stageTop; y++) {
    onFourSides(b, () => {
      for (let x = -hw; x < hw; x++) {
        const corner = x === -hw;
        b.set(x, y, -hw, corner || isStrip(x) ? STRIP : STONE);
      }
    });
    if (!detail) fillSquare(b, y, hw - 1, STONE);
  }
  // Inschrift-Band unter dem Zifferblatt
  onFourSides(b, () => {
    const half = L.frameHalf - 1;
    b.fill(-half, L.inscription, -hw, half, L.inscription, -hw, PRUSSIAN_BLUE);
    b.set(-half - 1, L.inscription, -hw, ACCENT);
    b.set(half + 1, L.inscription, -hw, ACCENT);
    if (detail) for (let x = -half; x <= half; x += 2) b.set(x, L.inscription, -hw, GOLD);
  });
  // Kranzgesims
  stairRing(b, L.cornice, hw + 1, STONE_STAIRS, 'top');
  fillSquare(b, L.cornice, hw, STRIP);
  if (detail) fillSquare(b, L.cornice, hw - 1, 'dark_oak_planks');
}

// Letzte Stufe liegt im Boden der Uhrenstube; über den zwei Stufen davor bleibt der Boden offen (Kopffreiheit).
function openStairwell(b, L) {
  const path = ringPath(L.hw - 2);
  const n = path.length;
  const last = L.corbel - 1;
  const cell = path[last % n];
  b.stairs(cell[0], L.corbel, cell[1], 'stone_brick_stairs', { facing: directionBetween(cell, path[(last + 1) % n]), half: 'bottom' });
  b.stairs(cell[0], L.corbel - 1, cell[1], 'stone_brick_stairs', { facing: OPPOSITE[directionBetween(cell, path[(last + 1) % n])], half: 'top' });
  for (let i = last - 2; i < last; i++) {
    const [x, z] = path[i % n];
    b.remove(x, L.corbel, z);
  }
}

function buildDials(b, L, detail) {
  const { hw, dialY, dialR, frameHalf } = L;
  // Drehung je Seite: Nord, Ost, Süd, West
  const sides = [0, 90, 180, 270];
  for (const rotate of sides) {
    b.step();
    b.transform({ rotate }, () => {
      const z = -hw;
      for (let dy = -dialR; dy <= dialR; dy++) {
        for (let dx = -dialR; dx <= dialR; dx++) {
          const inDisc = dx * dx + dy * dy <= (dialR + 0.5) * (dialR + 0.5);
          b.set(dx, dialY + dy, z, inDisc ? DIAL : GOLD);
        }
      }
      if (detail) {
        for (const [dx, dy] of [[0, 3], [3, 0], [0, -3], [-3, 0]]) b.set(dx, dialY + dy, z, PRUSSIAN_BLUE);
        b.set(0, dialY + 1, z, PRUSSIAN_BLUE);
        b.set(0, dialY + 2, z, PRUSSIAN_BLUE);
        // von außen gesehen liegt -x rechts: kurzer Zeiger auf 3 Uhr
        b.set(-1, dialY, z, PRUSSIAN_BLUE);
        b.set(0, dialY, z, GOLD);
      } else {
        b.set(0, dialY, z, GOLD);
        b.set(0, dialY + 1, z, PRUSSIAN_BLUE);
        b.set(-1, dialY, z, PRUSSIAN_BLUE);
      }
      // vorstehender Rahmen
      const f = frameHalf;
      for (let d = -f; d <= f; d++) {
        for (const [x, y] of [[d, dialY - f], [d, dialY + f], [-f, dialY + d], [f, dialY + d]]) {
          const corner = Math.abs(x) === f && Math.abs(y - dialY) === f;
          b.set(x, y, z - 1, corner ? GOLD : STRIP);
        }
      }
      if (detail) {
        // schlanke Säulchen neben dem Rahmen
        for (let y = dialY - f; y <= dialY + f - 1; y++) {
          b.set(-f - 1, y, z - 1, COLONNETTE);
          b.set(f + 1, y, z - 1, COLONNETTE);
        }
      }
    });
  }
}

function buildBelfry(b, L, detail) {
  const { hw } = L;
  const [y1, y2] = L.belfry;
  const bw = hw - 1;
  // Umgang, Brüstung, Eckfialen
  onFourSides(b, () => {
    for (let x = -hw + 1; x < hw; x++) b.set(x, y1, -hw, 'sandstone_wall');
    b.set(-hw, y1, -hw, ACCENT);
    if (detail) b.set(-hw, y1 + 1, -hw, 'sandstone_wall');
    b.set(-hw, y1 + (detail ? 2 : 1), -hw, GILT_TIP);
  });
  // Wände mit Spitzbogen-Öffnungen
  const openings = detail ? [[-4, -3], [-1, 1], [3, 4]] : [[-1, 1]];
  for (let y = y1; y <= y2; y++) {
    onFourSides(b, () => {
      for (let x = -bw; x < bw; x++) {
        const open = y < y2 && openings.some(([a, c]) => x >= a && x <= c);
        b.set(x, y, -bw, open ? 'iron_bars' : STRIP);
      }
    });
  }
  onFourSides(b, () => {
    for (const [a, c] of openings) {
      if (c - a >= 1) {
        b.stairs(a, y2, -bw, STONE_STAIRS, { facing: 'west', half: 'top' });
        b.stairs(c, y2, -bw, STONE_STAIRS, { facing: 'east', half: 'top' });
        for (let x = a + 1; x < c; x++) b.set(x, y2, -bw, 'iron_bars');
      }
    }
    // vergoldete Pfeilerköpfe
    for (let x = -bw + 1; x < bw; x++) {
      const pier = !openings.some(([a, c]) => x >= a && x <= c);
      if (pier && detail) b.set(x, y2, -bw, GOLD);
    }
  });
  if (!detail) fillSquare(b, y1, bw - 1, STONE);
  if (!detail) fillSquare(b, y2, bw - 1, STONE);
  if (detail) {
    for (const z of [-3, 0, 3]) b.fill(-bw + 1, y2, z, bw - 1, y2, z, 'dark_oak_log[axis=x]');
  }
}

function buildRoof(b, L, detail) {
  stepped(b, L.roof, L.lanternHalf);
  if (detail) {
    // Gauben: untere Reihe 4 je Seite, obere Reihe 3 je Seite, jede mit vergoldeter Spitze
    onFourSides(b, () => {
      for (const x of [-3, -1, 1, 3]) {
        b.set(x, 67, -5, IRON_ROOF);
        b.set(x, 68, -5, GILT_TIP);
      }
      for (const x of [-2, 0, 2]) {
        b.set(x, 70, -4, IRON_ROOF);
        b.set(x, 71, -4, GILT_TIP);
      }
    });
  }
}

// Gestufte Pyramide: jede Lage voll, wo die nächste schmaler wird, ein Stufenring mit der hohen Seite zur Mitte.
function stepped(b, layers, halfAbove) {
  layers.forEach(([y, half], i) => {
    fillSquare(b, y, half, IRON_ROOF);
    const nextHalf = i + 1 < layers.length ? layers[i + 1][1] : halfAbove;
    if (nextHalf < half) stairRing(b, y, half, IRON_STAIRS);
  });
}

function buildLanternAndSpire(b, L, detail) {
  const [y1, y2] = L.lantern;
  const h = L.lanternHalf;
  b.step();
  fillSquare(b, y1, h, IRON_ROOF);
  for (let y = y1 + 1; y < y2; y++) {
    onFourSides(b, () => {
      b.set(-h, y, -h, GOLD);
      for (let x = -h + 1; x < h; x++) b.set(x, y, -h, 'glass_pane');
    });
    b.set(0, y, 0, 'sea_lantern');
  }
  // Deckel der Laterne, daraus wächst die Spitze
  fillSquare(b, y2, h, IRON_ROOF);
  stairRing(b, y2, h, IRON_STAIRS);
  b.step();
  if (detail) buildSpireDetail(b, L);
  else stepped(b, L.spire, 0);
  const [t1, t2] = L.spireThin;
  for (let y = t1; y <= t2; y++) b.set(0, y, 0, 'deepslate_tile_wall');
  // Kugel, Hals und Kreuz
  b.step();
  b.set(0, L.orb, 0, GOLD);
  const neckTop = detail ? L.orb + 2 : L.top;
  for (let y = L.orb + 1; y <= neckTop; y++) b.set(0, y, 0, 'iron_chain[axis=y]');
  for (let y = neckTop + 1; y <= L.top; y++) b.set(0, y, 0, GOLD);
  if (detail) {
    b.set(1, L.top - 1, 0, GOLD);
    b.set(-1, L.top - 1, 0, GOLD);
  }
}

// Spitze bei Maßstab 1: drei Ebenen „achteckig“ (Mauern an den Ecken), Goldband, Treppenkranz, dann ein Block breit.
function buildSpireDetail(b, L) {
  const y1 = L.spire[0][0];
  const y2 = L.spire[L.spire.length - 1][0];
  const crown = y1 + 3;
  const arms = [[0, -1, 'south'], [1, 0, 'west'], [0, 1, 'north'], [-1, 0, 'east']];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let y = y1; y <= y2; y++) {
    b.set(0, y, 0, IRON_ROOF);
    if (y >= crown) continue;
    for (const [x, z] of arms) b.set(x, y, z, y === y1 + 1 ? GOLD : IRON_ROOF);
    for (const [x, z] of corners) b.set(x, y, z, 'deepslate_tile_wall');
  }
  for (const [x, z, facing] of arms) b.stairs(x, crown, z, IRON_STAIRS, { facing, half: 'bottom' });
  for (const [x, z] of corners) b.set(x, crown, z, GILT_TIP);
}

function buildInterior(b, L) {
  const floor = L.corbel;
  b.step();
  // Pendel im Schacht unter dem Uhrwerk
  b.set(0, floor - 4, 0, 'iron_block');
  for (let y = floor - 3; y <= floor; y++) b.set(0, y, 0, 'iron_chain[axis=y]');
  // Uhrwerk
  b.fill(-2, floor + 1, -1, 2, floor + 1, 1, 'polished_blackstone');
  b.set(-1, floor + 2, 0, 'grindstone[face=wall,facing=north]');
  b.set(1, floor + 2, 0, 'grindstone[face=wall,facing=north]');
  b.set(0, floor + 2, 0, 'iron_block');
  b.set(0, floor + 3, 0, 'iron_block');
  b.step();
  for (let y = floor + 4; y < L.dialY; y++) b.set(0, y, 0, 'iron_chain[axis=y]');
  b.set(0, L.dialY, 0, 'iron_block');
  for (let d = 1; d <= L.hw - 1; d++) {
    b.set(d, L.dialY, 0, 'iron_chain[axis=x]');
    b.set(-d, L.dialY, 0, 'iron_chain[axis=x]');
    b.set(0, L.dialY, d, 'iron_chain[axis=z]');
    b.set(0, L.dialY, -d, 'iron_chain[axis=z]');
  }
  b.step();
  // Laternen in der Uhrenstube
  for (const [x, z] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) b.set(x, L.stageTop, z, 'lantern[hanging=true]');
  b.set(3, floor + 1, -3, 'lantern[hanging=false]');
  // Leiter in die Glockenstube
  const [y1, y2] = L.belfry;
  for (let y = floor + 1; y < L.cornice; y++) b.fill(-5, y, 4, -5, y, 5, 'bricks');
  // Die Leiter endet im Boden der Glockenstube: darüber liegt ein Gitterfenster, an dem keine Leiter hält.
  for (let y = floor + 1; y < y1; y++) b.set(-4, y, 4, 'ladder[facing=east]');
  // Glocken
  b.step();
  // Glockenkörper: oben Haube mit Schultern, unten weiter Schlagring, innen hohl mit Klöppel
  b.set(0, y2 - 1, 0, 'waxed_exposed_cut_copper');
  for (const [dx, dz, facing] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) {
    b.stairs(dx, y2 - 1, dz, 'waxed_exposed_cut_copper_stairs', { facing, half: 'top' });
  }
  b.walls(-1, y2 - 2, -1, 1, y2 - 2, 1, 'waxed_exposed_cut_copper');
  b.set(0, y2 - 2, 0, 'iron_chain[axis=y]');
  for (const [x, z] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) b.set(x, y2 - 1, z, 'bell[attachment=ceiling,facing=north]');
  for (const [x, z] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) b.set(x, y2 - 1, z, 'lantern[hanging=true]');
}

function buildEntranceAndSurroundings(b, L, detail) {
  const { hw, plaza } = L;
  const doorZ = detail ? hw - 1 : hw;
  // Eingang Südseite
  if (detail) {
    b.remove(0, 1, hw);
    b.remove(0, 2, hw);
    b.set(0, 3, hw, ACCENT);
    b.remove(0, 1, hw + 1);
    b.door(0, 1, doorZ, 'dark_oak_door', { facing: 'north', hinge: 'left' });
    b.set(-1, 3, hw + 1, 'lantern[hanging=false]');
    b.set(1, 3, hw + 1, 'lantern[hanging=false]');
    b.set(0, 3, hw - 2, 'wall_torch[facing=north]');
    b.stairs(-1, 2, hw + 1, STONE_STAIRS, { facing: 'north', half: 'top' });
    b.stairs(1, 2, hw + 1, STONE_STAIRS, { facing: 'north', half: 'top' });
  }
  // Laternenmasten
  const lamp = plaza - 1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx * lamp;
    const z = sz * lamp;
    const postTop = detail ? 3 : 2;
    for (let y = 1; y <= postTop; y++) b.set(x, y, z, 'polished_blackstone_wall');
    b.set(x, postTop + 1, z, 'lantern[hanging=false]');
  }
  // Eisengeländer am Platzrand, mit Lücke vor dem Eingang
  for (let d = -plaza + 1; d <= plaza - 1; d++) {
    for (const [x, z] of [[d, -plaza], [d, plaza], [-plaza, d], [plaza, d]]) {
      if (z === plaza && Math.abs(x) <= 2) continue;
      b.set(x, 1, z, 'iron_bars');
    }
  }
}
