/**
 * Server-side effect definitions.
 * Contains definitions needed for server-side effect calculations.
 */

import type {
  EffectCategory,
  CrowdControlType,
  StackBehavior,
  StatModificationType,
} from '@siege/shared';

/**
 * Base effect definition for server.
 */
export interface ServerEffectDefinition {
  id: string;
  name: string;
  category: EffectCategory;
  duration?: number;
  stackBehavior: StackBehavior;
  maxStacks?: number;
  cleansable: boolean;
  persistsThroughDeath: boolean;
}

/**
 * Crowd control effect definition.
 */
export interface ServerCCEffectDef extends ServerEffectDefinition {
  ccType: CrowdControlType;
}

/**
 * Stat modification effect definition.
 */
export interface ServerStatEffectDef extends ServerEffectDefinition {
  stat: StatModificationType;
  flatValue?: number;
  percentValue?: number;
}

/**
 * Over-time effect definition.
 */
export interface ServerOverTimeEffectDef extends ServerEffectDefinition {
  otType: 'damage' | 'heal' | 'mana_drain' | 'mana_restore';
  valuePerTick: number;
  tickInterval: number;
  damageType?: 'physical' | 'magic' | 'true';
}

/**
 * Shield effect definition.
 */
export interface ServerShieldEffectDef extends ServerEffectDefinition {
  shieldAmount: number;
  blocksPhysical: boolean;
  blocksMagic: boolean;
}

/**
 * Union type for all effect definitions.
 */
export type AnyServerEffectDef =
  | ServerEffectDefinition
  | ServerCCEffectDef
  | ServerStatEffectDef
  | ServerOverTimeEffectDef
  | ServerShieldEffectDef;

// ===================
// CC Effects
// ===================

export const StunEffect: ServerCCEffectDef = {
  id: 'stun',
  name: 'Stunned',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'stun',
};

export const SilenceEffect: ServerCCEffectDef = {
  id: 'silence',
  name: 'Silenced',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'silence',
};

export const RootEffect: ServerCCEffectDef = {
  id: 'root',
  name: 'Rooted',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'root',
};

export const SlowEffect: ServerCCEffectDef = {
  id: 'slow',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 5,
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'slow',
};

export const KnockupEffect: ServerCCEffectDef = {
  id: 'knockup',
  name: 'Airborne',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: false,  // Knockups can't be cleansed
  persistsThroughDeath: false,
  ccType: 'knockup',
};

export const SuppressEffect: ServerCCEffectDef = {
  id: 'suppress',
  name: 'Suppressed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: false,  // Suppression can't be cleansed except by QSS
  persistsThroughDeath: false,
  ccType: 'suppress',
};

export const BlindEffect: ServerCCEffectDef = {
  id: 'blind',
  name: 'Blinded',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'blind',
};

export const DisarmEffect: ServerCCEffectDef = {
  id: 'disarm',
  name: 'Disarmed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'disarm',
};

export const GroundedEffect: ServerCCEffectDef = {
  id: 'grounded',
  name: 'Grounded',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'grounded',
};

// ===================
// Stat Buff Effects
// ===================

export const AttackSpeedBuff: ServerStatEffectDef = {
  id: 'attack_speed_buff',
  name: 'Attack Speed Up',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.10, // +10% attack speed per stack
};

export const MovementSpeedBuff: ServerStatEffectDef = {
  id: 'movement_speed_buff',
  name: 'Speed Up',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  flatValue: 20, // +20 movement speed per stack
};

export const ArmorBuff: ServerStatEffectDef = {
  id: 'armor_buff',
  name: 'Armor Up',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  flatValue: 10, // +10 armor per stack
};

export const MagicResistBuff: ServerStatEffectDef = {
  id: 'magic_resist_buff',
  name: 'Magic Resist Up',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'magic_resist',
  flatValue: 10, // +10 MR per stack
};

export const AttackDamageBuff: ServerStatEffectDef = {
  id: 'attack_damage_buff',
  name: 'Attack Damage Up',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_damage',
  flatValue: 10, // +10 AD per stack
};

// ===================
// Stat Debuff Effects
// ===================

export const ArmorReduction: ServerStatEffectDef = {
  id: 'armor_reduction',
  name: 'Armor Reduced',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'armor',
  flatValue: -10, // -10 armor per stack
};

export const MagicResistReduction: ServerStatEffectDef = {
  id: 'magic_resist_reduction',
  name: 'Magic Resist Reduced',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 10,
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'magic_resist',
  flatValue: -10, // -10 MR per stack
};

export const MovementSpeedSlow: ServerStatEffectDef = {
  id: 'movement_speed_slow',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 5,
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.10, // -10% movement speed per stack
};

export const AttackSpeedSlow: ServerStatEffectDef = {
  id: 'attack_speed_slow',
  name: 'Attack Speed Reduced',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 5,
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: -0.10, // -10% attack speed per stack
};

// ===================
// Over-Time Effects
// ===================

export const BurnEffect: ServerOverTimeEffectDef = {
  id: 'burn',
  name: 'Burning',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  otType: 'damage',
  valuePerTick: 10,
  tickInterval: 0.5,
  damageType: 'magic',
};

