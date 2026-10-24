// Kirschbaum – eigener Baum mit geschwungenem Stamm, vier Ästen, breiter rosa Krone mit hängenden Blütenzweigen,
// Blütenteppich, Steinbank, Steinlaterne und Trittsteinen. Der Stammfuß steht bei (0, y0, 0), die Bank im Süden.

import { terrain, vegetation, bush } from '../lib/natur.js';
import { createRandom, hashPosition } from '../../core/random.js';

export const meta = {
  id: 'kirschbaum',
  title: 'Kirschbaum',
  category: 'klein',
  subtitle: 'Blühender Kirschbaum mit geschwungenem Stamm und Steinbank',
  tags: ['Baum', 'Kirsche', 'Kirschblüte', 'Japan', 'Garten', 'Deko', 'Natur', 'Bank', 'Rosa', 'Eigener Baum'],
  aliases: [
    'kirschbaum', 'kirsch baum', 'kirschenbaum', 'kirschblütenbaum', 'kirschblueten baum', 'kirschblüte', 'kirschblute',
    'japanischer kirschbaum', 'sakura', 'sakura baum', 'sakurabaum', 'rosa baum', 'blütenbaum', 'bluetenbaum',
    'cherry tree', 'cherry blossom', 'cherry blossom tree', 'sakura tree', 'custom cherry tree', 'pink tree', 'japanese garden',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Ein blühender Kirschbaum für Gärten und japanische Ecken. Der schlanke Stamm schwingt sich in einem S nach oben und teilt sich in vier Äste, die eine breite, flache Krone aus Kirschlaub tragen; an ihrem Rand hängen Blütenzweige herab. Unter dem Baum liegt ein Teppich aus rosa Blüten, im Süden stehen eine kleine Steinbank mit Armlehnen und eine Steinlaterne, Trittsteine führen hin.',
  facts: [
    'Stamm und Äste aus Kirschstamm und Kirschholz; das Holz hat ringsum Rinde und kommt überall dorthin, wo sonst eine Schnittfläche zu sehen wäre.',
    'Die Bank besteht aus nur drei Steinziegeltreppen: die Enden zeigen nach außen, dadurch formt das Spiel sie von selbst zu Ecken mit Armlehnen.',
    'Rosa Blütenblätter liegen in 1 bis 4 Blüten pro Block und lassen sich mit weiteren Klicks auf denselben Block auffüllen.',
    'Kirschlaub wird im Spiel nicht nach dem Biom eingefärbt – es ist überall gleich rosa.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const SEED = 'kirschbaum';
const GROUND_R = 10;
const LEAF = 'cherry_leaves[persistent=true]';
const AXES = ['x', 'y', 'z'];
const COMPASS = ['Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten', 'Norden', 'Nordosten'];
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FACINGS = ['north', 'east', 'south', 'west'];
const BENCH = { x: 1, z: 4 };
const STONE_LANTERN = { x: -3, z: 4 };

const key = (x, y, z) => `${x},${y},${z}`;
const unkey = (k) => k.split(',').map(Number);
const rand01 = (x, y, z, salt) => hashPosition(x, y, z, salt) / 4294967296;

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Wertrauschen 0 … 1 (dreilinear) für ausgefranste Laubränder.
function noise3(x, y, z, scale, salt) {
  const f = [x / scale, y / scale, z / scale];
  const i = f.map(Math.floor);
  const t = f.map((v, k) => smooth(v - i[k]));
  let v = 0;
  for (let c = 0; c < 8; c++) {
    const d = [c & 1, (c >> 1) & 1, (c >> 2) & 1];
    const w = d.reduce((acc, dk, k) => acc * (dk ? t[k] : 1 - t[k]), 1);
    v += w * rand01(i[0] + d[0], i[1] + d[1], i[2] + d[2], salt);
  }
  return v;
}

function compass(dx, dz) {
  return COMPASS[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8];
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1, 2].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
}

function sampleCurve(p0, p1, p2, p3) {
  const n = Math.ceil(Math.hypot(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]) * 8);
  return Array.from({ length: n + 1 }, (_, i) => cubic(p0, p1, p2, p3, i / n));
}

// Flächig verbundene Zellen entlang der Punkte; axis = Richtung, in die das Holz dort wächst.
function pathCells(points) {
  let cur = points[0].map(Math.round);
  const cells = [[...cur, 'y']];
  for (const p of points.slice(1)) {
    const target = p.map(Math.round);
    for (let guard = 0; guard < 24; guard++) {
      const diff = target.map((v, k) => v - cur[k]);
      if (diff.every((v) => v === 0)) break;
      let k = 1;
      for (const c of [0, 2]) if (Math.abs(diff[c]) > Math.abs(diff[k])) k = c;
      cur = [...cur];
      cur[k] += Math.sign(diff[k]);
      cells.push([...cur, AXES[k]]);
    }
  }
  return cells;
}

function planLimbs(rng, top) {
  const limbs = [];
  const start = 0.35;
  for (let i = 0; i < 4; i++) {
    const a = start + (i * Math.PI) / 2 + (rng.next() - 0.5) * 0.5;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const L = 4.6 + rng.next() * 1.4;
    const lift = 1.6 + rng.next() * 1.2;
    const end = [top[0] + dx * L, top[1] + lift, top[2] + dz * L];
    const points = sampleCurve(top, [top[0] + dx * 1.2, top[1] + 1.4, top[2] + dz * 1.2], [top[0] + dx * L * 0.7, top[1] + lift + 0.6, top[2] + dz * L * 0.7], end);
    limbs.push({
      index: i, name: compass(dx, dz), length: L, cells: pathCells(points),
      blobs: [
        { c: [end[0], end[1] + 0.9, end[2]], r: 3.4, ry: 1.9 },
        { c: [top[0] + dx * L * 0.5, top[1] + lift + 0.9, top[2] + dz * L * 0.5], r: 2.6, ry: 1.6 },
      ],
    });
  }
  return limbs;
}

function planLeaves(b, groups, { minY, clear, isWood }) {
  const blobs = groups.flatMap((g) => g.blobs.map((blob) => ({ ...blob, group: g.index })));
  const lo = [0, 1, 2].map((k) => Math.min(...blobs.map((bl) => Math.floor(bl.c[k] - (k === 1 ? bl.ry : bl.r) * 1.2))));
  const hi = [0, 1, 2].map((k) => Math.max(...blobs.map((bl) => Math.ceil(bl.c[k] + (k === 1 ? bl.ry : bl.r) * 1.2))));
  const leaves = new Map();
  for (let y = Math.max(lo[1], minY); y <= hi[1]; y++) {
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let x = lo[0]; x <= hi[0]; x++) {
        if (clear(x, y, z) || b.get(x, y, z) !== 'air') continue;
        let d = Infinity;
        let group = -1;
        for (const bl of blobs) {
          const dist = Math.hypot((x - bl.c[0]) / bl.r, (y - bl.c[1]) / bl.ry, (z - bl.c[2]) / bl.r);
          if (dist < d) {
            d = dist;
            group = bl.group;
          }
        }
        d *= 1 + (noise3(x, y, z, 2.2, 41) - 0.5) * 0.36;
        if (d <= 0.8 || (d <= 1.12 && rand01(x, y, z, 42) < (1.12 - d) / 0.32)) leaves.set(key(x, y, z), group);
      }
    }
  }
  const reached = new Set();
  const queue = [...leaves.keys()].filter((k) => {
    const [x, y, z] = unkey(k);
    return SIDES.some(([dx, dy, dz]) => isWood(x + dx, y + dy, z + dz));
  });
  queue.forEach((k) => reached.add(k));
  while (queue.length > 0) {
    const [x, y, z] = unkey(queue.pop());
    for (const [dx, dy, dz] of SIDES) {
      const n = key(x + dx, y + dy, z + dz);
      if (leaves.has(n) && !reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
    }
  }
  for (const k of [...leaves.keys()]) if (!reached.has(k)) leaves.delete(k);
  return leaves;
}

