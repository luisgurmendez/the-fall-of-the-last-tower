/**
 * Default handlers for stack-based passives:
 *
 * - stack_accumulation: stacks from ability casts (like Magnus's Arcane Surge)
 * - on_hit_damage: stacks from hits that proc bonus damage (like Vex's Assassin's Mark)
 * - on_take_damage_stack: stacks from damage taken that scale stat bonuses (like Gorath's Immovable)
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
 * Handler for stack accumulation passives (Magnus).
 */
export function handleStackAccumulation(
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  _context: ServerGameContext,
  _data?: PassiveTriggerData
): void {
  const maxStacks = definition.maxStacks ?? 4;
  const stacksToAdd = definition.stacksPerTrigger ?? 1;

  passiveState.stacks = Math.min(maxStacks, passiveState.stacks + stacksToAdd);
  passiveState.stackTimeRemaining = definition.stackDuration ?? 10;

  // Check if required stacks reached
  if (definition.requiredStacks && passiveState.stacks >= definition.requiredStacks) {
    passiveState.isActive = true;
  }

  Logger.champion.debug(
    `${champion.playerId} ${definition.name}: ${passiveState.stacks}/${maxStacks} stacks`
  );
}

/**
 * Handler for on-hit damage passives with stacks (Vex).
 */
export function handleOnHitDamage(
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  context: ServerGameContext,
  data?: PassiveTriggerData
): void {
  if (!data?.target) return;

  const maxStacks = definition.maxStacks ?? 3;
  const stacksToAdd = definition.stacksPerTrigger ?? 1;

  passiveState.stacks = Math.min(maxStacks, passiveState.stacks + stacksToAdd);
  passiveState.stackTimeRemaining = definition.stackDuration ?? 5;

  // Check if required stacks reached for proc
  const requiredStacks = definition.requiredStacks ?? maxStacks;
  if (passiveState.stacks >= requiredStacks) {
    // Apply bonus damage
    if (definition.damage) {
      const target = data.target;
      const targetMaxHealth = target.maxHealth;

      const bonusDamage = calculateAbilityValue(
        definition.damage.scaling,
        1,
        { maxHealth: targetMaxHealth }
      );

      target.takeDamage(bonusDamage, definition.damage.type, champion.id, context);

      Logger.champion.debug(
        `${champion.playerId} ${definition.name} proc: ${bonusDamage} ${definition.damage.type} damage`
      );
    }

    // Consume stacks if configured
    if (definition.consumeStacksOnActivation) {
      passiveState.stacks = 0;
    }

    passiveState.isActive = false;
  }
}

/**
 * Handler for on-take-damage stack passives (Gorath).
 */
export function handleTakeDamageStack(
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  _context: ServerGameContext,
  _data?: PassiveTriggerData
): void {
  // Check internal cooldown for stacking
  if (passiveState.cooldownRemaining > 0) return;

  const maxStacks = definition.maxStacks ?? 10;
  const stacksToAdd = definition.stacksPerTrigger ?? 1;

  const previousStacks = passiveState.stacks;
  passiveState.stacks = Math.min(maxStacks, passiveState.stacks + stacksToAdd);
  passiveState.stackTimeRemaining = definition.stackDuration ?? 4;

  // Apply/update stat modifier based on stacks
  if (definition.statModifiers) {
    // Remove old modifier
    champion.removeModifier(`passive_${definition.id}`);

    // Add new modifier with stack scaling
    for (const mod of definition.statModifiers) {
      champion.addModifier({
        source: `passive_${definition.id}`,
        flat: mod.flatValue ? { [mod.stat]: mod.flatValue * passiveState.stacks } as any : undefined,
        percent: mod.percentValue ? { [mod.stat]: 1 + mod.percentValue * passiveState.stacks } as any : undefined,
      });
    }
  }

  // Set mini cooldown between stack gains
  passiveState.cooldownRemaining = definition.internalCooldown ?? 0.5;
  passiveState.isActive = passiveState.stacks > 0;

  if (passiveState.stacks > previousStacks) {
    Logger.champion.debug(
      `${champion.playerId} ${definition.name}: ${passiveState.stacks}/${maxStacks} stacks`
    );
  }
}
