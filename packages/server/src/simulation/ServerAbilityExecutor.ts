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
  getPassiveDefinition,
  canAbilityAffectEntityType,
  hasRecastBehavior,
  hasChargeBehavior,
  DamageType,
  GameEventType,
} from "@siege/shared";
import { passiveTriggerSystem } from "../systems/PassiveTriggerSystem";
import type { ServerChampion } from "./ServerChampion";
import type { ServerEntity } from "./ServerEntity";
import type { ServerGameContext } from "../game/ServerGameContext";
import { ServerProjectile } from "./ServerProjectile";
import { ServerZone, ZoneEffectType } from "./ServerZone";
import { ServerTrap, getPlayerTraps } from "./ServerTrap";
import { ServerLightOrb, LUME_ORB_CONFIG } from "./ServerLightOrb";
import { Logger } from "../utils/Logger";

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
   * Get the ability damage multiplier from champion's active passive.
   * Returns > 1.0 if the champion has an active damage-amp passive (like Arcane Surge).
   */
  private getPassiveDamageMultiplier(champion: ServerChampion): number {
    // Check if passive is active
    if (!champion.passiveState.isActive) {
      return 1.0;
    }

    // Get the passive definition
    const passiveId = champion.definition.passive;
    if (!passiveId) return 1.0;

    const passiveDef = getPassiveDefinition(passiveId);
    if (!passiveDef) return 1.0;

    // Check if this is a stack-based damage amp passive (like Arcane Surge)
    // These passives have: usesStacks, consumeStacksOnActivation, but no direct damage
    if (
      passiveDef.usesStacks &&
      passiveDef.consumeStacksOnActivation &&
      !passiveDef.damage
    ) {
      // Arcane Surge: 30% bonus damage
      return 1.3;
    }

    return 1.0;
  }

  /**
   * Consume the champion's passive stacks after using the empowered ability.
   */
  private consumePassiveStacks(champion: ServerChampion): void {
    const passiveId = champion.definition.passive;
    if (!passiveId) return;

    const passiveDef = getPassiveDefinition(passiveId);
    if (!passiveDef) return;

    // Only consume for stack-based damage amp passives
    if (passiveDef.usesStacks && passiveDef.consumeStacksOnActivation) {
      champion.passiveState.stacks = 0;
      champion.passiveState.stackTimeRemaining = 0;
      champion.passiveState.isActive = false;
      Logger.champion.debug(`${champion.playerId} ${passiveDef.name} consumed - bonus damage applied`);
    }
  }

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
      // Special handling for Lume's Q recast (recall orb)
      if (definition.id === 'lume_q') {
        return this.handleLumeQRecast(params);
      }
      return this.handleRecast(params, definition);
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

    // Check for passive damage amplification (e.g., Magnus's Arcane Surge)
    const damageMultiplier = this.getPassiveDamageMultiplier(champion);

    // Break stealth when casting abilities (except stealth ability itself)
    if (abilityId !== 'vex_shroud' && 'breakStealth' in champion) {
      (champion as any).breakStealth();
    }

    // All checks passed - execute the ability
    this.executeAbility(params, definition, damageMultiplier);

    // Consume passive stacks if damage amp was used
    if (damageMultiplier > 1.0) {
      this.consumePassiveStacks(champion);
    }

    // Deduct mana
    champion.resource -= manaCost;

    // Start cooldown
    const cooldown = definition.cooldown?.[rank - 1] ?? 0;
    state.cooldownRemaining = cooldown;
    state.cooldownTotal = cooldown;

    // Special case: Vex's Shadow Step (E) - reset cooldown if enemy is marked
    if (abilityId === 'vex_dash') {
      const hasMarkedEnemy = this.checkForMarkedEnemy(champion, context);
      if (hasMarkedEnemy) {
        state.cooldownRemaining = 0;
        Logger.debug("Ability", `${champion.playerId} Vex dash cooldown reset - marked enemy nearby`);
      }
    }

    // Enter combat
    champion.enterCombat();

    // Add event for ability cast
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId,
      slot,
      targetX: params.targetPosition?.x,
      targetY: params.targetPosition?.y,
      targetEntityId: params.targetEntityId,
    });

    // Dispatch on_ability_cast trigger for passive abilities
    passiveTriggerSystem.dispatchTrigger('on_ability_cast', champion, context, {
      abilityId,
    });

    return {
      success: true,
      manaCost,
      cooldown,
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
    this.executeRecastDash(champion, hitPosition, definition);

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
   * Execute the recast dash to the hit position.
   */
  private executeRecastDash(champion: ServerChampion, hitPosition: Vector, definition: AbilityDefinition): void {
    const direction = hitPosition.subtracted(champion.position);
    const distance = direction.length();

    if (distance < 10) {
      // Already at the position
      return;
    }

    const normalizedDir = direction.normalized();

    // Default dash speed for recast (fast dash)
    const dashSpeed = 1500;

    champion.forcedMovement = {
      direction: normalizedDir,
      distance: distance,
      duration: distance / dashSpeed,
      elapsed: 0,
      type: "dash",
      hitEntities: new Set(),
    };

    // Update facing direction
    champion.direction = normalizedDir;
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
   * @param damageMultiplier - Multiplier from passive abilities (e.g., 1.3 for Arcane Surge)
   */
  private executeAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, slot } = params;
    const rank = champion.abilityStates[slot].rank;

    // Update facing direction if targeting a position
    if (params.targetPosition) {
      const dir = params.targetPosition.subtracted(champion.position);
      if (dir.length() > 0.1) {
        champion.direction = dir.normalized();
      }
    }

    // Special handling for Lume abilities (Light Orb mechanics)
    if (this.isLumeAbility(champion, definition.id)) {
      this.executeLumeAbility(params, definition, rank, damageMultiplier);
      return;
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

    // Handle dash if the ability has one
    // For target_enemy abilities, get position from target entity
    if (definition.dash) {
      let dashTargetPosition = params.targetPosition;
      if (!dashTargetPosition && params.targetEntityId) {
        const target = params.context.getEntity(params.targetEntityId);
        if (target) {
          dashTargetPosition = target.position.clone();
        }
      }
      if (dashTargetPosition) {
        this.executeDash({ ...params, targetPosition: dashTargetPosition }, definition, rank, damageMultiplier);
      }
    }

    // Handle teleport/blink
    // For target_enemy abilities, get position from target entity
    if (definition.teleport) {
      let teleportTargetPosition = params.targetPosition;
      if (!teleportTargetPosition && params.targetEntityId) {
        const target = params.context.getEntity(params.targetEntityId);
        if (target) {
          teleportTargetPosition = target.position.clone();
        }
      }
      if (teleportTargetPosition) {
        this.executeTeleport({ ...params, targetPosition: teleportTargetPosition }, definition);
      }
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
      const shieldAmount = calculateAbilityValue(
        definition.shield.scaling,
        rank,
        {
          attackDamage: stats.attackDamage,
          abilityPower: stats.abilityPower,
          bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
          maxHealth: stats.maxHealth,
        }
      );

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

    // Get entities in range
    const entities = context.getEntitiesInRadius(champion.position, radius);

    // Calculate damage if applicable (with passive multiplier)
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
    }

    // Calculate heal if applicable
    let healAmount = 0;
    if (definition.heal) {
      healAmount = calculateAbilityValue(definition.heal.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      });
    }

    // Apply ally effects to self (caster) first
    if (definition.appliesEffects) {
      // Check if this is a buff (apply to self) or debuff (don't apply to self)
      // For no_target ally buffs, apply to caster
      this.applyEffectsToEntity(
        champion,
        definition.appliesEffects,
        definition.effectDuration ?? 0,
        champion.id
      );
    }

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

      // Apply effects to enemies (debuffs like stun, slow, taunt)
      // Applied regardless of whether ability does damage
      if (isEnemy && definition.appliesEffects) {
        this.applyEffectsToEntity(
          entity,
          definition.appliesEffects,
          definition.effectDuration ?? 0,
          champion.id
        );
      }

      // Apply healing to allies
      if (isAlly && healAmount > 0) {
        if ("heal" in entity && typeof entity.heal === "function") {
          (entity as { heal: (amount: number) => void }).heal(healAmount);
        }
      }

      // Apply ally effects (like speed buff from Elara's E)
      if (isAlly && definition.appliesEffects) {
        this.applyEffectsToEntity(
          entity,
          definition.appliesEffects,
          definition.effectDuration ?? 0,
          champion.id
        );
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
      const damageAmount = calculateAbilityValue(
        definition.damage.scaling,
        rank,
        {
          attackDamage: stats.attackDamage,
          abilityPower: stats.abilityPower,
          bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
          maxHealth: stats.maxHealth,
        }
      ) * damageMultiplier;

      target.takeDamage(damageAmount, definition.damage.type, champion.id, context);
    }

    // Apply effects
    if (definition.appliesEffects) {
      this.applyEffectsToEntity(
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
      const healAmount = calculateAbilityValue(definition.heal.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      });

      (target as { heal: (amount: number) => void }).heal(healAmount);
    }

    // Apply shield
    if (definition.shield && "shields" in target) {
      const shieldAmount = calculateAbilityValue(
        definition.shield.scaling,
        rank,
        {
          attackDamage: stats.attackDamage,
          abilityPower: stats.abilityPower,
          bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
          maxHealth: stats.maxHealth,
        }
      );

      (target as ServerChampion).shields.push({
        amount: shieldAmount,
        remainingDuration: definition.shield.duration,
        sourceId: definition.id,
        shieldType: 'normal',
      });
    }

    // Apply effects
    if (definition.appliesEffects) {
      this.applyEffectsToEntity(
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
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
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

    // Handle delayed AoE (like meteor)
    if (definition.aoeDelay && definition.aoeDelay > 0) {
      // TODO: Implement delayed AoE with scheduled execution
      // For now, execute immediately
      this.executeCircleAoE(params, definition, rank, damageMultiplier);
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
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
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
        this.applyEffectsToEntity(
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
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
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
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
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
          this.applyEffectsToEntity(
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
   * Execute a dash ability.
   */
  private executeDash(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number = 1,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition } = params;

    if (!targetPosition || !definition.dash) return;

    const direction = targetPosition.subtracted(champion.position);
    if (direction.length() < 0.1) return;

    const normalizedDir = direction.normalized();
    const dashDistance = Math.min(direction.length(), definition.dash.distance);

    // Apply self-buff effects (like Vex's empowered attack)
    // Check for effects that should be applied to caster (buff effects)
    if (definition.appliesEffects) {
      for (const effectId of definition.appliesEffects) {
        // Check if this is a self-buff effect (like vex_empowered)
        if (effectId === 'vex_empowered' || effectId.includes('_empowered') || effectId.includes('_buff')) {
          champion.applyEffect(
            effectId,
            definition.effectDuration ?? 4,
            champion.id
          );
        }
      }
    }

    // Calculate damage for collision if ability has damage (with passive multiplier)
    // For Vex dash, damage is used for empowered attack, not dash collision
    let damageAmount = 0;
    const dashHasDamageOnCollision = definition.damage && definition.aoeRadius;
    if (dashHasDamageOnCollision) {
      const stats = champion.getStats();
      damageAmount = calculateAbilityValue(definition.damage!.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
    }

    champion.forcedMovement = {
      direction: normalizedDir,
      distance: dashDistance,
      duration: dashDistance / definition.dash.speed,
      elapsed: 0,
      type: "dash",
      // Collision data for dash abilities that damage/apply effects on hit
      hitbox: definition.aoeRadius ?? 60,
      damage: damageAmount,
      damageType: definition.damage?.type,
      // Only pass debuff effects to be applied on collision (not self-buffs)
      appliesEffects: definition.appliesEffects?.filter(
        e => !e.includes('_empowered') && !e.includes('_buff')
      ),
      effectDuration: definition.effectDuration,
      hitEntities: new Set(),
    };

    // Update facing direction
    champion.direction = normalizedDir;
  }

  /**
   * Execute a teleport/blink ability.
   */
  private executeTeleport(
    params: AbilityCastParams,
    definition: AbilityDefinition
  ): void {
    const { champion, targetPosition } = params;

    if (!targetPosition) return;

    // Clamp to range
    const direction = targetPosition.subtracted(champion.position);
    const maxRange = definition.range ?? 500;

    if (direction.length() > maxRange) {
      direction.normalize().scalar(maxRange);
    }

    const finalPosition = champion.position.added(direction);

    // Instant teleport
    champion.position.setFrom(finalPosition);
  }

  /**
   * Apply effects to an entity.
   */
  private applyEffectsToEntity(
    entity: ServerEntity,
    effectIds: string[],
    duration: number,
    sourceId: string
  ): void {
    if (!("applyEffect" in entity)) return;

    const applyEffect = (
      entity as {
        applyEffect: (id: string, duration: number, sourceId?: string) => void;
      }
    ).applyEffect;

    for (const effectId of effectIds) {
      applyEffect.call(entity, effectId, duration, sourceId);
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

  /**
   * Check if there's an enemy with vex_mark effect nearby.
   * Used for Vex's Shadow Step cooldown reset mechanic.
   */
  private checkForMarkedEnemy(
    champion: ServerChampion,
    context: ServerGameContext
  ): boolean {
    // Check radius around champion (dash range + some buffer)
    const checkRadius = 500;
    const entities = context.getEntitiesInRadius(champion.position, checkRadius);

    for (const entity of entities) {
      // Skip allies and dead entities
      if (entity.side === champion.side || entity.isDead) continue;

      // Check if entity has vex_mark effect
      if ('activeEffects' in entity) {
        const activeEffects = (entity as any).activeEffects as Array<{ definitionId: string }>;
        if (activeEffects?.some(e => e.definitionId === 'vex_mark')) {
          return true;
        }
      }
    }

    return false;
  }

  // =============================================================================
  // Lume Light Orb Helpers
  // =============================================================================

  /**
   * Get Lume's Light Orb from the game context.
   * Returns null if the champion is not Lume or orb doesn't exist.
   */
  getLumeOrb(champion: ServerChampion, context: ServerGameContext): ServerLightOrb | null {
    if (champion.definition.id !== 'lume') return null;

    // Find orb owned by this champion
    for (const entity of context.getAllEntities()) {
      if (entity instanceof ServerLightOrb && entity.ownerId === champion.id) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Get or create Lume's Light Orb.
   * Creates the orb if it doesn't exist.
   */
  getOrCreateLumeOrb(champion: ServerChampion, context: ServerGameContext): ServerLightOrb | null {
    if (champion.definition.id !== 'lume') return null;

    let orb = this.getLumeOrb(champion, context);
    if (!orb) {
      // Create the orb
      orb = new ServerLightOrb({
        id: context.generateEntityId(),
        position: champion.position.clone().add(new Vector(LUME_ORB_CONFIG.orbitRadius, 0)),
        side: champion.side,
        ownerId: champion.id,
      });
      context.addEntity(orb);
      Logger.debug("Ability", `Created Light Orb for Lume (${champion.playerId})`);
    }

    return orb;
  }

  /**
   * Execute Lume's Q ability - Send the Light.
   * Sends the orb to a target location, deals damage on arrival.
   */
  private executeLumeQ(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, targetPosition, context } = params;

    if (!targetPosition) return;

    const orb = this.getOrCreateLumeOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug("Ability", `Lume Q failed - orb is destroyed`);
      return;
    }

    const stats = champion.getStats();

    // Calculate damage
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
    }

    const damageType = definition.damage?.type ?? 'magic';

    // Send orb with arrival callback for damage
    orb.sendTo(targetPosition, () => {
      // Deal damage on arrival
      const enemies = context.getEntitiesInRadius(orb.position, LUME_ORB_CONFIG.qImpactRadius);
      for (const entity of enemies) {
        if (entity.side === champion.side) continue;
        if (entity.isDead) continue;
        if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;

        entity.takeDamage(damageAmount, damageType, champion.id, context);
      }
      Logger.debug("Ability", `Lume Q arrived - dealt ${damageAmount.toFixed(0)} damage`);
    });

    // Enable recast for recall
    champion.abilityStates.Q.recastWindowRemaining = 10; // Can recast while orb is away
    champion.abilityStates.Q.recastCount = 1;

    Logger.champion.debug(`${champion.playerId} sent Light Orb to (${targetPosition.x.toFixed(0)}, ${targetPosition.y.toFixed(0)})`);
  }

  /**
   * Handle Lume's Q recast - Recall the orb.
   */
  private handleLumeQRecast(params: AbilityCastParams): AbilityCastResult {
    const { champion, context } = params;

    const orb = this.getLumeOrb(champion, context);
    if (!orb || orb.isDestroyed || orb.isOrbiting) {
      return { success: false, failReason: "invalid_target" };
    }

    orb.recall();
    champion.consumeRecast('Q');

    Logger.champion.debug(`${champion.playerId} recalled Light Orb`);

    return { success: true, manaCost: 0, cooldown: 0 };
  }

  /**
   * Execute Lume's W ability - Warmth.
   * Pulse from orb that heals allies and damages enemies.
   */
  private executeLumeW(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, context } = params;

    const orb = this.getLumeOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug("Ability", `Lume W failed - orb is destroyed`);
      return;
    }

    const stats = champion.getStats();

    // Calculate damage
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
    }

    // Calculate heal
    let healAmount = 0;
    if (definition.heal) {
      healAmount = calculateAbilityValue(definition.heal.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      });
    }

    const damageType = definition.damage?.type ?? 'magic';
    const pulseRadius = definition.aoeRadius ?? LUME_ORB_CONFIG.wPulseRadius;

    // Get entities in range of orb
    const entities = context.getEntitiesInRadius(orb.position, pulseRadius);

    for (const entity of entities) {
      if (entity.isDead) continue;

      const isAlly = entity.side === champion.side;

      if (isAlly && healAmount > 0) {
        // Heal allies (including Lume)
        if ('heal' in entity && typeof entity.heal === 'function') {
          (entity as { heal: (amount: number) => void }).heal(healAmount);
        }
      } else if (!isAlly && damageAmount > 0) {
        // Damage enemies
        if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;
        entity.takeDamage(damageAmount, damageType, champion.id, context);
      }
    }

    Logger.champion.debug(`${champion.playerId} cast Warmth - healed ${healAmount.toFixed(0)}, dealt ${damageAmount.toFixed(0)}`);
  }

  /**
   * Execute Lume's E ability - Dazzle Step.
   * Dash toward the orb, blind enemies on arrival.
   */
  private executeLumeE(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number
  ): void {
    const { champion, context } = params;

    const orb = this.getLumeOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug("Ability", `Lume E failed - orb is destroyed`);
      return;
    }

    // Calculate dash direction toward orb
    const direction = orb.position.subtracted(champion.position);
    const distance = Math.min(direction.length(), definition.dash?.distance ?? 600);

    if (distance < 10) {
      // Already at orb - just apply blind
      this.applyLumeBlind(champion, orb.position, definition, rank, context);
      return;
    }

    const normalizedDir = direction.normalized();
    const dashSpeed = definition.dash?.speed ?? 1200;

    champion.forcedMovement = {
      direction: normalizedDir,
      distance,
      duration: distance / dashSpeed,
      elapsed: 0,
      type: "dash",
      hitEntities: new Set(),
    };

    // Update facing direction
    champion.direction = normalizedDir;

    // Schedule blind effect check on dash completion
    // This is a simplified approach - ideally we'd check on dash end
    // For now, we'll apply blind after dash duration
    const blindDelay = distance / dashSpeed;
    setTimeout(() => {
      // Check if champion reached the orb (within 50 units)
      const currentOrb = this.getLumeOrb(champion, context);
      if (currentOrb && champion.position.distanceTo(currentOrb.position) <= 50) {
        this.applyLumeBlind(champion, currentOrb.position, definition, rank, context);
      }
    }, blindDelay * 1000);

    Logger.champion.debug(`${champion.playerId} dashed toward Light Orb`);
  }

  /**
   * Apply Lume's blind effect to enemies near the orb.
   */
  private applyLumeBlind(
    champion: ServerChampion,
    position: Vector,
    definition: AbilityDefinition,
    rank: number,
    context: ServerGameContext
  ): void {
    const blindRadius = LUME_ORB_CONFIG.eBlindRadius;
    const blindDuration = Array.isArray(definition.effectDuration)
      ? definition.effectDuration[rank - 1]
      : definition.effectDuration ?? 1.0;

    const enemies = context.getEntitiesInRadius(position, blindRadius);

    for (const entity of enemies) {
      if (entity.side === champion.side) continue;
      if (entity.isDead) continue;

      if ('applyEffect' in entity) {
        (entity as any).applyEffect('blind', blindDuration, champion.id);
      }
    }

    Logger.debug("Ability", `Lume E blinded enemies for ${blindDuration}s`);
  }

  /**
   * Execute Lume's R ability - Beaconfall.
   * Explode the orb for massive damage and destroy it.
   */
  private executeLumeR(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, context } = params;

    const orb = this.getLumeOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug("Ability", `Lume R failed - orb is destroyed`);
      return;
    }

    const stats = champion.getStats();
    const explosionPosition = orb.position.clone();

    // Calculate damage
    let damageAmount = 0;
    if (definition.damage) {
      damageAmount = calculateAbilityValue(definition.damage.scaling, rank, {
        attackDamage: stats.attackDamage,
        abilityPower: stats.abilityPower,
        bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
        maxHealth: stats.maxHealth,
      }) * damageMultiplier;
    }

    const damageType = definition.damage?.type ?? 'magic';
    const explosionRadius = definition.aoeRadius ?? LUME_ORB_CONFIG.rExplosionRadius;
    const slowDuration = Array.isArray(definition.effectDuration)
      ? definition.effectDuration[rank - 1]
      : definition.effectDuration ?? 2.0;

    // Get enemies in explosion radius
    const enemies = context.getEntitiesInRadius(explosionPosition, explosionRadius);

    for (const entity of enemies) {
      if (entity.side === champion.side) continue;
      if (entity.isDead) continue;
      if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;

      // Deal damage
      entity.takeDamage(damageAmount, damageType, champion.id, context);

      // Apply slow
      if (definition.appliesEffects && 'applyEffect' in entity) {
        for (const effectId of definition.appliesEffects) {
          (entity as any).applyEffect(effectId, slowDuration, champion.id);
        }
      }
    }

    // Destroy the orb
    orb.destroy();

    Logger.champion.info(`${champion.playerId} cast Beaconfall - dealt ${damageAmount.toFixed(0)} damage, orb destroyed`);
  }

  /**
   * Check if this is a Lume ability that needs special handling.
   */
  private isLumeAbility(champion: ServerChampion, abilityId: string): boolean {
    return champion.definition.id === 'lume' && abilityId.startsWith('lume_');
  }

  /**
   * Execute Lume ability with special orb handling.
   */
  private executeLumeAbility(
    params: AbilityCastParams,
    definition: AbilityDefinition,
    rank: number,
    damageMultiplier: number = 1.0
  ): void {
    const { champion, slot, context } = params;

    // Check if orb is destroyed (can't use Q/W/E when destroyed)
    const orb = this.getLumeOrb(champion, context);
    if (slot !== 'R' && (!orb || orb.isDestroyed)) {
      // For Q, try to create orb; for W/E just fail silently
      if (slot === 'Q') {
        this.getOrCreateLumeOrb(champion, context);
      }
    }

    switch (definition.id) {
      case 'lume_q':
        this.executeLumeQ(params, definition, rank, damageMultiplier);
        break;
      case 'lume_w':
        this.executeLumeW(params, definition, rank, damageMultiplier);
        break;
      case 'lume_e':
        this.executeLumeE(params, definition, rank);
        break;
      case 'lume_r':
        this.executeLumeR(params, definition, rank, damageMultiplier);
        break;
    }
  }
}

// Export singleton instance
export const abilityExecutor = new ServerAbilityExecutor();
