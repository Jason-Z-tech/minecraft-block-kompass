// 2×2-Kolbentür in einer 3 Blöcke dicken Hofmauer aus Steinziegeln. Vier klebrige Kolben ziehen zwei 2 hohe Torflügel
// (geschältes Fichtenholz) seitlich in die Mauer. Ein Knopf außen und einer innen schalten über eine Kupferbirne um:
// einmal drücken = zu, nochmal drücken = auf. Alle Leitungen liegen in der Mauer und unter dem Torweg.
// Bau-Rahmen: Mauer x −11 … 12, z −1 (innen, Hof) … 1 (außen, Weg), Fundament y = 0, Mauer y 1 … 6. Kernebene z = 0.
//
// Signalweg (Kernebene z = 0, von außen gesehen, Osten rechts):
//   Knopf außen (6, 2, 2) bzw. innen (6, 2, −2) → sein Wandblock (6, 2, ±1) wird stark versorgt → Kupferbirne (6, 2, 0)
//   schaltet bei jedem Druck um (an ↔ aus).
//   Rechts: Komparator (5, 2, 0) liest die Birne (Rückseite Osten, Ausgang Westen) → Staub (4, 2, 0) zeigt in den oberen
//   Kolben (3, 2, 0) und versorgt den Block darunter (4, 1, 0) → der untere Kolben (3, 1, 0) daneben fährt ebenfalls aus.
//   Links: zweiter Komparator (7, 2, 0) liest die Birne nach Osten → Staubtreppe hinunter (8, 2, 0) → (9, 1, 0) → (10, 0, 0)
//   → Leitung im Fundament der Innenseite (z = −1, y = 0) nach Westen, Repeater (4, 0, −1) frischt auf 15 auf, unter dem
//   Torweg taucht sie auf y = −1 ab (obere Stufen als Boden lassen den Staub verbinden) → (−6, 0, 0) → Staubtreppe hinauf
//   (−5, 1, 0) → (−4, 2, 0) → Staub (−3, 2, 0) zeigt in den oberen linken Kolben, der Block darunter versorgt den unteren.
//   Birne an = Kolben ausgefahren = Tor zu. Beim Bauen ist die Birne aus, das Tor steht also offen.

