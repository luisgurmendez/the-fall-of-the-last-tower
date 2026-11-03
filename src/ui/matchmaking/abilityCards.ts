/**
 * Ability and passive cards for the champion select detail panel: an icon
 * with a tooltip dialog that shows the name, description, costs and scaling.
 */

import { abilityIconUrl, type AbilityIconSlot } from "@/ui/AbilityIconLoader";
import type {
  ChampionDefinition,
  AbilityDefinition,
  PassiveAbilityDefinition,
} from "@siege/shared";
import {
  formatPassiveTrigger,
  interpolateAbilityDescription,
  interpolatePassiveDescription,
  getAbilityScalingInfo,
} from "./abilityText";

/**
 * Create an ability card element for the champion select screen.
 * Shows icon only, with dialog tooltip on hover.
 */
export function createAbilityCard(
  slot: string,
  ability: AbilityDefinition,
  baseStats: ChampionDefinition["baseStats"],
  championId: string,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "ability-card";
  card.dataset.slot = slot;

  // Ability header with icon only
  const header = document.createElement("div");
  header.className = "ability-card-header";

  // Add ability icon
  const iconPath = abilityIconUrl(championId, slot.toLowerCase() as AbilityIconSlot);
  const icon = document.createElement("img");
  icon.className = "ability-icon";
  icon.src = iconPath;
  icon.alt = `${slot} ability`;
  icon.width = 64;
  icon.height = 64;
  // Hide if image fails to load
  icon.onerror = () => { icon.style.display = 'none'; };
  header.appendChild(icon);
  card.appendChild(header);

  // Create dialog tooltip
  const dialog = document.createElement("div");
  dialog.className = "ability-dialog";

  // Dialog header
  const dialogHeader = document.createElement("div");
  dialogHeader.className = "ability-dialog-header";
  dialogHeader.innerHTML = `
      <span class="ability-dialog-slot">${slot}</span>
      <span class="ability-dialog-name">${ability.name}</span>
    `;
  dialog.appendChild(dialogHeader);

  // Description with interpolated values at rank 1
  const description = document.createElement("div");
  description.className = "ability-dialog-description";
  const interpolatedDesc = interpolateAbilityDescription(
    ability,
    1,
    baseStats,
  );
  description.innerHTML = interpolatedDesc;
  dialog.appendChild(description);

  // Stats row (cooldown, cost, range)
  const statParts: string[] = [];
  if (ability.cooldown && ability.cooldown.length > 0) {
    const cdValues = ability.cooldown.map((cd) => cd.toString()).join("/");
    statParts.push(`CD: ${cdValues}s`);
  }
  if (ability.manaCost && ability.manaCost.length > 0) {
    const costValues = ability.manaCost.map((c) => c.toString()).join("/");
    statParts.push(`Cost: ${costValues}`);
  }
  if (ability.range && ability.range > 0) {
    statParts.push(`Range: ${ability.range}`);
  }

  if (statParts.length > 0) {
    const statsRow = document.createElement("div");
    statsRow.className = "ability-dialog-stats";
    statsRow.textContent = statParts.join("  •  ");
    dialog.appendChild(statsRow);
  }

  // Scaling info
  const scalingInfo = getAbilityScalingInfo(ability);
  if (scalingInfo) {
    const scaling = document.createElement("div");
    scaling.className = "ability-dialog-scaling";
    scaling.innerHTML = scalingInfo;
    dialog.appendChild(scaling);
  }

  card.appendChild(dialog);

  return card;
}

/**
 * Create a passive card element for the champion select screen.
 * Shows icon only, with dialog tooltip on hover.
 */
export function createPassiveCard(passive: PassiveAbilityDefinition, championId: string): HTMLElement {
  const card = document.createElement("div");
  card.className = "passive-card";

  // Passive header with icon only
  const header = document.createElement("div");
  header.className = "passive-card-header";

  // Add passive icon
  const iconPath = abilityIconUrl(championId, "passive");
  const icon = document.createElement("img");
  icon.className = "passive-icon";
  icon.src = iconPath;
  icon.alt = "Passive ability";
  icon.width = 64;
  icon.height = 64;
  // Hide if image fails to load
  icon.onerror = () => { icon.style.display = 'none'; };
  header.appendChild(icon);
  card.appendChild(header);

  // Create dialog tooltip
  const dialog = document.createElement("div");
  dialog.className = "passive-dialog";

  // Dialog header
  const dialogHeader = document.createElement("div");
  dialogHeader.className = "passive-dialog-header";
  dialogHeader.innerHTML = `
      <span class="passive-dialog-slot">P</span>
      <span class="passive-dialog-name">${passive.name}</span>
    `;
  dialog.appendChild(dialogHeader);

  // Trigger type
  const trigger = document.createElement("div");
  trigger.className = "passive-dialog-trigger";
  trigger.textContent = `Trigger: ${formatPassiveTrigger(passive.trigger)}`;
  dialog.appendChild(trigger);

  // Description
  const description = document.createElement("div");
  description.className = "passive-dialog-description";
  description.innerHTML = interpolatePassiveDescription(passive);
  dialog.appendChild(description);

  // Stats row (cooldown, stacks)
  const statParts: string[] = [];
  if (passive.internalCooldown) {
    statParts.push(`Cooldown: ${passive.internalCooldown}s`);
  }
  if (passive.maxStacks) {
    statParts.push(`Max Stacks: ${passive.maxStacks}`);
  }
  if (passive.healthThreshold) {
    statParts.push(`Threshold: ${Math.round(passive.healthThreshold * 100)}% HP`);
  }

  if (statParts.length > 0) {
    const statsRow = document.createElement("div");
    statsRow.className = "passive-dialog-stats";
    statsRow.textContent = statParts.join("  •  ");
    dialog.appendChild(statsRow);
  }

  card.appendChild(dialog);

  return card;
}
