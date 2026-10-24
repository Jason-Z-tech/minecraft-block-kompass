// Japanisches Wohnhaus: Holzständerhaus (13 × 9) mit Engawa, Irimoya-Dach (unten Walm, oben Giebel) und Garten.
// Bau-Rahmen: Hauswände x 0 … 12, z 0 … 8, Engawa im Süden (z 9 … 10) und Osten (x 13 … 14),
// Fußboden auf y = 0 (Raum ab y = 1), Gelände (Gras) auf y = −1.

import { tree, bush, pond, rock, vegetation, isPlantId, lightRoom, hangingLantern } from '../lib/index.js';

export const meta = {
  id: 'japanisches-wohnhaus',
  title: 'Japanisches Wohnhaus',
  category: 'haeuser',
  subtitle: 'Holzhaus mit Engawa, geschwungenem Ziegeldach, Teich und Kirschbaum',
  tags: ['Japan', 'Asiatisch', 'Holzhaus', 'Engawa', 'Veranda', 'Tatami', 'Shoji', 'Irimoya', 'Teich', 'Kirschbaum', 'Garten', 'Steinlaterne', 'Bambus'],
  aliases: [
    'japanisches haus', 'japan haus', 'japanhaus', 'japanisches wohnhaus', 'japanisches holzhaus', 'japanischer stil', 'asiatisches haus',
    'minka', 'japanese house', 'japanese home', 'traditional japanese house', 'japanese style house',
    'asian house', 'japanisches hous', 'japanishes haus', 'japanisches hus', 'sakura haus', 'kirschblüten haus', 'zen haus', 'zen garten',
  ],
  accuracy: 'nachempfunden',
  difficulty: 3,
  description: 'Ein traditionelles japanisches Wohnhaus aus dunklen Holzständern und hellen Wandfeldern, an der Süd- und Ostseite mit einer Engawa-Veranda und Schiebetüren aus Birkenfalltüren. Das Irimoya-Dach aus Tiefenschieferziegeln ist unten abgewalmt, oben ein kleiner Giebel, und an den vier Ecken leicht hochgezogen. Innen liegen Tatami aus geschältem Bambus, ein Wohnraum mit Feuerstelle und Bildnische, ein Schlafraum mit Futons und eine kleine Küche. Draußen warten Teich mit Steg, Kirschbaum, Steinlaternen, Kiesgarten und ein Bambushain.',
  facts: [
    'Haus 13 × 9 Blöcke, mit Engawa 15 × 11, Dach 17 × 13 Blöcke; der First liegt 11 Blöcke über dem Boden.',
    'Irimoya heißt das typische Dach mit Walm unten und kleinem Giebeldreieck oben – hier mit drei Walm-Reihen und einem Giebel darüber.',
    'Die Shoji-Optik entsteht aus offenen Birkenfalltüren, die flach in den Türöffnungen hängen; die Gitterfenster sind offene Bambusfalltüren.',
    'Die Tatami sind Reihen aus geschältem Bambusblock, deren Richtung von Matte zu Matte wechselt.',
    'Jedes begehbare Feld im Haus hat Blocklicht über 0: Laternen hängen an den Querbalken, die Feuerstelle leuchtet mit.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const POST = 'stripped_dark_oak_log';
const POST_WOOD = 'stripped_dark_oak_wood';
const RAFTER = 'stripped_spruce_log';
const PANEL = 'smooth_quartz';
const BAND = 'spruce_planks';
const TATAMI = 'stripped_bamboo_block';
const TILE = { stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'deepslate_tiles', wall: 'deepslate_tile_wall' };

const BODY = { x0: 0, x1: 12, z0: 0, z1: 8 };
const WALL_TOP = 5; // Rähm (Ringbalken) auf y = 5
const ENGAWA = { x1: 14, z1: 10 };
const ROOF = { x0: -2, x1: 14, z0: -2, z1: 10, y: 4, gable: 3 };
const RIDGE_K = Math.floor((ROOF.z1 - ROOF.z0) / 2);
const GROUND = { x0: -8, x1: 34, z0: -10, z1: 20 };
const POND = { x: 17, z: 4, width: 13, depth: 10 };
const DOCK_Z = 8;
const LANTERNS = [[13, 14], [16, 2], [31, 10]];
const BODY_POSTS_X = [0, 4, 8, 12];
const BODY_POSTS_Z = [0, 4, 8];
const ENGAWA_POSTS = [[0, 10], [4, 10], [8, 10], [12, 10], [14, 10], [14, 8], [14, 4], [14, 0]];

const log = (id, axis) => `${id}[axis=${axis}]`;

// --------------------------------------------------------------- Dach-Geometrie

// Reihe des Irimoya-Dachs: an den Schmalseiten (Westen/Osten) Walm bis Reihe gable − 1, darüber Giebel.
function roofLevel(x, z) {
  const dx = Math.min(x - ROOF.x0, ROOF.x1 - x);
  const dz = Math.min(z - ROOF.z0, ROOF.z1 - z);
  return dx >= ROOF.gable ? dz : Math.min(dx, dz);
}

function inRoof(x, z) {
  return x >= ROOF.x0 && x <= ROOF.x1 && z >= ROOF.z0 && z <= ROOF.z1;
}

// Treppe zeigt mit der hohen Seite zur höheren Nachbarreihe; Walm-Ecken im Windrad (ergibt Außenecken).
function roofState(x, z) {
  const k = roofLevel(x, z);
  if (k === RIDGE_K) return TILE.full;
  const dirs = [['north', 0, -1], ['south', 0, 1], ['west', -1, 0], ['east', 1, 0]];
  const up = dirs.filter(([, dx, dz]) => inRoof(x + dx, z + dz) && roofLevel(x + dx, z + dz) > k);
  let facing;
  if (up.length > 0) facing = up[0][0];
  else {
    const west = x < (ROOF.x0 + ROOF.x1) / 2;
    const north = z < (ROOF.z0 + ROOF.z1) / 2;
    if (north) facing = west ? 'south' : 'west';
    else facing = west ? 'east' : 'north';
  }
  return `${TILE.stairs}[facing=${facing},half=bottom]`;
}

function roofRing(b, k, filter = () => true) {
  for (let x = ROOF.x0; x <= ROOF.x1; x++) {
    for (let z = ROOF.z0; z <= ROOF.z1; z++) {
      if (roofLevel(x, z) === k && filter(x, z)) b.set(x, ROOF.y + k, z, roofState(x, z));
    }
  }
}

// Zellen des Giebeldreiecks bei x = gx: unter den Giebeltreppen, ab y = ROOF.y + gable.
function gableCells(gx) {
  const cells = [];
  for (let z = ROOF.z0; z <= ROOF.z1; z++) {
    const top = ROOF.y + roofLevel(gx, z) - 1;
    for (let y = ROOF.y + ROOF.gable; y <= top; y++) cells.push([gx, y, z]);
  }
  return cells;
}

// --------------------------------------------------------------- Bauplatz und Fundament

function site(b) {
  b.phase('Bauplatz', 'Such dir eine ebene Wiese von etwa 43 × 31 Blöcken. Das Haus steht im Westen, südöstlich davor kommt später der Teich hin, dahinter ein Bambushain.');
  b.step('Wiese', 'Die ebene Grasfläche, auf der Haus und Garten liegen.');
  b.fill(GROUND.x0, -1, GROUND.z0, GROUND.x1, -1, GROUND.z1, 'grass_block');
}

function foundation(b) {
  b.phase('Fundament', 'Japanische Häuser stehen auf einzelnen Steinen: die Holzständer berühren den Boden nicht direkt. Darauf liegen die Schwellen, die den Grundriss vorgeben.', {
    tips: ['Setz zuerst die vier Ecksteine (13 × 9 Blöcke Außenmaß) und zähl dann die Zwischensteine ab – alle 4 Blöcke einer.'],
  });
  b.step('Fundamentsteine', 'Ersetze an jeder Ständer-Stelle den Grasblock durch polierten Andesit: am Haus alle 4 Blöcke (Ecken bei x 0/12, z 0/8), dazu einen in der Hausmitte für die Innenwand und die Steine unter den Verandapfosten am Süd- und Ostrand (2 Blöcke vor der Wand).');
  const stones = [];
  for (const x of BODY_POSTS_X) for (const z of [BODY.z0, BODY.z1]) stones.push([x, z]);
  for (const z of BODY_POSTS_Z) for (const x of [BODY.x0, BODY.x1]) stones.push([x, z]);
  stones.push([8, 4], ...ENGAWA_POSTS);
  for (const [x, z] of stones) b.set(x, -1, z, 'polished_andesite');

  b.step('Ständerfüße und Schwellen', 'Auf jeden Hausstein kommt ein entrindeter Schwarzeichenstamm (stehend). Dazwischen legst du Schwellen aus liegenden Stämmen – klick immer auf die Seite des Nachbarstamms, dann liegen sie in Wandrichtung. Unter der Innenwand (x = 8 und z = 4) liegen ebenfalls Schwellen.');
  for (const x of BODY_POSTS_X) for (const z of [BODY.z0, BODY.z1]) b.set(x, 0, z, log(POST, 'y'));
  for (const z of BODY_POSTS_Z) for (const x of [BODY.x0, BODY.x1]) b.set(x, 0, z, log(POST, 'y'));
  b.set(8, 0, 4, log(POST, 'y'));
  for (let x = BODY.x0 + 1; x < BODY.x1; x++) {
    for (const z of [BODY.z0, BODY.z1]) if (!BODY_POSTS_X.includes(x)) b.set(x, 0, z, log(POST, 'x'));
  }
  for (let z = BODY.z0 + 1; z < BODY.z1; z++) {
    for (const x of [BODY.x0, BODY.x1]) if (!BODY_POSTS_Z.includes(z)) b.set(x, 0, z, log(POST, 'z'));
    if (z !== 4) b.set(8, 0, z, log(POST, 'z'));
  }
  for (let x = 9; x <= 11; x++) b.set(x, 0, 4, log(POST, 'x'));
}

// Tatami: Reihen aus geschältem Bambus, Richtung je Matte wechselnd (Windrad um die Feuerstelle).
function tatami(b, x1, z1, x2, z2, axis) {
  for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) b.set(x, 0, z, log(TATAMI, axis));
}

function floors(b) {
  b.phase('Böden', 'Jetzt füllst du den Grundriss: Tatami im Wohn- und Schlafraum, festgestampfter Lehm in der Küche und Holzdielen auf der Veranda.', {
    tips: ['Geschälten Bambusblock legst du wie Stämme: klick auf die Seite eines Nachbarblocks, dann liegt er in diese Richtung. So entsteht das Mattenmuster.'],
  });
  b.step('Feuerstelle (Irori)', 'In die Mitte des Wohnraums (Westteil) kommt ein Lagerfeuer direkt in die Bodenebene, ringsum 8 glatte Steinstufen (untere Hälfte). So liegt die Glut etwas tiefer als die Matten.');
  for (let x = 3; x <= 5; x++) for (let z = 3; z <= 5; z++) b.set(x, 0, z, 'smooth_stone_slab[type=bottom]');
  b.set(4, 0, 4, 'campfire[facing=south,lit=true]');

  b.step('Tatami im Wohnraum', 'Vier Mattenfelder im Windrad um die Feuerstelle: Norden (5 × 2) und Süden (5 × 2) mit Bambus in Ost-West-Richtung, Westen und Osten (2 × 5) in Nord-Süd-Richtung. Vor der Nordwand links bleiben 3 Felder für die Bildnische: dort liegen Schwarzeichenbretter.');
  tatami(b, 1, 1, 5, 2, 'x');
  tatami(b, 6, 1, 7, 5, 'z');
  tatami(b, 3, 6, 7, 7, 'x');
  tatami(b, 1, 3, 2, 7, 'z');
  for (let x = 1; x <= 3; x++) b.set(x, 0, 1, 'dark_oak_planks');

  b.step('Schlafraum und Küche', 'Im Nordosten (3 × 3) Tatami in Nord-Süd-Richtung, die Mitte quer. In der Küche im Südosten (3 × 3) liegt fester Schlamm als Lehmboden.');
  for (let z = 1; z <= 3; z++) {
    b.set(9, 0, z, log(TATAMI, 'z'));
    b.set(10, 0, z, log(TATAMI, 'x'));
    b.set(11, 0, z, log(TATAMI, 'z'));
  }
  for (let x = 9; x <= 11; x++) for (let z = 5; z <= 7; z++) b.set(x, 0, z, 'packed_mud');

  b.step('Engawa-Boden', 'Die Veranda läuft 2 Blöcke breit an der Süd- und Ostseite entlang. Setz Fichtenholzstufen in die obere Blockhälfte (klick auf die obere Hälfte der Schwelle) – so liegt die Veranda auf Höhe des Fußbodens und darunter bleibt ein Schattenspalt. Die Felder mit Fundamentsteinen bleiben frei für die Pfosten.');
  const isPost = (x, z) => ENGAWA_POSTS.some(([px, pz]) => px === x && pz === z);
  for (let x = BODY.x0; x <= ENGAWA.x1; x++) {
    for (let z = BODY.z0; z <= ENGAWA.z1; z++) {
      const onEngawa = z > BODY.z1 || x > BODY.x1;
      if (onEngawa && !isPost(x, z)) b.set(x, 0, z, 'spruce_slab[type=top]');
    }
  }
}

// --------------------------------------------------------------- Ständer, Balken, Wände

function frame(b) {
  b.phase('Ständer und Balken', 'Das Gerüst aus dunklen Schwarzeichenstämmen trägt Dach und Veranda. Die Wände füllst du erst danach.');
  b.step('Hausständer', 'Verlängere jeden Ständerfuß um 4 Stämme nach oben (bis y = 4), auch den Innenständer in der Mitte der Innenwand.');
  for (const x of BODY_POSTS_X) for (const z of [BODY.z0, BODY.z1]) b.fill(x, 1, z, x, 4, z, log(POST, 'y'));
  for (const z of BODY_POSTS_Z) for (const x of [BODY.x0, BODY.x1]) b.fill(x, 1, z, x, 4, z, log(POST, 'y'));
  b.fill(8, 1, 4, 8, 4, 4, log(POST, 'y'));

  b.step('Rähm', 'Oben auf die Ständer kommt ringsum ein Rahmen aus liegenden Stämmen (y = 5). Die vier Ecken sind entrindetes Schwarzeichenholz (Rinde auf allen Seiten), damit die Ecke sauber aussieht.');
  for (let x = BODY.x0 + 1; x < BODY.x1; x++) for (const z of [BODY.z0, BODY.z1]) b.set(x, WALL_TOP, z, log(POST, 'x'));
  for (let z = BODY.z0 + 1; z < BODY.z1; z++) for (const x of [BODY.x0, BODY.x1]) b.set(x, WALL_TOP, z, log(POST, 'z'));
  for (const x of [BODY.x0, BODY.x1]) for (const z of [BODY.z0, BODY.z1]) b.set(x, WALL_TOP, z, `${POST_WOOD}[axis=y]`);

  b.step('Querbalken', 'Vier Balken spannen von der Nord- zur Südwand (y = 5) bei x = 1, 4, 8 und 11. An den mittleren hängen später die Laternen, die äußeren tragen die Giebeldreiecke.');
  for (const x of [1, 4, 8, 11]) for (let z = BODY.z0 + 1; z < BODY.z1; z++) b.set(x, WALL_TOP, z, log(POST, 'z'));

  b.step('Verandapfosten und Pfette', 'Auf die Steine am Verandarand kommen Pfosten, 3 Stämme hoch (y = 0 … 2). Darüber verbindet eine liegende Pfette (y = 3) alle Pfosten und läuft an beiden Enden bis zur Hauswand zurück.');
  for (const [x, z] of ENGAWA_POSTS) b.fill(x, 0, z, x, 2, z, log(POST, 'y'));
  for (let x = BODY.x0; x < ENGAWA.x1; x++) b.set(x, 3, ENGAWA.z1, log(POST, 'x'));
  for (let z = BODY.z0; z < ENGAWA.z1; z++) b.set(ENGAWA.x1, 3, z, log(POST, 'z'));
  b.set(ENGAWA.x1, 3, ENGAWA.z1, `${POST_WOOD}[axis=y]`);
  b.set(BODY.x0, 3, BODY.z1 + 1, log(POST, 'z'));
  b.set(BODY.x1 + 1, 3, BODY.z0, log(POST, 'x'));
}

// Öffnungen in den Außenwänden: [x, z, yMin, yMax]
const SHOJI_SOUTH = [1, 2, 3, 5, 6, 7];
const SHOJI_EAST = [1, 2, 3];
const WINDOWS = [[6, 0], [10, 0], [0, 2], [0, 6], [12, 6]];
const DOOR = [10, 8];

function isOpening(x, y, z) {
  if (z === BODY.z1 && SHOJI_SOUTH.includes(x) && y <= 3) return true;
  if (x === BODY.x1 && SHOJI_EAST.includes(z) && y <= 3) return true;
  if (WINDOWS.some(([wx, wz]) => wx === x && wz === z) && (y === 2 || y === 3)) return true;
  if (x === DOOR[0] && z === DOOR[1] && y <= 2) return true;
  return false;
}

function forEachWallCell(fn) {
  for (let x = BODY.x0; x <= BODY.x1; x++) {
    for (let z = BODY.z0; z <= BODY.z1; z++) {
      const edge = x === BODY.x0 || x === BODY.x1 || z === BODY.z0 || z === BODY.z1;
      const post = (BODY_POSTS_X.includes(x) && (z === BODY.z0 || z === BODY.z1)) || (BODY_POSTS_Z.includes(z) && (x === BODY.x0 || x === BODY.x1));
      if (edge && !post) fn(x, z);
    }
  }
}

function walls(b) {
  b.phase('Wände', 'Die Felder zwischen den Ständern: unten eine Reihe Fichtenbretter, darüber helle Wandfelder aus glattem Quarz. Lass die Öffnungen für Schiebetüren, Fenster und Haustür frei.', {
    tips: [
      'Offen bleiben: im Süden die zwei westlichen Felder ganz (je 3 breit, 3 hoch), im Osten das nördliche Feld (3 breit, 3 hoch), die Haustür bei x = 10 im Süden (2 hoch) und fünf Fenster (1 breit, 2 hoch, über der Bretterreihe).',
      'Statt glattem Quarz gehen auch weißer Beton oder Kalzit.',
    ],
  });
  b.step('Bretterreihe', 'Eine Reihe Fichtenholzbretter direkt auf den Schwellen (y = 1), außer in den Schiebetür-Öffnungen und der Tür.');
  forEachWallCell((x, z) => { if (!isOpening(x, 1, z)) b.set(x, 1, z, BAND); });
  b.step('Helle Wandfelder', 'Darüber bis unter den Rähm (y = 2 … 4) glatter Quarz. Über den Schiebetüren und der Tür ist das Wandfeld nur einen bzw. zwei Blöcke hoch.');
  forEachWallCell((x, z) => {
    for (let y = 2; y <= 4; y++) if (!isOpening(x, y, z)) b.set(x, y, z, PANEL);
  });
}

// --------------------------------------------------------------- Dach

function roof(b) {
  b.phase('Dach', 'Das Irimoya-Dach aus Tiefenschieferziegeln: unten läuft ein Walm rundum (3 Reihen), darüber steht ein Satteldach mit kleinen Giebeldreiecken im Westen und Osten. Es steht 2 Blöcke über – im Süden und Osten liegt die Traufe auf der Verandapfette.', {
    tips: [
      'Bau das Dach von innen nach außen: zuerst die Reihe auf dem Rähm, dann die Reihe daneben, dann die Sparren und zuletzt die Traufe – so hat jeder Block einen Nachbarn, an den du ihn setzen kannst.',
      'Alle Treppen zeigen mit der hohen Seite nach innen (zum First). Stell dich außen hin und schau beim Setzen zur Hausmitte.',
      'An den Walm-Ecken bilden sich die Außenecken von selbst, wenn die Ecktreppe zur selben Seite schaut wie die Reihe, in die sie hineinläuft.',
    ],
  });
  b.step('Erste Dachreihe', 'Ein Ring aus Tiefenschieferziegeltreppen direkt auf dem Rähm (y = 6), 13 × 9 Blöcke.');
  roofRing(b, 2);
  b.step('Zweite Reihe', 'Eine Reihe weiter außen und eine Ebene tiefer (y = 5): du setzt die Treppen an die Seite des Rähms.');
  roofRing(b, 1);
  b.step('Sparrenköpfe', 'Unter die zweite Reihe kommen auf y = 4 kurze Sparren aus entrindetem Fichtenstamm, quer zur Wand und mit je einem Block Abstand; die Ecken sind ganze Holzblöcke. Von unten sieht man später die typischen Sparren unter dem Vordach.');
  rafters(b);
  b.step('Traufe', 'Die äußerste Reihe (y = 4) setzt du an die Sparren. Im Süden und Osten liegt sie auf der Verandapfette.');
  roofRing(b, 0);

  b.step('Giebelbalken', 'Über die äußeren Querbalken (x = 1 und x = 11) legst du eine zweite Balkenlage (y = 6). Darauf stehen gleich die Giebeldreiecke.');
  for (const x of [1, 11]) for (let z = BODY.z0 + 1; z < BODY.z1; z++) b.set(x, 6, z, log(POST, 'z'));
  b.step('Giebeldreiecke', 'Die kleinen Giebel im Westen und Osten (5 breit, 3 hoch): unten ein liegender Balken, in der Mitte ein stehender, die beiden Felder daneben glatter Quarz.');
  for (const gx of [1, 11]) {
    for (const [x, y, z] of gableCells(gx)) {
      if (y === ROOF.y + ROOF.gable) b.set(x, y, z, log(POST, 'z'));
      else if (z === (ROOF.z0 + ROOF.z1) / 2) b.set(x, y, z, log(POST, 'y'));
      else b.set(x, y, z, PANEL);
    }
  }
  b.step('Dachflächen', 'Die Reihen 4 bis 6 des Satteldachs (y = 7 … 9) laufen von Giebel zu Giebel (x = 1 … 11). Fang jede Reihe am Giebeldreieck an.');
  for (let k = ROOF.gable; k < RIDGE_K; k++) roofRing(b, k);
  b.step('First', 'Der First (y = 10) ist eine Reihe ganzer Tiefenschieferziegel. Obendrauf liegt eine Tiefenschieferziegelmauer, an beiden Enden schließt je eine Treppe mit der hohen Seite nach außen ab (wie die Zierziegel japanischer Dächer).');
  roofRing(b, RIDGE_K);
  const ridgeZ = (ROOF.z0 + ROOF.z1) / 2;
  const ridgeX0 = ROOF.x0 + ROOF.gable;
  const ridgeX1 = ROOF.x1 - ROOF.gable;
  const capY = ROOF.y + RIDGE_K + 1;
  for (let x = ridgeX0 + 1; x < ridgeX1; x++) b.set(x, capY, ridgeZ, TILE.wall);
  b.stairs(ridgeX0, capY, ridgeZ, TILE.stairs, { facing: 'west' });
  b.stairs(ridgeX1, capY, ridgeZ, TILE.stairs, { facing: 'east' });

  b.step('Hochgezogene Ecken', 'Auf jede der vier Traufecken kommt eine weitere Treppe, deren hohe Ecke schräg nach außen zeigt. So biegen sich die Dachecken nach oben. Wichtig: Von selbst formt sich diese Treppe nicht zur Ecke, weil neben ihr keine andere Treppe liegt – sie bleibt gerade. Im Kreativmodus stellst du sie mit dem Debug-Stab auf „outer_right“ (Linksklick wählt die Eigenschaft „shape“, Rechtsklick schaltet ihren Wert weiter). Im Überlebensmodus setzt du sie gerade mit der hohen Seite nach außen oder lässt den Schritt weg.');
  const tips = [
    [ROOF.x0, ROOF.z0, 'west'], [ROOF.x1, ROOF.z0, 'north'], [ROOF.x1, ROOF.z1, 'east'], [ROOF.x0, ROOF.z1, 'south'],
  ];
  for (const [x, z, facing] of tips) b.set(x, ROOF.y + 1, z, `${TILE.stairs}[facing=${facing},half=bottom,shape=outer_right]`, { raw: true });
}

// Sparren unter Ring 1, quer zur Wand, jeder zweite; Ecken als Holzblock.
function rafters(b) {
  const y = ROOF.y;
  const xa = ROOF.x0 + 1;
  const xb = ROOF.x1 - 1;
  const za = ROOF.z0 + 1;
  const zb = ROOF.z1 - 1;
  for (let x = xa; x <= xb; x++) {
    for (const z of [za, zb]) {
      if (x === xa || x === xb) b.set(x, y, z, `${POST_WOOD}[axis=y]`);
      else if (x % 2 === 0) b.set(x, y, z, log(RAFTER, 'z'));
    }
  }
  for (let z = za + 1; z < zb; z++) {
    for (const x of [xa, xb]) if (z % 2 === 0) b.set(x, y, z, log(RAFTER, 'x'));
  }
}

// --------------------------------------------------------------- Türen und Fenster

// Offene Falltür liegt an der Seite gegenüber ihrem facing: für die Außenkante also facing nach innen.
function shutterFacing(x, z) {
  if (z === BODY.z0) return 'south';
  if (z === BODY.z1) return 'north';
  return x === BODY.x0 ? 'east' : 'west';
}

function openings(b) {
  b.phase('Schiebetüren, Fenster und Haustür', 'Jetzt kommen die typischen hellen Gitterflächen in die Öffnungen.', {
    tips: ['Setzt du eine Falltür auf den Boden, liegt sie aufgeklappt flach an der Seite, zu der du beim Setzen geschaut hast. Stell dich also innen vor die Öffnung, schau nach draußen, setz die Falltür auf den Block darunter und klapp sie mit Rechtsklick auf – dann liegt sie an der Außenkante.'],
  });
  b.step('Shoji-Schiebetüren', 'In die zwei großen Öffnungen der Südwand (je 3 × 3) und die Öffnung der Ostwand kommen offene Birkenholzfalltüren, flach an der Außenkante. Ihr Gittermuster sieht aus wie Papier-Schiebetüren.');
  for (const x of SHOJI_SOUTH) for (let y = 1; y <= 3; y++) b.set(x, y, BODY.z1, 'birch_trapdoor[facing=north,half=bottom,open=true]');
  for (const z of SHOJI_EAST) for (let y = 1; y <= 3; y++) b.set(BODY.x1, y, z, 'birch_trapdoor[facing=west,half=bottom,open=true]');

  b.step('Gitterfenster', 'Die fünf kleinen Fenster (je 1 breit, 2 hoch) bekommen offene Bambusfalltüren an der Außenkante – das ergibt ein Bambusgitter.');
  for (const [x, z] of WINDOWS) {
    const facing = shutterFacing(x, z);
    for (const y of [2, 3]) b.set(x, y, z, `bamboo_trapdoor[facing=${facing},half=bottom,open=true]`);
  }

  b.step('Haustür und Noren', 'Die Bambustür sitzt in der Südwand bei x = 10, mit Blick nach Norden gesetzt (öffnet nach innen). Darüber hängt außen ein blaues Banner als Noren-Vorhang, davor liegt ein Trittstein aus glatter Steinstufe.');
  b.door(DOOR[0], 1, DOOR[1], 'bamboo_door', { facing: 'north', hinge: 'left' });
  b.set(DOOR[0], 3, DOOR[1] + 1, 'blue_wall_banner[facing=south]');
  b.set(DOOR[0], 0, ENGAWA.z1 + 1, 'smooth_stone_slab[type=bottom]');
  b.set(ENGAWA.x1 + 1, 0, DOCK_Z, 'smooth_stone_slab[type=bottom]');
}

// --------------------------------------------------------------- Innenwände und Einrichtung

function partitions(b) {
  b.phase('Innenwände', 'Die Räume trennen leichte Shoji-Wände aus offenen Birkenfalltüren. Oben bleibt über einem Türbalken alles offen, so verteilt sich das Licht.');
  b.step('Wand zwischen Wohnraum und Ostteil', 'Entlang x = 8 setzt du offene Birkenfalltüren (3 hoch). Frei bleiben die Durchgänge bei z = 3 (zum Schlafraum) und z = 6 (zur Küche). Darüber liegt auf y = 4 ein Türbalken.');
  for (let z = 1; z <= 7; z++) {
    if (z === 4) continue;
    if (z !== 3 && z !== 6) for (let y = 1; y <= 3; y++) b.set(8, y, z, 'birch_trapdoor[facing=west,half=bottom,open=true]');
    b.set(8, 4, z, log(POST, 'z'));
  }
  b.step('Wand zwischen Schlafraum und Küche', 'Entlang z = 4 (x = 9 … 11) eine geschlossene Reihe offener Birkenfalltüren, darüber wieder ein Türbalken.');
  for (let x = 9; x <= 11; x++) {
    for (let y = 1; y <= 3; y++) b.set(x, y, 4, 'birch_trapdoor[facing=north,half=bottom,open=true]');
    b.set(x, 4, 4, log(POST, 'x'));
  }
}

function interior(b) {
  b.phase('Einrichtung', 'Japanisch wohnen heißt: wenig Möbel, alles nah am Boden.');
  b.step('Bildnische (Tokonoma)', 'In der Nordwestecke liegt die Nische auf den Schwarzeichenbrettern: ein weißes Banner an der Nordwand als Rollbild, daneben ein verzierter Krug und ein Bonsai (Azalee im Topf). Ein heller Pfosten aus entrindetem Eichenstamm und ein Balken darüber rahmen die Nische.');
  b.set(2, 3, 1, 'white_wall_banner[facing=south]');
  b.set(1, 1, 1, 'potted_flowering_azalea_bush');
  b.set(3, 1, 1, 'decorated_pot[facing=south]');
  b.fill(4, 1, 1, 4, 3, 1, 'stripped_oak_log[axis=y]');
  b.fill(1, 4, 1, 3, 4, 1, 'stripped_oak_log[axis=x]');

  b.step('Sitzkissen und Kessel', 'Um die Feuerstelle liegen vier Sitzkissen (rote Teppiche). Vom mittleren Querbalken hängt an zwei Ketten ein Kessel über der Glut.');
  for (const [x, z] of [[4, 2], [4, 6], [2, 4], [6, 4]]) b.set(x, 1, z, 'red_carpet');
  b.set(4, 4, 4, 'iron_chain[axis=y]');
  b.set(4, 3, 4, 'iron_chain[axis=y]');
  b.set(4, 2, 4, 'cauldron');

  b.step('Schlafraum', 'Zwei weiße Betten als Futons, das Kopfteil an der Nordwand (beim Setzen nach Norden schauen). Dazwischen steht eine Laterne als Andon-Lampe, in der Ecke eine Truhe.');
  b.bed(9, 1, 2, 'white_bed', { facing: 'north' });
  b.bed(11, 1, 2, 'white_bed', { facing: 'north' });
  b.set(10, 1, 1, 'lantern[hanging=false]');
  b.set(11, 1, 3, 'chest[facing=west]');

  b.step('Küche', 'An der Innenwand: Räucherofen, ein Kessel mit Wasser als Spüle und ein Fass mit einer Bambuspflanze obendrauf. An der Ostwand ein Ofen und eine Truhe. Auf dem Räucherofen steht eine Laterne.');
  b.set(9, 1, 5, 'smoker[facing=south]');
  b.set(10, 1, 5, 'water_cauldron[level=3]');
  b.set(11, 1, 5, 'barrel[facing=up]');
  b.set(11, 2, 5, 'potted_bamboo');
  b.set(11, 1, 6, 'furnace[facing=west]');
  b.set(11, 1, 7, 'chest[facing=west]');
  b.set(9, 2, 5, 'lantern[hanging=false]');
}

function lights(b) {
  b.phase('Licht', 'Laternen an den Querbalken im Wohnraum und an der Verandapfette. Zusammen mit Feuerstelle und Andon ist jedes Feld im Haus hell genug, dass keine Monster erscheinen.');
  b.step('Laternen im Haus', 'Zwei Laternen hängen an je einem Kettenglied unter dem Querbalken bei x = 4 (bei z = 2 und z = 6).');
  hangingLantern(b, { x: 4, y: WALL_TOP - 1, z: 2, chain: 1 });
  hangingLantern(b, { x: 4, y: WALL_TOP - 1, z: 6, chain: 1 });
  // Bis y = 6 liegt die Box ganz unter dem Dach (darüber gehörten auch Felder auf der Dachfläche dazu).
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 11, y2: ROOF.y + ROOF.gable - 1, z2: 7 });
  b.step('Laternen an der Veranda', 'Unter die Verandapfette hängst du fünf Laternen direkt an den Balken.');
  for (const [x, z] of [[2, ENGAWA.z1], [6, ENGAWA.z1], [10, ENGAWA.z1], [ENGAWA.x1, 2], [ENGAWA.x1, 6]]) b.set(x, 2, z, 'lantern[hanging=true]');
}

