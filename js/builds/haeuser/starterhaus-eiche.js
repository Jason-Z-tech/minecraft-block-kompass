// Starterhaus aus Eiche: kleines Giebelhaus für den ersten Tag (7 × 9 Blöcke) mit Vorgarten.
// Bau-Rahmen: Haus x 0 … 6, z 0 … 8, Eingang im Süden (+z), Fußboden auf y = 0, Gelände auf y = −1.

import { WOOD, window, doorway, hangingLantern, gardenFence, floorPattern, lightRoom, tree, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'starterhaus-eiche',
  title: 'Starterhaus aus Eiche',
  category: 'haeuser',
  subtitle: 'Kleines Giebelhaus für die erste Nacht aus Eiche, Bruchstein und Glas, Dach aus Fichte',
  tags: ['Starterhaus', 'Anfänger', 'Erster Tag', 'Überleben', 'Survival', 'Eiche', 'Holzhaus', 'Klein', 'Giebeldach', 'Vorgarten', 'Günstig'],
  aliases: [
    'starterhaus', 'starter haus', 'startahaus', 'erstes haus', 'anfängerhaus', 'anfaengerhaus', 'einfaches haus', 'kleines haus',
    'holzhaus', 'eichenhaus', 'survival haus', 'überlebenshaus', 'haus für den ersten tag', 'starter house', 'oak starter house',
    'small oak house', 'simple house', 'first night house', 'survival house', 'beginner house',
  ],
  accuracy: 'eigenes',
  difficulty: 1,
  description: 'Ein gemütliches 7 × 9 Blöcke großes Haus für den ersten Tag: Eichenstämme an den Ecken, Bretterwände auf einem Bruchsteinsockel und ein Satteldach aus Fichte mit Überstand. Innen stehen Bett, Doppeltruhe, Werkbank und Ofen, zwei Laternen halten die Monster fern. Vor der Tür liegt ein kleiner Vorgarten mit Blumenbeeten, Zaun und Laternen.',
  facts: [
    'Grundfläche 7 × 9 Blöcke, innen 5 × 7 Blöcke und 3 Blöcke bis zu den Deckenbalken.',
    'Gebraucht werden vor allem Eichenbretter, Eichenstämme, Bruchstein, Fichtentreppen und ein paar Glasscheiben – alles am ersten Tag erreichbar.',
    'Die Fichte fürs Dach kannst du durch Eichentreppen und -stufen ersetzen, wenn du keine Fichten in der Nähe hast.',
    'Jedes begehbare Feld im Haus hat Blocklicht über 0, drinnen können also keine Monster erscheinen.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const oak = WOOD.eiche;
const spruce = WOOD.fichte;
const HOUSE = { x1: 0, z1: 0, x2: 6, z2: 8 };
const WALL_TOP = 4;

function ground(b) {
  b.phase('Bauplatz', 'Such dir eine ebene Wiese von etwa 20 × 21 Blöcken. Unter dem Haus liegt Erde, ringsum Gras – stehst du schon auf einer flachen Wiese, brauchst du hier nur den Weg.');
  b.step('Wiese', 'Die Wiese, auf der das Haus steht. Unter der Grundfläche (7 × 9) darf es auch Erde sein.');
  b.fill(-4, -1, -3, 15, -1, 17, 'grass_block');
  b.fill(HOUSE.x1, -1, HOUSE.z1, HOUSE.x2, -1, HOUSE.z2, 'dirt');
  b.step('Weg abstecken', 'Klick mit einer Schaufel auf das Gras, um einen Erdpfad zu machen: ein Block breit, von der Mitte der Südseite 7 Blöcke nach Süden. So weißt du gleich, wo die Haustür hinkommt.');
  floorPattern(b, { x: 3, y: -1, z: 10, width: 1, depth: 7, pattern: 'random', blocks: [['dirt_path', 5], ['coarse_dirt', 1]] });
}

// Blumen direkt ins Gras setzen (ohne den Boden zu tauschen), in kleinen Gruppen derselben Sorte.
function plantFlowers(b, { x1, z1, x2, z2, flowers }) {
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const group = Math.floor((x - x1) / 2) + (z - z1);
      b.set(x, 0, z, flowers[group % flowers.length]);
    }
  }
}

