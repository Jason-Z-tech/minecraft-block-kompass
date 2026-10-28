// Straßenlaternen: drei Stile nebeneinander auf einem Gehweg – rustikal (Holz), Stadt (Eisen-Optik), modern.
// Gehweg z = −1 … 1 auf y = 0, Laternen hinten bei z = −1, Vorderseite = Süden. Abschnitte je 8 Blöcke breit.

import { WOOD, lampPost, floorPattern, vegetation } from '../lib/index.js';

export const meta = {
  id: 'strassenlaternen',
  title: 'Straßenlaternen',
  category: 'klein',
  subtitle: 'Drei Laternen-Stile: rustikal aus Holz, Stadt mit Eisen-Optik und modern',
  tags: ['Laterne', 'Straßenlaterne', 'Licht', 'Beleuchtung', 'Deko', 'Straße', 'Dorf', 'Stadt', 'Modern', 'Klein', 'Anfänger'],
  aliases: [
    'strassenlaterne', 'straßenlaterne', 'strassenlaternen', 'straßenlaternen', 'laterne', 'laternen', 'laternenpfahl',
    'strassenlampe', 'straßenlampe', 'lampe', 'lampen', 'beleuchtung', 'strasenlaterne', 'laterne bauen',
    'street lamp', 'street lamps', 'street light', 'lamp post', 'lamppost', 'lantern post', 'streetlight',
  ],
  accuracy: 'eigenes',
  description: 'Drei Straßenlaternen zum Nachbauen, jede auf ihrem eigenen Stück Gehweg: rustikal aus Fichtenzaun mit einer Laterne am Holzarm, eine Stadtlaterne aus poliertem Schwarzstein mit Eisenketten und drei Laternen, und eine moderne Mastleuchte mit Endstab als LED und Tageslichtsensor als Solarmodul. So siehst du direkt, welcher Stil zu deinem Bau passt.',
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const SEGMENTS = { rustic: [-4, 3], city: [4, 11], modern: [12, 19] };

function ground(b) {
  b.phase('Rasenstreifen');
  b.fill(-4, -1, -4, 19, -1, 3, 'dirt');
  b.fill(-4, 0, -4, 19, 0, 3, 'grass_block');
}

function rustic(b) {
  const [x0, x1] = SEGMENTS.rustic;
  b.phase('Stil 1: Rustikal aus Holz');
  b.step();
  for (let x = x0; x <= x1; x++) {
    for (let z = -1; z <= 1; z++) {
      // Unter Laternenfuß und Fass (z = −1 bei x = 0 und 2) kein Trampelpfad: der würde im Spiel zu Erde.
      const underObject = z === -1 && (x === 0 || x === 2);
      b.set(x, 0, z, underObject ? 'coarse_dirt' : b.pickWeighted([['dirt_path', 5], ['coarse_dirt', 2], ['gravel', 2], ['rooted_dirt', 1]]));
    }
    b.set(x, 0, 2, `${spruce.strippedLog}[axis=x]`);
  }

  b.step();
  lampPost(b, { x: 0, y: 1, z: -1, facing: 'south', height: 5, post: spruce.fence, base: spruce.log, style: 'arm' });
  b.set(0, 6, -1, `${spruce.trapdoor}[facing=south,half=bottom,open=false]`);

  b.step();
  b.fill(x0, 1, -2, x1, 1, -2, spruce.fence);
  b.set(2, 1, -1, 'barrel[facing=up,open=false]');
}

function city(b) {
  const [x0, x1] = SEGMENTS.city;
  b.phase('Stil 2: Stadt mit Eisen-Optik');
  b.step();
  floorPattern(b, { x: x0, y: 0, z: -1, width: x1 - x0 + 1, depth: 3, pattern: 'random', blocks: [['stone_bricks', 5], ['polished_andesite', 2], ['cracked_stone_bricks', 1]] });
  b.fill(x0, 0, 2, x1, 0, 2, 'smooth_stone');

  b.step();
  b.set(8, 1, -1, 'chiseled_polished_blackstone');
  b.fill(8, 2, -1, 8, 5, -1, 'polished_blackstone_wall');
  b.set(8, 6, -1, 'polished_blackstone');

  b.step();
  for (const x of [7, 9]) {
    b.set(x, 6, -1, 'iron_bars');
    b.set(x, 5, -1, 'iron_chain[axis=y]');
    b.set(x, 4, -1, 'lantern[hanging=true]');
  }
  b.set(8, 7, -1, 'lantern[hanging=false]');

  b.step();
  b.fill(x0, 1, -2, x1, 1, -2, 'stone_bricks');
  b.fill(x0, 2, -2, x1, 2, -2, 'iron_bars');
  b.set(10, 1, -1, 'cauldron');
}

function modern(b) {
  const [x0, x1] = SEGMENTS.modern;
  b.phase('Stil 3: Modern');
  b.step();
  floorPattern(b, { x: x0, y: 0, z: -1, width: x1 - x0 + 1, depth: 3, pattern: 'stripes', blocks: ['smooth_stone', 'polished_andesite'] });
  b.fill(x0, 0, 2, x1, 0, 2, 'light_gray_concrete');

  b.step();
  b.set(16, 1, -1, 'light_gray_concrete');
  b.fill(16, 2, -1, 16, 6, -1, 'polished_tuff_wall');
  b.set(16, 7, -1, 'polished_tuff');

  b.step();
  b.fill(16, 7, 0, 16, 7, 2, 'polished_tuff_slab[type=bottom]');
  b.set(16, 6, 2, 'end_rod[facing=down]');
  b.set(16, 8, -1, 'daylight_detector[inverted=false,power=0]');

  b.step();
  b.fill(x0, 1, -2, x1, 1, -2, 'oak_leaves');
  b.set(18, 1, -1, 'potted_flowering_azalea_bush');
}

function greenery(b) {
  b.phase('Grün dahinter');
  b.step();
  vegetation(b, { x: -4, y: 0, z: -4, width: 24, depth: 2, mix: 'blumen', shape: 'eckig', density: 0.45, seed: 7 });
}

export default function build(b) {
  ground(b);
  rustic(b);
  city(b);
  modern(b);
  greenery(b);
}
