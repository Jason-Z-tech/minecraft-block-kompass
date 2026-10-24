// Kombinationsschloss: Schatzkammer aus Tiefenschiefer mit Eisentür. Fünf Hebel an der Fassade – nur wenn genau die
// richtigen oben sind, geht die Tür auf. Die Kombination steckt in den Bauteilen hinter den Hebeln und lässt sich ändern.
// Bau-Rahmen: Gebäude x −10 … 10, z −10 … 0, Fassade z = 0 (Süden), Boden y = 0, Mauern y 1 … 5, Flachdach y = 6.
//   Vordere Mauer 4 dick: Fassade z = 0, Technik z −1 und −2, Innenseite z −3. Tür bei (0, 1, 0), Hebel bei x −8 … −4.
//
// Signalweg (Kombination ab Werk: Hebel 1 an, 2 aus, 3 an, 4 an, 5 aus; Hebel 1 = links = x −8):
//   Jeder Hebel (x, 2, 1) versorgt seinen Fassadenblock (x, 2, 0) stark; die Lampe darüber (x, 3, 0) zeigt das an.
//   Hinter dem Block (x, 2, −1) sitzt je nach Soll-Stellung:
//     – „soll an“: Redstone-Fackel an der Blockrückseite (Inverter). Hebel an → Fackel aus → kein Signal.
//     – „soll aus“: Repeater, Rückseite am Block, Pfeil nach Norden. Hebel aus → kein Signal.
//   Alle fünf geben in die Sammelleitung (x, 2, −2), x −8 … −3 (ODER): falsch gestellter Hebel → Leitung an.
//   Staubtreppe hinab (in Java leitet Staub nur abwärts, wenn der Block unter der höheren Stufe ein Leiter ist und über der
//   tieferen Stufe kein Leiter liegt): (−3, 2, −2) → (−3, 1, −1) → (−3, 0, 0) → (−2, −1, 0); über den Stufen Luft bzw.
//   getöntes Glas (−3, 1, 0) und (−2, 0, 0). Der letzte Staub zeigt in den Block K (−1, −1, 0) → Fackel T (−1, 0, 0) obendrauf
//   (Inverter) versorgt den Block über sich (−1, 1, 0, Türrahmen) stark → Eisentür (0, 1, 0) daneben öffnet.
//   Sammelleitung aus (alles richtig) → T an → Tür auf.
//   Insgesamt ein UND-Gatter: Tür auf ⇔ jeder Hebel steht richtig. Von innen öffnet eine Druckplatte (0, 1, −1).
//   Gezeigt wird der gebaute Zustand: alle Hebel unten → Fackeln der „soll an“-Hebel brennen → Sammelleitung an → Tür zu.

import { lampPost, storage, lightRoom, findDarkSpots, floorPattern, arrowSlit, wallLantern, terrain, path, bush, flowerBed, vegetation, rock } from '../lib/index.js';