// Laub-Schritte je Ast; ein Blatt ohne Nachbarn im eigenen Schritt rutscht in den nächsten.
function orderLeafSteps(leaves, order, isWood) {
  const placed = new Set();
  let carry = [];
  return order.map((groupIndex, n) => {
    const pending = new Set([...carry, ...[...leaves].filter(([, g]) => g === groupIndex).map(([k]) => k)]);
    const step = [];
    let grew = true;
    while (grew) {
      grew = false;
      for (const k of pending) {
        const [x, y, z] = unkey(k);
        if (!SIDES.some(([dx, dy, dz]) => placed.has(key(x + dx, y + dy, z + dz)) || isWood(x + dx, y + dy, z + dz))) continue;
        placed.add(k);
        step.push(k);
        pending.delete(k);
        grew = true;
      }
    }
    carry = [...pending];
    if (n === order.length - 1 && carry.length > 0) throw new Error(`Kirschbaum: ${carry.length} Blätter ohne Halt.`);
    return step;
  });
}

function moundHeight(x, z) {
  const d = Math.hypot(x, z) + (noise3(x, 0, z, 2.5, 7) - 0.5) * 1.2;
  return d < 4.2 ? 2 : 1;
}

// Trittsteine von der Südwestkante zur Bank, bündig in der Grasschicht.
function steppingStones(ground) {
  const stones = [];
  const pts = [[-8, 8], [-6, 7], [-4, 7], [-2, 6], [0, 6], [2, 6]];
  pts.forEach(([x, z], i) => {
    const g = ground.top(x, z);
    if (g === null) return;
    stones.push([x, g, z, ['stone', 'andesite', 'mossy_cobblestone', 'cobblestone'][hashPosition(x, i, z, 9) % 4]]);
  });
  return stones;
}