function foundation(b) {
  b.phase('Fundament', 'Lege einen Ring aus Bruchstein (7 × 9 Blöcke) und fülle ihn innen mit Eichenbrettern. Das ist zugleich dein Fußboden.', {
    tips: ['Setze zuerst die vier Ecken und zähle dann die Seiten ab: 7 Blöcke nach Osten, 9 nach Süden.'],
  });
  b.fill(HOUSE.x1, 0, HOUSE.z1, HOUSE.x2, 0, HOUSE.z2, 'cobblestone');
  b.fill(HOUSE.x1 + 1, 0, HOUSE.z1 + 1, HOUSE.x2 - 1, 0, HOUSE.z2 - 1, oak.planks);
}

function walls(b) {
  b.phase('Wände', 'Erst die Stämme, dann die Bretter: so bleiben die Ecken sauber.');
  b.step('Eckpfosten', 'Stell auf jede Ecke des Sockels einen Eichenstamm, 4 Blöcke hoch. In der Mitte der langen Seiten (Ost und West) kommt je ein weiterer Pfosten dazu.');
  const posts = [[0, 0], [6, 0], [0, 8], [6, 8], [0, 4], [6, 4]];
  for (const [x, z] of posts) b.fill(x, 1, z, x, WALL_TOP, z, `${oak.log}[axis=y]`);
  b.step('Bretterwände', 'Fülle zwischen den Pfosten die Wände mit Eichenbrettern, 3 Blöcke hoch. Lass dabei die Öffnungen frei: die Tür in der Mitte der Südwand (2 hoch) und sieben Fenster, je 1 breit und 2 hoch auf der 2. und 3. Lage – zwei vorne, je zwei an den Seiten und eins hinten. Die 3D-Ansicht zeigt sie als Lücken.');
  for (let y = 1; y < WALL_TOP; y++) {
    b.fill(1, y, 0, 5, y, 0, oak.planks);
    b.fill(1, y, 8, 5, y, 8, oak.planks);
    b.fill(0, y, 1, 0, y, 3, oak.planks);
    b.fill(0, y, 5, 0, y, 7, oak.planks);
    b.fill(6, y, 1, 6, y, 3, oak.planks);
    b.fill(6, y, 5, 6, y, 7, oak.planks);
  }
  b.step('Ringbalken', 'Leg oben einen Ring aus liegenden Eichenstämmen auf die Wände. Klick dazu immer auf die Seite, die in Wandrichtung zeigt (am Eckpfosten bzw. am Ende des vorigen Stamms) – dann liegt der neue Stamm entlang der Wand.');
  b.fill(1, WALL_TOP, 0, 5, WALL_TOP, 0, `${oak.log}[axis=x]`);
  b.fill(1, WALL_TOP, 8, 5, WALL_TOP, 8, `${oak.log}[axis=x]`);
  b.fill(0, WALL_TOP, 1, 0, WALL_TOP, 3, `${oak.log}[axis=z]`);
  b.fill(0, WALL_TOP, 5, 0, WALL_TOP, 7, `${oak.log}[axis=z]`);
  b.fill(6, WALL_TOP, 1, 6, WALL_TOP, 3, `${oak.log}[axis=z]`);
  b.fill(6, WALL_TOP, 5, 6, WALL_TOP, 7, `${oak.log}[axis=z]`);
  b.step('Deckenbalken', 'Spanne zwei Balken aus je 5 liegenden Eichenstämmen quer durchs Haus (von Westen nach Osten) auf Höhe des Ringbalkens, den ersten 3 Blöcke von der Nordwand, den zweiten 3 Blöcke weiter südlich. Daran hängst du später die Laternen.');
  for (const z of [3, 6]) b.fill(1, WALL_TOP, z, 5, WALL_TOP, z, `${oak.log}[axis=x]`);
}

