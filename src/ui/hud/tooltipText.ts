/**
 * Text helpers for the HUD tooltips: word wrapping, ability description
 * interpolation with scaling breakdowns, and display names for passive
 * triggers and buff sources.
 */

import { type ChampionStats, type AbilityScaling, calculateAbilityValue } from '@siege/shared';
import type { HUDAbilityDefinition } from '@/ui/hud/types';

/** Format trigger type for display */
export function formatTriggerType(trigger: string): string {
  const triggerLabels: Record<string, string> = {
    'on_attack': 'On Attack',
    'on_hit': 'On Hit',
    'on_take_damage': 'On Taking Damage',
    'on_ability_cast': 'On Ability Cast',
    'on_ability_hit': 'On Ability Hit',
    'on_kill': 'On Kill',
    'on_low_health': 'Low Health',
    'always': 'Always Active',
    'on_interval': 'Periodic',
  };
  return triggerLabels[trigger] || trigger;
}

/** Wrap text to fit within a given width */
export function wrapText(text: string, maxWidth: number, fontSize: number, charWidthFactor = 0.6): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  // Approximate character width (for pixel font, use smaller factor ~0.45)
  const charWidth = fontSize * charWidthFactor;
  const maxChars = Math.floor(maxWidth / charWidth);

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, force break
        lines.push(word.substring(0, maxChars));
        currentLine = word.substring(maxChars);
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Interpolate ability description by replacing placeholders with calculated values.
 * Replaces {damage}, {heal}, {shield} with actual values including scaling breakdown,
 * and {effectDuration} and {attackSpeedBonus}. An ability not learned yet shows its
 * first rank's values. A placeholder with nothing to fill it shows "?".
 */
export function interpolateAbilityDescription(
  description: string,
  definition: HUDAbilityDefinition | null | undefined,
  rank: number,
  stats: ChampionStats
): string {
  if (!definition) {
    return description.replace(/\{[a-zA-Z]+\}/g, '?');
  }
  rank = Math.max(1, rank);

  let result = description;

  // Calculate bonus health (current max - base at level 1)
  // Approximation: assume base health is around 500-600
  const bonusHealth = Math.max(0, stats.maxHealth - 580);
  const missingHealth = stats.maxHealth - stats.health;

  const statValues = {
    attackDamage: stats.attackDamage,
    abilityPower: stats.abilityPower,
    bonusHealth,
    maxHealth: stats.maxHealth,
    missingHealth,
    armor: stats.armor,
    magicResist: stats.magicResist,
  };

  // Replace {damage} placeholder
  if (definition.damage?.scaling) {
    const value = calculateAbilityValue(definition.damage.scaling, rank, statValues);
    const formatted = formatScalingValue(value, definition.damage.scaling, statValues);
    result = result.replace('{damage}', formatted);
  }

  // Replace {heal} placeholder
  if (definition.heal?.scaling) {
    const value = calculateAbilityValue(definition.heal.scaling, rank, statValues);
    const formatted = formatScalingValue(value, definition.heal.scaling, statValues);
    result = result.replace('{heal}', formatted);
  }

  // Replace {shield} placeholder
  if (definition.shield?.scaling) {
    const value = calculateAbilityValue(definition.shield.scaling, rank, statValues);
    const formatted = formatScalingValue(value, definition.shield.scaling, statValues);
    result = result.replace('{shield}', formatted);
  }

  if (definition.effectDuration !== undefined) {
    result = result.replace('{effectDuration}', String(definition.effectDuration));
  }

  const attackSpeedBonus = definition.statTransform?.statModifiers?.attackSpeed;
  if (attackSpeedBonus) {
    const bonus = attackSpeedBonus[Math.min(rank, attackSpeedBonus.length) - 1];
    result = result.replace('{attackSpeedBonus}', String(Math.round(bonus * 100)));
  }

  // Nothing to fill it: better a "?" than raw braces
  return result.replace(/\{[a-zA-Z]+\}/g, '?');
}

/**
 * Format a scaling value with breakdown showing base + scaling contributions.
 * Example: "150 (+80% AD)" or "200 (+50% AP)"
 */
function formatScalingValue(
  totalValue: number,
  scaling: AbilityScaling,
  stats: {
    attackDamage?: number;
    abilityPower?: number;
    bonusHealth?: number;
    maxHealth?: number;
    armor?: number;
    magicResist?: number;
  }
): string {
  const rounded = Math.round(totalValue);
  const scalingParts: string[] = [];

  // Add scaling ratio breakdowns
  if (scaling.adRatio && stats.attackDamage) {
    const adBonus = Math.round(stats.attackDamage * scaling.adRatio);
    if (adBonus > 0) {
      scalingParts.push(`+${Math.round(scaling.adRatio * 100)}% AD`);
    }
  }
  if (scaling.apRatio && stats.abilityPower) {
    const apBonus = Math.round(stats.abilityPower * scaling.apRatio);
    if (apBonus > 0) {
      scalingParts.push(`+${Math.round(scaling.apRatio * 100)}% AP`);
    }
  }
  if (scaling.bonusHealthRatio && stats.bonusHealth) {
    scalingParts.push(`+${Math.round(scaling.bonusHealthRatio * 100)}% Bonus HP`);
  }
  if (scaling.maxHealthRatio && stats.maxHealth) {
    scalingParts.push(`+${Math.round(scaling.maxHealthRatio * 100)}% Max HP`);
  }
  if (scaling.armorRatio && stats.armor) {
    scalingParts.push(`+${Math.round(scaling.armorRatio * 100)}% Armor`);
  }
  if (scaling.magicResistRatio && stats.magicResist) {
    scalingParts.push(`+${Math.round(scaling.magicResistRatio * 100)}% MR`);
  }

  if (scalingParts.length > 0) {
    return `${rounded} (${scalingParts.join(' ')})`;
  }

  return rounded.toString();
}

/** Format buff source name for display */
export function formatBuffName(source: string): string {
  // Convert snake_case or camelCase to Title Case
  return source
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
