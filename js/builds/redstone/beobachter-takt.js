// Beobachter-Taktgeber: zwei Beobachter, die sich gegenseitig beobachten, als schneller Takt (5 Impulse pro Sekunde).
// Ein Hebel schiebt über einen klebrigen Kolben den zweiten Beobachter vor den ersten (an) oder zieht ihn weg (aus).
// Bau-Rahmen: Sockel x −4 … 3, z −2 … 3 auf y = 0, Technik auf y = 1, Hebel vorne bei z = 4. Gelände y = −1 … 0.
//
// Signalweg (von oben, Norden oben):
//   z 0:  Notenblock (−2) ← Kraftblock (−1, Lampe darauf) ← Beobachter A (0, Gesicht nach Osten) · Platz für B (1)
//   z 1:                                                                           Beobachter B (1, Gesicht nach Westen)
//   z 2:                                                                           klebriger Kolben (1, schiebt nach Norden)
//   z 3:                                                                           Schaltblock (1), Hebel an seiner Südseite
// Hebel an → Schaltblock stark versorgt → Kolben schiebt B nach z 0 → A und B sehen sich gegenseitig → Takt läuft (4 Ticks).
// A gibt jeden Impuls nach hinten (Westen) in den Kraftblock → Notenblock daneben spielt, Lampe darüber leuchtet.
// B zeigt mit seinem Ausgang immer nach Osten ins Leere – nie in den Kolben (sonst würde B den Kolben selbst auslösen).

import { WOOD, lampPost, terrain, flowerBed, bush, vegetation } from '../lib/index.js';

