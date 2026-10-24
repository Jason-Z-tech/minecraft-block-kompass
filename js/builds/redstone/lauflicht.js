// Lauflicht: Tanzpavillon auf einem 15 × 15 großen Podest. Im Podest liegt ein Ring aus 23 Repeatern und einem Komparator;
// zwischen ihnen sitzen 24 Blöcke, und an jedem hängen zwei Redstone-Lampen (eine im Rand des Podests, eine im Boden).
// Ein Lichtpunkt läuft im Uhrzeigersinn herum. Start: Knopf am Pult vor der Südseite. Stopp: Hebel daneben.
// Bau-Rahmen: Gelände bis y −1, Podest y 0 (Technik-Ebene) und y 1 (Boden), Pavillon darauf. Ring = Quadrat mit Abstand 6
// von der Mitte (y 0), Rand = Abstand 7, Pult bei z 8 … 10.
//
// Signalweg:
//   Ring (y 0): Blöcke B an den Ecken und jedem zweiten Feld, dazwischen Repeater (Verzögerung 2), Laufrichtung von oben
//   im Uhrzeigersinn (Nordseite nach Osten, Ostseite nach Süden, Südseite nach Westen, Westseite nach Norden). Repeater → B
//   stark versorgt → Lampe außen daneben (Abstand 7) und Lampe darüber (y 1) leuchten, der nächste Repeater nimmt das Signal
//   von B auf. Ein Impuls läuft so endlos im Kreis.
//   Start: Knopf (0, 1, 10) am Block (0, 1, 9) → Kupferbirne (0, 0, 9) darunter schaltet um → Komparator C (0, 0, 8) liest sie,
//   Rückseite Süden → Beobachter (0, 0, 7) schaut auf C und gibt bei jedem Umschalten einen Impuls (1 Redstone-Tick) nach
//   Norden in den Ring-Block B0 (0, 0, 6). Jeder Knopfdruck schickt also genau einen Lichtpunkt los. Hinter B0 liegt ein
//   Repeater (−1, 0, 6): Er verlängert den kurzen Beobachter-Impuls (2 Game-Ticks) auf seine Verzögerung. Ein Komparator an
//   dieser Stelle würde ihn verschlucken – er prüft seinen Eingang erst nach 2 Game-Ticks, dann ist der Impuls schon vorbei.
//   Stopp: Komparator (1, 0, 6) im Ring direkt vor B0, Modus Subtrahieren, Rückseite Osten (Block 2, 0, 6). Hebel (1, 1, 8)
//   am Randblock (1, 1, 7) versorgt diesen stark → Staub (1, 0, 7) darunter hat Stärke 15 → Seiteneingang 15 → Ausgang
//   15 − 15 = 0, jeder Lichtpunkt endet hier. Hebel aus → Komparator gibt das Signal unverändert weiter (Rückseite 15, Seite 0).
//   Gezeigt wird ein Moment im Betrieb: Birne an (einmal gedrückt), Repeater (3, 0, 6) an, Block (2, 0, 6) versorgt; die
//   Lampen am Block (4, 0, 6) davor glühen noch nach (Lampen gehen erst 2 Redstone-Ticks nach dem Signal aus).

import { column, hangingLantern, lampPost, terrain, path, flowerBed, bush, tree, vegetation } from '../lib/index.js';

