/**
 * JungleBuffs - Buffs for killing buff camps and the dragon.
 *
 * - Blue buff (Crest of Insight): +15 ability haste and +4 mana/energy regen
 *   per second for the killer
 * - Red buff (Crest of Cinders): +4 health regen per second for the killer, and
 *   their basic attacks burn and slow (ChampionBasicAttacks.applyOnHitBuffs)
 * - Dragon (Dragon's Might): +8% attack damage and ability power for every
 *   champion on the killer's team, kept through death
 * - Rootwyrm (Heartwood Pact): +12 armor and magic resist and +5 health
 *   regen per second for every champion on the killer's team, kept through
 *   death
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
  ROOTWYRM: 150,
};

/** The epic monsters' team-wide effects */
const TEAM_EFFECTS: Partial<Record<string, string[]>> = {
  dragon: ['dragons_might', 'dragons_might_power'],
  rootwyrm: ['heartwood_pact', 'heartwood_pact_ward', 'heartwood_pact_sap'],
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

  const teamEffects = TEAM_EFFECTS[creature.creatureType];
  if (teamEffects) {
    const duration = creature.creatureType === 'dragon' ? JUNGLE_BUFF_DURATION.DRAGON : JUNGLE_BUFF_DURATION.ROOTWYRM;
    for (const ally of context.getChampionsBySide(champion.side)) {
      for (const effectId of teamEffects) ally.applyEffect(effectId, duration, creature.id);
    }
    // An epic monster slain (the event's name is the dragon's, which came first)
    context.addEvent(GameEventType.DRAGON_KILLED, {
      killerId: champion.id,
      side: champion.side,
      duration,
      creatureType: creature.creatureType,
    });
    Logger.game.info(`${champion.playerId} slew the ${creature.creatureType} for team ${champion.side === 0 ? 'blue' : 'red'}`);
  }
}
