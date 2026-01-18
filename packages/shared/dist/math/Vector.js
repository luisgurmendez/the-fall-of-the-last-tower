/**
 * 2D Vector class for game math operations.
 * Shared between client and server.
 */
export class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    clone() {
        return new Vector(this.x, this.y);
    }
    distanceTo(v) {
        return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2));
    }
    distanceToSq(v) {
        return Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2);
    }
    lengthSq() {
        return Math.pow(this.x, 2) + Math.pow(this.y, 2);
    }
    length() {
        return Math.sqrt(this.lengthSq());
    }
    normalize() {
        const length = this.length();
        if (length === 0) {
            return this;
        }
        this.x /= length;
        this.y /= length;
        return this;
    }
    normalized() {
        return this.clone().normalize();
    }
    scalar(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }
    scaled(n) {
        return this.clone().scalar(n);
    }
    add(v) {
        this.set(this.x + v.x, this.y + v.y);
        return this;
    }
    added(v) {
        return this.clone().add(v);
    }
    sub(v) {
        this.set(this.x - v.x, this.y - v.y);
        return this;
    }
    subtracted(v) {
        return this.clone().sub(v);
    }
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    setFrom(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    angleTo(v) {
        const dot = this.dot(v);
        const det = this.cross(v);
        return Math.atan2(det, dot);
    }
    angle() {
        return Math.atan2(this.y, this.x);
    }
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }
    rotate(angle, inDegree = true) {
        let _angleInRads = angle * (Math.PI / 180);
        if (!inDegree) {
            _angleInRads = angle;
        }
        const cos = Math.round(1000 * Math.cos(_angleInRads)) / 1000;
        const sin = Math.round(1000 * Math.sin(_angleInRads)) / 1000;
        const old = this.clone();
        this.x = old.x * cos - old.y * sin;
        this.y = old.x * sin + old.y * cos;
        return this;
    }
    rotated(angle, inDegree = true) {
        return this.clone().rotate(angle, inDegree);
    }
    lerp(v, t) {
        this.x = this.x + (v.x - this.x) * t;
        this.y = this.y + (v.y - this.y) * t;
        return this;
    }
    lerped(v, t) {
        return this.clone().lerp(v, t);
    }
    equals(v, epsilon = 0.0001) {
        return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
    }
    isZero(epsilon = 0.0001) {
        return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
    }
    toArray() {
        return [this.x, this.y];
    }
    toString() {
        return `Vector(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }
    /**
     * Create a vector from an angle (in radians).
     */
    static fromAngle(angle) {
        return new Vector(Math.cos(angle), Math.sin(angle));
    }
    /**
     * Create a vector pointing from one point to another.
     */
    static direction(from, to) {
        return to.subtracted(from).normalize();
    }
    /**
     * Linear interpolation between two vectors.
     */
    static lerp(a, b, t) {
        return a.lerped(b, t);
    }
    /**
     * Get the distance between two vectors.
     */
    static distance(a, b) {
        return a.distanceTo(b);
    }
    /**
     * Create a zero vector.
     */
    static zero() {
        return new Vector(0, 0);
    }
    /**
     * Create a unit vector pointing up (negative Y in screen coordinates).
     */
    static up() {
        return new Vector(0, -1);
    }
    /**
     * Create a unit vector pointing down.
     */
    static down() {
        return new Vector(0, 1);
    }
    /**
     * Create a unit vector pointing left.
     */
    static left() {
        return new Vector(-1, 0);
    }
    /**
     * Create a unit vector pointing right.
     */
    static right() {
        return new Vector(1, 0);
    }
}
export default Vector;
//# sourceMappingURL=Vector.js.map