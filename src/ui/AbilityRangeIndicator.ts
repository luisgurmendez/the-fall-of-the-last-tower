/**
 * AbilityRangeIndicator - Renders ability range/targeting indicators in world space.
 *
 * Shows:
 * - Range circle (for targeted abilities)
 * - AOE circle at cursor (for ground-target abilities)
 * - Cone indicator (for cone abilities)
 * - Line indicator (for skillshots)
 */

import type { GameObject } from '@/core/GameObject';
import type GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import Vector from '@/physics/vector';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import type { ChampionHUD, HUDAbility } from '@/ui/ChampionHUD';
import type { AbilitySlot } from '@siege/shared';
import { InputManager } from '@/core/input/InputManager';

/**
 * Colors for ability indicators.
 */
const INDICATOR_COLORS = {
  RANGE: 'rgba(100, 149, 237, 0.3)',      // Cornflower blue, semi-transparent
  RANGE_BORDER: 'rgba(100, 149, 237, 0.6)',
  AOE: 'rgba(65, 105, 225, 0.35)',         // Royal blue
  AOE_BORDER: 'rgba(65, 105, 225, 0.7)',
  CONE: 'rgba(100, 149, 237, 0.3)',
  CONE_BORDER: 'rgba(100, 149, 237, 0.6)',
  SKILLSHOT: 'rgba(100, 149, 237, 0.25)',
  SKILLSHOT_BORDER: 'rgba(100, 149, 237, 0.5)',
};

/**
 * AbilityRangeIndicator renders targeting indicators when hovering abilities.
 */
export class AbilityRangeIndicator implements GameObject {
  readonly id = 'ability-range-indicator';
  shouldInitialize = false;
  shouldDispose = false;
  position = new Vector(0, 0);

  private stateManager: OnlineStateManager;
  private championHUD: ChampionHUD;
  private inputManager: InputManager;

  constructor(
    stateManager: OnlineStateManager,
    championHUD: ChampionHUD,
    inputManager: InputManager
  ) {
    this.stateManager = stateManager;
    this.championHUD = championHUD;
    this.inputManager = inputManager;
  }

  /**
   * Render the ability range indicator.
   */
  render(): RenderElement {
    const element = new RenderElement((ctx: GameContext) => {
      const { canvasRenderingContext, camera } = ctx;

      // Get hovered ability
      const hoverState = this.championHUD.getHoverState();
      if (!hoverState.ability) return;

      // Get local player position
      const localEntity = this.stateManager.getLocalPlayerEntity();
      if (!localEntity) return;

      const championPos = localEntity.position;

      // Get ability info
      const ability = this.getAbilityData(hoverState.ability);
      if (!ability) return;

      const targetInfo = ability.getTargetDescription?.();
      if (!targetInfo || !targetInfo.range) return;

      // Get mouse position in world coordinates
      const mouseWorld = this.inputManager.getMouseWorldPosition(camera.position, camera.zoom);

      // Draw based on ability type
      this.drawIndicators(
        canvasRenderingContext,
        championPos,
        mouseWorld,
        targetInfo
      );
    }, true); // true = world space

    element.positionType = 'normal';
    return element;
  }

  /**
   * Get ability data for a slot.
   */
  private getAbilityData(slot: AbilitySlot): HUDAbility | undefined {
    // Access champion adapter through HUD
    const championData = (this.championHUD as any).championData;
    if (!championData) return undefined;
    return championData.getAbility(slot);
  }

