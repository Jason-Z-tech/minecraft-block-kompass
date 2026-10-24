// Dorfkirche – Kirchenschiff mit Westturm (Glockenstube mit Glocke), Buntglasfenstern, Bänken, Altar und Friedhof.
// Rahmen: Schiff x 0 … 20 (Westen → Osten), z 0 … 10; Turm x −6 … 0, z 2 … 8; Altar im Osten; Friedhof im Süden. Wiese auf y = 0.

import { hashPosition } from '../../core/random.js';
import {
  WOOD, window, doorway, arch, wallLantern, floorPattern, gardenFence, lightRoom, tree, bush, pathAlong, vegetation,
} from '../lib/index.js';

export const meta = {
  id: 'dorfkirche',
  title: 'Dorfkirche',
  category: 'mittelalter',
  subtitle: 'Steinkirche mit Glockenturm, Buntglasfenstern und Friedhof',
  tags: ['Mittelalter', 'Dorf', 'Kirche', 'Kapelle', 'Glockenturm', 'Turm', 'Buntglas', 'Friedhof', 'Innenausbau'],
  aliases: [
    'dorfkirche', 'dorf kirche', 'kirche', 'kirch', 'kapelle', 'steinkirche', 'gotische kirche', 'glockenturm',
    'kirchturm', 'friedhof', 'church', 'village church', 'chapel', 'medieval church', 'bell tower', 'graveyard', 'cemetery',
  ],
  accuracy: 'eigenes',
  difficulty: 3,
  description: 'Eine Dorfkirche aus Steinziegeln: ein 21 Blöcke langes Kirchenschiff mit Strebepfeilern, je fünf Bogenfenstern aus blauem, rotem und gelbem Buntglas und einer Rosette im Ostgiebel, darüber ein steiles Dach aus Tiefenschieferfliesen. Im Westen steht der 28 Blöcke hohe Turm mit Portal, Glockenstube und spitzem Helm, in der eine echte Glocke hängt. Innen führen Kirchenbänke aus Treppen und ein roter Läufer zum erhöhten Chor mit Altar; südlich liegt ein umzäunter Friedhof mit Grabsteinen und einer Fichte.',
  facts: [
    'Schiff 21 × 11 Blöcke, Turm 7 × 7 Blöcke und 28 Blöcke hoch (mit Blitzableiter als Turmspitze).',
    'Die Glocke hängt an einem Balken in der Glockenstube und lässt sich im Spiel mit Rechtsklick läuten.',
    'Jedes Bogenfenster ist 3 breit und 5 hoch, die Rundung oben bilden umgedrehte Steinziegeltreppen.',
    'Die Kirchenbänke sind Fichtentreppen mit der Lehne nach Westen – wer sitzt, schaut zum Altar im Osten.',
  ],
  sources: [],
  credits: null,
  tested: null,
};

const spruce = WOOD.fichte;
const dark = WOOD.schwarzeiche;

const NAVE = { x1: 0, x2: 20, z1: 0, z2: 10, top: 7 };
const TOWER = { x1: -6, x2: 0, z1: 2, z2: 8, top: 18 };
const BAYS = [2, 6, 10, 14, 18];
const BUTTRESSES = [0, 4, 8, 12, 16, 20];
const ROOF = { stairs: 'deepslate_tile_stairs', slab: 'deepslate_tile_slab', full: 'deepslate_tiles' };

function wallStone(x, y, z) {
  const h = hashPosition(x, y, z, 777) % 20;
  if (y <= 2 && h < 5) return 'mossy_stone_bricks';
  if (h < 2) return 'cracked_stone_bricks';
  return 'stone_bricks';
}

function wallRing(b, x1, x2, z1, z2, y1, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) if (x === x1 || x === x2 || z === z1 || z === z2) b.set(x, y, z, wallStone(x, y, z));
    }
  }
}

