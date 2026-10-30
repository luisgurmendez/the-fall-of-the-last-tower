/**
 * ServerAbilityExecutor - Executes champion abilities on the server.
 *
 * This class is responsible for:
 * - Validating ability cast conditions (mana, cooldowns, range)
 * - Executing ability effects (damage, healing, shields)
 * - Spawning projectiles for skillshots
 * - Creating AoE damage zones
 * - Applying effects (CC, buffs, debuffs)
 */

import {
  Vector,
  AbilitySlot,
  AbilityDefinition,
  calculateAbilityValue,
  getAbilityDefinition,
  canAbilityAffectEntityType,
  hasRecastBehavior,
  hasChargeBehavior,
  DamageType,
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
import { ServerProjectile } from "./ServerProjectile";
import { ServerZone, ZoneEffectType } from "./ServerZone";
import { ServerTrap, getPlayerTraps } from "./ServerTrap";
import { Logger } from "../utils/Logger";
import { getServerEffectById } from "../data/effects";
import { getScalingStats, applyEffectsToEntity } from "../abilities/generic/AbilityHelpers";
import { dashToDestination, teleportToDestination, executeRecastDash } from "../abilities/generic/Movement";

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
    | "stunned";
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
    }

    // Check for recast - if available, handle recast flow instead of normal cast
    if (hasRecastBehavior(definition) && champion.hasRecastAvailable(slot)) {
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

    // Calculate mana cost
    const rank = state.rank;
    const manaCost = definition.manaCost?.[rank - 1] ?? 0;

    // Check mana
    if (champion.resource < manaCost) {
      return { success: false, failReason: "not_enough_mana" };
    }

    // Validate target based on ability type
    const targetValidation = this.validateTarget(params, definition);
    if (!targetValidation.valid) {
      return { success: false, failReason: targetValidation.reason };
    }

    // Champion-specific cast rules (see IChampionHooks)
    const hooks = championHooksRegistry.get(champion.definition.id);

    // Check for damage amplification (e.g., Magnus's Arcane Surge)
    const damageMultiplier = hooks?.getAbilityDamageMultiplier?.(champion) ?? 1.0;

    // Break stealth when casting abilities (unless hooks exempt it, e.g. a stealth ability)
    if (hooks?.breaksStealthOnCast?.(abilityId) !== false && 'breakStealth' in champion) {
      (champion as any).breakStealth();
    }

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

    // Deduct mana
    if (!executionResult?.skipManaCost) {
      champion.resource -= manaCost;
    }

    // Start cooldown with Ability Haste reduction
    const baseCooldown = definition.cooldown?.[rank - 1] ?? 0;
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
    });

    // Dispatch on_ability_cast trigger for passive abilities
    passiveTriggerSystem.dispatchTrigger('on_ability_cast', champion, context, {
      abilityId,
    });

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
    executeRecastDash(champion, hitPosition);

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
    return champion.definition.abilities[slot];
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
        if (!targetPosition) {
          return { valid: false, reason: "invalid_target" };
        }
        // Check range for ground target
        if (definition.range && definition.targetType === "ground_target") {
          const distance = champion.position.distanceTo(targetPosition);
          if (distance > definition.range) {
            return { valid: false, reason: "out_of_range" };
          }
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

    // Execute based on target type
    switch (definition.targetType) {
      case "self":
        this.executeSelfAbility(params, definition, rank);
        break;

      case "no_target":
        this.executeNoTargetAbility(params, definition, rank, damageMultiplier);
        break;

      case "target_enemy":
        this.executeTargetEnemyAbility(params, definition, rank, damageMultiplier);
        break;

      case "target_ally":
        this.executeTargetAllyAbility(params, definition, rank);
        break;

      case "skillshot":
        this.executeSkillshot(params, definition, rank, damageMultiplier);
        break;

      case "ground_target":
        this.executeGroundTarget(params, definition, rank, damageMultiplier);
        break;
    }

    // Handle dash and teleport/blink. Targeted abilities (no target position)
    // go to the target entity's position
    if (definition.dash) {
      dashToDestination(params, definition, rank, damageMultiplier);
    }
    if (definition.teleport) {
      teleportToDestination(params, definition);
    }
  }

  /**
   * Execute a self-targeted ability.
   */
  private executeSelfAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number
  ): void {
    const { champion, context } = params;
    const stats = champion.getStats();

    // Handle stat transform (like Vile's R)
    if (definition.statTransform) {
      this.executeStatTransform(params, definition, rank);
      return;
    }

    // Apply shield
    if (definition.shield) {
      const shieldAmount = calculateAbilityValue(definition.shield.scaling, rank, getScalingStats(champion, stats));

      champion.shields.push({
        amount: shieldAmount,
        remainingDuration: definition.shield.duration,
        sourceId: definition.id,
        shieldType: 'normal',
      });
    }

    // Apply effects
    if (definition.appliesEffects) {
      for (const effectId of definition.appliesEffects) {
        champion.applyEffect(
          effectId,
          definition.effectDuration ?? 0,
          champion.id
        );
      }
    }
  }

  /**
   * Execute a stat transform ability (like Vile's R).
   */
  private executeStatTransform(
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
        // Also heal for the bonus max health
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
        trap.explode(context);
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

  /**
   * Execute a no-target ability (AoE around self).
   */
  private executeNoTargetAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, context } = params;
    const stats = champion.getStats();

    const radius = definition.aoeRadius ?? 300;

    // Calculate damage if applicable (with passive multiplier)
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
    }

    // Calculate heal if applicable
    let healAmount = 0;
    if (definition.heal) {
      healAmount = calculateAbilityValue(definition.heal.scaling, rank, getScalingStats(champion, stats));
    }

    // Buffs go to the caster and allies, debuffs (slows, taunts, knockups) to enemies
    const { buffs, debuffs } = this.splitEffects(definition.appliesEffects ?? []);
    const effectDuration = definition.effectDuration ?? 0;

    if (buffs.length > 0) {
      applyEffectsToEntity(champion, buffs, effectDuration, champion.id);
    }

    // The area is where the caster stood when casting; with aoeDelay it lands later
    const center = champion.position.clone();
    const applyArea = () => this.applyNoTargetArea(params, definition, center, radius, damageAmount, healAmount, buffs, debuffs);
    if (definition.aoeDelay && definition.aoeDelay > 0) {
      context.schedule(definition.aoeDelay, applyArea);
    } else {
      applyArea();
    }
  }

  /**
   * Split effect IDs into buffs and the rest (debuffs and crowd control).
   */
  private splitEffects(effectIds: string[]): { buffs: string[]; debuffs: string[] } {
    const buffs: string[] = [];
    const debuffs: string[] = [];
    for (const effectId of effectIds) {
      if (getServerEffectById(effectId)?.category === 'buff') buffs.push(effectId);
      else debuffs.push(effectId);
    }
    return { buffs, debuffs };
  }

  /**
   * Damage, debuff, heal and buff everything around a point for a no_target ability.
   */
  private applyNoTargetArea(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    center: Vector,
    radius: number,
    damageAmount: number,
    healAmount: number,
    buffs: string[],
    debuffs: string[]
  ): void {
    const { champion, context } = params;
    const effectDuration = definition.effectDuration ?? 0;
    const entities = context.getEntitiesInRadius(center, radius);

    for (const entity of entities) {
      if (entity.id === champion.id) continue;

      const isEnemy = entity.side !== champion.side;
      const isAlly = entity.side === champion.side;

      // Check if ability can affect this entity type
      if (isEnemy && !canAbilityAffectEntityType(definition, entity.entityType)) {
        continue;
      }

      // Apply damage to enemies
      if (isEnemy && damageAmount > 0 && definition.damage) {
        entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
      }

      // Apply debuffs to enemies (stun, slow, taunt), whether or not the ability does damage
      if (isEnemy && debuffs.length > 0) {
        applyEffectsToEntity(entity, debuffs, effectDuration, champion.id);
      }

      // Apply healing to allies
      if (isAlly && healAmount > 0) {
        if ("heal" in entity && typeof entity.heal === "function") {
          (entity as { heal: (amount: number) => void }).heal(healAmount);
        }
      }

      // Apply buffs to allies (like the speed buff from Elara's E)
      if (isAlly && buffs.length > 0) {
        applyEffectsToEntity(entity, buffs, effectDuration, champion.id);
      }
    }
  }

  /**
   * Execute a targeted enemy ability.
   */
  private executeTargetEnemyAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetEntityId, context } = params;

    if (!targetEntityId) return;

    const target = context.getEntity(targetEntityId);
    if (!target || target.isDead) return;

    const stats = champion.getStats();

    // Calculate and apply damage (with passive multiplier)
    if (definition.damage) {
      const damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;

      target.takeDamage(damageAmount, definition.damage.type, champion.id, context);
    }

    // Apply effects
    if (definition.appliesEffects) {
      applyEffectsToEntity(
        target,
        definition.appliesEffects,
        definition.effectDuration ?? 0,
        champion.id
      );
    }
  }

  /**
   * Execute a targeted ally ability.
   */
  private executeTargetAllyAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number
  ): void {
    const { champion, targetEntityId, context } = params;

    if (!targetEntityId) return;

    const target = context.getEntity(targetEntityId);
    if (!target || target.isDead) return;

    const stats = champion.getStats();

    // Apply healing
    if (
      definition.heal &&
      "heal" in target &&
      typeof target.heal === "function"
    ) {
      const healAmount = calculateAbilityValue(definition.heal.scaling, rank, getScalingStats(champion, stats));

      (target as { heal: (amount: number) => void }).heal(healAmount);
    }

    // Apply shield
    if (definition.shield && "shields" in target) {
      const shieldAmount = calculateAbilityValue(definition.shield.scaling, rank, getScalingStats(champion, stats));

      (target as ServerChampion).shields.push({
        amount: shieldAmount,
        remainingDuration: definition.shield.duration,
        sourceId: definition.id,
        shieldType: 'normal',
      });
    }

    // Apply effects
    if (definition.appliesEffects) {
      applyEffectsToEntity(
        target,
        definition.appliesEffects,
        definition.effectDuration ?? 0,
        champion.id
      );
    }
  }

  /**
   * Execute a skillshot ability.
   */
  private executeSkillshot(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition) return;

    // If this ability has a dash, skip projectile - the dash handles damage
    // The dash is executed separately in executeAbilityByType()
    if (definition.dash) {
      return;
    }

    const stats = champion.getStats();

    // Calculate direction
    const direction = targetPosition.subtracted(champion.position);
    if (direction.length() < 0.1) {
      // If target is too close, use champion's facing direction
      direction.x = champion.direction.x;
      direction.y = champion.direction.y;
    }

    // Calculate damage (with passive multiplier)
    let damageAmount = 0;
    let damageType: DamageType = "physical";
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
      damageType = definition.damage.type;
    }

    // Check if ability has animation with projectile keyframe
    const abilityAnimation = champion.definition.animations?.abilities?.[definition.id];
    let projectileDelay = 0;

    if (abilityAnimation) {
      // Find the projectile keyframe
      const projectileKeyframe = abilityAnimation.keyframes.find(
        k => k.trigger.type === 'projectile'
      );
      if (projectileKeyframe) {
        // Calculate delay based on animation timing
        projectileDelay = projectileKeyframe.frame * abilityAnimation.baseFrameDuration;
      }
    }

    // Calculate effective range (with charge bonus if applicable)
    let effectiveRange = definition.range ?? 800;

    if (hasChargeBehavior(definition) && params.chargeTime !== undefined) {
      const charge = definition.charge!;
      const minCharge = charge.minChargeTime;
      const maxCharge = charge.maxChargeTime;

      // Calculate charge progress (0 to 1)
      const chargeProgress = Math.max(0, Math.min(1,
        (params.chargeTime - minCharge) / (maxCharge - minCharge)
      ));

      // Apply range bonus based on charge progress
      if (charge.maxChargeRangeBonus) {
        effectiveRange += charge.maxChargeRangeBonus * chargeProgress;
        Logger.champion.debug(
          `${champion.playerId} charged ${definition.id} for ${params.chargeTime.toFixed(2)}s ` +
          `(${(chargeProgress * 100).toFixed(0)}%), range: ${effectiveRange.toFixed(0)}`
        );
      }
    }

    // Prepare projectile config
    const projectileConfig = {
      direction: direction.normalized(),
      speed: definition.projectileSpeed ?? 1000,
      radius: definition.projectileRadius ?? 30,
      maxDistance: effectiveRange,
      damage: damageAmount,
      damageType,
      piercing: definition.piercing ?? false,
      appliesEffects: definition.appliesEffects,
      effectDuration: definition.effectDuration,
    };

    if (projectileDelay > 0) {
      // Schedule projectile spawn at keyframe time
      champion.scheduleAbilityProjectile(definition.id, projectileDelay, projectileConfig);
    } else {
      // No animation delay - spawn immediately (fallback for abilities without animations)
      const projectile = new ServerProjectile({
        id: context.generateEntityId(),
        position: champion.position.clone(),
        side: champion.side,
        direction: projectileConfig.direction,
        speed: projectileConfig.speed,
        radius: projectileConfig.radius,
        maxDistance: projectileConfig.maxDistance,
        sourceId: champion.id,
        abilityId: definition.id,
        damage: projectileConfig.damage,
        damageType: projectileConfig.damageType,
        piercing: projectileConfig.piercing,
        appliesEffects: projectileConfig.appliesEffects,
        effectDuration: projectileConfig.effectDuration,
      });

      context.addEntity(projectile);
    }
  }

  /**
   * Execute a ground-targeted ability.
   */
  private executeGroundTarget(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition) return;

    // Handle trap placement (like Vile's E)
    if (definition.trap) {
      this.executeTrapPlacement(params, definition, rank);
      return;
    }

    // Handle cone-shaped abilities
    if (definition.shape === "cone" && definition.coneAngle) {
      this.executeConeAbility(params, definition, rank, damageMultiplier);
      return;
    }

    // Delayed AoE (like meteor): lands at the target point after aoeDelay
    if (definition.aoeDelay && definition.aoeDelay > 0) {
      const landing = { ...params, targetPosition: targetPosition.clone() };
      context.schedule(definition.aoeDelay, () => {
        this.executeCircleAoE(landing, definition, rank, damageMultiplier);
      });
      return;
    }

    // Default: immediate circular AoE
    this.executeCircleAoE(params, definition, rank, damageMultiplier);
  }

  /**
   * Execute trap placement (like Vile's E).
   */
  private executeTrapPlacement(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition || !definition.trap) return;

    // Get R rank for explosion damage scaling
    const rState = champion.abilityStates.R;
    const rRank = Math.max(1, rState.rank); // Default to rank 1 if R not learned
    const explosionDamage = definition.trap.explosionDamage?.[rRank - 1] ?? 0;

    // Create the trap
    const trap = new ServerTrap({
      id: context.generateEntityId(),
      position: targetPosition.clone(),
      side: champion.side,
      ownerId: champion.id,
      triggerRadius: definition.trap.triggerRadius,
      duration: definition.trap.duration,
      isStealthed: definition.trap.isStealthed,
      rootDuration: definition.trap.rootDuration,
      soulStacksOnTrigger: definition.trap.soulStacksOnTrigger ?? 0,
      explosionDamage: explosionDamage,
      explosionRadius: definition.trap.explosionRadius ?? 300,
      explosionRootDuration: definition.trap.explosionRootDuration ?? 1,
    });

    context.addEntity(trap);

    Logger.debug("Ability", `${champion.playerId} placed trap at (${targetPosition.x}, ${targetPosition.y})`);
  }

  /**
   * Execute a circular AoE at a position.
   */
  private executeCircleAoE(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition) return;

    const stats = champion.getStats();
    const radius = definition.aoeRadius ?? 200;

    // If this is a zone ability (has zoneDuration), create a persistent zone
    if (definition.zoneDuration && definition.zoneDuration > 0) {
      this.createZone(params, definition, rank, damageMultiplier);
      return;
    }

    // Get entities in the AoE
    const entities = context.getEntitiesInRadius(targetPosition, radius);

    // Calculate damage (with passive multiplier)
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
    }

    // Apply to enemies
    for (const entity of entities) {
      if (entity.side === champion.side) continue;
      if (entity.isDead) continue;

      // Check if ability can affect this entity type
      if (!canAbilityAffectEntityType(definition, entity.entityType)) {
        continue;
      }

      // Apply damage
      if (damageAmount > 0 && definition.damage) {
        entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
      }

      // Apply effects
      if (definition.appliesEffects) {
        applyEffectsToEntity(
          entity,
          definition.appliesEffects,
          definition.effectDuration ?? 0,
          champion.id
        );
      }
    }
  }

  /**
   * Create a persistent zone at target position.
   */
  private createZone(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition) return;

    const stats = champion.getStats();
    const radius = definition.aoeRadius ?? 200;

    // Calculate damage per tick (with passive multiplier)
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
    }

    // Determine zone type for visual
    let zoneType: ZoneEffectType = 'slow';
    if (damageAmount > 0) {
      zoneType = 'damage';
    } else if (definition.heal) {
      zoneType = 'heal';
    }

    // Create the zone
    const zone = new ServerZone({
      id: context.generateEntityId(),
      position: targetPosition.clone(),
      side: champion.side,
      radius,
      duration: definition.zoneDuration ?? 2,
      sourceId: champion.id,
      abilityId: definition.id,
      zoneType,
      damage: damageAmount,
      damageType: definition.damage?.type ?? 'magic',
      appliesEffects: definition.appliesEffects,
      effectDuration: definition.effectDuration ?? 0,
      tickRate: definition.zoneTickRate ?? 0,
    });

    context.addEntity(zone);
  }

  /**
   * Execute a cone-shaped ability.
   */
  private executeConeAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition) return;

    const stats = champion.getStats();
    const radius = definition.aoeRadius ?? definition.range ?? 300;
    const coneAngle = definition.coneAngle ?? Math.PI / 2; // 90 degrees default

    // Direction from champion to target
    const direction = targetPosition.subtracted(champion.position).normalized();
    const dirAngle = Math.atan2(direction.y, direction.x);

    // Get entities in range
    const entities = context.getEntitiesInRadius(champion.position, radius);

    // Calculate damage (with passive multiplier)
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
    }

    for (const entity of entities) {
      if (entity.side === champion.side) continue;
      if (entity.isDead) continue;
      if (entity.id === champion.id) continue;

      // Check if ability can affect this entity type
      if (!canAbilityAffectEntityType(definition, entity.entityType)) {
        continue;
      }

      // Check if entity is in cone
      const toEntity = entity.position.subtracted(champion.position);
      const entityAngle = Math.atan2(toEntity.y, toEntity.x);
      const angleDiff = Math.abs(this.normalizeAngle(entityAngle - dirAngle));

      if (angleDiff <= coneAngle / 2) {
        // Entity is in cone
        if (damageAmount > 0 && definition.damage) {
          entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
        }

        if (definition.appliesEffects) {
          applyEffectsToEntity(
            entity,
            definition.appliesEffects,
            definition.effectDuration ?? 0,
            champion.id
          );
        }
      }
    }
  }

  /**
   * Normalize an angle to be within -PI to PI.
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}

// Export singleton instance
export const abilityExecutor = new ServerAbilityExecutor();