export const meta = {
  id: 'beobachter-takt',
  title: 'Beobachter-Taktgeber',
  category: 'redstone',
  subtitle: 'Schneller Takt aus zwei Beobachtern, mit einem Hebel ein- und ausschaltbar – treibt Trommel und Lampe',
  tags: ['Redstone', 'Takt', 'Taktgeber', 'Clock', 'Beobachter', 'Kolben', 'Notenblock', 'Redstone-Lampe', 'Hebel', 'Anfänger', 'Schaltung'],
  aliases: [
    'beobachter takt', 'beobachtertakt', 'beobachter taktgeber', 'beobachter clock', 'observer clock', 'double observer clock',
    'observer takt', 'taktgeber', 'redstone takt', 'redstone clock', 'clock', 'pulsgeber', 'impulsgeber', 'schneller takt',
    'beobachteruhr', 'trommelwirbel', 'beobachtr takt', 'obsever clock', 'rapid clock',
  ],
  accuracy: 'vorlage',
  difficulty: 1,
  description: 'Zwei Beobachter, die sich gegenseitig anschauen, reagieren immer wieder aufeinander und erzeugen so einen sehr schnellen Takt: fünf Impulse pro Sekunde. Ein Hebel steuert einen klebrigen Kolben, der den zweiten Beobachter vor den ersten schiebt (Takt an) oder wieder wegzieht (Takt aus). Jeder Impuls lässt einen Notenblock auf Sand als kleine Trommel schlagen – ein Trommelwirbel –, und eine Redstone-Lampe zeigt, dass der Takt läuft.',
  facts: [
    'Takt: 4 Spielticks (0,2 Sekunden) pro Durchgang, davon 2 Ticks an – also 5 Impulse pro Sekunde.',
    'Den Takt in dieser Form erzeugt nur das Hineinschieben mit dem Kolben. Setzt du zwei Beobachter von Hand gegeneinander, läuft er mit 6 Ticks und lässt sich nicht mehr abschalten, ohne einen abzubauen.',
    'Die Redstone-Lampe schaltet erst 4 Ticks nach dem Ende eines Impulses ab – dann kommt schon der nächste. Sie flackert deshalb nicht, sondern leuchtet durchgehend, solange der Takt läuft.',
    'Der Notenblock spielt bei jedem Impuls. Auf Sand klingt er wie eine kleine Trommel, auf Stein wie eine Basstrommel, auf einem Goldblock wie eine Glocke.',
    'Ein Beobachter schaut immer von dir weg: Das Gesicht zeigt in die Richtung, in die du beim Setzen blickst, der rote Punkt (Ausgang) zu dir.',
    'Nicht im Spiel getestet: der Aufbau folgt dem „Double Observer Clock“ aus dem Minecraft Wiki (Takt an und aus über einen Kolben).',
  ],
  sources: [
    { title: 'Minecraft Wiki: Redstone circuits/Clock – Observer clocks', url: 'https://minecraft.wiki/w/Redstone_circuits/Clock#Observer_clocks' },
    { title: 'Minecraft Wiki: Observer', url: 'https://minecraft.wiki/w/Observer' },
    { title: 'Minecraft Wiki: Note Block', url: 'https://minecraft.wiki/w/Note_Block' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const PLINTH = { x1: -4, x2: 3, z1: -2, z2: 3 };
const GROUND = { x: -8, z: -6, width: 17, depth: 15 };
const OBSERVER_A = { x: 0, y: 1, z: 0 };
const OBSERVER_B = { x: 1, y: 1, z: 1 };
const PISTON = { x: 1, y: 1, z: 2 };
const SWITCH_BLOCK = { x: 1, y: 1, z: 3 };
const POWER_BLOCK = { x: -1, y: 1, z: 0 };
const NOTE = { x: -2, y: 1, z: 0 };
const PANEL = 'chiseled_stone_bricks';

function site(b) {
  b.phase('Bauplatz und Sockel', 'Such dir ein ebenes Stück Wiese. Der Taktgeber steht auf einem flachen Sockel aus poliertem Andesit mit einem Rand aus Tiefenschieferfliesen, 8 × 6 Blöcke groß.', {
    tips: ['Setz zuerst die vier Ecken des Sockels und zähl dann ab: 8 Blöcke von West nach Ost, 6 von Nord nach Süd.'],
  });
  b.step('Wiese', 'Die Wiese rund um den Taktgeber.');
  terrain(b, { x: GROUND.x, y: -1, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, height: 1, seed: 'beobachter-takt' });

  b.step('Sockel', 'Leg den Sockel in die Grasschicht: außen ein Ring aus Tiefenschieferfliesen, innen polierter Andesit. Ein Feld bekommt Sand statt Andesit: im Innenfeld (6 × 4) das zweite Feld von Westen in der zweiten Reihe von hinten. Auf ihm steht später der Notenblock, und der Sand macht ihn zur Trommel.');
  b.fill(PLINTH.x1, 0, PLINTH.z1, PLINTH.x2, 0, PLINTH.z2, 'deepslate_tiles');
  b.fill(PLINTH.x1 + 1, 0, PLINTH.z1 + 1, PLINTH.x2 - 1, 0, PLINTH.z2 - 1, 'polished_andesite');
  b.set(NOTE.x, 0, NOTE.z, 'sand');
  b.note(NOTE.x, 0, NOTE.z, 'Sand unter dem Notenblock = Instrument „Kleine Trommel“');
}

function clock(b) {
  b.phase('Erster Beobachter und Ausgang', 'Jetzt kommt der feste Teil des Takts: der erste Beobachter und dahinter das, was er antreiben soll – ein Kraftblock, an dem Notenblock und Lampe hängen.', {
    tips: [
      'Ein Beobachter schaut von dir weg. Für den ersten Beobachter stellst du dich also westlich davon hin und blickst nach Osten – dann zeigt sein Gesicht nach Osten und der rote Punkt nach Westen zu dir.',
      'Der Beobachter gibt seinen Impuls nur nach hinten ab (roter Punkt). Er versorgt den Block dahinter stark, und dieser Block schaltet alles, was direkt an ihm hängt: hier Notenblock und Lampe.',
    ],
  });
  b.step('Beobachter A', 'Setz den ersten Beobachter in dieselbe Reihe wie das Sandfeld, zwei Felder weiter östlich (auf das Feld dazwischen kommt gleich der Kraftblock). Gesicht nach Osten, roter Punkt nach Westen.');
  b.set(OBSERVER_A.x, OBSERVER_A.y, OBSERVER_A.z, 'observer[facing=east,powered=false]');
  b.note(OBSERVER_A.x, OBSERVER_A.y, OBSERVER_A.z, 'Beobachter A: Gesicht nach Osten, Ausgang (roter Punkt) nach Westen');

  b.step('Kraftblock und Lampe', 'Direkt westlich hinter den roten Punkt kommt ein gemeißelter Steinziegel als Kraftblock, obendrauf eine Redstone-Lampe.');
  b.set(POWER_BLOCK.x, POWER_BLOCK.y, POWER_BLOCK.z, PANEL);
  b.set(POWER_BLOCK.x, POWER_BLOCK.y + 1, POWER_BLOCK.z, 'redstone_lamp[lit=false]');

  b.step('Notenblock', 'Westlich neben den Kraftblock setzt du den Notenblock auf das Sandfeld. Über ihm muss Luft bleiben, sonst bleibt er stumm. Der Ton ist egal – eine kleine Trommel klingt in jeder Tonhöhe gut. Willst du sie tiefer oder höher, klickst du den Notenblock mit Rechtsklick an: jeder Klick ist einen Halbton höher.');
  b.set(NOTE.x, NOTE.y, NOTE.z, 'note_block[instrument=snare,note=0,powered=false]');
  b.note(NOTE.x, NOTE.y, NOTE.z, 'Notenblock: schlägt bei jedem Impuls – über ihm muss Luft sein');
}

function toggle(b) {
  b.phase('Schalter: Kolben mit zweitem Beobachter', 'Der zweite Beobachter sitzt auf einem klebrigen Kolben. Fährt der Kolben aus, steht der Beobachter genau vor dem ersten – beide sehen sich gegenseitig, und der Takt läuft. Fährt er ein, ist der Takt aus.', {
    tips: [
      'Lass den Hebel aus, solange du baust. Sonst fährt der Kolben aus, sobald er Strom bekommt, und der Takt startet vor dem Fertigbauen.',
      'Kolben und Beobachter drehen sich auch nach oben oder unten, wenn du beim Setzen steil hinunterschaust. Bleib zwei Blöcke weg und blick möglichst waagrecht.',
      'Der Kolben schiebt quer zur Beobachter-Reihe, nicht von hinten. So zeigt der rote Punkt des zweiten Beobachters nie in den Kolben – sonst würde er den Kolben bei jedem Impuls selbst auslösen.',
      'Der Takt entsteht nur, wenn der Kolben den Beobachter hineinschiebt (4 Ticks). Setzt du den zweiten Beobachter von Hand vor den ersten, läuft ein langsamerer Takt, den du nicht mehr abschalten kannst.',
    ],
  });
  b.step('Klebriger Kolben', 'Zwei Reihen südlich vom ersten Beobachter, ein Feld nach Osten versetzt, setzt du einen klebrigen Kolben, der nach Norden schiebt. Ein Kolben zeigt mit seinem Kopf immer zu dir: Stell dich also nördlich davon auf den Sockel (auf das freie Feld vor dem ersten Beobachter) und blick nach Süden.');
  b.set(PISTON.x, PISTON.y, PISTON.z, 'sticky_piston[extended=false,facing=north]');

  b.step('Beobachter B', 'Setz den zweiten Beobachter vorne an den Kolbenkopf (eine Reihe südlich vom ersten Beobachter, ein Feld östlich). Sein Gesicht muss nach Westen zeigen: Stell dich östlich davon hin und blick nach Westen. So schaut er jetzt ins Leere – erst ausgefahren schaut er dem ersten Beobachter ins Gesicht.');
  b.set(OBSERVER_B.x, OBSERVER_B.y, OBSERVER_B.z, 'observer[facing=west,powered=false]');
  b.note(OBSERVER_B.x, OBSERVER_B.y, OBSERVER_B.z, 'Beobachter B klebt am Kolben: Gesicht nach Westen');
  b.note(OBSERVER_A.x + 1, OBSERVER_A.y, OBSERVER_A.z, 'Hierhin schiebt der Kolben Beobachter B – dieses Feld muss frei bleiben');

  b.step('Schaltblock und Hebel', 'Hinter den Kolben (südlich) kommt ein gemeißelter Steinziegel als Schaltblock, an seine Südseite der Hebel. Hebel an versorgt den Schaltblock stark, und der versorgt den Kolben daneben.');
  b.set(SWITCH_BLOCK.x, SWITCH_BLOCK.y, SWITCH_BLOCK.z, PANEL);
  b.set(SWITCH_BLOCK.x, SWITCH_BLOCK.y, SWITCH_BLOCK.z + 1, 'lever[face=wall,facing=south,powered=false]');
  b.note(SWITCH_BLOCK.x, SWITCH_BLOCK.y, SWITCH_BLOCK.z + 1, 'Hebel: an = Takt läuft (Trommelwirbel, Lampe an), aus = Ruhe');
}

function frame(b) {
  b.phase('Pult und Rahmen', 'Damit der Taktgeber nicht wie eine nackte Schaltung aussieht, bekommt er ein Pult: Wangen aus Treppen neben dem Schaltblock und zwei Laternenpfosten an den hinteren Ecken.', {
    tips: [
      'Lass die Felder rund um die Beobachter, den Kraftblock und den Kolben frei. Ein Block östlich hinter dem zweiten Beobachter würde bei jedem Impuls mit Strom versorgt und könnte etwas daneben auslösen.',
    ],
  });
  b.step('Pultwangen', 'Links und rechts neben den Schaltblock kommt je eine Steinziegeltreppe, die hohe Seite nach Norden zum Kolben hin – so sieht der Hebel aus wie in ein Pult eingelassen.');
  b.stairs(SWITCH_BLOCK.x - 1, 1, SWITCH_BLOCK.z, 'stone_brick_stairs', { facing: 'north' });
  b.stairs(SWITCH_BLOCK.x + 1, 1, SWITCH_BLOCK.z, 'stone_brick_stairs', { facing: 'north' });

  b.step('Laternenpfosten', 'An die beiden hinteren Ecken des Sockels kommt je ein Pfosten: ein gemeißelter Steinziegel als Fuß, darauf zwei Fichtenzäune und eine Laterne.');
  for (const x of [PLINTH.x1, PLINTH.x2]) {
    lampPost(b, { x, y: 1, z: PLINTH.z1, height: 3, post: spruce.fence, base: PANEL, style: 'top' });
  }

  b.step('Rückwand', 'Zwischen den Pfosten läuft hinten eine niedrige Mauer aus Steinziegelmauern, damit nichts von hinten an die Schaltung kommt.');
  b.fill(PLINTH.x1 + 1, 1, PLINTH.z1, PLINTH.x2 - 1, 1, PLINTH.z1, 'stone_brick_wall');
}

function surroundings(b) {
  b.phase('Rund um den Taktgeber', 'Zum Schluss ein kurzer Weg aus Bruchstein und Kies zum Hebel, ein Blumenbeet links davon und ein Azaleenbusch hinten rechts.');
  b.step('Weg zum Hebel', 'Ersetz vor dem Hebel einen 3 Blöcke breiten und 4 Blöcke langen Streifen Gras durch Bruchstein, bemoosten Bruchstein und Kies, bunt gemischt.');
  for (let z = PLINTH.z2 + 1; z <= PLINTH.z2 + 4; z++) {
    for (let x = SWITCH_BLOCK.x - 1; x <= SWITCH_BLOCK.x + 1; x++) {
      b.set(x, 0, z, b.pickWeighted([['cobblestone', 4], ['mossy_cobblestone', 2], ['gravel', 2], ['andesite', 1]]));
    }
  }
  b.step('Beet und Busch', 'Links vom Weg kommt ein kleines Blumenbeet (3 × 2) auf Erde, hinten rechts neben dem Sockel ein kleiner Azaleenbusch.');
  flowerBed(b, { x: PLINTH.x1, y: 0, z: PLINTH.z2 + 1, width: 3, depth: 2, facing: 'south', palette: 'bunt', soil: 'erde', density: 0.95, seed: 3 });
  bush(b, { x: PLINTH.x2 + 3, y: 1, z: PLINTH.z1 - 1, size: 'klein', leaves: 'azalee', seed: 4 });
  b.step('Wiese', 'Ringsum etwas hohes Gras und ein paar Wildblumen.');
  vegetation(b, { x: GROUND.x, y: 0, z: GROUND.z, width: GROUND.width, depth: GROUND.depth, mix: 'wiese', density: 0.3, seed: 6 });
}

export default function build(b) {
  site(b);
  clock(b);
  toggle(b);
  frame(b);
  surroundings(b);
}
