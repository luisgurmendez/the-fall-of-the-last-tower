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

// Vex's death mark (ultimate)
export const VexDeathMarkEffect: ServerEffectDefinition = {
  id: 'vex_death_mark',
  name: 'Death Mark',
  category: 'debuff',
  stackBehavior: 'refresh',
  cleansable: false, // Cannot be cleansed
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

// Vile W - Post-veil slow resistance (reduces incoming slows by 50%)
export const VileSlowResistEffect: ServerStatEffectDef = {
  id: 'vile_slow_resist',
  name: 'Dark Resilience',
  category: 'buff',
  stackBehavior: 'refresh',
  cleansable: false,
  persistsThroughDeath: false,
  stat: 'movement_speed', // Note: slow resist is tracked separately in effect processing
  flatValue: 0, // Marker effect - slow resist handled in CC calculation
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

// Vile R - Transform aura damage marker (actual damage handled separately)
export const VileTransformAuraEffect: ServerEffectDefinition = {
  id: 'vile_transform_aura',
  name: 'Restoration of Vilix',
  category: 'buff',
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

// Lume Passive - Damage amplification debuff for enemies near orb
// Note: This effect marks enemies for increased magic damage from Lume
// The actual damage amp is calculated in damage calculation
export const LumeGuidingGlowAmpEffect: ServerEffectDefinition & { damageAmpMagic: number } = {
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
  flatValue: 4,
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
  flatValue: 5,
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
  VexDeathMarkEffect,
  VexEmpoweredEffect,
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
  VileTransformAuraEffect,
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
