// Testseite: alle Texturen aus game-data/ über texture-store.js als WebGL2-Textur-Array zeichnen und prüfen.
// Ergebnis für Browser-Tests in window.__textureTest = { done, ok, checks: [{ name, ok, detail }], stats }.

import { TextureStore, buildLayer, cropImage, resampleNearest, mixLevels } from '../../js/render/texture-store.js';

const DATA_URL = '../../game-data/';
const CELL = 32;
const GAP = 2;
const GROUPS = [
  { id: 'block', title: 'Blöcke', filter: (name) => name.startsWith('block/') },
  { id: 'item', title: 'Gegenstände', filter: (name) => name.startsWith('item/') },
  { id: 'other', title: 'Entities und Farbkarten', filter: (name) => !name.startsWith('block/') && !name.startsWith('item/') },
];
const ICONS = [
  ['stone', null],
  ['redstone', null],
  ['glass', null],
  ['crafting_table', { up: 'block/crafting_table_top', north: 'block/crafting_table_front', east: 'block/crafting_table_side' }],
  ['grass_block', {
    up: { texture: 'block/grass_block_top', tint: 0x91bd59 },
    north: ['block/grass_block_side', { texture: 'block/grass_block_side_overlay', tint: 0x91bd59 }],
    east: ['block/grass_block_side', { texture: 'block/grass_block_side_overlay', tint: 0x91bd59 }],
  }],
  ['oak_leaves', { up: { texture: 'block/oak_leaves', tint: 0x77ab2f }, north: { texture: 'block/oak_leaves', tint: 0x77ab2f }, east: { texture: 'block/oak_leaves', tint: 0x77ab2f } }],
  ['oak_slab', { up: 'block/oak_planks', north: 'block/oak_planks', east: 'block/oak_planks', height: 0.5 }],
  ['torch', { flat: 'block/torch' }],
];
const REGION = 'region:entity/chest/normal:14,14,14,5';

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in uint aLayer;
uniform int uColumns;
uniform float uCell;
uniform float uGap;
uniform vec2 uViewport;
flat out uint vLayer;
out vec2 vUv;
void main() {
  int col = gl_InstanceID % uColumns;
  int row = gl_InstanceID / uColumns;
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 px = vec2(float(col), float(row)) * (uCell + uGap) + uGap + corner * uCell;
  vec2 clip = px / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = corner;
  vLayer = aLayer;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uTextures;
uniform float uLod;
uniform bool uChecker;
flat in uint vLayer;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 c = textureLod(uTextures, vec3(vUv, float(vLayer)), uLod);
  if (uChecker) {
    vec2 cell = floor(gl_FragCoord.xy / 4.0);
    vec3 bg = mix(vec3(0.15, 0.16, 0.19), vec3(0.24, 0.26, 0.30), mod(cell.x + cell.y, 2.0));
    outColor = vec4(mix(bg, c.rgb, c.a), 1.0);
  } else {
    outColor = c;
  }
}`;

const result = { done: false, ok: false, checks: [], stats: {} };
window.__textureTest = result;

const statusEl = document.getElementById('status');
const checksEl = document.getElementById('checks');
const groupsEl = document.getElementById('groups');
const mipSelect = document.getElementById('mip-level');
const animateBox = document.getElementById('animate');

function addCheck(name, ok, detail = '') {
  result.checks.push({ name, ok, detail });
  const item = document.createElement('li');
  item.textContent = `${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`;
  if (!ok) item.style.color = 'var(--c-redstone, #e0342f)';
  checksEl.append(item);
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader-Fehler: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Programm-Fehler: ${gl.getProgramInfoLog(program)}`);
  const uniforms = {};
  for (const name of ['uColumns', 'uCell', 'uGap', 'uViewport', 'uTextures', 'uLod', 'uChecker']) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
}

function createLayerVao(gl, layers) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, layers, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_SHORT, 0, 0);
  gl.vertexAttribDivisor(0, 1);
  gl.bindVertexArray(null);
  return vao;
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

class TextureGrid {
  constructor(store, group, names) {
    this.store = store;
    this.group = group;
    this.names = names;
  }

