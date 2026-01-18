/**
 * 2D Vector class for game math operations.
 * Shared between client and server.
 */
export class Vector {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone(): Vector {
    return new Vector(this.x, this.y);
  }

  distanceTo(v: Vector): number {
    return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2));
  }

  distanceToSq(v: Vector): number {
    return Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2);
  }

  lengthSq(): number {
    return Math.pow(this.x, 2) + Math.pow(this.y, 2);
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  normalize(): this {
    const length = this.length();
    if (length === 0) {
      return this;
    }
    this.x /= length;
    this.y /= length;
    return this;
  }

  normalized(): Vector {
    return this.clone().normalize();
  }

  scalar(n: number): this {
    this.x *= n;
    this.y *= n;
    return this;
  }

  scaled(n: number): Vector {
    return this.clone().scalar(n);
  }

  add(v: Vector): this {
    this.set(this.x + v.x, this.y + v.y);
    return this;
  }

  added(v: Vector): Vector {
    return this.clone().add(v);
  }

  sub(v: Vector): this {
    this.set(this.x - v.x, this.y - v.y);
    return this;
  }

  subtracted(v: Vector): Vector {
    return this.clone().sub(v);
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setFrom(v: Vector): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  angleTo(v: Vector): number {
    const dot = this.dot(v);
    const det = this.cross(v);
    return Math.atan2(det, dot);
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  dot(v: Vector): number {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vector): number {
    return this.x * v.y - this.y * v.x;
  }

  rotate(angle: number, inDegree = true): this {
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

  rotated(angle: number, inDegree = true): Vector {
    return this.clone().rotate(angle, inDegree);
  }

  lerp(v: Vector, t: number): this {
    this.x = this.x + (v.x - this.x) * t;
    this.y = this.y + (v.y - this.y) * t;
    return this;
  }

  lerped(v: Vector, t: number): Vector {
    return this.clone().lerp(v, t);
  }

  equals(v: Vector, epsilon = 0.0001): boolean {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
  }

  isZero(epsilon = 0.0001): boolean {
    return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  toString(): string {
    return `Vector(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  /**
   * Create a vector from an angle (in radians).
   */
  static fromAngle(angle: number): Vector {
    return new Vector(Math.cos(angle), Math.sin(angle));
  }

  /**
   * Create a vector pointing from one point to another.
   */
  static direction(from: Vector, to: Vector): Vector {
    return to.subtracted(from).normalize();
  }

  /**
   * Linear interpolation between two vectors.
   */
  static lerp(a: Vector, b: Vector, t: number): Vector {
    return a.lerped(b, t);
  }

  /**
   * Get the distance between two vectors.
   */
  static distance(a: Vector, b: Vector): number {
    return a.distanceTo(b);
  }

  /**
   * Create a zero vector.
   */
  static zero(): Vector {
    return new Vector(0, 0);
  }

  /**
   * Create a unit vector pointing up (negative Y in screen coordinates).
   */
  static up(): Vector {
    return new Vector(0, -1);
  }

  /**
   * Create a unit vector pointing down.
   */
  static down(): Vector {
    return new Vector(0, 1);
  }

  /**
   * Create a unit vector pointing left.
   */
  static left(): Vector {
    return new Vector(-1, 0);
  }

  /**
   * Create a unit vector pointing right.
   */
  static right(): Vector {
    return new Vector(1, 0);
  }
}

export default Vector;
