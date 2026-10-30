/**
 * Status icons drawn above units: buff/debuff marks over champion health
 * bars and the aggro "!" over jungle creatures.
 */

import { BitmapFont } from "@/render/BitmapFont";

/**
 * Mark indicator visual configuration.
 * Used for showing debuff marks, stacks, and other indicators above champions.
 */
export interface MarkVisualConfig {
  icon: string; // Icon character or emoji
  bgColor: string; // Background color
  borderColor: string; // Border color
  iconColor: string; // Icon text color
  showTimer?: boolean; // Whether to show countdown timer
  showStacks?: boolean; // Whether to show stack count
  isDebuff?: boolean; // True for debuffs (shown on enemies)
  isBuff?: boolean; // True for buffs (shown on self/allies)
}

/**
 * Visual configurations for different mark types.
 * These show as small icons above health bars.
 */
const MARK_VISUALS: Record<string, MarkVisualConfig> = {
  // Vex marks
  vex_mark: {
    icon: "X",
    bgColor: "rgba(155, 89, 182, 0.8)", // Purple
    borderColor: "#9b59b6",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  vex_death_mark: {
    icon: "!",
    bgColor: "rgba(44, 62, 80, 0.9)", // Dark
    borderColor: "#e74c3c", // Red border (danger)
    iconColor: "#e74c3c",
    showTimer: true,
    isDebuff: true,
  },
  vex_stealth: {
    icon: "?",
    bgColor: "rgba(44, 62, 80, 0.8)",
    borderColor: "#2c3e50",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  // CC marks
  stun: {
    icon: "!",
    bgColor: "rgba(231, 76, 60, 0.8)",
    borderColor: "#e74c3c",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  taunt: {
    icon: "T",
    bgColor: "rgba(233, 30, 99, 0.8)",
    borderColor: "#e91e63",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  slow_30: {
    icon: "v",
    bgColor: "rgba(52, 152, 219, 0.8)",
    borderColor: "#3498db",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  slow_40: {
    icon: "v",
    bgColor: "rgba(41, 128, 185, 0.8)",
    borderColor: "#2980b9",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  // Gorath buffs
  gorath_fortify_buff: {
    icon: "S",
    bgColor: "rgba(139, 115, 85, 0.8)",
    borderColor: "#8b7355",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  gorath_fortify_mr_buff: {
    icon: "S",
    bgColor: "rgba(139, 92, 246, 0.8)",
    borderColor: "#8b5cf6",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  // Speed buffs
  speed_20: {
    icon: ">",
    bgColor: "rgba(46, 204, 113, 0.8)",
    borderColor: "#2ecc71",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  speed_30: {
    icon: ">",
    bgColor: "rgba(39, 174, 96, 0.8)",
    borderColor: "#27ae60",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
};

/** Default visual for unknown marks */
const DEFAULT_MARK_VISUAL: MarkVisualConfig = {
  icon: "?",
  bgColor: "rgba(149, 165, 166, 0.8)",
  borderColor: "#95a5a6",
  iconColor: "#ffffff",
  showTimer: true,
};

/**
 * Render mark indicators above a champion's health bar.
 * Shows active effects like vex_mark, stun, slow, etc. as small icons.
 *
 * @param activeEffects - Array of active effects on the champion
 * @param width - Width of the health bar (for positioning)
 * @param healthBarY - Y offset of the health bar
 * @param isLocalPlayer - Whether this is the local player
 * @param isEnemy - Whether this is an enemy champion
 */
export function renderMarkIndicators(
  ctx: CanvasRenderingContext2D,
  activeEffects:
    | Array<{
        definitionId: string;
        timeRemaining: number;
        totalDuration?: number;
        stacks: number;
      }>
    | undefined,
  width: number,
  healthBarY: number,
  isLocalPlayer: boolean,
  isEnemy: boolean,
): void {
  if (!activeEffects || activeEffects.length === 0) return;

  // Filter effects to show: debuffs on enemies, buffs on self/allies
  const visibleEffects = activeEffects.filter((effect) => {
    const visual = MARK_VISUALS[effect.definitionId] || DEFAULT_MARK_VISUAL;
    if (isEnemy) {
      // On enemies, show debuffs
      return visual.isDebuff;
    } else {
      // On self/allies, show buffs
      return visual.isBuff || isLocalPlayer; // Local player sees all their effects
    }
  });

  if (visibleEffects.length === 0) return;

  const iconSize = 14;
  const iconSpacing = 2;
  const totalWidth =
    visibleEffects.length * iconSize +
    (visibleEffects.length - 1) * iconSpacing;
  const startX = -totalWidth / 2;
  const markY = healthBarY - iconSize - 4; // Above health bar

  visibleEffects.forEach((effect, index) => {
    const visual = MARK_VISUALS[effect.definitionId] || DEFAULT_MARK_VISUAL;
    const x = startX + index * (iconSize + iconSpacing);

    // Background
    ctx.fillStyle = visual.bgColor;
    ctx.fillRect(x, markY, iconSize, iconSize);

    // Radial timer overlay (drains clockwise as time expires)
    if (
      visual.showTimer &&
      effect.timeRemaining > 0 &&
      effect.totalDuration &&
      effect.totalDuration > 0
    ) {
      const progress = effect.timeRemaining / effect.totalDuration;
      const expiredAngle = (1 - progress) * Math.PI * 2;
      const centerX = x + iconSize / 2;
      const centerY = markY + iconSize / 2;

      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        iconSize / 2,
        -Math.PI / 2,
        -Math.PI / 2 + expiredAngle,
        false,
      );
      ctx.lineTo(centerX, centerY);
      ctx.fill();
      ctx.restore();
    }

    // Border
    ctx.strokeStyle = visual.borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, markY, iconSize, iconSize);

    // Icon
    ctx.fillStyle = visual.iconColor;
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(visual.icon, x + iconSize / 2, markY + iconSize / 2);

    // Stack count (small number in corner)
    if (visual.showStacks && effect.stacks > 1) {
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 8px Arial";
      ctx.textAlign = "right";
      ctx.fillText(
        effect.stacks.toString(),
        x + iconSize - 1,
        markY + iconSize - 2,
      );
    }
  });
}

/**
 * Render a red "!" aggro indicator above an entity.
 */
export function renderAggroIndicator(
  ctx: CanvasRenderingContext2D,
  yOffset: number,
  animationTime: number,
): void {
  const x = 0;
  const y = yOffset;

  // Pulsing effect
  const pulseScale = 1 + Math.sin(animationTime * 8) * 0.1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulseScale, pulseScale);

  // Red circle background
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#ff3333";
  ctx.fill();
  ctx.strokeStyle = "#aa0000";
  ctx.lineWidth = 2;
  ctx.stroke();

  // White "!" text (using pixel font)
  ctx.fillStyle = "#ffffff";
  ctx.font = BitmapFont.getFont(18);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", 0, -3);

  ctx.restore();
}
