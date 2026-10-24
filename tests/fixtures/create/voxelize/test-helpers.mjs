// Hilfen für die Voxel-Tests: synthetische Blockfarben (eigene Näherungswerte, keine Spieldaten – so laufen die
// Tests auch ohne game-data/) und Mesh-Generatoren (Kugel).

import { SRGB_TO_LINEAR, linearToLab, BLOCK_COLORS_FORMAT } from '../../../../js/create/voxelize/colors.js';

// [id, Gruppe, sRGB, Merkmale]
const TABLE = [
  ['white_concrete', 'beton', [207, 213, 214]], ['orange_concrete', 'beton', [224, 97, 1]],
  ['magenta_concrete', 'beton', [169, 48, 159]], ['light_blue_concrete', 'beton', [36, 137, 199]],
  ['yellow_concrete', 'beton', [241, 175, 21]], ['lime_concrete', 'beton', [94, 169, 24]],
  ['pink_concrete', 'beton', [214, 101, 143]], ['gray_concrete', 'beton', [55, 58, 62]],
  ['light_gray_concrete', 'beton', [125, 125, 115]], ['cyan_concrete', 'beton', [21, 119, 136]],
  ['purple_concrete', 'beton', [100, 32, 156]], ['blue_concrete', 'beton', [45, 47, 143]],
  ['brown_concrete', 'beton', [96, 60, 32]], ['green_concrete', 'beton', [73, 91, 36]],
  ['red_concrete', 'beton', [142, 33, 33]], ['black_concrete', 'beton', [8, 10, 15]],
  ['white_wool', 'wolle', [234, 236, 237]], ['red_wool', 'wolle', [161, 39, 35]], ['blue_wool', 'wolle', [53, 57, 157]],
  ['lime_wool', 'wolle', [112, 185, 26]], ['yellow_wool', 'wolle', [249, 198, 40]], ['black_wool', 'wolle', [21, 21, 26]],
  ['terracotta', 'terrakotta', [152, 94, 68]], ['red_terracotta', 'terrakotta', [143, 61, 47]],
  ['white_terracotta', 'terrakotta', [210, 178, 161]],
  ['stone', 'stein', [126, 126, 126], { pattern: 3 }],
  ['oak_planks', 'holz', [162, 131, 79], { pattern: 6 }],
  ['sand', 'natur', [219, 207, 163], { falls: true }],
  ['glowstone', 'licht', [172, 131, 84], { emissive: true }],
  ['coal_ore', 'erz', [105, 105, 105]],
  ['command_block', 'sonder', [181, 136, 108], { special: true }],
  ['grass_block', 'natur', [127, 107, 65], { changes: true, top: [91, 139, 50] }],
];

function face(rgb, pattern) {
  const lab = linearToLab(SRGB_TO_LINEAR[rgb[0]], SRGB_TO_LINEAR[rgb[1]], SRGB_TO_LINEAR[rgb[2]]).map((v) => Math.round(v * 100) / 100);
  return { rgb, lab, pattern };
}

/** Blockfarben im Format von game-data/block-colors.json (neues Objekt je Aufruf). */
export function testBlockColors() {
  const blocks = {};
  for (const [id, group, rgb, extra = {}] of TABLE) {
    const pattern = extra.pattern ?? 1;
    blocks[id] = {
      state: id === 'grass_block' ? 'grass_block[snowy=false]' : id,
      group,
      top: face(extra.top ?? rgb, pattern), side: face(rgb, pattern), bottom: face(rgb, pattern), all: face(rgb, pattern),
      animated: false, light: extra.emissive ? 15 : 0, emissive: extra.emissive === true, tinted: false,
      falls: extra.falls === true, changes: extra.changes === true, special: extra.special === true,
    };
  }
  return { format: BLOCK_COLORS_FORMAT, version: 'test', generatedAt: '2026-10-23T00:00:00.000Z', count: TABLE.length, blocks };
}

/** UV-Kugel um den Ursprung (Pole auf z), als Dreiecke [[p0, p1, p2], …]; skip = Indizes, die fehlen sollen. */
export function sphereTriangles(radius, segments, rings, { skip = new Set() } = {}) {
  const point = (ring, segment) => {
    const theta = (Math.PI * ring) / rings;
    const phi = (2 * Math.PI * segment) / segments;
    const s = Math.sin(theta);
    return [radius * s * Math.cos(phi), radius * s * Math.sin(phi), radius * Math.cos(theta)];
  };
  const triangles = [];
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = point(ring, segment), b = point(ring + 1, segment), c = point(ring + 1, segment + 1), d = point(ring, segment + 1);
      if (ring > 0) triangles.push([a, b, d]);
      if (ring < rings - 1) triangles.push([b, c, d]);
    }
  }
  return skip.size ? triangles.filter((_, i) => !skip.has(i)) : triangles;
}

/** Volumen-Ergebnis → Funktion (x, y, z) → Palettenindex (außerhalb 0). */
export function voxelReader({ size, data }) {
  const [w, h, l] = size;
  return (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= l ? 0 : data[(y * l + z) * w + x]);
}

/** Zellen, die von außen über Flächen (6er-Nachbarschaft) erreichbar und leer sind. */
export function outsideReachable({ size, data }) {
  const [w, h, l] = size;
  const W = w + 2, H = h + 2, L = l + 2;
  const seen = new Uint8Array(W * H * L);
  const at = voxelReader({ size, data });
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const cell = stack.pop();
    const x = cell % W, z = Math.floor(cell / W) % L, y = Math.floor(cell / (W * L));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= L) continue;
      const next = (ny * L + nz) * W + nx;
      if (seen[next] || at(nx - 1, ny - 1, nz - 1)) continue;
      seen[next] = 1;
      stack.push(next);
    }
  }
  return (x, y, z) => seen[((y + 1) * L + (z + 1)) * W + (x + 1)] === 1;
}