export const meta = {
  id: 'kombinationsschloss',
  title: 'Kombinationsschloss mit Hebeln',
  category: 'redstone',
  subtitle: 'Schatzkammer mit fünf Hebeln: nur die richtige Kombination öffnet die Eisentür',
  tags: ['Redstone', 'Schloss', 'Kombinationsschloss', 'Hebel', 'Eisentür', 'Logik', 'UND-Gatter', 'Inverter', 'Redstone-Fackel', 'Tresor', 'Schatzkammer'],
  aliases: [
    'kombinationsschloss', 'kombinations schloss', 'zahlenschloss', 'hebelschloss', 'hebel schloss', 'passwort tür', 'passwortschloss',
    'code schloss', 'codeschloss', 'combination lock', 'lever lock', 'redstone lock', 'password door', 'tresor', 'tresortür',
    'schatzkammer', 'kombinationschloss', 'kombinatonsschloss', 'geheimcode tür',
  ],
  accuracy: 'eigenes',
  difficulty: 4,
  description: 'Eine Schatzkammer aus Tiefenschiefer, deren Eisentür nur aufgeht, wenn an der Fassade genau die richtigen von fünf Hebeln oben sind. Hinter jedem Hebel steckt entweder eine Redstone-Fackel (dieser Hebel muss an sein) oder ein Repeater (dieser muss aus sein); zusammen bilden sie ein UND-Gatter. Lampen über den Hebeln zeigen, welche gerade an sind. Die Kombination änderst du, indem du Fackel und Repeater tauschst. Von innen öffnet eine Druckplatte die Tür.',
  facts: [
    'Mit 5 Hebeln gibt es 2⁵ = 32 Stellungen, nur eine davon öffnet.',
    'Ab Werk öffnet die Kombination Hebel 1 an, 2 aus, 3 an, 4 an, 5 aus (von links gezählt).',
    'So funktioniert das Gatter: Jeder falsch gestellte Hebel schickt ein Signal in die Sammelleitung (ODER). Die Fackel unter der Tür kehrt das um (NICHT). NICHT-ODER der Fehler ist dasselbe wie UND aller richtigen Hebel.',
    'Ein Repeater nimmt das Signal nur von hinten auf und gibt es nur nach vorne weiter. Er sorgt dafür, dass kein Signal aus der Sammelleitung zurück zu den Hebeln läuft.',
    'Die Lampen über den Hebeln hängen direkt am Hebelblock: Sie verraten nur die Stellung, nicht ob sie richtig ist.',
    'Nicht im Spiel getestet: das Prinzip folgt dem Hebelschloss aus dem Minecraft Wiki (Fackeln hinter den „an“-Hebeln, Repeater hinter den „aus“-Hebeln).',
  ],
  sources: [
    { title: 'Minecraft Wiki: Tutorial – Combination locks', url: 'https://minecraft.wiki/w/Tutorial:Combination_locks' },
    { title: 'Minecraft Wiki: Redstone Torch', url: 'https://minecraft.wiki/w/Redstone_Torch' },
    { title: 'Minecraft Wiki: Redstone Repeater', url: 'https://minecraft.wiki/w/Redstone_Repeater' },
    { title: 'Minecraft Wiki: Iron Door', url: 'https://minecraft.wiki/w/Iron_Door' },
    { title: 'Minecraft Wiki: Logic circuit', url: 'https://minecraft.wiki/w/Logic_circuit' },
  ],
  credits: null,
  tested: false,
};

// Kombination: true = Hebel muss an sein (Fackel), false = muss aus sein (Repeater). Hebel 1 links bei x −8.
const COMBINATION = [true, false, true, true, false];
const LEVER_X = [-8, -7, -6, -5, -4];
const X1 = -10;
const X2 = 10;
const ZB = -10;
const TOP = 5;
const DUST = 'redstone_wire';
const FILL = 'cobbled_deepslate';
const GROUND = { x: -15, z: -15, width: 31, depth: 26 };
// Unterste Ebene des fertigen Baus (Gelände ab y −3) → Ebenen-Nummer der Anleitung.
const lv = (y) => y + 4;

// Sammelleitung im gebauten Zustand: Fackeln der „soll an“-Hebel brennen und speisen sie (Stärke = 15 − Abstand).
function busPower(x) {
  let best = 0;
  LEVER_X.forEach((lx, i) => {
    if (COMBINATION[i]) best = Math.max(best, 15 - Math.abs(lx - x));
  });
  return best;
}
const wire = (power) => `${DUST}[power=${power}]`;

function brick(b) {
  return b.pickWeighted([['deepslate_bricks', 10], ['cracked_deepslate_bricks', 1]]);
}

