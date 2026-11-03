/**
 * The item catalog: every item the shop sells, with its stats, passives and
 * actives.
 *
 * Shared by the server (purchases, stats, passives, actives) and the client
 * (shop, HUD). Icon art for each item is public/assets/items/<id>.png.
 *
 * The items are designed around counters: sustain (lifesteal, omnivamp,
 * heals) against Wounds; burst and executes against stasis, spell shields and
 * low-health shields; stacked health and armor against percent damage and
 * penetration; kiting against dashes and tenacity; crowd control against
 * cleanses. See docs/architecture/items.md.
 */

import type { ItemCategory, ItemGroup, ItemPassiveDef, ItemStats, ItemTier } from '../types/items';

/**
 * What an item passive does on the server (ChampionItemPassives); its
 * numbers are in effectData.
 */
export type ItemPassiveEffect =
  | 'on_hit_damage'          // Basic attacks deal bonus damage
  | 'spellblade'             // An ability charges the next basic attack
  | 'thorns'                 // Basic attackers take damage (and Wounds)
  | 'shield'                 // A shield when health drops low
  | 'first_strike'           // The first hit on a champion after a while hits harder
  | 'ability_burn'           // Ability damage burns champions
  | 'damage_block'           // Champions' basic attacks deal flat less
  | 'monster_hunter'         // More damage to monsters, heals on them, grows by killing them
  | 'tithe'                  // Gold for hitting champions (charges)
  | 'wounds'                 // Damage of a type inflicts Wounds (less healing)
  | 'immolate'               // Burns enemies around every second
  | 'ms_on_hit'              // Basic attacks give movement speed
  | 'out_of_combat_ms'       // Movement speed out of combat
  | 'basic_damage_reduction' // Basic attacks deal a share less
  | 'overheal_shield'        // Lifesteal past max health becomes a shield
  | 'execute'                // More damage to champions at low health
  | 'shred'                  // Physical damage strips armor (stacks)
  | 'max_health_on_hit'      // Basic attacks deal a share of the holder's max health
  | 'structure_damage'       // Basic attacks deal more to structures
  | 'lone_wolf'              // Stats with no ally near
  | 'bloodlust'              // Omnivamp doubled at low health
  | 'giant_slayer'           // More damage to champions with more health
  | 'current_health_on_hit'  // Basic attacks deal a share of the target's current health
  | 'nth_hit'                // Every nth basic attack deals bonus damage
  | 'energize'               // Moving and attacking charge a big hit that chains
  | 'ability_slow'           // Ability damage slows
  | 'ap_amp'                 // Ability power raised by a share
  | 'spell_shield'           // Blocks an enemy champion's ability
  | 'heal_received'          // Heals and shields received are stronger
  | 'ally_aura'              // Allies near get stats
  | 'ally_buff_on_heal'      // Healing or shielding an ally buffs both
  | 'echo_heal'              // Heals and shields on an ally heal another ally
  | 'stacking'               // Stacks from takedowns (or kills) add a stat
  | 'mana_to_ap'             // Ability power from max mana
  | 'crit_reduction';        // Critical strikes deal less to the holder

/**
 * An item passive: its display data plus what the server does with it
 * (effectType and effectData).
 */
export interface ItemPassiveData extends ItemPassiveDef {
  effectType: ItemPassiveEffect;
  effectData: Record<string, number | string>;
  /**
   * Passives with the same key apply once however many items carry them; the
   * one on the most expensive item wins. Defaults to the passive's id.
   */
  stackKey?: string;
}

/** What an item active does on the server (ChampionItemActives) */
export type ItemActiveEffect =
  | 'potion'        // Heal (and mana) over time
  | 'elixir'        // Long buff; one elixir at a time
  | 'cleanse'       // Remove crowd control and slows
  | 'stasis'        // Invulnerable and frozen
  | 'dash'          // Blink toward a point (and hit where you land)
  | 'shield_allies' // Shield allies around
  | 'frost_nova'    // Slow enemies around
  | 'heal_area';    // Heal allies (and hit enemies) at a point after a delay

/**
 * An item active: used with the item's key (1, 2, 3, 6, 7, 8 by slot).
 * Actives with the same id share a cooldown.
 */
export interface ItemActiveData {
  id: string;
  name: string;
  description: string;
  /** Seconds */
  cooldown: number;
  /** self: on the champion; point: at the cursor (clamped to range) */
  targeting: 'self' | 'point';
  range?: number;
  effectType: ItemActiveEffect;
  effectData: Record<string, number | string>;
}

/**
 * Potions, flasks and elixirs: their uses, and whether they're gone when
 * used up.
 */
export interface ConsumableData {
  /** Most uses one slot holds (a stack of potions) */
  maxCharges: number;
  /** Uses each purchase adds */
  chargesPerPurchase: number;
  /** Refills to maxCharges at the fountain (and isn't used up) */
  refills?: boolean;
}

/**
 * An item in the catalog.
 */
export interface ItemCatalogEntry {
  id: string;
  name: string;
  category: ItemCategory;
  tier: ItemTier;
  /** Can't be held with another item of the group (one pair of boots...) */
  group?: ItemGroup;
  cost: number;
  sellValue: number;
  stats: ItemStats;
  passives: ItemPassiveData[];
  active?: ItemActiveData;
  consumable?: ConsumableData;
  isUnique: boolean;
  /**
   * Items this one is built from (see itemTrees.ts). A part can appear more
   * than once. `cost` is the full price; owned parts are taken off it.
   */
  buildsFrom?: string[];
}

type ItemInput = Omit<ItemCatalogEntry, 'sellValue' | 'passives' | 'isUnique'> &
  Partial<Pick<ItemCatalogEntry, 'sellValue' | 'passives' | 'isUnique'>>;

