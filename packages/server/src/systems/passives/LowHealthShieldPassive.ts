/**
 * Default handler for on_low_health shield passives (like Warrior's Undying
 * Resolve): below the health threshold, gain a shield (its base by level,
 * getPassiveLevelValue) and the passive's effects (Undying Resolve's armor)
 * for the shield's duration, then go on the passive's internal cooldown.
 */

import {
  calculateAbilityValue,
  getPassiveLevelValue,
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
    const shieldAmount = calculateAbilityValue(
      { ...definition.shield.scaling, base: [getPassiveLevelValue(definition, champion.level)] },
      1,
      {
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }
    );

    champion.grantShield(shieldAmount, definition.shield.duration, `passive_${definition.id}`);
  }

  // Its effects (so they show in the HUD) and stat modifiers, as long as the shield
  const effectDuration = definition.effectDuration ?? definition.shield?.duration ?? 5;
  for (const effectId of definition.appliesEffects ?? []) {
    champion.applyEffect(effectId, effectDuration, `passive_${definition.id}`);
  }
  for (const mod of definition.statModifiers ?? []) {
    champion.addModifier({
      source: `passive_${definition.id}`,
      flat: mod.flatValue ? { [mod.stat]: mod.flatValue } as any : undefined,
      percent: mod.percentValue ? { [mod.stat]: 1 + mod.percentValue } as any : undefined,
      duration: effectDuration,
      timeRemaining: effectDuration,
    });
  }

  // Set cooldown
  passiveState.cooldownRemaining = definition.internalCooldown ?? 60;
  passiveState.isActive = true;

  Logger.champion.info(`${champion.playerId} triggered ${definition.name}`);
}
