/**
 * Type definitions for the effects/status system.
 * Shared between client and server.
 */

/**
 * Categories of effects.
 */
export type EffectCategory =
  | 'buff'       // Positive effect
  | 'debuff'     // Negative effect
  | 'neutral';   // Neither (e.g., mark for tracking)

/**
 * Types of crowd control effects.
 */
export type CrowdControlType =
  | 'stun'       // Cannot move, attack, or cast
  | 'silence'    // Cannot cast abilities
  | 'grounded'   // Cannot use movement abilities (can still walk)
  | 'root'       // Cannot move but can attack and cast
  | 'blind'      // Basic attacks miss
  | 'disarm'     // Cannot basic attack
  | 'slow'       // Reduced movement speed
  | 'knockup'    // Displaced upward, cannot act
  | 'knockback'  // Pushed away from source
  | 'fear'       // Forced to move away
  | 'charm'      // Forced to move toward source
  | 'taunt'      // Forced to attack source
  | 'sleep'      // Like stun, but breaks on damage
  | 'suppress';  // Complete lockdown, can't be reduced

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
  | 'damage'       // Damage over time (DoT)
  | 'heal'         // Heal over time (HoT)
  | 'mana_drain'   // Mana drain over time
  | 'mana_restore';// Mana restore over time

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
 * Base effect definition (static data).
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
export interface CrowdControlEffectDef extends EffectDefinition {
  /** Type of CC */
  ccType: CrowdControlType;
}

/**
 * Stat modification effect definition.
 */
export interface StatModificationEffectDef extends EffectDefinition {
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
export interface OverTimeEffectDef extends EffectDefinition {
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
export interface ShieldEffectDef extends EffectDefinition {
  /** Shield amount */
  shieldAmount: number;

  /** Types of damage the shield blocks */
  blocksPhysical: boolean;
  blocksMagic: boolean;
}

/**
 * Runtime state of an active effect (for network sync).
 */
export interface ActiveEffectState {
  /** Effect definition ID */
  definitionId: string;

  /** Source entity ID (who applied the effect) */
  sourceId?: string;

  /** Time remaining in seconds */
  timeRemaining: number;

  /** Current stack count */
  stacks: number;

  /** For shields: remaining shield amount */
  shieldRemaining?: number;

  /** For over-time: time until next tick */
  nextTickIn?: number;

  /** Unique instance ID (for tracking) */
  instanceId: string;
}

/**
 * Summary of crowd control effects on a unit.
 */
export interface CrowdControlStatus {
  /** Cannot move, attack, or cast */
  isStunned: boolean;

  /** Cannot cast abilities */
  isSilenced: boolean;

  /** Cannot use movement abilities */
  isGrounded: boolean;

  /** Cannot move at all */
  isRooted: boolean;

  /** Cannot basic attack */
  isDisarmed: boolean;

  /** Whether the unit can move */
  canMove: boolean;

  /** Whether the unit can attack */
  canAttack: boolean;

  /** Whether the unit can cast abilities */
  canCast: boolean;

  /** Whether the unit can use movement abilities (dashes, blinks) */
  canUseMobilityAbilities: boolean;
}

/**
 * Compute crowd control status from active effects.
 */
export function computeCCStatus(effects: ActiveEffectState[], getDefinition: (id: string) => EffectDefinition | undefined): CrowdControlStatus {
  const status: CrowdControlStatus = {
    isStunned: false,
    isSilenced: false,
    isGrounded: false,
    isRooted: false,
    isDisarmed: false,
    canMove: true,
    canAttack: true,
    canCast: true,
    canUseMobilityAbilities: true,
  };

  for (const effect of effects) {
    const def = getDefinition(effect.definitionId) as CrowdControlEffectDef | undefined;
    if (!def || !('ccType' in def)) continue;

    switch (def.ccType) {
      case 'stun':
      case 'knockup':
      case 'knockback':
      case 'suppress':
        status.isStunned = true;
        break;
      case 'silence':
        status.isSilenced = true;
        break;
      case 'grounded':
        status.isGrounded = true;
        break;
      case 'root':
        status.isRooted = true;
        break;
      case 'disarm':
      case 'blind':
        status.isDisarmed = true;
        break;
    }
  }

  // Compute ability to act
  status.canMove = !status.isStunned && !status.isRooted;
  status.canAttack = !status.isStunned && !status.isDisarmed;
  status.canCast = !status.isStunned && !status.isSilenced;
  status.canUseMobilityAbilities = status.canMove && status.canCast && !status.isGrounded;

  return status;
}

/**
 * Create default CC status (no effects).
 */
export function defaultCCStatus(): CrowdControlStatus {
  return {
    isStunned: false,
    isSilenced: false,
    isGrounded: false,
    isRooted: false,
    isDisarmed: false,
    canMove: true,
    canAttack: true,
    canCast: true,
    canUseMobilityAbilities: true,
  };
}
