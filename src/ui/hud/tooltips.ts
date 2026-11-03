/**
 * Hover tooltips for abilities, the passive, active effects, buffs and items.
 * Each one is drawn above the element it describes and clamped to the screen.
 */

import { Dimensions } from '@/core/canvas';
import RenderUtils from '@/render/utils';
import type { StatModifier, AbilitySlot } from '@siege/shared';
import { getEffectDisplayInfo } from '@/data/effectDisplayInfo';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import { getItemCategoryColor } from '@/ui/hud/items';
import { drawItemIcon, ITEM_ICON_SIZE } from '@/ui/itemIcons';
import { getItemActive, listItemStats } from '@/data/itemStats';
import { ITEM_KEYS } from '@/core/input/itemKeys';
import { getItemPassive } from '@/data/items';
import { wrapText, interpolateAbilityDescription, interpolatePassiveDescription, formatTriggerType, formatBuffName } from '@/ui/hud/tooltipText';
import type { EquippedItem, HUDActiveEffect, HUDChampionData, HUDPassive } from '@/ui/hud/types';

/** Draw ability tooltip above the ability box */
export function drawAbilityTooltip(
  ctx: CanvasRenderingContext2D,
  abilityX: number,
  abilityY: number,
  slot: AbilitySlot,
  champion: HUDChampionData,
  accentColor: string
): void {
  const ability = champion.getAbility(slot);
  if (!ability) return;

  const name = ability.definition?.name || slot;
  const rawDescription = ability.definition?.description || 'No description';
  const rank = ability.rank ?? 0;
  const maxRank = ability.definition?.maxRank ?? (slot === 'R' ? 3 : 5);

  // Interpolate description with actual calculated values
  const stats = champion.getStats();
  const description = interpolateAbilityDescription(
    rawDescription,
    ability.definition,
    rank,
    stats,
    champion.getBaseHealth()
  );

  // Get cost info
  const targetDesc = ability.getTargetDescription?.();
  const range = targetDesc?.range ?? 0;

  // Get mana cost at current rank
  const manaCost = ability.definition?.manaCost?.[Math.max(0, rank - 1)] ?? 0;

  // Tooltip dimensions
  const tooltipWidth = PANEL.tooltipWidth;
  const padding = PANEL.tooltipPadding;
  const lineHeight = 18;

  // Calculate tooltip height based on content
  const descriptionLines = wrapText(description, tooltipWidth - padding * 2, 14);
  const tooltipHeight = padding * 2 + lineHeight * 2 + descriptionLines.length * lineHeight + lineHeight * 2;

  // Position tooltip above the ability box
  const tooltipX = abilityX + PANEL.abilityBoxSize / 2 - tooltipWidth / 2;
  const tooltipY = abilityY - tooltipHeight - 10;

  // Clamp to screen bounds
  const clampedX = Math.max(10, Math.min(tooltipX, Dimensions.w - tooltipWidth - 10));
  const clampedY = Math.max(10, tooltipY);

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.fillRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  // Border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  let currentY = clampedY + padding;

  // Ability name
  RenderUtils.renderBitmapText(
    ctx,
    `${slot} - ${name}`,
    clampedX + padding,
    currentY,
    { color: accentColor, size: 26, shadow: false }
  );
  currentY += lineHeight + 4;

  // Rank indicators
  let rankText = 'Rank: ';
  for (let i = 1; i <= maxRank; i++) {
    rankText += i <= rank ? '●' : '○';
  }
  RenderUtils.renderBitmapText(
    ctx,
    rankText,
    clampedX + padding,
    currentY,
    { color: rank > 0 ? '#FFD700' : HUD_COLORS.textDim, size: 20, shadow: false }
  );
  currentY += lineHeight;

  // Description
  descriptionLines.forEach((line) => {
    RenderUtils.renderBitmapText(
      ctx,
      line,
      clampedX + padding,
      currentY,
      { color: HUD_COLORS.text, size: 20, shadow: false }
    );
    currentY += lineHeight;
  });

  currentY += 4;

  // Cost and range line
  const costParts: string[] = [];
  if (manaCost > 0) {
    costParts.push(`Cost: ${manaCost}`);
  }
  if (range > 0) {
    costParts.push(`Range: ${range}`);
  }

  if (costParts.length > 0) {
    RenderUtils.renderBitmapText(
      ctx,
      costParts.join('  |  '),
      clampedX + padding,
      currentY,
      { color: '#00CED1', size: 20, shadow: false }
    );
  }

  // Cooldown at the current rank (rank 1 before it's learned), right aligned
  const cooldown = ability.definition?.cooldown?.[Math.max(0, rank - 1)] ?? 0;
  if (cooldown > 0) {
    RenderUtils.renderBitmapText(
      ctx,
      `CD: ${cooldown}s`,
      clampedX + tooltipWidth - padding,
      currentY,
      { color: '#AAAAAA', size: 20, shadow: false, rightAlign: true }
    );
  }

  ctx.restore();
}

