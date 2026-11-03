/**
 * PassiveTriggerSystem - Server-side passive ability trigger system.
 *
 * This system manages passive ability triggers for champions.
 * Passives are triggered by game events (damage, attacks, kills, etc.)
 * and process their effects accordingly.
 *
 * It owns the registry (passives per trigger, per champion type) and the
 * dispatch. Passives registered without a handler get a default handler
 * picked from their definition; those live in systems/passives/.
 */

import {
  PassiveTrigger,
  PassiveAbilityDefinition,
  PassiveState,
  DamageType,
} from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { Logger } from '../utils/Logger';
import { handleLowHealthShield } from './passives/LowHealthShieldPassive';
import {
  handleStackAccumulation,
  handleOnHitDamage,
  handleTakeDamageStack,
} from './passives/StackPassives';
import { handleAuraHeal } from './passives/AuraHealPassive';
import { handleSoulStacks } from './passives/SoulStacksPassive';

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
 * Passive handler function signature. `trigger` is the event that fired it
 * (dispatchTrigger), for passives registered under several.
 */
export type PassiveHandler = (
  champion: ServerChampion,
  passiveState: PassiveState,
  definition: PassiveAbilityDefinition,
  context: ServerGameContext,
  data?: PassiveTriggerData,
  trigger?: PassiveTrigger
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
  /** "championId:passiveId" pairs already registered */
  private registeredKeys: Set<string> = new Set();
  private defaultHandlers: Map<string, PassiveHandler> = new Map();

  constructor() {
    this.initializeDefaultHandlers();
  }

  /**
   * Initialize default handlers for common passive types.
   */
  private initializeDefaultHandlers(): void {
    // Default handler for on_low_health (like Warrior's Undying Resolve)
    this.defaultHandlers.set('on_low_health_shield', handleLowHealthShield);

    // Default handler for stack-based passives (like Magnus's Arcane Surge)
    this.defaultHandlers.set('stack_accumulation', handleStackAccumulation);

    // Default handler for on_hit damage (like Vex's Assassin's Mark)
    this.defaultHandlers.set('on_hit_damage', handleOnHitDamage);

    // Default handler for on_take_damage stack (like Gorath's Immovable)
    this.defaultHandlers.set('on_take_damage_stack', handleTakeDamageStack);

    // Default handler for aura passives (like Elara's Blessed Presence)
    this.defaultHandlers.set('aura_heal', handleAuraHeal);

    // Default handler for Vile's Souls of Vilix (dual-trigger: on_kill + on_hit)
    this.defaultHandlers.set('soul_stacks', handleSoulStacks);
  }

  /**
   * Register a passive ability for a champion type.
   * Registrations are per champion type (dispatch matches champion.definition.id),
   * so registering the same passive again (every ServerChampion constructor does)
   * is a no-op - otherwise each new champion would make the passive fire once more.
   */
  registerPassive(
    championId: string,
    definition: PassiveAbilityDefinition,
    handler?: PassiveHandler
  ): void {
    const key = `${championId}:${definition.id}`;
    if (this.registeredKeys.has(key)) return;
    this.registeredKeys.add(key);

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
      handler(champion, passiveState, definition, context, data, trigger);
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
        // Stacks expired, and the stat bonus they gave goes with them (Gorath's armor)
        passiveState.stacks = 0;
        passiveState.isActive = false;
        champion.removeModifier(`passive_${champion.definition.passive}`);
      }
    }
  }

  // ==========================================================================
  // Fallback Handler (the default handlers live in systems/passives/)
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
   * Clear all registered passives.
   */
  clear(): void {
    this.triggerRegistry.clear();
    this.registeredKeys.clear();
  }
}

// Export singleton instance
export const passiveTriggerSystem = new PassiveTriggerSystem();