function site(b) {
  b.phase('Bauplatz und Fundament', 'Such dir eine ebene Wiese. Die Schatzkammer ist 21 × 11 Blöcke groß. Die vordere Mauer wird 4 Blöcke dick – in ihr steckt die ganze Schaltung.', {
    tips: ['Setz die vier Ecken des Fundaments und zähl dann ab. Die Tür liegt genau in der Mitte der Südseite, die Hebel kommen links davon.'],
  });
  b.step('Wiese', 'Die Wiese rund um die Schatzkammer.');
  terrain(b, { x: GROUND.x, y: -3, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 3, seed: 'kombischloss' });
  b.step('Fundament', `Ersetze die Grasschicht unter dem ganzen Gebäude (Ebene ${lv(0)}) durch Fundament: unter den Mauern Bruchtiefenschiefer, im Gang hinter der Tür und in der Kammer ein Boden aus poliertem Tiefenschiefer und Tiefenschieferfliesen. In der Fassadenreihe bleiben die drei Felder direkt links neben dem Türgang frei – dort kommen gleich die Fackel, ein Glas und ein Staub hinein.`);
  for (let x = X1; x <= X2; x++) {
    for (let z = ZB; z <= 0; z++) {
      if (z === 0 && x >= -3 && x <= -1) continue;
      const wallCell = x === X1 || x === X2 || z === ZB || z >= -3;
      const passage = x === 0 && z >= -3;
      b.set(x, 0, z, wallCell && !passage ? FILL : 'polished_deepslate');
    }
  }
  floorPattern(b, { x: -9, y: 0, z: -9, facing: 'south', width: 19, depth: 6, pattern: 'checker', blocks: ['polished_deepslate', 'deepslate_tiles'] });
}

function underground(b) {
  b.phase('Ausgang der Schaltung unter der Tür', 'Zuerst baust du das Ende der Schaltung: die Fackel, die die Tür steuert, und die letzte Stufe der Staubtreppe. Beides liegt in der Fassadenreihe direkt links neben dem Türgang, halb im Boden.', {
    tips: [
      'Getöntes Glas sieht aus wie ein dunkler Stein, leitet aber kein Redstone. Über einer tieferen Staubstufe darf nie ein leitender Block liegen, sonst reißt die Verbindung ab.',
      'Die Fackel brennt gleich nach dem Setzen. Erst wenn die Sammelleitung angeschlossen ist und ein Hebel falsch steht, geht sie aus.',
    ],
  });
  b.step('Block K und Fackel T', `Grab direkt links neben dem Türgang (in der Fassadenreihe) ein Loch bis Ebene ${lv(-1)} und setz dort einen Steinblock (K). Auf K kommt eine Redstone-Fackel (T) – sie steht in der Fundament-Ebene ${lv(0)}, genau unter dem späteren linken Türpfosten.`);
  b.set(-1, -1, 0, 'stone');
  b.set(-1, 0, 0, 'redstone_torch[lit=false]');
  b.note(-1, 0, 0, 'Fackel T: brennt nur, wenn alle Hebel richtig stehen – dann versorgt sie den Türpfosten darüber und die Tür geht auf');
  b.step('Letzte Staubstufen', `Westlich neben K kommt auf Ebene ${lv(-1)} ein Redstone-Staub (auf einen Steinblock darunter), darüber ein getöntes Glas in die Fundament-Ebene. Noch ein Feld weiter westlich liegt Staub in der Fundament-Ebene ${lv(0)} auf einem Steinblock – das ist die vorletzte Stufe. Der unterste Staub zeigt in K: bekommt er Strom, geht T aus.`);
  b.set(-2, -2, 0, 'stone');
  b.set(-2, -1, 0, wire(busPower(-3) - 3));
  b.set(-2, 0, 0, 'tinted_glass');
  b.set(-3, -1, 0, 'stone');
  b.set(-3, 0, 0, wire(busPower(-3) - 2));
  b.note(-2, -1, 0, 'Unterste Staubstufe: zeigt in den Block K unter der Fackel');
}

