/**
 * Item definitions - all items in the game.
 */

import type { ItemDefinition } from '../types';
import {
  LifestealEffect,
  ThornsEffect,
  OnHitDamageEffect,
  LowHealthShieldEffect,
  SpellbladeEffect,
} from '../effects/ItemEffects';

// ===================
// Attack Damage Items
// ===================

export const LongSword: ItemDefinition = {
  id: 'long_sword',
  name: 'Long Sword',
  description: 'A standard blade that increases attack damage.',
  category: 'attack_damage',
  cost: 350,
  sellValue: 245,
  stats: {
    attackDamage: 10,
  },
  passives: [],
  isUnique: false,
  tags: ['ad', 'basic'],
};

export const BFSword: ItemDefinition = {
  id: 'bf_sword',
  name: 'B.F. Sword',
  description: 'A mighty blade forged for battle.',
  category: 'attack_damage',
  cost: 1300,
  sellValue: 910,
  stats: {
    attackDamage: 40,
  },
  passives: [],
  isUnique: false,
  tags: ['ad', 'big'],
};

export const Bloodthirster: ItemDefinition = {
  id: 'bloodthirster',
  name: 'Bloodthirster',
  description: 'A vampiric blade that heals you when you deal damage.',
  category: 'attack_damage',
  cost: 3400,
  sellValue: 2380,
  stats: {
    attackDamage: 55,
    critChance: 0.20,
  },
  passives: [
    {
      id: 'bloodthirster_lifesteal',
      name: 'Bloodlust',
      description: 'Attacks heal for 15% of damage dealt.',
      trigger: 'on_hit',
      cooldown: 0,
      isUnique: true,
      effect: new LifestealEffect(0.15),
    },
  ],
  isUnique: false,
  tags: ['ad', 'lifesteal', 'crit'],
};

// ===================
// Ability Power Items
// ===================

export const AmplifyingTome: ItemDefinition = {
  id: 'amplifying_tome',
  name: 'Amplifying Tome',
  description: 'Increases magical potency.',
  category: 'ability_power',
  cost: 435,
  sellValue: 305,
  stats: {
    abilityPower: 20,
  },
  passives: [],
  isUnique: false,
  tags: ['ap', 'basic'],
};

export const NeedlesslyLargeRod: ItemDefinition = {
  id: 'needlessly_large_rod',
  name: 'Needlessly Large Rod',
  description: 'A powerful magical artifact.',
  category: 'ability_power',
  cost: 1250,
  sellValue: 875,
  stats: {
    abilityPower: 60,
  },
  passives: [],
  isUnique: false,
  tags: ['ap', 'big'],
};

export const RabadonsDeathcap: ItemDefinition = {
  id: 'rabadons_deathcap',
  name: "Rabadon's Deathcap",
  description: 'Massively increases ability power.',
  category: 'ability_power',
  cost: 3600,
  sellValue: 2520,
  stats: {
    abilityPower: 120,
  },
  passives: [],
  isUnique: true,
  tags: ['ap', 'big'],
};

// ===================
// Attack Speed Items
// ===================

export const Dagger: ItemDefinition = {
  id: 'dagger',
  name: 'Dagger',
  description: 'A small blade that increases attack speed.',
  category: 'attack_speed',
  cost: 300,
  sellValue: 210,
  stats: {
    attackSpeed: 0.12,
  },
  passives: [],
  isUnique: false,
  tags: ['as', 'basic'],
};

export const RecurveBow: ItemDefinition = {
  id: 'recurve_bow',
  name: 'Recurve Bow',
  description: 'A powerful bow with on-hit damage.',
  category: 'attack_speed',
  cost: 1000,
  sellValue: 700,
  stats: {
    attackSpeed: 0.25,
  },
  passives: [
    {
      id: 'recurve_bow_onhit',
      name: 'Sharp',
      description: 'Basic attacks deal 15 bonus physical damage on hit.',
      trigger: 'on_hit',
      cooldown: 0,
      isUnique: false,
      effect: new OnHitDamageEffect(15, 'physical'),
    },
  ],
  isUnique: false,
  tags: ['as', 'onhit'],
};

// ===================
// Defense Items - Armor
// ===================

export const ClothArmor: ItemDefinition = {
  id: 'cloth_armor',
  name: 'Cloth Armor',
  description: 'Provides physical protection.',
  category: 'armor',
  cost: 300,
  sellValue: 210,
  stats: {
    armor: 15,
  },
  passives: [],
  isUnique: false,
  tags: ['armor', 'basic'],
};

export const ChainVest: ItemDefinition = {
  id: 'chain_vest',
  name: 'Chain Vest',
  description: 'Heavy armor for enhanced protection.',
  category: 'armor',
  cost: 800,
  sellValue: 560,
  stats: {
    armor: 40,
  },
  passives: [],
  isUnique: false,
  tags: ['armor'],
};

