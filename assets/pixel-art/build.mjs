// Erzeugt alle Pixel-Grafiken des Block-Kompass aus den ASCII-Quellen in diesem Ordner:
// assets/icons.svg, logo.svg, favicon.svg, patterns/*.svg und ui/*.svg.
// Aufruf (im Projektordner): node assets/pixel-art/build.mjs
// Neues Icon: Raster in art.mjs ergänzen, Namen in ICON_NAMES (js/ui/shared.js) eintragen, Skript laufen lassen.
// tests/unit/ui-pixel-art.test.mjs prüft, dass die SVG-Dateien zu den Quellen passen.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ICONS, DRIP } from './art.mjs';
import { pathFor, checkGrid, layers } from './pixel.mjs';
import { LOGO_32, FAVICON_16, LOGO_PALETTE } from './logo.mjs';
import { terrain, TERRAIN_PALETTE, deepslate, DEEPSLATE_PALETTE } from './patterns.mjs';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Schattierung der Icons als Überlagerung über currentColor
const OVERLAYS = {
  '%': { fill: '#000', opacity: '.22' },
  '+': { fill: '#000', opacity: '.45' },
  'o': { fill: '#fff', opacity: '.38' },
};

function iconBody(name, grid) {
  checkGrid(name, grid, 16, 16);
  const base = grid.map((row) => row.replace(/[^.]/g, '#'));
  let body = `<path fill="currentColor" d="${pathFor(base, '#')}"/>`;
  for (const [ch, style] of Object.entries(OVERLAYS)) {
    const d = pathFor(grid, ch);
    if (d) body += `<path fill="${style.fill}" opacity="${style.opacity}" d="${d}"/>`;
  }
  return body;
}

function pixelSvg(grid, palette, { width, height, title = '', preserve = '' }) {
  const h = grid.length;
  const w = grid[0].length;
  checkGrid(title || 'svg', grid, w, h);
  const titleTag = title ? `<title>${title}</title>` : '';
  const par = preserve ? ` preserveAspectRatio="${preserve}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${width}" height="${height}"${par} shape-rendering="crispEdges">${titleTag}${layers(grid, palette)}</svg>\n`;
}

/** Alle Grafiken als { relativer Pfad in assets/: SVG-Text } */
export function renderAll() {
  const symbols = Object.entries(ICONS).map(([name, grid]) => `<symbol id="${name}" viewBox="0 0 16 16">${iconBody(name, grid)}</symbol>`);
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">\n<!-- Block-Kompass: eigene Pixel-Icons (16×16 Raster, Farbe = currentColor, Schattierung per Überlagerung).\n     Nutzung: <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#name"></use></svg> -->\n${symbols.join('\n')}\n</svg>\n`;
  checkGrid('drip', DRIP, 32, 6);
  const terrainGrid = terrain();
  return {
    'icons.svg': sprite,
    'logo.svg': pixelSvg(LOGO_32, LOGO_PALETTE, { width: 64, height: 64, title: 'Block-Kompass' }),
    'favicon.svg': pixelSvg(FAVICON_16, LOGO_PALETTE, { width: 32, height: 32 }),
    'patterns/drip.svg': pixelSvg(DRIP, { '#': { fill: '#000' } }, { width: 64, height: 12, preserve: 'none' }),
    'patterns/terrain.svg': pixelSvg(terrainGrid, TERRAIN_PALETTE, { width: terrainGrid[0].length * 4, height: terrainGrid.length * 4, preserve: 'none' }),
    'patterns/deepslate.svg': pixelSvg(deepslate(), DEEPSLATE_PALETTE, { width: 64, height: 64, preserve: 'none' }),
    'ui/check.svg': pixelSvg(ICONS.check, { '#': { fill: '#000' } }, { width: 16, height: 16 }),
    'ui/chevron.svg': pixelSvg(ICONS['chevron-down'], { '#': { fill: '#000' } }, { width: 16, height: 16 }),
  };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  for (const [file, content] of Object.entries(renderAll())) {
    const target = path.join(ASSETS, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    console.log('geschrieben:', path.relative(process.cwd(), target));
  }
}
