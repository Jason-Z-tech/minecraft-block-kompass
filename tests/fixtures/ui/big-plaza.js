// Testbau für die Bau-Seite (nur Tests): großer Platz mit 150 × 150 Feldern und zwei Maßstäben, um
// Maßstab-Wechsel, Ebenen-Plan bei 150 × 150 und die Bildrate beim Abspielen eines großen Baus zu prüfen.
// Enthält Treppen, Stufen, Glas, Laub, Blumen, Wasser und Fackeln (verschiedene Draufsichten und Icons).

export const meta = {
  id: 'big-plaza',
  title: 'Großer Testplatz',
  category: 'wahrzeichen',
  subtitle: 'Testbau mit 150 × 150 Feldern',
  tags: ['Test', 'Groß'],
  aliases: ['testplatz'],
  accuracy: 'massstab',
  difficulty: 3,
  description: 'Ein großer Platz mit Türmen, Kuppel, Teich und Garten – nur für Tests der Bau-Seite.',
  facts: ['150 × 150 Felder bei 1:1'],
  sources: [{ title: 'Minecraft Wiki: Steinziegel', url: 'https://minecraft.wiki/w/Stone_Bricks' }],
  credits: null,
  scales: [1, 0.5],
  tested: null,
};

export default function build(b, { scale = 1 } = {}) {
  const size = Math.round(150 * scale);
  const max = size - 1;
  const s = (value) => Math.max(1, Math.round(value * scale));

  b.phase('Untergrund', 'Fülle den Untergrund mit Stein und Erde, oben Steinziegel.', { tips: ['Arbeite Reihe für Reihe von Norden nach Süden.'] });
  b.fill(0, 0, 0, max, 0, max, 'stone');
  b.fill(0, 1, 0, max, 1, max, 'dirt');
  b.fill(0, 2, 0, max, 2, max, 'stone_bricks');
  b.fill(0, 2, 0, max, 2, max, 'polished_andesite', { outline: true });

  b.phase('Mauer', 'Setze eine Mauer aus Steinziegeln rund um den Platz.');
  b.walls(0, 3, 0, max, 3 + s(8), max, 'stone_bricks');
  for (let x = 0; x <= max; x += 2) {
    b.set(x, 4 + s(8), 0, 'stone_brick_wall');
    b.set(x, 4 + s(8), max, 'stone_brick_wall');
  }

  b.phase('Türme', 'Baue an jede Ecke einen runden Turm.');
  const r = s(8);
  for (const [cx, cz] of [[r, r], [max - r, r], [r, max - r], [max - r, max - r]]) {
    b.cylinder(cx, 3, cz, r, s(30), 'cobblestone', { hollow: true });
    b.cone(cx, 3 + s(30), cz, r, 0, s(10), 'dark_oak_planks');
  }

  b.phase('Kuppel', 'Setze in die Mitte eine Kuppel aus Glas auf einem Ring aus Treppen.');
  const c = Math.floor(max / 2);
  const dome = s(22);
  b.sphere(c, 3, c, dome, 'light_blue_stained_glass', { hollow: true, part: 'top' });
  b.disc(c, 3, c, dome + 1, 'smooth_stone_slab', { hollow: true });
  b.note(c, 3 + dome, c, 'Höchster Punkt der Kuppel');

  b.phase('Garten', 'Leg den Teich an, pflanze Bäume und Blumen.');
  b.step('Teich', 'Grab den Teich aus und füll ihn mit Wasser.');
  b.fill(s(30), 2, s(100), s(50), 2, s(120), 'water');
  b.step('Bäume', 'Setze Eichen in zwei Reihen.');
  for (let i = 0; i < 6; i++) {
    const x = s(20 + i * 18), z = s(30);
    b.fill(x, 3, z, x, 3 + s(5), z, 'oak_log[axis=y]');
    b.sphere(x, 3 + s(6), z, s(3), 'oak_leaves');
  }
  b.step('Blumen', 'Pflanze Blumen und stelle Fackeln auf.');
  for (let i = 0; i < 200 * scale; i++) {
    const x = b.rngInt(s(60), s(130)), z = b.rngInt(s(90), s(135));
    b.set(x, 3, z, b.pick(['poppy', 'dandelion', 'blue_orchid', 'oxeye_daisy']));
  }
  for (let x = s(12); x < max - s(12); x += s(12)) b.set(x, 3, s(12), 'torch');
  b.note(s(40), 3, s(110), 'Teich');
}
