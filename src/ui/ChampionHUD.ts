/**
 * ChampionHUD - Reusable HUD component for displaying champion information.
 *
 * Layout:
 * [Stats Panel] [Portrait] [Abilities Panel] [Items Grid]
 *                          [  Health Bar   ]
 *                          [  Mana Bar     ]
 */

import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import RenderUtils from '@/render/utils';
import GameContext from '@/core/gameContext';
import { InputManager, MouseButton } from '@/core/input/InputManager';
import { type StatModifier, type ChampionStats, type ItemSlot, type ItemDefinition, type AbilitySlot, type AbilityScaling, type DamageType, type ActiveEffectState, calculateAbilityValue } from '@siege/shared';
import { getEffectDisplayInfo, type EffectDisplayInfo, EFFECT_CATEGORY_COLORS } from '@/data/effectDisplayInfo';
// Re-export for external use
export type { ItemSlot, AbilitySlot };

/**
 * Local interface for equipped item display.
 */
interface EquippedItem {
  definition: ItemDefinition;
  slot: ItemSlot;
  passiveCooldowns: Map<string, number>;
  nextIntervalTick: Map<string, number>;
}

/**
 * Local interface for inventory display.
 */
interface ChampionInventory {
  items: Map<ItemSlot, EquippedItem>;
  totalGoldSpent: number;
}
import Vector from '@/physics/vector';
/**
 * Interface for trinket data needed by HUD.
 * Both Trinket and OnlineTrinketAdapter implement this.
 */
export interface HUDTrinket {
  getCharges(): number;
  getMaxCharges(): number;
  getDefinition(): { maxCharges: number };
  getRechargeProgress(): number;
  isOnCooldown(): boolean;
  canPlace(): boolean;
}

/**
 * Ability definition interface for HUD tooltips.
 */
export interface HUDAbilityDefinition {
  name: string;
  description: string;
  maxRank?: number;
  manaCost?: number[];
  cooldown?: number[];
  damage?: {
    type: DamageType;
    scaling: AbilityScaling;
  };
  heal?: {
    scaling: AbilityScaling;
  };
  shield?: {
    scaling: AbilityScaling;
    duration: number;
  };
}

/**
 * Interface for ability data needed by HUD.
 */
export interface HUDAbility {
  readonly definition?: HUDAbilityDefinition | null;
  readonly rank: number;
  readonly isReady: boolean;
  readonly cooldownProgress: number;
  readonly cooldownRemaining: number;
  getTargetDescription?(): {
    range?: number;
    targetType?: string;
    shape?: string;
    aoeRadius?: number;
    coneAngle?: number;
    width?: number;
  } | null;
}

/**
 * Interface for champion data needed by HUD.
 * Both Champion and OnlineChampionAdapter implement this.
 */
export interface HUDChampionData {
  getStats(): ChampionStats;
  getCurrentHealth(): number;
  getCurrentResource(): number;
  getAbility(slot: AbilitySlot): HUDAbility | undefined;
  getBuffs(): StatModifier[];
  getActiveEffects(): HUDActiveEffect[];
  getInventory(): ChampionInventory;
  getTrinket(): HUDTrinket | null;
  getPosition(): Vector;
  getLevel(): number;
  getExperience(): number;
  getExperienceToNextLevel(): number;
  getSkillPoints(): number;
}

/**
 * Active effect data for HUD display.
 */
export interface HUDActiveEffect {
  /** Effect definition ID */
  definitionId: string;
  /** Time remaining in seconds */
  timeRemaining: number;
  /** Current stack count */
  stacks: number;
  /** For shields: remaining shield amount */
  shieldRemaining?: number;
}

/** Hover state for HUD elements */
export interface HUDHoverState {
  /** Currently hovered ability slot, or null if none */
  ability: AbilitySlot | null;
  /** Currently hovered item slot, or null if none */
  item: ItemSlot | null;
  /** Currently hovered buff index, or null if none */
  buff: number | null;
  /** Currently hovered effect index, or null if none */
  effect: number | null;
}

/** HUD configuration options */
export interface HUDConfig {
  /** Primary color for the champion (used for accents) */
  accentColor: string;
  /** Champion name to display */
  championName: string;
  /** Whether to show mana bar (false for energy/rage champions) */
  showManaBar?: boolean;
  /** Resource bar color (blue for mana, yellow for energy, red for rage) */
  resourceColor?: string;
  /** Resource name (Mana, Energy, Rage, etc.) */
  resourceName?: string;
  /** Callback when ability hover state changes */
  onAbilityHover?: (slot: AbilitySlot | null) => void;
  /** Callback when item hover state changes */
  onItemHover?: (slot: ItemSlot | null) => void;
}

/** Default HUD colors */
const HUD_COLORS = {
  background: '#1a1a2e',
  backgroundLight: '#252540',
  border: '#3a3a5c',
  borderHighlight: '#5a5a8c',
  text: '#ffffff',
  textDim: '#aaaaaa',
  healthBar: '#2ecc71',
  healthBarBg: '#1a472a',
  manaBar: '#3498db',
  manaBarBg: '#1a3a4a',
  cooldownOverlay: 'rgba(0, 0, 0, 0.7)',
  abilityReady: '#FFD700',
  abilityNotReady: '#666666',
  xpBar: '#8b5cf6',
  xpBarBg: '#2d1f3d',
  levelUpButton: '#ffd700',
  levelUpButtonHover: '#ffec8b',
};

/** Panel dimensions */
const PANEL = {
  statsWidth: 140,
  statsHeight: 140,
  portraitSize: 110,
  abilitiesWidth: 280,
  abilitiesHeight: 80,
  abilityBoxSize: 64,
  abilitySpacing: 10,
  barHeight: 28,
  barSpacing: 6,
  itemsWidth: 170,
  itemsHeight: 120,
  itemBoxSize: 48,
  itemSpacing: 6,
  padding: 14,
  margin: 10,
  buffSize: 32,
  buffSpacing: 5,
  effectSize: 36,
  effectSpacing: 4,
  wardBoxSize: 48,
  tooltipWidth: 320,
  tooltipPadding: 12,
  xpBarHeight: 8,
  xpBarSpacing: 4,
  levelUpButtonWidth: 20,
  levelUpButtonHeight: 16,
  levelUpButtonGap: 4,
};