export const meta = {
  id: 'lauflicht',
  title: 'Lauflicht mit Redstone-Lampen',
  category: 'redstone',
  subtitle: 'Tanzpavillon mit einem Lichtpunkt, der im Kreis um das Podest läuft – Start per Knopf, Tempo über die Repeater',
  tags: ['Redstone', 'Lauflicht', 'Redstone-Lampe', 'Repeater', 'Taktgeber', 'Beobachter', 'Kupferbirne', 'Komparator', 'Pavillon', 'Tanzfläche', 'Kirmes', 'Deko'],
  aliases: [
    'lauflicht', 'lauf licht', 'lauflichter', 'lichterkette', 'lichtkette', 'redstone lampen', 'redstone lampe kreis',
    'repeater ring', 'repeater kreis', 'repeater uhr', 'repeater clock', 'chasing lights', 'running lights', 'light chaser',
    'marquee lights', 'lamp chaser', 'tanzpavillon', 'tanzfläche', 'kirmes', 'jahrmarkt', 'lauflich', 'laufliht', 'lauflicht redstone',
  ],
  accuracy: 'eigenes',
  difficulty: 2,
  description: 'Ein Tanzpavillon mit rot-weiß gestreiftem Spitzdach auf einem dunklen Podest. Rund um das Podest sitzen 51 Redstone-Lampen im Rand und im Boden, und auf Knopfdruck jagt ein Lichtpunkt im Kreis um die Tanzfläche. Dahinter steckt ein Ring aus Repeatern im Podest, durch den ein einzelner Impuls endlos läuft; ein Hebel am Pult löscht ihn wieder. Wie schnell das Licht läuft, stellst du an den Repeatern ein.',
  facts: [
    'Der Ring besteht aus 23 Repeatern und einem Komparator, dazwischen 24 Blöcke. Mit Verzögerung 2 braucht der Lichtpunkt für eine Runde 47 Redstone-Ticks, also knapp 5 Sekunden.',
    'Tempo: Rechtsklick auf einen Repeater stellt seine Verzögerung von 1 bis 4 Ticks. Alle auf 1 = gut 2 Sekunden je Runde, alle auf 4 = etwa 9,3 Sekunden.',
    'Jeder Knopfdruck schickt einen weiteren Lichtpunkt los – drück mehrmals mit etwas Abstand, dann jagen sich mehrere Lichter.',
    'Die Kupferbirne am Pult wechselt bei jedem Druck zwischen an und aus. Ein Komparator liest sie, und ein Beobachter meldet jede Änderung des Komparators mit einem ganz kurzen Impuls – so entsteht pro Druck genau ein Lichtpunkt, egal wie lange der Knopf gedrückt bleibt.',
    'Der Stopp-Komparator rechnet im Subtrahier-Modus: Rückseite 15 minus Seite 15 ergibt 0. Solange der Hebel an ist, kommt kein Licht an ihm vorbei.',
    'Nicht im Spiel getestet: Aufbau und Signalweg folgen den Regeln für Repeater, Komparator, Beobachter, Kupferbirne und Redstone-Lampe im Minecraft Wiki.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Redstone Repeater', url: 'https://minecraft.wiki/w/Redstone_Repeater' },
    { title: 'Minecraft Wiki: Redstone Comparator', url: 'https://minecraft.wiki/w/Redstone_Comparator' },
    { title: 'Minecraft Wiki: Observer', url: 'https://minecraft.wiki/w/Observer' },
    { title: 'Minecraft Wiki: Copper Bulb', url: 'https://minecraft.wiki/w/Copper_Bulb' },
    { title: 'Minecraft Wiki: Redstone Lamp', url: 'https://minecraft.wiki/w/Redstone_Lamp' },
    { title: 'Minecraft Wiki: Tutorial – Clock circuits', url: 'https://minecraft.wiki/w/Tutorial:Clock_circuits' },
  ],
  credits: null,
  tested: false,
};

const RING = 6;
const EDGE = 7;
const CORE = 'cobbled_deepslate';
const BAND = 'deepslate_tiles';
const RIM = 'polished_deepslate';
const DELAY = 2;
const STOP = [1, 6];
const INJECT = [0, 6];
const PULSE_REPEATER = [3, 6];
const LIT_BLOCKS = [[2, 6], [4, 6]];
const GROUND = { x: -16, z: -16, width: 33, depth: 33 };
// Unterste Ebene des fertigen Baus (Gelände ab y −3) → Ebenen-Nummer der Anleitung.
const lv = (y) => y + 4;

// Lauf im Uhrzeigersinn: Seite → Richtung, in die das Signal läuft (Repeater-facing = Gegenrichtung, §4).
const SIGNAL_FACING = { north: 'west', east: 'north', south: 'east', west: 'south' };

function ringCells() {
  const cells = [];
  for (let x = -RING; x <= RING; x++) {
    for (let z = -RING; z <= RING; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== RING) continue;
      const corner = Math.abs(x) === RING && Math.abs(z) === RING;
      let side;
      if (corner) side = null;
      else if (z === -RING) side = 'north';
      else if (x === RING) side = 'east';
      else if (z === RING) side = 'south';
      else side = 'west';
      const t = side === 'north' || side === 'south' ? x : z;
      cells.push({ x, z, side, isBlock: corner || t % 2 === 0 });
    }
  }
  return cells;
}