/** Draw passive ability tooltip above the passive box */
export function drawPassiveTooltip(
  ctx: CanvasRenderingContext2D,
  passiveX: number,
  passiveY: number,
  passive: HUDPassive,
  champion: HUDChampionData
): void {
  const padding = PANEL.tooltipPadding;
  const lineHeight = 18;

  // Tooltip dimensions
  const tooltipWidth = PANEL.tooltipWidth;

  // Calculate tooltip height based on content (its values at the champion's level)
  const description = interpolatePassiveDescription(
    passive.definition.description,
    passive.definition,
    champion.getLevel(),
    champion.getStats(),
    champion.getBaseHealth()
  );
  const descriptionLines = wrapText(description, tooltipWidth - padding * 2, 14);
  const headerHeight = lineHeight + 4;
  const triggerHeight = lineHeight;
  const descHeight = descriptionLines.length * lineHeight;
  const stackHeight = passive.definition.usesStacks ? lineHeight : 0;
  const cooldownHeight = passive.definition.internalCooldown ? lineHeight + 4 : 0;
  const tooltipHeight = padding * 2 + headerHeight + triggerHeight + descHeight + stackHeight + cooldownHeight;

  // Position tooltip above the passive box
  const tooltipX = passiveX + PANEL.passiveBoxSize / 2 - tooltipWidth / 2;
  const tooltipY = passiveY - tooltipHeight - 10;

  // Clamp to screen bounds
  const clampedX = Math.max(10, Math.min(tooltipX, Dimensions.w - tooltipWidth - 10));
  const clampedY = Math.max(10, tooltipY);

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.fillRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  // Border (gold for passive)
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  let currentY = clampedY + padding;

  // Passive name
  RenderUtils.renderBitmapText(
    ctx,
    `P - ${passive.definition.name}`,
    clampedX + padding,
    currentY,
    { color: '#FFD700', size: 26, shadow: false }
  );
  currentY += headerHeight;

  // Trigger type
  const triggerLabel = formatTriggerType(passive.definition.trigger);
  RenderUtils.renderBitmapText(
    ctx,
    `Trigger: ${triggerLabel}`,
    clampedX + padding,
    currentY,
    { color: '#B8860B', size: 20, shadow: false }
  );
  currentY += triggerHeight;

  // Description
  descriptionLines.forEach((line) => {
    RenderUtils.renderBitmapText(
      ctx,
      line,
      clampedX + padding,
      currentY,
      { color: HUD_COLORS.text, size: 20, shadow: false }
    );
    currentY += lineHeight;
  });

  // Stack info
  if (passive.definition.usesStacks) {
    // Show stacks with max if there's a cap, otherwise just show current stacks
    const stackName = passive.definition.stackName ?? (passive.maxStacks > 0 ? 'Stacks' : 'Souls');
    const stackText = passive.maxStacks > 0
      ? `${stackName}: ${passive.stacks}/${passive.maxStacks}`
      : `${stackName}: ${passive.stacks}`;
    RenderUtils.renderBitmapText(
      ctx,
      stackText,
      clampedX + padding,
      currentY,
      { color: passive.stacks > 0 ? '#FFD700' : HUD_COLORS.textDim, size: 20, shadow: false }
    );
    currentY += lineHeight;
  }

  // Cooldown info
  if (passive.definition.internalCooldown) {
    currentY += 4;
    const cooldownText = passive.cooldownRemaining > 0
      ? `Cooldown: ${passive.cooldownRemaining.toFixed(1)}s / ${passive.definition.internalCooldown}s`
      : `Cooldown: ${passive.definition.internalCooldown}s`;
    RenderUtils.renderBitmapText(
      ctx,
      cooldownText,
      clampedX + tooltipWidth / 2,
      currentY,
      { color: '#AAAAAA', size: 20, shadow: false, centered: true }
    );
  }

  ctx.restore();
}

