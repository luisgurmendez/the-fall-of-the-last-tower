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
  calculateAngularVelocity: (dt: number) => number;
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
    friction = 0.993; // you can set this value to suit your needs
    maxSpeed = 100; // you can set this value to suit your needs

    get speed(): number {
      return this.velocity.length();
    }

    isMoving(): boolean {
      const speedThreshold = 0;
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

// export function PhysicableMixin<TBase extends PositionableConstructor>(
//   Base: TBase
// ): PhysicableConstructor & TBase {
//   return class M extends Base implements Physicable {
//     velocity: Vector = new Vector();
//     acceleration: Vector = new Vector();
//     angularAcceleration = 0;
//     angularVelocity = 0;
//     direction: Vector = new Vector();

//     get speed(): number {
//       return this.velocity.length();
//     }

//     isMoving(): boolean {
//       const speedThreshold = 0;
//       return this.speed > speedThreshold;
//     }

//     // v = v0 + a*t
//     calculateVelocity(dt: number) {
//       const newVelocity = this.velocity.clone();
//       const deltaVelocity = this.acceleration.clone().scalar(dt);
//       newVelocity.add(deltaVelocity);
//       return newVelocity;
//     }

//     // p = p0 + v0*dt + 1/2a*dt^2
//     calculatePosition(dt: number) {
//       const newPosition = this.position.clone();
//       const deltaPositionByAcceleration = this.acceleration
//         .clone()
//         .scalar(Math.pow(dt, 2) / 2);
//       const deltaPosition = this.velocity
//         .clone()
//         .scalar(dt)
//         .add(deltaPositionByAcceleration);
//       newPosition.add(deltaPosition);
//       return newPosition;
//     }

//     calculateAngularVelocity(dt: number) {
//       const newVelocity = this.angularVelocity;
//       const deltaVelocity = this.angularAcceleration * dt;
//       return newVelocity + deltaVelocity;
//     }

//     calculateDirection(dt: number) {
//       const newDirection = this.direction.clone();
//       const deltaRotationAngle = this.angularVelocity * dt;
//       newDirection.rotate(deltaRotationAngle);
//       return newDirection;
//     }
//   };
// }
