/**
 * The ground's fragment shader: every screen pixel works out which art
 * pixel (PX world units, fixed to the world so nothing swims as the camera
 * moves) it shows, reads the terrain field (./terrainField.ts) there and
 * paints it from small color ramps with ordered dithering, like pixel art:
 * - grass, darker in the jungle, with tufts that sway, flower patches and
 *   a sheen the wind blows across
 * - lanes paved with worn flagstones down the middle, thinning out to bare
 *   earth and moss toward a shaded lip where the grass ends
 * - water: deep in the middle of the river, shallow at its banks and at
 *   the lane fords (the paving runs on under the water there), with
 *   flowing ripples, foam lapping at the shore, glints and a muddy bank
 * The palette is muted, closer to the classic MOBA's than to bright
 * cartoon colors, so the units and effects stand out over it.
 * - walls: a forest canopy (one shaded crown per tree) over the jungle
 *   walls and mossy boulders on the others, a rock face on their south
 *   side, and their shadow and ambient occlusion on the ground
 * - round stone plazas in the bases with a ring of runes in the team's color
 * - the jungle's floor: trails trodden down its paths and its camps'
 *   trampled lairs, bones scattered about
 * - brush: tall grass, blades swaying over exactly the bushes' hitboxes
 *   (reaching up past their top edge), with a shadow under them (on a
 *   muddy islet in the river)
 * - cloud shadows drifting over everything
 * Animated parts step at 8 frames per second, like sprite animation.
 */

import { MOBAConfig } from "@siege/shared";
import { GLSL_NOISE } from "../gl";

/** Water closer to the center than this on both axes is river; past it, the sea around the map */
const RIVER_REACH = (MOBAConfig.MAP_SIZE.width / 2 - MOBAConfig.WATER_BORDER_SIZE - 80).toFixed(1);

export const GROUND_UNIFORMS = [
  "uField",
  "uFloor",
  "uFieldOrigin",
  "uFieldSize",
  "uViewOrigin",
  "uWorldPerPixel",
  "uCanvasHeight",
  "uTime",
  "uNexusBlue",
  "uNexusRed",
  "uPits",
  "uRiverDir",
];

export const GROUND_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uField;
uniform sampler2D uFloor;
uniform vec2 uFieldOrigin;
uniform vec2 uFieldSize;
uniform vec2 uViewOrigin;
uniform float uWorldPerPixel;
uniform float uCanvasHeight;
uniform float uTime;
uniform vec2 uNexusBlue;
uniform vec2 uNexusRed;
uniform vec4 uPits;
uniform vec2 uRiverDir;

out vec4 outColor;

${GLSL_NOISE}

// World units per art pixel
const float PX = 1.5;
// Height of a wall's rock face, world units
const float FACE = 20.0;
// Tree crown spacing on forest walls
const float TREE = 24.0;
// Walls within this distance of a nexus or a river pit are stone, the rest forest
const float BASE_STONE_RADIUS = 1120.0;
const float PIT_STONE_RADIUS = 340.0;
const float PLAZA_RADIUS = 460.0;

