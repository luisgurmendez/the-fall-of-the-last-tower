/**
 * Type definitions for the effects/status system.
 */

import type { Champion } from '@/champions/Champion';

/**
 * Categories of effects.
 */
export type EffectCategory =
  | 'buff'       // Positive effect
  | 'debuff'     // Negative effect
  | 'neutral';   // Neither (e.g., mark for tracking)

/**
 * Types of crowd control effects.
 * Simplified for MVP: stun, silence, grounded
 */
export type CrowdControlType =
  | 'stun'       // Cannot move, attack, or cast
  | 'silence'    // Cannot cast abilities
  | 'grounded';  // Cannot use movement abilities (can still walk)

/**
 * Types of stat modification effects.
 */
export type StatModificationType =
  | 'attack_damage'
  | 'ability_power'
  | 'armor'
  | 'magic_resist'
  | 'attack_speed'
  | 'movement_speed'
  | 'health_regen'
  | 'mana_regen'
  | 'crit_chance'
  | 'crit_damage'
  | 'lifesteal'
  | 'spell_vamp'
  | 'armor_penetration'
  | 'magic_penetration';

/**
 * Types of over-time effects.
 */
export type OverTimeType =
  | 'damage'     // Damage over time (DoT)
  | 'heal'       // Heal over time (HoT)
  | 'mana_drain' // Mana drain over time
  | 'mana_restore'; // Mana restore over time

/**
 * How effects stack when multiple instances are applied.
 */
export type StackBehavior =
  | 'refresh'    // New application refreshes duration
  | 'extend'     // New application extends duration
  | 'stack'      // Multiple instances can exist
  | 'replace'    // New application replaces old
  | 'ignore';    // New application has no effect

/**
 * Base effect definition.
 */
export interface EffectDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Icon identifier for UI */
  icon?: string;

  /** Buff, debuff, or neutral */
  category: EffectCategory;

  /** Duration in seconds (undefined = permanent until removed) */
  duration?: number;

  /** How the effect stacks */
  stackBehavior: StackBehavior;

  /** Maximum stacks (for stackable effects) */
  maxStacks?: number;

  /** Whether the effect can be cleansed/removed */
  cleansable: boolean;

  /** Whether the effect persists through death */
  persistsThroughDeath: boolean;
}

/**
 * Crowd control effect definition.
 */
export interface CrowdControlEffect extends EffectDefinition {
  /** Type of CC: stun, silence, or grounded */
  ccType: CrowdControlType;
}

/**
 * Stat modification effect definition.
 */
export interface StatModificationEffect extends EffectDefinition {
  /** Which stat to modify */
  stat: StatModificationType;

  /** Flat value change */
  flatValue?: number;

  /** Percentage change (0.1 = +10%, -0.1 = -10%) */
  percentValue?: number;
}

/**
 * Over-time effect definition.
 */
export interface OverTimeEffect extends EffectDefinition {
  /** Type of over-time effect */
  otType: OverTimeType;

  /** Value per tick */
  valuePerTick: number;

  /** Time between ticks in seconds */
  tickInterval: number;

  /** Damage type (for DoT) */
  damageType?: 'physical' | 'magic' | 'true';
}

/**
 * Shield effect definition.
 */
export interface ShieldEffect extends EffectDefinition {
  /** Shield amount */
  shieldAmount: number;

  /** Types of damage the shield blocks */
  blocksPhysical: boolean;
  blocksMagic: boolean;
}

/**
 * Runtime state of an active effect on a champion.
 */
export interface ActiveEffect {
  /** The effect definition */
  definition: EffectDefinition;

  /** Source champion who applied the effect (optional for environment/system effects) */
  source?: Champion;

  /** Time remaining in seconds */
  timeRemaining: number;

  /** Current stack count */
  stacks: number;

  /** For shields: remaining shield amount */
  shieldRemaining?: number;

  /** For over-time: time until next tick */
  nextTickIn?: number;

  /** Unique instance ID (for tracking) (optional, auto-generated if not provided) */
  instanceId?: string;
}

/**
 * Summary of crowd control effects on a champion.
 * Simplified for MVP.
 */
export interface CrowdControlStatus {
  /** Cannot move, attack, or cast */
  isStunned: boolean;

  /** Cannot cast abilities */
  isSilenced: boolean;

  /** Cannot use movement abilities */
  isGrounded: boolean;

  /** Whether the champion can move */
  canMove: boolean;

  /** Whether the champion can attack */
  canAttack: boolean;

  /** Whether the champion can cast abilities */
  canCast: boolean;

  /** Whether the champion can use movement abilities (dashes, blinks) */
  canUseMobilityAbilities: boolean;
}

/**
 * Compute crowd control status from active effects.
 */
export function computeCCStatus(effects: ActiveEffect[]): CrowdControlStatus {
  const status: CrowdControlStatus = {
    isStunned: false,
    isSilenced: false,
    isGrounded: false,
    canMove: true,
    canAttack: true,
    canCast: true,
    canUseMobilityAbilities: true,
  };

  for (const effect of effects) {
    const def = effect.definition as CrowdControlEffect;
    if (!('ccType' in def)) continue;

    switch (def.ccType) {
      case 'stun':
        status.isStunned = true;
        break;
      case 'silence':
        status.isSilenced = true;
        break;
      case 'grounded':
        status.isGrounded = true;
        break;
    }
  }

  // Compute ability to act
  status.canMove = !status.isStunned;
  status.canAttack = !status.isStunned;
  status.canCast = !status.isStunned && !status.isSilenced;
  status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;

  return status;
}