  /**
   * Draw all indicators for an ability.
   */
  private drawIndicators(
    ctx: CanvasRenderingContext2D,
    championPos: Vector,
    mouseWorld: Vector,
    targetInfo: {
      range?: number;
      targetType?: string;
      shape?: string;
      aoeRadius?: number;
      coneAngle?: number;
    }
  ): void {
    const { range, targetType, shape, aoeRadius, coneAngle } = targetInfo;

    // Always draw range circle for abilities with range
    if (range && range > 0) {
      this.drawRangeCircle(ctx, championPos, range);
    }

    // Draw shape-specific indicator
    if (shape === 'cone' && coneAngle && range) {
      // Cone indicator pointing toward mouse
      const direction = mouseWorld.clone().sub(championPos).normalize();
      this.drawCone(ctx, championPos, range, coneAngle, direction);
    } else if (shape === 'circle' && aoeRadius) {
      if (targetType === 'ground_target') {
        // AOE circle at mouse position (clamped to range)
        const toMouse = mouseWorld.clone().sub(championPos);
        const distance = toMouse.length();
        let aoeCenter = mouseWorld;
        if (range && distance > range) {
          // Clamp to range
          aoeCenter = championPos.clone().add(toMouse.clone().normalize().scalar(range));
        }
        this.drawAoeCircle(ctx, aoeCenter, aoeRadius);
      } else if (targetType === 'no_target' || targetType === 'self') {
        // AOE around champion (e.g., self-centered AOE)
        this.drawAoeCircle(ctx, championPos, aoeRadius);
      }
    } else if (shape === 'line' || targetType === 'skillshot') {
      // Skillshot line indicator
      if (range) {
        const direction = mouseWorld.clone().sub(championPos).normalize();
        this.drawSkillshotLine(ctx, championPos, direction, range, targetInfo.aoeRadius || 40);
      }
    } else if (targetType === 'ground_target' && aoeRadius) {
      // Ground target without specific shape - show AOE at cursor
      const toMouse = mouseWorld.clone().sub(championPos);
      const distance = toMouse.length();
      let aoeCenter = mouseWorld;
      if (range && distance > range) {
        aoeCenter = championPos.clone().add(toMouse.clone().normalize().scalar(range));
      }
      this.drawAoeCircle(ctx, aoeCenter, aoeRadius);
    }
  }

  /**
   * Draw range circle around champion.
   */
  private drawRangeCircle(
    ctx: CanvasRenderingContext2D,
    center: Vector,
    radius: number
  ): void {
    ctx.save();

    // Fill
    ctx.fillStyle = INDICATOR_COLORS.RANGE;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = INDICATOR_COLORS.RANGE_BORDER;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  /**
   * Draw AOE circle (at cursor or around champion).
   */
  private drawAoeCircle(
    ctx: CanvasRenderingContext2D,
    center: Vector,
    radius: number
  ): void {
    ctx.save();

    // Fill
    ctx.fillStyle = INDICATOR_COLORS.AOE;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = INDICATOR_COLORS.AOE_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw cone indicator.
   */
  private drawCone(
    ctx: CanvasRenderingContext2D,
    origin: Vector,
    range: number,
    coneAngle: number,
    direction: Vector
  ): void {
    ctx.save();

    const baseAngle = Math.atan2(direction.y, direction.x);
    const halfAngle = coneAngle / 2;

    // Draw cone
    ctx.fillStyle = INDICATOR_COLORS.CONE;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, range, baseAngle - halfAngle, baseAngle + halfAngle);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = INDICATOR_COLORS.CONE_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw skillshot line indicator.
   */
  private drawSkillshotLine(
    ctx: CanvasRenderingContext2D,
    origin: Vector,
    direction: Vector,
    range: number,
    width: number
  ): void {
    ctx.save();

    const angle = Math.atan2(direction.y, direction.x);
    const halfWidth = width / 2;

    // Calculate rectangle corners
    const perpX = -Math.sin(angle) * halfWidth;
    const perpY = Math.cos(angle) * halfWidth;
    const endX = origin.x + direction.x * range;
    const endY = origin.y + direction.y * range;

    // Draw rectangle path
    ctx.fillStyle = INDICATOR_COLORS.SKILLSHOT;
    ctx.beginPath();
    ctx.moveTo(origin.x + perpX, origin.y + perpY);
    ctx.lineTo(endX + perpX, endY + perpY);
    ctx.lineTo(endX - perpX, endY - perpY);
    ctx.lineTo(origin.x - perpX, origin.y - perpY);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = INDICATOR_COLORS.SKILLSHOT_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw circle at the end to show projectile impact area
    ctx.fillStyle = INDICATOR_COLORS.AOE;
    ctx.beginPath();
    ctx.arc(endX, endY, halfWidth, 0, Math.PI * 2);
    ctx.fill();

    // Circle border
    ctx.strokeStyle = INDICATOR_COLORS.AOE_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

export default AbilityRangeIndicator;
