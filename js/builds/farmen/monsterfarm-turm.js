// Monsterfarm (Dunkel-Turm): drei stockdunkle Spawn-Etagen hoch über einer Plattform am Himmel.
// Je Etage vier Wasserkanäle (2 breit, 8 lang, eine Stufe tiefer als die Spawnflächen), die alle
// Monster zum Fallschacht in der Mitte schwemmen. Der Sturz von rund 30 Blöcken tötet sie, Lagerfeuer
// erledigen den Rest, Trichter sammeln die Beute in zwei Truhen. Der AFK-Platz liegt unten an den Truhen.
// Lokale Koordinaten: Plattform y = 0 (Welt Y 200), Etagen-Spawnflächen y = 32 / 36 / 40,
// Innenraum je Etage x 0…17, z 0…17, Schacht x 8…9, z 8…9. Vorderseite = Süden (Truhen).

import { lampPost, wallLantern } from '../lib/index.js';

export const meta = {
  id: 'monsterfarm-turm',
  title: 'Monsterfarm (Dunkel-Turm)',
  category: 'farmen',
  subtitle: 'Drei dunkle Spawn-Etagen, Wasserkanäle und 30 Blöcke Fallschacht',
  tags: ['Farm', 'Monster', 'Mobfarm', 'Dunkelraum', 'Zombie', 'Skelett', 'Creeper', 'Knochen', 'Schwarzpulver', 'Pfeile', 'Fallschacht', 'Wasserkanäle', 'Trichter', 'Groß'],
  aliases: [
    'monsterfarm', 'monster farm', 'monsterturm', 'mobfarm', 'mob farm', 'mob turm', 'mobturm', 'mob tower', 'mob grinder',
    'dark room farm', 'darkroom', 'dunkelraum farm', 'dunkler turm', 'dunkel-turm', 'spawn turm', 'spawner lose farm',
    'spawnerless mob farm', 'general mob farm', 'xp farm', 'erfahrungsfarm', 'knochenfarm', 'schwarzpulverfarm',
    'gunpowder farm', 'bone farm', 'monstafarm', 'monsterfram',
  ],
  accuracy: 'vorlage',
  difficulty: 4,
  description: 'Ein dunkler Turm aus Tiefenschiefer hoch am Himmel: Auf drei stockfinsteren Etagen spawnen Zombies, Skelette, Creeper, Spinnen und Hexen. Sie laufen von den Spawnflächen in vier Wasserkanäle, die sie zu einem 2 × 2 großen Fallschacht in der Mitte schwemmen. Nach rund 30 Blöcken Sturz landen sie auf Lagerfeuern über vier Trichtern – Knochen, Pfeile, Schwarzpulver, Fäden und Verrottetes Fleisch landen in einer Doppeltruhe. Du wartest unten am AFK-Platz, genau so weit weg, dass die Monster oben spawnen dürfen und nicht verschwinden.',
  facts: [
    'Monster spawnen in Java 26.2 nur auf Feldern mit Blocklicht 0 – in den Etagen darf also keine einzige Fackel bleiben.',
    'Näher als 24 Blöcke an dir spawnt kein Monster; weiter als 128 Blöcke entfernt verschwinden sie sofort.',
    'Die Welt reicht in 26.2 von Y −64 bis Y 320. Auf Y 200 sind alle Höhlen weiter als 128 Blöcke von dir weg und nehmen der Farm keine Monster weg.',
    'Ein Sturz macht 1 Schaden pro Block über 3 Blöcke: Nach 30 Blöcken sind auch Hexen (26 Lebenspunkte) erledigt.',
    'Fließendes Wasser läuft 7 Blöcke von der Quelle weg – darum sind die Kanäle genau 8 Blöcke lang und das Wasser fällt nicht in den Schacht.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Mob-Farm (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Mob_farm' },
    { title: 'Minecraft Wiki: Spawn (englisch)', url: 'https://minecraft.wiki/w/Mob_spawning' },
    { title: 'Minecraft Wiki: Fallschaden (englisch)', url: 'https://minecraft.wiki/w/Damage#Fall_damage' },
  ],
  credits: null,
  tested: false,
};

