import Vector from "@/physics/vector";
import { PositionableConstructor, Positionable } from "./positional";
import { GConstructor } from "./shared";

export interface Physicable extends Positionable {
  velocity: Vector;
  direction: Vector;
  acceleration: Vector;
  speed: number;
  angularAcceleration: number;
  angularVelocity: number;
  friction: number;
  isMoving: () => boolean;

  calculateVelocity: (dt: number) => Vector;
  calculatePosition: (dt: number) => Vector;
  calculateDirection: (dt: number) => Vector;
}

export type PhysicableConstructor = GConstructor<Physicable>;

// Your mixin with added friction and maxSpeed
export function PhysicableMixin<TBase extends PositionableConstructor>(
  Base: TBase
): PhysicableConstructor & TBase {
  return class M extends Base implements Physicable {
    velocity: Vector = new Vector();
    acceleration: Vector = new Vector();
    angularAcceleration = 0;
    angularVelocity = 0;
    direction: Vector = new Vector();
    friction = 0.8;
    maxSpeed = 300;

    get speed(): number {
      return this.velocity.length();
    }

    isMoving(): boolean {
      const speedThreshold = 1;
      return this.speed > speedThreshold;
    }

    calculateVelocity(dt: number) {
      const newVelocity = this.velocity.clone();
      const deltaVelocity = this.acceleration.clone().scalar(dt);
      newVelocity.add(deltaVelocity);

      // Apply friction
      newVelocity.scalar(this.friction);

      // Limit speed to maxSpeed
      if (newVelocity.length() > this.maxSpeed) {
        newVelocity.normalize().scalar(this.maxSpeed);
      }

      return newVelocity;
    }

    calculatePosition(dt: number) {
      const newPosition = this.position.clone();
      const deltaPositionByAcceleration = this.acceleration
        .clone()
        .scalar(0.5 * dt * dt);
      const deltaPosition = this.velocity
        .clone()
        .scalar(dt)
        .add(deltaPositionByAcceleration);
      newPosition.add(deltaPosition);
      return newPosition;
    }

    calculateDirection(dt: number) {
      const newDirection = this.direction.clone();
      const deltaRotationAngle = this.angularVelocity * dt;
      newDirection.rotate(deltaRotationAngle);
      return newDirection;
    }
  };
}