// Außen-Nachbarn eines Ring-Blocks (Abstand 7): eine Lampe je Seite, an den Ecken zwei.
function outerNeighbors(x, z) {
  const out = [];
  if (z === -RING) out.push([x, -EDGE]);
  if (z === RING) out.push([x, EDGE]);
  if (x === -RING) out.push([-EDGE, z]);
  if (x === RING) out.push([EDGE, z]);
  return out;
}

const same = (a, x, z) => a[0] === x && a[1] === z;
const lamp = (on) => `redstone_lamp[lit=${on}]`;

function site(b) {
  b.phase('Bauplatz und Pflaster', 'Such dir eine ebene Wiese, mindestens 25 × 25 Blöcke. Das Podest wird 15 × 15 Blöcke groß, rundherum liegt ein 2 Blöcke breiter Pflasterring.', {
    tips: ['Steck dir die Mitte ab und zähl von dort 7 Felder in jede Richtung: Das ist die Außenkante des Podests. Der Pflasterring reicht 2 Felder weiter.'],
  });
  b.step('Wiese', 'Die Wiese rund um den Pavillon.');
  terrain(b, { x: GROUND.x, y: -3, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 2, seed: 'lauflicht' });
  b.step('Pflasterring', `Ersetze die Grasschicht (Ebene ${lv(-1)}) in einem Ring 8 und 9 Felder von der Mitte entfernt durch Pflaster aus poliertem Andesit, Andesit und Steinziegeln. Vor der Mitte der Südseite kommt ein 5 × 2 großer Standplatz für das Pult dazu. Unter dem späteren Podest bleibt das Gras liegen.`);
  for (let x = -9; x <= 9; x++) {
    for (let z = -9; z <= 11; z++) {
      const standing = z >= 10 && Math.abs(x) <= 2;
      if (!standing && (z > 9 || Math.max(Math.abs(x), Math.abs(z)) < 8)) continue;
      b.set(x, -1, z, b.pickWeighted([['polished_andesite', 5], ['andesite', 3], ['stone_bricks', 2]]));
    }
  }
}

function ring(b) {
  b.phase('Der Repeater-Ring', `Das Herz des Lauflichts liegt direkt auf dem Gras (Ebene ${lv(0)}): ein quadratischer Ring, 6 Felder von der Mitte entfernt, 13 × 13 Blöcke groß. Ecken und jedes zweite Feld sind Blöcke, dazwischen sitzen Repeater. Ein Impuls springt von Repeater zu Block zu Repeater und läuft so endlos im Kreis.`, {
    tips: [
      'Repeater zeigen mit dem Pfeil (der vorderen, einzelnen Fackel) in Laufrichtung. Setz jeden, während du in Laufrichtung schaust: auf der Nordseite nach Osten, auf der Ostseite nach Süden, auf der Südseite nach Westen, auf der Westseite nach Norden.',
      'Stell gleich nach dem Setzen jeden Repeater mit einem Rechtsklick auf Verzögerung 2 (die hintere Fackel rückt ein Stück nach hinten). Neu gesetzte Repeater stehen auf 1.',
      'Ein einziger falsch herum gesetzter Repeater hält den Lichtpunkt an. Geh den Ring nach dem Bauen einmal ab und prüf jeden Pfeil.',
    ],
  });
  const cells = ringCells();
  b.step('Ring-Blöcke', 'Setz die vier Ecken und dann auf jeder Seite jedes zweite Feld als Block aus Bruchtiefenschiefer – auf jeder Seite also 7 Blöcke mit den Ecken, 24 insgesamt.');
  for (const c of cells) if (c.isBlock) b.set(c.x, 0, c.z, CORE);
  b.note(INJECT[0], 0, INJECT[1], 'Ring-Block B0: hier speist der Beobachter vom Pult jeden neuen Lichtpunkt ein');

  b.step('Repeater', 'In die 23 Lücken dazwischen kommen Repeater, Verzögerung 2, Pfeil im Uhrzeigersinn. Nur auf der Südseite, direkt östlich vom mittleren Block, bleibt die Lücke vorerst frei.');
  for (const c of cells) {
    if (c.isBlock || same(STOP, c.x, c.z)) continue;
    const powered = same(PULSE_REPEATER, c.x, c.z);
    b.set(c.x, 0, c.z, `repeater[delay=${DELAY},facing=${SIGNAL_FACING[c.side]},locked=false,powered=${powered}]`);
  }
  b.note(PULSE_REPEATER[0], 0, PULSE_REPEATER[1], 'Hier ist der Lichtpunkt gerade: der Repeater ist an und versorgt den Block dahinter (westlich)');

  b.step('Stopp-Komparator', 'In die freie Lücke auf der Südseite kommt ein Komparator, Spitze nach Westen (schau beim Setzen nach Westen). Schalte ihn mit einem Rechtsklick in den Subtrahier-Modus: die vordere kleine Fackel leuchtet dann. Er reicht den Lichtpunkt weiter wie ein Repeater – bis sein Seiteneingang Strom bekommt. Er sitzt bewusst vor und nicht hinter dem mittleren Block: Den sehr kurzen Startimpuls des Beobachters würde ein Komparator verschlucken, ein Repeater dagegen verlängert ihn.');
  b.set(STOP[0], 0, STOP[1], 'comparator[facing=east,mode=subtract,powered=false]');
  b.note(STOP[0], 0, STOP[1], 'Stopp-Komparator (Subtrahieren): bekommt er von der Seite Strom, endet hier jeder Lichtpunkt');
}