const SIZE = 18;
const SHAFT = [8, 9];
const FLOORS = [32, 36, 40];
const ROOF_Y = 43;
const BASE = { x1: 2, x2: 15, z1: 2, z2: 15 };
const LADDER = { x: 7, z: 6 };
const WALL = 'deepslate_bricks';
const TILE = 'deepslate_tiles';
const PILLAR = 'polished_deepslate';
const FILL = 'cobbled_deepslate';
const WATER = 'water[level=0]';

const inShaftRange = (v) => SHAFT.includes(v);
const isShaft = (x, z) => inShaftRange(x) && inShaftRange(z);
const isTrench = (x, z) => !isShaft(x, z) && (inShaftRange(x) || inShaftRange(z));
// Wasserstand im Kanal: Quelle an der Außenwand, danach Fließstufe 1…7 bis zum Schachtrand.
function trenchWater(x, z) {
  const distance = inShaftRange(x) ? Math.min(z, SIZE - 1 - z) : Math.min(x, SIZE - 1 - x);
  return distance === 0 ? WATER : `water[level=${distance}]`;
}
const isLadderHole = (x, z) => x === LADDER.x && z === LADDER.z;

// Außenwand der Etagen: Ecken und Lisenen aus poliertem Tiefenschiefer, Bänder aus Fliesen an den Decken.
function outerWallBlock(x, y, z) {
  const edgeX = x === -1 || x === SIZE;
  const edgeZ = z === -1 || z === SIZE;
  if (edgeX && edgeZ) return PILLAR;
  const along = edgeX ? z : x;
  if (along === 4 || along === 13) return PILLAR;
  if (y === FLOORS[0] - 1 || FLOORS.includes(y + 1) || y === ROOF_Y) return TILE;
  return (x * 7 + y * 13 + z * 5) % 9 === 0 ? 'cracked_deepslate_bricks' : WALL;
}

// Lage entlang der Außenkante (für Lisenen, Strebepfeiler und Zinnen).
function alongEdge(x, z, low, high) {
  return x === low || x === high ? z : x;
}

const isButtressSpot = (along) => along === 4 || along === 13;

// Ring um den Schacht (x 7…10, z 7…10 ohne die Mitte).
function isShaftRing(x, z) {
  return x >= 7 && x <= 10 && z >= 7 && z <= 10 && !isShaft(x, z);
}

function platform(b) {
  b.phase('Plattform am Himmel', 'Die Farm schwebt hoch über der Welt: Bau die Plattform auf Y 200 (drück F3 und lies den Y-Wert ab). In dieser Höhe sind alle Höhlen weiter als 128 Blöcke von dir entfernt – dort spawnen dann keine Monster mehr, und die Farm bekommt alle. Über dem Meer ist es am besten, weil im Wasser keine Landmonster spawnen.', {
    tips: [
      'Bau dir zuerst eine Säule mit Leiter (oder Gerüst) vom Boden bis Y 199. Die Säule ist in der 3D-Ansicht nur angedeutet.',
      'Die oberste Etage liegt danach bei etwa Y 243 – weit unter der Bauhöhe von Y 320.',
      'Nimm einen Wassereimer mit: Wenn du fällst, rettet dich Wasser kurz vor dem Aufprall.',
    ],
  });
  b.step('Boden der Plattform', `Leg auf Ebene 1 eine Plattform von 14 × 14 Blöcken (x = ${BASE.x1} bis ${BASE.x2}, z = ${BASE.z1} bis ${BASE.z2}) aus Tiefenschieferfliesen, mit einem Rand aus poliertem Tiefenschiefer. Bei x = 3, z = 13 bleibt ein Loch für die Leiter nach unten.`);
  for (let x = BASE.x1; x <= BASE.x2; x++) {
    for (let z = BASE.z1; z <= BASE.z2; z++) {
      const edge = x === BASE.x1 || x === BASE.x2 || z === BASE.z1 || z === BASE.z2;
      if (x === 3 && z === 13) continue;
      b.set(x, 0, z, edge ? PILLAR : TILE);
    }
  }
  b.step('Säule nach unten', 'Unter dem Loch hängt deine Zugangsleiter an einer Säule aus Bruchtiefenschiefer. Bau sie bis zum Boden (oder Meer) weiter – hier sind nur die obersten Blöcke gezeigt.');
  for (let y = -4; y <= -1; y++) b.set(3, y, 14, FILL);
  b.set(3, 0, 14, PILLAR);
  for (let y = -4; y <= 0; y++) b.set(3, y, 13, 'ladder[facing=north]');
  b.note(3, -4, 13, 'Leiter weiter bis zum Boden');
}

