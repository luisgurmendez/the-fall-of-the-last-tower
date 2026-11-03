/**
 * Calamitus's lava: the pools his Q and W leave (zones carrying the id of
 * the ability that left them, which also says what they may burn; clients
 * draw both as molten ground). They burn enemies in them by his level and
 * ability power (CALAMITUS_LAVA), and the passive and his Eruption look for
 * them.
 */

import { CALAMITUS_LAVA, EntityType, type Vector } from '@siege/shared';
import { ServerZone } from '../../../simulation/ServerZone';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';

/** The abilities whose zones are his lava */
const LAVA_ABILITIES = new Set(['calamitus_q', 'calamitus_w']);

/** A pool of lava at a spot, left by one of his abilities */
export function spawnLava(champion: ServerChampion, context: ServerGameContext, position: Vector, radius: number, abilityId: string): void {
  const burnPerSecond = CALAMITUS_LAVA.burnBase + CALAMITUS_LAVA.burnPerLevel * champion.level
    + CALAMITUS_LAVA.burnApRatio * champion.getStats().abilityPower;
  context.addEntity(new ServerZone({
    id: context.generateEntityId(),
    position: position.clone(),
    side: champion.side,
    radius,
    duration: CALAMITUS_LAVA.duration,
    sourceId: champion.id,
    abilityId,
    zoneType: 'damage',
    damage: burnPerSecond * CALAMITUS_LAVA.tickRate,
    damageType: 'magic',
    tickRate: CALAMITUS_LAVA.tickRate,
  }));
}

/** His pools of lava still burning */
export function lavaOf(champion: ServerChampion, context: ServerGameContext): ServerZone[] {
  return context.getAllEntities().filter((entity): entity is ServerZone =>
    entity.entityType === EntityType.ZONE && !entity.isDead && entity instanceof ServerZone &&
    entity.sourceId === champion.id && LAVA_ABILITIES.has(entity.abilityId));
}

/** Whether a spot is in one of his pools */
export function inLava(champion: ServerChampion, context: ServerGameContext, position: Vector, margin = 0): boolean {
  return lavaOf(champion, context).some(pool => pool.position.distanceTo(position) <= pool.radius + margin);
}