/** Draw effect tooltip above the effect icon */
export function drawEffectTooltip(
  ctx: CanvasRenderingContext2D,
  effectX: number,
  effectY: number,
  effect: HUDActiveEffect
): void {
  const displayInfo = getEffectDisplayInfo(effect.definitionId);
  const padding = PANEL.tooltipPadding;
  const lineHeight = 18;

  // Calculate tooltip dimensions
  const tooltipWidth = 220;
  const headerHeight = lineHeight + 4;
  const descHeight = lineHeight;
  const stackHeight = effect.stacks > 1 ? lineHeight : 0;
  const durationHeight = effect.timeRemaining > 0 ? lineHeight + 4 : 0;
  const tooltipHeight = padding * 2 + headerHeight + descHeight + stackHeight + durationHeight;

  // Position tooltip above the effect icon
  const tooltipX = effectX + PANEL.effectSize / 2 - tooltipWidth / 2;
  const tooltipY = effectY - tooltipHeight - 8;

  // Clamp to screen bounds
  const clampedX = Math.max(10, Math.min(tooltipX, Dimensions.w - tooltipWidth - 10));
  const clampedY = Math.max(10, tooltipY);

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.fillRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  // Border with category color
  ctx.strokeStyle = displayInfo.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  let currentY = clampedY + padding;

  // Effect name
  RenderUtils.renderBitmapText(
    ctx,
    displayInfo.name,
    clampedX + padding,
    currentY,
    { color: displayInfo.color, size: 24, shadow: false }
  );
  currentY += headerHeight;

  // Description
  RenderUtils.renderBitmapText(
    ctx,
    displayInfo.description,
    clampedX + padding,
    currentY,
    { color: HUD_COLORS.textDim, size: 18, shadow: false }
  );
  currentY += descHeight;

  // Stacks
  if (effect.stacks > 1) {
    RenderUtils.renderBitmapText(
      ctx,
      `Stacks: ${effect.stacks}`,
      clampedX + padding,
      currentY,
      { color: '#FFD700', size: 18, shadow: false }
    );
    currentY += lineHeight;
  }

  // Duration remaining
  if (effect.timeRemaining > 0) {
    currentY += 4;
    RenderUtils.renderBitmapText(
      ctx,
      `Duration: ${effect.timeRemaining.toFixed(1)}s`,
      clampedX + tooltipWidth / 2,
      currentY,
      { color: '#AAAAAA', size: 18, shadow: false, centered: true }
    );
  }

  ctx.restore();
}