function frontWall(b) {
  b.phase('Vordere Mauer mit Schaltung', 'Die vordere Mauer ist 4 Blöcke dick: Fassade, zwei Technik-Reihen und die Innenseite. Du baust sie Schicht für Schicht und setzt dabei die Schaltung ein: hinter jedem Hebelblock je nach Kombination eine Fackel oder einen Repeater, dahinter die Sammelleitung, und links neben dem Türgang die Staubtreppe hinunter zur Fackel T.', {
    tips: [
      'Hebel 1 ist der linke (westlichste), Hebel 5 der rechte. Ab Werk: Fackel hinter Hebel 1, 3 und 4, Repeater hinter Hebel 2 und 5.',
      'Kombination ändern: Soll ein Hebel an sein, kommt eine Fackel an die Rückseite seines Blocks. Soll er aus sein, ein Repeater mit der Rückseite am Block und dem Pfeil nach Norden. Mehr ist nicht zu tun.',
      'Abwärts leitet eine Staubtreppe nur über volle Steinstufen. Glas als Stufe würde das Signal nach unten nicht weitergeben – nur nach oben.',
    ],
  });
  b.step('Staubtreppe', `Drei Felder links vom Türgang steigt die Treppe aus der Fundament-Ebene nach Norden hinauf: in der ersten Technik-Reihe ein Steinblock in der Fundament-Ebene ${lv(0)} und darauf Staub (Ebene ${lv(1)}), in der Fassade direkt davor ein getöntes Glas über dem Staub der Fundament-Ebene. In der zweiten Technik-Reihe kommt ein Steinblock auf Ebene ${lv(1)} und darauf Staub auf Ebene ${lv(2)} – er ist das östliche Ende der Sammelleitung. Über dem Staub der ersten Technik-Reihe bleibt Luft.`);
  b.set(-3, 1, 0, 'tinted_glass');
  b.set(-3, 1, -1, wire(busPower(-3) - 1));
  b.set(-3, 1, -2, FILL);
  b.set(-3, 2, -2, wire(busPower(-3)));
  b.note(-3, 2, -1, 'Luft lassen: über einer tieferen Staubstufe darf kein Block liegen');

  b.step('Hebelblöcke und Bauteile', `Auf Ebene ${lv(2)} kommen in die Fassade fünf Blöcke aus poliertem Schwarzstein (die Hebelblöcke, links vom Pfeiler). Direkt dahinter (erste Technik-Reihe) setzt du je nach Kombination eine Redstone-Fackel an die Blockrückseite oder einen Repeater auf einen Stein, Rückseite zum Hebelblock. Darüber, auf Ebene ${lv(3)}, kommt in diese Reihe überall Glas – sonst würden die brennenden Fackeln den Block über sich versorgen und damit die Lampen über den Hebeln einschalten.`);
  LEVER_X.forEach((x, i) => {
    b.set(x, 2, 0, 'polished_blackstone');
    b.set(x, 1, -1, FILL);
    if (COMBINATION[i]) b.set(x, 2, -1, 'redstone_wall_torch[facing=north,lit=true]');
    else b.set(x, 2, -1, 'repeater[delay=1,facing=south,locked=false,powered=false]');
    b.set(x, 3, -1, 'glass');
    b.note(x, 2, -1, COMBINATION[i] ? `Hebel ${i + 1} muss AN sein: Fackel (Inverter)` : `Hebel ${i + 1} muss AUS sein: Repeater`);
  });

  b.step('Sammelleitung', `In der zweiten Technik-Reihe liegt auf Ebene ${lv(2)} eine Reihe Redstone-Staub auf Steinblöcken, von hinter Hebel 1 bis zum oberen Ende der Staubtreppe (6 Felder). Sie sammelt die Signale aller fünf Hebel.`);
  for (const x of LEVER_X) {
    b.set(x, 1, -2, FILL);
    b.set(x, 2, -2, wire(busPower(x)));
  }
  b.note(-6, 2, -2, 'Sammelleitung: an, sobald ein Hebel falsch steht');

  b.step('Mauer hochziehen', `Mauere die vordere Mauer bis Ebene ${lv(TOP)} hoch: Fassade aus Tiefenschieferziegeln mit einem Sockel aus poliertem Tiefenschiefer, die Technik-Reihen mit Bruchtiefenschiefer, die Innenseite wieder aus Ziegeln. Frei bleiben: der Gang in der Mitte (1 breit, 2 hoch, alle 4 Reihen) und die Zelle über dem Staub der ersten Technik-Reihe.`);
  const keep = new Set(['-3,2,-1']);
  for (let x = X1; x <= X2; x++) {
    for (let z = -3; z <= 0; z++) {
      for (let y = 1; y <= TOP; y++) {
        if (x === 0 && y <= 2) continue;
        if (keep.has(`${x},${y},${z}`)) continue;
        if (b.get(x, y, z) !== 'air') continue;
        let state;
        if (z === 0) state = y === 1 ? 'polished_deepslate' : brick(b);
        else if (z === -3) state = brick(b);
        else state = FILL;
        b.set(x, y, z, state);
      }
    }
  }
}

