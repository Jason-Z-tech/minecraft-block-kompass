// Steinbogenbrücke: drei Rundbögen aus Steinziegeln über einen Fluss, mit Ausweichnischen über den Pfeilern.
// Bau-Rahmen (lokal): die Brücke läuft entlang z, Mitte bei x = 0; der Fluss fließt entlang x. Der ganze Bau ist um 90° gedreht,
// damit die Brücke von Westen nach Osten läuft und die Ansicht von vorne (Süden) die Bögen zeigt.
// Flussbett auf y = 0, Wasserspiegel y = 2, Fahrbahn y = 9 (man geht auf y = 10).

import { hashPosition } from '../../core/random.js';
import { archProfile, lampPost, terrain, tree, bush, rock, vegetation } from '../lib/index.js';

export const meta = {
  id: 'steinbogenbruecke',
  title: 'Steinbogenbrücke',
  category: 'infrastruktur',
  subtitle: 'Drei Rundbögen aus Steinziegeln über einen Fluss, mit Laternen und Ausweichnischen',
  tags: ['Brücke', 'Steinbrücke', 'Bogenbrücke', 'Fluss', 'Steinziegel', 'Rundbogen', 'Laternen', 'Mittelalter', 'Dorf', 'Weg', 'Wasser'],
  aliases: [
    'steinbogenbrücke', 'steinbogenbruecke', 'steinbogenbrucke', 'steinbrücke', 'steinbruecke', 'bogenbrücke', 'bogenbruecke',
    'brücke', 'bruecke', 'flussbrücke', 'flussbruecke', 'alte brücke', 'römerbrücke', 'roemerbruecke', 'steinerne brücke',
    'stone bridge', 'stone arch bridge', 'arch bridge', 'river bridge', 'bridge', 'old stone bridge',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Eine 41 Blöcke lange Steinbrücke, die mit drei Rundbögen über einen Fluss führt. Die Bögen bekommen einen hellen Ring aus poliertem Andesit, die Pfeiler spitze Wellenbrecher gegen die Strömung, darüber laden zwei Ausweichnischen mit Bänken zum Verweilen ein. Ein Gesims aus Treppen, eine Brüstung mit Stufen und acht Laternen auf Steinziegelmauern machen die Brücke auch nachts zum Blickfang. Ufer, Schilf, Seerosen und Bäume gehören dazu.',
  facts: [
    'Länge 41 Blöcke, Fahrbahn 5 Blöcke breit zwischen den Brüstungen, die Bögen sind je 7 Blöcke breit.',
    'Unter dem Scheitel jedes Bogens bleiben 5 Blöcke Luft über dem Wasser – genug für ein Boot.',
    'Die Fahrbahn liegt 7 Blöcke über dem Wasserspiegel; der Fluss ist 2 Blöcke tief.',
    'Das Wasser besteht nur aus Wasserquellen; Zuckerrohr wächst am Sandufer direkt neben dem Wasser.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const AREA = { x1: -17, z1: -3, x2: 17, z2: 53 };
const RIVER = { z1: 12, z2: 38 };
const WATER_TOP = 2;
const DECK = 9;
const BODY = { x1: -3, x2: 3, z1: 5, z2: 45 };
const ARCH = { width: 7, height: 7, base: 1, centers: [15, 25, 35] };
const PIERS = [{ z1: 19, z2: 21, mid: 20 }, { z1: 29, z2: 31, mid: 30 }];
const SIDES = [-1, 1];
const WATER = 'water[level=0]';
const profile = archProfile(ARCH.width, ARCH.height, 'round');

const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;
const pick = (entries, x, y, z, salt) => {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand01(x, y, z, salt) * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
};
const facingX = (s) => (s > 0 ? 'east' : 'west');
const facingInward = (s) => (s > 0 ? 'west' : 'east');

// --- Gelände ---

// Wasserkante je Spalte x: unter der Brücke gerade, sonst leicht ausgefranst.
function riverEdges(x) {
  if (Math.abs(x) <= 6) return { north: RIVER.z1, south: RIVER.z2 };
  return {
    north: RIVER.z1 - Math.floor(rand01(x, 0, 0, 11) * 2),
    south: RIVER.z2 + Math.floor(rand01(x, 0, 0, 12) * 2),
  };
}

// Abstand zur Wasserkante (≥ 1 = Land, 0 = Wasser).
function landDistance(x, z) {
  const { north, south } = riverEdges(x);
  if (z < north) return north - z;
  if (z > south) return z - south;
  return 0;
}

// Weiches Rauschen (Werte-Rauschen auf einem Raster), 0 … 1.
function smoothNoise(x, z, cell, salt) {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  const fx = x / cell - gx;
  const fz = z / cell - gz;
  const s = (t) => t * t * (3 - 2 * t);
  const v = (i, k) => rand01(gx + i, 0, gz + k, salt);
  const top = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
  const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
  return top + (bottom - top) * s(fz);
}

// Ufer: erst ein flacher Sandstreifen, dann ein unterschiedlich steiler Hang bis auf Fahrbahnhöhe.
function bankTop(x, z) {
  const d = landDistance(x, z);
  if (d === 0) return null;
  if (d === 1) return WATER_TOP;
  const steepness = Math.abs(x) <= 5 ? 1.2 : 0.7 + smoothNoise(x, z, 7, 13) * 0.8;
  const bumps = Math.abs(x) <= 5 ? 0 : (smoothNoise(x, z, 3, 14) - 0.5) * 1.6;
  const top = WATER_TOP + Math.round((d - 1) * steepness + bumps);
  return Math.max(WATER_TOP, Math.min(DECK, top));
}

function riverAndBanks(b) {
  b.phase('Fluss und Ufer', 'Die Brücke braucht einen Fluss: 27 Blöcke breit, 2 Blöcke tief, mit Ufern, die bis auf die Höhe der Fahrbahn ansteigen. Baust du an einem echten Fluss, suchst du dir eine Stelle mit etwa dieser Breite und überspringst dieses Kapitel.', {
    tips: [
      'Wasser setzt du mit dem Eimer. Fülle erst die beiden Ränder und dann die Mitte: zwischen zwei Quellen entsteht im Spiel von selbst eine neue Quelle.',
      'Am flachen Sandufer direkt neben dem Wasser wächst später das Zuckerrohr.',
    ],
  });
  b.step('Ufer formen', 'Forme die beiden Ufer: direkt am Wasser ein Streifen Sand auf Höhe des Wasserspiegels, dann steigt das Ufer Block für Block an, bis es 7 Blöcke über dem Wasser die Höhe der Fahrbahn erreicht. Steile Stellen bekommen Stein und Andesit.');
  const width = AREA.x2 - AREA.x1 + 1;
  const depth = AREA.z2 - AREA.z1 + 1;
  // Die Säulen reichen von y = 0 bis zur Uferhöhe (terrain füllt y … y + h).
  const ground = terrainColumns(b, width, depth);
  b.step('Sandstrand am Wasser', 'Der unterste Uferstreifen auf Höhe des Wasserspiegels wird zu Sand und Kies.');
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    for (let z = AREA.z1; z <= AREA.z2; z++) {
      if (ground.top(x, z) !== WATER_TOP) continue;
      b.set(x, WATER_TOP, z, pick([['sand', 6], ['gravel', 2], ['clay', 1]], x, WATER_TOP, z, 21));
    }
  }
  b.step('Flussbett und Wasser', 'Das Flussbett aus Kies, Sand und Ton liegt auf der untersten Ebene, darüber kommen zwei Ebenen Wasserquellen.');
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    for (let z = AREA.z1; z <= AREA.z2; z++) {
      if (landDistance(x, z) !== 0) continue;
      b.set(x, 0, z, pick([['gravel', 4], ['sand', 3], ['clay', 2]], x, 0, z, 22));
      for (let y = 1; y <= WATER_TOP; y++) b.set(x, y, z, WATER);
    }
  }
  return ground;
}

// Gelände über die Bibliothek: eine Säule je Feld von y = 0 bis zur Uferhöhe.
function terrainColumns(b, width, depth) {
  const heightAt = (dx, dz) => bankTop(AREA.x1 + dx, AREA.z1 + dz) ?? -1;
  return terrain(b, { x: AREA.x1, y: 0, z: AREA.z1, width, depth, heightAt, surface: 'gras', rocky: true, seed: 4 });
}

// --- Brückenkörper ---

function archCell(z, y) {
  for (const zc of ARCH.centers) {
    const lx = z - zc;
    if (lx < profile.lo || lx > profile.hi) continue;
    const ly = y - ARCH.base;
    if (ly < 0) return 'solid';
    return profile.get(lx, ly);
  }
  return 'solid';
}

// Steinziegel mit Moos und Rissen, unten am Wasser mehr Moos.
function bodyBlock(x, y, z) {
  const wet = y <= WATER_TOP + 1;
  return pick(wet
    ? [['stone_bricks', 6], ['mossy_stone_bricks', 3], ['cracked_stone_bricks', 1]]
    : [['stone_bricks', 14], ['mossy_stone_bricks', 2], ['cracked_stone_bricks', 1]], x, y, z, 31);
}

// Bogenring: feste Zellen der Außenseiten, die an die Öffnung grenzen.
function isRing(z, y) {
  if (y < ARCH.base || archCell(z, y) !== 'solid') return false;
  for (const [dz, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const n = archCell(z + dz, y + dy);
    if (n !== 'solid' && y + dy >= ARCH.base) return true;
  }
  return false;
}

function bodyCellState(x, y, z) {
  const kind = archCell(z, y);
  if (kind === 'open') return null;
  const lx = z - ARCH.centers.find((c) => Math.abs(z - c) <= 3);
  if (kind === 'stairs') return `stone_brick_stairs[facing=${lx < 0 ? 'north' : 'south'},half=top]`;
  if (kind === 'slab') return 'stone_brick_slab[type=top]';
  if (Math.abs(x) === BODY.x2 && isRing(z, y)) return 'polished_andesite';
  return bodyBlock(x, y, z);
}

// Widerlager (an Land): wo schon Uferboden liegt, bleibt er stehen – gemauert wird nur, was frei liegt.
const isAbutmentZ = (z) => z < RIVER.z1 || z > RIVER.z2;

function buildBody(b, yFrom, yTo) {
  for (let y = yFrom; y <= yTo; y++) {
    for (let z = BODY.z1; z <= BODY.z2; z++) {
      for (let x = BODY.x1; x <= BODY.x2; x++) {
        if (isAbutmentZ(z) && b.get(x, y, z) !== 'air') continue;
        const state = bodyCellState(x, y, z);
        if (state) b.set(x, y, z, state);
      }
    }
  }
}

// Wellenbrecher (spitz gegen die Strömung) und Strebepfeiler bis unter die Nische.
function buildCutwaters(b, yFrom, yTo) {
  for (const pier of PIERS) {
    for (const s of SIDES) {
      for (let y = yFrom; y <= yTo; y++) {
        for (let z = pier.z1; z <= pier.z2; z++) b.set(4 * s, y, z, bodyBlock(4 * s, y, z));
        if (y <= WATER_TOP) b.set(5 * s, y, pier.mid, bodyBlock(5 * s, y, pier.mid));
        if (y === WATER_TOP + 1) b.stairs(5 * s, y, pier.mid, 'stone_brick_stairs', { facing: facingInward(s) });
        if (y > WATER_TOP + 1) b.set(5 * s, y, pier.mid, 'stone_bricks');
      }
    }
  }
}

// Bogenkante: der Andesit-Ring springt auf beiden Außenseiten einen Block vor (über dem Wasser, neben den Strebepfeilern).
function buildArchivolts(b) {
  for (const s of SIDES) {
    for (let y = WATER_TOP + 1; y <= DECK - 1; y++) {
      for (let z = BODY.z1; z <= BODY.z2; z++) {
        if (isPierZ(z) || !isRing(z, y)) continue;
        b.set(4 * s, y, z, 'polished_andesite');
      }
    }
  }
}

function piersAndArches(b) {
  b.phase('Pfeiler und Widerlager', 'Baue die Brücke Ebene für Ebene von unten nach oben. Zuerst die beiden Pfeiler im Fluss und die Widerlager an den Ufern – die Widerlager mauerst du nur dort, wo das Ufer nicht schon bis oben reicht. Jeder Pfeiler ist 3 Blöcke lang und hat an beiden Seiten einen spitzen Wellenbrecher. Die Steinziegel kannst du einfach ins Wasser setzen, sie verdrängen es.', {
    tips: [
      'Stecke zuerst die Mittellinie quer über den Fluss ab: von ihr aus sind es 3 Blöcke nach links und nach rechts – die Brücke ist 7 Blöcke breit.',
      'Zwischen den Pfeilern und den Ufern bleiben je 7 Blöcke frei: dort entstehen die Bögen.',
      'Moosige und rissige Steinziegel streust du unregelmäßig ein, am Wasser etwas mehr. So wirkt die Brücke alt.',
    ],
  });
  buildBody(b, 0, WATER_TOP);
  buildCutwaters(b, 0, WATER_TOP + 1);
  b.note(5, WATER_TOP + 1, PIERS[0].mid, 'Wellenbrecher: Treppe mit der hohen Seite zur Brücke');

  b.phase('Bögen', 'Über dem Wasser ziehen sich die Pfeiler zum Bogen zusammen. Die Rundung entsteht aus umgedrehten Steinziegeltreppen und oberen Stufen; auf den Außenseiten rahmt ein Ring aus poliertem Andesit jeden Bogen ein.', {
    tips: [
      'Umgedrehte Treppen setzt du, indem du auf die obere Hälfte einer Blockseite klickst. Die hohe Seite zeigt immer vom Bogen weg zum Pfeiler.',
      'Baue jeden Bogen von beiden Seiten gleichzeitig nach oben, dann treffen sich die Hälften genau in der Mitte.',
      'Der Ring aus poliertem Andesit sitzt nur auf den beiden Außenseiten, innen bleibt alles aus Steinziegeln. Davor kommt über dem Wasser eine zweite Andesit-Reihe, einen Block vor der Wand: diese Kante wirft Schatten und lässt die Bögen hervortreten.',
    ],
  });
  buildBody(b, WATER_TOP + 1, DECK - 1);
  buildCutwaters(b, WATER_TOP + 2, DECK - 1);
  buildArchivolts(b);
  b.note(0, DECK - 1, ARCH.centers[1], 'Scheitel des mittleren Bogens');
}

// --- Fahrbahn, Gesims, Nischen ---

function isPierZ(z) {
  return PIERS.some((p) => z >= p.z1 && z <= p.z2);
}

function roadBlock(x, z) {
  if (Math.abs(x) === 2) return 'stone_bricks';
  return pick([['cobblestone', 5], ['andesite', 3], ['stone', 2]], x, DECK, z, 41);
}

function deckAndCornice(b) {
  b.phase('Gesims und Fahrbahn', 'Jetzt bekommt die Brücke ihren oberen Abschluss: ein Gesims aus umgedrehten Treppen, das ringsum einen Block übersteht, und die Fahrbahn aus Bruchstein, Andesit und Stein.', {
    tips: [
      'Für das Gesims stellst du dich auf die Brücke und schaust nach außen – dann klickst du auf die obere Hälfte der Außenwand. So zeigt die hohe Seite zur Brücke.',
      'Über den Pfeilern springt die Fahrbahn auf jeder Seite einen Block weiter vor: das sind die Ausweichnischen.',
    ],
  });
  b.step('Gesims', 'Entlang beider Außenseiten setzt du auf Fahrbahnhöhe umgedrehte Steinziegeltreppen, einen Block vor der Wand. Über den Pfeilern und neben den Nischen tragen solche Treppen auch den Boden der Nische.');
  for (const s of SIDES) {
    for (let z = BODY.z1; z <= BODY.z2; z++) {
      if (isPierZ(z)) continue;
      const nextToNiche = PIERS.some((p) => z === p.z1 - 1 || z === p.z2 + 1);
      if (nextToNiche) b.stairs(4 * s, DECK - 1, z, 'stone_brick_stairs', { facing: facingInward(s), half: 'top' });
      else b.stairs(4 * s, DECK, z, 'stone_brick_stairs', { facing: facingInward(s), half: 'top' });
    }
    for (const pier of PIERS) {
      for (const z of [pier.z1, pier.z2]) b.stairs(5 * s, DECK - 1, z, 'stone_brick_stairs', { facing: facingInward(s), half: 'top' });
    }
  }
  b.step('Fahrbahn', 'Die Fahrbahn ist 7 Blöcke breit (bis an die Außenkante der Brücke) und reicht in den Nischen bis über die Wellenbrecher. Die äußeren Reihen sind Steinziegel – darauf steht gleich die Brüstung –, dazwischen mischst du Bruchstein, Andesit und Stein.');
  for (let z = BODY.z1; z <= BODY.z2; z++) {
    for (let x = BODY.x1; x <= BODY.x2; x++) b.set(x, DECK, z, Math.abs(x) === 3 ? 'stone_bricks' : roadBlock(x, z));
  }
  for (const pier of PIERS) {
    for (const s of SIDES) {
      for (let z = pier.z1 - 1; z <= pier.z2 + 1; z++) b.set(4 * s, DECK, z, z === pier.z1 - 1 || z === pier.z2 + 1 ? 'stone_bricks' : roadBlock(2 * s, z));
      for (let z = pier.z1; z <= pier.z2; z++) b.set(5 * s, DECK, z, 'stone_bricks');
    }
  }
}

function parapet(b) {
  b.phase('Brüstung und Nischen', 'Die Brüstung ist eine Reihe Steinziegel mit einer Steinziegelstufe obendrauf – zusammen anderthalb Blöcke hoch, genug, dass niemand hinunterfällt. In den Nischen über den Pfeilern stehen Bänke.', {
    tips: ['Die Stufen setzt du in die untere Hälfte des Blocks, dann bleibt oben eine halbe Kante frei – das sieht feiner aus als ein ganzer Block.'],
  });
  b.step('Brüstung', 'Setze auf die äußersten Reihen der Fahrbahn eine Reihe Steinziegel und darauf Steinziegelstufen. An den Nischen weicht die Brüstung um zwei Blöcke nach außen aus.');
  const cells = [];
  for (const s of SIDES) {
    for (let z = BODY.z1; z <= BODY.z2; z++) if (!isPierZ(z)) cells.push([3 * s, z]);
    for (const pier of PIERS) {
      cells.push([4 * s, pier.z1 - 1], [4 * s, pier.z2 + 1]);
      for (let z = pier.z1; z <= pier.z2; z++) cells.push([5 * s, z]);
    }
  }
  for (const [x, z] of cells) {
    b.set(x, DECK + 1, z, 'stone_bricks');
    b.slab(x, DECK + 2, z, 'stone_brick_slab');
  }
  b.step('Bänke in den Nischen', 'In jede Nische kommen zwei Bänke aus Fichtentreppen mit der Lehne zur Brüstung, dazwischen ein Blumentopf mit Porzellansternchen.');
  for (const pier of PIERS) {
    for (const s of SIDES) {
      for (const z of [pier.z1, pier.z2]) b.stairs(4 * s, DECK + 1, z, 'spruce_stairs', { facing: facingX(s) });
      b.set(4 * s, DECK + 1, pier.mid, 'potted_azure_bluet');
    }
  }
  b.note(4, DECK + 1, PIERS[0].z1, 'Bank: Lehne zur Brüstung');
}

function lanterns(b) {
  b.phase('Laternen', 'Acht Laternen beleuchten die Brücke: je zwei an den Brückenenden und eine über jedem Wellenbrecher. Jede steht auf einem gemeißelten Steinziegel mit zwei Steinziegelmauern.', {
    tips: ['Die Mauerstücke verbinden sich von selbst mit der Laterne darauf – du brauchst nichts zu drehen.'],
  });
  const posts = [];
  for (const s of SIDES) {
    posts.push([3 * s, BODY.z1], [3 * s, BODY.z2]);
    for (const pier of PIERS) posts.push([5 * s, pier.mid]);
  }
  for (const [x, z] of posts) {
    lampPost(b, { x, y: DECK + 1, z, post: 'stone_brick_wall', base: 'chiseled_stone_bricks', height: 3, style: 'top' });
  }
}

// --- Umgebung ---

function roadOnLand(b) {
  for (const [z1, z2] of [[AREA.z1, BODY.z1 - 1], [BODY.z2 + 1, AREA.z2]]) {
    for (let z = z1; z <= z2; z++) {
      for (let x = -3; x <= 3; x++) {
        if (Math.abs(x) === 3) b.set(x, DECK, z, pick([['coarse_dirt', 2], ['gravel', 1], ['grass_block', 1]], x, DECK, z, 51));
        else b.set(x, DECK, z, roadBlock(x, z));
      }
    }
  }
}

function riverside(b, ground) {
  const onGround = (x, z) => ground.top(x, z) + 1;
  b.phase('Weg und Ufergrün', 'Zum Schluss führt der Weg an beiden Enden weiter, und am Fluss wird es grün: Schilf aus Zuckerrohr, Seerosen, Seegras, ein paar Bäume, Büsche und Felsen.');
  b.step('Weg an Land', 'Der Pflasterweg aus Bruchstein, Andesit und Stein läuft an beiden Enden der Brücke weiter, 5 Blöcke breit mit einem Rand aus grober Erde und Kies.');
  roadOnLand(b);
  b.step('Schilf, Seerosen und Seegras', 'Setze Zuckerrohr auf den Sand direkt neben das Wasser (1–3 Blöcke hoch), ein paar Seerosen auf das Wasser abseits der Brücke und Seegras auf den Grund.');
  for (let x = AREA.x1; x <= AREA.x2; x++) {
    if (Math.abs(x) <= 6) continue;
    for (let z = AREA.z1; z <= AREA.z2; z++) {
      const d = landDistance(x, z);
      if (d === 0) {
        const r = rand01(x, 0, z, 61);
        if (r < 0.18) b.set(x, 1, z, 'seagrass');
        if (rand01(x, 3, z, 62) < 0.045 && Math.abs(z - 25) < 11) b.set(x, WATER_TOP + 1, z, 'lily_pad');
      } else if (d === 1 && bankTop(x, z) === WATER_TOP && rand01(x, 4, z, 63) < 0.35) {
        const height = 1 + Math.floor(rand01(x, 5, z, 64) * 3);
        for (let k = 1; k <= height; k++) b.set(x, WATER_TOP + k, z, 'sugar_cane');
      }
    }
  }
  b.step('Bäume, Büsche und Felsen', 'Auf beiden Ufern wachsen Eichen und Birken, an den Widerlagern Büsche. Ein paar bemooste Felsen liegen im Gras.');
  tree(b, { x: -11, y: onGround(-11, 2), z: 2, species: 'eiche', size: 'mittel', seed: 3 });
  tree(b, { x: 11, y: onGround(11, 1), z: 1, species: 'birke', size: 'mittel', seed: 5 });
  tree(b, { x: -12, y: onGround(-12, 49), z: 49, species: 'birke', size: 'mittel', seed: 8 });
  tree(b, { x: 11, y: onGround(11, 48), z: 48, species: 'eiche', size: 'mittel', seed: 6 });
  bush(b, { x: -6, y: onGround(-6, 3), z: 3, size: 'klein', leaves: 'eiche', seed: 2 });
  bush(b, { x: 6, y: onGround(6, 47), z: 47, size: 'klein', leaves: 'azalee', seed: 4 });
  rock(b, { x: 14, y: onGround(14, 6), z: 6, size: 'klein', material: 'andesit', seed: 1 });
  rock(b, { x: -14, y: onGround(-14, 44), z: 44, size: 'klein', material: 'stein', seed: 2 });
  b.step('Wiese', 'Gras, Farne und Blumen auf den Ufern – mit Knochenmehl auf Gras geht das schnell.');
  vegetation(b, { x: AREA.x1, y: DECK + 1, z: AREA.z1, width: AREA.x2 - AREA.x1 + 1, depth: AREA.z2 - AREA.z1 + 1, mix: 'wiese', density: 0.3, shape: 'eckig', seed: 9 });
}

export default function build(b) {
  b.transform({ rotate: 90 }, () => {
    const ground = riverAndBanks(b);
    piersAndArches(b);
    deckAndCornice(b);
    parapet(b);
    lanterns(b);
    riverside(b, ground);
  });
}
