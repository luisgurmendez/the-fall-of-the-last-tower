import GameContext from "../core/gameContext";
import BaseObject from "../objects/baseObject";
import Vector from "../physics/vector";
import { Gravitationable, isGravitationable } from "./gravitational";
import { PhysicableConstructor, Physicable } from "./physics";
import { GConstructor } from "./shared";

interface AffectedByGravitationable extends Physicable {
  calculateGravitationalAcceleration: (context: GameContext) => Vector;
}

export type AffectedByGravitationalConstructor = GConstructor<AffectedByGravitationable>

export function AffectedByGravitationableMixin<TBase extends PhysicableConstructor & GConstructor<BaseObject>>(Base: TBase): AffectedByGravitationalConstructor & TBase {
  return class M extends Base implements AffectedByGravitationable {

    calculateGravitationalAcceleration(context: GameContext) {
      const gravitationals = context.objects.filter(obj => isGravitationable(obj) && obj.id !== this.id) as (BaseObject & Gravitationable)[];
      const acceleration = new Vector();
      gravitationals.forEach(obj => {
        const accByPlanet = this.calculateAccelerationByPlanet(obj);
        acceleration.add(accByPlanet)
      });

      return acceleration;
    };

    private calculateAccelerationByPlanet(obj: Gravitationable) {
      const distanceToPlanet = this.position.distanceTo(obj.position)
      if (distanceToPlanet < obj.gravitationalThreshold) {
        const directionalVectorToPlanet = new Vector(obj.position.x - this.position.x, obj.position.y - this.position.y).normalize();
        // TODO: review this formula below
        directionalVectorToPlanet.scalar(obj.gravitationalForce / distanceToPlanet);
        return directionalVectorToPlanet;
      }

      return new Vector();
    }
  }
}


