/**
 * The range of enemy towers near the local champion, drawn on the ground:
 * how close it can walk before the tower can shoot it. The ring fades in as
 * the champion approaches and turns red while the tower is aiming at it.
 */

import {
  DEFAULT_TOWER_STATS,
  EntityType,
  getChampionDefinition,
  getEffectiveRadius,
  type ChampionSnapshot,
  type TowerSnapshot,
} from "@siege/shared";
import type { InterpolatedEntity } from "@/core/OnlineStateManager";

/**
 * A champion's collision radius, as the server's (ServerChampion.getRadius):
 * tower range is edge to edge, so the ring adds it
 */
function championRadius(snapshot: ChampionSnapshot): number {
  const collision = getChampionDefinition(snapshot.championId)?.collision;
  return collision?.type === "circle" ? collision.radius : 25;
}
/** The ring starts fading in this far outside it */
const FADE_DISTANCE = 250;

/**
 * Draw the range rings of the enemy towers the local champion is near.
 */
export function renderTowerRanges(
  ctx: CanvasRenderingContext2D,
  entities: Iterable<InterpolatedEntity>,
  local: InterpolatedEntity | undefined,
  localSide: number,
): void {
  if (!local || (local.snapshot as { isDead?: boolean }).isDead) return;
  const ownRadius = local.snapshot.entityType === EntityType.CHAMPION ? championRadius(local.snapshot) : 25;

  for (const entity of entities) {
    if (entity.snapshot.entityType !== EntityType.TOWER) continue;
    const tower = entity.snapshot as TowerSnapshot;
    if (tower.side === localSide || tower.isDestroyed) continue;

    const stats = DEFAULT_TOWER_STATS[tower.tier];
    if (!stats) continue;
    const towerRadius = stats.collision ? getEffectiveRadius(stats.collision) : 50;
    const reach = stats.attackRange + towerRadius + ownRadius;

    const distance = Math.hypot(local.position.x - entity.position.x, local.position.y - entity.position.y);
    const visibility = Math.min(1, (reach + FADE_DISTANCE - distance) / FADE_DISTANCE);
    if (visibility <= 0) continue;

    const aimingAtUs = tower.targetEntityId === local.snapshot.entityId;
    ctx.save();
    ctx.globalAlpha = visibility;
    ctx.beginPath();
    ctx.arc(entity.position.x, entity.position.y, reach, 0, Math.PI * 2);
    ctx.fillStyle = aimingAtUs ? "rgba(231, 76, 60, 0.12)" : "rgba(255, 255, 255, 0.04)";
    ctx.fill();
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = aimingAtUs ? "rgba(231, 76, 60, 0.8)" : "rgba(255, 255, 255, 0.45)";
    ctx.stroke();
    ctx.restore();
  }
}
