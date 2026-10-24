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
  difficulty: 1,
  description: 'Drei Straßenlaternen zum Nachbauen, jede auf ihrem eigenen Stück Gehweg: rustikal aus Fichtenzaun mit einer Laterne am Holzarm, eine Stadtlaterne aus poliertem Schwarzstein mit Eisenketten und drei Laternen, und eine moderne Mastleuchte mit Endstab als LED und Tageslichtsensor als Solarmodul. So siehst du direkt, welcher Stil zu deinem Bau passt.',
  facts: [
    'Laternen leuchten mit Stärke 15, der Endstab der modernen Leuchte mit 14.',
    'Hängende Laternen brauchen einen Block darüber – ein Zaun, eine Kette oder ein Eisengitter reicht.',
    'Monster spawnen in 26.2 nur bei Blocklicht 0: eine Laterne alle 12 bis 14 Blöcke hält eine Straße frei.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const SEGMENTS = { rustic: [-4, 3], city: [4, 11], modern: [12, 19] };

function ground(b) {
  b.phase('Rasenstreifen', 'Die drei Laternen stehen nebeneinander auf einem Rasenstreifen von 24 × 8 Blöcken. Jeder Stil bekommt ein 8 Blöcke breites Stück Gehweg (3 Blöcke tief) mit Bordstein davor.', {
    tips: ['Baust du nur einen Stil nach, reicht sein eigener Abschnitt – die Maße gelten einzeln.'],
  });
  b.fill(-4, -1, -4, 19, -1, 3, 'dirt');
  b.fill(-4, 0, -4, 19, 0, 3, 'grass_block');
}

function rustic(b) {
  const [x0, x1] = SEGMENTS.rustic;
  b.phase('Stil 1: Rustikal aus Holz', 'Der Dorf-Stil: ein Pfahl aus Fichtenzaun auf einem Stamm, oben ein kurzer Arm mit hängender Laterne. Passt zu Holzhäusern, Bauernhöfen, Wegen im Wald und an Brücken.');
  b.step('Trampelpfad und Holzkante', 'Ersetze den Rasen im Gehweg durch Trampelpfad, grobe Erde und Kies (Schaufel auf Gras ergibt Trampelpfad). Vorne kommt als Kante ein liegender, geschälter Fichtenstamm in Ost-West-Richtung.');
  for (let x = x0; x <= x1; x++) {
    for (let z = -1; z <= 1; z++) {
      // Unter Laternenfuß und Fass (z = −1 bei x = 0 und 2) kein Trampelpfad: der würde im Spiel zu Erde.
      const underObject = z === -1 && (x === 0 || x === 2);
      b.set(x, 0, z, underObject ? 'coarse_dirt' : b.pickWeighted([['dirt_path', 5], ['coarse_dirt', 2], ['gravel', 2], ['rooted_dirt', 1]]));
    }
    b.set(x, 0, 2, `${spruce.strippedLog}[axis=x]`);
  }

  b.step('Pfahl und Arm', 'Stelle einen Fichtenstamm auf, darauf vier Fichtenzäune. An den obersten Zaun setzt du nach vorne (Süden) einen weiteren Zaun als Arm und hängst darunter eine Laterne: mit der Laterne in der Hand an die Unterseite des Arms klicken. Als Hut legst du eine geschlossene Fichtenfalltür auf den Pfahl: von oben auf den obersten Zaun klicken.');
  lampPost(b, { x: 0, y: 1, z: -1, facing: 'south', height: 5, post: spruce.fence, base: spruce.log, style: 'arm' });
  b.set(0, 6, -1, `${spruce.trapdoor}[facing=south,half=bottom,open=false]`);
  b.note(0, 4, 0, 'Rustikal: Laterne hängt am Zaun-Arm');

  b.step('Zaun und Fass', 'Hinter dem Gehweg läuft ein Fichtenzaun, neben der Laterne steht ein Fass.');
  b.fill(x0, 1, -2, x1, 1, -2, spruce.fence);
  b.set(2, 1, -1, 'barrel[facing=up,open=false]');
}

function city(b) {
  const [x0, x1] = SEGMENTS.city;
  b.phase('Stil 2: Stadt mit Eisen-Optik', 'Die Altstadt-Laterne: ein dunkler Mast aus poliertem Schwarzstein wie Gusseisen, zwei Arme mit Ketten und drei Laternen. Passt zu Steinhäusern, Plätzen, Brücken und Hafenmauern.');
  b.step('Pflaster und Bordstein', 'Lege den Gehweg aus Steinziegeln mit ein paar rissigen Steinziegeln und poliertem Andesit. Der Bordstein vorne ist aus glattem Stein.');
  floorPattern(b, { x: x0, y: 0, z: -1, width: x1 - x0 + 1, depth: 3, pattern: 'random', blocks: [['stone_bricks', 5], ['polished_andesite', 2], ['cracked_stone_bricks', 1]] });
  b.fill(x0, 0, 2, x1, 0, 2, 'smooth_stone');

  b.step('Mast', 'Setze einen gemeißelten polierten Schwarzstein als Sockel, darauf vier Mauern aus poliertem Schwarzstein übereinander und oben als Kopf einen polierten Schwarzstein.');
  b.set(8, 1, -1, 'chiseled_polished_blackstone');
  b.fill(8, 2, -1, 8, 5, -1, 'polished_blackstone_wall');
  b.set(8, 6, -1, 'polished_blackstone');

  b.step('Arme und Laternen', 'Setze links und rechts an den Kopf je ein Eisengitter als Arm – es verbindet sich mit dem Kopf zu einem schmalen Eisenträger. Unter jeden Arm kommen eine Kette und eine hängende Laterne. Auf den Kopf stellst du eine dritte Laterne.');
  for (const x of [7, 9]) {
    b.set(x, 6, -1, 'iron_bars');
    b.set(x, 5, -1, 'iron_chain[axis=y]');
    b.set(x, 4, -1, 'lantern[hanging=true]');
  }
  b.set(8, 7, -1, 'lantern[hanging=false]');
  b.note(8, 7, -1, 'Stadt: Schwarzstein-Mast mit drei Laternen');

  b.step('Geländer und Mülleimer', 'Hinter dem Gehweg steht eine niedrige Steinziegelmauer mit Eisengittern darauf, neben dem Mast ein Kessel als Mülleimer.');
  b.fill(x0, 1, -2, x1, 1, -2, 'stone_bricks');
  b.fill(x0, 2, -2, x1, 2, -2, 'iron_bars');
  b.set(10, 1, -1, 'cauldron');
}

function modern(b) {
  const [x0, x1] = SEGMENTS.modern;
  b.phase('Stil 3: Modern', 'Die moderne Mastleuchte: ein schlanker, hellgrauer Mast aus poliertem Tuffstein mit flachem Ausleger, darunter ein Endstab als LED-Leuchte und oben ein Tageslichtsensor als Solarmodul. Passt zu Häusern aus Beton, Glas und Quarz.');
  b.step('Platten und Kante', 'Lege den Gehweg in Streifen aus glattem Stein und poliertem Andesit, vorne eine Kante aus hellgrauem Beton.');
  floorPattern(b, { x: x0, y: 0, z: -1, width: x1 - x0 + 1, depth: 3, pattern: 'stripes', blocks: ['smooth_stone', 'polished_andesite'] });
  b.fill(x0, 0, 2, x1, 0, 2, 'light_gray_concrete');

  b.step('Mast', 'Setze hellgrauen Beton als Fuß, darauf fünf Mauern aus poliertem Tuffstein – sie ergeben einen dünnen, runden Mast – und oben einen polierten Tuffstein als Kopf.');
  b.set(16, 1, -1, 'light_gray_concrete');
  b.fill(16, 2, -1, 16, 6, -1, 'polished_tuff_wall');
  b.set(16, 7, -1, 'polished_tuff');

  b.step('Ausleger, LED und Solarmodul', 'Lege vorne an den Kopf drei untere Stufen aus poliertem Tuffstein als Ausleger – er reicht bis über die Bordsteinkante. Unter das vordere Ende kommt ein Endstab, der nach unten zeigt: klick dafür an die Unterseite der Stufe. Oben auf den Kopf setzt du einen Tageslichtsensor.');
  b.fill(16, 7, 0, 16, 7, 2, 'polished_tuff_slab[type=bottom]');
  b.set(16, 6, 2, 'end_rod[facing=down]');
  b.set(16, 8, -1, 'daylight_detector[inverted=false,power=0]');
  b.note(16, 6, 2, 'Modern: Endstab als LED-Leuchte');

  b.step('Hecke und Pflanzkübel', 'Hinter dem Gehweg wächst eine niedrige, geschnittene Hecke aus Eichenlaub; neben dem Mast steht eine Azalee im Topf.');
  b.fill(x0, 1, -2, x1, 1, -2, 'oak_leaves');
  b.set(18, 1, -1, 'potted_flowering_azalea_bush');
}

function greenery(b) {
  b.phase('Grün dahinter', 'Zum Schluss wird der Rasen hinter dem Gehweg bunt.');
  b.step('Gras und Blumen', 'Streue Gras, Wildblumen und ein paar hohe Blumen wie Pfingstrosen auf den Rasenstreifen hinter Zaun, Geländer und Hecke.');
  vegetation(b, { x: -4, y: 0, z: -4, width: 24, depth: 2, mix: 'blumen', shape: 'eckig', density: 0.45, seed: 7 });
}

export default function build(b) {
  ground(b);
  rustic(b);
  city(b);
  modern(b);
  greenery(b);
}
