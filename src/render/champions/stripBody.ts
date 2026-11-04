/**
 * A champion body drawn from generated sprite strips (scripts/generate-sprites.ts):
 * one strip per animation, square frames side by side facing right, so the
 * frame size is a strip's height and the frame count its width over its
 * height.
 *
 * It plays an ability's own strip over that ability's cast animation (and
 * holds it mid-motion for as long as that ability's dash lasts), the attack
 * strip once per basic attack, the walk strip while moving and the idle
 * strip otherwise, mirrored when the champion faces left. A champion drawn
 * in four directions also has each strip facing south and north
 * (<strip>_south.png, <strip>_north.png), played when it faces down or up the
 * screen (src/render/entities/facing.ts).
 *
 * A generated strip rarely lands its blow where the game does: Magnus
 * stands still for eight frames and throws on the ninth, while his damage
 * lands halfway. With a strip's blow frame (`StripTiming`), it's retimed so
 * that frame shows as the attack's damage lands or the ability takes effect
 * (retimedFrame, abilityBlowShare: an ability with a cast time starts its
 * animation at the windup, so its blow comes after the cast time it played
 * through, `lead`).
 */

import { getBasicAttackDamageDelay, getBasicAttackDuration, getChampionDefinition } from "@siege/shared";
import { abilityImpactTime } from "@/core/state/abilityTiming";
import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { drawSpriteFrame, getSpriteFeet, getSpriteTop, imageCache } from "@/render/entities/shared";
import type { VerticalFacing } from "@/render/entities/facing";
import type { ChampionBodyRenderer } from "./types";

/** Where in its ability strip a dashing champion is held */
const DASH_HOLD_PROGRESS = 0.45;
/** The blow frame shows this much of the attack before the damage lands (the swing reads as the hit) */
const RELEASE_LEAD = 0.08;
/** Walk cycle frames per second at the champions' base pace (units a second)... */
const WALK_FPS = 8;
const WALK_PACE = 100;
/** ...and slower or faster with their speed (a slow, Haste), so their feet don't slide */
const MIN_WALK_RATE = 0.4;
const MAX_WALK_RATE = 1.8;
/** Idle cycle frames per second */
const IDLE_FPS = 6;

/** Where each champion is in its walk cycle, advanced at its own speed */
const walkCycles = new Map<string, { phase: number; time: number }>();

/** The walk strip's frame for a champion walking at `speed` (animation time in seconds) */
function walkFrame(entityId: string, speed: number | undefined, time: number, frameCount: number): number {
  const cycle = walkCycles.get(entityId) ?? { phase: 0, time };
  const rate = Math.min(MAX_WALK_RATE, Math.max(MIN_WALK_RATE, (speed ?? WALK_PACE) / WALK_PACE));
  // A long gap (it stopped walking) doesn't count
  cycle.phase += Math.min(0.1, Math.max(0, time - cycle.time)) * WALK_FPS * rate;
  cycle.time = time;
  walkCycles.set(entityId, cycle);
  return Math.floor(cycle.phase) % frameCount;
}

/** A champion's strips */
export interface ChampionStrips {
  idle: string;
  walk: string;
  attack: string;
  /** Strips for abilities with their own animation, by ability id */
  abilities: Record<string, string>;
  timing: StripTiming;
  /** The directions its strips are also drawn facing, besides sideways */
  directions: VerticalFacing[];
}

/** Which frames of a champion's strips matter */
export interface StripTiming {
  /** Where in a dash ability's strip to hold while dashing, by ability id (default DASH_HOLD_PROGRESS) */
  dashHold?: Record<string, number>;
  /** The attack strip's blow frame (the swing, the throw, the arrow loosed) */
  attackBlow?: number;
  /** Ability strips' blow frames, by ability id */
  abilityBlows?: Record<string, number>;
}

/**
 * A strip's frame at `progress` (0-1) through its animation: played straight
 * without a blow frame; with one, the frames before it fill the time until
 * just before the blow lands (`hitShare` of the way through) and the rest
 * fill what's left.
 */
export function retimedFrame(progress: number, frameCount: number, blow: number | undefined, hitShare: number): number {
  const last = frameCount - 1;
  if (blow === undefined || blow <= 0 || blow > last) return Math.min(last, Math.floor(progress * frameCount));
  const at = Math.min(0.92, Math.max(0.05, hitShare - RELEASE_LEAD));
  if (progress < at) return Math.min(blow - 1, Math.floor((progress / at) * blow));
  return Math.min(last, blow + Math.floor(((progress - at) / (1 - at)) * (frameCount - blow)));
}

/**
 * How far through an ability's animation its blow lands (0-1): after the
 * cast time it played through first (`lead`, 0 when the animation started
 * as the ability went off), then the ability's impact time
 */
export function abilityBlowShare(lead: number, impact: number, duration: number): number {
  if (duration <= 0) return 1;
  return Math.min(1, (lead + impact) / duration);
}

