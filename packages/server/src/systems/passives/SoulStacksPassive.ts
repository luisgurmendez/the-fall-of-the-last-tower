/**
 * Default handler for soul stack passives (Vile's Souls of Vilix): kills
 * grant stacks by target type and level, and the next basic attack on a
 * champion consumes them as bonus physical damage.
 */

import {
  EntityType,
  type PassiveAbilityDefinition,
  type PassiveState,
} from '@siege/shared';
import type { ServerChampion } from '../../simulation/ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';
import type { PassiveTriggerData } from '../PassiveTriggerSystem';
import { Logger } from '../../utils/Logger';

/**
 * Handler for Vile's Souls of Vilix passive.
 * Dual-trigger:
 * - on_kill: Gain soul stacks based on target type and champion level
 * - on_hit: Consume all stacks to deal bonus physical damage to champions
 */
export function handleSoulStacks(
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  context: ServerGameContext,
  data?: PassiveTriggerData
): void {
  if (!definition.soulScaling) return;

  // Determine which trigger this is
  // on_kill data will have target (the killed entity)
  // on_hit data will have target (the attacked entity) and will be a champion

  if (!data?.target) return;

  const target = data.target;

  // Check if this is an on_hit trigger (target is a champion, not dead)
  // If target is alive and is a champion, this is an on_hit (basic attack)
  if (target.entityType === EntityType.CHAMPION && !target.isDead) {
    // on_hit: Consume stacks to deal damage
    if (passiveState.stacks > 0) {
      const bonusDamage = passiveState.stacks;
      target.takeDamage(bonusDamage, 'physical', champion.id, context);

      Logger.champion.debug(
        `${champion.playerId} Souls of Vilix consumed ${passiveState.stacks} stacks for ${bonusDamage} physical damage`
      );

      // Reset stacks
      passiveState.stacks = 0;
      passiveState.isActive = false;
    }
    return;
  }

  // on_kill: Gain stacks based on target type
  // This triggers when target is dead
  if (!target.isDead) return;

  const level = champion.level;
  let stacksToGain = 0;

  // Determine stacks based on target type
  switch (target.entityType) {
    case EntityType.MINION: {
      stacksToGain = getSoulStacksByLevel(
        definition.soulScaling.minion.levels,
        definition.soulScaling.minion.stacks,
        level
      );
      break;
    }
    case EntityType.JUNGLE_CAMP: {
      stacksToGain = getSoulStacksByLevel(
        definition.soulScaling.jungle.levels,
        definition.soulScaling.jungle.stacks,
        level
      );
      break;
    }
    case EntityType.CHAMPION: {
      stacksToGain = getSoulStacksByLevel(
        definition.soulScaling.champion.levels,
        definition.soulScaling.champion.stacks,
        level
      );
      break;
    }
    default:
      // Unknown target type, no stacks
      return;
  }

  // Add stacks (no max cap for Vile, no decay)
  passiveState.stacks += stacksToGain;
  passiveState.isActive = passiveState.stacks > 0;

  Logger.champion.debug(
    `${champion.playerId} Souls of Vilix gained ${stacksToGain} stacks (total: ${passiveState.stacks})`
  );
}

/**
 * Get soul stacks based on champion level using the scaling table.
 */
function getSoulStacksByLevel(levels: number[], stacks: number[], championLevel: number): number {
  // Find the appropriate bracket for the champion's level
  for (let i = levels.length - 1; i >= 0; i--) {
    if (championLevel >= levels[i]) {
      return stacks[i];
    }
  }
  return stacks[0];
}
