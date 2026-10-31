/**
 * The effects shader: every effect is a quad (an instance of ./FXBatch.ts)
 * whose fragment shader draws one kind of primitive from the quad's local
 * coordinates, -1 to 1 on each axis. Colors come in linear-ish RGB times an
 * intensity that may pass 1 (the bloom picks that up).
 *
 * Output is premultiplied: light adds (alpha 0), smoke and dust cover what's
 * under them (alpha > 0).
 *
 * Fragments are snapped to the ground's art pixels (1.5 world units), so
 * effects read as pixel art; the bloom on top stays smooth.
 */

import { GLSL_NOISE } from "../gl";

/** Primitive kinds; keep in sync with the shader's switch */
export const FXKind = {
  GLOW: 0,
  SPARK: 1,
  RING: 2,
  SLASH: 3,
  BEAM: 4,
  SIGIL: 5,
  SHIELD: 6,
  FLAME: 7,
  FLARE: 8,
  DECAL: 9,
  SWIRL: 10,
  LIGHTNING: 11,
  ORB: 12,
  SEGMENT: 13,
  DUST: 14,
  TELEGRAPH: 15,
} as const;

export const FX_UNIFORMS = ["uViewOrigin", "uWorldPerPixel", "uResolution", "uTime", "uPixelSnap"];

export const FX_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPosSize;   // center x, y, half width, half height
layout(location = 2) in vec4 aRotKind;   // rotation, kind, seed, age
layout(location = 3) in vec4 aColor;     // r, g, b, intensity
layout(location = 4) in vec4 aParams;    // per kind
layout(location = 5) in vec4 aExtra;     // opacity, per kind

uniform vec2 uViewOrigin;
uniform float uWorldPerPixel;
uniform vec2 uResolution;

out vec2 vWorld;
flat out vec4 vPosSize;
flat out vec4 vRotKind;
flat out vec4 vColor;
flat out vec4 vParams;
flat out vec4 vExtra;

