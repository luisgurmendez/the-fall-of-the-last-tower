/**
 * ElaraRHandler - Divine Intervention
 *
 * Heal all allies in range and cleanse their debuffs.
 *
 * SPECIAL MECHANICS:
 * - AoE heal centered on Elara (allied units: champions and minions)
 * - Cleanses what an effect is, not what it's called: the cleansable
 *   debuffs (effects.ts) an enemy put on them, crowd control, slows,
 *   poisons, armor shred, summoners' and items' debuffs. Airborne
 *   (knockups, knockbacks) and suppression stay, as do buffs and what her
 *   team put on itself
 */

import type { ActiveEffectState } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { getServerEffectById, isCCEffect } from '../../../data/effects';
import { Logger } from '../../../utils/Logger';

/** Crowd control a cleanse doesn't remove: airborne and suppression */
const UNCLEANSED_CC = new Set(['knockup', 'knockback', 'suppress']);

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
        this.healEntity(entity, healAmount, context, champion.id);
        alliesHealed++;
      }

      // Cleanse the debuffs enemies put on it
      if ('activeEffects' in entity) {
        debuffsCleansed += this.cleanseDebuffs(entity as ServerChampion, context);
      }
    }

    Logger.champion.info(
      `${champion.playerId} cast Divine Intervention - healed ${alliesHealed} allies for ${healAmount.toFixed(0)}, cleansed ${debuffsCleansed} debuffs`
    );

    return { success: true };
  }

  /**
   * Remove the debuffs a cleanse takes off a unit.
   * Returns the number of effects cleansed.
   */
  private cleanseDebuffs(unit: ServerChampion, context: ServerGameContext): number {
    if (!unit.activeEffects) return 0;

    const initialCount = unit.activeEffects.length;
    unit.activeEffects = unit.activeEffects.filter(effect => !isCleansed(effect, unit, context));

    // Champions reset CC status and stats right away, so a cleansed stun ends
    // this tick (minions pick it up on their next effects update)
    if (typeof (unit as Partial<ServerChampion>).refreshEffectState === 'function') {
      unit.refreshEffectState();
    }

    return initialCount - unit.activeEffects.length;
  }
}

/**
 * Whether Divine Intervention takes an effect off a unit: a cleansable
 * debuff, not airborne or suppression, that an enemy put on it (one with no
 * known source counts as an enemy's).
 */
function isCleansed(effect: ActiveEffectState, holder: ServerEntity, context: ServerGameContext): boolean {
  const def = getServerEffectById(effect.definitionId);
  if (!def || def.category !== 'debuff' || !def.cleansable) return false;
  if (isCCEffect(def) && UNCLEANSED_CC.has(def.ccType)) return false;
  if (effect.sourceId === holder.id) return false;
  const source = effect.sourceId ? context.getEntity(effect.sourceId) : undefined;
  return source?.side !== holder.side;
}
