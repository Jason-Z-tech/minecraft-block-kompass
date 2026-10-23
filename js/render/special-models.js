// Sondermodelle (ARCHITEKTUR §7.1): Blöcke, die das Spiel als Block-Entity zeichnet (Truhen, Banner,
// Shulkerkisten, Köpfe, Glocke, Krug, Aquisitor, Endportal), dazu Flüssigkeiten und unsichtbare Blöcke.
// Die Modelle stehen als Tabellen im Format der Entity-Modelle des Spiels (ChestModel, ShulkerModel,
// BannerModel/BannerFlagModel, SkullModel, PiglinHeadModel, DragonHeadModel, BellModel,
// DecoratedPotRenderer, ConduitRenderer): texOffs = linke obere Ecke im Textur-Layout, from/size in
// Modell-Pixeln, offset/rotation wie PartPose. Daraus entstehen die Textur-Ausschnitte („Regionen“)
// nach dem festen Würfel-Layout von ModelPart.Cube – Tabellen korrigieren, nicht die Rechnung.
// Ergebnis sind „Roh-Quads“ (Positionen blocklokal, UV in Texeln 0 … 16 der Region); block-models.js
// bindet sie an Textur-Ebenen.

import { PLAINS_COLORS, TINT_NONE } from './tints.js';

const DEG = Math.PI / 180;
// Abstand, ab dem eine Fläche als „auf der Blockgrenze“ gilt (für cullface).
const BOUNDARY_EPS = 1 / 128;
// Truhendeckel um 1/16 Pixel (eine Stufe des Vertex-Rasters) größer, damit Deckel und Unterteil nicht auf
// derselben Ebene flimmern; das Unterteil bleibt exakt (keine Fuge in der Doppeltruhe). Die Shulkerkiste bleibt
// exakt wie im Spiel: ihre Zacken greifen ineinander (deckende Texel überlappen nie), vergrößert entstünden Haarrisse.
const LID_GROW_PX = 1 / 16;
// Einzug der Flüssigkeitsflächen (das Spiel nimmt 0,001; hier eine Stufe des Vertex-Rasters).
const FLUID_EPS = 1 / 256;

export const DYE_COLORS = Object.freeze({
  white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f,
  pink: 0xf38baa, gray: 0x474f52, light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa,
  brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21,
});
const DYE_NAMES = Object.keys(DYE_COLORS);

// ------------------------------------------------------------------ Matrizen (affin 3×4, Zeilen zuerst)

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);

function multiply(a, b) {
  const out = new Array(12);
  for (let row = 0; row < 3; row++) {
    const r = row * 4;
    for (let col = 0; col < 3; col++) {
      out[r + col] = a[r] * b[col] + a[r + 1] * b[4 + col] + a[r + 2] * b[8 + col];
    }
    out[r + 3] = a[r] * b[3] + a[r + 1] * b[7] + a[r + 2] * b[11] + a[r + 3];
  }
  return out;
}

function compose(...matrices) {
  return matrices.reduce((acc, m) => multiply(acc, m), IDENTITY);
}

function translate(x, y, z) {
  return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
}

function scale(x, y, z) {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
}

// cos/sin mit exakten Werten bei Vielfachen von 90°.
function trig(rad) {
  const snap = (v) => (Math.abs(v) < 1e-12 ? 0 : Math.abs(v - 1) < 1e-12 ? 1 : Math.abs(v + 1) < 1e-12 ? -1 : v);
  return [snap(Math.cos(rad)), snap(Math.sin(rad))];
}

// Drehungen gegen den Uhrzeigersinn um die positive Achse (rechtshändig, wie JOML).
function rotationX(rad) {
  const [c, s] = trig(rad);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
}

function rotationY(rad) {
  const [c, s] = trig(rad);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0];
}

function rotationZ(rad) {
  const [c, s] = trig(rad);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
}

// Rundungsreste der Matrizen (z. B. −2·10⁻¹⁷) entfernen; „+ 0“ macht aus −0 eine 0.
function snap(value) {
  return Math.round(value * 1e6) / 1e6 + 0;
}

function transformPoint(m, x, y, z) {
  return [
    snap(m[0] * x + m[1] * y + m[2] * z + m[3]),
    snap(m[4] * x + m[5] * y + m[6] * z + m[7]),
    snap(m[8] * x + m[9] * y + m[10] * z + m[11]),
  ];
}

