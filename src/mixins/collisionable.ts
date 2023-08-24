



import BaseObject from "objects/baseObject";
import { NullShape, Shape } from "../objects/shapes";
import { GConstructor } from "./shared";

export interface Collisionable<S extends Shape = Shape> extends BaseObject {
  collisionMask: S;
  isColliding: boolean;
  collisions: Collisionable[];
  setCollisions: (collisions: Collisionable[]) => void;
}

export type CollisionableConstructor<S extends Shape> = GConstructor<Collisionable<S>>;

// Double function so that we can have S specified explicitly in the first call, 
// and TBase is inferred from parameter value on the second call
export function CollisionableMixin<S extends Shape>() {
  return function <TBase extends GConstructor<BaseObject>>(Base: TBase): CollisionableConstructor<S> & TBase {
    return class M extends Base implements Collisionable<S> {
      collisionMask = new NullShape() as unknown as S;
      collisions: Collisionable[] = [];

      get isColliding() {
        return this.collisions !== undefined && this.collisions.length > 0
      }

      setCollisions(collisions: Collisionable[] | undefined) {
        this.collisions = collisions || [];
      }
    }
  }
}

export function isCollisionableObject(obj: any): obj is Collisionable {
  return typeof obj === 'object' && (obj as unknown as Collisionable).collisionMask !== undefined;
}
