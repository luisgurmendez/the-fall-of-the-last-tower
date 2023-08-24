import { Rectangle, Circle } from "../objects/shapes";
import { Collisionable, isCollisionableObject } from "../mixins/collisionable";
import { Positionable } from "../mixins/positional";
import BaseObject from "../objects/baseObject";
import Intersections from "../utils/intersections";

export type CollisionableObject = Collisionable & Positionable & BaseObject

export interface Collisions {
  [objectId: string]: Collisionable[];
}

class CollisionsController {

  // TODO: optimize? quadtrees?
  getCollisions(objects: CollisionableObject[]): Collisions {
    const collisions: Collisions = {};

    for (let i = 0; i < objects.length; i++) {
      const primaryObj = objects[i];
      if (isCollisionableObject(primaryObj)) {
        for (let j = 0; j < objects.length; j++) {
          const secondaryObj = objects[j];
          if (primaryObj !== secondaryObj && isCollisionableObject(secondaryObj)) {
            const areObjectsColliding = this.calculateCollision(primaryObj, secondaryObj);
            if (areObjectsColliding) {
              if (collisions[primaryObj.id] === undefined) {
                collisions[primaryObj.id] = [secondaryObj];
              } else {
                collisions[primaryObj.id].push(secondaryObj);
              }
            }

          }
        }
      }
      primaryObj.setCollisions(collisions[primaryObj.id]); // injects the collisions into the obj.
    }
    return collisions;
  }

  // Checks if 2 objects are colliding
  private calculateCollision(a: CollisionableObject, b: CollisionableObject): boolean {

    if (a.collisionMask instanceof Circle) {
      if (b.collisionMask instanceof Circle) {
        return Intersections.isCircleIntersectingCircle(a.collisionMask, b.collisionMask, a.position, b.position);
      }

      if (b.collisionMask instanceof Rectangle) {
        return Intersections.isRectangleIntersectingCircle(b.collisionMask, a.collisionMask, b.position, a.position,);
      }
    }

    if (a.collisionMask instanceof Rectangle) {
      if (b.collisionMask instanceof Circle) {
        return Intersections.isRectangleIntersectingCircle(a.collisionMask, b.collisionMask, a.position, b.position);
      }

      if (b.collisionMask instanceof Rectangle) {
        return Intersections.isRectangleIntersectingRectangle(b.collisionMask, a.collisionMask, b.position, a.position);
      }
    }

    return false;
  }

}

export default CollisionsController;
