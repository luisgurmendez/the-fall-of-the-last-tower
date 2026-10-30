/**
 * Text for the champion select ability and passive tooltips: passive trigger
 * labels, ability descriptions with their values filled in, and scaling
 * previews ("60/95/130 (+70% AD)").
 */

import type {
  ChampionDefinition,
  AbilityDefinition,
  AbilityScaling,
} from "@siege/shared";

/**
 * Format passive trigger type for display.
 */
export function formatPassiveTrigger(trigger: string): string {
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

/**
 * Interpolate ability description with calculated values.
 */
export function interpolateAbilityDescription(
  ability: AbilityDefinition,
  rank: number,
  baseStats: ChampionDefinition["baseStats"],
): string {
  let description = ability.description;

  const stats = {
    attackDamage: baseStats.attackDamage,
    abilityPower: baseStats.abilityPower,
    bonusHealth: 0,
    maxHealth: baseStats.health,
    armor: baseStats.armor,
    magicResist: baseStats.magicResist,
  };

  // Replace {damage}
  if (ability.damage?.scaling) {
    const value = calculateScalingValue(
      ability.damage.scaling,
      rank,
      stats,
    );
    const formatted = formatScalingPreview(
      value,
      ability.damage.scaling,
    );
    description = description.replace("{damage}", formatted);
  }

  // Replace {heal}
  if (ability.heal?.scaling) {
    const value = calculateScalingValue(
      ability.heal.scaling,
      rank,
      stats,
    );
    const formatted = formatScalingPreview(value, ability.heal.scaling);
    description = description.replace("{heal}", formatted);
  }

  // Replace {shield}
  if (ability.shield?.scaling) {
    const value = calculateScalingValue(
      ability.shield.scaling,
      rank,
      stats,
    );
    const formatted = formatScalingPreview(
      value,
      ability.shield.scaling,
    );
    description = description.replace("{shield}", formatted);
  }

  return description;
}

/**
 * Calculate a scaling value at a given rank.
 */
export function calculateScalingValue(
  scaling: AbilityScaling,
  rank: number,
  stats: {
    attackDamage?: number;
    abilityPower?: number;
    bonusHealth?: number;
    maxHealth?: number;
    armor?: number;
    magicResist?: number;
  },
): number {
  if (rank < 1 || rank > scaling.base.length) return 0;

  let value = scaling.base[rank - 1];

  if (scaling.adRatio && stats.attackDamage) {
    value += stats.attackDamage * scaling.adRatio;
  }
  if (scaling.apRatio && stats.abilityPower) {
    value += stats.abilityPower * scaling.apRatio;
  }
  if (scaling.bonusHealthRatio && stats.bonusHealth) {
    value += stats.bonusHealth * scaling.bonusHealthRatio;
  }
  if (scaling.maxHealthRatio && stats.maxHealth) {
    value += stats.maxHealth * scaling.maxHealthRatio;
  }
  if (scaling.armorRatio && stats.armor) {
    value += stats.armor * scaling.armorRatio;
  }
  if (scaling.magicResistRatio && stats.magicResist) {
    value += stats.magicResist * scaling.magicResistRatio;
  }

  return value;
}

/**
 * Format scaling preview with base values and ratios.
 */
export function formatScalingPreview(value: number, scaling: AbilityScaling): string {
  const baseValues = scaling.base.join("/");
  const scalingParts: string[] = [];

  if (scaling.adRatio) {
    scalingParts.push(
      `<span class="scaling-ad">+${Math.round(scaling.adRatio * 100)}% AD</span>`,
    );
  }
  if (scaling.apRatio) {
    scalingParts.push(
      `<span class="scaling-ap">+${Math.round(scaling.apRatio * 100)}% AP</span>`,
    );
  }
  if (scaling.bonusHealthRatio) {
    scalingParts.push(
      `<span class="scaling-hp">+${Math.round(scaling.bonusHealthRatio * 100)}% Bonus HP</span>`,
    );
  }
  if (scaling.maxHealthRatio) {
    scalingParts.push(
      `<span class="scaling-hp">+${Math.round(scaling.maxHealthRatio * 100)}% Max HP</span>`,
    );
  }
  if (scaling.armorRatio) {
    scalingParts.push(
      `<span class="scaling-armor">+${Math.round(scaling.armorRatio * 100)}% Armor</span>`,
    );
  }
  if (scaling.magicResistRatio) {
    scalingParts.push(
      `<span class="scaling-mr">+${Math.round(scaling.magicResistRatio * 100)}% MR</span>`,
    );
  }

  if (scalingParts.length > 0) {
    return `${baseValues} (${scalingParts.join(" ")})`;
  }

  return baseValues;
}

/**
 * Get scaling info HTML for an ability.
 */
export function getAbilityScalingInfo(ability: AbilityDefinition): string | null {
  const parts: string[] = [];

  if (ability.damage?.scaling) {
    const dmgType =
      ability.damage.type === "physical"
        ? "Physical"
        : ability.damage.type === "magic"
          ? "Magic"
          : "True";
    parts.push(
      `<span class="scaling-label">${dmgType} Damage:</span> ${formatScalingPreview(0, ability.damage.scaling)}`,
    );
  }

  if (ability.heal?.scaling) {
    parts.push(
      `<span class="scaling-label">Heal:</span> ${formatScalingPreview(0, ability.heal.scaling)}`,
    );
  }

  if (ability.shield?.scaling) {
    const duration = ability.shield.duration
      ? ` (${ability.shield.duration}s)`
      : "";
    parts.push(
      `<span class="scaling-label">Shield${duration}:</span> ${formatScalingPreview(0, ability.shield.scaling)}`,
    );
  }

  return parts.length > 0 ? parts.join("<br>") : null;
}
