// Wasser-Aufzug: zwei Glasschächte nebeneinander. Links Seelensand → Blasensäule nach oben,
// rechts Magmablock → Blasensäule nach unten. Oben eine überdachte Plattform als Ausstieg.
// Lokale Koordinaten: Wiese bis y = 0, Aufwärts-Schacht (0, 1…14, 0), Abwärts-Schacht (2, 1…14, 0),
// Türen im Süden (z = 1). Vorderseite = Süden.

import { WOOD, terrain, path, flowerBed, bush, vegetation, wallLantern, hangingLantern } from '../lib/index.js';

export const meta = {
  id: 'wasser-aufzug',
  title: 'Wasser-Aufzug',
  category: 'farmen',
  subtitle: 'Blasensäulen hoch und runter im Glasschacht',
  tags: ['Aufzug', 'Wasser', 'Blasensäule', 'Seelensand', 'Magmablock', 'Technik', 'Anfänger', 'Ohne Redstone'],
  aliases: [
    'wasser-aufzug', 'wasseraufzug', 'wasser aufzug', 'wasserlift', 'wasser lift', 'blasenaufzug', 'blasensäule',
    'blasensaeule', 'seelensand aufzug', 'magma aufzug', 'aufzug', 'fahrstuhl', 'wasserfahrstuhl', 'water elevator',
    'bubble elevator', 'bubble column elevator', 'soul sand elevator', 'elevator', 'wasseraufzg', 'wasser auf zug',
  ],
  accuracy: 'vorlage',
  difficulty: 1,
  description: 'Zwei Glasschächte voller Wasserquellen: Unter dem linken liegt Seelensand, er macht eine Blasensäule, die dich nach oben trägt. Unter dem rechten liegt ein Magmablock, seine Blasensäule zieht dich schnell nach unten. Unten gehst du durch eine Tür hinein, oben steigst du auf eine kleine, überdachte Plattform aus. Das Wichtigste ist, dass jeder Schacht von unten bis oben aus Wasserquellen besteht – die Anleitung zeigt, wie das mit Seetang ganz einfach geht.',
  facts: [
    'Seelensand macht eine Blasensäule nach oben, ein Magmablock eine nach unten – beide nur durch Wasserquellen, nicht durch fließendes Wasser.',
    'In einer Blasensäule geht dir die Luft nicht aus, du kannst also beliebig hoch bauen.',
    'Türen halten Wasser auf: Darum läuft unten nichts aus, obwohl die Tür direkt am Wasser steht.',
    'Ein Magmablock macht keinen Schaden, solange du schleichst.',
  ],
  sources: [
    { title: 'Minecraft Wiki: Blasensäule (englisch)', url: 'https://minecraft.wiki/w/Bubble_Column' },
    { title: 'Minecraft Wiki: Seetang (englisch)', url: 'https://minecraft.wiki/w/Kelp' },
  ],
  credits: null,
  tested: false,
};

const spruce = WOOD.fichte;
const TOP = 14; // oberste Wasserquelle = Höhe der Plattform
const HEIGHT = 16; // oberste Wandebene
const UP_X = 0;
const DOWN_X = 2;
const WATER = 'water[level=0]';
const BASE = 'polished_andesite';
const TRIM = 'stone_bricks';
const BANDS = [6, 11];

const POSTS = [[-1, -1], [3, -1], [-1, 1], [3, 1]];
// Glas: Seiten und Trennwand (x = −1, 1, 3 bei z = 0) und Rückseite (z = −1); die Vorderseite hat Türen und Ausstieg.
const SIDE_GLASS = [[-1, 0], [1, 0], [3, 0]];
const BACK_GLASS = [[UP_X, -1], [1, -1], [DOWN_X, -1]];

function wallBlock(y, axis) {
  return BANDS.includes(y) ? `${spruce.strippedLog}[axis=${axis}]` : 'glass';
}