const vec3 GRASS[5] = vec3[5](vec3(0.106, 0.231, 0.180), vec3(0.165, 0.318, 0.192), vec3(0.239, 0.420, 0.212), vec3(0.341, 0.522, 0.243), vec3(0.486, 0.627, 0.298));
const vec3 DIRT[5] = vec3[5](vec3(0.255, 0.204, 0.173), vec3(0.353, 0.290, 0.235), vec3(0.451, 0.380, 0.306), vec3(0.549, 0.475, 0.384), vec3(0.643, 0.573, 0.471));
const vec3 PAVE[5] = vec3[5](vec3(0.247, 0.243, 0.243), vec3(0.349, 0.341, 0.329), vec3(0.447, 0.435, 0.412), vec3(0.541, 0.525, 0.490), vec3(0.639, 0.620, 0.576));
const vec3 WATER[5] = vec3[5](vec3(0.071, 0.192, 0.278), vec3(0.098, 0.271, 0.357), vec3(0.153, 0.369, 0.435), vec3(0.251, 0.478, 0.506), vec3(0.412, 0.616, 0.596));
const vec3 SAND[3] = vec3[3](vec3(0.400, 0.357, 0.271), vec3(0.502, 0.451, 0.341), vec3(0.604, 0.553, 0.427));
const vec3 CANOPY[5] = vec3[5](vec3(0.055, 0.149, 0.133), vec3(0.090, 0.247, 0.180), vec3(0.149, 0.357, 0.208), vec3(0.251, 0.478, 0.235), vec3(0.408, 0.616, 0.282));
const vec3 CANOPY_TEAL[5] = vec3[5](vec3(0.047, 0.141, 0.165), vec3(0.071, 0.231, 0.231), vec3(0.106, 0.333, 0.282), vec3(0.176, 0.447, 0.329), vec3(0.302, 0.580, 0.384));
const vec3 CANOPY_GOLD[5] = vec3[5](vec3(0.137, 0.165, 0.098), vec3(0.231, 0.267, 0.122), vec3(0.353, 0.380, 0.149), vec3(0.494, 0.494, 0.192), vec3(0.663, 0.627, 0.259));
const vec3 ROCK[5] = vec3[5](vec3(0.180, 0.161, 0.149), vec3(0.267, 0.239, 0.212), vec3(0.361, 0.329, 0.290), vec3(0.459, 0.424, 0.373), vec3(0.565, 0.529, 0.471));
const vec3 STONE[5] = vec3[5](vec3(0.259, 0.259, 0.302), vec3(0.353, 0.353, 0.392), vec3(0.447, 0.443, 0.475), vec3(0.549, 0.541, 0.557), vec3(0.659, 0.647, 0.635));
const vec3 BRUSH[5] = vec3[5](vec3(0.067, 0.180, 0.165), vec3(0.122, 0.282, 0.212), vec3(0.231, 0.408, 0.224), vec3(0.365, 0.525, 0.251), vec3(0.553, 0.651, 0.318));
const vec3 MOSS[3] = vec3[3](vec3(0.169, 0.290, 0.188), vec3(0.247, 0.400, 0.208), vec3(0.365, 0.525, 0.247));
const vec3 FOAM = vec3(0.871, 0.949, 0.945);
const vec3 TEAM_BLUE = vec3(0.278, 0.612, 1.0);
const vec3 TEAM_RED = vec3(1.0, 0.322, 0.278);

vec3 field(vec2 p) {
  return (texture(uField, (p - uFieldOrigin) / uFieldSize).rgb * 255.0 - 128.0) * 2.0;
}

float brushField(vec2 p) {
  return (texture(uField, (p - uFieldOrigin) / uFieldSize).a * 255.0 - 128.0) * 2.0;
}

// The jungle's floor: x the trodden trails, y the camps' lairs (signed distances)
vec2 floorField(vec2 p) {
  return (texture(uFloor, (p - uFieldOrigin) / uFieldSize).rg * 255.0 - 128.0) * 2.0;
}

int level(float v, float dither, int top) {
  return clamp(int(floor(v * float(top) + dither)), 0, top);
}
vec3 ramp5(vec3 ramp[5], float v, float dither) { return ramp[level(v, dither, 4)]; }
vec3 ramp3(vec3 ramp[3], float v, float dither) { return ramp[level(v, dither, 2)]; }
vec3 shift5(vec3 ramp[5], int index, int by) { return ramp[clamp(index + by, 0, 4)]; }

bool bit(int mask, float x) {
  return x >= 0.0 && x < 6.0 && ((mask >> int(x)) & 1) == 1;
}

// ---------------------------------------------------------------- grass

