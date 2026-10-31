/**
 * Lume's Light Orb on the GPU: a warm ball of light with a halo that
 * blooms, a ribbon of light behind it while it travels, slow rays when it
 * hangs at a spot, and a dim ember while it's gone (respawning). Its ball
 * has a solid core under the light, so it looks the same over grass, water
 * or Lume herself (light alone takes the color of what's under it), and it
 * keeps one palette in every state.
 */

import { fxColor, mixColor, type FXBatch } from "./FXBatch";
import { seedOf, trailOf } from "./projectiles";

export type LightOrbState = "orbiting" | "traveling" | "stationed" | "destroyed";

const CORE = fxColor("#fff3c4");
const WARM = fxColor("#ffd27a");
/** The solid ball under the light */
const SOLID = fxColor("#ffe7a3");
/** Red's orb leans orange so the two can be told apart */
const RED_TINT = fxColor("#ffab6a");
const RED_SOLID = fxColor("#ffc98f");

/**
 * Add an orb to a GPU batch. `time` in seconds; (x, y) is where it's drawn
 * (the interpolated position).
 */
export function emitLightOrb(batch: FXBatch, id: string, state: LightOrbState, x: number, y: number, time: number, side: number): void {
  const seed = seedOf(id);
  const warm = side === 0 ? WARM : RED_TINT;
  // Hovering a little over the ground
  const lift = 14 + Math.sin(time * 2.2 + seed * 6) * 2;
  const oy = y - lift;

  if (state === "destroyed") {
    batch.glow(x, oy, 10, warm, 0.25, 0.3, 0.2, 0.6, seed);
    return;
  }

  const pulse = 1 + Math.sin(time * (state === "traveling" ? 9 : 3.5) + seed * 5) * 0.12;
  if (state === "traveling") {
    const trail = trailOf(id, x, oy, time, 9);
    batch.ribbon(trail, 7, warm, 1.3);
    // Sparkles shed along the trail
    for (let i = 0; i < trail.length - 1; i += 3) {
      const t = i / Math.max(1, trail.length - 1);
      batch.flare(trail[i].x, trail[i].y, 5 + t * 3, mixColor(warm, CORE, 0.5), 0.4 + t * 0.6, time * 4 + i);
    }
  } else {
    // Forget the trail so the next throw doesn't start with a streak
    trailOf(id, x, oy, time, 1);
  }
  if (state === "stationed") {
    batch.rays(x, oy, 40, warm, 0.3, 10, 0.9, 0.4, 0.22, seed);
  }

  // A shadow of light on the ground under it, then the halo, the ball and its twinkle
  batch.glow(x, y, 22, warm, 0.2, 0, 0);
  batch.glow(x, oy, 20 * pulse, warm, 0.25, 0, 0, 0.15, seed);
  batch.dust(x, oy, 11 * pulse, side === 0 ? SOLID : RED_SOLID, 1, seed);
  batch.orb(x, oy, 7 * pulse, warm, 0.6, seed);
  batch.flare(x, oy, 12 * pulse, CORE, 0.4, time * 0.8 + seed);
}
