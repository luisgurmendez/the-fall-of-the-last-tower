/**
 * StructureRules - Which structures can be damaged right now.
 *
 * Structures fall in lane order, so they can't be skipped by walking through
 * the jungle ("backdooring"):
 * - an inner (tier 2) tower can't be damaged while its lane's outer tower stands
 * - an inhibitor can't be damaged while a tower of its lane stands
 * - a nexus can't be damaged while all of its inhibitors stand (they rebuild,
 *   so it can be protected again)
 */

import { EntityType } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

interface LaneTower {
  lane: string;
  tier: number;
}

function livingTowers(context: ServerGameContext, side: number): (ServerEntity & LaneTower)[] {
  return context.getStructures().filter(entity =>
    entity.entityType === EntityType.TOWER && entity.side === side && !entity.isDead
  ) as (ServerEntity & LaneTower)[];
}

/**
 * Whether a tower, inhibitor or nexus can take damage now. Other entities
 * always can.
 */
export function isStructureVulnerable(structure: ServerEntity, context: ServerGameContext): boolean {
  if (structure.entityType === EntityType.TOWER) {
    const { lane, tier } = structure as ServerEntity & LaneTower;
    return !livingTowers(context, structure.side).some(tower => tower.lane === lane && tower.tier < tier);
  }

  if (structure.entityType === EntityType.INHIBITOR) {
    const { lane } = structure as ServerEntity & { lane: string };
    return !livingTowers(context, structure.side).some(tower => tower.lane === lane);
  }

  if (structure.entityType === EntityType.NEXUS) {
    return context.getStructures().some(entity =>
      entity.entityType === EntityType.INHIBITOR && entity.side === structure.side && entity.isDead
    );
  }

  return true;
}
