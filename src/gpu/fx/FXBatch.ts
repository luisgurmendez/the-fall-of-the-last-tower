/**
 * One frame's effects for one layer of the GPU effects pass. Each call adds
 * a quad that the effects shader (./fxShader.ts) draws as one primitive.
 *
 * Positions and sizes are world units, angles radians. Colors are RGB 0-1
 * (see fxColor) times an intensity; past about 1 the light blooms and its
 * core goes white. `age` runs 0-1 over an effect's life for the kinds that
 * animate by it (slash, ring, sigil, flame, decal).
 */

import { FXKind } from "./fxShader";

export type RGB = readonly [number, number, number];

/** Floats per instance: five vec4 attributes */
export const FX_INSTANCE_FLOATS = 20;
const MAX_INSTANCES = 16384;

const colorCache = new Map<string, RGB>();

/**
 * A CSS color (#rgb, #rrggbb, rgb() or rgba(); alpha is ignored) as RGB 0-1,
 * cached. Unknown formats come back white.
 */
export function fxColor(css: string): RGB {
  let color = colorCache.get(css);
  if (color) return color;
  color = [1, 1, 1];
  const hex = css.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    color = [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  } else {
    const rgb = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (rgb) color = [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  }
  colorCache.set(css, color);
  return color;
}

/** A color between two, t 0-1 */
export function mixColor(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export class FXBatch {
  data = new Float32Array(FX_INSTANCE_FLOATS * 1024);
  count = 0;

  clear(): void {
    this.count = 0;
  }

  private push(
    kind: number,
    x: number, y: number, halfWidth: number, halfHeight: number, rotation: number,
    seed: number, age: number,
    color: RGB, intensity: number,
    p0: number, p1: number, p2: number, p3: number,
    opacity = 0,
  ): void {
    if (this.count >= MAX_INSTANCES) return;
    if ((this.count + 1) * FX_INSTANCE_FLOATS > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    const d = this.data;
    let i = this.count * FX_INSTANCE_FLOATS;
    d[i++] = x; d[i++] = y; d[i++] = halfWidth; d[i++] = halfHeight;
    d[i++] = rotation; d[i++] = kind; d[i++] = seed; d[i++] = age;
    d[i++] = color[0]; d[i++] = color[1]; d[i++] = color[2]; d[i++] = intensity;
    d[i++] = p0; d[i++] = p1; d[i++] = p2; d[i++] = p3;
    d[i++] = opacity; d[i++] = 0; d[i++] = 0; d[i++] = 0;
    this.count++;
  }

  /** Soft light; `core` is the hot center's radius (0-1 of the glow), `flicker` how much it wavers */
  glow(x: number, y: number, radius: number, color: RGB, intensity = 1, core = 0.2, whiten = 0.6, flicker = 0, seed = 0): void {
    this.push(FXKind.GLOW, x, y, radius, radius, 0, seed, 0, color, intensity, core, whiten, flicker, 0);
  }

  /** A streak whose head is at (x, y), its tail `length` behind along `angle` */
  spark(x: number, y: number, angle: number, length: number, width: number, color: RGB, intensity = 1): void {
    const half = length / 2;
    this.push(FXKind.SPARK, x - Math.cos(angle) * half, y - Math.sin(angle) * half, half, width, angle, 0, 0, color, intensity, 0, 0, 0, 0);
  }

  /** A ring of light, broken by `noise` (0-1), with a wake of light inside it (`fill`, 0-1) */
  ring(x: number, y: number, radius: number, thickness: number, color: RGB, intensity = 1, noise = 0.5, fill = 0.3, seed = 0): void {
    const half = radius + thickness * 2.5 + radius * noise * 0.2;
    this.push(FXKind.RING, x, y, half, half, 0, seed, 0, color, intensity, radius / half, thickness / half, noise, fill);
  }

  /**
   * A crescent swept across an arc of `span` radians each side of `angle`,
   * `radius` out from (x, y), `thickness` deep. It sweeps in over the first
   * 1/speed of its life and fades by the end.
   */
  slash(x: number, y: number, angle: number, radius: number, span: number, thickness: number, age: number, color: RGB, intensity = 1, speed = 1.8, seed = 0): void {
    this.push(FXKind.SLASH, x, y, radius, radius, angle, seed, age, color, intensity, span, thickness / radius, 0, speed);
  }

  /** Light flowing from one point to another */
  beam(x0: number, y0: number, x1: number, y1: number, width: number, color: RGB, intensity = 1, core = 0.2, scroll = 4, wobble = 0.15, seed = 0): void {
    const length = Math.hypot(x1 - x0, y1 - y0);
    this.push(FXKind.BEAM, (x0 + x1) / 2, (y0 + y1) / 2, length / 2 + width * 0.5, width, Math.atan2(y1 - y0, x1 - x0), seed, 0, color, intensity, core, scroll, wobble, 0);
  }

  /** A magic circle on the ground that draws itself in over the first 1/drawIn of its life */
  sigil(x: number, y: number, radius: number, color: RGB, intensity = 1, age = 1, spin = 0.5, runes = 24, drawIn = 4, opacity = 1, seed = 0): void {
    this.push(FXKind.SIGIL, x, y, radius, radius, 0, seed, age, color, intensity, spin, runes, 0, drawIn, opacity);
  }

  /** A bubble with a hex pattern and a bright rim */
  shield(x: number, y: number, radius: number, color: RGB, intensity = 1, opacity = 1, seed = 0): void {
    this.push(FXKind.SHIELD, x, y, radius, radius, 0, seed, 0, color, intensity, 0, 0, 0, 0, opacity);
  }

  /**
   * A burst of fire that burns away over its life, leaving smoke (`smoke`
   * 0-1); `tongue` 1 makes it a tongue of flame licking upward.
   */
  flame(x: number, y: number, radius: number, color: RGB, intensity: number, age: number, smoke = 0.5, churn = 2, seed = 0, tongue = 0): void {
    this.push(FXKind.FLAME, x, y, radius, radius, 0, seed, age, color, intensity, smoke, churn, tongue, 0);
  }

  /** A four-pointed twinkle */
  flare(x: number, y: number, radius: number, color: RGB, intensity = 1, rotation = 0): void {
    this.push(FXKind.FLARE, x, y, radius, radius, rotation, 0, 0, color, intensity, 0, 0, 0, 0);
  }

  /** A scorch or crack on the ground, fading by the end of its life; `embers` glow in the cracks */
  decal(x: number, y: number, radius: number, color: RGB, age: number, opacity = 1, embers = 0, seed = 0): void {
    this.push(FXKind.DECAL, x, y, radius, radius, 0, seed, age, color, 1, embers, 0, 0, 0, opacity);
  }

  /** A spinning vortex with `arms` arms */
  swirl(x: number, y: number, radius: number, color: RGB, intensity = 1, spin = 1, arms = 3, seed = 0): void {
    this.push(FXKind.SWIRL, x, y, radius, radius, 0, seed, 0, color, intensity, spin, arms, 0, 0);
  }

  /** A jagged bolt between two points, wandering up to `spread` off the line */
  lightning(x0: number, y0: number, x1: number, y1: number, spread: number, thickness: number, color: RGB, intensity = 1, seed = 0): void {
    const length = Math.hypot(x1 - x0, y1 - y0);
    this.push(FXKind.LIGHTNING, (x0 + x1) / 2, (y0 + y1) / 2, length / 2, spread, Math.atan2(y1 - y0, x1 - x0), seed, 0, color, intensity, thickness / spread, 1, 0, 0);
  }

  /** An energy ball with a churning inside and a halo */
  orb(x: number, y: number, radius: number, color: RGB, intensity = 1, seed = 0): void {
    this.push(FXKind.ORB, x, y, radius, radius, 0, seed, 0, color, intensity, 0, 0, 0, 0);
  }

  /** One piece of a ribbon, its width and light going from the first values to the second */
  segment(x0: number, y0: number, x1: number, y1: number, width0: number, width1: number, color: RGB, light0: number, light1: number): void {
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (length < 0.01) return;
    const half = Math.max(width0, width1, 0.01);
    this.push(FXKind.SEGMENT, (x0 + x1) / 2, (y0 + y1) / 2, length / 2, half, Math.atan2(y1 - y0, x1 - x0), 0, 0, color, 1, width0 / half, width1 / half, light0, light1);
  }

  /** A ribbon through points (oldest first), thin and dark at the tail, full at the head */
  ribbon(points: ReadonlyArray<{ x: number; y: number }>, width: number, color: RGB, intensity = 1): void {
    const n = points.length;
    for (let i = 0; i < n - 1; i++) {
      const t0 = i / (n - 1);
      const t1 = (i + 1) / (n - 1);
      this.segment(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, width * t0, width * t1, color, intensity * t0 * t0, intensity * t1 * t1);
    }
  }

  /**
   * A warning on the ground filling up (`fill` 0-1) as an attack winds up;
   * a cone of `span` radians each side of `angle`, or a circle with span 0.
   */
  telegraph(x: number, y: number, radius: number, color: RGB, intensity: number, fill: number, span = 0, angle = 0, opacity = 1): void {
    this.push(FXKind.TELEGRAPH, x, y, radius, radius, angle, 0, 0, color, intensity, fill, span, 0, 0, opacity);
  }

  /** A soft puff that covers what's under it instead of glowing */
  dust(x: number, y: number, radius: number, color: RGB, opacity = 0.6, seed = 0): void {
    this.push(FXKind.DUST, x, y, radius, radius, 0, seed, 0, color, 1, 0, 0, 0, 0, opacity);
  }
}