function killChamber(b) {
  b.phase('Truhen und Lagerfeuer', 'In der Mitte der Plattform landen die Monster. Ganz unten liegen vier Trichter, darauf vier Lagerfeuer, vorne die Truhen. Die Lagerfeuer erledigen jede Spinne, die sich an der Schachtwand festgekrallt hat und den Sturz überlebt.', {
    tips: [
      'Lagerfeuer verbrennen keine Gegenstände – Knochen und Pfeile fallen durch sie hindurch in die Trichter darunter.',
      'Setz die Trichter von hinten nach vorne: zuerst die vorderen auf die Truhen zielend, dann die hinteren auf die vorderen.',
    ],
  });
  b.step('Doppeltruhe', 'Stell eine Doppeltruhe auf Ebene 2 (x = 8 und 9, z = 10), die Öffnung nach Süden.');
  for (const x of SHAFT) b.set(x, 1, 10, 'chest[facing=south]');
  b.note(8, 1, 10, 'Beute: Knochen, Pfeile, Schwarzpulver, Fäden, Verrottetes Fleisch');

  b.step('Trichter', 'Leg vier Trichter auf Ebene 2 in die Schachtmitte (x = 8 und 9, z = 8 und 9). Die vorderen beiden (z = 9) zeigen nach Süden in die Truhe, die hinteren beiden (z = 8) nach Süden in die vorderen.');
  for (const x of SHAFT) {
    b.set(x, 1, 8, 'hopper[facing=south]');
    b.set(x, 1, 9, 'hopper[facing=south]');
  }

  b.step('Lagerfeuer', 'Stell auf jeden Trichter ein Lagerfeuer (Ebene 3). Es brennt von selbst, sobald du es setzt.');
  for (const x of SHAFT) for (const z of SHAFT) b.set(x, 2, z, 'campfire[facing=south,lit=true]');
  b.note(9, 2, 9, 'Hier landen die Monster nach 30 Blöcken Sturz');

  b.step('Kammerwände', 'Mauere um die vier Lagerfeuer einen Ring aus Tiefenschieferziegeln (Ebene 2 und 3, x = 7 bis 10, z = 7 bis 10). Vorne über der Truhe kommt auf Ebene 3 getöntes Glas: Durch dieses Fenster siehst du, was ankommt.');
  for (let y = 1; y <= 2; y++) {
    for (let x = 7; x <= 10; x++) {
      for (let z = 7; z <= 10; z++) {
        if (!isShaftRing(x, z)) continue;
        if (z === 10 && inShaftRange(x)) {
          if (y === 2) b.set(x, y, z, 'tinted_glass');
          continue;
        }
        b.set(x, y, z, (x === 7 || x === 10) && (z === 7 || z === 10) ? PILLAR : WALL);
      }
    }
  }
  b.note(8, 1, 12, 'AFK-Platz: hier stehen bleiben (gut 30 Blöcke unter den Etagen)');
}

function shaft(b) {
  const top = FLOORS[0] - 2;
  b.phase('Fallschacht', `Der Schacht ist innen 2 × 2 Blöcke groß und reicht von den Lagerfeuern bis Ebene ${top + 1}. Außen hängt eine Leiter, über die du zur ersten Etage hinaufkommst.`, {
    tips: [
      'Bau den Schacht von innen hoch: Stell dich hinein, setz die Wand rundum und spring mit einem Block unter den Füßen eine Ebene höher. Zum Schluss steigst du außen über die Leiter wieder hinab.',
      'Zwei Bänder aus getöntem Glas lassen dich die fallenden Monster sehen, ohne Licht hineinzulassen.',
    ],
  });
  b.step('Schachtwände', `Mauere den Ring um den Schacht (x = 7 bis 10, z = 7 bis 10, die Mitte bleibt frei) von Ebene 4 bis ${top + 1} hoch. Ecken aus poliertem Tiefenschiefer, dazwischen Tiefenschieferziegel; vorne (z = 10) auf Ebene 10 bis 12 und 20 bis 22 getöntes Glas.`);
  for (let y = 3; y <= top; y++) {
    for (let x = 7; x <= 10; x++) {
      for (let z = 7; z <= 10; z++) {
        if (!isShaftRing(x, z)) continue;
        const corner = (x === 7 || x === 10) && (z === 7 || z === 10);
        const window = z === 10 && inShaftRange(x) && ((y >= 9 && y <= 11) || (y >= 19 && y <= 21));
        b.set(x, y, z, corner ? PILLAR : window ? 'tinted_glass' : WALL);
      }
    }
  }
  b.step('Leiter', `Häng an die Nordwest-Ecke des Schachts (x = ${LADDER.x}, z = ${LADDER.z}, an der Wand bei z = 7) eine Leiter von Ebene 2 bis ${FLOORS[0] + 1}. Sie führt später durch ein Loch im Boden in die erste Etage.`);
  for (let y = 1; y <= FLOORS[0]; y++) b.set(LADDER.x, y, LADDER.z, 'ladder[facing=north]');
}

