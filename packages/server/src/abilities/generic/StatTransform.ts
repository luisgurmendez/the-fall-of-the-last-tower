/**
 * Generic stat transform (like Vile's R): timed stat modifiers, an attack
 * range override, soul stacks, trap explosions and a transform aura.
 */

import type { AbilityDefinition } from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { getPlayerTraps } from "../../simulation/ServerTrap";
import { Logger } from "../../utils/Logger";

/**
 * Execute a stat transform ability (like Vile's R).
 */
export function executeStatTransform(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number
): void {
  const { champion, context } = params;

  if (!definition.statTransform) return;

  const transform = definition.statTransform;

  // Apply stat modifiers
  if (transform.statModifiers) {
    const duration = transform.duration;
    const mods = transform.statModifiers;

    // Apply flat stat bonuses
    if (mods.maxHealth && mods.maxHealth[rank - 1] > 0) {
      champion.addModifier({
        source: `transform_${definition.id}`,
        flat: { maxHealth: mods.maxHealth[rank - 1] },
        duration,
        timeRemaining: duration,
      });
      // Also heal for the bonus max health (refresh stats first so the heal isn't capped at the old maximum)
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

    // Apply percent bonuses
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

  // Apply attack range override
  if (transform.attackRange) {
    champion.setTransformAttackRange(transform.attackRange, transform.duration);
  }

  // Grant soul stacks (for Vile)
  if (transform.soulStacksOnCast) {
    champion.passiveState.stacks += transform.soulStacksOnCast;
    Logger.debug("Ability", `${champion.playerId} gained ${transform.soulStacksOnCast} soul stacks from transform`);
  }

  // Trigger trap explosions (for Vile's R)
  if (transform.triggersTrapExplosion) {
    const traps = getPlayerTraps(champion.id, context);
    for (const trap of traps) {
      trap.explode(context, rank);
    }
    if (traps.length > 0) {
      Logger.debug("Ability", `${champion.playerId} triggered ${traps.length} trap explosions`);
    }
  }

  // Start transform aura if defined
  if (definition.aura) {
    champion.startTransformAura(definition.id, definition.aura, rank, transform.duration);
  }

  Logger.champion.info(`${champion.playerId} transformed with ${definition.name}`);
}
