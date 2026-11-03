/**
 * Client-side effect display information.
 * Maps effect IDs to display data (name, description, category, icon).
 */

import type { EffectCategory } from '@siege/shared';

/**
 * Display information for an effect.
 */
export interface EffectDisplayInfo {
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Buff, debuff, or neutral */
  category: EffectCategory;
  /** Icon character or emoji */
  icon: string;
  /** Color for the effect icon border */
  color: string;
}

/**
 * Default colors by effect category.
 */
export const EFFECT_CATEGORY_COLORS: Record<EffectCategory, string> = {
  buff: '#2ecc71',    // Green for buffs
  debuff: '#e74c3c',  // Red for debuffs
  neutral: '#9b59b6', // Purple for neutral
};

/**
 * Effect display info registry.
 * Maps effect definition IDs to display information.
 */
const EFFECT_DISPLAY_INFO: Record<string, EffectDisplayInfo> = {
  // ===================
  // CC Effects
  // ===================
  stun: {
    name: 'Stunned',
    description: 'Cannot move, attack, or cast abilities.',
    category: 'debuff',
    icon: '!',
    color: '#e74c3c',
  },
  silence: {
    name: 'Silenced',
    description: 'Cannot cast abilities.',
    category: 'debuff',
    icon: 'X',
    color: '#9b59b6',
  },
  root: {
    name: 'Rooted',
    description: 'Cannot move but can attack and cast.',
    category: 'debuff',
    icon: '#',
    color: '#8b4513',
  },
  slow: {
    name: 'Slowed',
    description: 'Movement speed reduced.',
    category: 'debuff',
    icon: 'v',
    color: '#3498db',
  },
  knockup: {
    name: 'Airborne',
    description: 'Knocked into the air, unable to act.',
    category: 'debuff',
    icon: '^',
    color: '#95a5a6',
  },
  suppress: {
    name: 'Suppressed',
    description: 'Completely locked down.',
    category: 'debuff',
    icon: '!',
    color: '#2c3e50',
  },
  blind: {
    name: 'Blinded',
    description: 'Basic attacks miss.',
    category: 'debuff',
    icon: 'o',
    color: '#f39c12',
  },
  disarm: {
    name: 'Disarmed',
    description: 'Cannot basic attack.',
    category: 'debuff',
    icon: '-',
    color: '#7f8c8d',
  },
  grounded: {
    name: 'Grounded',
    description: 'Cannot use movement abilities.',
    category: 'debuff',
    icon: 'G',
    color: '#795548',
  },
  taunt: {
    name: 'Taunted',
    description: 'Forced to attack the source.',
    category: 'debuff',
    icon: 'T',
    color: '#e91e63',
  },

  // ===================
  // Slow effects
  // ===================
  slow_30: {
    name: 'Slowed',
    description: 'Movement speed reduced by 30%.',
    category: 'debuff',
    icon: 'v',
    color: '#3498db',
  },
  slow_40: {
    name: 'Slowed',
    description: 'Movement speed reduced by 40%.',
    category: 'debuff',
    icon: 'v',
    color: '#2980b9',
  },

  // ===================
  // Speed buffs
  // ===================
  speed_20: {
    name: 'Hastened',
    description: 'Movement speed increased by 20%.',
    category: 'buff',
    icon: '>',
    color: '#2ecc71',
  },
  speed_30: {
    name: 'Hastened',
    description: 'Movement speed increased by 30%.',
    category: 'buff',
    icon: '>',
    color: '#27ae60',
  },

  // ===================
  // Stat Buff Effects
  // ===================
  attack_speed_buff: {
    name: 'Attack Speed Up',
    description: 'Attack speed increased.',
    category: 'buff',
    icon: 'A',
    color: '#f1c40f',
  },
  movement_speed_buff: {
    name: 'Speed Up',
    description: 'Movement speed increased.',
    category: 'buff',
    icon: '>',
    color: '#06b6d4',
  },
  armor_buff: {
    name: 'Armor Up',
    description: 'Armor increased.',
    category: 'buff',
    icon: 'D',
    color: '#f59e0b',
  },
  magic_resist_buff: {
    name: 'Magic Resist Up',
    description: 'Magic resistance increased.',
    category: 'buff',
    icon: 'M',
    color: '#8b5cf6',
  },
  attack_damage_buff: {
    name: 'Attack Damage Up',
    description: 'Attack damage increased.',
    category: 'buff',
    icon: '+',
    color: '#ff6b6b',
  },

  // ===================
  // Stat Debuff Effects
  // ===================
  armor_reduction: {
    name: 'Armor Reduced',
    description: 'Armor decreased.',
    category: 'debuff',
    icon: 'd',
    color: '#f59e0b',
  },
  magic_resist_reduction: {
    name: 'Magic Resist Reduced',
    description: 'Magic resistance decreased.',
    category: 'debuff',
    icon: 'm',
    color: '#8b5cf6',
  },
  movement_speed_slow: {
    name: 'Slowed',
    description: 'Movement speed reduced.',
    category: 'debuff',
    icon: 'v',
    color: '#3498db',
  },
  attack_speed_slow: {
    name: 'Attack Speed Reduced',
    description: 'Attack speed decreased.',
    category: 'debuff',
    icon: 'a',
    color: '#f1c40f',
  },

  // ===================
  // Over-Time Effects
  // ===================
  // ===================
  // Champion Markers
  // ===================
  vile_transformed: {
    name: 'Restoration of Vilix',
    description: 'Transformed: melee range, bonus stats and a damaging aura.',
    category: 'buff',
    icon: 'V',
    color: '#a855f7',
  },

  // ===================
  // Champion Effects
  // ===================
  lume_guiding_glow_amp: {
    name: 'Exposed by Light',
    description: 'Takes more damage from Lume.',
    category: 'debuff',
    icon: 'L',
    color: '#f1c40f',
  },
  lume_guiding_glow_speed: {
    name: 'Guiding Glow',
    description: 'Moving faster.',
    category: 'buff',
    icon: 'L',
    color: '#f1c40f',
  },
  slow_10: {
    name: 'Slowed',
    description: 'Movement speed reduced.',
    category: 'debuff',
    icon: 'S',
    color: '#3498db',
  },
  slow_20: {
    name: 'Slowed',
    description: 'Movement speed reduced.',
    category: 'debuff',
    icon: 'S',
    color: '#3498db',
  },
  vex_empowered: {
    name: 'Shadow Step',
    description: 'The next attack is empowered.',
    category: 'buff',
    icon: 'E',
    color: '#8e44ad',
  },
  vex_ninja_mode: {
    name: 'Ninja Mode',
    description: 'Empowered for a short time.',
    category: 'buff',
    icon: 'N',
    color: '#8e44ad',
  },
  vile_invulnerable: {
    name: 'Veil of Darkness',
    description: 'Takes no damage.',
    category: 'buff',
    icon: 'I',
    color: '#7e22ce',
  },
  vile_post_veil_speed: {
    name: 'Dark Swiftness',
    description: 'Moving faster.',
    category: 'buff',
    icon: '>',
    color: '#7e22ce',
  },
  vile_q_slow: {
    name: 'Black Arrow',
    description: 'Slowed.',
    category: 'debuff',
    icon: 'S',
    color: '#7e22ce',
  },
  vile_trap_caught: {
    name: 'Caught',
    description: "Caught by a trap: Vile's other traps don't catch you for a few seconds.",
    category: 'debuff',
    icon: 'T',
    color: '#7e22ce',
  },
  vile_root: {
    name: 'Roots of Vilix',
    description: 'Rooted in place.',
    category: 'debuff',
    icon: 'R',
    color: '#7e22ce',
  },
  vile_rooted_self: {
    name: 'Veil of Darkness',
    description: 'Rooted while veiled.',
    category: 'debuff',
    icon: 'R',
    color: '#7e22ce',
  },
  vile_slow_resist: {
    name: 'Dark Resilience',
    description: 'Slows are weaker.',
    category: 'buff',
    icon: 'D',
    color: '#7e22ce',
  },
  vile_stealth: {
    name: 'Veil of Darkness',
    description: 'Invisible to enemies.',
    category: 'buff',
    icon: 'V',
    color: '#7e22ce',
  },

  // ===================
  // Item Passives
  // ===================
  item_starfall: {
    name: 'Starfall',
    description: 'Your next basic attack deals bonus magic damage (75% of your ability power).',
    category: 'buff',
    icon: '*',
    color: '#c39bff',
  },
  item_hold_the_line: {
    name: 'Hold the Line',
    description: 'Shielded for 30% of your max health.',
    category: 'buff',
    icon: 'H',
    color: '#d0d6e0',
  },
  wounds: {
    name: "Wounds",
    description: "Heals 40% less.",
    category: 'debuff',
    icon: 'W',
    color: '#c0392b',
  },
  item_burn: {
    name: "Burning",
    description: "Takes magic damage over time from an item.",
    category: 'debuff',
    icon: '~',
    color: '#ff7a1a',
  },
  slow_25: {
    name: "Slowed",
    description: "25% slower.",
    category: 'debuff',
    icon: 'v',
    color: '#5dade2',
  },
  item_sunder: {
    name: "Sundered",
    description: "Less armor (5% per stack).",
    category: 'debuff',
    icon: 'S',
    color: '#a1887f',
  },
  item_momentum: {
    name: "Momentum",
    description: "+8 movement speed.",
    category: 'buff',
    icon: '>',
    color: '#06b6d4',
  },
  item_wanderlust: {
    name: "Wanderlust",
    description: "+8 movement speed out of combat.",
    category: 'buff',
    icon: '>',
    color: '#06b6d4',
  },
  item_lone_wolf: {
    name: "Lone Wolf",
    description: "+10 movement speed, +15 armor and magic resist with no ally near.",
    category: 'buff',
    icon: 'L',
    color: '#90a4ae',
  },
  item_static: {
    name: "Static",
    description: "Your next basic attack discharges into nearby enemies.",
    category: 'buff',
    icon: 'Z',
    color: '#4dd0e1',
  },
  item_hymn: {
    name: "Hymn",
    description: "+20% attack speed and bonus magic damage on basic attacks.",
    category: 'buff',
    icon: '♪',
    color: '#ffd54f',
  },
  item_rally: {
    name: "Rally",
    description: "+10 armor and +10 magic resist.",
    category: 'buff',
    icon: 'R',
    color: '#ffe082',
  },
  item_veil: {
    name: "Veil",
    description: "The next enemy ability is blocked.",
    category: 'buff',
    icon: 'V',
    color: '#b39ddb',
  },
  item_draught: {
    name: "Healing Draught",
    description: "Regenerating health.",
    category: 'buff',
    icon: '+',
    color: '#7bd88f',
  },
  item_flask: {
    name: "Wayfarer's Flask",
    description: "Regenerating health.",
    category: 'buff',
    icon: '+',
    color: '#7bd88f',
  },
  item_flask_mana: {
    name: "Wayfarer's Flask",
    description: "Regenerating mana.",
    category: 'buff',
    icon: '+',
    color: '#7cc6ff',
  },
  item_ironbark: {
    name: "Ironbark Elixir",
    description: "+250 max health and 20% tenacity.",
    category: 'buff',
    icon: 'I',
    color: '#8d6e4a',
  },
  item_stormfury: {
    name: "Stormfury Elixir",
    description: "+18 attack damage and +30 ability power.",
    category: 'buff',
    icon: 'F',
    color: '#ff6e6e',
  },
  item_stasis: {
    name: "Stillness",
    description: "Invulnerable and frozen.",
    category: 'buff',
    icon: 'H',
    color: '#ffd54f',
  },
  item_unchain_speed: {
    name: "Unchained",
    description: "+40% movement speed.",
    category: 'buff',
    icon: '>',
    color: '#67e8f9',
  },
  item_frost_nova: {
    name: "Frost Nova",
    description: "55% slower.",
    category: 'debuff',
    icon: '*',
    color: '#81d4fa',
  },

  // ===================
  // Jungle Buffs
  // ===================
  crest_of_insight: {
    name: 'Crest of Insight',
    description: 'Blue buff: +15 ability haste.',
    category: 'buff',
    icon: 'B',
    color: '#3498db',
  },
  crest_of_insight_regen: {
    name: 'Crest of Insight',
    description: 'Blue buff: +4 mana/energy per second.',
    category: 'buff',
    icon: '+',
    color: '#3498db',
  },
  crest_of_cinders: {
    name: 'Crest of Cinders',
    description: 'Red buff: basic attacks burn and slow. +4 health per second.',
    category: 'buff',
    icon: 'R',
    color: '#e74c3c',
  },
  cinders_burn: {
    name: 'Cinders',
    description: 'Burning from a red buff attack.',
    category: 'debuff',
    icon: '*',
    color: '#e67e22',
  },
  dragons_might: {
    name: "Dragon's Might",
    description: 'Dragon slain: +8% attack damage.',
    category: 'buff',
    icon: 'D',
    color: '#e67e22',
  },
  dragons_might_power: {
    name: "Dragon's Might",
    description: 'Dragon slain: +8% ability power.',
    category: 'buff',
    icon: 'D',
    color: '#9b59b6',
  },
  uruk_spear_charge: {
    name: 'Spear Charge',
    description: 'Your next basic attack reaches further and deals bonus damage.',
    category: 'buff',
    icon: 'W',
    color: '#9fd8ff',
  },
  uruk_piercing: {
    name: 'Piercing',
    description: 'Your physical damage ignores some armor.',
    category: 'buff',
    icon: 'P',
    color: '#d8e4ec',
  },
  uruk_hunt: {
    name: "Hunter's Instinct",
    description: 'A hurt enemy champion is near: +12% movement speed and +10% attack speed.',
    category: 'buff',
    icon: 'H',
    color: '#ffb347',
  },
  uruk_hunt_speed: {
    name: "Hunter's Instinct",
    description: 'A hurt enemy champion is near: +10% attack speed.',
    category: 'buff',
    icon: 'H',
    color: '#ffb347',
  },
  oitboil_overheated: {
    name: 'Overheated',
    description: '25% more damage, but the fire burns you each second. Blue Fire puts it out.',
    category: 'buff',
    icon: '!',
    color: '#ff7020',
  },
  oitboil_exhausted: {
    name: 'Exhausted',
    description: 'Spent by the flamethrower: you can walk, but not attack or cast.',
    category: 'debuff',
    icon: 'Z',
    color: '#9a9aa4',
  },
  oitboil_exhausted_disarm: {
    name: 'Exhausted',
    description: 'Spent by the flamethrower: you can walk, but not attack or cast.',
    category: 'debuff',
    icon: 'Z',
    color: '#9a9aa4',
  },
  oitboil_flamethrower: {
    name: 'Flamethrower',
    description: 'Pouring fire forward.',
    category: 'buff',
    icon: 'R',
    color: '#ff7020',
  },
  elora_poison_arrow: {
    name: 'Poison Arrow',
    description: 'Your next basic attack is poisoned.',
    category: 'buff',
    icon: 'Q',
    color: '#7cc850',
  },
  elora_venom: {
    name: 'Venom',
    description: "Poisoned by Elora's arrow: magic damage each second.",
    category: 'debuff',
    icon: '☠',
    color: '#7cc850',
  },
  elora_dexterity: {
    name: 'Dexterity',
    description: '35% attack speed.',
    category: 'buff',
    icon: 'E',
    color: '#d8c890',
  },
  caelum_embolden: {
    name: 'Emboldened',
    description: '20% more attack damage and ability power.',
    category: 'buff',
    icon: 'W',
    color: '#9be070',
  },
  caelum_embolden_power: {
    name: 'Emboldened',
    description: '20% more attack damage and ability power.',
    category: 'buff',
    icon: 'W',
    color: '#9be070',
  },
  fenris_feral: {
    name: 'Feral',
    description: 'Under 40% health: abilities deal 30% more damage, Vicious Bite heals twice as much, 12% movement speed.',
    category: 'buff',
    icon: '!',
    color: '#e04040',
  },
  fenris_bloodthirst: {
    name: 'Bloodthirst',
    description: '35% attack speed; basic attacks heal you. A champion kill heals you to full.',
    category: 'buff',
    icon: 'R',
    color: '#c02020',
  },
  calamitus_lavaborn: {
    name: 'Lavaborn',
    description: 'Standing in your lava: +15 armor and magic resist.',
    category: 'buff',
    icon: 'L',
    color: '#ff7a1a',
  },
  calamitus_lavaborn_mr: {
    name: 'Lavaborn',
    description: 'Standing in your lava: +15 armor and magic resist.',
    category: 'buff',
    icon: 'L',
    color: '#ff7a1a',
  },
  protobot_learning: {
    name: 'Machine Learning',
    description: '+3 armor and magic resist per lesson, learned from the enemy champions that hit you.',
    category: 'buff',
    icon: 'M',
    color: '#4ae0ff',
  },
  protobot_learning_mr: {
    name: 'Machine Learning',
    description: '+3 armor and magic resist per lesson, learned from the enemy champions that hit you.',
    category: 'buff',
    icon: 'M',
    color: '#4ae0ff',
  },
  hop_eating: {
    name: 'Eating',
    description: "Munching a carrot: can't move.",
    category: 'debuff',
    icon: 'W',
    color: '#ff8a1a',
  },
  hop_sugar_rush: {
    name: 'Sugar Rush',
    description: '30% attack speed.',
    category: 'buff',
    icon: 'W',
    color: '#ff8ab8',
  },
  zhakrul_venom: {
    name: 'Ancient Venom',
    description: "Poisoned by Zhak'rul: magic damage each second for each dose, up to 3.",
    category: 'debuff',
    icon: '☠',
    color: '#8be04a',
  },
  zhakrul_ancient_venom: {
    name: 'Ancient Venom',
    description: 'Three doses: the venom is ancient and deals 40% more damage.',
    category: 'debuff',
    icon: '☠',
    color: '#5aa02a',
  },
  heartwood_pact: {
    name: 'Heartwood Pact',
    description: 'Rootwyrm slain: +12 armor.',
    category: 'buff',
    icon: 'H',
    color: '#7cb342',
  },
  heartwood_pact_ward: {
    name: 'Heartwood Pact',
    description: 'Rootwyrm slain: +12 magic resist.',
    category: 'buff',
    icon: 'H',
    color: '#9ccc65',
  },
  heartwood_pact_sap: {
    name: 'Heartwood Pact',
    description: 'Rootwyrm slain: +5 health regeneration per second.',
    category: 'buff',
    icon: 'H',
    color: '#558b2f',
  },

  burn: {
    name: 'Burning',
    description: 'Taking magic damage over time.',
    category: 'debuff',
    icon: '*',
    color: '#e67e22',
  },
  poison: {
    name: 'Poisoned',
    description: 'Taking damage over time.',
    category: 'debuff',
    icon: 'P',
    color: '#27ae60',
  },
  bleed: {
    name: 'Bleeding',
    description: 'Taking physical damage over time.',
    category: 'debuff',
    icon: 'B',
    color: '#c0392b',
  },
  healing_over_time: {
    name: 'Regenerating',
    description: 'Healing over time.',
    category: 'buff',
    icon: '+',
    color: '#2ecc71',
  },

  // ===================
  // Champion-Specific Effects
  // ===================
  gorath_fortify_buff: {
    name: 'Stone Skin',
    description: 'Armor increased by 30%.',
    category: 'buff',
    icon: 'S',
    color: '#8b7355',
  },
  gorath_fortify_mr_buff: {
    name: 'Stone Skin',
    description: 'Magic resist increased by 30%.',
    category: 'buff',
    icon: 'S',
    color: '#8b5cf6',
  },
  vex_mark: {
    name: 'Marked',
    description: 'Marked for bonus damage.',
    category: 'debuff',
    icon: 'X',
    color: '#9b59b6',
  },
  vex_stealth: {
    name: 'Shadow Shroud',
    description: 'Invisible to enemies.',
    category: 'buff',
    icon: '?',
    color: '#2c3e50',
  },
  vex_death_mark: {
    name: 'Death Mark',
    description: 'Will take bonus damage when mark detonates.',
    category: 'debuff',
    icon: '!',
    color: '#2c3e50',
  },

  // ===================
  // Warrior Effects
  // ===================
  warrior_shield: {
    name: 'Shield Wall',
    description: 'Protected by a shield.',
    category: 'buff',
    icon: 'W',
    color: '#3498db',
  },
  warrior_undying_resolve: {
    name: 'Undying Resolve',
    description: 'Armor increased by 20%.',
    category: 'buff',
    icon: 'R',
    color: '#f59e0b',
  },

  // ===================
  // Magnus Effects
  // ===================
  magnus_shield: {
    name: 'Arcane Barrier',
    description: 'Protected by a magic shield.',
    category: 'buff',
    icon: 'M',
    color: '#9b59b6',
  },

  // ===================
  // Elara Effects
  // ===================
  elara_barrier: {
    name: 'Holy Barrier',
    description: 'Protected by a divine shield.',
    category: 'buff',
    icon: 'E',
    color: '#f1c40f',
  },
  elara_speed: {
    name: 'Divine Haste',
    description: 'Movement speed increased.',
    category: 'buff',
    icon: '>',
    color: '#f1c40f',
  },
};

