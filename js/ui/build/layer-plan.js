// Ebenen-Plan: 2D-Raster einer Ebene mit Draufsicht-Texturen (Oberseite der Blöcke), Kennzeichnung
// fertig / aktueller Schritt / später, Zoom und Verschieben mit Maus, Touch und Tastatur, Koordinaten-Lineal,
// Hover-Tooltip, Klick springt zum Schritt. Gezeichnet wird nur bei Änderungen; die Ebene wird einmal
// vorgerendert, damit auch 150 × 150 Felder flüssig bleiben.
import { el } from '../dom.js';
import { formatNumber, formatCount, icon } from '../shared.js';
import { dominantLayer } from './step-model.js';
import {
  readLayer, cellStatus, layerCounts, fitView, zoomAt, clampView, cellAt, rulerStep, bakeResolution, averageTileColor,
  CELL_CURRENT, CELL_LATER,
} from './plan-model.js';
import { FloatingTooltip, blockTooltipParts, positionText } from './kit.js';

const TILE = 16;
const RULER = 22;
// Ab dieser Auflösung (px je Feld) wird die Ebene als Farbbild vorgerendert statt Feld für Feld mit Texturen gezeichnet:
// bei sehr großen Ebenen (Hunderttausende Felder) sonst sekundenlange Blockaden, auf Handys noch länger.
const FAST_BAKE_TILE = 4;
const EMPTY_RGB = [0x18, 0x1b, 0x20];
const PLACEHOLDER_RGB = [0x3a, 0x3f, 0x48];
const COLORS = {
  ground: '#101215',
  empty: '#181b20',
  grid: 'rgba(255,255,255,0.07)',
  currentEdge: '#f2c14e',
  ruler: '#0f1114',
  rulerText: '#b3ada2',
  hover: '#ece8df',
  placeholder: '#3a3f48',
};

export class LayerPlan {
  #ctx;
  #root;
  #parts = {};
  #layerY = 0;
  #follow = true;
  #layer = null;
  #atlas = null;
  #atlasIndex = new Map();
  #baked = null;
  #bakedTile = 1;
  #overlay = null;
  #view = null;
  #userMoved = false;
  #dirty = true;
  #raf = 0;
  #size = { w: 0, h: 0, ratio: 1 };
  #hover = null;
  #pointers = new Map();
  #gesture = null;
  #tooltip;
  #resize = null;
  #offs = [];
  #tilesJob = 0;
  #visible = false;
  // Arbeit, die wartet, bis der Tab sichtbar ist (Ebene laden bzw. Kennzeichnung aktualisieren)
  #pendingLoad = false;
  #overlayStale = false;
  #tileColors = new Map();

  constructor(ctx) {
    this.#ctx = ctx;
    this.#root = this.#build();
    this.#tooltip = new FloatingTooltip(ctx.overlayRoot);
    this.#layerY = this.#defaultLayer();
    this.#offs.push(ctx.events.on('step', () => this.#onStep()));
    this.#offs.push(ctx.events.on('progress', () => this.#refreshOverlay()));
    this.#loadLayer();
  }

