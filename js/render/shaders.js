// GLSL-Quellen der 3D-Ansicht (WebGL2, GLSL ES 3.00) und ein Helfer zum Übersetzen.
// Block-Shader liest das Vertex-Format aus ARCHITEKTUR §7.2 (24 Byte je Vertex, Schritt-/Kappen-Meshes
// zusätzlich mit centers). Rein: kein DOM beim Laden, in Node importierbar.

// Feste Attribut-Plätze (layout(location = …) in den Shadern).
export const ATTRIBUTES = Object.freeze({ position: 0, layer: 1, uv: 2, color: 3, showHide: 4, flags: 5, center: 6 });

// Mesh-Arten im Block-Shader (uKind) und Durchgänge (uPass).
export const MESH_KIND = Object.freeze({ chunk: 0, step: 1, cap: 2 });
export const PASS = Object.freeze({ normal: 0, ghost: 1 });

// Plopp-Animation: Blöcke starten nach ihrer Reihenfolge (0 … 1) über PLOP_SPREAD des Schritts verteilt
// und brauchen je PLOP_DURATION (Anteil des Schritts). PLOP_SPREAD + PLOP_DURATION = 1 → am Ende ist alles da.
export const PLOP_SPREAD = 0.7;
export const PLOP_DURATION = 0.3;

const GLSL_PLOP = `
const float PLOP_SPREAD = ${PLOP_SPREAD.toFixed(4)};
const float PLOP_DURATION = ${PLOP_DURATION.toFixed(4)};
float easeOutBack(float t) {
  const float c1 = 1.70158;
  const float c3 = c1 + 1.0;
  float k = t - 1.0;
  return 1.0 + c3 * k * k * k + c1 * k * k;
}`;

export const BLOCK_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in float aLayer;
layout(location = 2) in vec2 aUv;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec2 aShowHide;
layout(location = 5) in float aFlags;
layout(location = 6) in vec4 aCenter;

uniform mat4 uViewProj;
uniform vec3 uOrigin;
uniform vec3 uCamera;
uniform int uKind;        // 0 Chunk, 1 laufender Schritt, 2 Kappe der Schnittansicht
uniform int uPass;        // 0 normal, 1 Geist
uniform float uCur;       // laufender Schritt
uniform float uFrac;      // Anteil des laufenden Schritts (0 … 1)
uniform float uAnimate;   // 1 = Plopp-Animation, 0 = ohne (prefers-reduced-motion)
uniform vec2 uClip;       // sichtbare Block-y von … bis
uniform float uHighlight; // hervorgehobener Schritt oder -1
uniform float uGhost;     // 1 = alle künftigen Blöcke als Geist, 0 = nur ein hervorgehobener künftiger Schritt

out vec3 vUv;
out vec3 vColor;
out float vEmissive;
out float vMark;
out float vDistance;

const float HIDE_NEVER = 65535.0;
${GLSL_PLOP}

