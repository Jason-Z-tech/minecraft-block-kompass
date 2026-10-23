// Kleine Vektor-/Matrix-Helfer für WebGL. Matrizen: Float32Array(16), Spalten-Hauptordnung wie OpenGL
// (Element (Zeile r, Spalte c) = m[c * 4 + r]), rechtshändig, Clip-Raum z −1 … 1.
// Alle Funktionen schreiben in `out` und geben `out` zurück (keine versteckten Allokationen).

const EPSILON = 1e-12;

export const mat4 = Object.freeze({
  create() {
    return mat4.identity(new Float32Array(16));
  },

  identity(out) {
    out.fill(0);
    out[0] = 1;
    out[5] = 1;
    out[10] = 1;
    out[15] = 1;
    return out;
  },

  copy(out, a) {
    out.set(a);
    return out;
  },

  // out = a · b (erst b, dann a anwenden). out darf a oder b sein.
  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let col = 0; col < 4; col++) {
      const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3];
      out[col * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      out[col * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      out[col * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      out[col * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return out;
  },

  fromTranslation(out, v) {
    mat4.identity(out);
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    return out;
  },

  // Perspektive mit senkrechtem Sichtwinkel fovY (Bogenmaß). far = Infinity ergibt eine unendlich ferne Ebene.
  perspective(out, fovY, aspect, near, far) {
    if (!(fovY > 0 && fovY < Math.PI) || !(aspect > 0) || !(near > 0) || !(far > near)) {
      throw new Error(`perspective: ungültige Werte (fovY ${fovY}, aspect ${aspect}, near ${near}, far ${far}).`);
    }
    const f = 1 / Math.tan(fovY / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[11] = -1;
    if (far === Infinity) {
      out[10] = -1;
      out[14] = -2 * near;
    } else {
      const nf = 1 / (near - far);
      out[10] = (far + near) * nf;
      out[14] = 2 * far * near * nf;
    }
    return out;
  },

  ortho(out, left, right, bottom, top, near, far) {
    if (left === right || bottom === top || near === far) throw new Error('ortho: Grenzen dürfen nicht gleich sein.');
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 2 * nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
  },

  // Kamera bei eye, blickt auf center. up darf nicht parallel zur Blickrichtung sein.
  lookAt(out, eye, center, up) {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz);
    if (len < EPSILON) throw new Error('lookAt: eye und center sind gleich.');
    zx /= len; zy /= len; zz /= len;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz);
    if (len < EPSILON) throw new Error('lookAt: up ist parallel zur Blickrichtung.');
    xx /= len; xy /= len; xz /= len;
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  },

  // Inverse; gibt null zurück, wenn die Matrix nicht umkehrbar ist (out bleibt dann unverändert).
  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!Number.isFinite(det) || Math.abs(det) < EPSILON) return null;
    const inv = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * inv;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * inv;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * inv;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * inv;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * inv;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * inv;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * inv;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * inv;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * inv;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * inv;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * inv;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * inv;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * inv;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * inv;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * inv;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * inv;
    return out;
  },

  // Punkt (w = 1) transformieren, mit Division durch w.
  transformPoint(out, m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const s = w !== 0 ? 1 / w : 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * s;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * s;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * s;
    return out;
  },

  // Richtung (w = 0) transformieren: nur der 3×3-Teil.
  transformDirection(out, m, v) {
    const x = v[0], y = v[1], z = v[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
  },

  transformVec4(out, m, v) {
    const x = v[0], y = v[1], z = v[2], w = v[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
  },
});

export const vec3 = Object.freeze({
  create(x = 0, y = 0, z = 0) {
    const out = new Float64Array(3);
    out[0] = x; out[1] = y; out[2] = z;
    return out;
  },
  set(out, x, y, z) {
    out[0] = x; out[1] = y; out[2] = z;
    return out;
  },
  copy(out, a) {
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
    return out;
  },
  add(out, a, b) {
    out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2];
    return out;
  },
  sub(out, a, b) {
    out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
    return out;
  },
  scale(out, a, s) {
    out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s;
    return out;
  },
  // out = a + b · s
  scaleAndAdd(out, a, b, s) {
    out[0] = a[0] + b[0] * s; out[1] = a[1] + b[1] * s; out[2] = a[2] + b[2] * s;
    return out;
  },
  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  cross(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },
  length(a) {
    return Math.hypot(a[0], a[1], a[2]);
  },
  distance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  },
  // Nullvektor bleibt Nullvektor.
  normalize(out, a) {
    const len = Math.hypot(a[0], a[1], a[2]);
    const s = len > 0 ? 1 / len : 0;
    out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s;
    return out;
  },
  lerp(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  },
});

// Sechs Ebenen (links, rechts, unten, oben, nah, fern) als [nx, ny, nz, d] aus der View-Projection-Matrix
// (Gribb/Hartmann). Punkt p liegt innen, wenn n·p + d ≥ 0. Normalen sind normiert, außer bei der
// fernen Ebene einer unendlichen Perspektive (Normale 0 → immer innen).
export function frustumPlanes(out, viewProj) {
  const m = viewProj;
  const rows = [
    [m[0], m[4], m[8], m[12]],
    [m[1], m[5], m[9], m[13]],
    [m[2], m[6], m[10], m[14]],
    [m[3], m[7], m[11], m[15]],
  ];
  const w = rows[3];
  const combos = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
  for (let i = 0; i < 6; i++) {
    const [row, sign] = combos[i];
    const r = rows[row];
    let a = w[0] + sign * r[0], b = w[1] + sign * r[1], c = w[2] + sign * r[2], d = w[3] + sign * r[3];
    const len = Math.hypot(a, b, c);
    if (len > 1e-9) {
      a /= len; b /= len; c /= len; d /= len;
    } else {
      a = 0; b = 0; c = 0; d = d >= 0 ? 1 : -1;
    }
    out[i * 4] = a;
    out[i * 4 + 1] = b;
    out[i * 4 + 2] = c;
    out[i * 4 + 3] = d;
  }
  return out;
}

// Konservativer Test: false nur, wenn die Box sicher außerhalb liegt.
export function aabbInFrustum(planes, minX, minY, minZ, maxX, maxY, maxZ) {
  for (let i = 0; i < 24; i += 4) {
    const a = planes[i], b = planes[i + 1], c = planes[i + 2], d = planes[i + 3];
    const x = a >= 0 ? maxX : minX;
    const y = b >= 0 ? maxY : minY;
    const z = c >= 0 ? maxZ : minZ;
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}
