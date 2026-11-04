/**
 * Ability bar: the passive box, the Q/W/E/R boxes (icons, cooldown overlays,
 * recast and charge states), the level-up buttons above them and the health
 * and resource bars below them. Caches the box and button positions in the
 * HUDContext for hit testing.
 */

import RenderUtils from '@/render/utils';
import type { AbilitySlot } from '@siege/shared';
import { abilityIconKey, type AbilityIconSlot } from '@/ui/AbilityIconLoader';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import { drawHealthBar, drawResourceBar } from '@/ui/hud/resourceBars';
import type { HUDAbility, HUDChampionData, HUDContext } from '@/ui/hud/types';
import { getControls } from '@/core/input/controls';
import { abilityAction, keyLabel } from '@/core/input/keyBindings';

/** How long a slot flashes red after pressing an ability that can't be cast */
export const DENIED_FLASH_MS = 300;
const NO_MANA_TINT = 'rgba(40, 90, 200, 0.45)';
const DENIED_COLOR = '#e74c3c';

/**
 * Whether the champion can't pay for a learned ability's current rank.
 */
export function lacksResourceFor(ability: HUDAbility, champion: HUDChampionData): boolean {
  if (ability.rank <= 0) return false;
  const cost = ability.definition?.manaCost?.[ability.rank - 1] ?? 0;
  return cost > champion.getCurrentResource();
}

/**
 * Whether pressing an ability's key would cast it (learned, ready or
 * recastable, affordable).
 */
export function canCastAbility(ability: HUDAbility | undefined, champion: HUDChampionData): boolean {
  if (!ability || ability.rank <= 0) return false;
  if ((ability.recastWindowRemaining ?? 0) > 0) return true;
  return ability.isReady && !lacksResourceFor(ability, champion);
}

/** Draw the passive ability panel */
export function drawPassivePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const passive = champion.getPassive();
  const size = PANEL.passiveBoxSize;
  const isHovered = hud.hoverState.passive;

  // Cache position for hit testing
  hud.passiveBox = { x, y, size };

  // Background (gold tint for passive, brighter when hovered)
  ctx.fillStyle = isHovered ? '#4a4a3c' : '#2a2a1e';
  ctx.fillRect(x, y, size, size);

  // Try to draw passive icon
  const championId = hud.config.championId;
  let iconDrawn = false;
  if (championId) {
    iconDrawn = hud.iconLoader.drawIcon(ctx, championId, 'passive', x, y, size);
  }

  // Cooldown overlay if on cooldown
  if (passive && passive.cooldownRemaining > 0 && passive.definition.internalCooldown) {
    const cooldownProgress = 1 - (passive.cooldownRemaining / passive.definition.internalCooldown);
    ctx.fillStyle = HUD_COLORS.cooldownOverlay;
    ctx.fillRect(x, y, size, size * (1 - cooldownProgress));
  }

  // Border (gold for passive, highlight when hovered or active)
  if (isHovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
  } else if (passive?.isActive) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = '#B8860B'; // Dark gold
    ctx.lineWidth = 2;
  }
  ctx.strokeRect(x, y, size, size);

  // Only show "P" label if no icon (fallback)
  if (!iconDrawn) {
    const labelColor = passive?.isActive ? '#FFD700' : (passive ? HUD_COLORS.text : HUD_COLORS.textDim);
    RenderUtils.renderBitmapText(
      ctx,
      'P',
      x + size / 2,
      y + size / 2 - 18,
      { color: labelColor, size: 28, centered: true }
    );
  }

  // Stack counter (bottom right) if passive uses stacks
  if (passive && passive.definition.usesStacks) {
    const stackText = `${passive.stacks}`;
    RenderUtils.renderBitmapText(
      ctx,
      stackText,
      x + size - 6,
      y + size - 20,
      { color: passive.stacks > 0 ? '#FFD700' : HUD_COLORS.textDim, size: 18, rightAlign: true, shadow: true }
    );
  }

  // Cooldown timer (center bottom)
  if (passive && passive.cooldownRemaining > 0) {
    RenderUtils.renderBitmapText(
      ctx,
      passive.cooldownRemaining.toFixed(0),
      x + size / 2,
      y + size - 18,
      { color: HUD_COLORS.text, size: 18, centered: true, shadow: true }
    );
  }

  // Active indicator glow
  if (passive?.isActive) {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.shadowBlur = 0;
  }
}

