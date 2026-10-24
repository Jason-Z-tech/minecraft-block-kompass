// Geheimtür hinter dem Bücherregal: ein Fachwerk-Studierzimmer, dessen Regalwand eine 1 × 2 große Tür versteckt.
// Zieh ein Buch aus dem richtigen gemeißelten Bücherregal – das untere Regal der Tür sinkt in den Boden, das obere
// fährt hinter die Zierleiste unter der Decke, und der Gang zur Geheimkammer ist frei. Buch zurückstellen = Tür zu.
// Bau-Rahmen: Haus x −6 … 6, z −10 … 8, Boden y = 0, Räume y 1 … 3, Decke y = 4, Dachboden ab y = 5.
//   Studierzimmer z 1 … 7 · Regalwand z = 0 · Technik-Ebenen z −1 und −2 · Wand der Kammer z −3 · Kammer z −9 … −4.
//
// Signalweg (Osten = +x, Norden = −z):
//   Gemeißeltes Bücherregal (2, 2, 0) → Beobachter (2, 2, −1) schaut nach Süden darauf und gibt bei jeder Änderung
//   (Buch heraus oder hinein) einen kurzen Impuls nach hinten in die Kupferbirne (2, 2, −2) → die Birne schaltet um.
//   Knopf in der Kammer (2, 2, −4) am Wandblock (2, 2, −3) schaltet dieselbe Birne ebenfalls um.
//   Komparator (3, 2, −2), Rückseite Westen, liest die Birne → Staub (4, 2, −2), dann zwei Äste:
//   – nach unten: (4, 2, −1) → (3, 1, −1) → (2, 0, −1) → (2, −1, −2) → (1, −1, −2) zeigt in den Block (0, −1, −2);
//     daran hängt die Redstone-Fackel F1 (0, −1, −1), die den unteren Kolben (0, −1, 0, Kopf nach oben) antreibt.
//   – nach oben: Glasleiter (5, 3, −2) → (4, 4, −2) → (5, 5, −2) → Dachboden (5, 5, −3) … (0, 5, −3) → (0, 5, −2) liegt auf
//     dem Block (0, 4, −2); daran hängt F2 (0, 4, −1), die den oberen Kolben (0, 4, 0, Kopf nach unten) antreibt.
//   Birne aus → beide Fackeln an → Kolben ausgefahren → Tür zu (so wird gebaut). Birne an → Fackeln aus → Kolben ziehen
//   die Regale nach unten bzw. oben → Tür offen. Über F2 (0, 5, −1) bleibt Luft, sonst würde F2 den Staub daneben speisen.