/**
 * An item, with the usual defaults: sells for 70% (starters and consumables
 * for 40%), no passives, legendary items unique.
 */
function item(input: ItemInput): ItemCatalogEntry {
  const cheap = input.tier === 'starter' || input.tier === 'consumable';
  return {
    sellValue: Math.round(input.cost * (cheap ? 0.4 : 0.7)),
    passives: [],
    isUnique: input.tier === 'legendary',
    ...input,
  };
}

/** A passive with the usual defaults: always on, no cooldown, unique */
function passive(
  id: string,
  name: string,
  description: string,
  effectType: ItemPassiveEffect,
  effectData: Record<string, number | string> = {},
  extra: Partial<ItemPassiveData> = {},
): ItemPassiveData {
  return { id, name, description, trigger: 'always', cooldown: 0, isUnique: true, effectType, effectData, ...extra };
}

// =============================================================================
// Starters: one at a time (group 'starter'); with a potion they're the 300
// gold a champion starts with
// =============================================================================

const ForagerBlade = item({
  id: 'forager_blade', name: "Forager's Blade", category: 'starter', tier: 'starter', group: 'starter',
  cost: 250, stats: { attackDamage: 8, health: 70 },
  passives: [passive('opening_cut', 'Opening Cut',
    'Your first basic attack on a champion after 6 seconds without hitting one deals 20 bonus physical damage.',
    'first_strike', { damage: 20, idle: 6, damageType: 'physical' })],
});

const KindlingWand = item({
  id: 'kindling_wand', name: 'Kindling Wand', category: 'starter', tier: 'starter', group: 'starter',
  cost: 250, stats: { abilityPower: 15, health: 60 },
  passives: [passive('kindle', 'Kindle',
    'Ability damage to a champion burns it for 18 magic damage over 3 seconds.',
    'ability_burn', { flat: 18, duration: 3 }, { stackKey: 'ability_burn' })],
});

const OakbarkBuckler = item({
  id: 'oakbark_buckler', name: 'Oakbark Buckler', category: 'starter', tier: 'starter', group: 'starter',
  cost: 250, stats: { health: 110, healthRegen: 0.6 },
  passives: [passive('bark', 'Bark',
    'Basic attacks from champions deal 6 less damage to you.',
    'damage_block', { amount: 6 })],
});

const SeedlingSickle = item({
  id: 'seedling_sickle', name: 'Seedling Sickle', category: 'starter', tier: 'starter', group: 'starter',
  cost: 250, stats: { healthRegen: 0.8 },
  passives: [passive('harvest', 'Harvest',
    'Your attacks and abilities deal 30% more damage to monsters, and hitting one heals you for 6 health (twice a second at most). Every monster you kill grows it: at 20 it awakens, and your basic attacks also slow champions by 20% for 1 second.',
    'monster_hunter', { bonus: 0.3, heal: 6, awaken: 20 })],
});

const PilgrimLantern = item({
  id: 'pilgrim_lantern', name: "Pilgrim's Lantern", category: 'starter', tier: 'starter', group: 'starter',
  cost: 250, stats: { abilityPower: 10, health: 50, resourceRegen: 1 },
  passives: [passive('tithe', 'Tithe',
    'Hitting an enemy champion with an attack or ability gives you 15 gold. Holds 3 charges; one comes back every 12 seconds.',
    'tithe', { gold: 15, charges: 3, recharge: 12 })],
});

// =============================================================================
// Consumables: used with the item's key; a stack lives in one slot
// =============================================================================

const HealingDraught = item({
  id: 'healing_draught', name: 'Healing Draught', category: 'consumable', tier: 'consumable',
  cost: 50, stats: {},
  consumable: { maxCharges: 5, chargesPerPurchase: 1 },
  active: {
    id: 'draught', name: 'Drink', description: 'Restores 120 health over 12 seconds. Drinking another adds 12 more seconds.',
    cooldown: 0.5, targeting: 'self', effectType: 'potion', effectData: { effects: 'item_draught', duration: 12 },
  },
});

const WayfarerFlask = item({
  id: 'wayfarer_flask', name: "Wayfarer's Flask", category: 'consumable', tier: 'consumable',
  cost: 150, stats: {},
  consumable: { maxCharges: 2, chargesPerPurchase: 2, refills: true },
  active: {
    id: 'flask', name: 'Sip', description: 'Restores 100 health and 40 mana over 10 seconds.',
    cooldown: 0.5, targeting: 'self', effectType: 'potion', effectData: { effects: 'item_flask,item_flask_mana', duration: 10 },
  },
});

const IronbarkElixir = item({
  id: 'ironbark_elixir', name: 'Ironbark Elixir', category: 'consumable', tier: 'consumable',
  cost: 350, stats: {},
  consumable: { maxCharges: 1, chargesPerPurchase: 1 },
  active: {
    id: 'ironbark', name: 'Ironbark', description: 'For 3 minutes: +250 max health and 20% tenacity. Lasts through death; one elixir at a time.',
    cooldown: 1, targeting: 'self', effectType: 'elixir', effectData: { effect: 'item_ironbark', duration: 180 },
  },
});

const StormfuryElixir = item({
  id: 'stormfury_elixir', name: 'Stormfury Elixir', category: 'consumable', tier: 'consumable',
  cost: 350, stats: {},
  consumable: { maxCharges: 1, chargesPerPurchase: 1 },
  active: {
    id: 'stormfury', name: 'Stormfury', description: 'For 3 minutes: +18 attack damage and +30 ability power. Lasts through death; one elixir at a time.',
    cooldown: 1, targeting: 'self', effectType: 'elixir', effectData: { effect: 'item_stormfury', duration: 180 },
  },
});