export default function build(b) {
  const rng = createRandom(SEED);

  // --- Bauplatz ---
  b.phase('Bauplatz', 'Der Kirschbaum steht auf einer runden Wiese mit 21 Blöcken Durchmesser und einem flachen Hügel in der Mitte (eine Ebene höher, etwa 9 Blöcke breit). Sechs Trittsteine aus Stein, Andesit und Bruchstein liegen bündig in der Grasschicht und führen von Südwesten zur Bank.', {
    tips: ['Baust du auf vorhandener Wiese, ersetze für die Trittsteine einfach einzelne Grasblöcke – nicht obendrauf setzen.'],
  });
  const ground = terrain(b, {
    x: -GROUND_R, y: 0, z: -GROUND_R, width: GROUND_R * 2 + 1, depth: GROUND_R * 2 + 1, shape: 'rund', seed: 4,
    heightAt: (dx, dz) => moundHeight(dx - GROUND_R, dz - GROUND_R),
  });
  for (const [x, y, z, id] of steppingStones(ground)) b.set(x, y, z, id);
  const y0 = ground.top(0, 0) + 1;

  // --- Stamm ---
  const trunkPoints = sampleCurve([0, y0 + 1, 0], [2, y0 + 3, 0.3], [-1.4, y0 + 4.8, -0.5], [0.2, y0 + 7, -0.8]);
  const trunk = pathCells(trunkPoints);
  const top = trunk[trunk.length - 1].slice(0, 3);
  const wood = new Set();
  const isWood = (x, y, z) => wood.has(key(x, y, z));
  // Stammfuß 2 × 2 (x −1 … 0, z −1 … 0) mit Wurzelanlauf aus Kirschholz ringsum.
  const base = [[0, 0, 0], [-1, 0, 0], [0, 0, -1], [-1, 0, -1], [-1, 1, 0], [0, 1, -1], [-1, 1, -1]];
  const flare = [[1, 0, 0], [1, 0, -1], [-2, 0, -1], [0, 0, 1], [-1, 0, -2], [1, 1, 0], [-2, 1, -1], [2, 0, 0], [-1, 0, -3]];
  b.phase('Stamm', `Der Stamm schwingt sich in einem S nach oben: erst nach Osten, dann zurück nach Westen und oben wieder zur Mitte. Er wächst ${top[1] - y0 + 1} Ebenen hoch, unten steht er auf einem 2 × 2 Blöcke dicken Fuß. Wo er seitlich versetzt, setzt du liegendes Kirschholz; senkrechte Stücke sind Kirschstämme. Am Fuß liegt ringsum ein Kranz aus Kirschholz, der den Stamm breiter wirken lässt.`, {
    tips: [
      'Setze jeden neuen Stammblock an eine Fläche des vorigen, nie nur über Eck – sonst sieht der Stamm abgebrochen aus.',
      'Kirschholz zeigt auf allen Seiten Rinde; nimm es überall, wo sonst die helle Schnittfläche eines Stamms zu sehen wäre.',
    ],
  });
  for (const [x, dy, z] of flare) {
    wood.add(key(x, y0 + dy, z));
    b.set(x, y0 + dy, z, 'cherry_wood[axis=y]');
  }
  const trunkCells = new Map(trunk.map(([x, y, z, axis]) => [key(x, y, z), axis]));
  for (const [x, dy, z] of base) trunkCells.set(key(x, y0 + dy, z), 'y');
  for (const [k, axis] of trunkCells) {
    const [x, y, z] = unkey(k);
    wood.add(k);
    const covered = trunkCells.has(key(x, y + 1, z));
    b.set(x, y, z, axis === 'y' && covered ? 'cherry_log[axis=y]' : `cherry_wood[axis=${axis}]`);
  }

  // --- Äste ---
  const limbs = planLimbs(rng, top);
  b.phase('Äste', `Aus der Stammspitze auf Ebene ${top[1] + 1} wachsen vier Äste in alle Richtungen. Jeder läuft erst steil, dann flacher nach außen und hebt sich am Ende noch einmal – so entsteht die typische breite, schirmförmige Krone.`, {
    tips: ['Baue einen Ast nach dem anderen fertig und schau ihn dir von unten an, bevor du den nächsten setzt.'],
  });
  for (const limb of limbs) {
    b.step(`Ast nach ${limb.name}`, `Rund ${Math.round(limb.length)} Blöcke weit nach ${limb.name}, aus ${limb.cells.length - 1} Blöcken Kirschholz. Er steigt auf den ersten zwei Blöcken schnell und läuft dann fast waagrecht aus.`);
    for (const [x, y, z, axis] of limb.cells.slice(1)) {
      if (isWood(x, y, z)) continue;
      wood.add(key(x, y, z));
      b.set(x, y, z, `cherry_wood[axis=${axis}]`);
    }
  }

  // --- Krone ---
  const crownTop = { index: 4, blobs: [{ c: [top[0], top[1] + 3.2, top[2]], r: 3.2, ry: 1.9 }] };
  const groups = [...limbs, crownTop];
  const benchClear = (x, y, z) => x >= BENCH.x - 1 && x <= BENCH.x + 3 && z >= BENCH.z - 1 && z <= BENCH.z + 1 && y <= y0 + 2;
  const leaves = planLeaves(b, groups, { minY: y0 + 3, clear: benchClear, isWood });
  const order = groups.map((g) => g.index);
  const leafSteps = orderLeafSteps(leaves, order, isWood);
  b.phase('Krone', `Die Krone ist flach und breit: über jedem Astende liegt eine große Wolke aus Kirschlaub, eine kleinere über der Astmitte, und oben schließt eine flache Kuppel die Mitte. Zusammen sind es ${leaves.size} Blätter. Zum Schluss hängen Blütenzweige vom Rand herab.`, {
    tips: [
      'Lass den Rand der Wolken ausfransen: einzelne Blätter vor und zurück wirken weicher als eine glatte Kante.',
      'Gesetztes Laub verrottet nicht – du brauchst keinen Stamm in der Nähe jedes Blatts.',
    ],
  });
  const leafCells = [];
  order.forEach((groupIndex, n) => {
    const limb = limbs[groupIndex];
    b.step(limb ? `Laub am Ast nach ${limb.name}` : 'Kuppel über der Mitte', limb
      ? `Rund ${leafSteps[n].length} Blätter: die Wolke am Astende ist etwa 7 Blöcke breit und 3 bis 4 hoch, die über der Astmitte etwas kleiner. Arbeite vom Ast aus nach außen.`
      : `Rund ${leafSteps[n].length} Blätter: eine flache Kuppel über der Stammspitze, die die Lücken zwischen den vier Astwolken schließt.`);
    for (const k of leafSteps[n]) {
      const [x, y, z] = unkey(k);
      b.set(x, y, z, LEAF);
      leafCells.push([x, y, z]);
    }
  });
  // Hängende Blütenzweige an der Unterseite, mit mindestens zwei Blöcken Kopffreiheit.
  b.step('Hängende Blütenzweige', 'Unter den Rand der Krone hängst du an einzelnen Stellen ein bis zwei Blätter Kirschlaub untereinander. Lass darunter immer mindestens zwei Blöcke Luft, damit du unter dem Baum gehen kannst.');
  let hanging = 0;
  for (const [x, y, z] of leafCells) {
    if (b.get(x, y - 1, z) !== 'air' || Math.hypot(x - top[0], z - top[2]) < 2.5 || rand01(x, y, z, 81) >= 0.2) continue;
    const length = rand01(x, y, z, 82) < 0.45 ? 2 : 1;
    for (let k = 1; k <= length; k++) {
      const yy = y - k;
      const g = ground.top(x, z);
      if (g === null || yy <= g + 2 || b.get(x, yy, z) !== 'air' || benchClear(x, yy, z)) break;
      b.set(x, yy, z, LEAF);
      hanging++;
    }
  }
  if (hanging === 0) throw new Error('Kirschbaum: keine hängenden Blütenzweige gefunden.');

  // --- Bank und Laterne ---
  b.phase('Steinbank und Laterne', 'Unter der Südseite der Krone steht eine kleine Steinbank mit Blick nach Süden, daneben eine Steinlaterne.', {
    tips: ['Die Treppen formen sich von selbst zu Ecken, wenn du die beiden äußeren nach außen gerichtet neben die mittlere setzt.'],
  });
  const benchY = ground.top(BENCH.x + 1, BENCH.z) + 1;
  b.step('Steinbank', 'Setze drei Steinziegeltreppen nebeneinander: die mittlere mit der hohen Seite nach Norden (Rückenlehne), die linke mit der hohen Seite nach Westen, die rechte nach Osten. Die äußeren werden dadurch zu Eckstücken – Rücken- und Armlehne in einem.');
  b.stairs(BENCH.x, benchY, BENCH.z, 'stone_brick_stairs', { facing: 'west' });
  b.stairs(BENCH.x + 1, benchY, BENCH.z, 'stone_brick_stairs', { facing: 'north' });
  b.stairs(BENCH.x + 2, benchY, BENCH.z, 'stone_brick_stairs', { facing: 'east' });
  b.note(BENCH.x + 1, benchY, BENCH.z, 'Steinbank: drei Steinziegeltreppen, die äußeren zeigen nach außen');
  const lanternY = ground.top(STONE_LANTERN.x, STONE_LANTERN.z) + 1;
  b.step('Steinlaterne', 'Die Steinlaterne ist ein gemeißelter Steinziegel als Sockel, darauf eine Steinziegelmauer und obendrauf eine stehende Laterne.');
  b.set(STONE_LANTERN.x, lanternY, STONE_LANTERN.z, 'chiseled_stone_bricks');
  b.set(STONE_LANTERN.x, lanternY + 1, STONE_LANTERN.z, 'stone_brick_wall');
  b.set(STONE_LANTERN.x, lanternY + 2, STONE_LANTERN.z, 'lantern[hanging=false]');

  // --- Blütenteppich und Wiese ---
  b.phase('Blütenteppich und Wiese', 'Unter der Krone liegen rosa Blütenblätter auf dem Gras, dicht am Stamm und lockerer zum Rand. Zwei blühende Azaleenbüsche rahmen Bank und Laterne, rundherum wächst Wiesengras.', {
    tips: ['Klickst du mit rosa Blütenblättern mehrmals auf denselben Block, werden es bis zu vier Blüten.'],
  });
  b.step('Azaleenbüsche', 'Setze links der Laterne und rechts der Bank je einen kleinen Busch aus Azaleenlaub und blühendem Azaleenlaub gemischt, etwa 3 Blöcke breit und 2 hoch.');
  bush(b, { x: -5, y: ground.top(-5, 3) + 1, z: 3, size: 'klein', leaves: 'azalee', seed: 2 });
  bush(b, { x: 6, y: ground.top(6, 3) + 1, z: 3, size: 'klein', leaves: 'azalee', seed: 5 });
  b.step('Blütenblätter und Gras', 'Verteile rosa Blütenblätter unter der Krone, mal eine, mal bis zu vier Blüten pro Block, und drehe sie unterschiedlich. Außerhalb der Krone setzt du lockeres Gras und ein paar Blumen.');
  for (let z = -GROUND_R; z <= GROUND_R; z++) {
    for (let x = -GROUND_R; x <= GROUND_R; x++) {
      const d = Math.hypot(x - top[0], z - top[2]);
      if (d > 8.5 || rand01(x, 0, z, 91) > 0.62 * (1 - d / 11)) continue;
      const g = ground.top(x, z);
      if (g === null || b.get(x, g, z) !== 'grass_block' || b.get(x, g + 1, z) !== 'air') continue;
      const facing = FACINGS[hashPosition(x, 1, z, 92) % 4];
      const amount = d < 4 ? 2 + (hashPosition(x, 2, z, 93) % 3) : 1 + (hashPosition(x, 2, z, 93) % 3);
      b.set(x, g + 1, z, `pink_petals[facing=${facing},flower_amount=${amount}]`);
    }
  }
  vegetation(b, { x: -GROUND_R, y: y0, z: -GROUND_R, width: GROUND_R * 2 + 1, depth: GROUND_R * 2 + 1, mix: 'wiese', density: 0.22, seed: 3 });
}
