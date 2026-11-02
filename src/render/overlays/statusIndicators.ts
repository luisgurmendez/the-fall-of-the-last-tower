/**
 * Status icons drawn above units: buff/debuff marks over champion health
 * bars and the aggro "!" over jungle creatures.
 */

import { BitmapFont } from "@/render/BitmapFont";
import { getChampionMarkVisuals } from "@/render/champions";
import { getEffectDisplayInfo, hasEffectDisplayInfo, type EffectDisplayInfo } from "@/data/effectDisplayInfo";

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
  hidden?: boolean; // Never shown (the second half of a buff that already has an icon)
}

/**
 * Visual configurations for different mark types.
 * These show as small icons above health bars.
 */
const MARK_VISUALS: Record<string, MarkVisualConfig> = {
  // Champion buffs and debuffs (vex_mark, gorath_fortify_buff, ...) come
  // from each champion's entry in src/render/champions/
  ...getChampionMarkVisuals(),
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
  knockup: {
    icon: "^",
    bgColor: "rgba(155, 89, 182, 0.8)",
    borderColor: "#9b59b6",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  root: {
    icon: "#",
    bgColor: "rgba(139, 69, 19, 0.85)",
    borderColor: "#a0522d",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  silence: {
    icon: "x",
    bgColor: "rgba(142, 68, 173, 0.8)",
    borderColor: "#8e44ad",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  slow_10: {
    icon: "v",
    bgColor: "rgba(93, 173, 226, 0.8)",
    borderColor: "#5dade2",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  cinders_burn: {
    icon: "*",
    bgColor: "rgba(230, 126, 34, 0.85)",
    borderColor: "#e67e22",
    iconColor: "#ffffff",
    showTimer: true,
    isDebuff: true,
  },
  // Jungle buffs
  crest_of_insight: {
    icon: "B",
    bgColor: "rgba(52, 152, 219, 0.85)",
    borderColor: "#3498db",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  crest_of_cinders: {
    icon: "R",
    bgColor: "rgba(231, 76, 60, 0.85)",
    borderColor: "#e74c3c",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  // Second halves of two-effect buffs: one icon per buff is enough
  crest_of_insight_regen: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
  dragons_might_power: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
  heartwood_pact_ward: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
  uruk_hunt_speed: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
  uruk_hunt: {
    icon: "H",
    bgColor: "rgba(255, 179, 71, 0.85)",
    borderColor: "#ffd08a",
    iconColor: "#ffffff",
    showTimer: false,
    isBuff: true,
  },
  uruk_spear_charge: {
    icon: "W",
    bgColor: "rgba(159, 216, 255, 0.85)",
    borderColor: "#d8f0ff",
    iconColor: "#1c3448",
    showTimer: true,
    isBuff: true,
  },
  heartwood_pact_sap: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
  heartwood_pact: {
    icon: "H",
    bgColor: "rgba(124, 179, 66, 0.85)",
    borderColor: "#aed581",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  dragons_might: {
    icon: "D",
    bgColor: "rgba(230, 126, 34, 0.85)",
    borderColor: "#f39c12",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  // Item passives (ChampionItemPassives markers)
  item_starfall: {
    icon: "*",
    bgColor: "rgba(155, 89, 182, 0.85)",
    borderColor: "#c39bff",
    iconColor: "#ffe082",
    showTimer: true,
    isBuff: true,
  },
  item_hold_the_line: {
    icon: "H",
    bgColor: "rgba(127, 140, 141, 0.85)",
    borderColor: "#d0d6e0",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  // Item effects (config/items.ts): the ones that matter in a fight
  wounds: {
    icon: "W",
    bgColor: "rgba(192, 57, 43, 0.85)",
    borderColor: "#ff8a80",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: false,
  },
  item_burn: {
    icon: "~",
    bgColor: "rgba(230, 81, 0, 0.85)",
    borderColor: "#ffab40",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: false,
  },
  item_sunder: {
    icon: "S",
    bgColor: "rgba(93, 64, 55, 0.85)",
    borderColor: "#bcaaa4",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: false,
  },
  item_frost_nova: {
    icon: "*",
    bgColor: "rgba(2, 119, 189, 0.85)",
    borderColor: "#81d4fa",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: false,
  },
  item_static: {
    icon: "Z",
    bgColor: "rgba(0, 131, 143, 0.85)",
    borderColor: "#4dd0e1",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  item_veil: {
    icon: "V",
    bgColor: "rgba(94, 53, 177, 0.85)",
    borderColor: "#b39ddb",
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: true,
  },
  item_stasis: {
    icon: "H",
    bgColor: "rgba(255, 193, 7, 0.85)",
    borderColor: "#ffe082",
    iconColor: "#3e2723",
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

/** Visuals built from effect display info, by effect id */
const derivedVisuals = new Map<string, MarkVisualConfig>();

/**
 * An effect's icon: its own entry, or one made from its display info
 * (letter, color, buff or debuff), or the "?" default.
 */
export function getMarkVisual(effectId: string): MarkVisualConfig {
  const own = MARK_VISUALS[effectId];
  if (own) return own;
  let derived = derivedVisuals.get(effectId);
  if (!derived) {
    derived = hasEffectDisplayInfo(effectId)
      ? visualFromDisplayInfo(getEffectDisplayInfo(effectId))
      : DEFAULT_MARK_VISUAL;
    derivedVisuals.set(effectId, derived);
  }
  return derived;
}

function visualFromDisplayInfo(info: EffectDisplayInfo): MarkVisualConfig {
  return {
    icon: info.icon,
    bgColor: withAlpha(info.color, 0.8),
    borderColor: info.color,
    iconColor: "#ffffff",
    showTimer: true,
    isBuff: info.category === "buff",
    isDebuff: info.category === "debuff",
  };
}

/** "#rrggbb" with an alpha, as rgba() */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

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
    const visual = getMarkVisual(effect.definitionId);
    if (visual.hidden) return false;
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
    const visual = getMarkVisual(effect.definitionId);
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