export const PoisonEffect: ServerOverTimeEffectDef = {
  id: 'poison',
  name: 'Poisoned',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 5,
  cleansable: true,
  persistsThroughDeath: false,
  otType: 'damage',
  valuePerTick: 5,
  tickInterval: 1.0,
  damageType: 'magic',
};

export const BleedEffect: ServerOverTimeEffectDef = {
  id: 'bleed',
  name: 'Bleeding',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 5,
  cleansable: true,
  persistsThroughDeath: false,
  otType: 'damage',
  valuePerTick: 8,
  tickInterval: 0.5,
  damageType: 'physical',
};

export const HealingOverTime: ServerOverTimeEffectDef = {
  id: 'healing_over_time',
  name: 'Regenerating',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: 3,
  cleansable: false,
  persistsThroughDeath: false,
  otType: 'heal',
  valuePerTick: 10,
  tickInterval: 0.5,
};

// ===================
// Ability-Specific Effects
// ===================

// Slow effects at specific percentages
export const Slow30Effect: ServerStatEffectDef = {
  id: 'slow_30',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.30, // -30% movement speed
};

export const Slow40Effect: ServerStatEffectDef = {
  id: 'slow_40',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.40, // -40% movement speed
};

// Speed buffs at specific percentages
export const Speed20Effect: ServerStatEffectDef = {
  id: 'speed_20',
  name: 'Hastened',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.20, // +20% movement speed
};

export const Speed30Effect: ServerStatEffectDef = {
  id: 'speed_30',
  name: 'Hastened',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.30, // +30% movement speed
};

// Taunt CC effect
export const TauntEffect: ServerCCEffectDef = {
  id: 'taunt',
  name: 'Taunted',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'taunt',
};

// Gorath's Fortify buff (armor + MR)
// This is a special composite effect, we'll handle it as a stat effect
export const GorathFortifyBuff: ServerStatEffectDef = {
  id: 'gorath_fortify_buff',
  name: 'Stone Skin',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor', // Primary stat
  percentValue: 0.30, // +30% armor
  // Note: For MR, we'll need to apply a separate effect or handle in code
};

// Gorath's Fortify buff - Magic Resist portion
export const GorathFortifyMRBuff: ServerStatEffectDef = {
  id: 'gorath_fortify_mr_buff',
  name: 'Stone Skin',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'magic_resist',
  percentValue: 0.30, // +30% magic resist
};

// Vex's mark for tracking damage
export const VexMarkEffect: ServerEffectDefinition = {
  id: 'vex_mark',
  name: 'Marked',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
};

// Vex's stealth effect
export const VexStealthEffect: ServerEffectDefinition = {
  id: 'vex_stealth',
  name: 'Shadow Shroud',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Vex's death mark (ultimate)
export const VexDeathMarkEffect: ServerEffectDefinition = {
  id: 'vex_death_mark',
  name: 'Death Mark',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: false, // Cannot be cleansed
  persistsThroughDeath: false,
};

// ===================
// Effect Registry
// ===================

export const ALL_SERVER_EFFECTS: AnyServerEffectDef[] = [
  // CC
  StunEffect,
  SilenceEffect,
  RootEffect,
  SlowEffect,
  KnockupEffect,
  SuppressEffect,
  BlindEffect,
  DisarmEffect,
  GroundedEffect,
  TauntEffect,
  // Stat buffs
  AttackSpeedBuff,
  MovementSpeedBuff,
  ArmorBuff,
  MagicResistBuff,
  AttackDamageBuff,
  Speed20Effect,
  Speed30Effect,
  GorathFortifyBuff,
  GorathFortifyMRBuff,
  // Stat debuffs
  ArmorReduction,
  MagicResistReduction,
  MovementSpeedSlow,
  AttackSpeedSlow,
  Slow30Effect,
  Slow40Effect,
  // Over-time
  BurnEffect,
  PoisonEffect,
  BleedEffect,
  HealingOverTime,
  // Ability-specific markers
  VexMarkEffect,
  VexStealthEffect,
  VexDeathMarkEffect,
];

const EFFECT_BY_ID = new Map<string, AnyServerEffectDef>(
  ALL_SERVER_EFFECTS.map(effect => [effect.id, effect])
);

/**
 * Get an effect definition by ID.
 */
export function getServerEffectById(id: string): AnyServerEffectDef | undefined {
  return EFFECT_BY_ID.get(id);
}

/**
 * Check if an effect is a CC effect.
 */
export function isCCEffect(effect: AnyServerEffectDef): effect is ServerCCEffectDef {
  return 'ccType' in effect;
}

/**
 * Check if an effect is a stat effect.
 */
export function isStatEffect(effect: AnyServerEffectDef): effect is ServerStatEffectDef {
  return 'stat' in effect && !('otType' in effect);
}

/**
 * Check if an effect is an over-time effect.
 */
export function isOverTimeEffect(effect: AnyServerEffectDef): effect is ServerOverTimeEffectDef {
  return 'otType' in effect;
}

/**
 * Check if an effect is a shield effect.
 */
export function isShieldEffect(effect: AnyServerEffectDef): effect is ServerShieldEffectDef {
  return 'shieldAmount' in effect;
}
