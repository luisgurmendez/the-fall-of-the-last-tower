/**
 * A champion body drawn from generated sprite strips (scripts/generate-sprites.ts):
 * one strip per animation, square frames side by side facing right, so the
 * frame size is a strip's height and the frame count its width over its
 * height.
 *
 * It plays an ability's own strip over that ability's cast animation (and
 * holds it mid-motion for as long as that ability's dash lasts), the attack
 * strip once per basic attack, the walk strip while moving and the idle
 * strip otherwise, mirrored when the champion faces left.
 *
 * A generated strip rarely lands its blow where the game does: Magnus
 * stands still for eight frames and throws on the ninth, while his damage
 * lands halfway. With a strip's blow frame (`StripTiming`), it's retimed so
 * that frame shows as the attack's damage lands or the ability takes effect
 * (retimedFrame, abilityImpactTime).
 */

import { getBasicAttackDamageDelay, getBasicAttackDuration, getChampionDefinition } from "@siege/shared";
import { abilityImpactTime } from "@/core/state/abilityTiming";
import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { drawSpriteFrame, getSpriteFeet, imageCache } from "@/render/entities/shared";
import type { ChampionBodyRenderer } from "./types";

/** Where in its ability strip a dashing champion is held */
const DASH_HOLD_PROGRESS = 0.45;
/** The blow frame shows this much of the attack before the damage lands (the swing reads as the hit) */
const RELEASE_LEAD = 0.08;

/** A champion's strips */
export interface ChampionStrips {
  idle: string;
  walk: string;
  attack: string;
  /** Strips for abilities with their own animation, by ability id */
  abilities: Record<string, string>;
  timing: StripTiming;
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
 * and r strips.
 */
export function generatedStrips(
  championId: string,
  abilities: Partial<Record<"q" | "w" | "e" | "r", string>>,
  timing: StripTiming = {},
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
  };
}

/** Every strip of a set, to preload */
export function stripImages(strips: ChampionStrips): string[] {
  return [strips.idle, strips.walk, strips.attack, ...Object.values(strips.abilities)];
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

      const image = imageCache.get(src);
      if (!image || !image.complete || image.naturalWidth === 0) return false;

      const frameSize = image.naturalHeight;
      const frameCount = Math.max(1, Math.round(image.naturalWidth / frameSize));
      let frameIndex: number;
      if (progress === null) {
        frameIndex = Math.floor(rc.animationTime * (state.isWalking ? 8 : 6)) % frameCount;
      } else if (src === strips.attack) {
        frameIndex = retimedFrame(progress, frameCount, timing.attackBlow, hitShare(snapshot.championId, snapshot.attackSpeed));
      } else if (src === abilityStrip && !dashStrip && cast.abilityId && cast.duration) {
        frameIndex = retimedFrame(progress, frameCount, timing.abilityBlows?.[cast.abilityId], abilityImpactTime(cast.abilityId) / cast.duration);
      } else {
        frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
      }

      ctx.save();
      if (!state.facingRight) {
        ctx.scale(-1, 1);
      }
      drawSpriteFrame(ctx, image, frameIndex * frameSize, frameSize, frameSize, scale, rc.getOutlineColor(entityId));
      ctx.restore();
      return true;
    },
  };
}