void main() {
  // Schritt- und Kappen-Meshes: Positionen sind chunk-lokal zum Chunk des Blocks
  vec3 origin = uKind == 0 ? uOrigin : floor(aCenter.xyz / 16.0) * 16.0;
  vec3 world = origin + aPos / 256.0;
  float blockY = origin.y + floor(aFlags / 16.0);
  float show = aShowHide.x;
  float hide = aShowHide.y;
  bool marked = show == uHighlight;
  bool visible;
  if (uKind == 1) {
    float t = clamp((uFrac - aCenter.w * PLOP_SPREAD) / PLOP_DURATION, 0.0, 1.0);
    bool started = t > 0.0;
    if (uPass == 0) {
      visible = started;
      if (started && uAnimate > 0.5) world = aCenter.xyz + (world - aCenter.xyz) * easeOutBack(t);
    } else {
      visible = !started && (uGhost > 0.5 || marked);
    }
  } else if (uPass == 0) {
    visible = show < uCur && hide >= uCur;
  } else {
    // Geist: künftige Blöcke mit den Flächen des fertigen Baus (hide = nie); ein hervorgehobener künftiger
    // Schritt mit den Flächen, die direkt nach diesem Schritt sichtbar sind (hide > Schritt)
    bool future = show > uCur || (uKind == 2 && show == uCur && uFrac <= 0.0);
    visible = future && ((uGhost > 0.5 && hide == HIDE_NEVER) || (marked && hide > uHighlight));
  }
  if (blockY < uClip.x || blockY > uClip.y) visible = false;
  vUv = vec3(aUv / 1024.0, aLayer);
  vColor = aColor.rgb * aColor.a;
  vEmissive = mod(aFlags, 2.0);
  vMark = marked ? 1.0 : 0.0;
  vDistance = distance(world, uCamera);
  gl_Position = visible ? uViewProj * vec4(world, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;

// Variante ohne discard für die deckende Schicht: mit discard im Shader schalten viele GPUs den frühen
// Tiefentest ab, dann würde jede verdeckte Fläche voll gerechnet.
export function blockFragment({ alphaTest = true } = {}) {
  return alphaTest ? BLOCK_FRAGMENT : BLOCK_FRAGMENT.replace(/^ {2}if \(uLayer == [12] && texel\.a < 0\.[15]\) discard;\n/gm, '');
}

export const BLOCK_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform sampler2DArray uTexture;
uniform int uLayer;       // 0 solid, 1 cutout, 2 translucent
uniform int uPass;
uniform float uPulse;     // 0 … 1 (Hervorhebung)
uniform vec3 uFogColor;
uniform vec2 uFogRange;
in vec3 vUv;
in vec3 vColor;
in float vEmissive;
in float vMark;
in float vDistance;
out vec4 outColor;

const vec3 HIGHLIGHT = vec3(0.949, 0.757, 0.306);
const vec3 GHOST = vec3(0.73, 0.87, 1.0);

void main() {
  vec4 texel = texture(uTexture, vUv);
  // Alpha-Test wie Minecraft 26.2: cutout 0,5, durchscheinend 0,1
  if (uLayer == 1 && texel.a < 0.5) discard;
  if (uLayer == 2 && texel.a < 0.1) discard;
  vec3 rgb = texel.rgb * vColor;
  float alpha = uLayer == 2 ? texel.a : 1.0;
  if (uPass == 1) {
    bool marked = vMark > 0.5;
    rgb = mix(rgb, marked ? HIGHLIGHT : GHOST, marked ? 0.6 : 0.55);
    alpha = marked ? 0.45 + 0.2 * uPulse : 0.3;
  } else if (vMark > 0.5) {
    rgb = mix(rgb, HIGHLIGHT, 0.25 + 0.2 * uPulse);
  }
  float fog = smoothstep(uFogRange.x, uFogRange.y, vDistance) * (1.0 - 0.6 * vEmissive);
  outColor = vec4(mix(rgb, uFogColor, fog), alpha);
}`;

// Himmel: ein bildschirmfüllendes Dreieck, Verlauf nach der Blickrichtung je Pixel.
export const SKY_VERTEX = `#version 300 es
precision highp float;
out vec2 vNdc;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  vNdc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export const SKY_FRAGMENT = `#version 300 es
precision highp float;
uniform mat4 uInverseViewProj;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
in vec2 vNdc;
out vec4 outColor;
void main() {
  vec4 a = uInverseViewProj * vec4(vNdc, -1.0, 1.0);
  vec4 b = uInverseViewProj * vec4(vNdc, 0.0, 1.0);
  vec3 dir = normalize(b.xyz / b.w - a.xyz / a.w);
  float h = dir.y;
  vec3 sky = h >= 0.0 ? mix(uHorizon, uZenith, pow(h, 0.55)) : mix(uHorizon, uNadir, pow(-h, 0.35));
  outColor = vec4(sky, 1.0);
}`;

// Bodenraster: Linien auf ganzen Blöcken (alle 16 etwas kräftiger), blendet um den Bau herum aus.
export const GRID_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aXZ;
uniform mat4 uViewProj;
uniform vec3 uCamera;
uniform float uY;
out vec2 vXZ;
out float vDistance;
void main() {
  vec3 world = vec3(aXZ.x, uY, aXZ.y);
  vXZ = aXZ;
  vDistance = distance(world, uCamera);
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

export const GRID_FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uFootprint;  // minX, minZ, maxX, maxZ des Baus
uniform float uFade;      // Abstand vom Bau, bis zu dem das Raster ausblendet
uniform vec3 uLineColor;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
in vec2 vXZ;
in float vDistance;
out vec4 outColor;

float gridLine(vec2 coord) {
  vec2 width = fwidth(coord);
  vec2 g = abs(fract(coord - 0.5) - 0.5) / max(width, vec2(1e-5));
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  // Zu dichte Linien (weit weg) ausblenden statt flimmern
  return line * (1.0 - smoothstep(0.25, 0.6, max(width.x, width.y)));
}

void main() {
  vec2 outside = max(uFootprint.xy - vXZ, vXZ - uFootprint.zw);
  float away = length(max(outside, 0.0));
  float fade = 1.0 - smoothstep(0.0, uFade, away);
  float minor = gridLine(vXZ);
  float major = gridLine(vXZ / 16.0);
  float alpha = (0.07 + minor * 0.22 + major * 0.25) * fade;
  float fog = smoothstep(uFogRange.x, uFogRange.y, vDistance);
  outColor = vec4(mix(uLineColor, uFogColor, fog), alpha * (1.0 - fog));
}`;

// Linien und Flächen in einer Farbe (Umriss des Blocks unter dem Zeiger, Fadenkreuz).
export const LINE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uMatrix;
void main() {
  gl_Position = uMatrix * vec4(aPos, 1.0);
}`;

export const LINE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = uColor;
}`;

function contextLostError(label) {
  const error = new Error(`Shader „${label}“: der WebGL-Kontext ist verloren gegangen.`);
  error.contextLost = true;
  return error;
}

function compileShader(gl, type, source, label) {
  const shader = gl.createShader(type);
  if (!shader) throw contextLostError(label);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (gl.isContextLost()) throw contextLostError(label);
    const log = gl.getShaderInfoLog(shader) || 'ohne Meldung';
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
    throw new Error(`${kind}-Shader „${label}“ lässt sich nicht übersetzen: ${log}`);
  }
  return shader;
}

/**
 * Übersetzt und verbindet ein Shader-Programm. Rückgabe { program, uniforms: { name: location } }.
 * Fehler mit dem Protokoll des Treibers (Programmierfehler, keine Nutzerfehler).
 */
export function createProgram(gl, label, vertexSource, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource, label);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, label);
  const program = gl.createProgram();
  if (!program) throw contextLostError(label);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (gl.isContextLost()) throw contextLostError(label);
    const log = gl.getProgramInfoLog(program) || 'ohne Meldung';
    gl.deleteProgram(program);
    throw new Error(`Shader-Programm „${label}“ lässt sich nicht verbinden: ${log}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

// Plopp-Skalierung wie im Shader (für Tests und die Animation im Hauptthread).
export function plopScale(fraction, order, animate = true) {
  const t = Math.min(1, Math.max(0, (fraction - order * PLOP_SPREAD) / PLOP_DURATION));
  if (t <= 0) return 0;
  if (!animate) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const k = t - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
}
