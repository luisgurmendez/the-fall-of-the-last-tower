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
import type { ItemSlot, AbilitySlot } from '@siege/shared';
import AbilityIconLoader from '@/ui/AbilityIconLoader';
import type {
  HUDChampionData,
  HUDHoverState,
  HUDConfig,
  HUDContext,
} from '@/ui/hud/types';
import {
  HUD_COLORS,
  PANEL,
  isPointInBox,
  isPointInRect,
  getItemsContainerWidth,
  getTotalWidth,
  getAbilitiesSectionHeight,
  getTotalHeight,
  getItemsContainerHeight,
} from '@/ui/hud/layout';
import { drawStatsPanel } from '@/ui/hud/statsPanel';
import { drawPortraitPanel } from '@/ui/hud/portrait';
import { drawPassivePanel, drawAbilitiesPanel } from '@/ui/hud/abilityBar';
import { drawItemsPanel, drawWardPanel } from '@/ui/hud/items';
import { drawActiveEffects, drawBuffs } from '@/ui/hud/effectIcons';
import {
  drawAbilityTooltip,
  drawPassiveTooltip,
  drawEffectTooltip,
  drawBuffTooltip,
  drawItemTooltip,
} from '@/ui/hud/tooltips';
// Re-export for external use
export type { ItemSlot, AbilitySlot };
export type {
  HUDTrinket,
  HUDAbilityDefinition,
  HUDAbility,
  HUDPassiveDefinition,
  HUDPassive,
  HUDChampionData,
  HUDActiveEffect,
  HUDHoverState,
  HUDConfig,
} from '@/ui/hud/types';

export class ChampionHUD extends ScreenEntity {
  private champion: HUDChampionData | null;
  private inputManager: InputManager;

  /** Config, hover state, hit-test caches and animation state shared with the HUD panels */
  private hud: HUDContext;

  /** Callback for level-up button clicks */
  private onLevelUp?: (slot: AbilitySlot) => void;