/** Draw buff tooltip above the buff icon */
export function drawBuffTooltip(
  ctx: CanvasRenderingContext2D,
  buffX: number,
  buffY: number,
  buff: StatModifier,
  accentColor: string
): void {
  const padding = PANEL.tooltipPadding;
  const lineHeight = 18;

  // Build stat lines from the buff
  const statLines: { label: string; value: string; color: string }[] = [];

  // Format flat stat bonuses
  if (buff.flat) {
    const statLabels: Record<string, { label: string; color: string }> = {
      attackDamage: { label: 'Attack Damage', color: '#ff6b6b' },
      abilityPower: { label: 'Ability Power', color: '#a855f7' },
      attackSpeed: { label: 'Attack Speed', color: '#f1c40f' },
      movementSpeed: { label: 'Movement Speed', color: '#06b6d4' },
      armor: { label: 'Armor', color: '#f59e0b' },
      magicResist: { label: 'Magic Resist', color: '#8b5cf6' },
      maxHealth: { label: 'Health', color: '#2ecc71' },
      maxResource: { label: 'Mana', color: '#3498db' },
      attackRange: { label: 'Attack Range', color: '#95a5a6' },
      healthRegen: { label: 'Health Regen', color: '#2ecc71' },
      resourceRegen: { label: 'Resource Regen', color: '#3498db' },
    };

    for (const [stat, value] of Object.entries(buff.flat)) {
      if (value !== 0 && value !== undefined) {
        const info = statLabels[stat] || { label: stat, color: '#ffffff' };
        const sign = value > 0 ? '+' : '';
        statLines.push({
          label: info.label,
          value: `${sign}${typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}`,
          color: info.color,
        });
      }
    }
  }

  // Format percent stat bonuses
  if (buff.percent) {
    const statLabels: Record<string, { label: string; color: string }> = {
      attackDamage: { label: 'Attack Damage', color: '#ff6b6b' },
      abilityPower: { label: 'Ability Power', color: '#a855f7' },
      attackSpeed: { label: 'Attack Speed', color: '#f1c40f' },
      movementSpeed: { label: 'Movement Speed', color: '#06b6d4' },
      armor: { label: 'Armor', color: '#f59e0b' },
      magicResist: { label: 'Magic Resist', color: '#8b5cf6' },
      maxHealth: { label: 'Health', color: '#2ecc71' },
      maxResource: { label: 'Mana', color: '#3498db' },
    };

    for (const [stat, value] of Object.entries(buff.percent)) {
      if (value !== 0 && value !== undefined) {
        const info = statLabels[stat] || { label: stat, color: '#ffffff' };
        const percentValue = ((value as number) - 1) * 100;
        const sign = percentValue > 0 ? '+' : '';
        statLines.push({
          label: info.label,
          value: `${sign}${percentValue.toFixed(0)}%`,
          color: info.color,
        });
      }
    }
  }

  // Calculate tooltip dimensions
  const tooltipWidth = 220;
  const headerHeight = lineHeight + 4;
  const statsHeight = statLines.length * lineHeight;
  const durationHeight = buff.timeRemaining !== undefined ? lineHeight + 4 : 0;
  const tooltipHeight = padding * 2 + headerHeight + statsHeight + durationHeight;

  // Position tooltip above the buff icon
  const tooltipX = buffX + PANEL.buffSize / 2 - tooltipWidth / 2;
  const tooltipY = buffY - tooltipHeight - 8;

  // Clamp to screen bounds
  const clampedX = Math.max(10, Math.min(tooltipX, Dimensions.w - tooltipWidth - 10));
  const clampedY = Math.max(10, tooltipY);

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.fillRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  // Border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  let currentY = clampedY + padding;

  // Buff name (source)
  const displayName = formatBuffName(buff.source);
  RenderUtils.renderBitmapText(
    ctx,
    displayName,
    clampedX + padding,
    currentY,
    { color: accentColor, size: 24, shadow: false }
  );
  currentY += headerHeight;

  // Stat bonuses
  statLines.forEach((stat) => {
    RenderUtils.renderBitmapText(
      ctx,
      stat.label,
      clampedX + padding,
      currentY,
      { color: HUD_COLORS.textDim, size: 18, shadow: false }
    );
    RenderUtils.renderBitmapText(
      ctx,
      stat.value,
      clampedX + tooltipWidth - padding,
      currentY,
      { color: stat.color, size: 18, shadow: false, rightAlign: true }
    );
    currentY += lineHeight;
  });

  // Duration remaining
  if (buff.timeRemaining !== undefined && buff.timeRemaining > 0) {
    currentY += 4;
    RenderUtils.renderBitmapText(
      ctx,
      `Time: ${buff.timeRemaining.toFixed(1)}s`,
      clampedX + tooltipWidth / 2,
      currentY,
      { color: '#AAAAAA', size: 18, shadow: false, centered: true }
    );
  }

  ctx.restore();
}

/** How wide an item's tooltip is */
export const ITEM_TOOLTIP_WIDTH = 340;

