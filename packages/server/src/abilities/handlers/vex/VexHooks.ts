/**
 * VexHooks - Stealth, Ninja Mode and empowered attack rules
 *
 * STEALTH:
 * - Casting an ability breaks stealth, except Shadow Shroud (W),
 *   which is what grants it
 *
 * NINJA MODE (R):
 * - While the vex_ninja_mode effect is active, Shadow Shuriken (Q) and
 *   Shadow Step (E) go on 50% shorter cooldowns
 *
 * EMPOWERED ATTACK (E):
 * - Shadow Step applies vex_empowered; the next melee attack deals Shadow
 *   Step's damage as bonus damage and consumes it
 */

import { calculateAbilityValue, getAbilityDefinition, type AbilitySlot } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { Logger } from '../../../utils/Logger';

/** Cooldown multiplier for Q and E cast during Ninja Mode */
const NINJA_MODE_COOLDOWN_MULTIPLIER = 0.5;

export const vexHooks: IChampionHooks = {
  championId: 'vex',

  breaksStealthOnCast(abilityId: string): boolean {
    return abilityId !== 'vex_shroud';
  },

  modifyAbilityCooldown(champion: ServerChampion, slot: AbilitySlot, cooldown: number): number {
    if ((slot === 'Q' || slot === 'E') && champion.hasEffect('vex_ninja_mode')) {
      return cooldown * NINJA_MODE_COOLDOWN_MULTIPLIER;
    }
    return cooldown;
  },

  onMeleeAttackHit(
    champion: ServerChampion,
    target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number },
    context: ServerGameContext
  ): void {
    const empoweredEffect = champion.activeEffects.find(e => e.definitionId === 'vex_empowered');
    if (!empoweredEffect) return;

    const dashAbility = getAbilityDefinition('vex_dash');
    if (dashAbility?.damage) {
      const abilityRank = champion.abilityStates.E.rank;
      if (abilityRank > 0) {
        const bonusDamage = calculateAbilityValue(
          dashAbility.damage.scaling,
          abilityRank,
          { attackDamage: attack.attackDamage, abilityPower: attack.abilityPower }
        );
        target.takeDamage(bonusDamage, dashAbility.damage.type, champion.id, context);
        Logger.champion.debug(
          `${champion.playerId} empowered attack dealt ${bonusDamage} bonus damage`
        );
      }
    }

    // Remove the empowered effect (consumed on attack)
    champion.activeEffects = champion.activeEffects.filter(e => e.definitionId !== 'vex_empowered');
  },
};
