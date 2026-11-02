/**
 * How item stats read in the shop and the HUD's tooltips: their label,
 * color, the shop's CSS class, and whether they're a share (shown as %).
 */

import { getItemCatalogEntry, type ItemStats } from '@siege/shared';

export interface ItemStatInfo {
  label: string;
  color: string;
  /** Class of the value in the shop (shop.css .item-stat-value.<class>) */
  cssClass: string;
  /** A share: 0.25 reads +25% */
  percent?: boolean;
  /** After the number (per second...) */
  suffix?: string;
}

/** Every item stat, in the order they're listed */
export const ITEM_STAT_INFO: Record<keyof ItemStats, ItemStatInfo> = {
  attackDamage: { label: 'Attack Damage', color: '#ff6b6b', cssClass: 'ad' },
  lethality: { label: 'Lethality', color: '#ff8a80', cssClass: 'ad' },
  armorPenPercent: { label: 'Armor Penetration', color: '#ff8a80', cssClass: 'ad', percent: true },
  attackSpeed: { label: 'Attack Speed', color: '#f1c40f', cssClass: 'as', percent: true },
  critChance: { label: 'Critical Chance', color: '#e67e22', cssClass: 'crit', percent: true },
  critDamage: { label: 'Critical Damage', color: '#e67e22', cssClass: 'crit', percent: true },
  lifesteal: { label: 'Life Steal', color: '#e74c3c', cssClass: 'health', percent: true },
  omnivamp: { label: 'Omnivamp', color: '#e74c3c', cssClass: 'health', percent: true },
  abilityPower: { label: 'Ability Power', color: '#a855f7', cssClass: 'ap' },
  magicPen: { label: 'Magic Penetration', color: '#c084fc', cssClass: 'ap' },
  magicPenPercent: { label: 'Magic Penetration', color: '#c084fc', cssClass: 'ap', percent: true },
  abilityHaste: { label: 'Ability Haste', color: '#a855f7', cssClass: 'ap' },
  health: { label: 'Health', color: '#2ecc71', cssClass: 'health' },
  healthRegen: { label: 'Health Regen', color: '#2ecc71', cssClass: 'health', suffix: '/s' },
  armor: { label: 'Armor', color: '#f59e0b', cssClass: 'armor' },
  magicResist: { label: 'Magic Resist', color: '#8b5cf6', cssClass: 'mr' },
  resource: { label: 'Mana', color: '#3498db', cssClass: 'mana' },
  resourceRegen: { label: 'Mana Regen', color: '#3498db', cssClass: 'mana', suffix: '/s' },
  healShieldPower: { label: 'Heal & Shield Power', color: '#7bd88f', cssClass: 'support', percent: true },
  tenacity: { label: 'Tenacity', color: '#bcaaa4', cssClass: 'utility', percent: true },
  movementSpeed: { label: 'Movement Speed', color: '#06b6d4', cssClass: 'ms' },
  attackRange: { label: 'Attack Range', color: '#95a5a6', cssClass: 'utility' },
};

/** An item's stats as label, value and info, in display order */
export function listItemStats(stats: ItemStats): { key: string; info: ItemStatInfo; value: string }[] {
  const lines: { key: string; info: ItemStatInfo; value: string }[] = [];
  for (const [key, info] of Object.entries(ITEM_STAT_INFO) as [keyof ItemStats, ItemStatInfo][]) {
    const value = stats[key];
    if (value === undefined || value === 0) continue;
    const number = info.percent ? `${Math.round(value * 100)}%` : `${value}`;
    lines.push({ key, info, value: `+${number}${info.suffix ?? ''}` });
  }
  return lines;
}

/** An item's active, for the shop and tooltips */
export function getItemActive(itemId: string) {
  return getItemCatalogEntry(itemId)?.active;
}

/** A consumable's line: how many it holds, and refilling */
export function describeConsumable(itemId: string): string | null {
  const consumable = getItemCatalogEntry(itemId)?.consumable;
  if (!consumable) return null;
  if (consumable.refills) return `Holds ${consumable.maxCharges} charges; refills at your fountain.`;
  return consumable.maxCharges > 1 ? `Stacks up to ${consumable.maxCharges}; used up when drunk.` : 'Used up when drunk.';
}
