// Ebenen-Plan, reine Teile (in Node testbar): Zellen einer Ebene aus dem Volumen lesen, Zustand je Zelle
// (fertig / aktueller Schritt / später), Ansicht einpassen, zoomen, Lineal-Abstände.

export const CELL_DONE = 1;
export const CELL_CURRENT = 2;
export const CELL_LATER = 3;
export const MIN_CELL_PX = 2;
export const MAX_CELL_PX = 96;

/**
 * Zellen der Ebene y: indices (Paletten-Index, 0 = Luft) und steps (Schritt, −1 = leer), Reihenfolge z (außen) → x.
 * below: belegte Zellen der Ebene darunter (zur Orientierung). size = [Breite, Höhe, Länge] des Baus.
 */
export function readLayer(volume, size, y) {
  const [width, , length] = size;
  const count = width * length;
  const indices = new Uint16Array(count);
  const steps = new Int32Array(count).fill(-1);
  const below = new Uint8Array(count);
  const used = new Set();
  let blocks = 0;
  for (let z = 0; z < length; z++) {
    for (let x = 0; x < width; x++) {
      const i = z * width + x;
      const index = volume.getIndex(x, y, z);
      if (index) {
        indices[i] = index;
        steps[i] = volume.getStep(x, y, z);
        used.add(index);
        blocks++;
      } else if (y > 0 && volume.getIndex(x, y - 1, z)) {
        below[i] = 1;
      }
    }
  }
  return { y, width, length, indices, steps, below, used: [...used].sort((a, b) => a - b), blocks };
}

/** Zustand einer Zelle bei angezeigtem Schritt shown (−1 = Start). 0 = leer. */
export function cellStatus(step, shown) {
  if (step < 0) return 0;
  if (step < shown) return CELL_DONE;
  if (step === shown) return CELL_CURRENT;
  return CELL_LATER;
}

/** Zählt fertig/aktuell/später einer Ebene. */
export function layerCounts(layer, shown) {
  const counts = { done: 0, current: 0, later: 0 };
  for (const step of layer.steps) {
    const status = cellStatus(step, shown);
    if (status === CELL_DONE) counts.done++;
    else if (status === CELL_CURRENT) counts.current++;
    else if (status === CELL_LATER) counts.later++;
  }
  return counts;
}

/** Ansicht so, dass cols × rows Zellen mittig in width × height passen (mit Rand). */
export function fitView(width, height, cols, rows, margin = 16) {
  const cell = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.min((width - 2 * margin) / cols, (height - 2 * margin) / rows)));
  return { cell, x: (width - cols * cell) / 2, y: (height - rows * cell) / 2 };
}

/** Zoom um den Punkt (px, py): der Punkt bleibt unter dem Zeiger. */
export function zoomAt(view, factor, px, py) {
  const cell = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, view.cell * factor));
  const ratio = cell / view.cell;
  return { cell, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/** Ansicht so begrenzen, dass immer ein Teil des Plans sichtbar bleibt. */
export function clampView(view, width, height, cols, rows, keep = 48) {
  const w = cols * view.cell, h = rows * view.cell;
  return {
    cell: view.cell,
    x: Math.min(width - Math.min(keep, w), Math.max(Math.min(keep, w) - w, view.x)),
    y: Math.min(height - Math.min(keep, h), Math.max(Math.min(keep, h) - h, view.y)),
  };
}

/** Zelle unter einem Punkt oder null. */
export function cellAt(view, px, py, cols, rows) {
  const x = Math.floor((px - view.x) / view.cell);
  const z = Math.floor((py - view.y) / view.cell);
  return x >= 0 && z >= 0 && x < cols && z < rows ? { x, z } : null;
}

/** Abstand der Lineal-Beschriftung (in Zellen), damit Zahlen mindestens minPx auseinander liegen. */
export function rulerStep(cellPx, minPx = 28) {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (step * cellPx >= minPx) return step;
  return 1000;
}

/**
 * Auflösung der vorgerenderten Ebene: 16 px je Zelle, bei großen Ebenen weniger (Speicher). Zusätzlich keine Kante über
 * maxEdge Pixel (Grenze vieler Handy-GPUs; die Golden Gate 1:1 hat Ebenen mit über 10 000 Feldern Länge) – dann auch
 * weniger als 1 px je Feld.
 */
export function bakeResolution(cols, rows, maxPixels = 4_200_000, maxEdge = 4096) {
  const edge = Math.max(cols, rows);
  for (const tile of [16, 8, 4, 2, 1]) if (cols * rows * tile * tile <= maxPixels && edge * tile <= maxEdge) return tile;
  return Math.min(maxEdge / edge, Math.sqrt(maxPixels / (cols * rows)));
}

/** Mittlere Farbe einer Draufsicht-Kachel (RGBA-Bytes) über Hintergrund bg ([r, g, b]) → [r, g, b] (0–255, gerundet). */
export function averageTileColor(data, bg) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    r += data[i] * a + bg[0] * (1 - a);
    g += data[i + 1] * a + bg[1] * (1 - a);
    b += data[i + 2] * a + bg[2] * (1 - a);
    n++;
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [...bg];
}