function starter(b) {
  b.phase('Startschaltung', `Vor der Mitte der Südseite baust du außen an den Ring die Startschaltung, ebenfalls auf Ebene ${lv(0)}: Beobachter, Komparator und Kupferbirne in einer Reihe nach Süden. Daneben liegt ein Staub für den Stopp-Hebel.`, {
    tips: [
      'Der Beobachter schaut von dir weg: Stell dich auf den Ring-Block nördlich von ihm und blick nach Süden. Sein Gesicht zeigt dann zum Komparator, der rote Punkt zu dir in den Ring.',
      'Nimm eine gewachste Kupferbirne (mit Honigwabe bearbeitet). Ungewachst oxidiert sie mit der Zeit und leuchtet schwächer – schalten würde sie trotzdem.',
    ],
  });
  b.step('Beobachter, Komparator, Kupferbirne', 'Direkt südlich vom mittleren Block der Südseite (B0) kommt der Beobachter, Gesicht nach Süden. Dahinter der Komparator mit der Spitze nach Norden (schau beim Setzen nach Norden), also mit der Rückseite zur Kupferbirne, die du als Drittes dahinter setzt.');
  b.set(0, 0, EDGE, 'observer[facing=south,powered=false]');
  b.set(0, 0, EDGE + 1, 'comparator[facing=south,mode=compare,powered=true]');
  b.set(0, 0, EDGE + 2, 'waxed_copper_bulb[lit=true,powered=false]');
  b.note(0, 0, EDGE, 'Beobachter: meldet jede Änderung des Komparators mit einem kurzen Impuls in den Ring');
  b.note(0, 0, EDGE + 2, 'Kupferbirne: wechselt bei jedem Knopfdruck zwischen an und aus');

  b.step('Staub für den Stopp-Hebel', 'Direkt südlich vom Stopp-Komparator – also rechts neben dem Beobachter, wenn du von Süden auf das Pult schaust – liegt ein Redstone-Staub. Er führt in den Seiteneingang des Komparators.');
  b.set(STOP[0], 0, EDGE, 'redstone_wire[power=0]');

  b.step('Pultkasten', 'Schließ die Schaltung mit vier polierten Schwarzsteinziegeln ein: links und rechts vom Komparator (der rechte liegt damit direkt südlich vom Staub) und links und rechts von der Birne. Die Vorderseite der Birne bleibt frei – sie ist die Kontrollleuchte des Pults.');
  for (const [x, z] of [[-1, EDGE + 1], [1, EDGE + 1], [-1, EDGE + 2], [1, EDGE + 2]]) b.set(x, 0, z, 'polished_blackstone_bricks');
}