// =============================================================================
// Basic parts: no parts of their own
// =============================================================================

const NotchedBlade = item({ id: 'notched_blade', name: 'Notched Blade', category: 'attack_damage', tier: 'basic', cost: 350, stats: { attackDamage: 10 } });
const EmberShard = item({ id: 'ember_shard', name: 'Ember Shard', category: 'ability_power', tier: 'basic', cost: 435, stats: { abilityPower: 20 } });
const QuickdrawGloves = item({ id: 'quickdraw_gloves', name: 'Quickdraw Gloves', category: 'attack_speed', tier: 'basic', cost: 300, stats: { attackSpeed: 0.12 } });
const GleamingLens = item({ id: 'gleaming_lens', name: 'Gleaming Lens', category: 'critical', tier: 'basic', cost: 400, stats: { critChance: 0.12 } });
const PaddedVest = item({ id: 'padded_vest', name: 'Padded Vest', category: 'armor', tier: 'basic', cost: 300, stats: { armor: 15 } });
const WardingCharm = item({ id: 'warding_charm', name: 'Warding Charm', category: 'magic_resist', tier: 'basic', cost: 450, stats: { magicResist: 25 } });
const Heartstone = item({ id: 'heartstone', name: 'Heartstone', category: 'health', tier: 'basic', cost: 400, stats: { health: 150 } });
const MossweaveBand = item({ id: 'mossweave_band', name: 'Mossweave Band', category: 'health', tier: 'basic', cost: 250, stats: { healthRegen: 1 } });
const FocusRune = item({ id: 'focus_rune', name: 'Focus Rune', category: 'utility', tier: 'basic', cost: 400, stats: { abilityHaste: 10 } });
const ManaPearl = item({ id: 'mana_pearl', name: 'Mana Pearl', category: 'mana', tier: 'basic', cost: 300, stats: { resource: 250 } });
const GlowcapSpores = item({ id: 'glowcap_spores', name: 'Glowcap Spores', category: 'support', tier: 'basic', cost: 300, stats: { healShieldPower: 0.08 } });

// =============================================================================
// Boots: one pair at a time (group 'boots')
// =============================================================================

const WanderersBoots = item({
  id: 'wanderers_boots', name: "Wanderer's Boots", category: 'movement', tier: 'boots', group: 'boots',
  cost: 300, stats: { movementSpeed: 13 }, isUnique: true,
});

const SwiftstrideGreaves = item({
  id: 'swiftstride_greaves', name: 'Swiftstride Greaves', category: 'movement', tier: 'boots', group: 'boots',
  cost: 900, buildsFrom: ['wanderers_boots'], stats: { movementSpeed: 18 }, isUnique: true,
  passives: [passive('wanderlust', 'Wanderlust',
    'After 5 seconds out of combat, +8 movement speed.',
    'out_of_combat_ms', { amount: 8, delay: 5 })],
});

const IronshodBoots = item({
  id: 'ironshod_boots', name: 'Ironshod Boots', category: 'movement', tier: 'boots', group: 'boots',
  cost: 1100, buildsFrom: ['wanderers_boots'], stats: { movementSpeed: 13, armor: 20 }, isUnique: true,
  passives: [passive('hobnails', 'Hobnails',
    'Basic attacks deal 10% less damage to you.',
    'basic_damage_reduction', { percent: 0.1 })],
});

const MysticTreads = item({
  id: 'mystic_treads', name: 'Mystic Treads', category: 'movement', tier: 'boots', group: 'boots',
  cost: 1100, buildsFrom: ['wanderers_boots'], stats: { movementSpeed: 13, magicResist: 25, tenacity: 0.3 }, isUnique: true,
});

const FleetfootSpurs = item({
  id: 'fleetfoot_spurs', name: 'Fleetfoot Spurs', category: 'movement', tier: 'boots', group: 'boots',
  cost: 1000, buildsFrom: ['wanderers_boots'], stats: { movementSpeed: 13, attackSpeed: 0.3 }, isUnique: true,
});

const SpellwalkerSandals = item({
  id: 'spellwalker_sandals', name: 'Spellwalker Sandals', category: 'movement', tier: 'boots', group: 'boots',
  cost: 1100, buildsFrom: ['wanderers_boots'], stats: { movementSpeed: 13, magicPen: 12 }, isUnique: true,
});

const DreamwalkerSlippers = item({
  id: 'dreamwalker_slippers', name: 'Dreamwalker Slippers', category: 'movement', tier: 'boots', group: 'boots',
  cost: 950, buildsFrom: ['wanderers_boots'], stats: { movementSpeed: 13, abilityHaste: 18 }, isUnique: true,
});

// =============================================================================
// Epic items: built from basic parts, built into legendary items
// =============================================================================

const SiegeCleaver = item({
  id: 'siege_cleaver', name: 'Siege Cleaver', category: 'attack_damage', tier: 'epic',
  cost: 1200, buildsFrom: ['notched_blade', 'notched_blade'], stats: { attackDamage: 35 },
});

const DuskhookDagger = item({
  id: 'duskhook_dagger', name: 'Duskhook Dagger', category: 'attack_damage', tier: 'epic',
  cost: 1000, buildsFrom: ['notched_blade', 'notched_blade'], stats: { attackDamage: 20, lethality: 8 },
});

const HuntsmansEdge = item({
  id: 'huntsmans_edge', name: "Huntsman's Edge", category: 'attack_damage', tier: 'epic',
  cost: 1000, buildsFrom: ['notched_blade', 'focus_rune'], stats: { attackDamage: 20, abilityHaste: 12 },
});

const Leechfang = item({
  id: 'leechfang', name: 'Leechfang', category: 'attack_damage', tier: 'epic',
  cost: 900, buildsFrom: ['notched_blade'], stats: { attackDamage: 15, lifesteal: 0.1 },
});

