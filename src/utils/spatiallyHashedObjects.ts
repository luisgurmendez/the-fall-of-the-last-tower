import BaseObject from "@/objects/baseObject";
import Vector from "@/physics/vector";

class SpatiallyHashedObjects {
    private cellSize: number;
    private table: Map<string, BaseObject[]> = new Map();

    constructor(cellSize: number) {
        this.cellSize = cellSize;
    }

    private hash(p: Vector,): string {
        const cellX = Math.floor(p.x / this.cellSize);
        const cellY = Math.floor(p.y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    insert(obj: BaseObject): void {
        const hashKey = this.hash(obj.position);
        if (!this.table.has(hashKey)) {
            this.table.set(hashKey, []);
        }
        this.table.get(hashKey)!.push(obj);
    }

    query(p: Vector): BaseObject[] {
        const hashKey = this.hash(p);
        return this.table.get(hashKey) || [];
    }

    /// looks for objects in a radius of the given point
    queryInRange(p: Vector, radius: number): BaseObject[] {
        const objectsInRadius: BaseObject[] = [];
        for (let x = p.x - radius; x < p.x + radius; x += this.cellSize) {
            for (let y = p.y - radius; y < p.y + radius; y += this.cellSize) {
                const key = this.hash(new Vector(x, y));
                if (this.table.has(key)) {
                    objectsInRadius.push(...this.table.get(key)!);
                }
            }
        }
        return objectsInRadius;
    }

}

export default SpatiallyHashedObjects;