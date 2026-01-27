/**
 * PassiveTriggerSystem - Server-side passive ability trigger system.
 *
 * This system manages passive ability triggers for champions.
 * Passives are triggered by game events (damage, attacks, kills, etc.)
 * and process their effects accordingly.
 */

import {
  PassiveTrigger,
  PassiveAbilityDefinition,
  PassiveState,
  getPassiveDefinition,
  calculateAbilityValue,
  DamageType,
  EntityType,
} from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { Logger } from '../utils/Logger';

/**
 * Data passed to passive trigger handlers.
 */
export interface PassiveTriggerData {
  /** Target entity (for on_hit, on_attack) */
  target?: ServerEntity;
  /** Damage amount (for on_take_damage, on_hit) */
  damageAmount?: number;
  /** Damage type (for on_take_damage, on_hit) */
  damageType?: DamageType;
  /** Source entity ID (for on_take_damage) */
  sourceId?: string;
  /** Ability ID (for on_ability_cast, on_ability_hit) */
  abilityId?: string;
}

/**
 * Passive handler function signature.
 */
export type PassiveHandler = (
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  context: ServerGameContext,
  data?: PassiveTriggerData
) => void;

/**
 * Registered passive info.
 */
interface RegisteredPassive {
  championId: string;
  definition: PassiveAbilityDefinition;
  handler: PassiveHandler;
}

/**
 * Passive trigger system.
 * Manages registration and dispatching of passive abilities.
 */
export class PassiveTriggerSystem {
  private triggerRegistry: Map<PassiveTrigger, RegisteredPassive[]> = new Map();
  private defaultHandlers: Map<string, PassiveHandler> = new Map();

  constructor() {
    this.initializeDefaultHandlers();
  }

  /**
   * Initialize default handlers for common passive types.
   */
  private initializeDefaultHandlers(): void {
    // Default handler for on_low_health (like Warrior's Undying Resolve)
    this.defaultHandlers.set('on_low_health_shield', this.handleLowHealthShield.bind(this));

    // Default handler for stack-based passives (like Magnus's Arcane Surge)
    this.defaultHandlers.set('stack_accumulation', this.handleStackAccumulation.bind(this));

    // Default handler for on_hit damage (like Vex's Assassin's Mark)
    this.defaultHandlers.set('on_hit_damage', this.handleOnHitDamage.bind(this));

    // Default handler for on_take_damage stack (like Gorath's Immovable)
    this.defaultHandlers.set('on_take_damage_stack', this.handleTakeDamageStack.bind(this));

    // Default handler for aura passives (like Elara's Blessed Presence)
    this.defaultHandlers.set('aura_heal', this.handleAuraHeal.bind(this));

    // Default handler for Vile's Souls of Vilix (dual-trigger: on_kill + on_hit)
    this.defaultHandlers.set('soul_stacks', this.handleSoulStacks.bind(this));
  }

  /**
   * Register a passive ability for a champion.
   */
  registerPassive(
    championId: string,
    definition: PassiveAbilityDefinition,
    handler?: PassiveHandler
  ): void {
    const effectiveHandler = handler ?? this.getDefaultHandler(definition);

    const registered: RegisteredPassive = {
      championId,
      definition,
      handler: effectiveHandler,
    };

    // Register for primary trigger
    this.addToRegistry(definition.trigger, registered);

    // Register for additional triggers if any
    if (definition.additionalTriggers) {
      for (const trigger of definition.additionalTriggers) {
        this.addToRegistry(trigger, registered);
      }
    }

    Logger.champion.debug(`Registered passive ${definition.id} for ${championId}`);
  }

  /**
   * Add a registered passive to the trigger registry.
   */
  private addToRegistry(trigger: PassiveTrigger, registered: RegisteredPassive): void {
    if (!this.triggerRegistry.has(trigger)) {
      this.triggerRegistry.set(trigger, []);
    }
    this.triggerRegistry.get(trigger)!.push(registered);
  }

