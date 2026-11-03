/**
 * VileRHandler - Restoration of Vilix
 *
 * Transform into a powerful melee form for 10 seconds.
 *
 * TRANSFORMATION:
 * - Gain massive stats (health, AD, AS, MS)
 * - Attack range becomes melee (45)
 * - Grants 60 soul stacks
 * - All existing traps explode, for this ability's rank
 * - Damage aura while transformed (scaled with AP, on units only)
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { getPlayerTraps } from '../../../simulation/ServerTrap';
import { Logger } from '../../../utils/Logger';

export class VileRHandler extends BaseAbilityHandler {
  readonly abilityId = 'vile_restoration_of_vilix';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank } = params;

    if (!definition.statTransform) {
      return { success: false };
    }

    const transform = definition.statTransform;
    const duration = transform.duration;

    // Apply stat modifiers
    if (transform.statModifiers) {
      const mods = transform.statModifiers;

      // Flat stat bonuses
      if (mods.maxHealth && mods.maxHealth[rank - 1] > 0) {
        champion.addModifier({
          source: `transform_${definition.id}`,
          flat: { maxHealth: mods.maxHealth[rank - 1] },
          duration,
          timeRemaining: duration,
        });
        // Heal for the bonus max health (refresh stats first so the heal isn't capped at the old maximum)
        champion.getStats();
        champion.heal(mods.maxHealth[rank - 1]);
      }

      if (mods.attackDamage && mods.attackDamage[rank - 1] > 0) {
        champion.addModifier({
          source: `transform_${definition.id}`,
          flat: { attackDamage: mods.attackDamage[rank - 1] },
          duration,
          timeRemaining: duration,
        });
      }

      // Percent bonuses
      if (mods.attackSpeed && mods.attackSpeed[rank - 1] > 0) {
        champion.addModifier({
          source: `transform_${definition.id}`,
          percent: { attackSpeed: 1 + mods.attackSpeed[rank - 1] },
          duration,
          timeRemaining: duration,
        });
      }

      if (mods.movementSpeed && mods.movementSpeed[rank - 1] > 0) {
        champion.addModifier({
          source: `transform_${definition.id}`,
          percent: { movementSpeed: 1 + mods.movementSpeed[rank - 1] },
          duration,
          timeRemaining: duration,
        });
      }

      if (mods.armor && mods.armor[rank - 1] > 0) {
        champion.addModifier({
          source: `transform_${definition.id}`,
          flat: { armor: mods.armor[rank - 1] },
          duration,
          timeRemaining: duration,
        });
      }

      if (mods.magicResist && mods.magicResist[rank - 1] > 0) {
        champion.addModifier({
          source: `transform_${definition.id}`,
          flat: { magicResist: mods.magicResist[rank - 1] },
          duration,
          timeRemaining: duration,
        });
      }
    }

    // Apply attack range override (melee)
    if (transform.attackRange) {
      champion.setTransformAttackRange(transform.attackRange, duration);
    }

    // Marker effect so clients draw him transformed (and show it in the HUD)
    champion.applyEffect('vile_transformed', duration, champion.id);

    // Grant soul stacks
    if (transform.soulStacksOnCast) {
      champion.passiveState.stacks += transform.soulStacksOnCast;
      Logger.champion.debug(
        `${champion.playerId} gained ${transform.soulStacksOnCast} soul stacks from transform`
      );
    }

    // Trigger trap explosions
    if (transform.triggersTrapExplosion) {
      const traps = getPlayerTraps(champion.id, context);
      for (const trap of traps) {
        trap.explode(context, rank);
      }
      if (traps.length > 0) {
        Logger.champion.debug(
          `${champion.playerId} triggered ${traps.length} trap explosions`
        );
      }
    }

    // Start transform aura
    if (definition.aura) {
      champion.startTransformAura(definition.id, definition.aura, rank, duration);
    }

    Logger.champion.info(
      `${champion.playerId} transformed with ${definition.name} for ${duration}s`
    );

    return { success: true };
  }
}
