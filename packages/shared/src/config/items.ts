/**
 * The item catalog: every item the shop sells, with its stats and passives.
 *
 * Shared by the server (purchases, stats, passives) and the client (shop,
 * HUD). Icon art for each item is public/assets/items/<id>.png.
 */

import type { ChampionBaseStats } from '../types/champions';
import type { ItemCategory, ItemPassiveDef } from '../types/items';

/**
 * An item passive: its display data plus what the server does with it
 * (effectType and effectData).
 */
export interface ItemPassiveData extends ItemPassiveDef {
  effectType: 'lifesteal' | 'thorns' | 'on_hit_damage' | 'shield' | 'spellblade';
  effectData: Record<string, number | string>;
}

/**
 * An item in the catalog.
 */
export interface ItemCatalogEntry {
  id: string;
  name: string;
  category: ItemCategory;
  cost: number;
  sellValue: number;
  stats: Partial<ChampionBaseStats>;
  passives: ItemPassiveData[];
  isUnique: boolean;
  /**
   * Items this one is built from (see itemTrees.ts). A part can appear more
   * than once. `cost` is the full price; owned parts are taken off it.
   */
  buildsFrom?: string[];
}

// ===================
// Basic items: no parts
// ===================

const NotchedBlade: ItemCatalogEntry = {
  id: 'notched_blade',
  name: "Notched Blade",
  category: 'attack_damage',
  cost: 350,
  sellValue: 245,
  stats: { attackDamage: 10 },
  passives: [],
  isUnique: false,
};

const EmberShard: ItemCatalogEntry = {
  id: 'ember_shard',
  name: "Ember Shard",
  category: 'ability_power',
  cost: 435,
  sellValue: 304,
  stats: { abilityPower: 20 },
  passives: [],
  isUnique: false,
};

const QuickdrawGloves: ItemCatalogEntry = {
  id: 'quickdraw_gloves',
  name: "Quickdraw Gloves",
  category: 'attack_speed',
  cost: 300,
  sellValue: 210,
  stats: { attackSpeed: 0.12 },
  passives: [],
  isUnique: false,
};

const PaddedVest: ItemCatalogEntry = {
  id: 'padded_vest',
  name: "Padded Vest",
  category: 'armor',
  cost: 300,
  sellValue: 210,
  stats: { armor: 15 },
  passives: [],
  isUnique: false,
};

const WardingCharm: ItemCatalogEntry = {
  id: 'warding_charm',
  name: "Warding Charm",
  category: 'magic_resist',
  cost: 450,
  sellValue: 315,
  stats: { magicResist: 25 },
  passives: [],
  isUnique: false,
};

const Heartstone: ItemCatalogEntry = {
  id: 'heartstone',
  name: "Heartstone",
  category: 'health',
  cost: 400,
  sellValue: 280,
  stats: { health: 150 },
  passives: [],
  isUnique: false,
};

const FocusRune: ItemCatalogEntry = {
  id: 'focus_rune',
  name: "Focus Rune",
  category: 'utility',
  cost: 400,
  sellValue: 280,
  stats: { abilityHaste: 10 },
  passives: [],
  isUnique: false,
};

const WanderersBoots: ItemCatalogEntry = {
  id: 'wanderers_boots',
  name: "Wanderer's Boots",
  category: 'movement',
  cost: 300,
  sellValue: 210,
  stats: { movementSpeed: 6 },
  passives: [],
  isUnique: true,
};

// ===================
// Middle items
// ===================

const SiegeCleaver: ItemCatalogEntry = {
  id: 'siege_cleaver',
  name: "Siege Cleaver",
  category: 'attack_damage',
  cost: 1200,
  sellValue: 840,
  buildsFrom: ['notched_blade', 'notched_blade'],
  stats: { attackDamage: 35 },
  passives: [],
  isUnique: false,
};

const CinderRod: ItemCatalogEntry = {
  id: 'cinder_rod',
  name: "Cinder Rod",
  category: 'ability_power',
  cost: 1100,
  sellValue: 770,
  buildsFrom: ['ember_shard', 'ember_shard'],
  stats: { abilityPower: 50 },
  passives: [],
  isUnique: false,
};

const RepeaterCrossbow: ItemCatalogEntry = {
  id: 'repeater_crossbow',
  name: "Repeater Crossbow",
  category: 'attack_speed',
  cost: 1000,
  sellValue: 700,
  buildsFrom: ['quickdraw_gloves', 'quickdraw_gloves'],
  stats: { attackSpeed: 0.25 },
  passives: [
    {
      id: 'barbed_bolts',
      name: 'Barbed Bolts',
      description: 'Basic attacks deal 12 bonus physical damage.',
      trigger: 'on_hit',
      cooldown: 0,
      isUnique: true,
      effectType: 'on_hit_damage',
      effectData: { damage: 12, damageType: 'physical' },
    },
  ],
  isUnique: false,
};

