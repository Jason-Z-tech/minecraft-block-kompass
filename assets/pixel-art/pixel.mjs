// ASCII-Pixelraster → SVG-Pfade (Rechtecke zusammengefasst, ganzzahlige Koordinaten).

// Fasst gleiche Pixel zu Rechtecken zusammen: erst waagrechte Läufe, dann nach unten verlängern,
// solange die Zeile darunter auf voller Breite dasselbe Zeichen hat.
export function rectsFor(grid, ch) {
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const used = grid.map((row) => [...row.padEnd(w, '.')].map((c) => c !== ch));
  const rects = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (used[y][x]) continue;
      let x2 = x;
      while (x2 + 1 < w && !used[y][x2 + 1]) x2++;
      let y2 = y;
      outer: while (y2 + 1 < h) {
        for (let i = x; i <= x2; i++) if (used[y2 + 1][i]) break outer;
        y2++;
      }
      for (let yy = y; yy <= y2; yy++) for (let i = x; i <= x2; i++) used[yy][i] = true;
      rects.push([x, y, x2 - x + 1, y2 - y + 1]);
    }
  }
  return rects;
}

export function pathFor(grid, ch, ox = 0, oy = 0) {
  return rectsFor(grid, ch).map(([x, y, w, h]) => `M${x + ox} ${y + oy}h${w}v${h}h${-w}z`).join('');
}

export function checkGrid(name, grid, w, h) {
  if (grid.length !== h) throw new Error(`${name}: ${grid.length} Zeilen statt ${h}`);
  grid.forEach((row, i) => { if (row.length !== w) throw new Error(`${name}: Zeile ${i} hat ${row.length} statt ${w} Zeichen: "${row}"`); });
}

// palette: { char: { fill, opacity? } } – Reihenfolge = Zeichenreihenfolge
export function layers(grid, palette, { ox = 0, oy = 0 } = {}) {
  const out = [];
  for (const [ch, style] of Object.entries(palette)) {
    const d = pathFor(grid, ch, ox, oy);
    if (!d) continue;
    const opacity = style.opacity !== undefined && style.opacity !== 1 ? ` opacity="${style.opacity}"` : '';
    out.push(`<path fill="${style.fill}"${opacity} d="${d}"/>`);
  }
  return out.join('');
}