function foundation(b) {
  b.phase('Fundament', 'Der Aufzug steht auf einem kleinen Sockel aus poliertem Andesit, 7 × 5 Blöcke groß. In den Sockel kommen die beiden Blöcke, die später die Blasen machen.', {
    tips: ['Seelensand findest du im Nether, vor allem in Seelensandtälern. Ein einziger Block reicht für einen Aufzug.'],
  });
  terrain(b, { x: -7, y: -1, z: -6, width: 17, depth: 17, height: 1, seed: 'wasser-aufzug' });
  b.step('Sockel', 'Lege den Sockel auf Ebene 1 in den Boden: poliertes Andesit von x = −2 bis 4 und z = −2 bis 2, außen ein Rand aus Steinziegeln.');
  for (let x = -2; x <= 4; x++) {
    for (let z = -2; z <= 2; z++) {
      const edge = x === -2 || x === 4 || z === -2 || z === 2;
      b.set(x, 0, z, edge ? TRIM : BASE);
    }
  }
  b.step('Seelensand und Hilfsblock', 'Setz unter den linken Schacht (x = 0, z = 0) einen Seelensand. Unter den rechten Schacht (x = 2) kommt vorerst ein normaler Steinziegel als Platzhalter – den tauschst du erst ganz am Ende gegen den Magmablock, weil Seetang nicht auf Magma hält.');
  b.set(UP_X, 0, 0, 'soul_sand');
  b.set(DOWN_X, 0, 0, TRIM);
  b.note(UP_X, 0, 0, 'Seelensand: Blasen nach oben');
}

function shafts(b) {
  b.phase('Glasschächte', 'Jetzt mauerst du die beiden Schächte hoch: vier Fichtenstämme als Ecken, dazwischen Glas. Eine Glaswand in der Mitte trennt die beiden Schächte, jeder ist innen nur einen Block breit.', {
    tips: [
      'Setz zuerst die vier Stämme ein paar Ebenen hoch und füll dann das Glas dazwischen – so bleibt alles gerade.',
      'Zum Hochbauen stellst du dich am besten in den Schacht und baust unter dir weiter (Block unter die Füße beim Springen).',
    ],
  });
  b.step('Ecksäulen', `Stell vier Fichtenstämme senkrecht auf die Ecken (x = −1 und 3, z = −1 und 1) und mauere sie bis Ebene ${HEIGHT + 1} hoch.`);
  for (const [x, z] of POSTS) for (let y = 1; y <= HEIGHT; y++) b.set(x, y, z, `${spruce.log}[axis=y]`);

  b.step('Glaswände', `Füll die Seiten, die Trennwand in der Mitte und die Rückseite mit Glas bis Ebene ${HEIGHT + 1}. Auf Ebene ${BANDS[0] + 1} und ${BANDS[1] + 1} kommt statt Glas ein Ring aus liegenden, geschälten Fichtenstämmen – das sieht gut aus und hält genauso dicht.`);
  for (let y = 1; y <= HEIGHT; y++) {
    for (const [x, z] of SIDE_GLASS) b.set(x, y, z, wallBlock(y, 'z'));
    for (const [x, z] of BACK_GLASS) b.set(x, y, z, wallBlock(y, 'x'));
  }

  b.step('Vorderseite', `Auf der Vorderseite bleiben unten die zwei Türöffnungen (Ebene 2 und 3) und oben der Ausstieg (Ebene ${TOP + 2} und ${TOP + 3}) frei. Zwischen den Türen (x = 1) kommt Glas. Auf Ebene 4 liegt quer über die ganze Front ein geschälter Stamm als Türsturz, darüber bis Ebene ${TOP} Glas mit den beiden Holzringen. Auch zwischen den Ausstiegen (x = 1) steht oben Glas.`);
  b.set(1, 1, 1, 'glass');
  b.set(1, 2, 1, 'glass');
  for (const x of [UP_X, 1, DOWN_X]) {
    b.set(x, 3, 1, `${spruce.strippedLog}[axis=x]`);
    for (let y = 4; y < TOP; y++) b.set(x, y, 1, wallBlock(y, 'x'));
  }
  for (let y = TOP + 1; y <= HEIGHT; y++) b.set(1, y, 1, 'glass');
}