const IronPlate: ItemCatalogEntry = {
  id: 'iron_plate',
  name: "Iron Plate",
  category: 'armor',
  cost: 800,
  sellValue: 560,
  buildsFrom: ['padded_vest'],
  stats: { armor: 40 },
  passives: [],
  isUnique: false,
};

const SpellwardCloak: ItemCatalogEntry = {
  id: 'spellward_cloak',
  name: "Spellward Cloak",
  category: 'magic_resist',
  cost: 900,
  sellValue: 630,
  buildsFrom: ['warding_charm'],
  stats: { magicResist: 50 },
  passives: [],
  isUnique: false,
};

const BulwarkBelt: ItemCatalogEntry = {
  id: 'bulwark_belt',
  name: "Bulwark Belt",
  category: 'health',
  cost: 900,
  sellValue: 630,
  buildsFrom: ['heartstone'],
  stats: { health: 350 },
  passives: [],
  isUnique: false,
};

// ===================
// Finished items
// ===================

const CrimsonFang: ItemCatalogEntry = {
  id: 'crimson_fang',
  name: "Crimson Fang",
  category: 'attack_damage',
  cost: 3000,
  sellValue: 2100,
  buildsFrom: ['siege_cleaver', 'notched_blade'],
  stats: { attackDamage: 55 },
  passives: [
    {
      id: 'feast',
      name: 'Feast',
      description: 'Basic attacks heal you for 15% of the damage they deal.',
      trigger: 'on_hit',
      cooldown: 0,
      isUnique: true,
      effectType: 'lifesteal',
      effectData: { percent: 0.15 },
    },
  ],
  isUnique: false,
};

const StarfallDiadem: ItemCatalogEntry = {
  id: 'starfall_diadem',
  name: "Starfall Diadem",
  category: 'ability_power',
  cost: 3000,
  sellValue: 2100,
  buildsFrom: ['cinder_rod', 'focus_rune'],
  stats: { abilityPower: 90, abilityHaste: 10 },
  passives: [
    {
      id: 'starfall',
      name: 'Starfall',
      description: 'After you cast an ability, your next basic attack within 10 seconds deals bonus magic damage equal to 75% of your ability power (1.5s cooldown).',
      trigger: 'on_ability_cast',
      cooldown: 1.5,
      isUnique: true,
      effectType: 'spellblade',
      effectData: { apRatio: 0.75, damageType: 'magic', window: 10 },
    },
  ],
  isUnique: true,
};

const SpikedBastion: ItemCatalogEntry = {
  id: 'spiked_bastion',
  name: "Spiked Bastion",
  category: 'armor',
  cost: 2600,
  sellValue: 1820,
  buildsFrom: ['iron_plate', 'bulwark_belt'],
  stats: { armor: 60, health: 300 },
  passives: [
    {
      id: 'barbs',
      name: 'Barbs',
      description: 'Enemies that hit you with a basic attack take 30 magic damage.',
      trigger: 'on_take_damage',
      cooldown: 0,
      isUnique: true,
      effectType: 'thorns',
      effectData: { damage: 30, damageType: 'magic' },
    },
  ],
  isUnique: true,
};

const IronheartTalisman: ItemCatalogEntry = {
  id: 'ironheart_talisman',
  name: "Ironheart Talisman",
  category: 'health',
  cost: 3100,
  sellValue: 2170,
  buildsFrom: ['siege_cleaver', 'bulwark_belt'],
  stats: { attackDamage: 40, health: 400 },
  passives: [
    {
      id: 'hold_the_line',
      name: 'Hold the Line',
      description: 'Dropping below 30% health grants a shield worth 30% of your max health for 5 seconds (60s cooldown).',
      trigger: 'on_low_health',
      cooldown: 60,
      isUnique: true,
      effectType: 'shield',
      effectData: { percentMaxHealth: 0.3, duration: 5 },
      healthThreshold: 0.3,
    },
  ],
  isUnique: true,
};

// ===================
// Item Registry
// ===================

export const ITEM_CATALOG: ItemCatalogEntry[] = [
  // Basic
  NotchedBlade,
  EmberShard,
  QuickdrawGloves,
  PaddedVest,
  WardingCharm,
  Heartstone,
  FocusRune,
  WanderersBoots,
  // Middle
  SiegeCleaver,
  CinderRod,
  RepeaterCrossbow,
  IronPlate,
  SpellwardCloak,
  BulwarkBelt,
  // Finished
  CrimsonFang,
  StarfallDiadem,
  SpikedBastion,
  IronheartTalisman,
];

const ITEM_BY_ID = new Map<string, ItemCatalogEntry>(
  ITEM_CATALOG.map(item => [item.id, item])
);

/**
 * Get an item by ID.
 */
export function getItemCatalogEntry(id: string): ItemCatalogEntry | undefined {
  return ITEM_BY_ID.get(id);
}
