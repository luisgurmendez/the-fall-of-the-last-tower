/**
 * Zones (persistent ground effects) drawn on the GPU, by zone type: burning
 * ground with flames licking up and embers rising, a pool of mud with
 * bubbles, a healing circle with motes rising, a blue circle for buffs;
 * some abilities' zones have their own look (Calamitus's lava, Zhak'rul's
 * toxic cloud).
 * Each fades in when it appears and out as it runs out.
 */

import { fxColor, type FXBatch } from "./FXBatch";

export interface ZoneSnapshot {
  entityId: string;
  abilityId?: string;
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

/** Abilities whose zones are patches of a trail */
const TRAIL_ZONES = new Set(["oitboil_e"]);

const LAVA = fxColor("#ff5a14");
const LAVA_HOT = fxColor("#ffb02e");
const CRUST = fxColor("#2a1410");
/** Calamitus's lava: molten pools, not flames (the stream's pools have no rim) */
const LAVA_ZONES = new Set(["calamitus_q", "calamitus_w"]);
const LAVA_STREAMS = new Set(["calamitus_w"]);

const GAS = fxColor("#6fcf3a");
const GAS_HAZE = fxColor("#b8e64a");
const GAS_LIGHT = fxColor("#c4f57a");
/** Zhak'rul's Toxic Cloud: billowing green gas, not mud */
const GAS_ZONES = new Set(["zhakrul_w"]);

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
      if (LAVA_ZONES.has(zone.abilityId ?? "")) {
        emitLava(ground, top, x, y, radius, fade, time, seed, LAVA_STREAMS.has(zone.abilityId ?? ""));
        break;
      }
      // A patch of a trail (Oitboil's E) has no rim, so the patches read as one path of fire
      const trail = TRAIL_ZONES.has(zone.abilityId ?? "");
      ground.decal(x, y, radius * 0.95, FIRE, 0.35, 0.85 * fade, 0.9, seed);
      ground.glow(x, y, radius * 1.15, FIRE, (trail ? 0.35 : 0.55) * fade, 0, 0, 0.5, seed);
      if (!trail) ground.ring(x, y, radius * 0.95, 4, FIRE, 0.7 * fade, 0.9, 0.3, seed);
      const flames = Math.max(10, Math.min(30, Math.round(radius / 7)));
      for (let i = 0; i < flames; i++) {
        const p = spot(i, flames, radius * 0.92);
        // Each flame flares up and burns out on its own cycle, rising as it goes
        const age = 0.15 + 0.85 * fract(time * (0.8 + (i % 5) * 0.12) + i * 0.618 + seed);
        const size = 13 + ((i * 7) % 11);
        top.flame(x + p.x, y + p.y - size * 0.5 - age * 10, size, i % 3 === 0 ? FIRE_HOT : FIRE, 1.3 * fade, age, 0.4, 3, seed + i * 0.07, 1);
      }
      for (let i = 0; i < 10; i++) {
        const p = spot(i * 3 + 1, 30, radius);
        const t = fract(time * 0.6 + i * 0.37 + seed);
        top.glow(x + p.x + Math.sin(time * 3 + i) * 6, y + p.y - t * 70, 4, EMBER, 1.6 * fade * (1 - t), 0.5, 0.6, 0.8, i * 0.1);
      }
      break;
    }
    case "slow": {
      if (GAS_ZONES.has(zone.abilityId ?? "")) {
        emitToxicCloud(ground, top, x, y, radius, fade, time, seed);
        break;
      }
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

/**
 * A cloud of poison gas: a sickly green haze on the ground, billows
 * drifting and swelling over it, and venom bubbles rising.
 */
function emitToxicCloud(ground: FXBatch, top: FXBatch, x: number, y: number, radius: number, fade: number, time: number, seed: number): void {
  ground.dust(x, y, radius * 1.02, GAS_HAZE, 0.5 * fade, seed);
  ground.glow(x, y, radius * 0.95, GAS, 0.35 * fade, 0, 0, 0.4, seed);
  ground.ring(x, y, radius * 0.97, 3, GAS, 0.4 * fade, 1, 0, seed);
  // Billows of gas swelling up and thinning out, each on its own cycle
  const puffs = Math.max(10, Math.min(22, Math.round(radius / 9)));
  for (let i = 0; i < puffs; i++) {
    const p = spot(i, puffs, radius * 0.82);
    const age = 0.1 + 0.8 * fract(time * (0.3 + (i % 4) * 0.06) + i * 0.618 + seed);
    const drift = Math.sin(time * 0.8 + i * 1.7) * 8;
    const size = radius * 0.2 + (i % 5) * 3;
    top.flame(x + p.x + drift, y + p.y - age * 14, size, i % 3 === 0 ? GAS_LIGHT : GAS, 0.6 * fade, age, 0.9, 1.2, seed + i * 0.07, 0);
  }
  for (let i = 0; i < 8; i++) {
    const p = spot(i * 2 + 1, 16, radius * 0.85);
    const t = fract(time * 0.6 + i * 0.37 + seed);
    top.glow(x + p.x, y + p.y - t * 40, 3, GAS_LIGHT, 1.2 * fade * (1 - t), 0.5, 0.4, 0.6, i * 0.1);
  }
}

/**
 * A pool of lava: a dark crust over a molten glow, bright seams that
 * shift, and bubbles that swell and pop with a puff of heat.
 */
function emitLava(ground: FXBatch, top: FXBatch, x: number, y: number, radius: number, fade: number, time: number, seed: number, stream: boolean): void {
  // Cooled black rock (dust covers the ground; glows only add light)...
  ground.dust(x, y, radius * (stream ? 1.15 : 1.05), CRUST, 0.9 * fade, seed);
  // ...and a molten body glowing inside it, red-orange, not white-hot
  ground.glow(x, y, radius * 0.85, LAVA, 0.85 * fade, 0.1, 0, 0.25, seed);
  // Plates of crust floating on it, drifting slowly
  const plates = Math.max(2, Math.min(6, Math.round(radius / 25)));
  for (let i = 0; i < plates; i++) {
    const p = spot(i * 3 + 2, plates * 3, radius * 0.6);
    const drift = Math.sin(time * 0.4 + i * 1.3 + seed * 7) * 4;
    ground.dust(x + p.x + drift, y + p.y, radius * 0.16, CRUST, 0.65 * fade, seed + i * 0.17);
  }
  // Hot seams pulsing between the plates
  const seams = Math.max(4, Math.min(10, Math.round(radius / 16)));
  for (let i = 0; i < seams; i++) {
    const p = spot(i, seams, radius * 0.7);
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.7 + seed * 9);
    ground.glow(x + p.x, y + p.y, 8 + (i % 3) * 3, LAVA_HOT, (0.5 + pulse * 0.5) * fade, 0.5, 0.2, 0.6, seed + i * 0.1);
  }
  // Bubbles swelling and popping with a puff of heat
  const bubbles = Math.max(2, Math.min(7, Math.round(radius / 20)));
  for (let i = 0; i < bubbles; i++) {
    const p = spot(i * 2 + 1, bubbles * 2, radius * 0.65);
    const t = fract(time * (0.7 + (i % 4) * 0.15) + i * 0.41 + seed);
    top.orb(x + p.x, y + p.y - t * 4, 2 + t * 4, t < 0.85 ? LAVA : LAVA_HOT, (t < 0.85 ? 0.7 : 1.4) * fade, seed + i * 0.13);
    if (t > 0.85) top.glow(x + p.x, y + p.y - 10, 7, LAVA_HOT, 1 * fade, 0.5, 0.4, 0.8, i * 0.1);
  }
}