function podium(b) {
  b.phase('Podest mit Lampen', `Jetzt wächst das Podest um den Ring herum: Auf Ebene ${lv(0)} kommen die Lampen in den äußeren Rand und Bruchtiefenschiefer ins Innere, auf Ebene ${lv(1)} der Boden mit dem zweiten Lampenring und der Tanzfläche.`, {
    tips: [
      'Lampen gehören nur neben die Ring-Blöcke, nie neben einen Repeater: Ein Repeater gibt sein Signal nur nach vorne ab.',
      'Beim Setzen bleiben alle Lampen dunkel. Sie leuchten erst, wenn ein Lichtpunkt vorbeikommt.',
    ],
  });
  const cells = ringCells();
  const lampsOuter = new Set();
  for (const c of cells) {
    if (!c.isBlock) continue;
    for (const [x, z] of outerNeighbors(c.x, c.z)) lampsOuter.add(`${x},${z}`);
  }
  const litOuter = new Set(LIT_BLOCKS.flatMap(([bx, bz]) => outerNeighbors(bx, bz)).map(([x, z]) => `${x},${z}`));

  b.step('Äußerer Rand', `Der äußere Rand (Ebene ${lv(0)}, 7 Felder von der Mitte) bekommt vor jedem Ring-Block eine Redstone-Lampe, an den Ecken zwei (eine auf jeder Seite), dazwischen Tiefenschieferfliesen. Vor dem Stopp-Komparator liegt schon der Staub, vor B0 der Beobachter.`);
  for (let x = -EDGE; x <= EDGE; x++) {
    for (let z = -EDGE; z <= EDGE; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== EDGE) continue;
      if (b.get(x, 0, z) !== 'air') continue;
      const key = `${x},${z}`;
      b.set(x, 0, z, lampsOuter.has(key) ? lamp(litOuter.has(key)) : BAND);
    }
  }
  b.note(LIT_BLOCKS[0][0], 0, EDGE, 'Leuchtet gerade: die Lampen am Block hinter dem eingeschalteten Repeater; die rechts daneben glühen noch nach');

  b.step('Inneres auffüllen', `Fülle das Innere des Rings auf Ebene ${lv(0)} (11 × 11) mit Bruchtiefenschiefer. So bleibt unter dem Boden kein dunkler Hohlraum.`);
  b.fill(-RING + 1, 0, -RING + 1, RING - 1, 0, RING - 1, CORE);

  b.step('Boden mit zweitem Lampenring', `Auf Ebene ${lv(1)} liegt der Boden: über jedem Ring-Block eine Redstone-Lampe, über den Repeatern polierter Tiefenschiefer, außen ein Rand aus poliertem Tiefenschiefer und innen eine Tanzfläche im Schachbrettmuster aus Quarz und poliertem Schwarzstein.`);
  for (let x = -EDGE; x <= EDGE; x++) {
    for (let z = -EDGE; z <= EDGE; z++) {
      const d = Math.max(Math.abs(x), Math.abs(z));
      let state;
      if (d === EDGE) state = RIM;
      else if (d === RING) {
        const c = cells.find((cell) => cell.x === x && cell.z === z);
        state = c.isBlock ? lamp(LIT_BLOCKS.some((l) => same(l, x, z))) : RIM;
      } else state = (x + z) % 2 === 0 ? 'smooth_quartz' : 'polished_blackstone';
      b.set(x, 1, z, state);
    }
  }
}