/**
 * Default display info for unknown effects.
 */
const DEFAULT_EFFECT_INFO: EffectDisplayInfo = {
  name: 'Unknown Effect',
  description: 'An unknown effect.',
  category: 'neutral',
  icon: '?',
  color: '#9b59b6',
};

/**
 * Get display information for an effect by ID.
 */
export function getEffectDisplayInfo(effectId: string): EffectDisplayInfo {
  const info = EFFECT_DISPLAY_INFO[effectId];
  if (info) {
    return info;
  }

  // Return a default with the effect ID as name
  return {
    ...DEFAULT_EFFECT_INFO,
    name: formatEffectName(effectId),
  };
}

/**
 * Format an effect ID into a display name.
 * Converts snake_case to Title Case.
 */
function formatEffectName(effectId: string): string {
  return effectId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Whether an effect has its own display info (not the generic default).
 */
export function hasEffectDisplayInfo(effectId: string): boolean {
  return effectId in EFFECT_DISPLAY_INFO;
}

/**
 * Check if an effect is a buff (positive).
 */
export function isBuffEffect(effectId: string): boolean {
  const info = EFFECT_DISPLAY_INFO[effectId];
  return info?.category === 'buff';
}

/**
 * Check if an effect is a debuff (negative).
 */
export function isDebuffEffect(effectId: string): boolean {
  const info = EFFECT_DISPLAY_INFO[effectId];
  return info?.category === 'debuff';
}