function landing(b) {
  b.phase('Plattform und Dach', `Oben steigst du auf eine kleine Plattform aus. Ihr Boden liegt auf Ebene ${TOP + 1}, genau auf Höhe der obersten Wasserquelle – die Blasen schieben dich so weit hoch, dass du einfach nach vorne hinausgehen kannst.`, {
    tips: ['Baue die Plattform, bevor Wasser im Schacht ist: Dann kannst du noch bequem im leeren Schacht hochklettern.'],
  });
  b.step('Boden', `Leg den Plattformboden aus Fichtenbrettern auf Ebene ${TOP + 1}: direkt vor den Schächten (z = 1, x = 0 bis 2) und zwei Reihen davor (z = 2 und 3, x = −1 bis 3). Die Bretter vor den Schächten halten oben das Wasser fest.`);
  for (const x of [UP_X, 1, DOWN_X]) b.set(x, TOP, 1, spruce.planks);
  for (let x = -1; x <= 3; x++) for (const z of [2, 3]) b.set(x, TOP, z, spruce.planks);

  b.step('Konsolen', `Setz unter den Rand der Plattform (Ebene ${TOP}, z = 2) eine Reihe Fichtentreppen, umgedreht (obere Hälfte), mit der hohen Seite zum Turm. Am einfachsten zielst du dafür auf die obere Hälfte der Glaswand.`);
  for (let x = -1; x <= 3; x++) b.stairs(x, TOP - 1, 2, spruce.stairs, { facing: 'north', half: 'top' });

  b.step('Geländer und Pfosten', `Stell an die beiden vorderen Ecken (x = −1 und 3, z = 3) Fichtenstämme von Ebene ${TOP + 2} bis ${HEIGHT + 1}. Dazwischen und an den Seiten kommt ein Zaun auf Ebene ${TOP + 2}.`);
  for (const x of [-1, 3]) for (let y = TOP + 1; y <= HEIGHT; y++) b.set(x, y, 3, `${spruce.log}[axis=y]`);
  for (let x = 0; x <= 2; x++) b.set(x, TOP + 1, 3, spruce.fence);
  for (const x of [-1, 3]) b.set(x, TOP + 1, 2, spruce.fence);

  b.step('Dach', `Das Walmdach ist eine kleine Pyramide aus Fichtentreppen mit einem Block Überstand. Die unterste Reihe liegt auf Ebene ${HEIGHT + 1} rund um die Säulen, jede Reihe nach innen eine Ebene höher, ganz oben eine Fichtenstufe.`);
  b.roof({ x1: -1, z1: -1, x2: 3, z2: 3, y: HEIGHT, type: 'pyramid', stairs: spruce.stairs, slab: spruce.slab, full: spruce.planks, overhang: 1 });
  b.note(UP_X, TOP + 1, 0, 'Ausstieg: oben nach vorne hinausgehen');
}

function doors(b) {
  b.phase('Türen', 'Die beiden Türen unten halten das Wasser im Schacht: Wasser fließt nie in eine Tür hinein, auch wenn sie offen steht.', {
    tips: ['Setz die Türen von außen, mit Blick nach Norden auf den Turm.'],
  });
  b.step('Fichtentüren', 'Setz in beide Öffnungen auf Ebene 2 eine Fichtentür – links für „hoch“, rechts für „runter“. Die Scharniere liegen außen, so öffnen sich die Türen zur Mitte hin.');
  b.door(UP_X, 1, 1, spruce.door, { facing: 'north', hinge: 'left' });
  b.door(DOWN_X, 1, 1, spruce.door, { facing: 'north', hinge: 'right' });
  b.note(UP_X, 1, 1, 'Tür „hoch“ (Seelensand)');
  b.note(DOWN_X, 1, 1, 'Tür „runter“ (Magmablock)');
}

