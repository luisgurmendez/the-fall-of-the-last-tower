/**
 * AbilityProjectile - A projectile spawned by abilities.
 *
 * Projectiles:
 * - Travel in a direction at a set speed
 * - Use spatial hashing to detect hits efficiently
 * - Apply effects to units they hit
 * - Can pierce through or stop on first hit
 * - Have a time-to-live (TTL)
 *
 * @example
 * // Create a fireball projectile
 * const fireball = new AbilityProjectile(
 *   caster.getPosition(),
 *   targetDirection,
 *   caster,
 *   {
 *     speed: 800,
 *     ttl: 2,
 *     radius: 20,
 *     piercing: false,
 *     filter: { side: caster.getSide(), unitTypes: ['champion', 'troop'] },
 *     effects: [new ScalingDamageEffect({ base: [80, 120, 160, 200, 240] }, 'magic')],
 *   }
 * );
 * gameContext.objects.push(fireball);
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Circle, Shape } from '@/objects/shapes';
import BaseObject from '@/objects/baseObject';
import { PhysicableMixin } from '@/mixins/physics';
import { CollisionableMixin } from '@/mixins/collisionable';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import RenderElement from '@/render/renderElement';
import { IGameUnit, isGameUnit } from '@/units/types';
import { Champion } from '@/champions/Champion';
import { EffectApplicationContext } from '@/effects/EffectDescriptor';
import { ProjectileConfig, HitResult } from './types';

/**
 * Base class with physics and collision.
 */
const BaseProjectile = PhysicableMixin(
  CollisionableMixin<Circle>()(BaseObject)
);

/**
 * An ability projectile that travels and applies effects on hit.
 */
export class AbilityProjectile extends BaseProjectile implements Disposable, Renderable, Stepable {
  // ===================
  // Disposable
  // ===================

  shouldDispose: boolean = false;
  dispose?: () => void;

  // ===================
  // Projectile State
  // ===================

  /** The unit that spawned this projectile */
  protected readonly caster: IGameUnit;

  /** Projectile configuration */
  protected readonly config: ProjectileConfig;

  /** Time remaining before auto-dispose */
  protected ttl: number;

  /** Units already hit (for piercing) */
  protected hitTargets: Set<string> = new Set();

  /** Hit results for tracking */
  protected hits: HitResult[] = [];

  /** Ability rank for scaling effects */
  protected abilityRank: number = 1;

  // ===================
  // Constructor
  // ===================

  constructor(
    position: Vector,
    direction: Vector,
    caster: IGameUnit,
    config: ProjectileConfig,
    abilityRank: number = 1
  ) {
    super(position);

    this.caster = caster;
    this.config = config;
    this.abilityRank = abilityRank;
    this.ttl = config.ttl;

    // Set up physics
    this.direction = direction.clone().normalize();
    this.velocity = this.direction.clone().scalar(config.speed);
    this.acceleration = new Vector(0, 0);
    this.friction = 1; // No friction - constant speed
    this.maxSpeed = config.speed;

    // Set up collision
    this.collisionMask = new Circle(config.radius);
  }

  // ===================
  // Stepable
  // ===================

  step(gctx: GameContext): void {
    if (this.shouldDispose) return;

    const { dt, spatialHashing } = gctx;

    // Update TTL
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.shouldDispose = true;
      return;
    }

    // Query for potential targets using spatial hashing
    const nearbyObjects = spatialHashing.queryInRange(
      this.position,
      this.config.radius + 50 // Add buffer for moving objects
    );

    // Check for hits
    for (const obj of nearbyObjects) {
      if (this.shouldDispose) break;
      this.checkHit(obj, gctx);
    }

    // Update position
    this.position = this.calculatePosition(dt);
  }

  // ===================
  // Hit Detection
  // ===================

  protected checkHit(obj: unknown, gctx: GameContext): void {
    // Must be a game unit
    if (!isGameUnit(obj)) return;

    const target = obj as IGameUnit;

    // Skip dead targets
    if (target.isDead()) return;

    // Skip self
    if (target.id === this.caster.id) return;

    // Check side filter (hit enemies only)
    if (target.getSide() === this.config.filter.side) return;

    // Check unit type filter
    if (this.config.filter.unitTypes) {
      if (!this.config.filter.unitTypes.includes(target.unitType)) return;
    }

    // Check if already hit this target
    if (this.hitTargets.has(target.id)) {
      if (!this.config.filter.canHitSameTarget) return;
    }

    // Distance check
    const distance = this.position.distanceTo(target.getPosition());
    const hitRadius = this.config.radius + 20; // Target size buffer

    if (distance > hitRadius) return;

    // It's a hit!
    this.onHit(target, gctx);
  }

  protected onHit(target: IGameUnit, gctx: GameContext): void {
    // Record the hit
    this.hitTargets.add(target.id);
    this.hits.push({
      target,
      position: this.position.clone(),
      timestamp: performance.now(),
    });

    // Apply effects
    this.applyEffects(target, gctx);

    // Check max targets
    if (this.config.filter.maxTargets) {
      if (this.hits.length >= this.config.filter.maxTargets) {
        this.shouldDispose = true;
        return;
      }
    }

    // Non-piercing projectiles stop on first hit
    if (!this.config.piercing) {
      this.shouldDispose = true;
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

      // Draw projectile as a line/circle based on config
      const width = this.config.width ?? 6;
      const color = this.config.color ?? '#ff6600';

      // Draw trail
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';

      const trailLength = Math.min(this.config.speed * 0.05, 30);
      const trailEnd = this.position.clone().sub(
        this.direction.clone().scalar(trailLength)
      );

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
    }, true);
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
}

export default AbilityProjectile;
