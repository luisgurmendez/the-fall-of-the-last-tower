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
  DamageType,
  GameEventType,
} from "@siege/shared";
import { passiveTriggerSystem } from "../systems/PassiveTriggerSystem";
import type { ServerChampion } from "./ServerChampion";
import type { ServerEntity } from "./ServerEntity";
import type { ServerGameContext } from "../game/ServerGameContext";
import { ServerProjectile } from "./ServerProjectile";
import { ServerZone, ZoneEffectType } from "./ServerZone";
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
    const { champion } = params;
    const stats = champion.getStats();

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

    for (const entity of entities) {
      if (entity.id === champion.id) continue;

      const isEnemy = entity.side !== champion.side;
      const isAlly = entity.side === champion.side;

      // Apply damage to enemies
      if (isEnemy && damageAmount > 0 && definition.damage) {
        entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);

        // Apply effects to enemies
        if (definition.appliesEffects) {
          this.applyEffectsToEntity(
            entity,
            definition.appliesEffects,
            definition.effectDuration ?? 0,
            champion.id
          );
        }
      }

      // Apply healing to allies
      if (isAlly && healAmount > 0) {
        if ("heal" in entity && typeof entity.heal === "function") {
          (entity as { heal: (amount: number) => void }).heal(healAmount);
        }
      }

      // Apply ally effects (like speed buff from Elara's E)
      if (isAlly && definition.appliesEffects) {
        // Only apply ally-friendly effects (buffs)
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

    // Spawn projectile
    const projectile = new ServerProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      direction: direction.normalized(),
      speed: definition.projectileSpeed ?? 1000,
      radius: definition.projectileRadius ?? 30,
      maxDistance: definition.range ?? 800,
      sourceId: champion.id,
      abilityId: definition.id,
      damage: damageAmount,
      damageType,
      piercing: definition.piercing ?? false,
      appliesEffects: definition.appliesEffects,
      effectDuration: definition.effectDuration,
    });

    context.addEntity(projectile);
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
}

// Export singleton instance
export const abilityExecutor = new ServerAbilityExecutor();
