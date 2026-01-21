/**
 * Ward - A placeable vision object that reveals fog of war.
 *
 * Wards:
 * - Reveal an area for a team
 * - Can be destroyed by enemies (if visible)
 * - Expire after a duration (or persist until destroyed)
 * - Implement FogRevealer to integrate with fog of war system
 */

import Vector from '@/physics/vector';
import { TeamId, TEAM } from '@/core/Team';
import { FogRevealer } from '@/core/FogOfWar';
import { WardDefinition, WardType, WARD_DEFINITIONS } from './types';
import GameContext from '@/core/gameContext';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import RenderElement from '@/render/renderElement';
import RandomUtils from '@/utils/random';
import { Circle, Shape } from '@/objects/shapes';
import Attackable, { AttackDamageType } from '@/behaviors/attackable';

/**
 * Ward game object.
 */
export class Ward implements FogRevealer, Disposable, Renderable, Stepable, Attackable {
  // ===================
  // Identity
  // ===================

  readonly id: string;
  readonly wardType: WardType;

  // ===================
  // Position
  // ===================

  position: Vector;
  collisionMask: Shape;

  // ===================
  // State
  // ===================

  private definition: WardDefinition;
  private teamId: TeamId;
  private health: number;
  private maxHealth: number;
  private remainingDuration: number;
  private isRevealed: boolean = false;

  // ===================
  // Disposable
  // ===================

  shouldDispose: boolean = false;
  shouldInitialize: boolean = true;

  // ===================
  // Constructor
  // ===================

  constructor(position: Vector, teamId: TeamId, wardType: WardType = 'stealth') {
    this.id = `ward_${RandomUtils.generateId()}`;
    this.position = position.clone();
    this.teamId = teamId;
    this.wardType = wardType;

    this.definition = WARD_DEFINITIONS[wardType];
    this.health = this.definition.health;
    this.maxHealth = this.definition.health;
    this.remainingDuration = this.definition.duration;

    // Small collision mask for targeting
    this.collisionMask = new Circle(this.definition.renderSize);
  }

  // ===================
  // FogRevealer Implementation
  // ===================

  getPosition(): Vector {
    return this.position.clone();
  }

  getTeamId(): TeamId {
    return this.teamId;
  }

  getSightRange(): number {
    return this.definition.sightRange;
  }

  // ===================
  // Attackable Implementation
  // ===================

  takeDamage(damage: number, _type: AttackDamageType): void {
    // Wards take 1 damage per hit regardless of actual damage or type
    this.health -= 1;

    if (this.health <= 0) {
      this.shouldDispose = true;
    }
  }

  // ===================
  // Stepable Implementation
  // ===================

  step(gctx: GameContext): void {
    // Update duration for non-permanent wards
    if (this.definition.duration > 0) {
      this.remainingDuration -= gctx.dt;

      if (this.remainingDuration <= 0) {
        this.shouldDispose = true;
        return;
      }
    }

    // Check if revealed by enemy control ward
    this.updateRevealedStatus(gctx);
  }

  /**
   * Check if this ward is revealed by an enemy control ward.
   */
  private updateRevealedStatus(gctx: GameContext): void {
    if (!this.definition.isStealthed) {
      // Non-stealthed wards are always revealed
      this.isRevealed = true;
      return;
    }

    // Check for nearby enemy control wards
    this.isRevealed = false;
    for (const obj of gctx.objects) {
      if (obj instanceof Ward && obj !== this) {
        // Check if it's an enemy control ward that reveals wards
        if (obj.teamId !== this.teamId && obj.definition.revealsWards) {
          const distance = this.position.distanceTo(obj.position);
          if (distance <= obj.definition.sightRange) {
            this.isRevealed = true;
            break;
          }
        }
      }
    }
  }

  // ===================
  // Renderable Implementation
  // ===================

  render(): RenderElement {
    return new RenderElement((gctx) => {
      const { canvasRenderingContext: ctx, fogOfWar } = gctx;

      // Determine visibility
      const isPlayerTeam = this.teamId === TEAM.PLAYER;
      const canSee = isPlayerTeam || this.isRevealed;

      // Check if in fog for enemy wards
      if (!isPlayerTeam && fogOfWar) {
        const visibility = fogOfWar.getVisibility(TEAM.PLAYER, this.position);
        if (visibility !== 'visible') {
          return; // Don't render if in fog
        }
      }

      if (!canSee) return;

      ctx.save();

      // Draw ward base
      const size = this.definition.renderSize;
      const alpha = this.definition.isStealthed && !isPlayerTeam ? 0.5 : 1.0;

      // Outer glow for own wards
      if (isPlayerTeam) {
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, size + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${this.definition.color}33`;
        ctx.fill();
      }

      // Main ward body
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this.definition.color;
      ctx.globalAlpha = alpha;
      ctx.fill();

      // Border
      ctx.strokeStyle = isPlayerTeam ? '#FFFFFF' : '#FF0000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Health pips for player wards
      if (isPlayerTeam && this.maxHealth > 1) {
        this.renderHealthPips(ctx, size);
      }

      // Duration indicator for player wards
      if (isPlayerTeam && this.definition.duration > 0) {
        this.renderDurationBar(ctx, size);
      }

      ctx.restore();
    }, true);
  }

  /**
   * Render health pips below the ward.
   */
  private renderHealthPips(ctx: CanvasRenderingContext2D, size: number): void {
    const pipSize = 4;
    const pipSpacing = 3;
    const totalWidth = this.maxHealth * pipSize + (this.maxHealth - 1) * pipSpacing;
    const startX = this.position.x - totalWidth / 2;
    const y = this.position.y + size + 6;

    for (let i = 0; i < this.maxHealth; i++) {
      const x = startX + i * (pipSize + pipSpacing);
      ctx.beginPath();
      ctx.arc(x + pipSize / 2, y, pipSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = i < this.health ? '#00FF00' : '#333333';
      ctx.fill();
    }
  }

  /**
   * Render duration bar above the ward.
   */
  private renderDurationBar(ctx: CanvasRenderingContext2D, size: number): void {
    const barWidth = size * 2;
    const barHeight = 3;
    const x = this.position.x - barWidth / 2;
    const y = this.position.y - size - 8;

    const progress = this.remainingDuration / this.definition.duration;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Progress
    ctx.fillStyle = progress > 0.25 ? '#00FF00' : '#FF0000';
    ctx.fillRect(x, y, barWidth * progress, barHeight);
  }

  // ===================
  // Utility Methods
  // ===================

  /**
   * Check if the ward is visible to a specific team.
   */
  isVisibleTo(teamId: TeamId): boolean {
    if (this.teamId === teamId) return true;
    if (!this.definition.isStealthed) return true;
    return this.isRevealed;
  }

  /**
   * Get remaining duration in seconds.
   */
  getRemainingDuration(): number {
    return this.remainingDuration;
  }

  /**
   * Check if the ward is permanent (duration = 0).
   */
  isPermanent(): boolean {
    return this.definition.duration === 0;
  }

  /**
   * Check if this ward reveals enemy wards.
   */
  revealsEnemyWards(): boolean {
    return this.definition.revealsWards;
  }

  /**
   * Get the ward definition.
   */
  getDefinition(): WardDefinition {
    return this.definition;
  }
}

export default Ward;
