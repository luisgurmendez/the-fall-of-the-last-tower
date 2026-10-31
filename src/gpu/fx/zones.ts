/**
 * Zones (persistent ground effects) drawn on the GPU, by zone type: burning
 * ground with flames licking up and embers rising, a pool of mud with
 * bubbles, a healing circle with motes rising, a blue circle for buffs.
 * Each fades in when it appears and out as it runs out.
 */

import { fxColor, type FXBatch } from "./FXBatch";

export interface ZoneSnapshot {
  entityId: string;
  radius?: number;
  zoneType?: string;
  remainingDuration?: number;
  totalDuration?: number;
}

const FIRE = fxColor("#ff7a1a");
const FIRE_HOT = fxColor("#ffc04a");
const EMBER = fxColor("#ff9a3a");
const MUD = fxColor("#4a3220");
const MUD_DARK = fxColor("#2e1f14");
const MUD_LIGHT = fxColor("#8a6a44");
const HEAL = fxColor("#5cff9a");
const BUFF = fxColor("#5cb8ff");

/** Golden-angle spiral: n points spread evenly over a disc */
function spot(i: number, n: number, radius: number): { x: number; y: number } {
  const r = radius * Math.sqrt((i + 0.5) / n);
  const a = i * 2.39996;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

const fract = (v: number) => v - Math.floor(v);

/**
 * Add a zone: its ground parts to `ground`, what rises from it to `top`.
 */
export function emitZone(ground: FXBatch, top: FXBatch, zone: ZoneSnapshot, x: number, y: number, time: number): void {
  const radius = zone.radius || 200;
  const total = zone.totalDuration || 1;
  const remaining = zone.remainingDuration ?? total;
  const fade = Math.max(0, Math.min(1, (total - remaining) / 0.25, remaining / (total * 0.2)));
  let seed = 0;
  for (let i = 0; i < zone.entityId.length; i++) seed = (seed * 31 + zone.entityId.charCodeAt(i)) % 997;
  seed /= 997;

  switch (zone.zoneType) {
    case "damage": {
      ground.decal(x, y, radius * 0.95, FIRE, 0.35, 0.85 * fade, 0.9, seed);
      ground.glow(x, y, radius * 1.15, FIRE, 0.55 * fade, 0, 0, 0.5, seed);
      ground.ring(x, y, radius * 0.95, 5, FIRE, 1.1 * fade, 0.9, 0.3, seed);
      const flames = Math.max(8, Math.min(26, Math.round(radius / 9)));
      for (let i = 0; i < flames; i++) {
        const p = spot(i, flames, radius * 0.9);
        const age = fract(time * (0.9 + (i % 5) * 0.12) + i * 0.618 + seed);
        const size = 9 + ((i * 7) % 9);
        top.flame(x + p.x, y + p.y - age * 14, size, i % 3 === 0 ? FIRE_HOT : FIRE, 1.3 * fade, age, 0.45, 3, seed + i * 0.07);
      }
      for (let i = 0; i < 10; i++) {
        const p = spot(i * 3 + 1, 30, radius);
        const t = fract(time * 0.6 + i * 0.37 + seed);
        top.glow(x + p.x + Math.sin(time * 3 + i) * 6, y + p.y - t * 70, 4, EMBER, 1.6 * fade * (1 - t), 0.5, 0.6, 0.8, i * 0.1);
      }
      break;
    }
    case "slow": {
      ground.dust(x, y, radius * 1.02, MUD, 0.75 * fade, seed);
      ground.dust(x, y, radius * 0.7, MUD_DARK, 0.45 * fade, seed + 0.3);
      ground.ring(x, y, radius * 0.97, 4, MUD_LIGHT, 0.35 * fade, 1, 0, seed);
      const bubbles = Math.max(6, Math.min(16, Math.round(radius / 12)));
      for (let i = 0; i < bubbles; i++) {
        const p = spot(i, bubbles, radius * 0.85);
        const t = fract(time * 0.7 + i * 0.618 + seed);
        if (t < 0.8) ground.dust(x + p.x, y + p.y, 2 + t * 6, MUD_LIGHT, 0.7 * fade, seed + i);
        else ground.ring(x + p.x, y + p.y, 6 + (t - 0.8) * 30, 1.5, MUD_LIGHT, 0.8 * fade * (1 - t) * 5, 0.3, 0, i);
      }
      break;
    }
    case "heal":
    case "buff": {
      const color = zone.zoneType === "heal" ? HEAL : BUFF;
      ground.sigil(x, y, radius, color, 0.9 * fade, 1, 0.25, Math.max(16, Math.round(radius * 0.45)), 0, fade, seed);
      ground.glow(x, y, radius, color, 0.3 * fade, 0, 0);
      for (let i = 0; i < 12; i++) {
        const p = spot(i, 12, radius * 0.85);
        const t = fract(time * 0.5 + i * 0.618 + seed);
        top.glow(x + p.x, y + p.y - t * 50, 4, color, 1.4 * fade * Math.sin(t * Math.PI), 0.5, 0.6);
      }
      break;
    }
  }
}
