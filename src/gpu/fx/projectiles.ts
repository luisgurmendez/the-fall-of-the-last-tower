/**
 * Projectiles drawn on the GPU. Each projectile type (the snapshot's
 * abilityId) has a style: an orb, a fireball, a spinning shuriken, a dark
 * bolt... and most leave a ribbon trail, kept here from the positions each
 * projectile was drawn at.
 */

import { fxColor, mixColor, type FXBatch, type RGB } from "./FXBatch";

const TEAM: Record<number, RGB> = { 0: [0.35, 0.68, 1.0], 1: [1.0, 0.38, 0.3] };

interface Trail {
  points: Array<{ x: number; y: number }>;
  lastSeen: number;
}

const trails = new Map<string, Trail>();
let lastPrune = 0;

/** A projectile's recent positions (oldest first), with (x, y) added */
function trailOf(id: string, x: number, y: number, now: number, length: number): ReadonlyArray<{ x: number; y: number }> {
  let trail = trails.get(id);
  if (!trail) {
    trail = { points: [], lastSeen: now };
    trails.set(id, trail);
  }
  trail.lastSeen = now;
  const last = trail.points[trail.points.length - 1];
  if (!last || Math.hypot(x - last.x, y - last.y) > 4) {
    trail.points.push({ x, y });
    if (trail.points.length > length) trail.points.shift();
  }
  if (now - lastPrune > 1) {
    lastPrune = now;
    for (const [key, value] of trails) if (now - value.lastSeen > 1) trails.delete(key);
  }
  return trail.points;
}

/** A number 0-1 that stays the same for a projectile */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

type Style = (batch: FXBatch, id: string, x: number, y: number, angle: number, time: number, side: number) => void;

const FIRE = fxColor("#ff7a1a");
const FIRE_DEEP = fxColor("#e0301a");
const VIOLET = fxColor("#a35cff");
const VOID = fxColor("#2a0d3d");
const GOLD = fxColor("#ffd45a");
const SPIT = fxColor("#8be04a");
const CRIMSON = fxColor("#ff3b6b");

/** A fireball: a churning core, a halo, and flames left behind that burn off */
function fireball(radius: number, core: RGB, edge: RGB): Style {
  return (batch, id, x, y, angle, time) => {
    const seed = seedOf(id);
    const points = trailOf(id, x, y, time, 8);
    // Flames left behind, older ones smaller and further burnt away
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / (points.length - 1);
      batch.flame(points[i].x, points[i].y, radius * (0.7 + t * 0.8), mixColor(edge, core, t * 0.6), 1.3, 0.75 - t * 0.6, 0.6, 3, seed + i * 0.17);
    }
    batch.ribbon(points, radius * 0.9, edge, 0.8);
    batch.glow(x, y, radius * 3, edge, 0.35, 0, 0, 0.4, seed);
    batch.flame(x - Math.cos(angle) * radius * 0.4, y - Math.sin(angle) * radius * 0.4, radius * 1.5, edge, 1.2, 0.12, 0.2, 5, seed);
    batch.orb(x, y, radius, core, 0.8, seed);
  };
}

/** A ball of energy with a ribbon behind it and a twinkle at its heart */
function energyBolt(radius: number, color: RGB | null, trailWidth: number, trailLength = 8): Style {
  return (batch, id, x, y, _angle, time, side) => {
    const c = color ?? TEAM[side] ?? TEAM[0];
    const points = trailOf(id, x, y, time, trailLength);
    batch.ribbon(points, trailWidth, c, 1.3);
    batch.glow(x, y, radius * 3, c, 0.9, 0.25, 0.7, 0.3, seedOf(id));
    batch.orb(x, y, radius * 1.4, c, 1.5, seedOf(id));
    batch.flare(x, y, radius * 2.2, c, 0.9, time * 3);
  };
}

export const PROJECTILE_STYLES: Record<string, Style> = {
  magnus_fireball: fireball(12, fxColor("#ff9a3a"), FIRE),
  dragon_fire: fireball(10, FIRE, FIRE_DEEP),

  // A spinning star of moonlit steel, a crimson streak behind it
  vex_shuriken: (batch, id, x, y, _angle, time) => {
    const points = trailOf(id, x, y, time, 6);
    batch.ribbon(points, 4, CRIMSON, 1.1);
    batch.glow(x, y, 22, CRIMSON, 0.5, 0.2, 0.6);
    batch.flare(x, y, 18, fxColor("#e8f2ff"), 1.7, time * 22);
    batch.flare(x, y, 12, fxColor("#a8c8ff"), 1.1, time * 22 + Math.PI / 4);
  },

  // A bolt of shadow: dark smoke behind, violet light at the tip
  vile_black_arrows: (batch, id, x, y, angle, time) => {
    const seed = seedOf(id);
    const points = trailOf(id, x, y, time, 12);
    for (let i = 0; i < points.length - 1; i += 2) {
      const t = i / (points.length - 1);
      batch.dust(points[i].x, points[i].y, 9 + t * 6, VOID, 0.55 * t, seed + i * 0.1);
    }
    batch.ribbon(points, 6, VIOLET, 1.2);
    batch.spark(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10, angle, 46, 7, VIOLET, 2.2);
    batch.glow(x, y, 34, VIOLET, 0.8, 0.2, 0.5, 0.5, seed);
  },

  vile_auto: (batch, id, x, y, _angle, time) => {
    const seed = seedOf(id);
    const points = trailOf(id, x, y, time, 8);
    batch.ribbon(points, 6, VIOLET, 1.0);
    batch.glow(x, y, 20, VIOLET, 0.8, 0.2, 0.3, 0.4, seed);
    batch.orb(x, y, 9, mixColor(VIOLET, VOID, 0.3), 1.4, seed);
  },

  lume_auto: energyBolt(5, GOLD, 5, 7),
  minion_caster: energyBolt(4, null, 4, 6),
  tower: energyBolt(8, null, 9, 10),
  default: energyBolt(5, null, 4, 6),

  // Spit: a green glob trailing droplets
  jungle_spit: (batch, id, x, y, _angle, time) => {
    const seed = seedOf(id);
    const points = trailOf(id, x, y, time, 7);
    batch.ribbon(points, 5, SPIT, 0.7);
    batch.glow(x, y, 18, SPIT, 0.6, 0.3, 0.3, 0, seed);
    batch.orb(x, y, 8, SPIT, 1.1, seed);
  },

  // The siege cannonball (drawn in 2D) leaves a trail of smoke
  minion_siege: (batch, id, x, y, _angle, time) => {
    const seed = seedOf(id);
    const points = trailOf(id, x, y, time, 10);
    for (let i = 0; i < points.length - 1; i++) {
      const t = i / (points.length - 1);
      batch.dust(points[i].x, points[i].y, 4 + (1 - t) * 6, fxColor("#9a9a9a"), 0.4 * t, seed + i * 0.13);
    }
  },
};

/**
 * Add a projectile to a GPU batch (types without a style of their own get
 * the default bolt in their team's color).
 */
export function emitProjectile(
  batch: FXBatch,
  entityId: string,
  type: string,
  x: number,
  y: number,
  angle: number,
  time: number,
  side: number,
): void {
  const style = PROJECTILE_STYLES[type] ?? PROJECTILE_STYLES.default;
  style(batch, entityId, x, y, angle, time, side);
}