  async init(container) {
    const section = el('section', 'panel stack');
    const heading = el('h2', '', `${this.group.title} (${this.names.length})`);
    const wrap = el('div');
    wrap.style.position = 'relative';
    wrap.style.overflowX = 'auto';
    section.append(heading, wrap);
    container.append(section);

    const available = Math.max(CELL + 2 * GAP, wrap.clientWidth);
    this.columns = Math.max(1, Math.floor((available - GAP) / (CELL + GAP)));
    this.rows = Math.ceil(this.names.length / this.columns);
    const cssWidth = this.columns * (CELL + GAP) + GAP;
    const cssHeight = this.rows * (CELL + GAP) + GAP;
    this.dpr = window.devicePixelRatio || 1;
    const canvas = el('canvas');
    canvas.width = Math.round(cssWidth * this.dpr);
    canvas.height = Math.round(cssHeight * this.dpr);
    canvas.style.display = 'block';
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${this.group.title}: ${this.names.length} Texturen als Raster`);
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 ist in diesem Browser nicht verfügbar.');
    this.gl = gl;
    this.canvas = canvas;

    const start = performance.now();
    this.map = await this.store.prepare(gl, this.names);
    this.prepareMs = Math.round(performance.now() - start);
    this.shader = createProgram(gl);
    this.vao = createLayerVao(gl, Uint16Array.from(this.names, (name) => this.map.get(name).layer));

    const overlay = el('div');
    Object.assign(overlay.style, { position: 'absolute', left: '0', top: '0', width: `${cssWidth}px`, height: `${cssHeight}px` });
    this.names.forEach((name, i) => {
      const cell = el('div');
      cell.title = name;
      Object.assign(cell.style, {
        position: 'absolute',
        left: `${GAP + (i % this.columns) * (CELL + GAP)}px`,
        top: `${GAP + Math.floor(i / this.columns) * (CELL + GAP)}px`,
        width: `${CELL}px`,
        height: `${CELL}px`,
      });
      overlay.append(cell);
    });
    wrap.append(canvas, overlay);
    this.draw(0);
  }

  #render({ width, height, cell, gap, lod, checker }) {
    const { gl } = this;
    const { program, uniforms } = this.shader;
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    // Sichtbares Raster: Flächenfarbe der Seite (#1e2127); Prüf-Framebuffer: leer
    if (checker) gl.clearColor(30 / 255, 33 / 255, 39 / 255, 1);
    else gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    this.store.bind(gl, 0);
    gl.uniform1i(uniforms.uTextures, 0);
    gl.uniform1i(uniforms.uColumns, this.columns);
    gl.uniform1f(uniforms.uCell, cell);
    gl.uniform1f(uniforms.uGap, gap);
    gl.uniform2f(uniforms.uViewport, width, height);
    gl.uniform1f(uniforms.uLod, lod);
    gl.uniform1i(uniforms.uChecker, checker ? 1 : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.names.length);
    gl.bindVertexArray(null);
  }

  draw(lod) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.#render({ width: this.canvas.width, height: this.canvas.height, cell: CELL * this.dpr, gap: GAP * this.dpr, lod, checker: true });
  }

  // Zeichnet jede Ebene 1:1 (eine Mip-Stufe) in einen Framebuffer und vergleicht mit dem CPU-Spiegel.
  verifyLevel(level) {
    const { gl } = this;
    const size = this.store.layerSize >> level;
    const width = this.columns * size, height = this.rows * size;
    const target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    this.#render({ width, height, cell: size, gap: 0, lod: level, checker: false });
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(target);
    let wrong = 0;
    const examples = [];
    this.names.forEach((name, i) => {
      const expected = this.store.readLayer(gl, this.map.get(name).layer, level);
      const col = i % this.columns, row = Math.floor(i / this.columns);
      for (let ty = 0; ty < size; ty++) {
        const y = height - 1 - (row * size + ty);
        const start = (y * width + col * size) * 4;
        const actual = pixels.subarray(start, start + size * 4);
        const want = expected.subarray(ty * size * 4, (ty + 1) * size * 4);
        if (actual.some((v, k) => v !== want[k])) {
          wrong++;
          if (examples.length < 3) examples.push(name);
          break;
        }
      }
    });
    return { wrong, examples };
  }
}

// Liest eine Ebene direkt aus der GPU-Textur (für Einzelprüfungen).
function readGpuLayer(store, gl, layer, level) {
  const size = store.layerSize >> level;
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, store.texture(gl), level, layer);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer unvollständig (${status}).`);
  const pixels = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  return pixels;
}

const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function fetchRaw() {
  const [json, bin] = await Promise.all([
    fetch(`${DATA_URL}textures.json`).then((r) => r.json()),
    fetch(`${DATA_URL}textures.bin`).then((r) => r.arrayBuffer()),
  ]);
  return { entries: json.entries, bin: new Uint8Array(bin) };
}