function roof(b) {
  b.phase('Dach', 'Das Satteldach aus Fichtentreppen läuft von Norden nach Süden und steht ringsum einen Block über. Die Giebeldreiecke vorne und hinten füllst du mit Eichenbrettern.', {
    tips: [
      'Stell dich beim Setzen der Treppen auf die Traufseite und schau zur Firstmitte – dann zeigt die hohe Seite der Treppe nach innen.',
      'Die äußerste Treppenreihe sitzt neben dem Ringbalken, die nächste genau darauf. In der Mitte bildet eine Reihe Fichtenstufen den First.',
      'Für den Überstand vorne und hinten brauchst du keine Gerüstblöcke: jede Treppe hält an ihrer Nachbarin.',
    ],
  });
  b.roof({ x1: HOUSE.x1, z1: HOUSE.z1, x2: HOUSE.x2, z2: HOUSE.z2, y: WALL_TOP, type: 'gable', axis: 'z', stairs: spruce.stairs, slab: spruce.slab, full: oak.planks, overhang: 1 });

  b.phase('Dachkante', 'Unter die Dachtreppen über den Giebeln (vorne und hinten) kommt je eine umgedrehte Fichtentreppe mit derselben Blickrichtung, unter die Firststufe eine obere Stufe. Die Dachkante wirkt so doppelt so dick.', {
    tips: ['Umgedrehte Treppen setzt du, indem du auf die obere Hälfte der Blockseite klickst, an der sie haften sollen.'],
  });
  for (const z of [HOUSE.z1 - 1, HOUSE.z2 + 1]) {
    for (let x = HOUSE.x1 - 1; x <= HOUSE.x2 + 1; x++) {
      const k = Math.min(x - (HOUSE.x1 - 1), HOUSE.x2 + 1 - x);
      if (x === 3) b.slab(x, WALL_TOP + k - 1, z, spruce.slab, { type: 'top' });
      else b.stairs(x, WALL_TOP + k - 1, z, spruce.stairs, { facing: x < 3 ? 'east' : 'west', half: 'top' });
    }
  }
}

function openings(b) {
  b.phase('Fenster und Tür', 'Jetzt setzt du Glas, Tür und Blumenkästen in die freigelassenen Öffnungen.');
  b.step('Haustür mit Vordach', 'Die Eichentür kommt in die Mitte der Südwand. Darüber hängt ein kleines Vordach aus Fichtentreppen auf zwei umgedrehten Treppen, davor liegt eine Bruchsteinstufe.');
  doorway(b, { x: 3, y: 1, z: 8, facing: 'south', door: oak.door, frame: null, canopy: spruce.stairs, step: 'cobblestone_stairs' });
  b.step('Vorderfenster mit Blumenkästen', 'Links und rechts der Tür je ein Fenster aus zwei Glasscheiben übereinander. Darunter baust du einen Blumenkasten: Wurzelerde, ringsum Falltüren, obenauf Blumen.');
  for (const x of [1, 5]) window(b, { x, y: 2, z: 8, facing: 'south', height: 2, flowerBox: { trapdoor: oak.trapdoor } });
  b.step('Seitenfenster', 'Je zwei Fenster in der West- und Ostwand, eines hinten über den Truhen. Unter jedes Fenster kommt eine umgedrehte Eichentreppe als Fensterbank.');
  for (const z of [2, 6]) {
    window(b, { x: 0, y: 2, z, facing: 'west', height: 2, sill: oak.stairs });
    window(b, { x: 6, y: 2, z, facing: 'east', height: 2, sill: oak.stairs });
  }
  window(b, { x: 3, y: 2, z: 0, facing: 'north', height: 2, sill: oak.stairs });
  b.step('Giebelfenster', 'In jedes Giebeldreieck kommt eine einzelne Glasscheibe, so fällt Licht unter das Dach.');
  b.set(3, 6, 8, 'glass_pane');
  b.set(3, 6, 0, 'glass_pane');
}

