/**
 * ServerAbilityExecutor - Casts champion abilities on the server.
 *
 * This class owns the cast flow:
 * - Validating cast conditions (rank, crowd control, cooldown, mana, target)
 * - Cast time (getCastTime): the champion stands still for it
 *   (ServerChampion.startCast, ABILITY_WINDUP), then the ability goes off;
 *   stun or silence in it cancels the cast with nothing spent
 * - Recasts: handler-owned, or the generic recast dash
 * - Running the ability's handler, or else the generic path for its target
 *   type (abilities/generic/), then its dash or teleport
 * - Mana cost, cooldown, an ammo charge (abilities with ammo: none left,
 *   no cast), combat state, the ABILITY_CAST event and the on_ability_cast
 *   passive trigger
 */

import {
  Vector,
  AbilitySlot,
  AbilityDefinition,
  getAbilityDefinition,
  canAbilityAffectEntityType,
  hasRecastBehavior,
  getCastTime,
  GameEventType,
  calculateEffectiveCooldown,
  GameConfig,
} from "@siege/shared";
import { passiveTriggerSystem } from "../systems/PassiveTriggerSystem";
import { abilityHandlerRegistry } from "../abilities/AbilityHandlerRegistry";
import { championHooksRegistry } from "../abilities/ChampionHooksRegistry";
import type { AbilityHandlerParams, AbilityExecutionResult } from "../abilities/IAbilityHandler";
import type { ServerChampion } from "./ServerChampion";
import type { ServerGameContext } from "../game/ServerGameContext";
import { Logger } from "../utils/Logger";
import { dashToDestination, teleportToDestination, executeRecastDash, leapToTarget } from "../abilities/generic/Movement";
import { executeSelfAbility } from "../abilities/generic/SelfAbility";
import { executeNoTargetAbility } from "../abilities/generic/NoTargetArea";
import { executeTargetEnemyAbility, executeTargetAllyAbility } from "../abilities/generic/TargetedAbility";
import { executeSkillshot } from "../abilities/generic/Skillshot";
import { executeGroundTarget } from "../abilities/generic/GroundTarget";

export interface AbilityCastParams {
  /** The champion casting the ability */
  champion: ServerChampion;
  /** The ability slot being cast */
  slot: AbilitySlot;
  /** Target position (for ground target/skillshot) */
  targetPosition?: Vector;
  /** Target entity ID (for targeted abilities) */
  targetEntityId?: string;
  /** Game context */
  context: ServerGameContext;
  /** Charge time in seconds (for charge abilities) */
  chargeTime?: number;
}

export interface AbilityCastResult {
  success: boolean;
  failReason?:
    | "not_learned"
    | "on_cooldown"
    | "not_enough_mana"
    | "invalid_target"
    | "out_of_range"
    | "silenced"
    | "stunned"
    | "rooted"
    | "taunted"
    | "feared"
    | "casting"
    | "no_ammo";
  manaCost?: number;
  cooldown?: number;
}

/**
 * Server-side ability executor.
 * Handles all ability execution logic.
 */