function groundAndFloor(b) {
  b.phase('Gelände und Fundament', 'Leg die Wiese aus und darauf den Grundriss: das Kirchenschiff (21 lang, 11 breit) und den Turm im Westen (7 × 7), der mittig an der Westwand sitzt. Innen kommt ein Schachbrettboden aus poliertem Andesit und Diorit.', {
    tips: ['Steck zuerst die Ecken von Schiff und Turm ab: der Turm teilt sich seine Ostwand mit der Westwand des Schiffs.'],
  });
  b.step('Wiese und Grundriss', 'Die Wiese ist 41 × 38 Blöcke groß. Unter den Mauern liegt Steinziegel, innen das Schachbrettmuster.');
  b.fill(-14, 0, -12, 26, 0, 25, 'grass_block');
  b.fill(NAVE.x1, 0, NAVE.z1, NAVE.x2, 0, NAVE.z2, 'stone_bricks');
  b.fill(TOWER.x1, 0, TOWER.z1, TOWER.x2, 0, TOWER.z2, 'stone_bricks');
  floorPattern(b, { x: 1, y: 0, z: 1, width: 19, depth: 9, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'] });
  floorPattern(b, { x: TOWER.x1 + 1, y: 0, z: TOWER.z1 + 1, width: 5, depth: 5, pattern: 'checker', blocks: ['polished_andesite', 'polished_diorite'] });
}

function nave(b) {
  b.phase('Mauern des Kirchenschiffs', 'Mauere die Wände des Schiffs 7 Blöcke hoch aus Steinziegeln (unten mit etwas bemoosten, dazwischen ein paar rissige). Außen an den Längsseiten stehen sechs Strebepfeiler: 5 hoch, oben mit einer Steinziegeltreppe, die zur Wand hin ansteigt.', {
    tips: ['Die Strebepfeiler stehen alle 4 Blöcke – zwischen zwei Pfeilern ist genau Platz für ein 3 breites Fenster.'],
  });
  b.step('Wände', 'Mauere die vier Wände Reihe für Reihe 7 hoch.');
  wallRing(b, NAVE.x1, NAVE.x2, NAVE.z1, NAVE.z2, 1, NAVE.top);
  b.step('Strebepfeiler', 'Setz außen vor die Nord- und die Südwand je sechs Pfeiler (an beiden Ecken und alle 4 Blöcke): ein Fundamentblock im Boden, darüber 5 hoch, darauf eine Treppe mit der hohen Seite zur Wand.');
  for (const x of BUTTRESSES) {
    for (const [z, facing] of [[NAVE.z1 - 1, 'south'], [NAVE.z2 + 1, 'north']]) {
      for (let y = 0; y <= 5; y++) b.set(x, y, z, wallStone(x, y, z));
      b.set(x, 6, z, `stone_brick_stairs[facing=${facing},half=bottom]`);
    }
  }

  b.phase('Dach des Schiffs', 'Das Satteldach aus Tiefenschieferfliesen-Treppen läuft Ost–West, steht ringsum einen Block über und schließt oben mit einer Reihe Stufen als First. Die Giebel mauerst du aus Steinziegeln.', {
    tips: ['Die Breite mit Überstand ist ungerade (13) – darum liegt oben in der Mitte eine Reihe Stufen statt zweier Treppen.'],
  });
  b.roof({ x1: NAVE.x1, z1: NAVE.z1, x2: NAVE.x2, z2: NAVE.z2, y: NAVE.top, type: 'gable', axis: 'x', stairs: ROOF.stairs, slab: ROOF.slab, full: 'stone_bricks', overhang: 1 });
}

function recolorStainedGlass(b, x, y, z, alongX, height) {
  const pattern = (d, ly) => {
    if (ly === height - 1) return 'yellow';
    if (ly === 2) return d === 0 ? 'yellow' : 'red';
    if (ly === 1 || ly === 3) return d === 0 ? 'red' : 'blue';
    return 'blue';
  };
  for (let d = -1; d <= 1; d++) {
    for (let ly = 0; ly < height; ly++) {
      const [cx, cz] = alongX ? [x + d, z] : [x, z + d];
      if (b.get(cx, y + ly, cz).includes('stained_glass_pane')) b.set(cx, y + ly, cz, `${pattern(Math.abs(d), ly)}_stained_glass_pane`);
    }
  }
}

function naveWindows(b) {
  b.phase('Fenster und Türen des Schiffs', 'Brich die Bogenfenster in die Längswände: je fünf, 3 breit und 5 hoch, mit einer Rundung aus umgedrehten Steinziegeltreppen und einer Fensterbank. Das Buntglas setzt du in Farben: unten Blau, in der Mitte Rot und Gelb, oben Gelb. Im Ostgiebel sitzt eine Rosette, in der Südwand eine Tür zum Friedhof.', {
    tips: ['Mit einem Muster aus wenigen Farben wirken die Fenster ruhiger als mit allen 16 – Blau, Rot und Gelb sind die klassischen Kirchenfarben.'],
  });
  b.step('Bogenfenster Nordseite');
  for (const x of BAYS) {
    window(b, { x, y: 2, z: NAVE.z1, facing: 'north', width: 3, height: 5, style: 'arched', glass: 'blue_stained_glass_pane', stairs: 'stone_brick_stairs', sill: 'stone_brick_stairs' });
    recolorStainedGlass(b, x, 2, NAVE.z1, true, 5);
  }
  b.step('Bogenfenster Südseite', 'Auf der Südseite ersetzt in der Mitte eine Tür das Fenster: Fichtentür mit gemeißeltem Steinziegel darüber und einem kleinen Buntglasfenster.');
  for (const x of BAYS) {
    if (x === 10) continue;
    window(b, { x, y: 2, z: NAVE.z2, facing: 'south', width: 3, height: 5, style: 'arched', glass: 'blue_stained_glass_pane', stairs: 'stone_brick_stairs', sill: 'stone_brick_stairs' });
    recolorStainedGlass(b, x, 2, NAVE.z2, true, 5);
  }
  doorway(b, { x: 10, y: 1, z: NAVE.z2, facing: 'south', door: spruce.door, frame: null });
  b.set(10, 3, NAVE.z2, 'chiseled_stone_bricks');
  b.set(10, 4, NAVE.z2, 'red_stained_glass_pane');
  b.set(10, 5, NAVE.z2, 'yellow_stained_glass_pane');
  b.step('Rosette', 'In den Ostgiebel kommt über dem Altar eine runde Rosette (3 × 3, die Ecken aus Steinziegeltreppen) aus rotem Glas mit gelber Mitte.');
  window(b, { x: NAVE.x2, y: 8, z: 5, facing: 'east', style: 'round', width: 3, glass: 'red_stained_glass_pane', stairs: 'stone_brick_stairs' });
  b.set(NAVE.x2, 9, 5, 'yellow_stained_glass_pane');
  b.step('Chorfenster', 'Unter der Rosette sitzen über dem Altar drei schmale Lanzettfenster: das mittlere 3 hoch, die beiden äußeren 2 hoch, jedes oben mit einem gelben Feld. Darunter sitzt außen je eine umgedrehte Steinziegeltreppe als Fensterbank (hohe Seite zur Wand).');
  for (const [z, h] of [[3, 2], [5, 3], [7, 2]]) {
    for (let k = 0; k < h; k++) b.set(NAVE.x2, 4 + k, z, k === h - 1 ? 'yellow_stained_glass_pane' : 'blue_stained_glass_pane');
    b.set(NAVE.x2 + 1, 3, z, 'stone_brick_stairs[facing=west,half=top]');
  }
}

function tower(b) {
  b.phase('Turm', 'Der Turm steht im Westen: 7 × 7 Blöcke, 18 Ebenen hoch, aus Steinziegeln. Innen trennen zwei Holzböden die Turmhalle, den Zwischenboden und die Glockenstube. Wo das Schiffsdach in den Turm ragt, nimmst du die Dachtreppen vorher heraus.', {
    tips: [
      'Lass in beiden Holzböden an der Nordwand ein Loch für die Leiter.',
      'Ein Gesims aus umgedrehten Treppen unter der Glockenstube gliedert den hohen Turm.',
    ],
  });
  b.fill(TOWER.x1, NAVE.top, TOWER.z1, TOWER.x2, NAVE.top + 6, TOWER.z2, 'air');
  b.step('Turmmauern', 'Mauere den Turm als Ring 18 hoch.');
  wallRing(b, TOWER.x1, TOWER.x2, TOWER.z1, TOWER.z2, 1, TOWER.top);
  b.step('Zwischenböden und Gesims', 'Zieh auf Höhe 7 und 13 Böden aus Fichtenbrettern ein (Leiterloch an der Nordwand). Außen läuft auf Höhe 13 ein Gesims aus umgedrehten Steinziegeltreppen um die West-, Nord- und Südseite.');
  for (const y of [7, 13]) {
    b.fill(TOWER.x1 + 1, y, TOWER.z1 + 1, TOWER.x2 - 1, y, TOWER.z2 - 1, spruce.planks);
    b.set(-3, y, TOWER.z1 + 1, 'air');
  }
  for (let z = TOWER.z1 - 1; z <= TOWER.z2 + 1; z++) b.set(TOWER.x1 - 1, 13, z, 'stone_brick_stairs[facing=east,half=top]');
  for (let x = TOWER.x1; x <= TOWER.x2; x++) {
    b.set(x, 13, TOWER.z1 - 1, 'stone_brick_stairs[facing=south,half=top]');
    b.set(x, 13, TOWER.z2 + 1, 'stone_brick_stairs[facing=north,half=top]');
  }
  b.step('Schallöffnungen', 'Brich in alle vier Seiten der Glockenstube eine Rundbogenöffnung (3 breit, 3 hoch) mit umgedrehten Steinziegeltreppen als Bogen.');
  for (const [x, z, facing] of [[TOWER.x1, 5, 'west'], [TOWER.x2, 5, 'east'], [-3, TOWER.z1, 'north'], [-3, TOWER.z2, 'south']]) {
    arch(b, { x, y: 14, z, facing, width: 3, height: 3, style: 'round', block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  }
}

// Steiler Turmhelm: abwechselnd ein Ring Treppen und ein Ring voller Blöcke, jeder zweite Ring einen Block enger.
function spire(b) {
  b.phase('Turmhelm', 'Der Helm ist steiler als ein normales Dach: auf einen Ring aus Treppen (hohe Seite innen) folgt jeweils ein Ring voller Tiefenschieferfliesen eine Ebene höher und einen Block enger, darauf wieder Treppen. Ganz oben sitzt ein Blitzableiter als Spitze.', {
    tips: [
      'Der unterste Ring steht einen Block über die Turmmauer – so tropft der Regen nicht an der Wand herunter.',
      'Jeder Ring voller Blöcke bekommt innen eine Reihe Tiefenschieferfliesen gleicher Größe eine Ebene tiefer (hinter den Treppen, von außen unsichtbar). Die unterste dieser Reihen liegt direkt auf der Turmmauer – an ihr setzt du auch den Treppenring davor an, sonst hätten die Blöcke keine Fläche zum Anbauen.',
    ],
  });
  const cx = -3;
  const cz = 5;
  let y = TOWER.top + 1;
  for (let s = 4; s >= 1; s--) {
    if (s < 4) {
      ringOf(b, cx, cz, s, y - 1, () => ROOF.full);
      ringOf(b, cx, cz, s, y, () => ROOF.full);
      y++;
    }
    ringOf(b, cx, cz, s, y, (dx, dz) => {
      const facing = Math.abs(dx) === s ? (dx > 0 ? 'west' : 'east') : (dz > 0 ? 'north' : 'south');
      return `${ROOF.stairs}[facing=${facing},half=bottom]`;
    });
    y++;
  }
  b.set(cx, y - 1, cz, ROOF.full);
  b.set(cx, y, cz, ROOF.full);
  b.set(cx, y + 1, cz, `${ROOF.slab}[type=bottom]`);
  b.set(cx, y + 2, cz, 'lightning_rod[facing=up]');
}

function ringOf(b, cx, cz, s, y, stateAt) {
  for (let dx = -s; dx <= s; dx++) {
    for (let dz = -s; dz <= s; dz++) if (Math.abs(dx) === s || Math.abs(dz) === s) b.set(cx + dx, y, cz + dz, stateAt(dx, dz));
  }
}

function towerOpenings(b) {
  b.phase('Portal, Glocke und Turmfenster', 'Das Hauptportal liegt im Westen des Turms. Von der Turmhalle führt ein Spitzbogen ins Schiff, eine Leiter an der Nordwand hinauf zur Glocke.', {
    tips: ['Die Glocke setzt du an die Unterseite des Balkens – dann hängt sie frei (Befestigung „Decke“).'],
  });
  b.step('Portal', 'Setz in die Westseite des Turms eine Fichtentür, darüber ein Fenster aus gelbem Buntglas und als Bogen zwei umgedrehte Steinziegeltreppen mit einem gemeißelten Steinziegel als Schlussstein. Rechts und links hängt je eine Laterne.');
  doorway(b, { x: TOWER.x1, y: 1, z: 5, facing: 'west', door: spruce.door, frame: null });
  b.set(TOWER.x1, 3, 5, 'yellow_stained_glass_pane');
  b.set(TOWER.x1, 3, 4, 'stone_brick_stairs[facing=south,half=top]');
  b.set(TOWER.x1, 3, 6, 'stone_brick_stairs[facing=north,half=top]');
  b.set(TOWER.x1, 4, 5, 'chiseled_stone_bricks');
  wallLantern(b, { x: TOWER.x1, y: 2, z: 3, facing: 'west', style: 'bracket', arm: dark.fence });
  wallLantern(b, { x: TOWER.x1, y: 2, z: 7, facing: 'west', style: 'bracket', arm: dark.fence });
  b.step('Bogen zum Schiff', 'In der gemeinsamen Wand von Turm und Schiff öffnest du einen Spitzbogen, 3 breit und 4 hoch.');
  arch(b, { x: 0, y: 1, z: 5, facing: 'east', width: 3, height: 4, style: 'pointed', block: 'stone_bricks', stairs: 'stone_brick_stairs' });
  b.step('Turmfenster und Leiter', 'Schmale Fenster aus Buntglas erhellen Turmhalle und Zwischenboden. Die Leiter läuft an der Nordwand vom Boden bis in die Glockenstube.');
  for (const [y, h] of [[2, 2], [9, 2]]) {
    for (let k = 0; k < h; k++) {
      b.set(-3, y + k, TOWER.z2, `${k === h - 1 ? 'yellow' : 'blue'}_stained_glass_pane`);
      if (y > 2) b.set(TOWER.x1, y + k, 5, `${k === h - 1 ? 'yellow' : 'blue'}_stained_glass_pane`);
    }
  }
  b.fill(-3, 1, TOWER.z1 + 1, -3, 13, TOWER.z1 + 1, 'ladder[facing=south]');
  b.step('Glocke', 'Leg quer durch die Glockenstube einen Balken aus Schwarzeiche (direkt unter dem Helm) und häng mittig die Glocke darunter.');
  b.fill(TOWER.x1 + 1, TOWER.top, 5, TOWER.x2 - 1, TOWER.top, 5, `${dark.log}[axis=x]`);
  b.set(-3, TOWER.top - 1, 5, 'bell[attachment=ceiling,facing=north]');
  b.note(-3, TOWER.top - 1, 5, 'Glocke: hängt am Balken, im Spiel mit Rechtsklick läuten.');
}

function interior(b) {
  b.phase('Innenraum', 'Richte die Kirche ein: ein roter Läufer in der Mitte, Kirchenbänke links und rechts, vorne im Osten der erhöhte Chor mit dem Altar.', {
    tips: ['Setz die Bänke mit Blick nach Osten – die hohe Seite (Lehne) zeigt dann nach Westen.'],
  });
  b.step('Läufer und Bänke', 'Leg einen roten Teppich vom Bogen bis zum Chor in die Mitte. Sechs Reihen Bänke aus Fichtentreppen stehen links und rechts davon (je 3 lang), mit einer Reihe Abstand dazwischen.');
  for (let x = 1; x <= 15; x++) b.set(x, 1, 5, 'red_carpet');
  for (const x of [4, 6, 8, 10, 12, 14]) {
    for (const z of [2, 3, 4, 6, 7, 8]) b.set(x, 1, z, `${spruce.stairs}[facing=west,half=bottom]`);
  }
  b.step('Chor und Altar', 'Der Chor ist eine Stufe höher: Stufen aus Steinziegeltreppen, dahinter ein Boden aus glattem Quarz. Der Altar an der Ostwand ist aus gemeißeltem Quarz mit Quarztreppen an den Seiten, darauf Kerzen und Maiglöckchen. Davor steht ein Lesepult.');
  for (let z = 1; z <= 9; z++) {
    b.set(16, 1, z, 'stone_brick_stairs[facing=east,half=bottom]');
    for (let x = 17; x <= 19; x++) b.set(x, 1, z, 'smooth_quartz');
  }
  b.set(19, 2, 5, 'chiseled_quartz_block');
  b.set(19, 2, 4, 'quartz_stairs[facing=south,half=top]');
  b.set(19, 2, 6, 'quartz_stairs[facing=north,half=top]');
  b.set(19, 3, 4, 'candle[candles=3,lit=true]');
  b.set(19, 3, 6, 'candle[candles=3,lit=true]');
  b.set(19, 3, 5, 'potted_lily_of_the_valley');
  b.set(17, 2, 3, 'lectern[facing=west]');
  b.step('Turmhalle', 'In der Turmhalle steht ein Taufbecken (Kessel mit Wasser auf gemeißeltem Steinziegel), auf dem Zwischenboden lagern Truhe und Fässer.');
  b.set(-4, 1, 7, 'chiseled_stone_bricks');
  b.set(-4, 2, 7, 'water_cauldron[level=3]');
  b.set(-5, 8, 7, 'chest[facing=east,type=single]');
  b.set(-5, 8, 6, 'barrel[facing=up]');
  b.set(-1, 8, 7, 'barrel[facing=up]');
}

function lights(b) {
  b.phase('Licht', 'Über dem Mittelgang hängen vier Laternen an langen Ketten vom First, im Turm hängt auf jedem Boden eine Laterne. Dann ist in der ganzen Kirche kein Feld dunkel.', {
    tips: ['Setz die Ketten von oben nach unten: erst das Glied direkt unter der Firststufe, dann jeweils eins darunter, zuletzt die Laterne.'],
  });
  b.step('Laternen im Schiff', 'Häng unter die Firststufen über dem Läufer an vier Stellen je sechs Ketten untereinander und darunter eine Laterne – sie hängt dann gut 5 Blöcke über dem Boden.');
  for (const x of [3, 8, 13, 18]) {
    b.fill(x, NAVE.top, 5, x, NAVE.top + 5, 5, 'iron_chain[axis=y]');
    b.set(x, NAVE.top - 1, 5, 'lantern[hanging=true]');
  }
  b.step('Laternen im Turm', 'Turmhalle, Zwischenboden und Glockenstube bekommen je eine Laterne: unten und in der Mitte hängt sie an der Holzdecke, in der Glockenstube steht sie am Boden an der Wand.');
  lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 19, y2: NAVE.top, z2: 9 });
  lightRoom(b, { x1: TOWER.x1 + 1, y1: 1, z1: TOWER.z1 + 1, x2: TOWER.x2 - 1, y2: 6, z2: TOWER.z2 - 1 });
  lightRoom(b, { x1: TOWER.x1 + 1, y1: 8, z1: TOWER.z1 + 1, x2: TOWER.x2 - 1, y2: 12, z2: TOWER.z2 - 1 });
  lightRoom(b, { x1: TOWER.x1 + 1, y1: 14, z1: TOWER.z1 + 1, x2: TOWER.x2 - 1, y2: 17, z2: TOWER.z2 - 1 }, { mode: 'floor' });
}

// Grab: Grabstein an der Nordseite, davor ein Hügel aus Podsol bzw. grober Erde mit einer Blume.
function grave(b, x, z, kind) {
  if (kind === 0) {
    b.set(x, 1, z, 'stone_brick_wall');
    b.set(x, 2, z, 'stone_brick_wall');
    b.set(x - 1, 2, z, 'stone_button[face=wall,facing=west]');
    b.set(x + 1, 2, z, 'stone_button[face=wall,facing=east]');
  } else if (kind === 1) {
    b.set(x, 1, z, 'mossy_stone_brick_wall');
  } else {
    b.set(x, 1, z, 'andesite_wall');
  }
  b.set(x, 0, z + 1, kind === 1 ? 'podzol' : 'coarse_dirt');
  b.set(x, 0, z + 2, kind === 1 ? 'podzol' : 'coarse_dirt');
  if (kind !== 2) b.set(x, 1, z + 2, kind === 0 ? 'poppy' : 'lily_of_the_valley');
}

function cemetery(b) {
  b.phase('Friedhof und Umgebung', 'Südlich der Kirche liegt der Friedhof, eingefasst von einem Fichtenzaun mit Steinpfosten und einem Tor gegenüber der Seitentür. Ein Kiesweg führt vom Portal um den Turm herum.', {
    tips: ['Grabsteine aus Mauern bekommen ein Kreuz, wenn du links und rechts oben je einen Steinknopf an die Mauer setzt.'],
  });
  b.step('Zaun', 'Zieh den Zaun um ein Feld von 15 × 9 Blöcken, 2 Blöcke vor der Südwand. Ecken und Torpfosten sind Steinziegel, auf den Torpfosten stehen Laternen. Vor der Seitentür liegt ein kurzer Pfad zum Tor.');
  gardenFence(b, { x: 17, y: 1, z: 21, facing: 'north', width: 15, depth: 9, fence: spruce.fence, gate: spruce.fenceGate, posts: 'stone_bricks', lanterns: true });
  for (const z of [11, 12]) b.set(10, 0, z, 'dirt_path');
  b.step('Gräber', 'Leg zwei Reihen mit je fünf Gräbern an: Grabstein im Norden (Steinziegelmauer mit Kreuz, bemooste Mauer oder Andesitmauer), davor zwei Blöcke Podsol oder grobe Erde und eine Blume.');
  const xs = [4, 6, 8, 12, 14];
  for (const [row, z] of [[0, 14], [1, 18]]) {
    xs.forEach((x, i) => grave(b, x, z, (i + row * 2) % 3));
  }
  b.step('Weg und Bäume', 'Ein Kiesweg führt vom Portal nach Süden am Friedhof vorbei. Östlich vom Friedhof steht eine Fichte, an der Nordseite der Kirche eine große Eiche.');
  pathAlong(b, { y: 0, points: [[-8, 5], [-8, 22]], width: 3, mix: 'kies', wiggle: 1, seed: 'kirche' });
  tree(b, { x: 22, y: 1, z: 19, species: 'fichte', size: 'mittel', seed: 3 });
  tree(b, { x: 12, y: 1, z: -5, species: 'eiche', size: 'gross', seed: 8 });
  bush(b, { x: 23, y: 1, z: -3, size: 'mittel', seed: 4 });
  bush(b, { x: -12, y: 1, z: -3, size: 'klein', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: -14, y: 2, z: -12, width: 41, depth: 38, mix: 'wiese', density: 0.2, shape: 'eckig', seed: 17 });
}

export default function build(b) {
  groundAndFloor(b);
  nave(b);
  naveWindows(b);
  tower(b);
  spire(b);
  towerOpenings(b);
  interior(b);
  lights(b);
  cemetery(b);
}
