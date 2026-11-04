/**
 * Sprites that rise out of the ground for an ability, drawn among the units
 * (depth-sorted with them, so a hand in front of a champion covers its feet
 * and one behind it is hidden by it).
 *
 * Nocthar's Grasping Hands: when his Q is cast, bony hands come out of the
 * cracked ground of its circle as its warning (the ability's aoeDelay) ends:
 * they climb out open, snap shut as the hands land, hold their grip, then
 * sink back. The hand is a generated strip (scripts/generate-sprites.ts,
 * open to shut, then the shut claw held); without it, a plain drawn hand.
 * Each hand bursts out of its own patch of earth and kicks up dust as it
 * sinks: their VFX (`emergeVFX`, `sinkVFX`), taken by the renderer each frame
 * (takeRisingMoments).
 */

import { getAbilityDefinition } from "@siege/shared";
import { drawSpriteFrame, getSpriteFeet, imageCache } from "@/render/entities/shared";

export interface RisingSpriteSet {
  /** Frames side by side, the first one open, the last one shut */
  strip: string;
  /** World units per sprite pixel */
  scale: number;
  /** Where they stand around the cast's point */
  radius: number;
  count: number;
  /** ms from the cast until it lands (the ability's warning) */
  lands: number;
  /** ms: climbing out (open, just before it lands), shutting (as it lands), the grip held, sinking back */
  emerge: number;
  shut: number;
  hold: number;
  sink: number;
  /** The strip's frame where the fingers are shut (the rest hold it) */
  shutFrame: number;
  /** VFX where each one climbs out, and where it sinks back */
  emergeVFX?: string;
  sinkVFX?: string;
}

const GRASPING_HANDS = getAbilityDefinition("nocthar_q");

const SETS: Record<string, RisingSpriteSet> = {
  nocthar_q: {
    // 60px frames, the hand 39px tall (open), its wrist on the same row in every frame; shut from frame 4
    strip: "/assets/sprites/fx/nocthar_hand/grab.png",
    scale: 0.85,
    radius: GRASPING_HANDS?.aoeRadius ?? 95,
    count: 6,
    lands: (GRASPING_HANDS?.aoeDelay ?? 0.85) * 1000,
    emerge: 160,
    shut: 200,
    hold: 320,
    sink: 300,
    shutFrame: 4,
    emergeVFX: "nocthar_q_hand",
    sinkVFX: "nocthar_q_hand_sink",
  },
};

/** Their strips, to preload */
export const RISING_SPRITE_IMAGES = Object.values(SETS).map((set) => set.strip);

export interface RisingSprite {
  set: RisingSpriteSet;
  x: number;
  y: number;
  /** ms (Date.now) */
  start: number;
  flip: boolean;
  /** Its VFX already played */
  emerged: boolean;
  sank: boolean;
}

let active: RisingSprite[] = [];

/** A cheap repeatable random number for a cast */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * An ability was cast at (x, y): its sprites start rising there (nothing for
 * abilities without any)
 */
export function spawnRisingSprites(abilityId: string, x: number, y: number, now: number): void {
  const set = SETS[abilityId];
  if (!set) return;
  const next = random(Math.round(x * 31 + y * 17 + now));
  const turn = next() * Math.PI * 2;
  for (let i = 0; i < set.count; i++) {
    // One in the middle, the rest around it
    const angle = turn + (i * 2 * Math.PI) / (set.count - 1) + (next() - 0.5) * 0.5;
    const distance = i === 0 ? next() * set.radius * 0.15 : set.radius * (0.45 + next() * 0.35);
    active.push({
      set,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance * 0.8,
      start: now + next() * 70,
      flip: next() < 0.5,
      emerged: false,
      sank: false,
    });
  }
}

/** The sprites to draw now, back to front (gone ones dropped) */
export function risingSpritesNow(now: number): RisingSprite[] {
  active = active.filter(({ set, start }) => now < start + set.lands + set.shut + set.hold + set.sink);
  return [...active].sort((a, b) => a.y - b.y);
}

/** A sprite's moment worth a VFX (climbing out, sinking back), where it is */
export interface RisingMoment {
  vfx: string;
  x: number;
  y: number;
}