function corbels(b) {
  const y = FLOORS[0] - 2;
  b.step('Konsolen', `Leg rund um den Turm eine Reihe umgedrehter Tiefenschieferziegeltreppen auf Ebene ${y + 1}, die hohe Seite zur Wand – darauf ruht optisch die Außenwand der Etagen. Obendrauf kommen untere Tiefenschieferziegelstufen (Ebene ${y + 2}): Auf umgedrehten Treppen könnten nachts Monster spawnen, auf unteren Stufen nicht. Nur dort, wo später die Strebepfeiler stehen (an jeder Seite der 7. und 16. Block, von der Ecke aus gezählt), bleibt die Stufe weg.`);
  for (let x = -2; x <= SIZE + 1; x++) {
    for (let z = -2; z <= SIZE + 1; z++) {
      const ring = x === -2 || x === SIZE + 1 || z === -2 || z === SIZE + 1;
      if (!ring) continue;
      let facing = 'north';
      if (z === -2) facing = 'south';
      else if (x === -2) facing = 'east';
      else if (x === SIZE + 1) facing = 'west';
      b.stairs(x, y, z, 'deepslate_brick_stairs', { facing, half: 'top' });
      const corner = (x === -2 || x === SIZE + 1) && (z === -2 || z === SIZE + 1);
      if (corner || !isButtressSpot(alongEdge(x, z, -2, SIZE + 1))) b.slab(x, y + 1, z, 'deepslate_brick_slab', { type: 'bottom' });
    }
  }
}

