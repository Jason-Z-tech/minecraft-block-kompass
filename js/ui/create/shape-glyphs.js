// Kleine Pixel-Symbole (10 × 10) für die Formen im Formen-Generator. „#“ = Fläche, „+“ = Lichtkante, „-“ = Schatten.
// Gezeichnet mit svgEl aus Rechtecken (Farbe über CSS: fill = currentColor, Licht/Schatten über Klassen).
import { svgEl } from '../dom.js';

const GLYPHS = Object.freeze({
  sphere: [
    '...+++....',
    '..+####...',
    '.+######..',
    '.########.',
    '+########-',
    '+########-',
    '.#######-.',
    '.-######-.',
    '..-####-..',
    '....--....',
  ],
  dome: [
    '..........',
    '..........',
    '...++++...',
    '..+####-..',
    '.+######-.',
    '.########.',
    '+########-',
    '+########-',
    '##########',
    '----------',
  ],
  cylinder: [
    '..++++++..',
    '.+######-.',
    '.-######-.',
    '.+######-.',
    '.#######-.',
    '.#######-.',
    '.#######-.',
    '.#######-.',
    '.-######-.',
    '..------..',
  ],
  cone: [
    '....++....',
    '....##....',
    '...+##-...',
    '...###-...',
    '..+####-..',
    '..#####-..',
    '.+######-.',
    '.#######-.',
    '+########-',
    '----------',
  ],
  pyramid: [
    '..........',
    '....++....',
    '....##....',
    '...+##-...',
    '...####...',
    '..+####-..',
    '..######..',
    '.+######-.',
    '.########.',
    '----------',
  ],
  cube: [
    '..........',
    '.+++++++..',
    '.+######-.',
    '.+######-.',
    '.+######-.',
    '.+######-.',
    '.+######-.',
    '.+######-.',
    '.--------.',
    '..........',
  ],
  cuboid: [
    '..........',
    '..........',
    '++++++++++',
    '+########-',
    '+########-',
    '+########-',
    '+########-',
    '----------',
    '..........',
    '..........',
  ],
  ellipsoid: [
    '..........',
    '...++++...',
    '.++#####..',
    '+#######-.',
    '+########-',
    '+########-',
    '.#######-.',
    '..-####--.',
    '...----...',
    '..........',
  ],
  torus: [
    '..........',
    '..++++++..',
    '.+######-.',
    '+##-..+##-',
    '+#-....##-',
    '+##+..-##-',
    '.-######-.',
    '..------..',
    '..........',
    '..........',
  ],
  circle: [
    '..........',
    '..........',
    '...++++...',
    '.++....++.',
    '+........-',
    '+........-',
    '.--....--.',
    '...----...',
    '..........',
    '..........',
  ],
  arch: [
    '.++++++++.',
    '+########-',
    '+###--###-',
    '+##-..+##-',
    '+##....##-',
    '+##....##-',
    '+##....##-',
    '+##....##-',
    '+##....##-',
    '---....---',
  ],
  'spiral-stairs': [
    '....##....',
    '..++##....',
    '..--##....',
    '....##++..',
    '....##--..',
    '..++##....',
    '..--##....',
    '....##++..',
    '....##--..',
    '....##....',
  ],
});

const CLASSES = { '#': 'shape-glyph__body', '+': 'shape-glyph__light', '-': 'shape-glyph__shade' };

/** SVG-Symbol einer Form (dekorativ, aria-hidden). Unbekannte Form → Würfel. */
export function shapeGlyph(shapeId, { size = 40 } = {}) {
  const rows = GLYPHS[shapeId] ?? GLYPHS.cube;
  const rects = [];
  rows.forEach((row, y) => {
    // Gleiche Zeichen nebeneinander zu einem Rechteck zusammenfassen
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === char) end++;
      if (CLASSES[char]) rects.push(svgEl('rect', { class: CLASSES[char], x, y, width: end - x, height: 1 }));
      x = end;
    }
  });
  return svgEl('svg', { class: 'shape-glyph', viewBox: '0 0 10 10', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' }, rects);
}

export const SHAPE_GLYPH_IDS = Object.freeze(Object.keys(GLYPHS));