const Bramblehook = item({
  id: 'bramblehook', name: 'Bramblehook', category: 'attack_damage', tier: 'epic',
  cost: 900, buildsFrom: ['notched_blade'], stats: { attackDamage: 15 },
  passives: [passive('rend', 'Rend',
    'Physical damage you deal to champions inflicts Wounds for 3 seconds: they heal 40% less.',
    'wounds', { damageType: 'physical', duration: 3 })],
});

const SkirmishersHatchet = item({
  id: 'skirmishers_hatchet', name: "Skirmisher's Hatchet", category: 'attack_speed', tier: 'epic',
  cost: 1100, buildsFrom: ['notched_blade', 'quickdraw_gloves'], stats: { attackDamage: 15, attackSpeed: 0.15 },
  passives: [passive('momentum', 'Momentum',
    'Basic attacks give you 8 movement speed for 2 seconds.',
    'ms_on_hit', { effect: 'item_momentum', duration: 2 })],
});

const RepeaterCrossbow = item({
  id: 'repeater_crossbow', name: 'Repeater Crossbow', category: 'attack_speed', tier: 'epic',
  cost: 1000, buildsFrom: ['quickdraw_gloves', 'quickdraw_gloves'], stats: { attackSpeed: 0.25 },
  passives: [passive('barbed_bolts', 'Barbed Bolts',
    'Basic attacks deal 12 bonus physical damage.',
    'on_hit_damage', { damage: 12, damageType: 'physical' }, { trigger: 'on_hit' })],
});

const HawkeyeScope = item({
  id: 'hawkeye_scope', name: 'Hawkeye Scope', category: 'critical', tier: 'epic',
  cost: 1100, buildsFrom: ['gleaming_lens', 'quickdraw_gloves'], stats: { critChance: 0.15, attackSpeed: 0.12 },
});

const CinderRod = item({
  id: 'cinder_rod', name: 'Cinder Rod', category: 'ability_power', tier: 'epic',
  cost: 1100, buildsFrom: ['ember_shard', 'ember_shard'], stats: { abilityPower: 50 },
});

const LunarPrism = item({
  id: 'lunar_prism', name: 'Lunar Prism', category: 'ability_power', tier: 'epic',
  cost: 1000, buildsFrom: ['ember_shard', 'focus_rune'], stats: { abilityPower: 25, abilityHaste: 12 },
});

const VoidglassShard = item({
  id: 'voidglass_shard', name: 'Voidglass Shard', category: 'ability_power', tier: 'epic',
  cost: 1000, buildsFrom: ['ember_shard'], stats: { abilityPower: 20, magicPen: 10 },
});

const Witherquill = item({
  id: 'witherquill', name: 'Witherquill', category: 'ability_power', tier: 'epic',
  cost: 900, buildsFrom: ['ember_shard'], stats: { abilityPower: 25 },
  passives: [passive('blight', 'Blight',
    'Magic damage you deal to champions inflicts Wounds for 3 seconds: they heal 40% less.',
    'wounds', { damageType: 'magic', duration: 3 })],
});

const TidePearl = item({
  id: 'tide_pearl', name: 'Tide Pearl', category: 'mana', tier: 'epic',
  cost: 900, buildsFrom: ['mana_pearl', 'ember_shard'], stats: { abilityPower: 20, resource: 300 },
});

const SandglassBracer = item({
  id: 'sandglass_bracer', name: 'Sandglass Bracer', category: 'ability_power', tier: 'epic',
  cost: 1100, buildsFrom: ['ember_shard', 'padded_vest'], stats: { abilityPower: 20, armor: 20 },
});

const IronPlate = item({
  id: 'iron_plate', name: 'Iron Plate', category: 'armor', tier: 'epic',
  cost: 800, buildsFrom: ['padded_vest'], stats: { armor: 40 },
});

const BrambleVest = item({
  id: 'bramble_vest', name: 'Bramble Vest', category: 'armor', tier: 'epic',
  cost: 800, buildsFrom: ['padded_vest'], stats: { armor: 25 },
  passives: [passive('prickle', 'Prickle',
    'Enemies that hit you with a basic attack take 10 magic damage and suffer Wounds for 3 seconds.',
    'thorns', { damage: 10, damageType: 'magic', wounds: 3 }, { stackKey: 'thorns' })],
});

const SpellwardCloak = item({
  id: 'spellward_cloak', name: 'Spellward Cloak', category: 'magic_resist', tier: 'epic',
  cost: 900, buildsFrom: ['warding_charm'], stats: { magicResist: 50 },
});

const UnchainedSash = item({
  id: 'unchained_sash', name: 'Unchained Sash', category: 'magic_resist', tier: 'epic',
  cost: 1300, buildsFrom: ['warding_charm'], stats: { magicResist: 30 },
  active: {
    id: 'unchain', name: 'Unchain', description: 'Removes all crowd control and slows from you.',
    cooldown: 90, targeting: 'self', effectType: 'cleanse', effectData: {},
  },
});

const BulwarkBelt = item({
  id: 'bulwark_belt', name: 'Bulwark Belt', category: 'health', tier: 'epic',
  cost: 900, buildsFrom: ['heartstone'], stats: { health: 350 },
});

const EmberMantle = item({
  id: 'ember_mantle', name: 'Ember Mantle', category: 'health', tier: 'epic',
  cost: 900, buildsFrom: ['heartstone'], stats: { health: 200 },
  passives: [passive('smolder', 'Smolder',
    'While you\'re in combat, enemies within 130 take 8 (+0.6 per level) magic damage per second; 50% more to minions and monsters.',
    'immolate', { base: 8, perLevel: 0.6, bonusHealthRatio: 0, radius: 130 }, { stackKey: 'immolate' })],
});

