/**
 * AreaOfEffect - A zone that applies effects to units inside it.
 *
 * Areas can be:
 * - Instant (one-shot damage)
 * - Persistent (damage over time zone)
 * - Following the caster (aura)
 *
 * Shapes supported:
 * - Circle (radius)
 * - Rectangle (width x height)
 * - Cone (direction + angle)
 *
 * @example
 * // Create an explosion
 * const explosion = new AreaOfEffect(
 *   targetPosition,
 *   direction,
 *   caster,
 *   {
 *     shape: 'circle',
 *     radius: 150,
 *     duration: 0, // Instant
 *     filter: { side: caster.getSide() },
 *     effects: [new ScalingDamageEffect({ base: [100, 150, 200, 250, 300] }, 'magic')],
 *     color: '#ff4400',
 *   }
 * );
 * gameContext.objects.push(explosion);
 *
 * @example
 * // Create a persistent damage zone
 * const fireZone = new AreaOfEffect(
 *   groundPosition,
 *   direction,
 *   caster,
 *   {
 *     shape: 'circle',
 *     radius: 100,
 *     duration: 5, // 5 seconds
 *     tickRate: 0.5, // Apply every 0.5s
 *     filter: { side: caster.getSide() },
 *     effects: [new DamageEffect(20, 'magic')],
 *     color: '#ff6600',
 *   }
 * );
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import BaseObject from '@/objects/baseObject';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import RenderElement from '@/render/renderElement';
import { IGameUnit, isGameUnit } from '@/units/types';
import { Champion } from '@/champions/Champion';
import { EffectApplicationContext } from '@/effects/EffectDescriptor';
import { AreaConfig, HitResult } from './types';

/**
 * An area of effect zone that applies effects to units inside.
 */
export class AreaOfEffect extends BaseObject implements Disposable, Renderable, Stepable {
  // ===================
  // Disposable
  // ===================

  shouldDispose: boolean = false;
  dispose?: () => void;

  // ===================
  // Area State
  // ===================

  /** The unit that created this area */
  protected readonly caster: IGameUnit;

  /** Direction the area faces (for cones/rectangles) */
  protected direction: Vector;

  /** Area configuration */
  protected readonly config: AreaConfig;

  /** Time remaining for persistent areas */
  protected duration: number;

  /** Time until next tick */
  protected tickTimer: number;

  /** Delay before first application */
  protected delay: number;

  /** Units hit by this area (for tracking) */
  protected hitTargets: Map<string, number> = new Map(); // id -> lastHitTime

  /** All hit results */
  protected hits: HitResult[] = [];

  /** Ability rank for scaling effects */
  protected abilityRank: number = 1;

  /** Visual fade for expiring areas */
  protected fadeAlpha: number = 1;

  // ===================
  // Constructor
  // ===================

  constructor(
    position: Vector,
    direction: Vector,
    caster: IGameUnit,
    config: AreaConfig,
    abilityRank: number = 1
  ) {
    super(position);

    this.caster = caster;
    this.direction = direction.clone().normalize();
    this.config = config;
    this.abilityRank = abilityRank;
    this.duration = config.duration;
    this.delay = config.delay ?? 0;
    this.tickTimer = 0;
  }

  // ===================
  // Stepable
  // ===================

  step(gctx: GameContext): void {
    if (this.shouldDispose) return;

    const { dt, spatialHashing } = gctx;

    // Handle delay
    if (this.delay > 0) {
      this.delay -= dt;
      return;
    }

    // Follow caster if configured
    if (this.config.followCaster && !this.caster.isDead()) {
      this.position = this.caster.getPosition();
      this.direction = this.caster.getDirection();
    }

    // Query for potential targets using spatial hashing
    const queryRadius = this.getQueryRadius();
    const nearbyObjects = spatialHashing.queryInRange(this.position, queryRadius);

    // Check for units in area
    const targetsInArea: IGameUnit[] = [];
    for (const obj of nearbyObjects) {
      const validTarget = this.getValidTarget(obj);
      if (validTarget) {
        targetsInArea.push(validTarget);
      }
    }

    // Apply effects based on duration type
    if (this.config.duration === 0) {
      // Instant: Apply once and dispose
      this.applyToTargets(targetsInArea, gctx);
      this.shouldDispose = true;
      return;
    }

    // Persistent: Apply on tick
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.applyToTargets(targetsInArea, gctx);
      this.tickTimer = this.config.tickRate ?? 0.5;
    }

    // Update duration
    this.duration -= dt;
    if (this.duration <= 0) {
      this.shouldDispose = true;
    }