void main() {
  float c = cos(aRotKind.x);
  float s = sin(aRotKind.x);
  vec2 local = aCorner * aPosSize.zw;
  vec2 world = aPosSize.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 pixel = (world - uViewOrigin) / uWorldPerPixel;
  gl_Position = vec4(pixel.x / uResolution.x * 2.0 - 1.0, 1.0 - pixel.y / uResolution.y * 2.0, 0.0, 1.0);
  vWorld = world;
  vPosSize = aPosSize;
  vRotKind = aRotKind;
  vColor = aColor;
  vParams = aParams;
  vExtra = aExtra;
}`;

export const FX_FRAGMENT = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uPixelSnap;

in vec2 vWorld;
flat in vec4 vPosSize;
flat in vec4 vRotKind;
flat in vec4 vColor;
flat in vec4 vParams;
flat in vec4 vExtra;

out vec4 outColor;

${GLSL_NOISE}

const float TAU = 6.2831853;

// Light (added) and cover (alpha-blended color, opacity)
struct Shade { vec3 light; vec3 cover; float opacity; };

Shade lightOnly(vec3 light) { return Shade(light, vec3(0.0), 0.0); }

// Hot cores go white: blend toward white as intensity climbs
vec3 heat(vec3 color, float amount) { return mix(color, vec3(1.0), clamp(amount, 0.0, 1.0)); }

// ---------------------------------------------------------------- kinds

Shade glow(vec2 uv, float r, vec3 color, float seed) {
  float halo = exp(-r * r * 5.0) * smoothstep(1.0, 0.7, r);
  float core = vParams.x > 0.0 ? smoothstep(vParams.x, 0.0, r) : 0.0;
  float flicker = 1.0 + (vnoise(vec2(uTime * 12.0, seed * 10.0)) - 0.5) * vParams.z;
  return lightOnly((color * halo * 0.8 + heat(color, vParams.y * 0.6) * core) * flicker);
}

// A streak along +x, its head at x = 1
Shade spark(vec2 uv, vec3 color) {
  float t = (uv.x + 1.0) * 0.5;
  float width = mix(0.12, 1.0, t * t);
  float d = abs(uv.y) / width;
  float body = smoothstep(1.0, 0.0, d) * smoothstep(1.0, 0.9, uv.x) * t;
  float core = smoothstep(0.45, 0.0, d) * t;
  return lightOnly(color * body + heat(color, 0.45) * core * 0.9);
}

// params: ring radius, thickness, edge noise, inner fill
Shade ring(vec2 uv, float r, vec3 color, float seed, float age) {
  float angle = atan(uv.y, uv.x);
  float n = vnoise(vec2(angle * 6.0 + seed * 17.0, uTime * 4.0 + seed));
  float rr = r + (n - 0.5) * vParams.z * 0.04;
  float d = rr - vParams.x;
  float edge = exp(-(d * d) / (vParams.y * vParams.y));
  float fill = d < 0.0 ? exp(d / max(vParams.x * 0.3, 0.01)) * vParams.w : 0.0;
  // Bright and broken at the leading edge, a wake of streaks behind it
  float streaks = mix(1.0, 0.35 + 1.1 * vnoise(vec2(angle * 22.0 + seed * 5.0, rr * 5.0)), vParams.z);
  float light = edge * streaks + fill * 0.45 * streaks;
  return lightOnly(color * light + heat(color, 0.4) * pow(edge, 6.0) * 0.5);
}

// A crescent swept across the arc: params arc half-span, thickness, -, sweep speed
Shade slash(vec2 uv, float r, vec3 color, float seed, float age) {
  float angle = atan(uv.y, uv.x);
  float span = vParams.x;
  float sweep = 1.0 - pow(1.0 - clamp(age * vParams.w, 0.0, 1.0), 3.0);
  float head = mix(-span, span, sweep);
  float behind = head - angle;
  if (behind < -0.08 || angle < -span - 0.1) return lightOnly(vec3(0.0));
  float along = 1.0 - clamp(behind / (span * 1.4), 0.0, 1.0);
  float tip = smoothstep(-0.08, 0.04, behind);
  float thickness = vParams.y * (0.25 + 0.75 * along);
  float outer = 0.96;
  float band = smoothstep(outer, outer - 0.04, r) * smoothstep(outer - thickness * 1.6, outer - thickness * 0.2, r);
  float streak = 0.55 + 0.9 * vnoise(vec2(r * 46.0, angle * 2.0 + seed * 9.0));
  float fade = pow(1.0 - age, 1.4);
  float body = band * pow(along, 1.6) * tip * fade * streak;
  float edge = smoothstep(outer - 0.07, outer - 0.015, r) * smoothstep(outer + 0.01, outer - 0.02, r) * along * tip * fade;
  return lightOnly(color * body * 1.1 + heat(color, 0.5) * edge * 1.1);
}

// Along +x from -1 to 1: params core width, scroll speed, wobble
Shade beam(vec2 uv, vec3 color, float seed) {
  float wobble = (vnoise(vec2(uv.x * 5.0 - uTime * vParams.y, seed * 7.0)) - 0.5) * vParams.z;
  float y = abs(uv.y + wobble);
  float core = smoothstep(vParams.x, 0.0, y);
  float halo = exp(-y * y * 7.0);
  float flow = 0.55 + 0.6 * vnoise(vec2(uv.x * 9.0 - uTime * vParams.y * 2.0, uv.y * 3.0 + seed));
  float ends = smoothstep(1.0, 0.8, abs(uv.x));
  return lightOnly((color * halo * flow + heat(color, 0.5) * core) * ends);
}

// A magic circle on the ground: params spin speed, rune count, -, draw-in
Shade sigil(vec2 uv, float r, vec3 color, float seed, float age) {
  float angle = atan(uv.y, uv.x);
  float spin = uTime * vParams.x;
  float a = fract((angle + spin) / TAU);
  float drawn = smoothstep(0.0, 0.02, clamp(age * vParams.w, 0.0, 1.0) - fract(angle / TAU + 0.25));
  if (vParams.w <= 0.0) drawn = 1.0;
  float line = 0.0;
  line += exp(-pow((r - 0.95) / 0.018, 2.0));
  line += exp(-pow((r - 0.72) / 0.014, 2.0)) * 0.8;
  line += exp(-pow((r - 0.24) / 0.014, 2.0)) * 0.7;
  // Runes between the two outer rings
  float runes = 0.0;
  if (r > 0.76 && r < 0.91) {
    float count = vParams.y;
    vec2 cell = vec2(floor(a * count), floor((r - 0.76) / 0.05));
    vec2 inCell = vec2(fract(a * count), fract((r - 0.76) / 0.05));
    vec2 bitPos = floor(inCell * vec2(3.0, 3.0));
    float on = step(0.45, hash12(cell * 7.0 + bitPos + seed * 31.0));
    float gap = step(0.15, inCell.x) * step(inCell.x, 0.85);
    runes = on * gap * 0.9;
  }
  // A star of lines through the middle ring
  float star = 0.0;
  for (int i = 0; i < 6; i++) {
    float t0 = float(i) / 6.0 * TAU - spin * 0.5;
    float t1 = t0 + TAU * 2.0 / 6.0;
    vec2 p0 = vec2(cos(t0), sin(t0)) * 0.72;
    vec2 p1 = vec2(cos(t1), sin(t1)) * 0.72;
    vec2 pa = uv - p0;
    vec2 ba = p1 - p0;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    star = max(star, exp(-pow(length(pa - ba * h) / 0.012, 2.0)));
  }
  float fill = smoothstep(1.0, 0.2, r) * 0.05;
  float pulse = 0.8 + 0.2 * sin(uTime * 4.0 + seed * 6.0);
  float light = (line * 0.75 + runes * 0.55 + star * 0.45) * drawn * pulse + fill;
  return Shade(color * light + heat(color, 0.3) * line * drawn * 0.2, color * 0.4, fill * 1.5 * vExtra.x);
}

float hexEdge(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
  vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
  q = abs(q);
  return 0.5 - max(dot(q, s * 0.5), q.x);
}

Shade shield(vec2 uv, float r, vec3 color, float seed) {
  if (r > 1.0) return lightOnly(vec3(0.0));
  float z = sqrt(max(0.0, 1.0 - r * r));
  float fresnel = pow(1.0 - z, 2.5);
  vec2 sphere = uv / (z + 0.35) * 2.6 + vec2(uTime * 0.15, seed * 3.0);
  float hex = smoothstep(0.06, 0.0, hexEdge(sphere));
  float shimmer = smoothstep(0.25, 0.0, abs(fract(uv.y * 0.5 + uv.x * 0.2 - uTime * 0.35) - 0.5));
  float rim = smoothstep(0.86, 0.99, r) * smoothstep(1.0, 0.985, r);
  float light = rim * 0.8 + fresnel * 0.4 + hex * (0.08 + fresnel * 0.4 + shimmer * 0.3);
  return Shade(color * light + heat(color, 0.3) * rim * 0.3, color * 0.5, (0.04 + fresnel * 0.1) * vExtra.x);
}

// Fire that burns away into smoke: params smokiness, churn speed, tongue
// (0 a round puff, 1 a tongue of flame licking up to a point)
Shade flame(vec2 uv, float r, vec3 color, float seed, float age) {
  vec2 q = uv;
  if (vParams.z > 0.0) {
    q.y = (uv.y + 0.4) * 0.75;
    q.x = uv.x * (1.0 + max(0.0, -q.y) * 1.8 * vParams.z);
    r = length(q);
  }
  float n = fbm(q * 2.2 + vec2(seed * 7.0, uTime * vParams.y));
  float shape = 1.0 - r + (n - 0.5) * 0.9;
  float threshold = age * 0.95;
  float mask = smoothstep(threshold, threshold + 0.12, shape);
  float hot = clamp((shape - threshold) * 2.2, 0.0, 1.0) * (1.0 - age);
  // Deep red where it's cooling, the flame's color, yellow at the hottest
  vec3 deep = color * vec3(0.75, 0.3, 0.12);
  vec3 bright = mix(color, vec3(1.0, 0.92, 0.6) * max(max(color.r, color.g), color.b), 0.55);
  vec3 fire = (hot < 0.5 ? mix(deep, color, hot * 2.0) : mix(color, bright, hot * 2.0 - 1.0)) * (0.35 + hot) * 1.1;
  float smoke = vParams.x * mask * smoothstep(0.15, 0.6, age) * (1.0 - age);
  return Shade(fire * mask, vec3(0.13, 0.12, 0.14), smoke * 0.75);
}

Shade flare(vec2 uv, float r, vec3 color) {
  float cross = exp(-abs(uv.y) * 22.0) * (1.0 - abs(uv.x)) + exp(-abs(uv.x) * 22.0) * (1.0 - abs(uv.y));
  float core = exp(-r * r * 30.0);
  float halo = exp(-r * r * 6.0) * 0.35;
  return lightOnly(color * (cross * 0.8 + halo) + heat(color, 0.6) * core);
}

// A scorch or crack mark on the ground: params embers
Shade decal(vec2 uv, float r, vec3 color, float seed, float age) {
  float angle = atan(uv.y, uv.x);
  float n = fbm(uv * 2.5 + seed * 10.0);
  float mark = smoothstep(1.0, 0.45, r + (n - 0.5) * 0.6);
  float crackLine = abs(fract(angle / TAU * 7.0 + n * 0.5 + seed) - 0.5);
  float crack = smoothstep(0.035, 0.0, crackLine) * smoothstep(1.0, 0.15, r);
  float fade = 1.0 - smoothstep(0.6, 1.0, age);
  float opacity = (mark * 0.4 + crack * 0.45) * fade * vExtra.x;
  float embers = crack * pow(1.0 - age, 2.0) * vParams.x;
  return Shade(heat(color, 0.3) * embers, vec3(0.06, 0.05, 0.05), opacity);
}

// A vortex: params spin speed, arms
Shade swirl(vec2 uv, float r, vec3 color, float seed) {
  float angle = atan(uv.y, uv.x);
  float wisp = fbm(uv * 2.5 + vec2(uTime * 0.6, seed * 7.0));
  float arms = sin(angle * vParams.y + r * 9.0 - uTime * vParams.x * 6.0 + seed * 5.0 + wisp * 3.0);
  float mask = smoothstep(0.55, 1.0, arms) * smoothstep(1.0, 0.4, r) * smoothstep(0.05, 0.35, r) * (0.4 + wisp);
  float core = exp(-r * r * 18.0);
  return lightOnly(color * mask * 0.8 + heat(color, 0.3) * core * 0.5);
}

// A bolt along +x from -1 to 1: params thickness, jaggedness
Shade lightning(vec2 uv, vec3 color, float seed) {
  float t = floor(uTime * 18.0);
  float x = uv.x * 0.5 + 0.5;
  float path = (vnoise(vec2(x * 5.0, t + seed * 13.0)) - 0.5) * 0.9 + (vnoise(vec2(x * 17.0, t * 1.7 + seed)) - 0.5) * 0.35;
  path *= sin(x * 3.1415927) * vParams.y;
  float d = abs(uv.y - path);
  float core = smoothstep(vParams.x, 0.0, d);
  float halo = exp(-d * d * 30.0);
  return lightOnly(color * halo * 0.7 + heat(color, 0.6) * core * 1.1);
}

// An energy ball with a churning inside
Shade orb(vec2 uv, float r, vec3 color, float seed) {
  float angle = atan(uv.y, uv.x);
  float n = fbm(vec2(angle * 1.5 + uTime * 3.0, r * 3.0 - uTime * 5.0) + seed * 3.0);
  float body = smoothstep(0.62, 0.42, r + (n - 0.5) * 0.25);
  float core = smoothstep(0.3, 0.0, r);
  float halo = exp(-r * r * 4.0) * 0.6;
  return lightOnly(color * (body * (0.5 + n) + halo) + heat(color, 0.5) * core * 0.9);
}

// One piece of a ribbon along +x: params width at start, width at end, light at start, light at end
Shade segment(vec2 uv, vec3 color) {
  float t = (uv.x + 1.0) * 0.5;
  float width = mix(vParams.x, vParams.y, t);
  float d = abs(uv.y) / max(width, 0.001);
  float light = mix(vParams.z, vParams.w, t);
  float body = exp(-d * d * 2.5) * smoothstep(1.0, 0.6, d);
  float core = smoothstep(0.35, 0.0, d);
  return lightOnly((color * body + heat(color, 0.4) * core * 0.6) * light);
}

// A soft puff that covers instead of glowing (dust, mud, blood, dark smoke)
Shade dust(vec2 uv, float r, vec3 color, float seed) {
  float n = vnoise(uv * 3.0 + seed * 9.0);
  float mask = smoothstep(1.0, 0.35, r + (n - 0.5) * 0.5);
  return Shade(vec3(0.0), color, mask * vExtra.x);
}

// A warning on the ground: its edge, and a fill growing out to it as the
// attack winds up. params: fill 0-1, half-span (0 = full circle)
Shade telegraph(vec2 uv, float r, vec3 color) {
  float angle = atan(uv.y, uv.x);
  float span = vParams.y;
  float inside = span > 0.0 ? smoothstep(span + 0.02, span - 0.02, abs(angle)) : 1.0;
  float reach = vParams.x * 0.96;
  float edge = exp(-pow((r - 0.96) / 0.022, 2.0));
  float front = exp(-pow((r - reach) / 0.03, 2.0)) * step(0.02, reach);
  float body = step(r, reach) * (0.1 + 0.25 * r);
  float stripes = 0.6 + 0.4 * sin(r * 38.0 - uTime * 7.0);
  float sides = span > 0.0 ? exp(-pow((abs(angle) - span) * r / 0.02, 2.0)) * step(r, 0.97) : 0.0;
  float light = (edge * 0.7 + front + body * stripes) * inside + sides * 0.7;
  return Shade(color * light, color * 0.25, body * 0.5 * inside * vExtra.x);
}

void main() {
  // Snap to the art-pixel grid, then into the quad's own coordinates
  vec2 world = uPixelSnap > 0.0 ? (floor(vWorld / uPixelSnap) + 0.5) * uPixelSnap : vWorld;
  vec2 rel = world - vPosSize.xy;
  float c = cos(-vRotKind.x);
  float s = sin(-vRotKind.x);
  vec2 uv = vec2(rel.x * c - rel.y * s, rel.x * s + rel.y * c) / vPosSize.zw;
  float r = length(uv);
  int kind = int(vRotKind.y + 0.5);
  float seed = vRotKind.z;
  float age = vRotKind.w;
  vec3 color = vColor.rgb * vColor.a;

  Shade shade;
  if (kind == 0) shade = glow(uv, r, color, seed);
  else if (kind == 1) shade = spark(uv, color);
  else if (kind == 2) shade = ring(uv, r, color, seed, age);
  else if (kind == 3) shade = slash(uv, r, color, seed, age);
  else if (kind == 4) shade = beam(uv, color, seed);
  else if (kind == 5) shade = sigil(uv, r, color, seed, age);
  else if (kind == 6) shade = shield(uv, r, color, seed);
  else if (kind == 7) shade = flame(uv, r, color, seed, age);
  else if (kind == 8) shade = flare(uv, r, color);
  else if (kind == 9) shade = decal(uv, r, color, seed, age);
  else if (kind == 10) shade = swirl(uv, r, color, seed);
  else if (kind == 11) shade = lightning(uv, color, seed);
  else if (kind == 12) shade = orb(uv, r, color, seed);
  else if (kind == 13) shade = segment(uv, color);
  else if (kind == 15) shade = telegraph(uv, r, color);
  else shade = dust(uv, r, vColor.rgb, seed);

  float opacity = clamp(shade.opacity, 0.0, 1.0);
  outColor = vec4(shade.light + shade.cover * opacity, opacity);
}`;