async function browserDecode(bytes) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function checkDecoder(store, raw) {
  let wrong = 0;
  let translucentDiffs = 0;
  const examples = [];
  for (const name of store.names()) {
    const entry = raw.entries[name];
    const mine = (await store.image(name)).data;
    const theirs = await browserDecode(raw.bin.subarray(entry.o, entry.o + entry.l));
    let bad = mine.length !== theirs.length;
    for (let i = 0; !bad && i < mine.length; i += 4) {
      if (mine[i + 3] !== theirs[i + 3]) bad = true;
      else if (mine[i + 3] === 255 && (mine[i] !== theirs[i] || mine[i + 1] !== theirs[i + 1] || mine[i + 2] !== theirs[i + 2])) bad = true;
      else if (mine[i + 3] > 0 && mine[i + 3] < 255 && (mine[i] !== theirs[i] || mine[i + 1] !== theirs[i + 1] || mine[i + 2] !== theirs[i + 2])) translucentDiffs++;
    }
    if (bad) {
      wrong++;
      if (examples.length < 3) examples.push(name);
    }
  }
  result.stats.decoder = { textures: store.names().length, wrong, translucentPixelsDiffering: translucentDiffs };
  addCheck('Eigener PNG-Decoder = Browser (createImageBitmap)', wrong === 0,
    `${store.names().length} PNGs, Alpha überall gleich, Farbe bei deckenden Pixeln gleich${wrong ? `; abweichend: ${examples.join(', ')}` : ''}; halbtransparente Pixel mit Rundungsunterschied im Canvas: ${translucentDiffs}`);
}

