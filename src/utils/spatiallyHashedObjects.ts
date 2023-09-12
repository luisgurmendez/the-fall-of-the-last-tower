import { isCollisionableObject } from "@/mixins/collisionable";
import BaseObject from "@/objects/baseObject";
import Vector from "@/physics/vector";

class SpatiallyHashedObjects {
    private cellSize: number;
    /// table of objects in which the objects exist in a cell with center x,y
    private table: Map<string, Set<BaseObject>> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    private hash = (p: Vector,): string => {
        const cellX = Math.floor(p.x / this.cellSize);
        const cellY = Math.floor(p.y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    insert = (obj: BaseObject): void => {
        if (isCollisionableObject(obj)) {
            const upperLeft = obj.position.clone().add(new Vector(-obj.collisionMask.maxDistanceToCenter, -obj.collisionMask.maxDistanceToCenter));
            const lowerRight = obj.position.clone().add(new Vector(obj.collisionMask.maxDistanceToCenter, obj.collisionMask.maxDistanceToCenter));

            /// fills all the cells in between bounds
            for (let x = upperLeft.x; x <= lowerRight.x; x += this.cellSize / 2) {
                for (let y = upperLeft.y; y <= lowerRight.y; y += this.cellSize / 2) {
                    const hashKey = this.hash(new Vector(x, y))
                    if (!this.table.has(hashKey)) {
                        this.table.set(hashKey, new Set());
                    }
                    this.table.get(hashKey)!.add(obj);
                }
            }
        }
    }

    query = (p: Vector): BaseObject[] => {
        const hashKey = this.hash(p);
        return this.table.get(hashKey)?.size ? Array.from(this.table.get(hashKey)!) : [];
    }

    /// looks for objects in a radius of the given point
    queryInRange = (p: Vector, radius: number): BaseObject[] => {
        const objectsInRadius = new Set<BaseObject>();
        for (let x = p.x - radius; x < p.x + radius; x += this.cellSize) {
            for (let y = p.y - radius; y < p.y + radius; y += this.cellSize) {
                const key = this.hash(new Vector(x, y));
                if (this.table.has(key)) {
                    this.table.get(key)!.forEach(objectsInRadius.add, objectsInRadius)
                }
            }
        }
        return Array.from(objectsInRadius);
    }

}

export default SpatiallyHashedObjects;