import { WOOD, wallLantern, lampPost, terrain, path, flowerBed, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'kolbentuer-2x2',
  title: '2×2-Kolbentür',
  category: 'redstone',
  subtitle: 'Klassisches 2 × 2-Tor aus klebrigen Kolben in einer Hofmauer – mit Knöpfen von beiden Seiten und unsichtbaren Leitungen',
  tags: ['Redstone', 'Tür', 'Tor', 'Kolben', 'Klebriger Kolben', 'Kolbentür', 'Kupferbirne', 'Komparator', 'Versteckt', 'Mauer', 'Eingang'],
  aliases: [
    '2x2 kolbentür', '2x2 kolbentuer', '2x2 kolben tür', 'kolbentür', 'kolbentuer', 'kolben tür', 'kolbentor', 'kolben tor',
    'piston door', '2x2 piston door', 'sticky piston door', 'redstone tür', 'redstone tor', 'redstone door', 'versteckte tür',
    'kolbentur', 'kolbn tür', 'kolbentühr', 'tor mit kolben', 'mauertor', 'hoftor redstone',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Ein 2 × 2 Blöcke großes Tor in einer dicken Hofmauer: Vier klebrige Kolben schieben zwei Torflügel aus Fichtenholz in die Öffnung und ziehen sie wieder in die Mauer zurück. Außen und innen sitzt je ein Knopf; ein Druck schließt das Tor, der nächste öffnet es wieder – egal auf welcher Seite du stehst. Möglich macht das eine Kupferbirne, die bei jedem Knopfdruck umschaltet. Alle Leitungen liegen unsichtbar in der Mauer und unter dem Torweg.',
  facts: [
    'Größe der Öffnung: 2 Blöcke breit, 2 hoch. Die Mauer ist 3 Blöcke dick, damit Kolben und Leitungen ganz darin verschwinden.',
    'Eine Kupferbirne schaltet bei jedem neuen Signal um (an → aus → an). Ein Komparator dahinter gibt 15 aus, solange sie leuchtet – so wird aus zwei Knöpfen ein Ein-Aus-Schalter.',
    'Gewachste Kupferbirnen oxidieren nicht. Für die Schaltung ist das egal, aber die Birne bleibt so dauerhaft kupferrot.',
    'Die linke Hälfte bekommt ihr Signal über einen Umweg mit einem Repeater und fährt deshalb einen Redstone-Tick (0,1 Sekunden) nach der rechten – im Spiel siehst du das kaum.',
    'Unter dem Torweg liegen obere Steinziegelstufen statt voller Blöcke: Stufen leiten kein Redstone, darum darf der Staub darunter ab- und wieder auftauchen.',
    'Nicht im Spiel getestet: Aufbau und Signalweg folgen den Regeln für Kolben, Komparator, Kupferbirne und Redstone-Staub im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Sticky Piston', url: 'https://minecraft.wiki/w/Sticky_Piston' },
    { title: 'Minecraft Wiki: Copper Bulb', url: 'https://minecraft.wiki/w/Copper_Bulb' },
    { title: 'Minecraft Wiki: Redstone Comparator', url: 'https://minecraft.wiki/w/Redstone_Comparator' },
    { title: 'Minecraft Wiki: Redstone Dust', url: 'https://minecraft.wiki/w/Redstone_Dust' },
    { title: 'Minecraft Wiki: Tutorial – Piston uses (Doors)', url: 'https://minecraft.wiki/w/Tutorial:Piston_uses#Doors' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const X1 = -11;
const X2 = 12;
const WALL_TOP = 4;
const PILLARS = [-11, -6, 7, 12];
const GATE_LEAF = 'stripped_spruce_wood[axis=y]';
const FLOOR_SLAB = 'stone_brick_slab[type=top]';
const DUST = 'redstone_wire';
const GROUND = { x: -15, z: -13, width: 32, depth: 25 };

// Hohlräume in der Kernebene, damit die Staubtreppen verbinden (über der unteren Stufe darf kein voller Block sein).
const CORE_AIR = [[9, 2], [10, 1], [-5, 2], [-6, 1]];
// Alles, was in der Kernebene z = 0 nicht Füllmauer ist (x, y).
const CORE_PARTS = new Set([
  '0,1', '1,1', '0,2', '1,2', '-1,1', '-1,2', '2,1', '2,2', '-2,1', '-2,2', '3,1', '3,2',
  '4,1', '4,2', '5,1', '5,2', '6,1', '6,2', '7,1', '7,2', '8,1', '8,2', '9,1', '9,0', '10,0',
  '-3,1', '-3,2', '-4,1', '-4,2', '-5,1', '-5,0', '-6,0',
  ...CORE_AIR.map(([x, y]) => `${x},${y}`),
]);

function wallBrick(b, y) {
  if (y === 1) return b.chance(0.3) ? 'mossy_stone_bricks' : 'stone_bricks';
  return b.pickWeighted([['stone_bricks', 10], ['cracked_stone_bricks', 1], ['mossy_stone_bricks', 1]]);
}

function site(b) {
  b.phase('Bauplatz und Fundament', 'Such dir eine ebene Wiese, mindestens 30 × 20 Blöcke. Die Mauer wird 24 Blöcke lang und 3 dick; das Tor sitzt fast in der Mitte. In diesem Kapitel legst du das Fundament und lässt Platz für die Leitung, die später unter dem Torweg durchläuft.', {
    tips: [
      'Setz zuerst die vier Ecken des Fundaments (24 × 3) und zähl dann ab. Das Tor liegt auf den Feldern 12 und 13 von Westen.',
      'Grab die Rinne für die Leitung erst, wenn das Fundament liegt – dann verzählst du dich nicht.',
    ],
  });
  b.step('Wiese', 'Die Wiese rund um die Mauer.');
  terrain(b, { x: GROUND.x, y: -3, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 3, seed: 'kolbentuer' });

  b.step('Fundament', 'Ersetze auf Bodenhöhe einen Streifen von 24 × 3 Blöcken durch Bruchstein. Die mittlere und die äußere Reihe sind ganz voll. In der inneren Reihe (Hofseite) bleiben die Felder vom 6. Block westlich des Tors bis zum 9. Block östlich davon frei – dort kommt die Leitung hinein. In der mittleren Reihe bleibt je ein Feld an diesen beiden Enden frei. Im Torweg selbst (2 × 3 Felder) liegen obere Steinziegelstufen als Boden, außer in der inneren Reihe: dort setzt du sie erst nach der Leitung.');
  for (let x = X1; x <= X2; x++) {
    for (let z = -1; z <= 1; z++) {
      const gate = x >= 0 && x <= 1;
      if (z === -1 && x >= -6 && x <= 10) continue;
      if (z === 0 && (x === 10 || x === -6)) continue;
      b.set(x, 0, z, gate ? FLOOR_SLAB : 'cobblestone');
    }
  }

  b.step('Leitung unter dem Torweg', 'Leg in die freie Rinne der Hofseite Redstone-Staub: vom 6. Feld westlich des Tors bis zum 9. Feld östlich davon. Unter den beiden Torfeldern gräbst du einen Block tiefer und legst den Staub dort hinein – die Leitung taucht ab und wieder auf. An beiden Enden biegt die Leitung in die mittlere Reihe ab (je ein Staub in die frei gelassenen Felder). Im 3. Feld östlich des Tors kommt ein Repeater statt Staub hinein, Pfeil nach Westen (stell dich östlich davon hin und schau nach Westen). Zum Schluss deckst du die zwei Löcher im Torweg mit oberen Steinziegelstufen ab.');
  for (let x = -6; x <= 10; x++) {
    if (x === 0 || x === 1) {
      b.set(x, -2, -1, 'stone');
      b.set(x, -1, -1, DUST);
      b.set(x, 0, -1, FLOOR_SLAB);
    } else if (x === 4) {
      b.set(x, 0, -1, 'repeater[delay=1,facing=east]');
    } else {
      b.set(x, 0, -1, DUST);
    }
  }
  b.set(10, 0, 0, DUST);
  b.set(-6, 0, 0, DUST);
  b.note(4, 0, -1, 'Repeater: frischt das Signal für die linke Torhälfte wieder auf 15 auf (Pfeil nach Westen)');
  b.note(0, -1, -1, 'Hier taucht die Leitung unter den Torweg ab – darüber liegen obere Stufen, die kein Redstone leiten');
}

function pistons(b) {
  b.phase('Kolben und Torflügel', 'Jetzt kommt die Mechanik in die mittlere Reihe der Mauer (die Kernebene). Die Öffnung ist 2 breit und 2 hoch. Links und rechts davon sitzen je zwei klebrige Kolben übereinander, die schleimige Seite zur Öffnung.', {
    tips: [
      'Klebrige Kolben zeigen beim Setzen mit dem Kopf zu dir. Für die linken Kolben stellst du dich also in die Öffnung und schaust nach Westen, für die rechten nach Osten.',
      'Die Torflügel kommen direkt vor die Kolben. Beim Bauen bleiben die Kolben eingefahren: das Tor ist offen, bis du zum ersten Mal einen Knopf drückst.',
    ],
  });
  b.step('Kolben', 'Setz links der Öffnung im Abstand von einem Block zwei klebrige Kolben übereinander (Ebene 5 und 6), Kopf nach Osten. Rechts genauso, Kopf nach Westen.');
  for (const y of [1, 2]) {
    b.set(-2, y, 0, 'sticky_piston[extended=false,facing=east]');
    b.set(3, y, 0, 'sticky_piston[extended=false,facing=west]');
  }
  b.step('Torflügel', 'Vor jeden Kolben kommt ein Block geschältes Fichtenholz – das sind die zwei Torflügel, je 2 hoch. Wenn die Kolben ausfahren, schieben sie die Flügel in die Öffnung.');
  for (const y of [1, 2]) {
    b.set(-1, y, 0, GATE_LEAF);
    b.set(2, y, 0, GATE_LEAF);
  }
}

function control(b) {
  b.phase('Steuerung mit Kupferbirne', 'Die Steuerung sitzt rechts vom Tor in der Kernebene: eine Kupferbirne zwischen den beiden Knöpfen und zwei Komparatoren, die sie auslesen. Der eine versorgt die rechten Kolben direkt, der andere schickt das Signal über die Leitung im Fundament nach links.', {
    tips: [
      'Ein Komparator gibt sein Signal immer von dir weg aus: Die Rückseite mit den zwei kleinen Fackeln zeigt zu dir, die einzelne Fackel vorne von dir weg. Damit die Rückseite die Birne liest, schaust du beim Setzen also von der Birne weg.',
      'Nimm eine gewachste Kupferbirne (Birne mit Honigwabe bearbeiten). Sie leuchtet nicht immer gleich hell, wenn sie oxidiert – die Schaltung ist davon aber nicht betroffen.',
    ],
  });
  b.step('Rechte Seite', 'Hinter die rechten Kolben setzt du auf Ebene 5 einen Steinblock und darauf Redstone-Staub. Daneben (nach Osten) kommen auf Steinblöcken ein Komparator, die gewachste Kupferbirne und ein zweiter Komparator. Den ersten Komparator (westlich der Birne) setzt du mit Blick nach Westen, den zweiten (östlich der Birne) mit Blick nach Osten – so liegt bei beiden die Rückseite an der Birne.');
  b.set(4, 1, 0, 'stone');
  b.set(4, 2, 0, DUST);
  b.set(5, 1, 0, 'stone');
  b.set(5, 2, 0, 'comparator[facing=east,mode=compare]');
  b.set(6, 1, 0, 'stone');
  b.set(6, 2, 0, 'waxed_copper_bulb[lit=false,powered=false]');
  b.set(7, 1, 0, 'stone');
  b.set(7, 2, 0, 'comparator[facing=west,mode=compare]');
  b.note(6, 2, 0, 'Kupferbirne: schaltet bei jedem Knopfdruck um – an = Tor zu, aus = Tor offen');
  b.note(5, 2, 0, 'Komparator liest die Birne und versorgt die rechten Kolben');

  b.step('Staubtreppe rechts', 'Vom zweiten Komparator führt eine Treppe aus Redstone-Staub nach Osten hinunter zur Leitung im Fundament: Staub auf Ebene 6, dann eine Stufe tiefer auf Ebene 5, dann auf Ebene 4 in die mittlere Fundamentreihe. Über den beiden unteren Stufen bleibt die Zelle frei, sonst reißt die Verbindung ab.');
  b.set(8, 1, 0, 'stone');
  b.set(8, 2, 0, DUST);
  b.set(9, 0, 0, 'stone');
  b.set(9, 1, 0, DUST);

  b.step('Staubtreppe links', 'Links vom Tor steigt die Leitung aus dem Fundament wieder hinauf: Staub auf Ebene 5 und Ebene 6 auf Steinblöcken, dann direkt hinter dem oberen linken Kolben noch ein Staub auf Ebene 6. Er zeigt in den Kolben und versorgt auch den Block darunter – der treibt den unteren Kolben an.');
  b.set(-5, 0, 0, 'stone');
  b.set(-5, 1, 0, DUST);
  b.set(-4, 1, 0, 'stone');
  b.set(-4, 2, 0, DUST);
  b.set(-3, 1, 0, 'stone');
  b.set(-3, 2, 0, DUST);
  b.note(-3, 2, 0, 'Staub zeigt in den oberen Kolben, der Block darunter treibt den unteren Kolben an');
}

function walls(b) {
  b.phase('Mauer', 'Jetzt verschwindet die Technik: Die Mauer wird 4 Blöcke hoch (Ebene 5 bis 8). Die Kernebene füllst du mit Steinziegeln auf, außer an den vier frei gelassenen Zellen der Staubtreppen. Innen- und Außenseite bekommen Steinziegel mit ein paar bemoosten und rissigen dazwischen.', {
    tips: [
      'Bau Reihe für Reihe von unten nach oben. Lass in der Kernebene die Zelle über jeder unteren Staubstufe frei (zwei rechts, zwei links vom Tor).',
      'Die Öffnung bleibt in allen drei Reihen frei. Um sie herum setzt du auf beiden Seiten polierten Andesit als Rahmen.',
    ],
  });
  b.step('Kernebene', 'Fülle die mittlere Reihe der Mauer bis Ebene 8 mit Steinziegeln, ohne die Mechanik und die vier Hohlräume zu überbauen.');
  for (let x = X1; x <= X2; x++) {
    for (let y = 1; y <= WALL_TOP; y++) {
      if (CORE_PARTS.has(`${x},${y}`)) continue;
      b.set(x, y, 0, 'stone_bricks');
    }
  }
  b.step('Innen- und Außenseite', 'Mauere die Hof- und die Wegseite hoch. Rund um die Öffnung (links, rechts und darüber) kommt polierter Andesit als Rahmen. An der Stelle, an der später die Knöpfe sitzen (5. Feld östlich des Tors, Ebene 6, genau vor und hinter der Kupferbirne), setzt du auf beiden Seiten einen gemeißelten Steinziegel als Schaltfeld.');
  for (const z of [-1, 1]) {
    for (let x = X1; x <= X2; x++) {
      for (let y = 1; y <= WALL_TOP; y++) {
        if (x >= 0 && x <= 1 && y <= 2) continue;
        const frame = (x === -1 || x === 2) && y <= 3 || (x >= -1 && x <= 2 && y === 3);
        if (frame) b.set(x, y, z, 'polished_andesite');
        else if (x === 6 && y === 2) b.set(x, y, z, 'chiseled_stone_bricks');
        else b.set(x, y, z, wallBrick(b, y));
      }
    }
  }
}

function crown(b) {
  b.phase('Mauerkrone und Pfeiler', 'Oben bekommt die Mauer eine Krone: auf beiden Seiten Steinziegeltreppen mit der hohen Seite zur Mitte, in der Mitte ein Steinziegel und darauf eine Stufe. Vier Pfeiler gliedern die Mauer.', {
    tips: ['Setz die Kronentreppen, während du auf der Mauer stehst und zur Mitte schaust – dann zeigt die hohe Seite automatisch nach innen.'],
  });
  b.step('Krone', 'Krone auf Ebene 9 und 10.');
  for (let x = X1; x <= X2; x++) {
    if (PILLARS.includes(x)) continue;
    b.set(x, WALL_TOP + 1, 1, 'stone_brick_stairs[facing=north,half=bottom]');
    b.set(x, WALL_TOP + 1, -1, 'stone_brick_stairs[facing=south,half=bottom]');
    b.set(x, WALL_TOP + 1, 0, 'stone_bricks');
    b.set(x, WALL_TOP + 2, 0, 'stone_brick_slab[type=bottom]');
  }
  b.step('Pfeiler', 'Jeder Pfeiler springt auf beiden Seiten einen Block vor und reicht bis Ebene 10. Oben liegt eine Platte aus poliertem Andesit, darauf eine Laterne.');
  for (const x of PILLARS) {
    for (const z of [-2, 2]) {
      b.set(x, 0, z, 'stone_bricks');
      for (let y = 1; y <= WALL_TOP + 1; y++) b.set(x, y, z, y === 1 ? 'mossy_stone_bricks' : 'stone_bricks');
    }
    for (const z of [-1, 0, 1]) b.set(x, WALL_TOP + 1, z, 'stone_bricks');
    for (let z = -2; z <= 2; z++) b.set(x, WALL_TOP + 2, z, 'polished_andesite');
    b.set(x, WALL_TOP + 3, 0, 'lantern[hanging=false]');
  }
  b.step('Banner', 'An die beiden Pfeiler neben dem Tor hängst du auf der Wegseite je ein rotes Banner (Ebene 8).');
  for (const x of [-6, 7]) b.set(x, WALL_TOP, 3, 'red_wall_banner[facing=south]');
}

function buttons(b) {
  b.phase('Knöpfe, Vordach und Licht', 'Zum Schluss die Bedienung: ein Knopf auf jeder Seite, dazu ein kleines Vordach über dem Tor und Laternen neben der Öffnung.', {
    tips: [
      'Drück einen Knopf, um das Tor zu schließen, und einen der beiden noch einmal, um es zu öffnen. Ist es nach dem Bauen zu statt offen, drück einfach einmal.',
      'Statt Steinknöpfen gehen auch Holzknöpfe – die bleiben länger gedrückt, für die Birne ist das egal.',
    ],
  });
  b.step('Knöpfe', 'Setz je einen Steinknopf auf das gemeißelte Schaltfeld – außen auf die Wegseite, innen auf die Hofseite.');
  b.set(6, 2, 2, 'stone_button[face=wall,facing=south,powered=false]');
  b.set(6, 2, -2, 'stone_button[face=wall,facing=north,powered=false]');
  b.note(6, 2, 2, 'Knopf außen: Tor auf/zu');
  b.note(6, 2, -2, 'Knopf innen: Tor auf/zu');

  b.step('Vordach', 'Über der Öffnung kommt auf beiden Seiten auf Ebene 8 eine Reihe Fichtentreppen (4 breit, hohe Seite zur Mauer), getragen von zwei umgedrehten Fichtentreppen an den Enden auf Ebene 7.');
  for (const [z, f] of [[2, 'north'], [-2, 'south']]) {
    for (let x = -1; x <= 2; x++) b.set(x, WALL_TOP, z, `${spruce.stairs}[facing=${f},half=bottom]`);
    for (const x of [-1, 2]) b.set(x, WALL_TOP - 1, z, `${spruce.stairs}[facing=${f},half=top]`);
  }
  b.step('Laternen', 'Neben dem Tor hängt auf jeder Seite links und rechts eine Laterne an einem Fichtenzaun-Arm.');
  for (const [z, f] of [[1, 'south'], [-1, 'north']]) {
    for (const x of [-3, 4]) wallLantern(b, { x, y: 2, z, facing: f, style: 'bracket', arm: spruce.fence });
  }
}

function surroundings(b) {
  b.phase('Weg und Hof', 'Draußen führt ein Weg zum Tor, drinnen liegt ein kleiner Hof mit Beeten, einem Baum und Büschen.');
  b.step('Wege', 'Ein Trampelpfad führt von Süden zum Tor und im Hof weiter nach Norden.');
  path(b, { x: 0, y: 0, z: 2, facing: 'south', length: 9, width: 3, mix: 'erde', wiggle: 1, seed: 11 });
  path(b, { x: 0, y: 0, z: -2, facing: 'north', length: 7, width: 3, mix: 'erde', wiggle: 1, seed: 12 });
  b.step('Laternenpfähle', 'Zwei Laternenpfähle aus Fichtenzaun säumen den Weg vor dem Tor.');
  lampPost(b, { x: -3, y: 1, z: 7, facing: 'east', height: 3, post: spruce.fence, base: 'stone_bricks', style: 'arm' });
  lampPost(b, { x: 4, y: 1, z: 7, facing: 'west', height: 3, post: spruce.fence, base: 'stone_bricks', style: 'arm' });
  b.step('Hof', 'Im Hof: zwei Blumenbeete mit Bruchsteinrand an der Mauer, eine Eiche und Büsche.');
  flowerBed(b, { x: -10, y: 0, z: -5, width: 8, depth: 3, facing: 'north', palette: 'rosa', border: 'stein', seed: 13 });
  flowerBed(b, { x: 4, y: 0, z: -5, width: 8, depth: 3, facing: 'north', palette: 'kuehl', border: 'stein', seed: 14 });
  tree(b, { x: -9, y: 1, z: -9, species: 'eiche', size: 'mittel', seed: 15 });
  bush(b, { x: 9, y: 1, z: -8, size: 'klein', leaves: 'azalee', seed: 16 });
  bush(b, { x: -13, y: 1, z: 5, size: 'klein', leaves: 'eiche', seed: 17 });
  bush(b, { x: 14, y: 1, z: 6, size: 'klein', leaves: 'eiche', seed: 18 });
  vegetation(b, { x: GROUND.x, y: 0, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.25, seed: 19 });
}

export default function build(b) {
  site(b);
  pistons(b);
  control(b);
  walls(b);
  crown(b);
  buttons(b);
  surroundings(b);
}
