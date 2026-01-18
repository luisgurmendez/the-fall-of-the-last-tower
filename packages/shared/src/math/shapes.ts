/**
 * Geometric shape primitives for collision detection.
 * Shared between client and server.
 */

export type Shape = Rectangle | Circle | NullShape;

export class Rectangle {
  public w: number;
  public h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  get maxDistanceToCenter(): number {
    return Math.max(this.w, this.h) / 2;
  }

  get halfWidth(): number {
    return this.w / 2;
  }

  get halfHeight(): number {
    return this.h / 2;
  }

  clone(): Rectangle {
    return new Rectangle(this.w, this.h);
  }
}

export class Circle {
  public radius: number;

  constructor(r: number) {
    this.radius = r;
  }

  get maxDistanceToCenter(): number {
    return this.radius;
  }

  get perimeter(): number {
    return 2 * Math.PI * this.radius;
  }

  get area(): number {
    return Math.PI * this.radius * this.radius;
  }

  clone(): Circle {
    return new Circle(this.radius);
  }
}

export class Square extends Rectangle {
  constructor(size: number) {
    super(size, size);
  }

  get size(): number {
    return this.w;
  }

  clone(): Square {
    return new Square(this.w);
  }
}

export class NullShape {
  get maxDistanceToCenter(): number {
    return 0;
  }

  clone(): NullShape {
    return new NullShape();
  }
}