const BloodrootSigil = item({
  id: 'bloodroot_sigil', name: 'Bloodroot Sigil', category: 'health', tier: 'epic',
  cost: 1000, buildsFrom: ['heartstone'], stats: { health: 150, omnivamp: 0.08 },
});

const MoonpetalCharm = item({
  id: 'moonpetal_charm', name: 'Moonpetal Charm', category: 'support', tier: 'epic',
  cost: 800, buildsFrom: ['glowcap_spores'], stats: { abilityPower: 15, healShieldPower: 0.1, resourceRegen: 1.5 },
});

// =============================================================================
// Legendary items: finished, one of each
// =============================================================================

// --- Fighters and assassins ---

const CrimsonFang = item({
  id: 'crimson_fang', name: 'Crimson Fang', category: 'attack_damage', tier: 'legendary',
  cost: 3000, buildsFrom: ['siege_cleaver', 'leechfang'], stats: { attackDamage: 55, lifesteal: 0.15 }, isUnique: false,
  passives: [passive('overfed', 'Overfed',
    'Lifesteal healing past your max health becomes a shield, up to 60 + 8 per level, for 20 seconds.',
    'overheal_shield', { base: 60, perLevel: 8, duration: 20 })],
});

const NightglassEdge = item({
  id: 'nightglass_edge', name: 'Nightglass Edge', category: 'attack_damage', tier: 'legendary',
  cost: 2900, buildsFrom: ['duskhook_dagger', 'siege_cleaver'], stats: { attackDamage: 55, lethality: 18 },
  passives: [passive('execution', 'Execution',
    'You deal 12% more damage to champions below 35% health.',
    'execute', { threshold: 0.35, bonus: 0.12 })],
});

const ShadowstepCloak = item({
  id: 'shadowstep_cloak', name: 'Shadowstep Cloak', category: 'attack_damage', tier: 'legendary',
  cost: 2800, buildsFrom: ['duskhook_dagger', 'huntsmans_edge'], stats: { attackDamage: 45, lethality: 15, abilityHaste: 10 },
  active: {
    id: 'shadowstep', name: 'Shadowstep', description: 'Blink up to 200 toward the cursor (through thin walls).',
    cooldown: 60, targeting: 'point', range: 200, effectType: 'dash', effectData: { range: 200 },
  },
});

const SunderingAxe = item({
  id: 'sundering_axe', name: 'Sundering Axe', category: 'attack_damage', tier: 'legendary',
  cost: 3000, buildsFrom: ['huntsmans_edge', 'bulwark_belt'], stats: { attackDamage: 40, health: 350, abilityHaste: 15 },
  passives: [passive('sunder', 'Sunder',
    'Physical damage to a champion strips 5% of its armor for 6 seconds, stacking up to 6 times. Everyone on your team hits it harder.',
    'shred', { effect: 'item_sunder', duration: 6 })],
});

const MountainMaul = item({
  id: 'mountain_maul', name: 'Mountain Maul', category: 'health', tier: 'legendary',
  cost: 3100, buildsFrom: ['bulwark_belt', 'heartstone', 'notched_blade'], stats: { attackDamage: 30, health: 450 },
  passives: [passive('avalanche', 'Avalanche',
    'Basic attacks deal bonus physical damage equal to 2% of your max health.',
    'max_health_on_hit', { percent: 0.02 })],
});

const SiegebreakerHammer = item({
  id: 'siegebreaker_hammer', name: 'Siegebreaker Hammer', category: 'attack_damage', tier: 'legendary',
  cost: 3000, buildsFrom: ['skirmishers_hatchet', 'heartstone'], stats: { attackDamage: 40, attackSpeed: 0.2, health: 250 },
  passives: [
    passive('demolish', 'Demolish',
      'Basic attacks deal 40% more damage to towers, inhibitors and the nexus.',
      'structure_damage', { bonus: 0.4 }),
    passive('lone_wolf', 'Lone Wolf',
      'With no allied champion within 700: +10 movement speed, +15 armor and +15 magic resist.',
      'lone_wolf', { radius: 700, effect: 'item_lone_wolf' }),
  ],
});

const WolfsbaneFang = item({
  id: 'wolfsbane_fang', name: 'Wolfsbane Fang', category: 'attack_damage', tier: 'legendary',
  cost: 3100, buildsFrom: ['bloodroot_sigil', 'siege_cleaver'], stats: { attackDamage: 45, health: 300, omnivamp: 0.1 },
  passives: [passive('bloodlust', 'Bloodlust',
    'Below 50% health, your omnivamp is doubled.',
    'bloodlust', { threshold: 0.5 })],
});

const IronheartTalisman = item({
  id: 'ironheart_talisman', name: 'Ironheart Talisman', category: 'health', tier: 'legendary', group: 'lifeline',
  cost: 3100, buildsFrom: ['siege_cleaver', 'bulwark_belt'], stats: { attackDamage: 40, health: 400 },
  passives: [passive('hold_the_line', 'Hold the Line',
    'Dropping below 30% health grants a shield worth 30% of your max health for 5 seconds (60s cooldown).',
    'shield', { percentMaxHealth: 0.3, duration: 5 }, { trigger: 'on_low_health', cooldown: 60, healthThreshold: 0.3 })],
});

// --- Marksmen ---

const KingsglassBow = item({
  id: 'kingsglass_bow', name: 'Kingsglass Bow', category: 'critical', tier: 'legendary',
  cost: 3300, buildsFrom: ['siege_cleaver', 'gleaming_lens'], stats: { attackDamage: 60, critChance: 0.25, critDamage: 0.35 },
});