// Direction.toYRot(): Süden 0°, Westen 90°, Norden 180°, Osten 270°.
const Y_ROT = Object.freeze({ south: 0, west: 90, north: 180, east: 270 });
const OPPOSITE = Object.freeze({ north: 'south', south: 'north', west: 'east', east: 'west', up: 'down', down: 'up' });
const STEP = Object.freeze({ north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] });

function yRotOf(direction) {
  const value = Y_ROT[direction];
  if (value === undefined) throw new Error(`Ungültige waagrechte Richtung „${direction}“.`);
  return value;
}

// Direction.getRotation(): dreht +Y auf die Richtung.
function directionRotation(direction) {
  switch (direction) {
    case 'up': return IDENTITY;
    case 'down': return rotationX(Math.PI);
    case 'north': return compose(rotationX(Math.PI / 2), rotationZ(Math.PI));
    case 'south': return rotationX(Math.PI / 2);
    case 'west': return compose(rotationX(Math.PI / 2), rotationZ(Math.PI / 2));
    case 'east': return compose(rotationX(Math.PI / 2), rotationZ(-Math.PI / 2));
    default: throw new Error(`Ungültige Richtung „${direction}“.`);
  }
}

// ------------------------------------------------------------------ Würfel → Roh-Quads

function quadNormal(pos) {
  const ax = pos[0] - pos[3], ay = pos[1] - pos[4], az = pos[2] - pos[5];
  const bx = pos[6] - pos[3], by = pos[7] - pos[4], bz = pos[8] - pos[5];
  // (v2 − v1) × (v0 − v1) wie FaceBakery.calculateFacing
  return [by * az - bz * ay, bz * ax - bx * az, bx * ay - by * ax];
}

// cullface für Flächen, die nach außen zeigend auf der Blockgrenze liegen, sonst null.
function boundaryCull(pos) {
  const [nx, ny, nz] = quadNormal(pos);
  const length = Math.hypot(nx, ny, nz);
  if (length === 0) return null;
  const axes = [[Math.abs(nx) / length, nx, 0, 'west', 'east'], [Math.abs(ny) / length, ny, 1, 'down', 'up'], [Math.abs(nz) / length, nz, 2, 'north', 'south']];
  for (const [dominance, sign, axis, negative, positive] of axes) {
    if (dominance < 0.9999) continue;
    const target = sign > 0 ? 1 : 0;
    for (let i = 0; i < 4; i++) if (Math.abs(pos[i * 3 + axis] - target) > BOUNDARY_EPS) return null;
    return sign > 0 ? positive : negative;
  }
  return null;
}

function regionName(texture, x, y, w, h) {
  return `region:${texture}:${x},${y},${w},${h}`;
}

// Polygone wie ModelPart.Cube: Fläche, Eckpunkte (1 … 8 wie im Spiel), UV-Rechteck u1, v1, u2, v2.
function cubePolygons(u, v, w, h, d) {
  const l = u, m = u + d, n = u + d + w, o = u + d + w + w, p = u + d + w + d, q = u + d + w + d + w;
  const r = v, s = v + d, t = v + d + h;
  return [
    ['down', [6, 5, 1, 2], m, r, n, s],
    ['up', [3, 4, 8, 7], n, s, o, r],
    ['west', [1, 5, 8, 4], l, s, m, t],
    ['north', [2, 1, 4, 3], m, s, n, t],
    ['east', [6, 2, 3, 7], n, s, p, t],
    ['south', [5, 6, 7, 8], p, s, q, t],
  ];
}

