/**
 * AbilityTargetingUI - Renders ability targeting indicators.
 *
 * Shows:
 * - Range circles for abilities
 * - Direction lines for skillshots
 * - AoE preview circles for ground-targeted abilities
 * - Valid/invalid targeting visual feedback
 */

import Vector from '@/physics/vector';
import type { Champion } from '@/champions/Champion';
import type { AbilityTargetingState } from '@/core/input/AbilityInputManager';
import type {
  IAbilityTargetDescription,
  SkillshotAbilityTargetDescription,
  GroundTargetAbilityTargetDescription,
} from '@/abilities/AbilityTargetDescription';

/**
 * Colors for targeting UI.
 */
const COLORS = {
  rangeValid: 'rgba(100, 200, 255, 0.2)',
  rangeInvalid: 'rgba(255, 100, 100, 0.2)',
  rangeBorderValid: 'rgba(100, 200, 255, 0.6)',
  rangeBorderInvalid: 'rgba(255, 100, 100, 0.6)',
  skillshotLine: 'rgba(100, 200, 255, 0.8)',
  skillshotLineInvalid: 'rgba(255, 100, 100, 0.8)',
  skillshotWidth: 'rgba(100, 200, 255, 0.3)',
  aoePreview: 'rgba(255, 150, 50, 0.3)',
  aoeBorder: 'rgba(255, 150, 50, 0.8)',
  targetHighlight: 'rgba(255, 50, 50, 0.5)',
};

/**
 * Renders ability targeting indicators.
 */
export class AbilityTargetingUI {
  private targetingState: AbilityTargetingState | null = null;
  private champion: Champion | null = null;

  /**
   * Update the targeting state.
   */
  setTargetingState(state: AbilityTargetingState | null): void {
    this.targetingState = state;
  }

  /**
   * Set the champion reference.
   */
  setChampion(champion: Champion | null): void {
    this.champion = champion;
  }