export class ServerAbilityExecutor {
  /**
   * Attempt to cast an ability.
   * Returns result indicating success or failure with reason.
   */
  castAbility(params: AbilityCastParams): AbilityCastResult {
    const { champion, slot, context } = params;

    // Get ability definition
    const abilityId = this.getAbilityId(champion, slot);
    const definition = getAbilityDefinition(abilityId);

    if (!definition) {
      Logger.debug("Ability", `No definition found for ability: ${abilityId}`);
      return { success: false, failReason: "not_learned" };
    }

    // Check if ability is learned
    const state = champion.abilityStates[slot];
    if (state.rank <= 0) {
      return { success: false, failReason: "not_learned" };
    }

    // Check CC status
    if (!champion.ccStatus.canCast) {
      if (champion.ccStatus.isStunned) {
        return { success: false, failReason: "stunned" };
      }
      if (champion.ccStatus.isSilenced) {
        return { success: false, failReason: "silenced" };
      }
      if (champion.ccStatus.isFeared) {
        return { success: false, failReason: "feared" };
      }
      // Taunted: it can only attack its taunter
      return { success: false, failReason: "taunted" };
    }

    // Nothing else is cast during a cast time
    if (champion.isCasting()) {
      return { success: false, failReason: "casting" };
    }

    // Rooted or grounded champions can't dash or teleport
    const recasting = hasRecastBehavior(definition) && champion.hasRecastAvailable(slot);
    const moves = recasting ? definition.recastMovesCaster : definition.dash || definition.teleport || definition.movesCaster;
    if (moves && !champion.ccStatus.canUseMobilityAbilities) {
      return { success: false, failReason: "rooted" };
    }

    // Check for recast - if available, handle recast flow instead of normal cast
    if (recasting) {
      // Abilities whose handler implements recast own the whole recast flow
      const handler = abilityHandlerRegistry.get(definition.id);
      if (handler?.canRecast && handler?.executeRecast) {
        const handlerParams: AbilityHandlerParams = {
          champion,
          slot,
          targetPosition: params.targetPosition,
          targetEntityId: params.targetEntityId,
          context,
          definition,
          rank: champion.abilityStates[slot].rank,
          damageMultiplier: 1.0,
          chargeTime: params.chargeTime,
        };

        if (handler.canRecast(handlerParams)) {
          // Break stealth when recasting
          if ('breakStealth' in champion) {
            (champion as any).breakStealth();
          }

          const result = handler.executeRecast(handlerParams);
          if (result.success) {
            champion.enterCombat();
            context.addEvent(GameEventType.ABILITY_CAST, {
              entityId: champion.id,
              abilityId: `${definition.id}_recast`,
              slot,
              targetX: params.targetPosition?.x,
              targetY: params.targetPosition?.y,
            });
            return { success: true, manaCost: 0, cooldown: 0 };
          }

          // Handler accepted the recast but couldn't carry it out
          return { success: false, failReason: "invalid_target" };
        }

        // The recast no longer applies (e.g., Lume's orb is already back):
        // forget the leftover window and treat the key press as a normal cast
        while (champion.hasRecastAvailable(slot)) {
          champion.consumeRecast(slot);
        }
      } else {
        return this.handleRecast(params, definition);
      }
    }

    // Check cooldown
    if (state.cooldownRemaining > 0) {
      return { success: false, failReason: "on_cooldown" };
    }

    // An ability with charges (ammo) needs one left
    if (!champion.hasAbilityCharge(slot)) {
      return { success: false, failReason: "no_ammo" };
    }

    // Calculate mana cost
    const rank = state.rank;
    const manaCost = definition.manaCost?.[rank - 1] ?? 0;

    // Check mana
    if (champion.resource < manaCost) {
      return { success: false, failReason: "not_enough_mana" };
    }

    // A ground target past the ability's range is cast at its range, toward
    // it (the client sends the cursor; a cone or line only needs the aim)
    if (definition.targetType === "ground_target" && definition.range && params.targetPosition) {
      const offset = params.targetPosition.subtracted(champion.position);
      const distance = offset.length();
      if (distance > definition.range) {
        params = { ...params, targetPosition: champion.position.added(offset.scaled(definition.range / distance)) };
      }
    }

    // An ally-targeted ability with no ally under the cursor that it affects
    // (none, a minion for a champions-only one, a tower) goes on the caster;
    // an enemy under the cursor is refused
    if (definition.targetType === "target_ally" && !definition.excludesSelf) {
      const target = params.targetEntityId ? context.getEntity(params.targetEntityId) : undefined;
      const isEnemy = target !== undefined && target.side !== champion.side;
      const affected = target !== undefined && !target.isDead && canAbilityAffectEntityType(definition, target.entityType);
      if (!isEnemy && !affected) params = { ...params, targetEntityId: champion.id };
    }

    // Validate target based on ability type
    const targetValidation = this.validateTarget(params, definition);
    if (!targetValidation.valid) {
      return { success: false, failReason: targetValidation.reason };
    }

    // Champion-specific cast rules (see IChampionHooks)
    const hooks = championHooksRegistry.get(champion.definition.id);

    // Break stealth when casting abilities (unless hooks exempt it, e.g. a stealth ability)
    if (hooks?.breaksStealthOnCast?.(abilityId) !== false && 'breakStealth' in champion) {
      (champion as any).breakStealth();
    }

    // A cast time: stand still facing the aim, then it goes off (nothing is
    // spent until then, and stun or silence in it cancels it)
    const castTime = getCastTime(definition);
    if (castTime > 0) {
      const target = params.targetEntityId ? context.getEntity(params.targetEntityId) : undefined;
      champion.startCast(slot, abilityId, castTime, params.targetPosition ?? target?.position ?? null, () => {
        if (champion.resource < manaCost) return;
        this.completeCast(params, definition, abilityId, manaCost);
      });
      context.addEvent(GameEventType.ABILITY_WINDUP, {
        entityId: champion.id,
        abilityId,
        slot,
        castTime,
        targetX: params.targetPosition?.x,
        targetY: params.targetPosition?.y,
        targetEntityId: params.targetEntityId,
      });
      // The cooldown it will start (before any change its handler makes)
      const baseCooldown = definition.cooldown?.[rank - 1] ?? 0;
      return {
        success: true,
        manaCost,
        cooldown: calculateEffectiveCooldown(baseCooldown, champion.getStats().abilityHaste, GameConfig.ABILITIES.MAX_CDR),
      };
    }

    return this.completeCast(params, definition, abilityId, manaCost);
  }