/** How far through a champion's basic attack its damage lands (0-1) */
function hitShare(championId: string, attackSpeed: number | undefined): number {
  const definition = getChampionDefinition(championId);
  if (!definition) return 0.5;
  const speed = attackSpeed ?? definition.baseStats.attackSpeed;
  return Math.min(1, getBasicAttackDamageDelay(definition, speed) / getBasicAttackDuration(speed));
}

/**
 * The strips scripts/generate-sprites.ts makes for a champion, in
 * /assets/champs/<championId>/, with the ability ids that play its q, w, e
 * and r strips, and the directions they're also drawn facing (a
 * four-direction champion's south and north).
 */
export function generatedStrips(
  championId: string,
  abilities: Partial<Record<"q" | "w" | "e" | "r", string>>,
  timing: StripTiming = {},
  directions: VerticalFacing[] = [],
): ChampionStrips {
  const dir = `/assets/champs/${championId}`;
  return {
    idle: `${dir}/idle.png`,
    walk: `${dir}/walk.png`,
    attack: `${dir}/attack.png`,
    abilities: Object.fromEntries(
      Object.entries(abilities).map(([slot, abilityId]) => [abilityId, `${dir}/${slot}.png`]),
    ),
    timing,
    directions,
  };
}

/** A strip facing south or north: idle.png -> idle_south.png */
export function facingStrip(src: string, facing: VerticalFacing): string {
  return src.replace(/\.png$/, `_${facing}.png`);
}

/** Every strip of a set, in every direction, to preload */
export function stripImages(strips: ChampionStrips): string[] {
  const sideways = [strips.idle, strips.walk, strips.attack, ...Object.values(strips.abilities)];
  return [...sideways, ...strips.directions.flatMap(facing => sideways.map(src => facingStrip(src, facing)))];
}

function loaded(image: HTMLImageElement | undefined): image is HTMLImageElement {
  return image !== undefined && image.complete && image.naturalWidth > 0;
}

/**
 * Creates a body renderer for a champion's strips, drawn at `scale` world
 * units per sprite pixel.
 */
export function createStripBodyRenderer(
  strips: ChampionStrips,
  scale: number,
  rc: EntityRenderContext,
): ChampionBodyRenderer {
  return {
    getFeet: () => getSpriteFeet(strips.idle, scale),
    getTop: () => getSpriteTop(strips.idle, scale),
    render(ctx: CanvasRenderingContext2D, snapshot: any, state: EntityRenderState): boolean {
      const entityId = snapshot.entityId;
      const cast = rc.stateManager.isEntityCastingAbility(entityId);
      const { timing } = strips;
      const abilityStrip = cast.casting && cast.abilityId ? strips.abilities[cast.abilityId] : undefined;
      const dashStrip = snapshot.isDashing && snapshot.dashAbilityId ? strips.abilities[snapshot.dashAbilityId] : undefined;

      let src: string;
      // Where in a one-shot animation we are (0-1), or null to loop
      let progress: number | null = null;
      if (dashStrip) {
        // Mid-dash: hold the ability's frame of motion
        src = dashStrip;
        progress = timing.dashHold?.[snapshot.dashAbilityId] ?? DASH_HOLD_PROGRESS;
      } else if (abilityStrip) {
        src = abilityStrip;
        progress = rc.stateManager.getAbilityAnimationProgress(entityId);
      } else if (state.isAttacking) {
        src = strips.attack;
        progress = rc.stateManager.getAttackAnimationProgress(entityId);
      } else if (state.isWalking) {
        src = strips.walk;
      } else {
        src = strips.idle;
      }

      // Facing up or down the screen: that direction's strip, when it has one
      const facing = state.facingVertical !== null && strips.directions.includes(state.facingVertical) ? state.facingVertical : null;
      const turned = facing ? imageCache.get(facingStrip(src, facing)) : undefined;
      const image = loaded(turned) ? turned : imageCache.get(src);
      if (!loaded(image)) return false;

      const frameSize = image.naturalHeight;
      const frameCount = Math.max(1, Math.round(image.naturalWidth / frameSize));
      let frameIndex: number;
      if (progress === null) {
        frameIndex = state.isWalking
          ? walkFrame(entityId, snapshot.movementSpeed, rc.animationTime, frameCount)
          : Math.floor(rc.animationTime * IDLE_FPS) % frameCount;
      } else if (src === strips.attack) {
        frameIndex = retimedFrame(progress, frameCount, timing.attackBlow, hitShare(snapshot.championId, snapshot.attackSpeed));
      } else if (src === abilityStrip && !dashStrip && cast.abilityId && cast.duration) {
        frameIndex = retimedFrame(progress, frameCount, timing.abilityBlows?.[cast.abilityId],
          abilityBlowShare(cast.lead ?? 0, abilityImpactTime(cast.abilityId), cast.duration));
      } else {
        frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
      }

      ctx.save();
      // Sideways strips face right
      if (image !== turned && !state.facingRight) {
        ctx.scale(-1, 1);
      }
      drawSpriteFrame(ctx, image, frameIndex * frameSize, frameSize, frameSize, scale, rc.getOutlineColor(entityId));
      ctx.restore();
      return true;
    },
  };
}