import { WOOD, window, doorway, dormer, timberWall, floorPattern, enchantingSetup, hangingLantern, lightRoom, findDarkSpots, terrain, path, flowerBed, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'geheimtuer-buecherregal',
  title: 'Geheimtür hinter dem Bücherregal',
  category: 'redstone',
  subtitle: 'Fachwerk-Studierzimmer mit Bücherwand, die sich auf einen Buchzug öffnet – dahinter die Geheimkammer',
  tags: ['Redstone', 'Geheimtür', 'Bücherregal', 'Geheimgang', 'Kolben', 'Beobachter', 'Kupferbirne', 'Versteckt', 'Fachwerk', 'Bibliothek', 'Zaubertisch'],
  aliases: [
    'geheimtür', 'geheimtuer', 'geheim tür', 'geheimtür bücherregal', 'bücherregal tür', 'buecherregal tuer', 'bücherregaltür',
    'regaltür', 'geheimgang', 'geheimraum', 'versteckte tür', 'secret door', 'bookshelf door', 'hidden door', 'secret bookshelf',
    'secret room', 'geheimtur', 'gehimtür', 'bücher regal geheimtür', 'geheime bibliothek',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Ein gemütliches Fachwerkhaus mit Studierzimmer: Die Rückwand ist eine Bücherwand, und in ihr steckt eine Geheimtür. Ziehst du ein Buch aus dem richtigen gemeißelten Bücherregal, sinkt das untere Regal der Tür in den Boden und das obere verschwindet hinter der Zierleiste unter der Decke. Ein kurzer Gang führt in die Geheimkammer mit Zaubertisch und Truhen. Stellst du das Buch zurück oder drückst den Knopf in der Kammer, schließt sich die Wand wieder.',
  facts: [
    'Ein Beobachter bemerkt jede Änderung am gemeißelten Bücherregal vor seinem Gesicht – auch ein herausgenommenes Buch – und gibt einen kurzen Impuls.',
    'Die Kupferbirne macht aus diesem Impuls einen Schalter: Sie wechselt bei jedem Impuls zwischen an und aus und bleibt dann so.',
    'Normale Bücherregale lassen sich von Kolben verschieben, gemeißelte nicht – sie speichern ihre Bücher und sind darum fest. Die Tür besteht deshalb aus zwei normalen Regalen.',
    'Die zwei anderen gemeißelten Regale in der Wand sind nur Tarnung. Nur das rechts neben der Tür, obere Reihe, öffnet den Gang.',
    'Die Redstone-Fackeln zeigen genau umgekehrt an: Brennen sie, ist die Tür zu.',
    'Nicht im Spiel getestet: Aufbau und Signalweg folgen den Regeln für Beobachter, Kupferbirne, Komparator, Redstone-Fackel und Kolben im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Chiseled Bookshelf', url: 'https://minecraft.wiki/w/Chiseled_Bookshelf' },
    { title: 'Minecraft Wiki: Observer', url: 'https://minecraft.wiki/w/Observer' },
    { title: 'Minecraft Wiki: Copper Bulb', url: 'https://minecraft.wiki/w/Copper_Bulb' },
    { title: 'Minecraft Wiki: Redstone Torch', url: 'https://minecraft.wiki/w/Redstone_Torch' },
    { title: 'Minecraft Wiki: Sticky Piston', url: 'https://minecraft.wiki/w/Sticky_Piston' },
    { title: 'Minecraft Wiki: Tutorial – Secret door', url: 'https://minecraft.wiki/w/Tutorial:Secret_door' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;
const HX = 6;
const ZN = -10;
const ZS = 8;
const CEIL = 4;
const DUST = 'redstone_wire';
const FILL = 'stone';
const GROUND = { x: -11, z: -15, width: 23, depth: 29 };
const TRIGGER = [2, 2, 0];
const DECOYS = [[-3, 1, 0], [4, 1, 0]];

// Zellen der Technik-Ebenen z −1 / −2 (y 0 … 3), die nicht mit Füllstein zugemauert werden.
const TECH_KEEP = new Set([
  '0,1,-1', '0,2,-1', '0,1,-2', '0,2,-2',
  '2,2,-1', '2,2,-2', '3,2,-2', '4,2,-2', '4,2,-1', '3,1,-1', '3,2,-1', '2,1,-1', '2,0,-1', '2,0,-2',
  '4,3,-2', '5,3,-2',
]);
const key = (x, y, z) => `${x},${y},${z}`;

function chiseledShelf(slots) {
  const props = slots.map((on, i) => `slot_${i}_occupied=${on}`).join(',');
  return `chiseled_bookshelf[facing=south,${props}]`;
}

function site(b) {
  b.phase('Bauplatz, Kolbengrube und Fundament', 'Such dir eine ebene Wiese. Das Haus ist 13 × 19 Blöcke groß. Bevor der Boden draufkommt, setzt du unter der späteren Bücherwand den unteren Kolben und ein Stück Leitung in den Untergrund.', {
    tips: [
      'Steck dir die Mitte der Bücherwand ab: 7 Blöcke von der West- und von der Ostwand, 11 Blöcke von der Nordwand. Dort liegt die Geheimtür.',
      'Der Kolben fährt sofort aus, wenn die Redstone-Fackel daneben brennt. Das ist richtig – auf seinen Kopf kommt später das untere Regal der Tür.',
    ],
  });
  b.step('Wiese', 'Die Wiese rund um das Haus.');
  terrain(b, { x: GROUND.x, y: -3, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 3, seed: 'geheimtuer' });

  b.step('Kolbengrube', 'Grab unter der Mitte der späteren Bücherwand zwei Blöcke tief. Setz ganz unten (Ebene 3) einen klebrigen Kolben mit dem Kopf nach oben – schau beim Setzen nach unten. Zwei Felder nördlich davon kommt ein Steinblock in dieselbe Tiefe, und an dessen Südseite eine Redstone-Fackel: Sie brennt sofort, der Kolben fährt aus.');
  b.set(0, -1, -2, FILL);
  b.set(0, -1, -1, 'redstone_wall_torch[facing=south,lit=true]');
  b.set(0, -1, 0, 'sticky_piston[extended=true,facing=up]');
  b.set(0, 0, 0, 'piston_head[facing=up,short=false,type=sticky]');
  b.note(0, -1, -1, 'Fackel F1 treibt den unteren Kolben an – brennt sie, ist die Tür zu');

  b.step('Leitung im Untergrund', 'Vom Steinblock der Fackel aus nach Osten liegen auf Ebene 3 zwei Redstone-Staub auf Stein (im ersten und zweiten Feld östlich des Blocks). Sie zeigen nach Westen in den Block: bekommt der Staub Strom, geht die Fackel aus.');
  for (const x of [1, 2]) {
    b.set(x, -2, -2, FILL);
    b.set(x, -1, -2, DUST);
  }

  b.step('Fundament und Fußboden', 'Leg auf Bodenhöhe das Fundament für alle Wände aus Bruchstein und die Böden: im Studierzimmer ein Fichtenboden mit Schwarzeichenrand, in der Kammer polierter Tiefenschiefer. Über dem Kolbenkopf und an zwei Stellen in der Technik-Ebene (zwei Felder östlich der Gangmitte) bleibt der Boden offen.');
  for (let x = -HX; x <= HX; x++) {
    for (let z = ZN; z <= ZS; z++) {
      if (x === 0 && z === 0) continue;
      if (x === 2 && (z === -1 || z === -2)) continue;
      const outer = x === -HX || x === HX || z === ZN || z === ZS;
      const wallRow = z <= 0 && z >= -3;
      if (outer || wallRow) b.set(x, 0, z, 'cobblestone');
      else if (z < -3) b.set(x, 0, z, 'polished_deepslate');
    }
  }
  floorPattern(b, { x: -5, y: 0, z: 1, facing: 'south', width: 11, depth: 7, pattern: 'border', blocks: [spruce.planks, dark.planks] });
  b.remove(2, 0, -2);
  b.set(2, 0, -1, DUST);
  b.note(2, 0, -1, 'Staubtreppe: hier steigt die Leitung zur Technik hinauf');
}

function techLayer(b) {
  b.phase('Technik hinter der Bücherwand', 'Hinter der Bücherwand liegen zwei Technik-Ebenen. Hier sitzen Beobachter, Kupferbirne und Komparator, und eine Staubtreppe führt hinunter zur Leitung im Boden. Der Gang zur Kammer (1 breit, 2 hoch) bleibt in der Mitte frei.', {
    tips: [
      'Ein Beobachter schaut von dir weg: Stell dich nördlich von seinem Platz hin und blick nach Süden zur späteren Bücherwand. Der rote Punkt (Ausgang) zeigt dann zu dir – genau dorthin kommt die Kupferbirne.',
      'Den Komparator setzt du mit Blick nach Osten, also von der Birne weg: Ein Komparator gibt sein Signal immer von dir weg aus. Seine Rückseite (zwei kleine Fackeln) liest dann die Birne, vorne kommt das Signal heraus.',
      'Über jeder unteren Stufe einer Staubtreppe muss Luft oder Glas sein, sonst bricht die Verbindung ab. Lass die freien Zellen also wirklich frei.',
    ],
  });
  b.step('Schaltzentrale', 'Zwei Felder östlich der Gangmitte, in der Ebene direkt hinter der Bücherwand: der Beobachter auf Ebene 6 (Gesicht nach Süden). Dahinter (nördlich) die gewachste Kupferbirne, daneben nach Osten der Komparator auf einem Steinblock, Rückseite zur Birne.');
  b.set(2, 1, -2, FILL);
  b.set(2, 2, -1, 'observer[facing=south,powered=false]');
  b.set(2, 2, -2, 'waxed_copper_bulb[lit=false,powered=false]');
  b.set(3, 1, -2, FILL);
  b.set(3, 2, -2, 'comparator[facing=west,mode=compare,powered=false]');
  b.note(2, 2, -1, 'Beobachter: sieht das gemeißelte Bücherregal und meldet jede Änderung');
  b.note(2, 2, -2, 'Kupferbirne: schaltet bei jedem Impuls um – an = Tür offen');

  b.step('Staubtreppe nach unten', 'Vor dem Komparator (östlich) kommt Staub auf einen Steinblock, und ein zweiter Staub direkt südlich daneben. Von dort führt die Treppe nach Westen hinunter: Staub auf Ebene 5, dann auf Ebene 4 genau über dem offenen Bodenfeld – er verbindet sich schräg nach unten mit dem Staub im Untergrund.');
  b.set(4, 1, -2, FILL);
  b.set(4, 2, -2, DUST);
  b.set(4, 1, -1, FILL);
  b.set(4, 2, -1, DUST);
  b.set(3, 0, -1, FILL);
  b.set(3, 1, -1, DUST);

  b.step('Glasleiter nach oben', 'Für die Leitung zum oberen Kolben baust du an der Ostseite eine Leiter aus Glas: Glas über den Staub vor dem Komparator, daneben nach Osten Staub auf einen Steinblock. Weiter oben in der Decke geht die Leiter mit Glas weiter. Glas leitet kein Redstone, darum kann der Staub darauf im Zickzack nach oben steigen.');
  b.set(5, 2, -2, FILL);
  b.set(5, 3, -2, DUST);
  b.set(4, 3, -2, 'glass');

  b.step('Technik zumauern', 'Fülle beide Technik-Ebenen bis Ebene 7 mit Stein auf. Frei bleiben nur der Gang in der Mitte, die Bauteile und die Luftzellen über den Staubstufen.');
  for (const z of [-1, -2]) {
    for (let x = -5; x <= 5; x++) {
      for (let y = 1; y <= 3; y++) {
        if (TECH_KEEP.has(key(x, y, z))) continue;
        if (b.get(x, y, z) !== 'air') continue;
        b.set(x, y, z, FILL);
      }
    }
  }
}

function walls(b) {
  b.phase('Wände und Bücherwand', 'Jetzt kommen die Fachwerkwände, die Bücherwand mit der Geheimtür und die Wand der Kammer.', {
    tips: [
      'Setz zuerst die vier Hausecken und die Ständer, dann füllst du die Felder mit Kalzit.',
      'Die Geheimtür sind zwei ganz normale Bücherregale: das untere direkt auf den Kolbenkopf, das obere darüber. Gemeißelte Bücherregale gehen hier nicht, die kann ein Kolben nicht bewegen.',
    ],
  });
  b.step('Fachwerkwände', 'Die Außenwände sind 4 Blöcke hoch (Ebene 5 bis 8): unten und oben ein liegender Balken aus geschältem Schwarzeichenstamm, alle 4 Blöcke ein stehender Ständer, dazwischen Kalzit.');
  const wall = { height: 4, frame: dark.strippedLog, fill: 'calcite', pattern: 'plain' };
  timberWall(b, { x: -HX, y: 1, z: ZS, facing: 'south', length: 13, ...wall });
  timberWall(b, { x: HX, y: 1, z: ZN, facing: 'north', length: 13, ...wall });
  timberWall(b, { x: -HX, y: 1, z: ZN, facing: 'west', length: 19, ...wall });
  timberWall(b, { x: HX, y: 1, z: ZS, facing: 'east', length: 19, ...wall });

  b.step('Bücherwand', 'Die Rückwand des Studierzimmers besteht aus Bücherregalen, 11 breit und 2 hoch. In der Mitte stehen die zwei Regale der Geheimtür. Zwei Felder östlich davon in der oberen Reihe kommt das gemeißelte Bücherregal, das die Tür öffnet – fülle es mit ein paar Büchern. Zwei weitere gemeißelte Regale weiter links und rechts unten sind nur Tarnung.');
  for (let x = -5; x <= 5; x++) for (let y = 1; y <= 2; y++) b.set(x, y, 0, 'bookshelf');
  b.set(...TRIGGER, chiseledShelf([true, true, false, true, true, false]));
  b.set(...DECOYS[0], chiseledShelf([true, false, true, true, false, true]));
  b.set(...DECOYS[1], chiseledShelf([false, true, true, true, true, false]));
  b.note(...TRIGGER, 'Zieh hier ein Buch heraus: die Tür öffnet sich. Zurückstellen schließt sie.');
  b.note(0, 1, 0, 'Geheimtür: zwei normale Bücherregale');

  b.step('Wand der Kammer', 'Hinter den Technik-Ebenen folgt die Südwand der Geheimkammer aus Steinziegeln, mit dem Gang in der Mitte. Zwei Felder östlich des Gangs auf Ebene 6 setzt du einen gemeißelten Steinziegel – an ihn kommt später der Knopf.');
  for (let x = -5; x <= 5; x++) {
    for (let y = 1; y <= 3; y++) {
      if (x === 0 && y <= 2) continue;
      b.set(x, y, -3, x === 2 && y === 2 ? 'chiseled_stone_bricks' : 'stone_bricks');
    }
  }
}

function ceiling(b) {
  b.phase('Decke, oberer Kolben und Dachboden-Leitung', 'Die Decke liegt auf Ebene 8. In ihr sitzen der obere Kolben und seine Fackel, und auf dem Dachboden läuft die Leitung vom Glasleiter zur Fackel. Unter der Decke kommt im Studierzimmer eine Zierleiste aus Schwarzeichentreppen vor die Bücherwand – sie versteckt den oberen Kolbenkopf.', {
    tips: [
      'Den oberen Kolben setzt du von oben, Blick nach unten – der Kopf zeigt dann nach unten. Er fährt sofort aus, sobald seine Fackel brennt, und packt das obere Regal der Tür.',
      'Direkt über der oberen Fackel muss Luft bleiben. Eine Fackel versorgt den Block über sich stark – läge dort ein Block, würde sie den Staub daneben speisen und sich selbst ausschalten.',
    ],
  });
  b.step('Zierleiste', 'Setz auf Ebene 7 vor die ganze Bücherwand eine Reihe umgedrehter Schwarzeichentreppen, die hohe Seite zur Wand. Die Ebene 7 hinter der Zierleiste füllst du mit Schwarzeichenbrettern – nur über der Geheimtür bleibt sie frei.');
  for (let x = -5; x <= 5; x++) {
    b.set(x, 3, 1, `${dark.stairs}[facing=north,half=top]`);
    if (x !== 0) b.set(x, 3, 0, dark.planks);
  }

  b.step('Decke', 'Leg auf Ebene 8 die Decke über das ganze Haus: im Studierzimmer Fichtenbretter mit zwei Balken aus Schwarzeichenstamm, darüber Stein über den Technik-Ebenen und Steinziegel über der Kammer. Über der Geheimtür, an der Stelle der oberen Fackel, am Block für die Fackel und an zwei Glasleiter-Feldern bleibt die Decke zunächst offen.');
  const open = new Set([key(0, CEIL, 0), key(0, CEIL, -1), key(0, CEIL, -2), key(4, CEIL, -2), key(5, CEIL, -2)]);
  for (let x = -5; x <= 5; x++) {
    for (let z = ZN + 1; z <= ZS - 1; z++) {
      if (open.has(key(x, CEIL, z))) continue;
      let state;
      if (z >= 1) state = z === 3 || z === 6 ? `${dark.log}[axis=x]` : spruce.planks;
      else if (z >= -3) state = z === 0 ? dark.planks : FILL;
      else state = 'stone_bricks';
      b.set(x, CEIL, z, state);
    }
  }

  b.step('Oberer Kolben und Fackel', 'Über der Geheimtür kommt ein Steinblock zwei Felder nördlich in die Decke, an seine Südseite die Redstone-Fackel F2, und direkt über die Tür der klebrige Kolben mit dem Kopf nach unten. Die Fackel brennt, der Kolben fährt aus und hält das obere Regal fest.');
  b.set(0, CEIL, -2, FILL);
  b.set(0, CEIL, -1, 'redstone_wall_torch[facing=south,lit=true]');
  b.set(0, CEIL, 0, 'sticky_piston[extended=true,facing=down]');
  b.set(0, 3, 0, 'piston_head[facing=down,short=false,type=sticky]');
  b.note(0, CEIL, -1, 'Fackel F2 treibt den oberen Kolben an');

  b.step('Leitung auf dem Dachboden', 'Die Glasleiter steigt weiter: Staub auf das Glas, daneben ein Glasblock und darauf Staub auf Ebene 9. Von dort läuft die Leitung über der Kammerwand nach Westen bis über den Gang und biegt nach Süden auf den Block der Fackel F2. Liegt der Staub auf diesem Block, geht die Fackel aus.');
  b.set(4, CEIL, -2, DUST);
  b.set(5, CEIL, -2, 'glass');
  b.set(5, CEIL + 1, -2, DUST);
  for (let x = 5; x >= 0; x--) b.set(x, CEIL + 1, -3, DUST);
  b.set(0, CEIL + 1, -2, DUST);
  b.note(0, CEIL + 1, -2, 'Staub auf dem Block der Fackel F2: Strom hier = obere Fackel aus');
}

function roof(b) {
  b.phase('Dach', 'Ein Satteldach aus Schwarzeichentreppen mit 1 Block Überstand; der First läuft von Norden nach Süden. Die Giebel füllst du mit Fichtenbrettern, über dem Studierzimmer kommen zwei Gauben dazu.', {
    tips: ['Setz die unterste Treppenreihe (Ebene 8) einen Block vor den Wänden und arbeite dich Reihe für Reihe nach oben. Schau beim Setzen zum First.'],
  });
  b.step('Dachflächen', 'Die Dachflächen aus Schwarzeichentreppen, die Giebel aus Fichtenbrettern.');
  b.roof({ x1: -HX, z1: ZN, x2: HX, z2: ZS, y: CEIL, type: 'gable', axis: 'z', stairs: dark.stairs, slab: dark.slab, full: spruce.planks, overhang: 1 });
  b.step('Gauben', `Über dem Studierzimmer sitzt auf jeder Dachseite eine Gaube, 3 breit, mitten über dem Seitenfenster. Ihre Vorderwand steht auf der Wandkrone (Ebene ${CEIL + 5}): Fichtenstämme an den Ecken, dazwischen ein Glasscheiben-Fenster, 2 hoch. Darüber ein kleines Satteldach aus Schwarzeichentreppen, das quer ins Hauptdach läuft.`);
  for (const [x, facing, uphill] of [[HX, 'east', 'west'], [-HX, 'west', 'east']]) {
    dormer(b, { x, y: CEIL + 1, z: 4, facing, wall: spruce.planks, corner: spruce.log, stairs: dark.stairs, slab: dark.slab });
    // Das hintere Ende des Gaubenfirsts liegt in der Hauptdachfläche: Treppe statt Stufe, sonst bleibt dort ein Spalt offen.
    const back = x - Math.sign(x) * 3;
    b.set(back, CEIL + 4, 4, `${dark.stairs}[facing=${uphill},half=bottom]`);
  }

  b.step('Licht auf dem Dachboden', 'Häng unter den First drei Laternen an Ketten. Durch die Gauben ist der Dachboden ein Raum wie jeder andere – ohne Licht würden dort Monster erscheinen.');
  for (const z of [-6, 0, 5]) hangingLantern(b, { x: 0, y: CEIL + 6, z, chain: 2 });
  // Nur Felder unter dem Dach zählen (Dachreihe bei |x| liegt auf y = CEIL + 7 − |x|) und das Innere der Gauben.
  const underRoof = ([x, y, z]) => y < CEIL + 7 - Math.abs(x) || (Math.abs(x) >= 3 && Math.abs(x) <= 5 && z === 4 && y <= CEIL + 3);
  const darkAttic = findDarkSpots(b, { x1: -5, y1: CEIL + 1, z1: ZN + 1, x2: 5, y2: CEIL + 6, z2: ZS - 1 }).filter(underRoof);
  if (darkAttic.length > 0) throw new Error(`geheimtuer-buecherregal: dunkle Stellen auf dem Dachboden: ${JSON.stringify(darkAttic.slice(0, 5))}`);
}

function openings(b) {
  b.phase('Fenster und Haustür', 'Das Studierzimmer bekommt vier Fenster mit Läden und Blumenkästen und eine Haustür mit Vordach, der Südgiebel ein Rundfenster. Die Kammer bleibt fensterlos – sie ist ja geheim.');
  doorway(b, { x: 0, y: 1, z: ZS, facing: 'south', door: spruce.door, frame: null, canopy: dark.stairs });
  for (const x of [-3, 3]) window(b, { x, y: 2, z: ZS, facing: 'south', shutters: spruce.trapdoor, flowerBox: true });
  window(b, { x: -HX, y: 2, z: 4, facing: 'west', shutters: spruce.trapdoor, flowerBox: true });
  window(b, { x: HX, y: 2, z: 4, facing: 'east', shutters: spruce.trapdoor, flowerBox: true });
  window(b, { x: 0, y: 6, z: ZS, facing: 'south', style: 'round', width: 3, stairs: dark.stairs });
}

function interior(b) {
  b.phase('Einrichtung und Licht', 'Im Studierzimmer: ein Lesepult, ein Kartentisch, zwei Sessel und ein Teppich. In der Geheimkammer: ein Zaubertisch mit 15 Bücherregalen, Truhen und ein Braustand. Laternen halten in beiden Räumen und im Gang Monster fern.', {
    tips: ['Ist die Geheimtür nach dem Bauen offen statt zu, drück einmal den Knopf in der Kammer – dann passt die Birne wieder.'],
  });
  b.step('Studierzimmer', 'Lesepult und Kartentisch an der Westwand, zwei Fichtensessel mit einem Fass als Beistelltisch an der Ostwand, ein roter Teppich (3 × 3) in der Mitte.');
  b.set(-5, 1, 3, 'lectern[facing=east,has_book=true,powered=false]');
  b.set(-5, 1, 5, 'cartography_table');
  b.set(-5, 2, 5, 'potted_fern');
  b.set(5, 1, 3, `${spruce.stairs}[facing=east,half=bottom]`);
  b.set(5, 1, 5, `${spruce.stairs}[facing=east,half=bottom]`);
  b.set(5, 1, 4, 'barrel[facing=up,open=false]');
  b.set(5, 2, 4, 'candle[candles=3,lit=true]');
  b.fill(-1, 1, 3, 1, 1, 5, 'red_carpet');

  b.step('Geheimkammer', 'Der Zaubertisch steht mitten in der Kammer, umgeben von 15 Bücherregalen (Stufe 30). An der Westwand eine Doppeltruhe, an der Ostwand Braustand, Wasserkessel und ein Fass. Und an den gemeißelten Steinziegel neben dem Gang kommt der Steinknopf.');
  enchantingSetup(b, { x: 0, y: 1, z: -7, facing: 'south' });
  b.set(-5, 1, -5, 'chest[facing=east]');
  b.set(-5, 1, -6, 'chest[facing=east]');
  b.set(5, 1, -5, 'brewing_stand');
  b.set(5, 1, -6, 'water_cauldron[level=3]');
  b.set(5, 1, -8, 'barrel[facing=up,open=false]');
  b.set(2, 2, -4, 'stone_button[face=wall,facing=north,powered=false]');
  b.note(2, 2, -4, 'Knopf in der Kammer: Tür auf/zu');

  b.step('Licht', 'Häng in jeden Raum zwei Laternen an die Decke (je 3 Felder links und rechts der Mitte) und ergänze weitere, bis jedes Bodenfeld beleuchtet ist – auch der Gang, der sein Licht aus der Kammer bekommt.');
  for (const [x, z] of [[-3, 4], [3, 4], [-3, -6], [3, -6]]) hangingLantern(b, { x, y: 3, z, chain: 0 });
  lightRoom(b, { x1: -5, y1: 1, z1: 1, x2: 5, y2: 3, z2: 7 }, { mode: 'ceiling' });
  lightRoom(b, { x1: -5, y1: 1, z1: -9, x2: 5, y2: 3, z2: -4 }, { mode: 'ceiling' });
  // Der Gang bekommt sein Licht aus der Kammer; findDarkSpots rechnet nur mit Lichtquellen in der Box.
  const dark0 = findDarkSpots(b, { x1: -5, y1: 1, z1: -9, x2: 5, y2: 3, z2: -1 }).filter(([x, , z]) => x === 0 && z >= -3);
  if (dark0.length > 0) throw new Error(`geheimtuer-buecherregal: dunkle Stellen im Gang: ${JSON.stringify(dark0)}`);
}

function surroundings(b) {
  b.phase('Garten', 'Zum Schluss ein Weg zur Haustür, Blumenbeete vor dem Haus, eine Birke und ein paar Büsche.');
  path(b, { x: 0, y: 0, z: ZS + 1, facing: 'south', length: 5, width: 3, mix: 'erde', wiggle: 0.6, seed: 21 });
  flowerBed(b, { x: -6, y: 0, z: ZS + 2, width: 5, depth: 2, facing: 'south', palette: 'bunt', seed: 22 });
  flowerBed(b, { x: 2, y: 0, z: ZS + 2, width: 5, depth: 2, facing: 'south', palette: 'bunt', seed: 23 });
  tree(b, { x: -9, y: 1, z: 10, species: 'birke', size: 'mittel', seed: 24 });
  tree(b, { x: 9, y: 1, z: -12, species: 'eiche', size: 'klein', seed: 25 });
  bush(b, { x: 9, y: 1, z: 6, size: 'klein', leaves: 'eiche', seed: 26 });
  bush(b, { x: -9, y: 1, z: -6, size: 'klein', leaves: 'azalee', seed: 27 });
  vegetation(b, { x: GROUND.x, y: 0, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.25, seed: 28 });
}

export default function build(b) {
  site(b);
  techLayer(b);
  walls(b);
  ceiling(b);
  roof(b);
  openings(b);
  interior(b);
  surroundings(b);
}