function spawnFloor(b, index) {
  const y = FLOORS[index];
  const n = index + 1;
  const first = index === 0;
  b.phase(`Etage ${n}`, `Jede Etage ist innen 18 × 18 Blöcke groß und 2 Blöcke hoch: Die vier Ecken sind Spawnflächen (je 8 × 8), dazwischen laufen vier Wasserkanäle, 2 breit und eine Stufe tiefer, zum Schacht in der Mitte. Die Spawnflächen dieser Etage liegen auf Ebene ${y + 1}, die Monster stehen auf Ebene ${y + 2}.`, {
    tips: first
      ? [
          'Setz beim Bauen Fackeln, damit keine Monster auftauchen, solange du drin bist – und nimm am Ende jede einzelne wieder mit.',
          'Die Spawnflächen müssen volle, undurchsichtige Blöcke sein. Auf Glas, Stufen und Teppich spawnen keine Monster.',
        ]
      : ['Wie bei Etage 1: erst der Boden, dann die Spawnflächen, die Außenwand und zum Schluss das Wasser.'],
  });
  b.step('Boden', `Leg den Boden auf Ebene ${y} aus Bruchtiefenschiefer über die ganze Fläche (x = 0 bis 17, z = 0 bis 17). Frei bleibt nur der Schacht in der Mitte (x = 8 und 9, z = 8 und 9)${first ? ` und das Leiterloch bei x = ${LADDER.x}, z = ${LADDER.z}` : ''}.`);
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      if (isShaft(x, z) || (first && isLadderHole(x, z))) continue;
      b.set(x, y - 1, z, FILL);
    }
  }
  b.step('Spawnflächen', `Leg auf Ebene ${y + 1} die vier Spawnflächen in die Ecken (je 8 × 8 Blöcke). Dazwischen bleiben die Kanäle frei: zwei Blöcke breit entlang x = 8 und 9 und entlang z = 8 und 9.${first ? ` Über das Leiterloch kommt eine geschlossene Fichtenfalltür, in die untere Hälfte gesetzt. Du öffnest sie von der Leiter aus; Monster spawnen nicht auf Falltüren und können sie nicht öffnen.` : ''}`);
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      if (isShaft(x, z) || isTrench(x, z)) continue;
      if (first && isLadderHole(x, z)) continue;
      b.set(x, y, z, FILL);
    }
  }
  if (first) {
    b.set(LADDER.x, y + 1, LADDER.z, 'spruce_trapdoor[facing=south,half=bottom,open=false]');
    b.note(LADDER.x, y + 1, LADDER.z, 'Einstieg in Etage 1: Falltür von der Leiter aus öffnen');
  }
  b.step('Außenwand', `Mauere die Außenwand rund um die Etage (x = −1 und 18, z = −1 und 18) von Ebene ${y} bis ${y + 3} hoch. Kein Fenster, kein Spalt: Jedes Licht von außen verdirbt die Farm.`);
  for (let wy = y - 1; wy <= y + 2; wy++) {
    for (let x = -1; x <= SIZE; x++) {
      for (let z = -1; z <= SIZE; z++) {
        const edge = x === -1 || x === SIZE || z === -1 || z === SIZE;
        if (edge) b.set(x, wy, z, outerWallBlock(x, wy, z));
      }
    }
  }
  b.step('Wasser', `Gieß in jeden Kanal am äußeren Ende zwei Eimer Wasser (Ebene ${y + 1}, direkt an der Außenwand). Das Wasser fließt genau 7 Blöcke weit und hört am Schachtrand auf – es fällt also nicht hinunter.`);
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) if (isTrench(x, z)) b.set(x, y, z, trenchWater(x, z));
  }
  b.note(8, y, 0, `Etage ${n}: Wasserquellen hier an der Wand`);
}

function roof(b) {
  b.phase('Dach', 'Das Dach schließt die oberste Etage und darf selbst kein Spawnplatz sein: Auf Stufen spawnen keine Monster. Eine niedrige Brüstung und vier Seelenlaternen geben dem Turm seine Krone.', {
    tips: ['Auch die Dachfläche liegt im Dunkeln der Nacht – darum Stufen statt voller Blöcke obenauf.'],
  });
  b.step('Strebepfeiler', `Stell an jede Seite zwei Strebepfeiler aus poliertem Tiefenschiefer vor die Lisenen (an jeder Seite der 7. und 16. Block des Konsolenkranzes, von der Ecke aus gezählt), von Ebene ${FLOORS[0]} bis ${ROOF_Y + 1}, mit einer unteren Stufe als Kappe.`);
  for (let x = -2; x <= SIZE + 1; x++) {
    for (let z = -2; z <= SIZE + 1; z++) {
      const ring = x === -2 || x === SIZE + 1 || z === -2 || z === SIZE + 1;
      const corner = (x === -2 || x === SIZE + 1) && (z === -2 || z === SIZE + 1);
      if (!ring || corner || !isButtressSpot(alongEdge(x, z, -2, SIZE + 1))) continue;
      for (let y = FLOORS[0] - 1; y <= ROOF_Y; y++) b.set(x, y, z, PILLAR);
      b.slab(x, ROOF_Y + 1, z, 'deepslate_brick_slab', { type: 'bottom' });
    }
  }
  b.step('Decke', `Leg die Decke der obersten Etage auf Ebene ${ROOF_Y + 1} über die ganze Fläche, einschließlich Außenwand (x = −1 bis 18, z = −1 bis 18).`);
  for (let x = -1; x <= SIZE; x++) {
    for (let z = -1; z <= SIZE; z++) {
      const edge = x === -1 || x === SIZE || z === -1 || z === SIZE;
      b.set(x, ROOF_Y, z, edge ? outerWallBlock(x, ROOF_Y, z) : FILL);
    }
  }
  b.step('Dachfläche und Brüstung', `Bedeck das Dach auf Ebene ${ROOF_Y + 2} mit Tiefenschieferziegelstufen (untere Hälfte) und setz am Rand eine Brüstung: jeden dritten Block eine Zinne aus poliertem Tiefenschiefer mit einer unteren Stufe obendrauf, dazwischen Tiefenschieferziegelmauer. An die vier Ecken kommen Säulen aus poliertem Tiefenschiefer mit je einer Seelenlaterne obendrauf.`);
  for (let x = -1; x <= SIZE; x++) {
    for (let z = -1; z <= SIZE; z++) {
      const edgeX = x === -1 || x === SIZE;
      const edgeZ = z === -1 || z === SIZE;
      if (edgeX && edgeZ) {
        b.set(x, ROOF_Y + 1, z, PILLAR);
        b.set(x, ROOF_Y + 2, z, 'chiseled_deepslate');
        b.set(x, ROOF_Y + 3, z, 'soul_lantern[hanging=false]');
      } else if ((edgeX || edgeZ) && alongEdge(x, z, -1, SIZE) % 3 === 1) {
        b.set(x, ROOF_Y + 1, z, PILLAR);
        b.slab(x, ROOF_Y + 2, z, 'deepslate_brick_slab', { type: 'bottom' });
      } else if (edgeX || edgeZ) {
        b.set(x, ROOF_Y + 1, z, 'deepslate_brick_wall');
      } else {
        b.slab(x, ROOF_Y + 1, z, 'deepslate_brick_slab', { type: 'bottom' });
      }
    }
  }
}