vec3 grass(vec2 p, vec2 ip, float dither, float jungle, float stepTime) {
  float big = fbm(p * 0.0045);
  float mid = fbm(p * 0.021 + 5.0);
  float v = 0.55 + (big - 0.5) * 0.6 + (mid - 0.5) * 0.45 + (hash12(ip) - 0.5) * 0.1 - jungle * 0.2;
  // A sheen the wind blows across the meadow
  float wind = sin(dot(p, vec2(0.011, 0.006)) - uTime * 1.2 + mid * 5.0);
  v += smoothstep(0.7, 1.0, wind) * 0.08;
  int base = level(v, dither, 4);
  vec3 color = GRASS[base];

  // Tufts: a few blades on a 7-pixel grid, the tips swaying with the wind
  vec2 cell = floor(ip / 7.0);
  float presence = hash12(cell + 31.7);
  if (presence < 0.5 - jungle * 0.1) {
    vec2 local = ip - cell * 7.0 - floor(hash22(cell) * 3.0);
    float sway = sin(stepTime * 1.6 + (cell.x + cell.y) * 0.45 + wind);
    float shift = sway > 0.65 ? 1.0 : (sway < -0.65 ? -1.0 : 0.0);
    bool variant = hash12(cell + 3.1) < 0.5;
    int tips = variant ? 18 : 4;     // .X..X / ..X..
    int blades = variant ? 13 : 21;  // X.XX. / X.X.X
    if (local.y == 0.0 && bit(tips, local.x - shift)) color = shift5(GRASS, base, 2);
    else if (local.y == 1.0 && bit(blades, local.x)) color = shift5(GRASS, base, 1);
    else if (local.y == 2.0 && bit(14, local.x)) color = shift5(GRASS, base, 1);
    else if (local.y == 3.0 && bit(14, local.x)) color = shift5(GRASS, base, -1);
  }

  // Flowers, in patches
  vec2 flowerCell = floor(ip / 11.0);
  float meadow = smoothstep(0.52, 0.72, fbm(p * 0.006 + 3.3));
  if (hash12(flowerCell + 71.3) < 0.03 + meadow * 0.3) {
    vec2 center = flowerCell * 11.0 + 2.0 + floor(hash22(flowerCell + 5.0) * 7.0);
    vec2 r = ip - center;
    float kind = hash12(flowerCell + 9.0);
    vec3 petal = kind < 0.35 ? vec3(0.957, 0.937, 0.890) : kind < 0.6 ? vec3(0.906, 0.592, 0.741) : kind < 0.8 ? vec3(0.655, 0.553, 0.859) : vec3(0.976, 0.812, 0.341);
    if (r == vec2(0.0)) color = kind < 0.8 ? vec3(0.965, 0.796, 0.290) : vec3(0.863, 0.420, 0.180);
    else if (abs(r.x) + abs(r.y) == 1.0) color = petal;
    else if (r == vec2(1.0, 1.0) || r == vec2(0.0, 2.0)) color = shift5(GRASS, base, -2);
  }
  return color;
}

// ---------------------------------------------------------------- paving

// Worn flagstones: the cells of a jittered grid, with joints between them;
// keep is the share of slabs still there. Returns the slab's color with
// alpha 1, a joint between slabs with alpha 0.5, or alpha 0 where there's
// no slab.
vec4 paving(vec2 p, float dither, float keep) {
  const float SLAB = 24.0;
  vec2 cell = floor(p / SLAB);
  float d1 = 1e9;
  float d2 = 1e9;
  vec2 site = vec2(0.0);
  vec2 other = vec2(0.0);
  vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 s = (c + 0.2 + hash22(c + 17.0) * 0.6) * SLAB;
      float d = length(p - s);
      if (d < d1) { d2 = d1; other = site; d1 = d; site = s; id = c; }
      else if (d < d2) { d2 = d; other = s; }
    }
  }
  if (hash12(id + 3.0) > keep) return vec4(0.0);
  // Distance to the edge shared with the nearest other slab
  float border = (d2 * d2 - d1 * d1) / (2.0 * max(length(other - site), 1.0));
  if (border < 1.6) return vec4(0.0, 0.0, 0.0, 0.5);
  float v = 0.5 + (hash12(id) - 0.5) * 0.4 + (vnoise(p * 0.16 + id * 1.7) - 0.5) * 0.3;
  int base = level(v, dither, 4);
  vec3 color = PAVE[base];
  // Bevel: the edge toward the light (top left) lit, the far one shaded
  if (border < 3.4) color = shift5(PAVE, base, dot(p - site, vec2(-0.6, -0.8)) > 0.0 ? 1 : -1);
  // Chips
  if (hash12(floor(p / PX) + id * 3.0) > 0.975) color = shift5(PAVE, base, -2);
  return vec4(color, 1.0);
}