function controls(b) {
  b.phase('Treppe und Bedienung', 'Eine Treppe auf der Nordseite führt aufs Podest. Am Pult auf der Südseite kommen der Startknopf und der Stopp-Hebel dazu.', {
    tips: [
      'Start: einmal den Knopf drücken. Willst du mehrere Lichtpunkte, drück noch einmal, wenn der erste ein Stück weitergelaufen ist.',
      'Stopp: Hebel umlegen – der Lichtpunkt verschwindet am Stopp-Komparator. Danach den Hebel zurücklegen, sonst läuft jeder neue Lichtpunkt nur noch eine Runde.',
    ],
  });
  b.step('Treppe', 'Mitten auf der Nordseite: drei Tiefenschieferfliesen-Treppen vor dem Rand auf dem Pflaster und drei weitere darüber an Stelle des Randes, alle mit der hohen Seite nach Süden (schau beim Setzen nach Süden).');
  for (let x = -1; x <= 1; x++) {
    b.set(x, 0, -EDGE - 1, 'deepslate_tile_stairs[facing=south,half=bottom]');
    b.set(x, 1, -EDGE, 'deepslate_tile_stairs[facing=south,half=bottom]');
  }

  b.step('Pultdeckel und Knopf', 'Deck das Pult über Komparator und Birne und links daneben (von Süden gesehen) mit poliertem Schwarzstein ab, obendrauf je eine Stufe. Die rechte Spalte bleibt niedrig: nur vorne eine Stufe, damit der Hebel später frei liegt. An die Südseite des Blocks über der Birne kommt ein roter Karmesinknopf.');
  const lowX = STOP[0];
  for (const [x, z] of [[0, EDGE + 1], [-lowX, EDGE + 1], [0, EDGE + 2], [-lowX, EDGE + 2]]) {
    b.set(x, 1, z, 'polished_blackstone');
    b.set(x, 2, z, 'polished_blackstone_slab[type=bottom]');
  }
  b.set(lowX, 1, EDGE + 2, 'polished_blackstone_slab[type=bottom]');
  b.set(0, 1, EDGE + 3, 'crimson_button[face=wall,facing=south,powered=false]');
  b.note(0, 1, EDGE + 3, 'Startknopf: jeder Druck schickt einen Lichtpunkt los');

  b.step('Stopp-Hebel', 'Rechts am Pult, über dem niedrigen Teil, kommt ein Hebel an die Südseite des Randblocks, der genau über dem Staub liegt. Er steht nach dem Bauen unten (aus) – so darf das Licht laufen.');
  b.set(STOP[0], 1, EDGE + 1, 'lever[face=wall,facing=south,powered=false]');
  b.note(STOP[0], 1, EDGE + 1, 'Stopp-Hebel: an = Lichtpunkt wird gelöscht, aus = Licht darf laufen');
}

function pavilion(b) {
  b.phase('Säulen und Balkenkranz', `Auf der Tanzfläche stehen vier Quarzsäulen, je 4 Felder von der Mitte entfernt. Darauf liegt auf Ebene ${lv(6)} ein Kranz aus glattem Quarz.`, {
    tips: ['Setz zuerst die vier Säulenfüße und prüf die Abstände: zwischen zwei Säulen liegen 7 freie Felder.'],
  });
  b.step('Säulen', `Jede Säule ist 4 Blöcke hoch (Ebene ${lv(2)} bis ${lv(5)}): unten glatter Quarz, dann zwei Quarzsäulenblöcke, oben ein gemeißelter Quarzblock. Unten und oben umgibt sie ein Kranz aus glatten Quarztreppen, unten mit der hohen Seite zur Säule, oben umgedreht.`);
  for (const x of [-4, 4]) for (const z of [-4, 4]) column(b, { x, y: 2, z, height: 4 });
  b.step('Balkenkranz', `Verbinde die Säulenköpfe auf Ebene ${lv(6)} mit einem Kranz aus glattem Quarz (9 × 9, innen frei).`);
  for (let x = -4; x <= 4; x++) {
    for (let z = -4; z <= 4; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === 4) b.set(x, 6, z, 'smooth_quartz');
    }
  }
}

// Rot-weiße Streifen: auf jeder Dachseite wechseln sich Bahnen von 2 Treppen ab (Mitte weiß).
function stripeRoof(b) {
  for (let x = -5; x <= 5; x++) {
    for (let y = 6; y <= 11; y++) {
      for (let z = -5; z <= 5; z++) {
        const state = b.get(x, y, z);
        if (!state.startsWith('quartz_stairs')) continue;
        const facing = /facing=(\w+)/.exec(state)[1];
        const along = facing === 'north' || facing === 'south' ? x : z;
        if (Math.floor((Math.abs(along) + 1) / 2) % 2 === 1) b.set(x, y, z, state.replace('quartz_stairs', 'red_nether_brick_stairs'));
      }
    }
  }
}