const Stormstring = item({
  id: 'stormstring', name: 'Stormstring', category: 'critical', tier: 'legendary',
  cost: 2900, buildsFrom: ['hawkeye_scope', 'quickdraw_gloves'], stats: { attackSpeed: 0.35, critChance: 0.25, movementSpeed: 5 },
  passives: [passive('static', 'Static',
    'Moving and attacking charge it. When it\'s full, your next basic attack deals 80 bonus magic damage to its target and to up to 3 enemies near it.',
    'energize', { damage: 80, radius: 220, targets: 3, perAttack: 12, perDistance: 0.12, effect: 'item_static' })],
});

const WyrmslayerArbalest = item({
  id: 'wyrmslayer_arbalest', name: 'Wyrmslayer Arbalest', category: 'critical', tier: 'legendary',
  cost: 3000, buildsFrom: ['hawkeye_scope', 'siege_cleaver'], stats: { attackDamage: 40, critChance: 0.2, attackSpeed: 0.15 },
  passives: [passive('giantslayer', 'Giantslayer',
    'You deal up to 15% more damage to champions with more max health than you: 1% for each 100 health of difference.',
    'giant_slayer', { perHundred: 0.01, max: 0.15 })],
});

const VipersKiss = item({
  id: 'vipers_kiss', name: "Viper's Kiss", category: 'attack_speed', tier: 'legendary',
  cost: 3000, buildsFrom: ['repeater_crossbow', 'ember_shard'], stats: { attackSpeed: 0.4, abilityPower: 30 },
  passives: [passive('venom', 'Venom',
    'Basic attacks deal 15 + 3% of the target\'s current health as magic damage (at most 60 to monsters).',
    'current_health_on_hit', { flat: 15, percent: 0.03, monsterCap: 60 })],
});

const ThunderRepeater = item({
  id: 'thunder_repeater', name: 'Thunder Repeater', category: 'attack_speed', tier: 'legendary',
  cost: 2800, buildsFrom: ['repeater_crossbow', 'notched_blade'], stats: { attackSpeed: 0.45, attackDamage: 20 },
  passives: [passive('triple_volley', 'Triple Volley',
    'Every third basic attack deals 70 bonus magic damage.',
    'nth_hit', { every: 3, damage: 70, damageType: 'magic' })],
});

const FreebladeScimitar = item({
  id: 'freeblade_scimitar', name: 'Freeblade Scimitar', category: 'critical', tier: 'legendary',
  cost: 3000, buildsFrom: ['unchained_sash', 'siege_cleaver'], stats: { attackDamage: 40, critChance: 0.2, magicResist: 30 },
  active: {
    id: 'unchain', name: 'Unchain', description: 'Removes all crowd control and slows from you, and gives you 40% movement speed for 1 second.',
    cooldown: 90, targeting: 'self', effectType: 'cleanse', effectData: { speed: 'item_unchain_speed', duration: 1 },
  },
});

// --- Mages ---

const StarfallDiadem = item({
  id: 'starfall_diadem', name: 'Starfall Diadem', category: 'ability_power', tier: 'legendary',
  cost: 3000, buildsFrom: ['cinder_rod', 'lunar_prism'], stats: { abilityPower: 90, abilityHaste: 10 },
  passives: [passive('starfall', 'Starfall',
    'After you cast an ability, your next basic attack within 10 seconds deals bonus magic damage equal to 75% of your ability power (1.5s cooldown).',
    'spellblade', { apRatio: 0.75, damageType: 'magic', window: 10 }, { trigger: 'on_ability_cast', cooldown: 1.5 })],
});

const EmberheartCodex = item({
  id: 'emberheart_codex', name: 'Emberheart Codex', category: 'ability_power', tier: 'legendary',
  cost: 3000, buildsFrom: ['cinder_rod', 'heartstone'], stats: { abilityPower: 80, health: 300 },
  passives: [passive('smoldering_pages', 'Smoldering Pages',
    'Ability damage burns champions for 1.2% of their max health as magic damage per second for 3 seconds.',
    'ability_burn', { maxHealthPercentPerSecond: 0.012, duration: 3 }, { stackKey: 'ability_burn' })],
});

const FrostwyrmScepter = item({
  id: 'frostwyrm_scepter', name: 'Frostwyrm Scepter', category: 'ability_power', tier: 'legendary',
  cost: 2800, buildsFrom: ['ember_shard', 'bulwark_belt'], stats: { abilityPower: 70, health: 350 },
  passives: [passive('rime', 'Rime',
    'Ability damage slows by 25% for 1 second.',
    'ability_slow', { effect: 'slow_25', duration: 1 })],
});

const ArchmageCrown = item({
  id: 'archmage_crown', name: 'Crown of the Archmage', category: 'ability_power', tier: 'legendary',
  cost: 3600, buildsFrom: ['cinder_rod', 'cinder_rod'], stats: { abilityPower: 120 },
  passives: [passive('majesty', 'Majesty', '+30% ability power.', 'ap_amp', { percent: 0.3 })],
});

const VoidpierceStaff = item({
  id: 'voidpierce_staff', name: 'Voidpierce Staff', category: 'ability_power', tier: 'legendary',
  cost: 3000, buildsFrom: ['voidglass_shard', 'cinder_rod'], stats: { abilityPower: 70, magicPenPercent: 0.35 },
});

const WitherbloomOrb = item({
  id: 'witherbloom_orb', name: 'Witherbloom Orb', category: 'ability_power', tier: 'legendary',
  cost: 2800, buildsFrom: ['witherquill', 'lunar_prism'], stats: { abilityPower: 65, abilityHaste: 15, magicPen: 10 },
  passives: [passive('blight', 'Blight',
    'Magic damage you deal to champions inflicts Wounds for 3 seconds: they heal 40% less.',
    'wounds', { damageType: 'magic', duration: 3 })],
});