// ---------------------------------------------------------------- dirt

vec3 dirt(vec2 p, vec2 ip, float dither, float edge, float dPath) {
  float v = 0.55 + (fbm(p * 0.028) - 0.5) * 0.55 + (hash12(ip) - 0.5) * 0.14 + smoothstep(-25.0, -90.0, dPath) * 0.1;
  int base = level(v, dither, 4);
  vec3 color = DIRT[base];
  // The lip where the grass ends casts a little shadow
  if (edge > -3.0) return shift5(DIRT, base, -2);
  if (edge > -4.5) return shift5(DIRT, base, -1);

  // Flagstones down the middle of the lane, fewer toward its edges, with
  // earth between them there and moss in the joints
  float keep = 0.12 + 0.78 * smoothstep(-12.0, -75.0, dPath);
  vec4 slab = paving(p, dither, keep);
  if (slab.a > 0.75) return slab.rgb;
  if (slab.a > 0.25) return hash12(ip * 0.7) < smoothstep(-80.0, -20.0, dPath) * 0.7 ? MOSS[0] : DIRT[0];

  // Pebbles
  vec2 cell = floor(ip / 8.0);
  if (hash12(cell + 11.0) < 0.3) {
    vec2 r = ip - cell * 8.0 - 1.0 - floor(hash22(cell + 2.0) * 5.0);
    float wide = hash12(cell + 4.0) < 0.5 ? 2.0 : 1.0;
    if (r.y == 0.0 && r.x >= 0.0 && r.x <= wide) color = r.x == 0.0 ? vec3(0.749, 0.682, 0.580) : vec3(0.553, 0.494, 0.431);
    else if (r.y == 1.0 && r.x >= 0.0 && r.x <= wide) color = vec3(0.235, 0.165, 0.129);
  }
  return color;
}

// ---------------------------------------------------------------- jungle floor

const vec3 BONE = vec3(0.835, 0.796, 0.698);

// Trails trodden down the middle of the jungle's paths, wandering and worn
// thin in places, and the trampled earth of the camps' lairs with bones
// scattered about; stippled into the grass at their edges
vec3 jungleFloor(vec2 p, vec2 ip, float dither, vec3 ground) {
  vec2 f = floorField(p);
  float trail = f.x + (fbm(p * 0.025) - 0.5) * 18.0;
  float lair = f.y + (fbm(p * 0.035 + 7.0) - 0.5) * 30.0;
  float worn = smoothstep(6.0, -12.0, trail) * (0.6 + 0.4 * fbm(p * 0.06 + 2.0));
  worn = max(worn, smoothstep(10.0, -45.0, lair) * 0.92);
  if (worn <= dither) return ground;

  float v = 0.32 + (fbm(p * 0.04) - 0.5) * 0.45 + (hash12(ip) - 0.5) * 0.12;
  int base = level(v, dither, 3);
  vec3 color = DIRT[base];
  // Pebbles
  vec2 cell = floor(ip / 9.0);
  if (hash12(cell + 23.0) < 0.2) {
    vec2 r = ip - cell * 9.0 - 1.0 - floor(hash22(cell + 4.0) * 6.0);
    if (r.y == 0.0 && (r.x == 0.0 || r.x == 1.0)) color = r.x == 0.0 ? DIRT[4] : DIRT[3];
    else if (r.y == 1.0 && (r.x == 0.0 || r.x == 1.0)) color = DIRT[0];
  }
  // Bones in a lair: a short pale bar with a knob at each end
  if (lair < -12.0) {
    vec2 boneCell = floor(ip / 21.0);
    if (hash12(boneCell + 51.0) < 0.4) {
      vec2 r = ip - boneCell * 21.0 - 4.0 - floor(hash22(boneCell + 9.0) * 12.0);
      bool shaft = r.y == 0.0 && r.x >= 0.0 && r.x <= 5.0;
      bool knob = (r.x == -1.0 || r.x == 6.0) && abs(r.y) <= 1.0 && r.y != 0.0;
      if (shaft || knob) color = BONE;
      else if (r.y == 1.0 && r.x >= 0.0 && r.x <= 5.0) color = DIRT[0];
    }
  }
  return color;
}