function water(b) {
  b.phase('Wasser einfüllen', `Jeder Schacht muss von Ebene 2 bis ${TOP + 1} aus lauter Wasserquellen bestehen – fließendes Wasser macht keine Blasen. Der einfachste Weg führt über Seetang: Seetang verwandelt fließendes Wasser in eine Quelle, und wenn du ihn wieder abbrichst, bleibt die Quelle stehen.`, {
    tips: [
      'Seetang findest du in fast jedem Ozean. Du brauchst etwa 15 Stück pro Schacht.',
      'Halte beim Abbauen des untersten Seetangs Abstand: Der ganze Stängel zerfällt auf einmal und lässt lauter Quellen zurück.',
      'Steig erst in den Schacht, wenn die Blasen sichtbar sind – dann stimmt die Säule.',
    ],
  });
  b.step('Linker Schacht (hoch)', `Gieß einen Eimer Wasser oben in den linken Schacht (Ebene ${TOP + 1}). Das Wasser fällt bis auf den Seelensand. Jetzt setz Seetang auf den Seelensand und danach immer einen weiteren auf den vorigen, bis der Seetang Ebene ${TOP + 1} erreicht. Brich dann durch die offene Tür den untersten Seetang ab: Alles darüber zerfällt, übrig bleiben Wasserquellen – und sofort steigen Blasen auf.`);
  for (let y = 1; y <= TOP; y++) b.set(UP_X, y, 0, WATER);
  b.step('Rechter Schacht (runter)', `Seetang hält nicht auf Magma, darum steht dort noch der Steinziegel – auf ihm wächst Seetang ganz normal. Gieß oben Wasser hinein und mach dasselbe wie links: Seetang vom Steinziegel bis Ebene ${TOP + 1}, dann den untersten abbrechen. Zum Schluss öffnest du die rechte Tür, stellst dich davor und baust von außen schräg nach unten den Steinziegel im Schachtboden ab. Setz sofort den Magmablock an seine Stelle – die Wasserquellen darüber bleiben, und die Blasen ziehen jetzt nach unten. Stell dich dafür nicht in den Schacht: Stehst du auf dem Steinziegel, fällst du beim Abbauen selbst in das Loch.`);
  for (let y = 1; y <= TOP; y++) b.set(DOWN_X, y, 0, WATER);
  b.set(DOWN_X, 0, 0, 'magma_block');
  b.note(DOWN_X, 0, 0, 'Magmablock: zieht nach unten – unten schleichen, dann kein Schaden');
}

function surroundings(b) {
  b.phase('Licht und Umgebung', 'Laternen an der Tür und unter dem Dach, dazu ein Weg und ein paar Blumen.', {
    tips: ['Monster spawnen in 26.2 nur bei Blocklicht 0 – mit den beiden Laternen bleibt der Eingang und die Plattform hell.'],
  });
  b.step('Laternen', `Setz an die beiden vorderen Eckstämme je eine Laterne an einem Zaun-Arm (Arm auf Ebene 4, Laterne hängt auf Ebene 3). Unter die Dachspitze kommt eine hängende Laterne über der Plattform.`);
  wallLantern(b, { x: -1, y: 2, z: 1, facing: 'south', arm: spruce.fence });
  wallLantern(b, { x: 3, y: 2, z: 1, facing: 'south', arm: spruce.fence });
  hangingLantern(b, { x: 1, y: HEIGHT + 1, z: 2, chain: 0 });

  b.step('Weg und Garten', 'Leg einen Trampelpfad von Süden zu den Türen, ein Blumenbeet an die Seiten und zwei kleine Büsche dahinter.');
  path(b, { x: 1, y: 0, z: 3, facing: 'south', length: 7, width: 3, mix: 'erde', wiggle: 0.5, seed: 4 });
  flowerBed(b, { x: -5, y: 0, z: -2, width: 2, depth: 5, facing: 'west', palette: 'kuehl', seed: 2 });
  flowerBed(b, { x: 6, y: 0, z: -2, width: 2, depth: 5, facing: 'east', palette: 'kuehl', seed: 3 });
  bush(b, { x: -4, y: 1, z: -4, size: 'klein', leaves: 'eiche', seed: 1 });
  bush(b, { x: 6, y: 1, z: -4, size: 'klein', leaves: 'azalee', seed: 6 });
  vegetation(b, { x: -7, y: 0, z: -6, width: 17, depth: 17, mix: 'wiese', density: 0.3, seed: 9 });
}

export default function build(b) {
  foundation(b);
  shafts(b);
  landing(b);
  doors(b);
  water(b);
  surroundings(b);
}
