/**
 * ElaraRHandler - Divine Intervention
 *
 * Heal all allies in range and cleanse all debuffs.
 *
 * SPECIAL MECHANICS:
 * - AoE heal centered on Elara
 * - Removes all debuffs (CC, slows, etc.) from affected allies
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import { Logger } from '../../../utils/Logger';

export class ElaraRHandler extends BaseAbilityHandler {
  readonly abilityId = 'elara_resurrection';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank } = params;

    const healAmount = this.calculateHeal(definition, rank, champion);
    const radius = definition.aoeRadius ?? 600;

    // Get all allies in range (including self)
    const allies = this.getAlliesInRadius(
      champion.position,
      radius,
      champion,
      context,
      true
    );

    let alliesHealed = 0;
    let debuffsCleansed = 0;

    for (const entity of allies) {
      // Heal the ally
      if (healAmount > 0) {
        this.healEntity(entity, healAmount);
        alliesHealed++;
      }

      // Cleanse all debuffs
      if ('activeEffects' in entity) {
        const cleansedCount = this.cleanseDebuffs(entity as ServerChampion);
        debuffsCleansed += cleansedCount;
      }
    }

    Logger.champion.info(
      `${champion.playerId} cast Divine Intervention - healed ${alliesHealed} allies for ${healAmount.toFixed(0)}, cleansed ${debuffsCleansed} debuffs`
    );

    return { success: true };
  }

  /**
   * Remove all debuff effects from a champion.
   * Returns the number of effects cleansed.
   */
  private cleanseDebuffs(champion: ServerChampion): number {
    if (!champion.activeEffects) return 0;

    const initialCount = champion.activeEffects.length;

    // Remove all negative effects (stuns, slows, roots, etc.)
    champion.activeEffects = champion.activeEffects.filter(effect => {
      // Keep buff effects, remove debuffs
      const isDebuff = this.isDebuffEffect(effect.definitionId);
      return !isDebuff;
    });

    // Reset CC status after cleanse
    if ('updateCrowdControlStatus' in champion) {
      (champion as any).updateCrowdControlStatus();
    }

    return initialCount - champion.activeEffects.length;
  }

  /**
   * Check if an effect ID represents a debuff.
   */
  private isDebuffEffect(effectId: string): boolean {
    // Debuff patterns
    const debuffPatterns = [
      'stun',
      'slow',
      'root',
      'silence',
      'blind',
      'taunt',
      'knockup',
      'airborne',
      'ground',
      'charm',
      'fear',
      'suppress',
      'poison',
      'burn',
      'bleed',
      'wound',
      '_mark',
      '_debuff',
    ];

    const lowerEffectId = effectId.toLowerCase();
    return debuffPatterns.some(pattern => lowerEffectId.includes(pattern));
  }
}