// ---------------------------------------------------------------- water

vec3 water(vec2 p, vec2 ip, float dither, float depth, float dPath, float stepTime, bool river) {
  // Fords: the lanes cross the river in the shallows
  float ford = smoothstep(10.0, -30.0, dPath);
  depth = mix(depth, min(depth, 22.0), ford);
  float shallow = 1.0 - smoothstep(4.0, 95.0, depth);

  vec2 flow = river ? uRiverDir * 16.0 : vec2(4.0, 2.0);
  vec2 q = p - flow * stepTime;
  float n1 = vnoise(q * 0.035);
  float n2 = vnoise(q * 0.075 + vec2(stepTime * 0.35, -stepTime * 0.2));
  float bands = abs(fract(n1 * 3.0 + n2 * 1.7) - 0.5);
  float v = 0.12 + shallow * 0.78 + (n2 - 0.5) * 0.22 + step(bands, 0.05) * 0.3;
  vec3 color = ramp5(WATER, v, dither);

  // Foam: a line at the shore and waves lapping toward it (not over the fords)
  float edgeFoam = step(depth, 2.2 + vnoise(p * 0.2 + stepTime) * 2.2);
  float wave = fract(depth / 15.0 - stepTime * 0.45 + n1 * 0.6);
  float waveFoam = step(wave, 0.09) * step(depth, 28.0) * step(0.4, vnoise(p * 0.11 + stepTime * 0.6)) * step(ford, 0.2);
  if (edgeFoam + waveFoam > 0.0) color = mix(color, FOAM, 0.9);

  // The lane's paving runs on under the water at the fords, seen through it
  if (ford > 0.5) {
    vec4 slab = paving(p, dither, 0.7);
    if (slab.a > 0.75) color = mix(color, slab.rgb * vec3(0.6, 0.78, 0.84), 0.35);
    else if (slab.a > 0.25) color *= 0.82;
  }

  // A few glints that come and go
  vec2 sc = floor(ip / 9.0);
  float slot = floor(uTime * 2.5 + hash12(sc) * 7.0);
  if (hash12(sc + slot * 13.7) > 0.988) {
    vec2 r = abs(ip - (sc * 9.0 + 2.0 + floor(hash22(sc + slot) * 5.0)));
    if (r.x + r.y < 0.5) color = vec3(1.0);
    else if (r.x + r.y < 1.5) color = mix(color, vec3(1.0), 0.6);
  }
  return color;
}

// ---------------------------------------------------------------- walls

bool inFaceBand(vec2 p) {
  return field(p + vec2(0.0, FACE)).b > 0.0;
}

// The rock face on a wall's south side; heightUp is 0 at its foot and 1 at its top
vec3 rockFace(vec2 p, vec2 ip, float dither, float heightUp) {
  float strata = vnoise(vec2(p.x * 0.07, p.y * 0.45));
  float crack = step(0.86, vnoise(vec2(p.x * 0.33, p.y * 0.035)));
  float v = 0.34 + heightUp * 0.4 + (strata - 0.5) * 0.3 - crack * 0.3;
  vec3 color = ramp5(ROCK, v, dither);
  // Moss hanging from the lip
  float moss = vnoise(vec2(p.x * 0.18, 4.0));
  if (heightUp > 1.0 - moss * 0.55 && moss > 0.45) color = ramp3(MOSS, heightUp - 0.3, dither);
  if (heightUp > 0.93) color = MOSS[2];
  if (heightUp < 0.07) color = ROCK[0] * 0.8;
  return color;
}