const HourglassOfStillness = item({
  id: 'hourglass_of_stillness', name: 'Hourglass of Stillness', category: 'ability_power', tier: 'legendary',
  cost: 3000, buildsFrom: ['sandglass_bracer', 'cinder_rod'], stats: { abilityPower: 80, armor: 45 },
  active: {
    id: 'stillness', name: 'Stillness', description: 'Become invulnerable and frozen for 2.5 seconds: nothing can hurt you, and you can\'t move, attack or cast.',
    cooldown: 120, targeting: 'self', effectType: 'stasis', effectData: { duration: 2.5 },
  },
});

const SoulbinderTome = item({
  id: 'soulbinder_tome', name: 'Soulbinder Tome', category: 'ability_power', tier: 'legendary',
  cost: 3000, buildsFrom: ['tide_pearl', 'cinder_rod'], stats: { abilityPower: 60, resource: 300 },
  passives: [passive('hoard', 'Hoard',
    'Each champion takedown adds 5 ability power, up to 20 times (+100). Dying loses a third of them.',
    'stacking', { stat: 'abilityPower', perStack: 5, max: 20, from: 'takedown', deathLoss: 0.34 })],
});

const TempestCodex = item({
  id: 'tempest_codex', name: 'Tempest Codex', category: 'ability_power', tier: 'legendary',
  cost: 2900, buildsFrom: ['tide_pearl', 'lunar_prism'], stats: { abilityPower: 60, abilityHaste: 20, resource: 500 },
  passives: [passive('overflow', 'Overflow', 'Gain ability power equal to 3% of your max mana.', 'mana_to_ap', { percent: 0.03 })],
});

const StormwingSigil = item({
  id: 'stormwing_sigil', name: 'Stormwing Sigil', category: 'ability_power', tier: 'legendary',
  cost: 3000, buildsFrom: ['lunar_prism', 'heartstone'], stats: { abilityPower: 70, health: 250, abilityHaste: 10 },
  active: {
    id: 'gust', name: 'Gust', description: 'Dash up to 200 toward the cursor and deal 60 + 15% of your ability power as magic damage to enemies within 150 of where you land.',
    cooldown: 60, targeting: 'point', range: 200, effectType: 'dash', effectData: { range: 200, damage: 60, apRatio: 0.15, radius: 150 },
  },
});

// --- Tanks ---

const SpikedBastion = item({
  id: 'spiked_bastion', name: 'Spiked Bastion', category: 'armor', tier: 'legendary',
  cost: 2600, buildsFrom: ['bramble_vest', 'bulwark_belt'], stats: { armor: 60, health: 300 },
  passives: [passive('barbs', 'Barbs',
    'Enemies that hit you with a basic attack take 25 + 10% of your armor as magic damage and suffer Wounds for 3 seconds.',
    'thorns', { damage: 25, armorRatio: 0.1, damageType: 'magic', wounds: 3 }, { stackKey: 'thorns' })],
});

const MagmaheartAegis = item({
  id: 'magmaheart_aegis', name: 'Magmaheart Aegis', category: 'health', tier: 'legendary',
  cost: 2800, buildsFrom: ['ember_mantle', 'iron_plate'], stats: { health: 400, armor: 40 },
  passives: [passive('magma', 'Magma',
    'While you\'re in combat, enemies within 150 take 12 (+1 per level) + 1% of your bonus health as magic damage per second; 50% more to minions and monsters.',
    'immolate', { base: 12, perLevel: 1, bonusHealthRatio: 0.01, radius: 150 }, { stackKey: 'immolate' })],
});

const FrostguardPlate = item({
  id: 'frostguard_plate', name: 'Frostguard Plate', category: 'armor', tier: 'legendary',
  cost: 2900, buildsFrom: ['iron_plate', 'heartstone'], stats: { health: 400, armor: 60 },
  passives: [passive('chill_shell', 'Chill Shell', 'Critical strikes deal 25% less damage to you.', 'crit_reduction', { percent: 0.25 })],
  active: {
    id: 'frost_nova', name: 'Frost Nova', description: 'Slow enemies within 300 by 55% for 2 seconds.',
    cooldown: 90, targeting: 'self', effectType: 'frost_nova', effectData: { radius: 300, effect: 'item_frost_nova', duration: 2 },
  },
});

const StormwardVeil = item({
  id: 'stormward_veil', name: 'Stormward Veil', category: 'magic_resist', tier: 'legendary',
  cost: 3000, buildsFrom: ['spellward_cloak', 'bulwark_belt'], stats: { magicResist: 60, health: 300 },
  passives: [passive('veil', 'Veil',
    'Blocks the next ability from an enemy champion. Recharges 40 seconds after it blocks.',
    'spell_shield', { effect: 'item_veil' }, { cooldown: 40 })],
});

const GrovekeepersBark = item({
  id: 'grovekeepers_bark', name: "Grovekeeper's Bark", category: 'magic_resist', tier: 'legendary',
  cost: 2900, buildsFrom: ['spellward_cloak', 'mossweave_band', 'heartstone'], stats: { health: 450, magicResist: 55, healthRegen: 2 },
  passives: [passive('verdant', 'Verdant', 'Heals and shields you receive are 25% stronger.', 'heal_received', { percent: 0.25 })],
});

