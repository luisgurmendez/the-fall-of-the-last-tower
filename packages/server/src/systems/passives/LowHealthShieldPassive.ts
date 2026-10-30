/**
 * Default handler for on_low_health shield passives (like Warrior's Undying
 * Resolve): below the health threshold, gain a shield (optionally scaled by
 * level) and stat bonuses, then go on the passive's internal cooldown.
 */

import {
  calculateAbilityValue,
  type PassiveAbilityDefinition,
  type PassiveState,
} from '@siege/shared';
import type { ServerChampion } from '../../simulation/ServerChampion';
import type { ServerGameContext } from '../../game/ServerGameContext';
import type { PassiveTriggerData } from '../PassiveTriggerSystem';
import { Logger } from '../../utils/Logger';

/**
 * Handler for on_low_health shield passives (Warrior).
 */
export function handleLowHealthShield(
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  _context: ServerGameContext,
  _data?: PassiveTriggerData
): void {
  const healthPercent = champion.health / champion.maxHealth;
  const threshold = definition.healthThreshold ?? 0.3;

  if (healthPercent > threshold) return;

  // Apply shield
  if (definition.shield) {
    const stats = champion.getStats();
    const baseShieldValue = definition.scalesWithLevel
      ? getLevelScaledValue(definition, champion.level)
      : definition.shield.scaling.base[0];

    const shieldAmount = calculateAbilityValue(
      { ...definition.shield.scaling, base: [baseShieldValue] },
      1,
      {
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }
    );

    champion.shields.push({
      amount: shieldAmount,
      remainingDuration: definition.shield.duration,
      sourceId: `passive_${definition.id}`,
      shieldType: 'normal',
    });
  }

  // Apply stat modifiers via effects (so they show in HUD)
  if (definition.statModifiers) {
    const effectDuration = definition.shield?.duration ?? 5;
    for (const mod of definition.statModifiers) {
      // For warrior passive, apply the undying resolve effect
      if (definition.id === 'warrior_passive' && mod.stat === 'armor') {
        champion.applyEffect('warrior_undying_resolve', effectDuration, `passive_${definition.id}`);
      } else {
        // Fallback to direct modifier for other passives
        champion.addModifier({
          source: `passive_${definition.id}`,
          flat: mod.flatValue ? { [mod.stat]: mod.flatValue } as any : undefined,
          percent: mod.percentValue ? { [mod.stat]: 1 + mod.percentValue } as any : undefined,
          duration: effectDuration,
          timeRemaining: effectDuration,
        });
      }
    }
  }

  // Set cooldown
  passiveState.cooldownRemaining = definition.internalCooldown ?? 60;
  passiveState.isActive = true;

  Logger.champion.info(`${champion.playerId} triggered ${definition.name}`);
}

/**
 * Get level-scaled value for a passive.
 */
function getLevelScaledValue(definition: PassiveAbilityDefinition, level: number): number {
  if (!definition.levelScaling) {
    return definition.shield?.scaling.base[0] ?? 0;
  }

  const { levels, values } = definition.levelScaling;

  for (let i = levels.length - 1; i >= 0; i--) {
    if (level >= levels[i]) {
      return values[i];
    }
  }

  return values[0];
}