// Tree crowns on a forest wall, or boulders on a stone one; alpha 0 where
// none covers the point
vec4 wallTop(vec2 p, vec2 ip, float dither, bool stone) {
  float spacing = stone ? 20.0 : TREE;
  vec2 cell = floor(p / spacing);
  float bestY = -1e9;
  vec2 bestRel = vec2(0.0);
  float bestRadius = 1.0;
  vec2 bestCell = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 center = (c + 0.2 + hash22(c) * 0.6) * spacing;
      float radius = spacing * (0.62 + hash12(c + 7.0) * 0.28);
      vec2 rel = p - center;
      if (dot(rel, rel) > radius * radius || center.y < bestY) continue;
      // Trees grow on the wall's top, not on its face (their crowns hang over it)
      if (field(center).b > -6.0 || inFaceBand(center - vec2(0.0, 6.0))) continue;
      bestY = center.y;
      bestRel = rel;
      bestRadius = radius;
      bestCell = c;
    }
  }
  if (bestY < -1e8) return vec4(0.0);

  vec2 uv = bestRel / bestRadius;
  float k = length(uv);
  vec3 normal = normalize(vec3(uv, sqrt(max(0.0, 1.0 - k * k)) * (stone ? 1.5 : 1.1)));
  float light = dot(normal, normalize(vec3(-0.45, -0.65, 0.6)));
  if (stone) {
    float grain = vnoise(p * 0.45 + bestCell * 5.1);
    float v = 0.3 + light * 0.45 + (grain - 0.5) * 0.2 + (hash12(bestCell + 2.0) - 0.5) * 0.2;
    if (k > 0.9) v -= 0.25;
    vec3 color = ramp5(STONE, v, dither);
    // Moss on the lit tops, in patches
    if (light > 0.45 && fbm(p * 0.05 + bestCell) > 0.5) color = ramp3(MOSS, v - 0.2, dither);
    if (hash12(floor(p * 0.4) + bestCell) > 0.93 && k < 0.85) color = shift5(STONE, level(v, dither, 4), -2);
    return vec4(color, 1.0);
  }
  float leaves = vnoise(p * 0.32 + bestCell * 3.7);
  float v = 0.32 + light * 0.42 + (leaves - 0.5) * 0.35 + (hash12(bestCell + 2.0) - 0.5) * 0.15;
  if (k > 0.88) v -= 0.2;
  float tint = hash12(bestCell + 13.0);
  vec3 color = tint < 0.18 ? ramp5(CANOPY_TEAL, v, dither) : tint < 0.3 ? ramp5(CANOPY_GOLD, v, dither) : ramp5(CANOPY, v, dither);
  return vec4(color, 1.0);
}

// ---------------------------------------------------------------- brush

// Tall grass: blades a pixel wide rooted on a staggered grid inside a bush
// (art pixels apart across and between rows, up to BLADE_TALL tall), each
// leaning a little and swaying, dark at the root and light at the tip; the
// blade rooted lowest is in front, and the back row's blades reach up past
// the bush's edge. Alpha 0 where none covers the point.
const float BLADE_COL = 3.0;
const float BLADE_ROW = 3.0;
const float BLADE_TALL = 15.0;