function cubeQuads(cube, pose, material, out) {
  const [u, v] = cube.texOffs;
  const [x, y, z] = cube.from;
  const [w, h, d] = cube.size;
  const grow = cube.grow ?? 0;
  let x0 = x - grow, x1 = x + w + grow;
  const y0 = y - grow, y1 = y + h + grow, z0 = z - grow, z1 = z + d + grow;
  if (cube.mirror) [x0, x1] = [x1, x0];
  const corners = [null, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  for (const [face, ids, u1, v1, u2, v2] of cubePolygons(u, v, w, h, d)) {
    if (cube.faces && !cube.faces.includes(face)) continue;
    if (u1 === u2 || v1 === v2) continue; // Fläche ohne Ausdehnung
    const rx = Math.min(u1, u2), ry = Math.min(v1, v2), rw = Math.abs(u2 - u1), rh = Math.abs(v2 - v1);
    if (![rx, ry, rw, rh].every(Number.isInteger) || rx < 0 || ry < 0 || rx + rw > material.width || ry + rh > material.height) {
      throw new Error(`Sondermodell: Textur-Ausschnitt ${rx},${ry},${rw},${rh} passt nicht in ${material.texture} (${material.width}×${material.height}).`);
    }
    let points = ids.map((id) => corners[id]);
    let texCoords = [[u2, v1], [u1, v1], [u1, v2], [u2, v2]];
    if (cube.mirror) {
      points = points.reverse();
      texCoords = texCoords.reverse();
    }
    const pos = [];
    const uv = [];
    for (let i = 0; i < 4; i++) {
      const [px, py, pz] = transformPoint(pose, points[i][0] / 16, points[i][1] / 16, points[i][2] / 16);
      pos.push(px, py, pz);
      uv.push(((texCoords[i][0] - rx) / rw) * 16, ((texCoords[i][1] - ry) / rh) * 16);
    }
    out.push({
      pos, uv, texture: regionName(material.texture, rx, ry, rw, rh), tintIndex: -1, tint: material.tint ?? TINT_NONE,
      shade: true, cull: boundaryCull(pos), translucent: false, light: 0, ao: false,
    });
  }
}

// Wie ModelPart.translateAndRotate: verschieben (Pixel/16), drehen (rotationZYX), skalieren.
function partPose(part) {
  let pose = translate(...(part.offset ?? [0, 0, 0]).map((value) => value / 16));
  if (part.rotation) {
    const [xRot, yRot, zRot] = part.rotation;
    pose = compose(pose, rotationZ(zRot), rotationY(yRot), rotationX(xRot));
  }
  if (part.scale) pose = compose(pose, scale(...part.scale));
  return pose;
}

function collectPart(part, parentPose, materials, out) {
  const pose = multiply(parentPose, partPose(part));
  const material = materials[part.material ?? 'main'];
  if (!material) throw new Error(`Sondermodell: Material „${part.material}“ fehlt.`);
  for (const cube of part.cubes ?? []) cubeQuads(cube, pose, material, out);
  for (const child of part.children ?? []) collectPart(child, pose, materials, out);
}

function modelQuads(parts, pose, materials) {
  const out = [];
  for (const part of parts) collectPart(part, pose, materials, out);
  return out;
}

// ------------------------------------------------------------------ Modell-Tabellen (Pixel, wie im Spiel)

// ChestModel.createSingleBodyLayer / createDoubleBodyLeftLayer / createDoubleBodyRightLayer (64×64).
const CHEST_MODELS = Object.freeze({
  single: [
    { name: 'bottom', cubes: [{ texOffs: [0, 19], from: [1, 0, 1], size: [14, 10, 14] }] },
    { name: 'lid', offset: [0, 9, 1], cubes: [{ texOffs: [0, 0], from: [1, 0, 0], size: [14, 5, 14], grow: LID_GROW_PX }] },
    { name: 'lock', offset: [0, 9, 1], cubes: [{ texOffs: [0, 0], from: [7, -2, 14], size: [2, 4, 1] }] },
  ],
  left: [
    { name: 'bottom', cubes: [{ texOffs: [0, 19], from: [0, 0, 1], size: [15, 10, 14] }] },
    { name: 'lid', offset: [0, 9, 1], cubes: [{ texOffs: [0, 0], from: [0, 0, 0], size: [15, 5, 14], grow: LID_GROW_PX }] },
    { name: 'lock', offset: [0, 9, 1], cubes: [{ texOffs: [0, 0], from: [0, -2, 14], size: [1, 4, 1] }] },
  ],
  right: [
    { name: 'bottom', cubes: [{ texOffs: [0, 19], from: [1, 0, 1], size: [15, 10, 14] }] },
    { name: 'lid', offset: [0, 9, 1], cubes: [{ texOffs: [0, 0], from: [1, 0, 0], size: [15, 5, 14], grow: LID_GROW_PX }] },
    { name: 'lock', offset: [0, 9, 1], cubes: [{ texOffs: [0, 0], from: [15, -2, 14], size: [1, 4, 1] }] },
  ],
});

const CHEST_TEXTURES = new Map([
  ['chest', 'entity/chest/normal'],
  ['trapped_chest', 'entity/chest/trapped'],
  ['ender_chest', 'entity/chest/ender'],
]);
for (const [prefix, suffix] of [['', ''], ['exposed_', '_exposed'], ['weathered_', '_weathered'], ['oxidized_', '_oxidized']]) {
  CHEST_TEXTURES.set(`${prefix}copper_chest`, `entity/chest/copper${suffix}`);
  CHEST_TEXTURES.set(`waxed_${prefix}copper_chest`, `entity/chest/copper${suffix}`);
}

// ShulkerModel.createShellMesh (64×64).
const SHULKER_MODEL = Object.freeze([
  { name: 'lid', offset: [0, 24, 0], cubes: [{ texOffs: [0, 0], from: [-8, -16, -8], size: [16, 12, 16] }] },
  { name: 'base', offset: [0, 24, 0], cubes: [{ texOffs: [0, 28], from: [-8, -8, -8], size: [16, 8, 16] }] },
]);

// BannerModel.createBodyLayer + BannerFlagModel.createFlagLayer (64×64); Tuch ohne Wehen.
const BANNER_STANDING = Object.freeze([
  { name: 'pole', material: 'base', cubes: [{ texOffs: [44, 0], from: [-1, -42, -1], size: [2, 42, 2] }] },
  { name: 'bar', material: 'base', cubes: [{ texOffs: [0, 42], from: [-10, -44, -1], size: [20, 2, 2] }] },
  { name: 'flag', material: 'flag', offset: [0, -44, 0], cubes: [{ texOffs: [0, 0], from: [-10, 0, -2], size: [20, 40, 1] }] },
]);
const BANNER_WALL = Object.freeze([
  { name: 'bar', material: 'base', cubes: [{ texOffs: [0, 42], from: [-10, -20.5, 9.5], size: [20, 2, 2] }] },
  { name: 'flag', material: 'flag', offset: [0, -20.5, 10.5], cubes: [{ texOffs: [0, 0], from: [-10, 0, -2], size: [20, 40, 1] }] },
]);

// SkullModel.createHeadModel (+ Hut-Schicht bei createHumanoidHeadLayer).
function skullHead(yRot, humanoid) {
  return [{
    name: 'head', rotation: [0, yRot, 0],
    cubes: [{ texOffs: [0, 0], from: [-4, -8, -4], size: [8, 8, 8] }],
    children: humanoid ? [{ name: 'hat', cubes: [{ texOffs: [32, 0], from: [-4, -8, -4], size: [8, 8, 8], grow: 0.25 }] }] : [],
  }];
}

// PiglinModel.addHead (64×64); Ohren wie PiglinHeadModel.setupAnim ohne Animation (±0,7 rad).
function piglinHead(yRot) {
  return [{
    name: 'head', rotation: [0, yRot, 0],
    cubes: [
      { texOffs: [0, 0], from: [-5, -8, -4], size: [10, 8, 8] },
      { texOffs: [31, 1], from: [-2, -4, -5], size: [4, 4, 1] },
      { texOffs: [2, 4], from: [2, -2, -5], size: [1, 2, 1] },
      { texOffs: [2, 0], from: [-3, -2, -5], size: [1, 2, 1] },
    ],
    children: [
      { name: 'left_ear', offset: [4.5, -6, 0], rotation: [0, 0, -0.7], cubes: [{ texOffs: [51, 6], from: [0, 0, -2], size: [1, 5, 4] }] },
      { name: 'right_ear', offset: [-4.5, -6, 0], rotation: [0, 0, 0.7], cubes: [{ texOffs: [39, 6], from: [-1, 0, -2], size: [1, 5, 4] }] },
    ],
  }];
}

// DragonHeadModel (256×256), Kiefer wie setupAnim ohne Animation (0,2 rad offen).
function dragonHead(yRot) {
  return [{
    name: 'head', rotation: [0, yRot, 0],
    cubes: [
      { texOffs: [176, 44], from: [-6, -1, -24], size: [12, 5, 16] },
      { texOffs: [112, 30], from: [-8, -8, -10], size: [16, 16, 16] },
      { texOffs: [0, 0], from: [-5, -12, -4], size: [2, 4, 6], mirror: true },
      { texOffs: [112, 0], from: [-5, -3, -22], size: [2, 2, 4], mirror: true },
      { texOffs: [0, 0], from: [3, -12, -4], size: [2, 4, 6] },
      { texOffs: [112, 0], from: [3, -3, -22], size: [2, 2, 4] },
    ],
    children: [{ name: 'jaw', offset: [0, 4, -8], rotation: [0.2, 0, 0], cubes: [{ texOffs: [176, 65], from: [-6, 0, -16], size: [12, 4, 16] }] }],
  }];
}

const SKULLS = Object.freeze({
  skeleton: { model: 'mob', texture: 'entity/skeleton/skeleton', width: 64, height: 32 },
  wither_skeleton: { model: 'mob', texture: 'entity/skeleton/wither_skeleton', width: 64, height: 32 },
  creeper: { model: 'mob', texture: 'entity/creeper/creeper', width: 64, height: 32 },
  zombie: { model: 'humanoid', texture: 'entity/zombie/zombie', width: 64, height: 64 },
  player: { model: 'humanoid', texture: 'entity/player/wide/steve', width: 64, height: 64 },
  piglin: { model: 'piglin', texture: 'entity/piglin/piglin', width: 64, height: 64 },
  dragon: { model: 'dragon', texture: 'entity/enderdragon/dragon', width: 256, height: 256 },
});
const SKULL_IDS = new Map();
for (const type of Object.keys(SKULLS)) {
  const word = type === 'skeleton' || type === 'wither_skeleton' ? 'skull' : 'head';
  SKULL_IDS.set(`${type}_${word}`, { type, wall: false });
  SKULL_IDS.set(`${type}_wall_${word}`, { type, wall: true });
}

// BellModel (32×32): Glockenkörper; Gestell und Balken kommen aus dem JSON-Modell.
const BELL_BODY = Object.freeze([{
  name: 'bell_body', offset: [8, 12, 8],
  cubes: [{ texOffs: [0, 0], from: [-3, -6, -3], size: [6, 7, 6] }],
  children: [{ name: 'bell_base', offset: [-8, -12, -8], cubes: [{ texOffs: [0, 13], from: [4, 4, 4], size: [8, 2, 8] }] }],
}]);

// DecoratedPotRenderer.createBaseLayer (32×32) und createSidesLayer (16×16, ohne Scherben-Muster).
const POT_SIDE = { texOffs: [1, 0], from: [0, 0, 0], size: [14, 16, 0], faces: ['north'] };
const POT_PLATE = { texOffs: [-14, 13], from: [0, 0, 0], size: [14, 0, 14] };
const DECORATED_POT = Object.freeze([
  {
    name: 'neck', offset: [0, 37, 16], rotation: [Math.PI, 0, 0],
    cubes: [
      { texOffs: [0, 0], from: [4, 17, 4], size: [8, 3, 8], grow: -0.1 },
      { texOffs: [0, 5], from: [5, 20, 5], size: [6, 1, 6], grow: 0.2 },
    ],
  },
  { name: 'top', offset: [1, 16, 1], cubes: [POT_PLATE] },
  { name: 'bottom', offset: [1, 0, 1], cubes: [POT_PLATE] },
  { name: 'back', material: 'side', offset: [15, 16, 1], rotation: [0, 0, Math.PI], cubes: [POT_SIDE] },
  { name: 'left', material: 'side', offset: [1, 16, 1], rotation: [0, -Math.PI / 2, Math.PI], cubes: [POT_SIDE] },
  { name: 'right', material: 'side', offset: [15, 16, 15], rotation: [0, Math.PI / 2, Math.PI], cubes: [POT_SIDE] },
  { name: 'front', material: 'side', offset: [1, 16, 15], rotation: [Math.PI, 0, 0], cubes: [POT_SIDE] },
]);

// ConduitRenderer.createShellLayer (32×16): ruhender Aquisitor ohne Käfig und Auge.
const CONDUIT_SHELL = Object.freeze([{ name: 'shell', cubes: [{ texOffs: [0, 0], from: [-3, -3, -3], size: [6, 6, 6] }] }]);

// Ersatz für den Sternen-Shader des Endportals (Textur liegt nicht in textures.bin).
const END_PORTAL_TEXTURE = 'block/black_concrete';

// ------------------------------------------------------------------ Arten

const INVISIBLE = new Set(['air', 'cave_air', 'void_air', 'light', 'barrier', 'structure_void', 'moving_piston']);
const FLUID_BLOCKS = new Set(['water', 'lava', 'bubble_column']);
const ALWAYS_WATERLOGGED = new Set(['kelp', 'kelp_plant', 'seagrass', 'tall_seagrass', 'bubble_column']);

function bannerColor(id) {
  for (const color of DYE_NAMES) {
    if (id === `${color}_banner`) return { color, wall: false };
    if (id === `${color}_wall_banner`) return { color, wall: true };
  }
  return null;
}

function shulkerTexture(id) {
  if (id === 'shulker_box') return 'entity/shulker/shulker';
  const color = id.endsWith('_shulker_box') ? id.slice(0, -'_shulker_box'.length) : null;
  return color && Object.hasOwn(DYE_COLORS, color) ? `entity/shulker/shulker_${color}` : null;
}

// Art des Sondermodells oder null (dann gilt nur das JSON-Modell).
export function specialKind(id) {
  if (INVISIBLE.has(id)) return 'invisible';
  if (FLUID_BLOCKS.has(id)) return 'fluid';
  if (CHEST_TEXTURES.has(id)) return 'chest';
  const banner = bannerColor(id);
  if (banner) return banner.wall ? 'wall_banner' : 'banner';
  if (shulkerTexture(id)) return 'shulker_box';
  const skull = SKULL_IDS.get(id);
  if (skull) return skull.wall ? 'wall_skull' : 'skull';
  if (id === 'bell') return 'bell';
  if (id === 'decorated_pot') return 'decorated_pot';
  if (id === 'conduit') return 'conduit';
  if (id === 'end_portal') return 'end_portal';
  if (id === 'end_gateway') return 'end_gateway';
  return null;
}

// Das JSON-Modell zeichnet zusätzlich (Glocke: Gestell aus JSON, Körper als Sondermodell).
export function keepsJsonModel(kind) {
  return kind === null || kind === 'bell';
}

function rotationSegment(props) {
  const value = Number(props.rotation ?? 0);
  if (!Number.isInteger(value) || value < 0 || value > 15) throw new Error(`rotation muss 0 … 15 sein (bekommen: ${props.rotation}).`);
  return value;
}

function chestQuads(id, props) {
  const type = props.type ?? 'single';
  const base = CHEST_TEXTURES.get(id);
  const texture = type === 'left' ? `${base}_left` : type === 'right' ? `${base}_right` : base;
  const model = CHEST_MODELS[type];
  if (!model) throw new Error(`Truhe „${id}“: unbekannter type „${type}“.`);
  const pose = compose(translate(0.5, 0.5, 0.5), rotationY(-yRotOf(props.facing ?? 'north') * DEG), translate(-0.5, -0.5, -0.5));
  return modelQuads(model, pose, { main: { texture, width: 64, height: 64 } });
}

function shulkerQuads(id, props) {
  const pose = compose(translate(0.5, 0.5, 0.5), directionRotation(props.facing ?? 'up'), scale(1, -1, -1), translate(0, -1, 0));
  return modelQuads(SHULKER_MODEL, pose, { main: { texture: shulkerTexture(id), width: 64, height: 64 } });
}

function bannerQuads(id, props) {
  const { color, wall } = bannerColor(id);
  const pose = wall
    ? compose(translate(0.5, -1 / 6, 0.5), rotationY(-yRotOf(props.facing ?? 'north') * DEG), scale(2 / 3, -2 / 3, -2 / 3))
    : compose(translate(0.5, 0, 0.5), rotationY(-22.5 * rotationSegment(props) * DEG), scale(2 / 3, -2 / 3, -2 / 3));
  return modelQuads(wall ? BANNER_WALL : BANNER_STANDING, pose, {
    base: { texture: 'entity/banner/banner_base', width: 64, height: 64 },
    flag: { texture: 'entity/banner/base', width: 64, height: 64, tint: DYE_COLORS[color] },
  });
}

// SkullBlockRenderer.renderSkull: Wandköpfe sitzen 1/4 Block vor der Wand, Blickrichtung = facing.
// Stehende Köpfe: Drehung 22,5° · rotation um +Y (rotation 0 = Blick nach Norden, 8 = nach Süden).
function skullQuads(id, props) {
  const { type, wall } = SKULL_IDS.get(id);
  const info = SKULLS[type];
  let pose;
  let yRotDeg;
  if (wall) {
    const facing = props.facing ?? 'north';
    const [sx, , sz] = STEP[facing];
    pose = compose(translate(0.5 - sx * 0.25, 0.25, 0.5 - sz * 0.25), scale(-1, -1, 1));
    yRotDeg = yRotOf(OPPOSITE[facing]);
  } else {
    pose = compose(translate(0.5, 0, 0.5), scale(-1, -1, 1));
    yRotDeg = 22.5 * rotationSegment(props);
  }
  const yRot = yRotDeg * DEG;
  let parts;
  if (info.model === 'piglin') parts = piglinHead(yRot);
  else if (info.model === 'dragon') {
    parts = dragonHead(yRot);
    pose = compose(pose, translate(0, -0.374375, 0), scale(0.75, 0.75, 0.75));
  } else parts = skullHead(yRot, info.model === 'humanoid');
  return modelQuads(parts, pose, { main: { texture: info.texture, width: info.width, height: info.height } });
}

function decoratedPotQuads(props) {
  const pose = compose(translate(0.5, 0, 0.5), rotationY((180 - yRotOf(props.facing ?? 'north')) * DEG), translate(-0.5, 0, -0.5));
  return modelQuads(DECORATED_POT, pose, {
    main: { texture: 'entity/decorated_pot/decorated_pot_base', width: 32, height: 32 },
    side: { texture: 'entity/decorated_pot/decorated_pot_side', width: 16, height: 16 },
  });
}

// Flache, leuchtende Ersatzflächen; faces: Liste [richtung, höhe/ebene].
function plainFaces(faces) {
  return faces.map(([dir, level]) => {
    const pos = {
      up: [0, level, 0, 0, level, 1, 1, level, 1, 1, level, 0],
      down: [0, level, 1, 0, level, 0, 1, level, 0, 1, level, 1],
      north: [1, 1, level, 1, 0, level, 0, 0, level, 0, 1, level],
      south: [0, 1, level, 0, 0, level, 1, 0, level, 1, 1, level],
      west: [level, 1, 0, level, 0, 0, level, 0, 1, level, 1, 1],
      east: [level, 1, 1, level, 0, 1, level, 0, 0, level, 1, 0],
    }[dir];
    return {
      pos, uv: [0, 0, 0, 16, 16, 16, 16, 0], texture: END_PORTAL_TEXTURE, tintIndex: -1, tint: TINT_NONE,
      shade: false, cull: boundaryCull(pos), translucent: false, light: 15, ao: false,
    };
  });
}

// Roh-Quads des Sondermodells (blocklokal). props = Eigenschaften des vollständigen Zustands.
export function specialQuads(id, props = {}) {
  switch (specialKind(id)) {
    case 'chest': return chestQuads(id, props);
    case 'shulker_box': return shulkerQuads(id, props);
    case 'banner':
    case 'wall_banner': return bannerQuads(id, props);
    case 'skull':
    case 'wall_skull': return skullQuads(id, props);
    case 'bell': return modelQuads(BELL_BODY, IDENTITY, { main: { texture: 'entity/bell/bell_body', width: 32, height: 32 } });
    case 'decorated_pot': return decoratedPotQuads(props);
    case 'conduit': return modelQuads(CONDUIT_SHELL, translate(0.5, 0.5, 0.5), { main: { texture: 'entity/conduit/base', width: 32, height: 16 } });
    // TheEndPortalRenderer: Endportal oben auf 0,75 und unten auf 0,375; Transitportal als ganzer Würfel.
    case 'end_portal': return plainFaces([['up', 0.75], ['down', 0.375]]);
    case 'end_gateway': return plainFaces([['up', 1], ['down', 0], ['north', 0], ['south', 1], ['west', 0], ['east', 1]]);
    default: return [];
  }
}

// ------------------------------------------------------------------ Flüssigkeiten

export const FLUID_SURFACE = 14 / 16;

export const FLUID_TEXTURES = Object.freeze({
  water: Object.freeze({ still: 'block/water_still', flow: 'block/water_flow', overlay: 'block/water_overlay', tint: PLAINS_COLORS.water, light: 0 }),
  lava: Object.freeze({ still: 'block/lava_still', flow: 'block/lava_flow', overlay: null, tint: TINT_NONE, light: 15 }),
});

function fluidLevel(id, props) {
  const level = Number(props.level ?? 0);
  if (!Number.isInteger(level) || level < 0 || level > 15) throw new Error(`${id}: level muss 0 … 15 sein (bekommen: ${props.level}).`);
  return level;
}

// Flüssigkeit im Block: Wasser/Lava (level 0 = Quelle, 1 … 7 fließend, ab 8 fallend), Blasensäule,
// wassergeflutete Blöcke und Pflanzen, die immer im Wasser stehen. amount 1 … 8 wie FlowingFluid.
export function fluidOf(id, props = {}) {
  if (id === 'water' || id === 'lava') {
    const level = fluidLevel(id, props);
    return { type: id, amount: level === 0 || level >= 8 ? 8 : 8 - level, falling: level >= 8 };
  }
  if (ALWAYS_WATERLOGGED.has(id) || props.waterlogged === 'true') return { type: 'water', amount: 8, falling: false };
  return null;
}

// Eigene Höhe der Oberfläche (Quelle 14/16, fließend anteilig).
export function fluidHeight(amount) {
  return (amount / 8) * FLUID_SURFACE;
}

// Wie LiquidBlockRenderer.calculateAverageHeight: Ecke aus eigener Höhe, zwei Seiten und Diagonale.
// Höhe 1 = Flüssigkeit darüber, 0 = Luft/nicht fest (zieht die Ecke nach unten), −1 = fester Block (zählt nicht).
export function averageCornerHeight(own, side1, side2, diagonal) {
  if (side1 >= 1 || side2 >= 1) return 1;
  let sum = 0;
  let weight = 0;
  const add = (height) => {
    if (height >= 0.8) {
      sum += height * 10;
      weight += 10;
    } else if (height >= 0) {
      sum += height;
      weight += 1;
    }
  };
  if (side1 > 0 || side2 > 0) {
    if (diagonal >= 1) return 1;
    add(diagonal);
  }
  add(own);
  add(side1);
  add(side2);
  return weight > 0 ? sum / weight : own;
}

/**
 * Flächen einer Flüssigkeit (blocklokal) wie LiquidBlockRenderer: oben/unten „still“, Seiten „flow“
 * (linke obere Viertel der 32er-Textur) oder „overlay“ neben Glas/Laub.
 * heights: Ecken { nw, ne, se, sw } in Blöcken; faces: { up, down, north, south, west, east } (true = zeichnen);
 * overlay: { north, … } (true = Overlay-Textur an dieser Seite).
 * Rückgabe: [{ dir, pos: [12], uv: [8], sprite: 'still'|'flow'|'overlay' }]
 */
export function fluidFaces({ heights, faces, overlay = {} }) {
  const { nw, ne, se, sw } = heights;
  const out = [];
  const top = (h) => h - FLUID_EPS;
  if (faces.up) {
    out.push({ dir: 'up', sprite: 'still', pos: [0, top(nw), 0, 0, top(sw), 1, 1, top(se), 1, 1, top(ne), 0], uv: [0, 0, 0, 16, 16, 16, 16, 0] });
  }
  const bottom = faces.down ? FLUID_EPS : 0;
  if (faces.down) {
    out.push({ dir: 'down', sprite: 'still', pos: [0, bottom, 1, 0, bottom, 0, 1, bottom, 0, 1, bottom, 1], uv: [0, 0, 0, 16, 16, 16, 16, 0] });
  }
  const v = (h) => (1 - h) * 8;
  const side = (dir, a, b, ha, hb) => {
    // a = Ecke mit u = 8 (erste Ecke in Vertex-Reihenfolge), b = Ecke mit u = 0
    out.push({
      dir, sprite: overlay[dir] ? 'overlay' : 'flow',
      pos: [a[0], ha, a[1], a[0], bottom, a[1], b[0], bottom, b[1], b[0], hb, b[1]],
      uv: [8, v(ha), 8, 8, 0, 8, 0, v(hb)],
    });
  };
  const near = FLUID_EPS, far = 1 - FLUID_EPS;
  if (faces.north) side('north', [1, near], [0, near], ne, nw);
  if (faces.south) side('south', [0, far], [1, far], sw, se);
  if (faces.west) side('west', [near, 0], [near, 1], nw, sw);
  if (faces.east) side('east', [far, 1], [far, 0], se, ne);
  return out;
}
