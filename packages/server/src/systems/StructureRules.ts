/**
 * StructureRules - Which structures can be damaged right now.
 *
 * Structures fall in lane order, so they can't be skipped by walking through
 * the jungle ("backdooring"):
 * - an inner (tier 2) tower can't be damaged while its lane's outer tower stands
 * - a nexus can't be damaged until one of its lanes has lost every tower
 */

import { EntityType } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

interface LaneTower {
  lane: string;
  tier: number;
}

function livingTowers(context: ServerGameContext, side: number): (ServerEntity & LaneTower)[] {
  return context.getAllEntities().filter(entity =>
    entity.entityType === EntityType.TOWER && entity.side === side && !entity.isDead
  ) as (ServerEntity & LaneTower)[];
}

/**
 * Whether a tower or nexus can take damage now. Other entities always can.
 */
export function isStructureVulnerable(structure: ServerEntity, context: ServerGameContext): boolean {
  if (structure.entityType === EntityType.TOWER) {
    const { lane, tier } = structure as ServerEntity & LaneTower;
    return !livingTowers(context, structure.side).some(tower => tower.lane === lane && tower.tier < tier);
  }

  if (structure.entityType === EntityType.NEXUS) {
    const lanes = new Set(context.mapConfig.TOWERS.POSITIONS.filter(t => t.side === structure.side).map(t => t.lane));
    const standing = new Set(livingTowers(context, structure.side).map(tower => tower.lane));
    return [...lanes].some(lane => !standing.has(lane));
  }

  return true;
}
