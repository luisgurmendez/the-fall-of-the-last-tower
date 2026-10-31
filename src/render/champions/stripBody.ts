/**
 * A champion body drawn from generated sprite strips (scripts/generate-sprites.ts):
 * one strip per animation, square frames side by side facing right, so the
 * frame size is a strip's height and the frame count its width over its
 * height.
 *
 * It plays an ability's own strip over that ability's cast animation, the
 * attack strip once per basic attack, the walk strip while moving and the
 * idle strip otherwise, mirrored when the champion faces left.
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import { drawSpriteFrame, getSpriteFeet, imageCache } from "@/render/entities/shared";
import type { ChampionBodyRenderer } from "./types";

/** A champion's strips */
export interface ChampionStrips {
  idle: string;
  walk: string;
  attack: string;
  /** Strips for abilities with their own animation, by ability id */
  abilities: Record<string, string>;
}

/**
 * The strips scripts/generate-sprites.ts makes for a champion, in
 * /assets/champs/<championId>/, with the ability ids that play its q, w, e
 * and r strips.
 */
export function generatedStrips(
  championId: string,
  abilities: Partial<Record<"q" | "w" | "e" | "r", string>>,
): ChampionStrips {
  const dir = `/assets/champs/${championId}`;
  return {
    idle: `${dir}/idle.png`,
    walk: `${dir}/walk.png`,
    attack: `${dir}/attack.png`,
    abilities: Object.fromEntries(
      Object.entries(abilities).map(([slot, abilityId]) => [abilityId, `${dir}/${slot}.png`]),
    ),
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
      const abilityStrip = cast.casting && cast.abilityId ? strips.abilities[cast.abilityId] : undefined;

      let src: string;
      // Where in a one-shot animation we are (0-1), or null to loop
      let progress: number | null = null;
      if (abilityStrip) {
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
      const frameIndex = progress !== null
        ? Math.min(frameCount - 1, Math.floor(progress * frameCount))
        : Math.floor(rc.animationTime * (state.isWalking ? 10 : 6)) % frameCount;

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