export const Thornmail: ItemDefinition = {
  id: 'thornmail',
  name: 'Thornmail',
  description: 'Reflects damage back to attackers.',
  category: 'armor',
  cost: 2700,
  sellValue: 1890,
  stats: {
    armor: 70,
    health: 350,
  },
  passives: [
    {
      id: 'thornmail_thorns',
      name: 'Thorns',
      description: 'When hit by a basic attack, deal 25 magic damage to the attacker.',
      trigger: 'on_take_damage',
      cooldown: 0,
      isUnique: true,
      effect: new ThornsEffect(25, 'magic'),
    },
  ],
  isUnique: false,
  tags: ['armor', 'health', 'thorns'],
};

// ===================
// Defense Items - Magic Resist
// ===================

export const NullMagicMantle: ItemDefinition = {
  id: 'null_magic_mantle',
  name: 'Null-Magic Mantle',
  description: 'Provides magic protection.',
  category: 'magic_resist',
  cost: 450,
  sellValue: 315,
  stats: {
    magicResist: 25,
  },
  passives: [],
  isUnique: false,
  tags: ['mr', 'basic'],
};

export const NegatronCloak: ItemDefinition = {
  id: 'negatron_cloak',
  name: 'Negatron Cloak',
  description: 'Strong magic protection.',
  category: 'magic_resist',
  cost: 900,
  sellValue: 630,
  stats: {
    magicResist: 50,
  },
  passives: [],
  isUnique: false,
  tags: ['mr'],
};

// ===================
// Health Items
// ===================

export const RubysCrystal: ItemDefinition = {
  id: 'rubys_crystal',
  name: "Ruby Crystal",
  description: 'Increases health.',
  category: 'health',
  cost: 400,
  sellValue: 280,
  stats: {
    health: 150,
  },
  passives: [],
  isUnique: false,
  tags: ['health', 'basic'],
};

export const GiantsBelt: ItemDefinition = {
  id: 'giants_belt',
  name: "Giant's Belt",
  description: 'Greatly increases health.',
  category: 'health',
  cost: 900,
  sellValue: 630,
  stats: {
    health: 350,
  },
  passives: [],
  isUnique: false,
  tags: ['health'],
};

export const SteraksGage: ItemDefinition = {
  id: 'steraks_gage',
  name: "Sterak's Gage",
  description: 'Grants a shield when taking heavy damage.',
  category: 'health',
  cost: 3100,
  sellValue: 2170,
  stats: {
    health: 400,
    attackDamage: 50,
  },
  passives: [
    {
      id: 'steraks_lifeline',
      name: 'Lifeline',
      description: 'When taking damage that would reduce you below 30% HP, gain a shield for 30% of your max HP for 5 seconds.',
      trigger: 'on_low_health',
      cooldown: 60,
      isUnique: true,
      effect: new LowHealthShieldEffect(0.3, 5),
      healthThreshold: 0.3,
    },
  ],
  isUnique: true,
  tags: ['health', 'ad', 'shield'],
};

// ===================
// Utility Items
// ===================

export const Sheen: ItemDefinition = {
  id: 'sheen',
  name: 'Sheen',
  description: 'Empowers your next attack after casting an ability.',
  category: 'utility',
  cost: 700,
  sellValue: 490,
  stats: {},
  passives: [
    {
      id: 'sheen_spellblade',
      name: 'Spellblade',
      description: 'After casting an ability, your next basic attack deals 100% base AD as bonus damage.',
      trigger: 'on_ability_cast',
      cooldown: 1.5,
      isUnique: true,
      effect: new SpellbladeEffect(1.0),
    },
  ],
  isUnique: false,
  tags: ['spellblade'],
};

export const BootsOfSpeed: ItemDefinition = {
  id: 'boots_of_speed',
  name: 'Boots of Speed',
  description: 'Slightly increases movement speed.',
  category: 'movement',
  cost: 300,
  sellValue: 210,
  stats: {
    movementSpeed: 25,
  },
  passives: [],
  isUnique: true,  // Can only own one pair of boots
  tags: ['boots', 'ms'],
};

// ===================
// Item Registry
// ===================

export const ALL_ITEMS: ItemDefinition[] = [
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

export const ITEM_BY_ID: Map<string, ItemDefinition> = new Map(
  ALL_ITEMS.map(item => [item.id, item])
);

/**
 * Get an item by ID.
 */
export function getItemById(id: string): ItemDefinition | undefined {
  return ITEM_BY_ID.get(id);
}

/**
 * Get items by category.
 */
export function getItemsByCategory(category: ItemDefinition['category']): ItemDefinition[] {
  return ALL_ITEMS.filter(item => item.category === category);
}

/**
 * Get items by tag.
 */
export function getItemsByTag(tag: string): ItemDefinition[] {
  return ALL_ITEMS.filter(item => item.tags.includes(tag));
}
