// Hühnerfarm mit Brat-Automatik: Hühner stehen oben auf Trichtern, die Eier rutschen in einen Werfer,
// der sie in eine kleine Kammer wirft. Dort schlüpfen Küken auf Stufen; sobald sie erwachsen sind,
// ragt ihr Kopf in den Boden der Lavakessel darüber – das gebratene Hähnchen fällt auf die Stufen, die
// Trichter saugen es durch in die Truhe. Ein Beobachter-Takt löst den Werfer laufend aus.
// Lokale Koordinaten: Wiese bis y = 0, Truhe (1…2, 1, 2), Kammer (1…2, 3, 2), Lavakessel (1…2, 4, 2),
// Gehege-Trichter y = 5 (x 0…2, z 1…3), Hühner auf y = 6. Vorderseite = Süden.

import { WOOD, terrain, path, flowerBed, bush, tree, vegetation, gardenFence, hangingLantern, wallLantern, lampPost } from '../lib/index.js';

export const meta = {
  id: 'huehnerfarm',
  title: 'Hühnerfarm mit Brat-Automatik',
  category: 'farmen',
  subtitle: 'Eier ausbrüten, Küken großziehen, Hähnchen gebraten einsammeln',
  tags: ['Farm', 'Hühner', 'Huhn', 'Essen', 'Gebratenes Hähnchen', 'Federn', 'Werfer', 'Trichter', 'Lava', 'Lavakessel', 'Kessel', 'Automatisch', 'Redstone'],
  aliases: [
    'huehnerfarm', 'hühnerfarm', 'huhnerfarm', 'hünerfarm', 'huehner farm', 'hühner farm', 'hühnchenfarm', 'haehnchenfarm',
    'hähnchenfarm', 'chickenfarm', 'chicken farm', 'cooked chicken farm', 'automatic chicken farm', 'chicken cooker',
    'eierfarm', 'eier farm', 'egg farm', 'brathähnchen farm', 'brathaehnchen', 'grillhähnchen', 'automatische hühnerfarm',
    'federfarm', 'feather farm', 'essensfarm', 'food farm',
  ],
  accuracy: 'vorlage',
  difficulty: 3,
  description: 'Neun Hühner stehen in einem Glasgehege auf Trichtern. Ihre Eier wandern durch die Trichter in einen Werfer, den ein kleiner Beobachter-Takt immer wieder auslöst: Er wirft die Eier in eine Kammer darunter, wo ab und zu ein Küken schlüpft. Die Küken stehen auf Stufen, knapp unter zwei Lavakesseln – erst wenn sie nach 20 Minuten erwachsen sind, ragt ihr Kopf in den Kesselboden und sie fangen Feuer. Das gebratene Hähnchen und die Federn fallen auf die Stufen, die Trichter darunter saugen sie in die Truhe vorne.',
  facts: [
    'Ein Huhn legt etwa alle 5 bis 10 Minuten ein Ei.',
    'Aus einem geworfenen Ei schlüpft mit einer Chance von 1 zu 8 ein Küken, ganz selten sogar vier auf einmal.',
    'Ein Küken ist in 26.2 nur 0,4 Blöcke hoch, ein erwachsenes Huhn 0,7. Zwischen Stufe und Kesselboden bleiben knapp 0,7 Blöcke Luft – das Küken passt hinein, das erwachsene Huhn stößt mit dem Kopf in den Kessel.',
    'Freie Lava verbrennt auch die Beute fast sofort. Der Boden eines Lavakessels hält die herunterfallenden Gegenstände auf, setzt aber jedes Tier in Brand, das von unten hineinragt.',
    'Ein Huhn, das brennend stirbt, lässt gebratenes statt rohes Hähnchen fallen.',
    'Trichter saugen auch Gegenstände auf, die auf einer Stufe direkt über ihnen liegen.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial Hühnerfarm (englisch)', url: 'https://minecraft.wiki/w/Tutorial:Chicken_farming' },
    { title: 'Minecraft Wiki: Huhn (englisch)', url: 'https://minecraft.wiki/w/Chicken' },
    { title: 'Minecraft Wiki: Beobachter (englisch)', url: 'https://minecraft.wiki/w/Observer' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const WALL = 'stone_bricks';
const MOSSY = 'mossy_stone_bricks';
const CORNER = 'polished_andesite';
const PLINTH = 'cobblestone';
const CHAMBER_X = [1, 2];
const CHAMBER_Z = 2;
const PEN = { x1: 0, x2: 2, z1: 1, z2: 3, y: 5 };
const TOWER = { x1: -1, x2: 3, z1: 0, z2: 4, top: 5 };

// Trichter im Gehege schieben alles zum Sammeltrichter (0, 5, 2) über dem Werfer.
function penHopperFacing(x, z) {
  if (x === 0 && z === CHAMBER_Z) return 'down';
  if (z === CHAMBER_Z) return 'west';
  return z < CHAMBER_Z ? 'south' : 'north';
}

// Außenwand-Block: Ecken poliertes Andesit, sonst Steinziegel mit festen Moosflecken.
function towerWallBlock(x, y, z) {
  const corner = (x === TOWER.x1 || x === TOWER.x2) && (z === TOWER.z1 || z === TOWER.z2);
  if (corner) return CORNER;
  return (x * 3 + y * 5 + z * 7) % 11 === 0 ? MOSSY : WALL;
}

// Gesims-Treppen: hohe Seite zum Turm; an den Ecken entstehen Außenecken von selbst.
function corniceFacing(x, z) {
  if (z === TOWER.z1 - 1) return 'south';
  if (z === TOWER.z2 + 1) return 'north';
  return x < TOWER.x1 ? 'east' : 'west';
}

function isTowerShell(x, z) {
  return x === TOWER.x1 || x === TOWER.x2 || z === TOWER.z1 || z === TOWER.z2;
}

function foundation(b) {
  b.phase('Fundament', 'Die Farm ist ein kleiner Steinturm, 5 × 5 Blöcke groß, mit einem Glasgehege obendrauf. Zuerst kommt der Sockel aus Bruchstein, ein Block in den Boden eingelassen.', {
    tips: [
      'Bau in der Nähe deines Hauses: Hühner legen nur Eier, wenn du nicht weiter als etwa 128 Blöcke entfernt bist, und die Küken wachsen nur in geladenen Chunks.',
    ],
  });
  terrain(b, { x: -8, y: -1, z: -7, width: 19, depth: 19, height: 1, seed: 'huehnerfarm' });
  b.step('Sockel', 'Leg den Sockel auf Ebene 1: Bruchstein von x = −1 bis 3 und z = 0 bis 4, direkt in den Boden statt der Grasblöcke.');
  b.fill(TOWER.x1, 0, TOWER.z1, TOWER.x2, 0, TOWER.z2, PLINTH);
}

function collector(b) {
  b.phase('Truhe und Kammer', 'Von unten nach oben: die Truhe, darüber zwei Trichter, darauf zwei Stufen – das ist der Boden der Kammer, in der die Küken leben.', {
    tips: [
      'Setz die Trichter schleichend, während du auf die Truhe zielst – dann zeigen ihre Röhrchen nach unten in die Truhe.',
      'Die Stufen müssen untere Stufen sein (in die untere Hälfte des Blocks gesetzt). Nur dann stimmt der Abstand zu den Lavakesseln darüber.',
    ],
  });
  b.step('Truhe', `Stell eine Doppeltruhe auf Ebene 2 (x = 1 und 2, z = ${CHAMBER_Z}), die Öffnung nach Süden. Vor der Truhe bleibt eine Nische frei, aus der du sie öffnest.`);
  for (const x of CHAMBER_X) b.set(x, 1, CHAMBER_Z, 'chest[facing=south]');
  b.note(1, 1, CHAMBER_Z, 'Hier landen gebratenes Hähnchen und Federn');

  b.step('Trichter', 'Setz auf Ebene 3 zwei Trichter auf die Truhe, beide zeigen nach unten.');
  for (const x of CHAMBER_X) b.set(x, 2, CHAMBER_Z, 'hopper[facing=down]');

  b.step('Stufen', 'Leg auf die beiden Trichter je eine glatte Steinstufe in die untere Hälfte (Ebene 4). Auf diesen Stufen stehen später die Küken; Gegenstände, die darauf fallen, saugen die Trichter trotzdem durch.');
  for (const x of CHAMBER_X) b.slab(x, 3, CHAMBER_Z, 'smooth_stone_slab', { type: 'bottom' });
  b.note(2, 3, CHAMBER_Z, 'Kammer: Küken stehen auf den Stufen, darüber die Lavakessel');
}

function clock(b) {
  b.phase('Werfer und Takt', 'Links neben der Kammer steht der Werfer, der die Eier hineinwirft. Darunter sorgt ein Beobachter-Takt dafür, dass er alle paar Ticks auslöst – liegt ein Ei darin, fliegt es in die Kammer.', {
    tips: [
      'Zwei Beobachter, die sich gegenseitig anschauen, schalten sich endlos gegenseitig an und aus. Das ist der einfachste Takt im Spiel.',
      'Der Takt läuft ununterbrochen. Ist gerade kein Ei im Werfer, klickt er leise – das ist normal und schadet nichts.',
      'Ein Werfer schaut beim Setzen zu dir: Stell dich in die Kammer-Nische und schau nach Westen, dann zeigt sein Loch nach Osten in die Kammer.',
    ],
  });
  b.step('Beobachter-Takt', `Setz auf Ebene 2 bei x = 0, z = ${CHAMBER_Z} einen Beobachter mit dem Gesicht nach oben. Darauf (Ebene 3) einen zweiten mit dem Gesicht nach unten – die Gesichter schauen sich an, der rote Punkt des oberen zeigt nach oben. Sobald der zweite steht, fangen beide an zu klicken.`);
  b.set(0, 1, CHAMBER_Z, 'observer[facing=up]');
  b.set(0, 2, CHAMBER_Z, 'observer[facing=down]');
  b.note(0, 2, CHAMBER_Z, 'Beobachter-Takt: läuft immer und löst den Werfer aus');

  b.step('Werfer', `Stell den Werfer auf Ebene 4 (x = 0) auf den oberen Beobachter, das Loch nach Osten in die Kammer. Darauf kommt ein Trichter, der nach unten in den Werfer zeigt.`);
  b.set(0, 3, CHAMBER_Z, 'dispenser[facing=east]');
  b.set(0, 4, CHAMBER_Z, 'hopper[facing=down]');
  b.note(0, 3, CHAMBER_Z, 'Werfer: wirft jedes Ei in die Kammer');
}

function tower(b) {
  b.phase('Turmwände', 'Jetzt mauerst du den Turm um alles herum hoch. Innen bleiben nur die Kammer und die Nische vor der Truhe frei.', {
    tips: [
      'Die Kammer muss rundum dicht sein: Küken sind nur 0,3 Blöcke breit und schlüpfen durch jede Lücke.',
      'Setz zuerst die vier Ecksäulen aus poliertem Andesit, dann ist die Wand schnell gefüllt.',
    ],
  });
  b.step('Außenmauer', 'Mauere die Außenwände von Ebene 2 bis 6 hoch: Ecken aus poliertem Andesit, dazwischen Steinziegel mit ein paar bemoosten. In der Südwand bleibt vor der Truhe eine Nische (x = 1 und 2, Ebene 2 und 3) offen.');
  for (let y = 1; y <= TOWER.top; y++) {
    for (let x = TOWER.x1; x <= TOWER.x2; x++) {
      for (let z = TOWER.z1; z <= TOWER.z2; z++) {
        if (!isTowerShell(x, z)) continue;
        const niche = z === TOWER.z2 && CHAMBER_X.includes(x) && y <= 2;
        if (!niche) b.set(x, y, z, towerWallBlock(x, y, z));
      }
    }
  }

  b.step('Füllung innen', `Füll das Innere um die Technik herum mit Steinziegeln: Die Kammer (x = 1 und 2, Ebene 4 und 5) bekommt Wände an allen Seiten, nur nach Westen schaut der Werfer hinein. Vor der Truhe bleibt die Nische zwei Blöcke tief.`);
  const keep = new Set([
    '1,1,2', '2,1,2', '1,2,2', '2,2,2', '1,3,2', '2,3,2', '1,4,2', '2,4,2',
    '0,1,2', '0,2,2', '0,3,2', '0,4,2', '1,1,3', '2,1,3', '1,2,3', '2,2,3',
  ]);
  for (let y = 1; y <= 4; y++) {
    for (let x = TOWER.x1 + 1; x < TOWER.x2; x++) {
      for (let z = TOWER.z1 + 1; z < TOWER.z2; z++) {
        if (!keep.has(`${x},${y},${z}`)) b.set(x, y, z, WALL);
      }
    }
  }
  b.step('Sturz und Guckloch', `Über der Nische liegt auf Ebene 4 eine Reihe Steinziegeltreppen, umgedreht, mit der hohen Seite zur Wand – ein kleiner Sturz wie über einer Tür. In die Ostwand kommt auf Ebene 4 (x = 3, z = ${CHAMBER_Z}) ein Glasblock statt Stein: Durch dieses Guckloch siehst du die Küken in der Kammer.`);
  for (const x of CHAMBER_X) b.stairs(x, 3, TOWER.z2, 'stone_brick_stairs', { facing: 'north', half: 'top' });
  b.set(TOWER.x2, 3, CHAMBER_Z, 'glass');
  b.note(TOWER.x2, 3, CHAMBER_Z, 'Guckloch in die Kammer');

  b.step('Gesims', 'Leg rund um die Turmkrone auf Ebene 6 einen Kranz aus umgedrehten Steinziegeltreppen, die hohe Seite zum Turm. Nur an der Leiter (Westseite, Mitte) bleibt eine Lücke.');
  for (let x = TOWER.x1 - 1; x <= TOWER.x2 + 1; x++) {
    for (let z = TOWER.z1 - 1; z <= TOWER.z2 + 1; z++) {
      const ring = x === TOWER.x1 - 1 || x === TOWER.x2 + 1 || z === TOWER.z1 - 1 || z === TOWER.z2 + 1;
      if (!ring || (x === TOWER.x1 - 1 && z === CHAMBER_Z)) continue;
      b.stairs(x, TOWER.top, z, 'stone_brick_stairs', { facing: corniceFacing(x, z), half: 'top' });
    }
  }
}

function lavaCauldrons(b) {
  b.phase('Lavakessel', 'Über den beiden Stufen hängen zwei Lavakessel (Ebene 5). Zwischen Stufe und Kesselboden bleiben knapp 0,7 Blöcke Luft: Ein Küken (0,4 Blöcke hoch) steht darunter sicher, ein erwachsenes Huhn (0,7) ragt mit dem Kopf in den Kesselboden und fängt Feuer.', {
    tips: [
      'Warum Kessel und keine freie Lava? Ein Lavablock verbrennt auch das gebratene Hähnchen, das herunterfällt. Der Kesselboden fängt die Gegenstände auf, bevor sie die Lava berühren – so landet alles im Trichter.',
      'Lava im Kessel fließt nicht und zündet nichts an. Halte trotzdem Abstand, wenn du sie einfüllst.',
    ],
  });
  b.step('Zwei Lavakessel', `Stell auf Ebene 5 bei x = 1 und x = 2 (z = ${CHAMBER_Z}) je einen Kessel direkt über die Stufen und füll beide von oben mit einem Eimer Lava, solange das Gehege noch nicht gebaut ist.`);
  for (const x of CHAMBER_X) b.set(x, 4, CHAMBER_Z, 'lava_cauldron');
  b.note(1, 4, CHAMBER_Z, 'Lavakessel: nur erwachsene Hühner ragen von unten hinein');
}

function pen(b) {
  b.phase('Gehege', 'Oben auf dem Turm leben die Hühner in einem kleinen Glashaus. Sein Boden besteht aus neun Trichtern, die jedes Ei zum Trichter über dem Werfer schieben.', {
    tips: [
      'Trichter zeigen beim Setzen auf den Block, auf den du zielst. Setz zuerst den Sammeltrichter über dem Werfer und dann die anderen schleichend an ihn heran.',
      'Die Trichter über den Lavakesseln sind ihr Deckel – füll die Kessel vorher mit Lava.',
    ],
  });
  b.step('Trichterboden', `Leg auf Ebene 6 neun Trichter (x = 0 bis 2, z = 1 bis 3). Der Trichter bei x = 0, z = ${CHAMBER_Z} zeigt nach unten in den Trichter über dem Werfer. Die beiden rechts daneben zeigen nach Westen zu ihm, die drei in der Nordreihe nach Süden und die drei in der Südreihe nach Norden.`);
  for (let x = PEN.x1; x <= PEN.x2; x++) {
    for (let z = PEN.z1; z <= PEN.z2; z++) b.set(x, PEN.y, z, `hopper[facing=${penHopperFacing(x, z)}]`);
  }
  b.note(0, PEN.y, CHAMBER_Z, 'Sammeltrichter: alle Eier laufen hier zusammen');

  b.step('Eckpfosten', 'Stell auf die vier Ecken des Turms Fichtenstämme, zwei Blöcke hoch (Ebene 7 und 8).');
  for (const x of [TOWER.x1, TOWER.x2]) {
    for (const z of [TOWER.z1, TOWER.z2]) for (let y = 6; y <= 7; y++) b.set(x, y, z, `${spruce.log}[axis=y]`);
  }

  b.step('Glaswände und Tor', `Füll die Seiten zwischen den Pfosten mit Glas (Ebene 7 und 8). In die Westwand kommt auf Ebene 7 mittig (x = −1, z = ${CHAMBER_Z}) ein Fichtenzauntor – Hühner öffnen keine Tore, du aber schon.`);
  for (let y = 6; y <= 7; y++) {
    for (let x = TOWER.x1; x <= TOWER.x2; x++) {
      for (let z = TOWER.z1; z <= TOWER.z2; z++) {
        if (!isTowerShell(x, z)) continue;
        const corner = (x === TOWER.x1 || x === TOWER.x2) && (z === TOWER.z1 || z === TOWER.z2);
        if (corner) continue;
        const gate = x === TOWER.x1 && z === CHAMBER_Z && y === 6;
        b.set(x, y, z, gate ? `${spruce.fenceGate}[facing=east]` : 'glass');
      }
    }
  }

  b.step('Leiter', `Häng an die Westseite des Turms (x = −2, z = ${CHAMBER_Z}) eine Leiter von Ebene 2 bis 6. Oben steigst du auf die Turmkante und öffnest das Tor.`);
  for (let y = 1; y <= TOWER.top; y++) b.set(-2, y, CHAMBER_Z, 'ladder[facing=west]');
}

function roof(b) {
  b.phase('Dach und Hühner', 'Ein Satteldach aus Fichte schützt das Gehege. Es ist 7 Blöcke breit, der First läuft von Westen nach Osten. Danach ziehen die Hühner ein.', {
    tips: [
      'Setz zuerst die unterste Treppenreihe rundherum mit Überstand, dann Reihe für Reihe nach innen und oben.',
      'Hühner bekommst du am einfachsten, indem du dich ans offene Tor stellst und Eier ins Gehege wirfst. Aus jedem achten schlüpft ein Küken; in 20 Minuten ist es erwachsen.',
      'Oder lock Hühner mit Weizensamen in der Hand und führ sie an einer Leine die Leiter hinauf.',
      'Die ersten Küken in der Kammer kommen aus den Eiern des Geheges – nach etwa einer halben Stunde fällt das erste gebratene Hähnchen in die Truhe.',
    ],
  });
  b.roof({ x1: TOWER.x1, z1: TOWER.z1, x2: TOWER.x2, z2: TOWER.z2, y: 7, type: 'gable', axis: 'x', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
  b.step('Laterne und Hühner', `Häng unter den First eine Laterne an einer Kette (Ebene 9, x = 1, z = ${CHAMBER_Z}), sie leuchtet das Gehege aus. Dann bring neun Hühner hinein – eines pro Trichter, mehr als etwa 20 sollten es nicht werden – und schließ das Tor. Hühner sind keine Blöcke, darum zeigt die 3D-Ansicht für sie nur eine Markierung.`);
  hangingLantern(b, { x: 1, y: 9, z: CHAMBER_Z, chain: 1 });
  b.note(1, 6, CHAMBER_Z, 'Hier 9 Hühner hineinbringen (Eier werfen oder mit Samen locken)');
}

function surroundings(b) {
  b.phase('Hof und Umgebung', 'Ein kleiner Hühnerhof neben dem Turm, ein Weg zur Truhe und ein paar Blumen.', {
    tips: ['Monster spawnen in 26.2 nur bei Blocklicht 0 – die Laternen am Hof halten Zombies nachts von der Farm fern.'],
  });
  b.step('Hühnerhof', 'Zieh östlich des Turms einen Fichtenzaun um einen kleinen Hof (5 × 5 Blöcke) mit Tor nach Süden. Darin: zwei Heuballen, ein Komposter und ein Kessel mit Wasser als Tränke.');
  gardenFence(b, { x: 5, y: 1, z: 0, width: 5, depth: 5, fence: spruce.fence, gate: spruce.fenceGate, posts: spruce.strippedLog, lanterns: true });
  b.set(8, 1, 1, 'hay_block[axis=x]');
  b.set(8, 2, 1, 'hay_block[axis=z]');
  b.set(6, 1, 1, 'composter[level=0]');
  b.set(8, 1, 3, 'water_cauldron[level=3]');

  b.step('Weg und Garten', 'Leg einen Trampelpfad von Süden zur Truhen-Nische, Blumen an die Westseite und einen Laternenpfahl an den Weg. Links und rechts der Nische hängen zwei Laternen an Zaun-Armen (Arm auf Ebene 4).');
  path(b, { x: 1, y: 0, z: 5, facing: 'south', length: 5, width: 3, mix: 'erde', wiggle: 0.5, seed: 7 });
  wallLantern(b, { x: TOWER.x1, y: 2, z: TOWER.z2, facing: 'south', arm: spruce.fence });
  wallLantern(b, { x: TOWER.x2, y: 2, z: TOWER.z2, facing: 'south', arm: spruce.fence });
  flowerBed(b, { x: -5, y: 0, z: 0, width: 2, depth: 5, facing: 'west', palette: 'warm', seed: 5 });
  lampPost(b, { x: -1, y: 1, z: 7, height: 3, post: spruce.fence, style: 'arm' });
  bush(b, { x: -5, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 3 });
  bush(b, { x: 10, y: 1, z: 7, size: 'klein', leaves: 'azalee', seed: 4 });
  tree(b, { x: 7, y: 1, z: -5, species: 'birke', size: 'klein', seed: 2 });
  vegetation(b, { x: -8, y: 0, z: -7, width: 19, depth: 19, mix: 'wiese', density: 0.3, seed: 11 });
}

export default function build(b) {
  foundation(b);
  collector(b);
  clock(b);
  tower(b);
  lavaCauldrons(b);
  pen(b);
  roof(b);
  surroundings(b);
}