// --------------------------------------------------------------- Garten

// Steinlaterne (Tōrō): Sockel, Mauerschaft, Laterne, kleines Pyramidendach.
function stoneLantern(b, x, z) {
  b.set(x, 0, z, 'chiseled_stone_bricks');
  b.set(x, 1, z, 'stone_brick_wall');
  b.set(x, 2, z, 'lantern[hanging=false]');
  b.set(x, 3, z, 'stone_bricks');
  const ring = [['north', 0, 1], ['south', 0, -1], ['west', 1, 0], ['east', -1, 0]];
  for (const [facing, dx, dz] of ring) b.stairs(x + dx, 3, z + dz, 'stone_brick_stairs', { facing });
  for (const [dx, dz, facing] of [[-1, -1, 'south'], [1, -1, 'west'], [1, 1, 'north'], [-1, 1, 'east']]) b.stairs(x + dx, 3, z + dz, 'stone_brick_stairs', { facing });
  b.slab(x, 4, z, 'stone_brick_slab');
}

// Kies braucht festen Boden: eine Erdschicht darunter (die Wiese ist nur eine Grasschicht).
function gravelAt(b, x, z) {
  b.set(x, -2, z, 'dirt');
  b.set(x, -1, z, 'gravel');
}

// Fester Zufallswert 0 … 1 je Feld (unabhängig von der Aufruf-Reihenfolge).
function cellNoise(x, z, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Bambushain: dichte, unregelmäßige Halme, zum Rand hin lichter.
function bambooGrove(b, x1, z1, x2, z2) {
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const rx = (x2 - x1) / 2 + 0.5;
  const rz = (z2 - z1) / 2 + 0.5;
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const edge = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2;
      if (edge > 1 || cellNoise(x, z, 1) > 0.6 - edge * 0.35) continue;
      const height = 6 + Math.floor(cellNoise(x, z, 2) * 6 * (1.2 - edge * 0.5));
      for (let y = 0; y < height; y++) {
        let leaves = 'none';
        if (y >= height - 2) leaves = 'large';
        else if (y === height - 3) leaves = 'small';
        b.set(x, y, z, `bamboo[age=1,leaves=${leaves},stage=0]`);
      }
    }
  }
}