  /**
   * Render targeting UI.
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.targetingState || !this.targetingState.slot || !this.champion) {
      return;
    }

    const targetDesc = this.targetingState.targetDescription;
    if (!targetDesc) return;

    const casterPos = this.champion.getPosition();
    const mousePos = this.targetingState.mouseWorldPosition;

    // Draw range circle
    if (targetDesc.range) {
      this.drawRangeCircle(ctx, casterPos, targetDesc.range, this.targetingState.isValidTarget);
    }

    // Draw skillshot indicator
    if (this.isSkillshot(targetDesc)) {
      this.drawSkillshotIndicator(ctx, casterPos, mousePos, targetDesc as SkillshotAbilityTargetDescription);
    }

    // Draw AoE preview
    if (this.isGroundTarget(targetDesc)) {
      this.drawAoEPreview(ctx, casterPos, mousePos, targetDesc as GroundTargetAbilityTargetDescription);
    }

    // Draw target highlight
    if (this.targetingState.hoveringValidTarget) {
      this.drawTargetHighlight(ctx, this.targetingState.hoveringValidTarget.getPosition());
    }
  }

  /**
   * Draw the range circle around the caster.
   */
  private drawRangeCircle(
    ctx: CanvasRenderingContext2D,
    center: Vector,
    range: number,
    isValid: boolean
  ): void {
    ctx.save();

    // Fill
    ctx.fillStyle = isValid ? COLORS.rangeValid : COLORS.rangeInvalid;
    ctx.beginPath();
    ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = isValid ? COLORS.rangeBorderValid : COLORS.rangeBorderInvalid;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw skillshot direction indicator.
   */
  private drawSkillshotIndicator(
    ctx: CanvasRenderingContext2D,
    casterPos: Vector,
    mousePos: Vector,
    targetDesc: SkillshotAbilityTargetDescription
  ): void {
    const direction = mousePos.clone().sub(casterPos).normalize();
    const endPoint = casterPos.clone().add(direction.clone().scalar(targetDesc.range));

    ctx.save();

    // Calculate perpendicular for width
    const perpendicular = new Vector(-direction.y, direction.x);
    const halfWidth = targetDesc.width / 2;

    // Draw skillshot width area
    ctx.fillStyle = COLORS.skillshotWidth;
    ctx.beginPath();

    const startLeft = casterPos.clone().add(perpendicular.clone().scalar(halfWidth));
    const startRight = casterPos.clone().add(perpendicular.clone().scalar(-halfWidth));
    const endLeft = endPoint.clone().add(perpendicular.clone().scalar(halfWidth));
    const endRight = endPoint.clone().add(perpendicular.clone().scalar(-halfWidth));

    ctx.moveTo(startLeft.x, startLeft.y);
    ctx.lineTo(endLeft.x, endLeft.y);
    ctx.lineTo(endRight.x, endRight.y);
    ctx.lineTo(startRight.x, startRight.y);
    ctx.closePath();
    ctx.fill();

    // Draw center line
    ctx.strokeStyle = COLORS.skillshotLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(casterPos.x, casterPos.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();

    // Draw arrowhead
    this.drawArrowhead(ctx, endPoint, direction);

    ctx.restore();
  }

  /**
   * Draw an arrowhead at the end of a line.
   */
  private drawArrowhead(
    ctx: CanvasRenderingContext2D,
    position: Vector,
    direction: Vector
  ): void {
    const arrowSize = 15;
    const angle = Math.atan2(direction.y, direction.x);

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(angle);

    ctx.fillStyle = COLORS.skillshotLine;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-arrowSize, -arrowSize / 2);
    ctx.lineTo(-arrowSize, arrowSize / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw AoE preview at target position.
   */
  private drawAoEPreview(
    ctx: CanvasRenderingContext2D,
    casterPos: Vector,
    mousePos: Vector,
    targetDesc: GroundTargetAbilityTargetDescription
  ): void {
    // Clamp mouse position to range
    const direction = mousePos.clone().sub(casterPos);
    const distance = direction.length();
    let targetPos = mousePos;

    if (distance > targetDesc.range) {
      targetPos = casterPos.clone().add(direction.normalize().scalar(targetDesc.range));
    }

    // Draw direction line
    ctx.save();
    ctx.strokeStyle = COLORS.skillshotLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(casterPos.x, casterPos.y);
    ctx.lineTo(targetPos.x, targetPos.y);
    ctx.stroke();

    // Draw AoE circle at target
    if (targetDesc.aoeRadius > 0) {
      ctx.fillStyle = COLORS.aoePreview;
      ctx.beginPath();
      ctx.arc(targetPos.x, targetPos.y, targetDesc.aoeRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = COLORS.aoeBorder;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    } else {
      // Draw a small indicator at the target position
      ctx.fillStyle = COLORS.aoeBorder;
      ctx.beginPath();
      ctx.arc(targetPos.x, targetPos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw target highlight around a unit.
   */
  private drawTargetHighlight(ctx: CanvasRenderingContext2D, position: Vector): void {
    ctx.save();

    // Pulsing effect
    const time = performance.now() / 200;
    const pulse = 1 + 0.1 * Math.sin(time);
    const radius = 35 * pulse;

    // Outer glow
    ctx.fillStyle = COLORS.targetHighlight;
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(position.x, position.y, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Type guard for skillshot abilities.
   */
  private isSkillshot(targetDesc: IAbilityTargetDescription): targetDesc is SkillshotAbilityTargetDescription {
    return 'width' in targetDesc && targetDesc.targetsGround && !('aoeRadius' in targetDesc);
  }

  /**
   * Type guard for ground target abilities.
   */
  private isGroundTarget(targetDesc: IAbilityTargetDescription): targetDesc is GroundTargetAbilityTargetDescription {
    return 'aoeRadius' in targetDesc;
  }
}

export default AbilityTargetingUI;