export class ChampionHUD extends ScreenEntity {
  private champion: HUDChampionData | null;
  private config: Required<HUDConfig>;
  private inputManager: InputManager;

  /** Current hover state */
  private hoverState: HUDHoverState = { ability: null, item: null, buff: null, effect: null };

  /** Cached ability box positions for hit testing (updated each frame) */
  private abilityBoxes: Map<AbilitySlot, { x: number; y: number; size: number }> = new Map();

  /** Cached item box positions for hit testing */
  private itemBoxes: Map<ItemSlot, { x: number; y: number; size: number }> = new Map();

  /** Cached buff box positions for hit testing */
  private buffBoxes: Map<number, { x: number; y: number; size: number }> = new Map();

  /** Cached effect box positions for hit testing */
  private effectBoxes: Map<number, { x: number; y: number; size: number }> = new Map();

  /** Cached level-up button positions for hit testing */
  private levelUpButtons: Map<AbilitySlot, { x: number; y: number; width: number; height: number }> = new Map();

  /** Hovered level-up button */
  private hoveredLevelUpButton: AbilitySlot | null = null;

  /** Callback for level-up button clicks */
  private onLevelUp?: (slot: AbilitySlot) => void;

  /** Animation state for level-up button pulse */
  private levelUpPulseTime: number = 0;

  /** Debug: last time we logged skill points */
  private _lastSkillPointsLogTime: number = 0;

  /**
   * Create a ChampionHUD.
   * @param config - HUD configuration options
   * @param champion - Champion data provider (optional, can be set later)
   */
  constructor(config: HUDConfig, champion?: HUDChampionData) {
    super();
    this.champion = champion ?? null;
    this.inputManager = InputManager.getInstance();
    this.config = {
      showManaBar: true,
      resourceColor: HUD_COLORS.manaBar,
      resourceName: 'Mana',
      onAbilityHover: undefined,
      onItemHover: undefined,
      ...config,
    } as Required<HUDConfig>;
  }

  /**
   * Set the champion data provider (for online mode where champion isn't available at construction).
   */
  setChampion(champion: HUDChampionData): void {
    this.champion = champion;
  }

  /**
   * Set the level-up handler callback.
   */
  setLevelUpHandler(handler: (slot: AbilitySlot) => void): void {
    this.onLevelUp = handler;
  }

  /** Get current hover state */
  getHoverState(): HUDHoverState {
    return { ...this.hoverState };
  }

  /** Check if a specific ability is being hovered */
  isAbilityHovered(slot: AbilitySlot): boolean {
    return this.hoverState.ability === slot;
  }

  /** Check if a specific item slot is being hovered */
  isItemHovered(slot: ItemSlot): boolean {
    return this.hoverState.item === slot;
  }

  /** Update hover detection */
  override step(gctx: GameContext): void {
    // Update pulse animation time
    this.levelUpPulseTime += gctx.dt;

    const mousePos = this.inputManager.getMousePosition();
    if (!mousePos) return;

    // Check ability hover
    let newHoveredAbility: AbilitySlot | null = null;
    for (const [slot, box] of this.abilityBoxes) {
      if (this.isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredAbility = slot;
        break;
      }
    }

    // Check item hover
    let newHoveredItem: ItemSlot | null = null;
    for (const [slot, box] of this.itemBoxes) {
      if (this.isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredItem = slot;
        break;
      }
    }

    // Check buff hover
    let newHoveredBuff: number | null = null;
    for (const [index, box] of this.buffBoxes) {
      if (this.isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredBuff = index;
        break;
      }
    }

    // Check effect hover
    let newHoveredEffect: number | null = null;
    for (const [index, box] of this.effectBoxes) {
      if (this.isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredEffect = index;
        break;
      }
    }

    // Check level-up button hover
    let newHoveredLevelUpButton: AbilitySlot | null = null;
    for (const [slot, box] of this.levelUpButtons) {
      if (this.isPointInRect(mousePos.x, mousePos.y, box)) {
        newHoveredLevelUpButton = slot;
        break;
      }
    }
    this.hoveredLevelUpButton = newHoveredLevelUpButton;

    // Handle level-up button click
    if (this.hoveredLevelUpButton && this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT)) {
      console.log(`[ChampionHUD] Level-up button ${this.hoveredLevelUpButton} clicked`);
      if (this.onLevelUp && this.champion) {
        const skillPoints = this.champion.getSkillPoints();
        console.log(`[ChampionHUD] Skill points available: ${skillPoints}`);
        if (skillPoints > 0) {
          console.log(`[ChampionHUD] Calling onLevelUp for slot ${this.hoveredLevelUpButton}`);
          this.onLevelUp(this.hoveredLevelUpButton);
        } else {
          console.log(`[ChampionHUD] No skill points available, cannot level up`);
        }
      } else {
        console.log(`[ChampionHUD] Missing onLevelUp handler or champion`);
      }
    }

    // Fire callbacks if hover state changed
    if (newHoveredAbility !== this.hoverState.ability) {
      this.hoverState.ability = newHoveredAbility;
      if (this.config.onAbilityHover) {
        this.config.onAbilityHover(newHoveredAbility);
      }
    }

    if (newHoveredItem !== this.hoverState.item) {
      this.hoverState.item = newHoveredItem;
      if (this.config.onItemHover) {
        this.config.onItemHover(newHoveredItem);
      }
    }

    // Update buff hover state
    if (newHoveredBuff !== this.hoverState.buff) {
      this.hoverState.buff = newHoveredBuff;
    }

