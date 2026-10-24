// Eisenfarm: drei Dorfbewohner schlafen in einem Glasraum über einer Wasserplattform, ein Zombie schaut
// von oben zu und versetzt sie in Panik – dann rufen sie Eisengolems. Die Golems spawnen auf der
// Plattform, das Wasser schiebt sie in eine Grube, wo eine Lavaklinge über Schildern sie verbrennt.
// Eisen und Mohnblumen schwimmen zu zwei Trichtern und fallen in die Truhe.
// Lokale Koordinaten: Wiese bis y = 0, Plattformboden y = 6 (x 0…8, z 0…7), Grube z 8…9 (Boden y = 2,
// Lava y = 5), Dorfbewohner-Raum y = 11 (x 3…5, z 3…4), Zombie y = 14 (x 4, z 2). Vorderseite = Süden.

import { WOOD, terrain, path, bush, tree, vegetation, flowerBed, lightRoom } from '../lib/index.js';

export const meta = {
  id: 'eisenfarm',
  title: 'Eisenfarm',
  category: 'farmen',
  subtitle: 'Drei Dorfbewohner, ein Zombie und eine Lavaklinge für Eisengolems',
  tags: ['Farm', 'Eisen', 'Eisengolem', 'Golem', 'Dorfbewohner', 'Zombie', 'Panik', 'Lava', 'Trichter', 'Automatisch', 'Fortgeschritten'],
  aliases: [
    'eisenfarm', 'eisen farm', 'eisengolemfarm', 'eisengolem farm', 'golemfarm', 'golem farm', 'iron farm', 'iron golem farm',
    'ironfarm', 'eisnfarm', 'eisenfram', 'eisen golem farm', 'panik farm', 'villager iron farm', 'dorfbewohner eisenfarm',
    'eisenbarren farm', 'iron ingot farm', 'mohnfarm',
  ],
  accuracy: 'vorlage',
  difficulty: 4,
  description: 'Drei Dorfbewohner schlafen in einem kleinen Glasraum über einer Wasserplattform, jeder mit eigenem Bett und Arbeitsplatz. Über ihnen steht ein Zombie in einer Zelle, den sie sehen, aber nicht erreichen können – sie geraten in Panik und rufen etwa alle 35 Sekunden einen Eisengolem. Der Golem erscheint auf der Plattform, das Wasser schiebt ihn in eine Grube, wo sein Kopf in eine Lavaklinge über Schildern ragt. Eisenbarren und Mohnblumen schwimmen zu zwei Trichtern und landen in der Truhe.',
  facts: [
    'Dorfbewohner rufen einen Golem nur, wenn sie in den letzten 20 Minuten geschlafen haben – darum braucht jeder ein eigenes Bett.',
    'Zum Rufen in Panik reichen drei Dorfbewohner innerhalb von 10 Blöcken. Mindestens einer muss den Zombie sehen; Glas versperrt die Sicht.',
    'Ein Golem erscheint höchstens 8 Blöcke zur Seite und 6 Blöcke höher oder tiefer als der rufende Dorfbewohner, auf dem obersten passenden Block der gewählten Säule – nie auf Glas oder Laub.',
    'Hat ein Dorfbewohner in den letzten 30 Sekunden einen Golem in 16 Blöcken Umkreis bemerkt, ruft er keinen neuen.',
    'Ein Eisengolem lässt 3 bis 5 Eisenbarren und manchmal Mohnblumen fallen. Arbeitsplätze sind für die Farm nicht nötig, aber sie stören auch nicht.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Eisengolem-Farm (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Iron_golem_farming' },
    { title: 'Minecraft Wiki: Eisengolem (englisch)', url: 'https://minecraft.wiki/w/Iron_Golem' },
    { title: 'Minecraft Wiki: Dorfbewohner (englisch)', url: 'https://minecraft.wiki/w/Villager' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const STONE = 'stone_bricks';
const DARK = 'polished_andesite';
const PLATFORM_Y = 6;
const PIT_FLOOR_Y = 2;
const LAVA_Y = 5;
const VILLAGER_Y = 11;
const ROOM_X = [3, 4, 5];
const ZOMBIE = { x: 4, y: VILLAGER_Y + 3, z: 2 };
const WORKSTATIONS = ['fletching_table', 'composter[level=0]', 'smithing_table'];
const BEDS = ['red_bed', 'blue_bed', 'yellow_bed'];

const isPlatformEdge = (x, z) => x === -1 || x === 9 || z === -1;

// Vorderwand der Grube: Lisene in der Mitte, sonst Steinziegel mit festen Moos- und Rissflecken.
function frontWallBlock(x, y) {
  if (x === 4) return DARK;
  const h = (x * 5 + y * 3) % 7;
  if (h === 0) return 'mossy_stone_bricks';
  return h === 3 ? 'cracked_stone_bricks' : STONE;
}

function base(b) {
  b.phase('Unterbau', 'Die Plattform steht sechs Blöcke über dem Boden auf Steinpfeilern. Das ist wichtig: Golems erscheinen höchstens 6 Blöcke unter einem Dorfbewohner – der Boden ist dann zu tief, und sie spawnen nur auf der Plattform statt irgendwo in der Wiese.', {
    tips: [
      'Bau die Farm mindestens 100 Blöcke von jedem Dorf entfernt, sonst gehören deine Dorfbewohner zum Dorf und die Farm funktioniert schlechter.',
      'Setz zuerst die sechs Pfeiler, dann ist der Rest wie ein großer Tisch.',
    ],
  });
  terrain(b, { x: -9, y: -1, z: -8, width: 27, depth: 27, height: 1, seed: 'eisenfarm' });
  b.step('Pfeiler', `Stell sechs Pfeiler aus poliertem Andesit von Ebene 2 bis ${PLATFORM_Y + 1} auf: an den Ecken (x = −1 und 9, z = −1) und in der Mitte der Seiten (x = −1 und 9, z = 3), dazu die beiden vorderen Ecken der Grube (x = −1 und 9, z = 10).`);
  for (const x of [-1, 9]) {
    for (const z of [-1, 3, 10]) {
      for (let y = 1; y <= PLATFORM_Y; y++) {
        if (x === 9 && z === 10 && y <= 2) continue;
        b.set(x, y, z, DARK);
      }
    }
  }
}

function pit(b) {
  b.phase('Grube und Truhe', 'Vorne liegt die Grube, in der die Golems sterben: 9 Blöcke lang, 2 breit. Ihr Boden ist ein Wasserlauf, der alles zu zwei Trichtern am Ostende schwemmt. Darunter steht die Truhe in einer kleinen Nische.', {
    tips: [
      'Golems sind 1,4 Blöcke breit – in eine 1 Block breite Grube würden sie nicht hineinpassen.',
      'Die Trichter setzt du schleichend auf die Truhe, damit sie nach unten zeigen.',
    ],
  });
  b.step('Truhe und Trichter', `Stell bei x = 8 eine Doppeltruhe auf Ebene 2 (z = 8 und 9), die Öffnung nach Osten. Darauf (Ebene ${PIT_FLOOR_Y + 1}) zwei Trichter, die nach unten zeigen. Östlich davor (x = 9) bleibt die Nische zwei Blöcke hoch frei, von dort öffnest du die Truhe.`);
  for (const z of [8, 9]) {
    b.set(8, 1, z, 'chest[facing=east]');
    b.set(8, PIT_FLOOR_Y, z, 'hopper[facing=down]');
  }
  b.note(8, 1, 8, 'Truhe: Eisenbarren und Mohnblumen');

  b.step('Grubenboden und Wände', `Leg den Grubenboden aus Steinziegeln auf Ebene ${PIT_FLOOR_Y + 1} (x = 0 bis 7, z = 8 und 9) und füll darunter (Ebene 2) auf. Mauere die Wände: hinten (z = 7) bis Ebene ${LAVA_Y + 1}, vorne (z = 10) bis Ebene ${PLATFORM_Y + 1}, die Enden (x = −1 und 9) von Ebene ${PIT_FLOOR_Y + 1} (Westen) bzw. ${PIT_FLOOR_Y + 2} (Osten, über der Nische) bis ${PLATFORM_Y + 1}. Die Vorderwand bekommt in der Mitte eine Lisene aus poliertem Andesit und unten einen Sockel aus Steinziegeltreppen (Ebene 2, z = 11, hohe Seite zur Wand). Verzierungen, die vorstehen, gehören nur ganz nach unten: Weiter oben könnte ein Golem auf ihnen erscheinen.`);
  for (let x = 0; x <= 7; x++) {
    for (const z of [8, 9]) {
      b.set(x, 1, z, 'cobblestone');
      b.set(x, PIT_FLOOR_Y, z, STONE);
    }
  }
  for (let x = 0; x <= 8; x++) {
    for (let y = 1; y <= LAVA_Y; y++) b.set(x, y, 7, STONE);
    for (let y = 1; y <= PLATFORM_Y; y++) b.set(x, y, 10, frontWallBlock(x, y));
  }
  for (const z of [8, 9]) {
    for (let y = 1; y <= PLATFORM_Y; y++) b.set(-1, y, z, STONE);
    for (let y = PIT_FLOOR_Y + 1; y <= PLATFORM_Y; y++) b.set(9, y, z, STONE);
  }
  b.set(9, PIT_FLOOR_Y + 1, 10, DARK);
  for (let x = -1; x <= 8; x++) b.stairs(x, 1, 11, 'stone_brick_stairs', { facing: 'north', half: 'bottom' });
  for (let y = PIT_FLOOR_Y + 2; y < PLATFORM_Y; y++) b.set(9, y, 10, DARK);
}

function platform(b) {
  b.phase('Plattform', `Auf den Pfeilern liegt die Spawnplattform, 9 × 8 Blöcke groß (Boden auf Ebene ${PLATFORM_Y + 1}). Rundherum steht eine Glaswand, 3 Blöcke hoch – Golems können nicht springen, und auf Glas spawnen sie nicht.`, {
    tips: [
      'Lass keine Stein- oder Holzkanten oben offen: Jeder volle Block, auf dem oben Luft ist, kann ein Spawnplatz für einen Golem sein. Darum sind alle Kanten aus Glas oder mit Laternen besetzt.',
    ],
  });
  b.step('Boden', `Leg den Boden auf Ebene ${PLATFORM_Y + 1} aus glattem Stein (x = 0 bis 8, z = 0 bis 7) mit einem Rand aus Steinziegeln (x = −1 und 9, z = −1).`);
  for (let x = -1; x <= 9; x++) {
    for (let z = -1; z <= 7; z++) b.set(x, PLATFORM_Y, z, isPlatformEdge(x, z) ? STONE : 'smooth_stone');
  }
  b.step('Glaswand', `Stell rundherum eine Glaswand von Ebene ${PLATFORM_Y + 2} bis ${PLATFORM_Y + 4}: links und rechts (x = −1 und 9, z = −1 bis 10), hinten (z = −1) und vorne über der Grube (z = 10). Die Ecken sind Pfeiler aus poliertem Andesit mit einer Laterne obendrauf.`);
  for (let y = PLATFORM_Y + 1; y <= PLATFORM_Y + 3; y++) {
    for (let x = -1; x <= 9; x++) {
      for (let z = -1; z <= 10; z++) {
        const edge = x === -1 || x === 9 || z === -1 || z === 10;
        if (!edge) continue;
        const corner = (x === -1 || x === 9) && (z === -1 || z === 10);
        b.set(x, y, z, corner ? DARK : 'glass');
      }
    }
  }
  for (const x of [-1, 9]) for (const z of [-1, 10]) b.set(x, PLATFORM_Y + 4, z, 'lantern[hanging=false]');
}

function lavaBlade(b) {
  b.phase('Lavaklinge', `Die Klinge hängt in der Grube auf Ebene ${LAVA_Y + 1}: Lava auf einer Reihe Schilder. Schilder halten Lava fest (sie fließt nicht hinein), haben aber keine Kollision – der Golem steht unten im Wasser und steckt mit dem Kopf in der Lava.`, {
    tips: [
      'Setz die Schilder von unten, während du in der Grube stehst. Den Text kannst du leer lassen (Esc drücken).',
      'Gieß die Lava erst, wenn alle Schilder hängen, und halte einen Wassereimer bereit.',
    ],
  });
  b.step('Schilder', `Häng an die Vorderwand der Grube (z = 10) auf Ebene ${LAVA_Y} eine Reihe Fichtenwandschilder (x = 0 bis 8). An die Hinterwand (z = 7) kommt eine Ebene höher (Ebene ${LAVA_Y + 1}) eine zweite Reihe: Sie hält die Lava davon ab, zur Seite zu fließen.`);
  for (let x = 0; x <= 8; x++) {
    b.set(x, LAVA_Y - 1, 9, `${spruce.wallSign}[facing=north]`);
    b.set(x, LAVA_Y, 8, `${spruce.wallSign}[facing=south]`);
  }
  b.step('Lava', `Gieß neun Eimer Lava auf Ebene ${LAVA_Y + 1} über die vordere Schilderreihe (z = 9, x = 0 bis 8). Jeder Eimer ist eine Quelle; sie liegen nebeneinander und können nirgendwohin fließen.`);
  for (let x = 0; x <= 8; x++) b.set(x, LAVA_Y, 9, 'lava[level=0]');
  b.note(4, LAVA_Y, 9, 'Lavaklinge: trifft nur den Kopf großer Golems');
}

function water(b) {
  b.phase('Wasser', 'Zwei Wasserläufe: einer auf der Plattform schiebt die Golems nach vorne in die Grube, einer im Grubenboden schwemmt die Beute zu den Trichtern.', {
    tips: [
      'Fließendes Wasser reicht 7 Blöcke weit. Die Plattform ist darum genau 8 tief: Das Wasser hört an der Kante auf und fällt nicht in die Grube auf die Lava.',
    ],
  });
  b.step('Wasser auf der Plattform', `Gieß neun Eimer Wasser an die Hinterkante der Plattform (Ebene ${PLATFORM_Y + 2}, z = 0, x = 0 bis 8). Es fließt bis z = 7 nach vorne und bleibt an der Kante stehen.`);
  for (let x = 0; x <= 8; x++) {
    for (let z = 0; z <= 7; z++) b.set(x, PLATFORM_Y + 1, z, z === 0 ? 'water[level=0]' : `water[level=${z}]`);
  }
  b.step('Wasser in der Grube', `Gieß zwei Eimer an das Westende des Grubenbodens (Ebene ${PIT_FLOOR_Y + 2}, x = 0, z = 8 und 9). Das Wasser fließt bis x = 7 und schiebt Eisen und Mohn auf die Trichter bei x = 8.`);
  for (let x = 0; x <= 7; x++) {
    for (const z of [8, 9]) b.set(x, PIT_FLOOR_Y + 1, z, x === 0 ? 'water[level=0]' : `water[level=${x}]`);
  }
}

function villagerRoom(b) {
  const y = VILLAGER_Y;
  b.phase('Raum der Dorfbewohner', `Mitten über der Plattform schwebt der Raum für die drei Dorfbewohner, sein Boden liegt auf Ebene ${y}. Darunter bleiben 3 Blöcke frei – genug, damit die 2,7 Blöcke hohen Golems unter ihm durchgeschoben werden.`, {
    tips: [
      'Für den Bau in der Luft hilft ein Gerüst (Scaffolding): Es trägt sich selbst und ist schnell wieder abgebaut.',
      'Die Wände sind nur 2 Blöcke hoch und oben offen. Das reicht: Dorfbewohner springen nicht so hoch, und von oben müssen sie den Zombie sehen können.',
    ],
  });
  b.step('Boden', `Leg den Boden aus Steinziegeln auf Ebene ${y} (x = 2 bis 6, z = 2 bis 5).`);
  for (let x = 2; x <= 6; x++) for (let z = 2; z <= 5; z++) b.set(x, y - 1, z, STONE);

  b.step('Betten', `Stell drei Betten nebeneinander auf Ebene ${y + 1} (x = 3, 4 und 5): Kopfteil im Norden (z = 3), Fußteil im Süden (z = 4). Du setzt ein Bett, indem du von Süden nach Norden schaust.`);
  ROOM_X.forEach((x, i) => b.bed(x, y, 4, BEDS[i], { facing: 'north' }));

  b.step('Wände und Arbeitsplätze', `Mauere um die Betten eine Glaswand, 2 Blöcke hoch (Ebene ${y + 1} und ${y + 2}). In die Südwand kommen auf Ebene ${y + 1} vor jedes Bett ein Arbeitsplatz – Bognertisch, Komposter und Schmiedetisch –, darüber Glas.`);
  for (let wy = y; wy <= y + 1; wy++) {
    for (let x = 2; x <= 6; x++) {
      for (let z = 2; z <= 5; z++) {
        const edge = x === 2 || x === 6 || z === 2 || z === 5;
        if (!edge) continue;
        const station = z === 5 && wy === y && ROOM_X.includes(x);
        b.set(x, wy, z, station ? WORKSTATIONS[ROOM_X.indexOf(x)] : 'glass');
      }
    }
  }
  b.note(4, y + 1, 4, 'Hier 3 Dorfbewohner hineinbringen (je einer pro Bett)');
}

function zombieCell(b) {
  const { x, y, z } = ZOMBIE;
  b.phase('Zombie-Zelle', `Der Zombie steht genau über der Nordwand des Raums auf einem Steinziegel (Ebene ${y}), so hoch, dass er die Dorfbewohner nicht schlagen kann. Nach Süden ist seine Zelle offen: Die Dorfbewohner sehen ihn schräg von unten, und das ist der Trick der ganzen Farm.`, {
    tips: [
      'Zwischen Zombie und Dorfbewohnern darf kein Glas sein – Glas versperrt Monstern und Dorfbewohnern die Sicht.',
      'Gib dem Zombie ein Namensschild, sonst verschwindet er, sobald du weit weg bist.',
      'Am einfachsten bringst du den Zombie in einer Lore oder einem Boot hinauf; die Zelle schließt du erst, wenn er drin ist.',
    ],
  });
  b.step('Standblock und Zellenwände', `Setz auf die Nordwand des Raums mittig (x = ${x}, z = ${z}) einen Steinziegel (Ebene ${y}). Daneben (x = ${x - 1} und ${x + 1}) und dahinter (z = ${z - 1}) kommt Glas von Ebene ${y} bis ${y + 2}.`);
  b.set(x, y - 1, z, STONE);
  for (let wy = y - 1; wy <= y + 1; wy++) {
    b.set(x - 1, wy, z, 'glass');
    b.set(x + 1, wy, z, 'glass');
    b.set(x, wy, z - 1, 'glass');
  }
  b.step('Kopfsperre', `Setz vor die Zelle einen einzelnen Glasblock auf Ebene ${y + 2} (x = ${x}, z = ${z + 1}). Darunter bleibt eine Lücke von 1 Block: Durch sie sehen die Dorfbewohner den Zombie, aber der Zombie (2 Blöcke hoch) passt nicht hindurch und kann nicht in den Raum fallen.`);
  b.set(x, y + 1, z + 1, 'glass');
  b.step('Dach gegen die Sonne', `Leg auf die Zelle einen Steinziegel als Dach (Ebene ${y + 3}) und darauf einen Glasblock (Ebene ${y + 4}). Der Steinziegel schützt den Zombie vor der Sonne, das Glas obendrauf verhindert, dass ein Golem auf dem Dach erscheint.`);
  b.set(x, y + 2, z, STONE);
  b.set(x, y + 3, z, 'glass');
  b.note(x, y, z, 'Zombie mit Namensschild hier einsperren');
}

function surroundings(b) {
  b.phase('Licht und Umgebung', 'Unter der Plattform hängen Laternen, damit im Schatten keine Monster spawnen. Dazu ein Weg zur Truhen-Nische und etwas Grün – Bäume nur außerhalb der Farm, damit Golems nicht auf ihnen erscheinen.', {
    tips: ['Nachts spawnen in 26.2 Monster auf jedem Feld mit Blocklicht 0. Die Plattform selbst ist überall unter Wasser – dort spawnt nichts.'],
  });
  b.step('Laternen unter der Plattform', `Häng unter den Plattformboden Laternen an Ketten, so verteilt, dass jedes Feld darunter Licht bekommt.`);
  lightRoom(b, { x1: -1, y1: 1, z1: -1, x2: 9, y2: PLATFORM_Y - 1, z2: 9 }, { lantern: 'lantern' });

  b.step('Weg und Garten', 'Leg einen Trampelpfad von Osten zur Truhen-Nische, ein Blumenbeet vor die Glaswand und ein paar Bäume weiter weg.');
  path(b, { x: 10, y: 0, z: 8, facing: 'east', length: 6, width: 2, mix: 'kies', wiggle: 0, seed: 3 });
  flowerBed(b, { x: 0, y: 0, z: 12, width: 9, depth: 2, facing: 'south', palette: 'rosa', seed: 6 });
  tree(b, { x: -7, y: 1, z: 15, species: 'eiche', size: 'mittel', seed: 4 });
  tree(b, { x: 15, y: 1, z: -6, species: 'fichte', size: 'mittel', seed: 9 });
  bush(b, { x: -6, y: 1, z: -6, size: 'mittel', leaves: 'eiche', seed: 2 });
  bush(b, { x: 15, y: 1, z: 15, size: 'klein', leaves: 'azalee', seed: 5 });
  vegetation(b, { x: -9, y: 0, z: -8, width: 27, depth: 27, mix: 'wiese', density: 0.3, seed: 8 });
}

export default function build(b) {
  base(b);
  pit(b);
  platform(b);
  lavaBlade(b);
  water(b);
  villagerRoom(b);
  zombieCell(b);
  surroundings(b);
}
