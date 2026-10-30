/**
 * Types for the per-champion renderer registry (src/render/champions/).
 */

import type {
  EntityRenderContext,
  EntityRenderState,
} from "@/render/entities/types";
import type { MarkVisualConfig } from "@/render/overlays/statusIndicators";

/**
 * Draws a champion's body. The canvas is already translated to the
 * champion's position.
 */
export interface ChampionBodyRenderer {
  /**
   * Returns false when nothing was drawn (for example, the sprite sheet
   * hasn't loaded yet), so the default circle is drawn instead.
   */
  render(
    ctx: CanvasRenderingContext2D,
    snapshot: any,
    state: EntityRenderState,
  ): boolean;
}

/**
 * Draws one of a champion's projectiles. The canvas is already translated to
 * the projectile; angle is its direction of travel.
 */
export type ChampionProjectileRenderer = (
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  angle: number,
  rc: EntityRenderContext,
) => void;

/**
 * Everything the client draws differently for one champion.
 */
export interface ChampionRendererEntry {
  /** Sprite sheets to preload. */
  images: readonly string[];
  /**
   * Creates the body renderer. Called once per EntityRenderer (one per
   * match), so state a body keeps between frames, such as dash afterimages,
   * doesn't leak between matches. null draws the default team-colored circle.
   */
  createBodyRenderer:
    | ((rc: EntityRenderContext) => ChampionBodyRenderer)
    | null;
  /** Projectile renderers, keyed by the projectile's abilityId. */
  projectiles: Readonly<Record<string, ChampionProjectileRenderer>>;
  /** Status icons for this champion's buffs and debuffs, keyed by effect id. */
  markVisuals: Readonly<Record<string, MarkVisualConfig>>;
}