function roof(b) {
  b.phase('Spitzdach', `Das Zeltdach ist eine Pyramide aus Treppen mit 1 Block Überstand. Die unterste Reihe liegt auf Ebene ${lv(6)} neben dem Balkenkranz, jede weitere Reihe eine Ebene höher und einen Block weiter innen. Die Streifen entstehen aus weißen Quarztreppen und roten Netherziegeltreppen im Wechsel – je zwei Treppen breit, die Mitte jeder Seite weiß.`, {
    tips: [
      'Setz die Treppen, während du zur Dachmitte schaust – dann zeigt die hohe Seite automatisch nach oben zur Spitze.',
      'Fang jede Reihe in der Seitenmitte mit einer weißen Treppe an und zähl dann nach außen: 2 rot, 2 weiß, 2 rot.',
    ],
  });
  b.roof({ x1: -4, z1: -4, x2: 4, z2: 4, y: 6, type: 'pyramid', stairs: 'quartz_stairs', slab: 'quartz_slab', full: 'smooth_quartz', overhang: 1 });
  stripeRoof(b);
  b.step('Spitze', `Auf die Dachspitze (Ebene ${lv(12)}) kommt ein Blitzableiter aus Kupfer.`);
  b.set(0, 12, 0, 'lightning_rod[facing=up]');
}

function decor(b) {
  b.phase('Licht und Musik', 'Unter dem Dach hängen Laternen – eine große an Ketten in der Mitte und vier unter dem Balkenkranz –, und mitten auf der Tanzfläche steht eine Jukebox.');
  b.step('Laternen', `Häng in die Dachspitze (Ebene ${lv(10)}) eine Laterne an drei Ketten und unter die Mitte jeder Kranzseite eine Laterne direkt an den Balken.`);
  hangingLantern(b, { x: 0, y: 10, z: 0, chain: 3 });
  for (const [x, z] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) hangingLantern(b, { x, y: 5, z, chain: 0 });
  b.step('Jukebox', 'Stell die Jukebox in die Mitte der Tanzfläche. Leg eine Schallplatte ein, wenn du tanzen willst.');
  b.set(0, 2, 0, 'jukebox[has_record=false]');
}

function surroundings(b) {
  b.phase('Rund um den Pavillon', 'Ein Kiesweg führt von Norden zur Treppe, zwei Laternenpfähle stehen am Fuß der Treppe. Hinter dem Pavillon wachsen zwei Kirschbäume, an Ost- und Westseite liegen Blumenbeete, an den vorderen Ecken Azaleenbüsche.');
  b.step('Weg und Laternenpfähle', 'Der Kiesweg kommt von Norden, die Laternenpfähle aus Tiefenschieferziegelmauer stehen links und rechts der Treppe auf dem Pflaster.');
  path(b, { x: 0, y: -1, z: -10, facing: 'north', length: 7, width: 3, mix: 'kies', wiggle: 0.8, seed: 41 });
  for (const x of [-3, 3]) lampPost(b, { x, y: 0, z: -9, facing: 'north', height: 3, post: 'deepslate_brick_wall', base: 'polished_deepslate', style: 'top' });
  b.step('Beete und Bäume', 'Vor Ost- und Westseite je ein Blumenbeet in Rosa, an den Nordecken zwei kleine Kirschbäume, an den Südecken und am Weg Azaleenbüsche.');
  flowerBed(b, { x: 10, y: -1, z: -5, width: 2, depth: 11, facing: 'east', palette: 'rosa', border: 'stein', seed: 42 });
  flowerBed(b, { x: -11, y: -1, z: -5, width: 2, depth: 11, facing: 'west', palette: 'rosa', border: 'stein', seed: 43 });
  for (const [x, z, seed] of [[-12, -12, 44], [12, -12, 45]]) tree(b, { x, y: 0, z, species: 'kirsche', size: 'klein', seed });
  for (const [x, z, size, seed] of [[-12, 12, 'mittel', 46], [12, 12, 'mittel', 47], [-6, -12, 'klein', 48], [14, 2, 'klein', 50]]) bush(b, { x, y: 0, z, size, leaves: 'azalee', seed });
  vegetation(b, { x: GROUND.x, y: -1, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'blumen', density: 0.25, seed: 51 });
}

export default function build(b) {
  site(b);
  ring(b);
  starter(b);
  podium(b);
  controls(b);
  pavilion(b);
  roof(b);
  decor(b);
  surroundings(b);
}
