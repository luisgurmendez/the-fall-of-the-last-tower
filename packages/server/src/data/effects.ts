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
import { CALAMITUS_LAVA, PROTOBOT_MACHINE, ZHAKRUL_VENOM } from '@siege/shared';

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
  /** Share less healing the holder receives while it lasts (Wounds) */
  healingReduction?: number;
  /** Share of every slow on the holder it shrugs off while it lasts (ChampionStats) */
  slowResist?: number;
  /** Share more magic damage the holder takes from the effect's source while it lasts (ChampionEffects) */
  damageAmpMagic?: number;
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
  /** More stats it changes the same way (an aura's armor and magic resist) */
  alsoModifies?: Array<{ stat: StatModificationType; flatValue?: number; percentValue?: number }>;
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

// Hop-To-Eat's Rodent Fangs (Q): another bite refreshes it, it doesn't stack
export const ArmorReduction: ServerStatEffectDef = {
  id: 'armor_reduction',
  name: 'Armor Reduced',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'armor',
  flatValue: -10,
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
export const Slow10Effect: ServerStatEffectDef = {
  id: 'slow_10',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.10, // -10% movement speed
};

export const Slow20Effect: ServerStatEffectDef = {
  id: 'slow_20',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.20, // -20% movement speed
};

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

// Gorath's Stone Skin (W): +30% armor (gorath_fortify_mr_buff is its magic resist)
export const GorathFortifyBuff: ServerStatEffectDef = {
  id: 'gorath_fortify_buff',
  name: 'Stone Skin',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  percentValue: 0.30, // +30% armor
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

// Warrior's Undying Resolve armor buff
export const WarriorUndyingResolveEffect: ServerStatEffectDef = {
  id: 'warrior_undying_resolve',
  name: 'Undying Resolve',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  percentValue: 0.20, // +20% armor
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

// Vex's empowered attack buff (from Shadow Step E)
export const VexEmpoweredEffect: ServerEffectDefinition = {
  id: 'vex_empowered',
  name: 'Shadow Step',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Elora's Poison Arrow (Q): her next basic attack is poisoned (EloraHooks)
export const EloraPoisonArrowEffect: ServerEffectDefinition = {
  id: 'elora_poison_arrow',
  name: 'Poison Arrow',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Poison Arrow's poison on its target: the damage ticks come from EloraHooks (scaled by Q's rank)
export const EloraVenomEffect: ServerEffectDefinition = {
  id: 'elora_venom',
  name: 'Venom',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
};

// Elora's Dexterity (E): she attacks faster after the roll
export const EloraDexterityEffect: ServerStatEffectDef = {
  id: 'elora_dexterity',
  name: 'Dexterity',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.35,
};

// Caelum's Embolden (W): more attack damage and ability power
export const CaelumEmboldenEffect: ServerStatEffectDef = {
  id: 'caelum_embolden',
  name: 'Emboldened',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_damage',
  percentValue: 0.2,
};

export const CaelumEmboldenPowerEffect: ServerStatEffectDef = {
  id: 'caelum_embolden_power',
  name: 'Emboldened',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'ability_power',
  percentValue: 0.2,
};

// Fenris's Adrenaline Rush (passive): feral under 40% health (FenrisHooks), and faster
export const FenrisFeralEffect: ServerStatEffectDef = {
  id: 'fenris_feral',
  name: 'Feral',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.12,
};

// Fenris's Bloodthirst (R): faster attacks; the life steal and the kill's heal are in FenrisHooks
export const FenrisBloodthirstEffect: ServerStatEffectDef = {
  id: 'fenris_bloodthirst',
  name: 'Bloodthirst',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.35,
};

// Calamitus's Lavaborn (passive): armor and magic resist while he stands in
// his lava (one effect, so one icon)
export const CalamitusLavabornEffect: ServerStatEffectDef = {
  id: 'calamitus_lavaborn',
  name: 'Lavaborn',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  flatValue: CALAMITUS_LAVA.resists,
  alsoModifies: [{ stat: 'magic_resist', flatValue: CALAMITUS_LAVA.resists }],
};

// Oitboil's Overheat (passive): 25% more damage (his attacks through attack
// damage, his abilities through OitboilHooks) while the fire burns him
export const OitboilOverheatedEffect: ServerStatEffectDef = {
  id: 'oitboil_overheated',
  name: 'Overheated',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_damage',
  percentValue: 0.25,
};

// Oitboil's Flamethrower (R): the stream (clients draw it), rooting him...
export const OitboilFlamethrowerEffect: ServerCCEffectDef = {
  id: 'oitboil_flamethrower',
  name: 'Flamethrower',
  category: 'neutral',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  ccType: 'root',
};

// ...then exhausted: no abilities and no attacks, through the stream too
export const OitboilExhaustedEffect: ServerCCEffectDef = {
  id: 'oitboil_exhausted',
  name: 'Exhausted',
  category: 'neutral',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  ccType: 'silence',
};

export const OitboilExhaustedDisarmEffect: ServerCCEffectDef = {
  id: 'oitboil_exhausted_disarm',
  name: 'Exhausted',
  category: 'neutral',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  ccType: 'disarm',
};

// Protobot's Machine Learning (passive): each lesson is a stack of armor and
// magic resist (ProtobotHooks; one effect, so one icon)
export const ProtobotLearningEffect: ServerStatEffectDef = {
  id: 'protobot_learning',
  name: 'Machine Learning',
  category: 'buff',
  stackBehavior: 'stack',
  maxStacks: PROTOBOT_MACHINE.maxLessons,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  flatValue: PROTOBOT_MACHINE.resistsPerLesson,
  alsoModifies: [{ stat: 'magic_resist', flatValue: PROTOBOT_MACHINE.resistsPerLesson }],
};

// Hop-To-Eat's Carrot Break (W): it can't move while it eats...
export const HopEatingEffect: ServerCCEffectDef = {
  id: 'hop_eating',
  name: 'Eating',
  category: 'neutral',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  ccType: 'root',
};

// ...then attacks faster
export const HopSugarRushEffect: ServerStatEffectDef = {
  id: 'hop_sugar_rush',
  name: 'Sugar Rush',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.3,
};

// Zhak'rul's Ancient Venom (passive): the doses on an enemy, for its status
// icons (the damage ticks come from ZhakrulHooks, which also poison monsters)
export const ZhakrulVenomEffect: ServerEffectDefinition = {
  id: 'zhakrul_venom',
  name: 'Ancient Venom',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: ZHAKRUL_VENOM.maxStacks,
  cleansable: true,
  persistsThroughDeath: false,
};

// At three doses the venom turns ancient and burns harder (ZhakrulHooks)
export const ZhakrulAncientVenomEffect: ServerEffectDefinition = {
  id: 'zhakrul_ancient_venom',
  name: 'Ancient Venom (ancient)',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
};

// Lume's Prismatic Beam (E): a beam runs from her to the orb while it lasts (LumeHooks)
export const LumePrismEffect: ServerEffectDefinition = {
  id: 'lume_prism',
  name: 'Prismatic Beam',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Urûk's Spear Charge (W): his next basic attack is empowered (UrukHooks)
export const UrukSpearChargeEffect: ServerEffectDefinition = {
  id: 'uruk_spear_charge',
  name: 'Spear Charge',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Urûk's Spear Charge (W): his physical damage pierces armor (UrukHooks.getArmorPenetration, by W's rank)
export const UrukPiercingEffect: ServerEffectDefinition = {
  id: 'uruk_piercing',
  name: 'Piercing',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Urûk's Hunter's Instinct (passive): near a hurt enemy champion
export const UrukHuntEffect: ServerStatEffectDef = {
  id: 'uruk_hunt',
  name: "Hunter's Instinct",
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.12,
};

export const UrukHuntSpeedEffect: ServerStatEffectDef = {
  id: 'uruk_hunt_speed',
  name: "Hunter's Instinct",
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.10,
};

// Vex's Ninja Mode buff (ultimate)
export const VexNinjaModeEffect: ServerEffectDefinition = {
  id: 'vex_ninja_mode',
  name: 'Ninja Mode',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// ===================
// Vile Effects
// ===================

// Vile Q - Slow effect (50% slow)
export const VileQSlowEffect: ServerStatEffectDef = {
  id: 'vile_q_slow',
  name: 'Black Arrow',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.50, // -50% movement speed
};

// Vile W - Invulnerability (cannot take damage)
export const VileInvulnerableEffect: ServerEffectDefinition & { grantsInvulnerability: boolean } = {
  id: 'vile_invulnerable',
  name: 'Veil of Darkness',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  grantsInvulnerability: true,
};

// Vile W - Self-root (cannot move during stealth)
export const VileRootedSelfEffect: ServerCCEffectDef = {
  id: 'vile_rooted_self',
  name: 'Veil of Darkness',
  category: 'debuff', // Self-debuff
  stackBehavior: 'refresh',
  cleansable: false, // Cannot cleanse own ability
  persistsThroughDeath: false,
  ccType: 'root',
};

// Vile W - Stealth effect
export const VileStealthEffect: ServerEffectDefinition = {
  id: 'vile_stealth',
  name: 'Veil of Darkness',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// Vile W - Post-veil speed buff (+50% MS)
export const VilePostVeilSpeedEffect: ServerStatEffectDef = {
  id: 'vile_post_veil_speed',
  name: 'Dark Swiftness',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.50, // +50% movement speed
};

// Vile W - Post-veil slow resistance: slows on him are halved
export const VileSlowResistEffect: ServerEffectDefinition = {
  id: 'vile_slow_resist',
  name: 'Dark Resilience',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  slowResist: 0.5,
};

// Vile E - Root effect from trap trigger
export const VileRootEffect: ServerCCEffectDef = {
  id: 'vile_root',
  name: 'Roots of Vilix',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  ccType: 'root',
};

// Caught by one of Vile's traps: no other trap catches this champion for a while (ServerTrap)
export const VileTrapCaughtEffect: ServerEffectDefinition = {
  id: 'vile_trap_caught',
  name: 'Caught',
  category: 'neutral',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// ===================
// Lume Effects
// ===================

// Lume Passive - Movement speed buff for allies near orb
export const LumeGuidingGlowSpeedEffect: ServerStatEffectDef = {
  id: 'lume_guiding_glow_speed',
  name: 'Guiding Glow',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.15, // +15% movement speed
};

// Lume Passive - Damage amplification debuff for enemies near orb: they take
// more magic damage from Lume (its source), in ServerChampion.takeDamage
export const LumeGuidingGlowAmpEffect: ServerEffectDefinition = {
  id: 'lume_guiding_glow_amp',
  name: 'Exposed by Light',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  damageAmpMagic: 0.08, // +8% magic damage taken from Lume
};

// ===================
// Effect Registry
// ===================

// ===================
// Jungle Buffs (granted for killing buff camps and the dragon)
// ===================

/** Blue buff: cooldowns */
export const CrestOfInsightEffect: ServerStatEffectDef = {
  id: 'crest_of_insight',
  name: 'Crest of Insight',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'ability_haste',
  flatValue: 15,
};

/** Blue buff: mana/energy regeneration */
export const CrestOfInsightRegenEffect: ServerStatEffectDef = {
  id: 'crest_of_insight_regen',
  name: 'Crest of Insight',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'mana_regen',
  flatValue: 4,
};

/** Red buff: health regeneration; basic attacks burn and slow (see ChampionBasicAttacks.applyOnHitBuffs) */
export const CrestOfCindersEffect: ServerStatEffectDef = {
  id: 'crest_of_cinders',
  name: 'Crest of Cinders',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'health_regen',
  flatValue: 1.5,
};

/** Red buff on-hit burn */
export const CindersBurnEffect: ServerOverTimeEffectDef = {
  id: 'cinders_burn',
  name: 'Cinders',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  otType: 'damage',
  valuePerTick: 6,
  tickInterval: 0.5,
  damageType: 'true',
};

/** Dragon: team-wide attack damage */
export const DragonsMightEffect: ServerStatEffectDef = {
  id: 'dragons_might',
  name: "Dragon's Might",
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'attack_damage',
  percentValue: 0.08,
};

/** Dragon: team-wide ability power */
export const DragonsMightPowerEffect: ServerStatEffectDef = {
  id: 'dragons_might_power',
  name: "Dragon's Might",
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'ability_power',
  percentValue: 0.08,
};

/** Rootwyrm (Heartwood Pact): team-wide armor */
export const HeartwoodPactEffect: ServerStatEffectDef = {
  id: 'heartwood_pact',
  name: 'Heartwood Pact',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'armor',
  flatValue: 12,
};

/** Rootwyrm: team-wide magic resist */
export const HeartwoodPactWardEffect: ServerStatEffectDef = {
  id: 'heartwood_pact_ward',
  name: 'Heartwood Pact',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'magic_resist',
  flatValue: 12,
};

/** Rootwyrm: team-wide health regeneration */
export const HeartwoodPactSapEffect: ServerStatEffectDef = {
  id: 'heartwood_pact_sap',
  name: 'Heartwood Pact',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'health_regen',
  flatValue: 2,
};

// ===================
// Item passives: markers with no stats, so the HUD and the champion's aura
// show a passive's state (ChampionItemPassives applies and removes them)
// ===================

/** Starfall Diadem: the next basic attack is charged */
export const StarfallEffect: ServerEffectDefinition = {
  id: 'item_starfall',
  name: 'Starfall',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

/** Ironheart Talisman: the low-health shield is up */
export const HoldTheLineEffect: ServerEffectDefinition = {
  id: 'item_hold_the_line',
  name: 'Hold the Line',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// ===================
// Item effects (config/items.ts; ChampionItemPassives and ChampionItemActives)
// ===================

/** Bramblehook, Witherquill, thorns...: heals 40% less */
export const WoundsEffect: ServerEffectDefinition = {
  id: 'wounds',
  name: 'Wounds',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  healingReduction: 0.4,
};

/** An item burn on the champion (the damage is dealt by the source's item passives) */
export const ItemBurnEffect: ServerEffectDefinition = {
  id: 'item_burn',
  name: 'Burning',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
};

/** Frostwyrm Scepter's Rime */
export const Slow25Effect: ServerStatEffectDef = {
  id: 'slow_25',
  name: 'Slowed',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.25,
};

/** Sundering Axe: 5% less armor a stack */
export const SunderEffect: ServerStatEffectDef = {
  id: 'item_sunder',
  name: 'Sundered',
  category: 'debuff',
  stackBehavior: 'stack',
  maxStacks: 6,
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  percentValue: -0.05,
};

/** Skirmisher's Hatchet */
export const MomentumEffect: ServerStatEffectDef = {
  id: 'item_momentum',
  name: 'Momentum',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  flatValue: 8,
};

/** Swiftstride Greaves, out of combat */
export const WanderlustEffect: ServerStatEffectDef = {
  id: 'item_wanderlust',
  name: 'Wanderlust',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  flatValue: 8,
};

/** Siegebreaker Hammer, with no ally near */
export const LoneWolfEffect: ServerStatEffectDef = {
  id: 'item_lone_wolf',
  name: 'Lone Wolf',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  flatValue: 10,
  alsoModifies: [{ stat: 'armor', flatValue: 15 }, { stat: 'magic_resist', flatValue: 15 }],
};

/** Stormstring: the next basic attack discharges */
export const StaticEffect: ServerEffectDefinition = {
  id: 'item_static',
  name: 'Static',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

/** Dawnsong Censer: attack speed (the on-hit damage is in ChampionItemPassives) */
export const HymnEffect: ServerStatEffectDef = {
  id: 'item_hymn',
  name: 'Hymn',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'attack_speed',
  percentValue: 0.2,
};

/** Warden's Standard aura */
export const RallyEffect: ServerStatEffectDef = {
  id: 'item_rally',
  name: 'Rally',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'armor',
  flatValue: 10,
  alsoModifies: [{ stat: 'magic_resist', flatValue: 10 }],
};

/** Stormward Veil: an enemy ability will be blocked */
export const VeilEffect: ServerEffectDefinition = {
  id: 'item_veil',
  name: 'Veil',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

/** Healing Draught: 120 health over 12 seconds; another draught adds 12 seconds */
export const DraughtEffect: ServerOverTimeEffectDef = {
  id: 'item_draught',
  name: 'Healing Draught',
  category: 'buff',
  stackBehavior: 'extend',
  cleansable: false,
  persistsThroughDeath: false,
  otType: 'heal',
  valuePerTick: 5,
  tickInterval: 0.5,
};

/** Wayfarer's Flask: 100 health over 10 seconds */
export const FlaskEffect: ServerOverTimeEffectDef = {
  id: 'item_flask',
  name: "Wayfarer's Flask",
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  otType: 'heal',
  valuePerTick: 5,
  tickInterval: 0.5,
};

/** Wayfarer's Flask: 40 mana over 10 seconds */
export const FlaskManaEffect: ServerOverTimeEffectDef = {
  id: 'item_flask_mana',
  name: "Wayfarer's Flask",
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  otType: 'mana_restore',
  valuePerTick: 2,
  tickInterval: 0.5,
};

/** Ironbark Elixir */
export const IronbarkEffect: ServerStatEffectDef = {
  id: 'item_ironbark',
  name: 'Ironbark Elixir',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'max_health',
  flatValue: 250,
  alsoModifies: [{ stat: 'tenacity', flatValue: 0.2 }],
};

/** Stormfury Elixir */
export const StormfuryEffect: ServerStatEffectDef = {
  id: 'item_stormfury',
  name: 'Stormfury Elixir',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: true,
  stat: 'attack_damage',
  flatValue: 18,
  alsoModifies: [{ stat: 'ability_power', flatValue: 30 }],
};

/** Hourglass of Stillness: invulnerable, and can't move, attack or cast */
export const StasisEffect: ServerCCEffectDef & { grantsInvulnerability: boolean } = {
  id: 'item_stasis',
  name: 'Stillness',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  ccType: 'stasis',
  grantsInvulnerability: true,
};

/** Freeblade Scimitar: the burst of speed after Unchain */
export const UnchainSpeedEffect: ServerStatEffectDef = {
  id: 'item_unchain_speed',
  name: 'Unchained',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.4,
};

/** Frostguard Plate's Frost Nova */
export const FrostNovaEffect: ServerStatEffectDef = {
  id: 'item_frost_nova',
  name: 'Frost Nova',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.55,
};

/** Vile's R: transformed (no stats; the transform applies its own) */
export const VileTransformedEffect: ServerEffectDefinition = {
  id: 'vile_transformed',
  name: 'Restoration of Vilix',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
};

// ===================
// Summoner Spells (see @siege/shared summoners.ts and ChampionSummoners)
// ===================

export const SummonerHasteEffect: ServerStatEffectDef = {
  id: 'summoner_haste',
  name: 'Haste',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.35,
};

export const SummonerMendSpeedEffect: ServerStatEffectDef = {
  id: 'summoner_mend_speed',
  name: 'Mended',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: 0.3,
};

/** True damage over time: 1 per tick per stack (Scorch sets the stacks from the caster's level); also cuts healing (ServerChampion.heal) */
export const SummonerScorchEffect: ServerOverTimeEffectDef = {
  id: 'summoner_scorch',
  name: 'Scorched',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  healingReduction: 0.4,
  otType: 'damage',
  valuePerTick: 1,
  tickInterval: 0.5,
  damageType: 'true',
};

export const SummonerHinderSlowEffect: ServerStatEffectDef = {
  id: 'summoner_hinder_slow',
  name: 'Hindered',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'movement_speed',
  percentValue: -0.3,
};

export const SummonerHinderAttackEffect: ServerStatEffectDef = {
  id: 'summoner_hinder_attack',
  name: 'Hindered',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'attack_damage',
  percentValue: -0.35,
};

export const SummonerHinderPowerEffect: ServerStatEffectDef = {
  id: 'summoner_hinder_power',
  name: 'Hindered',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: true,
  persistsThroughDeath: false,
  stat: 'ability_power',
  percentValue: -0.35,
};

export const ALL_SERVER_EFFECTS: AnyServerEffectDef[] = [
  // Summoner spells
  SummonerHasteEffect,
  SummonerMendSpeedEffect,
  SummonerScorchEffect,
  SummonerHinderSlowEffect,
  SummonerHinderAttackEffect,
  SummonerHinderPowerEffect,
  // Champion markers
  VileTransformedEffect,
  // Item passives
  StarfallEffect,
  HoldTheLineEffect,
  WoundsEffect,
  ItemBurnEffect,
  Slow25Effect,
  SunderEffect,
  MomentumEffect,
  WanderlustEffect,
  LoneWolfEffect,
  StaticEffect,
  HymnEffect,
  RallyEffect,
  VeilEffect,
  DraughtEffect,
  FlaskEffect,
  FlaskManaEffect,
  IronbarkEffect,
  StormfuryEffect,
  StasisEffect,
  UnchainSpeedEffect,
  FrostNovaEffect,
  // Jungle buffs
  CrestOfInsightEffect,
  CrestOfInsightRegenEffect,
  CrestOfCindersEffect,
  CindersBurnEffect,
  DragonsMightEffect,
  DragonsMightPowerEffect,
  HeartwoodPactEffect,
  HeartwoodPactWardEffect,
  HeartwoodPactSapEffect,
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
  WarriorUndyingResolveEffect,
  // Stat debuffs
  ArmorReduction,
  MagicResistReduction,
  MovementSpeedSlow,
  AttackSpeedSlow,
  Slow10Effect,
  Slow20Effect,
  Slow30Effect,
  Slow40Effect,
  // Over-time
  BurnEffect,
  PoisonEffect,
  BleedEffect,
  HealingOverTime,
  // Ability-specific markers - Vex
  VexMarkEffect,
  VexStealthEffect,
  VexEmpoweredEffect,
  LumePrismEffect,
  EloraPoisonArrowEffect,
  EloraVenomEffect,
  EloraDexterityEffect,
  CaelumEmboldenEffect,
  CaelumEmboldenPowerEffect,
  FenrisFeralEffect,
  FenrisBloodthirstEffect,
  CalamitusLavabornEffect,
  OitboilOverheatedEffect,
  OitboilFlamethrowerEffect,
  OitboilExhaustedEffect,
  OitboilExhaustedDisarmEffect,
  ProtobotLearningEffect,
  HopEatingEffect,
  HopSugarRushEffect,
  ZhakrulVenomEffect,
  ZhakrulAncientVenomEffect,
  UrukSpearChargeEffect,
  UrukPiercingEffect,
  UrukHuntEffect,
  UrukHuntSpeedEffect,
  VexNinjaModeEffect,
  // Ability-specific - Vile
  VileQSlowEffect,
  VileInvulnerableEffect,
  VileRootedSelfEffect,
  VileStealthEffect,
  VilePostVeilSpeedEffect,
  VileSlowResistEffect,
  VileRootEffect,
  VileTrapCaughtEffect,
  // Ability-specific - Lume
  LumeGuidingGlowSpeedEffect,
  LumeGuidingGlowAmpEffect,
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

/**
 * Check if an effect grants invulnerability.
 */
export function isInvulnerabilityEffect(effect: AnyServerEffectDef): boolean {
  return 'grantsInvulnerability' in effect && (effect as any).grantsInvulnerability === true;
}