/** Draw the abilities panel with health/mana bars and level-up buttons */
export function drawAbilitiesPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const width = PANEL.abilitiesWidth;
  const skillPoints = champion.getSkillPoints();

  // Clear level-up buttons cache
  hud.levelUpButtons.clear();

  // Draw ability boxes
  const slots: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
  const boxSize = PANEL.abilityBoxSize;
  const spacing = PANEL.abilitySpacing;
  const totalAbilitiesWidth = slots.length * boxSize + (slots.length - 1) * spacing;
  const abilitiesStartX = x + (width - totalAbilitiesWidth) / 2;

  // Calculate ability Y position (with space for level-up buttons above)
  const levelUpButtonHeight = skillPoints > 0 ? PANEL.levelUpButtonHeight + PANEL.levelUpButtonGap : 0;
  const abilityY = y + levelUpButtonHeight;

  slots.forEach((slot, i) => {
    const boxX = abilitiesStartX + i * (boxSize + spacing);
    // Cache position for hit testing
    hud.abilityBoxes.set(slot, { x: boxX, y: abilityY, size: boxSize });
    drawAbilityBox(ctx, boxX, abilityY, boxSize, slot, champion, hud);

    // Draw level-up button above ability if skill points available
    if (skillPoints > 0) {
      drawLevelUpButton(ctx, boxX, y, boxSize, slot, champion, hud);
    }
  });

  // Health bar below abilities
  const barY = abilityY + PANEL.abilitiesHeight + PANEL.barSpacing;
  drawHealthBar(ctx, x, barY, width, champion);

  // Mana/Resource bar below health
  if (hud.config.showManaBar) {
    const manaBarY = barY + PANEL.barHeight + PANEL.barSpacing;
    drawResourceBar(ctx, x, manaBarY, width, champion, hud.config.resourceColor);
  }
}

/** Draw a level-up button above an ability */
function drawLevelUpButton(
  ctx: CanvasRenderingContext2D,
  abilityX: number,
  y: number,
  abilitySize: number,
  slot: AbilitySlot,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const ability = champion.getAbility(slot);
  const currentRank = ability?.rank ?? 0;
  const maxRank = slot === 'R' ? 3 : 5;

  // Don't show button if ability is maxed
  if (currentRank >= maxRank) return;

  // Check R level requirements
  if (slot === 'R') {
    const level = champion.getLevel();
    const rRequiredLevels = [6, 11, 16];
    if (level < rRequiredLevels[currentRank]) return;
  }

  const buttonWidth = PANEL.levelUpButtonWidth;
  const buttonHeight = PANEL.levelUpButtonHeight;
  const buttonX = abilityX + (abilitySize - buttonWidth) / 2;
  const buttonY = y;

  // Cache button position for hit testing
  hud.levelUpButtons.set(slot, { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight });

  const isHovered = hud.hoveredLevelUpButton === slot;
  const pulseIntensity = Math.sin(hud.levelUpPulseTime * 4) * 0.5 + 0.5;

  // Button background with pulse
  if (isHovered) {
    ctx.fillStyle = HUD_COLORS.levelUpButtonHover;
  } else {
    // Interpolate between gold and bright gold based on pulse
    const r = Math.floor(255);
    const g = Math.floor(215 + pulseIntensity * 40);
    const b = Math.floor(0 + pulseIntensity * 100);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  }
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

  // Button border
  ctx.strokeStyle = isHovered ? '#ffffff' : HUD_COLORS.background;
  ctx.lineWidth = isHovered ? 2 : 1;
  ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

  // Plus sign
  RenderUtils.renderBitmapText(
    ctx,
    '+',
    buttonX + buttonWidth / 2,
    buttonY - 2,
    { color: HUD_COLORS.background, size: 18, centered: true, shadow: false }
  );
}