async function checkLayerLimit(store) {
  const canvas = el('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const gl = canvas.getContext('webgl2');
  const max = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
  const names = store.names();
  try {
    if (names.length <= max) {
      addCheck('Ebenen-Grenze', true, `nicht erreichbar: ${names.length} Texturen ≤ ${max} Ebenen`);
      return;
    }
    try {
      await store.prepare(gl, names);
      addCheck('Ebenen-Grenze', false, `${names.length} Ebenen bei höchstens ${max} wurden nicht abgelehnt`);
    } catch (error) {
      const ok = /Zu viele Texturen/.test(error.message) && /MAX_ARRAY_TEXTURE_LAYERS/.test(error.message);
      addCheck('Ebenen-Grenze', ok, error.message);
    }
  } finally {
    store.dispose(gl);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

async function checkRegion(store, grid) {
  const { gl } = grid;
  const map = await store.prepare(gl, [REGION]);
  const entry = map.get(REGION);
  const source = await store.image('entity/chest/normal');
  const expected = resampleNearest(cropImage(source, 14, 14, 14, 5), store.layerSize, store.layerSize).data;
  const mirror = store.readLayer(gl, entry.layer, 0);
  let visibleSame = true;
  for (let i = 0; i < expected.length; i += 4) {
    if (expected[i + 3] === 0 ? mirror[i + 3] !== 0 : !sameBytes(mirror.subarray(i, i + 4), expected.subarray(i, i + 4))) visibleSame = false;
  }
  const gpu = readGpuLayer(store, gl, entry.layer, 0);
  addCheck('Region pixelgenau auf 32×32', visibleSame && sameBytes(gpu, mirror) && entry.maskWidth === 14 && entry.maskHeight === 5,
    `${REGION} → Ebene ${entry.layer}, Alpha ${entry.alpha}`);
}

async function checkAnimation(store, grid, raw) {
  const { gl, map } = grid;
  const layerOf = (name) => map.get(name).layer;
  const expected = async (name) => buildLayer(name, raw.entries[name], await store.image(name), { layerSize: store.layerSize });
  const water = await expected('block/water_still');
  const magma = await expected('block/magma');
  store.tick(gl, 100);
  const waterNow = store.readLayer(gl, layerOf('block/water_still'), 0);
  const waterOk = sameBytes(waterNow, water.frames.get(water.animation.frames[1][0])[0]) && sameBytes(readGpuLayer(store, gl, layerOf('block/water_still'), 0), waterNow);
  addCheck('Animation: Frame-Wechsel nach Liste', waterOk, 'block/water_still nach 2 Ticks = Frame 1 (CPU und GPU)');
  store.tick(gl, 200);
  const mixed = mixLevels(magma.frames.get(0), magma.frames.get(1), 0.5);
  let magmaOk = true;
  for (let level = 0; level < store.levelCount; level++) {
    const mirror = store.readLayer(gl, layerOf('block/magma'), level);
    if (!sameBytes(mirror, mixed[level]) || !sameBytes(readGpuLayer(store, gl, layerOf('block/magma'), level), mirror)) magmaOk = false;
  }
  addCheck('Animation: Interpolation mit Mipmaps', magmaOk, 'block/magma nach 4 Ticks = halb Frame 0, halb Frame 1 (alle Stufen)');
}

async function renderIcons(store) {
  const list = document.getElementById('icon-list');
  Object.assign(list.style, { display: 'flex', flexWrap: 'wrap', gap: '16px' });
  let ok = 0;
  const problems = [];
  for (const [id, faces] of ICONS) {
    const figure = el('figure');
    Object.assign(figure.style, { display: 'grid', justifyItems: 'center', gap: '4px', margin: '0' });
    try {
      const img = el('img');
      img.src = await store.iconDataUrl(id, faces, { size: 64 });
      img.alt = `Icon ${id}`;
      img.width = 64;
      img.height = 64;
      img.style.imageRendering = 'pixelated';
      await img.decode();
      if (img.naturalWidth === 64) ok++;
      figure.append(img, el('figcaption', 'muted', id));
    } catch (error) {
      problems.push(`${id}: ${error.message}`);
      figure.append(el('figcaption', '', `${id}: Fehler`));
    }
    list.append(figure);
  }
  addCheck('Icons als data:-URL', ok === ICONS.length, problems.length ? problems.join('; ') : `${ok} Icons (64×64)`);
}

function startAnimationLoop(store, grids) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  animateBox.checked = !reduced;
  const frame = (time) => {
    if (animateBox.checked) {
      for (const grid of grids) if (store.tick(grid.gl, time)) grid.draw(Number(mipSelect.value));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  mipSelect.addEventListener('change', () => {
    for (const grid of grids) grid.draw(Number(mipSelect.value));
  });
}

async function main() {
  const started = performance.now();
  const store = await TextureStore.load(DATA_URL);
  const raw = await fetchRaw();
  const names = store.names();
  const probe = el('canvas').getContext('webgl2');
  if (!probe) throw new Error('WebGL2 ist in diesem Browser nicht verfügbar.');
  const debugInfo = probe.getExtension('WEBGL_debug_renderer_info');
  result.stats.renderer = debugInfo ? probe.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : probe.getParameter(probe.RENDERER);
  result.stats.maxLayers = probe.getParameter(probe.MAX_ARRAY_TEXTURE_LAYERS);
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  addCheck('WebGL2 verfügbar', true, `${result.stats.renderer}, MAX_ARRAY_TEXTURE_LAYERS ${result.stats.maxLayers}`);

  const grids = [];
  for (const group of GROUPS) {
    statusEl.textContent = `Bereite ${group.title} vor …`;
    const grid = new TextureGrid(store, group, names.filter(group.filter));
    await grid.init(groupsEl);
    grids.push(grid);
    const stats = store.stats(grid.gl);
    result.stats[group.id] = { textures: grid.names.length, prepareMs: grid.prepareMs, ...stats };
    addCheck(`${group.title} vorbereitet`, stats.missing === 0,
      `${grid.names.length} Texturen in ${grid.prepareMs} ms · Ebenen ${stats.layers}/${stats.capacity} · deckend ${stats.alpha.opaque}, cutout ${stats.alpha.cutout}, durchscheinend ${stats.alpha.translucent} · animiert ${stats.animated}`);
  }

  for (const grid of grids) {
    const failures = [];
    for (let level = 0; level < store.levelCount; level++) {
      const { wrong, examples } = grid.verifyLevel(level);
      if (wrong) failures.push(`Stufe ${level}: ${wrong} (${examples.join(', ')})`);
    }
    addCheck(`GPU = CPU-Spiegel (${grid.group.title}, alle ${store.levelCount} Mip-Stufen)`, failures.length === 0, failures.join('; '));
  }

  await checkRegion(store, grids[2]);
  await checkAnimation(store, grids[0], raw);
  await checkLayerLimit(store);
  await checkDecoder(store, raw);
  await renderIcons(store);
  for (const grid of grids) grid.draw(Number(mipSelect.value));

  const glErrors = grids.map((grid) => grid.gl.getError()).filter((code) => code !== 0);
  addCheck('Keine WebGL-Fehler', glErrors.length === 0, glErrors.join(', '));
  result.stats.totalMs = Math.round(performance.now() - started);
  result.ok = result.checks.every((check) => check.ok);
  statusEl.textContent = result.ok
    ? `Fertig: ${names.length} Texturen geprüft in ${result.stats.totalMs} ms – alle Prüfungen bestanden.`
    : `Fertig in ${result.stats.totalMs} ms – mindestens eine Prüfung ist fehlgeschlagen (siehe unten).`;
  startAnimationLoop(store, grids);
}

main()
  .catch((error) => {
    console.error(error);
    statusEl.textContent = `Fehler: ${error.message}`;
    addCheck('Seite geladen', false, error.message);
    result.ok = false;
  })
  .finally(() => {
    result.done = true;
  });