function vault(b) {
  b.phase('Kammer und Dach', 'Die übrigen drei Mauern der Schatzkammer sind 1 Block dick und ebenfalls 5 hoch. Darauf liegt ein Flachdach aus Tiefenschieferfliesen mit einer Brüstung.', {
    tips: ['Setz die Mauern Reihe für Reihe. Die Ecken bekommen Tiefenschieferfliesen als Eckpfeiler.'],
  });
  b.step('Mauern', 'Seiten- und Rückmauer: Tiefenschieferziegel, Ecken aus Tiefenschieferfliesen, unten ein Sockel aus poliertem Tiefenschiefer.');
  for (let y = 1; y <= TOP; y++) {
    for (let x = X1; x <= X2; x++) {
      for (let z = ZB; z <= -4; z++) {
        if (x !== X1 && x !== X2 && z !== ZB) continue;
        const corner = (x === X1 || x === X2) && z === ZB;
        b.set(x, y, z, corner ? 'deepslate_tiles' : y === 1 ? 'polished_deepslate' : brick(b));
      }
    }
  }
  b.step('Flachdach', `Leg auf Ebene ${lv(TOP + 1)} das Dach aus Tiefenschieferfliesen über das ganze Gebäude und setz auf den Rand eine Brüstung aus Tiefenschieferziegelmauer.`);
  b.fill(X1, TOP + 1, ZB, X2, TOP + 1, 0, 'deepslate_tiles');
  for (let x = X1; x <= X2; x++) {
    for (let z = ZB; z <= 0; z++) {
      if (x === X1 || x === X2 || z === ZB || z === 0) b.set(x, TOP + 2, z, 'deepslate_brick_wall');
    }
  }
  b.step('Wandpfeiler und Gesims', `Gib den glatten Mauern Tiefe: An jede Seitenwand kommen zwei Wandpfeiler aus Tiefenschieferfliesen (4 und 8 Felder hinter der Fassade), an die Rückwand drei (in der Mitte und je 5 Felder daneben), jeweils mit einem Fuß aus poliertem Tiefenschiefer auf Bodenhöhe. Rund um das Dach läuft auf Ebene ${lv(TOP + 1)} ein Gesims aus umgedrehten Tiefenschieferziegeltreppen, die hohe Seite zur Wand.`);
  const pilasters = [
    ...[-3, -7].flatMap((z) => [[X1 - 1, z], [X2 + 1, z]]),
    ...[-5, 0, 5].map((x) => [x, ZB - 1]),
  ];
  for (const [x, z] of pilasters) {
    b.set(x, 0, z, 'polished_deepslate');
    for (let y = 1; y <= TOP; y++) b.set(x, y, z, 'deepslate_tiles');
  }
  for (let x = X1 - 1; x <= X2 + 1; x++) {
    for (let z = ZB - 1; z <= 1; z++) {
      let facing = null;
      if (z === 1) facing = 'north';
      else if (z === ZB - 1) facing = 'south';
      else if (x === X1 - 1) facing = 'east';
      else if (x === X2 + 1) facing = 'west';
      if (facing) b.set(x, TOP + 1, z, `deepslate_brick_stairs[facing=${facing},half=top]`);
    }
  }
}

