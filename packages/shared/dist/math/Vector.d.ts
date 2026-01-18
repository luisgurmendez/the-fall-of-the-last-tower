/**
 * 2D Vector class for game math operations.
 * Shared between client and server.
 */
export declare class Vector {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    clone(): Vector;
    distanceTo(v: Vector): number;
    distanceToSq(v: Vector): number;
    lengthSq(): number;
    length(): number;
    normalize(): this;
    normalized(): Vector;
    scalar(n: number): this;
    scaled(n: number): Vector;
    add(v: Vector): this;
    added(v: Vector): Vector;
    sub(v: Vector): this;
    subtracted(v: Vector): Vector;
    set(x: number, y: number): this;
    setFrom(v: Vector): this;
    angleTo(v: Vector): number;
    angle(): number;
    dot(v: Vector): number;
    cross(v: Vector): number;
    rotate(angle: number, inDegree?: boolean): this;
    rotated(angle: number, inDegree?: boolean): Vector;
    lerp(v: Vector, t: number): this;
    lerped(v: Vector, t: number): Vector;
    equals(v: Vector, epsilon?: number): boolean;
    isZero(epsilon?: number): boolean;
    toArray(): [number, number];
    toString(): string;
    /**
     * Create a vector from an angle (in radians).
     */
    static fromAngle(angle: number): Vector;
    /**
     * Create a vector pointing from one point to another.
     */
    static direction(from: Vector, to: Vector): Vector;
    /**
     * Linear interpolation between two vectors.
     */
    static lerp(a: Vector, b: Vector, t: number): Vector;
    /**
     * Get the distance between two vectors.
     */
    static distance(a: Vector, b: Vector): number;
    /**
     * Create a zero vector.
     */
    static zero(): Vector;
    /**
     * Create a unit vector pointing up (negative Y in screen coordinates).
     */
    static up(): Vector;
    /**
     * Create a unit vector pointing down.
     */
    static down(): Vector;
    /**
     * Create a unit vector pointing left.
     */
    static left(): Vector;
    /**
     * Create a unit vector pointing right.
     */
    static right(): Vector;
}
export default Vector;
//# sourceMappingURL=Vector.d.ts.map