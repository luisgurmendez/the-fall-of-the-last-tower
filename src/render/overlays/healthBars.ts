/**
 * Health, shield and resource bars drawn above units.
 */

/**
 * Health bar colors based on relationship to local player.
 * - SELF: Green for the local player's champion
 * - ALLY: Blue for allied units (champions, minions, towers)
 * - ENEMY: Red for enemy units
 */
export const HEALTH_BAR_COLORS = {
  SELF: "#2ecc71", // Green - local player
  ALLY: "#3498db", // Blue - allied units
  ENEMY: "#e74c3c", // Red - enemy units
  NEUTRAL: "#95a5a6", // Gray - neutral units (jungle camps)
};

/**
 * Shield visual configuration by type.
 * Extensible: add new shield types here with their colors and stripe patterns.
 */
const SHIELD_STYLES: Record<
  string,
  { baseColor: string; stripeColor: string; stripeWidth: number }
> = {
  normal: {
    baseColor: "#e5e5e5", // Light gray
    stripeColor: "#9ca3af", // Darker gray
    stripeWidth: 3,
  },
  magic: {
    baseColor: "#c4b5fd", // Light purple
    stripeColor: "#8b5cf6", // Purple
    stripeWidth: 3,
  },
  physical: {
    baseColor: "#fcd34d", // Light yellow/gold
    stripeColor: "#f59e0b", // Amber
    stripeWidth: 3,
  },
  passive: {
    baseColor: "#fef08a", // Pale gold
    stripeColor: "#ca8a04", // Dark gold
    stripeWidth: 3,
  },
};

/**
 * Render a health bar with optional shields.
 * Shields extend beyond the health bar with diagonal stripes.
 *
 * @param healthBarColor - The color for the health fill (green=self, blue=ally, red=enemy)
 */
export function renderHealthBar(
  ctx: CanvasRenderingContext2D,
  health: number,
  maxHealth: number,
  width: number,
  yOffset: number,
  healthBarColor: string,
  shields?: Array<{ amount: number; shieldType: string }>,
): void {
  const barWidth = width;
  const barHeight = 6;

  // Calculate total shield amount
  const totalShield = shields?.reduce((sum, s) => sum + s.amount, 0) ?? 0;

  // Calculate display percentages
  // When health + shield > maxHealth, scale both down to fit within the bar
  const totalEffectiveHealth = health + totalShield;
  let healthDisplayPercent: number;
  let shieldDisplayPercent: number;

  if (totalEffectiveHealth > maxHealth) {
    // Scale down: both health and shield proportionally fit within bar
    healthDisplayPercent = health / totalEffectiveHealth;
    shieldDisplayPercent = totalShield / totalEffectiveHealth;
  } else {
    // Normal case: use maxHealth as the scale
    healthDisplayPercent = health / maxHealth;
    shieldDisplayPercent = totalShield / maxHealth;
  }

  // Clamp values
  healthDisplayPercent = Math.max(0, Math.min(1, healthDisplayPercent));
  shieldDisplayPercent = Math.max(
    0,
    Math.min(1 - healthDisplayPercent, shieldDisplayPercent),
  );

  // Background - always fixed width
  ctx.fillStyle = "#333333";
  ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

  // Health fill - use provided color
  ctx.fillStyle = healthBarColor;
  ctx.fillRect(
    -barWidth / 2,
    yOffset,
    barWidth * healthDisplayPercent,
    barHeight,
  );

  // Render shields to the right of health
  if (
    shields &&
    shields.length > 0 &&
    totalShield > 0 &&
    shieldDisplayPercent > 0
  ) {
    const shieldStartX = -barWidth / 2 + barWidth * healthDisplayPercent;
    let currentShieldX = shieldStartX;

    // Group shields by type for visual consistency
    const shieldsByType = new Map<string, number>();
    for (const shield of shields) {
      const existing = shieldsByType.get(shield.shieldType) ?? 0;
      shieldsByType.set(shield.shieldType, existing + shield.amount);
    }

    // Calculate total shield for proportional rendering
    const totalShieldAmount = Array.from(shieldsByType.values()).reduce(
      (a, b) => a + b,
      0,
    );

    // Render each shield type proportionally within the shield display area
    for (const [shieldType, amount] of shieldsByType) {
      // Each shield type gets its proportion of the shield display area
      const shieldProportion = amount / totalShieldAmount;
      const shieldWidth = barWidth * shieldDisplayPercent * shieldProportion;
      if (shieldWidth <= 0) continue;

      // Get style for this shield type
      const style = SHIELD_STYLES[shieldType] || SHIELD_STYLES.normal;

      // Create diagonal stripe pattern
      renderShieldSegment(
        ctx,
        currentShieldX,
        yOffset,
        shieldWidth,
        barHeight,
        style.baseColor,
        style.stripeColor,
        style.stripeWidth,
      );

      currentShieldX += shieldWidth;
    }

    // Divider line between health and shield
    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shieldStartX, yOffset);
    ctx.lineTo(shieldStartX, yOffset + barHeight);
    ctx.stroke();
  }

  // Border around bar (always fixed width)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(-barWidth / 2, yOffset, barWidth, barHeight);
}

