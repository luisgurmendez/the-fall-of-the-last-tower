/**
 * TargetedProjectile - A homing projectile for ranged basic attacks.
 *
 * Unlike AbilityProjectile (skillshots), targeted projectiles:
 * - Home toward a specific target (can't be dodged)
 * - Deal damage when they arrive, not on collision
 * - Fizzle if the target dies or becomes untargetable
 *
 * @example
 * // Ranged basic attack projectile
 * const arrow = new TargetedProjectile(
 *   caster.getPosition(),
 *   target,
 *   caster,
 *   {
 *     speed: 1500,
 *     damage: 50,
 *     damageType: 'physical',
 *     width: 4,
 *     color: '#FFD700',
 *   }
 * );
 * gameContext.objects.push(arrow);
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import BaseObject from '@/objects/baseObject';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import RenderElement from '@/render/renderElement';
import { Champion } from '@/champions/Champion';

/**
 * Configuration for a targeted projectile.
 */
export interface TargetedProjectileConfig {
  /** Projectile speed in units per second */
  speed: number;
  /** Damage to deal on hit */
  damage: number;
  /** Damage type */
  damageType: 'physical' | 'magic' | 'true';
  /** Callback when projectile hits */
  onHit?: (target: Champion, damage: number) => void;
  /** Source of damage for logging */
  damageSource?: string;
}

/**
 * A homing projectile that tracks and hits a specific target.
 */
export class TargetedProjectile extends BaseObject implements Disposable, Renderable, Stepable {
  // Disposable
  shouldDispose: boolean = false;
  dispose?: () => void;

  // Projectile state
  private readonly caster: Champion;
  private readonly target: Champion;
  protected readonly config: TargetedProjectileConfig;
  protected direction: Vector;

  // Safety TTL to prevent infinite projectiles
  private ttl: number = 5;

  constructor(
    position: Vector,
    target: Champion,
    caster: Champion,
    config: TargetedProjectileConfig
  ) {
    super(position);

    this.target = target;
    this.caster = caster;
    this.config = config;

    // Initial direction toward target
    this.direction = target.getPosition().clone().sub(position).normalize();
  }

  /**
   * Update projectile each frame.
   */
  step(gctx: GameContext): void {
    if (this.shouldDispose) return;

    const dt = gctx.dt;

    // Safety TTL
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.shouldDispose = true;
      return;
    }

    // Check if target is still valid
    if (this.target.isDead()) {
      // Target died - fizzle
      this.shouldDispose = true;
      return;
    }

    // Update direction to home toward target
    const targetPos = this.target.getPosition();
    this.direction = targetPos.clone().sub(this.position).normalize();

    // Move toward target
    const moveDistance = this.config.speed * dt;
    const distanceToTarget = this.position.distanceTo(targetPos);

    if (moveDistance >= distanceToTarget) {
      // We've arrived - deal damage!
      this.onArrival();
    } else {
      // Keep moving
      this.position = this.position.clone().add(
        this.direction.clone().scalar(moveDistance)
      );
    }
  }

  /**
   * Called when projectile reaches the target.
   */
  private onArrival(): void {
    this.shouldDispose = true;

    // Don't damage dead targets
    if (this.target.isDead()) return;

    // Deal damage
    const damageSource = this.config.damageSource ?? 'Basic Attack';
    this.target.takeDamage(
      this.config.damage,
      this.config.damageType,
      this.caster,
      damageSource
    );

    // Trigger callback (handles on-hit effects like lifesteal)
    this.config.onHit?.(this.target, this.config.damage);
  }

  /**
   * Render the projectile.
   * Override this method in subclasses to provide custom projectile visuals.
   */
  render(): RenderElement {
    return new RenderElement((gctx) => {
      this.renderProjectile(gctx.canvasRenderingContext);
    }, true);
  }

  /**
   * Render the projectile visuals.
   * Override this method in subclasses to provide custom rendering.
   * Default implementation draws a simple golden trail.
   */
  protected renderProjectile(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const width = 4;
    const color = '#FFD700';

    // Draw trail
    const trailLength = Math.min(this.config.speed * 0.03, 20);
    const trailEnd = this.position.clone().sub(
      this.direction.clone().scalar(trailLength)
    );

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trailEnd.x, trailEnd.y);
    ctx.lineTo(this.position.x, this.position.y);
    ctx.stroke();

    // Draw head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, width / 2 + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Get the target of this projectile.
   */
  getTarget(): Champion {
    return this.target;
  }

  /**
   * Get the caster of this projectile.
   */
  getCaster(): Champion {
    return this.caster;
  }
}

export default TargetedProjectile;