const WardensStandard = item({
  id: 'wardens_standard', name: "Warden's Standard", category: 'armor', tier: 'legendary',
  cost: 2500, buildsFrom: ['padded_vest', 'warding_charm', 'heartstone'], stats: { health: 300, armor: 30, magicResist: 30 },
  passives: [passive('rally', 'Rally',
    'Allied champions within 500 get +10 armor and +10 magic resist.',
    'ally_aura', { radius: 500, effect: 'item_rally' })],
  active: {
    id: 'shelter', name: 'Shelter', description: 'Shield allied champions within 500 (you too) for 80 + 10% of your bonus health for 2.5 seconds.',
    cooldown: 90, targeting: 'self', effectType: 'shield_allies', effectData: { radius: 500, base: 80, bonusHealthRatio: 0.1, duration: 2.5 },
  },
});

const Mountainheart = item({
  id: 'mountainheart', name: 'Mountainheart', category: 'health', tier: 'legendary',
  cost: 3000, buildsFrom: ['bulwark_belt', 'bulwark_belt'], stats: { health: 800 },
  passives: [passive('bedrock', 'Bedrock',
    'Each champion takedown and epic monster kill permanently adds 25 max health, up to 20 times.',
    'stacking', { stat: 'health', perStack: 25, max: 20, from: 'takedown_or_epic' })],
});

// --- Supports ---

const DawnsongCenser = item({
  id: 'dawnsong_censer', name: 'Dawnsong Censer', category: 'support', tier: 'legendary',
  cost: 2300, buildsFrom: ['moonpetal_charm', 'ember_shard'], stats: { abilityPower: 50, healShieldPower: 0.12, abilityHaste: 15 },
  passives: [passive('hymn', 'Hymn',
    'Healing or shielding an ally gives both of you +20% attack speed and 15 bonus magic damage on basic attacks for 5 seconds.',
    'ally_buff_on_heal', { effect: 'item_hymn', duration: 5, onHit: 15 })],
});

const TidemotherChalice = item({
  id: 'tidemother_chalice', name: "Tidemother's Chalice", category: 'support', tier: 'legendary',
  cost: 2400, buildsFrom: ['moonpetal_charm', 'heartstone'], stats: { abilityPower: 40, health: 200, healShieldPower: 0.15, abilityHaste: 15 },
  passives: [passive('renewal', 'Renewal',
    'Heals and shields you give an ally also heal the most wounded other allied champion within 600 for 30% of the amount.',
    'echo_heal', { percent: 0.3, radius: 600 })],
});

const ShepherdsCrook = item({
  id: 'shepherds_crook', name: "Shepherd's Crook", category: 'support', tier: 'legendary',
  cost: 2300, buildsFrom: ['glowcap_spores', 'heartstone', 'focus_rune'], stats: { health: 300, healShieldPower: 0.15, abilityHaste: 15 },
  active: {
    id: 'sanctuary', name: 'Sanctuary', description: 'After 1.5 seconds, heal allied champions within 220 of a point (up to 800 away) for 100 + 15% of their missing health, and deal 60 true damage to enemy champions there.',
    cooldown: 120, targeting: 'point', range: 800, effectType: 'heal_area',
    effectData: { delay: 1.5, radius: 220, heal: 100, missingHealthRatio: 0.15, damage: 60 },
  },
});

// ===================
// Item Registry
// ===================

export const ITEM_CATALOG: ItemCatalogEntry[] = [
  // Starters
  ForagerBlade, KindlingWand, OakbarkBuckler, SeedlingSickle, PilgrimLantern,
  // Consumables
  HealingDraught, WayfarerFlask, IronbarkElixir, StormfuryElixir,
  // Basic parts
  NotchedBlade, EmberShard, QuickdrawGloves, GleamingLens, PaddedVest, WardingCharm,
  Heartstone, MossweaveBand, FocusRune, ManaPearl, GlowcapSpores,
  // Boots
  WanderersBoots, SwiftstrideGreaves, IronshodBoots, MysticTreads, FleetfootSpurs, SpellwalkerSandals, DreamwalkerSlippers,
  // Epic
  SiegeCleaver, DuskhookDagger, HuntsmansEdge, Leechfang, Bramblehook, SkirmishersHatchet, RepeaterCrossbow,
  HawkeyeScope, CinderRod, LunarPrism, VoidglassShard, Witherquill, TidePearl, SandglassBracer,
  IronPlate, BrambleVest, SpellwardCloak, UnchainedSash, BulwarkBelt, EmberMantle, BloodrootSigil, MoonpetalCharm,
  // Legendary: fighters and assassins
  CrimsonFang, NightglassEdge, ShadowstepCloak, SunderingAxe, MountainMaul, SiegebreakerHammer, WolfsbaneFang, IronheartTalisman,
  // Legendary: marksmen
  KingsglassBow, Stormstring, WyrmslayerArbalest, VipersKiss, ThunderRepeater, FreebladeScimitar,
  // Legendary: mages
  StarfallDiadem, EmberheartCodex, FrostwyrmScepter, ArchmageCrown, VoidpierceStaff, WitherbloomOrb,
  HourglassOfStillness, SoulbinderTome, TempestCodex, StormwingSigil,
  // Legendary: tanks
  SpikedBastion, MagmaheartAegis, FrostguardPlate, StormwardVeil, GrovekeepersBark, WardensStandard, Mountainheart,
  // Legendary: supports
  DawnsongCenser, TidemotherChalice, ShepherdsCrook,
];

/**
 * The control ward is bought in the shop with BUY_ITEM like an item, but it
 * isn't one: it's carried apart from the six slots (up to
 * GameConfig.VISION.MAX_CONTROL_WARDS_CARRIED) and placed with key 5.
 */
export const CONTROL_WARD_ITEM_ID = 'control_ward';

const ITEM_BY_ID = new Map<string, ItemCatalogEntry>(
  ITEM_CATALOG.map(item => [item.id, item])
);

/**
 * Get an item by ID.
 */
export function getItemCatalogEntry(id: string): ItemCatalogEntry | undefined {
  return ITEM_BY_ID.get(id);
}