/**
 * Render a shield segment with diagonal stripes.
 */
function renderShieldSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  baseColor: string,
  stripeColor: string,
  stripeWidth: number,
): void {
  // Save context for clipping
  ctx.save();

  // Create clipping region for this segment
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  // Fill with base color first
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, width, height);

  // Draw diagonal stripes
  ctx.fillStyle = stripeColor;
  const stripeSpacing = stripeWidth * 2;
  const diagonalLength = Math.sqrt(width * width + height * height) * 2;

  // Draw stripes from top-left to bottom-right
  for (let i = -diagonalLength; i < diagonalLength; i += stripeSpacing) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + height, y + height);
    ctx.lineTo(x + i + height + stripeWidth, y + height);
    ctx.lineTo(x + i + stripeWidth, y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Render a resource (mana) bar.
 */
export function renderResourceBar(
  ctx: CanvasRenderingContext2D,
  resource: number,
  maxResource: number,
  width: number,
  yOffset: number,
): void {
  const barWidth = width;
  const barHeight = 4;
  const resourcePercent = Math.max(0, Math.min(1, resource / maxResource));

  // Background
  ctx.fillStyle = "#333333";
  ctx.fillRect(-barWidth / 2, yOffset, barWidth, barHeight);

  // Resource fill (blue for mana)
  ctx.fillStyle = "#3498db";
  ctx.fillRect(-barWidth / 2, yOffset, barWidth * resourcePercent, barHeight);

  // Border
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(-barWidth / 2, yOffset, barWidth, barHeight);
}

/**
 * Render passive stack indicator below health bar.
 * Shows stacks like Magnus's Arcane Surge (0-4) or Gorath's Immovable (0-10).
 * Not called by any renderer yet.
 *
 * @param stacks - Current stack count
 * @param maxStacks - Maximum stacks possible
 * @param width - Width of the health bar (for positioning)
 * @param healthBarY - Y offset of the health bar
 * @param color - Color for filled stacks
 */
export function renderStackIndicator(
  ctx: CanvasRenderingContext2D,
  stacks: number,
  maxStacks: number,
  width: number,
  healthBarY: number,
  color: string = "#FFD700",
): void {
  if (maxStacks <= 0) return;

  const pipSize = 4;
  const pipSpacing = 2;
  const totalWidth = maxStacks * pipSize + (maxStacks - 1) * pipSpacing;
  const startX = -totalWidth / 2;
  const pipY = healthBarY + 8; // Below health bar

  for (let i = 0; i < maxStacks; i++) {
    const isFilled = i < stacks;
    ctx.fillStyle = isFilled ? color : "#333333";
    ctx.fillRect(startX + i * (pipSize + pipSpacing), pipY, pipSize, pipSize);

    // Border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(
      startX + i * (pipSize + pipSpacing),
      pipY,
      pipSize,
      pipSize,
    );
  }
}
