/**
 * EffectDisplayRegistry - Client-side effect display information.
 *
 * Maps server effect IDs to display data including names, icons,
 * and stat modifiers for the HUD.
 */

import type { ChampionBaseStats } from '@/champions/types';

/**
 * Display information for an effect.
 */
export interface EffectDisplayInfo {
  /** Effect ID (matches server definition) */
  id: string;
  /** Display name */
  name: string;
  /** Whether this is a buff or debuff */
  category: 'buff' | 'debuff' | 'neutral';
  /** Icon character or emoji */
  icon?: string;
  /** Flat stat modifiers */
  flat?: Partial<ChampionBaseStats>;
  /** Percent stat modifiers (1.1 = +10%, 0.9 = -10%) */
  percent?: Partial<Record<keyof ChampionBaseStats, number>>;
}

/**
 * Registry of all effect display information.
 */
const EFFECT_DISPLAY_INFO: Record<string, EffectDisplayInfo> = {
  // ====================
  // Crowd Control Effects
  // ====================
  stun: {
    id: 'stun',
    name: 'Stunned',
    category: 'debuff',
    icon: '!',
  },
  silence: {
    id: 'silence',
    name: 'Silenced',
    category: 'debuff',
    icon: 'X',
  },
  root: {
    id: 'root',
    name: 'Rooted',
    category: 'debuff',
    icon: '#',
  },
  slow: {
    id: 'slow',
    name: 'Slowed',
    category: 'debuff',
    icon: 'v',
  },
  knockup: {
    id: 'knockup',
    name: 'Airborne',
    category: 'debuff',
    icon: '^',
  },
  suppress: {
    id: 'suppress',
    name: 'Suppressed',
    category: 'debuff',
    icon: '!',
  },
  blind: {
    id: 'blind',
    name: 'Blinded',
    category: 'debuff',
    icon: 'o',
  },
  disarm: {
    id: 'disarm',
    name: 'Disarmed',
    category: 'debuff',
    icon: '-',
  },
  grounded: {
    id: 'grounded',
    name: 'Grounded',
    category: 'debuff',
    icon: '_',
  },
  taunt: {
    id: 'taunt',
    name: 'Taunted',
    category: 'debuff',
    icon: 'T',
  },

  // ====================
  // Slow Effects (specific %)
  // ====================
  slow_30: {
    id: 'slow_30',
    name: 'Slowed',
    category: 'debuff',
    icon: 'v',
    percent: { movementSpeed: 0.70 }, // -30%
  },
  slow_40: {
    id: 'slow_40',
    name: 'Slowed',
    category: 'debuff',
    icon: 'v',
    percent: { movementSpeed: 0.60 }, // -40%
  },

  // ====================
  // Speed Buffs
  // ====================
  speed_20: {
    id: 'speed_20',
    name: 'Hastened',
    category: 'buff',
    icon: '>',
    percent: { movementSpeed: 1.20 }, // +20%
  },
  speed_30: {
    id: 'speed_30',
    name: 'Hastened',
    category: 'buff',
    icon: '>',
    percent: { movementSpeed: 1.30 }, // +30%
  },

  // ====================
  // Stat Buff Effects
  // ====================
  attack_speed_buff: {
    id: 'attack_speed_buff',
    name: 'Attack Speed Up',
    category: 'buff',
    icon: 'A',
    percent: { attackSpeed: 1.10 }, // +10% per stack
  },
  movement_speed_buff: {
    id: 'movement_speed_buff',
    name: 'Speed Up',
    category: 'buff',
    icon: 'M',
    flat: { movementSpeed: 20 },
  },
  armor_buff: {
    id: 'armor_buff',
    name: 'Armor Up',
    category: 'buff',
    icon: 'D',
    flat: { armor: 10 },
  },
  magic_resist_buff: {
    id: 'magic_resist_buff',
    name: 'Magic Resist Up',
    category: 'buff',
    icon: 'R',
    flat: { magicResist: 10 },
  },
  attack_damage_buff: {
    id: 'attack_damage_buff',
    name: 'Attack Damage Up',
    category: 'buff',
    icon: 'S',
    flat: { attackDamage: 10 },
  },

  // ====================
  // Stat Debuff Effects
  // ====================
  armor_reduction: {
    id: 'armor_reduction',
    name: 'Armor Reduced',
    category: 'debuff',
    icon: 'd',
    flat: { armor: -10 },
  },
  magic_resist_reduction: {
    id: 'magic_resist_reduction',
    name: 'Magic Resist Reduced',
    category: 'debuff',
    icon: 'r',
    flat: { magicResist: -10 },
  },
  movement_speed_slow: {
    id: 'movement_speed_slow',
    name: 'Slowed',
    category: 'debuff',
    icon: 'v',
    percent: { movementSpeed: 0.90 }, // -10% per stack
  },
  attack_speed_slow: {
    id: 'attack_speed_slow',
    name: 'Attack Speed Reduced',
    category: 'debuff',
    icon: 'a',
    percent: { attackSpeed: 0.90 }, // -10% per stack
  },

  // ====================
  // Over-Time Effects
  // ====================
  burn: {
    id: 'burn',
    name: 'Burning',
    category: 'debuff',
    icon: '*',
  },
  poison: {
    id: 'poison',
    name: 'Poisoned',
    category: 'debuff',
    icon: 'P',
  },
  bleed: {
    id: 'bleed',
    name: 'Bleeding',
    category: 'debuff',
    icon: 'B',
  },
  healing_over_time: {
    id: 'healing_over_time',
    name: 'Regenerating',
    category: 'buff',
    icon: '+',
  },

  // ====================
  // Gorath-specific Effects
  // ====================
  gorath_fortify_buff: {
    id: 'gorath_fortify_buff',
    name: 'Stone Skin',
    category: 'buff',
    icon: 'G',
    percent: { armor: 1.30 }, // +30% armor
  },
  gorath_fortify_mr_buff: {
    id: 'gorath_fortify_mr_buff',
    name: 'Stone Skin',
    category: 'buff',
    icon: 'G',
    percent: { magicResist: 1.30 }, // +30% MR
  },

  // ====================
  // Vex-specific Effects
  // ====================
  vex_mark: {
    id: 'vex_mark',
    name: 'Marked',
    category: 'debuff',
    icon: 'V',
  },
  vex_stealth: {
    id: 'vex_stealth',
    name: 'Shadow Shroud',
    category: 'buff',
    icon: 'S',
  },
  vex_death_mark: {
    id: 'vex_death_mark',
    name: 'Death Mark',
    category: 'debuff',
    icon: 'X',
  },
};

/**
 * Get display info for an effect by ID.
 */
export function getEffectDisplayInfo(effectId: string): EffectDisplayInfo | undefined {
  return EFFECT_DISPLAY_INFO[effectId];
}

/**
 * Get all effect display info.
 */
export function getAllEffectDisplayInfo(): EffectDisplayInfo[] {
  return Object.values(EFFECT_DISPLAY_INFO);
}

/**
 * Check if an effect ID is known.
 */
export function isKnownEffect(effectId: string): boolean {
  return effectId in EFFECT_DISPLAY_INFO;
}
