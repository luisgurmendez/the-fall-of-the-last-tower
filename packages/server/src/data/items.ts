/**
 * Server-side item definitions.
 * Contains only the static data needed for server-side calculations.
 * Passives are handled separately from effect class instances.
 */

import type { ChampionBaseStats, ItemSlot } from '@siege/shared';

/**
 * Passive trigger types.
 */
export type ItemPassiveTrigger =
  | 'always'
  | 'on_attack'
  | 'on_hit'
  | 'on_ability_cast'
  | 'on_ability_hit'
  | 'on_take_damage'
  | 'on_kill'
  | 'on_low_health'
  | 'on_interval';

/**
 * Server-side passive definition (data only, no class instances).
 */
export interface ServerItemPassive {
  id: string;
  name: string;
  trigger: ItemPassiveTrigger;
  cooldown: number;
  isUnique: boolean;
  // Effect data - interpreted by server
  effectType: 'lifesteal' | 'thorns' | 'on_hit_damage' | 'shield' | 'spellblade';
  effectData: Record<string, number | string>;
  healthThreshold?: number;
  interval?: number;
}

/**
 * Server-side item definition.
 */
export interface ServerItemDefinition {
  id: string;
  name: string;
  category: string;
  cost: number;
  sellValue: number;
  stats: Partial<ChampionBaseStats>;
  passives: ServerItemPassive[];
  isUnique: boolean;
}

// ===================
// Attack Damage Items
// ===================

const LongSword: ServerItemDefinition = {
  id: 'long_sword',
  name: 'Long Sword',
  category: 'attack_damage',
  cost: 350,
  sellValue: 245,
  stats: { attackDamage: 10 },
  passives: [],
  isUnique: false,
};

const BFSword: ServerItemDefinition = {
  id: 'bf_sword',
  name: 'B.F. Sword',
  category: 'attack_damage',
  cost: 1300,
  sellValue: 910,
  stats: { attackDamage: 40 },
  passives: [],
  isUnique: false,
};

const Bloodthirster: ServerItemDefinition = {
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

const AmplifyingTome: ServerItemDefinition = {
  id: 'amplifying_tome',
  name: 'Amplifying Tome',
  category: 'ability_power',
  cost: 435,
  sellValue: 305,
  stats: { abilityPower: 20 },
  passives: [],
  isUnique: false,
};

const NeedlesslyLargeRod: ServerItemDefinition = {
  id: 'needlessly_large_rod',
  name: 'Needlessly Large Rod',
  category: 'ability_power',
  cost: 1250,
  sellValue: 875,
  stats: { abilityPower: 60 },
  passives: [],
  isUnique: false,
};

const RabadonsDeathcap: ServerItemDefinition = {
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

const Dagger: ServerItemDefinition = {
  id: 'dagger',
  name: 'Dagger',
  category: 'attack_speed',
  cost: 300,
  sellValue: 210,
  stats: { attackSpeed: 0.12 },
  passives: [],
  isUnique: false,
};

const RecurveBow: ServerItemDefinition = {
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

const ClothArmor: ServerItemDefinition = {
  id: 'cloth_armor',
  name: 'Cloth Armor',
  category: 'armor',
  cost: 300,
  sellValue: 210,
  stats: { armor: 15 },
  passives: [],
  isUnique: false,
};

const ChainVest: ServerItemDefinition = {
  id: 'chain_vest',
  name: 'Chain Vest',
  category: 'armor',
  cost: 800,
  sellValue: 560,
  stats: { armor: 40 },
  passives: [],
  isUnique: false,
};

const Thornmail: ServerItemDefinition = {
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

const NullMagicMantle: ServerItemDefinition = {
  id: 'null_magic_mantle',
  name: 'Null-Magic Mantle',
  category: 'magic_resist',
  cost: 450,
  sellValue: 315,
  stats: { magicResist: 25 },
  passives: [],
  isUnique: false,
};

const NegatronCloak: ServerItemDefinition = {
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

const RubysCrystal: ServerItemDefinition = {
  id: 'rubys_crystal',
  name: "Ruby Crystal",
  category: 'health',
  cost: 400,
  sellValue: 280,
  stats: { health: 150 },
  passives: [],
  isUnique: false,
};

const GiantsBelt: ServerItemDefinition = {
  id: 'giants_belt',
  name: "Giant's Belt",
  category: 'health',
  cost: 900,
  sellValue: 630,
  stats: { health: 350 },
  passives: [],
  isUnique: false,
};

const SteraksGage: ServerItemDefinition = {
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

const Sheen: ServerItemDefinition = {
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
      trigger: 'on_ability_cast',
      cooldown: 1.5,
      isUnique: true,
      effectType: 'spellblade',
      effectData: { baseDamagePercent: 1.0 },
    },
  ],
  isUnique: false,
};

const BootsOfSpeed: ServerItemDefinition = {
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

export const ALL_SERVER_ITEMS: ServerItemDefinition[] = [
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

const ITEM_BY_ID = new Map<string, ServerItemDefinition>(
  ALL_SERVER_ITEMS.map(item => [item.id, item])
);

/**
 * Get an item definition by ID.
 */
export function getServerItemById(id: string): ServerItemDefinition | undefined {
  return ITEM_BY_ID.get(id);
}

/**
 * Calculate total stats from equipped items.
 */
export function calculateItemStats(
  items: { definitionId: string }[]
): Partial<ChampionBaseStats> {
  const totalStats: Partial<ChampionBaseStats> = {};

  for (const item of items) {
    if (!item) continue;

    const def = getServerItemById(item.definitionId);
    if (!def) continue;

    for (const [stat, value] of Object.entries(def.stats)) {
      const key = stat as keyof ChampionBaseStats;
      totalStats[key] = (totalStats[key] || 0) + (value as number);
    }
  }

  return totalStats;
}