function interior(b) {
  b.phase('Einrichtung', 'Alles, was du in der ersten Nacht brauchst – an die Wände gestellt, damit die Mitte frei bleibt.');
  b.step('Schlafecke', 'Das rote Bett steht in der Nordwest-Ecke mit dem Kopfteil an der Nordwand: stell dich südlich davor und schau beim Setzen nach Norden. Daneben ein Fass als Nachttisch mit einer Laterne.');
  b.bed(1, 1, 2, 'red_bed', { facing: 'north' });
  b.set(2, 1, 1, 'barrel[facing=up]');
  b.set(2, 2, 1, 'lantern[hanging=false]');
  b.step('Truhen und Werkplatz', 'An der Nordwand eine Doppeltruhe (zwei Truhen nebeneinander), in der Ecke die Werkbank. An der Ostwand steht der Ofen mit der Öffnung zum Raum.');
  b.set(3, 1, 1, 'chest[facing=south,type=right]');
  b.set(4, 1, 1, 'chest[facing=south,type=left]');
  b.set(5, 1, 1, 'crafting_table');
  b.set(5, 1, 2, 'furnace[facing=west,lit=false]');
  b.set(5, 2, 1, 'potted_red_tulip');
  b.step('Teppich', 'Ein Teppich aus weißer und brauner Wolle macht den Boden wohnlich (3 × 3 Felder in der Raummitte).');
  for (let x = 2; x <= 4; x++) for (let z = 3; z <= 5; z++) b.set(x, 1, z, (x + z) % 2 === 0 ? 'brown_carpet' : 'white_carpet');
  b.set(1, 1, 7, 'barrel[facing=up]');
  b.set(1, 2, 7, 'potted_fern');
}

function lights(b) {
  b.phase('Licht', 'Häng an jeden Deckenbalken eine Laterne. Zusammen mit der Laterne auf dem Nachttisch ist dann jedes Feld im Haus hell genug, dass keine Monster erscheinen.');
  hangingLantern(b, { x: 3, y: WALL_TOP - 1, z: 3, chain: 0 });
  hangingLantern(b, { x: 3, y: WALL_TOP - 1, z: 6, chain: 0 });
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 5, y2: WALL_TOP - 1, z2: 7 });
}

function garden(b) {
  b.phase('Vorgarten', 'Zum Schluss der kleine Vorgarten: Blumen, ein Zaun mit Laternen und etwas Grün ums Haus.');
  b.step('Blumen', 'Links und rechts vom Weg pflanzt du je ein kleines Blumenfeld (3 × 2 Blöcke) direkt ins Gras – links rot und gelb, rechts blau und weiß.');
  plantFlowers(b, { x1: 0, z1: 11, x2: 2, z2: 12, flowers: ['poppy', 'dandelion', 'red_tulip'] });
  plantFlowers(b, { x1: 4, z1: 11, x2: 6, z2: 12, flowers: ['cornflower', 'oxeye_daisy', 'azure_bluet'] });
  b.step('Gartenzaun', 'Der Eichenzaun umschließt den Vorgarten (9 × 7 Blöcke). Das Tor sitzt in der Mitte vorne, daneben zwei Pfosten aus geschältem Eichenstamm mit Laternen.');
  gardenFence(b, { x: -1, y: 0, z: 9, facing: 'south', width: 9, depth: 7, fence: oak.fence, gate: oak.fenceGate, sides: ['front', 'left', 'right'], posts: oak.strippedLog, lanterns: true });
  b.step('Baum und Büsche', 'Hinter dem Haus wächst eine Eiche, an den hinteren Ecken stehen kleine Büsche aus Eichenlaub.');
  tree(b, { x: 12, y: 0, z: 3, species: 'eiche', size: 'mittel', seed: 7 });
  bush(b, { x: -2, y: 0, z: -1, size: 'klein', leaves: 'eiche', seed: 1 });
  bush(b, { x: 9, y: 0, z: 7, size: 'klein', leaves: 'eiche', seed: 2 });
  b.step('Wiese', 'Ein paar Grasbüschel und Blumen auf der Wiese – mit Knochenmehl auf Gras geht das ganz schnell.');
  vegetation(b, { x: -4, y: 0, z: -3, width: 20, depth: 21, mix: 'wiese', density: 0.25, shape: 'eckig', seed: 9 });
}

export default function build(b) {
  ground(b);
  foundation(b);
  walls(b);
  roof(b);
  openings(b);
  interior(b);
  lights(b);
  garden(b);
}