  /**
   * Get the default handler for a passive definition.
   */
  private getDefaultHandler(definition: PassiveAbilityDefinition): PassiveHandler {
    // Determine handler based on passive properties
    if (definition.trigger === 'on_low_health' && definition.shield) {
      return this.defaultHandlers.get('on_low_health_shield')!;
    }

    if (definition.usesStacks && definition.trigger === 'on_ability_cast') {
      return this.defaultHandlers.get('stack_accumulation')!;
    }

    if (definition.usesStacks && definition.trigger === 'on_hit' && definition.damage) {
      return this.defaultHandlers.get('on_hit_damage')!;
    }

    if (definition.usesStacks && definition.trigger === 'on_take_damage') {
      return this.defaultHandlers.get('on_take_damage_stack')!;
    }

    if (definition.trigger === 'always' && definition.auraRadius && definition.heal) {
      return this.defaultHandlers.get('aura_heal')!;
    }

    // Vile's soul stack passive (on_kill to gain, on_hit to consume)
    if (definition.soulScaling && definition.usesStacks) {
      return this.defaultHandlers.get('soul_stacks')!;
    }

    // Generic handler
    return this.genericHandler.bind(this);
  }

  /**
   * Dispatch a trigger to all registered passives.
   */
  dispatchTrigger(
    trigger: PassiveTrigger,
    champion: ServerChampion,
    context: ServerGameContext,
    data?: PassiveTriggerData
  ): void {
    const registered = this.triggerRegistry.get(trigger);
    if (!registered) return;

    const passiveState = champion.passiveState;
    if (!passiveState) return;

    for (const { championId, definition, handler } of registered) {
      // Only trigger for matching champion
      if (champion.definition.id !== championId) continue;

      // Check internal cooldown
      if (passiveState.cooldownRemaining > 0) continue;

      // Execute handler
      handler(champion, passiveState, definition, context, data);
    }
  }

  /**
   * Process interval-based passives (on_interval trigger).
   */
  processIntervalPassives(
    dt: number,
    champions: ServerChampion[],
    context: ServerGameContext
  ): void {
    const registered = this.triggerRegistry.get('on_interval');
    if (!registered) return;

    for (const champion of champions) {
      if (champion.isDead) continue;

      const passiveState = champion.passiveState;
      if (!passiveState) continue;

      for (const { championId, definition, handler } of registered) {
        if (champion.definition.id !== championId) continue;

        // Update interval timer
        if (passiveState.nextIntervalIn > 0) {
          passiveState.nextIntervalIn -= dt;
        }

        // Trigger when timer reaches 0
        if (passiveState.nextIntervalIn <= 0) {
          handler(champion, passiveState, definition, context);
          passiveState.nextIntervalIn = definition.intervalSeconds ?? 1;
        }
      }
    }
  }

  /**
   * Process always-active passives (auras, stat modifiers).
   */
  processAlwaysPassives(
    dt: number,
    champions: ServerChampion[],
    context: ServerGameContext
  ): void {
    const registered = this.triggerRegistry.get('always');
    if (!registered) return;

    for (const champion of champions) {
      if (champion.isDead) continue;

      const passiveState = champion.passiveState;
      if (!passiveState) continue;

      for (const { championId, definition, handler } of registered) {
        if (champion.definition.id !== championId) continue;

        // For aura passives with interval, process periodically
        if (definition.intervalSeconds) {
          if (passiveState.nextIntervalIn > 0) {
            passiveState.nextIntervalIn -= dt;
          }

          if (passiveState.nextIntervalIn <= 0) {
            handler(champion, passiveState, definition, context);
            passiveState.nextIntervalIn = definition.intervalSeconds;
          }
        } else {
          // Continuous effect - mark as active
          passiveState.isActive = true;
        }
      }
    }
  }