  /**
   * The ability goes off (at once, or at the end of its cast time): run it,
   * then spend its mana, start its cooldown and announce it (ABILITY_CAST,
   * on_ability_cast). A handler that refuses or fails it spends nothing.
   */
  private completeCast(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    abilityId: string,
    manaCost: number,
  ): AbilityCastResult {
    const { champion, slot, context } = params;
    const state = champion.abilityStates[slot];
    const hooks = championHooksRegistry.get(champion.definition.id);

    // Check for damage amplification (e.g., Magnus's Arcane Surge)
    const damageMultiplier = hooks?.getAbilityDamageMultiplier?.(champion) ?? 1.0;

    // All checks passed - execute the ability
    const executionResult = this.executeAbility(params, definition, damageMultiplier);

    // A handler that refused or failed the cast: nothing is spent
    if (executionResult && !executionResult.success) {
      return { success: false, failReason: "invalid_target" };
    }

    // Consume whatever granted the damage amp (e.g., Arcane Surge stacks)
    if (damageMultiplier > 1.0) {
      hooks?.consumeAbilityDamageMultiplier?.(champion);
    }

    // Deduct mana, and a charge if it has ammo
    if (!executionResult?.skipManaCost) {
      champion.resource -= manaCost;
    }
    champion.spendAbilityCharge(slot);

    // Start cooldown with Ability Haste reduction
    const baseCooldown = definition.cooldown?.[state.rank - 1] ?? 0;
    const stats = champion.getStats();

    // Apply global ability haste (from items, runes, etc.)
    let effectiveCooldown = calculateEffectiveCooldown(
      baseCooldown,
      stats.abilityHaste,
      GameConfig.ABILITIES.MAX_CDR
    );

    // Apply champion-specific cooldown changes (e.g., Vex's Ninja Mode halves Q and E)
    if (hooks?.modifyAbilityCooldown) {
      effectiveCooldown = hooks.modifyAbilityCooldown(champion, slot, effectiveCooldown);
    }

    // Handlers can replace the cooldown (e.g., Vex's dash resets) or skip it
    if (executionResult?.cooldownOverride !== undefined) {
      effectiveCooldown = executionResult.cooldownOverride;
    }
    if (!executionResult?.skipCooldown) {
      state.cooldownRemaining = effectiveCooldown;
      state.cooldownTotal = effectiveCooldown;
    }

    // Enter combat
    champion.enterCombat();

    // Add event for ability cast (include animation duration if handler provided one)
    // Use vfxPosition if provided by handler, otherwise use target position
    const vfxX = executionResult?.vfxPosition?.x ?? params.targetPosition?.x;
    const vfxY = executionResult?.vfxPosition?.y ?? params.targetPosition?.y;
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId,
      slot,
      targetX: vfxX,
      targetY: vfxY,
      targetEntityId: params.targetEntityId,
      animationDuration: executionResult?.animationDuration,
      // An effect that starts somewhere else than the caster (Lume's Eclipse, from the orb)
      originX: executionResult?.vfxOrigin?.x,
      originY: executionResult?.vfxOrigin?.y,
    });

    // Dispatch on_ability_cast trigger for passive abilities
    passiveTriggerSystem.dispatchTrigger('on_ability_cast', champion, context, {
      abilityId,
    });
    hooks?.onAbilityCast?.(champion, abilityId, context);
    champion.itemPassives.onAbilityCast(context);

    return {
      success: true,
      manaCost,
      cooldown: effectiveCooldown,
    };
  }

  /**
   * Handle recast of an ability (e.g., Vile's Q dash to hit location).
   * Recast does not consume mana or start cooldown.
   */
  private handleRecast(params: AbilityCastParams, definition: AbilityDefinition): AbilityCastResult {
    const { champion, slot, context } = params;
    const abilityId = definition.id;

    // Get the stored hit position
    const hitPosition = champion.getRecastHitPosition(slot);
    if (!hitPosition) {
      Logger.debug("Ability", `${champion.playerId} ${slot} recast failed - no hit position stored`);
      return { success: false, failReason: "invalid_target" };
    }

    // Break stealth when recasting
    if ('breakStealth' in champion) {
      (champion as any).breakStealth();
    }

    // Execute recast as a dash to the hit position
    executeRecastDash(champion, hitPosition, abilityId);

    // Consume the recast
    champion.consumeRecast(slot);

    // Enter combat
    champion.enterCombat();

    // Add event for recast
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: `${abilityId}_recast`,
      slot,
      targetX: hitPosition.x,
      targetY: hitPosition.y,
    });

    Logger.champion.debug(`${champion.playerId} ${slot} recast - dashing to (${hitPosition.x.toFixed(0)}, ${hitPosition.y.toFixed(0)})`);

    return {
      success: true,
      manaCost: 0,
      cooldown: 0,
    };
  }

  /**
   * Get the ability ID for a champion's slot.
   */
  private getAbilityId(champion: ServerChampion, slot: AbilitySlot): string {
    return champion.abilityInSlot(slot);
  }

  /**
   * Validate ability target.
   */
  private validateTarget(
    params: AbilityCastParams,
    definition: AbilityDefinition
  ): { valid: boolean; reason?: "invalid_target" | "out_of_range" } {
    const { champion, targetPosition, targetEntityId, context } = params;

    switch (definition.targetType) {
      case "self":
      case "no_target":
        // No target validation needed
        return { valid: true };

      case "target_enemy": {
        if (!targetEntityId) {
          return { valid: false, reason: "invalid_target" };
        }
        const target = context.getEntity(targetEntityId);
        if (!target || target.isDead || target.side === champion.side) {
          return { valid: false, reason: "invalid_target" };
        }
        // Check if ability can target this entity type
        if (!canAbilityAffectEntityType(definition, target.entityType)) {
          return { valid: false, reason: "invalid_target" };
        }
        // Check range
        if (definition.range) {
          if (!champion.isInRange(target, definition.range)) {
            return { valid: false, reason: "out_of_range" };
          }
        }
        return { valid: true };
      }

      case "target_ally": {
        if (!targetEntityId) {
          return { valid: false, reason: "invalid_target" };
        }
        const target = context.getEntity(targetEntityId);
        if (!target || target.isDead || target.side !== champion.side) {
          return { valid: false, reason: "invalid_target" };
        }
        if (definition.excludesSelf && target.id === champion.id) {
          return { valid: false, reason: "invalid_target" };
        }
        if (!canAbilityAffectEntityType(definition, target.entityType)) {
          return { valid: false, reason: "invalid_target" };
        }
        // Check range
        if (definition.range) {
          if (!champion.isInRange(target, definition.range)) {
            return { valid: false, reason: "out_of_range" };
          }
        }
        return { valid: true };
      }

      case "target_unit": {
        if (!targetEntityId) {
          return { valid: false, reason: "invalid_target" };
        }
        const target = context.getEntity(targetEntityId);
        if (!target || target.isDead) {
          return { valid: false, reason: "invalid_target" };
        }
        // Check if ability can target this entity type
        if (!canAbilityAffectEntityType(definition, target.entityType)) {
          return { valid: false, reason: "invalid_target" };
        }
        // Check range
        if (definition.range) {
          if (!champion.isInRange(target, definition.range)) {
            return { valid: false, reason: "out_of_range" };
          }
        }
        return { valid: true };
      }

      case "skillshot":
      case "ground_target": {
        // (A ground target past the range was already brought to it: no range check)
        if (!targetPosition) {
          return { valid: false, reason: "invalid_target" };
        }
        return { valid: true };
      }

      default:
        return { valid: true };
    }
  }

  /**
   * Execute the ability effect.
   * @param damageMultiplier - Multiplier from champion hooks (e.g., 1.3 for Arcane Surge)
   * @returns The execution result from the handler, if any
   */
  private executeAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    damageMultiplier: number = 1.0
  ): AbilityExecutionResult | undefined {
    const { champion, slot, context } = params;
    const rank = champion.abilityStates[slot].rank;

    // Update facing direction if targeting a position
    if (params.targetPosition) {
      const dir = params.targetPosition.subtracted(champion.position);
      if (dir.length() > 0.1) {
        champion.direction = dir.normalized();
      }
    }

    // Check for custom handler in registry
    const handler = abilityHandlerRegistry.get(definition.id);
    if (handler) {
      const handlerParams: AbilityHandlerParams = {
        champion,
        slot,
        targetPosition: params.targetPosition,
        targetEntityId: params.targetEntityId,
        context,
        definition,
        rank,
        damageMultiplier,
        chargeTime: params.chargeTime,
      };

      // Validate if handler has validation
      if (handler.validate) {
        const validation = handler.validate(handlerParams);
        if (!validation.valid) {
          Logger.debug("Ability", `${definition.id} handler validation failed: ${validation.reason}`);
          return { success: false };
        }
      }

      // Execute via handler
      const result = handler.execute(handlerParams);
      if (!result.success) {
        Logger.debug("Ability", `${definition.id} handler execution failed`);
        return result;
      }

      // Cooldown overrides and skips are applied by castAbility, after the standard cooldown

      // Handle dash if defined and handler didn't set up forced movement
      if (definition.dash && !champion.forcedMovement) {
        dashToDestination(params, definition, rank, damageMultiplier);
      }

      // Handle teleport if defined
      if (definition.teleport) {
        teleportToDestination(params, definition);
      }

      return result;
    }

    // No handler: run the generic path for the target type (abilities/generic/)
    switch (definition.targetType) {
      case "self":
        executeSelfAbility(params, definition, rank);
        break;

      case "no_target":
        executeNoTargetAbility(params, definition, rank, damageMultiplier);
        break;

      case "target_enemy":
        // A dash at an enemy is a leap: everything lands when it reaches it
        if (definition.dash) leapToTarget(params, definition, rank, damageMultiplier);
        else executeTargetEnemyAbility(params, definition, rank, damageMultiplier);
        break;

      case "target_ally":
        executeTargetAllyAbility(params, definition, rank);
        break;

      case "skillshot":
        executeSkillshot(params, definition, rank, damageMultiplier);
        break;

      case "ground_target":
        executeGroundTarget(params, definition, rank, damageMultiplier);
        break;
    }

    // Handle dash and teleport/blink. Targeted abilities (no target position)
    // go to the target entity's position (a leap at an enemy is already off)
    if (definition.dash && definition.targetType !== "target_enemy") {
      dashToDestination(params, definition, rank, damageMultiplier);
    }
    if (definition.teleport) {
      teleportToDestination(params, definition);
    }
  }
}

// Export singleton instance
export const abilityExecutor = new ServerAbilityExecutor();
