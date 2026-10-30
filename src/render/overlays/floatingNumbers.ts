/**
 * Floating combat text: damage, gold and XP numbers that rise and fade
 * above the entity that triggered them.
 */

import type { OnlineStateManager } from "@/core/OnlineStateManager";

/**
 * Colors for damage number types.
 */
const DAMAGE_COLORS = {
  physical: "#ffffff", // White for physical
  magic: "#7B68EE", // Purple-blue for magic
  true: "#FFD700", // Gold for true damage
  pure: "#FFD700", // Gold for pure damage
  shield: "#808080", // Gray for shield absorbed
};

/**
 * Damage number display settings.
 */
const DAMAGE_NUMBER_CONFIG = {
  FONT: "16px m5x7",
  FLOAT_DISTANCE: 30, // How far up the number floats
  FONT_SIZE: 16,
};

/**
 * Gold number display settings.
 */
const GOLD_NUMBER_CONFIG = {
  FONT: "18px m5x7",
  FLOAT_DISTANCE: 25,
  COLOR: "#FFD700", // Gold color
  FONT_SIZE: 18,
};

/**
 * XP number display settings.
 */
const XP_NUMBER_CONFIG = {
  FONT: "14px m5x7",
  FLOAT_DISTANCE: 25,
  COLOR: "#888888", // Gray color
  FONT_SIZE: 14,
};

/**
 * Render floating damage numbers.
 */
export function renderDamageNumbers(
  ctx: CanvasRenderingContext2D,
  stateManager: OnlineStateManager,
): void {
  const damageNumbers = stateManager.getDamageNumbers();

  for (const dn of damageNumbers) {
    const progress = stateManager.getDamageNumberProgress(dn);

    // Ease out for smooth deceleration
    const easeOut = 1 - Math.pow(1 - progress, 3);

    // Calculate position (float upward)
    const yOffset = -DAMAGE_NUMBER_CONFIG.FLOAT_DISTANCE * easeOut;

    // Calculate alpha (fade out in the last 30%)
    const fadeStart = 0.7;
    const alpha =
      progress < fadeStart ? 1 : 1 - (progress - fadeStart) / (1 - fadeStart);

    ctx.save();
    ctx.translate(dn.x, dn.y + yOffset);

    // Set up font
    ctx.font = DAMAGE_NUMBER_CONFIG.FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;

    // Render shield absorbed amount first (gray, slightly left and up)
    if (dn.shieldAbsorbed > 0) {
      const shieldText = Math.round(dn.shieldAbsorbed).toString();

      // Draw shadow/outline for readability
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(shieldText, -15, -8);

      // Draw shield absorbed text
      ctx.fillStyle = DAMAGE_COLORS.shield;
      ctx.fillText(shieldText, -15, -8);
    }

    // Render damage amount
    if (dn.amount > 0) {
      const damageText = Math.round(dn.amount).toString();
      const xOffset = dn.shieldAbsorbed > 0 ? 15 : 0;

      // Draw shadow/outline for readability
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(damageText, xOffset, 0);

      // Draw damage text with appropriate color
      ctx.fillStyle = DAMAGE_COLORS[dn.damageType] || DAMAGE_COLORS.physical;
      ctx.fillText(damageText, xOffset, 0);
    }

    ctx.restore();
  }
}

/**
 * Render floating gold numbers.
 */
export function renderGoldNumbers(
  ctx: CanvasRenderingContext2D,
  stateManager: OnlineStateManager,
): void {
  const goldNumbers = stateManager.getGoldNumbers();

  for (const gn of goldNumbers) {
    const progress = stateManager.getGoldNumberProgress(gn);

    // Ease out for smooth deceleration
    const easeOut = 1 - Math.pow(1 - progress, 3);

    // Calculate position (float upward, offset to the right to not overlap damage)
    const yOffset = -GOLD_NUMBER_CONFIG.FLOAT_DISTANCE * easeOut;
    const xOffset = 25; // Offset to the right of the entity

    // Calculate alpha (fade out in the last 30%)
    const fadeStart = 0.7;
    const alpha =
      progress < fadeStart ? 1 : 1 - (progress - fadeStart) / (1 - fadeStart);

    ctx.save();
    ctx.translate(gn.x + xOffset, gn.y + yOffset);

    // Set up font
    ctx.font = GOLD_NUMBER_CONFIG.FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;

    // Format gold text with + prefix
    const goldText = `+${gn.amount}`;

    // Draw shadow/outline for readability
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeText(goldText, 0, 0);

    // Draw gold text
    ctx.fillStyle = GOLD_NUMBER_CONFIG.COLOR;
    ctx.fillText(goldText, 0, 0);

    ctx.restore();
  }
}

/**
 * Render floating XP numbers.
 */
export function renderXpNumbers(
  ctx: CanvasRenderingContext2D,
  stateManager: OnlineStateManager,
): void {
  const xpNumbers = stateManager.getXpNumbers();

  for (const xn of xpNumbers) {
    const progress = stateManager.getXpNumberProgress(xn);

    // Ease out for smooth deceleration
    const easeOut = 1 - Math.pow(1 - progress, 3);

    // Calculate position (float upward, offset to the left to not overlap gold)
    const yOffset = -XP_NUMBER_CONFIG.FLOAT_DISTANCE * easeOut;
    const xOffset = -25; // Offset to the left of the entity

    // Calculate alpha (fade out in the last 30%)
    const fadeStart = 0.7;
    const alpha =
      progress < fadeStart ? 1 : 1 - (progress - fadeStart) / (1 - fadeStart);

    ctx.save();
    ctx.translate(xn.x + xOffset, xn.y + yOffset);

    // Set up font
    ctx.font = XP_NUMBER_CONFIG.FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;

    // Format XP text with "xp" prefix
    const xpText = `xp ${xn.amount}`;

    // Draw shadow/outline for readability
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeText(xpText, 0, 0);

    // Draw XP text
    ctx.fillStyle = XP_NUMBER_CONFIG.COLOR;
    ctx.fillText(xpText, 0, 0);

    ctx.restore();
  }
}

/** Heal numbers: green "+N", rising on the right of the entity */
const HEAL_NUMBER_CONFIG = {
  FONT: "bold 16px m5x7",
  FLOAT_DISTANCE: 30,
  COLOR: "#4ade80",
};

/**
 * Render floating heal numbers.
 */
export function renderHealNumbers(
  ctx: CanvasRenderingContext2D,
  stateManager: OnlineStateManager,
): void {
  for (const { heal, progress } of stateManager.getHealNumbers()) {
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
    const text = `+${heal.amount}`;

    ctx.save();
    ctx.translate(heal.x + 20, heal.y - 20 - HEAL_NUMBER_CONFIG.FLOAT_DISTANCE * easeOut);
    ctx.font = HEAL_NUMBER_CONFIG.FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = HEAL_NUMBER_CONFIG.COLOR;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}
