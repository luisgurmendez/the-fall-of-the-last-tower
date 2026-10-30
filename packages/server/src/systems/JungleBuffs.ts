/**
 * JungleBuffs - Buffs for killing buff camps and the dragon.
 *
 * - Blue buff (Crest of Insight): +15 ability haste and +4 mana/energy regen
 *   per second for the killer
 * - Red buff (Crest of Cinders): +4 health regen per second for the killer, and
 *   their basic attacks burn and slow (ChampionBasicAttacks.applyOnHitBuffs)
 * - Dragon (Dragon's Might): +8% attack damage and ability power for every
 *   champion on the killer's team, kept through death
 */

import { EntityType, GameEventType } from '@siege/shared';
import type { ServerGameContext } from '../game/ServerGameContext';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import { Logger } from '../utils/Logger';

/** Buff durations in seconds */
export const JUNGLE_BUFF_DURATION = {
  BLUE: 90,
  RED: 90,
  DRAGON: 150,
};

const BUFF_EFFECTS: Partial<Record<string, string[]>> = {
  blue_buff: ['crest_of_insight', 'crest_of_insight_regen'],
  red_buff: ['crest_of_cinders'],
};

/**
 * Grant the buff for a slain creature, if it gives one.
 */
export function grantJungleBuffs(
  creature: ServerEntity & { creatureType: string },
  killerId: string | undefined,
  context: ServerGameContext
): void {
  const killer = killerId ? context.getEntity(killerId) : undefined;
  if (!killer || killer.entityType !== EntityType.CHAMPION) return;
  const champion = killer as ServerChampion;

  const effects = BUFF_EFFECTS[creature.creatureType];
  if (effects) {
    const duration = creature.creatureType === 'blue_buff' ? JUNGLE_BUFF_DURATION.BLUE : JUNGLE_BUFF_DURATION.RED;
    for (const effectId of effects) champion.applyEffect(effectId, duration, creature.id);
    Logger.game.info(`${champion.playerId} took ${creature.creatureType}`);
    return;
  }

  if (creature.creatureType === 'dragon') {
    for (const ally of context.getChampionsBySide(champion.side)) {
      ally.applyEffect('dragons_might', JUNGLE_BUFF_DURATION.DRAGON, creature.id);
      ally.applyEffect('dragons_might_power', JUNGLE_BUFF_DURATION.DRAGON, creature.id);
    }
    context.addEvent(GameEventType.DRAGON_KILLED, {
      killerId: champion.id,
      side: champion.side,
      duration: JUNGLE_BUFF_DURATION.DRAGON,
    });
    Logger.game.info(`${champion.playerId} slew the dragon for team ${champion.side === 0 ? 'blue' : 'red'}`);
  }
}
