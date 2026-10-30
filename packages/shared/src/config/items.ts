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
}

// ===================
// Attack Damage Items
// ===================

const LongSword: ItemCatalogEntry = {
  id: 'long_sword',
  name: 'Long Sword',
  category: 'attack_damage',
  cost: 350,
  sellValue: 245,
  stats: { attackDamage: 10 },
  passives: [],
  isUnique: false,
};

const BFSword: ItemCatalogEntry = {
  id: 'bf_sword',
  name: 'B.F. Sword',
  category: 'attack_damage',
  cost: 1300,
  sellValue: 910,
  stats: { attackDamage: 40 },
  passives: [],
  isUnique: false,
};

const Bloodthirster: ItemCatalogEntry = {
  id: 'bloodthirster',
  name: 'Bloodthirster',
  category: 'attack_damage',
  cost: 3400,
  sellValue: 2380,
  stats: { attackDamage: 55, critChance: 0.20 },
  passives: [
    {
      id: 'bloodthirster_lifesteal',
      name: 'Bloodlust',
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

// ===================
// Ability Power Items
// ===================

const AmplifyingTome: ItemCatalogEntry = {
  id: 'amplifying_tome',
  name: 'Amplifying Tome',
  category: 'ability_power',
  cost: 435,
  sellValue: 305,
  stats: { abilityPower: 20 },
  passives: [],
  isUnique: false,
};

const NeedlesslyLargeRod: ItemCatalogEntry = {
  id: 'needlessly_large_rod',
  name: 'Needlessly Large Rod',
  category: 'ability_power',
  cost: 1250,
  sellValue: 875,
  stats: { abilityPower: 60 },
  passives: [],
  isUnique: false,
};

const RabadonsDeathcap: ItemCatalogEntry = {
  id: 'rabadons_deathcap',
  name: "Rabadon's Deathcap",
  category: 'ability_power',
  cost: 3600,
  sellValue: 2520,
  stats: { abilityPower: 120 },
  passives: [],
  isUnique: true,
};

// ===================
// Attack Speed Items
// ===================

const Dagger: ItemCatalogEntry = {
  id: 'dagger',
  name: 'Dagger',
  category: 'attack_speed',
  cost: 300,
  sellValue: 210,
  stats: { attackSpeed: 0.12 },
  passives: [],
  isUnique: false,
};

const RecurveBow: ItemCatalogEntry = {
  id: 'recurve_bow',
  name: 'Recurve Bow',
  category: 'attack_speed',
  cost: 1000,
  sellValue: 700,
  stats: { attackSpeed: 0.25 },
  passives: [
    {
      id: 'recurve_bow_onhit',
      name: 'Sharp',
      description: 'Basic attacks deal 15 bonus physical damage.',
      trigger: 'on_hit',
      cooldown: 0,
      isUnique: false,
      effectType: 'on_hit_damage',
      effectData: { damage: 15, type: 'physical' },
    },
  ],
  isUnique: false,
};

// ===================
// Defense Items - Armor
// ===================

const ClothArmor: ItemCatalogEntry = {
  id: 'cloth_armor',
  name: 'Cloth Armor',
  category: 'armor',
  cost: 300,
  sellValue: 210,
  stats: { armor: 15 },
  passives: [],
  isUnique: false,
};

const ChainVest: ItemCatalogEntry = {
  id: 'chain_vest',
  name: 'Chain Vest',
  category: 'armor',
  cost: 800,
  sellValue: 560,
  stats: { armor: 40 },
  passives: [],
  isUnique: false,
};

const Thornmail: ItemCatalogEntry = {
  id: 'thornmail',
  name: 'Thornmail',
  category: 'armor',
  cost: 2700,
  sellValue: 1890,
  stats: { armor: 70, health: 350 },
  passives: [
    {
      id: 'thornmail_thorns',
      name: 'Thorns',
      description: 'Taking damage deals 25 magic damage back to the attacker.',
      trigger: 'on_take_damage',
      cooldown: 0,
      isUnique: true,
      effectType: 'thorns',
      effectData: { damage: 25, type: 'magic' },
    },
  ],
  isUnique: false,
};

// ===================
// Defense Items - Magic Resist
// ===================

const NullMagicMantle: ItemCatalogEntry = {
  id: 'null_magic_mantle',
  name: 'Null-Magic Mantle',
  category: 'magic_resist',
  cost: 450,
  sellValue: 315,
  stats: { magicResist: 25 },
  passives: [],
  isUnique: false,
};

const NegatronCloak: ItemCatalogEntry = {
  id: 'negatron_cloak',
  name: 'Negatron Cloak',
  category: 'magic_resist',
  cost: 900,
  sellValue: 630,
  stats: { magicResist: 50 },
  passives: [],
  isUnique: false,
};

// ===================
// Health Items
// ===================

const RubysCrystal: ItemCatalogEntry = {
  id: 'rubys_crystal',
  name: "Ruby Crystal",
  category: 'health',
  cost: 400,
  sellValue: 280,
  stats: { health: 150 },
  passives: [],
  isUnique: false,
};

const GiantsBelt: ItemCatalogEntry = {
  id: 'giants_belt',
  name: "Giant's Belt",
  category: 'health',
  cost: 900,
  sellValue: 630,
  stats: { health: 350 },
  passives: [],
  isUnique: false,
};

const SteraksGage: ItemCatalogEntry = {
  id: 'steraks_gage',
  name: "Sterak's Gage",
  category: 'health',
  cost: 3100,
  sellValue: 2170,
  stats: { health: 400, attackDamage: 50 },
  passives: [
    {
      id: 'steraks_lifeline',
      name: 'Lifeline',
      description: 'Dropping below 30% health grants a shield worth 30% of your max health for 5 seconds.',
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
// Utility Items
// ===================

const Sheen: ItemCatalogEntry = {
  id: 'sheen',
  name: 'Sheen',
  category: 'utility',
  cost: 700,
  sellValue: 490,
  stats: {},
  passives: [
    {
      id: 'sheen_spellblade',
      name: 'Spellblade',
      description: 'After you cast an ability, your next basic attack deals bonus damage equal to your base attack damage.',
      trigger: 'on_ability_cast',
      cooldown: 1.5,
      isUnique: true,
      effectType: 'spellblade',
      effectData: { baseDamagePercent: 1.0 },
    },
  ],
  isUnique: false,
};

const BootsOfSpeed: ItemCatalogEntry = {
  id: 'boots_of_speed',
  name: 'Boots of Speed',
  category: 'movement',
  cost: 300,
  sellValue: 210,
  stats: { movementSpeed: 25 },
  passives: [],
  isUnique: true,
};

// ===================
// Item Registry
// ===================

export const ITEM_CATALOG: ItemCatalogEntry[] = [
  // AD
  LongSword,
  BFSword,
  Bloodthirster,
  // AP
  AmplifyingTome,
  NeedlesslyLargeRod,
  RabadonsDeathcap,
  // AS
  Dagger,
  RecurveBow,
  // Armor
  ClothArmor,
  ChainVest,
  Thornmail,
  // MR
  NullMagicMantle,
  NegatronCloak,
  // Health
  RubysCrystal,
  GiantsBelt,
  SteraksGage,
  // Utility
  Sheen,
  BootsOfSpeed,
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
