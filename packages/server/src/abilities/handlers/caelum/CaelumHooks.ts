/**
 * Caelum's rules beyond his abilities' execution:
 * - Lightweaving (passive): every 8 seconds, once someone near him is hurt,
 *   his light heals him and allied champions within 300 (an ABILITY_CAST
 *   caelum_lightweave for the VFX). It waits, charged, while nobody is.
 */

import { CAELUM_LIGHT, GameEventType } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';

export const caelumHooks: IChampionHooks = {
  championId: 'caelum',

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    if (champion.isDead) return;
    const data = (champion.passiveState.customData ??= {}) as { weaveReadyAt?: number };
    const now = context.getGameTime();
    data.weaveReadyAt ??= now + CAELUM_LIGHT.weaveEvery;
    const ready = now >= data.weaveReadyAt;
    champion.passiveState.isActive = ready;
    if (!ready) return;

    const allies = context.getAllChampions().filter(ally =>
      ally.side === champion.side && !ally.isDead &&
      ally.position.distanceTo(champion.position) <= CAELUM_LIGHT.weaveRadius);
    if (!allies.some(ally => ally.health < ally.maxHealth - 1)) return;

    const heal = CAELUM_LIGHT.weaveBase + CAELUM_LIGHT.weavePerLevel * champion.level
      + CAELUM_LIGHT.weaveApRatio * champion.getStats().abilityPower;
    for (const ally of allies) ally.heal(heal, context, champion.id);
    data.weaveReadyAt = now + CAELUM_LIGHT.weaveEvery;
    champion.passiveState.isActive = false;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'caelum_lightweave',
      targetX: champion.position.x,
      targetY: champion.position.y,
    });
  },
};
