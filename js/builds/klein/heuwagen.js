// Heuwagen – Leiterwagen aus Fichtenholz auf einem Feldweg: große Hinterräder (2 × 2 Falltüren), kleine Vorderräder,
// Ladefläche mit Bordwänden, Heuballen-Ladung, Kutschbock mit Fass und Deichsel. Der Wagen steht längs der x-Achse,
// vorne (Deichsel) ist Osten; die Ladefläche liegt auf y = 3.

import { terrain, vegetation, path, bush, isPlantId } from '../lib/natur.js';
import { stateId } from '../../core/blockstate.js';

export const meta = {
  id: 'heuwagen',
  title: 'Heuwagen',
  category: 'klein',
  subtitle: 'Holzwagen mit Heuladung, Falltür-Rädern und Deichsel',
  tags: ['Wagen', 'Heu', 'Bauernhof', 'Dorf', 'Deko', 'Mittelalter', 'Holz', 'Schnell gebaut', 'Feldweg'],
  aliases: [
    'heuwagen', 'heu wagen', 'heuwägen', 'leiterwagen', 'holzwagen', 'bauernwagen', 'karren', 'handkarren', 'ochsenkarren',
    'pferdewagen', 'wagen', 'erntewagen', 'heukarren', 'fuhrwerk',
    'hay wagon', 'hay cart', 'haywagon', 'cart', 'wagon', 'farm cart', 'wooden cart', 'medieval cart',
  ],
  accuracy: 'eigenes',
  difficulty: 1,
  description: 'Ein Leiterwagen voller Heu, wie er auf jedem Bauernhof stehen könnte. Die großen Hinterräder bestehen aus je vier offenen Schwarzeichenholzfalltüren, die kleinen Vorderräder aus einer; darüber liegt die Ladefläche aus Fichtenholz mit Bordwänden aus Fichtenholzfalltüren. Hinten türmen sich die Heuballen, vorne sitzt der Kutschbock mit einem Fass, und die Deichsel liegt auf dem Feldweg.',
  facts: [
    'Eine offene Falltür liegt flach an der Seite ihres Blocks – genau so entstehen die Räder und die Bordwände.',
    'Die Hinterräder sind 2 × 2 Blöcke groß, die Vorderräder nur 1 × 1: wie bei echten Leiterwagen, damit die Vorderachse unter dem Wagen einlenken kann.',
    'Heuballen sind wie Stämme ausrichtbar; gemischt liegend und quer wirkt die Ladung lockerer.',
    'Ein Heuballen dämpft den Fall: wer darauf springt, nimmt nur ein Fünftel des Fallschadens.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const GROUND_Y = 1;
const BED_Y = 3;
const BED = { x1: -3, x2: 2, z1: -1, z2: 1 };
const WHEEL = 'dark_oak_trapdoor';
const BOARD = 'spruce_trapdoor';
const AXLE = 'stripped_spruce_log[axis=z]';
const AXLES = [-3, -2, 1];
const DRAWBAR = [[2, 0], [3, 0], [4, 0], [4, -1], [4, 1]];
const GROUND_HAY = [[-5, 3], [-4, 3]];
const GROUND_BARREL = [3, -3];

// Offene Falltür als Platte an der Wagenseite: die Platte liegt auf der Seite gegenüber von facing.
function plate(b, x, y, z, id, facing) {
  b.set(x, y, z, `${id}[facing=${facing},half=bottom,open=true]`);
}

// Heuballen der Ladung: [x, y, z, axis].
function hayLoad() {
  const hay = [];
  for (let x = BED.x1; x <= 1; x++) for (let z = -1; z <= 1; z++) hay.push([x, BED_Y + 1, z, 'x']);
  for (let x = BED.x1; x <= 0; x++) {
    for (let z = -1; z <= 1; z++) {
      if (x === BED.x1 && z !== 0) continue;
      hay.push([x, BED_Y + 2, z, (x + z) % 2 === 0 ? 'z' : 'x']);
    }
  }
  for (const [x, z] of [[-2, 0], [-1, 0], [-1, -1]]) hay.push([x, BED_Y + 3, z, 'x']);
  return hay;
}


// Bewuchs nur auf Gras: Pflanzen, die vegetation() auf grobe Erde gesetzt hat, wieder entfernen (auch obere Hälften).
function clearPlantsOffGrass(b, { x1, z1, x2, z2, y }) {
  let removed = 0;
  for (let z = z1; z <= z2; z++) {
    for (let x = x1; x <= x2; x++) {
      const id = stateId(b.get(x, y, z));
      if (id === 'air' || !isPlantId(id) || stateId(b.get(x, y - 1, z)) === 'grass_block') continue;
      for (let k = 0; k < 2 && isPlantId(stateId(b.get(x, y + k, z))); k++) b.remove(x, y + k, z);
      removed++;
    }
  }
  return removed;
}

export default function build(b) {
  // --- Bauplatz ---
  b.phase('Bauplatz', 'Der Wagen steht auf einem Feldweg aus Erdpfad, grober Erde und Kies, der von West nach Ost über eine kleine Wiese führt (17 × 13 Blöcke).', {
    tips: ['Einen Erdpfad machst du mit einer Schaufel aus Gras. Unter Blöcken wird er im Spiel zu Erde – deshalb liegt unter den Rädern grobe Erde.'],
  });
  terrain(b, { x: -8, y: 0, z: -6, width: 17, depth: 13, height: GROUND_Y, shape: 'rund', seed: 9 });
  path(b, { x: -8, y: GROUND_Y, z: 0, facing: 'east', length: 17, width: 5, mix: 'erde', wiggle: 0.8, seed: 4 });
  // Unter allem, was später auf dem Weg steht, liegt grobe Erde statt Erdpfad.
  const footprint = [...DRAWBAR, ...GROUND_HAY, GROUND_BARREL];
  for (const x of AXLES) for (let z = BED.z1 - 1; z <= BED.z2 + 1; z++) footprint.push([x, z]);
  for (const [x, z] of footprint) if (b.get(x, GROUND_Y, z) === 'dirt_path') b.set(x, GROUND_Y, z, 'coarse_dirt');

  // --- Fahrgestell ---
  b.phase('Fahrgestell und Ladefläche', 'Unter der Ladefläche liegen zwei Achsen aus geschältem Fichtenstamm quer zum Wagen: hinten zwei Blöcke breit für die großen Räder, vorne einer. Darauf kommt die Ladefläche, 6 Blöcke lang und 3 breit, aus Fichtenholzbrettern.', {
    tips: ['Stelle den Wagen leicht seitlich auf den Weg – so wirkt er abgestellt und nicht hingestellt.'],
  });
  b.step('Achsen', 'Lege auf den Weg hinten zwei Reihen und vorne eine Reihe geschälter Fichtenstämme, je 3 Blöcke lang quer zur Fahrtrichtung (Nord–Süd). Zwischen den Achsen bleiben zwei Blöcke frei.');
  for (const x of AXLES) for (let z = BED.z1; z <= BED.z2; z++) b.set(x, BED_Y - 1, z, AXLE);
  b.step('Ladefläche', 'Lege 6 × 3 Fichtenholzbretter auf die Achsen. Hinten schließt die Ladefläche mit der Achse ab, vorne ragt sie einen Block über die Vorderachse hinaus.');
  b.fill(BED.x1, BED_Y, BED.z1, BED.x2, BED_Y, BED.z2, 'spruce_planks');

  // --- Räder ---
  b.phase('Räder', 'Die Räder sind offene Schwarzeichenholzfalltüren – dunkler als die Bordwände, damit man sie gut unterscheidet –, die flach an der Außenseite von Achsen und Ladefläche anliegen: hinten je vier (2 × 2), vorne je eine.', {
    tips: ['Eine Falltür, die du gegen die Seite eines Blocks setzt und dann mit Rechtsklick öffnest, klappt flach an diese Seite.'],
  });
  b.step('Hinterräder', 'Setze an beide Seiten der hinteren Achsen und der Ladefläche je vier Schwarzeichenholzfalltüren und öffne sie: zwei an den Achsen, zwei darüber an der Ladefläche.');
  for (const x of [AXLES[0], AXLES[1]]) {
    for (const y of [BED_Y - 1, BED_Y]) {
      plate(b, x, y, BED.z2 + 1, WHEEL, 'south');
      plate(b, x, y, BED.z1 - 1, WHEEL, 'north');
    }
  }
  b.step('Vorderräder', 'Die Vorderräder sind je eine offene Schwarzeichenholzfalltür an den Enden der vorderen Achse.');
  plate(b, AXLES[2], BED_Y - 1, BED.z2 + 1, WHEEL, 'south');
  plate(b, AXLES[2], BED_Y - 1, BED.z1 - 1, WHEEL, 'north');

  // --- Heu ---
  b.phase('Heuladung', 'Auf der Ladefläche türmt sich das Heu in drei Lagen: unten 5 × 3 Heuballen, darüber eine kürzere Lage mit abgerundeten Ecken, oben ein kleiner Gipfel aus drei Ballen. Leg die Ballen mal längs, mal quer. Die vorderste Reihe der Ladefläche bleibt frei für den Kutschbock.', {
    tips: ['Ein Heuballen entsteht aus 9 Weizen – für die 28 Ballen auf dem Wagen und die 3 daneben brauchst du 279 Weizen.'],
  });
  for (const [x, y, z, axis] of hayLoad()) b.set(x, y, z, `hay_block[axis=${axis}]`);

  // --- Bordwände, Kutschbock und Deichsel ---
  b.phase('Bordwände, Kutschbock und Deichsel', 'Niedrige Bordwände aus offenen Falltüren halten das Heu an den Seiten und hinten. Vorne sitzt der Kutschbock: zwei Fichtenholztreppen mit der Lehne zum Heu, daneben ein Fass, davor ein Fußbrett. Vor dem Wagen liegt die Deichsel aus Fichtenholzzäunen mit einem Querholz am Ende.', {
    tips: ['Die Zäune der Deichsel verbinden sich von selbst mit der vorderen Achse und miteinander.'],
  });
  b.step('Bordwände', 'Setze auf beiden Langseiten neben die unterste Heulage je fünf Falltüren und öffne sie, hinten drei quer.');
  for (let x = BED.x1; x <= 1; x++) {
    plate(b, x, BED_Y + 1, BED.z2 + 1, BOARD, 'south');
    plate(b, x, BED_Y + 1, BED.z1 - 1, BOARD, 'north');
  }
  for (let z = BED.z1; z <= BED.z2; z++) plate(b, BED.x1 - 1, BED_Y + 1, z, BOARD, 'west');
  b.step('Kutschbock und Fass', 'Setze auf die vorderste Reihe zwei Fichtenholztreppen mit der hohen Seite nach Westen (zum Heu) und ein Fass auf die Südecke. Vorne an die Ladefläche kommen drei offene Falltüren als Fußbrett.');
  b.stairs(BED.x2, BED_Y + 1, -1, 'spruce_stairs', { facing: 'west' });
  b.stairs(BED.x2, BED_Y + 1, 0, 'spruce_stairs', { facing: 'west' });
  b.set(BED.x2, BED_Y + 1, 1, 'barrel[facing=up,open=false]');
  for (let z = BED.z1; z <= BED.z2; z++) plate(b, BED.x2 + 1, BED_Y, z, BOARD, 'east');
  b.note(BED.x2, BED_Y + 1, 0, 'Kutschbock: zwei Treppen, Lehne zum Heu');
  b.step('Deichsel', 'Die Deichsel ist eine Reihe aus drei Fichtenholzzäunen, die von der vorderen Achse nach Osten auf dem Weg liegt; am Ende kommt quer ein Zaun links und rechts dazu.');
  for (const [x, z] of DRAWBAR) b.set(x, BED_Y - 1, z, 'spruce_fence');

  // --- Umgebung ---
  b.phase('Wegrand', 'Neben dem Wagen liegt ein heruntergefallener Heuballen, ein Fass steht am Weg, ein Busch und Wiesenblumen säumen den Rand.', {
    tips: ['Lass den Wagen nicht genau in der Mitte des Wegs stehen – leicht seitlich wirkt er abgestellt.'],
  });
  b.set(GROUND_HAY[0][0], GROUND_Y + 1, GROUND_HAY[0][1], 'hay_block[axis=z]');
  b.set(GROUND_HAY[1][0], GROUND_Y + 1, GROUND_HAY[1][1], 'hay_block[axis=y]');
  b.set(GROUND_HAY[1][0], GROUND_Y + 2, GROUND_HAY[1][1], 'hay_block[axis=x]');
  b.set(GROUND_BARREL[0], GROUND_Y + 1, GROUND_BARREL[1], 'barrel[facing=north,open=false]');
  bush(b, { x: 6, y: GROUND_Y + 1, z: -4, size: 'klein', leaves: 'eiche', seed: 3 });
  vegetation(b, { x: -8, y: GROUND_Y + 1, z: -6, width: 17, depth: 13, mix: 'blumen', density: 0.3, seed: 6 });
  clearPlantsOffGrass(b, { x1: -8, z1: -6, x2: 8, z2: 6, y: GROUND_Y + 1 });
}
