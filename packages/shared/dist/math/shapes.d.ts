/**
 * Geometric shape primitives for collision detection.
 * Shared between client and server.
 */
export type Shape = Rectangle | Circle | NullShape;
export declare class Rectangle {
    w: number;
    h: number;
    constructor(w: number, h: number);
    get width(): number;
    get height(): number;
    get maxDistanceToCenter(): number;
    get halfWidth(): number;
    get halfHeight(): number;
    clone(): Rectangle;
}
export declare class Circle {
    radius: number;
    constructor(r: number);
    get maxDistanceToCenter(): number;
    get perimeter(): number;
    get area(): number;
    clone(): Circle;
}
export declare class Square extends Rectangle {
    constructor(size: number);
    get size(): number;
    clone(): Square;
}
export declare class NullShape {
    get maxDistanceToCenter(): number;
    clone(): NullShape;
}
//# sourceMappingURL=shapes.d.ts.map