/** Draw item tooltip above the item slot */
export function drawItemTooltip(
  ctx: CanvasRenderingContext2D,
  itemX: number,
  itemY: number,
  equipped: EquippedItem
): void {
  const item = equipped.definition;
  const padding = PANEL.tooltipPadding;
  const lineHeight = 18;

  // Build stat lines from item stats
  const statLines = listItemStats(item.stats).map(({ info, value }) => ({ label: info.label, value, color: info.color }));

  // Calculate tooltip dimensions
  const tooltipWidth = ITEM_TOOLTIP_WIDTH;
  const headerHeight = ITEM_ICON_SIZE + 8;
  const statsHeight = statLines.length * lineHeight;
  const sellHeight = lineHeight + 4;

  // Wrap description text (use smaller char width for pixel font)
  const descLines = item.description ? wrapText(item.description, tooltipWidth - padding * 2, 16, 0.45) : [];
  const descHeight = descLines.length * lineHeight + 4;

  const passiveData = (item.passiveIds || []).map((passiveId: string) => {
    const passive = getItemPassive(passiveId);
    return {
      name: passive?.name ?? passiveId,
      descLines: passive ? wrapText(passive.description, tooltipWidth - padding * 2, 16, 0.45) : [],
    };
  });
  // Its active (and key) first
  const active = getItemActive(item.id);
  if (active) {
    const key = ITEM_KEYS[equipped.slot];
    const cooldown = active.cooldown >= 1 ? ` - ${active.cooldown}s` : '';
    passiveData.unshift({
      name: `Active (${key}): ${active.name}${cooldown}`,
      descLines: wrapText(active.description, tooltipWidth - padding * 2, 16, 0.45),
    });
  }
  let passivesHeight = 0;
  passiveData.forEach((p: { name: string; descLines: string[] }) => {
    passivesHeight += lineHeight + p.descLines.length * lineHeight + 4;
  });
  if (passiveData.length > 0) passivesHeight += 4; // Extra spacing before passives

  const tooltipHeight = padding * 2 + headerHeight + descHeight + statsHeight + passivesHeight + sellHeight;

  // Position tooltip above the item slot
  const tooltipX = itemX + PANEL.itemBoxSize / 2 - tooltipWidth / 2;
  const tooltipY = itemY - tooltipHeight - 8;

  // Clamp to screen bounds
  const clampedX = Math.max(10, Math.min(tooltipX, Dimensions.w - tooltipWidth - 10));
  const clampedY = Math.max(10, tooltipY);

  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.fillRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  // Border (item category color)
  ctx.strokeStyle = getItemCategoryColor(item.category);
  ctx.lineWidth = 2;
  ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

  let currentY = clampedY + padding;

  // Item icon and name
  const nameColor = getItemCategoryColor(item.category);
  drawItemIcon(ctx, item, clampedX + padding, currentY, 1, (symbol) => {
    RenderUtils.renderBitmapText(ctx, symbol, clampedX + padding + 4, currentY + 4, { color: nameColor, size: 24, shadow: false });
  });
  RenderUtils.renderBitmapText(
    ctx,
    item.name,
    clampedX + padding + ITEM_ICON_SIZE + 8,
    currentY + 4,
    { color: nameColor, size: 24, shadow: false }
  );
  currentY += headerHeight;

  // Description (wrapped)
  descLines.forEach((line) => {
    RenderUtils.renderBitmapText(
      ctx,
      line,
      clampedX + padding,
      currentY,
      { color: HUD_COLORS.textDim, size: 16, shadow: false }
    );
    currentY += lineHeight;
  });
  currentY += 4;

  // Stat bonuses
  statLines.forEach((stat) => {
    RenderUtils.renderBitmapText(
      ctx,
      stat.label,
      clampedX + padding,
      currentY,
      { color: HUD_COLORS.text, size: 18, shadow: false }
    );
    RenderUtils.renderBitmapText(
      ctx,
      stat.value,
      clampedX + tooltipWidth - padding,
      currentY,
      { color: stat.color, size: 18, shadow: false, rightAlign: true }
    );
    currentY += lineHeight;
  });

  // Passives (with wrapped descriptions)
  if (passiveData.length > 0) {
    currentY += 4;
    passiveData.forEach((passive: { name: string; descLines: string[] }) => {
      RenderUtils.renderBitmapText(
        ctx,
        passive.name,
        clampedX + padding,
        currentY,
        { color: '#FFD700', size: 18, shadow: false }
      );
      currentY += lineHeight;
      passive.descLines.forEach((line: string) => {
        RenderUtils.renderBitmapText(
          ctx,
          line,
          clampedX + padding,
          currentY,
          { color: HUD_COLORS.textDim, size: 16, shadow: false }
        );
        currentY += lineHeight;
      });
      currentY += 4;
    });
  }

  // Sell value
  currentY += 4;
  RenderUtils.renderBitmapText(
    ctx,
    `Sell: ${item.sellValue}g`,
    clampedX + tooltipWidth / 2,
    currentY,
    { color: '#AAAAAA', size: 18, shadow: false, centered: true }
  );

  ctx.restore();
}
