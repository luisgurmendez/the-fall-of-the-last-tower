/**
 * Geometric shape primitives for collision detection.
 * Shared between client and server.
 */
export class Rectangle {
    constructor(w, h) {
        this.w = w;
        this.h = h;
    }
    get width() {
        return this.w;
    }
    get height() {
        return this.h;
    }
    get maxDistanceToCenter() {
        return Math.max(this.w, this.h) / 2;
    }
    get halfWidth() {
        return this.w / 2;
    }
    get halfHeight() {
        return this.h / 2;
    }
    clone() {
        return new Rectangle(this.w, this.h);
    }
}
export class Circle {
    constructor(r) {
        this.radius = r;
    }
    get maxDistanceToCenter() {
        return this.radius;
    }
    get perimeter() {
        return 2 * Math.PI * this.radius;
    }
    get area() {
        return Math.PI * this.radius * this.radius;
    }
    clone() {
        return new Circle(this.radius);
    }
}
export class Square extends Rectangle {
    constructor(size) {
        super(size, size);
    }
    get size() {
        return this.w;
    }
    clone() {
        return new Square(this.w);
    }
}
export class NullShape {
    get maxDistanceToCenter() {
        return 0;
    }
    clone() {
        return new NullShape();
    }
}
//# sourceMappingURL=shapes.js.map