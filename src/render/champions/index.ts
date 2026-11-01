/**
 * Champion renderer registry, keyed by championId.
 *
 * Champion-specific drawing (sprites and ability animations, projectiles,
 * status icons) lives in one file per champion. To add a champion, create
 * src/render/champions/<championId>.ts exporting a ChampionRendererEntry and
 * list it in CHAMPION_RENDERERS.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import type { MarkVisualConfig } from "@/render/overlays/statusIndicators";
import type {
  ChampionBodyRenderer,
  ChampionProjectileRenderer,
  ChampionRendererEntry,
} from "./types";
import { elaraRenderer } from "./elara";
import { gorathRenderer } from "./gorath";
import { lumeRenderer } from "./lume";
import { magnusRenderer } from "./magnus";
import { vexRenderer } from "./vex";
import { urukRenderer } from "./uruk";
import { oitboilRenderer } from "./oitboil";
import { vileRenderer } from "./vile";
import { warriorRenderer } from "./warrior";

export type {
  ChampionBodyRenderer,
  ChampionProjectileRenderer,
  ChampionRendererEntry,
};

/**
 * Renderer entry for every champion, keyed by championId (alphabetical).
 */
export const CHAMPION_RENDERERS: Readonly<
  Record<string, ChampionRendererEntry>
> = {
  elara: elaraRenderer,
  gorath: gorathRenderer,
  lume: lumeRenderer,
  magnus: magnusRenderer,
  uruk: urukRenderer,
  oitboil: oitboilRenderer,
  vex: vexRenderer,
  vile: vileRenderer,
  warrior: warriorRenderer,
};

/**
 * Get a champion's renderer entry.
 */
export function getChampionRenderer(
  championId: string,
): ChampionRendererEntry | undefined {
  return CHAMPION_RENDERERS[championId];
}

/**
 * Create the body renderer of every champion that has one, keyed by
 * championId.
 */
export function createChampionBodyRenderers(
  rc: EntityRenderContext,
): Map<string, ChampionBodyRenderer> {
  const bodies = new Map<string, ChampionBodyRenderer>();
  for (const [championId, entry] of Object.entries(CHAMPION_RENDERERS)) {
    if (entry.createBodyRenderer) {
      bodies.set(championId, entry.createBodyRenderer(rc));
    }
  }
  return bodies;
}

/** Projectile renderers from every champion, keyed by abilityId. */
const projectileRenderers = new Map<string, ChampionProjectileRenderer>(
  Object.values(CHAMPION_RENDERERS).flatMap((entry) =>
    Object.entries(entry.projectiles),
  ),
);

/**
 * Get the renderer for a champion's projectile, by the projectile's abilityId.
 */
export function getChampionProjectileRenderer(
  abilityId: string,
): ChampionProjectileRenderer | undefined {
  return projectileRenderers.get(abilityId);
}

/**
 * Status icons from every champion, keyed by effect definitionId.
 */
export function getChampionMarkVisuals(): Record<string, MarkVisualConfig> {
  const visuals: Record<string, MarkVisualConfig> = {};
  for (const entry of Object.values(CHAMPION_RENDERERS)) {
    Object.assign(visuals, entry.markVisuals);
  }
  return visuals;
}

/**
 * Sprite sheets every champion needs preloaded.
 */
export function getChampionImages(): string[] {
  return Object.values(CHAMPION_RENDERERS).flatMap((entry) => entry.images);
}
