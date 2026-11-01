/**
 * Floating combat text: damage numbers pop out of the unit's body to one
 * side and fall (hits alternate sides), so they never cover its health bar;
 * gold and XP numbers rise and fade beside the champion that earned them.
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
 * Damage number display settings (world units, from the unit's position,
 * the middle of its body).
 */
const DAMAGE_NUMBER_CONFIG = {
  FONT: "16px m5x7",
  FONT_SIZE: 16,
  START_Y: -8, // Where it pops out, a little above the middle
  SIDE: 28, // How far out to the side it flies
  HOP: 6, // How high it pops before falling
  FALL: 30, // How far it falls
  POP: 0.6, // How much bigger it starts, shrinking back...
  POP_TIME: 0.12, // ...over this share of its life
  BIG_HIT: 40, // Hits past this much damage are drawn bigger...
  BIG_HIT_SCALE: 300, // ...by a share of what's past it over this...
  MAX_GROWTH: 0.5, // ...up to this much bigger
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

    // Out to the side, slowing down, along a short hop that falls away
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const xOffset = dn.side * DAMAGE_NUMBER_CONFIG.SIDE * easeOut;
    const yOffset = DAMAGE_NUMBER_CONFIG.START_Y
      - DAMAGE_NUMBER_CONFIG.HOP * 4 * progress * (1 - progress)
      + DAMAGE_NUMBER_CONFIG.FALL * progress * progress;

    // Calculate alpha (fade out in the last 30%)
    const fadeStart = 0.7;
    const alpha =
      progress < fadeStart ? 1 : 1 - (progress - fadeStart) / (1 - fadeStart);

    // Pops in big and settles; bigger hits stay bigger
    const growth = Math.min(DAMAGE_NUMBER_CONFIG.MAX_GROWTH,
      Math.max(0, dn.amount - DAMAGE_NUMBER_CONFIG.BIG_HIT) / DAMAGE_NUMBER_CONFIG.BIG_HIT_SCALE);
    const pop = progress < DAMAGE_NUMBER_CONFIG.POP_TIME
      ? DAMAGE_NUMBER_CONFIG.POP * (1 - progress / DAMAGE_NUMBER_CONFIG.POP_TIME)
      : 0;

    ctx.save();
    ctx.translate(dn.x + xOffset, dn.y + yOffset);
    ctx.scale((1 + growth) * (1 + pop), (1 + growth) * (1 + pop));

    // Set up font
    ctx.font = DAMAGE_NUMBER_CONFIG.FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = alpha;

    // Render shield absorbed amount first (gray, just above the damage)
    if (dn.shieldAbsorbed > 0) {
      const shieldText = Math.round(dn.shieldAbsorbed).toString();
      const shieldY = dn.amount > 0 ? -9 : 0;

      // Draw shadow/outline for readability
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(shieldText, 0, shieldY);

      // Draw shield absorbed text
      ctx.fillStyle = DAMAGE_COLORS.shield;
      ctx.fillText(shieldText, 0, shieldY);
    }

    // Render damage amount
    if (dn.amount > 0) {
      const damageText = Math.round(dn.amount).toString();

      // Draw shadow/outline for readability
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(damageText, 0, 0);

      // Draw damage text with appropriate color
      ctx.fillStyle = DAMAGE_COLORS[dn.damageType] || DAMAGE_COLORS.physical;
      ctx.fillText(damageText, 0, 0);
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
