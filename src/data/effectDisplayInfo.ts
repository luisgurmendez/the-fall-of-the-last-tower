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
