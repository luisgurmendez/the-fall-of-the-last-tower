
import Vector from "../physics/vector";
import { PositionableConstructor, Positionable } from "./positional";
import { GConstructor } from "./shared";

export interface Physicable extends Positionable {
  velocity: Vector;
  direction: Vector;
  acceleration: Vector;
  speed: number;
  angularAcceleration: number;
  angularVelocity: number;
  isMoving: () => boolean;

  calculateVelocity: (dt: number) => Vector;
  calculatePosition: (dt: number) => Vector;
  calculateAngularVelocity: (dt: number) => number;
  calculateDirection: (dt: number) => Vector;
}

export type PhysicableConstructor = GConstructor<Physicable>;

export function PhysicableMixin<TBase extends PositionableConstructor>(Base: TBase): PhysicableConstructor & TBase {
  return class M extends Base implements Physicable {
    velocity: Vector = new Vector();
    acceleration: Vector = new Vector();
    angularAcceleration: number = 0;
    angularVelocity: number = 0;
    direction: Vector = new Vector();

    get speed(): number {
      return this.velocity.length();
    }

    isMoving(): boolean {
      const speedThreshold = 0;
      return this.speed > speedThreshold;
    }

    // v = v0 + a*t
    calculateVelocity(dt: number) {
      const newVelocity = this.velocity.clone();
      const deltaVelocity = this.acceleration.clone().scalar(dt);
      newVelocity.add(deltaVelocity);
      return newVelocity;
    }

    // p = p0 + v0*dt + 1/2a*dt^2
    calculatePosition(dt: number) {
      const newPosition = this.position.clone();
      const deltaPositionByAcceleration = this.acceleration.clone().scalar(Math.pow(dt, 2) / 2);
      const deltaPosition = this.velocity.clone().scalar(dt).add(deltaPositionByAcceleration);
      newPosition.add(deltaPosition);
      return newPosition;
    }

    calculateAngularVelocity(dt: number) {
      const newVelocity = this.angularVelocity;
      const deltaVelocity = this.angularAcceleration * dt;
      return newVelocity + deltaVelocity;
    }

    calculateDirection(dt: number) {
      const newDirection = this.direction.clone();
      const deltaRotationAngle = this.angularVelocity * dt;
      newDirection.rotate(deltaRotationAngle);
      return newDirection;
    }
  };
}

