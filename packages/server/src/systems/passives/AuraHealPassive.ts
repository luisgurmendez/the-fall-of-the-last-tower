/**
 * Default handler for aura heal passives (like Elara's Blessed Presence):
 * heal allied units around the champion by their max health (not
 * structures).
 */

import {
  calculateAbilityValue,
  isUnitEntityType,
  type PassiveAbilityDefinition,
  type PassiveState,
} from '@siege/shared';
import type { ServerChampion } from '../../simulation/ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';
import type { PassiveTriggerData } from '../PassiveTriggerSystem';

/**
 * Handler for aura heal passives (Elara).
 */
export function handleAuraHeal(
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  context: ServerGameContext,
  _data?: PassiveTriggerData
): void {
  if (!definition.auraRadius || !definition.heal) return;

  // Get allies in range
  const entities = context.getEntitiesInRadius(champion.position, definition.auraRadius);

  for (const entity of entities) {
    if (entity.side !== champion.side) continue;
    if (entity.isDead) continue;
    if (!isUnitEntityType(entity.entityType)) continue;
    if (!('heal' in entity)) continue;

    const entityMaxHealth = entity.maxHealth;
    const healAmount = calculateAbilityValue(
      definition.heal.scaling,
      1,
      { maxHealth: entityMaxHealth }
    );

    entity.heal(healAmount, context, champion.id);
  }

  passiveState.isActive = true;
}