  get element() { return this.#root; }
  get layerY() { return this.#layerY; }

  #build() {
    const { ids, result } = this.#ctx;
    const height = result.size[1];
    const prev = el('button', { class: 'btn btn--icon btn--sm', type: 'button', title: 'Ebene tiefer', on: { click: () => this.setLayer(this.#layerY - 1, { user: true }) } },
      icon('prev'), el('span', { class: 'visually-hidden' }, 'Ebene tiefer'));
    const next = el('button', { class: 'btn btn--icon btn--sm', type: 'button', title: 'Ebene höher', on: { click: () => this.setLayer(this.#layerY + 1, { user: true }) } },
      icon('next'), el('span', { class: 'visually-hidden' }, 'Ebene höher'));
    const sliderId = `${ids}-plan-layer`;
    const slider = el('input', { class: 'slider bv-plan__slider', id: sliderId, type: 'range', min: 1, max: Math.max(1, height), step: 1, value: 1, disabled: height <= 1 });
    slider.addEventListener('input', () => this.setLayer(Number(slider.value) - 1, { user: true }));
    const layerLabel = el('output', { class: 'bv-plan__layer', for: sliderId });
    const followId = `${ids}-plan-follow`;
    const follow = el('input', { type: 'checkbox', id: followId, checked: true });
    follow.addEventListener('change', () => {
      this.#follow = follow.checked;
      if (this.#follow) this.setLayer(this.#defaultLayer());
    });
    const canvas = el('canvas', { class: 'bv-plan__canvas' });
    const viewport = el('div', {
      class: 'bv-plan__viewport', tabindex: 0, role: 'application', 'aria-roledescription': 'Ebenen-Plan',
      'aria-label': 'Ebenen-Plan: Pfeiltasten verschieben, Plus und Minus zoomen, 0 passt ein, Bild auf/ab wechselt die Ebene',
      dataset: { keys: 'own' },
    }, canvas);
    const zoomIn = el('button', { class: 'btn btn--icon btn--sm', type: 'button', title: 'Vergrößern', on: { click: () => this.#zoomCenter(1.4) } }, el('span', { 'aria-hidden': 'true' }, '+'), el('span', { class: 'visually-hidden' }, 'Vergrößern'));
    const zoomOut = el('button', { class: 'btn btn--icon btn--sm', type: 'button', title: 'Verkleinern', on: { click: () => this.#zoomCenter(1 / 1.4) } }, el('span', { 'aria-hidden': 'true' }, '−'), el('span', { class: 'visually-hidden' }, 'Verkleinern'));
    const fit = el('button', { class: 'btn btn--sm', type: 'button', on: { click: () => this.#fit(true) } }, 'Einpassen');
    const status = el('p', { class: 'bv-plan__status', 'aria-live': 'polite' });
    const counts = el('ul', { class: 'bv-plan__legend', role: 'list' });
    Object.assign(this.#parts, { prev, next, slider, layerLabel, follow, canvas, viewport, status, counts });
    this.#bindPointer(viewport);
    viewport.addEventListener('keydown', (event) => this.#onKey(event));
    viewport.addEventListener('wheel', (event) => this.#onWheel(event), { passive: false });
    if (typeof ResizeObserver === 'function') {
      this.#resize = new ResizeObserver(() => this.#measure());
      this.#resize.observe(viewport);
    }
    return el('div', { class: 'bv-plan' },
      el('div', { class: 'bv-plan__bar' },
        el('div', { class: 'bv-plan__layer-row' }, prev, el('label', { class: 'visually-hidden', for: sliderId }, 'Ebene wählen'), slider, next),
        el('div', { class: 'bv-plan__layer-info' }, layerLabel,
          el('label', { class: 'choice bv-plan__follow', for: followId }, follow, el('span', null, 'Folgt dem Schritt')))),
      viewport,
      el('div', { class: 'bv-plan__tools' }, el('div', { class: 'bv-plan__zoom', role: 'group', 'aria-label': 'Zoom' }, zoomIn, zoomOut, fit), counts),
      status);
  }

  // ---------------------------------------------------------------- Ebene

  #defaultLayer() {
    const { result, shown } = this.#ctx;
    if (result.steps.length === 0) return 0;
    const y = dominantLayer(result, Math.max(0, shown));
    return y === null ? 0 : y;
  }

  setLayer(y, { user = false } = {}) {
    const height = this.#ctx.result.size[1];
    const clamped = Math.max(0, Math.min(height - 1, y));
    if (user && this.#follow) {
      this.#follow = false;
      this.#parts.follow.checked = false;
    }
    if (clamped === this.#layerY && this.#layer) return;
    this.#layerY = clamped;
    this.#loadLayer();
  }

  #onStep() {
    if (this.#follow) {
      const y = this.#defaultLayer();
      if (y !== this.#layerY) {
        this.#layerY = y;
        this.#loadLayer();
        return;
      }
    }
    this.#refreshOverlay();
  }

  // Kennzeichnung (fertig / aktuell / später) nur bei sichtbarem Tab neu rechnen, sonst beim Öffnen nachholen
  #refreshOverlay() {
    if (!this.#visible) {
      this.#overlayStale = true;
      return;
    }
    this.#updateOverlay();
  }

  #updateControls() {
    const { result } = this.#ctx;
    this.#parts.slider.value = String(this.#layerY + 1);
    this.#parts.slider.style.setProperty('--fill', `${result.size[1] > 1 ? (this.#layerY / (result.size[1] - 1)) * 100 : 0}%`);
    this.#parts.layerLabel.textContent = `Ebene ${formatNumber(this.#layerY + 1)} von ${formatNumber(result.size[1])} · y = ${formatNumber(this.#layerY)}`;
    this.#parts.prev.setAttribute('aria-disabled', String(this.#layerY <= 0));
    this.#parts.next.setAttribute('aria-disabled', String(this.#layerY >= result.size[1] - 1));
  }

  #loadLayer() {
    this.#updateControls();
    // Unsichtbar (anderer Tab offen): nicht lesen und nicht vorrendern – bei Riesenbauten kostete das bei jedem
    // Schrittwechsel Sekunden bis Minuten. activate() holt es nach.
    if (!this.#visible) {
      this.#pendingLoad = true;
      return;
    }
    this.#pendingLoad = false;
    this.#overlayStale = false;
    const { result } = this.#ctx;
    const started = performance.now();
    this.#layer = readLayer(result.volume, result.size, this.#layerY);
    this.#baked = null;
    this.#updateOverlay();
    if (!this.#userMoved || !this.#view) this.#fit(false);
    this.#prepareTiles();
    this.#ctx.events.emit('plan-layer', { y: this.#layerY, ms: performance.now() - started });
  }

  // Draufsicht-Kacheln aller Zustände der Ebene holen und in einen Atlas legen, danach die Ebene vorrendern
  async #prepareTiles() {
    const job = ++this.#tilesJob;
    const layer = this.#layer;
    const palette = this.#ctx.result.volume.palette;
    const missing = layer.used.filter((index) => !this.#atlasIndex.has(index));
    if (missing.length === 0) {
      this.#bake();
      return;
    }
    let appearance = null;
    try {
      appearance = await this.#ctx.appearance;
    } catch (error) {
      console.warn('[Block-Kompass] Texturen für den Plan nicht verfügbar:', error);
    }
    if (!appearance) {
      this.#parts.status.textContent = 'Texturen nicht verfügbar – der Plan zeigt einfache Felder.';
      this.#bake();
      return;
    }
    appearance.prepareStates(missing.map((index) => palette[index]));
    const tiles = await Promise.all(missing.map(async (index) => {
      try {
        return [index, await appearance.topTile(palette[index], TILE)];
      } catch (error) {
        console.warn(`[Block-Kompass] Draufsicht für „${palette[index]}“ fehlt:`, error);
        return [index, null];
      }
    }));
    if (job !== this.#tilesJob) return;
    this.#addToAtlas(tiles);
    this.#bake();
  }

  #addToAtlas(tiles) {
    const total = this.#atlasIndex.size + tiles.length;
    const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
    const rows = Math.ceil(total / columns);
    const atlas = el('canvas');
    atlas.width = columns * TILE;
    atlas.height = rows * TILE;
    const g = atlas.getContext('2d');
    const index = new Map();
    let slot = 0;
    const place = (paletteIndex, draw) => {
      const sx = (slot % columns) * TILE, sy = Math.floor(slot / columns) * TILE;
      draw(g, sx, sy);
      index.set(paletteIndex, [sx, sy]);
      slot++;
    };
    for (const [paletteIndex, [sx, sy]] of this.#atlasIndex) place(paletteIndex, (ctx, dx, dy) => ctx.drawImage(this.#atlas, sx, sy, TILE, TILE, dx, dy, TILE, TILE));
    for (const [paletteIndex, image] of tiles) {
      place(paletteIndex, (ctx, dx, dy) => {
        if (image) ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.length), TILE, TILE), dx, dy);
      });
      const [r, g2, b] = image ? averageTileColor(image.data, EMPTY_RGB) : PLACEHOLDER_RGB;
      this.#tileColors.set(paletteIndex, packColor(r, g2, b, 1));
    }
    this.#atlas = atlas;
    this.#atlasIndex = index;
  }

  // Ganze Ebene einmal in eine Leinwand zeichnen (Auflösung je nach Größe)
  #bake() {
    const layer = this.#layer;
    const tile = bakeResolution(layer.width, layer.length);
    if (tile <= FAST_BAKE_TILE) {
      this.#bakeColors(layer, tile);
      return;
    }
    const canvas = el('canvas');
    canvas.width = layer.width * tile;
    canvas.height = layer.length * tile;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = COLORS.empty;
    g.fillRect(0, 0, canvas.width, canvas.height);
    for (let z = 0; z < layer.length; z++) {
      for (let x = 0; x < layer.width; x++) {
        const i = z * layer.width + x;
        const index = layer.indices[i];
        if (!index) continue;
        const spot = this.#atlasIndex.get(index);
        if (spot) g.drawImage(this.#atlas, spot[0], spot[1], TILE, TILE, x * tile, z * tile, tile, tile);
        else {
          g.fillStyle = COLORS.placeholder;
          g.fillRect(x * tile, z * tile, tile, tile);
        }
      }
    }
    this.#baked = canvas;
    this.#bakedTile = tile;
    this.#invalidate();
  }

  // Große Ebenen: je Feld die mittlere Farbe seiner Draufsicht als Pixel (ein putImageData statt Hunderttausender drawImage).
  // tile < 1 (sehr lange Ebenen): je Pixel das Feld in seiner Mitte. Beim Hineinzoomen zeichnet #drawCells echte Texturen.
  #bakeColors(layer, tile) {
    const width = Math.max(1, Math.round(layer.width * tile));
    const height = Math.max(1, Math.round(layer.length * tile));
    const canvas = el('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    const image = g.createImageData(width, height);
    const data = new Uint32Array(image.data.buffer);
    const empty = packColor(...EMPTY_RGB, 1);
    const placeholder = packColor(...PLACEHOLDER_RGB, 1);
    const columns = new Int32Array(width);
    for (let px = 0; px < width; px++) columns[px] = Math.min(layer.width - 1, Math.floor((px + 0.5) / tile));
    for (let py = 0; py < height; py++) {
      const row = Math.min(layer.length - 1, Math.floor((py + 0.5) / tile)) * layer.width;
      for (let px = 0; px < width; px++) {
        const index = layer.indices[row + columns[px]];
        data[py * width + px] = index ? (this.#tileColors.get(index) ?? placeholder) : empty;
      }
    }
    g.putImageData(image, 0, 0);
    this.#baked = canvas;
    this.#bakedTile = tile;
    this.#invalidate();
  }

  // Zustand je Zelle als 1-Pixel-Bild (wird beim Zeichnen ohne Glättung hochskaliert)
  #updateOverlay() {
    const layer = this.#layer;
    if (!layer) return;
    const shown = this.#ctx.shown;
    if (this.#overlay && this.#overlay.shown === shown && this.#overlay.y === layer.y) return;
    const canvas = this.#overlay?.canvas.width === layer.width && this.#overlay?.canvas.height === layer.length ? this.#overlay.canvas : el('canvas');
    canvas.width = layer.width;
    canvas.height = layer.length;
    const g = canvas.getContext('2d');
    const image = g.createImageData(layer.width, layer.length);
    const data = new Uint32Array(image.data.buffer);
    // Farben als ABGR (Little Endian)
    const later = packColor(12, 13, 16, 0.72);
    const current = packColor(242, 193, 78, 0.3);
    const below = packColor(236, 232, 223, 0.07);
    for (let i = 0; i < data.length; i++) {
      const status = cellStatus(layer.steps[i], shown);
      data[i] = status === CELL_LATER ? later : status === CELL_CURRENT ? current : status === 0 && layer.below[i] ? below : 0;
    }
    g.putImageData(image, 0, 0);
    this.#overlay = { canvas, shown, y: layer.y };
    this.#renderCounts(shown);
    this.#invalidate();
  }

  #renderCounts(shown) {
    const counts = layerCounts(this.#layer, shown);
    const item = (cls, label, value) => el('li', { class: ['bv-plan__key', cls] }, el('span', { class: 'bv-plan__swatch', 'aria-hidden': 'true' }), `${label} `, el('strong', { class: 'mono' }, formatNumber(value)));
    this.#parts.counts.replaceChildren(
      item('is-done', 'Fertig', counts.done),
      item('is-current', 'Dieser Schritt', counts.current),
      item('is-later', 'Später', counts.later),
      el('li', { class: 'bv-plan__key bv-plan__key--total' }, `${formatCount(this.#layer.blocks, 'Block', 'Blöcke')} · ${formatNumber(this.#layer.width)} × ${formatNumber(this.#layer.length)}`));
  }

  // ---------------------------------------------------------------- Ansicht

  /** Panel wurde sichtbar (Tab gewechselt): Größe messen und zeichnen. */
  activate() {
    this.#visible = true;
    this.#measure();
    if (this.#pendingLoad) this.#loadLayer();
    else if (this.#overlayStale) {
      this.#overlayStale = false;
      this.#updateOverlay();
    }
  }

  deactivate() {
    this.#visible = false;
    this.#tooltip.hide();
  }

  #measure() {
    const box = this.#parts.viewport.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    const changed = box.width !== this.#size.w || box.height !== this.#size.h || ratio !== this.#size.ratio;
    this.#size = { w: box.width, h: box.height, ratio };
    const canvas = this.#parts.canvas;
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    if (!this.#view || (changed && !this.#userMoved)) this.#fit(false);
    this.#invalidate();
  }

  #area() {
    return { w: this.#size.w - RULER, h: this.#size.h - RULER };
  }

  #fit(user) {
    if (!this.#layer || this.#size.w < 2) return;
    const area = this.#area();
    this.#view = fitView(area.w, area.h, this.#layer.width, this.#layer.length);
    if (user) this.#userMoved = false;
    this.#invalidate();
  }

  #zoomCenter(factor) {
    if (!this.#view) return;
    const area = this.#area();
    this.#setView(zoomAt(this.#view, factor, area.w / 2, area.h / 2));
  }

  #setView(view) {
    const area = this.#area();
    this.#view = clampView(view, area.w, area.h, this.#layer.width, this.#layer.length);
    this.#userMoved = true;
    this.#invalidate();
  }

  #invalidate() {
    this.#dirty = true;
    if (!this.#raf) this.#raf = requestAnimationFrame(() => this.#draw());
  }

  #draw() {
    this.#raf = 0;
    if (!this.#dirty || !this.#view || this.#size.w < 2) return;
    this.#dirty = false;
    const canvas = this.#parts.canvas;
    const g = canvas.getContext('2d');
    const { ratio } = this.#size;
    const area = this.#area();
    const layer = this.#layer;
    const view = this.#view;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = COLORS.ground;
    g.fillRect(0, 0, this.#size.w, this.#size.h);
    g.save();
    g.beginPath();
    g.rect(RULER, RULER, area.w, area.h);
    g.clip();
    g.translate(RULER, RULER);
    const width = layer.width * view.cell, height = layer.length * view.cell;
    // Sichtbarer Zellbereich
    const x0 = Math.max(0, Math.floor(-view.x / view.cell)), z0 = Math.max(0, Math.floor(-view.y / view.cell));
    const x1 = Math.min(layer.width, Math.ceil((area.w - view.x) / view.cell)), z1 = Math.min(layer.length, Math.ceil((area.h - view.y) / view.cell));
    const visibleCells = Math.max(0, x1 - x0) * Math.max(0, z1 - z0);
    if (this.#baked) {
      if (view.cell > this.#bakedTile * 1.01 && this.#atlas && visibleCells <= 6000) this.#drawCells(g, x0, z0, x1, z1);
      else g.drawImage(this.#baked, view.x, view.y, width, height);
    } else {
      g.fillStyle = COLORS.empty;
      g.fillRect(view.x, view.y, width, height);
    }
    if (this.#overlay) g.drawImage(this.#overlay.canvas, view.x, view.y, width, height);
    if (view.cell >= 8) this.#drawGrid(g, x0, z0, x1, z1);
    if (view.cell >= 6) this.#drawCurrentEdges(g, x0, z0, x1, z1);
    if (this.#hover) {
      g.strokeStyle = COLORS.hover;
      g.lineWidth = 2;
      g.strokeRect(view.x + this.#hover.x * view.cell + 1, view.y + this.#hover.z * view.cell + 1, view.cell - 2, view.cell - 2);
    }
    g.restore();
    this.#drawRulers(g, area, x0, z0, x1, z1);
  }

  #drawCells(g, x0, z0, x1, z1) {
    const layer = this.#layer;
    const view = this.#view;
    const c = view.cell;
    g.fillStyle = COLORS.empty;
    g.fillRect(view.x + x0 * c, view.y + z0 * c, (x1 - x0) * c, (z1 - z0) * c);
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const index = layer.indices[z * layer.width + x];
        if (!index) continue;
        const spot = this.#atlasIndex.get(index);
        // Zellen auf ganze Pixel legen, damit keine Haarlinien entstehen
        const dx = Math.floor(view.x + x * c), dy = Math.floor(view.y + z * c);
        const size = Math.floor(view.x + (x + 1) * c) - dx;
        const sizeY = Math.floor(view.y + (z + 1) * c) - dy;
        if (spot) g.drawImage(this.#atlas, spot[0], spot[1], TILE, TILE, dx, dy, size, sizeY);
        else {
          g.fillStyle = COLORS.placeholder;
          g.fillRect(dx, dy, size, sizeY);
        }
      }
    }
  }

  #drawGrid(g, x0, z0, x1, z1) {
    const view = this.#view;
    g.strokeStyle = COLORS.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = x0; x <= x1; x++) {
      const px = Math.round(view.x + x * view.cell) + 0.5;
      g.moveTo(px, view.y + z0 * view.cell);
      g.lineTo(px, view.y + z1 * view.cell);
    }
    for (let z = z0; z <= z1; z++) {
      const py = Math.round(view.y + z * view.cell) + 0.5;
      g.moveTo(view.x + x0 * view.cell, py);
      g.lineTo(view.x + x1 * view.cell, py);
    }
    g.stroke();
  }

  #drawCurrentEdges(g, x0, z0, x1, z1) {
    const layer = this.#layer;
    const view = this.#view;
    const shown = this.#ctx.shown;
    g.strokeStyle = COLORS.currentEdge;
    g.lineWidth = view.cell >= 16 ? 2 : 1;
    g.beginPath();
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        if (layer.steps[z * layer.width + x] !== shown || shown < 0) continue;
        g.rect(Math.round(view.x + x * view.cell) + 1, Math.round(view.y + z * view.cell) + 1, Math.max(1, Math.round(view.cell) - 2), Math.max(1, Math.round(view.cell) - 2));
      }
    }
    g.stroke();
  }

  #drawRulers(g, area, x0, z0, x1, z1) {
    const view = this.#view;
    const step = rulerStep(view.cell);
    g.fillStyle = COLORS.ruler;
    g.fillRect(0, 0, this.#size.w, RULER);
    g.fillRect(0, 0, RULER, this.#size.h);
    g.fillStyle = COLORS.rulerText;
    g.font = '11px "Atkinson Hyperlegible Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    for (let x = Math.ceil(x0 / step) * step; x < x1; x += step) {
      const px = RULER + view.x + (x + 0.5) * view.cell;
      if (px > RULER + 6 && px < this.#size.w - 6) g.fillText(String(x), px, RULER / 2);
    }
    g.save();
    for (let z = Math.ceil(z0 / step) * step; z < z1; z += step) {
      const py = RULER + view.y + (z + 0.5) * view.cell;
      if (py > RULER + 6 && py < this.#size.h - 6) {
        g.setTransform(this.#size.ratio, 0, 0, this.#size.ratio, 0, 0);
        g.translate(RULER / 2, py);
        g.rotate(-Math.PI / 2);
        g.fillText(String(z), 0, 0);
      }
    }
    g.restore();
    // Ecke: Himmelsrichtung
    g.fillStyle = '#f2c14e';
    g.font = 'bold 11px "Atkinson Hyperlegible Mono", ui-monospace, monospace';
    g.fillText('N↑', RULER / 2, RULER / 2);
  }

  // ---------------------------------------------------------------- Eingaben

  #local(event) {
    const box = this.#parts.viewport.getBoundingClientRect();
    return { x: event.clientX - box.left - RULER, y: event.clientY - box.top - RULER };
  }

  #bindPointer(viewport) {
    viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      viewport.setPointerCapture(event.pointerId);
      this.#pointers.set(event.pointerId, this.#local(event));
      this.#startGesture();
    });
    viewport.addEventListener('pointermove', (event) => {
      const point = this.#local(event);
      if (this.#pointers.has(event.pointerId)) {
        this.#pointers.set(event.pointerId, point);
        this.#moveGesture();
        return;
      }
      if (event.pointerType === 'mouse') this.#setHover(point, event);
    });
    const end = (event) => {
      if (!this.#pointers.has(event.pointerId)) return;
      const gesture = this.#gesture;
      this.#pointers.delete(event.pointerId);
      if (gesture && !gesture.moved && this.#pointers.size === 0 && event.type === 'pointerup') this.#onTap(this.#local(event), event);
      this.#startGesture();
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    viewport.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse' && !this.#pointers.size) this.#setHover(null);
    });
    viewport.addEventListener('dblclick', (event) => {
      const point = this.#local(event);
      this.#setView(zoomAt(this.#view, 2, point.x, point.y));
    });
  }

  #startGesture() {
    const points = [...this.#pointers.values()];
    if (points.length === 0 || !this.#view) {
      this.#gesture = null;
      return;
    }
    const center = points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    const distance = points.length >= 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    // „moved“ bleibt erhalten, wenn ein Finger von zweien losgelassen wird (sonst gälte das als Tippen)
    this.#gesture = { view: { ...this.#view }, center, distance, moved: Boolean(this.#gesture?.moved), count: points.length };
  }

  #moveGesture() {
    const gesture = this.#gesture;
    if (!gesture) return;
    const points = [...this.#pointers.values()];
    const center = points.length === 1 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    const dx = center.x - gesture.center.x, dy = center.y - gesture.center.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 4 && points.length === 1) return;
    gesture.moved = true;
    this.#tooltip.hide();
    let view = { ...gesture.view, x: gesture.view.x + dx, y: gesture.view.y + dy };
    if (points.length >= 2 && gesture.distance > 0) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      view = zoomAt(view, distance / gesture.distance, center.x, center.y);
    }
    this.#setView(view);
  }

  #onWheel(event) {
    if (!this.#view) return;
    event.preventDefault();
    const point = this.#local(event);
    const factor = Math.exp(-Math.max(-60, Math.min(60, event.deltaY)) * 0.004);
    this.#setView(zoomAt(this.#view, factor, point.x, point.y));
  }

  #onKey(event) {
    if (!this.#view || event.altKey || event.ctrlKey || event.metaKey) return;
    const stepPx = Math.max(24, this.#view.cell * 2);
    const actions = {
      ArrowLeft: () => this.#setView({ ...this.#view, x: this.#view.x + stepPx }),
      ArrowRight: () => this.#setView({ ...this.#view, x: this.#view.x - stepPx }),
      ArrowUp: () => this.#setView({ ...this.#view, y: this.#view.y + stepPx }),
      ArrowDown: () => this.#setView({ ...this.#view, y: this.#view.y - stepPx }),
      '+': () => this.#zoomCenter(1.4),
      '=': () => this.#zoomCenter(1.4),
      '-': () => this.#zoomCenter(1 / 1.4),
      0: () => this.#fit(true),
      PageUp: () => this.setLayer(this.#layerY + 1, { user: true }),
      PageDown: () => this.setLayer(this.#layerY - 1, { user: true }),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  #cellInfo(point) {
    if (!point || !this.#view) return null;
    const cell = cellAt(this.#view, point.x, point.y, this.#layer.width, this.#layer.length);
    if (!cell) return null;
    const i = cell.z * this.#layer.width + cell.x;
    const index = this.#layer.indices[i];
    return { ...cell, index, step: this.#layer.steps[i], state: index ? this.#ctx.result.volume.palette[index] : null };
  }

  #setHover(point, event = null) {
    const info = this.#cellInfo(point);
    const same = info && this.#hover && info.x === this.#hover.x && info.z === this.#hover.z;
    if (!same) {
      this.#hover = info && info.index ? info : null;
      this.#invalidate();
    }
    if (this.#hover && event) {
      this.#tooltip.show(blockTooltipParts(this.#hover.state, {
        step: this.#hover.step, coords: positionText(this.#hover.x, this.#layerY, this.#hover.z),
      }), event.clientX, event.clientY);
    } else {
      this.#tooltip.hide();
    }
  }

  #onTap(point, event) {
    const info = this.#cellInfo(point);
    if (!info || !info.index) return;
    if (event.pointerType !== 'mouse') {
      this.#tooltip.show(blockTooltipParts(info.state, { step: info.step, coords: positionText(info.x, this.#layerY, info.z) }), event.clientX, event.clientY, { duration: 2500 });
    }
    this.#ctx.goToStep(info.step);
  }

  dispose() {
    cancelAnimationFrame(this.#raf);
    this.#resize?.disconnect();
    this.#tooltip.hide();
    for (const off of this.#offs) off();
    this.#offs = [];
  }
}

function packColor(r, g, b, alpha) {
  return ((Math.round(alpha * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
