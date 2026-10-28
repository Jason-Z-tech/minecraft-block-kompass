// Schaukasten der Natur-Bibliothek (js/builds/lib/natur.js): alle Baumarten in vier Größen, Büsche, Blumenbeete,
// Bewuchs, Hügel, Teich, Felsen und Wege auf einer Wiese. Dient zur Sichtprüfung (scripts/shot.mjs) und als Beispiel.

import {
  TREE_SPECIES, BUSH_LEAVES, FLOWER_BED_PALETTES, VEGETATION_MIXES, ROCK_MATERIALS, ROCK_SIZES,
  tree, bush, flowerBed, vegetation, terrain, hill, pond, rock, path, pathAlong,
} from '../../../js/builds/lib/natur.js';

export const meta = {
  id: 'showcase-natur',
  title: 'Schaukasten Natur',
  category: 'klein',
  subtitle: 'Bäume, Büsche, Blumen, Hügel, Teich, Felsen und Wege der Hilfsbibliothek',
  tags: ['Natur', 'Bäume', 'Gelände'],
  aliases: ['natur', 'baeume', 'schaukasten natur'],
  accuracy: 'eigenes',
  description: 'Alle Bausteine der Natur-Bibliothek nebeneinander: acht Baumarten in vier Größen, Büsche, Blumenbeete, Bewuchs, ein Hügel, ein Teich, Felsen und Wege.',
  sources: [],
  credits: null,
  tested: null,
};

const GROUND = 2; // Oberkante der Wiese
const ROWS = [
  { size: 'klein', z: 10, step: 10, x0: 6 },
  { size: 'mittel', z: 28, step: 14, x0: 8 },
  { size: 'gross', z: 50, step: 18, x0: 10 },
  { size: 'riesig', z: 80, step: 22, x0: 12 },
];

export default function build(b) {
  b.phase('Wiese');
  terrain(b, { x: 0, y: 0, z: 0, width: 180, depth: 170, height: GROUND });

  b.phase('Hügel');
  const mound = hill(b, { x: 2, y: GROUND, z: 104, width: 44, depth: 40, height: 10, facing: 'east', seed: 3 });

  b.phase('Teich');
  pond(b, { x: 52, y: GROUND, z: 104, width: 26, depth: 20, facing: 'south', waterDepth: 3, shore: 'gemischt', seed: 1 });
  pond(b, { x: 52, y: GROUND, z: 128, width: 12, depth: 10, facing: 'east', shore: 'sand', seed: 2 });
  pond(b, { x: 66, y: GROUND, z: 128, width: 12, depth: 10, facing: 'west', shore: 'kies', seed: 4 });

  b.phase('Wege');
  pathAlong(b, { y: GROUND, points: [[46, 152], [80, 152], [100, 140], [132, 140]], width: 3, wiggle: 1.5, mix: 'gemischt', seed: 5 });
  path(b, { x: 84, y: GROUND, z: 98, length: 60, width: 3, facing: 'south', mix: 'erde', seed: 6 });
  path(b, { x: 88, y: GROUND, z: 98, length: 60, width: 2, facing: 'south', mix: 'kies', seed: 7 });
  pathAlong(b, { y: GROUND + 12, points: [[46, 120], [36, 120], [26, 124]], width: 2, follow: true, wiggle: 0.5, seed: 8 });

  for (const row of ROWS) {
    b.phase(`Bäume ${row.size}`);
    TREE_SPECIES.forEach((species, i) => {
      tree(b, { x: row.x0 + i * row.step, y: GROUND + 1, z: row.z, species, size: row.size, seed: i });
    });
  }

  b.phase('Bäume auf dem Hügel');
  for (const [x, z, species, size] of [[14, 118, 'fichte', 'gross'], [22, 130, 'fichte', 'mittel'], [30, 112, 'birke', 'mittel'], [10, 134, 'fichte', 'klein']]) {
    const top = mound.top(x, z);
    if (top !== null) tree(b, { x, y: top + 1, z, species, size, seed: x });
  }

  b.phase('Felsen');
  ROCK_SIZES.forEach((size, i) => rock(b, { x: 96 + i * 9, y: GROUND + 1, z: 106, size, seed: i }));
  ROCK_MATERIALS.forEach((material, i) => rock(b, { x: 94 + i * 6, y: GROUND + 1, z: 122, size: 'mittel', material, facing: ['south', 'east', 'north', 'west'][i % 4], seed: i }));

  b.phase('Büsche');
  BUSH_LEAVES.forEach((leaves, i) => bush(b, { x: 96 + i * 5, y: GROUND + 1, z: 132, size: ['klein', 'mittel', 'gross'][i % 3], leaves, seed: i }));

  b.phase('Blumenbeete');
  FLOWER_BED_PALETTES.forEach((palette, i) => {
    flowerBed(b, {
      x: 140 + (i % 3) * 13, y: GROUND, z: 104 + Math.floor(i / 3) * 10, width: 11, depth: 7,
      palette, border: [null, 'stein', 'holz'][i % 3], facing: 'south', seed: i,
    });
  });

  b.phase('Bewuchs');
  VEGETATION_MIXES.forEach((mix, i) => vegetation(b, { x: 98 + i * 16, y: GROUND, z: 146, width: 14, depth: 18, mix, density: 0.5, seed: i }));
  vegetation(b, { x: 0, y: GROUND + 12, z: 104, width: 46, depth: 40, mix: 'wiese', density: 0.3, seed: 9 });
}