function facade(b) {
  b.phase('Fassade, Tür und Hebel', 'Jetzt bekommt die Schatzkammer ihr Gesicht: Pfeiler, Türrahmen, die Eisentür, die fünf Hebel mit Lampen, zwei vergitterte Lichtschlitze und ein Vordach.', {
    tips: [
      'Setz die Eisentür von außen mit Blick nach Norden. Sie lässt sich nicht mit der Hand öffnen – nur über das Schloss oder von innen über die Druckplatte.',
      'Teste das Schloss: alle Hebel unten → Tür zu. Hebel 1, 3 und 4 hoch → Tür auf. Ein Hebel mehr oder weniger → Tür wieder zu.',
    ],
  });
  b.step('Pfeiler und Türrahmen', 'Vor die Fassade kommen vier Pfeiler aus Tiefenschieferfliesen (an den Ecken und je 3 Felder neben der Tür), oben mit gemeißeltem Tiefenschiefer. Um die Tür ein Rahmen aus poliertem Tiefenschiefer, darüber ein gemeißelter Tiefenschiefer als Schlussstein.');
  for (const x of [X1, -3, 3, X2]) {
    for (let y = 1; y <= TOP; y++) b.set(x, y, 1, y === TOP ? 'chiseled_deepslate' : 'deepslate_tiles');
    b.set(x, 0, 1, 'polished_deepslate');
  }
  for (const x of [-1, 1]) for (let y = 1; y <= 2; y++) b.set(x, y, 0, 'polished_deepslate');
  b.set(-1, 3, 0, 'polished_deepslate');
  b.set(1, 3, 0, 'polished_deepslate');
  b.set(0, 3, 0, 'chiseled_deepslate');

  b.step('Eisentür und Druckplatte', `Setz die Eisentür in die Fassade (Ebene ${lv(1)} und ${lv(2)}) und innen direkt hinter die Tür eine Steindruckplatte – damit kommst du wieder heraus.`);
  b.door(0, 1, 0, 'iron_door', { facing: 'north', hinge: 'left' });
  b.set(0, 1, -1, 'stone_pressure_plate[powered=false]');
  b.note(0, 1, -1, 'Druckplatte innen: öffnet die Tür zum Hinausgehen');

  b.step('Hebel und Lampen', `Über die fünf Hebelblöcke kommt auf Ebene ${lv(3)} je eine Redstone-Lampe, und an jeden Hebelblock außen ein Hebel. Alle Hebel stehen nach dem Bauen unten.`);
  LEVER_X.forEach((x, i) => {
    b.set(x, 3, 0, 'redstone_lamp[lit=false]');
    b.set(x, 2, 1, 'lever[face=wall,facing=south,powered=false]');
    b.note(x, 2, 1, `Hebel ${i + 1}`);
  });

  b.step('Lichtschlitze und Laternen', 'Rechts der Tür lassen zwei Schlitze (2 hoch, durch die ganze Mauer) Licht in die Kammer, gefüllt mit Eisengittern. Neben der Tür hängen zwei Laternen an Armen aus Tiefenschieferziegelmauer.');
  for (const x of [6, 8]) arrowSlit(b, { x, y: 2, z: 0, facing: 'south', height: 2, depth: 4, fill: 'iron_bars' });
  for (const x of [-2, 2]) wallLantern(b, { x, y: 3, z: 0, facing: 'south', style: 'bracket', arm: 'deepslate_brick_wall' });

  b.step('Vordach', `Über der Tür kommt ein kleines Vordach: auf Ebene ${lv(4)} drei Tiefenschieferziegeltreppen vor der Fassade, die hohe Seite zur Wand, und darunter links und rechts je eine umgedrehte Treppe als Konsole.`);
  for (let x = -1; x <= 1; x++) b.set(x, 4, 1, 'deepslate_brick_stairs[facing=north,half=bottom]');
  for (const x of [-1, 1]) b.set(x, 3, 1, 'deepslate_brick_stairs[facing=north,half=top]');
}