  /**
   * Update passive state timers (cooldowns, stack duration).
   */
  updatePassiveState(
    dt: number,
    champion: ServerChampion,
    _context: ServerGameContext
  ): void {
    const passiveState = champion.passiveState;
    if (!passiveState) return;

    // Update internal cooldown
    if (passiveState.cooldownRemaining > 0) {
      passiveState.cooldownRemaining = Math.max(0, passiveState.cooldownRemaining - dt);
    }

    // Update stack duration
    if (passiveState.stacks > 0 && passiveState.stackTimeRemaining > 0) {
      passiveState.stackTimeRemaining -= dt;
      if (passiveState.stackTimeRemaining <= 0) {
        // Stacks expired
        passiveState.stacks = 0;
        passiveState.isActive = false;
      }
    }
  }

  // ==========================================================================
  // Default Handlers
  // ==========================================================================

  /**
   * Generic handler for passives without specific logic.
   */
  private genericHandler(
    champion: ServerChampion,
    passiveState: PassiveState,
    definition: PassiveAbilityDefinition,
    _context: ServerGameContext,
    _data?: PassiveTriggerData
  ): void {
    Logger.champion.debug(`Passive ${definition.id} triggered for ${champion.playerId}`);
    passiveState.isActive = true;
  }

  /**
   * Handler for on_low_health shield passives (Warrior).
   */
  private handleLowHealthShield(
    champion: ServerChampion,
    passiveState: PassiveState,
    definition: PassiveAbilityDefinition,
    _context: ServerGameContext,
    _data?: PassiveTriggerData
  ): void {
    const healthPercent = champion.health / champion.maxHealth;
    const threshold = definition.healthThreshold ?? 0.3;

    if (healthPercent > threshold) return;

    // Apply shield
    if (definition.shield) {
      const stats = champion.getStats();
      const baseShieldValue = definition.scalesWithLevel
        ? this.getLevelScaledValue(definition, champion.level)
        : definition.shield.scaling.base[0];

      const shieldAmount = calculateAbilityValue(
        { ...definition.shield.scaling, base: [baseShieldValue] },
        1,
        {
          bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
          maxHealth: stats.maxHealth,
        }
      );

      champion.shields.push({
        amount: shieldAmount,
        remainingDuration: definition.shield.duration,
        sourceId: `passive_${definition.id}`,
        shieldType: 'normal',
      });
    }

    // Apply stat modifiers via effects (so they show in HUD)
    if (definition.statModifiers) {
      const effectDuration = definition.shield?.duration ?? 5;
      for (const mod of definition.statModifiers) {
        // For warrior passive, apply the undying resolve effect
        if (definition.id === 'warrior_passive' && mod.stat === 'armor') {
          champion.applyEffect('warrior_undying_resolve', effectDuration, `passive_${definition.id}`);
        } else {
          // Fallback to direct modifier for other passives
          champion.addModifier({
            source: `passive_${definition.id}`,
            flat: mod.flatValue ? { [mod.stat]: mod.flatValue } as any : undefined,
            percent: mod.percentValue ? { [mod.stat]: 1 + mod.percentValue } as any : undefined,
            duration: effectDuration,
            timeRemaining: effectDuration,
          });
        }
      }
    }

    // Set cooldown
    passiveState.cooldownRemaining = definition.internalCooldown ?? 60;
    passiveState.isActive = true;

    Logger.champion.info(`${champion.playerId} triggered ${definition.name}`);
  }