function lights(b) {
  b.phase('Licht auf der Plattform', 'Unten an den Truhen ist dein AFK-Platz. Die Plattform muss überall hell sein, sonst spawnen nachts Monster direkt neben dir.', {
    tips: [
      'Bleib zum Farmen genau am AFK-Platz vor den Truhen stehen: Die Spawnflächen sind dort gut 30 Blöcke über dir – weiter als 24 Blöcke (sonst spawnt nichts) und nah genug, dass die Monster nicht wieder verschwinden.',
      'Schau nach ein paar Minuten in die Truhe. Ist sie fast voll, häng eine zweite Trichterkette oder eine weitere Doppeltruhe an.',
    ],
  });
  b.step('Laternenpfähle', 'Stell an die vier Ecken der Plattform Laternenpfähle aus Tiefenschiefermauer mit einer Laterne obendrauf, und häng an die Schachtwand links und rechts der Truhe zwei Laternen.');
  for (const [x, z] of [[BASE.x1 + 1, BASE.z1 + 1], [BASE.x2 - 1, BASE.z1 + 1], [BASE.x1 + 1, BASE.z2 - 1], [BASE.x2 - 1, BASE.z2 - 1]]) {
    lampPost(b, { x, y: 1, z, height: 2, post: 'deepslate_tile_wall', base: PILLAR });
  }
  wallLantern(b, { x: 7, y: 2, z: 10, facing: 'south', style: 'bracket', arm: 'deepslate_tile_wall' });
  wallLantern(b, { x: 10, y: 2, z: 10, facing: 'south', style: 'bracket', arm: 'deepslate_tile_wall' });

  b.step('Bank', 'Stell dir vor die Truhe eine Bank aus zwei Tiefenschieferfliesentreppen (Ebene 2, x = 8 und 9, z = 13), die hohe Seite nach Süden – so schaust du beim Warten auf das Fenster der Kammer.');
  for (const x of SHAFT) b.stairs(x, 1, 13, 'deepslate_tile_stairs', { facing: 'south', half: 'bottom' });

  b.step('Geländer', 'Zieh am Rand der Plattform ein Geländer aus Tiefenschiefermauer (Ebene 2), damit du beim AFK-Warten nicht hinunterfällst.');
  for (let x = BASE.x1; x <= BASE.x2; x++) {
    for (let z = BASE.z1; z <= BASE.z2; z++) {
      const edge = x === BASE.x1 || x === BASE.x2 || z === BASE.z1 || z === BASE.z2;
      if (!edge || b.get(x, 1, z) !== 'air') continue;
      b.set(x, 1, z, 'deepslate_tile_wall');
    }
  }
}

export default function build(b) {
  platform(b);
  killChamber(b);
  shaft(b);
  corbels(b);
  FLOORS.forEach((_, i) => spawnFloor(b, i));
  roof(b);
  lights(b);
}
