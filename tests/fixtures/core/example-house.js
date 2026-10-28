// Beleg-Modul für den Kern: kleines Haus mit Satteldach, Tür, Bett, Fenstern, Zaun und Doppeltruhe.
// Nutzt nur Blöcke aus tests/fixtures/core/blocks.json (die es auch in Minecraft 26.2 gibt).

export const meta = {
  id: 'example-house',
  title: 'Beispielhaus',
  category: 'haeuser',
  subtitle: 'Kleines Holzhaus mit Satteldach und Vorgarten',
  tags: ['Holz', 'Starterhaus', 'Klein'],
  aliases: ['beispielhaus', 'starterhaus', 'kleines haus'],
  accuracy: 'eigenes',
  description: 'Ein kleines Haus aus Eichenholz mit Fichtenholz-Satteldach. Drinnen stehen ein Bett, eine Doppeltruhe und eine Fackel, vor dem Haus liegt ein umzäunter Vorgarten.',
  sources: [],
  credits: null,
  tested: null,
};

const W = 8; // x 0 … 8
const D = 6; // z 0 … 6
const WALL_TOP = 4;

export default function build(b) {
  b.phase('Fundament');
  b.fill(0, 0, 0, W, 0, D, 'cobblestone');

  b.phase('Wände');
  b.walls(0, 1, 0, W, WALL_TOP, D, 'oak_planks');
  for (const [x, z] of [[0, 0], [W, 0], [0, D], [W, D]]) b.fill(x, 1, z, x, WALL_TOP, z, 'oak_log[axis=y]');

  b.phase('Tür und Fenster');
  b.step(); // Tür in die Mitte der Nordwand
  b.door(4, 1, 0, 'oak_door', { facing: 'south', hinge: 'left' });
  b.step(); // Fenster
  for (const [x, z] of [[2, 0], [6, 0], [2, D], [6, D], [0, 3], [W, 3]]) b.set(x, 2, z, 'glass_pane');

  b.phase('Dach');
  b.roof({ x1: 0, z1: 0, x2: W, z2: D, y: WALL_TOP, type: 'gable', axis: 'x', stairs: 'spruce_stairs', slab: 'spruce_slab', full: 'spruce_planks', overhang: 1 });

  b.phase('Einrichtung');
  b.step(); // Bett
  b.bed(2, 1, 4, 'red_bed', { facing: 'west' });
  b.step(); // Doppeltruhe
  b.set(6, 1, 5, 'chest[facing=north]');
  b.set(7, 1, 5, 'chest[facing=north]');
  b.step(); // Licht
  b.set(4, 3, 5, 'wall_torch[facing=north]');

  b.phase('Vorgarten');
  for (let x = -1; x <= W + 1; x++) b.set(x, 1, -3, x === 4 ? 'oak_fence_gate[facing=south]' : 'oak_fence');
  for (const x of [-1, W + 1]) for (let z = -2; z <= -1; z++) b.set(x, 1, z, 'oak_fence');
  b.fill(-1, 0, -3, W + 1, 0, -1, 'grass_block');
  b.tall(1, 1, -2, 'sunflower');
  b.set(7, 1, -2, 'poppy');
}