vec4 tallGrass(vec2 ip, float dither, float stepTime) {
  float frontRoot = -1e9;
  vec3 color = vec3(0.0);
  float baseRow = floor(ip.y / BLADE_ROW);
  for (int j = 0; j <= 5; j++) {
    float row = baseRow + float(j);
    float stagger = mod(row * 2.0, BLADE_COL);
    float baseCol = floor((ip.x - stagger) / BLADE_COL);
    for (int i = -2; i <= 2; i++) {
      vec2 id = vec2(baseCol + float(i), row);
      vec2 root = vec2(id.x * BLADE_COL + stagger + floor(hash12(id) * 2.0), row * BLADE_ROW + floor(hash12(id + 5.0) * 3.0));
      float up = root.y - ip.y;
      float tall = floor(BLADE_TALL * (0.5 + 0.5 * hash12(id + 9.0)));
      if (up < 0.0 || up > tall || root.y <= frontRoot) continue;
      float t = up / tall;
      float sway = sin(stepTime * 1.4 + root.x * 0.21 + root.y * 0.13);
      float bend = (hash12(id + 13.0) - 0.5) * 5.0 + (sway > 0.55 ? 1.5 : (sway < -0.55 ? -1.5 : 0.0));
      if (ip.x != root.x + floor(bend * t * t + 0.5)) continue;
      if (brushField((root + 0.5) * PX) > -1.0) continue;
      frontRoot = root.y;
      float v = 0.15 + t * 0.65 + (hash12(id + 21.0) - 0.5) * 0.25;
      color = t > 0.88 ? BRUSH[4] : ramp5(BRUSH, v, dither);
    }
  }
  return frontRoot > -1e8 ? vec4(color, 1.0) : vec4(0.0);
}

// ---------------------------------------------------------------- bases

vec3 plaza(vec2 p, vec2 ip, float dither, vec2 nexus, vec3 team, float fromNexus, float edge, vec3 ground) {
  const float RING = 18.0;
  float ring = floor(fromNexus / RING);
  float radial = fromNexus - ring * RING;
  float angle = atan(p.y - nexus.y, p.x - nexus.x) / 6.2831853 + 0.5;
  float stones = max(6.0, floor(6.2831853 * (ring + 0.5) * RING / 28.0));
  float along = (angle + hash12(vec2(ring, 3.0))) * stones;
  float stoneIndex = floor(along);
  float arc = (along - stoneIndex) * 6.2831853 * (ring + 0.5) * RING / stones;
  vec2 id = vec2(stoneIndex, ring);

  // Stones go missing toward the edge
  if (hash12(id + 17.0) < smoothstep(edge - 90.0, edge, fromNexus)) return ground;

  float v = 0.5 + (hash12(id) - 0.5) * 0.45 + (vnoise(p * 0.12) - 0.5) * 0.25;
  int base = level(v, dither, 4);
  vec3 color = STONE[base];
  if (radial < 1.6 || arc < 1.6) color = hash12(id + 5.0) < 0.35 ? MOSS[0] : STONE[0] * 0.8;
  else if (radial > RING - 3.0 || arc < 3.1) color = shift5(STONE, base, 1);
  else if (radial < 3.1) color = shift5(STONE, base, -1);

  // A ring of rune stones in the team's color
  if (ring == 7.0 && radial >= 1.6 && arc >= 1.6) {
    float pulse = 0.55 + 0.45 * sin(uTime * 1.6 - stoneIndex * 0.7);
    float glyph = hash12(floor(vec2(arc / 3.0, radial / 3.0)) + id * 7.0);
    color = mix(STONE[1], team * 0.75, 0.45);
    if (glyph > 0.6) color = mix(color, team, 0.4 + 0.5 * pulse);
  }
  return color;
}

// ---------------------------------------------------------------- main