  /**
   * Handler for stack accumulation passives (Magnus).
   */
  private handleStackAccumulation(
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
  private handleOnHitDamage(
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
  private handleTakeDamageStack(
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

  /**
   * Handler for aura heal passives (Elara).
   */
  private handleAuraHeal(
    champion: ServerChampion,
    passiveState: PassiveState,
    definition: PassiveAbilityDefinition,
    context: ServerGameContext,
    _data?: PassiveTriggerData
  ): void {
    if (!definition.auraRadius || !definition.heal) return;

    // Get allies in range
    const entities = context.getEntitiesInRadius(champion.position, definition.auraRadius);

    for (const entity of entities) {
      if (entity.side !== champion.side) continue;
      if (entity.isDead) continue;
      if (!('heal' in entity)) continue;

      const entityMaxHealth = entity.maxHealth;
      const healAmount = calculateAbilityValue(
        definition.heal.scaling,
        1,
        { maxHealth: entityMaxHealth }
      );

      (entity as { heal: (amount: number) => void }).heal(healAmount);
    }

    passiveState.isActive = true;
  }

  /**
   * Get level-scaled value for a passive.
   */
  private getLevelScaledValue(definition: PassiveAbilityDefinition, level: number): number {
    if (!definition.levelScaling) {
      return definition.shield?.scaling.base[0] ?? 0;
    }

    const { levels, values } = definition.levelScaling;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (level >= levels[i]) {
        return values[i];
      }
    }

    return values[0];
  }

  /**
   * Handler for Vile's Souls of Vilix passive.
   * Dual-trigger:
   * - on_kill: Gain soul stacks based on target type and champion level
   * - on_hit: Consume all stacks to deal bonus physical damage to champions
   */
  private handleSoulStacks(
    champion: ServerChampion,
    passiveState: PassiveState,
    definition: PassiveAbilityDefinition,
    context: ServerGameContext,
    data?: PassiveTriggerData
  ): void {
    if (!definition.soulScaling) return;

    // Determine which trigger this is
    // on_kill data will have target (the killed entity)
    // on_hit data will have target (the attacked entity) and will be a champion

    if (!data?.target) return;

    const target = data.target;

    // Check if this is an on_hit trigger (target is a champion, not dead)
    // If target is alive and is a champion, this is an on_hit (basic attack)
    if (target.entityType === EntityType.CHAMPION && !target.isDead) {
      // on_hit: Consume stacks to deal damage
      if (passiveState.stacks > 0) {
        const bonusDamage = passiveState.stacks;
        target.takeDamage(bonusDamage, 'physical', champion.id, context);

        Logger.champion.debug(
          `${champion.playerId} Souls of Vilix consumed ${passiveState.stacks} stacks for ${bonusDamage} physical damage`
        );

        // Reset stacks
        passiveState.stacks = 0;
        passiveState.isActive = false;
      }
      return;
    }

    // on_kill: Gain stacks based on target type
    // This triggers when target is dead
    if (!target.isDead) return;

    const level = champion.level;
    let stacksToGain = 0;

    // Determine stacks based on target type
    switch (target.entityType) {
      case EntityType.MINION: {
        stacksToGain = this.getSoulStacksByLevel(
          definition.soulScaling.minion.levels,
          definition.soulScaling.minion.stacks,
          level
        );
        break;
      }
      case EntityType.JUNGLE_CAMP: {
        stacksToGain = this.getSoulStacksByLevel(
          definition.soulScaling.jungle.levels,
          definition.soulScaling.jungle.stacks,
          level
        );
        break;
      }
      case EntityType.CHAMPION: {
        stacksToGain = this.getSoulStacksByLevel(
          definition.soulScaling.champion.levels,
          definition.soulScaling.champion.stacks,
          level
        );
        break;
      }
      default:
        // Unknown target type, no stacks
        return;
    }

    // Add stacks (no max cap for Vile, no decay)
    passiveState.stacks += stacksToGain;
    passiveState.isActive = passiveState.stacks > 0;

    Logger.champion.debug(
      `${champion.playerId} Souls of Vilix gained ${stacksToGain} stacks (total: ${passiveState.stacks})`
    );
  }

  /**
   * Get soul stacks based on champion level using the scaling table.
   */
  private getSoulStacksByLevel(levels: number[], stacks: number[], championLevel: number): number {
    // Find the appropriate bracket for the champion's level
    for (let i = levels.length - 1; i >= 0; i--) {
      if (championLevel >= levels[i]) {
        return stacks[i];
      }
    }
    return stacks[0];
  }

  /**
   * Clear all registered passives.
   */
  clear(): void {
    this.triggerRegistry.clear();
  }
}

// Export singleton instance
export const passiveTriggerSystem = new PassiveTriggerSystem();