    // Fade out near end
    if (this.duration < 0.5) {
      this.fadeAlpha = this.duration / 0.5;
    }
  }

  // ===================
  // Area Detection
  // ===================

  protected getQueryRadius(): number {
    // For cones and rectangles, use the larger dimension
    if (this.config.shape === 'rectangle' && this.config.height) {
      return Math.max(this.config.radius, this.config.height);
    }
    return this.config.radius;
  }

  /**
   * Get a valid target from an object, or null if not valid.
   */
  protected getValidTarget(obj: unknown): IGameUnit | null {
    // Must be a game unit
    if (!isGameUnit(obj)) return null;

    // TypeScript now knows obj is IGameUnit
    const target = obj;

    // Skip dead targets
    if (target.isDead()) return null;

    // Skip self (unless explicitly allowed)
    if (target.id === this.caster.id) return null;

    // Check side filter (hit enemies only)
    if (target.getSide() === this.config.filter.side) return null;

    // Check unit type filter
    if (this.config.filter.unitTypes) {
      if (!this.config.filter.unitTypes.includes(target.unitType)) return null;
    }

    // Check if in area based on shape
    const targetPos = target.getPosition();
    let inArea = false;

    switch (this.config.shape) {
      case 'circle':
        inArea = this.isInCircle(targetPos);
        break;
      case 'rectangle':
        inArea = this.isInRectangle(targetPos);
        break;
      case 'cone':
        inArea = this.isInCone(targetPos);
        break;
    }

    return inArea ? target : null;
  }

  protected isInCircle(targetPos: Vector): boolean {
    const distance = this.position.distanceTo(targetPos);
    return distance <= this.config.radius;
  }

  protected isInRectangle(targetPos: Vector): boolean {
    // Transform target position to local space (relative to area center)
    const local = targetPos.clone().sub(this.position);

    // Rotate by negative direction angle to align with axes
    const angle = Math.atan2(this.direction.y, this.direction.x);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rotatedX = local.x * cos - local.y * sin;
    const rotatedY = local.x * sin + local.y * cos;

    // Check against half-dimensions
    const halfWidth = this.config.radius;
    const halfHeight = this.config.height ?? this.config.radius;

    return Math.abs(rotatedX) <= halfWidth && Math.abs(rotatedY) <= halfHeight;
  }

  protected isInCone(targetPos: Vector): boolean {
    const toTarget = targetPos.clone().sub(this.position);
    const distance = toTarget.length();

    // Check range
    if (distance > this.config.radius) return false;

    // Check angle
    const coneAngle = this.config.coneAngle ?? Math.PI / 4; // Default 45 degrees
    const targetAngle = Math.atan2(toTarget.y, toTarget.x);
    const directionAngle = Math.atan2(this.direction.y, this.direction.x);

    let angleDiff = Math.abs(targetAngle - directionAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

    return angleDiff <= coneAngle / 2;
  }

  // ===================
  // Effect Application
  // ===================

  protected applyToTargets(targets: IGameUnit[], gctx: GameContext): void {
    const now = performance.now();

    for (const target of targets) {
      // Check max targets
      if (this.config.filter.maxTargets) {
        if (this.hits.length >= this.config.filter.maxTargets) break;
      }

      // Check if can hit same target again
      if (!this.config.filter.canHitSameTarget) {
        if (this.hitTargets.has(target.id)) continue;
      }

      // Record hit
      this.hitTargets.set(target.id, now);
      this.hits.push({
        target,
        position: target.getPosition(),
        timestamp: now,
      });

      // Apply effects
      this.applyEffects(target, gctx);
    }
  }

  protected applyEffects(target: IGameUnit, gctx: GameContext): void {
    // Build effect context
    const context: EffectApplicationContext = {
      caster: this.caster as Champion,
      target: target as Champion,
      affectedTargets: [target as Champion],
      gameContext: gctx,
      abilityRank: this.abilityRank,
    };

    // Apply all effects
    for (const effect of this.config.effects) {
      const clonedEffect = effect.clone();
      clonedEffect.apply(context);
    }
  }

  // ===================
  // Renderable
  // ===================

  render(): RenderElement {
    return new RenderElement((gctx) => {
      const { canvasRenderingContext: ctx } = gctx;

      ctx.save();
      ctx.globalAlpha = this.fadeAlpha * 0.3;

      const color = this.config.color ?? '#ff6600';

      switch (this.config.shape) {
        case 'circle':
          this.renderCircle(ctx, color);
          break;
        case 'rectangle':
          this.renderRectangle(ctx, color);
          break;
        case 'cone':
          this.renderCone(ctx, color);
          break;
      }

      ctx.restore();
    }, true);
  }

  protected renderCircle(ctx: CanvasRenderingContext2D, color: string): void {
    // Fill
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.config.radius, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = this.fadeAlpha * 0.8;
    ctx.stroke();
  }

  protected renderRectangle(ctx: CanvasRenderingContext2D, color: string): void {
    const halfWidth = this.config.radius;
    const halfHeight = this.config.height ?? this.config.radius;
    const angle = Math.atan2(this.direction.y, this.direction.x);

    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(angle);

    // Fill
    ctx.fillStyle = color;
    ctx.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = this.fadeAlpha * 0.8;
    ctx.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);

    ctx.restore();
  }

  protected renderCone(ctx: CanvasRenderingContext2D, color: string): void {
    const coneAngle = this.config.coneAngle ?? Math.PI / 4;
    const directionAngle = Math.atan2(this.direction.y, this.direction.x);
    const startAngle = directionAngle - coneAngle / 2;
    const endAngle = directionAngle + coneAngle / 2;

    // Fill
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(this.position.x, this.position.y);
    ctx.arc(this.position.x, this.position.y, this.config.radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = this.fadeAlpha * 0.8;
    ctx.stroke();
  }

  // ===================
  // Getters
  // ===================

  getHits(): HitResult[] {
    return [...this.hits];
  }

  getCaster(): IGameUnit {
    return this.caster;
  }

  getRemainingDuration(): number {
    return this.duration;
  }
}

export default AreaOfEffect;
