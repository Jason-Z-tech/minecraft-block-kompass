// Brandenburger Tor, Berlin – Nachbau nach echten Maßen.
// Recherche, Maße und Quellen: docs/recherche/brandenburger-tor.md
// Lage wie im Original: Tor quer zur Ost-West-Achse, Stadtseite (Pariser Platz, Torhäuser, Quadriga-Blick) im Osten (+x).

export const meta = {
  id: 'brandenburger-tor',
  title: 'Brandenburger Tor',
  category: 'wahrzeichen',
  subtitle: 'Frühklassizistisches Stadttor mit Quadriga in Berlin',
  tags: ['Berlin', 'Deutschland', 'Tor', 'Klassizismus', 'Säulen', 'Quadriga', 'Pariser Platz', 'Maßstab 1:1'],
  aliases: [
    'brandenburger tor', 'brandenburgertor', 'brandenburger-tor', 'brandenburg gate', 'brandenburger gate',
    'berliner tor', 'tor berlin', 'quadriga', 'pariser platz', 'langhans', 'schadow', 'branderburger tor',
    'brandenburgertor berlin', 'porte de brandebourg',
  ],
  accuracy: 'massstab',
  description: 'Das Brandenburger Tor im Maßstab 1:1 mit seinen zwölf dorischen Säulen (sechs auf jeder Seite), fünf '
    + 'Durchfahrten mit breiterer Mitte, Gebälk mit Triglyphen und Metopen, gestufter Attika und der Quadriga obenauf. '
    + 'Seitlich schließen die beiden Säulenhallen und die Torhäuser mit Giebeln zum Pariser Platz an, wie im heutigen Bestand. '
    + 'Die Quadriga ist als vereinfachte Block-Skulptur gebaut; Maße der Seitenflügel stammen aus OpenStreetMap-Umrissen.',
  sources: [
    { title: 'Wikipedia (de): Brandenburger Tor', url: 'https://de.wikipedia.org/wiki/Brandenburger_Tor' },
    { title: 'Wikipedia (en): Brandenburg Gate', url: 'https://en.wikipedia.org/wiki/Brandenburg_Gate' },
    { title: 'OpenStreetMap: Brandenburger Tor (Way 518071791 und 3D-Bauteile, ODbL)', url: 'https://www.openstreetmap.org/way/518071791' },
    { title: 'berlin.de: Brandenburger Tor', url: 'https://www.berlin.de/sehenswuerdigkeiten/3560266-3558930-brandenburger-tor.html' },
  ],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

const SAND = 'smooth_sandstone';
const SAND_CUT = 'cut_sandstone';
const SAND_RELIEF = 'chiseled_sandstone';
const SAND_STAIRS = 'smooth_sandstone_stairs';
const SAND_SLAB = 'smooth_sandstone_slab';
const COLUMN = 'bone_block[axis=y]';
const GRANITE = 'polished_andesite';
const PAVING = 'smooth_stone';
const PAVING_LINE = 'polished_andesite';
const ROOF = 'smooth_stone_slab';
const PATINA = 'waxed_oxidized_copper';
const PATINA_CUT = 'waxed_oxidized_cut_copper';
const PATINA_STAIRS = 'waxed_oxidized_cut_copper_stairs';
const PATINA_ROD = 'waxed_oxidized_lightning_rod';

export default function build(b, { scale = 1 } = {}) {
  if (scale === 1) buildFull(b);
  else if (scale === 0.5) buildHalf(b);
  else throw new Error(`Maßstab ${scale} wird nicht unterstützt (erlaubt: 1 und 0,5).`);
}

// ---------- Hilfen ----------

// Baut die Nordhälfte und spiegelt sie an der Torachse (z = −0,5 bei geraden Breiten, z = 0 bei ungeraden).
function bothHalves(b, fn, { even = true } = {}) {
  fn();
  b.transform({ offset: [0, 0, even ? -1 : 0], mirror: 'z' }, fn);
}

function hangLantern(b, x, y, z, chain) {
  for (let i = 1; i <= chain; i++) b.set(x, y - i, z, 'iron_chain[axis=y]');
  b.set(x, y - chain - 1, z, 'lantern[hanging=true]');
}

// ---------- Maßstab 1 ----------

// Querwände des Mittelbaus (Nordhälfte): [z1, z2]; Durchfahrten liegen dazwischen.
const PIERS = [[-17, -16], [-11, -10], [-5, -4]];
const PASSAGES = [[-15, -12], [-9, -6], [-3, -1]];
const GATE_Z1 = -17;
const COL_X = [[-5, -4], [3, 4]];
const WALL_X = [-3, 2];
const ARCHITRAVE_X = [-5, 4];
const CORNICE_X = [-6, 5];

function buildFull(b) {
  b.phase('Platz und Fundament');
  buildSite(b);

  b.phase('Säulen und Querwände');
  buildColumnsAndPiers(b);

  b.phase('Gebälk');
  buildEntablature(b);

  b.phase('Attika');
  buildAttic(b);

  b.phase('Quadriga (vereinfacht)');
  buildQuadriga(b);

  b.phase('Säulenhallen');
  buildHalls(b);

  b.phase('Torhäuser');
  buildGatehouses(b);

  b.phase('Fenster und Türen');
  buildGatehouseOpenings(b);

  b.phase('Einrichtung und Licht');
  buildInteriorFull(b);

  b.phase('Umgebung');
  buildSurroundingsFull(b);
}

function buildSite(b) {
  b.fill(-11, 0, -36, 28, 0, 35, PAVING);
  for (let x = -11; x <= 28; x += 6) b.fill(x, 0, -36, x, 0, 35, PAVING_LINE);
  for (let z = -36; z <= 35; z += 6) b.fill(-11, 0, z, 28, 0, z, PAVING_LINE);
  // Torachse betonen
  b.fill(-11, 0, -3, 28, 0, 2, 'stone_bricks');
  // Böden der Torhäuser gleich mitlegen
  bothHalves(b, () => b.fill(HOUSE.x1 + 1, 0, HOUSE.z1 + 1, HOUSE.x2 - 1, 0, HOUSE.z2 - 1, 'birch_planks'));
}

function buildColumnsAndPiers(b) {
  bothHalves(b, () => {
    for (const [z1, z2] of PIERS) {
      // Querwand
      b.fill(WALL_X[0], 1, z1, WALL_X[1], 1, z2, SAND_CUT);
      b.fill(WALL_X[0], 2, z1, WALL_X[1], 13, z2, SAND);
      // Säulen vorn und hinten
      for (const [x1, x2] of COL_X) {
        b.fill(x1, 1, z1, x2, 1, z2, GRANITE);
        b.fill(x1, 2, z1, x2, 12, z2, COLUMN);
        b.fill(x1, 13, z1, x2, 13, z2, SAND_CUT);
      }
    }
    // Relieffelder an den Wandseiten zu den Durchfahrten
    for (const [z1, z2] of PIERS) {
      for (const z of [z1, z2]) {
        const facesPassage = PASSAGES.some(([p1, p2]) => z === p1 - 1 || z === p2 + 1);
        if (!facesPassage) continue;
        b.fill(-2, 6, z, 1, 8, z, SAND_RELIEF);
        b.fill(-2, 5, z, 1, 5, z, SAND_CUT);
        b.fill(-2, 9, z, 1, 9, z, SAND_CUT);
      }
    }
  });
}

function buildEntablature(b) {
  bothHalves(b, () => {
    const [ax1, ax2] = ARCHITRAVE_X;
    b.fill(ax1, 14, GATE_Z1, ax2, 14, -1, SAND);
    // Fries: Triglyphen und Metopen im Wechsel auf allen Außenseiten
    b.fill(ax1, 15, GATE_Z1, ax2, 15, -1, SAND);
    for (let z = GATE_Z1; z <= -1; z++) {
      const triglyph = (z - GATE_Z1) % 2 === 0;
      b.set(ax1, 15, z, triglyph ? SAND_CUT : SAND_RELIEF);
      b.set(ax2, 15, z, triglyph ? SAND_CUT : SAND_RELIEF);
    }
    for (let x = ax1; x <= ax2; x++) b.set(x, 15, GATE_Z1, (x - ax1) % 2 === 0 ? SAND_CUT : SAND_RELIEF);
    // Kranzgesims
    const [cx1, cx2] = CORNICE_X;
    b.fill(ax1, 16, GATE_Z1, ax2, 16, -1, SAND);
    for (let z = GATE_Z1 - 1; z <= -1; z++) {
      b.stairs(cx1, 16, z, SAND_STAIRS, { facing: 'east', half: 'top' });
      b.stairs(cx2, 16, z, SAND_STAIRS, { facing: 'west', half: 'top' });
    }
    for (let x = ax1; x <= ax2; x++) b.stairs(x, 16, GATE_Z1 - 1, SAND_STAIRS, { facing: 'south', half: 'top' });
  });
}

function buildAttic(b) {
  bothHalves(b, () => {
    // seitliche Teile, nach außen und zu den Enden in Stufen zurückgesetzt
    b.fill(-4, 17, GATE_Z1, 3, 17, -6, SAND_CUT);
    b.fill(-3, 18, GATE_Z1 + 1, 2, 18, -6, SAND_CUT);
    b.fill(-3, 19, GATE_Z1 + 2, 2, 19, -6, SAND_CUT);
    // Mittelblock mit Relief
    b.fill(-5, 17, -5, 4, 20, -1, SAND);
    b.fill(4, 17, -4, 4, 19, -1, SAND_RELIEF);
    b.fill(-5, 18, -4, -5, 18, -1, SAND_RELIEF);
    // Deckgesims des Mittelblocks
    for (let z = -6; z <= -1; z++) {
      b.stairs(-6, 20, z, SAND_STAIRS, { facing: 'east', half: 'top' });
      b.stairs(5, 20, z, SAND_STAIRS, { facing: 'west', half: 'top' });
    }
    for (let x = -5; x <= 4; x++) b.stairs(x, 20, -6, SAND_STAIRS, { facing: 'south', half: 'top' });
  });
}

function buildQuadriga(b) {
  b.step();
  for (const z of [-4, -2, 1, 3]) {
    const outer = z === -4 || z === 3;
    const headZ = outer ? z + Math.sign(z) : z;
    for (const x of [-1, 2]) {
      b.set(x, 21, z, `${PATINA_ROD}[facing=up]`);
      b.set(x, 22, z, `${PATINA_ROD}[facing=up]`);
    }
    b.stairs(-2, 23, z, PATINA_STAIRS, { facing: 'east', half: 'top' });
    b.set(-1, 23, z, PATINA_CUT);
    b.fill(0, 23, z, 2, 23, z, PATINA);
    b.set(2, 24, z, PATINA_CUT);
    if (outer) b.set(2, 25, z, PATINA_CUT);
    b.set(2, 25, headZ, PATINA_CUT);
    b.stairs(3, 25, headZ, PATINA_STAIRS, { facing: 'west', half: 'top' });
  }
  b.step();
  b.fill(-4, 21, -1, -3, 22, 0, PATINA_CUT);
  for (const z of [-1, 0]) b.stairs(-2, 22, z, PATINA_STAIRS, { facing: 'west', half: 'bottom' });
  for (const [z, facing] of [[-2, 'north'], [1, 'south']]) {
    for (const x of [-4, -3]) {
      b.set(x, 21, z, `waxed_oxidized_copper_trapdoor[facing=${facing},half=bottom,open=true]`);
      b.set(x, 22, z, `waxed_oxidized_copper_trapdoor[facing=${facing},half=bottom,open=true]`);
    }
  }
  b.step();
  b.fill(-4, 23, -1, -4, 24, 0, PATINA);
  b.set(-4, 25, -1, PATINA_CUT);
  b.stairs(-4, 25, 0, PATINA_STAIRS, { facing: 'north', half: 'bottom' });
  // Flügel seitlich am Körper (Fläche an Fläche, sonst ließen sie sich im Spiel nicht ansetzen)
  b.stairs(-4, 24, -2, PATINA_STAIRS, { facing: 'south', half: 'bottom' });
  b.stairs(-4, 24, 1, PATINA_STAIRS, { facing: 'north', half: 'bottom' });
  b.stairs(-4, 25, -2, PATINA_STAIRS, { facing: 'north', half: 'top' });
  b.stairs(-4, 25, 1, PATINA_STAIRS, { facing: 'south', half: 'top' });
  for (let y = 23; y <= 24; y++) b.set(-3, y, 1, `${PATINA_ROD}[facing=up]`);
  b.set(-3, 25, 1, 'waxed_oxidized_copper_grate');
  b.set(-3, 26, 1, 'waxed_oxidized_chiseled_copper');
}

// Säulenhalle (Nordseite, z −33 … −18), offen nach Westen und Norden.
const HALL_Z = [-33, -18];
const HALL_COL_Z = [-18, -22, -25, -29, -32];
const HALL_INNER_Z = [-22, -29];

function buildHalls(b) {
  b.step();
  bothHalves(b, () => {
    const columns = [];
    for (const z of HALL_COL_Z) columns.push([-5, z], [4, z]);
    for (const z of HALL_INNER_Z) columns.push([-2, z], [1, z]);
    columns.push([-2, -32], [1, -32]);
    for (const [x, z] of columns) {
      b.set(x, 1, z, GRANITE);
      b.fill(x, 2, z, x, 8, z, COLUMN);
      b.set(x, 9, z, SAND_CUT);
    }
    b.fill(-3, 1, -18, 2, 9, -18, SAND);
  });
  b.step();
  bothHalves(b, () => {
    b.fill(-5, 10, HALL_Z[0], 4, 10, HALL_Z[1], SAND);
    b.fill(-5, 11, HALL_Z[0], 4, 11, HALL_Z[1], SAND_CUT);
    for (let z = HALL_Z[0]; z <= HALL_Z[1]; z++) b.stairs(-6, 11, z, SAND_STAIRS, { facing: 'east', half: 'top' });
    for (let x = -6; x <= 4; x++) b.stairs(x, 11, HALL_Z[0] - 1, SAND_STAIRS, { facing: 'south', half: 'top' });
    b.fill(-4, 12, HALL_Z[0], 4, 12, HALL_Z[1], ROOF);
  });
}

// Torhaus (Nordseite): Kern x 8 … 20, z −29 … −22; Säulen auf x 7 … 22, z −31 und −20.
const HOUSE = { x1: 8, x2: 20, z1: -29, z2: -22, cx: [7, 11, 15, 18, 22], cz: [-31, -20], front: [-31, -27, -24, -20], rx2: 23 };

function buildGatehouses(b) {
  b.step();
  bothHalves(b, () => {
    const { x1, x2, z1, z2 } = HOUSE;
    b.walls(x1, 1, z1, x2, 1, z2, SAND_CUT);
    b.walls(x1, 2, z1, x2, 9, z2, SAND);
  });
  b.step();
  bothHalves(b, () => {
    const cols = [];
    for (const x of HOUSE.cx) for (const z of HOUSE.cz) cols.push([x, z]);
    for (const z of HOUSE.front) cols.push([22, z]);
    for (const [x, z] of cols) {
      b.set(x, 1, z, GRANITE);
      b.fill(x, 2, z, x, 8, z, COLUMN);
      b.set(x, 9, z, SAND_CUT);
    }
  });
  b.step();
  bothHalves(b, () => {
    const zA = HOUSE.cz[0];
    const zB = HOUSE.cz[1];
    b.fill(5, 10, zA, HOUSE.rx2 - 1, 10, zB, SAND);
    for (let x = 6; x <= 22; x++) {
      if ((x - 6) % 2 === 1) {
        b.set(x, 10, zA, SAND_RELIEF);
        b.set(x, 10, zB, SAND_RELIEF);
      }
    }
    b.fill(5, 11, zA, HOUSE.rx2 - 1, 11, zB, SAND_CUT);
    for (let x = 5; x <= HOUSE.rx2; x++) {
      b.stairs(x, 11, zA - 1, SAND_STAIRS, { facing: 'south', half: 'top' });
      b.stairs(x, 11, zB + 1, SAND_STAIRS, { facing: 'north', half: 'top' });
    }
    for (let z = zA; z <= zB; z++) b.stairs(HOUSE.rx2, 11, z, SAND_STAIRS, { facing: 'west', half: 'top' });
    // flaches Dach: Traufen unten, Mitte oben
    for (let z = zA - 1; z <= zB + 1; z++) {
      const middle = z >= zA + 3 && z <= zB - 3;
      b.fill(5, 12, z, HOUSE.rx2 - 1, 12, z, `${ROOF}[type=${middle ? 'top' : 'bottom'}]`);
    }
    // Giebel zur Stadt
    for (let z = zA + 1; z <= zB - 1; z++) {
      const middle = z >= zA + 3 && z <= zB - 3;
      b.set(HOUSE.rx2, 12, z, middle ? SAND : `${SAND_SLAB}[type=bottom]`);
    }
    b.set(HOUSE.rx2, 12, (zA + zB) / 2 - 0.5, SAND_RELIEF);
    b.set(HOUSE.rx2, 12, (zA + zB) / 2 + 0.5, SAND_RELIEF);
  });
}

function buildGatehouseOpenings(b) {
  bothHalves(b, () => {
    const { x1, x2, z1, z2 } = HOUSE;
    // Doppeltür im Osten
    b.door(x2, 1, -26, 'birch_door', { facing: 'west', hinge: 'right' });
    b.door(x2, 1, -25, 'birch_door', { facing: 'west', hinge: 'left' });
    b.set(x2, 3, -26, SAND_RELIEF);
    b.set(x2, 3, -25, SAND_RELIEF);
    // hohe Fenster an den Langseiten
    for (const z of [z1, z2]) {
      for (const x of [x1 + 4, x2 - 4]) {
        b.fill(x, 3, z, x, 6, z, 'glass_pane');
        b.set(x, 7, z, SAND_CUT);
      }
    }
  });
}

function buildInteriorFull(b) {
  b.step();
  bothHalves(b, () => {
    for (const [z1] of PASSAGES) {
      const z = z1 === -3 ? -1 : z1 + 1;
      hangLantern(b, -3, 14, z, 2);
      hangLantern(b, 2, 14, z, 2);
    }
    for (const z of [-20, -27, -31]) hangLantern(b, -1, 10, z, 1);
    hangLantern(b, 2, 10, -24, 1);
    for (const z of [-30, -21]) for (const x of [10, 17]) hangLantern(b, x, 10, z, 1);
    for (const z of [-28, -23]) hangLantern(b, 21, 10, z, 1);
  });
  b.step();
  const { x1, x2, z1, z2 } = HOUSE;
  for (const x of [11, 13, 15]) {
    for (const z of [-28, -27, -24, -23]) b.stairs(x, 1, z, 'birch_stairs', { facing: 'east', half: 'bottom' });
  }
  b.fill(x1 + 1, 1, -26, x1 + 1, 1, -25, 'stripped_birch_wood');
  b.set(x1 + 1, 2, -26, 'white_candle[candles=3,lit=true]');
  b.set(x1 + 1, 2, -25, 'white_candle[candles=2,lit=true]');
  for (const [x, z] of [[10, -27], [10, -24], [17, -27], [17, -24]]) hangLantern(b, x, 10, z, 2);
  b.fill(x1 + 2, 1, -26, x2 - 1, 1, -25, 'light_gray_carpet');
  for (const [x, z] of [[x2 - 1, z1 + 1], [x2 - 1, z2 - 1]]) b.set(x, 1, z, 'potted_azalea_bush');
  b.step();
  b.transform({ offset: [0, 0, -1], mirror: 'z' }, () => {
    for (let z = -27; z <= -24; z++) b.stairs(13, 1, z, 'birch_stairs', { facing: 'west', half: 'top' });
    b.fill(x1 + 1, 1, z1 + 1, x1 + 1, 3, z2 - 1, 'bookshelf');
    b.set(17, 1, -28, 'lectern[facing=east]');
    b.set(x2 - 1, 1, z2 - 1, 'potted_fern');
    for (const [x, z] of [[10, -27], [10, -24], [17, -27], [17, -24]]) hangLantern(b, x, 10, z, 2);
  });
}

function buildSurroundingsFull(b) {
  bothHalves(b, () => {
    for (const [x, z] of [[-9, -8], [-9, -20], [26, -8], [26, -16], [12, -12]]) {
      for (let y = 1; y <= 3; y++) b.set(x, y, z, 'polished_blackstone_wall');
      b.set(x, 4, z, 'lantern[hanging=false]');
    }
    for (const [z1, z2] of PIERS) {
      b.set(7, 1, z1, 'stone_brick_wall');
      b.set(-8, 1, z1, 'stone_brick_wall');
      if (z2 !== z1) {
        b.set(7, 1, z2, 'stone_brick_wall');
        b.set(-8, 1, z2, 'stone_brick_wall');
      }
    }
  });
}

// ---------- Maßstab 0,5 ----------

function buildHalf(b) {
  b.phase('Platz und Fundament');
  b.fill(-6, 0, -18, 14, 0, 18, PAVING);
  b.fill(-6, 0, -1, 14, 0, 1, 'stone_bricks');

  const piers = [-8, -5, -2];
  b.phase('Säulen und Querwände');
  bothHalves(b, () => {
    for (const z of piers) {
      b.set(-1, 1, z, SAND_CUT); b.set(0, 1, z, SAND_CUT); b.set(1, 1, z, SAND_CUT);
      b.fill(-1, 2, z, 1, 7, z, SAND);
      if (z !== -8) b.set(0, 4, z, SAND_RELIEF);
      for (const x of [-2, 2]) {
        b.set(x, 1, z, GRANITE);
        b.fill(x, 2, z, x, 6, z, COLUMN);
        b.set(x, 7, z, SAND_CUT);
      }
    }
  }, { even: false });

  b.phase('Gebälk und Attika');
  bothHalves(b, () => {
    b.fill(-2, 8, -8, 2, 8, 0, SAND);
    for (let z = -8; z <= 0; z++) {
      const t = (z + 8) % 2 === 0;
      b.set(-2, 8, z, t ? SAND_CUT : SAND_RELIEF);
      b.set(2, 8, z, t ? SAND_CUT : SAND_RELIEF);
    }
    for (let z = -9; z <= 0; z++) {
      b.stairs(-3, 8, z, SAND_STAIRS, { facing: 'east', half: 'top' });
      b.stairs(3, 8, z, SAND_STAIRS, { facing: 'west', half: 'top' });
    }
    for (let x = -2; x <= 2; x++) b.stairs(x, 8, -9, SAND_STAIRS, { facing: 'south', half: 'top' });
    b.fill(-1, 9, -7, 1, 9, -3, SAND_CUT);
    b.fill(-1, 10, -6, 1, 10, -3, SAND_CUT);
    b.fill(-2, 9, -2, 2, 10, 0, SAND);
    b.set(2, 9, -1, SAND_RELIEF);
    b.set(2, 9, 0, SAND_RELIEF);
  }, { even: false });

  b.phase('Quadriga (vereinfacht)');
  // Je Pferd: zwei Beine, Körper aus zwei Blöcken, erhobener Kopf mit Maul (umgedrehte Treppe) nach Osten.
  for (const z of [-2, -1, 1, 2]) {
    for (const x of [0, 1]) b.set(x, 11, z, `${PATINA_ROD}[facing=up]`);
    b.set(0, 12, z, PATINA);
    b.set(1, 12, z, PATINA_CUT);
    b.set(1, 13, z, PATINA_CUT);
    b.stairs(2, 13, z, PATINA_STAIRS, { facing: 'west', half: 'top' });
  }
  b.set(-1, 11, 0, PATINA_CUT);
  b.set(-1, 12, 0, PATINA);
  b.set(-1, 13, 0, `${PATINA_ROD}[facing=up]`);

  b.phase('Seitenflügel');
  bothHalves(b, () => {
    for (const z of [-9, -11, -13, -16]) for (const x of [-2, 2]) {
      b.set(x, 1, z, GRANITE);
      b.fill(x, 2, z, x, 4, z, COLUMN);
    }
    b.fill(-2, 5, -16, 2, 5, -9, SAND);
    b.fill(-1, 6, -16, 1, 6, -9, ROOF);
    // Torhaus
    b.walls(4, 1, -15, 10, 4, -11, SAND);
    for (const x of [3, 5, 7, 9, 11]) for (const z of [-16, -10]) {
      b.set(x, 1, z, GRANITE);
      b.fill(x, 2, z, x, 4, z, COLUMN);
    }
    b.fill(3, 5, -16, 11, 5, -10, SAND_CUT);
    b.fill(3, 6, -16, 11, 6, -10, ROOF);
    b.fill(3, 6, -14, 11, 6, -12, `${ROOF}[type=top]`);
    b.set(11, 6, -13, SAND_RELIEF);
    b.door(10, 1, -13, 'birch_door', { facing: 'west', hinge: 'left' });
  }, { even: false });

  b.phase('Licht');
  // Ein Schritt statt Ebenen: sonst käme die Laterne im Torhaus vor ihrer Kette dran.
  b.step();
  hangLantern(b, 0, 8, 0, 0);
  bothHalves(b, () => {
    hangLantern(b, 0, 8, -7, 0);
    hangLantern(b, 0, 8, -4, 0);
    for (const z of [-10, -14]) hangLantern(b, 0, 5, z, 0);
    hangLantern(b, 7, 5, -13, 1);
    for (const [x, z] of [[3, -13], [11, -13], [4, -16], [8, -16], [6, -10], [10, -10]]) hangLantern(b, x, 5, z, 0);
  }, { even: false });
}
