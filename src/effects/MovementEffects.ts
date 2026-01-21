/**
 * Movement-related effects like dashes, teleports, knockbacks.
 */

import type Vector from '@/physics/vector';
import { IEffect, EffectApplicationContext } from './EffectDescriptor';

/**
 * Instantly move the caster to the target's position.
 *
 * Uses context.targetPosition (preserved from original ability cast) rather than
 * context.target.getPosition(), since EffectTargetType.self overwrites the target
 * field with the caster.
 */
export class ToTargetMoveEffect implements IEffect {
  readonly offsetFromTarget: number;

  constructor(offsetFromTarget: number = 50) {
    this.offsetFromTarget = offsetFromTarget;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, targetPosition } = context;

    // Use targetPosition from context - this is preserved even when
    // EffectTargetType.self overwrites the target field
    if (!targetPosition) return;

    const casterPos = caster.getPosition();

    // Calculate direction from target position to caster
    const direction = casterPos.clone().sub(targetPosition).normalize();

    // Move caster to position near target
    const newPos = targetPosition.clone().add(direction.scalar(this.offsetFromTarget));
    caster.setPosition(newPos);
  }

  clone(): IEffect {
    return new ToTargetMoveEffect(this.offsetFromTarget);
  }
}

/**
 * Dash in a direction.
 */
export class DashEffect implements IEffect {
  readonly distance: number;
  readonly speed: number;

  constructor(distance: number, speed: number = 1000) {
    this.distance = distance;
    this.speed = speed;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;

    // Determine dash direction
    let direction: Vector;
    if (target) {
      direction = target.getPosition().clone().sub(caster.getPosition()).normalize();
    } else {
      direction = caster.getDirection();
    }

    // Start dash (the champion will need to handle the actual movement)
    caster.startDash(direction, this.distance, this.speed);
  }

  clone(): IEffect {
    return new DashEffect(this.distance, this.speed);
  }
}

/**
 * Knockback the target away from caster.
 */
export class KnockbackEffect implements IEffect {
  readonly distance: number;
  readonly duration: number;

  constructor(distance: number, duration: number = 0.3) {
    this.distance = distance;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;
    if (!target) return;

    const direction = target.getPosition().clone().sub(caster.getPosition()).normalize();
    target.applyKnockback(direction, this.distance, this.duration);
  }

  clone(): IEffect {
    return new KnockbackEffect(this.distance, this.duration);
  }
}

/**
 * Pull the target towards the caster.
 */
export class PullEffect implements IEffect {
  readonly distance: number;
  readonly duration: number;

  constructor(distance: number, duration: number = 0.3) {
    this.distance = distance;
    this.duration = duration;
  }

  apply(context: EffectApplicationContext): void {
    const { caster, target } = context;
    if (!target) return;

    const direction = caster.getPosition().clone().sub(target.getPosition()).normalize();
    target.applyKnockback(direction, this.distance, this.duration);
  }

  clone(): IEffect {
    return new PullEffect(this.distance, this.duration);
  }
}