void main() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvasHeight - gl_FragCoord.y);
  vec2 world = uViewOrigin + screen * uWorldPerPixel;
  vec2 ip = floor(world / PX);
  vec2 p = (ip + 0.5) * PX;
  float dither = bayer4(ip);
  float stepTime = floor(uTime * 8.0) / 8.0;

  vec3 f = field(p);
  float dWater = f.r;
  float dPath = f.g;
  float dRock = f.b + (fbm(p * 0.06) - 0.5) * 9.0;
  float fromBlue = length(p - uNexusBlue);
  float fromRed = length(p - uNexusRed);
  float clouds = smoothstep(0.5, 0.85, fbm(p * 0.0016 + vec2(uTime * 0.006, uTime * 0.0035)));

  vec3 color;
  bool wall = false;

  // Walls: crowns can spill a little past the wall's edge
  if (dRock < 20.0) {
    bool stone = min(fromBlue, fromRed) < BASE_STONE_RADIUS
      || min(length(p - uPits.xy), length(p - uPits.zw)) < PIT_STONE_RADIUS;
    vec4 top = wallTop(p, ip, dither, stone);
    if (top.a > 0.0) {
      color = top.rgb;
      wall = true;
    } else if (dRock < 0.0) {
      wall = true;
      if (inFaceBand(p)) color = rockFace(p, ip, dither, clamp(-dRock / FACE, 0.0, 1.0));
      // Between the crowns: undergrowth in their shade (or rock), never a black hole
      else color = stone ? ramp5(ROCK, 0.12 + vnoise(p * 0.3) * 0.25, dither) : ramp5(CANOPY, 0.1 + vnoise(p * 0.35) * 0.3, dither);
    }
  }

  if (!wall) {
    float shore = dWater + (vnoise(p * 0.05 + stepTime * 0.3) - 0.5) * 5.0;
    bool river = abs(p.x) < ${RIVER_REACH} && abs(p.y) < ${RIVER_REACH};
    if (shore < 0.0) {
      color = water(p, ip, dither, -shore, dPath, stepTime, river);
    } else {
      float jungle = smoothstep(80.0, 300.0, dPath) * smoothstep(60.0, 250.0, dWater);
      float plazaEdge = PLAZA_RADIUS + (fbm(p * 0.02) - 0.5) * 70.0;
      float edge = dPath + (fbm(p * 0.05) - 0.5) * 18.0 + (hash12(ip * 1.3) - 0.5) * 2.5;
      color = edge < 0.0 ? dirt(p, ip, dither, edge, dPath) : jungleFloor(p, ip, dither, grass(p, ip, dither, jungle, stepTime));
      if (fromBlue < plazaEdge) color = plaza(p, ip, dither, uNexusBlue, TEAM_BLUE, fromBlue, plazaEdge, color);
      else if (fromRed < plazaEdge) color = plaza(p, ip, dither, uNexusRed, TEAM_RED, fromRed, plazaEdge, color);

      // A sand bank around the water, darker where it's wet
      float bank = 9.0 + vnoise(p * 0.08) * 6.0;
      if (shore < bank) color = ramp3(SAND, shore / bank - 0.15, dither);
    }

    // Tall grass over the ground (its blades reach up past the bush), the
    // ground between its stems in its shade, and its shadow just under it
    float dBrush = brushField(p);
    bool inBrush = false;
    if (dBrush < BLADE_TALL * PX + 2.0) {
      vec4 blades = tallGrass(ip, dither, stepTime);
      if (blades.a > 0.0) {
        color = blades.rgb;
        inBrush = true;
      } else if (shore < 0.0 && dBrush < 5.0) {
        // Grass in the river grows on a muddy islet
        color = ramp3(SAND, 0.15 + vnoise(p * 0.2) * 0.3, dither);
        if (dBrush < 0.0) color *= 0.7;
      } else if (dBrush < 0.0) {
        color = ramp5(BRUSH, 0.05 + vnoise(p * 0.4) * 0.2, dither);
        inBrush = true;
      }
    }

    // The walls' shadow (cast down and to the right) and ambient occlusion,
    // and the brush's
    float occluder = field(p - vec2(15.0, 20.0)).b + (vnoise(p * 0.06) - 0.5) * 14.0;
    float shadow = smoothstep(4.0, -8.0, occluder) * 0.4 + smoothstep(16.0, 0.0, dRock) * 0.25;
    if (!inBrush) shadow += smoothstep(2.0, -6.0, brushField(p - vec2(4.0, 7.0))) * 0.35;
    color = mix(color, color * vec3(0.48, 0.55, 0.78), min(shadow, 0.55));
  }

  color = mix(color, color * vec3(0.72, 0.78, 0.92), clouds * 0.17);
  outColor = vec4(color, 1.0);
}`;