function dock(b, z1, z2, length) {
  // Steg ab dem Westufer des Teichs: obere Fichtenstufen auf Höhe des Geländes, im Wasser gewässert.
  let start = null;
  for (let x = 16; x <= 30 && start === null; x++) if (b.get(x, -1, z1).startsWith('water')) start = x - 1;
  if (start === null) throw new Error('Steg: kein Wasser im Teich gefunden.');
  const end = start + length - 1;
  for (let x = start; x <= end; x++) {
    for (let z = z1; z <= z2; z++) {
      const wet = b.get(x, -1, z).startsWith('water');
      b.set(x, -1, z, `spruce_slab[type=top,waterlogged=${wet}]`);
      for (let y = 0; y <= 2; y++) if (isPlantId(b.get(x, y, z).split('[')[0])) b.remove(x, y, z);
    }
  }
  for (const z of [z1, z2]) {
    b.set(end, 0, z, 'spruce_fence');
  }
  b.set(end, 1, z1, 'lantern[hanging=false]');
  return { start, end };
}

function garden(b) {
  b.phase('Garten', 'Ein japanischer Garten lebt von Wasser, Stein und wenigen Pflanzen. Fang mit dem Teich an, dann kommen Wege, Laternen und Bäume.', {
    tips: ['Den Kies unter der Dachtraufe legen japanische Gärtner wirklich so an: dort tropft der Regen vom Dach.'],
  });
  b.step('Teich', 'Südöstlich vor der Veranda gräbst du einen Teich (etwa 13 × 10 Blöcke, in der Mitte 2 tief) mit Kiesufer. Wasser nur als Quellen setzen, Seerosen und Schilf dürfen dazu.');
  b.fill(POND.x, -4, POND.z, POND.x + POND.width - 1, -2, POND.z + POND.depth - 1, 'dirt');
  pond(b, { x: POND.x, y: -1, z: POND.z, width: POND.width, depth: POND.depth, facing: 'west', shore: 'kies', waterDepth: 2, seed: 4 });
  b.step('Steg', 'Vom Westufer führt ein 2 breiter Steg aus Fichtenholzstufen (obere Hälfte, genau auf Geländehöhe) 5 Blöcke weit ins Wasser. Am Ende stehen zwei Zaunpfosten, auf einem eine Laterne.');
  const steg = dock(b, DOCK_Z, DOCK_Z + 1, 6);

  b.step('Kies unter der Traufe', 'Rund ums Haus, genau unter der Dachkante, ersetzt du einen Streifen Gras durch Kies.');
  for (let x = ROOF.x0 - 1; x <= ROOF.x1 + 1; x++) for (const z of [ROOF.z0 - 1, ROOF.z1 + 1]) gravelAt(b, x, z);
  for (let z = ROOF.z0; z <= ROOF.z1; z++) for (const x of [ROOF.x0 - 1, ROOF.x1 + 1]) gravelAt(b, x, z);

  b.step('Trittsteine', 'Flache Trittsteine aus glattem Stein und poliertem Andesit führen von der Haustür nach Süden und von der Ostveranda zum Steg.');
  const front = [[10, 12], [9, 13], [10, 14], [11, 15], [10, 16], [9, 17], [10, 18]];
  front.forEach(([x, z], i) => b.set(x, -1, z, i % 2 === 0 ? 'smooth_stone' : 'polished_andesite'));
  for (let x = ENGAWA.x1 + 2; x < steg.start; x++) b.set(x, -1, DOCK_Z + (x % 2), x % 2 === 0 ? 'smooth_stone' : 'polished_andesite');

  b.step('Kiesgarten', 'Südwestlich vor dem Haus liegt ein Kiesgarten (8 × 6 Blöcke) mit einem größeren und einem kleinen bemoosten Andesitfelsen – der kleine Zen-Garten.');
  for (let x = 0; x <= 7; x++) for (let z = 13; z <= 18; z++) gravelAt(b, x, z);
  rock(b, { x: 2, y: 0, z: 15, size: 'mittel', material: 'andesit', rubble: false, seed: 3 });
  rock(b, { x: 6, y: 0, z: 17, size: 'klein', material: 'andesit', rubble: false, seed: 8 });

  b.step('Steinlaternen', 'Drei Steinlaternen: neben dem Weg zur Tür, zwischen Haus und Teich und am Ostufer. Je ein gemeißelter Steinziegel, eine Steinziegelmauer, eine Laterne darauf und ein Dach aus 8 Steinziegeltreppen (hohe Seite zur Mitte) um einen Steinziegel, obenauf eine Stufe.');
  for (const [x, z] of LANTERNS) stoneLantern(b, x, z);

  b.step('Kirschbaum', 'Nordöstlich des Teichs wächst ein großer Kirschbaum mit rosa Blütenblättern darunter.');
  tree(b, { x: 27, y: 0, z: -3, species: 'kirsche', size: 'gross', seed: 2 });
  b.step('Bambushain', 'Hinter dem Haus im Nordwesten wächst ein dichter Bambushain (6 bis 12 Blöcke hoch). Bambus pflanzt du auf Gras und lässt ihn wachsen – oder du stapelst Bambus von Hand.');
  bambooGrove(b, GROUND.x0 + 1, GROUND.z0 + 1, 4, -4);
  b.step('Büsche und Wiese', 'Ein paar Azaleenbüsche an den Hausecken und etwas Gras auf der Wiese.');
  bush(b, { x: -5, y: 0, z: 11, size: 'klein', leaves: 'azalee', seed: 2 });
  bush(b, { x: 16, y: 0, z: -3, size: 'klein', leaves: 'azalee', seed: 5 });
  bush(b, { x: 31, y: 0, z: 16, size: 'mittel', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: GROUND.x0, y: 0, z: GROUND.z0, width: GROUND.x1 - GROUND.x0 + 1, depth: GROUND.z1 - GROUND.z0 + 1, mix: 'wiese', density: 0.15, shape: 'eckig', seed: 11 });
}

export default function build(b) {
  site(b);
  foundation(b);
  floors(b);
  frame(b);
  walls(b);
  roof(b);
  openings(b);
  partitions(b);
  interior(b);
  lights(b);
  garden(b);
}