  /**
   * Create a ChampionHUD.
   * @param config - HUD configuration options
   * @param champion - Champion data provider (optional, can be set later)
   */
  constructor(config: HUDConfig, champion?: HUDChampionData) {
    super();
    this.champion = champion ?? null;
    this.inputManager = InputManager.getInstance();
    const iconLoader = AbilityIconLoader.getInstance();
    const resolvedConfig = {
      showManaBar: true,
      resourceColor: HUD_COLORS.manaBar,
      resourceName: 'Mana',
      onAbilityHover: undefined,
      onItemHover: undefined,
      championId: config.championName?.toLowerCase(),
      ...config,
    } as Required<HUDConfig>;
    this.hud = {
      config: resolvedConfig,
      iconLoader,
      hoverState: { ability: null, item: null, buff: null, effect: null, passive: false },
      passiveBox: null,
      abilityBoxes: new Map(),
      itemBoxes: new Map(),
      buffBoxes: new Map(),
      effectBoxes: new Map(),
      levelUpButtons: new Map(),
      hoveredLevelUpButton: null,
      levelUpPulseTime: 0,
      chargeState: null,
    };

    // Preload ability icons if championId is available
    if (this.hud.config.championId) {
      this.hud.iconLoader.preloadChampion(this.hud.config.championId);
    }
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

  /**
   * Set the current charge state (for charge abilities).
   * @param state - The charge state or null if not charging
   */
  setChargeState(state: { slot: AbilitySlot; progress: number } | null): void {
    this.hud.chargeState = state;
  }

  /** Get current hover state */
  getHoverState(): HUDHoverState {
    return { ...this.hud.hoverState };
  }

  /** Check if a specific ability is being hovered */
  isAbilityHovered(slot: AbilitySlot): boolean {
    return this.hud.hoverState.ability === slot;
  }

  /** Check if a specific item slot is being hovered */
  isItemHovered(slot: ItemSlot): boolean {
    return this.hud.hoverState.item === slot;
  }

  /** Update hover detection */
  override step(gctx: GameContext): void {
    // Update pulse animation time
    this.hud.levelUpPulseTime += gctx.dt;

    const mousePos = this.inputManager.getMousePosition();
    if (!mousePos) return;

    // Check ability hover
    let newHoveredAbility: AbilitySlot | null = null;
    for (const [slot, box] of this.hud.abilityBoxes) {
      if (isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredAbility = slot;
        break;
      }
    }

    // Check item hover
    let newHoveredItem: ItemSlot | null = null;
    for (const [slot, box] of this.hud.itemBoxes) {
      if (isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredItem = slot;
        break;
      }
    }

    // Check buff hover
    let newHoveredBuff: number | null = null;
    for (const [index, box] of this.hud.buffBoxes) {
      if (isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredBuff = index;
        break;
      }
    }

    // Check effect hover
    let newHoveredEffect: number | null = null;
    for (const [index, box] of this.hud.effectBoxes) {
      if (isPointInBox(mousePos.x, mousePos.y, box)) {
        newHoveredEffect = index;
        break;
      }
    }

    // Check passive hover
    let newHoveredPassive = false;
    if (this.hud.passiveBox && isPointInBox(mousePos.x, mousePos.y, this.hud.passiveBox)) {
      newHoveredPassive = true;
    }

    // Check level-up button hover
    let newHoveredLevelUpButton: AbilitySlot | null = null;
    for (const [slot, box] of this.hud.levelUpButtons) {
      if (isPointInRect(mousePos.x, mousePos.y, box)) {
        newHoveredLevelUpButton = slot;
        break;
      }
    }
    this.hud.hoveredLevelUpButton = newHoveredLevelUpButton;

    // Handle level-up button click
    if (this.hud.hoveredLevelUpButton && this.inputManager.isMouseButtonJustPressed(MouseButton.LEFT)) {
      if (this.onLevelUp && this.champion) {
        const skillPoints = this.champion.getSkillPoints();
        if (skillPoints > 0) {
          this.onLevelUp(this.hud.hoveredLevelUpButton);
        }
      }
    }

    // Fire callbacks if hover state changed
    if (newHoveredAbility !== this.hud.hoverState.ability) {
      this.hud.hoverState.ability = newHoveredAbility;
      if (this.hud.config.onAbilityHover) {
        this.hud.config.onAbilityHover(newHoveredAbility);
      }
    }

    if (newHoveredItem !== this.hud.hoverState.item) {
      this.hud.hoverState.item = newHoveredItem;
      if (this.hud.config.onItemHover) {
        this.hud.config.onItemHover(newHoveredItem);
      }
    }

    // Update buff hover state
    if (newHoveredBuff !== this.hud.hoverState.buff) {
      this.hud.hoverState.buff = newHoveredBuff;
    }

    // Update effect hover state
    if (newHoveredEffect !== this.hud.hoverState.effect) {
      this.hud.hoverState.effect = newHoveredEffect;
    }

    // Update passive hover state
    if (newHoveredPassive !== this.hud.hoverState.passive) {
      this.hud.hoverState.passive = newHoveredPassive;
    }
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      // Skip rendering if no champion data available
      if (!this.champion) {
        return;
      }

      const ctx = gctx.canvasRenderingContext;

      // Draw ability range circles in world space (before HUD overlay)
      if (this.hud.hoverState.ability) {
        this.drawAbilityRangeCircles(ctx, gctx);
      }

      // Position HUD at bottom center
      const hudWidth = getTotalWidth();
      const hudHeight = getTotalHeight(this.champion.getSkillPoints(), this.hud.config.showManaBar);
      const startX = (Dimensions.w - hudWidth) / 2;
      const startY = Dimensions.h - hudHeight - 10;

      // Draw main HUD background
      this.drawHUDBackground(ctx, startX, startY, hudWidth, hudHeight);

      // Calculate center section height for vertical alignment
      const centerHeight = getAbilitiesSectionHeight(this.champion.getSkillPoints(), this.hud.config.showManaBar);
      const contentTop = startY + PANEL.padding;

      let currentX = startX + PANEL.padding;

      // 1. Stats Panel (centered vertically)
      const statsY = contentTop + (centerHeight - (PANEL.statsHeight - PANEL.padding)) / 2;
      drawStatsPanel(ctx, currentX, statsY, this.champion);
      currentX += PANEL.statsWidth + PANEL.margin;

      // 2. Portrait Panel (centered vertically)
      const portraitY = contentTop + (centerHeight - PANEL.portraitSize) / 2;
      drawPortraitPanel(ctx, currentX, portraitY, this.champion, this.hud);
      currentX += PANEL.portraitSize + PANEL.margin;

      // 3. Passive Panel (centered vertically)
      const passiveY = contentTop + (centerHeight - PANEL.passiveBoxSize) / 2;
      drawPassivePanel(ctx, currentX, passiveY, this.champion, this.hud);
      currentX += PANEL.passiveBoxSize + PANEL.margin;

      // 4. Abilities Panel + Health/Mana Bars (this is the reference height)
      drawAbilitiesPanel(ctx, currentX, contentTop, this.champion, this.hud);
      currentX += PANEL.abilitiesWidth + PANEL.margin;

      // 5. Items Panel + Gold + Ward (centered vertically)
      const itemsContainerHeight = getItemsContainerHeight();
      const goldHeight = 20;
      const itemsTotalHeight = itemsContainerHeight + goldHeight;
      const itemsY = contentTop + (centerHeight - itemsTotalHeight) / 2;
      // Use gold from champion adapter (server state) instead of gctx.money
      const gold = this.champion?.getGold() ?? 0;
      drawItemsPanel(ctx, currentX, itemsY, gold, this.champion, this.hud);

      // 6. Ward count (next to items)
      const wardX = currentX + getItemsContainerWidth() + PANEL.margin;
      const wardY = contentTop + (centerHeight - PANEL.wardBoxSize) / 2;
      drawWardPanel(ctx, wardX, wardY, this.champion);

      // 7. Draw active effects on top of HUD (from the right)
      drawActiveEffects(ctx, startX + hudWidth - PANEL.padding, startY - PANEL.effectSize - 8, this.champion, this.hud);

      // 8. Draw legacy buffs (stat modifiers, if any)
      // These are separate from active effects and displayed in a second row if needed
      drawBuffs(ctx, startX + hudWidth - PANEL.padding, startY - PANEL.effectSize - PANEL.buffSize - 14, this.champion, this.hud);

      // 9. Draw ability tooltip if hovering
      if (this.hud.hoverState.ability) {
        const abilityBox = this.hud.abilityBoxes.get(this.hud.hoverState.ability);
        if (abilityBox) {
          drawAbilityTooltip(ctx, abilityBox.x, abilityBox.y, this.hud.hoverState.ability, this.champion, this.hud.config.accentColor);
        }
      }

      // 10. Draw passive tooltip if hovering
      if (this.hud.hoverState.passive && this.hud.passiveBox && this.champion) {
        const passive = this.champion.getPassive();
        if (passive) {
          drawPassiveTooltip(ctx, this.hud.passiveBox.x, this.hud.passiveBox.y, passive);
        }
      }

      // 11. Draw effect tooltip if hovering
      if (this.hud.hoverState.effect !== null && this.champion) {
        const effectBox = this.hud.effectBoxes.get(this.hud.hoverState.effect);
        const effects = this.champion.getActiveEffects();
        if (effectBox && this.hud.hoverState.effect < effects.length) {
          drawEffectTooltip(ctx, effectBox.x, effectBox.y, effects[this.hud.hoverState.effect]);
        }
      }

      // 12. Draw buff tooltip if hovering
      if (this.hud.hoverState.buff !== null && this.champion) {
        const buffBox = this.hud.buffBoxes.get(this.hud.hoverState.buff);
        const buffs = this.champion.getBuffs();
        if (buffBox && this.hud.hoverState.buff < buffs.length) {
          drawBuffTooltip(ctx, buffBox.x, buffBox.y, buffs[this.hud.hoverState.buff], this.hud.config.accentColor);
        }
      }

      // 13. Draw item tooltip if hovering
      if (this.hud.hoverState.item !== null && this.champion) {
        const itemBox = this.hud.itemBoxes.get(this.hud.hoverState.item);
        const inventory = this.champion.getInventory();
        const equipped = inventory.items.get(this.hud.hoverState.item);
        if (itemBox && equipped) {
          drawItemTooltip(ctx, itemBox.x, itemBox.y, equipped);
        }
      }
    });
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
    ctx.fillStyle = this.hud.config.accentColor;
    ctx.fillRect(x, y, width, 3);
  }


  /** Draw ability range circles around champion (in screen space) */
  private drawAbilityRangeCircles(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    if (!this.champion) return;
    const slot = this.hud.hoverState.ability;
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

    // Get shape info early so we can skip range circle for cones
    const aoeRadius = (targetDesc as any).aoeRadius;
    const shape = (targetDesc as any).shape;

    // Draw cast range circle (skip for cone abilities - the cone itself shows the range)
    if (targetDesc.range && targetDesc.range > 0 && shape !== 'cone') {
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
    // Check if this is a dash ability (aoeRadius is the dash hitbox, not AoE)
    const hasDash = !!(targetDesc as any).dash;

    // Draw AoE circle for ground target abilities (skip for cone and dash - they have their own indicators)
    if (aoeRadius && aoeRadius > 0 && shape !== 'cone' && !hasDash) {
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

    // Draw cone for cone-shaped abilities
    // Note: For cones, aoeRadius is the actual damage range, not the cast range
    const coneAngle = (targetDesc as any).coneAngle;
    const coneRadius = aoeRadius || targetDesc.range;  // Use aoeRadius if available
    if (shape === 'cone' && coneAngle && coneRadius) {
      const rangeScreenRadius = coneRadius * camera.zoom;

      // Get mouse position for direction
      const mousePos = this.inputManager.getMousePosition();
      if (mousePos) {
        const dx = mousePos.x - screenX;
        const dy = mousePos.y - screenY;
        const baseAngle = Math.atan2(dy, dx);
        const halfAngle = coneAngle / 2;

        // Draw cone indicator
        ctx.fillStyle = 'rgba(255, 165, 0, 0.25)';
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.arc(screenX, screenY, rangeScreenRadius, baseAngle - halfAngle, baseAngle + halfAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw skillshot/dash line indicator
    // For dash abilities, use aoeRadius as the width (it's the dash hitbox)
    // For regular skillshots, use width property
    // Skip rectangle for vex_dash - it's a simple point-and-click dash
    const abilityId = ability.definition?.id;
    const skipDashRectangle = abilityId === 'vex_dash';
    const skillshotWidth = (targetDesc as any).width || (hasDash && !skipDashRectangle ? aoeRadius : 0);
    const dashDistance = hasDash ? (targetDesc as any).dash?.distance : 0;
    const skillshotRange = dashDistance || targetDesc.range;

    if (skillshotWidth && skillshotWidth > 0 && skillshotRange && !skipDashRectangle) {
      const widthScreen = skillshotWidth * camera.zoom;
      const rangeScreen = skillshotRange * camera.zoom;

      // Get mouse position for direction
      const mousePos = this.inputManager.getMousePosition();
      if (mousePos) {
        const dx = mousePos.x - screenX;
        const dy = mousePos.y - screenY;
        const angle = Math.atan2(dy, dx);

        // Draw skillshot/dash rectangle preview
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(angle);

        // Use different color for dash vs skillshot
        const color = hasDash ? 'rgba(255, 200, 50' : 'rgba(255, 100, 100';
        ctx.fillStyle = color + ', 0.2)';
        ctx.strokeStyle = color + ', 0.8)';
        ctx.lineWidth = 2;
        ctx.fillRect(0, -widthScreen / 2, rangeScreen, widthScreen);
        ctx.strokeRect(0, -widthScreen / 2, rangeScreen, widthScreen);

        ctx.restore();
      }
    }

    ctx.restore();
  }

}

export default ChampionHUD;
