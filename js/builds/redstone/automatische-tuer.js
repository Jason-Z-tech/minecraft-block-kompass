// Automatische Tür: kleine Lagerhütte aus Steinziegeln mit Eisentür, die sich über Steindruckplatten innen und außen
// von selbst öffnet. Bau-Rahmen: Hütte x −3 … 3, z −6 … 0, Tür in der Südwand bei (0, 1, 0), Fußboden y = 0.
//
// Signalweg: Eine Druckplatte versorgt, solange jemand darauf steht, die direkt angrenzende untere Türhälfte – die
// Eisentür geht auf. Außen (0, 1, 1) und innen (0, 1, −1) liegt je eine Steindruckplatte. Nach dem Verlassen bleibt die
// Platte noch 20 Ticks (1 Sekunde) gedrückt, dann schließt die Tür. Keine Leitungen nötig.

import { WOOD, window, doorway, wallLantern, storage, lightRoom, terrain, path, flowerBed, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'automatische-tuer',
  title: 'Automatische Tür mit Druckplatten',
  category: 'redstone',
  subtitle: 'Eisentür, die sich beim Darauftreten von selbst öffnet und wieder schließt',
  tags: ['Redstone', 'Tür', 'Eisentür', 'Druckplatte', 'Automatisch', 'Hütte', 'Lager', 'Anfänger', 'Eingang'],
  aliases: [
    'automatische tür', 'automatische tuer', 'automatik tür', 'automatiktür', 'druckplatten tür', 'druckplattentür',
    'eisentür', 'eisentuer', 'eisen tür', 'iron door', 'automatic door', 'pressure plate door', 'iron door pressure plate',
    'auto door', 'tür mit druckplatte', 'automatische tur', 'automatishe tür', 'redstone tür einfach',
  ],
  accuracy: 'eigenes',
  difficulty: 1,
  description: 'Eine kleine Lagerhütte aus Steinziegeln, deren Eisentür sich von selbst öffnet: Vor und hinter der Tür liegt je eine Steindruckplatte. Trittst du darauf, schwingt die Tür auf; gehst du weiter, fällt sie nach einer Sekunde wieder zu. Ganz ohne Redstone-Staub – die Druckplatten geben ihr Signal direkt an die Tür.',
  facts: [
    'Eine Eisentür lässt sich nicht mit der Hand öffnen, nur mit Redstone – Druckplatten sind der einfachste Weg.',
    'Eine Steindruckplatte bleibt 20 Ticks (1 Sekunde) an, nachdem du heruntergegangen bist.',
    'Steindruckplatten reagieren nur auf Spieler und Kreaturen, nicht auf herumliegende Gegenstände (Holzdruckplatten schon).',
    'Nicht im Spiel getestet: die Bauweise folgt der Beschreibung von Eisentür und Druckplatte im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Iron Door', url: 'https://minecraft.wiki/w/Iron_Door' },
    { title: 'Minecraft Wiki: Pressure Plate', url: 'https://minecraft.wiki/w/Pressure_Plate' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const X1 = -3;
const X2 = 3;
const Z1 = -6;
const Z2 = 0;
const WALL_TOP = 4;
const PLATE = 'stone_pressure_plate[powered=false]';
const GROUND = { x: -9, z: -12, width: 19, depth: 21 };

function wallBrick(b, y) {
  if (y === 1) return b.chance(0.35) ? 'mossy_stone_bricks' : 'stone_bricks';
  return b.pickWeighted([['stone_bricks', 9], ['cracked_stone_bricks', 1]]);
}

function site(b) {
  b.phase('Bauplatz und Fundament', 'Such dir eine ebene Wiese. Die Hütte ist außen 7 × 7 Blöcke groß und steht auf einem Fundament aus Bruchstein.', {
    tips: ['Setz zuerst die vier Ecken des Fundaments und zähl dann die Seiten ab: 7 Blöcke von West nach Ost, 7 von Nord nach Süd.'],
  });
  b.step('Wiese', 'Die Wiese rund um die Hütte.');
  terrain(b, { x: GROUND.x, y: -2, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 2, seed: 'auto-tuer' });
  b.step('Fundament und Fußboden', 'Ersetze auf Bodenhöhe einen Ring aus Bruchstein (7 × 7) als Fundament und fülle innen einen Boden aus Fichtenbrettern (5 × 5). Vor der Tür kommen drei Steinziegel als Schwelle in den Boden – auf den mittleren legst du später die äußere Druckplatte.');
  b.fill(X1, 0, Z1, X2, 0, Z2, 'cobblestone');
  b.fill(X1 + 1, 0, Z1 + 1, X2 - 1, 0, Z2 - 1, spruce.planks);
  b.fill(-1, 0, 1, 1, 0, 1, 'stone_bricks');
}

function walls(b) {
  b.phase('Wände', 'Die Wände sind 4 Blöcke hoch: Ecken aus Fichtenstämmen, dazwischen Steinziegel, unten mit ein paar bemoosten Steinziegeln.', {
    tips: ['Lass in der Südwand die Mitte frei – dort sitzt gleich die Tür mit ihrem Holzrahmen.'],
  });
  for (let y = 1; y <= WALL_TOP; y++) {
    for (let x = X1; x <= X2; x++) {
      for (let z = Z1; z <= Z2; z++) {
        if (x !== X1 && x !== X2 && z !== Z1 && z !== Z2) continue;
        const corner = (x === X1 || x === X2) && (z === Z1 || z === Z2);
        b.set(x, y, z, corner ? `${spruce.log}[axis=y]` : wallBrick(b, y));
      }
    }
  }
}

function door(b) {
  b.phase('Eisentür und Druckplatten', 'Jetzt kommt das Herzstück: die Eisentür mit Rahmen und die beiden Druckplatten.', {
    tips: [
      'Die Druckplatten müssen direkt vor bzw. hinter der Tür liegen, also im Feld, das an die untere Türhälfte grenzt. Ein Feld weiter weg reicht das Signal nicht.',
      'Monster können außen auch auf die Platte treten und die Tür öffnen. Willst du das nicht, setz außen statt der Platte einen Knopf an den Türrahmen.',
    ],
  });
  b.step('Tür mit Rahmen', 'Setz die Eisentür mitten in die Südwand (Ebene 4 und 5). Stell dich dafür vor die Hütte und schau nach Norden – dann öffnet sie sich nach innen. Links und rechts kommt je ein geschälter Fichtenstamm als Türpfosten, darüber ein liegender Stamm als Sturz (Ebene 6).');
  doorway(b, { x: 0, y: 1, z: 0, facing: 'south', door: 'iron_door', frame: spruce.strippedLog });
  b.step('Druckplatten', 'Leg eine Steindruckplatte außen auf die mittlere Schwelle und eine innen direkt hinter die Tür. Trittst du auf eine der beiden, geht die Tür auf; eine Sekunde, nachdem du heruntergegangen bist, schließt sie sich wieder.');
  b.set(0, 1, 1, PLATE);
  b.set(0, 1, -1, PLATE);
  b.note(0, 1, 1, 'Äußere Druckplatte: öffnet die Tür, wenn du darauftrittst');
  b.note(0, 1, -1, 'Innere Druckplatte: öffnet die Tür von innen');
  b.step('Laternen am Eingang', 'Häng links und rechts neben der Tür je eine Laterne an einen Fichtenzaun-Arm (Arm auf Ebene 6, Laterne darunter auf Ebene 5).');
  for (const x of [-2, 2]) wallLantern(b, { x, y: 2, z: 0, facing: 'south', style: 'bracket', arm: spruce.fence });
}

function windows(b) {
  b.phase('Fenster', 'In die Ost- und die Westwand kommt je ein Fenster, 1 breit und 2 hoch (Ebene 5 und 6), mit Fensterläden aus Fichtenfalltüren und einem kleinen Blumenkasten. Die Rückwand bekommt ein schmales Fenster über der Lagerwand (Ebene 6 und 7).');
  window(b, { x: X1, y: 2, z: -3, facing: 'west', style: 'pane', shutters: spruce.trapdoor, flowerBox: true });
  window(b, { x: X2, y: 2, z: -3, facing: 'east', style: 'pane', shutters: spruce.trapdoor, flowerBox: true });
  window(b, { x: 0, y: 3, z: Z1, facing: 'north', style: 'pane', height: 2, sill: spruce.stairs });
}

function roof(b) {
  b.phase('Decke und Dach', 'Eine Decke aus Fichtenbrettern schließt den Raum nach oben, darüber liegt ein Satteldach aus Fichtentreppen mit 1 Block Überstand. Der First läuft von West nach Ost.', {
    tips: ['Setz die Dachtreppen Reihe für Reihe von außen nach innen und schau dabei zum First – dann zeigt die hohe Seite automatisch nach oben zur Mitte.'],
  });
  b.step('Decke', 'Lege auf Ebene 8 eine Decke aus Fichtenbrettern (5 × 5) auf die Wandkrone.');
  b.fill(X1 + 1, WALL_TOP + 1, Z1 + 1, X2 - 1, WALL_TOP + 1, Z2 - 1, spruce.planks);
  b.step('Satteldach', 'Das Dach beginnt mit der Traufe auf Ebene 7 (1 Block vor der Wand) und steigt bis zum First aus Fichtenstufen. Die Giebeldreiecke füllst du mit Fichtenbrettern.');
  b.roof({ x1: X1, z1: Z1, x2: X2, z2: Z2, y: WALL_TOP, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
}

function interior(b) {
  b.phase('Einrichtung und Licht', 'Drinnen ist das Lager: Truhen und ein Fass an der Rückwand, Werkbank und Ofen an der Westwand, ein Fass an der Ostwand. Laternen an der Decke halten Monster fern.');
  b.step('Lagerwand', 'Stell an die Nordwand zwei Doppeltruhen mit einem Fass dazwischen, zwei Ebenen hoch.');
  storage(b, { x: X1 + 1, y: 1, z: Z1 + 1, facing: 'south', width: 5, height: 2 });
  b.step('Werkplatz', 'An die Westwand kommen Werkbank und Ofen (Öffnung nach Osten), an die Ostwand ein Fass.');
  b.set(X1 + 1, 1, -2, 'crafting_table');
  b.set(X1 + 1, 1, -3, 'furnace[facing=east,lit=false]');
  b.set(X2 - 1, 1, -2, 'barrel[facing=up,open=false]');
  b.step('Licht', 'Häng Laternen an die Decke, damit jedes Bodenfeld beleuchtet ist und keine Monster erscheinen.');
  lightRoom(b, { x1: X1 + 1, y1: 1, z1: Z1 + 1, x2: X2 - 1, y2: WALL_TOP, z2: Z2 - 1 }, { mode: 'ceiling' });
}

function surroundings(b) {
  b.phase('Rund um die Hütte', 'Zum Schluss ein Trampelpfad zur Tür, zwei Blumenbeete vor der Hütte und etwas Grün.');
  path(b, { x: 0, y: 0, z: 2, facing: 'south', length: 6, width: 3, mix: 'erde', wiggle: 0.6, seed: 3 });
  flowerBed(b, { x: -3, y: 0, z: 1, width: 2, depth: 2, facing: 'south', palette: 'warm', seed: 1 });
  flowerBed(b, { x: 2, y: 0, z: 1, width: 2, depth: 2, facing: 'south', palette: 'warm', seed: 2 });
  bush(b, { x: -6, y: 1, z: -1, size: 'klein', leaves: 'eiche', seed: 4 });
  bush(b, { x: 6, y: 1, z: -7, size: 'klein', leaves: 'azalee', seed: 5 });
  bush(b, { x: -5, y: 1, z: -9, size: 'klein', leaves: 'fichte', seed: 7 });
  vegetation(b, { x: GROUND.x, y: 0, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.3, seed: 6 });
}

export default function build(b) {
  site(b);
  walls(b);
  door(b);
  windows(b);
  roof(b);
  interior(b);
  surroundings(b);
}