    // Update effect hover state
    if (newHoveredEffect !== this.hoverState.effect) {
      this.hoverState.effect = newHoveredEffect;
    }
  }

  /** Check if a point is inside a box */
  private isPointInBox(
    px: number,
    py: number,
    box: { x: number; y: number; size: number }
  ): boolean {
    return px >= box.x && px <= box.x + box.size && py >= box.y && py <= box.y + box.size;
  }

  /** Check if a point is inside a rectangle */
  private isPointInRect(
    px: number,
    py: number,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
  }

  /** Get the items container width */
  private getItemsContainerWidth(): number {
    const innerPadding = 6;
    return 3 * PANEL.itemBoxSize + 2 * PANEL.itemSpacing + innerPadding * 2;
  }

  /** Get the total HUD width */
  private getTotalWidth(): number {
    return (
      PANEL.padding +
      PANEL.statsWidth +
      PANEL.margin +
      PANEL.portraitSize +
      PANEL.margin +
      PANEL.abilitiesWidth +
      PANEL.margin +
      this.getItemsContainerWidth() +
      PANEL.margin +
      PANEL.wardBoxSize +
      PANEL.padding
    );
  }

  /** Get the abilities section total height (abilities + bars) */
  private getAbilitiesSectionHeight(): number {
    // Level-up buttons (if skill points available) + Abilities + health bar + mana bar (if shown)
    const skillPoints = this.champion?.getSkillPoints() ?? 0;
    let height = 0;

    // Add space for level-up buttons when skill points are available
    if (skillPoints > 0) {
      height += PANEL.levelUpButtonHeight + PANEL.levelUpButtonGap;
    }

    height += PANEL.abilitiesHeight + PANEL.barSpacing + PANEL.barHeight;
    if (this.config.showManaBar) {
      height += PANEL.barSpacing + PANEL.barHeight;
    }
    return height;
  }

  /** Get the total HUD height */
  private getTotalHeight(): number {
    return this.getAbilitiesSectionHeight() + PANEL.padding * 2;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      // Skip rendering if no champion data available
      if (!this.champion) {
        return;
      }

      const ctx = gctx.canvasRenderingContext;

      // Draw ability range circles in world space (before HUD overlay)
      if (this.hoverState.ability) {
        this.drawAbilityRangeCircles(ctx, gctx);
      }

      // Position HUD at bottom center
      const hudWidth = this.getTotalWidth();
      const hudHeight = this.getTotalHeight();
      const startX = (Dimensions.w - hudWidth) / 2;
      const startY = Dimensions.h - hudHeight - 10;

      // Draw main HUD background
      this.drawHUDBackground(ctx, startX, startY, hudWidth, hudHeight);

      // Calculate center section height for vertical alignment
      const centerHeight = this.getAbilitiesSectionHeight();
      const contentTop = startY + PANEL.padding;

      let currentX = startX + PANEL.padding;

      // 1. Stats Panel (centered vertically)
      const statsY = contentTop + (centerHeight - (PANEL.statsHeight - PANEL.padding)) / 2;
      this.drawStatsPanel(ctx, currentX, statsY);
      currentX += PANEL.statsWidth + PANEL.margin;

      // 2. Portrait Panel (centered vertically)
      const portraitY = contentTop + (centerHeight - PANEL.portraitSize) / 2;
      this.drawPortraitPanel(ctx, currentX, portraitY);
      currentX += PANEL.portraitSize + PANEL.margin;

      // 3. Abilities Panel + Health/Mana Bars (this is the reference height)
      this.drawAbilitiesPanel(ctx, currentX, contentTop);
      currentX += PANEL.abilitiesWidth + PANEL.margin;

      // 4. Items Panel + Gold + Ward (centered vertically)
      const itemsContainerHeight = this.getItemsContainerHeight();
      const goldHeight = 20;
      const itemsTotalHeight = itemsContainerHeight + goldHeight;
      const itemsY = contentTop + (centerHeight - itemsTotalHeight) / 2;
      this.drawItemsPanel(ctx, currentX, itemsY, gctx.money);

      // 5. Ward count (next to items)
      const wardX = currentX + this.getItemsContainerWidth() + PANEL.margin;
      const wardY = contentTop + (centerHeight - PANEL.wardBoxSize) / 2;
      this.drawWardPanel(ctx, wardX, wardY);

      // 6. Draw active effects on top of HUD (from the right)
      this.drawActiveEffects(ctx, startX + hudWidth - PANEL.padding, startY - PANEL.effectSize - 8);

      // 7. Draw legacy buffs (stat modifiers, if any)
      // These are separate from active effects and displayed in a second row if needed
      this.drawBuffs(ctx, startX + hudWidth - PANEL.padding, startY - PANEL.effectSize - PANEL.buffSize - 14);

      // 8. Draw ability tooltip if hovering
      if (this.hoverState.ability) {
        const abilityBox = this.abilityBoxes.get(this.hoverState.ability);
        if (abilityBox) {
          this.drawAbilityTooltip(ctx, abilityBox.x, abilityBox.y, this.hoverState.ability);
        }
      }

      // 9. Draw effect tooltip if hovering
      if (this.hoverState.effect !== null && this.champion) {
        const effectBox = this.effectBoxes.get(this.hoverState.effect);
        const effects = this.champion.getActiveEffects();
        if (effectBox && this.hoverState.effect < effects.length) {
          this.drawEffectTooltip(ctx, effectBox.x, effectBox.y, effects[this.hoverState.effect]);
        }
      }

      // 10. Draw buff tooltip if hovering
      if (this.hoverState.buff !== null && this.champion) {
        const buffBox = this.buffBoxes.get(this.hoverState.buff);
        const buffs = this.champion.getBuffs();
        if (buffBox && this.hoverState.buff < buffs.length) {
          this.drawBuffTooltip(ctx, buffBox.x, buffBox.y, buffs[this.hoverState.buff]);
        }
      }

      // 11. Draw item tooltip if hovering
      if (this.hoverState.item !== null && this.champion) {
        const itemBox = this.itemBoxes.get(this.hoverState.item);
        const inventory = this.champion.getInventory();
        const equipped = inventory.items.get(this.hoverState.item);
        if (itemBox && equipped) {
          this.drawItemTooltip(ctx, itemBox.x, itemBox.y, equipped);
        }
      }
    });
  }

  /** Get the items container height */
  private getItemsContainerHeight(): number {
    const innerPadding = 6;
    return 2 * PANEL.itemBoxSize + PANEL.itemSpacing + innerPadding * 2;
  }

  /** Draw the main HUD background */
  private drawHUDBackground(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Main background
    ctx.fillStyle = HUD_COLORS.background;
    ctx.fillRect(x, y, width, height);

    // Border
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Accent line at top
    ctx.fillStyle = this.config.accentColor;
    ctx.fillRect(x, y, width, 3);
  }

  /** Draw the stats panel (2 columns) */
  private drawStatsPanel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.champion) return;
    const stats = this.champion.getStats();
    const width = PANEL.statsWidth;
    const height = PANEL.statsHeight - PANEL.padding;

    // Panel background
    ctx.fillStyle = HUD_COLORS.backgroundLight;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Stats data (2 columns)
    const leftStats = [
      { label: 'AD', value: Math.floor(stats.attackDamage) },
      { label: 'AP', value: Math.floor(stats.abilityPower || 0) },
      { label: 'AS', value: stats.attackSpeed.toFixed(2) },
      { label: 'MS', value: Math.floor(stats.movementSpeed) },
    ];

    const rightStats = [
      { label: 'ARM', value: Math.floor(stats.armor) },
      { label: 'MR', value: Math.floor(stats.magicResist) },
      { label: 'RNG', value: Math.floor(stats.attackRange) },
      { label: 'CDR', value: '0%' },
    ];

    const lineHeight = 18;
    const colWidth = width / 2;
    const startY = y + 8;

    // Left column
    leftStats.forEach((stat, i) => {
      RenderUtils.renderBitmapText(
        ctx,
        `${stat.label}`,
        x + 4,
        startY + i * lineHeight,
        { color: HUD_COLORS.textDim, size: 22, shadow: false }
      );
      RenderUtils.renderBitmapText(
        ctx,
        `${stat.value}`,
        x + colWidth - 4,
        startY + i * lineHeight,
        { color: HUD_COLORS.text, size: 22, shadow: false, rightAlign: true }
      );
    });

    // Right column
    rightStats.forEach((stat, i) => {
      RenderUtils.renderBitmapText(
        ctx,
        `${stat.label}`,
        x + colWidth + 4,
        startY + i * lineHeight,
        { color: HUD_COLORS.textDim, size: 22, shadow: false }
      );
      RenderUtils.renderBitmapText(
        ctx,
        `${stat.value}`,
        x + width - 4,
        startY + i * lineHeight,
        { color: HUD_COLORS.text, size: 22, shadow: false, rightAlign: true }
      );
    });
  }

  /** Draw the champion portrait panel with XP bar */
  private drawPortraitPanel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.champion) return;

    const size = PANEL.portraitSize;
    const level = this.champion.getLevel();
    const experience = this.champion.getExperience();
    const expToNext = this.champion.getExperienceToNextLevel();
    const skillPoints = this.champion.getSkillPoints();
    const xpPercent = expToNext > 0 ? experience / expToNext : 0;

    // Portrait background (black placeholder)
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, size, size);

    // Border
    ctx.strokeStyle = this.config.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // Champion name
    RenderUtils.renderBitmapText(
      ctx,
      this.config.championName,
      x + size / 2,
      y + size - 26,
      { color: HUD_COLORS.text, size: 22, centered: true, shadow: true }
    );

    // Level badge with pulse effect when skill points available
    const pulseScale = skillPoints > 0 ? 1 + Math.sin(this.levelUpPulseTime * 4) * 0.1 : 1;
    const badgeRadius = 14 * pulseScale;
    const badgeColor = skillPoints > 0 ? HUD_COLORS.levelUpButton : this.config.accentColor;

    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(x + size - 10, y + size - 10, badgeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = HUD_COLORS.background;
    ctx.lineWidth = 2;
    ctx.stroke();

    RenderUtils.renderBitmapText(
      ctx,
      `${level}`,
      x + size - 10,
      y + size - 21,
      { color: HUD_COLORS.text, size: 22, centered: true, shadow: false }
    );

    // XP Bar below portrait
    const xpBarY = y + size + PANEL.xpBarSpacing;
    const xpBarWidth = size;
    const xpBarHeight = PANEL.xpBarHeight;

    // XP bar background
    ctx.fillStyle = HUD_COLORS.xpBarBg;
    ctx.fillRect(x, xpBarY, xpBarWidth, xpBarHeight);

    // XP bar fill
    ctx.fillStyle = HUD_COLORS.xpBar;
    ctx.fillRect(x, xpBarY, xpBarWidth * xpPercent, xpBarHeight);

    // XP bar border
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, xpBarY, xpBarWidth, xpBarHeight);
  }

  /** Draw the abilities panel with health/mana bars and level-up buttons */
  private drawAbilitiesPanel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const width = PANEL.abilitiesWidth;
    const skillPoints = this.champion?.getSkillPoints() ?? 0;

    // Debug: Log skill points once per second
    const now = Date.now();
    if (!this._lastSkillPointsLogTime || now - this._lastSkillPointsLogTime > 1000) {
      console.log(`[ChampionHUD.drawAbilitiesPanel] skillPoints=${skillPoints}, hasChampion=${!!this.champion}`);
      this._lastSkillPointsLogTime = now;
    }

    // Clear level-up buttons cache
    this.levelUpButtons.clear();

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
      this.abilityBoxes.set(slot, { x: boxX, y: abilityY, size: boxSize });
      this.drawAbilityBox(ctx, boxX, abilityY, boxSize, slot);

      // Draw level-up button above ability if skill points available
      if (skillPoints > 0) {
        this.drawLevelUpButton(ctx, boxX, y, boxSize, slot);
      }
    });

    // Health bar below abilities
    const barY = abilityY + PANEL.abilitiesHeight + PANEL.barSpacing;
    this.drawHealthBar(ctx, x, barY, width);

    // Mana/Resource bar below health
    if (this.config.showManaBar) {
      const manaBarY = barY + PANEL.barHeight + PANEL.barSpacing;
      this.drawResourceBar(ctx, x, manaBarY, width);
    }
  }

  /** Draw a level-up button above an ability */
  private drawLevelUpButton(
    ctx: CanvasRenderingContext2D,
    abilityX: number,
    y: number,
    abilitySize: number,
    slot: AbilitySlot
  ): void {
    if (!this.champion) {
      console.log(`[drawLevelUpButton] No champion for slot ${slot}`);
      return;
    }

    const ability = this.champion.getAbility(slot);
    const currentRank = ability?.rank ?? 0;
    const maxRank = slot === 'R' ? 3 : 5;

    // Debug logging (throttled)
    if (slot === 'Q' && Math.random() < 0.01) {
      console.log(`[drawLevelUpButton] Q: currentRank=${currentRank}, maxRank=${maxRank}, level=${this.champion.getLevel()}`);
    }

    // Don't show button if ability is maxed
    if (currentRank >= maxRank) return;

    // Check R level requirements
    if (slot === 'R') {
      const level = this.champion.getLevel();
      const rRequiredLevels = [6, 11, 16];
      if (level < rRequiredLevels[currentRank]) return;
    }

    // Debug: We're actually drawing a button
    if (Math.random() < 0.01) {
      console.log(`[drawLevelUpButton] Drawing button for slot ${slot} at (${abilityX}, ${y})`);
    }

    const buttonWidth = PANEL.levelUpButtonWidth;
    const buttonHeight = PANEL.levelUpButtonHeight;
    const buttonX = abilityX + (abilitySize - buttonWidth) / 2;
    const buttonY = y;

    // Cache button position for hit testing
    this.levelUpButtons.set(slot, { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight });

    const isHovered = this.hoveredLevelUpButton === slot;
    const pulseIntensity = Math.sin(this.levelUpPulseTime * 4) * 0.5 + 0.5;

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
  private drawAbilityBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    slot: AbilitySlot
  ): void {
    const ability = this.champion?.getAbility(slot);
    const isHovered = this.hoverState.ability === slot;
    let progress = 1;
    let isReady = true;

    if (ability) {
      try {
        progress = typeof ability.cooldownProgress === 'number' ? ability.cooldownProgress : 1;
        isReady = typeof ability.isReady === 'boolean' ? ability.isReady : progress >= 1;
      } catch {
        // Fallback if getters throw
        progress = 1;
        isReady = true;
      }
    }

    // Background (brighter when hovered)
    ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.backgroundLight;
    ctx.fillRect(x, y, size, size);

    // Cooldown overlay
    if (!isReady) {
      ctx.fillStyle = HUD_COLORS.cooldownOverlay;
      ctx.fillRect(x, y, size, size * (1 - progress));
    }

    // Border (highlight when hovered)
    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = isReady ? this.config.accentColor : HUD_COLORS.abilityNotReady;
      ctx.lineWidth = 2;
    }
    ctx.strokeRect(x, y, size, size);

    // Key label
    RenderUtils.renderBitmapText(
      ctx,
      slot,
      x + size / 2,
      y + size / 2 - 18,
      { color: isReady ? HUD_COLORS.text : HUD_COLORS.textDim, size: 32, centered: true }
    );

    // Cooldown text
    if (!isReady && ability) {
      const cooldownRemaining = ability.cooldownRemaining ?? 0;
      RenderUtils.renderBitmapText(
        ctx,
        cooldownRemaining.toFixed(1),
        x + size / 2,
        y + size - 24,
        { color: HUD_COLORS.text, size: 22, centered: true }
      );
    }
  }

  /** Draw the health bar */
  private drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
    if (!this.champion) return;
    const stats = this.champion.getStats();
    const currentHealth = this.champion.getCurrentHealth();
    const maxHealth = stats.maxHealth;
    const healthPercent = currentHealth / maxHealth;
    const healthRegen = stats.healthRegen || 0;

    // Background
    ctx.fillStyle = HUD_COLORS.healthBarBg;
    ctx.fillRect(x, y, width, PANEL.barHeight);

    // Health fill
    ctx.fillStyle = HUD_COLORS.healthBar;
    ctx.fillRect(x, y, width * healthPercent, PANEL.barHeight);

    // Border
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, PANEL.barHeight);

    // Health text (centered)
    RenderUtils.renderBitmapText(
      ctx,
      `${Math.floor(currentHealth)}/${Math.floor(maxHealth)}`,
      x + width / 2,
      y + 1,
      { color: HUD_COLORS.text, size: 22, centered: true }
    );

    // Health regen text (right aligned inside bar)
    if (healthRegen > 0) {
      RenderUtils.renderBitmapText(
        ctx,
        `+${healthRegen.toFixed(1)}`,
        x + width - 4,
        y + 3,
        { color: '#90EE90', size: 18, rightAlign: true, shadow: false }
      );
    }
  }

  /** Draw the resource bar (mana/energy/rage) */
  private drawResourceBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
    if (!this.champion) return;
    const stats = this.champion.getStats();
    const currentResource = this.champion.getCurrentResource();
    const maxResource = stats.maxResource;
    const resourcePercent = currentResource / maxResource;
    const resourceRegen = stats.resourceRegen || 0;

    // Background
    ctx.fillStyle = HUD_COLORS.manaBarBg;
    ctx.fillRect(x, y, width, PANEL.barHeight);

    // Resource fill
    ctx.fillStyle = this.config.resourceColor;
    ctx.fillRect(x, y, width * resourcePercent, PANEL.barHeight);

    // Border
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, PANEL.barHeight);

    // Resource text (centered)
    RenderUtils.renderBitmapText(
      ctx,
      `${Math.floor(currentResource)}/${Math.floor(maxResource)}`,
      x + width / 2,
      y + 1,
      { color: HUD_COLORS.text, size: 22, centered: true }
    );

    // Resource regen text (right aligned inside bar)
    if (resourceRegen > 0) {
      RenderUtils.renderBitmapText(
        ctx,
        `+${resourceRegen.toFixed(1)}`,
        x + width - 4,
        y + 3,
        { color: '#87CEEB', size: 18, rightAlign: true, shadow: false }
      );
    }
  }

  /** Draw the items panel (2 rows x 3 cols) with gold display */
  private drawItemsPanel(ctx: CanvasRenderingContext2D, x: number, y: number, gold: number): void {
    const boxSize = PANEL.itemBoxSize;
    const spacing = PANEL.itemSpacing;
    const innerPadding = 6;

    // Calculate container size
    const containerWidth = 3 * boxSize + 2 * spacing + innerPadding * 2;
    const containerHeight = 2 * boxSize + spacing + innerPadding * 2;

    // Draw container background
    ctx.fillStyle = HUD_COLORS.backgroundLight;
    ctx.fillRect(x, y, containerWidth, containerHeight);
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, containerWidth, containerHeight);

    // Draw 6 item slots (2 rows x 3 cols) with inner padding
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const slotIndex = (row * 3 + col) as ItemSlot;
        const boxX = x + innerPadding + col * (boxSize + spacing);
        const boxY = y + innerPadding + row * (boxSize + spacing);
        // Cache position for hit testing
        this.itemBoxes.set(slotIndex, { x: boxX, y: boxY, size: boxSize });
        this.drawItemSlot(ctx, boxX, boxY, boxSize, slotIndex);
      }
    }

    // Draw gold count below items
    const goldY = y + containerHeight + 4;
    RenderUtils.renderBitmapText(
      ctx,
      `${gold}`,
      x + containerWidth / 2,
      goldY,
      { color: '#FFD700', size: 22, centered: true }
    );
  }

  /** Draw a single item slot */
  private drawItemSlot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    slotIndex: ItemSlot
  ): void {
    const isHovered = this.hoverState.item === slotIndex;
    const inventory = this.champion?.getInventory();
    const equipped = inventory?.items.get(slotIndex);

    // Background (brighter when hovered or has item)
    if (equipped) {
      ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.border;
    } else {
      ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.backgroundLight;
    }
    ctx.fillRect(x, y, size, size);

    // Border (highlight when hovered)
    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
    } else if (equipped) {
      ctx.strokeStyle = this.getItemCategoryColor(equipped.definition.category);
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = HUD_COLORS.border;
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(x, y, size, size);

    if (equipped) {
      // Draw item icon
      const icon = this.getItemIcon(equipped.definition);
      const iconColor = this.getItemCategoryColor(equipped.definition.category);
      RenderUtils.renderBitmapText(
        ctx,
        icon,
        x + size / 2,
        y + size / 2 - 14,
        { color: iconColor, size: 28, centered: true, shadow: true }
      );
    } else {
      // Show empty slot with number
      RenderUtils.renderBitmapText(
        ctx,
        `${slotIndex + 1}`,
        x + size / 2,
        y + size / 2 - 12,
        { color: isHovered ? HUD_COLORS.text : HUD_COLORS.textDim, size: 22, centered: true, shadow: false }
      );
    }
  }

  /** Get emoji icon for an item based on its category */
  private getItemIcon(item: ItemDefinition): string {
    const icons: Record<string, string> = {
      attack_damage: '⚔',
      ability_power: '✦',
      attack_speed: '⚡',
      armor: '🛡',
      magic_resist: '✧',
      health: '♥',
      movement: '👢',
      utility: '⚙',
    };
    return icons[item.category] || '?';
  }

  /** Get color for an item category */
  private getItemCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      attack_damage: '#ff6b6b',
      ability_power: '#a855f7',
      attack_speed: '#f1c40f',
      armor: '#f59e0b',
      magic_resist: '#8b5cf6',
      health: '#2ecc71',
      movement: '#06b6d4',
      utility: '#95a5a6',
    };
    return colors[category] || '#ffffff';
  }


  /** Get ability cooldown (placeholder - should come from ability) */
  private getAbilityCooldown(slot: 'Q' | 'W' | 'E' | 'R'): number {
    // TODO: Get actual cooldown from ability
    switch (slot) {
      case 'Q': return 6;
      case 'W': return 12;
      case 'E': return 4;
      case 'R': return 70;
      default: return 10;
    }
  }

  /** Draw active buffs/effects on top of HUD (from right to left) */
  private drawBuffs(ctx: CanvasRenderingContext2D, rightX: number, y: number): void {
    if (!this.champion) return;
    const buffs = this.champion.getBuffs();

    // Clear old buff boxes
    this.buffBoxes.clear();

    if (buffs.length === 0) return;

    const size = PANEL.buffSize;
    const spacing = PANEL.buffSpacing;

    // Draw buffs from right to left
    buffs.forEach((buff, index) => {
      const x = rightX - (index + 1) * (size + spacing) + spacing;
      // Cache position for hit testing
      this.buffBoxes.set(index, { x, y, size });
      const isHovered = this.hoverState.buff === index;
      this.drawBuffIcon(ctx, x, y, size, buff.source, isHovered);
    });
  }

  /** Draw a single buff icon */
  private drawBuffIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    source: string,
    isHovered: boolean = false
  ): void {
    // Background (brighter when hovered)
    ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.backgroundLight;
    ctx.fillRect(x, y, size, size);

    // Border (highlight when hovered)
    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = this.config.accentColor;
      ctx.lineWidth = 2;
    }
    ctx.strokeRect(x, y, size, size);

    // Buff indicator (first letter of source or icon)
    const label = source.charAt(0).toUpperCase();
    RenderUtils.renderBitmapText(
      ctx,
      label,
      x + size / 2,
      y + size / 2 - 12,
      { color: HUD_COLORS.text, size: 22, centered: true, shadow: false }
    );
  }

  /** Draw active effects on top of HUD (from right to left) */
  private drawActiveEffects(ctx: CanvasRenderingContext2D, rightX: number, y: number): void {
    if (!this.champion) return;
    const effects = this.champion.getActiveEffects();

    // Clear old effect boxes
    this.effectBoxes.clear();

    if (effects.length === 0) return;

    const size = PANEL.effectSize;
    const spacing = PANEL.effectSpacing;

    // Draw effects from right to left
    effects.forEach((effect, index) => {
      const x = rightX - (index + 1) * (size + spacing) + spacing;
      // Cache position for hit testing
      this.effectBoxes.set(index, { x, y, size });
      const isHovered = this.hoverState.effect === index;
      this.drawEffectIcon(ctx, x, y, size, effect, isHovered);
    });
  }

  /** Draw a single effect icon */
  private drawEffectIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    effect: HUDActiveEffect,
    isHovered: boolean = false
  ): void {
    const displayInfo = getEffectDisplayInfo(effect.definitionId);

    // Background based on category
    const bgColor = isHovered
      ? HUD_COLORS.borderHighlight
      : (displayInfo.category === 'buff' ? 'rgba(46, 204, 113, 0.3)' :
         displayInfo.category === 'debuff' ? 'rgba(231, 76, 60, 0.3)' :
         'rgba(155, 89, 182, 0.3)');
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, size, size);

    // Border with effect color (highlight when hovered)
    if (isHovered) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = displayInfo.color;
      ctx.lineWidth = 2;
    }
    ctx.strokeRect(x, y, size, size);

    // Effect icon
    RenderUtils.renderBitmapText(
      ctx,
      displayInfo.icon,
      x + size / 2,
      y + size / 2 - 14,
      { color: displayInfo.color, size: 26, centered: true, shadow: true }
    );

    // Duration timer at bottom
    if (effect.timeRemaining > 0) {
      const timerText = effect.timeRemaining >= 10
        ? Math.floor(effect.timeRemaining).toString()
        : effect.timeRemaining.toFixed(1);
      RenderUtils.renderBitmapText(
        ctx,
        timerText,
        x + size / 2,
        y + size - 16,
        { color: HUD_COLORS.text, size: 16, centered: true, shadow: false }
      );
    }

    // Stack count at top right if > 1
    if (effect.stacks > 1) {
      RenderUtils.renderBitmapText(
        ctx,
        `x${effect.stacks}`,
        x + size - 4,
        y + 2,
        { color: '#FFD700', size: 14, rightAlign: true, shadow: true }
      );
    }
  }

  /** Draw effect tooltip above the effect icon */
  private drawEffectTooltip(
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

  /** Draw ward count panel */
  private drawWardPanel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const size = PANEL.wardBoxSize;
    const trinket = this.champion?.getTrinket();
    const charges = trinket?.getCharges() ?? 0;
    const maxCharges = trinket?.getDefinition().maxCharges ?? 2;

    // Background
    ctx.fillStyle = HUD_COLORS.backgroundLight;
    ctx.fillRect(x, y, size, size);

    // Border
    ctx.strokeStyle = charges > 0 ? '#44FF44' : HUD_COLORS.border;
    ctx.lineWidth = charges > 0 ? 2 : 1;
    ctx.strokeRect(x, y, size, size);

    // Ward icon (simple eye symbol)
    ctx.fillStyle = charges > 0 ? '#44FF44' : HUD_COLORS.textDim;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2 - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = HUD_COLORS.background;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2 - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Charge count
    RenderUtils.renderBitmapText(
      ctx,
      `${charges}/${maxCharges}`,
      x + size / 2,
      y + size - 22,
      { color: charges > 0 ? '#44FF44' : HUD_COLORS.textDim, size: 20, centered: true, shadow: false }
    );
  }

  /** Draw ability range circles around champion (in screen space) */
  private drawAbilityRangeCircles(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    if (!this.champion) return;
    const slot = this.hoverState.ability;
    if (!slot) return;

    const ability = this.champion.getAbility(slot);
    if (!ability) return;

    // Get target description for range info
    const targetDesc = ability.getTargetDescription?.();
    if (!targetDesc) return;

    const championPos = this.champion.getPosition();
    const camera = gctx.camera;

    // Transform world position to screen position
    const screenX = (championPos.x - camera.position.x) * camera.zoom + Dimensions.w / 2;
    const screenY = (championPos.y - camera.position.y) * camera.zoom + Dimensions.h / 2;

    ctx.save();

    // Draw cast range circle
    if (targetDesc.range && targetDesc.range > 0) {
      const rangeScreenRadius = targetDesc.range * camera.zoom;

      // Cast range (dashed cyan circle)
      ctx.strokeStyle = 'rgba(0, 206, 209, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(screenX, screenY, rangeScreenRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Range label
      ctx.setLineDash([]);
      RenderUtils.renderBitmapText(
        ctx,
        `Range: ${targetDesc.range}`,
        screenX,
        screenY - rangeScreenRadius - 20,
        { color: '#00CED1', size: 20, centered: true }
      );
    }

    // Draw AoE radius for ground target abilities
    const aoeRadius = (targetDesc as any).aoeRadius;
    if (aoeRadius && aoeRadius > 0) {
      const aoeScreenRadius = aoeRadius * camera.zoom;

      // Get mouse position to show AoE preview at cursor
      const mousePos = this.inputManager.getMousePosition();
      if (mousePos) {
        // AoE preview circle (solid orange)
        ctx.fillStyle = 'rgba(255, 165, 0, 0.2)';
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, aoeScreenRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // AoE label
        RenderUtils.renderBitmapText(
          ctx,
          `AoE: ${aoeRadius}`,
          mousePos.x,
          mousePos.y - aoeScreenRadius - 15,
          { color: '#FFA500', size: 20, centered: true }
        );
      }
    }

    // Draw skillshot width for skillshot abilities
    const width = (targetDesc as any).width;
    if (width && width > 0 && targetDesc.range) {
      const widthScreen = width * camera.zoom;
      const rangeScreen = targetDesc.range * camera.zoom;

      // Get mouse position for direction
      const mousePos = this.inputManager.getMousePosition();
      if (mousePos) {
        const dx = mousePos.x - screenX;
        const dy = mousePos.y - screenY;
        const angle = Math.atan2(dy, dx);

        // Draw skillshot rectangle preview
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);

        ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.fillRect(0, -widthScreen / 2, rangeScreen, widthScreen);
        ctx.strokeRect(0, -widthScreen / 2, rangeScreen, widthScreen);

        ctx.restore();

        // Width label
        RenderUtils.renderBitmapText(
          ctx,
          `Width: ${width}`,
          screenX + Math.cos(angle) * rangeScreen / 2,
          screenY + Math.sin(angle) * rangeScreen / 2 - widthScreen / 2 - 15,
          { color: '#FF6464', size: 20, centered: true }
        );
      }
    }

    ctx.restore();
  }

  /** Draw ability tooltip above the ability box */
  private drawAbilityTooltip(
    ctx: CanvasRenderingContext2D,
    abilityX: number,
    abilityY: number,
    slot: AbilitySlot
  ): void {
    if (!this.champion) return;
    const ability = this.champion.getAbility(slot);
    if (!ability) return;

    const name = ability.definition?.name || slot;
    const rawDescription = ability.definition?.description || 'No description';
    const rank = ability.rank ?? 0;
    const maxRank = ability.definition?.maxRank ?? (slot === 'R' ? 3 : 5);

    // Interpolate description with actual calculated values
    const stats = this.champion.getStats();
    const description = this.interpolateAbilityDescription(
      rawDescription,
      ability.definition,
      rank,
      stats
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
    const descriptionLines = this.wrapText(description, tooltipWidth - padding * 2, 14);
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
    ctx.strokeStyle = this.config.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

    let currentY = clampedY + padding;

    // Ability name
    RenderUtils.renderBitmapText(
      ctx,
      `${slot} - ${name}`,
      clampedX + padding,
      currentY,
      { color: this.config.accentColor, size: 26, shadow: false }
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

    // Cooldown info (right aligned)
    const cooldown = this.getAbilityCooldown(slot);
    RenderUtils.renderBitmapText(
      ctx,
      `CD: ${cooldown}s`,
      clampedX + tooltipWidth - padding,
      currentY,
      { color: '#AAAAAA', size: 20, shadow: false, rightAlign: true }
    );

    ctx.restore();
  }

  /** Wrap text to fit within a given width */
  private wrapText(text: string, maxWidth: number, fontSize: number, charWidthFactor = 0.6): string[] {
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
   * Replaces {damage}, {heal}, {shield} with actual values including scaling breakdown.
   */
  private interpolateAbilityDescription(
    description: string,
    definition: HUDAbilityDefinition | null | undefined,
    rank: number,
    stats: ChampionStats
  ): string {
    if (!definition || rank < 1) {
      return description;
    }

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
      const formatted = this.formatScalingValue(value, definition.damage.scaling, statValues, definition.damage.type);
      result = result.replace('{damage}', formatted);
    }

    // Replace {heal} placeholder
    if (definition.heal?.scaling) {
      const value = calculateAbilityValue(definition.heal.scaling, rank, statValues);
      const formatted = this.formatScalingValue(value, definition.heal.scaling, statValues);
      result = result.replace('{heal}', formatted);
    }

    // Replace {shield} placeholder
    if (definition.shield?.scaling) {
      const value = calculateAbilityValue(definition.shield.scaling, rank, statValues);
      const formatted = this.formatScalingValue(value, definition.shield.scaling, statValues);
      result = result.replace('{shield}', formatted);
    }

    return result;
  }

  /**
   * Format a scaling value with breakdown showing base + scaling contributions.
   * Example: "150 (+80% AD)" or "200 (+50% AP)"
   */
  private formatScalingValue(
    totalValue: number,
    scaling: AbilityScaling,
    stats: {
      attackDamage?: number;
      abilityPower?: number;
      bonusHealth?: number;
      maxHealth?: number;
      armor?: number;
      magicResist?: number;
    },
    damageType?: DamageType
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

  /** Draw buff tooltip above the buff icon */
  private drawBuffTooltip(
    ctx: CanvasRenderingContext2D,
    buffX: number,
    buffY: number,
    buff: StatModifier
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
    ctx.strokeStyle = this.config.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

    let currentY = clampedY + padding;

    // Buff name (source)
    const displayName = this.formatBuffName(buff.source);
    RenderUtils.renderBitmapText(
      ctx,
      displayName,
      clampedX + padding,
      currentY,
      { color: this.config.accentColor, size: 24, shadow: false }
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

  /** Format buff source name for display */
  private formatBuffName(source: string): string {
    // Convert snake_case or camelCase to Title Case
    return source
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Draw item tooltip above the item slot */
  private drawItemTooltip(
    ctx: CanvasRenderingContext2D,
    itemX: number,
    itemY: number,
    equipped: EquippedItem
  ): void {
    const item = equipped.definition;
    const padding = PANEL.tooltipPadding;
    const lineHeight = 18;

    // Build stat lines from item stats
    const statLines: { label: string; value: string; color: string }[] = [];
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
      critChance: { label: 'Crit Chance', color: '#e67e22' },
    };

    for (const [stat, value] of Object.entries(item.stats)) {
      if (value !== 0 && value !== undefined) {
        const info = statLabels[stat] || { label: stat, color: '#ffffff' };
        let displayValue: string;
        if (stat === 'critChance' || stat === 'attackSpeed') {
          displayValue = `+${((value as number) * 100).toFixed(0)}%`;
        } else {
          displayValue = `+${value}`;
        }
        statLines.push({
          label: info.label,
          value: displayValue,
          color: info.color,
        });
      }
    }

    // Calculate tooltip dimensions
    const tooltipWidth = 340;
    const headerHeight = lineHeight + 8;
    const statsHeight = statLines.length * lineHeight;
    const sellHeight = lineHeight + 4;

    // Wrap description text (use smaller char width for pixel font)
    const descLines = this.wrapText(item.description, tooltipWidth - padding * 2, 16, 0.45);
    const descHeight = descLines.length * lineHeight + 4;

    // Passive display - passiveIds are just string IDs, display them simply
    const passiveData = (item.passiveIds || []).map((passiveId: string) => ({
      name: passiveId,
      descLines: [] as string[],
    }));
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
    ctx.strokeStyle = this.getItemCategoryColor(item.category);
    ctx.lineWidth = 2;
    ctx.strokeRect(clampedX, clampedY, tooltipWidth, tooltipHeight);

    let currentY = clampedY + padding;

    // Item name with icon
    const icon = this.getItemIcon(item);
    RenderUtils.renderBitmapText(
      ctx,
      `${icon} ${item.name}`,
      clampedX + padding,
      currentY,
      { color: this.getItemCategoryColor(item.category), size: 24, shadow: false }
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
}

export default ChampionHUD;