function treasure(b) {
  b.phase('Schatz und Licht', 'Drinnen: Truhen und Fässer an der Rückwand, ein Goldschatz in der Ecke, ein Amboss und Laternen an Ketten von der Decke.');
  b.step('Einrichtung', 'Stell an die Rückwand eine 9 breite Lagerwand aus Doppeltruhen und Fässern, zwei hoch. In die Westecke kommen Gold- und Rohgoldblöcke, in die Ostecke ein Amboss und ein Fass mit einem Smaragdblock daneben.');
  storage(b, { x: -4, y: 1, z: -9, facing: 'south', width: 9, height: 2 });
  for (const [x, y, z, s] of [
    [-9, 1, -9, 'gold_block'], [-8, 1, -9, 'gold_block'], [-9, 1, -8, 'raw_gold_block'], [-9, 2, -9, 'gold_block'],
    [-8, 1, -8, 'gold_block'], [-7, 1, -9, 'raw_gold_block'],
    [9, 1, -9, 'emerald_block'], [8, 1, -9, 'barrel[facing=up,open=false]'], [9, 1, -7, 'anvil[facing=west]'],
  ]) b.set(x, y, z, s);
  b.step('Licht', 'Häng Laternen an Ketten von der Decke, bis jedes Bodenfeld hell ist – auch der Gang hinter der Tür.');
  lightRoom(b, { x1: -9, y1: 1, z1: -9, x2: 9, y2: TOP, z2: -4 }, { mode: 'ceiling' });
  const dark = findDarkSpots(b, { x1: -9, y1: 1, z1: -9, x2: 9, y2: TOP, z2: -1 }).filter(([x, , z]) => x === 0 && z >= -3);
  if (dark.length > 0) throw new Error(`kombinationsschloss: dunkle Stellen im Gang: ${JSON.stringify(dark)}`);
}

function surroundings(b) {
  b.phase('Vorplatz', 'Ein Kiesweg führt zur Tür, gesäumt von zwei Laternenpfählen. Dazu Büsche, ein Felsen und Gras.');
  path(b, { x: 0, y: 0, z: 2, facing: 'south', length: 9, width: 3, mix: 'kies', wiggle: 0.8, seed: 31 });
  lampPost(b, { x: -3, y: 1, z: 5, facing: 'east', height: 3, post: 'deepslate_brick_wall', base: 'polished_deepslate', style: 'top' });
  lampPost(b, { x: 3, y: 1, z: 5, facing: 'west', height: 3, post: 'deepslate_brick_wall', base: 'polished_deepslate', style: 'top' });
  flowerBed(b, { x: 5, y: 0, z: 2, width: 5, depth: 2, facing: 'south', palette: 'weiss', seed: 32 });
  bush(b, { x: -12, y: 1, z: 3, size: 'klein', leaves: 'eiche', seed: 33 });
  bush(b, { x: 12, y: 1, z: -12, size: 'klein', leaves: 'azalee', seed: 34 });
  rock(b, { x: -11, y: 1, z: -13, size: 'klein', material: 'stein', seed: 35 });
  vegetation(b, { x: GROUND.x, y: 0, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.25, seed: 36 });
}

export default function build(b) {
  site(b);
  underground(b);
  frontWall(b);
  vault(b);
  facade(b);
  treasure(b);
  surroundings(b);
}