/** The moments that began since last asked (each once): their VFX to play */
export function takeRisingMoments(now: number): RisingMoment[] {
  const moments: RisingMoment[] = [];
  for (const sprite of active) {
    const { set } = sprite;
    const t = now - sprite.start;
    if (!sprite.emerged && t >= set.lands - set.emerge) {
      sprite.emerged = true;
      if (set.emergeVFX) moments.push({ vfx: set.emergeVFX, x: sprite.x, y: sprite.y });
    }
    if (!sprite.sank && t >= set.lands + set.shut + set.hold) {
      sprite.sank = true;
      if (set.sinkVFX) moments.push({ vfx: set.sinkVFX, x: sprite.x, y: sprite.y });
    }
  }
  return moments;
}

/**
 * How far out of the ground (0-1) and how shut (0-1) a sprite is: hidden
 * through the warning, out (open) just before it lands, shut as it lands,
 * held, then sunk back
 */
export function risingPose(set: RisingSpriteSet, t: number): { out: number; shut: number } {
  const emerging = t - (set.lands - set.emerge);
  if (emerging < 0) return { out: 0, shut: 0 };
  if (emerging < set.emerge) return { out: Math.sin((emerging / set.emerge) * Math.PI / 2), shut: 0 };
  const shutting = t - set.lands;
  if (shutting < set.shut) return { out: 1, shut: shutting / set.shut };
  const sinking = shutting - set.shut - set.hold;
  if (sinking < 0) return { out: 1, shut: 1 };
  return { out: Math.max(0, 1 - sinking / set.sink), shut: 1 };
}

/**
 * Draw one sprite at its place (world space), cut off at the ground line as
 * it climbs out or sinks back
 */
export function drawRisingSprite(ctx: CanvasRenderingContext2D, sprite: RisingSprite, now: number): void {
  const { out, shut } = risingPose(sprite.set, now - sprite.start);
  if (out <= 0.01) return;
  const { set } = sprite;
  const image = imageCache.get(set.strip);
  const loaded = image !== undefined && image.complete && image.naturalWidth > 0;
  const feet = loaded ? getSpriteFeet(set.strip, set.scale) : null;
  const frameSize = loaded ? image.naturalHeight : 48;
  const groundY = feet?.y ?? frameSize * set.scale * 0.45;
  const height = frameSize * set.scale;

  ctx.save();
  ctx.translate(sprite.x, sprite.y - groundY);
  // The ground line: nothing below it shows
  ctx.beginPath();
  ctx.rect(-height, -height * 2, height * 2, height * 2 + groundY);
  ctx.clip();
  ctx.translate(0, (1 - out) * height);
  if (sprite.flip) ctx.scale(-1, 1);
  if (loaded) {
    const frameCount = Math.max(1, Math.round(image.naturalWidth / frameSize));
    // Open to shut over the shutting, then the shut claw
    const frame = Math.min(frameCount - 1, set.shutFrame, Math.floor(shut * (set.shutFrame + 1)));
    drawSpriteFrame(ctx, image, frame * frameSize, frameSize, frameSize, set.scale, null);
  } else {
    drawHand(ctx, groundY, shut);
  }
  ctx.restore();
}

/** Without the strip: a bony hand, its fingers curling shut */
function drawHand(ctx: CanvasRenderingContext2D, groundY: number, shut: number): void {
  const curl = shut * 1.1;
  ctx.lineCap = "round";
  for (const [color, width] of [["#1b1712", 6], ["#ece4cf", 3]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(0, groundY - 14);
    for (let i = 0; i < 4; i++) {
      const baseX = -6 + i * 4;
      const spread = (i - 1.5) * 0.25 * (1 - shut);
      const knuckleX = baseX + Math.sin(spread) * 8;
      const knuckleY = groundY - 14 - Math.cos(spread) * 8;
      ctx.moveTo(baseX, groundY - 14);
      ctx.lineTo(knuckleX, knuckleY);
      ctx.lineTo(knuckleX + Math.sin(spread + curl) * 7 - i * shut, knuckleY - Math.cos(spread + curl) * 7);
    }
    ctx.stroke();
  }
}