/** Draw a single ability box */
function drawAbilityBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  slot: AbilitySlot,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const ability = champion.getAbility(slot);
  // Hovered, or aimed before its cast: lit up
  const isHovered = hud.hoverState.ability === slot || hud.armedAbility === slot;
  let progress = 1;
  let isReady = true;
  let recastWindowRemaining = 0;

  if (ability) {
    try {
      progress = typeof ability.cooldownProgress === 'number' ? ability.cooldownProgress : 1;
      isReady = typeof ability.isReady === 'boolean' ? ability.isReady : progress >= 1;
      recastWindowRemaining = ability.recastWindowRemaining ?? 0;
    } catch {
      // Fallback if getters throw
      progress = 1;
      isReady = true;
      recastWindowRemaining = 0;
    }
  }

  // Check if recast is available
  const hasRecast = recastWindowRemaining > 0;

  // Background (brighter when hovered, special color for recast)
  if (hasRecast) {
    ctx.fillStyle = '#2a3a2a'; // Greenish background for recast
  } else {
    ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.backgroundLight;
  }
  ctx.fillRect(x, y, size, size);

  // Try to draw ability icon
  const championId = hud.config.championId;
  // An ability swapped into the slot (Nocthar's colossus's) has its own icon
  const iconSlot: AbilityIconSlot = abilityIconKey(championId ?? '', slot, ability?.swappedAbilityId);
  let iconDrawn = false;

  if (championId) {
    iconDrawn = hud.iconLoader.drawIcon(ctx, championId, iconSlot, x, y, size);
  }

  // Cooldown overlay (drawn on top of icon) - but not when recast is available
  if (!isReady && !hasRecast) {
    ctx.fillStyle = HUD_COLORS.cooldownOverlay;
    ctx.fillRect(x, y, size, size * (1 - progress));
  }

  // Ready but not affordable: tinted blue
  const lacksMana = !!ability && isReady && !hasRecast && lacksResourceFor(ability, champion);
  if (lacksMana) {
    ctx.fillStyle = NO_MANA_TINT;
    ctx.fillRect(x, y, size, size);
  }

  // Border (highlight when hovered, golden glow for recast)
  if (hasRecast) {
    // Golden glowing border for recast available
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, size, size);
    // Inner glow effect
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
  } else if (isHovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);
  } else {
    ctx.strokeStyle = isReady && !lacksMana ? hud.config.accentColor : HUD_COLORS.abilityNotReady;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
  }

  // Pressed while it couldn't be cast: a red flash
  const deniedAt = hud.deniedAt.get(slot);
  const sinceDenied = deniedAt === undefined ? Infinity : performance.now() - deniedAt;
  if (sinceDenied < DENIED_FLASH_MS) {
    const fade = 1 - sinceDenied / DENIED_FLASH_MS;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = DENIED_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 1, y - 1, size + 2, size + 2);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.25)';
    ctx.fillRect(x, y, size, size);
    ctx.restore();
  }

  // Only show key label if no icon (fallback)
  if (!iconDrawn) {
    RenderUtils.renderBitmapText(
      ctx,
      keyLabel(getControls().keyFor(abilityAction(slot))),
      x + size / 2,
      y + size / 2 - 18,
      { color: isReady || hasRecast ? HUD_COLORS.text : HUD_COLORS.textDim, size: 32, centered: true }
    );
  }

  // Check if this ability is being charged
  const isCharging = hud.chargeState?.slot === slot;

  // Charge progress overlay (fills from bottom to top)
  if (isCharging) {
    const chargeProgress = hud.chargeState!.progress;
    // Draw dark overlay for uncharged portion
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, size, size * (1 - chargeProgress));
    // Draw charge fill from bottom
    ctx.fillStyle = 'rgba(255, 165, 0, 0.4)'; // Orange tint for charging
    ctx.fillRect(x, y + size * (1 - chargeProgress), size, size * chargeProgress);
    // Draw glowing border while charging
    ctx.strokeStyle = '#FF8C00'; // Dark orange
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, size);
    // Pulsing outer glow
    const pulse = Math.sin(performance.now() / 100) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255, 140, 0, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, size + 4, size + 4);
    // Draw "CHARGING" label
    RenderUtils.renderBitmapText(
      ctx,
      'CHARGING',
      x + size / 2,
      y + 12,
      { color: '#FF8C00', size: 12, centered: true, shadow: true }
    );
    // Draw charge percentage
    RenderUtils.renderBitmapText(
      ctx,
      `${Math.floor(chargeProgress * 100)}%`,
      x + size / 2,
      y + size - 12,
      { color: '#FF8C00', size: 18, centered: true, shadow: true }
    );
  }
  // Recast indicator text and countdown
  else if (hasRecast) {
    // Draw "RECAST" label at top
    RenderUtils.renderBitmapText(
      ctx,
      'RECAST',
      x + size / 2,
      y + 12,
      { color: '#FFD700', size: 14, centered: true, shadow: true }
    );
    // Draw recast window countdown at bottom
    RenderUtils.renderBitmapText(
      ctx,
      recastWindowRemaining.toFixed(1),
      x + size / 2,
      y + size - 12,
      { color: '#FFD700', size: 18, centered: true, shadow: true }
    );
  }
  // Cooldown text - only show if ability is learned (rank > 0) and actually on cooldown (and no recast)
  else {
    const isLearned = ability && ability.rank > 0;
    if (!isReady && isLearned) {
      const cooldownRemaining = ability.cooldownRemaining ?? 0;
      if (cooldownRemaining > 0) {
        RenderUtils.renderBitmapText(
          ctx,
          cooldownRemaining.toFixed(1),
          x + size / 2,
          y + size - 24,
          { color: HUD_COLORS.text, size: 22, centered: true, shadow: true }
        );
      }
    }
  }
}
